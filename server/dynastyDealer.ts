import { cleanName } from './leagueAnalysis';

export interface DynastyDealerValue {
  name: string;
  position?: string;
  team?: string | null;
  sleeperId?: string | null;
  baseValue?: number;
  currentValue?: number;
  voteRating?: number | null;
  voteImpactPercent?: number | null;
  age?: number | null;
  updatedAt?: string | null;
  scoringSettings?: {
    isSuperflex?: boolean;
    isTePremium?: boolean;
  };
}

type DynastyDealerPayload = {
  players?: Array<Record<string, unknown>>;
  timestamp?: string;
  scoringSettings?: DynastyDealerValue['scoringSettings'];
};

const DYNASTY_DEALER_VALUES_URL = 'https://www.dynastydealer.com/api/player-values';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

let cachedValues: { loadedAt: number; values: Record<string, DynastyDealerValue> } | null = null;

function isFresh(cache: { loadedAt: number } | null): boolean {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function toNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeRows(payload: DynastyDealerPayload): Record<string, DynastyDealerValue> {
  const values: Record<string, DynastyDealerValue> = {};

  for (const row of payload.players || []) {
    const name = stringValue(row.name);
    if (!name) continue;

    const position = stringValue(row.position)?.toUpperCase();
    values[cleanName(name)] = {
      name,
      position: position && ['QB', 'RB', 'WR', 'TE'].includes(position) ? position : undefined,
      team: stringValue(row.team),
      sleeperId: stringValue(row.sleeper_id || row.sleeperId),
      baseValue: toNumber(row.base_value || row.baseValue),
      currentValue: toNumber(row.current_value || row.currentValue),
      voteRating: toNumber(row.vote_rating || row.voteRating) ?? null,
      voteImpactPercent: toNumber(row.vote_impact_percent || row.voteImpactPercent) ?? null,
      age: toNumber(row.age) ?? null,
      updatedAt: stringValue(row.updated_at || row.updatedAt || payload.timestamp),
      scoringSettings: payload.scoringSettings,
    };
  }

  return values;
}

export async function fetchDynastyDealerPlayerValues(force = false): Promise<Record<string, DynastyDealerValue>> {
  if (!force && isFresh(cachedValues)) return cachedValues!.values;

  try {
    const response = await fetch(DYNASTY_DEALER_VALUES_URL, {
      headers: {
        accept: 'application/json',
        'user-agent': 'DynastyDegeneratesBot/1.0 benchmark-source-check',
      },
    });
    if (!response.ok) throw new Error(`Dynasty Dealer ${response.status}`);

    const payload = await response.json() as DynastyDealerPayload;
    const values = normalizeRows(payload || {});
    cachedValues = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn('[Dynasty Dealer] Failed to load benchmark values:', error);
    return cachedValues?.values || {};
  }
}
