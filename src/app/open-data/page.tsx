import { Panel } from "@/components/ui/Panel";

export const metadata = {
  title: "Open data — Rivulet",
};

export default function OpenDataPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6">
      <header>
        <p className="field-label m-0">Interoperability</p>
        <h1 className="mt-2 mb-3 text-4xl">Open data</h1>
        <p className="m-0 max-w-xl text-ink-muted">
          Every assessment Rivulet produces is exportable, so this data can flow
          into the systems that already exist rather than sitting in another
          silo.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl">FHIR export</h2>
        <p className="m-0 max-w-xl">
          Observations are served as a FHIR <code>Bundle</code> whose resources
          declare the OneAquaHealth Implementation Guide profiles.
        </p>
        <Panel tone="ink">
          <p className="num m-0 text-sm">
            GET /api/fhir/Observation?waterbody=&lt;id&gt;
          </p>
        </Panel>
        <p className="m-0 max-w-xl text-sm text-ink-muted">
          Seeded demonstration observations are included so the export shows
          real output end to end, but are tagged{" "}
          <code>meta.tag</code> with the HL7 <code>HTEST</code> (&ldquo;test
          health data&rdquo;) code, so a downstream system can filter them out
          of genuine citizen data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Satellite cross-check</h2>
        <p className="m-0 max-w-xl">
          Satellite readings are derived from Copernicus Sentinel-2 data
          (Contains modified Copernicus Sentinel data 2026), processed by
          Rivulet as an independent, coarse cross-check against citizen
          reports — never a replacement for them.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Code systems</h2>
        <p className="m-0 max-w-xl">
          Indicators use the OneAquaHealth code system wherever a code exists.
          Concepts the guide does not yet cover — the Forel–Ule index, the
          classified WFD outcome, and our data confidence measure — use a
          clearly separated Rivulet extension system so the boundary between
          adopted and derived vocabulary stays auditable.
        </p>
      </section>
    </div>
  );
}
