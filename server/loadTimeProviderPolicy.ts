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

export async function fetchUserLoadJson<T = any>(url: string, context = "user load"): Promise<T> {
  assertUserLoadAllowedLiveProviderUrl(url, context);
  const response = await fetch(url);
  return await response.json() as T;
}
