import { canonicalPlayerNameKey, cleanName, playerNameKeyVariants } from './leagueAnalysis';
import { loadFlockFantasyValueProfiles, type FlockFantasyValue } from './flockFantasy';
import { getDynastyNerdsFormat, loadDynastyNerdsValueProfiles, type DynastyNerdsValue } from './dynastyNerds';
import { formatDynastySourceWeights, getDynastySourceWeightEntries, getDynastySourceWeights } from './dynastySourceWeights';
import { loadFantasyProsDevyRankings, type FantasyProsDevyRanking } from './fantasyProsDevy';
import { findProspectProfile } from './prospectSource';
import {
  getCurrentKTCDevyRankingProfiles,
  getCurrentKTCRankingProfiles,
} from './liveKTCScraper';
import type { ProspectProfile, RankingIdentityDiagnostic, RankingPlayer, RankingProfileOption, RankingsBoard } from '../shared/types';

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
  expert_value_dynastyprocess?: number;
  benchmark_value_dynastydealer?: number;
  dynastydealer_vote_rating?: number | null;
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
  candidates: PlayerCandidate[];
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

  const candidates = Object.values(candidatesByKey)
    .flat()
    .filter((candidate, index, list) => list.findIndex((item) => item.playerId === candidate.playerId) === index)
    .sort((a, b) => b.score - a.score);

  return { candidatesByKey, candidates };
}

function tokenSet(value: string): Set<string> {
  return new Set(canonicalPlayerNameKey(value).split(/\s+/).filter((token) => token.length > 1));
}

function nameSimilarity(a: string, b: string): number {
  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  if (!aTokens.size || !bTokens.size) return 0;
  const overlap = Array.from(aTokens).filter((token) => bTokens.has(token)).length;
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function resolvePlayerIdentity({
  key,
  name,
  position,
  team,
  college,
  lookup,
  option,
  diagnostics,
}: {
  key: string;
  name: string;
  position: string;
  team?: string | null;
  college?: string | null;
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
  const sourceTeam = team ? String(team).toUpperCase() : '';
  const sourceCollege = college ? canonicalPlayerNameKey(String(college)) : '';
  const contextMatchedNearMatches = !uniqueCandidates.length && ['QB', 'RB', 'WR', 'TE'].includes(position)
    ? lookup.candidates
      .filter((candidate) => getCandidatePosition(candidate.player) === position)
      .filter((candidate) => {
        if (option.board === 'devy') {
          const candidateCollege = canonicalPlayerNameKey(candidate.player?.college || '');
          return Boolean(sourceCollege && candidateCollege && candidateCollege === sourceCollege);
        }
        return Boolean(sourceTeam && candidate.player?.team && String(candidate.player.team).toUpperCase() === sourceTeam);
      })
      .filter((candidate) => nameSimilarity(name, getCandidateName(candidate.player)) >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
    : [];
  const identityCandidates = uniqueCandidates.length ? uniqueCandidates : contextMatchedNearMatches;

  if (!identityCandidates.length) {
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
    ? identityCandidates.filter((candidate) => getCandidatePosition(candidate.player) === position)
    : [];
  const orderedCandidates = (positionMatched.length ? positionMatched : identityCandidates)
    .sort((a, b) => b.score - a.score);
  const selected = orderedCandidates[0];

  if (identityCandidates.length > 1 || contextMatchedNearMatches.length) {
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
      candidates: identityCandidates.slice(0, 4).map((candidate) => ({
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

function sanitizeCollegeName(value?: string | null): string | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  // Some devy sources expose hometown/location in their "college" slot. Do not
  // let city/state strings override the verified prospect-school profile.
  if (/^[A-Za-z .'-]+,\s*[A-Z]{2}$/i.test(trimmed)) return null;
  if (/^(?:n\/a|none|unknown|fa)$/i.test(trimmed)) return null;
  return trimmed;
}

function getRankingImageUrl({
  option,
  flock,
  dynastyNerds,
  prospectProfile,
}: {
  option: RankingProfileOption;
  flock?: FlockFantasyValue;
  dynastyNerds?: DynastyNerdsValue;
  prospectProfile?: ProspectProfile | null;
}): string | null {
  if (option.board === 'devy') {
    return prospectProfile?.playerImageUrl
      || getFlockImageUrl(flock)
      || dynastyNerds?.imageUrl
      || prospectProfile?.collegeLogoUrl
      || null;
  }

  return getFlockImageUrl(flock) || dynastyNerds?.imageUrl || null;
}

function getMovementDirection(movement?: number | null): RankingPlayer['movementDirection'] {
  if (!movement) return 'flat';
  return movement > 0 ? 'up' : 'down';
}

function getMovementLabel(movement?: number | null): string | null {
  if (!movement) return null;
  return `${movement > 0 ? '+' : ''}${Math.round(movement).toLocaleString('en-US')}`;
}

function getNumericMetadataValue(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

function isCollegeEligibleRankingPlayer({
  isPick,
  prospectProfile,
  sleeperPlayer,
  draftYear,
}: {
  isPick: boolean;
  prospectProfile?: ProspectProfile | null;
  sleeperPlayer?: any;
  draftYear?: number | null;
}): boolean {
  if (isPick) return false;

  const currentYear = new Date().getFullYear();
  const yearsExp = getNumericMetadataValue(sleeperPlayer?.years_exp, sleeperPlayer?.metadata?.years_exp) || 0;
  const rookieYear = getNumericMetadataValue(
    sleeperPlayer?.metadata?.rookie_year,
    sleeperPlayer?.rookie_year,
    draftYear,
  );
  const hasNflTeam = Boolean(sleeperPlayer?.team);
  const prospectYear = getNumericMetadataValue(prospectProfile?.draftYear, draftYear, rookieYear);
  if (yearsExp > 0) return false;
  if (hasNflTeam) return false;
  if (prospectYear && prospectYear <= currentYear) return false;
  if (prospectProfile) return true;

  return Boolean(rookieYear && rookieYear > currentYear && !hasNflTeam && yearsExp === 0);
}

function applyFinalRanks(rows: RankingPlayer[], limit: number): RankingPlayer[] {
  const sortedRows = rows.sort((a, b) => b.value - a.value || a.overallRank - b.overallRank || a.name.localeCompare(b.name));
  const positionCounts: Record<string, number> = {};

  return sortedRows
    .map((row, index) => {
      const pos = row.pos;
      const positionRank = !row.isPick && ['QB', 'RB', 'WR', 'TE'].includes(pos)
        ? `${pos}${(positionCounts[pos] = (positionCounts[pos] || 0) + 1)}`
        : row.isPick
          ? 'PICK'
          : row.positionRank;

      return {
        ...row,
        overallRank: index + 1,
        positionRank,
      };
    })
    .slice(0, limit);
}

function mergeRankingRows(rows: RankingPlayer[]): RankingPlayer[] {
  const merged = new Map<string, RankingPlayer>();
  for (const row of rows) {
    const profileName = row.prospectProfile?.name || row.name;
    const profileYear = row.prospectProfile?.draftYear || row.draftYear || '';
    const key = `${profileYear}:${row.pos}:${canonicalPlayerNameKey(profileName)}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, row);
      continue;
    }
    merged.set(key, {
      ...existing,
      name: existing.prospectProfile?.name || row.prospectProfile?.name || existing.name,
      college: existing.college || row.college,
      collegeLogoUrl: existing.collegeLogoUrl || row.collegeLogoUrl,
      age: existing.age || row.age,
      draftYear: existing.draftYear || row.draftYear,
      overallRank: Math.min(existing.overallRank || 9999, row.overallRank || 9999),
      positionRank: existing.positionRank || row.positionRank,
      value: Math.max(existing.value, row.value),
      ktcValue: existing.ktcValue || row.ktcValue,
      ktcRank: existing.ktcRank || row.ktcRank,
      flockValue: existing.flockValue || row.flockValue,
      flockRank: existing.flockRank || row.flockRank,
      dynastyNerdsValue: existing.dynastyNerdsValue || row.dynastyNerdsValue,
      fantasyProsDevyRank: existing.fantasyProsDevyRank || row.fantasyProsDevyRank,
      fantasyProsDevyPositionRank: existing.fantasyProsDevyPositionRank || row.fantasyProsDevyPositionRank,
      fantasyProsDevyAge: existing.fantasyProsDevyAge || row.fantasyProsDevyAge,
      fantasyProsDevyBestRank: existing.fantasyProsDevyBestRank || row.fantasyProsDevyBestRank,
      fantasyProsDevyWorstRank: existing.fantasyProsDevyWorstRank || row.fantasyProsDevyWorstRank,
      fantasyProsDevyAverageRank: existing.fantasyProsDevyAverageRank || row.fantasyProsDevyAverageRank,
      fantasyProsDevyStdDev: existing.fantasyProsDevyStdDev || row.fantasyProsDevyStdDev,
      projectedRookiePick: existing.projectedRookiePick || row.projectedRookiePick,
      sources: Array.from(new Set([...existing.sources, ...row.sources])),
      sourceCount: Array.from(new Set([...existing.sources, ...row.sources])).length,
      imageUrl: existing.imageUrl || row.imageUrl,
      prospectProfile: (existing.prospectProfile || row.prospectProfile)
        ? {
          ...(row.prospectProfile || {}),
          ...(existing.prospectProfile || {}),
          fantasyProsDevyRank: existing.fantasyProsDevyRank || row.fantasyProsDevyRank || existing.prospectProfile?.fantasyProsDevyRank || row.prospectProfile?.fantasyProsDevyRank || null,
          fantasyProsDevyPositionRank: existing.fantasyProsDevyPositionRank || row.fantasyProsDevyPositionRank || existing.prospectProfile?.fantasyProsDevyPositionRank || row.prospectProfile?.fantasyProsDevyPositionRank || null,
          fantasyProsDevyAge: existing.fantasyProsDevyAge || row.fantasyProsDevyAge || existing.prospectProfile?.fantasyProsDevyAge || row.prospectProfile?.fantasyProsDevyAge || null,
          fantasyProsDevyBestRank: existing.fantasyProsDevyBestRank || row.fantasyProsDevyBestRank || existing.prospectProfile?.fantasyProsDevyBestRank || row.prospectProfile?.fantasyProsDevyBestRank || null,
          fantasyProsDevyWorstRank: existing.fantasyProsDevyWorstRank || row.fantasyProsDevyWorstRank || existing.prospectProfile?.fantasyProsDevyWorstRank || row.prospectProfile?.fantasyProsDevyWorstRank || null,
          fantasyProsDevyAverageRank: existing.fantasyProsDevyAverageRank || row.fantasyProsDevyAverageRank || existing.prospectProfile?.fantasyProsDevyAverageRank || row.prospectProfile?.fantasyProsDevyAverageRank || null,
          fantasyProsDevyStdDev: existing.fantasyProsDevyStdDev || row.fantasyProsDevyStdDev || existing.prospectProfile?.fantasyProsDevyStdDev || row.prospectProfile?.fantasyProsDevyStdDev || null,
          projectedRookiePick: existing.projectedRookiePick || row.projectedRookiePick || existing.prospectProfile?.projectedRookiePick || row.prospectProfile?.projectedRookiePick || null,
        } as ProspectProfile
        : null,
    });
  }
  return Array.from(merged.values());
}

function prepareRankingRows(rows: RankingPlayer[], option: RankingProfileOption, limit: number): RankingPlayer[] {
  return applyFinalRanks(option.board === 'devy' ? mergeRankingRows(rows) : rows, limit);
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
  prospectLookup,
  fantasyProsDevyRows,
  leagueTeamCount,
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
  prospectLookup?: Map<string, ProspectProfile>;
  fantasyProsDevyRows?: Record<string, FantasyProsDevyRanking>;
  leagueTeamCount?: number;
}): RankingPlayer[] {
  const canonicalKtcRows = canonicalizeRankingMap(ktcRows || {});
  const canonicalFlockRows = canonicalizeRankingMap(flockRows || {});
  const canonicalDynastyNerdsRows = option.board === 'devy' ? {} : canonicalizeRankingMap(dynastyNerdsRows || {});
  const canonicalKtcValues = canonicalizeRankingMap(ktcValues || {});
  const canonicalBaselineValues = canonicalizeRankingMap(baselineKtcValues || {});
  const canonicalFantasyProsDevyRows = option.board === 'devy' ? canonicalizeRankingMap(fantasyProsDevyRows || {}) : {};
  const keys = new Set([
    ...Object.keys(canonicalKtcRows),
    ...Object.keys(canonicalFlockRows),
    ...Object.keys(canonicalDynastyNerdsRows),
    ...Object.keys(canonicalFantasyProsDevyRows),
    ...(option.board === 'dynasty' ? Object.keys(canonicalKtcValues) : []),
  ]);
  const rows: RankingPlayer[] = [];

  for (const key of Array.from(keys)) {
    const ktc = canonicalKtcRows?.[key];
    const flock = canonicalFlockRows?.[key];
    const dynastyNerds = canonicalDynastyNerdsRows?.[key];
    const fantasyProsDevy = canonicalFantasyProsDevyRows?.[key];
    const blended = canonicalKtcValues[key];
    const name = ktc?.name || fantasyProsDevy?.name || dynastyNerds?.name || flock?.name || blended?.name || key;
    const rawPos = normalizePosition(ktc?.position || dynastyNerds?.position || flock?.position || fantasyProsDevy?.position, ktc?.position_rank || dynastyNerds?.positionRank || flock?.positionRank || fantasyProsDevy?.positionRank);
    const sourceCollege = sanitizeCollegeName(flock?.college || ktc?.college || null);
    const sourceTeam = dynastyNerds?.team || flock?.team || ktc?.team || null;
    const playerId = resolvePlayerIdentity({
      key,
      name,
      position: rawPos,
      team: sourceTeam,
      college: sourceCollege,
      lookup: playerLookup,
      option,
      diagnostics,
    });
    const sleeperPlayer = playerId ? players[playerId] : null;
    const pos = normalizePosition(ktc?.position || dynastyNerds?.position || flock?.position || fantasyProsDevy?.position || sleeperPlayer?.position, ktc?.position_rank || dynastyNerds?.positionRank || flock?.positionRank || fantasyProsDevy?.positionRank);
    const isPick = pos === 'PICK' || /\d{4}.*(1st|2nd|3rd|4th|5th)/i.test(name);
    const college = sourceCollege || sanitizeCollegeName(sleeperPlayer?.college) || null;
    const draftYear = Number(flock?.draftYear || ktc?.draftYear || sleeperPlayer?.metadata?.rookie_year || 0) || null;
    const prospectProfile = prospectLookup
      ? findProspectProfile(prospectLookup, name, pos, college, draftYear)
      : null;
    if (option.board === 'devy' && !isCollegeEligibleRankingPlayer({ isPick, prospectProfile, sleeperPlayer, draftYear })) {
      continue;
    }
    const ktcValue = ktc?.ktc_value || blended?.market_value_ktc || blended?.ktc_value || null;
    const flockValue = flock?.dynastyValue || null;
    const dynastyNerdsValue = dynastyNerds?.dynastyValue || blended?.expert_value_dynastynerds || null;
    const fantasyCalcValue = blended?.market_value_fantasycalc || null;
    const dynastyProcessValue = option.board === 'dynasty' ? blended?.expert_value_dynastyprocess || null : null;
    const dynastyDealerBenchmark = option.board === 'dynasty' ? blended?.benchmark_value_dynastydealer || null : null;
    const dynastyDealerVoteRating = option.board === 'dynasty' ? blended?.dynastydealer_vote_rating || null : null;
    const sourceWeights = getDynastySourceWeights({
      board: option.board,
      numQbs: option.qbFormat === 'sf' ? 2 : 1,
      ppr: 1,
      tep: option.tep,
    });
    const value = option.board === 'devy'
      ? Math.max(
        1,
        Math.round(
          10000
          - ((fantasyProsDevy?.rank || ktc?.rank || flock?.overallRank || prospectProfile?.overallRank || 9999) - 1) * 30
        )
      )
      : weightedAverage([
      { value: flockValue, weight: sourceWeights.flock },
      { value: dynastyNerdsValue, weight: sourceWeights.dynastyNerds },
      { value: ktcValue, weight: sourceWeights.ktc },
      { value: option.board === 'dynasty' ? fantasyCalcValue : null, weight: sourceWeights.fantasyCalc },
      { value: option.board === 'dynasty' ? dynastyProcessValue : null, weight: sourceWeights.dynastyProcess },
    ]);

    if (!value) continue;

    const sources = [
      ktcValue ? 'KTC' : null,
      flockValue ? 'Flock' : null,
      fantasyProsDevy && option.board === 'devy' ? 'FantasyPros' : null,
      dynastyNerdsValue ? 'DynastyNerds' : null,
      fantasyCalcValue && option.board === 'dynasty' ? 'FantasyCalc' : null,
      dynastyProcessValue && option.board === 'dynasty' ? 'DynastyProcess' : null,
    ].filter(Boolean) as string[];
    const baselineValue = canonicalBaselineValues[key]?.ktc_value || null;
    const movement = baselineValue && value ? value - baselineValue : null;
    const displayCollege = prospectProfile?.college || college;
    const displayImageUrl = getRankingImageUrl({ option, flock, dynastyNerds, prospectProfile });

    rows.push({
      id: `${option.key}:${key}`,
      player_id: playerId,
      name,
      pos,
      team: sleeperPlayer?.team || dynastyNerds?.team || flock?.team || ktc?.team || null,
      college: displayCollege || null,
      collegeLogoUrl: prospectProfile?.collegeLogoUrl || null,
      age: Number(sleeperPlayer?.age || dynastyNerds?.age || flock?.age || ktc?.age || fantasyProsDevy?.age || 0) || null,
      draftYear: draftYear || prospectProfile?.draftYear || null,
      overallRank: Number(fantasyProsDevy?.rank || ktc?.rank || dynastyNerds?.overallRank || flock?.overallRank || prospectProfile?.overallRank || 9999),
      positionRank: normalizeRankPosition(fantasyProsDevy?.positionRank || ktc?.position_rank || dynastyNerds?.positionRank, pos) || flock?.positionRank || null,
      value,
      ktcValue,
      ktcRank: ktc?.rank || null,
      flockValue,
      flockRank: flock?.overallRank || null,
      dynastyNerdsValue,
      fantasyCalcValue,
      dynastyProcessValue,
      dynastyDealerBenchmark,
      dynastyDealerVoteRating,
      fantasyProsDevyRank: fantasyProsDevy?.rank || prospectProfile?.fantasyProsDevyRank || null,
      fantasyProsDevyPositionRank: fantasyProsDevy?.positionRank || prospectProfile?.fantasyProsDevyPositionRank || null,
      fantasyProsDevyAge: fantasyProsDevy?.age || prospectProfile?.fantasyProsDevyAge || null,
      fantasyProsDevyBestRank: fantasyProsDevy?.bestRank || prospectProfile?.fantasyProsDevyBestRank || null,
      fantasyProsDevyWorstRank: fantasyProsDevy?.worstRank || prospectProfile?.fantasyProsDevyWorstRank || null,
      fantasyProsDevyAverageRank: fantasyProsDevy?.averageRank || prospectProfile?.fantasyProsDevyAverageRank || null,
      fantasyProsDevyStdDev: fantasyProsDevy?.stdDev || prospectProfile?.fantasyProsDevyStdDev || null,
      tier: ktc?.tier || flock?.tier || null,
      movement,
      movementLabel: getMovementLabel(movement),
      movementDirection: getMovementDirection(movement),
      owner: playerId ? ownerByPlayerId[playerId] || null : null,
      rosterStatus: playerId ? rosterStatusByPlayerId[playerId] || null : null,
      sources,
      sourceCount: sources.length,
      isDevy: option.board === 'devy',
      isPick,
      imageUrl: displayImageUrl,
      prospectProfile: prospectProfile
        ? {
          ...prospectProfile,
          fantasyProsDevyRank: fantasyProsDevy?.rank || prospectProfile.fantasyProsDevyRank || null,
          fantasyProsDevyPositionRank: fantasyProsDevy?.positionRank || prospectProfile.fantasyProsDevyPositionRank || null,
          fantasyProsDevyAge: fantasyProsDevy?.age || prospectProfile.fantasyProsDevyAge || null,
          fantasyProsDevyBestRank: fantasyProsDevy?.bestRank || prospectProfile.fantasyProsDevyBestRank || null,
          fantasyProsDevyWorstRank: fantasyProsDevy?.worstRank || prospectProfile.fantasyProsDevyWorstRank || null,
          fantasyProsDevyAverageRank: fantasyProsDevy?.averageRank || prospectProfile.fantasyProsDevyAverageRank || null,
          fantasyProsDevyStdDev: fantasyProsDevy?.stdDev || prospectProfile.fantasyProsDevyStdDev || null,
        }
        : fantasyProsDevy
          ? {
            source: 'NFL Draft Buzz',
            draftYear: draftYear || new Date().getFullYear() + 1,
            name,
            position: pos,
            college: displayCollege,
            fantasyProsDevyRank: fantasyProsDevy.rank,
            fantasyProsDevyPositionRank: fantasyProsDevy.positionRank,
            fantasyProsDevyAge: fantasyProsDevy.age,
            fantasyProsDevyBestRank: fantasyProsDevy.bestRank,
            fantasyProsDevyWorstRank: fantasyProsDevy.worstRank,
            fantasyProsDevyAverageRank: fantasyProsDevy.averageRank,
            fantasyProsDevyStdDev: fantasyProsDevy.stdDev,
          }
          : null,
    });
  }

  const rankedRows = prepareRankingRows(rows, option, option.board === 'devy' ? 140 : 520);
  if (option.board !== 'devy') return rankedRows;
  const teamCount = Math.max(1, Number(leagueTeamCount || 12));
  const classCounts: Record<number, number> = {};
  return rankedRows.map((row) => {
    const year = Number(row.draftYear || row.prospectProfile?.draftYear || new Date().getFullYear() + 1);
    const pickIndex = (classCounts[year] = (classCounts[year] || 0) + 1);
    const round = Math.ceil(pickIndex / teamCount);
    const pick = ((pickIndex - 1) % teamCount) + 1;
    const projectedRookiePick = `Projected ${year} ${round}.${String(pick).padStart(2, '0')}`;
    return {
      ...row,
      tier: projectedRookiePick,
      projectedRookiePick,
      prospectProfile: row.prospectProfile ? { ...row.prospectProfile, projectedRookiePick } : row.prospectProfile,
    };
  });
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
  prospectLookup,
  leagueTeamCount,
}: {
  players: PlayerMap;
  ktcValues: KtcValues;
  baselineKtcValues?: KtcValues;
  ownerByPlayerId: Record<string, string>;
  rosterStatusByPlayerId: Record<string, string>;
  selectedProfileKey?: string | null;
  selectedProfileLabel?: string | null;
  prospectLookup?: Map<string, ProspectProfile>;
  leagueTeamCount?: number;
}): Promise<RankingsBoard> {
  const [ktcProfiles, ktcDevyProfiles, flockProfiles, dynastyNerdsProfiles, fantasyProsDevyRows] = await Promise.all([
    getCurrentKTCRankingProfiles(false),
    getCurrentKTCDevyRankingProfiles(false),
    loadFlockFantasyValueProfiles(),
    loadDynastyNerdsValueProfiles(),
    loadFantasyProsDevyRankings(),
  ]);
  const playerLookup = buildPlayerIdentityLookup(players);
  const profiles: Record<string, RankingPlayer[]> = {};
  const sourceWeightProfiles: RankingsBoard['sourceWeightProfiles'] = {};
  const identityDiagnostics = new Map<string, RankingIdentityDiagnostic>();

  for (const option of RANKING_PROFILE_OPTIONS) {
    const ktcProfileKey = PROFILE_KEY_BY_OPTION[option.key];
    const sourceWeights = getDynastySourceWeights({
      board: option.board,
      numQbs: option.qbFormat === 'sf' ? 2 : 1,
      ppr: 1,
      tep: option.tep,
    });
    sourceWeightProfiles[option.key] = {
      label: formatDynastySourceWeights(sourceWeights),
      sources: getDynastySourceWeightEntries(sourceWeights).filter((entry) => entry.weight > 0),
    };
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
      prospectLookup,
      fantasyProsDevyRows,
      leagueTeamCount,
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
    sourceWeightProfiles,
    profiles,
    identityDiagnostics: Array.from(identityDiagnostics.values()).slice(0, 80),
    dynastySf: profiles.dynasty_sf_ppr || [],
    dynastyOneQb: profiles.dynasty_one_qb_ppr || [],
    devySf: profiles.devy_sf_ppr || [],
    devyOneQb: profiles.devy_one_qb_ppr || [],
  };
}
