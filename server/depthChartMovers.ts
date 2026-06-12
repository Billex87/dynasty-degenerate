import type { DepthChartMover, DepthChartMovers } from '../shared/types';
import { findLatestProviderDataSnapshot, findProviderDataSnapshotOnOrBefore } from './db';
import { buildDepthChartRoleChangeSignals, type DepthChartRoleSnapshotRow } from './depthChartRoleChanges';
import { ESPN_DEPTH_CHART_SNAPSHOT_SOURCE_KEY, type EspnDepthChartEntry } from './espnDepthCharts';
import { getProviderSnapshotDateKey, parseProviderSnapshotPayload } from './providerDataSnapshots';

type EspnDepthChartSnapshotPayload = {
  schemaVersion: 1;
  generatedAt: string;
  snapshotKey: string;
  teams: Record<string, EspnDepthChartEntry[]>;
};

type PlayerLookupRow = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  team?: string | null;
  espn_id?: string | number | null;
};

type StoredSnapshot = {
  snapshotKey: string;
  payload?: string | null;
  updatedAt?: Date | null;
};

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_MAX_PER_DIRECTION = 6;
const MAX_BASELINE_DRIFT_DAYS = 1;

function emptyDepthChartMovers(input?: Partial<DepthChartMovers>): DepthChartMovers {
  return {
    windowDays: input?.windowDays ?? DEFAULT_WINDOW_DAYS,
    currentSnapshotKey: input?.currentSnapshotKey ?? null,
    baselineSnapshotKey: input?.baselineSnapshotKey ?? null,
    generatedAt: input?.generatedAt ?? null,
    up: [],
    down: [],
  };
}

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function keyText(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseDateKey(snapshotKey?: string | null): Date | null {
  if (!snapshotKey || !/^\d{4}-\d{2}-\d{2}$/.test(snapshotKey)) return null;
  const parsed = new Date(`${snapshotKey}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shiftDateKey(snapshotKey: string, dayDelta: number): string | null {
  const parsed = parseDateKey(snapshotKey);
  if (!parsed) return null;
  parsed.setUTCDate(parsed.getUTCDate() + dayDelta);
  return parsed.toISOString().slice(0, 10);
}

function daysBetweenSnapshotKeys(olderKey?: string | null, newerKey?: string | null): number | null {
  const older = parseDateKey(olderKey);
  const newer = parseDateKey(newerKey);
  if (!older || !newer) return null;
  return Math.round((newer.getTime() - older.getTime()) / (1000 * 60 * 60 * 24));
}

function parseDepthChartSnapshot(stored?: StoredSnapshot | null): EspnDepthChartSnapshotPayload | null {
  const parsed = parseProviderSnapshotPayload<Partial<EspnDepthChartSnapshotPayload>>(stored?.payload);
  if (
    parsed?.schemaVersion !== 1 ||
    typeof parsed.snapshotKey !== 'string' ||
    typeof parsed.generatedAt !== 'string' ||
    !parsed.teams ||
    typeof parsed.teams !== 'object' ||
    Array.isArray(parsed.teams)
  ) {
    return null;
  }

  return parsed as EspnDepthChartSnapshotPayload;
}

function roleSlot(entry: EspnDepthChartEntry): string {
  return `${cleanText(entry.position).toUpperCase()}${entry.order}`;
}

function snapshotRows(snapshot: EspnDepthChartSnapshotPayload): DepthChartRoleSnapshotRow[] {
  return Object.entries(snapshot.teams).flatMap(([teamKey, entries]) => (
    (entries || []).map((entry) => ({
      playerId: entry.espnId || null,
      name: entry.playerName,
      team: entry.team || teamKey,
      position: entry.position,
      rank: entry.order,
      slot: roleSlot(entry),
      snapshotAt: snapshot.generatedAt,
      source: ESPN_DEPTH_CHART_SNAPSHOT_SOURCE_KEY,
      sourceReliable: true,
    }))
  ));
}

function playerDisplayName(playerId: string, player?: PlayerLookupRow): string {
  return cleanText(player?.full_name)
    || cleanText(`${player?.first_name || ''} ${player?.last_name || ''}`)
    || playerId;
}

function playerKeys(playerId: string, player?: PlayerLookupRow): string[] {
  if (!player) return [];
  const team = keyText(player.team);
  const position = keyText(player.position);
  if (!team || !position) return [];

  const keys: string[] = [];
  const espnId = cleanText(player.espn_id);
  if (espnId) keys.push(`id:${espnId}:${team}:${position}`);

  const name = keyText(playerDisplayName(playerId, player));
  if (name) keys.push(`name:${name}:${team}:${position}`);
  return keys;
}

function buildPlayerIdBySignalKey(input: {
  playerIds: string[];
  playersById: Record<string, PlayerLookupRow | undefined>;
}) {
  const lookup = new Map<string, string>();
  for (const playerId of input.playerIds) {
    for (const key of playerKeys(playerId, input.playersById[playerId])) {
      if (!lookup.has(key)) lookup.set(key, playerId);
    }
  }
  return lookup;
}

function impactScore(mover: DepthChartMover): number {
  const previous = mover.previousRank ?? (mover.direction === 'up' ? 99 : 1);
  const current = mover.currentRank ?? (mover.direction === 'up' ? 1 : 99);
  const rankDelta = Math.abs(previous - current);
  const starterMove = mover.kind === 'promoted-to-starter' || mover.kind === 'demoted-from-starter' ? 20 : 0;
  const listingMove = mover.kind === 'newly-listed' || mover.kind === 'removed' ? 8 : 0;
  return starterMove + listingMove + rankDelta;
}

function selectMovers(rows: DepthChartMover[], maxPerDirection: number): DepthChartMover[] {
  return [...rows]
    .sort((a, b) => impactScore(b) - impactScore(a) || b.confidence - a.confidence || a.playerName.localeCompare(b.playerName))
    .slice(0, maxPerDirection);
}

export function buildDepthChartMovers(input: {
  currentSnapshot: EspnDepthChartSnapshotPayload | null;
  baselineSnapshot: EspnDepthChartSnapshotPayload | null;
  playersById: Record<string, PlayerLookupRow | undefined>;
  playerIds?: string[];
  ownerByPlayerId?: Record<string, string | null | undefined>;
  currentPositionRankById?: Record<string, string | null | undefined>;
  maxPerDirection?: number;
  windowDays?: number;
}): DepthChartMovers {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const maxPerDirection = Math.max(1, Math.min(12, Math.floor(input.maxPerDirection ?? DEFAULT_MAX_PER_DIRECTION)));
  if (!input.currentSnapshot || !input.baselineSnapshot) {
    return emptyDepthChartMovers({
      windowDays,
      currentSnapshotKey: input.currentSnapshot?.snapshotKey ?? null,
      baselineSnapshotKey: input.baselineSnapshot?.snapshotKey ?? null,
      generatedAt: input.currentSnapshot?.generatedAt ?? null,
    });
  }

  const playerIds = input.playerIds?.length ? input.playerIds : Object.keys(input.playersById);
  const playerIdBySignalKey = buildPlayerIdBySignalKey({ playerIds, playersById: input.playersById });
  if (!playerIdBySignalKey.size) {
    return emptyDepthChartMovers({
      windowDays,
      currentSnapshotKey: input.currentSnapshot.snapshotKey,
      baselineSnapshotKey: input.baselineSnapshot.snapshotKey,
      generatedAt: input.currentSnapshot.generatedAt,
    });
  }

  const signals = buildDepthChartRoleChangeSignals({
    previousRows: snapshotRows(input.baselineSnapshot),
    currentRows: snapshotRows(input.currentSnapshot),
  });

  const movers = signals
    .filter((signal) => signal.direction === 'boost' || signal.direction === 'risk')
    .map((signal): DepthChartMover | null => {
      const playerId = playerIdBySignalKey.get(signal.playerKey);
      if (!playerId) return null;
      return {
        playerId,
        playerName: signal.playerName,
        owner: input.ownerByPlayerId?.[playerId] ?? null,
        team: signal.team,
        position: signal.position,
        kind: signal.kind as DepthChartMover['kind'],
        direction: signal.direction === 'boost' ? 'up' : 'down',
        previousRank: signal.previousRank,
        currentRank: signal.currentRank,
        previousSlot: signal.previousSlot,
        currentSlot: signal.currentSlot,
        confidence: signal.confidence,
        note: signal.note,
        source: ESPN_DEPTH_CHART_SNAPSHOT_SOURCE_KEY,
        currentSnapshotKey: input.currentSnapshot!.snapshotKey,
        baselineSnapshotKey: input.baselineSnapshot!.snapshotKey,
        currentPositionRank: input.currentPositionRankById?.[playerId] ?? null,
      };
    })
    .filter((mover): mover is DepthChartMover => Boolean(mover));

  return {
    windowDays,
    currentSnapshotKey: input.currentSnapshot.snapshotKey,
    baselineSnapshotKey: input.baselineSnapshot.snapshotKey,
    generatedAt: input.currentSnapshot.generatedAt,
    up: selectMovers(movers.filter((mover) => mover.direction === 'up'), maxPerDirection),
    down: selectMovers(movers.filter((mover) => mover.direction === 'down'), maxPerDirection),
  };
}

export async function loadDepthChartMoversForPlayers(input: {
  playerIds: string[];
  playersById: Record<string, PlayerLookupRow | undefined>;
  ownerByPlayerId?: Record<string, string | null | undefined>;
  currentPositionRankById?: Record<string, string | null | undefined>;
  now?: Date;
  maxPerDirection?: number;
  windowDays?: number;
}): Promise<DepthChartMovers> {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const latestStored = await findLatestProviderDataSnapshot(ESPN_DEPTH_CHART_SNAPSHOT_SOURCE_KEY);
  const currentSnapshot = parseDepthChartSnapshot(latestStored);
  if (!currentSnapshot) return emptyDepthChartMovers({ windowDays });

  const currentDateKey = getProviderSnapshotDateKey(input.now || new Date());
  const latestAgeDays = daysBetweenSnapshotKeys(currentSnapshot.snapshotKey, currentDateKey);
  if (latestAgeDays !== null && latestAgeDays > windowDays) {
    return emptyDepthChartMovers({
      windowDays,
      currentSnapshotKey: currentSnapshot.snapshotKey,
      generatedAt: currentSnapshot.generatedAt,
    });
  }

  const baselineTargetKey = shiftDateKey(currentSnapshot.snapshotKey, -windowDays);
  if (!baselineTargetKey) {
    return emptyDepthChartMovers({
      windowDays,
      currentSnapshotKey: currentSnapshot.snapshotKey,
      generatedAt: currentSnapshot.generatedAt,
    });
  }

  const baselineStored = await findProviderDataSnapshotOnOrBefore(ESPN_DEPTH_CHART_SNAPSHOT_SOURCE_KEY, baselineTargetKey);
  const baselineSnapshot = parseDepthChartSnapshot(baselineStored);
  const baselineAgeDays = daysBetweenSnapshotKeys(baselineSnapshot?.snapshotKey, currentSnapshot.snapshotKey);
  if (!baselineSnapshot || baselineAgeDays === null || baselineAgeDays > windowDays + MAX_BASELINE_DRIFT_DAYS) {
    return emptyDepthChartMovers({
      windowDays,
      currentSnapshotKey: currentSnapshot.snapshotKey,
      baselineSnapshotKey: baselineSnapshot?.snapshotKey ?? null,
      generatedAt: currentSnapshot.generatedAt,
    });
  }

  return buildDepthChartMovers({
    currentSnapshot,
    baselineSnapshot,
    playersById: input.playersById,
    playerIds: input.playerIds,
    ownerByPlayerId: input.ownerByPlayerId,
    currentPositionRankById: input.currentPositionRankById,
    maxPerDirection: input.maxPerDirection,
    windowDays,
  });
}
