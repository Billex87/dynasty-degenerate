import { useState, useEffect, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DraftPick, PlayerDetails } from '@shared/types';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { getPositionRankPillClass } from '@/lib/positionRank';
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
};

export function PlayerDetailModal({
  isOpen,
  onClose,
  pick,
  leagueId,
  leagueLogo,
  managerAvatars,
}: PlayerDetailModalProps) {
  const [headshot, setHeadshot] = useState<string | null>(null);
  const { data: headshotData } = trpc.images.playerHeadshot.useQuery(
    { playerId: pick?.player_id || '' },
    { enabled: !!pick?.player_id && isOpen }
  );

  useEffect(() => {
    setHeadshot(null);
  }, [pick?.player_id]);

  useEffect(() => {
    if (headshotData?.success && headshotData?.data) {
      setHeadshot(`data:${headshotData.contentType};base64,${headshotData.data}`);
    }
  }, [headshotData]);

  if (!pick) return null;
  const details = pick.playerDetails;
  const valueProfile = details?.valueProfile;
  const valueChangeNote = pick.valueChangeNote || getValueChangeNote(pick);
  const currentValue = pick.currentKtcValue;
  const draftValue = pick.ktcValue;
  const valueGain = pick.valueGain;
  const currentRank = pick.currentPositionRank || '-';
  const position = pick.playerPos || details?.position || '-';
  const team = details?.team || 'FA';
  const jerseyNumber = details?.jerseyNumber;
  const teamColors = NFL_TEAM_COLORS[team] || null;
  const tileAccent = getReadableTeamAccent(teamColors);
  const modalBackground = teamColors
    ? `radial-gradient(circle at 15% 6%, ${teamColors.primary}44, transparent 28%), radial-gradient(circle at 95% 0%, ${teamColors.secondary}66, transparent 34%), linear-gradient(180deg, #070b13 0%, #101827 44%, ${teamColors.primary}18 100%)`
    : undefined;
  const heroBackground = teamColors
    ? `radial-gradient(circle at 18% 18%, ${teamColors.primary}88, transparent 34%), radial-gradient(circle at 88% 8%, ${teamColors.secondary}99, transparent 30%), linear-gradient(135deg, ${teamColors.primary} 0%, #070b13 48%, ${teamColors.secondary} 100%)`
    : undefined;
  const managerAvatarUrl = pick.managerAvatarUrl || (pick.manager ? managerAvatars?.[pick.manager] : null);
  const playerNameSizeClass = getPlayerNameSizeClass(pick.playerName);
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
  const backgroundRows = [
    ['College', details?.college],
    ['Birthday', formatBirthday(details?.birthDate)],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const lastSeasonRows = [
    ['Last Year Rank', details?.lastSeasonPositionRank ? `${details.lastSeasonYear || 'Last'} ${details.lastSeasonPositionRank}` : null],
    ['Games Played', details?.lastSeasonGames],
    ['PPG', details?.lastSeasonPointsPerGame],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const availabilityRows = [
    ['Avg Missed', details?.avgGamesMissed !== null && details?.avgGamesMissed !== undefined && details?.availabilitySeasons ? `${details.avgGamesMissed} / yr` : null],
    ['Sample', details?.availabilitySeasons ? `${details.availabilitySeasons} yr${details.availabilitySeasons === 1 ? '' : 's'}` : null],
    ['News Update', formatSleeperNewsUpdated(details?.sleeperNewsUpdated)],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const healthRows = [
    ['Injury Status', details?.injuryStatus],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const nflDraftRows = [
    ['NFL Draft Round', details?.nflDraftRound],
    ['NFL Draft Pick', details?.nflDraftPick],
    ['NFL Draft Team', details?.nflDraftTeam],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const dynastyRank = getValueProfileRank(valueProfile, 'dynasty', currentRank);
  const seasonRank = getValueProfileRank(valueProfile, 'season', currentRank);
  const balancedRank = getValueProfileRank(valueProfile, 'balanced', currentRank);
  const contenderRank = getValueProfileRank(valueProfile, 'contender', currentRank);
  const rebuilderRank = getValueProfileRank(valueProfile, 'rebuilder', currentRank);
  const marketRankRows = valueProfile ? [
    ['Dynasty', dynastyRank],
    ['Season', seasonRank],
    ['Balanced', balancedRank],
    ['Contender', contenderRank],
    ['Rebuilder', rebuilderRank],
    ['FantasyPros Pos', valueProfile.fantasyProsPositionRank],
    ['FantasyPros Overall', valueProfile.fantasyProsRank ? `#${valueProfile.fantasyProsRank}` : null],
    ['FantasyPros Tier', valueProfile.fantasyProsTier ? `Tier ${valueProfile.fantasyProsTier}` : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  const sourceValueRows = valueProfile ? [
    ['Dynasty Blend', valueProfile.dynastyValue],
    ['Season Blend', valueProfile.seasonValue],
    ['Balanced Blend', valueProfile.balancedValue],
    ['Contender Blend', valueProfile.contenderValue],
    ['Rebuilder Blend', valueProfile.rebuilderValue],
    ['KeepTradeCut', valueProfile.marketKtc],
    ['FantasyCalc Dynasty', valueProfile.fantasyCalcDynasty],
    ['FantasyCalc Redraft', valueProfile.fantasyCalcRedraft],
    ['DynastyProcess', valueProfile.dynastyProcess],
    ['FantasyPros Season', valueProfile.fantasyProsSeasonValue],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : [];
  const latestNewsRows = details?.latestNews ? [
    ['Title', details.latestNews.title],
    ['Date', details.latestNews.publishedAt ? formatNewsDate(details.latestNews.publishedAt) : null],
    ['Source', details.latestNews.source],
    ['Summary', details.latestNews.summary],
    ['URL', details.latestNews.url],
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="player-detail-modal max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden border-slate-700/70 bg-[#121827] p-0 text-slate-100 shadow-2xl shadow-black/60 sm:max-h-[88vh] sm:max-w-2xl"
        style={{ background: modalBackground }}
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
            </DialogHeader>

            <div className="relative mt-4 flex justify-center sm:mt-7">
              <div className="flex w-full max-w-xl flex-col items-center gap-3 sm:grid sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-7">
                <div className="relative h-22 w-22 overflow-hidden rounded-2xl border border-cyan-300/35 bg-slate-950 shadow-xl shadow-black/40 sm:h-28 sm:w-28">
                  {headshot ? (
                    <img
                      src={headshot}
                      alt={pick.playerName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
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
                    {jerseyNumber !== null && jerseyNumber !== undefined && jerseyNumber !== '' && (
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
                    <span
                      className="rounded-full border px-3 py-1 text-xs font-bold"
                      style={{
                        borderColor: teamColors ? `${teamColors.accent}66` : undefined,
                        backgroundColor: teamColors ? `${teamColors.accent}20` : undefined,
                        color: teamColors?.accent || undefined,
                      }}
                    >
                      {position}
                    </span>
                    <TeamLogoPill team={team} className="player-modal-team-logo-pill" />
                    {details?.status && (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                        {details.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-slate-950/35 p-4 backdrop-blur-sm sm:space-y-5 sm:p-6">
            <div className="mx-auto grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
              {currentValue !== undefined && (
                <MetricTile label="Current Value" value={currentValue ? currentValue.toLocaleString() : '-'} teamColors={teamColors} tileAccent={tileAccent} />
              )}
              <MetricTile label="Position Ranking" mobileLabel="POS. Ranking" value={currentRank} valueClassName={`${getPositionRankPillClass(currentRank)} player-modal-rank-value`} teamColors={teamColors} tileAccent={tileAccent} />
              <MetricTile
                label="Value Change"
                value={valueGain !== undefined && valueGain !== null ? `${valueGain > 0 ? '+' : ''}${valueGain.toLocaleString()}` : '-'}
                tone={valueGain !== undefined && valueGain !== null && valueGain > 0 ? 'positive' : valueGain !== undefined && valueGain !== null && valueGain < 0 ? 'negative' : 'neutral'}
                icon={
                  valueGain !== undefined && valueGain !== null && valueGain > 0 ? <TrendingUp className="h-4 w-4" /> : valueGain !== undefined && valueGain !== null && valueGain < 0 ? <TrendingDown className="h-4 w-4" /> : null
                }
                teamColors={teamColors}
                tileAccent={tileAccent}
              />
            </div>

            {valueGain !== undefined && (
              <p className="text-center text-xs leading-relaxed text-slate-500">
                <span className="font-semibold text-cyan-300">Value Change:</span> {valueChangeNote}
              </p>
            )}

            {decisionLabels.length > 0 && (
              <div className="player-decision-strip mx-auto max-w-xl">
                {decisionLabels.map((label) => (
                  <span key={label.label} className={`player-decision-pill player-decision-${label.tone}`}>
                    <strong>{label.label}</strong>
                    <em>{label.copy}</em>
                  </span>
                ))}
              </div>
            )}

            {intelligenceNotes.length > 0 && (
              <div className="mx-auto max-w-xl rounded-2xl border border-cyan-300/15 bg-slate-950/45 p-3 shadow-inner shadow-white/[0.02] sm:p-4">
                <p className="text-center text-[0.68rem] font-black uppercase tracking-[0.2em] text-cyan-300/85">
                  Player Intelligence
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {intelligenceNotes.map((note) => (
                    <div
                      key={`${note.label}-${note.value}`}
                      className={`rounded-xl border bg-slate-950/55 p-3 ${note.fullWidth ? 'sm:col-span-2' : ''}`}
                      style={{
                        borderColor: note.tone === 'risk'
                          ? 'rgba(251, 113, 133, 0.28)'
                          : note.tone === 'upside'
                            ? 'rgba(52, 211, 153, 0.28)'
                            : note.tone === 'market'
                              ? 'rgba(251, 191, 36, 0.28)'
                              : 'rgba(34, 211, 238, 0.18)',
                      }}
                    >
                      <div className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-cyan-300/80">
                        {note.label}
                      </div>
                      <div
                        className={`mt-1 text-sm font-black ${
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
                        <p className="mt-1 text-[0.72rem] font-bold leading-snug text-slate-400">
                          {note.copy}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {valueProfile && (
              <div className="mx-auto max-w-xl space-y-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  <InfoTile label="Dynasty" value={dynastyRank || '-'} valueClassName={getPositionRankPillClass(dynastyRank)} teamColors={teamColors} tileAccent={tileAccent} />
                  <InfoTile label="Season" value={seasonRank || '-'} valueClassName={getPositionRankPillClass(seasonRank)} teamColors={teamColors} tileAccent={tileAccent} />
                  <InfoTile label="Contender" value={contenderRank || '-'} valueClassName={getPositionRankPillClass(contenderRank)} teamColors={teamColors} tileAccent={tileAccent} />
                  <InfoTile label="Rebuilder" value={rebuilderRank || '-'} valueClassName={getPositionRankPillClass(rebuilderRank)} teamColors={teamColors} tileAccent={tileAccent} />
                </div>
                {valueProfile.sources && valueProfile.sources.length > 0 && (
                  <p className="text-center text-[0.68rem] font-bold leading-relaxed uppercase tracking-[0.16em] text-cyan-200/70">
                    Our rank blend weighs dynasty market, current-season outlook, expert baselines, and team-window fit.
                    {valueProfile.fantasyProsPositionRank ? ` Expert season baseline: ${valueProfile.fantasyProsPositionRank}.` : ''}
                  </p>
                )}
              </div>
            )}

            {details?.similarTradeValues?.length ? (
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

            <div className="mx-auto max-w-xl space-y-3">
              {(pick.round !== undefined || pick.pick !== undefined || draftValue !== undefined || pick.positionRankMay2025) && (
                <div className="space-y-3">
                  {(pick.round !== undefined || pick.pick !== undefined) && (
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
                    </div>
                  )}
                  {(draftValue !== undefined || pick.positionRankMay2025) && (
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {draftValue !== undefined && (
                        <InfoTile
                          label="Draft Blend"
                          value={draftValue ? draftValue.toLocaleString() : '-'}
                          teamColors={teamColors}
                          tileAccent={tileAccent}
                        />
                      )}
                      {pick.positionRankMay2025 && (
                        <InfoTile
                          label="Drafted Rank"
                          value={pick.positionRankMay2025}
                          valueClassName={getPositionRankPillClass(pick.positionRankMay2025)}
                          teamColors={teamColors}
                          tileAccent={tileAccent}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
              {physicalRows.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {physicalRows.map(([label, value]) => (
                    <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
                  ))}
                </div>
              )}
              {backgroundRows.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {backgroundRows.map(([label, value]) => (
                    <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
                  ))}
                </div>
              )}
              {lastSeasonRows.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {lastSeasonRows.map(([label, value]) => (
                    <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
                  ))}
                </div>
              )}
              {availabilityRows.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {availabilityRows.map(([label, value]) => (
                    <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
                  ))}
                </div>
              )}
              {details?.availabilityHistory?.length ? (
                <p className="text-center text-[0.68rem] font-bold leading-relaxed text-slate-400">
                  Availability: {details.availabilityHistory.map((item) => `${item.season}: ${item.games ?? '-'} GP`).join(' · ')}
                </p>
              ) : null}
              {experienceRows.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {experienceRows.map(([label, value]) => (
                    <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
                  ))}
                </div>
              )}
              {healthRows.map(([label, value]) => (
                <InfoTile key={String(label)} label={String(label)} value={String(value)} teamColors={teamColors} tileAccent={tileAccent} />
              ))}
            </div>

            <div className="player-complete-data mx-auto max-w-xl">
              <p className="player-complete-title">Player Data Locker</p>
              <div className="player-complete-grid">
                <CompleteDataSection title="Market Ranks" rows={marketRankRows} teamColors={teamColors} tileAccent={tileAccent} rankValues priority />
                <CompleteDataSection title="Raw Source Values" rows={sourceValueRows} teamColors={teamColors} tileAccent={tileAccent} compactNumbers />
                <CompleteDataSection title="NFL Draft" rows={nflDraftRows} teamColors={teamColors} tileAccent={tileAccent} />
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
                {valueProfile?.sources?.length ? (
                  <div className="player-complete-section player-complete-section-wide player-complete-section-centered">
                    <h4>Rank Blend Sources</h4>
                    <p className="player-complete-copy">
                      {valueProfile.sources.map(formatSourceLabel).join(' + ')}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

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

function formatSourceLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('ktc') || normalized.includes('keeptradecut')) return 'KeepTradeCut';
  if (normalized.includes('fantasycalc')) return 'FantasyCalc';
  if (normalized.includes('dynastyprocess')) return 'DynastyProcess';
  if (normalized.includes('fantasypros')) return 'FantasyPros';
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function formatCompleteValue(value: unknown, compactNumbers?: boolean) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') {
    return compactNumbers ? formatValueLens(value) : value.toLocaleString();
  }
  return String(value);
}

function isPositionRankValue(value: unknown) {
  return typeof value === 'string' && /^(QB|RB|WR|TE)\d+$/i.test(value);
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
    return 'Change from historical draft-window blend to current blend.';
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
    const isLeadRole = roleLabel.includes('#1') || /^(QB|RB|WR|TE)$/.test(roleLabel);
    notes.push({
      label: 'Team Role',
      value: roleLabel,
      copy: `${details?.team || 'Team'} depth chart signal${details?.status ? ` with ${details.status.toLowerCase()} status` : ''}.`,
      tone: isLeadRole ? 'upside' : 'neutral',
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
    notes.push({
      label: 'Latest Sleeper Update',
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
  value: string | number;
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
      <div className={`mt-1 truncate text-center text-sm font-bold sm:text-base ${toneClass}`}>
        <span className={valueClassName}>{value}</span>
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
  wide = false,
  priority = false,
}: {
  title: string;
  rows: unknown[][];
  teamColors?: { primary: string; secondary: string; accent: string } | null;
  tileAccent?: string;
  compactNumbers?: boolean;
  rankValues?: boolean;
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
      <div className="player-complete-rows">
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
}: {
  label: string;
  value: string | number;
  teamColors?: { primary: string; secondary: string; accent: string } | null;
  tileAccent?: string;
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
      <span className="text-sm font-black text-slate-100 sm:text-base">{value}</span>
    </div>
  );
}
