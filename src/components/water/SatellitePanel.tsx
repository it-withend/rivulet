import { Panel } from "@/components/ui/Panel";
import { FU_TABLE } from "@/lib/science/forel-ule-table";
import { SATELLITE_PARAMETERS, type SatelliteReading } from "@/lib/science/satellite";
import type { Snapshot } from "@/lib/science/snapshot";

function forelUleDescription(index: number | null): string {
  if (index === null) return "unknown";
  return FU_TABLE.find((e) => e.index === index)?.description ?? String(index);
}

function daysAgo(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * "Citizen and satellite" panel for the water body page: the latest
 * Sentinel-2 pass alongside the citizen Forel-Ule reading, and one plain
 * sentence — agreement, divergence, or unavailable. A cloudy or unusable
 * pass is never shown as agreement.
 */
export function SatellitePanel({
  latest,
  citizenFu,
  divergence,
  scientific,
  now = new Date(),
}: {
  latest: SatelliteReading | null;
  citizenFu: number | null;
  divergence: Snapshot["divergence"];
  scientific: boolean;
  now?: Date;
}) {
  const isCurrent =
    latest !== null && daysAgo(latest.acquiredAt, now) <= SATELLITE_PARAMETERS.maxAgeDays;

  return (
    <Panel>
      <p className="field-label m-0">Citizen and satellite</p>

      {!isCurrent ? (
        <p className="mt-2 mb-0 text-sm text-ink-muted">
          No usable satellite pass in the last {SATELLITE_PARAMETERS.maxAgeDays} days
          — cloud cover or too few water pixels. This is shown as unavailable,
          never as agreement.
        </p>
      ) : latest!.forelUleEquivalent === null ? (
        <p className="mt-2 mb-0 text-sm text-ink-muted">
          The most recent Sentinel-2 pass ({new Date(latest!.acquiredAt).toLocaleDateString()})
          could not be read — cloud cover or too few water pixels. This is
          shown as unavailable, never as agreement.
        </p>
      ) : (
        <>
          <p className="mt-2 mb-0 text-sm">
            Sentinel-2,{" "}
            <span className="num">
              {new Date(latest!.acquiredAt).toLocaleDateString()}
            </span>{" "}
            (cloud cover{" "}
            <span className="num">{(latest!.cloudCover ?? 0).toFixed(0)}%</span>):
            Forel-Ule <span className="num">{latest!.forelUleEquivalent}</span> (
            {forelUleDescription(latest!.forelUleEquivalent)}).
          </p>
          {citizenFu !== null && (
            <p className="mt-1 mb-0 text-sm text-ink-muted">
              Citizen reports: Forel-Ule{" "}
              <span className="num">{citizenFu.toFixed(1)}</span> (
              {forelUleDescription(Math.round(citizenFu))}).
            </p>
          )}
          <p className="mt-3 mb-0 text-sm font-medium">
            {citizenFu === null
              ? "No citizen colour reading to compare yet."
              : divergence?.diverged
                ? `Diverges from citizen reports by ${divergence.deltaFu.toFixed(1)} Forel-Ule classes — satellites see the whole surface coarsely, residents see one bank precisely. Both are kept, and the uncertainty widens rather than resolving in either direction.`
                : "Agrees with citizen reports within the declared threshold."}
          </p>

          {scientific && (
            <div className="mt-4 border-t border-rule pt-3 text-xs text-ink-muted">
              <p className="num m-0">
                Usable water pixels: {latest!.usablePixels}
                {latest!.ndci !== null && <> · NDCI {latest!.ndci.toFixed(3)}</>}
                {latest!.hueAngle !== null && (
                  <> · hue angle {latest!.hueAngle.toFixed(1)}°</>
                )}
              </p>
              <p className="mt-2 mb-0">
                This reflectance-to-hue-angle conversion uses CIE 1931
                colour-matching weights at each band&rsquo;s centre wavelength.
                It is NOT the published van der Woerd &amp; Wernand
                Sentinel-2 hue-angle calibration, which Rivulet intends to
                adopt once implemented — see the method disclosure below.
              </p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
