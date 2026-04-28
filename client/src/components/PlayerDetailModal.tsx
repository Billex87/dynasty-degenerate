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
import { ManagerNameWithAvatar } from './ManagerNameWithAvatar';

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
  const healthRows = [
    ['Injury Status', details?.injuryStatus],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden border-slate-700/70 bg-[#121827] p-0 text-slate-100 shadow-2xl shadow-black/60 sm:max-h-[88vh] sm:max-w-2xl"
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
                    <span
                      className="rounded-full border px-3 py-1 text-xs font-bold shadow-sm shadow-black/25"
                      style={{
                        borderColor: teamColors ? `${teamColors.accent}77` : 'rgba(251,146,60,0.4)',
                        backgroundColor: teamColors ? `${teamColors.primary}66` : 'rgba(251,146,60,0.14)',
                        color: '#fff',
                      }}
                    >
                      {team}
                    </span>
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
              <MetricTile label="Position Ranking" mobileLabel="POS. Ranking" value={currentRank} teamColors={teamColors} tileAccent={tileAccent} />
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
                          label="Draft Value"
                          value={draftValue ? draftValue.toLocaleString() : '-'}
                          teamColors={teamColors}
                          tileAccent={tileAccent}
                        />
                      )}
                      {pick.positionRankMay2025 && (
                        <InfoTile
                          label="Drafted Rank"
                          value={pick.positionRankMay2025}
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

function formatDepthChart(position: string | null | undefined, order: number | null | undefined) {
  if (!position) return null;
  const normalizedPosition = ['SWR', 'LWR', 'RWR'].includes(position) ? 'WR' : position;
  return [normalizedPosition, order ? `#${order}` : null].filter(Boolean).join(' ');
}

function getValueChangeNote(pick: PlayerModalData) {
  if (pick.ktcValue !== undefined) {
    return 'Change from draft value to current value.';
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

function MetricTile({
  label,
  mobileLabel,
  value,
  tone = 'neutral',
  icon,
  teamColors,
  tileAccent,
}: {
  label: string;
  mobileLabel?: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
  teamColors?: { primary: string; secondary: string; accent: string } | null;
  tileAccent?: string;
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
        {value}
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
}: {
  label: string;
  value: string | number;
  tone?: 'positive' | 'negative' | 'neutral';
  teamColors?: { primary: string; secondary: string; accent: string } | null;
  tileAccent?: string;
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
      <div className={`mt-1 truncate text-center text-sm font-bold sm:text-base ${toneClass}`}>{value}</div>
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
