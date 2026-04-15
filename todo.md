# Dynasty Degenerates - Project TODO

## Completed Features

### Core Infrastructure
- [x] Header layout finalized: Dynasty Degenerates logo/title on left, league name (larger font) on right
- [x] League logo from Sleeper API displayed next to league name in header
- [x] All section headers centered across all tabs
- [x] Footer section with "Analyze Another League" and "Export CSV" buttons
- [x] Input field label and league ID value centered on landing page
- [x] All tables updated with consistent centering (flex justify-center wrappers)
- [x] Dynasty Degenerates logo set as favicon

### Draft History Tab
- [x] Draft History tab created with Full Draft Board and Draft Capital Efficiency tables
- [x] Draft data fetching updated to pull from both current and previous league seasons
- [x] Filter added to only include rookie drafts with fewer than 100 picks
- [x] Manager names correctly resolved using user_id-to-name mapping
- [x] Draft Capital Efficiency numbers rounded to whole numbers (no decimals)
- [x] Color-coded value change indicators (green/red with trending arrows) implemented
- [x] Draft picks display with proper KTC value matching using slug-based lookup
- [x] Table widths made consistent: Draft Capital Efficiency (max-w-6xl) and Full Draft Board (max-w-7xl)

### KTC Historical Data Integration
- [x] Wayback Machine scraper infrastructure created
- [x] May 2025 KTC rookie data successfully scraped from archive (96 players)
- [x] Verified correct values: Ashton Jeanty = 7830, Omarion Hampton = 6241
- [x] waybackMachineScraper.ts created with getMay2025KTCSnapshot() function
- [x] draftAnalysis.ts updated to use May 2025 KTC values for value change calculations
- [x] routers.ts updated to pass May 2025 KTC data to analyzeDraftPicks
- [x] Value Change column now shows accurate draft-day value comparisons
- [x] Flexible slug matching implemented to handle both simple and hyphenated player slugs
- [x] Browser tested: Value changes correctly calculated (e.g., Ashton Jeanty -364, Omarion Hampton +556)
- [x] Position rank data extracted from May 2025 snapshot (60+ players with RB/WR/QB/TE rankings)
- [x] Position Rank (May 2025) column added to Draft Board table
- [x] DraftPick interface updated with position rank fields
- [x] Browser tested: Position ranks displayed correctly (e.g., Ashton Jeanty RB3, Omarion Hampton RB5)
- [x] All 22 unit tests passing

### Database & Scheduled Jobs
- [x] ktcSnapshots database table confirmed to exist and be properly configured
- [x] KTC Tuesday 11 PM snapshot job confirmed in place (ktcSnapshotJob.ts + scheduledJobs.ts)

### Draft Year & Position Rank Tracking
- [x] Add draft year labels (2025 vs 2026) to Full Draft Board
- [x] Add Current Position Rank column to Draft Board
- [x] Add Position Change column (green/red with spot movement)
- [x] Fetch current KTC position ranks for all players
- [x] Calculate position rank changes (current - May 2025)
- [x] Created currentKTCLoader.ts to load current position ranks
- [x] Updated draftAnalysis.ts to handle position rank calculations
- [x] Updated DraftAnalysis.tsx to display all new columns
- [x] Browser tested: Position changes displaying correctly (e.g., Ashton Jeanty +1, Travis Hunter +3)
- [x] All 22 unit tests passing

### Live KTC Scraper Integration (Superflex)
- [x] Create liveKTCScraper.ts to fetch current KTC rankings from keeptradecut.com
- [x] Parse playersArray JSON from KTC page (500+ players)
- [x] Extract position ranks (RB1, RB2, WR1, etc.) and KTC values from Superflex data
- [x] Use pre-calculated superflex.value and superflex.positionalRank fields
- [x] Update currentKTCLoader.ts to use live scraper instead of static file
- [x] Ensure position rank changes calculate correctly with live Superflex data
- [x] Browser tested: Live Superflex KTC data displaying correctly (Josh Allen 9998, Bijan Robinson 9993, etc.)
- [x] All 22 unit tests passing
- [x] Set up weekly scheduled job to run live KTC scraper (e.g., Tuesday 11 PM)
- [x] Store weekly KTC snapshots in database for historical tracking

## Future Features (Optional)
- [ ] Waiver wire activity tracker tab
- [ ] Bench vs Start analysis
- [ ] Historical KTC tracking for non-rookie drafts
- [ ] Draft class comparison tools

## Current Issues to Fix
- [x] Draft year showing 2026 instead of 2025 for all picks
- [x] Manager names showing "Unknown" instead of resolved names
- [x] Remove Year column from Full Draft Board table
- [x] Remove Draft Pick Position column from Full Draft Board table
- [x] Rename "Position Rank (May 2025)" to "Drafted Rank"
- [x] Rename "Current Position Rank" to "Current Rank"
- [x] Fix table width to prevent column cutoff
- [x] Add header "2025 Rookie Draft" (or appropriate year) above Full Draft Board table

### Draft Capital Efficiency Interactive Feature
- [x] Make manager names clickable in Draft Capital Efficiency table
- [x] Create modal component to display manager's draft picks
- [x] Modal shows: Player Name, Position, Position Change, Value Change
- [x] Test modal functionality and ensure all tests pass

### KTC Data Expansion
- [x] Updated live KTC scraper to fetch 500 players across 10 pages instead of just first page
- [x] Fixed data incongruences for Trevor Etienne and Jarquez Hunter by expanding scraper reach
- [x] Verified all 22 tests passing after scraper update

### Data Quality Fixes
- [x] Fixed Jarquez Hunter and Trevor Etienne showing WR90 instead of N/A when not in current KTC data
- [x] Updated draftAnalysis.ts to return null instead of fallback values
- [x] All 22 tests passing after fix

### Hit/Miss Threshold Update
- [x] Updated hit/miss calculation thresholds from 5 position ranks/500 value to 10 position ranks/750 value
- [x] All 22 tests passing after threshold update

### Modal & Sorting Enhancements
- [x] Added Current Rank and Current Value columns to manager draft picks modal
- [x] Made Current Value column sortable in Full Draft Board table (ascending/descending)
- [x] Made Value Change column sortable in Full Draft Board table (ascending/descending)
- [x] Added visual indicator (arrow icon) to show which column is sorted
- [x] All 22 tests passing after enhancements

### Position Depth & Manager Position Counts
- [x] Update Position Depth Analysis thresholds (QB: 4/5, RB: 8/12, WR: 8/12, TE: 4/6)
- [x] Add Manager Position Counts table to Overview page
- [x] Display QB, RB, WR, TE counts per manager
- [x] All 22 tests passing after changes

### Dynamic Position Depth Thresholds
- [x] Updated Position Depth Analysis to calculate thresholds dynamically
- [x] Thresholds now based on min/max of actual manager position counts
- [x] Shortage = below league minimum, Excess = above league maximum
- [x] All 22 tests passing after dynamic threshold implementation

### Player Headshots Feature
- [x] Attempted Sleeper API headshots (403 Forbidden - blocked)
- [x] Attempted NFL.com headshots (TLS connection errors blocking league data load)
- [x] Attempted Pro Football Reference headshots (403 Forbidden - blocked)
- [x] Attempted ESPN headshots (500 errors - blocked)
- [x] Implemented image proxy service with browser headers to bypass CDN restrictions
- [x] Created imageProxy.ts with caching service (7-day TTL)
- [x] Added images.playerHeadshot tRPC endpoint
- [x] Updated PlayerDetailModal to display headshots
- [x] All 22 tests passing

### Player Detail Modal for Draft Board
- [x] Create PlayerDetailModal component showing all player data in multi-row format
- [x] Make player names clickable in Full Draft Board table
- [x] Modal shows: Drafted Rank, Current Rank, Position Change, Current Value, Value Change, ADP, Manager, Round, Pick #
- [x] Optimize modal layout for mobile (no horizontal scrolling)
- [x] Update Full Draft Board table columns to show: Pick, Player, Position Change, Current Value, Value Change
- [x] Remove other columns from main table (Drafted Rank, Current Rank, ADP, Manager, Round, etc.)
- [x] Restore sorting for Current Value and Value Change columns
- [x] All 22 tests passing after changes

### Modal Refinements
- [x] Remove ADP field from player detail modal
- [x] Fix Draft Value to show original draft-time value (Current Value - Value Change)
- [x] All 22 tests passing after refinements

### GitHub Push & Table Updates
- [x] Push current state to GitHub
- [x] Simplify Trade Ledger table to show: Date, Winner, Loser, Gap (keep modal data as is)
- [x] Make entire rows clickable to open modals (Draft Board and Trade Ledger)
- [x] All 22 tests passing after changes

### Draft Capital Efficiency & Manager Picks Integration
- [x] Make entire rows in Draft Capital Efficiency table clickable to open manager picks modal
- [x] Update ManagerDraftPicksModal to support player detail modal on player row clicks
- [x] Player rows in manager picks modal open the same player detail modal as Draft Board
- [x] All 22 tests passing after changes


### Starters Column in Draft Capital Efficiency
- [x] Add Starters column to Draft Capital Efficiency table
- [x] Count players with KTC value > 4000 for each manager
- [x] Display count in new Starters column
- [x] All 22 tests passing after changes


### Headshots Next to Player Names
- [x] Add small circular headshots next to player names in Draft Board table
- [x] Add small circular headshots next to player names in manager draft picks modal
- [x] Optimize headshot size for mobile readability (6px on mobile, 7px on desktop)
- [x] Use flexbox layout to keep text readable on mobile
- [x] All 22 tests passing after changes

### Headshots in Weekly Risers and Fallers
- [x] Add headshots next to player names in Weekly Risers table
- [x] Add headshots next to player names in Weekly Fallers table
- [x] All 22 tests passing after changes


### Manager Position Counts - Starters Sub-Columns
- [ ] Add Starters sub-column next to QB count (QB S)
- [ ] Add Starters sub-column next to RB count (RB S)
- [ ] Add Starters sub-column next to WR count (WR S)
- [ ] Add Starters sub-column next to TE count (TE S)
- [ ] Count players with value > 4000 for each position
- [ ] Update ManagerDraftStats type to include starter counts per position
- [ ] All 22 tests passing after changes
