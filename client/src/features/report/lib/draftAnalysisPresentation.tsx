import type { ReactNode } from 'react';

import { PlayerPill } from '@/components/reportPrimitives';
import {
  type DraftDecisionAudit,
  type ManagerDraftDecisionAudit,
  buildManagerDraftDecisionAudits,
  getBestDecisionMaker,
  getWorstDecisionMaker,
} from '@/features/report/lib/draftDecisionAnalytics';
import {
  type DraftOpportunity,
  getDraftPickKey,
} from '@/lib/draftOpportunity';
import {
  getDraftKind,
  getDraftKindLabel,
  isFreshRookieMarketRead,
} from '@/lib/draftDisplay';
import { type DraftPick, type ManagerDraftStats, type LeagueValueMode, type PlayerDetails } from '@shared/types';
import type { PreviewMetric } from '@/components/reportPrimitives';

function formatDraftAge(age?: number | string | null, style: 'short' | 'long' = 'long'): string {
  const numericAge = Number(age);
  if (!Number.isFinite(numericAge) || numericAge <= 0) return '-';
  const ageText = Number.isInteger(numericAge) ? String(numericAge) : numericAge.toFixed(1);
  return style === 'short' ? `${ageText} Y.O.` : `${ageText} Year Old`;
}

function formatDraftAdp(adp?: number | null): string {
  if (typeof adp !== 'number' || !Number.isFinite(adp)) return 'N/A';
  return Number.isInteger(adp) ? String(adp) : adp.toFixed(1);
}

function getDraftCurrentValue(pick: DraftPick, leagueValueMode: LeagueValueMode): number {
  if (leagueValueMode === 'redraft') {
    const seasonValue = pick.currentKtcValue
      ?? pick.playerDetails?.valueProfile?.seasonValue
      ?? pick.playerDetails?.valueProfile?.fantasyProsSeasonValue
      ?? 0;
    return Math.round(seasonValue || 0);
  }
  return Math.round(pick.currentKtcValue || 0);
}

function getPlayerCurrentValue(pick: DraftPick, details: PlayerDetails | undefined, leagueValueMode: LeagueValueMode): number {
  const draftValue = getDraftCurrentValue(pick, leagueValueMode);
  if (draftValue) return draftValue;
  if (leagueValueMode === 'redraft') {
    return Math.round(details?.valueProfile?.seasonValue || details?.valueProfile?.fantasyProsSeasonValue || details?.valueProfile?.fantasyCalcRedraft || 0);
  }
  return Math.round(details?.valueProfile?.dynastyValue || details?.valueProfile?.balancedValue || details?.valueProfile?.marketKtc || 0);
}

function renderDraftPreviewManagerIdentity(
  manager?: string | null,
  displayName?: string | null,
  managerAvatars?: Record<string, string | null>,
): ReactNode {
  if (!manager && !displayName) return '-';
  const label = displayName || manager || '-';
  const avatarUrl = manager ? managerAvatars?.[manager] : null;

  return (
    <span className="analysis-preview-manager-value" title={label}>
      <span className="analysis-preview-manager-avatar" aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <span>{label[0]?.toUpperCase() || '?'}</span>
        )}
      </span>
      <span className="analysis-preview-manager-name">{label}</span>
    </span>
  );
}

function renderDraftPreviewPlayer(pick: DraftPick): ReactNode {
  const details = pick.playerDetails;

  return (
    <PlayerPill
      playerId={pick.player_id}
      playerName={pick.playerName}
      team={details?.team}
      position={details?.position || pick.playerPos}
      className="analysis-preview-player"
    />
  );
}

function getDraftGroupKey(pick: DraftPick, leagueValueMode: LeagueValueMode): string {
  return `${pick.draftYear || 'Draft'}::${getDraftKind(pick, leagueValueMode)}`;
}

function getDraftGroupYear(groupKey: string): string {
  return groupKey.split('::')[0] || groupKey;
}

function getDraftGroupKindOrder(groupKey: string): number {
  const kind = groupKey.split('::')[1];
  if (kind === 'main') return 0;
  if (kind === 'rookie') return 1;
  if (kind === 'startup') return 2;
  return 3;
}

function compareDraftGroupKeys(a: string, b: string): number {
  const yearDiff = Number(getDraftGroupYear(b) || 0) - Number(getDraftGroupYear(a) || 0);
  if (yearDiff !== 0) return yearDiff;
  const kindDiff = getDraftGroupKindOrder(a) - getDraftGroupKindOrder(b);
  if (kindDiff !== 0) return kindDiff;
  return a.localeCompare(b);
}

function getDraftGroupTitle(groupKey: string, picks: DraftPick[], leagueValueMode: LeagueValueMode): string {
  const draftYear = getDraftGroupYear(groupKey);
  const draftKindLabels = Array.from(new Set(
    picks.map((pick) => getDraftKindLabel(getDraftKind(pick, leagueValueMode)))
  ));
  const label = draftKindLabels.length === 1
    ? draftKindLabels[0]
    : 'Drafts';

  return /^\d{4}$/.test(draftYear) ? `${draftYear} ${label}` : label;
}

function getDraftGroupKind(groupKey: string, picks: DraftPick[], leagueValueMode: LeagueValueMode): ReturnType<typeof getDraftKind> {
  const explicitKind = groupKey.split('::')[1] as ReturnType<typeof getDraftKind> | undefined;
  if (explicitKind === 'rookie' || explicitKind === 'startup' || explicitKind === 'main') return explicitKind;
  return picks[0] ? getDraftKind(picks[0], leagueValueMode) : 'rookie';
}

function buildDraftStatsPreviewMetrics(
  stats: ManagerDraftStats[],
  leagueValueMode: LeagueValueMode,
  managerAvatars?: Record<string, string | null>,
): PreviewMetric[] {
  const leader = stats[0];
  if (!leader) return [];
  const hitRate = leader.totalPicks ? `${Math.round((leader.hits / leader.totalPicks) * 100)}%` : '-';
  return [
    {
      label: 'Leader',
      compactLabel: 'Lead',
      value: renderDraftPreviewManagerIdentity(leader.manager, leader.managerDisplayName, managerAvatars),
      tone: 'good',
    },
    { label: leagueValueMode === 'redraft' ? 'Starter Hit Rate' : 'Hit Rate', compactLabel: 'Hit Rate', value: hitRate, tone: 'info' },
  ];
}

function buildDraftDecisionPreviewMetrics(
  audits: ManagerDraftDecisionAudit[],
  managerAvatars?: Record<string, string | null>,
): PreviewMetric[] {
  const bestDecisionMaker = getBestDecisionMaker(audits);
  const worstDecisionMaker = getWorstDecisionMaker(audits);
  return [
    bestDecisionMaker ? {
      label: 'Cleanest Draft Read',
      compactLabel: 'Clean',
      value: renderDraftPreviewManagerIdentity(bestDecisionMaker.manager, bestDecisionMaker.managerDisplayName, managerAvatars),
      tone: 'good',
      className: 'analysis-preview-chip-manager-preview analysis-preview-manager-chip',
    } : null,
    worstDecisionMaker ? {
      label: 'Biggest Audit Flag',
      compactLabel: 'Flag',
      value: renderDraftPreviewManagerIdentity(worstDecisionMaker.manager, worstDecisionMaker.managerDisplayName, managerAvatars),
      tone: worstDecisionMaker.watchFlags ? 'danger' : 'warn',
      className: 'analysis-preview-chip-manager-preview analysis-preview-manager-chip',
    } : null,
  ].filter(Boolean) as PreviewMetric[];
}

function buildDraftYearPreviewMetrics(
  picks: DraftPick[],
  leagueValueMode: LeagueValueMode,
  draftDecisionAudits: DraftDecisionAudit[],
  managerAvatars?: Record<string, string | null>,
): PreviewMetric[] {
  const topGain = [...picks].sort((a, b) => (b.valueGain || 0) - (a.valueGain || 0))[0];
  const biggestMiss = [...picks].sort((a, b) => (a.valueGain || 0) - (b.valueGain || 0))[0];
  const hitCount = picks.filter((pick) => (
    !isFreshRookieMarketRead(pick, leagueValueMode)
    && (pick.draftOutcome === 'hit' || pick.isStarter)
  )).length;
  const yearPickKeys = new Set(picks.map(getDraftPickKey));
  const yearDecisionRows = buildManagerDraftDecisionAudits(
    draftDecisionAudits.filter((audit) => yearPickKeys.has(getDraftPickKey(audit.pick))),
  );
  const bestDecisionMaker = getBestDecisionMaker(yearDecisionRows);
  const worstDecisionMaker = getWorstDecisionMaker(yearDecisionRows);
  const cleanDecisionCount = draftDecisionAudits.filter((audit) => (
    yearPickKeys.has(getDraftPickKey(audit.pick)) && audit.tone !== 'watch'
  )).length;
  const cleanDecisionRate = picks.length ? `${Math.round((cleanDecisionCount / picks.length) * 100)}%` : '-';

  return [
    topGain ? { label: leagueValueMode === 'redraft' ? 'Top Current Gain' : 'Top Gain', compactLabel: 'Gain', value: renderDraftPreviewPlayer(topGain), tone: 'good' } : null,
    biggestMiss && (biggestMiss.valueGain || 0) < 0 ? { label: 'Biggest Miss', compactLabel: 'Miss', value: renderDraftPreviewPlayer(biggestMiss), tone: 'danger' } : null,
    picks.length ? { label: leagueValueMode === 'redraft' ? 'Starter Hit Rate' : 'Hit Rate', compactLabel: 'Hit Rate', value: `${Math.round((hitCount / picks.length) * 100)}%`, tone: 'info' } : null,
    bestDecisionMaker ? {
      label: 'Cleanest Read',
      compactLabel: 'Clean',
      value: renderDraftPreviewManagerIdentity(bestDecisionMaker.manager, bestDecisionMaker.managerDisplayName, managerAvatars),
      tone: 'good',
      className: 'analysis-preview-chip-manager-preview analysis-preview-manager-chip',
    } : null,
    worstDecisionMaker ? {
      label: 'Audit Flag',
      compactLabel: 'Flag',
      value: renderDraftPreviewManagerIdentity(worstDecisionMaker.manager, worstDecisionMaker.managerDisplayName, managerAvatars),
      tone: worstDecisionMaker.watchFlags ? 'danger' : 'warn',
      className: 'analysis-preview-chip-manager-preview analysis-preview-manager-chip',
    } : null,
    picks.length ? { label: 'Clean Reads', compactLabel: 'Clean', value: cleanDecisionRate, tone: cleanDecisionCount === picks.length ? 'good' : 'info' } : null,
  ].filter(Boolean) as PreviewMetric[];
}

function buildDraftOpportunitySummary(
  picks: DraftPick[],
  opportunityByPick: Record<string, DraftOpportunity>,
) {
  const missed = picks
    .flatMap((pick) => {
      const opportunity = opportunityByPick[getDraftPickKey(pick)];
      if (!opportunity || opportunity.type !== 'missed') return [];
      return [{
        ...opportunity,
        draftedPlayerName: pick.playerName,
      }];
    })
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  return {
    missed,
  };
}

export {
  buildDraftDecisionPreviewMetrics,
  buildDraftOpportunitySummary,
  buildDraftStatsPreviewMetrics,
  buildDraftYearPreviewMetrics,
  compareDraftGroupKeys,
  formatDraftAdp,
  formatDraftAge,
  getDraftCurrentValue,
  getDraftGroupKind,
  getDraftGroupKey,
  getDraftGroupKindOrder,
  getDraftGroupTitle,
  getDraftGroupYear,
  getPlayerCurrentValue,
  renderDraftPreviewPlayer,
  renderDraftPreviewManagerIdentity,
};
