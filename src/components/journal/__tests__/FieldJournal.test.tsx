import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldJournal } from "../FieldJournal";
import { JOURNAL_KEY } from "@/lib/journal/storage";

describe("FieldJournal", () => {
  beforeEach(() => localStorage.clear());

  it("invites a first observation when the journal is empty", async () => {
    render(<FieldJournal />);
    expect(await screen.findByText(/journal is empty/i)).toBeTruthy();
  });

  it("shows collected colours and earned badges from stored entries", async () => {
    localStorage.setItem(
      JOURNAL_KEY,
      JSON.stringify([
        {
          observationId: "o1",
          waterbodyId: "wb1",
          waterbodyName: "Ribeira de Coselhas",
          observedAt: "2026-09-15T10:00:00.000Z",
          forelUle: 6,
          indicatorTaxa: ["mayfly"],
          visibleAlgae: false,
          wasDataGap: false,
        },
      ]),
    );

    render(<FieldJournal />);

    expect((await screen.findByTestId("colour-count")).textContent).toContain(
      "1 of 21",
    );
    expect(
      screen.getByText("First sample").closest("li")!.getAttribute("data-earned"),
    ).toBe("true");
    expect(
      screen
        .getByText("Colour collector")
        .closest("li")!
        .getAttribute("data-earned"),
    ).toBe("false");
  });
});
