import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../server/nflverseDraftCapital';
import {
  buildPlayerSeasonOutcomeRows,
  summarizePlayerSeasonOutcomes,
  type PlayerSeasonInput,
  type PlayerSeasonPosition,
} from '../server/playerSeasonOutcomeModel';

const rootDir = process.cwd();
const FANTASY_POSITIONS = new Set<PlayerSeasonPosition>(['QB', 'RB', 'WR', 'TE', 'K']);
const DEFAULT_SOURCE_URL = 'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_{season}.csv';
const completedSeason = new Date().getMonth() >= 2 ? new Date().getFullYear() - 1 : new Date().getFullYear() - 2;
const startSeason = Number(process.env.START_SEASON || 2017);
const endSeason = Number(process.env.END_SEASON || completedSeason);
const seasons = (process.env.SEASONS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map(Number)
  .filter((value) => Number.isFinite(value));
const selectedSeasons = seasons.length
  ? seasons
  : Array.from({ length: Math.max(0, endSeason - startSeason + 1) }, (_, index) => startSeason + index);
const outputDir = path.resolve(rootDir, process.env.OUT_DIR || '.cache/modeling/player-season-outcomes');
const writeRows = process.env.WRITE_ROWS !== '0';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Build offline player-season outcome rows from nflverse player stats.',
    '',
    'This is modeling data only. It writes to .cache/ by default and is not used by pages or report payloads.',
    '',
    'Environment:',
    '  START_SEASON=2017',
    '  END_SEASON=2025',
    '  SEASONS=2021,2022,2023',
    '  NFLVERSE_PLAYER_STATS_URL=https://.../stats_player_reg_{season}.csv',
    '  OUT_DIR=.cache/modeling/player-season-outcomes',
    '  WRITE_ROWS=1',
  ].join('\n'));
  process.exit(0);
}

function textValue(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!raw || /^NA$/i.test(raw) || /^null$/i.test(raw)) return null;
  return raw;
}

function num(value: unknown): number | null {
  const raw = textValue(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function add(sum: number, value: unknown): number {
  return sum + (num(value) || 0);
}

function avg(values: number[]): number | null {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return Math.round((clean.reduce((sum, value) => sum + value, 0) / clean.length) * 1000) / 1000;
}

function sourceUrl(season: number): string {
  return (process.env.NFLVERSE_PLAYER_STATS_URL || DEFAULT_SOURCE_URL).replace('{season}', String(season));
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function normalizeKey(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function aggregateSeasonRows(rows: Array<Record<string, unknown>>, season: number): PlayerSeasonInput[] {
  const byPlayer = new Map<string, {
    playerKey: string;
    playerName: string;
    position: PlayerSeasonPosition;
    team: string | null;
    explicitGames: number | null;
    weeks: Set<number>;
    fantasyPointsPpr: number;
    passingAttempts: number;
    carries: number;
    targets: number;
    receptions: number;
    targetShares: number[];
    airYardsShares: number[];
    woprs: number[];
  }>();

  for (const row of rows) {
    if (String(row.season || '') !== String(season) || String(row.season_type || '') !== 'REG') continue;
    const position = String(row.position || '').toUpperCase() as PlayerSeasonPosition;
    if (!FANTASY_POSITIONS.has(position)) continue;
    const playerName = textValue(row.player_display_name) || textValue(row.player_name);
    if (!playerName) continue;
    const playerKey = textValue(row.player_id) || normalizeKey(playerName);
    const current = byPlayer.get(playerKey) || {
      playerKey,
      playerName,
      position,
      team: textValue(row.recent_team) || textValue(row.team),
      explicitGames: num(row.games),
      weeks: new Set<number>(),
      fantasyPointsPpr: 0,
      passingAttempts: 0,
      carries: 0,
      targets: 0,
      receptions: 0,
      targetShares: [],
      airYardsShares: [],
      woprs: [],
    };
    const week = num(row.week);
    if (week !== null && week > 0) current.weeks.add(week);
    current.explicitGames = num(row.games) ?? current.explicitGames;
    current.team = textValue(row.recent_team) || textValue(row.team) || current.team;
    current.fantasyPointsPpr = add(current.fantasyPointsPpr, row.fantasy_points_ppr ?? row.fantasy_points);
    current.passingAttempts = add(current.passingAttempts, row.attempts);
    current.carries = add(current.carries, row.carries);
    current.targets = add(current.targets, row.targets);
    current.receptions = add(current.receptions, row.receptions);
    const targetShare = num(row.target_share);
    const airYardsShare = num(row.air_yards_share);
    const wopr = num(row.wopr);
    if (targetShare !== null) current.targetShares.push(targetShare);
    if (airYardsShare !== null) current.airYardsShares.push(airYardsShare);
    if (wopr !== null) current.woprs.push(wopr);
    byPlayer.set(playerKey, current);
  }

  return Array.from(byPlayer.values())
    .map((row) => ({
      playerKey: row.playerKey,
      playerName: row.playerName,
      position: row.position,
      team: row.team,
      season,
      games: row.weeks.size || row.explicitGames || 0,
      fantasyPointsPpr: Math.round(row.fantasyPointsPpr * 10) / 10,
      passingAttempts: row.passingAttempts,
      carries: row.carries,
      targets: row.targets,
      receptions: row.receptions,
      targetShare: avg(row.targetShares),
      airYardsShare: avg(row.airYardsShares),
      wopr: avg(row.woprs),
    }))
    .filter((row) => row.games > 0 && row.fantasyPointsPpr > 0);
}

async function main() {
  const seasonResults: Array<{ season: number; status: 'loaded' | 'error'; rowCount: number; error?: string }> = [];
  const inputRows: PlayerSeasonInput[] = [];

  for (const season of selectedSeasons) {
    try {
      const url = sourceUrl(season);
      const rows = parseCsv(await fetchText(url));
      const normalized = aggregateSeasonRows(rows, season);
      inputRows.push(...normalized);
      seasonResults.push({ season, status: 'loaded', rowCount: normalized.length });
      console.log(`Loaded ${season}: ${normalized.length} player seasons`);
    } catch (error) {
      seasonResults.push({
        season,
        status: 'error',
        rowCount: 0,
        error: error instanceof Error ? error.message : String(error || 'Unknown error'),
      });
      console.warn(`Failed ${season}:`, error);
    }
  }

  const rows = buildPlayerSeasonOutcomeRows(inputRows);
  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'nflverse stats_player regular-season weekly aggregates',
    sourceUrlTemplate: process.env.NFLVERSE_PLAYER_STATS_URL || DEFAULT_SOURCE_URL,
    seasons: seasonResults,
    outputPolicy: 'offline-modeling-only; default OUT_DIR is gitignored .cache and pages do not read these files',
    ...summarizePlayerSeasonOutcomes(rows),
    topBreakouts: rows
      .filter((row) => row.trajectoryFromPrevious === 'breakout' || row.trajectoryFromPrevious === 'progression')
      .sort((a, b) => (b.productionScoreDelta || 0) - (a.productionScoreDelta || 0))
      .slice(0, 25),
    topRegressions: rows
      .filter((row) => row.trajectoryFromPrevious === 'collapse' || row.trajectoryFromPrevious === 'regression')
      .sort((a, b) => (a.productionScoreDelta || 0) - (b.productionScoreDelta || 0))
      .slice(0, 25),
    nextYearBreakoutSeeds: rows
      .filter((row) => row.nextSeasonOutcome === 'breakout' || row.nextSeasonOutcome === 'progression')
      .sort((a, b) => (b.nextProductionScoreDelta || 0) - (a.nextProductionScoreDelta || 0))
      .slice(0, 25),
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  if (writeRows) {
    fs.writeFileSync(path.join(outputDir, 'rows.json'), `${JSON.stringify({ schemaVersion: 1, generatedAt: summary.generatedAt, rows }, null, 2)}\n`);
  }
  console.log(`Built ${rows.length} player-season outcome rows in ${path.relative(rootDir, outputDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
