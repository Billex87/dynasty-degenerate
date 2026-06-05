import { loadFantasyProsEndpointSnapshot, getFantasyProsEndpointSnapshotSourceKey, type FantasyProsEndpointSnapshotPayload } from './fantasyProsEndpointSnapshots';
import { getFantasyProsRollingWeeks, type FantasyProsWeeklyEcrPosition } from './fantasyProsHealth';
import { getCurrentRankingSeason } from './rankingSeason';

type FantasyProsScoring = 'STD' | 'HALF' | 'PPR';
type FantasyProsSnapshotStatus = 'loaded' | 'empty' | 'missing';

export interface FantasyProsSnapshotSummary {
  sourceKey: string;
  endpointKey: string;
  source: string;
  status: FantasyProsSnapshotStatus;
  rowCount: number;
  totalExperts: number | null;
  lastUpdated: string | null;
  publishedAt: string | null;
  fetchedAt: string | null;
}

export interface FantasyProsConsensusSnapshotRow {
  fantasyProsId: string;
  name: string;
  position: string | null;
  team: string | null;
  rankEcr: number | null;
  positionRank: string | null;
  bestRank: number | null;
  worstRank: number | null;
  averageRank: number | null;
  rankStdDev: number | null;
  byeWeek: number | null;
  season: string;
  scoring: FantasyProsScoring;
  week: number | null;
  lastUpdated: string | null;
}

export interface FantasyProsProjectionSnapshotRow {
  fantasyProsId: string;
  name: string;
  position: string | null;
  team: string | null;
  projectedPoints: number | null;
  season: string;
  scoring: FantasyProsScoring;
  week: number | null;
  statLines: Record<string, number>;
}

export interface FantasyProsPlayerPointsSnapshotRow {
  fantasyProsId: string;
  name: string;
  position: string | null;
  team: string | null;
  games: number | null;
  points: number | null;
  average: number | null;
  weeks: Record<string, number>;
  season: string;
  scoring: FantasyProsScoring;
}

export interface FantasyProsPlayerReferenceSnapshotRow {
  fantasyProsId: string;
  name: string;
  position: string | null;
  team: string | null;
  age: number | null;
  birthdate: string | null;
  sourceUrl: string | null;
  externalIds: Record<string, string>;
}

export interface FantasyProsCompareSnapshotRow {
  fantasyProsId: string;
  scoring: string;
  rankingType: string | null;
  position: string | null;
  expertRankCount: number;
  bestRank: number | null;
  worstRank: number | null;
  averageRank: number | null;
}

export interface FantasyProsNewsSnapshotRow {
  fantasyProsId: string | null;
  name: string | null;
  position: string | null;
  team: string | null;
  title: string | null;
  category: string | null;
  source: string | null;
  url: string | null;
  publishedAt: string | null;
}

export interface FantasyProsInjurySnapshotRow {
  fantasyProsId: string | null;
  name: string | null;
  position: string | null;
  team: string | null;
  status: string | null;
  injury: string | null;
  practiceStatus: string | null;
  gameStatus: string | null;
  updatedAt: string | null;
}

export interface FantasyProsSnapshotContext {
  generatedAt: string;
  season: string;
  scoring: FantasyProsScoring;
  summaries: FantasyProsSnapshotSummary[];
  rowCounts: Array<{ sourceKey: string; rowCount: number | null }>;
  weeklyEcrByFantasyProsId: Record<string, FantasyProsConsensusSnapshotRow>;
  waiverWireByFantasyProsId: Record<string, FantasyProsConsensusSnapshotRow>;
  projectionsByFantasyProsId: Record<string, FantasyProsProjectionSnapshotRow>;
  playerPointsByFantasyProsId: Record<string, FantasyProsPlayerPointsSnapshotRow>;
  playersByFantasyProsId: Record<string, FantasyProsPlayerReferenceSnapshotRow>;
  comparePlayersByFantasyProsId: Record<string, FantasyProsCompareSnapshotRow>;
  draftRankingsByFantasyProsId: Record<string, FantasyProsConsensusSnapshotRow>;
  rosRankingsByFantasyProsId: Record<string, FantasyProsConsensusSnapshotRow>;
  dynastyRankingsByFantasyProsId: Record<string, FantasyProsConsensusSnapshotRow>;
  devyRankingsByFantasyProsId: Record<string, FantasyProsConsensusSnapshotRow>;
  rookieRankingsByFantasyProsId: Record<string, FantasyProsConsensusSnapshotRow>;
  adpByFantasyProsId: Record<string, FantasyProsConsensusSnapshotRow>;
  dynastyAdpByFantasyProsId: Record<string, FantasyProsConsensusSnapshotRow>;
  rookieAdpByFantasyProsId: Record<string, FantasyProsConsensusSnapshotRow>;
  newsRows: FantasyProsNewsSnapshotRow[];
  newsByFantasyProsId: Record<string, FantasyProsNewsSnapshotRow[]>;
  injuriesByFantasyProsId: Record<string, FantasyProsInjurySnapshotRow>;
  weeklyEcrByPositionWeek: Record<string, Record<string, Record<string, FantasyProsConsensusSnapshotRow>>>;
}

export type FantasyProsExternalIdIndex = Record<string, Record<string, string>>;

const SNAPSHOT_ENDPOINT_KEYS = [
  'fantasypros-draft',
  'fantasypros-ros',
  'fantasypros-dynasty',
  'fantasypros-devy',
  'fantasypros-rookies',
  'fantasypros-adp',
  'fantasypros-dynadp',
  'fantasypros-rkadp',
  'fantasypros-weekly-ecr',
  'fantasypros-ww',
  'fantasypros-projections',
  'fantasypros-player-points',
  'fantasypros-players',
  'fantasypros-news',
  'fantasypros-injuries',
  'fantasypros-compare-players',
] as const;

type SnapshotEndpointKey = string;

function weeklyEcrEndpointKey(position: FantasyProsWeeklyEcrPosition, week: number): string {
  return `fantasypros-weekly-ecr-${position.toLowerCase()}-week-${week}`;
}

const DEFAULT_WEEKLY_ECR_POSITIONS: FantasyProsWeeklyEcrPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

function getWeeklyEcrPositions(positions?: FantasyProsWeeklyEcrPosition[]): FantasyProsWeeklyEcrPosition[] {
  const normalized = (positions || DEFAULT_WEEKLY_ECR_POSITIONS)
    .map((position) => String(position || '').trim().toUpperCase())
    .filter((position): position is FantasyProsWeeklyEcrPosition =>
      position === 'QB' || position === 'RB' || position === 'WR' || position === 'TE' || position === 'K' || position === 'DST'
    );
  return normalized.length ? Array.from(new Set(normalized)) : DEFAULT_WEEKLY_ECR_POSITIONS;
}

function getSnapshotEndpointKeys(input: {
  currentWeek?: number;
  weekWindow?: number;
  weeklyEcrPositions?: FantasyProsWeeklyEcrPosition[];
}): string[] {
  const weeklyEcrKeys = getFantasyProsRollingWeeks(input.currentWeek, input.weekWindow)
    .flatMap((week) => getWeeklyEcrPositions(input.weeklyEcrPositions).map((position) => weeklyEcrEndpointKey(position, week)));
  return Array.from(new Set([...SNAPSHOT_ENDPOINT_KEYS, ...weeklyEcrKeys]));
}

function stringField(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function buildFantasyProsExternalIdIndex(
  context: Pick<FantasyProsSnapshotContext, 'playersByFantasyProsId'> | null | undefined
): FantasyProsExternalIdIndex {
  const index: FantasyProsExternalIdIndex = Object.create(null);
  for (const [fantasyProsId, row] of Object.entries(context?.playersByFantasyProsId || {})) {
    for (const [rawSource, rawValue] of Object.entries(row.externalIds || {})) {
      const source = normalizeExternalIdSource(rawSource);
      const value = stringField(rawValue);
      if (!source || !value) continue;
      index[source] ||= Object.create(null);
      if (!index[source][value]) index[source][value] = fantasyProsId;
    }
  }
  return index;
}

export function findFantasyProsIdByExternalId(
  index: FantasyProsExternalIdIndex | null | undefined,
  source: string,
  id: unknown
): string | null {
  const normalizedSource = normalizeExternalIdSource(source);
  const normalizedId = stringField(id);
  if (!normalizedSource || !normalizedId) return null;
  return index?.[normalizedSource]?.[normalizedId] || null;
}

function normalizeExternalIdSource(source: string): string | null {
  const normalized = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_id$/, '');
  return normalized || null;
}

function numberField(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function recordField(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function fantasyProsId(row: Record<string, unknown>): string | null {
  return stringField(row.player_id)
    || stringField(row.fpid)
    || stringField(row.fp_player_id)
    || stringField(row.fantasypros_player_id)
    || stringField(row.id);
}

function playerName(row: Record<string, unknown>): string | null {
  return stringField(row.player_name)
    || stringField(row.name)
    || stringField(row.full_name)
    || stringField(row.short_name);
}

function playerPosition(row: Record<string, unknown>): string | null {
  return stringField(row.player_position_id)
    || stringField(row.position_id)
    || stringField(row.position);
}

function playerTeam(row: Record<string, unknown>): string | null {
  return stringField(row.player_team_id)
    || stringField(row.team_id)
    || stringField(row.team);
}

function playerRows(snapshot: FantasyProsEndpointSnapshotPayload | null | undefined): Array<Record<string, unknown>> {
  const data = recordField(snapshot?.data);
  return Array.isArray(data?.players)
    ? data.players.filter((row): row is Record<string, unknown> => Boolean(recordField(row)))
    : [];
}

function rowsForKey(snapshot: FantasyProsEndpointSnapshotPayload | null | undefined, key: string): Array<Record<string, unknown>> {
  const data = recordField(snapshot?.data);
  const rows = data?.[key];
  return Array.isArray(rows)
    ? rows.filter((row): row is Record<string, unknown> => Boolean(recordField(row)))
    : [];
}

function snapshotWeek(snapshot: FantasyProsEndpointSnapshotPayload): number | null {
  const data = recordField(snapshot.data);
  return numberField(data?.week);
}

function snapshotSummary(input: {
  endpointKey: SnapshotEndpointKey;
  season: string;
  scoring: FantasyProsScoring;
  snapshot: FantasyProsEndpointSnapshotPayload | null;
}): FantasyProsSnapshotSummary {
  const sourceKey = getFantasyProsEndpointSnapshotSourceKey({
    endpointKey: input.endpointKey,
    season: input.season,
    scoring: input.scoring,
  });
  if (!input.snapshot) {
    return {
      sourceKey,
      endpointKey: input.endpointKey,
      source: input.endpointKey,
      status: 'missing',
      rowCount: 0,
      totalExperts: null,
      lastUpdated: null,
      publishedAt: null,
      fetchedAt: null,
    };
  }

  return {
    sourceKey,
    endpointKey: input.endpointKey,
    source: input.snapshot.endpointLabel,
    status: input.snapshot.rowCount > 0 ? 'loaded' : 'empty',
    rowCount: input.snapshot.rowCount,
    totalExperts: input.snapshot.totalExperts,
    lastUpdated: input.snapshot.lastUpdated,
    publishedAt: input.snapshot.publishedAt || input.snapshot.lastUpdated,
    fetchedAt: input.snapshot.fetchedAt,
  };
}

function normalizeConsensusSnapshot(snapshot: FantasyProsEndpointSnapshotPayload | null): Record<string, FantasyProsConsensusSnapshotRow> {
  if (!snapshot) return {};
  const values: Record<string, FantasyProsConsensusSnapshotRow> = {};
  const week = snapshotWeek(snapshot);
  for (const row of playerRows(snapshot)) {
    const id = fantasyProsId(row);
    const name = playerName(row);
    if (!id || !name) continue;
    values[id] = {
      fantasyProsId: id,
      name,
      position: playerPosition(row),
      team: playerTeam(row),
      rankEcr: numberField(row.rank_ecr),
      positionRank: stringField(row.pos_rank) || stringField(row.position_rank),
      bestRank: numberField(row.rank_min),
      worstRank: numberField(row.rank_max),
      averageRank: numberField(row.rank_ave),
      rankStdDev: numberField(row.rank_std),
      byeWeek: numberField(row.player_bye_week),
      season: snapshot.season,
      scoring: snapshot.scoring,
      week,
      lastUpdated: snapshot.lastUpdated,
    };
  }
  return values;
}

function normalizeProjectionSnapshot(snapshot: FantasyProsEndpointSnapshotPayload | null): Record<string, FantasyProsProjectionSnapshotRow> {
  if (!snapshot) return {};
  const values: Record<string, FantasyProsProjectionSnapshotRow> = {};
  const week = snapshotWeek(snapshot);
  for (const row of playerRows(snapshot)) {
    const id = fantasyProsId(row);
    const name = playerName(row);
    if (!id || !name) continue;
    const statLines: Record<string, number> = {};
    for (const [key, value] of Object.entries(row)) {
      if (/id|name|team|position|player|rank/i.test(key)) continue;
      const numeric = numberField(value);
      if (numeric !== null) statLines[key] = numeric;
    }
    values[id] = {
      fantasyProsId: id,
      name,
      position: playerPosition(row),
      team: playerTeam(row),
      projectedPoints: numberField(row.fpts)
        ?? numberField(row.points)
        ?? numberField(row.projected_points)
        ?? numberField(row.fantasy_points),
      season: snapshot.season,
      scoring: snapshot.scoring,
      week,
      statLines,
    };
  }
  return values;
}

function normalizePlayerPointsSnapshot(snapshot: FantasyProsEndpointSnapshotPayload | null): Record<string, FantasyProsPlayerPointsSnapshotRow> {
  if (!snapshot) return {};
  const values: Record<string, FantasyProsPlayerPointsSnapshotRow> = {};
  for (const row of playerRows(snapshot)) {
    const id = fantasyProsId(row);
    const name = playerName(row);
    if (!id || !name) continue;
    const weeks: Record<string, number> = {};
    const rawWeeks = recordField(row.weeks);
    for (const [week, points] of Object.entries(rawWeeks || {})) {
      const numeric = numberField(points);
      if (numeric !== null) weeks[week] = numeric;
    }
    values[id] = {
      fantasyProsId: id,
      name,
      position: playerPosition(row),
      team: playerTeam(row),
      games: numberField(row.games),
      points: numberField(row.points),
      average: numberField(row.average),
      weeks,
      season: snapshot.season,
      scoring: snapshot.scoring,
    };
  }
  return values;
}

function normalizePlayerReferenceSnapshot(snapshot: FantasyProsEndpointSnapshotPayload | null): Record<string, FantasyProsPlayerReferenceSnapshotRow> {
  if (!snapshot) return {};
  const values: Record<string, FantasyProsPlayerReferenceSnapshotRow> = {};
  for (const row of playerRows(snapshot)) {
    const id = fantasyProsId(row);
    const name = playerName(row);
    if (!id || !name) continue;
    const externalIds: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!/_id$/i.test(key) || key === 'player_id') continue;
      const idValue = stringField(value);
      if (idValue) externalIds[key] = idValue;
    }
    values[id] = {
      fantasyProsId: id,
      name,
      position: playerPosition(row),
      team: playerTeam(row),
      age: numberField(row.age),
      birthdate: stringField(row.birthdate),
      sourceUrl: stringField(row.filename) || stringField(row.player_page_url),
      externalIds,
    };
  }
  return values;
}

function normalizeComparePlayersSnapshot(snapshot: FantasyProsEndpointSnapshotPayload | null): Record<string, FantasyProsCompareSnapshotRow> {
  const data = recordField(snapshot?.data);
  const rankings = recordField(data?.rankings);
  if (!snapshot || !data || !rankings) return {};

  const values: Record<string, FantasyProsCompareSnapshotRow> = {};
  for (const [scoring, scoringRows] of Object.entries(rankings)) {
    const playerRanksById = recordField(scoringRows);
    if (!playerRanksById) continue;
    for (const [id, rankRows] of Object.entries(playerRanksById)) {
      if (!Array.isArray(rankRows)) continue;
      const ranks = rankRows
        .map((rankRow) => numberField(recordField(rankRow)?.rank))
        .filter((rank): rank is number => rank !== null);
      if (!ranks.length) continue;
      values[id] = {
        fantasyProsId: id,
        scoring,
        rankingType: stringField(data.ranking_type),
        position: stringField(data.position_id),
        expertRankCount: ranks.length,
        bestRank: Math.min(...ranks),
        worstRank: Math.max(...ranks),
        averageRank: Math.round((ranks.reduce((total, rank) => total + rank, 0) / ranks.length) * 10) / 10,
      };
    }
  }
  return values;
}

function normalizeNewsSnapshot(snapshot: FantasyProsEndpointSnapshotPayload | null): {
  rows: FantasyProsNewsSnapshotRow[];
  byFantasyProsId: Record<string, FantasyProsNewsSnapshotRow[]>;
} {
  const rows = rowsForKey(snapshot, 'news').map((row): FantasyProsNewsSnapshotRow => ({
    fantasyProsId: fantasyProsId(row),
    name: playerName(row),
    position: playerPosition(row),
    team: playerTeam(row),
    title: stringField(row.title) || stringField(row.headline),
    category: stringField(row.category) || stringField(row.type),
    source: stringField(row.source),
    url: stringField(row.url) || stringField(row.link),
    publishedAt: stringField(row.published_at) || stringField(row.publishedAt) || stringField(row.date),
  }));
  const byFantasyProsId: Record<string, FantasyProsNewsSnapshotRow[]> = {};
  for (const row of rows) {
    if (!row.fantasyProsId) continue;
    byFantasyProsId[row.fantasyProsId] ||= [];
    byFantasyProsId[row.fantasyProsId].push(row);
  }
  return { rows, byFantasyProsId };
}

function normalizeInjurySnapshot(snapshot: FantasyProsEndpointSnapshotPayload | null): Record<string, FantasyProsInjurySnapshotRow> {
  const values: Record<string, FantasyProsInjurySnapshotRow> = {};
  for (const row of rowsForKey(snapshot, 'injuries')) {
    const id = fantasyProsId(row);
    if (!id) continue;
    values[id] = {
      fantasyProsId: id,
      name: playerName(row),
      position: playerPosition(row),
      team: playerTeam(row),
      status: stringField(row.status) || stringField(row.player_status),
      injury: stringField(row.injury) || stringField(row.injury_type),
      practiceStatus: stringField(row.practice_status) || stringField(row.practiceStatus),
      gameStatus: stringField(row.game_status) || stringField(row.gameStatus),
      updatedAt: stringField(row.updated_at) || stringField(row.updatedAt) || stringField(row.last_updated),
    };
  }
  return values;
}

export function buildFantasyProsSnapshotContext(input: {
  season: string;
  scoring: FantasyProsScoring;
  snapshots: Partial<Record<string, FantasyProsEndpointSnapshotPayload | null>>;
  currentWeek?: number;
  weekWindow?: number;
  weeklyEcrPositions?: FantasyProsWeeklyEcrPosition[];
  generatedAt?: string;
}): FantasyProsSnapshotContext {
  const endpointKeys = getSnapshotEndpointKeys(input);
  const summaries = endpointKeys.map((endpointKey) => snapshotSummary({
    endpointKey,
    season: input.season,
    scoring: input.scoring,
    snapshot: input.snapshots[endpointKey] || null,
  }));
  const weeklyEcrByPositionWeek: FantasyProsSnapshotContext['weeklyEcrByPositionWeek'] = {};
  for (const week of getFantasyProsRollingWeeks(input.currentWeek, input.weekWindow)) {
    for (const position of getWeeklyEcrPositions(input.weeklyEcrPositions)) {
      const endpointKey = weeklyEcrEndpointKey(position, week);
      weeklyEcrByPositionWeek[position] ||= {};
      weeklyEcrByPositionWeek[position][String(week)] = normalizeConsensusSnapshot(input.snapshots[endpointKey] || null);
    }
  }
  const normalizedNews = normalizeNewsSnapshot(input.snapshots['fantasypros-news'] || null);

  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    season: input.season,
    scoring: input.scoring,
    summaries,
    rowCounts: summaries.map((summary) => ({
      sourceKey: summary.sourceKey,
      rowCount: summary.status === 'missing' ? null : summary.rowCount,
    })),
    weeklyEcrByFantasyProsId: normalizeConsensusSnapshot(input.snapshots['fantasypros-weekly-ecr'] || null),
    waiverWireByFantasyProsId: normalizeConsensusSnapshot(input.snapshots['fantasypros-ww'] || null),
    projectionsByFantasyProsId: normalizeProjectionSnapshot(input.snapshots['fantasypros-projections'] || null),
    playerPointsByFantasyProsId: normalizePlayerPointsSnapshot(input.snapshots['fantasypros-player-points'] || null),
    playersByFantasyProsId: normalizePlayerReferenceSnapshot(input.snapshots['fantasypros-players'] || null),
    comparePlayersByFantasyProsId: normalizeComparePlayersSnapshot(input.snapshots['fantasypros-compare-players'] || null),
    draftRankingsByFantasyProsId: normalizeConsensusSnapshot(input.snapshots['fantasypros-draft'] || null),
    rosRankingsByFantasyProsId: normalizeConsensusSnapshot(input.snapshots['fantasypros-ros'] || null),
    dynastyRankingsByFantasyProsId: normalizeConsensusSnapshot(input.snapshots['fantasypros-dynasty'] || null),
    devyRankingsByFantasyProsId: normalizeConsensusSnapshot(input.snapshots['fantasypros-devy'] || null),
    rookieRankingsByFantasyProsId: normalizeConsensusSnapshot(input.snapshots['fantasypros-rookies'] || null),
    adpByFantasyProsId: normalizeConsensusSnapshot(input.snapshots['fantasypros-adp'] || null),
    dynastyAdpByFantasyProsId: normalizeConsensusSnapshot(input.snapshots['fantasypros-dynadp'] || null),
    rookieAdpByFantasyProsId: normalizeConsensusSnapshot(input.snapshots['fantasypros-rkadp'] || null),
    newsRows: normalizedNews.rows,
    newsByFantasyProsId: normalizedNews.byFantasyProsId,
    injuriesByFantasyProsId: normalizeInjurySnapshot(input.snapshots['fantasypros-injuries'] || null),
    weeklyEcrByPositionWeek,
  };
}

export async function loadFantasyProsSnapshotContext(options: {
  season?: string;
  scoring?: FantasyProsScoring;
  currentWeek?: number;
  weekWindow?: number;
  weeklyEcrPositions?: FantasyProsWeeklyEcrPosition[];
} = {}): Promise<FantasyProsSnapshotContext> {
  const season = options.season || getCurrentRankingSeason();
  const scoring = options.scoring || 'PPR';
  const endpointKeys = getSnapshotEndpointKeys(options);
  const entries = await Promise.all(endpointKeys.map(async (endpointKey) => [
    endpointKey,
    await loadFantasyProsEndpointSnapshot({ endpointKey, season, scoring }),
  ] as const));

  return buildFantasyProsSnapshotContext({
    season,
    scoring,
    snapshots: Object.fromEntries(entries) as Partial<Record<string, FantasyProsEndpointSnapshotPayload | null>>,
    currentWeek: options.currentWeek,
    weekWindow: options.weekWindow,
    weeklyEcrPositions: options.weeklyEcrPositions,
  });
}
