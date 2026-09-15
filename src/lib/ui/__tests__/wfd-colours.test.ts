import { describe, it, expect } from "vitest";
import { colourForClass, INSUFFICIENT_DATA_COLOUR } from "../wfd-colours";

describe("colourForClass", () => {
  it("uses the specified colour for each class", () => {
    expect(colourForClass("high")).toBe("#1a9641");
    expect(colourForClass("good")).toBe("#a6d96a");
    expect(colourForClass("moderate")).toBe("#ffffbf");
    expect(colourForClass("poor")).toBe("#fdae61");
    expect(colourForClass("bad")).toBe("#d7191c");
  });

  it("returns the neutral colour when there is no class", () => {
    expect(colourForClass(null)).toBe(INSUFFICIENT_DATA_COLOUR);
  });

  it("never returns a green for missing data", () => {
    expect(colourForClass(null)).not.toBe(colourForClass("high"));
    expect(colourForClass(null)).not.toBe(colourForClass("good"));
  });
});
