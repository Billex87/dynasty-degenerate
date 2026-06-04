#!/usr/bin/env tsx

import '../server/_core/env';
import {
  probeProjectionSosReadiness,
  type ProjectionSosReadinessProbeResult,
} from './probe-projection-sos-readiness';
import type { SleeperProjectionScoringProfile } from '../server/sleeperProjectionSnapshots';

type Mode = 'projection-off' | 'projection-on';

const PROFILES = new Set<SleeperProjectionScoringProfile>(['PPR', 'HALF_PPR', 'STD', 'CUSTOM']);

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

function parseWeek(): number {
  const parsed = Number(getFlag('week') || process.env.PROJECTION_READINESS_WEEK || 1);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 18 ? parsed : 1;
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
  const modes: Mode[] = ['projection-off', 'projection-on'];
  const checks = [];

  for (const profile of profiles) {
    for (const mode of modes) {
      checks.push(await runMode({ mode, season, week, profile }));
    }
  }

  const ok = checks.every((check) => check.ok);
  console.log(JSON.stringify({
    ok,
    season,
    week,
    profiles,
    checks,
  }, null, 2));

  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[projection-sos-rollout] failed:', error);
  process.exitCode = 1;
});
