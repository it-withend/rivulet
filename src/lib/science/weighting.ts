export type WeightInput = {
  hasPhoto: boolean;
  forelUleConfidence: number | null;
  gpsAccuracyMetres: number | null;
  measurementCount: number;
  ageHours: number;
};

export const OBSERVATION_WEIGHTING = {
  base: 0.5,
  photoBonus: 0.2,
  unknownPhotoConfidence: 0.5,
  measurementBonus: 0.05,
  maxCountedMeasurements: 4,
  preciseGpsMetres: 20,
  approximateGpsMetres: 100,
  approximateGpsFactor: 0.85,
  poorGpsFactor: 0.6,
  unknownGpsMetres: 1000,
  halfLifeHours: 24 * 30,
  floor: 0.1,
} as const;

export function observationWeight(input: WeightInput): number {
  const p = OBSERVATION_WEIGHTING;
  let weight = p.base;

  if (input.hasPhoto) {
    weight += p.photoBonus * (input.forelUleConfidence ?? p.unknownPhotoConfidence);
  }

  weight +=
    Math.min(input.measurementCount, p.maxCountedMeasurements) * p.measurementBonus;

  const accuracy = input.gpsAccuracyMetres ?? p.unknownGpsMetres;
  weight *=
    accuracy <= p.preciseGpsMetres
      ? 1
      : accuracy <= p.approximateGpsMetres
        ? p.approximateGpsFactor
        : p.poorGpsFactor;

  weight *= Math.pow(0.5, input.ageHours / p.halfLifeHours);

  return Math.max(p.floor, Math.min(1, weight));
}
