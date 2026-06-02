import { HomePortfolioRow } from "@/features/home/components/HomePortfolioRow";
import { type HomePortfolioRow as HomePortfolioRowData } from "@/features/home/components/HomeLeagueSelection";

export function HomePortfolioList({
  isLoading,
  rows,
  filteredRows,
  totalLeagues,
  hasActiveFilters,
  onResetFilters,
}: {
  isLoading: boolean;
  rows: HomePortfolioRowData[];
  filteredRows: HomePortfolioRowData[];
  totalLeagues: number;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
}) {
  if (isLoading && !rows.length) {
    return (
      <div className="home-portfolio-empty">Loading the player hoard...</div>
    );
  }

  if (!rows.length) {
    return (
      <div className="home-portfolio-empty">
        Player Hoard unlocks after your Sleeper league roster history loads.
      </div>
    );
  }

  if (!filteredRows.length) {
    return (
      <div className="home-portfolio-empty">
        <span>No roster edges match those filters.</span>
        {hasActiveFilters && onResetFilters ? (
          <button type="button" onClick={onResetFilters}>
            Reset filters
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="home-portfolio-list" aria-live="polite">
      {filteredRows.slice(0, 60).map(row => (
        <HomePortfolioRow
          key={row.id}
          row={row}
          totalLeagues={totalLeagues}
        />
      ))}
    </div>
  );
}
