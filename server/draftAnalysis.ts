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
}

interface DraftPickWithMetadata extends SleeperDraftPick {
  draft_id?: string;
  roster_map?: Record<string, string>;
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
  adpData: ADPData
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
    const valueGain = null; // We'll calculate this if we have historical data

    const draftPick: any = {
      round: pick.round,
      pick: pick.pick_no,
      playerName,
      playerPos,
      manager,
      adp,
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
  if (rosterMappingData.pastRosters.length > 0) {
    draftsToFetch.push({
      leagueId: rosterMappingData.pastRosterMap['league_id'] || '',
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
