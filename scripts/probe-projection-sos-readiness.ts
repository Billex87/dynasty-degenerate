#!/usr/bin/env tsx

import '../server/_core/env';
import { loadDraftSharksScheduleContext } from '../server/draftSharksSchedule';
import {
  buildNflScheduleCoverageDiagnostics,
  loadLatestNflScheduleSnapshot,
} from '../server/nflScheduleSnapshots';
import { getProjectionReadinessGate } from '../server/projectionFeatureFlags';
import { loadStoredSleeperProjectionSnapshot, type SleeperProjectionScoringProfile } from '../server/sleeperProjectionSnapshots';

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

function parseWeek(): number {
  const parsed = Number(getFlag('week') || process.env.PROJECTION_READINESS_WEEK || 1);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 18 ? parsed : 1;
}

function profile(): SleeperProjectionScoringProfile {
  const value = String(getFlag('profile') || process.env.PROJECTION_READINESS_PROFILE || 'PPR').toUpperCase();
  return ['PPR', 'HALF_PPR', 'STD', 'CUSTOM'].includes(value)
    ? value as SleeperProjectionScoringProfile
    : 'PPR';
}

async function main() {
  const season = getFlag('season') || process.env.PROJECTION_READINESS_SEASON || String(new Date().getUTCFullYear());
  const week = parseWeek();
  const scoringProfile = profile();
  const [draftSharksContext, scheduleSnapshot, weeklyProjectionSnapshot] = await Promise.all([
    loadDraftSharksScheduleContext({ sourceMode: 'snapshot' }),
    loadLatestNflScheduleSnapshot(),
    loadStoredSleeperProjectionSnapshot({
      season,
      week,
      scoringProfile,
    }),
  ]);
  const draftSharksProfileCount = Object.keys(draftSharksContext.profiles || {}).length;
  const scheduleCoverage = scheduleSnapshot
    ? buildNflScheduleCoverageDiagnostics({
      snapshot: scheduleSnapshot,
      season,
      sleeperWeeks: [week],
      providerProjectionWeeks: [week],
    })
    : null;
  const readiness = getProjectionReadinessGate({
    source: 'sleeper',
    projectionType: 'weekly',
    projectionSnapshotStatus: weeklyProjectionSnapshot?.rows?.length ? 'ready' : 'missing',
    scheduleSnapshotStatus: scheduleCoverage?.status === 'ready' ? 'ready' : 'missing',
    sourceMappingStatus: weeklyProjectionSnapshot?.identityDiagnostics?.status === 'broken' ? 'broken' : 'ready',
  });
  const ok = draftSharksContext.status === 'loaded' &&
    draftSharksProfileCount >= 180 &&
    scheduleCoverage?.status === 'ready' &&
    Boolean(weeklyProjectionSnapshot?.rows?.length) &&
    readiness.enabled;

  console.log(JSON.stringify({
    ok,
    season,
    week,
    scoringProfile,
    draftSharks: {
      status: draftSharksContext.status,
      profileCount: draftSharksProfileCount,
      updatedAt: draftSharksContext.updatedAt,
      sampleProfile: draftSharksContext.profiles?.['ARI:QB'] || null,
    },
    schedule: scheduleCoverage ? {
      status: scheduleCoverage.status,
      scheduleWeeks: scheduleCoverage.scheduleWeeks,
      missingTeamCount: scheduleCoverage.missingTeamCount,
      note: scheduleCoverage.note,
    } : {
      status: 'missing',
      note: 'No nfl-schedule-games-v1 snapshot loaded.',
    },
    weeklyProjection: weeklyProjectionSnapshot ? {
      status: weeklyProjectionSnapshot.rows.length ? 'ready' : 'missing',
      sourceKey: weeklyProjectionSnapshot.sourceKey,
      snapshotKey: weeklyProjectionSnapshot.snapshotKey,
      rowCount: weeklyProjectionSnapshot.rowCount,
      identityStatus: weeklyProjectionSnapshot.identityDiagnostics?.status || null,
    } : {
      status: 'missing',
      note: 'No stored Sleeper weekly projection snapshot loaded.',
    },
    readiness,
  }, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[projection-sos-readiness] failed:', error);
  process.exitCode = 1;
});
