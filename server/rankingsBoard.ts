import { cleanName } from './leagueAnalysis';
import { loadFlockFantasyValueProfiles, type FlockFantasyValue } from './flockFantasy';
import {
  getCurrentKTCDevyRankingProfiles,
  getCurrentKTCRankingProfiles,
} from './liveKTCScraper';
import type { RankingPlayer, RankingProfileOption, RankingsBoard } from '../shared/types';

type KtcProfileKey =
  | 'sf_ppr'
  | 'sf_ppr_tep_0_5'
  | 'sf_ppr_tep_1_0'
  | 'sf_ppr_tep_1_5'
  | 'one_qb_ppr'
  | 'one_qb_ppr_tep_0_5'
  | 'one_qb_ppr_tep_1_0'
  | 'one_qb_ppr_tep_1_5';

type KtcRankingMap = Awaited<ReturnType<typeof getCurrentKTCRankingProfiles>>[KtcProfileKey];
type PlayerMap = Record<string, any>;
type KtcValues = Record<string, {
  name: string;
  ktc_value: number;
  true_value?: number;
  dynasty_value?: number;
  redraft_value?: number;
  market_value_ktc?: number;
  market_value_fantasycalc?: number;
  fantasypros_season_value?: number;
  value_sources?: string[];
}>;

const RANKING_PROFILE_OPTIONS: RankingProfileOption[] = [
  { key: 'dynasty_sf_ppr', label: 'Dynasty SF', board: 'dynasty', qbFormat: 'sf', tep: 0 },
  { key: 'dynasty_sf_ppr_tep_0_5', label: 'Dynasty SF 0.5 TEP', board: 'dynasty', qbFormat: 'sf', tep: 0.5 },
  { key: 'dynasty_sf_ppr_tep_1_0', label: 'Dynasty SF 1.0 TEP', board: 'dynasty', qbFormat: 'sf', tep: 1 },
  { key: 'dynasty_sf_ppr_tep_1_5', label: 'Dynasty SF 1.5 TEP', board: 'dynasty', qbFormat: 'sf', tep: 1.5 },
  { key: 'dynasty_one_qb_ppr', label: 'Dynasty 1QB', board: 'dynasty', qbFormat: 'one_qb', tep: 0 },
  { key: 'dynasty_one_qb_ppr_tep_0_5', label: 'Dynasty 1QB 0.5 TEP', board: 'dynasty', qbFormat: 'one_qb', tep: 0.5 },
  { key: 'dynasty_one_qb_ppr_tep_1_0', label: 'Dynasty 1QB 1.0 TEP', board: 'dynasty', qbFormat: 'one_qb', tep: 1 },
  { key: 'dynasty_one_qb_ppr_tep_1_5', label: 'Dynasty 1QB 1.5 TEP', board: 'dynasty', qbFormat: 'one_qb', tep: 1.5 },
  { key: 'devy_sf_ppr', label: 'Devy SF', board: 'devy', qbFormat: 'sf', tep: 0 },
  { key: 'devy_sf_ppr_tep_0_5', label: 'Devy SF 0.5 TEP', board: 'devy', qbFormat: 'sf', tep: 0.5 },
  { key: 'devy_sf_ppr_tep_1_0', label: 'Devy SF 1.0 TEP', board: 'devy', qbFormat: 'sf', tep: 1 },
  { key: 'devy_sf_ppr_tep_1_5', label: 'Devy SF 1.5 TEP', board: 'devy', qbFormat: 'sf', tep: 1.5 },
  { key: 'devy_one_qb_ppr', label: 'Devy 1QB', board: 'devy', qbFormat: 'one_qb', tep: 0 },
  { key: 'devy_one_qb_ppr_tep_0_5', label: 'Devy 1QB 0.5 TEP', board: 'devy', qbFormat: 'one_qb', tep: 0.5 },
  { key: 'devy_one_qb_ppr_tep_1_0', label: 'Devy 1QB 1.0 TEP', board: 'devy', qbFormat: 'one_qb', tep: 1 },
  { key: 'devy_one_qb_ppr_tep_1_5', label: 'Devy 1QB 1.5 TEP', board: 'devy', qbFormat: 'one_qb', tep: 1.5 },
];

const PROFILE_KEY_BY_OPTION: Record<string, KtcProfileKey> = {
  dynasty_sf_ppr: 'sf_ppr',
  dynasty_sf_ppr_tep_0_5: 'sf_ppr_tep_0_5',
  dynasty_sf_ppr_tep_1_0: 'sf_ppr_tep_1_0',
  dynasty_sf_ppr_tep_1_5: 'sf_ppr_tep_1_5',
  dynasty_one_qb_ppr: 'one_qb_ppr',
  dynasty_one_qb_ppr_tep_0_5: 'one_qb_ppr_tep_0_5',
  dynasty_one_qb_ppr_tep_1_0: 'one_qb_ppr_tep_1_0',
  dynasty_one_qb_ppr_tep_1_5: 'one_qb_ppr_tep_1_5',
  devy_sf_ppr: 'sf_ppr',
  devy_sf_ppr_tep_0_5: 'sf_ppr_tep_0_5',
  devy_sf_ppr_tep_1_0: 'sf_ppr_tep_1_0',
  devy_sf_ppr_tep_1_5: 'sf_ppr_tep_1_5',
  devy_one_qb_ppr: 'one_qb_ppr',
  devy_one_qb_ppr_tep_0_5: 'one_qb_ppr_tep_0_5',
  devy_one_qb_ppr_tep_1_0: 'one_qb_ppr_tep_1_0',
  devy_one_qb_ppr_tep_1_5: 'one_qb_ppr_tep_1_5',
};

function getFlockProfile(option: RankingProfileOption, flockProfiles: Awaited<ReturnType<typeof loadFlockFantasyValueProfiles>>) {
  if (option.board === 'devy') {
    return option.qbFormat === 'sf' ? flockProfiles.PROSPECTS_SF : flockProfiles.PROSPECTS;
  }
  return option.qbFormat === 'sf' ? flockProfiles.SUPERFLEX : flockProfiles.ONEQB;
}

function buildPlayerIdByName(players: PlayerMap): Record<string, string> {
  const entries = Object.entries(players || {})
    .map(([playerId, player]) => [
      cleanName(`${player?.first_name || ''} ${player?.last_name || ''}`),
      playerId,
    ] as const)
    .filter(([key]) => Boolean(key));
  return Object.fromEntries(entries);
}

function normalizeRankPosition(rank?: string | null, pos?: string | null): string | null {
  if (rank?.startsWith('RDP')) return 'PICK';
  if (rank) return rank;
  if (pos === 'RDP' || pos === 'PICK') return 'PICK';
  return pos || null;
}

function normalizePosition(pos?: string | null, rank?: string | null): string {
  const normalized = (pos || rank?.match(/^[A-Z]+/)?.[0] || '').toUpperCase();
  if (normalized === 'RDP' || normalized === 'PICK') return 'PICK';
  return ['QB', 'RB', 'WR', 'TE'].includes(normalized) ? normalized : 'PICK';
}

function weightedAverage(values: Array<{ value?: number | null; weight: number }>): number {
  const available = values.filter((item) => Number.isFinite(Number(item.value)) && Number(item.value) > 0);
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;
  return Math.round(available.reduce((sum, item) => sum + Number(item.value || 0) * item.weight, 0) / totalWeight);
}

function getFlockImageUrl(flock?: FlockFantasyValue): string | null {
  if (!flock?.picture) return null;
  if (/^https?:\/\//i.test(flock.picture)) return flock.picture;
  return null;
}

function getMovementDirection(movement?: number | null): RankingPlayer['movementDirection'] {
  if (!movement) return 'flat';
  return movement > 0 ? 'up' : 'down';
}

function getMovementLabel(movement?: number | null): string | null {
  if (!movement) return null;
  return `${movement > 0 ? '+' : ''}${movement}`;
}

function buildRowsForProfile({
  option,
  ktcRows,
  flockRows,
  ktcValues,
  players,
  playerIdByName,
  ownerByPlayerId,
  rosterStatusByPlayerId,
}: {
  option: RankingProfileOption;
  ktcRows: KtcRankingMap;
  flockRows: Record<string, FlockFantasyValue>;
  ktcValues: KtcValues;
  players: PlayerMap;
  playerIdByName: Record<string, string>;
  ownerByPlayerId: Record<string, string>;
  rosterStatusByPlayerId: Record<string, string>;
}): RankingPlayer[] {
  const keys = new Set([...Object.keys(ktcRows || {}), ...Object.keys(flockRows || {})]);
  const rows: RankingPlayer[] = [];

  for (const key of Array.from(keys)) {
    const ktc = ktcRows?.[key];
    const flock = flockRows?.[key];
    const blended = ktcValues[key];
    const name = ktc?.name || flock?.name || blended?.name || key;
    const playerId = playerIdByName[key];
    const sleeperPlayer = playerId ? players[playerId] : null;
    const pos = normalizePosition(ktc?.position || flock?.position || sleeperPlayer?.position, ktc?.position_rank || flock?.positionRank);
    const isPick = pos === 'PICK' || /\d{4}.*(1st|2nd|3rd|4th|5th)/i.test(name);
    const ktcValue = ktc?.ktc_value || blended?.market_value_ktc || blended?.ktc_value || null;
    const flockValue = flock?.dynastyValue || null;
    const fantasyCalcValue = blended?.market_value_fantasycalc || null;
    const fantasyProsValue = blended?.fantasypros_season_value || null;
    const value = option.board === 'devy'
      ? weightedAverage([
          { value: ktcValue, weight: 0.62 },
          { value: flockValue, weight: 0.38 },
        ])
      : weightedAverage([
          { value: ktcValue, weight: 0.45 },
          { value: flockValue, weight: 0.35 },
          { value: fantasyCalcValue, weight: 0.14 },
          { value: fantasyProsValue, weight: 0.06 },
        ]);

    if (!value) continue;

    const sources = [
      ktcValue ? 'KTC' : null,
      flockValue ? 'Flock' : null,
      fantasyCalcValue && option.board === 'dynasty' ? 'FantasyCalc' : null,
      fantasyProsValue && option.board === 'dynasty' ? 'FantasyPros' : null,
    ].filter(Boolean) as string[];
    const movement = flock?.rankDelta ?? ktc?.overall7DayTrend ?? null;

    rows.push({
      id: `${option.key}:${key}`,
      player_id: playerId,
      name,
      pos,
      team: sleeperPlayer?.team || flock?.team || ktc?.team || null,
      college: flock?.college || ktc?.college || null,
      age: Number(sleeperPlayer?.age || flock?.age || ktc?.age || 0) || null,
      draftYear: Number(flock?.draftYear || ktc?.draftYear || 0) || null,
      overallRank: Number(ktc?.rank || flock?.overallRank || 9999),
      positionRank: normalizeRankPosition(ktc?.position_rank, pos) || flock?.positionRank || null,
      value,
      ktcValue,
      flockValue,
      fantasyCalcValue,
      fantasyProsValue,
      seasonValue: blended?.redraft_value || fantasyProsValue,
      tier: ktc?.tier || flock?.tier || null,
      movement,
      movementLabel: getMovementLabel(movement),
      movementDirection: getMovementDirection(movement),
      previousYearPprAverage: flock?.previousYearPprAverage ?? null,
      owner: playerId ? ownerByPlayerId[playerId] || null : null,
      rosterStatus: playerId ? rosterStatusByPlayerId[playerId] || null : null,
      sources,
      sourceCount: sources.length,
      isDevy: option.board === 'devy',
      isPick,
      imageUrl: getFlockImageUrl(flock),
    });
  }

  return rows
    .sort((a, b) => b.value - a.value || a.overallRank - b.overallRank || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, overallRank: index + 1 }))
    .slice(0, option.board === 'devy' ? 140 : 520);
}

function getDefaultProfileKey(profileKey: string | null | undefined, board: 'dynasty' | 'devy'): string {
  const option = RANKING_PROFILE_OPTIONS.find((item) => item.board === board && profileKey?.includes(item.qbFormat === 'sf' ? '_sf_' : '_one_qb_') && (
    item.tep === 1.5 ? profileKey?.includes('tep_1_5')
      : item.tep === 1 ? profileKey?.includes('tep_1_0')
        : item.tep === 0.5 ? profileKey?.includes('tep_0_5')
          : profileKey?.includes('base')
  ));
  if (option) return option.key;
  return board === 'devy' ? 'devy_sf_ppr' : 'dynasty_sf_ppr';
}

export async function buildRankingsBoard({
  players,
  ktcValues,
  ownerByPlayerId,
  rosterStatusByPlayerId,
  selectedProfileKey,
  selectedProfileLabel,
}: {
  players: PlayerMap;
  ktcValues: KtcValues;
  ownerByPlayerId: Record<string, string>;
  rosterStatusByPlayerId: Record<string, string>;
  selectedProfileKey?: string | null;
  selectedProfileLabel?: string | null;
}): Promise<RankingsBoard> {
  const [ktcProfiles, ktcDevyProfiles, flockProfiles] = await Promise.all([
    getCurrentKTCRankingProfiles(false),
    getCurrentKTCDevyRankingProfiles(false),
    loadFlockFantasyValueProfiles(),
  ]);
  const playerIdByName = buildPlayerIdByName(players);
  const profiles: Record<string, RankingPlayer[]> = {};

  for (const option of RANKING_PROFILE_OPTIONS) {
    const ktcProfileKey = PROFILE_KEY_BY_OPTION[option.key];
    profiles[option.key] = buildRowsForProfile({
      option,
      ktcRows: option.board === 'devy' ? ktcDevyProfiles[ktcProfileKey] : ktcProfiles[ktcProfileKey],
      flockRows: getFlockProfile(option, flockProfiles),
      ktcValues,
      players,
      playerIdByName,
      ownerByPlayerId,
      rosterStatusByPlayerId,
    });
  }

  const defaultProfileKey = getDefaultProfileKey(selectedProfileKey, 'dynasty');
  const defaultDevyProfileKey = getDefaultProfileKey(selectedProfileKey, 'devy');

  return {
    generatedAt: new Date().toISOString(),
    selectedProfileKey,
    selectedProfileLabel,
    defaultProfileKey,
    defaultDevyProfileKey,
    profileOptions: RANKING_PROFILE_OPTIONS,
    profiles,
    dynastySf: profiles.dynasty_sf_ppr || [],
    dynastyOneQb: profiles.dynasty_one_qb_ppr || [],
    devySf: profiles.devy_sf_ppr || [],
    devyOneQb: profiles.devy_one_qb_ppr || [],
  };
}
