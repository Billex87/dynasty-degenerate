import type { ReactNode } from "react";

import {
  HomeFooterChrome,
  HomeHeaderChrome,
} from "@/features/home/components/HomeChrome";
import { HomeLandingFeatureCards } from "@/features/home/components/HomeLandingFeatureCards";
import { HomeAnalyzeForm } from "@/features/home/components/HomeAnalyzeForm";
import {
  HomePortfolioPanel,
  type HomeLeagueSelectionLeague,
  type HomePortfolioRow,
} from "@/features/home/components/HomeLeagueSelection";

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
  homeDialogs: ReactNode;
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
  homeDialogs,
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

            <HomeAnalyzeForm
              showLegacyLeagueIdLogin={showLegacyLeagueIdLogin}
              leagueId={leagueId}
              sleeperUsername={sleeperUsername}
              usernameAutocompleteHistory={usernameAutocompleteHistory}
              leagueIdHistory={leagueIdHistory}
              focusedAutocomplete={focusedAutocomplete}
              usernameAutocompleteOptions={usernameAutocompleteOptions}
              leagueIdAutocompleteOptions={leagueIdAutocompleteOptions}
              isFindLeaguesPending={isFindLeaguesPending}
              isAnalysisBusy={isAnalysisBusy}
              onFocusedAutocompleteChange={onFocusedAutocompleteChange}
              onSleeperUsernameChange={onSleeperUsernameChange}
              onLeagueIdChange={onLeagueIdChange}
              onUsernameAutocompleteSelect={onUsernameAutocompleteSelect}
              onLeagueIdAutocompleteSelect={onLeagueIdAutocompleteSelect}
              handleFindLeagues={handleFindLeagues}
              handleAnalyze={handleAnalyze}
            />

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
        {homeDialogs}
      </div>
    </>
  );
}
