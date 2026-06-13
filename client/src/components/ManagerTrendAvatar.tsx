import { type CSSProperties, type ReactNode } from "react";

import { ReportTooltip } from "@/components/reportPrimitives";
import { formatCount, useMotionInViewOnce } from "@/lib/motion";

export function formatManagerTrendDelta(delta: number) {
  return formatCount(Math.round(delta), { plus: true });
}

export function getManagerTrendDelta(
  manager: string | null | undefined,
  growthRows?: Array<{ manager: string; growth?: number | null }> | null,
) {
  if (!manager || !growthRows?.length) return null;
  const row = growthRows.find(item => item.manager === manager);
  const growth = row?.growth;
  return typeof growth === "number" && Number.isFinite(growth) && growth !== 0
    ? growth
    : null;
}

export function ManagerTrendAvatar({
  manager,
  trendDelta,
  className,
  children,
}: {
  manager: string;
  trendDelta?: number | null;
  className?: string;
  children: ReactNode;
}) {
  const numericDelta =
    typeof trendDelta === "number" && Number.isFinite(trendDelta) && trendDelta !== 0
      ? trendDelta
      : null;

  const { animationsEnabled, hasEntered, ref } = useMotionInViewOnce<HTMLSpanElement>({
    rootMargin: "0px 0px -5% 0px",
    threshold: 0.35,
  });

  if (numericDelta === null) {
    return <>{children}</>;
  }

  const arc = Math.min(84, Math.max(6, (Math.abs(numericDelta) / 15000) * 84));
  const direction = numericDelta > 0 ? "up" : "down";
  const deltaLabel = formatManagerTrendDelta(numericDelta);

  return (
    <ReportTooltip content={`${manager}: ${deltaLabel} roster value in 7 days`}>
    <span
      ref={ref}
      className={`manager-trend-avatar ${className || ""}`.trim()}
      data-trend-direction={direction}
      data-trend-entered={!animationsEnabled || hasEntered ? "true" : "false"}
      style={{ "--manager-trend-arc": `${arc}%` } as CSSProperties}
    >
      {children}
    </span>
    </ReportTooltip>
  );
}
