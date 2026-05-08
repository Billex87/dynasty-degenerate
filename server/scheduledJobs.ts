import { storeKtcSnapshot } from './ktcSnapshotJob';
import { shouldRunMonthlyProspectSnapshot, storeNflDraftBuzzProspectSnapshot } from './prospectSource';

const SNAPSHOT_TIME_ZONE = 'America/Vancouver';
const SNAPSHOT_HOURS = [6, 12, 18];
const PROSPECT_SNAPSHOT_HOUR = 7;

function getPacificDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value || '00';

  return {
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
    minute: Number(value('minute')),
  };
}

/**
 * Initialize scheduled jobs
 * Runs KTC snapshot storage every day at 6 AM, noon, and 6 PM Pacific.
 */
export function initializeScheduledJobs() {
  let lastSnapshotRunKey: string | null = null;
  let lastProspectSnapshotRunMonth: string | null = null;

  // Using a simple interval check since we don't have a full cron library
  
  function checkAndRunKtcSnapshot() {
    const now = new Date();
    const { dateKey, hour, minute } = getPacificDateParts(now);
    const snapshotRunKey = `${dateKey}-${hour}`;

    if (SNAPSHOT_HOURS.includes(hour) && minute === 0 && lastSnapshotRunKey !== snapshotRunKey) {
      lastSnapshotRunKey = snapshotRunKey;
      console.log(`[Scheduled Jobs] Running KTC snapshot at ${now.toISOString()} (${dateKey} ${String(hour).padStart(2, '0')}:00 ${SNAPSHOT_TIME_ZONE})`);
      storeKtcSnapshot().catch((error) => {
        console.error('[Scheduled Jobs] Error running KTC snapshot:', error);
      });
    }

    const monthKey = dateKey.slice(0, 7);
    if (
      minute === 0
      && shouldRunMonthlyProspectSnapshot(now, PROSPECT_SNAPSHOT_HOUR)
      && lastProspectSnapshotRunMonth !== monthKey
    ) {
      lastProspectSnapshotRunMonth = monthKey;
      console.log(`[Scheduled Jobs] Running monthly prospect snapshot at ${now.toISOString()} (${dateKey} ${PROSPECT_SNAPSHOT_HOUR}:00 ${SNAPSHOT_TIME_ZONE})`);
      storeNflDraftBuzzProspectSnapshot().catch((error) => {
        console.error('[Scheduled Jobs] Error running prospect snapshot:', error);
      });
    }
  }

  // Check every minute if we should run the snapshot
  setInterval(checkAndRunKtcSnapshot, 60000);
  
  console.log(`[Scheduled Jobs] Initialized - KTC snapshots run daily at ${SNAPSHOT_HOURS.join(':00 and ')}:00 and prospect snapshots run monthly at ${PROSPECT_SNAPSHOT_HOUR}:00 ${SNAPSHOT_TIME_ZONE}`);
}
