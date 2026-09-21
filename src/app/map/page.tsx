import { MapExplorer } from "@/components/map/MapExplorer";
import { CITY_CENTRES, DEFAULT_CITY } from "@/lib/cities";
import type { MapLayer } from "@/lib/ui/map-layers";

export const metadata = {
  title: "Map — Rivulet",
};

/**
 * A light shell: the page renders at once and MapExplorer fetches the city's
 * data from a cached route, so switching city or colour layer never reloads it.
 */
export default async function MapPage(props: PageProps<"/map">) {
  const searchParams = await props.searchParams;
  const cityParam = searchParams.city;
  const requested = Array.isArray(cityParam) ? cityParam[0] : cityParam;
  const city = requested && CITY_CENTRES[requested] ? requested : DEFAULT_CITY;
  const layerParam = searchParams.layer;
  const requestedLayer = Array.isArray(layerParam) ? layerParam[0] : layerParam;
  const layer: MapLayer =
    requestedLayer === "health" || requestedLayer === "divergence" ? requestedLayer : "status";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <MapExplorer initialCity={city} initialLayer={layer} />
    </div>
  );
}
