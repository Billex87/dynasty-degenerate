import type {
  ReportData,
  TrendingPlayer,
  WaiverWeeklyEcrSignal,
} from "@shared/types";

export type ScheduleEdgePositionFilter =
  | "ALL"
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "K"
  | "DEF";
export type ScheduleEdgeTone = "good" | "info" | "warn" | "danger";
export type ScheduleEdgeRow = {
  id: string;
  player: TrendingPlayer;
  signal: WaiverWeeklyEcrSignal;
  position: ScheduleEdgePositionFilter;
  team: string | null;
  bestRank: string;
  bestRankNumber: number | null;
  bestWeek: number | null;
  window: string;
  sourceFreshness: string;
  sourceTone: ScheduleEdgeTone;
  action: string;
  actionTone: ScheduleEdgeTone;
  value: number | null;
  currentRank: string | null;
  targetScore: number | null;
  note: string;
};
export type ScheduleSnapshotHealthCell = {
  id: string;
  position: Exclude<ScheduleEdgePositionFilter, "ALL">;
  week: number;
  label: string;
  tone: ScheduleEdgeTone;
  rowCount: number | null;
  updatedAt: string | null;
  detail: string;
};
export type ScheduleSnapshotHealthRow = {
  week: number;
  cells: Partial<
    Record<Exclude<ScheduleEdgePositionFilter, "ALL">, ScheduleSnapshotHealthCell>
  >;
};

export const SCHEDULE_EDGE_POSITION_FILTERS: ScheduleEdgePositionFilter[] = [
  "ALL",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
];

const SCHEDULE_EDGE_POSITION_LIMITS: Record<
  Exclude<ScheduleEdgePositionFilter, "ALL">,
  number
> = {
  QB: 40,
  RB: 90,
  WR: 105,
  TE: 24,
  K: 20,
  DEF: 20,
};

function normalizeScheduleEdgePosition(
  position?: string | null
): ScheduleEdgePositionFilter | null {
  const normalized = String(position || "").trim().toUpperCase();
  if (normalized === "DST" || normalized === "D/ST") return "DEF";
  if (
    normalized === "QB" ||
    normalized === "RB" ||
    normalized === "WR" ||
    normalized === "TE" ||
    normalized === "K" ||
    normalized === "DEF"
  ) {
    return normalized;
  }
  return null;
}

function getScheduleHealthPositionOrder(): Array<
  Exclude<ScheduleEdgePositionFilter, "ALL">
> {
  return ["QB", "RB", "WR", "TE", "K", "DEF"];
}

function getScheduleEdgeRankNumber(rank?: string | null): number | null {
  const parsed = String(rank || "").match(/\d+/)?.[0];
  if (!parsed) return null;
  const numeric = Number(parsed);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatScheduleEdgeRank(signal: WaiverWeeklyEcrSignal): string {
  if (signal.bestPositionRank) return signal.bestPositionRank;
  return signal.bestRankEcr ? `Rank ${Math.round(signal.bestRankEcr)}` : "Ranked";
}

function formatScheduleEdgeWindow(signal: WaiverWeeklyEcrSignal): string {
  return signal.weeks
    .slice(0, 3)
    .map(
      week =>
        `W${week.week} ${
          week.positionRank || (week.rankEcr ? `Rank ${week.rankEcr}` : "ranked")
        }`
    )
    .join(" / ");
}

export function formatScheduleEdgeValue(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000) return `${Math.round(rounded / 100) / 10}K`;
  return rounded.toLocaleString();
}

function formatScheduleEdgeDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseScheduleHealthEndpoint(
  sourceKey?: string | null,
  endpointKey?: string | null
): {
  position: Exclude<ScheduleEdgePositionFilter, "ALL">;
  week: number;
} | null {
  const value = `${sourceKey || ""}:${endpointKey || ""}`;
  const match = value.match(
    /fantasypros-weekly-ecr-(qb|rb|wr|te|k|dst|def)-week-(\d+)/i
  );
  if (!match) return null;
  const position = normalizeScheduleEdgePosition(match[1]);
  const week = Number(match[2]);
  if (!position || position === "ALL" || !Number.isFinite(week) || week <= 0)
    return null;
  return { position, week };
}

function getScheduleHealthStatus(input: {
  status?: string | null;
  level?: string | null;
  rowCount?: number | null;
  lastHealthStatus?: string | null;
  lastHealthMessage?: string | null;
}): Pick<ScheduleSnapshotHealthCell, "label" | "tone"> {
  const healthText = `${input.lastHealthStatus || ""} ${
    input.lastHealthMessage || ""
  }`.toLowerCase();

  if (/rate|429|too many/.test(healthText)) {
    return { label: "Rate limited", tone: "danger" };
  }
  if (input.status === "error" || input.level === "danger") {
    return { label: "Error", tone: "danger" };
  }
  if (input.rowCount === 0) {
    return { label: "Empty", tone: "warn" };
  }
  if (input.status === "missing") {
    return { label: "Missing", tone: "warn" };
  }
  if (input.status === "stale") {
    return { label: "Stale", tone: "warn" };
  }
  if (typeof input.rowCount === "number" && input.rowCount > 0) {
    return { label: "Loaded", tone: "good" };
  }
  return { label: "Pending", tone: "info" };
}

function getScheduleHealthDetail(input: {
  rowCount?: number | null;
  updatedAt?: string | null;
  lastHealthMessage?: string | null;
}): string {
  const rows =
    typeof input.rowCount === "number"
      ? `${input.rowCount.toLocaleString()} rows`
      : "Rows n/a";
  const updated = input.updatedAt
    ? formatScheduleEdgeDate(input.updatedAt)
    : "No date";
  return input.lastHealthMessage
    ? `${rows} - ${input.lastHealthMessage}`
    : `${rows} - ${updated}`;
}

export function buildScheduleSnapshotHealthRows(
  reportData: ReportData
): ScheduleSnapshotHealthRow[] {
  const cellsByWeek = new Map<
    number,
    Partial<Record<Exclude<ScheduleEdgePositionFilter, "ALL">, ScheduleSnapshotHealthCell>>
  >();
  const addCell = (cell: ScheduleSnapshotHealthCell) => {
    const weekCells = cellsByWeek.get(cell.week) || {};
    if (!weekCells[cell.position]) {
      weekCells[cell.position] = cell;
      cellsByWeek.set(cell.week, weekCells);
      return;
    }

    const existing = weekCells[cell.position]!;
    const toneRank: Record<ScheduleEdgeTone, number> = {
      danger: 0,
      warn: 1,
      info: 2,
      good: 3,
    };
    if (toneRank[cell.tone] < toneRank[existing.tone]) {
      weekCells[cell.position] = cell;
    }
  };

  for (const diagnostic of reportData.sourceSnapshotDiagnostics || []) {
    const parsed = parseScheduleHealthEndpoint(diagnostic.sourceKey);
    if (!parsed) continue;
    const status = getScheduleHealthStatus(diagnostic);
    addCell({
      id: `${parsed.week}-${parsed.position}`,
      position: parsed.position,
      week: parsed.week,
      label: status.label,
      tone: status.tone,
      rowCount: diagnostic.rowCount,
      updatedAt: diagnostic.updatedAt,
      detail: getScheduleHealthDetail(diagnostic),
    });
  }

  const targets = [
    ...(reportData.waiverIntelligence?.weeklyEcrTargets || []),
    ...(reportData.scheduleEdgeTargets || []),
  ];
  for (const target of targets) {
    for (const trace of target.signal.sourceTrace || []) {
      const parsed = parseScheduleHealthEndpoint(trace.sourceKey, trace.endpointKey);
      if (!parsed) continue;
      const status = getScheduleHealthStatus({
        status: trace.status,
        rowCount: trace.rowCount,
      });
      addCell({
        id: `${parsed.week}-${parsed.position}`,
        position: parsed.position,
        week: parsed.week,
        label: status.label,
        tone: status.tone,
        rowCount: trace.rowCount,
        updatedAt: trace.fetchedAt || trace.lastUpdated,
        detail: getScheduleHealthDetail({
          rowCount: trace.rowCount,
          updatedAt: trace.fetchedAt || trace.lastUpdated,
        }),
      });
    }
  }

  return Array.from(cellsByWeek.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, cells]) => ({
      week,
      cells: Object.fromEntries(
        getScheduleHealthPositionOrder().map(position => [
          position,
          cells[position],
        ])
      ) as ScheduleSnapshotHealthRow["cells"],
    }));
}

function getScheduleEdgeLatestDate(signal: WaiverWeeklyEcrSignal): string | null {
  const traceCandidates = signal.sourceTrace
    .flatMap(trace => [trace.fetchedAt, trace.lastUpdated])
    .filter((value): value is string => Boolean(value))
    .map(value => ({ value, time: Date.parse(value) }))
    .filter(entry => Number.isFinite(entry.time))
    .sort((a, b) => a.time - b.time);

  if (traceCandidates.length) return traceCandidates.at(-1)?.value || null;

  return signal.updatedAt && Number.isFinite(Date.parse(signal.updatedAt))
    ? signal.updatedAt
    : null;
}

function getScheduleEdgeSourceFreshness(
  signal: WaiverWeeklyEcrSignal,
  now: number
): {
  label: string;
  tone: ScheduleEdgeTone;
} {
  const trace = signal.sourceTrace || [];
  if (!trace.length) {
    return { label: "No source trace", tone: "warn" };
  }

  const hasGap = trace.some(
    entry => entry.status === "missing" || entry.status === "empty"
  );
  const latestDate = getScheduleEdgeLatestDate(signal);
  const latestTime = latestDate ? new Date(latestDate).getTime() : NaN;
  const ageDays = Number.isFinite(latestTime)
    ? (now - latestTime) / (1000 * 60 * 60 * 24)
    : null;
  const rowCounts = trace
    .map(entry => entry.rowCount)
    .filter((value): value is number => typeof value === "number");
  const minRows = rowCounts.length ? Math.min(...rowCounts) : null;
  const dateCopy = latestDate ? formatScheduleEdgeDate(latestDate) : "No date";
  const rowCopy =
    minRows === null ? "rows n/a" : `${minRows.toLocaleString()}+ rows`;

  if (ageDays !== null && ageDays > 8) {
    return { label: `Stale - ${dateCopy} - ${rowCopy}`, tone: "warn" };
  }

  if (hasGap) {
    return { label: `Partial - ${dateCopy} - ${rowCopy}`, tone: "warn" };
  }

  return { label: `Fresh - ${dateCopy} - ${rowCopy}`, tone: "good" };
}

function getScheduleEdgeAction(input: {
  position: ScheduleEdgePositionFilter;
  bestRankNumber: number | null;
  signal: WaiverWeeklyEcrSignal;
}): Pick<ScheduleEdgeRow, "action" | "actionTone"> {
  if (input.position === "ALL") {
    return { action: "Review", actionTone: "info" };
  }

  const rankLimit = SCHEDULE_EDGE_POSITION_LIMITS[input.position];
  const strongRank = Math.max(1, Math.round(rankLimit * 0.35));
  const playableRank = Math.max(strongRank + 1, Math.round(rankLimit * 0.7));

  if (input.bestRankNumber && input.bestRankNumber <= strongRank) {
    return {
      action:
        input.position === "K" || input.position === "DEF"
          ? "Streamer target"
          : "Priority watch",
      actionTone: "good",
    };
  }

  if (input.bestRankNumber && input.bestRankNumber <= playableRank) {
    return {
      action:
        input.position === "K" || input.position === "DEF"
          ? "Pairing option"
          : "Depth option",
      actionTone: "info",
    };
  }

  if (input.signal.rankDelta && input.signal.rankDelta > 0) {
    return { action: "Improving window", actionTone: "info" };
  }

  return { action: "Monitor only", actionTone: "warn" };
}

export function buildScheduleEdgeRows(
  reportData: ReportData,
  options: { now?: number | Date } = {}
): ScheduleEdgeRow[] {
  const waiver = reportData.waiverIntelligence;
  const scheduleTargets = reportData.scheduleEdgeTargets || [];
  if (!waiver && !scheduleTargets.length) return [];

  const now =
    options.now instanceof Date
      ? options.now.getTime()
      : typeof options.now === "number"
        ? options.now
        : Date.now();
  const weeklyTargets = [
    ...(waiver?.weeklyEcrTargets || []),
    ...scheduleTargets,
  ];
  const targetScores = new Map(
    weeklyTargets.map(target => [
      target.player.player_id,
      target.score,
    ])
  );
  const playersById = new Map<string, TrendingPlayer>();
  const targetSignalByPlayerId = new Map(
    weeklyTargets.map(target => [
      target.player.player_id,
      target.signal,
    ])
  );
  const addPlayer = (player?: TrendingPlayer | null) => {
    if (!player?.player_id || playersById.has(player.player_id)) return;
    const signal = player.weeklyEcr || targetSignalByPlayerId.get(player.player_id) || null;
    if (!signal) return;
    playersById.set(player.player_id, { ...player, weeklyEcr: signal });
  };

  weeklyTargets.forEach(target =>
    addPlayer({ ...target.player, weeklyEcr: target.signal })
  );
  waiver?.availableTrendingAdds.forEach(addPlayer);
  waiver?.recentlyDroppedValuable.forEach(addPlayer);
  waiver?.bestTaxiStashes.forEach(addPlayer);
  Object.values(waiver?.bestAvailableByPosition || {}).forEach(addPlayer);
  addPlayer(waiver?.highestKtcAvailable);

  return Array.from(playersById.values())
    .map((player): ScheduleEdgeRow | null => {
      const signal = player.weeklyEcr;
      const position = normalizeScheduleEdgePosition(signal?.position || player.pos);
      if (!signal || !position || position === "ALL") return null;
      const bestRank = formatScheduleEdgeRank(signal);
      const bestRankNumber =
        getScheduleEdgeRankNumber(signal.bestPositionRank) ||
        signal.bestRankEcr ||
        null;
      const freshness = getScheduleEdgeSourceFreshness(signal, now);
      const action = getScheduleEdgeAction({
        position,
        bestRankNumber,
        signal,
      });

      return {
        id: player.player_id,
        player,
        signal,
        position,
        team: signal.team || player.team || null,
        bestRank,
        bestRankNumber,
        bestWeek: signal.bestWeek,
        window: formatScheduleEdgeWindow(signal),
        sourceFreshness: freshness.label,
        sourceTone: freshness.tone,
        action: action.action,
        actionTone: action.actionTone,
        value: player.ktcValue,
        currentRank: player.currentPositionRank || null,
        targetScore: targetScores.get(player.player_id) || null,
        note: signal.note,
      };
    })
    .filter((row): row is ScheduleEdgeRow => Boolean(row))
    .sort((a, b) => {
      const aScore = a.targetScore ?? 0;
      const bScore = b.targetScore ?? 0;
      if (aScore !== bScore) return bScore - aScore;
      return (a.bestRankNumber || Infinity) - (b.bestRankNumber || Infinity);
    })
    .slice(0, 36);
}
