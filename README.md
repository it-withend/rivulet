# Rivulet

Rivulet is a trust and quality layer for citizen observations of urban freshwater, built for the
IEEE OneAquaHealth Global Hackathon 2026. It turns citizen stream observations into
uncertainty-aware ecological assessments, expressed in EU Water Framework Directive ecological
status classes and emitted through the OneAquaHealth HL7 FHIR Implementation Guide.

See `docs/superpowers/specs/2026-09-15-rivulet-design.md` for the design specification and
`docs/superpowers/plans/2026-09-15-rivulet-phase1.md` for the Phase 1 implementation plan.

## Getting started

Install dependencies (already done if you just cloned and ran `npm install`):

```bash
npm install
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

## Environment variables

Copy `.env.example` to `.env` (or `.env.local`) and fill in the values:

```bash
cp .env.example .env
```

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Project structure

- `src/app/` — Next.js App Router pages and layouts
- `src/lib/science/` — pure scientific/statistical functions (uncertainty, aggregation, FHIR
  mapping), each with tests in a colocated `__tests__/` directory

## Tech stack

Next.js (App Router) with TypeScript, Tailwind CSS, ESLint, and Vitest (with Testing Library and
jsdom) for testing. The `@/*` import alias resolves to `src/`.
