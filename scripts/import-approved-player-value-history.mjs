import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const inputPath = process.env.INPUT_FILE ? path.resolve(rootDir, process.env.INPUT_FILE) : '';
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'approved-player-value-history.json');
const sourceKey = process.env.SOURCE_KEY || 'approved-import';
const sourceName = process.env.SOURCE_NAME || sourceKey;
const daysBack = Number(process.env.DAYS_BACK || 1461);
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const minDate = new Date(now);
minDate.setDate(minDate.getDate() - daysBack);

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Import approved historical player values from a JSON or CSV export.',
    '',
    'Required:',
    '  INPUT_FILE=path/to/export.csv',
    '',
    'Environment:',
    '  SOURCE_KEY=fantasycalc-approved-export',
    '  SOURCE_NAME=FantasyCalc approved export',
    '  DAYS_BACK=1461',
    '  OUT_FILE=server/value-history-archive/approved-player-value-history.json',
    '',
    'Accepted row fields:',
    '  date, playerName/name, playerId/playerKey, position, value, rank, format',
    '  optional raw sources: ktcValue, fantasyCalcValue, fantasyProsValue, dynastyProcessValue, dynastyNerdsValue, flockFantasyValue',
    '',
    'Notes:',
    '  Use this only for data we are allowed to store: our own snapshots, licensed APIs, official exports, or manually provided files.',
  ].join('\n'));
  process.exit(0);
}

if (!inputPath) {
  throw new Error('INPUT_FILE is required. Run `pnpm import:value-history -- --help` for usage.');
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function loadRows(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (/\.csv$/i.test(filePath)) return parseCsv(text);

  const payload = JSON.parse(text);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.values)) return payload.values;
  if (Array.isArray(payload.players)) {
    return payload.players.flatMap((player) => (player.points || []).map((point) => ({
      ...point,
      playerName: player.name,
      playerKey: player.key,
      position: player.position,
    })));
  }
  throw new Error('Unsupported JSON shape. Use an array, { rows }, { values }, or { players:[{ points }] }.');
}

function cleanDateKey(value) {
  const raw = String(value || '').trim();
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (direct) return direct;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function isInsideWindow(dateKey) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date >= minDate && date <= now;
}

function numberOrNull(value) {
  const numeric = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function firstNumber(row, keys) {
  for (const key of keys) {
    const value = numberOrNull(row[key]);
    if (value !== null) return value;
  }
  return null;
}

function keyFor(row) {
  const raw = row.playerId || row.player_id || row.playerKey || row.key || row.playerName || row.name;
  return String(raw || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeRow(row) {
  const date = cleanDateKey(row.date || row.snapshotDate || row.snapshot_key || row.snapshotKey);
  const value = numberOrNull(row.value || row.dynastyValue || row.ktcValue || row.marketValue || row.blendedValue);
  const key = keyFor(row);
  if (!date || !isInsideWindow(date) || !value || !key) return null;

  return {
    key,
    name: String(row.playerName || row.name || row.fullName || key).trim(),
    position: row.position || row.pos || null,
    point: {
      date,
      value,
      rank: row.rank || row.positionRank || row.overallRank || null,
      sources: [sourceName],
      importedSource: sourceKey,
      format: row.format || row.scoring || null,
      market: {
        ktc: firstNumber(row, ['ktc', 'ktcValue', 'marketKtc', 'market_value_ktc']),
        fantasyCalc: firstNumber(row, ['fantasyCalc', 'fantasyCalcValue', 'marketFantasyCalc', 'market_value_fantasycalc']),
      },
      expert: {
        fantasyPros: firstNumber(row, ['fantasyPros', 'fantasyProsValue', 'expertFantasyPros', 'expert_value_fantasypros']),
        dynastyProcess: firstNumber(row, ['dynastyProcess', 'dynastyProcessValue', 'expertDynastyProcess', 'expert_value_dynastyprocess']),
        dynastyNerds: firstNumber(row, ['dynastyNerds', 'dynastyNerdsValue', 'expertDynastyNerds', 'expert_value_dynastynerds']),
        flockFantasy: firstNumber(row, ['flockFantasy', 'flockFantasyValue', 'expertFlockFantasy', 'expert_value_flock']),
      },
      sourceMeta: {
        importTemplateVersion: 'value-history-import-v1',
      },
    },
  };
}

function main() {
  const rows = loadRows(inputPath);
  const players = new Map();

  for (const row of rows) {
    const normalized = normalizeRow(row);
    if (!normalized) continue;
    const existing = players.get(normalized.key) || {
      key: normalized.key,
      name: normalized.name,
      position: normalized.position,
      points: [],
    };
    existing.name = existing.name || normalized.name;
    existing.position = existing.position || normalized.position;
    existing.points.push(normalized.point);
    players.set(normalized.key, existing);
  }

  const archivePlayers = Array.from(players.values()).map((player) => ({
    ...player,
    points: player.points.sort((a, b) => a.date.localeCompare(b.date)),
  })).sort((a, b) => a.name.localeCompare(b.name));

  const archive = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: sourceKey,
    sourceName,
    inputFile: path.relative(rootDir, inputPath),
    daysBack,
    minDate: minDate.toISOString().slice(0, 10),
    maxDate: now.toISOString().slice(0, 10),
    playerCount: archivePlayers.length,
    pointCount: archivePlayers.reduce((sum, player) => sum + player.points.length, 0),
    policy: {
      note: 'Only import data we are allowed to store and reuse. This command intentionally imports exports/files instead of scraping competitor pages.',
    },
    players: archivePlayers,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(archive, null, 2)}\n`);
  console.log(`Imported ${archive.pointCount} points for ${archive.playerCount} players to ${path.relative(rootDir, outputPath)}`);
}

main();
