import { useMemo, useState, useEffect, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DraftPick, PlayerDetails } from '@shared/types';
import { ExternalLink, TrendingUp, TrendingDown, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { getPositionRankPillClass } from '@/lib/positionRank';
import { getPlayerAvailability } from '@/lib/playerStatus';
import { getCachedDraftBuzzImageUrl, getCollegeInitials, getCollegeLogoUrl, getCollegeTileStyle } from '@/lib/teamTileStyle';
import { normalizeLeagueValueMode, type LeagueValueMode } from '@/lib/leagueValueMode';
import { getDraftKind, getDraftKindLabel, getDraftWindowLabel } from '@/lib/draftDisplay';
import { getPlayerValueConfidence } from '@/lib/playerValueConfidence';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { PlayerNameWithHeadshot } from './PlayerNameWithHeadshot';
import { TeamLogoPill } from './TeamLogoPill';
import { AIReadPanel, type AIReadChip } from './AIReadPanel';
import { PremiumFxLayer } from './PremiumFxLayer';

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
  DET: { primary: '#0076B6', secondary: '#B0B7BC', accent: '#7fd8ff' },
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

const SLEEPER_SESSION_KEY = 'dynasty-degenerates:sleeper-session:v1';
type PlayerSchedule = NonNullable<PlayerDetails['schedule']>;

function getProspectSourceLabel(source?: string | null): string | null {
  if (!source) return null;
  return source === 'NFL Draft Buzz' ? 'Prospect Archive' : source;
}

function getStoredAdminViewMode(): 'admin' | 'regular' | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SLEEPER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { adminViewMode?: unknown } | null;
    if (parsed?.adminViewMode === 'admin' || parsed?.adminViewMode === 'regular') {
      return parsed.adminViewMode;
    }
    return null;
  } catch {
    return null;
  }
}

interface PlayerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pick: PlayerModalData | null;
  leagueId?: string;
  leagueLogo?: string | null;
  managerAvatars?: Record<string, string | null>;
  playerDetailsById?: Record<string, PlayerDetails>;
  showAIRead?: boolean;
}

export type PlayerModalData = Partial<DraftPick> & {
  playerName: string;
  playerPos?: string;
  player_id?: string;
  playerDetails?: PlayerDetails;
  valueChangeNote?: string;
  managerAvatarUrl?: string | null;
  playerImageUrl?: string | null;
  collegeLogoUrl?: string | null;
  isCollegeProspect?: boolean;
  preferProspectImage?: boolean;
  valueMode?: LeagueValueMode;
  taxiAction?: string;
  taxiReason?: string;
};

function hasResolvedNflIdentity(pick?: PlayerModalData | null, details?: PlayerDetails) {
  const hasKnownExperience = details?.yearsExp !== null && details?.yearsExp !== undefined;

  return Boolean(
    pick?.player_id ||
      details?.playerId ||
      details?.team ||
      details?.rookieYear ||
      details?.nflDraftTeam ||
      details?.nflDraftRound ||
      details?.nflDraftPick ||
      hasKnownExperience
  );
}

function isCollegeOnlyModalPick(pick?: PlayerModalData | null, details?: PlayerDetails) {
  return pick?.isCollegeProspect ?? (!hasResolvedNflIdentity(pick, details) && Boolean(details?.prospectProfile));
}

function isPlayerAiReadEligible({
  position,
  currentRank,
  valueProfile,
}: {
  position?: string | null;
  currentRank?: string | null;
  valueProfile?: PlayerDetails['valueProfile'];
}) {
  if (String(position || '').toUpperCase() !== 'TE') return true;

  const dynastyRank = valueProfile?.dynastyPositionRank || valueProfile?.balancedPositionRank || currentRank || null;
  const dynastyRankNumber = parseRankNumber(dynastyRank);
  return Boolean(dynastyRankNumber && dynastyRankNumber <= 12);
}

export function PlayerDetailModal({
  isOpen,
  onClose,
  pick: selectedPick,
  leagueId,
  leagueLogo,
  managerAvatars,
  playerDetailsById,
  showAIRead = false,
}: PlayerDetailModalProps) {
  const [focusedPeerPick, setFocusedPeerPick] = useState<PlayerModalData | null>(null);
  const [expandedAvailabilitySeason, setExpandedAvailabilitySeason] = useState<string | null>(null);
  const pick = focusedPeerPick || selectedPick;
  const [headshot, setHeadshot] = useState<string | null>(null);
  const [directImageFailed, setDirectImageFailed] = useState(false);
  const [fallbackImageFailed, setFallbackImageFailed] = useState(false);
  const queryDetails = pick?.player_id && playerDetailsById?.[pick.player_id]
    ? { ...pick.playerDetails, ...playerDetailsById[pick.player_id] }
    : pick?.playerDetails || (pick?.player_id ? playerDetailsById?.[pick.player_id] : undefined);
  const queryIsCollegeProspect = isCollegeOnlyModalPick(pick, queryDetails);
  const { data: headshotData } = trpc.images.playerHeadshot.useQuery(
    {
      playerId: pick?.player_id || '',
      playerName: pick?.playerName || null,
      position: pick?.playerPos || queryDetails?.position || null,
    },
    { enabled: !!pick?.player_id && isOpen && directImageFailed }
  );
  const { data: playerNewsData } = trpc.players.latestNews.useQuery(
    {
      playerId: pick?.player_id || '',
      playerName: pick?.playerName || '',
      team: queryDetails?.team || null,
      position: pick?.playerPos || queryDetails?.position || null,
    },
    {
      enabled: isOpen && Boolean(pick?.playerName) && !queryIsCollegeProspect,
      staleTime: 1000 * 60 * 15,
    }
  );
  const { data: seasonGameLog, isFetching: isSeasonGameLogFetching } = trpc.players.seasonGameLog.useQuery(
    {
      leagueId: leagueId || '',
      playerId: pick?.player_id || '',
      season: expandedAvailabilitySeason || '',
      position: queryDetails?.position || pick?.playerPos || null,
    },
    {
      enabled: isOpen && Boolean(leagueId && pick?.player_id && expandedAvailabilitySeason),
      staleTime: 1000 * 60 * 5,
    }
  );
  const { data: authUser } = trpc.auth.me.useQuery(undefined, {
    enabled: isOpen,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    setHeadshot(null);
    setDirectImageFailed(false);
    setFallbackImageFailed(false);
  }, [pick?.player_id, pick?.playerImageUrl, pick?.preferProspectImage]);

  useEffect(() => {
    setFocusedPeerPick(null);
  }, [selectedPick?.player_id, selectedPick?.playerName, isOpen]);

  useEffect(() => {
    setExpandedAvailabilitySeason(null);
  }, [pick?.player_id, isOpen]);

  useEffect(() => {
    if (headshotData?.success && headshotData?.data && headshotData.contentType) {
      setHeadshot(`data:${headshotData.contentType};base64,${headshotData.data}`);
    } else if (headshotData?.success && headshotData.imageUrl) {
      setHeadshot(getCachedDraftBuzzImageUrl(headshotData.imageUrl) || headshotData.imageUrl);
    } else if (headshotData && !headshotData.success) {
      setHeadshot(null);
    }
  }, [headshotData]);

  if (!pick) return null;
  const details = queryDetails;
  const prospectProfile = details?.prospectProfile || null;
  const isCollegeProspect = isCollegeOnlyModalPick(pick, details);
  const preferProspectImage = Boolean(pick.preferProspectImage);
  const prospectCollege = prospectProfile?.college || details?.college || null;
  const isAdminView = Boolean(authUser?.isPrivilegedAdmin) || getStoredAdminViewMode() === 'admin';
  const directHeadshot = !isCollegeProspect && pick.player_id && !directImageFailed
    ? `https://sleepercdn.com/content/nfl/players/${pick.player_id}.jpg`
    : null;
  const fallbackDraftBuzzImage = !fallbackImageFailed
    ? getCachedDraftBuzzImageUrl(pick.playerImageUrl || prospectProfile?.playerImageUrl || null)
    : null;
  const prospectImageSrc = fallbackDraftBuzzImage || getCachedDraftBuzzImageUrl(prospectProfile?.collegeLogoUrl || null);
  const nflImageSrc = headshot || directHeadshot || fallbackDraftBuzzImage;
  const playerImageSrc = isCollegeProspect ? prospectImageSrc : preferProspectImage ? prospectImageSrc || nflImageSrc : nflImageSrc;
  const valueProfile = details?.valueProfile;
  const valueMode = normalizeLeagueValueMode(pick.valueMode || 'dynasty');
  const isRedraftValueMode = valueMode === 'redraft';
  const draftKindLabel = (pick.round !== undefined || pick.pick !== undefined || pick.draftKind || pick.draftPickCount)
    ? getDraftKindLabel(getDraftKind(pick, valueMode))
    : null;
  const draftWindowLabel = getDraftWindowLabel(pick, valueMode);
  const valueChangeNote = pick.valueChangeNote || getValueChangeNote(pick);
  const currentValue = pick.currentKtcValue;
  const draftValue = pick.ktcValue;
  const valueGain = pick.valueGain;
  const currentRank = pick.currentPositionRank || '-';
  const position = pick.playerPos || details?.position || '-';
  const team = isCollegeProspect ? null : details?.team || 'FA';
  const jerseyNumber = details?.jerseyNumber;
  const teamColors = team ? NFL_TEAM_COLORS[team] || null : null;
  const collegeTileStyle = isCollegeProspect ? getCollegeTileStyle(prospectCollege) : undefined;
  const tileAccent = isCollegeProspect ? '#fbbf24' : getReadableTeamAccent(teamColors);
  const modalBackground = isCollegeProspect
    ? `radial-gradient(circle at 15% 6%, color-mix(in srgb, var(--team-primary, #7c2d12) 38%, transparent), transparent 28%), radial-gradient(circle at 95% 0%, color-mix(in srgb, var(--team-secondary, #0f172a) 46%, transparent), transparent 34%), linear-gradient(180deg, #070b13 0%, #101827 44%, #070b13 100%)`
    : teamColors
    ? `radial-gradient(circle at 15% 6%, ${teamColors.primary}38, transparent 28%), radial-gradient(circle at 95% 0%, ${teamColors.secondary}52, transparent 34%), linear-gradient(180deg, #070b13 0%, #101827 44%, #070b13 100%)`
    : undefined;
  const heroBackground = isCollegeProspect
    ? `radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--team-primary, #7c2d12) 62%, transparent), transparent 34%), radial-gradient(circle at 88% 8%, color-mix(in srgb, var(--team-secondary, #0f172a) 76%, transparent), transparent 30%), linear-gradient(135deg, color-mix(in srgb, var(--team-primary, #7c2d12) 72%, #070b13) 0%, #070b13 48%, color-mix(in srgb, var(--team-secondary, #0f172a) 74%, #070b13) 100%)`
    : teamColors
    ? `radial-gradient(circle at 18% 18%, ${teamColors.primary}88, transparent 34%), radial-gradient(circle at 88% 8%, ${teamColors.secondary}99, transparent 30%), linear-gradient(135deg, ${teamColors.primary} 0%, #070b13 48%, ${teamColors.secondary} 100%)`
    : undefined;
  const managerAvatarUrl = pick.managerAvatarUrl || (pick.manager ? managerAvatars?.[pick.manager] : null);
  const managerDisplayName = pick.managerDisplayName || pick.manager || '';
  const playerNameSizeClass = getPlayerNameSizeClass(pick.playerName);
  const availability = isCollegeProspect
    ? { label: 'College Prospect', tone: 'taxi' as const }
    : getPlayerAvailability(details);
  const leagueUsage = details?.leagueUsage || null;
  const hasLeagueUsage = Boolean(leagueUsage && (leagueUsage.ownedGames > 0 || leagueUsage.startedGames > 0));
  const prospectHeaderInfoRows = [
    ['College', prospectCollege || details?.college || '-'],
    ['40 Time', formatFortyTime(prospectProfile?.fortyYardDash)],
    ['Birthday', formatBirthday(details?.birthDate) || '-'],
  ] as const;
  const playerBioRows = !isCollegeProspect ? [
    ['College', prospectCollege ? (
      <ProspectCollegePill
        college={prospectCollege}
        logoUrl={pick.collegeLogoUrl || prospectProfile?.collegeLogoUrl}
      />
    ) : '-'],
    ['40 Time', formatFortyTime(prospectProfile?.fortyYardDash)],
    ['Birthday', formatBirthday(details?.birthDate) || '-'],
  ] as const : [];
  const physicalRows = [
    ['Age', details?.age],
    ['Height', formatHeight(details?.height)],
    ['Weight', details?.weight],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const experienceRows = [
    ['Rookie Year', details?.rookieYear],
    ['Depth Chart', formatDepthChartRole(details, true)],
    ['Years Exp', details?.yearsExp],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const prospectMetricRows = prospectProfile ? [
    ['Projected Rookie Pick', prospectProfile.projectedRookiePick],
    ['Board Rank', prospectProfile.fantasyProsDevyRank ? `#${prospectProfile.fantasyProsDevyRank}` : prospectProfile.overallRank ? `#${prospectProfile.overallRank}` : null],
    ['Position Rank', prospectProfile.fantasyProsDevyPositionRank || (prospectProfile.positionRank ? `${prospectProfile.position}${prospectProfile.positionRank}` : null)],
    ['Draft Class', prospectProfile.draftYear],
    ['Class', prospectProfile.classYear],
    ['Size', [prospectProfile.height, prospectProfile.weight].filter(Boolean).join(' / ')],
    ['Role', prospectProfile.role],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  const prospectRows = details?.prospectProfile ? [
    ['Projected Rookie Pick', details.prospectProfile.projectedRookiePick],
    ['FantasyPros ECR', details.prospectProfile.fantasyProsDevyRank ? `#${details.prospectProfile.fantasyProsDevyRank}` : null],
    ['FantasyPros Pos', details.prospectProfile.fantasyProsDevyPositionRank],
    ['FP Best/Worst', details.prospectProfile.fantasyProsDevyBestRank && details.prospectProfile.fantasyProsDevyWorstRank ? `${details.prospectProfile.fantasyProsDevyBestRank} / ${details.prospectProfile.fantasyProsDevyWorstRank}` : null],
    ['FP Avg/Std Dev', details.prospectProfile.fantasyProsDevyAverageRank && details.prospectProfile.fantasyProsDevyStdDev !== null && details.prospectProfile.fantasyProsDevyStdDev !== undefined ? `${details.prospectProfile.fantasyProsDevyAverageRank} / ${details.prospectProfile.fantasyProsDevyStdDev}` : null],
    ['Role', details.prospectProfile.role],
    ['Source', getProspectSourceLabel(details.prospectProfile.source)],
    ['ESPN ID', details.prospectProfile.espnId],
    ['Class', details.prospectProfile.classYear],
    ['Jersey', details.prospectProfile.jersey],
    ['Status', details.prospectProfile.status],
    ['Birthplace', details.prospectProfile.birthPlace],
    ['Draft Class', details.prospectProfile.draftYear],
    ['Overall Rank', details.prospectProfile.overallRank ? `#${details.prospectProfile.overallRank}` : null],
    ['Position Rank', details.prospectProfile.positionRank ? `${details.prospectProfile.position}${details.prospectProfile.positionRank}` : null],
    ['Rating', details.prospectProfile.rating],
    ['Avg Scout Rank', details.prospectProfile.averageOverallRank ? `#${details.prospectProfile.averageOverallRank}` : null],
    ['Size', [details.prospectProfile.height, details.prospectProfile.weight].filter(Boolean).join(' / ')],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  const previousSeasonRankLabel = getPreviousSeasonRankLabel(details);
  const previousSeasonRankMobileLabel = getPreviousSeasonRankMobileLabel(details);
  const lastSeasonRows = [
    [previousSeasonRankLabel, details?.lastSeasonPositionRank],
    ['Games Played', details?.lastSeasonGames],
    ['PPG', details?.lastSeasonPointsPerGame],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const availabilityRows = [
    ['Avg Missed', details?.avgGamesMissed !== null && details?.avgGamesMissed !== undefined && details?.availabilitySeasons ? `${details.avgGamesMissed} / yr` : null],
    ['Seasons', details?.availabilitySeasons ? `${details.availabilitySeasons} yr${details.availabilitySeasons === 1 ? '' : 's'}` : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const selectedAvailabilityHistory = details?.availabilityHistory?.find((item) => item.season === expandedAvailabilitySeason) || null;
  const scheduleProfile = details?.schedule || null;
  const scheduleRows = scheduleProfile ? [
    ['Bye Week', scheduleProfile.byeWeek !== null && scheduleProfile.byeWeek !== undefined ? `Week ${scheduleProfile.byeWeek}` : null],
    ['Season SOS', scheduleProfile.seasonSOS !== null && scheduleProfile.seasonSOS !== undefined ? `${Math.round(scheduleProfile.seasonSOS)}%` : null],
    ['Schedule Tier', formatScheduleTierLabel(scheduleProfile.scheduleTier)],
    ['Streamer Weeks', formatScheduleWeekList(scheduleProfile.streamerWeeks)],
    ['Avoid Weeks', formatScheduleWeekList(scheduleProfile.avoidWeeks)],
    ['Source', scheduleProfile.source],
    ['Updated', scheduleProfile.updatedAt ? formatNewsDate(scheduleProfile.updatedAt) : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  const dynastyRank = getValueProfileRank(valueProfile, 'dynasty', currentRank);
  const seasonRank = getValueProfileRank(valueProfile, 'season', currentRank);
  const balancedRank = getValueProfileRank(valueProfile, 'balanced', currentRank);
  const contenderRank = getValueProfileRank(valueProfile, 'contender', currentRank);
  const rebuilderRank = getValueProfileRank(valueProfile, 'rebuilder', currentRank);
  const topDynastyRank = dynastyRank || (valueMode !== 'redraft' ? currentRank : null);
  const topSeasonRank = seasonRank || (valueMode === 'redraft' ? currentRank : null);
  const lastSeasonRank = details?.lastSeasonPositionRank || null;
  const dynastyValue = valueProfile?.dynastyValue
    ?? valueProfile?.balancedValue
    ?? (valueMode !== 'redraft' ? currentValue : null);
  const seasonValue = valueProfile?.seasonValue
    ?? valueProfile?.fantasyProsSeasonValue
    ?? (valueMode === 'redraft' ? currentValue : null);
  const valueConfidence = getPlayerValueConfidence({ valueProfile, mode: valueMode });
  const valueTimeline = details?.valueTimeline || null;
  const sourceValueRows = valueProfile ? (
    isRedraftValueMode
      ? [
          ['FantasyCalc Redraft', valueProfile.fantasyCalcRedraft],
          ['FantasyPros Season', valueProfile.fantasyProsSeasonValue],
          ['Season Value', valueProfile.seasonValue],
        ]
      : [
          ['Flock Fantasy', valueProfile.flockFantasy],
          ['Market Consensus', valueProfile.marketKtc],
          ['FantasyPros Dynasty', valueProfile.fantasyProsDynasty],
          ['FantasyCalc Dynasty', valueProfile.fantasyCalcDynasty],
          ['FantasyCalc Redraft', valueProfile.fantasyCalcRedraft],
          ['DynastyProcess', valueProfile.dynastyProcess],
          ['Dynasty Nerds', valueProfile.dynastyNerds],
          ['Fantasy Nerds', valueProfile.fantasyNerds],
          ['Dynasty Dealer Benchmark', valueProfile.dynastyDealerBenchmark],
          ['FantasyPros Season', valueProfile.fantasyProsSeasonValue],
        ]
  ).filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  const latestNews = playerNewsData?.latestNews ?? details?.latestNews ?? null;
  const hasMeaningfulNews = Boolean(latestNews?.title || latestNews?.summary);
  const prospectSummary = details?.prospectProfile?.summary || null;
  const playerAiReadEligible = isPlayerAiReadEligible({ position, currentRank, valueProfile });
  const intelligenceNotes = playerAiReadEligible ? buildPlayerIntelligenceNotes({
    details,
    currentRank,
    currentValue,
    position,
    valueProfile,
    valueMode,
  }) : [];
  const hasSleeperMarketSnapshot = Boolean(
    details && (
      (details.sleeperRosteredPct !== null && details.sleeperRosteredPct !== undefined)
      || (details.sleeperStartedPct !== null && details.sleeperStartedPct !== undefined)
    )
  );
  const decisionLabels = playerAiReadEligible ? buildPlayerDecisionLabels({
    details,
    currentRank,
    valueGain,
    position,
    valueProfile,
    valueMode,
  }) : [];
  const playerAiRead = playerAiReadEligible ? buildPlayerAiRead({
    playerName: pick.playerName,
    position,
    currentRank,
    currentValue,
    valueGain,
    details,
    valueProfile,
    valueMode,
    isCollegeProspect,
    prospectProfile,
    latestNews,
  }) : null;
  const draftAuditRows = [
    pick.draftDecisionVerdict ? ['Draft Read', pick.draftDecisionVerdict] : null,
    pick.draftDecisionBoardRankLabel ? ['Board Read', pick.draftDecisionBoardRankLabel] : null,
    pick.draftDecisionPrimaryNeed ? ['Roster Need', pick.draftDecisionPrimaryNeed] : null,
  ].filter((row): row is [string, string] => Boolean(row));
  const openTradeCompPeer = (peer: NonNullable<PlayerDetails['similarTradeValues']>[number]) => {
    const peerDetails = playerDetailsById?.[peer.playerId];
    const peerRank = getPeerRankForMode(peer, peerDetails, valueMode);
    const peerValue = getPeerValueForMode(peer, peerDetails, valueMode);
    setFocusedPeerPick({
      player_id: peer.playerId,
      playerName: peer.name,
      playerPos: peer.position,
      currentPositionRank: peerRank || peer.position,
      currentKtcValue: peerValue,
      valueGain: peer.difference,
      valueChangeNote: `Value difference versus ${pick.playerName}.`,
      valueMode,
      playerDetails: peerDetails || {
        playerId: peer.playerId,
        fullName: peer.name,
        position: peer.position,
        team: peer.team || null,
        valueProfile: valueMode === 'redraft'
          ? {
              seasonValue: peer.value,
              seasonPositionRank: peer.rank || peer.position,
              sources: [],
            }
          : {
              dynastyValue: peer.value,
              dynastyPositionRank: peer.rank || peer.position,
              sources: [],
            },
        },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="player-detail-modal-overlay"
        className={`player-detail-modal ${isCollegeProspect ? 'player-detail-modal-prospect' : ''} max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden border-slate-700/70 bg-[#121827] p-0 text-slate-100 shadow-2xl shadow-black/60 sm:max-h-[88vh] sm:max-w-2xl`}
        style={{ ...collegeTileStyle, background: modalBackground }}
      >
        <PremiumFxLayer variant="player-modal" intensity="low" />
        <div className="max-h-[calc(100dvh-1rem)] overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:max-h-[88vh]">
          <div
            className="relative overflow-hidden border-b border-cyan-400/20 px-4 pb-5 pt-5 sm:px-6 sm:pb-7 sm:pt-6"
            style={{
              background: heroBackground,
            }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.62)_58%,rgba(0,0,0,0.35)_100%)]" />
            <div
              className="absolute right-8 top-8 h-24 w-24 rounded-full blur-2xl"
              style={{ backgroundColor: teamColors ? `${teamColors.accent}33` : 'rgba(249,115,22,0.12)' }}
            />
            <div
              className="absolute bottom-0 left-0 h-px w-full"
              style={{
                background: teamColors
                  ? `linear-gradient(90deg, ${teamColors.accent}, ${teamColors.primary}, transparent)`
                  : undefined,
              }}
            />
            <button type="button" className="manager-modal-close player-modal-close" onClick={onClose} aria-label={`Close ${pick.playerName} details`}>
              <X aria-hidden="true" />
            </button>

            {leagueLogo && (
              <div className="absolute left-4 top-4 z-10 h-12 w-12 overflow-hidden rounded-full border border-cyan-300/30 bg-slate-950/65 p-1 shadow-lg shadow-black/35 sm:h-14 sm:w-14">
                <img
                  src={leagueLogo}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
            )}

            <DialogHeader className="relative mx-auto w-full max-w-2xl px-4 text-center sm:px-6">
              <div className="mb-4 flex justify-center">
                {pick.manager ? (
                  <div className="inline-flex w-fit items-center gap-4 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-200 shadow-lg shadow-black/20">
                    <span className="whitespace-nowrap text-cyan-300">Rostered By:</span>
                    <ManagerNameWithAvatar
                      avatarUrl={managerAvatarUrl}
                      managerName={pick.manager}
                      displayName={managerDisplayName}
                    />
                  </div>
                ) : (
                  <div className="inline-flex w-fit items-center rounded-full border border-emerald-300/35 bg-emerald-400/15 px-4 py-2 text-xs font-black tracking-[0.12em] text-emerald-300 shadow-lg shadow-black/20">
                    AVAILABLE
                  </div>
                )}
              </div>
              <DialogTitle className="sr-only">
                {pick.playerName}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Player detail view with roster value, rankings, availability, market notes, and source data.
              </DialogDescription>
            </DialogHeader>

            <div className="relative mt-4 flex justify-center sm:mt-7">
              <div className="flex w-full max-w-2xl flex-col items-center gap-3 sm:gap-4">
                <div className="relative h-22 w-22 overflow-hidden rounded-2xl border border-cyan-300/35 bg-slate-950 shadow-xl shadow-black/40 sm:h-28 sm:w-28">
                  {playerImageSrc ? (
                    <img
                      src={playerImageSrc}
                      alt={pick.playerName}
                      className="h-full w-full object-cover"
                      onError={() => {
                        if (playerImageSrc === directHeadshot && !directImageFailed) {
                          setDirectImageFailed(true);
                          return;
                        }
                        if (playerImageSrc === fallbackDraftBuzzImage) {
                          setFallbackImageFailed(true);
                          return;
                        }
                        setHeadshot(null);
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-black text-slate-600">
                      {pick.playerName.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-3 text-center">
                  <div className={`athletic-headline break-words font-black leading-none tracking-normal text-orange-400 ${playerNameSizeClass}`}>
                    {pick.playerName}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {isCollegeProspect ? (
                      <ProspectCollegePill
                        college={prospectCollege}
                        logoUrl={pick.collegeLogoUrl || prospectProfile?.collegeLogoUrl}
                      />
                    ) : (
                      <TeamLogoPill team={team} className="player-modal-team-logo-pill" />
                    )}
                    {!isCollegeProspect && jerseyNumber !== null && jerseyNumber !== undefined && jerseyNumber !== '' && (
                      <span
                        className="rounded-full border px-3 py-1 text-xs font-bold"
                        style={{
                          borderColor: teamColors ? `${teamColors.accent}66` : undefined,
                          backgroundColor: teamColors ? `${teamColors.secondary}55` : undefined,
                          color: '#fff',
                        }}
                      >
                        #{jerseyNumber}
                      </span>
                    )}
                    <span className={getPositionRankPillClass(position, 'player-modal-position-pill')}>
                      {position}
                    </span>
                  </div>
                  {isCollegeProspect && (
                    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
                      {prospectHeaderInfoRows.map(([label, value]) => (
                        <InlineInfoTile
                          key={label}
                          label={label}
                          value={value}
                          teamColors={teamColors}
                          tileAccent={tileAccent}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-slate-950/85 p-4 backdrop-blur-sm sm:space-y-5 sm:p-6">
            {(pick.round !== undefined || pick.pick !== undefined || draftValue !== undefined || pick.positionRankMay2025 || draftKindLabel || draftWindowLabel) && (
              <div className="mx-auto grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {pick.round !== undefined && (
                  <InlineInfoTile
                    label="Round"
                    value={String(pick.round)}
                    teamColors={teamColors}
                    tileAccent={tileAccent}
                  />
                )}
                {pick.pick !== undefined && (
                  <InlineInfoTile
                    label="Pick #"
                    value={String(pick.pick)}
                    teamColors={teamColors}
                    tileAccent={tileAccent}
                  />
                )}
                {draftKindLabel && (
                  <InlineInfoTile
                    label="Draft Type"
                    value={draftKindLabel}
                    teamColors={teamColors}
                    tileAccent={tileAccent}
                  />
                )}
                {draftWindowLabel && (
                  <InlineInfoTile
                    label="Value Basis"
                    value={draftWindowLabel}
                    teamColors={teamColors}
                    tileAccent={tileAccent}
                  />
                )}
                {draftValue !== undefined && (
                  <InlineInfoTile
                    label="Draft-Day Value"
                    value={draftValue ? draftValue.toLocaleString() : '-'}
                    teamColors={teamColors}
                    tileAccent={tileAccent}
                  />
                )}
                {pick.positionRankMay2025 && (
                  <InlineInfoTile
                    label="Drafted Rank"
                    value={pick.positionRankMay2025}
                    teamColors={teamColors}
                    tileAccent={tileAccent}
                    valueClassName={getPositionRankPillClass(pick.positionRankMay2025)}
                  />
                )}
              </div>
            )}

            {isCollegeProspect && prospectMetricRows.length > 0 ? (
              <div className="player-prospect-metric-grid mx-auto max-w-xl">
                {prospectMetricRows.map(([label, value]) => (
                  <InfoTile
                    key={String(label)}
                    label={String(label)}
                    value={value as ReactNode}
                    teamColors={teamColors}
                    tileAccent={tileAccent}
                    valueClassName={isPositionRankValue(value) ? getPositionRankPillClass(String(value)) : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="player-modal-metric-grid mx-auto grid max-w-xl gap-2 sm:gap-3">
                <MetricTile
                  label="Season Value"
                  mobileLabel="Season"
                  value={seasonValue ? seasonValue.toLocaleString() : '-'}
                  teamColors={teamColors}
                  tileAccent={tileAccent}
                  className="player-modal-metric-season-value"
                />
                <MetricTile label="Season Rank" mobileLabel="Season" value={topSeasonRank || '-'} valueClassName={`${getPositionRankPillClass(topSeasonRank)} player-modal-rank-value`} teamColors={teamColors} tileAccent={tileAccent} className="player-modal-metric-season-rank" />
                {!isRedraftValueMode && (
                  <>
                    <MetricTile
                      label="Dynasty Value"
                      mobileLabel="Dynasty"
                      value={dynastyValue ? dynastyValue.toLocaleString() : '-'}
                      teamColors={teamColors}
                      tileAccent={tileAccent}
                      className="player-modal-metric-dynasty-value"
                    />
                    <MetricTile label="Dynasty Rank" mobileLabel="Dynasty" value={topDynastyRank || '-'} valueClassName={`${getPositionRankPillClass(topDynastyRank)} player-modal-rank-value`} teamColors={teamColors} tileAccent={tileAccent} className="player-modal-metric-dynasty-rank" />
                  </>
                )}
                {lastSeasonRank && (
                <MetricTile
                  label={previousSeasonRankLabel}
                  mobileLabel={previousSeasonRankMobileLabel}
                  value={lastSeasonRank}
                  valueClassName={`${getPositionRankPillClass(details?.lastSeasonPositionRank)} player-modal-rank-value`}
                  teamColors={teamColors}
                  tileAccent={tileAccent}
                  className="player-modal-metric-last-season"
                />
                )}
                {valueGain !== undefined && valueGain !== null && (
                <MetricTile
                  label="Value Change"
                  mobileLabel="Change"
                  value={valueGain !== undefined && valueGain !== null ? `${valueGain > 0 ? '+' : ''}${valueGain.toLocaleString()}` : '-'}
                  tone={valueGain !== undefined && valueGain !== null && valueGain > 0 ? 'positive' : valueGain !== undefined && valueGain !== null && valueGain < 0 ? 'negative' : 'neutral'}
                  icon={
                    valueGain !== undefined && valueGain !== null && valueGain > 0 ? <TrendingUp className="h-4 w-4" /> : valueGain !== undefined && valueGain !== null && valueGain < 0 ? <TrendingDown className="h-4 w-4" /> : null
                  }
                  teamColors={teamColors}
                  tileAccent={tileAccent}
                  className="player-modal-metric-change"
                />
                )}
              </div>
            )}

            {!isCollegeProspect && valueGain !== undefined && (
              <p className="text-center text-[0.72rem] leading-none text-slate-500 sm:text-xs">
                <span className="font-semibold text-cyan-300">Value Change:</span> {valueChangeNote}
              </p>
            )}

            {!isCollegeProspect && pick.taxiReason && (
              <div className="player-modal-taxi-read mx-auto max-w-xl">
                <div>
                  <span>Taxi Read</span>
                  <strong>{pick.taxiAction || 'Taxi Note'}</strong>
                </div>
                <p>{pick.taxiReason}</p>
              </div>
            )}

            {!isCollegeProspect && details?.similarTradeValues?.length ? (
              <div className="player-trade-comps mx-auto max-w-xl space-y-2">
                <p className="player-modal-section-kicker text-center text-[0.68rem] font-black uppercase tracking-[0.2em] text-cyan-300/80">
                  Cross-Position Trade Comps
                </p>
                <div className="player-trade-comp-grid grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {details.similarTradeValues.map((peer, index) => (
                    <button
                      key={`${peer.playerId}-${index}`}
                      type="button"
                      className="player-trade-comp-card"
                      onClick={() => openTradeCompPeer(peer)}
                      aria-label={`Open ${peer.name} trade comparison details`}
                    >
                      <span className="player-trade-comp-context">{peer.label || `Nearest ${peer.position}`}</span>
                      <span className="player-trade-comp-identity">
                        <PlayerNameWithHeadshot
                          playerId={peer.playerId}
                          playerName={peer.name}
                          team={peer.team}
                          position={peer.position}
                        />
                      </span>
                      <span className="player-trade-comp-meta">
                        <TeamLogoPill team={peer.team} />
                        <span className={getPositionRankPillClass(peer.rank || peer.position)}>{peer.rank || peer.position}</span>
                      </span>
                      <div className="player-trade-comp-values">
                        <span>
                          <em>Value</em>
                          <strong>{peer.value.toLocaleString()}</strong>
                        </span>
                        <span className={peer.difference > 0 ? 'player-trade-comp-delta-positive' : peer.difference < 0 ? 'player-trade-comp-delta-negative' : 'player-trade-comp-delta-neutral'}>
                          <em>Gap</em>
                          <strong>
                            {peer.difference > 0 ? '+' : ''}{peer.difference.toLocaleString()}
                            {peer.difference > 0 && <TrendingUp className="h-3.5 w-3.5" />}
                            {peer.difference < 0 && <TrendingDown className="h-3.5 w-3.5" />}
                          </strong>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {(pick.draftDecisionSummary || pick.draftDecisionAltPlayerName) && (
              <div className="mx-auto max-w-xl rounded-2xl border border-cyan-300/18 bg-slate-950/45 p-3 shadow-inner shadow-white/[0.02] sm:p-4">
                <p className="text-center text-[0.68rem] font-black uppercase tracking-[0.2em] text-cyan-300/85">
                  {isRedraftValueMode ? 'Draft-Day vs Current Value' : 'Draft Decision Audit'}
                </p>
                {draftAuditRows.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {draftAuditRows.map(([label, value]) => (
                      <InfoTile
                        key={label}
                        label={label}
                        value={value}
                        teamColors={teamColors}
                        tileAccent={tileAccent}
                        valueClassName={label === 'Roster Need' ? '' : getPositionRankPillClass(value)}
                      />
                    ))}
                  </div>
                )}
                {pick.draftDecisionSummary && (
                  <p className="mt-3 text-center text-[0.78rem] font-bold leading-relaxed text-slate-300">
                    {pick.draftDecisionSummary}
                  </p>
                )}
                {pick.draftDecisionAltPlayerName && (
                  <p className="mt-2 text-center text-[0.74rem] font-bold leading-relaxed text-amber-300">
                    {pick.draftDecisionAltLabel || 'Alternative:'} {pick.draftDecisionAltPlayerName}
                    {pick.draftDecisionAltPosition ? ` (${pick.draftDecisionAltPosition})` : ''}
                    {pick.draftDecisionAltPickLabel ? ` at ${pick.draftDecisionAltPickLabel}` : ''}
                  </p>
                )}
              </div>
            )}

            {!isCollegeProspect && decisionLabels.length > 0 && (
              <div className="player-decision-strip mx-auto max-w-xl">
                {decisionLabels.map((label) => (
                  <span key={label.label} className={`player-decision-pill player-decision-${label.tone}`}>
                    <strong>{label.label}</strong>
                    <em>{label.copy}</em>
                  </span>
                ))}
              </div>
            )}

            {scheduleRows.length > 0 && (
              <div className="mx-auto max-w-xl space-y-2">
                <CompleteDataSection
                  title="Schedule / Bye Window"
                  rows={scheduleRows}
                  teamColors={teamColors}
                  tileAccent={tileAccent}
                  compactNumbers
                  wide
                  priority
                />
                <p className="text-center text-[0.68rem] font-bold uppercase tracking-[0.16em] text-cyan-200/70 sm:text-xs">
                  Lower SOS values are tougher matchups. Use this for bye-week coverage and streamer timing.
                </p>
              </div>
            )}

            {showAIRead && playerAiRead && (
              <AIReadPanel
                title={playerAiRead.title}
                subtitle={playerAiRead.subtitle}
                readType={playerAiRead.readType}
                confidence={playerAiRead.confidence}
                confidenceNote={playerAiRead.confidenceNote}
                severity={playerAiRead.severity}
                chips={playerAiRead.chips}
                body={playerAiRead.body}
                backgroundVariant={playerAiRead.backgroundVariant}
                className="player-modal-ai-read mx-auto max-w-xl"
              />
            )}

            {isCollegeProspect && prospectProfile?.summary ? (
              <div className="mx-auto max-w-xl rounded-2xl border border-cyan-300/15 bg-slate-950/45 p-3 text-center shadow-inner shadow-white/[0.02] sm:p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-cyan-300/85">
                  Prospect Snapshot
                </p>
                <p className="mt-2 text-sm font-bold leading-relaxed text-slate-300">
                  {prospectProfile.summary}
                </p>
              </div>
            ) : null}

            {!isCollegeProspect && (intelligenceNotes.length > 0 || hasSleeperMarketSnapshot) && (
              <div className="player-intelligence-panel mx-auto max-w-xl">
                <p className="player-intelligence-title">
                  Player Intelligence
                </p>
                <SleeperMarketBadge details={details} />
                {intelligenceNotes.length > 0 && (
                  <div className="player-intelligence-grid">
                    {intelligenceNotes.map((note) => (
                      <div
                        key={`${note.label}-${note.value}`}
                        className={`player-intelligence-card player-intelligence-card-${note.tone || 'neutral'} ${note.fullWidth ? 'player-intelligence-card-wide' : ''}`}
                      >
                        <div className="player-intelligence-label">
                          {note.label}
                        </div>
                        <div
                          className={`player-intelligence-value ${
                            note.tone === 'risk'
                              ? 'text-rose-300'
                              : note.tone === 'upside'
                                ? 'text-emerald-300'
                                : note.tone === 'market'
                                  ? 'text-amber-300'
                                  : 'text-slate-100'
                          }`}
                        >
                          {note.value}
                        </div>
                        {note.copy && (
                          <p className="player-intelligence-copy">
                            {note.copy}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isCollegeProspect && valueProfile && (
              <div className="mx-auto max-w-xl space-y-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  <InfoTile label="Season" value={seasonRank || '-'} valueClassName={getPositionRankPillClass(seasonRank)} teamColors={teamColors} tileAccent={tileAccent} />
                  {isRedraftValueMode ? (
                    <>
                      <InfoTile label="Position Rank" value={topSeasonRank || currentRank || '-'} valueClassName={getPositionRankPillClass(topSeasonRank || currentRank)} teamColors={teamColors} tileAccent={tileAccent} />
                      <InfoTile label="Team Role" value={formatDepthChartRole(details, true) || availability.label} teamColors={teamColors} tileAccent={tileAccent} />
                      <InfoTile label="Trend" value={valueGain !== undefined && valueGain !== null ? `${valueGain > 0 ? '+' : ''}${valueGain.toLocaleString()}` : '-'} teamColors={teamColors} tileAccent={tileAccent} />
                    </>
                  ) : (
                    <>
                      <InfoTile label="Dynasty" value={dynastyRank || '-'} valueClassName={getPositionRankPillClass(dynastyRank)} teamColors={teamColors} tileAccent={tileAccent} />
                      <InfoTile label="Contender" value={contenderRank || '-'} valueClassName={getPositionRankPillClass(contenderRank)} teamColors={teamColors} tileAccent={tileAccent} />
                      <InfoTile label="Rebuilder" value={rebuilderRank || '-'} valueClassName={getPositionRankPillClass(rebuilderRank)} teamColors={teamColors} tileAccent={tileAccent} />
                    </>
                  )}
                </div>
                <div className={`player-value-confidence-card player-value-confidence-card-${valueConfidence.tone}`}>
                  <span>Value Confidence</span>
                  <strong>{valueConfidence.label} · {valueConfidence.score}%</strong>
                  <p>{valueConfidence.note}</p>
                </div>
                {valueTimeline && valueTimeline.points.length >= 2 && (
                  <PlayerValueTimelineCard timeline={valueTimeline} playerName={pick.playerName} teamColors={teamColors} tileAccent={tileAccent} showSourceAdmin={showAIRead} />
                )}
                {valueProfile.sources && valueProfile.sources.length > 0 && (
                  <p className="text-center text-[0.68rem] font-bold leading-relaxed uppercase tracking-[0.16em] text-cyan-200/70">
                    {isRedraftValueMode
                      ? 'Season rank uses current-season outlook, expert baselines, team role, and league format.'
                      : 'Our rank score weighs dynasty market, current-season outlook, expert baselines, and team-window fit.'}
                    {valueProfile.fantasyProsPositionRank ? ` Expert season baseline: ${valueProfile.fantasyProsPositionRank}.` : ''}
                  </p>
                )}
              </div>
            )}

            <div className="mx-auto max-w-xl space-y-3">
              {!isCollegeProspect && physicalRows.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {physicalRows.map(([label, value]) => (
                    <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
                  ))}
                </div>
              )}
              {playerBioRows.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {playerBioRows.map(([label, value]) => (
                    <InfoTile
                      key={String(label)}
                      label={String(label)}
                      value={value}
                      teamColors={teamColors}
                      tileAccent={tileAccent}
                    />
                  ))}
                </div>
              )}
              {!isCollegeProspect && lastSeasonRows.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {lastSeasonRows.map(([label, value]) => (
                    <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
                  ))}
                </div>
              )}
              {!isCollegeProspect && availabilityRows.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {availabilityRows.map(([label, value]) => (
                    <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
                  ))}
                </div>
              )}
              {!isCollegeProspect && details?.availabilityHistory?.length ? (
                <p className="text-center text-[0.68rem] font-bold leading-relaxed text-slate-400">
                  Availability: {details.availabilityHistory.map((item) => `${item.season}: ${item.games ?? '-'} GP`).join(' · ')}
                </p>
              ) : null}
              {!isCollegeProspect && experienceRows.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {experienceRows.map(([label, value]) => (
                    <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
                  ))}
                </div>
              )}
            </div>

            {((isAdminView && sourceValueRows.length > 0)
              || prospectRows.length > 0
              || Boolean(prospectSummary)
              || hasMeaningfulNews
              || Boolean(details?.availabilityHistory?.length)) && (
              <div className="player-complete-data mx-auto max-w-xl">
                <p className="player-complete-title">Source Detail</p>
                <div className="player-complete-grid">
                  <CompleteDataSection title="Prospect File" rows={prospectRows} teamColors={teamColors} tileAccent={tileAccent} wide />
                  {prospectSummary ? (
                    <div
                      className="player-complete-section player-complete-section-wide border-cyan-300/15 bg-slate-950/55 p-4 sm:p-5"
                      style={{
                        borderColor: teamColors ? `${tileAccent || teamColors.accent}22` : undefined,
                        background: teamColors
                          ? `linear-gradient(135deg, ${teamColors.secondary}18, rgba(2,6,23,0.7) 70%, ${teamColors.primary}20)`
                          : undefined,
                      }}
                      >
                        <h4>Prospect Summary</h4>
                      <p className="mt-3 break-words whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-200 sm:text-[0.95rem]">
                        {prospectSummary}
                      </p>
                    </div>
                  ) : null}
                  {isAdminView && sourceValueRows.length > 0 ? (
                    <div
                      className="player-complete-section player-complete-section-wide border-cyan-300/15 bg-slate-950/55 p-4 sm:p-5"
                      style={{
                        borderColor: teamColors ? `${tileAccent || teamColors.accent}22` : undefined,
                        background: teamColors
                          ? `linear-gradient(135deg, ${teamColors.secondary}18, rgba(2,6,23,0.7) 70%, ${teamColors.primary}20)`
                          : undefined,
                      }}
                    >
                      <h4>Source Inputs</h4>
                      <div className="mt-3 grid gap-2">
                        {sourceValueRows.map(([label, value]) => (
                          <div
                            key={`source-${label}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-cyan-300/10 bg-slate-950/35 px-3 py-2.5"
                          >
                            <span className="min-w-0 flex-1 font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-cyan-200/80 sm:text-[0.72rem]">
                              {label}
                            </span>
                            <strong className="min-w-0 shrink-0 text-right text-sm font-black text-slate-100 sm:text-base">
                              {formatCompleteValue(value)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {latestNews && hasMeaningfulNews ? (
                    latestNews?.url ? (
                      <a
                        href={latestNews.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="player-complete-section player-complete-section-wide block border-cyan-300/15 bg-slate-950/55 p-4 text-left no-underline transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-slate-950/75 sm:p-5"
                        style={{
                          borderColor: teamColors ? `${tileAccent || teamColors.accent}22` : undefined,
                          background: teamColors
                            ? `linear-gradient(135deg, ${teamColors.secondary}18, rgba(2,6,23,0.7) 70%, ${teamColors.primary}20)`
                            : undefined,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4>Latest News</h4>
                            <p className="mt-3 break-words text-base font-black leading-tight text-slate-50 sm:text-lg">
                              {latestNews.title}
                            </p>
                            <p className="mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan-200/75">
                              {[latestNews.source, latestNews.publishedAt ? formatNewsDate(latestNews.publishedAt) : null].filter(Boolean).join(' · ') || 'Recent update'}
                            </p>
                            {latestNews.summary ? (
                              <p className="mt-3 break-words whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-200 sm:text-[0.95rem]">
                                {latestNews.summary}
                              </p>
                            ) : null}
                          </div>
                          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </div>
                      </a>
                    ) : (
                      <div
                        className="player-complete-section player-complete-section-wide border-cyan-300/15 bg-slate-950/55 p-4 text-left sm:p-5"
                        style={{
                          borderColor: teamColors ? `${tileAccent || teamColors.accent}22` : undefined,
                          background: teamColors
                            ? `linear-gradient(135deg, ${teamColors.secondary}18, rgba(2,6,23,0.7) 70%, ${teamColors.primary}20)`
                            : undefined,
                        }}
                      >
                        <h4>Latest News</h4>
                        <p className="mt-3 break-words text-base font-black leading-tight text-slate-50 sm:text-lg">
                          {latestNews.title}
                        </p>
                        <p className="mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan-200/75">
                          {[latestNews.source, latestNews.publishedAt ? formatNewsDate(latestNews.publishedAt) : null].filter(Boolean).join(' · ') || 'Recent update'}
                        </p>
                        {latestNews.summary ? (
                          <p className="mt-3 break-words whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-200 sm:text-[0.95rem]">
                            {latestNews.summary}
                          </p>
                        ) : null}
                      </div>
                    )
                  ) : null}
              {details?.availabilityHistory?.length ? (
                <div className="player-complete-section player-complete-section-wide">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4>Availability History</h4>
                      <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-cyan-200/70">
                        Tap a year to open the weekly log.
                      </p>
                    </div>
                  </div>
                  <div className="player-availability-grid">
                    {details.availabilityHistory.map((item) => {
                      const isActive = expandedAvailabilitySeason === item.season;
                      return (
                        <button
                          key={item.season}
                          type="button"
                          className={`player-availability-card ${isActive ? 'is-active' : ''}`}
                          aria-expanded={isActive}
                          onClick={() => setExpandedAvailabilitySeason((current) => (current === item.season ? null : item.season))}
                        >
                          <span className="player-availability-card-kicker">Year</span>
                          <strong className="player-availability-card-year">{item.season}</strong>
                          <div className="player-availability-card-metrics">
                            <div className="player-availability-card-metric">
                              <small>Position Rank</small>
                              <strong>{item.positionRank || '-'}</strong>
                            </div>
                            <div className="player-availability-card-metric">
                              <small>Position PPG</small>
                              <strong>{formatSeasonStatValue(item.pointsPerGame)}</strong>
                            </div>
                            <div className="player-availability-card-metric">
                              <small>Games Played</small>
                              <strong>{formatSeasonStatValue(item.games)}</strong>
                            </div>
                            <div className="player-availability-card-metric">
                              <small>Games Missed</small>
                              <strong>{formatSeasonStatValue(item.gamesMissed)}</strong>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {expandedAvailabilitySeason ? (
                    <div className="player-availability-log-panel">
                      <div className="player-availability-log-header">
                        <div>
                          <span className="player-availability-log-kicker">Weekly Log</span>
                          <h5>{selectedAvailabilityHistory?.season || expandedAvailabilitySeason}</h5>
                          <p>
                            {selectedAvailabilityHistory
                              ? `${formatSeasonStatValue(selectedAvailabilityHistory.games)} GP · ${formatSeasonStatValue(selectedAvailabilityHistory.gamesMissed)} missed · ${formatSeasonStatValue(selectedAvailabilityHistory.pointsPerGame)} PPG${selectedAvailabilityHistory.positionRank ? ` · ${selectedAvailabilityHistory.positionRank}` : ''}`
                              : 'Loading weekly game data from Sleeper.'}
                          </p>
                        </div>
                        {isSeasonGameLogFetching ? (
                          <span className="player-availability-log-loading">Loading...</span>
                        ) : null}
                      </div>
                      {seasonGameLog?.weeklyGames?.length ? (
                        <div className="player-availability-log-list">
                          {seasonGameLog.weeklyGames.map((game) => (
                            <div key={`${expandedAvailabilitySeason}-${game.week}`} className="player-availability-log-row">
                              <div className="player-availability-log-meta">
                                <strong>Week {game.week}</strong>
                                <span>{game.positionRank || '-'}</span>
                              </div>
                              <strong className="player-availability-log-points">
                                {formatSeasonStatValue(game.fantasyPoints)} pts
                              </strong>
                              <p className="player-availability-log-stats">{game.statLine}</p>
                            </div>
                          ))}
                        </div>
                      ) : isSeasonGameLogFetching ? (
                        <p className="player-availability-log-empty">Loading weekly game log from Sleeper...</p>
                      ) : (
                        <p className="player-availability-log-empty">No weekly game log was returned for that season.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!isCollegeProspect && hasLeagueUsage && leagueUsage ? (
                <div className="player-complete-section player-complete-section-wide">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4>League Usage</h4>
                      <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-cyan-200/70">
                        Weekly roster tenure from the previous season, not a percentage.
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <strong className="block text-sm font-black text-slate-50 sm:text-base">
                        {formatSeasonStatValue(leagueUsage.startedGames)} started / {formatSeasonStatValue(leagueUsage.ownedGames)} owned
                      </strong>
                      <span className="mt-1 block text-[0.68rem] font-bold uppercase tracking-[0.14em] text-cyan-200/70">
                        {leagueUsage.season}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {leagueUsage.managerBreakdown.map((entry) => (
                      <div
                        key={`${entry.manager}-${entry.rosterId}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-cyan-300/10 bg-slate-950/35 px-3 py-2.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-100">
                          {entry.manager}
                        </span>
                        <span className="shrink-0 text-right">
                          <strong className="block text-sm font-black text-slate-50">
                            {formatSeasonStatValue(entry.startedGames)} / {formatSeasonStatValue(entry.ownedGames)}
                          </strong>
                          <span className="block text-[0.62rem] font-bold uppercase tracking-[0.14em] text-cyan-200/65">
                            started / owned
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
              </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatHeight(height: PlayerDetails['height']) {
  if (height === null || height === undefined || height === '') return height;

  if (typeof height === 'number' || /^\d+$/.test(String(height))) {
    const totalInches = Number(height);
    if (Number.isFinite(totalInches) && totalInches > 0) {
      const feet = Math.floor(totalInches / 12);
      const inches = totalInches % 12;
      return `${feet}'${inches}"`;
    }
  }

  const raw = String(height);
  const dashMatch = raw.match(/^(\d+)-(\d+)$/);
  if (dashMatch) {
    return `${dashMatch[1]}'${dashMatch[2]}"`;
  }

  return raw;
}

function getPlayerNameSizeClass(name: string) {
  if (name.length > 24) return 'text-[1.25rem] sm:text-[1.65rem]';
  if (name.length > 18) return 'text-[1.45rem] sm:text-[1.85rem]';
  return 'text-[1.7rem] sm:text-[2.15rem]';
}

function formatBirthday(birthDate: PlayerDetails['birthDate']) {
  if (!birthDate) return null;
  const date = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return birthDate;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFortyTime(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '-';
  const trimmed = numeric.toFixed(2).replace(/\.?0+$/, '');
  return `${trimmed}s`;
}

function formatSleeperNewsUpdated(value: PlayerDetails['sleeperNewsUpdated']) {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const timestamp = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDepthChart(position: string | null | undefined, order: number | null | undefined) {
  if (!position) return null;
  const normalizedPosition = ['SWR', 'LWR', 'RWR'].includes(position) ? 'WR' : position;
  return [normalizedPosition, order ? `#${order}` : null].filter(Boolean).join(' ');
}

function formatDepthChartRole(details: PlayerDetails | undefined, includeActualPrefix = false) {
  const label = formatDepthChart(details?.depthChartPosition, details?.depthChartOrder);
  if (!label) return null;
  return includeActualPrefix && details?.depthChartVerified ? `Current ${label}` : label;
}

function getPreviousSeasonRankLabel(details?: PlayerDetails) {
  return details?.lastSeasonYear ? `${details.lastSeasonYear} Rank` : 'Previous Rank';
}

function getPreviousSeasonRankMobileLabel(details?: PlayerDetails) {
  return details?.lastSeasonYear || 'Prev';
}

function formatValueLens(value: number | null | undefined) {
  if (!value) return '-';
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}K`;
  return value.toLocaleString();
}

function formatValueDelta(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatValueLens(value)}`;
}

function formatTimelineDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildTimelineCoordinates(points: Array<{ value: number }>, width: number, height: number, padding = 8) {
  if (points.length < 2) return [];
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return points.map((point, index) => ({
    x: Math.round((padding + (index / Math.max(1, points.length - 1)) * innerWidth) * 10) / 10,
    y: Math.round((padding + (1 - ((point.value - min) / range)) * innerHeight) * 10) / 10,
  }));
}

function buildTimelinePath(points: Array<{ value: number }>, width: number, height: number, padding = 8) {
  const coordinates = buildTimelineCoordinates(points, width, height, padding);
  if (!coordinates.length) return '';
  return coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function formatTimelineSources(sources: string[]) {
  if (!sources.length) return 'No source labels';
  if (sources.length <= 3) return sources.join(', ');
  return `${sources.slice(0, 3).join(', ')} +${sources.length - 3}`;
}

function formatTimelineSourceValue(value: number | null | undefined) {
  return value ? formatValueLens(value) : '-';
}

type TimelinePoint = NonNullable<NonNullable<PlayerDetails['valueTimeline']>['points']>[number];

function buildTimelineSourceAudit(point: TimelinePoint) {
  const sourceRows = [
    { key: 'marketKtc', label: 'KTC', value: point.marketKtc },
    { key: 'fantasyCalcDynasty', label: 'FantasyCalc', value: point.fantasyCalcDynasty },
    { key: 'fantasyProsDynasty', label: 'FantasyPros', value: point.fantasyProsDynasty },
    { key: 'dynastyProcess', label: 'DynastyProcess', value: point.dynastyProcess },
    { key: 'dynastyNerds', label: 'Dynasty Nerds', value: point.dynastyNerds },
    { key: 'flockFantasy', label: 'Flock', value: point.flockFantasy },
  ].map((row) => {
    const delta = row.value ? Math.round(row.value - point.value) : null;
    return {
      ...row,
      delta,
      tone: delta === null ? 'missing' : delta >= 350 ? 'high' : delta <= -350 ? 'low' : 'neutral',
    };
  });
  const availableRows = sourceRows.filter((row) => row.value);
  const high = availableRows.reduce<typeof availableRows[number] | null>((best, row) => (!best || (row.value || 0) > (best.value || 0) ? row : best), null);
  const low = availableRows.reduce<typeof availableRows[number] | null>((best, row) => (!best || (row.value || 0) < (best.value || 0) ? row : best), null);
  const spread = high?.value && low?.value ? Math.round(high.value - low.value) : null;

  return {
    sourceRows,
    availableRows,
    high,
    low,
    spread,
  };
}

function formatSourceDelta(delta: number | null) {
  if (delta === null) return 'Missing';
  if (delta === 0) return 'Even';
  return `${delta > 0 ? '+' : ''}${formatValueLens(delta)}`;
}

function PlayerValueTimelineCard({
  timeline,
  playerName,
  teamColors,
  tileAccent,
  showSourceAdmin = false,
}: {
  timeline: NonNullable<PlayerDetails['valueTimeline']>;
  playerName: string;
  teamColors?: { primary: string; secondary: string; accent: string } | null;
  tileAccent?: string;
  showSourceAdmin?: boolean;
}) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const firstPoint = timeline.points[0];
  const lastPoint = timeline.points[timeline.points.length - 1];
  const delta = timeline.summary.delta;
  const isPositive = (delta || 0) > 0;
  const isNegative = (delta || 0) < 0;
  const strokeColor = isPositive ? '#34d399' : isNegative ? '#fb7185' : tileAccent || teamColors?.accent || '#67e8f9';
  const path = useMemo(() => buildTimelinePath(timeline.points, 260, 86), [timeline.points]);
  const deltaLabel = [
    formatValueDelta(delta),
    timeline.summary.deltaPct !== null && timeline.summary.deltaPct !== undefined
      ? `${timeline.summary.deltaPct > 0 ? '+' : ''}${timeline.summary.deltaPct}%`
      : null,
  ].filter(Boolean).join(' / ');

  return (
    <>
      <button
        type="button"
        className="player-value-timeline-trigger rounded-lg border p-3 text-left sm:p-4"
        style={{
          borderColor: teamColors ? `${tileAccent || teamColors.accent}26` : undefined,
          background: teamColors
            ? `linear-gradient(135deg, rgba(2,6,23,0.78), ${teamColors.primary}18 58%, ${teamColors.secondary}20)`
            : undefined,
        }}
        onClick={() => setIsDetailOpen(true)}
        aria-label={`Open ${playerName} value timeline detail`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-cyan-200/75">
              Value Timeline
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-black text-slate-100">
              <span>{formatValueLens(firstPoint.value)}</span>
              <span className="text-slate-500">to</span>
              <span>{formatValueLens(lastPoint.value)}</span>
              {lastPoint.rank && (
                <span className={getPositionRankPillClass(lastPoint.rank)}>
                  {lastPoint.rank}
                </span>
              )}
            </div>
          </div>
          <div className="grid shrink-0 justify-items-end gap-1 text-right">
            <div className={`text-sm font-black ${isPositive ? 'text-emerald-300' : isNegative ? 'text-rose-300' : 'text-slate-200'}`}>
              {deltaLabel}
            </div>
            <span className="player-value-timeline-open-pill">Open detail</span>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-slate-950/45 p-2">
          <svg
            viewBox="0 0 260 86"
            role="img"
            aria-label={`Stored value timeline from ${formatValueLens(firstPoint.value)} to ${formatValueLens(lastPoint.value)}`}
            className="h-[86px] w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <line x1="8" y1="72" x2="252" y2="72" stroke="rgba(148,163,184,0.24)" strokeWidth="1" />
            <line x1="8" y1="12" x2="252" y2="12" stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
            <path d={path} fill="none" stroke="rgba(15,23,42,0.85)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d={path} fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {buildTimelineCoordinates(timeline.points, 260, 86).map((point, index) => (
              <circle
                key={`${timeline.points[index].date}-${timeline.points[index].value}`}
                cx={point.x}
                cy={point.y}
                r={index === 0 || index === timeline.points.length - 1 ? 3.5 : 2.2}
                fill={index === timeline.points.length - 1 ? strokeColor : 'rgba(226,232,240,0.86)'}
              />
            ))}
          </svg>
          <div className="mt-1 flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-400">
            <span>{formatTimelineDate(firstPoint.date)}</span>
            <span>{timeline.points.length} pts</span>
            <span>{formatTimelineDate(lastPoint.date)}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-300">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-cyan-100">
            {lastPoint.sourceCount} sources
          </span>
          {timeline.summary.sourceSetChanged && (
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-amber-100">
              source mix changed
            </span>
          )}
        </div>
        {lastPoint.events?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lastPoint.events.map((event) => (
              <span
                key={`${event.type}-${event.label}`}
                className={`player-value-event-chip player-value-event-chip-${event.tone}`}
                title={event.detail || undefined}
              >
                {event.label}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {timeline.summary.note}
        </p>
      </button>

      <PlayerValueTimelineDetailDialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        playerName={playerName}
        timeline={timeline}
        strokeColor={strokeColor}
        deltaLabel={deltaLabel}
        showSourceAdmin={showSourceAdmin}
      />
    </>
  );
}

function PlayerValueTimelineDetailDialog({
  isOpen,
  onClose,
  playerName,
  timeline,
  strokeColor,
  deltaLabel,
  showSourceAdmin,
}: {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  timeline: NonNullable<PlayerDetails['valueTimeline']>;
  strokeColor: string;
  deltaLabel: string;
  showSourceAdmin: boolean;
}) {
  const firstPoint = timeline.points[0];
  const lastPoint = timeline.points[timeline.points.length - 1];
  const chartPoints = useMemo(() => buildTimelineCoordinates(timeline.points, 520, 178, 18), [timeline.points]);
  const chartPath = useMemo(() => buildTimelinePath(timeline.points, 520, 178, 18), [timeline.points]);
  const sourceAudit = useMemo(() => buildTimelineSourceAudit(lastPoint), [lastPoint]);
  const eventList = timeline.points.flatMap((point) =>
    (point.events || []).map((event) => ({
      ...event,
      date: point.date,
      value: point.value,
    }))
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="player-value-timeline-overlay"
        className="player-value-timeline-modal max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden border-cyan-300/20 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 sm:max-h-[86vh] sm:max-w-3xl"
      >
        <div className="player-value-timeline-modal-inner">
          <button type="button" className="manager-modal-close" onClick={onClose} aria-label={`Close ${playerName} value timeline detail`}>
            <X />
          </button>
          <DialogHeader className="player-value-timeline-modal-header">
            <p className="player-value-timeline-kicker">Stored Value Timeline</p>
            <DialogTitle className="player-value-timeline-title">{playerName}</DialogTitle>
            <DialogDescription className="player-value-timeline-description">
              Blended market movement with source coverage, ranks, and situation markers attached to the latest stored point.
            </DialogDescription>
          </DialogHeader>

          <div className="player-value-timeline-modal-body">
            <div className="player-value-timeline-metric-grid">
              <TimelineMetric label="Start" value={formatValueLens(firstPoint.value)} note={formatTimelineDate(firstPoint.date)} />
              <TimelineMetric label="Current" value={formatValueLens(lastPoint.value)} note={formatTimelineDate(lastPoint.date)} />
              <TimelineMetric label="Move" value={deltaLabel} note={timeline.summary.sourceSetChanged ? 'Source mix changed' : 'Same source set'} />
              <TimelineMetric label="Latest Rank" value={lastPoint.rank || '-'} note={`${lastPoint.sourceCount} sources`} />
            </div>

            <div className="player-value-timeline-chart-panel">
              <svg
                viewBox="0 0 520 178"
                role="img"
                aria-label={`${playerName} stored value timeline detail`}
                className="player-value-timeline-chart"
                preserveAspectRatio="none"
              >
                <line x1="18" y1="150" x2="502" y2="150" stroke="rgba(148,163,184,0.24)" strokeWidth="1" />
                <line x1="18" y1="88" x2="502" y2="88" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
                <line x1="18" y1="26" x2="502" y2="26" stroke="rgba(148,163,184,0.16)" strokeWidth="1" />
                <path d={chartPath} fill="none" stroke="rgba(15,23,42,0.9)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                <path d={chartPath} fill="none" stroke={strokeColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                {chartPoints.map((point, index) => {
                  const timelinePoint = timeline.points[index];
                  const hasEvents = Boolean(timelinePoint.events?.length);
                  return (
                    <g key={`${timelinePoint.date}-${timelinePoint.value}`}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={hasEvents ? 6.2 : index === 0 || index === timeline.points.length - 1 ? 4.6 : 3}
                        fill={hasEvents ? 'rgba(251, 191, 36, 0.95)' : index === timeline.points.length - 1 ? strokeColor : 'rgba(226,232,240,0.92)'}
                        stroke={hasEvents ? 'rgba(15,23,42,0.95)' : 'transparent'}
                        strokeWidth={hasEvents ? 2 : 0}
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="player-value-timeline-chart-footer">
                <span>{formatTimelineDate(firstPoint.date)}</span>
                <span>{timeline.points.length} stored snapshots</span>
                <span>{formatTimelineDate(lastPoint.date)}</span>
              </div>
            </div>

            {showSourceAdmin && (
              <section className="player-value-timeline-section player-value-source-admin-panel">
                <div className="player-value-timeline-section-header">
                  <span>Admin Source Audit</span>
                  <strong>{sourceAudit.availableRows.length}/6 live</strong>
                </div>
                <div className="player-value-source-audit-metrics">
                  <TimelineMetric
                    label="Spread"
                    value={sourceAudit.spread !== null ? formatValueLens(sourceAudit.spread) : '-'}
                    note="High vs low source"
                  />
                  <TimelineMetric
                    label="High Source"
                    value={sourceAudit.high?.label || '-'}
                    note={sourceAudit.high?.value ? formatValueLens(sourceAudit.high.value) : 'Missing'}
                  />
                  <TimelineMetric
                    label="Low Source"
                    value={sourceAudit.low?.label || '-'}
                    note={sourceAudit.low?.value ? formatValueLens(sourceAudit.low.value) : 'Missing'}
                  />
                  <TimelineMetric
                    label="Coverage"
                    value={`${lastPoint.sourceCount}`}
                    note={timeline.summary.sourceSetChanged ? 'Source mix changed' : 'Stable source set'}
                  />
                </div>
                <div className="player-value-source-audit-grid">
                  {sourceAudit.sourceRows.map((row) => (
                    <article key={row.key} className={`player-value-source-audit-row player-value-source-audit-row-${row.tone}`}>
                      <span>{row.label}</span>
                      <strong>{formatTimelineSourceValue(row.value)}</strong>
                      <em>{formatSourceDelta(row.delta)} vs blend</em>
                    </article>
                  ))}
                </div>
                <p className="player-value-source-admin-note">
                  Use this to debug whether the blended value moved because the market moved, a new source entered the blend, or one provider is pulling materially away from consensus.
                </p>
              </section>
            )}

            <section className="player-value-timeline-section">
              <div className="player-value-timeline-section-header">
                <span>Situation Markers</span>
                <strong>{eventList.length || 0}</strong>
              </div>
              {eventList.length ? (
                <div className="player-value-event-detail-grid">
                  {eventList.map((event) => (
                    <article key={`${event.date}-${event.type}-${event.label}`} className={`player-value-event-detail player-value-event-detail-${event.tone}`}>
                      <div>
                        <span>{formatTimelineDate(event.date)}</span>
                        <strong>{event.label}</strong>
                      </div>
                      <p>{event.detail || 'Situation signal attached to this value point.'}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="player-value-timeline-empty">No situation markers were attached to this timeline window.</p>
              )}
            </section>

            <section className="player-value-timeline-section">
              <div className="player-value-timeline-section-header">
                <span>Snapshot Source History</span>
                <strong>{timeline.points.length}</strong>
              </div>
              <div className="player-value-source-history">
                {timeline.points.map((point) => (
                  <article key={`${point.date}-${point.value}`} className="player-value-source-row">
                    <div className="player-value-source-row-main">
                      <span>{formatTimelineDate(point.date)}</span>
                      <strong>{formatValueLens(point.value)}</strong>
                      <em>{point.rank || 'No rank'}</em>
                    </div>
                    <p>{formatTimelineSources(point.sources)}</p>
                    <div className="player-value-source-grid">
                      <span>KTC <strong>{formatTimelineSourceValue(point.marketKtc)}</strong></span>
                      <span>FC <strong>{formatTimelineSourceValue(point.fantasyCalcDynasty)}</strong></span>
                      <span>FP <strong>{formatTimelineSourceValue(point.fantasyProsDynasty)}</strong></span>
                      <span>DP <strong>{formatTimelineSourceValue(point.dynastyProcess)}</strong></span>
                      <span>DN <strong>{formatTimelineSourceValue(point.dynastyNerds)}</strong></span>
                      <span>Flock <strong>{formatTimelineSourceValue(point.flockFantasy)}</strong></span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <p className="player-value-timeline-note">{timeline.summary.note}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TimelineMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="player-value-timeline-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{note}</em>
    </div>
  );
}

function formatCompleteValue(value: unknown, compactNumbers?: boolean) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') {
    return compactNumbers ? formatValueLens(value) : value.toLocaleString();
  }
  return String(value);
}

function formatSeasonStatValue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  const numeric = Number(value);
  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(numeric) ? 0 : 1,
  });
}

function formatSleeperMarketPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  const numeric = Number(value);
  const rounded = Math.round(numeric * 10) / 10;
  return `${rounded.toFixed(1).replace(/\.0$/, '')}%`;
}

function isPositionRankValue(value: unknown) {
  return typeof value === 'string' && /^(QB|RB|WR|TE|K|DEF|DST)\d+$/i.test(value);
}

function getValueProfileRank(
  valueProfile: PlayerDetails['valueProfile'] | undefined,
  lens: 'dynasty' | 'season' | 'balanced' | 'contender' | 'rebuilder',
  currentRank?: string | null
) {
  if (!valueProfile) return null;
  const rankByLens: Record<'dynasty' | 'season' | 'balanced' | 'contender' | 'rebuilder', string | null | undefined> = {
    dynasty: valueProfile.dynastyPositionRank || valueProfile.balancedPositionRank || currentRank,
    season: valueProfile.seasonPositionRank || valueProfile.fantasyProsPositionRank,
    balanced: valueProfile.balancedPositionRank || valueProfile.dynastyPositionRank || currentRank,
    contender: valueProfile.contenderPositionRank || valueProfile.seasonPositionRank || valueProfile.fantasyProsPositionRank || valueProfile.balancedPositionRank || currentRank,
    rebuilder: valueProfile.rebuilderPositionRank || valueProfile.dynastyPositionRank || valueProfile.balancedPositionRank || currentRank,
  };

  return rankByLens[lens] || null;
}

function getPeerRankForMode(
  peer: NonNullable<PlayerDetails['similarTradeValues']>[number],
  details: PlayerDetails | undefined,
  valueMode: LeagueValueMode
) {
  const profile = details?.valueProfile;
  if (valueMode === 'redraft') {
    return profile?.seasonPositionRank || profile?.fantasyProsPositionRank || peer.rank || details?.position || peer.position;
  }

  return profile?.dynastyPositionRank || profile?.balancedPositionRank || peer.rank || details?.position || peer.position;
}

function getPeerValueForMode(
  peer: NonNullable<PlayerDetails['similarTradeValues']>[number],
  details: PlayerDetails | undefined,
  valueMode: LeagueValueMode
) {
  const profile = details?.valueProfile;
  if (valueMode === 'redraft') {
    return profile?.seasonValue ?? profile?.fantasyProsSeasonValue ?? peer.value;
  }

  return profile?.dynastyValue ?? profile?.balancedValue ?? peer.value;
}

function getValueChangeNote(pick: PlayerModalData) {
  if (pick.ktcValue !== undefined) {
    const draftWindowLabel = getDraftWindowLabel(pick, pick.valueMode);
    if (draftWindowLabel) return `Draft-day value compared against ${draftWindowLabel.toLowerCase()}.`;
    return 'Draft-day value to current value.';
  }

  return 'Change from last week to this week.';
}

function getReadableTeamAccent(teamColors?: { accent: string } | null) {
  if (!teamColors) return undefined;
  const rgb = parseHexColor(teamColors.accent);
  if (!rgb) return teamColors.accent;
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;

  if (luminance < 0.36) return '#67e8f9';
  if (luminance > 0.92) return '#e0f2fe';
  return teamColors.accent;
}

function parseHexColor(hex: string) {
  const normalized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function clampAiReadScore(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTimelineMovement(details?: PlayerDetails, fallbackValueGain?: number | null) {
  const summary = details?.valueTimeline?.summary;
  const delta = summary?.delta ?? fallbackValueGain ?? 0;
  return {
    delta: Math.round(delta || 0),
    deltaPct: summary?.deltaPct ?? null,
    sourceSetChanged: Boolean(summary?.sourceSetChanged),
    eventCount: summary?.eventCount || 0,
  };
}

function getAiReadProfileScore(details?: PlayerDetails, position?: string | null) {
  const draftPick = Number(details?.nflDraftPick || 0);
  const draftRound = Number(details?.nflDraftRound || details?.playerCohort?.draftCapital?.round || 0);
  let score = 46;

  if (Number.isFinite(draftPick) && draftPick > 0) {
    score = draftPick <= 32 ? 94 : draftPick <= 64 ? 82 : draftPick <= 100 ? 68 : draftPick <= 160 ? 52 : 38;
  } else if (Number.isFinite(draftRound) && draftRound > 0) {
    score = draftRound === 1 ? 88 : draftRound === 2 ? 74 : draftRound === 3 ? 60 : draftRound <= 5 ? 44 : 32;
  } else if (details?.playerCohort?.draftCapital?.tier === 'premium') {
    score = 84;
  } else if (details?.playerCohort?.draftCapital?.tier === 'day-two') {
    score = 66;
  }

  const prospect = details?.prospectProfile;
  if (prospect?.overallRank) score += clampAiReadScore(18 - Math.floor(prospect.overallRank / 12), 0, 18);
  if (prospect?.rating) score += clampAiReadScore(Math.round((Number(prospect.rating) - 70) / 4), -4, 10);

  const normalizedPosition = (position || details?.position || '').toUpperCase();
  const forty = details?.athleticProfile?.forty || prospect?.fortyYardDash || null;
  if (forty && ['RB', 'WR'].includes(normalizedPosition)) {
    score += forty <= 4.45 ? 5 : forty >= 4.65 ? -5 : 0;
  }

  return Math.round(clampAiReadScore(score, 1, 99));
}

function getAiReadOpportunityScore(details?: PlayerDetails) {
  const delta = details?.rosterRoom?.opportunityDelta;
  if (!delta) return { score: 50, label: 'Opportunity unclear' };

  let score = 50;
  if (delta.qualitySignal === 'major-opening') score += 28;
  if (delta.qualitySignal === 'minor-opening') score += 16;
  if (delta.qualitySignal === 'squeeze') score -= 16;
  if (delta.qualitySignal === 'major-squeeze') score -= 28;
  if (delta.incumbentOpportunitySignal === 'major-promotion') score += 18;
  if (delta.incumbentOpportunitySignal === 'minor-promotion') score += 10;
  if (delta.incumbentOpportunitySignal === 'blocked') score -= 18;
  score += clampAiReadScore(Math.round((delta.netOpportunityScore || 0) / 3), -16, 16);

  const label = delta.qualitySignal === 'major-opening'
    ? 'Major room opened'
    : delta.qualitySignal === 'minor-opening'
      ? 'Room opened'
      : delta.qualitySignal === 'major-squeeze'
        ? 'Major squeeze'
        : delta.qualitySignal === 'squeeze'
          ? 'Room squeeze'
          : delta.incumbentOpportunitySignal === 'blocked'
            ? 'Blocked runway'
            : 'Stable room';

  return { score: Math.round(clampAiReadScore(score, 1, 99)), label };
}

function getAiReadRunwayScore(details?: PlayerDetails) {
  const cohortDraft = details?.playerCohort?.draftCapital;
  if (cohortDraft?.patienceScore !== null && cohortDraft?.patienceScore !== undefined) {
    return {
      score: Math.round(clampAiReadScore(cohortDraft.patienceScore, 1, 99)),
      label: cohortDraft.opportunityWindow === 'protected-runway'
        ? 'Protected runway'
        : cohortDraft.opportunityWindow === 'short-leash'
          ? 'Short leash'
          : 'Prove-it window',
    };
  }

  const draftRound = Number(details?.nflDraftRound || 0);
  const age = Number(details?.age || 0);
  let score = Number.isFinite(draftRound) && draftRound > 0
    ? draftRound === 1 ? 90 : draftRound === 2 ? 74 : draftRound === 3 ? 58 : draftRound <= 5 ? 42 : 30
    : 46;
  if (Number.isFinite(age) && age > 0) score += age <= 22 ? 8 : age <= 24 ? 3 : age >= 28 ? -12 : 0;
  if (details?.contractProfile?.investmentTier === 'premium') score += 12;
  if (details?.contractProfile?.investmentTier === 'fringe') score -= 10;

  const finalScore = Math.round(clampAiReadScore(score, 1, 99));
  return {
    score: finalScore,
    label: finalScore >= 76 ? 'Protected runway' : finalScore <= 42 ? 'Short leash' : 'Prove-it window',
  };
}

function getAiReadMarketScore(currentValue: number | null | undefined, movementPct: number | null) {
  const valueScore = clampAiReadScore(Math.round(Number(currentValue || 0) / 95), 0, 72);
  const heatScore = movementPct === null ? 0 : clampAiReadScore(Math.round(movementPct * 0.72), -20, 28);
  return Math.round(clampAiReadScore(valueScore + heatScore, 1, 99));
}

function buildSituationValueEvidence({
  playerName,
  position,
  currentValue,
  valueGain,
  details,
}: {
  playerName: string;
  position?: string | null;
  currentValue?: number | null;
  valueGain?: number | null;
  details?: PlayerDetails;
}): {
  label: string;
  readType: string;
  severity: 'good' | 'info' | 'warn';
  confidenceBoost: number;
  chips: AIReadChip[];
  copy: string;
} | null {
  if (!details?.valueTimeline && !details?.rosterRoom && !details?.playerCohort && !details?.prospectProfile) return null;

  const movement = getTimelineMovement(details, valueGain);
  const profileScore = getAiReadProfileScore(details, position);
  const opportunity = getAiReadOpportunityScore(details);
  const runway = getAiReadRunwayScore(details);
  const marketScore = getAiReadMarketScore(currentValue, movement.deltaPct);
  const supportScore = Math.round((profileScore * 0.34) + (opportunity.score * 0.38) + (runway.score * 0.28));
  const gap = Math.round(supportScore - marketScore);
  const movementLabel = movement.delta
    ? `${movement.delta > 0 ? '+' : ''}${formatValueLens(movement.delta)}${movement.deltaPct !== null ? ` / ${movement.deltaPct > 0 ? '+' : ''}${movement.deltaPct}%` : ''}`
    : 'flat market';
  const evidenceParts = [
    `profile ${profileScore}`,
    `opportunity ${opportunity.score}`,
    `runway ${runway.score}`,
    `market ${marketScore}`,
  ].join(', ');

  if (gap >= 22) {
    return {
      label: 'Underpriced context',
      readType: 'Mismatch Signal',
      severity: 'good',
      confidenceBoost: 7,
      chips: [
        { label: 'Mismatch +', tone: 'good' },
        `Gap +${gap}`,
        movement.eventCount ? `${movement.eventCount} markers` : opportunity.label,
      ],
      copy: `Situation/value check: ${playerName} still has support ahead of price (${evidenceParts}). Market movement is ${movementLabel}, but ${opportunity.label.toLowerCase()} and runway context keep the upside case alive.`,
    };
  }

  if (gap <= -22 || (movement.deltaPct !== null && movement.deltaPct >= 24 && supportScore < marketScore + 4)) {
    return {
      label: 'Market heat check',
      readType: 'Price Check',
      severity: 'warn',
      confidenceBoost: 5,
      chips: [
        { label: 'Heat check', tone: 'warn' },
        `Gap ${gap}`,
        movement.sourceSetChanged ? 'Source mix changed' : 'Price ahead',
      ],
      copy: `Situation/value check: the market is pricing more than the support stack has proven (${evidenceParts}). Market movement is ${movementLabel}, so the next read needs role confirmation instead of just accepting the value spike.`,
    };
  }

  if (opportunity.score <= 40) {
    return {
      label: 'Opportunity blocked',
      readType: 'Role Check',
      severity: 'warn',
      confidenceBoost: 4,
      chips: [
        { label: 'Blocked role', tone: 'warn' },
        `Opp ${opportunity.score}`,
        runway.label,
      ],
      copy: `Situation/value check: ${opportunity.label.toLowerCase()} is the limiter. ${playerName}'s profile/runway can still matter, but the current price needs a clearer path to touches before the read gets aggressive.`,
    };
  }

  return {
    label: 'Context hold',
    readType: 'Situation Lens',
    severity: 'info',
    confidenceBoost: 3,
    chips: [
      { label: 'Context hold', tone: 'info' },
      `Gap ${gap > 0 ? '+' : ''}${gap}`,
      movement.sourceSetChanged ? 'Source mix changed' : opportunity.label,
    ],
    copy: `Situation/value check: support and market are close enough to avoid a forced call (${evidenceParts}). Market movement is ${movementLabel}; use the timeline markers to decide whether the move is earned or just price noise.`,
  };
}

function buildPlayerAiRead({
  playerName,
  position,
  currentRank,
  currentValue,
  valueGain,
  details,
  valueProfile,
  valueMode = 'dynasty',
  isCollegeProspect,
  prospectProfile,
  latestNews,
}: {
  playerName: string;
  position?: string | null;
  currentRank?: string | null;
  currentValue?: number | null;
  valueGain?: number | null;
  details?: PlayerDetails;
  valueProfile?: PlayerDetails['valueProfile'];
  valueMode?: LeagueValueMode;
  isCollegeProspect?: boolean;
  prospectProfile?: PlayerDetails['prospectProfile'];
  latestNews?: PlayerDetails['latestNews'];
}) {
  const rankNumber = parseRankNumber(currentRank);
  const age = details?.age;
  const avgMissed = details?.avgGamesMissed;
  const seasonRank = valueProfile?.seasonPositionRank || valueProfile?.fantasyProsPositionRank || null;
  const dynastyRank = valueProfile?.dynastyPositionRank || valueProfile?.balancedPositionRank || currentRank || null;
  const seasonRankNumber = parseRankNumber(seasonRank);
  const dynastyRankNumber = parseRankNumber(dynastyRank);
  const rankSplit = seasonRankNumber && dynastyRankNumber ? seasonRankNumber - dynastyRankNumber : null;
  const chips: AIReadChip[] = [
    currentRank || position || 'No rank',
    currentValue ? `Value ${formatValueLens(currentValue)}` : { label: 'No value', tone: 'warn' },
  ];
  const valueConfidence = getPlayerValueConfidence({ valueProfile, mode: valueMode || 'dynasty' });
  const scheduleSummary = formatScheduleSummary(details?.schedule || null);
  const scheduleStreamerWeeks = formatScheduleWeekList(details?.schedule?.streamerWeeks);
  const scheduleAvoidWeeks = formatScheduleWeekList(details?.schedule?.avoidWeeks);
  const cohort = details?.playerCohort || null;
  const situationDelta = details?.playerSituationDelta || null;
  const draftCapital = cohort?.draftCapital || null;
  const situationValueEvidence = buildSituationValueEvidence({
    playerName,
    position,
    currentValue,
    valueGain,
    details,
  });

  if (isCollegeProspect) {
    const score = prospectProfile?.rating ? `Prospect score ${prospectProfile.rating}` : 'Prospect file';
    const draftCapital = prospectProfile?.projectedRookiePick || prospectProfile?.draftYear || 'No draft slot';
    return {
      title: `${playerName} prospect read`,
      subtitle: 'Prospect traits are context only unless a returned market value exists.',
      readType: 'Player Trend',
      confidence: prospectProfile ? 76 : 48,
      severity: prospectProfile ? 'info' as const : 'warn' as const,
      chips: [score, String(draftCapital), prospectProfile?.college || 'College N/A'],
      body: prospectProfile?.summary
        ? `${prospectProfile.summary} This is a scouting-context read, not a proprietary film grade.`
        : `${playerName} has limited prospect context in this report payload, so the read is intentionally conservative.`,
      backgroundVariant: 'draft' as const,
    };
  }

  if (valueGain !== null && valueGain !== undefined) {
    chips.push(valueGain > 0 ? `Trend +${formatValueLens(valueGain)}` : valueGain < 0 ? `Trend ${formatValueLens(valueGain)}` : 'Stable trend');
  }
  if (age !== null && age !== undefined) chips.push(`${age} yrs`);
  if (latestNews?.title) chips.push('News attached');
  if (scheduleSummary) chips.push(scheduleSummary);
  if (scheduleStreamerWeeks) chips.push(`Stream ${scheduleStreamerWeeks}`);
  if (scheduleAvoidWeeks) chips.push(`Avoid ${scheduleAvoidWeeks}`);
  if (cohort?.outcomeBucket) chips.push(formatCohortOutcomeLabel(cohort.outcomeBucket));
  if (cohort?.calibration) chips.push(formatCohortEvidenceLabel(cohort.calibration.evidenceGrade));
  if (situationDelta) {
    chips.push(formatSituationDeltaLabel(situationDelta.primaryLabel));
    chips.push(`Delta ${situationDelta.score}`);
    chips.push({
      label: situationDelta.action.toUpperCase(),
      tone: situationDelta.action === 'buy' || situationDelta.action === 'stash'
        ? 'good'
        : situationDelta.action === 'sell' || situationDelta.action === 'avoid'
        ? 'warn'
        : 'info',
    });
  }
  if (draftCapital && draftCapital.tier !== 'unknown') {
    chips.push({
      label: draftCapital.label,
      tone: draftCapital.opportunityWindow === 'protected-runway'
        ? 'good'
        : draftCapital.opportunityWindow === 'short-leash'
        ? 'warn'
        : 'info',
    });
  }
  if (draftCapital?.patienceScore !== null && draftCapital?.patienceScore !== undefined) {
    chips.push(`Runway ${draftCapital.patienceScore}%`);
  }
  if (situationValueEvidence) {
    chips.push(...situationValueEvidence.chips);
  }

  const isRedraft = valueMode === 'redraft';
  const veteranAge = position === 'RB' ? 27 : position === 'WR' ? 29 : position === 'TE' ? 30 : position === 'QB' ? 33 : 30;
  const youngAge = position === 'RB' ? 24 : position === 'WR' ? 25 : position === 'TE' ? 26 : position === 'QB' ? 27 : 25;
  let readType = 'Player Trend';
  let severity: 'neutral' | 'good' | 'info' | 'warn' | 'danger' = 'info';
  let body = `${playerName} is best evaluated through roster context, not raw value alone.`;

  if (rankNumber && rankNumber <= (position === 'TE' ? 5 : position === 'QB' ? 8 : 12)) {
    readType = isRedraft ? 'Lineup Leak' : 'Market Signal';
    severity = 'good';
    body = `${playerName} is carrying a strong ${currentRank} profile. Do not move this asset unless the return solves a larger roster construction problem or creates a clear tier-up.`;
  } else if (rankSplit !== null && rankSplit >= 12) {
    readType = 'Rebuild Path';
    severity = 'info';
    body = `${playerName}'s dynasty rank (${dynastyRank}) is ahead of the season profile (${seasonRank}), which reads more like a value-insulation or youth-window asset than a pure lineup scorer.`;
  } else if (rankSplit !== null && rankSplit <= -10) {
    readType = 'Contender Path';
    severity = 'good';
    body = `${playerName}'s season profile (${seasonRank}) is ahead of the dynasty market (${dynastyRank}), making this a cleaner contender target than a rebuild anchor.`;
  } else if (valueGain !== null && valueGain !== undefined && valueGain >= 350 && age !== null && age !== undefined && age >= veteranAge) {
    readType = 'Trade Window';
    severity = 'warn';
    body = `${playerName} has a positive market move while the age curve is getting tighter. That is a sell-window check, not an automatic sell command.`;
  } else if (age !== null && age !== undefined && age <= youngAge && (rankNumber || 999) <= 30) {
    readType = 'Market Signal';
    severity = 'good';
    body = `${playerName} combines youth with usable rank strength. That profile is harder to replace than a single value number suggests.`;
  } else if (avgMissed !== null && avgMissed !== undefined && avgMissed >= 4) {
    readType = 'Lineup Leak';
    severity = 'warn';
    body = `${playerName} carries an availability tax after averaging ${avgMissed} missed games per year. Price that risk into trades and lineup reliance.`;
  } else if (latestNews?.summary || latestNews?.title) {
    readType = 'Player Trend';
    severity = 'info';
    body = `${latestNews.title || 'Latest player news'} is attached to this player. Treat news as context, then verify whether the value or role signal actually changed.`;
  }

  if (cohort) {
    const cohortRead = buildCohortReadCopy(playerName, cohort);
    if (cohortRead) {
      readType = cohortRead.readType || readType;
      severity = cohortRead.severity || severity;
      body = cohortRead.copy;
    } else if (draftCapital?.opportunityWindow === 'protected-runway') {
      body = `${body} ${draftCapital.note}`;
    }
  }

  if (situationDelta) {
    const deltaRead = buildSituationDeltaReadCopy(playerName, situationDelta);
    if (deltaRead) {
      if (deltaRead.severity === 'warn' || deltaRead.severity === 'danger') {
        readType = deltaRead.readType;
        severity = deltaRead.severity;
      } else if (deltaRead.severity === 'good' && severity !== 'warn' && severity !== 'danger') {
        readType = deltaRead.readType;
        severity = deltaRead.severity;
      } else if (body === `${playerName} is best evaluated through roster context, not raw value alone.`) {
        readType = deltaRead.readType;
        severity = deltaRead.severity;
      }

      body = body === `${playerName} is best evaluated through roster context, not raw value alone.`
        ? deltaRead.copy
        : `${body} ${deltaRead.copy}`;
    }
  }

  if (situationValueEvidence) {
    if (situationValueEvidence.severity === 'warn') {
      readType = situationValueEvidence.readType;
      severity = 'warn';
    } else if (situationValueEvidence.severity === 'good' && severity !== 'warn' && severity !== 'danger') {
      readType = situationValueEvidence.readType;
      severity = 'good';
    } else if (body === `${playerName} is best evaluated through roster context, not raw value alone.`) {
      readType = situationValueEvidence.readType;
      severity = situationValueEvidence.severity;
      body = situationValueEvidence.copy;
    }

    if (body !== situationValueEvidence.copy) {
      body = `${body} ${situationValueEvidence.copy}`;
    }
  }

  if (scheduleSummary) {
    if (body === `${playerName} is best evaluated through roster context, not raw value alone.` && !latestNews?.title) {
      readType = 'Schedule Lens';
      severity = details?.schedule?.scheduleTier === 'hard' || details?.schedule?.scheduleTier === 'elite' ? 'warn' : 'info';
      body = `${playerName} has ${scheduleSummary.toLowerCase()} loaded. Use the bye-week and SOS inputs for roster planning and streamer timing.`;
    } else {
      body = `${body} Schedule context: ${scheduleSummary}.`;
    }
  }

  return {
    title: `${playerName} AI read`,
    subtitle: isRedraft ? 'Current-season and lineup-context lens.' : 'Dynasty market, season profile, age curve, and availability lens.',
    readType,
    confidence: Math.min(
      cohort?.confidence ?? 100,
      situationDelta?.confidence ?? 100,
      valueProfile
        ? Math.min(90, valueConfidence.score + 8 + (situationValueEvidence?.confidenceBoost || 0))
        : Math.min(66, valueConfidence.score + 18 + (situationValueEvidence?.confidenceBoost || 0))
    ),
    confidenceNote: [
      valueConfidence.note,
      cohort?.calibration?.note || null,
      situationDelta ? `Situation delta confidence ${situationDelta.confidence}; ${situationDelta.missingSignals.length ? `missing ${situationDelta.missingSignals.slice(0, 2).join(' and ')}` : 'first-pass inputs present'}.` : null,
    ].filter(Boolean).join(' '),
    severity,
    chips,
    body: renderPlayerAiReadBody(body, [...(situationDelta?.trace || []), ...(cohort?.trace || [])]),
    backgroundVariant: severity === 'warn' ? 'market' as const : 'blueprint' as const,
  };
}

function formatCohortOutcomeLabel(bucket: NonNullable<PlayerDetails['playerCohort']>['outcomeBucket']): AIReadChip {
  const labels: Record<typeof bucket, { label: string; tone: 'neutral' | 'good' | 'info' | 'warn' | 'danger' }> = {
    breakout: { label: 'Breakout profile', tone: 'good' },
    sustain: { label: 'Sustain profile', tone: 'info' },
    'fade-risk': { label: 'Fade risk', tone: 'warn' },
    'injury-risk': { label: 'Injury risk', tone: 'warn' },
    'market-over-production': { label: 'Market ahead', tone: 'warn' },
    'market-under-production': { label: 'Production ahead', tone: 'good' },
    'thin-signal': { label: 'Thin signal', tone: 'warn' },
  };
  return labels[bucket] || { label: bucket, tone: 'neutral' };
}

function formatCohortEvidenceLabel(grade: NonNullable<PlayerDetails['playerCohort']>['calibration']['evidenceGrade']): AIReadChip {
  const labels: Record<typeof grade, { label: string; tone: 'neutral' | 'good' | 'info' | 'warn' | 'danger' }> = {
    strong: { label: 'Strong evidence', tone: 'good' },
    usable: { label: 'Usable evidence', tone: 'info' },
    thin: { label: 'Thin evidence', tone: 'warn' },
    blocked: { label: 'Blocked evidence', tone: 'danger' },
  };
  return labels[grade] || { label: grade, tone: 'neutral' };
}

function formatSituationDeltaLabel(label: NonNullable<PlayerDetails['playerSituationDelta']>['primaryLabel']): AIReadChip {
  const labels: Record<typeof label, { label: string; tone: 'neutral' | 'good' | 'info' | 'warn' | 'danger' }> = {
    'role-boost': { label: 'Role boost', tone: 'good' },
    'role-threat': { label: 'Role threat', tone: 'warn' },
    'crowded-room': { label: 'Crowded room', tone: 'warn' },
    'vacated-opportunity': { label: 'Vacated opp', tone: 'good' },
    'scheme-boost': { label: 'Scheme boost', tone: 'good' },
    'scheme-risk': { label: 'Scheme risk', tone: 'warn' },
    'new-team-uncertainty': { label: 'New team', tone: 'info' },
    'fragile-breakout': { label: 'Fragile breakout', tone: 'warn' },
    'veteran-runway': { label: 'Veteran runway', tone: 'info' },
    'opportunity-cliff': { label: 'Opp cliff', tone: 'danger' },
    'draft-capital-patience': { label: 'Draft patience', tone: 'good' },
    'late-capital-urgency': { label: 'Urgency', tone: 'warn' },
    'source-limited-route-read': { label: 'Source-limited', tone: 'warn' },
  };
  return labels[label] || { label, tone: 'neutral' };
}

function buildSituationDeltaReadCopy(
  playerName: string,
  delta: NonNullable<PlayerDetails['playerSituationDelta']>
): { copy: string; readType: string; severity: 'neutral' | 'good' | 'info' | 'warn' | 'danger' } | null {
  const summary = delta.summary || `${playerName}'s role context needs a conservative read.`;

  switch (delta.primaryLabel) {
    case 'role-boost':
    case 'vacated-opportunity':
      return {
        readType: 'Role Boost',
        severity: 'good',
        copy: `${summary} This is the kind of situation change that can make a player more valuable before the market fully catches up.`,
      };
    case 'scheme-boost':
      return {
        readType: 'Scheme Lens',
        severity: 'good',
        copy: `${summary} The scheme context is helping the role, so the read should not stop at last year's raw value.`,
      };
    case 'draft-capital-patience':
      return {
        readType: 'Runway Check',
        severity: 'info',
        copy: `${summary} Draft capital should keep the patience window open unless the role evidence keeps deteriorating.`,
      };
    case 'role-threat':
    case 'crowded-room':
      return {
        readType: 'Role Threat',
        severity: 'warn',
        copy: `${summary} Do not treat the name value as insulated unless the next usage window proves the room did not actually squeeze him.`,
      };
    case 'fragile-breakout':
      return {
        readType: 'Fragile Breakout',
        severity: 'warn',
        copy: `${summary} The market may be paying for a breakout before the underlying role quality has fully earned it.`,
      };
    case 'opportunity-cliff':
      return {
        readType: 'Opportunity Cliff',
        severity: 'danger',
        copy: `${summary} This is a sell-window or avoid-overpay warning unless price already reflects the runway risk.`,
      };
    case 'late-capital-urgency':
      return {
        readType: 'Runway Check',
        severity: 'warn',
        copy: `${summary} Low-capital profiles need faster proof, so stash language should stay conditional on actual usage.`,
      };
    case 'scheme-risk':
      return {
        readType: 'Scheme Risk',
        severity: 'warn',
        copy: `${summary} The offense context is a drag, so confidence should stay capped until volume offsets it.`,
      };
    case 'new-team-uncertainty':
      return {
        readType: 'New Team Lens',
        severity: 'info',
        copy: `${summary} New-team context needs role confirmation before the read gets louder.`,
      };
    case 'veteran-runway':
      return {
        readType: 'Runway Check',
        severity: 'info',
        copy: `${summary} Veteran investment gives some insulation, but usage still needs to match the contract signal.`,
      };
    case 'source-limited-route-read':
      return {
        readType: 'Source-Limited Read',
        severity: 'warn',
        copy: `${summary} Route-level evidence is not exact here, so the read stays cautious and should rely on targets, snaps, room, and value movement.`,
      };
    default:
      return null;
  }
}

function buildCohortReadCopy(
  playerName: string,
  cohort: NonNullable<PlayerDetails['playerCohort']>
): { copy: string; readType?: string; severity?: 'neutral' | 'good' | 'info' | 'warn' | 'danger' } | null {
  const draftNote = cohort.draftCapital?.note;
  const draftPrefix = cohort.draftCapital?.opportunityWindow === 'protected-runway'
    ? 'The draft slot should keep the opportunity door open'
    : cohort.draftCapital?.opportunityWindow === 'short-leash'
    ? 'The draft slot does not buy much patience'
    : cohort.draftCapital?.opportunityWindow === 'prove-it-window'
    ? 'The draft slot buys some patience'
    : null;

  switch (cohort.outcomeBucket) {
    case 'breakout':
      return {
        readType: 'Breakout Signal',
        severity: 'good',
        copy: `${playerName} is pairing an early-career age phase with production that already clears the position baseline. ${draftPrefix ? `${draftPrefix}, so role growth matters more than one short value dip.` : 'Keep the read tied to role growth, not just the current rank.'}`,
      };
    case 'market-under-production':
      return {
        readType: 'Market Signal',
        severity: 'good',
        copy: `${playerName}'s production score is running ahead of the market score. ${draftPrefix ? `${draftPrefix}, which makes this a cleaner patience or buy-window read if the role is stable.` : 'The model wants the market price checked against the actual scoring profile.'}`,
      };
    case 'market-over-production':
      return {
        readType: 'Price Check',
        severity: 'warn',
        copy: `${playerName}'s market score is ahead of the production score. ${draftNote || 'That does not make the player bad, but it means the price is carrying some assumption the stat line has not fully earned.'}`,
      };
    case 'fade-risk':
      return {
        readType: 'Trade Window',
        severity: 'warn',
        copy: `${playerName} is in a later age phase while the market still prices meaningful value. Treat this as a liquidity check before the production curve makes the decision for you.`,
      };
    case 'injury-risk':
      return {
        readType: 'Availability Risk',
        severity: 'warn',
        copy: `${playerName} has enough missed-game history to tax the read. ${draftPrefix ? `${draftPrefix}, but availability still has to be priced into lineup reliance and trade return.` : 'Do not let the name value hide the weekly fragility.'}`,
      };
    case 'thin-signal':
      return {
        readType: 'Thin Signal',
        severity: cohort.draftCapital?.opportunityWindow === 'protected-runway' ? 'info' : 'warn',
        copy: `${playerName} does not have enough value and production evidence for a loud read yet. ${draftNote || 'Keep confidence conservative until role, production, or market inputs improve.'}`,
      };
    case 'sustain':
      return {
        readType: 'Hold Check',
        severity: 'info',
        copy: `${playerName} looks closer to a sustain profile than a forced buy or sell. Use the trace below to check whether age, value, production, and draft runway are all telling the same story.`,
      };
    default:
      return null;
  }
}

function renderPlayerAiReadBody(body: string, trace: string[]) {
  const cleanedTrace = trace
    .filter(Boolean)
    .filter((item) => !/^Outcome bucket:/i.test(item))
    .slice(0, 4);

  if (!cleanedTrace.length) return body;

  return (
    <>
      <p>{body}</p>
      <div className="ai-read-trace">
        <strong className="ai-read-trace-kicker">Why this fired</strong>
        <ul className="ai-read-trace-list">
          {cleanedTrace.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

function buildPlayerDecisionLabels({
  details,
  currentRank,
  valueGain,
  position,
  valueProfile,
  valueMode = 'dynasty',
}: {
  details?: PlayerDetails;
  currentRank?: string | null;
  valueGain?: number | null;
  position?: string | null;
  valueProfile?: PlayerDetails['valueProfile'];
  valueMode?: LeagueValueMode;
}) {
  const labels: Array<{ label: string; copy: string; tone: 'buy' | 'hold' | 'shop' | 'risk' | 'core' }> = [];
  const isRedraftValueMode = valueMode === 'redraft';
  const rankNumber = parseRankNumber(currentRank);
  const seasonRankNumber = parseRankNumber(valueProfile?.seasonPositionRank || valueProfile?.fantasyProsPositionRank);
  const dynastyRankNumber = parseRankNumber(valueProfile?.dynastyPositionRank || valueProfile?.balancedPositionRank || currentRank);
  const rebuilderRankNumber = parseRankNumber(valueProfile?.rebuilderPositionRank || valueProfile?.dynastyPositionRank);
  const age = details?.age;
  const avgMissed = details?.avgGamesMissed;
  const lastRankNumber = parseRankNumber(details?.lastSeasonPositionRank);
  const contenderEdge = seasonRankNumber && dynastyRankNumber ? dynastyRankNumber - seasonRankNumber : null;
  const veteranAge = position === 'RB' ? 27 : position === 'WR' ? 29 : position === 'TE' ? 30 : position === 'QB' ? 33 : 30;
  const youngAge = position === 'RB' ? 24 : position === 'WR' ? 25 : position === 'TE' ? 26 : position === 'QB' ? 27 : 25;
  const eliteCutoff = position === 'TE' ? 5 : position === 'QB' ? 6 : 10;

  if (rankNumber && rankNumber <= eliteCutoff) {
    labels.push({
      label: 'Core Lock',
      copy: `${currentRank} is too strong to move without a real overpay.`,
      tone: 'core',
    });
  }

  if (!isRedraftValueMode && age !== null && age !== undefined && age <= youngAge && (rebuilderRankNumber || rankNumber || 999) <= 24) {
    labels.push({
      label: 'Rebuilder Hold',
      copy: `${age} with a strong position profile fits a longer roster window.`,
      tone: 'hold',
    });
  }

  if (contenderEdge !== null && contenderEdge >= 6) {
    labels.push({
      label: isRedraftValueMode ? 'Lineup Upgrade' : 'Contender Buy',
      copy: isRedraftValueMode
        ? `Season rank is ahead of long-term market by ${contenderEdge} spots.`
        : `Season rank is ahead of dynasty rank by ${contenderEdge} spots.`,
      tone: 'buy',
    });
  }

  if (age !== null && age !== undefined && age >= veteranAge && (seasonRankNumber || rankNumber || 999) <= 30) {
    labels.push({
      label: 'Win-Now Rental',
      copy: `Older, but still useful enough for teams trying to score now.`,
      tone: 'buy',
    });
  }

  if ((valueGain || 0) >= 350 && age !== null && age !== undefined && age >= veteranAge) {
    labels.push({
      label: 'Shop Window',
      copy: `Market is up while the age curve is getting tighter.`,
      tone: 'shop',
    });
  } else if (!isRedraftValueMode && contenderEdge !== null && contenderEdge <= -8) {
    labels.push({
      label: 'Dynasty Premium',
      copy: `Long-term price is stronger than current-season profile.`,
      tone: 'shop',
    });
  }

  if (avgMissed !== null && avgMissed !== undefined && avgMissed >= 4) {
    labels.push({
      label: 'Injury Tax',
      copy: `${avgMissed} missed games per year should be priced into deals.`,
      tone: 'risk',
    });
  }

  if (lastRankNumber && lastRankNumber <= eliteCutoff && !labels.some((label) => label.label === 'Core Lock')) {
    labels.push({
      label: 'Proven Spike',
      copy: `${getPreviousSeasonRankLabel(details)} ${details?.lastSeasonPositionRank} says the ceiling is real.`,
      tone: 'hold',
    });
  }

  return labels.slice(0, 4);
}

function buildPlayerIntelligenceNotes({
  details,
  currentRank,
  currentValue,
  position,
  valueProfile,
  valueMode = 'dynasty',
}: {
  details?: PlayerDetails;
  currentRank?: string | null;
  currentValue?: number | null;
  position?: string | null;
  valueProfile?: PlayerDetails['valueProfile'];
  valueMode?: LeagueValueMode;
}) {
  const notes: Array<{ label: string; value: string; copy?: string; tone?: 'risk' | 'upside' | 'market' | 'neutral'; fullWidth?: boolean }> = [];
  const isRedraftValueMode = valueMode === 'redraft';
  const avgMissed = details?.avgGamesMissed;
  const seasons = details?.availabilitySeasons || 0;
  const lastRank = details?.lastSeasonPositionRank;
  const rankNumber = parseRankNumber(currentRank);
  const lastRankNumber = parseRankNumber(lastRank);
  const age = details?.age;
  const seasonValue = valueProfile?.seasonValue ?? valueProfile?.fantasyProsSeasonValue ?? null;
  const dynastyValue = valueProfile?.dynastyValue ?? currentValue ?? null;
  const dynastyRank = valueProfile?.dynastyPositionRank || valueProfile?.balancedPositionRank || currentRank || null;
  const seasonRank = valueProfile?.seasonPositionRank || valueProfile?.fantasyProsPositionRank || null;
  const dynastyRankNumber = parseRankNumber(dynastyRank);
  const seasonRankNumber = parseRankNumber(seasonRank);
  const newsDate = formatSleeperNewsUpdated(details?.sleeperNewsUpdated);

  if (avgMissed !== null && avgMissed !== undefined && seasons > 0) {
    const tone = avgMissed >= 4 ? 'risk' : avgMissed <= 1 ? 'upside' : 'neutral';
    notes.push({
      label: 'Durability',
      value: `${avgMissed} missed / yr`,
      copy: avgMissed >= 4
        ? `Injury tax is real across the last ${seasons} season${seasons === 1 ? '' : 's'}.`
        : avgMissed <= 1
          ? `Has mostly stayed available in the ${seasons}-year sample.`
          : `Moderate availability profile over ${seasons} season${seasons === 1 ? '' : 's'}.`,
      tone,
    });
  }

  if (lastRank) {
    const eliteCutoff = position === 'TE' ? 6 : position === 'QB' ? 8 : 12;
    notes.push({
      label: getPreviousSeasonRankLabel(details),
      value: lastRank,
      copy: [
        details?.lastSeasonGames ? `${details.lastSeasonGames} games` : null,
        details?.lastSeasonPointsPerGame ? `${details.lastSeasonPointsPerGame} PPG` : null,
      ].filter(Boolean).join(' · ') || undefined,
      tone: lastRankNumber && lastRankNumber <= eliteCutoff ? 'upside' : 'neutral',
    });
  }

  if (age !== null && age !== undefined && currentRank && rankNumber) {
    const veteranAge = position === 'RB' ? 27 : position === 'WR' ? 29 : position === 'TE' ? 30 : 33;
    const youngAge = position === 'RB' ? 24 : position === 'WR' ? 25 : position === 'TE' ? 26 : 27;
    if (age >= veteranAge && rankNumber <= 24) {
      notes.push({
        label: 'Window',
        value: isRedraftValueMode ? 'Weekly Helper' : 'Contender Lean',
        copy: `${age} years old but still holding ${currentRank}; useful if the roster is trying to win now.`,
        tone: 'market',
      });
    } else if (age <= youngAge && rankNumber <= 24) {
      notes.push({
        label: 'Window',
        value: 'Core Asset',
        copy: `${age} years old with a strong ${currentRank} profile; tougher to replace than his raw value suggests.`,
        tone: 'upside',
      });
    }
  }

  const roleLabel = formatDepthChart(details?.depthChartPosition, details?.depthChartOrder);
  if (roleLabel) {
    const isLeadRole = roleLabel.includes('#1') || /^(QB|RB|WR|TE|K|DEF|DST)$/.test(roleLabel);
    const availability = getPlayerAvailability(details);
    const sleeperRoleLabel = formatDepthChart(details?.sleeperDepthChartPosition, details?.sleeperDepthChartOrder);
    const roleValue = details?.depthChartVerified ? `Current ${roleLabel}` : roleLabel;
    const copy = details?.depthChartMismatch && sleeperRoleLabel
      ? `Sleeper's role tag looks stale; the current team chart has him at ${roleLabel}.`
      : `Current team chart has him at ${roleLabel} with ${availability.label.toLowerCase()} availability.`;
    notes.push({
      label: 'Team Role',
      value: roleValue,
      copy,
      tone: availability.tone === 'risk' || availability.tone === 'warning' ? 'risk' : isLeadRole ? 'upside' : 'neutral',
    });
  }

  const scheduleSummary = formatScheduleSummary(details?.schedule || null);
  if (scheduleSummary) {
    const streamerWeeks = formatScheduleWeekList(details?.schedule?.streamerWeeks);
    const avoidWeeks = formatScheduleWeekList(details?.schedule?.avoidWeeks);
    const scheduleSource = details?.schedule?.source || null;
    notes.push({
      label: 'Schedule',
      value: scheduleSummary,
      copy: [
        streamerWeeks ? `Streamer windows: ${streamerWeeks}.` : null,
        avoidWeeks ? `Avoid windows: ${avoidWeeks}.` : null,
        scheduleSource ? `Source: ${scheduleSource}.` : null,
      ].filter(Boolean).join(' ') || 'Use bye weeks and SOS to plan streamer coverage.',
      tone: details?.schedule?.scheduleTier === 'hard' || details?.schedule?.scheduleTier === 'elite' ? 'market' : 'upside',
      fullWidth: true,
    });
  }

  if (!isRedraftValueMode && dynastyRank && seasonRank && dynastyRankNumber && seasonRankNumber) {
    const rankGap = seasonRankNumber - dynastyRankNumber;
    const value = Math.abs(rankGap) >= 8
      ? `${dynastyRank} / ${seasonRank}`
      : 'Similar Ranks';
    notes.push({
      label: 'Rank Split',
      value,
      copy: rankGap >= 25
        ? 'Dynasty rank is well ahead of current-season rank, so this reads more like a stash than a lineup helper.'
        : rankGap <= -10
          ? 'Current-season rank is ahead of dynasty rank, which matters more for contenders than rebuilders.'
          : 'Dynasty and current-season rankings are close enough to support a balanced valuation.',
      tone: rankGap >= 25 ? 'neutral' : rankGap <= -10 ? 'market' : 'upside',
    });
  }

  if (!isRedraftValueMode && seasonValue && dynastyValue) {
    const gap = Math.round(seasonValue - dynastyValue);
    if (gap >= 900) {
      notes.push({
        label: 'Market Angle',
        value: 'Redraft > Dynasty',
        copy: 'Current-season projection is stronger than dynasty market price, so contenders should care more than rebuilders.',
        tone: 'market',
      });
    } else if (gap <= -900) {
      notes.push({
        label: 'Market Angle',
        value: 'Dynasty Premium',
        copy: 'Dynasty value is carrying more of the price than current-season projection.',
        tone: 'neutral',
      });
    }
  }

  if (details?.latestNews?.title) {
    const sourceLabel = details.latestNews.source ? `${details.latestNews.source} News` : 'Latest News';
    notes.push({
      label: sourceLabel,
      value: details.latestNews.title,
      copy: [
        details.latestNews.publishedAt ? formatNewsDate(details.latestNews.publishedAt) : newsDate,
        details.latestNews.summary,
      ].filter(Boolean).join(' · '),
      tone: details?.injuryStatus ? 'risk' : 'neutral',
      fullWidth: true,
    });
  }

  return notes.slice(0, 6);
}

function formatNewsDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatScheduleWeekList(weeks?: number[] | null) {
  const uniqueWeeks = Array.from(new Set((weeks || []).filter((week): week is number => Number.isFinite(week) && week > 0)))
    .sort((a, b) => a - b);
  if (!uniqueWeeks.length) return null;
  if (uniqueWeeks.length <= 3) return uniqueWeeks.map((week) => `W${week}`).join(' · ');
  return `${uniqueWeeks.slice(0, 3).map((week) => `W${week}`).join(' · ')} +${uniqueWeeks.length - 3}`;
}

function formatScheduleTierLabel(tier?: PlayerSchedule['scheduleTier']) {
  if (!tier) return null;
  if (tier === 'easy') return 'Easy schedule';
  if (tier === 'neutral') return 'Neutral schedule';
  if (tier === 'hard') return 'Hard schedule';
  return 'Elite schedule';
}

function formatScheduleSummary(schedule?: PlayerSchedule | null) {
  if (!schedule) return null;
  const parts = [
    schedule.byeWeek ? `Bye W${schedule.byeWeek}` : null,
    schedule.seasonSOS !== null && schedule.seasonSOS !== undefined ? `SOS ${Math.round(schedule.seasonSOS)}%` : null,
    formatScheduleTierLabel(schedule.scheduleTier),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function parseRankNumber(rank?: string | null) {
  if (!rank) return null;
  const match = String(rank).match(/\d+/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function ProspectCollegePill({
  college,
  logoUrl,
}: {
  college?: string | null;
  logoUrl?: string | null;
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [college, logoUrl]);

  if (!college && !logoUrl) return null;
  const label = college || 'College';
  const logoSrc = logoFailed ? null : getCollegeLogoUrl(college, logoUrl);

  return (
    <span className="player-modal-college-pill" title={label} aria-label={label}>
      {logoSrc ? (
        <img src={logoSrc} alt="" loading="lazy" aria-hidden="true" onError={() => setLogoFailed(true)} />
      ) : (
        <span className="player-modal-college-fallback" aria-hidden="true">{getCollegeInitials(college)}</span>
      )}
    </span>
  );
}

function SleeperMarketBadge({
  details,
}: {
  details?: PlayerDetails;
}) {
  const [iconFailed, setIconFailed] = useState(false);
  const rosteredPct = details?.sleeperRosteredPct;
  const startedPct = details?.sleeperStartedPct;
  const researchSeasonLabel = [details?.sleeperResearchSeasonType, details?.sleeperResearchSeason]
    .filter(Boolean)
    .join(' ');

  if (rosteredPct === null && startedPct === null) return null;
  if (rosteredPct === undefined && startedPct === undefined) return null;

  return (
    <div className="player-intelligence-card player-intelligence-card-wide player-intelligence-card-market">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-slate-900/80 shadow-inner shadow-black/20">
          {iconFailed ? (
            <span className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-cyan-200">
              S
            </span>
          ) : (
            <img
              src="https://sleeper.com/favicon.ico"
              alt=""
              aria-hidden="true"
              className="h-5 w-5 rounded-md object-contain"
              onError={() => setIconFailed(true)}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="player-intelligence-label">Sleeper Market</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-black leading-none text-slate-100">
            {rosteredPct !== null && rosteredPct !== undefined ? (
              <span>
                <strong>{formatSleeperMarketPercent(rosteredPct)}</strong> rostered
              </span>
            ) : null}
            {startedPct !== null && startedPct !== undefined ? (
              <span>
                <strong>{formatSleeperMarketPercent(startedPct)}</strong> started
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-cyan-200/70">
            Public research snapshot{researchSeasonLabel ? ` · ${researchSeasonLabel}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  mobileLabel,
  value,
  tone = 'neutral',
  icon,
  teamColors,
  tileAccent,
  valueClassName,
  className = '',
}: {
  label: string;
  mobileLabel?: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
  teamColors?: { primary: string; secondary: string; accent: string } | null;
  tileAccent?: string;
  valueClassName?: string;
  className?: string;
}) {
  const toneClass = tone === 'positive'
    ? 'text-emerald-300'
    : tone === 'negative'
      ? 'text-rose-300'
      : 'text-white';

  return (
    <div
      className={`player-modal-metric-tile rounded-xl border p-2.5 shadow-inner shadow-white/[0.02] sm:p-4 ${className}`.trim()}
      style={{
        borderColor: teamColors ? `${tileAccent || teamColors.accent}33` : undefined,
        background: teamColors
          ? `linear-gradient(135deg, ${teamColors.primary}3d, rgba(2,6,23,0.78) 58%, ${teamColors.secondary}18)`
          : undefined,
      }}
    >
      <div className="text-center text-[0.6rem] font-semibold uppercase tracking-[0.12em] sm:text-xs sm:tracking-[0.14em]" style={{ color: tileAccent || teamColors?.accent || undefined }}>
        {mobileLabel ? (
          <>
            <span className="sm:hidden">{mobileLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : label}
      </div>
      <div className={`mt-1 flex items-center justify-center gap-1 text-center text-lg font-black sm:mt-2 sm:gap-2 sm:text-2xl ${toneClass}`}>
        <span className={valueClassName}>{value}</span>
        {icon}
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  tone = 'neutral',
  teamColors,
  tileAccent,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  tone?: 'positive' | 'negative' | 'neutral';
  teamColors?: { primary: string; secondary: string; accent: string } | null;
  tileAccent?: string;
  valueClassName?: string;
}) {
  const toneClass = tone === 'positive'
    ? 'text-emerald-300'
    : tone === 'negative'
      ? 'text-rose-300'
      : 'text-slate-100';

  return (
    <div
      className="rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3"
      style={{
        borderColor: teamColors ? `${tileAccent || teamColors.accent}24` : undefined,
        background: teamColors
          ? `linear-gradient(135deg, ${teamColors.secondary}18, rgba(2,6,23,0.72) 68%, ${teamColors.primary}24)`
          : undefined,
      }}
    >
      <div className="text-center text-[0.6rem] font-semibold uppercase tracking-[0.1em] sm:text-xs sm:tracking-[0.12em]" style={{ color: tileAccent || teamColors?.accent || undefined }}>{label}</div>
      <div className={`mt-1 flex min-h-[1.65rem] items-center justify-center text-center text-sm font-bold sm:text-base ${toneClass}`}>
        <span className={`${typeof value === 'string' || typeof value === 'number' ? 'min-w-0 truncate' : 'inline-flex items-center justify-center'} ${valueClassName || ''}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function CompleteDataSection({
  title,
  rows,
  teamColors,
  tileAccent,
  compactNumbers = false,
  rankValues = false,
  inlineRows = false,
  wide = false,
  priority = false,
}: {
  title: string;
  rows: unknown[][];
  teamColors?: { primary: string; secondary: string; accent: string } | null;
  tileAccent?: string;
  compactNumbers?: boolean;
  rankValues?: boolean;
  inlineRows?: boolean;
  wide?: boolean;
  priority?: boolean;
}) {
  if (!rows.length) return null;

  return (
    <div
      className={`player-complete-section ${wide ? 'player-complete-section-wide' : ''} ${priority ? 'player-complete-section-priority' : ''}`}
      style={{
        borderColor: teamColors ? `${tileAccent || teamColors.accent}22` : undefined,
        background: teamColors
          ? `linear-gradient(135deg, ${teamColors.secondary}18, rgba(2,6,23,0.7) 70%, ${teamColors.primary}20)`
          : undefined,
      }}
    >
      <h4>{title}</h4>
      <div className={`player-complete-rows ${inlineRows ? 'player-complete-rows-inline' : ''}`}>
        {rows.map(([rawLabel, rawValue]) => {
          const label = String(rawLabel);
          const displayValue = formatCompleteValue(rawValue, compactNumbers);
          const isUrl = /^https?:\/\//i.test(displayValue);
          return (
            <div key={`${title}-${label}`} className="player-complete-row">
              <span>{label}</span>
              {isUrl ? (
                <a href={displayValue} target="_blank" rel="noreferrer">
                  Open Link
                </a>
              ) : rankValues && isPositionRankValue(displayValue) ? (
                <strong className={getPositionRankPillClass(displayValue)}>{displayValue}</strong>
              ) : (
                <strong>{displayValue}</strong>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InlineInfoTile({
  label,
  value,
  teamColors,
  tileAccent,
  valueClassName,
}: {
  label: string;
  value: string | number;
  teamColors?: { primary: string; secondary: string; accent: string } | null;
  tileAccent?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-center sm:gap-2 sm:px-4 sm:py-3"
      style={{
        borderColor: teamColors ? `${tileAccent || teamColors.accent}24` : undefined,
        background: teamColors
          ? `linear-gradient(135deg, ${teamColors.secondary}18, rgba(2,6,23,0.72) 68%, ${teamColors.primary}24)`
          : undefined,
      }}
    >
      <span className="text-sm font-black tracking-normal sm:text-base" style={{ color: tileAccent || teamColors?.accent || undefined }}>
        {label}:
      </span>
      <span className={`min-w-0 break-words text-sm font-black leading-tight text-slate-100 sm:text-base ${valueClassName || ''}`}>{value}</span>
    </div>
  );
}
