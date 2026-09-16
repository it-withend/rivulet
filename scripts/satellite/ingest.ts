// Pre-fetches Sentinel-2 readings into `satellite_readings` so the live app
// never calls a third-party API. One scene per calendar month, the least
// cloudy under 20% cover. Each band of each scene is read ONCE as a single
// city-wide window on a 10 m grid, and every water body is sampled along its
// whole line from that in memory — reading a window per water body re-downloaded the same
// COG tiles hundreds of times and took hours.
//
// Usage: npx tsx --env-file=.env.local scripts/satellite/ingest.ts <City> [months] [--limit <n>]
import { fromUrl, type GeoTIFFImage } from "geotiff";
import { supabaseAdmin } from "../../src/lib/db/client";
import { selectAll } from "../../src/lib/db/select-all";
import {
  SATELLITE_PARAMETERS,
  reflectanceToHueAngle,
  hueAngleToForelUle,
} from "../../src/lib/science/satellite";
import { lonLatToUtm, utmZoneFromEpsg } from "./geo";

const STAC_URL = "https://earth-search.aws.element84.com/v1/search";
const MONTHS_DEFAULT = 6;
const MAX_CLOUD_COVER = 20;
const UPSERT_CHUNK = 500;
/** Common grid for every band: the visible and NIR bands are native 10 m; rededge1 and SCL (20 m) are repeated to match. */
const GRID_METRES = 10;

const BAND_KEYS = ["blue", "green", "red", "nir", "rededge1", "scl"] as const;
type BandKey = (typeof BAND_KEYS)[number];

// SCL codes excluded from the water mask: 1 saturated/defective,
// 3 cloud shadow, 8/9 cloud medium/high probability, 10 thin cirrus, 11 snow.
const BAD_SCL = new Set([1, 3, 8, 9, 10, 11]);
const SCL_WATER = 6;

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

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

/** A band read over the city at GRID_METRES, top-left origin in UTM metres. */
type CityRaster = {
  data: ArrayLike<number>;
  width: number;
  height: number;
  west: number;
  north: number;
};

type UtmBox = { minE: number; minN: number; maxE: number; maxN: number };

async function readCityBand(image: GeoTIFFImage, box: UtmBox): Promise<CityRaster | null> {
  const [x0, y0, x1, y1] = image.getBoundingBox() as [number, number, number, number];
  const width = image.getWidth();
  const height = image.getHeight();
  const xRes = (x1 - x0) / width;
  const yRes = (y1 - y0) / height;

  // Snap the window to the common 20 m grid so every band lines up exactly.
  const minE = Math.max(x0, Math.floor((box.minE - x0) / GRID_METRES) * GRID_METRES + x0);
  const maxN = Math.min(y1, y1 - Math.floor((y1 - box.maxN) / GRID_METRES) * GRID_METRES);
  const maxE = Math.min(x1, box.maxE);
  const minN = Math.max(y0, box.minN);
  if (maxE <= minE || maxN <= minN) return null; // the scene does not cover the city

  const outWidth = Math.ceil((maxE - minE) / GRID_METRES);
  const outHeight = Math.ceil((maxN - minN) / GRID_METRES);
  const col0 = Math.round((minE - x0) / xRes);
  const row0 = Math.round((y1 - maxN) / yRes);
  const col1 = Math.min(width, col0 + Math.round((outWidth * GRID_METRES) / xRes));
  const row1 = Math.min(height, row0 + Math.round((outHeight * GRID_METRES) / yRes));

  const rasters = await image.readRasters({
    window: [col0, row0, col1, row1],
    width: outWidth,
    height: outHeight,
    resampleMethod: "nearest",
  });

  return {
    data: (rasters as unknown as ArrayLike<number>[])[0],
    width: outWidth,
    height: outHeight,
    west: minE,
    north: maxN,
  };
}

async function withRetries<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastError;
}

function sampleWaterbody(
  bands: Record<BandKey, CityRaster>,
  item: StacItem,
  waterbody: { id: string; line: { easting: number; northing: number }[] },
): SatelliteRow {
  const grid = bands.blue;
  const half = Math.floor(SATELLITE_PARAMETERS.windowPixels / 2);

  // Every grid cell within `half` pixels of the stream line, walking each
  // segment in grid-sized steps so no stretch of the line is skipped.
  const cells = new Set<number>();
  const addAround = (easting: number, northing: number) => {
    const c = Math.floor((easting - grid.west) / GRID_METRES);
    const r = Math.floor((grid.north - northing) / GRID_METRES);
    for (let row = r - half; row <= r + half; row++) {
      for (let col = c - half; col <= c + half; col++) {
        if (row >= 0 && col >= 0 && row < grid.height && col < grid.width) {
          cells.add(row * grid.width + col);
        }
      }
    }
  };
  for (let k = 0; k < waterbody.line.length; k++) {
    const a = waterbody.line[k];
    const bPoint = waterbody.line[k + 1] ?? a;
    const steps = Math.max(1, Math.ceil(Math.hypot(bPoint.easting - a.easting, bPoint.northing - a.northing) / GRID_METRES));
    for (let s = 0; s < steps; s++) {
      addAround(a.easting + ((bPoint.easting - a.easting) * s) / steps, a.northing + ((bPoint.northing - a.northing) * s) / steps);
    }
  }

  const blue: number[] = [];
  const green: number[] = [];
  const red: number[] = [];
  const rededge1: number[] = [];

  {
    for (const i of cells) {
      const scl = Number(bands.scl.data[i]);
      if (BAD_SCL.has(scl)) continue;
      const g = Number(bands.green.data[i]);
      const n = Number(bands.nir.data[i]);
      if (g + n === 0) continue; // no-data
      // Water if Sen2Cor's scene classification says so (class 6), or if
      // NDWI does. NDWI alone rejects shallow, turbid rivers whose NIR is
      // raised by sediment and the river bed.
      if (scl !== SCL_WATER && (g - n) / (g + n) <= SATELLITE_PARAMETERS.minNdwi) continue;
      blue.push(Number(bands.blue.data[i]) / 10_000);
      green.push(g / 10_000);
      red.push(Number(bands.red.data[i]) / 10_000);
      rededge1.push(Number(bands.rededge1.data[i]) / 10_000);
    }
  }

  const base = {
    waterbody_id: waterbody.id,
    acquired_at: item.datetime,
    scene_id: item.id,
    cloud_cover: item.cloudCover,
    usable_pixels: blue.length,
  };

  // A cloudy or unusable pass is stored as unavailable, never as agreement.
  if (blue.length < SATELLITE_PARAMETERS.minUsablePixels) {
    return { ...base, ndci: null, turbidity: null, forel_ule_equivalent: null, hue_angle: null };
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanRed = mean(red);
  const meanRededge1 = mean(rededge1);
  const hue = reflectanceToHueAngle(mean(blue), mean(green), meanRed);

  return {
    ...base,
    ndci: (meanRededge1 - meanRed) / (meanRededge1 + meanRed),
    turbidity: meanRed,
    forel_ule_equivalent: hueAngleToForelUle(hue),
    hue_angle: hue,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : null;
  const positional = args.filter((a, i) => !a.startsWith("--") && (limitIndex < 0 || i !== limitIndex + 1));
  const [city, monthsArg] = positional;
  if (!city) throw new Error("Usage: ingest.ts <City> [months] [--limit <n>]");
  const months = monthsArg ? Number(monthsArg) : MONTHS_DEFAULT;

  const db = supabaseAdmin();
  const startedAt = Date.now();

  const { data: bboxRows, error: bboxError } = await db.rpc("city_bbox", { p_city: city });
  if (bboxError) throw new Error(bboxError.message);
  const b = (bboxRows as { min_lon: number | null; min_lat: number; max_lon: number; max_lat: number }[])[0];
  if (!b || b.min_lon === null) throw new Error(`${city}: no water bodies found`);

  const end = new Date();
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - months);
  const scenes = leastCloudyPerMonth(
    await searchStac([b.min_lon, b.min_lat, b.max_lon, b.max_lat], start, end),
  );
  if (scenes.length === 0) {
    log(`${city}: no scenes under ${MAX_CLOUD_COVER}% cloud in the last ${months} months`);
    return;
  }
  log(`${city}: ${scenes.length} scenes — ${scenes.map((s) => `${s.datetime.slice(0, 10)} (${s.cloudCover.toFixed(0)}%)`).join(", ")}`);

  const { data: waterbodyRows, error: wbError } = await selectAll((from, to) =>
    db.from("waterbodies").select("id, geometry").eq("city", city).order("id").range(from, to),
  );
  if (wbError) throw new Error(String(wbError));
  const all = waterbodyRows.map((row) => ({
    id: row.id as string,
    coordinates: (row.geometry as { coordinates: [number, number][] }).coordinates,
  }));
  const waterbodies = limit ? all.slice(0, limit) : all;

  let written = 0;
  let unusable = 0;

  for (const item of scenes) {
    const zone = utmZoneFromEpsg(item.epsg);
    const projected = waterbodies.map((w) => ({
      id: w.id,
      line: w.coordinates.map(([lon, lat]) => lonLatToUtm(lon, lat, zone)),
    }));
    const pad = GRID_METRES * SATELLITE_PARAMETERS.windowPixels;
    const box: UtmBox = { minE: Infinity, minN: Infinity, maxE: -Infinity, maxN: -Infinity };
    for (const w of projected) {
      for (const p of w.line) {
        box.minE = Math.min(box.minE, p.easting - pad);
        box.maxE = Math.max(box.maxE, p.easting + pad);
        box.minN = Math.min(box.minN, p.northing - pad);
        box.maxN = Math.max(box.maxN, p.northing + pad);
      }
    }

    let rows: SatelliteRow[];
    try {
      // Bands are read one after another: six city-wide reads in parallel
      // open enough concurrent range requests for S3 to drop connections.
      const rasters: (CityRaster | null)[] = [];
      for (const key of BAND_KEYS) {
        rasters.push(
          await withRetries(async () => {
            const url = item.assets[key];
            if (!url) throw new Error(`missing asset ${key}`);
            const image = await (await fromUrl(url)).getImage();
            return readCityBand(image, box);
          }),
        );
      }
      if (rasters.some((r) => r === null)) throw new Error("scene does not cover the city");
      const bands = Object.fromEntries(BAND_KEYS.map((k, i) => [k, rasters[i]])) as Record<BandKey, CityRaster>;
      rows = projected.map((w) => sampleWaterbody(bands, item, w));
    } catch (error) {
      // An unreadable scene is recorded as unavailable for every water body,
      // never as agreement.
      const cause = error instanceof Error && error.cause ? ` (${String(error.cause)})` : "";
      log(`${city}: ${item.id} unreadable — ${error instanceof Error ? error.message : String(error)}${cause}`);
      rows = projected.map((w) => ({
        waterbody_id: w.id,
        acquired_at: item.datetime,
        scene_id: item.id,
        cloud_cover: item.cloudCover,
        usable_pixels: 0,
        ndci: null,
        turbidity: null,
        forel_ule_equivalent: null,
        hue_angle: null,
      }));
    }

    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const { error } = await db
        .from("satellite_readings")
        .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: "waterbody_id,scene_id" });
      if (error) throw new Error(`upsert: ${error.message}`);
    }
    written += rows.length;
    unusable += rows.filter((r) => r.forel_ule_equivalent === null).length;
    log(`${city}: ${item.datetime.slice(0, 10)} done — ${rows.length - rows.filter((r) => r.forel_ule_equivalent === null).length} usable of ${rows.length}`);
  }

  log(`${city}: ${written} readings (${unusable} unavailable) for ${waterbodies.length} water bodies in ${((Date.now() - startedAt) / 60_000).toFixed(1)} min`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
