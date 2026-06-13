import { useMemo, type CSSProperties } from "react";
import type { ReportData } from "@shared/types";
import { isViewerManagerMatch } from "@/lib/viewerHighlight";
import {
  useAnimationsEnabled,
  useCountUp,
  useMotionInViewOnce,
  useSpringValue,
} from "@/lib/motion";
import {
  buildHeadToHeadManagerValues,
  formatMarketCompactValue,
} from "@/features/report/lib/marketMotion";

type HeadToHeadTugProps = {
  reportData: ReportData;
  viewerManager?: string | null;
};

function getPercentLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function HeadToHeadTug({
  reportData,
  viewerManager,
}: HeadToHeadTugProps) {
  const { hasEntered, ref } = useMotionInViewOnce<HTMLDivElement>();
  const animationsEnabled = useAnimationsEnabled();
  const managerValues = useMemo(
    () => buildHeadToHeadManagerValues(reportData),
    [reportData],
  );
  const requestedViewer = viewerManager || reportData.viewerManager || null;
  const viewer =
    managerValues.find(row =>
      isViewerManagerMatch(row.manager, requestedViewer)
    ) || managerValues[0] || null;
  const rival =
    managerValues.find(row => row.manager !== viewer?.manager) || null;
  const total = Math.max(1, (viewer?.totalValue || 0) + (rival?.totalValue || 0));
  const viewerShare = viewer && rival ? viewer.totalValue / total : 0.5;
  const rivalShare = viewer && rival ? rival.totalValue / total : 0.5;
  const springShare = useSpringValue(viewerShare, {
    stiffness: 155,
    damping: 24,
  });
  const displayShare = animationsEnabled ? springShare : viewerShare;
  const leading =
    viewer && rival && viewer.totalValue >= rival.totalValue ? viewer : rival;
  const leadingValue = useCountUp(hasEntered ? leading?.totalValue || 0 : 0, {
    formatter: formatMarketCompactValue,
  });
  const style = {
    "--viewer-share": `${viewerShare * 100}%`,
    "--rival-share": `${rivalShare * 100}%`,
    "--knot-x": `${displayShare * 100}%`,
  } as CSSProperties;

  if (!viewer || !rival || !leading) return null;

  return (
    <section
      ref={ref}
      className="head-to-head-tug dd-glass-cold"
      style={style}
      aria-labelledby="head-to-head-tug-title"
    >
      <div className="head-to-head-tug-copy">
        <span>Owner Intel Lab</span>
        <h3 id="head-to-head-tug-title">Value Tug-of-War</h3>
        <p>
          {viewer.manager} versus {rival.manager} by current roster value.
        </p>
      </div>
      <div
        className="head-to-head-tug-meter"
        role="img"
        aria-label={`${viewer.manager} controls ${getPercentLabel(viewerShare)} of the compared value against ${rival.manager}.`}
      >
        <span className="head-to-head-tug-fill head-to-head-tug-fill-viewer" />
        <span className="head-to-head-tug-fill head-to-head-tug-fill-rival" />
        <span className="head-to-head-tug-midline" aria-hidden="true" />
        <span className="head-to-head-tug-knot" aria-hidden="true" />
      </div>
      <div className="head-to-head-tug-managers">
        <span className="head-to-head-tug-manager head-to-head-tug-manager-viewer">
          <em>Viewer</em>
          <strong>{viewer.manager}</strong>
          <b>{formatMarketCompactValue(viewer.totalValue)}</b>
        </span>
        <span className="head-to-head-tug-leader">
          <em>Leader</em>
          <strong>{leading.manager}</strong>
          <b>{leadingValue}</b>
        </span>
        <span className="head-to-head-tug-manager head-to-head-tug-manager-rival">
          <em>Rival</em>
          <strong>{rival.manager}</strong>
          <b>{formatMarketCompactValue(rival.totalValue)}</b>
        </span>
      </div>
    </section>
  );
}
