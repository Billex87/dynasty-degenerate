import { cleanName } from './leagueAnalysis';
import type { ValueBlendOptions } from './valueBlend';

export type DynastyNerdsFormat = 'PPR' | 'SFLEX' | 'STD' | 'SFLEXTEP';

export interface DynastyNerdsValue {
  name: string;
  position?: string;
  team?: string | null;
  age?: number | null;
  imageUrl?: string | null;
  sleeperId?: string | null;
  dynastyValue?: number;
  overallRank?: number;
  positionRank?: string | null;
  rankDelta?: number | null;
  lastUpdated?: string | null;
  format: DynastyNerdsFormat;
  sourceUrl: string;
}

type DynastyNerdsRawRow = {
  firstName?: string;
  lastName?: string;
  team?: string | null;
  pos?: string | null;
  rank?: number | string | null;
  value?: number | string | null;
  posRank?: number | string | null;
  img?: string | null;
  sleeperId?: string | number | null;
  dob?: string | null;
  age?: number | string | null;
  rankDelta?: number | string | null;
  trend?: number | string | null;
};

type DynastyNerdsPayload = Partial<Record<DynastyNerdsFormat, DynastyNerdsRawRow[]>> & {
  _meta?: {
    publishedDate?: string | null;
    source?: string | null;
  };
};

const DYNASTY_NERDS_URL = 'https://www.dynastynerds.com/dynasty-rankings/';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

let cachedPayload: { loadedAt: number; payload: DynastyNerdsPayload } | null = null;

function isFresh(cache: { loadedAt: number } | null): boolean {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function toNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeNumQbs(numQbs?: number): 1 | 2 {
  return numQbs && numQbs >= 2 ? 2 : 1;
}

function normalizePpr(ppr?: number): 0 | 0.5 | 1 {
  const value = Number(ppr ?? 1);
  if (value <= 0.25) return 0;
  if (value < 0.75) return 0.5;
  return 1;
}

function normalizeTep(tep?: number): 0 | 0.5 | 1 | 1.5 {
  const value = Number(tep ?? 0);
  if (value >= 1.25) return 1.5;
  if (value >= 0.75) return 1;
  if (value >= 0.25) return 0.5;
  return 0;
}

function rankToValue(rank: number | null): number | undefined {
  if (!rank || rank <= 0) return undefined;
  const rankCap = 340;
  const score = Math.max(0.02, (rankCap - rank + 1) / rankCap);
  return Math.max(50, Math.round(10250 * Math.pow(score, 1.5)));
}

function calculateAge(dob?: string | null): number | null {
  if (!dob || dob.startsWith('0001')) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed = today.getMonth() > birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age > 0 && age < 80 ? age : null;
}

function extractDynastyNerdsPayload(html: string): DynastyNerdsPayload | null {
  const directMatch = html.match(/var\s+DR_DATA\s*=\s*({[\s\S]*?});\s*var\s+DR_CONFIG/);
  if (directMatch) {
    try {
      return JSON.parse(directMatch[1]) as DynastyNerdsPayload;
    } catch (error) {
      console.warn('[Dynasty Nerds] Failed to parse matched DR_DATA payload:', error);
    }
  }

  const marker = 'var DR_DATA = ';
  const start = html.indexOf(marker);
  if (start >= 0) {
    const payloadStart = start + marker.length;
    const remaining = html.slice(payloadStart);
    const configOffset = remaining.search(/;\s*var\s+DR_CONFIG/);
    const configStart = configOffset >= 0 ? payloadStart + configOffset : -1;
    const fallbackEnd = html.indexOf('</script>', payloadStart);
    const payloadEnd = configStart >= 0 ? configStart : fallbackEnd;
    if (payloadEnd > payloadStart) {
      const rawPayload = html.slice(payloadStart, payloadEnd).trim().replace(/;$/, '');
      try {
        return JSON.parse(rawPayload) as DynastyNerdsPayload;
      } catch (error) {
        console.warn('[Dynasty Nerds] Failed to parse DR_DATA payload:', error);
      }
    }
  }

  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!jsonLdMatch) return null;

  try {
    const jsonLd = JSON.parse(jsonLdMatch[1]) as {
      itemListElement?: Array<{ position?: number; name?: string }>;
    };
    const rows = (jsonLd.itemListElement || [])
      .map((item) => ({
        firstName: item.name?.split(/\s+/).slice(0, -1).join(' ') || item.name,
        lastName: item.name?.split(/\s+/).slice(-1).join(' ') || '',
        rank: item.position,
        value: rankToValue(Number(item.position) || null),
      }))
      .filter((item) => item.firstName);
    return { PPR: rows };
  } catch (error) {
    console.warn('[Dynasty Nerds] Failed to parse JSON-LD rankings fallback:', error);
    return null;
  }
}

async function fetchDynastyNerdsPayload(force = false): Promise<DynastyNerdsPayload> {
  if (!force && isFresh(cachedPayload)) return cachedPayload!.payload;

  try {
    const response = await fetch(DYNASTY_NERDS_URL, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'DynastyDegeneratesBot/1.0 rankings-source-check',
      },
    });
    if (!response.ok) throw new Error(`Dynasty Nerds ${response.status}`);

    const html = await response.text();
    const payload = extractDynastyNerdsPayload(html) || {};
    cachedPayload = { loadedAt: Date.now(), payload };
    return payload;
  } catch (error) {
    console.warn('[Dynasty Nerds] Failed to load rankings:', error);
    return cachedPayload?.payload || {};
  }
}

function normalizeDynastyNerdsRows(
  rows: DynastyNerdsRawRow[],
  format: DynastyNerdsFormat,
  lastUpdated?: string | null
): Record<string, DynastyNerdsValue> {
  const values: Record<string, DynastyNerdsValue> = {};

  for (const row of rows || []) {
    const name = `${row.firstName || ''} ${row.lastName || ''}`.trim();
    if (!name) continue;

    const position = String(row.pos || '').toUpperCase();
    const overallRank = toNumber(row.rank);
    const positionRankNumber = toNumber(row.posRank);
    const dynastyValue = toNumber(row.value) || rankToValue(overallRank);
    if (!dynastyValue) continue;

    values[cleanName(name)] = {
      name,
      position: ['QB', 'RB', 'WR', 'TE'].includes(position) ? position : undefined,
      team: row.team || null,
      age: toNumber(row.age) ?? calculateAge(row.dob),
      imageUrl: row.img || null,
      sleeperId: row.sleeperId === null || row.sleeperId === undefined ? null : String(row.sleeperId),
      dynastyValue,
      overallRank: overallRank ?? undefined,
      positionRank: position && positionRankNumber ? `${position}${Math.round(positionRankNumber)}` : null,
      rankDelta: toNumber(row.rankDelta) ?? toNumber(row.trend),
      lastUpdated: lastUpdated || null,
      format,
      sourceUrl: DYNASTY_NERDS_URL,
    };
  }

  return values;
}

export function getDynastyNerdsFormat(options: ValueBlendOptions = {}): DynastyNerdsFormat {
  const numQbs = normalizeNumQbs(options.numQbs);
  const ppr = normalizePpr(options.ppr);
  const tep = normalizeTep(options.tep);

  if (numQbs === 2 && tep > 0) return 'SFLEXTEP';
  if (numQbs === 2) return 'SFLEX';
  if (ppr === 0) return 'STD';
  return 'PPR';
}

export async function fetchDynastyNerdsRankings(format: DynastyNerdsFormat): Promise<Record<string, DynastyNerdsValue>> {
  const payload = await fetchDynastyNerdsPayload();
  return normalizeDynastyNerdsRows(payload[format] || payload.PPR || [], format, payload._meta?.publishedDate || null);
}

export async function fetchDynastyNerdsValues(options: ValueBlendOptions = {}): Promise<Record<string, DynastyNerdsValue>> {
  return fetchDynastyNerdsRankings(getDynastyNerdsFormat(options));
}

export async function loadDynastyNerdsValueProfiles(): Promise<Record<DynastyNerdsFormat, Record<string, DynastyNerdsValue>>> {
  const payload = await fetchDynastyNerdsPayload();
  const lastUpdated = payload._meta?.publishedDate || null;

  return {
    PPR: normalizeDynastyNerdsRows(payload.PPR || [], 'PPR', lastUpdated),
    SFLEX: normalizeDynastyNerdsRows(payload.SFLEX || payload.PPR || [], 'SFLEX', lastUpdated),
    STD: normalizeDynastyNerdsRows(payload.STD || payload.PPR || [], 'STD', lastUpdated),
    SFLEXTEP: normalizeDynastyNerdsRows(payload.SFLEXTEP || payload.SFLEX || payload.PPR || [], 'SFLEXTEP', lastUpdated),
  };
}
