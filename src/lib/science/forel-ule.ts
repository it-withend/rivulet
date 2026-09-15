import { FU_TABLE } from "./forel-ule-table";

export const HUE_REFERENCE = { x: 1 / 3, y: 1 / 3 };
export const D65_WHITE = { x: 0.3127, y: 0.329 };
export const MIN_USABLE_PIXELS = 100;
export const MIN_CHROMA_DISTANCE = 0.01;
export const CONFIDENCE_SPREAD_SCALE_DEGREES = 30;

export const SRGB_TRANSFER = {
  threshold: 0.04045,
  linearSlope: 12.92,
  offset: 0.055,
  exponent: 2.4,
} as const;

export const SRGB_TO_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
] as const;

function gammaExpand(channel: number): number {
  const c = channel / 255;
  return c <= SRGB_TRANSFER.threshold
    ? c / SRGB_TRANSFER.linearSlope
    : Math.pow((c + SRGB_TRANSFER.offset) / (1 + SRGB_TRANSFER.offset), SRGB_TRANSFER.exponent);
}

export function srgbToXyz(r: number, g: number, b: number) {
  const rl = gammaExpand(r);
  const gl = gammaExpand(g);
  const bl = gammaExpand(b);
  return {
    x: SRGB_TO_XYZ[0][0] * rl + SRGB_TO_XYZ[0][1] * gl + SRGB_TO_XYZ[0][2] * bl,
    y: SRGB_TO_XYZ[1][0] * rl + SRGB_TO_XYZ[1][1] * gl + SRGB_TO_XYZ[1][2] * bl,
    z: SRGB_TO_XYZ[2][0] * rl + SRGB_TO_XYZ[2][1] * gl + SRGB_TO_XYZ[2][2] * bl,
  };
}

export function chromaticity(xyz: { x: number; y: number; z: number }) {
  const sum = xyz.x + xyz.y + xyz.z;
  if (sum === 0) return { x: 0, y: 0 };
  return { x: xyz.x / sum, y: xyz.y / sum };
}

export function hueAngle(chroma: { x: number; y: number }): number {
  const dx = chroma.x - HUE_REFERENCE.x;
  const dy = chroma.y - HUE_REFERENCE.y;
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function hueAngleToForelUle(angle: number): number {
  for (const entry of FU_TABLE) {
    if (angle <= entry.hueAngleMax && angle >= entry.hueAngleMin) {
      return entry.index;
    }
  }
  return angle > FU_TABLE[0].hueAngleMax ? 1 : 21;
}

export function circularMeanDegrees(angles: number[]): {
  mean: number;
  spread: number;
} {
  let sin = 0;
  let cos = 0;
  for (const angle of angles) {
    const radians = (angle * Math.PI) / 180;
    sin += Math.sin(radians);
    cos += Math.cos(radians);
  }
  const n = angles.length;
  const mean = ((Math.atan2(sin / n, cos / n) * 180) / Math.PI + 360) % 360;
  const resultant = Math.min(1, Math.max(1e-12, Math.hypot(sin / n, cos / n)));
  const spread = (Math.sqrt(-2 * Math.log(resultant)) * 180) / Math.PI;
  return { mean, spread };
}

export function pixelsToForelUle(pixels: Uint8ClampedArray) {
  const angles: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 255) continue;
    const chroma = chromaticity(
      srgbToXyz(pixels[i], pixels[i + 1], pixels[i + 2]),
    );
    if (chroma.x === 0 && chroma.y === 0) continue;
    if (
      Math.hypot(chroma.x - D65_WHITE.x, chroma.y - D65_WHITE.y) <
      MIN_CHROMA_DISTANCE
    ) {
      continue;
    }
    angles.push(hueAngle(chroma));
  }

  if (angles.length < MIN_USABLE_PIXELS) return null;

  const { mean, spread } = circularMeanDegrees(angles);

  return {
    index: hueAngleToForelUle(mean),
    hueAngle: mean,
    confidence: Math.max(0, Math.min(1, 1 - spread / CONFIDENCE_SPREAD_SCALE_DEGREES)),
  };
}
