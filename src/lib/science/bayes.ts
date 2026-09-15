export type WeightedEvidence = { good: number; bad: number; weight: number };

export type Posterior = {
  mean: number;
  lower: number;
  upper: number;
  alpha: number;
  beta: number;
  effectiveN: number;
};

export const UNIFORM_PRIOR = { alpha: 1, beta: 1 } as const;
export const CREDIBLE_MASS = 0.9;

export const DATA_CONFIDENCE = {
  volumeScale: 5,
  diversityScale: 3,
  recencyHalfLifeHours: 24 * 60,
  volumeWeight: 0.4,
  diversityWeight: 0.3,
  recencyWeight: 0.3,
} as const;

// Lanczos approximation coefficients (Press et al., Numerical Recipes, routine gammln).
const LANCZOS = [
  76.18009172947146, -86.50532032941677, 24.01409824083091,
  -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
];

function logGamma(x: number): number {
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let series = 1.000000000190015;
  for (const coefficient of LANCZOS) series += coefficient / ++y;
  return -tmp + Math.log((2.5066282746310005 * series) / x);
}

// Modified Lentz evaluation of the continued fraction for I_x(a, b); it converges
// quickly only when x < (a + 1) / (a + b + 2), so callers reflect otherwise.
function incompleteBetaFraction(x: number, a: number, b: number): number {
  const TINY = 1e-30;
  let f = 1;
  let c = 1;
  let d = 0;

  for (let i = 0; i <= 300; i++) {
    const m = Math.floor(i / 2);
    let numerator: number;
    if (i === 0) {
      numerator = 1;
    } else if (i % 2 === 0) {
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    } else {
      numerator =
        -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    }

    d = 1 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;

    c = 1 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;

    const cd = c * d;
    f *= cd;
    if (Math.abs(1 - cd) < 1e-10) break;
  }

  return f - 1;
}

export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedIncompleteBeta(1 - x, b, a);
  }
  const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta) / a;
  return front * incompleteBetaFraction(x, a, b);
}

function betaQuantile(p: number, a: number, b: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (regularizedIncompleteBeta(mid, a, b) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function aggregate(
  evidence: WeightedEvidence[],
  prior: { alpha: number; beta: number } = UNIFORM_PRIOR,
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

  const p = DATA_CONFIDENCE;
  const volume = 1 - Math.exp(-input.effectiveN / p.volumeScale);
  const diversity = 1 - Math.exp(-input.uniqueObservers / p.diversityScale);
  const recency = Math.pow(0.5, input.newestAgeHours / p.recencyHalfLifeHours);

  const score =
    volume * p.volumeWeight +
    diversity * p.diversityWeight +
    recency * p.recencyWeight;
  return Math.max(0, Math.min(1, score));
}
