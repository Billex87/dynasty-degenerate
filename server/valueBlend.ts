import { canonicalPlayerNameKey, cleanName } from './leagueAnalysis';
import { fetchFantasyProsDraftRankings, type FantasyProsRanking } from './fantasyPros';
import { fetchFlockFantasyValues, loadFlockFantasyValueProfiles, type FlockFantasyValue } from './flockFantasy';
import { fetchDynastyNerdsValues, getDynastyNerdsFormat, loadDynastyNerdsValueProfiles, type DynastyNerdsValue } from './dynastyNerds';
import { fetchDynastyDealerPlayerValues, type DynastyDealerValue } from './dynastyDealer';
import { getDynastySourceWeights } from './dynastySourceWeights';

export interface BlendedValue {
  name: string;
  ktc_value: number;
  position_rank?: string;
  dynasty_value?: number;
  true_value?: number;
  redraft_value?: number;
  market_value_ktc?: number;
  expert_value_flock?: number;
  flock_rank?: number;
  flock_position_rank?: string | null;
  flock_tier?: number | null;
  flock_format?: string | null;
  market_value_fantasycalc?: number;
  expert_value_dynastyprocess?: number;
  expert_value_dynastynerds?: number;
  dynastynerds_rank?: number;
  dynastynerds_position_rank?: string | null;
  dynastynerds_format?: string | null;
  benchmark_value_dynastydealer?: number;
  dynastydealer_vote_rating?: number | null;
  dynastydealer_updated_at?: string | null;
  fantasypros_rank?: number;
  fantasypros_position_rank?: string | null;
  fantasypros_tier?: number | null;
  fantasypros_season_value?: number;
  value_sources?: string[];
  benchmark_sources?: string[];
}

type ValueMap = Record<string, BlendedValue>;
type KtcRankingProfile = 'superflex' | 'one_qb';
type KtcTepProfile = 'base' | 'tep_0_5' | 'tep_1_0' | 'tep_1_5';
export type FantasyProsScoring = 'STD' | 'HALF' | 'PPR';

export type KtcSnapshotProfileKey =
  | 'sf_ppr'
  | 'sf_ppr_tep_0_5'
  | 'sf_ppr_tep_1_0'
  | 'sf_ppr_tep_1_5'
  | 'one_qb_ppr'
  | 'one_qb_ppr_tep_0_5'
  | 'one_qb_ppr_tep_1_0'
  | 'one_qb_ppr_tep_1_5';

export interface KtcSnapshotProfileDefinition {
  key: KtcSnapshotProfileKey;
  label: string;
  qbProfile: KtcRankingProfile;
  tepProfile: KtcTepProfile;
  ppr: number;
}

export interface ValueBlendOptions {
  numQbs?: 1 | 2;
  numTeams?: number;
  ppr?: number;
  tep?: number;
  fantasyProsScoring?: FantasyProsScoring;
  ktcProfileKey?: KtcSnapshotProfileKey;
}

export interface ValueSourceProfileDefinition {
  key: string;
  label: string;
  numQbs: 1 | 2;
  numTeams: number;
  ppr: 0 | 0.5 | 1;
  tep: 0 | 0.5 | 1 | 1.5;
  fantasyProsScoring: FantasyProsScoring;
  ktcProfileKey: KtcSnapshotProfileKey;
}

export const KTC_SNAPSHOT_PROFILES: KtcSnapshotProfileDefinition[] = [
  { key: 'sf_ppr', label: 'Superflex PPR', qbProfile: 'superflex', tepProfile: 'base', ppr: 1 },
  { key: 'sf_ppr_tep_0_5', label: 'Superflex PPR 0.5 TEP', qbProfile: 'superflex', tepProfile: 'tep_0_5', ppr: 1 },
  { key: 'sf_ppr_tep_1_0', label: 'Superflex PPR 1.0 TEP', qbProfile: 'superflex', tepProfile: 'tep_1_0', ppr: 1 },
  { key: 'sf_ppr_tep_1_5', label: 'Superflex PPR 1.5 TEP', qbProfile: 'superflex', tepProfile: 'tep_1_5', ppr: 1 },
  { key: 'one_qb_ppr', label: '1QB PPR', qbProfile: 'one_qb', tepProfile: 'base', ppr: 1 },
  { key: 'one_qb_ppr_tep_0_5', label: '1QB PPR 0.5 TEP', qbProfile: 'one_qb', tepProfile: 'tep_0_5', ppr: 1 },
  { key: 'one_qb_ppr_tep_1_0', label: '1QB PPR 1.0 TEP', qbProfile: 'one_qb', tepProfile: 'tep_1_0', ppr: 1 },
  { key: 'one_qb_ppr_tep_1_5', label: '1QB PPR 1.5 TEP', qbProfile: 'one_qb', tepProfile: 'tep_1_5', ppr: 1 },
];

function getPprKey(ppr: 0 | 0.5 | 1): string {
  if (ppr === 1) return 'ppr';
  if (ppr === 0.5) return 'half_ppr';
  return 'standard';
}

function getPprLabel(ppr: 0 | 0.5 | 1): string {
  if (ppr === 1) return 'PPR';
  if (ppr === 0.5) return 'Half-PPR';
  return 'Standard';
}

function getTepKey(tep: 0 | 0.5 | 1 | 1.5): string {
  if (tep === 1.5) return 'tep_1_5';
  if (tep === 1) return 'tep_1_0';
  if (tep === 0.5) return 'tep_0_5';
  return 'base';
}

function getTepLabel(tep: 0 | 0.5 | 1 | 1.5): string | null {
  if (tep === 1.5) return '1.5 TEP';
  if (tep === 1) return '1.0 TEP';
  if (tep === 0.5) return '0.5 TEP';
  return null;
}

export function getFantasyProsScoringForPpr(ppr?: number): FantasyProsScoring {
  const normalizedPpr = normalizePpr(ppr);
  if (normalizedPpr === 1) return 'PPR';
  if (normalizedPpr === 0) return 'STD';
  return 'HALF';
}

function getFantasyProsScoring(ppr: 0 | 0.5 | 1): FantasyProsScoring {
  if (ppr === 1) return 'PPR';
  if (ppr === 0) return 'STD';
  return 'HALF';
}

export function normalizeTeamCount(numTeams?: number): 10 | 12 | 14 {
  if (!numTeams || !Number.isFinite(numTeams)) return 12;
  if (numTeams <= 10) return 10;
  if (numTeams >= 14) return 14;
  return 12;
}

export function normalizePpr(ppr?: number): 0 | 0.5 | 1 {
  const value = Number(ppr ?? 1);
  if (value <= 0.25) return 0;
  if (value < 0.75) return 0.5;
  return 1;
}

export function normalizeTep(tep?: number): 0 | 0.5 | 1 | 1.5 {
  const value = Number(tep ?? 0);
  if (value >= 1.25) return 1.5;
  if (value >= 0.75) return 1;
  if (value >= 0.25) return 0.5;
  return 0;
}

export function normalizeNumQbs(numQbs?: number): 1 | 2 {
  return numQbs && numQbs >= 2 ? 2 : 1;
}

export function getKtcProfileKeyForValueOptions(options: ValueBlendOptions = {}): KtcSnapshotProfileKey {
  const qbPrefix = normalizeNumQbs(options.numQbs) === 2 ? 'sf_ppr' : 'one_qb_ppr';
  const tep = normalizeTep(options.tep);
  if (tep === 1.5) return `${qbPrefix}_tep_1_5` as KtcSnapshotProfileKey;
  if (tep === 1) return `${qbPrefix}_tep_1_0` as KtcSnapshotProfileKey;
  if (tep === 0.5) return `${qbPrefix}_tep_0_5` as KtcSnapshotProfileKey;
  return qbPrefix as KtcSnapshotProfileKey;
}

export function getValueSourceProfileKey(options: ValueBlendOptions = {}): string {
  const numTeams = normalizeTeamCount(options.numTeams);
  const numQbs = normalizeNumQbs(options.numQbs);
  const ppr = normalizePpr(options.ppr);
  const tep = normalizeTep(options.tep);
  return [
    numTeams,
    numQbs === 2 ? 'sf' : 'one_qb',
    getPprKey(ppr),
    getTepKey(tep),
  ].join('_');
}

export function getValueSourceProfileLabel(options: ValueBlendOptions = {}): string {
  const numTeams = normalizeTeamCount(options.numTeams);
  const numQbs = normalizeNumQbs(options.numQbs);
  const ppr = normalizePpr(options.ppr);
  const tep = normalizeTep(options.tep);
  return [
    `${numTeams}-team`,
    numQbs === 2 ? 'SF' : '1QB',
    getPprLabel(ppr),
    getTepLabel(tep),
  ].filter(Boolean).join(' ');
}

export const VALUE_SOURCE_PROFILE_DEFINITIONS: ValueSourceProfileDefinition[] = [10, 12, 14].flatMap((numTeams) =>
  ([1, 2] as const).flatMap((numQbs) =>
    ([0, 0.5, 1] as const).flatMap((ppr) =>
      ([0, 0.5, 1, 1.5] as const).map((tep) => ({
        key: getValueSourceProfileKey({ numTeams, numQbs, ppr, tep }),
        label: getValueSourceProfileLabel({ numTeams, numQbs, ppr, tep }),
        numQbs,
        numTeams,
        ppr,
        tep,
        fantasyProsScoring: getFantasyProsScoring(ppr),
        ktcProfileKey: getKtcProfileKeyForValueOptions({ numQbs, tep }),
      }))
    )
  )
);

export const DEFAULT_VALUE_SOURCE_PROFILE_KEY = getValueSourceProfileKey({
  numTeams: 12,
  numQbs: 2,
  ppr: 1,
  tep: 0,
});

export function getValueSourceProfileDefinition(options: ValueBlendOptions = {}): ValueSourceProfileDefinition {
  const key = getValueSourceProfileKey(options);
  return VALUE_SOURCE_PROFILE_DEFINITIONS.find((profile) => profile.key === key) || VALUE_SOURCE_PROFILE_DEFINITIONS[0];
}

interface FantasyCalcValue {
  player?: {
    name?: string;
    position?: string;
    sleeperId?: string;
  };
  value?: number;
  redraftValue?: number;
}

export interface ExternalValue {
  name: string;
  position?: string;
  dynastyValue?: number;
  redraftValue?: number;
  rankOverall?: number;
  rankPosition?: string | null;
  tier?: number | null;
  seasonValue?: number;
}

interface BlendSourceValues {
  fantasyCalcValues: Record<string, ExternalValue>;
  dynastyProcessValues: Record<string, ExternalValue>;
  fantasyProsRankings: Record<string, FantasyProsRanking>;
  flockValues: Record<string, FlockFantasyValue>;
  dynastyNerdsValues: Record<string, DynastyNerdsValue>;
  dynastyDealerValues: Record<string, DynastyDealerValue>;
}

export interface ValueProfileSourceValues {
  fantasyCalc: Record<string, Record<string, ExternalValue>>;
  dynastyProcess: Record<'one_qb' | 'superflex', Record<string, ExternalValue>>;
  fantasyPros: Record<FantasyProsScoring, Record<string, FantasyProsRanking>>;
  flockFantasy: Awaited<ReturnType<typeof loadFlockFantasyValueProfiles>>;
  dynastyNerds: Awaited<ReturnType<typeof loadDynastyNerdsValueProfiles>>;
  dynastyDealerBenchmark: Record<string, DynastyDealerValue>;
}

const DYNASTYPROCESS_URL = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files/values-players.csv';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

let cachedFantasyCalc: Record<string, { loadedAt: number; values: Record<string, ExternalValue> }> = {};
let cachedDynastyProcess: Record<'one_qb' | 'superflex', { loadedAt: number; values: Record<string, ExternalValue> } | null> = {
  one_qb: null,
  superflex: null,
};

function isFresh(cache: { loadedAt: number } | null): boolean {
  return Boolean(cache && Date.now() - cache.loadedAt < CACHE_TTL_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function getFantasyCalcCacheKey(options: ValueBlendOptions = {}): string {
  return [
    'dynasty',
    normalizeNumQbs(options.numQbs),
    normalizeTeamCount(options.numTeams),
    normalizePpr(options.ppr),
  ].join(':');
}

function getFantasyCalcSourceProfileKey(options: ValueBlendOptions = {}): string {
  return [
    normalizeTeamCount(options.numTeams),
    normalizeNumQbs(options.numQbs) === 2 ? 'sf' : 'one_qb',
    getPprKey(normalizePpr(options.ppr)),
  ].join('_');
}

function getValueScore(value?: ExternalValue | FlockFantasyValue | DynastyNerdsValue | DynastyDealerValue | BlendedValue | FantasyProsRanking): number {
  const candidate = value as Record<string, any>;
  return Number(
    candidate.dynastyValue
      ?? candidate.currentValue
      ?? candidate.ktc_value
      ?? candidate.seasonValue
      ?? candidate.fantasypros_season_value
      ?? candidate.rankOverall
      ?? 0
  ) || 0;
}

function canonicalizeValueMap<T extends { name?: string }>(
  values: Record<string, T>
): Record<string, T> {
  const canonicalized: Record<string, T> = {};

  for (const [key, value] of Object.entries(values || {})) {
    const canonicalKey = canonicalPlayerNameKey(value?.name || key);
    if (!canonicalKey) continue;

    const existing = canonicalized[canonicalKey];
    if (!existing || getValueScore(value as any) >= getValueScore(existing as any)) {
      canonicalized[canonicalKey] = value;
    }
  }

  return canonicalized;
}

async function fetchFantasyCalcValues(options: ValueBlendOptions = {}): Promise<Record<string, ExternalValue>> {
  const cacheKey = getFantasyCalcCacheKey(options);
  if (isFresh(cachedFantasyCalc[cacheKey])) return cachedFantasyCalc[cacheKey].values;

  try {
    const params = new URLSearchParams({
      isDynasty: 'true',
      numQbs: String(normalizeNumQbs(options.numQbs)),
      numTeams: String(normalizeTeamCount(options.numTeams)),
      ppr: String(normalizePpr(options.ppr)),
    });
    const url = `https://api.fantasycalc.com/values/current?${params.toString()}`;
    let rows: unknown = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url);
      if (response.ok) {
        rows = await response.json();
        break;
      }

      const shouldRetry = [429, 500, 502, 503, 504].includes(response.status) && attempt < 2;
      if (!shouldRetry) throw new Error(`FantasyCalc ${response.status}`);
      await sleep(750 * Math.pow(2, attempt));
    }
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

    cachedFantasyCalc[cacheKey] = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn('[Value Blend] Failed to load FantasyCalc values:', error);
    return cachedFantasyCalc[cacheKey]?.values || {};
  }
}

async function fetchDynastyProcessValues(options: ValueBlendOptions = {}): Promise<Record<string, ExternalValue>> {
  const profile = normalizeNumQbs(options.numQbs) === 2 ? 'superflex' : 'one_qb';
  if (isFresh(cachedDynastyProcess[profile])) return cachedDynastyProcess[profile]!.values;

  try {
    const response = await fetch(DYNASTYPROCESS_URL);
    if (!response.ok) throw new Error(`DynastyProcess ${response.status}`);
    const csv = await response.text();
    const lines = csv.trim().split(/\r?\n/);
    const headers = parseCsvLine(lines[0] || '');
    const indexOf = (header: string) => headers.indexOf(header);
    const playerIndex = indexOf('player');
    const posIndex = indexOf('pos');
    const valueIndex = indexOf(profile === 'superflex' ? 'value_2qb' : 'value_1qb');

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

    cachedDynastyProcess[profile] = { loadedAt: Date.now(), values };
    return values;
  } catch (error) {
    console.warn('[Value Blend] Failed to load DynastyProcess values:', error);
    return cachedDynastyProcess[profile]?.values || {};
  }
}

function weightedAverage(values: Array<{ value?: number; weight: number }>): number {
  const available = values.filter((item) => typeof item.value === 'number' && Number.isFinite(item.value));
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return available.reduce((sum, item) => sum + (item.value || 0) * item.weight, 0) / totalWeight;
}

function getPosition(
  entry: BlendedValue,
  fantasyCalc?: ExternalValue,
  dynastyProcess?: ExternalValue,
  flock?: FlockFantasyValue,
  dynastyNerds?: DynastyNerdsValue
): string | null {
  const rankPosition = entry.position_rank?.match(/^[A-Z]+/)?.[0];
  const position = rankPosition || dynastyNerds?.position || flock?.position || fantasyCalc?.position || dynastyProcess?.position || null;
  return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position || '') ? position : null;
}

function isSeasonOnlyPosition(position?: string | null): boolean {
  return position === 'K' || position === 'DEF';
}

function rankBlendedValues(values: ValueMap): ValueMap {
  const ranked = { ...values };

  for (const position of ['QB', 'RB', 'WR', 'TE']) {
    Object.entries(ranked)
      .filter(([, value]) => getPosition(value) === position)
      .sort(([, a], [, b]) => (b.dynasty_value || b.ktc_value) - (a.dynasty_value || a.ktc_value))
      .forEach(([key], index) => {
        ranked[key] = {
          ...ranked[key],
          position_rank: `${position}${index + 1}`,
        };
      });
  }

  return ranked;
}

async function loadBlendSourceValues(options: ValueBlendOptions = {}): Promise<BlendSourceValues> {
  const [fantasyCalcValues, dynastyProcessValues, fantasyProsRankings, flockValues, dynastyNerdsValues, dynastyDealerValues] = await Promise.all([
    fetchFantasyCalcValues(options),
    fetchDynastyProcessValues(options),
    fetchFantasyProsDraftRankings(String(new Date().getFullYear()), options.fantasyProsScoring || 'HALF'),
    fetchFlockFantasyValues(options),
    fetchDynastyNerdsValues(options),
    fetchDynastyDealerPlayerValues(),
  ]);

  return {
    fantasyCalcValues,
    dynastyProcessValues,
    fantasyProsRankings,
    flockValues,
    dynastyNerdsValues,
    dynastyDealerValues,
  };
}

function blendPlayerValues(ktcValues: ValueMap, sourceValues: BlendSourceValues, options: ValueBlendOptions = {}): ValueMap {
  const fantasyCalcValues = canonicalizeValueMap(sourceValues.fantasyCalcValues);
  const dynastyProcessValues = canonicalizeValueMap(sourceValues.dynastyProcessValues);
  const fantasyProsRankings = canonicalizeValueMap(sourceValues.fantasyProsRankings);
  const flockValues = canonicalizeValueMap(sourceValues.flockValues);
  const dynastyNerdsValues = canonicalizeValueMap(sourceValues.dynastyNerdsValues);
  const dynastyDealerValues = canonicalizeValueMap(sourceValues.dynastyDealerValues);
  const canonicalKtcValues = canonicalizeValueMap(ktcValues);
  const dynastyWeights = getDynastySourceWeights(options);

  const keys = new Set([
    ...Object.keys(canonicalKtcValues),
    ...Object.keys(flockValues),
    ...Object.keys(dynastyNerdsValues),
    ...Object.keys(fantasyCalcValues),
    ...Object.keys(dynastyProcessValues),
    ...Object.keys(fantasyProsRankings),
    ...Object.keys(dynastyDealerValues),
  ]);

  const blended: ValueMap = {};

  for (const key of Array.from(keys)) {
    const ktc = canonicalKtcValues[key];
    const flock = flockValues[key];
    const fantasyCalc = fantasyCalcValues[key];
    const dynastyProcess = dynastyProcessValues[key];
    const fantasyPros = fantasyProsRankings[key];
    const dynastyNerds = dynastyNerdsValues[key];
    const dynastyDealer = dynastyDealerValues[key];
    const name = ktc?.name || dynastyNerds?.name || flock?.name || fantasyCalc?.name || dynastyProcess?.name || fantasyPros?.name || dynastyDealer?.name || key;
    const position = getPosition(
      ktc || { name, ktc_value: 0, position_rank: fantasyPros?.positionRank || undefined },
      fantasyCalc,
      dynastyProcess,
      flock,
      dynastyNerds
    )
      || dynastyNerds?.position
      || flock?.position
      || fantasyPros?.position
      || dynastyDealer?.position
      || null;
    const ktcValue = ktc?.ktc_value;
    const flockValue = flock?.dynastyValue;
    const dynastyNerdsValue = dynastyNerds?.dynastyValue;
    const fantasyCalcDynasty = fantasyCalc?.dynastyValue;
    const dynastyProcessValue = dynastyProcess?.dynastyValue;
    const dynastyValue = weightedAverage([
      { value: flockValue, weight: dynastyWeights.flock },
      { value: dynastyNerdsValue, weight: dynastyWeights.dynastyNerds },
      { value: ktcValue, weight: dynastyWeights.ktc },
      { value: fantasyCalcDynasty, weight: dynastyWeights.fantasyCalc },
      { value: dynastyProcessValue, weight: dynastyWeights.dynastyProcess },
    ]);

    const fantasyProsSeasonValue = fantasyPros?.seasonValue;
    const redraftValue = weightedAverage([
      { value: fantasyCalc?.redraftValue, weight: 0.55 },
      { value: fantasyProsSeasonValue, weight: 0.45 },
    ]) || undefined;
    const seasonOnlyPosition = isSeasonOnlyPosition(position);

    if (!dynastyValue && !seasonOnlyPosition) continue;
    if (seasonOnlyPosition && !redraftValue && !fantasyPros?.positionRank) continue;

    const isPick = !position && /\d{4}.*(1st|2nd|3rd|4th|5th)/i.test(name);

    blended[key] = {
      name,
      ktc_value: Math.round(dynastyValue),
      dynasty_value: Math.round(dynastyValue),
      true_value: Math.round(dynastyValue),
      redraft_value: redraftValue ? Math.round(redraftValue) : undefined,
      position_rank: ktc?.position_rank || dynastyNerds?.positionRank || flock?.positionRank || fantasyPros?.positionRank || undefined,
      market_value_ktc: ktcValue,
      expert_value_flock: flockValue,
      flock_rank: flock?.overallRank,
      flock_position_rank: flock?.positionRank ?? undefined,
      flock_tier: flock?.tier ?? undefined,
      flock_format: flock?.format ?? undefined,
      market_value_fantasycalc: fantasyCalcDynasty,
      expert_value_dynastyprocess: dynastyProcessValue,
      expert_value_dynastynerds: dynastyNerdsValue,
      dynastynerds_rank: dynastyNerds?.overallRank,
      dynastynerds_position_rank: dynastyNerds?.positionRank ?? undefined,
      dynastynerds_format: dynastyNerds?.format ?? undefined,
      benchmark_value_dynastydealer: dynastyDealer?.currentValue,
      dynastydealer_vote_rating: dynastyDealer?.voteRating ?? undefined,
      dynastydealer_updated_at: dynastyDealer?.updatedAt ?? undefined,
      fantasypros_rank: fantasyPros?.overallRank,
      fantasypros_position_rank: fantasyPros?.positionRank ?? undefined,
      fantasypros_tier: fantasyPros?.tier ?? undefined,
      fantasypros_season_value: fantasyProsSeasonValue,
      value_sources: [
        flockValue ? 'FlockFantasy' : null,
        dynastyNerdsValue ? 'DynastyNerds' : null,
        ktcValue ? 'KTC' : null,
        fantasyCalcDynasty ? 'FantasyCalc' : null,
        dynastyProcessValue ? 'DynastyProcess' : null,
      ].filter(Boolean) as string[],
      benchmark_sources: [
        dynastyDealer?.currentValue ? 'DynastyDealer' : null,
      ].filter(Boolean) as string[],
    };

    if (isPick && ktc?.position_rank) {
      blended[key].position_rank = ktc.position_rank;
    }
  }

  return rankBlendedValues(blended);
}

export async function loadBlendedPlayerValues(ktcValues: ValueMap, options: ValueBlendOptions = {}): Promise<ValueMap> {
  return blendPlayerValues(ktcValues, await loadBlendSourceValues(options), options);
}

export async function loadFantasyCalcValueProfiles(): Promise<Record<string, Record<string, ExternalValue>>> {
  const uniqueProfiles = new Map<string, ValueSourceProfileDefinition>();
  for (const profile of VALUE_SOURCE_PROFILE_DEFINITIONS) {
    uniqueProfiles.set(getFantasyCalcSourceProfileKey(profile), profile);
  }

  const valuesByProfile: Record<string, Record<string, ExternalValue>> = {};
  for (const [key, profile] of Array.from(uniqueProfiles.entries())) {
    valuesByProfile[key] = await fetchFantasyCalcValues(profile);
  }
  return valuesByProfile;
}

export async function loadDynastyProcessValueProfiles(): Promise<Record<'one_qb' | 'superflex', Record<string, ExternalValue>>> {
  const [oneQb, superflex] = await Promise.all([
    fetchDynastyProcessValues({ numQbs: 1 }),
    fetchDynastyProcessValues({ numQbs: 2 }),
  ]);
  return { one_qb: oneQb, superflex };
}

export async function loadFantasyProsValueProfiles(): Promise<Record<FantasyProsScoring, Record<string, FantasyProsRanking>>> {
  const [std, half, ppr] = await Promise.all([
    fetchFantasyProsDraftRankings(String(new Date().getFullYear()), 'STD'),
    fetchFantasyProsDraftRankings(String(new Date().getFullYear()), 'HALF'),
    fetchFantasyProsDraftRankings(String(new Date().getFullYear()), 'PPR'),
  ]);
  return { STD: std, HALF: half, PPR: ppr };
}

export { loadFlockFantasyValueProfiles };

export async function loadValueProfileSources(): Promise<ValueProfileSourceValues> {
  const [fantasyCalc, dynastyProcess, fantasyPros, flockFantasy, dynastyNerds, dynastyDealerBenchmark] = await Promise.all([
    loadFantasyCalcValueProfiles(),
    loadDynastyProcessValueProfiles(),
    loadFantasyProsValueProfiles(),
    loadFlockFantasyValueProfiles(),
    loadDynastyNerdsValueProfiles(),
    fetchDynastyDealerPlayerValues(),
  ]);

  return {
    fantasyCalc,
    dynastyProcess,
    fantasyPros,
    flockFantasy,
    dynastyNerds,
    dynastyDealerBenchmark,
  };
}

function getFlockProfileValues(
  profiles: Awaited<ReturnType<typeof loadFlockFantasyValueProfiles>>,
  options: ValueBlendOptions
): Record<string, FlockFantasyValue> {
  const fullFormat = normalizeNumQbs(options.numQbs) === 2 ? 'SUPERFLEX' : 'ONEQB';
  const rookieFormat = normalizeNumQbs(options.numQbs) === 2 ? 'PROSPECTS_SF' : 'PROSPECTS';
  return {
    ...(profiles[rookieFormat] || {}),
    ...(profiles[fullFormat] || {}),
  };
}

function getDynastyNerdsProfileValues(
  profiles: Awaited<ReturnType<typeof loadDynastyNerdsValueProfiles>>,
  options: ValueBlendOptions
): Record<string, DynastyNerdsValue> {
  return profiles[getDynastyNerdsFormat(options)] || profiles.PPR || {};
}

export async function loadBlendedValueProfiles(
  ktcProfiles: Partial<Record<KtcSnapshotProfileKey, ValueMap>>,
  sourceProfiles?: ValueProfileSourceValues
): Promise<Record<string, ValueMap>> {
  const sources = sourceProfiles || await loadValueProfileSources();

  const entries = VALUE_SOURCE_PROFILE_DEFINITIONS.map((profile) => {
    const ktcValues = ktcProfiles[profile.ktcProfileKey] || ktcProfiles.sf_ppr || {};
    const dynastyProcessKey = normalizeNumQbs(profile.numQbs) === 2 ? 'superflex' : 'one_qb';
    return [
      profile.key,
      blendPlayerValues(ktcValues, {
        fantasyCalcValues: sources.fantasyCalc[getFantasyCalcSourceProfileKey(profile)] || {},
        dynastyProcessValues: sources.dynastyProcess[dynastyProcessKey] || {},
        fantasyProsRankings: sources.fantasyPros[profile.fantasyProsScoring] || {},
        flockValues: getFlockProfileValues(sources.flockFantasy, profile),
        dynastyNerdsValues: getDynastyNerdsProfileValues(sources.dynastyNerds, profile),
        dynastyDealerValues: sources.dynastyDealerBenchmark || {},
      }, profile),
    ] as const;
  });
  return Object.fromEntries(entries);
}
