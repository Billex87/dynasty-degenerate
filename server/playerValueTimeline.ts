import fs from 'node:fs';
import path from 'node:path';
import { cleanName, playerNameKeyVariants } from './leagueAnalysis';
import {
  listLocalKtcSnapshotDateKeysSince,
  loadLocalKtcSnapshotForDate,
} from './ktcLoader';
import type { KTCValues } from './reportGenerator';
import type { PlayerDetails } from '../shared/types';

const DEFAULT_TIMELINE_DAYS = 120;
const MAX_TIMELINE_POINTS = 24;
const DEFAULT_TIMELINE_INDEX_PATH = path.join(process.cwd(), 'server', 'value-history-archive', 'player-value-history-timeline-index.json');

type KtcValueRow = KTCValues[string];
type TimelinePoint = NonNullable<NonNullable<PlayerDetails['valueTimeline']>['points']>[number];
type TimelineEvent = NonNullable<NonNullable<PlayerDetails['valueTimeline']>['points'][number]['events']>[number];
type TimelineWindowKey = '3m' | '6m' | '1y' | 'all';
type TimelineWindow = NonNullable<NonNullable<PlayerDetails['valueTimeline']>['windows']>[TimelineWindowKey];
type TimelineIndexPlayer = {
  key: string;
  name: string;
  position?: string | null;
  lookupKeys?: string[];
  formats: Record<string, {
    format: string;
    rawPointCount: number;
    asOfPoints?: TimelinePoint[];
    windows: Record<TimelineWindowKey, NonNullable<TimelineWindow>>;
    extremes?: NonNullable<PlayerDetails['valueTimeline']>['extremes'];
    yearlyExtremes?: NonNullable<PlayerDetails['valueTimeline']>['yearlyExtremes'];
  }>;
};
type TimelineIndexCache = {
  generatedAt?: string;
  players: Record<string, TimelineIndexPlayer>;
  lookup: Map<string, TimelineIndexPlayer>;
};

let timelineIndexCache: TimelineIndexCache | null | undefined;

export type HistoricalPlayerValueLookup = {
  playerName: string;
  matchedName: string;
  format: string;
  requestedDate: string;
  valueDate: string;
  daysAway: number;
  value: number;
  rank?: string | null;
  overallRank?: number | null;
  sourceCount: number;
  sources: string[];
  source: 'historical-value-index';
};

function getPlayerDisplayName(player: Record<string, any> | undefined): string | null {
  if (!player) return null;
  return player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || null;
}

function getTimelineIndex(): TimelineIndexCache | null {
  if (process.env.NODE_ENV === 'test' && process.env.USE_VALUE_TIMELINE_INDEX !== '1') return null;
  if (timelineIndexCache !== undefined) return timelineIndexCache;
  const indexPath = process.env.VALUE_TIMELINE_INDEX_FILE || DEFAULT_TIMELINE_INDEX_PATH;
  if (!fs.existsSync(indexPath)) {
    timelineIndexCache = null;
    return timelineIndexCache;
  }

  try {
    const payload = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
      generatedAt?: string;
      players?: Record<string, TimelineIndexPlayer>;
    };
    const players = payload.players || {};
    const lookup = new Map<string, TimelineIndexPlayer>();
    for (const [key, player] of Object.entries(players)) {
      const keys = new Set([
        key,
        player.key,
        cleanName(player.name),
        ...playerNameKeyVariants(cleanName(player.name)),
        ...(player.lookupKeys || []),
      ].map(cleanName).filter(Boolean));
      keys.forEach((lookupKey) => lookup.set(lookupKey, player));
    }
    timelineIndexCache = { generatedAt: payload.generatedAt, players, lookup };
  } catch (error) {
    console.warn('[PlayerValueTimeline] Failed to load timeline index:', error);
    timelineIndexCache = null;
  }

  return timelineIndexCache;
}

function getIndexedPlayerForName(playerName: string): TimelineIndexPlayer | null {
  const index = getTimelineIndex();
  if (!index) return null;
  const variants = Array.from(new Set(playerNameKeyVariants(cleanName(playerName)).map(cleanName).filter(Boolean)));
  for (const variant of variants) {
    const match = index.lookup.get(variant);
    if (match) return match;
  }
  return null;
}

function getSnapshotRowForPlayer(
  playerName: string,
  values: KTCValues
): { key: string; data: KtcValueRow } | null {
  const variants = Array.from(
    new Set(playerNameKeyVariants(cleanName(playerName)).map(cleanName).filter(Boolean))
  );
  let best: { key: string; data: KtcValueRow; score: number } | null = null;

  for (const [key, data] of Object.entries(values || {})) {
    const keyVariants = playerNameKeyVariants(key).map(cleanName).filter(Boolean);
    if (!keyVariants.some((variant) => variants.includes(variant))) continue;

    const sourceCount = data.value_sources?.length || 0;
    const score = sourceCount * 1000 + Number(data.dynasty_value ?? data.ktc_value ?? 0);
    if (!best || score > best.score) best = { key, data, score };
  }

  return best ? { key: best.key, data: best.data } : null;
}

function getTimelineValue(row: KtcValueRow, mode: 'dynasty' | 'redraft' | 'keeper'): number | null {
  const value = mode === 'redraft'
    ? row.redraft_value ?? row.fantasypros_season_value ?? null
    : row.dynasty_value ?? row.ktc_value ?? row.true_value ?? null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
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

function getSourceSignature(sources: string[]) {
  return sources.slice().sort().join('|');
}

function getPreferredTimelineFormats(valueProfileKey: string, mode: 'dynasty' | 'redraft' | 'keeper') {
  const key = String(valueProfileKey || '').toLowerCase();
  if (mode === 'redraft') return ['redraft_ppr', 'ros_ppr', 'fantasypros_adp_ppr', 'sf_ppr', 'one_qb_ppr'];

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
  indexedPlayer: TimelineIndexPlayer,
  valueProfileKey: string,
  mode: 'dynasty' | 'redraft' | 'keeper'
) {
  const formats = indexedPlayer.formats || {};
  for (const format of getPreferredTimelineFormats(valueProfileKey, mode)) {
    if (formats[format]) return formats[format];
  }
  return Object.values(formats).sort((a, b) => (b.rawPointCount || 0) - (a.rawPointCount || 0))[0] || null;
}

function parseUtcDateKey(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
  const time = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  return Number.isFinite(time) ? time : null;
}

function daysBetween(dateA: string, dateB: string): number | null {
  const a = parseUtcDateKey(dateA);
  const b = parseUtcDateKey(dateB);
  if (a === null || b === null) return null;
  return Math.round(Math.abs(a - b) / 86_400_000);
}

export function getHistoricalPlayerValueAtDate(input: {
  playerName: string;
  date: string;
  valueProfileKey: string;
  leagueValueMode?: 'dynasty' | 'redraft' | 'keeper';
  maxDaysAway?: number;
}): HistoricalPlayerValueLookup | null {
  const mode = input.leagueValueMode || 'dynasty';
  if (mode === 'redraft') return null;
  const requestedDate = String(input.date || '').slice(0, 10);
  if (!parseUtcDateKey(requestedDate)) return null;

  const indexedPlayer = getIndexedPlayerForName(input.playerName);
  if (!indexedPlayer) return null;
  const formatTimeline = selectTimelineFormat(indexedPlayer, input.valueProfileKey, mode);
  if (!formatTimeline) return null;

  const points = (formatTimeline.asOfPoints?.length
    ? formatTimeline.asOfPoints
    : formatTimeline.windows?.all?.points || []
  ).filter((point) => parseUtcDateKey(point.date) && Number.isFinite(Number(point.value)));
  if (!points.length) return null;

  let closest: TimelinePoint | null = null;
  let closestDaysAway = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const pointDaysAway = daysBetween(requestedDate, point.date);
    if (pointDaysAway === null) continue;
    if (
      pointDaysAway < closestDaysAway ||
      (pointDaysAway === closestDaysAway && closest && point.date <= requestedDate && closest.date > requestedDate)
    ) {
      closest = point;
      closestDaysAway = pointDaysAway;
    }
  }

  if (!closest || !Number.isFinite(closestDaysAway)) return null;
  const maxDaysAway = Number(input.maxDaysAway ?? 45);
  if (maxDaysAway >= 0 && closestDaysAway > maxDaysAway) return null;

  return {
    playerName: input.playerName,
    matchedName: indexedPlayer.name,
    format: formatTimeline.format,
    requestedDate,
    valueDate: closest.date,
    daysAway: closestDaysAway,
    value: Math.round(Number(closest.value)),
    rank: closest.rank || null,
    overallRank: closest.overallRank ?? null,
    sourceCount: closest.sourceCount || closest.sources?.length || 0,
    sources: closest.sources || [],
    source: 'historical-value-index',
  };
}

function selectTimelineWindow(
  windows: Record<TimelineWindowKey, NonNullable<TimelineWindow>>,
  daysBack: number
): TimelineWindowKey {
  if (daysBack <= 100 && windows['3m']) return '3m';
  if (daysBack <= 220 && windows['6m']) return '6m';
  if (daysBack <= 430 && windows['1y']) return '1y';
  if (windows['6m']) return '6m';
  if (windows['1y']) return '1y';
  if (windows.all) return 'all';
  return (Object.keys(windows)[0] as TimelineWindowKey) || 'all';
}

function cloneWindowWithEvents(window: NonNullable<TimelineWindow>, events: TimelineEvent[]) {
  const points: TimelinePoint[] = (window.points || []).map((point) => ({ ...point, events: undefined }));
  if (events.length && points.length) {
    points[points.length - 1] = {
      ...points[points.length - 1],
      events,
    };
  }
  return { ...window, points };
}

function buildTimelineFromIndex(input: {
  playerName: string;
  valueProfileKey: string;
  leagueValueMode: 'dynasty' | 'redraft' | 'keeper';
  daysBack: number;
  details?: PlayerDetails;
}): NonNullable<PlayerDetails['valueTimeline']> | null {
  const indexedPlayer = getIndexedPlayerForName(input.playerName);
  if (!indexedPlayer) return null;
  const formatTimeline = selectTimelineFormat(indexedPlayer, input.valueProfileKey, input.leagueValueMode);
  if (!formatTimeline) return null;
  const events = buildTimelineEvents(input.details);
  const windows = Object.fromEntries(
    Object.entries(formatTimeline.windows || {}).map(([key, window]) => [
      key,
      cloneWindowWithEvents(window as NonNullable<TimelineWindow>, events),
    ])
  ) as NonNullable<PlayerDetails['valueTimeline']>['windows'];
  const selectedWindow = selectTimelineWindow(formatTimeline.windows, input.daysBack);
  const selected = windows?.[selectedWindow] || windows?.all || Object.values(windows || {})[0];
  if (!selected || selected.points.length < 2) return null;

  const start = selected.points[0];
  const end = selected.points[selected.points.length - 1];
  const sourceSetChanged = getSourceSignature(start.sources) !== getSourceSignature(end.sources);
  const note = sourceSetChanged
    ? 'Historical value archive includes source coverage changes; read movement as market plus source-mix context.'
    : 'Historical value archive uses a stable source set at the start and end of this window.';

  return {
    profileKey: input.valueProfileKey,
    source: 'historical-value-index',
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
    extremes: formatTimeline.extremes || undefined,
    yearlyExtremes: formatTimeline.yearlyExtremes || [],
    allTimePointCount: formatTimeline.rawPointCount || selected.pointCount,
    points: selected.points,
    summary: {
      startValue: start.value,
      endValue: end.value,
      delta: selected.delta,
      deltaPct: selected.deltaPct,
      sourceSetChanged,
      eventCount: events.length,
      note,
    },
  };
}

function formatEventNumber(value: number | null | undefined, suffix = ''): string | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return `${Math.round(Number(value)).toLocaleString()}${suffix}`;
}

function buildTimelineEvents(details?: PlayerDetails): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const rosterDelta = details?.rosterRoom?.opportunityDelta || null;
  if (rosterDelta) {
    if (rosterDelta.qualitySignal === 'major-opening' || rosterDelta.qualitySignal === 'minor-opening') {
      events.push({
        type: 'roster-room',
        label: rosterDelta.qualitySignal === 'major-opening' ? 'Room opened' : 'Minor opening',
        tone: 'up',
        detail: [
          formatEventNumber(rosterDelta.vacatedTargets, ' tgts'),
          formatEventNumber(rosterDelta.vacatedCarries, ' carries'),
          rosterDelta.topVacatedPlayer ? `led by ${rosterDelta.topVacatedPlayer}` : null,
        ].filter(Boolean).join(' / '),
      });
    } else if (rosterDelta.qualitySignal === 'squeeze' || rosterDelta.qualitySignal === 'major-squeeze') {
      events.push({
        type: 'roster-room',
        label: rosterDelta.qualitySignal === 'major-squeeze' ? 'Major squeeze' : 'Room squeeze',
        tone: 'down',
        detail: rosterDelta.topAddedThreat ? `Added threat: ${rosterDelta.topAddedThreat}` : rosterDelta.note,
      });
    }

    if (rosterDelta.incumbentOpportunitySignal === 'major-promotion' || rosterDelta.incumbentOpportunitySignal === 'minor-promotion') {
      events.push({
        type: 'roster-room',
        label: rosterDelta.incumbentOpportunitySignal === 'major-promotion' ? 'Depth promotion' : 'Role bump',
        tone: 'up',
        detail: rosterDelta.topReturningDepthPlayer || null,
      });
    } else if (rosterDelta.incumbentOpportunitySignal === 'blocked') {
      events.push({
        type: 'roster-room',
        label: 'Blocked role',
        tone: 'warning',
        detail: rosterDelta.topAddedThreat ? `Pressure from ${rosterDelta.topAddedThreat}` : null,
      });
    }
  }

  const draftRound = Number(details?.nflDraftRound);
  const draftPick = Number(details?.nflDraftPick);
  if (Number.isFinite(draftRound) || Number.isFinite(draftPick)) {
    const premium = (Number.isFinite(draftPick) && draftPick <= 64) || (Number.isFinite(draftRound) && draftRound <= 2);
    events.push({
      type: 'draft',
      label: premium ? 'Premium draft capital' : 'Draft capital',
      tone: premium ? 'up' : 'neutral',
      detail: [
        Number.isFinite(draftRound) ? `Round ${draftRound}` : null,
        Number.isFinite(draftPick) ? `Pick ${draftPick}` : null,
        details?.nflDraftTeam || null,
      ].filter(Boolean).join(' / '),
    });
  }

  if (details?.newsValueMovement) {
    const delta = details.newsValueMovement.valueDelta || 0;
    events.push({
      type: 'news',
      label: delta > 0 ? 'News value bump' : delta < 0 ? 'News value drop' : 'News checked',
      tone: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
      detail: details.newsValueMovement.note,
    });
  }

  if (details?.injuryHistory?.missedOrLimitedCount) {
    events.push({
      type: 'injury',
      label: 'Availability risk',
      tone: 'warning',
      detail: `${details.injuryHistory.missedOrLimitedCount} missed/limited reports in ${details.injuryHistory.season}`,
    });
  } else if (details?.avgGamesMissed !== null && details?.avgGamesMissed !== undefined && details.avgGamesMissed >= 3) {
    events.push({
      type: 'injury',
      label: 'Availability risk',
      tone: 'warning',
      detail: `${details.avgGamesMissed} games missed per tracked season`,
    });
  }

  if (details?.schedule?.scheduleTier === 'easy' || details?.schedule?.scheduleTier === 'hard' || details?.schedule?.scheduleTier === 'elite') {
    events.push({
      type: 'schedule',
      label: details.schedule.scheduleTier === 'easy' ? 'Easy schedule' : 'Hard schedule',
      tone: details.schedule.scheduleTier === 'easy' ? 'up' : 'warning',
      detail: details.schedule.seasonSOS !== null && details.schedule.seasonSOS !== undefined
        ? `Season SOS ${Math.round(details.schedule.seasonSOS)}%`
        : null,
    });
  }

  return events.slice(0, 5);
}

export function buildPlayerValueTimelineMap(input: {
  playerIds: Iterable<string>;
  players: Record<string, any>;
  playerDetailsById?: Record<string, PlayerDetails>;
  valueProfileKey: string;
  leagueValueMode?: 'dynasty' | 'redraft' | 'keeper';
  daysBack?: number;
  now?: Date;
}): Record<string, NonNullable<PlayerDetails['valueTimeline']>> {
  const now = input.now || new Date();
  const startDate = new Date(now);
  const daysBack = input.daysBack || DEFAULT_TIMELINE_DAYS;
  startDate.setDate(startDate.getDate() - daysBack);
  const snapshotDates = listLocalKtcSnapshotDateKeysSince(startDate);
  const mode = input.leagueValueMode || 'dynasty';
  const timelines: Record<string, NonNullable<PlayerDetails['valueTimeline']>> = {};

  for (const playerId of Array.from(new Set(Array.from(input.playerIds).filter(Boolean)))) {
    const playerName = getPlayerDisplayName(input.players[playerId]);
    if (!playerName) continue;
    const indexedTimeline = buildTimelineFromIndex({
      playerName,
      valueProfileKey: input.valueProfileKey,
      leagueValueMode: mode,
      daysBack,
      details: input.playerDetailsById?.[playerId],
    });
    if (indexedTimeline) {
      timelines[playerId] = indexedTimeline;
      continue;
    }

    const points: TimelinePoint[] = snapshotDates.flatMap((date) => {
      const row = getSnapshotRowForPlayer(playerName, loadLocalKtcSnapshotForDate(date, input.valueProfileKey));
      if (!row) return [];
      const value = getTimelineValue(row.data, mode);
      if (!value) return [];
      return [{
        date,
        value,
        rank: row.data.position_rank || row.data.flock_position_rank || row.data.dynastynerds_position_rank || null,
        sources: row.data.value_sources || [],
        sourceCount: row.data.value_sources?.length || 0,
        marketKtc: row.data.market_value_ktc ?? null,
        fantasyCalcDynasty: row.data.market_value_fantasycalc ?? null,
        fantasyProsDynasty: row.data.expert_value_fantasypros ?? null,
        dynastyProcess: row.data.expert_value_dynastyprocess ?? null,
        dynastyNerds: row.data.expert_value_dynastynerds ?? null,
        flockFantasy: row.data.expert_value_flock ?? null,
      }];
    });

    const compacted = compactPoints(points, MAX_TIMELINE_POINTS);
    if (compacted.length < 2) continue;

    const events = buildTimelineEvents(input.playerDetailsById?.[playerId]);
    if (events.length) {
      compacted[compacted.length - 1] = {
        ...compacted[compacted.length - 1],
        events,
      };
    }

    const start = compacted[0];
    const end = compacted[compacted.length - 1];
    const delta = end.value - start.value;
    const deltaPct = start.value ? Math.round((delta / start.value) * 1000) / 10 : null;
    const sourceSetChanged = getSourceSignature(start.sources) !== getSourceSignature(end.sources);
    const note = sourceSetChanged
      ? 'Stored value history includes a source coverage change; read the movement as market plus source-mix context.'
      : 'Stored value history uses the same source set at the start and end of this window.';

    timelines[playerId] = {
      profileKey: input.valueProfileKey,
      source: 'stored-value-snapshots',
      points: compacted,
      summary: {
        startValue: start.value,
        endValue: end.value,
        delta,
        deltaPct,
        sourceSetChanged,
        eventCount: events.length,
        note,
      },
    };
  }

  return timelines;
}
