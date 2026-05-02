import type { DraftPick } from '@shared/types';

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

export function buildDraftOpportunityMap(draftPicks: DraftPick[]): Record<string, DraftOpportunity> {
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
      const laterPicks = yearPicks
        .filter((candidate) => candidate.pick > pick.pick && (candidate.currentKtcValue || 0) > currentValue + 250)
        .map((candidate) => ({
          candidate,
          delta: (candidate.currentKtcValue || 0) - currentValue,
          distance: candidate.pick - pick.pick,
        }))
        .sort((a, b) => {
          const aCloseBonus = a.distance <= 5 ? 700 : 0;
          const bCloseBonus = b.distance <= 5 ? 700 : 0;
          return (b.delta + bCloseBonus) - (a.delta + aCloseBonus);
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
