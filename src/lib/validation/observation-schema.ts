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
