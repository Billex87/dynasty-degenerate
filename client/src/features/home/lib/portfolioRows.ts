import type { HomePortfolioLeague, HomePortfolioRow } from "@/features/home/components/HomeLeagueSelection";

export type PortfolioLeaguePlayer = {
  playerId: string;
  name: string;
  position: string | null;
  team: string | null;
  value: number;
  positionRank: string | null;
  rosterSpot: "active" | "taxi" | "reserve";
};

export function getHomePortfolioKey(player: PortfolioLeaguePlayer): string {
  return (
    player.playerId ||
    [
      normalizePortfolioSearchValue(player.name),
      normalizePortfolioSearchValue(player.position),
      normalizePortfolioSearchValue(player.team),
    ]
      .filter(Boolean)
      .join(":")
  );
}

export function buildHomePortfolioRows(
  leagues: Array<
    {
      leagueId: string;
      name: string;
      avatarUrl: string | null;
      format: string;
      mobileFormat: string;
      rosterPlayers?: PortfolioLeaguePlayer[];
    }
  >
): HomePortfolioRow[] {
  const grouped = new Map<string, HomePortfolioRow>();

  leagues.forEach(league => {
    const leaguePlayers = Array.isArray(league.rosterPlayers)
      ? league.rosterPlayers
      : [];
    const seenInLeague = new Set<string>();

    leaguePlayers.forEach(player => {
      const key = getHomePortfolioKey(player);
      if (!key || seenInLeague.has(key)) return;
      seenInLeague.add(key);

      const leagueMeta: HomePortfolioLeague = {
        leagueId: league.leagueId,
        name: league.name,
        avatarUrl: league.avatarUrl,
        format: league.format,
        mobileFormat: league.mobileFormat,
      };
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          id: key,
          playerId: player.playerId,
          name: player.name,
          position: player.position,
          team: player.team,
          value: player.value,
          positionRank: player.positionRank,
          leagueCount: 1,
          leagueShare: leagues.length ? 1 / leagues.length : 0,
          rosterSpots: [player.rosterSpot],
          leagues: [leagueMeta],
        });
        return;
      }

      existing.leagueCount += 1;
      existing.leagueShare = leagues.length
        ? existing.leagueCount / leagues.length
        : 0;
      existing.leagues.push(leagueMeta);
      existing.rosterSpots.push(player.rosterSpot);
      if (player.value > existing.value) existing.value = player.value;
      if (!existing.positionRank && player.positionRank) {
        existing.positionRank = player.positionRank;
      }
      if (!existing.team && player.team) existing.team = player.team;
      if (!existing.position && player.position) existing.position = player.position;
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.leagueCount !== a.leagueCount) return b.leagueCount - a.leagueCount;
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name);
  });
}

export function filterHomePortfolioRows(
  rows: HomePortfolioRow[],
  query: string
): HomePortfolioRow[] {
  const normalizedQuery = normalizePortfolioSearchValue(query);
  if (!normalizedQuery) return rows;
  return rows.filter(row => {
    const haystack = [
      row.name,
      row.team,
      row.position,
      row.positionRank,
      ...row.leagues.map(league => league.name),
      ...row.leagues.map(league => league.format),
    ]
      .map(normalizePortfolioSearchValue)
      .join(" ");
    return haystack.includes(normalizedQuery);
  });
}

export function normalizePortfolioLeaguePlayer(
  value: unknown
): PortfolioLeaguePlayer | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    typeof (value as { playerId?: unknown }).playerId !== "string" ||
    typeof (value as { name?: unknown }).name !== "string"
  ) {
    return null;
  }

  const rosterSpot =
    (value as { rosterSpot?: string }).rosterSpot === "taxi" ||
    (value as { rosterSpot?: string }).rosterSpot === "reserve"
      ? ((value as { rosterSpot?: string }).rosterSpot as
          | "taxi"
          | "reserve")
      : "active";

  const valueScore =
    typeof (value as { value?: unknown }).value === "number" &&
    Number.isFinite((value as { value?: unknown }).value as number)
      ? ((value as { value: number }).value)
      : 0;

  return {
    playerId: String((value as { playerId: string }).playerId),
    name: String((value as { name: string }).name),
    position:
      typeof (value as { position?: unknown }).position === "string"
        ? ((value as { position: string | null }).position)
        : null,
    team:
      typeof (value as { team?: unknown }).team === "string"
        ? ((value as { team: string | null }).team)
        : null,
    value: valueScore,
    positionRank:
      typeof (value as { positionRank?: unknown }).positionRank === "string"
        ? ((value as { positionRank: string | null }).positionRank)
        : null,
    rosterSpot,
  };
}

function normalizePortfolioSearchValue(value?: string | number | null): string {
  return String(value || "").trim().toLowerCase();
}
