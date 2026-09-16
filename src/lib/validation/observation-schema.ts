import { z } from "zod";
import { PLAUSIBILITY } from "@/lib/science/plausibility";

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

export const observationSchema = z
  .object({
    waterbodyId: z.string().uuid(),
    observedAt: z.string().datetime(),
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
    gpsAccuracyM: z.number().int().min(0).nullable(),
    forelUleIndex: z.number().int().min(1).max(21).nullable(),
    forelUleConfidence: z.number().min(0).max(1).nullable(),
    survey: surveySchema,
    // A small downscaled JPEG data URI, used once for an automatic "is this
    // really water?" check (see src/lib/moderation/photo-check.ts) and never
    // stored. The size cap keeps a client from smuggling a full-resolution
    // photo through this field.
    photoThumbnail: z.string().startsWith("data:image/").max(60_000).optional(),
  })
  .superRefine((value, ctx) => {
    // `observedAt` is client-supplied and otherwise unverifiable — bound it
    // against the server clock so a fabricated timestamp cannot dodge the
    // hourly-rate anti-gaming check or the recency term in the science
    // model. See METHOD_PARAMETERS `plausibility.maxFutureMinutes` /
    // `plausibility.maxPastDays`.
    const observedAtMs = new Date(value.observedAt).getTime();
    if (Number.isNaN(observedAtMs)) return; // z.string().datetime() already flags this
    const nowMs = Date.now();
    const maxFutureMs = PLAUSIBILITY.maxFutureMinutes * 60_000;
    const maxPastMs = PLAUSIBILITY.maxPastDays * 24 * 3_600_000;

    if (observedAtMs - nowMs > maxFutureMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["observedAt"],
        message: `observedAt cannot be more than ${PLAUSIBILITY.maxFutureMinutes} minutes in the future`,
      });
    } else if (nowMs - observedAtMs > maxPastMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["observedAt"],
        message: `observedAt cannot be more than ${PLAUSIBILITY.maxPastDays} days in the past`,
      });
    }
  });

export type ObservationPayload = z.infer<typeof observationSchema>;
