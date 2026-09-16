"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { colourForClass } from "@/lib/ui/wfd-colours";
import { CONCERN_COLOUR } from "@/lib/ui/one-health-copy";
import type { WfdClass } from "@/lib/science/wfd";
import type { Concern } from "@/lib/science/one-health";

export type MapFeature = {
  id: string;
  name: string;
  klass: WfdClass | null;
  /** Concern for people and animals nearby; "unknown" without recent reports. */
  concern: Concern;
  coordinates: [number, number][];
};

export function CityMap({
  features,
  centre,
  layer = "status",
}: {
  features: MapFeature[];
  centre: [number, number];
  /** "status" colours by ecological status; "health" by concern for people and animals. */
  layer?: "status" | "health";
}) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!container.current) return;

    let map: MapLibreMap | undefined;
    let cancelled = false;
    setLoaded(false);

    // MapLibre reads `window` as soon as its module runs, so it is imported
    // dynamically here rather than at module scope. That keeps it out of the
    // server render entirely — this effect only ever runs in the browser.
    // The package ships pure ESM named exports (no default), so the module
    // namespace itself is the `maplibregl` object.
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !container.current) return;

      // Copied to public/ by scripts/copy-maplibre-worker.mjs on install.
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

      const instance = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: centre,
        zoom: 12,
      });
      map = instance;

      instance.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );

      instance.on("load", () => {
        if (!cancelled) setLoaded(true);
        instance.addSource("waterbodies", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: features.map((f) => ({
              type: "Feature",
              id: f.id,
              properties: {
                id: f.id,
                name: f.name,
                colour:
                  layer === "health"
                    ? CONCERN_COLOUR[f.concern]
                    : colourForClass(f.klass),
                hasClass:
                  layer === "health" ? f.concern !== "unknown" : f.klass !== null,
              },
              geometry: { type: "LineString", coordinates: f.coordinates },
            })),
          },
        });

        // line-dasharray does not accept data-driven expressions, so assessed
        // and unassessed water bodies are drawn as two filtered layers.
        instance.addLayer({
          id: "waterbody-assessed",
          type: "line",
          source: "waterbodies",
          filter: ["==", ["get", "hasClass"], true],
          paint: { "line-color": ["get", "colour"], "line-width": 4 },
        });

        instance.addLayer({
          id: "waterbody-unassessed",
          type: "line",
          source: "waterbodies",
          filter: ["==", ["get", "hasClass"], false],
          paint: {
            "line-color": ["get", "colour"],
            "line-width": 3,
            "line-dasharray": [2, 2],
          },
        });

        for (const layer of ["waterbody-assessed", "waterbody-unassessed"]) {
          instance.on("click", layer, (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (id) window.location.href = `/water/${id}`;
          });
          instance.on("mouseenter", layer, () => {
            instance.getCanvas().style.cursor = "pointer";
          });
          instance.on("mouseleave", layer, () => {
            instance.getCanvas().style.cursor = "";
          });
        }
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [features, centre, layer]);

  return (
    <div className="relative h-[70vh] w-full">
      <div
        ref={container}
        role="application"
        aria-label="Map of urban streams"
        className="h-full w-full rounded-md border border-rule"
      />
      {!loaded && (
        <div
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center rounded-md border border-rule bg-paper-raised"
        >
          <p className="field-label m-0">Loading map…</p>
        </div>
      )}
    </div>
  );
}
