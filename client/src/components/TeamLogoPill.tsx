import { useState } from 'react';
import { getNflTeamLogoUrl, normalizeNflTeamAbbr } from '@/lib/teamTileStyle';

const FREE_AGENT_NFL_LOGO_URL = '/assets/draftbuzz-cache/nfl-logos/nfl.svg';

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

  if (!normalizedTeam) {
    return (
      <span className={`team-logo-pill team-logo-pill-league ${className}`.trim()} title="Free agent" aria-label="Free agent">
        <img
          src={FREE_AGENT_NFL_LOGO_URL}
          alt=""
          loading="lazy"
          className="team-logo-pill-league-mark"
        />
        {showText && <span className="sr-only">Free agent</span>}
      </span>
    );
  }

  if (!logoUrl || failed) {
    return (
      <span className={`team-logo-pill team-logo-pill-fallback ${className}`.trim()} title={normalizedTeam} aria-label={normalizedTeam}>
        {normalizedTeam}
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
