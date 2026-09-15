import { describe, it, expect } from "vitest";
import {
  srgbToXyz,
  chromaticity,
  hueAngle,
  hueAngleToForelUle,
  pixelsToForelUle,
  circularMeanDegrees,
} from "../forel-ule";
import { FU_TABLE } from "../forel-ule-table";

describe("srgbToXyz", () => {
  it("maps pure white to the D65 white point", () => {
    const xyz = srgbToXyz(255, 255, 255);
    expect(xyz.x).toBeCloseTo(0.9505, 3);
    expect(xyz.y).toBeCloseTo(1.0, 3);
    expect(xyz.z).toBeCloseTo(1.089, 3);
  });

  it("maps pure black to the origin", () => {
    const xyz = srgbToXyz(0, 0, 0);
    expect(xyz.x).toBeCloseTo(0, 6);
    expect(xyz.y).toBeCloseTo(0, 6);
    expect(xyz.z).toBeCloseTo(0, 6);
  });
});

describe("chromaticity", () => {
  it("normalises so the coordinates sum to at most one", () => {
    const c = chromaticity(srgbToXyz(120, 160, 90));
    expect(c.x + c.y).toBeLessThanOrEqual(1);
    expect(c.x).toBeGreaterThan(0);
    expect(c.y).toBeGreaterThan(0);
  });

  it("returns the white point chromaticity for white", () => {
    const c = chromaticity(srgbToXyz(255, 255, 255));
    expect(c.x).toBeCloseTo(0.3127, 3);
    expect(c.y).toBeCloseTo(0.329, 3);
  });
});

describe("hueAngle", () => {
  it("returns a value within the circle", () => {
    const a = hueAngle(chromaticity(srgbToXyz(40, 90, 140)));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
  });

  it("gives different angles to blue and brown water", () => {
    const blue = hueAngle(chromaticity(srgbToXyz(40, 90, 140)));
    const brown = hueAngle(chromaticity(srgbToXyz(120, 90, 45)));
    expect(Math.abs(blue - brown)).toBeGreaterThan(10);
  });
});

describe("hueAngleToForelUle", () => {
  it("returns the band that contains the angle", () => {
    const entry = FU_TABLE[10];
    const mid = (entry.hueAngleMin + entry.hueAngleMax) / 2;
    expect(hueAngleToForelUle(mid)).toBe(entry.index);
  });

  it("clamps angles above the table to index 1", () => {
    expect(hueAngleToForelUle(FU_TABLE[0].hueAngleMax + 50)).toBe(1);
  });

  it("clamps angles below the table to index 21", () => {
    expect(hueAngleToForelUle(FU_TABLE[20].hueAngleMin - 50)).toBe(21);
  });
});

describe("pixelsToForelUle", () => {
  function solidBlock(r: number, g: number, b: number, count: number) {
    const arr = new Uint8ClampedArray(count * 4);
    for (let i = 0; i < count; i++) {
      arr[i * 4] = r;
      arr[i * 4 + 1] = g;
      arr[i * 4 + 2] = b;
      arr[i * 4 + 3] = 255;
    }
    return arr;
  }

  it("returns null when there are too few usable pixels", () => {
    expect(pixelsToForelUle(solidBlock(60, 110, 90, 10))).toBeNull();
  });

  it("classifies a uniform block with high confidence", () => {
    const result = pixelsToForelUle(solidBlock(60, 110, 90, 500));
    expect(result).not.toBeNull();
    expect(result!.index).toBeGreaterThanOrEqual(1);
    expect(result!.index).toBeLessThanOrEqual(21);
    expect(result!.confidence).toBeGreaterThan(0.8);
  });

  it("ignores fully transparent pixels", () => {
    const arr = solidBlock(60, 110, 90, 500);
    for (let i = 0; i < 401; i++) arr[i * 4 + 3] = 0;
    expect(pixelsToForelUle(arr)).toBeNull();
  });
});

describe("circularMeanDegrees", () => {
  it("averages across the 0/360 boundary", () => {
    const { mean } = circularMeanDegrees([350, 10]);
    expect(Math.min(mean, 360 - mean)).toBeLessThan(1e-6);
  });

  it("reports zero spread for identical angles", () => {
    const result = circularMeanDegrees([90, 90, 90]);
    expect(result.mean).toBeCloseTo(90, 6);
    expect(result.spread).toBeCloseTo(0, 6);
  });

  it("reports a larger spread for scattered angles", () => {
    expect(circularMeanDegrees([60, 120]).spread).toBeGreaterThan(
      circularMeanDegrees([85, 95]).spread,
    );
  });
});
