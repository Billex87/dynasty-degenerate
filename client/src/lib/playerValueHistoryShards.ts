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
  if (!shardCache.has(cacheKey)) {
    shardCache.set(cacheKey, fetch(`${baseUrl}/${shardKey}.json`, {
      cache: 'force-cache',
    })
      .then(response => response.ok ? response.json() as Promise<StaticTimelineShard> : null)
      .catch(() => null));
  }
  return shardCache.get(cacheKey) || null;
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

function selectTimelineFormat(
  player: StaticTimelinePlayer,
  valueProfileKey: string,
  leagueValueMode: 'dynasty' | 'redraft' | 'keeper'
) {
  const formats = player.formats || {};
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

function sourceSignature(sources?: string[]) {
  return (sources || []).slice().sort().join('|');
}

function mergeFallbackEvents(
  format: StaticTimelineFormat,
  fallbackTimeline?: PlayerValueTimeline | null
) {
  const fallbackLastPoint = fallbackTimeline?.points?.[fallbackTimeline.points.length - 1];
  const events = fallbackLastPoint?.events || [];
  if (!events.length) return format.windows;
  const fallbackDate = fallbackLastPoint?.date;

  return Object.fromEntries(
    Object.entries(format.windows || {}).map(([key, window]) => {
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

    const windows = mergeFallbackEvents(format, input.fallbackTimeline);
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
