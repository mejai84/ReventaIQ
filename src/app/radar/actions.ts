"use server";

import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
  try {
    await prisma.scanProfile.create({ data: {
      userId: user.id, categoryId: category.id, ...(brand === null ? {} : { brandId: brand.id }), name: input.name,
      minNetProfitCop: input.minNetProfitCop, minRoiRate: input.minRoiRate,
      ...(input.maxPurchasePriceUsd === "" ? {} : { maxPurchasePriceUsd: input.maxPurchasePriceUsd }),
      minimumConfidence: input.minimumConfidence === "" ? "0" : input.minimumConfidence,
      frequencyMinutes: input.frequencyMinutes,
      sources: { create: { sourceKey: input.sourceKey, mode: input.sourceMode } },
      targets: { create: { categoryId: category.id } },
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/radar?error=profile-duplicate");
    throw error;
  }
  revalidatePath("/radar");
  redirect("/radar?created=profile");
}

const csvRow = z.object({
  sourceKey: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/).max(80),
  externalListingId: z.string().trim().max(200).optional(),
  canonicalUrl: z.string().trim().url().max(2000).optional(),
  title: z.string().trim().min(2).max(500),
  price: z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/).optional(),
  currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  availability: z.enum(["IN_STOCK", "OUT_OF_STOCK", "REMOVED", "UNKNOWN"]),
  observedAt: z.string().datetime({ offset: true }),
});

function readCsv(value: string): Record<string, string>[] {
  const lines = value.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2 || lines.length > 1001) throw new Error("rows");
  const parseLine = (line: string) => {
    const cells: string[] = []; let cell = ""; let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]!;
      if (char === '"') { if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
      else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
      else cell += char;
    }
    if (quoted) throw new Error("quotes");
    cells.push(cell.trim()); return cells;
  };
  const headers = parseLine(lines[0]!).map((header) => header.trim());
  const expected = ["source_key", "external_listing_id", "canonical_url", "title", "price", "currency", "availability", "observed_at"];
  if (headers.join("|") !== expected.join("|")) throw new Error("headers");
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseLine(line)[index] ?? ""])));
}

export async function importRadarCsv(formData: FormData): Promise<void> {
  const user = await requireUser();
  const profileId = id.safeParse(formData.get("profileId"));
  const csvText = z.string().min(1).max(500_000).safeParse(formData.get("csvText"));
  if (!profileId.success || !csvText.success) redirect("/radar?error=csv-validation");
  const profile = await prisma.scanProfile.findFirst({ where: { id: profileId.data, userId: user.id, isActive: true }, select: { id: true } });
  if (profile === null) redirect("/radar?error=profile-relation");
  let rows: z.infer<typeof csvRow>[];
  try {
    rows = readCsv(csvText.data).map((row) => csvRow.parse({ sourceKey: row.source_key, externalListingId: row.external_listing_id || undefined, canonicalUrl: row.canonical_url || undefined, title: row.title, price: row.price || undefined, currencyCode: row.currency || undefined, availability: row.availability, observedAt: row.observed_at }));
    if (rows.some((row) => row.externalListingId === undefined && row.canonicalUrl === undefined)) throw new Error("identity");
  } catch { redirect("/radar?error=csv-format"); }
  const key = createHash("sha256").update(`${profile.id}:${csvText.data}`).digest("hex");
  try {
    await prisma.$transaction(async (tx) => {
      const run = await tx.scanRun.create({ data: { scanProfileId: profile.id, mode: "CSV", idempotencyKey: key, status: "RUNNING" } });
      for (const [sourceKey, sourceRows] of Object.entries(Object.groupBy(rows, (row) => row.sourceKey))) {
        const sourceRun = await tx.scanSourceRun.create({ data: { scanRunId: run.id, sourceKey, mode: "CSV", status: "RUNNING", startedAt: new Date(), candidateCount: sourceRows!.length } });
        let accepted = 0;
        for (const row of sourceRows!) {
          const listing = await tx.radarListing.findFirst({ where: { sourceKey, OR: [ ...(row.externalListingId === undefined ? [] : [{ externalListingId: row.externalListingId }]), ...(row.canonicalUrl === undefined ? [] : [{ canonicalUrl: row.canonicalUrl }]) ] } });
          const saved = listing === null
            ? await tx.radarListing.create({ data: { sourceKey, ...(row.externalListingId === undefined ? {} : { externalListingId: row.externalListingId }), ...(row.canonicalUrl === undefined ? {} : { canonicalUrl: row.canonicalUrl }), availability: row.availability, lastSeenAt: row.observedAt } })
            : await tx.radarListing.update({ where: { id: listing.id }, data: { availability: row.availability, lastSeenAt: row.observedAt } });
          const fingerprint = createHash("sha256").update(JSON.stringify(row)).digest("hex");
          try { await tx.radarListingObservation.create({ data: { radarListingId: saved.id, scanSourceRunId: sourceRun.id, title: row.title, ...(row.price === undefined ? {} : { price: row.price }), ...(row.currencyCode === undefined ? {} : { currencyCode: row.currencyCode }), availability: row.availability, contentFingerprint: fingerprint, observedAt: row.observedAt } }); accepted += 1; } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error; }
        }
        await tx.scanSourceRun.update({ where: { id: sourceRun.id }, data: { status: "COMPLETED", completedAt: new Date(), acceptedCount: accepted, rejectedCount: sourceRows!.length - accepted } });
      }
      await tx.scanRun.update({ where: { id: run.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/radar?error=csv-duplicate");
    throw error;
  }
  revalidatePath("/radar");
  redirect("/radar?created=import");
}