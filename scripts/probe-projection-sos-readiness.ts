#!/usr/bin/env tsx

import '../server/_core/env';
import { pathToFileURL } from 'node:url';
import { loadDraftSharksScheduleContext } from '../server/draftSharksSchedule';
import {
  buildNflScheduleCoverageDiagnostics,
  loadLatestNflScheduleSnapshot,
} from '../server/nflScheduleSnapshots';
import { getProjectionReadinessGate } from '../server/projectionFeatureFlags';
import { loadStoredSleeperProjectionSnapshot, type SleeperProjectionScoringProfile } from '../server/sleeperProjectionSnapshots';

type ProjectionSosReadinessExpectation = 'enabled' | 'disabled' | 'data-ready';

export type ProjectionSosReadinessProbeResult = Awaited<ReturnType<typeof probeProjectionSosReadiness>>;

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

function parseWeekValue(value: unknown): number {
  const parsed = Number(value || 1);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 18 ? parsed : 1;
}

function parseWeek(): number {
  return parseWeekValue(getFlag('week') || process.env.PROJECTION_READINESS_WEEK || 1);
}

function parseProfileValue(value: unknown): SleeperProjectionScoringProfile {
  const normalized = String(value || 'PPR').toUpperCase();
  const profile = normalized === 'HALF' ? 'HALF_PPR' : normalized;
  return ['PPR', 'HALF_PPR', 'STD', 'CUSTOM'].includes(profile)
    ? profile as SleeperProjectionScoringProfile
    : 'PPR';
}

function profile(): SleeperProjectionScoringProfile {
  return parseProfileValue(getFlag('profile') || process.env.PROJECTION_READINESS_PROFILE || 'PPR');
}

function expectation(): ProjectionSosReadinessExpectation {
  const value = String(getFlag('expect') || process.env.PROJECTION_READINESS_EXPECT || 'enabled').trim().toLowerCase();
  return value === 'disabled' || value === 'data-ready' ? value : 'enabled';
}

function okForExpectation(input: {
  expectation: ProjectionSosReadinessExpectation;
  dataReady: boolean;
  readinessEnabled: boolean;
  blockingFlags: string[];
}): boolean {
  if (input.expectation === 'data-ready') return input.dataReady;
  if (input.expectation === 'disabled') {
    return input.dataReady && !input.readinessEnabled && input.blockingFlags.length > 0;
  }
  return input.dataReady && input.readinessEnabled;
}

export async function probeProjectionSosReadiness(options: {
  season?: string | number;
  week?: number;
  scoringProfile?: SleeperProjectionScoringProfile;
  expectation?: ProjectionSosReadinessExpectation;
} = {}) {
  const season = String(options.season || getFlag('season') || process.env.PROJECTION_READINESS_SEASON || new Date().getUTCFullYear());
  const week = parseWeekValue(options.week || parseWeek());
  const scoringProfile = parseProfileValue(options.scoringProfile || profile());
  const expected = options.expectation || expectation();
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
  const dataReady = draftSharksContext.status === 'loaded' &&
    draftSharksProfileCount >= 180 &&
    scheduleCoverage?.status === 'ready' &&
    Boolean(weeklyProjectionSnapshot?.rows?.length);
  const ok = okForExpectation({
    expectation: expected,
    dataReady,
    readinessEnabled: readiness.enabled,
    blockingFlags: readiness.blockingFlags,
  });

  return {
    ok,
    expectation: expected,
    dataReady,
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
  };
}

async function main() {
  const result = await probeProjectionSosReadiness();
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[projection-sos-readiness] failed:', error);
    process.exitCode = 1;
  });
}
