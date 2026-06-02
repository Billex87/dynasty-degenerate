import fs from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearApiProviderTelemetryForTests,
  getApiProviderTelemetrySnapshot,
  recordApiProviderTelemetryEvent,
} from './apiProviderTelemetry';
import { insertSourceHealthEvents } from './db';
import { saveLocalKtcSnapshot } from './ktcLoader';
import { recordSourceHealthEvents } from './sourceHealth';

vi.mock('./db', () => ({
  findKtcSnapshotOnOrBefore: vi.fn(),
  insertSourceHealthEvents: vi.fn(() => Promise.resolve(true)),
}));

describe('local diagnostics in serverless runtimes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    clearApiProviderTelemetryForTests();
  });

  it('keeps provider telemetry in memory without writing local files on Vercel', () => {
    vi.stubEnv('VERCEL', '1');
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync');
    const appendSpy = vi.spyOn(fs, 'appendFileSync');

    recordApiProviderTelemetryEvent({
      provider: 'FantasyPros',
      endpoint: '/NFL/2026/consensus-rankings',
      status: 200,
      ok: true,
      durationMs: 120,
      cacheStatus: 'miss',
      scope: 'cron',
    });

    expect(mkdirSpy).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();
    expect(getApiProviderTelemetrySnapshot().totals.calls).toBe(1);
  });

  it('skips local KTC snapshot writes on Vercel', () => {
    vi.stubEnv('VERCEL', '1');
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync');
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    const filePath = saveLocalKtcSnapshot(new Date('2026-06-01T12:00:00Z'), { values: {} });

    expect(filePath).toBeNull();
    expect(mkdirSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('persists source-health events without local JSONL writes on Vercel', async () => {
    vi.stubEnv('VERCEL', '1');
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync');
    const appendSpy = vi.spyOn(fs, 'appendFileSync');

    await recordSourceHealthEvents([{
      job: 'dynamic-data-refresh',
      sourceKey: 'fantasypros-weekly-ecr',
      source: 'FantasyPros',
      level: 'warn',
      status: 'stale',
      message: 'snapshot stale',
    }]);

    expect(mkdirSpy).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();
    expect(insertSourceHealthEvents).toHaveBeenCalledOnce();
  });
});
