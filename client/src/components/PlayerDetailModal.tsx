import { useState, useEffect, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DraftPick, LeagueValueMode, PlayerDetails } from '@shared/types';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { getPositionRankPillClass } from '@/lib/positionRank';
import { getPlayerAvailability } from '@/lib/playerStatus';
import { getCollegeInitials, getCollegeLogoUrl, getCollegeTileStyle } from '@/lib/teamTileStyle';
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';
import { TeamLogoPill } from './TeamLogoPill';

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

function getProspectSourceLabel(source?: string | null): string | null {
  if (!source) return null;
  return source === 'NFL Draft Buzz' ? 'Prospect Archive' : source;
}

interface PlayerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pick: PlayerModalData | null;
  leagueId?: string;
  leagueLogo?: string | null;
  managerAvatars?: Record<string, string | null>;
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

export function PlayerDetailModal({
  isOpen,
  onClose,
  pick,
  leagueId,
  leagueLogo,
  managerAvatars,
}: PlayerDetailModalProps) {
  const [headshot, setHeadshot] = useState<string | null>(null);
  const [directImageFailed, setDirectImageFailed] = useState(false);
  const queryDetails = pick?.playerDetails;
  const queryIsCollegeProspect = isCollegeOnlyModalPick(pick, queryDetails);
  const { data: headshotData } = trpc.images.playerHeadshot.useQuery(
    { playerId: pick?.player_id || '' },
    { enabled: !!pick?.player_id && isOpen && directImageFailed }
  );
  const { data: playerNewsData } = trpc.players.latestNews.useQuery(
    {
      playerId: pick?.player_id || '',
      playerName: pick?.playerName || '',
      team: pick?.playerDetails?.team || null,
      position: pick?.playerPos || pick?.playerDetails?.position || null,
    },
    {
      enabled: isOpen && Boolean(pick?.playerName) && !queryIsCollegeProspect,
      staleTime: 1000 * 60 * 15,
    }
  );

  useEffect(() => {
    setHeadshot(null);
    setDirectImageFailed(false);
  }, [pick?.player_id]);

  useEffect(() => {
    if (headshotData?.success && headshotData?.data) {
      setHeadshot(`data:${headshotData.contentType};base64,${headshotData.data}`);
    }
  }, [headshotData]);

  if (!pick) return null;
  const details = pick.playerDetails;
  const prospectProfile = details?.prospectProfile || null;
  const isCollegeProspect = isCollegeOnlyModalPick(pick, details);
  const prospectCollege = prospectProfile?.college || details?.college || null;
  const directHeadshot = !isCollegeProspect && pick.player_id && !directImageFailed
    ? `https://sleepercdn.com/content/nfl/players/${pick.player_id}.jpg`
    : null;
  const playerImageSrc = isCollegeProspect
    ? pick.playerImageUrl || prospectProfile?.playerImageUrl || prospectProfile?.collegeLogoUrl || null
    : headshot || directHeadshot;
  const valueProfile = details?.valueProfile;
  const valueMode = pick.valueMode || 'dynasty';
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
    ? `radial-gradient(circle at 15% 6%, color-mix(in srgb, var(--team-primary, #7c2d12) 48%, transparent), transparent 28%), radial-gradient(circle at 95% 0%, color-mix(in srgb, var(--team-secondary, #0f172a) 58%, transparent), transparent 34%), linear-gradient(180deg, #070b13 0%, #101827 44%, rgba(15, 23, 42, 0.36) 100%)`
    : teamColors
    ? `radial-gradient(circle at 15% 6%, ${teamColors.primary}44, transparent 28%), radial-gradient(circle at 95% 0%, ${teamColors.secondary}66, transparent 34%), linear-gradient(180deg, #070b13 0%, #101827 44%, ${teamColors.primary}18 100%)`
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
  const collegeInfoLogo = details?.college ? (
    <ProspectCollegePill
      college={details.college}
      logoUrl={details.prospectProfile?.collegeLogoUrl || pick.collegeLogoUrl}
    />
  ) : null;
  const physicalRows = [
    ['Age', details?.age],
    ['Height', formatHeight(details?.height)],
    ['Weight', details?.weight],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const experienceRows = [
    ['Rookie Year', details?.rookieYear],
    ['Depth Chart', formatDepthChart(details?.depthChartPosition, details?.depthChartOrder)],
    ['Years Exp', details?.yearsExp],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const backgroundRows = isCollegeProspect ? [] : [
    ['College', collegeInfoLogo],
    ['Birthday', formatBirthday(details?.birthDate)],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const prospectMetricRows = prospectProfile ? [
    ['Projected Rookie Pick', prospectProfile.projectedRookiePick],
    ['Board Rank', prospectProfile.fantasyProsDevyRank ? `#${prospectProfile.fantasyProsDevyRank}` : prospectProfile.overallRank ? `#${prospectProfile.overallRank}` : null],
    ['Position Rank', prospectProfile.fantasyProsDevyPositionRank || (prospectProfile.positionRank ? `${prospectProfile.position}${prospectProfile.positionRank}` : null)],
    ['Draft Class', prospectProfile.draftYear],
    ['College', prospectProfile.college ? (
      <ProspectCollegePill
        college={prospectProfile.college}
        logoUrl={pick.collegeLogoUrl || prospectProfile.collegeLogoUrl}
      />
    ) : null],
    ['Class', prospectProfile.classYear],
    ['40 Time', prospectProfile.fortyYardDash ? `${prospectProfile.fortyYardDash}s` : null],
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
    ['College', details.prospectProfile.college],
    ['Overall Rank', details.prospectProfile.overallRank ? `#${details.prospectProfile.overallRank}` : null],
    ['Position Rank', details.prospectProfile.positionRank ? `${details.prospectProfile.position}${details.prospectProfile.positionRank}` : null],
    ['Rating', details.prospectProfile.rating],
    ['Avg Scout Rank', details.prospectProfile.averageOverallRank ? `#${details.prospectProfile.averageOverallRank}` : null],
    ['40 Time', details.prospectProfile.fortyYardDash ? `${details.prospectProfile.fortyYardDash}s` : null],
    ['Size', [details.prospectProfile.height, details.prospectProfile.weight].filter(Boolean).join(' / ')],
    ['Summary', details.prospectProfile.summary],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  const lastSeasonRows = [
    ['Last Year Rank', details?.lastSeasonPositionRank ? `${details.lastSeasonYear || 'Last'} ${details.lastSeasonPositionRank}` : null],
    ['Games Played', details?.lastSeasonGames],
    ['PPG', details?.lastSeasonPointsPerGame],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const availabilityRows = [
    ['Avg Missed', details?.avgGamesMissed !== null && details?.avgGamesMissed !== undefined && details?.availabilitySeasons ? `${details.avgGamesMissed} / yr` : null],
    ['Sample', details?.availabilitySeasons ? `${details.availabilitySeasons} yr${details.availabilitySeasons === 1 ? '' : 's'}` : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const healthRows = [
    ['Availability', availability.label],
    ['Injury Status', details?.injuryStatus && details.injuryStatus !== availability.label ? details.injuryStatus : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const dynastyRank = getValueProfileRank(valueProfile, 'dynasty', currentRank);
  const seasonRank = getValueProfileRank(valueProfile, 'season', currentRank);
  const balancedRank = getValueProfileRank(valueProfile, 'balanced', currentRank);
  const contenderRank = getValueProfileRank(valueProfile, 'contender', currentRank);
  const rebuilderRank = getValueProfileRank(valueProfile, 'rebuilder', currentRank);
  const topDynastyRank = dynastyRank || (valueMode !== 'redraft' ? currentRank : null);
  const topSeasonRank = seasonRank || (valueMode === 'redraft' ? currentRank : null);
  const dynastyValue = valueProfile?.dynastyValue
    ?? valueProfile?.balancedValue
    ?? (valueMode !== 'redraft' ? currentValue : null);
  const seasonValue = valueProfile?.seasonValue
    ?? valueProfile?.fantasyProsSeasonValue
    ?? (valueMode === 'redraft' ? currentValue : null);
  const marketRankRows = valueProfile ? [
    ['Dynasty', dynastyRank],
    ['Season', seasonRank],
    ['Balanced', balancedRank],
    ['Contender', contenderRank],
    ['Rebuilder', rebuilderRank],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  const sourceValueRows = valueProfile ? [
    ['Flock Fantasy', valueProfile.flockFantasy],
    ['Market Consensus', valueProfile.marketKtc],
    ['FantasyCalc Dynasty', valueProfile.fantasyCalcDynasty],
    ['FantasyCalc Redraft', valueProfile.fantasyCalcRedraft],
    ['DynastyProcess', valueProfile.dynastyProcess],
    ['Dynasty Nerds', valueProfile.dynastyNerds],
    ['Dynasty Dealer Benchmark', valueProfile.dynastyDealerBenchmark],
    ['FantasyPros Season', valueProfile.fantasyProsSeasonValue],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  const latestNews = playerNewsData?.latestNews ?? details?.latestNews ?? null;
  const hasMeaningfulNews = Boolean(latestNews?.title || latestNews?.summary);
  const latestNewsRows = hasMeaningfulNews && latestNews ? [
    ['Title', latestNews.title],
    ['Date', latestNews.publishedAt ? formatNewsDate(latestNews.publishedAt) : null],
    ['Source', latestNews.source],
    ['Summary', latestNews.summary],
    ['URL', latestNews.url],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  const intelligenceNotes = buildPlayerIntelligenceNotes({
    details,
    currentRank,
    currentValue,
    position,
    valueProfile,
  });
  const decisionLabels = buildPlayerDecisionLabels({
    details,
    currentRank,
    valueGain,
    position,
    valueProfile,
  });
  const draftAuditRows = [
    pick.draftDecisionVerdict ? ['Draft Read', pick.draftDecisionVerdict] : null,
    pick.draftDecisionBoardRankLabel ? ['Board Read', pick.draftDecisionBoardRankLabel] : null,
    pick.draftDecisionPrimaryNeed ? ['Roster Need', pick.draftDecisionPrimaryNeed] : null,
  ].filter((row): row is [string, string] => Boolean(row));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className={`player-detail-modal ${isCollegeProspect ? 'player-detail-modal-prospect' : ''} max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden border-slate-700/70 bg-[#121827] p-0 text-slate-100 shadow-2xl shadow-black/60 sm:max-h-[88vh] sm:max-w-2xl`}
        style={{ ...collegeTileStyle, background: modalBackground }}
      >
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

            <DialogHeader className="relative px-12 sm:pr-10">
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
              <div className="flex w-full max-w-xl flex-col items-center gap-3 sm:grid sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-7">
                <div className="relative h-22 w-22 overflow-hidden rounded-2xl border border-cyan-300/35 bg-slate-950 shadow-xl shadow-black/40 sm:h-28 sm:w-28">
                  {playerImageSrc ? (
                    <img
                      src={playerImageSrc}
                      alt={pick.playerName}
                      className="h-full w-full object-cover"
                      onError={() => {
                        if (directHeadshot && !directImageFailed) {
                          setDirectImageFailed(true);
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
                <div className="min-w-0 space-y-3 text-center sm:text-left">
                  <div className={`athletic-headline break-words font-black leading-none tracking-normal text-orange-400 ${playerNameSizeClass}`}>
                    {pick.playerName}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
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
                    <StatusPill label={availability.label} tone={availability.tone} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-slate-950/35 p-4 backdrop-blur-sm sm:space-y-5 sm:p-6">
            {(pick.round !== undefined || pick.pick !== undefined || draftValue !== undefined || pick.positionRankMay2025) && (
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
              <div className="mx-auto grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <MetricTile
                  label="Dynasty Value"
                  mobileLabel="Dynasty"
                  value={dynastyValue ? dynastyValue.toLocaleString() : '-'}
                  teamColors={teamColors}
                  tileAccent={tileAccent}
                />
                <MetricTile label="Dynasty Rank" mobileLabel="Dynasty" value={topDynastyRank || '-'} valueClassName={`${getPositionRankPillClass(topDynastyRank)} player-modal-rank-value`} teamColors={teamColors} tileAccent={tileAccent} />
                <MetricTile
                  label="Season Value"
                  mobileLabel="Season"
                  value={seasonValue ? seasonValue.toLocaleString() : '-'}
                  teamColors={teamColors}
                  tileAccent={tileAccent}
                />
                <MetricTile label="Season Rank" mobileLabel="Season" value={topSeasonRank || '-'} valueClassName={`${getPositionRankPillClass(topSeasonRank)} player-modal-rank-value`} teamColors={teamColors} tileAccent={tileAccent} />
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
              <div className="mx-auto max-w-xl space-y-2">
                <p className="text-center text-[0.68rem] font-black uppercase tracking-[0.2em] text-cyan-300/80">
                  Cross-Position Trade Comps
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {details.similarTradeValues.map((peer) => (
                    <div key={peer.playerId} className="rounded-xl border border-cyan-300/15 bg-slate-950/45 p-2 text-center">
                      <div className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-300/80">{peer.label || peer.position}</div>
                      <div className="mt-1 truncate text-sm font-black text-slate-100">{peer.name}</div>
                      <div className="mt-1 flex items-center justify-center gap-1 text-[0.68rem] font-black">
                        <span className={getPositionRankPillClass(peer.rank || peer.position)}>{peer.rank || peer.position}</span>
                        <span className={peer.difference > 0 ? 'text-emerald-300' : peer.difference < 0 ? 'text-rose-300' : 'text-slate-300'}>
                          {peer.difference > 0 ? '+' : ''}{peer.difference.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(pick.draftDecisionSummary || pick.draftDecisionAltPlayerName) && (
              <div className="mx-auto max-w-xl rounded-2xl border border-cyan-300/18 bg-slate-950/45 p-3 shadow-inner shadow-white/[0.02] sm:p-4">
                <p className="text-center text-[0.68rem] font-black uppercase tracking-[0.2em] text-cyan-300/85">
                  Draft Decision Audit
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

            {!isCollegeProspect && intelligenceNotes.length > 0 && (
              <div className="player-intelligence-panel mx-auto max-w-xl">
                <p className="player-intelligence-title">
                  Player Intelligence
                </p>
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
              </div>
            )}

            {!isCollegeProspect && valueProfile && (
              <div className="mx-auto max-w-xl space-y-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  <InfoTile label="Dynasty" value={dynastyRank || '-'} valueClassName={getPositionRankPillClass(dynastyRank)} teamColors={teamColors} tileAccent={tileAccent} />
                  <InfoTile label="Season" value={seasonRank || '-'} valueClassName={getPositionRankPillClass(seasonRank)} teamColors={teamColors} tileAccent={tileAccent} />
                  <InfoTile label="Contender" value={contenderRank || '-'} valueClassName={getPositionRankPillClass(contenderRank)} teamColors={teamColors} tileAccent={tileAccent} />
                  <InfoTile label="Rebuilder" value={rebuilderRank || '-'} valueClassName={getPositionRankPillClass(rebuilderRank)} teamColors={teamColors} tileAccent={tileAccent} />
                </div>
                {valueProfile.sources && valueProfile.sources.length > 0 && (
                  <p className="text-center text-[0.68rem] font-bold leading-relaxed uppercase tracking-[0.16em] text-cyan-200/70">
                    Our rank score weighs dynasty market, current-season outlook, expert baselines, and team-window fit.
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
              {backgroundRows.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {backgroundRows.map(([label, value]) => (
                    <InfoTile key={String(label)} label={String(label)} value={value as ReactNode} teamColors={teamColors} tileAccent={tileAccent} />
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
              {!isCollegeProspect && healthRows.map(([label, value]) => (
                <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
              ))}
            </div>

            {(marketRankRows.length > 0
              || sourceValueRows.length > 0
              || prospectRows.length > 0
              || latestNewsRows.length > 0
              || Boolean(details?.availabilityHistory?.length)) && (
              <div className="player-complete-data mx-auto max-w-xl">
                <p className="player-complete-title">Source Detail</p>
                <div className="player-complete-grid">
                  <CompleteDataSection title="Market Ranks" rows={marketRankRows} teamColors={teamColors} tileAccent={tileAccent} rankValues priority inlineRows />
                  <CompleteDataSection title="Source Inputs" rows={sourceValueRows} teamColors={teamColors} tileAccent={tileAccent} />
                  <CompleteDataSection title="Prospect File" rows={prospectRows} teamColors={teamColors} tileAccent={tileAccent} wide />
                  <CompleteDataSection title="Latest News" rows={latestNewsRows} teamColors={teamColors} tileAccent={tileAccent} wide />
                  {details?.availabilityHistory?.length ? (
                    <div className="player-complete-section player-complete-section-wide">
                      <h4>Availability History</h4>
                      <div className="player-availability-grid">
                        {details.availabilityHistory.map((item) => (
                          <div key={item.season} className="player-availability-card">
                            <span>{item.season}</span>
                            <strong>{item.games ?? '-'} GP</strong>
                            <em>{item.gamesMissed ?? '-'} missed</em>
                            {item.pointsPerGame !== null && item.pointsPerGame !== undefined && (
                              <small>{item.pointsPerGame} PPG</small>
                            )}
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

function formatValueLens(value: number | null | undefined) {
  if (!value) return '-';
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}K`;
  return value.toLocaleString();
}

function formatCompleteValue(value: unknown, compactNumbers?: boolean) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') {
    return compactNumbers ? formatValueLens(value) : value.toLocaleString();
  }
  return String(value);
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

function getValueChangeNote(pick: PlayerModalData) {
  if (pick.ktcValue !== undefined) {
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

function buildPlayerDecisionLabels({
  details,
  currentRank,
  valueGain,
  position,
  valueProfile,
}: {
  details?: PlayerDetails;
  currentRank?: string | null;
  valueGain?: number | null;
  position?: string | null;
  valueProfile?: PlayerDetails['valueProfile'];
}) {
  const labels: Array<{ label: string; copy: string; tone: 'buy' | 'hold' | 'shop' | 'risk' | 'core' }> = [];
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

  if (age !== null && age !== undefined && age <= youngAge && (rebuilderRankNumber || rankNumber || 999) <= 24) {
    labels.push({
      label: 'Rebuilder Hold',
      copy: `${age} with a strong position profile fits a longer roster window.`,
      tone: 'hold',
    });
  }

  if (contenderEdge !== null && contenderEdge >= 6) {
    labels.push({
      label: 'Contender Buy',
      copy: `Season rank is ahead of dynasty rank by ${contenderEdge} spots.`,
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
  } else if (contenderEdge !== null && contenderEdge <= -8) {
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
      copy: `${details?.lastSeasonYear || 'Last year'} ${details?.lastSeasonPositionRank} says the ceiling is real.`,
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
}: {
  details?: PlayerDetails;
  currentRank?: string | null;
  currentValue?: number | null;
  position?: string | null;
  valueProfile?: PlayerDetails['valueProfile'];
}) {
  const notes: Array<{ label: string; value: string; copy?: string; tone?: 'risk' | 'upside' | 'market' | 'neutral'; fullWidth?: boolean }> = [];
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
      label: 'Last Season',
      value: `${details?.lastSeasonYear || 'Last'} ${lastRank}`,
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
        value: 'Contender Lean',
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
    notes.push({
      label: 'Team Role',
      value: roleLabel,
      copy: `${details?.team || 'Team'} depth chart signal with ${availability.label.toLowerCase()} availability.`,
      tone: availability.tone === 'risk' || availability.tone === 'warning' ? 'risk' : isLeadRole ? 'upside' : 'neutral',
    });
  }

  if (dynastyRank && seasonRank && dynastyRankNumber && seasonRankNumber) {
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

  if (seasonValue && dynastyValue) {
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

function parseRankNumber(rank?: string | null) {
  if (!rank) return null;
  const match = String(rank).match(/\d+/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'active' | 'warning' | 'risk' | 'taxi';
}) {
  const toneClass = tone === 'risk'
    ? 'border-rose-300/35 bg-rose-500/15 text-rose-100'
    : tone === 'warning'
      ? 'border-amber-300/35 bg-amber-400/15 text-amber-100'
      : tone === 'taxi'
        ? 'border-cyan-300/35 bg-cyan-400/12 text-cyan-100'
        : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-200';

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${toneClass}`}>
      {label}
    </span>
  );
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

function MetricTile({
  label,
  mobileLabel,
  value,
  tone = 'neutral',
  icon,
  teamColors,
  tileAccent,
  valueClassName,
}: {
  label: string;
  mobileLabel?: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
  teamColors?: { primary: string; secondary: string; accent: string } | null;
  tileAccent?: string;
  valueClassName?: string;
}) {
  const toneClass = tone === 'positive'
    ? 'text-emerald-300'
    : tone === 'negative'
      ? 'text-rose-300'
      : 'text-white';

  return (
    <div
      className="rounded-xl border p-2.5 shadow-inner shadow-white/[0.02] sm:p-4"
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
      className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 sm:gap-2 sm:px-4 sm:py-3"
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
      <span className={`text-sm font-black text-slate-100 sm:text-base ${valueClassName || ''}`}>{value}</span>
    </div>
  );
}
