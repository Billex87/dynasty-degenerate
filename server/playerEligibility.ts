const FANTASY_SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

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
