import { PlayerDetails, SleeperDraftPick } from '../shared/types';
import { getDynastySourceWeights } from './dynastySourceWeights';



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
  currentRosterDisplayMap?: Record<string, string>;
  currentRosters: any[];
  currentUserMap: Record<string, string>;
  currentUserIdToManagerMap?: Record<string, string>;
  currentUserIdToManagerDisplayMap?: Record<string, string>;
  pastRosterMap: Record<string, string>;
  pastRosterDisplayMap?: Record<string, string>;
  pastRosters: any[];
  pastUserMap: Record<string, string>;
  pastUserIdToManagerMap?: Record<string, string>;
  pastUserIdToManagerDisplayMap?: Record<string, string>;
  prevLeagueId?: string;
  draftSlotsBySeason?: Record<string, Record<number, number>>;
}

interface DraftPickWithMetadata extends SleeperDraftPick {
  draft_id?: string;
  roster_map?: Record<string, string>;
  roster_display_map?: Record<string, string>;
  user_id_to_manager_map?: Record<string, string>;
  user_id_to_manager_display_map?: Record<string, string>;
  season?: number;
  original_roster_id?: number | null;
}

interface PositionRankData {
  name?: string;
  ktc_value?: number;
  position_rank?: string;
  position_rank_may2025?: string;
  dynasty_value?: number;
  true_value?: number;
  redraft_value?: number;
  market_value_ktc?: number;
  expert_value_flock?: number;
  expert_value_dynastynerds?: number;
  market_value_fantasycalc?: number;
  expert_value_dynastyprocess?: number;
  fantasypros_season_value?: number;
  value_sources?: string[];
  [key: string]: any;
}

function isCompletedDraftPick(pick: SleeperDraftPick): boolean {
  return Boolean(
    pick?.player_id &&
    String(pick.player_id).trim() &&
    pick?.picked_by &&
    String(pick.picked_by).trim() &&
    typeof pick.pick_no === 'number'
  );
}

function getPlayerDetails(playerId: string, player: Record<string, any> | undefined): PlayerDetails | undefined {
  if (!player) return undefined;

  const injuryStatus = player.injury_status ?? null;
  const normalizedInjuryStatus = injuryStatus && !/^(active|healthy)$/i.test(String(injuryStatus))
    ? String(injuryStatus).replace(/_/g, ' ')
    : null;
  const rawStatus = player.status && !/^(active|healthy)$/i.test(String(player.status))
    ? String(player.status).replace(/_/g, ' ')
    : null;

  return {
    playerId,
    fullName: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
    position: player.position,
    team: player.team ?? null,
    jerseyNumber: player.number ?? null,
    age: player.age ?? null,
    birthDate: player.birth_date ?? null,
    height: player.height ?? null,
    weight: player.weight ?? null,
    college: player.college ?? null,
    rookieYear: player.metadata?.rookie_year ?? null,
    nflDraftRound: player.metadata?.draft_round ?? player.draft_round ?? null,
    nflDraftPick: player.metadata?.draft_pick ?? player.metadata?.draft_slot ?? player.draft_pick ?? null,
    nflDraftTeam: player.metadata?.draft_team ?? player.draft_team ?? null,
    highSchool: player.high_school ?? null,
    injuryStatus,
    rosterStatus: null,
    displayStatus: normalizedInjuryStatus || rawStatus || 'Active',
    depthChartPosition: player.depth_chart_position ?? null,
    depthChartOrder: player.depth_chart_order ?? null,
    yearsExp: player.years_exp ?? null,
    status: player.status ?? null,
    externalIds: {
      fantasyData: player.fantasy_data_id,
      sportradar: player.sportradar_id,
      yahoo: player.yahoo_id,
      gsis: player.gsis_id,
      espn: player.espn_id,
      stats: player.stats_id,
    },
  };
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
export async function analyzeDraftPicks(
  draftPicks: DraftPickWithMetadata[],
  players: Record<string, any>,
  rosterMap: Record<string, string>,
  ktcValues: Record<string, PositionRankData>,
  adpData: ADPData,
  ktcValuesLastWeek?: Record<string, { name: string; ktc_value: number }>,
  ktcValuesMay2025?: Record<string, PositionRankData>,
  currentKTCRanks?: Record<string, { name: string; ktc_value: number; position_rank?: string }>,
  ktcValuesByDraftYear?: Record<string, Record<string, PositionRankData>>,
  managerDisplayNameByManager: Record<string, string> = {},
  valueBlendOptions: { numQbs?: number; ppr?: number; tep?: number } = {}
): Promise<{ draftPicks: any[]; draftStats: any[] }> {
  const processedPicks: any[] = [];
  const managerStats: Map<string, any> = new Map();
  const sourceWeights = getDynastySourceWeights({
    board: 'dynasty',
    numQbs: valueBlendOptions.numQbs ?? 2,
    ppr: valueBlendOptions.ppr ?? 1,
    tep: valueBlendOptions.tep ?? 0,
  });

  // Helper function to create slug from player name (removes all non-alphanumeric)
  const createSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };
  
  // Helper function to find data by flexible slug matching
  const findPlayerData = (playerName: string, ktcData: Record<string, any>): any => {
    if (!ktcData) return null;
    
    const simpleSlug = createSlug(playerName);
    
    // Try exact match with simple slug first
    if (ktcData[simpleSlug]) {
      return ktcData[simpleSlug];
    }
    
    // Try to find by matching name parts more flexibly
    for (const key in ktcData) {
      const keySlug = createSlug(key);
      
      // Exact slug match
      if (keySlug === simpleSlug) {
        return ktcData[key];
      }
      
      // Split by hyphens, spaces, and numbers to get name parts from key
      const keyNameParts = key.toLowerCase().split(/[-\s0-9]+/).filter(p => p.length > 0);
      const playerNameParts = playerName.toLowerCase().split(/\s+/).filter(p => p.length > 0);
      
      // Check if all player name parts are found in key name parts
      // This handles cases like "Tre' Harris" matching "tre-harris-1772"
      // and "Dont'e Thornton" matching "dont-e-thornton-1787"
      const allPartsMatch = playerNameParts.every(part => 
        keyNameParts.some(kp => kp.includes(part) || part.includes(kp))
      );
      
      if (allPartsMatch && keyNameParts.length > 0) {
        return ktcData[key];
      }
    }
    
    // No match found - return null (don't use fallback values like WR90)
    return null;
  };

  const getBaselineValue = (record: PositionRankData | null): number | null => {
    if (!record) return null;
    const value = record.dynasty_value ?? record.true_value ?? record.ktc_value;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };

  const getNumberValue = (record: PositionRankData | null | undefined, field: keyof PositionRankData): number | null => {
    const value = record?.[field];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };

  const hasExplicitSources = (record: PositionRankData | null | undefined): boolean => {
    return Array.isArray(record?.value_sources) && record.value_sources.length > 0;
  };

  const sourceIsAvailable = (record: PositionRankData | null | undefined, source: string): boolean => {
    if (!record) return false;
    return !hasExplicitSources(record) || Boolean(record.value_sources?.includes(source));
  };

  const getKtcSourceValue = (record: PositionRankData | null | undefined): number | null => {
    const marketValue = getNumberValue(record, 'market_value_ktc');
    if (marketValue !== null) return marketValue;
    return sourceIsAvailable(record, 'KTC') ? getNumberValue(record, 'ktc_value') : null;
  };

  const getSourceMatchedValues = (
    baseline: PositionRankData | null,
    current: PositionRankData | null
  ): { baselineValue: number; currentValue: number } | null => {
    const parts = [
      {
        baseline: getNumberValue(baseline, 'expert_value_flock'),
        current: getNumberValue(current, 'expert_value_flock'),
        weight: sourceWeights.flock,
      },
      {
        baseline: getNumberValue(baseline, 'expert_value_dynastynerds'),
        current: getNumberValue(current, 'expert_value_dynastynerds'),
        weight: sourceWeights.dynastyNerds,
      },
      {
        baseline: getKtcSourceValue(baseline),
        current: getKtcSourceValue(current),
        weight: sourceWeights.ktc,
      },
      {
        baseline: getNumberValue(baseline, 'market_value_fantasycalc'),
        current: getNumberValue(current, 'market_value_fantasycalc'),
        weight: sourceWeights.fantasyCalc,
      },
      {
        baseline: getNumberValue(baseline, 'expert_value_dynastyprocess'),
        current: getNumberValue(current, 'expert_value_dynastyprocess'),
        weight: sourceWeights.dynastyProcess,
      },
    ].filter((part) => part.baseline !== null && part.current !== null);

    const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
    if (totalWeight <= 0) return null;

    return {
      baselineValue: Math.round(parts.reduce((sum, part) => sum + (part.baseline || 0) * part.weight, 0) / totalWeight),
      currentValue: Math.round(parts.reduce((sum, part) => sum + (part.current || 0) * part.weight, 0) / totalWeight),
    };
  };

  const getStarterThresholds = (teamCount: number): Record<string, number> => ({
    QB: Math.max(1, Math.round(teamCount * 2)),
    RB: Math.max(1, Math.round(teamCount * 3)),
    WR: Math.max(1, Math.round(teamCount * 4)),
    TE: Math.max(1, Math.round(teamCount * 1.5)),
  });

  const isStarterByRank = (position: string, rank: string | null): boolean => {
    const rankPosition = rank?.match(/^[A-Z]+/)?.[0];
    const rankNumber = Number(rank?.match(/\d+/)?.[0]);
    const thresholds = getStarterThresholds(Math.max(1, Object.values(rosterMap).filter(Boolean).length || 10));
    if (!rankPosition || !Number.isFinite(rankNumber) || rankPosition !== position) return false;
    return rankNumber <= (thresholds[position] || 0);
  };

  const isStarterOutcome = (position: string, rank: string | null, value: number | null): boolean => (
    isStarterByRank(position, rank) || (!rank && value !== null && value > 4000)
  );

  const getDraftOutcome = (
    positionRankChange: string | null,
    valueGain: number | null,
    draftYear: string
  ): 'hit' | 'miss' | 'neutral' => {
    const rankChange = positionRankChange ? parseInt(positionRankChange, 10) : 0;
    const hasRankChange = Number.isFinite(rankChange) && rankChange !== 0;
    const draftYearNumber = Number(draftYear);
    const currentYear = new Date().getFullYear();
    const isFreshClass = Number.isFinite(draftYearNumber) && draftYearNumber >= currentYear;
    const rankThreshold = isFreshClass ? 12 : 8;
    const valueThreshold = isFreshClass ? 1500 : 900;
    const isRankHit = hasRankChange && rankChange >= rankThreshold;
    const isRankMiss = hasRankChange && rankChange <= -rankThreshold;
    const isValueHit = valueGain !== null && valueGain >= valueThreshold;
    const isValueMiss = valueGain !== null && valueGain <= -valueThreshold;
    const isHit = isRankHit || isValueHit;
    const isMiss = isRankMiss || isValueMiss;

    if (isHit && isMiss) return (valueGain || 0) >= 0 ? 'hit' : 'miss';
    if (isHit) return 'hit';
    if (isMiss) return 'miss';
    return 'neutral';
  };

  // Initialize manager stats
  Object.values(rosterMap).forEach((manager) => {
    managerStats.set(manager, {
      manager,
      managerDisplayName: managerDisplayNameByManager[manager] || manager,
      totalPicks: 0,
      avgAdpDiff: 0,
      avgKtcGain: 0,
      bestPick: null,
      worstPick: null,
      hits: 0,
      misses: 0,
      starters: 0,
    });
  });

  // Process each draft pick
  for (const pick of draftPicks) {
    const player = players[pick.player_id];
    const pickRosterMap = pick.roster_map || rosterMap;
    const pickRosterDisplayMap = pick.roster_display_map || {};
    const userIdToManagerMap = pick.user_id_to_manager_map || {};
    const userIdToManagerDisplayMap = pick.user_id_to_manager_display_map || {};
    

    
    // Try to resolve manager using user_id_to_manager_map first, then fall back to roster map
    let manager = userIdToManagerMap[pick.picked_by];
    if (!manager) {
      manager = pickRosterMap[pick.picked_by] || 'Unknown';
    }
    const managerDisplayName = userIdToManagerDisplayMap[pick.picked_by]
      || pickRosterDisplayMap[pick.picked_by]
      || managerDisplayNameByManager[manager]
      || manager;
    const originalRosterId = typeof pick.original_roster_id === 'number'
      ? pick.original_roster_id
      : typeof pick.roster_id === 'number'
        ? pick.roster_id
        : null;
    const originalOwner = originalRosterId !== null ? pickRosterMap[String(originalRosterId)] || null : null;
    
    const playerName = player?.full_name || 'Unknown';
    const playerPos = player?.position || 'N/A';

    const adp = adpData[pick.player_id]?.adp || null;
    
    // Create slug to match KTC data
    const playerSlug = createSlug(playerName);
    const ktcData = findPlayerData(playerName, ktcValues) || ktcValues[playerSlug];
    let currentKtcValue = ktcData?.ktc_value || null;

    // Detect draft year based on season field from draft metadata
    // The season field contains the year (e.g., 2025, 2026)
    // If not available, default to 2025
    const draftYear = pick.season ? String(pick.season) : '2025';
    
    
    // Calculate value gain using the fixed draft-year rookie baseline when available.
    // 2025 drafts use "2025 Rookie Values"; 2026 drafts use "2026 Rookie Values".
    let valueGain: number | null = null;
    let draftKtcValue: number | null = null;
    let baselineRank: string | null = null;
    if (currentKtcValue !== null) {
      let baselineValue = currentKtcValue; // default to current if no baseline
      const draftYearBaseline = ktcValuesByDraftYear?.[draftYear];
      
      if (draftYearBaseline) {
        const draftYearData = findPlayerData(playerName, draftYearBaseline);
        const sourceMatchedValues = getSourceMatchedValues(draftYearData, ktcData);
        const draftYearValue = sourceMatchedValues?.baselineValue ?? getBaselineValue(draftYearData);
        if (draftYearValue) {
          baselineValue = draftYearValue;
          if (sourceMatchedValues?.currentValue) {
            currentKtcValue = sourceMatchedValues.currentValue;
          }
          baselineRank = draftYearData.position_rank || draftYearData.position_rank_may2025 || null;
        }
      } else if (ktcValuesMay2025) {
        // Prefer May 2025 baseline for accurate 2025 draft-day comparison
        const may2025Data = findPlayerData(playerName, ktcValuesMay2025);
        const sourceMatchedValues = getSourceMatchedValues(may2025Data, ktcData);
        const may2025Value = sourceMatchedValues?.baselineValue ?? getBaselineValue(may2025Data);
        if (may2025Value) {
          baselineValue = may2025Value;
          if (sourceMatchedValues?.currentValue) {
            currentKtcValue = sourceMatchedValues.currentValue;
          }
          baselineRank = may2025Data.position_rank_may2025 || null;
        }
      } else if (ktcValuesLastWeek) {
        // Fall back to last week's KTC as approximation
        const lastWeekKtcData = findPlayerData(playerName, ktcValuesLastWeek) || ktcValuesLastWeek[playerSlug];
        if (lastWeekKtcData?.ktc_value) {
          baselineValue = lastWeekKtcData.ktc_value;
        }
      }
      draftKtcValue = baselineValue;
      valueGain = currentKtcValue - baselineValue;
    }

    // Extract position rank from May 2025 data
    let positionRankMay2025: string | null = null;
    if (baselineRank) {
      positionRankMay2025 = baselineRank;
    } else if (ktcValuesMay2025) {
      const may2025Data = findPlayerData(playerName, ktcValuesMay2025);
      positionRankMay2025 = may2025Data?.position_rank_may2025 || null;
      

    }
    
    // Calculate current position rank from player position and KTC value
    // This would require additional data from KTC API, for now we'll leave it as null
    let currentPositionRank: string | null = null;
    
    // Get current position rank from KTC data
    if (currentKTCRanks) {
      const currentRankData = findPlayerData(playerName, currentKTCRanks);
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
    
    // Headshot URLs removed - was causing TLS connection errors
    // Can be re-enabled with a more reliable image source in the future

    const isStarter = isStarterOutcome(playerPos, currentPositionRank, currentKtcValue);
    const draftOutcome = getDraftOutcome(positionRankChange, valueGain, draftYear);

    const processedPick: any = {
      round: pick.round,
      pick: pick.pick_no,
      draftSlot: pick.draft_slot,
      playerName,
      playerPos,
      manager,
      managerDisplayName,
      originalOwner,
      originalRosterId,
      adp,
      ktcValue: draftKtcValue,
      currentKtcValue,
      valueGain,
      draftOutcome,
      isStarter,
      positionRankMay2025,
      currentPositionRank,
      positionRankChange,
      draftYear,
      player_id: pick.player_id,
      playerDetails: getPlayerDetails(pick.player_id, player),
    };
    processedPicks.push(processedPick);

    // Update manager stats
    const stats = managerStats.get(manager);
    if (stats) {
      stats.managerDisplayName = managerDisplayName;
      stats.totalPicks += 1;

      // Track ADP diff (positive = reached, negative = fell)
      if (adp) {
        const adpDiff = pick.pick_no - adp;
        stats.avgAdpDiff = (stats.avgAdpDiff * (stats.totalPicks - 1) + adpDiff) / stats.totalPicks;
      }

      // Track KTC gain
      if (valueGain !== null) {
        stats.avgKtcGain = (stats.avgKtcGain * (stats.totalPicks - 1) + valueGain) / stats.totalPicks;
      }

      // Track starter-grade rookie outcomes by positional rank. Fall back to
      // value only when a rank is missing.
      if (isStarter) {
        stats.starters += 1;
      }

      // Track hits and misses based on meaningful position-rank or value movement.
      // Fresh rookie classes need a larger move before calling a pick a real hit/miss.
      if (draftOutcome === 'hit') stats.hits += 1;
      if (draftOutcome === 'miss') stats.misses += 1;

      // Track best and worst picks
      if (!stats.bestPick || (valueGain !== null && valueGain > (stats.bestPick.valueGain || 0))) {
        stats.bestPick = processedPick;
      }
      if (!stats.worstPick || (valueGain !== null && valueGain < (stats.worstPick.valueGain || 0))) {
        stats.worstPick = processedPick;
      }
    }
  }

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
  const {
    currentRosterMap,
    currentRosterDisplayMap,
    currentUserIdToManagerMap,
    currentUserIdToManagerDisplayMap,
    pastRosterMap,
    pastRosterDisplayMap,
    pastUserIdToManagerMap,
    pastUserIdToManagerDisplayMap,
    prevLeagueId,
    draftSlotsBySeason,
  } = rosterMappingData;
  
  const allPicks: DraftPickWithMetadata[] = [];

  const getOriginalRosterId = (season: string | number | undefined, pick: SleeperDraftPick): number | null => {
    const draftSlot = typeof pick.draft_slot === 'number' ? pick.draft_slot : null;
    const seasonSlots = season ? draftSlotsBySeason?.[String(season)] : undefined;
    if (draftSlot !== null && seasonSlots) {
      const originalRosterEntry = Object.entries(seasonSlots)
        .find(([, slot]) => Number(slot) === draftSlot);
      if (originalRosterEntry) {
        const rosterId = Number(originalRosterEntry[0]);
        if (Number.isFinite(rosterId)) return rosterId;
      }
    }
    return typeof pick.roster_id === 'number' ? pick.roster_id : null;
  };

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
              roster_display_map: currentRosterDisplayMap,
              user_id_to_manager_map: currentUserIdToManagerMap,
              user_id_to_manager_display_map: currentUserIdToManagerDisplayMap,
              season: draft.season,
              original_roster_id: getOriginalRosterId(draft.season, pick),
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
                roster_display_map: pastRosterDisplayMap,
                user_id_to_manager_map: pastUserIdToManagerMap,
                user_id_to_manager_display_map: pastUserIdToManagerDisplayMap,
                season: draft.season,
                original_roster_id: getOriginalRosterId(draft.season, pick),
              });
            });
          }
        }
      }
    }

    const completedPicks = allPicks.filter(isCompletedDraftPick);

    // Filter to only include rookie drafts with fewer than 100 picked players
    // Count picks per draft_id
    const pickCountByDraft: Record<string, number> = {};
    completedPicks.forEach((pick) => {
      if (pick.draft_id) {
        pickCountByDraft[pick.draft_id] = (pickCountByDraft[pick.draft_id] || 0) + 1;
      }
    });
    
    // Filter to only include drafts with fewer than 100 picks (rookie drafts)
    return completedPicks.filter((pick) => {
      if (!pick.draft_id) return true; // Include picks without draft_id
      const pickCount = pickCountByDraft[pick.draft_id] || 0;
      return pickCount < 100; // Only include picks from drafts with fewer than 100 picks
    });
  } catch (error) {
    console.error('Error fetching draft data:', error);
    return [];
  }
}
