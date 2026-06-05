import { describe, expect, it, vi } from 'vitest';
import {
  FOOTBALL_DATA_PROVIDER_PROBES,
  runFootballDataProviderProbe,
} from './footballDataProviderProbe';

describe('football data provider probe', () => {
  it('does not call provider endpoints when required credentials are missing', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const probe = FOOTBALL_DATA_PROVIDER_PROBES.find((row) => row.id === 'sportsdataio-players')!;

    const result = await runFootballDataProviderProbe(probe, {
      env: {},
      fetchImpl,
    });

    expect(result.status).toBe('missing_config');
    expect(result.credentialConfigured).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('summarizes JSON payload shape without exposing payload data', async () => {
    const probe = FOOTBALL_DATA_PROVIDER_PROBES.find((row) => row.id === 'sportsdataio-teams')!;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([
      { TeamID: 1, Key: 'ARI', FullName: 'Arizona Cardinals', Secret: 'not returned' },
    ]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const result = await runFootballDataProviderProbe(probe, {
      env: { SPORTSDATAIO_API_KEY: 'test-key' },
      fetchImpl,
    });

    expect(result).toMatchObject({
      status: 'reachable',
      httpStatus: 200,
      rows: 1,
      shape: 'array',
      credentialConfigured: true,
    });
    expect(JSON.stringify(result)).not.toContain('not returned');
    expect(result.coverage).toEqual(expect.arrayContaining(['TeamID', 'Key', 'FullName']));
  });

  it('keeps route-volume probes docs-only until licensed endpoint access is known', () => {
    const routeProbe = FOOTBALL_DATA_PROVIDER_PROBES.find((row) => row.id === 'sportsdataio-route-usage-candidate');

    expect(routeProbe).toMatchObject({
      provider: 'SportsDataIO docs',
      category: 'usage-route-fields',
      normalReportLoadAllowed: false,
      credentialEnv: [],
    });
  });
});
