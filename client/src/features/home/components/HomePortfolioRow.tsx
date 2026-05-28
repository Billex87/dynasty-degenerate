import { PlayerIdentityRow } from "@/components/reportPrimitives";
import { HomePortfolioLeagueStack } from "@/features/home/components/HomePortfolioLeagueStack";
import type { HomePortfolioRow } from "@/features/home/components/HomeLeagueSelection";

function formatHomePortfolioValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`;
  return Math.round(value).toLocaleString();
}

export function HomePortfolioRow({
  row,
  totalLeagues,
}: {
  row: HomePortfolioRow;
  totalLeagues: number;
}) {
  return (
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
          {row.leagueCount}/{totalLeagues}
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
  );
}

