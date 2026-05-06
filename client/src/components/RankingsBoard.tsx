import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamLogoPill } from './TeamLogoPill';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { getPositionRankPillClass } from '@/lib/positionRank';
import { getCollegeTileStyle, getTeamTileStyle } from '@/lib/teamTileStyle';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';
import type { RankingPlayer, RankingProfileOption, ReportData } from '@shared/types';

type PositionFilter = 'QB' | 'RB' | 'WR' | 'TE' | 'PICK';
type SortMode = 'rank' | 'value' | 'movement';

type RankingsTableConfig = {
  board: 'dynasty' | 'devy';
  title: string;
  kicker: string;
  description: string;
  defaultProfileKey?: string | null;
};

const PAGE_SIZE = 25;
const POSITION_FILTERS: Array<{ key: PositionFilter; label: string }> = [
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

function formatMarketPulse(value?: number | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.abs(value) >= 10 ? Math.round(value).toLocaleString() : value.toFixed(1).replace(/\.0$/, '');
}

function getCompactValue(value?: number | null): string {
  if (!value) return '-';
  if (value >= 1000) {
    const compact = value / 1000;
    return `${compact >= 10 ? Math.round(compact) : compact.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(value);
}

function getProfileFallback(options: RankingProfileOption[], board: 'dynasty' | 'devy'): string {
  return options.find((option) => option.board === board)?.key || '';
}

function getRankClass(rank?: string | null): string {
  return getPositionRankPillClass(rank || 'PICK', 'ranking-card-rank-pill');
}

function getPositionButtonClass(position: PositionFilter | 'OVERALL', active: boolean): string {
  return ['ranking-position-button', `ranking-position-button-${position.toLowerCase()}`, active ? 'active' : ''].filter(Boolean).join(' ');
}

function getProfileButtonLabel(option: RankingProfileOption): string {
  const prefix = option.qbFormat === 'sf' ? 'SuperFlex' : '1QB';
  if (!option.tep) return prefix;
  if (option.tep === 0.5) return `${prefix} TEP`;
  if (option.tep === 1) return `${prefix} TEP+`;
  return `${prefix} TEP++`;
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

function RankingOwnerChip({
  owner,
  managerAvatars,
}: {
  owner?: string | null;
  managerAvatars?: ReportData['managerAvatars'];
}) {
  if (!owner) {
    return <span className="ranking-owner-pill ranking-owner-pill-fa">FA</span>;
  }

  return (
    <span className="ranking-owner-chip">
      <ManagerNameWithAvatar avatarUrl={managerAvatars?.[owner]} managerName={owner} />
    </span>
  );
}

function CollegeTeamPill({ college }: { college?: string | null }) {
  if (!college) return null;
  return (
    <span className="ranking-college-pill" title={college}>
      {college}
    </span>
  );
}

function RankingCard({
  player,
  playerDetailsById,
  managerAvatars,
  viewerManager,
  onSelect,
}: {
  player: RankingPlayer;
  playerDetailsById?: ReportData['playerDetailsById'];
  managerAvatars?: ReportData['managerAvatars'];
  viewerManager?: string | null;
  onSelect: (player: RankingPlayer) => void;
}) {
  const details = player.player_id ? playerDetailsById?.[player.player_id] : undefined;
  const sourceInputs: Array<[string, number | null | undefined]> = [
    ['KTC', player.ktcValue],
    ['Flock', player.flockValue],
    ['Nerds', player.dynastyNerdsValue],
    ['FC', player.fantasyCalcValue],
    ['DP', player.dynastyProcessValue],
    ['Dealer', player.dynastyDealerBenchmark],
  ].filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0);
  const marketPulse = formatMarketPulse(player.dynastyDealerVoteRating);
  const movementClass = player.movementDirection === 'up'
    ? 'ranking-move-up'
    : player.movementDirection === 'down'
      ? 'ranking-move-down'
      : 'ranking-move-flat';
  const displayTeam = details?.team || player.team;

  return (
    <button
      type="button"
      className={`player-team-tile ranking-player-card ${player.isDevy ? 'ranking-player-card-devy' : ''} ${viewerOwnedHighlightClass(player.owner, viewerManager)}`}
      style={player.isDevy ? getCollegeTileStyle(player.college) : getTeamTileStyle(details?.team || player.team)}
      onClick={() => onSelect(player)}
    >
      <div className="ranking-player-topline">
        <span className="ranking-overall-rank">#{player.overallRank}</span>
        <span className={`ranking-movement-pill ${movementClass}`}>
          {player.movementLabel || 'No 7D'}
        </span>
      </div>

      <div className="ranking-player-main">
        <RankingPlayerIdentity player={player} />
        <div className="ranking-card-pills">
          {player.isPick ? (
            <span className={getRankClass('PICK')}>PICK</span>
          ) : (
            <>
              {player.isDevy && player.college ? <CollegeTeamPill college={player.college} /> : <TeamLogoPill team={displayTeam} />}
              <span className={getRankClass(player.positionRank || player.pos)}>{player.positionRank || player.pos}</span>
            </>
          )}
          <span>{getCompactValue(player.value)}</span>
          {player.age ? <span>{player.age} yrs</span> : null}
        </div>
      </div>

      <div className="ranking-card-meta-row">
        <RankingOwnerChip owner={player.owner} managerAvatars={managerAvatars} />
      </div>

      {player.isDevy && (player.prospectProfile || player.college || player.draftYear) ? (
        <div className="ranking-devy-line">
          <span>{player.prospectProfile?.role || player.college || 'College prospect'}</span>
          {player.prospectProfile?.fortyYardDash ? <span>40: {player.prospectProfile.fortyYardDash}s</span> : null}
          {player.draftYear ? <span>{player.draftYear} class</span> : null}
        </div>
      ) : null}

      {sourceInputs.length ? (
        <div className="ranking-source-row" aria-label={`${player.name} source values`}>
          {sourceInputs.map(([label, value]) => (
            <span key={label}>{label} {formatValue(value)}</span>
          ))}
          {marketPulse !== null ? <span>Market pulse {marketPulse}</span> : null}
        </div>
      ) : null}
    </button>
  );
}

function RankingsTable({
  config,
  rankings,
  playerDetailsById,
  managerAvatars,
  viewerManager,
  onSelectPlayer,
}: {
  config: RankingsTableConfig;
  rankings: NonNullable<ReportData['rankings']>;
  playerDetailsById?: ReportData['playerDetailsById'];
  managerAvatars?: ReportData['managerAvatars'];
  viewerManager?: string | null;
  onSelectPlayer: (player: RankingPlayer) => void;
}) {
  const profileOptions = rankings.profileOptions || [];
  const boardOptions = profileOptions.filter((option) => option.board === config.board);
  const [selectedProfileKey, setSelectedProfileKey] = useState(
    config.defaultProfileKey || getProfileFallback(profileOptions, config.board)
  );
  const [selectedPositions, setSelectedPositions] = useState<PositionFilter[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('rank');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const nextProfileKey = config.defaultProfileKey || getProfileFallback(profileOptions, config.board);
    if (nextProfileKey) {
      setSelectedProfileKey(nextProfileKey);
      setSelectedPositions([]);
      setSortMode('rank');
      setQuery('');
      setPage(1);
    }
  }, [config.board, config.defaultProfileKey, profileOptions, rankings.generatedAt]);

  const rows = rankings.profiles?.[selectedProfileKey] || [];
  const activeProfile = profileOptions.find((option) => option.key === selectedProfileKey);
  const activeProfileLabel = activeProfile ? getProfileButtonLabel(activeProfile) : null;
  const isLeagueMatchedProfile = Boolean(config.defaultProfileKey && selectedProfileKey === config.defaultProfileKey);
  const sourceInputCount = new Set(rows.flatMap((player) => player.sources)).size;

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows
      .filter((player) => selectedPositions.length === 0 || selectedPositions.includes(player.pos as PositionFilter))
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
      });
  }, [query, rows, selectedPositions, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, selectedPositions, selectedProfileKey, sortMode]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const togglePosition = (position: PositionFilter) => {
    setSelectedPositions((current) => (
      current.includes(position)
        ? current.filter((item) => item !== position)
        : [...current, position]
    ));
  };

  return (
    <section className="rankings-table-section">
      <div className="rankings-hero-panel">
        <div>
          <div className="rankings-kicker">{config.kicker}</div>
          <h3>{config.title}</h3>
          <p>{config.description}</p>
          {activeProfileLabel ? (
            <span className="rankings-active-profile">
              {isLeagueMatchedProfile ? 'League-matched type' : 'Selected type'}: {activeProfileLabel}
            </span>
          ) : null}
        </div>
        <div className="rankings-source-summary">
          <span>{rows.length.toLocaleString()} ranked assets</span>
          <span>{sourceInputCount} value input{sourceInputCount === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="rankings-controls">
        <div className="rankings-league-type-control">
          <label className="rankings-league-type-label" htmlFor={`${config.board}-league-type`}>
            League Type
          </label>
          <Select value={selectedProfileKey} onValueChange={setSelectedProfileKey}>
            <SelectTrigger id={`${config.board}-league-type`} className="rankings-league-type-trigger">
              <SelectValue placeholder="League Type" />
            </SelectTrigger>
            <SelectContent className="rankings-league-type-menu" align="start">
              {boardOptions.map((option) => (
                <SelectItem key={option.key} value={option.key} className="rankings-league-type-option">
                  {getProfileButtonLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rankings-control-group rankings-position-toggle">
          <button
            type="button"
            className={getPositionButtonClass('OVERALL', selectedPositions.length === 0)}
            onClick={() => setSelectedPositions([])}
          >
            Overall
          </button>
          {POSITION_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={getPositionButtonClass(filter.key, selectedPositions.includes(filter.key))}
              onClick={() => togglePosition(filter.key)}
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
          <button type="button" className={sortMode === 'movement' ? 'active' : ''} onClick={() => setSortMode('movement')}>7-Day</button>
        </div>
      </div>

      <div className="rankings-result-count">
        Showing {pageRows.length.toLocaleString()} of {filteredRows.length.toLocaleString()} ranked assets
      </div>

      <div className="rankings-player-grid">
        {pageRows.map((player) => (
          <RankingCard
            key={player.id}
            player={player}
            playerDetailsById={playerDetailsById}
            managerAvatars={managerAvatars}
            viewerManager={viewerManager}
            onSelect={onSelectPlayer}
          />
        ))}
      </div>

      {filteredRows.length === 0 ? (
        <div className="rankings-empty-state">No rankings match those filters.</div>
      ) : (
        <div className="rankings-pagination" aria-label={`${config.title} pagination`}>
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </button>
          <span>Page {currentPage} of {pageCount}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount}>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

export function RankingsBoard({
  rankings,
  playerDetailsById,
  managerAvatars,
  leagueId,
  leagueLogo,
  viewerManager,
}: {
  rankings?: ReportData['rankings'];
  playerDetailsById?: ReportData['playerDetailsById'];
  managerAvatars?: ReportData['managerAvatars'];
  leagueId?: string;
  leagueLogo?: string | null;
  viewerManager?: string | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);

  const handleSelectPlayer = (player: RankingPlayer) => {
    const details = player.player_id ? playerDetailsById?.[player.player_id] : undefined;
    const prospectOnlyDetails = player.prospectProfile ? {
      fullName: player.name,
      position: player.pos,
      team: player.team || null,
      college: player.college || player.prospectProfile.college || null,
      prospectProfile: player.prospectProfile,
    } : undefined;
    setSelectedPlayer({
      player_id: player.player_id,
      playerName: player.name,
      playerPos: player.pos,
      currentPositionRank: player.positionRank || player.pos,
      currentKtcValue: player.value,
      valueGain: player.movement || undefined,
      valueChangeNote: player.movementLabel ? 'Blended value change over the last 7 days.' : undefined,
      manager: player.owner || undefined,
      managerAvatarUrl: player.owner ? managerAvatars?.[player.owner] : null,
      playerDetails: details
        ? { ...details, prospectProfile: player.prospectProfile || details.prospectProfile || null }
        : prospectOnlyDetails,
    });
  };

  if (!rankings || !rankings.profileOptions?.length) {
    return (
      <div className="rankings-empty-state">
        Rankings are not available for this report yet.
      </div>
    );
  }

  const tableConfigs: RankingsTableConfig[] = [
    {
      board: 'dynasty',
      title: 'Dynasty Market Board',
      kicker: 'League-matched values',
      description: 'Format-aware dynasty player and pick values matched to this league type. Use the selector to compare how the board shifts across SuperFlex, 1QB, and TE-premium rooms.',
      defaultProfileKey: rankings.defaultProfileKey,
    },
    {
      board: 'devy',
      title: 'College Prospect Board',
      kicker: 'Future rookie pipeline',
      description: 'College rankings use the same QB and TE-premium profile as this league so devy and future rookie values stay aligned with the room you are actually playing in.',
      defaultProfileKey: rankings.defaultDevyProfileKey,
    },
  ];

  return (
    <div className="rankings-board">
      {tableConfigs.map((config) => (
        <RankingsTable
          key={config.board}
          config={config}
          rankings={rankings}
          playerDetailsById={playerDetailsById}
          managerAvatars={managerAvatars}
          viewerManager={viewerManager}
          onSelectPlayer={handleSelectPlayer}
        />
      ))}

      <PlayerDetailModal
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        pick={selectedPlayer}
        leagueId={leagueId}
        leagueLogo={leagueLogo}
        managerAvatars={managerAvatars}
      />
    </div>
  );
}
