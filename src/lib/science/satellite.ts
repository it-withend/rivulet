import { chromaticity, hueAngle, hueAngleToForelUle } from "./forel-ule";
import { EVIDENCE_WEIGHTS } from "./indicators";

export type SatelliteReading = {
  id: string;
  waterbodyId: string;
  acquiredAt: string;
  sceneId: string;
  cloudCover: number | null;
  usablePixels: number;
  ndci: number | null;
  turbidity: number | null;
  forelUleEquivalent: number | null;
  hueAngle: number | null;
};

export type DivergenceResult = { deltaFu: number; diverged: boolean };

/**
 * All Sentinel-2 ingest priors and the evidence/divergence rules that build
 * on them — see METHOD_PARAMETERS ids `satellite.*` for rationale text.
 */
export const SATELLITE_PARAMETERS = {
  minUsablePixels: 4,
  minNdwi: 0.0,
  windowPixels: 5,
  maxAgeDays: 30,
  evidenceWeight: 0.4,
  divergenceThresholdFu: 3,
} as const;

/**
 * CIE 1931 2° standard observer colour-matching function values (x̄, ȳ, z̄)
 * at the nearest 5nm-tabulated wavelength to each Sentinel-2 L2A band's
 * centre wavelength (B02 blue ≈ 492nm → 490nm row, B03 green ≈ 560nm exact,
 * B04 red ≈ 665nm exact). Source: CIE 1931 standard observer table (CIE
 * 15:2004), as commonly tabulated at 5nm resolution.
 *
 * This treats each band's mean reflectance as if it were monochromatic light
 * at the band's centre wavelength — a coarse approximation, NOT the
 * published van der Woerd & Wernand Sentinel-2 hue-angle calibration (see
 * `satellite.hue-angle-calibration` in METHOD_PARAMETERS, and the citations
 * in METHOD_VERSION).
 */
export const SATELLITE_BAND_CMF = {
  blue: { x: 0.032, y: 0.208, z: 0.4652 },
  green: { x: 0.5945, y: 0.995, z: 0.0039 },
  red: { x: 0.1212, y: 0.0446, z: 0.0 },
} as const;

/**
 * Converts mean band reflectances (0-1) to a hue angle via the same
 * chromaticity/hue-angle path as the photo-based Forel-Ule pipeline
 * (`chromaticity`, `hueAngle` from forel-ule.ts), but weighting each band's
 * reflectance by its CIE 1931 colour-matching value at its centre
 * wavelength instead of the sRGB gamma/matrix path used for photographs.
 * An uncalibrated prior — see `satellite.hue-angle-calibration`.
 */
export function reflectanceToHueAngle(
  blue: number,
  green: number,
  red: number,
): number {
  const cmf = SATELLITE_BAND_CMF;
  const xyz = {
    x: blue * cmf.blue.x + green * cmf.green.x + red * cmf.red.x,
    y: blue * cmf.blue.y + green * cmf.green.y + red * cmf.red.y,
    z: blue * cmf.blue.z + green * cmf.green.z + red * cmf.red.z,
  };
  return hueAngle(chromaticity(xyz));
}

export { hueAngleToForelUle };

/**
 * Same Forel-Ule evidence thresholds as `ecologicalEvidence`, so citizen and
 * satellite readings speak one language inside the Bayesian model. A reading
 * with no usable colour (cloudy/insufficient pixels) contributes no evidence
 * either way — it must never look like agreement.
 */
export function satelliteEvidence(
  reading: Pick<SatelliteReading, "forelUleEquivalent">,
): { good: number; bad: number } {
  const w = EVIDENCE_WEIGHTS;
  const fu = reading.forelUleEquivalent;
  if (fu === null) return { good: 0, bad: 0 };
  if (fu <= w.forelUleClearMax) return { good: w.forelUleClear, bad: 0 };
  if (fu >= w.forelUleEnrichedMin) return { good: 0, bad: w.forelUleEnriched };
  return { good: w.forelUleIntermediate, bad: 0 };
}

/** Absolute Forel-Ule class distance and whether it exceeds the divergence prior. */
export function divergence(citizenFu: number, satelliteFu: number): DivergenceResult {
  const deltaFu = Math.abs(citizenFu - satelliteFu);
  return { deltaFu, diverged: deltaFu > SATELLITE_PARAMETERS.divergenceThresholdFu };
}

/** A satellite reading counts as current only within `maxAgeDays` of `now`. */
export function isCurrentReading(reading: SatelliteReading, now: Date): boolean {
  if (reading.forelUleEquivalent === null) return false;
  const ageDays =
    (now.getTime() - new Date(reading.acquiredAt).getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays <= SATELLITE_PARAMETERS.maxAgeDays;
}
