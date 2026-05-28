import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AutopilotErrorFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <section className="autopilot-dashboard autopilot-error-fallback">
      <div className="autopilot-hero">
        <div className="autopilot-hero-copy">
          <span className="autopilot-system-badge inline-pill-shell">
            <Bot className="h-4 w-4" aria-hidden="true" />
            AI Team Autopilot
          </span>
          <h2>Autopilot read paused</h2>
          <p>
            The rest of the report is still available while this tab recovers
            from an unexpected readout issue.
          </p>
        </div>
        <Button type="button" onClick={onRetry} variant="outline">
          Retry Autopilot
        </Button>
      </div>
      {error?.message && (
        <p className="autopilot-footer-read">Issue: {error.message}</p>
      )}
    </section>
  );
}
