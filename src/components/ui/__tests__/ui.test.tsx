import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ForelUleRibbon } from "../ForelUleRibbon";
import { Chip } from "../Chip";
import { Button } from "../Button";
import { FU_TABLE } from "@/lib/science/forel-ule-table";

describe("ForelUleRibbon", () => {
  it("renders all 21 colours of the scale", () => {
    render(<ForelUleRibbon />);
    expect(screen.getAllByRole("listitem")).toHaveLength(21);
  });

  it("uses the reference colour for each swatch", () => {
    render(<ForelUleRibbon />);
    const items = screen.getAllByRole("listitem");
    items.forEach((item, i) => {
      expect(item.getAttribute("data-srgb")).toBe(FU_TABLE[i].srgb);
    });
  });

  it("marks the active reading and only that one", () => {
    render(<ForelUleRibbon active={9} />);
    expect(
      screen.getByLabelText(/^Forel–Ule 9\b/).getAttribute("aria-current"),
    ).toBe("true");
    expect(
      screen.getByLabelText(/^Forel–Ule 10\b/).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("marks collected colours", () => {
    render(<ForelUleRibbon collected={[3, 9]} />);
    expect(
      screen.getByLabelText(/^Forel–Ule 3\b/).getAttribute("data-collected"),
    ).toBe("true");
    expect(
      screen.getByLabelText(/^Forel–Ule 4\b/).getAttribute("data-collected"),
    ).toBe("false");
  });
});

describe("Chip", () => {
  it("exposes its pressed state", () => {
    render(
      <Chip pressed onClick={() => {}}>
        Sewage
      </Chip>,
    );
    expect(
      screen.getByRole("button", { name: "Sewage" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(
      <Chip pressed={false} onClick={onClick}>
        Foam
      </Chip>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Foam" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("Button", () => {
  it("renders a link when given an href", () => {
    render(<Button href="/map">See the map</Button>);
    expect(
      screen.getByRole("link", { name: "See the map" }).getAttribute("href"),
    ).toBe("/map");
  });

  it("renders a button otherwise", () => {
    render(<Button type="button">Send</Button>);
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });
});
