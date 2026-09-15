import { describe, it, expect } from "vitest";
import { OAH_SYSTEM, RIVULET_SYSTEM } from "../codes";
import { toLocationOah, toObservationIndicators } from "../observation";

const waterbody = {
  id: "wb-1",
  name: "Ribeira de Coselhas",
  city: "Coimbra",
  centroidLon: -8.42,
  centroidLat: 40.22,
};

describe("toLocationOah", () => {
  it("produces a Location with a position", () => {
    const loc = toLocationOah(waterbody);
    expect(loc.resourceType).toBe("Location");
    expect(loc.id).toBe("wb-1");
    expect(loc.position!.longitude).toBeCloseTo(-8.42, 5);
    expect(loc.position!.latitude).toBeCloseTo(40.22, 5);
  });
});

describe("toObservationIndicators", () => {
  const base = {
    id: "obs-1",
    waterbodyId: "wb-1",
    effectiveDateTime: "2026-09-15T10:00:00Z",
    performerDisplay: "Anonymous citizen scientist",
  };

  it("fixes status to final as the profile requires", () => {
    const fhir = toObservationIndicators({
      ...base,
      code: "pH",
      value: { kind: "quantity", value: 7.4, unit: "pH" },
    });
    expect(fhir.status).toBe("final");
  });

  it("declares the OAH profile", () => {
    const fhir = toObservationIndicators({
      ...base,
      code: "pH",
      value: { kind: "quantity", value: 7.4, unit: "pH" },
    });
    expect(fhir.meta!.profile![0]).toContain("ObservationIndicatorsOah");
  });

  it("uses the OAH code system for OAH indicators", () => {
    const fhir = toObservationIndicators({
      ...base,
      code: "dissolvedO2",
      value: { kind: "quantity", value: 8.1, unit: "mg/L" },
    });
    expect(fhir.code.coding[0].system).toBe(OAH_SYSTEM);
    expect(fhir.code.coding[0].code).toBe("dissolvedO2");
  });

  it("uses the Rivulet extension system for derived concepts", () => {
    const fhir = toObservationIndicators({
      ...base,
      code: "forel-ule-index",
      value: { kind: "quantity", value: 9, unit: "FU" },
    });
    expect(fhir.code.coding[0].system).toBe(RIVULET_SYSTEM);
  });

  it("references the water body as the subject", () => {
    const fhir = toObservationIndicators({
      ...base,
      code: "pH",
      value: { kind: "quantity", value: 7.4, unit: "pH" },
    });
    expect(fhir.subject.reference).toBe("Location/wb-1");
  });

  it("carries a performer, which the profile requires", () => {
    const fhir = toObservationIndicators({
      ...base,
      code: "pH",
      value: { kind: "quantity", value: 7.4, unit: "pH" },
    });
    expect(fhir.performer).toHaveLength(1);
  });

  it("emits a CodeableConcept value when given one", () => {
    const fhir = toObservationIndicators({
      ...base,
      code: "wfd-ecological-status",
      value: { kind: "code", code: "moderate", display: "Moderate" },
    });
    expect(fhir.valueCodeableConcept).toBeDefined();
    expect(fhir.valueQuantity).toBeUndefined();
  });

  it("preserves the IG spelling of macroinvertebreates", () => {
    const fhir = toObservationIndicators({
      ...base,
      code: "macroinvertebreates",
      value: { kind: "quantity", value: 17, unit: "score" },
    });
    expect(fhir.code.coding[0].code).toBe("macroinvertebreates");
  });

  it("tags synthetic observations as test data", () => {
    const fhir = toObservationIndicators({
      ...base,
      code: "pH",
      value: { kind: "quantity", value: 7.4, unit: "pH" },
      synthetic: true,
    });
    expect(fhir.meta.tag?.[0].code).toBe("HTEST");
  });

  it("leaves real observations untagged", () => {
    const fhir = toObservationIndicators({
      ...base,
      code: "pH",
      value: { kind: "quantity", value: 7.4, unit: "pH" },
    });
    expect(fhir.meta.tag).toBeUndefined();
  });
});
