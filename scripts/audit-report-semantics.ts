#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { buildAutopilotData } from '../client/src/lib/autopilot/buildAutopilotData.ts';
import type { AutopilotData, AutopilotMode, WeeklyActionPlan, WeeklyRecapRead } from '../client/src/lib/autopilot/types.ts';
import { sanitizeCachedReportData } from '../client/src/lib/reportCacheSanitizer.ts';
import { canonicalPlayerNameKey } from '../server/leagueAnalysis.ts';
import {
  createCachedCommandCenterReport,
  createCachedRedraftNoDraftReport,
  createCachedRedraftReport,
  createCachedRedraftTradeLedgerRegressionReport,
} from '../tests/e2e/fixtures/cachedReports.ts';
import type { ManagerStarterPlayer, RankingPlayer, ReportData } from '../shared/types.ts';

type Severity = 'error' | 'warn';

type Issue = {
  severity: Severity;
  source: string;
  path: string;
  message: string;
  evidence?: string;
};

type ReportSource = {
  source: string;
  reportData: ReportData;
  cacheBacked?: boolean;
};

type PlayerLike = {
  player_id?: string | null;
  id?: string | null;
  name?: string | null;
  playerName?: string | null;
  pos?: string | null;
  position?: string | null;
  currentPositionRank?: string | null;
  seasonPositionRank?: string | null;
  positionRank?: string | null;
  rank?: string | null;
  value?: number | null;
  ktcValue?: number | null;
  seasonValue?: number | null;
  playerDetails?: {
    fullName?: string | null;
    position?: string | null;
    valueProfile?: {
      dynastyPositionRank?: string | null;
      seasonPositionRank?: string | null;
      fantasyProsPositionRank?: string | null;
    };
  } | null;
};

const ENCODING = 'gzip-base64';
const CACHE_DIR = process.env.REPORT_SEMANTIC_AUDIT_DIR || path.join(process.cwd(), '.cache', 'league-reports');
const CACHE_LIMIT = Number.parseInt(process.env.REPORT_SEMANTIC_AUDIT_LIMIT || '40', 10) || 40;
const STRICT_CACHE = process.env.REPORT_SEMANTIC_AUDIT_STRICT_CACHE === 'true';
const POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const BLOCKED_VISIBLE_NAME_KEYS = new Set(['dallenbentley', 'dallasbentley']);

const FALLBACK_AUTOPILOT: Record<AutopilotMode, AutopilotData> = {
  dynasty: {
    mode: 'dynasty',
    headline: 'Audit fallback',
    direction: {
      label: 'Audit',
      confidence: 0,
      summary: 'Audit fallback.',
      strategy: 'Audit fallback.',
      scores: [],
      actionPlan: [],
    },
    systemRead: [],
    lineup: [],
    waivers: [],
    trades: [],
    projections: [],
    power: [],
    scheduleTodo: [],
  },
  redraft: {
    mode: 'redraft',
    headline: 'Audit fallback',
    direction: {
      label: 'Audit',
      confidence: 0,
      summary: 'Audit fallback.',
      strategy: 'Audit fallback.',
      scores: [],
      actionPlan: [],
    },
    systemRead: [],
    lineup: [],
    waivers: [],
    trades: [],
    projections: [],
    power: [],
    scheduleTodo: [],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function cleanName(value?: string | null): string {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function playerName(player?: PlayerLike | null): string {
  return String(player?.name || player?.playerName || player?.playerDetails?.fullName || '').trim();
}

function normalizePosition(position?: string | null): string {
  const raw = String(position || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!raw) return '';
  if (['DST', 'D', 'DEFENSE'].includes(raw)) return 'DEF';
  if (raw === 'PK') return 'K';
  if (['SUPERFLEX', 'QBSF', 'OP'].includes(raw)) return 'SUPER_FLEX';
  if (['WRT', 'WRRBT', 'WRRBTE'].includes(raw)) return 'FLEX';
  return raw;
}

function playerPosition(player?: PlayerLike | null): string {
  return normalizePosition(player?.pos || player?.position || player?.playerDetails?.position);
}

function extractRankPosition(rank?: string | null): string {
  const match = String(rank || '').trim().match(/^([A-Za-z/]+)/);
  return normalizePosition(match?.[1] || '');
}

function rankFields(player: PlayerLike): Array<[string, string | null | undefined]> {
  return [
    ['currentPositionRank', player.currentPositionRank],
    ['seasonPositionRank', player.seasonPositionRank],
    ['positionRank', player.positionRank],
    ['rank', player.rank],
    ['playerDetails.valueProfile.dynastyPositionRank', player.playerDetails?.valueProfile?.dynastyPositionRank],
    ['playerDetails.valueProfile.seasonPositionRank', player.playerDetails?.valueProfile?.seasonPositionRank],
    ['playerDetails.valueProfile.fantasyProsPositionRank', player.playerDetails?.valueProfile?.fantasyProsPositionRank],
  ];
}

function playerKey(player?: PlayerLike | null): string {
  if (!player) return '';
  const id = String(player.player_id || player.id || '').trim();
  if (id) return `id:${id}`;
  const name = playerName(player);
  const position = playerPosition(player);
  return name ? `name:${canonicalPlayerNameKey(name)}:${position}` : '';
}

function issueSeverity(source: ReportSource, severity: Severity): Severity {
  if (source.cacheBacked && severity === 'error' && !STRICT_CACHE) return 'warn';
  return severity;
}

function addIssue(
  issues: Issue[],
  report: ReportSource,
  pathKey: string,
  severity: Severity,
  message: string,
  evidence?: string,
) {
  issues.push({
    severity: issueSeverity(report, severity),
    source: report.source,
    path: pathKey,
    message,
    evidence,
  });
}

function canStartInSlot(position: string, slot: string): boolean {
  const normalizedPosition = normalizePosition(position);
  const normalizedSlot = normalizePosition(slot);
  if (!normalizedPosition || !normalizedSlot) return false;
  if (normalizedSlot === 'FLEX') return ['RB', 'WR', 'TE'].includes(normalizedPosition);
  if (normalizedSlot === 'SUPER_FLEX') return ['QB', 'RB', 'WR', 'TE'].includes(normalizedPosition);
  return normalizedPosition === normalizedSlot;
}

function findManagerRow(reportData: ReportData, manager?: string | null) {
  const normalized = String(manager || '').trim().toLowerCase();
  return reportData.managerPositionCounts?.find((row) => row.manager.trim().toLowerCase() === normalized)
    || reportData.managerPositionCounts?.[0]
    || null;
}

function collectManagerPlayers(row: ReportData['managerPositionCounts'][number] | null | undefined): ManagerStarterPlayer[] {
  if (!row) return [];
  return [
    ...asArray(row.starterPlayers),
    ...asArray(row.lineupPlayers),
    ...asArray(row.rosterPlayers),
    ...asArray(row.starterGroups).flatMap((group) => asArray(group.players)),
  ];
}

function findPlayerInManagerRow(
  row: ReportData['managerPositionCounts'][number] | null | undefined,
  name?: string | null,
): ManagerStarterPlayer | null {
  const target = cleanName(name);
  if (!target) return null;
  return collectManagerPlayers(row).find((player) => cleanName(player.name) === target) || null;
}

function starterSlotsForPlayer(
  row: ReportData['managerPositionCounts'][number] | null | undefined,
  player: ManagerStarterPlayer | null,
): string[] {
  if (!row || !player) return [];
  const targetKey = playerKey(player);
  const slots = new Set<string>();
  asArray(row.starterGroups).forEach((group) => {
    if (asArray(group.players).some((candidate) => playerKey(candidate) === targetKey)) {
      slots.add(group.key);
    }
  });
  return Array.from(slots);
}

function auditRankConsistency(
  issues: Issue[],
  report: ReportSource,
  pathKey: string,
  player: PlayerLike,
) {
  const position = playerPosition(player);
  if (!POSITIONS.has(position)) return;
  for (const [field, rank] of rankFields(player)) {
    const rankPosition = extractRankPosition(rank);
    if (!rankPosition || !POSITIONS.has(rankPosition)) continue;
    if (rankPosition !== position) {
      addIssue(
        issues,
        report,
        `${pathKey}.${field}`,
        'error',
        'Position rank does not match player position.',
        `${playerName(player) || player.player_id || 'Unknown'} is ${position} but has ${rank}`,
      );
    }
  }
}

function auditRankingProfile(
  issues: Issue[],
  report: ReportSource,
  profileKey: string,
  rows: RankingPlayer[],
) {
  const byIdentity = new Map<string, RankingPlayer[]>();
  const byOverallRank = new Map<number, RankingPlayer[]>();
  const byPositionRank = new Map<string, RankingPlayer[]>();

  rows.forEach((row, index) => {
    const pathKey = `rankings.profiles.${profileKey}[${index}]`;
    auditRankConsistency(issues, report, pathKey, row);

    if (Array.isArray(row.sources)) {
      const uniqueSourceCount = new Set(row.sources.filter(Boolean)).size;
      if (Number.isFinite(row.sourceCount) && row.sourceCount !== uniqueSourceCount) {
        addIssue(
          issues,
          report,
          `${pathKey}.sourceCount`,
          'warn',
          'Ranking row sourceCount does not match unique sources.',
          `${row.name}: sourceCount=${row.sourceCount}, sources=${uniqueSourceCount}`,
        );
      }
    }

    if (!row.isPick) {
      const identity = row.player_id
        ? `id:${row.player_id}`
        : `name:${canonicalPlayerNameKey(row.name)}:${normalizePosition(row.pos)}:${row.draftYear || ''}`;
      byIdentity.set(identity, [...(byIdentity.get(identity) || []), row]);
    }

    const overallRank = safeNumber(row.overallRank);
    if (overallRank) byOverallRank.set(overallRank, [...(byOverallRank.get(overallRank) || []), row]);

    const positionRank = String(row.positionRank || '').trim();
    const position = normalizePosition(row.pos);
    if (positionRank && POSITIONS.has(position)) {
      const key = `${position}:${positionRank}`;
      byPositionRank.set(key, [...(byPositionRank.get(key) || []), row]);
    }
  });

  for (const [identity, duplicates] of byIdentity.entries()) {
    if (duplicates.length <= 1) continue;
    const values = duplicates.map((row) => safeNumber(row.value) || 0).filter((value) => value > 0);
    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : 0;
    addIssue(
      issues,
      report,
      `rankings.profiles.${profileKey}`,
      'error',
      'Duplicate player identity appears in one rankings profile.',
      `${identity}: ${duplicates.map((row) => `${row.name} (${row.positionRank || row.pos}, ${row.value})`).join(' | ')}${maxValue - minValue > 250 ? ' with a large value gap' : ''}`,
    );
  }

  for (const [rank, duplicates] of byOverallRank.entries()) {
    if (duplicates.length <= 1) continue;
    addIssue(
      issues,
      report,
      `rankings.profiles.${profileKey}.overallRank.${rank}`,
      'warn',
      'Duplicate overall rank appears in one rankings profile.',
      duplicates.map((row) => row.name).join(', '),
    );
  }

  for (const [rank, duplicates] of byPositionRank.entries()) {
    if (duplicates.length <= 1) continue;
    addIssue(
      issues,
      report,
      `rankings.profiles.${profileKey}.positionRank.${rank}`,
      'warn',
      'Duplicate position rank appears in one rankings profile.',
      duplicates.map((row) => row.name).join(', '),
    );
  }
}

function auditRankings(issues: Issue[], report: ReportSource) {
  const rankings = report.reportData.rankings;
  if (!rankings?.profiles) return;
  Object.entries(rankings.profiles).forEach(([profileKey, rows]) => {
    if (Array.isArray(rows)) auditRankingProfile(issues, report, profileKey, rows);
  });
}

function auditPlayerArrayDuplicates(
  issues: Issue[],
  report: ReportSource,
  pathKey: string,
  players: PlayerLike[] | null | undefined,
) {
  const seen = new Map<string, PlayerLike>();
  asArray(players).forEach((player, index) => {
    auditRankConsistency(issues, report, `${pathKey}[${index}]`, player);
    const key = playerKey(player);
    if (!key) return;
    const previous = seen.get(key);
    if (previous) {
      addIssue(
        issues,
        report,
        pathKey,
        'error',
        'Duplicate player appears in the same visible roster/readout array.',
        `${playerName(previous)} and ${playerName(player)} share ${key}`,
      );
    } else {
      seen.set(key, player);
    }
  });
}

function auditManagerRosterSemantics(issues: Issue[], report: ReportSource) {
  const blockedKeys = omittedNameKeys(report.reportData);

  asArray(report.reportData.managerPositionCounts).forEach((row, rowIndex) => {
    const basePath = `managerPositionCounts[${rowIndex}]`;
    auditPlayerArrayDuplicates(issues, report, `${basePath}.starterPlayers`, row.starterPlayers);
    auditPlayerArrayDuplicates(issues, report, `${basePath}.lineupPlayers`, row.lineupPlayers);
    auditPlayerArrayDuplicates(issues, report, `${basePath}.rosterPlayers`, row.rosterPlayers);

    asArray(row.starterGroups).forEach((group, groupIndex) => {
      const groupPath = `${basePath}.starterGroups[${groupIndex}]`;
      if (safeNumber(group.count) !== null && group.count !== asArray(group.players).length) {
        addIssue(
          issues,
          report,
          `${groupPath}.count`,
          'warn',
          'Starter group count does not match player count.',
          `${row.manager} ${group.key}: count=${group.count}, players=${asArray(group.players).length}`,
        );
      }
      auditPlayerArrayDuplicates(issues, report, `${groupPath}.players`, group.players);
      asArray(group.players).forEach((player, playerIndex) => {
        if (!canStartInSlot(playerPosition(player), group.key)) {
          addIssue(
            issues,
            report,
            `${groupPath}.players[${playerIndex}]`,
            'error',
            'Starter group contains a player who is not eligible for that lineup slot.',
            `${player.name} (${player.pos}) in ${group.key}`,
          );
        }
      });
    });
  });

  asArray(report.reportData.managerRosterIntelligence).forEach((row, index) => {
    const basePath = `managerRosterIntelligence[${index}]`;
    const directPlayers = [
      row.bestBenchStash,
      row.weakestStarter,
      row.oldestPlayer,
      row.youngCorePlayer,
      row.breakoutCandidate,
      row.lastSeasonStud,
      row.buyTarget,
      row.sellCandidate,
      row.tradeChip,
      row.injuryInsurance,
      ...Object.values(row.similarValuePlayers || {}),
      ...asArray(row.tradeBlueprints).flatMap((blueprint) => [blueprint.givePlayer, blueprint.getPlayer]),
      ...asArray(row.tradeableDepth).map((tile) => tile.player),
      ...asArray(row.benchBaseline).map((tile) => tile.player),
    ].filter(Boolean) as PlayerLike[];
    directPlayers.forEach((player, playerIndex) => {
      const pathKey = `${basePath}.featuredPlayers[${playerIndex}]`;
      auditRankConsistency(issues, report, pathKey, player);
      const name = playerName(player);
      if (name && blockedKeys.has(cleanName(name))) {
        addIssue(
          issues,
          report,
          pathKey,
          'error',
          'Omitted or low-trust player leaked into a manager AI read slot.',
          name,
        );
      }
    });
    auditPlayerArrayDuplicates(issues, report, `${basePath}.rosterPlayers`, row.rosterPlayers);
    auditPlayerArrayDuplicates(issues, report, `${basePath}.benchPlayers`, row.benchPlayers);
    auditPlayerArrayDuplicates(issues, report, `${basePath}.taxiPlayers`, row.taxiPlayers);
    auditPlayerArrayDuplicates(issues, report, `${basePath}.reservePlayers`, row.reservePlayers);
    auditPlayerArrayDuplicates(issues, report, `${basePath}.droppablePlayers`, row.droppablePlayers);
  });
}

function omittedNameKeys(reportData: ReportData): Set<string> {
  const keys = new Set(BLOCKED_VISIBLE_NAME_KEYS);
  asArray(reportData.waiverIntelligence?.omittedCandidates)
    .filter((candidate) => candidate.action === 'omit')
    .forEach((candidate) => keys.add(cleanName(candidate.name)));
  return keys;
}

function auditVisiblePlayerNames(
  issues: Issue[],
  report: ReportSource,
  pathKey: string,
  players: PlayerLike[] | null | undefined,
  blockedKeys: Set<string>,
) {
  asArray(players).forEach((player, index) => {
    const name = playerName(player);
    const key = cleanName(name);
    auditRankConsistency(issues, report, `${pathKey}[${index}]`, player);
    if (key && blockedKeys.has(key)) {
      addIssue(
        issues,
        report,
        `${pathKey}[${index}]`,
        'error',
        'Omitted or low-trust player leaked into a visible recommendation surface.',
        name,
      );
    }
  });
}

function auditVisibleRecommendationNames(issues: Issue[], report: ReportSource, autopilot: AutopilotData) {
  const reportData = report.reportData;
  const blockedKeys = omittedNameKeys(reportData);
  auditVisiblePlayerNames(issues, report, 'weeklyRisers', reportData.weeklyRisers, blockedKeys);
  auditVisiblePlayerNames(issues, report, 'weeklyFallers', reportData.weeklyFallers, blockedKeys);
  auditVisiblePlayerNames(issues, report, 'projectedRisers', reportData.projectedRisers, blockedKeys);
  auditVisiblePlayerNames(issues, report, 'projectedFallers', reportData.projectedFallers, blockedKeys);
  auditVisiblePlayerNames(issues, report, 'trendingAdds', reportData.trendingAdds, blockedKeys);
  auditVisiblePlayerNames(issues, report, 'trendingDrops', reportData.trendingDrops, blockedKeys);
  auditVisiblePlayerNames(issues, report, 'waiverIntelligence.availableTrendingAdds', reportData.waiverIntelligence?.availableTrendingAdds, blockedKeys);
  auditVisiblePlayerNames(issues, report, 'waiverIntelligence.highestKtcAvailable', reportData.waiverIntelligence?.highestKtcAvailable ? [reportData.waiverIntelligence.highestKtcAvailable] : [], blockedKeys);
  auditVisiblePlayerNames(issues, report, 'waiverIntelligence.bestTaxiStashes', reportData.waiverIntelligence?.bestTaxiStashes, blockedKeys);
  auditVisiblePlayerNames(issues, report, 'waiverIntelligence.recentlyDroppedValuable', reportData.waiverIntelligence?.recentlyDroppedValuable, blockedKeys);
  auditVisiblePlayerNames(
    issues,
    report,
    'waiverIntelligence.bestAvailableByPosition',
    Object.values(reportData.waiverIntelligence?.bestAvailableByPosition || {}).filter(Boolean) as PlayerLike[],
    blockedKeys,
  );

  const autopilotPlayers: PlayerLike[] = [
    ...autopilot.lineup.map((row) => ({ name: row.player, position: row.secondary || '' })),
    ...autopilot.waivers.map((row) => ({ name: row.player })),
    ...autopilot.trades.map((row) => ({ name: row.player })),
    ...autopilot.projections.map((row) => ({ name: row.player, position: row.position })),
    ...(autopilot.weeklyPlan?.starterToReview ? [{ name: autopilot.weeklyPlan.starterToReview.player, position: autopilot.weeklyPlan.starterToReview.position }] : []),
    ...asArray(autopilot.weeklyPlan?.options).map((row) => ({ name: row.player, position: row.position })),
    ...asArray(autopilot.weeklyRecap?.startSitCalls).flatMap((row) => [{ name: row.start }, { name: row.sit }]),
  ];
  auditVisiblePlayerNames(issues, report, 'autopilot.visiblePlayers', autopilotPlayers, blockedKeys);
}

function auditStartOptionEligibility(
  issues: Issue[],
  report: ReportSource,
  managerRow: ReportData['managerPositionCounts'][number] | null,
  starterName: string | null | undefined,
  candidateName: string | null | undefined,
  pathKey: string,
) {
  if (!starterName || !candidateName || !managerRow) return;
  const starter = findPlayerInManagerRow(managerRow, starterName);
  const candidate = findPlayerInManagerRow(managerRow, candidateName);

  if (!starter) {
    addIssue(
      issues,
      report,
      pathKey,
      'error',
      'Start-over read references a starter that is not in the manager lineup/roster arrays.',
      starterName,
    );
    return;
  }
  if (!candidate) {
    addIssue(
      issues,
      report,
      pathKey,
      'error',
      'Start-over read references a candidate that is not in the manager lineup/roster arrays.',
      candidateName,
    );
    return;
  }

  const slots = starterSlotsForPlayer(managerRow, starter);
  const eligible = slots.length
    ? slots.some((slot) => canStartInSlot(playerPosition(candidate), slot))
    : playerPosition(starter) === playerPosition(candidate);
  if (!eligible) {
    addIssue(
      issues,
      report,
      pathKey,
      'error',
      'Start-over read suggests a player who is not eligible for the starter slot.',
      slots.length
        ? `Start ${candidate.name} (${candidate.pos}) over ${starter.name} (${starter.pos}) in ${slots.join('/')}`
        : `Start ${candidate.name} (${candidate.pos}) over ${starter.name} (${starter.pos}) without a known flex slot`,
    );
  }
}

function auditWeeklyPlan(
  issues: Issue[],
  report: ReportSource,
  managerRow: ReportData['managerPositionCounts'][number] | null,
  weeklyPlan?: WeeklyActionPlan,
) {
  if (!weeklyPlan?.starterToReview) return;
  weeklyPlan.options.forEach((option, index) => {
    auditStartOptionEligibility(
      issues,
      report,
      managerRow,
      weeklyPlan.starterToReview?.player,
      option.player,
      `autopilot.weeklyPlan.options[${index}]`,
    );
  });
}

function auditWeeklyRecap(
  issues: Issue[],
  report: ReportSource,
  managerRow: ReportData['managerPositionCounts'][number] | null,
  weeklyRecap?: WeeklyRecapRead,
) {
  asArray(weeklyRecap?.startSitCalls).forEach((call, index) => {
    auditStartOptionEligibility(
      issues,
      report,
      managerRow,
      call.sit,
      call.start,
      `autopilot.weeklyRecap.startSitCalls[${index}]`,
    );
  });
}

function auditAutopilotReads(issues: Issue[], report: ReportSource) {
  const mode: AutopilotMode = report.reportData.leagueValueMode === 'redraft' ? 'redraft' : 'dynasty';
  const autopilot = buildAutopilotData({
    reportData: report.reportData,
    mode,
    fallback: FALLBACK_AUTOPILOT[mode],
  });
  const managerRow = findManagerRow(report.reportData, autopilot.focusManager || report.reportData.viewerManager);
  auditVisibleRecommendationNames(issues, report, autopilot);
  auditWeeklyPlan(issues, report, managerRow, autopilot.weeklyPlan);
  auditWeeklyRecap(issues, report, managerRow, autopilot.weeklyRecap);
}

function auditTradeLedger(issues: Issue[], report: ReportSource) {
  asArray(report.reportData.tradeHistory).forEach((row, index) => {
    const teamATotal = safeNumber(row.team_a_total);
    const teamBTotal = safeNumber(row.team_b_total);
    const pointGap = safeNumber(row.point_gap);
    if (teamATotal === null || teamBTotal === null || pointGap === null) return;

    const expectedGap = Math.abs(teamATotal - teamBTotal);
    if (Math.abs(expectedGap - pointGap) > 1) {
      addIssue(
        issues,
        report,
        `tradeHistory[${index}].point_gap`,
        'error',
        'Trade ledger point gap does not match team totals.',
        `${row.team_a}=${teamATotal}, ${row.team_b}=${teamBTotal}, point_gap=${pointGap}`,
      );
    }

    const winners = asArray(row.winners?.length ? row.winners : row.winner ? [row.winner] : []);
    const expectedWinners = expectedGap <= 250
      ? [row.team_a, row.team_b]
      : teamATotal > teamBTotal
        ? [row.team_a]
        : [row.team_b];
    const normalizedWinners = winners.map((winner) => String(winner).toLowerCase()).sort();
    const normalizedExpected = expectedWinners.map((winner) => String(winner).toLowerCase()).sort();
    if (normalizedWinners.join('|') !== normalizedExpected.join('|')) {
      addIssue(
        issues,
        report,
        `tradeHistory[${index}].winners`,
        'error',
        'Trade ledger winner does not match the evaluated team totals.',
        `expected=${expectedWinners.join(', ')}, actual=${winners.join(', ') || 'none'}`,
      );
    }
  });
}

function parseStoredPayload(text: string): unknown {
  const parsed = JSON.parse(text);
  if (parsed?.__ddCacheEncoding === ENCODING && typeof parsed.payload === 'string') {
    return JSON.parse(gunzipSync(Buffer.from(parsed.payload, 'base64')).toString('utf8'));
  }
  return parsed;
}

function extractReportData(payload: unknown): ReportData | null {
  if (isRecord(payload?.reportData)) return payload.reportData as unknown as ReportData;
  if (isRecord(payload) && (Array.isArray(payload.managerPositionCounts) || isRecord(payload.rankings))) {
    return payload as unknown as ReportData;
  }
  return null;
}

async function readCacheReports(): Promise<ReportSource[]> {
  let entries;
  try {
    entries = await fs.readdir(CACHE_DIR, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map(async (entry) => {
        const filePath = path.join(CACHE_DIR, entry.name);
        const stat = await fs.stat(filePath);
        return { filePath, name: entry.name, mtimeMs: stat.mtimeMs };
      }),
  );

  const reports: ReportSource[] = [];
  for (const file of files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, Math.max(0, CACHE_LIMIT))) {
    try {
      const payload = parseStoredPayload(await fs.readFile(file.filePath, 'utf8'));
      const reportData = extractReportData(payload);
      if (reportData) {
        reports.push({
          source: `cache:${file.name}`,
          reportData: sanitizeCachedReportData(reportData),
          cacheBacked: true,
        });
      }
    } catch (error) {
      reports.push({
        source: `cache:${file.name}`,
        reportData: {
          managerRosterValueGrowth: [],
          weeklyRisers: [],
          weeklyFallers: [],
          leagueOverview: [],
          projectedRisers: [],
          projectedFallers: [],
          tradeProfitLeaderboard: [],
          tradeHistory: [],
          positionDepth: [],
          managerPositionCounts: [],
        },
        cacheBacked: true,
      });
      console.warn(`WARN cache:${file.name} could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return reports;
}

function fixtureReports(): ReportSource[] {
  return [
    { source: 'fixture:command-center', reportData: createCachedCommandCenterReport().reportData as ReportData },
    { source: 'fixture:redraft', reportData: createCachedRedraftReport().reportData as ReportData },
    { source: 'fixture:redraft-no-draft', reportData: createCachedRedraftNoDraftReport().reportData as ReportData },
    { source: 'fixture:redraft-trade-ledger', reportData: createCachedRedraftTradeLedgerRegressionReport().reportData as ReportData },
  ];
}

function auditReport(report: ReportSource): Issue[] {
  const issues: Issue[] = [];
  auditRankings(issues, report);
  auditManagerRosterSemantics(issues, report);
  auditTradeLedger(issues, report);
  auditAutopilotReads(issues, report);
  return issues;
}

function printIssues(issues: Issue[]) {
  const maxIssues = Number.parseInt(process.env.REPORT_SEMANTIC_AUDIT_MAX_ISSUES || '120', 10) || 120;
  issues.slice(0, maxIssues).forEach((issue, index) => {
    console.log(`\n${index + 1}. [${issue.severity.toUpperCase()}] ${issue.source} ${issue.path}`);
    console.log(`   ${issue.message}`);
    if (issue.evidence) console.log(`   ${issue.evidence}`);
  });
  if (issues.length > maxIssues) {
    console.log(`\n... ${issues.length - maxIssues} more issue(s) omitted. Increase REPORT_SEMANTIC_AUDIT_MAX_ISSUES to print more.`);
  }
}

async function main() {
  const reports = [...fixtureReports(), ...(await readCacheReports())];
  const issues = reports.flatMap(auditReport);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warn');

  console.log('# Report Semantic Audit');
  console.log(`Reports audited: ${reports.length}`);
  console.log(`Fixture reports: ${reports.filter((report) => !report.cacheBacked).length}`);
  console.log(`Cache reports: ${reports.filter((report) => report.cacheBacked).length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Cache strict mode: ${STRICT_CACHE ? 'on' : 'off'}`);

  if (issues.length) printIssues(issues);
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
