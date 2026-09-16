import Link from "next/link";
import type React from "react";
import {
  AlertTriangle,
  Baby,
  CalendarDays,
  Camera,
  Download,
  MapPin,
  SearchCheck,
  Users,
  Waves,
} from "lucide-react";
import { LinkChip } from "@/components/ui/LinkChip";
import { Button } from "@/components/ui/Button";
import { loadCityStreams, type CityStream } from "@/lib/city-data";
import { CITIES, DEFAULT_CITY } from "@/lib/cities";
import { ONE_HEALTH_PARAMETERS, type Concern } from "@/lib/science/one-health";
import type { WfdClass } from "@/lib/science/wfd";
import { colourForClass, INSUFFICIENT_DATA_COLOUR, PLAIN_CLASS_LABEL } from "@/lib/ui/wfd-colours";
import { CONCERN_COLOUR, CONCERN_LABEL, EXPOSURE_LABEL, HAZARD_LABEL } from "@/lib/ui/one-health-copy";

export const metadata = {
  title: "City report — Rivulet",
};

const CONCERN_RANK: Record<Concern, number> = { unknown: -1, none: 0, watch: 1, care: 2, avoid: 3 };
const CLASS_ORDER: WfdClass[] = ["high", "good", "moderate", "poor", "bad"];

function nearestPlace(stream: CityStream): string | null {
  const site = [...stream.exposure].sort((a, b) => a.nearestM - b.nearestM)[0];
  if (!site) return null;
  return `${EXPOSURE_LABEL[site.kind]}${site.nearestName ? ` (${site.nearestName})` : ""}, ${Math.round(site.nearestM)} m`;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-md border border-rule bg-paper-raised p-4">
      <span aria-hidden="true" className="text-river [&_svg]:size-5">{icon}</span>
      <p className="num m-0 mt-2 text-3xl">{value}</p>
      <p className="m-0 mt-1 text-sm text-ink-muted">{label}</p>
    </div>
  );
}

export default async function CityReportPage(props: PageProps<"/city">) {
  const searchParams = await props.searchParams;
  const requested = Array.isArray(searchParams.city) ? searchParams.city[0] : searchParams.city;
  const city = requested && CITIES.includes(requested) ? requested : DEFAULT_CITY;
  const now = new Date();

  const { streams, hasSynthetic } = await loadCityStreams(city, now);

  const windowStart = now.getTime() - ONE_HEALTH_PARAMETERS.windowDays * 86_400_000;
  const recent = streams.flatMap((s) => s.observations.filter((o) => new Date(o.observedAt).getTime() >= windowStart));
  const activePeople = new Set(recent.map((o) => o.observerId).filter(Boolean)).size;
  const rated = streams.filter((s) => s.snapshot.assessment.klass !== null);

  const byClass = CLASS_ORDER.map((k) => ({
    klass: k,
    count: rated.filter((s) => s.snapshot.assessment.klass === k).length,
  }));
  const unrated = streams.length - rated.length;

  const takeCare = streams
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

  const nearChildren = takeCare.filter((s) =>
    s.exposure.some((e) => e.kind === "playground" || e.kind === "school" || e.kind === "kindergarten"),
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <header>
        <p className="field-label m-0">City report</p>
        <h1 className="mt-2 mb-3 text-4xl">How {city}&apos;s streams are doing</h1>
        <p className="m-0 max-w-2xl text-ink-muted">
          A one-page summary for neighbours, schools and the city: where to take
          care, and where a quick check would help most. Built from what residents
          reported in the last {ONE_HEALTH_PARAMETERS.windowDays} days and places
          from OpenStreetMap.
        </p>
        <nav aria-label="Cities" className="mt-5 flex flex-wrap gap-2">
          {CITIES.map((name) => (
            <LinkChip key={name} href={`/city?city=${name}`} active={name === city}>
              {name}
            </LinkChip>
          ))}
        </nav>
      </header>

      <section aria-label="At a glance" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Waves />} value={String(streams.length)} label="stream sections mapped" />
        <Stat
          icon={<SearchCheck />}
          value={streams.length ? `${Math.round((rated.length / streams.length) * 100)}%` : "—"}
          label="have enough reports to rate"
        />
        <Stat icon={<CalendarDays />} value={String(recent.length)} label={`reports in the last ${ONE_HEALTH_PARAMETERS.windowDays} days`} />
        <Stat icon={<Users />} value={String(activePeople)} label="people reporting recently" />
      </section>

      <section aria-labelledby="status-heading" className="space-y-3">
        <h2 id="status-heading" className="m-0 text-2xl">Water health across the city</h2>
        {streams.length === 0 ? (
          <p className="m-0 text-ink-muted">This city&apos;s water network has not been loaded yet.</p>
        ) : (
          <>
            <div className="flex h-6 w-full overflow-hidden rounded-sm border border-rule" role="img"
              aria-label={[...byClass.map((c) => `${PLAIN_CLASS_LABEL[c.klass]}: ${c.count}`), `Not checked enough: ${unrated}`].join(", ")}>
              {byClass.map((c) =>
                c.count > 0 ? (
                  <div key={c.klass} style={{ width: `${(c.count / streams.length) * 100}%`, backgroundColor: colourForClass(c.klass) }} />
                ) : null,
              )}
              {unrated > 0 && (
                <div className="hatch-insufficient" style={{ width: `${(unrated / streams.length) * 100}%` }} />
              )}
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm">
              {byClass.map((c) => (
                <li key={c.klass} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block size-3 rounded-full border border-rule" style={{ backgroundColor: colourForClass(c.klass) }} />
                  {PLAIN_CLASS_LABEL[c.klass]} <span className="num text-ink-muted">{c.count}</span>
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block size-3 rounded-full border border-rule" style={{ backgroundColor: INSUFFICIENT_DATA_COLOUR }} />
                Not checked enough <span className="num text-ink-muted">{unrated}</span>
              </li>
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="care-heading" className="space-y-3">
        <h2 id="care-heading" className="m-0 flex items-center gap-2 text-2xl">
          <AlertTriangle aria-hidden="true" className="size-6 text-[#b0561d]" />
          Where to take care
        </h2>
        <p className="m-0 max-w-2xl text-ink-muted">
          Streams where residents reported warning signs and people or dogs come
          close to the water.
          {nearChildren > 0 && (
            <>
              {" "}
              <Baby aria-hidden="true" className="inline size-4 align-[-2px]" /> {nearChildren} of them are near a
              playground, school or kindergarten.
            </>
          )}
        </p>
        {takeCare.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">No streams with recent warning signs near places people use.</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
            {takeCare.map((s) => {
              const signs = s.oneHealth.hazards.filter((h) => h.level !== "none").map((h) => HAZARD_LABEL[h.code]);
              return (
                <li key={s.id}>
                  <Link href={`/water/${s.id}`} className="block h-full rounded-md border border-rule bg-paper-raised p-4 text-ink no-underline hover:border-ink">
                    <p className="m-0 font-medium">{s.name}</p>
                    <p className="m-0 mt-1 flex items-center gap-1.5 text-sm">
                      <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ backgroundColor: CONCERN_COLOUR[s.oneHealth.overall] }} />
                      {CONCERN_LABEL[s.oneHealth.overall]}
                    </p>
                    <p className="m-0 mt-1 text-sm text-ink-muted">Reported: {signs.join(", ")}</p>
                    {nearestPlace(s) && (
                      <p className="m-0 mt-1 flex items-center gap-1 text-sm text-ink-muted">
                        <MapPin aria-hidden="true" className="size-3.5" /> {nearestPlace(s)}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="visit-heading" className="space-y-3">
        <h2 id="visit-heading" className="m-0 flex items-center gap-2 text-2xl">
          <Camera aria-hidden="true" className="size-6 text-river" />
          Where a visit would help most
        </h2>
        <p className="m-0 max-w-2xl text-ink-muted">
          People use these places, but nobody has checked the stream beside them
          in the last {ONE_HEALTH_PARAMETERS.windowDays} days — so nobody can say
          whether it is fine.
        </p>
        {needsVisit.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">Every stream near a public place has a recent report.</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
            {needsVisit.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-rule bg-paper-raised p-4">
                <div className="min-w-0">
                  <Link href={`/water/${s.id}`} className="font-medium">{s.name}</Link>
                  {nearestPlace(s) && (
                    <p className="m-0 mt-1 flex items-center gap-1 text-sm text-ink-muted">
                      <MapPin aria-hidden="true" className="size-3.5 shrink-0" /> {nearestPlace(s)}
                    </p>
                  )}
                </div>
                <Button href={`/observe?waterbody=${s.id}`} variant="secondary" className="shrink-0 px-3">
                  Check it
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="space-y-2 border-t border-rule pt-6 text-sm text-ink-muted">
        {hasSynthetic && <p className="m-0">This city includes demonstration reports while the pilot collects real ones.</p>}
        <p className="m-0">
          Indicative, built from what residents can see and smell — not a laboratory
          or public health assessment.
        </p>
        <p className="m-0 flex items-center gap-1.5">
          <Download aria-hidden="true" className="size-4" />
          Researchers and city systems can take the data as FHIR from the{" "}
          <Link href="/open-data">open data page</Link>.
        </p>
      </footer>
    </div>
  );
}
