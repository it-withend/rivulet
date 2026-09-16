import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ForelUleRibbon } from "@/components/ui/ForelUleRibbon";
import { CommunityCounters } from "@/components/community/CommunityCounters";

/** The landing hero's texture; a faint topographic reading of a stream valley. */
function contourPaths(): string[] {
  const paths: string[] = [];
  const cx = 820;
  const cy = 250;
  for (let ring = 1; ring <= 14; ring++) {
    const r = ring * 46;
    const points: string[] = [];
    for (let step = 0; step <= 72; step++) {
      const t = (step / 72) * Math.PI * 2;
      const wobble =
        1 +
        0.09 * Math.sin(3 * t + ring * 0.35) +
        0.05 * Math.cos(5 * t - ring * 0.2) +
        0.03 * Math.sin(8 * t + ring);
      const x = cx + Math.cos(t) * r * 1.35 * wobble;
      const y = cy + Math.sin(t) * r * 0.8 * wobble;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    paths.push(`M${points.join("L")}Z`);
  }
  return paths;
}

const SCIENCE_POINTS = [
  "Forel–Ule water colour scale, estimated on the phone with a simplified WACODI-style colour conversion (no camera calibration)",
  "Five indicative status classes named after the EU Water Framework Directive — not an official WFD assessment",
  "Macroinvertebrate sensitivity set on the BMWP 1–10 family scale — a simplified proxy, not the BMWP protocol",
  "Beta–Bernoulli conjugate updating with 90% credible intervals",
  "FHIR resources declaring HL7 Europe OneAquaHealth profiles — not yet validated against the guide",
];

const STEPS = [
  {
    title: "You photograph the water.",
    body: "We derive a Forel–Ule colour index from the image — a scale in scientific use since the 1890s.",
  },
  {
    title: "We weigh the evidence.",
    body: "Observations are combined in a Bayesian model that reports a range, not a falsely precise number.",
  },
  {
    title: "The city gets an answer.",
    body: "Results are shown as indicative status classes with an honest range, and exported as FHIR shaped on the OneAquaHealth implementation guide.",
  },
];

export default function Home() {
  return (
    <div>
      <section className="relative isolate overflow-hidden border-b border-rule">
        <svg
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full"
          viewBox="0 0 1000 500"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          {contourPaths().map((d, i) => (
            <path
              key={d}
              d={d}
              stroke="var(--color-rule-strong)"
              strokeOpacity={i % 5 === 4 ? 0.55 : 0.3}
              strokeWidth={i % 5 === 4 ? 1.2 : 0.8}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
          <p className="field-label m-0">Citizen science · urban freshwater</p>
          <h1 className="m-0 mt-3 max-w-3xl font-display text-4xl font-medium leading-[1.05] italic sm:text-6xl">
            The stream at the end of your street has a health record.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-muted">
            Rivulet turns what residents notice about urban water into
            scientifically grounded assessments — with the uncertainty stated
            honestly, and every number traceable to a published method.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href="/map">See the map</Button>
            <Button variant="secondary" href="/observe">
              Record an observation
            </Button>
          </div>
          <div className="mt-12 max-w-2xl">
            <ForelUleRibbon />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-16 sm:px-6">
        <CommunityCounters />

        <section className="border-t border-rule pt-10">
          <p className="field-label m-0">The problem</p>
          <h2 className="mt-2 mb-4 max-w-xl text-3xl">
            Nobody can say how much to trust what residents see.
          </h2>
          <p className="m-0 max-w-xl text-ink-muted">
            Official monitoring of urban streams is sparse in both space and
            time. Residents see these waters every day, but what they notice
            rarely reaches anyone who can act on it — and when it does, nobody
            can say how much to trust it.
          </p>
        </section>

        <section className="border-t border-rule pt-10">
          <p className="field-label m-0">Method</p>
          <h2 className="mt-2 mb-8 text-3xl">How it works</h2>
          <ol className="m-0 grid list-none gap-8 p-0 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="max-w-xs">
                <p className="num m-0 text-sm text-ink-muted">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 mb-2 text-xl">{step.title}</h3>
                <p className="m-0 text-sm text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-rule pt-10">
          <p className="field-label m-0">Rigour</p>
          <h2 className="mt-2 mb-6 text-3xl">
            There is real science behind this
          </h2>
          <Panel>
            <ul className="m-0 list-disc space-y-1 pl-5 text-sm">
              {SCIENCE_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p className="mt-4 mb-0 text-sm text-ink-muted">
              These are proxy estimates from citizen observations, not
              laboratory measurements. We say so everywhere the numbers
              appear.
            </p>
          </Panel>
        </section>

        <section className="border-t border-rule pt-10">
          <p className="field-label m-0">Standards</p>
          <h2 className="mt-2 mb-4 text-3xl">Open by construction</h2>
          <p className="m-0 max-w-xl text-ink-muted">
            Every assessment is exportable as FHIR declaring the
            consortium&rsquo;s own implementation guide profiles, so this data
            can flow into the systems that already exist rather than sitting in
            another silo. Signs residents report travel under a separate,
            clearly labelled Rivulet code system rather than borrowing
            laboratory codes.
          </p>
          <Button variant="secondary" href="/open-data" className="mt-5">
            See the open data
          </Button>
        </section>
      </div>
    </div>
  );
}
