import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { type PreviewMetric, PreviewMetricChips, ReportSectionHeader } from '@/components/reportPrimitives';

export function DraftCollapsibleSection({
  title,
  kicker,
  previewMetrics,
  open,
  onToggle,
  children,
}: {
  title: string;
  kicker?: string;
  previewMetrics?: PreviewMetric[];
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details className="report-section report-disclosure" open={open} onToggle={(event) => onToggle?.(event.currentTarget.open)}>
      <summary className="report-disclosure-summary">
        <ReportSectionHeader title={title} kicker={kicker} />
        <PreviewMetricChips metrics={previewMetrics} className="report-disclosure-preview" />
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </summary>
      <div className="report-disclosure-body">
        <div className="report-disclosure-body-inner">
          {children}
        </div>
      </div>
    </details>
  );
}
