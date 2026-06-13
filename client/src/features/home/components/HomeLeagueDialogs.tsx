import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LeaguePickerCard,
  type HomeLeagueSelectionLeague,
} from "@/features/home/components/HomeLeagueSelection";
import { getLeagueStartRecommendation } from "@/features/home/lib/leagueHistory";

export type LeagueDialogUser = {
  avatarUrl?: string | null;
  displayName?: string | null;
  recentLeagueIds?: string[];
};

export function LeaguePickerDialog({
  open,
  leagues,
  sleeperUsername,
  activeCachedSleeperUser,
  isLeaguePickerIntelBusy,
  onOpenChange,
  onLeagueSelect,
  onStartOver,
}: {
  open: boolean;
  leagues: HomeLeagueSelectionLeague[];
  sleeperUsername: string;
  activeCachedSleeperUser?: LeagueDialogUser | null;
  isLeaguePickerIntelBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onLeagueSelect: (leagueId: string) => void;
  onStartOver: () => void;
}) {
  if (!leagues.length) return null;

  const recentLeagueContext = activeCachedSleeperUser?.recentLeagueIds
    ? { recentLeagueIds: activeCachedSleeperUser.recentLeagueIds }
    : null;
  const startRecommendation = isLeaguePickerIntelBusy
    ? null
    : getLeagueStartRecommendation(leagues, recentLeagueContext);
  const fallbackInitials = (
    sleeperUsername ||
    activeCachedSleeperUser?.displayName ||
    "SA"
  )
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="league-switch-dialog dd-glass-strong text-slate-100 sm:max-w-2xl">
        <DialogHeader className="league-switch-header text-center sm:text-center">
          <DialogTitle className="athletic-headline league-switch-title-gradient text-3xl">
            Pick Another League
          </DialogTitle>
          <DialogDescription className="league-switch-description text-cyan-100/70">
            <span className="league-switch-signed-in-line">
              <span>Signed in as</span>
              <span className="league-switch-user-chip">
                {activeCachedSleeperUser?.avatarUrl ? (
                  <img
                    src={activeCachedSleeperUser.avatarUrl}
                    alt=""
                    aria-hidden="true"
                    className="league-switch-user-avatar"
                  />
                ) : (
                  <span
                    className="league-switch-user-fallback"
                    aria-hidden="true"
                  >
                    {fallbackInitials}
                  </span>
                )}
                <strong>
                  {sleeperUsername ||
                    activeCachedSleeperUser?.displayName ||
                    "your Sleeper account"}
                </strong>
              </span>
            </span>
            {isLeaguePickerIntelBusy ? (
              <span>Syncing rankings and manager icons</span>
            ) : null}
            {startRecommendation ? (
              <span className="league-switch-start-hint">
                Start with <strong>{startRecommendation.leagueName}</strong>:{" "}
                {startRecommendation.reason}.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="home-league-picker league-switch-picker">
          {leagues.map(league => (
            <LeaguePickerCard
              key={league.leagueId}
              league={league}
              onSelect={onLeagueSelect}
              disabled={isLeaguePickerIntelBusy}
              startRecommendation={
                startRecommendation?.leagueId === league.leagueId
                  ? startRecommendation
                  : null
              }
            />
          ))}
        </div>
        <DialogFooter className="league-switch-footer sm:justify-center">
          <Button
            type="button"
            onClick={onStartOver}
            variant="outline"
            className="league-switch-start-over-button dd-pressable border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
          >
            Back to Sign In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChangeLeagueDialog({
  open,
  onOpenChange,
  onStay,
  onStartOver,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStay: () => void;
  onStartOver: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="league-switch-dialog change-league-dialog dd-glass-strong text-slate-100 sm:max-w-md">
        <DialogHeader className="change-league-header text-center sm:text-center">
          <DialogTitle className="athletic-headline change-league-title text-3xl text-orange-400">
            Change Leagues?
          </DialogTitle>
          <DialogDescription className="change-league-copy">
            This report was opened from a league ID, so there is not a
            saved Sleeper league list for this session. Stay on this
            report, or start over to analyze a different league.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="league-switch-footer gap-2 sm:justify-center">
          <button
            type="button"
            onClick={onStay}
            className="support-button support-button-compact change-league-stay-button dd-pressable"
          >
            Stay Here
          </button>
          <Button
            type="button"
            onClick={onStartOver}
            className="dd-pressable w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 sm:w-auto"
          >
            Back to Home
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
