import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DraftPick, PlayerDetails } from '@shared/types';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { PlayerDetailModal } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { TeamLogoPill } from './TeamLogoPill';
import { getTeamTileStyle } from '@/lib/teamTileStyle';
import { getPositionRankPillClass } from '@/lib/positionRank';
import { ChampionAvatarFrame, ManagerChampionshipPills } from './ManagerChampionships';

interface ManagerDraftPicksModalProps {
  isOpen: boolean;
  onClose: () => void;
  managerName: string;
  managerDisplayName?: string;
  draftPicks: DraftPick[];
  managerAvatarUrl?: string | null;
  playerDetailsById?: Record<string, PlayerDetails>;
  mode?: 'portfolio' | 'audit';
  leagueId?: string;
  leagueLogo?: string | null;
}

export function ManagerDraftPicksModal({
  isOpen,
  onClose,
  managerName,
  managerDisplayName,
  draftPicks,
  managerAvatarUrl,
  playerDetailsById,
  mode = 'portfolio',
  leagueId,
  leagueLogo,
}: ManagerDraftPicksModalProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<DraftPick | null>(null);

  const isAuditMode = mode === 'audit';
  const managerPicks = draftPicks
    .filter((pick) => pick.manager === managerName)
    .sort((a, b) => {
      const yearDiff = Number(b.draftYear || 0) - Number(a.draftYear || 0);
      if (yearDiff !== 0) return yearDiff;
      return a.pick - b.pick;
    });
  const totalCurrentValue = managerPicks.reduce((sum, pick) => sum + (pick.currentKtcValue || 0), 0);
  const totalValueGain = managerPicks.reduce((sum, pick) => sum + (pick.valueGain || 0), 0);
  const hitCount = managerPicks.filter((pick) => getResolvedDraftOutcome(pick) === 'hit').length;
  const missCount = managerPicks.filter((pick) => getResolvedDraftOutcome(pick) === 'miss').length;
  const starterCount = managerPicks.filter(getResolvedDraftStarter).length;
  const displayManagerName = managerDisplayName || managerName;
  const managerInitial = displayManagerName.trim()[0]?.toUpperCase() || '?';
  const managerNameLength = displayManagerName.replace(/\s+/g, '').length;
  const managerNameSizeClass = managerNameLength >= 20
    ? 'manager-modal-name-xxlong'
    : managerNameLength >= 15
      ? 'manager-modal-name-xlong'
      : managerNameLength >= 10
        ? 'manager-modal-name-long'
        : '';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent showCloseButton={false} className="manager-draft-modal max-h-[86vh] max-w-[calc(100vw-1rem)] overflow-hidden border-cyan-300/20 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 sm:max-w-4xl">
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
              <button type="button" className="manager-modal-close" onClick={onClose} aria-label={`Close ${displayManagerName} draft details`}>
                <X aria-hidden="true" />
              </button>
              <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-cyan-300 via-orange-400 to-transparent" />

              <DialogHeader className="relative pr-10 text-center">
                <div className="manager-draft-title-lockup">
                  <ChampionAvatarFrame managerName={managerName} className="manager-draft-champion-frame">
                    {managerAvatarUrl ? (
                      <img
                        src={managerAvatarUrl}
                        alt={displayManagerName}
                        className="manager-draft-champion-avatar"
                      />
                    ) : (
                      <div className="manager-draft-champion-avatar flex items-center justify-center text-2xl font-black text-orange-300">
                        {managerInitial}
                      </div>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/90">
                      {isAuditMode ? 'Draft Decision Audit' : 'Draft Portfolio'}
                    </p>
                    <DialogTitle className={`manager-modal-name ${managerNameSizeClass} athletic-headline mt-1 font-black leading-none text-orange-400`}>
                      {displayManagerName}
                    </DialogTitle>
                    <ManagerChampionshipPills managerName={managerName} className="mt-2 justify-center" />
                  </div>
                </div>
              </DialogHeader>

              <div className="relative mt-5 grid grid-cols-2 gap-2 sm:max-w-3xl sm:grid-cols-5 sm:gap-3">
                {isAuditMode ? (
                  <>
                    <ManagerDraftStat label="Picks" value={managerPicks.length.toLocaleString()} />
                    <ManagerDraftStat label="Hits" value={hitCount.toLocaleString()} tone={hitCount ? 'positive' : 'neutral'} />
                    <ManagerDraftStat label="Misses" value={missCount.toLocaleString()} tone={missCount ? 'negative' : 'positive'} />
                    <ManagerDraftStat label="Starters" value={starterCount.toLocaleString()} tone={starterCount ? 'positive' : 'neutral'} />
                    <ManagerDraftStat
                      label="Avg Change"
                      value={`${Math.round(totalValueGain / Math.max(managerPicks.length, 1)) > 0 ? '+' : ''}${Math.round(totalValueGain / Math.max(managerPicks.length, 1)).toLocaleString()}`}
                      tone={totalValueGain > 0 ? 'positive' : totalValueGain < 0 ? 'negative' : 'neutral'}
                    />
                  </>
                ) : (
                  <>
                    <ManagerDraftStat label="Picks" value={managerPicks.length.toLocaleString()} />
                    <ManagerDraftStat label="Current Value" value={totalCurrentValue.toLocaleString()} />
                    <ManagerDraftStat
                      label="Value Change"
                      value={`${totalValueGain > 0 ? '+' : ''}${totalValueGain.toLocaleString()}`}
                      tone={totalValueGain > 0 ? 'positive' : totalValueGain < 0 ? 'negative' : 'neutral'}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="player-tile-shell w-full overflow-x-hidden p-4 sm:p-6">
              <div className="player-tile-grid manager-draft-player-grid">
                {managerPicks.map((pick, idx) => {
                  const draftOutcome = getDraftOutcomeLabel(getResolvedDraftOutcome(pick));
                  const isStarter = getResolvedDraftStarter(pick);
                  const gainTone = getDraftGainTone(pick.valueGain);

                  return (
                    <button
                      key={`${pick.draftYear}-${pick.pick}-${pick.player_id || idx}`}
                      type="button"
                      className="player-team-tile rookie-player-tile"
                      style={getTeamTileStyle(pick.playerDetails?.team)}
                      onClick={() => setSelectedPlayer(enrichDraftPickDetails(
                        pick,
                        playerDetailsById
                      ))}
                    >
                      {isStarter && <span className="draft-starter-corner">Starter</span>}
                      <div className="player-tile-main">
                        <PlayerNameWithHeadshot playerId={pick.player_id} playerName={pick.playerName} />
                      </div>
                      <div className="player-tile-pills">
                        <TeamLogoPill team={pick.playerDetails?.team} />
                        <span>{pick.draftYear ? `${pick.draftYear} ` : ''}#{pick.pick}</span>
                        {pick.ktcValue !== null && pick.ktcValue !== undefined && (
                          <span>Day {pick.ktcValue.toLocaleString()}</span>
                        )}
                        {pick.positionRankMay2025 && <span className={getPositionRankPillClass(pick.positionRankMay2025)}>Draft {pick.positionRankMay2025}</span>}
                        {!isAuditMode && draftOutcome.tone !== 'neutral' && (
                          <span className={`draft-outcome-pill draft-outcome-pill-${draftOutcome.tone}`}>
                            {draftOutcome.label}
                          </span>
                        )}
                        {!isAuditMode && (
                          <span className={`draft-gain-pill draft-gain-pill-${gainTone}`}>
                            {formatDraftGain(pick.valueGain)}
                            {pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain > 0 && <TrendingUp className="ml-1 inline h-3.5 w-3.5" />}
                            {pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain < 0 && <TrendingDown className="ml-1 inline h-3.5 w-3.5" />}
                          </span>
                        )}
                        {isAuditMode && pick.draftDecisionVerdict && (
                          <span className={`draft-decision-verdict draft-decision-verdict-${pick.draftDecisionTone || 'watch'}`}>
                            {pick.draftDecisionVerdict}
                          </span>
                        )}
                      </div>
                      {isAuditMode ? (
                        <div className="manager-draft-decision-read">
                          <div className="draft-decision-pills manager-draft-decision-pills">
                            {pick.draftDecisionBoardRankLabel && <span>{pick.draftDecisionBoardRankLabel}</span>}
                            <span className={getPositionRankPillClass(pick.currentPositionRank || pick.playerPos)}>
                              Now {pick.currentPositionRank || pick.playerPos}
                            </span>
                            {pick.valueGain !== null && pick.valueGain !== undefined && (
                              <span className={pick.valueGain >= 0 ? 'is-positive' : 'is-negative'}>
                                {pick.valueGain > 0 ? '+' : ''}{pick.valueGain.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {pick.draftDecisionSummary && <p>{pick.draftDecisionSummary}</p>}
                          {pick.draftDecisionAltPlayerName && (
                            <p className="manager-draft-decision-alt">
                              <strong>{pick.draftDecisionAltLabel || 'Alternative:'}</strong> {pick.draftDecisionAltPlayerName}
                              {pick.draftDecisionAltPosition ? ` (${pick.draftDecisionAltPosition})` : ''}
                              {pick.draftDecisionAltPickLabel ? ` at ${pick.draftDecisionAltPickLabel}` : ''}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

          {managerPicks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-400">No draft picks found for {displayManagerName}</p>
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

function getDraftOutcomeLabel(outcome: DraftPick['draftOutcome']): { label: string; tone: 'hit' | 'miss' | 'neutral' } {
  if (outcome === 'hit') return { label: 'Hit', tone: 'hit' };
  if (outcome === 'miss') return { label: 'Miss', tone: 'miss' };
  return { label: 'Early Read', tone: 'neutral' };
}

function getResolvedDraftOutcome(pick: DraftPick): NonNullable<DraftPick['draftOutcome']> {
  if (pick.draftOutcome) return pick.draftOutcome;
  const rankChange = pick.positionRankChange ? parseInt(pick.positionRankChange, 10) : 0;
  const hasRankChange = Number.isFinite(rankChange) && rankChange !== 0;
  const draftYear = Number(pick.draftYear);
  const isFreshClass = Number.isFinite(draftYear) && draftYear >= new Date().getFullYear();
  const rankThreshold = isFreshClass ? 12 : 8;
  const valueThreshold = isFreshClass ? 1500 : 900;
  const isHit = (hasRankChange && rankChange >= rankThreshold) || (pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain >= valueThreshold);
  const isMiss = (hasRankChange && rankChange <= -rankThreshold) || (pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain <= -valueThreshold);
  if (isHit && isMiss) return (pick.valueGain || 0) >= 0 ? 'hit' : 'miss';
  if (isHit) return 'hit';
  if (isMiss) return 'miss';
  return 'neutral';
}

function getResolvedDraftStarter(pick: DraftPick): boolean {
  if (typeof pick.isStarter === 'boolean') return pick.isStarter;
  const rank = pick.currentPositionRank || '';
  const position = rank.match(/^[A-Z]+/)?.[0] || pick.playerPos;
  const rankNumber = Number(rank.match(/\d+/)?.[0]);
  const starterThresholds: Record<string, number> = { QB: 24, RB: 36, WR: 48, TE: 18 };
  if (position && Number.isFinite(rankNumber) && rankNumber <= (starterThresholds[position] || 0)) return true;
  return !rank && pick.currentKtcValue !== null && pick.currentKtcValue !== undefined && pick.currentKtcValue > 4000;
}

function getDraftGainTone(valueGain: number | null | undefined): 'positive' | 'negative' | 'neutral' {
  if ((valueGain ?? 0) > 0) return 'positive';
  if ((valueGain ?? 0) < 0) return 'negative';
  return 'neutral';
}

function formatDraftGain(valueGain: number | null | undefined): string {
  if (valueGain === null || valueGain === undefined) return 'N/A';
  return `${valueGain > 0 ? '+' : ''}${valueGain.toLocaleString()}`;
}

function enrichDraftPickDetails(
  pick: DraftPick,
  playerDetailsById?: Record<string, PlayerDetails>
): DraftPick {
  const mappedDetails = pick.player_id ? playerDetailsById?.[pick.player_id] : undefined;
  if (!mappedDetails) return pick;

  return {
    ...pick,
    playerDetails: {
      ...mappedDetails,
      ...pick.playerDetails,
      valueProfile: pick.playerDetails?.valueProfile || mappedDetails.valueProfile,
      lastSeasonPositionRank: pick.playerDetails?.lastSeasonPositionRank || mappedDetails.lastSeasonPositionRank,
      lastSeasonFantasyPoints: pick.playerDetails?.lastSeasonFantasyPoints ?? mappedDetails.lastSeasonFantasyPoints,
      lastSeasonGames: pick.playerDetails?.lastSeasonGames ?? mappedDetails.lastSeasonGames,
      lastSeasonPointsPerGame: pick.playerDetails?.lastSeasonPointsPerGame ?? mappedDetails.lastSeasonPointsPerGame,
      lastSeasonYear: pick.playerDetails?.lastSeasonYear || mappedDetails.lastSeasonYear,
      availabilityHistory: pick.playerDetails?.availabilityHistory?.length ? pick.playerDetails.availabilityHistory : mappedDetails.availabilityHistory,
      latestNews: pick.playerDetails?.latestNews || mappedDetails.latestNews,
      avgGamesMissed: pick.playerDetails?.avgGamesMissed ?? mappedDetails.avgGamesMissed,
      availabilitySeasons: pick.playerDetails?.availabilitySeasons ?? mappedDetails.availabilitySeasons,
      similarTradeValues: pick.playerDetails?.similarTradeValues?.length ? pick.playerDetails.similarTradeValues : mappedDetails.similarTradeValues,
    },
  };
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
