export type ValueSourceCoverageRow = {
  key: string;
  label: string;
  currentWeight: number;
  configuredStatus?: string | null;
  archiveStatus?: string | null;
  archivedPointCount: number;
  captureMode?: string | null;
  note?: string | null;
};

export type ZeroRowValuationDisposition =
  | 'active'
  | 'fix'
  | 'watch'
  | 'disable'
  | 'benchmark-only';

export type ZeroRowValuationAuditRow = ValueSourceCoverageRow & {
  disposition: ZeroRowValuationDisposition;
  reason: string;
};

export type ZeroRowValuationAuditSummary = {
  totalSources: number;
  zeroRowSources: number;
  byDisposition: Record<Exclude<ZeroRowValuationDisposition, 'active'>, number>;
  errors: string[];
};

function normalizedStatus(row: ValueSourceCoverageRow): string {
  return `${row.configuredStatus || ''} ${row.archiveStatus || ''}`.toLowerCase();
}

function nonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeCoverageRow(row: ValueSourceCoverageRow): ValueSourceCoverageRow {
  return {
    ...row,
    currentWeight: nonNegativeNumber(row.currentWeight),
    archivedPointCount: nonNegativeNumber(row.archivedPointCount),
  };
}

export function classifyZeroRowValuationSource(row: ValueSourceCoverageRow): Pick<ZeroRowValuationAuditRow, 'disposition' | 'reason'> {
  const normalizedRow = normalizeCoverageRow(row);
  if (normalizedRow.archivedPointCount > 0) {
    return {
      disposition: 'active',
      reason: 'Archived rows are present, so this is not a zero-row valuation source.',
    };
  }

  const status = normalizedStatus(normalizedRow);
  if (normalizedRow.currentWeight > 0) {
    return {
      disposition: 'fix',
      reason: 'Source has active blend weight but no archived rows; fix coverage or remove weight before trusting it.',
    };
  }

  if (status.includes('benchmark-only')) {
    return {
      disposition: 'benchmark-only',
      reason: 'Zero rows are acceptable because this source is benchmark context and has no active blend weight.',
    };
  }

  if (status.includes('future')) {
    return {
      disposition: 'watch',
      reason: 'Future licensed/provider source should stay visible but cannot affect active weights yet.',
    };
  }

  if (status.includes('archived') || status.includes('present')) {
    return {
      disposition: 'watch',
      reason: 'Source is configured as archived/present but has no rows in the current audit; verify archive source names and import coverage.',
    };
  }

  return {
    disposition: 'disable',
    reason: 'Source has no rows, no active weight, and no benchmark/future status; keep it disabled until approved evidence exists.',
  };
}

export function buildZeroRowValuationAudit(rows: ValueSourceCoverageRow[]): ZeroRowValuationAuditRow[] {
  return rows
    .map((row) => {
      const normalizedRow = normalizeCoverageRow(row);
      return {
        ...normalizedRow,
        ...classifyZeroRowValuationSource(normalizedRow),
      };
    })
    .filter((row) => row.archivedPointCount === 0)
    .sort((a, b) => {
      const priority: Record<ZeroRowValuationDisposition, number> = {
        fix: 0,
        watch: 1,
        disable: 2,
        'benchmark-only': 3,
        active: 4,
      };
      return priority[a.disposition] - priority[b.disposition] || a.label.localeCompare(b.label);
    });
}

export function summarizeZeroRowValuationAudit(rows: ValueSourceCoverageRow[]): ZeroRowValuationAuditSummary {
  const zeroRows = buildZeroRowValuationAudit(rows);
  const byDisposition: ZeroRowValuationAuditSummary['byDisposition'] = {
    fix: 0,
    watch: 0,
    disable: 0,
    'benchmark-only': 0,
  };
  const errors: string[] = [];

  for (const row of zeroRows) {
    if (row.disposition === 'active') {
      errors.push(`${row.key} has zero rows but was classified as active.`);
      continue;
    }

    byDisposition[row.disposition] += 1;

    if (row.currentWeight > 0 && row.disposition !== 'fix') {
      errors.push(`${row.key} has active weight ${row.currentWeight} but was classified as ${row.disposition}.`);
    }
  }

  return {
    totalSources: rows.length,
    zeroRowSources: zeroRows.length,
    byDisposition,
    errors,
  };
}
