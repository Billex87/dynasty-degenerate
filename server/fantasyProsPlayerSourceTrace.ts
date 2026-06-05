import type { FantasyProsPlayerSourceTrace } from '../shared/types';
import type {
  FantasyProsExternalIdIndex,
  FantasyProsCompareSnapshotRow,
  FantasyProsConsensusSnapshotRow,
  FantasyProsInjurySnapshotRow,
  FantasyProsNewsSnapshotRow,
  FantasyProsPlayerPointsSnapshotRow,
  FantasyProsProjectionSnapshotRow,
  FantasyProsSnapshotContext,
} from './fantasyProsSnapshotContext';
import { buildFantasyProsExternalIdIndex, findFantasyProsIdByExternalId } from './fantasyProsSnapshotContext';

type FantasyProsTraceRow = Record<string, unknown>;

type FantasyProsPlayerSourceTraceOptions = {
  isRedraftProfile?: boolean;
  snapshotContext?: FantasyProsSnapshotContext | null;
  fantasyProsId?: string | null;
  fantasyProsExternalIdIndex?: FantasyProsExternalIdIndex | null;
  fantasyProsIdBySleeperId?: Record<string, string>;
  sleeperPlayerId?: string | null;
  player?: FantasyProsTraceRow | null;
};

const FANTASYPROS_KEYS = [
  'DYNADP',
  'RKADP',
  'ADP',
  'ROOKIES',
  'DEVY',
  'DYNASTY',
  'ROS',
  'DRAFT',
  'WW',
  'NEWS',
  'INJURIES',
  'PLAYER_POINTS',
  'PROJECTIONS',
  'COMPARE_PLAYERS',
];

export function buildFantasyProsPlayerSourceTrace(
  row: FantasyProsTraceRow | null | undefined,
  options: FantasyProsPlayerSourceTraceOptions = {}
): FantasyProsPlayerSourceTrace[] {
  if (!row) return [];

  const trace: FantasyProsPlayerSourceTrace[] = [];
  const isRedraftProfile = Boolean(options.isRedraftProfile);
  const sourceKey = firstString(row.fantasypros_source_key, row.sourceKey, row.source_key, row.snapshotKey);
  const endpointKey = firstString(row.fantasypros_endpoint_key, row.endpointKey, row.endpoint_key);
  const scoring = firstString(row.fantasypros_scoring, row.scoring, row.scoring_format);
  const season = firstString(row.fantasypros_season, row.season);
  const week = firstNumber(row.fantasypros_week, row.week);
  const fetchedAt = firstString(row.fantasypros_fetched_at, row.fetchedAt, row.fetched_at);
  const lastUpdated = firstString(row.fantasypros_last_updated, row.lastUpdated, row.last_updated, row.updatedAt, row.updated_at);
  const status = firstString(row.fantasypros_status, row.status, row.sourceStatus, row.source_status);

  const dynastyValue = firstNumber(row.expert_value_fantasypros, row.fantasypros_dynasty_value);
  const dynastyRank = firstNumber(row.fantasypros_dynasty_rank);
  const dynastyPositionRank = firstString(row.fantasypros_dynasty_position_rank);
  if (!isRedraftProfile && hasAnyValue(dynastyValue, dynastyRank, dynastyPositionRank)) {
    const key = inferFantasyProsKey(row, 'DYNASTY', ['DYNASTY', 'DYNADP']);
    trace.push({
      source: 'FantasyPros',
      key,
      label: key === 'DYNASTY' ? 'Dynasty ranking snapshot' : `${formatTraceKeyLabel(key)} snapshot`,
      sourceKey,
      endpointKey,
      value: dynastyValue,
      rank: dynastyRank,
      positionRank: dynastyPositionRank,
      scoring,
      season,
      week,
      fetchedAt,
      lastUpdated,
      status,
      evidence: buildEvidence({
        value: dynastyValue,
        rank: dynastyRank,
        positionRank: dynastyPositionRank,
        tier: null,
        endpointKey,
        fallback: 'Stored dynasty ranking field contributed to the blended value profile.',
      }),
    });
  }

  const seasonValue = firstNumber(row.fantasypros_season_value);
  const seasonRank = firstNumber(row.fantasypros_rank);
  const seasonPositionRank = firstString(row.fantasypros_position_rank);
  const tier = firstNumber(row.fantasypros_tier);
  if (hasAnyValue(seasonValue, seasonRank, seasonPositionRank, tier)) {
    const key = inferFantasyProsKey(row, 'SEASON', ['DRAFT', 'ROS', 'ADP', 'WW']);
    trace.push({
      source: 'FantasyPros',
      key,
      label: key === 'SEASON' ? 'Season ranking snapshot' : `${formatTraceKeyLabel(key)} snapshot`,
      sourceKey,
      endpointKey,
      value: seasonValue,
      rank: seasonRank,
      positionRank: seasonPositionRank,
      tier,
      scoring,
      season,
      week,
      fetchedAt,
      lastUpdated,
      status,
      evidence: buildEvidence({
        value: seasonValue,
        rank: seasonRank,
        positionRank: seasonPositionRank,
        tier,
        endpointKey,
        fallback: 'Stored current-season ranking field contributed to the season value profile.',
      }),
    });
  }

  appendSnapshotContextTrace(trace, row, options);

  const sources = Array.isArray(row.value_sources) ? row.value_sources : [];
  const listsFantasyPros = sources.some((source) => String(source || '').toLowerCase().includes('fantasypros'));
  if (trace.length === 0 && listsFantasyPros) {
    trace.push({
      source: 'FantasyPros',
      key: inferFantasyProsKey(row, 'UNKNOWN'),
      label: 'Stored source listing',
      sourceKey,
      endpointKey,
      scoring,
      season,
      week,
      fetchedAt,
      lastUpdated,
      status: status || 'listed-without-field-values',
      evidence: 'A stored source is listed in value_sources, but this value row did not preserve source-specific value, rank, or endpoint fields.',
    });
  }

  return trace;
}

export function buildFantasyProsIdBySleeperId(
  context: FantasyProsSnapshotContext | null | undefined
): Record<string, string> {
  return { ...(buildFantasyProsExternalIdIndex(context).sleeper || {}) };
}

function appendSnapshotContextTrace(
  trace: FantasyProsPlayerSourceTrace[],
  row: FantasyProsTraceRow,
  options: FantasyProsPlayerSourceTraceOptions
) {
  const context = options.snapshotContext;
  if (!context) return;

  const fantasyProsId = findFantasyProsId(row, options);
  if (!fantasyProsId) return;

  const seen = new Set(trace.map((item) => item.key));
  const addTrace = (item: FantasyProsPlayerSourceTrace | null) => {
    if (!item || seen.has(item.key)) return;
    seen.add(item.key);
    trace.push(item);
  };

  const projection = context.projectionsByFantasyProsId[fantasyProsId];
  addTrace(projectionTrace(projection, context, 'fantasypros-projections'));

  const playerPoints = context.playerPointsByFantasyProsId[fantasyProsId];
  addTrace(playerPointsTrace(playerPoints, context, 'fantasypros-player-points'));

  const comparePlayers = context.comparePlayersByFantasyProsId[fantasyProsId];
  addTrace(comparePlayersTrace(comparePlayers, context, 'fantasypros-compare-players'));

  addTrace(consensusTrace('DRAFT', context.draftRankingsByFantasyProsId[fantasyProsId], context, 'fantasypros-draft'));
  addTrace(consensusTrace('ROS', context.rosRankingsByFantasyProsId[fantasyProsId], context, 'fantasypros-ros'));
  addTrace(consensusTrace('ADP', context.adpByFantasyProsId[fantasyProsId], context, 'fantasypros-adp'));

  if (!options.isRedraftProfile) {
    addTrace(consensusTrace('DYNASTY', context.dynastyRankingsByFantasyProsId[fantasyProsId], context, 'fantasypros-dynasty'));
    addTrace(consensusTrace('DEVY', context.devyRankingsByFantasyProsId[fantasyProsId], context, 'fantasypros-devy'));
    addTrace(consensusTrace('ROOKIES', context.rookieRankingsByFantasyProsId[fantasyProsId], context, 'fantasypros-rookies'));
    addTrace(consensusTrace('DYNADP', context.dynastyAdpByFantasyProsId[fantasyProsId], context, 'fantasypros-dynadp'));
    addTrace(consensusTrace('RKADP', context.rookieAdpByFantasyProsId[fantasyProsId], context, 'fantasypros-rkadp'));
  }

  const news = context.newsByFantasyProsId[fantasyProsId]?.[0];
  addTrace(newsTrace(news, context, 'fantasypros-news'));

  const injury = context.injuriesByFantasyProsId[fantasyProsId];
  addTrace(injuryTrace(injury, context, 'fantasypros-injuries'));
}

function findFantasyProsId(
  row: FantasyProsTraceRow,
  options: FantasyProsPlayerSourceTraceOptions
): string | null {
  const explicitId = firstString(
    options.fantasyProsId,
    row.fantasypros_id,
    row.fantasyProsId,
    row.fantasypros_player_id,
    row.fantasyProsPlayerId,
    row.fp_player_id,
    row.fpid,
    options.player?.fantasypros_id,
    options.player?.fantasyProsId,
    options.player?.fantasypros_player_id,
    options.player?.fantasyProsPlayerId,
    options.player?.fp_player_id,
    options.player?.fpid
  );
  if (explicitId) return explicitId;

  const indexedExternalId = findFantasyProsIdFromExternalIds(row, options);
  if (indexedExternalId) return indexedExternalId;

  const sleeperId = firstString(
    options.sleeperPlayerId,
    row.sleeper_id,
    row.sleeperId,
    row.sleeper_player_id,
    row.player_id,
    options.player?.sleeper_id,
    options.player?.sleeperId,
    options.player?.player_id
  );
  if (!sleeperId) return null;

  return options.fantasyProsIdBySleeperId?.[sleeperId] || null;
}

function findFantasyProsIdFromExternalIds(
  row: FantasyProsTraceRow,
  options: FantasyProsPlayerSourceTraceOptions
): string | null {
  const index = options.fantasyProsExternalIdIndex;
  if (!index) return null;
  const playerMetadata = recordValue(options.player?.metadata);
  const candidates: Array<[string, unknown[]]> = [
    ['sleeper', [
      options.sleeperPlayerId,
      row.sleeper_id,
      row.sleeperId,
      row.sleeper_player_id,
      row.player_id,
      options.player?.sleeper_id,
      options.player?.sleeperId,
      options.player?.player_id,
    ]],
    ['espn', [
      row.espn_id,
      row.espnId,
      options.player?.espn_id,
      options.player?.espnId,
      playerMetadata?.espn_id,
      playerMetadata?.espnId,
    ]],
    ['yahoo', [
      row.yahoo_id,
      row.yahooId,
      options.player?.yahoo_id,
      options.player?.yahooId,
      playerMetadata?.yahoo_id,
      playerMetadata?.yahooId,
    ]],
    ['mfl', [row.mfl_id, row.mflId, options.player?.mfl_id, options.player?.mflId, playerMetadata?.mfl_id, playerMetadata?.mflId]],
    ['fleaflicker', [row.fleaflicker_id, row.fleaflickerId, options.player?.fleaflicker_id, options.player?.fleaflickerId, playerMetadata?.fleaflicker_id, playerMetadata?.fleaflickerId]],
    ['fantrax', [row.fantrax_id, row.fantraxId, options.player?.fantrax_id, options.player?.fantraxId, playerMetadata?.fantrax_id, playerMetadata?.fantraxId]],
    ['nfl', [row.nfl_id, row.nflId, options.player?.nfl_id, options.player?.nflId, playerMetadata?.nfl_id, playerMetadata?.nflId]],
    ['cbs', [row.cbs_id, row.cbsId, options.player?.cbs_id, options.player?.cbsId, playerMetadata?.cbs_id, playerMetadata?.cbsId]],
    ['draftkings', [row.draftkings_id, row.draftkingsId, options.player?.draftkings_id, options.player?.draftkingsId, playerMetadata?.draftkings_id, playerMetadata?.draftkingsId]],
  ];

  for (const [source, values] of candidates) {
    for (const value of values) {
      const fantasyProsId = findFantasyProsIdByExternalId(index, source, value);
      if (fantasyProsId) return fantasyProsId;
    }
  }

  return null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function projectionTrace(
  row: FantasyProsProjectionSnapshotRow | null | undefined,
  context: FantasyProsSnapshotContext,
  endpointKey: string
): FantasyProsPlayerSourceTrace | null {
  if (!row || row.projectedPoints === null) return null;
  const summary = snapshotSummary(context, endpointKey);
  return {
    source: 'FantasyPros',
    key: 'PROJECTIONS',
    label: 'Stored projections',
    sourceKey: summary?.sourceKey || null,
    endpointKey,
    value: row.projectedPoints,
    scoring: row.scoring,
    season: row.season,
    week: row.week,
    fetchedAt: summary?.fetchedAt || null,
    lastUpdated: summary?.lastUpdated || null,
    status: summary?.status || 'loaded',
    evidence: [
      `projected points ${formatNumber(row.projectedPoints)}`,
      row.week !== null ? `week ${formatNumber(row.week)}` : null,
      endpointEvidence(summary, endpointKey),
    ].filter(Boolean).join('; '),
  };
}

function playerPointsTrace(
  row: FantasyProsPlayerPointsSnapshotRow | null | undefined,
  context: FantasyProsSnapshotContext,
  endpointKey: string
): FantasyProsPlayerSourceTrace | null {
  if (!row || !hasAnyValue(row.points, row.average, row.games)) return null;
  const summary = snapshotSummary(context, endpointKey);
  const value = row.average ?? row.points;
  return {
    source: 'FantasyPros',
    key: 'PLAYER_POINTS',
    label: 'Stored player points',
    sourceKey: summary?.sourceKey || null,
    endpointKey,
    value,
    scoring: row.scoring,
    season: row.season,
    fetchedAt: summary?.fetchedAt || null,
    lastUpdated: summary?.lastUpdated || null,
    status: summary?.status || 'loaded',
    evidence: [
      row.points !== null ? `season points ${formatNumber(row.points)}` : null,
      row.average !== null ? `average ${formatNumber(row.average)}` : null,
      row.games !== null ? `games ${formatNumber(row.games)}` : null,
      endpointEvidence(summary, endpointKey),
    ].filter(Boolean).join('; '),
  };
}

function comparePlayersTrace(
  row: FantasyProsCompareSnapshotRow | null | undefined,
  context: FantasyProsSnapshotContext,
  endpointKey: string
): FantasyProsPlayerSourceTrace | null {
  if (!row || row.expertRankCount <= 0 || !hasAnyValue(row.averageRank, row.bestRank, row.worstRank)) return null;
  const summary = snapshotSummary(context, endpointKey);
  return {
    source: 'FantasyPros',
    key: 'COMPARE_PLAYERS',
    label: 'Stored expert spread',
    sourceKey: summary?.sourceKey || null,
    endpointKey,
    value: row.averageRank,
    rank: row.averageRank,
    scoring: row.scoring,
    fetchedAt: summary?.fetchedAt || null,
    lastUpdated: summary?.lastUpdated || null,
    status: summary?.status || 'loaded',
    evidence: [
      `expert rank count ${formatNumber(row.expertRankCount)}`,
      row.averageRank !== null ? `average rank ${formatNumber(row.averageRank)}` : null,
      row.bestRank !== null ? `best rank ${formatNumber(row.bestRank)}` : null,
      row.worstRank !== null ? `worst rank ${formatNumber(row.worstRank)}` : null,
      row.rankingType ? `ranking type ${truncateEvidence(row.rankingType)}` : null,
      row.position ? `position ${truncateEvidence(row.position)}` : null,
      endpointEvidence(summary, endpointKey),
    ].filter(Boolean).join('; '),
  };
}

function consensusTrace(
  key: string,
  row: FantasyProsConsensusSnapshotRow | null | undefined,
  context: FantasyProsSnapshotContext,
  endpointKey: string
): FantasyProsPlayerSourceTrace | null {
  if (!row || !hasAnyValue(row.rankEcr, row.positionRank, row.averageRank, row.byeWeek)) return null;
  const summary = snapshotSummary(context, endpointKey);
  return {
    source: 'FantasyPros',
    key,
    label: `${formatTraceKeyLabel(key)} snapshot`,
    sourceKey: summary?.sourceKey || null,
    endpointKey,
    rank: row.rankEcr,
    positionRank: row.positionRank,
    scoring: row.scoring,
    season: row.season,
    week: row.week,
    fetchedAt: summary?.fetchedAt || null,
    lastUpdated: row.lastUpdated || summary?.lastUpdated || null,
    status: summary?.status || 'loaded',
    evidence: [
      row.rankEcr !== null ? `rank #${formatNumber(row.rankEcr)}` : null,
      row.positionRank ? `position ${row.positionRank}` : null,
      row.averageRank !== null ? `average rank ${formatNumber(row.averageRank)}` : null,
      row.byeWeek !== null ? `bye ${formatNumber(row.byeWeek)}` : null,
      endpointEvidence(summary, endpointKey),
    ].filter(Boolean).join('; '),
  };
}

function newsTrace(
  row: FantasyProsNewsSnapshotRow | null | undefined,
  context: FantasyProsSnapshotContext,
  endpointKey: string
): FantasyProsPlayerSourceTrace | null {
  if (!row || !hasAnyValue(row.title, row.category, row.publishedAt)) return null;
  const summary = snapshotSummary(context, endpointKey);
  return {
    source: 'FantasyPros',
    key: 'NEWS',
    label: 'Stored news',
    sourceKey: summary?.sourceKey || null,
    endpointKey,
    fetchedAt: summary?.fetchedAt || null,
    lastUpdated: row.publishedAt || summary?.lastUpdated || null,
    status: row.category || summary?.status || 'loaded',
    evidence: [
      row.title ? `news "${truncateEvidence(row.title)}"` : null,
      row.source ? `source ${truncateEvidence(row.source)}` : null,
      row.publishedAt ? `published ${row.publishedAt}` : null,
      endpointEvidence(summary, endpointKey),
    ].filter(Boolean).join('; '),
  };
}

function injuryTrace(
  row: FantasyProsInjurySnapshotRow | null | undefined,
  context: FantasyProsSnapshotContext,
  endpointKey: string
): FantasyProsPlayerSourceTrace | null {
  if (!row || !hasAnyValue(row.status, row.injury, row.practiceStatus, row.gameStatus)) return null;
  const summary = snapshotSummary(context, endpointKey);
  return {
    source: 'FantasyPros',
    key: 'INJURIES',
    label: 'Stored injuries',
    sourceKey: summary?.sourceKey || null,
    endpointKey,
    fetchedAt: summary?.fetchedAt || null,
    lastUpdated: row.updatedAt || summary?.lastUpdated || null,
    status: row.status || row.gameStatus || summary?.status || 'loaded',
    evidence: [
      row.status ? `status ${truncateEvidence(row.status)}` : null,
      row.injury ? `injury ${truncateEvidence(row.injury)}` : null,
      row.practiceStatus ? `practice ${truncateEvidence(row.practiceStatus)}` : null,
      row.gameStatus ? `game ${truncateEvidence(row.gameStatus)}` : null,
      endpointEvidence(summary, endpointKey),
    ].filter(Boolean).join('; '),
  };
}

function snapshotSummary(context: FantasyProsSnapshotContext, endpointKey: string) {
  return context.summaries.find((summary) => summary.endpointKey === endpointKey) || null;
}

function endpointEvidence(
  summary: ReturnType<typeof snapshotSummary>,
  endpointKey: string
): string {
  return summary?.sourceKey
    ? `endpoint metadata: ${summary.sourceKey}`
    : `endpoint metadata: ${endpointKey}`;
}

function buildEvidence(input: {
  value: number | null;
  rank: number | null;
  positionRank: string | null;
  tier: number | null;
  endpointKey: string | null;
  fallback: string;
}): string {
  const parts = [
    input.value !== null ? `value ${formatNumber(input.value)}` : null,
    input.rank !== null ? `rank #${formatNumber(input.rank)}` : null,
    input.positionRank ? `position ${input.positionRank}` : null,
    input.tier !== null ? `tier ${formatNumber(input.tier)}` : null,
  ].filter(Boolean);

  const valueEvidence = parts.length > 0 ? parts.join(', ') : input.fallback;
  if (input.endpointKey) {
    return `${valueEvidence}; endpoint metadata: ${input.endpointKey}.`;
  }
  return `${valueEvidence}; exact endpoint metadata was not preserved on this blended row.`;
}

function inferFantasyProsKey(row: FantasyProsTraceRow, fallback: string, allowedKeys: string[] = FANTASYPROS_KEYS): string {
  const haystack = [
    row.fantasypros_key,
    row.fantasypros_type,
    row.fantasypros_ranking_type,
    row.fantasypros_source_key,
    row.fantasypros_endpoint_key,
    row.rankingType,
    row.ranking_type,
    row.type,
    row.sourceKey,
    row.source_key,
    row.endpointKey,
    row.endpoint_key,
    row.snapshotKey,
    row.importedSource,
    row.source,
  ]
    .map((value) => String(value || '').toUpperCase().replace(/[\s-]+/g, '_'))
    .join(' ');

  for (const key of FANTASYPROS_KEYS) {
    if (!allowedKeys.includes(key)) continue;
    const pattern = key === 'ADP'
      ? /(^|[^A-Z])ADP([^A-Z]|$)/
      : new RegExp(`(^|[^A-Z])${key}([^A-Z]|$)`);
    if (pattern.test(haystack)) return key;
  }

  return fallback;
}

function formatTraceKeyLabel(key: string): string {
  if (key === 'RKADP') return 'Rookie ADP';
  if (key === 'DYNADP') return 'Dynasty ADP';
  if (key === 'PLAYER_POINTS') return 'Player Points';
  if (key === 'WW') return 'Waiver Wire';
  if (['ADP', 'DEVY', 'ROS'].includes(key)) return key;
  return key.charAt(0) + key.slice(1).toLowerCase();
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function hasAnyValue(...values: unknown[]) {
  return values.some((value) => value !== null && value !== undefined && value !== '');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function truncateEvidence(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 96 ? trimmed : `${trimmed.slice(0, 93)}...`;
}
