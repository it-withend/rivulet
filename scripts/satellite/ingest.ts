// Pre-fetches Sentinel-2 readings into `satellite_readings` so the live app
// never calls a third-party API (see Phase 2b plan, Task 20). One scene per
// calendar month, the least cloudy under 20% cover, read only as small
// windows around each water body's centroid — never whole scenes.
//
// Usage: npx tsx --env-file=.env.local scripts/satellite/ingest.ts <City> [months] [--observed-only]
//   --observed-only restricts the run to water bodies that already have
//   citizen observations, for when reading every water body in a city would
//   blow the ingest time budget (see the report for when this was used).
import { fromUrl, type GeoTIFFImage } from "geotiff";
import { supabaseAdmin } from "../../src/lib/db/client";
import {
  SATELLITE_PARAMETERS,
  reflectanceToHueAngle,
  hueAngleToForelUle,
} from "../../src/lib/science/satellite";
import { lonLatToUtm, utmZoneFromEpsg, readWindow, sampleWindowAt, pixelCentreUtm } from "./geo";

const STAC_URL = "https://earth-search.aws.element84.com/v1/search";
const MONTHS_DEFAULT = 6;
const MAX_CLOUD_COVER = 20;
const CONCURRENCY = 12;
const UPSERT_CHUNK = 250;
// Stays safely under the ~15 minute ingest guidance in the plan; checked
// before starting each water body, not each scene, so a run always leaves a
// clean, reportable stopping point.
const TIME_BUDGET_MS = 12 * 60_000;

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

const BAND_KEYS = ["blue", "green", "red", "nir", "rededge1", "scl"] as const;
type BandKey = (typeof BAND_KEYS)[number];

// SCL (Scene Classification Layer) codes excluded from the water mask:
// 1 saturated/defective, 3 cloud shadow, 8/9 cloud medium/high probability,
// 10 thin cirrus, 11 snow/ice.
const BAD_SCL = new Set([1, 3, 8, 9, 10, 11]);

type StacItem = {
  id: string;
  datetime: string;
  cloudCover: number;
  epsg: number;
  assets: Partial<Record<BandKey, string>>;
};

type SatelliteRow = {
  waterbody_id: string;
  acquired_at: string;
  scene_id: string;
  cloud_cover: number;
  usable_pixels: number;
  ndci: number | null;
  turbidity: number | null;
  forel_ule_equivalent: number | null;
  hue_angle: number | null;
};

async function searchStac(bbox: number[], start: Date, end: Date): Promise<StacItem[]> {
  const response = await fetch(STAC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: ["sentinel-2-l2a"],
      bbox,
      datetime: `${start.toISOString()}/${end.toISOString()}`,
      query: { "eo:cloud_cover": { lt: MAX_CLOUD_COVER } },
      limit: 100,
    }),
  });
  if (!response.ok) {
    throw new Error(`STAC search failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as {
    features: {
      id: string;
      properties: Record<string, unknown>;
      assets: Record<string, { href: string }>;
    }[];
  };
  return body.features.map((f) => ({
    id: f.id,
    datetime: f.properties.datetime as string,
    cloudCover: f.properties["eo:cloud_cover"] as number,
    epsg: f.properties["proj:epsg"] as number,
    assets: Object.fromEntries(
      BAND_KEYS.filter((k) => f.assets[k]).map((k) => [k, f.assets[k].href]),
    ),
  }));
}

/** One scene per calendar month, the least cloudy, oldest month first. */
function leastCloudyPerMonth(items: StacItem[]): StacItem[] {
  const byMonth = new Map<string, StacItem>();
  for (const item of items) {
    const key = item.datetime.slice(0, 7);
    const current = byMonth.get(key);
    if (!current || item.cloudCover < current.cloudCover) byMonth.set(key, item);
  }
  return [...byMonth.values()].sort((a, b) => a.datetime.localeCompare(b.datetime));
}

type OpenScene = { zone: number; images: Record<BandKey, GeoTIFFImage> };

async function openScene(item: StacItem): Promise<OpenScene> {
  const entries = await Promise.all(
    BAND_KEYS.map(async (key) => {
      const url = item.assets[key];
      if (!url) throw new Error(`Scene ${item.id} is missing asset "${key}"`);
      const tiff = await fromUrl(url);
      return [key, await tiff.getImage()] as const;
    }),
  );
  return {
    zone: utmZoneFromEpsg(item.epsg),
    images: Object.fromEntries(entries) as Record<BandKey, GeoTIFFImage>,
  };
}

// A single retry with a short, fixed backoff: enough to ride out one
// transient blip without multiplying the cost of a scene that is
// persistently unreachable (observed in practice — retrying such a scene
// 3x per water body made the whole run too slow to finish in the budget).
async function withRetries<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 150));
    }
  }
  throw lastError;
}

async function readOneReading(
  item: StacItem,
  scene: OpenScene,
  waterbody: { id: string; lon: number; lat: number },
): Promise<SatelliteRow> {
  const size = SATELLITE_PARAMETERS.windowPixels;
  const { easting, northing } = lonLatToUtm(waterbody.lon, waterbody.lat, scene.zone);

  const [blueW, greenW, redW, nirW, rededge1W, sclW] = await Promise.all(
    BAND_KEYS.map((key) => readWindow(scene.images[key], easting, northing, size)),
  );

  const usableBlue: number[] = [];
  const usableGreen: number[] = [];
  const usableRed: number[] = [];
  const usableRededge1: number[] = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const idx = row * size + col;
      const blue = Number(blueW.data[idx]);
      const green = Number(greenW.data[idx]);
      const red = Number(redW.data[idx]);
      const nir = Number(nirW.data[idx]);
      if (green + nir === 0) continue;

      const ndwi = (green - nir) / (green + nir);
      if (ndwi <= SATELLITE_PARAMETERS.minNdwi) continue;

      const centre = pixelCentreUtm(blueW, col, row);
      const scl = sampleWindowAt(sclW, centre.easting, centre.northing);
      if (scl === null || BAD_SCL.has(scl)) continue;

      const rededge1 = sampleWindowAt(rededge1W, centre.easting, centre.northing);
      if (rededge1 === null) continue;

      usableBlue.push(blue / 10_000);
      usableGreen.push(green / 10_000);
      usableRed.push(red / 10_000);
      usableRededge1.push(rededge1 / 10_000);
    }
  }

  const usablePixels = usableBlue.length;
  const base = {
    waterbody_id: waterbody.id,
    acquired_at: item.datetime,
    scene_id: item.id,
    cloud_cover: item.cloudCover,
    usable_pixels: usablePixels,
  };

  // A cloudy or unusable pass is stored as unavailable, never as agreement.
  if (usablePixels < SATELLITE_PARAMETERS.minUsablePixels) {
    return { ...base, ndci: null, turbidity: null, forel_ule_equivalent: null, hue_angle: null };
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanBlue = mean(usableBlue);
  const meanGreen = mean(usableGreen);
  const meanRed = mean(usableRed);
  const meanRededge1 = mean(usableRededge1);

  const ndci = (meanRededge1 - meanRed) / (meanRededge1 + meanRed);
  const turbidity = meanRed;
  const hue = reflectanceToHueAngle(meanBlue, meanGreen, meanRed);
  const forelUle = hueAngleToForelUle(hue);

  return { ...base, ndci, turbidity, forel_ule_equivalent: forelUle, hue_angle: hue };
}

type Database = ReturnType<typeof supabaseAdmin>;

async function upsertRows(db: Database, rows: SatelliteRow[]) {
  for (let start = 0; start < rows.length; start += UPSERT_CHUNK) {
    const chunk = rows.slice(start, start + UPSERT_CHUNK);
    const { error } = await db
      .from("satellite_readings")
      .upsert(chunk, { onConflict: "waterbody_id,scene_id" });
    if (error) throw new Error(`upsert rows ${start}-${start + chunk.length}: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const observedOnly = args.includes("--observed-only");
  const positional = args.filter((a) => !a.startsWith("--"));
  const [city, monthsArg] = positional;
  if (!city) {
    throw new Error("Usage: ingest.ts <City> [months] [--observed-only]");
  }
  const months = monthsArg ? Number(monthsArg) : MONTHS_DEFAULT;

  const db = supabaseAdmin();

  const { data: bboxRows, error: bboxError } = await db.rpc("city_bbox", { p_city: city });
  if (bboxError) throw new Error(bboxError.message);
  const bboxRow = bboxRows?.[0] as
    | { min_lon: number | null; min_lat: number; max_lon: number; max_lat: number }
    | undefined;
  if (!bboxRow || bboxRow.min_lon === null) throw new Error(`${city}: no water bodies found`);
  const bbox = [bboxRow.min_lon, bboxRow.min_lat, bboxRow.max_lon, bboxRow.max_lat];

  const end = new Date();
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - months);

  const items = await searchStac(bbox, start, end);
  const scenes = leastCloudyPerMonth(items);
  if (scenes.length === 0) {
    log(`${city}: no scenes under ${MAX_CLOUD_COVER}% cloud cover in the last ${months} months`);
    return;
  }
  log(
    `${city}: ${scenes.length} scenes selected (one per month, least cloudy): ` +
      scenes.map((s) => `${s.id} (${s.cloudCover.toFixed(1)}% cloud)`).join(", "),
  );

  log(`${city}: opening ${scenes.length} scenes' band rasters...`);
  const openedScenes = await Promise.all(scenes.map((item) => openScene(item)));

  const { data: waterbodyRows, error: wbError } = await db
    .from("waterbodies")
    .select("id, centroid")
    .eq("city", city);
  if (wbError) throw new Error(wbError.message);
  if (!waterbodyRows || waterbodyRows.length === 0) {
    throw new Error(`${city}: no water bodies found`);
  }

  // Paginated: PostgREST caps a single response at 1000 rows, and Coimbra
  // alone has several thousand observations — reading only the first page
  // would under-count which water bodies already have observations.
  const prioritised = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data: page, error: obsError } = await db
      .from("observations")
      .select("waterbody_id, waterbodies!inner(city)")
      .eq("waterbodies.city", city)
      .range(from, from + 999);
    if (obsError) throw new Error(obsError.message);
    for (const o of page ?? []) prioritised.add(o.waterbody_id as string);
    if (!page || page.length < 1000) break;
  }

  const allWaterbodies = waterbodyRows.map((row) => {
    const geom = row.centroid as { coordinates: [number, number] };
    return { id: row.id as string, lon: geom.coordinates[0], lat: geom.coordinates[1] };
  });

  const waterbodies = (
    observedOnly ? allWaterbodies.filter((wb) => prioritised.has(wb.id)) : allWaterbodies
  ).sort((a, b) => Number(prioritised.has(b.id)) - Number(prioritised.has(a.id)));

  log(
    `${city}: ${allWaterbodies.length} water bodies total, ${prioritised.size} with existing ` +
      `observations. Processing ${waterbodies.length}${observedOnly ? " (--observed-only)" : " (observed ones first)"}.`,
  );

  const startedAt = Date.now();
  let processedWaterbodies = 0;
  let insertedReadings = 0;
  let unusablePasses = 0;
  let stoppedEarly = false;

  outer: for (let start2 = 0; start2 < waterbodies.length; start2 += CONCURRENCY) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      stoppedEarly = true;
      break outer;
    }
    const batch = waterbodies.slice(start2, start2 + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (wb) => {
        const rows: SatelliteRow[] = [];
        for (let i = 0; i < scenes.length; i++) {
          try {
            rows.push(await withRetries(() => readOneReading(scenes[i], openedScenes[i], wb)));
          } catch (error) {
            // A persistent network failure for one water body/scene must
            // never crash the whole run — record it as an unusable pass
            // (never as agreement) and keep going.
            log(
              `${city}: ${wb.id} / ${scenes[i].id} failed after retries: ` +
                (error instanceof Error ? error.message : String(error)),
            );
            rows.push({
              waterbody_id: wb.id,
              acquired_at: scenes[i].datetime,
              scene_id: scenes[i].id,
              cloud_cover: scenes[i].cloudCover,
              usable_pixels: 0,
              ndci: null,
              turbidity: null,
              forel_ule_equivalent: null,
              hue_angle: null,
            });
          }
        }
        return rows;
      }),
    );

    // Upsert every batch immediately — a run that stops (time budget, or a
    // crash) always leaves whatever it already computed durably saved,
    // rather than only writing at the very end.
    const batchRows = results.flat();
    await upsertRows(db, batchRows);
    for (const row of batchRows) {
      insertedReadings += 1;
      if (row.forel_ule_equivalent === null) unusablePasses += 1;
    }
    processedWaterbodies += results.length;

    const elapsed = (Date.now() - startedAt) / 60_000;
    log(
      `${city}: ${processedWaterbodies} / ${waterbodies.length} water bodies processed ` +
        `(${insertedReadings} readings upserted so far, ${elapsed.toFixed(1)} min elapsed)`,
    );
  }

  const elapsedMinutes = (Date.now() - startedAt) / 60_000;
  log(
    `${city}: done in ${elapsedMinutes.toFixed(1)} min — ${processedWaterbodies} / ` +
      `${waterbodies.length} water bodies processed, ${insertedReadings} readings upserted ` +
      `(${unusablePasses} unusable passes), across ${scenes.length} scenes.`,
  );
  if (stoppedEarly) {
    log(
      `${city}: stopped early on the time budget (${(TIME_BUDGET_MS / 60_000).toFixed(0)} min) — ` +
        `water bodies with existing observations were processed first; re-run (optionally with ` +
        `--observed-only) to continue covering the remaining ` +
        `${waterbodies.length - processedWaterbodies} water bodies.`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
