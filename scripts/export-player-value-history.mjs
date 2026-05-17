import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const snapshotDir = path.join(rootDir, 'server', 'ktc-snapshots');
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'player-value-history.json');
const profileKey = process.env.VALUE_PROFILE_KEY || '';
const sinceKey = process.env.SINCE || '';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Export local stored player value history.',
    '',
    'Environment:',
    '  VALUE_PROFILE_KEY=12_sf_ppr_base  Optional blended profile key to export.',
    '  SINCE=2026-05-01                 Optional first snapshot date key.',
    '  OUT_FILE=path/to/history.json    Optional output path.',
    '',
    'Example:',
    '  VALUE_PROFILE_KEY=12_sf_ppr_base SINCE=2026-05-01 pnpm export:value-history',
  ].join('\n'));
  process.exit(0);
}

function unwrapSnapshotValues(payload) {
  if (
    profileKey &&
    payload &&
    typeof payload === 'object' &&
    payload.blendedProfiles &&
    typeof payload.blendedProfiles === 'object' &&
    payload.blendedProfiles[profileKey]
  ) {
    return payload.blendedProfiles[profileKey] || {};
  }

  if (payload && typeof payload === 'object' && payload.values && typeof payload.values === 'object') {
    return payload.values;
  }

  return payload && typeof payload === 'object' ? payload : {};
}

function getDateKey(fileName) {
  return fileName.match(/^ktc-snapshot-(\d{4}-\d{2}-\d{2})\.json$/)?.[1] || null;
}

function compactRow(row) {
  return {
    value: Number(row.dynasty_value ?? row.ktc_value ?? row.true_value ?? 0) || null,
    rank: row.position_rank || row.flock_position_rank || row.dynastynerds_position_rank || null,
    sources: Array.isArray(row.value_sources) ? row.value_sources : [],
    market: {
      ktc: Number(row.market_value_ktc ?? 0) || null,
      fantasyCalc: Number(row.market_value_fantasycalc ?? 0) || null,
    },
    expert: {
      fantasyPros: Number(row.expert_value_fantasypros ?? 0) || null,
      dynastyProcess: Number(row.expert_value_dynastyprocess ?? 0) || null,
      dynastyNerds: Number(row.expert_value_dynastynerds ?? 0) || null,
      flockFantasy: Number(row.expert_value_flock ?? 0) || null,
    },
  };
}

function main() {
  if (!fs.existsSync(snapshotDir)) {
    throw new Error(`Snapshot directory not found: ${snapshotDir}`);
  }

  const files = fs
    .readdirSync(snapshotDir)
    .map((fileName) => ({ fileName, dateKey: getDateKey(fileName) }))
    .filter((file) => file.dateKey && (!sinceKey || file.dateKey >= sinceKey))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const players = new Map();

  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(snapshotDir, file.fileName), 'utf8'));
    const values = unwrapSnapshotValues(payload);
    for (const [playerKey, row] of Object.entries(values)) {
      if (!row || typeof row !== 'object') continue;
      const name = row.name || playerKey;
      const historyKey = String(playerKey || name).toLowerCase();
      const existing = players.get(historyKey) || {
        key: historyKey,
        name,
        position: row.position || row.pos || null,
        points: [],
      };
      existing.name = existing.name || name;
      existing.position = existing.position || row.position || row.pos || null;
      existing.points.push({
        date: file.dateKey,
        ...compactRow(row),
      });
      players.set(historyKey, existing);
    }
  }

  const archive = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'local-stored-value-snapshots',
    profileKey: profileKey || null,
    since: sinceKey || null,
    snapshotCount: files.length,
    playerCount: players.size,
    policy: {
      note: 'This archive is generated from local stored snapshots only. Do not bulk scrape competitor pages unless their API or terms explicitly allow storage and reuse.',
    },
    players: Array.from(players.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(archive, null, 2)}\n`);
  console.log(`Exported ${archive.playerCount} players from ${archive.snapshotCount} snapshots to ${path.relative(rootDir, outputPath)}`);
}

main();
