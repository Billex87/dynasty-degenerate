import {
  findLatestProviderDataSnapshot,
  findProviderDataSnapshotOnOrBefore,
  upsertProviderDataSnapshot,
} from './db';
import { canonicalPlayerNameKey, playerNameKeyVariants } from './leagueAnalysis';
import { getProviderSnapshotDateKey, parseProviderSnapshotPayload } from './providerDataSnapshots';
import type { SleeperDraftPick } from '../shared/types';

const SOURCE_VERSION = 1;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

export type StartupAdpFormat = 'dynasty_sf' | 'dynasty_ppr' | 'dynasty_half_ppr' | 'dynasty_std';

export interface StartupAdpRow {
  playerId: string;
  name: string;
  team?: string | null;
  position?: string | null;
  rank: number;
  adp: number;
  source: string;
  format: StartupAdpFormat;
}

export interface StartupAdpSnapshotPayload {
  schemaVersion: 1;
  source: 'Sleeper';
  sourceKey: string;
  snapshotKey: string;
  season: string;
  format: StartupAdpFormat;
  statKey: string;
  generatedAt: string;
  rowCount: number;
  rows: StartupAdpRow[];
}

type DraftAdpRow = {
  name: string;
  adp: number | null;
  source?: string;
  rank?: number;
  positionRank?: string | null;
  currentAdp?: number | null;
  currentAdpSource?: string | null;
};

const cachedCurrentRows = new Map<string, { loadedAt: number; rows: Record<string, StartupAdpRow> }>();

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function playerName(player: Record<string, any> | undefined): string {
  return player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim();
}

export function getStartupAdpFormat(options: {
  numQbs?: number | null;
  ppr?: number | null;
} = {}): StartupAdpFormat {
  if (Number(options.numQbs || 1) >= 2) return 'dynasty_sf';
  const ppr = Number(options.ppr ?? 1);
  if (ppr === 0) return 'dynasty_std';
  if (ppr === 0.5) return 'dynasty_half_ppr';
  return 'dynasty_ppr';
}

export function getStartupAdpStatKey(format: StartupAdpFormat): string {
  switch (format) {
    case 'dynasty_sf':
      return 'adp_dynasty_2qb';
    case 'dynasty_half_ppr':
      return 'adp_dynasty_half_ppr';
    case 'dynasty_std':
      return 'adp_dynasty_std';
    case 'dynasty_ppr':
    default:
      return 'adp_dynasty_ppr';
  }
}

function getStartupAdpLabel(format: StartupAdpFormat, season?: string): string {
  const prefix = season ? `Sleeper ${season}` : 'Sleeper';
  switch (format) {
    case 'dynasty_sf':
      return `${prefix} Dynasty SF ADP`;
    case 'dynasty_half_ppr':
      return `${prefix} Dynasty Half-PPR ADP`;
    case 'dynasty_std':
      return `${prefix} Dynasty Standard ADP`;
    case 'dynasty_ppr':
    default:
      return `${prefix} Dynasty 1QB ADP`;
  }
}

export function getStartupAdpSourceKey(season: string, format: StartupAdpFormat): string {
  return `sleeper-startup-adp-v${SOURCE_VERSION}:${season}:${format}`;
}

function indexRows(rows: StartupAdpRow[]): Record<string, StartupAdpRow> {
  const indexed: Record<string, StartupAdpRow> = {};
  rows.forEach((row) => {
    indexed[row.playerId] = row;
    playerNameKeyVariants(row.name).forEach((key) => {
      indexed[key] = row;
    });
  });
  return indexed;
}

function normalizeSleeperProjectionRows(
  payload: unknown,
  season: string,
  format: StartupAdpFormat,
): StartupAdpRow[] {
  if (!Array.isArray(payload)) return [];
  const statKey = getStartupAdpStatKey(format);
  const source = getStartupAdpLabel(format, season);
  const candidates = payload
    .map((row: any) => {
      const player = row?.player || {};
      const playerId = String(row?.player_id || player?.player_id || '').trim();
      const name = playerName(player);
      const adp = toFiniteNumber(row?.stats?.[statKey]);
      if (!playerId || !name || adp === null || adp <= 0 || adp >= 999) return null;
      return {
        playerId,
        name,
        team: player?.team || row?.team || null,
        position: String(player?.position || player?.fantasy_positions?.[0] || '').toUpperCase() || null,
        adp: Math.round(adp * 10) / 10,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.adp - b.adp || a.name.localeCompare(b.name));

  return candidates.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    source,
    format,
  }));
}

export async function loadCurrentSleeperStartupAdp(
  season: string | number,
  format: StartupAdpFormat,
  force = false,
): Promise<Record<string, StartupAdpRow>> {
  const normalizedSeason = String(season || '').trim();
  if (!/^\d{4}$/.test(normalizedSeason)) return {};

  const cacheKey = `${normalizedSeason}:${format}`;
  const cached = cachedCurrentRows.get(cacheKey);
  if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.rows;

  try {
    const response = await fetch(`https://api.sleeper.app/projections/nfl/${encodeURIComponent(normalizedSeason)}?season_type=regular`);
    if (!response.ok) throw new Error(`Sleeper startup ADP ${response.status} for ${normalizedSeason}`);
    const rows = indexRows(normalizeSleeperProjectionRows(await response.json(), normalizedSeason, format));
    cachedCurrentRows.set(cacheKey, { loadedAt: Date.now(), rows });
    return rows;
  } catch (error) {
    console.warn('[Sleeper Startup ADP] Failed to load startup ADP:', error instanceof Error ? error.message : error);
    cachedCurrentRows.set(cacheKey, { loadedAt: Date.now(), rows: {} });
    return {};
  }
}

export async function refreshSleeperStartupAdpSnapshots(options: {
  season?: string | number;
  formats?: StartupAdpFormat[];
  persistSnapshot?: boolean;
  now?: Date;
} = {}) {
  const now = options.now || new Date();
  const season = String(options.season || now.getFullYear());
  const formats = options.formats?.length
    ? options.formats
    : ['dynasty_sf', 'dynasty_ppr', 'dynasty_half_ppr', 'dynasty_std'] as StartupAdpFormat[];
  const rows = await Promise.all(formats.map(async (format) => {
    const currentRows = Object.values(await loadCurrentSleeperStartupAdp(season, format, true))
      .filter((row, index, list) => list.findIndex((candidate) => candidate.playerId === row.playerId) === index)
      .sort((a, b) => a.rank - b.rank);
    const sourceKey = getStartupAdpSourceKey(season, format);
    const snapshotKey = getProviderSnapshotDateKey(now);
    const payload: StartupAdpSnapshotPayload = {
      schemaVersion: 1,
      source: 'Sleeper',
      sourceKey,
      snapshotKey,
      season,
      format,
      statKey: getStartupAdpStatKey(format),
      generatedAt: now.toISOString(),
      rowCount: currentRows.length,
      rows: currentRows,
    };
    const persisted = options.persistSnapshot === false
      ? false
      : await upsertProviderDataSnapshot({
        sourceKey,
        snapshotKey,
        payload: JSON.stringify(payload),
      });
    return {
      sourceKey,
      snapshotKey,
      season,
      format,
      rowCount: currentRows.length,
      persisted,
    };
  }));

  return {
    season,
    generatedAt: now.toISOString(),
    rows,
  };
}

async function loadStoredStartupAdpSnapshot(input: {
  season: string;
  format: StartupAdpFormat;
  onOrBefore?: string | null;
}): Promise<Record<string, StartupAdpRow>> {
  const sourceKey = getStartupAdpSourceKey(input.season, input.format);
  const stored = input.onOrBefore
    ? await findProviderDataSnapshotOnOrBefore(sourceKey, input.onOrBefore)
    : await findLatestProviderDataSnapshot(sourceKey);
  const payload = parseProviderSnapshotPayload<StartupAdpSnapshotPayload>(stored?.payload || null);
  if (!payload?.rows?.length) return {};
  return indexRows(payload.rows);
}

function isStartupPick(pick: SleeperDraftPick & { draft_pick_count?: number | null }): boolean {
  const pickCount = Number(pick.draft_pick_count || 0);
  const round = Number(pick.round || 0);
  return pickCount >= 100 || round > 10;
}

function lookupRow(rows: Record<string, StartupAdpRow>, playerId: string, name: string): StartupAdpRow | null {
  return rows[playerId]
    || rows[canonicalPlayerNameKey(name)]
    || playerNameKeyVariants(name).map((key) => rows[key]).find(Boolean)
    || null;
}

export async function buildSleeperStartupAdpData(
  draftPicks: Array<SleeperDraftPick & { draft_pick_count?: number | null; season?: string | number | null }>,
  players: Record<string, any>,
  options: {
    numQbs?: number | null;
    ppr?: number | null;
    baselineSnapshotKeyBySeason?: Record<string, string | null>;
    currentSeason?: string | number | null;
  } = {},
): Promise<Record<string, DraftAdpRow>> {
  const format = getStartupAdpFormat(options);
  const seasons = Array.from(new Set(
    draftPicks
      .filter(isStartupPick)
      .map((pick) => String(pick.season || '').trim())
      .filter((season) => /^\d{4}$/.test(season))
  ));
  if (!seasons.length) return {};

  const rowsBySeason = new Map<string, {
    baselineRows: Record<string, StartupAdpRow>;
    currentRows: Record<string, StartupAdpRow>;
  }>();
  await Promise.all(seasons.map(async (season) => {
    const currentAdpSeason = String(options.currentSeason || season).trim();
    const [storedBaselineRows, sleeperSeasonRows, currentRows] = await Promise.all([
      loadStoredStartupAdpSnapshot({
        season,
        format,
        onOrBefore: options.baselineSnapshotKeyBySeason?.[season] || null,
      }),
      loadCurrentSleeperStartupAdp(season, format),
      loadCurrentSleeperStartupAdp(/^\d{4}$/.test(currentAdpSeason) ? currentAdpSeason : season, format),
    ]);
    rowsBySeason.set(season, {
      baselineRows: {
        ...sleeperSeasonRows,
        ...storedBaselineRows,
      },
      currentRows,
    });
  }));

  const adpData: Record<string, DraftAdpRow> = {};
  draftPicks.filter(isStartupPick).forEach((pick) => {
    const season = String(pick.season || '').trim();
    const rows = rowsBySeason.get(season);
    if (!rows) return;
    const player = players[pick.player_id];
    const name = playerName(player);
    const baselineRow = lookupRow(rows.baselineRows, String(pick.player_id), name);
    const currentRow = lookupRow(rows.currentRows, String(pick.player_id), name);
    if (!baselineRow && !currentRow) return;
    adpData[`${season}:${pick.player_id}`] = {
      name: baselineRow?.name || currentRow?.name || name,
      adp: baselineRow?.adp ?? null,
      source: baselineRow
        ? baselineRow.source
        : undefined,
      rank: baselineRow?.rank,
      positionRank: null,
      currentAdp: currentRow?.adp ?? null,
      currentAdpSource: currentRow?.source || null,
    };
  });

  return adpData;
}
