# Rivulet Phase 2a — Leaderboards, Trust Score and Certificates

**Goal:** residents get a pseudonymous identity, a Trust Score that is a real weight inside the
Bayesian model, individual and city leaderboards that reward quality rather than volume, and
signed Open Badges 3.0 certificates with a public verification page.

**Order (owner, 2026-09-16):** Task 17 (identity, trust, leaderboards) → Task 18 (certificates) →
then the satellite layer (separate plan). About 12 days to submission.

**Global constraints (in addition to the Phase 1 plan's):**
- Tests only for logic the product depends on: trust maths, contribution scoring, credential
  sign/verify. One curl per new route. No UI snapshot tests.
- Every new constant goes into `METHOD_PARAMETERS` (`kind: "prior"` + rationale ending with the
  `UNCALIBRATED` sentence) or cites a real standard. Bump `METHOD_VERSION` when science output changes.
- Anonymous by default. No email, no real name required. Display names are public pseudonyms.
- Synthetic observers are labelled "Demo" wherever shown and can never receive a certificate.
- No EU, IEEE or OneAquaHealth endorsement anywhere. Certificates are issued by "Rivulet
  (independent citizen-science prototype)" with an empty institutional co-signing slot.
- Design system only (`src/components/ui/`, tokens in `globals.css`). Numbers use `.num`.
- Supabase project: only the one in `.env.local` (ref `pkmmcwyhraosmvnfofos`). Apply migrations
  with the Supabase MCP `apply_migration` and also commit the SQL file.
- Anything unfinished is absent from the UI, never a dead button.

---

## Task 17 — Pseudonymous observers, Trust Score, auto-validation, leaderboards

### 17.1 Migration `supabase/migrations/0004_observer_identity.sql`

```sql
alter table observers
  add column token_hash text unique,
  add column is_synthetic boolean not null default false;

create policy "Observer profiles are public" on observers
  for select to anon, authenticated using (true);
revoke select on observers from anon, authenticated;
grant select (id, display_name, trust_score, is_synthetic, created_at)
  on observers to anon, authenticated;

create index observations_observer_idx on observations (observer_id, observed_at desc);
```

`email`, `is_minor`, `locale` and `token_hash` stay unreadable to anonymous clients. Verify once
with the anon key that `token_hash` is denied.

### 17.2 Identity — `src/lib/identity/`

- `pseudonym.ts`: `generatePseudonym(random = Math.random)` → `"<Species> <4 digits>"` from a fixed
  list of freshwater species (Kingfisher, Heron, Otter, Dipper, Mayfly, Caddis, Stonefly, Grayling,
  Wagtail, Newt, Dragonfly, Damselfly, Water Vole, Trout, Salamander, Moorhen, Egret, Beaver).
- `token.ts` (server only): `createToken()` → 32 random bytes base64url; `hashToken(token)` →
  sha256 hex; `observerFromRequest(db, request)` reads `Authorization: Bearer <token>` and returns
  `{ id, displayName } | null`.
- `client.ts` (browser): storage key `rivulet.observer.v1` holding `{ id, displayName, token }`;
  `getObserver()`, `ensureObserver()` (POSTs `/api/observers` once if absent), `saveObserver()`,
  `clearObserver()`. Wrap storage access in try/catch.

Routes:
- `POST /api/observers` body `{ displayName?: string }` → creates observer (pseudonym if absent),
  returns `201 { id, displayName, token }`. The token is returned only here.
- `PATCH /api/observers/me` (Bearer) body `{ displayName }`, 2–40 chars after trim → `200`.
- `DELETE /api/observers/me` (Bearer) → deletes the observer (observations keep their data with
  `observer_id` set null by the existing FK; certificates cascade). This is the GDPR erasure path.
- Missing/invalid token on `/me` routes → `401 { error: "unauthorised" }`.

### 17.3 Observation route changes (`src/app/api/observations/route.ts`)

- The wizard calls `ensureObserver()` before submitting and sends the Bearer token.
- The route resolves the observer; an absent or invalid token never blocks submission — the
  observation is stored anonymously.
- `validation_status` comes from `src/lib/science/plausibility.ts`
  `plausibilityStatus({ gpsAccuracyM, recentByObserver })` → `"auto_approved" | "flagged"`:
  flagged when GPS accuracy is null or worse than `maxGpsAccuracyM` (250), or the same observer
  submitted more than `maxPerHour` (5) observations in the previous hour. Both are declared priors.
- After insert, recompute trust for every observer who has observed this water body (17.4) and
  update `observers.trust_score`. Failure to recompute is logged and never fails the request.
- Response adds `observer: { id, displayName } | null`.

### 17.4 Trust Score — `src/lib/science/trust.ts`

Agreement with independent observers of the same water body, shrunk towards neutral:

- For each observation *i* by observer *O* at water body *W*: `p_i = good/(good+bad)` from
  `ecologicalEvidence` (skip if `good+bad === 0`). `m` = posterior mean of *W* using only
  observations by other observers (anonymous ones count as other). Need at least
  `minIndependent` (2) such observations, otherwise *i* gives no signal.
- `a_i = 1 − |p_i − m|`.
- `trust(O) = (priorStrength × 0.5 + Σ a_i) / (priorStrength + n)`, `priorStrength = 5`.
- `trustMultiplier(trust) = clamp(trust / 0.5, 0.4, 1.6)`; neutral trust 0.5 → 1.
- Declare `priorStrength`, `minIndependent`, multiplier bounds as priors. Cite Beta–binomial
  shrinkage as the standard basis (Gelman et al., BDA3, ch. 5) in the rationale text.

`StoredObservation` gains optional `observerTrust?: number`; `computeSnapshot` uses
`qualityWeight × trustMultiplier(observerTrust ?? 0.5)`. Pages and the FHIR route select
`observers(trust_score)` through the embed and pass it in. Bump `METHOD_VERSION` (minor) with a
note that observer trust now weights evidence.

`src/lib/trust/recompute.ts` (server): `recomputeTrust(db, observerIds)` loads those observers'
observations and all observations on the water bodies they touched, computes, updates.
Script `scripts/recompute-trust.ts` recomputes for all observers.

Tests (`src/lib/science/__tests__/trust.test.ts`): an observer agreeing with independent
observers scores above 0.5; a contradicting one below 0.5; no independent data → exactly 0.5;
multiplier clamps.

### 17.5 Contribution score — `src/lib/engagement/contribution.ts`

Pure function `contributions(observations, now)` over rows
`{ observerId, waterbodyId, observedAt, qualityWeight, observerTrust, validationStatus, isSynthetic }`:

- Counts only `auto_approved` or `human_approved`.
- Anti-gaming: one counted observation per observer per water body per UTC day (the first).
- Points per counted observation: `round(basePoints × qualityWeight × trustMultiplier)`,
  `basePoints = 10`.
- Gap bonus `gapBonus = 5` when no other observation existed on that water body in the preceding
  `gapDays = 30` days — rewards covering neglected streams rather than repeating popular ones.
- Returns per observer: `points, countedObservations, streamsCovered, gapsFilled, trust, homeCity`
  (city with most counted observations; requires `waterbodyCity` on the row).
- All constants declared as priors.

Tests: daily cap, flagged observations excluded, gap bonus applied once.

### 17.6 Leaderboard page `/leaderboard`

Server component, anon client, one observations query joined to `waterbodies!inner(city)` and
`observers(display_name, trust_score, is_synthetic)`.

- **People** (default): top 100, optional `?city=` chips (same pattern as `/map`). Columns: rank,
  name (+ "Demo" chip if synthetic), points, validated observations, streams, gaps filled, trust %.
  A client island highlights the viewer's own row using `getObserver()`.
- **Cities** (`?view=cities`): the five pilot cities ranked by coverage = share of water bodies
  with an assessed WFD class, then active observers in the last 30 days. Collective, not individual.
- Plain-language explainer: points come from validated, trust-weighted observations; repeating the
  same stream on the same day earns nothing extra; filling a data gap earns a bonus.
- If any listed observer is synthetic: "Includes demo observers while the pilot collects real data."
- Add "Leaderboard" to `SiteHeader` NAV between Journal and Open data.

### 17.7 Demo data — `scripts/seed/seed-observers.ts`

Create 60 synthetic observers (`is_synthetic: true`, pseudonyms, `token_hash` null). Assign every
synthetic Coimbra observation to one of them (skewed: a few very active, many occasional). Make 6
of them unreliable by inverting their survey evidence (`polluted` answers on clean streams and
vice versa, recomputing `indicators`). Then run the trust recompute. Idempotent guard: abort if
synthetic observers already exist.

### 17.8 Journal

`FieldJournal` shows "Your field name" with the pseudonym, a rename form (PATCH), the viewer's
trust %, points and rank (fetched from a small `GET /api/observers/me/summary` Bearer route that
reuses `contributions`), and a "Delete my data" button with confirmation (DELETE, then
`clearObserver()`).

Verification: focused tests; `npm test`, `npm run build` once; curl `/leaderboard`,
`/leaderboard?view=cities`, `POST /api/observers`. Commit message:
"Weight evidence by observer trust and rank contributors by validated quality".

---

## Task 18 — Signed volunteer certificates

### 18.1 Migration `supabase/migrations/0005_certificates.sql`

```sql
create table certificates (
  id uuid primary key default gen_random_uuid(),
  observer_id uuid not null references observers(id) on delete cascade,
  tier text not null check (tier in ('contributor','data_steward')),
  recipient_name text not null,
  credential jsonb not null,
  jwt text not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  endorsements jsonb not null default '[]'
);
alter table certificates enable row level security;
create policy "Certificates are publicly verifiable" on certificates
  for select to anon, authenticated using (true);
revoke select on certificates from anon, authenticated;
grant select (id, tier, recipient_name, credential, jwt, issued_at, revoked_at, endorsements)
  on certificates to anon, authenticated;
create unique index certificates_one_per_tier on certificates (observer_id, tier)
  where revoked_at is null;
```

### 18.2 Eligibility — `src/lib/engagement/certificates.ts`

- `contributor`: ≥ 5 counted observations and trust ≥ 0.5.
- `data_steward`: ≥ 20 counted observations, trust ≥ 0.6, and rank ≤ 100 in the home city's
  people leaderboard.
- `eligibility(summary, rank)` → per tier `{ eligible, missing: string[] }` in plain language
  ("3 more validated observations"). Synthetic observers are never eligible.
- Thresholds declared as priors (they are programme rules, not science, but stay visible).

### 18.3 Credential — `src/lib/credentials/`

- `keys.ts` (server only): reads `RIVULET_ISSUER_PRIVATE_KEY` (base64 PKCS#8 DER, Ed25519) with
  `node:crypto`; derives the public key; exports `publicJwk()`.
- `open-badge.ts`: `buildCredential({ id, tier, recipientName, stats, issuedAt, baseUrl })` →
  Open Badges 3.0 JSON: `@context` `["https://www.w3.org/ns/credentials/v2",
  "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"]`, `type`
  `["VerifiableCredential","OpenBadgeCredential"]`, `id` = `${baseUrl}/certificates/${id}`,
  `issuer` `{ id: `${baseUrl}/issuer`, type: ["Profile"], name: "Rivulet (independent citizen-science prototype)" }`,
  `validFrom`, `name`, `credentialSubject` `{ type: ["AchievementSubject"], name: recipientName,
  achievement: { id, type: ["Achievement"], name, description, criteria: { narrative } } }`,
  and `evidence` with the concrete stats (validated observations, streams covered, gaps filled,
  trust).
- `jwt.ts`: `signCredential(credential)` → compact JWS, header `{ alg: "EdDSA", typ: "vc+jwt", kid }`,
  payload = credential; `verifyCredential(jwt)` → `{ valid, credential }`. No external library.

Tests: sign → verify valid; tampered payload → invalid.

### 18.4 Routes and pages

- `POST /api/certificates` (Bearer) body `{ tier, recipientName }` (2–80 chars) → recomputes
  eligibility server-side; `403 { error: "not_eligible", missing }` otherwise; `409` if an
  unrevoked certificate of that tier exists; `201 { id, url }`.
- `GET /api/certificates/[id]` → the credential JSON (`application/ld+json`).
- `GET /api/issuer/jwks` → `{ keys: [publicJwk] }`.
- `/issuer` page: who issues, that Rivulet is an independent hackathon prototype not endorsed by
  the EU, IEEE or the OneAquaHealth consortium, the public key, and how verification works.
- `/certificates/[id]`: printable certificate (print stylesheet, A4 landscape) — tier, recipient,
  stats, issue date, signature status computed server-side ("Signature verified" / "Signature
  invalid" / "Revoked"), link to the JSON credential, and the co-signing slot: "Institutional
  endorsement — none yet. This slot accepts a co-signature from a municipality or research
  consortium." Design: field-guide certificate, Newsreader display, Forel–Ule ribbon as the border
  motif; no seals imitating official bodies.
- Journal: "Certificates" panel listing both tiers with progress (`missing` lines), a claim form
  (recipient name with the note "This name will be shown publicly on the certificate's
  verification page") and links to issued certificates (store issued ids in the observer's local
  storage record).

Env: `RIVULET_ISSUER_PRIVATE_KEY` is already in `.env.local` (controller generated it). Add the
name to `.env.example` only. The owner adds it to Vercel. Missing key → `503
{ error: "issuer_unavailable" }` on issuance; verification page shows "Issuer key not configured".

Verification: focused tests; `npm test`, `npm run build` once; with a local observer having enough
data (use a synthetic-free test observer created via the API against a Coimbra stream only if
needed, then delete it), curl issuance and the verification page. Commit message:
"Issue signed Open Badges certificates with public verification".
