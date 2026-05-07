import fs from 'fs';
import path from 'path';
import { getCurrentKTCRankingProfiles, getCurrentKTCRankings } from './liveKTCScraper';
import {
  getKtcProfileKeyForValueOptions,
  getValueSourceProfileKey,
  loadBlendedPlayerValues,
  type KtcSnapshotProfileKey,
  type ValueBlendOptions,
} from './valueBlend';

interface KTCValues {
  [key: string]: {
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
    value_sources?: string[];
    benchmark_sources?: string[];
  };
}

type KtcProfileValues = Record<KtcSnapshotProfileKey, KTCValues>;

let ktcValuesCache: KTCValues | null = null;
let ktcValuesLastWeekCache: KTCValues | null = null;
let blendedKtcValuesCache: Record<string, KTCValues> = {};
const localKtcSnapshotCache = new Map<string, KTCValues>();
const KTC_SNAPSHOT_TIME_ZONE = 'America/Vancouver';
const BLENDED_VALUE_PROFILE_KEY_PATTERN = /^(10|12|14)_(one_qb|sf)_(standard|half_ppr|ppr)_(base|tep_0_5|tep_1_0|tep_1_5)$/;
const PRIMARY_VALUE_SOURCES = new Set(['FlockFantasy', 'DynastyNerds', 'KTC', 'FantasyCalc', 'DynastyProcess']);

export const KTC_SNAPSHOT_DIR = path.join(process.cwd(), 'server', 'ktc-snapshots');

function getSnapshotDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KTC_SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export async function loadKTCValues(): Promise<KTCValues> {
  if (ktcValuesCache) return ktcValuesCache;

  const staticValues = loadStaticKTCValues('ktc_values.json');
  const liveValues = await loadLiveKTCValues();
  if (Object.keys(liveValues).length > 0) {
    ktcValuesCache = {
      ...staticValues,
      ...liveValues,
    };
    return ktcValuesCache;
  }

  ktcValuesCache = staticValues;
  return ktcValuesCache;
}

export async function loadBlendedKTCValues(options: ValueBlendOptions = {}): Promise<KTCValues> {
  const ktcProfileKey = options.ktcProfileKey || getKtcProfileKeyForValueOptions(options);
  const cacheKey = getValueSourceProfileKey({ ...options, ktcProfileKey });
  if (blendedKtcValuesCache[cacheKey]) return blendedKtcValuesCache[cacheKey];

  const storedSnapshotValues = loadLatestLocalKtcSnapshotDaysAgo(0, cacheKey);
  if (Object.keys(storedSnapshotValues).length > 0) {
    blendedKtcValuesCache[cacheKey] = storedSnapshotValues;
    return blendedKtcValuesCache[cacheKey];
  }

  const defaultKtcValues = await loadKTCValues();
  let profileKtcValues = defaultKtcValues;

  if (ktcProfileKey !== 'sf_ppr') {
    const profiles = await loadLiveKTCValueProfiles(false);
    const selectedProfile = profiles[ktcProfileKey];
    if (selectedProfile && Object.keys(selectedProfile).length > 0) {
      profileKtcValues = {
        ...defaultKtcValues,
        ...selectedProfile,
      };
    }
  }

  blendedKtcValuesCache[cacheKey] = await loadBlendedPlayerValues(profileKtcValues, {
    ...options,
    ktcProfileKey,
  });
  return blendedKtcValuesCache[cacheKey];
}

function loadStaticKTCValues(fileName: string): KTCValues {
  try {
    const filePath = path.join(process.cwd(), 'client', 'public', fileName);
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) || {};
  } catch (error) {
    console.error('Failed to load KTC values:', error);
    return {};
  }
}

function unwrapSnapshotValues(data: any, valueProfileKey?: string): KTCValues {
  if (
    valueProfileKey &&
    data &&
    typeof data === 'object' &&
    data.blendedProfiles &&
    typeof data.blendedProfiles === 'object' &&
    data.blendedProfiles[valueProfileKey] &&
    typeof data.blendedProfiles[valueProfileKey] === 'object'
  ) {
    return data.blendedProfiles[valueProfileKey] as KTCValues;
  }

  if (data && typeof data === 'object' && data.values && typeof data.values === 'object') {
    return data.values as KTCValues;
  }

  return (data || {}) as KTCValues;
}

export function hasUsableBlendedSnapshotValues(values: KTCValues, valueProfileKey?: string): boolean {
  const rows = Object.values(values || {});
  if (!rows.length) return false;
  if (!valueProfileKey || !BLENDED_VALUE_PROFILE_KEY_PATTERN.test(valueProfileKey)) return true;

  return rows.some((value) => (
    Array.isArray(value.value_sources)
    && value.value_sources.some((source) => PRIMARY_VALUE_SOURCES.has(source))
  ));
}

export async function loadLiveKTCValues(forceRefresh = false): Promise<KTCValues> {
  try {
    const rankings = await getCurrentKTCRankings(forceRefresh);
    return Object.fromEntries(
      Object.entries(rankings).map(([key, player]) => [
        key,
        {
          name: player.name,
          ktc_value: player.ktc_value,
          position_rank: player.position_rank,
        },
      ])
    );
  } catch (error) {
    console.warn('Failed to load live KTC values:', error);
    return {};
  }
}

export async function loadLiveKTCValueProfiles(forceRefresh = false): Promise<Partial<KtcProfileValues>> {
  try {
    const profiles = await getCurrentKTCRankingProfiles(forceRefresh);
    return Object.fromEntries(
      Object.entries(profiles).map(([profileKey, rankings]) => [
        profileKey,
        Object.fromEntries(
          Object.entries(rankings).map(([key, player]) => [
            key,
            {
              name: player.name,
              ktc_value: player.ktc_value,
              position_rank: player.position_rank,
            },
          ])
        ),
      ])
    ) as Partial<KtcProfileValues>;
  } catch (error) {
    console.warn('Failed to load live KTC value profiles:', error);
    return {};
  }
}

export async function loadKTCValuesLastWeek(): Promise<KTCValues> {
  if (ktcValuesLastWeekCache) return ktcValuesLastWeekCache;

  ktcValuesLastWeekCache = loadStaticKTCValues('ktc_values_last_week.json');
  return ktcValuesLastWeekCache;
}

export function loadLatestLocalKtcSnapshot(): KTCValues {
  return loadLatestLocalKtcSnapshotBefore(new Date());
}

export function listLocalKtcSnapshotDateKeysSince(startDate: Date): string[] {
  try {
    if (!fs.existsSync(KTC_SNAPSHOT_DIR)) return [];
    const startDateKey = getSnapshotDateKey(startDate);
    return fs
      .readdirSync(KTC_SNAPSHOT_DIR)
      .map((file) => file.match(/^ktc-snapshot-(\d{4}-\d{2}-\d{2})\.json$/)?.[1] || null)
      .filter((dateKey): dateKey is string => Boolean(dateKey && dateKey >= startDateKey))
      .sort();
  } catch (error) {
    console.error('Failed to list local KTC snapshots:', error);
    return [];
  }
}

export function loadLocalKtcSnapshotForDate(dateKey: string, valueProfileKey?: string): KTCValues {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return {};
    const cacheKey = `date:${dateKey}:${valueProfileKey || 'default'}`;
    const cached = localKtcSnapshotCache.get(cacheKey);
    if (cached) return cached;

    const filePath = path.join(KTC_SNAPSHOT_DIR, `ktc-snapshot-${dateKey}.json`);
    if (!fs.existsSync(filePath)) return {};

    const data = fs.readFileSync(filePath, 'utf-8');
    const values = unwrapSnapshotValues(JSON.parse(data), valueProfileKey);
    localKtcSnapshotCache.set(cacheKey, values);
    return values;
  } catch (error) {
    console.error('Failed to load local KTC snapshot:', error);
    return {};
  }
}

export function loadLatestLocalKtcSnapshotBefore(beforeDate: Date, valueProfileKey?: string): KTCValues {
  try {
    if (!fs.existsSync(KTC_SNAPSHOT_DIR)) return {};
    const beforeDateKey = getSnapshotDateKey(beforeDate);
    const cacheKey = `before:${beforeDateKey}:${valueProfileKey || 'default'}`;
    const cached = localKtcSnapshotCache.get(cacheKey);
    if (cached) return cached;

    const snapshotFiles = fs
      .readdirSync(KTC_SNAPSHOT_DIR)
      .filter(file => /^ktc-snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .filter(file => file.replace('ktc-snapshot-', '').replace('.json', '') < beforeDateKey)
      .sort();

    for (const snapshotFile of snapshotFiles.reverse()) {
      const data = fs.readFileSync(path.join(KTC_SNAPSHOT_DIR, snapshotFile), 'utf-8');
      const values = unwrapSnapshotValues(JSON.parse(data), valueProfileKey);
      if (!hasUsableBlendedSnapshotValues(values, valueProfileKey)) {
        console.warn(`[KTC Snapshot] Skipping ${snapshotFile} for ${valueProfileKey || 'default'} because it is missing blended source metadata`);
        continue;
      }

      localKtcSnapshotCache.set(cacheKey, values);
      return values;
    }

    return {};
  } catch (error) {
    console.error('Failed to load local KTC snapshot:', error);
    return {};
  }
}

export function loadLatestLocalKtcSnapshotDaysAgo(daysAgo: number, valueProfileKey?: string): KTCValues {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  targetDate.setDate(targetDate.getDate() + 1);
  return loadLatestLocalKtcSnapshotBefore(targetDate, valueProfileKey);
}

export function saveLocalKtcSnapshot(date: Date, ktcData: unknown): string | null {
  try {
    if (!fs.existsSync(KTC_SNAPSHOT_DIR)) {
      fs.mkdirSync(KTC_SNAPSHOT_DIR, { recursive: true });
    }

    const dateKey = getSnapshotDateKey(date);
    const filePath = path.join(KTC_SNAPSHOT_DIR, `ktc-snapshot-${dateKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(ktcData));
    return filePath;
  } catch (error) {
    console.error('Failed to save local KTC snapshot:', error);
    return null;
  }
}

export function clearKTCCache() {
  ktcValuesCache = null;
  ktcValuesLastWeekCache = null;
  blendedKtcValuesCache = {};
  localKtcSnapshotCache.clear();
}

export { getSnapshotDateKey, KTC_SNAPSHOT_TIME_ZONE };
