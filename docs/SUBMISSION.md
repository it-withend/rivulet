# Devpost submission text

Copy-ready text for the OneAquaHealth IEEE Global Hackathon 2026 submission. Every claim here is checked against the
repository; anything not done is in "Limitations".

## Track alignment statement

**Primary: Track 2, Data-to-Insight.** Rivulet turns citizen stream observations into interpretable, decision-ready
insight: an uncertainty-aware status for each stream, a One Health reading of who and what is exposed, a city report that
says where to take care and where a visit would help most, and trends over time.

**Also addresses** Track 5 (Community & Gamification): a private journal with badges, a leaderboard whose points reward
validated, trust-weighted reports and filling data gaps, and signed volunteer certificates; and Track 7 (Digital Health
Standards): a read-only FHIR R4 endpoint profiled to the OneAquaHealth Implementation Guide and validated with the HL7
validator in CI. It touches Track 3 in a deliberately limited way: an optional AI check flags a photo for a person, and
a person decides.

## One-line description

Rivulet is a trust and quality layer for citizen observations of urban streams: it tells a city how far to trust each
report, what they add up to, and where to look next.

## Project description (about 250 words)

**Problem.** Small urban streams and canals are rarely monitored. Residents who would gladly help have no way to make
their reports comparable, and cities cannot tell how far a report can be trusted or where a check is needed first.
OneAquaHealth's CitizenScience App collects observations; the gap is what happens to them next.

**What Rivulet does.** A resident photographs the water and answers a few plain questions in about two minutes, with no
account. The colour is read on the phone on the Forel–Ule scale. Plausibility checks (GPS accuracy, distance from the
stream, rate limits, an optional AI "is this water?" check) hold doubtful reports for a person. Each observer earns a trust
score from agreement with other observers, which weights their evidence. A Bayesian model turns the weighted evidence into
a status class named after the EU Water Framework Directive with a 90% credible interval, and says "insufficient data"
rather than guess. A One Health layer reads warning signs against the places people and dogs use, and a Sentinel-2
cross-check adds a coarse second opinion. Results leave Rivulet as FHIR R4 profiled to the OneAquaHealth guide.

**Who benefits.** Residents (they see the effect of what they report), city services and schools (a report that names where
to take care and where a visit helps most), and researchers (data with provenance, uncertainty and a stated method).

**Honesty.** Every constant is a cited standard or a declared, uncalibrated prior, published on `/method`. Statuses are
indicative, not laboratory or public-health assessments.

## How it uses OneAquaHealth

- **The OAH-FHIR Implementation Guide.** Locations and observations declare `location-oah` and `observation-indicators-oah`;
  measured values use the guide's codes with UCUM units. A workflow builds the guide from source and runs the official HL7
  validator over Rivulet's own output on every change: **0 errors** (warnings only about missing narrative and offline UCUM lookup). Report:
  the `fhir-validation-report` branch.
- **A complement, not a copy.** Rivulet does not replace the CitizenScience App or the city dashboards; it adds the trust
  and uncertainty layer they can consume through FHIR. Their applications are login-gated with no public API we could find,
  so integration is through the standard, and the city report links out to the Resilience Map and the Catalogue of Measures.
- **The field protocols.** The professional Field Sampling Protocols (CC-BY-4.0) are the reference; the resident survey is a
  labelled, simplified proxy (see `docs/SCIENCE.md`).

## How we built it

Next.js 16 (App Router, TypeScript strict), React 19, Tailwind CSS 4, MapLibre GL, Supabase (Postgres, PostGIS,
row-level security with column grants), Zod, `pdf-lib`, `node:crypto` (Ed25519), Groq vision for the optional photo check,
GitHub Actions, and Vercel. The science engine and the FHIR mapping are pure functions with 204 unit tests; the deployed
pages are thin shells around them. Details: `docs/ARCHITECTURE.md`.

## Challenges

- **Honest science with little data.** We refused to invent calibration, so each constant is labelled and the model says
  "insufficient data" instead of guessing.
- **Thin streams, coarse pixels.** Most urban streams are narrower than a 10 m Sentinel-2 pixel; the satellite check
  therefore stays grey for most of them, and we say so.
- **A standard that is still moving.** The guide is a draft with no published package; we build it from source and found
  and fixed real conformance defects with the validator.
- **Speed.** The first map took seconds per city switch. It now renders at once, caches city data at the edge and swaps
  only the line data on the map.

## Accomplishments

- A working, deployed prototype covering the full path: report, review, trust, estimate, One Health, map, city report,
  certificate, FHIR.
- A read-only FHIR endpoint validated in CI against the OneAquaHealth guide.
- An installable PWA whose reports survive a lost connection and are sent, with their true time, when it returns.
- A signed, verifiable Open Badges 3.0 volunteer certificate with a QR code and a PDF.

## What we learned

That the hard problem in citizen science is not collecting but qualifying: who to believe, and how to say "we do not
know yet" in a way people can act on.

## Limitations (what we did not claim)

- Not a laboratory, regulatory or public-health assessment; nothing here says water is safe.
- Class limits are priors, not calibrated ecological quality ratio boundaries; colour is an uncalibrated phone proxy.
- Trust is peer agreement, not truth; the model is not yet validated against independent measurements.
- Validation shows a sample passing the HL7 validator offline, not conformance of every database row.
- Coimbra's reports are synthetic demonstration data, tagged `HTEST`; real reports are few (Tashkent). No traction is claimed.
- Not endorsed by the EU, IEEE or the OneAquaHealth consortium.

## What is next: a pilot that tests the model

1. Choose a city and streams with a partner and agree a protocol.
2. Recruit volunteers and collect reports.
3. Compare Rivulet's estimates and trust with independent measurements (the field protocols) and calibrate or retire priors.
4. Measure usefulness to city services.

Success would be judged on repeat participation, share of streams with a fresh report, the share of raised warnings that
independent checks confirm, and the time and cost of a useful check.

## Try it in three minutes

1. Open <https://rivulet-xi.vercel.app/map>, choose **Tashkent** or **Coimbra**, then switch between *Water health*, *Safe to
   touch?* and *Satellite check*. Tap a stream.
2. Open **City report** for where to take care and where a visit would help most.
3. Open a stream page, then **Check a stream** to see the two-minute form (a report needs your location, so on a desktop
   it will ask permission).
4. Open <https://rivulet-xi.vercel.app/open-data> and follow the live FHIR examples; open `/method` for the method.
5. Open a certificate: <https://rivulet-xi.vercel.app/certificates/0b4911ba-1449-400f-9a28-3b3576a45906>.

## Built with

`nextjs` `react` `typescript` `tailwindcss` `supabase` `postgis` `maplibre` `fhir` `hl7` `sentinel-2` `open-badges`
`pwa` `groq` `vercel` `github-actions`

## Links

- Live: <https://rivulet-xi.vercel.app>
- Code: <https://github.com/it-withend/rivulet> (Apache-2.0)
- Validation report: <https://github.com/it-withend/rivulet/tree/fhir-validation-report>
- Method: <https://rivulet-xi.vercel.app/method>
