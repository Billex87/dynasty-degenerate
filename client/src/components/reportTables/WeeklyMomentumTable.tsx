import { useState } from 'react';
import type { ReportData } from '@shared/types';
import { PlayerDetailModal, type PlayerModalData } from '../PlayerDetailModal';
import { EmptyState, PlayerIdentityRow } from '../reportPrimitives';
import { TeamLogoPill } from '../TeamLogoPill';
import {
  buildPlayerModalData,
  FIRST_FULL_BLEND_WEEK_LABEL,
  formatCompactValue,
  PositionRankPill,
  renderActivityManagerAvatar,
  type ManagerAvatars,
  type PlayerDetailsById,
  VALUE_BLEND_HISTORY_START_LABEL,
  ValueTrendIcon,
} from '../ReportTables';
import { getBalancedGridStyle } from '@/lib/balancedGrid';
import { getPlayerValueForMode, normalizeLeagueValueMode } from '@/lib/leagueValueMode';
import { getTeamTileStyle } from '@/lib/teamTileStyle';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';

export default function WeeklyMomentumTable({
  data,
  sections,
  title: _title,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
  viewerManager,
  leagueValueMode: leagueValueModeInput = 'dynasty',
}: {
  data: ReportData['weeklyRisers'];
  sections?: Array<{ title: string; data: ReportData['weeklyRisers'] }>;
  title: string;
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  leagueValueMode?: ReportData['leagueValueMode'];
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const displaySections = sections?.length ? sections : [{ title: _title, data }];
  const allRows = displaySections.flatMap(section => section.data);
  const isRiserList = allRows.some((row) => row.pct_change > 0);
  const leagueValueMode = normalizeLeagueValueMode(leagueValueModeInput);
  const baselineCountNote = allRows.length > 0 && allRows.length < 10
    ? `Showing ${allRows.length} players while the same-blend history window fills in.`
    : null;

  return (
    <div className="weekly-momentum-wrap">
      <div className="weekly-momentum-baseline-note">
        <span>7-day baseline</span>
        <p>
          Movement compares today&apos;s league-matched blended value to the earliest stored blended snapshot until the clean seven-day window opens.
          Same-blend history starts {VALUE_BLEND_HISTORY_START_LABEL}; the first clean same-blend window starts {FIRST_FULL_BLEND_WEEK_LABEL}.
          {baselineCountNote ? ` ${baselineCountNote}` : ''}
        </p>
      </div>
      {allRows.length > 0 ? (
        <div className="weekly-momentum-section-stack">
          {displaySections.map(section => (
            <section key={section.title} className="weekly-momentum-section">
              <h4>{section.title}</h4>
              <div className="weekly-momentum-grid balanced-tile-grid" style={getBalancedGridStyle(Math.max(section.data.length, 5), 5)}>
                {section.data.slice(0, 5).map((row) => {
                  const playerDetails = row.playerDetails || (row.player_id ? playerDetailsById?.[row.player_id] : undefined);
                  const isPositive = row.pct_change >= 0;
                  return (
                    <button
                      key={`${section.title}-${row.player_id || row.name}-${row.owner}`}
                      type="button"
                      className={`player-team-tile weekly-momentum-tile ${isPositive ? 'weekly-momentum-tile-up' : 'weekly-momentum-tile-down'} ${viewerOwnedHighlightClass(row.owner, viewerManager)}`}
                      style={getTeamTileStyle(playerDetails?.team)}
                      onClick={() => setSelectedPlayer(buildPlayerModalData({
                        playerId: row.player_id,
                        playerName: row.name,
                        playerPos: row.pos,
                        value: getPlayerValueForMode({
                          valueProfile: playerDetails?.valueProfile,
                          fallbackValue: leagueValueMode === 'redraft' ? playerDetails?.valueProfile?.seasonValue ?? row.val_now : row.val_now,
                          mode: leagueValueMode,
                          context: 'waiver',
                        }),
                        valueGain: row.diff,
                        playerDetails,
                        playerDetailsById,
                        manager: row.owner,
                        managerAvatarUrl: managerAvatars?.[row.owner],
                        currentPositionRank: row.currentPositionRank,
                        valueMode: leagueValueMode,
                        valueChangeNote: `Blended value change compares the current league-matched blend with the earliest stored blended snapshot until the clean seven-day window opens. Same-blend history starts ${VALUE_BLEND_HISTORY_START_LABEL}; the first clean same-blend window starts ${FIRST_FULL_BLEND_WEEK_LABEL}.`,
                      }))}
                    >
                      <div className="weekly-momentum-tile-top">
                        <span
                          className={`weekly-momentum-status-pill ${
                            isPositive ? 'weekly-momentum-status-riser' : 'weekly-momentum-status-faller'
                          }`}
                        >
                          {isPositive ? 'Riser' : 'Faller'}
                        </span>
                        <strong className={isPositive ? 'text-emerald-300' : 'text-rose-300'}>
                          {row.pct_change >= 0 ? '+' : ''}
                          {row.pct_change.toFixed(1)}%
                          <ValueTrendIcon value={row.pct_change} />
                        </strong>
                      </div>
                      <div className="weekly-momentum-identity">
                        <PlayerIdentityRow
                          className="weekly-momentum-player"
                          playerId={row.player_id}
                          playerName={row.name}
                          team={playerDetails?.team}
                          position={row.pos}
                          hideMeta
                        />
                      </div>
                      <div
                        className="weekly-momentum-value-change"
                        aria-label={`Value moved from ${formatCompactValue(row.val_last)} to ${formatCompactValue(row.val_now)}`}
                      >
                        <span className="weekly-momentum-value-label">{leagueValueMode === 'redraft' ? 'Season:' : 'Value:'}</span>
                        <span>{formatCompactValue(row.val_last)}</span>
                        <span className="weekly-momentum-value-arrow" aria-hidden="true">→</span>
                        <span>{formatCompactValue(row.val_now)}</span>
                      </div>
                      <div className="activity-card-meta-row">
                        <div className="weekly-momentum-pills">
                          <TeamLogoPill team={playerDetails?.team} />
                          <PositionRankPill rank={row.currentPositionRank || row.pos} />
                        </div>
                        {renderActivityManagerAvatar(row.owner, managerAvatars)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          className="weekly-momentum-empty"
          title={`No ${isRiserList ? 'weekly risers' : 'weekly fallers'} found for the current blended window.`}
        />
      )}
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
