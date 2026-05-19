import type { FantasyProsPlayerSourceTrace } from '../shared/types';

type FantasyProsTraceRow = Record<string, unknown>;

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
];

export function buildFantasyProsPlayerSourceTrace(
  row: FantasyProsTraceRow | null | undefined,
  options: { isRedraftProfile?: boolean } = {}
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
      label: key === 'DYNASTY' ? 'FantasyPros Dynasty' : `FantasyPros ${formatTraceKeyLabel(key)}`,
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
        fallback: 'Stored FantasyPros dynasty field contributed to the blended value profile.',
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
      label: key === 'SEASON' ? 'FantasyPros Season' : `FantasyPros ${formatTraceKeyLabel(key)}`,
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
        fallback: 'Stored FantasyPros current-season field contributed to the season value profile.',
      }),
    });
  }

  const sources = Array.isArray(row.value_sources) ? row.value_sources : [];
  const listsFantasyPros = sources.some((source) => String(source || '').toLowerCase().includes('fantasypros'));
  if (trace.length === 0 && listsFantasyPros) {
    trace.push({
      source: 'FantasyPros',
      key: inferFantasyProsKey(row, 'UNKNOWN'),
      label: 'FantasyPros Source Listing',
      sourceKey,
      endpointKey,
      scoring,
      season,
      week,
      fetchedAt,
      lastUpdated,
      status: status || 'listed-without-field-values',
      evidence: 'FantasyPros is listed in value_sources, but this value row did not preserve FantasyPros-specific value, rank, or endpoint fields.',
    });
  }

  return trace;
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
  return `${valueEvidence}; exact FantasyPros endpoint metadata was not preserved on this blended row.`;
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
