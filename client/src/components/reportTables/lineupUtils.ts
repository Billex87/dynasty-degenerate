type LineupGroupBase = {
  key?: string;
  label?: string;
};

type LineupPlayer = {
  player_id?: string;
  name?: string;
  pos?: string;
};

type LineupPlayerGroup<T extends LineupPlayer> = LineupGroupBase & {
  count?: number;
  players: T[];
};

export function getLineupDisplayOrder(group: LineupGroupBase): number {
  const key = String(group.key || group.label || "").toUpperCase();
  if (key.includes("QB_SF") || key.includes("QB/SF") || key === "QB") return 0;
  if (key === "RB" || key.startsWith("RB ")) return 1;
  if (key === "WR" || key.startsWith("WR ")) return 2;
  if (key === "TE" || key.startsWith("TE ")) return 3;
  if (key === "FLEX" || key.startsWith("FLEX")) return 4;
  if (key === "K" || key.startsWith("K ")) return 5;
  if (key === "DEF" || key.startsWith("DEF")) return 6;
  return 99;
}

export function sortLineupGroupsForDisplay<T extends LineupGroupBase>(groups: T[]): T[] {
  return [...groups].sort(
    (a, b) =>
      getLineupDisplayOrder(a) - getLineupDisplayOrder(b) ||
      String(a.label || "").localeCompare(String(b.label || ""))
  );
}

export function isQuarterbackLineupGroup(group: LineupGroupBase) {
  const key = String(group.key || group.label || "").toUpperCase();
  return key === "QB" || key.startsWith("QB ") || key.includes("QB_SF") || key.includes("QB/SF");
}

export function getSwapFitLabel(label?: string | null): string {
  const normalized = String(label || "").trim();
  if (/QB\/SF|QB_SF/i.test(normalized)) return "QB/SF";
  if (/FLEX/i.test(normalized)) return "Flex";
  if (/DEF/i.test(normalized)) return "DEF";
  if (/\bK\b/i.test(normalized)) return "K";
  if (/\bTE\b/i.test(normalized)) return "TE";
  if (/\bWR\b/i.test(normalized)) return "WR";
  if (/\bRB\b/i.test(normalized)) return "RB";
  if (/\bQB\b/i.test(normalized)) return "QB";
  return normalized || "Lineup";
}

export function combineSuperflexQuarterbackGroups<
  T extends LineupPlayerGroup<LineupPlayer>,
>(groups: T[]): T[] {
  const quarterbackGroups = groups.filter(isQuarterbackLineupGroup);
  if (quarterbackGroups.length <= 1) return groups;

  const usedPlayers = new Set<string>();
  const combinedPlayers = quarterbackGroups.flatMap(group => group.players || [])
    .filter(player => {
      const key = player.player_id || `${player.name}-${player.pos}`;
      if (usedPlayers.has(key)) return false;
      usedPlayers.add(key);
      return true;
    });
  const combinedCount =
    quarterbackGroups.reduce(
      (sum, group) => sum + (group.count || group.players.length || 0),
      0
    ) || combinedPlayers.length;
  const combined = {
    ...quarterbackGroups[0],
    key: "QB_SF",
    label: `QB/SF x${combinedCount}`,
    count: combinedCount,
    players: combinedPlayers,
  } as T;

  return sortLineupGroupsForDisplay([
    combined,
    ...groups.filter(group => !isQuarterbackLineupGroup(group)),
  ]);
}
