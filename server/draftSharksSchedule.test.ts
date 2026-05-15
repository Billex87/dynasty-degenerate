import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearApiProviderTelemetryForTests, getApiProviderTelemetrySnapshot } from './apiProviderTelemetry';
import * as db from './db';
import {
  clearDraftSharksScheduleCacheForTests,
  getDraftSharksScheduleProfile,
  loadDraftSharksScheduleContext,
  normalizeDraftSharksSosPayload,
} from './draftSharksSchedule';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  clearDraftSharksScheduleCacheForTests();
  clearApiProviderTelemetryForTests();
});

describe('DraftSharks schedule integration', () => {
  it('stays disabled unless the feature flag is enabled', async () => {
    process.env.ENABLE_DRAFTSHARKS_SOS = '';

    const context = await loadDraftSharksScheduleContext();

    expect(context).toMatchObject({
      status: 'disabled',
      profiles: {},
    });
  });

  it('requires approved access configuration before fetching', async () => {
    process.env.ENABLE_DRAFTSHARKS_SOS = 'true';
    process.env.DRAFTSHARKS_API_KEY = '';
    process.env.DRAFTSHARKS_SOS_URL = '';

    const fetchMock = vi.fn();
    const context = await loadDraftSharksScheduleContext({ fetchImpl: fetchMock as unknown as typeof fetch });

    expect(context.status).toBe('missing_config');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes flexible partner SOS payload shapes', () => {
    const profiles = normalizeDraftSharksSosPayload({
      data: [
        {
          team_abbr: 'DEN',
          pos: 'RB',
          sos_score: 82,
          tier: 'elite',
          streamer_weeks: '6, 7',
          avoid_weeks: [10],
          updated_at: '2026-05-15T12:00:00.000Z',
        },
        {
          nflTeam: 'SEA',
          fantasyPosition: 'WR',
          score: 31,
          difficulty: 'hard',
          hardWeeks: '8|11',
        },
      ],
    });

    expect(profiles['DEN:RB']).toMatchObject({
      seasonSOS: 82,
      scheduleTier: 'elite',
      streamerWeeks: [6, 7],
      avoidWeeks: [10],
    });
    expect(profiles['SEA:WR']).toMatchObject({
      seasonSOS: 31,
      scheduleTier: 'hard',
      avoidWeeks: [8, 11],
    });
  });

  it('fetches the configured endpoint without logging secrets', async () => {
    process.env.ENABLE_DRAFTSHARKS_SOS = 'true';
    process.env.DRAFTSHARKS_API_KEY = 'test-key';
    process.env.DRAFTSHARKS_SOS_URL = 'https://partner.example.test/sos';

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(url).toBe('https://partner.example.test/sos?season=2026');
      expect(headers['x-api-key']).toBe('test-key');
      return new Response(JSON.stringify({
        rows: [{
          team: 'KC',
          position: 'QB',
          seasonSOS: 64,
          scheduleTier: 'easy',
          targetWeeks: [5, 9],
        }],
      }), { status: 200 });
    });

    const context = await loadDraftSharksScheduleContext({
      season: '2026',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(context.status).toBe('loaded');
    expect(getDraftSharksScheduleProfile(context, 'KC', 'QB')).toMatchObject({
      seasonSOS: 64,
      scheduleTier: 'easy',
      streamerWeeks: [5, 9],
    });

    const telemetry = getApiProviderTelemetrySnapshot();
    expect(telemetry.byProvider[0]).toMatchObject({
      label: 'DraftSharks',
      networkCalls: 1,
      failures: 0,
    });
    expect(JSON.stringify(telemetry)).not.toContain('test-key');
    expect(JSON.stringify(telemetry)).not.toContain('partner.example.test');
  });

  it('loads SOS context from stored snapshots without approved-access fetch config', async () => {
    process.env.ENABLE_DRAFTSHARKS_SOS = 'true';
    process.env.DRAFTSHARKS_API_KEY = '';
    process.env.DRAFTSHARKS_SOS_URL = '';

    const fetchMock = vi.fn();
    vi.spyOn(db, 'findLatestProviderDataSnapshot').mockResolvedValue({
      snapshotKey: '2026-05-15',
      updatedAt: new Date('2026-05-15T12:00:00Z'),
      payload: JSON.stringify({
        schemaVersion: 1,
        generatedAt: '2026-05-15T12:00:00Z',
        snapshotKey: '2026-05-15',
        context: {
          status: 'loaded',
          source: 'DraftSharks SOS',
          updatedAt: '2026-05-15T12:00:00Z',
          profiles: {
            'KC:QB': {
              team: 'KC',
              position: 'QB',
              seasonSOS: 64,
              scheduleTier: 'easy',
              streamerWeeks: [5, 9],
              avoidWeeks: [],
              source: 'DraftSharks SOS',
              updatedAt: '2026-05-15T12:00:00Z',
            },
          },
        },
      }),
    });

    const context = await loadDraftSharksScheduleContext({
      fetchImpl: fetchMock as unknown as typeof fetch,
      sourceMode: 'snapshot',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(context.status).toBe('loaded');
    expect(getDraftSharksScheduleProfile(context, 'KC', 'QB')).toMatchObject({
      seasonSOS: 64,
      scheduleTier: 'easy',
    });
  });
});
