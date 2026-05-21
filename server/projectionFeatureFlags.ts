export type ProjectionSourceKey =
  | 'fantasypros'
  | 'draftsharks'
  | 'sportsdataio'
  | 'fantasynerds'
  | 'internal';

export type ProjectionTypeKey =
  | 'weekly'
  | 'restOfSeason'
  | 'preseason'
  | 'playoffWeeks'
  | 'positionSpecific'
  | 'teamDefense'
  | 'kicker'
  | 'injuryAdjusted';

export type ProjectionGateResult = {
  enabled: boolean;
  source: ProjectionSourceKey;
  projectionType: ProjectionTypeKey;
  requiredFlags: string[];
  blockingFlags: string[];
  reason: string;
};

export type ProjectionSnapshotStatus = 'ready' | 'missing' | 'stale' | 'error' | 'disabled';
export type ProjectionSourceMappingStatus = 'ready' | 'partial' | 'broken' | 'unknown';

export type ProjectionReadinessInput = {
  source: ProjectionSourceKey;
  projectionType: ProjectionTypeKey;
  projectionSnapshotStatus?: ProjectionSnapshotStatus;
  scheduleSnapshotStatus?: ProjectionSnapshotStatus;
  sourceMappingStatus?: ProjectionSourceMappingStatus;
};

export type ProjectionReadinessGateResult = ProjectionGateResult & {
  projectionSnapshotStatus: ProjectionSnapshotStatus;
  scheduleSnapshotStatus: ProjectionSnapshotStatus;
  sourceMappingStatus: ProjectionSourceMappingStatus;
};

const ENABLED_VALUES = /^(?:1|true|yes|on|enabled)$/i;
const DISABLED_VALUES = /^(?:0|false|off|no|disabled)$/i;

export const PROJECTION_SOURCE_FLAGS: Record<ProjectionSourceKey, string> = {
  fantasypros: 'ENABLE_FANTASYPROS_PROJECTIONS',
  draftsharks: 'ENABLE_DRAFTSHARKS_PROJECTIONS',
  sportsdataio: 'ENABLE_SPORTSDATAIO_PROJECTIONS',
  fantasynerds: 'ENABLE_FANTASY_NERDS_PROJECTIONS',
  internal: 'ENABLE_INTERNAL_PROJECTION_ESTIMATES',
};

export const PROJECTION_TYPE_FLAGS: Record<ProjectionTypeKey, string> = {
  weekly: 'ENABLE_WEEKLY_PROJECTIONS',
  restOfSeason: 'ENABLE_REST_OF_SEASON_PROJECTIONS',
  preseason: 'ENABLE_PRESEASON_PROJECTIONS',
  playoffWeeks: 'ENABLE_PLAYOFF_WEEK_PROJECTIONS',
  positionSpecific: 'ENABLE_POSITION_PROJECTIONS',
  teamDefense: 'ENABLE_TEAM_DEFENSE_PROJECTIONS',
  kicker: 'ENABLE_KICKER_PROJECTIONS',
  injuryAdjusted: 'ENABLE_INJURY_ADJUSTED_PROJECTIONS',
};

export const PROJECTION_KILL_SWITCH_FLAGS = [
  'DISABLE_PROJECTION_FEATURES',
  'DISABLE_PROJECTION_SNAPSHOTS',
  'DISABLE_PROJECTION_READOUTS',
  'DISABLE_PROJECTION_JOINS',
] as const;

function envValue(name: string): string {
  return String(process.env[name] || '').trim();
}

function isExplicitlyEnabled(name: string): boolean {
  return ENABLED_VALUES.test(envValue(name));
}

function isExplicitlyDisabled(name: string): boolean {
  return DISABLED_VALUES.test(envValue(name));
}

function activeKillSwitches(): string[] {
  return PROJECTION_KILL_SWITCH_FLAGS.filter(isExplicitlyEnabled);
}

export function getProjectionGate(source: ProjectionSourceKey, projectionType: ProjectionTypeKey): ProjectionGateResult {
  const requiredFlags = [
    'ENABLE_PROJECTION_FEATURES',
    PROJECTION_SOURCE_FLAGS[source],
    PROJECTION_TYPE_FLAGS[projectionType],
  ];
  const blockingFlags = [
    ...activeKillSwitches(),
    ...requiredFlags.filter(isExplicitlyDisabled),
    ...requiredFlags.filter((flag) => !isExplicitlyEnabled(flag) && !isExplicitlyDisabled(flag)),
  ];
  const enabled = blockingFlags.length === 0;

  return {
    enabled,
    source,
    projectionType,
    requiredFlags,
    blockingFlags,
    reason: enabled
      ? `${source} ${projectionType} projections are enabled by ${requiredFlags.join(', ')}.`
      : `Projection gate blocked by ${blockingFlags.join(', ') || 'unknown projection rollout state'}.`,
  };
}

export function isProjectionEnabled(source: ProjectionSourceKey, projectionType: ProjectionTypeKey): boolean {
  return getProjectionGate(source, projectionType).enabled;
}

export function isAnyProjectionTypeEnabled(source: ProjectionSourceKey, projectionTypes: ProjectionTypeKey[]): boolean {
  return projectionTypes.some((projectionType) => isProjectionEnabled(source, projectionType));
}

export function getProjectionReadinessGate(input: ProjectionReadinessInput): ProjectionReadinessGateResult {
  const flagGate = getProjectionGate(input.source, input.projectionType);
  const projectionSnapshotStatus = input.projectionSnapshotStatus || 'missing';
  const scheduleSnapshotStatus = input.scheduleSnapshotStatus || 'missing';
  const sourceMappingStatus = input.sourceMappingStatus || 'unknown';
  const blockingFlags = [...flagGate.blockingFlags];
  const blockers: string[] = [];

  if (projectionSnapshotStatus !== 'ready') blockers.push(`projection snapshot ${projectionSnapshotStatus}`);
  if (scheduleSnapshotStatus !== 'ready') blockers.push(`schedule snapshot ${scheduleSnapshotStatus}`);
  if (sourceMappingStatus !== 'ready') blockers.push(`source mapping ${sourceMappingStatus}`);

  return {
    ...flagGate,
    enabled: flagGate.enabled && blockers.length === 0,
    blockingFlags,
    projectionSnapshotStatus,
    scheduleSnapshotStatus,
    sourceMappingStatus,
    reason: flagGate.enabled && blockers.length === 0
      ? `${input.source} ${input.projectionType} projections are ready with fresh projection, schedule, and mapping evidence.`
      : [
          flagGate.enabled ? null : flagGate.reason,
          blockers.length ? `Projection readiness blocked by ${blockers.join(', ')}.` : null,
        ].filter(Boolean).join(' '),
  };
}

export function getProjectionFlagMatrix() {
  return {
    globalFlag: 'ENABLE_PROJECTION_FEATURES',
    sourceFlags: PROJECTION_SOURCE_FLAGS,
    typeFlags: PROJECTION_TYPE_FLAGS,
    killSwitchFlags: [...PROJECTION_KILL_SWITCH_FLAGS],
  };
}
