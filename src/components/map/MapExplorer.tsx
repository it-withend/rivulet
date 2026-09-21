"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, HeartPulse, Leaf, MousePointerClick, Satellite, Sparkles } from "lucide-react";
import { CityMap, type MapFeature } from "@/components/map/CityMap";
import { Button } from "@/components/ui/Button";
import { CITIES, CITY_CENTRES } from "@/lib/cities";
import type { CityMapPayload } from "@/lib/city-map-data";
import { LEGEND, MAP_LAYERS, type MapLayer } from "@/lib/ui/map-layers";

const LAYER_ICON = { status: Leaf, health: HeartPulse, divergence: Satellite } as const;
const NO_FEATURES: MapFeature[] = [];

const chip = (active: boolean) =>
  "inline-flex min-h-11 items-center gap-2 rounded-sm border px-3.5 py-2 " +
  "font-sans text-[0.9375rem] leading-tight transition-colors duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
  (active ? "border-ink bg-ink text-paper" : "border-rule-strong bg-paper-raised text-ink hover:border-ink");

/**
 * The map page's interactive part. City and colour layer are ordinary state,
 * so pressing a chip responds at once; a city's data comes from a cached JSON
 * route and is remembered, and hovering a city chip fetches it ahead of the click.
 */
export function MapExplorer({ initialCity, initialLayer }: { initialCity: string; initialLayer: MapLayer }) {
  const [city, setCity] = useState(initialCity);
  const [layer, setLayer] = useState<MapLayer>(initialLayer);
  const [data, setData] = useState<Record<string, CityMapPayload>>({});
  const [failedCity, setFailedCity] = useState<string | null>(null);
  const requested = useRef(new Set<string>());

  const load = useCallback((name: string, force = false) => {
    if (!force && requested.current.has(name)) return;
    requested.current.add(name);
    fetch(`/api/city/${name}/map`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<CityMapPayload>;
      })
      .then((payload) => {
        setData((current) => ({ ...current, [name]: payload }));
        setFailedCity((current) => (current === name ? null : current));
      })
      .catch(() => {
        requested.current.delete(name);
        setFailedCity(name);
      });
  }, []);

  useEffect(() => {
    load(city);
  }, [city, load]);

  // Keep the address shareable without a navigation.
  useEffect(() => {
    const query = `?city=${city}${layer === "status" ? "" : `&layer=${layer}`}`;
    window.history.replaceState(window.history.state, "", `/map${query}`);
  }, [city, layer]);

  const payload = data[city];
  const features = payload?.features ?? NO_FEATURES;
  const checked = payload?.checked ?? 0;
  const failed = failedCity === city && !payload;
  const busy = payload ? null : failed ? null : `Loading ${city}…`;

  return (
    <>
      <p className="field-label m-0">Map</p>
      <h1 className="mt-2 mb-2 text-4xl">Streams in {city}</h1>
      <p className="mt-0 mb-5 min-h-12 max-w-2xl text-ink-muted" aria-live="polite">
        {!payload
          ? failed
            ? "We could not load this city just now."
            : `Loading the streams of ${city}…`
          : features.length === 0
            ? "The water network for this city has not been loaded yet."
            : `${checked} of ${features.length} stream sections have enough reports from neighbours to rate. Every grey dashed line is a stream nobody has checked recently.`}
        {failed && (
          <>
            {" "}
            <button type="button" onClick={() => load(city, true)} className="underline underline-offset-2 hover:text-river">
              Try again
            </button>
          </>
        )}
      </p>

      <nav aria-label="Cities" className="mb-4 flex flex-wrap gap-2">
        {CITIES.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={name === city}
            className={chip(name === city)}
            onClick={() => setCity(name)}
            onPointerEnter={() => load(name)}
            onFocus={() => load(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      {payload && checked === 0 && features.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-river/40 bg-paper-raised p-4">
          <p className="m-0 flex items-center gap-2 text-sm">
            <Sparkles aria-hidden="true" className="size-4 shrink-0 text-river" />
            {city} was just added — its {features.length} stream sections are mapped, but nobody has
            reported yet. That grey isn&apos;t a bug, it&apos;s an open invitation.
          </p>
          <Button href="/observe" variant="secondary" className="shrink-0">
            Be the first to check
          </Button>
        </div>
      )}

      <nav aria-label="What the colours show" className="mb-4">
        <p className="field-label mb-2">What should the colours show?</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MAP_LAYERS) as MapLayer[]).map((key) => {
            const Icon = LAYER_ICON[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={layer === key}
                className={chip(layer === key)}
                onClick={() => setLayer(key)}
              >
                <Icon aria-hidden="true" className="size-4" />
                {MAP_LAYERS[key].label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
        <CityMap features={features} centre={CITY_CENTRES[city]} layer={layer} busy={busy} />

        <aside aria-label="How to read this map" className="space-y-4">
          <div className="rounded-md border border-rule bg-paper-raised p-4">
            <p className="m-0 text-sm font-medium">{MAP_LAYERS[layer].question}</p>
            <ul className="m-0 mt-3 list-none space-y-2 p-0 text-sm">
              {LEGEND[layer].map((entry) => (
                <li key={entry.label} className="flex items-center gap-2.5">
                  <svg aria-hidden="true" width="28" height="10" viewBox="0 0 28 10" className="shrink-0">
                    <line
                      x1="2"
                      y1="5"
                      x2="26"
                      y2="5"
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

          {payload?.hasSynthetic && (
            <p className="m-0 text-xs text-ink-muted">
              {city} includes demonstration reports while the pilot collects real ones. They are labelled as test
              data everywhere they are exported.
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
    </>
  );
}
