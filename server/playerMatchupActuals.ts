import { normalizeNflTeamCode, type NflTeamCode } from './nflTeamCodes';
import type { MatchupScheduleSnapshotPayload, MatchupScheduleSnapshotRow } from './matchupScheduleSnapshots';
import type { NflScheduleGame, NflScheduleSnapshotPayload } from './nflScheduleSnapshots';

export type PlayerMatchupPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
export type PlayerMatchupHomeAway = 'home' | 'away' | 'neutral' | 'unknown';
export type PlayerMatchupOpponentStrength = 'soft' | 'neutral' | 'tough' | 'unknown';
export type PlayerMatchupRoleBucket = 'feature' | 'starter' | 'rotation' | 'thin' | 'unknown';
export type PlayerMatchupProjectionResult = 'beat' | 'met' | 'missed' | 'unknown';
export type PlayerMatchupRecommendation = 'boost' | 'neutral' | 'caution' | 'blocked';

export type PlayerMatchupActualInputRow = {
  season: string | number;
  week: string | number;
  playerId?: string | number | null;
  sourcePlayerId?: string | number | null;
  teamDefenseId?: string | number | null;
  playerName?: string | null;
  team?: string | null;
  position?: string | null;
  fantasyPointsPpr?: string | number | null;
  actualFantasyPoints?: string | number | null;
  projectedFantasyPoints?: string | number | null;
  targets?: string | number | null;
  carries?: string | number | null;
  receptions?: string | number | null;
  passAttempts?: string | number | null;
  passingYards?: string | number | null;
  passingTouchdowns?: string | number | null;
  interceptions?: string | number | null;
  rushAttempts?: string | number | null;
  rushingYards?: string | number | null;
  rushingTouchdowns?: string | number | null;
  receivingYards?: string | number | null;
  receivingTouchdowns?: string | number | null;
  routes?: string | number | null;
  offenseSnapPct?: string | number | null;
  snapShare?: string | number | null;
  opponent?: string | null;
  homeAway?: string | null;
  opponentRank?: string | number | null;
  matchupStars?: string | number | null;
  matchupTier?: string | null;
  source?: string | null;
};

export type PlayerMatchupActualRow = {
  rowKey: string;
  season: string;
  week: number;
  playerId: string | null;
  sourcePlayerId: string | null;
  teamDefenseId: string | null;
  playerName: string | null;
  team: NflTeamCode | null;
  position: PlayerMatchupPosition;
  actualFantasyPoints: number;
  projectedFantasyPoints: number | null;
  projectionError: number | null;
  resultVsProjection: PlayerMatchupProjectionResult;
  targets: number | null;
  carries: number | null;
  receptions: number | null;
  passAttempts: number | null;
  passingYards: number | null;
  passingTouchdowns: number | null;
  interceptions: number | null;
  rushAttempts: number | null;
  rushingYards: number | null;
  rushingTouchdowns: number | null;
  receivingYards: number | null;
  receivingTouchdowns: number | null;
  routes: number | null;
  offenseSnapPct: number | null;
  opponent: NflTeamCode | null;
  homeAway: PlayerMatchupHomeAway;
  opponentRank: number | null;
  matchupStars: number | null;
  matchupTier: string | null;
  opponentStrengthBucket: PlayerMatchupOpponentStrength;
  roleBucket: PlayerMatchupRoleBucket;
  source: string | null;
};

export type PlayerMatchupArchetypeKey = {
  position: PlayerMatchupPosition;
  roleBucket: PlayerMatchupRoleBucket;
  opponentStrengthBucket: PlayerMatchupOpponentStrength;
  homeAway: PlayerMatchupHomeAway;
};

export type PlayerMatchupArchetypeSummary = PlayerMatchupArchetypeKey & {
  summaryKey: string;
  sampleSize: number;
  avgActualFantasyPoints: number | null;
  avgProjectionError: number | null;
  beatProjectionRate: number | null;
  ceilingRate: number | null;
  floorMissRate: number | null;
  confidence: number;
  recommendation: PlayerMatchupRecommendation;
  reason: string;
};

export type PlayerMatchupFeatureCoverage = {
  actualRows: number;
  scheduleJoinedRows: number;
  matchupSnapshotJoinedRows: number;
  projectionRows: number;
  usageRows: number;
  missingOpponentRows: number;
};

export type PlayerMatchupActualsResult = {
  schemaVersion: 1;
  generatedFrom: 'weekly-player-actuals';
  rowCount: number;
  summaryCount: number;
  playerOpponentHistoryCount: number;
  rows: PlayerMatchupActualRow[];
  summaries: PlayerMatchupArchetypeSummary[];
  playerOpponentHistories: PlayerOpponentHistorySummary[];
  featureCoverage: PlayerMatchupFeatureCoverage;
};

export type BuildPlayerMatchupActualsInput = {
  actualRows: PlayerMatchupActualInputRow[];
  scheduleSnapshot?: NflScheduleSnapshotPayload | null;
  scheduleSnapshots?: NflScheduleSnapshotPayload[] | null;
  matchupSnapshots?: MatchupScheduleSnapshotPayload[] | null;
  minSampleSize?: number;
  playerOpponentMinSampleSize?: number;
};

export type FindPlayerMatchupArchetypeInput = {
  result: PlayerMatchupActualsResult;
  position?: string | null;
  homeAway?: string | null;
  opponentRank?: string | number | null;
  matchupStars?: string | number | null;
  matchupTier?: string | null;
  roleBucket?: PlayerMatchupRoleBucket | null;
};

export type PlayerOpponentHistoryGame = {
  season: string;
  week: number;
  team: NflTeamCode | null;
  opponent: NflTeamCode;
  homeAway: PlayerMatchupHomeAway;
  actualFantasyPoints: number;
  projectedFantasyPoints: number | null;
  projectionError: number | null;
  resultVsProjection: PlayerMatchupProjectionResult;
  opponentStrengthBucket: PlayerMatchupOpponentStrength;
  roleBucket: PlayerMatchupRoleBucket;
  statLine: string;
};

export type PlayerOpponentHistorySummary = {
  historyKey: string;
  playerId: string | null;
  sourcePlayerId: string | null;
  playerName: string | null;
  position: PlayerMatchupPosition;
  opponent: NflTeamCode;
  sampleSize: number;
  avgFantasyPoints: number | null;
  medianFantasyPoints: number | null;
  highFantasyPoints: number | null;
  lowFantasyPoints: number | null;
  avgProjectionError: number | null;
  beatProjectionRate: number | null;
  ceilingGameRate: number | null;
  floorGameRate: number | null;
  confidence: number;
  recommendation: PlayerMatchupRecommendation;
  reason: string;
  games: PlayerOpponentHistoryGame[];
};

export type FindPlayerOpponentHistoryInput = {
  histories: PlayerOpponentHistorySummary[];
  playerId?: string | number | null;
  sourcePlayerId?: string | number | null;
  playerName?: string | null;
  position?: string | null;
  opponent?: string | null;
};

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function intValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function cleanText(value: unknown): string | null {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean || null;
}

function cleanId(value: unknown): string | null {
  const clean = cleanText(value);
  return clean && clean !== '0' ? clean : null;
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function rate(count: number, total: number): number | null {
  return total ? round((count / total) * 100, 1) : null;
}

function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? round(sorted[middle])
    : round((sorted[middle - 1] + sorted[middle]) / 2);
}

function normalizePosition(value: unknown): PlayerMatchupPosition | null {
  const normalized = String(value || '').trim().toUpperCase().replace(/[^A-Z/]/g, '');
  if (normalized === 'DEF' || normalized === 'D/ST' || normalized === 'DST') return 'DST';
  return ['QB', 'RB', 'WR', 'TE', 'K'].includes(normalized) ? normalized as PlayerMatchupPosition : null;
}

function normalizeHomeAway(value: unknown): PlayerMatchupHomeAway {
  const normalized = String(value || '').trim().toLowerCase();
  if (['home', 'h', '@home'].includes(normalized)) return 'home';
  if (['away', 'a', '@'].includes(normalized)) return 'away';
  if (['neutral', 'n'].includes(normalized)) return 'neutral';
  return 'unknown';
}

function normalizeSnapPct(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  return parsed > 1 ? round(parsed / 100, 4) : parsed;
}

function getScheduleGame(row: PlayerMatchupActualInputRow, scheduleSnapshots?: Array<NflScheduleSnapshotPayload | null | undefined>): NflScheduleGame | null {
  const season = String(row.season);
  const week = intValue(row.week);
  const team = normalizeNflTeamCode(row.team);
  if (!week || !team) return null;
  for (const scheduleSnapshot of scheduleSnapshots || []) {
    const game = scheduleSnapshot?.rows.find((candidate) => (
      candidate.season === season
      && candidate.week === week
      && (candidate.homeTeam === team || candidate.awayTeam === team)
    ));
    if (game) return game;
  }
  return null;
}

function getScheduleOpponent(game: NflScheduleGame | null, team: NflTeamCode | null): NflTeamCode | null {
  if (!game || !team) return null;
  if (game.homeTeam === team) return game.awayTeam;
  if (game.awayTeam === team) return game.homeTeam;
  return null;
}

function getScheduleHomeAway(game: NflScheduleGame | null, team: NflTeamCode | null): PlayerMatchupHomeAway {
  if (!game || !team) return 'unknown';
  if (game.neutralSite) return 'neutral';
  if (game.homeTeam === team) return 'home';
  if (game.awayTeam === team) return 'away';
  return 'unknown';
}

function matchupIdentityKey(input: {
  season: string | number;
  week: string | number;
  position?: string | null;
  playerId?: string | number | null;
  teamDefenseId?: string | number | null;
  playerName?: string | null;
  team?: string | null;
}): string {
  const position = normalizePosition(input.position) || 'DST';
  const identity = cleanId(input.playerId)
    || cleanId(input.teamDefenseId)
    || [
      cleanText(input.playerName)?.toLowerCase(),
      normalizeNflTeamCode(input.team),
    ].filter(Boolean).join(':');
  return [
    String(input.season),
    intValue(input.week) || 'all',
    position,
    identity || 'unknown',
  ].join(':');
}

function buildMatchupIndex(snapshots?: MatchupScheduleSnapshotPayload[] | null): Map<string, MatchupScheduleSnapshotRow> {
  const index = new Map<string, MatchupScheduleSnapshotRow>();
  for (const snapshot of snapshots || []) {
    for (const row of snapshot.rows || []) {
      const keys = [
        matchupIdentityKey(row),
        row.playerName ? matchupIdentityKey({ ...row, playerId: null, teamDefenseId: null }) : null,
      ].filter(Boolean) as string[];
      for (const key of keys) {
        if (!index.has(key)) index.set(key, row);
      }
    }
  }
  return index;
}

function getOpponentStrengthBucket(input: {
  opponentRank?: number | null;
  matchupStars?: number | null;
  matchupTier?: string | null;
}): PlayerMatchupOpponentStrength {
  const tier = String(input.matchupTier || '').trim().toLowerCase();
  if (['hard', 'tough', 'bad', 'red'].includes(tier)) return 'tough';
  if (['easy', 'soft', 'good', 'green', 'favorable'].includes(tier)) return 'soft';
  if (['neutral', 'average'].includes(tier)) return 'neutral';
  if (input.matchupStars !== null && input.matchupStars !== undefined) {
    if (input.matchupStars >= 4) return 'soft';
    if (input.matchupStars <= 2) return 'tough';
    return 'neutral';
  }
  if (input.opponentRank !== null && input.opponentRank !== undefined) {
    if (input.opponentRank >= 25) return 'soft';
    if (input.opponentRank <= 8) return 'tough';
    return 'neutral';
  }
  return 'unknown';
}

function getRoleBucket(input: {
  position: PlayerMatchupPosition;
  targets: number | null;
  carries: number | null;
  receptions: number | null;
  passAttempts: number | null;
  rushAttempts: number | null;
  routes: number | null;
  offenseSnapPct: number | null;
}): PlayerMatchupRoleBucket {
  const carries = input.carries ?? input.rushAttempts ?? 0;
  const targets = input.targets ?? 0;
  const receptions = input.receptions ?? 0;
  const routes = input.routes ?? 0;
  const snaps = input.offenseSnapPct ?? 0;
  const touches = carries + receptions;
  const opportunities = carries + targets;

  if (input.position === 'QB') {
    const passAttempts = input.passAttempts ?? 0;
    if (passAttempts >= 30 || snaps >= 0.8) return 'feature';
    if (passAttempts >= 20 || snaps >= 0.55) return 'starter';
    if (passAttempts >= 8 || snaps > 0) return 'rotation';
    return 'unknown';
  }
  if (input.position === 'K' || input.position === 'DST') {
    return 'starter';
  }
  if (snaps >= 0.7 || touches >= 18 || targets >= 9 || routes >= 32) return 'feature';
  if (snaps >= 0.5 || touches >= 10 || targets >= 6 || routes >= 22) return 'starter';
  if (snaps >= 0.25 || touches >= 4 || targets >= 3 || routes >= 10) return 'rotation';
  if (snaps > 0 || touches > 0 || opportunities > 0 || routes > 0) return 'thin';
  return 'unknown';
}

function getResultVsProjection(actual: number, projected: number | null): PlayerMatchupProjectionResult {
  if (projected === null) return 'unknown';
  const diff = actual - projected;
  if (diff >= 3) return 'beat';
  if (diff <= -3) return 'missed';
  return 'met';
}

function buildRowKey(row: PlayerMatchupActualRow): string {
  return [
    row.season,
    row.week,
    row.position,
    row.playerId || row.sourcePlayerId || row.teamDefenseId || row.playerName || 'unknown-player',
    row.team || 'FA',
  ].join(':');
}

function getScheduleSnapshots(input: BuildPlayerMatchupActualsInput): NflScheduleSnapshotPayload[] {
  return [
    input.scheduleSnapshot || null,
    ...(input.scheduleSnapshots || []),
  ].filter((snapshot): snapshot is NflScheduleSnapshotPayload => Boolean(snapshot));
}

export function buildPlayerMatchupActualRows(input: BuildPlayerMatchupActualsInput): PlayerMatchupActualRow[] {
  const matchupIndex = buildMatchupIndex(input.matchupSnapshots);
  const scheduleSnapshots = getScheduleSnapshots(input);
  const rows: PlayerMatchupActualRow[] = [];
  const seen = new Set<string>();

  for (const actual of input.actualRows || []) {
    const season = String(actual.season);
    const week = intValue(actual.week);
    const position = normalizePosition(actual.position);
    const actualFantasyPoints = finiteNumber(actual.actualFantasyPoints ?? actual.fantasyPointsPpr);
    if (!week || !position || actualFantasyPoints === null) continue;

    const team = normalizeNflTeamCode(actual.team);
    const scheduleGame = getScheduleGame(actual, scheduleSnapshots);
    const matchup = matchupIndex.get(matchupIdentityKey(actual)) || null;
    const explicitHomeAway = normalizeHomeAway(actual.homeAway || matchup?.homeAway);
    const opponent = normalizeNflTeamCode(actual.opponent)
      || matchup?.opponent
      || getScheduleOpponent(scheduleGame, team);
    const homeAway = explicitHomeAway === 'unknown' ? getScheduleHomeAway(scheduleGame, team) : explicitHomeAway;
    const opponentRank = finiteNumber(actual.opponentRank ?? matchup?.opponentRank);
    const matchupStars = finiteNumber(actual.matchupStars ?? matchup?.matchupStars);
    const matchupTier = cleanText(actual.matchupTier ?? matchup?.matchupTier);
    const targets = finiteNumber(actual.targets);
    const carries = finiteNumber(actual.carries);
    const receptions = finiteNumber(actual.receptions);
    const passAttempts = finiteNumber(actual.passAttempts);
    const passingYards = finiteNumber(actual.passingYards);
    const passingTouchdowns = finiteNumber(actual.passingTouchdowns);
    const interceptions = finiteNumber(actual.interceptions);
    const rushAttempts = finiteNumber(actual.rushAttempts);
    const rushingYards = finiteNumber(actual.rushingYards);
    const rushingTouchdowns = finiteNumber(actual.rushingTouchdowns);
    const receivingYards = finiteNumber(actual.receivingYards);
    const receivingTouchdowns = finiteNumber(actual.receivingTouchdowns);
    const routes = finiteNumber(actual.routes);
    const offenseSnapPct = normalizeSnapPct(actual.offenseSnapPct ?? actual.snapShare);
    const projectedFantasyPoints = finiteNumber(actual.projectedFantasyPoints);
    const projectionError = projectedFantasyPoints === null ? null : round(actualFantasyPoints - projectedFantasyPoints);

    const normalized: PlayerMatchupActualRow = {
      rowKey: '',
      season,
      week,
      playerId: cleanId(actual.playerId),
      sourcePlayerId: cleanId(actual.sourcePlayerId),
      teamDefenseId: cleanId(actual.teamDefenseId),
      playerName: cleanText(actual.playerName),
      team,
      position,
      actualFantasyPoints,
      projectedFantasyPoints,
      projectionError,
      resultVsProjection: getResultVsProjection(actualFantasyPoints, projectedFantasyPoints),
      targets,
      carries,
      receptions,
      passAttempts,
      passingYards,
      passingTouchdowns,
      interceptions,
      rushAttempts,
      rushingYards,
      rushingTouchdowns,
      receivingYards,
      receivingTouchdowns,
      routes,
      offenseSnapPct,
      opponent,
      homeAway,
      opponentRank,
      matchupStars,
      matchupTier,
      opponentStrengthBucket: getOpponentStrengthBucket({ opponentRank, matchupStars, matchupTier }),
      roleBucket: getRoleBucket({ position, targets, carries, receptions, passAttempts, rushAttempts, routes, offenseSnapPct }),
      source: cleanText(actual.source),
    };
    normalized.rowKey = buildRowKey(normalized);
    if (seen.has(normalized.rowKey)) continue;
    seen.add(normalized.rowKey);
    rows.push(normalized);
  }

  return rows.sort((a, b) => (
    Number(a.season) - Number(b.season)
    || a.week - b.week
    || a.position.localeCompare(b.position)
    || (a.playerName || '').localeCompare(b.playerName || '')
  ));
}

function summaryKey(key: PlayerMatchupArchetypeKey): string {
  return [
    key.position,
    key.roleBucket,
    key.opponentStrengthBucket,
    key.homeAway,
  ].join(':');
}

function buildSummary(rows: PlayerMatchupActualRow[], minSampleSize: number): PlayerMatchupArchetypeSummary {
  const [first] = rows;
  const projectedRows = rows.filter((row) => row.projectionError !== null);
  const beatRows = rows.filter((row) => row.resultVsProjection === 'beat');
  const floorMissRows = rows.filter((row) => row.projectedFantasyPoints !== null && row.actualFantasyPoints <= Math.max(5, row.projectedFantasyPoints * 0.65));
  const ceilingRows = rows.filter((row) => row.projectedFantasyPoints !== null && row.actualFantasyPoints >= Math.max(row.projectedFantasyPoints + 5, row.projectedFantasyPoints * 1.35));
  const avgActualFantasyPoints = round(rows.reduce((sum, row) => sum + row.actualFantasyPoints, 0) / rows.length);
  const avgProjectionError = projectedRows.length
    ? round(projectedRows.reduce((sum, row) => sum + (row.projectionError || 0), 0) / projectedRows.length)
    : null;
  const beatProjectionRate = rate(beatRows.length, projectedRows.length);
  const floorMissRate = rate(floorMissRows.length, projectedRows.length);
  const ceilingRate = rate(ceilingRows.length, projectedRows.length);
  const enoughSamples = rows.length >= minSampleSize;
  const projectionCoverage = projectedRows.length / rows.length;
  const sampleConfidence = Math.min(35, rows.length * 4);
  const projectionConfidence = projectedRows.length ? 25 * projectionCoverage : 8;
  const consistencyConfidence = floorMissRate === null ? 6 : Math.max(0, 20 - floorMissRate / 4);
  const confidence = Math.max(12, Math.min(92, Math.round(sampleConfidence + projectionConfidence + consistencyConfidence)));
  const recommendation: PlayerMatchupRecommendation = !enoughSamples
    ? 'blocked'
    : (beatProjectionRate || 0) >= 60 && (floorMissRate || 0) <= 30 && (avgProjectionError || 0) >= 2
      ? 'boost'
      : (floorMissRate || 0) >= 45 || (avgProjectionError || 0) <= -3
        ? 'caution'
        : 'neutral';
  const reason = recommendation === 'blocked'
    ? `Only ${rows.length} historical rows; keep this as context, not advice.`
    : recommendation === 'boost'
      ? `${first.position} ${first.roleBucket} usage has beaten projection in this ${first.opponentStrengthBucket}/${first.homeAway} archetype.`
      : recommendation === 'caution'
        ? `${first.position} ${first.roleBucket} usage has elevated miss risk in this ${first.opponentStrengthBucket}/${first.homeAway} archetype.`
        : `${first.position} ${first.roleBucket} usage has no strong historical edge in this ${first.opponentStrengthBucket}/${first.homeAway} archetype.`;

  return {
    position: first.position,
    roleBucket: first.roleBucket,
    opponentStrengthBucket: first.opponentStrengthBucket,
    homeAway: first.homeAway,
    summaryKey: summaryKey(first),
    sampleSize: rows.length,
    avgActualFantasyPoints,
    avgProjectionError,
    beatProjectionRate,
    ceilingRate,
    floorMissRate,
    confidence: enoughSamples ? confidence : Math.min(confidence, 35),
    recommendation,
    reason,
  };
}

export function summarizePlayerMatchupArchetypes(
  rows: PlayerMatchupActualRow[],
  options: { minSampleSize?: number } = {}
): PlayerMatchupArchetypeSummary[] {
  const minSampleSize = Math.max(3, options.minSampleSize || 5);
  const groups = new Map<string, PlayerMatchupActualRow[]>();
  for (const row of rows) {
    const key = summaryKey(row);
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return Array.from(groups.values())
    .map((groupRows) => buildSummary(groupRows, minSampleSize))
    .sort((a, b) => (
      b.confidence - a.confidence
      || b.sampleSize - a.sampleSize
      || a.summaryKey.localeCompare(b.summaryKey)
    ));
}

function playerOpponentIdentity(input: {
  playerId?: string | number | null;
  sourcePlayerId?: string | number | null;
  playerName?: string | null;
  position?: string | null;
}): string {
  return cleanId(input.playerId)
    || cleanId(input.sourcePlayerId)
    || [
      cleanText(input.playerName)?.toLowerCase(),
      normalizePosition(input.position),
    ].filter(Boolean).join(':')
    || 'unknown-player';
}

export function getPlayerOpponentHistoryKey(input: {
  playerId?: string | number | null;
  sourcePlayerId?: string | number | null;
  playerName?: string | null;
  position?: string | null;
  opponent?: string | null;
}): string | null {
  const position = normalizePosition(input.position);
  const opponent = normalizeNflTeamCode(input.opponent);
  if (!position || !opponent) return null;
  return [
    playerOpponentIdentity(input),
    position,
    opponent,
  ].join(':');
}

function buildPlayerOpponentStatLine(row: PlayerMatchupActualRow): string {
  const parts: string[] = [];
  if (row.position === 'QB') {
    if (row.passingYards !== null) parts.push(`${row.passingYards} pass yds`);
    if (row.passingTouchdowns !== null) parts.push(`${row.passingTouchdowns} pass TD`);
    if (row.interceptions !== null) parts.push(`${row.interceptions} INT`);
    if (row.rushingYards !== null) parts.push(`${row.rushingYards} rush yds`);
    if (row.rushingTouchdowns !== null) parts.push(`${row.rushingTouchdowns} rush TD`);
    return parts.slice(0, 5).join(' · ') || `${row.actualFantasyPoints} fantasy pts`;
  }
  if (row.position === 'RB') {
    if (row.carries !== null) parts.push(`${row.carries} carries`);
    if (row.rushingYards !== null) parts.push(`${row.rushingYards} rush yds`);
    if (row.rushingTouchdowns !== null) parts.push(`${row.rushingTouchdowns} rush TD`);
    if (row.targets !== null) parts.push(`${row.targets} targets`);
    if (row.receptions !== null) parts.push(`${row.receptions} rec`);
    return parts.slice(0, 5).join(' · ') || `${row.actualFantasyPoints} fantasy pts`;
  }
  if (row.position === 'WR' || row.position === 'TE') {
    if (row.targets !== null) parts.push(`${row.targets} targets`);
    if (row.receptions !== null) parts.push(`${row.receptions} rec`);
    if (row.receivingYards !== null) parts.push(`${row.receivingYards} rec yds`);
    if (row.receivingTouchdowns !== null) parts.push(`${row.receivingTouchdowns} rec TD`);
    if (row.rushingYards !== null) parts.push(`${row.rushingYards} rush yds`);
    return parts.slice(0, 5).join(' · ') || `${row.actualFantasyPoints} fantasy pts`;
  }
  return `${row.actualFantasyPoints} fantasy pts`;
}

function buildPlayerOpponentHistorySummary(rows: PlayerMatchupActualRow[], minSampleSize: number): PlayerOpponentHistorySummary | null {
  const cleanRows = rows.filter((row) => row.opponent);
  const [first] = cleanRows;
  if (!first?.opponent) return null;

  const fantasyPoints = cleanRows.map((row) => row.actualFantasyPoints);
  const projectedRows = cleanRows.filter((row) => row.projectionError !== null);
  const avgFantasyPoints = round(fantasyPoints.reduce((sum, value) => sum + value, 0) / fantasyPoints.length);
  const avgProjectionError = projectedRows.length
    ? round(projectedRows.reduce((sum, row) => sum + (row.projectionError || 0), 0) / projectedRows.length)
    : null;
  const beatProjectionRate = rate(projectedRows.filter((row) => row.resultVsProjection === 'beat').length, projectedRows.length);
  const ceilingThreshold = avgFantasyPoints === null ? null : avgFantasyPoints + Math.max(4, avgFantasyPoints * 0.25);
  const floorThreshold = avgFantasyPoints === null ? null : avgFantasyPoints - Math.max(4, avgFantasyPoints * 0.25);
  const ceilingGameRate = ceilingThreshold === null ? null : rate(cleanRows.filter((row) => row.actualFantasyPoints >= ceilingThreshold).length, cleanRows.length);
  const floorGameRate = floorThreshold === null ? null : rate(cleanRows.filter((row) => row.actualFantasyPoints <= floorThreshold).length, cleanRows.length);
  const sampleConfidence = Math.min(40, cleanRows.length * 8);
  const projectionCoverage = projectedRows.length / cleanRows.length;
  const projectionConfidence = projectedRows.length ? Math.round(20 * projectionCoverage) : 6;
  const consistencyPenalty = Math.min(18, Math.abs((ceilingGameRate || 0) - (floorGameRate || 0)) / 4);
  const rawConfidence = Math.round(sampleConfidence + projectionConfidence + 20 - consistencyPenalty);
  const enoughSamples = cleanRows.length >= minSampleSize;
  const recommendation: PlayerMatchupRecommendation = !enoughSamples
    ? 'blocked'
    : (beatProjectionRate || 0) >= 60 && (avgProjectionError || 0) >= 2
      ? 'boost'
      : (beatProjectionRate !== null && beatProjectionRate <= 35 && (avgProjectionError || 0) <= -2)
        ? 'caution'
        : 'neutral';
  const reason = recommendation === 'blocked'
    ? `Only ${cleanRows.length} career game${cleanRows.length === 1 ? '' : 's'} vs ${first.opponent}; show the log, but do not let it drive advice.`
    : recommendation === 'boost'
      ? `${first.playerName || 'Player'} has beaten projection in ${beatProjectionRate}% of ${cleanRows.length} career game${cleanRows.length === 1 ? '' : 's'} vs ${first.opponent}.`
      : recommendation === 'caution'
        ? `${first.playerName || 'Player'} has underperformed projection in this direct ${first.opponent} history.`
        : `${first.playerName || 'Player'} has direct ${first.opponent} history, but it is not strong enough to move the read by itself.`;

  return {
    historyKey: getPlayerOpponentHistoryKey(first) || `${playerOpponentIdentity(first)}:${first.position}:${first.opponent}`,
    playerId: first.playerId,
    sourcePlayerId: first.sourcePlayerId,
    playerName: first.playerName,
    position: first.position,
    opponent: first.opponent,
    sampleSize: cleanRows.length,
    avgFantasyPoints,
    medianFantasyPoints: median(fantasyPoints),
    highFantasyPoints: round(Math.max(...fantasyPoints)),
    lowFantasyPoints: round(Math.min(...fantasyPoints)),
    avgProjectionError,
    beatProjectionRate,
    ceilingGameRate,
    floorGameRate,
    confidence: enoughSamples ? Math.max(18, Math.min(88, rawConfidence)) : Math.min(35, rawConfidence),
    recommendation,
    reason,
    games: cleanRows
      .sort((a, b) => (
        Number(b.season) - Number(a.season)
        || b.week - a.week
      ))
      .map((row) => ({
        season: row.season,
        week: row.week,
        team: row.team,
        opponent: row.opponent as NflTeamCode,
        homeAway: row.homeAway,
        actualFantasyPoints: row.actualFantasyPoints,
        projectedFantasyPoints: row.projectedFantasyPoints,
        projectionError: row.projectionError,
        resultVsProjection: row.resultVsProjection,
        opponentStrengthBucket: row.opponentStrengthBucket,
        roleBucket: row.roleBucket,
        statLine: buildPlayerOpponentStatLine(row),
      })),
  };
}

export function summarizePlayerOpponentHistories(
  rows: PlayerMatchupActualRow[],
  options: { minSampleSize?: number } = {}
): PlayerOpponentHistorySummary[] {
  const minSampleSize = Math.max(2, options.minSampleSize || 2);
  const groups = new Map<string, PlayerMatchupActualRow[]>();
  for (const row of rows) {
    if (!row.opponent) continue;
    const key = getPlayerOpponentHistoryKey(row);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return Array.from(groups.values())
    .map((groupRows) => buildPlayerOpponentHistorySummary(groupRows, minSampleSize))
    .filter((summary): summary is PlayerOpponentHistorySummary => Boolean(summary))
    .sort((a, b) => (
      Number(b.recommendation !== 'blocked') - Number(a.recommendation !== 'blocked')
      || b.confidence - a.confidence
      || b.sampleSize - a.sampleSize
      || a.historyKey.localeCompare(b.historyKey)
    ));
}

export function findPlayerOpponentHistory(input: FindPlayerOpponentHistoryInput): PlayerOpponentHistorySummary | null {
  const key = getPlayerOpponentHistoryKey(input);
  if (!key) return null;
  return input.histories.find((history) => history.historyKey === key) || null;
}

function buildCoverage(rows: PlayerMatchupActualRow[], actualRows: PlayerMatchupActualInputRow[]): PlayerMatchupFeatureCoverage {
  return {
    actualRows: actualRows.length,
    scheduleJoinedRows: rows.filter((row) => row.opponent && row.homeAway !== 'unknown').length,
    matchupSnapshotJoinedRows: rows.filter((row) => row.opponentRank !== null || row.matchupStars !== null || row.matchupTier).length,
    projectionRows: rows.filter((row) => row.projectedFantasyPoints !== null).length,
    usageRows: rows.filter((row) => (
      row.targets !== null
      || row.carries !== null
      || row.receptions !== null
      || row.passAttempts !== null
      || row.routes !== null
      || row.offenseSnapPct !== null
    )).length,
    missingOpponentRows: rows.filter((row) => !row.opponent).length,
  };
}

export function buildPlayerMatchupActuals(input: BuildPlayerMatchupActualsInput): PlayerMatchupActualsResult {
  const rows = buildPlayerMatchupActualRows(input);
  const summaries = summarizePlayerMatchupArchetypes(rows, { minSampleSize: input.minSampleSize });
  const playerOpponentHistories = summarizePlayerOpponentHistories(rows, { minSampleSize: input.playerOpponentMinSampleSize });
  return {
    schemaVersion: 1,
    generatedFrom: 'weekly-player-actuals',
    rowCount: rows.length,
    summaryCount: summaries.length,
    playerOpponentHistoryCount: playerOpponentHistories.length,
    rows,
    summaries,
    playerOpponentHistories,
    featureCoverage: buildCoverage(rows, input.actualRows || []),
  };
}

export function findPlayerMatchupArchetype(input: FindPlayerMatchupArchetypeInput): PlayerMatchupArchetypeSummary | null {
  const position = normalizePosition(input.position);
  if (!position) return null;
  const opponentStrengthBucket = getOpponentStrengthBucket({
    opponentRank: finiteNumber(input.opponentRank),
    matchupStars: finiteNumber(input.matchupStars),
    matchupTier: input.matchupTier,
  });
  const homeAway = normalizeHomeAway(input.homeAway);
  const preferredRole = input.roleBucket || 'starter';
  const candidates = input.result.summaries.filter((summary) => (
    summary.position === position
    && summary.opponentStrengthBucket === opponentStrengthBucket
    && (summary.homeAway === homeAway || summary.homeAway === 'unknown' || homeAway === 'unknown')
    && (summary.roleBucket === preferredRole || summary.roleBucket === 'starter' || preferredRole === 'unknown')
  ));
  return candidates
    .sort((a, b) => (
      Number(b.recommendation !== 'blocked') - Number(a.recommendation !== 'blocked')
      || b.confidence - a.confidence
      || b.sampleSize - a.sampleSize
    ))
    [0] || null;
}
