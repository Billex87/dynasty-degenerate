import type { DraftPick, ManagerDraftStats } from '../shared/types';

interface SleeperDraftPick {
  round: number;
  pick_no: number;
  player_id: string;
  picked_by: string;
}

interface DraftInfo {
  draft_id: string;
  type: string;
  season: string;
  season_type: string;
  draft_order: Record<string, number>;
}

interface ADPData {
  [playerId: string]: {
    name: string;
    pos: string;
    adp: number;
  };
}

interface RosterMappingData {
  currentRosterMap: Record<string, string>;
  currentRosters: any[];
  pastRosterMap?: Record<string, string>;
  pastRosters?: any[];
}

/**
 * Fetch draft data from Sleeper API (rookie/startup drafts only from all seasons including previous league)
 */
export async function fetchDraftData(
  leagueId: string,
  rosterMappingData?: RosterMappingData
): Promise<DraftPickWithMetadata[]> {
  try {
    const allPicks: SleeperDraftPick[] = [];
    const leagueIds = [leagueId];

    // Get the current league info to find previous league
    try {
      const leagueInfo = await fetch(
        `https://api.sleeper.app/v1/league/${leagueId}`
      ).then((r) => r.json());

      if (leagueInfo.previous_league_id) {
        leagueIds.push(leagueInfo.previous_league_id);
        console.log(`[Draft Analysis] Found previous league: ${leagueInfo.previous_league_id}`);
      }
    } catch (e) {
      console.warn('[Draft Analysis] Could not fetch league info:', e);
    }

    // Fetch drafts from all league IDs (current + previous)
    for (const id of leagueIds) {
      try {
        const response = await fetch(
          `https://api.sleeper.app/v1/league/${id}/drafts`
        ).then((r) => r.json());

        if (!Array.isArray(response) || response.length === 0) {
          console.warn(`[Draft Analysis] No drafts found for league ${id}`);
          continue;
        }

        // Fetch picks from rookie/startup drafts only (type: snake or linear)
        for (const draft of response as DraftInfo[]) {
          // Only include rookie/startup drafts
          if (draft.type !== 'snake' && draft.type !== 'linear') {
            console.log(`[Draft Analysis] Skipping non-rookie draft type: ${draft.type}`);
            continue;
          }

          try {
            const picks = await fetch(
              `https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`
            ).then((r) => r.json());
            
            if (picks && Array.isArray(picks)) {
              allPicks.push(...picks);
              console.log(`[Draft Analysis] Fetched ${picks.length} picks from rookie draft ${draft.draft_id} (season ${draft.season}, type: ${draft.type})`);
            }
          } catch (e) {
            console.warn(`[Draft Analysis] Failed to fetch draft ${draft.draft_id}:`, e);
          }
        }
      } catch (e) {
        console.warn(`[Draft Analysis] Failed to fetch drafts for league ${id}:`, e);
      }
    }

    // Attach roster maps to picks based on which league they came from
    const picksWithMetadata: DraftPickWithMetadata[] = allPicks.map((pick) => ({
      ...pick,
      roster_map: rosterMappingData?.currentRosterMap || {},
    }));

    console.log(`[Draft Analysis] Fetched ${picksWithMetadata.length} total draft picks from all leagues`);
    return picksWithMetadata;
  } catch (error) {
    console.error('[Draft Analysis] Error fetching draft data:', error);
    return [];
  }
}

/**
 * Fetch ADP (Average Draft Position) data
 * This is a simplified version - in production you'd want to use a real ADP API
 */
export async function fetchADPData(): Promise<ADPData> {
  try {
    // Fetch from Sleeper's ADP endpoint
    const response = await fetch(
      'https://api.sleeper.app/v1/players/nfl/stats'
    ).then((r) => r.json());

    // Parse ADP data - this is a simplified approach
    const adpData: ADPData = {};
    
    // In a real implementation, you'd have a proper ADP data source
    // For now, we'll return an empty object and note this in the UI
    return adpData;
  } catch (error) {
    console.error('[Draft Analysis] Error fetching ADP data:', error);
    return {};
  }
}

/**
 * Analyze draft picks and calculate statistics
 */
interface DraftPickWithMetadata extends SleeperDraftPick {
  draft_id?: string;
  roster_map?: Record<string, string>;
}

export function analyzeDraftPicks(
  draftPicks: DraftPickWithMetadata[],
  players: Record<string, any>,
  rosterMap: Record<string, string>,
  ktcValues: Record<string, { name: string; ktc_value: number }>,
  adpData: ADPData
): { draftPicks: DraftPick[]; draftStats: ManagerDraftStats[] } {
  const processedPicks: DraftPick[] = [];
  const managerStats: Map<string, ManagerDraftStats> = new Map();

  // Initialize manager stats
  Object.values(rosterMap).forEach((manager) => {
    managerStats.set(manager, {
      manager,
      totalPicks: 0,
      avgAdpDiff: 0,
      avgKtcGain: 0,
      bestPick: null,
      worstPick: null,
      reachCount: 0,
      fallCount: 0,
    });
  });

  // Process each draft pick
  draftPicks.forEach((pick) => {
    const player = players[pick.player_id];
    const pickRosterMap = pick.roster_map || rosterMap;
    const manager = pickRosterMap[pick.picked_by] || 'Unknown';
    const playerName = player?.full_name || 'Unknown';
    const playerPos = player?.position || 'N/A';

    const adp = adpData[pick.player_id]?.adp || null;
    const ktcData = ktcValues[playerName];
    const ktcValue = ktcData?.ktc_value || null;
    const currentKtcValue = ktcData?.ktc_value || null;
    const valueGain = ktcValue && currentKtcValue ? currentKtcValue - ktcValue : null;

    const draftPick: DraftPick = {
      round: pick.round,
      pick: pick.pick_no,
      playerName,
      playerPos,
      manager,
      adp,
      ktcValue,
      currentKtcValue,
      valueGain,
    };

    processedPicks.push(draftPick);

    // Update manager stats
    const stats = managerStats.get(manager);
    if (stats) {
      stats.totalPicks += 1;

      // Track ADP diff (positive = reached, negative = fell)
      if (adp) {
        const adpDiff = pick.pick_no - adp;
        stats.avgAdpDiff = (stats.avgAdpDiff * (stats.totalPicks - 1) + adpDiff) / stats.totalPicks;

        if (adpDiff > 0) {
          stats.reachCount += 1;
        } else if (adpDiff < 0) {
          stats.fallCount += 1;
        }
      }

      // Track KTC gains
      if (valueGain !== null) {
        stats.avgKtcGain = (stats.avgKtcGain * (stats.totalPicks - 1) + valueGain) / stats.totalPicks;
      }

      // Track best and worst picks
      if (!stats.bestPick || (valueGain && valueGain > (stats.bestPick.valueGain || 0))) {
        stats.bestPick = draftPick;
      }
      if (!stats.worstPick || (valueGain && valueGain < (stats.worstPick.valueGain || 0))) {
        stats.worstPick = draftPick;
      }

      managerStats.set(manager, stats);
    }
  });

  return {
    draftPicks: processedPicks,
    draftStats: Array.from(managerStats.values()),
  };
}
