export type FantasyProsExpertSpreadTone = "stable" | "volatile" | "wide" | "unknown";

export type FantasyProsExpertSpreadInput = {
  bestRank?: number | null;
  worstRank?: number | null;
  averageRank?: number | null;
  rankStdDev?: number | null;
};

export type FantasyProsExpertSpreadSummary = {
  tone: FantasyProsExpertSpreadTone;
  label: string | null;
  confidenceAdjustment: number;
  range: number | null;
  stdDev: number | null;
};

function finiteNumber(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRankRange(input: FantasyProsExpertSpreadInput): number | null {
  const bestRank = finiteNumber(input.bestRank);
  const worstRank = finiteNumber(input.worstRank);
  if (bestRank === null || worstRank === null) return null;
  return Math.abs(worstRank - bestRank);
}

export function summarizeFantasyProsExpertSpread(
  input: FantasyProsExpertSpreadInput
): FantasyProsExpertSpreadSummary {
  const range = getRankRange(input);
  const stdDev = finiteNumber(input.rankStdDev);

  if ((stdDev !== null && stdDev >= 18) || (range !== null && range >= 36)) {
    return {
      tone: "wide",
      label: "Wide expert range",
      confidenceAdjustment: -10,
      range,
      stdDev,
    };
  }

  if ((stdDev !== null && stdDev >= 12) || (range !== null && range >= 24)) {
    return {
      tone: "volatile",
      label: "Volatile expert read",
      confidenceAdjustment: -5,
      range,
      stdDev,
    };
  }

  if ((stdDev !== null && stdDev <= 8) || (range !== null && range <= 14)) {
    return {
      tone: "stable",
      label: "Stable consensus",
      confidenceAdjustment: 6,
      range,
      stdDev,
    };
  }

  return {
    tone: "unknown",
    label: null,
    confidenceAdjustment: 0,
    range,
    stdDev,
  };
}

export function summarizeFantasyProsExpertSpreadRows(
  rows: FantasyProsExpertSpreadInput[]
): FantasyProsExpertSpreadSummary {
  const summaries = rows.map(summarizeFantasyProsExpertSpread);
  const wide = summaries.find(summary => summary.tone === "wide");
  if (wide) return wide;
  const volatile = summaries.find(summary => summary.tone === "volatile");
  if (volatile) return volatile;

  const stableCount = summaries.filter(summary => summary.tone === "stable").length;
  if (stableCount) {
    const stable = summaries.find(summary => summary.tone === "stable")!;
    return {
      ...stable,
      confidenceAdjustment: Math.min(12, stableCount * 6),
    };
  }

  return {
    tone: "unknown",
    label: null,
    confidenceAdjustment: 0,
    range: null,
    stdDev: null,
  };
}
