export const MAX_AUTOCOMPLETE_HISTORY = 12;

export function readAutocompleteHistory(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map(value => value.trim())
      .filter(Boolean)
      .slice(0, MAX_AUTOCOMPLETE_HISTORY);
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

export function rememberAutocompleteValue(key: string, value: string): string[] {
  if (typeof window === "undefined") return [];
  const trimmed = value.trim();
  if (!trimmed) return readAutocompleteHistory(key);
  const current = readAutocompleteHistory(key);
  const next = [
    trimmed,
    ...current.filter(item => item.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_AUTOCOMPLETE_HISTORY);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Autocomplete history is a convenience only.
  }
  return next;
}

export function getFilteredAutocompleteOptions(
  history: string[],
  value: string
): string[] {
  const needle = value.trim().toLowerCase();
  return history
    .filter(item => !needle || item.toLowerCase().includes(needle))
    .slice(0, 6);
}

export function getLoadingSuccessTitleClassName(leagueName: string): string {
  const length = leagueName.trim().length;
  if (length >= 34)
    return "loading-success-title loading-success-title-compact";
  if (length >= 20) return "loading-success-title loading-success-title-long";
  return "loading-success-title";
}
