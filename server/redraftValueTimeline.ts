import fs from 'node:fs';
import path from 'node:path';
import { cleanName, playerNameKeyVariants } from './leagueAnalysis';
import type { PlayerDetails } from '../shared/types';

const DEFAULT_REDFRAFT_VALUE_SHARDS_DIR = path.join(
  process.cwd(),
  'server',
  'redraft-value-history',
  'player-redraft-value-shards'
);

type TimelinePoint = NonNullable<NonNullable<PlayerDetails['valueTimeline']>['points']>[number];
type TimelineWindowKey = '1m' | '3m' | '6m' | '1y' | 'all';
type TimelineWindow = NonNullable<NonNullable<PlayerDetails['valueTimeline']>['windows']>[TimelineWindowKey];

type RedraftArchivePoint = {
  date: string;
  season?: string | null;
  phase?: string | null;
  source: string;
  sourceKey?: string | null;
  rankingType: string;
  scoring?: string | null;
  value: number;
  overallRank?: number | null;
  positionRank?: string | null;
  expertCount?: number | null;
  averageRank?: number | null;
};

type RedraftArchivePlayer = {
  key: string;
  name: string;
  position?: string | null;
  team?: string | null;
  points?: RedraftArchivePoint[];
};

type RedraftShard = {
  generatedAt?: string;
  players?: RedraftArchivePlayer[];
};

type RedraftTimelineScopeKey = 'CURRENT' | 'DRAFT' | 'ADP' | 'ROS';

type RedraftTimelineScope = {
  key: RedraftTimelineScopeKey;
  label: string;
  sourceLabel: string;
  latest: TimelinePoint | null;
  high: TimelinePoint | null;
  low: TimelinePoint | null;
  pointCount: number;
  selectedWindow: TimelineWindowKey;
  availableWindows: NonNullable<NonNullable<PlayerDetails['valueTimeline']>['availableWindows']>;
  windows: NonNullable<PlayerDetails['valueTimeline']>['windows'];
  points: TimelinePoint[];
  summary: NonNullable<PlayerDetails['valueTimeline']>['summary'];
};

export type RedraftValueTimelinePayload = {
  playerName: string;
  matchedName: string;
  position?: string | null;
  team?: string | null;
  generatedAt?: string | null;
  source: 'redraft-value-history-shards';
  scopes: RedraftTimelineScope[];
};

const WINDOW_DEFINITIONS: Array<{ key: TimelineWindowKey; label: string; days: number | null }> = [
  { key: '1m', label: '1M', days: 31 },
  { key: '3m', label: '3M', days: 92 },
  { key: '6m', label: '6M', days: 183 },
  { key: '1y', label: '1Y', days: 366 },
  { key: 'all', label: 'All', days: null },
];

const WINDOW_POINT_LIMITS: Record<TimelineWindowKey, number> = {
  '1m': 12,
  '3m': 18,
  '6m': 26,
  '1y': 38,
  all: 72,
};

const SCOPE_LABELS: Record<RedraftTimelineScopeKey, string> = {
  CURRENT: 'Current',
  DRAFT: 'Draft',
  ADP: 'ADP',
  ROS: 'ROS',
};

const SOURCE_PRIORITY: Record<RedraftTimelineScopeKey, string[]> = {
  CURRENT: ['Dynasty Degen Redraft Blend', 'FantasyPros', 'MFL Rankings', 'NFL Fantasy', 'ESPN Fantasy'],
  DRAFT: ['FantasyPros'],
  ADP: ['FantasyPros', 'MFL ADP', 'ESPN Fantasy'],
  ROS: ['FantasyPros'],
};

const shardCache = new Map<string, RedraftShard | null>();
const REDRAFT_VALUE_SHARD_CACHE_MAX_ENTRIES = 128;

function getShardsDir() {
  return process.env.REDRAFT_VALUE_HISTORY_SHARDS_DIR || DEFAULT_REDFRAFT_VALUE_SHARDS_DIR;
}

function normalizeLookupKey(value?: string | null) {
  return cleanName(String(value || ''));
}

function stripSuffixKey(value: string) {
  return value.replace(/(jr|sr|ii|iii|iv|v)$/i, '');
}

function getLookupVariants(playerName: string) {
  const variants = new Set(
    playerNameKeyVariants(normalizeLookupKey(playerName))
      .map(normalizeLookupKey)
      .filter(Boolean)
  );
  Array.from(variants).forEach((variant) => variants.add(stripSuffixKey(variant)));
  return Array.from(variants).filter(Boolean);
}

function getShardKey(value: string) {
  return normalizeLookupKey(value).slice(0, 1) || '_';
}

function setRedraftShardCache(cacheKey: string, value: RedraftShard | null) {
  while (shardCache.size >= REDRAFT_VALUE_SHARD_CACHE_MAX_ENTRIES) {
    const oldestCacheKey = shardCache.keys().next().value;
    if (!oldestCacheKey) break;
    shardCache.delete(oldestCacheKey);
  }
  shardCache.set(cacheKey, value);
}

function loadShard(shardKey: string): RedraftShard | null {
  const cacheKey = `${getShardsDir()}:${shardKey}`;
  if (shardCache.has(cacheKey)) return shardCache.get(cacheKey) || null;

  const shardPath = path.join(getShardsDir(), `${shardKey}.json`);
  if (!fs.existsSync(shardPath)) {
    setRedraftShardCache(cacheKey, null);
    return null;
  }

  try {
    const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8')) as RedraftShard;
    setRedraftShardCache(cacheKey, shard);
    return shard;
  } catch (error) {
    console.warn(`[RedraftValueTimeline] Failed to load shard ${shardKey}:`, error);
    setRedraftShardCache(cacheKey, null);
    return null;
  }
}

function playerMatches(player: RedraftArchivePlayer, variants: Set<string>) {
  const keys = new Set([
    player.key,
    normalizeLookupKey(player.name),
    stripSuffixKey(normalizeLookupKey(player.name)),
    ...getLookupVariants(player.name),
  ].map(normalizeLookupKey).filter(Boolean));
  return Array.from(variants).some((variant) => keys.has(variant) || keys.has(stripSuffixKey(variant)));
}

function findMatchingPlayers(playerName: string) {
  const variants = new Set(getLookupVariants(playerName));
  const shardKeys = new Set(Array.from(variants).map(getShardKey));
  const matches = new Map<string, RedraftArchivePlayer>();

  for (const shardKey of Array.from(shardKeys)) {
    const shard = loadShard(shardKey);
    for (const player of shard?.players || []) {
      if (!playerMatches(player, variants)) continue;
      matches.set(player.key, player);
    }
  }

  return Array.from(matches.values());
}

function getPointScope(point: RedraftArchivePoint): RedraftTimelineScopeKey | null {
  const rankingType = String(point.rankingType || '').toUpperCase();
  if (rankingType === 'CURRENT') return 'CURRENT';
  if (rankingType === 'DRAFT') return 'DRAFT';
  if (rankingType === 'ADP') return 'ADP';
  if (rankingType === 'ROS') return 'ROS';
  return null;
}

function getSourceRank(scope: RedraftTimelineScopeKey, source: string) {
  const priority = SOURCE_PRIORITY[scope] || [];
  const index = priority.indexOf(source);
  return index >= 0 ? index : priority.length + 1;
}

function toTimelinePoint(point: RedraftArchivePoint): TimelinePoint {
  return {
    date: point.date,
    value: Math.round(Number(point.value || 0)),
    rank: point.positionRank || null,
    overallRank: point.overallRank ?? null,
    sources: [point.source].filter(Boolean),
    sourceCount: 1,
  };
}

function pickBestDatePoint(scope: RedraftTimelineScopeKey, points: RedraftArchivePoint[]) {
  return [...points].sort((a, b) => {
    const sourceRank = getSourceRank(scope, a.source) - getSourceRank(scope, b.source);
    if (sourceRank) return sourceRank;
    const expertRank = Number(b.expertCount || 0) - Number(a.expertCount || 0);
    if (expertRank) return expertRank;
    return Number(b.value || 0) - Number(a.value || 0);
  })[0];
}

function compactPoints<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const keepIndexes = new Set<number>([0, points.length - 1]);
  const innerSlots = Math.max(0, maxPoints - keepIndexes.size);
  for (let index = 1; index <= innerSlots; index += 1) {
    keepIndexes.add(Math.round((index * (points.length - 1)) / (innerSlots + 1)));
  }
  return points.filter((_, index) => keepIndexes.has(index));
}

function dateMinusDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function buildWindow(
  definition: { key: TimelineWindowKey; label: string; days: number | null },
  points: TimelinePoint[]
): TimelineWindow | null {
  const latestDate = points.at(-1)?.date;
  if (!latestDate) return null;
  const startDate = definition.days ? dateMinusDays(latestDate, definition.days) : '';
  const filtered = points.filter((point) => !startDate || point.date >= startDate);
  if (filtered.length < 2) return null;

  const compacted = compactPoints(filtered, WINDOW_POINT_LIMITS[definition.key]);
  const start = compacted[0];
  const end = compacted[compacted.length - 1];
  const delta = end.value - start.value;
  return {
    key: definition.key,
    label: definition.label,
    days: definition.days,
    pointCount: filtered.length,
    startDate: start.date,
    endDate: end.date,
    startValue: start.value,
    endValue: end.value,
    delta,
    deltaPct: start.value ? Math.round((delta / start.value) * 1000) / 10 : null,
    points: compacted,
  };
}

function sourceSignature(point?: TimelinePoint | null) {
  return (point?.sources || []).slice().sort().join('|');
}

function buildScope(scope: RedraftTimelineScopeKey, archivePoints: RedraftArchivePoint[]): RedraftTimelineScope | null {
  const byDate = new Map<string, RedraftArchivePoint[]>();
  for (const point of archivePoints) {
    if (!point.date || !Number.isFinite(Number(point.value))) continue;
    if (!byDate.has(point.date)) byDate.set(point.date, []);
    byDate.get(point.date)?.push(point);
  }

  const points = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, datePoints]) => toTimelinePoint(pickBestDatePoint(scope, datePoints)))
    .filter((point) => point.value > 0);
  if (!points.length) return null;

  const windows = Object.fromEntries(
    WINDOW_DEFINITIONS.flatMap((definition) => {
      const window = buildWindow(definition, points);
      return window ? [[definition.key, window]] : [];
    })
  ) as NonNullable<PlayerDetails['valueTimeline']>['windows'];
  const selectedWindow: TimelineWindowKey = windows?.['6m']
    ? '6m'
    : windows?.['3m']
      ? '3m'
      : windows?.['1y']
        ? '1y'
        : windows?.all
          ? 'all'
          : 'all';
  const selectedPoints = windows?.[selectedWindow]?.points || compactPoints(points, WINDOW_POINT_LIMITS.all);
  const start = selectedPoints[0];
  const end = selectedPoints[selectedPoints.length - 1];
  const allHigh = points.reduce((best, point) => point.value > best.value ? point : best, points[0]);
  const allLow = points.reduce((best, point) => point.value < best.value ? point : best, points[0]);
  const selectedDelta = end.value - start.value;
  const sourceSetChanged = sourceSignature(start) !== sourceSignature(end);

  return {
    key: scope,
    label: SCOPE_LABELS[scope],
    sourceLabel: SOURCE_PRIORITY[scope][0] || 'Redraft archive',
    latest: points.at(-1) || null,
    high: allHigh,
    low: allLow,
    pointCount: points.length,
    selectedWindow,
    availableWindows: Object.values(windows || {}).map((window) => ({
      key: window.key,
      label: window.label,
      days: window.days,
      pointCount: window.pointCount,
      startDate: window.startDate,
      endDate: window.endDate,
      startValue: window.startValue,
      endValue: window.endValue,
      delta: window.delta,
      deltaPct: window.deltaPct,
    })),
    windows,
    points: selectedPoints,
    summary: {
      startValue: start.value,
      endValue: end.value,
      delta: selectedDelta,
      deltaPct: start.value ? Math.round((selectedDelta / start.value) * 1000) / 10 : null,
      sourceSetChanged,
      eventCount: 0,
      note: `${SCOPE_LABELS[scope]} redraft movement from the frozen local value-history archive. This is read from player shards and does not call providers during user loads.`,
    },
  };
}

export function getRedraftValueTimelineForPlayer(playerName: string): RedraftValueTimelinePayload | null {
  const matches = findMatchingPlayers(playerName);
  if (!matches.length) return null;

  const allPoints = matches.flatMap((player) => player.points || []);
  const pointsByScope = new Map<RedraftTimelineScopeKey, RedraftArchivePoint[]>();
  for (const point of allPoints) {
    const scope = getPointScope(point);
    if (!scope) continue;
    if (!pointsByScope.has(scope)) pointsByScope.set(scope, []);
    pointsByScope.get(scope)?.push(point);
  }

  const scopes = (['CURRENT', 'DRAFT', 'ADP', 'ROS'] as RedraftTimelineScopeKey[])
    .map((scope) => buildScope(scope, pointsByScope.get(scope) || []))
    .filter((scope): scope is RedraftTimelineScope => Boolean(scope));
  if (!scopes.length) return null;

  const primary = Array.from(matches).sort((a, b) => (b.points?.length || 0) - (a.points?.length || 0))[0];
  const shardDates = Array.from(
    new Set(matches.flatMap((player) => (player.points || []).map((point: RedraftArchivePoint) => point.date)).filter(Boolean))
  ).sort();

  return {
    playerName,
    matchedName: primary.name,
    position: primary.position || null,
    team: primary.team || null,
    generatedAt: shardDates.at(-1) || null,
    source: 'redraft-value-history-shards',
    scopes,
  };
}

export function clearRedraftValueTimelineCacheForTests() {
  shardCache.clear();
}
