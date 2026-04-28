import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DraftPick } from '@shared/types';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { PlayerDetailModal } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';

interface ManagerDraftPicksModalProps {
  isOpen: boolean;
  onClose: () => void;
  managerName: string;
  draftPicks: DraftPick[];
}

export function ManagerDraftPicksModal({
  isOpen,
  onClose,
  managerName,
  draftPicks,
}: ManagerDraftPicksModalProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPick | null>(null);

  // Filter picks for this manager
  const managerPicks = draftPicks.filter(pick => pick.manager === managerName);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[80vh] bg-slate-900 border-slate-800 overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-orange-400">
              {managerName}'s Draft Picks
            </DialogTitle>
          </DialogHeader>

          <div className="w-full overflow-x-hidden">
            <Table
              className="w-full text-xs sm:text-sm"
              containerClassName="overflow-x-hidden"
              style={{ tableLayout: 'fixed' }}
            >
              <TableHeader className="border-b-2 border-orange-500/30">
                <TableRow className="border-slate-700">
                  <TableHead className="w-[38%] text-white font-semibold">Player</TableHead>
                  <TableHead className="w-[12%] text-right text-white font-semibold">
                    <div>Drafted</div>
                    <div>Rank</div>
                  </TableHead>
                  <TableHead className="w-[12%] text-right text-white font-semibold">
                    <div>Current</div>
                    <div>Rank</div>
                  </TableHead>
                  <TableHead className="w-[14%] text-right text-white font-semibold">
                    <div>Position</div>
                    <div>Change</div>
                  </TableHead>
                  <TableHead className="w-[12%] text-right text-white font-semibold">
                    <div>Current</div>
                    <div>Value</div>
                  </TableHead>
                  <TableHead className="w-[12%] text-right text-white font-semibold">
                    <div>Value</div>
                    <div>Change</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managerPicks.map((pick, idx) => (
                  <TableRow 
                    key={idx} 
                    className="border-slate-700 hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => setSelectedPlayer(pick)}
                  >
                    <TableCell className="min-w-0 font-semibold text-slate-100">
                      <div className="min-w-0">
                        <PlayerNameWithHeadshot playerId={pick.player_id} playerName={pick.playerName} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {pick.positionRankMay2025 ? (
                        <span className="font-semibold text-slate-300">
                          {pick.positionRankMay2025}
                        </span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {pick.currentPositionRank ? (
                        <span className="font-semibold text-slate-300">
                          {pick.currentPositionRank}
                        </span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {pick.positionRankChange ? (
                        <span
                          className={`font-semibold ${
                            pick.positionRankChange.startsWith('+')
                              ? 'text-green-400'
                              : pick.positionRankChange.startsWith('-')
                                ? 'text-red-400'
                                : 'text-slate-300'
                          }`}
                        >
                          {pick.positionRankChange}
                          {pick.positionRankChange.startsWith('+') && (
                            <TrendingUp className="inline ml-1 w-4 h-4" />
                          )}
                          {pick.positionRankChange.startsWith('-') && (
                            <TrendingDown className="inline ml-1 w-4 h-4" />
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {pick.currentKtcValue ? (
                        <span className="font-semibold text-slate-300">
                          {pick.currentKtcValue.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {pick.valueGain !== null && pick.valueGain !== undefined ? (
                        <span
                          className={`font-semibold ${
                            pick.valueGain > 0
                              ? 'text-green-400'
                              : pick.valueGain < 0
                                ? 'text-red-400'
                                : 'text-slate-300'
                          }`}
                        >
                          {pick.valueGain > 0 ? '+' : ''}
                          {pick.valueGain.toLocaleString()}
                          {pick.valueGain > 0 && (
                            <TrendingUp className="inline ml-1 w-4 h-4" />
                          )}
                          {pick.valueGain < 0 && (
                            <TrendingDown className="inline ml-1 w-4 h-4" />
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {managerPicks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-400">No draft picks found for {managerName}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Player Detail Modal */}
      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
      />
    </>
  );
}
