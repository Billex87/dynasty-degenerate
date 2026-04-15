import { storeKtcSnapshot } from './ktcSnapshotJob';

/**
 * Initialize scheduled jobs
 * Currently runs KTC snapshot storage every Tuesday at 5 PM
 */
export function initializeScheduledJobs() {
  // Schedule KTC snapshot every Tuesday at 5 PM (17:00)
  // Using a simple interval check since we don't have a full cron library
  // In production, consider using node-cron or similar
  
  function checkAndRunKtcSnapshot() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 2 = Tuesday
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Check if it's Tuesday (2) and between 17:00 and 17:59
    if (dayOfWeek === 2 && hours === 17 && minutes >= 0 && minutes < 1) {
      console.log('[Scheduled Jobs] Running KTC snapshot at', now.toISOString());
      storeKtcSnapshot().catch((error) => {
        console.error('[Scheduled Jobs] Error running KTC snapshot:', error);
      });
    }
  }

  // Check every minute if we should run the snapshot
  setInterval(checkAndRunKtcSnapshot, 60000);
  
  console.log('[Scheduled Jobs] Initialized - KTC snapshots will run every Tuesday at 5 PM');
}
