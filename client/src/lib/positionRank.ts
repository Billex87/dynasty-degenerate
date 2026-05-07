export function getPositionRankClass(rank?: string | null): string {
  const normalized = (rank || '').trim().toUpperCase();
  if (normalized.startsWith('QB')) return 'position-rank-qb';
  if (normalized.startsWith('RB')) return 'position-rank-rb';
  if (normalized.startsWith('WR')) return 'position-rank-wr';
  if (normalized.startsWith('TE')) return 'position-rank-te';
  if (normalized.startsWith('FLEX')) return 'position-rank-flex';
  if (normalized.startsWith('K')) return 'position-rank-k';
  if (normalized.startsWith('DEF') || normalized.startsWith('DST')) return 'position-rank-def';
  return 'position-rank-neutral';
}

export function getPositionRankPillClass(rank?: string | null, extraClass = ''): string {
  return `position-rank-pill ${getPositionRankClass(rank)} ${extraClass}`.trim();
}
