import { NFL_TEAM_CODES, type NflTeamCode } from './nflTeamCodes';
import {
  buildNflScheduleCoverageDiagnostics,
  getNflScheduleSnapshotDiagnostics,
  type NflScheduleCoverageDiagnostics,
  type NflScheduleSnapshotPayload,
} from './nflScheduleSnapshots';
import type {
  PlayerProjectionPosition,
  PlayerProjectionSnapshotPayload,
  PlayerProjectionSnapshotRow,
} from './playerProjectionSnapshots';

export type SnapshotHealthStatus = 'ready' | 'warning' | 'blocked';

export type ScheduleSnapshotHealthDiagnostic = {
  status: SnapshotHealthStatus;
  season: string | null;
  source: string | null;
  sourceVersion: string | null;
  sourceTimestamp: string | null;
  fetchedAt: string | null;
  publishedAt: string | null;
  rowCount: number;
  checksum: string | null;
  checksumChanged: boolean | null;
  gamesPerWeek: Record<number, number>;
  missingTeamCount: number;
  missingTeamsByWeek: Record<number, NflTeamCode[]>;
  byeWeeksByTeam: Partial<Record<NflTeamCode, number[]>>;
  coverage: NflScheduleCoverageDiagnostics;
  parserWarnings: string[];
  note: string;
};

export type ProjectionSnapshotHealthDiagnostic = {
  status: SnapshotHealthStatus;
  season: string | null;
  week: number | null;
  source: string | null;
  projectionType: string | null;
  scoringProfile: string | null;
  sourceVersion: string | null;
  sourceTimestamp: string | null;
  fetchedAt: string | null;
  publishedAt: string | null;
  providerUpdatedAt: string | null;
  rowCount: number;
  checksum: string | null;
  checksumChanged: boolean | null;
  coverageByPosition: Record<string, number>;
  coverageByTeam: Record<string, number>;
  coverageBySource: Record<string, number>;
  staleRows: number;
  missingStarterCount: number | null;
  duplicateIdentityCount: number;
  duplicateSourcePlayerIds: string[];
  duplicatePlayerIds: string[];
  scoringProfileGaps: string[];
  sourceErrorCount: number;
  quarantinedRows: number;
  parserWarnings: string[];
  note: string;
};

export type ProjectionSnapshotDiffMove = {
  playerId: string | null;
  sourcePlayerId: string | null;
  playerName: string;
  team: string | null;
  position: PlayerProjectionPosition;
  previousProjectedFantasyPoints: number | null;
  currentProjectedFantasyPoints: number | null;
  delta: number | null;
  percentDelta: number | null;
  injuryChanged: boolean;
  teamChanged: boolean;
  positionChanged: boolean;
};

export type ProjectionSnapshotTeamShift = {
  team: string;
  playerCount: number;
  averageDelta: number;
  totalDelta: number;
};

export type ProjectionSnapshotDiffDiagnostic = {
  status: SnapshotHealthStatus;
  previousSnapshotKey: string | null;
  currentSnapshotKey: string | null;
  comparedRows: number;
  addedRows: number;
  removedRows: number;
  biggestPlayerMoves: ProjectionSnapshotDiffMove[];
  teamLevelShifts: ProjectionSnapshotTeamShift[];
  injuryDrivenChanges: ProjectionSnapshotDiffMove[];
  suspiciousProviderSwings: ProjectionSnapshotDiffMove[];
  parserWarnings: string[];
  note: string;
};

const PROJECTION_STALE_HOURS: Record<string, number> = {
  weekly: 72,
  rest_of_season: 168,
  preseason: 336,
  playoff_weeks: 168,
};

function dateValue(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function ageHours(value: string | null | undefined, now: Date): number | null {
  const timestamp = dateValue(value);
  if (!timestamp) return null;
  return Math.max(0, Math.round(((now.getTime() - new Date(timestamp).getTime()) / (60 * 60 * 1000)) * 10) / 10);
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function groupCount<T extends string | number | null | undefined>(values: T[]): Record<string, number> {
  return values.reduce((result, value) => {
    const key = String(value || 'UNKNOWN');
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {} as Record<string, number>);
}

function getSourceTimestamp(snapshot?: {
  providerUpdatedAt?: string | null;
  publishedAt?: string | null;
  fetchedAt?: string | null;
} | null): string | null {
  return dateValue(snapshot?.providerUpdatedAt || null)
    || dateValue(snapshot?.publishedAt || null)
    || dateValue(snapshot?.fetchedAt || null);
}

function getTeamsByWeek(snapshot: NflScheduleSnapshotPayload): Map<number, Set<NflTeamCode>> {
  const teamsByWeek = new Map<number, Set<NflTeamCode>>();
  for (const row of snapshot.rows) {
    const teams = teamsByWeek.get(row.week) || new Set<NflTeamCode>();
    teams.add(row.homeTeam);
    teams.add(row.awayTeam);
    teamsByWeek.set(row.week, teams);
  }
  return teamsByWeek;
}

function getMissingTeamsByWeek(snapshot: NflScheduleSnapshotPayload): Record<number, NflTeamCode[]> {
  const teamsByWeek = getTeamsByWeek(snapshot);
  const result: Record<number, NflTeamCode[]> = {};
  for (const [week, teams] of Array.from(teamsByWeek.entries())) {
    const missing = NFL_TEAM_CODES.filter((team) => !teams.has(team));
    if (missing.length) result[week] = missing;
  }
  return result;
}

function getByeWeeksByTeam(snapshot: NflScheduleSnapshotPayload): Partial<Record<NflTeamCode, number[]>> {
  const teamsByWeek = getTeamsByWeek(snapshot);
  const result: Partial<Record<NflTeamCode, number[]>> = {};
  for (const [week, teams] of Array.from(teamsByWeek.entries())) {
    for (const team of NFL_TEAM_CODES) {
      if (teams.has(team)) continue;
      result[team] = [...(result[team] || []), week];
    }
  }
  return result;
}

export function buildScheduleSnapshotHealthDiagnostic(input: {
  snapshot?: NflScheduleSnapshotPayload | null;
  previousSnapshot?: NflScheduleSnapshotPayload | null;
  sleeperWeeks?: Array<string | number | null | undefined>;
  providerProjectionWeeks?: Array<string | number | null | undefined>;
}): ScheduleSnapshotHealthDiagnostic {
  const snapshot = input.snapshot || null;
  const coverage = buildNflScheduleCoverageDiagnostics({
    snapshot,
    season: snapshot?.rows[0]?.season || null,
    sleeperWeeks: input.sleeperWeeks,
    providerProjectionWeeks: input.providerProjectionWeeks,
  });
  const baseDiagnostics = getNflScheduleSnapshotDiagnostics(snapshot);

  if (!snapshot) {
    return {
      status: 'blocked',
      season: null,
      source: null,
      sourceVersion: null,
      sourceTimestamp: null,
      fetchedAt: null,
      publishedAt: null,
      rowCount: 0,
      checksum: null,
      checksumChanged: null,
      gamesPerWeek: {},
      missingTeamCount: 32,
      missingTeamsByWeek: {},
      byeWeeksByTeam: {},
      coverage,
      parserWarnings: [baseDiagnostics.note],
      note: 'No schedule snapshot is available; projection-specific schedule claims must stay disabled.',
    };
  }

  const gamesPerWeek = snapshot.rows.reduce((result, row) => {
    result[row.week] = (result[row.week] || 0) + 1;
    return result;
  }, {} as Record<number, number>);
  const missingTeamsByWeek = getMissingTeamsByWeek(snapshot);
  const parserWarnings = [
    baseDiagnostics.status === 'invalid' ? baseDiagnostics.note : null,
    snapshot.rowCount !== snapshot.rows.length ? 'Snapshot rowCount does not match normalized row length.' : null,
    Object.entries(gamesPerWeek).some(([, count]) => count < 14) ? 'At least one visible schedule week has fewer than 14 games.' : null,
    Object.entries(gamesPerWeek).some(([, count]) => count > 16) ? 'At least one visible schedule week has more than 16 games.' : null,
    coverage.status !== 'ready' ? coverage.note : null,
    snapshot.rows.some((row) => !row.startsAt) ? 'Some games are missing kickoff timestamps.' : null,
  ].filter((item): item is string => Boolean(item));
  const status: SnapshotHealthStatus = baseDiagnostics.status === 'invalid' || snapshot.rowCount === 0
    ? 'blocked'
    : parserWarnings.length
      ? 'warning'
      : 'ready';

  return {
    status,
    season: baseDiagnostics.season,
    source: snapshot.source,
    sourceVersion: snapshot.sourceVersion,
    sourceTimestamp: getSourceTimestamp(snapshot),
    fetchedAt: dateValue(snapshot.fetchedAt),
    publishedAt: dateValue(snapshot.publishedAt),
    rowCount: snapshot.rowCount,
    checksum: snapshot.checksum,
    checksumChanged: input.previousSnapshot ? input.previousSnapshot.checksum !== snapshot.checksum : null,
    gamesPerWeek,
    missingTeamCount: baseDiagnostics.missingTeamCount,
    missingTeamsByWeek,
    byeWeeksByTeam: getByeWeeksByTeam(snapshot),
    coverage,
    parserWarnings,
    note: status === 'ready'
      ? 'Schedule snapshot is healthy enough for gated projection joins.'
      : status === 'warning'
        ? 'Schedule snapshot loaded with warnings; cap or suppress affected readouts.'
        : 'Schedule snapshot is not safe for projection-driven readouts.',
  };
}

function rowFreshnessSource(row: PlayerProjectionSnapshotRow, snapshot: PlayerProjectionSnapshotPayload): string | null {
  return row.providerUpdatedAt || row.publishedAt || snapshot.providerUpdatedAt || snapshot.publishedAt || snapshot.fetchedAt;
}

function countStaleProjectionRows(snapshot: PlayerProjectionSnapshotPayload, now: Date): number {
  const maxAge = PROJECTION_STALE_HOURS[snapshot.projectionType] || 168;
  if (snapshot.staleReason) return snapshot.rows.length;
  return snapshot.rows.filter((row) => {
    const hours = ageHours(rowFreshnessSource(row, snapshot), now);
    return hours !== null && hours > maxAge;
  }).length;
}

export function buildProjectionSnapshotHealthDiagnostic(input: {
  snapshot?: PlayerProjectionSnapshotPayload | null;
  previousSnapshot?: PlayerProjectionSnapshotPayload | null;
  expectedScoringProfiles?: string[];
  now?: Date;
}): ProjectionSnapshotHealthDiagnostic {
  const snapshot = input.snapshot || null;
  const now = input.now || new Date();

  if (!snapshot) {
    return {
      status: 'blocked',
      season: null,
      week: null,
      source: null,
      projectionType: null,
      scoringProfile: null,
      sourceVersion: null,
      sourceTimestamp: null,
      fetchedAt: null,
      publishedAt: null,
      providerUpdatedAt: null,
      rowCount: 0,
      checksum: null,
      checksumChanged: null,
      coverageByPosition: {},
      coverageByTeam: {},
      coverageBySource: {},
      staleRows: 0,
      missingStarterCount: null,
      duplicateIdentityCount: 0,
      duplicateSourcePlayerIds: [],
      duplicatePlayerIds: [],
      scoringProfileGaps: input.expectedScoringProfiles || [],
      sourceErrorCount: 0,
      quarantinedRows: 0,
      parserWarnings: ['No projection snapshot is available.'],
      note: 'Projection-driven readouts must stay disabled until a normalized projection snapshot exists.',
    };
  }

  const scoringProfileGaps = (input.expectedScoringProfiles || [])
    .filter((profile) => profile.toUpperCase() !== snapshot.scoringProfile.toUpperCase());
  const staleRows = countStaleProjectionRows(snapshot, now);
  const sourceErrorCount = [
    snapshot.sourceError,
    ...snapshot.quarantinedRows.map((row) => row.sourceError),
  ].filter(Boolean).length;
  const parserWarnings = [
    snapshot.sourceError ? `Projection source error: ${snapshot.sourceError}.` : null,
    snapshot.staleReason ? `Projection snapshot stale: ${snapshot.staleReason}.` : null,
    snapshot.rowCount !== snapshot.rows.length ? 'Snapshot rowCount does not match normalized row length.' : null,
    staleRows ? `${staleRows} projection rows are stale for ${snapshot.projectionType}.` : null,
    snapshot.missingStarterCount ? `${snapshot.missingStarterCount} expected starters are missing.` : null,
    snapshot.identityDiagnostics.ambiguousRows ? `${snapshot.identityDiagnostics.ambiguousRows} ambiguous projection identities were detected.` : null,
    snapshot.identityDiagnostics.missingIdentityRows ? `${snapshot.identityDiagnostics.missingIdentityRows} projection identities are missing.` : null,
    snapshot.identityDiagnostics.duplicatePlayerIds.length ? 'Duplicate Sleeper player IDs exist in the projection snapshot.' : null,
    snapshot.identityDiagnostics.duplicateSourcePlayerIds.length ? 'Duplicate provider player IDs exist in the projection snapshot.' : null,
    scoringProfileGaps.length ? `Missing expected scoring profiles: ${scoringProfileGaps.join(', ')}.` : null,
    sourceErrorCount ? `${sourceErrorCount} source or row errors were captured.` : null,
  ].filter((item): item is string => Boolean(item));
  const status: SnapshotHealthStatus = snapshot.sourceError || snapshot.rowCount === 0
    ? 'blocked'
    : parserWarnings.length
      ? 'warning'
      : 'ready';

  return {
    status,
    season: snapshot.season,
    week: snapshot.week,
    source: snapshot.source,
    projectionType: snapshot.projectionType,
    scoringProfile: snapshot.scoringProfile,
    sourceVersion: snapshot.sourceVersion,
    sourceTimestamp: getSourceTimestamp(snapshot),
    fetchedAt: dateValue(snapshot.fetchedAt),
    publishedAt: dateValue(snapshot.publishedAt),
    providerUpdatedAt: dateValue(snapshot.providerUpdatedAt),
    rowCount: snapshot.rowCount,
    checksum: snapshot.checksum,
    checksumChanged: input.previousSnapshot ? input.previousSnapshot.checksum !== snapshot.checksum : null,
    coverageByPosition: { ...snapshot.positionCoverage },
    coverageByTeam: groupCount(snapshot.rows.map((row) => row.team)),
    coverageBySource: groupCount(snapshot.rows.map((row) => row.source)),
    staleRows,
    missingStarterCount: snapshot.missingStarterCount,
    duplicateIdentityCount: snapshot.identityDiagnostics.duplicatePlayerIds.length + snapshot.identityDiagnostics.duplicateSourcePlayerIds.length,
    duplicateSourcePlayerIds: snapshot.identityDiagnostics.duplicateSourcePlayerIds,
    duplicatePlayerIds: snapshot.identityDiagnostics.duplicatePlayerIds,
    scoringProfileGaps,
    sourceErrorCount,
    quarantinedRows: snapshot.quarantinedRows.length,
    parserWarnings,
    note: status === 'ready'
      ? 'Projection snapshot is healthy enough for admin-gated readouts.'
      : status === 'warning'
        ? 'Projection snapshot loaded with warnings; cap confidence until the issues are cleared.'
        : 'Projection snapshot is not safe for projection-driven readouts.',
  };
}

function playerKey(row: PlayerProjectionSnapshotRow): string {
  return row.playerId || row.sourcePlayerId || `${row.playerName}:${row.team || 'FA'}:${row.position}`.toLowerCase();
}

function getPercentDelta(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null || previous === 0) return null;
  return roundValue(((current - previous) / Math.abs(previous)) * 100);
}

function buildMove(previous: PlayerProjectionSnapshotRow, current: PlayerProjectionSnapshotRow): ProjectionSnapshotDiffMove {
  const previousPoints = previous.projectedFantasyPoints;
  const currentPoints = current.projectedFantasyPoints;
  const delta = previousPoints === null || currentPoints === null ? null : roundValue(currentPoints - previousPoints);
  return {
    playerId: current.playerId || previous.playerId,
    sourcePlayerId: current.sourcePlayerId || previous.sourcePlayerId,
    playerName: current.playerName || previous.playerName,
    team: current.team || previous.team,
    position: current.position,
    previousProjectedFantasyPoints: previousPoints,
    currentProjectedFantasyPoints: currentPoints,
    delta,
    percentDelta: getPercentDelta(previousPoints, currentPoints),
    injuryChanged: (previous.injuryStatus || '') !== (current.injuryStatus || ''),
    teamChanged: (previous.team || '') !== (current.team || ''),
    positionChanged: previous.position !== current.position,
  };
}

export function diffPlayerProjectionSnapshots(input: {
  previous?: PlayerProjectionSnapshotPayload | null;
  current?: PlayerProjectionSnapshotPayload | null;
  moveLimit?: number;
  suspiciousDeltaThreshold?: number;
  suspiciousPercentThreshold?: number;
}): ProjectionSnapshotDiffDiagnostic {
  const previous = input.previous || null;
  const current = input.current || null;
  const moveLimit = input.moveLimit ?? 12;
  const suspiciousDeltaThreshold = input.suspiciousDeltaThreshold ?? 6;
  const suspiciousPercentThreshold = input.suspiciousPercentThreshold ?? 45;

  if (!previous || !current) {
    return {
      status: 'blocked',
      previousSnapshotKey: previous?.snapshotKey || null,
      currentSnapshotKey: current?.snapshotKey || null,
      comparedRows: 0,
      addedRows: current?.rows.length || 0,
      removedRows: previous?.rows.length || 0,
      biggestPlayerMoves: [],
      teamLevelShifts: [],
      injuryDrivenChanges: [],
      suspiciousProviderSwings: [],
      parserWarnings: ['Both previous and current projection snapshots are required for diff tooling.'],
      note: 'Projection diff is unavailable until two comparable snapshots are stored.',
    };
  }

  const previousByKey = new Map(previous.rows.map((row) => [playerKey(row), row]));
  const currentByKey = new Map(current.rows.map((row) => [playerKey(row), row]));
  const moves: ProjectionSnapshotDiffMove[] = [];

  for (const [key, currentRow] of Array.from(currentByKey.entries())) {
    const previousRow = previousByKey.get(key);
    if (!previousRow) continue;
    moves.push(buildMove(previousRow, currentRow));
  }

  const addedRows = current.rows.filter((row) => !previousByKey.has(playerKey(row))).length;
  const removedRows = previous.rows.filter((row) => !currentByKey.has(playerKey(row))).length;
  const biggestPlayerMoves = moves
    .filter((move) => move.delta !== null)
    .sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0))
    .slice(0, moveLimit);
  const injuryDrivenChanges = moves
    .filter((move) => move.injuryChanged)
    .sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0))
    .slice(0, moveLimit);
  const suspiciousProviderSwings = moves
    .filter((move) => {
      const absDelta = Math.abs(move.delta || 0);
      const absPct = Math.abs(move.percentDelta || 0);
      return !move.injuryChanged
        && (absDelta >= suspiciousDeltaThreshold || absPct >= suspiciousPercentThreshold);
    })
    .sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0))
    .slice(0, moveLimit);
  const teamShiftMap = new Map<string, { count: number; total: number }>();
  for (const move of moves) {
    if (move.delta === null) continue;
    const team = move.team || 'UNKNOWN';
    const item = teamShiftMap.get(team) || { count: 0, total: 0 };
    item.count += 1;
    item.total += move.delta;
    teamShiftMap.set(team, item);
  }
  const teamLevelShifts = Array.from(teamShiftMap.entries())
    .map(([team, item]) => ({
      team,
      playerCount: item.count,
      averageDelta: roundValue(item.total / item.count),
      totalDelta: roundValue(item.total),
    }))
    .sort((a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta))
    .slice(0, moveLimit);
  const parserWarnings = [
    previous.source !== current.source ? 'Projection diff compares two different sources.' : null,
    previous.scoringProfile !== current.scoringProfile ? 'Projection diff compares different scoring profiles.' : null,
    previous.projectionType !== current.projectionType ? 'Projection diff compares different projection types.' : null,
    suspiciousProviderSwings.length ? `${suspiciousProviderSwings.length} suspicious projection swings need review.` : null,
  ].filter((item): item is string => Boolean(item));
  const status: SnapshotHealthStatus = parserWarnings.some((warning) => /different/.test(warning))
    ? 'warning'
    : 'ready';

  return {
    status,
    previousSnapshotKey: previous.snapshotKey,
    currentSnapshotKey: current.snapshotKey,
    comparedRows: moves.length,
    addedRows,
    removedRows,
    biggestPlayerMoves,
    teamLevelShifts,
    injuryDrivenChanges,
    suspiciousProviderSwings,
    parserWarnings,
    note: status === 'ready'
      ? 'Projection diff is available for admin review.'
      : 'Projection diff loaded with compatibility warnings; review before trusting movement reads.',
  };
}
