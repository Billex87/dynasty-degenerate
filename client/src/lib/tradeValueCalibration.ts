import type { ManagerIntelPlayer, PlayerDetails } from "@shared/types";

export type TradeValueCalibrationOutcome =
  | "confirmed-riser"
  | "confirmed-faller"
  | "watch-riser"
  | "watch-faller"
  | "low-denominator-watch"
  | "stable-hold";

export type TradeValueCalibration = {
  outcome: TradeValueCalibrationOutcome;
  direction: "up" | "down" | "flat";
  confidence: "high" | "medium" | "low";
  label: string;
  chip: string;
  tone: "good" | "warn" | "danger" | "neutral";
  startValue: number;
  endValue: number;
  diff: number;
  pctChange: number;
  sourceSetChanged: boolean;
};

export type TradeValueCalibrationAsset = Pick<
  ManagerIntelPlayer,
  "name" | "playerDetails"
>;

export type TradeValueCalibrationCoverage = {
  totalPlayers: number;
  timelinePlayers: number;
  signalPlayers: number;
  confirmedRisers: number;
  confirmedFallers: number;
  watchRisers: number;
  watchFallers: number;
  lowBaseWatch: number;
  stableHolds: number;
};

export function classifyStoredValueMove(input: {
  startValue: number;
  endValue: number;
  baselineSourceCount?: number;
  currentSourceCount?: number;
  sourceSetChanged?: boolean;
}): TradeValueCalibration | null {
  const startValue = positive(input.startValue);
  const endValue = positive(input.endValue);
  if (startValue === null || endValue === null) return null;

  const diff = endValue - startValue;
  const pctChange = Math.round((diff / startValue) * 1000) / 10;
  const thinSourceCoverage =
    Math.min(input.baselineSourceCount || 0, input.currentSourceCount || 0) < 2;
  const lowDenominator = startValue < 650 && Math.abs(diff) >= 300;
  const largePositive = diff >= 750 && pctChange >= 15;
  const largeNegative = diff <= -650 && pctChange <= -15;
  const mildPositive = diff >= 350 && pctChange >= 10 && !largePositive;
  const mildNegative = diff <= -350 && pctChange <= -10 && !largeNegative;

  let outcome: TradeValueCalibrationOutcome = "stable-hold";
  if (lowDenominator) outcome = "low-denominator-watch";
  else if (largePositive) outcome = "confirmed-riser";
  else if (largeNegative) outcome = "confirmed-faller";
  else if (mildPositive) outcome = "watch-riser";
  else if (mildNegative) outcome = "watch-faller";

  const loudMove = largePositive || largeNegative;
  const confidence =
    loudMove && !thinSourceCoverage && !lowDenominator
      ? "high"
      : (mildPositive || mildNegative) && !lowDenominator
        ? "medium"
        : "low";
  const direction = diff >= 250 ? "up" : diff <= -250 ? "down" : "flat";
  const { label, chip, tone } = getOutcomeDisplay(outcome);

  return {
    outcome,
    direction,
    confidence,
    label,
    chip,
    tone,
    startValue,
    endValue,
    diff,
    pctChange,
    sourceSetChanged: Boolean(input.sourceSetChanged),
  };
}

export function getPlayerTradeValueCalibration(
  details?: PlayerDetails | null
): TradeValueCalibration | null {
  const timeline = details?.valueTimeline;
  if (!timeline?.points?.length) return null;

  const firstPoint = timeline.points[0];
  const lastPoint = timeline.points[timeline.points.length - 1];
  const startValue = positive(timeline.summary.startValue) ?? positive(firstPoint.value);
  const endValue = positive(timeline.summary.endValue) ?? positive(lastPoint.value);
  if (startValue === null || endValue === null) return null;

  return classifyStoredValueMove({
    startValue,
    endValue,
    baselineSourceCount: firstPoint.sourceCount || firstPoint.sources?.length || 0,
    currentSourceCount: lastPoint.sourceCount || lastPoint.sources?.length || 0,
    sourceSetChanged: timeline.summary.sourceSetChanged,
  });
}

export function getStrongestTradeValueCalibration<T extends TradeValueCalibrationAsset>(
  assets: T[]
): { asset: T; calibration: TradeValueCalibration } | null {
  return assets
    .map(asset => ({
      asset,
      calibration: getPlayerTradeValueCalibration(asset.playerDetails),
    }))
    .filter(
      (row): row is { asset: T; calibration: TradeValueCalibration } =>
        Boolean(row.calibration && row.calibration.outcome !== "stable-hold")
    )
    .sort((a, b) => {
      const priorityDiff =
        getOutcomePriority(b.calibration.outcome) -
        getOutcomePriority(a.calibration.outcome);
      if (priorityDiff !== 0) return priorityDiff;
      return Math.abs(b.calibration.diff) - Math.abs(a.calibration.diff);
    })[0] || null;
}

export function buildTradeValueCalibrationCoverage<T extends TradeValueCalibrationAsset>(
  assets: T[]
): TradeValueCalibrationCoverage {
  const uniqueAssets = dedupeAssets(assets);
  const coverage: TradeValueCalibrationCoverage = {
    totalPlayers: uniqueAssets.length,
    timelinePlayers: 0,
    signalPlayers: 0,
    confirmedRisers: 0,
    confirmedFallers: 0,
    watchRisers: 0,
    watchFallers: 0,
    lowBaseWatch: 0,
    stableHolds: 0,
  };

  uniqueAssets.forEach(asset => {
    const calibration = getPlayerTradeValueCalibration(asset.playerDetails);
    if (!calibration) return;
    coverage.timelinePlayers += 1;
    if (calibration.outcome === "stable-hold") {
      coverage.stableHolds += 1;
      return;
    }
    coverage.signalPlayers += 1;
    if (calibration.outcome === "confirmed-riser") coverage.confirmedRisers += 1;
    if (calibration.outcome === "confirmed-faller") coverage.confirmedFallers += 1;
    if (calibration.outcome === "watch-riser") coverage.watchRisers += 1;
    if (calibration.outcome === "watch-faller") coverage.watchFallers += 1;
    if (calibration.outcome === "low-denominator-watch") coverage.lowBaseWatch += 1;
  });

  return coverage;
}

export function buildTradeValueCalibrationNote({
  name,
  calibration,
  side,
}: {
  name: string;
  calibration: TradeValueCalibration;
  side: "incoming" | "outgoing" | "neutral";
}): string {
  const move = `${formatSigned(calibration.diff)} since the earliest value check`;
  if (calibration.outcome === "low-denominator-watch") {
    return `${name} has a low-baseline value move (${move}), so this should stay watch-list language instead of becoming a hard trade demand.`;
  }
  if (calibration.outcome === "confirmed-riser") {
    return side === "outgoing"
      ? `Selling ${name} means moving a confirmed riser (${move}); make the return pay for that momentum.`
      : `Buying ${name} adds a confirmed riser (${move}), so the price can be justified when roster fit also checks out.`;
  }
  if (calibration.outcome === "confirmed-faller") {
    return side === "incoming"
      ? `Buying ${name} carries a confirmed faller tag (${move}); require role and schedule context before treating it as a discount.`
      : `Moving ${name} off the roster trims a confirmed faller profile (${move}), which can protect the rest of the package.`;
  }
  if (calibration.outcome === "watch-riser") {
    return side === "outgoing"
      ? `${name} has a soft riser signal (${move}); avoid tossing that momentum into a deal as a casual throw-in.`
      : `${name} has a soft riser signal (${move}); use it as supporting context, not the whole case.`;
  }
  if (calibration.outcome === "watch-faller") {
    return side === "incoming"
      ? `${name} has a soft faller signal (${move}); keep the offer protected unless the role evidence offsets it.`
      : `${name} has a soft faller signal (${move}); moving that risk can be reasonable if the value gap is close.`;
  }
  return `${name}'s value movement is stable, so trade copy should stay focused on fit and price.`;
}

function getOutcomeDisplay(outcome: TradeValueCalibrationOutcome): Pick<
  TradeValueCalibration,
  "label" | "chip" | "tone"
> {
  if (outcome === "confirmed-riser") {
    return { label: "Confirmed Riser", chip: "Riser +", tone: "good" };
  }
  if (outcome === "confirmed-faller") {
    return { label: "Confirmed Faller", chip: "Faller -", tone: "danger" };
  }
  if (outcome === "watch-riser") {
    return { label: "Soft Riser", chip: "Watch +", tone: "good" };
  }
  if (outcome === "watch-faller") {
    return { label: "Soft Faller", chip: "Watch -", tone: "warn" };
  }
  if (outcome === "low-denominator-watch") {
    return { label: "Low-Base Watch", chip: "Low base", tone: "warn" };
  }
  return { label: "Stable Hold", chip: "Stable", tone: "neutral" };
}

function getOutcomePriority(outcome: TradeValueCalibrationOutcome): number {
  if (outcome === "confirmed-riser" || outcome === "confirmed-faller") return 4;
  if (outcome === "watch-riser" || outcome === "watch-faller") return 3;
  if (outcome === "low-denominator-watch") return 2;
  return 0;
}

function dedupeAssets<T extends TradeValueCalibrationAsset>(assets: T[]): T[] {
  const seen = new Set<string>();
  return assets.filter(asset => {
    const key =
      asset.playerDetails?.playerId ||
      asset.playerDetails?.fullName ||
      asset.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
}

function positive(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}
