# Rivulet Phase 2b — Satellite layer and divergence

**Goal:** an independent observation of the same water, from Sentinel-2, and an honest treatment of
where it disagrees with what residents report. Divergence is signal, not error: satellites see the
whole surface coarsely, residents see one bank precisely.

**Constraints:** all Phase 2a global constraints apply (design system, declared priors in
`METHOD_PARAMETERS`, missing data never becomes good news, Supabase ref `pkmmcwyhraosmvnfofos`
only, minimal tests — only what the product depends on).

**Hard rule: the live demo never calls a third-party API.** Everything is pre-fetched by a script
into `satellite_readings`, and the app reads only our database.

---

## Task 20 — Ingest Sentinel-2 readings

### Source (verified 2026-09-16, no credentials needed)

Element 84 Earth Search STAC: `POST https://earth-search.aws.element84.com/v1/search`,
collection `sentinel-2-l2a`, filters `bbox`, `datetime`, `query.eo:cloud_cover`. Assets include
`blue` (B02), `green` (B03), `red` (B04), `rededge1` (B05), `nir` (B08), `nir08` (B8A), `scl`
(scene classification, if absent use the granule metadata), each a public Cloud-Optimised GeoTIFF
on S3 over HTTPS. Read only small windows with the `geotiff` npm package (add it as a dependency);
never download whole scenes.

### Migration `supabase/migrations/0007_satellite.sql`

```sql
create table satellite_readings (
  id uuid primary key default gen_random_uuid(),
  waterbody_id uuid not null references waterbodies(id) on delete cascade,
  acquired_at timestamptz not null,
  scene_id text not null,
  cloud_cover numeric,
  usable_pixels integer not null,
  ndci numeric,
  turbidity numeric,
  forel_ule_equivalent integer check (forel_ule_equivalent between 1 and 21),
  hue_angle numeric,
  created_at timestamptz not null default now(),
  unique (waterbody_id, scene_id)
);
alter table satellite_readings enable row level security;
create policy "Satellite readings are public" on satellite_readings
  for select to anon, authenticated using (true);
create index satellite_readings_waterbody_idx
  on satellite_readings (waterbody_id, acquired_at desc);
```

### Script `scripts/satellite/ingest.ts`

`npx tsx --env-file=.env.local scripts/satellite/ingest.ts Coimbra [months]`

1. Bounding box from `st_extent` of that city's water bodies (add an RPC in the same migration:
   `city_bbox(p_city text) returns table (min_lon, min_lat, max_lon, max_lat double precision)`,
   `security definer`, execute granted to `service_role`).
2. STAC search, cloud cover < 20%, one scene per calendar month over the last 6 months — the least
   cloudy per month.
3. For each water body of that city, take its centroid, and read a window of
   `windowPixels` (5×5) around it from `blue`, `green`, `red`, `rededge1`, `nir` and `scl`.
   Water bodies are narrow: a 10 m pixel often mixes bank and water, which is exactly why the
   reading is reported as an independent, coarse estimate and never overrides residents.
4. Mask pixels: drop anything the SCL band marks as cloud, cloud shadow, snow or saturated; then
   keep only pixels with NDWI = (green − nir)/(green + nir) above `minNdwi` (0.0) — i.e. water.
   Fewer than `minUsablePixels` (4) left → record the row with `usable_pixels` and null indices.
   **A cloudy or unusable pass is stored as unavailable, never as agreement.**
5. Compute per water body: mean NDCI = (rededge1 − red)/(rededge1 + red); turbidity proxy = mean
   red reflectance; hue angle and Forel–Ule equivalent by feeding the blue/green/red reflectances
   through the existing `srgbToXyz`-free path: convert reflectances to CIE XYZ with the CIE 1931
   colour-matching weights for the three band centre wavelengths, then reuse `chromaticity`,
   `hueAngle` and `hueAngleToForelUle` from `src/lib/science/forel-ule.ts`.
   Declare the band-weighting as a prior: the published van der Woerd & Wernand (2015, 2018)
   Sentinel-2 hue-angle coefficients and the delta-correction are **not** applied; state that in
   the rationale and in the UI, and cite the paper as the calibration we intend to adopt.
6. Upsert on `(waterbody_id, scene_id)`; log a summary; safe to re-run.

### Science — `src/lib/science/satellite.ts`

- `SATELLITE_PARAMETERS` (all priors): `minUsablePixels`, `minNdwi`, `windowPixels`,
  `maxAgeDays` (30 — a reading older than this stops counting as current),
  `evidenceWeight` (0.4 — a satellite reading enters the Bayesian model with this weight relative
  to a full-weight citizen observation), `divergenceThresholdFu` (3).
- `satelliteEvidence(reading)` → `{ good, bad }` using the same Forel–Ule evidence thresholds as
  `ecologicalEvidence`, so the two sources speak one language.
- `divergence(citizenFu, satelliteFu)` → `{ deltaFu, diverged }`.
- `computeSnapshot` gains an optional `satellite?: SatelliteReading[]` input: readings newer than
  `maxAgeDays` contribute evidence at `evidenceWeight`; **when citizen and satellite readings
  diverge beyond the threshold, the posterior is widened rather than sharpened** — implement by
  halving both sources' weights for that water body and setting `snapshot.divergence`. Data
  confidence must not rise because of a diverging satellite pass.
- Bump `METHOD_VERSION` (minor) with a changelog note.

Tests (only these): evidence mapping for a clear and an enriched reading; divergence flag;
snapshot with a diverging satellite reading has a **wider** interval and no higher confidence than
the same snapshot without it.

### UI

- **Water body page:** a "Citizen and satellite" panel — latest satellite reading (date, cloud
  cover, Forel–Ule equivalent, NDCI in monospace), the citizen Forel–Ule, and one plain sentence:
  agreement, divergence, or "No usable satellite pass in the last 30 days — cloud cover or too few
  water pixels." Never render a missing pass as agreement. In scientific mode add the pixel count
  and the uncalibrated-hue caveat with the citation.
- **Map:** a layer toggle "Citizen–satellite divergence" that colours water bodies with a current
  divergence in the divergence accent (not a WFD colour, so it is never confused with status);
  water bodies without a usable pass render in the insufficient-data grey.
- **Open data page:** one sentence that satellite readings are derived from Copernicus Sentinel-2
  data (attribution: "Contains modified Copernicus Sentinel data 2026"), processed by Rivulet.
- **Landing page:** add satellite to the method list; keep the proxy caveat.

### Verification (light)

The named tests, `npm test` and `npm run build` once, and one ingest run for Coimbra with the
result counts reported. Curl `/water/<a Coimbra id>` and `/map?layer=divergence`.

Commit: "Compare citizen readings against Sentinel-2 and treat divergence as signal".
