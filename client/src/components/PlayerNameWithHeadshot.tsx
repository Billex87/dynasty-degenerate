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
  const { data: headshotData } = trpc.images.playerHeadshot.useQuery(
    { playerId: playerId || '' },
    { enabled: !!playerId }
  );

  useEffect(() => {
    if (headshotData?.success && headshotData?.data) {
      setHeadshot(`data:${headshotData.contentType};base64,${headshotData.data}`);
    }
  }, [headshotData]);

  return (
    <div className="flex items-center gap-2 min-w-0">
      {headshot && (
        <img
          src={headshot}
          alt={playerName}
          className="w-6 h-6 md:w-7 md:h-7 rounded-full flex-shrink-0 object-cover border border-orange-400/30"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <span className="truncate">{playerName}</span>
    </div>
  );
}
