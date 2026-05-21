import { normalizeSeasonLineupPosition } from './playerEligibility';
import type { PlayerMatchupActualInputRow } from './playerMatchupActuals';

export type SleeperScoringFamily = 'std' | 'half_ppr' | 'ppr' | 'custom';

export type SleeperWeeklyStatsSnapshotLike = {
  season: string | number;
  week: string | number;
  values: Record<string, unknown>;
};

export type SleeperHistoricalTeamMaps = {
  byPlayerSeasonWeek?: Record<string, string | null | undefined>;
  byPlayerSeason?: Record<string, string | null | undefined>;
  byPlayerId?: Record<string, string | null | undefined>;
};

export type SleeperMatchupActualRowsInput = {
  season: string | number;
  week: string | number;
  stats: Record<string, unknown>;
  players: Record<string, any>;
  scoringSettings?: Record<string, any> | null;
  positions?: string[];
  projectedFantasyPointsByPlayerId?: Record<string, number | string | null | undefined>;
  teamMaps?: SleeperHistoricalTeamMaps;
  allowPlayerMetadataTeamFallback?: boolean;
  source?: string;
};

export type SleeperSeasonMatchupActualRowsInput = {
  weeks: SleeperWeeklyStatsSnapshotLike[];
  players: Record<string, any>;
  scoringSettings?: Record<string, any> | null;
  positions?: string[];
  projectedFantasyPointsByPlayerId?: Record<string, number | string | null | undefined>;
  teamMaps?: SleeperHistoricalTeamMaps;
  allowPlayerMetadataTeamFallback?: boolean;
  source?: string;
};

const DEFAULT_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

function cleanText(value: unknown): string | null {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean || null;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function statNumber(stats: Record<string, any>, keys: string[]): number | null {
  for (const key of keys) {
    if (stats[key] === null || stats[key] === undefined || stats[key] === '') continue;
    const parsed = numeric(stats[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function normalizeMatchupPosition(value: unknown): string | null {
  const normalized = normalizeSeasonLineupPosition(value);
  if (normalized === 'DEF') return 'DST';
  return normalized;
}

function getScoringFamily(scoringSettings?: Record<string, any> | null): SleeperScoringFamily {
  const rec = Number(scoringSettings?.rec ?? 1);
  if (rec === 1) return 'ppr';
  if (rec === 0.5) return 'half_ppr';
  if (rec === 0) return 'std';
  return 'custom';
}

export function calculateSleeperFantasyPointsFromScoring(
  stats: Record<string, any>,
  scoringSettings?: Record<string, any> | null
): number | null {
  if (!scoringSettings || !Object.keys(scoringSettings).length) return null;
  const total = Object.entries(scoringSettings).reduce((sum, [key, scoringValue]) => {
    const statValue = Number(stats[key] ?? 0);
    const multiplier = Number(scoringValue ?? 0);
    if (!Number.isFinite(statValue) || !Number.isFinite(multiplier)) return sum;
    return sum + statValue * multiplier;
  }, 0);
  return Math.round(total * 100) / 100;
}

export function getSleeperFantasyPoints(
  stats: Record<string, any>,
  scoringSettings?: Record<string, any> | null
): number | null {
  const scoringFamily = getScoringFamily(scoringSettings);
  if (scoringFamily === 'custom') {
    return calculateSleeperFantasyPointsFromScoring(stats, scoringSettings);
  }
  return statNumber(stats, [
    `pts_${scoringFamily}`,
    scoringFamily === 'half_ppr' ? 'pts_half_ppr' : '',
    'pts_ppr',
    'pts_half_ppr',
    'pts_std',
  ].filter(Boolean));
}

function unwrapStats(value: unknown): Record<string, any> | null {
  const candidate = value as { stats?: unknown };
  const stats = candidate?.stats && typeof candidate.stats === 'object'
    ? candidate.stats
    : value;
  return stats && typeof stats === 'object' && !Array.isArray(stats)
    ? stats as Record<string, any>
    : null;
}

function playerName(player: Record<string, any> | undefined): string | null {
  return cleanText(player?.full_name)
    || cleanText(player?.search_full_name)
    || [cleanText(player?.first_name), cleanText(player?.last_name)].filter(Boolean).join(' ')
    || cleanText(player?.last_name);
}

function teamMapKey(playerId: string, season: string | number, week?: string | number | null): string {
  return week === null || week === undefined
    ? `${playerId}:${String(season)}`
    : `${playerId}:${String(season)}:${String(week)}`;
}

function getHistoricalTeam(input: {
  playerId: string;
  season: string | number;
  week: string | number;
  player: Record<string, any> | undefined;
  stats: Record<string, any>;
  teamMaps?: SleeperHistoricalTeamMaps;
  allowPlayerMetadataTeamFallback?: boolean;
}): { team: string | null; source: string | null } {
  const statsTeam = cleanText(input.stats.team)
    || cleanText(input.stats.recent_team)
    || cleanText(input.stats.team_abbr)
    || cleanText(input.stats.tm);
  if (statsTeam) return { team: statsTeam, source: 'sleeper-stat-row' };

  const seasonWeekKey = teamMapKey(input.playerId, input.season, input.week);
  const seasonKey = teamMapKey(input.playerId, input.season, null);
  const mappedTeam = cleanText(input.teamMaps?.byPlayerSeasonWeek?.[seasonWeekKey])
    || cleanText(input.teamMaps?.byPlayerSeason?.[seasonKey])
    || cleanText(input.teamMaps?.byPlayerId?.[input.playerId]);
  if (mappedTeam) return { team: mappedTeam, source: 'historical-team-map' };

  if (input.allowPlayerMetadataTeamFallback) {
    const playerTeam = cleanText(input.player?.team);
    if (playerTeam) return { team: playerTeam, source: 'player-metadata-current-team-fallback' };
  }

  return { team: null, source: null };
}

function hasPlayed(stats: Record<string, any>, fantasyPoints: number | null): boolean {
  const gamesPlayed = statNumber(stats, ['gp', 'gs', 'gms_active']);
  if (gamesPlayed !== null && gamesPlayed > 0) return true;
  return fantasyPoints !== null && fantasyPoints !== 0;
}

function snapShare(stats: Record<string, any>): number | null {
  const explicit = statNumber(stats, ['off_snp_pct', 'snap_pct', 'snp_pct']);
  if (explicit !== null) return explicit;
  const offenseSnaps = statNumber(stats, ['off_snp', 'snp']);
  const teamOffenseSnaps = statNumber(stats, ['tm_off_snp']);
  if (offenseSnaps !== null && teamOffenseSnaps && teamOffenseSnaps > 0) {
    return Math.round((offenseSnaps / teamOffenseSnaps) * 10000) / 10000;
  }
  return null;
}

function buildSourceLabel(baseSource: string, teamSource: string | null): string {
  return teamSource ? `${baseSource}:${teamSource}` : baseSource;
}

export function buildSleeperMatchupActualRowsForWeek(input: SleeperMatchupActualRowsInput): PlayerMatchupActualInputRow[] {
  const positions = new Set((input.positions || DEFAULT_POSITIONS)
    .map(normalizeSeasonLineupPosition)
    .filter(Boolean));
  const source = input.source || 'sleeper-weekly-stats';
  const rows: PlayerMatchupActualInputRow[] = [];

  for (const [playerId, value] of Object.entries(input.stats || {})) {
    const stats = unwrapStats(value);
    const player = input.players?.[playerId];
    const rawPosition = normalizeSeasonLineupPosition(player?.position || stats?.pos || stats?.position);
    if (!stats || !rawPosition || !positions.has(rawPosition)) continue;

    const actualFantasyPoints = getSleeperFantasyPoints(stats, input.scoringSettings);
    if (!hasPlayed(stats, actualFantasyPoints) || actualFantasyPoints === null) continue;

    const { team, source: teamSource } = getHistoricalTeam({
      playerId,
      season: input.season,
      week: input.week,
      player,
      stats,
      teamMaps: input.teamMaps,
      allowPlayerMetadataTeamFallback: input.allowPlayerMetadataTeamFallback,
    });
    if (!team) continue;

    const position = normalizeMatchupPosition(rawPosition);
    if (!position) continue;

    rows.push({
      season: input.season,
      week: input.week,
      playerId,
      teamDefenseId: rawPosition === 'DEF' ? playerId : null,
      playerName: playerName(player),
      team,
      position,
      actualFantasyPoints,
      projectedFantasyPoints: input.projectedFantasyPointsByPlayerId?.[playerId] ?? null,
      targets: statNumber(stats, ['rec_tgt', 'targets', 'tgt']),
      carries: statNumber(stats, ['rush_att', 'carries']),
      receptions: statNumber(stats, ['rec', 'receptions']),
      passAttempts: statNumber(stats, ['pass_att']),
      passingYards: statNumber(stats, ['pass_yd']),
      passingTouchdowns: statNumber(stats, ['pass_td']),
      interceptions: statNumber(stats, ['pass_int']),
      rushAttempts: statNumber(stats, ['rush_att']),
      rushingYards: statNumber(stats, ['rush_yd']),
      rushingTouchdowns: statNumber(stats, ['rush_td']),
      receivingYards: statNumber(stats, ['rec_yd']),
      receivingTouchdowns: statNumber(stats, ['rec_td']),
      routes: statNumber(stats, ['routes', 'rec_route', 'pass_route']),
      offenseSnapPct: snapShare(stats),
      source: buildSourceLabel(source, teamSource),
    });
  }

  return rows.sort((a, b) => (
    String(a.position || '').localeCompare(String(b.position || ''))
    || String(a.playerName || a.playerId || '').localeCompare(String(b.playerName || b.playerId || ''))
  ));
}

export function buildSleeperMatchupActualRowsForSeason(input: SleeperSeasonMatchupActualRowsInput): PlayerMatchupActualInputRow[] {
  return (input.weeks || []).flatMap((weekSnapshot) => buildSleeperMatchupActualRowsForWeek({
    season: weekSnapshot.season,
    week: weekSnapshot.week,
    stats: weekSnapshot.values,
    players: input.players,
    scoringSettings: input.scoringSettings,
    positions: input.positions,
    projectedFantasyPointsByPlayerId: input.projectedFantasyPointsByPlayerId,
    teamMaps: input.teamMaps,
    allowPlayerMetadataTeamFallback: input.allowPlayerMetadataTeamFallback,
    source: input.source,
  }));
}
