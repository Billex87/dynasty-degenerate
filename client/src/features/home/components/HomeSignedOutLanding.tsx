import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HomeFooterChrome,
  HomeHeaderChrome,
} from "@/features/home/components/HomeChrome";
import { HomeLandingFeatureCards } from "@/features/home/components/HomeLandingFeatureCards";
import {
  HomePortfolioPanel,
  type HomeLeagueSelectionLeague,
  type HomePortfolioRow,
} from "@/features/home/components/HomeLeagueSelection";
import { RecentEntrySuggestions } from "@/features/home/components/RecentEntrySuggestions";

interface HomeSignedOutLandingProps {
  showHomePortfolioPanel: boolean;
  homePortfolioRows: HomePortfolioRow[];
  filteredHomePortfolioRows: HomePortfolioRow[];
  orderedUserLeagues: HomeLeagueSelectionLeague[];
  isHomePortfolioLoading: boolean;
  portfolioSearch: string;
  onPortfolioSearchChange: (value: string) => void;
  onAnalyzeLeagueOption: (nextLeagueId: string) => void;
  leagueId: string;
  sleeperUsername: string;
  onSleeperUsernameChange: (value: string) => void;
  usernameAutocompleteHistory: string[];
  leagueIdHistory: string[];
  onLeagueIdChange: (value: string) => void;
  focusedAutocomplete: "username" | "league" | null;
  onFocusedAutocompleteChange: (value: "username" | "league" | null) => void;
  usernameAutocompleteOptions: string[];
  leagueIdAutocompleteOptions: string[];
  onUsernameAutocompleteSelect: (value: string) => void;
  onLeagueIdAutocompleteSelect: (value: string) => void;
  handleFindLeagues: () => void;
  isFindLeaguesPending: boolean;
  showLegacyLeagueIdLogin: boolean;
  handleAnalyze: () => void;
  isAnalysisBusy: boolean;
  showLoadingFooter: boolean;
  onStartOver: () => void;
  isLandingFaded: boolean;
  leaguePickerDialog: ReactNode;
  clownEasterEggDialog: ReactNode;
}

export function HomeSignedOutLanding({
  showHomePortfolioPanel,
  homePortfolioRows,
  filteredHomePortfolioRows,
  orderedUserLeagues,
  isHomePortfolioLoading,
  portfolioSearch,
  onPortfolioSearchChange,
  onAnalyzeLeagueOption,
  leagueId,
  sleeperUsername,
  onSleeperUsernameChange,
  usernameAutocompleteHistory,
  leagueIdHistory,
  onLeagueIdChange,
  focusedAutocomplete,
  onFocusedAutocompleteChange,
  usernameAutocompleteOptions,
  leagueIdAutocompleteOptions,
  onUsernameAutocompleteSelect,
  onLeagueIdAutocompleteSelect,
  handleFindLeagues,
  isFindLeaguesPending,
  showLegacyLeagueIdLogin,
  handleAnalyze,
  isAnalysisBusy,
  showLoadingFooter,
  onStartOver,
  isLandingFaded,
  leaguePickerDialog,
  clownEasterEggDialog,
}: HomeSignedOutLandingProps) {
  return (
    <>
      <div
        className="home-shell min-h-screen flex flex-col premium-fx-host"
        style={isLandingFaded ? { opacity: 0 } : undefined}
      >
        <HomeHeaderChrome onBrandClick={onStartOver} />
        <main className="home-main flex flex-col items-center justify-center">
          <div
            className={`home-hero home-hero-dashboard${
              showHomePortfolioPanel ? " home-hero-dashboard-portfolio" : ""
            }`}
          >
            <div className="home-hero-copy space-y-3 sm:space-y-4 text-center">
              <h2
                className="athletic-title home-title"
                aria-label="Fuck vibes. Use AI."
              >
                <span className="home-title-primary" data-text="FUCK VIBES.">
                  FUCK VIBES...
                </span>
                <span className="home-title-accent" data-text="USE AI.">
                  USE AI.
                </span>
              </h2>
              <p className="home-subtitle text-base sm:text-lg md:text-xl text-slate-300 mx-auto">
                Your league mates are guessing. <span className="home-subtitle-ai">WE'RE NOT!</span>
              </p>
              <p className="home-subtitle-detail">
                We use AI to expose roster cracks,
                <br /> trade windows, lineup leverage, and draft value before the rest
                of your league realizes
                <br /> they're playing for second place.
              </p>
            </div>

            <div className="home-analyze-card space-y-3 sm:space-y-4 p-4 sm:p-8">
              <div className="text-center">
                <label className="home-field-label block text-sm font-semibold text-slate-200 mb-2">
                  Enter Sleeper. Start Winning.
                </label>
                <div className="home-username-row flex flex-col gap-1.5 sm:flex-row sm:gap-2.5 w-full">
                  <div className="home-autocomplete-anchor flex-1 w-full sm:w-auto">
                    <Input
                      id="sleeper-username"
                      name="sleeper-username"
                      type="text"
                      aria-label="Enter Your Sleeper Username"
                      autoComplete="username"
                      list="sleeper-username-history"
                      placeholder="Sleeper username"
                      value={sleeperUsername}
                      onChange={e => onSleeperUsernameChange(e.target.value)}
                      onFocus={() => onFocusedAutocompleteChange("username")}
                      onBlur={() =>
                        window.setTimeout(
                          () => onFocusedAutocompleteChange(null),
                          120
                        )
                      }
                      className="w-full bg-slate-900 border-cyan-500/30 text-white placeholder:text-slate-500 h-12 text-base focus:border-cyan-300 text-center sm:text-left"
                      onKeyDown={e => e.key === "Enter" && handleFindLeagues()}
                    />
                    <datalist id="sleeper-username-history">
                      {usernameAutocompleteHistory.map(value => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                    {focusedAutocomplete === "username" ? (
                      <RecentEntrySuggestions
                        label="Recent Sleeper usernames"
                        options={usernameAutocompleteOptions}
                        onSelect={value => {
                          onUsernameAutocompleteSelect(value);
                        }}
                      />
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    onClick={handleFindLeagues}
                    disabled={isFindLeaguesPending}
                    className="home-find-leagues-button h-12 w-full shrink-0 rounded-lg border border-orange-400/40 bg-gradient-to-r from-orange-500 to-orange-600 px-5 font-bold text-white hover:from-orange-600 hover:to-orange-700 sm:w-auto"
                  >
                    {isFindLeaguesPending
                      ? "Finding Leagues..."
                      : "Find Leagues"}
                  </Button>
                </div>
              </div>

              {showLegacyLeagueIdLogin ? (
                <>
                  <div className="home-id-divider">
                    <span>or use a league ID</span>
                  </div>

                  <div className="text-center">
                    <label className="home-field-label block text-sm font-semibold text-slate-200 mb-2">
                      Enter Your Sleeper League ID
                    </label>
                    <div className="home-autocomplete-anchor w-full">
                      <Input
                        id="sleeper-league-id"
                        name="sleeper-league-id"
                        type="text"
                        aria-label="Enter Your Sleeper League ID"
                        autoComplete="on"
                        inputMode="numeric"
                        list="sleeper-league-id-history"
                        placeholder="Find in your Sleeper app settings or URL"
                        value={leagueId}
                        onChange={e => onLeagueIdChange(e.target.value)}
                        onFocus={() => onFocusedAutocompleteChange("league")}
                        onBlur={() =>
                          window.setTimeout(
                            () => onFocusedAutocompleteChange(null),
                            120
                          )
                        }
                        className="w-full bg-slate-900 border-orange-500/30 text-white placeholder:text-slate-500 h-12 text-base focus:border-orange-400 text-center"
                        onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                      />
                      <datalist id="sleeper-league-id-history">
                        {leagueIdHistory.map(value => (
                          <option key={value} value={value} />
                        ))}
                      </datalist>
                      {focusedAutocomplete === "league" ? (
                        <RecentEntrySuggestions
                          label="Recent Sleeper league IDs"
                          options={leagueIdAutocompleteOptions}
                          onSelect={value => {
                            onLeagueIdAutocompleteSelect(value);
                          }}
                        />
                      ) : null}
                    </div>
                  </div>

                  <Button
                    onClick={() => handleAnalyze()}
                    disabled={isAnalysisBusy}
                    className="home-analyze-button w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold text-base gap-2 rounded-lg transition-all duration-200 shadow-lg"
                  >
                    Run Degenerate Analysis
                  </Button>
                </>
              ) : null}
            </div>

            {!showHomePortfolioPanel ? (
              <div className="home-weapons-callout">
                <p className="home-weapons-callout-title">
                  <span className="home-weapons-callout-blue">
                    THESE AREN’T FEATURES.
                  </span>
                  <span className="home-weapons-callout-orange">
                    THEY’RE WEAPONS.
                  </span>
                </p>
                <p className="home-weapons-callout-copy">
                  <span className="home-weapons-copy-line">
                    Run the scan. Find the weakness. Send the offer.
                  </span>
                  <br />
                  {' '}
                  <span className="home-weapons-copy-line">
                    Make them regret inviting you.
                  </span>
                </p>
              </div>
            ) : null}

            {showHomePortfolioPanel ? (
              <HomePortfolioPanel
                rows={homePortfolioRows}
                filteredRows={filteredHomePortfolioRows}
                leagues={orderedUserLeagues}
                isLoading={isHomePortfolioLoading}
                query={portfolioSearch}
                onQueryChange={onPortfolioSearchChange}
                onLeagueSelect={onAnalyzeLeagueOption}
              />
            ) : null}

            <HomeLandingFeatureCards />
          </div>
        </main>

        {showLoadingFooter ? (
          <div className="home-footer mt-auto px-4 py-1">
            <HomeFooterChrome showBrand={!isAnalysisBusy} />
          </div>
        ) : null}
        {leaguePickerDialog}
        {clownEasterEggDialog}
      </div>
    </>
  );
}
