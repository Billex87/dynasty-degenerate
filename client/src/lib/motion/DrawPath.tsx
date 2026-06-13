import { useEffect, useRef } from "react";
import type { RefObject, SVGProps } from "react";
import { DURATION, EASE_RISE, cssEase } from "./motionTokens";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

export function useDrawPath(
  ref: RefObject<SVGPathElement | null>,
  opts: { durationMs?: number; delayMs?: number; enabled?: boolean; replayKey?: unknown } = {},
) {
  const { durationMs = DURATION.draw, delayMs = 0, enabled = true, replayKey } = opts;
  const animationsEnabled = useAnimationsEnabled();

  useEffect(() => {
    const path = ref.current;
    if (!path) return;

    if (!animationsEnabled) {
      path.style.transition = "none";
      path.style.strokeDasharray = "";
      path.style.strokeDashoffset = "0";
      return;
    }

    let length = 0;
    try {
      length = path.getTotalLength();
    } catch {
      path.style.transition = "none";
      path.style.strokeDasharray = "";
      path.style.strokeDashoffset = "0";
      return;
    }

    path.style.transition = "none";
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    if (!enabled) return;

    let cleanupFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      path.style.transition = `stroke-dashoffset ${durationMs}ms ${cssEase(EASE_RISE)} ${delayMs}ms`;
      path.style.strokeDashoffset = "0";
      cleanupFrame = window.setTimeout(() => {
        path.style.strokeDasharray = "";
        path.style.strokeDashoffset = "0";
      }, durationMs + delayMs + 80);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (cleanupFrame) window.clearTimeout(cleanupFrame);
    };
  }, [animationsEnabled, delayMs, durationMs, enabled, ref, replayKey]);
}

export type DrawPathProps = {
  d: string;
  stroke: string;
  strokeWidth?: number;
  durationMs?: number;
  delayMs?: number;
  strokeLinecap?: SVGProps<SVGPathElement>["strokeLinecap"];
};

export function DrawPath({
  d,
  stroke,
  strokeWidth = 3,
  durationMs,
  delayMs,
  strokeLinecap = "round",
}: DrawPathProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  useDrawPath(pathRef, { delayMs, durationMs });

  return (
    <path
      d={d}
      fill="none"
      ref={pathRef}
      stroke={stroke}
      strokeLinecap={strokeLinecap}
      strokeWidth={strokeWidth}
    />
  );
}

export default DrawPath;
