import { gunzipSync } from 'zlib';
import { findLatestProviderDataSnapshot, upsertProviderDataSnapshot } from './db';
import { getProviderSnapshotDateKey, parseProviderSnapshotPayload } from './providerDataSnapshots';
import { parseCsv } from './nflverseDraftCapital';
import { buildProspectLookup, findProspectProfile, loadProspectContext } from './prospectSource';
import { buildUsageTrendMomentumSummary, type WeeklyUsageObservation } from './usageTrendMomentum';
import type { PlayerDetails, ProspectProfile } from '../shared/types';

export const NFLVERSE_USAGE_SOURCE_PREFIX = 'nflverse-usage-v1';
export const NFLVERSE_TEAM_ENVIRONMENT_SOURCE_PREFIX = 'nflverse-team-environment-v1';
export const NFLVERSE_ROSTER_ROOM_SOURCE_PREFIX = 'nflverse-roster-room-v1';
export const NFLVERSE_INJURY_SOURCE_PREFIX = 'nflverse-injuries-v1';
export const NFLVERSE_COMBINE_SOURCE_KEY = 'nflverse-combine-v1';
export const NFLVERSE_CONTRACT_SOURCE_KEY = 'nflverse-contracts-v1';

const PLAYER_STATS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_{season}.csv';
const TEAM_STATS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_reg_{season}.csv';
const PBP_URL = 'https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.csv.gz';
const SNAP_COUNTS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_{season}.csv';
const ROSTERS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{season}.csv';
const WEEKLY_ROSTERS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_{season}.csv';
const DEPTH_CHARTS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_{season}.csv';
const TRADES_URL = 'https://github.com/nflverse/nflverse-data/releases/download/trades/trades.csv';
const INJURIES_URL = 'https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_{season}.csv';
const COMBINE_URL = 'https://github.com/nflverse/nflverse-data/releases/download/combine/combine.csv';
const CONTRACTS_URL = 'https://github.com/nflverse/nflverse-data/releases/download/contracts/historical_contracts.csv.gz';

const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K']);

type Trend = 'up' | 'down' | 'flat' | 'unknown';

export type NflverseUsageRow = NonNullable<PlayerDetails['usageTrend']> & {
  gsisId: string;
  pfrId?: string | null;
  playerName: string;
  position: string;
};

export type NflverseTeamEnvironmentRow = NonNullable<PlayerDetails['teamEnvironment']>;
export type NflverseRosterRoomRow = NonNullable<PlayerDetails['rosterRoom']>;

export type NflverseInjuryRow = NonNullable<PlayerDetails['injuryHistory']> & {
  gsisId: string;
  playerName: string;
  position: string;
};

export type NflverseAthleticRow = NonNullable<PlayerDetails['athleticProfile']> & {
  pfrId?: string | null;
  playerName: string;
  position: string;
};

export type NflverseContractRow = NonNullable<PlayerDetails['contractProfile']> & {
  playerName: string;
  position: string;
};

type Snapshot<T> = {
  schemaVersion: 1;
  source: string;
  sourceUrl: string;
  generatedAt: string;
  snapshotKey: string;
  season?: string;
  rowCount: number;
  rows: T[];
};

type ContextOptions = {
  season: string;
  rosterRoomSeason?: string;
  rosterRoomPreviousSeason?: string;
  sourceMode?: 'live' | 'snapshot';
  persistSnapshot?: boolean;
  forceRefresh?: boolean;
};

export type NflversePlayerContext = {
  usageByGsisId: Record<string, NflverseUsageRow>;
  teamEnvironmentByTeam: Record<string, NflverseTeamEnvironmentRow>;
  rosterRoomByTeamPosition: Record<string, NflverseRosterRoomRow>;
  injuryByGsisId: Record<string, NflverseInjuryRow>;
  athleticByPfrId: Record<string, NflverseAthleticRow>;
  athleticByNamePosition: Record<string, NflverseAthleticRow[]>;
  contractByName: Record<string, NflverseContractRow>;
  rowCounts: Array<{ sourceKey: string; rowCount: number | null }>;
};

function sourceKey(prefix: string, season: string) {
  return `${prefix}:${season}`;
}

function textValue(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!raw || /^NA$/i.test(raw) || /^null$/i.test(raw)) return null;
  return raw;
}

function num(value: unknown): number | null {
  const raw = textValue(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return Math.round((clean.reduce((sum, value) => sum + value, 0) / clean.length) * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function trend(first: number, recent: number): Trend {
  if (!Number.isFinite(first) || !Number.isFinite(recent)) return 'unknown';
  const delta = recent - first;
  if (Math.abs(delta) < 1) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

function nameKey(name: unknown): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function teamKey(team: unknown): string {
  return String(team || '').trim().toUpperCase();
}

function normalizeFantasyPosition(value: unknown): string | null {
  const raw = String(value || '').trim().toUpperCase();
  if (FANTASY_POSITIONS.has(raw)) return raw;
  const token = raw.split(/[^A-Z]+/).find((item) => FANTASY_POSITIONS.has(item));
  return token || null;
}

function athleticNamePositionKey(name: unknown, position: unknown): string | null {
  const normalizedName = nameKey(name);
  const normalizedPosition = normalizeFantasyPosition(position);
  if (!normalizedName || !normalizedPosition) return null;
  return `${normalizedName}:${normalizedPosition}`;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function fetchMaybeGzipText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return url.endsWith('.gz') ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
}

function buildSnapshot<T>(input: { source: string; sourceUrl: string; season?: string; rows: T[] }): Snapshot<T> {
  const now = new Date();
  return {
    schemaVersion: 1,
    source: input.source,
    sourceUrl: input.sourceUrl,
    generatedAt: now.toISOString(),
    snapshotKey: getProviderSnapshotDateKey(now),
    season: input.season,
    rowCount: input.rows.length,
    rows: input.rows,
  };
}

async function persist<T>(key: string, snapshot: Snapshot<T>) {
  if (!snapshot.rows.length) return false;
  return upsertProviderDataSnapshot({
    sourceKey: key,
    snapshotKey: snapshot.snapshotKey,
    payload: JSON.stringify(snapshot),
  });
}

async function loadStored<T>(key: string): Promise<Snapshot<T>> {
  const stored = await findLatestProviderDataSnapshot(key);
  const parsed = parseProviderSnapshotPayload<Partial<Snapshot<T>>>(stored?.payload);
  if (parsed?.schemaVersion === 1 && Array.isArray(parsed.rows)) return parsed as Snapshot<T>;
  return {
    schemaVersion: 1,
    source: key,
    sourceUrl: '',
    generatedAt: '',
    snapshotKey: '',
    rowCount: 0,
    rows: [],
  };
}

async function loadStoredSeasonFallback<T>(prefix: string, season: string): Promise<Snapshot<T>> {
  const exact = await loadStored<T>(sourceKey(prefix, season));
  if (exact.rows.length) return exact;
  const numericSeason = Number(season);
  if (!Number.isFinite(numericSeason)) return exact;
  for (let offset = 1; offset <= 3; offset += 1) {
    const fallback = await loadStored<T>(sourceKey(prefix, String(numericSeason - offset)));
    if (fallback.rows.length) return fallback;
  }
  return exact;
}

function hasExpandedAthleticMetrics(snapshot: Snapshot<NflverseAthleticRow>): boolean {
  return snapshot.rows.some((row) => (
    row.vertical !== null && row.vertical !== undefined
  ) || (
    row.broadJump !== null && row.broadJump !== undefined
  ) || (
    row.bench !== null && row.bench !== undefined
  ) || (
    row.cone !== null && row.cone !== undefined
  ) || (
    row.shuttle !== null && row.shuttle !== undefined
  ));
}

async function fetchAthleticSnapshot(
  options: Omit<ContextOptions, 'season'>,
  persistByDefault = false
): Promise<Snapshot<NflverseAthleticRow>> {
  const url = process.env.NFLVERSE_COMBINE_URL || COMBINE_URL;
  const snapshot = buildSnapshot({
    source: 'nflverse combine',
    sourceUrl: url,
    rows: normalizeNflverseAthleticRows(parseCsv(await fetchText(url))),
  });
  if (options.persistSnapshot || persistByDefault) await persist(NFLVERSE_COMBINE_SOURCE_KEY, snapshot);
  return snapshot;
}

function latestAvailableUsageSeason(rows: Array<Record<string, unknown>>, requestedSeason: string): string {
  const requested = Number(requestedSeason);
  const seasons = new Set<number>();
  for (const row of rows) {
    if (String(row.season_type || '') !== 'REG') continue;
    const position = String(row.position || '').toUpperCase();
    if (!FANTASY_POSITIONS.has(position)) continue;
    const season = num(row.season);
    if (season === null) continue;
    if (Number.isFinite(requested) && season > requested) continue;
    seasons.add(season);
  }
  if (!seasons.size) return requestedSeason;
  return String(Math.max(...Array.from(seasons)));
}

function inferUsageSourceUrl(season: string): string {
  return (process.env.NFLVERSE_PLAYER_STATS_URL || PLAYER_STATS_URL).replace('{season}', season);
}

function inferTeamStatsSourceUrl(season: string): string {
  return (process.env.NFLVERSE_TEAM_STATS_URL || TEAM_STATS_URL).replace('{season}', season);
}

function inferPbpSourceUrl(season: string): string {
  return (process.env.NFLVERSE_PBP_URL || PBP_URL).replace('{season}', season);
}

function inferRostersSourceUrl(season: string): string {
  return (process.env.NFLVERSE_ROSTERS_URL || ROSTERS_URL).replace('{season}', season);
}

function inferWeeklyRostersSourceUrl(season: string): string {
  return (process.env.NFLVERSE_WEEKLY_ROSTERS_URL || WEEKLY_ROSTERS_URL).replace('{season}', season);
}

function inferDepthChartsSourceUrl(season: string): string {
  return (process.env.NFLVERSE_DEPTH_CHARTS_URL || DEPTH_CHARTS_URL).replace('{season}', season);
}

function inferTradesSourceUrl(): string {
  return process.env.NFLVERSE_TRADES_URL || TRADES_URL;
}

function rosterRoomKey(team: unknown, position: unknown): string {
  return `${teamKey(team)}:${String(position || '').trim().toUpperCase()}`;
}

function nextSeason(season: string): string {
  const numericSeason = Number(season);
  return Number.isFinite(numericSeason) ? String(numericSeason + 1) : season;
}

export function normalizeNflverseUsageRows(input: {
  statsRows: Array<Record<string, unknown>>;
  snapRows?: Array<Record<string, unknown>>;
  season: string;
}): NflverseUsageRow[] {
  const byGsis = new Map<string, {
    playerName: string;
    position: string;
    team: string | null;
    explicitGames: number | null;
    weeks: Set<number>;
    targets: number;
    carries: number;
    receptions: number;
    fantasyPointsPpr: number;
    airYardsShare: number | null;
    wopr: number | null;
    targetShares: number[];
    weeklyTargets: Array<{ week: number; targets: number }>;
    weeklyCarries: Array<{ week: number; carries: number }>;
    weeklyUsage: Array<{
      week: number;
      targets: number;
      carries: number;
      receptions: number;
      fantasyPointsPpr: number;
    }>;
  }>();

  for (const row of input.statsRows) {
    if (String(row.season || '') !== input.season || String(row.season_type || '') !== 'REG') continue;
    const position = String(row.position || '').toUpperCase();
    if (!FANTASY_POSITIONS.has(position)) continue;
    const gsisId = textValue(row.player_id);
    const playerName = textValue(row.player_display_name) || textValue(row.player_name);
    if (!gsisId || !playerName) continue;
    const week = num(row.week) || 0;
    const current = byGsis.get(gsisId) || {
      playerName,
      position,
      team: textValue(row.recent_team) || textValue(row.team),
      explicitGames: num(row.games),
      weeks: new Set<number>(),
      targets: 0,
      carries: 0,
      receptions: 0,
      fantasyPointsPpr: 0,
      airYardsShare: null,
      wopr: null,
      targetShares: [],
      weeklyTargets: [],
      weeklyCarries: [],
      weeklyUsage: [],
    };
    if (week > 0) current.weeks.add(week);
    const targets = num(row.targets) || 0;
    const carries = num(row.carries) || 0;
    const receptions = num(row.receptions) || 0;
    const fantasyPointsPpr = num(row.fantasy_points_ppr) || 0;
    current.targets += targets;
    current.carries += carries;
    current.receptions += receptions;
    current.fantasyPointsPpr += fantasyPointsPpr;
    current.airYardsShare = num(row.air_yards_share) ?? current.airYardsShare;
    current.wopr = num(row.wopr) ?? current.wopr;
    const targetShare = num(row.target_share);
    if (targetShare !== null) current.targetShares.push(targetShare);
    if (week > 0) {
      current.weeklyTargets.push({ week, targets });
      current.weeklyCarries.push({ week, carries });
      current.weeklyUsage.push({ week, targets, carries, receptions, fantasyPointsPpr });
    }
    byGsis.set(gsisId, current);
  }

  const snapByName = new Map<string, number[]>();
  const snapByNameWeek = new Map<string, number[]>();
  for (const row of input.snapRows || []) {
    if (String(row.season || '') !== input.season || String(row.game_type || '') !== 'REG') continue;
    const position = String(row.position || '').toUpperCase();
    if (!FANTASY_POSITIONS.has(position)) continue;
    const key = nameKey(row.player);
    const pct = num(row.offense_pct);
    if (!key || pct === null) continue;
    const values = snapByName.get(key) || [];
    values.push(pct);
    snapByName.set(key, values);
    const week = num(row.week);
    if (week !== null && week > 0) {
      const weekKey = `${key}:${Math.round(week)}`;
      const weekValues = snapByNameWeek.get(weekKey) || [];
      weekValues.push(pct);
      snapByNameWeek.set(weekKey, weekValues);
    }
  }

  return Array.from(byGsis.entries()).map(([gsisId, row]) => {
    const sortedTargets = row.weeklyTargets.sort((a, b) => a.week - b.week);
    const sortedCarries = row.weeklyCarries.sort((a, b) => a.week - b.week);
    const hasWeeklyWindows = sortedTargets.length >= 2 || sortedCarries.length >= 2;
    const split = Math.max(1, Math.floor(sortedTargets.length / 2));
    const firstTargetWindow = sortedTargets.length <= 4 ? sortedTargets.slice(0, split) : sortedTargets.slice(0, 4);
    const recentTargetWindow = sortedTargets.length <= 4 ? sortedTargets.slice(split) : sortedTargets.slice(-4);
    const firstCarryWindow = sortedCarries.length <= 4 ? sortedCarries.slice(0, split) : sortedCarries.slice(0, 4);
    const recentCarryWindow = sortedCarries.length <= 4 ? sortedCarries.slice(split) : sortedCarries.slice(-4);
    const firstTargets = firstTargetWindow.reduce((sum, item) => sum + item.targets, 0);
    const recentTargets = recentTargetWindow.reduce((sum, item) => sum + item.targets, 0);
    const firstCarries = firstCarryWindow.reduce((sum, item) => sum + item.carries, 0);
    const recentCarries = recentCarryWindow.reduce((sum, item) => sum + item.carries, 0);
    const games = row.weeks.size || row.explicitGames || 1;
    const avgOffenseSnapPct = average(snapByName.get(nameKey(row.playerName)) || []);
    const targetTrend = hasWeeklyWindows ? trend(firstTargets, recentTargets) : 'unknown';
    const carryTrend = hasWeeklyWindows ? trend(firstCarries, recentCarries) : 'unknown';
    const seasonTargetsPerGame = games ? row.targets / games : 0;
    const seasonCarriesPerGame = games ? row.carries / games : 0;
    const sortedUsage = row.weeklyUsage.sort((a, b) => a.week - b.week);
    const playerSnapKey = nameKey(row.playerName);
    const usageMomentum = sortedUsage.length
      ? buildUsageTrendMomentumSummary(sortedUsage.map((item): WeeklyUsageObservation => ({
        week: item.week,
        targets: item.targets,
        carries: item.carries,
        fantasyPointsPpr: item.fantasyPointsPpr,
        offenseSnapPct: average(snapByNameWeek.get(`${playerSnapKey}:${item.week}`) || []),
      })))
      : null;
    const rollingWindows = [3, 6, 12, 24].flatMap((windowGames) => {
      const windowRows = sortedUsage.slice(-windowGames);
      if (!windowRows.length) return [];
      const windowCount = windowRows.length;
      const targets = windowRows.reduce((sum, item) => sum + item.targets, 0);
      const carries = windowRows.reduce((sum, item) => sum + item.carries, 0);
      const receptions = windowRows.reduce((sum, item) => sum + item.receptions, 0);
      const points = windowRows.reduce((sum, item) => sum + item.fantasyPointsPpr, 0);
      const targetsPerGame = Math.round((targets / windowCount) * 10) / 10;
      const carriesPerGame = Math.round((carries / windowCount) * 10) / 10;
      const targetDeltaPerGame = Math.round((targetsPerGame - seasonTargetsPerGame) * 10) / 10;
      const carryDeltaPerGame = Math.round((carriesPerGame - seasonCarriesPerGame) * 10) / 10;
      return [{
        games: windowGames,
        weeks: windowRows.map((item) => item.week),
        targetsPerGame,
        carriesPerGame,
        receptionsPerGame: Math.round((receptions / windowCount) * 10) / 10,
        fantasyPointsPprPerGame: Math.round((points / windowCount) * 10) / 10,
        targetDeltaPerGame,
        carryDeltaPerGame,
        note: `Last ${windowCount} tracked game${windowCount === 1 ? '' : 's'}: ${targetsPerGame} targets/g (${targetDeltaPerGame >= 0 ? '+' : ''}${targetDeltaPerGame} vs season), ${carriesPerGame} carries/g (${carryDeltaPerGame >= 0 ? '+' : ''}${carryDeltaPerGame} vs season).`,
      }];
    });
    return {
      gsisId,
      playerName: row.playerName,
      position: row.position,
      team: row.team,
      season: input.season,
      games,
      targets: row.targets,
      carries: row.carries,
      receptions: row.receptions,
      fantasyPointsPpr: Math.round(row.fantasyPointsPpr * 10) / 10,
      fantasyPointsPprPerGame: games ? Math.round((row.fantasyPointsPpr / games) * 10) / 10 : null,
      avgTargetShare: average(row.targetShares),
      airYardsShare: row.airYardsShare,
      wopr: row.wopr,
      avgOffenseSnapPct,
      recentTargets: hasWeeklyWindows ? recentTargets : row.targets,
      recentCarries: hasWeeklyWindows ? recentCarries : row.carries,
      rollingWindows,
      momentum: usageMomentum,
      targetTrend,
      carryTrend,
      note: hasWeeklyWindows
        ? `Usage trend from ${games} ${input.season} regular-season game${games === 1 ? '' : 's'}; recent four-game targets ${targetTrend} and carries ${carryTrend}.`
        : `Season usage from ${games} ${input.season} regular-season game${games === 1 ? '' : 's'}; weekly trend windows are unavailable in the aggregate stats_player snapshot.`,
    };
  });
}

export function normalizeNflverseTeamEnvironmentRows(
  rows: Array<Record<string, unknown>>,
  season: string,
  pbpRows: Array<Record<string, unknown>> = []
): NflverseTeamEnvironmentRow[] {
  const pbpByTeam = summarizePbpEnvironment(pbpRows, season);
  const baseRows = rows.flatMap((row) => {
    if (String(row.season || '') !== season || String(row.season_type || '') !== 'REG') return [];
    const team = teamKey(row.team);
    if (!team) return [];
    const games = num(row.games) || 0;
    const passAttempts = num(row.attempts) || 0;
    const carries = num(row.carries) || 0;
    const sacks = num(row.sacks_suffered) || 0;
    const dropbacks = passAttempts + sacks;
    const designedPlayVolume = dropbacks + carries;
    const passRate = designedPlayVolume ? Math.round((dropbacks / designedPlayVolume) * 1000) / 1000 : null;
    const rushRate = designedPlayVolume ? Math.round((carries / designedPlayVolume) * 1000) / 1000 : null;
    return [{
      source: 'nflverse team stats' as const,
      season,
      team,
      games,
      passAttempts,
      carries,
      targets: num(row.targets),
      dropbacks,
      designedPlayVolume,
      passRate,
      rushRate,
      playsPerGame: games ? Math.round((designedPlayVolume / games) * 10) / 10 : null,
      targetsPerGame: games ? Math.round(((num(row.targets) || 0) / games) * 10) / 10 : null,
      passingEpa: num(row.passing_epa),
      rushingEpa: num(row.rushing_epa),
      passRateRank: null,
      rushRateRank: null,
      neutralScriptPlays: null,
      neutralScriptPassRate: null,
      redZonePlays: null,
      redZonePassRate: null,
      redZoneRushRate: null,
      nonGarbagePlays: null,
      nonGarbagePassRate: null,
      estimatedSecondsPerPlay: null,
      paceRank: null,
      noHuddleRate: null,
      tendency: 'balanced' as const,
      note: '',
    }];
  });

  const passRanked = [...baseRows]
    .filter((row) => row.passRate !== null)
    .sort((a, b) => (b.passRate || 0) - (a.passRate || 0));
  const rushRanked = [...baseRows]
    .filter((row) => row.rushRate !== null)
    .sort((a, b) => (b.rushRate || 0) - (a.rushRate || 0));
  const passRanks = new Map(passRanked.map((row, index) => [row.team, index + 1]));
  const rushRanks = new Map(rushRanked.map((row, index) => [row.team, index + 1]));
  const paceRanked = [...baseRows]
    .map((row) => ({ team: row.team, seconds: pbpByTeam.get(row.team)?.estimatedSecondsPerPlay ?? null }))
    .filter((row): row is { team: string; seconds: number } => row.seconds !== null)
    .sort((a, b) => a.seconds - b.seconds);
  const paceRanks = new Map(paceRanked.map((row, index) => [row.team, index + 1]));

  return baseRows.map((row) => {
    const pbp = pbpByTeam.get(row.team);
    const passRateRank = passRanks.get(row.team) || null;
    const rushRateRank = rushRanks.get(row.team) || null;
    const paceRank = paceRanks.get(row.team) || null;
    const tendency =
      (pbp?.nonGarbagePassRate ?? row.passRate) !== null && (pbp?.nonGarbagePassRate ?? row.passRate)! >= 0.6
        ? 'pass-heavy'
        : (pbp?.nonGarbagePassRate ?? row.passRate) !== null && (pbp?.nonGarbagePassRate ?? row.passRate)! <= 0.52
        ? 'run-heavy'
        : 'balanced';
    const passPct = row.passRate !== null ? `${Math.round(row.passRate * 100)}%` : 'unknown';
    const rushPct = row.rushRate !== null ? `${Math.round(row.rushRate * 100)}%` : 'unknown';
    const neutralPct = pbp?.neutralScriptPassRate !== null && pbp?.neutralScriptPassRate !== undefined
      ? `${Math.round(pbp.neutralScriptPassRate * 100)}% neutral-script`
      : 'neutral-script unavailable';
    const redZonePct = pbp?.redZonePassRate !== null && pbp?.redZonePassRate !== undefined
      ? `${Math.round(pbp.redZonePassRate * 100)}% red-zone pass`
      : 'red-zone split unavailable';
    return {
      ...row,
      ...pbp,
      passRateRank,
      rushRateRank,
      paceRank,
      tendency,
      note: `${row.team} played as a ${tendency} offense in ${season}: ${passPct} pass/dropback rate, ${rushPct} rush rate, ${neutralPct}, ${redZonePct}, pass-rate rank ${passRateRank || 'n/a'}${paceRank ? `, estimated pace rank ${paceRank}` : ''}.`,
    };
  });
}

function isDesignedOffensivePlay(row: Record<string, unknown>): boolean {
  if (String(row.play_deleted || '') === '1') return false;
  if (String(row.qb_kneel || '') === '1' || String(row.qb_spike || '') === '1') return false;
  const playType = String(row.play_type || '').toLowerCase();
  return playType === 'pass' || playType === 'run' || num(row.pass_attempt) === 1 || num(row.rush_attempt) === 1 || num(row.qb_dropback) === 1;
}

function isPassPlay(row: Record<string, unknown>): boolean {
  return num(row.qb_dropback) === 1 || num(row.pass_attempt) === 1 || String(row.play_type || '').toLowerCase() === 'pass';
}

function isRushPlay(row: Record<string, unknown>): boolean {
  return num(row.rush_attempt) === 1 || String(row.play_type || '').toLowerCase() === 'run';
}

function isGarbageTime(row: Record<string, unknown>): boolean {
  const qtr = num(row.qtr) || 0;
  const diff = Math.abs(num(row.score_differential) || 0);
  return (qtr >= 4 && diff >= 17) || (qtr >= 3 && diff >= 24);
}

function summarizePbpEnvironment(rows: Array<Record<string, unknown>>, season: string) {
  const byTeam = new Map<string, {
    team: string;
    neutralPlays: number;
    neutralPasses: number;
    redZonePlays: number;
    redZonePasses: number;
    redZoneRushes: number;
    nonGarbagePlays: number;
    nonGarbagePasses: number;
    noHuddlePlays: number;
    designedPlays: number;
    gameSecondsByGame: Map<string, number[]>;
  }>();

  for (const row of rows) {
    if (String(row.season || '') !== season || String(row.season_type || '') !== 'REG') continue;
    if (!isDesignedOffensivePlay(row)) continue;
    const team = teamKey(row.posteam);
    if (!team) continue;
    const current = byTeam.get(team) || {
      team,
      neutralPlays: 0,
      neutralPasses: 0,
      redZonePlays: 0,
      redZonePasses: 0,
      redZoneRushes: 0,
      nonGarbagePlays: 0,
      nonGarbagePasses: 0,
      noHuddlePlays: 0,
      designedPlays: 0,
      gameSecondsByGame: new Map<string, number[]>(),
    };
    const pass = isPassPlay(row);
    const rush = isRushPlay(row);
    const scoreDiff = Math.abs(num(row.score_differential) || 0);
    const yardline = num(row.yardline_100);
    const garbage = isGarbageTime(row);

    current.designedPlays += 1;
    if (num(row.no_huddle) === 1) current.noHuddlePlays += 1;
    if (scoreDiff <= 8) {
      current.neutralPlays += 1;
      if (pass) current.neutralPasses += 1;
    }
    if (yardline !== null && yardline <= 20) {
      current.redZonePlays += 1;
      if (pass) current.redZonePasses += 1;
      if (rush) current.redZoneRushes += 1;
    }
    if (!garbage) {
      current.nonGarbagePlays += 1;
      if (pass) current.nonGarbagePasses += 1;
    }

    const gameId = textValue(row.game_id);
    const gameSecondsRemaining = num(row.game_seconds_remaining);
    if (gameId && gameSecondsRemaining !== null) {
      const values = current.gameSecondsByGame.get(gameId) || [];
      values.push(gameSecondsRemaining);
      current.gameSecondsByGame.set(gameId, values);
    }
    byTeam.set(team, current);
  }

  return new Map(Array.from(byTeam.entries()).map(([team, row]) => {
    const paceSamples: number[] = [];
    for (const values of Array.from(row.gameSecondsByGame.values())) {
      const sorted = Array.from(new Set(values)).sort((a, b) => b - a);
      for (let index = 1; index < sorted.length; index += 1) {
        const delta = sorted[index - 1] - sorted[index];
        if (delta >= 0 && delta <= 60) paceSamples.push(delta);
      }
    }
    return [team, {
      neutralScriptPlays: row.neutralPlays || null,
      neutralScriptPassRate: row.neutralPlays ? Math.round((row.neutralPasses / row.neutralPlays) * 1000) / 1000 : null,
      redZonePlays: row.redZonePlays || null,
      redZonePassRate: row.redZonePlays ? Math.round((row.redZonePasses / row.redZonePlays) * 1000) / 1000 : null,
      redZoneRushRate: row.redZonePlays ? Math.round((row.redZoneRushes / row.redZonePlays) * 1000) / 1000 : null,
      nonGarbagePlays: row.nonGarbagePlays || null,
      nonGarbagePassRate: row.nonGarbagePlays ? Math.round((row.nonGarbagePasses / row.nonGarbagePlays) * 1000) / 1000 : null,
      estimatedSecondsPerPlay: average(paceSamples),
      noHuddleRate: row.designedPlays ? Math.round((row.noHuddlePlays / row.designedPlays) * 1000) / 1000 : null,
    }];
  }));
}

type RoomPlayer = {
  name: string;
  team: string;
  position: string;
  gsisId: string | null;
  sleeperId: string | null;
  pfrId: string | null;
  yearsExp: number | null;
  rookieYear: number | null;
  draftRound: number | null;
  draftOverall: number | null;
  status: string | null;
};

type WeeklyRosterSignal = {
  firstWeek: number | null;
  lastWeek: number | null;
  activeWeeks: number;
  inactiveWeeks: number;
  practiceSquadWeeks: number;
  injuredReserveWeeks: number;
  firstStatus: string | null;
  lastStatus: string | null;
};

type TradeSignal = {
  date: string | null;
  fromTeam: string | null;
  toTeam: string | null;
};

type RosterMovementType = NonNullable<NflverseRosterRoomRow['additions'][number]['movementType']>;
type RosterMovementConfidence = NonNullable<NflverseRosterRoomRow['additions'][number]['movementConfidence']>;
type RosterMovementQualityTier = NonNullable<NflverseRosterRoomRow['additions'][number]['movementQualityTier']>;
type RosterPromotionSignal = NonNullable<NonNullable<NflverseRosterRoomRow['opportunityDelta']>['returningPromotionCandidates']>[number]['signal'];

function normalizeRosterPlayer(row: Record<string, unknown>): RoomPlayer | null {
  const team = teamKey(row.team);
  const position = String(row.position || '').trim().toUpperCase();
  const name = textValue(row.full_name) || textValue(row.player_name);
  if (!team || !FANTASY_POSITIONS.has(position) || !name) return null;
  return {
    name,
    team,
    position,
    gsisId: textValue(row.gsis_id),
    sleeperId: textValue(row.sleeper_id),
    pfrId: textValue(row.pfr_id),
    yearsExp: num(row.years_exp),
    rookieYear: num(row.rookie_year),
    draftRound: num(row.draft_round),
    draftOverall: num(row.draft_number) ?? num(row.draft_overall) ?? num(row.draft_pick),
    status: textValue(row.status) || textValue(row.status_description_abbr),
  };
}

function rosterIdentity(row: RoomPlayer): string {
  return row.gsisId || row.sleeperId || row.pfrId || nameKey(row.name);
}

function isActiveRoomPlayer(row: RoomPlayer): boolean {
  return !row.status || /active|act|res|inj|non|pup|sus|ina|udf/i.test(row.status);
}

function summarizeRoomPlayer(row: RoomPlayer) {
  return {
    name: row.name,
    gsisId: row.gsisId,
    sleeperId: row.sleeperId,
    draftRound: row.draftRound,
    draftOverall: row.draftOverall,
    yearsExp: row.yearsExp,
  };
}

function weeklySignalKey(row: RoomPlayer): string {
  return `${rosterIdentity(row)}:${row.team}`;
}

function summarizeWeeklyRosterSignals(rows: Array<Record<string, unknown>>, season: string): Map<string, WeeklyRosterSignal> {
  const byPlayerTeam = new Map<string, {
    weeks: number[];
    activeWeeks: number;
    inactiveWeeks: number;
    practiceSquadWeeks: number;
    injuredReserveWeeks: number;
    statusesByWeek: Map<number, string | null>;
  }>();
  for (const row of rows) {
    if (String(row.season || '') !== season) continue;
    const player = normalizeRosterPlayer(row);
    const week = num(row.week);
    if (!player || week === null) continue;
    const key = weeklySignalKey(player);
    const status = textValue(row.status) || textValue(row.status_description_abbr) || player.status;
    const current = byPlayerTeam.get(key) || {
      weeks: [],
      activeWeeks: 0,
      inactiveWeeks: 0,
      practiceSquadWeeks: 0,
      injuredReserveWeeks: 0,
      statusesByWeek: new Map<number, string | null>(),
    };
    current.weeks.push(week);
    current.statusesByWeek.set(week, status);
    if (status && /ACT|active/i.test(status)) current.activeWeeks += 1;
    if (status && /INA|inactive/i.test(status)) current.inactiveWeeks += 1;
    if (status && /DEV|practice|squad|P0[123]/i.test(status)) current.practiceSquadWeeks += 1;
    if (status && /RES|injured|IR|PUP|NFI/i.test(status)) current.injuredReserveWeeks += 1;
    byPlayerTeam.set(key, current);
  }
  return new Map(Array.from(byPlayerTeam.entries()).map(([key, row]) => {
    const weeks = Array.from(new Set(row.weeks)).sort((a, b) => a - b);
    const firstWeek = weeks[0] ?? null;
    const lastWeek = weeks[weeks.length - 1] ?? null;
    return [key, {
      firstWeek,
      lastWeek,
      activeWeeks: row.activeWeeks,
      inactiveWeeks: row.inactiveWeeks,
      practiceSquadWeeks: row.practiceSquadWeeks,
      injuredReserveWeeks: row.injuredReserveWeeks,
      firstStatus: firstWeek !== null ? row.statusesByWeek.get(firstWeek) || null : null,
      lastStatus: lastWeek !== null ? row.statusesByWeek.get(lastWeek) || null : null,
    }];
  }));
}

function summarizeTradeSignals(rows: Array<Record<string, unknown>>, season: string): Map<string, TradeSignal[]> {
  const byPlayer = new Map<string, TradeSignal[]>();
  for (const row of rows) {
    if (String(row.season || '') !== season) continue;
    const pfrId = textValue(row.pfr_id);
    const name = textValue(row.pfr_name);
    if (!pfrId && !name) continue;
    const keys = [pfrId, name ? nameKey(name) : null].filter(Boolean) as string[];
    for (const key of keys) {
      byPlayer.set(key, [
        ...(byPlayer.get(key) || []),
        {
          date: textValue(row.trade_date),
          fromTeam: teamKey(row.gave),
          toTeam: teamKey(row.received),
        },
      ]);
    }
  }
  return byPlayer;
}

function priorUsageKey(player: RoomPlayer): string[] {
  return [player.gsisId, player.pfrId, nameKey(player.name)].filter(Boolean) as string[];
}

function buildPriorUsageIndex(rows: NflverseUsageRow[]): Map<string, NflverseUsageRow> {
  const index = new Map<string, NflverseUsageRow>();
  for (const row of rows) {
    if (row.gsisId) index.set(row.gsisId, row);
    if (row.pfrId) index.set(row.pfrId, row);
    index.set(nameKey(row.playerName), row);
  }
  return index;
}

function buildProspectIndex(profiles: ProspectProfile[] = []): Map<string, ProspectProfile> {
  return buildProspectLookup(profiles);
}

function findRoomProspect(player: RoomPlayer, prospectIndex: Map<string, ProspectProfile>): ProspectProfile | null {
  return findProspectProfile(prospectIndex, player.name, player.position, null, player.rookieYear);
}

function findPriorUsage(player: RoomPlayer, usageIndex: Map<string, NflverseUsageRow>): NflverseUsageRow | null {
  for (const key of priorUsageKey(player)) {
    const usage = usageIndex.get(key);
    if (usage) return usage;
  }
  return null;
}

function prospectImpactScore(position: string, prospect: ProspectProfile | null): number | null {
  if (!prospect) return null;
  const ratingScore = prospect.rating ? clamp((prospect.rating - 70) * 3.2, 0, 70) : 0;
  const overallRankScore = prospect.averageOverallRank
    ? clamp((90 - prospect.averageOverallRank) * 0.75, 0, 35)
    : prospect.overallRank
    ? clamp((80 - prospect.overallRank) * 0.5, 0, 25)
    : 0;
  const positionRankScore = prospect.positionRank
    ? clamp((8 - prospect.positionRank) * 4, 0, 25)
    : prospect.averagePositionRank
    ? clamp((8 - prospect.averagePositionRank) * 4, 0, 25)
    : 0;
  const positionalPremium = position === 'RB' || position === 'WR' ? 8 : position === 'TE' ? 4 : 0;
  return Math.round(clamp(ratingScore + overallRankScore + positionRankScore + positionalPremium, 0, 88));
}

function opportunityVolume(position: string, usage: NflverseUsageRow | null): number {
  if (!usage) return 0;
  if (position === 'RB') return usage.carries + usage.targets * 1.35;
  if (position === 'WR' || position === 'TE') return usage.targets;
  if (position === 'QB') return (usage.fantasyPointsPprPerGame || 0) * 12 + usage.carries * 0.25;
  return usage.fantasyPointsPprPerGame || 0;
}

function movementImpactScore(position: string, usage: NflverseUsageRow | null, prospect?: ProspectProfile | null): number | null {
  if (!usage) return prospectImpactScore(position, prospect || null);
  const volume = opportunityVolume(position, usage);
  const benchmark = position === 'RB'
    ? 260
    : position === 'WR'
    ? 140
    : position === 'TE'
    ? 100
    : position === 'QB'
    ? 260
    : 12;
  const productionBoost = clamp(((usage.fantasyPointsPprPerGame || 0) / (PPG_BASELINES_FOR_MOVEMENT[position] || 16)) * 30, 0, 30);
  return Math.round(clamp((volume / benchmark) * 70 + productionBoost, 0, 100));
}

const PPG_BASELINES_FOR_MOVEMENT: Record<string, number> = {
  QB: 22,
  RB: 18,
  WR: 18,
  TE: 13,
  K: 10,
};

function movementQualityTier(position: string, usage: NflverseUsageRow | null, prospect?: ProspectProfile | null): RosterMovementQualityTier {
  const score = movementImpactScore(position, usage, prospect || null);
  if (score === null) return 'unknown';
  if (score >= 74) return 'star';
  if (score >= 50) return 'starter';
  if (score >= 24) return 'rotation';
  return 'depth';
}

function usageFields(position: string, usage: NflverseUsageRow | null, prospect?: ProspectProfile | null) {
  const score = movementImpactScore(position, usage, prospect || null);
  return {
    priorSeasonTeam: usage?.team ?? null,
    priorSeasonGames: usage?.games ?? null,
    priorSeasonTargets: usage?.targets ?? null,
    priorSeasonCarries: usage?.carries ?? null,
    priorSeasonReceptions: usage?.receptions ?? null,
    priorSeasonFantasyPointsPpr: usage?.fantasyPointsPpr ?? null,
    priorSeasonFantasyPointsPprPerGame: usage?.fantasyPointsPprPerGame ?? null,
    priorSeasonAvgTargetShare: usage?.avgTargetShare ?? null,
    priorSeasonAirYardsShare: usage?.airYardsShare ?? null,
    priorSeasonWopr: usage?.wopr ?? null,
    movementQualityTier: movementQualityTier(position, usage, prospect || null),
    movementImpactScore: score,
    prospectRating: prospect?.rating ?? null,
    prospectOverallRank: prospect?.averageOverallRank ?? prospect?.overallRank ?? null,
    prospectPositionRank: prospect?.averagePositionRank ?? prospect?.positionRank ?? null,
    prospectDraftYear: prospect?.draftYear ?? null,
  };
}

function findTradeSignal(player: RoomPlayer, trades: Map<string, TradeSignal[]>, direction: 'addition' | 'loss'): TradeSignal | null {
  const candidates = [
    player.pfrId ? trades.get(player.pfrId) : null,
    trades.get(nameKey(player.name)),
  ].flatMap((items) => items || []);
  return candidates.find((trade) => direction === 'addition' ? trade.toTeam === player.team : trade.fromTeam === player.team) || null;
}

function movementSummary(input: {
  player: RoomPlayer;
  direction: 'addition' | 'loss';
  season: string;
  priorUsage?: NflverseUsageRow | null;
  prospect?: ProspectProfile | null;
  weeklySignal?: WeeklyRosterSignal | null;
  tradeSignal?: TradeSignal | null;
}) {
  const { player, direction, season, weeklySignal, tradeSignal, priorUsage, prospect } = input;
  const isRookie = player.rookieYear === Number(season) || prospect?.draftYear === Number(season) || (player.yearsExp ?? 99) <= 0;
  const isPremium = (player.draftRound || 99) <= 3 || (player.draftOverall || 999) <= 100;
  const firstWeek = weeklySignal?.firstWeek ?? null;
  const lastWeek = weeklySignal?.lastWeek ?? null;
  const hadPracticeSquadSignal = (weeklySignal?.practiceSquadWeeks || 0) > 0;
  const hadInjurySignal = (weeklySignal?.injuredReserveWeeks || 0) > 0;
  const movementType: RosterMovementType = tradeSignal
    ? 'trade'
    : isRookie
    ? 'draft-pick'
    : hadInjurySignal && direction === 'addition'
    ? 'injury-return'
    : hadPracticeSquadSignal
    ? 'practice-squad-or-depth-churn'
    : direction === 'addition'
    ? 'free-agent-or-claim'
    : 'roster-loss';
  const confidence: RosterMovementConfidence = tradeSignal || isRookie || weeklySignal ? 'medium' : 'low';
  const timing = direction === 'addition'
    ? firstWeek !== null ? `first appeared in week ${firstWeek}` : 'weekly timing unavailable'
    : lastWeek !== null ? `last appeared in week ${lastWeek}` : 'weekly timing unavailable';
  const tradeText = tradeSignal
    ? `trade signal ${tradeSignal.fromTeam || 'unknown'} to ${tradeSignal.toTeam || player.team}${tradeSignal.date ? ` on ${tradeSignal.date}` : ''}`
    : null;
  const typeText = movementType === 'draft-pick' && isPremium ? 'premium draft-pick' : movementType;
  return {
    ...summarizeRoomPlayer(player),
    ...usageFields(player.position, priorUsage || null, prospect || null),
    movementType,
    movementConfidence: confidence,
    firstSeenWeek: firstWeek,
    lastSeenWeek: lastWeek,
    firstStatus: weeklySignal?.firstStatus ?? null,
    lastStatus: weeklySignal?.lastStatus ?? null,
    activeWeeks: weeklySignal?.activeWeeks ?? null,
    practiceSquadWeeks: weeklySignal?.practiceSquadWeeks ?? null,
    injuredReserveWeeks: weeklySignal?.injuredReserveWeeks ?? null,
    tradeDate: tradeSignal?.date ?? null,
    tradeFromTeam: tradeSignal?.fromTeam ?? null,
    tradeToTeam: tradeSignal?.toTeam ?? null,
    movementNote: tradeText || `${typeText}; ${timing}.`,
  };
}

export function normalizeNflverseRosterRoomRows(input: {
  currentRosterRows: Array<Record<string, unknown>>;
  previousRosterRows?: Array<Record<string, unknown>>;
  previousSeasonUsageRows?: NflverseUsageRow[];
  prospectProfiles?: ProspectProfile[];
  currentWeeklyRosterRows?: Array<Record<string, unknown>>;
  previousWeeklyRosterRows?: Array<Record<string, unknown>>;
  depthChartRows?: Array<Record<string, unknown>>;
  tradeRows?: Array<Record<string, unknown>>;
  season: string;
  previousSeason: string;
}): NflverseRosterRoomRow[] {
  const currentByRoom = new Map<string, RoomPlayer[]>();
  const previousByRoom = new Map<string, RoomPlayer[]>();
  const currentWeeklySignals = summarizeWeeklyRosterSignals(input.currentWeeklyRosterRows || [], input.season);
  const previousWeeklySignals = summarizeWeeklyRosterSignals(input.previousWeeklyRosterRows || [], input.previousSeason);
  const tradeSignals = summarizeTradeSignals(input.tradeRows || [], input.season);
  const previousTradeSignals = summarizeTradeSignals(input.tradeRows || [], input.previousSeason);
  const priorUsageIndex = buildPriorUsageIndex(input.previousSeasonUsageRows || []);
  const prospectIndex = buildProspectIndex(input.prospectProfiles || []);
  for (const row of input.currentRosterRows) {
    if (String(row.season || '') !== input.season) continue;
    const player = normalizeRosterPlayer(row);
    if (!player || !isActiveRoomPlayer(player)) continue;
    const key = rosterRoomKey(player.team, player.position);
    currentByRoom.set(key, [...(currentByRoom.get(key) || []), player]);
  }
  for (const row of input.previousRosterRows || []) {
    if (String(row.season || '') !== input.previousSeason) continue;
    const player = normalizeRosterPlayer(row);
    if (!player || !isActiveRoomPlayer(player)) continue;
    const key = rosterRoomKey(player.team, player.position);
    previousByRoom.set(key, [...(previousByRoom.get(key) || []), player]);
  }

  const depthByRoom = new Map<string, Array<{ name: string; gsisId: string | null; rank: number | null; slot: string | null }>>();
  for (const row of input.depthChartRows || []) {
    const team = teamKey(row.team);
    const position = String(row.pos_abb || row.pos_name || '').trim().toUpperCase();
    const name = textValue(row.player_name);
    if (!team || !FANTASY_POSITIONS.has(position) || !name) continue;
    const key = rosterRoomKey(team, position);
    depthByRoom.set(key, [
      ...(depthByRoom.get(key) || []),
      {
        name,
        gsisId: textValue(row.gsis_id),
        rank: num(row.pos_rank),
        slot: textValue(row.pos_slot),
      },
    ]);
  }

  const keys = new Set([...Array.from(currentByRoom.keys()), ...Array.from(previousByRoom.keys())]);
  return Array.from(keys).flatMap((key) => {
    const [team, position] = key.split(':');
    if (!team || !position) return [];
    const current = currentByRoom.get(key) || [];
    const previous = previousByRoom.get(key) || [];
    const previousIds = new Set(previous.map(rosterIdentity));
    const currentIds = new Set(current.map(rosterIdentity));
    const additions = current.filter((player) => !previousIds.has(rosterIdentity(player)));
    const losses = previous.filter((player) => !currentIds.has(rosterIdentity(player)));
    const summarizedAdditions = additions.slice(0, 8).map((player) => movementSummary({
      player,
      direction: 'addition',
      season: input.season,
      priorUsage: findPriorUsage(player, priorUsageIndex),
      prospect: findRoomProspect(player, prospectIndex),
      weeklySignal: currentWeeklySignals.get(weeklySignalKey(player)) || null,
      tradeSignal: findTradeSignal(player, tradeSignals, 'addition'),
    }));
    const summarizedLosses = losses.slice(0, 8).map((player) => movementSummary({
      player,
      direction: 'loss',
      season: input.previousSeason,
      priorUsage: findPriorUsage(player, priorUsageIndex),
      prospect: findRoomProspect(player, prospectIndex),
      weeklySignal: previousWeeklySignals.get(weeklySignalKey(player)) || null,
      tradeSignal: findTradeSignal(player, previousTradeSignals, 'loss'),
    }));
    const rookieAdditions = additions.filter((player) => player.rookieYear === Number(input.season) || (player.yearsExp ?? 99) <= 0);
    const premiumAdditions = additions.filter((player) => (player.draftRound || 99) <= 3 || (player.draftOverall || 999) <= 100);
    const uniqueDepth = new Map<string, { name: string; gsisId: string | null; rank: number | null; slot: string | null }>();
    for (const player of (depthByRoom.get(key) || []).sort((a, b) => (a.rank || 99) - (b.rank || 99))) {
      const depthKey = player.gsisId || nameKey(player.name);
      const existing = uniqueDepth.get(depthKey);
      if (!existing || (player.rank || 99) < (existing.rank || 99)) uniqueDepth.set(depthKey, player);
    }
    const depthPlayers = Array.from(uniqueDepth.values()).slice(0, 5);
    const netChange = current.length - previous.length;
    const competitionLevel = current.length >= 6 || premiumAdditions.length >= 2
      ? 'crowded'
      : current.length <= 1 || losses.length >= 2
      ? 'thin'
      : 'normal';
    const vacatedOpportunitySignal = losses.length >= 2 || netChange <= -2
      ? 'opening'
      : additions.length >= 2 || netChange >= 2
      ? 'squeeze'
      : 'stable';
    const additionNames = additions.slice(0, 3).map((player) => player.name).join(', ');
    const lossNames = losses.slice(0, 3).map((player) => player.name).join(', ');
    const movementTypes = Array.from(new Set([
      ...summarizedAdditions.map((player) => player.movementType),
      ...summarizedLosses.map((player) => player.movementType),
    ]));
    const weeklyCoverage = {
      currentSeasonPlayers: summarizedAdditions.filter((player) => player.firstSeenWeek !== null || player.lastSeenWeek !== null).length,
      previousSeasonPlayers: summarizedLosses.filter((player) => player.firstSeenWeek !== null || player.lastSeenWeek !== null).length,
    };
    const vacatedTargets = summarizedLosses.reduce((sum, player) => sum + (player.priorSeasonTargets || 0), 0);
    const vacatedCarries = summarizedLosses.reduce((sum, player) => sum + (player.priorSeasonCarries || 0), 0);
    const vacatedReceptions = summarizedLosses.reduce((sum, player) => sum + (player.priorSeasonReceptions || 0), 0);
    const vacatedFantasyPointsPpr = Math.round(summarizedLosses.reduce((sum, player) => sum + (player.priorSeasonFantasyPointsPpr || 0), 0) * 10) / 10;
    const addedPriorTargets = summarizedAdditions.reduce((sum, player) => sum + (player.priorSeasonTargets || 0), 0);
    const addedPriorCarries = summarizedAdditions.reduce((sum, player) => sum + (player.priorSeasonCarries || 0), 0);
    const addedPriorReceptions = summarizedAdditions.reduce((sum, player) => sum + (player.priorSeasonReceptions || 0), 0);
    const addedPriorFantasyPointsPpr = Math.round(summarizedAdditions.reduce((sum, player) => sum + (player.priorSeasonFantasyPointsPpr || 0), 0) * 10) / 10;
    const vacatedImpactScore = Math.round(clamp(summarizedLosses.reduce((sum, player) => sum + (player.movementImpactScore || 0), 0), 0, 100));
    const addedThreatScore = Math.round(clamp(summarizedAdditions.reduce((sum, player) => sum + (player.movementImpactScore || 0), 0), 0, 100));
    const netOpportunityScore = Math.round(clamp(vacatedImpactScore - addedThreatScore, -100, 100));
    const topVacatedPlayer = [...summarizedLosses].sort((a, b) => (b.movementImpactScore || 0) - (a.movementImpactScore || 0))[0]?.name || null;
    const topAddedThreat = [...summarizedAdditions].sort((a, b) => (b.movementImpactScore || 0) - (a.movementImpactScore || 0))[0]?.name || null;
    const additionKeys = new Set(additions.map(rosterIdentity));
    const returningPromotionCandidates = depthPlayers
      .flatMap((player) => {
        const currentPlayer = current.find((candidate) => (player.gsisId && candidate.gsisId === player.gsisId) || nameKey(candidate.name) === nameKey(player.name));
        if (!currentPlayer || additionKeys.has(rosterIdentity(currentPlayer))) return [];
        const rank = player.rank || 99;
        const rankPenalty = rank <= 1 ? 0.6 : rank === 2 ? 0.8 : 1.1;
        const score = Math.round(clamp(vacatedImpactScore - addedThreatScore * rankPenalty, 0, 100));
        const signal: RosterPromotionSignal = score >= 55
          ? 'major-promotion'
          : score >= 25
          ? 'minor-promotion'
          : addedThreatScore >= 50 && vacatedImpactScore < addedThreatScore
          ? 'blocked'
          : 'stable';
        return [{ name: player.name, rank: player.rank, score, signal }];
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    const topReturningDepthPlayer = returningPromotionCandidates[0]?.name || null;
    const incumbentPromotionScore = returningPromotionCandidates[0]?.score ?? null;
    const incumbentOpportunitySignal = returningPromotionCandidates[0]?.signal || (
      incumbentPromotionScore === null
      ? 'stable'
      : incumbentPromotionScore >= 55
      ? 'major-promotion'
      : incumbentPromotionScore >= 25
      ? 'minor-promotion'
      : addedThreatScore >= 50 && vacatedImpactScore < addedThreatScore
      ? 'blocked'
      : 'stable'
    );
    const qualitySignal = netOpportunityScore >= 50
      ? 'major-opening'
      : netOpportunityScore >= 20
      ? 'minor-opening'
      : netOpportunityScore <= -50
      ? 'major-squeeze'
      : netOpportunityScore <= -20
      ? 'squeeze'
      : 'stable';
    const opportunityDelta = {
      vacatedTargets,
      vacatedCarries,
      vacatedReceptions,
      vacatedFantasyPointsPpr,
      addedPriorTargets,
      addedPriorCarries,
      addedPriorReceptions,
      addedPriorFantasyPointsPpr,
      vacatedImpactScore,
      addedThreatScore,
      netOpportunityScore,
      qualitySignal,
      incumbentPromotionScore,
      incumbentOpportunitySignal,
      topVacatedPlayer,
      topAddedThreat,
      topReturningDepthPlayer,
      returningPromotionCandidates,
      note: `${team} ${position} net opportunity ${qualitySignal}: vacated ${vacatedTargets} targets, ${vacatedCarries} carries, and ${vacatedFantasyPointsPpr} PPR points from departures${topVacatedPlayer ? ` led by ${topVacatedPlayer}` : ''}; incoming players carried ${addedPriorTargets} targets, ${addedPriorCarries} carries, and ${addedPriorFantasyPointsPpr} PPR points${topAddedThreat ? ` led by ${topAddedThreat}` : ''}${topReturningDepthPlayer ? `; top returning depth-chart player ${topReturningDepthPlayer} has ${incumbentOpportunitySignal} signal` : ''}.`,
    } satisfies NonNullable<NflverseRosterRoomRow['opportunityDelta']>;

    return [{
      source: 'nflverse rosters/weekly rosters/depth charts/trades' as const,
      season: input.season,
      previousSeason: input.previousSeason,
      team,
      position,
      currentCount: current.length,
      previousCount: previous.length,
      netChange,
      additions: summarizedAdditions,
      losses: summarizedLosses,
      rookieAdditions: rookieAdditions.slice(0, 8).map((player) => movementSummary({
        player,
        direction: 'addition',
        season: input.season,
        priorUsage: findPriorUsage(player, priorUsageIndex),
        prospect: findRoomProspect(player, prospectIndex),
        weeklySignal: currentWeeklySignals.get(weeklySignalKey(player)) || null,
        tradeSignal: findTradeSignal(player, tradeSignals, 'addition'),
      })),
      premiumAdditions: premiumAdditions.slice(0, 8).map((player) => movementSummary({
        player,
        direction: 'addition',
        season: input.season,
        priorUsage: findPriorUsage(player, priorUsageIndex),
        prospect: findRoomProspect(player, prospectIndex),
        weeklySignal: currentWeeklySignals.get(weeklySignalKey(player)) || null,
        tradeSignal: findTradeSignal(player, tradeSignals, 'addition'),
      })),
      depthChartTop: depthPlayers,
      movementTypes,
      weeklyCoverage,
      opportunityDelta,
      competitionLevel,
      vacatedOpportunitySignal,
      note: `${team} ${position} room is ${competitionLevel}: ${current.length} current player${current.length === 1 ? '' : 's'} vs ${previous.length} last season, ${additions.length} addition${additions.length === 1 ? '' : 's'}${additionNames ? ` (${additionNames})` : ''}, ${losses.length} loss${losses.length === 1 ? '' : 'es'}${lossNames ? ` (${lossNames})` : ''}; movement types ${movementTypes.length ? movementTypes.join(', ') : 'untyped'}, weekly coverage ${weeklyCoverage.currentSeasonPlayers}/${summarizedAdditions.length} additions and ${weeklyCoverage.previousSeasonPlayers}/${summarizedLosses.length} losses, ${opportunityDelta.note}, opportunity signal ${vacatedOpportunitySignal}.`,
    }];
  });
}

export function normalizeNflverseInjuryRows(rows: Array<Record<string, unknown>>, season: string): NflverseInjuryRow[] {
  const byGsis = new Map<string, { playerName: string; position: string; reportCount: number; missedOrLimitedCount: number; injuryTypes: Set<string>; latestStatus: string | null }>();
  for (const row of rows) {
    if (String(row.season || '') !== season) continue;
    const position = String(row.position || '').toUpperCase();
    if (!FANTASY_POSITIONS.has(position)) continue;
    const gsisId = textValue(row.gsis_id);
    const playerName = textValue(row.full_name);
    if (!gsisId || !playerName) continue;
    const current = byGsis.get(gsisId) || { playerName, position, reportCount: 0, missedOrLimitedCount: 0, injuryTypes: new Set<string>(), latestStatus: null };
    current.reportCount += 1;
    const reportStatus = textValue(row.report_status) || textValue(row.practice_status);
    if (reportStatus) current.latestStatus = reportStatus;
    const primary = textValue(row.report_primary_injury) || textValue(row.practice_primary_injury);
    if (primary && !/rest|not injury/i.test(primary)) current.injuryTypes.add(primary);
    if (reportStatus && /out|doubtful|questionable|did not|limited|injured reserve/i.test(reportStatus)) current.missedOrLimitedCount += 1;
    byGsis.set(gsisId, current);
  }
  return Array.from(byGsis.entries()).map(([gsisId, row]) => ({
    gsisId,
    playerName: row.playerName,
    position: row.position,
    season,
    reportCount: row.reportCount,
    missedOrLimitedCount: row.missedOrLimitedCount,
    injuryTypes: Array.from(row.injuryTypes).slice(0, 5),
    latestStatus: row.latestStatus,
    note: row.missedOrLimitedCount
      ? `${row.missedOrLimitedCount} limited/out-style injury report signal${row.missedOrLimitedCount === 1 ? '' : 's'} in ${season}.`
      : `No limited/out-style injury report signals found in ${season}.`,
  }));
}

export function normalizeNflverseAthleticRows(rows: Array<Record<string, unknown>>): NflverseAthleticRow[] {
  return rows
    .flatMap((row) => {
      const position = normalizeFantasyPosition(row.pos);
      if (!position) return [];
      const pfrId = textValue(row.pfr_id);
      const playerName = textValue(row.player_name);
      if (!playerName) return [];
      const weight = num(row.wt);
      const forty = num(row.forty);
      const speedScore = weight && forty ? Math.round((weight * 200 / Math.pow(forty, 4)) * 10) / 10 : null;
      const athleticRow: NflverseAthleticRow = {
        source: 'nflverse combine' as const,
        pfrId,
        playerName,
        position,
        draftYear: num(row.draft_year),
        height: textValue(row.ht),
        weight,
        forty,
        bench: num(row.bench),
        vertical: num(row.vertical),
        broadJump: num(row.broad_jump),
        cone: num(row.cone),
        shuttle: num(row.shuttle),
        speedScore,
        note: speedScore ? `Combine profile loaded with ${speedScore} speed score.` : 'Combine profile loaded; speed score unavailable.',
      };
      return [athleticRow];
    });
}

function buildAthleticNamePositionIndex(rows: NflverseAthleticRow[]): Record<string, NflverseAthleticRow[]> {
  const index: Record<string, NflverseAthleticRow[]> = {};
  for (const row of rows) {
    const key = athleticNamePositionKey(row.playerName, row.position);
    if (!key) continue;
    index[key] = [...(index[key] || []), row].sort((a, b) => Number(b.draftYear || 0) - Number(a.draftYear || 0));
  }
  return index;
}

function getDetailsDraftYear(details: PlayerDetails): number | null {
  const values = [
    details.rookieYear,
    details.prospectProfile?.draftYear,
  ];
  for (const value of values) {
    const parsed = num(value);
    if (parsed) return parsed;
  }
  return null;
}

export function findNflverseAthleticProfile(
  input: {
    pfrId?: unknown;
    fullName?: unknown;
    position?: unknown;
    draftYear?: unknown;
    existing?: PlayerDetails['athleticProfile'] | null;
  },
  context: NflversePlayerContext
): PlayerDetails['athleticProfile'] | null {
  const existing = input.existing || null;
  const pfrId = textValue(input.pfrId);
  if (pfrId && context.athleticByPfrId[pfrId]) return context.athleticByPfrId[pfrId];

  const key = athleticNamePositionKey(
    input.fullName,
    input.position
  );
  const candidates = key ? context.athleticByNamePosition[key] || [] : [];
  if (!candidates.length) return existing;

  const draftYear = num(input.draftYear);
  const exactYear = draftYear ? candidates.find((row) => row.draftYear === draftYear) : null;
  if (exactYear) return exactYear;
  if (candidates.length === 1) return candidates[0];
  return existing;
}

function findAthleticProfile(details: PlayerDetails, context: NflversePlayerContext): PlayerDetails['athleticProfile'] | null {
  return findNflverseAthleticProfile({
    pfrId: details.externalIds?.pfr,
    fullName: details.fullName || details.prospectProfile?.name,
    position: details.position || details.prospectProfile?.position,
    draftYear: getDetailsDraftYear(details),
    existing: details.athleticProfile || null,
  }, context);
}

export function normalizeNflverseContractRows(rows: Array<Record<string, unknown>>): NflverseContractRow[] {
  return rows
    .flatMap((row) => {
      const position = String(row.position || '').toUpperCase();
      if (!FANTASY_POSITIONS.has(position)) return [];
      const playerName = textValue(row.player);
      if (!playerName) return [];
      const apy = num(row.apy);
      const guaranteed = num(row.guaranteed);
      const investmentTier = (apy || 0) >= 18_000_000 || (guaranteed || 0) >= 30_000_000
        ? 'premium'
        : (apy || 0) >= 5_000_000 || (guaranteed || 0) >= 8_000_000
        ? 'solid'
        : (apy || 0) > 0
        ? 'fringe'
        : 'unknown';
      const contractRow: NflverseContractRow = {
        source: 'nflverse contracts' as const,
        playerName,
        position,
        team: textValue(row.team),
        yearSigned: num(row.year_signed),
        years: num(row.years),
        value: num(row.value),
        apy,
        guaranteed,
        draftRound: num(row.draft_round),
        draftOverall: num(row.draft_overall),
        investmentTier,
        note: investmentTier === 'premium'
          ? 'Contract investment supports a longer veteran opportunity runway.'
          : investmentTier === 'solid'
          ? 'Contract investment gives some role insulation, but usage still needs to hold.'
          : 'Contract signal does not strongly protect the role.',
      };
      return [contractRow];
    });
}

async function loadUsageSnapshot(options: ContextOptions): Promise<Snapshot<NflverseUsageRow>> {
  if (options.sourceMode === 'snapshot') return loadStoredSeasonFallback<NflverseUsageRow>(NFLVERSE_USAGE_SOURCE_PREFIX, options.season);
  try {
    const url = inferUsageSourceUrl(options.season);
    const statsRows = parseCsv(await fetchText(url));
    const actualSeason = latestAvailableUsageSeason(statsRows, options.season);
    const key = sourceKey(NFLVERSE_USAGE_SOURCE_PREFIX, actualSeason);
    const snapUrl = (process.env.NFLVERSE_SNAP_COUNTS_URL || SNAP_COUNTS_URL).replace('{season}', actualSeason);
    const snapRows = parseCsv(await fetchText(snapUrl));
    const snapshot = buildSnapshot({
      source: 'nflverse player stats and snap counts',
      sourceUrl: `${inferUsageSourceUrl(actualSeason)} + ${snapUrl}`,
      season: actualSeason,
      rows: normalizeNflverseUsageRows({ statsRows, snapRows, season: actualSeason }),
    });
    if (options.persistSnapshot) await persist(key, snapshot);
    return snapshot;
  } catch (error) {
    console.warn('[nflverse] Failed to refresh usage snapshot:', error);
    return loadStoredSeasonFallback<NflverseUsageRow>(NFLVERSE_USAGE_SOURCE_PREFIX, options.season);
  }
}

async function loadTeamEnvironmentSnapshot(options: ContextOptions): Promise<Snapshot<NflverseTeamEnvironmentRow>> {
  if (options.sourceMode === 'snapshot') return loadStoredSeasonFallback<NflverseTeamEnvironmentRow>(NFLVERSE_TEAM_ENVIRONMENT_SOURCE_PREFIX, options.season);
  try {
    const url = inferTeamStatsSourceUrl(options.season);
    const rows = parseCsv(await fetchText(url));
    const actualSeason = latestAvailableUsageSeason(rows, options.season);
    const key = sourceKey(NFLVERSE_TEAM_ENVIRONMENT_SOURCE_PREFIX, actualSeason);
    const pbpUrl = inferPbpSourceUrl(actualSeason);
    let pbpRows: Array<Record<string, unknown>> = [];
    try {
      pbpRows = parseCsv(await fetchMaybeGzipText(pbpUrl));
    } catch (error) {
      console.warn('[nflverse] Failed to refresh play-by-play team splits; using stats_team only:', error);
    }
    const snapshot = buildSnapshot({
      source: 'nflverse team stats',
      sourceUrl: `${inferTeamStatsSourceUrl(actualSeason)} + ${pbpUrl}`,
      season: actualSeason,
      rows: normalizeNflverseTeamEnvironmentRows(rows, actualSeason, pbpRows),
    });
    if (options.persistSnapshot) await persist(key, snapshot);
    return snapshot;
  } catch (error) {
    console.warn('[nflverse] Failed to refresh team-environment snapshot:', error);
    return loadStoredSeasonFallback<NflverseTeamEnvironmentRow>(NFLVERSE_TEAM_ENVIRONMENT_SOURCE_PREFIX, options.season);
  }
}

async function loadRosterRoomSnapshot(options: ContextOptions): Promise<Snapshot<NflverseRosterRoomRow>> {
  const season = options.rosterRoomSeason || nextSeason(options.season);
  const previousSeason = options.rosterRoomPreviousSeason || options.season;
  if (options.sourceMode === 'snapshot') return loadStoredSeasonFallback<NflverseRosterRoomRow>(NFLVERSE_ROSTER_ROOM_SOURCE_PREFIX, season);
  try {
    const currentRosterUrl = inferRostersSourceUrl(season);
    const previousRosterUrl = inferRostersSourceUrl(previousSeason);
    const currentWeeklyRosterUrl = inferWeeklyRostersSourceUrl(season);
    const previousWeeklyRosterUrl = inferWeeklyRostersSourceUrl(previousSeason);
    const depthChartUrl = inferDepthChartsSourceUrl(season);
    const tradesUrl = inferTradesSourceUrl();
    const usageUrl = inferUsageSourceUrl(previousSeason);
    const [currentRosterRows, previousRosterRows, currentWeeklyRosterRows, previousWeeklyRosterRows, depthChartRows, tradeRows, previousSeasonUsageRows, prospectContext] = await Promise.all([
      fetchText(currentRosterUrl).then(parseCsv),
      fetchText(previousRosterUrl).then(parseCsv).catch((error) => {
        console.warn('[nflverse] Failed to refresh previous roster room baseline:', error);
        return [];
      }),
      fetchText(currentWeeklyRosterUrl).then(parseCsv).catch(() => []),
      fetchText(previousWeeklyRosterUrl).then(parseCsv).catch((error) => {
        console.warn('[nflverse] Failed to refresh previous weekly roster room timing:', error);
        return [];
      }),
      fetchText(depthChartUrl).then(parseCsv).catch((error) => {
        console.warn('[nflverse] Failed to refresh depth-chart roster room overlay:', error);
        return [];
      }),
      fetchText(tradesUrl).then(parseCsv).catch((error) => {
        console.warn('[nflverse] Failed to refresh trade roster room overlay:', error);
        return [];
      }),
      fetchText(usageUrl).then(parseCsv).then((statsRows) => normalizeNflverseUsageRows({
        statsRows,
        season: previousSeason,
      })).catch((error) => {
        console.warn('[nflverse] Failed to refresh prior usage roster room quality:', error);
        return [];
      }),
      loadProspectContext().catch((error) => {
        console.warn('[nflverse] Failed to load prospect roster room quality:', error);
        return null;
      }),
    ]);
    const snapshot = buildSnapshot({
      source: 'nflverse rosters, weekly rosters, depth charts, trades, and prior usage',
      sourceUrl: `${currentRosterUrl} + ${previousRosterUrl} + ${currentWeeklyRosterUrl} + ${previousWeeklyRosterUrl} + ${depthChartUrl} + ${tradesUrl} + ${usageUrl}`,
      season,
      rows: normalizeNflverseRosterRoomRows({
        currentRosterRows,
        previousRosterRows,
        previousSeasonUsageRows,
        prospectProfiles: prospectContext?.profiles || [],
        currentWeeklyRosterRows,
        previousWeeklyRosterRows,
        depthChartRows,
        tradeRows,
        season,
        previousSeason,
      }),
    });
    if (options.persistSnapshot) await persist(sourceKey(NFLVERSE_ROSTER_ROOM_SOURCE_PREFIX, season), snapshot);
    return snapshot;
  } catch (error) {
    console.warn('[nflverse] Failed to refresh roster-room snapshot:', error);
    return loadStoredSeasonFallback<NflverseRosterRoomRow>(NFLVERSE_ROSTER_ROOM_SOURCE_PREFIX, season);
  }
}

async function loadInjurySnapshot(options: ContextOptions): Promise<Snapshot<NflverseInjuryRow>> {
  const key = sourceKey(NFLVERSE_INJURY_SOURCE_PREFIX, options.season);
  if (options.sourceMode === 'snapshot') return loadStored<NflverseInjuryRow>(key);
  try {
    const url = (process.env.NFLVERSE_INJURIES_URL || INJURIES_URL).replace('{season}', options.season);
    const snapshot = buildSnapshot({
      source: 'nflverse injuries',
      sourceUrl: url,
      season: options.season,
      rows: normalizeNflverseInjuryRows(parseCsv(await fetchText(url)), options.season),
    });
    if (options.persistSnapshot) await persist(key, snapshot);
    return snapshot;
  } catch (error) {
    console.warn('[nflverse] Failed to refresh injury snapshot:', error);
    return loadStored<NflverseInjuryRow>(key);
  }
}

async function loadAthleticSnapshot(options: Omit<ContextOptions, 'season'>): Promise<Snapshot<NflverseAthleticRow>> {
  if (options.sourceMode === 'snapshot') {
    const stored = await loadStored<NflverseAthleticRow>(NFLVERSE_COMBINE_SOURCE_KEY);
    if (stored.rows.length && hasExpandedAthleticMetrics(stored)) return stored;

    try {
      return await fetchAthleticSnapshot(options, true);
    } catch (error) {
      console.warn('[nflverse] Failed to refresh missing or legacy combine snapshot:', error);
      return stored;
    }
  }
  try {
    return await fetchAthleticSnapshot(options);
  } catch (error) {
    console.warn('[nflverse] Failed to refresh combine snapshot:', error);
    return loadStored<NflverseAthleticRow>(NFLVERSE_COMBINE_SOURCE_KEY);
  }
}

async function loadContractSnapshot(options: Omit<ContextOptions, 'season'>): Promise<Snapshot<NflverseContractRow>> {
  if (options.sourceMode === 'snapshot') return loadStored<NflverseContractRow>(NFLVERSE_CONTRACT_SOURCE_KEY);
  try {
    const url = process.env.NFLVERSE_CONTRACTS_URL || CONTRACTS_URL;
    const snapshot = buildSnapshot({
      source: 'nflverse contracts',
      sourceUrl: url,
      rows: normalizeNflverseContractRows(parseCsv(await fetchMaybeGzipText(url))),
    });
    if (options.persistSnapshot) await persist(NFLVERSE_CONTRACT_SOURCE_KEY, snapshot);
    return snapshot;
  } catch (error) {
    console.warn('[nflverse] Failed to refresh contract snapshot:', error);
    return loadStored<NflverseContractRow>(NFLVERSE_CONTRACT_SOURCE_KEY);
  }
}

export async function loadNflversePlayerContext(options: ContextOptions): Promise<NflversePlayerContext> {
  const [usage, teamEnvironment, rosterRoom, injuries, athletic, contracts] = await Promise.all([
    loadUsageSnapshot(options),
    loadTeamEnvironmentSnapshot(options),
    loadRosterRoomSnapshot(options),
    loadInjurySnapshot(options),
    loadAthleticSnapshot(options),
    loadContractSnapshot(options),
  ]);
  return {
    usageByGsisId: Object.fromEntries(usage.rows.map((row) => [row.gsisId, row])),
    teamEnvironmentByTeam: Object.fromEntries(teamEnvironment.rows.map((row) => [teamKey(row.team), row])),
    rosterRoomByTeamPosition: Object.fromEntries(rosterRoom.rows.map((row) => [rosterRoomKey(row.team, row.position), row])),
    injuryByGsisId: Object.fromEntries(injuries.rows.map((row) => [row.gsisId, row])),
    athleticByPfrId: Object.fromEntries(athletic.rows.flatMap((row) => row.pfrId ? [[row.pfrId, row]] : [])),
    athleticByNamePosition: buildAthleticNamePositionIndex(athletic.rows),
    contractByName: Object.fromEntries(contracts.rows.map((row) => [nameKey(row.playerName), row])),
    rowCounts: [
      { sourceKey: sourceKey(NFLVERSE_USAGE_SOURCE_PREFIX, usage.season || options.season), rowCount: usage.rowCount },
      { sourceKey: sourceKey(NFLVERSE_TEAM_ENVIRONMENT_SOURCE_PREFIX, teamEnvironment.season || options.season), rowCount: teamEnvironment.rowCount },
      { sourceKey: sourceKey(NFLVERSE_ROSTER_ROOM_SOURCE_PREFIX, rosterRoom.season || nextSeason(options.season)), rowCount: rosterRoom.rowCount },
      { sourceKey: sourceKey(NFLVERSE_INJURY_SOURCE_PREFIX, injuries.season || options.season), rowCount: injuries.rowCount },
      { sourceKey: NFLVERSE_COMBINE_SOURCE_KEY, rowCount: athletic.rowCount },
      { sourceKey: NFLVERSE_CONTRACT_SOURCE_KEY, rowCount: contracts.rowCount },
    ],
  };
}

export function enrichPlayerDetailsWithNflverseContext(
  playerDetailsById: Record<string, PlayerDetails>,
  context: NflversePlayerContext
): Record<string, PlayerDetails> {
  return Object.fromEntries(
    Object.entries(playerDetailsById).map(([playerId, details]) => {
      const gsisId = textValue(details.externalIds?.gsis);
      const contract = context.contractByName[nameKey(details.fullName)];
      const usageTrend = gsisId ? context.usageByGsisId[gsisId] || details.usageTrend || null : details.usageTrend || null;
      const teamEnvironment = context.teamEnvironmentByTeam[teamKey(details.team || usageTrend?.team)] || details.teamEnvironment || null;
      const rosterRoom = context.rosterRoomByTeamPosition[rosterRoomKey(details.team || usageTrend?.team, details.position)] || details.rosterRoom || null;
      const athleticProfile = findAthleticProfile(details, context);
      return [playerId, {
        ...details,
        usageTrend,
        teamEnvironment,
        rosterRoom,
        injuryHistory: gsisId ? context.injuryByGsisId[gsisId] || details.injuryHistory || null : details.injuryHistory || null,
        athleticProfile,
        contractProfile: contract || details.contractProfile || null,
      }];
    })
  );
}
