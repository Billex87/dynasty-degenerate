import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { ChevronDown } from "lucide-react";

import {
  PreviewMetricChips,
  ReportSectionHeader,
  type PreviewMetric,
} from "@/components/reportPrimitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ReportSectionLoadingFallback() {
  return (
    <div className="rankings-empty-state" role="status" aria-live="polite">
      Loading report section...
    </div>
  );
}

type ReportSectionAccordionContextValue = {
  activeSectionId: string | null;
  setActiveSectionId: (sectionId: string | null) => void;
};

const ReportSectionAccordionContext =
  createContext<ReportSectionAccordionContextValue | null>(null);

export function CollapsibleReportSection({
  title,
  kicker,
  previewMetrics,
  previewAccessory,
  afterSummaryAccessory,
  previewAccessoryPlacement = "end",
  defaultOpen = false,
  openSignal = 0,
  premium = false,
  targetKey,
  onOpenChange,
  children,
}: {
  title: string;
  kicker?: string;
  previewMetrics?: PreviewMetric[];
  previewAccessory?: ReactNode;
  afterSummaryAccessory?: ReactNode;
  previewAccessoryPlacement?: "end" | "middle";
  defaultOpen?: boolean;
  openSignal?: number;
  premium?: boolean;
  targetKey?: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const accordion = useContext(ReportSectionAccordionContext);
  const sectionId = useId();
  const isOpen = accordion
    ? accordion.activeSectionId === sectionId
    : defaultOpen;
  const [localIsOpen, setLocalIsOpen] = useState(defaultOpen);
  const [hasRenderedContent, setHasRenderedContent] = useState(
    accordion ? defaultOpen : defaultOpen
  );
  const handledOpenSignalRef = useRef(0);
  const summaryRef = useRef<HTMLElement | null>(null);
  const visiblePreviewMetrics = (previewMetrics || []).filter(metric => metric.value !== null && metric.value !== undefined && metric.value !== "");
  const useMiddleAccessoryLayout = previewAccessoryPlacement === "middle" && Boolean(previewAccessory) && visiblePreviewMetrics.length === 2;

  useEffect(() => {
    if (accordion) return;
    setLocalIsOpen(defaultOpen);
    if (defaultOpen) {
      setHasRenderedContent(true);
    }
  }, [accordion, defaultOpen]);

  useEffect(() => {
    if (!openSignal || handledOpenSignalRef.current === openSignal) return;
    handledOpenSignalRef.current = openSignal;
    if (accordion) {
      accordion.setActiveSectionId(sectionId);
    } else {
      setLocalIsOpen(true);
    }
    setHasRenderedContent(true);
    onOpenChange?.(true);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        summaryRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  }, [accordion, openSignal, sectionId]);

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const nextOpen = event.currentTarget.open;
    if (accordion) {
      if (nextOpen) {
        accordion.setActiveSectionId(sectionId);
      } else if (accordion.activeSectionId === sectionId) {
        accordion.setActiveSectionId(null);
      }
    } else {
      setLocalIsOpen(nextOpen);
    }
    if (nextOpen) {
      setHasRenderedContent(true);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <details
      className={`report-section report-disclosure${premium ? " admin-premium-flare admin-premium-section" : ""}`}
      open={accordion ? isOpen : localIsOpen}
      onToggle={handleToggle}
      data-report-section-target={targetKey || undefined}
    >
      <summary ref={summaryRef} className="report-disclosure-summary">
        <ReportSectionHeader title={title} kicker={kicker} />
        {previewAccessory ? (
          useMiddleAccessoryLayout ? (
            <span className="report-disclosure-preview-row report-disclosure-preview-row-middle">
              <span className="report-disclosure-preview-slot report-disclosure-preview-slot-lead">
                <PreviewMetricChips
                  metrics={[visiblePreviewMetrics[0]]}
                  className="report-disclosure-preview"
                />
              </span>
              <span className="report-disclosure-preview-accessory">
                {previewAccessory}
              </span>
              <span className="report-disclosure-preview-slot report-disclosure-preview-slot-trail">
                <PreviewMetricChips
                  metrics={[visiblePreviewMetrics[1]]}
                  className="report-disclosure-preview"
                />
              </span>
            </span>
          ) : (
            <span className="report-disclosure-preview-row">
              <PreviewMetricChips
                metrics={visiblePreviewMetrics}
                className="report-disclosure-preview"
              />
              <span className="report-disclosure-preview-accessory">
                {previewAccessory}
              </span>
            </span>
          )
        ) : (
          <PreviewMetricChips
            metrics={visiblePreviewMetrics}
            className="report-disclosure-preview"
          />
        )}
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </summary>
      {afterSummaryAccessory && (
        <div className="report-disclosure-after-summary-accessory">
          {afterSummaryAccessory}
        </div>
      )}
      <div className="report-disclosure-body">
        {hasRenderedContent ? (
          <div className="report-disclosure-body-inner">
            <Suspense fallback={<ReportSectionLoadingFallback />}>
              {children}
            </Suspense>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function ReportSectionAccordionProvider({
  scopeKey,
  children,
}: {
  scopeKey: string;
  children: ReactNode;
}) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => {
    setActiveSectionId(null);
  }, [scopeKey]);

  return (
    <ReportSectionAccordionContext.Provider
      value={{ activeSectionId, setActiveSectionId }}
    >
      {children}
    </ReportSectionAccordionContext.Provider>
  );
}

export function ModalReportSection({
  title,
  kicker,
  previewMetrics,
  children,
}: {
  title: string;
  kicker?: string;
  previewMetrics?: PreviewMetric[];
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="report-section report-disclosure report-modal-section">
      <button
        type="button"
        className="report-disclosure-summary report-modal-trigger"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <ReportSectionHeader title={title} kicker={kicker} />
        <PreviewMetricChips
          metrics={previewMetrics}
          className="report-disclosure-preview"
        />
        <ChevronDown className="report-disclosure-icon" aria-hidden="true" />
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="full-trade-ledger-modal flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-cyan-300/20 bg-slate-950 p-0 text-slate-100 shadow-2xl shadow-black/70 sm:max-h-[90vh] sm:max-w-6xl"
          overlayClassName="full-trade-ledger-backdrop"
        >
          <DialogHeader className="trade-ledger-modal-header">
            <DialogTitle className="trade-ledger-modal-title">
              {title}
            </DialogTitle>
            {kicker && (
              <DialogDescription className="trade-ledger-modal-kicker">
                {kicker}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="trade-ledger-modal-body">
            <Suspense fallback={<ReportSectionLoadingFallback />}>
              {children}
            </Suspense>
          </div>
          <button
            type="button"
            className="trade-ledger-modal-mobile-close"
            onClick={() => setIsOpen(false)}
          >
            Close Ledger
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
