import type { DraftPick, ManagerRosterIntelligence } from '@shared/types';

export type DraftOpportunity =
  | {
      type: 'missed';
      label: string;
      playerName: string;
      playerId?: string;
      pickLabel: string;
      delta: number;
    }
  | {
      type: 'win';
      label: string;
    };

export function getDraftPickKey(pick: Pick<DraftPick, 'draftYear' | 'round' | 'pick' | 'player_id' | 'playerName'>): string {
  return [
    pick.draftYear || 'Draft',
    pick.round,
    pick.pick,
    pick.player_id || pick.playerName,
  ].join('|');
}

export function buildDraftOpportunityMap(
  draftPicks: DraftPick[],
  managerRosterIntelligence: ManagerRosterIntelligence[] = []
): Record<string, DraftOpportunity> {
  const intelByManager = new Map(managerRosterIntelligence.map((row) => [row.manager, row]));
  const pickedOnly = draftPicks
    .filter((pick) => pick.player_id && pick.playerName && pick.playerName !== 'Unknown' && pick.currentKtcValue)
    .sort((a, b) => {
      const yearDiff = Number(a.draftYear || 0) - Number(b.draftYear || 0);
      if (yearDiff !== 0) return yearDiff;
      return a.pick - b.pick;
    });

  const byYear = pickedOnly.reduce<Record<string, DraftPick[]>>((groups, pick) => {
    const year = pick.draftYear || 'Draft';
    groups[year] = groups[year] || [];
    groups[year].push(pick);
    return groups;
  }, {});

  const result: Record<string, DraftOpportunity> = {};

  Object.values(byYear).forEach((yearPicks) => {
    yearPicks.forEach((pick) => {
      const currentValue = pick.currentKtcValue || 0;
      const pickedPosition = normalizePosition(pick.playerPos);
      const needPositions = getDraftNeedPositions(intelByManager.get(pick.manager) || null);
      const isNeedPick = Boolean(pickedPosition && needPositions.includes(pickedPosition));
      const laterPicks = yearPicks
        .filter((candidate) => candidate.pick > pick.pick && (candidate.currentKtcValue || 0) > currentValue + 250)
        .map((candidate) => ({
          candidate,
          delta: (candidate.currentKtcValue || 0) - currentValue,
          distance: candidate.pick - pick.pick,
          position: normalizePosition(candidate.playerPos),
        }))
        .filter((candidate) => {
          if (!isNeedPick) return true;
          return candidate.position === pickedPosition || needPositions.includes(candidate.position);
        })
        .sort((a, b) => {
          const aCloseBonus = a.distance <= 5 ? 700 : 0;
          const bCloseBonus = b.distance <= 5 ? 700 : 0;
          const aNeedBonus = isNeedPick && a.position === pickedPosition ? 500 : 0;
          const bNeedBonus = isNeedPick && b.position === pickedPosition ? 500 : 0;
          return (b.delta + bCloseBonus + bNeedBonus) - (a.delta + aCloseBonus + aNeedBonus);
        });

      const missed = laterPicks[0];
      if (missed) {
        result[getDraftPickKey(pick)] = {
          type: 'missed',
          label: missed.distance <= 5 ? 'Just Missed' : 'Better Board Value',
          playerName: missed.candidate.playerName,
          playerId: missed.candidate.player_id,
          pickLabel: `${missed.candidate.draftYear || ''} #${missed.candidate.pick}`.trim(),
          delta: missed.delta,
        };
        return;
      }

      result[getDraftPickKey(pick)] = {
        type: 'win',
        label: 'Board Win',
      };
    });
  });

  return result;
}

function normalizePosition(position?: string | null): string {
  const normalized = (position || '').toUpperCase();
  if (normalized.startsWith('QB')) return 'QB';
  if (normalized.startsWith('RB')) return 'RB';
  if (normalized.startsWith('WR')) return 'WR';
  if (normalized.startsWith('TE')) return 'TE';
  return normalized;
}

function getDraftNeedPositions(intel: ManagerRosterIntelligence | null): string[] {
  if (!intel) return [];

  const needs: string[] = [];
  if (intel.tradePlan?.needPosition) needs.push(intel.tradePlan.needPosition);

  const summary = (intel.holes.summary || '').toUpperCase();
  (['QB', 'RB', 'WR', 'TE'] as const).forEach((position) => {
    if (summary.includes(position)) needs.push(position);
  });

  const bestQbRank = parseRankNumber(intel.holes.bestQbRank);
  const rb2Rank = parseRankNumber(intel.holes.rb2Rank);
  const wr3Rank = parseRankNumber(intel.holes.wr3Rank);
  const te1Rank = parseRankNumber(intel.holes.te1Rank);
  if (bestQbRank !== null && bestQbRank > 16) needs.push('QB');
  if (rb2Rank !== null && rb2Rank > 28) needs.push('RB');
  if (wr3Rank !== null && wr3Rank > 36) needs.push('WR');
  if (te1Rank !== null && te1Rank > 14) needs.push('TE');

  Object.entries(intel.positionGrades || {}).forEach(([position, grade]) => {
    const gradeText = `${grade?.grade || ''} ${grade?.note || ''}`.toUpperCase();
    if (/(WEAK|THIN|NEED|LIGHT|FRAGILE|ATTACK|BEHIND)/.test(gradeText)) {
      needs.push(position);
    }
  });

  if (intel.holes.flexDepth <= 5) {
    needs.push('RB', 'WR');
  }

  return Array.from(new Set(needs.map(normalizePosition).filter(Boolean)));
}

function parseRankNumber(rank?: string | null): number | null {
  if (!rank) return null;
  const match = rank.match(/\d+/);
  return match ? Number(match[0]) : null;
}
