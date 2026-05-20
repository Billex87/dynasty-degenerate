import type {
  ReportData,
  ManagerStarterPlayer,
  TrendingPlayer,
  WaiverWeeklyEcrSignal,
} from "@shared/types";
import { getShortTermMatchupOutlook } from "@shared/matchupWindows";
import { normalizeNflTeamAbbr } from "@/lib/teamTileStyle";

export type ScheduleEdgePositionFilter =
  | "ALL"
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "K"
  | "DEF";
export type ScheduleEdgeTone = "good" | "info" | "warn" | "danger";
export type ScheduleEdgeSortMode = "easiest" | "toughest" | "rank";
export type ScheduleEdgeWeekRange = {
  start: number;
  end: number;
};
export type ScheduleEdgeRangeSummary = {
  label: string;
  score: number | null;
  averageStars: number | null;
  playableWeeks: number;
  easyWeeks: number;
  hardWeeks: number;
  neutralWeeks: number;
  byeWeeks: number;
  missingWeeks: number[];
};
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
  playoffWindow: string | null;
  sourceFreshness: string;
  sourceTone: ScheduleEdgeTone;
  availabilityLabel: string;
  availabilityTone: ScheduleEdgeTone;
  availabilityDetail: string;
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
const SCHEDULE_EDGE_TABLE_ROW_LIMIT = 600;

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

function normalizeScheduleEdgeLookupKey(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getScheduleEdgeTeam(input: {
  position?: string | null;
  name?: string | null;
  team?: string | null;
  playerDetails?: { team?: string | null } | null;
}): string | null {
  const position = normalizeScheduleEdgePosition(input.position);
  return (
    normalizeNflTeamAbbr(input.team) ||
    normalizeNflTeamAbbr(input.playerDetails?.team) ||
    (position === "DEF" ? normalizeNflTeamAbbr(input.name) : null)
  );
}

function makeScheduleEdgeOwnershipKey(input: {
  position?: string | null;
  name?: string | null;
  team?: string | null;
}) {
  const position = normalizeScheduleEdgePosition(input.position);
  if (!position || position === "ALL") return null;
  const nameKey = normalizeScheduleEdgeLookupKey(input.name);
  const team = normalizeNflTeamAbbr(input.team);
  return {
    name: nameKey ? `${position}:name:${nameKey}` : null,
    team: team ? `${position}:team:${team}` : null,
  };
}

function buildScheduleEdgeOwnerLookup(reportData: ReportData) {
  const byPlayerId = new Map<string, string>();
  const byKey = new Map<string, string>();
  let hasRosterRows = false;

  const addOwner = (key: string | null, owner?: string | null) => {
    const manager = String(owner || "").trim();
    if (!key || !manager || byKey.has(key)) return;
    byKey.set(key, manager);
  };

  const addPlayerOwner = (
    player: ManagerStarterPlayer | undefined,
    owner?: string | null
  ) => {
    if (!player) return;
    const manager = String(owner || "").trim();
    if (!manager) return;
    hasRosterRows = true;
    if (player.player_id && !byPlayerId.has(player.player_id)) {
      byPlayerId.set(player.player_id, manager);
    }
    const position = normalizeScheduleEdgePosition(
      player.pos || player.playerDetails?.position
    );
    const team = getScheduleEdgeTeam({
      position,
      name: player.name || player.playerDetails?.fullName,
      team: (player as ManagerStarterPlayer & { team?: string | null }).team,
      playerDetails: player.playerDetails,
    });
    const keys = makeScheduleEdgeOwnershipKey({
      position,
      name: player.name || player.playerDetails?.fullName,
      team,
    });
    addOwner(keys?.name || null, manager);
    addOwner(keys?.team || null, manager);
  };

  for (const row of reportData.managerPositionCounts || []) {
    const players = [
      ...(row.rosterPlayers || []),
      ...(row.lineupPlayers || []),
      ...(row.starterPlayers || []),
      ...(row.starterGroups || []).flatMap(group => group.players || []),
    ];
    const seenPlayerIds = new Set<string>();
    for (const player of players) {
      if (player.player_id && seenPlayerIds.has(player.player_id)) continue;
      if (player.player_id) seenPlayerIds.add(player.player_id);
      addPlayerOwner(player, row.manager);
    }
  }

  return { byPlayerId, byKey, hasRosterRows };
}

function getScheduleEdgeAvailability(input: {
  player: TrendingPlayer;
  signal: WaiverWeeklyEcrSignal;
  position: ScheduleEdgePositionFilter;
  team: string | null;
  ownerLookup: ReturnType<typeof buildScheduleEdgeOwnerLookup>;
}): Pick<
  ScheduleEdgeRow,
  "availabilityLabel" | "availabilityTone" | "availabilityDetail"
> {
  const sourceOwner = String(input.player.owner || "").trim();
  if (sourceOwner && !/^available$/i.test(sourceOwner)) {
    return {
      availabilityLabel: sourceOwner,
      availabilityTone: "warn",
      availabilityDetail: "Player source already includes a roster owner.",
    };
  }

  const keys = makeScheduleEdgeOwnershipKey({
    position: input.position,
    name: input.signal.name || input.player.name,
    team: input.team,
  });
  const rosterOwner =
    input.ownerLookup.byPlayerId.get(input.player.player_id) ||
    input.ownerLookup.byKey.get(keys?.team || "") ||
    input.ownerLookup.byKey.get(keys?.name || "");

  if (rosterOwner) {
    return {
      availabilityLabel: rosterOwner,
      availabilityTone: "warn",
      availabilityDetail:
        "Matched to a manager roster in this report's Sleeper snapshot.",
    };
  }

  if (input.ownerLookup.hasRosterRows) {
    return {
      availabilityLabel: "Available",
      availabilityTone: "good",
      availabilityDetail:
        "Not found on any manager roster in this report's Sleeper snapshot.",
    };
  }

  return {
    availabilityLabel: "Unverified",
    availabilityTone: "info",
    availabilityDetail:
      "No league roster ownership map was present on this cached report.",
  };
}

function clampScheduleWeek(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(18, Math.round(value)));
}

export function normalizeScheduleEdgeWeekRange(
  range: Partial<ScheduleEdgeWeekRange>
): ScheduleEdgeWeekRange {
  const start = clampScheduleWeek(range.start ?? 1);
  const end = clampScheduleWeek(range.end ?? start);
  return start <= end ? { start, end } : { start: end, end: start };
}

function getScheduleEdgeRangeNumbers(range: ScheduleEdgeWeekRange): number[] {
  const normalized = normalizeScheduleEdgeWeekRange(range);
  return Array.from(
    { length: normalized.end - normalized.start + 1 },
    (_, index) => normalized.start + index
  );
}

function getScheduleEdgeStarValue(
  week: WaiverWeeklyEcrSignal["weeks"][number]
): number | null {
  if (
    typeof week.matchupStars === "number" &&
    Number.isFinite(week.matchupStars)
  ) {
    return Math.max(1, Math.min(5, week.matchupStars));
  }
  if (
    typeof week.opponentRank === "number" &&
    Number.isFinite(week.opponentRank)
  ) {
    const rank = Math.max(1, Math.min(32, week.opponentRank));
    return 1 + ((32 - rank) / 31) * 4;
  }
  return null;
}

function isScheduleEdgeEasyWeek(week: WaiverWeeklyEcrSignal["weeks"][number]) {
  if (week.isBye) return false;
  return week.matchupTier === "easy" || Number(week.matchupStars || 0) >= 4;
}

function isScheduleEdgeHardWeek(week: WaiverWeeklyEcrSignal["weeks"][number]) {
  if (week.isBye) return false;
  return (
    week.matchupTier === "hard" ||
    (typeof week.matchupStars === "number" && week.matchupStars <= 2)
  );
}

export function getScheduleEdgeWeeksInRange(
  row: Pick<ScheduleEdgeRow, "signal">,
  range: ScheduleEdgeWeekRange
): WaiverWeeklyEcrSignal["weeks"] {
  const selectedWeeks = new Set(getScheduleEdgeRangeNumbers(range));
  return row.signal.weeks
    .filter(week => selectedWeeks.has(week.week))
    .sort((a, b) => a.week - b.week);
}

export function getScheduleEdgeRangeSummary(
  row: Pick<ScheduleEdgeRow, "signal">,
  range: ScheduleEdgeWeekRange
): ScheduleEdgeRangeSummary {
  const normalized = normalizeScheduleEdgeWeekRange(range);
  const selectedWeekNumbers = getScheduleEdgeRangeNumbers(normalized);
  const selectedWeekSet = new Set(selectedWeekNumbers);
  const selectedRows = getScheduleEdgeWeeksInRange(row, normalized);
  const rowWeekSet = new Set(selectedRows.map(week => week.week));
  const missingWeeks = selectedWeekNumbers.filter(week => !rowWeekSet.has(week));
  const playableRows = selectedRows.filter(week => !week.isBye);
  const starValues = playableRows
    .map(getScheduleEdgeStarValue)
    .filter((value): value is number => value !== null);
  const averageStars = starValues.length
    ? Math.round(
        (starValues.reduce((total, value) => total + value, 0) /
          starValues.length) *
          10
      ) / 10
    : null;
  const score =
    averageStars === null
      ? null
      : Math.round(((averageStars - 1) / 4) * 100);
  const easyWeeks = playableRows.filter(isScheduleEdgeEasyWeek).length;
  const hardWeeks = playableRows.filter(isScheduleEdgeHardWeek).length;
  const byeWeeks = selectedRows.filter(week => week.isBye).length;
  const neutralWeeks = Math.max(
    0,
    playableRows.length - easyWeeks - hardWeeks
  );

  return {
    label:
      normalized.start === normalized.end
        ? `Week ${normalized.start}`
        : `Weeks ${normalized.start}-${normalized.end}`,
    score,
    averageStars,
    playableWeeks: playableRows.length,
    easyWeeks,
    hardWeeks,
    neutralWeeks,
    byeWeeks,
    missingWeeks: missingWeeks.filter(week => selectedWeekSet.has(week)),
  };
}

export function getScheduleEdgeRangeAction(
  row: ScheduleEdgeRow,
  range: ScheduleEdgeWeekRange
): Pick<ScheduleEdgeRow, "action" | "actionTone"> {
  const summary = getScheduleEdgeRangeSummary(row, range);
  if (!summary.playableWeeks) {
    return { action: "No data", actionTone: "warn" };
  }
  if (summary.hardWeeks >= 2 && summary.easyWeeks === 0) {
    return { action: "Avoid window", actionTone: "warn" };
  }
  if (
    (summary.averageStars !== null && summary.averageStars >= 4) ||
    summary.easyWeeks >= 2
  ) {
    return { action: "Target window", actionTone: "good" };
  }
  if (summary.averageStars !== null && summary.averageStars < 2.4) {
    return { action: "Tough stretch", actionTone: "danger" };
  }
  if (summary.easyWeeks > 0 || summary.averageStars === null || summary.averageStars >= 3) {
    return { action: "Matchup watch", actionTone: "info" };
  }
  return { action: row.action, actionTone: row.actionTone };
}

function formatScheduleEdgeRank(signal: WaiverWeeklyEcrSignal): string {
  if (signal.bestPositionRank) return signal.bestPositionRank;
  return signal.bestRankEcr ? `Rank ${Math.round(signal.bestRankEcr)}` : "Ranked";
}

function getScheduleEdgeWindowWeeks(
  signal: WaiverWeeklyEcrSignal,
  key: "next3" | "playoffs" = "next3"
): number[] | null {
  const weeks = signal.matchupWindows?.[key]?.weeks;
  return weeks?.length ? weeks : null;
}

function formatScheduleEdgeWindow(
  signal: WaiverWeeklyEcrSignal,
  key: "next3" | "playoffs" = "next3"
): string {
  const windowWeeks = getScheduleEdgeWindowWeeks(signal, key);
  const rows = windowWeeks
    ? signal.weeks.filter(week => windowWeeks.includes(week.week))
    : signal.weeks.slice(0, 3);

  return rows
    .map(week => {
      if (week.isBye) return `W${week.week} BYE`;
      if (week.opponent || week.matchupStars || week.opponentRank) {
        const site =
          week.homeAway === "home"
            ? "vs."
            : week.homeAway === "away"
              ? "at"
              : "";
        const opponent = week.opponent
          ? `${site} ${week.opponent}`.trim()
          : "opponent TBD";
        const stars =
          typeof week.matchupStars === "number"
            ? `${week.matchupStars}-star`
            : "unrated";
        const rank =
          typeof week.opponentRank === "number" ? `#${week.opponentRank}` : null;
        return `W${week.week} ${opponent} ${stars}${rank ? ` (${rank})` : ""}`;
      }
      return `W${week.week} ${
        week.positionRank || (week.rankEcr ? `Rank ${week.rankEcr}` : "ranked")
      }`;
    })
    .join(" / ");
}

export function formatScheduleEdgeValue(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000) return `${Math.round(rounded / 100) / 10}K`;
  return rounded.toLocaleString();
}

export function sortScheduleEdgeRows(
  rows: ScheduleEdgeRow[],
  range: ScheduleEdgeWeekRange,
  sortMode: ScheduleEdgeSortMode
): ScheduleEdgeRow[] {
  const summaryById = new Map(
    rows.map(row => [row.id, getScheduleEdgeRangeSummary(row, range)])
  );
  const rankValue = (row: ScheduleEdgeRow) => row.bestRankNumber || Infinity;
  const scoreValue = (row: ScheduleEdgeRow) =>
    summaryById.get(row.id)?.score ?? -1;

  return [...rows].sort((a, b) => {
    if (sortMode === "rank") {
      const rankDelta = rankValue(a) - rankValue(b);
      if (rankDelta) return rankDelta;
      return scoreValue(b) - scoreValue(a);
    }

    const aScore = scoreValue(a);
    const bScore = scoreValue(b);
    if (aScore !== bScore) {
      return sortMode === "easiest" ? bScore - aScore : aScore - bScore;
    }
    return rankValue(a) - rankValue(b);
  });
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
  const matchupMatch = value.match(
    /fantasypros-matchup-calendar-(qb|rb|wr|te|k|dst|def)-week-(\d+)/i
  );
  if (matchupMatch) {
    const position = normalizeScheduleEdgePosition(matchupMatch[1]);
    const week = Number(matchupMatch[2]);
    if (!position || position === "ALL" || !Number.isFinite(week) || week <= 0)
      return null;
    return { position, week };
  }

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
  if (input.status === "missing") {
    return { label: "Missing", tone: "warn" };
  }
  if (input.status === "stale") {
    return { label: "Stale", tone: "warn" };
  }
  if (input.rowCount === 0) {
    return {
      label: "No rows yet",
      tone: input.level === "warn" ? "warn" : "info",
    };
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
  const next3Weeks = input.signal.matchupWindows?.next3?.weeks || null;
  const playableWeeks = input.signal.weeks
    .filter(week => !next3Weeks || next3Weeks.includes(week.week))
    .filter(week => !week.isBye);
  const bestStars =
    input.signal.matchupWindows?.next3?.bestMatchupStars ??
    input.signal.bestMatchupStars ??
    playableWeeks.reduce(
      (best, week) => Math.max(best, Number(week.matchupStars || 0)),
      0
    );
  const easyWeeks =
    input.signal.matchupWindows?.next3?.easyWeeks ??
    playableWeeks.filter(
      week => week.matchupTier === "easy" || Number(week.matchupStars || 0) >= 4
    ).length;
  const isSpecialTeams = input.position === "K" || input.position === "DEF";
  const outlook = isSpecialTeams && input.signal.signalType === "matchup-calendar"
    ? getShortTermMatchupOutlook(input.signal.matchupWindows)
    : null;

  if (outlook?.isRoughStart) {
    return { action: "Avoid early stream", actionTone: "warn" };
  }

  if (bestStars >= 4 && input.bestRankNumber && input.bestRankNumber <= playableRank) {
    return {
      action:
        isSpecialTeams
          ? "Streamer target"
          : "Start window",
      actionTone: "good",
    };
  }

  if (
    input.bestRankNumber &&
    input.bestRankNumber <= strongRank &&
    (!bestStars || bestStars >= 3)
  ) {
    return {
      action:
        isSpecialTeams
          ? "Streamer target"
          : "Priority watch",
      actionTone: "good",
    };
  }

  if ((bestStars >= 3 || easyWeeks > 0) && input.bestRankNumber && input.bestRankNumber <= rankLimit) {
    return {
      action:
        isSpecialTeams
          ? "Pairing option"
          : "Matchup watch",
      actionTone: "info",
    };
  }

  if (input.bestRankNumber && input.bestRankNumber <= playableRank) {
    return {
      action:
        isSpecialTeams
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
  const ownerLookup = buildScheduleEdgeOwnerLookup(reportData);
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
      const team = getScheduleEdgeTeam({
        position,
        name: player.name || signal.name,
        team: signal.team || player.team,
      });
      const availability = getScheduleEdgeAvailability({
        player,
        signal,
        position,
        team,
        ownerLookup,
      });

      return {
        id: player.player_id,
        player,
        signal,
        position,
        team,
        bestRank,
        bestRankNumber,
        bestWeek: signal.bestWeek,
        window: formatScheduleEdgeWindow(signal),
        playoffWindow: signal.matchupWindows?.playoffs?.playableWeeks
          ? formatScheduleEdgeWindow(signal, "playoffs")
          : null,
        sourceFreshness: freshness.label,
        sourceTone: freshness.tone,
        availabilityLabel: availability.availabilityLabel,
        availabilityTone: availability.availabilityTone,
        availabilityDetail: availability.availabilityDetail,
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
    .slice(0, SCHEDULE_EDGE_TABLE_ROW_LIMIT);
}
