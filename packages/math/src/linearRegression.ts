export interface Sample {
  readonly t: number;
  readonly v: number;
}

export function computeSlope(samples: readonly Sample[]): number {
  if (samples.length < 2) {
    return 0;
  }

  const t0 = samples[0].t;
  const n = samples.length;

  let sumT = 0;
  let sumV = 0;
  for (let i = 0; i < n; i++) {
    sumT += (samples[i].t - t0) / 1000;
    sumV += samples[i].v;
  }
  const meanT = sumT / n;
  const meanV = sumV / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dt = (samples[i].t - t0) / 1000 - meanT;
    const dv = samples[i].v - meanV;
    num += dt * dv;
    den += dt * dt;
  }

  if (den === 0) {
    return 0;
  }
  return num / den;
}
