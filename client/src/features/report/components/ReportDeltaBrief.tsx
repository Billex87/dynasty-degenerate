import { Bot, ClipboardList } from "lucide-react";
import { AITronSurface, type AITronTheme } from "@/components/AITronSurface";
import { getAIDeltaBriefCopy } from "@/lib/aiVoice";

export type ReportDeltaTone = "good" | "info" | "warn" | "danger" | "neutral";

export type ReportDeltaChange = {
  id: string;
  label: string;
  summary: string;
  detail: string;
  tone: ReportDeltaTone;
  receipts: string[];
  priority: number;
};

function formatReportDeltaSavedAt(value?: number | null): string {
  if (!value || !Number.isFinite(value)) return "the last saved report";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "the last saved report";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getReportDeltaTronTheme(tone: ReportDeltaTone): AITronTheme {
  if (tone === "good") return "green";
  if (tone === "warn") return "amber";
  if (tone === "danger") return "red";
  if (tone === "info") return "blue";
  return "cyan";
}

function getReportDeltaSurfaceClass(tone: ReportDeltaTone): string {
  if (tone === "good") return "ai-neural-surface-core";
  if (tone === "danger") return "ai-neural-surface-risk";
  if (tone === "warn") return "ai-neural-surface-draft";
  return "ai-neural-surface-window";
}

export function ReportSinceLastReportBrief({
  changes,
  previousSavedAt,
}: {
  changes: ReportDeltaChange[];
  previousSavedAt?: number | null;
}) {
  if (!changes.length) return null;
  const visibleChanges = changes.slice(0, 3);
  const primaryChange = visibleChanges[0];
  const hiddenCount = Math.max(0, changes.length - visibleChanges.length);
  const deltaCopy = getAIDeltaBriefCopy(hiddenCount);

  return (
    <section
      className={`report-delta-brief ai-surface-r3f ai-neural-surface-tron ${getReportDeltaSurfaceClass(primaryChange.tone)}`}
      aria-label="Changed since last report"
    >
      <AITronSurface
        theme={getReportDeltaTronTheme(primaryChange.tone)}
        density="small"
        routeKey={`report-delta-${primaryChange.id}-${visibleChanges.length}`}
      />
      <div className="report-delta-brief-copy">
        <span className="report-delta-brief-kicker">
          <Bot aria-hidden="true" />
          {deltaCopy.kicker}
          <em>Since {formatReportDeltaSavedAt(previousSavedAt)}</em>
        </span>
        <h2>{deltaCopy.title}</h2>
        <p>{primaryChange.summary}</p>
      </div>
      <div className="report-delta-brief-list">
        {visibleChanges.map(change => (
          <article key={change.id} data-tone={change.tone}>
            <span>
              <ClipboardList aria-hidden="true" />
              {change.label}
            </span>
            <strong>{change.summary}</strong>
            <p>{change.detail}</p>
            <div className="report-delta-brief-receipts">
              {change.receipts.slice(0, 2).map(receipt => (
                <em key={receipt}>{receipt}</em>
              ))}
            </div>
          </article>
        ))}
        {deltaCopy.hidden && (
          <span className="report-delta-brief-more">{deltaCopy.hidden}</span>
        )}
      </div>
    </section>
  );
}
