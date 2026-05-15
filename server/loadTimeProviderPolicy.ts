import { recordApiProviderTelemetryEvent } from './apiProviderTelemetry';

export type UserLoadSnapshotOptions = {
  sourceMode: "snapshot";
};

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
    .replace(/\/\d{8,24}(?=\/|$)/g, '/:id')
    .replace(/\/[a-f0-9-]{20,}(?=\/|$)/gi, '/:id');
  return `${url.hostname}${path}`;
}

export async function fetchUserLoadResponse(
  url: string,
  context = "user load",
  init?: RequestInit
): Promise<Response> {
  assertUserLoadAllowedLiveProviderUrl(url, context);
  const startedAt = Date.now();
  const endpoint = getSanitizedUserLoadEndpoint(url);

  try {
    const response = await fetch(url, init);
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
