# Rivulet

**Live prototype:** https://rivulet-xi.vercel.app

**Track: 2 — Data-to-Insight.** Rivulet turns what residents notice at an urban stream into a
trust-weighted, uncertainty-aware picture of that stream's health that a city, a researcher or a
neighbour can act on.

Rivulet is a trust and quality layer for citizen observations of urban freshwater, built for the
IEEE OneAquaHealth Global Hackathon 2026. It turns citizen stream observations into
uncertainty-aware indicative status classes named after the EU Water Framework Directive, and
exports them as FHIR resources that declare the OneAquaHealth HL7 FHIR Implementation Guide
profiles.

See `docs/superpowers/specs/2026-09-15-rivulet-design.md` for the design specification and
`docs/superpowers/plans/2026-09-15-rivulet-phase1.md` for the Phase 1 implementation plan.

## Positioning

The OneAquaHealth consortium has already built a CitizenScience App, a Community platform, an
AI-based Environmental Surveillance System, a Decision Support System, and a FHIR Implementation
Guide. Rivulet is deliberately the complement to that stack, not a replacement for it: citizen
data collection already exists, so Rivulet builds the quality and trust layer that turns resident
observations into estimates with measurable uncertainty, expressed in WFD classes and encoded in
the consortium's own FHIR Implementation Guide.

## Scientific basis

Every method constant Rivulet uses is either a cited standard or a declared, uncalibrated prior —
never an unlabelled magic number. The full registry, with a rationale for every entry, lives in
`src/lib/science/method-parameters.ts`; `ScoreDisclosure` (`src/components/water/ScoreDisclosure.tsx`)
surfaces it in the product itself under "Why this score?".

Methods draw on:

- The Forel–Ule water colour scale, estimated on the phone with a simplified WACODI-style
  conversion (Novoa, Wernand & van der Woerd 2013; Novoa et al. 2015) and IEC 61966-2-1:1999 sRGB
  colour management. There is no per-camera calibration.
- Five indicative status classes named after EU Water Framework Directive 2000/60/EC (Annex V).
  The class limits are equal-width priors, not calibrated EQR boundaries, so this is not an
  official WFD assessment.
- Macroinvertebrate sensitivity values set on the BMWP 1–10 family scale (Armitage, Moss, Wright &
  Furse 1983) for six groups a resident can recognise — a simplified proxy, not the BMWP protocol.
- Beta–Bernoulli conjugate Bayesian updating with equal-tailed credible intervals
  (Gelman et al., *Bayesian Data Analysis*, 3rd ed., 2013), with each observation weighted by its
  quality and by its observer's trust score.
- FHIR resources declaring the HL7 Europe OneAquaHealth Implementation Guide profiles for
  indicators and locations. Real measurements (pH, dissolved oxygen, temperature, nitrate) use the
  guide's codes; signs a resident sees but cannot measure (clarity, sewage smell, algae, foam, dead
  fish, litter) use a separate Rivulet code system, served at `/fhir/CodeSystem/rivulet-derived`.
  See "Relationship to OneAquaHealth" below for exactly what was and was not checked.

**One Health: people and animals nearby.** Each stream also gets an indicative concern level for
people, dogs and wildlife (`src/lib/science/one-health.ts`). Hazard is the trust-weighted share of
reports from the last 30 days showing a warning sign — sewage smell, algae or scum, chemical smell
or foam, dead fish, heavy litter. Exposure is what OpenStreetMap places within 150 m of the
stream: playgrounds, schools, kindergartens, parks, dog parks, bathing and fishing spots, picnic
sites and allotments. A hazard near a place people or dogs use raises the concern; no recent
reports reads as unknown, never as safe. It is a prompt to take care, not a public health or
bathing-water assessment.

Observations that fail plausibility checks (imprecise GPS, far from the stream, too many in an
hour, or — if configured — a photo an AI check does not recognise as water) are stored but held
out of assessments, trust scores and exports until a person reviews them.

**Human review.** `/moderate` lists everything currently held for review, with the reason, and lets
a moderator approve (`human_approved`, counted exactly like `auto_approved`) or reject
(`rejected`, permanently excluded) an observation; either action recomputes trust for every
observer on that water body. There are no moderator accounts — set `RIVULET_MODERATOR_TOKEN` to a
shared passphrase; the page is unusable until that is configured. This is deliberately minimal:
right for a two-person team reviewing a pilot, not a production moderation system.

**Optional photo check.** If `GROQ_API_KEY` is set, a small (~160px, never stored) thumbnail of
each submitted photo is sent once to a Groq vision model asking "does this look like water?". A
confident "no" — a meme, a selfie, a screenshot — flags the observation for review instead of
silently entering the model; a missing key, a timeout, or an uncertain answer all mean the check
is skipped, never that the observation is flagged. The full-resolution photo is never uploaded,
matching the on-device colour reading. Every plausibility signal (GPS accuracy, the hourly rate
limit, distance from the claimed water body, this photo check) is evaluated independently and all
that apply are recorded in `flag_reason`, so a report already flagged for one reason still gets
its photo checked for the others.

**Certificates as a downloadable, printable document.** `/certificates/<id>` renders as a landscape
card (seal, signature block, verification link) instead of a plain page, and
`/api/certificates/<id>/pdf` (pure `pdf-lib`, no headless browser) returns the same design as an
actual PDF file for a CV or portfolio. A revoked certificate, or one whose signature does not
verify, is refused as a PDF rather than rendered.

Full citations are in `src/lib/science/method-version.ts`.

**Limitations, stated explicitly.** Photo-derived colour is a proxy for water quality, not a
laboratory measurement. Citizen observations are spatially biased toward accessible banks. Below a
minimum data confidence, Rivulet reports "insufficient data" rather than guessing — missing
evidence is never presented as good news.

## Relationship to OneAquaHealth

Rivulet is an independent prototype. It is not affiliated with, endorsed by, or connected to the
OneAquaHealth consortium's systems. What it does use, and what it does not:

**Used — the OAH-FHIR Implementation Guide** (`hl7-eu/oah`, FHIR 4.0.1, canonical
`http://hl7.eu/fhir/ig/oah`). `/api/fhir/Observation?waterbody=<id>` returns a Bundle whose
Locations declare `…/StructureDefinition/location-oah` and whose Observations declare
`…/StructureDefinition/observation-indicators-oah`. Where the guide's code system
(`temporarySystem-oah-eu`) has a code for something Rivulet reports (pH, dissolved oxygen, water
temperature, nitrate, …) that code is used; where it has none (water colour, resident-reported
signs, the classified outcome) Rivulet's own code system is used and served at its canonical URL.

**Checked against the guide's FSH source (2026-09-21), not with the official validator.** The
profiles' mandatory elements were compared with the export by hand: `Location.identifier`,
`name`, `mode = instance` and `position` (lon/lat both present); `Observation.status = final`,
`code`, `subject` → `LocationOah`, `effective[x]`, `performer`, and `value[x]` limited to
`CodeableConcept` or `Quantity`. That review found and fixed two real defects: profile canonicals
used the profile *name* instead of its *id*, and `Location` lacked `identifier` and `mode`. The
official HL7 validator (needs Java 11+) has **not** been run, so full conformance is unconfirmed.
Known remaining gaps: resident-scored values use the unit `1` or `FU` without a UCUM system;
`performer` carries a display string, not a reference to a resource; the guide binds `code` to
its indicator value set as *preferred*, so Rivulet's own codes are permitted but a validator may
warn. The guide's `foam` concept is defined as "Foam/colour/smell" (three signs in one), so
Rivulet keeps its narrower `surface-foam` code rather than stretching the guide's meaning.

**Not used — OneAquaHealth's applications.** The CitizenScience App, Community, city dashboards
and Resilience Map are login-gated, and no public API or open-data endpoint for them was found in
the project's public material (checked 2026-09-21). Rivulet therefore neither reads from nor
writes to them; the FHIR export is the interoperability path. The Resilience Map covers the same
five pilot cities (Benevento, Coimbra, Ghent, Oslo, Toulouse) and can export CSV, which would be
a natural cross-check for a later phase. The city report links out to the Resilience Map, the
Citizen Science project and the Catalogue of Measures.

**Complement, not overlap.** OneAquaHealth's app guides a fuller stream assessment (clarity and
flow, vegetation, wildlife, signs of pollution or alteration, land use, erosion) with photos and
video. Rivulet covers the two-minute case: water colour and visible warning signs, and adds what
citizen data needs before it can be trusted — plausibility checks, observer trust, uncertainty
and human review. Rivulet does not assess flow, vegetation, wildlife, erosion or
macroinvertebrates from field sampling.

## What Rivulet does not claim

- **Not a laboratory, regulatory or public-health assessment.** Nothing here states that water is
  safe or unsafe to touch or drink; the One Health reading is a prompt to take care.
- **Not an official Water Framework Directive classification.** The five class names come from
  Annex V of Directive 2000/60/EC, but the class limits are equal-width priors, not calibrated
  ecological quality ratio boundaries.
- **Colour is a proxy.** Forel–Ule is estimated from a phone photo without per-camera calibration
  and says nothing about chemical composition.
- **The trust score is peer agreement, not truth.** Observers who agree with each other can all be
  wrong. The model needs validating against independent measurements before it is relied on.
- **The satellite check is coarse and uncalibrated.** Most urban streams are narrower than a
  Sentinel-2 pixel; most stay "no clear satellite view".
- **Not full FHIR IG conformance.** See above: hand-checked, official validator not run.
- **No institutional endorsement.** Certificates and the site are not endorsed by the EU, IEEE or
  the OneAquaHealth consortium.
- **Demonstration data is synthetic.** Coimbra's seeded observations are flagged
  `is_synthetic = true` and tagged `HTEST` in FHIR; they show the product working, not the real
  state of any stream.
- **The photo check is a screening aid.** A small thumbnail goes to a third-party model; a
  confident "not water" only sends the report to a human, and a missing key or timeout skips it.
- **No traction claimed.** The pilot has few real reports; the counters on the home page show
  real and synthetic data separately.

## Synthetic demonstration data

The seed script (`scripts/seed/seed.ts`) inserts realistic demonstration observations alongside
the real Overpass-sourced water bodies so the map, water body pages, and FHIR export have
something to show during the pilot. Every seeded row is marked `observations.is_synthetic = true`.

That flag propagates end to end:

- The water body page shows a note that a stream's history includes synthetic demo observations.
- `CommunityCounters` on the landing page counts only real (`is_synthetic = false`) observations.
- The FHIR export (`/api/fhir/Observation`) tags every resource derived from a synthetic
  observation with `meta.tag = [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
  code: "HTEST", display: "test health data" }]`, the standard HL7 code for test health data, so a
  downstream consumer can filter demo data out of real citizen observations.

## Getting started

Install dependencies:

```bash
npm install
```

`npm install` also runs a `postinstall` script (`scripts/copy-maplibre-worker.mjs`) that copies the
MapLibre GL worker files into `public/maplibre/`, which the map needs to render under Turbopack.

Copy `.env.example` to `.env.local` and fill in your own Supabase project's values (never commit
this file or its contents):

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RIVULET_ISSUER_PRIVATE_KEY` — optional, needed to issue signed certificates (see below)
- `RIVULET_MODERATOR_TOKEN` — optional, needed to use `/moderate` (see below)
- `GROQ_API_KEY` — optional, needed for the photo authenticity check (see below)

Apply the database migrations in `supabase/migrations/` to that project (in order), then seed it:

```bash
npx tsx scripts/seed/fetch-waterbodies.ts
npx tsx --env-file=.env.local scripts/seed/seed.ts
npx tsx --env-file=.env.local scripts/seed/seed-observers.ts
npx tsx --env-file=.env.local scripts/recompute-trust.ts
npx tsx --env-file=.env.local scripts/seed/seed-exposure.ts Coimbra
```

The last two steps create the synthetic demo observers and compute their trust scores; without
them the people leaderboard is empty. `seed-exposure.ts` loads the OpenStreetMap places used by the
One Health reading; run it once per city.

To add a city whose OpenStreetMap name differs from its display name, pass the OSM name third:
`seed-city.ts Tashkent 4 "Toshkent shahri"` (canals are included, as urban aryks are where residents
meet water). Sentinel-2 readings are pre-fetched with
`npx tsx --env-file=.env.local scripts/satellite/ingest.ts Coimbra 6`, which reads each band once
per scene for the whole city (a few minutes per scene); the live site never calls a satellite API.
Most urban streams are narrower than a 10 m pixel, so most get an honest "no clear satellite view". To add a city that is not in the bundled seed, run
`npx tsx --env-file=.env.local scripts/seed/seed-city.ts <City> <admin_level>`.

Signed volunteer certificates also need `RIVULET_ISSUER_PRIVATE_KEY`, an Ed25519 private key as
base64-encoded PKCS#8 DER. Without it the certificate API answers `issuer_unavailable` rather than
failing.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Scripts

- `npm run dev` — start the Next.js development server
- `npm run build` — production build (type-checked)
- `npm start` — run the production build
- `npm run lint` — lint the project
- `npm test` — run the Vitest test suite once
- `npm run test:watch` — run the Vitest test suite in watch mode

## Project structure

- `src/app/` — Next.js App Router pages and route handlers, including the FHIR export at
  `src/app/api/fhir/Observation/route.ts`
- `src/lib/science/` — pure scientific/statistical functions (uncertainty, aggregation), each with
  tests in a colocated `__tests__/` directory
- `src/lib/fhir/` — FHIR resource serialisation for the OneAquaHealth Implementation Guide
- `src/components/ui/` — the design system (see `/design` for a live reference)

## Tech stack

Next.js (App Router) with TypeScript, Tailwind CSS, ESLint, and Vitest (with Testing Library and
jsdom) for testing. The `@/*` import alias resolves to `src/`.
