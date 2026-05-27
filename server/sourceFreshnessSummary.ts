import type { SourceSnapshotFreshnessDiagnostic } from '../shared/types';

export type SourceFreshnessSummaryInput = {
  diagnostics: SourceSnapshotFreshnessDiagnostic[];
  generatedAt?: string;
  currentSeason?: string;
  valueProfileKey?: string;
  limit?: number;
};

export type SourceFreshnessSummary = {
  generatedAt: string;
  currentSeason: string | null;
  valueProfileKey: string | null;
  totals: {
    sources: number;
    loaded: number;
    stale: number;
    missing: number;
    error: number;
    info: number;
    warn: number;
    danger: number;
  };
  payloadBytes: number;
  rows: number;
  oldestLoadedSource: SourceSnapshotFreshnessDiagnostic | null;
  actionableSources: SourceSnapshotFreshnessDiagnostic[];
  recentHealthIssues: SourceSnapshotFreshnessDiagnostic[];
};

function countBy<T extends string>(values: T[], expected: readonly T[]): Record<T, number> {
  return Object.fromEntries(expected.map((value) => [value, values.filter((item) => item === value).length])) as Record<T, number>;
}

function hasHealthIssue(diagnostic: SourceSnapshotFreshnessDiagnostic): boolean {
  return diagnostic.level !== 'info'
    || diagnostic.status === 'error'
    || Boolean(diagnostic.lastHealthMessage && diagnostic.lastHealthStatus && diagnostic.lastHealthStatus !== 'loaded');
}

function severityRank(diagnostic: SourceSnapshotFreshnessDiagnostic): number {
  if (diagnostic.level === 'danger' || diagnostic.status === 'error') return 0;
  if (diagnostic.level === 'warn' || diagnostic.status === 'stale') return 1;
  if (diagnostic.status === 'missing') return 2;
  return 3;
}

function ageRank(diagnostic: SourceSnapshotFreshnessDiagnostic): number {
  return diagnostic.ageHours ?? (diagnostic.status === 'missing' ? Number.MAX_SAFE_INTEGER : -1);
}

function bySeverityThenAge(a: SourceSnapshotFreshnessDiagnostic, b: SourceSnapshotFreshnessDiagnostic): number {
  return severityRank(a) - severityRank(b)
    || ageRank(b) - ageRank(a)
    || a.source.localeCompare(b.source);
}

export function buildSourceFreshnessSummary(input: SourceFreshnessSummaryInput): SourceFreshnessSummary {
  const diagnostics = input.diagnostics || [];
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit || 12)));
  const statusCounts = countBy(
    diagnostics.map((diagnostic) => diagnostic.status),
    ['loaded', 'stale', 'missing', 'error'] as const,
  );
  const levelCounts = countBy(
    diagnostics.map((diagnostic) => diagnostic.level),
    ['info', 'warn', 'danger'] as const,
  );
  const loadedWithAge = diagnostics
    .filter((diagnostic) => diagnostic.status !== 'missing' && diagnostic.ageHours !== null)
    .sort((a, b) => (b.ageHours || 0) - (a.ageHours || 0));
  const actionableSources = diagnostics
    .filter((diagnostic) => diagnostic.level !== 'info' || diagnostic.status !== 'loaded')
    .sort(bySeverityThenAge)
    .slice(0, limit);
  const recentHealthIssues = diagnostics
    .filter(hasHealthIssue)
    .sort((a, b) => {
      const aTime = a.lastHealthAt ? new Date(a.lastHealthAt).getTime() : 0;
      const bTime = b.lastHealthAt ? new Date(b.lastHealthAt).getTime() : 0;
      return bTime - aTime || bySeverityThenAge(a, b);
    })
    .slice(0, limit);

  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    currentSeason: input.currentSeason || null,
    valueProfileKey: input.valueProfileKey || null,
    totals: {
      sources: diagnostics.length,
      loaded: statusCounts.loaded,
      stale: statusCounts.stale,
      missing: statusCounts.missing,
      error: statusCounts.error,
      info: levelCounts.info,
      warn: levelCounts.warn,
      danger: levelCounts.danger,
    },
    payloadBytes: diagnostics.reduce((sum, diagnostic) => sum + (diagnostic.payloadSizeBytes || 0), 0),
    rows: diagnostics.reduce((sum, diagnostic) => sum + (diagnostic.rowCount || 0), 0),
    oldestLoadedSource: loadedWithAge[0] || null,
    actionableSources,
    recentHealthIssues,
  };
}
