#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const cacheDir = process.env.REPORT_HOTSPOT_AUDIT_DIR || path.join(process.cwd(), '.cache', 'league-reports');
const limit = Number.parseInt(process.env.REPORT_HOTSPOT_AUDIT_LIMIT || '10', 10) || 10;
const topNestedLimit = Number.parseInt(process.env.REPORT_HOTSPOT_NESTED_LIMIT || '6', 10) || 6;
const timingLogPath = process.env.REPORT_HOTSPOT_TIMING_LOG || '';
const payloadKindFilter = (process.env.REPORT_HOTSPOT_KIND || 'report').trim().toLowerCase();
const ENCODING = 'gzip-base64';

const SECTION_CLASSIFICATION = {
  sourceSnapshotDiagnostics: ['static', 'Snapshot metadata diagnostics; cache by source row-count/freshness signature.'],
  prospectSourceDiagnostics: ['static', 'Prospect snapshot diagnostics; cache with prospect snapshot signature.'],
  currentPositionRankById: ['static-enrichment', 'Value/rank map; candidate for player-set signature cache.'],
  playerDetailsById: ['mixed-enrichment', 'Large player enrichment map; split static player facts from roster/status/live usage.'],
  rankings: ['static', 'Ranking board; already split behind metadata/detail endpoints.'],
  schedulePlanning: ['mixed', 'Uses cached schedule profiles plus live roster gaps.'],
  matchupPreviews: ['live', 'Current-week Sleeper matchup dependent.'],
  currentStandings: ['live', 'Current Sleeper roster/settings dependent.'],
  leagueOverview: ['live', 'Current roster composition dependent.'],
  managerRosterValueGrowth: ['live', 'Current and previous roster composition dependent.'],
  managerPositionCounts: ['live', 'Current roster and starter slots dependent.'],
  managerRosterIntelligence: ['mixed', 'Heavy mixed section: current roster shape plus static values/details.'],
  waiverIntelligence: ['live', 'Trending/current availability dependent.'],
  recentTransactions: ['live', 'Sleeper transaction dependent.'],
  tradeHistory: ['live', 'Sleeper transaction/draft-pick dependent.'],
  tradeProfitLeaderboard: ['live', 'Derived from Sleeper transaction history.'],
  tradeTendencies: ['live', 'Derived from Sleeper transaction history.'],
  tradeProposalSignals: ['live', 'Sleeper transaction proposal dependent.'],
  adminTradeProposalSignals: ['live', 'Sleeper transaction proposal dependent.'],
  draftPicks: ['live', 'Sleeper draft dependent.'],
  draftStats: ['live', 'Sleeper draft dependent.'],
  pickPortfolios: ['live', 'Sleeper traded-pick/draft dependent.'],
  powerRankings: ['mixed', 'Current roster plus values/draft/trade inputs.'],
  dynastyTimelines: ['mixed', 'Current roster plus value/age curves.'],
  weeklyRisers: ['mixed', 'Current roster ownership plus static weekly value delta.'],
  weeklyFallers: ['mixed', 'Current roster ownership plus static weekly value delta.'],
  projectedRisers: ['mixed', 'Current roster ownership plus static value projection.'],
  projectedFallers: ['mixed', 'Current roster ownership plus static value projection.'],
  trendingAdds: ['live', 'Sleeper trending endpoint dependent.'],
  trendingDrops: ['live', 'Sleeper trending endpoint dependent.'],
  managerAvatars: ['live', 'Sleeper users dependent.'],
  managerChampionships: ['live', 'Sleeper standings/history dependent.'],
  monthlyBlueprintHistory: ['stored-live', 'Stored league snapshot history.'],
  monthlyBlueprintSnapshot: ['stored-live', 'Stored current report snapshot metadata.'],
  leagueDiagnostics: ['mixed', 'League settings plus value source context.'],
  depthChartDiagnostics: ['static-enrichment', 'Snapshot-backed ESPN depth-chart diagnostics.'],
  transactionBackfillDiagnostics: ['live', 'Historical Sleeper transaction backfill dependent.'],
};

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

function formatMs(value) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms)) return '0ms';
  return `${Math.round(ms).toLocaleString('en-US')}ms`;
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

function getItemCount(value) {
  if (Array.isArray(value)) return value.length;
  if (isRecord(value)) return Object.keys(value).length;
  return null;
}

function classifySection(key) {
  const [kind, note] = SECTION_CLASSIFICATION[key] || ['unknown', 'Not classified yet; inspect before caching.'];
  return { kind, note };
}

function childFieldHotspots(sectionKey, value, max = topNestedLimit) {
  const rows = Array.isArray(value)
    ? value.filter(isRecord)
    : isRecord(value)
      ? Object.values(value).filter(isRecord)
      : [];
  if (!rows.length) return [];

  const totals = new Map();
  for (const row of rows) {
    for (const [key, child] of Object.entries(row)) {
      totals.set(key, (totals.get(key) || 0) + jsonSize(child));
    }
  }

  return Array.from(totals.entries())
    .map(([key, bytes]) => ({
      path: Array.isArray(value) ? `${sectionKey}[].${key}` : `${sectionKey}.*.${key}`,
      bytes,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, max);
}

function getTopSections(root, totalSize, max = 12) {
  if (!isRecord(root)) return [];
  return Object.entries(root)
    .map(([key, value]) => {
      const bytes = jsonSize(value);
      const itemCount = getItemCount(value);
      const classification = classifySection(key);
      return {
        key,
        bytes,
        pct: totalSize > 0 ? (bytes / totalSize) * 100 : 0,
        itemCount,
        avgItemBytes: itemCount && itemCount > 0 ? Math.round(bytes / itemCount) : null,
        ...classification,
        childHotspots: childFieldHotspots(key, value),
      };
    })
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, max);
}

function aggregateSections(rows) {
  const totals = new Map();
  for (const row of rows) {
    for (const section of row.topSections || []) {
      const current = totals.get(section.key) || {
        key: section.key,
        bytes: 0,
        count: 0,
        maxBytes: 0,
        kind: section.kind,
        note: section.note,
      };
      current.bytes += section.bytes;
      current.count += 1;
      current.maxBytes = Math.max(current.maxBytes, section.bytes);
      totals.set(section.key, current);
    }
  }

  return Array.from(totals.values())
    .map((section) => ({
      ...section,
      avgBytes: Math.round(section.bytes / Math.max(1, section.count)),
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

function getRecommendations(sections) {
  const candidates = sections.filter((section) => ['static', 'static-enrichment', 'mixed-enrichment', 'mixed'].includes(section.kind));
  return candidates.slice(0, 5).map((section) => {
    if (section.key === 'playerDetailsById') {
      return `${section.key}: split static player facts/prospect/value fields from live roster status, availability, news, and usage (${formatBytes(section.avgBytes)} avg).`;
    }
    if (section.key === 'managerRosterIntelligence') {
      return `${section.key}: measure inner player arrays next; likely reuse static player enrichment while rebuilding manager recommendations live (${formatBytes(section.avgBytes)} avg).`;
    }
    if (section.kind === 'static' || section.kind === 'static-enrichment') {
      return `${section.key}: safe cache candidate if keyed by source/player-set signature (${formatBytes(section.avgBytes)} avg).`;
    }
    return `${section.key}: mixed section; keep Sleeper-owned rows live and cache only nested static joins (${formatBytes(section.avgBytes)} avg).`;
  });
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

function percentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

function parseTimingLine(line) {
  const match = line.match(/\[league\.analyze ([^\]]+)\] (.+): \+(\d+)ms total=(\d+)ms/);
  if (!match) return null;
  return {
    league: match[1],
    step: match[2],
    deltaMs: Number(match[3]),
    totalMs: Number(match[4]),
  };
}

async function readTimingRows() {
  if (!timingLogPath) return [];
  const text = await fs.readFile(timingLogPath, 'utf8');
  return text
    .split(/\r?\n/)
    .map(parseTimingLine)
    .filter(Boolean);
}

function printTimingSummary(rows) {
  console.log('\n## Analyze Timing Hotspots');
  if (!timingLogPath) {
    console.log('No timing log supplied. To collect rough build timings, run the app with `LOG_LEAGUE_ANALYZE_TIMING=true`, save the server output, then rerun with `REPORT_HOTSPOT_TIMING_LOG=/path/to/log`.');
    return;
  }
  console.log(`Timing log: ${timingLogPath}`);
  console.log(`Timing rows parsed: ${rows.length}`);
  if (!rows.length) return;

  const byStep = new Map();
  for (const row of rows) {
    const values = byStep.get(row.step) || [];
    values.push(row.deltaMs);
    byStep.set(row.step, values);
  }

  Array.from(byStep.entries())
    .map(([step, values]) => ({
      step,
      count: values.length,
      avg: values.reduce((sum, value) => sum + value, 0) / values.length,
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      max: Math.max(...values),
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 15)
    .forEach((row, index) => {
      console.log(`${String(index + 1).padStart(2, ' ')}. ${row.step}: avg=${formatMs(row.avg)}, p50=${formatMs(row.p50)}, p95=${formatMs(row.p95)}, max=${formatMs(row.max)}, count=${row.count}`);
    });
}

async function main() {
  const files = await readCacheFiles();
  const boundedLimit = Math.max(1, Math.min(200, Math.floor(limit)));

  console.log('# Report Hotspot Audit');
  console.log(`Cache dir: ${cacheDir}`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Limit: ${boundedLimit}`);
  console.log(`Kind filter: ${payloadKindFilter}`);
  console.log('Payload values are never printed; this report only shows section names, sizes, counts, percentages, and timing aggregates.');

  const rows = [];
  for (const file of files) {
    let text;
    try {
      text = await fs.readFile(file.filePath, 'utf8');
    } catch (error) {
      rows.push({ ...file, error: error instanceof Error ? error.message : String(error) });
      continue;
    }

    try {
      const parsed = parseStoredPayload(text);
      const kind = classifyPayload(parsed.payload);
      if (payloadKindFilter !== 'all' && kind !== payloadKindFilter) continue;
      const root = sectionRoot(parsed.payload);
      const payloadSize = jsonSize(parsed.payload);
      const rootSize = jsonSize(root);
      rows.push({
        ...file,
        kind,
        storageEncoding: parsed.storageEncoding,
        payloadSize,
        rootSize,
        topSections: getTopSections(root, rootSize),
      });
    } catch (error) {
      rows.push({ ...file, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (!rows.length) {
    console.log(`\nNo local cache files matched kind '${payloadKindFilter}'. Set REPORT_HOTSPOT_KIND=all to include reports and rankings.`);
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

    console.log(`   kind: ${row.kind}`);
    console.log(`   updatedAt: ${row.updatedAt.toISOString()}`);
    console.log(`   storage: ${row.storageEncoding}, fileSize: ${formatBytes(row.fileBytes)}, responsePayloadSize: ${formatBytes(row.payloadSize)}, auditedRootSize: ${formatBytes(row.rootSize)}`);
    for (const section of row.topSections) {
      const count = section.itemCount === null ? '' : `, count=${section.itemCount.toLocaleString('en-US')}`;
      const avg = section.avgItemBytes === null ? '' : `, avgItem=${formatBytes(section.avgItemBytes)}`;
      console.log(`   - ${section.key}: ${formatBytes(section.bytes)} (${section.pct.toFixed(1)}%) [${section.kind}${count}${avg}]`);
      if (section.childHotspots.length) {
        console.log(`     childHotspots: ${section.childHotspots.map((child) => `${child.path}=${formatBytes(child.bytes)}`).join(', ')}`);
      }
    }
    });

  const aggregate = aggregateSections(rows.filter((row) => !row.error).slice(0, boundedLimit));
  console.log('\n## Aggregate Section Hotspots');
  aggregate.slice(0, 15).forEach((section, index) => {
    console.log(`${String(index + 1).padStart(2, ' ')}. ${section.key}: total=${formatBytes(section.bytes)}, avg=${formatBytes(section.avgBytes)}, max=${formatBytes(section.maxBytes)}, files=${section.count}, kind=${section.kind}`);
  });

  const recommendations = getRecommendations(aggregate);
  console.log('\n## Next Cache Candidates');
  if (!recommendations.length) {
    console.log('No cache candidates found from the scanned payloads.');
  } else {
    recommendations.forEach((recommendation, index) => {
      console.log(`${String(index + 1).padStart(2, ' ')}. ${recommendation}`);
    });
  }

  printTimingSummary(await readTimingRows());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
