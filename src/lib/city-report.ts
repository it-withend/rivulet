import { unstable_cache } from "next/cache";
import { loadCityStreams, type CityStream } from "@/lib/city-data";
import { ONE_HEALTH_PARAMETERS, type Concern } from "@/lib/science/one-health";
import type { WfdClass } from "@/lib/science/wfd";
import { EXPOSURE_LABEL, HAZARD_LABEL } from "@/lib/ui/one-health-copy";

const CONCERN_RANK: Record<Concern, number> = { unknown: -1, none: 0, watch: 1, care: 2, avoid: 3 };
const CLASS_ORDER: WfdClass[] = ["high", "good", "moderate", "poor", "bad"];

export type ReportStream = {
  id: string;
  name: string;
  concern: Concern;
  signs: string[];
  place: string | null;
};

/** Plain, serialisable data for the city page — safe to keep in the data cache. */
export type CityReport = {
  streamCount: number;
  ratedCount: number;
  recentCount: number;
  activePeople: number;
  byClass: { klass: WfdClass; count: number }[];
  unrated: number;
  takeCare: ReportStream[];
  needsVisit: ReportStream[];
  nearChildren: number;
  hasSynthetic: boolean;
};

function nearestPlace(stream: CityStream): string | null {
  const site = [...stream.exposure].sort((a, b) => a.nearestM - b.nearestM)[0];
  if (!site) return null;
  return `${EXPOSURE_LABEL[site.kind]}${site.nearestName ? ` (${site.nearestName})` : ""}, ${Math.round(site.nearestM)} m`;
}

function summarise(stream: CityStream): ReportStream {
  return {
    id: stream.id,
    name: stream.name,
    concern: stream.oneHealth.overall,
    signs: stream.oneHealth.hazards.filter((h) => h.level !== "none").map((h) => HAZARD_LABEL[h.code]),
    place: nearestPlace(stream),
  };
}

async function build(city: string): Promise<CityReport> {
  const now = new Date();
  const { streams, hasSynthetic } = await loadCityStreams(city, now);

  const windowStart = now.getTime() - ONE_HEALTH_PARAMETERS.windowDays * 86_400_000;
  const recent = streams.flatMap((s) => s.observations.filter((o) => new Date(o.observedAt).getTime() >= windowStart));
  const activePeople = new Set(recent.map((o) => o.observerId).filter(Boolean)).size;
  const rated = streams.filter((s) => s.snapshot.assessment.klass !== null);

  const takeCareAll = streams
    .filter((s) => CONCERN_RANK[s.oneHealth.overall] >= CONCERN_RANK.care && s.exposure.length > 0)
    .sort(
      (a, b) =>
        CONCERN_RANK[b.oneHealth.overall] - CONCERN_RANK[a.oneHealth.overall] ||
        b.oneHealth.recentReports - a.oneHealth.recentReports,
    )
    .slice(0, 8);

  const needsVisit = streams
    .filter((s) => s.oneHealth.overall === "unknown" && s.exposure.length > 0)
    .sort((a, b) => b.exposure.reduce((n, e) => n + e.siteCount, 0) - a.exposure.reduce((n, e) => n + e.siteCount, 0))
    .slice(0, 8);

  return {
    streamCount: streams.length,
    ratedCount: rated.length,
    recentCount: recent.length,
    activePeople,
    byClass: CLASS_ORDER.map((klass) => ({
      klass,
      count: rated.filter((s) => s.snapshot.assessment.klass === klass).length,
    })),
    unrated: streams.length - rated.length,
    takeCare: takeCareAll.map(summarise),
    needsVisit: needsVisit.map(summarise),
    nearChildren: takeCareAll.filter((s) =>
      s.exposure.some((e) => e.kind === "playground" || e.kind === "school" || e.kind === "kindergarten"),
    ).length,
    hasSynthetic,
  };
}

/** Recomputed at most every two minutes per city; the report changes slowly and is expensive to build. */
export const getCityReport = unstable_cache(build, ["city-report-v1"], { revalidate: 120 });
