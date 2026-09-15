import { describe, it, expect } from "vitest";
import { appendEntry, JOURNAL_KEY, loadJournal } from "../storage";
import type { JournalEntry } from "../journal";

const sample: JournalEntry = {
  observationId: "o1",
  waterbodyId: "wb1",
  waterbodyName: "Ribeira de Coselhas",
  observedAt: "2026-09-15T10:00:00.000Z",
  forelUle: 6,
  indicatorTaxa: ["mayfly"],
  visibleAlgae: false,
  wasDataGap: true,
};

function memoryStore(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (key: string) => (key === JOURNAL_KEY ? value : null),
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe("journal storage", () => {
  it("returns an empty journal when nothing is stored", () => {
    expect(loadJournal(memoryStore())).toEqual([]);
  });

  it("returns an empty journal when storage is unavailable", () => {
    expect(loadJournal(null)).toEqual([]);
  });

  it("round-trips an entry", () => {
    const store = memoryStore();
    appendEntry(sample, store);
    expect(loadJournal(store)).toEqual([sample]);
  });

  it("ignores corrupt stored data", () => {
    expect(loadJournal(memoryStore("{not json"))).toEqual([]);
  });

  it("does not duplicate an observation saved twice", () => {
    const store = memoryStore();
    appendEntry(sample, store);
    appendEntry(sample, store);
    expect(loadJournal(store)).toHaveLength(1);
  });

  it("still returns the entry when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadJournal(broken)).toEqual([]);
    expect(appendEntry(sample, broken)).toEqual([sample]);
  });
});
