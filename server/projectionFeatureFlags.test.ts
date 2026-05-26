import { afterEach, describe, expect, it } from 'vitest';
import {
  getProjectionFlagMatrix,
  getProjectionGate,
  getProjectionReadinessGate,
  isAnyProjectionTypeEnabled,
  isProjectionEnabled,
  PROJECTION_KILL_SWITCH_FLAGS,
  PROJECTION_SOURCE_FLAGS,
  PROJECTION_TYPE_FLAGS,
  type ProjectionSourceKey,
  type ProjectionTypeKey,
} from './projectionFeatureFlags';

const originalValues = new Map<string, string | undefined>();

function rememberFlag(name: string) {
  if (!originalValues.has(name)) originalValues.set(name, process.env[name]);
}

function setFlag(name: string, value: string) {
  rememberFlag(name);
  process.env[name] = value;
}

function clearProjectionEnv() {
  [
    'ENABLE_PROJECTION_FEATURES',
    ...Object.values(PROJECTION_SOURCE_FLAGS),
    ...Object.values(PROJECTION_TYPE_FLAGS),
    ...PROJECTION_KILL_SWITCH_FLAGS,
  ].forEach((flag) => {
    rememberFlag(flag);
    delete process.env[flag];
  });
}

function enableGate(source: ProjectionSourceKey, projectionType: ProjectionTypeKey) {
  setFlag('ENABLE_PROJECTION_FEATURES', 'true');
  setFlag(PROJECTION_SOURCE_FLAGS[source], 'true');
  setFlag(PROJECTION_TYPE_FLAGS[projectionType], 'true');
}

afterEach(() => {
  for (const [flag, value] of originalValues.entries()) {
    if (value === undefined) delete process.env[flag];
    else process.env[flag] = value;
  }
  originalValues.clear();
});

describe('projection feature flags', () => {
  it('fails closed until the global, source, and projection-type flags are all enabled', () => {
    clearProjectionEnv();

    let gate = getProjectionGate('fantasypros', 'weekly');
    expect(gate.enabled).toBe(false);
    expect(gate.blockingFlags).toEqual(
      expect.arrayContaining([
        'ENABLE_PROJECTION_FEATURES',
        'ENABLE_FANTASYPROS_PROJECTIONS',
        'ENABLE_WEEKLY_PROJECTIONS',
      ])
    );

    setFlag('ENABLE_PROJECTION_FEATURES', 'true');
    setFlag('ENABLE_FANTASYPROS_PROJECTIONS', 'true');
    gate = getProjectionGate('fantasypros', 'weekly');
    expect(gate.enabled).toBe(false);
    expect(gate.blockingFlags).toContain('ENABLE_WEEKLY_PROJECTIONS');

    setFlag('ENABLE_WEEKLY_PROJECTIONS', 'true');
    expect(isProjectionEnabled('fantasypros', 'weekly')).toBe(true);
    expect(isAnyProjectionTypeEnabled('fantasypros', ['weekly', 'restOfSeason'])).toBe(true);
  });

  it('lets kill switches override otherwise enabled projection gates', () => {
    clearProjectionEnv();
    enableGate('draftsharks', 'restOfSeason');

    expect(isProjectionEnabled('draftsharks', 'restOfSeason')).toBe(true);

    setFlag('DISABLE_PROJECTION_READOUTS', 'true');
    const gate = getProjectionGate('draftsharks', 'restOfSeason');

    expect(gate.enabled).toBe(false);
    expect(gate.blockingFlags).toContain('DISABLE_PROJECTION_READOUTS');
    expect(gate.reason).toContain('Projection gate blocked');
  });

  it('blocks ready flags when projection, schedule, or identity evidence is not ready', () => {
    clearProjectionEnv();
    enableGate('fantasypros', 'weekly');

    expect(getProjectionReadinessGate({
      source: 'fantasypros',
      projectionType: 'weekly',
      projectionSnapshotStatus: 'ready',
      scheduleSnapshotStatus: 'stale',
      sourceMappingStatus: 'ready',
    })).toMatchObject({
      enabled: false,
      scheduleSnapshotStatus: 'stale',
    });

    expect(getProjectionReadinessGate({
      source: 'fantasypros',
      projectionType: 'weekly',
      projectionSnapshotStatus: 'ready',
      scheduleSnapshotStatus: 'ready',
      sourceMappingStatus: 'broken',
    }).reason).toContain('source mapping broken');

    expect(getProjectionReadinessGate({
      source: 'fantasypros',
      projectionType: 'weekly',
      projectionSnapshotStatus: 'ready',
      scheduleSnapshotStatus: 'ready',
      sourceMappingStatus: 'ready',
    }).enabled).toBe(true);
  });

  it('exposes a matrix for docs, admin diagnostics, and future source-specific checks', () => {
    const matrix = getProjectionFlagMatrix();

    expect(matrix.globalFlag).toBe('ENABLE_PROJECTION_FEATURES');
    expect(matrix.sourceFlags).toMatchObject({
      fantasypros: 'ENABLE_FANTASYPROS_PROJECTIONS',
      sleeper: 'ENABLE_SLEEPER_PROJECTIONS',
      sportsdataio: 'ENABLE_SPORTSDATAIO_PROJECTIONS',
      fantasynerds: 'ENABLE_FANTASY_NERDS_PROJECTIONS',
    });
    expect(matrix.typeFlags).toMatchObject({
      weekly: 'ENABLE_WEEKLY_PROJECTIONS',
      teamDefense: 'ENABLE_TEAM_DEFENSE_PROJECTIONS',
      kicker: 'ENABLE_KICKER_PROJECTIONS',
    });
    expect(matrix.killSwitchFlags).toContain('DISABLE_PROJECTION_SNAPSHOTS');
  });

  it('fails Sleeper weekly projection gates closed unless every rollout flag is enabled', () => {
    clearProjectionEnv();

    let gate = getProjectionGate('sleeper', 'weekly');
    expect(gate.enabled).toBe(false);
    expect(gate.blockingFlags).toEqual(expect.arrayContaining([
      'ENABLE_PROJECTION_FEATURES',
      'ENABLE_SLEEPER_PROJECTIONS',
      'ENABLE_WEEKLY_PROJECTIONS',
    ]));

    enableGate('sleeper', 'weekly');
    gate = getProjectionGate('sleeper', 'weekly');
    expect(gate.enabled).toBe(true);
    expect(getProjectionReadinessGate({
      source: 'sleeper',
      projectionType: 'weekly',
      projectionSnapshotStatus: 'ready',
      scheduleSnapshotStatus: 'ready',
      sourceMappingStatus: 'ready',
    }).enabled).toBe(true);
  });
});
