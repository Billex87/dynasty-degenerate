import { type LeagueValueMode } from "@/lib/leagueValueMode";

type OwnerScoreLens = {
  fullRosterScore: number | null;
  dynastyScore: number | null;
  contenderScore: number | null;
  rebuilderScore: number | null;
};

export function formatOwnerScore(value?: number | null): string {
  const score = typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
  return score === null ? "-" : String(score);
}

export function OwnerScoreStrip({
  scores,
  compact = false,
  leagueValueMode = "dynasty",
}: {
  scores: OwnerScoreLens;
  compact?: boolean;
  leagueValueMode?: LeagueValueMode;
}) {
  const isRedraft = leagueValueMode === "redraft";
  const renderLabel = (fullLabel: string, shortLabel: string) => (
    <strong>
      <span className="owner-intel-score-label-full">{fullLabel}</span>
      <span className="owner-intel-score-label-short">{shortLabel}</span>
    </strong>
  );

  return (
    <span
      className={`owner-intel-score-strip${compact ? " owner-intel-score-strip-compact" : ""}`}
      aria-label="Manager score lenses"
    >
      <span>
        {renderLabel("Roster", "Full")}
        <em>{formatOwnerScore(scores.fullRosterScore)}</em>
      </span>
      <span>
        {renderLabel(
          isRedraft ? "Current" : "Dynasty",
          isRedraft ? "Cur" : "Dyn"
        )}
        <em>{formatOwnerScore(scores.dynastyScore)}</em>
      </span>
      <span>
        {renderLabel(
          isRedraft ? "Starters" : "Contend",
          isRedraft ? "St" : "Cnt"
        )}
        <em>{formatOwnerScore(scores.contenderScore)}</em>
      </span>
      <span>
        {renderLabel(
          isRedraft ? "Bench" : "Rebuild",
          isRedraft ? "Bn" : "Reb"
        )}
        <em>{formatOwnerScore(scores.rebuilderScore)}</em>
      </span>
    </span>
  );
}
