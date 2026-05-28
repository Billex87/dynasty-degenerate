import { HomePortfolioPanel } from "@/features/home/components/HomePortfolioPanel";

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

export { HomePortfolioPanel };

export { LeaguePickerCard } from "@/features/home/components/LeaguePickerCard";
export { HomePortfolioLeagueStack } from "@/features/home/components/HomePortfolioLeagueStack";
