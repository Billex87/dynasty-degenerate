import { useState } from 'react';
import { getNflTeamLogoUrl, normalizeNflTeamAbbr } from '@/lib/teamTileStyle';

export function TeamLogoPill({
  team,
  showText = false,
  className = '',
}: {
  team?: string | null;
  showText?: boolean;
  className?: string;
}) {
  const normalizedTeam = normalizeNflTeamAbbr(team);
  const logoUrl = getNflTeamLogoUrl(normalizedTeam);
  const [failed, setFailed] = useState(false);

  if (!normalizedTeam || !logoUrl || failed) {
    return (
      <span className={`team-logo-pill team-logo-pill-fallback ${className}`.trim()} title={normalizedTeam || 'Free agent'}>
        {showText ? (normalizedTeam || 'FA') : (normalizedTeam || 'FA')}
      </span>
    );
  }

  return (
    <span className={`team-logo-pill ${className}`.trim()} title={normalizedTeam} aria-label={normalizedTeam}>
      <img src={logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
      {showText && <span>{normalizedTeam}</span>}
    </span>
  );
}
