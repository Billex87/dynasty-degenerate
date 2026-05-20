#!/usr/bin/env tsx

import { config as loadEnv } from 'dotenv';
import {
  FANTASYPROS_MATCHUP_CALENDAR_POSITIONS,
  loadFantasyProsMatchupCalendarContext,
  refreshFantasyProsMatchupCalendarSnapshots,
  type FantasyProsMatchupCalendarPosition,
  type FantasyProsMatchupCalendarResult,
  type FantasyProsMatchupCalendarSummary,
} from '../server/fantasyProsMatchupCalendar';
import { getCurrentRankingSeason } from '../server/rankingSeason';

loadEnv({ path: '.env.local', override: false, quiet: true });
loadEnv({ override: false, quiet: true });

type ParsedArgs = {
  dryRun: boolean;
  season: string;
  positions: FantasyProsMatchupCalendarPosition[];
  requestDelayMs: number | undefined;
  timeoutMs: number | undefined;
};

const POSITION_ALIASES: Record<string, FantasyProsMatchupCalendarPosition | 'ALL'> = {
  ALL: 'ALL',
  DEF: 'DST',
  DST: 'DST',
  'D/ST': 'DST',
  K: 'K',
  QB: 'QB',
  RB: 'RB',
  TE: 'TE',
  WR: 'WR',
};

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : null;
}

function parseBooleanFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseNumberFlag(name: string): number | undefined {
  const value = readFlag(name);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative number.`);
  }
  return parsed;
}

function parseSeason(): string {
  const season = readFlag('season') || getCurrentRankingSeason();
  if (!/^20\d{2}$/.test(season)) {
    throw new Error('--season must use a four digit NFL season, for example --season=2026.');
  }
  return season;
}

function parsePositions(): FantasyProsMatchupCalendarPosition[] {
  const raw = readFlag('positions') || readFlag('position') || 'ALL';
  const requested = raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const normalized = new Set<FantasyProsMatchupCalendarPosition>();

  for (const position of requested) {
    const mapped = POSITION_ALIASES[position];
    if (!mapped) {
      throw new Error(`Unsupported position "${position}". Use QB,RB,WR,TE,K,DST or ALL.`);
    }
    if (mapped === 'ALL') {
      FANTASYPROS_MATCHUP_CALENDAR_POSITIONS.forEach((entry) => normalized.add(entry));
    } else {
      normalized.add(mapped);
    }
  }

  return normalized.size > 0
    ? Array.from(normalized)
    : [...FANTASYPROS_MATCHUP_CALENDAR_POSITIONS];
}

function parseArgs(): ParsedArgs {
  return {
    dryRun: parseBooleanFlag('dry-run'),
    season: parseSeason(),
    positions: parsePositions(),
    requestDelayMs: parseNumberFlag('delay-ms'),
    timeoutMs: parseNumberFlag('timeout-ms'),
  };
}

function resultStatus(result: FantasyProsMatchupCalendarResult): string {
  if (result.status === 'error') return `error: ${result.error || 'unknown error'}`;
  if (result.status === 'empty') return 'empty';
  return result.status;
}

function formatSnapshotAge(summary?: FantasyProsMatchupCalendarSummary): string | null {
  if (!summary?.fetchedAt) return null;
  const fetched = new Date(summary.fetchedAt);
  if (Number.isNaN(fetched.getTime())) return summary.fetchedAt;
  return fetched.toISOString();
}

async function main() {
  const args = parseArgs();
  const persistSnapshot = !args.dryRun;
  const results = await refreshFantasyProsMatchupCalendarSnapshots({
    season: args.season,
    positions: args.positions,
    requestDelayMs: args.requestDelayMs,
    timeoutMs: args.timeoutMs,
    persistSnapshot,
  });

  const context = persistSnapshot
    ? await loadFantasyProsMatchupCalendarContext({
      season: args.season,
      positions: args.positions,
    })
    : null;
  const summariesBySourceKey = new Map(
    (context?.summaries || []).map((summary) => [summary.sourceKey, summary]),
  );

  const rows = results.map((result) => {
    const summary = summariesBySourceKey.get(result.sourceKey);
    return {
      position: result.position,
      status: resultStatus(result),
      fetchedRows: result.rowCount,
      fetchedWeeks: result.weekCount,
      persisted: result.persisted,
      storedStatus: summary?.status || (persistSnapshot ? 'missing' : 'dry-run'),
      storedRows: summary?.rowCount ?? null,
      storedWeeks: summary?.weekCount ?? null,
      storedFetchedAt: formatSnapshotAge(summary),
      sourceUrl: result.sourceUrl,
    };
  });

  console.table(rows);

  const errorCount = results.filter((result) => result.status === 'error').length;
  const persistedCount = results.filter((result) => result.persisted).length;
  const missingStoredCount = persistSnapshot
    ? results.filter((result) => summariesBySourceKey.get(result.sourceKey)?.status !== 'loaded').length
    : 0;
  const emptyCount = results.filter((result) => result.status === 'empty').length;
  const totalRows = results.reduce((sum, result) => sum + result.rowCount, 0);

  console.log(JSON.stringify({
    mode: args.dryRun ? 'dry-run' : 'persist',
    season: args.season,
    positions: args.positions,
    totalRows,
    resultCount: results.length,
    persistedCount,
    emptyCount,
    errorCount,
    missingStoredCount,
    note: args.dryRun
      ? 'Dry run only. Re-run without --dry-run to persist providerDataSnapshots.'
      : 'Refresh complete. Stored rows were reloaded from providerDataSnapshots for verification.',
  }, null, 2));

  if (errorCount > 0 || missingStoredCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[fantasypros-matchup-calendar] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
