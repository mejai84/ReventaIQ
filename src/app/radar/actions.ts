"use server";

import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  parseRadarCsv,
  RadarCsvError,
  type RadarCsvFatalCode,
  type RadarCsvRow,
} from "@/modules/radar/application";
import { findRadarConnectorByMode, readRadarConnectorEnv } from "@/modules/radar/connectors";
import {
  deriveListingEvent,
  evaluateRadarObservation,
  observationFingerprint,
  type ListingCandidate,
} from "@/modules/radar/domain";

const id = z.string().regex(/^\d+$/).transform(BigInt);
const money = z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/);
const profileForm = z.object({
  name: z.string().trim().min(2).max(100),
  categoryId: id,
  brandId: z.union([z.literal(""), id]),
  minNetProfitCop: money,
  minRoiRate: money,
  maxPurchasePriceUsd: z.union([z.literal(""), money]),
  minimumConfidence: z.union([z.literal(""), money]),
  frequencyMinutes: z.string().regex(/^\d+$/).transform(Number).refine((value) => value >= 15 && value <= 10080),
  sourceKey: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/).max(80),
  sourceMode: z.enum(["API", "WEB_PUBLIC", "FEED", "MANUAL", "CSV"]),
});

export async function createScanProfile(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = profileForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/radar?error=profile-validation");
  const input = parsed.data;
  const [category, brand] = await Promise.all([
    prisma.productCategory.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } }),
    input.brandId === "" ? null : prisma.brand.findFirst({ where: { id: input.brandId, isActive: true }, select: { id: true } }),
  ]);
  if (category === null || (input.brandId !== "" && brand === null)) redirect("/radar?error=profile-relation");
  const connector = findRadarConnectorByMode(input.sourceMode);
  const sourceIsActive = connector !== undefined && connector.implemented && connector.describe(readRadarConnectorEnv(process.env).env).state === "CONFIGURED";
  try {
    await prisma.scanProfile.create({ data: {
      userId: user.id, categoryId: category.id, ...(brand === null ? {} : { brandId: brand.id }), name: input.name,
      minNetProfitCop: input.minNetProfitCop, minRoiRate: input.minRoiRate,
      ...(input.maxPurchasePriceUsd === "" ? {} : { maxPurchasePriceUsd: input.maxPurchasePriceUsd }),
      minimumConfidence: input.minimumConfidence === "" ? "0" : input.minimumConfidence,
      frequencyMinutes: input.frequencyMinutes,
      sources: { create: { sourceKey: input.sourceKey, mode: input.sourceMode, isActive: sourceIsActive } },
      targets: { create: { categoryId: category.id } },
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/radar?error=profile-duplicate");
    throw error;
  }
  revalidatePath("/radar");
  redirect("/radar?created=profile");
}

function toCandidate(row: RadarCsvRow): ListingCandidate {
  return {
    sourceKey: row.sourceKey,
    ...(row.externalListingId === undefined ? {} : { externalListingId: row.externalListingId }),
    ...(row.canonicalUrl === undefined ? {} : { canonicalUrl: row.canonicalUrl }),
    title: row.title,
    ...(row.price === undefined ? {} : { price: new Decimal(row.price) }),
    ...(row.currencyCode === undefined ? {} : { currency: row.currencyCode }),
    availability: row.availability,
    observedAt: row.observedAt,
    attributes: row.confidence === undefined ? {} : { confidence: row.confidence },
  };
}

/**
 * A CSV that cannot even be parsed still leaves an auditable, sanitized run.
 * Only the fatal code is stored: no header text, no row values, no file path.
 */
async function recordFatalCsv(profileId: bigint, userId: bigint, code: RadarCsvFatalCode, csvText: string): Promise<void> {
  const idempotencyKey = createHash("sha256").update(`${profileId}:fatal:${code}:${csvText}`).digest("hex");
  try {
    await prisma.$transaction(async (tx) => {
      const run = await tx.scanRun.create({ data: {
        scanProfileId: profileId, mode: "CSV", idempotencyKey, status: "FAILED", trigger: "CSV", triggeredByUserId: userId,
        completedAt: new Date(), errorMessage: `csv-${code}`,
      } });
      await tx.scanSourceRun.create({ data: {
        scanRunId: run.id, sourceKey: "csv", mode: "CSV", status: "FAILED", startedAt: new Date(), completedAt: new Date(),
        errorMessage: `csv-${code}`, errorDetails: [{ row: 1, code }],
      } });
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
}

export async function importRadarCsv(formData: FormData): Promise<void> {
  const user = await requireUser();
  const profileId = id.safeParse(formData.get("profileId"));
  const csvText = z.string().min(1).max(500_000).safeParse(formData.get("csvText"));
  if (!profileId.success || !csvText.success) redirect("/radar?error=csv-validation");
  const profile = await prisma.scanProfile.findFirst({ where: { id: profileId.data, userId: user.id, isActive: true }, select: { id: true } });
  if (profile === null) redirect("/radar?error=profile-relation");

  let parsed: ReturnType<typeof parseRadarCsv>;
  try {
    parsed = parseRadarCsv(csvText.data);
  } catch (error) {
    if (!(error instanceof RadarCsvError)) throw error;
    await recordFatalCsv(profile.id, user.id, error.code, csvText.data);
    revalidatePath("/radar");
    redirect("/radar?error=csv-format");
  }

  const idempotencyKey = createHash("sha256").update(`${profile.id}:${csvText.data}`).digest("hex");
  const rowErrors = parsed.errors.map((error) => ({ row: error.row, code: error.code }));
  let hasRowErrors = false;

  try {
    await prisma.$transaction(async (tx) => {
      const run = await tx.scanRun.create({ data: { scanProfileId: profile.id, mode: "CSV", idempotencyKey, status: "RUNNING", trigger: "CSV", triggeredByUserId: user.id } });

      // Diagnostics belong to a synthetic "csv" source run so valid rows can
      // keep accurate per-source counts without losing the rejected lines.
      if (parsed.errors.length > 0) {
        hasRowErrors = true;
        await tx.scanSourceRun.create({ data: {
          scanRunId: run.id, sourceKey: "csv", mode: "CSV", status: "COMPLETED",
          startedAt: new Date(), completedAt: new Date(),
          candidateCount: parsed.errors.length, acceptedCount: 0, rejectedCount: parsed.errors.length,
          errorDetails: rowErrors,
        } });
      }

      for (const [sourceKey, sourceRows] of Object.entries(Object.groupBy(parsed.rows, (row) => row.sourceKey))) {
        const rows = sourceRows!;
        const sourceRun = await tx.scanSourceRun.create({ data: {
          scanRunId: run.id, sourceKey, mode: "CSV", status: "RUNNING", startedAt: new Date(), candidateCount: rows.length,
        } });

        const externalIds = rows.flatMap((row) => (row.externalListingId === undefined ? [] : [row.externalListingId]));
        const canonicalUrls = rows.flatMap((row) => (row.canonicalUrl === undefined ? [] : [row.canonicalUrl]));
        const existingListings = await tx.radarListing.findMany({
          where: { sourceKey, OR: [
            ...(externalIds.length === 0 ? [] : [{ externalListingId: { in: externalIds } }]),
            ...(canonicalUrls.length === 0 ? [] : [{ canonicalUrl: { in: canonicalUrls } }]),
          ] },
        });

        type StoredListing = (typeof existingListings)[number];
        const byExternalId = new Map<string, StoredListing>();
        const byCanonicalUrl = new Map<string, StoredListing>();
        for (const listing of existingListings) {
          if (listing.externalListingId !== null) byExternalId.set(listing.externalListingId, listing);
          if (listing.canonicalUrl !== null) byCanonicalUrl.set(listing.canonicalUrl, listing);
        }

        // One query for the latest known observation of every pre-existing
        // listing in this batch. The map is updated as the batch advances so a
        // repeated listing still derives its event from the previous row.
        const previousObservations = existingListings.length === 0 ? [] : await tx.radarListingObservation.findMany({
          where: { radarListingId: { in: existingListings.map((listing) => listing.id) } },
          orderBy: [{ observedAt: "desc" }, { id: "desc" }],
          select: { radarListingId: true, price: true, availability: true },
        });
        const latestByListing = new Map<bigint, { price: Decimal | null; availability: StoredListing["availability"] }>();
        for (const observation of previousObservations) {
          if (!latestByListing.has(observation.radarListingId)) {
            latestByListing.set(observation.radarListingId, { price: observation.price, availability: observation.availability });
          }
        }

        let accepted = 0;
        let rejected = 0;

        for (const row of rows) {
          const candidate = toCandidate(row);
          let listing = row.externalListingId === undefined ? undefined : byExternalId.get(row.externalListingId);
          if (listing === undefined && row.canonicalUrl !== undefined) listing = byCanonicalUrl.get(row.canonicalUrl);

          listing = listing === undefined
            ? await tx.radarListing.create({ data: {
                sourceKey,
                ...(row.externalListingId === undefined ? {} : { externalListingId: row.externalListingId }),
                ...(row.canonicalUrl === undefined ? {} : { canonicalUrl: row.canonicalUrl }),
                availability: row.availability, lastSeenAt: row.observedAt,
              } })
            : await tx.radarListing.update({ where: { id: listing.id }, data: { availability: row.availability, lastSeenAt: row.observedAt } });

          if (listing.externalListingId !== null) byExternalId.set(listing.externalListingId, listing);
          if (listing.canonicalUrl !== null) byCanonicalUrl.set(listing.canonicalUrl, listing);

          const previous = latestByListing.get(listing.id);
          const previousForEvent = previous === undefined ? undefined : {
            ...(previous.price === null ? {} : { price: previous.price }),
            availability: previous.availability,
          };
          const event = deriveListingEvent(previousForEvent, candidate);
          const fingerprint = observationFingerprint(candidate);

          try {
            await tx.radarListingObservation.create({ data: {
              radarListingId: listing.id, scanSourceRunId: sourceRun.id, title: row.title,
              ...(row.price === undefined ? {} : { price: row.price }),
              ...(row.currencyCode === undefined ? {} : { currencyCode: row.currencyCode }),
              availability: row.availability, contentFingerprint: fingerprint,
              ...(event === undefined ? {} : { eventCode: event }), observedAt: row.observedAt,
            } });
            accepted += 1;
            latestByListing.set(listing.id, { price: row.price === undefined ? null : new Decimal(row.price), availability: row.availability });
          } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
              rejected += 1;
              continue;
            }
            throw error;
          }
        }

        await tx.scanSourceRun.update({ where: { id: sourceRun.id }, data: {
          status: "COMPLETED", completedAt: new Date(), acceptedCount: accepted, rejectedCount: rejected,
        } });
      }

      await tx.scanRun.update({ where: { id: run.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    }, { timeout: 30_000, maxWait: 5_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/radar?error=csv-duplicate");
    throw error;
  }

  revalidatePath("/radar");
  redirect(hasRowErrors ? "/radar?error=csv-rows" : "/radar?created=import");
}

/**
 * Explicit review of one observation under one profile. It records the
 * evaluation snapshot for traceability and never creates an opportunity,
 * purchase or marketplace action.
 */
export async function reviewRadarEvidence(formData: FormData): Promise<void> {
  const user = await requireUser();
  const observationId = id.safeParse(formData.get("observationId"));
  const profileId = id.safeParse(formData.get("profileId"));
  if (!observationId.success || !profileId.success) redirect("/radar?error=review-validation");

  const [observation, profile] = await Promise.all([
    prisma.radarListingObservation.findFirst({
      where: {
        id: observationId.data,
        scanSourceRun: { scanRun: { scanProfileId: profileId.data, scanProfile: { userId: user.id } } },
      },
      select: { id: true, price: true, currencyCode: true, availability: true, attributes: true },
    }),
    prisma.scanProfile.findFirst({
      where: { id: profileId.data, userId: user.id, isActive: true },
      select: {
        id: true, maxPurchasePriceUsd: true, minimumConfidence: true, minNetProfitCop: true, minRoiRate: true,
      },
    }),
  ]);
  if (observation === null || profile === null) redirect("/radar?error=review-relation");

  const evaluation = evaluateRadarObservation(observation, profile);
  const reasons: Prisma.InputJsonValue = evaluation.reasons.map((reason) => ({
    code: reason.code,
    outcome: reason.outcome,
  }));

  await prisma.radarEvidenceReview.upsert({
    where: { observationId_scanProfileId: { observationId: observation.id, scanProfileId: profile.id } },
    update: {
      userId: user.id, status: "REVIEWED", evaluationStatus: evaluation.status, evaluationReasons: reasons,
    },
    create: {
      observationId: observation.id, scanProfileId: profile.id, userId: user.id,
      status: "REVIEWED", evaluationStatus: evaluation.status, evaluationReasons: reasons,
    },
  });

  revalidatePath("/radar");
  redirect("/radar?reviewed=evidence");
}
