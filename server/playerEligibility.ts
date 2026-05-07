const FANTASY_SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);
const SEASON_LINEUP_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DST']);

export function normalizeSeasonLineupPosition(position: unknown): string | null {
  const normalized = typeof position === 'string' ? position.toUpperCase().replace(/[^A-Z]/g, '') : '';
  if (!normalized) return null;
  if (normalized === 'DST' || normalized === 'D' || normalized === 'DEFENSE') return 'DEF';
  if (normalized === 'PK') return 'K';
  return normalized;
}

export function isCurrentFantasySkillPlayer(player: Record<string, any> | undefined): boolean {
  const position = typeof player?.position === 'string' ? player.position : null;
  if (!position || !FANTASY_SKILL_POSITIONS.has(position)) return false;
  if (player?.active === false) return false;

  const fantasyPositions = Array.isArray(player?.fantasy_positions)
    ? player.fantasy_positions
    : [];
  if (fantasyPositions.length > 0 && !fantasyPositions.includes(position)) return false;

  return true;
}

export function isCurrentSeasonLineupPlayer(player: Record<string, any> | undefined): boolean {
  const position = normalizeSeasonLineupPosition(player?.position);
  if (!position || !SEASON_LINEUP_POSITIONS.has(position)) return false;
  if (player?.active === false) return false;

  const fantasyPositions = Array.isArray(player?.fantasy_positions)
    ? player.fantasy_positions.map(normalizeSeasonLineupPosition).filter(Boolean)
    : [];
  if (fantasyPositions.length > 0 && !fantasyPositions.includes(position)) return false;

  return true;
}
