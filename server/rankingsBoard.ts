import { canonicalPlayerNameKey, cleanName, playerNameKeyVariants } from './leagueAnalysis';
import { loadFlockFantasyValueProfiles, type FlockFantasyValue } from './flockFantasy';
import { getDynastyNerdsFormat, loadDynastyNerdsValueProfiles, type DynastyNerdsValue } from './dynastyNerds';
import {
  getCurrentKTCDevyRankingProfiles,
  getCurrentKTCRankingProfiles,
} from './liveKTCScraper';
import type { RankingIdentityDiagnostic, RankingPlayer, RankingProfileOption, RankingsBoard } from '../shared/types';

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
  expert_value_dynastynerds?: number;
  dynastynerds_position_rank?: string | null;
  dynastynerds_rank?: number;
  dynastynerds_format?: string | null;
  fantasypros_season_value?: number;
  value_sources?: string[];
}>;

type PlayerCandidate = {
  playerId: string;
  player: any;
  score: number;
};

type PlayerIdentityLookup = {
  candidatesByKey: Record<string, PlayerCandidate[]>;
};

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

function getDynastyNerdsProfile(option: RankingProfileOption, dynastyNerdsProfiles: Awaited<ReturnType<typeof loadDynastyNerdsValueProfiles>>) {
  const format = getDynastyNerdsFormat({
    numQbs: option.qbFormat === 'sf' ? 2 : 1,
    ppr: 1,
    tep: option.tep,
  });
  return dynastyNerdsProfiles[format] || dynastyNerdsProfiles.PPR || {};
}

function getCandidateName(player: any): string {
  return player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim();
}

function getCandidatePosition(player: any): string | null {
  const position = String(player?.position || '').toUpperCase();
  const fantasyPositions = Array.isArray(player?.fantasy_positions)
    ? player.fantasy_positions.map((item: unknown) => String(item).toUpperCase())
    : [];
  if (['QB', 'RB', 'WR', 'TE'].includes(position)) return position;
  return fantasyPositions.find((item: string) => ['QB', 'RB', 'WR', 'TE'].includes(item)) || position || null;
}

function scorePlayerCandidate(player: any): number {
  const position = getCandidatePosition(player);
  const isFantasyPosition = ['QB', 'RB', 'WR', 'TE'].includes(position || '');
  const searchRank = Number(player?.search_rank || 9999);
  return (
    (isFantasyPosition ? 1000 : -1000)
    + (player?.active ? 120 : 0)
    + (player?.team ? 80 : 0)
    + (Number.isFinite(searchRank) ? Math.max(0, 120 - searchRank) : 0)
  );
}

function buildPlayerIdentityLookup(players: PlayerMap): PlayerIdentityLookup {
  const candidatesByKey: Record<string, PlayerCandidate[]> = {};

  for (const [playerId, player] of Object.entries(players || {})) {
    const name = getCandidateName(player);
    if (!name) continue;

    for (const key of playerNameKeyVariants(name)) {
      candidatesByKey[key] = candidatesByKey[key] || [];
      candidatesByKey[key].push({
        playerId,
        player,
        score: scorePlayerCandidate(player),
      });
    }
  }

  for (const key of Object.keys(candidatesByKey)) {
    candidatesByKey[key].sort((a, b) => b.score - a.score);
  }

  return { candidatesByKey };
}

function resolvePlayerIdentity({
  key,
  name,
  position,
  lookup,
  option,
  diagnostics,
}: {
  key: string;
  name: string;
  position: string;
  lookup: PlayerIdentityLookup;
  option: RankingProfileOption;
  diagnostics: Map<string, RankingIdentityDiagnostic>;
}): string | undefined {
  const lookupKeys = Array.from(new Set([
    key,
    cleanName(name),
    canonicalPlayerNameKey(name),
  ].flatMap((item) => playerNameKeyVariants(item))));
  const candidates = lookupKeys.flatMap((lookupKey) => lookup.candidatesByKey[lookupKey] || []);
  const uniqueCandidates = Array.from(
    new Map(candidates.map((candidate) => [candidate.playerId, candidate])).values()
  );
  if (!uniqueCandidates.length) {
    if (!/\d{4}.*(1st|2nd|3rd|4th|5th)/i.test(name)) {
      const id = `${option.key}:${key}:unmatched`;
      diagnostics.set(id, {
        id,
        profileKey: option.key,
        board: option.board,
        playerName: name,
        sourceKey: key,
        status: 'unmatched',
        note: `No Sleeper player matched the ${option.label} ranking source row for ${name}.`,
      });
    }
    return undefined;
  }

  const positionMatched = ['QB', 'RB', 'WR', 'TE'].includes(position)
    ? uniqueCandidates.filter((candidate) => getCandidatePosition(candidate.player) === position)
    : [];
  const orderedCandidates = (positionMatched.length ? positionMatched : uniqueCandidates)
    .sort((a, b) => b.score - a.score);
  const selected = orderedCandidates[0];

  if (uniqueCandidates.length > 1) {
    const id = `${option.key}:${key}:resolved-collision`;
    diagnostics.set(id, {
      id,
      profileKey: option.key,
      board: option.board,
      playerName: name,
      sourceKey: key,
      status: 'resolved-collision',
      selectedPlayerId: selected.playerId,
      selectedPlayerName: getCandidateName(selected.player),
      candidates: uniqueCandidates.slice(0, 4).map((candidate) => ({
        playerId: candidate.playerId,
        name: getCandidateName(candidate.player),
        position: getCandidatePosition(candidate.player),
        team: candidate.player?.team || null,
      })),
      note: `Multiple Sleeper players share this name. The ranking row was linked to ${getCandidateName(selected.player)} (${getCandidatePosition(selected.player) || 'UNK'} ${selected.player?.team || 'FA'}).`,
    });
  }

  return selected.playerId;
}

function canonicalizeRankingMap<T extends { name?: string; ktc_value?: number; dynastyValue?: number }>(
  rows: Record<string, T>
): Record<string, T> {
  const canonicalized: Record<string, T> = {};
  for (const [key, row] of Object.entries(rows || {})) {
    const canonicalKey = canonicalPlayerNameKey(row?.name || key);
    const existing = canonicalized[canonicalKey];
    const value = Number(row?.ktc_value ?? row?.dynastyValue ?? 0);
    const existingValue = Number(existing?.ktc_value ?? existing?.dynastyValue ?? 0);
    if (!existing || value >= existingValue) {
      canonicalized[canonicalKey] = row;
    }
  }
  return canonicalized;
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
  return `${movement > 0 ? '+' : ''}${Math.round(movement).toLocaleString('en-US')}`;
}

function buildRowsForProfile({
  option,
  ktcRows,
  flockRows,
  dynastyNerdsRows,
  ktcValues,
  baselineKtcValues,
  players,
  playerLookup,
  ownerByPlayerId,
  rosterStatusByPlayerId,
  diagnostics,
}: {
  option: RankingProfileOption;
  ktcRows: KtcRankingMap;
  flockRows: Record<string, FlockFantasyValue>;
  dynastyNerdsRows: Record<string, DynastyNerdsValue>;
  ktcValues: KtcValues;
  baselineKtcValues?: KtcValues;
  players: PlayerMap;
  playerLookup: PlayerIdentityLookup;
  ownerByPlayerId: Record<string, string>;
  rosterStatusByPlayerId: Record<string, string>;
  diagnostics: Map<string, RankingIdentityDiagnostic>;
}): RankingPlayer[] {
  const canonicalKtcRows = canonicalizeRankingMap(ktcRows || {});
  const canonicalFlockRows = canonicalizeRankingMap(flockRows || {});
  const canonicalDynastyNerdsRows = canonicalizeRankingMap(dynastyNerdsRows || {});
  const canonicalKtcValues = canonicalizeRankingMap(ktcValues || {});
  const canonicalBaselineValues = canonicalizeRankingMap(baselineKtcValues || {});
  const keys = new Set([
    ...Object.keys(canonicalKtcRows),
    ...Object.keys(canonicalFlockRows),
    ...Object.keys(canonicalDynastyNerdsRows),
    ...(option.board === 'dynasty' ? Object.keys(canonicalKtcValues) : []),
  ]);
  const rows: RankingPlayer[] = [];

  for (const key of Array.from(keys)) {
    const ktc = canonicalKtcRows?.[key];
    const flock = canonicalFlockRows?.[key];
    const dynastyNerds = canonicalDynastyNerdsRows?.[key];
    const blended = canonicalKtcValues[key];
    const name = ktc?.name || dynastyNerds?.name || flock?.name || blended?.name || key;
    const rawPos = normalizePosition(ktc?.position || dynastyNerds?.position || flock?.position, ktc?.position_rank || dynastyNerds?.positionRank || flock?.positionRank);
    const playerId = resolvePlayerIdentity({
      key,
      name,
      position: rawPos,
      lookup: playerLookup,
      option,
      diagnostics,
    });
    const sleeperPlayer = playerId ? players[playerId] : null;
    const pos = normalizePosition(ktc?.position || dynastyNerds?.position || flock?.position || sleeperPlayer?.position, ktc?.position_rank || dynastyNerds?.positionRank || flock?.positionRank);
    const isPick = pos === 'PICK' || /\d{4}.*(1st|2nd|3rd|4th|5th)/i.test(name);
    const ktcValue = ktc?.ktc_value || blended?.market_value_ktc || blended?.ktc_value || null;
    const flockValue = flock?.dynastyValue || null;
    const dynastyNerdsValue = dynastyNerds?.dynastyValue || blended?.expert_value_dynastynerds || null;
    const fantasyCalcValue = blended?.market_value_fantasycalc || null;
    const fantasyProsValue = blended?.fantasypros_season_value || null;
    const value = option.board === 'devy'
      ? weightedAverage([
          { value: ktcValue, weight: 0.50 },
          { value: flockValue, weight: 0.30 },
          { value: dynastyNerdsValue, weight: 0.20 },
        ])
      : weightedAverage([
          { value: ktcValue, weight: 0.35 },
          { value: flockValue, weight: 0.30 },
          { value: dynastyNerdsValue, weight: 0.24 },
          { value: fantasyCalcValue, weight: 0.08 },
          { value: fantasyProsValue, weight: 0.03 },
        ]);

    if (!value) continue;

    const sources = [
      ktcValue ? 'KTC' : null,
      flockValue ? 'Flock' : null,
      dynastyNerdsValue ? 'DynastyNerds' : null,
      fantasyCalcValue && option.board === 'dynasty' ? 'FantasyCalc' : null,
      fantasyProsValue && option.board === 'dynasty' ? 'FantasyPros' : null,
    ].filter(Boolean) as string[];
    const baselineValue = canonicalBaselineValues[key]?.ktc_value || null;
    const movement = baselineValue && value ? value - baselineValue : null;

    rows.push({
      id: `${option.key}:${key}`,
      player_id: playerId,
      name,
      pos,
      team: sleeperPlayer?.team || dynastyNerds?.team || flock?.team || ktc?.team || null,
      college: flock?.college || ktc?.college || null,
      age: Number(sleeperPlayer?.age || dynastyNerds?.age || flock?.age || ktc?.age || 0) || null,
      draftYear: Number(flock?.draftYear || ktc?.draftYear || 0) || null,
      overallRank: Number(ktc?.rank || dynastyNerds?.overallRank || flock?.overallRank || 9999),
      positionRank: normalizeRankPosition(ktc?.position_rank || dynastyNerds?.positionRank, pos) || flock?.positionRank || null,
      value,
      ktcValue,
      flockValue,
      dynastyNerdsValue,
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
      imageUrl: getFlockImageUrl(flock) || dynastyNerds?.imageUrl || null,
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
  baselineKtcValues,
  ownerByPlayerId,
  rosterStatusByPlayerId,
  selectedProfileKey,
  selectedProfileLabel,
}: {
  players: PlayerMap;
  ktcValues: KtcValues;
  baselineKtcValues?: KtcValues;
  ownerByPlayerId: Record<string, string>;
  rosterStatusByPlayerId: Record<string, string>;
  selectedProfileKey?: string | null;
  selectedProfileLabel?: string | null;
}): Promise<RankingsBoard> {
  const [ktcProfiles, ktcDevyProfiles, flockProfiles, dynastyNerdsProfiles] = await Promise.all([
    getCurrentKTCRankingProfiles(false),
    getCurrentKTCDevyRankingProfiles(false),
    loadFlockFantasyValueProfiles(),
    loadDynastyNerdsValueProfiles(),
  ]);
  const playerLookup = buildPlayerIdentityLookup(players);
  const profiles: Record<string, RankingPlayer[]> = {};
  const identityDiagnostics = new Map<string, RankingIdentityDiagnostic>();

  for (const option of RANKING_PROFILE_OPTIONS) {
    const ktcProfileKey = PROFILE_KEY_BY_OPTION[option.key];
    profiles[option.key] = buildRowsForProfile({
      option,
      ktcRows: option.board === 'devy' ? ktcDevyProfiles[ktcProfileKey] : ktcProfiles[ktcProfileKey],
      flockRows: getFlockProfile(option, flockProfiles),
      dynastyNerdsRows: getDynastyNerdsProfile(option, dynastyNerdsProfiles),
      ktcValues,
      baselineKtcValues,
      players,
      playerLookup,
      ownerByPlayerId,
      rosterStatusByPlayerId,
      diagnostics: identityDiagnostics,
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
    identityDiagnostics: Array.from(identityDiagnostics.values()).slice(0, 80),
    dynastySf: profiles.dynasty_sf_ppr || [],
    dynastyOneQb: profiles.dynasty_one_qb_ppr || [],
    devySf: profiles.devy_sf_ppr || [],
    devyOneQb: profiles.devy_one_qb_ppr || [],
  };
}
