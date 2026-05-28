import { Search } from "lucide-react";
import { HomePortfolioLeagueStack } from "@/features/home/components/HomePortfolioLeagueStack";
import { LeaguePickerCard } from "@/features/home/components/LeaguePickerCard";
import { HomePortfolioRow } from "@/features/home/components/HomePortfolioRow";

export type HomeLeagueSelectionLeague = {
  leagueId: string;
  name: string;
  avatarUrl: string | null;
  format: string;
  mobileFormat: string;
  totalRosters: number;
  standingsRank: number | null;
  powerRank: number | null;
};

export type HomePortfolioLeague = Pick<
  HomeLeagueSelectionLeague,
  "leagueId" | "name" | "avatarUrl" | "format" | "mobileFormat"
>;

export type HomePortfolioRow = {
  id: string;
  playerId?: string;
  name: string;
  position: string | null;
  team: string | null;
  value: number;
  positionRank: string | null;
  leagueCount: number;
  leagueShare: number;
  rosterSpots: Array<"active" | "taxi" | "reserve">;
  leagues: HomePortfolioLeague[];
};

export function HomePortfolioPanel({
  rows,
  filteredRows,
  leagues,
  isLoading,
  query,
  onQueryChange,
  onLeagueSelect,
}: {
  rows: HomePortfolioRow[];
  filteredRows: HomePortfolioRow[];
  leagues: HomeLeagueSelectionLeague[];
  isLoading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onLeagueSelect: (leagueId: string) => void;
}) {
  const duplicatedAssets = rows.filter(row => row.leagueCount > 1).length;
  const maxExposure = rows[0]?.leagueCount || 0;

  if (!leagues.length) return null;

  return (
    <section
      className="home-portfolio-shell"
      aria-label="Sleeper roster portfolio"
    >
      <div className="home-portfolio-panel">
        <div className="home-portfolio-header">
          <div>
            <h3>Player Hoard</h3>
            <p>
              Every rostered player tied to this Sleeper username, exposed
              across every league.
            </p>
          </div>
          <div className="home-portfolio-stats" aria-label="Portfolio summary">
            <span>
              <strong>{rows.length || "-"}</strong>
              <small>Players</small>
            </span>
            <span>
              <strong>{duplicatedAssets || "-"}</strong>
              <small>Overlap</small>
            </span>
            <span>
              <strong>{maxExposure || "-"}</strong>
              <small>Max Owned</small>
            </span>
          </div>
        </div>

        <label className="home-portfolio-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search portfolio players</span>
          <input
            type="search"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Search player, team, position, or league"
          />
        </label>

        <div className="home-portfolio-list" aria-live="polite">
          {isLoading && !rows.length ? (
            <div className="home-portfolio-empty">
              Loading the player hoard...
            </div>
          ) : filteredRows.length ? (
            filteredRows
              .slice(0, 60)
              .map(row => (
                <HomePortfolioRow
                  key={row.id}
                  row={row}
                  totalLeagues={leagues.length}
                />
              ))
          ) : (
            <div className="home-portfolio-empty">
              No roster edges match that search.
            </div>
          )}
        </div>
      </div>

      <aside className="home-league-chooser" aria-label="Choose your league">
        <div className="home-league-chooser-header">
          <h3>Pick The Target</h3>
          <p>Choose where the AI starts doing damage.</p>
        </div>
        <div className="home-league-picker home-league-picker-portfolio">
          {leagues.map(league => (
            <LeaguePickerCard
              key={league.leagueId}
              league={league}
              onSelect={onLeagueSelect}
            />
          ))}
        </div>
      </aside>
    </section>
  );
}

export { LeaguePickerCard } from "@/features/home/components/LeaguePickerCard";
export { HomePortfolioLeagueStack } from "@/features/home/components/HomePortfolioLeagueStack";
