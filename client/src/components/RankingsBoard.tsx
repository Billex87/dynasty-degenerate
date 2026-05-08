import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamLogoPill } from './TeamLogoPill';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { EmptyState, ManagerBadge } from './reportPrimitives';
import { getPositionRankPillClass } from '@/lib/positionRank';
import { getCachedDraftBuzzImageUrl, getCollegeInitials, getCollegeLogoUrl, getCollegeTileStyle, getTeamTileStyle, normalizeNflTeamAbbr } from '@/lib/teamTileStyle';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';
import type { DraftBuzzScoreboardEntry, PlayerDetails, RankingPlayer, RankingProfileOption, ReportData } from '@shared/types';

type PositionFilter = 'QB' | 'RB' | 'WR' | 'TE' | 'PICK';
type SortMode = 'rank' | 'value' | 'movement';
type DraftBuzzPosition = Exclude<PositionFilter, 'PICK'>;
type DraftBuzzSortMode = 'score' | 'forty' | 'height' | 'weight';

type RankingsTableConfig = {
  board: 'dynasty' | 'devy';
  title: string;
  kicker: string;
  description: string;
  defaultProfileKey?: string | null;
  hidePicks?: boolean;
};

const PAGE_SIZE = 25;
const DRAFT_BUZZ_PAGE_SIZE = 100;
const DRAFT_BUZZ_POSITIONS: DraftBuzzPosition[] = ['QB', 'RB', 'WR', 'TE'];
const POSITION_FILTERS: Array<{
  key: PositionFilter;
  label: string;
  compactLabel?: string;
}> = [
  { key: 'QB', label: 'QB' },
  { key: 'RB', label: 'RB' },
  { key: 'WR', label: 'WR' },
  { key: 'TE', label: 'TE' },
  { key: 'PICK', label: 'Pick', compactLabel: 'Pick' },
];

const NFL_TEAM_SEARCH_TERMS: Record<string, string[]> = {
  ARI: ['Arizona Cardinals', 'Cardinals', 'Arizona'],
  ATL: ['Atlanta Falcons', 'Falcons', 'Atlanta'],
  BAL: ['Baltimore Ravens', 'Ravens', 'Baltimore'],
  BUF: ['Buffalo Bills', 'Bills', 'Buffalo'],
  CAR: ['Carolina Panthers', 'Panthers', 'Carolina'],
  CHI: ['Chicago Bears', 'Bears', 'Chicago'],
  CIN: ['Cincinnati Bengals', 'Bengals', 'Cincinnati'],
  CLE: ['Cleveland Browns', 'Browns', 'Cleveland'],
  DAL: ['Dallas Cowboys', 'Cowboys', 'Dallas'],
  DEN: ['Denver Broncos', 'Broncos', 'Denver'],
  DET: ['Detroit Lions', 'Lions', 'Detroit'],
  GB: ['Green Bay Packers', 'Packers', 'Green Bay'],
  HOU: ['Houston Texans', 'Texans', 'Houston'],
  IND: ['Indianapolis Colts', 'Colts', 'Indianapolis'],
  JAX: ['Jacksonville Jaguars', 'Jaguars', 'Jacksonville', 'JAC'],
  KC: ['Kansas City Chiefs', 'Chiefs', 'Kansas City'],
  LAC: ['Los Angeles Chargers', 'LA Chargers', 'Chargers'],
  LAR: ['Los Angeles Rams', 'LA Rams', 'Rams'],
  LV: ['Las Vegas Raiders', 'Raiders', 'Las Vegas', 'Oakland Raiders'],
  MIA: ['Miami Dolphins', 'Dolphins', 'Miami'],
  MIN: ['Minnesota Vikings', 'Vikings', 'Minnesota'],
  NE: ['New England Patriots', 'Patriots', 'New England'],
  NO: ['New Orleans Saints', 'Saints', 'New Orleans'],
  NYG: ['New York Giants', 'Giants'],
  NYJ: ['New York Jets', 'Jets'],
  PHI: ['Philadelphia Eagles', 'Eagles', 'Philadelphia'],
  PIT: ['Pittsburgh Steelers', 'Steelers', 'Pittsburgh'],
  SEA: ['Seattle Seahawks', 'Seahawks', 'Seattle'],
  SF: ['San Francisco 49ers', '49ers', 'Niners', 'San Francisco'],
  TB: ['Tampa Bay Buccaneers', 'Buccaneers', 'Bucs', 'Tampa Bay'],
  TEN: ['Tennessee Titans', 'Titans', 'Tennessee'],
  WAS: ['Washington Commanders', 'Commanders', 'Washington'],
};

function formatValue(value?: number | null): string {
  if (!value) return '-';
  return value.toLocaleString();
}

function formatFantasyPointTotal(value?: number | null): string | null {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return numericValue.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
  });
}

function getPreviousSeasonRankPill(details?: PlayerDetails): { label: string; title: string } | null {
  const rank = details?.lastSeasonPositionRank;
  if (!rank) return null;

  const season = details.lastSeasonYear || 'Prev';
  const points = formatFantasyPointTotal(details.lastSeasonFantasyPoints);
  const pointsPerGame = formatFantasyPointTotal(details.lastSeasonPointsPerGame);
  const titleParts = [`${season} fantasy points rank: ${rank}`, points ? `${points} total points` : null, pointsPerGame ? `${pointsPerGame} PPG` : null].filter(Boolean);

  return {
    label: `${season} ${rank}`,
    title: titleParts.join(' • '),
  };
}

function getPreviousSeasonPointsPill(details?: PlayerDetails): { label: string; title: string } | null {
  const points = formatFantasyPointTotal(details?.lastSeasonFantasyPoints);
  if (!points) return null;

  const season = details?.lastSeasonYear || 'Previous season';
  const pointsPerGame = formatFantasyPointTotal(details?.lastSeasonPointsPerGame);
  const titleParts = [`${season} league-scoring fantasy points: ${points}`, pointsPerGame ? `${pointsPerGame} PPG` : null].filter(Boolean);

  return {
    label: `${points} pts`,
    title: titleParts.join(' • '),
  };
}

function getTeamSearchTerms(team?: string | null): string[] {
  const normalizedTeam = normalizeNflTeamAbbr(team);
  if (!normalizedTeam) return ['free agent', 'fa'];
  return [normalizedTeam, ...(NFL_TEAM_SEARCH_TERMS[normalizedTeam] || [])];
}

function getDraftClassValue(player: RankingPlayer): number | null {
  const year = Number(player.draftYear || player.prospectProfile?.draftYear || 0);
  return Number.isFinite(year) && year > 0 ? year : null;
}

function getProspectPositionRank(player: RankingPlayer): string {
  return player.positionRank || player.fantasyProsDevyPositionRank || player.prospectProfile?.fantasyProsDevyPositionRank || (player.prospectProfile?.positionRank ? `${player.pos}${player.prospectProfile.positionRank}` : null) || player.pos;
}

function getProspectProjection(player: RankingPlayer): string | null {
  return player.projectedRookiePick || player.prospectProfile?.projectedRookiePick || (player.draftYear ? `${player.draftYear} rookie class` : null);
}

function getDraftBuzzScore(player: RankingPlayer): number | null {
  const score = Number(player.prospectProfile?.rating || 0);
  return Number.isFinite(score) && score > 0 ? score : null;
}

function formatDraftBuzzScore(value?: number | null): string {
  const score = Number(value);
  if (!Number.isFinite(score) || score <= 0) return '-';
  return score.toFixed(Number.isInteger(score) ? 0 : 1);
}

function formatDraftBuzzForty(value?: number | null): string {
  const forty = Number(value);
  if (!Number.isFinite(forty) || forty <= 0) return '-';
  return `${forty.toFixed(2).replace(/0$/, '')}s`;
}

function formatDraftBuzzRank(value?: number | null, prefix = '#'): string {
  const rank = Number(value);
  if (!Number.isFinite(rank) || rank <= 0) return '-';
  return `${prefix}${rank.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(rank) ? 0 : 1,
  })}`;
}

function getDraftBuzzPositionRankLabel(player: DraftBuzzScoreboardEntry): string {
  const rank = Number(player.positionRank || 0);
  return Number.isFinite(rank) && rank > 0 ? `${player.position}${rank}` : player.position;
}

function formatDraftBuzzTrait(value?: string | number | null): string {
  return value === null || value === undefined || value === '' ? '-' : String(value);
}

function parseDraftBuzzHeight(value?: string | null): number | null {
  const match = String(value || '').match(/(\d+)\s*[-']\s*(\d+)/);
  if (!match) return null;
  const feet = Number(match[1]);
  const inches = Number(match[2]);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  return feet * 12 + inches;
}

function parseDraftBuzzWeight(value?: string | null): number | null {
  const parsed = Number(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNullableMetric(a: number | null, b: number | null, direction: 'asc' | 'desc') {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

function compareDraftBuzzRows(a: DraftBuzzScoreboardEntry, b: DraftBuzzScoreboardEntry, sortMode: DraftBuzzSortMode) {
  if (sortMode === 'forty') {
    const metricSort = compareNullableMetric(a.fortyYardDash ?? null, b.fortyYardDash ?? null, 'asc');
    if (metricSort) return metricSort;
  }

  if (sortMode === 'height') {
    const metricSort = compareNullableMetric(parseDraftBuzzHeight(a.height), parseDraftBuzzHeight(b.height), 'desc');
    if (metricSort) return metricSort;
  }

  if (sortMode === 'weight') {
    const metricSort = compareNullableMetric(parseDraftBuzzWeight(a.weight), parseDraftBuzzWeight(b.weight), 'desc');
    if (metricSort) return metricSort;
  }

  return b.rating - a.rating || (a.overallRank || 9999) - (b.overallRank || 9999) || a.draftYear - b.draftYear || a.position.localeCompare(b.position) || a.name.localeCompare(b.name);
}

function getProfileFallback(options: RankingProfileOption[], board: 'dynasty' | 'devy'): string {
  return options.find(option => option.board === board)?.key || '';
}

function getRankClass(rank?: string | null): string {
  return getPositionRankPillClass(rank || 'PICK', 'ranking-card-rank-pill');
}

function getPositionButtonClass(position: PositionFilter | 'OVERALL', active: boolean): string {
  return ['ranking-position-button', `ranking-position-button-${position.toLowerCase()}`, position === 'PICK' && !active ? 'ranking-position-button-optional' : '', active ? 'active' : ''].filter(Boolean).join(' ');
}

function getProfileButtonLabel(option: RankingProfileOption): string {
  const prefix = option.qbFormat === 'sf' ? 'SuperFlex' : 'Standard';
  if (!option.tep) return prefix;
  if (option.tep === 0.5) return `${prefix} TEP`;
  if (option.tep === 1) return `${prefix} TEP+`;
  return `${prefix} TEP++`;
}

function RankingPlayerIdentity({ player, team }: { player: RankingPlayer; team?: string | null }) {
  const preferredImageUrl = getCachedDraftBuzzImageUrl(player.imageUrl || player.prospectProfile?.playerImageUrl || null);
  const shouldUseRankingImage = Boolean(preferredImageUrl && (player.isDevy || !player.player_id));
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [preferredImageUrl]);

  if (shouldUseRankingImage && preferredImageUrl && !imageFailed) {
    return (
      <div className="ranking-player-identity">
        <img src={preferredImageUrl} alt={player.name} className="ranking-player-image" loading="lazy" onError={() => setImageFailed(true)} />
        <span>{player.name}</span>
      </div>
    );
  }

  return (
    <div className="ranking-player-identity">
      <PlayerNameWithHeadshot
        playerId={player.player_id}
        playerName={player.name}
        fallbackImageUrl={preferredImageUrl}
        team={team || player.team}
        position={player.pos}
      />
    </div>
  );
}

function RankingOwnerChip({ owner, managerAvatars }: { owner?: string | null; managerAvatars?: ReportData['managerAvatars'] }) {
  if (!owner) {
    return <ManagerBadge className="ranking-owner-chip ranking-owner-pill-fa" emptyLabel="FA" />;
  }

  return <ManagerBadge className="ranking-owner-chip" avatarUrl={managerAvatars?.[owner]} managerName={owner} />;
}

function RankingOwnerAvatar({ owner, managerAvatars }: { owner?: string | null; managerAvatars?: ReportData['managerAvatars'] }) {
  if (!owner)
    return (
      <span className="ranking-owner-avatar-fallback" aria-hidden="true">
        FA
      </span>
    );
  const avatarUrl = managerAvatars?.[owner];
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="ranking-owner-avatar-only" loading="lazy" aria-hidden="true" />;
  }
  return (
    <span className="ranking-owner-avatar-fallback" aria-hidden="true">
      {owner.slice(0, 2).toUpperCase()}
    </span>
  );
}

function CollegeTeamPill({ college, logoUrl }: { college?: string | null; logoUrl?: string | null }) {
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [college, logoUrl]);

  if (!college && !logoUrl) return null;
  const label = college || 'College';
  const logoSrc = logoFailed ? null : getCollegeLogoUrl(college, logoUrl);

  return (
    <span className="ranking-college-pill ranking-college-pill-icon-only" title={label} aria-label={label}>
      {logoSrc ? (
        <img src={logoSrc} alt="" loading="lazy" aria-hidden="true" onError={() => setLogoFailed(true)} />
      ) : (
        <span className="ranking-college-fallback-icon" aria-hidden="true">
          {getCollegeInitials(college)}
        </span>
      )}
    </span>
  );
}

function RankingValueRow({ player, playerDetailsById, managerAvatars, viewerManager, onSelect }: { player: RankingPlayer; playerDetailsById?: ReportData['playerDetailsById']; managerAvatars?: ReportData['managerAvatars']; viewerManager?: string | null; onSelect: (player: RankingPlayer) => void }) {
  const details = player.player_id ? playerDetailsById?.[player.player_id] : undefined;
  const prospectPills = player.isDevy && player.prospectProfile ? ([player.prospectProfile.role || null, player.prospectProfile.fortyYardDash ? `40 ${player.prospectProfile.fortyYardDash}s` : null, player.prospectProfile.height ? `Ht ${player.prospectProfile.height}` : null, player.prospectProfile.weight ? `Wt ${player.prospectProfile.weight}` : null, player.prospectProfile.rating ? `Score ${player.prospectProfile.rating}` : null].filter(Boolean) as string[]) : [];
  const showMovement = Boolean(player.movementLabel) || !player.isDevy;
  const movementClass = player.movementDirection === 'up' ? 'ranking-move-up' : player.movementDirection === 'down' ? 'ranking-move-down' : 'ranking-move-flat';
  const movementIcon = player.movementDirection === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : player.movementDirection === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : null;
  const rankMovementClass = player.rankMovementDirection === 'up' ? 'ranking-move-up' : player.rankMovementDirection === 'down' ? 'ranking-move-down' : 'ranking-move-flat';
  const rankMovementIcon = player.rankMovementDirection === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : player.rankMovementDirection === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : null;
  const hasRankMovement = Boolean(player.rankMovementLabel);
  const displayTeam = details?.team || player.team;
  const rankLabel = `#${player.overallRank}`;
  const valueLabel = player.isDevy ? getProspectPositionRank(player) : formatValue(player.value);
  const prospectProjection = player.isDevy ? getProspectProjection(player) : null;
  const positionLabel = player.isPick ? 'PICK' : player.isDevy ? player.pos : player.positionRank || player.pos;
  const previousSeasonRankPill = !player.isDevy && !player.isPick ? getPreviousSeasonRankPill(details) : null;
  const previousSeasonPointsPill = !player.isDevy && !player.isPick ? getPreviousSeasonPointsPill(details) : null;

  return (
    <button type="button" className={`player-team-tile ranking-player-card value-board__row value-board__mobile-card ${player.isDevy ? 'ranking-player-card-devy value-board__row-devy' : ''} ${viewerOwnedHighlightClass(player.owner, viewerManager)}`} style={player.isDevy ? getCollegeTileStyle(player.college) : getTeamTileStyle(details?.team || player.team)} onClick={() => onSelect(player)}>
      <div className="value-board__score">
        <span className="ranking-overall-rank value-board__rank">{rankLabel}</span>
        <span className="ranking-inline-value value-board__value">
          <span className="value-board__value-label">Value</span>
          <strong>{valueLabel}</strong>
        </span>
      </div>

      <div className="value-board__player">
        <RankingPlayerIdentity player={player} team={displayTeam} />
      </div>

      <div className="value-board__mobile-meta">
        <div className="value-board__team">{player.isPick ? <span className="ranking-owner-pill value-board__pick-team">Pick</span> : player.isDevy && player.college ? <CollegeTeamPill college={player.college} logoUrl={player.collegeLogoUrl || player.prospectProfile?.collegeLogoUrl} /> : <TeamLogoPill team={displayTeam} />}</div>

        <div className="ranking-card-pills value-board__meta">
          <span className={getRankClass(positionLabel)}>{positionLabel}</span>
        </div>

        {!player.isDevy && !player.isPick ? (
          <>
            <div className="ranking-card-pills value-board__previous-rank">
              {previousSeasonRankPill ? (
                <span className="ranking-last-season-rank-pill" title={previousSeasonRankPill.title}>
                  {previousSeasonRankPill.label}
                </span>
              ) : (
                <span className="ranking-last-season-empty">-</span>
              )}
            </div>

            <div className="ranking-card-pills value-board__previous-points">
              {previousSeasonPointsPill ? (
                <span className="ranking-last-season-points-pill" title={previousSeasonPointsPill.title}>
                  {previousSeasonPointsPill.label}
                </span>
              ) : (
                <span className="ranking-last-season-empty">-</span>
              )}
            </div>
          </>
        ) : null}

        <div className="ranking-card-pills value-board__age">
          {player.isDevy && player.draftYear ? (
            <span className="ranking-devy-class-pill">{player.draftYear}</span>
          ) : player.age ? (
            <span className="value-board__age-pill">
              <span className="value-board__age-short" aria-hidden="true">
                {player.age} yrs
              </span>
              <span className="value-board__age-full">{player.age} Year Old</span>
            </span>
          ) : (
            <span className="value-board__age-empty">-</span>
          )}
        </div>
      </div>

      <div className="value-board__manager">
        {player.isDevy ? (
          prospectProjection ? (
            <span className="ranking-devy-projection-pill">{prospectProjection}</span>
          ) : null
        ) : (
          <>
            <RankingOwnerChip owner={player.owner} managerAvatars={managerAvatars} />
            <RankingOwnerAvatar owner={player.owner} managerAvatars={managerAvatars} />
          </>
        )}
      </div>

      {player.isDevy ? (
        <div className="value-board__movement">
          <span className="ranking-source-count-pill">
            {player.sourceCount} input{player.sourceCount === 1 ? '' : 's'}
          </span>
        </div>
      ) : showMovement ? (
        <div className="value-board__movement">
          <span className={`ranking-movement-pill ${movementClass}`}>
            {player.movementLabel || 'Stable'}
            {movementIcon}
          </span>
        </div>
      ) : null}

      {player.isDevy && prospectPills.length ? (
        <div className="ranking-devy-line">
          {prospectPills.map(pill => (
            <span key={pill}>{pill}</span>
          ))}
        </div>
      ) : null}

      {hasRankMovement ? (
        <div className="value-board__trend" aria-label={`${player.name} board movement`}>
          <span className={`ranking-trend-pill ${rankMovementClass}`}>
            {player.rankMovementLabel}
            {rankMovementIcon}
          </span>
        </div>
      ) : null}
    </button>
  );
}

function DraftBuzzEntryIdentity({ entry }: { entry: DraftBuzzScoreboardEntry }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getCachedDraftBuzzImageUrl(entry.playerImageUrl);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  if (imageUrl && !imageFailed) {
    return (
      <span className="ranking-player-identity">
        <img src={imageUrl} alt={entry.name} className="ranking-player-image" loading="lazy" onError={() => setImageFailed(true)} />
        <span>{entry.name}</span>
      </span>
    );
  }

  return <PlayerNameWithHeadshot playerId={entry.player_id || undefined} playerName={entry.name} />;
}

function DraftBuzzTeamLogo({ entry }: { entry: DraftBuzzScoreboardEntry }) {
  const team = entry.nflTeam || entry.team || null;

  if (!team) {
    return (
      <span className="draftbuzz-table__empty-icon" aria-label="No NFL team">
        -
      </span>
    );
  }

  return (
    <span className="draftbuzz-table__logo-cell" title={team} aria-label={team}>
      <TeamLogoPill team={team} className="draftbuzz-team-school__team" />
    </span>
  );
}

function DraftBuzzSchoolLogo({ entry }: { entry: DraftBuzzScoreboardEntry }) {
  const school = entry.college || null;

  if (!school) {
    return (
      <span className="draftbuzz-table__empty-icon" aria-label="School unavailable">
        -
      </span>
    );
  }

  return (
    <span className="draftbuzz-table__logo-cell" title={school} aria-label={school}>
      <CollegeTeamPill college={school} logoUrl={entry.collegeLogoUrl} />
    </span>
  );
}

function DraftBuzzScoreboard({ entries, onSelectEntry }: { entries: DraftBuzzScoreboardEntry[]; onSelectEntry: (entry: DraftBuzzScoreboardEntry) => void }) {
  const [selectedDraftClass, setSelectedDraftClass] = useState<number | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<DraftBuzzPosition[]>([]);
  const [sortMode, setSortMode] = useState<DraftBuzzSortMode>('score');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const allRows = useMemo(() => {
    const deduped = new Map<string, DraftBuzzScoreboardEntry>();
    for (const entry of entries) {
      const score = entry.rating;
      const draftClass = entry.draftYear;
      const position = entry.position;
      if (!score || !draftClass || !DRAFT_BUZZ_POSITIONS.includes(position as DraftBuzzPosition)) continue;
      const key = `${draftClass}:${position}:${entry.name.toLowerCase()}`;
      const existing = deduped.get(key);
      if (!existing || score > existing.rating) {
        deduped.set(key, entry);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => b.rating - a.rating || (a.overallRank || 9999) - (b.overallRank || 9999) || a.draftYear - b.draftYear || a.position.localeCompare(b.position) || a.name.localeCompare(b.name));
  }, [entries]);

  const draftClassOptions = useMemo(() => Array.from(new Set(allRows.map(row => row.draftYear).filter((year): year is number => Boolean(year)))).sort((a, b) => a - b), [allRows]);
  const coverageLabel = draftClassOptions.length ? `${draftClassOptions[0]}-${draftClassOptions[draftClassOptions.length - 1]} classes` : null;

  useEffect(() => {
    if (selectedDraftClass && !draftClassOptions.includes(selectedDraftClass)) {
      setSelectedDraftClass(null);
    }
  }, [draftClassOptions, selectedDraftClass]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allRows
      .filter(row => {
        if (selectedDraftClass && row.draftYear !== selectedDraftClass) return false;
        if (selectedPositions.length && !selectedPositions.includes(row.position as DraftBuzzPosition)) return false;
        if (!normalizedQuery) return true;

        return [row.name, row.college, row.nflTeam, row.team, row.position, row.draftYear, row.rating, row.fortyYardDash, row.height, row.weight, getDraftBuzzPositionRankLabel(row)].some(value =>
          String(value || '')
            .toLowerCase()
            .includes(normalizedQuery)
        );
      })
      .sort((a, b) => compareDraftBuzzRows(a, b, sortMode));
  }, [allRows, query, selectedDraftClass, selectedPositions, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / DRAFT_BUZZ_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * DRAFT_BUZZ_PAGE_SIZE, currentPage * DRAFT_BUZZ_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, selectedDraftClass, selectedPositions, sortMode]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const togglePosition = (position: DraftBuzzPosition) => {
    setSelectedPositions(current => (current.includes(position) ? current.filter(item => item !== position) : [...current, position]));
  };

  if (!allRows.length) {
    return (
      <section className="rankings-table-section draftbuzz-scoreboard" aria-label="Prospect score archive">
        <EmptyState className="rankings-empty-state" title="No prospect scores are available yet." />
      </section>
    );
  }

  return (
    <section className="rankings-table-section draftbuzz-scoreboard" aria-label="Prospect score archive">
      <div className="rankings-hero-panel draftbuzz-scoreboard__hero">
        <div>
          <div className="rankings-kicker">Scouting Data Archive</div>
          <h3>Prospect Score Archive</h3>
          <p>Draft Buzz scouting scores organized by class, position rank, NFL team match, school, and verified measurables where available.</p>
          <div className="draftbuzz-scoreboard__badges" aria-label="Prospect archive coverage">
            <span>Draft Buzz Scouting Scores</span>
            {coverageLabel ? <span>{coverageLabel}</span> : null}
            <span>{allRows.length.toLocaleString()} scored players</span>
          </div>
        </div>
      </div>

      <div className="draftbuzz-controls value-board__toolbar">
        <div className="rankings-search-wrap value-board__search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search player, school, class" className="rankings-search-input" />
        </div>

        <div className="rankings-control-group rankings-class-toggle" aria-label="Draft class filter">
          <button type="button" className={!selectedDraftClass ? 'active' : ''} aria-pressed={!selectedDraftClass} onClick={() => setSelectedDraftClass(null)}>
            All
          </button>
          {draftClassOptions.map(draftClass => (
            <button key={draftClass} type="button" className={selectedDraftClass === draftClass ? 'active' : ''} aria-pressed={selectedDraftClass === draftClass} onClick={() => setSelectedDraftClass(draftClass)}>
              {draftClass}
            </button>
          ))}
        </div>

        <div className="rankings-control-group draftbuzz-sort-toggle value-board__draftbuzz-sort" aria-label="Prospect archive sort">
          <button type="button" className={sortMode === 'score' ? 'active' : ''} aria-pressed={sortMode === 'score'} onClick={() => setSortMode('score')}>
            Score
          </button>
          <button type="button" className={sortMode === 'forty' ? 'active' : ''} aria-pressed={sortMode === 'forty'} onClick={() => setSortMode('forty')}>
            40
          </button>
          <button type="button" className={sortMode === 'height' ? 'active' : ''} aria-pressed={sortMode === 'height'} onClick={() => setSortMode('height')}>
            Height
          </button>
          <button type="button" className={sortMode === 'weight' ? 'active' : ''} aria-pressed={sortMode === 'weight'} onClick={() => setSortMode('weight')}>
            Weight
          </button>
        </div>

        <div className="rankings-control-group rankings-position-toggle" aria-label="Prospect position filter">
          <button type="button" className={getPositionButtonClass('OVERALL', selectedPositions.length === 0)} aria-label="Overall" aria-pressed={selectedPositions.length === 0} onClick={() => setSelectedPositions([])}>
            <span className="ranking-filter-label-full" aria-hidden="true">
              Overall
            </span>
            <span className="ranking-filter-label-compact" aria-hidden="true">
              OVR
            </span>
          </button>
          {DRAFT_BUZZ_POSITIONS.map(position => (
            <button key={position} type="button" className={getPositionButtonClass(position, selectedPositions.includes(position))} aria-pressed={selectedPositions.includes(position)} onClick={() => togglePosition(position)}>
              {position}
            </button>
          ))}
        </div>
      </div>

      <div className="rankings-result-count">
        Showing {pageRows.length.toLocaleString()} of {filteredRows.length.toLocaleString()} scored prospects
      </div>

      <div className="draftbuzz-table">
        <div className="draftbuzz-table__header" aria-hidden="true">
          <span>Class</span>
          <span>Rank</span>
          <span>Player</span>
          <span>Team</span>
          <span>School</span>
          <span>Pos</span>
          <span>Score</span>
          <span>40</span>
          <span>Height</span>
          <span>Weight</span>
        </div>
        {pageRows.map(player => (
          <button type="button" key={player.id} className="draftbuzz-table__row" style={getTeamTileStyle(player.nflTeam || player.team) || getCollegeTileStyle(player.college)} onClick={() => onSelectEntry(player)}>
            <span className="draftbuzz-table__class">{player.draftYear}</span>
            <span className="draftbuzz-table__rank">{formatDraftBuzzRank(player.overallRank)}</span>
            <span className="draftbuzz-table__player">
              <DraftBuzzEntryIdentity entry={player} />
            </span>
            <span className="draftbuzz-table__team">
              <DraftBuzzTeamLogo entry={player} />
            </span>
            <span className="draftbuzz-table__school">
              <DraftBuzzSchoolLogo entry={player} />
            </span>
            <span className={getRankClass(player.position)}>{getDraftBuzzPositionRankLabel(player)}</span>
            <strong className="draftbuzz-table__score">{formatDraftBuzzScore(player.rating)}</strong>
            <span className="draftbuzz-table__forty">{formatDraftBuzzForty(player.fortyYardDash)}</span>
            <span className="draftbuzz-table__height">{formatDraftBuzzTrait(player.height)}</span>
            <span className="draftbuzz-table__weight">{formatDraftBuzzTrait(player.weight)}</span>
          </button>
        ))}
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState className="rankings-empty-state" title="No prospect scores match those filters." />
      ) : (
        <div className="rankings-pagination" aria-label="Prospect archive pagination">
          <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </button>
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <button type="button" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount}>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

function RankingsTable({ config, rankings, playerDetailsById, managerAvatars, viewerManager, onSelectPlayer, onSelectDraftBuzzEntry }: { config: RankingsTableConfig; rankings: NonNullable<ReportData['rankings']>; playerDetailsById?: ReportData['playerDetailsById']; managerAvatars?: ReportData['managerAvatars']; viewerManager?: string | null; onSelectPlayer: (player: RankingPlayer) => void; onSelectDraftBuzzEntry: (entry: DraftBuzzScoreboardEntry) => void }) {
  const profileOptions = rankings.profileOptions || [];
  const boardOptions = profileOptions.filter(option => option.board === config.board);
  const [selectedProfileKey, setSelectedProfileKey] = useState(config.defaultProfileKey || getProfileFallback(profileOptions, config.board));
  const [selectedPositions, setSelectedPositions] = useState<PositionFilter[]>([]);
  const [includePicksWithOverall, setIncludePicksWithOverall] = useState(false);
  const [selectedDraftClass, setSelectedDraftClass] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('rank');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const nextProfileKey = config.defaultProfileKey || getProfileFallback(profileOptions, config.board);
    if (nextProfileKey) {
      setSelectedProfileKey(nextProfileKey);
      setSelectedPositions([]);
      setIncludePicksWithOverall(false);
      setSelectedDraftClass(null);
      setSortMode('rank');
      setQuery('');
      setPage(1);
    }
  }, [config.board, config.defaultProfileKey, profileOptions, rankings.generatedAt]);

  const rows = rankings.profiles?.[selectedProfileKey] || [];
  const activeProfile = profileOptions.find(option => option.key === selectedProfileKey);
  const activeProfileLabel = activeProfile ? getProfileButtonLabel(activeProfile) : null;
  const isLeagueMatchedProfile = Boolean(config.defaultProfileKey && selectedProfileKey === config.defaultProfileKey);
  const canIncludePicksWithOverall = config.board === 'dynasty' && !config.hidePicks;
  const draftClassOptions = useMemo(() => {
    if (config.board !== 'devy') return [];
    return Array.from(new Set(rows.map(getDraftClassValue).filter((year): year is number => Boolean(year)))).sort((a, b) => a - b);
  }, [config.board, rows]);

  useEffect(() => {
    if (selectedDraftClass && !draftClassOptions.includes(selectedDraftClass)) {
      setSelectedDraftClass(null);
    }
  }, [draftClassOptions, selectedDraftClass]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows
      .filter(player => {
        if (config.hidePicks && player.isPick) return false;
        if (config.board === 'devy' && (player.isPick || !player.isDevy)) return false;
        if (selectedPositions.length === 0) {
          return includePicksWithOverall && canIncludePicksWithOverall ? true : !player.isPick;
        }
        return selectedPositions.includes(player.pos as PositionFilter);
      })
      .filter(player => config.board !== 'devy' || !selectedDraftClass || getDraftClassValue(player) === selectedDraftClass)
      .filter(player => {
        if (!normalizedQuery) return true;
        const details = player.player_id ? playerDetailsById?.[player.player_id] : undefined;
        const team = details?.team || player.team;
        return [player.name, team, ...getTeamSearchTerms(team), player.college, player.owner, player.positionRank, player.pos].some(value =>
          String(value || '')
            .toLowerCase()
            .includes(normalizedQuery)
        );
      })
      .sort((a, b) => {
        if (config.board === 'devy') return a.overallRank - b.overallRank;
        if (sortMode === 'value') return b.value - a.value || a.overallRank - b.overallRank;
        if (sortMode === 'movement') return Math.abs(b.movement || 0) - Math.abs(a.movement || 0) || a.overallRank - b.overallRank;
        return a.overallRank - b.overallRank;
      });
  }, [canIncludePicksWithOverall, config.board, config.hidePicks, includePicksWithOverall, playerDetailsById, query, rows, selectedDraftClass, selectedPositions, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [includePicksWithOverall, query, selectedDraftClass, selectedPositions, selectedProfileKey, sortMode]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const togglePosition = (position: PositionFilter) => {
    if (position === 'PICK') {
      if (canIncludePicksWithOverall && selectedPositions.length === 0) {
        setIncludePicksWithOverall(current => !current);
        return;
      }

      setIncludePicksWithOverall(false);
      setSelectedPositions(current => (current.length === 1 && current[0] === 'PICK' ? [] : ['PICK']));
      return;
    }

    setIncludePicksWithOverall(false);
    setSelectedPositions(current => (current.includes(position) ? current.filter(item => item !== position) : [...current.filter(item => item !== 'PICK'), position]));
  };

  const selectOverall = () => {
    if (canIncludePicksWithOverall && selectedPositions.length === 1 && selectedPositions[0] === 'PICK') {
      setSelectedPositions([]);
      setIncludePicksWithOverall(true);
      return;
    }

    setSelectedPositions([]);
    setIncludePicksWithOverall(false);
  };

  return (
    <section className="rankings-table-section">
      <div className="rankings-hero-panel">
        <div>
          <div className="rankings-kicker">{config.kicker}</div>
          <h3>{config.title}</h3>
          <p>{config.description}</p>
          {activeProfileLabel ? (
            <span className="rankings-active-profile" aria-label={`${isLeagueMatchedProfile ? 'League-matched type' : 'Selected type'}: ${activeProfileLabel}`}>
              <span className="rankings-active-profile-label" aria-hidden="true">
                {isLeagueMatchedProfile ? 'League-matched type' : 'Selected type'}
              </span>
              <span className="rankings-active-profile-label-mobile" aria-hidden="true">
                {isLeagueMatchedProfile ? 'Matched' : 'Type'}
              </span>
              : {activeProfileLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className={`rankings-controls value-board__toolbar ${!config.hidePicks && config.board === 'dynasty' ? 'rankings-controls-with-picks' : ''} ${config.board === 'devy' ? 'rankings-controls-devy' : ''}`}>
        <div className="rankings-league-type-control">
          <label className="rankings-league-type-label" htmlFor={`${config.board}-league-type`}>
            League Type
          </label>
          <Select value={selectedProfileKey} onValueChange={setSelectedProfileKey}>
            <SelectTrigger id={`${config.board}-league-type`} className="rankings-league-type-trigger">
              <SelectValue placeholder="League Type" />
            </SelectTrigger>
            <SelectContent className="rankings-league-type-menu" align="start">
              {boardOptions.map(option => (
                <SelectItem key={option.key} value={option.key} className="rankings-league-type-option">
                  {getProfileButtonLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rankings-search-wrap value-board__search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search player, manager, team" className="rankings-search-input" />
        </div>

        {config.board !== 'devy' ? (
          <div className="rankings-control-group rankings-sort-toggle value-board__sort">
            <button type="button" className={sortMode === 'rank' ? 'active' : ''} aria-pressed={sortMode === 'rank'} onClick={() => setSortMode('rank')}>
              Rank
            </button>
            <button type="button" className={sortMode === 'value' ? 'active' : ''} aria-pressed={sortMode === 'value'} onClick={() => setSortMode('value')}>
              Value
            </button>
            <button type="button" className={sortMode === 'movement' ? 'active' : ''} aria-pressed={sortMode === 'movement'} onClick={() => setSortMode('movement')}>
              7-Day
            </button>
          </div>
        ) : null}

        {config.board === 'devy' && draftClassOptions.length ? (
          <div className="rankings-control-group rankings-class-toggle value-board__class" aria-label="Draft class filter">
            <button type="button" className={!selectedDraftClass ? 'active' : ''} aria-pressed={!selectedDraftClass} onClick={() => setSelectedDraftClass(null)}>
              All
            </button>
            {draftClassOptions.map(draftClass => (
              <button key={draftClass} type="button" className={selectedDraftClass === draftClass ? 'active' : ''} aria-pressed={selectedDraftClass === draftClass} onClick={() => setSelectedDraftClass(draftClass)}>
                {draftClass}
              </button>
            ))}
          </div>
        ) : null}

        <div className="rankings-control-group rankings-position-toggle value-board__filters">
          <button type="button" className={getPositionButtonClass('OVERALL', selectedPositions.length === 0)} aria-label="Overall" aria-pressed={selectedPositions.length === 0} onClick={selectOverall}>
            <span className="ranking-filter-label-full" aria-hidden="true">
              Overall
            </span>
            <span className="ranking-filter-label-compact" aria-hidden="true">
              OVR
            </span>
          </button>
          {POSITION_FILTERS.filter(filter => !config.hidePicks || filter.key !== 'PICK').map(filter => (
            <button key={filter.key} type="button" className={getPositionButtonClass(filter.key, selectedPositions.includes(filter.key) || (filter.key === 'PICK' && includePicksWithOverall && selectedPositions.length === 0))} aria-label={filter.label} aria-pressed={selectedPositions.includes(filter.key) || (filter.key === 'PICK' && includePicksWithOverall && selectedPositions.length === 0)} onClick={() => togglePosition(filter.key)}>
              {filter.compactLabel && filter.compactLabel !== filter.label ? (
                <>
                  <span className="ranking-filter-label-full" aria-hidden="true">
                    {filter.label}
                  </span>
                  <span className="ranking-filter-label-compact" aria-hidden="true">
                    {filter.compactLabel}
                  </span>
                </>
              ) : (
                filter.label
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="rankings-result-count">
        Showing {pageRows.length.toLocaleString()} of {filteredRows.length.toLocaleString()} ranked assets
      </div>

      <div className={`rankings-player-grid value-board__rows ${config.board === 'devy' ? 'value-board__rows-devy' : ''}`}>
        <div className="value-board__row-header" aria-hidden="true">
          <span>Rank</span>
          <span>Player</span>
          <span>{config.board === 'devy' ? 'School' : 'Team'}</span>
          <span>{config.board === 'devy' ? 'Pos Rank' : 'Pos Rank'}</span>
          {config.board !== 'devy' ? <span>Prev Finish</span> : null}
          {config.board !== 'devy' ? <span>Last Yr Pts</span> : null}
          <span>{config.board === 'devy' ? 'Class' : 'Age'}</span>
          <span>{config.board === 'devy' ? 'Projection' : 'Manager'}</span>
          <span>Rank +/-</span>
          <span>{config.board === 'devy' ? 'Inputs' : '7-Day'}</span>
          <span>{config.board === 'devy' ? 'Pos Rank' : 'Value'}</span>
        </div>
        {pageRows.map(player => (
          <RankingValueRow key={player.id} player={player} playerDetailsById={playerDetailsById} managerAvatars={managerAvatars} viewerManager={viewerManager} onSelect={onSelectPlayer} />
        ))}
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState className="rankings-empty-state" title="No rankings match those filters." />
      ) : (
        <div className="rankings-pagination" aria-label={`${config.title} pagination`}>
          <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </button>
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <button type="button" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount}>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

export function RankingsBoard({ rankings, playerDetailsById, managerAvatars, leagueId, leagueLogo, viewerManager, board = 'all', hidePicks = false }: { rankings?: ReportData['rankings']; playerDetailsById?: ReportData['playerDetailsById']; managerAvatars?: ReportData['managerAvatars']; leagueId?: string; leagueLogo?: string | null; viewerManager?: string | null; board?: 'all' | 'dynasty' | 'devy' | 'draftbuzz'; hidePicks?: boolean }) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);

  const handleSelectPlayer = (player: RankingPlayer) => {
    const details = player.player_id ? playerDetailsById?.[player.player_id] : undefined;
    const prospectPositionRank = player.positionRank || player.fantasyProsDevyPositionRank || player.prospectProfile?.fantasyProsDevyPositionRank || (player.prospectProfile?.positionRank ? `${player.pos}${player.prospectProfile.positionRank}` : null) || player.pos;
    const prospectOnlyDetails = player.prospectProfile
      ? {
          fullName: player.name,
          position: player.pos,
          team: player.team || null,
          college: player.prospectProfile.college || player.college || null,
          age: player.age || player.prospectProfile.fantasyProsDevyAge || null,
          height: player.prospectProfile.height || null,
          weight: player.prospectProfile.weight || null,
          prospectProfile: player.prospectProfile,
        }
      : undefined;
    const rankingOnlyDetails: PlayerDetails | undefined =
      !player.isDevy && !player.isPick
        ? {
            playerId: player.player_id,
            fullName: player.name,
            position: player.pos,
            team: player.team || null,
            age: player.age || null,
            valueProfile: {
              dynastyValue: player.value,
              dynastyPositionRank: player.positionRank || player.pos,
              marketKtc: player.ktcValue || null,
              flockFantasy: player.flockValue || null,
              fantasyCalcDynasty: player.fantasyCalcValue || null,
              dynastyProcess: player.dynastyProcessValue || null,
              dynastyNerds: player.dynastyNerdsValue || null,
              dynastyDealerBenchmark: player.dynastyDealerBenchmark || null,
              dynastyDealerVoteRating: player.dynastyDealerVoteRating || null,
              sources: player.sources || [],
            },
          }
        : undefined;
    setSelectedPlayer({
      player_id: player.player_id,
      playerName: player.name,
      playerPos: player.pos,
      currentPositionRank: player.isDevy ? prospectPositionRank : player.positionRank || player.pos,
      currentKtcValue: player.isDevy ? undefined : player.value,
      valueGain: player.movement || undefined,
      valueChangeNote: player.movementLabel ? 'Blended value change over the last 7 days.' : undefined,
      manager: player.owner || undefined,
      managerAvatarUrl: player.owner ? managerAvatars?.[player.owner] : null,
      playerImageUrl: player.imageUrl || player.prospectProfile?.playerImageUrl || null,
      collegeLogoUrl: player.collegeLogoUrl || player.prospectProfile?.collegeLogoUrl || null,
      isCollegeProspect: player.isDevy,
      playerDetails: details
        ? {
            ...details,
            prospectProfile: player.prospectProfile || details.prospectProfile || null,
          }
        : prospectOnlyDetails || rankingOnlyDetails,
    });
  };

  const handleSelectDraftBuzzEntry = (entry: DraftBuzzScoreboardEntry) => {
    const details = entry.player_id ? playerDetailsById?.[entry.player_id] : undefined;
    const draftYear = Number(entry.draftYear || entry.prospectProfile.draftYear || 0);
    const currentYear = new Date().getFullYear();
    const prospectDetails: PlayerDetails = {
      playerId: entry.player_id || undefined,
      fullName: entry.name,
      position: entry.position,
      team: entry.team || null,
      college: entry.college || null,
      age: entry.age || null,
      height: entry.height || null,
      weight: entry.weight || null,
      prospectProfile: entry.prospectProfile,
    };

    setSelectedPlayer({
      player_id: entry.player_id || undefined,
      playerName: entry.name,
      playerPos: entry.position,
      currentPositionRank: entry.positionRank ? `${entry.position}${entry.positionRank}` : entry.position,
      manager: undefined,
      playerImageUrl: entry.playerImageUrl || null,
      collegeLogoUrl: entry.collegeLogoUrl || null,
      isCollegeProspect: draftYear > currentYear,
      preferProspectImage: true,
      playerDetails: details ? { ...details, prospectProfile: entry.prospectProfile } : prospectDetails,
    });
  };

  if (!rankings || !rankings.profileOptions?.length) {
    return <EmptyState className="rankings-empty-state" title="Rankings are not available for this report yet." />;
  }

  const tableConfigs = (
    [
      {
        board: 'dynasty',
        title: 'Dynasty Value Board',
        kicker: 'League-matched values',
        description: 'Format-aware dynasty player and pick values matched to this league type. Use the selector to compare how the board shifts across SuperFlex, Standard, and TE-premium rooms.',
        defaultProfileKey: rankings.defaultProfileKey,
        hidePicks,
      },
      {
        board: 'devy',
        title: 'College Prospect Board',
        kicker: 'Future rookie pipeline',
        description: 'College-only rankings use the same QB and TE-premium profile as this league, with verified prospect measurables layered in where available.',
        defaultProfileKey: rankings.defaultDevyProfileKey,
        hidePicks: true,
      },
    ] satisfies RankingsTableConfig[]
  ).filter(config => board === 'all' || config.board === board);
  const showDraftBuzzScoreboard = board === 'all' || board === 'draftbuzz';

  return (
    <div className="rankings-board">
      {tableConfigs.map(config => (
        <RankingsTable key={config.board} config={config} rankings={rankings} playerDetailsById={playerDetailsById} managerAvatars={managerAvatars} viewerManager={viewerManager} onSelectPlayer={handleSelectPlayer} onSelectDraftBuzzEntry={handleSelectDraftBuzzEntry} />
      ))}

      {showDraftBuzzScoreboard ? rankings.draftBuzzScoreboard?.length ? <DraftBuzzScoreboard entries={rankings.draftBuzzScoreboard} onSelectEntry={handleSelectDraftBuzzEntry} /> : <EmptyState className="rankings-empty-state" title="Prospect score archive is not available for this report yet." /> : null}

      <PlayerDetailModal isOpen={selectedPlayer !== null} onClose={() => setSelectedPlayer(null)} pick={selectedPlayer} leagueId={leagueId} leagueLogo={leagueLogo} managerAvatars={managerAvatars} />
    </div>
  );
}
