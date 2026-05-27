import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingAnimation } from "@/features/report/components/LoadingAnimation";
import type { LoaderManagerAnchor } from "@/features/report/components/LoaderKitBackdrop";

export type LoadingTransitionPhase =
  | "loading"
  | "success"
  | "reveal"
  | "kick"
  | "done";

export type AnalysisLoadingLeague = {
  leagueName: string;
  leagueFormat: string;
  leagueLogo: string | null;
};

export function ClownEasterEggDialog({
  open,
  onOpenChange,
  onDismiss,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="clown-easter-egg-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-lg">
        <DialogHeader className="text-center">
          <DialogTitle className="athletic-headline text-3xl text-orange-400">
            Rival Alert
          </DialogTitle>
          <DialogDescription className="text-cyan-100/75">
            This username unlocked a special screen.
          </DialogDescription>
        </DialogHeader>
        <div className="clown-easter-egg-body">
          <div className="clown-easter-egg-face" aria-hidden="true">
            🤡
          </div>
          <p className="clown-easter-egg-copy">Rival league energy detected.</p>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            onClick={onDismiss}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 sm:w-auto"
          >
            Back To Login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AnalysisLoadingDialog({
  open,
  previewMode,
  previewLoadingLoopTick,
  analysisCompleteMessage,
  loadingTransitionPhase,
  loadingLeague,
  loadingManagerAnchors,
}: {
  open: boolean;
  previewMode: string | null;
  previewLoadingLoopTick: number;
  analysisCompleteMessage: AnalysisLoadingLeague | null;
  loadingTransitionPhase: LoadingTransitionPhase;
  loadingLeague: AnalysisLoadingLeague | null;
  loadingManagerAnchors: LoaderManagerAnchor[];
}) {
  return (
    <Dialog
      key="analysis-loading-dialog"
      open={open}
      onOpenChange={() => undefined}
    >
      <DialogContent
        className={`analysis-loading-dialog analysis-loading-dialog-${loadingTransitionPhase} border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-lg`}
        overlayClassName={`analysis-loading-overlay analysis-loading-overlay-${loadingTransitionPhase}`}
        style={{
          filter: "none",
          backdropFilter: "none",
        }}
        showCloseButton={false}
        onEscapeKeyDown={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {analysisCompleteMessage
              ? "League Report Ready"
              : "Analyzing League"}
          </DialogTitle>
          <DialogDescription>
            {analysisCompleteMessage
              ? "The league report is ready."
              : "Generating the selected league report."}
          </DialogDescription>
        </DialogHeader>
        <div className="analysis-loading-modal-body">
          <LoadingAnimation
            key={previewMode === "loading-loop" ? `loading-loop-${previewLoadingLoopTick}` : "loading"}
            isComplete={Boolean(analysisCompleteMessage)}
            phase={loadingTransitionPhase}
            leagueName={loadingLeague?.leagueName}
            leagueFormat={loadingLeague?.leagueFormat}
            leagueLogo={loadingLeague?.leagueLogo}
            managerAnchors={loadingManagerAnchors}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminAccessDialog({
  open,
  passphrase,
  isPending,
  onOpenChange,
  onPassphraseChange,
  onSubmit,
  onStayRegularView,
}: {
  open: boolean;
  passphrase: string;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onPassphraseChange: (value: string) => void;
  onSubmit: () => void;
  onStayRegularView: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-unlock-dialog border-orange-400/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-orange-950/30 sm:max-w-lg">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="athletic-headline text-center text-3xl text-orange-300">
            Unlock Admin Tools
          </DialogTitle>
          <DialogDescription className="text-center text-slate-300">
            If you do not have the passphrase, stay in regular report view.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Input
            type="password"
            value={passphrase}
            onChange={event => onPassphraseChange(event.target.value)}
            placeholder="Admin passphrase"
            autoComplete="current-password"
            className="admin-unlock-passphrase-input border-orange-400/20 bg-slate-950/80 text-center text-slate-100 placeholder:text-center placeholder:text-slate-500"
          />
          <DialogFooter className="gap-2 sm:items-center sm:justify-center">
            <Button
              type="submit"
              disabled={!passphrase.trim() || isPending}
              className="admin-unlock-primary-button w-full font-black sm:w-auto"
            >
              {isPending ? "Unlocking..." : "Unlock Admin Tools"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-700 text-slate-200 hover:bg-slate-900 sm:w-auto"
              onClick={onStayRegularView}
            >
              Stay in Regular View
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUnlockDialog({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onDismiss();
      }}
    >
      <DialogContent className="admin-unlock-dialog border-orange-400/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-orange-950/30 sm:max-w-lg">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="athletic-headline text-center text-3xl text-orange-300">
            Congrats
          </DialogTitle>
          <DialogDescription className="text-center text-slate-300">
            Your admin session has premium AI reads, blueprint
            reports, league power tools and market signals
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:items-center sm:justify-center">
          <Button
            type="button"
            onClick={onDismiss}
            className="admin-unlock-primary-button w-full font-black sm:w-auto"
          >
            Enter Command Center
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
