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

/**
 * Scrape current KTC rankings from keeptradecut.com with Superflex scoring
 * Fetches up to 500 players across multiple pages
 */
export async function scrapeCurrentKTCRankings(): Promise<KTCScraperResult> {
  try {
    const players: KTCScraperResult = {};
    const maxPages = 10; // 10 pages * ~50 players per page = ~500 players
    
    console.log('[KTC Live Scraper] Fetching rankings across multiple pages...');
    
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
          
          // Process each player
          playersArray.forEach((player, idx) => {
            try {
              const pos = player.position;
              
              // Get KTC value and position rank from superflexValues
              const superflex = player.superflexValues || {};
              const ktcValue = superflex.value || 0;
              const positionRank = superflex.positionalRank || 0;
              
              if (ktcValue > 0 && positionRank > 0) {
                // Create slug using same format as draftAnalysis.ts for consistent matching
                const slug = player.playerName
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, '')
                  .trim();
                
                players[slug] = {
                  name: player.playerName,
                  position_rank: `${pos}${positionRank}`,
                  ktc_value: ktcValue,
                  tier: 'Unknown', // Tier info not readily available in this data
                  age: player.age || null,
                  rank: Object.keys(players).length + 1
                };
              }
            } catch (err) {
              // Silently skip parsing errors for individual players
            }
          });
          
          console.log(`[KTC Live Scraper] Page ${page}: scraped ${playersArray.length} players (total: ${Object.keys(players).length})`);
        } catch (parseErr) {
          console.error(`[KTC Live Scraper] Error parsing playersArray JSON on page ${page}:`, parseErr);
          break;
        }
      } catch (pageError) {
        console.warn(`[KTC Live Scraper] Error fetching page ${page}:`, pageError);
        break; // Stop if we can't fetch a page
      }
    }
    
    console.log(`[KTC Live Scraper] Successfully scraped ${Object.keys(players).length} total players from Superflex`);
    return players;
  } catch (error) {
    console.error('[KTC Live Scraper] Error scraping KTC rankings:', error);
    return {};
  }
}

/**
 * Get the latest KTC rankings, using cache if available
 */
let ktcRankingsCache: KTCScraperResult | null = null;
let lastScrapedTime: number = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export async function getCurrentKTCRankings(forceRefresh = false): Promise<KTCScraperResult> {
  const now = Date.now();
  
  // Return cached data if available and not expired
  if (ktcRankingsCache && !forceRefresh && (now - lastScrapedTime) < CACHE_DURATION_MS) {
    console.log('[KTC Live Scraper] Using cached rankings');
    return ktcRankingsCache;
  }
  
  // Scrape fresh data
  const rankings = await scrapeCurrentKTCRankings();
  
  if (Object.keys(rankings).length > 0) {
    ktcRankingsCache = rankings;
    lastScrapedTime = now;
  }
  
  return rankings;
}

export function clearKTCRankingsCache() {
  ktcRankingsCache = null;
  lastScrapedTime = 0;
}
