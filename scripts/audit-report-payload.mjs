#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const cacheDir = process.env.REPORT_PAYLOAD_AUDIT_DIR || path.join(process.cwd(), '.cache', 'league-reports');
const limit = Number.parseInt(process.env.REPORT_PAYLOAD_AUDIT_LIMIT || '20', 10) || 20;
const ENCODING = 'gzip-base64';

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function jsonSize(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function compactPlayerDetails(details) {
  return Object.fromEntries(
    [
      'fullName',
      'team',
      'position',
      'age',
      'rookieYear',
      'rosterStatus',
      'status',
      'displayStatus',
      'injuryStatus',
      'sleeperDepthChartPosition',
      'sleeperDepthChartOrder',
      'depthChartPosition',
      'depthChartOrder',
      'depthChartVerified',
      'depthChartMismatch',
    ]
      .filter((key) => details[key] !== undefined)
      .map((key) => [key, details[key]])
  );
}

function createSlimmingStats() {
  return {
    compactedEmbeddedPlayerDetails: 0,
    compactedEmbeddedPlayerDetailsBytes: 0,
    compactedRankingProspectProfiles: 0,
    compactedRankingProspectProfileBytes: 0,
    removedRankingLegacyArrays: 0,
    removedRankingLegacyArrayBytes: 0,
  };
}

function hasSlimmingChanges(stats) {
  return stats.compactedEmbeddedPlayerDetails > 0
    || stats.compactedRankingProspectProfiles > 0
    || stats.removedRankingLegacyArrays > 0;
}

function compactRankingProspectProfile(profile) {
  return Object.fromEntries(
    Object.entries(profile)
      .filter(([key, value]) => value !== undefined && !['summary', 'sourceUrl', 'scrapeMonth'].includes(key))
  );
}

function slimRankingRow(row, stats) {
  if (!isRecord(row) || !isRecord(row.prospectProfile)) return row;

  const compacted = compactRankingProspectProfile(row.prospectProfile);
  const originalBytes = jsonSize(row.prospectProfile);
  const compactedBytes = jsonSize(compacted);
  if (compactedBytes >= originalBytes) return row;

  stats.compactedRankingProspectProfiles += 1;
  stats.compactedRankingProspectProfileBytes += originalBytes - compactedBytes;
  return {
    ...row,
    prospectProfile: compacted,
  };
}

function slimRankingsBoard(rankings, stats) {
  if (!isRecord(rankings)) return rankings;

  let changed = false;
  const next = { ...rankings };
  const legacyArrayKeys = [
    'dynastySf',
    'dynastyOneQb',
    'devySf',
    'devyOneQb',
    'redraftPpr',
    'redraftHalfPpr',
    'redraftStandard',
  ];

  for (const key of legacyArrayKeys) {
    if (Array.isArray(next[key]) && next[key].length > 0) {
      stats.removedRankingLegacyArrays += 1;
      stats.removedRankingLegacyArrayBytes += jsonSize(next[key]);
      next[key] = [];
      changed = true;
    }
  }

  if (isRecord(rankings.profiles)) {
    const profiles = {};
    let profilesChanged = false;

    for (const [key, rows] of Object.entries(rankings.profiles)) {
      if (!Array.isArray(rows)) {
        profiles[key] = rows;
        continue;
      }

      let rowsChanged = false;
      const slimmedRows = rows.map((row) => {
        const slimmed = slimRankingRow(row, stats);
        if (slimmed !== row) rowsChanged = true;
        return slimmed;
      });
      profiles[key] = rowsChanged ? slimmedRows : rows;
      if (rowsChanged) profilesChanged = true;
    }

    if (profilesChanged) {
      next.profiles = profiles;
      changed = true;
    }
  }

  return changed ? next : rankings;
}

function parseStoredPayload(text) {
  const parsed = JSON.parse(text);
  if (parsed?.__ddCacheEncoding === ENCODING && typeof parsed.payload === 'string') {
    return {
      storageEncoding: ENCODING,
      payload: JSON.parse(gunzipSync(Buffer.from(parsed.payload, 'base64')).toString('utf8')),
    };
  }
  return { storageEncoding: 'plain-json', payload: parsed };
}

function slimValue(value, detailIds, stats, insideDetailMap = false) {
  if (!value || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const slimmed = slimValue(item, detailIds, stats, insideDetailMap);
      if (slimmed !== item) changed = true;
      return slimmed;
    });
    return changed ? next : value;
  }

  const playerId = value.player_id === null || value.player_id === undefined ? null : String(value.player_id);
  const canDropEmbeddedDetails = !insideDetailMap && playerId && detailIds.has(playerId) && isRecord(value.playerDetails);
  let changed = false;
  const next = {};

  for (const [key, child] of Object.entries(value)) {
    if (key === 'playerDetails' && canDropEmbeddedDetails) {
      const compacted = compactPlayerDetails(child);
      const originalBytes = jsonSize(child);
      const compactedBytes = jsonSize(compacted);
      if (compactedBytes < originalBytes) {
        next[key] = compacted;
        stats.compactedEmbeddedPlayerDetails += 1;
        stats.compactedEmbeddedPlayerDetailsBytes += originalBytes - compactedBytes;
        changed = true;
        continue;
      }
      next[key] = child;
      continue;
    }

    const slimmed = slimValue(child, detailIds, stats, insideDetailMap || key === 'playerDetailsById');
    next[key] = slimmed;
    if (slimmed !== child) changed = true;
  }

  return changed ? next : value;
}

function slimCachedPayload(payload) {
  const stats = createSlimmingStats();

  if (!isRecord(payload) || !isRecord(payload.reportData)) {
    if (isRecord(payload?.rankings)) {
      const rankings = slimRankingsBoard(payload.rankings, stats);
      return hasSlimmingChanges(stats)
        ? { payload: { ...payload, rankings }, stats }
        : { payload, stats };
    }
    return { payload, stats };
  }

  const detailIds = new Set(Object.keys(payload.reportData.playerDetailsById || {}));
  const slimmedDetails = detailIds.size ? slimValue(payload.reportData, detailIds, stats) : payload.reportData;
  const slimmedRankings = isRecord(slimmedDetails?.rankings) ? slimRankingsBoard(slimmedDetails.rankings, stats) : null;
  const reportData = slimmedRankings && slimmedRankings !== slimmedDetails.rankings
    ? { ...slimmedDetails, rankings: slimmedRankings }
    : slimmedDetails;
  if (!hasSlimmingChanges(stats)) return { payload, stats };
  return {
    payload: {
      ...payload,
      reportData,
    },
    stats,
  };
}

function getTopSections(value, max = 8) {
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .map(([key, child]) => ({ key, bytes: jsonSize(child) }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, max);
}

function classifyPayload(payload) {
  if (isRecord(payload?.reportData)) return 'report';
  if (isRecord(payload?.rankings)) return 'rankings';
  return 'unknown';
}

function sectionRoot(payload) {
  if (isRecord(payload?.reportData)) return payload.reportData;
  if (isRecord(payload?.rankings)) return payload.rankings;
  return payload;
}

async function readCacheFiles() {
  let entries;
  try {
    entries = await fs.readdir(cacheDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(cacheDir, entry.name);
    const stat = await fs.stat(filePath);
    files.push({ filePath, name: entry.name, fileBytes: stat.size, updatedAt: stat.mtime });
  }
  return files.sort((a, b) => b.fileBytes - a.fileBytes);
}

async function main() {
  const files = await readCacheFiles();
  const boundedLimit = Math.max(1, Math.min(200, Math.floor(limit)));

  console.log('# Report Payload Audit');
  console.log(`Cache dir: ${cacheDir}`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Limit: ${boundedLimit}`);
  console.log('Payload values are never printed; this report only shows metadata, sizes, and section names.');

  if (!files.length) {
    console.log('\nNo local league report cache files found.');
    return;
  }

  const rows = [];
  for (const file of files) {
    let text;
    try {
      text = await fs.readFile(file.filePath, 'utf8');
    } catch (error) {
      rows.push({ file, error: error instanceof Error ? error.message : String(error) });
      continue;
    }

    try {
      const parsed = parseStoredPayload(text);
      const payloadSize = jsonSize(parsed.payload);
      const slimmed = slimCachedPayload(parsed.payload);
      const slimmedSize = jsonSize(slimmed.payload);
      rows.push({
        ...file,
        kind: classifyPayload(parsed.payload),
        storageEncoding: parsed.storageEncoding,
        payloadSize,
        slimmedSize,
        stats: slimmed.stats,
        topSections: getTopSections(sectionRoot(parsed.payload)),
      });
    } catch (error) {
      rows.push({ ...file, error: error instanceof Error ? error.message : String(error) });
    }
  }

  rows
    .sort((a, b) => (b.payloadSize || b.fileBytes || 0) - (a.payloadSize || a.fileBytes || 0))
    .slice(0, boundedLimit)
    .forEach((row, index) => {
      console.log(`\n${String(index + 1).padStart(2, ' ')}. ${row.name}`);
      if (row.error) {
        console.log(`   error: ${row.error}`);
        return;
      }

      const savings = Math.max(0, row.payloadSize - row.slimmedSize);
      const stats = row.stats || createSlimmingStats();
      console.log(`   kind: ${row.kind}`);
      console.log(`   updatedAt: ${row.updatedAt.toISOString()}`);
      console.log(`   storage: ${row.storageEncoding}, fileSize: ${formatBytes(row.fileBytes)}, responsePayloadSize: ${formatBytes(row.payloadSize)}`);
      console.log(`   estimatedSlimmedResponse: ${formatBytes(row.slimmedSize)}, estimatedSavings: ${formatBytes(savings)}`);
      console.log(`   compactedEmbeddedPlayerDetails: ${stats.compactedEmbeddedPlayerDetails} (${formatBytes(stats.compactedEmbeddedPlayerDetailsBytes)} saved)`);
      console.log(`   compactedRankingProspectProfiles: ${stats.compactedRankingProspectProfiles} (${formatBytes(stats.compactedRankingProspectProfileBytes)} saved)`);
      console.log(`   removedRankingLegacyArrays: ${stats.removedRankingLegacyArrays} (${formatBytes(stats.removedRankingLegacyArrayBytes)} saved)`);
      console.log(`   topSections: ${row.topSections.map((section) => `${section.key}=${formatBytes(section.bytes)}`).join(', ') || 'none'}`);
    });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
