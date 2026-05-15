import {
  listLatestSnapshotMetadata,
  listSourceHealthEventsSince,
  type StoredSnapshotMetadata,
  type StoredSourceHealthEvent,
} from './db';
import type { SourceSnapshotFreshnessDiagnostic } from '../shared/types';

type ExpectedSnapshotSource = {
  sourceKey: string;
  source: string;
  tableName: string;
  staleAfterHours: number;
  missingLevel?: SourceSnapshotFreshnessDiagnostic['level'];
};

type RowCountOverride = {
  sourceKey: string;
  rowCount: number | null;
};

type BuildInput = {
  metadata: StoredSnapshotMetadata[];
  healthEvents?: StoredSourceHealthEvent[];
  expectedSources: ExpectedSnapshotSource[];
  rowCounts?: RowCountOverride[];
  now?: Date;
};

type LoadInput = {
  currentSeason: string;
  previousSeason?: string | null;
  valueProfileKey: string;
  devyProfileKey?: string | null;
  rowCounts?: RowCountOverride[];
  now?: Date;
};

const DEFAULT_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const DAILY_STALE_HOURS = 36;
const WEEKLY_STALE_HOURS = 7 * 24;
const MONTHLY_STALE_HOURS = 45 * 24;
const LONG_TERM_STALE_HOURS = 90 * 24;

const PROVIDER_LABELS: Record<string, string> = {
  'fantasypros-news-v1': 'FantasyPros news snapshot',
  'espn-depth-charts-v1': 'ESPN depth-chart snapshot',
  'draftsharks-sos-v1': 'DraftSharks SOS snapshot',
  'player-props-opticodds-v1': 'OpticOdds player props snapshot',
};

function hoursBetween(now: Date, then: Date | null): number | null {
  if (!then) return null;
  const hours = (now.getTime() - then.getTime()) / (60 * 60 * 1000);
  return Number.isFinite(hours) ? Math.max(0, Math.round(hours * 10) / 10) : null;
}

function latestHealthBySource(events: StoredSourceHealthEvent[] = []) {
  const latest = new Map<string, StoredSourceHealthEvent>();
  for (const event of events) {
    const existing = latest.get(event.sourceKey);
    if (!existing || event.createdAt > existing.createdAt) {
      latest.set(event.sourceKey, event);
    }
  }
  return latest;
}

function latestProblemHealthBySource(events: StoredSourceHealthEvent[] = []) {
  const latest = new Map<string, StoredSourceHealthEvent>();
  for (const event of events) {
    if (event.level === 'info') continue;
    const existing = latest.get(event.sourceKey);
    if (!existing || event.createdAt > existing.createdAt) {
      latest.set(event.sourceKey, event);
    }
  }
  return latest;
}

function sourceLabel(sourceKey: string, fallback?: string | null): string {
  return PROVIDER_LABELS[sourceKey] || fallback || sourceKey;
}

function normalizeMetadataSource(metadata: StoredSnapshotMetadata): StoredSnapshotMetadata {
  return {
    ...metadata,
    source: sourceLabel(metadata.sourceKey, metadata.source),
  };
}

function buildNote(input: {
  source: string;
  status: SourceSnapshotFreshnessDiagnostic['status'];
  ageHours: number | null;
  rowCount: number | null;
  payloadSizeBytes: number | null;
  lastProblem?: StoredSourceHealthEvent | null;
}) {
  const parts = [
    input.status === 'missing'
      ? `${input.source} has no stored snapshot metadata.`
      : `${input.source} snapshot metadata is ${input.status}.`,
    input.ageHours !== null ? `Age ${input.ageHours}h.` : null,
    input.rowCount !== null ? `${input.rowCount.toLocaleString('en-US')} rows.` : 'Row count is pending until the next source-health or report refresh supplies it.',
    input.payloadSizeBytes !== null ? `${Math.round(input.payloadSizeBytes / 1024).toLocaleString('en-US')} KB stored payload.` : null,
    input.lastProblem ? `Latest source-health issue: ${input.lastProblem.message}` : null,
  ];

  return parts.filter(Boolean).join(' ');
}

export function buildSourceSnapshotFreshnessDiagnostics(input: BuildInput): SourceSnapshotFreshnessDiagnostic[] {
  const now = input.now || new Date();
  const metadataBySource = new Map(input.metadata.map((metadata) => [metadata.sourceKey, normalizeMetadataSource(metadata)]));
  const expectedBySource = new Map(input.expectedSources.map((source) => [source.sourceKey, source]));
  const rowCountBySource = new Map((input.rowCounts || []).map((row) => [row.sourceKey, row.rowCount]));
  const latestHealth = latestHealthBySource(input.healthEvents);
  const latestProblemHealth = latestProblemHealthBySource(input.healthEvents);

  for (const metadata of input.metadata) {
    if (!expectedBySource.has(metadata.sourceKey)) {
      expectedBySource.set(metadata.sourceKey, {
        sourceKey: metadata.sourceKey,
        source: sourceLabel(metadata.sourceKey, metadata.source),
        tableName: metadata.tableName,
        staleAfterHours: WEEKLY_STALE_HOURS,
      });
    }
  }

  return Array.from(expectedBySource.values())
    .map((expected): SourceSnapshotFreshnessDiagnostic => {
      const metadata = metadataBySource.get(expected.sourceKey) || null;
      const health = latestHealth.get(expected.sourceKey) || null;
      const problemHealth = latestProblemHealth.get(expected.sourceKey) || null;
      const ageHours = hoursBetween(now, metadata?.updatedAt || null);
      const rowCount = rowCountBySource.has(expected.sourceKey)
        ? rowCountBySource.get(expected.sourceKey)!
        : health?.rowCount ?? null;
      const missing = !metadata;
      const stale = ageHours !== null && ageHours > expected.staleAfterHours;
      const status: SourceSnapshotFreshnessDiagnostic['status'] = missing
        ? 'missing'
        : problemHealth?.level === 'danger'
          ? 'error'
          : stale
            ? 'stale'
            : 'loaded';
      const level: SourceSnapshotFreshnessDiagnostic['level'] = status === 'error'
        ? 'danger'
        : status === 'missing'
          ? expected.missingLevel || 'danger'
        : status === 'stale' || problemHealth?.level === 'warn'
          ? 'warn'
          : 'info';
      const source = sourceLabel(expected.sourceKey, metadata?.source || expected.source);

      return {
        sourceKey: expected.sourceKey,
        source,
        tableName: metadata?.tableName || expected.tableName,
        snapshotKey: metadata?.snapshotKey || null,
        updatedAt: metadata?.updatedAt?.toISOString() || null,
        ageHours,
        payloadSizeBytes: metadata?.payloadSizeBytes ?? null,
        rowCount,
        status,
        level,
        note: buildNote({
          source,
          status,
          ageHours,
          rowCount,
          payloadSizeBytes: metadata?.payloadSizeBytes ?? null,
          lastProblem: problemHealth,
        }),
        lastHealthStatus: health?.status || null,
        lastHealthMessage: health?.message || null,
        lastHealthAt: health?.createdAt?.toISOString() || null,
      };
    })
    .sort((a, b) => {
      const levelRank = { danger: 0, warn: 1, info: 2 };
      return levelRank[a.level] - levelRank[b.level] || a.source.localeCompare(b.source);
    });
}

export async function loadSourceSnapshotFreshnessDiagnostics(input: LoadInput): Promise<SourceSnapshotFreshnessDiagnostic[]> {
  const previousSeason = input.previousSeason || String(Number(input.currentSeason) - 1);
  const expectedSources: ExpectedSnapshotSource[] = [
    {
      sourceKey: 'ktc-blended-values-v1',
      source: 'Blended value snapshot',
      tableName: 'ktcSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
    },
    {
      sourceKey: `redraft-source-snapshot:${input.currentSeason}`,
      source: `Redraft source snapshot: ${input.currentSeason}`,
      tableName: 'redraftSourceSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
    },
    {
      sourceKey: `devy-source-snapshot:${input.devyProfileKey || input.valueProfileKey}`,
      source: `Devy source snapshot: ${input.devyProfileKey || input.valueProfileKey}`,
      tableName: 'devySourceSnapshots',
      staleAfterHours: WEEKLY_STALE_HOURS,
    },
    {
      sourceKey: 'fantasypros-news-v1',
      source: PROVIDER_LABELS['fantasypros-news-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
    },
    {
      sourceKey: 'espn-depth-charts-v1',
      source: PROVIDER_LABELS['espn-depth-charts-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
    },
    {
      sourceKey: 'draftsharks-sos-v1',
      source: PROVIDER_LABELS['draftsharks-sos-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: WEEKLY_STALE_HOURS,
    },
    {
      sourceKey: 'player-props-opticodds-v1',
      source: PROVIDER_LABELS['player-props-opticodds-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
      missingLevel: 'warn',
    },
    {
      sourceKey: `sleeper-season-stats-v1:${previousSeason}`,
      source: `Sleeper season stats snapshot: ${previousSeason}`,
      tableName: 'providerDataSnapshots',
      staleAfterHours: LONG_TERM_STALE_HOURS,
    },
    {
      sourceKey: 'prospect-snapshot:NFL Draft Buzz',
      source: 'Prospect snapshot: NFL Draft Buzz',
      tableName: 'prospectSnapshots',
      staleAfterHours: MONTHLY_STALE_HOURS,
    },
  ];
  const [metadata, healthEvents] = await Promise.all([
    listLatestSnapshotMetadata(),
    listSourceHealthEventsSince(new Date((input.now || new Date()).getTime() - DEFAULT_LOOKBACK_MS), 200),
  ]);

  return buildSourceSnapshotFreshnessDiagnostics({
    metadata,
    healthEvents,
    expectedSources,
    rowCounts: input.rowCounts,
    now: input.now,
  });
}
