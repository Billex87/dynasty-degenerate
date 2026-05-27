import { useState, useEffect } from 'react';
import { getCachedDraftBuzzImageUrl, getNflTeamLogoUrl, normalizeNflTeamAbbr } from '@/lib/teamTileStyle';
import { trpc } from '@/lib/trpc';

interface PlayerNameWithHeadshotProps {
  playerId?: string;
  playerName: string;
  fallbackImageUrl?: string | null;
  team?: string | null;
  position?: string | null;
}

export function PlayerNameWithHeadshot({
  playerId,
  playerName,
  fallbackImageUrl,
  team,
  position,
}: PlayerNameWithHeadshotProps) {
  const [headshot, setHeadshot] = useState<string | null>(null);
  const [directImageFailed, setDirectImageFailed] = useState(false);
  const [fallbackImageFailed, setFallbackImageFailed] = useState(false);
  const [teamLogoFailed, setTeamLogoFailed] = useState(false);
  const normalizedTeam = normalizeNflTeamAbbr(team);
  const normalizedPosition = (position || '').trim().toUpperCase();
  const isDefense = normalizedPosition === 'DEF' || normalizedPosition === 'DST';
  const defenseLogo = isDefense && normalizedTeam && !teamLogoFailed
    ? getNflTeamLogoUrl(normalizedTeam)
    : null;
  const { data: headshotData } = trpc.images.playerHeadshot.useQuery(
    {
      playerId: playerId || '',
      playerName,
      position: normalizedPosition || null,
    },
    { enabled: !!playerId && !isDefense && directImageFailed }
  );

  useEffect(() => {
    setHeadshot(null);
    setDirectImageFailed(false);
    setFallbackImageFailed(false);
    setTeamLogoFailed(false);
  }, [playerId, fallbackImageUrl, normalizedTeam, normalizedPosition]);

  useEffect(() => {
    if (headshotData?.success && headshotData?.data && headshotData.contentType) {
      setHeadshot(`data:${headshotData.contentType};base64,${headshotData.data}`);
    } else if (headshotData?.success && headshotData.imageUrl) {
      setHeadshot(getCachedDraftBuzzImageUrl(headshotData.imageUrl) || headshotData.imageUrl);
    } else if (headshotData && !headshotData.success) {
      setHeadshot(null);
    }
  }, [headshotData]);

  const initials = playerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
  const directHeadshot = playerId
    ? `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`
    : null;
  const fallbackImage = fallbackImageUrl && !fallbackImageFailed
    ? getCachedDraftBuzzImageUrl(fallbackImageUrl) || fallbackImageUrl
    : null;
  const imageSrc = defenseLogo || headshot || (!isDefense && !directImageFailed ? directHeadshot : null) || fallbackImage;

  return (
    <div className="report-identity-chip interactive-identity player-chip flex min-w-0 items-center gap-2">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={playerName}
          className="interactive-identity-avatar h-8 w-8 flex-shrink-0 object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.38)]"
          onError={() => {
            if (imageSrc === defenseLogo) {
              setTeamLogoFailed(true);
              return;
            }
            if (imageSrc === directHeadshot && !directImageFailed) {
              setDirectImageFailed(true);
              return;
            }
            if (imageSrc === fallbackImage) {
              setFallbackImageFailed(true);
              return;
            }
            setHeadshot(null);
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="interactive-identity-avatar flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-orange-400/30 bg-gradient-to-br from-slate-800 to-orange-950 text-[11px] font-bold text-orange-300"
        >
          {initials || '?'}
        </span>
      )}
      <span className="interactive-identity-name min-w-0 truncate">{playerName}</span>
    </div>
  );
}
