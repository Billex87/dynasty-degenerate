import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { X as XIcon } from "lucide-react";
import { formatCompactValue } from "./shared";
import {
  getManagerHeadingClassName,
  IntelligenceMetric,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./shared";
import { getPillToneClass, titleCasePill } from "./ownerIntelTags";
import { getBalancedGridStyle } from "../../lib/balancedGrid";
import { TileRippleGrid } from "@/lib/motion";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { ManagerDepthTile } from "./OwnerIntelDepthComponents";
import { PlayerInsightTile } from "./OwnerIntelPlayerTile";
import { ChampionAvatarFrame, ManagerChampionshipPills } from "../ManagerChampionships";
import type { ManagerIntelPlayer, ReportData } from "@shared/types";

type ManagerIntelligenceCardsProps = {
  data?: ReportData["managerRosterIntelligence"];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
};

type InsightTileConfig = {
  label: string;
  player: ManagerIntelPlayer | null | undefined;
  tone?: "warn" | "danger";
  crownedRank?: string | null;
  topAsset?: boolean;
};

export function ManagerIntelligenceCards({
  data,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
}: ManagerIntelligenceCardsProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  if (!data?.length) return null;
  const selectedRow = selectedManager
    ? data.find(row => row.manager === selectedManager)
    : null;
  const selectedInsightTiles: InsightTileConfig[] = selectedRow
    ? [
        { label: "Bench Stash", player: selectedRow.bestBenchStash },
        { label: "Upgrade Spot", player: selectedRow.weakestStarter, tone: "warn" as const },
        { label: "Age Risk", player: selectedRow.oldestPlayer, tone: "danger" as const },
        { label: "Young Core", player: selectedRow.youngCorePlayer, topAsset: true },
        { label: "Upside Play", player: selectedRow.breakoutCandidate },
        { label: "Buy Target", player: selectedRow.buyTarget },
        { label: "Sell Candidate", player: selectedRow.sellCandidate, tone: "warn" as const },
        { label: "Trade Chip", player: selectedRow.tradeChip },
        { label: "Insurance", player: selectedRow.injuryInsurance },
        {
          label: selectedRow.lastSeasonStud?.lastSeasonYear
            ? `${selectedRow.lastSeasonStud.lastSeasonYear} Stud`
            : "Previous Stud",
          player: selectedRow.lastSeasonStud,
          crownedRank: selectedRow.lastSeasonStud?.lastSeasonPositionRank || null,
          topAsset: Boolean(selectedRow.lastSeasonStud?.lastSeasonPositionRank),
        },
      ]
    : [];
  const selectedInsightPlayerCount = selectedInsightTiles.filter(item => item.player).length;

  return (
    <>
      <div
        className="command-depth-grid balanced-tile-grid"
        style={getBalancedGridStyle(data.length)}
      >
        {data.map(row => (
          <ManagerDepthTile
            key={row.manager}
            manager={row.manager}
            avatarUrl={managerAvatars?.[row.manager]}
            badges={[
              {
                label: titleCasePill(row.identity),
                tone: getPillToneClass(row.identity).includes("good")
                  ? "good"
                  : "neutral",
              },
              {
                label: `${Math.round(row.starterValuePct)}% starters`,
                tone:
                  row.starterValuePct >= 58
                    ? "good"
                    : row.starterValuePct <= 45
                      ? "warn"
                      : "neutral",
              },
              ...(row.avgAge !== null
                ? [
                    {
                      label: `${row.avgAge} avg age`,
                      tone:
                        row.avgAge >= 27.5
                          ? ("warn" as const)
                          : row.avgAge <= 25
                            ? ("future" as const)
                            : ("good" as const),
                    },
                  ]
                : []),
              {
                label: titleCasePill(row.timeline),
                tone: getPillToneClass(row.timeline).includes("future")
                  ? "future"
                  : getPillToneClass(row.timeline).includes("danger")
                    ? "danger"
                    : "good",
              },
              ...row.ageFlags.slice(0, 2).map(flag => ({
                label: titleCasePill(flag),
                tone:
                  flag.toLowerCase().includes("old") ||
                  flag.toLowerCase().includes("aging") ||
                  flag.toLowerCase().includes("risk")
                    ? ("danger" as const)
                    : ("future" as const),
              })),
              ...(row.starterAvailability.avgGamesMissed !== null
                ? [
                    {
                      label: `${row.starterAvailability.avgGamesMissed} missed/gm`,
                      tone:
                        row.starterAvailability.riskLevel === "high"
                          ? ("danger" as const)
                          : row.starterAvailability.riskLevel === "medium"
                            ? ("warn" as const)
                            : ("good" as const),
                    },
                  ]
                : []),
            ]}
            onClick={() => setSelectedManager(row.manager)}
          />
        ))}
      </div>

      <Dialog
        open={selectedRow !== null}
        onOpenChange={open => !open && setSelectedManager(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="manager-command-dialog max-w-4xl border-cyan-300/20 bg-slate-950 p-0 text-slate-100"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {selectedRow?.manager || "Manager"} Identity Timeline
            </DialogTitle>
            <DialogDescription>
              Roster identity, age curve, depth signals, and key players.
            </DialogDescription>
          </DialogHeader>
          {selectedRow && (
            <div className="manager-command-modal-inner">
              <div className="manager-command-hero">
                {managerAvatars?.[selectedRow.manager] && (
                  <>
                    <img
                      src={managerAvatars[selectedRow.manager] || ""}
                      alt=""
                      className="manager-hero-wash"
                    />
                    <img
                      src={managerAvatars[selectedRow.manager] || ""}
                      alt=""
                      className="manager-hero-watermark"
                    />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <button
                  type="button"
                  className="manager-modal-close"
                  onClick={() => setSelectedManager(null)}
                  aria-label={`Close ${selectedRow.manager} details`}
                >
                  <XIcon aria-hidden="true" />
                </button>
                <div className="manager-command-title-lockup">
                  <ChampionAvatarFrame
                    managerName={selectedRow.manager}
                    className="manager-command-champion-frame"
                  >
                    {managerAvatars?.[selectedRow.manager] ? (
                      <img
                        src={managerAvatars[selectedRow.manager] || ""}
                        alt={selectedRow.manager}
                        className="manager-command-avatar"
                      />
                    ) : (
                      <span className="manager-command-avatar">
                        {selectedRow.manager[0]?.toUpperCase() || "?"}
                      </span>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p>Team Identity</p>
                    <h3
                      className={getManagerHeadingClassName(
                        selectedRow.manager
                      )}
                    >
                      {selectedRow.manager}
                    </h3>
                    <ManagerChampionshipPills
                      managerName={selectedRow.manager}
                      className="manager-command-championships"
                    />
                  </div>
                </div>
                <div className="manager-command-hero-metrics">
                  <IntelligenceMetric
                    label="Starters"
                    value={formatCompactValue(selectedRow.starterValue)}
                  />
                  <IntelligenceMetric
                    label="Bench"
                    value={formatCompactValue(selectedRow.benchValue)}
                  />
                  <IntelligenceMetric
                    label="Starter Share"
                    value={`${Math.round(selectedRow.starterValuePct)}%`}
                  />
                </div>
              </div>

              <div className="manager-command-body">
                <div
                  className="manager-command-tag-row"
                  aria-label="Manager identity tags"
                >
                  {[
                    selectedRow.identity,
                    selectedRow.timeline,
                    ...selectedRow.ageFlags,
                    selectedRow.holes.summary,
                  ]
                    .filter(Boolean)
                    .slice(0, 6)
                    .map(tag => (
                      <span
                        key={tag}
                        className={`manager-intel-pill report-pill-shell report-inline-pill ${getPillToneClass(tag)}`}
                      >
                        {titleCasePill(tag)}
                      </span>
                    ))}
                </div>

                <div className="manager-command-rank-summary">
                  <div>
                    <span>Avg Age</span>
                    <strong>{selectedRow.avgAge ?? "-"}</strong>
                  </div>
                  <div>
                    <span>QB Age</span>
                    <strong>{selectedRow.avgAgeByPosition.QB ?? "-"}</strong>
                  </div>
                  <div>
                    <span>RB Age</span>
                    <strong>{selectedRow.avgAgeByPosition.RB ?? "-"}</strong>
                  </div>
                  <div>
                    <span>WR Age</span>
                    <strong>{selectedRow.avgAgeByPosition.WR ?? "-"}</strong>
                  </div>
                  <div>
                    <span>TE Age</span>
                    <strong>{selectedRow.avgAgeByPosition.TE ?? "-"}</strong>
                  </div>
                </div>

                <div className="manager-command-grid">
                  <div className="manager-command-section">
                    <h4>Key Players</h4>
                    <TileRippleGrid
                      className="manager-intel-player-grid balanced-tile-grid"
                      style={getBalancedGridStyle(selectedInsightPlayerCount)}
                    >
                      {({ getTileMotionProps }) => (
                        <>
                          {selectedInsightTiles.filter(item => item.player).map((item, index) => (
                            <PlayerInsightTile
                              key={item.label}
                              label={item.label}
                              player={item.player}
                              manager={selectedRow.manager}
                              managerAvatarUrl={managerAvatars?.[selectedRow.manager]}
                              playerDetailsById={playerDetailsById}
                              onSelect={setSelectedPlayer}
                              tone={item.tone}
                              crownedRank={item.crownedRank}
                              motionProps={getTileMotionProps(index, {
                                topAsset: item.topAsset,
                              })}
                            />
                          ))}
                        </>
                      )}
                    </TileRippleGrid>
                  </div>

                  <div className="manager-command-section manager-command-read">
                    <h4>Roster Read</h4>
                    <p>{selectedRow.strategySummary || selectedRow.summary}</p>
                    <div className="manager-command-inline-read">
                      <h4>Attack Points</h4>
                      <p>
                        QB: {selectedRow.holes.bestQbRank || "-"} · RB2:{" "}
                        {selectedRow.holes.rb2Rank || "-"} · WR3:{" "}
                        {selectedRow.holes.wr3Rank || "-"} · TE1:{" "}
                        {selectedRow.holes.te1Rank || "-"} · Flex depth:{" "}
                        {selectedRow.holes.flexDepth}
                      </p>
                    </div>
                    <div className="manager-command-inline-read">
                      <h4>Availability</h4>
                      <p>
                        {selectedRow.starterAvailability.avgGamesMissed !== null
                          ? `${selectedRow.starterAvailability.riskLevel.toUpperCase()} risk. Starters averaged ${selectedRow.starterAvailability.avgGamesMissed} missed games last season${selectedRow.starterAvailability.riskiestStarter ? `; ${selectedRow.starterAvailability.riskiestStarter.name} is the biggest availability flag` : ""}.`
                          : "Availability sample is not deep enough yet."}
                      </p>
                    </div>
                    <div className="manager-command-inline-read">
                      <h4>Tradeable Depth</h4>
                      <p>
                        {selectedRow.tradeableDepth?.length
                          ? selectedRow.tradeableDepth
                              .map(tile =>
                                tile.player
                                  ? `${tile.position}: ${tile.player.name} (${tile.player.seasonPositionRank || tile.player.currentPositionRank || tile.position})`
                                  : null
                              )
                              .filter(Boolean)
                              .join(" · ") ||
                              "No clean non-starting trade chip on this roster."
                          : (["QB", "RB", "WR", "TE"] as const)
                              .map(pos =>
                                selectedRow.similarValuePlayers[pos]
                                  ? `${pos}: ${selectedRow.similarValuePlayers[pos]?.name} (${selectedRow.similarValuePlayers[pos]?.currentPositionRank || pos})`
                                  : null
                              )
                              .filter(Boolean)
                              .join(" · ") ||
                            "No clean non-starting trade chip on this roster."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={playerDetailsById}
      />
    </>
  );
}
