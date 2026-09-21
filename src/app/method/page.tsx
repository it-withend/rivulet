import Link from "next/link";
import { Bot, Calculator, HeartPulse, Palette, Satellite, ScanEye, ShieldCheck, Users } from "lucide-react";
import type React from "react";
import { METHOD_PARAMETERS, type MethodParameter } from "@/lib/science/method-parameters";
import { METHOD_VERSION } from "@/lib/science/method-version";

export const metadata = {
  title: "Method — Rivulet",
  description:
    "How Rivulet turns resident observations into an uncertainty-aware stream status: every step, every constant, and what it does not claim.",
};

const STEPS: { icon: React.ReactNode; title: string; body: string; code: string }[] = [
  {
    icon: <Palette />,
    title: "1. Read the colour",
    body: "The phone photo is reduced on the device to a water colour on the 21-step Forel–Ule scale, using a simplified WACODI-style conversion (sRGB to CIE XYZ to hue angle). The full photo never leaves the phone: only the class, a confidence and, for the optional photo check, a tiny thumbnail are sent. There is no per-camera calibration, so colour is a proxy, not a measurement.",
    code: "src/lib/science/forel-ule.ts, extract-colour.ts",
  },
  {
    icon: <ScanEye />,
    title: "2. Turn what people see into evidence",
    body: "Smell, foam, algae, dead fish, clarity, flow, litter and recognisable animal groups each add a small, declared amount of evidence for or against good condition. Animal groups use sensitivity values on the BMWP 1–10 family scale as a simplified proxy, not the BMWP protocol.",
    code: "src/lib/science/indicators.ts",
  },
  {
    icon: <ShieldCheck />,
    title: "3. Check before counting",
    body: "GPS accuracy, distance from the mapped stream, an hourly limit per observer and an optional AI check that the photo shows water are evaluated independently. Anything doubtful is stored but held out of assessments, trust and exports until a person approves or rejects it.",
    code: "src/lib/science/plausibility.ts, src/lib/moderation/",
  },
  {
    icon: <Users />,
    title: "4. Weigh the observer",
    body: "Each observer's trust is how well they agree with other people's reports of the same streams (leave-one-out, so nobody is judged against themselves), shrunk toward neutral when there is little history. Trust multiplies the weight of their evidence. Agreement is not truth: observers who agree can all be wrong.",
    code: "src/lib/science/trust.ts, weighting.ts",
  },
  {
    icon: <Calculator />,
    title: "5. Estimate with uncertainty",
    body: "Weighted evidence updates a Beta–Bernoulli posterior. Rivulet reports its mean, a 90% credible interval and a data-confidence figure. Below a minimum confidence it says \"insufficient data\" instead of guessing. Five status classes carry the names of the EU Water Framework Directive, but their limits are equal-width priors, so this is not an official classification.",
    code: "src/lib/science/bayes.ts, wfd.ts, snapshot.ts",
  },
  {
    icon: <HeartPulse />,
    title: "6. Read it for people and animals",
    body: "Hazard is the trust-weighted share of recent reports showing a warning sign. Exposure is what OpenStreetMap places within 150 m: playgrounds, schools, parks, dog areas, bathing and fishing spots. A hazard near a place people or dogs use raises the concern. No recent reports reads as unknown, never as safe.",
    code: "src/lib/science/one-health.ts",
  },
  {
    icon: <Satellite />,
    title: "7. Cross-check from space",
    body: "A Sentinel-2 hue angle for the stream is compared with the residents' colour. Most urban streams are narrower than a 10 m pixel, so most get no clear satellite view. If the two disagree beyond a declared threshold, every contributing weight is halved: the estimate widens and confidence cannot rise because of that pass. The reflectance conversion is a placeholder, not the published Sentinel-2 calibration.",
    code: "src/lib/science/satellite.ts, scripts/satellite/",
  },
];

const GROUP_TITLE: Record<string, string> = {
  "forel-ule": "Water colour scale",
  colour: "Colour conversion",
  evidence: "Evidence from the survey",
  weighting: "Observation weighting",
  bayes: "Bayesian estimate",
  wfd: "Status classes",
  trust: "Observer trust",
  plausibility: "Plausibility checks",
  "one-health": "One Health reading",
  contribution: "Points",
  certificate: "Certificates",
  satellite: "Satellite cross-check",
  bmwp: "Animal-group sensitivity",
};

function formatValue(value: MethodParameter["value"]): string {
  if (typeof value === "number") return String(value);
  const text = value.map((v) => (Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/0+$/, ""))).join(", ");
  return text.length > 90 ? `${value.length} values` : text;
}

export default function MethodPage() {
  const groups = new Map<string, MethodParameter[]>();
  for (const parameter of METHOD_PARAMETERS) {
    const key = parameter.id.split(".")[0];
    groups.set(key, [...(groups.get(key) ?? []), parameter]);
  }
  const standards = METHOD_PARAMETERS.filter((p) => p.kind === "standard").length;
  const priors = METHOD_PARAMETERS.length - standards;

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <p className="field-label m-0">Method</p>
        <h1 className="m-0 text-4xl">How Rivulet gets from a photo to a status</h1>
        <p className="m-0 max-w-2xl text-ink-muted">
          Rivulet is a trust and quality layer for citizen observations. This page states every step, every constant
          and what the result does not mean, so a scientist can disagree with it precisely. Method version{" "}
          <span className="num">{METHOD_VERSION.version}</span>, published {METHOD_VERSION.publishedAt}.
        </p>
        <p className="m-0 flex items-center gap-2 text-sm text-ink-muted">
          <Bot aria-hidden="true" className="size-4 shrink-0" />
          Rules, not a black box: no learned model decides a status. The one AI component only flags a photo for a
          person to look at.
        </p>
      </header>

      <section aria-labelledby="pipeline" className="space-y-4">
        <h2 id="pipeline" className="m-0 text-2xl">The pipeline</h2>
        <ol className="m-0 grid list-none gap-3 p-0">
          {STEPS.map((step) => (
            <li key={step.title} className="rounded-md border border-rule bg-paper-raised p-4">
              <p className="m-0 flex items-center gap-2 font-medium">
                <span aria-hidden="true" className="text-river [&_svg]:size-5">{step.icon}</span>
                {step.title}
              </p>
              <p className="m-0 mt-2 text-[0.9375rem] text-ink">{step.body}</p>
              <p className="num m-0 mt-2 text-xs text-ink-muted">{step.code}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="constants" className="space-y-4">
        <h2 id="constants" className="m-0 text-2xl">Every constant, declared</h2>
        <p className="m-0 max-w-2xl text-ink-muted">
          <span className="num">{METHOD_PARAMETERS.length}</span> parameters:{" "}
          <span className="num">{standards}</span> come from a cited standard or publication and{" "}
          <span className="num">{priors}</span> are expert-judgement priors that say, in their own row, that they are
          uncalibrated and why they were chosen. Nothing is an unlabelled magic number. The list below is generated from
          the code&apos;s own registry, so it cannot drift from what runs.
        </p>
        <div className="space-y-2">
          {[...groups.entries()].map(([key, list]) => (
            <details key={key} className="rounded-md border border-rule bg-paper-raised">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-[0.9375rem] font-medium">
                <span>{GROUP_TITLE[key] ?? key}</span>
                <span className="num text-xs text-ink-muted">{list.length}</span>
              </summary>
              <ul className="m-0 list-none divide-y divide-rule border-t border-rule p-0">
                {list.map((p) => (
                  <li key={p.id} className="space-y-1 px-4 py-3 text-sm">
                    <p className="m-0 flex flex-wrap items-baseline gap-x-3">
                      <span className="num font-medium">{p.id}</span>
                      <span className="num text-ink-muted">{formatValue(p.value)}</span>
                      <span
                        className={
                          "field-label rounded-sm border px-1.5 py-0.5 " +
                          (p.kind === "standard" ? "border-river text-river" : "border-rule-strong text-ink-muted")
                        }
                      >
                        {p.kind === "standard" ? "Standard" : "Prior"}
                      </span>
                    </p>
                    <p className="m-0 text-ink-muted">{p.kind === "standard" ? p.source : p.rationale}</p>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="limits" className="space-y-3">
        <h2 id="limits" className="m-0 text-2xl">What it does not claim</h2>
        <ul className="m-0 space-y-2 pl-5 text-[0.9375rem]">
          <li>It is not a laboratory, regulatory or public-health assessment, and never says water is safe.</li>
          <li>The class names come from Directive 2000/60/EC Annex V; the class limits are not calibrated EQR boundaries.</li>
          <li>Colour comes from an uncalibrated phone camera and says nothing about chemistry.</li>
          <li>Trust is peer agreement, not truth, and the model still needs validating against independent measurements.</li>
          <li>The satellite check is coarse and its reflectance conversion is a declared placeholder.</li>
          <li>Rivulet&apos;s survey is a quick visual complement to, not a substitute for, the professional{" "}
            <a href="https://zenodo.org/records/20344421" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-river">
              OneAquaHealth field sampling protocols
            </a>{" "}
            (macroinvertebrates, water chemistry, habitat and more).
          </li>
        </ul>
      </section>

      <section aria-labelledby="history" className="space-y-3">
        <h2 id="history" className="m-0 text-2xl">Version history</h2>
        <ul className="m-0 space-y-3 pl-5 text-sm text-ink-muted">
          {METHOD_VERSION.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sources" className="space-y-3">
        <h2 id="sources" className="m-0 text-2xl">Sources</h2>
        <ul className="m-0 space-y-2 pl-5 text-sm text-ink-muted">
          {METHOD_VERSION.citations.map((citation) => (
            <li key={citation}>{citation}</li>
          ))}
        </ul>
        <p className="m-0 text-sm">
          The code is open under Apache-2.0 and its tests are in{" "}
          <a href="https://github.com/it-withend/rivulet/tree/main/src/lib/science" className="underline underline-offset-2 hover:text-river">
            src/lib/science
          </a>
          . Data leaves Rivulet as FHIR from the <Link href="/open-data" className="underline underline-offset-2 hover:text-river">open data page</Link>.
        </p>
      </section>
    </div>
  );
}
