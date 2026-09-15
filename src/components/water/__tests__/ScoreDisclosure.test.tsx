import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScoreDisclosure } from "../ScoreDisclosure";
import { computeSnapshot } from "@/lib/science/snapshot";
import { METHOD_PARAMETERS } from "@/lib/science/method-parameters";

describe("ScoreDisclosure", () => {
  it("lists every declared prior under Assumptions not yet calibrated", () => {
    const snapshot = computeSnapshot([]);
    render(<ScoreDisclosure snapshot={snapshot} />);

    fireEvent.click(screen.getByRole("button", { name: /why this score\?/i }));

    expect(
      screen.getByRole("heading", { name: "Assumptions not yet calibrated" }),
    ).toBeTruthy();

    const priorCount = METHOD_PARAMETERS.filter(
      (p) => p.kind === "prior",
    ).length;
    expect(
      screen.getByTestId("priors").querySelectorAll("li"),
    ).toHaveLength(priorCount);
  });
});
