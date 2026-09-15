import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ObservationResult } from "../ObservationResult";
import type { AssessmentDelta } from "@/lib/science/delta";

function delta(overrides: Partial<AssessmentDelta> = {}): AssessmentDelta {
  return {
    before: { klass: null, mean: 0.5, confidence: 0.1, sufficientData: false },
    after: { klass: null, mean: 0.6, confidence: 0.3, sufficientData: false },
    classChanged: false,
    confidenceGain: 0.2,
    wasDataGap: true,
    ...overrides,
  };
}

const base = {
  waterbodyId: "wb1",
  waterbodyName: "Ribeira de Coselhas",
  forelUle: 6,
  newBadges: [],
};

describe("ObservationResult", () => {
  it("shows how confidence in the assessment changed", () => {
    render(<ObservationResult {...base} delta={delta()} />);
    expect(screen.getByTestId("confidence-change").textContent).toContain(
      "10% → 30%",
    );
  });

  it("explains the data gap only when there was one", () => {
    const { rerender } = render(<ObservationResult {...base} delta={delta()} />);
    expect(screen.queryByTestId("data-gap")).not.toBeNull();
    rerender(
      <ObservationResult {...base} delta={delta({ wasDataGap: false })} />,
    );
    expect(screen.queryByTestId("data-gap")).toBeNull();
  });

  it("announces a class change with the new class label", () => {
    render(
      <ObservationResult
        {...base}
        delta={delta({
          classChanged: true,
          after: { klass: "good", mean: 0.7, confidence: 0.4, sufficientData: true },
        })}
      />,
    );
    expect(screen.getByTestId("class-change").textContent).toContain("Good");
  });

  it("lists newly earned badges", () => {
    render(
      <ObservationResult
        {...base}
        delta={delta()}
        newBadges={[
          {
            code: "gap-filler",
            title: "Gap filler",
            description: "Recorded a stream that had too little data to assess.",
            earned: true,
          },
        ]}
      />,
    );
    expect(screen.getByText("Gap filler")).toBeTruthy();
  });

  it("omits the colour collection line when there was no photo", () => {
    render(<ObservationResult {...base} forelUle={null} delta={delta()} />);
    expect(screen.queryByText(/colour collection/)).toBeNull();
  });
});
