import { useMemo, useState } from 'react';
import { X as XIcon } from 'lucide-react';
import type { ReportData } from '@shared/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlayerNameWithHeadshot } from '../PlayerNameWithHeadshot';
import { ChampionAvatarFrame, ManagerChampionshipPills } from '../ManagerChampionships';
import { PlayerDetailModal, type PlayerModalData } from '../PlayerDetailModal';
import { TeamLogoPill } from '../TeamLogoPill';
import {
  buildPlayerModalData,
  getAiNeuralSurfaceClass,
  getManagerHeadingClassName,
  getPlayerStatusClass,
  getPlayerStatusLabel,
  IntelligenceMetric,
  OwnerMetricPill,
  OwnerSummaryTile,
  parsePositionRankValue,
  PositionRankPill,
  type ManagerAvatars,
  type PlayerDetailsById,
} from '../ReportTables';
import { getBalancedGridStyle } from '@/lib/balancedGrid';
import { normalizeLeagueValueMode, type LeagueValueMode } from '@/lib/leagueValueMode';
import { getTeamTileStyle } from '@/lib/teamTileStyle';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';

type PositionDepthSignal = ReportData['positionDepth'][number];
type ManagerCountRow = ReportData['managerPositionCounts'][number];
type ManagerCountPlayer = NonNullable<ManagerCountRow['lineupPlayers']>[number];
type CountPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

const COUNT_POSITIONS: CountPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

const POSITION_DEPTH_ORDER: Record<string, number> = {
  QB: 0,
  RB: 1,
  WR: 2,
  TE: 3,
  K: 4,
  DEF: 5,
};

function sortPositionDepthSignals(a: PositionDepthSignal, b: PositionDepthSignal) {
  const statusOrder = (signal: PositionDepthSignal) => (signal.status === 'shortage' ? 0 : 1);
  return (
    statusOrder(a) - statusOrder(b) ||
    (POSITION_DEPTH_ORDER[a.position] ?? 99) - (POSITION_DEPTH_ORDER[b.position] ?? 99)
  );
}

function getPositionDepthSignalLabel(status: PositionDepthSignal['status']) {
  return status === 'shortage' ? 'Shortage' : 'Excess';
}

function getPositionDepthNeedLabel(status: PositionDepthSignal['status']) {
  return status === 'shortage' ? 'Need' : 'Extra';
}

function isCountPosition(position: string): position is CountPosition {
  return COUNT_POSITIONS.includes(position as CountPosition);
}

function getPositionRosterCount(row: ManagerCountRow, position: CountPosition): number {
  return Number(row[position] || 0);
}

function getVisibleCountPositions(
  data: ReportData['managerPositionCounts'],
  positionDepth: ReportData['positionDepth'] = []
): CountPosition[] {
  return COUNT_POSITIONS.filter((position) => {
    if (position !== 'K' && position !== 'DEF') return true;
    return (
      data.some((row) => getPositionRosterCount(row, position) > 0 || getPositionStarterNeed(row, position) > 0)
      || positionDepth.some((signal) => signal.position === position)
    );
  });
}

function getPositionStarterNeed(row: ManagerCountRow, position: CountPosition): number {
  const starterKey = `${position}_starters` as `${CountPosition}_starters`;
  return Number(row[starterKey] || 0);
}

function getLeagueAveragePositionCount(data: ReportData['managerPositionCounts'], position: CountPosition): number {
  if (!data.length) return 0;
  const total = data.reduce((sum, row) => sum + getPositionRosterCount(row, position), 0);
  return total / data.length;
}

function getPositionCountDelta(row: ManagerCountRow, data: ReportData['managerPositionCounts'], position: CountPosition): number {
  return getPositionRosterCount(row, position) - getLeagueAveragePositionCount(data, position);
}

function getPositionCountTone(delta: number): 'neutral' | 'positive' | 'negative' {
  if (delta >= 0.75) return 'positive';
  if (delta <= -0.75) return 'negative';
  return 'neutral';
}

function getPositionCountPillTone(delta: number): 'neutral' | 'good' | 'danger' {
  if (delta >= 0.75) return 'good';
  if (delta <= -0.75) return 'danger';
  return 'neutral';
}

function formatPositionCountDelta(delta: number): string {
  if (Math.abs(delta) < 0.75) return 'Avg';
  const rounded = Math.round(delta);
  return `${rounded > 0 ? '+' : ''}${rounded} vs avg`;
}

function compareManagerCountPlayers(a: ManagerCountPlayer, b: ManagerCountPlayer): number {
  const aRank = parsePositionRankValue(a.seasonPositionRank || a.currentPositionRank) || 999;
  const bRank = parsePositionRankValue(b.seasonPositionRank || b.currentPositionRank) || 999;
  const rankDelta = aRank - bRank;
  if (rankDelta !== 0) return rankDelta;
  return (b.seasonValue || b.value || 0) - (a.seasonValue || a.value || 0);
}

function getStartingCaliberCount(row: ManagerCountRow, position: CountPosition, leagueSize: number): number {
  const starterNeed = Math.max(1, getPositionStarterNeed(row, position));
  const starterCaliberCutoff = Math.max(1, leagueSize) * starterNeed;

  return (row.rosterPlayers || row.lineupPlayers || [])
    .filter((player) => player.pos === position)
    .filter((player) => {
      const rank = parsePositionRankValue(player.seasonPositionRank || player.currentPositionRank);
      return rank !== null && rank <= starterCaliberCutoff;
    })
    .length;
}

function getPositionDepthSignalPlayers(row: ManagerCountRow, signal: PositionDepthSignal): ManagerCountPlayer[] {
  if (!isCountPosition(signal.position)) return [];

  const positionPlayers = [...(row.rosterPlayers || row.lineupPlayers || [])]
    .filter((player) => player.pos === signal.position)
    .sort(compareManagerCountPlayers);

  if (signal.status === 'excess') {
    const starterIds = new Set(
      (row.starterPlayers || [])
        .filter((player) => player.pos === signal.position)
        .map((player) => player.player_id),
    );
    return positionPlayers.filter((player) => !starterIds.has(player.player_id)).slice(0, 3);
  }

  return positionPlayers.slice(0, 3);
}

function getPositionDepthRead(signal: PositionDepthSignal, row?: ManagerCountRow | null, leagueSize = 0, leagueValueMode: LeagueValueMode = 'dynasty') {
  const rosterScope = leagueValueMode === 'redraft' ? 'bench and reserve players' : 'taxi and reserve players';
  if (!row || !isCountPosition(signal.position)) {
    return `${signal.manager} is flagged for ${signal.status === 'shortage' ? 'the league-low count' : 'the league-high count'} at ${signal.position}. This compares full roster counts for that position across the league, including ${rosterScope}.`;
  }

  const rosterCount = getPositionRosterCount(row, signal.position);
  const starterNeed = getPositionStarterNeed(row, signal.position);
  const startingCaliberCount = getStartingCaliberCount(row, signal.position, leagueSize);
  const displayedPlayers = getPositionDepthSignalPlayers(row, signal).map((player) => player.name);
  const playerCopy = displayedPlayers.length
    ? signal.status === 'excess'
      ? ` Best non-starting ${signal.position} options shown: ${displayedPlayers.join(', ')}.`
      : ` Thin ${signal.position} room shown: ${displayedPlayers.join(', ')}.`
    : '';

  return `${signal.manager} has the league-${signal.status === 'shortage' ? 'low' : 'high'} ${signal.position} count: ${rosterCount}/${starterNeed} rostered-to-start, including ${rosterScope}. ${startingCaliberCount} ${signal.position} player${startingCaliberCount === 1 ? '' : 's'} clear the ${Math.max(leagueSize, 1)}-team starter-caliber cutoff for this lineup format.${playerCopy}`;
}

function buildManagerPositionCountAiRead(
  row: ManagerCountRow,
  data: ReportData['managerPositionCounts'],
  signals: PositionDepthSignal[],
  visiblePositions: CountPosition[] = COUNT_POSITIONS,
  leagueValueMode: LeagueValueMode = 'dynasty',
): string {
  const leagueSize = Math.max(data.length, 1);
  const visiblePositionSet = new Set(visiblePositions);
  const shortageSignals = signals.filter((signal) => signal.status === 'shortage' && isCountPosition(signal.position) && visiblePositionSet.has(signal.position));
  const excessSignals = signals.filter((signal) => signal.status === 'excess' && isCountPosition(signal.position) && visiblePositionSet.has(signal.position));
  const countReads = visiblePositions
    .map((position) => {
      const count = getPositionRosterCount(row, position);
      if (!count) return null;
      const delta = getPositionCountDelta(row, data, position);
      const starterNeed = getPositionStarterNeed(row, position);
      const starterCaliberCount = getStartingCaliberCount(row, position, leagueSize);
      const deltaCopy = Math.abs(delta) < 0.75 ? 'near league average' : `${delta > 0 ? '+' : ''}${Math.round(delta)} vs average`;
      return `${position}: ${count} rostered, ${starterNeed} projected starter slot${starterNeed === 1 ? '' : 's'}, ${starterCaliberCount} starter-caliber by season rank, ${deltaCopy}`;
    })
    .filter(Boolean) as string[];
  const excessPlayerCopy = excessSignals
    .flatMap((signal) => getPositionDepthSignalPlayers(row, signal).slice(0, 2).map((player) => `${player.name} (${player.seasonPositionRank || player.currentPositionRank || player.pos})`))
    .slice(0, 4);
  const shortageCopy = shortageSignals.length
    ? `Shortage watch: ${shortageSignals.map((signal) => signal.position).join(', ')}.`
    : 'No position is meaningfully below league count average.';
  const excessCopy = excessSignals.length
    ? `Overage leverage: ${excessSignals.map((signal) => signal.position).join(', ')}${excessPlayerCopy.length ? `, led by ${excessPlayerCopy.join(', ')}` : ''}.`
    : 'No position is meaningfully over league count average.';

  const rosterScope = leagueValueMode === 'redraft' ? 'starters, bench, and IR' : 'starters, bench, IR, and taxi';
  return `${shortageCopy} ${excessCopy} This count board includes ${rosterScope}, then compares the full room against the league. ${countReads.slice(0, 4).join(' ')}${countReads.length > 4 ? ' Extra K/DEF rooms are included when this league uses them.' : ''}`;
}

function getManagerRosterPlayersByPosition(row: ManagerCountRow): Record<CountPosition, ManagerCountPlayer[]> {
  return Object.fromEntries(
    COUNT_POSITIONS.map((position) => [
      position,
      [...(row.rosterPlayers || row.lineupPlayers || [])]
        .filter((player) => player.pos === position)
        .sort(compareManagerCountPlayers),
    ])
  ) as Record<CountPosition, ManagerCountPlayer[]>;
}

function getManagerRosterPlayerCount(row: ManagerCountRow, positions: CountPosition[] = COUNT_POSITIONS): number {
  return positions.reduce((sum, position) => sum + getPositionRosterCount(row, position), 0);
}

function StarterDepthSignalPlayerTile({
  player,
  signal,
  manager,
  managerAvatarUrl,
  playerDetailsById,
  onSelect,
}: {
  player: ManagerCountPlayer;
  signal: PositionDepthSignal;
  manager: string;
  managerAvatarUrl?: string | null;
  playerDetailsById?: PlayerDetailsById;
  onSelect: (player: PlayerModalData) => void;
}) {
  const signalLabel = getPositionDepthSignalLabel(signal.status);

  return (
    <button
      type="button"
      className="starter-depth-player-tile player-team-tile"
      style={getTeamTileStyle(player.playerDetails?.team)}
      onClick={() => {
        const seasonValue = player.seasonValue || player.value;
        const seasonRank = player.seasonPositionRank || player.currentPositionRank || player.pos;
        onSelect(buildPlayerModalData({
          playerId: player.player_id,
          playerName: player.name,
          playerPos: player.pos,
          value: seasonValue,
          playerDetails: player.playerDetails,
          playerDetailsById,
          currentPositionRank: seasonRank,
          valueMode: 'redraft',
          manager,
          managerAvatarUrl,
        }));
      }}
    >
      <span className="starter-depth-player-main">
        <PlayerNameWithHeadshot
          playerId={player.player_id}
          playerName={player.name}
          team={player.playerDetails?.team}
          position={player.pos}
        />
      </span>
      <span className="starter-depth-player-meta">
        <TeamLogoPill team={player.playerDetails?.team} />
        <PositionRankPill rank={player.seasonPositionRank || player.currentPositionRank || player.pos} />
        <span className={`starter-depth-player-signal starter-depth-player-signal-${signal.status}`}>
          {signalLabel}
        </span>
      </span>
    </button>
  );
}


export function ManagerPositionCountsTable({
  data,
  positionDepth = [],
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
  viewerManager,
  leagueValueMode: leagueValueModeInput = 'dynasty',
}: {
  data: ReportData['managerPositionCounts'];
  positionDepth?: ReportData['positionDepth'];
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  leagueValueMode?: ReportData['leagueValueMode'];
}) {
  const [selectedManager, setSelectedManager] = useState<ReportData['managerPositionCounts'][number] | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const selectedAvatar = selectedManager ? managerAvatars?.[selectedManager.manager] : null;
  const leagueValueMode = normalizeLeagueValueMode(leagueValueModeInput);
  const visibleCountPositions = useMemo(
    () => getVisibleCountPositions(data, positionDepth),
    [data, positionDepth]
  );
  const selectedRosterPlayersByPosition = selectedManager ? getManagerRosterPlayersByPosition(selectedManager) : null;
  const selectedRosterPlayerCount = selectedManager ? getManagerRosterPlayerCount(selectedManager, visibleCountPositions) : 0;
  const positionDepthByManager = useMemo(() => {
    const signalsByManager = new Map<string, PositionDepthSignal[]>();

    positionDepth.forEach((signal) => {
      const managerSignals = signalsByManager.get(signal.manager) || [];
      managerSignals.push(signal);
      signalsByManager.set(signal.manager, managerSignals);
    });

    signalsByManager.forEach((signals) => signals.sort(sortPositionDepthSignals));
    return signalsByManager;
  }, [positionDepth]);
  const selectedDepthSignals = selectedManager
    ? (positionDepthByManager.get(selectedManager.manager) || []).filter((signal) => isCountPosition(signal.position) && visibleCountPositions.includes(signal.position))
    : [];

  return (
    <div className="owner-tile-shell">
      <div className="owner-tile-grid position-counts-tile-grid balanced-tile-grid" style={getBalancedGridStyle(data.length)}>
        {data.map((row, idx) => {
          const depthSignals = (positionDepthByManager.get(row.manager) || []).filter(
            (signal) => isCountPosition(signal.position) && visibleCountPositions.includes(signal.position)
          );

          return (
            <OwnerSummaryTile
              key={`${row.manager}-${idx}`}
              manager={row.manager}
              avatarUrl={managerAvatars?.[row.manager]}
              className={viewerOwnedHighlightClass(row.manager, viewerManager)}
              onClick={() => setSelectedManager(row)}
            >
              {visibleCountPositions.map((position) => {
                const delta = getPositionCountDelta(row, data, position);
                return (
                  <OwnerMetricPill
                    key={position}
                    label={position}
                    value={getPositionRosterCount(row, position)}
                    tone={getPositionCountPillTone(delta)}
                  />
                );
              })}
              {depthSignals.slice(0, 2).map((signal) => (
                <OwnerMetricPill
                  key={`${signal.position}-${signal.status}`}
                  label={getPositionDepthNeedLabel(signal.status)}
                  value={signal.position}
                  tone={signal.status === 'shortage' ? 'danger' : 'good'}
                />
              ))}
              {depthSignals.length > 2 && (
                <OwnerMetricPill label="Depth" value={`+${depthSignals.length - 2}`} tone="info" />
              )}
            </OwnerSummaryTile>
          );
        })}
      </div>
      <Dialog open={selectedManager !== null} onOpenChange={(open) => !open && setSelectedManager(null)}>
        <DialogContent showCloseButton={false} className="starter-modal flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-cyan-300/20 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 sm:max-h-[86vh] sm:max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedManager?.manager} Roster Counts</DialogTitle>
            <DialogDescription>
              Roster players grouped by position and sorted by value. Select a player to open the player detail modal.
            </DialogDescription>
          </DialogHeader>
          {selectedManager && (
            <div className="manager-command-modal-inner starter-modal-inner max-h-[calc(100dvh-1rem)] min-h-0 sm:max-h-[86vh]">
              <div className="manager-command-hero starter-modal-hero">
                {selectedAvatar && (
                  <>
                    <img
                      src={selectedAvatar}
                      alt=""
                      className="manager-hero-wash"
                    />
                    <img
                      src={selectedAvatar}
                      alt=""
                      className="manager-hero-watermark"
                    />
                  </>
                )}
                <div className="manager-hero-scrim" />
                <button type="button" className="manager-modal-close" onClick={() => setSelectedManager(null)} aria-label={`Close ${selectedManager.manager} details`}>
                  <XIcon aria-hidden="true" />
                </button>
                <div className="manager-command-title-lockup">
                  <ChampionAvatarFrame managerName={selectedManager.manager} className="manager-command-champion-frame">
                    {selectedAvatar ? (
                      <img
                        src={selectedAvatar}
                        alt={selectedManager.manager}
                        className="manager-command-avatar"
                      />
                    ) : (
                      <span className="manager-command-avatar">
                        {selectedManager.manager[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                  </ChampionAvatarFrame>
                  <div className="min-w-0">
                    <p>Roster Room</p>
                    <h3 className={getManagerHeadingClassName(selectedManager.manager)}>{selectedManager.manager}</h3>
                    <ManagerChampionshipPills managerName={selectedManager.manager} className="manager-command-championships" />
                    <p className="starter-modal-subtitle">
                      {selectedRosterPlayerCount} rostered lineup player{selectedRosterPlayerCount === 1 ? '' : 's'} by season rank, including bench and IR{leagueValueMode === 'dynasty' ? ', plus taxi where available' : ''}
                    </p>
                  </div>
                </div>
                <div className="manager-command-hero-metrics starter-modal-metrics">
                  {visibleCountPositions.map((position) => {
                    const delta = getPositionCountDelta(selectedManager, data, position);
                    return (
                      <IntelligenceMetric
                        key={position}
                        label={position}
                        tone={getPositionCountTone(delta)}
                        value={(
                          <span className="starter-modal-count-value">
                            <span>{getPositionRosterCount(selectedManager, position)}</span>
                            <small>{formatPositionCountDelta(delta)}</small>
                          </span>
                        )}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="starter-modal-body min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
                {selectedDepthSignals.length > 0 && (
                  <div className="starter-depth-signal-strip" aria-label="Position depth signals">
                    {selectedDepthSignals.map((signal) => {
                      return (
                        <span
                          key={`${signal.position}-${signal.status}`}
                          className={`starter-depth-signal-chip starter-depth-signal-chip-${signal.status}`}
                        >
                          <strong>{signal.status === 'shortage' ? 'Shortage' : 'Overage'}</strong>
                          <span>{signal.position}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className={getAiNeuralSurfaceClass('window', 'manager-command-section manager-command-read manager-command-ai-read starter-depth-count-read')}>
                  <h4>Roster Count AI Read</h4>
                  <p>{buildManagerPositionCountAiRead(selectedManager, data, selectedDepthSignals, visibleCountPositions, leagueValueMode)}</p>
                </div>
                {selectedRosterPlayersByPosition && selectedRosterPlayerCount > 0 ? (
                  <div className="starter-roster-position-list">
                    {visibleCountPositions.map((position) => {
                      const players = selectedRosterPlayersByPosition[position] || [];
                      if (!players.length) return null;

                      return (
                        <section key={position} className="starter-roster-position-section">
                          <div className="starter-roster-position-heading">
                            <span>{position}</span>
                            <strong>{players.length}</strong>
                          </div>
                          <div className="starter-grid starter-compact-grid balanced-tile-grid" style={getBalancedGridStyle(players.length)}>
                            {players.map((player) => (
                              <button
                                key={player.player_id}
                                type="button"
                                className="player-team-tile starter-player-tile starter-player-tile-compact"
                                style={getTeamTileStyle(player.playerDetails?.team)}
                                onClick={() => {
                                  const seasonValue = player.seasonValue || player.value;
                                  const seasonRank = player.seasonPositionRank || player.currentPositionRank || player.pos;
                                  setSelectedPlayer(buildPlayerModalData({
                                    playerId: player.player_id,
                                    playerName: player.name,
                                    playerPos: player.pos,
                                    value: seasonValue,
                                    playerDetails: player.playerDetails,
                                    playerDetailsById,
                                    currentPositionRank: seasonRank,
                                    valueMode: 'redraft',
                                    manager: selectedManager.manager,
                                    managerAvatarUrl: selectedAvatar,
                                  }));
                                }}
                              >
                                <div className="starter-player-main">
                                  <PlayerNameWithHeadshot
                                    playerId={player.player_id}
                                    playerName={player.name}
                                    team={player.playerDetails?.team}
                                    position={player.pos}
                                  />
                                </div>
                                <div className="starter-player-meta">
                                  <div className="starter-player-meta-main">
                                    <TeamLogoPill team={player.playerDetails?.team} className="starter-player-team-pill" />
                                    <PositionRankPill rank={player.seasonPositionRank || player.currentPositionRank || player.pos} />
                                    {(player.seasonValue || player.value) > 0 && (
                                      <strong>{(player.seasonValue || player.value).toLocaleString()}</strong>
                                    )}
                                  </div>
                                  <div className="starter-player-status-row">
                                    <span className={`starter-player-status-pill ${getPlayerStatusClass(player.playerDetails)}`}>
                                      {getPlayerStatusLabel(player.playerDetails)}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-cyan-300/15 bg-slate-950/45 px-4 py-8 text-center text-sm font-bold text-slate-400">
                    No lineup-position players found for this manager.
                  </div>
                )}
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
    </div>
  );
}

export { ManagerPositionCountsTable as default };
