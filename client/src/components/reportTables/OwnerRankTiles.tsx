import type { ReportData } from "@shared/types";

type LeagueOverviewRow = ReportData["leagueOverview"][number];

export function FullRosterRankTiles({
  overviewRow,
}: {
  overviewRow: LeagueOverviewRow;
}) {
  const tiles = [
    {
      key: "QB",
      label: "QB",
      rank: overviewRow.rank_qb,
      className: "owner-intel-heat-position-qb",
    },
    {
      key: "RB",
      label: "RB",
      rank: overviewRow.rank_rb,
      className: "owner-intel-heat-position-rb",
    },
    {
      key: "WR",
      label: "WR",
      rank: overviewRow.rank_wr,
      className: "owner-intel-heat-position-wr",
    },
    {
      key: "TE",
      label: "TE",
      rank: overviewRow.rank_te,
      className: "owner-intel-heat-position-te",
    },
    {
      key: "VALUE",
      label: "Value",
      rank: overviewRow.rank_value,
      className: "owner-intel-heat-position-value",
    },
  ];

  return (
    <div className="owner-intel-full-rank-panel">
      <h4>Full Roster Rankings</h4>
      <div className="owner-intel-heat-grid owner-intel-full-rank-grid">
        {tiles.map(tile => (
          <span
            key={tile.key}
            className={`owner-intel-heat-pill owner-intel-full-rank-tile ${tile.className}`}
          >
            <strong>{tile.label}</strong>
            <em>#{tile.rank}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

type StartingRosterRankPosition = "QB_SF" | "RB" | "WR" | "TE" | "K" | "DEF";
type StartingRosterPlayer = NonNullable<
  ReportData["managerPositionCounts"][number]["starterPlayers"]
>[number];

const STARTING_ROSTER_RANK_POSITIONS: StartingRosterRankPosition[] = [
  "QB_SF",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
];

function getStartingRosterRankLabel(position: StartingRosterRankPosition) {
  if (position === "QB_SF") return "QB/SF";
  return position;
}

function getStartingRosterRankClass(position: StartingRosterRankPosition) {
  if (position === "QB_SF") return "owner-intel-heat-position-qb";
  return `owner-intel-heat-position-${position.toLowerCase()}`;
}

function shouldShowStartingRosterRankPosition(
  rows: ReportData["managerPositionCounts"],
  position: StartingRosterRankPosition
): boolean {
  if (position !== "K" && position !== "DEF") return true;
  return rows.some(row =>
    getStartingRosterPlayers(row).some(player => player.pos === position)
  );
}

function getStartingRosterSeasonValue(
  player: Pick<StartingRosterPlayer, "seasonValue" | "value">
): number {
  const value = Number(player.seasonValue ?? player.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getStartingRosterPlayers(
  row?: ReportData["managerPositionCounts"][number] | null
): StartingRosterPlayer[] {
  const players = row?.starterPlayers?.length
    ? row.starterPlayers
    : row?.starterGroups?.flatMap(group => group.players || []) || [];
  const uniquePlayers = new Map<string, StartingRosterPlayer>();

  players.forEach((player, index) => {
    const key = player.player_id || `${player.name}-${player.pos}-${index}`;
    if (!uniquePlayers.has(key)) uniquePlayers.set(key, player);
  });

  return Array.from(uniquePlayers.values());
}

function getStartingRosterPositionScore(
  row: ReportData["managerPositionCounts"][number] | null | undefined,
  position: StartingRosterRankPosition
): number {
  const playerPosition = position === "QB_SF" ? "QB" : position;
  return getStartingRosterPlayers(row)
    .filter(player => player.pos === playerPosition)
    .reduce((sum, player) => sum + getStartingRosterSeasonValue(player), 0);
}

function getRankFromDescendingScores(
  score: number,
  scores: number[]
): number | null {
  if (!Number.isFinite(score) || score <= 0) return null;
  return (
    scores.filter(value => Number.isFinite(value) && value > score).length + 1
  );
}

export function StartingRosterRankTiles({
  manager,
  managerPositionCounts,
}: {
  manager: string;
  managerPositionCounts: ReportData["managerPositionCounts"];
}) {
  const selectedRow = managerPositionCounts.find(
    row => row.manager === manager
  );
  if (!selectedRow) return null;

  const tiles = STARTING_ROSTER_RANK_POSITIONS.filter(position =>
    shouldShowStartingRosterRankPosition(managerPositionCounts, position)
  ).map(position => {
    const score = getStartingRosterPositionScore(selectedRow, position);
    const scores = managerPositionCounts.map(row =>
      getStartingRosterPositionScore(row, position)
    );

    return {
      key: position,
      label: getStartingRosterRankLabel(position),
      rank: getRankFromDescendingScores(score, scores),
      className: getStartingRosterRankClass(position),
    };
  });

  return (
    <div className="owner-intel-full-rank-panel manager-command-starting-rank-panel">
      <h4>Projected Starter Position Ranks</h4>
      <div className="owner-intel-heat-grid owner-intel-full-rank-grid">
        {tiles.map(tile => (
          <span
            key={tile.key}
            className={`owner-intel-heat-pill owner-intel-full-rank-tile ${tile.className}`}
          >
            <strong>{tile.label}</strong>
            <em>{tile.rank ? `#${tile.rank}` : "-"}</em>
          </span>
        ))}
      </div>
    </div>
  );
}
