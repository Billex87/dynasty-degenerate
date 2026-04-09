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
- [ ] Set up weekly scheduled job to run live KTC scraper (e.g., Tuesday 11 PM)
- [ ] Store weekly KTC snapshots in database for historical tracking

## Future Features (Optional)
- [ ] Waiver wire activity tracker tab
- [ ] Bench vs Start analysis
- [ ] Historical KTC tracking for non-rookie drafts
- [ ] Draft class comparison tools
