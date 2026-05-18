import type { DraftPick, PickPortfolio } from "./types";

export function getCompletedFuturePickSeasons(
  draftPicks: DraftPick[] = []
): Set<string> {
  const seasons = new Set<string>();

  draftPicks.forEach(pick => {
    const season = String(pick.draftYear || "").trim();
    if (!season) return;
    if (pick.draftKind === "startup") return;
    if (!pick.player_id && !pick.playerName) return;

    seasons.add(season);
  });

  return seasons;
}

export function filterCompletedFuturePickPortfolios(
  pickPortfolios: PickPortfolio[] = [],
  draftPicks: DraftPick[] = []
): PickPortfolio[] {
  const completedSeasons = getCompletedFuturePickSeasons(draftPicks);
  if (!completedSeasons.size) return pickPortfolios;

  return pickPortfolios.map(portfolio => {
    const futurePicks = portfolio.futurePicks || [];
    const hiddenPicks = futurePicks.filter(pick =>
      completedSeasons.has(String(pick.season || ""))
    );

    if (!hiddenPicks.length) return portfolio;

    const visibleFuturePicks = futurePicks.filter(
      pick => !completedSeasons.has(String(pick.season || ""))
    );
    const hiddenValue = hiddenPicks.reduce((sum, pick) => sum + pick.value, 0);
    const hiddenOwnPicks = hiddenPicks.filter(
      pick => pick.originalOwner === pick.manager
    ).length;
    const hiddenAcquiredPicks = hiddenPicks.length - hiddenOwnPicks;
    const hiddenCountForYear = (year: string) =>
      hiddenPicks.filter(pick => String(pick.season || "") === year).length;
    const hiddenValueForYear = (year: string) =>
      hiddenPicks
        .filter(pick => String(pick.season || "") === year)
        .reduce((sum, pick) => sum + pick.value, 0);

    return {
      ...portfolio,
      value2025: Math.max(0, portfolio.value2025 - hiddenValueForYear("2025")),
      value2026: Math.max(0, portfolio.value2026 - hiddenValueForYear("2026")),
      value2027: Math.max(0, portfolio.value2027 - hiddenValueForYear("2027")),
      count2025: Math.max(0, portfolio.count2025 - hiddenCountForYear("2025")),
      count2026: Math.max(0, portfolio.count2026 - hiddenCountForYear("2026")),
      count2027: Math.max(0, portfolio.count2027 - hiddenCountForYear("2027")),
      totalValue: Math.max(0, portfolio.totalValue - hiddenValue),
      ownPicks: Math.max(0, portfolio.ownPicks - hiddenOwnPicks),
      acquiredPicks: Math.max(0, portfolio.acquiredPicks - hiddenAcquiredPicks),
      futurePicks: visibleFuturePicks,
    };
  });
}
