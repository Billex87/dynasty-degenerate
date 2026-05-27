import type { DraftPick, ManagerRosterIntelligence, ReportData } from '@shared/types';
import { getDraftKind, type DraftKind } from './draftDisplay';
import type { LeagueValueMode } from './leagueValueMode';

export type DraftOpportunity =
  {
    type: 'missed';
    label: string;
    playerName: string;
    playerId?: string;
    pickLabel: string;
    delta: number;
    reason: 'need' | 'position' | 'close' | 'value' | 'adp';
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
  managerRosterIntelligence: ManagerRosterIntelligence[] = [],
  leagueValueMode?: ReportData['leagueValueMode'] | LeagueValueMode | string | null,
): Record<string, DraftOpportunity> {
  const intelByManager = new Map(managerRosterIntelligence.map((row) => [row.manager, row]));
  const pickedOnly = draftPicks
    .filter((pick) => pick.player_id && pick.playerName && pick.playerName !== 'Unknown' && pick.currentKtcValue)
    .sort((a, b) => {
      const yearDiff = Number(a.draftYear || 0) - Number(b.draftYear || 0);
      if (yearDiff !== 0) return yearDiff;
      return a.pick - b.pick;
    });

  const byDraftGroup = pickedOnly.reduce<Record<string, DraftPick[]>>((groups, pick) => {
    const group = getDraftOpportunityGroupKey(pick, leagueValueMode);
    groups[group] = groups[group] || [];
    groups[group].push(pick);
    return groups;
  }, {});

  const result: Record<string, DraftOpportunity> = {};

  Object.values(byDraftGroup).forEach((yearPicks) => {
    const draftKind = getDraftKind(yearPicks[0] || {}, leagueValueMode);
    const draftYear = Number(yearPicks[0]?.draftYear || 0);
    yearPicks.forEach((pick) => {
      const currentValue = pick.currentKtcValue || 0;
      const pickedPosition = normalizePosition(pick.playerPos);
      const isStartupDraft = draftKind === 'startup';
      const needPositions = isStartupDraft ? [] : getDraftNeedPositions(intelByManager.get(pick.manager) || null);
      const laterPicks = yearPicks
        .filter((candidate) => (
          candidate.pick > pick.pick
          && (candidate.currentKtcValue || 0) > currentValue + 250
          && isEligibleDraftOpportunityCandidate(candidate, draftKind, draftYear)
        ))
        .map((candidate) => {
          const position = normalizePosition(candidate.playerPos);

          return {
            candidate,
            delta: (candidate.currentKtcValue || 0) - currentValue,
            distance: candidate.pick - pick.pick,
            position,
            isNeedFit: Boolean(position && needPositions.includes(position)),
            isSamePosition: !isStartupDraft && Boolean(position && pickedPosition && position === pickedPosition),
            isAdpValue: isStartupDraft && isMeaningfulAdpFall(pick, candidate),
          };
        })
        .filter((candidate) => {
          if (candidate.distance <= 5) return true;
          if (candidate.isNeedFit || candidate.isSamePosition || candidate.isAdpValue) return true;
          return candidate.delta >= 750;
        })
        .sort((a, b) => {
          const aCloseBonus = a.distance <= 5 ? 700 : 0;
          const bCloseBonus = b.distance <= 5 ? 700 : 0;
          const aNeedBonus = a.isNeedFit ? 550 : 0;
          const bNeedBonus = b.isNeedFit ? 550 : 0;
          const aPositionBonus = a.isSamePosition ? 450 : 0;
          const bPositionBonus = b.isSamePosition ? 450 : 0;
          const aAdpBonus = a.isAdpValue ? 500 : 0;
          const bAdpBonus = b.isAdpValue ? 500 : 0;
          return (b.delta + bCloseBonus + bNeedBonus + bPositionBonus + bAdpBonus)
            - (a.delta + aCloseBonus + aNeedBonus + aPositionBonus + aAdpBonus);
        });

      const missed = laterPicks[0];
      if (missed) {
        const reason = missed.isAdpValue
          ? 'adp'
          : missed.isNeedFit
          ? 'need'
          : missed.isSamePosition
            ? 'position'
            : missed.distance <= 5
              ? 'close'
              : 'value';
        result[getDraftPickKey(pick)] = {
          type: 'missed',
          label: getMissedDraftLabel(reason),
          playerName: missed.candidate.playerName,
          playerId: missed.candidate.player_id,
          pickLabel: `${missed.candidate.draftYear || ''} #${missed.candidate.pick}`.trim(),
          delta: missed.delta,
          reason,
        };
        return;
      }
    });
  });

  return result;
}

function getDraftOpportunityGroupKey(
  pick: DraftPick,
  leagueValueMode?: ReportData['leagueValueMode'] | LeagueValueMode | string | null,
): string {
  return `${pick.draftYear || 'Draft'}::${getDraftKind(pick, leagueValueMode)}`;
}

function isEligibleDraftOpportunityCandidate(
  candidate: DraftPick,
  draftKind: DraftKind,
  draftYear: number,
): boolean {
  if (draftKind !== 'rookie') return true;

  const rookieYear = Number(candidate.playerDetails?.rookieYear);
  if (Number.isFinite(rookieYear) && rookieYear > 0 && Number.isFinite(draftYear) && draftYear > 0) {
    return rookieYear === draftYear;
  }

  const yearsExp = Number(candidate.playerDetails?.yearsExp);
  const expectedYearsExp = new Date().getFullYear() - draftYear;
  if (
    Number.isFinite(yearsExp)
    && yearsExp >= 0
    && Number.isFinite(expectedYearsExp)
    && expectedYearsExp >= 0
  ) {
    return yearsExp <= expectedYearsExp;
  }

  return true;
}

function getMissedDraftLabel(reason: 'need' | 'position' | 'close' | 'value' | 'adp'): string {
  if (reason === 'adp') return 'ADP Miss';
  if (reason === 'need') return 'Need Miss';
  if (reason === 'position') return 'Position Miss';
  if (reason === 'close') return 'Missed';
  return 'Board Value';
}

function isMeaningfulAdpFall(pick: DraftPick, candidate: DraftPick): boolean {
  const pickAdp = Number(pick.adp);
  const candidateAdp = Number(candidate.adp);
  if (!Number.isFinite(pickAdp) || !Number.isFinite(candidateAdp)) return false;
  return candidateAdp + 5 <= pickAdp;
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
