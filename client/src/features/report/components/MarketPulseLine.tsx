import { useMemo, useRef } from "react";
import { Activity } from "lucide-react";
import type { RecentTransaction } from "@shared/types";
import { useDrawPath, useMotionInViewOnce } from "@/lib/motion";
import {
  buildMarketPulsePath,
  buildTransactionActivitySeries,
} from "@/features/report/lib/marketMotion";

type MarketPulseLineProps = {
  transactions?: RecentTransaction[];
};

const PULSE_WIDTH = 320;
const PULSE_HEIGHT = 86;

export function MarketPulseLine({ transactions }: MarketPulseLineProps) {
  const { hasEntered, ref } = useMotionInViewOnce<HTMLDivElement>();
  const pathRef = useRef<SVGPathElement | null>(null);
  const series = useMemo(
    () => buildTransactionActivitySeries(transactions || [], 6),
    [transactions],
  );
  const path = useMemo(
    () => buildMarketPulsePath(series.buckets, PULSE_WIDTH, PULSE_HEIGHT),
    [series.buckets],
  );

  useDrawPath(pathRef, {
    enabled: hasEntered && Boolean(path),
    replayKey: path,
    durationMs: 1200,
  });

  const latestBucket = series.buckets[series.buckets.length - 1] || null;
  const peakBucket = series.buckets.reduce(
    (peak, bucket) => (bucket.count > peak.count ? bucket : peak),
    { key: "none", label: "No activity", count: 0 },
  );

  return (
    <section
      ref={ref}
      className="market-pulse-line dd-glass-cold"
      aria-labelledby="market-pulse-line-title"
      data-mode={series.mode}
    >
      <div className="market-pulse-line-copy">
        <span>
          <Activity size={14} aria-hidden="true" />
          Momentum Pulse
        </span>
        <h3 id="market-pulse-line-title">League Activity Heartbeat</h3>
        <p>{series.note}</p>
      </div>
      <div className="market-pulse-line-chart">
        <svg
          viewBox={`0 0 ${PULSE_WIDTH} ${PULSE_HEIGHT}`}
          role="img"
          aria-label={`${series.total} recent transactions across ${series.buckets.length} activity buckets.`}
        >
          <line
            x1="4"
            x2={PULSE_WIDTH - 4}
            y1={PULSE_HEIGHT * 0.68}
            y2={PULSE_HEIGHT * 0.68}
            className="market-pulse-line-baseline"
          />
          {path ? (
            <path
              ref={pathRef}
              d={path}
              className="market-pulse-line-path"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      </div>
      <div className="market-pulse-line-stats">
        <span>
          <em>Total</em>
          <strong>{series.total}</strong>
        </span>
        <span>
          <em>Latest</em>
          <strong>{latestBucket ? latestBucket.count : 0}</strong>
        </span>
        <span>
          <em>Peak</em>
          <strong>{peakBucket.count}</strong>
        </span>
      </div>
    </section>
  );
}
