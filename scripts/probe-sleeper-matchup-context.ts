#!/usr/bin/env tsx

import '../server/_core/env';
import { pathToFileURL } from 'node:url';
import { probeSleeperMatchupContextReadiness } from '../server/sleeperMatchupContextReadiness';

function getFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

function parseLeagueIds(): string[] {
  const raw = getFlag('league-ids') ||
    getFlag('league-id') ||
    process.env.SLEEPER_MATCHUP_CONTEXT_LEAGUE_IDS ||
    process.env.PROJECTION_SOS_READINESS_LEAGUE_ID ||
    '';
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseWeek(): number | null {
  const raw = getFlag('week') || process.env.SLEEPER_MATCHUP_CONTEXT_WEEK || '';
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 18 ? parsed : null;
}

async function main() {
  const leagueIds = parseLeagueIds();
  const result = await probeSleeperMatchupContextReadiness({
    leagueIds,
    season: getFlag('season') || process.env.SLEEPER_MATCHUP_CONTEXT_SEASON || null,
    week: parseWeek(),
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[sleeper-matchup-context] failed:', error);
    process.exitCode = 1;
  });
}
