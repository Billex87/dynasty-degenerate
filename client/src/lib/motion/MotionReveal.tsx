import { type HTMLAttributes, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { DURATION, EASE_RISE } from "./motionTokens";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

type MotionRevealTrigger = "mount" | "view";

type MotionRevealProps = Omit<
  HTMLMotionProps<"div">,
  "animate" | "children" | "initial" | "transition" | "viewport" | "whileInView"
> & {
  children: ReactNode;
  delayMs?: number;
  durationMs?: number;
  in?: MotionRevealTrigger;
  once?: boolean;
  viewportMargin?: string;
  x?: number;
  y?: number;
};

export function MotionReveal({
  children,
  delayMs = 0,
  durationMs = DURATION.settle,
  in: trigger = "mount",
  once = true,
  viewportMargin = "0px 0px -10% 0px",
  x = 0,
  y = 14,
  ...rest
}: MotionRevealProps) {
  const animationsEnabled = useAnimationsEnabled();

  if (!animationsEnabled) {
    return <div {...(rest as HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  }

  const hiddenState = { opacity: 0, x, y };
  const shownState = { opacity: 1, x: 0, y: 0 };
  const transition = {
    delay: delayMs / 1000,
    duration: durationMs / 1000,
    ease: EASE_RISE,
  };

  return (
    <motion.div
      {...rest}
      animate={trigger === "mount" ? shownState : undefined}
      initial={hiddenState}
      transition={transition}
      viewport={trigger === "view" ? { once, margin: viewportMargin } : undefined}
      whileInView={trigger === "view" ? shownState : undefined}
    >
      {children}
    </motion.div>
  );
}
