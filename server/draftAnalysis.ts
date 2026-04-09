import type { SleeperDraftPick } from '@shared/types';

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
  pastRosterMap: Record<string, string>;
  pastRosters: any[];
  pastUserMap: Record<string, string>;
  prevLeagueId?: string;
}

interface DraftPickWithMetadata extends SleeperDraftPick {
  draft_id?: string;
  roster_map?: Record<string, string>;
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
  ktcValuesMay2025?: Record<string, { name: string; ktc_value: number; position_rank_may2025?: string }>
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
  draftPicks.forEach((pick) => {
    const player = players[pick.player_id];
    const pickRosterMap = pick.roster_map || rosterMap;
    const manager = pickRosterMap[pick.picked_by] || 'Unknown';
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
    
    // Calculate position rank change
    let positionRankChange: string | null = null;
    if (positionRankMay2025 && currentPositionRank) {
      // Extract position and number from rank strings (e.g., "RB3" -> {pos: "RB", num: 3})
      const may2025Match = (positionRankMay2025 as string).match(/(QB|RB|WR|TE)(\d+)/);
      const currentMatch = (currentPositionRank as string).match(/(QB|RB|WR|TE)(\d+)/);
      
      if (may2025Match && currentMatch && may2025Match[1] === currentMatch[1]) {
        const may2025Num = parseInt(may2025Match[2]);
        const currentNum = parseInt(currentMatch[2]);
        const change = currentNum - may2025Num;
        positionRankChange = change === 0 ? null : `${change > 0 ? '+' : ''}${change}`;
      }
    }

    const draftPick: any = {
      round: pick.round,
      pick: pick.pick_no,
      playerName,
      playerPos,
      manager,
      adp,
      currentKtcValue,
      valueGain,
      positionRankMay2025,
      currentPositionRank,
      positionRankChange,
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
      if (currentKtcValue !== null) {
        stats.avgKtcGain = (stats.avgKtcGain * (stats.totalPicks - 1) + (currentKtcValue || 0)) / stats.totalPicks;
      }

      // Track best and worst picks
      if (!stats.bestPick || (currentKtcValue && currentKtcValue > (stats.bestPick.currentKtcValue || 0))) {
        stats.bestPick = draftPick;
      }
      if (!stats.worstPick || (currentKtcValue && currentKtcValue < (stats.worstPick.currentKtcValue || 0))) {
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

/**
 * Fetch draft data from Sleeper API
 */
export async function fetchDraftData(
  leagueId: string,
  rosterMappingData: RosterMappingData
): Promise<DraftPickWithMetadata[]> {
  const allDraftPicks: DraftPickWithMetadata[] = [];
  const draftsToFetch: { leagueId: string; rosterMap: Record<string, string> }[] = [];

  // Add current league
  draftsToFetch.push({
    leagueId,
    rosterMap: Object.fromEntries(
      rosterMappingData.currentRosters.map((r: any) => [
        r.owner_id,
        rosterMappingData.currentUserMap[r.owner_id] || 'Unknown',
      ])
    ),
  });

  // Add previous league if available
  if (rosterMappingData.prevLeagueId && rosterMappingData.pastRosters.length > 0) {
    draftsToFetch.push({
      leagueId: rosterMappingData.prevLeagueId,
      rosterMap: Object.fromEntries(
        rosterMappingData.pastRosters.map((r: any) => [
          r.owner_id,
          rosterMappingData.pastUserMap[r.owner_id] || 'Unknown',
        ])
      ),
    });
  }

  // Fetch drafts from each league
  for (const draftSource of draftsToFetch) {
    if (!draftSource.leagueId) continue;

    try {
      // Get all drafts for this league
      const draftsResponse = await fetch(
        `https://api.sleeper.app/v1/league/${draftSource.leagueId}/drafts`
      ).then((r) => r.json());

      const drafts = Array.isArray(draftsResponse) ? draftsResponse : [];

      // Filter for rookie/startup drafts only (less than 100 picks)
      for (const draft of drafts) {
        if (draft.type !== 'snake' && draft.type !== 'linear') continue;

        try {
          const picksResponse = await fetch(
            `https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`
          ).then((r) => r.json());

          const picks = Array.isArray(picksResponse) ? picksResponse : [];

          // Only include drafts with less than 100 picks
          if (picks.length < 100) {
            const picksWithMetadata = picks.map((pick: any) => ({
              ...pick,
              draft_id: draft.draft_id,
              roster_map: draftSource.rosterMap,
            }));
            allDraftPicks.push(...picksWithMetadata);
          }
        } catch (e) {
          console.warn(`Failed to fetch picks for draft ${draft.draft_id}:`, e);
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch drafts for league ${draftSource.leagueId}:`, e);
    }
  }

  console.log(`[Draft Analysis] Fetched ${allDraftPicks.length} total draft picks from all leagues`);
  return allDraftPicks;
}
