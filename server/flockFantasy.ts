import { cleanName } from './leagueAnalysis';
import type { ValueBlendOptions } from './valueBlend';

export type FlockFormat = 'SUPERFLEX' | 'ONEQB' | 'PROSPECTS_SF' | 'PROSPECTS';

export interface FlockFantasyValue {
  name: string;
  position?: string;
  team?: string | null;
  age?: number | null;
  dynastyValue?: number;
  overallRank?: number;
  positionRank?: string | null;
  tier?: number | null;
  lastUpdated?: string | null;
  format: FlockFormat;
  rookieOnlyRank?: number | null;
  rankDelta?: number | null;
  initialRank?: number | null;
  finalRank?: number | null;
  previousYearPprAverage?: number | null;
  picture?: string | null;
  college?: string | null;
  draftYear?: number | null;
}

interface FlockFantasyResponse {
  format?: string;
  lastUpdated?: Record<string, string>;
  data?: FlockFantasyPlayer[];
}

interface FlockFantasyPlayer {
  playerName?: string;
  position?: string;
  averageRank?: number | string | null;
  overallAverageRank?: number | string | null;
  averagePositionalRank?: number | string | null;
  averageTier?: number | string | null;
  team?: string | null;
  age?: number | string | null;
  rankDelta?: number | string | null;
  initialRank?: number | string | null;
  finalRank?: number | string | null;
  previousYearPprAverage?: number | string | null;
  picture?: string | null;
  college?: string | null;
  draftYear?: number | string | null;
  isDraftPick?: boolean;
  pickType?: string | null;
  fantasyCalcId?: number | string | null;
  isRookie?: boolean;
  is_rookie?: boolean;
}

const FLOCK_BASE_URL = 'https://api.flockfantasy.com';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

let cachedRankings: Partial<Record<FlockFormat, { loadedAt: number; values: Record<string, FlockFantasyValue> }>> = {};

function isFresh(cache: { loadedAt: number } | undefined): boolean {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function toNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rankToValue(rank: number | null, rankCap = 425): number | undefined {
  if (!rank || rank <= 0) return undefined;
  const score = Math.max(0.015, (rankCap - rank + 1) / rankCap);
  return Math.max(50, Math.round(10000 * Math.pow(score, 1.55)));
}

function getFlockUpdatedAt(lastUpdated: FlockFantasyResponse['lastUpdated']): string | null {
  const timestamps = Object.values(lastUpdated || {}).filter(Boolean).sort();
  return timestamps.at(-1) || null;
}

function normalizeNumQbs(numQbs?: number): 1 | 2 {
  return numQbs && numQbs >= 2 ? 2 : 1;
}

export function getFlockFantasyFormat(options: ValueBlendOptions = {}): Extract<FlockFormat, 'SUPERFLEX' | 'ONEQB'> {
  return normalizeNumQbs(options.numQbs) === 2 ? 'SUPERFLEX' : 'ONEQB';
}

function getFlockRookieFormat(options: ValueBlendOptions = {}): Extract<FlockFormat, 'PROSPECTS_SF' | 'PROSPECTS'> {
  return normalizeNumQbs(options.numQbs) === 2 ? 'PROSPECTS_SF' : 'PROSPECTS';
}

export async function fetchFlockFantasyRankings(format: FlockFormat): Promise<Record<string, FlockFantasyValue>> {
  const cached = cachedRankings[format];
  if (cached && isFresh(cached)) return cached.values;

  try {
    const params = new URLSearchParams({ format, pickType: 'general' });
    let payload: FlockFantasyResponse | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${FLOCK_BASE_URL}/rankings?${params.toString()}`);
      if (response.ok) {
        payload = await response.json() as FlockFantasyResponse;
        break;
      }

      const shouldRetry = [429, 500, 502, 503, 504].includes(response.status) && attempt < 2;
      if (!shouldRetry) throw new Error(`Flock Fantasy ${response.status}`);
      await sleep(600 * Math.pow(2, attempt));
    }
    if (!payload) return {};
    const lastUpdated = getFlockUpdatedAt(payload.lastUpdated);
    const values: Record<string, FlockFantasyValue> = {};

    for (const row of payload.data || []) {
      const name = row.playerName;
      const position = ['QB', 'RB', 'WR', 'TE'].includes(row.position || '')
        ? row.position
        : row.isDraftPick || row.pickType
          ? 'PICK'
          : row.position;
      if (!name || !['QB', 'RB', 'WR', 'TE', 'PICK'].includes(position || '')) continue;

      const overallRank = toNumber(row.overallAverageRank) ?? toNumber(row.averageRank);
      const positionRank = toNumber(row.averagePositionalRank);
      const dynastyValue = rankToValue(overallRank, format.startsWith('PROSPECTS') ? 90 : 425);
      if (!dynastyValue) continue;

      values[cleanName(name)] = {
        name,
        position,
        team: row.team || null,
        age: toNumber(row.age),
        dynastyValue,
        overallRank: overallRank ?? undefined,
        positionRank: positionRank ? `${position}${Math.round(positionRank)}` : null,
        tier: toNumber(row.averageTier),
        lastUpdated,
        format,
        rookieOnlyRank: format.startsWith('PROSPECTS') ? overallRank : null,
        rankDelta: toNumber(row.rankDelta),
        initialRank: toNumber(row.initialRank),
        finalRank: toNumber(row.finalRank),
        previousYearPprAverage: toNumber(row.previousYearPprAverage),
        picture: row.picture || null,
        college: row.college || null,
        draftYear: toNumber(row.draftYear),
      };
    }

    cachedRankings[format] = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn(`[Flock Fantasy] Failed to load ${format} rankings:`, error);
    return cachedRankings[format]?.values || {};
  }
}

export async function fetchFlockFantasyValues(options: ValueBlendOptions = {}): Promise<Record<string, FlockFantasyValue>> {
  const [fullRankings, rookieRankings] = await Promise.all([
    fetchFlockFantasyRankings(getFlockFantasyFormat(options)),
    fetchFlockFantasyRankings(getFlockRookieFormat(options)),
  ]);

  return {
    ...rookieRankings,
    ...fullRankings,
  };
}

export async function loadFlockFantasyValueProfiles(): Promise<Record<FlockFormat, Record<string, FlockFantasyValue>>> {
  const [superflex, oneQb, prospectsSf, prospects] = await Promise.all([
    fetchFlockFantasyRankings('SUPERFLEX'),
    fetchFlockFantasyRankings('ONEQB'),
    fetchFlockFantasyRankings('PROSPECTS_SF'),
    fetchFlockFantasyRankings('PROSPECTS'),
  ]);

  return {
    SUPERFLEX: superflex,
    ONEQB: oneQb,
    PROSPECTS_SF: prospectsSf,
    PROSPECTS: prospects,
  };
}
