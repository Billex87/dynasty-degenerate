import type { DraftPick, ManagerDraftStats } from '../shared/types';

interface SleeperDraftPick {
  round: number;
  pick_no: number;
  player_id: string;
  picked_by: string;
}

interface ADPData {
  [playerId: string]: {
    name: string;
    pos: string;
    adp: number;
  };
}

/**
 * Fetch draft data from Sleeper API
 */
export async function fetchDraftData(leagueId: string): Promise<SleeperDraftPick[]> {
  try {
    const response = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}/drafts`
    ).then((r) => r.json());

    if (!Array.isArray(response) || response.length === 0) {
      console.warn('[Draft Analysis] No drafts found for league');
      return [];
    }

    // Get the most recent draft
    const draft = response[0];
    const draftId = draft.draft_id;

    const picks = await fetch(
      `https://api.sleeper.app/v1/draft/${draftId}/picks`
    ).then((r) => r.json());

    return picks || [];
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
export function analyzeDraftPicks(
  draftPicks: SleeperDraftPick[],
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
    const manager = rosterMap[pick.picked_by] || 'Unknown';
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
