import { Search } from "lucide-react";
import { PlayerIdentityRow } from "@/components/reportPrimitives";

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

function getLeagueFallbackInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "DD";
}

function getLeagueCardNameClassName(name: string): string {
  const length = name.trim().length;
  if (length >= 30) return "home-league-card-name home-league-card-name-xxlong";
  if (length >= 23) return "home-league-card-name home-league-card-name-xlong";
  if (length >= 17) return "home-league-card-name home-league-card-name-long";
  return "home-league-card-name";
}

function getLeagueCardFormatClassName(format: string): string {
  const length = format.trim().length;
  if (length >= 31)
    return "home-league-card-format home-league-card-format-xlong";
  if (length >= 24)
    return "home-league-card-format home-league-card-format-long";
  return "home-league-card-format";
}

function getLeagueInfoDisplay(format: string): string {
  return format
    .replace(/\b(\d+)-Team\b/gi, "$1 Team")
    .replace(/\s+/g, " ")
    .trim();
}

function formatHomePortfolioValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`;
  return Math.round(value).toLocaleString();
}

export function LeaguePickerCard({
  league,
  onSelect,
  disabled = false,
}: {
  league: HomeLeagueSelectionLeague;
  onSelect: (leagueId: string) => void;
  disabled?: boolean;
}) {
  const desktopFormat =
    league.format || `${league.totalRosters || "?"}-Team Dynasty`;
  const mobileFormat = league.mobileFormat || desktopFormat;
  const desktopLeagueInfo = getLeagueInfoDisplay(desktopFormat);
  const mobileLeagueInfo = getLeagueInfoDisplay(mobileFormat);
  const hasRankInfo = Boolean(league.powerRank || league.standingsRank);

  return (
    <button
      type="button"
      className={`home-league-card${disabled ? " home-league-card-disabled" : ""}`}
      aria-label={`${league.name} ${desktopFormat}`}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onSelect(league.leagueId);
      }}
    >
      {league.avatarUrl ? (
        <img
          src={league.avatarUrl}
          alt=""
          aria-hidden="true"
          className="home-league-card-watermark"
        />
      ) : null}
      <div className="home-league-card-top">
        <span className="home-league-card-icon-wrap">
          {league.avatarUrl ? (
            <img
              src={league.avatarUrl}
              alt={`${league.name} icon`}
              className="home-league-card-icon"
            />
          ) : (
            <span className="home-league-card-icon home-league-card-fallback">
              {league.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>
        <span
          className={getLeagueCardNameClassName(league.name)}
          aria-label={league.name}
          title={league.name}
        >
          {league.name}
        </span>
      </div>

      <span className="home-league-card-meta">
        {hasRankInfo ? (
          <span
            className="home-league-card-ranks"
            aria-label={`${league.name} current league standing and power rank`}
          >
            {league.powerRank ? (
              <span className="home-league-pill home-league-pill-power">
                Power #{league.powerRank}
              </span>
            ) : null}
            {league.standingsRank ? (
              <span className="home-league-pill home-league-pill-standings">
                Standings #{league.standingsRank}
              </span>
            ) : null}
          </span>
        ) : (
          disabled ? (
            <span className="home-league-card-loading-intel">
              Syncing managers
            </span>
          ) : (
            <>
              <span
                className={`${getLeagueCardFormatClassName(desktopLeagueInfo)} home-league-card-format-desktop`}
                title={desktopLeagueInfo}
              >
                {desktopLeagueInfo}
              </span>
              <span
                className={`${getLeagueCardFormatClassName(mobileLeagueInfo)} home-league-card-format-mobile`}
                title={mobileLeagueInfo}
              >
                {mobileLeagueInfo}
              </span>
            </>
          )
        )}
      </span>
    </button>
  );
}

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
            filteredRows.slice(0, 60).map(row => (
              <article key={row.id} className="home-portfolio-row">
                <div className="home-portfolio-player">
                  <PlayerIdentityRow
                    playerId={row.playerId}
                    playerName={row.name}
                    team={row.team}
                    position={row.position}
                    hideMeta
                  />
                  <span className="home-portfolio-meta">
                    {row.team || "FA"} · {row.position || "N/A"}
                    {row.positionRank ? ` · ${row.positionRank}` : ""}
                  </span>
                </div>
                <div className="home-portfolio-exposure">
                  <strong>
                    {row.leagueCount}/{leagues.length}
                  </strong>
                  <span>{Math.round(row.leagueShare * 100)}% exposure</span>
                </div>
                <HomePortfolioLeagueStack leagues={row.leagues} />
                <div className="home-portfolio-value">
                  <strong>{formatHomePortfolioValue(row.value)}</strong>
                  <span>
                    {row.rosterSpots.includes("taxi")
                      ? "Taxi stash"
                      : row.rosterSpots.includes("reserve")
                        ? "IR/Reserve"
                        : "Active roster"}
                  </span>
                </div>
              </article>
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
