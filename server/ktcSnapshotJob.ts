import { getDb } from './db';
import { ktcSnapshots } from '../drizzle/schema';
import { loadKTCValues, loadLiveKTCValues, saveLocalKtcSnapshot } from './ktcLoader';
import { loadBlendedPlayerValues } from './valueBlend';
import { desc, lte } from 'drizzle-orm';

type KTCValueMap = Record<string, { name: string; ktc_value: number; position_rank?: string }>;

function normalizeSnapshotData(data: unknown): KTCValueMap {
  if (!data || typeof data !== 'object') return {};

  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => {
        if (typeof value === 'number') {
          return [key, { name: key, ktc_value: value }];
        }

        if (value && typeof value === 'object') {
          const raw = value as { name?: unknown; ktc_value?: unknown; position_rank?: unknown };
          if (typeof raw.ktc_value === 'number') {
            return [
              key,
              {
                name: typeof raw.name === 'string' ? raw.name : key,
                ktc_value: raw.ktc_value,
                position_rank: typeof raw.position_rank === 'string' ? raw.position_rank : undefined,
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
    const ktcData = await loadBlendedPlayerValues(freshKtcData).catch(() => freshKtcData);
    
    if (!ktcData || Object.keys(ktcData).length === 0) {
      console.error('[KTC Snapshot] Failed to load KTC data');
      return;
    }

    // Store the snapshot with today's date
    const snapshotDate = new Date();
    const localFilePath = saveLocalKtcSnapshot(snapshotDate, ktcData);

    const db = await getDb();
    if (!db) {
      console.warn('[KTC Snapshot] Database not available; saved local snapshot only');
      if (localFilePath) {
        console.log(`[KTC Snapshot] Saved local snapshot to ${localFilePath}`);
      }
      return;
    }

    await db.insert(ktcSnapshots).values({
      snapshotDate,
      ktcData: JSON.stringify(ktcData),
    });

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

    const snapshot = await db
      .select()
      .from(ktcSnapshots)
      .where(lte(ktcSnapshots.snapshotDate, targetDate))
      .orderBy(desc(ktcSnapshots.snapshotDate))
      .limit(1);

    if (snapshot.length === 0) {
      console.warn(`[KTC Snapshot] No snapshot found from at least ${daysAgo} days ago`);
      return null;
    }

    const data = snapshot[0]?.ktcData;
    if (!data) return null;

    return normalizeSnapshotData(JSON.parse(data));
  } catch (error) {
    console.error('[KTC Snapshot] Error retrieving snapshot:', error);
    return null;
  }
}

export async function getKtcSnapshotFromSevenDaysAgo() {
  return getKtcSnapshotFromDaysAgo(7);
}
