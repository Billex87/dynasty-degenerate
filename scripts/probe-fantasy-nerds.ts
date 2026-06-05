#!/usr/bin/env tsx

import '../server/_core/env';
import {
  FANTASY_NERDS_PACKAGE_PROBES,
  resolveFantasyNerdsProbeCredential,
  runFantasyNerdsPackageProbe,
  summarizeFantasyNerdsPackageProbeResults,
} from '../server/fantasyNerdsProbe';

function clampMs(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(30000, parsed));
}

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

const expectedSeason = String(process.env.FANTASY_NERDS_PROBE_SEASON || new Date().getFullYear());
const timeoutMs = Math.max(1000, clampMs(process.env.FANTASY_NERDS_PROBE_TIMEOUT_MS, 12000));
const requestDelayMs = clampMs(process.env.FANTASY_NERDS_PROBE_DELAY_MS, 350);
const requireCurrentSeasonRows =
  process.argv.includes('--require-current-season-rows') ||
  process.env.REQUIRE_FANTASY_NERDS_CURRENT_SEASON_ROWS === 'true';

const results = [];
for (const probe of FANTASY_NERDS_PACKAGE_PROBES) {
  results.push(await runFantasyNerdsPackageProbe(probe, { expectedSeason, timeoutMs }));
  await delay(requestDelayMs);
}

const credential = resolveFantasyNerdsProbeCredential();
const summary = summarizeFantasyNerdsPackageProbeResults(results, { expectedSeason });

console.log('# Fantasy Nerds Package Source Probe');
console.log('Normal report-load provider calls allowed: none. This command is metadata-only for cron/admin/source approval work.');
console.log(`Expected season for production row proof: ${expectedSeason}`);
console.log(`Request delay: ${requestDelayMs}ms`);

console.log('\nEndpoint results:');
console.table(results.map((result) => ({
  id: result.id,
  category: result.category,
  status: result.status,
  http: result.httpStatus ?? '-',
  rows: result.rows ?? '-',
  shape: result.shape ?? '-',
  season: result.sourceSeason ?? '-',
  freshness: result.freshnessTimestamp ?? '-',
  currentNonTestRows: result.currentSeasonNonTestRows,
  ms: result.durationMs,
})));

console.log('\nCredential state:');
console.table(credential.envNames.map((env) => ({
  env,
  configured: Boolean(process.env[env]),
  testKey: /^TEST$/i.test(process.env[env] || ''),
})));

console.log('\nGate summary:');
console.table([{
  expectedSeason: summary.expectedSeason,
  gateStatus: summary.gateStatus,
  loadedEndpoints: summary.loadedEndpoints,
  currentSeasonNonTestRowsConfirmed: summary.currentSeasonNonTestRowsConfirmed,
  credentialConfigured: summary.credentialConfigured,
  usesTestKey: summary.usesTestKey,
}]);

console.log('\nNotes:');
for (const result of results) {
  console.log(`- ${result.id}: ${result.note}`);
}

if (summary.blockedReasons.length) {
  console.log('\nBlocked reasons:');
  for (const reason of summary.blockedReasons) console.log(`- ${reason}`);
}

if (requireCurrentSeasonRows && !summary.currentSeasonNonTestRowsConfirmed) {
  process.exitCode = 1;
}
