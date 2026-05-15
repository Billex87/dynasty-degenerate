const SNAPSHOT_TIME_ZONE = 'America/Vancouver';

export function getProviderSnapshotDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SNAPSHOT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function parseProviderSnapshotPayload<T>(payload?: string | null): T | null {
  if (!payload) return null;
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}
