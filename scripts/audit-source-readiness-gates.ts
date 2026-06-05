#!/usr/bin/env tsx

import {
  SOURCE_READINESS_GATES,
  summarizeSourceReadinessGates,
  validateSourceReadinessGates,
} from '../server/sourceReadinessGates';

const summary = summarizeSourceReadinessGates();
const errors = validateSourceReadinessGates();

console.log('# Projection/SOS Source Readiness Gates');
console.log(`Total: ${summary.total}`);
console.log(`Approved for snapshots: ${summary.totals['approved-for-snapshot']}`);
console.log(`Approved for public claims: ${summary.totals['approved-for-public-claim']}`);
console.log(`Research: ${summary.totals.research}`);
console.log(`Blocked: ${summary.totals.blocked}`);

console.log('\nGate register:');
console.table(SOURCE_READINESS_GATES.map((gate) => ({
  id: gate.id,
  source: gate.source,
  status: gate.status,
  normalLoad: gate.normalReportLoad,
  publicClaim: gate.publicClaimAllowed,
})));

console.log('\nOpen gates:');
for (const gate of SOURCE_READINESS_GATES.filter((row) => row.status === 'blocked' || row.status === 'research')) {
  console.log(`- ${gate.status.toUpperCase()} ${gate.id}: ${gate.nextAction}`);
}

if (errors.length) {
  console.log('\nValidation errors:');
  for (const error of errors) console.log(`- ${error}`);
  process.exitCode = 1;
}
