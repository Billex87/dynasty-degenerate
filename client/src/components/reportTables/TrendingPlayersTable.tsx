import { useState } from 'react';
import type { ReportData, TrendingPlayer } from '@shared/types';
import { PlayerDetailModal, type PlayerModalData } from '../PlayerDetailModal';
import { EmptyState, PlayerIdentityRow } from '../reportPrimitives';
import { TeamLogoPill } from '../TeamLogoPill';
import {
  buildPlayerModalData,
  formatCompactValue,
  PositionRankPill,
  renderActivityManagerAvatar,
  type ManagerAvatars,
  type PlayerDetailsById,
} from './shared';
import { getPlayerValueForMode, normalizeLeagueValueMode } from '@/lib/leagueValueMode';
import { getTeamTileStyle } from '@/lib/teamTileStyle';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';

export default function TrendingPlayersTable({
  data,
  sections,
  title,
  countLabel,
  managerAvatars,
  playerDetailsById,
  leagueId,
  leagueLogo,
  viewerManager,
  leagueValueMode: leagueValueModeInput = 'dynasty',
}: {
  data: TrendingPlayer[];
  sections?: Array<{ title: string; countLabel: 'Adds' | 'Drops'; data: TrendingPlayer[] }>;
  title: string;
  countLabel: 'Adds' | 'Drops';
  managerAvatars?: ManagerAvatars;
  playerDetailsById?: PlayerDetailsById;
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
  leagueValueMode?: ReportData['leagueValueMode'];
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const leagueValueMode = normalizeLeagueValueMode(leagueValueModeInput);
  const displaySections = sections?.length ? sections : [{ title, countLabel, data }];
  const allRows = displaySections.flatMap(section => section.data);

  return (
    <div className="trending-card-wrap">
      {allRows.length > 0 ? (
        <div className="trending-section-stack">
          {displaySections.map(section => (
            <section key={section.title} className="trending-section">
              <h4>{section.title}</h4>
              <div className="trending-card-grid">
                {section.data.slice(0, 5).map((row) => {
                  const playerDetails = row.playerDetails || (row.player_id ? playerDetailsById?.[row.player_id] : undefined);
                  return (
                    <button
                      key={`${section.title}-${row.player_id}`}
                      type="button"
                      className={`player-team-tile trending-player-card ${viewerOwnedHighlightClass(row.owner, viewerManager)}`}
                      style={getTeamTileStyle(playerDetails?.team || row.team)}
                      onClick={() => setSelectedPlayer(buildPlayerModalData({
                        playerId: row.player_id,
                        playerName: row.name,
                        playerPos: row.pos,
                        value: getPlayerValueForMode({
                          valueProfile: playerDetails?.valueProfile,
                          fallbackValue: row.ktcValue,
                          mode: leagueValueMode,
                          context: 'waiver',
                        }),
                        playerDetails,
                        playerDetailsById,
                        currentPositionRank: row.currentPositionRank,
                        valueMode: leagueValueMode,
                        manager: row.owner || null,
                        managerAvatarUrl: row.owner ? managerAvatars?.[row.owner] : null,
                      }))}
                    >
                      <div className="trending-player-card-top">
                        <span>{section.countLabel}</span>
                        <strong>{row.count.toLocaleString()}</strong>
                      </div>
                      <div className="trending-player-card-identity">
                        <PlayerIdentityRow
                          className="trending-player-card-main"
                          playerId={row.player_id}
                          playerName={row.name}
                          team={playerDetails?.team || row.team}
                          position={row.pos}
                          hideMeta
                        />
                      </div>
                      <div className="activity-card-meta-row">
                        <div className="trending-player-card-pills">
                          <TeamLogoPill team={playerDetails?.team || row.team} />
                          <PositionRankPill rank={row.currentPositionRank || (row.pos ? `${row.pos}-` : "-")} />
                          <span>{formatCompactValue(getPlayerValueForMode({
                            valueProfile: playerDetails?.valueProfile,
                            fallbackValue: row.ktcValue,
                            mode: leagueValueMode,
                            context: 'waiver',
                          }))}</span>
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
        <EmptyState className="trending-empty-card" title={`No ${title.toLowerCase()} available`} />
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
