import { useState, type CSSProperties } from 'react';
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

const NFL_TEAM_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  ARI: { primary: '#97233F', secondary: '#000000', accent: '#FFB612' },
  ATL: { primary: '#A71930', secondary: '#000000', accent: '#A5ACAF' },
  BAL: { primary: '#241773', secondary: '#000000', accent: '#9E7C0C' },
  BUF: { primary: '#00338D', secondary: '#C60C30', accent: '#FFFFFF' },
  CAR: { primary: '#0085CA', secondary: '#101820', accent: '#BFC0BF' },
  CHI: { primary: '#0B162A', secondary: '#C83803', accent: '#FFFFFF' },
  CIN: { primary: '#FB4F14', secondary: '#000000', accent: '#FFFFFF' },
  CLE: { primary: '#311D00', secondary: '#FF3C00', accent: '#FFFFFF' },
  DAL: { primary: '#003594', secondary: '#041E42', accent: '#869397' },
  DEN: { primary: '#FB4F14', secondary: '#002244', accent: '#FFFFFF' },
  DET: { primary: '#0076B6', secondary: '#B0B7BC', accent: '#000000' },
  GB: { primary: '#203731', secondary: '#FFB612', accent: '#FFFFFF' },
  HOU: { primary: '#03202F', secondary: '#A71930', accent: '#FFFFFF' },
  IND: { primary: '#002C5F', secondary: '#A2AAAD', accent: '#FFFFFF' },
  JAX: { primary: '#006778', secondary: '#101820', accent: '#D7A22A' },
  KC: { primary: '#E31837', secondary: '#FFB81C', accent: '#FFFFFF' },
  LAC: { primary: '#0080C6', secondary: '#FFC20E', accent: '#FFFFFF' },
  LAR: { primary: '#003594', secondary: '#FFA300', accent: '#FFFFFF' },
  LV: { primary: '#000000', secondary: '#A5ACAF', accent: '#FFFFFF' },
  MIA: { primary: '#008E97', secondary: '#FC4C02', accent: '#005778' },
  MIN: { primary: '#4F2683', secondary: '#FFC62F', accent: '#FFFFFF' },
  NE: { primary: '#002244', secondary: '#C60C30', accent: '#B0B7BC' },
  NO: { primary: '#101820', secondary: '#D3BC8D', accent: '#FFFFFF' },
  NYG: { primary: '#0B2265', secondary: '#A71930', accent: '#A5ACAF' },
  NYJ: { primary: '#125740', secondary: '#000000', accent: '#FFFFFF' },
  PHI: { primary: '#004C54', secondary: '#A5ACAF', accent: '#FFFFFF' },
  PIT: { primary: '#FFB612', secondary: '#101820', accent: '#C60C30' },
  SEA: { primary: '#002244', secondary: '#69BE28', accent: '#A5ACAF' },
  SF: { primary: '#AA0000', secondary: '#B3995D', accent: '#FFFFFF' },
  TB: { primary: '#D50A0A', secondary: '#34302B', accent: '#FF7900' },
  TEN: { primary: '#0C2340', secondary: '#4B92DB', accent: '#C8102E' },
  WAS: { primary: '#5A1414', secondary: '#FFB612', accent: '#FFFFFF' },
};

interface ManagerDraftPicksModalProps {
  isOpen: boolean;
  onClose: () => void;
  managerName: string;
  draftPicks: DraftPick[];
  managerAvatarUrl?: string | null;
  leagueId?: string;
  leagueLogo?: string | null;
}

export function ManagerDraftPicksModal({
  isOpen,
  onClose,
  managerName,
  draftPicks,
  managerAvatarUrl,
  leagueId,
  leagueLogo,
}: ManagerDraftPicksModalProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPick | null>(null);

  // Filter picks for this manager
  const managerPicks = draftPicks.filter(pick => pick.manager === managerName);
  const totalCurrentValue = managerPicks.reduce((sum, pick) => sum + (pick.currentKtcValue || 0), 0);
  const totalValueGain = managerPicks.reduce((sum, pick) => sum + (pick.valueGain || 0), 0);
  const managerInitial = managerName.trim()[0]?.toUpperCase() || '?';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="manager-draft-modal max-h-[86vh] max-w-[calc(100vw-1rem)] overflow-hidden border-cyan-300/20 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 sm:max-w-4xl">
          <div className="max-h-[86vh] overflow-y-auto overflow-x-hidden">
            <div className="manager-draft-hero relative overflow-hidden border-b border-cyan-300/20 px-5 pb-5 pt-6 sm:px-7 sm:pb-6">
              {managerAvatarUrl && (
                <>
                  <img
                    src={managerAvatarUrl}
                    alt=""
                    className="manager-hero-wash"
                  />
                  <img
                    src={managerAvatarUrl}
                    alt=""
                    className="manager-hero-watermark"
                  />
                </>
              )}
              <div className="manager-hero-scrim" />
              <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-cyan-300 via-orange-400 to-transparent" />

              <DialogHeader className="relative pr-10">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border border-cyan-300/35 bg-slate-950 shadow-xl shadow-black/40 sm:h-20 sm:w-20">
                    {managerAvatarUrl ? (
                      <img
                        src={managerAvatarUrl}
                        alt={managerName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-black text-orange-300">
                        {managerInitial}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
                      Draft Portfolio
                    </p>
                    <DialogTitle className="athletic-headline mt-1 truncate text-3xl font-black leading-none text-orange-400 sm:text-4xl">
                      {managerName}
                    </DialogTitle>
                  </div>
                </div>
              </DialogHeader>

              <div className="relative mt-5 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
                <ManagerDraftStat label="Picks" value={managerPicks.length.toLocaleString()} />
                <ManagerDraftStat label="Current Value" value={totalCurrentValue.toLocaleString()} />
                <ManagerDraftStat
                  label="Value Change"
                  value={`${totalValueGain > 0 ? '+' : ''}${totalValueGain.toLocaleString()}`}
                  tone={totalValueGain > 0 ? 'positive' : totalValueGain < 0 ? 'negative' : 'neutral'}
                />
              </div>
            </div>

            <div className="w-full overflow-x-hidden p-4 sm:p-6">
            <Table
              className="manager-draft-table w-full text-xs sm:text-sm"
              containerClassName="overflow-x-hidden"
              style={{ tableLayout: 'fixed' }}
            >
              <TableHeader className="border-b-2 border-orange-500/30">
                <TableRow className="border-slate-700">
                  <TableHead className="w-[54%] text-white font-semibold">Player</TableHead>
                  <TableHead className="w-[18%] text-center text-white font-semibold">
                    <div>Pick</div>
                    <div>#</div>
                  </TableHead>
                  <TableHead className="w-[28%] text-right text-white font-semibold">
                    <div>Value</div>
                    <div>Change</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managerPicks.map((pick, idx) => {
                  const teamColors = NFL_TEAM_COLORS[pick.playerDetails?.team || ''];
                  const rowStyle = teamColors
                    ? ({
                        '--team-primary': teamColors.primary,
                        '--team-secondary': teamColors.secondary,
                        '--team-accent': teamColors.accent,
                      } as CSSProperties)
                    : undefined;

                  return (
                    <TableRow 
                      key={idx} 
                      className="border-slate-700 hover:bg-slate-800/30 cursor-pointer"
                      style={rowStyle}
                      onClick={() => setSelectedPlayer(pick)}
                    >
                      <TableCell className="manager-draft-player-cell min-w-0 font-semibold text-slate-100">
                        <div className="flex min-w-0 items-center">
                          <PlayerNameWithHeadshot playerId={pick.player_id} playerName={pick.playerName} />
                        </div>
                      </TableCell>
                      <TableCell className="manager-draft-pick-cell text-center">
                        <span className="font-semibold text-cyan-300">
                          {pick.draftYear ? `${pick.draftYear} ` : ''}#{pick.pick}
                        </span>
                      </TableCell>
                      <TableCell className="manager-draft-gain-cell text-right">
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
                  );
                })}
              </TableBody>
            </Table>
            </div>

          {managerPicks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-400">No draft picks found for {managerName}</p>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Player Detail Modal */}
      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerName ? { [managerName]: managerAvatarUrl || null } : undefined}
      />
    </>
  );
}

function ManagerDraftStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const toneClass = tone === 'positive'
    ? 'text-emerald-300'
    : tone === 'negative'
      ? 'text-rose-300'
      : 'text-white';

  return (
    <div className="rounded-xl border border-cyan-300/18 bg-slate-950/55 px-3 py-3 shadow-inner shadow-white/[0.02] backdrop-blur">
      <div className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-cyan-200/75 sm:text-[0.65rem]">
        {label}
      </div>
      <div className={`mt-1 truncate text-lg font-black sm:text-2xl ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
