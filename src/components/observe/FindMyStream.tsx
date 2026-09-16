"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

type NearbyWaterbody = { id: string; name: string; city: string; distanceM: number };
type SearchResult = { id: string; name: string; city: string };

type Stage =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "nearby"; results: NearbyWaterbody[] }
  | { kind: "search" }
  | { kind: "error"; message: string };

/**
 * The map-less entry point into the observation wizard (Task 19.3):
 * geolocate, list the nearest known water bodies, and fall back to a name
 * search if geolocation is denied, fails, or turns up nothing nearby. Every
 * empty state says plainly why it is empty rather than looking broken.
 */
export function FindMyStream() {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function findNearby() {
    setStage({ kind: "locating" });

    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!("geolocation" in navigator)) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        enableHighAccuracy: true,
        timeout: 8000,
      });
    });

    if (!position) {
      setStage({ kind: "search" });
      return;
    }

    try {
      const response = await fetch(
        `/api/waterbodies/nearest?lon=${position.coords.longitude}&lat=${position.coords.latitude}`,
      );
      if (!response.ok) {
        setStage({
          kind: "error",
          message: "We could not look up nearby streams. Please try the name search below.",
        });
        return;
      }
      const body = (await response.json()) as { waterbodies: NearbyWaterbody[] };
      setStage({ kind: "nearby", results: body.waterbodies });
    } catch {
      setStage({
        kind: "error",
        message: "We could not look up nearby streams. Please try the name search below.",
      });
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(`/api/waterbodies/search?q=${encodeURIComponent(trimmed)}`);
      const body = response.ok ? ((await response.json()) as { waterbodies: SearchResult[] }) : { waterbodies: [] };
      setSearchResults(body.waterbodies);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  const showSearch = stage.kind === "search" || stage.kind === "error" || (stage.kind === "nearby" && stage.results.length === 0);

  return (
    <div className="space-y-4">
      {stage.kind === "idle" && (
        <Button onClick={findNearby}>Find the stream you are at</Button>
      )}

      {stage.kind === "locating" && (
        <p aria-live="polite" className="m-0 text-sm text-ink-muted">
          Finding your location…
        </p>
      )}

      {stage.kind === "error" && (
        <Panel>
          <p className="m-0 text-sm">{stage.message}</p>
        </Panel>
      )}

      {stage.kind === "nearby" && stage.results.length > 0 && (
        <div className="space-y-2">
          <p className="field-label m-0">Nearest streams</p>
          <ul className="m-0 list-none space-y-1 p-0">
            {stage.results.map((w) => (
              <li key={w.id} className="border-b border-rule pb-2">
                <Link href={`/observe?waterbody=${w.id}`} className="text-ink">
                  {w.name}
                </Link>
                <span className="num ml-2 text-sm text-ink-muted">
                  {w.city} · {w.distanceM} m
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stage.kind === "nearby" && stage.results.length === 0 && (
        <p className="m-0 text-sm text-ink-muted">
          No known water bodies were found near you. Rivulet only tracks
          streams in its five pilot cities — try the name search below
          instead.
        </p>
      )}

      {stage.kind === "search" && (
        <p className="m-0 text-sm text-ink-muted">
          We could not use your location — search for your stream by name
          instead.
        </p>
      )}

      {showSearch && (
        <form onSubmit={search} className="space-y-2">
          <label className="flex flex-col gap-1 text-sm">
            Search by name
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Mondego"
              className="min-h-11 rounded-sm border border-rule-strong bg-paper px-3 py-2 text-ink"
            />
          </label>
          <Button type="submit" variant="secondary" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </Button>

          {searchResults !== null && searchResults.length === 0 && (
            <p className="m-0 text-sm text-ink-muted">
              No water body matched that name in a Rivulet pilot city.
            </p>
          )}

          {searchResults !== null && searchResults.length > 0 && (
            <ul className="m-0 list-none space-y-1 p-0">
              {searchResults.map((w) => (
                <li key={w.id} className="border-b border-rule pb-2">
                  <Link href={`/observe?waterbody=${w.id}`} className="text-ink">
                    {w.name}
                  </Link>
                  <span className="num ml-2 text-sm text-ink-muted">{w.city}</span>
                </li>
              ))}
            </ul>
          )}
        </form>
      )}
    </div>
  );
}
