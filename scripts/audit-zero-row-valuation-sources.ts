#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import '../server/_core/env';
import {
  buildZeroRowValuationAudit,
  type ValueSourceCoverageRow,
} from '../server/valueSourceZeroRowAudit';

type CoverageAuditFile = {
  sources?: Array<{
    key: string;
    label: string;
    currentWeight: number;
    configuredStatus?: string;
    archiveStatus?: string;
    archivedPointCount?: number;
    captureMode?: string;
    note?: string;
  }>;
};

const rootDir = process.cwd();
const defaultAuditPath = path.join(rootDir, 'server', 'value-history-archive', 'source-coverage-audit.json');
const auditPath = process.env.ZERO_ROW_VALUATION_AUDIT_FILE
  ? path.resolve(rootDir, process.env.ZERO_ROW_VALUATION_AUDIT_FILE)
  : defaultAuditPath;

async function loadRowsFromCoverageAudit(): Promise<ValueSourceCoverageRow[] | null> {
  if (!fs.existsSync(auditPath)) return null;
  const parsed = JSON.parse(fs.readFileSync(auditPath, 'utf8')) as CoverageAuditFile;
  if (!Array.isArray(parsed.sources)) return null;
  return parsed.sources.map((source) => ({
    key: source.key,
    label: source.label,
    currentWeight: Number(source.currentWeight || 0),
    configuredStatus: source.configuredStatus || null,
    archiveStatus: source.archiveStatus || null,
    archivedPointCount: Number(source.archivedPointCount || 0),
    captureMode: source.captureMode || null,
    note: source.note || null,
  }));
}

async function loadRowsFromRegistry(): Promise<ValueSourceCoverageRow[]> {
  const registry = await import('./value-history-source-registry.mjs') as {
    VALUE_HISTORY_SOURCES: Array<{
      key: string;
      label: string;
      currentWeight: number;
      status: string;
      captureMode?: string;
      note?: string;
    }>;
  };

  return registry.VALUE_HISTORY_SOURCES.map((source) => ({
    key: source.key,
    label: source.label,
    currentWeight: Number(source.currentWeight || 0),
    configuredStatus: source.status,
    archiveStatus: source.status,
    archivedPointCount: 0,
    captureMode: source.captureMode || null,
    note: source.note || null,
  }));
}

const rows = await loadRowsFromCoverageAudit() || await loadRowsFromRegistry();
const zeroRows = buildZeroRowValuationAudit(rows);

console.log('# Zero-Row Valuation Source Audit');
console.log(`Input: ${fs.existsSync(auditPath) ? path.relative(rootDir, auditPath) : 'value-history-source-registry fallback'}`);
console.log(`Configured sources: ${rows.length}`);
console.log(`Zero-row sources: ${zeroRows.length}`);

if (!zeroRows.length) {
  console.log('No zero-row valuation sources found.');
} else {
  console.table(zeroRows.map((row) => ({
    key: row.key,
    source: row.label,
    weight: row.currentWeight,
    status: row.configuredStatus || row.archiveStatus || '-',
    disposition: row.disposition,
    reason: row.reason,
  })));
}

const fixRows = zeroRows.filter((row) => row.disposition === 'fix');
if (fixRows.length) {
  console.log('\nActive-weight sources needing action:');
  for (const row of fixRows) {
    console.log(`- ${row.label}: ${row.reason}`);
  }
  process.exitCode = 1;
}
