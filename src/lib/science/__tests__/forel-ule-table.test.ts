import { describe, it, expect } from "vitest";
import { FU_TABLE, FU_TABLE_SOURCE } from "../forel-ule-table";

describe("Forel-Ule reference table", () => {
  it("has exactly 21 entries indexed 1 to 21", () => {
    expect(FU_TABLE).toHaveLength(21);
    expect(FU_TABLE.map((e) => e.index)).toEqual(
      Array.from({ length: 21 }, (_, i) => i + 1),
    );
  });

  it("cites a source", () => {
    expect(FU_TABLE_SOURCE.length).toBeGreaterThan(20);
  });

  it("gives every entry a valid sRGB hex and a description", () => {
    for (const entry of FU_TABLE) {
      expect(entry.srgb).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("defines hue angle bands that are ordered and non-overlapping", () => {
    for (const entry of FU_TABLE) {
      expect(entry.hueAngleMax).toBeGreaterThan(entry.hueAngleMin);
    }
    for (let i = 1; i < FU_TABLE.length; i++) {
      expect(FU_TABLE[i].hueAngleMax).toBeLessThanOrEqual(
        FU_TABLE[i - 1].hueAngleMin + 1e-9,
      );
    }
  });
});
