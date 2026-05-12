import { cleanName } from './leagueAnalysis';

const FANTASY_NERDS_BASE_URL = 'https://api.fantasynerds.com/v1/nfl';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

export type FantasyNerdsScoring = 'std' | 'half' | 'ppr' | 'superflex';

export interface FantasyNerdsRanking {
  name: string;
  position?: string | null;
  team?: string | null;
  overallRank?: number | null;
  positionRank?: string | null;
  tier?: number | null;
  season?: string | null;
  adp?: number | null;
  redraftValue?: number | null;
  dynastyValue?: number | null;
}

type FantasyNerdsPlayerRow = {
  playerId?: string | number;
  name?: string;
  team?: string | null;
  position?: string | null;
  rank?: string | number | null;
  rank_position?: string | number | null;
  tier?: string | number | null;
  pick?: string | number | null;
};

type FantasyNerdsPayload = {
  season?: string | number | null;
  format?: string | null;
  players?: FantasyNerdsPlayerRow[];
};

let cachedDraftRankings: Record<string, { loadedAt: number; values: Record<string, FantasyNerdsRanking> }> = {};
let cachedDynastyRankings: { loadedAt: number; values: Record<string, FantasyNerdsRanking> } | null = null;

function isFresh(cache: { loadedAt: number } | null | undefined): boolean {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function shouldUseFantasyNerdsTestData(): boolean {
  if (process.env.ENABLE_FANTASY_NERDS_TEST_DATA === 'true') return true;
  return process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
}

function getFantasyNerdsApiKey(): string | null {
  return process.env.FANTASY_NERDS_API_KEY || process.env.FANTASYNERDS_API_KEY || (shouldUseFantasyNerdsTestData() ? 'TEST' : null);
}

export function hasFantasyNerdsApiKey(): boolean {
  const key = getFantasyNerdsApiKey();
  if (!key) return false;
  if (/^TEST$/i.test(key) && !shouldUseFantasyNerdsTestData()) {
    return false;
  }
  return true;
}

export function isFantasyNerdsTestDataActive(): boolean {
  return /^TEST$/i.test(getFantasyNerdsApiKey() || '') && shouldUseFantasyNerdsTestData();
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizePosition(position?: string | null): string | null {
  const normalized = String(position || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!normalized) return null;
  if (['DST', 'D', 'DEFENSE'].includes(normalized)) return 'DEF';
  if (normalized === 'PK') return 'K';
  return normalized;
}

function normalizePositionRank(position?: string | null, rank?: string | number | null): string | null {
  const normalizedPosition = normalizePosition(position);
  const rankNumber = toNumber(rank);
  if (!normalizedPosition || !rankNumber) return null;
  return `${normalizedPosition}${rankNumber}`;
}

function positionRankToValue(positionRank?: string | null, fallbackRank?: number | null): number | null {
  const position = normalizePosition(String(positionRank || '').replace(/[0-9]/g, ''));
  const rank = toNumber(String(positionRank || '').match(/\d+/)?.[0]) || fallbackRank || null;
  if (!rank) return null;

  const replacementByPosition: Record<string, number> = {
    QB: 30,
    RB: 60,
    WR: 72,
    TE: 24,
    K: 20,
    DEF: 20,
  };
  const ceilingByPosition: Record<string, number> = {
    QB: 9000,
    RB: 9000,
    WR: 9000,
    TE: 9000,
    K: 1200,
    DEF: 1200,
  };
  const replacement = replacementByPosition[position || ''] || 180;
  const ceiling = ceilingByPosition[position || ''] || 9000;
  return Math.max(100, Math.round(ceiling * Math.pow(Math.max(0.035, (replacement - rank + 1) / replacement), 1.35)));
}

function overallRankToValue(rank?: number | null): number | null {
  if (!rank || rank <= 0) return null;
  const replacement = 220;
  return Math.max(100, Math.round(9000 * Math.pow(Math.max(0.02, (replacement - rank + 1) / replacement), 1.22)));
}

function pickToAdp(pick: unknown, teams: number): number | null {
  if (typeof pick === 'number') return Number.isFinite(pick) ? pick : null;
  const value = String(pick || '').trim();
  const match = value.match(/^(\d+)\.(\d+)$/);
  if (!match) return toNumber(value);
  const round = Number(match[1]);
  const slot = Number(match[2]);
  if (!Number.isFinite(round) || !Number.isFinite(slot) || round <= 0 || slot <= 0) return null;
  return (round - 1) * teams + slot;
}

function shouldRejectStaleDynastySeason(season: string | number | null | undefined, expectedSeason: string): boolean {
  const sourceSeason = Number(season);
  const expected = Number(expectedSeason);
  if (!Number.isFinite(sourceSeason) || !Number.isFinite(expected)) return false;
  return sourceSeason < expected - 1;
}

async function fantasyNerdsFetch(resource: string, params: Record<string, string | number | null | undefined> = {}): Promise<FantasyNerdsPayload | null> {
  const apiKey = getFantasyNerdsApiKey();
  if (!apiKey || !hasFantasyNerdsApiKey()) return null;

  const url = new URL(`${FANTASY_NERDS_BASE_URL}/${resource}`);
  url.searchParams.set('apikey', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && String(value) !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'dynasty-degenerates/1.0 fantasy rankings aggregation',
    },
  });
  if (!response.ok) throw new Error(`Fantasy Nerds ${response.status} ${resource}`);
  return response.json() as Promise<FantasyNerdsPayload>;
}

export function normalizeFantasyNerdsRankingsPayload(
  payload: FantasyNerdsPayload | null | undefined,
  options: {
    kind: 'redraft' | 'dynasty';
    teams?: number;
    expectedSeason?: string;
    rejectStaleDynastySeason?: boolean;
  },
): Record<string, FantasyNerdsRanking> {
  if (!payload?.players?.length) return {};
  if (
    options.kind === 'dynasty'
    && options.rejectStaleDynastySeason
    && options.expectedSeason
    && shouldRejectStaleDynastySeason(payload.season, options.expectedSeason)
  ) {
    return {};
  }

  const values: Record<string, FantasyNerdsRanking> = {};
  for (const row of payload.players) {
    if (!row?.name) continue;
    const position = normalizePosition(row.position || null);
    if (!position || !FANTASY_POSITIONS.has(position)) continue;

    const overallRank = toNumber(row.rank);
    const positionRank = normalizePositionRank(position, row.rank_position);
    const adp = options.teams ? pickToAdp(row.pick, options.teams) : null;
    const value = positionRankToValue(positionRank, overallRank) || overallRankToValue(overallRank);
    if (!value) continue;

    values[cleanName(row.name)] = {
      name: row.name,
      position,
      team: row.team || null,
      overallRank,
      positionRank,
      tier: toNumber(row.tier),
      season: payload.season ? String(payload.season) : null,
      adp,
      redraftValue: options.kind === 'redraft' ? value : null,
      dynastyValue: options.kind === 'dynasty' ? value : null,
    };
  }
  return values;
}

export async function fetchFantasyNerdsDraftRankings(
  scoring: FantasyNerdsScoring = 'ppr',
  teams = 12,
): Promise<Record<string, FantasyNerdsRanking>> {
  const cacheKey = `${scoring}:${teams}`;
  if (isFresh(cachedDraftRankings[cacheKey])) return cachedDraftRankings[cacheKey].values;

  try {
    const [rankingsPayload, adpPayload] = await Promise.all([
      fantasyNerdsFetch('draft-rankings', { format: scoring }),
      fantasyNerdsFetch('adp', { teams, format: scoring }),
    ]);
    const useTestData = isFantasyNerdsTestDataActive();
    const season = String(new Date().getFullYear());
    const applySeasonOverride = (values: Record<string, FantasyNerdsRanking>): Record<string, FantasyNerdsRanking> => {
      if (!useTestData) return values;
      return Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          {
            ...value,
            season,
          },
        ]),
      );
    };
    const rankings = applySeasonOverride(normalizeFantasyNerdsRankingsPayload(rankingsPayload, { kind: 'redraft', teams }));
    const adpRows = applySeasonOverride(normalizeFantasyNerdsRankingsPayload(adpPayload, { kind: 'redraft', teams }));
    const values: Record<string, FantasyNerdsRanking> = { ...rankings };

    for (const [key, adpRow] of Object.entries(adpRows)) {
      values[key] = {
        ...adpRow,
        ...(values[key] || {}),
        adp: adpRow.adp || values[key]?.adp || null,
        redraftValue: values[key]?.redraftValue || adpRow.redraftValue || null,
      };
    }

    cachedDraftRankings[cacheKey] = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn('[Fantasy Nerds] Failed to load draft rankings:', error);
    return cachedDraftRankings[cacheKey]?.values || {};
  }
}

export async function fetchFantasyNerdsDynastyRankings(
  expectedSeason = String(new Date().getFullYear()),
): Promise<Record<string, FantasyNerdsRanking>> {
  if (isFresh(cachedDynastyRankings)) return cachedDynastyRankings!.values;

  try {
    const payload = await fantasyNerdsFetch('dynasty');
    const values = normalizeFantasyNerdsRankingsPayload(payload, {
      kind: 'dynasty',
      expectedSeason,
      rejectStaleDynastySeason: !isFantasyNerdsTestDataActive(),
    });
    cachedDynastyRankings = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn('[Fantasy Nerds] Failed to load dynasty rankings:', error);
    return cachedDynastyRankings?.values || {};
  }
}
