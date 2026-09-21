import { CITIES } from "@/lib/cities";
import { loadCityStreams } from "@/lib/city-data";

const COLUMNS = [
  "stream_id",
  "name",
  "status_class",
  "posterior_mean",
  "interval_90_lower",
  "interval_90_upper",
  "data_confidence",
  "reports",
  "observers",
  "last_report",
  "one_health_concern",
  "recent_reports_30d",
  "satellite_diverged",
  "method_version",
  "city_includes_demo_data",
] as const;

/** RFC 4180 quoting, with a guard so a stream name that looks like a spreadsheet formula stays text. */
function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The whole city as one table a researcher or a city service can open in a
 * spreadsheet: every stream section with its status, the interval and
 * confidence behind it, and the One Health concern. Held-for-review reports are
 * already excluded. Demonstration reports remain in it, as on the map, and the
 * `city_includes_demo_data` column says so.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  if (!CITIES.includes(city)) {
    return new Response("Unknown city", { status: 404 });
  }

  const { streams, hasSynthetic, failed } = await loadCityStreams(city);
  if (failed) return new Response("The database is unavailable", { status: 503 });

  const lines = [COLUMNS.join(",")];
  for (const s of streams) {
    const last = s.observations.map((o) => o.observedAt).sort().at(-1) ?? null;
    const p = s.snapshot.posterior;
    const rated = s.snapshot.assessment.klass !== null;
    lines.push(
      [
        s.id,
        s.name,
        s.snapshot.assessment.klass,
        rated ? p.mean.toFixed(3) : null,
        rated ? p.lower.toFixed(3) : null,
        rated ? p.upper.toFixed(3) : null,
        s.snapshot.confidence.toFixed(3),
        s.snapshot.observationCount,
        s.snapshot.uniqueObservers,
        last,
        s.oneHealth.overall,
        s.oneHealth.recentReports,
        s.snapshot.divergence?.diverged ?? null,
        s.snapshot.methodVersion,
        hasSynthetic,
      ]
        .map(cell)
        .join(","),
    );
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="rivulet-${city.toLowerCase()}-streams.csv"`,
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
