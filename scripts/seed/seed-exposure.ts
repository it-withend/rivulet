// Loads the places where people, children and dogs come close to water —
// playgrounds, schools, parks, bathing and fishing spots, allotments — from
// OpenStreetMap for one city, then rebuilds that city's per-water-body
// exposure summary. Safe to re-run.
//
//   npx tsx --env-file=.env.local scripts/seed/seed-exposure.ts <City>
import { supabaseAdmin } from "../../src/lib/db/client";
import {
  ONE_HEALTH_PARAMETERS,
  type ExposureKind,
} from "../../src/lib/science/one-health";

type Point = { lon: number; lat: number };
type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lon?: number;
  lat?: number;
  geometry?: Point[];
  bounds?: { minlon: number; minlat: number; maxlon: number; maxlat: number };
  tags?: Record<string, string>;
};

const BATCH = 500;
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const PAD_DEGREES = 0.005;

function kindOf(tags: Record<string, string>): ExposureKind | null {
  if (tags.leisure === "playground") return "playground";
  if (tags.amenity === "kindergarten") return "kindergarten";
  if (tags.amenity === "school") return "school";
  if (tags.leisure === "dog_park") return "dog_park";
  if (tags.leisure === "swimming_area" || tags.leisure === "bathing_place" || tags.natural === "beach") return "bathing";
  if (tags.leisure === "fishing") return "fishing";
  if (tags.landuse === "allotments") return "allotments";
  if (tags.tourism === "picnic_site") return "picnic";
  if (tags.leisure === "park") return "park";
  return null;
}

function wkt(el: OverpassElement): string | null {
  if (el.type === "node" && el.lon !== undefined && el.lat !== undefined) {
    return `POINT(${el.lon} ${el.lat})`;
  }
  if (el.type === "way" && el.geometry && el.geometry.length > 1) {
    const coords = el.geometry.map((p) => `${p.lon} ${p.lat}`);
    const first = el.geometry[0];
    const last = el.geometry[el.geometry.length - 1];
    const closed = el.geometry.length >= 4 && first.lon === last.lon && first.lat === last.lat;
    return closed ? `POLYGON((${coords.join(",")}))` : `LINESTRING(${coords.join(",")})`;
  }
  // Relations (large parks, school campuses) are approximated by their
  // bounding box, which errs towards counting a site as near.
  if (el.bounds) {
    const b = el.bounds;
    return `POLYGON((${b.minlon} ${b.minlat},${b.maxlon} ${b.minlat},${b.maxlon} ${b.maxlat},${b.minlon} ${b.maxlat},${b.minlon} ${b.minlat}))`;
  }
  return null;
}

async function main() {
  const [city] = process.argv.slice(2);
  if (!city) throw new Error("Usage: seed-exposure.ts <City>");

  const db = supabaseAdmin();
  const { data: bboxRows, error: bboxError } = await db.rpc("city_bbox", { p_city: city });
  const bbox = (bboxRows as { min_lon: number; min_lat: number; max_lon: number; max_lat: number }[] | null)?.[0];
  if (bboxError || !bbox || bbox.min_lon === null) {
    throw new Error(`${city}: no water bodies to take a bounding box from`);
  }

  const box = [
    bbox.min_lat - PAD_DEGREES,
    bbox.min_lon - PAD_DEGREES,
    bbox.max_lat + PAD_DEGREES,
    bbox.max_lon + PAD_DEGREES,
  ].join(",");

  const query = `
    [out:json][timeout:180][bbox:${box}];
    (
      nwr["leisure"~"^(playground|dog_park|swimming_area|bathing_place|fishing|park)$"];
      nwr["amenity"~"^(school|kindergarten)$"];
      nwr["natural"="beach"];
      nwr["landuse"="allotments"];
      nwr["tourism"="picnic_site"];
    );
    out geom;
  `;
  let response: Response | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "User-Agent": "Rivulet/0.1 (IEEE OneAquaHealth hackathon prototype)",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (response.ok) break;
    console.warn(`${endpoint} answered ${response.status}, trying the next mirror`);
  }
  if (!response?.ok) throw new Error("Every Overpass mirror failed");
  const { elements } = (await response.json()) as { elements: OverpassElement[] };

  const rows = elements.flatMap((el) => {
    const kind = el.tags ? kindOf(el.tags) : null;
    const geometry = wkt(el);
    if (!kind || !geometry) return [];
    return [
      {
        osm_id: `${el.type}/${el.id}`,
        city,
        kind,
        name: el.tags?.name ?? null,
        geometry: `SRID=4326;${geometry}`,
      },
    ];
  });

  for (let start = 0; start < rows.length; start += BATCH) {
    const { error } = await db
      .from("exposure_sites")
      .upsert(rows.slice(start, start + BATCH), { onConflict: "osm_id" });
    if (error) throw new Error(`sites ${start}-${start + BATCH}: ${error.message}`);
  }

  const { data: summaryRows, error: refreshError } = await db.rpc("refresh_waterbody_exposure", {
    p_city: city,
    p_radius_m: ONE_HEALTH_PARAMETERS.exposureRadiusM,
  });
  if (refreshError) throw new Error(`refresh: ${refreshError.message}`);

  const byKind = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`${city}: ${rows.length} sites`, byKind, `→ ${summaryRows} water body/kind pairs within ${ONE_HEALTH_PARAMETERS.exposureRadiusM} m`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
