import { storeKtcSnapshot } from './ktcSnapshotJob';

const SNAPSHOT_TIME_ZONE = 'America/Vancouver';
const SNAPSHOT_HOUR = 18;

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
 * Runs KTC snapshot storage every day at 6 PM Pacific.
 */
export function initializeScheduledJobs() {
  let lastSnapshotRunDate: string | null = null;

  // Using a simple interval check since we don't have a full cron library
  
  function checkAndRunKtcSnapshot() {
    const now = new Date();
    const { dateKey, hour, minute } = getPacificDateParts(now);

    if (hour === SNAPSHOT_HOUR && minute === 0 && lastSnapshotRunDate !== dateKey) {
      lastSnapshotRunDate = dateKey;
      console.log(`[Scheduled Jobs] Running daily KTC snapshot at ${now.toISOString()} (${dateKey} 18:00 ${SNAPSHOT_TIME_ZONE})`);
      storeKtcSnapshot().catch((error) => {
        console.error('[Scheduled Jobs] Error running KTC snapshot:', error);
      });
    }
  }

  // Check every minute if we should run the snapshot
  setInterval(checkAndRunKtcSnapshot, 60000);
  
  console.log(`[Scheduled Jobs] Initialized - KTC snapshots will run daily at 6 PM ${SNAPSHOT_TIME_ZONE}`);
}
