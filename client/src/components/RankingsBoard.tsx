import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowDownUp, ArrowUp, ChevronLeft, ChevronRight, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamLogoPill } from './TeamLogoPill';
import { PlayerDetailModal, type PlayerModalData } from './PlayerDetailModal';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { EmptyState, ManagerBadge } from './reportPrimitives';
import { trpc } from '@/lib/trpc';
import { getPositionRankClass, getPositionRankPillClass } from '@/lib/positionRank';
import { getCachedDraftBuzzImageUrl, getCollegeInitials, getCollegeLogoUrl, getCollegeTileStyle, getTeamTileStyle, normalizeNflTeamAbbr } from '@/lib/teamTileStyle';
import { viewerOwnedHighlightClass } from '@/lib/viewerHighlight';
import type { DraftBuzzScoreboardEntry, PlayerDetails, RankingPlayer, RankingProfileOption, ReportData } from '@shared/types';
import {
  getLeagueModeCopy,
  getPlayerRankForMode,
  getPlayerValueForMode,
  getPrimaryValueLabel,
  normalizeLeagueValueMode,
  type LeagueValueMode,
} from '@/lib/leagueValueMode';
import { readBooleanParam, readCsvParam, readEnumParam, readNumberParam, getUrlSearchParam, replaceUrlSearchParams } from '@/lib/reportUrlState';

type PositionFilter = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'PICK';
type SortMode = 'rank' | 'value' | 'movement';
type MovementSortDirection = 'down' | 'up';
type DraftBuzzPosition = Exclude<PositionFilter, 'K' | 'DEF' | 'PICK'>;
type SortDirection = 'asc' | 'desc';
type DraftBuzzSortKey = 'class' | 'rank' | 'player' | 'team' | 'school' | 'position' | 'score' | 'forty' | 'vertical' | 'height' | 'weight';
type DraftBuzzSort = {
  key: DraftBuzzSortKey;
  direction: SortDirection;
};
type ProspectTraitKind = 'role' | 'height' | 'weight' | 'forty';
type ProspectTrait = {
  kind: ProspectTraitKind;
  label: string;
};

type RankingsTableConfig = {
  board: 'dynasty' | 'redraft' | 'devy';
  title: string;
  kicker: string;
  description: string;
  defaultProfileKey?: string | null;
  hidePicks?: boolean;
  leagueValueMode: LeagueValueMode;
  valueLabel: string;
};

const PAGE_SIZE = 25;
const DRAFT_BUZZ_PAGE_SIZE = 25;
const SORT_MODES: readonly SortMode[] = ['rank', 'value', 'movement'];
const MOVEMENT_SORT_DIRECTIONS: readonly MovementSortDirection[] = ['down', 'up'];
const SORT_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];
const POSITION_FILTER_KEYS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'PICK'] as const;
const DRAFT_BUZZ_POSITIONS: DraftBuzzPosition[] = ['QB', 'RB', 'WR', 'TE'];
const DRAFT_BUZZ_SORT_KEYS: readonly DraftBuzzSortKey[] = ['class', 'rank', 'player', 'team', 'school', 'position', 'score', 'forty', 'vertical', 'height', 'weight'];
const DRAFT_BUZZ_SORT_COLUMNS: Array<{ key: DraftBuzzSortKey; label: string }> = [
  { key: 'class', label: 'Class' },
  { key: 'rank', label: 'Rank' },
  { key: 'player', label: 'Player' },
  { key: 'team', label: 'Team' },
  { key: 'school', label: 'School' },
  { key: 'position', label: 'Pos' },
  { key: 'score', label: 'Score' },
  { key: 'forty', label: '40' },
  { key: 'vertical', label: 'Vert' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
];
const POSITION_FILTERS: Array<{
  key: PositionFilter;
  label: string;
  compactLabel?: string;
}> = [
  { key: 'QB', label: 'QB' },
  { key: 'RB', label: 'RB' },
  { key: 'WR', label: 'WR' },
  { key: 'TE', label: 'TE' },
  { key: 'K', label: 'K' },
  { key: 'DEF', label: 'DEF' },
  { key: 'PICK', label: 'Pick', compactLabel: 'Pick' },
];

function getRankingsUrlPrefix(board: RankingsTableConfig['board']) {
  if (board === 'devy') return 'devy';
  if (board === 'redraft') return 'redraft';
  return 'rank';
}

function getProfileRowCount(rankings: NonNullable<ReportData['rankings']>, profileKey?: string | null): number {
  if (!profileKey) return 0;
  const rows = rankings.profiles?.[profileKey];
  if (Array.isArray(rows) && rows.length > 0) return rows.length;
  return rankings.profileRowCounts?.[profileKey] || 0;
}

function getPositionFilters(board: RankingsTableConfig['board'], hidePicks = false) {
  return POSITION_FILTERS.filter((filter) => {
    if (board === 'redraft') return filter.key !== 'PICK';
    if (filter.key === 'K' || filter.key === 'DEF') return false;
    return !hidePicks || filter.key !== 'PICK';
  });
}

function readPositionFiltersParam(paramName: string, hidePicks = false, board: RankingsTableConfig['board'] = 'dynasty'): PositionFilter[] {
  const allowed = new Set(getPositionFilters(board, hidePicks).map((filter) => filter.key));
  return readCsvParam(paramName).filter((value): value is PositionFilter => {
    if (!POSITION_FILTER_KEYS.includes(value as PositionFilter)) return false;
    return allowed.has(value as PositionFilter);
  });
}

function readDraftBuzzPositionsParam(paramName: string): DraftBuzzPosition[] {
  return readCsvParam(paramName).filter((value): value is DraftBuzzPosition => DRAFT_BUZZ_POSITIONS.includes(value as DraftBuzzPosition));
}

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

function getPreviousSeasonSummary(details?: PlayerDetails): { label: string; compactLabel: string; title: string } | null {
  const rank = details?.lastSeasonPositionRank?.trim();
  const points = formatFantasyPointTotal(details?.lastSeasonFantasyPoints);
  const pointsPerGame = formatFantasyPointTotal(details?.lastSeasonPointsPerGame);
  if (!rank && !points) return null;

  const season = details?.lastSeasonYear || null;
  const seasonShortLabel = season ? String(season).slice(-2) : null;
  const titleParts = [
    rank ? `position rank ${rank}` : null,
    points ? `${points} fantasy points` : null,
    pointsPerGame ? `${pointsPerGame} PPG` : null,
  ].filter(Boolean);

  return {
    label: seasonShortLabel ? `${seasonShortLabel} Totals:` : 'Totals:',
    compactLabel: [rank, points ? `${points} pts` : null].filter(Boolean).join(', '),
    title: `${season || 'Previous season'} production: ${titleParts.join(' - ')}`,
  };
}

function getTeamSearchTerms(team?: string | null): string[] {
  const normalizedTeam = normalizeNflTeamAbbr(team);
  if (!normalizedTeam) return ['free agent', 'fa'];
  return [normalizedTeam, ...(NFL_TEAM_SEARCH_TERMS[normalizedTeam] || [])];
}

function getRankingSearchTerms(player: RankingPlayer, details?: PlayerDetails): string[] {
  const team = details?.team || player.team;
  const prospect = player.prospectProfile;
  const valueProfile = details?.valueProfile;
  const terms = [
    player.name,
    team,
    ...getTeamSearchTerms(team),
    player.college,
    player.owner,
    player.pos,
    player.positionRank,
    player.overallRank,
    player.value,
    player.seasonValue,
    player.ktcValue,
    player.flockValue,
    player.fantasyProsDynastyValue,
    player.dynastyNerdsValue,
    player.fantasyNerdsValue,
    player.fantasyCalcValue,
    player.dynastyProcessValue,
    player.dynastyDealerBenchmark,
    player.dynastyDealerVoteRating,
    player.fantasyProsValue,
    player.movementLabel,
    player.rankMovementLabel,
    player.projectedRookiePick,
    player.fantasyProsDevyPositionRank,
    player.fantasyProsDevyRank,
    player.draftYear,
    player.age,
    ...player.sources,
    valueProfile?.dynastyValue,
    valueProfile?.seasonValue,
    valueProfile?.contenderValue,
    valueProfile?.rebuilderValue,
    valueProfile?.balancedValue,
    valueProfile?.dynastyPositionRank,
    valueProfile?.seasonPositionRank,
    valueProfile?.contenderPositionRank,
    valueProfile?.rebuilderPositionRank,
    valueProfile?.balancedPositionRank,
    valueProfile?.marketKtc,
    valueProfile?.flockFantasy,
    valueProfile?.fantasyProsDynasty,
    valueProfile?.fantasyCalcDynasty,
    valueProfile?.fantasyCalcRedraft,
    valueProfile?.dynastyProcess,
    valueProfile?.dynastyNerds,
    valueProfile?.fantasyNerds,
    valueProfile?.dynastyDealerBenchmark,
    valueProfile?.dynastyDealerVoteRating,
    valueProfile?.fantasyProsSeasonValue,
    ...(valueProfile?.sources || []),
    prospect?.role,
    prospect?.college,
    prospect?.nflTeam,
    prospect?.projectedRookiePick,
    prospect?.classYear,
    prospect?.status,
    prospect?.height,
    prospect?.weight,
    prospect?.fortyYardDash,
    prospect?.summary,
    prospect?.fantasyProsDevyRank,
    prospect?.fantasyProsDevyPositionRank,
    prospect?.fantasyProsDevyAge,
    prospect?.fantasyProsDevyBestRank,
    prospect?.fantasyProsDevyWorstRank,
    prospect?.fantasyProsDevyAverageRank,
  ];

  return terms
    .flatMap((value) => {
      if (value === null || value === undefined || value === '') return [];
      if (Array.isArray(value)) return value;
      return [String(value)];
    })
    .map((value) => value.trim())
    .filter(Boolean);
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
  return `${(Math.floor((forty + Number.EPSILON) * 100) / 100).toFixed(2)}s`;
}

function getDraftBuzzVertical(entry: DraftBuzzScoreboardEntry): number | null {
  const vertical = Number(entry.athleticProfile?.vertical);
  return Number.isFinite(vertical) && vertical > 0 ? vertical : null;
}

function formatDraftBuzzVertical(value?: number | null): string {
  const vertical = Number(value);
  if (!Number.isFinite(vertical) || vertical <= 0) return '-';
  return `${vertical.toFixed(Number.isInteger(vertical) ? 0 : 1)}"`;
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

function compareNullableText(a?: string | number | null, b?: string | number | null, direction: SortDirection = 'asc') {
  const valueA = String(a || '').trim();
  const valueB = String(b || '').trim();
  if (!valueA && !valueB) return 0;
  if (!valueA) return 1;
  if (!valueB) return -1;
  const compared = valueA.localeCompare(valueB, undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? compared : -compared;
}

function compareDraftBuzzDefaultRows(a: DraftBuzzScoreboardEntry, b: DraftBuzzScoreboardEntry) {
  return b.rating - a.rating || (a.overallRank || 9999) - (b.overallRank || 9999) || a.draftYear - b.draftYear || a.position.localeCompare(b.position) || a.name.localeCompare(b.name);
}

function compareDraftBuzzRows(a: DraftBuzzScoreboardEntry, b: DraftBuzzScoreboardEntry, sort: DraftBuzzSort) {
  const { key, direction } = sort;
  let result = 0;

  if (key === 'class') result = compareNullableMetric(a.draftYear || null, b.draftYear || null, direction);
  if (key === 'rank') result = compareNullableMetric(a.overallRank || null, b.overallRank || null, direction);
  if (key === 'player') result = compareNullableText(a.name, b.name, direction);
  if (key === 'team') result = compareNullableText(a.nflTeam || a.team, b.nflTeam || b.team, direction);
  if (key === 'school') result = compareNullableText(a.college, b.college, direction);
  if (key === 'position') result = compareNullableText(getDraftBuzzPositionRankLabel(a), getDraftBuzzPositionRankLabel(b), direction);
  if (key === 'score') result = compareNullableMetric(a.rating || null, b.rating || null, direction);
  if (key === 'forty') result = compareNullableMetric(a.fortyYardDash ?? null, b.fortyYardDash ?? null, direction);
  if (key === 'vertical') result = compareNullableMetric(getDraftBuzzVertical(a), getDraftBuzzVertical(b), direction);
  if (key === 'height') result = compareNullableMetric(parseDraftBuzzHeight(a.height), parseDraftBuzzHeight(b.height), direction);
  if (key === 'weight') result = compareNullableMetric(parseDraftBuzzWeight(a.weight), parseDraftBuzzWeight(b.weight), direction);

  return result || compareDraftBuzzDefaultRows(a, b);
}

function getDefaultDraftBuzzSortDirection(key: DraftBuzzSortKey): SortDirection {
  return key === 'rank' || key === 'player' || key === 'team' || key === 'school' || key === 'position' || key === 'forty' ? 'asc' : 'desc';
}

function normalizeDraftBuzzSourceImageUrl(url?: string | null): string | null {
  const trimmed = String(url || '').trim();
  if (!trimmed || trimmed.startsWith('/assets/draftbuzz-cache') || /noImage/i.test(trimmed)) return null;
  const normalized = trimmed.replace('/Content/PlayerHeadShotsSmall/', '/Content/PlayerHeadShots/');
  if (/^https?:\/\//i.test(normalized)) return normalized.replace(/^http:/i, 'https:');
  if (normalized.startsWith('/')) return `https://www.nfldraftbuzz.com${normalized}`;
  return `https://www.nfldraftbuzz.com/${normalized}`;
}

function toDraftBuzzAssetSlugPart(value?: string | null, separator = '-'): string | null {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bA\s*&\s*M\b/gi, 'AANDM')
    .replace(/&/g, 'AND')
    .replace(/\./g, '')
    .replace(/[^A-Za-z0-9]+/g, separator);
  const compacted = separator
    ? normalized
        .replace(new RegExp(`${separator}+`, 'g'), separator)
        .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '')
    : normalized;
  return compacted || null;
}

function getDraftBuzzGeneratedHeadshotUrl(entry: DraftBuzzScoreboardEntry): string | null {
  const nameSlug = toDraftBuzzAssetSlugPart(entry.name, '-');
  const schoolSlug = toDraftBuzzAssetSlugPart(entry.college, '');
  if (!nameSlug || !entry.position || !schoolSlug) return null;
  return `https://www.nfldraftbuzz.com/Content/PlayerHeadShots/${nameSlug}-${entry.position}-${schoolSlug}.png`;
}

function buildDraftBuzzHeadshotCandidates(entry: DraftBuzzScoreboardEntry): string[] {
  const candidates = [
    getCachedDraftBuzzImageUrl(entry.playerImageUrl),
    normalizeDraftBuzzSourceImageUrl(entry.playerImageUrl),
    getDraftBuzzGeneratedHeadshotUrl(entry),
  ].filter((url): url is string => Boolean(url));

  return Array.from(new Set(candidates));
}

function getProfileFallback(options: RankingProfileOption[], board: RankingsTableConfig['board']): string {
  return options.find(option => option.board === board)?.key || '';
}

function getRankClass(rank?: string | null): string {
  return getPositionRankPillClass(rank || 'PICK', 'ranking-card-rank-pill');
}

function getPositionButtonClass(position: PositionFilter | 'OVERALL', active: boolean): string {
  return ['ranking-position-button', `ranking-position-button-${position.toLowerCase()}`, position === 'PICK' && !active ? 'ranking-position-button-optional' : '', active ? 'active' : ''].filter(Boolean).join(' ');
}

function getProfileButtonLabel(option: RankingProfileOption): string {
  if (option.board === 'redraft') {
    if (option.ppr === 1) return 'PPR';
    if (option.ppr === 0.5) return 'Half PPR';
    if (option.ppr === 0) return 'Standard';
    return option.label.replace(/^Redraft\s+/i, '');
  }

  const prefix = option.qbFormat === 'sf' ? 'SuperFlex' : 'Standard';
  if (!option.tep) return prefix;
  if (option.tep === 0.5) return `${prefix} TEP`;
  if (option.tep === 1) return `${prefix} TEP+`;
  return `${prefix} TEP++`;
}

function getPickYearSuffix(player: RankingPlayer): string {
  const draftYear = Number(player.draftYear || 0);
  if (Number.isFinite(draftYear) && draftYear > 0) {
    return String(draftYear % 100).padStart(2, '0');
  }

  const yearMatch = player.name.match(/\b(20\d{2})\b/);
  if (yearMatch) return yearMatch[1].slice(-2);

  return 'PK';
}

function RankingPlayerIdentity({ player, team }: { player: RankingPlayer; team?: string | null }) {
  const preferredImageUrl = getCachedDraftBuzzImageUrl(player.imageUrl || player.prospectProfile?.playerImageUrl || null);
  const shouldUseRankingImage = Boolean(preferredImageUrl && (player.isDevy || !player.player_id));
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [preferredImageUrl]);

  if (player.isPick) {
    return (
      <div className="ranking-player-identity ranking-player-identity-pick">
        <span className="ranking-pick-avatar" aria-hidden="true">
          {getPickYearSuffix(player)}
        </span>
        <span>{player.name}</span>
      </div>
    );
  }

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

function isRedraftSourceLabel(source: string): boolean {
  return /redraft|season|fantasypros season|fantasypros draft|myfantasyleague|fleaflicker|yahoo|nfl fantasy/i.test(source)
    || /^fantasypros$/i.test(source.trim());
}

function getRankingSearchPlaceholder(board: RankingsTableConfig['board'], leagueValueMode: LeagueValueMode): string {
  if (board === 'devy') {
    return 'Search player, school, class, rank, measurables';
  }

  return leagueValueMode === 'redraft'
    ? 'Search player, team, manager, college, position, season value, movement'
    : 'Search player, team, manager, college, position, rank, value, movement';
}

function getRankingValueProfile(
  player: RankingPlayer,
  details: PlayerDetails | undefined,
  leagueValueMode: LeagueValueMode,
): PlayerDetails['valueProfile'] | undefined {
  if (details?.valueProfile) return details.valueProfile;
  if (player.isDevy || player.isPick) return undefined;

  const isRedraftRankingRow = leagueValueMode === 'redraft' || player.sources?.some(isRedraftSourceLabel);
  return {
    dynastyValue: isRedraftRankingRow ? null : player.value,
    seasonValue: isRedraftRankingRow ? player.seasonValue ?? player.value : player.seasonValue ?? player.fantasyProsValue ?? null,
    dynastyPositionRank: isRedraftRankingRow ? null : player.positionRank || player.pos,
    seasonPositionRank: isRedraftRankingRow || player.seasonValue ? player.positionRank || player.pos : null,
    marketKtc: isRedraftRankingRow ? null : player.ktcValue || null,
    flockFantasy: isRedraftRankingRow ? null : player.flockValue || null,
    fantasyProsDynasty: isRedraftRankingRow ? null : player.fantasyProsDynastyValue || null,
    fantasyCalcDynasty: isRedraftRankingRow ? null : player.fantasyCalcValue || null,
    fantasyCalcRedraft: isRedraftRankingRow ? player.fantasyCalcValue || null : null,
    dynastyProcess: isRedraftRankingRow ? null : player.dynastyProcessValue || null,
    dynastyNerds: isRedraftRankingRow ? null : player.dynastyNerdsValue || null,
    fantasyNerds: isRedraftRankingRow ? null : player.fantasyNerdsValue || null,
    dynastyDealerBenchmark: isRedraftRankingRow ? null : player.dynastyDealerBenchmark || null,
    fantasyProsSeasonValue: player.fantasyProsValue || null,
    sources: player.sources || [],
  };
}

function RankingValueRow({ player, config, playerDetailsById, managerAvatars, viewerManager, onSelect, showAIReads }: { player: RankingPlayer; config: RankingsTableConfig; playerDetailsById?: ReportData['playerDetailsById']; managerAvatars?: ReportData['managerAvatars']; viewerManager?: string | null; onSelect: (player: RankingPlayer) => void; showAIReads?: boolean }) {
  const details = player.player_id ? playerDetailsById?.[player.player_id] : undefined;
  const rankingValueProfile = getRankingValueProfile(player, details, config.leagueValueMode);
  const prospectPills = player.isDevy && player.prospectProfile ? ([
    player.prospectProfile.role ? { kind: 'role', label: player.prospectProfile.role } : null,
    player.prospectProfile.fortyYardDash ? { kind: 'forty', label: `40 Yd: ${formatDraftBuzzForty(player.prospectProfile.fortyYardDash)}` } : null,
    player.prospectProfile.height ? { kind: 'height', label: `HT ${player.prospectProfile.height}` } : null,
    player.prospectProfile.weight ? { kind: 'weight', label: `WT ${player.prospectProfile.weight}` } : null,
  ].filter(Boolean) as ProspectTrait[]) : [];
  const prospectScore = player.isDevy ? getDraftBuzzScore(player) : null;
  const showMovement = Boolean(player.movementLabel) || !player.isDevy;
  const movementClass = player.movementDirection === 'up' ? 'ranking-move-up' : player.movementDirection === 'down' ? 'ranking-move-down' : 'ranking-move-flat';
  const movementIcon = player.movementDirection === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : player.movementDirection === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : null;
  const rankMovementClass = player.rankMovementDirection === 'up' ? 'ranking-move-up' : player.rankMovementDirection === 'down' ? 'ranking-move-down' : 'ranking-move-flat';
  const rankMovementIcon = player.rankMovementDirection === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : player.rankMovementDirection === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : null;
  const hasRankMovement = Boolean(player.rankMovementLabel);
  const displayTeam = details?.team || player.team;
  const rankLabel = `#${player.overallRank}`;
  const fallbackValue = config.leagueValueMode === 'redraft'
    ? player.seasonValue ?? player.fantasyProsValue ?? player.value
    : player.value;
  const primaryValue = getPlayerValueForMode({
    valueProfile: rankingValueProfile,
    fallbackValue,
    mode: config.leagueValueMode,
    context: 'rankings',
  });
  const valueLabel = player.isDevy ? getProspectPositionRank(player) : formatValue(primaryValue);
  const valueClassName = [
    'ranking-inline-value',
    'value-board__value',
    player.isDevy ? 'value-board__value-position' : '',
    player.isDevy ? getPositionRankClass(valueLabel) : '',
  ].filter(Boolean).join(' ');
  const prospectProjection = player.isDevy ? getProspectProjection(player) : null;
  const positionLabel = player.isPick ? 'PICK' : player.isDevy ? player.pos : getPlayerRankForMode({
    valueProfile: rankingValueProfile,
    fallbackRank: player.positionRank || player.pos,
    mode: config.leagueValueMode,
    context: 'rankings',
  }) || player.pos;
  const previousSeasonSummary = !player.isDevy && !player.isPick ? getPreviousSeasonSummary(details) : null;
  const rowClassName = [
    'player-team-tile',
    'ranking-player-card',
    'value-board__row',
    'value-board__mobile-card',
    player.isDevy ? 'ranking-player-card-devy value-board__row-devy' : '',
    player.isPick ? 'ranking-player-card-pick ranking-player-card-static' : '',
    viewerOwnedHighlightClass(player.owner, viewerManager),
  ].filter(Boolean).join(' ');
  const rowStyle = player.isDevy ? getCollegeTileStyle(player.college) : getTeamTileStyle(details?.team || player.team);
  const rowContent = (
    <>
      <div className="value-board__score">
        <span className="ranking-overall-rank value-board__rank">{rankLabel}</span>
        <span className={valueClassName}>
          <span className="value-board__value-label">{config.board === 'devy' ? 'Rank' : config.valueLabel}</span>
          <strong>{valueLabel}</strong>
        </span>
      </div>

      {player.isDevy ? (
        <strong className={`value-board__prospect-score ${prospectScore ? '' : 'value-board__prospect-score-empty'}`} aria-label={prospectScore ? `${player.name} buzz score ${formatDraftBuzzScore(prospectScore)}` : `${player.name} buzz score unavailable`}>
          {formatDraftBuzzScore(prospectScore)}
        </strong>
      ) : null}

      <div className="value-board__player">
        <RankingPlayerIdentity player={player} team={displayTeam} />
      </div>

      {!player.isDevy ? (
        <div className="value-board__mobile-primary">
          <span className="value-board__mobile-rank">{rankLabel}</span>
          <span className="value-board__mobile-value">
            <span>Value</span>
            <strong>{valueLabel}</strong>
          </span>
        </div>
      ) : null}

      <div className="value-board__mobile-meta">
        <div className="value-board__team">
          {player.isPick ? (
            <span className="value-board__team-empty" aria-label="No NFL team assigned">-</span>
          ) : player.isDevy && player.college ? (
            <>
              <CollegeTeamPill college={player.college} logoUrl={player.collegeLogoUrl || player.prospectProfile?.collegeLogoUrl} />
              <span className="value-board__team-label">{player.college}</span>
            </>
          ) : (
            <TeamLogoPill team={displayTeam} />
          )}
        </div>

        <div className="ranking-card-pills value-board__meta">
          <span className={getRankClass(positionLabel)}>{positionLabel}</span>
        </div>

        <div className="ranking-card-pills value-board__age">
          {player.isDevy && player.draftYear ? (
            <span className="ranking-devy-class-pill">{player.draftYear}</span>
          ) : player.isDevy ? (
            <span className="ranking-devy-class-pill ranking-devy-class-pill-empty">-</span>
          ) : player.age ? (
            <span className="value-board__age-pill" title={`${player.age} year old`}>
              <span className="value-board__age-full">{player.age} Year Old</span>
              <span className="value-board__age-short">{player.age} YO</span>
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

      {!player.isDevy && showMovement ? (
        <div className="value-board__movement">
          <span className={`ranking-movement-pill ${movementClass}`}>
            {player.movementLabel || 'Stable'}
            {movementIcon}
          </span>
          {!player.isPick && showAIReads ? (
            <span className="ranking-ai-read-chip" title="Open the player card for the full AI read">
              AI Read
            </span>
          ) : null}
        </div>
      ) : null}

      {player.isDevy && prospectPills.length ? (
        <div className="ranking-devy-line">
          {prospectPills.map(pill => (
            <span key={`${pill.kind}:${pill.label}`} className={`ranking-devy-line__${pill.kind}`}>
              {pill.label}
            </span>
          ))}
        </div>
      ) : null}

      {!player.isDevy && !player.isPick && hasRankMovement ? (
        <div className="value-board__trend" aria-label={`${player.name} board movement`}>
          <span className={`ranking-trend-pill ${rankMovementClass}`}>
            {player.rankMovementLabel}
            {rankMovementIcon}
          </span>
        </div>
      ) : null}

      {!player.isDevy && !player.isPick && previousSeasonSummary ? (
        <div className="value-board__previous-season">
          <span className="ranking-last-season-summary-pill" title={previousSeasonSummary.title}>
            <span className="ranking-last-season-summary-full">{previousSeasonSummary.label}</span>
            <span className="ranking-last-season-summary-compact">{previousSeasonSummary.compactLabel}</span>
          </span>
        </div>
      ) : null}
    </>
  );

  if (player.isPick) {
    return (
      <div className={rowClassName} style={rowStyle} aria-label={`${player.name} draft pick ranking`}>
        {rowContent}
      </div>
    );
  }

  return (
    <button type="button" className={rowClassName} style={rowStyle} onClick={() => onSelect(player)}>
      {rowContent}
    </button>
  );
}

function DraftBuzzEntryIdentity({ entry }: { entry: DraftBuzzScoreboardEntry }) {
  const imageCandidates = useMemo(() => buildDraftBuzzHeadshotCandidates(entry), [entry.playerImageUrl, entry.name, entry.position, entry.college]);
  const imageCandidateKey = imageCandidates.join('|');
  const [imageIndex, setImageIndex] = useState(0);
  const imageUrl = imageCandidates[imageIndex] || null;

  useEffect(() => {
    setImageIndex(0);
  }, [imageCandidateKey]);

  if (imageUrl) {
    return (
      <span className="ranking-player-identity">
        <img src={imageUrl} alt={entry.name} className="ranking-player-image" loading="lazy" onError={() => setImageIndex(current => current + 1)} />
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
      <span className="draftbuzz-table__logo-label">{team}</span>
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
      <span className="draftbuzz-table__logo-label">{school}</span>
    </span>
  );
}

function DraftBuzzScoreboard({ entries, onSelectEntry }: { entries: DraftBuzzScoreboardEntry[]; onSelectEntry: (entry: DraftBuzzScoreboardEntry) => void }) {
  const [selectedDraftClass, setSelectedDraftClass] = useState<number | null>(() => readNumberParam('buzzClass'));
  const [selectedPositions, setSelectedPositions] = useState<DraftBuzzPosition[]>(() => readDraftBuzzPositionsParam('buzzPositions'));
  const [sort, setSort] = useState<DraftBuzzSort>(() => {
    const key = readEnumParam('buzzSort', DRAFT_BUZZ_SORT_KEYS, 'score');
    return {
      key,
      direction: readEnumParam('buzzDir', SORT_DIRECTIONS, getDefaultDraftBuzzSortDirection(key)),
    };
  });
  const [query, setQuery] = useState(() => getUrlSearchParam('buzzSearch') || '');
  const deferredQuery = useDeferredValue(query);
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
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return allRows
      .filter(row => {
        if (selectedDraftClass && row.draftYear !== selectedDraftClass) return false;
        if (selectedPositions.length && !selectedPositions.includes(row.position as DraftBuzzPosition)) return false;
        if (!normalizedQuery) return true;

        return [row.name, row.college, row.nflTeam, row.team, row.position, row.draftYear, row.rating, row.fortyYardDash, getDraftBuzzVertical(row), row.height, row.weight, getDraftBuzzPositionRankLabel(row)].some(value =>
          String(value || '')
            .toLowerCase()
            .includes(normalizedQuery)
        );
      })
      .sort((a, b) => compareDraftBuzzRows(a, b, sort));
  }, [allRows, deferredQuery, selectedDraftClass, selectedPositions, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / DRAFT_BUZZ_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * DRAFT_BUZZ_PAGE_SIZE, currentPage * DRAFT_BUZZ_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, selectedDraftClass, selectedPositions, sort]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    replaceUrlSearchParams(
      {
        buzzSearch: query.trim() || null,
        buzzClass: selectedDraftClass,
        buzzPositions: selectedPositions.length ? selectedPositions.join(',') : null,
        buzzSort: sort.key === 'score' ? null : sort.key,
        buzzDir: sort.direction === getDefaultDraftBuzzSortDirection(sort.key) ? null : sort.direction,
      },
      { onlyForHash: '#rankings' },
    );
  }, [query, selectedDraftClass, selectedPositions, sort]);

  const togglePosition = (position: DraftBuzzPosition) => {
    setSelectedPositions(current => (current.includes(position) ? current.filter(item => item !== position) : [...current, position]));
  };

  const handleSortColumn = (key: DraftBuzzSortKey) => {
    setSort(current =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: getDefaultDraftBuzzSortDirection(key) }
    );
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
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search player, school, team, class, rank, measurables"
            aria-label="Search player, school, team, class, rank, measurables"
            title="Search player, school, team, class, rank, measurables"
            className="rankings-search-input"
          />
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
        <div className="draftbuzz-table__header" role="row">
          {DRAFT_BUZZ_SORT_COLUMNS.map(column => {
            const isActive = sort.key === column.key;
            const Icon = isActive ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowDownUp;
            return (
              <span key={column.key} role="columnheader" aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button
                  type="button"
                  className={`draftbuzz-table__sort-heading ${isActive ? 'active' : ''}`}
                  onClick={() => handleSortColumn(column.key)}
                  aria-label={`Sort prospects by ${column.label}${isActive ? ` ${sort.direction === 'asc' ? 'descending' : 'ascending'}` : ''}`}
                >
                  <span>{column.label}</span>
                  <Icon className="draftbuzz-table__sort-icon" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
        {pageRows.map((player, index) => (
          <button type="button" key={`${player.id}-${index}`} className="draftbuzz-table__row" style={getTeamTileStyle(player.nflTeam || player.team) || getCollegeTileStyle(player.college)} onClick={() => onSelectEntry(player)}>
            <span className="draftbuzz-table__class">{player.draftYear}</span>
            <span className="draftbuzz-table__rank">{formatDraftBuzzRank(player.overallRank)}</span>
            <span className="draftbuzz-table__player">
              <DraftBuzzEntryIdentity entry={player} />
            </span>
            <span className="draftbuzz-table__team">
              <DraftBuzzTeamLogo entry={player} />
            </span>
            <span className="draftbuzz-table__top-meta">
              <span className="draftbuzz-table__school">
                <DraftBuzzSchoolLogo entry={player} />
              </span>
              <span className={`draftbuzz-table__meta-chip ${getRankClass(player.position)}`}>{getDraftBuzzPositionRankLabel(player)}</span>
              <strong className="draftbuzz-table__meta-chip draftbuzz-table__score">{formatDraftBuzzScore(player.rating)}</strong>
            </span>
            <span className="draftbuzz-table__forty">{formatDraftBuzzForty(player.fortyYardDash)}</span>
            <span className="draftbuzz-table__vertical">{formatDraftBuzzVertical(getDraftBuzzVertical(player))}</span>
            <span className="draftbuzz-table__height">{formatDraftBuzzTrait(player.height)}</span>
            <span className="draftbuzz-table__weight">{formatDraftBuzzTrait(player.weight)}</span>
            <span className="draftbuzz-table__mobile-measurables" aria-label={`${player.name} measurables`}>
              <span className="draftbuzz-table__meta-chip">40 {formatDraftBuzzForty(player.fortyYardDash)}</span>
              <span className="draftbuzz-table__meta-chip">VJ {formatDraftBuzzVertical(getDraftBuzzVertical(player))}</span>
              <span className="draftbuzz-table__meta-chip">HT {formatDraftBuzzTrait(player.height)}</span>
              <span className="draftbuzz-table__meta-chip">WT {formatDraftBuzzTrait(player.weight)}</span>
            </span>
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

function RankingsTable({ config, rankings, playerDetailsById, managerAvatars, viewerManager, leagueId, onSelectPlayer, onSelectDraftBuzzEntry, showAIReads }: { config: RankingsTableConfig; rankings: NonNullable<ReportData['rankings']>; playerDetailsById?: ReportData['playerDetailsById']; managerAvatars?: ReportData['managerAvatars']; viewerManager?: string | null; leagueId?: string; onSelectPlayer: (player: RankingPlayer) => void; onSelectDraftBuzzEntry: (entry: DraftBuzzScoreboardEntry) => void; showAIReads?: boolean }) {
  const profileOptions = rankings.profileOptions || [];
  const boardOptions = profileOptions.filter(option => option.board === config.board);
  const urlPrefix = getRankingsUrlPrefix(config.board);
  const canIncludePicksWithOverall = config.board === 'dynasty' && !config.hidePicks;
  const getInitialProfileKey = () => {
    const urlProfileKey = getUrlSearchParam(`${urlPrefix}Profile`);
    const hasUrlProfile = urlProfileKey && boardOptions.some(option => option.key === urlProfileKey);
    return (hasUrlProfile ? urlProfileKey : null) || config.defaultProfileKey || getProfileFallback(profileOptions, config.board);
  };
  const [selectedProfileKey, setSelectedProfileKey] = useState(getInitialProfileKey);
  const [selectedPositions, setSelectedPositions] = useState<PositionFilter[]>(() => readPositionFiltersParam(`${urlPrefix}Positions`, config.hidePicks, config.board));
  const [includePicksWithOverall, setIncludePicksWithOverall] = useState(() => canIncludePicksWithOverall && readBooleanParam(`${urlPrefix}Picks`));
  const [selectedDraftClass, setSelectedDraftClass] = useState<number | null>(() => readNumberParam(`${urlPrefix}Class`));
  const [sortMode, setSortMode] = useState<SortMode>(() => readEnumParam(`${urlPrefix}Sort`, SORT_MODES, 'rank'));
  const [movementSortDirection, setMovementSortDirection] = useState<MovementSortDirection>(() => readEnumParam(`${urlPrefix}Movement`, MOVEMENT_SORT_DIRECTIONS, 'down'));
  const [query, setQuery] = useState(() => getUrlSearchParam(`${urlPrefix}Search`) || '');
  const deferredQuery = useDeferredValue(query);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const urlProfileKey = getUrlSearchParam(`${urlPrefix}Profile`);
    const hasUrlProfile = urlProfileKey && boardOptions.some(option => option.key === urlProfileKey);
    const nextProfileKey = (hasUrlProfile ? urlProfileKey : null) || config.defaultProfileKey || getProfileFallback(profileOptions, config.board);
    if (nextProfileKey) {
      setSelectedProfileKey(nextProfileKey);
      setSelectedPositions(readPositionFiltersParam(`${urlPrefix}Positions`, config.hidePicks, config.board));
      setIncludePicksWithOverall(canIncludePicksWithOverall && readBooleanParam(`${urlPrefix}Picks`));
      setSelectedDraftClass(readNumberParam(`${urlPrefix}Class`));
      setSortMode(readEnumParam(`${urlPrefix}Sort`, SORT_MODES, 'rank'));
      setMovementSortDirection(readEnumParam(`${urlPrefix}Movement`, MOVEMENT_SORT_DIRECTIONS, 'down'));
      setQuery(getUrlSearchParam(`${urlPrefix}Search`) || '');
      setPage(1);
    }
  }, [canIncludePicksWithOverall, config.board, config.defaultProfileKey, config.hidePicks, profileOptions, rankings.generatedAt, urlPrefix]);

  const localRows = selectedProfileKey ? rankings.profiles?.[selectedProfileKey] || [] : [];
  const expectedRowCount = getProfileRowCount(rankings, selectedProfileKey);
  const profileQuery = trpc.league.rankingProfile.useQuery(
    { leagueId: leagueId || '', profileKey: selectedProfileKey || '' },
    {
      enabled: Boolean(leagueId && selectedProfileKey && localRows.length === 0 && expectedRowCount > 0),
      staleTime: 1000 * 60 * 60 * 12,
      refetchOnWindowFocus: false,
      retry: 1,
    }
  );
  const rows = profileQuery.data?.rows || localRows;
  const isProfileLoading = profileQuery.isLoading && localRows.length === 0 && expectedRowCount > 0;
  const activeProfile = profileOptions.find(option => option.key === selectedProfileKey);
  const activeProfileLabel = activeProfile ? getProfileButtonLabel(activeProfile) : null;
  const leagueTypeControlStyle = {
    '--rankings-league-type-width': `calc(${Math.max(8.5, ...boardOptions.map(option => getProfileButtonLabel(option).length))}ch + 1.75rem)`,
  } as CSSProperties;
  const contextPills = [
    activeProfileLabel ? `League Matched: ${activeProfileLabel}` : null,
    config.board === 'devy' ? 'Degen Scouting Scores' : null,
    config.board === 'devy' ? '2021-2027 Tracked' : null,
  ].filter((label): label is string => Boolean(label));
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
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return rows
      .filter(player => {
        if (config.hidePicks && player.isPick) return false;
        if (config.board === 'devy' && (player.isPick || !player.isDevy)) return false;
        if (config.board === 'redraft' && player.isPick) return false;
        if (selectedPositions.length === 0) {
          return includePicksWithOverall && canIncludePicksWithOverall ? true : !player.isPick;
        }
        return selectedPositions.includes(player.pos as PositionFilter);
      })
      .filter(player => config.board !== 'devy' || !selectedDraftClass || getDraftClassValue(player) === selectedDraftClass)
      .filter(player => {
        if (!normalizedQuery) return true;
        const details = player.player_id ? playerDetailsById?.[player.player_id] : undefined;
        return getRankingSearchTerms(player, details).some(value =>
          String(value || '')
            .toLowerCase()
            .includes(normalizedQuery)
        );
      })
      .sort((a, b) => {
        if (config.board === 'devy') return a.overallRank - b.overallRank;
        if (sortMode === 'value') {
          const aValue = config.leagueValueMode === 'redraft' ? a.seasonValue ?? a.fantasyProsValue ?? a.value : a.value;
          const bValue = config.leagueValueMode === 'redraft' ? b.seasonValue ?? b.fantasyProsValue ?? b.value : b.value;
          return bValue - aValue || a.overallRank - b.overallRank;
        }
        if (sortMode === 'movement') {
          const aMovement = a.movement || 0;
          const bMovement = b.movement || 0;
          return movementSortDirection === 'up'
            ? bMovement - aMovement || a.overallRank - b.overallRank
            : aMovement - bMovement || a.overallRank - b.overallRank;
        }
        return a.overallRank - b.overallRank;
      });
  }, [canIncludePicksWithOverall, config.board, config.hidePicks, config.leagueValueMode, deferredQuery, includePicksWithOverall, movementSortDirection, playerDetailsById, rows, selectedDraftClass, selectedPositions, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [includePicksWithOverall, movementSortDirection, query, selectedDraftClass, selectedPositions, selectedProfileKey, sortMode]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    replaceUrlSearchParams(
      {
        [`${urlPrefix}Profile`]: selectedProfileKey || null,
        [`${urlPrefix}Search`]: query.trim() || null,
        [`${urlPrefix}Positions`]: selectedPositions.length ? selectedPositions.join(',') : null,
        [`${urlPrefix}Picks`]: includePicksWithOverall && selectedPositions.length === 0,
        [`${urlPrefix}Class`]: selectedDraftClass,
        [`${urlPrefix}Sort`]: sortMode === 'rank' ? null : sortMode,
        [`${urlPrefix}Movement`]: sortMode === 'movement' ? movementSortDirection : null,
      },
      { onlyForHash: '#rankings' },
    );
  }, [includePicksWithOverall, movementSortDirection, query, selectedDraftClass, selectedPositions, selectedProfileKey, sortMode, urlPrefix]);

  const handleMovementSortClick = () => {
    if (sortMode === 'movement') {
      setMovementSortDirection(direction => direction === 'down' ? 'up' : 'down');
      return;
    }
    setSortMode('movement');
    setMovementSortDirection('down');
  };
  const MovementSortIcon = movementSortDirection === 'up' ? TrendingUp : TrendingDown;
  const movementSortLabel = movementSortDirection === 'up' ? '7-Day risers' : '7-Day fallers';
  const movementSortText = movementSortDirection === 'up' ? '7-Day Up' : '7-Day Down';

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
      <div className={`rankings-controls value-board__toolbar ${!config.hidePicks && config.board === 'dynasty' ? 'rankings-controls-with-picks' : ''} ${config.board === 'devy' ? 'rankings-controls-devy' : ''}`} style={leagueTypeControlStyle}>
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
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={getRankingSearchPlaceholder(config.board, config.leagueValueMode)}
            aria-label={getRankingSearchPlaceholder(config.board, config.leagueValueMode)}
            title={getRankingSearchPlaceholder(config.board, config.leagueValueMode)}
            className="rankings-search-input"
          />
        </div>

        {config.board !== 'devy' ? (
          <div className="rankings-control-group rankings-sort-toggle value-board__sort">
            <button type="button" className={sortMode === 'rank' ? 'active' : ''} aria-pressed={sortMode === 'rank'} onClick={() => setSortMode('rank')}>
              Rank
            </button>
            <button type="button" className={sortMode === 'value' ? 'active' : ''} aria-pressed={sortMode === 'value'} onClick={() => setSortMode('value')}>
              {config.leagueValueMode === 'redraft' ? 'Season' : 'Value'}
            </button>
            <button
              type="button"
              className={`rankings-movement-sort-button ${sortMode === 'movement' ? 'active' : ''}`}
              aria-pressed={sortMode === 'movement'}
              aria-label={`Sort by ${movementSortLabel}`}
              title={`Sort by ${movementSortLabel}`}
              onClick={handleMovementSortClick}
            >
              <span>{movementSortText}</span>
              <MovementSortIcon className="rankings-sort-direction-icon" aria-hidden="true" />
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
          {getPositionFilters(config.board, config.hidePicks).map(filter => (
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
          {contextPills.map(label => (
            <span key={label} className="rankings-context-pill">
              {label}
            </span>
          ))}
        </div>
      </div>

      {isProfileLoading ? (
        <div className="rankings-empty-state">
          Loading selected ranking profile...
        </div>
      ) : null}

      <div className="rankings-result-count">
        Showing {pageRows.length.toLocaleString()} of {filteredRows.length.toLocaleString()} ranked assets
      </div>

      <div className={`rankings-player-grid value-board__rows ${config.board === 'devy' ? 'value-board__rows-devy' : ''}`}>
        <div className="value-board__row-header" aria-hidden="true">
          <span>Rank</span>
          <span>Player</span>
          <span>{config.board === 'devy' ? 'School' : 'Team'}</span>
          <span>{config.board === 'devy' ? 'Pos' : 'Pos Rank'}</span>
          <span>{config.board === 'devy' ? 'Class' : 'Age'}</span>
          {config.board !== 'devy' ? <span>Last Year</span> : null}
          <span>{config.board === 'devy' ? 'Projection' : 'Manager'}</span>
          <span>Rank +/-</span>
          <span>{config.board === 'devy' ? 'Buzz' : '7-Day'}</span>
          <span>{config.board === 'devy' ? 'Pos Rank' : config.valueLabel}</span>
        </div>
        {pageRows.map((player, index) => (
          <RankingValueRow key={`${player.id}-${index}`} player={player} config={config} playerDetailsById={playerDetailsById} managerAvatars={managerAvatars} viewerManager={viewerManager} onSelect={onSelectPlayer} showAIReads={showAIReads} />
        ))}
      </div>

      {filteredRows.length === 0 && !isProfileLoading ? (
        <EmptyState
          className="rankings-empty-state"
          title="No rankings match those filters."
          description="Try clearing the search, switching positions, or returning to the league-matched profile."
        />
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

export function RankingsBoard({ rankings, playerDetailsById, managerAvatars, leagueId, leagueLogo, viewerManager, board = 'all', hidePicks = false, leagueValueMode: leagueValueModeInput = 'dynasty', leagueDiagnostics, showAIReads = false }: { rankings?: ReportData['rankings']; playerDetailsById?: ReportData['playerDetailsById']; managerAvatars?: ReportData['managerAvatars']; leagueId?: string; leagueLogo?: string | null; viewerManager?: string | null; board?: 'all' | 'dynasty' | 'redraft' | 'devy' | 'draftbuzz'; hidePicks?: boolean; leagueValueMode?: ReportData['leagueValueMode']; leagueDiagnostics?: ReportData['leagueDiagnostics']; showAIReads?: boolean }) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerModalData | null>(null);
  const leagueValueMode = normalizeLeagueValueMode(leagueValueModeInput);
  const shouldShowDraftBuzzScoreboard = board === 'draftbuzz' || (board === 'all' && leagueValueMode !== 'redraft');
  const localDraftBuzzEntries = rankings?.draftBuzzScoreboard || [];
  const draftBuzzQuery = trpc.league.rankingDraftBuzz.useQuery(
    { leagueId: leagueId || '' },
    {
      enabled: Boolean(leagueId && shouldShowDraftBuzzScoreboard && localDraftBuzzEntries.length === 0 && (rankings?.draftBuzzScoreboardCount || 0) > 0),
      staleTime: 1000 * 60 * 60 * 12,
      refetchOnWindowFocus: false,
      retry: 1,
    }
  );
  const draftBuzzEntries = localDraftBuzzEntries.length ? localDraftBuzzEntries : draftBuzzQuery.data?.entries || [];

  const handleSelectPlayer = (player: RankingPlayer) => {
    if (player.isPick) return;

    const details = player.player_id ? playerDetailsById?.[player.player_id] : undefined;
    const draftBuzzEntry = player.isDevy
      ? draftBuzzEntries.find((entry) => {
          if (player.player_id && entry.player_id === player.player_id) return true;
          return entry.name.toLowerCase() === player.name.toLowerCase()
            && entry.position === player.pos
            && Number(entry.draftYear || 0) === Number(player.draftYear || player.prospectProfile?.draftYear || 0);
        })
      : undefined;
    const fullProspectProfile = draftBuzzEntry?.prospectProfile || player.prospectProfile || null;
    const modalAthleticProfile = details?.athleticProfile || draftBuzzEntry?.athleticProfile || player.athleticProfile || null;
    const fallbackValue = leagueValueMode === 'redraft'
      ? player.seasonValue ?? player.fantasyProsValue ?? player.value
      : player.value;
    const modalValue = getPlayerValueForMode({
      valueProfile: details?.valueProfile,
      fallbackValue,
      mode: leagueValueMode,
      context: 'rankings',
    });
    const modalRank = getPlayerRankForMode({
      valueProfile: details?.valueProfile,
      fallbackRank: player.positionRank || player.pos,
      mode: leagueValueMode,
      context: 'rankings',
    });
    const boardPositionRank = player.positionRank || player.pos;
    const sourcePositionRank = player.sourcePositionRank
      || player.fantasyProsDevyPositionRank
      || fullProspectProfile?.fantasyProsDevyPositionRank
      || (fullProspectProfile?.positionRank ? `${player.pos}${fullProspectProfile.positionRank}` : null)
      || boardPositionRank;
    const sourceOverallRank = player.sourceOverallRank
      || player.fantasyProsDevyRank
      || fullProspectProfile?.fantasyProsDevyRank
      || fullProspectProfile?.overallRank
      || null;
    const prospectOnlyDetails = fullProspectProfile
      ? {
          fullName: player.name,
          position: player.pos,
          team: player.team || null,
          college: fullProspectProfile.college || player.college || null,
          age: player.age || fullProspectProfile.fantasyProsDevyAge || null,
          height: fullProspectProfile.height || null,
          weight: fullProspectProfile.weight || null,
          prospectProfile: fullProspectProfile,
          athleticProfile: modalAthleticProfile,
        }
      : undefined;
    const isRedraftRankingRow = leagueValueMode === 'redraft' || player.sources?.some(isRedraftSourceLabel);
    const rankingOnlyDetails: PlayerDetails | undefined =
      !player.isDevy && !player.isPick
        ? {
            playerId: player.player_id,
            fullName: player.name,
            position: player.pos,
            team: player.team || null,
            age: player.age || null,
            valueProfile: {
              dynastyValue: isRedraftRankingRow ? null : player.value,
              seasonValue: isRedraftRankingRow ? player.seasonValue ?? player.value : player.seasonValue ?? player.fantasyProsValue ?? null,
              dynastyPositionRank: isRedraftRankingRow ? null : player.positionRank || player.pos,
              seasonPositionRank: isRedraftRankingRow || player.seasonValue ? player.positionRank || player.pos : null,
              marketKtc: isRedraftRankingRow ? null : player.ktcValue || null,
              flockFantasy: isRedraftRankingRow ? null : player.flockValue || null,
              fantasyProsDynasty: isRedraftRankingRow ? null : player.fantasyProsDynastyValue || null,
              fantasyCalcDynasty: isRedraftRankingRow ? null : player.fantasyCalcValue || null,
              fantasyCalcRedraft: isRedraftRankingRow ? player.fantasyCalcValue || null : null,
              dynastyProcess: isRedraftRankingRow ? null : player.dynastyProcessValue || null,
              dynastyNerds: isRedraftRankingRow ? null : player.dynastyNerdsValue || null,
              fantasyNerds: isRedraftRankingRow ? null : player.fantasyNerdsValue || null,
              dynastyDealerBenchmark: isRedraftRankingRow ? null : player.dynastyDealerBenchmark || null,
              dynastyDealerVoteRating: isRedraftRankingRow ? null : player.dynastyDealerVoteRating || null,
              fantasyProsSeasonValue: player.fantasyProsValue || null,
              sources: player.sources || [],
            },
            athleticProfile: modalAthleticProfile,
          }
        : undefined;
    setSelectedPlayer({
      player_id: player.player_id,
      playerName: player.name,
      playerPos: player.pos,
      currentPositionRank: player.isDevy ? sourcePositionRank : modalRank || sourcePositionRank || boardPositionRank,
      boardPositionRank,
      sourcePositionRank,
      sourceOverallRank,
      currentKtcValue: player.isDevy ? undefined : modalValue ?? player.value,
      valueGain: player.movement || undefined,
      valueChangeNote: player.movementLabel ? 'Blended value change over the current comparison window.' : undefined,
      valueMode: leagueValueMode,
      manager: player.owner || undefined,
      managerAvatarUrl: player.owner ? managerAvatars?.[player.owner] : null,
      playerImageUrl: player.imageUrl || fullProspectProfile?.playerImageUrl || null,
      collegeLogoUrl: player.collegeLogoUrl || fullProspectProfile?.collegeLogoUrl || null,
      isCollegeProspect: player.isDevy,
      playerDetails: details
        ? {
            ...details,
            prospectProfile: fullProspectProfile || details.prospectProfile || null,
            athleticProfile: modalAthleticProfile,
          }
        : prospectOnlyDetails || rankingOnlyDetails,
    });
  };

  const handleSelectDraftBuzzEntry = (entry: DraftBuzzScoreboardEntry) => {
    const details = entry.player_id ? playerDetailsById?.[entry.player_id] : undefined;
    const modalAthleticProfile = details?.athleticProfile || entry.athleticProfile || null;
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
      athleticProfile: modalAthleticProfile,
    };

    setSelectedPlayer({
      player_id: entry.player_id || undefined,
      playerName: entry.name,
      playerPos: entry.position,
      currentPositionRank: entry.positionRank ? `${entry.position}${entry.positionRank}` : entry.position,
      boardPositionRank: entry.positionRank ? `${entry.position}${entry.positionRank}` : entry.position,
      sourcePositionRank: entry.positionRank ? `${entry.position}${entry.positionRank}` : entry.position,
      sourceOverallRank: entry.overallRank || null,
      manager: undefined,
      playerImageUrl: entry.playerImageUrl || null,
      collegeLogoUrl: entry.collegeLogoUrl || null,
      isCollegeProspect: draftYear > currentYear,
      preferProspectImage: true,
      playerDetails: details ? { ...details, prospectProfile: entry.prospectProfile, athleticProfile: modalAthleticProfile } : prospectDetails,
    });
  };

  if (!rankings || !rankings.profileOptions?.length) {
    return (
      <EmptyState
        className="rankings-empty-state"
        title="Rankings are not available for this report yet."
        description="The report did not include a matching player-value board. Re-run the league analysis after rankings finish loading."
      />
    );
  }

  const modeCopy = getLeagueModeCopy(leagueValueMode);
  const valueLabel = getPrimaryValueLabel(leagueValueMode, 'rankings');
  const hasRedraftProfiles = rankings.profileOptions?.some((option) => option.board === 'redraft' && getProfileRowCount(rankings, option.key) > 0);
  const primaryBoard: RankingsTableConfig['board'] = board === 'redraft'
    ? 'redraft'
    : leagueValueMode === 'redraft' && hasRedraftProfiles
      ? 'redraft'
      : 'dynasty';
  const includeDevyBoard = leagueValueMode !== 'redraft' || board === 'devy';
  const tableConfigs = (
    [
      {
        board: primaryBoard,
        title: modeCopy.rankingsTitle,
        kicker: modeCopy.rankingsKicker,
        description: modeCopy.rankingsDescription,
        defaultProfileKey: primaryBoard === 'redraft' ? rankings.defaultRedraftProfileKey : rankings.defaultProfileKey,
        hidePicks,
        leagueValueMode,
        valueLabel,
      },
      includeDevyBoard ? {
        board: 'devy',
        title: 'College Prospect Board',
        kicker: 'Future rookie pipeline',
        description: 'College-only rankings use the same QB and TE-premium profile as this league, with verified prospect measurables layered in where available.',
        defaultProfileKey: rankings.defaultDevyProfileKey,
        hidePicks: true,
        leagueValueMode,
        valueLabel: 'Prospect Rank',
      } : null,
    ].filter(Boolean) as RankingsTableConfig[]
  ).filter(config => board === 'all' || config.board === board);

  return (
    <div className="rankings-board">
      {tableConfigs.map(config => (
        <RankingsTable key={config.board} config={config} rankings={rankings} playerDetailsById={playerDetailsById} managerAvatars={managerAvatars} viewerManager={viewerManager} leagueId={leagueId} onSelectPlayer={handleSelectPlayer} onSelectDraftBuzzEntry={handleSelectDraftBuzzEntry} showAIReads={showAIReads} />
      ))}

      {shouldShowDraftBuzzScoreboard ? draftBuzzQuery.isLoading && !draftBuzzEntries.length ? (
        <div className="rankings-empty-state">
          Loading prospect score archive...
        </div>
      ) : draftBuzzEntries.length ? (
        <DraftBuzzScoreboard entries={draftBuzzEntries} onSelectEntry={handleSelectDraftBuzzEntry} />
      ) : (
        <EmptyState className="rankings-empty-state" title="Prospect score archive is not available for this report yet." description="Prospect archive data was not returned with this report." />
      ) : null}

      <PlayerDetailModal isOpen={selectedPlayer !== null} onClose={() => setSelectedPlayer(null)} pick={selectedPlayer} leagueId={leagueId} leagueLogo={leagueLogo} managerAvatars={managerAvatars} playerDetailsById={playerDetailsById} leagueDiagnostics={leagueDiagnostics} showAIRead={showAIReads} />
    </div>
  );
}
