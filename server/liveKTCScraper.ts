import axios from 'axios';

interface KTCPlayer {
  name: string;
  position_rank: string;
  ktc_value: number;
  tier: string;
  age: number | null;
  rank: number;
}

interface KTCScraperResult {
  [key: string]: KTCPlayer;
}

export type KtcProfileKey =
  | 'sf_ppr'
  | 'sf_ppr_tep_0_5'
  | 'sf_ppr_tep_1_0'
  | 'sf_ppr_tep_1_5'
  | 'one_qb_ppr'
  | 'one_qb_ppr_tep_0_5'
  | 'one_qb_ppr_tep_1_0'
  | 'one_qb_ppr_tep_1_5';

type KtcProfileRankingResult = Record<KtcProfileKey, KTCScraperResult>;

const KTC_PROFILE_CONFIG: Record<KtcProfileKey, { valueBucket: 'superflexValues' | 'oneQBValues'; tepKey?: 'tep' | 'tepp' | 'teppp' }> = {
  sf_ppr: { valueBucket: 'superflexValues' },
  sf_ppr_tep_0_5: { valueBucket: 'superflexValues', tepKey: 'tep' },
  sf_ppr_tep_1_0: { valueBucket: 'superflexValues', tepKey: 'tepp' },
  sf_ppr_tep_1_5: { valueBucket: 'superflexValues', tepKey: 'teppp' },
  one_qb_ppr: { valueBucket: 'oneQBValues' },
  one_qb_ppr_tep_0_5: { valueBucket: 'oneQBValues', tepKey: 'tep' },
  one_qb_ppr_tep_1_0: { valueBucket: 'oneQBValues', tepKey: 'tepp' },
  one_qb_ppr_tep_1_5: { valueBucket: 'oneQBValues', tepKey: 'teppp' },
};

function createEmptyProfileResults(): KtcProfileRankingResult {
  return Object.fromEntries(
    Object.keys(KTC_PROFILE_CONFIG).map((key) => [key, {}])
  ) as KtcProfileRankingResult;
}

function getPlayerSlug(playerName: string): string {
  return playerName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function readProfileValue(player: any, profileKey: KtcProfileKey): any {
  const config = KTC_PROFILE_CONFIG[profileKey];
  const baseValues = player?.[config.valueBucket] || {};
  return config.tepKey ? baseValues[config.tepKey] : baseValues;
}

function mapProfilePlayer(player: any, profileKey: KtcProfileKey, profileCount: number): KTCPlayer | null {
  const pos = player?.position;
  const playerName = player?.playerName;
  const profileValues = readProfileValue(player, profileKey);
  const ktcValue = Number(profileValues?.value || 0);
  const positionRank = Number(profileValues?.positionalRank || 0);

  if (!playerName || !pos || ktcValue <= 0 || positionRank <= 0) return null;

  return {
    name: playerName,
    position_rank: `${pos}${positionRank}`,
    ktc_value: ktcValue,
    tier: profileValues?.overallTier ? String(profileValues.overallTier) : 'Unknown',
    age: player.age || null,
    rank: Number(profileValues?.rank || profileCount + 1),
  };
}

/**
 * Scrape current KTC rankings from keeptradecut.com across supported QB and TEP profiles.
 * Fetches up to 500 players across multiple pages.
 */
export async function scrapeCurrentKTCRankingProfiles(): Promise<KtcProfileRankingResult> {
  try {
    const profiles = createEmptyProfileResults();
    const maxPages = 10; // 10 pages * ~50 players per page = ~500 players
    
    console.log('[KTC Live Scraper] Fetching ranking profiles across multiple pages...');
    
    for (let page = 0; page < maxPages; page++) {
      const url = `https://keeptradecut.com/dynasty-rankings?page=${page}&filters=QB|WR|RB|TE`;
      
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 15000
        });
        
        const html = response.data;
        
        // Extract playersArray from the HTML
        const playersArrayMatch = html.match(/var\s+playersArray\s*=\s*(\[[\s\S]*?\]);/);
        
        if (!playersArrayMatch) {
          console.warn(`[KTC Live Scraper] Could not find playersArray in HTML for page ${page}`);
          break; // Stop if we can't find players on this page
        }
        
        try {
          const playersArray: any[] = JSON.parse(playersArrayMatch[1]);
          
          // If no players on this page, we've reached the end
          if (playersArray.length === 0) {
            console.log(`[KTC Live Scraper] Reached end of rankings at page ${page}`);
            break;
          }
          
          playersArray.forEach((player) => {
            try {
              const slug = getPlayerSlug(player.playerName || '');
              if (!slug) return;

              for (const profileKey of Object.keys(KTC_PROFILE_CONFIG) as KtcProfileKey[]) {
                const profilePlayer = mapProfilePlayer(player, profileKey, Object.keys(profiles[profileKey]).length);
                if (profilePlayer) {
                  profiles[profileKey][slug] = profilePlayer;
                }
              }
            } catch (err) {
              // Silently skip parsing errors for individual players
            }
          });
          
          console.log(`[KTC Live Scraper] Page ${page}: scraped ${playersArray.length} players (SF total: ${Object.keys(profiles.sf_ppr).length})`);
        } catch (parseErr) {
          console.error(`[KTC Live Scraper] Error parsing playersArray JSON on page ${page}:`, parseErr);
          break;
        }
      } catch (pageError) {
        console.warn(`[KTC Live Scraper] Error fetching page ${page}:`, pageError);
        break; // Stop if we can't fetch a page
      }
    }
    
    console.log(`[KTC Live Scraper] Successfully scraped ${Object.keys(profiles.sf_ppr).length} total Superflex players`);
    return profiles;
  } catch (error) {
    console.error('[KTC Live Scraper] Error scraping KTC rankings:', error);
    return createEmptyProfileResults();
  }
}

/**
 * Scrape current KTC rankings from keeptradecut.com with Superflex scoring.
 */
export async function scrapeCurrentKTCRankings(): Promise<KTCScraperResult> {
  return (await scrapeCurrentKTCRankingProfiles()).sf_ppr;
}

/**
 * Get the latest KTC rankings, using cache if available
 */
let ktcRankingsCache: KTCScraperResult | null = null;
let ktcProfileRankingsCache: KtcProfileRankingResult | null = null;
let lastScrapedTime: number = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export async function getCurrentKTCRankingProfiles(forceRefresh = false): Promise<KtcProfileRankingResult> {
  const now = Date.now();
  
  if (ktcProfileRankingsCache && !forceRefresh && (now - lastScrapedTime) < CACHE_DURATION_MS) {
    console.log('[KTC Live Scraper] Using cached ranking profiles');
    return ktcProfileRankingsCache;
  }
  
  const profiles = await scrapeCurrentKTCRankingProfiles();
  const defaultRankings = profiles.sf_ppr;
  
  if (Object.keys(defaultRankings).length > 0) {
    ktcProfileRankingsCache = profiles;
    ktcRankingsCache = defaultRankings;
    lastScrapedTime = now;
  }
  
  return profiles;
}

export async function getCurrentKTCRankings(forceRefresh = false): Promise<KTCScraperResult> {
  const now = Date.now();

  if (ktcRankingsCache && !forceRefresh && (now - lastScrapedTime) < CACHE_DURATION_MS) {
    console.log('[KTC Live Scraper] Using cached rankings');
    return ktcRankingsCache;
  }

  return (await getCurrentKTCRankingProfiles(forceRefresh)).sf_ppr;
}

export function clearKTCRankingsCache() {
  ktcRankingsCache = null;
  ktcProfileRankingsCache = null;
  lastScrapedTime = 0;
}
