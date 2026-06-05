import fs from 'node:fs';
import path from 'node:path';
import { writeArchive } from './value-history-archive-io.mjs';

const rootDir = process.cwd();
const snapshotDir = process.env.SNAPSHOT_DIR
  ? path.resolve(rootDir, process.env.SNAPSHOT_DIR)
  : path.join(rootDir, 'server', 'ktc-snapshots');
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'local-cache-blended-history.json');
const auditPath = process.env.AUDIT_FILE
  ? path.resolve(rootDir, process.env.AUDIT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'local-cache-blended-history-audit.json');
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
const sinceKey = String(process.env.SINCE || '').trim();
const untilKey = String(process.env.UNTIL || '').trim();

const VALUE_FIELDS = [
  'ktc_value',
  'dynasty_value',
  'true_value',
  'redraft_value',
  'value',
  'market_value_ktc',
];
const RANK_FIELDS = [
  'position_rank',
  'fantasypros_dynasty_position_rank',
  'fantasypros_position_rank',
  'dynastynerds_position_rank',
  'flock_position_rank',
];
const OVERALL_RANK_FIELDS = [
  'overall_rank',
  'rank',
  'ktc_rank',
  'fantasypros_dynasty_rank',
  'fantasypros_rank',
  'dynastynerds_rank',
  'flock_rank',
];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Promote app-owned cached blended profile snapshots into a durable value-history archive.',
    '',
    'Environment:',
    '  SNAPSHOT_DIR=server/ktc-snapshots',
    '  VALUE_PROFILE_KEYS=12_sf_ppr_base,12_sf_ppr_tep_1_0',
    '  SINCE=2026-05-01',
    '  UNTIL=2026-05-18',
    '  OUT_FILE=server/value-history-archive/local-cache-blended-history.json',
    '  AUDIT_FILE=server/value-history-archive/local-cache-blended-history-audit.json',
    '',
    'Notes:',
    '  This uses only Dynasty Degen cached snapshot files.',
    '  It does not call providers and does not scrape external pages.',
    '  The output is app-owned fallback history; source-native provider history remains separate.',
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

function firstNumber(row, fields) {
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

function getContributors(row) {
  return Array.from(new Set([
    ...(Array.isArray(row?.value_sources) ? row.value_sources : []),
    ...(Array.isArray(row?.benchmark_sources) ? row.benchmark_sources : []),
  ].map((source) => String(source || '').trim()).filter(Boolean))).sort();
}

function buildPoint({ row, date, profileKey }) {
  const value = firstNumber(row, VALUE_FIELDS);
  if (!value) return null;
  const contributors = getContributors(row);
  return {
    date,
    value,
    rank: firstString(row, RANK_FIELDS),
    overallRank: firstNumber(row, OVERALL_RANK_FIELDS),
    sources: ['DynastyDegenCache'],
    importedSource: 'local-cache-blended-profile',
    format: profileKey,
    sourceMeta: {
      historyMethod: 'app-owned-cached-blended-profile',
      profileKey,
      valueFieldsChecked: VALUE_FIELDS,
      contributorSources: contributors,
    },
  };
}

function increment(map, key, amount = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + amount;
}

function updateRange(target, key, date) {
  if (!key || !date) return;
  const range = target[key] || { minDate: date, maxDate: date };
  if (date < range.minDate) range.minDate = date;
  if (date > range.maxDate) range.maxDate = date;
  target[key] = range;
}

function sortObject(input) {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
}

function listSnapshotFiles() {
  if (!fs.existsSync(snapshotDir)) throw new Error(`Snapshot directory not found: ${snapshotDir}`);
  return fs.readdirSync(snapshotDir)
    .map((fileName) => ({ fileName, date: getDateKey(fileName) }))
    .filter((file) => file.date)
    .filter((file) => (!sinceKey || file.date >= sinceKey) && (!untilKey || file.date <= untilKey))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  const files = listSnapshotFiles();
  const players = new Map();
  const countsByProfile = {};
  const countsByDate = {};
  const countsByContributor = {};
  const profileDateRanges = {};
  const playerKeysByProfile = new Map();
  const missingProfilesByDate = {};
  const emptyProfilesByDate = {};
  let skippedRows = 0;

  for (const file of files) {
    const payload = JSON.parse(fs.readFileSync(path.join(snapshotDir, file.fileName), 'utf8'));
    for (const profileKey of profileKeys) {
      const values = profileValues(payload, profileKey);
      const entries = Object.entries(values);
      if (!entries.length) {
        increment(missingProfilesByDate, `${file.date}|${profileKey}`);
        continue;
      }

      let profilePoints = 0;
      for (const [playerKey, row] of entries) {
        if (!row || typeof row !== 'object') continue;
        const point = buildPoint({ row, date: file.date, profileKey });
        if (!point) {
          skippedRows += 1;
          continue;
        }
        const key = normalizeKey(playerKey || row.name);
        addPoint(players, {
          key,
          name: row.name || playerKey,
          position: row.position || row.pos || null,
          point,
        });
        profilePoints += 1;
        increment(countsByProfile, profileKey);
        increment(countsByDate, file.date);
        updateRange(profileDateRanges, profileKey, file.date);
        const profilePlayerKeys = playerKeysByProfile.get(profileKey) || new Set();
        profilePlayerKeys.add(key);
        playerKeysByProfile.set(profileKey, profilePlayerKeys);
        for (const contributor of point.sourceMeta.contributorSources) {
          increment(countsByContributor, contributor);
        }
      }

      if (!profilePoints) increment(emptyProfilesByDate, `${file.date}|${profileKey}`);
    }
  }

  const archivePlayers = Array.from(players.values())
    .map((player) => ({
      ...player,
      points: player.points.sort((a, b) => a.date.localeCompare(b.date) || String(a.format).localeCompare(String(b.format))),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const pointCount = archivePlayers.reduce((sum, player) => sum + player.points.length, 0);
  const playerCountByProfile = Object.fromEntries(
    Array.from(playerKeysByProfile.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([profileKey, playerKeys]) => [profileKey, playerKeys.size])
  );
  const header = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'local-cache-blended-history',
    sourceName: 'Dynasty Degen Cached Blended Profiles',
    snapshotDir: path.relative(rootDir, snapshotDir),
    snapshotCount: files.length,
    profileKeys,
    since: sinceKey || null,
    until: untilKey || null,
    playerCount: archivePlayers.length,
    pointCount,
    countsByProfile: sortObject(countsByProfile),
    playerCountByProfile,
    policy: {
      note: 'App-owned cached profile values promoted as fallback historical values. No provider pages or APIs are called. Source-native provider history should remain separate and preferred when available.',
    },
  };
  const audit = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    archiveFile: path.relative(rootDir, outputPath),
    snapshotDir: path.relative(rootDir, snapshotDir),
    snapshotCount: files.length,
    profileKeys,
    since: sinceKey || null,
    until: untilKey || null,
    playerCount: archivePlayers.length,
    pointCount,
    skippedRows,
    countsByProfile: sortObject(countsByProfile),
    playerCountByProfile,
    countsByDate: sortObject(countsByDate),
    countsByContributor: sortObject(countsByContributor),
    profileDateRanges: sortObject(profileDateRanges),
    missingProfileCount: Object.keys(missingProfilesByDate).length,
    emptyProfileCount: Object.keys(emptyProfilesByDate).length,
    missingProfilesByDate: sortObject(missingProfilesByDate),
    emptyProfilesByDate: sortObject(emptyProfilesByDate),
    passed: files.length > 0 && pointCount > 0,
    policy: {
      note: 'Use this audit to decide which cached profiles are strong enough to merge into the historical archive. Missing profile rows usually mean that profile was not being captured on that snapshot date.',
    },
  };

  await writeArchive(outputPath, header, archivePlayers);
  await fs.promises.mkdir(path.dirname(auditPath), { recursive: true });
  await fs.promises.writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

  console.log(`Promoted ${pointCount} cached blend points for ${archivePlayers.length} players from ${files.length} snapshots.`);
  console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
  console.log(`Wrote ${path.relative(rootDir, auditPath)}`);
  if (!audit.passed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
