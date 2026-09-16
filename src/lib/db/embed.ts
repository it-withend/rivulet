// The untyped Supabase client (no generated Database types) infers embedded
// to-one relations as arrays even though PostgREST returns a single object
// (or null) for a many-to-one embed like `observations.observer_id ->
// observers.id`. These helpers read the real runtime shape.

type Embed<T> = T | T[] | null | undefined;

export function firstOrSelf<T>(value: Embed<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Reads `trust_score` off an `observers(trust_score)` embed. */
export function embeddedTrustScore(
  observers: Embed<{ trust_score: number | string | null }>,
): number | undefined {
  const row = firstOrSelf(observers);
  return row?.trust_score != null ? Number(row.trust_score) : undefined;
}

/** Reads `city` off a `waterbodies(city)` / `waterbodies!inner(city)` embed. */
export function embeddedCity(waterbodies: Embed<{ city: string }>): string | undefined {
  return firstOrSelf(waterbodies)?.city;
}
