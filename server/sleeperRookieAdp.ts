import { canonicalPlayerNameKey, playerNameKeyVariants } from './leagueAnalysis';
import type { SleeperDraftPick } from '../shared/types';

const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const loadedByYear = new Map<string, { loadedAt: number; rows: Record<string, SleeperRookieAdpRow> }>();

export interface SleeperRookieAdpOptions {
  numQbs?: 1 | 2 | number | null;
  ppr?: 0 | 0.5 | 1 | number | null;
}

export interface SleeperRookieAdpRow {
  year: string;
  playerId: string;
  name: string;
  team?: string | null;
  position: string;
  positionRank: string;
  rank: number;
  adp: number;
  source: string;
  sleeperMarketAdp: number;
}

type DraftAdpRow = {
  name: string;
  adp: number;
  source?: string;
  rank?: number;
  positionRank?: string | null;
};

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getPlayerName(player: Record<string, any> | undefined): string {
  return player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim();
}

function getSleeperRookieAdpSource(options: SleeperRookieAdpOptions): string {
  if (Number(options.numQbs || 1) >= 2) return 'Sleeper SF Rookie Rank';
  const ppr = Number(options.ppr ?? 1);
  if (ppr === 0) return 'Sleeper Standard Rookie Rank';
  if (ppr === 0.5) return 'Sleeper Half-PPR Rookie Rank';
  return 'Sleeper PPR Rookie Rank';
}

export function getSleeperRookieAdpStatKey(options: SleeperRookieAdpOptions): string {
  if (Number(options.numQbs || 1) >= 2) return 'adp_dynasty_2qb';
  const ppr = Number(options.ppr ?? 1);
  if (ppr === 0) return 'adp_dynasty_std';
  if (ppr === 0.5) return 'adp_dynasty_half_ppr';
  return 'adp_dynasty_ppr';
}

function getSleeperMarketAdp(stats: Record<string, any>, options: SleeperRookieAdpOptions): number | null {
  const primary = toFiniteNumber(stats[getSleeperRookieAdpStatKey(options)]);
  if (primary !== null && primary > 0 && primary < 999) return primary;

  const fallbackKeys = Number(options.numQbs || 1) >= 2
    ? ['adp_2qb', 'adp_dynasty_ppr', 'adp_ppr']
    : ['adp_dynasty_ppr', 'adp_dynasty_half_ppr', 'adp_dynasty_std', 'adp_ppr'];

  for (const key of fallbackKeys) {
    const value = toFiniteNumber(stats[key]);
    if (value !== null && value > 0 && value < 999) return value;
  }
  return null;
}

export function parseSleeperRookieAdpRows(
  payload: unknown,
  year: string,
  options: SleeperRookieAdpOptions = {}
): Record<string, SleeperRookieAdpRow> {
  if (!Array.isArray(payload)) return {};

  const source = getSleeperRookieAdpSource(options);
  const candidates = payload
    .map((row: any) => {
      const player = row?.player || {};
      const playerId = String(row?.player_id || player?.player_id || '').trim();
      const name = getPlayerName(player);
      const rookieYear = String(player?.metadata?.rookie_year || '').trim();
      const sleeperMarketAdp = getSleeperMarketAdp(row?.stats || {}, options);
      if (!playerId || !name || rookieYear !== year || sleeperMarketAdp === null) return null;
      return {
        playerId,
        name,
        team: player?.team || row?.team || null,
        position: String(player?.position || player?.fantasy_positions?.[0] || '').toUpperCase(),
        sleeperMarketAdp,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.sleeperMarketAdp - b.sleeperMarketAdp || a.name.localeCompare(b.name));

  const positionCounts = new Map<string, number>();
  const rows: Record<string, SleeperRookieAdpRow> = {};
  candidates.forEach((candidate, index) => {
    const rank = index + 1;
    const positionCount = (positionCounts.get(candidate.position) || 0) + 1;
    positionCounts.set(candidate.position, positionCount);
    const row: SleeperRookieAdpRow = {
      year,
      playerId: candidate.playerId,
      name: candidate.name,
      team: candidate.team,
      position: candidate.position,
      positionRank: candidate.position ? `${candidate.position}${positionCount}` : `${rank}`,
      rank,
      adp: rank,
      source,
      sleeperMarketAdp: candidate.sleeperMarketAdp,
    };

    rows[candidate.playerId] = row;
    playerNameKeyVariants(candidate.name).forEach((key) => {
      rows[key] = row;
    });
  });

  return rows;
}

export async function loadSleeperRookieAdp(
  year: string | number,
  options: SleeperRookieAdpOptions = {},
  force = false
): Promise<Record<string, SleeperRookieAdpRow>> {
  const normalizedYear = String(year || '').trim();
  if (!/^\d{4}$/.test(normalizedYear)) return {};

  const cacheKey = `${normalizedYear}:${getSleeperRookieAdpStatKey(options)}`;
  const cached = loadedByYear.get(cacheKey);
  if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.rows;
  }

  try {
    const response = await fetch(`https://api.sleeper.app/projections/nfl/${encodeURIComponent(normalizedYear)}?season_type=regular`);
    if (!response.ok) {
      throw new Error(`Sleeper rookie ADP ${response.status} for ${normalizedYear}`);
    }
    const rows = parseSleeperRookieAdpRows(await response.json(), normalizedYear, options);
    loadedByYear.set(cacheKey, { loadedAt: Date.now(), rows });
    return rows;
  } catch (error) {
    console.warn('[Sleeper Rookie ADP] Failed to load rookie ADP:', error instanceof Error ? error.message : error);
    loadedByYear.set(cacheKey, { loadedAt: Date.now(), rows: {} });
    return {};
  }
}

function isRookieSizedDraftPick(pick: SleeperDraftPick & { draft_pick_count?: number | null }): boolean {
  const pickCount = Number(pick.draft_pick_count || 0);
  const round = Number(pick.round || 0);
  if (pickCount && pickCount >= 100) return false;
  return !round || round <= 10;
}

export async function buildSleeperRookieAdpData(
  draftPicks: Array<SleeperDraftPick & { draft_pick_count?: number | null; season?: string | number | null }>,
  players: Record<string, any>,
  options: SleeperRookieAdpOptions = {}
): Promise<Record<string, DraftAdpRow>> {
  const years = Array.from(new Set(
    draftPicks
      .filter(isRookieSizedDraftPick)
      .map((pick) => String(pick.season || '').trim())
      .filter((year) => /^\d{4}$/.test(year))
  ));
  if (!years.length) return {};

  const rowsByYear = new Map<string, Record<string, SleeperRookieAdpRow>>();
  await Promise.all(years.map(async (year) => {
    rowsByYear.set(year, await loadSleeperRookieAdp(year, options));
  }));

  const adpData: Record<string, DraftAdpRow> = {};
  draftPicks.filter(isRookieSizedDraftPick).forEach((pick) => {
    const year = String(pick.season || '').trim();
    const rows = rowsByYear.get(year);
    if (!rows) return;
    const player = players[pick.player_id];
    const playerName = getPlayerName(player);
    const row = rows[String(pick.player_id)] ||
      (playerName ? rows[canonicalPlayerNameKey(playerName)] || playerNameKeyVariants(playerName).map((key) => rows[key]).find(Boolean) : null);
    if (!row) return;

    adpData[`${year}:${pick.player_id}`] = {
      name: row.name,
      adp: row.adp,
      source: row.source,
      rank: row.rank,
      positionRank: row.positionRank,
    };
  });

  return adpData;
}
