import fs from 'node:fs';
import path from 'node:path';
import {
  buildHistoricalPlayerTeamMap,
  type HistoricalPlayerTeamInputRow,
  type HistoricalPlayerTeamMap,
} from '../server/historicalPlayerTeamMap';

const rootDir = process.cwd();
const inputPath = path.resolve(rootDir, process.env.PLAYER_TEAM_HISTORY_FILE || '.cache/modeling/player-team-history-rows.json');
const outputPath = path.resolve(rootDir, process.env.OUT_FILE || '.cache/modeling/player-team-history.json');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Build an approved historical player-team map for matchup calibration.',
    '',
    'Use this before building Sleeper matchup actuals so traded players are joined to the correct historical NFL schedule rows.',
    '',
    'Environment:',
    '  PLAYER_TEAM_HISTORY_FILE=.cache/modeling/player-team-history-rows.json',
    '  OUT_FILE=.cache/modeling/player-team-history.json',
    '',
    'Input may be an array or { rows: [...] } with playerId/sourcePlayerId, season, optional week, team, source, and confidence.',
  ].join('\n'));
  process.exit(0);
}

function readJson<T>(filePath: string, label: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${path.relative(rootDir, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readRows(filePath: string): HistoricalPlayerTeamInputRow[] {
  const parsed = readJson<HistoricalPlayerTeamInputRow[] | { rows?: HistoricalPlayerTeamInputRow[] }>(filePath, 'Historical player-team rows file');
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  throw new Error(`Invalid historical player-team rows file: ${path.relative(rootDir, filePath)}`);
}

function writeMarkdownSummary(filePath: string, map: HistoricalPlayerTeamMap) {
  const conflicts = map.conflicts.slice(0, 50);
  const markdown = [
    '# Historical Player-Team Map',
    '',
    `Generated from ${map.coverage.usableRows} usable rows across ${map.coverage.sourceCount} sources.`,
    '',
    '## Coverage',
    '',
    '| Metric | Count |',
    '| --- | ---: |',
    `| Input rows | ${map.coverage.inputRows} |`,
    `| Usable rows | ${map.coverage.usableRows} |`,
    `| Skipped rows | ${map.coverage.skippedRows} |`,
    `| Players | ${map.coverage.playerCount} |`,
    `| Season-week keys | ${map.coverage.seasonWeekKeys} |`,
    `| Season keys | ${map.coverage.seasonKeys} |`,
    `| Player fallback keys | ${map.coverage.playerKeys} |`,
    `| Conflicts | ${map.coverage.conflictCount} |`,
    '',
    '## Conflicts',
    '',
    conflicts.length
      ? [
        '| Key | Scope | Teams | Sources | Reason |',
        '| --- | --- | --- | --- | --- |',
        ...conflicts.map(conflict => `| ${conflict.key} | ${conflict.scope} | ${conflict.teams.join(', ')} | ${conflict.sources.join(', ')} | ${conflict.reason} |`),
      ].join('\n')
      : '_None._',
    '',
  ].join('\n');

  fs.writeFileSync(filePath, markdown);
}

const rows = readRows(inputPath);
const map = buildHistoricalPlayerTeamMap(rows);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(map, null, 2)}\n`);
writeMarkdownSummary(outputPath.replace(/\.json$/i, '.md'), map);

console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
console.log(`Coverage: ${map.coverage.usableRows}/${map.coverage.inputRows} usable rows, ${map.coverage.conflictCount} conflicts`);
