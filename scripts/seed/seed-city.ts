// Loads one city's water network straight from OpenStreetMap, for cities whose
// fetch failed during the main seed (Overpass rate limits). Observations are
// not seeded: a newly loaded city starts with honest insufficient-data states.
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../../src/lib/db/client";

type OverpassWay = {
  tags?: { name?: string; waterway?: string };
  geometry?: { lon: number; lat: number }[];
};

const BATCH = 250;

async function main() {
  const [city, adminLevel] = process.argv.slice(2);
  if (!city || !adminLevel) throw new Error("Usage: seed-city.ts <City> <admin_level>");

  const db = supabaseAdmin();
  const { count, error: countError } = await db
    .from("waterbodies")
    .select("id", { count: "exact", head: true })
    .eq("city", city);
  if (countError) throw new Error(countError.message);
  if (count) throw new Error(`${city} already has ${count} water bodies`);

  const query = `
    [out:json][timeout:90];
    area["name"="${city}"]["boundary"="administrative"]["admin_level"="${adminLevel}"]->.a;
    (way["waterway"~"^(river|stream)$"](area.a););
    out geom;
  `;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "User-Agent": "Rivulet/0.1 (IEEE OneAquaHealth hackathon prototype)",
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`Overpass answered ${response.status}`);
  const { elements } = (await response.json()) as { elements: OverpassWay[] };

  const rows = elements
    .filter((el) => el.geometry && el.geometry.length > 1)
    .map((el) => {
      const coordinates = el.geometry!.map((p) => [p.lon, p.lat]);
      const mid = coordinates[Math.floor(coordinates.length / 2)];
      return {
        id: randomUUID(),
        name: el.tags?.name ?? `Unnamed ${el.tags?.waterway ?? "stream"}`,
        city,
        kind: el.tags?.waterway === "river" ? "river" : "stream",
        geometry: `SRID=4326;LINESTRING(${coordinates.map((c) => `${c[0]} ${c[1]}`).join(",")})`,
        centroid: `SRID=4326;POINT(${mid[0]} ${mid[1]})`,
      };
    });
  if (rows.length === 0) throw new Error(`${city}: no waterways found at admin_level ${adminLevel}`);

  for (let start = 0; start < rows.length; start += BATCH) {
    const { error } = await db.from("waterbodies").insert(rows.slice(start, start + BATCH));
    if (error) throw new Error(`rows ${start}-${start + BATCH}: ${error.message}`);
  }
  console.log(`${city}: inserted ${rows.length} water bodies`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
