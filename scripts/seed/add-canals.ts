// Tops up a city's water network with `waterway=canal` ways, which
// fetch-waterbodies.ts (the original seed) never fetched — it only queried
// river|stream. Coimbra, Toulouse, Oslo and Gent are missing real canals as a
// result (Ghent in particular is known for them); seed-city.ts already
// includes canals for cities added after that gap was found (e.g. Tashkent).
// Safe to run once per city: it only ever queries `waterway=canal`, a kind
// the original seed never touched, so it cannot duplicate an existing row.
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../../src/lib/db/client";

type OverpassWay = {
  tags?: { name?: string };
  geometry?: { lon: number; lat: number }[];
};

const BATCH = 250;
const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

type OverpassResponse = { elements: OverpassWay[]; remark?: string };

async function queryOverpass(query: string): Promise<OverpassResponse> {
  let lastProblem = "";
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "User-Agent": "Rivulet/0.1 (IEEE OneAquaHealth hackathon prototype)",
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) {
        lastProblem = String(response.status);
        console.warn(`${endpoint} answered ${response.status}, trying the next mirror`);
        continue;
      }
      const body = (await response.json()) as OverpassResponse;
      // A timed-out query can come back as HTTP 200 with an empty result and
      // a `remark` explaining why — that must not be read as "found nothing".
      if (body.remark) {
        lastProblem = body.remark;
        console.warn(`${endpoint}: ${body.remark}, trying the next mirror`);
        continue;
      }
      return body;
    } catch (error) {
      lastProblem = (error as Error).message;
      console.warn(`${endpoint}: ${lastProblem}, trying the next mirror`);
    }
  }
  throw new Error(`Every Overpass mirror failed (${lastProblem})`);
}

async function main() {
  const [city, adminLevel, osmNameOrBbox = city] = process.argv.slice(2);
  if (!city || !adminLevel) {
    throw new Error(
      "Usage: add-canals.ts <City> <admin_level> [OSM area name]\n" +
        "   or: add-canals.ts <City> bbox <south,west,north,east>  " +
        "(when the named-area query is too expensive for the public Overpass mirrors, as it is for Gent)",
    );
  }

  const db = supabaseAdmin();
  const { count: existingCanals, error: countError } = await db
    .from("waterbodies")
    .select("id", { count: "exact", head: true })
    .eq("city", city)
    .eq("kind", "river")
    .ilike("name", "%canal%");
  if (countError) throw new Error(countError.message);
  if (existingCanals) {
    console.warn(`${city} already has ${existingCanals} rows named like a canal — check before re-running`);
  }

  const query =
    adminLevel === "bbox"
      ? `[out:json][timeout:60];\nway["waterway"="canal"](${osmNameOrBbox});\nout geom;`
      : `
    [out:json][timeout:120];
    area["name"="${osmNameOrBbox}"]["boundary"="administrative"]["admin_level"="${adminLevel}"]->.a;
    (way["waterway"="canal"](area.a););
    out geom;
  `;
  const { elements } = await queryOverpass(query);

  const rows = elements
    .filter((el) => el.geometry && el.geometry.length > 1)
    .map((el) => {
      const coordinates = el.geometry!.map((p) => [p.lon, p.lat]);
      const mid = coordinates[Math.floor(coordinates.length / 2)];
      return {
        id: randomUUID(),
        // The schema has no canal kind; a canal is closest to a river (same convention as seed-city.ts).
        name: el.tags?.name ?? "Unnamed canal",
        city,
        kind: "river" as const,
        geometry: `SRID=4326;LINESTRING(${coordinates.map((c) => `${c[0]} ${c[1]}`).join(",")})`,
        centroid: `SRID=4326;POINT(${mid[0]} ${mid[1]})`,
      };
    });

  if (rows.length === 0) {
    console.log(`${city}: no canals found at admin_level ${adminLevel} — nothing to add`);
    return;
  }

  for (let start = 0; start < rows.length; start += BATCH) {
    const { error } = await db.from("waterbodies").insert(rows.slice(start, start + BATCH));
    if (error) throw new Error(`rows ${start}-${start + BATCH}: ${error.message}`);
  }
  console.log(`${city}: inserted ${rows.length} canals`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
