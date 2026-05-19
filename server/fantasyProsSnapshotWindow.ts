const SLEEPER_NFL_STATE_URL = 'https://api.sleeper.app/v1/state/nfl';
const DEFAULT_TIMEOUT_MS = 3500;

function clampWeek(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(18, Math.floor(parsed)));
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberField(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function recordField(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function getFantasyProsSnapshotWeekFromSleeperState(input: {
  state: unknown;
  season: string;
  fallbackWeek?: number;
}): number {
  const fallbackWeek = clampWeek(input.fallbackWeek, 1);
  const state = recordField(input.state);
  if (!state) return fallbackWeek;

  const stateSeason = stringField(state.season);
  if (stateSeason && stateSeason !== String(input.season)) return fallbackWeek;

  return clampWeek(
    numberField(state.week)
      ?? numberField(state.leg)
      ?? numberField(state.display_week),
    fallbackWeek,
  );
}

export async function resolveFantasyProsSnapshotStartWeek(input: {
  season: string;
  fallbackWeek?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  stateUrl?: string;
}): Promise<number> {
  const fallbackWeek = clampWeek(input.fallbackWeek, 1);
  const fetchImpl = input.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, Math.min(10000, input.timeoutMs || DEFAULT_TIMEOUT_MS)));

  try {
    const response = await fetchImpl(input.stateUrl || SLEEPER_NFL_STATE_URL, { signal: controller.signal });
    if (!response.ok) return fallbackWeek;
    return getFantasyProsSnapshotWeekFromSleeperState({
      state: await response.json(),
      season: input.season,
      fallbackWeek,
    });
  } catch {
    return fallbackWeek;
  } finally {
    clearTimeout(timeout);
  }
}
