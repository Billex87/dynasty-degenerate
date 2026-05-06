import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TeamLogoPill } from './TeamLogoPill';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { getPositionRankPillClass } from '@/lib/positionRank';
import { getTeamTileStyle } from '@/lib/teamTileStyle';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';
import type { RankingPlayer, RankingProfileOption, ReportData } from '@shared/types';

type PositionFilter = 'OVERALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'PICK';
type SortMode = 'rank' | 'value' | 'movement';

const POSITION_FILTERS: Array<{ key: PositionFilter; label: string }> = [
  { key: 'OVERALL', label: 'Overall' },
  { key: 'QB', label: 'QB' },
  { key: 'RB', label: 'RB' },
  { key: 'WR', label: 'WR' },
  { key: 'TE', label: 'TE' },
  { key: 'PICK', label: 'Picks' },
];

function formatValue(value?: number | null): string {
  if (!value) return '-';
  return value.toLocaleString();
}

function getCompactValue(value?: number | null): string {
  if (!value) return '-';
  if (value >= 1000) {
    const compact = value / 1000;
    return `${compact >= 10 ? Math.round(compact) : compact.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(value);
}

function getBoardFromProfile(profileKey?: string | null): 'dynasty' | 'devy' {
  return profileKey?.startsWith('devy') ? 'devy' : 'dynasty';
}

function getProfileFallback(options: RankingProfileOption[], board: 'dynasty' | 'devy'): string {
  return options.find((option) => option.board === board)?.key || '';
}

function getRankClass(rank?: string | null): string {
  return getPositionRankPillClass(rank || 'PICK', 'ranking-card-rank-pill');
}

function RankingPlayerIdentity({ player }: { player: RankingPlayer }) {
  if (player.imageUrl && !player.player_id) {
    return (
      <div className="ranking-player-identity">
        <img src={player.imageUrl} alt={player.name} className="ranking-player-image" loading="lazy" />
        <span>{player.name}</span>
      </div>
    );
  }

  return (
    <div className="ranking-player-identity">
      <PlayerNameWithHeadshot playerId={player.player_id} playerName={player.name} />
    </div>
  );
}

function RankingCard({
  player,
  playerDetailsById,
  viewerManager,
  onSelect,
}: {
  player: RankingPlayer;
  playerDetailsById?: ReportData['playerDetailsById'];
  viewerManager?: string | null;
  onSelect: (player: RankingPlayer) => void;
}) {
  const details = player.player_id ? playerDetailsById?.[player.player_id] : undefined;
  const movementClass = player.movementDirection === 'up'
    ? 'ranking-move-up'
    : player.movementDirection === 'down'
      ? 'ranking-move-down'
      : 'ranking-move-flat';

  return (
    <button
      type="button"
      className={`player-team-tile ranking-player-card ${viewerOwnedHighlightClass(player.owner, viewerManager)}`}
      style={getTeamTileStyle(details?.team || player.team)}
      onClick={() => onSelect(player)}
    >
      <div className="ranking-player-topline">
        <span className="ranking-overall-rank">#{player.overallRank}</span>
        <span className={`ranking-movement-pill ${movementClass}`}>
          {player.movementLabel || 'Stable'}
        </span>
      </div>

      <RankingPlayerIdentity player={player} />

      <div className="ranking-card-meta-row">
        <div className="ranking-card-pills">
          {player.isPick ? (
            <span className={getRankClass('PICK')}>PICK</span>
          ) : (
            <>
              <TeamLogoPill team={details?.team || player.team} />
              <span className={getRankClass(player.positionRank || player.pos)}>{player.positionRank || player.pos}</span>
            </>
          )}
          <span>{getCompactValue(player.value)}</span>
          {player.age ? <span>{player.age} yrs</span> : null}
        </div>
        <span className="ranking-owner-pill">{player.owner || 'FA'}</span>
      </div>

      <div className="ranking-source-row">
        <span>KTC {formatValue(player.ktcValue)}</span>
        <span>Flock {formatValue(player.flockValue)}</span>
        {player.fantasyCalcValue ? <span>FC {formatValue(player.fantasyCalcValue)}</span> : null}
        {player.previousYearPprAverage ? <span>{player.previousYearPprAverage.toFixed(1)} PPG</span> : null}
      </div>

      {player.isDevy && (player.college || player.draftYear) ? (
        <div className="ranking-devy-line">
          {player.college || 'College prospect'}
          {player.draftYear ? ` - ${player.draftYear}` : ''}
        </div>
      ) : null}
    </button>
  );
}

export function RankingsBoard({
  rankings,
  playerDetailsById,
  leagueId,
  leagueLogo,
  viewerManager,
}: {
  rankings?: ReportData['rankings'];
  playerDetailsById?: ReportData['playerDetailsById'];
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
}) {
  const profileOptions = rankings?.profileOptions || [];
  const [selectedProfileKey, setSelectedProfileKey] = useState(
    rankings?.defaultProfileKey || getProfileFallback(profileOptions, 'dynasty')
  );
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('OVERALL');
  const [sortMode, setSortMode] = useState<SortMode>('rank');
  const [query, setQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const board = getBoardFromProfile(selectedProfileKey);
  const boardOptions = profileOptions.filter((option) => option.board === board);
  const rows = rankings?.profiles?.[selectedProfileKey] || [];

  useEffect(() => {
    const nextProfileKey = rankings?.defaultProfileKey || getProfileFallback(profileOptions, 'dynasty');
    if (nextProfileKey) {
      setSelectedProfileKey(nextProfileKey);
      setPositionFilter('OVERALL');
      setSortMode('rank');
      setQuery('');
    }
  }, [rankings?.generatedAt, rankings?.defaultProfileKey, profileOptions]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows
      .filter((player) => positionFilter === 'OVERALL' || player.pos === positionFilter)
      .filter((player) => {
        if (!normalizedQuery) return true;
        return [
          player.name,
          player.team,
          player.college,
          player.owner,
          player.positionRank,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (sortMode === 'value') return b.value - a.value || a.overallRank - b.overallRank;
        if (sortMode === 'movement') return Math.abs(b.movement || 0) - Math.abs(a.movement || 0) || a.overallRank - b.overallRank;
        return a.overallRank - b.overallRank;
      })
      .slice(0, 180);
  }, [positionFilter, query, rows, sortMode]);

  const activeProfile = profileOptions.find((option) => option.key === selectedProfileKey);
  const topPlayers = rows.slice(0, 3);
  const sourceSummary = rows.reduce<Record<string, number>>((summary, player) => {
    for (const source of player.sources) {
      summary[source] = (summary[source] || 0) + 1;
    }
    return summary;
  }, {});

  const handleBoardChange = (nextBoard: 'dynasty' | 'devy') => {
    const fallback = nextBoard === 'devy'
      ? rankings?.defaultDevyProfileKey || getProfileFallback(profileOptions, 'devy')
      : rankings?.defaultProfileKey || getProfileFallback(profileOptions, 'dynasty');
    setSelectedProfileKey(fallback);
    setPositionFilter('OVERALL');
  };

  const handleSelectPlayer = (player: RankingPlayer) => {
    const details = player.player_id ? playerDetailsById?.[player.player_id] : undefined;
    setSelectedPlayer({
      player_id: player.player_id,
      playerName: player.name,
      playerPos: player.pos,
      currentPositionRank: player.positionRank || player.pos,
      currentKtcValue: player.value,
      valueGain: player.movement || undefined,
      valueChangeNote: player.movementLabel ? 'Recent ranking movement from Flock/KTC source data.' : undefined,
      manager: player.owner || undefined,
      playerDetails: details,
    });
  };

  if (!rankings || profileOptions.length === 0) {
    return (
      <div className="rankings-empty-state">
        Rankings are not available for this report yet.
      </div>
    );
  }

  return (
    <div className="rankings-board">
      <div className="rankings-hero-panel">
        <div>
          <div className="rankings-kicker">{activeProfile?.board === 'devy' ? 'College pipeline' : 'Market board'}</div>
          <h3>{activeProfile?.label || 'Rankings'}</h3>
          <p>
            Blended rankings use Flock as the dynasty anchor where available, KTC market value for profile-specific SF/1QB/TEP, and supporting FantasyCalc/FantasyPros inputs for NFL players.
          </p>
        </div>
        <div className="rankings-source-summary">
          {Object.entries(sourceSummary).slice(0, 4).map(([source, count]) => (
            <span key={source}>{source}: {count}</span>
          ))}
        </div>
      </div>

      <div className="rankings-controls">
        <div className="rankings-control-group rankings-board-toggle">
          <button type="button" className={board === 'dynasty' ? 'active' : ''} onClick={() => handleBoardChange('dynasty')}>Dynasty</button>
          <button type="button" className={board === 'devy' ? 'active' : ''} onClick={() => handleBoardChange('devy')}>Devy</button>
        </div>

        <div className="rankings-control-group rankings-profile-toggle">
          {boardOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={selectedProfileKey === option.key ? 'active' : ''}
              onClick={() => setSelectedProfileKey(option.key)}
            >
              {option.qbFormat === 'sf' ? 'SF' : '1QB'}{option.tep ? ` ${option.tep} TEP` : ''}
            </button>
          ))}
        </div>

        <div className="rankings-control-group rankings-position-toggle">
          {POSITION_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={positionFilter === filter.key ? 'active' : ''}
              onClick={() => setPositionFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="rankings-search-wrap">
          <Search className="h-4 w-4" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search player, team, manager"
            className="rankings-search-input"
          />
        </div>

        <div className="rankings-control-group rankings-sort-toggle">
          <button type="button" className={sortMode === 'rank' ? 'active' : ''} onClick={() => setSortMode('rank')}>Rank</button>
          <button type="button" className={sortMode === 'value' ? 'active' : ''} onClick={() => setSortMode('value')}>Value</button>
          <button type="button" className={sortMode === 'movement' ? 'active' : ''} onClick={() => setSortMode('movement')}>Movement</button>
        </div>
      </div>

      {topPlayers.length > 0 && (
        <div className="rankings-podium">
          {topPlayers.map((player) => (
            <div key={`podium-${player.id}`} className="rankings-podium-item">
              <span>#{player.overallRank}</span>
              <strong>{player.name}</strong>
              <em>{player.positionRank || player.pos} - {getCompactValue(player.value)}</em>
            </div>
          ))}
        </div>
      )}

      <div className="rankings-result-count">
        Showing {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()} ranked assets
      </div>

      <div className="rankings-player-grid">
        {filteredRows.map((player) => (
          <RankingCard
            key={player.id}
            player={player}
            playerDetailsById={playerDetailsById}
            viewerManager={viewerManager}
            onSelect={handleSelectPlayer}
          />
        ))}
      </div>

      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
      />
    </div>
  );
}
