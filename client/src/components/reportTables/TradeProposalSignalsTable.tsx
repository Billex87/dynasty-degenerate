import { useMemo } from "react";
import type { TradeProposalSignal } from "@shared/types";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ManagerNameWithAvatar } from "../ManagerNameWithAvatar";
import { PlayerNameWithHeadshot } from "../PlayerNameWithHeadshot";
import { EmptyState } from "../reportPrimitives";
import {
  CommandMiniBadge,
  TradeProposalMorePill,
  type ManagerAvatars,
} from "./shared";
import {
  formatTradeProposalDate,
  formatTradeProposalStatus,
  getTradeProposalStatusTone,
} from "./proposalStatus";

export function TradeProposalSignalsTable({
  data,
  managerAvatars,
}: {
  data: TradeProposalSignal[];
  managerAvatars?: ManagerAvatars;
}) {
  const orderedSignals = useMemo(
    () => [...data].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
    [data]
  );

  if (!orderedSignals.length) {
    return (
      <EmptyState
        className="trade-empty-state"
        title="No non-complete trades found"
        description="Sleeper did not return any pending, declined, rejected, or cancelled trade transactions for this league."
      />
    );
  }

  return (
    <Card className="trade-proposal-card overflow-hidden border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <Table className="trade-proposal-table report-table-polished min-w-[56rem]">
          <TableHeader className="border-b-2 border-cyan-500/20">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Date</TableHead>
              <TableHead className="text-white font-semibold">Status</TableHead>
              <TableHead className="text-white font-semibold">
                Managers
              </TableHead>
              <TableHead className="text-white font-semibold">Assets</TableHead>
              <TableHead className="text-white font-semibold">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedSignals.map(signal => {
              const statusTone = getTradeProposalStatusTone(signal.status);
              const visiblePlayers = signal.playerNames
                .slice(0, 2)
                .map((playerName, index) => ({
                  playerId: signal.playerIds[index],
                  playerName,
                }));
              const visiblePickLabels = (signal.pickLabels || []).slice(0, 2);
              const totalAssetCount =
                signal.playerNames.length + (signal.pickLabels || []).length;
              const assetSummary = [
                ...signal.playerNames,
                ...(signal.pickLabels || []),
              ].join(" · ");

              return (
                <TableRow
                  key={signal.id}
                  className={`trade-proposal-row trade-proposal-row-${statusTone}`}
                >
                  <TableCell className="align-top text-slate-200">
                    {formatTradeProposalDate(signal.date)}
                  </TableCell>
                  <TableCell className="align-top">
                    <CommandMiniBadge tone={statusTone}>
                      {formatTradeProposalStatus(signal.status)}
                    </CommandMiniBadge>
                  </TableCell>
                  <TableCell className="align-top">
                    <div
                      className="flex flex-wrap gap-2"
                      title={signal.managers.join(" · ") || "Unknown"}
                    >
                      {signal.managers.length ? (
                        <>
                          {signal.managers.slice(0, 3).map(manager => (
                            <ManagerNameWithAvatar
                              key={`${signal.id}-${manager}`}
                              avatarUrl={managerAvatars?.[manager]}
                              managerName={manager}
                            />
                          ))}
                          {signal.managers.length > 3 && (
                            <TradeProposalMorePill
                              count={signal.managers.length - 3}
                            />
                          )}
                        </>
                      ) : (
                        <span className="trade-proposal-empty">Unknown</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div
                      className="space-y-2"
                      title={assetSummary || "No asset labels returned"}
                    >
                      {visiblePlayers.length > 0 && (
                        <div className="trade-proposal-asset-group">
                          <span className="trade-proposal-asset-label">
                            Players
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {visiblePlayers.map(player => (
                              <PlayerNameWithHeadshot
                                key={`${signal.id}-${player.playerId || player.playerName}`}
                                playerId={player.playerId}
                                playerName={player.playerName}
                              />
                            ))}
                            {signal.playerNames.length >
                              visiblePlayers.length && (
                              <TradeProposalMorePill
                                count={
                                  signal.playerNames.length -
                                  visiblePlayers.length
                                }
                              />
                            )}
                          </div>
                        </div>
                      )}
                      {visiblePickLabels.length > 0 && (
                        <div className="trade-proposal-asset-group">
                          <span className="trade-proposal-asset-label">
                            Picks
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {visiblePickLabels.map(pickLabel => (
                              <CommandMiniBadge
                                key={`${signal.id}-${pickLabel}`}
                                className="trade-proposal-pick-pill"
                              >
                                {pickLabel}
                              </CommandMiniBadge>
                            ))}
                            {(signal.pickLabels || []).length >
                              visiblePickLabels.length && (
                              <TradeProposalMorePill
                                count={
                                  (signal.pickLabels || []).length -
                                  visiblePickLabels.length
                                }
                              />
                            )}
                          </div>
                        </div>
                      )}
                      {totalAssetCount === 0 && (
                        <span className="trade-proposal-empty">
                          No asset labels returned
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-slate-300">
                    {signal.note}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export default TradeProposalSignalsTable;
