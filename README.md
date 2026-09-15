# Rivulet

Rivulet is a trust and quality layer for citizen observations of urban freshwater, built for the
IEEE OneAquaHealth Global Hackathon 2026. It turns citizen stream observations into
uncertainty-aware ecological assessments, expressed in EU Water Framework Directive ecological
status classes and emitted through the OneAquaHealth HL7 FHIR Implementation Guide.

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

- The Forel–Ule water colour scale, read from a photo via the WACODI colour-science chain
  (Novoa, Wernand & van der Woerd 2013; Novoa et al. 2015) and IEC 61966-2-1:1999 sRGB colour
  management.
- EU Water Framework Directive 2000/60/EC (Annex V) ecological status classes.
- BMWP macroinvertebrate family sensitivity scores (Armitage, Moss, Wright & Furse 1983).
- Beta–Bernoulli conjugate Bayesian updating with equal-tailed credible intervals
  (Gelman et al., *Bayesian Data Analysis*, 3rd ed., 2013).
- The HL7 Europe OneAquaHealth FHIR Implementation Guide.

Full citations are in `src/lib/science/method-version.ts`.

**Limitations, stated explicitly.** Photo-derived colour is a proxy for water quality, not a
laboratory measurement. Citizen observations are spatially biased toward accessible banks. Below a
minimum data confidence, Rivulet reports "insufficient data" rather than guessing — missing
evidence is never presented as good news.

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

Apply the database migrations in `supabase/migrations/` to that project (in order), then seed it:

```bash
npx tsx scripts/seed/fetch-waterbodies.ts
npx tsx scripts/seed/seed.ts
```

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
