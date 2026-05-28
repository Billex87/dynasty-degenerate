import type { DraftPick, ManagerDraftStats } from '@shared/types';
import { isFreshRookieMarketRead } from '@/lib/draftDisplay';

export type DraftDecisionTone = 'value' | 'need' | 'watch' | 'win';

export interface DraftDecisionAudit {
  pick: DraftPick;
  verdict: string;
  tone: DraftDecisionTone;
  primaryNeed: string | null;
  boardRankLabel: string;
  summary: string;
  alternative: {
    label: string;
    playerName: string;
    position?: string | null;
    pickLabel?: string;
    playerPos?: string | null;
    pick?: DraftPick | null;
  } | null;
}

export interface ManagerDraftDecisionAudit {
  manager: string;
  managerDisplayName?: string;
  audits: DraftDecisionAudit[];
  totalPicks: number;
  cleanReads: number;
  watchFlags: number;
  needFits: number;
  boardReads: number;
  hits: number;
  misses: number;
  starters: number;
  avgChange: number;
  readout: string;
}

export function sortManagerDraftStatsByEfficiency(stats: ManagerDraftStats[]): ManagerDraftStats[] {
  return [...stats].sort((a, b) => {
    return (
      compareNumbersDesc(getHitRate(a), getHitRate(b))
      || compareNumbersAsc(getMissRate(a), getMissRate(b))
      || compareNumbersDesc(getStarterRate(a), getStarterRate(b))
      || compareNumbersDesc(a.avgKtcGain, b.avgKtcGain)
      || compareNumbersDesc(a.hits, b.hits)
      || compareNumbersDesc(a.totalPicks, b.totalPicks)
      || compareManagerLabels(a.managerDisplayName || a.manager, b.managerDisplayName || b.manager)
    );
  });
}

export function buildManagerDraftDecisionAudits(audits: DraftDecisionAudit[]): ManagerDraftDecisionAudit[] {
  const grouped = audits.reduce<Record<string, DraftDecisionAudit[]>>((acc, audit) => {
    acc[audit.pick.manager] = acc[audit.pick.manager] || [];
    acc[audit.pick.manager].push(audit);
    return acc;
  }, {});

  const rows = Object.entries(grouped).map(([manager, managerAudits]) => {
    const orderedAudits = [...managerAudits].sort((a, b) => {
      const yearDiff = Number(b.pick.draftYear || 0) - Number(a.pick.draftYear || 0);
      if (yearDiff !== 0) return yearDiff;
      return a.pick.pick - b.pick.pick;
    });
    const watchFlags = orderedAudits.filter((audit) => audit.tone === 'watch').length;
    const needFits = orderedAudits.filter((audit) => audit.verdict === 'Need + Value' || audit.verdict === 'Need Fit').length;
    const boardReads = orderedAudits.filter((audit) => audit.verdict === 'Board Pick' || audit.tone === 'value' || audit.tone === 'win').length;
    const hits = orderedAudits.filter((audit) => getResolvedDraftOutcome(audit.pick) === 'hit').length;
    const misses = orderedAudits.filter((audit) => getResolvedDraftOutcome(audit.pick) === 'miss').length;
    const starters = orderedAudits.filter((audit) => getResolvedDraftStarter(audit.pick)).length;
    const avgChange = Math.round(orderedAudits.reduce((sum, audit) => sum + (audit.pick.valueGain || 0), 0) / Math.max(orderedAudits.length, 1));

    return {
      manager,
      managerDisplayName: orderedAudits[0]?.pick.managerDisplayName,
      audits: orderedAudits,
      totalPicks: orderedAudits.length,
      cleanReads: orderedAudits.length - watchFlags,
      watchFlags,
      needFits,
      boardReads,
      hits,
      misses,
      starters,
      avgChange,
      readout: buildManagerDraftDecisionReadout(orderedAudits),
    };
  });

  return sortManagerDraftDecisionAuditsByPickVolume(rows);
}

function sortManagerDraftDecisionAuditsByPickVolume(rows: ManagerDraftDecisionAudit[]): ManagerDraftDecisionAudit[] {
  return [...rows].sort((a, b) => {
    return (
      compareNumbersDesc(a.totalPicks, b.totalPicks)
      || compareManagerLabels(a.managerDisplayName || a.manager, b.managerDisplayName || b.manager)
    );
  });
}

export function getBestDecisionMaker(rows: ManagerDraftDecisionAudit[]): ManagerDraftDecisionAudit | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    return (
      compareNumbersDesc(getDecisionQualityScore(a), getDecisionQualityScore(b))
      || compareNumbersAsc(getWatchFlagRate(a), getWatchFlagRate(b))
      || compareNumbersDesc(a.avgChange, b.avgChange)
      || compareNumbersDesc(a.totalPicks, b.totalPicks)
      || compareManagerLabels(a.managerDisplayName || a.manager, b.managerDisplayName || b.manager)
    );
  })[0] || null;
}

export function getWorstDecisionMaker(rows: ManagerDraftDecisionAudit[]): ManagerDraftDecisionAudit | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    return (
      compareNumbersDesc(getDecisionConcernScore(a), getDecisionConcernScore(b))
      || compareNumbersDesc(getWatchFlagRate(a), getWatchFlagRate(b))
      || compareNumbersDesc(a.watchFlags, b.watchFlags)
      || compareNumbersAsc(a.avgChange, b.avgChange)
      || compareNumbersDesc(a.totalPicks, b.totalPicks)
      || compareManagerLabels(a.managerDisplayName || a.manager, b.managerDisplayName || b.manager)
    );
  })[0] || null;
}

function getDecisionQualityScore(row: ManagerDraftDecisionAudit): number {
  const totalPicks = Math.max(row.totalPicks, 1);
  const cleanRate = row.cleanReads / totalPicks;
  const boardRate = row.boardReads / totalPicks;
  const hitRate = row.hits / totalPicks;
  const missRate = row.misses / totalPicks;
  const valueScore = clampNumber(row.avgChange / 300, -14, 14);

  return (cleanRate * 100) + (boardRate * 26) + (hitRate * 12) + valueScore - (getWatchFlagRate(row) * 56) - (missRate * 10);
}

function getDecisionConcernScore(row: ManagerDraftDecisionAudit): number {
  const totalPicks = Math.max(row.totalPicks, 1);
  const missRate = row.misses / totalPicks;
  const valueConcern = clampNumber(-row.avgChange / 260, -12, 18);

  return (getWatchFlagRate(row) * 100) + (missRate * 28) + valueConcern - ((row.cleanReads / totalPicks) * 12);
}

function getWatchFlagRate(row: ManagerDraftDecisionAudit): number {
  return row.totalPicks > 0 ? row.watchFlags / row.totalPicks : 0;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getHitRate(stat: Pick<ManagerDraftStats, 'hits' | 'totalPicks'>): number {
  return stat.totalPicks > 0 ? stat.hits / stat.totalPicks : 0;
}

function getMissRate(stat: Pick<ManagerDraftStats, 'misses' | 'totalPicks'>): number {
  return stat.totalPicks > 0 ? stat.misses / stat.totalPicks : 1;
}

function getStarterRate(stat: Pick<ManagerDraftStats, 'starters' | 'totalPicks'>): number {
  return stat.totalPicks > 0 ? stat.starters / stat.totalPicks : 0;
}

function compareNumbersDesc(a: number, b: number): number {
  return b - a;
}

function compareNumbersAsc(a: number, b: number): number {
  return a - b;
}

function compareManagerLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function buildManagerDraftDecisionReadout(audits: DraftDecisionAudit[]): string {
  const watchAudits = audits.filter((audit) => audit.tone === 'watch');
  const boardReads = audits.filter((audit) => audit.tone === 'value' || audit.tone === 'win');
  const hits = audits.filter((audit) => getResolvedDraftOutcome(audit.pick) === 'hit').length;
  const misses = audits.filter((audit) => getResolvedDraftOutcome(audit.pick) === 'miss').length;

  if (watchAudits.length) {
    const mainFlag = [...watchAudits].sort((a, b) => getDraftDecisionSeverity(b) - getDraftDecisionSeverity(a))[0];
    const alternative = mainFlag.alternative?.pick
      ? ` Best follow-up comp is ${mainFlag.alternative.playerName} at ${mainFlag.alternative.pickLabel}.`
      : '';
    return `${watchAudits.length} pick${watchAudits.length === 1 ? '' : 's'} left value to question. ${mainFlag.pick.playerName} is the headline ${mainFlag.verdict.toLowerCase()}.${alternative}`;
  }

  if (hits || misses) {
    return `Clean value audit: ${boardReads.length}/${audits.length} picks stayed in a strong value lane. Current aged-result check shows ${hits} hit${hits === 1 ? '' : 's'} and ${misses} miss${misses === 1 ? '' : 'es'}.`;
  }

  return `Board-first draft: no major decision flags, and ${boardReads.length}/${audits.length} picks stayed in a clean value pocket. Fresh classes are treated as early reads, not victory laps.`;
}

function getDraftDecisionSeverity(audit: DraftDecisionAudit): number {
  if (audit.verdict === 'Passed Board Value') return 5;
  if (audit.verdict === 'Passed Position Value') return 4;
  if (audit.verdict === 'Preference Pick') return 3;
  if (audit.tone === 'watch') return 2;
  return 1;
}

function getResolvedDraftOutcome(pick: DraftPick): NonNullable<DraftPick['draftOutcome']> {
  if (isFreshRookieMarketRead(pick)) return 'neutral';
  if (pick.draftOutcome) return pick.draftOutcome;
  const rankChange = pick.positionRankChange ? parseInt(pick.positionRankChange, 10) : 0;
  const hasRankChange = Number.isFinite(rankChange) && rankChange !== 0;
  const draftYear = Number(pick.draftYear);
  const isFreshClass = Number.isFinite(draftYear) && draftYear >= new Date().getFullYear();
  const rankThreshold = isFreshClass ? 12 : 8;
  const valueThreshold = isFreshClass ? 1500 : 900;
  const isHit = (hasRankChange && rankChange >= rankThreshold) || (pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain >= valueThreshold);
  const isMiss = (hasRankChange && rankChange <= -rankThreshold) || (pick.valueGain !== null && pick.valueGain !== undefined && pick.valueGain <= -valueThreshold);
  if (isHit && isMiss) return (pick.valueGain || 0) >= 0 ? 'hit' : 'miss';
  if (isHit) return 'hit';
  if (isMiss) return 'miss';
  return 'neutral';
}

function getResolvedDraftStarter(pick: DraftPick): boolean {
  if (typeof pick.isStarter === 'boolean') return pick.isStarter;
  const rank = pick.currentPositionRank || '';
  const position = rank.match(/^[A-Z]+/)?.[0] || pick.playerPos;
  const rankNumber = Number(rank.match(/\d+/)?.[0]);
  const starterThresholds: Record<string, number> = { QB: 24, RB: 36, WR: 48, TE: 18, K: 12, DEF: 12 };
  if (position && Number.isFinite(rankNumber) && rankNumber <= (starterThresholds[position] || 0)) return true;
  return !rank && pick.currentKtcValue !== null && pick.currentKtcValue !== undefined && pick.currentKtcValue > 4000;
}
