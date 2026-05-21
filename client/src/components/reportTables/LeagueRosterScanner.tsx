import React, { useState } from "react";
import { filterCompletedFuturePickPortfolios } from "@shared/pickPortfolioFilters";
import type { ManagerIntelPlayer, ReportData } from "@shared/types";
import { PlayerDetailModal, type PlayerModalData } from "../PlayerDetailModal";
import { normalizeLeagueValueMode } from "@/lib/leagueValueMode";
import { getLeagueRosterScannerProfileLabel } from "@/lib/managerProfileLabels";
import { sortRowsByViewerAndStanding } from "@/lib/managerOrdering";
import {
  formatCompactValue,
  type ManagerAvatars,
  type PlayerDetailsById,
} from "./shared";
import {
  TradeWarAssetLabel,
  TradeWarManagerAvatar,
  buildTradeWarMetrics,
  buildTradeWarModalData,
  buildTradeWarPickRankMap,
  buildTradeWarRankMaps,
  getTradeWarAssetRank,
  getTradeWarAssetValue,
  getTradeWarModeLabel,
  getTradeWarPositionBuckets,
  getTradeWarRankNumber,
  getTradeWarRankTone,
  getTradeWarSectionClass,
  isTradeWarPickAsset,
  type TradeWarAsset,
  type TradeWarMode,
} from "./TradeWarRoom";

type OwnerIntelRow = NonNullable<
  ReportData["managerRosterIntelligence"]
>[number];

function buildLeagueScannerAssets({
  data,
  draftPicks,
  leagueValueMode,
  mode,
  pickPortfolios,
}: {
  data?: ReportData["managerRosterIntelligence"];
  draftPicks?: ReportData["draftPicks"];
  leagueValueMode: ReportData["leagueValueMode"];
  mode: TradeWarMode;
  pickPortfolios?: ReportData["pickPortfolios"];
}) {
  const visiblePickPortfolios = filterCompletedFuturePickPortfolios(
    pickPortfolios || [],
    draftPicks || []
  );
  const mapped = new Map<string, TradeWarAsset>();

  (data || []).forEach(row => {
    const addPlayers = (
      players: ManagerIntelPlayer[] | undefined,
      assetState: TradeWarAsset["assetState"]
    ) => {
      (players || []).forEach(player => {
        if (!player?.player_id || mapped.has(player.player_id)) return;
        mapped.set(player.player_id, {
          ...player,
          manager: player.owner || row.manager,
          assetState,
        });
      });
    };
    addPlayers(row.rosterPlayers, "roster");
    addPlayers(row.benchPlayers, "bench");
    addPlayers(row.reservePlayers, "reserve");
    addPlayers(row.taxiPlayers, "taxi");
  });

  if (leagueValueMode === "dynasty") {
    visiblePickPortfolios.forEach(portfolio => {
      (portfolio.futurePicks || []).forEach(pick => {
        const assetId = `pick:${pick.id}`;
        if (mapped.has(assetId)) return;
        mapped.set(assetId, {
          player_id: assetId,
          name: pick.label,
          pos: "PICK",
          owner: pick.manager,
          value: pick.value,
          seasonValue: pick.value,
          currentPositionRank: `${pick.season} R${pick.round}`,
          manager: pick.manager,
          assetState: "pick",
          assetKind: "pick",
          pickLabel: pick.label,
          pickSeason: pick.season,
          pickRound: pick.round,
          originalOwner: pick.originalOwner,
        });
      });
    });
  }

  return Array.from(mapped.values()).sort(
    (a, b) => getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
  );
}

export function LeagueRosterScanner({
  data,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
  leagueOverview,
  powerRankings,
  dynastyTimelines,
  pickPortfolios,
  draftPicks,
  viewerManager,
  currentStandings,
  leagueValueMode: leagueValueModeInput = "dynasty",
  focusKey = 0,
}: {
  data?: ReportData["managerRosterIntelligence"];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
  leagueOverview?: ReportData["leagueOverview"];
  powerRankings?: ReportData["powerRankings"];
  dynastyTimelines?: ReportData["dynastyTimelines"];
  pickPortfolios?: ReportData["pickPortfolios"];
  draftPicks?: ReportData["draftPicks"];
  viewerManager?: string | null;
  currentStandings?: ReportData["currentStandings"];
  leagueValueMode?: ReportData["leagueValueMode"];
  focusKey?: number;
}) {
  const leagueValueMode = normalizeLeagueValueMode(leagueValueModeInput);
  const tradeWarModeOptions: TradeWarMode[] =
    leagueValueMode === "redraft"
      ? [
          "starter-upgrade",
          "depth-fix",
          "positional-need",
          "playoff-push",
          "waiver-leverage",
        ]
      : ["dynasty", "contender", "rebuilder"];
  const [mode, setMode] = useState<TradeWarMode>(tradeWarModeOptions[0]);
  const [openInventoryManagers, setOpenInventoryManagers] = useState<
    Set<string>
  >(new Set());
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(
    null
  );

  React.useEffect(() => {
    if (!tradeWarModeOptions.includes(mode)) {
      setMode(tradeWarModeOptions[0]);
    }
  }, [mode, tradeWarModeOptions]);

  React.useEffect(() => {
    if (!focusKey) return;
    window.setTimeout(() => {
      document
        .getElementById("league-roster-scanner")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [focusKey]);

  const managers = React.useMemo(
    () =>
      sortRowsByViewerAndStanding(data || [], row => row.manager, {
        viewerManager,
        standings: currentStandings,
        leagueOverview,
      }).map(row => row.manager),
    [currentStandings, data, leagueOverview, viewerManager]
  );
  const managerRows = React.useMemo(
    () => new Map((data || []).map(row => [row.manager, row] as const)),
    [data]
  );
  const allAssets = React.useMemo(
    () =>
      buildLeagueScannerAssets({
        data,
        draftPicks,
        leagueValueMode,
        mode,
        pickPortfolios,
      }),
    [data, draftPicks, leagueValueMode, mode, pickPortfolios]
  );
  const assetsByManager = React.useMemo(() => {
    const grouped = new Map<string, TradeWarAsset[]>();
    allAssets.forEach(asset => {
      const existing = grouped.get(asset.manager) || [];
      existing.push(asset);
      grouped.set(asset.manager, existing);
    });
    return grouped;
  }, [allAssets]);
  const baselineMetricsByManager = React.useMemo(() => {
    const mapped = new Map<string, ReturnType<typeof buildTradeWarMetrics>>();
    assetsByManager.forEach((assets, manager) => {
      mapped.set(manager, buildTradeWarMetrics(assets, mode));
    });
    return mapped;
  }, [assetsByManager, mode]);
  const baselineRankMaps = React.useMemo(
    () => buildTradeWarRankMaps(baselineMetricsByManager),
    [baselineMetricsByManager]
  );
  const pickRankByManager = React.useMemo(
    () => buildTradeWarPickRankMap(managers, assetsByManager),
    [assetsByManager, managers]
  );
  const leagueOverviewByManager = React.useMemo(
    () => new Map((leagueOverview || []).map(row => [row.manager, row] as const)),
    [leagueOverview]
  );
  const powerByManager = React.useMemo(
    () => new Map((powerRankings || []).map(row => [row.manager, row] as const)),
    [powerRankings]
  );
  const timelineByManager = React.useMemo(
    () => new Map((dynastyTimelines || []).map(row => [row.manager, row] as const)),
    [dynastyTimelines]
  );
  const pickPortfolioByManager = React.useMemo(
    () => new Map((pickPortfolios || []).map(row => [row.manager, row] as const)),
    [pickPortfolios]
  );
  const overallAssetRankById = React.useMemo(
    () =>
      new Map(
        [...allAssets]
          .sort(
            (a, b) =>
              getTradeWarAssetValue(b, mode) - getTradeWarAssetValue(a, mode)
          )
          .map((asset, index) => [asset.player_id, index + 1] as const)
      ),
    [allAssets, mode]
  );

  const openAssetModal = (asset: TradeWarAsset) => {
    if (isTradeWarPickAsset(asset)) return;
    setSelectedPlayer(
      buildTradeWarModalData({
        asset,
        playerDetailsById,
        managerAvatars,
        value: getTradeWarAssetValue(asset, mode),
        mode,
      })
    );
  };

  if (!data?.length) return null;

  return (
    <div
      id="league-roster-scanner"
      className="trade-war-manager-board trade-war-manager-rank-inventory"
    >
      <div className="trade-war-manager-board-head">
        <div>
          <span>Manager Rank Inventory</span>
          <strong>League roster scanner</strong>
        </div>
        <div
          className="trade-war-mode-tabs"
          role="tablist"
          aria-label="Roster scanner value view"
        >
          {tradeWarModeOptions.map(option => (
            <button
              key={option}
              type="button"
              className={mode === option ? "active" : ""}
              onClick={() => setMode(option)}
            >
              {getTradeWarModeLabel(option)}
            </button>
          ))}
        </div>
      </div>
      <div className="trade-war-manager-board-grid">
        {managers.map(manager => {
          const assets = assetsByManager.get(manager) || [];
          const buckets = getTradeWarPositionBuckets(assets);
          const ranks = baselineRankMaps.get(manager);
          const powerRow = powerByManager.get(manager);
          const timelineRow = timelineByManager.get(manager);
          const managerRow = managerRows.get(manager) as OwnerIntelRow | undefined;
          const overviewRow = leagueOverviewByManager.get(manager);
          const pickRow = pickPortfolioByManager.get(manager);
          const standing = currentStandings?.find(row => row.manager === manager);
          const pickRank = pickRankByManager.get(manager);
          const isOpen = openInventoryManagers.has(manager);
          const scannerProfileLane =
            mode === "contender"
              ? "contender"
              : mode === "rebuilder"
                ? "rebuilder"
                : "dynasty";
          const managerProfile = getLeagueRosterScannerProfileLabel(
            powerRow?.tier,
            powerRow?.score,
            {
              powerRow,
              timelineRow,
              managerRow,
              overviewRow,
              leagueSize: managers.length,
            },
            scannerProfileLane
          );
          const totalValue = assets.reduce(
            (sum, asset) => sum + getTradeWarAssetValue(asset, mode),
            0
          );
          const pickValue = buckets.PICK.reduce(
            (sum, asset) => sum + getTradeWarAssetValue(asset, mode),
            0
          );
          const sectionRows = [
            ["QB", buckets.QB],
            ["RB", buckets.RB],
            ["WR", buckets.WR],
            ["TE", buckets.TE],
            ["PICKS", buckets.PICK],
          ] as const;
          const lensRankPills = [
            { key: "dynasty", label: "Dynasty", rank: ranks?.Value },
            { key: "contender", label: "Contender", rank: ranks?.Contender },
            { key: "rebuilder", label: "Rebuilder", rank: ranks?.Rebuild },
          ] as const;

          return (
            <details
              key={manager}
              open={isOpen}
              onToggle={event => {
                const nextOpen = event.currentTarget.open;
                setOpenInventoryManagers(current => {
                  const next = new Set(current);
                  if (nextOpen) {
                    next.add(manager);
                  } else {
                    next.delete(manager);
                  }
                  return next;
                });
              }}
              className="trade-war-manager-board-card"
            >
              <summary>
                <span className="trade-war-manager-board-rank">
                  {powerRow ? `#${powerRow.rank}` : "-"}
                </span>
                <span className="trade-war-manager-board-lockup">
                  <TradeWarManagerAvatar
                    manager={manager}
                    managerAvatars={managerAvatars}
                    className="trade-war-owner-avatar"
                  />
                  <span className="trade-war-manager-board-profile">
                    <strong>{manager}</strong>
                    <span className="trade-war-manager-board-profile-meta">
                      <em
                        className={`trade-war-manager-tier-pill trade-war-manager-tier-${managerProfile.tone}`}
                      >
                        {managerProfile.label}
                      </em>
                      <em>{formatCompactValue(totalValue)}</em>
                    </span>
                  </span>
                </span>
                <span className="trade-war-manager-board-summary-stats">
                  <span
                    className="trade-war-manager-board-bars"
                    aria-label={`${manager} position ranks`}
                  >
                    {(["QB", "RB", "WR", "TE", "PICK"] as const).map(key => (
                      <i
                        key={key}
                        className={`trade-war-bar-${key.toLowerCase()}`}
                      >
                        <small>{key === "PICK" ? "Picks" : key}</small>
                        #{key === "PICK" ? pickRank || "-" : ranks?.[key] || "-"}
                      </i>
                    ))}
                  </span>
                  <span
                    className="trade-war-manager-summary-lens-ranks trade-war-manager-lens-ranks"
                    aria-label={`${manager} roster value ranks`}
                  >
                    {lensRankPills.map(pill => (
                      <span
                        key={pill.key}
                        className={`trade-war-manager-lens-pill trade-war-manager-lens-pill-${pill.key}`}
                      >
                        <em>{pill.label}</em>
                        <strong>#{pill.rank || "-"}</strong>
                      </span>
                    ))}
                  </span>
                </span>
              </summary>
              <div className="trade-war-manager-board-meta">
                <span>Power {powerRow?.score ?? "-"}</span>
                <span>Value #{overviewRow?.rank_value ?? "-"}</span>
                <span>
                  Record{" "}
                  {standing
                    ? `${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ""}`
                    : "-"}
                </span>
                {leagueValueMode === "dynasty" && (
                  <span>
                    Picks {formatCompactValue(pickValue || pickRow?.totalValue || 0)}
                  </span>
                )}
                {lensRankPills.map(pill => (
                  <span
                    key={pill.key}
                    className={`trade-war-manager-lens-pill trade-war-manager-lens-pill-${pill.key} trade-war-manager-detail-lens-pill`}
                  >
                    <em>{pill.label}</em>
                    <strong>#{pill.rank || "-"}</strong>
                  </span>
                ))}
              </div>
              {isOpen && (
                <div className="trade-war-manager-board-sections">
                  {sectionRows.map(([label, rows]) => {
                    const sectionClass = getTradeWarSectionClass(label);
                    const sectionValue = rows.reduce(
                      (sum, asset) => sum + getTradeWarAssetValue(asset, mode),
                      0
                    );

                    return (
                      <div
                        key={label}
                        className={`trade-war-manager-board-section trade-war-manager-board-section-${sectionClass}`}
                      >
                        <div className="trade-war-manager-board-section-head">
                          <strong>
                            {label === "PICKS" ? "Pick Value" : `${label} Value`}
                          </strong>
                          <span>{formatCompactValue(sectionValue)}</span>
                        </div>
                        <div className="trade-war-manager-board-rank-head">
                          <span>Asset</span>
                          <span>Ovr</span>
                          <span>{label === "PICKS" ? "Rnd" : "Pos"}</span>
                        </div>
                        {rows.length ? (
                          rows
                            .sort(
                              (a, b) =>
                                getTradeWarAssetValue(b, mode) -
                                getTradeWarAssetValue(a, mode)
                            )
                            .map(asset => {
                              const assetRank = getTradeWarAssetRank(asset, mode);
                              const positionRank = getTradeWarRankNumber(assetRank);
                              const overallRank = overallAssetRankById.get(
                                asset.player_id
                              );
                              const rankTone = isTradeWarPickAsset(asset)
                                ? "pick"
                                : getTradeWarRankTone(assetRank);

                              return (
                                <button
                                  key={asset.player_id}
                                  type="button"
                                  className={`trade-war-manager-board-asset trade-war-manager-board-asset-${sectionClass}`}
                                  onClick={() => openAssetModal(asset)}
                                >
                                  <div className="trade-war-manager-board-player">
                                    <TradeWarAssetLabel asset={asset} />
                                  </div>
                                  <span
                                    className="trade-war-manager-board-overall-rank"
                                    title="Overall asset rank"
                                  >
                                    {overallRank || "-"}
                                  </span>
                                  <span
                                    className={`trade-war-manager-board-position-rank trade-war-manager-board-position-rank-${rankTone}`}
                                    title={
                                      isTradeWarPickAsset(asset)
                                        ? "Pick round"
                                        : "Position rank"
                                    }
                                  >
                                    {isTradeWarPickAsset(asset)
                                      ? `R${asset.pickRound || "-"}`
                                      : positionRank || "-"}
                                  </span>
                                </button>
                              );
                            })
                        ) : (
                          <p>No returned assets.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </details>
          );
        })}
      </div>

      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
        playerDetailsById={playerDetailsById}
      />
    </div>
  );
}

export default LeagueRosterScanner;
