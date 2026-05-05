import fs from 'fs';
import path from 'path';
import { getCurrentKTCRankingProfiles, getCurrentKTCRankings, type KtcProfileKey } from './liveKTCScraper';
import { loadBlendedPlayerValues } from './valueBlend';

interface KTCValues {
  [key: string]: {
    name: string;
    ktc_value: number;
    position_rank?: string;
    dynasty_value?: number;
    true_value?: number;
    redraft_value?: number;
    market_value_ktc?: number;
    market_value_fantasycalc?: number;
    expert_value_dynastyprocess?: number;
    value_sources?: string[];
  };
}

type KtcProfileValues = Record<KtcProfileKey, KTCValues>;

let ktcValuesCache: KTCValues | null = null;
let ktcValuesLastWeekCache: KTCValues | null = null;
const KTC_SNAPSHOT_TIME_ZONE = 'America/Vancouver';

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

export async function loadBlendedKTCValues(): Promise<KTCValues> {
  const ktcValues = await loadKTCValues();
  return loadBlendedPlayerValues(ktcValues);
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

function unwrapSnapshotValues(data: any): KTCValues {
  if (data && typeof data === 'object' && data.values && typeof data.values === 'object') {
    return data.values as KTCValues;
  }

  return (data || {}) as KTCValues;
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

export function loadLocalKtcSnapshotForDate(dateKey: string): KTCValues {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return {};

    const filePath = path.join(KTC_SNAPSHOT_DIR, `ktc-snapshot-${dateKey}.json`);
    if (!fs.existsSync(filePath)) return {};

    const data = fs.readFileSync(filePath, 'utf-8');
    return unwrapSnapshotValues(JSON.parse(data));
  } catch (error) {
    console.error('Failed to load local KTC snapshot:', error);
    return {};
  }
}

export function loadLatestLocalKtcSnapshotBefore(beforeDate: Date): KTCValues {
  try {
    if (!fs.existsSync(KTC_SNAPSHOT_DIR)) return {};
    const beforeDateKey = getSnapshotDateKey(beforeDate);

    const snapshotFiles = fs
      .readdirSync(KTC_SNAPSHOT_DIR)
      .filter(file => /^ktc-snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .filter(file => file.replace('ktc-snapshot-', '').replace('.json', '') < beforeDateKey)
      .sort();

    const latest = snapshotFiles.at(-1);
    if (!latest) return {};

    const data = fs.readFileSync(path.join(KTC_SNAPSHOT_DIR, latest), 'utf-8');
    return unwrapSnapshotValues(JSON.parse(data));
  } catch (error) {
    console.error('Failed to load local KTC snapshot:', error);
    return {};
  }
}

export function loadLatestLocalKtcSnapshotDaysAgo(daysAgo: number): KTCValues {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  targetDate.setDate(targetDate.getDate() + 1);
  return loadLatestLocalKtcSnapshotBefore(targetDate);
}

export function saveLocalKtcSnapshot(date: Date, ktcData: unknown): string | null {
  try {
    if (!fs.existsSync(KTC_SNAPSHOT_DIR)) {
      fs.mkdirSync(KTC_SNAPSHOT_DIR, { recursive: true });
    }

    const dateKey = getSnapshotDateKey(date);
    const filePath = path.join(KTC_SNAPSHOT_DIR, `ktc-snapshot-${dateKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(ktcData, null, 2));
    return filePath;
  } catch (error) {
    console.error('Failed to save local KTC snapshot:', error);
    return null;
  }
}

export function clearKTCCache() {
  ktcValuesCache = null;
  ktcValuesLastWeekCache = null;
}

export { getSnapshotDateKey, KTC_SNAPSHOT_TIME_ZONE };
