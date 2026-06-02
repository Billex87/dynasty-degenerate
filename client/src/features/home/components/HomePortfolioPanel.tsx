import { Search } from "lucide-react";
import { LeaguePickerCard } from "@/features/home/components/LeaguePickerCard";
import { HomePortfolioList } from "@/features/home/components/HomePortfolioList";
import type {
  HomeLeagueSelectionLeague,
  HomePortfolioRow,
} from "@/features/home/components/HomeLeagueSelection";
import type { HomePortfolioExposureFilter } from "@/features/home/lib/portfolioRows";

const EXPOSURE_FILTERS: Array<{
  value: HomePortfolioExposureFilter;
  label: string;
}> = [
  { value: "all", label: "All Players" },
  { value: "overlap", label: "Overlap" },
  { value: "single", label: "Single League" },
];

export function HomePortfolioPanel({
  rows,
  filteredRows,
  leagues,
  isLoading,
  query,
  exposureFilter,
  selectedLeagueId,
  onQueryChange,
  onExposureFilterChange,
  onLeagueFilterChange,
  onLeagueSelect,
  showLeagueChooser = true,
  className = "",
}: {
  rows: HomePortfolioRow[];
  filteredRows: HomePortfolioRow[];
  leagues: HomeLeagueSelectionLeague[];
  isLoading: boolean;
  query: string;
  exposureFilter: HomePortfolioExposureFilter;
  selectedLeagueId: string;
  onQueryChange: (value: string) => void;
  onExposureFilterChange: (value: HomePortfolioExposureFilter) => void;
  onLeagueFilterChange: (value: string) => void;
  onLeagueSelect?: (leagueId: string) => void;
  showLeagueChooser?: boolean;
  className?: string;
}) {
  const duplicatedAssets = rows.filter(row => row.leagueCount > 1).length;
  const maxExposure = rows[0]?.leagueCount || 0;
  const selectedLeague = leagues.find(league => league.leagueId === selectedLeagueId);
  const resultLabel = selectedLeague
    ? `${filteredRows.length} shown in ${selectedLeague.name}`
    : `${filteredRows.length} of ${rows.length || 0} shown`;

  if (!leagues.length) return null;

  return (
    <section
      className={["home-portfolio-shell", className].filter(Boolean).join(" ")}
      aria-label="Sleeper roster portfolio"
    >
      <div className="home-portfolio-panel">
        <div className="home-portfolio-header">
          <div>
            <h3>Player Hoard</h3>
            <p>
              Every rostered player tied to this Sleeper username, exposed across every
              league.
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
            placeholder="Search players"
          />
        </label>

        <div className="home-portfolio-controls" aria-label="Portfolio filters">
          <div
            className="home-portfolio-filter-group"
            role="group"
            aria-label="Exposure filter"
          >
            {EXPOSURE_FILTERS.map(filter => (
              <button
                key={filter.value}
                type="button"
                className={
                  exposureFilter === filter.value
                    ? "home-portfolio-filter is-active"
                    : "home-portfolio-filter"
                }
                aria-pressed={exposureFilter === filter.value}
                onClick={() => onExposureFilterChange(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <label className="home-portfolio-select">
            <span>League</span>
            <select
              value={selectedLeagueId}
              onChange={event => onLeagueFilterChange(event.target.value)}
              aria-label="Filter portfolio by league"
            >
              <option value="all">All leagues</option>
              {leagues.map(league => (
                <option key={league.leagueId} value={league.leagueId}>
                  {league.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="home-portfolio-result-count" aria-live="polite">
          {resultLabel}
        </div>

        <HomePortfolioList
          isLoading={isLoading}
          rows={rows}
          filteredRows={filteredRows}
          totalLeagues={leagues.length}
        />
      </div>

      {showLeagueChooser && onLeagueSelect ? (
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
      ) : null}
    </section>
  );
}
