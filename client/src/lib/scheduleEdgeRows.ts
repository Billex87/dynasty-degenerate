import type {
  ReportData,
  ManagerStarterPlayer,
  TrendingPlayer,
  WaiverWeeklyEcrSignal,
  WaiverSourceTraceEntry,
} from "@shared/types";
import { getShortTermMatchupOutlook } from "@shared/matchupWindows";
import {
  evaluateAIEvidence,
  getAIEvidenceLeagueContextFromDiagnostics,
  type AIEvidenceAction,
  type AIEvidenceMode,
  type AIEvidenceResult,
  type AISourceTrace,
} from "@shared/aiEvidenceEngine";
import { buildAIEvidenceLeagueActivityContext } from "@shared/leagueActivityContext";
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
  seasonRank: string | null;
  seasonRankNumber: number | null;
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
  decisionLabel: string;
  decisionTone: ScheduleEdgeTone;
  evidenceRead: AIEvidenceResult;
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

function isDraftSharksScheduleSignal(signal?: WaiverWeeklyEcrSignal | null): boolean {
  return signal?.source === "DraftSharks" || signal?.signalType === "draftsharks-sos";
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

function getScheduleEdgeSeasonRank(input: {
  player: TrendingPlayer;
  signal: WaiverWeeklyEcrSignal;
}): string | null {
  const profile = input.player.playerDetails?.valueProfile;
  return (
    profile?.seasonPositionRank ||
    profile?.fantasyProsPositionRank ||
    input.player.currentPositionRank ||
    input.signal.bestPositionRank ||
    null
  );
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
  const rankValue = (row: ScheduleEdgeRow) =>
    row.seasonRankNumber || row.bestRankNumber || Infinity;
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
  const draftSharksMatch = value.match(
    /draftsharks-sos-(qb|rb|wr|te|k|dst|def)-week-(\d+)/i
  );
  if (draftSharksMatch) {
    const position = normalizeScheduleEdgePosition(draftSharksMatch[1]);
    const week = Number(draftSharksMatch[2]);
    if (!position || position === "ALL" || !Number.isFinite(week) || week <= 0)
      return null;
    return { position, week };
  }

  return null;
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

function normalizeScheduleEvidenceTraceStatus(
  trace: Pick<WaiverSourceTraceEntry, "status" | "rowCount">
): AISourceTrace["status"] {
  const status = String(trace.status || "").trim().toLowerCase();
  if (/error|failed|danger/.test(status)) return "error";
  if (/stale/.test(status)) return "stale";
  if (/missing|empty|no rows/.test(status) || trace.rowCount === 0) {
    return "missing";
  }
  if (/blocked|rate|limit|partial/.test(status)) return "limited";
  if (/loaded|ok|success/.test(status)) return "loaded";
  return "limited";
}

function getScheduleEvidenceTraceAgeHours(
  trace: Pick<WaiverSourceTraceEntry, "fetchedAt" | "lastUpdated">,
  now: number
): number | null {
  const latestTime = [trace.fetchedAt, trace.lastUpdated]
    .map(value => (value ? Date.parse(value) : NaN))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  if (!Number.isFinite(latestTime)) return null;
  return Math.max(0, Math.round(((now - latestTime) / (1000 * 60 * 60)) * 10) / 10);
}

function getScheduleEvidenceSourceTrace(
  signal: WaiverWeeklyEcrSignal,
  now: number
): AISourceTrace[] {
  return (signal.sourceTrace || []).map(trace => {
    const status = normalizeScheduleEvidenceTraceStatus(trace);
    const rowCopy =
      typeof trace.rowCount === "number"
        ? `${trace.rowCount.toLocaleString()} rows`
        : "rows n/a";
    const weekCopy = trace.week ? `W${trace.week}` : null;
    const detail = [weekCopy, trace.position, rowCopy, trace.evidence]
      .filter(Boolean)
      .join(" - ");

    return {
      label: trace.endpointLabel || trace.source || "Schedule source",
      status,
      detail,
      ageHours: getScheduleEvidenceTraceAgeHours(trace, now),
    };
  });
}

function getScheduleEvidenceAction(
  position: ScheduleEdgePositionFilter,
  action: Pick<ScheduleEdgeRow, "action" | "actionTone">
): AIEvidenceAction {
  if (position === "K" || position === "DEF") return "stream";
  if (/avoid|tough/i.test(action.action)) return "avoid";
  if (action.actionTone === "good") return "start";
  return "watch";
}

function getScheduleEvidenceModes(): AIEvidenceMode[] {
  return ["redraft", "current", "schedule"];
}

function hasScheduleWeekMatchupData(week: WaiverWeeklyEcrSignal["weeks"][number]) {
  return Boolean(
    week.isBye ||
      week.opponent ||
      week.matchupTier ||
      typeof week.matchupStars === "number" ||
      typeof week.opponentRank === "number"
  );
}

function getScheduleEvidenceWindow(signal: WaiverWeeklyEcrSignal): {
  hasScheduleData: boolean;
  isRoughStart: boolean;
  isStrongStart: boolean;
  playableWeeks: number;
  easyWeeks: number;
  hardWeeks: number;
  averageStars: number | null;
} {
  const windowWeeks = getScheduleEdgeWindowWeeks(signal, "next3");
  const rows = windowWeeks
    ? signal.weeks.filter(week => windowWeeks.includes(week.week))
    : signal.weeks.slice(0, 3);
  const playableRows = rows.filter(week => !week.isBye);
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
  const easyWeeks = playableRows.filter(isScheduleEdgeEasyWeek).length;
  const hardWeeks = playableRows.filter(isScheduleEdgeHardWeek).length;
  const hasScheduleData = rows.some(hasScheduleWeekMatchupData);
  const outlook = signal.matchupWindows
    ? getShortTermMatchupOutlook(signal.matchupWindows)
    : null;
  const isRoughStart = Boolean(
    hasScheduleData &&
      (outlook?.isRoughStart ||
        (hardWeeks >= 2 && easyWeeks === 0) ||
        (averageStars !== null && averageStars < 2.4))
  );
  const isStrongStart = Boolean(
    hasScheduleData &&
      (easyWeeks >= 2 || (averageStars !== null && averageStars >= 4))
  );

  return {
    hasScheduleData,
    isRoughStart,
    isStrongStart,
    playableWeeks: playableRows.length,
    easyWeeks,
    hardWeeks,
    averageStars,
  };
}

function buildScheduleEvidenceRead(input: {
  reportData: ReportData;
  player: TrendingPlayer;
  signal: WaiverWeeklyEcrSignal;
  position: ScheduleEdgePositionFilter;
  team: string | null;
  bestRank: string;
  bestRankNumber: number | null;
  seasonRank: string | null;
  seasonRankNumber: number | null;
  targetScore: number | null;
  action: Pick<ScheduleEdgeRow, "action" | "actionTone">;
  availability: Pick<
    ScheduleEdgeRow,
    "availabilityLabel" | "availabilityTone" | "availabilityDetail"
  >;
  freshness: { label: string; tone: ScheduleEdgeTone };
  now: number;
}): AIEvidenceResult {
  const sourceTrace = getScheduleEvidenceSourceTrace(input.signal, input.now);
  const window = getScheduleEvidenceWindow(input.signal);
  const isStreamRead = input.position === "K" || input.position === "DEF";
  const hasRosterOwner =
    input.availability.availabilityTone === "warn" &&
    !/^available$/i.test(input.availability.availabilityLabel);
  const loadedSourceCount = sourceTrace.filter(trace => trace.status === "loaded").length;
  const hasPartialSource = sourceTrace.some(
    trace => trace.status === "missing" || trace.status === "limited"
  );
  const baseScore =
    input.targetScore !== null
      ? input.targetScore
      : input.signal.confidence
        ? Math.min(input.signal.confidence, 52)
        : input.bestRankNumber
          ? Math.max(35, 72 - input.bestRankNumber)
          : 42;
  const confidenceCap = !sourceTrace.length
    ? 48
    : input.availability.availabilityTone === "info"
      ? 54
    : hasPartialSource
      ? 60
      : null;
  const confidenceCapReason = !sourceTrace.length
    ? "No schedule source trace"
    : input.availability.availabilityTone === "info"
      ? "Unverified roster availability"
    : hasPartialSource
      ? "Partial schedule source trace"
      : null;

  return evaluateAIEvidence({
    surface: "schedule",
    action: getScheduleEvidenceAction(input.position, input.action),
    leagueValueMode: input.reportData.leagueValueMode === "redraft" ? "redraft" : "dynasty",
    leagueContext: getAIEvidenceLeagueContextFromDiagnostics(
      input.reportData.leagueDiagnostics,
      input.reportData.leagueValueMode === "redraft" ? "redraft" : "dynasty"
    ),
    leagueActivity: buildAIEvidenceLeagueActivityContext(input.reportData),
    signalModes: getScheduleEvidenceModes(),
    baseScore,
    evidence: [
      input.seasonRank && input.seasonRankNumber
        ? `${input.seasonRank} current-season rank anchors this matchup read.`
        : input.bestRankNumber
          ? `${input.bestRank} schedule rank is in the playable range.`
        : null,
      window.hasScheduleData
        ? `Next matchup window: ${formatScheduleEdgeWindow(input.signal)}.`
        : null,
      input.targetScore !== null
        ? `Schedule target score ${Math.round(input.targetScore)}.`
        : null,
      input.availability.availabilityTone === "good"
        ? "League roster snapshot shows this player is available."
        : null,
      input.player.ktcValue
        ? `Market value ${formatScheduleEdgeValue(input.player.ktcValue)}.`
        : null,
      input.freshness.tone === "good" ? input.freshness.label : null,
    ].filter((value): value is string => Boolean(value)),
    missingEvidence: [
      !sourceTrace.length ? "No source trace attached to this schedule row." : null,
      !window.hasScheduleData
        ? "No opponent or schedule-strength data for the short-term schedule window."
        : null,
      input.availability.availabilityTone === "info"
        ? input.availability.availabilityDetail
        : null,
    ].filter((value): value is string => Boolean(value)),
    sourceTrace,
    confidenceCap,
    confidenceCapReason,
    player: {
      name: input.player.name || input.signal.name,
      position: input.position,
      team: input.team,
      owner: isStreamRead && hasRosterOwner ? input.availability.availabilityLabel : null,
      rosterStatus: input.player.playerDetails?.rosterStatus || input.player.playerDetails?.displayStatus || null,
      injuryStatus: input.player.playerDetails?.injuryStatus || null,
      nflStatus: input.player.playerDetails?.status || null,
      weeklyProjectionStatus: input.player.playerDetails?.weeklyProjection?.status || null,
      hasByeWeek:
        input.player.playerDetails?.weeklyProjection?.homeAway === "bye" ||
        input.player.playerDetails?.weeklyProjection?.status === "bye",
      value: input.player.ktcValue,
      sourceCount: loadedSourceCount || sourceTrace.length,
      hasCurrentSeasonValue: true,
      hasDynastyValue: input.reportData.leagueValueMode !== "redraft",
      hasProspectOnlyValue: false,
    },
    schedule: {
      hasScheduleData: window.hasScheduleData,
      isRoughStart: window.isRoughStart,
      isStrongStart: window.isStrongStart,
      missingReason:
        "No opponent or schedule-strength data for the short-term schedule window.",
    },
    requiresActiveTeam: true,
    requiresLiveAvailability: isStreamRead,
    requiresCurrentSeasonEvidence: true,
    staleSourceCap: 58,
    calibrationProfile: input.reportData.aiCalibrationAdjustmentProfile,
    calibrationManager: input.reportData.viewerManager,
  });
}

function getScheduleDecisionLabel(read: AIEvidenceResult): string {
  if (read.canAct) return "Review this";
  if (read.label === "blocked") return "Don't add";
  return "Don't force it";
}

function getScheduleDecisionTone(read: AIEvidenceResult): ScheduleEdgeTone {
  if (read.canAct) return "good";
  if (read.label === "blocked") return "danger";
  if (read.label === "watchlist") return "info";
  return "warn";
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
  const outlook = isSpecialTeams && isDraftSharksScheduleSignal(input.signal) && input.signal.matchupWindows
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
    ...(waiver?.weeklyEcrTargets || []).filter(target => isDraftSharksScheduleSignal(target.signal)),
    ...scheduleTargets.filter(target => isDraftSharksScheduleSignal(target.signal)),
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
    if (!signal || !isDraftSharksScheduleSignal(signal)) return;
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
      const seasonRank = getScheduleEdgeSeasonRank({ player, signal });
      const seasonRankNumber =
        getScheduleEdgeRankNumber(seasonRank) || bestRankNumber;
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
      const targetScore = targetScores.get(player.player_id) || null;
      const evidenceRead = buildScheduleEvidenceRead({
        reportData,
        player,
        signal,
        position,
        team,
        bestRank,
        bestRankNumber,
        seasonRank,
        seasonRankNumber,
        targetScore,
        action,
        availability,
        freshness,
        now,
      });

      return {
        id: player.player_id,
        player,
        signal,
        position,
        team,
        bestRank,
        bestRankNumber,
        seasonRank,
        seasonRankNumber,
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
        decisionLabel: getScheduleDecisionLabel(evidenceRead),
        decisionTone: getScheduleDecisionTone(evidenceRead),
        evidenceRead,
        value: player.ktcValue,
        currentRank: seasonRank,
        targetScore,
        note: signal.note,
      };
    })
    .filter((row): row is ScheduleEdgeRow => Boolean(row))
    .sort((a, b) => {
      const aBlocked = a.evidenceRead.label === "blocked";
      const bBlocked = b.evidenceRead.label === "blocked";
      if (aBlocked !== bBlocked) return aBlocked ? 1 : -1;
      const aHasTarget = a.targetScore !== null;
      const bHasTarget = b.targetScore !== null;
      if (aHasTarget !== bHasTarget) return aHasTarget ? -1 : 1;
      if (a.evidenceRead.finalScore !== b.evidenceRead.finalScore) {
        return b.evidenceRead.finalScore - a.evidenceRead.finalScore;
      }
      const aScore = a.targetScore ?? 0;
      const bScore = b.targetScore ?? 0;
      if (aScore !== bScore) return bScore - aScore;
      return (
        (a.seasonRankNumber || a.bestRankNumber || Infinity) -
        (b.seasonRankNumber || b.bestRankNumber || Infinity)
      );
    })
    .slice(0, SCHEDULE_EDGE_TABLE_ROW_LIMIT);
}
