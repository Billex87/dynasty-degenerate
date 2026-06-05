import {
  listLatestSnapshotMetadata,
  listSourceHealthEventsSince,
  type StoredSnapshotMetadata,
  type StoredSourceHealthEvent,
} from './db';
import { getFantasyProsRollingWeeks, type FantasyProsWeeklyEcrPosition } from './fantasyProsHealth';
import { isAnyProjectionTypeEnabled, type ProjectionTypeKey } from './projectionFeatureFlags';
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
  currentWeek?: number | null;
  weekWindow?: number | null;
  rowCounts?: RowCountOverride[];
  now?: Date;
};

const DEFAULT_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const DAILY_STALE_HOURS = 36;
const WEEKLY_STALE_HOURS = 7 * 24;
const MONTHLY_STALE_HOURS = 45 * 24;
const LONG_TERM_STALE_HOURS = 90 * 24;
const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled']);

const PROVIDER_LABELS: Record<string, string> = {
  'fantasypros-news-v1': 'FantasyPros news snapshot',
  'fantasypros-endpoint:weekly-ecr': 'FantasyPros weekly ECR endpoint snapshot',
  'fantasypros-endpoint:ww': 'FantasyPros waiver-wire endpoint snapshot',
  'fantasypros-endpoint:projections': 'FantasyPros endpoint snapshot: projections',
  'fantasypros-endpoint:player-points': 'FantasyPros player-points endpoint snapshot',
  'fantasypros-endpoint:players': 'FantasyPros players endpoint snapshot',
  'fantasypros-endpoint:compare-players': 'FantasyPros compare-players endpoint snapshot',
  'sportsdataio-news-v1': 'SportsDataIO/RotoBaller news snapshot',
  'espn-depth-charts-v1': 'ESPN depth-chart snapshot',
  'draftsharks-sos-v1': 'DraftSharks SOS snapshot',
  'nfl-schedule-games-v1': 'Normalized NFL schedule snapshot',
  'sleeper-weekly-projections-v1': 'Stored weekly projection snapshot',
  'player-props-opticodds-v1': 'OpticOdds player props snapshot',
  'nflverse-draft-capital-v1': 'nflverse draft-capital snapshot',
  'nflverse-team-environment-v1': 'nflverse team-environment snapshot',
  'nflverse-roster-room-v1': 'nflverse roster-room snapshot',
  'nflverse-combine-v1': 'nflverse combine snapshot',
  'nflverse-contracts-v1': 'nflverse contracts snapshot',
};

const RETIRED_SNAPSHOT_SOURCE_PREFIXES = [
  'fantasypros-matchup-calendar-v1:',
];

function envFlag(name: string): boolean {
  return ENABLED_VALUES.has(String(process.env[name] || '').trim().toLowerCase());
}

function isDisabledEnvValue(name: string): boolean {
  return DISABLED_VALUES.has(String(process.env[name] || '').trim().toLowerCase());
}

function hasEnvValue(name: string): boolean {
  return Boolean(String(process.env[name] || '').trim());
}

function isRetiredSnapshotSourceKey(sourceKey: string): boolean {
  return RETIRED_SNAPSHOT_SOURCE_PREFIXES.some((prefix) => sourceKey.startsWith(prefix));
}

function isUnselectedDevySourceSnapshot(metadata: StoredSnapshotMetadata, expectedBySource: Map<string, ExpectedSnapshotSource>): boolean {
  return metadata.sourceKey.startsWith('devy-source-snapshot:')
    && !expectedBySource.has(metadata.sourceKey);
}

function fantasyProsNewsMissingLevel(): SourceSnapshotFreshnessDiagnostic['level'] {
  return hasEnvValue('FANTASYPROS_API_KEY') && !isDisabledEnvValue('ENABLE_FANTASYPROS_NEWS')
    ? 'warn'
    : 'info';
}

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

function fantasyProsEndpointSnapshotKey(season: string, scoring: string, endpointKey: string): string {
  return `fantasypros-endpoint-v1:${season}:${scoring}:${endpointKey}`;
}

const FANTASYPROS_WEEKLY_ECR_POSITIONS: FantasyProsWeeklyEcrPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
const FANTASYPROS_PROJECTION_TYPES: ProjectionTypeKey[] = [
  'weekly',
  'restOfSeason',
  'preseason',
  'playoffWeeks',
  'positionSpecific',
  'teamDefense',
  'kicker',
  'injuryAdjusted',
];

function shouldExpectFantasyProsProjectionEndpoint(): boolean {
  return isAnyProjectionTypeEnabled('fantasypros', FANTASYPROS_PROJECTION_TYPES);
}

function fantasyProsWeeklyEcrExpectedSources(
  season: string,
  scoring: string,
  currentWeek?: number | null,
  weekWindow?: number | null,
): ExpectedSnapshotSource[] {
  return getFantasyProsRollingWeeks(currentWeek ?? undefined, weekWindow ?? undefined)
    .flatMap((week) => FANTASYPROS_WEEKLY_ECR_POSITIONS.map((position) => ({
      sourceKey: fantasyProsEndpointSnapshotKey(season, scoring, `fantasypros-weekly-ecr-${position.toLowerCase()}-week-${week}`),
      source: `FantasyPros weekly ECR ${position} Week ${week} endpoint snapshot`,
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
      missingLevel: 'info' as const,
    })));
}

function fantasyProsEndpointExpectedSources(
  season: string,
  scoring = 'PPR',
  currentWeek?: number | null,
  weekWindow?: number | null,
): ExpectedSnapshotSource[] {
  const sources: ExpectedSnapshotSource[] = [
    {
      sourceKey: fantasyProsEndpointSnapshotKey(season, scoring, 'fantasypros-weekly-ecr'),
      source: PROVIDER_LABELS['fantasypros-endpoint:weekly-ecr'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
      missingLevel: 'info',
    },
    {
      sourceKey: fantasyProsEndpointSnapshotKey(season, scoring, 'fantasypros-ww'),
      source: PROVIDER_LABELS['fantasypros-endpoint:ww'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
      missingLevel: 'info',
    },
    {
      sourceKey: fantasyProsEndpointSnapshotKey(season, scoring, 'fantasypros-player-points'),
      source: PROVIDER_LABELS['fantasypros-endpoint:player-points'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
      missingLevel: 'info',
    },
    {
      sourceKey: fantasyProsEndpointSnapshotKey(season, scoring, 'fantasypros-players'),
      source: PROVIDER_LABELS['fantasypros-endpoint:players'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: WEEKLY_STALE_HOURS,
      missingLevel: 'info',
    },
    {
      sourceKey: fantasyProsEndpointSnapshotKey(season, scoring, 'fantasypros-compare-players'),
      source: PROVIDER_LABELS['fantasypros-endpoint:compare-players'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: WEEKLY_STALE_HOURS,
      missingLevel: 'info',
    },
    ...fantasyProsWeeklyEcrExpectedSources(season, scoring, currentWeek, weekWindow),
  ];

  if (shouldExpectFantasyProsProjectionEndpoint()) {
    sources.splice(2, 0, {
      sourceKey: fantasyProsEndpointSnapshotKey(season, scoring, 'fantasypros-projections'),
      source: PROVIDER_LABELS['fantasypros-endpoint:projections'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
      missingLevel: 'info',
    });
  }

  return sources;
}

function normalizeMetadataSource(metadata: StoredSnapshotMetadata): StoredSnapshotMetadata {
  return {
    ...metadata,
    source: sourceLabel(metadata.sourceKey, metadata.source),
  };
}

function getMetadataRowCount(metadata: StoredSnapshotMetadata | null): number | null {
  const raw = (metadata as { rowCount?: unknown } | null)?.rowCount;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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
    if (isRetiredSnapshotSourceKey(metadata.sourceKey)) continue;
    if (isUnselectedDevySourceSnapshot(metadata, expectedBySource)) continue;

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
        : health?.rowCount ?? getMetadataRowCount(metadata);
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
  const rosterRoomSeason = Number.isFinite(Number(previousSeason)) ? String(Number(previousSeason) + 1) : previousSeason;
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
      missingLevel: envFlag('ENABLE_DEVY_SOURCE_SNAPSHOTS') ? 'warn' : 'info',
    },
    {
      sourceKey: 'fantasypros-news-v1',
      source: PROVIDER_LABELS['fantasypros-news-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
      missingLevel: fantasyProsNewsMissingLevel(),
    },
    ...fantasyProsEndpointExpectedSources(input.currentSeason, 'PPR', input.currentWeek, input.weekWindow),
    {
      sourceKey: 'espn-depth-charts-v1',
      source: PROVIDER_LABELS['espn-depth-charts-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: WEEKLY_STALE_HOURS,
    },
    {
      sourceKey: 'draftsharks-sos-v1',
      source: PROVIDER_LABELS['draftsharks-sos-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: WEEKLY_STALE_HOURS,
      missingLevel: envFlag('ENABLE_DRAFTSHARKS_SOS') ? 'warn' : 'info',
    },
    {
      sourceKey: 'nfl-schedule-games-v1',
      source: PROVIDER_LABELS['nfl-schedule-games-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: WEEKLY_STALE_HOURS,
      missingLevel: 'warn',
    },
    ...['PPR', 'HALF_PPR', 'STD'].map((scoringProfile) => ({
      sourceKey: `player-projection-snapshots-v1:sleeper:${scoringProfile}:weekly`,
      source: `${PROVIDER_LABELS['sleeper-weekly-projections-v1']} (${scoringProfile})`,
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
      missingLevel: envFlag('ENABLE_SLEEPER_PROJECTIONS') ? 'warn' as const : 'info' as const,
    })),
    {
      sourceKey: 'nflverse-draft-capital-v1',
      source: PROVIDER_LABELS['nflverse-draft-capital-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: WEEKLY_STALE_HOURS,
    },
    {
      sourceKey: `nflverse-usage-v1:${previousSeason}`,
      source: `nflverse usage snapshot: ${previousSeason}`,
      tableName: 'providerDataSnapshots',
      staleAfterHours: LONG_TERM_STALE_HOURS,
    },
    {
      sourceKey: `nflverse-team-environment-v1:${previousSeason}`,
      source: `nflverse team-environment snapshot: ${previousSeason}`,
      tableName: 'providerDataSnapshots',
      staleAfterHours: LONG_TERM_STALE_HOURS,
      missingLevel: 'info',
    },
    {
      sourceKey: `nflverse-roster-room-v1:${rosterRoomSeason}`,
      source: `nflverse roster-room snapshot: ${rosterRoomSeason}`,
      tableName: 'providerDataSnapshots',
      staleAfterHours: WEEKLY_STALE_HOURS,
    },
    {
      sourceKey: `nflverse-injuries-v1:${previousSeason}`,
      source: `nflverse injury snapshot: ${previousSeason}`,
      tableName: 'providerDataSnapshots',
      staleAfterHours: LONG_TERM_STALE_HOURS,
    },
    {
      sourceKey: 'nflverse-combine-v1',
      source: PROVIDER_LABELS['nflverse-combine-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: MONTHLY_STALE_HOURS,
    },
    {
      sourceKey: 'nflverse-contracts-v1',
      source: PROVIDER_LABELS['nflverse-contracts-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: MONTHLY_STALE_HOURS,
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
      missingLevel: 'info',
    },
  ];

  if (envFlag('ENABLE_SPORTSDATAIO_NEWS')) {
    expectedSources.push({
      sourceKey: 'sportsdataio-news-v1',
      source: PROVIDER_LABELS['sportsdataio-news-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
      missingLevel: 'warn',
    });
  }

  if (envFlag('ENABLE_OPTICODDS_PLAYER_PROPS')) {
    expectedSources.push({
      sourceKey: 'player-props-opticodds-v1',
      source: PROVIDER_LABELS['player-props-opticodds-v1'],
      tableName: 'providerDataSnapshots',
      staleAfterHours: DAILY_STALE_HOURS,
      missingLevel: 'warn',
    });
  }

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
