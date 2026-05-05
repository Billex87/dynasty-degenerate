import { findKtcSnapshotOnOrBefore, getDb, insertKtcSnapshot } from './db';
import { loadKTCValues, loadLiveKTCValueProfiles, loadLiveKTCValues, saveLocalKtcSnapshot } from './ktcLoader';
import { KTC_SNAPSHOT_PROFILES, loadBlendedPlayerValues } from './valueBlend';

type KTCValueMap = Record<string, {
  name: string;
  ktc_value: number;
  position_rank?: string;
  dynasty_value?: number;
  true_value?: number;
  redraft_value?: number;
  market_value_ktc?: number;
  market_value_fantasycalc?: number;
  expert_value_dynastyprocess?: number;
  fantasypros_season_value?: number;
}>;

type KtcSnapshotPayload = {
  schemaVersion: 2;
  generatedAt: string;
  defaultProfile: string;
  profilesTracked: Array<{
    key: string;
    label: string;
    qbProfile: string;
    tepProfile: string;
    ppr: number;
    status: 'stored' | 'pending';
    note?: string;
  }>;
  values: KTCValueMap;
  ktcProfiles: Record<string, KTCValueMap>;
};

function normalizeSnapshotData(data: unknown): KTCValueMap {
  if (!data || typeof data !== 'object') return {};

  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => {
        if (typeof value === 'number') {
          return [key, { name: key, ktc_value: value }];
        }

        if (value && typeof value === 'object') {
          const raw = value as Record<string, unknown>;
          if (typeof raw.ktc_value === 'number') {
            const numberField = (field: string) =>
              typeof raw[field] === 'number' ? raw[field] as number : undefined;
            return [
              key,
              {
                name: typeof raw.name === 'string' ? raw.name : key,
                ktc_value: raw.ktc_value,
                position_rank: typeof raw.position_rank === 'string' ? raw.position_rank : undefined,
                dynasty_value: numberField('dynasty_value'),
                true_value: numberField('true_value'),
                redraft_value: numberField('redraft_value'),
                market_value_ktc: numberField('market_value_ktc'),
                market_value_fantasycalc: numberField('market_value_fantasycalc'),
                expert_value_dynastyprocess: numberField('expert_value_dynastyprocess'),
                fantasypros_season_value: numberField('fantasypros_season_value'),
              },
            ];
          }
        }

        return null;
      })
      .filter((entry): entry is [string, KTCValueMap[string]] => entry !== null)
  );
}

/**
 * Store a dated KTC snapshot for historical value-change calculations.
 */
export async function storeKtcSnapshot() {
  try {
    // Force a fresh scrape for scheduled snapshots, then fall back to local data.
    const staticAndCachedKtcData = await loadKTCValues();
    const liveKtcData = await loadLiveKTCValues(true);
    const freshKtcData = Object.keys(liveKtcData).length > 0
      ? { ...staticAndCachedKtcData, ...liveKtcData }
      : staticAndCachedKtcData;
    const [ktcData, liveProfileValues] = await Promise.all([
      loadBlendedPlayerValues(freshKtcData).catch(() => freshKtcData),
      loadLiveKTCValueProfiles(false).catch(() => ({} as Awaited<ReturnType<typeof loadLiveKTCValueProfiles>>)),
    ]);
    
    if (!ktcData || Object.keys(ktcData).length === 0) {
      console.error('[KTC Snapshot] Failed to load KTC data');
      return;
    }

    // Store the snapshot with today's date
    const snapshotDate = new Date();
    const snapshotPayload: KtcSnapshotPayload = {
      schemaVersion: 2,
      generatedAt: snapshotDate.toISOString(),
      defaultProfile: 'sf_ppr',
      profilesTracked: KTC_SNAPSHOT_PROFILES.map((profile) => {
        const storedCount = Object.keys(liveProfileValues[profile.key] || {}).length;
        return {
          ...profile,
          status: storedCount > 0 ? 'stored' : 'pending',
          note: storedCount > 0
            ? `${storedCount} KTC market values stored for this profile.`
            : 'Profile metadata is tracked; dedicated values were not available in this run.',
        };
      }),
      values: normalizeSnapshotData(ktcData),
      ktcProfiles: Object.fromEntries(
        Object.entries(liveProfileValues).map(([profileKey, values]) => [
          profileKey,
          normalizeSnapshotData(values),
        ])
      ),
    };
    const localFilePath = saveLocalKtcSnapshot(snapshotDate, snapshotPayload);

    const db = await getDb();
    if (!db) {
      console.warn('[KTC Snapshot] Database not available; saved local snapshot only');
      if (localFilePath) {
        console.log(`[KTC Snapshot] Saved local snapshot to ${localFilePath}`);
      }
      return;
    }

    await insertKtcSnapshot(snapshotDate, JSON.stringify(snapshotPayload));

    console.log(`[KTC Snapshot] Successfully stored snapshot for ${snapshotDate.toISOString()}`);
    if (localFilePath) {
      console.log(`[KTC Snapshot] Also saved local snapshot to ${localFilePath}`);
    }
  } catch (error) {
    console.error('[KTC Snapshot] Error storing snapshot:', error);
  }
}

/**
 * Get the latest KTC snapshot at least N days old.
 * Used for Weekly Momentum value-change calculations.
 */
export async function getKtcSnapshotFromDaysAgo(daysAgo: number = 14) {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[KTC Snapshot] Database not available, using fallback');
      return null;
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo);

    const data = await findKtcSnapshotOnOrBefore(targetDate);

    if (!data) {
      console.warn(`[KTC Snapshot] No snapshot found from at least ${daysAgo} days ago`);
      return null;
    }

    const parsed = JSON.parse(data);
    return normalizeSnapshotData(parsed?.values && typeof parsed.values === 'object' ? parsed.values : parsed);
  } catch (error) {
    console.error('[KTC Snapshot] Error retrieving snapshot:', error);
    return null;
  }
}

export async function getKtcSnapshotFromSevenDaysAgo() {
  return getKtcSnapshotFromDaysAgo(7);
}
