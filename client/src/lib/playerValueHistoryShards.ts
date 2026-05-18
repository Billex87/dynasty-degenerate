import type { PlayerDetails } from '@shared/types';

type PlayerValueTimeline = NonNullable<PlayerDetails['valueTimeline']>;
type TimelineWindowKey = NonNullable<PlayerValueTimeline['selectedWindow']>;
type TimelineWindow = NonNullable<NonNullable<PlayerValueTimeline['windows']>[TimelineWindowKey]>;
type TimelinePoint = PlayerValueTimeline['points'][number];

type StaticTimelineFormat = {
  format: string;
  rawPointCount: number;
  asOfPoints?: TimelinePoint[];
  windows: Record<TimelineWindowKey, TimelineWindow>;
  extremes?: PlayerValueTimeline['extremes'];
  yearlyExtremes?: PlayerValueTimeline['yearlyExtremes'];
};

type StaticTimelinePlayer = {
  key: string;
  name: string;
  position?: string | null;
  lookupKeys?: string[];
  formats: Record<string, StaticTimelineFormat>;
};

type StaticTimelineShard = {
  players?: Record<string, StaticTimelinePlayer>;
};

const shardCache = new Map<string, Promise<StaticTimelineShard | null>>();
const WINDOW_POINT_LIMITS: Record<TimelineWindowKey, number> = {
  '1m': 12,
  '3m': 18,
  '6m': 26,
  '1y': 38,
  all: 72,
};
const TIMELINE_WINDOW_DEFINITIONS: Array<{ key: TimelineWindowKey; label: string; days: number | null }> = [
  { key: '1m', label: '1M', days: 31 },
  { key: '3m', label: '3M', days: 92 },
  { key: '6m', label: '6M', days: 183 },
  { key: '1y', label: '1Y', days: 366 },
  { key: 'all', label: 'All', days: null },
];

function getShardBaseUrl() {
  const configured = String(import.meta.env.VITE_VALUE_HISTORY_SHARDS_BASE_URL || '').trim();
  return (configured || '/assets/value-history/player-value-history-shards').replace(/\/+$/, '');
}

function cleanName(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getShardKey(value: string) {
  return cleanName(value).slice(0, 2) || '__';
}

function getPlayerNameVariants(playerName: string) {
  const normalized = cleanName(playerName);
  return Array.from(new Set([
    normalized,
    normalized.replace(/jr$/, ''),
    normalized.replace(/sr$/, ''),
    normalized.replace(/ii$/, ''),
    normalized.replace(/iii$/, ''),
    normalized.replace(/iv$/, ''),
  ].filter(Boolean)));
}

async function fetchShard(shardKey: string): Promise<StaticTimelineShard | null> {
  if (typeof fetch !== 'function') return null;
  const baseUrl = getShardBaseUrl();
  const cacheKey = `${baseUrl}:${shardKey}`;
  const cached = shardCache.get(cacheKey);
  if (cached) return cached;

  const request = fetch(`${baseUrl}/${shardKey}.json`, {
    cache: 'no-cache',
  })
    .then(response => {
      if (!response.ok) {
        shardCache.delete(cacheKey);
        return null;
      }
      return response.json() as Promise<StaticTimelineShard>;
    })
    .catch(() => {
      shardCache.delete(cacheKey);
      return null;
    });

  shardCache.set(cacheKey, request);
  return request;
}

function findPlayerInShard(shard: StaticTimelineShard | null, playerName: string) {
  const variants = getPlayerNameVariants(playerName);
  const players = shard?.players || {};
  for (const [key, player] of Object.entries(players)) {
    const keys = new Set([
      key,
      player.key,
      cleanName(player.name),
      ...(player.lookupKeys || []),
    ].map(cleanName).filter(Boolean));
    if (variants.some(variant => keys.has(variant))) return player;
  }
  return null;
}

function getPreferredTimelineFormats(
  valueProfileKey: string,
  leagueValueMode: 'dynasty' | 'redraft' | 'keeper'
) {
  const key = String(valueProfileKey || '').toLowerCase();
  if (leagueValueMode === 'redraft') {
    return ['redraft_ppr', 'ros_ppr', 'fantasypros_adp_ppr', 'sf_ppr', 'one_qb_ppr'];
  }

  const qbPrefix = key.includes('one_qb') ? 'one_qb' : 'sf';
  const tep = key.match(/tep_(0_5|1_0|1_5)/)?.[1] || '';
  return [
    key,
    tep ? `${qbPrefix}_ppr_tep_${tep}` : '',
    `${qbPrefix}_ppr`,
    qbPrefix === 'sf' ? 'superflex' : 'oneqb',
    qbPrefix === 'sf' ? 'one_qb_ppr' : 'sf_ppr',
  ].filter(Boolean);
}

function getTimelineFormatPointCount(format: StaticTimelineFormat) {
  const windowPointCounts = Object.values(format.windows || {}).map((window) => window.pointCount || window.points?.length || 0);
  return Math.max(format.rawPointCount || 0, ...windowPointCounts, 0);
}

function isRichTimelineFormat(
  format: StaticTimelineFormat,
  leagueValueMode: 'dynasty' | 'redraft' | 'keeper'
) {
  if (leagueValueMode === 'redraft') return true;
  return getTimelineFormatPointCount(format) >= 10;
}

function selectTimelineFormat(
  player: StaticTimelinePlayer,
  valueProfileKey: string,
  leagueValueMode: 'dynasty' | 'redraft' | 'keeper'
) {
  const formats = player.formats || {};
  for (const format of getPreferredTimelineFormats(valueProfileKey, leagueValueMode)) {
    if (formats[format] && isRichTimelineFormat(formats[format], leagueValueMode)) return formats[format];
  }

  const richFallback = Object.values(formats)
    .filter((format) => isRichTimelineFormat(format, leagueValueMode))
    .sort((a, b) => getTimelineFormatPointCount(b) - getTimelineFormatPointCount(a))[0];
  if (richFallback) return richFallback;

  for (const format of getPreferredTimelineFormats(valueProfileKey, leagueValueMode)) {
    if (formats[format]) return formats[format];
  }
  return Object.values(formats).sort((a, b) => (b.rawPointCount || 0) - (a.rawPointCount || 0))[0] || null;
}

function selectTimelineWindow(
  windows: Record<TimelineWindowKey, TimelineWindow>,
  preferredWindow?: TimelineWindowKey
): TimelineWindowKey {
  if (preferredWindow && windows[preferredWindow]) return preferredWindow;
  if (windows['6m']) return '6m';
  if (windows['3m']) return '3m';
  if (windows['1y']) return '1y';
  if (windows.all) return 'all';
  return (Object.keys(windows)[0] as TimelineWindowKey) || 'all';
}

function dateMinusDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
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

function getAllTimelinePoints(format: StaticTimelineFormat): TimelinePoint[] {
  if (format.asOfPoints?.length) return format.asOfPoints;
  const pointsByDate = new Map<string, TimelinePoint>();
  Object.values(format.windows || {}).forEach((window) => {
    (window.points || []).forEach((point) => pointsByDate.set(point.date, point));
  });
  return Array.from(pointsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function buildDerivedWindow(
  definition: { key: TimelineWindowKey; label: string; days: number | null },
  baseWindow: TimelineWindow | undefined,
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
    label: baseWindow?.label || definition.label,
    days: baseWindow?.days ?? definition.days,
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

function buildTimelineWindows(format: StaticTimelineFormat): Record<TimelineWindowKey, TimelineWindow> {
  const allPoints = getAllTimelinePoints(format);
  return Object.fromEntries(
    TIMELINE_WINDOW_DEFINITIONS.flatMap((definition) => {
      const baseWindow = format.windows?.[definition.key];
      const derivedWindow = buildDerivedWindow(definition, baseWindow, allPoints);
      if (derivedWindow) return [[definition.key, derivedWindow]];
      if (baseWindow) return [[definition.key, baseWindow]];
      return [];
    })
  ) as Record<TimelineWindowKey, TimelineWindow>;
}

function sourceSignature(sources?: string[]) {
  return (sources || []).slice().sort().join('|');
}

function mergeFallbackEvents(
  windows: Record<TimelineWindowKey, TimelineWindow>,
  fallbackTimeline?: PlayerValueTimeline | null
) {
  const fallbackLastPoint = fallbackTimeline?.points?.[fallbackTimeline.points.length - 1];
  const events = fallbackLastPoint?.events || [];
  if (!events.length) return windows;
  const fallbackDate = fallbackLastPoint?.date;

  return Object.fromEntries(
    Object.entries(windows || {}).map(([key, window]) => {
      const points = (window.points || []).map(point => ({ ...point }));
      if (points.length) {
        const eventIndex = fallbackDate ? points.findIndex(point => point.date === fallbackDate) : -1;
        const targetIndex = eventIndex >= 0 ? eventIndex : points.length - 1;
        points[targetIndex] = { ...points[targetIndex], events };
      }
      return [key, { ...window, points }];
    })
  ) as Record<TimelineWindowKey, TimelineWindow>;
}

export async function loadStaticPlayerValueTimeline(input: {
  playerName: string;
  valueProfileKey: string;
  leagueValueMode?: 'dynasty' | 'redraft' | 'keeper';
  selectedWindow?: TimelineWindowKey;
  fallbackTimeline?: PlayerValueTimeline | null;
}): Promise<PlayerValueTimeline | null> {
  const variants = getPlayerNameVariants(input.playerName);
  for (const variant of variants) {
    const shard = await fetchShard(getShardKey(variant));
    const player = findPlayerInShard(shard, input.playerName);
    if (!player) continue;
    const format = selectTimelineFormat(
      player,
      input.valueProfileKey,
      input.leagueValueMode || 'dynasty'
    );
    if (!format?.windows) return null;

    const windows = mergeFallbackEvents(buildTimelineWindows(format), input.fallbackTimeline);
    const selectedWindow = selectTimelineWindow(windows, input.selectedWindow);
    const selected = windows[selectedWindow] || windows.all || Object.values(windows)[0];
    if (!selected?.points?.length) return null;
    const start = selected.points[0];
    const end = selected.points[selected.points.length - 1];

    return {
      profileKey: input.valueProfileKey,
      source: 'historical-value-index',
      selectedWindow,
      availableWindows: Object.values(windows).map(window => ({
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
      extremes: format.extremes,
      yearlyExtremes: format.yearlyExtremes || [],
      allTimePointCount: format.rawPointCount || selected.pointCount,
      points: selected.points,
      summary: {
        startValue: start.value,
        endValue: end.value,
        delta: selected.delta,
        deltaPct: selected.deltaPct,
        sourceSetChanged: sourceSignature(start.sources) !== sourceSignature(end.sources),
        eventCount: input.fallbackTimeline?.summary?.eventCount || 0,
        note: input.fallbackTimeline?.summary?.note || 'Historical value archive loaded from static shards.',
      },
    };
  }

  return null;
}
