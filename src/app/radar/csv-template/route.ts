import { buildRadarCsvTemplate } from "@/modules/radar/application";

export function GET() {
  return new Response(buildRadarCsvTemplate(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="radar-plantilla.csv"',
      "cache-control": "no-store",
    },
  });
}
