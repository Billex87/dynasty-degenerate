export function getPositionRankClass(rank?: string | null): string {
  const normalized = (rank || '').trim().toUpperCase();
  if (normalized.startsWith('QB')) return 'position-rank-qb';
  if (normalized.startsWith('RB')) return 'position-rank-rb';
  if (normalized.startsWith('WR')) return 'position-rank-wr';
  if (normalized.startsWith('TE')) return 'position-rank-te';
  return 'position-rank-neutral';
}

export function getPositionRankPillClass(rank?: string | null, extraClass = ''): string {
  return `position-rank-pill ${getPositionRankClass(rank)} ${extraClass}`.trim();
}
