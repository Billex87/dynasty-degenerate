import type { TaxiTriageItem } from "@shared/types";

export function normalizeReportManagerName(manager?: string | null): string {
  return manager?.trim().toLowerCase() || "";
}

export function getTaxiDisplayAction(action?: string | null) {
  if (action === "Cuttable") return "Cuts";
  return action || undefined;
}

export function getTaxiActionSortRank(action?: string | null) {
  switch (action) {
    case "Promote Now":
      return 0;
    case "Keep Parked":
      return 1;
    case "Trade Sweetener":
      return 2;
    case "Taxi Risk":
      return 3;
    case "Cuttable":
      return 4;
    default:
      return 5;
  }
}

export function sortTaxiTriageItems(items: TaxiTriageItem[]) {
  return [...items].sort((a, b) => {
    const actionRank =
      getTaxiActionSortRank(a.taxiAction) - getTaxiActionSortRank(b.taxiAction);
    if (actionRank) return actionRank;

    return (
      (b.taxiScore || 0) - (a.taxiScore || 0) ||
      (b.seasonValue || b.value || 0) - (a.seasonValue || a.value || 0) ||
      a.name.localeCompare(b.name)
    );
  });
}

export function normalizeIntelNote(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|with|for|and|or|to|of|in|if|it|is|this|that)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeIntelNotes(
  notes: Array<string | null | undefined>,
  suppress: Array<string | null | undefined> = []
) {
  const seen = new Set<string>();
  const suppressKeys = suppress
    .filter((note): note is string => Boolean(note))
    .map(normalizeIntelNote)
    .filter(Boolean);

  return notes
    .filter((note): note is string => Boolean(note))
    .filter(note => {
      const key = normalizeIntelNote(note);
      if (!key || seen.has(key)) return false;
      if (
        suppressKeys.some(
          suppressKey => suppressKey.includes(key) || key.includes(suppressKey)
        )
      )
        return false;
      seen.add(key);
      return true;
    });
}

export function normalizeIntelPlayerName(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function noteMentionsPlayerName(note: string, name: string): boolean {
  const normalizedName = normalizeIntelPlayerName(name);
  return (
    normalizedName.length >= 3 && note.toLowerCase().includes(normalizedName)
  );
}

export function filterByPlayerNameMentionBudget<T>(
  items: T[],
  getCopy: (item: T) => string,
  trackedNames: string[],
  seededCopies: string[] = [],
  maxMentions = 2
) {
  if (!trackedNames.length) return items;

  const counts = new Map<string, number>();
  seededCopies.forEach(copy => {
    trackedNames.forEach(name => {
      if (copy && noteMentionsPlayerName(copy, name)) {
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    });
  });

  return items.filter(item => {
    const copy = getCopy(item);
    const mentionedNames = trackedNames.filter(name =>
      noteMentionsPlayerName(copy, name)
    );
    if (mentionedNames.some(name => (counts.get(name) || 0) >= maxMentions))
      return false;
    mentionedNames.forEach(name =>
      counts.set(name, (counts.get(name) || 0) + 1)
    );
    return true;
  });
}
