import type { SleeperDraftPick } from '../shared/types';
import {
  buildFantasyProsExternalIdIndex,
  findFantasyProsIdByExternalId,
  type FantasyProsConsensusSnapshotRow,
  type FantasyProsExternalIdIndex,
  type FantasyProsSnapshotContext,
} from './fantasyProsSnapshotContext';

type DraftAdpRow = {
  name: string;
  adp: number | null;
  source?: string;
  rank?: number;
  positionRank?: string | null;
  currentAdp?: number | null;
  currentAdpSource?: string | null;
};

type DraftPickWithContext = SleeperDraftPick & {
  draft_pick_count?: number | null;
  season?: string | number | null;
};

type DraftKind = 'rookie' | 'startup' | 'main';

function finiteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getPlayerName(player: Record<string, any> | undefined): string {
  return player?.full_name || `${player?.first_name || ''} ${player?.last_name || ''}`.trim();
}

function isStartupPick(pick: DraftPickWithContext): boolean {
  const pickCount = Number(pick.draft_pick_count || 0);
  const round = Number(pick.round || 0);
  return pickCount >= 100 || round > 10;
}

function getDraftKind(pick: DraftPickWithContext, leagueValueMode: 'dynasty' | 'redraft' | 'keeper' | string): DraftKind {
  if (leagueValueMode === 'redraft') return 'main';
  return isStartupPick(pick) ? 'startup' : 'rookie';
}

function getFantasyProsIdForPick(input: {
  pick: DraftPickWithContext;
  player: Record<string, any> | undefined;
  externalIdIndex: FantasyProsExternalIdIndex;
}): string | null {
  const player = input.player || {};
  const metadata = player.metadata && typeof player.metadata === 'object' && !Array.isArray(player.metadata)
    ? player.metadata as Record<string, unknown>
    : {};
  const directId = stringValue(player.fantasypros_id)
    || stringValue(player.fantasyProsId)
    || stringValue(player.fantasypros_player_id)
    || stringValue(player.fantasyProsPlayerId)
    || stringValue(player.fp_player_id)
    || stringValue(player.fpid)
    || stringValue(metadata.fantasypros_id)
    || stringValue(metadata.fantasyProsId)
    || stringValue(metadata.fantasypros_player_id)
    || stringValue(metadata.fp_player_id);
  if (directId) return directId;

  const sleeperId = stringValue(input.pick.player_id)
    || stringValue(player.sleeper_id)
    || stringValue(player.sleeperId)
    || stringValue(player.player_id);
  if (sleeperId) {
    const matched = findFantasyProsIdByExternalId(input.externalIdIndex, 'sleeper', sleeperId);
    if (matched) return matched;
  }

  const platformCandidates: Array<[string, unknown[]]> = [
    ['espn', [player.espn_id, player.espnId, metadata.espn_id, metadata.espnId]],
    ['yahoo', [player.yahoo_id, player.yahooId, metadata.yahoo_id, metadata.yahooId]],
    ['mfl', [player.mfl_id, player.mflId, metadata.mfl_id, metadata.mflId]],
    ['fleaflicker', [player.fleaflicker_id, player.fleaflickerId, metadata.fleaflicker_id, metadata.fleaflickerId]],
    ['fantrax', [player.fantrax_id, player.fantraxId, metadata.fantrax_id, metadata.fantraxId]],
    ['nfl', [player.nfl_id, player.nflId, metadata.nfl_id, metadata.nflId]],
    ['cbs', [player.cbs_id, player.cbsId, metadata.cbs_id, metadata.cbsId]],
    ['draftkings', [player.draftkings_id, player.draftkingsId, metadata.draftkings_id, metadata.draftkingsId]],
  ];

  for (const [source, values] of platformCandidates) {
    for (const value of values) {
      const matched = findFantasyProsIdByExternalId(input.externalIdIndex, source, value);
      if (matched) return matched;
    }
  }

  return null;
}

function getFantasyProsAdpSource(kind: DraftKind): string {
  if (kind === 'startup') return 'FantasyPros Dynasty ADP';
  if (kind === 'rookie') return 'FantasyPros Rookie ADP';
  return 'FantasyPros ADP';
}

function getAdpRowForKind(
  context: FantasyProsSnapshotContext,
  kind: DraftKind,
  fantasyProsId: string
): FantasyProsConsensusSnapshotRow | null {
  if (kind === 'startup') {
    return context.dynastyAdpByFantasyProsId[fantasyProsId]
      || context.adpByFantasyProsId[fantasyProsId]
      || null;
  }
  if (kind === 'rookie') {
    return context.rookieAdpByFantasyProsId[fantasyProsId]
      || context.rookieRankingsByFantasyProsId[fantasyProsId]
      || null;
  }
  return context.adpByFantasyProsId[fantasyProsId] || null;
}

function getAdpValue(row: FantasyProsConsensusSnapshotRow): number | null {
  return finiteNumber(row.averageRank) ?? finiteNumber(row.rankEcr);
}

function getAdpRank(row: FantasyProsConsensusSnapshotRow): number | undefined {
  return finiteNumber(row.rankEcr) ?? finiteNumber(row.averageRank) ?? undefined;
}

export function buildFantasyProsDraftAdpData(input: {
  draftPicks: DraftPickWithContext[];
  players: Record<string, any>;
  fantasyProsSnapshotContext: FantasyProsSnapshotContext | null | undefined;
  leagueValueMode: 'dynasty' | 'redraft' | 'keeper' | string;
}): Record<string, DraftAdpRow> {
  const context = input.fantasyProsSnapshotContext;
  if (!context) return {};

  const externalIdIndex = buildFantasyProsExternalIdIndex(context);
  const rows: Record<string, DraftAdpRow> = {};
  for (const pick of input.draftPicks) {
    if (!pick?.player_id) continue;
    const season = String(pick.season || '').trim();
    if (season && season !== context.season) continue;

    const player = input.players[pick.player_id];
    const fantasyProsId = getFantasyProsIdForPick({ pick, player, externalIdIndex });
    if (!fantasyProsId) continue;

    const kind = getDraftKind(pick, input.leagueValueMode);
    const adpRow = getAdpRowForKind(context, kind, fantasyProsId);
    if (!adpRow) continue;

    const adp = getAdpValue(adpRow);
    if (adp === null) continue;

    const key = season ? `${season}:${pick.player_id}` : String(pick.player_id);
    rows[key] = {
      name: adpRow.name || getPlayerName(player) || String(pick.player_id),
      adp,
      source: getFantasyProsAdpSource(kind),
      rank: getAdpRank(adpRow),
      positionRank: adpRow.positionRank || null,
    };
  }

  return rows;
}
