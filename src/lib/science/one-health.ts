import { EVIDENCE_WEIGHTS } from "./indicators";
import { trustMultiplier, TRUST_PARAMETERS } from "./trust";
import type { StoredObservation } from "./snapshot";

/**
 * One Health reading of a stream: what residents have recently seen (hazard)
 * combined with who comes close to the water (exposure), for people, dogs and
 * wildlife. It is an indicative prompt to take care, never a public health
 * advisory or a bathing-water classification. All thresholds are priors —
 * see METHOD_PARAMETERS.
 */
export const ONE_HEALTH_PARAMETERS = {
  windowDays: 30,
  exposureRadiusM: 150,
  possibleShare: 0.2,
  likelyShare: 0.5,
  likelyMinObservers: 2,
  heavyLitterMin: EVIDENCE_WEIGHTS.heavyLitterMin,
} as const;

export type ExposureKind =
  | "playground"
  | "school"
  | "kindergarten"
  | "dog_park"
  | "park"
  | "bathing"
  | "fishing"
  | "allotments"
  | "picnic";

export type ExposureSite = {
  kind: ExposureKind;
  siteCount: number;
  nearestM: number;
  nearestName: string | null;
};

export type HazardCode = "sewage" | "bloom" | "chemical" | "dead_fish" | "litter";
export type HazardLevel = "none" | "possible" | "likely";

export type Hazard = {
  code: HazardCode;
  level: HazardLevel;
  /** Trust- and quality-weighted share of recent reports showing the sign. */
  share: number;
  observers: number;
};

export type Audience = "people" | "dogs" | "wildlife";
export type Concern = "unknown" | "none" | "watch" | "care" | "avoid";

export type AudienceReading = {
  audience: Audience;
  concern: Concern;
  hazards: HazardCode[];
  nearby: ExposureSite[];
  advice: string[];
};

export type OneHealthReading = {
  recentReports: number;
  hazards: Hazard[];
  audiences: AudienceReading[];
  overall: Concern;
};

const SIGNS: Record<HazardCode, (o: StoredObservation) => boolean> = {
  sewage: (o) => o.survey.odour === "sewage",
  // Algae or scum is the resident-visible sign of a possible bloom; some
  // blooms are cyanobacterial and toxic, which cannot be told apart by eye.
  bloom: (o) => o.survey.visibleAlgae,
  chemical: (o) => o.survey.odour === "chemical" || o.survey.foam,
  dead_fish: (o) => o.survey.deadFish,
  litter: (o) => o.survey.litter >= ONE_HEALTH_PARAMETERS.heavyLitterMin,
};

/** Places that bring each audience close to the water. */
const EXPOSING_KINDS: Record<Exclude<Audience, "wildlife">, ExposureKind[]> = {
  people: ["playground", "school", "kindergarten", "bathing", "fishing", "allotments", "picnic", "park"],
  dogs: ["dog_park", "park"],
};

const ADVICE: Record<Audience, Partial<Record<HazardCode, string>>> = {
  people: {
    sewage: "Avoid touching the water and wash hands after being near it, especially children.",
    bloom: "Keep children out of the water and away from scum at the edge.",
    chemical: "Avoid skin contact and do not use the water for watering food plants.",
    dead_fish: "Do not touch dead fish or eat fish caught here until the cause is known.",
    litter: "Watch for glass or sharp objects on the banks.",
  },
  dogs: {
    sewage: "Keep dogs from drinking or swimming here.",
    bloom: "Keep dogs out of the water: some algal blooms are toxic to dogs even in small amounts.",
    chemical: "Keep dogs out of the water and rinse them if they go in.",
    dead_fish: "Keep dogs away from dead fish.",
    litter: "Watch for sharp litter on the banks.",
  },
  wildlife: {
    sewage: "Sewage lowers oxygen in the water, which fish and insect larvae need.",
    bloom: "Algal growth can strip oxygen from the water at night.",
    chemical: "Chemicals can harm fish, amphibians and the insects birds feed on.",
    dead_fish: "Dead fish can signal acute pollution or low oxygen — worth reporting to the local environment authority.",
    litter: "Litter can entangle or be swallowed by birds and other animals.",
  },
};

const RANK: Record<Concern, number> = { unknown: -1, none: 0, watch: 1, care: 2, avoid: 3 };

function worst(concerns: Concern[]): Concern {
  return concerns.reduce<Concern>((a, b) => (RANK[b] > RANK[a] ? b : a), "unknown");
}

export function readOneHealth(
  observations: StoredObservation[],
  exposure: ExposureSite[],
  now: Date = new Date(),
): OneHealthReading {
  const p = ONE_HEALTH_PARAMETERS;
  const cutoff = now.getTime() - p.windowDays * 24 * 3_600_000;
  const recent = observations.filter((o) => new Date(o.observedAt).getTime() >= cutoff);

  const weights = recent.map(
    (o) => o.qualityWeight * trustMultiplier(o.observerTrust ?? TRUST_PARAMETERS.neutralTrust),
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const hazards: Hazard[] = (Object.keys(SIGNS) as HazardCode[]).map((code) => {
    let signWeight = 0;
    const observers = new Set<string>();
    recent.forEach((o, i) => {
      if (!SIGNS[code](o)) return;
      signWeight += weights[i];
      observers.add(o.observerId ?? `anonymous-${o.id}`);
    });
    const share = totalWeight > 0 ? signWeight / totalWeight : 0;
    const level: HazardLevel =
      observers.size === 0 || share < p.possibleShare
        ? "none"
        : share >= p.likelyShare && observers.size >= p.likelyMinObservers
          ? "likely"
          : "possible";
    return { code, level, share, observers: observers.size };
  });

  const audiences: AudienceReading[] = (["people", "dogs", "wildlife"] as Audience[]).map(
    (audience) => {
      const nearby =
        audience === "wildlife"
          ? []
          : exposure
              .filter((e) => EXPOSING_KINDS[audience].includes(e.kind))
              .sort((a, b) => a.nearestM - b.nearestM);
      // "Exposure" here means contact with the water through a place people
      // or dogs use. Wildlife lives in the stream, so its concern follows the
      // hazard alone and never escalates to "avoid contact".
      const exposed = nearby.length > 0;
      const active = hazards.filter((h) => h.level !== "none");

      let concern: Concern;
      if (recent.length === 0) {
        // No recent reports is not evidence of safety.
        concern = "unknown";
      } else if (active.length === 0) {
        concern = "none";
      } else {
        const likely = active.some((h) => h.level === "likely");
        concern = likely ? (exposed ? "avoid" : "care") : exposed ? "care" : "watch";
      }

      return {
        audience,
        concern,
        hazards: active.map((h) => h.code),
        nearby,
        advice: active
          .map((h) => ADVICE[audience][h.code])
          .filter((a): a is string => Boolean(a)),
      };
    },
  );

  return {
    recentReports: recent.length,
    hazards,
    audiences,
    overall: worst(audiences.map((a) => a.concern)),
  };
}
