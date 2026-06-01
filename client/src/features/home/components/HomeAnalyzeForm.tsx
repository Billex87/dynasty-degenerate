import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecentEntrySuggestions } from "@/features/home/components/RecentEntrySuggestions";

interface HomeAnalyzeFormProps {
  showLegacyLeagueIdLogin: boolean;
  leagueId: string;
  sleeperUsername: string;
  leagueIdHistory: string[];
  focusedAutocomplete: "username" | "league" | null;
  usernameAutocompleteOptions: string[];
  leagueIdAutocompleteOptions: string[];
  isFindLeaguesPending: boolean;
  isAnalysisBusy: boolean;
  analysisErrorMessage?: string | null;
  onFocusedAutocompleteChange: (value: "username" | "league" | null) => void;
  onSleeperUsernameChange: (value: string) => void;
  onLeagueIdChange: (value: string) => void;
  onUsernameAutocompleteSelect: (value: string) => void;
  onLeagueIdAutocompleteSelect: (value: string) => void;
  handleFindLeagues: () => void;
  handleAnalyze: () => void;
}

export function HomeAnalyzeForm({
  showLegacyLeagueIdLogin,
  leagueId,
  sleeperUsername,
  leagueIdHistory,
  focusedAutocomplete,
  usernameAutocompleteOptions,
  leagueIdAutocompleteOptions,
  isFindLeaguesPending,
  isAnalysisBusy,
  analysisErrorMessage,
  onFocusedAutocompleteChange,
  onSleeperUsernameChange,
  onLeagueIdChange,
  onUsernameAutocompleteSelect,
  onLeagueIdAutocompleteSelect,
  handleFindLeagues,
  handleAnalyze,
}: HomeAnalyzeFormProps) {
  return (
    <div className="home-analyze-card space-y-3 sm:space-y-4 p-4 sm:p-8">
      <div className="text-center">
        <label
          htmlFor="sleeper-username"
          className="home-field-label block text-sm font-semibold text-slate-200 mb-2"
        >
          Enter Sleeper. Start Winning.
        </label>
        <div className="home-username-row flex flex-col gap-1.5 sm:flex-row sm:gap-2.5 w-full">
          <div className="home-autocomplete-anchor flex-1 w-full sm:w-auto">
            <Input
              id="sleeper-username"
              name="sleeper-username-search"
              type="text"
              aria-label="Enter Your Sleeper Username"
              autoComplete="new-password"
              autoCorrect="off"
              data-1p-ignore="true"
              data-form-type="other"
              data-lpignore="true"
              spellCheck={false}
              placeholder="Sleeper username"
              value={sleeperUsername}
              onChange={e => onSleeperUsernameChange(e.target.value)}
              onFocus={() => onFocusedAutocompleteChange("username")}
              onBlur={() =>
                window.setTimeout(() => onFocusedAutocompleteChange(null), 120)
              }
              className="home-entry-field home-entry-field--cyan text-center sm:text-left focus:border-cyan-300"
              onKeyDown={e => e.key === "Enter" && handleFindLeagues()}
            />
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
            {isFindLeaguesPending ? "Finding Leagues..." : "Find Leagues"}
          </Button>
        </div>
      </div>

      {analysisErrorMessage ? (
        <div
          className="rounded-lg border border-red-400/40 bg-red-950/55 px-3 py-2 text-sm font-medium text-red-100"
          role="alert"
        >
          {analysisErrorMessage}
        </div>
      ) : null}

      {showLegacyLeagueIdLogin ? (
        <>
          <div className="home-id-divider">
            <span>or use a league ID</span>
          </div>

          <div className="text-center">
            <label
              htmlFor="sleeper-league-id"
              className="home-field-label block text-sm font-semibold text-slate-200 mb-2"
            >
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
                className="home-entry-field home-entry-field--orange text-center focus:border-orange-400"
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
  );
}
