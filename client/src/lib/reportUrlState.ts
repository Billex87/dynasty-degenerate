export function getUrlSearchParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export function readCsvParam(name: string): string[] {
  const rawValue = getUrlSearchParam(name);
  if (!rawValue) return [];
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function readEnumParam<T extends string>(name: string, allowedValues: readonly T[], fallback: T): T {
  const rawValue = getUrlSearchParam(name);
  return allowedValues.includes(rawValue as T) ? (rawValue as T) : fallback;
}

export function readOptionalEnumParam<T extends string>(name: string, allowedValues: readonly T[]): T | null {
  const rawValue = getUrlSearchParam(name);
  return allowedValues.includes(rawValue as T) ? (rawValue as T) : null;
}

export function readNumberParam(name: string): number | null {
  const rawValue = getUrlSearchParam(name);
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readBooleanParam(name: string): boolean {
  return getUrlSearchParam(name) === '1';
}

export function replaceUrlSearchParams(
  updates: Record<string, string | number | boolean | null | undefined>,
  options: { onlyForHash?: string } = {},
) {
  if (typeof window === 'undefined') return;
  if (options.onlyForHash && window.location.hash !== options.onlyForHash) return;

  const nextUrl = new URL(window.location.href);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '' || value === false) {
      nextUrl.searchParams.delete(key);
      return;
    }
    nextUrl.searchParams.set(key, String(value));
  });

  const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextPath !== currentPath) {
    window.history.replaceState({}, '', nextPath);
  }
}
