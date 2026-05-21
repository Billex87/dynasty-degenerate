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

function getManagerRosterDisplayCount(row: ManagerCountRow, positions: CountPosition[] = COUNT_POSITIONS): number {
  const explicitCount = Number(row.totalRosterPlayerCount || 0);
  if (explicitCount > 0) return explicitCount;

  const listedPlayers = row.rosterPlayers || row.lineupPlayers || [];
  if (listedPlayers.length > 0) return listedPlayers.length;

  return getManagerRosterPlayerCount(row, positions);
}

function ManagerPositionCountValue({
  count,
  delta,
}: {
  count: number;
  delta: number;
}) {
  return (
    <span className="manager-position-count-value">
      <span>{count}</span>
      <small>{formatPositionCountDelta(delta)}</small>
    </span>
  );
}

function ManagerRosterCountValue({ count }: { count: number }) {
  return (
    <span className="manager-position-count-value manager-position-count-value-roster">
      <span>{count}</span>
      <small>Players</small>
    </span>
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
  const visibleCountPositions = useMemo(
    () => getVisibleCountPositions(data, positionDepth),
    [data, positionDepth]
  );
  const selectedRosterPlayersByPosition = selectedManager ? getManagerRosterPlayersByPosition(selectedManager) : null;
  const selectedRosterPlayerCount = selectedManager ? getManagerRosterDisplayCount(selectedManager, visibleCountPositions) : 0;
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
          return (
            <OwnerSummaryTile
              key={`${row.manager}-${idx}`}
              manager={row.manager}
              avatarUrl={managerAvatars?.[row.manager]}
              className={`${viewerOwnedHighlightClass(row.manager, viewerManager)} position-count-summary-tile`}
              onClick={() => setSelectedManager(row)}
            >
              {visibleCountPositions.map((position) => {
                const delta = getPositionCountDelta(row, data, position);
                return (
                  <OwnerMetricPill
                    key={position}
                    label={position}
                    value={(
                      <ManagerPositionCountValue
                        count={getPositionRosterCount(row, position)}
                        delta={delta}
                      />
                    )}
                    tone={getPositionCountPillTone(delta)}
                  />
                );
              })}
              <OwnerMetricPill
                label="Roster"
                value={<ManagerRosterCountValue count={getManagerRosterDisplayCount(row, visibleCountPositions)} />}
                tone="info"
              />
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
                  </div>
                </div>
                <div className="manager-command-hero-metrics starter-modal-metrics">
                  <IntelligenceMetric
                    label="Roster"
                    tone="neutral"
                    value={(
                      <span className="starter-modal-count-value">
                        <span>{selectedRosterPlayerCount}</span>
                        <small>Players</small>
                      </span>
                    )}
                  />
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
                          <div className="starter-grid starter-compact-grid starter-balanced-player-grid balanced-tile-grid" style={getBalancedGridStyle(Math.max(players.length, 3), 3)}>
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
                                <TeamLogoPill team={player.playerDetails?.team} className="starter-player-team-corner" />
                                <div className="starter-player-meta">
                                  <div className="starter-player-meta-main">
                                    <PositionRankPill rank={player.seasonPositionRank || player.currentPositionRank || player.pos} />
                                    <span className={`starter-player-status-pill ${getPlayerStatusClass(player.playerDetails)}`}>
                                      {getPlayerStatusLabel(player.playerDetails)}
                                    </span>
                                    {(player.seasonValue || player.value) > 0 && (
                                      <strong>{(player.seasonValue || player.value).toLocaleString()}</strong>
                                    )}
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
