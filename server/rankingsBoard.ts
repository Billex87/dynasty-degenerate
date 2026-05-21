import { canonicalPlayerNameKey, cleanName, playerNameKeyVariants } from './leagueAnalysis';
import { loadFlockFantasyValueProfiles, type FlockFantasyValue } from './flockFantasy';
import { getDynastyNerdsFormat, loadDynastyNerdsValueProfiles, type DynastyNerdsValue } from './dynastyNerds';
import { formatDynastySourceWeights, getDynastySourceWeightEntries, getDynastySourceWeights } from './dynastySourceWeights';
import { loadFantasyProsDevyRankings, type FantasyProsDevyRanking } from './fantasyProsDevy';
import {
  applyDynastySourceTrust,
  buildDynastySourceDiagnostics,
  calculatePreviousDynastySourceTrust,
  calculateDynastySourceTrust,
  createDynastySourceRows,
  getDynastySourceRowsFromSnapshotValues,
  loadRecentDynastySourceRowsFromLocalSnapshots,
  type DynastySourceRows,
  type DynastySourceTrustMap,
} from './dynastySourceTrust';
import {
  applyProspectSourceTrust,
  buildProspectSourceDiagnostics,
  calculatePreviousProspectSourceTrust,
  calculateProspectSourceTrust,
  createProspectSourceRows,
  formatProspectSourceWeights,
  getProspectSourceWeightEntries,
  loadRecentProspectSourceSnapshots,
  persistProspectSourceSnapshot,
  prospectRankToValue,
  type ProspectSourceRows,
  type ProspectSourceWeights,
} from './prospectSourceTrust';
import { getValueSourceProfileKey } from './valueBlend';
import {
  formatRedraftSourceWeights,
  getRedraftSourceWeightEntries,
  loadRedraftRankingProfiles,
  type RedraftRankingValue,
} from './redraftRankings';
import { findProspectProfile } from './prospectSource';
import {
  getCurrentKTCDevyRankingProfiles,
} from './liveKTCScraper';
import { findNflverseAthleticProfile, type NflversePlayerContext } from './nflversePlayerContext';
import type { DraftBuzzScoreboardEntry, ProspectProfile, RankingIdentityDiagnostic, RankingPlayer, RankingProfileOption, RankingsBoard } from '../shared/types';
import type { DynastySourceWeights } from './dynastySourceWeights';

type KtcProfileKey =
  | 'sf_ppr'
  | 'sf_ppr_tep_0_5'
  | 'sf_ppr_tep_1_0'
  | 'sf_ppr_tep_1_5'
  | 'one_qb_ppr'
  | 'one_qb_ppr_tep_0_5'
  | 'one_qb_ppr_tep_1_0'
  | 'one_qb_ppr_tep_1_5';

type KtcRankingMap = Record<string, {
  name?: string;
  ktc_value?: number;
  position?: string | null;
  position_rank?: string | null;
  rank?: number | null;
  tier?: string | number | null;
  team?: string | null;
  college?: string | null;
  age?: number | null;
  draftYear?: number | null;
}>;
type PlayerMap = Record<string, any>;
type KtcValues = Record<string, {
  name: string;
  ktc_value: number;
  true_value?: number;
  dynasty_value?: number;
  redraft_value?: number;
  market_value_ktc?: number;
  expert_value_fantasypros?: number;
  fantasypros_dynasty_rank?: number | null;
  fantasypros_dynasty_position_rank?: string | null;
  market_value_fantasycalc?: number;
  expert_value_dynastynerds?: number;
  expert_value_fantasynerds?: number;
  fantasynerds_rank?: number;
  fantasynerds_position_rank?: string | null;
  expert_value_dynastyprocess?: number;
  benchmark_value_dynastydealer?: number;
  dynastydealer_vote_rating?: number | null;
  dynastynerds_position_rank?: string | null;
  dynastynerds_rank?: number;
  dynastynerds_format?: string | null;
  fantasypros_season_value?: number;
  fantasypros_rank?: number | null;
  fantasypros_position_rank?: string | null;
  value_sources?: string[];
  rank?: number | null;
  tier?: string | number | null;
  team?: string | null;
  college?: string | null;
  age?: number | null;
  draftYear?: number | null;
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
  { key: 'redraft_ppr', label: 'Redraft PPR', board: 'redraft', qbFormat: 'one_qb', tep: 0, ppr: 1 },
  { key: 'redraft_half_ppr', label: 'Redraft Half PPR', board: 'redraft', qbFormat: 'one_qb', tep: 0, ppr: 0.5 },
  { key: 'redraft_standard', label: 'Redraft Standard', board: 'redraft', qbFormat: 'one_qb', tep: 0, ppr: 0 },
  { key: 'devy_sf_ppr', label: 'Devy SF', board: 'devy', qbFormat: 'sf', tep: 0 },
  { key: 'devy_sf_ppr_tep_0_5', label: 'Devy SF 0.5 TEP', board: 'devy', qbFormat: 'sf', tep: 0.5 },
  { key: 'devy_sf_ppr_tep_1_0', label: 'Devy SF 1.0 TEP', board: 'devy', qbFormat: 'sf', tep: 1 },
  { key: 'devy_sf_ppr_tep_1_5', label: 'Devy SF 1.5 TEP', board: 'devy', qbFormat: 'sf', tep: 1.5 },
  { key: 'devy_one_qb_ppr', label: 'Devy 1QB', board: 'devy', qbFormat: 'one_qb', tep: 0 },
  { key: 'devy_one_qb_ppr_tep_0_5', label: 'Devy 1QB 0.5 TEP', board: 'devy', qbFormat: 'one_qb', tep: 0.5 },
  { key: 'devy_one_qb_ppr_tep_1_0', label: 'Devy 1QB 1.0 TEP', board: 'devy', qbFormat: 'one_qb', tep: 1 },
  { key: 'devy_one_qb_ppr_tep_1_5', label: 'Devy 1QB 1.5 TEP', board: 'devy', qbFormat: 'one_qb', tep: 1.5 },
];

const DRAFT_BUZZ_SCOREBOARD_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

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
  if (option.board === 'redraft') return {};
  if (option.board === 'devy') {
    return (option.qbFormat === 'sf' ? flockProfiles.PROSPECTS_SF : flockProfiles.PROSPECTS) || {};
  }
  return (option.qbFormat === 'sf' ? flockProfiles.SUPERFLEX : flockProfiles.ONEQB) || {};
}

function getDynastyNerdsProfile(option: RankingProfileOption, dynastyNerdsProfiles: Awaited<ReturnType<typeof loadDynastyNerdsValueProfiles>>) {
  if (option.board === 'redraft') return {};
  const format = getDynastyNerdsFormat({
    numQbs: option.qbFormat === 'sf' ? 2 : 1,
    ppr: 1,
    tep: option.tep,
  });
  return dynastyNerdsProfiles[format] || dynastyNerdsProfiles.PPR || {};
}

function getDynastyValueProfileKey(option: RankingProfileOption): string {
  return getValueSourceProfileKey({
    numQbs: option.qbFormat === 'sf' ? 2 : 1,
    ppr: 1,
    tep: option.tep,
  });
}

function buildDynastySourceRowsForProfile({
  ktcRows,
  flockRows,
  dynastyNerdsRows,
  ktcValues,
}: {
  ktcRows: KtcRankingMap;
  flockRows: Record<string, FlockFantasyValue>;
  dynastyNerdsRows: Record<string, DynastyNerdsValue>;
  ktcValues: KtcValues;
}): DynastySourceRows {
  const snapshotRows = getDynastySourceRowsFromSnapshotValues(ktcValues);
  return {
    flock: createDynastySourceRows(flockRows, (row, key) => ({
      name: row.name || key,
      position: row.position || null,
      value: row.dynastyValue || null,
      rank: row.overallRank || null,
    })),
    dynastyNerds: createDynastySourceRows(dynastyNerdsRows, (row, key) => ({
      name: row.name || key,
      position: row.position || null,
      value: row.dynastyValue || null,
      rank: row.overallRank || null,
    })),
    fantasyNerds: snapshotRows.fantasyNerds || {},
    ktc: snapshotRows.ktc && Object.keys(snapshotRows.ktc).length
      ? snapshotRows.ktc
      : createDynastySourceRows(ktcRows, (row, key) => ({
        name: row.name || key,
        position: row.position || row.position_rank?.match(/^[A-Z]+/)?.[0] || null,
        value: row.ktc_value || null,
        rank: row.rank || null,
      })),
    fantasyCalc: snapshotRows.fantasyCalc || {},
    dynastyProcess: snapshotRows.dynastyProcess || {},
  };
}

function getProspectArchiveValue(profile?: ProspectProfile | null): number | null {
  if (!profile) return null;
  const rankValue = prospectRankToValue(profile.overallRank || profile.averageOverallRank || null);
  if (rankValue) return rankValue;
  const rating = Number(profile.rating || 0);
  return Number.isFinite(rating) && rating > 0 ? Math.max(100, Math.min(9000, Math.round(rating * 90))) : null;
}

function buildProspectSourceRowsForProfile({
  ktcRows,
  flockRows,
  fantasyProsDevyRows,
  prospectLookup,
}: {
  ktcRows: KtcRankingMap;
  flockRows: Record<string, FlockFantasyValue>;
  fantasyProsDevyRows?: Record<string, FantasyProsDevyRanking>;
  prospectLookup?: Map<string, ProspectProfile>;
}): ProspectSourceRows {
  const prospectRows = getProspectRowsFromLookup(prospectLookup);
  return {
    fantasyProsDevy: createProspectSourceRows(fantasyProsDevyRows || {}, (row, key) => ({
      name: row.name || key,
      position: row.position || null,
      value: prospectRankToValue(row.rank || null),
      rank: row.rank || null,
    })),
    flock: createProspectSourceRows(flockRows, (row, key) => ({
      name: row.name || key,
      position: row.position || null,
      value: row.dynastyValue || prospectRankToValue(row.overallRank || null),
      rank: row.overallRank || null,
    })),
    ktc: createProspectSourceRows(ktcRows, (row, key) => ({
      name: row.name || key,
      position: row.position || row.position_rank?.match(/^[A-Z]+/)?.[0] || null,
      value: row.ktc_value || prospectRankToValue(row.rank || null),
      rank: row.rank || null,
    })),
    prospectArchive: createProspectSourceRows(prospectRows, (row, key) => ({
      name: row.name || key,
      position: row.position || null,
      value: getProspectArchiveValue(row),
      rank: row.overallRank || row.averageOverallRank || null,
    })),
  };
}

function getCandidateName(player: any): string {
  return player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim();
}

function getCandidatePosition(player: any): string | null {
  const position = String(player?.position || '').toUpperCase();
  const fantasyPositions = Array.isArray(player?.fantasy_positions)
    ? player.fantasy_positions.map((item: unknown) => String(item).toUpperCase())
    : [];
  if (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position)) return position;
  return fantasyPositions.find((item: string) => ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(item)) || position || null;
}

function scorePlayerCandidate(player: any): number {
  const position = getCandidatePosition(player);
  const isFantasyPosition = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position || '');
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

function isDraftPickName(name: string): boolean {
  return /\d{4}.*(1st|2nd|3rd|4th|5th)/i.test(name)
    || /\d{4}\s*pick\s*\d+\.\d+/i.test(name);
}

function getRankingDisplayName(name: string): string {
  return name.replace(/\s*\(\s*duplicate\s*\)\s*/gi, ' ').replace(/\s+/g, ' ').trim() || name;
}

function getDraftBuzzPlayerMatch(profile: ProspectProfile, lookup: PlayerIdentityLookup): PlayerCandidate | null {
  const nameKey = canonicalPlayerNameKey(profile.name);
  if (!nameKey) return null;
  const candidates = lookup.candidatesByKey[nameKey] || [];
  return candidates.find((candidate) => getCandidatePosition(candidate.player) === profile.position) || candidates[0] || null;
}

function buildDraftBuzzScoreboardEntries(
  prospectProfiles: ProspectProfile[] | undefined,
  playerLookup: PlayerIdentityLookup,
  nflversePlayerContext?: NflversePlayerContext
): DraftBuzzScoreboardEntry[] {
  const byKey = new Map<string, DraftBuzzScoreboardEntry>();

  for (const profile of prospectProfiles || []) {
    const rating = Number(profile.rating || 0);
    const position = String(profile.position || '').toUpperCase();
    const draftYear = Number(profile.draftYear || 0);
    const nameKey = canonicalPlayerNameKey(profile.name);
    if (profile.source !== 'NFL Draft Buzz' || !rating || !draftYear || !nameKey || !DRAFT_BUZZ_SCOREBOARD_POSITIONS.has(position)) {
      continue;
    }

    const playerMatch = getDraftBuzzPlayerMatch({ ...profile, position }, playerLookup);
    const matchedPlayer = playerMatch?.player || null;
    const nflTeam = profile.nflTeam || matchedPlayer?.team || null;
    const athleticProfile = nflversePlayerContext
      ? findNflverseAthleticProfile({
        pfrId: matchedPlayer?.metadata?.pfr_id || matchedPlayer?.pfr_id,
        fullName: profile.name,
        position,
        draftYear,
      }, nflversePlayerContext)
      : null;
    const entry: DraftBuzzScoreboardEntry = {
      id: `draftbuzz:${draftYear}:${position}:${nameKey}`,
      player_id: playerMatch?.playerId || null,
      team: matchedPlayer?.team || nflTeam,
      nflTeam,
      age: Number(matchedPlayer?.age || 0) || null,
      draftYear,
      name: profile.name,
      position,
      college: profile.college || null,
      playerImageUrl: profile.playerImageUrl || null,
      collegeLogoUrl: profile.collegeLogoUrl || null,
      rating,
      overallRank: profile.overallRank || null,
      positionRank: profile.positionRank || null,
      averageOverallRank: profile.averageOverallRank || null,
      averagePositionRank: profile.averagePositionRank || null,
      height: profile.height || null,
      weight: profile.weight || null,
      fortyYardDash: profile.fortyYardDash || null,
      role: profile.role || null,
      sourceUrl: profile.sourceUrl || null,
      summary: profile.summary || null,
      athleticProfile,
      prospectProfile: {
        ...profile,
        position,
        rating,
      },
    };

    const existing = byKey.get(entry.id);
    if (!existing || entry.rating > existing.rating || (entry.overallRank || 9999) < (existing.overallRank || 9999)) {
      byKey.set(entry.id, entry);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => (
    b.rating - a.rating
    || (a.overallRank || 9999) - (b.overallRank || 9999)
    || a.draftYear - b.draftYear
    || a.position.localeCompare(b.position)
    || a.name.localeCompare(b.name)
  ));
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
  const contextMatchedNearMatches = !uniqueCandidates.length && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position)
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
    if (position !== 'PICK' && !isDraftPickName(name)) {
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

  const positionMatched = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position)
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

function canonicalizeRankingMap<T extends { name?: string; ktc_value?: number; dynastyValue?: number; value?: number; seasonValue?: number }>(
  rows: Record<string, T>
): Record<string, T> {
  const canonicalized: Record<string, T> = {};
  for (const [key, row] of Object.entries(rows || {})) {
    const canonicalKey = canonicalPlayerNameKey(row?.name || key);
    const existing = canonicalized[canonicalKey];
    const value = Number(row?.ktc_value ?? row?.dynastyValue ?? row?.value ?? row?.seasonValue ?? 0);
    const existingValue = Number(existing?.ktc_value ?? existing?.dynastyValue ?? existing?.value ?? existing?.seasonValue ?? 0);
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
  if (['DST', 'D', 'DEFENSE'].includes(normalized)) return 'DEF';
  return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(normalized) ? normalized : 'PICK';
}

function getSourceRanksForRow({
  option,
  redraft,
  ktc,
  dynastyNerds,
  flock,
  blended,
  fantasyProsDevy,
  prospectProfile,
  pos,
}: {
  option: RankingProfileOption;
  redraft?: RedraftRankingValue;
  ktc?: KtcRankingMap[string];
  dynastyNerds?: PlayerMap[string];
  flock?: PlayerMap[string];
  blended?: KtcValues[string];
  fantasyProsDevy?: FantasyProsDevyRanking;
  prospectProfile?: ProspectProfile | null;
  pos: string;
}): { sourceOverallRank: number; sourcePositionRank: string | null } {
  const sourceOverallRank = option.board === 'devy'
    ? Number(fantasyProsDevy?.rank || ktc?.rank || dynastyNerds?.overallRank || flock?.overallRank || prospectProfile?.overallRank || 9999)
    : option.board === 'redraft'
      ? Number(redraft?.overallRank || blended?.fantasypros_rank || ktc?.rank || dynastyNerds?.overallRank || flock?.overallRank || 9999)
      : Number(ktc?.rank || blended?.fantasypros_dynasty_rank || blended?.fantasypros_rank || dynastyNerds?.overallRank || flock?.overallRank || 9999);

  const sourcePositionRank = normalizeRankPosition(
    option.board === 'devy'
      ? fantasyProsDevy?.positionRank
        || ktc?.position_rank
        || dynastyNerds?.positionRank
        || flock?.positionRank
        || (prospectProfile?.positionRank ? `${pos}${prospectProfile.positionRank}` : null)
      : option.board === 'redraft'
        ? redraft?.positionRank
          || blended?.fantasypros_position_rank
          || ktc?.position_rank
          || dynastyNerds?.positionRank
          || flock?.positionRank
          || null
        : ktc?.position_rank
          || blended?.fantasypros_dynasty_position_rank
          || blended?.fantasynerds_position_rank
          || blended?.fantasypros_position_rank
          || dynastyNerds?.positionRank
          || flock?.positionRank
          || null,
    pos
  );

  return {
    sourceOverallRank,
    sourcePositionRank,
  };
}

function getProspectRowsFromLookup(prospectLookup?: Map<string, ProspectProfile>): Record<string, ProspectProfile> {
  if (!prospectLookup) return {};

  const seenProfiles = new Set<ProspectProfile>();
  const rows: Record<string, ProspectProfile> = {};

  for (const profile of Array.from(prospectLookup.values())) {
    if (!profile || seenProfiles.has(profile)) continue;
    seenProfiles.add(profile);

    const key = canonicalPlayerNameKey(profile.name);
    const position = normalizePosition(profile.position);
    const normalizedProfile = normalizeCollegeProspectProfile(profile);
    if (!normalizedProfile) continue;
    const draftYear = Number(normalizedProfile?.draftYear || 0);
    if (!key || !['QB', 'RB', 'WR', 'TE'].includes(position)) continue;
    if (!draftYear) continue;

    const existing = rows[key];
    if (!existing || (normalizedProfile.overallRank || 9999) < (existing.overallRank || 9999)) {
      rows[key] = normalizedProfile;
    }
  }

  return rows;
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

function getRankMovementDirection(movement?: number | null): RankingPlayer['rankMovementDirection'] {
  if (!movement) return 'flat';
  return movement > 0 ? 'up' : 'down';
}

function getRankMovementLabel(movement?: number | null): string | null {
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

function getCollegeDraftYear(...values: unknown[]): number | null {
  return getNumericMetadataValue(...values);
}

function normalizeCollegeProspectProfile(
  profile?: ProspectProfile | null,
  fallbackDraftYear?: number | null
): ProspectProfile | null {
  if (!profile) return null;

  const draftYear = getCollegeDraftYear(profile.draftYear, fallbackDraftYear);
  if (!draftYear || draftYear === profile.draftYear) return profile;

  return {
    ...profile,
    draftYear,
  };
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
  if (prospectProfile) return Boolean(prospectYear && prospectYear > currentYear);

  return Boolean(rookieYear && rookieYear > currentYear && !hasNflTeam && yearsExp === 0);
}

function getCollegeSourceRank(row: RankingPlayer): number {
  return Number(
    row.sourceOverallRank
    || row.fantasyProsDevyRank
    || row.ktcRank
    || row.flockRank
    || row.prospectProfile?.overallRank
    || row.overallRank
    || 9999
  );
}

function compareRankingRows(a: RankingPlayer, b: RankingPlayer, option: RankingProfileOption): number {
  if (option.board === 'devy') {
    return getCollegeSourceRank(a) - getCollegeSourceRank(b)
      || a.overallRank - b.overallRank
      || a.name.localeCompare(b.name);
  }

  if (option.board === 'redraft') {
    return b.value - a.value || a.overallRank - b.overallRank || a.name.localeCompare(b.name);
  }

  return b.value - a.value || a.overallRank - b.overallRank || a.name.localeCompare(b.name);
}

function applyFinalRanks(rows: RankingPlayer[], option: RankingProfileOption, limit: number): RankingPlayer[] {
  const sortedRows = rows.sort((a, b) => compareRankingRows(a, b, option));
  const positionCounts: Record<string, number> = {};

  return sortedRows
    .map((row, index) => {
      const pos = row.pos;
      const positionRank = !row.isPick && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(pos)
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
      sourceOverallRank: existing.sourceOverallRank || row.sourceOverallRank,
      sourcePositionRank: existing.sourcePositionRank || row.sourcePositionRank,
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
      athleticProfile: existing.athleticProfile || row.athleticProfile || null,
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
  return applyFinalRanks(option.board === 'devy' ? mergeRankingRows(rows) : rows, option, limit);
}

type RankingRowWithBaseline = RankingPlayer & { baselineRankValue?: number | null };

function buildBaselineRankMap(rows: RankingRowWithBaseline[], option: RankingProfileOption, limit: number): Map<string, number> {
  if (option.board === 'redraft') return new Map();
  const comparableRows = (option.board === 'devy' ? mergeRankingRows(rows) : rows) as RankingRowWithBaseline[];
  return new Map(
    comparableRows
      .filter((row) => Number.isFinite(Number(row.baselineRankValue)) && Number(row.baselineRankValue) > 0)
      .sort((a, b) => Number(b.baselineRankValue) - Number(a.baselineRankValue) || a.overallRank - b.overallRank || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((row, index) => [row.id, index + 1])
  );
}

function applyRankMovement(rows: RankingRowWithBaseline[], baselineRankById: Map<string, number>): RankingPlayer[] {
  return rows.map((row) => {
    const previousRank = baselineRankById.get(row.id) || null;
    const rankMovement = previousRank ? previousRank - row.overallRank : null;
    const { baselineRankValue, ...publicRow } = row;
    return {
      ...publicRow,
      rankMovement,
      rankMovementLabel: getRankMovementLabel(rankMovement),
      rankMovementDirection: getRankMovementDirection(rankMovement),
    };
  });
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
  redraftRows,
  dynastySourceWeights,
  prospectSourceWeights,
  leagueTeamCount,
  nflversePlayerContext,
}: {
  option: RankingProfileOption;
  ktcRows: KtcRankingMap;
  flockRows: Record<string, FlockFantasyValue>;
  dynastyNerdsRows: Record<string, DynastyNerdsValue>;
  redraftRows?: Record<string, RedraftRankingValue>;
  dynastySourceWeights?: DynastySourceWeights | null;
  prospectSourceWeights?: ProspectSourceWeights | null;
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
  nflversePlayerContext?: NflversePlayerContext;
}): RankingPlayer[] {
  const canonicalKtcRows = canonicalizeRankingMap(ktcRows || {});
  const canonicalFlockRows = canonicalizeRankingMap(flockRows || {});
  const canonicalDynastyNerdsRows = option.board === 'devy' ? {} : canonicalizeRankingMap(dynastyNerdsRows || {});
  const canonicalKtcValues = canonicalizeRankingMap(ktcValues || {});
  const canonicalBaselineValues = canonicalizeRankingMap(baselineKtcValues || {});
  const canonicalFantasyProsDevyRows = option.board === 'devy' ? canonicalizeRankingMap(fantasyProsDevyRows || {}) : {};
  const canonicalRedraftRows = option.board === 'redraft' ? canonicalizeRankingMap(redraftRows || {}) : {};
  const canonicalProspectRows = option.board === 'devy' ? getProspectRowsFromLookup(prospectLookup) : {};
  const keys = new Set([
    ...Object.keys(canonicalKtcRows),
    ...Object.keys(canonicalFlockRows),
    ...Object.keys(canonicalDynastyNerdsRows),
    ...Object.keys(canonicalFantasyProsDevyRows),
    ...Object.keys(canonicalRedraftRows),
    ...Object.keys(canonicalProspectRows),
    ...(option.board === 'dynasty' ? Object.keys(canonicalKtcValues) : []),
  ]);
  const rows: RankingRowWithBaseline[] = [];

  for (const key of Array.from(keys)) {
    const ktc = canonicalKtcRows?.[key];
    const flock = canonicalFlockRows?.[key];
    const dynastyNerds = canonicalDynastyNerdsRows?.[key];
    const fantasyProsDevy = canonicalFantasyProsDevyRows?.[key];
    const redraft = canonicalRedraftRows?.[key];
    const prospectRow = canonicalProspectRows?.[key];
    const blended = canonicalKtcValues[key];
    const name = redraft?.name || ktc?.name || fantasyProsDevy?.name || dynastyNerds?.name || flock?.name || prospectRow?.name || blended?.name || key;
    const rawPos = normalizePosition(redraft?.position || ktc?.position || dynastyNerds?.position || flock?.position || fantasyProsDevy?.position || prospectRow?.position, redraft?.positionRank || ktc?.position_rank || dynastyNerds?.positionRank || flock?.positionRank || fantasyProsDevy?.positionRank);
    const sourceCollege = sanitizeCollegeName(flock?.college || ktc?.college || prospectRow?.college || null);
    const sourceTeam = redraft?.team || dynastyNerds?.team || flock?.team || ktc?.team || null;
    const playerId = option.board === 'devy'
      ? undefined
      : resolvePlayerIdentity({
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
    const pos = normalizePosition(redraft?.position || ktc?.position || dynastyNerds?.position || flock?.position || fantasyProsDevy?.position || prospectRow?.position || sleeperPlayer?.position, redraft?.positionRank || ktc?.position_rank || dynastyNerds?.positionRank || flock?.positionRank || fantasyProsDevy?.positionRank);
    const hasDraftPickName = isDraftPickName(name);
    const isPick = pos === 'PICK' || hasDraftPickName;
    if (option.board === 'dynasty' && pos === 'PICK' && !hasDraftPickName && !sleeperPlayer) {
      continue;
    }
    if (option.board === 'redraft' && (isPick || !['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(pos))) {
      continue;
    }
    const college = sourceCollege || sanitizeCollegeName(sleeperPlayer?.college) || null;
    const sourceDraftYear = Number(flock?.draftYear || ktc?.draftYear || prospectRow?.draftYear || sleeperPlayer?.metadata?.rookie_year || 0) || null;
    const rawProspectProfile = prospectRow || (prospectLookup
      ? findProspectProfile(prospectLookup, name, pos, college, sourceDraftYear)
      : null);
    const draftYear = option.board === 'devy'
      ? getCollegeDraftYear(rawProspectProfile?.draftYear, sourceDraftYear)
      : sourceDraftYear;
    const prospectProfile = option.board === 'devy'
      ? normalizeCollegeProspectProfile(rawProspectProfile, draftYear)
      : rawProspectProfile;
    if (option.board === 'devy' && !isCollegeEligibleRankingPlayer({ isPick, prospectProfile, sleeperPlayer, draftYear })) {
      continue;
    }
    const ktcValue = option.board === 'redraft' ? null : ktc?.ktc_value || blended?.market_value_ktc || blended?.ktc_value || null;
    const flockValue = option.board === 'redraft' ? null : flock?.dynastyValue || null;
    const fantasyProsDynastyValue = option.board === 'dynasty' ? blended?.expert_value_fantasypros || null : null;
    const dynastyNerdsValue = option.board === 'redraft' ? null : dynastyNerds?.dynastyValue || blended?.expert_value_dynastynerds || null;
    const fantasyNerdsValue = option.board === 'redraft' ? null : blended?.expert_value_fantasynerds || null;
    const fantasyCalcValue = option.board === 'redraft' ? redraft?.fantasyCalcRedraft || blended?.redraft_value || null : blended?.market_value_fantasycalc || null;
    const dynastyProcessValue = option.board === 'dynasty' ? blended?.expert_value_dynastyprocess || null : null;
    const dynastyDealerBenchmark = option.board === 'dynasty' ? blended?.benchmark_value_dynastydealer || null : null;
    const dynastyDealerVoteRating = option.board === 'dynasty' ? blended?.dynastydealer_vote_rating || null : null;
    const sourceWeights = option.board === 'redraft'
      ? null
      : dynastySourceWeights || getDynastySourceWeights({
        board: option.board,
        numQbs: option.qbFormat === 'sf' ? 2 : 1,
        ppr: 1,
        tep: option.tep,
      });
    const value = option.board === 'devy'
      ? weightedAverage([
        { value: ktc?.ktc_value || prospectRankToValue(ktc?.rank || null), weight: prospectSourceWeights?.ktc || 0 },
        { value: flock?.dynastyValue || prospectRankToValue(flock?.overallRank || null), weight: prospectSourceWeights?.flock || 0 },
        { value: prospectRankToValue(fantasyProsDevy?.rank || null), weight: prospectSourceWeights?.fantasyProsDevy || 0 },
        { value: getProspectArchiveValue(prospectProfile), weight: prospectSourceWeights?.prospectArchive || 0 },
      ]) || Math.max(
        1,
        Math.round(
          10000
          - ((fantasyProsDevy?.rank || ktc?.rank || flock?.overallRank || prospectProfile?.overallRank || 9999) - 1) * 30
        )
      )
      : option.board === 'redraft'
        ? Math.round(redraft?.value || blended?.redraft_value || blended?.fantasypros_season_value || 0)
      : weightedAverage([
      { value: flockValue, weight: sourceWeights?.flock || 0 },
      { value: fantasyProsDynastyValue, weight: sourceWeights?.fantasyPros || 0 },
      { value: dynastyNerdsValue, weight: sourceWeights?.dynastyNerds || 0 },
      { value: fantasyNerdsValue, weight: sourceWeights?.fantasyNerds || 0 },
      { value: ktcValue, weight: sourceWeights?.ktc || 0 },
      { value: option.board === 'dynasty' ? fantasyCalcValue : null, weight: sourceWeights?.fantasyCalc || 0 },
      { value: option.board === 'dynasty' ? dynastyProcessValue : null, weight: sourceWeights?.dynastyProcess || 0 },
    ]);

    if (!value) continue;

    const sources = [
      ktcValue ? 'KTC' : null,
      flockValue ? 'Flock' : null,
      fantasyProsDevy && option.board === 'devy' ? 'FantasyPros' : null,
      fantasyProsDynastyValue && option.board === 'dynasty' ? 'FantasyPros Dynasty' : null,
      prospectProfile?.source === 'NFL Draft Buzz' && option.board === 'devy' ? 'NFL Draft Buzz' : null,
      (prospectProfile?.source === 'ESPN' || prospectProfile?.espnId) && option.board === 'devy' ? 'ESPN' : null,
      dynastyNerdsValue ? 'DynastyNerds' : null,
      fantasyNerdsValue ? 'FantasyNerds' : null,
      fantasyCalcValue && option.board === 'dynasty' ? 'FantasyCalc' : null,
      dynastyProcessValue && option.board === 'dynasty' ? 'DynastyProcess' : null,
      ...(option.board === 'redraft' ? redraft?.sources || [] : []),
    ].filter(Boolean) as string[];
    const baselineValue = option.board === 'redraft' ? null : canonicalBaselineValues[key]?.ktc_value || null;
    const movement = baselineValue && value ? value - baselineValue : null;
    const displayCollege = prospectProfile?.college || college;
    const displayImageUrl = getRankingImageUrl({ option, flock, dynastyNerds, prospectProfile });
    const athleticProfile = nflversePlayerContext
      ? findNflverseAthleticProfile({
        pfrId: sleeperPlayer?.metadata?.pfr_id || sleeperPlayer?.pfr_id,
        fullName: prospectProfile?.name || name,
        position: pos,
        draftYear: draftYear || prospectProfile?.draftYear || sleeperPlayer?.metadata?.rookie_year,
      }, nflversePlayerContext)
      : null;
    const { sourceOverallRank, sourcePositionRank } = getSourceRanksForRow({
      option,
      redraft,
      ktc,
      dynastyNerds,
      flock,
      blended,
      fantasyProsDevy,
      prospectProfile,
      pos,
    });

    rows.push({
      id: `${option.key}:${key}`,
      player_id: playerId,
      name: getRankingDisplayName(name),
      pos,
      team: sleeperPlayer?.team || redraft?.team || dynastyNerds?.team || flock?.team || ktc?.team || null,
      college: displayCollege || null,
      collegeLogoUrl: prospectProfile?.collegeLogoUrl || null,
      age: Number(sleeperPlayer?.age || dynastyNerds?.age || flock?.age || ktc?.age || fantasyProsDevy?.age || 0) || null,
      draftYear: draftYear || prospectProfile?.draftYear || null,
      overallRank: sourceOverallRank,
      positionRank: sourcePositionRank,
      sourceOverallRank,
      sourcePositionRank,
      value,
      ktcValue,
      ktcRank: ktc?.rank || null,
      flockValue,
      flockRank: flock?.overallRank || null,
      fantasyProsDynastyValue,
      dynastyNerdsValue,
      fantasyNerdsValue,
      fantasyCalcValue,
      dynastyProcessValue,
      dynastyDealerBenchmark,
      dynastyDealerVoteRating,
      fantasyProsValue: option.board === 'redraft' ? redraft?.fantasyProsSeasonValue || blended?.fantasypros_season_value || null : null,
      redraftAveragePick: redraft?.adp || null,
      redraftProjectedPoints: redraft?.projectedPoints || null,
      redraftSourceRanks: redraft?.sourceRanks || undefined,
      fantasyProsDevyRank: option.board === 'devy' ? fantasyProsDevy?.rank || prospectProfile?.fantasyProsDevyRank || null : null,
      fantasyProsDevyPositionRank: option.board === 'devy' ? fantasyProsDevy?.positionRank || prospectProfile?.fantasyProsDevyPositionRank || null : null,
      fantasyProsDevyAge: option.board === 'devy' ? fantasyProsDevy?.age || prospectProfile?.fantasyProsDevyAge || null : null,
      fantasyProsDevyBestRank: option.board === 'devy' ? fantasyProsDevy?.bestRank || prospectProfile?.fantasyProsDevyBestRank || null : null,
      fantasyProsDevyWorstRank: option.board === 'devy' ? fantasyProsDevy?.worstRank || prospectProfile?.fantasyProsDevyWorstRank || null : null,
      fantasyProsDevyAverageRank: option.board === 'devy' ? fantasyProsDevy?.averageRank || prospectProfile?.fantasyProsDevyAverageRank || null : null,
      fantasyProsDevyStdDev: option.board === 'devy' ? fantasyProsDevy?.stdDev || prospectProfile?.fantasyProsDevyStdDev || null : null,
      seasonValue: option.board === 'redraft' ? value : blended?.redraft_value || null,
      tier: ktc?.tier || flock?.tier || null,
      movement,
      movementLabel: getMovementLabel(movement),
      movementDirection: getMovementDirection(movement),
      baselineRankValue: baselineValue,
      owner: playerId ? ownerByPlayerId[playerId] || null : null,
      rosterStatus: playerId ? rosterStatusByPlayerId[playerId] || null : null,
      sources,
      sourceCount: sources.length,
      isDevy: option.board === 'devy',
      isPick,
      imageUrl: displayImageUrl,
      athleticProfile,
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

  const rankingLimit = option.board === 'devy' ? 140 : 520;
  const baselineRankById = buildBaselineRankMap(rows, option, rankingLimit);
  const rankedRows = applyRankMovement(
    prepareRankingRows(rows, option, rankingLimit) as RankingRowWithBaseline[],
    baselineRankById
  );
  if (option.board !== 'devy') return rankedRows;
  const teamCount = Math.max(1, Number(leagueTeamCount || 12));
  const classCounts: Record<number, number> = {};
  return rankedRows.map((row) => {
    const year = getCollegeDraftYear(row.draftYear, row.prospectProfile?.draftYear) || new Date().getFullYear() + 1;
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

function getDefaultProfileKey(profileKey: string | null | undefined, board: 'dynasty' | 'redraft' | 'devy'): string {
  if (board === 'redraft') {
    const normalizedProfileKey = String(profileKey || '').toLowerCase();
    if (/(?:half|0_5|0\.5)/.test(normalizedProfileKey)) return 'redraft_half_ppr';
    if (/(?:standard|std|non[_-]?ppr|zero[_-]?ppr)/.test(normalizedProfileKey)) return 'redraft_standard';
    return 'redraft_ppr';
  }

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
  prospectProfiles,
  leagueTeamCount,
  nflversePlayerContext,
  sourceMode = 'live',
}: {
  players: PlayerMap;
  ktcValues: KtcValues;
  baselineKtcValues?: KtcValues;
  ownerByPlayerId: Record<string, string>;
  rosterStatusByPlayerId: Record<string, string>;
  selectedProfileKey?: string | null;
  selectedProfileLabel?: string | null;
  prospectLookup?: Map<string, ProspectProfile>;
  prospectProfiles?: ProspectProfile[];
  leagueTeamCount?: number;
  nflversePlayerContext?: NflversePlayerContext;
  sourceMode?: 'live' | 'snapshot';
}): Promise<RankingsBoard> {
  const snapshotOnly = sourceMode === 'snapshot';
  const [ktcDevyProfiles, flockProfiles, dynastyNerdsProfiles, fantasyProsDevyRows, redraftResult] = await Promise.all([
    snapshotOnly ? Promise.resolve({} as Awaited<ReturnType<typeof getCurrentKTCDevyRankingProfiles>>) : getCurrentKTCDevyRankingProfiles(false),
    snapshotOnly ? Promise.resolve({} as Awaited<ReturnType<typeof loadFlockFantasyValueProfiles>>) : loadFlockFantasyValueProfiles(),
    snapshotOnly ? Promise.resolve({} as Awaited<ReturnType<typeof loadDynastyNerdsValueProfiles>>) : loadDynastyNerdsValueProfiles(),
    snapshotOnly ? Promise.resolve({} as Awaited<ReturnType<typeof loadFantasyProsDevyRankings>>) : loadFantasyProsDevyRankings(),
    loadRedraftRankingProfiles({ ktcValues, sourceMode }),
  ]);
  const redraftProfiles = redraftResult.profiles;
  const playerLookup = buildPlayerIdentityLookup(players);
  const profiles: Record<string, RankingPlayer[]> = {};
  const sourceWeightProfiles: RankingsBoard['sourceWeightProfiles'] = {};
  const identityDiagnostics = new Map<string, RankingIdentityDiagnostic>();
  const defaultProfileKey = getDefaultProfileKey(selectedProfileKey, 'dynasty');
  const defaultDevyProfileKey = getDefaultProfileKey(selectedProfileKey, 'devy');
  const defaultRedraftProfileKey = getDefaultProfileKey(selectedProfileKey, 'redraft');
  let dynastySourceDiagnostics: RankingsBoard['dynastySourceDiagnostics'] = [];
  let devySourceDiagnostics: RankingsBoard['devySourceDiagnostics'] = [];

  for (const option of RANKING_PROFILE_OPTIONS) {
    const ktcProfileKey = PROFILE_KEY_BY_OPTION[option.key];
    const flockRows = getFlockProfile(option, flockProfiles);
    const dynastyNerdsRows = getDynastyNerdsProfile(option, dynastyNerdsProfiles);
    let effectiveDynastySourceWeights: DynastySourceWeights | null = null;
    let effectiveProspectSourceWeights: ProspectSourceWeights | null = null;
    let dynastySourceTrust: DynastySourceTrustMap = {};

    if (option.board === 'redraft') {
      sourceWeightProfiles[option.key] = {
        label: formatRedraftSourceWeights(redraftResult.sourceTrust || {}),
        sources: getRedraftSourceWeightEntries(redraftResult.sourceTrust || {}).filter((entry) => entry.weight > 0),
      };
    } else if (option.board === 'devy') {
      const prospectSourceRows = buildProspectSourceRowsForProfile({
        ktcRows: ktcDevyProfiles[ktcProfileKey] || {},
        flockRows,
        fantasyProsDevyRows,
        prospectLookup,
      });
      const prospectSourceTrust = calculateProspectSourceTrust({
        sourceMaps: prospectSourceRows,
      });
      effectiveProspectSourceWeights = applyProspectSourceTrust(undefined, prospectSourceTrust);
      if (option.key === defaultDevyProfileKey) {
        const prospectSourceHistory = await loadRecentProspectSourceSnapshots(option.key);
        const previousProspectSourceTrust = calculatePreviousProspectSourceTrust(prospectSourceHistory);
        devySourceDiagnostics = buildProspectSourceDiagnostics(prospectSourceRows, prospectSourceTrust, previousProspectSourceTrust);
        if (!snapshotOnly) {
          await persistProspectSourceSnapshot({
            profileKey: option.key,
            sources: prospectSourceRows,
            diagnostics: devySourceDiagnostics,
          });
        }
      }
      sourceWeightProfiles[option.key] = {
        label: formatProspectSourceWeights(prospectSourceTrust),
        sources: getProspectSourceWeightEntries(prospectSourceTrust).filter((entry) => entry.weight > 0),
      };
    } else {
      const sourceWeights = getDynastySourceWeights({
        board: option.board,
        numQbs: option.qbFormat === 'sf' ? 2 : 1,
        ppr: 1,
        tep: option.tep,
      });
      if (option.board === 'dynasty') {
        const dynastySourceRows = buildDynastySourceRowsForProfile({
          ktcRows: ktcValues,
          flockRows,
          dynastyNerdsRows,
          ktcValues,
        });
        const dynastySourceHistory = loadRecentDynastySourceRowsFromLocalSnapshots(getDynastyValueProfileKey(option));
        dynastySourceTrust = calculateDynastySourceTrust({
          sourceMaps: dynastySourceRows,
          baseWeights: sourceWeights,
          history: dynastySourceHistory,
        });
        const previousDynastySourceTrust = calculatePreviousDynastySourceTrust({
          baseWeights: sourceWeights,
          history: dynastySourceHistory,
        });
        effectiveDynastySourceWeights = applyDynastySourceTrust(sourceWeights, dynastySourceTrust);
        if (option.key === defaultProfileKey) {
          dynastySourceDiagnostics = buildDynastySourceDiagnostics(dynastySourceRows, dynastySourceTrust, previousDynastySourceTrust);
        }
      }
      sourceWeightProfiles[option.key] = {
        label: formatDynastySourceWeights(sourceWeights, dynastySourceTrust),
        sources: getDynastySourceWeightEntries(sourceWeights, dynastySourceTrust).filter((entry) => entry.weight > 0),
      };
    }
    profiles[option.key] = buildRowsForProfile({
      option,
      ktcRows: option.board === 'devy' ? ktcDevyProfiles[ktcProfileKey] || {} : option.board === 'dynasty' ? ktcValues : {},
      flockRows,
      dynastyNerdsRows,
      redraftRows: option.board === 'redraft' ? redraftProfiles[option.key as keyof typeof redraftProfiles] || {} : {},
      dynastySourceWeights: effectiveDynastySourceWeights,
      prospectSourceWeights: effectiveProspectSourceWeights,
      ktcValues,
      baselineKtcValues,
      players,
      playerLookup,
      ownerByPlayerId,
      rosterStatusByPlayerId,
      diagnostics: identityDiagnostics,
      prospectLookup,
      fantasyProsDevyRows: option.board === 'devy' ? fantasyProsDevyRows : undefined,
      leagueTeamCount,
      nflversePlayerContext,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    selectedProfileKey,
    selectedProfileLabel,
    defaultProfileKey,
    defaultDevyProfileKey,
    defaultRedraftProfileKey,
    profileOptions: RANKING_PROFILE_OPTIONS,
    sourceWeightProfiles,
    profiles,
    identityDiagnostics: Array.from(identityDiagnostics.values()).slice(0, 80),
    dynastySourceDiagnostics,
    redraftSourceDiagnostics: redraftResult.diagnostics,
    devySourceDiagnostics,
    draftBuzzScoreboard: buildDraftBuzzScoreboardEntries(prospectProfiles, playerLookup, nflversePlayerContext),
    dynastySf: profiles.dynasty_sf_ppr || [],
    dynastyOneQb: profiles.dynasty_one_qb_ppr || [],
    devySf: profiles.devy_sf_ppr || [],
    devyOneQb: profiles.devy_one_qb_ppr || [],
    redraftPpr: profiles.redraft_ppr || [],
    redraftHalfPpr: profiles.redraft_half_ppr || [],
    redraftStandard: profiles.redraft_standard || [],
  };
}
