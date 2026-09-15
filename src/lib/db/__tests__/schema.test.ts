import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/0001_initial.sql", "utf8");

describe("initial migration", () => {
  it("enables PostGIS", () => {
    expect(migration).toContain("create extension if not exists postgis");
  });

  it("creates every table the application reads", () => {
    for (const table of [
      "waterbodies",
      "observers",
      "observations",
      "index_snapshots",
    ]) {
      expect(migration).toContain(`create table ${table}`);
    }
  });

  it("allows anonymous observations", () => {
    expect(migration).toMatch(
      /observer_id uuid references observers\(id\) on delete set null/,
    );
  });

  it("constrains the Forel-Ule index to the scale", () => {
    expect(migration).toContain("forel_ule_index between 1 and 21");
  });

  it("allows a snapshot with no class when data is insufficient", () => {
    expect(migration).toMatch(/wfd_class text check/);
    expect(migration).not.toMatch(/wfd_class text not null/);
  });

  it("distinguishes synthetic demo observations from real ones", () => {
    expect(migration).toContain("is_synthetic boolean not null default false");
  });
});
