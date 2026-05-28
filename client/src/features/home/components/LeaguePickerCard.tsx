import { getLeagueFallbackInitials } from "@/features/home/lib/leagueIdentity";
import { type HomeLeagueSelectionLeague } from "@/features/home/components/HomeLeagueSelection";

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
              {getLeagueFallbackInitials(league.name)}
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
