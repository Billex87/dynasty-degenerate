import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

interface PlayerNameWithHeadshotProps {
  playerId?: string;
  playerName: string;
}

export function PlayerNameWithHeadshot({
  playerId,
  playerName,
}: PlayerNameWithHeadshotProps) {
  const [headshot, setHeadshot] = useState<string | null>(null);
  const [directImageFailed, setDirectImageFailed] = useState(false);
  const { data: headshotData } = trpc.images.playerHeadshot.useQuery(
    { playerId: playerId || '' },
    { enabled: !!playerId && directImageFailed }
  );

  useEffect(() => {
    setHeadshot(null);
    setDirectImageFailed(false);
  }, [playerId]);

  useEffect(() => {
    if (headshotData?.success && headshotData?.data) {
      setHeadshot(`data:${headshotData.contentType};base64,${headshotData.data}`);
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
  const imageSrc = headshot || (!directImageFailed ? directHeadshot : null);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={playerName}
          className="w-6 h-6 md:w-7 md:h-7 rounded-full flex-shrink-0 object-cover border border-orange-400/30"
          onError={() => {
            if (!directImageFailed && directHeadshot) {
              setDirectImageFailed(true);
              return;
            }
            setHeadshot(null);
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-orange-400/30 bg-gradient-to-br from-slate-800 to-orange-950 text-[10px] font-bold text-orange-300 md:h-7 md:w-7 md:text-[11px]"
        >
          {initials || '?'}
        </span>
      )}
      <span className="min-w-0 truncate">{playerName}</span>
    </div>
  );
}
