import fs from 'node:fs';
import path from 'node:path';
import type { MatchupScheduleSnapshotPayload } from '../server/matchupScheduleSnapshots';
import type { NflScheduleSnapshotPayload } from '../server/nflScheduleSnapshots';
import { toSleeperHistoricalTeamMaps, type HistoricalPlayerTeamMap } from '../server/historicalPlayerTeamMap';
import {
  buildPlayerMatchupActuals,
  type PlayerMatchupActualInputRow,
  type PlayerMatchupActualsResult,
  type PlayerMatchupArchetypeSummary,
} from '../server/playerMatchupActuals';
import {
  buildSleeperMatchupActualRowsForSeason,
  type SleeperHistoricalTeamMaps,
  type SleeperWeeklyStatsSnapshotLike,
} from '../server/sleeperMatchupActuals';

const rootDir = process.cwd();
const actualsPath = path.resolve(rootDir, process.env.ACTUALS_FILE || '.cache/modeling/player-projections/actuals.json');
const schedulePath = process.env.SCHEDULE_FILE ? path.resolve(rootDir, process.env.SCHEDULE_FILE) : null;
const scheduleFiles = (process.env.SCHEDULE_FILES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => path.resolve(rootDir, value));
const matchupScheduleFiles = (process.env.MATCHUP_SCHEDULE_FILES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => path.resolve(rootDir, value));
const sleeperWeeklyStatsFiles = (process.env.SLEEPER_WEEKLY_STATS_FILES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => path.resolve(rootDir, value));
const sleeperPlayersPath = process.env.SLEEPER_PLAYERS_FILE
  ? path.resolve(rootDir, process.env.SLEEPER_PLAYERS_FILE)
  : null;
const sleeperTeamMapPath = process.env.SLEEPER_TEAM_MAP_FILE
  ? path.resolve(rootDir, process.env.SLEEPER_TEAM_MAP_FILE)
  : null;
const scoringSettingsPath = process.env.SCORING_SETTINGS_FILE
  ? path.resolve(rootDir, process.env.SCORING_SETTINGS_FILE)
  : null;
const outputDir = path.resolve(rootDir, process.env.OUT_DIR || '.cache/modeling/player-matchup-actuals');
const minSampleSize = Number(process.env.MIN_SAMPLE_SIZE || 5);

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Build offline historical matchup-actuals archetypes for AI readouts.',
    '',
    'Default input and output are gitignored .cache files. This does not affect pages or report payloads until a compact summary is intentionally wired in.',
    '',
    'Environment:',
    '  ACTUALS_FILE=.cache/modeling/player-projections/actuals.json',
    '  SCHEDULE_FILE=.cache/modeling/player-projections/schedule-snapshot.json',
    '  SCHEDULE_FILES=.cache/modeling/schedules/2024.json,.cache/modeling/schedules/2025.json',
    '  MATCHUP_SCHEDULE_FILES=.cache/modeling/sos/wr.json,.cache/modeling/sos/rb.json',
    '  SLEEPER_WEEKLY_STATS_FILES=.cache/sleeper/2024-w1.json,.cache/sleeper/2024-w2.json',
    '  SLEEPER_PLAYERS_FILE=.cache/sleeper/players-nfl.json',
    '  SLEEPER_TEAM_MAP_FILE=.cache/modeling/player-team-history.json',
    '  SCORING_SETTINGS_FILE=.cache/modeling/scoring-settings.json',
    '  ALLOW_PLAYER_TEAM_FALLBACK=0',
    '  OUT_DIR=.cache/modeling/player-matchup-actuals',
    '  MIN_SAMPLE_SIZE=5',
    '',
    'Actuals file may be either an array or { rows: [...] }.',
    'Sleeper weekly files may be raw { season, week, values }, stored Sleeper snapshots, or { snapshots: [...] }.',
    'Use a historical team map for traded players; current Sleeper player team fallback is off by default.',
    'Matchup files may be a snapshot, an array of snapshots, or { snapshots: [...] }.',
  ].join('\n'));
  process.exit(0);
}

function readJson<T>(filePath: string, label: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${path.relative(rootDir, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readActualRows(filePath: string): PlayerMatchupActualInputRow[] {
  const parsed = readJson<PlayerMatchupActualInputRow[] | { rows?: PlayerMatchupActualInputRow[] }>(filePath, 'Player matchup actuals file');
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  throw new Error(`Invalid player matchup actuals file: ${path.relative(rootDir, filePath)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSleeperWeekSnapshot(value: unknown): value is SleeperWeeklyStatsSnapshotLike {
  const candidate = value as Partial<SleeperWeeklyStatsSnapshotLike>;
  return Boolean(
    candidate?.season !== undefined
    && candidate.week !== undefined
    && candidate.values
    && typeof candidate.values === 'object'
    && !Array.isArray(candidate.values)
  );
}

function readSleeperWeeklySnapshots(filePaths: string[]): SleeperWeeklyStatsSnapshotLike[] {
  const snapshots: SleeperWeeklyStatsSnapshotLike[] = [];
  for (const filePath of filePaths) {
    const parsed = readJson<unknown>(filePath, 'Sleeper weekly stats snapshot');
    if (isSleeperWeekSnapshot(parsed)) {
      snapshots.push(parsed);
      continue;
    }
    if (Array.isArray(parsed)) {
      snapshots.push(...parsed.filter(isSleeperWeekSnapshot));
      continue;
    }
    if (isRecord(parsed) && Array.isArray(parsed.snapshots)) {
      snapshots.push(...parsed.snapshots.filter(isSleeperWeekSnapshot));
      continue;
    }
    if (isRecord(parsed) && process.env.SLEEPER_SEASON && process.env.SLEEPER_WEEK) {
      snapshots.push({
        season: process.env.SLEEPER_SEASON,
        week: process.env.SLEEPER_WEEK,
        values: parsed,
      });
      continue;
    }
    throw new Error(`Invalid Sleeper weekly stats file: ${path.relative(rootDir, filePath)}`);
  }
  return snapshots;
}

function readTeamMaps(filePath: string | null): SleeperHistoricalTeamMaps | undefined {
  if (!filePath) return undefined;
  const parsed = readJson<unknown>(filePath, 'Sleeper historical team map');
  if (!isRecord(parsed)) throw new Error(`Invalid Sleeper historical team map: ${path.relative(rootDir, filePath)}`);
  if (parsed.schemaVersion === 1 && parsed.generatedFrom === 'historical-player-team-rows') {
    return toSleeperHistoricalTeamMaps(parsed as HistoricalPlayerTeamMap);
  }
  return {
    byPlayerSeasonWeek: isRecord(parsed.byPlayerSeasonWeek) ? parsed.byPlayerSeasonWeek as Record<string, string> : undefined,
    byPlayerSeason: isRecord(parsed.byPlayerSeason) ? parsed.byPlayerSeason as Record<string, string> : undefined,
    byPlayerId: isRecord(parsed.byPlayerId) ? parsed.byPlayerId as Record<string, string> : undefined,
  };
}

function readScoringSettings(filePath: string | null): Record<string, any> | null {
  if (!filePath) return null;
  const parsed = readJson<unknown>(filePath, 'Scoring settings');
  return isRecord(parsed) ? parsed : null;
}

function buildActualRows(): PlayerMatchupActualInputRow[] {
  if (!sleeperWeeklyStatsFiles.length) return readActualRows(actualsPath);
  if (!sleeperPlayersPath) {
    throw new Error('SLEEPER_PLAYERS_FILE is required when SLEEPER_WEEKLY_STATS_FILES is used.');
  }
  const players = readJson<Record<string, any>>(sleeperPlayersPath, 'Sleeper players file');
  const weeks = readSleeperWeeklySnapshots(sleeperWeeklyStatsFiles);
  const teamMaps = readTeamMaps(sleeperTeamMapPath);
  const scoringSettings = readScoringSettings(scoringSettingsPath);
  return buildSleeperMatchupActualRowsForSeason({
    weeks,
    players,
    scoringSettings,
    teamMaps,
    allowPlayerMetadataTeamFallback: process.env.ALLOW_PLAYER_TEAM_FALLBACK === '1',
  });
}

function isMatchupSnapshot(value: unknown): value is MatchupScheduleSnapshotPayload {
  const candidate = value as Partial<MatchupScheduleSnapshotPayload>;
  return candidate?.schemaVersion === 1 && Array.isArray(candidate.rows) && Boolean(candidate.position);
}

function readMatchupSnapshots(filePaths: string[]): MatchupScheduleSnapshotPayload[] {
  const snapshots: MatchupScheduleSnapshotPayload[] = [];
  for (const filePath of filePaths) {
    const parsed = readJson<unknown>(filePath, 'Matchup schedule snapshot');
    if (isMatchupSnapshot(parsed)) {
      snapshots.push(parsed);
      continue;
    }
    if (Array.isArray(parsed)) {
      snapshots.push(...parsed.filter(isMatchupSnapshot));
      continue;
    }
    const maybeWrapped = parsed as { snapshots?: unknown[] };
    if (Array.isArray(maybeWrapped.snapshots)) {
      snapshots.push(...maybeWrapped.snapshots.filter(isMatchupSnapshot));
      continue;
    }
    throw new Error(`Invalid matchup schedule snapshot file: ${path.relative(rootDir, filePath)}`);
  }
  return snapshots;
}

function formatPct(value: number | null): string {
  return value === null ? 'n/a' : `${value}%`;
}

function archetypeTable(rows: PlayerMatchupArchetypeSummary[]): string {
  if (!rows.length) return '_None._';
  return [
    '| Archetype | Rec | Sample | Confidence | Avg Pts | Avg Error | Beat | Ceiling | Floor Miss |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => `| ${row.summaryKey} | ${row.recommendation} | ${row.sampleSize} | ${row.confidence} | ${row.avgActualFantasyPoints ?? 'n/a'} | ${row.avgProjectionError ?? 'n/a'} | ${formatPct(row.beatProjectionRate)} | ${formatPct(row.ceilingRate)} | ${formatPct(row.floorMissRate)} |`),
  ].join('\n');
}

function playerOpponentTable(rows: PlayerMatchupActualsResult['playerOpponentHistories']): string {
  if (!rows.length) return '_None._';
  return [
    '| Player | Pos | Opp | Rec | Sample | Confidence | Avg | Median | High | Low | Beat Projection |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => `| ${row.playerName || row.playerId || 'Unknown'} | ${row.position} | ${row.opponent} | ${row.recommendation} | ${row.sampleSize} | ${row.confidence} | ${row.avgFantasyPoints ?? 'n/a'} | ${row.medianFantasyPoints ?? 'n/a'} | ${row.highFantasyPoints ?? 'n/a'} | ${row.lowFantasyPoints ?? 'n/a'} | ${formatPct(row.beatProjectionRate)} |`),
  ].join('\n');
}

function writeMarkdownSummary(outputPath: string, result: PlayerMatchupActualsResult) {
  const boosts = result.summaries
    .filter((row) => row.recommendation === 'boost')
    .sort((a, b) => b.confidence - a.confidence || b.sampleSize - a.sampleSize)
    .slice(0, 20);
  const cautions = result.summaries
    .filter((row) => row.recommendation === 'caution')
    .sort((a, b) => b.confidence - a.confidence || b.sampleSize - a.sampleSize)
    .slice(0, 20);
  const blocked = result.summaries
    .filter((row) => row.recommendation === 'blocked')
    .sort((a, b) => b.sampleSize - a.sampleSize)
    .slice(0, 20);
  const directPlayerHistories = result.playerOpponentHistories
    .filter((row) => row.recommendation !== 'blocked')
    .sort((a, b) => b.confidence - a.confidence || b.sampleSize - a.sampleSize)
    .slice(0, 25);
  const markdown = [
    '# Player Matchup Actuals',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Normalized rows: ${result.rowCount}`,
    `Archetypes: ${result.summaryCount}`,
    '',
    '## Feature Coverage',
    '',
    `Actual rows read: ${result.featureCoverage.actualRows}`,
    `Rows with schedule/opponent context: ${result.featureCoverage.scheduleJoinedRows}`,
    `Rows with matchup/SOS context: ${result.featureCoverage.matchupSnapshotJoinedRows}`,
    `Rows with projection points: ${result.featureCoverage.projectionRows}`,
    `Rows with usage context: ${result.featureCoverage.usageRows}`,
    `Rows missing opponent: ${result.featureCoverage.missingOpponentRows}`,
    '',
    '## Best Boost Archetypes',
    '',
    archetypeTable(boosts),
    '',
    '## Caution Archetypes',
    '',
    archetypeTable(cautions),
    '',
    '## Blocked Thin Samples',
    '',
    archetypeTable(blocked),
    '',
    '## Direct Player-Opponent Histories',
    '',
    playerOpponentTable(directPlayerHistories),
    '',
    '## Runtime Boundary',
    '',
    'This is an offline modeling artifact. Promote only compact archetype summaries into report payloads, never raw rows.',
    '',
  ].join('\n');

  fs.writeFileSync(outputPath, markdown);
}

function main() {
  const actualRows = buildActualRows();
  const scheduleSnapshot = schedulePath && fs.existsSync(schedulePath)
    ? readJson<NflScheduleSnapshotPayload>(schedulePath, 'Schedule snapshot')
    : null;
  const scheduleSnapshots = scheduleFiles.map((filePath) => readJson<NflScheduleSnapshotPayload>(filePath, 'Schedule snapshot'));
  const matchupSnapshots = readMatchupSnapshots(matchupScheduleFiles);
  const result = buildPlayerMatchupActuals({
    actualRows,
    scheduleSnapshot,
    scheduleSnapshots,
    matchupSnapshots,
    minSampleSize: Number.isFinite(minSampleSize) ? minSampleSize : 5,
  });
  const payload = {
    ...result,
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      actuals: sleeperWeeklyStatsFiles.length ? null : path.relative(rootDir, actualsPath),
      sleeperWeeklyStats: sleeperWeeklyStatsFiles.map((filePath) => path.relative(rootDir, filePath)),
      sleeperPlayers: sleeperPlayersPath ? path.relative(rootDir, sleeperPlayersPath) : null,
      sleeperTeamMap: sleeperTeamMapPath ? path.relative(rootDir, sleeperTeamMapPath) : null,
      scoringSettings: scoringSettingsPath ? path.relative(rootDir, scoringSettingsPath) : null,
      scheduleSnapshot: schedulePath ? path.relative(rootDir, schedulePath) : null,
      scheduleSnapshots: scheduleFiles.map((filePath) => path.relative(rootDir, filePath)),
      matchupSchedules: matchupScheduleFiles.map((filePath) => path.relative(rootDir, filePath)),
    },
    outputPolicy: 'offline-modeling-only; reports should consume only intentionally published compact summaries',
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'diagnostics.json'), `${JSON.stringify(payload, null, 2)}\n`);
  writeMarkdownSummary(path.join(outputDir, 'summary.md'), result);

  console.log(`Built ${result.summaryCount} matchup archetypes from ${result.rowCount} normalized rows.`);
  console.log(`Wrote ${path.relative(rootDir, outputDir)}`);
}

main();
