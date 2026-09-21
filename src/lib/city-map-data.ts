import { loadCityStreams } from "@/lib/city-data";
import type { MapFeature } from "@/components/map/CityMap";

export type CityMapPayload = {
  features: MapFeature[];
  /** Stream sections with enough reports to rate. */
  checked: number;
  hasSynthetic: boolean;
  failed: boolean;
};

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; payload: CityMapPayload }>();
const inFlight = new Map<string, Promise<CityMapPayload>>();

/** About a metre; plenty for a map line and a third smaller on the wire. */
const round = (n: number) => Math.round(n * 1e5) / 1e5;

async function compute(city: string): Promise<CityMapPayload> {
  const { streams, hasSynthetic, failed } = await loadCityStreams(city);
  const features: MapFeature[] = failed
    ? []
    : streams.map((stream) => ({
        id: stream.id,
        name: stream.name,
        klass: stream.snapshot.assessment.klass,
        concern: stream.oneHealth.overall,
        diverged: stream.snapshot.divergence?.diverged ?? null,
        coordinates: stream.coordinates.map(([x, y]) => [round(x), round(y)] as [number, number]),
      }));
  return {
    features,
    checked: features.filter((f) => f.klass !== null).length,
    hasSynthetic,
    failed,
  };
}

/**
 * What the map needs for one city, computed once and reused: a warm server
 * instance answers from memory, concurrent requests share one computation,
 * and a failed load is never remembered.
 */
export async function loadCityMapPayload(city: string): Promise<CityMapPayload> {
  const hit = cache.get(city);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.payload;

  let pending = inFlight.get(city);
  if (!pending) {
    pending = compute(city)
      .then((payload) => {
        if (!payload.failed) cache.set(city, { at: Date.now(), payload });
        return payload;
      })
      .finally(() => inFlight.delete(city));
    inFlight.set(city, pending);
  }
  return pending;
}
