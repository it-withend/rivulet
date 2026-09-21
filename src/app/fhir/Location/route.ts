import { supabaseAnon } from "@/lib/db/client";
import { CITIES } from "@/lib/cities";
import { buildBundle } from "@/lib/fhir/bundle";
import { toLocationOah } from "@/lib/fhir/observation";
import { fhirError, fhirJson } from "@/lib/fhir/http";

const DEFAULT_COUNT = 50;
const MAX_COUNT = 200;

/** Location?city=Coimbra[&_count=50&_offset=0]: the water bodies Rivulet has mapped in a city. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city");
  if (!city) return fhirError(400, "required", "The city search parameter is required");
  if (!CITIES.includes(city)) return fhirError(400, "invalid", `Unknown city; expected one of ${CITIES.join(", ")}`);

  const count = Math.min(Math.max(Number(params.get("_count")) || DEFAULT_COUNT, 1), MAX_COUNT);
  const offset = Math.max(Number(params.get("_offset")) || 0, 0);

  const { data, error } = await supabaseAnon()
    .from("waterbodies")
    .select("id, name, city, centroid")
    .eq("city", city)
    .order("id")
    .range(offset, offset + count - 1);
  if (error) return fhirError(503, "transient", "The database is unavailable");

  const locations = (data ?? []).map((row) => {
    const [lon, lat] = (row.centroid as { coordinates: [number, number] }).coordinates;
    return toLocationOah({ id: row.id, name: row.name, city: row.city, centroidLon: lon, centroidLat: lat });
  });
  return fhirJson(buildBundle(locations, request.url, "Location"), {
    cache: "public, s-maxage=300, stale-while-revalidate=3600",
  });
}
