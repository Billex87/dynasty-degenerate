import fs from 'node:fs';
import path from 'node:path';
import { readArchiveHeader, streamArchivePlayers, writeArchive } from './value-history-archive-io.mjs';
import { getCanonicalPlayerKey, getIdentityPositionGroup, hasNameSuffix } from './value-history-player-identity.mjs';

const rootDir = process.cwd();
const archivePath = process.env.ARCHIVE_FILE
  ? path.resolve(rootDir, process.env.ARCHIVE_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'one-time-source-history.json');
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'one-time-source-history-normalized.json');
const onlyCoreDynastyAssets = process.env.ONLY_CORE_DYNASTY_ASSETS === '1';

const CORE_DYNASTY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'PICK', 'RDP']);

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Normalize player identities inside a raw value-history archive.',
    '',
    'Environment:',
    '  ARCHIVE_FILE=server/value-history-archive/one-time-source-history.json',
    '  OUT_FILE=server/value-history-archive/one-time-source-history-normalized.json',
    '  ONLY_CORE_DYNASTY_ASSETS=0',
    '',
    'Behavior:',
    '  - Merges high-confidence name variants such as Jr./Sr./III suffix rows.',
    '  - Applies a small explicit alias map for known provider variants such as Ken/Kenneth Walker.',
    '  - Keeps kicker, defense, IDP, and other ranked assets by default for league formats that use them.',
    '  - Set ONLY_CORE_DYNASTY_ASSETS=1 to emit a QB/RB/WR/TE/pick-only file for focused audits.',
  ].join('\n'));
  process.exit(0);
}

function pointKey(point) {
  return [
    point.date || '',
    point.format || '',
    point.importedSource || '',
    (point.sources || []).join('+'),
  ].join('|');
}

function mergePointLists(basePoints = [], importedPoints = []) {
  const byKey = new Map();
  for (const point of basePoints) byKey.set(pointKey(point), point);
  for (const point of importedPoints) {
    const key = pointKey(point);
    const existing = byKey.get(key);
    byKey.set(key, existing ? {
      ...existing,
      ...point,
      value: point.value || existing.value,
      rank: point.rank || existing.rank,
      overallRank: point.overallRank || existing.overallRank,
      sources: Array.from(new Set([...(existing.sources || []), ...(point.sources || [])])).sort(),
      market: { ...(existing.market || {}), ...(point.market || {}) },
      expert: { ...(existing.expert || {}), ...(point.expert || {}) },
      sourceMeta: { ...(existing.sourceMeta || {}), ...(point.sourceMeta || {}) },
    } : point);
  }
  return Array.from(byKey.values())
    .filter((point) => point.date && point.value)
    .sort((a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      String(a.format || '').localeCompare(String(b.format || '')) ||
      String(a.importedSource || '').localeCompare(String(b.importedSource || ''))
    );
}

function getSources(player) {
  const sources = new Set();
  for (const point of player.points || []) {
    for (const source of point.sources || []) sources.add(source);
  }
  return sources;
}

function chooseDisplayPlayer(players) {
  return [...players].sort((a, b) => {
    const aSources = getSources(a).size;
    const bSources = getSources(b).size;
    if (aSources !== bSources) return bSources - aSources;
    const aSuffix = hasNameSuffix(a.name) ? 1 : 0;
    const bSuffix = hasNameSuffix(b.name) ? 1 : 0;
    if (aSuffix !== bSuffix) return bSuffix - aSuffix;
    return (b.points?.length || 0) - (a.points?.length || 0);
  })[0];
}

function getMergeGroup(player, inferredPositionsByKey) {
  const position = getIdentityPositionGroup(player.position);
  const canonicalKey = getCanonicalPlayerKey(player.name || player.key);
  if (!canonicalKey) return null;
  const positionGroup = position || inferredPositionsByKey.get(canonicalKey) || 'unknown';
  if (onlyCoreDynastyAssets && !CORE_DYNASTY_POSITIONS.has(positionGroup)) {
    return null;
  }
  return `${positionGroup}|${canonicalKey}`;
}

async function main() {
  if (!fs.existsSync(archivePath)) throw new Error(`Archive not found: ${archivePath}`);
  const archive = await readArchiveHeader(archivePath);
  const allPlayers = [];
  const positionCandidatesByKey = new Map();
  const groups = new Map();
  const droppedByPosition = {};
  let inputPlayerCount = 0;
  let inputPointCount = 0;

  for await (const player of streamArchivePlayers(archivePath)) {
    allPlayers.push(player);
    inputPlayerCount += 1;
    inputPointCount += (player.points || []).length;
    const canonicalKey = getCanonicalPlayerKey(player.name || player.key);
    const position = getIdentityPositionGroup(player.position);
    if (canonicalKey && position) {
      const candidates = positionCandidatesByKey.get(canonicalKey) || new Set();
      candidates.add(position);
      positionCandidatesByKey.set(canonicalKey, candidates);
    }
  }

  const inferredPositionsByKey = new Map();
  for (const [canonicalKey, positions] of positionCandidatesByKey.entries()) {
    if (positions.size === 1) {
      inferredPositionsByKey.set(canonicalKey, [...positions][0]);
    }
  }

  for (const player of allPlayers) {
    const groupKey = getMergeGroup(player, inferredPositionsByKey);
    if (!groupKey) {
      const position = getIdentityPositionGroup(player.position) || 'unknown';
      droppedByPosition[position] = (droppedByPosition[position] || 0) + 1;
      continue;
    }
    const group = groups.get(groupKey) || [];
    group.push(player);
    groups.set(groupKey, group);
  }

  const mergedGroups = [];
  const normalizedPlayers = [];
  for (const [groupKey, players] of groups.entries()) {
    const display = chooseDisplayPlayer(players);
    const position = getIdentityPositionGroup(display.position) || groupKey.split('|')[0] || null;
    const points = players.reduce((merged, player) => mergePointLists(merged, player.points || []), []);
    const sourceIds = players.reduce((ids, player) => ({ ...ids, ...(player.sourceIds || {}) }), {});
    const canonicalKey = groupKey.split('|').slice(1).join('|');
    const names = Array.from(new Set(players.map((player) => player.name).filter(Boolean))).sort();

    if (players.length > 1) {
      mergedGroups.push({
        canonicalKey,
        position,
        outputName: display.name,
        inputNames: names,
        inputKeys: players.map((player) => player.key).filter(Boolean).sort(),
        inputPlayerCount: players.length,
        outputPointCount: points.length,
      });
    }

    normalizedPlayers.push({
      key: canonicalKey,
      name: display.name || players[0]?.name || canonicalKey,
      position,
      sourceIds,
      points,
    });
  }

  normalizedPlayers.sort((a, b) => a.name.localeCompare(b.name));
  const outputPointCount = normalizedPlayers.reduce((sum, player) => sum + player.points.length, 0);
  const header = {
    ...archive,
    generatedAt: new Date().toISOString(),
    source: 'identity-normalized-value-history-archive',
    inputArchive: path.relative(rootDir, archivePath),
    playerCount: normalizedPlayers.length,
    pointCount: outputPointCount,
    identityNormalization: {
      inputPlayerCount,
      inputPointCount,
      outputPlayerCount: normalizedPlayers.length,
      outputPointCount,
      mergedGroupCount: mergedGroups.length,
      droppedByPosition,
      coreDynastyPositions: Array.from(CORE_DYNASTY_POSITIONS).sort(),
      onlyCoreDynastyAssets,
      mergedGroups: mergedGroups.slice(0, 200),
      note: 'High-confidence normalization only: suffix/name aliases plus same position group. Kicker, defense, IDP, and other ranked rows are retained by default for league formats that use them.',
    },
  };

  await writeArchive(outputPath, header, normalizedPlayers);
  console.log(`Normalized ${inputPlayerCount} players/${inputPointCount} points to ${normalizedPlayers.length} players/${outputPointCount} points.`);
  console.log(`Merged ${mergedGroups.length} identity groups. Dropped positions: ${JSON.stringify(droppedByPosition)}`);
  console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
