import { getDb } from './db';
import { ktcSnapshots } from '../drizzle/schema';
import { loadKTCValues, loadLiveKTCValues, saveLocalKtcSnapshot } from './ktcLoader';
import { and, gte, lt } from 'drizzle-orm';

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
 * Store a weekly KTC snapshot every Tuesday at 5 PM
 * This creates a historical record for 7-day momentum calculations
 */
export async function storeKtcSnapshot() {
  try {
    const db = await getDb();
    if (!db) {
      console.error('[KTC Snapshot] Database not available');
      return;
    }

    // Force a fresh scrape for scheduled snapshots, then fall back to local data.
    const staticAndCachedKtcData = await loadKTCValues();
    const liveKtcData = await loadLiveKTCValues(true);
    const ktcData = Object.keys(liveKtcData).length > 0
      ? { ...staticAndCachedKtcData, ...liveKtcData }
      : staticAndCachedKtcData;
    
    if (!ktcData || Object.keys(ktcData).length === 0) {
      console.error('[KTC Snapshot] Failed to load KTC data');
      return;
    }

    // Store the snapshot with today's date
    const snapshotDate = new Date();
    const localFilePath = saveLocalKtcSnapshot(snapshotDate, ktcData);
    
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
 * Get the KTC snapshot from exactly 7 days ago
 * Used for Weekly Momentum calculations
 */
export async function getKtcSnapshotFromSevenDaysAgo() {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[KTC Snapshot] Database not available, using fallback');
      return null;
    }

    // Calculate date from 7 days ago (with 1 day tolerance for flexibility)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    // Find the most recent snapshot between 6-8 days ago
    const snapshot = await db
      .select()
      .from(ktcSnapshots)
      .where(
        and(
          gte(ktcSnapshots.snapshotDate, sevenDaysAgo),
          lt(ktcSnapshots.snapshotDate, sixDaysAgo)
        )
      )
      .orderBy(ktcSnapshots.snapshotDate)
      .limit(1);

    if (snapshot.length === 0) {
      console.warn('[KTC Snapshot] No snapshot found from 7 days ago');
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
