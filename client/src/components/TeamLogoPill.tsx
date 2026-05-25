import { useState } from 'react';
import { getNflTeamLogoUrl, normalizeNflTeamAbbr } from '@/lib/teamTileStyle';

function NFLShieldMark() {
  return (
    <svg className="team-logo-pill-league-mark" viewBox="0 0 40 48" aria-hidden="true" focusable="false">
      <path
        d="M5 4h30v17.5c0 10.4-5.7 18-15 22.5C10.7 39.5 5 31.9 5 21.5V4Z"
        fill="currentColor"
      />
      <path
        d="M9 7.5h22v13.3c0 8.3-4.1 14-11 17.9-6.9-3.9-11-9.6-11-17.9V7.5Z"
        fill="#020617"
      />
      <path d="M13 15h14M13 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.72" />
      <text
        x="20"
        y="31"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="11"
        fontWeight="900"
        letterSpacing="0"
        fill="currentColor"
      >
        NFL
      </text>
    </svg>
  );
}

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
        <NFLShieldMark />
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
