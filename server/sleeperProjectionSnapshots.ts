import { buildPlayerProjectionSnapshot, loadPlayerProjectionSnapshot, persistPlayerProjectionSnapshot, type PlayerProjectionInputRow, type PlayerProjectionSnapshotPayload } from './playerProjectionSnapshots';

export type SleeperProjectionScoringProfile = 'PPR' | 'HALF_PPR' | 'STD' | 'CUSTOM';

type SleeperProjectionRow = {
  status?: string | null;
  date?: string | null;
  stats?: Record<string, unknown> | null;
  category?: string | null;
  last_modified?: number | string | null;
  week?: number | string | null;
  season?: string | number | null;
  player_id?: string | number | null;
  updated_at?: number | string | null;
  game_id?: string | number | null;
  opponent?: string | null;
  team?: string | null;
  player?: {
    first_name?: string | null;
    last_name?: string | null;
    position?: string | null;
    team?: string | null;
    fantasy_positions?: string[] | null;
    injury_status?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
};

export type SleeperProjectionSnapshotDiagnostics = {
  season: string;
  scoringProfile: SleeperProjectionScoringProfile;
  requestedWeeks: number[];
  fetchedWeeks: number[];
  persistedWeeks: number[];
  rowCount: number;
  normalizedRowCount: number;
  quarantinedRowCount: number;
  fantasyRowCount: number;
  nonNullProjectionRowCount: number;
  nullProjectionRowCount: number;
  byeOrNullOpponentRowCount: number;
  errors: string[];
};

const SLEEPER_PROJECTION_PARSER_VERSION = 1;
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DST']);

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function dateFromEpoch(value: unknown): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const date = new Date(numeric);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizePosition(row: SleeperProjectionRow): string | null {
  const position = String(row.player?.position || row.player?.fantasy_positions?.[0] || '').trim().toUpperCase();
  if (position === 'DST') return 'DEF';
  return position || null;
}

function playerName(row: SleeperProjectionRow): string | null {
  const name = [row.player?.first_name, row.player?.last_name]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  return name || null;
}

export function getSleeperProjectionScoringProfile(scoringSettings?: Record<string, unknown> | null): SleeperProjectionScoringProfile {
  const rec = Number(scoringSettings?.rec ?? 1);
  if (rec === 1) return 'PPR';
  if (rec === 0.5) return 'HALF_PPR';
  if (rec === 0) return 'STD';
  return 'CUSTOM';
}

function calculateFantasyPointsFromScoring(stats: Record<string, unknown>, scoringSettings?: Record<string, unknown> | null): number | null {
  const total = Object.entries(scoringSettings || {}).reduce((sum, [key, scoringValue]) => {
    const statValue = Number(stats[key] ?? 0);
    const multiplier = Number(scoringValue ?? 0);
    if (!Number.isFinite(statValue) || !Number.isFinite(multiplier)) return sum;
    return sum + statValue * multiplier;
  }, 0);
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : null;
}

export function getSleeperProjectedFantasyPoints(
  stats: Record<string, unknown> | null | undefined,
  scoringProfile: SleeperProjectionScoringProfile,
  scoringSettings?: Record<string, unknown> | null,
): number | null {
  if (!stats) return null;
  if (scoringProfile === 'PPR') return numberValue(stats.pts_ppr);
  if (scoringProfile === 'HALF_PPR') return numberValue(stats.pts_half_ppr);
  if (scoringProfile === 'STD') return numberValue(stats.pts_std);
  return calculateFantasyPointsFromScoring(stats, scoringSettings);
}

export function applySleeperTightEndPremium(input: {
  projectedFantasyPoints: number | null | undefined;
  position?: string | null;
  receptions?: number | null;
  tightEndPremium?: number | null;
}): { projectedFantasyPoints: number | null; adjustment: number } {
  const basePoints = numberValue(input.projectedFantasyPoints);
  if (basePoints === null) return { projectedFantasyPoints: null, adjustment: 0 };
  const bonus = numberValue(input.tightEndPremium) || 0;
  const receptions = numberValue(input.receptions) || 0;
  const isTightEnd = String(input.position || '').trim().toUpperCase() === 'TE';
  if (!isTightEnd || bonus <= 0 || receptions <= 0) {
    return { projectedFantasyPoints: basePoints, adjustment: 0 };
  }
  const adjustment = Math.round(receptions * bonus * 100) / 100;
  return {
    projectedFantasyPoints: Math.round((basePoints + adjustment) * 100) / 100,
    adjustment,
  };
}

export function buildSleeperProjectionInputRows(input: {
  rows: SleeperProjectionRow[];
  scoringProfile: SleeperProjectionScoringProfile;
  scoringSettings?: Record<string, unknown> | null;
}): PlayerProjectionInputRow[] {
  return input.rows.map((row) => {
    const stats = row.stats || {};
    const position = normalizePosition(row);
    const providerUpdatedAt = dateFromEpoch(row.updated_at) || dateFromEpoch(row.last_modified);
    const projectedFantasyPoints = getSleeperProjectedFantasyPoints(stats, input.scoringProfile, input.scoringSettings);
    return {
      season: row.season || '',
      week: row.week ?? null,
      playerId: row.player_id ?? null,
      sourcePlayerId: row.player_id ?? null,
      playerName: playerName(row),
      team: row.team || row.player?.team || null,
      opponent: row.opponent || null,
      homeAway: row.opponent ? 'unknown' : projectedFantasyPoints === null ? 'bye' : 'unknown',
      gameId: row.game_id || null,
      sourceStatus: row.status || row.category || null,
      position,
      projectedFantasyPoints,
      passingAttempts: numberValue(stats.pass_att),
      passingYards: numberValue(stats.pass_yd),
      passingTouchdowns: numberValue(stats.pass_td),
      interceptions: numberValue(stats.pass_int),
      carries: numberValue(stats.rush_att),
      rushingYards: numberValue(stats.rush_yd),
      rushingTouchdowns: numberValue(stats.rush_td),
      targets: numberValue(stats.rec_tgt),
      receptions: numberValue(stats.rec),
      receivingYards: numberValue(stats.rec_yd),
      receivingTouchdowns: numberValue(stats.rec_td),
      turnovers: numberValue(stats.fum_lost),
      fieldGoalAttempts: numberValue(stats.fgm) ?? numberValue(stats.fga),
      defensiveSacks: numberValue(stats.sack),
      defensiveInterceptions: numberValue(stats.int),
      defensiveFumbleRecoveries: numberValue(stats.fum_rec),
      defensiveTouchdowns: numberValue(stats.def_td),
      injuryStatus: row.player?.injury_status || null,
      rookie: String(row.player?.metadata?.rookie_year || '') === String(row.season || ''),
      matchConfidence: row.player_id ? 100 : 0,
      providerUpdatedAt,
      publishedAt: providerUpdatedAt,
    };
  });
}

export function buildSleeperProjectionSnapshot(input: {
  season: string | number;
  week: number;
  rows: SleeperProjectionRow[];
  scoringProfile: SleeperProjectionScoringProfile;
  scoringSettings?: Record<string, unknown> | null;
  fetchedAt?: Date | string | null;
  sourceVersion?: string | number | null;
}): PlayerProjectionSnapshotPayload {
  const fetchedAt = input.fetchedAt || new Date();
  const inputRows = buildSleeperProjectionInputRows({
    rows: input.rows,
    scoringProfile: input.scoringProfile,
    scoringSettings: input.scoringSettings,
  });
  const providerUpdatedAt = inputRows
    .map((row) => row.providerUpdatedAt ? new Date(row.providerUpdatedAt).getTime() : 0)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a)[0];

  return buildPlayerProjectionSnapshot({
    season: input.season,
    week: input.week,
    source: 'sleeper',
    scoringProfile: input.scoringProfile,
    projectionType: 'weekly',
    sourceVersion: input.sourceVersion || `sleeper-${input.scoringProfile.toLowerCase()}-${String(input.season)}-w${input.week}`,
    rows: inputRows,
    fetchedAt,
    publishedAt: providerUpdatedAt ? new Date(providerUpdatedAt) : null,
    providerUpdatedAt: providerUpdatedAt ? new Date(providerUpdatedAt) : null,
    validForWeek: input.week,
    parserVersion: SLEEPER_PROJECTION_PARSER_VERSION,
  });
}

async function fetchSleeperProjectionRows(season: string, week: number): Promise<SleeperProjectionRow[]> {
  const response = await fetch(`https://api.sleeper.app/projections/nfl/${encodeURIComponent(season)}/${week}?season_type=regular`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Sleeper projections week ${week} returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

export async function refreshSleeperProjectionSnapshots(options: {
  season?: string | number;
  weeks?: number[];
  scoringProfile?: SleeperProjectionScoringProfile;
  scoringSettings?: Record<string, unknown> | null;
  persistSnapshot?: boolean;
  fetchedAt?: Date;
  requestDelayMs?: number;
} = {}): Promise<SleeperProjectionSnapshotDiagnostics> {
  const season = String(options.season || new Date().getFullYear());
  const scoringProfile = options.scoringProfile || getSleeperProjectionScoringProfile(options.scoringSettings);
  const requestedWeeks = (options.weeks?.length ? options.weeks : Array.from({ length: 18 }, (_, index) => index + 1))
    .filter((week) => Number.isInteger(week) && week > 0 && week <= 22);
  const diagnostics: SleeperProjectionSnapshotDiagnostics = {
    season,
    scoringProfile,
    requestedWeeks,
    fetchedWeeks: [],
    persistedWeeks: [],
    rowCount: 0,
    normalizedRowCount: 0,
    quarantinedRowCount: 0,
    fantasyRowCount: 0,
    nonNullProjectionRowCount: 0,
    nullProjectionRowCount: 0,
    byeOrNullOpponentRowCount: 0,
    errors: [],
  };

  for (const week of requestedWeeks) {
    try {
      const rows = await fetchSleeperProjectionRows(season, week);
      diagnostics.fetchedWeeks.push(week);
      diagnostics.rowCount += rows.length;
      diagnostics.fantasyRowCount += rows.filter((row) => {
        const position = normalizePosition(row);
        return Boolean(position && FANTASY_POSITIONS.has(position));
      }).length;
      diagnostics.nonNullProjectionRowCount += rows.filter((row) => getSleeperProjectedFantasyPoints(row.stats, scoringProfile, options.scoringSettings) !== null).length;
      diagnostics.nullProjectionRowCount += rows.filter((row) => getSleeperProjectedFantasyPoints(row.stats, scoringProfile, options.scoringSettings) === null).length;
      diagnostics.byeOrNullOpponentRowCount += rows.filter((row) => !row.opponent).length;

      const snapshot = buildSleeperProjectionSnapshot({
        season,
        week,
        rows,
        scoringProfile,
        scoringSettings: options.scoringSettings,
        fetchedAt: options.fetchedAt || new Date(),
      });
      diagnostics.normalizedRowCount += snapshot.rowCount;
      diagnostics.quarantinedRowCount += snapshot.quarantinedRows.length;
      if (options.persistSnapshot !== false) {
        const persisted = await persistPlayerProjectionSnapshot(snapshot);
        if (persisted) diagnostics.persistedWeeks.push(week);
      }
      if (options.requestDelayMs && week !== requestedWeeks[requestedWeeks.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, options.requestDelayMs));
      }
    } catch (error) {
      diagnostics.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return diagnostics;
}

export async function refreshSleeperProjectionSnapshotSet(options: {
  season?: string | number;
  weeks?: number[];
  scoringProfiles?: SleeperProjectionScoringProfile[];
  persistSnapshot?: boolean;
  fetchedAt?: Date;
  requestDelayMs?: number;
} = {}): Promise<SleeperProjectionSnapshotDiagnostics[]> {
  const season = String(options.season || new Date().getFullYear());
  const scoringProfiles: SleeperProjectionScoringProfile[] = options.scoringProfiles?.length ? options.scoringProfiles : ['PPR', 'HALF_PPR', 'STD'];
  const requestedWeeks = (options.weeks?.length ? options.weeks : Array.from({ length: 18 }, (_, index) => index + 1))
    .filter((week) => Number.isInteger(week) && week > 0 && week <= 22);
  const fetchedAt = options.fetchedAt || new Date();
  const diagnosticsByProfile = scoringProfiles.map((scoringProfile): SleeperProjectionSnapshotDiagnostics => ({
    season,
    scoringProfile,
    requestedWeeks,
    fetchedWeeks: [],
    persistedWeeks: [],
    rowCount: 0,
    normalizedRowCount: 0,
    quarantinedRowCount: 0,
    fantasyRowCount: 0,
    nonNullProjectionRowCount: 0,
    nullProjectionRowCount: 0,
    byeOrNullOpponentRowCount: 0,
    errors: [],
  }));

  for (const week of requestedWeeks) {
    let rows: SleeperProjectionRow[] = [];
    try {
      rows = await fetchSleeperProjectionRows(season, week);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      diagnosticsByProfile.forEach((diagnostic) => diagnostic.errors.push(message));
      continue;
    }

    for (const diagnostic of diagnosticsByProfile) {
      diagnostic.fetchedWeeks.push(week);
      diagnostic.rowCount += rows.length;
      diagnostic.fantasyRowCount += rows.filter((row) => {
        const position = normalizePosition(row);
        return Boolean(position && FANTASY_POSITIONS.has(position));
      }).length;
      diagnostic.nonNullProjectionRowCount += rows.filter((row) => getSleeperProjectedFantasyPoints(row.stats, diagnostic.scoringProfile) !== null).length;
      diagnostic.nullProjectionRowCount += rows.filter((row) => getSleeperProjectedFantasyPoints(row.stats, diagnostic.scoringProfile) === null).length;
      diagnostic.byeOrNullOpponentRowCount += rows.filter((row) => !row.opponent).length;
      const snapshot = buildSleeperProjectionSnapshot({
        season,
        week,
        rows,
        scoringProfile: diagnostic.scoringProfile,
        fetchedAt,
      });
      diagnostic.normalizedRowCount += snapshot.rowCount;
      diagnostic.quarantinedRowCount += snapshot.quarantinedRows.length;
      if (options.persistSnapshot !== false) {
        const persisted = await persistPlayerProjectionSnapshot(snapshot);
        if (persisted) diagnostic.persistedWeeks.push(week);
      }
    }
    if (options.requestDelayMs && week !== requestedWeeks[requestedWeeks.length - 1]) {
      await new Promise((resolve) => setTimeout(resolve, options.requestDelayMs));
    }
  }

  return diagnosticsByProfile;
}

export async function loadStoredSleeperProjectionSnapshot(input: {
  season: string | number;
  week: number;
  scoringProfile: SleeperProjectionScoringProfile;
}): Promise<PlayerProjectionSnapshotPayload | null> {
  return loadPlayerProjectionSnapshot({
    source: 'sleeper',
    scoringProfile: input.scoringProfile,
    projectionType: 'weekly',
    season: input.season,
    week: input.week,
    sourceVersion: `sleeper-${input.scoringProfile.toLowerCase()}-${String(input.season)}-w${input.week}`,
  });
}
