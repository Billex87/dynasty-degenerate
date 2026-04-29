import { cleanName } from './leagueAnalysis';
import { fetchFantasyProsDraftRankings } from './fantasyPros';

export interface BlendedValue {
  name: string;
  ktc_value: number;
  position_rank?: string;
  dynasty_value?: number;
  true_value?: number;
  redraft_value?: number;
  market_value_ktc?: number;
  market_value_fantasycalc?: number;
  expert_value_dynastyprocess?: number;
  fantasypros_rank?: number;
  fantasypros_position_rank?: string | null;
  fantasypros_tier?: number | null;
  fantasypros_season_value?: number;
  value_sources?: string[];
}

type ValueMap = Record<string, BlendedValue>;

interface FantasyCalcValue {
  player?: {
    name?: string;
    position?: string;
    sleeperId?: string;
  };
  value?: number;
  redraftValue?: number;
}

interface ExternalValue {
  name: string;
  position?: string;
  dynastyValue?: number;
  redraftValue?: number;
  rankOverall?: number;
  rankPosition?: string | null;
  tier?: number | null;
  seasonValue?: number;
}

const FANTASYCALC_URL = 'https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=2&numTeams=12&ppr=1';
const DYNASTYPROCESS_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/values-players.csv';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

let cachedFantasyCalc: { loadedAt: number; values: Record<string, ExternalValue> } | null = null;
let cachedDynastyProcess: { loadedAt: number; values: Record<string, ExternalValue> } | null = null;

function isFresh(cache: { loadedAt: number } | null): boolean {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

async function fetchFantasyCalcValues(): Promise<Record<string, ExternalValue>> {
  if (isFresh(cachedFantasyCalc)) return cachedFantasyCalc!.values;

  try {
    const response = await fetch(FANTASYCALC_URL);
    if (!response.ok) throw new Error(`FantasyCalc ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) return {};

    const entries: Array<[string, ExternalValue]> = [];
    for (const row of rows as FantasyCalcValue[]) {
      const name = row.player?.name;
      if (!name) continue;
      entries.push([
        cleanName(name),
        {
          name,
          position: row.player?.position,
          dynastyValue: Number(row.value) || undefined,
          redraftValue: Number(row.redraftValue) || undefined,
        },
      ]);
    }
    const values = Object.fromEntries(entries);

    cachedFantasyCalc = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn('[Value Blend] Failed to load FantasyCalc values:', error);
    return cachedFantasyCalc?.values || {};
  }
}

async function fetchDynastyProcessValues(): Promise<Record<string, ExternalValue>> {
  if (isFresh(cachedDynastyProcess)) return cachedDynastyProcess!.values;

  try {
    const response = await fetch(DYNASTYPROCESS_URL);
    if (!response.ok) throw new Error(`DynastyProcess ${response.status}`);
    const csv = await response.text();
    const lines = csv.trim().split(/\r?\n/);
    const headers = parseCsvLine(lines[0] || '');
    const indexOf = (header: string) => headers.indexOf(header);
    const playerIndex = indexOf('player');
    const posIndex = indexOf('pos');
    const valueIndex = indexOf('value_2qb');

    if (playerIndex < 0 || valueIndex < 0) return {};

    const values: Record<string, ExternalValue> = {};
    for (const line of lines.slice(1)) {
      const columns = parseCsvLine(line);
      const name = columns[playerIndex];
      const dynastyValue = Number(columns[valueIndex]);
      if (!name || !Number.isFinite(dynastyValue)) continue;
      values[cleanName(name)] = {
        name,
        position: posIndex >= 0 ? columns[posIndex] : undefined,
        dynastyValue,
      };
    }

    cachedDynastyProcess = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn('[Value Blend] Failed to load DynastyProcess values:', error);
    return cachedDynastyProcess?.values || {};
  }
}

function weightedAverage(values: Array<{ value?: number; weight: number }>): number {
  const available = values.filter((item) => typeof item.value === 'number' && Number.isFinite(item.value));
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return available.reduce((sum, item) => sum + (item.value || 0) * item.weight, 0) / totalWeight;
}

function getPosition(entry: BlendedValue, fantasyCalc?: ExternalValue, dynastyProcess?: ExternalValue): string | null {
  const rankPosition = entry.position_rank?.match(/^[A-Z]+/)?.[0];
  const position = rankPosition || fantasyCalc?.position || dynastyProcess?.position || null;
  return ['QB', 'RB', 'WR', 'TE'].includes(position || '') ? position : null;
}

function rankBlendedValues(values: ValueMap): ValueMap {
  const ranked = { ...values };

  for (const position of ['QB', 'RB', 'WR', 'TE']) {
    Object.entries(ranked)
      .filter(([, value]) => getPosition(value) === position)
      .sort(([, a], [, b]) => (b.true_value || b.ktc_value) - (a.true_value || a.ktc_value))
      .forEach(([key], index) => {
        ranked[key] = {
          ...ranked[key],
          position_rank: `${position}${index + 1}`,
        };
      });
  }

  return ranked;
}

export async function loadBlendedPlayerValues(ktcValues: ValueMap): Promise<ValueMap> {
  const [fantasyCalcValues, dynastyProcessValues, fantasyProsRankings] = await Promise.all([
    fetchFantasyCalcValues(),
    fetchDynastyProcessValues(),
    fetchFantasyProsDraftRankings(),
  ]);

  const keys = new Set([
    ...Object.keys(ktcValues),
    ...Object.keys(fantasyCalcValues),
    ...Object.keys(dynastyProcessValues),
    ...Object.keys(fantasyProsRankings),
  ]);

  const blended: ValueMap = {};

  for (const key of Array.from(keys)) {
    const ktc = ktcValues[key];
    const fantasyCalc = fantasyCalcValues[key];
    const dynastyProcess = dynastyProcessValues[key];
    const fantasyPros = fantasyProsRankings[key];
    const name = ktc?.name || fantasyCalc?.name || dynastyProcess?.name || fantasyPros?.name || key;
    const position = getPosition(ktc || { name, ktc_value: 0, position_rank: fantasyPros?.positionRank || undefined }, fantasyCalc, dynastyProcess)
      || fantasyPros?.position
      || null;
    const ktcValue = ktc?.ktc_value;
    const fantasyCalcDynasty = fantasyCalc?.dynastyValue;
    const dynastyProcessValue = dynastyProcess?.dynastyValue;
    const dynastyValue = weightedAverage([
      { value: ktcValue, weight: 0.45 },
      { value: fantasyCalcDynasty, weight: 0.35 },
      { value: dynastyProcessValue, weight: 0.20 },
    ]);

    if (!dynastyValue) continue;

    const fantasyProsSeasonValue = fantasyPros?.seasonValue;
    const redraftValue = weightedAverage([
      { value: fantasyCalc?.redraftValue, weight: 0.55 },
      { value: fantasyProsSeasonValue, weight: 0.45 },
    ]) || undefined;
    const trueValue = redraftValue
      ? weightedAverage([
          { value: dynastyValue, weight: 0.70 },
          { value: redraftValue, weight: 0.30 },
        ])
      : dynastyValue;
    const isPick = !position && /\d{4}.*(1st|2nd|3rd|4th|5th)/i.test(name);

    blended[key] = {
      name,
      ktc_value: Math.round(dynastyValue),
      dynasty_value: Math.round(dynastyValue),
      true_value: Math.round(trueValue),
      redraft_value: redraftValue ? Math.round(redraftValue) : undefined,
      position_rank: ktc?.position_rank || fantasyPros?.positionRank || undefined,
      market_value_ktc: ktcValue,
      market_value_fantasycalc: fantasyCalcDynasty,
      expert_value_dynastyprocess: dynastyProcessValue,
      fantasypros_rank: fantasyPros?.overallRank,
      fantasypros_position_rank: fantasyPros?.positionRank ?? undefined,
      fantasypros_tier: fantasyPros?.tier ?? undefined,
      fantasypros_season_value: fantasyProsSeasonValue,
      value_sources: [
        ktcValue ? 'KTC' : null,
        fantasyCalcDynasty ? 'FantasyCalc' : null,
        dynastyProcessValue ? 'DynastyProcess' : null,
        fantasyProsSeasonValue ? 'FantasyPros' : null,
      ].filter(Boolean) as string[],
    };

    if (isPick && ktc?.position_rank) {
      blended[key].position_rank = ktc.position_rank;
    }
  }

  return rankBlendedValues(blended);
}
