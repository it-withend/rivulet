"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { colourForClass, colourForDivergence, PLAIN_CLASS_LABEL } from "@/lib/ui/wfd-colours";
import { CONCERN_COLOUR, CONCERN_LABEL } from "@/lib/ui/one-health-copy";
import type { MapLayer } from "@/lib/ui/map-layers";
import type { WfdClass } from "@/lib/science/wfd";
import type { Concern } from "@/lib/science/one-health";

export type MapFeature = {
  id: string;
  name: string;
  klass: WfdClass | null;
  /** Concern for people and animals nearby; "unknown" without recent reports. */
  concern: Concern;
  /** Current citizen-satellite divergence; null when there is no usable satellite pass to compare. */
  diverged: boolean | null;
  coordinates: [number, number][];
};

function describe(feature: MapFeature, layer: MapLayer): { colour: string; text: string; known: boolean } {
  if (layer === "health") {
    return {
      colour: CONCERN_COLOUR[feature.concern],
      text: CONCERN_LABEL[feature.concern],
      known: feature.concern !== "unknown",
    };
  }
  if (layer === "divergence") {
    return {
      colour: colourForDivergence(feature.diverged),
      text:
        feature.diverged === null
          ? "No clear satellite view"
          : feature.diverged
            ? "Satellite sees something different"
            : "Satellite agrees with residents",
      known: feature.diverged !== null,
    };
  }
  return {
    colour: colourForClass(feature.klass),
    text: feature.klass ? PLAIN_CLASS_LABEL[feature.klass] : "Not checked enough yet",
    known: feature.klass !== null,
  };
}

function toGeoJson(features: MapFeature[], layer: MapLayer) {
  return {
    type: "FeatureCollection" as const,
    features: features.map((f) => {
      const { colour, known } = describe(f, layer);
      return {
        type: "Feature" as const,
        properties: { id: f.id, colour, known },
        geometry: { type: "LineString" as const, coordinates: f.coordinates },
      };
    }),
  };
}

/** Popup content built with DOM APIs, never HTML strings, because stream names come from OpenStreetMap. */
function popupContent(feature: MapFeature, layer: MapLayer): HTMLElement {
  const { colour, text, known } = describe(feature, layer);
  const root = document.createElement("div");
  root.className = "rivulet-popup";

  const name = document.createElement("p");
  name.className = "rivulet-popup-name";
  name.textContent = feature.name;

  const status = document.createElement("p");
  status.className = "rivulet-popup-status";
  const dot = document.createElement("span");
  dot.className = "rivulet-popup-dot";
  dot.style.backgroundColor = colour;
  status.append(dot, document.createTextNode(text));

  const actions = document.createElement("div");
  actions.className = "rivulet-popup-actions";
  const details = document.createElement("a");
  details.href = `/water/${feature.id}`;
  details.textContent = "See details";
  const record = document.createElement("a");
  record.href = `/observe?waterbody=${feature.id}`;
  record.textContent = known ? "Add what you see" : "Be the first to check";
  record.className = "rivulet-popup-primary";
  actions.append(details, record);

  root.append(name, status, actions);
  return root;
}

/**
 * The map is created once. Changing city or colour layer only swaps the line
 * data and moves the camera, so it takes a moment instead of rebuilding the
 * whole map; `busy` shows a message while the next city's data is on its way.
 */
export function CityMap({
  features,
  centre,
  layer = "status",
  busy = null,
}: {
  features: MapFeature[];
  centre: [number, number];
  layer?: MapLayer;
  busy?: string | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latest = useRef({ features, layer, centre });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    latest.current = { features, layer, centre };
  }, [features, layer, centre]);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;

    let cancelled = false;

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
        center: latest.current.centre,
        zoom: 12,
      });
      mapRef.current = instance;

      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance.addControl(
        new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
        "top-right",
      );

      instance.on("load", () => {
        if (cancelled) return;
        instance.addSource("waterbodies", {
          type: "geojson",
          data: toGeoJson(latest.current.features, latest.current.layer),
        });

        // line-dasharray does not accept data-driven expressions, so streams
        // with and without a signal are drawn as two filtered layers. A wide,
        // invisible hit layer underneath makes thin lines easy to tap.
        instance.addLayer({
          id: "waterbody-hit",
          type: "line",
          source: "waterbodies",
          paint: { "line-color": "#000", "line-opacity": 0, "line-width": 18 },
        });
        instance.addLayer({
          id: "waterbody-casing",
          type: "line",
          source: "waterbodies",
          filter: ["==", ["get", "known"], true],
          paint: { "line-color": "#151b1c", "line-width": 7, "line-opacity": 0.35 },
        });
        instance.addLayer({
          id: "waterbody-assessed",
          type: "line",
          source: "waterbodies",
          filter: ["==", ["get", "known"], true],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ["get", "colour"], "line-width": 5 },
        });
        instance.addLayer({
          id: "waterbody-unassessed",
          type: "line",
          source: "waterbodies",
          filter: ["==", ["get", "known"], false],
          paint: {
            "line-color": ["get", "colour"],
            "line-width": 3,
            "line-dasharray": [2, 1.5],
          },
        });

        const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" });

        instance.on("click", "waterbody-hit", (event) => {
          const id = event.features?.[0]?.properties?.id;
          const { features: current, layer: currentLayer } = latest.current;
          const feature = id ? current.find((f) => f.id === id) : undefined;
          if (!feature) return;
          popup.setLngLat(event.lngLat).setDOMContent(popupContent(feature, currentLayer)).addTo(instance);
        });

        // Deliberately no per-feature "mouseenter"/"mouseleave" cursor hint:
        // that re-runs a hit test on every mousemove across the whole map,
        // and with thousands of thin OpenStreetMap segments (Oslo alone has
        // 2,549) that queues up enough work that a click can feel like it
        // takes seconds to register. The whole map is one big tap target —
        // see the ".maplibregl-canvas-container" rule in globals.css for the
        // static pointer cursor that gives the same affordance for free.
        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // New data or a new colour layer: swap the lines, keep the map.
  useEffect(() => {
    const source = mapRef.current?.getSource("waterbodies") as GeoJSONSource | undefined;
    source?.setData(toGeoJson(features, layer));
  }, [features, layer, ready]);

  // A different city: move the camera.
  useEffect(() => {
    mapRef.current?.jumpTo({ center: centre, zoom: 12 });
  }, [centre, ready]);

  return (
    <div className="relative h-[62vh] min-h-80 w-full">
      <div
        ref={container}
        role="application"
        aria-label="Map of urban streams. Tap a stream to see how it is doing."
        className="h-full w-full rounded-md border border-rule"
      />
      {(!ready || busy) && (
        <div
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center rounded-md border border-rule bg-paper-raised/85"
        >
          <p className="field-label m-0">{busy ?? "Loading map…"}</p>
        </div>
      )}
    </div>
  );
}
