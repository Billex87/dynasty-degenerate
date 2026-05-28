import type { DraftPick, ManagerRosterIntelligence } from '@shared/types';
import { getDraftPickKey } from '@/lib/draftOpportunity';
import { getDraftKind } from '@/lib/draftDisplay';
import { type DraftDecisionAudit, type DraftDecisionTone } from '@/features/report/lib/draftDecisionAnalytics';
import { type LeagueValueMode } from '@/lib/leagueValueMode';

export function buildDraftDecisionAudits(
  draftPicks: DraftPick[],
  managerRosterIntelligence: ManagerRosterIntelligence[],
  leagueValueMode: LeagueValueMode = 'dynasty',
): DraftDecisionAudit[] {
  const intelByManager = new Map(managerRosterIntelligence.map((row) => [row.manager, row]));
  const byYear = draftPicks
    .filter((pick) => pick.player_id && pick.playerName && pick.playerName !== 'Unknown')
    .reduce<Record<string, DraftPick[]>>((groups, pick) => {
      const year = getDraftGroupKey(pick, leagueValueMode);
      groups[year] = groups[year] || [];
      groups[year].push(pick);
      return groups;
    }, {});

  return Object.entries(byYear)
    .sort(([a], [b]) => compareDraftGroupKeys(a, b))
    .flatMap(([, yearPicks]) => {
      const orderedPicks = [...yearPicks].sort((a, b) => a.pick - b.pick);
      return orderedPicks.map((pick) => buildDraftDecisionAudit(pick, orderedPicks, intelByManager.get(pick.manager) || null, leagueValueMode));
    });
}

export function attachDraftDecisionAudit(pick: DraftPick, audit?: DraftDecisionAudit): DraftPick {
  if (!audit) return pick;

  return {
    ...pick,
    draftDecisionVerdict: audit.verdict,
    draftDecisionTone: audit.tone,
    draftDecisionPrimaryNeed: audit.primaryNeed,
    draftDecisionBoardRankLabel: audit.boardRankLabel,
    draftDecisionSummary: audit.summary,
    draftDecisionAltLabel: audit.alternative?.label || null,
    draftDecisionAltPlayerName: audit.alternative?.playerName || null,
    draftDecisionAltPosition: audit.alternative?.position || null,
    draftDecisionAltPickLabel: audit.alternative?.pickLabel || null,
  };
}

function buildDraftDecisionAudit(
  pick: DraftPick,
  yearPicks: DraftPick[],
  intel: ManagerRosterIntelligence | null,
  leagueValueMode: LeagueValueMode = 'dynasty',
): DraftDecisionAudit {
  const isStartupDraft = getDraftKind(pick, leagueValueMode) === 'startup';
  const needPositions = isStartupDraft ? [] : getDraftNeedPositions(intel);
  const primaryNeed = needPositions[0] || null;
  const pickedPosition = normalizePosition(pick.playerPos);
  const pickedValue = getDraftWindowValue(pick);
  const availableAtPick = yearPicks
    .filter((candidate) => candidate.pick >= pick.pick && getDraftWindowValue(candidate) > 0)
    .sort((a, b) => getDraftWindowValue(b) - getDraftWindowValue(a));
  const boardRank = Math.max(1, availableAtPick.findIndex((candidate) => getDraftPickKey(candidate) === getDraftPickKey(pick)) + 1);
  const bestAvailable = availableAtPick.find((candidate) => getDraftPickKey(candidate) !== getDraftPickKey(pick)) || null;
  const bestSamePositionAvailable = availableAtPick.find((candidate) => {
    if (getDraftPickKey(candidate) === getDraftPickKey(pick)) return false;
    return normalizePosition(candidate.playerPos) === pickedPosition;
  }) || null;
  const bestNeedAvailable = availableAtPick.find((candidate) => {
    if (getDraftPickKey(candidate) === getDraftPickKey(pick)) return false;
    return needPositions.includes(normalizePosition(candidate.playerPos));
  }) || null;
  const hasTrueNeedAlternative = Boolean(
    primaryNeed
      && bestNeedAvailable
      && normalizePosition(bestNeedAvailable.playerPos) === normalizePosition(primaryNeed)
  );
  const needMatch = Boolean(pickedPosition && needPositions.includes(pickedPosition));
  const bestAvailableDelta = bestAvailable ? getDraftWindowValue(bestAvailable) - pickedValue : 0;
  const samePositionDelta = bestSamePositionAvailable ? getDraftWindowValue(bestSamePositionAvailable) - pickedValue : 0;
  const needAlternativeDelta = bestNeedAvailable ? getDraftWindowValue(bestNeedAvailable) - pickedValue : 0;
  const boardRankLabel = boardRank <= 12 ? `Board #${boardRank}` : 'Board Reach';

  let verdict = 'Preference Pick';
  let tone: DraftDecisionTone = 'watch';
  if (boardRank <= 3 || bestAvailableDelta <= 150) {
    verdict = needMatch ? 'Board + Fit' : 'Board Pick';
    tone = 'win';
  } else if (bestAvailableDelta <= 550) {
    verdict = needMatch ? 'Fit Tiebreaker' : 'Value Pocket';
    tone = needMatch ? 'need' : 'value';
  } else if (!isStartupDraft && bestSamePositionAvailable && samePositionDelta > 350) {
    verdict = 'Passed Position Value';
    tone = 'watch';
  } else if (bestAvailableDelta > 900) {
    verdict = 'Passed Board Value';
    tone = 'watch';
  } else if (needMatch) {
    verdict = 'Fit Tiebreaker';
    tone = 'need';
  }

  const needReason = isStartupDraft
    ? 'Startup drafts begin from an empty roster, so this is graded on board value and ADP discipline rather than positional need.'
    : primaryNeed ? getNeedReason(intel, primaryNeed) : 'No major position hole was flagged for this roster.';
  const summary = buildDraftDecisionSummary({
    verdict,
    pick,
    primaryNeed,
    pickedPosition,
    needMatch,
    boardRank,
    bestAvailableDelta,
    samePositionDelta,
    bestAvailable,
    bestSamePositionAvailable,
    needReason,
    leagueValueMode,
  });

  const alternative = buildDraftAlternative(
    pick,
    bestAvailable,
    isStartupDraft ? null : bestSamePositionAvailable,
    bestNeedAvailable,
    needMatch,
    primaryNeed,
    bestAvailableDelta,
    isStartupDraft ? 0 : samePositionDelta,
    needAlternativeDelta,
    hasTrueNeedAlternative,
  );
  return {
    pick,
    verdict,
    tone,
    primaryNeed,
    boardRankLabel,
    summary,
    alternative,
  };
}

function buildDraftDecisionSummary({
  verdict,
  pick,
  primaryNeed,
  pickedPosition,
  needMatch,
  boardRank,
  bestAvailableDelta,
  samePositionDelta,
  bestAvailable,
  bestSamePositionAvailable,
  needReason,
  leagueValueMode = 'dynasty',
}: {
  verdict: string;
  pick: DraftPick;
  primaryNeed: string | null;
  pickedPosition: string;
  needMatch: boolean;
  boardRank: number;
  bestAvailableDelta: number;
  samePositionDelta: number;
  bestAvailable: DraftPick | null;
  bestSamePositionAvailable: DraftPick | null;
  needReason: string;
  leagueValueMode?: LeagueValueMode;
}) {
  const isRedraft = leagueValueMode === 'redraft';
  const draftedLabel = pick.positionRankMay2025 || pick.currentPositionRank || pick.playerPos;
  const boardPocket = boardRank <= 3 ? 'top board pocket' : boardRank <= 8 ? 'strong board pocket' : 'thin value pocket';
  const altValueGap = bestAvailableDelta > 0 ? `${bestAvailableDelta.toLocaleString()} value points` : 'roughly even value';

  if (verdict === 'Board + Fit') {
    return isRedraft
      ? `${pick.playerName} was a clean redraft pick: draft-day price, current value, and roster fit all lined up. ${draftedLabel} landed inside the ${boardPocket}, and ${needReason}`
      : `${pick.playerName} was the clean kind of dynasty pick: board value first, roster fit second. ${draftedLabel} landed inside the ${boardPocket}, and ${needReason}`;
  }

  if (verdict === 'Fit Tiebreaker') {
    return `${pick.playerName} was close enough on value for roster context to matter. ${pickedPosition || pick.playerPos} helped the pressure profile, but this is still graded as a value-window pick first. ${needReason}`;
  }

  if (verdict === 'Value Pocket') {
    return `${pick.playerName} stayed in a reasonable value lane. ${draftedLabel} was not the top name left, but the gap to the board was small enough that manager preference is defensible.`;
  }

  if (verdict === 'Board Pick') {
    if (primaryNeed && !needMatch) {
      return isRedraft
        ? `${pick.playerName} was the right kind of redraft value: take the best current-season profile, then solve ${primaryNeed} with waivers or trades. ${draftedLabel} still sat in the ${boardPocket}.`
        : `${pick.playerName} was the right kind of dynasty bet: take the value, then solve ${primaryNeed} later by trade. ${draftedLabel} still sat in the ${boardPocket}.`;
    }
    return `${pick.playerName} was mostly a value call. The roster did not need to force a position here, and ${draftedLabel} still sat in the ${boardPocket} when this pick came up.`;
  }

  if (verdict === 'Passed Position Value' || verdict === 'Passed Board Value') {
    if (bestSamePositionAvailable && samePositionDelta > 250) {
      const betterName = bestSamePositionAvailable.playerName;
      if (primaryNeed && !needMatch) {
        return `${pick.playerName} left stronger value on the board. ${betterName} graded ${samePositionDelta.toLocaleString()} value points better on the same position line at ${bestSamePositionAvailable.positionRankMay2025 || bestSamePositionAvailable.currentPositionRank || bestSamePositionAvailable.playerPos}; the ${primaryNeed} need is just supporting context.`;
      }
      return `${pick.playerName} was not the cleanest value at ${pickedPosition || pick.playerPos}. ${betterName} graded ${samePositionDelta.toLocaleString()} value points better on the same position line, so this was a straight value loss.`;
    }
    const betterName = bestAvailable?.playerName || 'a stronger board value';
    return `${pick.playerName} was more about manager preference than price. ${betterName} graded ${altValueGap} better in the same draft window, so this was a conscious pass on value.`;
  }

  if (needMatch) {
    return `${pick.playerName} split the difference between need and value. ${pickedPosition || pick.playerPos} helped the roster, but this was not one of the board's cleanest prices.`;
  }

  return `${pick.playerName} reads like a preference pick. The roster was not forced into ${pickedPosition || pick.playerPos}, and the board did not clearly demand this player over the alternatives.`;
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

  return Array.from(new Set(needs.map(normalizePosition).filter(Boolean))) as string[];
}

function getNeedReason(intel: ManagerRosterIntelligence | null, position: string): string {
  if (!intel) return 'Roster context was limited, so this leans on board value.';
  const normalized = normalizePosition(position);
  if (normalized === 'QB' && intel.holes.bestQbRank) return `QB pressure showed up with the best QB at ${intel.holes.bestQbRank}.`;
  if (normalized === 'RB' && intel.holes.rb2Rank) return `RB pressure showed up with RB2 at ${intel.holes.rb2Rank}.`;
  if (normalized === 'WR' && intel.holes.wr3Rank) return `WR pressure showed up with WR3 at ${intel.holes.wr3Rank}.`;
  if (normalized === 'TE' && intel.holes.te1Rank) return `TE pressure showed up with TE1 at ${intel.holes.te1Rank}.`;
  if (intel.holes.flexDepth <= 5 && (normalized === 'RB' || normalized === 'WR')) {
    return `Flex depth was light with ${intel.holes.flexDepth} usable pieces.`;
  }
  return `${normalized} was part of the roster pressure profile.`;
}

function buildDraftAlternative(
  pick: DraftPick,
  bestAvailable: DraftPick | null,
  bestSamePositionAvailable: DraftPick | null,
  bestNeedAvailable: DraftPick | null,
  needMatch: boolean,
  primaryNeed: string | null,
  bestAvailableDelta: number,
  samePositionDelta: number,
  needAlternativeDelta: number,
  hasTrueNeedAlternative: boolean
): DraftDecisionAudit['alternative'] {
  const selectedAlternative = !needMatch && hasTrueNeedAlternative && bestNeedAvailable && needAlternativeDelta >= -450
    ? bestNeedAvailable
    : bestSamePositionAvailable && samePositionDelta > 250
      ? bestSamePositionAvailable
      : bestAvailableDelta > 550
        ? bestAvailable
        : null;

  if (!selectedAlternative) {
    return {
      label: 'Read:',
      playerName: needMatch ? 'Need and board were aligned enough.' : 'No obvious better fit from the drafted players still available.',
    };
  }

  const label = selectedAlternative === bestNeedAvailable && primaryNeed && hasTrueNeedAlternative
    ? `Cleaner ${primaryNeed} target:`
    : selectedAlternative === bestSamePositionAvailable && samePositionDelta > 250
      ? 'Higher-value same-position play:'
    : primaryNeed && !needMatch
      ? `Missed value while ${primaryNeed} stayed open:`
      : 'Best board alternative:';

  return {
    label,
    playerName: selectedAlternative.playerName,
    position: selectedAlternative.positionRankMay2025 || selectedAlternative.currentPositionRank || selectedAlternative.playerPos,
    pickLabel: `${selectedAlternative.draftYear || pick.draftYear || ''} #${selectedAlternative.pick}`.trim(),
    playerPos: selectedAlternative.playerPos,
    pick: selectedAlternative,
  };
}

function normalizePosition(position?: string | null): string {
  const normalized = (position || '').trim().toUpperCase();
  if (normalized === 'RDP' || normalized === 'PICK') return '';
  if (normalized.startsWith('QB')) return 'QB';
  if (normalized.startsWith('RB')) return 'RB';
  if (normalized.startsWith('WR')) return 'WR';
  if (normalized.startsWith('TE')) return 'TE';
  return normalized;
}

function getDraftWindowValue(pick: DraftPick): number {
  return pick.ktcValue || pick.currentKtcValue || 0;
}

function parseRankNumber(rank?: string | null): number | null {
  if (!rank) return null;
  const parsed = Number(rank.replace(/\D/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getDraftGroupKey(pick: DraftPick, leagueValueMode: LeagueValueMode): string {
  return `${pick.draftYear || 'Draft'}::${getDraftKind(pick, leagueValueMode)}`;
}

function compareDraftGroupKeys(a: string, b: string): number {
  const yearDiff = Number(getDraftGroupYear(b) || 0) - Number(getDraftGroupYear(a) || 0);
  if (yearDiff !== 0) return yearDiff;
  const kindDiff = getDraftGroupKindOrder(a) - getDraftGroupKindOrder(b);
  if (kindDiff !== 0) return kindDiff;
  return a.localeCompare(b);
}

function getDraftGroupKindOrder(groupKey: string): number {
  const kind = groupKey.split('::')[1];
  if (kind === 'main') return 0;
  if (kind === 'rookie') return 1;
  if (kind === 'startup') return 2;
  return 3;
}

function getDraftGroupYear(groupKey: string): string {
  return groupKey.split('::')[0] || groupKey;
}
