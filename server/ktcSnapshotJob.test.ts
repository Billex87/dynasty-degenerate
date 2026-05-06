import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storeKtcSnapshot, getKtcSnapshotFromDaysAgo } from './ktcSnapshotJob';

// Mock the database and KTC loader
vi.mock('./db', () => ({
  getDb: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./ktcLoader', () => ({
  loadKTCValues: vi.fn(() =>
    Promise.resolve({
      'josh-allen': { name: 'Josh Allen', ktc_value: 1500 },
      'patrick-mahomes': { name: 'Patrick Mahomes', ktc_value: 1400 },
      'travis-kelce': { name: 'Travis Kelce', ktc_value: 1200 },
    })
  ),
  loadLiveKTCValues: vi.fn(() => Promise.resolve({})),
  loadLiveKTCValueProfiles: vi.fn(() => Promise.resolve({})),
  saveLocalKtcSnapshot: vi.fn(() => '/tmp/ktc-snapshot-2026-04-29.json'),
}));

vi.mock('./valueBlend', () => ({
  DEFAULT_VALUE_SOURCE_PROFILE_KEY: '12_sf_ppr_base',
  KTC_SNAPSHOT_PROFILES: [
    { key: 'sf_ppr', label: 'Superflex PPR', qbProfile: 'superflex', tepProfile: 'base', ppr: 1 },
  ],
  VALUE_SOURCE_PROFILE_DEFINITIONS: [
    {
      key: '12_sf_ppr_base',
      label: '12-team SF PPR',
      numQbs: 2,
      numTeams: 12,
      ppr: 1,
      tep: 0,
      fantasyProsScoring: 'PPR',
      ktcProfileKey: 'sf_ppr',
    },
  ],
  loadBlendedPlayerValues: vi.fn((values) => Promise.resolve(values)),
  loadBlendedValueProfiles: vi.fn(() =>
    Promise.resolve({
      '12_sf_ppr_base': {
        'josh-allen': { name: 'Josh Allen', ktc_value: 1500 },
      },
    })
  ),
  loadDynastyProcessValueProfiles: vi.fn(() => Promise.resolve({ one_qb: {}, superflex: {} })),
  loadFantasyCalcValueProfiles: vi.fn(() => Promise.resolve({})),
  loadFantasyProsValueProfiles: vi.fn(() => Promise.resolve({ STD: {}, HALF: {}, PPR: {} })),
  loadFlockFantasyValueProfiles: vi.fn(() => Promise.resolve({ SUPERFLEX: {}, ONEQB: {}, PROSPECTS_SF: {}, PROSPECTS: {} })),
  loadValueProfileSources: vi.fn(() =>
    Promise.resolve({
      fantasyCalc: {},
      flockFantasy: { SUPERFLEX: {}, ONEQB: {}, PROSPECTS_SF: {}, PROSPECTS: {} },
      dynastyProcess: { one_qb: {}, superflex: {} },
      fantasyPros: { STD: {}, HALF: {}, PPR: {} },
    })
  ),
}));

describe('KTC Snapshot Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle missing database gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    await storeKtcSnapshot();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[KTC Snapshot] Database not available; saved local snapshot only'
    );
    
    consoleSpy.mockRestore();
  });

  it('should return null when no snapshot found from 14 days ago', async () => {
    const result = await getKtcSnapshotFromDaysAgo(14);
    
    // When database is not available, should return null
    expect(result).toBeNull();
  });

  it('should log a warning when database is unavailable during snapshot storage', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // This will fail gracefully due to no database, but we're testing the error message
    await storeKtcSnapshot();
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[KTC Snapshot] Database not available; saved local snapshot only'
    );
    
    consoleWarnSpy.mockRestore();
  });
});
