import { SleeperDraftPick } from '../shared/types';

interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season: number;
  type: string;
  status: string;
  draft_order: Record<string, number>;
}

interface ADPData {
  [playerId: string]: {
    name: string;
    adp: number;
  };
}

interface RosterMappingData {
  currentRosterMap: Record<string, string>;
  currentRosters: any[];
  currentUserMap: Record<string, string>;
  currentUserIdToManagerMap?: Record<string, string>;
  pastRosterMap: Record<string, string>;
  pastRosters: any[];
  pastUserMap: Record<string, string>;
  pastUserIdToManagerMap?: Record<string, string>;
  prevLeagueId?: string;
}

interface DraftPickWithMetadata extends SleeperDraftPick {
  draft_id?: string;
  roster_map?: Record<string, string>;
  user_id_to_manager_map?: Record<string, string>;
  season?: number;
}

interface PositionRankData {
  position_rank_may2025?: string;
  [key: string]: any;
}

export function calculateADPFromPicks(
  allPicks: SleeperDraftPick[]
): ADPData {
  const playerPickPositions: Record<string, number[]> = {};

  allPicks.forEach((pick) => {
    if (!playerPickPositions[pick.player_id]) {
      playerPickPositions[pick.player_id] = [];
    }
    playerPickPositions[pick.player_id].push(pick.pick_no);
  });

  const adpData: ADPData = {};
  Object.entries(playerPickPositions).forEach(([playerId, positions]) => {
    const avgPosition = positions.reduce((a, b) => a + b, 0) / positions.length;
    adpData[playerId] = {
      name: playerId,
      adp: Math.round(avgPosition * 10) / 10,
    };
  });

  return adpData;
}

/**
 * Analyze draft picks and calculate statistics
 */
export function analyzeDraftPicks(
  draftPicks: DraftPickWithMetadata[],
  players: Record<string, any>,
  rosterMap: Record<string, string>,
  ktcValues: Record<string, { name: string; ktc_value: number }>,
  adpData: ADPData,
  ktcValuesLastWeek?: Record<string, { name: string; ktc_value: number }>,
  ktcValuesMay2025?: Record<string, { name: string; ktc_value: number; position_rank_may2025?: string }>,
  currentKTCRanks?: Record<string, { name: string; ktc_value: number; position_rank?: string }>
): { draftPicks: any[]; draftStats: any[] } {
  const processedPicks: any[] = [];
  const managerStats: Map<string, any> = new Map();

  // Helper function to create slug from player name
  const createSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };
  
  // Helper function to find May 2025 data by flexible slug matching
  const findMay2025Data = (playerName: string, ktcData: Record<string, any>): any => {
    if (!ktcData) return null;
    
    const simpleSlug = createSlug(playerName);
    
    // Try exact match with simple slug first
    if (ktcData[simpleSlug]) {
      return ktcData[simpleSlug];
    }
    
    // Try to find by matching the simple slug as a prefix (handles "ashtonjeanty" matching "ashton-jeanty-1742")
    for (const key in ktcData) {
      const keySlug = createSlug(key);
      if (keySlug.startsWith(simpleSlug) || simpleSlug.startsWith(keySlug.split('-')[0])) {
        // Additional check: make sure the name parts match
        const nameParts = playerName.toLowerCase().split(/\s+/);
        const keyParts = key.toLowerCase().split('-').filter(p => isNaN(Number(p))); // Remove numeric IDs
        
        // Check if all name parts are in the key
        if (nameParts.every(part => keyParts.some(kp => kp.includes(part)))) {
          return ktcData[key];
        }
      }
    }
    
    return null;
  };

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
  draftPicks.forEach((pick, index) => {
    const player = players[pick.player_id];
    const pickRosterMap = pick.roster_map || rosterMap;
    const userIdToManagerMap = pick.user_id_to_manager_map || {};
    

    
    // Try to resolve manager using user_id_to_manager_map first, then fall back to roster map
    let manager = userIdToManagerMap[pick.picked_by];
    if (!manager) {
      manager = pickRosterMap[pick.picked_by] || 'Unknown';
    }
    
    const playerName = player?.full_name || 'Unknown';
    const playerPos = player?.position || 'N/A';

    const adp = adpData[pick.player_id]?.adp || null;
    
    // Create slug to match KTC data
    const playerSlug = createSlug(playerName);
    const ktcData = ktcValues[playerSlug];
    const currentKtcValue = ktcData?.ktc_value || null;
    
    
    // Calculate value gain using May 2025 baseline if available, otherwise use last week's KTC
    let valueGain: number | null = null;
    if (currentKtcValue !== null) {
      let baselineValue = currentKtcValue; // default to current if no baseline
      
      // Prefer May 2025 baseline for accurate draft-day comparison
      if (ktcValuesMay2025) {
        const may2025Data = findMay2025Data(playerName, ktcValuesMay2025);
        if (may2025Data?.ktc_value) {
          baselineValue = may2025Data.ktc_value;
        }
      } else if (ktcValuesLastWeek) {
        // Fall back to last week's KTC as approximation
        const lastWeekKtcData = ktcValuesLastWeek[playerSlug];
        if (lastWeekKtcData?.ktc_value) {
          baselineValue = lastWeekKtcData.ktc_value;
        }
      }
      
      valueGain = currentKtcValue - baselineValue;
    }

    // Extract position rank from May 2025 data
    let positionRankMay2025: string | null = null;
    if (ktcValuesMay2025) {
      const may2025Data = findMay2025Data(playerName, ktcValuesMay2025);
      positionRankMay2025 = may2025Data?.position_rank_may2025 || null;
    }
    
    // Calculate current position rank from player position and KTC value
    // This would require additional data from KTC API, for now we'll leave it as null
    let currentPositionRank: string | null = null;
    
    // Get current position rank from KTC data
    if (currentKTCRanks) {
      const currentRankData = findMay2025Data(playerName, currentKTCRanks);
      currentPositionRank = currentRankData?.position_rank || null;
    }
    
    // Calculate position rank change
    let positionRankChange: string | null = null;
    if (positionRankMay2025 && currentPositionRank) {
      // Extract numeric rank from strings like "RB3" or "WR15"
      const may2025Num = parseInt(positionRankMay2025.match(/\d+/)?.[0] || '0');
      const currentNum = parseInt(currentPositionRank.match(/\d+/)?.[0] || '0');
      
      if (may2025Num > 0 && currentNum > 0) {
        const rankDiff = may2025Num - currentNum; // Positive means moved up (lower rank number)
        positionRankChange = rankDiff !== 0 ? `${rankDiff > 0 ? '+' : ''}${rankDiff}` : '0';
      }
    }
    
    // Detect draft year based on season field from draft metadata
    // The season field contains the year (e.g., 2025, 2026)
    // If not available, default to 2025
    const draftYear = pick.season ? String(pick.season) : '2025';

    const processedPick: any = {
      round: pick.round,
      pick: pick.pick_no,
      playerName,
      playerPos,
      manager,
      adp,
      ktcValue: currentKtcValue,
      currentKtcValue,
      valueGain,
      positionRankMay2025,
      currentPositionRank,
      positionRankChange,
      draftYear,
    };
    processedPicks.push(processedPick);

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

      // Track KTC gain
      if (valueGain !== null) {
        stats.avgKtcGain = (stats.avgKtcGain * (stats.totalPicks - 1) + valueGain) / stats.totalPicks;
      }

      // Track best and worst picks
      if (!stats.bestPick || (valueGain !== null && valueGain > (stats.bestPick.valueGain || 0))) {
        stats.bestPick = processedPick;
      }
      if (!stats.worstPick || (valueGain !== null && valueGain < (stats.worstPick.valueGain || 0))) {
        stats.worstPick = processedPick;
      }
    }
  });

  const draftStats = Array.from(managerStats.values())
    .map((stat) => ({
      ...stat,
      avgAdpDiff: Math.round(stat.avgAdpDiff * 10) / 10,
      avgKtcGain: Math.round(stat.avgKtcGain),
    }))
    .sort((a, b) => b.avgKtcGain - a.avgKtcGain);

  return { draftPicks: processedPicks, draftStats };
}

export async function fetchDraftData(
  leagueId: string,
  rosterMappingData: RosterMappingData
): Promise<DraftPickWithMetadata[]> {
  const { currentRosterMap, currentRosters, currentUserIdToManagerMap, pastRosterMap, pastRosters, pastUserIdToManagerMap, prevLeagueId } = rosterMappingData;
  
  const allPicks: DraftPickWithMetadata[] = [];

  try {
    // Fetch current season drafts
    const currentDrafts = await fetch(
      `https://api.sleeper.app/v1/league/${leagueId}/drafts`
    ).then((r) => r.json());

    if (Array.isArray(currentDrafts)) {
      for (const draft of currentDrafts) {
        const draftPicks = await fetch(
          `https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`
        ).then((r) => r.json());

        if (Array.isArray(draftPicks)) {
          draftPicks.forEach((pick: SleeperDraftPick) => {
            allPicks.push({
              ...pick,
              draft_id: draft.draft_id,
              roster_map: currentRosterMap,
              user_id_to_manager_map: currentUserIdToManagerMap,
              season: draft.season,
            });
          });
        }
      }
    }

    // Fetch past season drafts if available
    if (prevLeagueId) {
      const pastDrafts = await fetch(
        `https://api.sleeper.app/v1/league/${prevLeagueId}/drafts`
      ).then((r) => r.json());

      if (Array.isArray(pastDrafts)) {
        for (const draft of pastDrafts) {
          const draftPicks = await fetch(
            `https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`
          ).then((r) => r.json());

          if (Array.isArray(draftPicks)) {
            draftPicks.forEach((pick: SleeperDraftPick) => {
              allPicks.push({
                ...pick,
                draft_id: draft.draft_id,
                roster_map: pastRosterMap,
                user_id_to_manager_map: pastUserIdToManagerMap,
                season: draft.season,
              });
            });
          }
        }
      }
    }

    // Filter to only include rookie drafts with fewer than 100 picks
    // Count picks per draft_id
    const pickCountByDraft: Record<string, number> = {};
    allPicks.forEach((pick) => {
      if (pick.draft_id) {
        pickCountByDraft[pick.draft_id] = (pickCountByDraft[pick.draft_id] || 0) + 1;
      }
    });
    
    // Filter to only include drafts with fewer than 100 picks (rookie drafts)
    return allPicks.filter((pick) => {
      if (!pick.draft_id) return true; // Include picks without draft_id
      const pickCount = pickCountByDraft[pick.draft_id] || 0;
      return pickCount < 100; // Only include picks from drafts with fewer than 100 picks
    });
  } catch (error) {
    console.error('Error fetching draft data:', error);
    return [];
  }
}
