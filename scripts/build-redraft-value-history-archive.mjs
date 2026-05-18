import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const fantasyProsHistoryPath = path.join(rootDir, 'server/value-history-archive/fantasypros-history.json');
const redraftSnapshotsDir = path.join(rootDir, 'server/redraft-snapshots');
const outputDir = path.join(rootDir, 'server/redraft-value-history');
const archivePath = path.join(outputDir, 'redraft-value-history-v1.json');
const trendsPath = path.join(outputDir, 'redraft-value-trends-v1.json');
const manifestPath = path.join(outputDir, 'redraft-value-history-manifest-v1.json');
const auditPath = path.join(outputDir, 'redraft-value-history-audit.json');

const redraftRankingTypes = new Set(['DRAFT', 'ADP', 'ROS']);
const playablePositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DEF']);
const sourceLabels = {
  fantasyPros: 'FantasyPros',
  fantasyNerds: 'Fantasy Nerds',
  internalSeasonBlend: 'Dynasty Degen Redraft Blend',
  mflAdp: 'MFL ADP',
  mflRankings: 'MFL Rankings',
  espnFantasy: 'ESPN Fantasy',
  fleaflicker: 'Fleaflicker',
  yahooDraftAnalysis: 'Yahoo Draft Analysis',
  nflFantasy: 'NFL Fantasy',
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizePlayerKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function asNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function inferPhase(rankingType) {
  if (rankingType === 'ADP') return 'draftCost';
  if (rankingType === 'DRAFT') return 'draftRank';
  if (rankingType === 'ROS') return 'restOfSeason';
  return 'currentSeasonSnapshot';
}

function isSupportedPosition(position) {
  if (!position) return true;
  const normalized = String(position).toUpperCase();
  if (playablePositions.has(normalized)) return true;
  if (normalized === 'D/ST') return true;
  return false;
}

function normalizePosition(position) {
  const normalized = String(position || '').toUpperCase();
  if (normalized === 'D/ST' || normalized === 'DEF') return 'DST';
  return normalized || null;
}

function isInRedraftSeasonWindow(point) {
  const season = Number(point.season);
  const dateOnly = asDateOnly(point.date);
  if (!season || !dateOnly) return true;

  const current = new Date(`${dateOnly}T00:00:00.000Z`);
  const start = new Date(`${season}-04-25T00:00:00.000Z`);
  const end = new Date(`${season + 1}-01-10T23:59:59.999Z`);
  return current >= start && current <= end;
}

function addPlayer(players, candidate) {
  const key = normalizePlayerKey(candidate.key || candidate.name);
  if (!key) return null;

  const existing = players.get(key);
  if (existing) {
    existing.name ||= candidate.name || null;
    existing.position ||= normalizePosition(candidate.position);
    existing.team ||= candidate.team || null;
    return existing;
  }

  const player = {
    key,
    name: candidate.name || key,
    position: normalizePosition(candidate.position),
    team: candidate.team || null,
    points: [],
  };
  players.set(key, player);
  return player;
}

function dedupePointKey(point) {
  return [
    point.date,
    point.source,
    point.sourceKey,
    point.rankingType,
    point.scoring,
    point.season,
    point.value,
    point.overallRank,
    point.positionRank,
  ].join('|');
}

function addPoint(player, point, seen) {
  if (!point.date || !Number.isFinite(point.value)) return false;
  if (!isSupportedPosition(player.position || point.position)) return false;
  if (!isInRedraftSeasonWindow(point)) return false;

  const key = `${player.key}|${dedupePointKey(point)}`;
  if (seen.has(key)) return false;
  seen.add(key);
  player.points.push(point);
  return true;
}

function normalizeFantasyProsPoint(player, point) {
  const sourceMeta = point.sourceMeta || {};
  const rankingType = String(sourceMeta.rankingType || '').toUpperCase();
  if (!redraftRankingTypes.has(rankingType)) return null;

  return {
    date: asDateOnly(point.date),
    season: sourceMeta.season ? String(sourceMeta.season) : null,
    phase: inferPhase(rankingType),
    source: 'FantasyPros',
    sourceKey: point.importedSource || `fantasypros-${rankingType.toLowerCase()}`,
    rankingType,
    scoring: sourceMeta.scoring || null,
    value: asNumber(point.value),
    overallRank: asNumber(point.overallRank),
    positionRank: point.rank || null,
    position: normalizePosition(player.position),
    team: sourceMeta.team || null,
    tier: asNumber(point.tier),
    expertCount: asNumber(sourceMeta.totalExperts),
    averageRank: asNumber(sourceMeta.averageRank),
    bestRank: asNumber(sourceMeta.bestRank),
    worstRank: asNumber(sourceMeta.worstRank),
    stdDev: asNumber(sourceMeta.stdDev),
    sourceMeta: {
      historyMethod: sourceMeta.historyMethod || null,
      rawLastUpdated: sourceMeta.rawLastUpdated || null,
      datePolicy: sourceMeta.datePolicy || null,
    },
  };
}

function loadFantasyProsHistory(players, seen, audit) {
  if (!fs.existsSync(fantasyProsHistoryPath)) return;

  const history = readJson(fantasyProsHistoryPath);
  recordGeneratedAt(audit, history.generatedAt);
  for (const sourcePlayer of history.players || []) {
    const player = addPlayer(players, sourcePlayer);
    if (!player) continue;

    for (const sourcePoint of sourcePlayer.points || []) {
      const point = normalizeFantasyProsPoint(sourcePlayer, sourcePoint);
      if (!point) continue;
      if (addPoint(player, point, seen)) {
        audit.pointCountsBySource.FantasyPros = (audit.pointCountsBySource.FantasyPros || 0) + 1;
        audit.pointCountsByRankingType[point.rankingType] = (audit.pointCountsByRankingType[point.rankingType] || 0) + 1;
        audit.pointCountsByScoring[point.scoring || 'unknown'] = (audit.pointCountsByScoring[point.scoring || 'unknown'] || 0) + 1;
      }
    }
  }
}

function snapshotFiles() {
  if (!fs.existsSync(redraftSnapshotsDir)) return [];
  return fs.readdirSync(redraftSnapshotsDir)
    .filter((file) => /^redraft-source-snapshot-.*\.json$/.test(file))
    .sort()
    .map((file) => path.join(redraftSnapshotsDir, file));
}

function normalizeSnapshotPoint(sourceKey, snapshot, playerKey, row) {
  const source = sourceLabels[sourceKey] || sourceKey;
  const date = asDateOnly(snapshot.generatedAt) || asDateOnly(snapshot.snapshotKey) || null;
  const rank = asNumber(row.rank);
  const value = asNumber(row.value);
  const adp = asNumber(row.adp);
  const projectedPoints = asNumber(row.projectedPoints);

  return {
    date,
    season: row.season ? String(row.season) : snapshot.season ? String(snapshot.season) : null,
    phase: 'currentSeasonSnapshot',
    source,
    sourceKey: `redraft-source-snapshot:${sourceKey}`,
    rankingType: adp == null ? 'CURRENT' : 'ADP',
    scoring: null,
    value,
    overallRank: rank,
    positionRank: row.positionRank || null,
    position: normalizePosition(row.position),
    team: row.team || null,
    tier: null,
    expertCount: null,
    averageRank: adp,
    bestRank: null,
    worstRank: null,
    stdDev: null,
    projectedPoints,
    sourceMeta: {
      snapshotKey: snapshot.snapshotKey || null,
      snapshotSource: sourceKey,
      derivedBlend: sourceKey === 'internalSeasonBlend',
      playerKey,
    },
  };
}

function loadRedraftSnapshots(players, seen, audit) {
  for (const filePath of snapshotFiles()) {
    const snapshot = readJson(filePath);
    recordGeneratedAt(audit, snapshot.generatedAt);
    audit.snapshotFiles.push(path.relative(rootDir, filePath));

    for (const [sourceKey, sourceRows] of Object.entries(snapshot.sources || {})) {
      if (!sourceRows || typeof sourceRows !== 'object') continue;
      for (const [playerKey, row] of Object.entries(sourceRows)) {
        const value = asNumber(row?.value);
        if (!Number.isFinite(value)) continue;

        const player = addPlayer(players, {
          key: playerKey,
          name: row.name,
          position: row.position,
          team: row.team,
        });
        if (!player) continue;

        const point = normalizeSnapshotPoint(sourceKey, snapshot, playerKey, row);
        if (addPoint(player, point, seen)) {
          audit.pointCountsBySource[point.source] = (audit.pointCountsBySource[point.source] || 0) + 1;
          audit.pointCountsByRankingType[point.rankingType] = (audit.pointCountsByRankingType[point.rankingType] || 0) + 1;
        }
      }
    }
  }
}

function comparePointDate(a, b) {
  const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
  if (dateCompare) return dateCompare;
  return String(a.sourceKey || '').localeCompare(String(b.sourceKey || ''));
}

function findBaseline(points, latest, days) {
  const latestDate = new Date(`${latest.date}T00:00:00.000Z`);
  const target = new Date(latestDate.getTime() - days * 24 * 60 * 60 * 1000);
  let best = null;
  for (const point of points) {
    const pointDate = new Date(`${point.date}T00:00:00.000Z`);
    if (Number.isNaN(pointDate.getTime()) || pointDate > target) continue;
    if (!best || pointDate > new Date(`${best.date}T00:00:00.000Z`)) best = point;
  }
  return best;
}

function pointSummary(point) {
  if (!point) return null;
  return {
    date: point.date,
    value: point.value,
    source: point.source,
    rankingType: point.rankingType,
    scoring: point.scoring,
    overallRank: point.overallRank,
    positionRank: point.positionRank,
  };
}

function buildTrendScope(scopeKey, points) {
  const sorted = [...points].sort(comparePointDate);
  const latest = sorted.at(-1);
  const high = sorted.reduce((best, point) => (!best || point.value > best.value ? point : best), null);
  const low = sorted.reduce((best, point) => (!best || point.value < best.value ? point : best), null);

  const [source, rankingType, scoring] = scopeKey.split('|');
  const changes = {};
  for (const days of [30, 90, 180, 365]) {
    const baseline = latest ? findBaseline(sorted, latest, days) : null;
    changes[`${days}d`] = baseline ? {
      fromDate: baseline.date,
      fromValue: baseline.value,
      toDate: latest.date,
      toValue: latest.value,
      delta: latest.value - baseline.value,
    } : null;
  }

  return {
    source,
    rankingType,
    scoring: scoring === 'null' ? null : scoring,
    pointCount: sorted.length,
    first: pointSummary(sorted[0]),
    latest: pointSummary(latest),
    high: pointSummary(high),
    low: pointSummary(low),
    changes,
  };
}

function buildTrends(players) {
  const trendPlayers = [];

  for (const player of players) {
    const points = [...player.points].sort(comparePointDate);
    if (!points.length) continue;

    const latest = points.at(-1);
    const high = points.reduce((best, point) => (!best || point.value > best.value ? point : best), null);
    const low = points.reduce((best, point) => (!best || point.value < best.value ? point : best), null);
    const scopes = new Map();

    for (const point of points) {
      const scopeKey = [point.source, point.rankingType, point.scoring || 'null'].join('|');
      if (!scopes.has(scopeKey)) scopes.set(scopeKey, []);
      scopes.get(scopeKey).push(point);
    }

    trendPlayers.push({
      key: player.key,
      name: player.name,
      position: player.position,
      team: player.team,
      pointCount: points.length,
      latest: pointSummary(latest),
      high: pointSummary(high),
      low: pointSummary(low),
      scopes: [...scopes.entries()]
        .map(([scopeKey, scopePoints]) => buildTrendScope(scopeKey, scopePoints))
        .sort((a, b) => String(a.source).localeCompare(String(b.source)) || String(a.rankingType).localeCompare(String(b.rankingType))),
    });
  }

  return trendPlayers.sort((a, b) => b.pointCount - a.pointCount || a.name.localeCompare(b.name));
}

function countBy(players, selector) {
  const counts = {};
  for (const player of players) {
    for (const point of player.points) {
      const key = selector(point) || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function writePlayerArchive(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const { players, ...header } = data;
  const lines = ['{'];
  const entries = Object.entries(header);
  for (const [key, value] of entries) {
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')},`);
  }
  lines.push('  "players": [');
  for (const [index, player] of players.entries()) {
    lines.push(`    ${JSON.stringify(player)}${index === players.length - 1 ? '' : ','}`);
  }
  lines.push('  ]');
  lines.push('}');
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function recordGeneratedAt(audit, value) {
  if (!value) return;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return;
  audit.inputGeneratedAt.push(date.toISOString());
}

function latestGeneratedAt(audit) {
  return audit.inputGeneratedAt.sort().at(-1) || new Date(0).toISOString();
}

function main() {
  const playersByKey = new Map();
  const seen = new Set();
  const audit = {
    generatedAt: null,
    inputGeneratedAt: [],
    inputs: {
      fantasyProsHistory: path.relative(rootDir, fantasyProsHistoryPath),
      redraftSnapshotsDir: path.relative(rootDir, redraftSnapshotsDir),
    },
    snapshotFiles: [],
    pointCountsBySource: {},
    pointCountsByRankingType: {},
    pointCountsByScoring: {},
  };

  loadFantasyProsHistory(playersByKey, seen, audit);
  loadRedraftSnapshots(playersByKey, seen, audit);
  audit.generatedAt = latestGeneratedAt(audit);

  const players = [...playersByKey.values()]
    .map((player) => ({
      ...player,
      points: player.points.sort(comparePointDate),
    }))
    .filter((player) => player.points.length)
    .sort((a, b) => a.name.localeCompare(b.name));

  const pointCount = players.reduce((sum, player) => sum + player.points.length, 0);
  const trends = buildTrends(players);

  const archive = {
    schemaVersion: 1,
    generatedAt: audit.generatedAt,
    source: 'redraft-value-history-v1',
    playerCount: players.length,
    pointCount,
    policy: {
      purpose: 'Compact redraft draft-cost, rank, rest-of-season, and current-source value history for Draft Coach/player graphs.',
      liveLoadBoundary: 'Generated by maintenance script from stored archives and snapshots; user report loads should read this artifact instead of calling providers.',
      excludedRankingTypes: ['DYNASTY', 'DYNADP', 'DEVY', 'ROOKIES', 'RKADP'],
      seasonWindow: 'Keeps season-year rows from April 25 through January 10 of the following year, avoiding NFL playoff-period values and resetting by season.',
      sourcePayloadPolicy: 'Normalized player/date/source/rank/value rows only; raw provider payloads and API keys are not stored here.',
    },
    players,
  };

  const trendsArchive = {
    schemaVersion: 1,
    generatedAt: audit.generatedAt,
    source: 'redraft-value-trends-v1',
    playerCount: trends.length,
    pointCount,
    policy: {
      purpose: 'Precomputed latest/high/low/change windows so player modals and draft tools do not parse the full redraft archive at runtime.',
      windows: ['30d', '90d', '180d', '365d'],
    },
    players: trends,
  };

  const auditOutput = {
    ...audit,
    outputs: {
      archive: path.relative(rootDir, archivePath),
      trends: path.relative(rootDir, trendsPath),
      manifest: path.relative(rootDir, manifestPath),
    },
    playerCount: players.length,
    pointCount,
    trendPlayerCount: trends.length,
    pointCountsBySource: countBy(players, (point) => point.source),
    pointCountsByRankingType: countBy(players, (point) => point.rankingType),
    pointCountsByScoring: countBy(players, (point) => point.scoring),
    pointCountsByPhase: countBy(players, (point) => point.phase),
    dateRange: {
      first: players.flatMap((player) => player.points.map((point) => point.date)).sort()[0] || null,
      latest: players.flatMap((player) => player.points.map((point) => point.date)).sort().at(-1) || null,
    },
  };

  const manifest = {
    schemaVersion: 1,
    generatedAt: audit.generatedAt,
    source: 'redraft-value-history-manifest-v1',
    files: auditOutput.outputs,
    playerCount: players.length,
    pointCount,
    dateRange: auditOutput.dateRange,
    pointCountsBySource: auditOutput.pointCountsBySource,
    pointCountsByRankingType: auditOutput.pointCountsByRankingType,
    pointCountsByPhase: auditOutput.pointCountsByPhase,
    loadPolicy: {
      defaultRuntimeInput: 'Read this manifest or a future player-specific shard first; do not eagerly import the full archive or trends file into client bundles.',
      fullArchiveUse: 'Maintenance jobs, audits, recalibration, and backend-only graph hydration.',
      trendsUse: 'Backend-only or lazy per-player UI hydration until player-specific shards are added.',
    },
  };

  writePlayerArchive(archivePath, archive);
  writePlayerArchive(trendsPath, trendsArchive);
  writeJson(manifestPath, manifest);
  writeJson(auditPath, auditOutput);

  console.log(JSON.stringify({
    archive: path.relative(rootDir, archivePath),
    trends: path.relative(rootDir, trendsPath),
    manifest: path.relative(rootDir, manifestPath),
    audit: path.relative(rootDir, auditPath),
    playerCount: players.length,
    pointCount,
    dateRange: auditOutput.dateRange,
    pointCountsBySource: auditOutput.pointCountsBySource,
    pointCountsByRankingType: auditOutput.pointCountsByRankingType,
  }, null, 2));
}

main();
