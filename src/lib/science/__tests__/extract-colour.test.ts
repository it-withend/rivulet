import { describe, it, expect } from "vitest";
import { extractCentreRegion } from "../extract-colour";

function imageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 10;
    data[i * 4 + 1] = 20;
    data[i * 4 + 2] = 30;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

describe("extractCentreRegion", () => {
  it("returns a quarter-width centre crop by default", () => {
    const region = extractCentreRegion(imageData(100, 100));
    expect(region.length / 4).toBe(50 * 50);
  });

  it("honours a custom fraction", () => {
    const region = extractCentreRegion(imageData(100, 100), 0.2);
    expect(region.length / 4).toBe(20 * 20);
  });

  it("preserves pixel values", () => {
    const region = extractCentreRegion(imageData(40, 40));
    expect(region[0]).toBe(10);
    expect(region[1]).toBe(20);
    expect(region[2]).toBe(30);
    expect(region[3]).toBe(255);
  });

  it("never returns more pixels than the source", () => {
    const source = imageData(10, 10);
    const region = extractCentreRegion(source, 1);
    expect(region.length).toBeLessThanOrEqual(source.data.length);
  });
});
