#!/usr/bin/env tsx

import '../server/_core/env';
import {
  FOOTBALL_DATA_PROVIDER_PROBES,
  runFootballDataProviderProbe,
} from '../server/footballDataProviderProbe';

const timeoutMs = Math.max(1000, Math.min(30000, Number.parseInt(process.env.FOOTBALL_DATA_SOURCE_PROBE_TIMEOUT_MS || '12000', 10) || 12000));

const results = [];
for (const probe of FOOTBALL_DATA_PROVIDER_PROBES) {
  results.push(await runFootballDataProviderProbe(probe, { timeoutMs }));
}

console.log('# Football Data Provider Source Probe');
console.log('Normal report-load provider calls allowed: none. These probes are metadata-only and for cron/admin/source approval work.');
console.table(results.map((result) => ({
  id: result.id,
  provider: result.provider,
  target: result.target,
  category: result.category,
  status: result.status,
  http: result.httpStatus ?? '-',
  rows: result.rows ?? '-',
  shape: result.shape ?? '-',
  bytes: result.bytes,
  ms: result.durationMs,
  coverage: result.coverage.join(', ') || '-',
})));

console.log('\nCredential state:');
console.table([
  { env: 'SPORTSDATAIO_API_KEY', configured: Boolean(process.env.SPORTSDATAIO_API_KEY) },
  { env: 'SPORTSDATA_IO_API_KEY', configured: Boolean(process.env.SPORTSDATA_IO_API_KEY) },
  { env: 'FANTASYDATA_API_KEY', configured: Boolean(process.env.FANTASYDATA_API_KEY) },
]);

console.log('\nNotes:');
for (const result of results) {
  console.log(`- ${result.id}: ${result.note}`);
}
