import { supabaseAnon } from "@/lib/db/client";
import { toLocationOah } from "@/lib/fhir/observation";
import { fhirError, fhirJson, referenceId } from "@/lib/fhir/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = referenceId((await params).id, "Location");
  if (!id) return fhirError(404, "not-found", "No such Location");

  const { data, error } = await supabaseAnon()
    .from("waterbodies")
    .select("id, name, city, centroid")
    .eq("id", id)
    .maybeSingle();
  if (error) return fhirError(503, "transient", "The database is unavailable");
  if (!data) return fhirError(404, "not-found", "No such Location");

  const [lon, lat] = (data.centroid as { coordinates: [number, number] }).coordinates;
  return fhirJson(
    toLocationOah({ id: data.id, name: data.name, city: data.city, centroidLon: lon, centroidLat: lat }),
    { cache: "public, s-maxage=300, stale-while-revalidate=3600" },
  );
}
