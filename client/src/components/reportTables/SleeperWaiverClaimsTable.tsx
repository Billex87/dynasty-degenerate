import { useMemo } from "react";
import type { SleeperWaiverClaimSignal } from "@shared/types";
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
import { CommandMiniBadge, type ManagerAvatars } from "./shared";
import {
  formatTradeProposalDate,
  formatTradeProposalStatus,
  formatWaiverBidAmount,
  getTradeProposalStatusTone,
} from "./proposalStatus";

export function SleeperWaiverClaimsTable({
  data,
  managerAvatars,
}: {
  data: SleeperWaiverClaimSignal[];
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
        title="No hidden waiver claims found"
        description="Sleeper did not return any pending, rejected, cancelled, or failed waiver transactions for this league."
      />
    );
  }

  return (
    <Card className="trade-proposal-card overflow-hidden border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <Table className="trade-proposal-table report-table-polished min-w-[64rem]">
          <TableHeader className="border-b-2 border-cyan-500/20">
            <TableRow className="border-slate-700">
              <TableHead className="text-white font-semibold">Date</TableHead>
              <TableHead className="text-white font-semibold">Status</TableHead>
              <TableHead className="text-white font-semibold">
                Managers
              </TableHead>
              <TableHead className="text-white font-semibold">Assets</TableHead>
              <TableHead className="text-white font-semibold">Bid</TableHead>
              <TableHead className="text-white font-semibold">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedSignals.map(signal => {
              const statusTone = getTradeProposalStatusTone(signal.status);
              const claimPlayers = signal.playerNames
                .slice(0, 2)
                .map((playerName, index) => ({
                  playerId: signal.playerIds[index],
                  playerName,
                }));
              const dropPlayers = (signal.dropPlayerNames || [])
                .slice(0, 2)
                .map((playerName, index) => ({
                  playerId: signal.dropPlayerIds?.[index],
                  playerName,
                }));
              const visibleAssets = [
                ...signal.playerNames,
                ...(signal.dropPlayerNames || []),
              ];
              const bidLabel = formatWaiverBidAmount(signal.bidAmount);

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
                            <span className="trade-proposal-more-pill">
                              +{signal.managers.length - 3} more
                            </span>
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
                      title={
                        visibleAssets.join(" · ") || "No claim assets returned"
                      }
                    >
                      {claimPlayers.length > 0 && (
                        <div className="trade-proposal-asset-group">
                          <span className="trade-proposal-asset-label">
                            Claim
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {claimPlayers.map(player => (
                              <PlayerNameWithHeadshot
                                key={`${signal.id}-claim-${player.playerId || player.playerName}`}
                                playerId={player.playerId}
                                playerName={player.playerName}
                              />
                            ))}
                            {signal.playerNames.length >
                              claimPlayers.length && (
                              <span className="trade-proposal-more-pill">
                                +
                                {signal.playerNames.length -
                                  claimPlayers.length}{" "}
                                more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {dropPlayers.length > 0 && (
                        <div className="trade-proposal-asset-group">
                          <span className="trade-proposal-asset-label">
                            Drops
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {dropPlayers.map(player => (
                              <PlayerNameWithHeadshot
                                key={`${signal.id}-drop-${player.playerId || player.playerName}`}
                                playerId={player.playerId}
                                playerName={player.playerName}
                              />
                            ))}
                            {(signal.dropPlayerNames || []).length >
                              dropPlayers.length && (
                              <span className="trade-proposal-more-pill">
                                +
                                {(signal.dropPlayerNames || []).length -
                                  dropPlayers.length}{" "}
                                more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {visibleAssets.length === 0 && (
                        <span className="trade-proposal-empty">
                          No claim assets returned
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <CommandMiniBadge tone={statusTone}>
                      {bidLabel}
                    </CommandMiniBadge>
                    {signal.waiverBudget != null && (
                      <div className="mt-1 text-xs text-slate-400">
                        Budget {signal.waiverBudget.toLocaleString()} FAAB
                      </div>
                    )}
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

export default SleeperWaiverClaimsTable;
