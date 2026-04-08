import { getDb } from './db';
import { ktcSnapshots } from '../drizzle/schema';
import { loadKTCValues } from './ktcLoader';
import { and, gte, lt } from 'drizzle-orm';

/**
 * Store a weekly KTC snapshot every Tuesday at 11 PM
 * This creates a historical record for 7-day momentum calculations
 */
export async function storeKtcSnapshot() {
  try {
    const db = await getDb();
    if (!db) {
      console.error('[KTC Snapshot] Database not available');
      return;
    }

    // Load current KTC values
    const ktcData = await loadKTCValues();
    
    if (!ktcData || Object.keys(ktcData).length === 0) {
      console.error('[KTC Snapshot] Failed to load KTC data');
      return;
    }

    // Store the snapshot with today's date
    const snapshotDate = new Date();
    
    await db.insert(ktcSnapshots).values({
      snapshotDate,
      ktcData: JSON.stringify(ktcData),
    });

    console.log(`[KTC Snapshot] Successfully stored snapshot for ${snapshotDate.toISOString()}`);
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

    return JSON.parse(data) as Record<string, number>;
  } catch (error) {
    console.error('[KTC Snapshot] Error retrieving snapshot:', error);
    return null;
  }
}
