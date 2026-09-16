import { Panel } from "@/components/ui/Panel";
import { Dog, Fish, HeartPulse, Users } from "lucide-react";
import { ONE_HEALTH_PARAMETERS, type OneHealthReading } from "@/lib/science/one-health";
import {
  AUDIENCE_LABEL,
  CONCERN_COLOUR,
  CONCERN_LABEL,
  EXPOSURE_LABEL,
  HAZARD_LABEL,
} from "@/lib/ui/one-health-copy";

const percent = (value: number) => `${Math.round(value * 100)}%`;
const AUDIENCE_ICON = { people: Users, dogs: Dog, wildlife: Fish } as const;

export function OneHealthPanel({ reading }: { reading: OneHealthReading }) {
  const p = ONE_HEALTH_PARAMETERS;
  const signs = reading.hazards.filter((h) => h.level !== "none");

  return (
    <section aria-labelledby="one-health-heading" className="space-y-4">
      <header>
        <p className="field-label m-0">One Health</p>
        <h2 id="one-health-heading" className="mt-2 mb-2 flex items-center gap-2 text-2xl">
          <HeartPulse aria-hidden="true" className="size-6 text-river" />
          Is it safe for people and animals nearby?
        </h2>
        <p className="m-0 max-w-xl text-sm text-ink-muted">
          {reading.recentReports === 0
            ? `Nobody has reported on this water in the last ${p.windowDays} days, so we cannot say whether it is safe to touch. No news is not good news.`
            : signs.length === 0
              ? `${reading.recentReports} report${reading.recentReports === 1 ? "" : "s"} in the last ${p.windowDays} days, with no warning signs.`
              : `In the last ${p.windowDays} days, residents reported ${signs
                  .map((h) => `${HAZARD_LABEL[h.code]} (${percent(h.share)} of ${reading.recentReports} reports, ${h.observers} ${h.observers === 1 ? "person" : "people"})`)
                  .join(", ")}.`}
        </p>
      </header>

      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
        {reading.audiences.map((a) => (
          <li key={a.audience}>
            <Panel className="h-full p-4 sm:p-5">
              <p className="field-label m-0 flex items-center gap-1.5">
                {(() => {
                  const Icon = AUDIENCE_ICON[a.audience];
                  return <Icon aria-hidden="true" className="size-4" />;
                })()}
                {AUDIENCE_LABEL[a.audience]}
              </p>
              <p className="mt-2 mb-0 flex items-start gap-2 text-base font-medium">
                <span
                  aria-hidden="true"
                  className={
                    "mt-1 size-3.5 shrink-0 rounded-full border border-rule " +
                    (a.concern === "unknown" ? "hatch-insufficient" : "")
                  }
                  style={
                    a.concern === "unknown"
                      ? undefined
                      : { backgroundColor: CONCERN_COLOUR[a.concern] }
                  }
                />
                {CONCERN_LABEL[a.concern]}
              </p>

              {a.audience === "wildlife" ? (
                <p className="mt-2 mb-0 text-sm text-ink-muted">
                  The stream itself is their home.
                </p>
              ) : a.nearby.length > 0 ? (
                <p className="mt-2 mb-0 text-sm text-ink-muted">
                  Nearby:{" "}
                  {a.nearby
                    .slice(0, 3)
                    .map(
                      (e) =>
                        `${EXPOSURE_LABEL[e.kind]}${e.nearestName ? ` (${e.nearestName})` : ""} ${Math.round(e.nearestM)} m`,
                    )
                    .join(" · ")}
                </p>
              ) : (
                <p className="mt-2 mb-0 text-sm text-ink-muted">
                  No mapped places that bring {a.audience === "dogs" ? "dogs" : "people"} to
                  the water within {p.exposureRadiusM} m.
                </p>
              )}

              {a.advice.length > 0 && (
                <ul className="mt-3 mb-0 space-y-1 pl-4 text-sm">
                  {a.advice.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </Panel>
          </li>
        ))}
      </ul>

      <details className="text-sm text-ink-muted">
        <summary className="cursor-pointer">How we work this out</summary>
        <div className="mt-2 max-w-xl space-y-2">
          <p className="m-0">
            Concern combines <strong>hazard</strong> — warning signs in
            residents&apos; reports from the last {p.windowDays} days, weighted
            by each observer&apos;s trust and each report&apos;s quality — with{" "}
            <strong>exposure</strong>: playgrounds, schools, parks, bathing and
            fishing spots and allotments from OpenStreetMap within{" "}
            {p.exposureRadiusM} m. A sign is possible from{" "}
            {percent(p.possibleShare)} of reports and likely from{" "}
            {percent(p.likelyShare)} reported by at least{" "}
            {p.likelyMinObservers} different people. All of these thresholds are
            uncalibrated priors.
          </p>
          <p className="m-0">
            This is an early prompt to take care, based on what people can see
            and smell. It is not a medical or public health assessment and not
            an official bathing-water classification — follow your local
            health and environment authorities.
          </p>
        </div>
      </details>
    </section>
  );
}
