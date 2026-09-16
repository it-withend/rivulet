import { CityMap, type MapFeature } from "@/components/map/CityMap";
import { loadCityStreams } from "@/lib/city-data";
import { CITIES, CITY_CENTRES, DEFAULT_CITY } from "@/lib/cities";
import { LEGEND, MAP_LAYERS, type MapLayer } from "@/lib/ui/map-layers";
import { Camera, HeartPulse, Leaf, MousePointerClick, Satellite } from "lucide-react";
import { LinkChip as CityChip } from "@/components/ui/LinkChip";

export default async function MapPage(props: PageProps<"/map">) {
  const searchParams = await props.searchParams;
  const cityParam = searchParams.city;
  const requested = Array.isArray(cityParam) ? cityParam[0] : cityParam;
  const city = requested && CITY_CENTRES[requested] ? requested : DEFAULT_CITY;
  const centre = CITY_CENTRES[city];
  const layerParam = searchParams.layer;
  const requestedLayer = Array.isArray(layerParam) ? layerParam[0] : layerParam;
  const layer: MapLayer =
    requestedLayer === "health" || requestedLayer === "divergence"
      ? requestedLayer
      : "status";

  const { streams, hasSynthetic, failed } = await loadCityStreams(city);

  const features: MapFeature[] = failed
    ? []
    : streams.map((stream) => ({
        id: stream.id,
        name: stream.name,
        klass: stream.snapshot.assessment.klass,
        concern: stream.oneHealth.overall,
        diverged: stream.snapshot.divergence?.diverged ?? null,
        coordinates: stream.coordinates,
      }));

  const checked = features.filter((f) => f.klass !== null).length;
  const layerIcon = { status: Leaf, health: HeartPulse, divergence: Satellite } as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="field-label m-0">Map</p>
      <h1 className="mt-2 mb-2 text-4xl">Streams in {city}</h1>
      <p className="mt-0 mb-5 max-w-2xl text-ink-muted">
        {features.length === 0
          ? "The water network for this city has not been loaded yet."
          : `${checked} of ${features.length} stream sections have enough reports from neighbours to rate. Every grey dashed line is a stream nobody has checked recently.`}
      </p>

      <nav aria-label="Cities" className="mb-4 flex flex-wrap gap-2">
        {CITIES.map((name) => (
          <CityChip
            key={name}
            href={`/map?city=${name}${layer === "status" ? "" : `&layer=${layer}`}`}
            active={name === city}
          >
            {name}
          </CityChip>
        ))}
      </nav>

      <nav aria-label="What the colours show" className="mb-4">
        <p className="field-label mb-2">What should the colours show?</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MAP_LAYERS) as MapLayer[]).map((key) => {
            const Icon = layerIcon[key];
            return (
              <CityChip
                key={key}
                href={`/map?city=${city}${key === "status" ? "" : `&layer=${key}`}`}
                active={layer === key}
              >
                <Icon aria-hidden="true" className="size-4" />
                {MAP_LAYERS[key].label}
              </CityChip>
            );
          })}
        </div>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
        <CityMap features={features} centre={centre} layer={layer} />

        <aside aria-label="How to read this map" className="space-y-4">
          <div className="rounded-md border border-rule bg-paper-raised p-4">
            <p className="m-0 text-sm font-medium">{MAP_LAYERS[layer].question}</p>
            <ul className="m-0 mt-3 list-none space-y-2 p-0 text-sm">
              {LEGEND[layer].map((entry) => (
                <li key={entry.label} className="flex items-center gap-2.5">
                  <svg aria-hidden="true" width="28" height="10" viewBox="0 0 28 10" className="shrink-0">
                    <line
                      x1="2" y1="5" x2="26" y2="5"
                      stroke={entry.colour}
                      strokeWidth={entry.dashed ? 3 : 5}
                      strokeLinecap="round"
                      strokeDasharray={entry.dashed ? "4 3" : undefined}
                    />
                  </svg>
                  {entry.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-rule bg-paper-raised p-4 text-sm">
            <p className="field-label m-0">How to use it</p>
            <ol className="m-0 mt-2 list-none space-y-2 p-0">
              <li className="flex gap-2">
                <MousePointerClick aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Tap any line to see that stream.
              </li>
              <li className="flex gap-2">
                <Camera aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                At the water? Press &ldquo;Check a stream&rdquo; — it takes about two minutes.
              </li>
            </ol>
          </div>

          {hasSynthetic && (
            <p className="m-0 text-xs text-ink-muted">
              Coimbra includes demonstration reports while the pilot collects real
              ones. They are labelled as test data everywhere they are exported.
            </p>
          )}
        </aside>
      </div>

      <p className="mt-3 max-w-3xl text-xs text-ink-muted">
        {layer === "health"
          ? "Combines warning signs neighbours reported in the last 30 days with playgrounds, schools, parks and bathing spots within 150 m. A prompt to take care, not a public health assessment."
          : layer === "divergence"
            ? "Compares the water colour residents photograph with the latest Sentinel-2 pass. Most urban streams are narrower than a satellite pixel, so most lines stay grey — that is honest, not missing data."
            : "Ratings come from what residents see and smell, weighted by how reliable each report is. They are an early signal, not a laboratory measurement."}
      </p>
    </div>
  );
}
