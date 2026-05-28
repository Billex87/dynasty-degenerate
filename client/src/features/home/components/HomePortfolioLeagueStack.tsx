import { getLeagueFallbackInitials } from "@/features/home/lib/leagueIdentity";
import type { HomePortfolioLeague } from "@/features/home/components/HomeLeagueSelection";

export function HomePortfolioLeagueStack({
  leagues,
}: {
  leagues: HomePortfolioLeague[];
}) {
  const visibleLeagues = leagues.slice(0, 6);
  const overflowCount = Math.max(0, leagues.length - visibleLeagues.length);

  return (
    <span
      className="home-portfolio-league-stack"
      aria-label={`${leagues.length} league${leagues.length === 1 ? "" : "s"}`}
    >
      {visibleLeagues.map((league, index) => (
        <span
          key={league.leagueId}
          className="home-portfolio-league-avatar"
          style={{ zIndex: visibleLeagues.length - index }}
          title={league.name}
        >
          {league.avatarUrl ? (
            <img src={league.avatarUrl} alt="" aria-hidden="true" />
          ) : (
            <span aria-hidden="true">{getLeagueFallbackInitials(league.name)}</span>
          )}
        </span>
      ))}
      {overflowCount > 0 ? (
        <span className="home-portfolio-league-more">+{overflowCount}</span>
      ) : null}
    </span>
  );
}

