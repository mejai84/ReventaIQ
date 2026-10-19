import { NextResponse, type NextRequest } from "next/server";
import { verifyCronSecret } from "@/modules/radar/application/scheduled-scan";
import { runScheduledRadarScan } from "./service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function readProvidedSecret(request: NextRequest): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length);
  return request.headers.get("x-cron-secret") ?? undefined;
}

export async function GET(request: NextRequest) {
  // Vercel Cron injects `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET
  // exists; RADAR_CRON_SECRET is accepted as the project-specific alias.
  const configured = process.env.RADAR_CRON_SECRET ?? process.env.CRON_SECRET;
  if (configured === undefined || configured.trim().length < 16) {
    return NextResponse.json({ error: "cron-not-configured" }, { status: 503 });
  }
  if (!verifyCronSecret(readProvidedSecret(request), configured)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runScheduledRadarScan(new Date());
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    // No message, no query, no connection string: only the error class name.
    console.error("Radar cron failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "cron-failed" }, { status: 500 });
  }
}
