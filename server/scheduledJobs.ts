import { storeKtcSnapshot } from './ktcSnapshotJob';
import { shouldRunMonthlyProspectSnapshot, storeNflDraftBuzzProspectSnapshot } from './prospectSource';
import { refreshFantasyProsEndpointSnapshotRefresh, refreshPlayerNewsSnapshots, runDynamicDataRefresh } from './dynamicDataJobs';
import { refreshSleeperStartupAdpSnapshots } from './startupAdpSnapshots';
import {
  getFantasyProsEndpointSnapshotScheduleLabel,
  getPacificScheduleParts,
  isFantasyProsEndpointSnapshotWindow,
} from './fantasyProsEndpointSnapshotSchedule';
import {
  LEAGUE_REPORT_SNAPSHOT_HOURS,
  PACIFIC_TIME_ZONE,
  PLAYER_NEWS_REFRESH_HOURS,
  PLAYER_NEWS_REFRESH_MINUTE,
  getPacificCronDateParts,
  isLocalLeagueReportSnapshotTick,
  isLocalPlayerNewsRefreshTick,
} from './pacificCronWindows';

const PROSPECT_SNAPSHOT_HOUR = 7;
const DYNAMIC_REFRESH_HOUR = 18;
const DYNAMIC_REFRESH_MINUTE = 40;
const STARTUP_ADP_SNAPSHOT_HOUR = 8;

/**
 * Initialize scheduled jobs
 * Runs KTC snapshot storage every day at 8 AM and 4 PM Pacific.
 */
export function initializeScheduledJobs() {
  let lastSnapshotRunKey: string | null = null;
  let lastProspectSnapshotRunMonth: string | null = null;
  let lastStartupAdpSnapshotRunMonth: string | null = null;
  let lastDynamicRefreshRunKey: string | null = null;
  let lastNewsRefreshRunKey: string | null = null;
  let lastFantasyProsEndpointSnapshotRunKey: string | null = null;

  // Using a simple interval check since we don't have a full cron library
  
  function checkAndRunKtcSnapshot() {
    const now = new Date();
    const { dateKey, hour, minute } = getPacificCronDateParts(now);
    const snapshotRunKey = `${dateKey}-${hour}`;

    if (isLocalLeagueReportSnapshotTick(now) && lastSnapshotRunKey !== snapshotRunKey) {
      lastSnapshotRunKey = snapshotRunKey;
      console.log(`[Scheduled Jobs] Running KTC snapshot at ${now.toISOString()} (${dateKey} ${String(hour).padStart(2, '0')}:00 ${PACIFIC_TIME_ZONE})`);
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
      console.log(`[Scheduled Jobs] Running monthly prospect snapshot at ${now.toISOString()} (${dateKey} ${PROSPECT_SNAPSHOT_HOUR}:00 ${PACIFIC_TIME_ZONE})`);
      storeNflDraftBuzzProspectSnapshot().catch((error) => {
        console.error('[Scheduled Jobs] Error running prospect snapshot:', error);
      });
    }

    if (
      minute === 0
      && hour === STARTUP_ADP_SNAPSHOT_HOUR
      && lastStartupAdpSnapshotRunMonth !== monthKey
    ) {
      lastStartupAdpSnapshotRunMonth = monthKey;
      const rosterRoomSeason = now.getMonth() >= 8 ? String(now.getFullYear() + 1) : String(now.getFullYear());
      console.log(`[Scheduled Jobs] Running monthly Sleeper startup ADP snapshot at ${now.toISOString()} (${dateKey} ${STARTUP_ADP_SNAPSHOT_HOUR}:00 ${PACIFIC_TIME_ZONE})`);
      refreshSleeperStartupAdpSnapshots({ season: rosterRoomSeason }).catch((error) => {
        console.error('[Scheduled Jobs] Error running Sleeper startup ADP snapshot:', error);
      });
    }

    if (
      hour === DYNAMIC_REFRESH_HOUR
      && minute === DYNAMIC_REFRESH_MINUTE
      && lastDynamicRefreshRunKey !== dateKey
    ) {
      lastDynamicRefreshRunKey = dateKey;
      console.log(`[Scheduled Jobs] Running dynamic data refresh at ${now.toISOString()} (${dateKey} ${DYNAMIC_REFRESH_HOUR}:${String(DYNAMIC_REFRESH_MINUTE).padStart(2, '0')} ${PACIFIC_TIME_ZONE})`);
      runDynamicDataRefresh().catch((error) => {
        console.error('[Scheduled Jobs] Error running dynamic data refresh:', error);
      });
    }

    const newsRefreshRunKey = `${dateKey}-${hour}-${minute}`;
    if (
      isLocalPlayerNewsRefreshTick(now)
      && lastNewsRefreshRunKey !== newsRefreshRunKey
    ) {
      lastNewsRefreshRunKey = newsRefreshRunKey;
      console.log(`[Scheduled Jobs] Running player news refresh at ${now.toISOString()} (${dateKey} ${String(hour).padStart(2, '0')}:${String(PLAYER_NEWS_REFRESH_MINUTE).padStart(2, '0')} ${PACIFIC_TIME_ZONE})`);
      refreshPlayerNewsSnapshots().catch((error) => {
        console.error('[Scheduled Jobs] Error running player news refresh:', error);
      });
    }

    const fantasyProsEndpointSnapshotRunKey = `fantasypros-endpoints-${dateKey}`;
    if (
      isFantasyProsEndpointSnapshotWindow(now)
      && lastFantasyProsEndpointSnapshotRunKey !== fantasyProsEndpointSnapshotRunKey
    ) {
      lastFantasyProsEndpointSnapshotRunKey = fantasyProsEndpointSnapshotRunKey;
      const scheduleParts = getPacificScheduleParts(now);
      console.log(`[Scheduled Jobs] Running FantasyPros endpoint snapshots at ${now.toISOString()} (${scheduleParts.dateKey} ${String(scheduleParts.hour).padStart(2, '0')}:00 ${PACIFIC_TIME_ZONE})`);
      refreshFantasyProsEndpointSnapshotRefresh().catch((error) => {
        console.error('[Scheduled Jobs] Error running FantasyPros endpoint snapshots:', error);
      });
    }
  }

  // Check every minute if we should run the snapshot
  setInterval(checkAndRunKtcSnapshot, 60000);
  
  console.log(`[Scheduled Jobs] Initialized - KTC snapshots run daily at ${LEAGUE_REPORT_SNAPSHOT_HOURS.join(':00 and ')}:00, prospect snapshots run monthly at ${PROSPECT_SNAPSHOT_HOUR}:00, Sleeper startup ADP snapshots run monthly at ${STARTUP_ADP_SNAPSHOT_HOUR}:00, dynamic data refresh runs daily at ${DYNAMIC_REFRESH_HOUR}:${String(DYNAMIC_REFRESH_MINUTE).padStart(2, '0')}, player news refresh runs daily at ${PLAYER_NEWS_REFRESH_HOURS.map((hour) => `${hour}:${String(PLAYER_NEWS_REFRESH_MINUTE).padStart(2, '0')}`).join(', ')}, and FantasyPros endpoint snapshots run ${getFantasyProsEndpointSnapshotScheduleLabel()}`);
}
