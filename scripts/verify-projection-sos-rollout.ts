#!/usr/bin/env tsx

import '../server/_core/env';
import {
  probeProjectionSosReadiness,
  type ProjectionSosReadinessProbeResult,
} from './probe-projection-sos-readiness';
import type { SleeperProjectionScoringProfile } from '../server/sleeperProjectionSnapshots';

type Mode = 'projection-off' | 'projection-on';

const PROFILES = new Set<SleeperProjectionScoringProfile>(['PPR', 'HALF_PPR', 'STD', 'CUSTOM']);
const PLAYOFF_WEEKS = [15, 16, 17];

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

function parseWeek(): number {
  const parsed = Number(getFlag('week') || process.env.PROJECTION_READINESS_WEEK || 1);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 18 ? parsed : 1;
}

function parseLeagueId(): string | null {
  const leagueId = String(getFlag('league-id') || process.env.PROJECTION_READINESS_LEAGUE_ID || '').trim();
  return leagueId || null;
}

function parseReportForceRefresh(): boolean {
  const raw = String(getFlag('report-force-refresh') || process.env.PROJECTION_READINESS_REPORT_FORCE_REFRESH || 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'no';
}

function parseProfiles(): SleeperProjectionScoringProfile[] {
  const raw = getFlag('profiles') || process.env.PROJECTION_READINESS_PROFILES || 'PPR,HALF_PPR,STD';
  const profiles = raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .map((value) => value === 'HALF' ? 'HALF_PPR' : value)
    .filter((value): value is SleeperProjectionScoringProfile => PROFILES.has(value as SleeperProjectionScoringProfile));
  return profiles.length ? Array.from(new Set(profiles)) : ['PPR', 'HALF_PPR', 'STD'];
}

async function withEnv<T>(overrides: Record<string, string>, callback: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(overrides)) {
    previous.set(key, process.env[key]);
    process.env[key] = overrides[key];
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function envForMode(mode: Mode): Record<string, string> {
  const enabled = mode === 'projection-on';
  return {
    ENABLE_DRAFTSHARKS_SOS: 'true',
    ENABLE_PROJECTION_FEATURES: enabled ? 'true' : 'false',
    ENABLE_SLEEPER_PROJECTIONS: enabled ? 'true' : 'false',
    ENABLE_WEEKLY_PROJECTIONS: enabled ? 'true' : 'false',
    DISABLE_PROJECTION_FEATURES: 'false',
    DISABLE_PROJECTION_SNAPSHOTS: 'false',
    DISABLE_PROJECTION_READOUTS: 'false',
    DISABLE_PROJECTION_JOINS: 'false',
  };
}

function summarize(mode: Mode, result: ProjectionSosReadinessProbeResult) {
  return {
    mode,
    ok: result.ok,
    expectation: result.expectation,
    dataReady: result.dataReady,
    scoringProfile: result.scoringProfile,
    draftSharksStatus: result.draftSharks.status,
    draftSharksProfileCount: result.draftSharks.profileCount,
    scheduleStatus: result.schedule.status,
    weeklyProjectionStatus: result.weeklyProjection.status,
    weeklyProjectionRows: 'rowCount' in result.weeklyProjection ? result.weeklyProjection.rowCount : 0,
    readinessEnabled: result.readiness.enabled,
    blockingFlags: result.readiness.blockingFlags,
    reason: result.readiness.reason,
  };
}

function hasProjectionBackedPlayoffWeek(reportData: any): boolean {
  return (reportData?.playoffSchedulePlanning?.managerPlans || []).some((plan: any) =>
    (plan?.weeks || []).some((week: any) =>
      typeof week?.projectedStarterPoints === 'number' ||
      /projection/i.test(String(week?.projectionCoverage?.mode || ''))
    )
  );
}

function hasOnlyScheduleValuePlayoffWeeks(reportData: any): boolean {
  const managerPlans = reportData?.playoffSchedulePlanning?.managerPlans || [];
  const weeks = managerPlans.flatMap((plan: any) => plan?.weeks || []);
  return weeks.length > 0 && weeks.every((week: any) =>
    week?.projectedStarterPoints === null &&
    Number(week?.projectionCoverage?.coveredPlayerCount || 0) === 0 &&
    String(week?.projectionCoverage?.mode || '') === 'schedule-value'
  );
}

function containsStoredWeeklyProjectionClaim(value: unknown): boolean {
  return /stored-weekly-projection|stored weekly projection blend/i.test(JSON.stringify(value || null));
}

function validateReportContract(input: {
  mode: Mode;
  leagueId: string;
  reportData: any;
}) {
  const failures: string[] = [];
  const reportData = input.reportData || {};
  const schedulePlanning = reportData.schedulePlanning;
  const playoffSchedulePlanning = reportData.playoffSchedulePlanning;
  const playoffWeeks = Array.isArray(playoffSchedulePlanning?.weeks) ? playoffSchedulePlanning.weeks : [];
  const matchupPreviews = Array.isArray(reportData.matchupPreviews) ? reportData.matchupPreviews : [];

  if (!schedulePlanning) failures.push('missing schedulePlanning');
  if (!playoffSchedulePlanning) failures.push('missing playoffSchedulePlanning');
  for (const week of PLAYOFF_WEEKS) {
    if (!playoffWeeks.includes(week)) failures.push(`missing playoff week ${week}`);
  }
  if (!playoffSchedulePlanning?.managerPlans?.length) failures.push('missing playoff manager plans');
  if (!reportData.lineupStrength) failures.push('missing lineupStrength');
  if (!reportData.redraftValuation) failures.push('missing redraftValuation');
  if (!matchupPreviews.length) failures.push('missing matchupPreviews');

  if (input.mode === 'projection-on') {
    if (reportData.weeklyProjectionDiagnostics?.status !== 'ready') {
      failures.push(`weekly projections not ready: ${reportData.weeklyProjectionDiagnostics?.status || 'missing'}`);
    }
    if (!hasProjectionBackedPlayoffWeek(reportData)) {
      failures.push('playoffSchedulePlanning has no projection-backed week');
    }
  } else {
    if (reportData.weeklyProjectionDiagnostics?.status !== 'blocked') {
      failures.push(`weekly projections not blocked: ${reportData.weeklyProjectionDiagnostics?.status || 'missing'}`);
    }
    if (!hasOnlyScheduleValuePlayoffWeeks(reportData)) {
      failures.push('playoffSchedulePlanning leaked projection-backed week context');
    }
    if (containsStoredWeeklyProjectionClaim({
      playoffSchedulePlanning: reportData.playoffSchedulePlanning,
      matchupPreviews: reportData.matchupPreviews,
      lineupStrength: reportData.lineupStrength,
      redraftValuation: reportData.redraftValuation,
      waiverIntelligence: reportData.waiverIntelligence,
    })) {
      failures.push('projection-off report still contains stored weekly projection claims');
    }
  }

  return {
    mode: input.mode,
    leagueId: input.leagueId,
    ok: failures.length === 0,
    failures,
    summary: {
      hasSchedulePlanning: Boolean(schedulePlanning),
      hasPlayoffSchedulePlanning: Boolean(playoffSchedulePlanning),
      playoffWeeks,
      playoffManagerPlanCount: playoffSchedulePlanning?.managerPlans?.length || 0,
      hasLineupStrength: Boolean(reportData.lineupStrength),
      hasRedraftValuation: Boolean(reportData.redraftValuation),
      matchupPreviewCount: matchupPreviews.length,
      weeklyProjectionStatus: reportData.weeklyProjectionDiagnostics?.status || null,
      weeklyProjectionRows: reportData.weeklyProjectionDiagnostics?.rowCount || 0,
    },
  };
}

function extractReportData(payload: any): any {
  return payload?.reportData || payload?.data?.reportData || payload;
}

async function runReportContract(input: {
  mode: Mode;
  leagueId: string;
  forceRefresh: boolean;
}) {
  return withEnv(envForMode(input.mode), async () => {
    const { appRouter } = await import('../server/routers');
    const caller = appRouter.createCaller({
      req: {
        headers: {
          'user-agent': 'projection-sos-rollout-verifier',
          'x-cache-warmer': 'true',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as any,
      res: {} as any,
      user: null,
    });
    const reportData = await caller.league.analyze({
      leagueId: input.leagueId,
      forceRefresh: input.forceRefresh,
    });
    return validateReportContract({
      mode: input.mode,
      leagueId: input.leagueId,
      reportData: extractReportData(reportData),
    });
  });
}

async function runMode(input: {
  mode: Mode;
  season: string;
  week: number;
  profile: SleeperProjectionScoringProfile;
}) {
  return withEnv(envForMode(input.mode), async () => {
    const result = await probeProjectionSosReadiness({
      season: input.season,
      week: input.week,
      scoringProfile: input.profile,
      expectation: input.mode === 'projection-on' ? 'enabled' : 'disabled',
    });
    return summarize(input.mode, result);
  });
}

async function main() {
  const season = String(getFlag('season') || process.env.PROJECTION_READINESS_SEASON || new Date().getUTCFullYear());
  const week = parseWeek();
  const profiles = parseProfiles();
  const leagueId = parseLeagueId();
  const reportForceRefresh = parseReportForceRefresh();
  const modes: Mode[] = ['projection-off', 'projection-on'];
  const checks = [];
  const reportContracts = [];

  for (const profile of profiles) {
    for (const mode of modes) {
      checks.push(await runMode({ mode, season, week, profile }));
    }
  }

  if (leagueId) {
    for (const mode of modes) {
      reportContracts.push(await runReportContract({
        mode,
        leagueId,
        forceRefresh: reportForceRefresh,
      }));
    }
  }

  const ok = checks.every((check) => check.ok) && reportContracts.every((check) => check.ok);
  console.log(JSON.stringify({
    ok,
    season,
    week,
    profiles,
    leagueId,
    reportForceRefresh,
    checks,
    reportContracts,
  }, null, 2));

  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[projection-sos-rollout] failed:', error);
  process.exitCode = 1;
});
