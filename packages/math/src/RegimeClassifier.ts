import { clamp } from "./clamp.js";
import type { TrendLabel } from "./trend.js";

export interface FeatureValues {
  readonly priceMid: number;
  readonly vwapSession: number;
  readonly vwap5m: number;
  readonly vwapDevZ: number;
  readonly bookImbalanceTop: number;
  readonly bookImbalance0p5pct: number;
  readonly cvdSlope1m: number;
  readonly cvdSlope5m: number;
  readonly oiChange15m: number;
  readonly btcTrend1m: TrendLabel;
  readonly btcTrend5m: TrendLabel;
  readonly nearestLiqClusterDistanceBps: number;
}

export type RegimeLabel = "momentum" | "chop" | "trap";

export interface ClassificationResult {
  readonly label: RegimeLabel;
  readonly confidence: number;
  readonly momentumScore: number;
  readonly trapScore: number;
  readonly chopScore: number;
}

const CVD_NORM = 1000;

function priceDirection(vwapDevZ: number): number {
  if (vwapDevZ > 0) {
    return 1;
  }
  if (vwapDevZ < 0) {
    return -1;
  }
  return 0;
}

/**
 *
 */
export class RegimeClassifier {
  classify(f: FeatureValues): ClassificationResult {
    const dir = priceDirection(f.vwapDevZ);
    const momentumScore = this.scoreMomentum(f, dir);
    const trapScore = this.scoreTrap(f, dir);
    const chopScore = clamp(1 - Math.max(momentumScore, trapScore), 0, 1);

    const scores: [RegimeLabel, number][] = [
      ["momentum", momentumScore],
      ["trap", trapScore],
      ["chop", chopScore],
    ];

    scores.sort((a, b) => b[1] - a[1]);
    const label = scores[0][0];
    const confidence = clamp(scores[0][1] - scores[1][1], 0, 1);

    return {
      label,
      confidence,
      momentumScore,
      trapScore,
      chopScore,
    };
  }

  private scoreMomentum(f: FeatureValues, dir: number): number {
    const vwapSig = clamp(Math.abs(f.vwapDevZ) / 2, 0, 1);
    const bookSig = clamp(Math.abs(f.bookImbalance0p5pct) / 0.5, 0, 1);
    const cvdSig = clamp(Math.abs(f.cvdSlope1m) / CVD_NORM, 0, 1);

    let btcSig = 0.5;
    if (f.btcTrend1m !== "flat") {
      const btcDir = f.btcTrend1m === "up" ? 1 : -1;
      btcSig = btcDir === dir ? 1.0 : 0.0;
    }

    const oiSig = clamp(Math.abs(f.oiChange15m) / 0.02, 0, 1);

    return (
      0.25 * vwapSig +
      0.2 * bookSig +
      0.25 * cvdSig +
      0.15 * btcSig +
      0.15 * oiSig
    );
  }

  private scoreTrap(f: FeatureValues, dir: number): number {
    const vwapSig = clamp(Math.abs(f.vwapDevZ) / 2, 0, 1);

    const bookDir = f.bookImbalance0p5pct > 0 ? 1 : -1;
    const bookContra = dir !== 0 && bookDir !== dir ? 1.0 : 0.0;

    const cvdDir = f.cvdSlope1m > 0 ? 1 : -1;
    const cvdContra = dir !== 0 && cvdDir !== dir ? 1.0 : 0.0;

    const liqSig = clamp(1 - f.nearestLiqClusterDistanceBps / 100, 0, 1);
    const oiSig = clamp(Math.abs(f.oiChange15m) / 0.02, 0, 1);

    return (
      0.2 * vwapSig +
      0.25 * bookContra +
      0.25 * cvdContra +
      0.15 * liqSig +
      0.15 * oiSig
    );
  }
}
