import {
  loadPlayerPropSnapshot,
  type PlayerPropLine,
  type PlayerPropSnapshot,
} from "./playerPropSnapshots";

export type PlayerPropModelProjection = {
  playerId?: string | null;
  playerName: string;
  market: string;
  projection: number;
  source?: string | null;
  updatedAt?: string | null;
};

export type PlayerPropMarketSignalDirection =
  | "market_higher"
  | "market_lower"
  | "aligned"
  | "market_only"
  | "projection_only";

export type PlayerPropMarketSignal = {
  playerId: string | null;
  playerName: string;
  market: string;
  marketLabel: string | null;
  marketLine: number | null;
  modelProjection: number | null;
  delta: number | null;
  direction: PlayerPropMarketSignalDirection;
  sportsbookCount: number;
  lineCount: number;
  lineRange: number | null;
  agreement: "strong" | "mixed" | "thin";
  confidence: "high" | "medium" | "low";
  startSitSupport:
    | "supports_start"
    | "supports_sit"
    | "neutral"
    | "market_only";
  summary: string;
};

type SignalBuildOptions = {
  snapshot?: PlayerPropSnapshot | null;
  lines?: PlayerPropLine[];
  projections?: PlayerPropModelProjection[];
};

function normalizeKey(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function groupKey(
  line: Pick<PlayerPropLine, "playerId" | "playerName" | "market">
) {
  return [
    line.playerId || normalizeKey(line.playerName),
    normalizeKey(line.market),
  ].join("|");
}

function projectionKey(projection: PlayerPropModelProjection) {
  return [
    projection.playerId || normalizeKey(projection.playerName),
    normalizeKey(projection.market),
  ].join("|");
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function deltaThreshold(market: string, marketLine: number | null) {
  const normalized = normalizeKey(market);
  if (normalized.includes("yard"))
    return Math.max(3, Math.abs(marketLine || 0) * 0.06);
  if (normalized.includes("reception")) return 0.75;
  if (normalized.includes("touchdown")) return 0.15;
  return Math.max(0.5, Math.abs(marketLine || 0) * 0.05);
}

function distinctSportsbooks(lines: PlayerPropLine[]) {
  const ids = new Set<string>();
  for (const line of lines) {
    for (const outcome of line.outcomes) {
      const key = outcome.sportsbookId || outcome.sportsbookName;
      if (key) ids.add(normalizeKey(key));
    }
  }
  return ids;
}

function getAgreement(
  sportsbookCount: number,
  lineRange: number | null,
  threshold: number
) {
  if (sportsbookCount < 2) return "thin" as const;
  if (lineRange !== null && lineRange > threshold) return "mixed" as const;
  return "strong" as const;
}

function getConfidence(
  sportsbookCount: number,
  agreement: PlayerPropMarketSignal["agreement"]
) {
  if (sportsbookCount >= 3 && agreement === "strong") return "high" as const;
  if (sportsbookCount >= 2 && agreement !== "mixed") return "medium" as const;
  return "low" as const;
}

function getDirection(
  marketLine: number | null,
  projection: PlayerPropModelProjection | undefined,
  threshold: number
): PlayerPropMarketSignalDirection {
  if (marketLine === null && projection) return "projection_only";
  if (marketLine === null || !projection) return "market_only";
  const delta = marketLine - projection.projection;
  if (delta >= threshold) return "market_higher";
  if (delta <= -threshold) return "market_lower";
  return "aligned";
}

function getStartSitSupport(direction: PlayerPropMarketSignalDirection) {
  if (direction === "market_higher") return "supports_start" as const;
  if (direction === "market_lower") return "supports_sit" as const;
  if (direction === "market_only") return "market_only" as const;
  return "neutral" as const;
}

function summarizeSignal(signal: Omit<PlayerPropMarketSignal, "summary">) {
  const bookLabel = `${signal.sportsbookCount} book${signal.sportsbookCount === 1 ? "" : "s"}`;
  if (signal.direction === "market_higher") {
    return `${bookLabel} price ${signal.playerName} above our ${signal.market} projection by ${Math.abs(signal.delta || 0).toFixed(1)}.`;
  }
  if (signal.direction === "market_lower") {
    return `${bookLabel} price ${signal.playerName} below our ${signal.market} projection by ${Math.abs(signal.delta || 0).toFixed(1)}.`;
  }
  if (signal.direction === "aligned") {
    return `${bookLabel} are aligned with our ${signal.market} projection for ${signal.playerName}.`;
  }
  if (signal.direction === "projection_only") {
    return `Projection exists for ${signal.playerName}, but no stored ${signal.market} prop line is available.`;
  }
  return `${bookLabel} have a stored ${signal.market} prop for ${signal.playerName}; projection comparison is pending.`;
}

export function buildPlayerPropMarketSignals(
  options: SignalBuildOptions = {}
): PlayerPropMarketSignal[] {
  const lines = options.lines || options.snapshot?.lines || [];
  const projections = new Map(
    (options.projections || []).map(projection => [
      projectionKey(projection),
      projection,
    ])
  );
  const grouped = new Map<string, PlayerPropLine[]>();

  for (const line of lines) {
    const key = groupKey(line);
    grouped.set(key, [...(grouped.get(key) || []), line]);
  }

  const signals: PlayerPropMarketSignal[] = [];
  grouped.forEach((group, key) => {
    const first = group[0];
    const marketLines = group
      .map(line => line.line)
      .filter((line): line is number => typeof line === "number");
    const marketLine = median(marketLines);
    const lineRange = marketLines.length
      ? Math.max(...marketLines) - Math.min(...marketLines)
      : null;
    const threshold = deltaThreshold(first.market, marketLine);
    const sportsbookCount = distinctSportsbooks(group).size;
    const agreement = getAgreement(sportsbookCount, lineRange, threshold);
    const projection = projections.get(key);
    const direction = getDirection(marketLine, projection, threshold);
    const delta =
      marketLine !== null && projection
        ? marketLine - projection.projection
        : null;
    const signalWithoutSummary: Omit<PlayerPropMarketSignal, "summary"> = {
      playerId: first.playerId,
      playerName: first.playerName,
      market: first.market,
      marketLabel: first.marketLabel,
      marketLine,
      modelProjection: projection?.projection ?? null,
      delta,
      direction,
      sportsbookCount,
      lineCount: group.length,
      lineRange,
      agreement,
      confidence: getConfidence(sportsbookCount, agreement),
      startSitSupport: getStartSitSupport(direction),
    };
    signals.push({
      ...signalWithoutSummary,
      summary: summarizeSignal(signalWithoutSummary),
    });
  });

  return signals.sort((a, b) => {
    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    return (
      confidenceOrder[a.confidence] - confidenceOrder[b.confidence] ||
      a.playerName.localeCompare(b.playerName)
    );
  });
}

export async function loadStoredPlayerPropMarketSignals(
  options: {
    projections?: PlayerPropModelProjection[];
  } = {}
) {
  const snapshot = await loadPlayerPropSnapshot({ sourceMode: "snapshot" });
  return {
    snapshotStatus: snapshot.status,
    snapshotKey: snapshot.snapshotKey,
    generatedAt: snapshot.generatedAt,
    signals: buildPlayerPropMarketSignals({
      snapshot,
      projections: options.projections,
    }),
  };
}
