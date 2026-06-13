import type { CSSProperties, ReactNode } from "react";
import { useMotionInViewOnce } from "./useMotionInViewOnce";

type TileMotionOptions = {
  style?: CSSProperties;
  topAsset?: boolean;
};

type TileRippleRenderApi = {
  getTileMotionProps: (index: number, opts?: TileMotionOptions) => {
    "data-animate-in"?: "true" | "false";
    "data-top-asset"?: "true";
    style?: CSSProperties;
  };
};

export function TileRippleGrid({
  children,
  className,
  style,
}: {
  children: (api: TileRippleRenderApi) => ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const { animationsEnabled, hasEntered, ref } = useMotionInViewOnce<HTMLDivElement>({
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.12,
  });

  const getTileMotionProps: TileRippleRenderApi["getTileMotionProps"] = (
    index,
    opts = {},
  ) => {
    const delayMs = Math.min(index * 45, 600);
    return {
      "data-animate-in": animationsEnabled ? (hasEntered ? "true" : "false") : undefined,
      "data-top-asset": opts.topAsset ? "true" : undefined,
      style: {
        ...opts.style,
        "--dd-motion-delay": `${delayMs}ms`,
      } as CSSProperties,
    };
  };

  return (
    <div ref={ref} className={className} style={style}>
      {children({ getTileMotionProps })}
    </div>
  );
}
