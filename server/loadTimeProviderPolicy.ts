import { recordApiProviderTelemetryEvent } from './apiProviderTelemetry';

export type UserLoadSnapshotOptions = {
  sourceMode: "snapshot";
};

const SLEEPER_LEAGUE_ID_PATTERN = /^\d{8,24}$/;
const USER_LOAD_LIVE_HOSTS = new Set([
  "api.sleeper.app",
  "api.sleeper.com",
]);

const SNAPSHOT_OPTIONS: UserLoadSnapshotOptions = Object.freeze({
  sourceMode: "snapshot",
});

export function getUserLoadSnapshotOptions(): UserLoadSnapshotOptions {
  return SNAPSHOT_OPTIONS;
}

export function isUserLoadAllowedLiveProviderUrl(input: string | URL): boolean {
  try {
    const url = input instanceof URL ? input : new URL(input);
    return USER_LOAD_LIVE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function assertUserLoadAllowedLiveProviderUrl(input: string | URL, context = "user load"): void {
  if (isUserLoadAllowedLiveProviderUrl(input)) return;
  throw new Error(`Blocked non-Sleeper live provider call during ${context}: ${String(input)}`);
}

function getSanitizedUserLoadEndpoint(input: string | URL): string {
  const url = input instanceof URL ? input : new URL(input);
  const path = url.pathname
    .replace(/\/v1\/league\/[^/?#]+/g, '/v1/league/:id')
    .replace(/\/\d{8,24}(?=\/|$)/g, '/:id')
    .replace(/\/[a-f0-9-]{20,}(?=\/|$)/gi, '/:id');
  return `${url.hostname}${path}`;
}

function normalizeSleeperEntityId(value: string | null | undefined): string {
  const trimmed = String(value || '').trim();
  return SLEEPER_LEAGUE_ID_PATTERN.test(trimmed) ? trimmed : '';
}

function normalizeSleeperLeagueUrl(input: string): string | null {
  const match = input.match(/^(https?:\/\/api\.sleeper\.app\/v1\/league\/)([^/?#]+)(.*)$/i);
  if (!match) return input;
  const leagueId = normalizeSleeperEntityId(decodeURIComponent(match[2] || ''));
  if (!leagueId) return null;
  return `${match[1]}${encodeURIComponent(leagueId)}${match[3]}`;
}

function buildBlockedLeagueResponse(): Response {
  return new Response("null", {
    status: 400,
    headers: {
      "content-type": "application/json",
    },
  });
}

export async function fetchUserLoadResponse(
  url: string,
  context = "user load",
  init?: RequestInit
): Promise<Response> {
  assertUserLoadAllowedLiveProviderUrl(url, context);
  const normalizedUrl = normalizeSleeperLeagueUrl(url);
  if (normalizedUrl === null) {
    const endpoint = getSanitizedUserLoadEndpoint(url);
    const startedAt = Date.now();
    recordApiProviderTelemetryEvent({
      provider: 'Sleeper',
      endpoint,
      method: init?.method || 'GET',
      status: 400,
      ok: false,
      durationMs: Date.now() - startedAt,
      cacheStatus: 'miss',
      costUnits: 1,
      job: context,
      scope: 'user-load',
      message: 'Blocked invalid Sleeper league ID',
    });
    return buildBlockedLeagueResponse();
  }

  const startedAt = Date.now();
  const endpoint = getSanitizedUserLoadEndpoint(normalizedUrl);

  try {
    const response = await fetch(normalizedUrl, init);
    recordApiProviderTelemetryEvent({
      provider: 'Sleeper',
      endpoint,
      method: init?.method || 'GET',
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      cacheStatus: 'miss',
      costUnits: 1,
      job: context,
      scope: 'user-load',
      message: response.ok ? null : `Sleeper ${response.status}`,
    });
    return response;
  } catch (error) {
    recordApiProviderTelemetryEvent({
      provider: 'Sleeper',
      endpoint,
      method: init?.method || 'GET',
      status: null,
      ok: false,
      durationMs: Date.now() - startedAt,
      cacheStatus: 'miss',
      costUnits: 1,
      job: context,
      scope: 'user-load',
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function fetchUserLoadJson<T = any>(url: string, context = "user load", init?: RequestInit): Promise<T> {
  const response = await fetchUserLoadResponse(url, context, init);
  return await response.json() as T;
}
