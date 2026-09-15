import { describe, it, expect } from "vitest";
import {
  colourCollection,
  evaluateBadges,
  newlyEarned,
  type JournalEntry,
} from "../journal";

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    observationId: "o1",
    waterbodyId: "wb1",
    waterbodyName: "Ribeira de Coselhas",
    observedAt: "2026-09-15T10:00:00.000Z",
    forelUle: 5,
    indicatorTaxa: [],
    visibleAlgae: false,
    wasDataGap: false,
    ...overrides,
  };
}

const earned = (entries: JournalEntry[]) =>
  evaluateBadges(entries)
    .filter((b) => b.earned)
    .map((b) => b.code);

describe("evaluateBadges", () => {
  it("lists every badge whether earned or not", () => {
    expect(evaluateBadges([])).toHaveLength(7);
  });

  it("earns nothing with an empty journal", () => {
    expect(earned([])).toEqual([]);
  });

  it("earns first-observation after one entry", () => {
    expect(earned([entry()])).toContain("first-observation");
  });

  it("requires five distinct colours for colour-collector", () => {
    const four = [1, 2, 3, 4].map((fu) =>
      entry({ observationId: `o${fu}`, forelUle: fu }),
    );
    expect(earned(four)).not.toContain("colour-collector");
    expect(
      earned([...four, entry({ observationId: "o9", forelUle: 9 })]),
    ).toContain("colour-collector");
  });

  it("does not count a repeated colour twice", () => {
    const same = [1, 2, 3, 4, 5].map((i) =>
      entry({ observationId: `o${i}`, forelUle: 7 }),
    );
    expect(earned(same)).not.toContain("colour-collector");
  });

  it("awards clean-water-sentinel only for pollution-sensitive taxa", () => {
    expect(earned([entry({ indicatorTaxa: ["worm", "leech"] })])).not.toContain(
      "clean-water-sentinel",
    );
    expect(earned([entry({ indicatorTaxa: ["caddisfly"] })])).toContain(
      "clean-water-sentinel",
    );
  });

  it("awards bloom-spotter for a reported bloom", () => {
    expect(earned([entry({ visibleAlgae: true })])).toContain("bloom-spotter");
  });

  it("requires three distinct streams for stream-explorer", () => {
    const two = ["a", "b"].map((id) =>
      entry({ observationId: id, waterbodyId: id }),
    );
    expect(earned(two)).not.toContain("stream-explorer");
    expect(
      earned([...two, entry({ observationId: "c", waterbodyId: "c" })]),
    ).toContain("stream-explorer");
  });

  it("requires three separate days at one stream for returning-guardian", () => {
    const sameDay = [1, 2, 3].map((h) =>
      entry({
        observationId: `o${h}`,
        observedAt: `2026-09-15T0${h}:00:00.000Z`,
      }),
    );
    expect(earned(sameDay)).not.toContain("returning-guardian");

    const days = [15, 16, 17].map((d) =>
      entry({
        observationId: `o${d}`,
        observedAt: `2026-09-${d}T10:00:00.000Z`,
      }),
    );
    expect(earned(days)).toContain("returning-guardian");
  });

  it("awards gap-filler for observing a stream that lacked data", () => {
    expect(earned([entry({ wasDataGap: true })])).toContain("gap-filler");
  });
});

describe("newlyEarned", () => {
  it("returns only badges unlocked by the latest entry", () => {
    const before = [entry()];
    const after = [...before, entry({ observationId: "o2", visibleAlgae: true })];
    expect(newlyEarned(before, after)).toEqual(["bloom-spotter"]);
  });
});

describe("colourCollection", () => {
  it("returns distinct colours in scale order and ignores missing readings", () => {
    const list = [
      entry({ observationId: "a", forelUle: 9 }),
      entry({ observationId: "b", forelUle: 3 }),
      entry({ observationId: "c", forelUle: 9 }),
      entry({ observationId: "d", forelUle: null }),
    ];
    expect(colourCollection(list)).toEqual([3, 9]);
  });
});
