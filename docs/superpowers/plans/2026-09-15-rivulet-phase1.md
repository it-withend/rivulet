# Rivulet Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the must-have tier of Rivulet — a citizen can submit an observation with live Forel–Ule feedback, and the city map and water body page show a Bayesian, uncertainty-aware WFD class that is fully traceable and exportable as OneAquaHealth-conformant FHIR.

**Architecture:** A single Next.js App Router application. All scientific logic lives in pure, dependency-free functions under `src/lib/science/` so it can be tested without a database or network. Supabase (Postgres + PostGIS) stores water bodies, observations and computed snapshots. FHIR serialisation is a pure mapping layer over stored records.

**Tech Stack:** Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · Supabase (Postgres 15 + PostGIS) · MapLibre GL JS · Vitest · Zod

## Global Constraints

- **Scope tier.** This plan implements only the "must ship" tier of spec §17. Do not start satellite ingestion, the divergence engine, risk modelling, quests, Trust Score, or certificates. They belong to Phase 2.
- **No invented metrics.** Every scientific constant, threshold and lookup table must carry a `source` field citing a named publication or standard. A value without a citation fails review.
- **Missing data never reads as good news.** No code path may assign a healthy status, a green colour, or a default "good" value when data is absent. Absence renders as an explicit insufficient-data state.
- **Honest uncertainty.** Any function returning an ecological estimate returns a credible interval alongside the point estimate. Never return a bare number.
- **Submission is never blocked by AI.** No LLM call sits on the observation write path in this phase (there are no LLM calls in Phase 1 at all).
- **Privacy by default.** Anonymous submission must work end to end. In Phase 1 photos never leave the device: the Forel–Ule reading is computed in the browser and only the resulting number is sent. Photo upload (and server-side EXIF stripping) is Phase 2.
- **PostGIS input.** Geometry is written as EWKT with an explicit SRID, e.g. `SRID=4326;POINT(lon lat)`. Plain WKT gets SRID 0 and is rejected by the `4326` column constraint.
- **Map colours:** WFD classes render as High `#1a9641`, Good `#a6d96a`, Moderate `#ffffbf`, Poor `#fdae61`, Bad `#d7191c`. Insufficient data renders as `#9e9e9e` with a hatch pattern, never as a class colour.
- **FHIR code system:** `http://hl7.eu/fhir/ig/oah/CodeSystem/temporarySystem-oah-eu`. Codes are used verbatim from the IG, including its spellings `macroinvertebreates` and `morophology`. Do not "correct" them.
- **Local extension code system:** `https://rivulet.eco/fhir/CodeSystem/rivulet-derived` for concepts absent from the OAH IG (Forel–Ule index, WFD class, data confidence). Every local code must be listed in `src/lib/fhir/codes.ts` with a comment naming the gap it fills.
- **Node 24 LTS.** TypeScript `strict: true`. No `any` anywhere in `src/lib/`. Untyped external JSON (Overpass responses, PostgREST GeoJSON columns) is cast to a declared type once, at the boundary where it enters.
- **Commit after every task.** Push to `origin main` at the end of each task.

---

### Task 1: Project scaffold, tooling and first push

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `README.md`
- Test: `src/lib/science/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test`, `npm run dev` and `npm run build`; the repo at `origin main`

- [ ] **Step 1: Scaffold the Next.js application**

Run from `E:/uniPROJECTS/AquaHealth`:

```bash
npx --yes create-next-app@latest . --typescript --tailwind --app --src-dir --eslint --use-npm --import-alias "@/*" --yes
```

If the directory is non-empty, the CLI refuses. In that case move `docs/` aside, scaffold, then move it back:

```bash
mv docs ../docs-tmp && npx --yes create-next-app@latest . --typescript --tailwind --app --src-dir --eslint --use-npm --import-alias "@/*" --yes && mv ../docs-tmp docs
```

The `@/*` alias is required: every later task imports with `@/`.

- [ ] **Step 2: Add test tooling**

```bash
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm install zod
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test**

Create `src/lib/science/__tests__/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test suite**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build completes with no type errors.

- [ ] **Step 7: Create the environment template**

Create `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Confirm `.gitignore` contains `.env*.local` and `.env`.

- [ ] **Step 8: Commit and push**

```bash
git add -A
git commit -m "Scaffold Next.js application with test harness"
git branch -M main
git push -u origin main
```

---

### Task 2: Forel–Ule reference table

**Files:**
- Create: `src/lib/science/forel-ule-table.json`, `src/lib/science/forel-ule-table.ts`
- Test: `src/lib/science/__tests__/forel-ule-table.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `FU_TABLE: ForelUleEntry[]`, `type ForelUleEntry = { index: number; hueAngleMin: number; hueAngleMax: number; srgb: string; description: string }`, `FU_TABLE_SOURCE: string`

**Sourcing note.** The hue-angle-to-FU correlation table originates in Novoa et al., *WACODI: A generic algorithm to derive the intrinsic color of natural waters from digital images*, Limnology and Oceanography: Methods, 2015. An open-access reproduction of the table appears in the ESSD preprint *Global maps of Forel-Ule index, hue angle and Secchi disk depth* (essd-2020-316) and in *EyeOnWater Raspberry Pi*, JSSS 14, 203, 2025. Transcribe from one of those open sources and record which one in `FU_TABLE_SOURCE`. Do not estimate values.

- [ ] **Step 1: Write the failing test**

Create `src/lib/science/__tests__/forel-ule-table.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/science/__tests__/forel-ule-table.test.ts`
Expected: FAIL — cannot resolve `../forel-ule-table`.

- [ ] **Step 3: Create the data file**

Create `src/lib/science/forel-ule-table.json` with 21 objects transcribed from the cited open-access source. Shape of each entry:

```json
{
  "index": 1,
  "hueAngleMin": 0,
  "hueAngleMax": 0,
  "srgb": "#000000",
  "description": ""
}
```

Fill `hueAngleMin`, `hueAngleMax`, `srgb` and `description` from the source. FU bands run from indigo-blue at index 1 through green and yellow to cola-brown at index 21; hue angle decreases as the index increases, which is what the ordering test above checks.

- [ ] **Step 4: Write the typed accessor**

Create `src/lib/science/forel-ule-table.ts`:

```typescript
import table from "./forel-ule-table.json";

export type ForelUleEntry = {
  index: number;
  hueAngleMin: number;
  hueAngleMax: number;
  srgb: string;
  description: string;
};

export const FU_TABLE: ForelUleEntry[] = table as ForelUleEntry[];

export const FU_TABLE_SOURCE =
  "Novoa et al. 2015, WACODI (Limnol. Oceanogr. Methods 13:684-697); " +
  "hue angle bands transcribed from the open-access reproduction in " +
  "EyeOnWater Raspberry Pi, J. Sens. Sens. Syst. 14, 203, 2025.";
```

Set `resolveJsonModule: true` in `tsconfig.json` if not already enabled.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/science/__tests__/forel-ule-table.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit and push**

```bash
git add src/lib/science tsconfig.json
git commit -m "Add cited Forel-Ule reference table"
git push
```

---

### Task 3: Colour to Forel–Ule conversion

**Files:**
- Create: `src/lib/science/forel-ule.ts`
- Test: `src/lib/science/__tests__/forel-ule.test.ts`

**Interfaces:**
- Consumes: `FU_TABLE` from Task 2
- Produces:
  - `srgbToXyz(r: number, g: number, b: number): { x: number; y: number; z: number }` — inputs 0–255
  - `chromaticity(xyz: {x:number;y:number;z:number}): { x: number; y: number }`
  - `hueAngle(chroma: { x: number; y: number }): number` — degrees 0–360, measured from the equal-energy white point (1/3, 1/3)
  - `hueAngleToForelUle(angle: number): number` — returns 1–21
  - `pixelsToForelUle(pixels: Uint8ClampedArray): { index: number; hueAngle: number; confidence: number } | null` — returns `null` when fewer than 100 usable pixels

**Method.** Follows the WACODI chain: sRGB → gamma expansion → CIE XYZ (CIE 1931 2°) → chromaticity → hue angle relative to the equal-energy white point (x = y = 1/3), the reference used for Forel–Ule hue angles → FU band lookup. If the source transcribed in Task 2 states a different reference white, use that one and update the constant and this task's tests together.

- [ ] **Step 1: Write the failing test**

Create `src/lib/science/__tests__/forel-ule.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  srgbToXyz,
  chromaticity,
  hueAngle,
  hueAngleToForelUle,
  pixelsToForelUle,
} from "../forel-ule";
import { FU_TABLE } from "../forel-ule-table";

describe("srgbToXyz", () => {
  it("maps pure white to the D65 white point", () => {
    const xyz = srgbToXyz(255, 255, 255);
    expect(xyz.x).toBeCloseTo(0.9505, 3);
    expect(xyz.y).toBeCloseTo(1.0, 3);
    expect(xyz.z).toBeCloseTo(1.089, 3);
  });

  it("maps pure black to the origin", () => {
    const xyz = srgbToXyz(0, 0, 0);
    expect(xyz.x).toBeCloseTo(0, 6);
    expect(xyz.y).toBeCloseTo(0, 6);
    expect(xyz.z).toBeCloseTo(0, 6);
  });
});

describe("chromaticity", () => {
  it("normalises so the coordinates sum to at most one", () => {
    const c = chromaticity(srgbToXyz(120, 160, 90));
    expect(c.x + c.y).toBeLessThanOrEqual(1);
    expect(c.x).toBeGreaterThan(0);
    expect(c.y).toBeGreaterThan(0);
  });

  it("returns the white point chromaticity for white", () => {
    const c = chromaticity(srgbToXyz(255, 255, 255));
    expect(c.x).toBeCloseTo(0.3127, 3);
    expect(c.y).toBeCloseTo(0.329, 3);
  });
});

describe("hueAngle", () => {
  it("returns a value within the circle", () => {
    const a = hueAngle(chromaticity(srgbToXyz(40, 90, 140)));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
  });

  it("gives different angles to blue and brown water", () => {
    const blue = hueAngle(chromaticity(srgbToXyz(40, 90, 140)));
    const brown = hueAngle(chromaticity(srgbToXyz(120, 90, 45)));
    expect(Math.abs(blue - brown)).toBeGreaterThan(10);
  });
});

describe("hueAngleToForelUle", () => {
  it("returns the band that contains the angle", () => {
    const entry = FU_TABLE[10];
    const mid = (entry.hueAngleMin + entry.hueAngleMax) / 2;
    expect(hueAngleToForelUle(mid)).toBe(entry.index);
  });

  it("clamps angles above the table to index 1", () => {
    expect(hueAngleToForelUle(FU_TABLE[0].hueAngleMax + 50)).toBe(1);
  });

  it("clamps angles below the table to index 21", () => {
    expect(hueAngleToForelUle(FU_TABLE[20].hueAngleMin - 50)).toBe(21);
  });
});

describe("pixelsToForelUle", () => {
  function solidBlock(r: number, g: number, b: number, count: number) {
    const arr = new Uint8ClampedArray(count * 4);
    for (let i = 0; i < count; i++) {
      arr[i * 4] = r;
      arr[i * 4 + 1] = g;
      arr[i * 4 + 2] = b;
      arr[i * 4 + 3] = 255;
    }
    return arr;
  }

  it("returns null when there are too few usable pixels", () => {
    expect(pixelsToForelUle(solidBlock(60, 110, 90, 10))).toBeNull();
  });

  it("classifies a uniform block with high confidence", () => {
    const result = pixelsToForelUle(solidBlock(60, 110, 90, 500));
    expect(result).not.toBeNull();
    expect(result!.index).toBeGreaterThanOrEqual(1);
    expect(result!.index).toBeLessThanOrEqual(21);
    expect(result!.confidence).toBeGreaterThan(0.8);
  });

  it("ignores fully transparent pixels", () => {
    const arr = solidBlock(60, 110, 90, 500);
    for (let i = 0; i < 400; i++) arr[i * 4 + 3] = 0;
    expect(pixelsToForelUle(arr)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/science/__tests__/forel-ule.test.ts`
Expected: FAIL — cannot resolve `../forel-ule`.

- [ ] **Step 3: Implement the conversion**

Create `src/lib/science/forel-ule.ts`:

```typescript
import { FU_TABLE } from "./forel-ule-table";

const HUE_REFERENCE = { x: 1 / 3, y: 1 / 3 };
const MIN_USABLE_PIXELS = 100;

function gammaExpand(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function srgbToXyz(r: number, g: number, b: number) {
  const rl = gammaExpand(r);
  const gl = gammaExpand(g);
  const bl = gammaExpand(b);
  return {
    x: 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl,
    y: 0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl,
    z: 0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl,
  };
}

export function chromaticity(xyz: { x: number; y: number; z: number }) {
  const sum = xyz.x + xyz.y + xyz.z;
  if (sum === 0) return { x: 0, y: 0 };
  return { x: xyz.x / sum, y: xyz.y / sum };
}

export function hueAngle(chroma: { x: number; y: number }): number {
  const dx = chroma.x - HUE_REFERENCE.x;
  const dy = chroma.y - HUE_REFERENCE.y;
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function hueAngleToForelUle(angle: number): number {
  for (const entry of FU_TABLE) {
    if (angle <= entry.hueAngleMax && angle >= entry.hueAngleMin) {
      return entry.index;
    }
  }
  return angle > FU_TABLE[0].hueAngleMax ? 1 : 21;
}

export function pixelsToForelUle(pixels: Uint8ClampedArray) {
  const angles: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 255) continue;
    const chroma = chromaticity(
      srgbToXyz(pixels[i], pixels[i + 1], pixels[i + 2]),
    );
    if (chroma.x === 0 && chroma.y === 0) continue;
    angles.push(hueAngle(chroma));
  }

  if (angles.length < MIN_USABLE_PIXELS) return null;

  const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
  const variance =
    angles.reduce((acc, a) => acc + (a - mean) ** 2, 0) / angles.length;
  const spread = Math.sqrt(variance);

  return {
    index: hueAngleToForelUle(mean),
    hueAngle: mean,
    confidence: Math.max(0, Math.min(1, 1 - spread / 30)),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/science/__tests__/forel-ule.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/science
git commit -m "Derive Forel-Ule index from image pixels via WACODI chain"
git push
```

---

### Task 4: Survey answers to normalised indicators

**Files:**
- Create: `src/lib/science/indicators.ts`, `src/types/observation.ts`
- Test: `src/lib/science/__tests__/indicators.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type SurveyAnswers = { odour: "none"|"musty"|"sewage"|"chemical"; foam: boolean; litter: 0|1|2|3; deadFish: boolean; visibleAlgae: boolean; clarity: "clear"|"slightly_turbid"|"turbid"|"opaque"; flow: "normal"|"low"|"stagnant"|"high"; indicatorTaxa: TaxonCode[]; forelUle: number | null; measurements: Measurements }`
  - `type TaxonCode = "mayfly"|"stonefly"|"caddisfly"|"freshwater_shrimp"|"leech"|"worm"|"none_seen"`
  - `type Measurements = { ph?: number; dissolvedOxygen?: number; temperature?: number; nitrate?: number }`
  - `type Indicator = { code: string; value: number; source: string }`
  - `toIndicators(answers: SurveyAnswers): Indicator[]`
  - `ecologicalEvidence(answers: SurveyAnswers): { good: number; bad: number }` — pseudo-counts for the Beta update in Task 6

**Method.** Indicator taxa sensitivity follows BMWP family-score logic: Ephemeroptera, Plecoptera and Trichoptera indicate clean water; oligochaete worms and leeches indicate organic pollution.

- [ ] **Step 1: Write the failing test**

Create `src/lib/science/__tests__/indicators.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { toIndicators, ecologicalEvidence } from "../indicators";
import type { SurveyAnswers } from "@/types/observation";

const clean: SurveyAnswers = {
  odour: "none",
  foam: false,
  litter: 0,
  deadFish: false,
  visibleAlgae: false,
  clarity: "clear",
  flow: "normal",
  indicatorTaxa: ["mayfly", "caddisfly"],
  forelUle: 3,
  measurements: {},
};

const polluted: SurveyAnswers = {
  odour: "sewage",
  foam: true,
  litter: 3,
  deadFish: true,
  visibleAlgae: true,
  clarity: "opaque",
  flow: "stagnant",
  indicatorTaxa: ["worm", "leech"],
  forelUle: 18,
  measurements: { ph: 8.9, dissolvedOxygen: 2.1 },
};

describe("toIndicators", () => {
  it("emits an indicator for every supplied measurement", () => {
    const codes = toIndicators(polluted).map((i) => i.code);
    expect(codes).toContain("pH");
    expect(codes).toContain("dissolvedO2");
  });

  it("omits measurements that were not supplied", () => {
    const codes = toIndicators(clean).map((i) => i.code);
    expect(codes).not.toContain("pH");
  });

  it("maps sewage odour to a coliform proxy", () => {
    const coliform = toIndicators(polluted).find((i) => i.code === "coliforms");
    expect(coliform).toBeDefined();
    expect(coliform!.value).toBeGreaterThan(0);
  });

  it("maps observed taxa to a macroinvertebrate indicator", () => {
    const taxa = toIndicators(clean).find(
      (i) => i.code === "macroinvertebreates",
    );
    expect(taxa).toBeDefined();
  });

  it("cites a source on every indicator", () => {
    for (const indicator of toIndicators(polluted)) {
      expect(indicator.source.length).toBeGreaterThan(0);
    }
  });
});

describe("ecologicalEvidence", () => {
  it("weighs a clean survey toward good", () => {
    const e = ecologicalEvidence(clean);
    expect(e.good).toBeGreaterThan(e.bad);
  });

  it("weighs a polluted survey toward bad", () => {
    const e = ecologicalEvidence(polluted);
    expect(e.bad).toBeGreaterThan(e.good);
  });

  it("never returns negative pseudo-counts", () => {
    for (const answers of [clean, polluted]) {
      const e = ecologicalEvidence(answers);
      expect(e.good).toBeGreaterThanOrEqual(0);
      expect(e.bad).toBeGreaterThanOrEqual(0);
    }
  });

  it("produces weak evidence when nothing was observed", () => {
    const empty: SurveyAnswers = {
      ...clean,
      indicatorTaxa: ["none_seen"],
      forelUle: null,
    };
    const e = ecologicalEvidence(empty);
    expect(e.good + e.bad).toBeLessThan(
      ecologicalEvidence(clean).good + ecologicalEvidence(clean).bad,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/science/__tests__/indicators.test.ts`
Expected: FAIL — cannot resolve `../indicators`.

- [ ] **Step 3: Define the observation types**

Create `src/types/observation.ts`:

```typescript
export type TaxonCode =
  | "mayfly"
  | "stonefly"
  | "caddisfly"
  | "freshwater_shrimp"
  | "leech"
  | "worm"
  | "none_seen";

export type Measurements = {
  ph?: number;
  dissolvedOxygen?: number;
  temperature?: number;
  nitrate?: number;
};

export type SurveyAnswers = {
  odour: "none" | "musty" | "sewage" | "chemical";
  foam: boolean;
  litter: 0 | 1 | 2 | 3;
  deadFish: boolean;
  visibleAlgae: boolean;
  clarity: "clear" | "slightly_turbid" | "turbid" | "opaque";
  flow: "normal" | "low" | "stagnant" | "high";
  indicatorTaxa: TaxonCode[];
  forelUle: number | null;
  measurements: Measurements;
};
```

- [ ] **Step 4: Implement the mapping**

Create `src/lib/science/indicators.ts`:

```typescript
import type { SurveyAnswers, TaxonCode } from "@/types/observation";

export type Indicator = { code: string; value: number; source: string };

const BMWP_SOURCE =
  "Family sensitivity after the Biological Monitoring Working Party (BMWP) score system";
const SURVEY_SOURCE = "Rivulet structured survey, derived proxy";

const TAXON_SENSITIVITY: Record<TaxonCode, number> = {
  stonefly: 10,
  mayfly: 9,
  caddisfly: 8,
  freshwater_shrimp: 6,
  leech: 3,
  worm: 1,
  none_seen: 0,
};

const CLARITY_TSS: Record<SurveyAnswers["clarity"], number> = {
  clear: 0,
  slightly_turbid: 1,
  turbid: 2,
  opaque: 3,
};

export function toIndicators(answers: SurveyAnswers): Indicator[] {
  const indicators: Indicator[] = [];
  const { measurements } = answers;

  if (measurements.ph !== undefined) {
    indicators.push({ code: "pH", value: measurements.ph, source: "Field test strip reading" });
  }
  if (measurements.dissolvedOxygen !== undefined) {
    indicators.push({ code: "dissolvedO2", value: measurements.dissolvedOxygen, source: "Field test reading" });
  }
  if (measurements.temperature !== undefined) {
    indicators.push({ code: "waterTemperature", value: measurements.temperature, source: "Field thermometer reading" });
  }
  if (measurements.nitrate !== undefined) {
    indicators.push({ code: "nitrate", value: measurements.nitrate, source: "Field test strip reading" });
  }

  indicators.push({
    code: "tss",
    value: CLARITY_TSS[answers.clarity],
    source: `${SURVEY_SOURCE}: visual clarity ordinal, not a gravimetric measurement`,
  });

  if (answers.odour === "sewage") {
    indicators.push({
      code: "coliforms",
      value: 1,
      source: `${SURVEY_SOURCE}: sewage odour as a faecal contamination proxy`,
    });
  }

  if (answers.visibleAlgae) {
    indicators.push({ code: "macrophytes", value: 1, source: `${SURVEY_SOURCE}: visible algal growth` });
  }

  const observed = answers.indicatorTaxa.filter((t) => t !== "none_seen");
  if (observed.length > 0) {
    const score = observed.reduce((acc, t) => acc + TAXON_SENSITIVITY[t], 0);
    indicators.push({ code: "macroinvertebreates", value: score, source: BMWP_SOURCE });
  }

  indicators.push({
    code: "hydrology",
    value: answers.flow === "stagnant" ? 0 : answers.flow === "low" ? 1 : 2,
    source: `${SURVEY_SOURCE}: observed flow state`,
  });

  indicators.push({
    code: "LandUse",
    value: answers.litter,
    source: `${SURVEY_SOURCE}: visible litter on the margins`,
  });

  return indicators;
}

export function ecologicalEvidence(answers: SurveyAnswers): {
  good: number;
  bad: number;
} {
  let good = 0;
  let bad = 0;

  const observed = answers.indicatorTaxa.filter((t) => t !== "none_seen");
  for (const taxon of observed) {
    const sensitivity = TAXON_SENSITIVITY[taxon];
    if (sensitivity >= 6) good += sensitivity / 10;
    else bad += (7 - sensitivity) / 10;
  }

  if (answers.forelUle !== null) {
    if (answers.forelUle <= 5) good += 1;
    else if (answers.forelUle >= 13) bad += 1;
    else good += 0.25;
  }

  if (answers.odour === "sewage" || answers.odour === "chemical") bad += 1.5;
  if (answers.foam) bad += 0.5;
  if (answers.deadFish) bad += 2;
  if (answers.visibleAlgae) bad += 0.75;
  if (answers.flow === "stagnant") bad += 0.5;
  if (answers.litter >= 2) bad += 0.5;

  if (answers.clarity === "clear") good += 0.5;
  if (answers.clarity === "opaque") bad += 1;

  return { good, bad };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/science/__tests__/indicators.test.ts`
Expected: all passed.

- [ ] **Step 6: Commit and push**

```bash
git add src/lib/science src/types
git commit -m "Map survey answers to cited ecological indicators"
git push
```

---

### Task 5: Observation quality weighting

**Files:**
- Create: `src/lib/science/weighting.ts`
- Test: `src/lib/science/__tests__/weighting.test.ts`

**Interfaces:**
- Consumes: `SurveyAnswers` from Task 4
- Produces: `observationWeight(input: WeightInput): number` returning 0.1–1.0, and `type WeightInput = { hasPhoto: boolean; forelUleConfidence: number | null; gpsAccuracyMetres: number | null; measurementCount: number; ageHours: number }`

**Note.** Observer trust score is a Phase 2 input. This phase weights only on evidence quality, and `observationWeight` must remain a pure function so Phase 2 can multiply a trust factor onto it without restructuring.

- [ ] **Step 1: Write the failing test**

Create `src/lib/science/__tests__/weighting.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { observationWeight } from "../weighting";

const baseline = {
  hasPhoto: true,
  forelUleConfidence: 0.9,
  gpsAccuracyMetres: 8,
  measurementCount: 2,
  ageHours: 1,
};

describe("observationWeight", () => {
  it("stays within bounds for a strong observation", () => {
    const w = observationWeight(baseline);
    expect(w).toBeGreaterThan(0.1);
    expect(w).toBeLessThanOrEqual(1);
  });

  it("scores a photo-backed observation above one without", () => {
    const withPhoto = observationWeight(baseline);
    const without = observationWeight({
      ...baseline,
      hasPhoto: false,
      forelUleConfidence: null,
    });
    expect(withPhoto).toBeGreaterThan(without);
  });

  it("penalises poor GPS accuracy", () => {
    const precise = observationWeight(baseline);
    const vague = observationWeight({ ...baseline, gpsAccuracyMetres: 500 });
    expect(precise).toBeGreaterThan(vague);
  });

  it("decays with age", () => {
    const fresh = observationWeight(baseline);
    const stale = observationWeight({ ...baseline, ageHours: 24 * 90 });
    expect(fresh).toBeGreaterThan(stale);
  });

  it("never drops below the floor", () => {
    const w = observationWeight({
      hasPhoto: false,
      forelUleConfidence: null,
      gpsAccuracyMetres: 10000,
      measurementCount: 0,
      ageHours: 24 * 3650,
    });
    expect(w).toBeGreaterThanOrEqual(0.1);
  });

  it("treats unknown GPS accuracy as poor, not as good", () => {
    const known = observationWeight({ ...baseline, gpsAccuracyMetres: 8 });
    const unknown = observationWeight({ ...baseline, gpsAccuracyMetres: null });
    expect(unknown).toBeLessThan(known);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/science/__tests__/weighting.test.ts`
Expected: FAIL — cannot resolve `../weighting`.

- [ ] **Step 3: Implement the weighting**

Create `src/lib/science/weighting.ts`:

```typescript
export type WeightInput = {
  hasPhoto: boolean;
  forelUleConfidence: number | null;
  gpsAccuracyMetres: number | null;
  measurementCount: number;
  ageHours: number;
};

const FLOOR = 0.1;
const HALF_LIFE_HOURS = 24 * 30;

export function observationWeight(input: WeightInput): number {
  let weight = 0.5;

  if (input.hasPhoto) {
    weight += 0.2 * (input.forelUleConfidence ?? 0.5);
  }

  weight += Math.min(input.measurementCount, 4) * 0.05;

  const accuracy = input.gpsAccuracyMetres ?? 1000;
  weight *= accuracy <= 20 ? 1 : accuracy <= 100 ? 0.85 : 0.6;

  weight *= Math.pow(0.5, input.ageHours / HALF_LIFE_HOURS);

  return Math.max(FLOOR, Math.min(1, weight));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/science/__tests__/weighting.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/science
git commit -m "Weight observations by evidence quality"
git push
```

---

### Task 6: Bayesian aggregation with credible intervals

**Files:**
- Create: `src/lib/science/bayes.ts`
- Test: `src/lib/science/__tests__/bayes.test.ts`

**Interfaces:**
- Consumes: `ecologicalEvidence` (Task 4), `observationWeight` (Task 5)
- Produces:
  - `type WeightedEvidence = { good: number; bad: number; weight: number }`
  - `type Posterior = { mean: number; lower: number; upper: number; alpha: number; beta: number; effectiveN: number }`
  - `aggregate(evidence: WeightedEvidence[], prior?: { alpha: number; beta: number }): Posterior`
  - `dataConfidence(input: { observationCount: number; uniqueObservers: number; newestAgeHours: number; effectiveN: number }): number`

**Method.** Beta–Bernoulli conjugate updating. Each observation contributes weight-scaled pseudo-counts. The interval is the 90% equal-tailed credible interval of the Beta posterior, computed from an incomplete beta inverse.

- [ ] **Step 1: Write the failing test**

Create `src/lib/science/__tests__/bayes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { aggregate, dataConfidence } from "../bayes";

describe("aggregate", () => {
  it("returns the prior mean when there is no evidence", () => {
    const p = aggregate([]);
    expect(p.mean).toBeCloseTo(0.5, 6);
    expect(p.effectiveN).toBe(0);
  });

  it("keeps the interval ordered around the mean", () => {
    const p = aggregate([{ good: 3, bad: 1, weight: 1 }]);
    expect(p.lower).toBeLessThanOrEqual(p.mean);
    expect(p.mean).toBeLessThanOrEqual(p.upper);
    expect(p.lower).toBeGreaterThanOrEqual(0);
    expect(p.upper).toBeLessThanOrEqual(1);
  });

  it("narrows the interval as consistent evidence accumulates", () => {
    const few = aggregate([{ good: 3, bad: 1, weight: 1 }]);
    const many = aggregate(
      Array.from({ length: 30 }, () => ({ good: 3, bad: 1, weight: 1 })),
    );
    expect(many.upper - many.lower).toBeLessThan(few.upper - few.lower);
  });

  it("keeps the mean near one half when evidence conflicts", () => {
    const p = aggregate([
      ...Array.from({ length: 10 }, () => ({ good: 4, bad: 0, weight: 1 })),
      ...Array.from({ length: 10 }, () => ({ good: 0, bad: 4, weight: 1 })),
    ]);
    expect(p.mean).toBeGreaterThan(0.4);
    expect(p.mean).toBeLessThan(0.6);
  });

  it("gives a low-weight observation less influence than a full-weight one", () => {
    const light = aggregate([{ good: 5, bad: 0, weight: 0.1 }]);
    const heavy = aggregate([{ good: 5, bad: 0, weight: 1 }]);
    expect(heavy.mean).toBeGreaterThan(light.mean);
  });

  it("moves toward zero when evidence is bad", () => {
    const p = aggregate(
      Array.from({ length: 20 }, () => ({ good: 0, bad: 4, weight: 1 })),
    );
    expect(p.mean).toBeLessThan(0.2);
  });
});

describe("dataConfidence", () => {
  it("returns zero when there are no observations", () => {
    expect(
      dataConfidence({
        observationCount: 0,
        uniqueObservers: 0,
        newestAgeHours: 0,
        effectiveN: 0,
      }),
    ).toBe(0);
  });

  it("rewards more observers over a single prolific one", () => {
    const solo = dataConfidence({
      observationCount: 10,
      uniqueObservers: 1,
      newestAgeHours: 2,
      effectiveN: 10,
    });
    const crowd = dataConfidence({
      observationCount: 10,
      uniqueObservers: 6,
      newestAgeHours: 2,
      effectiveN: 10,
    });
    expect(crowd).toBeGreaterThan(solo);
  });

  it("decays as the newest observation ages", () => {
    const fresh = dataConfidence({
      observationCount: 8,
      uniqueObservers: 4,
      newestAgeHours: 2,
      effectiveN: 8,
    });
    const stale = dataConfidence({
      observationCount: 8,
      uniqueObservers: 4,
      newestAgeHours: 24 * 120,
      effectiveN: 8,
    });
    expect(fresh).toBeGreaterThan(stale);
  });

  it("stays within zero and one", () => {
    const c = dataConfidence({
      observationCount: 500,
      uniqueObservers: 200,
      newestAgeHours: 0,
      effectiveN: 500,
    });
    expect(c).toBeLessThanOrEqual(1);
    expect(c).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/science/__tests__/bayes.test.ts`
Expected: FAIL — cannot resolve `../bayes`.

- [ ] **Step 3: Implement the aggregation**

Create `src/lib/science/bayes.ts`:

```typescript
export type WeightedEvidence = { good: number; bad: number; weight: number };

export type Posterior = {
  mean: number;
  lower: number;
  upper: number;
  alpha: number;
  beta: number;
  effectiveN: number;
};

const UNIFORM_PRIOR = { alpha: 1, beta: 1 };
const CREDIBLE_MASS = 0.9;

function logGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;

  let f = 1;
  let c = 1;
  let d = 0;
  for (let i = 0; i <= 300; i++) {
    const m = Math.floor(i / 2);
    let numerator: number;
    if (i === 0) numerator = 1;
    else if (i % 2 === 0)
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else
      numerator =
        (-((a + m) * (a + b + m)) * x) / ((a + 2 * m) * (a + 2 * m + 1));

    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;

    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;

    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-10) break;
  }

  const result = front * (f - 1);
  return x < (a + 1) / (a + b + 2) ? result : 1 - betaCdfMirror(x, a, b, lbeta);
}

function betaCdfMirror(x: number, a: number, b: number, lbeta: number): number {
  const front =
    Math.exp(b * Math.log(1 - x) + a * Math.log(x) - lbeta) / b;
  let f = 1;
  let c = 1;
  let d = 0;
  const y = 1 - x;
  for (let i = 0; i <= 300; i++) {
    const m = Math.floor(i / 2);
    let numerator: number;
    if (i === 0) numerator = 1;
    else if (i % 2 === 0)
      numerator = (m * (a - m) * y) / ((b + 2 * m - 1) * (b + 2 * m));
    else
      numerator =
        (-((b + m) * (a + b + m)) * y) / ((b + 2 * m) * (b + 2 * m + 1));

    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;

    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;

    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-10) break;
  }
  return front * (f - 1);
}

function betaQuantile(p: number, a: number, b: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function aggregate(
  evidence: WeightedEvidence[],
  prior = UNIFORM_PRIOR,
): Posterior {
  let alpha = prior.alpha;
  let beta = prior.beta;
  let effectiveN = 0;

  for (const item of evidence) {
    alpha += item.good * item.weight;
    beta += item.bad * item.weight;
    effectiveN += item.weight;
  }

  const tail = (1 - CREDIBLE_MASS) / 2;

  return {
    mean: alpha / (alpha + beta),
    lower: betaQuantile(tail, alpha, beta),
    upper: betaQuantile(1 - tail, alpha, beta),
    alpha,
    beta,
    effectiveN,
  };
}

export function dataConfidence(input: {
  observationCount: number;
  uniqueObservers: number;
  newestAgeHours: number;
  effectiveN: number;
}): number {
  if (input.observationCount === 0) return 0;

  const volume = 1 - Math.exp(-input.effectiveN / 5);
  const diversity = 1 - Math.exp(-input.uniqueObservers / 3);
  const recency = Math.pow(0.5, input.newestAgeHours / (24 * 60));

  const score = volume * 0.4 + diversity * 0.3 + recency * 0.3;
  return Math.max(0, Math.min(1, score));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/science/__tests__/bayes.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/science
git commit -m "Aggregate weighted evidence into a Beta posterior with credible intervals"
git push
```

---

### Task 7: WFD class mapping and method versioning

**Files:**
- Create: `src/lib/science/wfd.ts`, `src/lib/science/method-version.ts`
- Test: `src/lib/science/__tests__/wfd.test.ts`

**Interfaces:**
- Consumes: `Posterior` from Task 6
- Produces:
  - `type WfdClass = "high"|"good"|"moderate"|"poor"|"bad"`
  - `type WfdAssessment = { klass: WfdClass | null; probabilities: Record<WfdClass, number>; sufficientData: boolean }`
  - `classify(posterior: Posterior, confidence: number): WfdAssessment`
  - `WFD_BOUNDARIES: Record<WfdClass, { min: number; max: number }>`
  - `METHOD_VERSION: { version: string; publishedAt: string; citations: string[] }`

**Method.** The WFD expresses ecological status as a five-class Ecological Quality Ratio on a 0–1 scale, with equal-width class boundaries at 0.2 intervals. Class probabilities are the posterior mass falling inside each band.

- [ ] **Step 1: Write the failing test**

Create `src/lib/science/__tests__/wfd.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classify, WFD_BOUNDARIES } from "../wfd";
import { aggregate } from "../bayes";
import { METHOD_VERSION } from "../method-version";

describe("WFD_BOUNDARIES", () => {
  it("covers the unit interval without gaps", () => {
    const bands = Object.values(WFD_BOUNDARIES).sort((a, b) => a.min - b.min);
    expect(bands[0].min).toBe(0);
    expect(bands[bands.length - 1].max).toBe(1);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].min).toBeCloseTo(bands[i - 1].max, 6);
    }
  });
});

describe("classify", () => {
  it("refuses to assign a class when confidence is too low", () => {
    const result = classify(aggregate([{ good: 1, bad: 0, weight: 0.1 }]), 0.05);
    expect(result.sufficientData).toBe(false);
    expect(result.klass).toBeNull();
  });

  it("assigns bad to strongly negative evidence", () => {
    const posterior = aggregate(
      Array.from({ length: 40 }, () => ({ good: 0, bad: 5, weight: 1 })),
    );
    const result = classify(posterior, 0.9);
    expect(result.sufficientData).toBe(true);
    expect(result.klass).toBe("bad");
  });

  it("assigns high to strongly positive evidence", () => {
    const posterior = aggregate(
      Array.from({ length: 40 }, () => ({ good: 5, bad: 0, weight: 1 })),
    );
    expect(classify(posterior, 0.9).klass).toBe("high");
  });

  it("returns probabilities that sum to one", () => {
    const posterior = aggregate([{ good: 3, bad: 2, weight: 1 }]);
    const total = Object.values(classify(posterior, 0.8).probabilities).reduce(
      (a, b) => a + b,
      0,
    );
    expect(total).toBeCloseTo(1, 4);
  });

  it("names the most probable class as the assigned class", () => {
    const posterior = aggregate([{ good: 8, bad: 2, weight: 1 }]);
    const result = classify(posterior, 0.8);
    const best = (Object.entries(result.probabilities) as [string, number][])
      .sort((a, b) => b[1] - a[1])[0][0];
    expect(result.klass).toBe(best);
  });
});

describe("METHOD_VERSION", () => {
  it("is versioned and cites its sources", () => {
    expect(METHOD_VERSION.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(METHOD_VERSION.citations.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/science/__tests__/wfd.test.ts`
Expected: FAIL — cannot resolve `../wfd`.

- [ ] **Step 3: Implement the method version registry**

Create `src/lib/science/method-version.ts`:

```typescript
export const METHOD_VERSION = {
  version: "1.0.0",
  publishedAt: "2026-09-15",
  citations: [
    "Directive 2000/60/EC of the European Parliament and of the Council establishing a framework for Community action in the field of water policy (Water Framework Directive)",
    "Novoa et al. 2015, WACODI: A generic algorithm to derive the intrinsic color of natural waters from digital images, Limnology and Oceanography: Methods 13:684-697",
    "Biological Monitoring Working Party (BMWP) family sensitivity score system for freshwater macroinvertebrates",
    "HL7 Europe, OneAquaHealth FHIR Implementation Guide, github.com/hl7-eu/oah",
  ],
} as const;
```

- [ ] **Step 4: Implement the classifier**

Create `src/lib/science/wfd.ts`:

```typescript
import type { Posterior } from "./bayes";

export type WfdClass = "high" | "good" | "moderate" | "poor" | "bad";

export type WfdAssessment = {
  klass: WfdClass | null;
  probabilities: Record<WfdClass, number>;
  sufficientData: boolean;
};

export const MIN_CONFIDENCE_FOR_CLASS = 0.25;

export const WFD_BOUNDARIES: Record<WfdClass, { min: number; max: number }> = {
  bad: { min: 0, max: 0.2 },
  poor: { min: 0.2, max: 0.4 },
  moderate: { min: 0.4, max: 0.6 },
  good: { min: 0.6, max: 0.8 },
  high: { min: 0.8, max: 1 },
};

function betaPdf(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x));
}

function bandMass(
  min: number,
  max: number,
  alpha: number,
  beta: number,
): number {
  const steps = 500;
  const h = (max - min) / steps;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const x = min + i * h;
    const coefficient = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2;
    sum += coefficient * betaPdf(x, alpha, beta);
  }
  return (sum * h) / 3;
}

export function classify(
  posterior: Posterior,
  confidence: number,
): WfdAssessment {
  const raw = {} as Record<WfdClass, number>;
  let total = 0;

  for (const klass of Object.keys(WFD_BOUNDARIES) as WfdClass[]) {
    const band = WFD_BOUNDARIES[klass];
    const mass = bandMass(band.min, band.max, posterior.alpha, posterior.beta);
    raw[klass] = mass;
    total += mass;
  }

  const probabilities = {} as Record<WfdClass, number>;
  for (const klass of Object.keys(raw) as WfdClass[]) {
    probabilities[klass] = total > 0 ? raw[klass] / total : 0;
  }

  if (confidence < MIN_CONFIDENCE_FOR_CLASS) {
    return { klass: null, probabilities, sufficientData: false };
  }

  const best = (Object.entries(probabilities) as [WfdClass, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0][0];

  return { klass: best, probabilities, sufficientData: true };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/science/__tests__/wfd.test.ts`
Expected: all passed.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 7: Commit and push**

```bash
git add src/lib/science
git commit -m "Classify posteriors into WFD ecological status with class probabilities"
git push
```

---

### Task 8: Database schema, migrations and Coimbra seed

**Files:**
- Create: `supabase/migrations/0001_initial.sql`, `scripts/seed/fetch-waterbodies.ts`, `scripts/seed/seed.ts`, `src/lib/db/client.ts`
- Test: `src/lib/db/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: tables `waterbodies`, `observers`, `observations`, `index_snapshots`; `supabaseAdmin()` and `supabaseAnon()` clients

- [ ] **Step 1: Create the Supabase project and capture credentials**

Create a project at supabase.com, enable the PostGIS extension, then copy the URL, anon key and service role key into `.env.local` using the names in `.env.example`. Never commit `.env.local`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/0001_initial.sql`:

```sql
create extension if not exists postgis;

create table waterbodies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  kind text not null check (kind in ('river','stream','pond','lake')),
  geometry geometry(Geometry, 4326) not null,
  centroid geography(Point, 4326) not null,
  wfd_code text,
  population_within_500m integer,
  has_recreation_area boolean not null default false,
  has_playground boolean not null default false,
  distance_to_abstraction_m integer,
  created_at timestamptz not null default now()
);

create index waterbodies_geometry_idx on waterbodies using gist (geometry);
create index waterbodies_city_idx on waterbodies (city);

create table observers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  locale text not null default 'en',
  email text,
  is_minor boolean not null default false,
  trust_score numeric not null default 0.5,
  created_at timestamptz not null default now()
);

create table observations (
  id uuid primary key default gen_random_uuid(),
  waterbody_id uuid not null references waterbodies(id) on delete cascade,
  observer_id uuid references observers(id) on delete set null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  location geography(Point, 4326) not null,
  gps_accuracy_m integer,
  photo_path text,
  forel_ule_index integer check (forel_ule_index between 1 and 21),
  forel_ule_confidence numeric,
  survey jsonb not null,
  indicators jsonb not null,
  quality_weight numeric not null,
  validation_status text not null default 'pending'
    check (validation_status in ('pending','auto_approved','flagged','human_approved','rejected'))
);

create index observations_waterbody_idx on observations (waterbody_id, observed_at desc);

create table index_snapshots (
  id uuid primary key default gen_random_uuid(),
  waterbody_id uuid not null references waterbodies(id) on delete cascade,
  computed_at timestamptz not null default now(),
  posterior_mean numeric not null,
  ci_lower numeric not null,
  ci_upper numeric not null,
  alpha numeric not null,
  beta numeric not null,
  wfd_class text check (wfd_class in ('high','good','moderate','poor','bad')),
  class_probabilities jsonb not null,
  data_confidence numeric not null,
  sufficient_data boolean not null,
  observation_count integer not null,
  unique_observers integer not null,
  method_version text not null,
  inputs_snapshot jsonb not null
);

create index index_snapshots_waterbody_idx
  on index_snapshots (waterbody_id, computed_at desc);
```

Apply it in the Supabase SQL editor, or with `npx supabase db push` if the CLI is linked.

- [ ] **Step 3: Write the Supabase clients**

```bash
npm install @supabase/supabase-js
```

Create `src/lib/db/client.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 4: Write the water body fetch script**

Create `scripts/seed/fetch-waterbodies.ts`. It queries the OpenStreetMap Overpass API for real waterways in each pilot city and writes `scripts/seed/waterbodies.json`:

```typescript
const CITIES = ["Coimbra", "Toulouse", "Benevento", "Gent", "Oslo"];

const ENDPOINT = "https://overpass-api.de/api/interpreter";

type OverpassWay = {
  tags?: { name?: string; waterway?: string };
  geometry?: { lon: number; lat: number }[];
};

async function fetchCity(city: string) {
  const query = `
    [out:json][timeout:90];
    area["name"="${city}"]["boundary"="administrative"]->.a;
    (
      way["waterway"~"^(river|stream)$"](area.a);
    );
    out geom;
  `;
  const response = await fetch(ENDPOINT, { method: "POST", body: query });
  if (!response.ok) throw new Error(`${city}: ${response.status}`);
  const data = (await response.json()) as { elements: OverpassWay[] };

  return data.elements
    .filter((el) => el.geometry && el.geometry.length > 1)
    .map((el) => ({
      name: el.tags?.name ?? `Unnamed ${el.tags?.waterway ?? "stream"}`,
      city,
      kind: el.tags?.waterway === "river" ? "river" : "stream",
      coordinates: el.geometry!.map((p) => [p.lon, p.lat]),
    }));
}

async function main() {
  const all = [];
  for (const city of CITIES) {
    console.log(`Fetching ${city}...`);
    all.push(...(await fetchCity(city)));
    await new Promise((r) => setTimeout(r, 5000));
  }
  const fs = await import("node:fs/promises");
  await fs.writeFile(
    "scripts/seed/waterbodies.json",
    JSON.stringify(all, null, 2),
  );
  console.log(`Wrote ${all.length} water bodies`);
}

main();
```

Run: `npx tsx scripts/seed/fetch-waterbodies.ts`

Install `tsx` first if missing: `npm install --save-dev tsx`

- [ ] **Step 5: Write the seed script**

Create `scripts/seed/seed.ts`. It inserts water bodies and generates plausible historical observations for Coimbra so the map is not empty:

```typescript
import { supabaseAdmin } from "../../src/lib/db/client";
import { toIndicators } from "../../src/lib/science/indicators";
import { observationWeight } from "../../src/lib/science/weighting";
import type { SurveyAnswers } from "../../src/types/observation";
import waterbodies from "./waterbodies.json";

type SeedWaterbody = {
  name: string;
  city: string;
  kind: "river" | "stream";
  coordinates: [number, number][];
};

function randomSurvey(polluted: boolean): SurveyAnswers {
  return {
    odour: polluted ? "sewage" : "none",
    foam: polluted && Math.random() > 0.5,
    litter: polluted ? 2 : 0,
    deadFish: polluted && Math.random() > 0.8,
    visibleAlgae: polluted && Math.random() > 0.4,
    clarity: polluted ? "turbid" : "clear",
    flow: polluted ? "low" : "normal",
    indicatorTaxa: polluted ? ["worm"] : ["mayfly", "caddisfly"],
    forelUle: polluted ? 15 : 4,
    measurements: {},
  };
}

async function main() {
  const db = supabaseAdmin();

  for (const wb of waterbodies as SeedWaterbody[]) {
    const line = `SRID=4326;LINESTRING(${wb.coordinates
      .map((c) => `${c[0]} ${c[1]}`)
      .join(",")})`;
    const mid = wb.coordinates[Math.floor(wb.coordinates.length / 2)];

    const { data, error } = await db
      .from("waterbodies")
      .insert({
        name: wb.name,
        city: wb.city,
        kind: wb.kind,
        geometry: line,
        centroid: `SRID=4326;POINT(${mid[0]} ${mid[1]})`,
        population_within_500m: Math.floor(Math.random() * 4000),
        has_recreation_area: Math.random() > 0.6,
        has_playground: Math.random() > 0.8,
      })
      .select("id")
      .single();

    if (error) {
      console.error(wb.name, error.message);
      continue;
    }

    if (wb.city !== "Coimbra") continue;

    const polluted = Math.random() > 0.6;
    const count = 3 + Math.floor(Math.random() * 8);

    for (let i = 0; i < count; i++) {
      const survey = randomSurvey(polluted);
      const ageHours = Math.random() * 24 * 45;
      await db.from("observations").insert({
        waterbody_id: data.id,
        observed_at: new Date(Date.now() - ageHours * 3600_000).toISOString(),
        location: `SRID=4326;POINT(${mid[0]} ${mid[1]})`,
        gps_accuracy_m: 10,
        forel_ule_index: survey.forelUle,
        forel_ule_confidence: 0.85,
        survey,
        indicators: toIndicators(survey),
        quality_weight: observationWeight({
          hasPhoto: true,
          forelUleConfidence: 0.85,
          gpsAccuracyMetres: 10,
          measurementCount: 0,
          ageHours,
        }),
        validation_status: "auto_approved",
      });
    }
  }

  console.log("Seed complete");
}

main();
```

Run: `npx tsx --env-file=.env.local scripts/seed/seed.ts`

- [ ] **Step 6: Write the schema test**

Create `src/lib/db/__tests__/schema.test.ts`:

```typescript
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
});
```

- [ ] **Step 7: Run the tests**

Run: `npm test`
Expected: all passed.

- [ ] **Step 8: Commit and push**

```bash
git add supabase scripts src/lib/db package.json package-lock.json
git commit -m "Add schema, PostGIS migration and pilot city seed from OpenStreetMap"
git push
```

Do not commit `scripts/seed/waterbodies.json` if it exceeds 5 MB; add it to `.gitignore` and document the fetch step in the README instead. Either way, add `"scripts"` to `exclude` in `tsconfig.json` so the production build never depends on locally fetched seed data.

---

### Task 9: Snapshot computation service

**Files:**
- Create: `src/lib/science/snapshot.ts`
- Test: `src/lib/science/__tests__/snapshot.test.ts`

**Interfaces:**
- Consumes: `aggregate`, `dataConfidence` (Task 6), `classify` (Task 7), `ecologicalEvidence` (Task 4), `METHOD_VERSION` (Task 7)
- Produces:
  - `type StoredObservation = { id: string; observedAt: string; observerId: string | null; survey: SurveyAnswers; qualityWeight: number }`
  - `type Snapshot = { posterior: Posterior; assessment: WfdAssessment; confidence: number; observationCount: number; uniqueObservers: number; methodVersion: string; inputs: SnapshotInput[] }`
  - `computeSnapshot(observations: StoredObservation[], now?: Date): Snapshot`

- [ ] **Step 1: Write the failing test**

Create `src/lib/science/__tests__/snapshot.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeSnapshot } from "../snapshot";
import type { SurveyAnswers } from "@/types/observation";

const cleanSurvey: SurveyAnswers = {
  odour: "none",
  foam: false,
  litter: 0,
  deadFish: false,
  visibleAlgae: false,
  clarity: "clear",
  flow: "normal",
  indicatorTaxa: ["mayfly"],
  forelUle: 3,
  measurements: {},
};

function observation(id: string, observerId: string | null, ageHours: number) {
  return {
    id,
    observerId,
    observedAt: new Date(Date.now() - ageHours * 3600_000).toISOString(),
    survey: cleanSurvey,
    qualityWeight: 0.8,
  };
}

describe("computeSnapshot", () => {
  it("reports insufficient data for an empty water body", () => {
    const snapshot = computeSnapshot([]);
    expect(snapshot.assessment.sufficientData).toBe(false);
    expect(snapshot.assessment.klass).toBeNull();
    expect(snapshot.confidence).toBe(0);
  });

  it("counts unique observers, not observations", () => {
    const snapshot = computeSnapshot([
      observation("a", "obs-1", 1),
      observation("b", "obs-1", 2),
      observation("c", "obs-2", 3),
    ]);
    expect(snapshot.observationCount).toBe(3);
    expect(snapshot.uniqueObservers).toBe(2);
  });

  it("counts each anonymous observation as its own observer", () => {
    const snapshot = computeSnapshot([
      observation("a", null, 1),
      observation("b", null, 2),
    ]);
    expect(snapshot.uniqueObservers).toBe(2);
  });

  it("records one traceable input per observation", () => {
    const snapshot = computeSnapshot([
      observation("a", "obs-1", 1),
      observation("b", "obs-2", 2),
    ]);
    expect(snapshot.inputs).toHaveLength(2);
    expect(snapshot.inputs[0].observationId).toBe("a");
    expect(snapshot.inputs[0].weight).toBeCloseTo(0.8, 6);
  });

  it("stamps the method version", () => {
    expect(computeSnapshot([]).methodVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("assigns a class once enough consistent evidence exists", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      observation(`o${i}`, `obs-${i}`, 2),
    );
    const snapshot = computeSnapshot(many);
    expect(snapshot.assessment.sufficientData).toBe(true);
    expect(snapshot.assessment.klass).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/science/__tests__/snapshot.test.ts`
Expected: FAIL — cannot resolve `../snapshot`.

- [ ] **Step 3: Implement the service**

Create `src/lib/science/snapshot.ts`:

```typescript
import { aggregate, dataConfidence, type Posterior } from "./bayes";
import { classify, type WfdAssessment } from "./wfd";
import { ecologicalEvidence } from "./indicators";
import { METHOD_VERSION } from "./method-version";
import type { SurveyAnswers } from "@/types/observation";

export type StoredObservation = {
  id: string;
  observedAt: string;
  observerId: string | null;
  survey: SurveyAnswers;
  qualityWeight: number;
};

export type SnapshotInput = {
  observationId: string;
  weight: number;
  good: number;
  bad: number;
};

export type Snapshot = {
  posterior: Posterior;
  assessment: WfdAssessment;
  confidence: number;
  observationCount: number;
  uniqueObservers: number;
  methodVersion: string;
  inputs: SnapshotInput[];
};

export function computeSnapshot(
  observations: StoredObservation[],
  now: Date = new Date(),
): Snapshot {
  const inputs: SnapshotInput[] = observations.map((o) => {
    const evidence = ecologicalEvidence(o.survey);
    return {
      observationId: o.id,
      weight: o.qualityWeight,
      good: evidence.good,
      bad: evidence.bad,
    };
  });

  const posterior = aggregate(
    inputs.map((i) => ({ good: i.good, bad: i.bad, weight: i.weight })),
  );

  const observerKeys = new Set(
    observations.map((o, i) => o.observerId ?? `anonymous-${i}`),
  );

  const newestAgeHours =
    observations.length === 0
      ? Number.POSITIVE_INFINITY
      : Math.min(
          ...observations.map(
            (o) =>
              (now.getTime() - new Date(o.observedAt).getTime()) / 3600_000,
          ),
        );

  const confidence = dataConfidence({
    observationCount: observations.length,
    uniqueObservers: observerKeys.size,
    newestAgeHours: observations.length === 0 ? 0 : newestAgeHours,
    effectiveN: posterior.effectiveN,
  });

  return {
    posterior,
    assessment: classify(posterior, confidence),
    confidence,
    observationCount: observations.length,
    uniqueObservers: observerKeys.size,
    methodVersion: METHOD_VERSION.version,
    inputs,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/science/__tests__/snapshot.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/science
git commit -m "Compute traceable water body snapshots from stored observations"
git push
```

---

### Task 10: FHIR serialisation conforming to the OneAquaHealth IG

**Files:**
- Create: `src/lib/fhir/codes.ts`, `src/lib/fhir/observation.ts` (holds both `toLocationOah` and `toObservationIndicators`)
- Test: `src/lib/fhir/__tests__/observation.test.ts`

**Interfaces:**
- Consumes: `Indicator` (Task 4), `Snapshot` (Task 9)
- Produces:
  - `OAH_SYSTEM`, `RIVULET_SYSTEM`, `OAH_CODES`, `RIVULET_CODES`
  - `toLocationOah(waterbody: WaterbodyRecord): FhirLocation`
  - `toObservationIndicators(input: IndicatorObservationInput): FhirObservation`
  - `snapshotToObservations(snapshot: Snapshot, waterbodyId: string, when: string): FhirObservation[]`

**Conformance note.** `ObservationIndicatorsOah` requires `status` fixed to `final`, `code` from the OAH indicators value set, `subject` referencing a `LocationOah`, `effective[x]`, and `performer`. `value[x]` is limited to `CodeableConcept` or `Quantity`. Forel–Ule index, WFD class and data confidence have no OAH code and therefore use the Rivulet extension system, each documented in `codes.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/fhir/__tests__/observation.test.ts`:

```typescript
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/fhir/__tests__/observation.test.ts`
Expected: FAIL — cannot resolve `../codes`.

- [ ] **Step 3: Define the code systems**

Create `src/lib/fhir/codes.ts`:

```typescript
export const OAH_SYSTEM =
  "http://hl7.eu/fhir/ig/oah/CodeSystem/temporarySystem-oah-eu";

export const RIVULET_SYSTEM =
  "https://rivulet.eco/fhir/CodeSystem/rivulet-derived";

export const OAH_PROFILE_INDICATORS =
  "http://hl7.eu/fhir/ig/oah/StructureDefinition/ObservationIndicatorsOah";

export const OAH_PROFILE_LOCATION =
  "http://hl7.eu/fhir/ig/oah/StructureDefinition/LocationOah";

/**
 * Codes taken verbatim from the OneAquaHealth IG code system, including its
 * own spellings. Do not correct `macroinvertebreates` or `morophology`.
 */
export const OAH_CODES = [
  "pH",
  "dissolvedO2",
  "waterTemperature",
  "tds",
  "tss",
  "conductivity",
  "nutrients",
  "total-phosphates",
  "nitrate",
  "sulphate",
  "chloride",
  "ammonium",
  "nitrite",
  "macroinvertebreates",
  "diatomes",
  "fishes",
  "macrophytes",
  "diatomTratology",
  "coliforms",
  "morophology",
  "hydrology",
  "LandUse",
  "riparianVegetation",
] as const;

/**
 * Concepts Rivulet derives that the OAH IG has no code for. Each entry names
 * the gap it fills so the extension is auditable rather than silent.
 */
export const RIVULET_CODES = {
  "forel-ule-index": "Forel-Ule index (1-21) — no OAH code for water colour",
  "wfd-ecological-status":
    "WFD ecological status class — no OAH code for the classified outcome",
  "data-confidence":
    "Rivulet data confidence (0-1) — no OAH code for evidence strength",
} as const;

export type OahCode = (typeof OAH_CODES)[number];
export type RivuletCode = keyof typeof RIVULET_CODES;

export function systemFor(code: string): string {
  return (OAH_CODES as readonly string[]).includes(code)
    ? OAH_SYSTEM
    : RIVULET_SYSTEM;
}
```

- [ ] **Step 4: Implement the serialisers**

Create `src/lib/fhir/observation.ts`:

```typescript
import {
  OAH_PROFILE_INDICATORS,
  OAH_PROFILE_LOCATION,
  RIVULET_CODES,
  systemFor,
} from "./codes";

export type WaterbodyRecord = {
  id: string;
  name: string;
  city: string;
  centroidLon: number;
  centroidLat: number;
};

export type FhirLocation = {
  resourceType: "Location";
  id: string;
  meta: { profile: string[] };
  name: string;
  position?: { longitude: number; latitude: number };
  address: { city: string };
};

export type FhirCoding = { system: string; code: string; display?: string };

export type FhirObservation = {
  resourceType: "Observation";
  id: string;
  meta: { profile: string[] };
  status: "final";
  code: { coding: FhirCoding[] };
  subject: { reference: string };
  effectiveDateTime: string;
  performer: { display: string }[];
  valueQuantity?: { value: number; unit: string };
  valueCodeableConcept?: { coding: FhirCoding[] };
};

export type IndicatorValue =
  | { kind: "quantity"; value: number; unit: string }
  | { kind: "code"; code: string; display: string };

export type IndicatorObservationInput = {
  id: string;
  waterbodyId: string;
  effectiveDateTime: string;
  performerDisplay: string;
  code: string;
  value: IndicatorValue;
};

export function toLocationOah(waterbody: WaterbodyRecord): FhirLocation {
  return {
    resourceType: "Location",
    id: waterbody.id,
    meta: { profile: [OAH_PROFILE_LOCATION] },
    name: waterbody.name,
    position: {
      longitude: waterbody.centroidLon,
      latitude: waterbody.centroidLat,
    },
    address: { city: waterbody.city },
  };
}

export function toObservationIndicators(
  input: IndicatorObservationInput,
): FhirObservation {
  const system = systemFor(input.code);
  const display =
    system.includes("rivulet")
      ? RIVULET_CODES[input.code as keyof typeof RIVULET_CODES]
      : undefined;

  const observation: FhirObservation = {
    resourceType: "Observation",
    id: input.id,
    meta: { profile: [OAH_PROFILE_INDICATORS] },
    status: "final",
    code: { coding: [{ system, code: input.code, display }] },
    subject: { reference: `Location/${input.waterbodyId}` },
    effectiveDateTime: input.effectiveDateTime,
    performer: [{ display: input.performerDisplay }],
  };

  if (input.value.kind === "quantity") {
    observation.valueQuantity = {
      value: input.value.value,
      unit: input.value.unit,
    };
  } else {
    observation.valueCodeableConcept = {
      coding: [
        {
          system: systemFor(input.code),
          code: input.value.code,
          display: input.value.display,
        },
      ],
    };
  }

  return observation;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/fhir/__tests__/observation.test.ts`
Expected: all passed.

- [ ] **Step 6: Commit and push**

```bash
git add src/lib/fhir
git commit -m "Serialise indicators as OneAquaHealth IG conformant FHIR"
git push
```

---

### Task 11: Observation submission API

**Files:**
- Create: `src/app/api/observations/route.ts`, `src/lib/validation/observation-schema.ts`
- Test: `src/lib/validation/__tests__/observation-schema.test.ts`

**Interfaces:**
- Consumes: `SurveyAnswers` (Task 4), `observationWeight` (Task 5), `toIndicators` (Task 4), `supabaseAdmin` (Task 8)
- Produces: `observationSchema` (Zod), `POST /api/observations`

- [ ] **Step 1: Write the failing schema test**

Create `src/lib/validation/__tests__/observation-schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { observationSchema } from "../observation-schema";

const valid = {
  waterbodyId: "123e4567-e89b-12d3-a456-426614174000",
  observedAt: "2026-09-15T10:00:00.000Z",
  longitude: -8.42,
  latitude: 40.22,
  gpsAccuracyM: 12,
  forelUleIndex: 7,
  forelUleConfidence: 0.9,
  survey: {
    odour: "none",
    foam: false,
    litter: 0,
    deadFish: false,
    visibleAlgae: false,
    clarity: "clear",
    flow: "normal",
    indicatorTaxa: ["mayfly"],
    forelUle: 7,
    measurements: {},
  },
};

describe("observationSchema", () => {
  it("accepts a valid anonymous submission", () => {
    expect(observationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects coordinates outside the globe", () => {
    expect(
      observationSchema.safeParse({ ...valid, latitude: 120 }).success,
    ).toBe(false);
  });

  it("rejects a Forel-Ule index outside the scale", () => {
    expect(
      observationSchema.safeParse({ ...valid, forelUleIndex: 30 }).success,
    ).toBe(false);
  });

  it("accepts a submission with no photo-derived colour", () => {
    const result = observationSchema.safeParse({
      ...valid,
      forelUleIndex: null,
      forelUleConfidence: null,
      survey: { ...valid.survey, forelUle: null },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown odour value", () => {
    expect(
      observationSchema.safeParse({
        ...valid,
        survey: { ...valid.survey, odour: "lovely" },
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/validation/__tests__/observation-schema.test.ts`
Expected: FAIL — cannot resolve `../observation-schema`.

- [ ] **Step 3: Write the schema**

Create `src/lib/validation/observation-schema.ts`:

```typescript
import { z } from "zod";

export const surveySchema = z.object({
  odour: z.enum(["none", "musty", "sewage", "chemical"]),
  foam: z.boolean(),
  litter: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  deadFish: z.boolean(),
  visibleAlgae: z.boolean(),
  clarity: z.enum(["clear", "slightly_turbid", "turbid", "opaque"]),
  flow: z.enum(["normal", "low", "stagnant", "high"]),
  indicatorTaxa: z.array(
    z.enum([
      "mayfly",
      "stonefly",
      "caddisfly",
      "freshwater_shrimp",
      "leech",
      "worm",
      "none_seen",
    ]),
  ),
  forelUle: z.number().int().min(1).max(21).nullable(),
  measurements: z.object({
    ph: z.number().min(0).max(14).optional(),
    dissolvedOxygen: z.number().min(0).max(25).optional(),
    temperature: z.number().min(-5).max(50).optional(),
    nitrate: z.number().min(0).max(500).optional(),
  }),
});

export const observationSchema = z.object({
  waterbodyId: z.string().uuid(),
  observedAt: z.string().datetime(),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  gpsAccuracyM: z.number().int().min(0).nullable(),
  forelUleIndex: z.number().int().min(1).max(21).nullable(),
  forelUleConfidence: z.number().min(0).max(1).nullable(),
  survey: surveySchema,
});

export type ObservationPayload = z.infer<typeof observationSchema>;
```

- [ ] **Step 4: Run the schema test to verify it passes**

Run: `npx vitest run src/lib/validation/__tests__/observation-schema.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Write the submission route**

Create `src/app/api/observations/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { observationSchema } from "@/lib/validation/observation-schema";
import { toIndicators } from "@/lib/science/indicators";
import { observationWeight } from "@/lib/science/weighting";
import { supabaseAdmin } from "@/lib/db/client";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = observationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const ageHours =
    (Date.now() - new Date(payload.observedAt).getTime()) / 3_600_000;

  const weight = observationWeight({
    hasPhoto: payload.forelUleIndex !== null,
    forelUleConfidence: payload.forelUleConfidence,
    gpsAccuracyMetres: payload.gpsAccuracyM,
    measurementCount: Object.keys(payload.survey.measurements).length,
    ageHours: Math.max(0, ageHours),
  });

  const { data, error } = await supabaseAdmin()
    .from("observations")
    .insert({
      waterbody_id: payload.waterbodyId,
      observed_at: payload.observedAt,
      location: `SRID=4326;POINT(${payload.longitude} ${payload.latitude})`,
      gps_accuracy_m: payload.gpsAccuracyM,
      forel_ule_index: payload.forelUleIndex,
      forel_ule_confidence: payload.forelUleConfidence,
      survey: payload.survey,
      indicators: toIndicators(payload.survey),
      quality_weight: weight,
      validation_status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, qualityWeight: weight }, { status: 201 });
}
```

- [ ] **Step 6: Verify the build and full suite**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 7: Commit and push**

```bash
git add src/lib/validation src/app/api
git commit -m "Accept validated anonymous observations"
git push
```

---

### Task 12: Observation wizard with live Forel–Ule feedback

**Files:**
- Create: `src/app/observe/page.tsx`, `src/components/wizard/ObservationWizard.tsx`, `src/components/wizard/PhotoStep.tsx`, `src/components/wizard/SurveyStep.tsx`, `src/lib/science/extract-colour.ts`
- Test: `src/lib/science/__tests__/extract-colour.test.ts`

**Interfaces:**
- Consumes: `pixelsToForelUle` (Task 3), `observationSchema` (Task 11)
- Produces: `extractCentreRegion(image: ImageData, fraction?: number): Uint8ClampedArray`, the `/observe` route

- [ ] **Step 1: Write the failing test**

Create `src/lib/science/__tests__/extract-colour.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractCentreRegion } from "../extract-colour";

function imageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 10;
    data[i * 4 + 1] = 20;
    data[i * 4 + 2] = 30;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

describe("extractCentreRegion", () => {
  it("returns a quarter-width centre crop by default", () => {
    const region = extractCentreRegion(imageData(100, 100));
    expect(region.length / 4).toBe(50 * 50);
  });

  it("honours a custom fraction", () => {
    const region = extractCentreRegion(imageData(100, 100), 0.2);
    expect(region.length / 4).toBe(20 * 20);
  });

  it("preserves pixel values", () => {
    const region = extractCentreRegion(imageData(40, 40));
    expect(region[0]).toBe(10);
    expect(region[1]).toBe(20);
    expect(region[2]).toBe(30);
    expect(region[3]).toBe(255);
  });

  it("never returns more pixels than the source", () => {
    const source = imageData(10, 10);
    const region = extractCentreRegion(source, 1);
    expect(region.length).toBeLessThanOrEqual(source.data.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/science/__tests__/extract-colour.test.ts`
Expected: FAIL — cannot resolve `../extract-colour`.

- [ ] **Step 3: Implement the crop**

Create `src/lib/science/extract-colour.ts`:

```typescript
/**
 * Samples the centre of the frame, where the user is instructed to aim at
 * open water, avoiding banks and sky at the edges.
 */
export function extractCentreRegion(
  image: ImageData,
  fraction = 0.5,
): Uint8ClampedArray {
  const cropWidth = Math.max(1, Math.floor(image.width * fraction));
  const cropHeight = Math.max(1, Math.floor(image.height * fraction));
  const startX = Math.floor((image.width - cropWidth) / 2);
  const startY = Math.floor((image.height - cropHeight) / 2);

  const output = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  let cursor = 0;

  for (let y = startY; y < startY + cropHeight; y++) {
    for (let x = startX; x < startX + cropWidth; x++) {
      const source = (y * image.width + x) * 4;
      output[cursor++] = image.data[source];
      output[cursor++] = image.data[source + 1];
      output[cursor++] = image.data[source + 2];
      output[cursor++] = image.data[source + 3];
    }
  }

  return output;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/science/__tests__/extract-colour.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Build the photo step**

Create `src/components/wizard/PhotoStep.tsx`:

```tsx
"use client";

import { useState } from "react";
import { extractCentreRegion } from "@/lib/science/extract-colour";
import { pixelsToForelUle } from "@/lib/science/forel-ule";
import { FU_TABLE } from "@/lib/science/forel-ule-table";

type Props = {
  onResult: (result: { index: number; confidence: number } | null) => void;
};

export function PhotoStep({ onResult }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fu, setFu] = useState<{ index: number; confidence: number } | null>(
    null,
  );
  const [tooUnclear, setTooUnclear] = useState(false);

  async function handleFile(file: File) {
    const url = URL.createObjectURL(file);
    setPreview(url);

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);

    const region = extractCentreRegion(
      context.getImageData(0, 0, bitmap.width, bitmap.height),
    );
    const result = pixelsToForelUle(region);

    setTooUnclear(result === null);
    setFu(result);
    onResult(result);
  }

  const entry = fu ? FU_TABLE.find((e) => e.index === fu.index) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Point the centre of the frame at open water. Avoid the bank, your own
        shadow and reflections of the sky.
      </p>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="block w-full text-sm"
      />

      {preview && (
        <img src={preview} alt="Your water photo" className="w-full rounded-lg" />
      )}

      {entry && (
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <span
              className="h-10 w-10 rounded-full border"
              style={{ backgroundColor: entry.srgb }}
            />
            <div>
              <p className="font-medium">Forel–Ule {entry.index}</p>
              <p className="text-sm text-slate-600">{entry.description}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Confidence {(fu!.confidence * 100).toFixed(0)}%
          </p>
        </div>
      )}

      {tooUnclear && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          We could not read the colour from this photo. You can retake it, or
          continue without a photo — your other answers still count.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Build the survey step**

Create `src/components/wizard/SurveyStep.tsx`:

```tsx
"use client";

import type { SurveyAnswers, TaxonCode } from "@/types/observation";

type Props = {
  value: SurveyAnswers;
  onChange: (next: SurveyAnswers) => void;
};

const TAXA: { code: TaxonCode; label: string }[] = [
  { code: "mayfly", label: "Mayfly nymph" },
  { code: "stonefly", label: "Stonefly nymph" },
  { code: "caddisfly", label: "Caddisfly larva" },
  { code: "freshwater_shrimp", label: "Freshwater shrimp" },
  { code: "leech", label: "Leech" },
  { code: "worm", label: "Sludge worm" },
  { code: "none_seen", label: "Nothing seen" },
];

export function SurveyStep({ value, onChange }: Props) {
  function toggleTaxon(code: TaxonCode) {
    const has = value.indicatorTaxa.includes(code);
    onChange({
      ...value,
      indicatorTaxa: has
        ? value.indicatorTaxa.filter((t) => t !== code)
        : [...value.indicatorTaxa, code],
    });
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="font-medium">Does the water smell?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["none", "musty", "sewage", "chemical"] as const).map((odour) => (
            <button
              key={odour}
              type="button"
              onClick={() => onChange({ ...value, odour })}
              aria-pressed={value.odour === odour}
              className={`rounded-full border px-4 py-2 text-sm ${
                value.odour === odour ? "bg-slate-900 text-white" : "bg-white"
              }`}
            >
              {odour === "none" ? "No smell" : odour}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-medium">How clear is the water?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["clear", "slightly_turbid", "turbid", "opaque"] as const).map(
            (clarity) => (
              <button
                key={clarity}
                type="button"
                onClick={() => onChange({ ...value, clarity })}
                aria-pressed={value.clarity === clarity}
                className={`rounded-full border px-4 py-2 text-sm ${
                  value.clarity === clarity
                    ? "bg-slate-900 text-white"
                    : "bg-white"
                }`}
              >
                {clarity.replace("_", " ")}
              </button>
            ),
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-medium">
          Did you see any of these small creatures?
        </legend>
        <p className="text-sm text-slate-600">
          Lift a stone and look underneath. These animals tell us a lot about
          the water.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAXA.map((taxon) => (
            <button
              key={taxon.code}
              type="button"
              onClick={() => toggleTaxon(taxon.code)}
              aria-pressed={value.indicatorTaxa.includes(taxon.code)}
              className={`rounded-full border px-4 py-2 text-sm ${
                value.indicatorTaxa.includes(taxon.code)
                  ? "bg-slate-900 text-white"
                  : "bg-white"
              }`}
            >
              {taxon.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-medium">Anything else you noticed?</legend>
        {(
          [
            ["foam", "Foam on the surface"],
            ["deadFish", "Dead fish"],
            ["visibleAlgae", "Green algae or scum"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 7: Assemble the wizard and route**

Create `src/components/wizard/ObservationWizard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { PhotoStep } from "./PhotoStep";
import { SurveyStep } from "./SurveyStep";
import type { SurveyAnswers } from "@/types/observation";

const EMPTY: SurveyAnswers = {
  odour: "none",
  foam: false,
  litter: 0,
  deadFish: false,
  visibleAlgae: false,
  clarity: "clear",
  flow: "normal",
  indicatorTaxa: [],
  forelUle: null,
  measurements: {},
};

export function ObservationWizard({ waterbodyId }: { waterbodyId: string }) {
  const [step, setStep] = useState(0);
  const [survey, setSurvey] = useState<SurveyAnswers>(EMPTY);
  const [fu, setFu] = useState<{ index: number; confidence: number } | null>(
    null,
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const position = await new Promise<GeolocationPosition | null>((resolve) =>
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        enableHighAccuracy: true,
        timeout: 8000,
      }),
    );

    if (!position) {
      setError("We need your location to attach the observation to a stream.");
      return;
    }

    const response = await fetch("/api/observations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        waterbodyId,
        observedAt: new Date().toISOString(),
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        gpsAccuracyM: Math.round(position.coords.accuracy),
        forelUleIndex: fu?.index ?? null,
        forelUleConfidence: fu?.confidence ?? null,
        survey: { ...survey, forelUle: fu?.index ?? null },
      }),
    });

    if (!response.ok) {
      setError("We could not save your observation. Please try again.");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-lg bg-emerald-50 p-6">
        <h2 className="text-lg font-medium">Thank you</h2>
        <p className="mt-2 text-sm">
          Your observation has been recorded and will be included in this
          stream&apos;s next assessment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="flex gap-2 text-xs text-slate-500">
        {["Photo", "What you see", "Send"].map((label, i) => (
          <li
            key={label}
            className={i === step ? "font-medium text-slate-900" : ""}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && <PhotoStep onResult={setFu} />}
      {step === 1 && <SurveyStep value={survey} onChange={setSurvey} />}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm">
            Your photo never leaves your phone — only the colour reading is
            sent. Your location attaches this observation to the stream, and we
            never publish your exact position.
          </p>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-slate-900 px-6 py-3 text-white"
          >
            Send observation
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Back
          </button>
        )}
        {step < 2 && (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
```

Create `src/app/observe/page.tsx`:

```tsx
import { ObservationWizard } from "@/components/wizard/ObservationWizard";

export default async function ObservePage({
  searchParams,
}: {
  searchParams: Promise<{ waterbody?: string }>;
}) {
  const params = await searchParams;

  if (!params.waterbody) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="text-2xl font-medium">Choose a stream first</h1>
        <p className="mt-2 text-sm text-slate-600">
          Open the map and pick the water body you are standing next to.
        </p>
        <a href="/map" className="mt-4 inline-block underline">
          Go to the map
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-2xl font-medium">Record an observation</h1>
      <ObservationWizard waterbodyId={params.waterbody} />
    </main>
  );
}
```

- [ ] **Step 8: Verify build and suite**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 9: Commit and push**

```bash
git add src/app/observe src/components/wizard src/lib/science
git commit -m "Add observation wizard with live Forel-Ule feedback"
git push
```

---

### Task 13: City map and water body page

**Files:**
- Create: `src/lib/ui/wfd-colours.ts`, `src/components/map/CityMap.tsx`, `src/app/map/page.tsx`, `src/app/water/[id]/page.tsx`, `src/components/water/ScoreDisclosure.tsx`, `src/components/water/DisplayModeToggle.tsx`
- Test: `src/lib/ui/__tests__/wfd-colours.test.ts`

**Interfaces:**
- Consumes: `WfdClass` (Task 7), `computeSnapshot` and `StoredObservation` (Task 9), `METHOD_VERSION` (Task 7)
- Produces: `colourForClass(klass: WfdClass | null): string`, `INSUFFICIENT_DATA_COLOUR`, the `/map` and `/water/[id]` routes

- [ ] **Step 1: Write the failing test**

Create `src/lib/ui/__tests__/wfd-colours.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/ui/__tests__/wfd-colours.test.ts`
Expected: FAIL — cannot resolve `../wfd-colours`.

- [ ] **Step 3: Implement the palette**

Create `src/lib/ui/wfd-colours.ts`:

```typescript
import type { WfdClass } from "@/lib/science/wfd";

export const INSUFFICIENT_DATA_COLOUR = "#9e9e9e";

const PALETTE: Record<WfdClass, string> = {
  high: "#1a9641",
  good: "#a6d96a",
  moderate: "#ffffbf",
  poor: "#fdae61",
  bad: "#d7191c",
};

export function colourForClass(klass: WfdClass | null): string {
  return klass === null ? INSUFFICIENT_DATA_COLOUR : PALETTE[klass];
}

export const CLASS_LABEL: Record<WfdClass, string> = {
  high: "High",
  good: "Good",
  moderate: "Moderate",
  poor: "Poor",
  bad: "Bad",
};

export const SIMPLE_MESSAGE: Record<WfdClass, string> = {
  high: "This water is in very good condition.",
  good: "This water is in good condition.",
  moderate: "This water shows signs of stress.",
  poor: "This water is in poor condition.",
  bad: "This water is badly degraded.",
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/ui/__tests__/wfd-colours.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Build the map**

```bash
npm install maplibre-gl
```

Create `src/components/map/CityMap.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { colourForClass } from "@/lib/ui/wfd-colours";
import type { WfdClass } from "@/lib/science/wfd";

export type MapFeature = {
  id: string;
  name: string;
  klass: WfdClass | null;
  coordinates: [number, number][];
};

export function CityMap({
  features,
  centre,
}: {
  features: MapFeature[];
  centre: [number, number];
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: centre,
      zoom: 12,
    });

    map.on("load", () => {
      map.addSource("waterbodies", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: features.map((f) => ({
            type: "Feature",
            id: f.id,
            properties: {
              id: f.id,
              name: f.name,
              colour: colourForClass(f.klass),
              hasClass: f.klass !== null,
            },
            geometry: { type: "LineString", coordinates: f.coordinates },
          })),
        },
      });

      // line-dasharray does not accept data-driven expressions, so assessed and
      // unassessed water bodies are drawn as two filtered layers.
      map.addLayer({
        id: "waterbody-assessed",
        type: "line",
        source: "waterbodies",
        filter: ["==", ["get", "hasClass"], true],
        paint: { "line-color": ["get", "colour"], "line-width": 4 },
      });

      map.addLayer({
        id: "waterbody-unassessed",
        type: "line",
        source: "waterbodies",
        filter: ["==", ["get", "hasClass"], false],
        paint: {
          "line-color": ["get", "colour"],
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
      });

      for (const layer of ["waterbody-assessed", "waterbody-unassessed"]) {
        map.on("click", layer, (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (id) window.location.href = `/water/${id}`;
        });
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    });

    return () => map.remove();
  }, [features, centre]);

  return <div ref={container} className="h-[70vh] w-full rounded-lg" />;
}
```

- [ ] **Step 6: Build the map route**

Create `src/app/map/page.tsx`:

```tsx
import { CityMap, type MapFeature } from "@/components/map/CityMap";
import { supabaseAnon } from "@/lib/db/client";
import {
  computeSnapshot,
  type StoredObservation,
} from "@/lib/science/snapshot";

type GeoJsonLineString = { coordinates: [number, number][] };

const CITY_CENTRES: Record<string, [number, number]> = {
  Coimbra: [-8.4195, 40.2033],
  Toulouse: [1.4442, 43.6047],
  Benevento: [14.7826, 41.1299],
  Gent: [3.7174, 51.0543],
  Oslo: [10.7522, 59.9139],
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const params = await searchParams;
  const city = params.city ?? "Coimbra";
  const db = supabaseAnon();

  const { data: waterbodies } = await db
    .from("waterbodies")
    .select("id, name, geometry")
    .eq("city", city);

  // One query for the whole city; a query per water body is too slow with
  // hundreds of OpenStreetMap segments.
  const { data: observations } = await db
    .from("observations")
    .select(
      "id, waterbody_id, observed_at, observer_id, survey, quality_weight, waterbodies!inner(city)",
    )
    .eq("waterbodies.city", city);

  const byWaterbody = new Map<string, StoredObservation[]>();
  for (const o of observations ?? []) {
    const list = byWaterbody.get(o.waterbody_id) ?? [];
    list.push({
      id: o.id,
      observedAt: o.observed_at,
      observerId: o.observer_id,
      survey: o.survey,
      qualityWeight: Number(o.quality_weight),
    });
    byWaterbody.set(o.waterbody_id, list);
  }

  const features: MapFeature[] = (waterbodies ?? []).map((wb) => ({
    id: wb.id,
    name: wb.name,
    klass: computeSnapshot(byWaterbody.get(wb.id) ?? []).assessment.klass,
    coordinates: (wb.geometry as GeoJsonLineString).coordinates,
  }));

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-medium">Urban streams in {city}</h1>
      <nav className="mb-4 flex gap-3 text-sm">
        {Object.keys(CITY_CENTRES).map((name) => (
          <a
            key={name}
            href={`/map?city=${name}`}
            className={name === city ? "font-medium underline" : "underline"}
          >
            {name}
          </a>
        ))}
      </nav>
      <CityMap features={features} centre={CITY_CENTRES[city]} />
      <p className="mt-3 text-xs text-slate-500">
        Dashed grey lines mark water bodies where there is not yet enough data
        to assign an ecological status.
      </p>
    </main>
  );
}
```

- [ ] **Step 7: Build the score disclosure component**

Create `src/components/water/ScoreDisclosure.tsx`:

```tsx
"use client";

import { useState } from "react";
import { METHOD_VERSION } from "@/lib/science/method-version";
import type { Snapshot } from "@/lib/science/snapshot";

export function ScoreDisclosure({ snapshot }: { snapshot: Snapshot }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full px-4 py-3 text-left text-sm font-medium"
      >
        Why this score?
      </button>

      {open && (
        <div className="space-y-4 border-t px-4 py-4 text-sm">
          <section>
            <h3 className="font-medium">Inputs</h3>
            <p className="text-slate-600">
              {snapshot.observationCount} observations from{" "}
              {snapshot.uniqueObservers} observers, combined with a total
              effective weight of {snapshot.posterior.effectiveN.toFixed(2)}.
            </p>
          </section>

          <section>
            <h3 className="font-medium">Calculation</h3>
            <p className="text-slate-600">
              Each observation contributes weighted pseudo-counts to a Beta
              posterior. Current parameters are alpha ={" "}
              {snapshot.posterior.alpha.toFixed(2)} and beta ={" "}
              {snapshot.posterior.beta.toFixed(2)}, giving a mean of{" "}
              {snapshot.posterior.mean.toFixed(3)} with a 90% credible interval
              of {snapshot.posterior.lower.toFixed(3)} to{" "}
              {snapshot.posterior.upper.toFixed(3)}.
            </p>
          </section>

          <section>
            <h3 className="font-medium">Class probabilities</h3>
            <ul className="text-slate-600">
              {Object.entries(snapshot.assessment.probabilities).map(
                ([klass, probability]) => (
                  <li key={klass}>
                    {klass}: {(probability * 100).toFixed(1)}%
                  </li>
                ),
              )}
            </ul>
          </section>

          <section>
            <h3 className="font-medium">
              Method version {snapshot.methodVersion}
            </h3>
            <ul className="list-disc pl-5 text-slate-600">
              {METHOD_VERSION.citations.map((citation) => (
                <li key={citation}>{citation}</li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-slate-500">
            These are proxy estimates derived from citizen observations, not
            laboratory measurements.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Build the water body page with the display mode toggle**

Create `src/components/water/DisplayModeToggle.tsx`:

```tsx
"use client";

import { useState } from "react";

export function DisplayModeToggle({
  simple,
  scientific,
}: {
  simple: React.ReactNode;
  scientific: React.ReactNode;
}) {
  const [mode, setMode] = useState<"simple" | "scientific">("simple");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm">
        {(["simple", "scientific"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            aria-pressed={mode === option}
            className={`rounded-full border px-4 py-1 ${
              mode === option ? "bg-slate-900 text-white" : "bg-white"
            }`}
          >
            {option === "simple" ? "Simple" : "Scientific"}
          </button>
        ))}
      </div>
      {mode === "simple" ? simple : scientific}
    </div>
  );
}
```

Create `src/app/water/[id]/page.tsx`:

```tsx
import { supabaseAnon } from "@/lib/db/client";
import { computeSnapshot } from "@/lib/science/snapshot";
import { colourForClass, CLASS_LABEL, SIMPLE_MESSAGE } from "@/lib/ui/wfd-colours";
import { ScoreDisclosure } from "@/components/water/ScoreDisclosure";
import { DisplayModeToggle } from "@/components/water/DisplayModeToggle";
import { notFound } from "next/navigation";

export default async function WaterBodyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabaseAnon();

  const { data: waterbody } = await db
    .from("waterbodies")
    .select("id, name, city")
    .eq("id", id)
    .single();

  if (!waterbody) notFound();

  const { data: observations } = await db
    .from("observations")
    .select("id, observed_at, observer_id, survey, quality_weight")
    .eq("waterbody_id", id)
    .order("observed_at", { ascending: false });

  const snapshot = computeSnapshot(
    (observations ?? []).map((o) => ({
      id: o.id,
      observedAt: o.observed_at,
      observerId: o.observer_id,
      survey: o.survey,
      qualityWeight: Number(o.quality_weight),
    })),
  );

  const klass = snapshot.assessment.klass;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-medium">{waterbody.name}</h1>
        <p className="text-sm text-slate-600">{waterbody.city}</p>
      </header>

      <DisplayModeToggle
        simple={
          <div className="rounded-lg border p-6">
            <div className="flex items-center gap-4">
              <span
                className="h-12 w-12 rounded-full border"
                style={{ backgroundColor: colourForClass(klass) }}
              />
              <div>
                <p className="text-lg font-medium">
                  {klass ? CLASS_LABEL[klass] : "Not enough data yet"}
                </p>
                <p className="text-sm text-slate-600">
                  {klass
                    ? SIMPLE_MESSAGE[klass]
                    : "Nobody has reported enough about this water body for us to assess it. You could be the first."}
                </p>
              </div>
            </div>
            <a
              href={`/observe?waterbody=${waterbody.id}`}
              className="mt-4 inline-block rounded-lg bg-slate-900 px-5 py-2 text-sm text-white"
            >
              Record an observation
            </a>
          </div>
        }
        scientific={
          <div className="space-y-4">
            <div className="rounded-lg border p-6">
              <p className="text-sm text-slate-600">WFD ecological status</p>
              <p className="text-lg font-medium">
                {klass ? CLASS_LABEL[klass] : "Insufficient data"}
                {klass && (
                  <span className="ml-2 text-sm font-normal text-slate-600">
                    {(snapshot.assessment.probabilities[klass] * 100).toFixed(0)}
                    % likely
                  </span>
                )}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Posterior mean {snapshot.posterior.mean.toFixed(3)} (90% CrI{" "}
                {snapshot.posterior.lower.toFixed(3)}–
                {snapshot.posterior.upper.toFixed(3)})
              </p>
              <p className="text-sm text-slate-600">
                Data confidence {(snapshot.confidence * 100).toFixed(0)}%
              </p>
            </div>
            <ScoreDisclosure snapshot={snapshot} />
          </div>
        }
      />
    </main>
  );
}
```

- [ ] **Step 9: Verify build and suite**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 10: Commit and push**

```bash
git add src/lib/ui src/components src/app package.json package-lock.json
git commit -m "Add city map and water body page with traceable scores"
git push
```

---

### Task 14: FHIR export endpoint, landing page and deployment

**Files:**
- Create: `src/app/api/fhir/Observation/bundle.ts`, `src/app/api/fhir/Observation/route.ts`, `src/app/open-data/page.tsx`
- Modify: `src/app/page.tsx`, `README.md`
- Test: `src/app/api/fhir/__tests__/bundle.test.ts`

**Interfaces:**
- Consumes: `toObservationIndicators`, `toLocationOah` (Task 10), `computeSnapshot` (Task 9)
- Produces: `buildBundle(entries: FhirResource[]): FhirBundle`, `GET /api/fhir/Observation?waterbody=<id>`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/fhir/__tests__/bundle.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildBundle } from "../Observation/bundle";
import { toObservationIndicators } from "@/lib/fhir/observation";

const observation = toObservationIndicators({
  id: "obs-1",
  waterbodyId: "wb-1",
  effectiveDateTime: "2026-09-15T10:00:00Z",
  performerDisplay: "Anonymous citizen scientist",
  code: "pH",
  value: { kind: "quantity", value: 7.2, unit: "pH" },
});

describe("buildBundle", () => {
  it("produces a searchset Bundle", () => {
    const bundle = buildBundle([observation]);
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("searchset");
  });

  it("reports the entry total", () => {
    expect(buildBundle([observation, observation]).total).toBe(2);
  });

  it("wraps every resource in an entry", () => {
    const bundle = buildBundle([observation]);
    expect(bundle.entry).toHaveLength(1);
    expect(bundle.entry[0].resource.resourceType).toBe("Observation");
  });

  it("handles an empty result set", () => {
    const bundle = buildBundle([]);
    expect(bundle.total).toBe(0);
    expect(bundle.entry).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/fhir/__tests__/bundle.test.ts`
Expected: FAIL — cannot resolve `../Observation/bundle`.

- [ ] **Step 3: Implement the bundle builder**

Create `src/app/api/fhir/Observation/bundle.ts`:

```typescript
export type FhirResource = { resourceType: string; id: string };

export type FhirBundle = {
  resourceType: "Bundle";
  type: "searchset";
  total: number;
  entry: { resource: FhirResource }[];
};

export function buildBundle(resources: FhirResource[]): FhirBundle {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    entry: resources.map((resource) => ({ resource })),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/api/fhir/__tests__/bundle.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Implement the export route**

Create `src/app/api/fhir/Observation/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/db/client";
import { computeSnapshot } from "@/lib/science/snapshot";
import {
  toLocationOah,
  toObservationIndicators,
  type FhirObservation,
} from "@/lib/fhir/observation";
import { buildBundle, type FhirResource } from "./bundle";

export async function GET(request: Request) {
  const waterbodyId = new URL(request.url).searchParams.get("waterbody");

  if (!waterbodyId) {
    return NextResponse.json(
      { error: "missing_waterbody_parameter" },
      { status: 400 },
    );
  }

  const db = supabaseAnon();

  const { data: waterbody } = await db
    .from("waterbodies")
    .select("id, name, city, centroid")
    .eq("id", waterbodyId)
    .single();

  if (!waterbody) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: rows } = await db
    .from("observations")
    .select("id, observed_at, observer_id, survey, indicators, quality_weight")
    .eq("waterbody_id", waterbodyId)
    .order("observed_at", { ascending: false });

  const observations = rows ?? [];
  const resources: FhirResource[] = [];

  const [lon, lat] = (waterbody.centroid as { coordinates: [number, number] })
    .coordinates;
  resources.push(
    toLocationOah({
      id: waterbody.id,
      name: waterbody.name,
      city: waterbody.city,
      centroidLon: lon,
      centroidLat: lat,
    }),
  );

  for (const row of observations) {
    for (const indicator of row.indicators as { code: string; value: number }[]) {
      resources.push(
        toObservationIndicators({
          id: `${row.id}-${indicator.code}`,
          waterbodyId: waterbody.id,
          effectiveDateTime: row.observed_at,
          performerDisplay: row.observer_id
            ? `Observer ${row.observer_id}`
            : "Anonymous citizen scientist",
          code: indicator.code,
          value: { kind: "quantity", value: indicator.value, unit: "1" },
        }) as FhirObservation,
      );
    }

    if (row.survey?.forelUle != null) {
      resources.push(
        toObservationIndicators({
          id: `${row.id}-fu`,
          waterbodyId: waterbody.id,
          effectiveDateTime: row.observed_at,
          performerDisplay: "Anonymous citizen scientist",
          code: "forel-ule-index",
          value: { kind: "quantity", value: row.survey.forelUle, unit: "FU" },
        }) as FhirObservation,
      );
    }
  }

  const snapshot = computeSnapshot(
    observations.map((o) => ({
      id: o.id,
      observedAt: o.observed_at,
      observerId: o.observer_id,
      survey: o.survey,
      qualityWeight: Number(o.quality_weight),
    })),
  );

  if (snapshot.assessment.klass) {
    resources.push(
      toObservationIndicators({
        id: `${waterbody.id}-wfd`,
        waterbodyId: waterbody.id,
        effectiveDateTime: new Date().toISOString(),
        performerDisplay: `Rivulet method ${snapshot.methodVersion}`,
        code: "wfd-ecological-status",
        value: {
          kind: "code",
          code: snapshot.assessment.klass,
          display: snapshot.assessment.klass,
        },
      }) as FhirObservation,
    );
  }

  return NextResponse.json(buildBundle(resources), {
    headers: { "content-type": "application/fhir+json" },
  });
}
```

- [ ] **Step 6: Write the landing page**

Replace `src/app/page.tsx`:

```tsx
export default function LandingPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-16 p-6 py-16">
      <section className="space-y-4">
        <h1 className="text-4xl font-medium tracking-tight">
          The stream at the end of your street has a health record.
        </h1>
        <p className="text-lg text-slate-600">
          Rivulet turns what residents notice about urban water into
          scientifically grounded assessments — with the uncertainty stated
          honestly, and every number traceable to a published method.
        </p>
        <div className="flex gap-3">
          <a
            href="/map"
            className="rounded-lg bg-slate-900 px-6 py-3 text-white"
          >
            See the map
          </a>
          <a href="/observe" className="rounded-lg border px-6 py-3">
            Record an observation
          </a>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-medium">The problem</h2>
        <p className="text-slate-600">
          Official monitoring of urban streams is sparse in both space and time.
          Residents see these waters every day, but what they notice rarely
          reaches anyone who can act on it — and when it does, nobody can say
          how much to trust it.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-medium">How it works</h2>
        <ol className="space-y-3 text-slate-600">
          <li>
            <strong className="text-slate-900">1. You photograph the water.</strong>{" "}
            We derive a Forel–Ule colour index from the image — a scale in
            scientific use since the 1890s.
          </li>
          <li>
            <strong className="text-slate-900">2. We weigh the evidence.</strong>{" "}
            Observations are combined in a Bayesian model that reports a range,
            not a falsely precise number.
          </li>
          <li>
            <strong className="text-slate-900">3. The city gets an answer.</strong>{" "}
            Results are expressed as EU Water Framework Directive status classes
            and exported through the OneAquaHealth FHIR standard.
          </li>
        </ol>
      </section>

      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="text-2xl font-medium">There is real science behind this</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Forel–Ule water colour scale, derived via the WACODI chain</li>
          <li>EU Water Framework Directive 2000/60/EC ecological status classes</li>
          <li>BMWP macroinvertebrate family sensitivity scores</li>
          <li>Beta–Bernoulli conjugate updating with 90% credible intervals</li>
          <li>HL7 Europe OneAquaHealth FHIR Implementation Guide</li>
        </ul>
        <p className="text-xs text-slate-500">
          These are proxy estimates from citizen observations, not laboratory
          measurements. We say so everywhere the numbers appear.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-medium">Open by construction</h2>
        <p className="text-slate-600">
          Every assessment is exportable as FHIR conforming to the consortium&apos;s
          own implementation guide, so this data can flow into the systems that
          already exist rather than sitting in another silo.
        </p>
        <a href="/open-data" className="underline">
          See the open data
        </a>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Write the open data page**

Create `src/app/open-data/page.tsx`:

```tsx
export default function OpenDataPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-medium">Open data</h1>

      <section className="space-y-2">
        <h2 className="font-medium">FHIR export</h2>
        <p className="text-sm text-slate-600">
          Observations are served as a FHIR Bundle whose resources declare the
          OneAquaHealth Implementation Guide profiles.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
          GET /api/fhir/Observation?waterbody=&lt;id&gt;
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Code systems</h2>
        <p className="text-sm text-slate-600">
          Indicators use the OneAquaHealth code system wherever a code exists.
          Concepts the guide does not yet cover — the Forel–Ule index, the
          classified WFD outcome, and our data confidence measure — use a
          clearly separated Rivulet extension system so the boundary between
          adopted and derived vocabulary stays auditable.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Write the README**

Replace `README.md` with a description covering: what Rivulet is, its positioning as a complement to the OneAquaHealth stack, the scientific methods with citations, setup instructions (`npm install`, `.env.local` from `.env.example`, apply the migration, run both seed scripts, `npm run dev`), the test command, and the stated limitations from spec §13.

- [ ] **Step 9: Verify build and full suite**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 10: Deploy**

```bash
npm install -g vercel
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel --prod
```

Open the deployment URL and walk the full path: landing page, map, a water body page in both display modes, the wizard, and the FHIR endpoint. Every route must render without errors.

- [ ] **Step 11: Commit and push**

```bash
git add -A
git commit -m "Add FHIR export endpoint, landing page and open data documentation"
git push
```

---

## Phase 2 backlog (not in this plan)

Implement only after every task above is complete and deployed:

photo upload with server-side EXIF stripping · GDPR export and deletion endpoints for registered observers · satellite ingestion and caching · citizen–satellite divergence engine · One Health risk model (hazard × exposure × vulnerability) mapped to `ObservationHealthMeasureOah` with a `GroupOah` focus · trend forecasting · AI validation queue with evidence-cited explanations · Trust Score and its feedback into `observationWeight` · quests from data gaps · Stream Guardian and leaderboards · Open Badges 3.0 certificates · Darwin Core export · method validation chart against official Portuguese water data.
