import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { cronBucketKey, selectDueProfiles } from "@/modules/radar/application/scheduled-scan";
import {
  findRadarConnectorByMode,
  readRadarConnectorEnv,
  type RadarConnectorEnv,
} from "@/modules/radar/connectors";

const SOURCE_TIMEOUT_MS = 10_000;

export interface CronSourceResult {
  readonly profileId: string;
  readonly sourceKey: string;
  readonly mode: string;
  readonly status: "COMPLETED" | "SKIPPED" | "FAILED";
  readonly reason?: string;
}

export interface CronSummary {
  readonly dueProfiles: number;
  readonly startedRuns: number;
  readonly duplicateWindows: number;
  readonly failedRuns: number;
  readonly sources: readonly CronSourceResult[];
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Runs only profiles that are active, have at least one active source and whose
 * frequency window elapsed. Manual and CSV sources are never fetched: they
 * require an explicit authenticated import. API and feed sources stay skipped
 * until both credentials and the explicit enable flag are present.
 */
export async function runScheduledRadarScan(now: Date): Promise<CronSummary> {
  const env: RadarConnectorEnv = readRadarConnectorEnv(process.env).env;

  const profiles = await prisma.scanProfile.findMany({
    where: { isActive: true },
    select: {
      id: true,
      frequencyMinutes: true,
      sources: { where: { isActive: true }, select: { sourceKey: true, mode: true } },
      runs: { select: { startedAt: true }, orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  const due = selectDueProfiles(
    profiles
      .map((profile) => ({
        id: profile.id,
        frequencyMinutes: profile.frequencyMinutes,
        lastRunAt: profile.runs[0]?.startedAt ?? null,
        sources: profile.sources,
      }))
      .filter((profile) => profile.sources.length > 0),
    now,
  );

  const sources: CronSourceResult[] = [];
  let startedRuns = 0;
  let duplicateWindows = 0;
  let failedRuns = 0;

  for (const profile of due) {
    const primaryMode = profile.sources[0]?.mode ?? "MANUAL";
    const idempotencyKey = cronBucketKey(profile.id, profile.frequencyMinutes, now);

    let runId: bigint;
    try {
      const run = await prisma.scanRun.create({
        data: {
          scanProfileId: profile.id,
          mode: primaryMode,
          idempotencyKey,
          status: "RUNNING",
          trigger: "SCHEDULED",
        },
        select: { id: true },
      });
      runId = run.id;
      startedRuns += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        duplicateWindows += 1;
        continue;
      }
      throw error;
    }

    let runFailed = false;

    for (const source of profile.sources) {
      const sourceRun = await prisma.scanSourceRun.create({
        data: {
          scanRunId: runId,
          sourceKey: source.sourceKey,
          mode: source.mode,
          status: "RUNNING",
          startedAt: now,
        },
        select: { id: true },
      });

      if (source.mode === "MANUAL" || source.mode === "CSV") {
        await prisma.scanSourceRun.update({
          where: { id: sourceRun.id },
          data: { status: "SKIPPED", completedAt: new Date(), errorMessage: "explicit-import-required" },
        });
        sources.push({ profileId: profile.id.toString(), sourceKey: source.sourceKey, mode: source.mode, status: "SKIPPED", reason: "explicit-import-required" });
        continue;
      }

      const connector = findRadarConnectorByMode(source.mode);
      const connectorStatus = connector?.describe(env).state ?? "UNSUPPORTED";
      if (connector === undefined || !connector.implemented || connectorStatus !== "CONFIGURED") {
        const reason = connector === undefined ? "unsupported" : !connector.implemented ? "not-implemented" : connectorStatus.toLowerCase();
        await prisma.scanSourceRun.update({
          where: { id: sourceRun.id },
          data: { status: "SKIPPED", completedAt: new Date(), errorMessage: reason },
        });
        sources.push({ profileId: profile.id.toString(), sourceKey: source.sourceKey, mode: source.mode, status: "SKIPPED", reason });
        continue;
      }

      try {
        const candidates = await withTimeout(
          connector.fetchCandidates({ sourceKey: source.sourceKey, requestedAt: now.toISOString(), limit: 1_000 }, env),
          SOURCE_TIMEOUT_MS,
        );
        await prisma.scanSourceRun.update({
          where: { id: sourceRun.id },
          data: { status: "COMPLETED", completedAt: new Date(), candidateCount: candidates.length },
        });
        sources.push({ profileId: profile.id.toString(), sourceKey: source.sourceKey, mode: source.mode, status: "COMPLETED" });
      } catch (error) {
        runFailed = true;
        const reason = error instanceof Error && error.message === "timeout" ? "timeout" : "connector-error";
        await prisma.scanSourceRun.update({
          where: { id: sourceRun.id },
          data: { status: "FAILED", completedAt: new Date(), errorMessage: reason },
        });
        sources.push({ profileId: profile.id.toString(), sourceKey: source.sourceKey, mode: source.mode, status: "FAILED", reason });
      }
    }

    await prisma.scanRun.update({
      where: { id: runId },
      data: { status: runFailed ? "FAILED" : "COMPLETED", completedAt: new Date() },
    });
    if (runFailed) failedRuns += 1;
  }

  return { dueProfiles: due.length, startedRuns, duplicateWindows, failedRuns, sources };
}
