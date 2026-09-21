import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { CITIES } from "@/lib/cities";

export const metadata = {
  title: "Open data — Rivulet",
  description:
    "Rivulet's data as FHIR R4 profiled to the OneAquaHealth Implementation Guide: endpoints, resource model, codes, validation, privacy and limits.",
};

// A real water body with reports, so every example link below returns data.
const EXAMPLE = "303820be-c065-4dea-ad28-17c4287e3826";
const REPORT_URL = "https://github.com/it-withend/rivulet/tree/fhir-validation-report";

const ENDPOINTS: { method: string; path: string; what: string; example?: string }[] = [
  { method: "GET", path: "/fhir/metadata", what: "CapabilityStatement: exactly what this endpoint supports", example: "/fhir/metadata" },
  { method: "GET", path: "/fhir/Location?city=<city>", what: "Water bodies Rivulet has mapped in a city (paged with _count and _offset)", example: "/fhir/Location?city=Coimbra&_count=5" },
  { method: "GET", path: "/fhir/Location/<id>", what: "One water body as a LocationOah", example: `/fhir/Location/${EXAMPLE}` },
  { method: "GET", path: "/fhir/Observation?subject=Location/<id>", what: "Citizen indicator Observations (ObservationIndicatorsOah) for a water body", example: `/fhir/Observation?subject=Location/${EXAMPLE}` },
  { method: "GET", path: "/fhir/DetectedIssue?implicated=Location/<id>", what: "The One Health warning for a water body, with the reports that evidence it", example: `/fhir/DetectedIssue?implicated=Location/${EXAMPLE}` },
  { method: "GET", path: "/api/fhir/Observation?waterbody=<id>", what: "The complete export for one water body in a single Bundle: Location, Observations, Provenance and any DetectedIssue", example: `/api/fhir/Observation?waterbody=${EXAMPLE}` },
];

const MODEL: { concept: string; resource: string; profile: string }[] = [
  { concept: "A stream section", resource: "Location", profile: "LocationOah (identifier, name, mode = instance, position)" },
  { concept: "One thing a resident reported", resource: "Observation", profile: "ObservationIndicatorsOah; measured values use OneAquaHealth codes and UCUM units" },
  { concept: "Who reported it and what assembled it", resource: "Provenance", profile: "Core R4: author (a pseudonymous observer) and assembler (the Rivulet web app)" },
  { concept: "A warning worth acting on near people or animals", resource: "DetectedIssue", profile: "Core R4: severity, the Location, and the Observations that evidence it" },
  { concept: "The classified outcome", resource: "Observation", profile: "Rivulet code wfd-ecological-status, valued high to bad; indicative, not an official classification" },
];

export default function OpenDataPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-12 sm:px-6">
      <header className="space-y-3">
        <p className="field-label m-0">Interoperability</p>
        <h1 className="m-0 text-4xl">Open data</h1>
        <p className="m-0 max-w-2xl text-ink-muted">
          Every assessment Rivulet produces can leave it as FHIR R4, profiled to the{" "}
          <a href="https://github.com/hl7-eu/oah" className="underline underline-offset-2 hover:text-river">OneAquaHealth Implementation Guide</a>
          , so it can flow into the systems that already exist instead of sitting in another silo. No account or key is needed to read it.
        </p>
        <p className="m-0 max-w-2xl text-sm text-ink-muted">
          How the numbers are produced is on the <Link href="/method" className="underline underline-offset-2 hover:text-river">method page</Link>.
        </p>
      </header>

      <section aria-labelledby="endpoints" className="space-y-3">
        <h2 id="endpoints" className="m-0 text-2xl">Read-only FHIR endpoint</h2>
        <p className="m-0 max-w-2xl">
          Base URL <code>https://rivulet-xi.vercel.app/fhir</code>. Everything is read-only. Try the examples: each link
          returns real data for one Coimbra stream.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-left">
                <th scope="col" className="field-label px-2 py-2">Request</th>
                <th scope="col" className="field-label px-2 py-2">Returns</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.path} className="border-b border-rule align-top">
                  <td className="px-2 py-2">
                    <p className="num m-0 break-all">{e.method} {e.path}</p>
                    {e.example && (
                      <a href={e.example} className="num text-xs underline underline-offset-2 hover:text-river">try it</a>
                    )}
                  </td>
                  <td className="px-2 py-2 text-ink-muted">{e.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 text-sm text-ink-muted">
          Cities: {CITIES.map((city, i) => (
            <span key={city}>
              {i > 0 && ", "}
              <a href={`/fhir/Location?city=${city}&_count=5`} className="underline underline-offset-2 hover:text-river">{city}</a>
            </span>
          ))}
          .
        </p>
      </section>

      <section aria-labelledby="model" className="space-y-3">
        <h2 id="model" className="m-0 text-2xl">Resource model</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-left">
                <th scope="col" className="field-label px-2 py-2">Concept</th>
                <th scope="col" className="field-label px-2 py-2">Resource</th>
                <th scope="col" className="field-label px-2 py-2">Profile and notes</th>
              </tr>
            </thead>
            <tbody>
              {MODEL.map((m) => (
                <tr key={m.concept} className="border-b border-rule align-top">
                  <td className="px-2 py-2">{m.concept}</td>
                  <td className="num px-2 py-2">{m.resource}</td>
                  <td className="px-2 py-2 text-ink-muted">{m.profile}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="codes" className="space-y-3">
        <h2 id="codes" className="m-0 text-2xl">Code systems</h2>
        <p className="m-0 max-w-2xl">
          Real measurements (pH, dissolved oxygen, water temperature, nitrate) use the OneAquaHealth code system, with UCUM
          units. What a resident sees but cannot measure (clarity, a sewage smell, algae, foam, dead fish, litter) is never
          passed off as a laboratory analyte such as coliforms or suspended solids. It uses a clearly separated Rivulet code
          system, together with the Forel–Ule index, the indicative status class and the One Health concern, so the boundary
          between adopted and derived vocabulary stays auditable.
        </p>
        <p className="m-0 text-sm">
          <a href="/fhir/CodeSystem/rivulet-derived" className="num underline underline-offset-2 hover:text-river">/fhir/CodeSystem/rivulet-derived</a>
          <span className="text-ink-muted"> lists every code Rivulet adds and says what it is and is not.</span>
        </p>
      </section>

      <section aria-labelledby="validation" className="space-y-3">
        <h2 id="validation" className="m-0 text-2xl">Validation</h2>
        <p className="m-0 max-w-2xl">
          On every change, a workflow builds the OneAquaHealth guide from source and runs the official HL7 validator over
          Rivulet&rsquo;s own output: a sample export, the endpoint&rsquo;s search results, its CapabilityStatement and its
          CodeSystem. The current result is <strong>0 errors</strong>; the warnings are a best-practice recommendation (resources
          should carry a narrative) and UCUM codes an offline validator cannot look up.
        </p>
        <Panel tone="ink">
          <p className="m-0 text-sm">
            <a href={REPORT_URL} className="underline underline-offset-2">Full validator log and the exact resources checked</a>
          </p>
        </Panel>
        <p className="m-0 max-w-2xl text-sm text-ink-muted">
          What this shows: a representative sample passes, offline. What it does not: it is not a conformance claim by the
          guide&rsquo;s authors, it does not check every row in the live database, and external terminologies (UCUM, SNOMED)
          are not looked up.
        </p>
      </section>

      <section aria-labelledby="quality" className="space-y-3">
        <h2 id="quality" className="m-0 text-2xl">What is in the data, and what is not</h2>
        <ul className="m-0 space-y-2 pl-5 text-[0.9375rem]">
          <li>
            <strong>Held observations stay out.</strong> Reports that fail plausibility checks wait for a person to review
            them and are never served until approved.
          </li>
          <li>
            <strong>Demonstration data is labelled.</strong> Seeded observations carry <code>meta.tag</code>{" "}
            <code>HTEST</code> (&ldquo;test health data&rdquo;), the standard HL7 code, so a downstream system can filter
            them out of genuine citizen data. Coimbra&rsquo;s reports are of this kind.
          </li>
          <li>
            <strong>Privacy.</strong> An observer is a pseudonym. Exact GPS positions and GPS accuracy of individual reports
            are never exported; a stream is located by its mapped path. Photos are not stored or exported.
          </li>
          <li>
            <strong>Indicative, not authoritative.</strong> Status classes and concerns are estimates from what residents
            can see and smell, not laboratory or public-health assessments.
          </li>
        </ul>
      </section>

      <section aria-labelledby="sources" className="space-y-3">
        <h2 id="sources" className="m-0 text-2xl">Sources and attribution</h2>
        <ul className="m-0 space-y-2 pl-5 text-[0.9375rem]">
          <li>
            Stream geometry and nearby places: © OpenStreetMap contributors, available under the{" "}
            <a href="https://www.openstreetmap.org/copyright" className="underline underline-offset-2 hover:text-river">Open Database Licence</a>.
          </li>
          <li>
            Satellite cross-check: contains modified Copernicus Sentinel data 2026, processed by Rivulet as an
            independent, coarse check against citizen reports, never a replacement for them.
          </li>
          <li>
            Standards: HL7 FHIR R4 and the OneAquaHealth Implementation Guide by HL7 Europe. Rivulet is an independent
            prototype and is not endorsed by the OneAquaHealth consortium, the EU or IEEE.
          </li>
          <li>
            Code: open under Apache-2.0 at{" "}
            <a href="https://github.com/it-withend/rivulet" className="underline underline-offset-2 hover:text-river">github.com/it-withend/rivulet</a>.
          </li>
        </ul>
      </section>
    </div>
  );
}
