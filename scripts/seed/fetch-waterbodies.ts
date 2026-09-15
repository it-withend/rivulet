const CITIES: { name: string; adminLevel: number }[] = [
  { name: "Coimbra", adminLevel: 7 },
  { name: "Toulouse", adminLevel: 8 },
  { name: "Benevento", adminLevel: 8 },
  { name: "Gent", adminLevel: 8 },
  { name: "Oslo", adminLevel: 7 },
];

const ENDPOINT = "https://overpass-api.de/api/interpreter";

type OverpassWay = {
  tags?: { name?: string; waterway?: string };
  geometry?: { lon: number; lat: number }[];
};

async function fetchCity(city: { name: string; adminLevel: number }) {
  const query = `
    [out:json][timeout:90];
    area["name"="${city.name}"]["boundary"="administrative"]["admin_level"="${city.adminLevel}"]->.a;
    (
      way["waterway"~"^(river|stream)$"](area.a);
    );
    out geom;
  `;
  const response = await fetch(ENDPOINT, { method: "POST", body: query });
  if (!response.ok) throw new Error(`${city.name}: ${response.status}`);
  const data = (await response.json()) as { elements: OverpassWay[] };

  return data.elements
    .filter((el) => el.geometry && el.geometry.length > 1)
    .map((el) => ({
      name: el.tags?.name ?? `Unnamed ${el.tags?.waterway ?? "stream"}`,
      city: city.name,
      kind: el.tags?.waterway === "river" ? "river" : "stream",
      coordinates: el.geometry!.map((p) => [p.lon, p.lat]),
    }));
}

async function fetchCityWithRetry(city: { name: string; adminLevel: number }) {
  try {
    return await fetchCity(city);
  } catch (err) {
    console.warn(`${city.name}: first attempt failed (${(err as Error).message}), retrying once after 10s...`);
    await new Promise((r) => setTimeout(r, 10_000));
    return await fetchCity(city);
  }
}

async function main() {
  const all: Awaited<ReturnType<typeof fetchCity>> = [];
  const failed: string[] = [];
  for (const city of CITIES) {
    console.log(`Fetching ${city.name} (admin_level=${city.adminLevel})...`);
    try {
      const ways = await fetchCityWithRetry(city);
      console.log(`  ${city.name}: ${ways.length} ways`);
      if (ways.length === 0) {
        console.warn(`  WARNING: ${city.name} returned 0 ways at admin_level=${city.adminLevel}`);
      }
      all.push(...ways);
    } catch (err) {
      console.error(`  FAILED: ${city.name}: ${(err as Error).message}`);
      failed.push(city.name);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  const fs = await import("node:fs/promises");
  await fs.writeFile(
    "scripts/seed/waterbodies.json",
    JSON.stringify(all, null, 2),
  );
  console.log(`Wrote ${all.length} water bodies`);
  if (failed.length > 0) {
    console.error(`Cities that failed after one retry: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

main();
