import fs from 'node:fs';
import path from 'node:path';
import { writeArchive } from './value-history-archive-io.mjs';

const rootDir = process.cwd();
const snapshotDir = process.env.SNAPSHOT_DIR
  ? path.resolve(rootDir, process.env.SNAPSHOT_DIR)
  : path.join(rootDir, 'server', 'ktc-snapshots');
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'local-weighted-source-history.json');
const profileKeys = String(process.env.VALUE_PROFILE_KEYS || [
  '12_sf_ppr_base',
  '12_sf_ppr_tep_0_5',
  '12_sf_ppr_tep_1_0',
  '12_sf_ppr_tep_1_5',
  '12_one_qb_ppr_base',
  '12_one_qb_ppr_tep_0_5',
  '12_one_qb_ppr_tep_1_0',
  '12_one_qb_ppr_tep_1_5',
].join(','))
  .split(',')
  .map((profile) => profile.trim())
  .filter(Boolean);
const sourceKeys = new Set(String(process.env.SOURCES || [
  'fantasyCalc',
  'fantasyPros',
  'dynastyProcess',
  'dynastyNerds',
].join(','))
  .split(',')
  .map((source) => source.trim())
  .filter(Boolean));
const sinceKey = String(process.env.SINCE || '').trim();

const SOURCE_DEFINITIONS = {
  fantasyCalc: {
    label: 'FantasyCalc',
    valueFields: ['market_value_fantasycalc'],
    rankFields: [],
    marketKey: 'fantasyCalc',
  },
  fantasyPros: {
    label: 'FantasyPros',
    valueFields: ['expert_value_fantasypros'],
    rankFields: ['fantasypros_dynasty_position_rank', 'fantasypros_position_rank'],
    overallRankFields: ['fantasypros_dynasty_rank', 'fantasypros_rank'],
    expertKey: 'fantasyPros',
  },
  dynastyProcess: {
    label: 'DynastyProcess',
    valueFields: ['expert_value_dynastyprocess'],
    rankFields: [],
    expertKey: 'dynastyProcess',
  },
  dynastyNerds: {
    label: 'DynastyNerds',
    valueFields: ['expert_value_dynastynerds'],
    rankFields: ['dynastynerds_position_rank'],
    overallRankFields: ['dynastynerds_rank'],
    expertKey: 'dynastyNerds',
  },
};

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Export raw provider points from local stored blended value snapshots.',
    '',
    'Environment:',
    '  SNAPSHOT_DIR=server/ktc-snapshots',
    '  VALUE_PROFILE_KEYS=12_sf_ppr_base,12_sf_ppr_tep_1_0',
    '  SOURCES=fantasyCalc,fantasyPros,dynastyProcess,dynastyNerds',
    '  SINCE=2026-05-01',
    '  OUT_FILE=server/value-history-archive/local-weighted-source-history.json',
    '',
    'Notes:',
    '  This only uses local snapshots already stored by the app.',
    '  It does not call or scrape provider sites.',
  ].join('\n'));
  process.exit(0);
}

function getDateKey(fileName) {
  return fileName.match(/^ktc-snapshot-(\d{4}-\d{2}-\d{2})\.json$/)?.[1] || null;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function firstValue(row, fields) {
  for (const field of fields || []) {
    const value = numberOrNull(row?.[field]);
    if (value !== null) return value;
  }
  return null;
}

function firstString(row, fields) {
  for (const field of fields || []) {
    const value = String(row?.[field] || '').trim();
    if (value) return value;
  }
  return null;
}

function profileValues(payload, profileKey) {
  if (payload?.blendedProfiles?.[profileKey] && typeof payload.blendedProfiles[profileKey] === 'object') {
    return payload.blendedProfiles[profileKey];
  }
  if (!profileKey && payload?.values && typeof payload.values === 'object') return payload.values;
  return {};
}

function addPoint(players, input) {
  if (!input.key || !input.point?.date || !input.point?.value) return;
  const existing = players.get(input.key) || {
    key: input.key,
    name: input.name,
    position: input.position || null,
    points: [],
  };
  existing.name = existing.name || input.name;
  existing.position = existing.position || input.position || null;
  existing.points.push(input.point);
  players.set(input.key, existing);
}

function buildPoint({ row, date, format, sourceKey, source }) {
  const value = firstValue(row, source.valueFields);
  if (!value) return null;
  const market = {};
  const expert = {};
  if (source.marketKey) market[source.marketKey] = value;
  if (source.expertKey) expert[source.expertKey] = value;

  return {
    date,
    value,
    rank: firstString(row, source.rankFields),
    overallRank: firstValue(row, source.overallRankFields),
    sources: [source.label],
    importedSource: `local-snapshot-${sourceKey}`,
    format,
    market,
    expert,
    sourceMeta: {
      historyMethod: 'local-stored-blended-snapshot-source-column',
      profileKey: format,
    },
  };
}

async function main() {
  if (!fs.existsSync(snapshotDir)) throw new Error(`Snapshot directory not found: ${snapshotDir}`);
  const files = fs.readdirSync(snapshotDir)
    .map((fileName) => ({ fileName, date: getDateKey(fileName) }))
    .filter((file) => file.date && (!sinceKey || file.date >= sinceKey))
    .sort((a, b) => a.date.localeCompare(b.date));
  const players = new Map();
  const countsBySource = {};
  const countsByFormat = {};

  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(snapshotDir, file.fileName), 'utf8'));
    for (const profileKey of profileKeys) {
      const values = profileValues(payload, profileKey);
      for (const [playerKey, row] of Object.entries(values)) {
        if (!row || typeof row !== 'object') continue;
        const key = normalizeKey(playerKey || row.name);
        for (const [sourceKey, source] of Object.entries(SOURCE_DEFINITIONS)) {
          if (!sourceKeys.has(sourceKey)) continue;
          const point = buildPoint({ row, date: file.date, format: profileKey, sourceKey, source });
          if (!point) continue;
          addPoint(players, {
            key,
            name: row.name || playerKey,
            position: row.position || row.pos || null,
            point,
          });
          countsBySource[source.label] = (countsBySource[source.label] || 0) + 1;
          countsByFormat[profileKey] = (countsByFormat[profileKey] || 0) + 1;
        }
      }
    }
  }

  const archivePlayers = Array.from(players.values())
    .map((player) => ({
      ...player,
      points: player.points.sort((a, b) => a.date.localeCompare(b.date) || String(a.format).localeCompare(String(b.format))),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const pointCount = archivePlayers.reduce((sum, player) => sum + player.points.length, 0);
  const header = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'local-weighted-source-snapshots',
    snapshotDir: path.relative(rootDir, snapshotDir),
    snapshotCount: files.length,
    profileKeys,
    sourceKeys: Array.from(sourceKeys),
    since: sinceKey || null,
    playerCount: archivePlayers.length,
    pointCount,
    countsBySource,
    countsByFormat,
    policy: {
      note: 'Raw provider points reconstructed only from app-owned local stored blend snapshots. No provider pages are called.',
    },
  };

  await writeArchive(outputPath, header, archivePlayers);
  console.log(`Exported ${pointCount} local source points for ${archivePlayers.length} players to ${path.relative(rootDir, outputPath)}`);
}

main();
