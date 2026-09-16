import Link from "next/link";
import type React from "react";
import { supabaseAnon } from "@/lib/db/client";
import { contributions, type ContributionRow } from "@/lib/engagement/contribution";
import { computeSnapshot, type StoredObservation } from "@/lib/science/snapshot";
import { OwnRowHighlighter } from "@/components/leaderboard/OwnRowHighlighter";
import { embeddedTrustScore, embeddedCity, firstOrSelf } from "@/lib/db/embed";

const CITIES = ["Coimbra", "Toulouse", "Benevento", "Gent", "Oslo"];
const TOP_N = 100;
const ACTIVE_OBSERVER_WINDOW_DAYS = 30;

type ObserverInfo = { displayName: string; isSynthetic: boolean };

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "inline-flex min-h-11 items-center border-b-2 px-1 text-[0.9375rem] no-underline " +
        (active
          ? "border-river font-medium text-ink"
          : "border-transparent text-ink-muted hover:border-rule-strong hover:text-ink")
      }
    >
      {children}
    </Link>
  );
}

function CityChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "inline-flex min-h-11 items-center rounded-sm border px-3.5 py-2 " +
        "font-sans text-[0.9375rem] leading-tight no-underline transition-colors duration-150 " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
        (active
          ? "border-ink bg-ink text-paper"
          : "border-rule-strong bg-paper-raised text-ink hover:border-ink")
      }
    >
      {children}
    </Link>
  );
}

async function PeopleLeaderboard({ city }: { city: string | null }) {
  const db = supabaseAnon();

  let query = db
    .from("observations")
    .select(
      "id, waterbody_id, observed_at, observer_id, quality_weight, validation_status, is_synthetic, observers(display_name, trust_score, is_synthetic), waterbodies!inner(city)",
    );

  if (city) {
    query = query.eq("waterbodies.city", city);
  }

  const { data, error } = await query;
  const rows = error ? [] : (data ?? []);

  const observerInfo = new Map<string, ObserverInfo>();
  const contributionRows: ContributionRow[] = rows.map((o) => {
    const observerEmbed = firstOrSelf<{
      display_name: string;
      trust_score: number | string | null;
      is_synthetic: boolean;
    }>(o.observers);

    if (o.observer_id && observerEmbed) {
      observerInfo.set(o.observer_id, {
        displayName: observerEmbed.display_name,
        isSynthetic: Boolean(observerEmbed.is_synthetic),
      });
    }
    return {
      observerId: o.observer_id,
      waterbodyId: o.waterbody_id,
      observedAt: o.observed_at,
      qualityWeight: Number(o.quality_weight),
      observerTrust: embeddedTrustScore(o.observers) ?? null,
      validationStatus: o.validation_status,
      isSynthetic: Boolean(o.is_synthetic),
      waterbodyCity: embeddedCity(o.waterbodies),
    };
  });

  const ranked = contributions(contributionRows)
    .sort((a, b) => b.points - a.points)
    .slice(0, TOP_N);

  const hasSynthetic = ranked.some(
    (r) => observerInfo.get(r.observerId)?.isSynthetic,
  );

  return (
    <div className="space-y-6">
      <nav aria-label="Cities" className="flex flex-wrap gap-2">
        <CityChip href="/leaderboard" active={!city}>
          All cities
        </CityChip>
        {CITIES.map((name) => (
          <CityChip
            key={name}
            href={`/leaderboard?city=${name}`}
            active={name === city}
          >
            {name}
          </CityChip>
        ))}
      </nav>

      {ranked.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No validated observations yet{city ? ` in ${city}` : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-left">
                <th scope="col" className="field-label px-2 py-2">
                  Rank
                </th>
                <th scope="col" className="field-label px-2 py-2">
                  Observer
                </th>
                <th scope="col" className="field-label px-2 py-2 text-right">
                  Points
                </th>
                <th scope="col" className="field-label px-2 py-2 text-right">
                  Validated
                </th>
                <th scope="col" className="field-label px-2 py-2 text-right">
                  Streams
                </th>
                <th scope="col" className="field-label px-2 py-2 text-right">
                  Gaps filled
                </th>
                <th scope="col" className="field-label px-2 py-2 text-right">
                  Trust
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r, i) => {
                const info = observerInfo.get(r.observerId);
                return (
                  <tr
                    key={r.observerId}
                    data-observer-id={r.observerId}
                    className="border-b border-rule"
                  >
                    <td className="num px-2 py-2">{i + 1}</td>
                    <td className="px-2 py-2">
                      {info?.displayName ?? "Unknown observer"}
                      {info?.isSynthetic && (
                        <span className="field-label ml-2 text-ink-muted">
                          Demo
                        </span>
                      )}
                    </td>
                    <td className="num px-2 py-2 text-right">{r.points}</td>
                    <td className="num px-2 py-2 text-right">
                      {r.countedObservations}
                    </td>
                    <td className="num px-2 py-2 text-right">{r.streamsCovered}</td>
                    <td className="num px-2 py-2 text-right">{r.gapsFilled}</td>
                    <td className="num px-2 py-2 text-right">
                      {Math.round(r.trust * 100)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasSynthetic && (
        <p className="text-sm text-ink-muted">
          Includes demo observers while the pilot collects real data.
        </p>
      )}

      <OwnRowHighlighter />
    </div>
  );
}

async function CitiesLeaderboard() {
  const db = supabaseAnon();

  const { data: waterbodies, error: waterbodiesError } = await db
    .from("waterbodies")
    .select("id, city")
    .in("city", CITIES);

  const { data: observations, error: observationsError } = await db
    .from("observations")
    .select(
      "id, waterbody_id, observed_at, observer_id, survey, quality_weight, observers(trust_score), waterbodies!inner(city)",
    )
    .in("waterbodies.city", CITIES);

  const waterbodyRows = waterbodiesError ? [] : (waterbodies ?? []);
  const observationRows = observationsError ? [] : (observations ?? []);

  const byWaterbody = new Map<string, StoredObservation[]>();
  const activeObserversByCity = new Map<string, Set<string>>();
  const cutoff = Date.now() - ACTIVE_OBSERVER_WINDOW_DAYS * 24 * 3_600_000;

  for (const o of observationRows) {
    const list = byWaterbody.get(o.waterbody_id) ?? [];
    list.push({
      id: o.id,
      observedAt: o.observed_at,
      observerId: o.observer_id,
      survey: o.survey,
      qualityWeight: Number(o.quality_weight),
      observerTrust: embeddedTrustScore(o.observers),
    });
    byWaterbody.set(o.waterbody_id, list);

    const cityName = embeddedCity(o.waterbodies);
    if (cityName && o.observer_id && new Date(o.observed_at).getTime() >= cutoff) {
      const set = activeObserversByCity.get(cityName) ?? new Set<string>();
      set.add(o.observer_id);
      activeObserversByCity.set(cityName, set);
    }
  }

  const stats = CITIES.map((cityName) => {
    const bodies = waterbodyRows.filter((w) => w.city === cityName);
    const assessed = bodies.filter(
      (w) => computeSnapshot(byWaterbody.get(w.id) ?? []).assessment.klass !== null,
    );
    const coverage = bodies.length > 0 ? assessed.length / bodies.length : 0;
    return {
      city: cityName,
      totalWaterbodies: bodies.length,
      assessedWaterbodies: assessed.length,
      coverage,
      activeObservers: activeObserversByCity.get(cityName)?.size ?? 0,
    };
  }).sort((a, b) => b.coverage - a.coverage || b.activeObservers - a.activeObservers);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule-strong text-left">
            <th scope="col" className="field-label px-2 py-2">
              Rank
            </th>
            <th scope="col" className="field-label px-2 py-2">
              City
            </th>
            <th scope="col" className="field-label px-2 py-2 text-right">
              Coverage
            </th>
            <th scope="col" className="field-label px-2 py-2 text-right">
              Active observers (30d)
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={s.city} className="border-b border-rule">
              <td className="num px-2 py-2">{i + 1}</td>
              <td className="px-2 py-2">{s.city}</td>
              <td className="num px-2 py-2 text-right">
                {Math.round(s.coverage * 100)}%{" "}
                <span className="text-ink-muted">
                  ({s.assessedWaterbodies}/{s.totalWaterbodies})
                </span>
              </td>
              <td className="num px-2 py-2 text-right">{s.activeObservers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const searchParams = await props.searchParams;
  const viewParam = searchParams.view;
  const view = (Array.isArray(viewParam) ? viewParam[0] : viewParam) === "cities"
    ? "cities"
    : "people";

  const cityParam = searchParams.city;
  const requestedCity = Array.isArray(cityParam) ? cityParam[0] : cityParam;
  const city = requestedCity && CITIES.includes(requestedCity) ? requestedCity : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <header>
        <p className="field-label m-0">Recognition</p>
        <h1 className="mt-2 mb-3 text-4xl">Leaderboard</h1>
        <p className="m-0 max-w-2xl text-sm text-ink-muted">
          Points come from validated, trust-weighted observations. Repeating
          the same stream on the same day earns nothing extra; filling a data
          gap earns a bonus.
        </p>
      </header>

      <nav aria-label="Leaderboard view" className="flex gap-6 border-b border-rule">
        <Tab href="/leaderboard" active={view === "people"}>
          People
        </Tab>
        <Tab href="/leaderboard?view=cities" active={view === "cities"}>
          Cities
        </Tab>
      </nav>

      {view === "cities" ? (
        <CitiesLeaderboard />
      ) : (
        <PeopleLeaderboard city={city} />
      )}
    </div>
  );
}
