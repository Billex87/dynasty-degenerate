import { createContext, useContext } from "react";
import type { HTMLAttributes } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { HTMLMotionProps, Variants } from "framer-motion";
import { DURATION, EASE_RISE, STAGGER_STEP } from "./motionTokens";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

type StaggerContextValue = {
  enabled: boolean;
  y: number;
};

const StaggerContext = createContext<StaggerContextValue>({
  enabled: true,
  y: 14,
});

export function StaggerGroup({
  children,
  delayStepMs = STAGGER_STEP.base,
  initialDelayMs = 0,
  y = 14,
  in: trigger = "mount",
  className,
  ...rest
}: {
  children: ReactNode;
  delayStepMs?: number;
  initialDelayMs?: number;
  y?: number;
  in?: "mount" | "view";
} & Omit<
  HTMLMotionProps<"div">,
  "animate" | "children" | "initial" | "variants" | "viewport" | "whileInView"
>) {
  const animationsEnabled = useAnimationsEnabled();
  const groupVariants: Variants = {
    hidden: {},
    show: {
      transition: {
        delayChildren: initialDelayMs / 1000,
        staggerChildren: delayStepMs / 1000,
      },
    },
  };

  const contextValue = { enabled: animationsEnabled, y };

  if (!animationsEnabled) {
    return (
      <StaggerContext.Provider value={contextValue}>
        <div className={className} {...(rest as HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      </StaggerContext.Provider>
    );
  }

  return (
    <StaggerContext.Provider value={contextValue}>
      <motion.div
        animate={trigger === "mount" ? "show" : undefined}
        className={className}
        initial="hidden"
        {...rest}
        variants={groupVariants}
        viewport={trigger === "view" ? { once: true } : undefined}
        whileInView={trigger === "view" ? "show" : undefined}
      >
        {children}
      </motion.div>
    </StaggerContext.Provider>
  );
}

export function StaggerItem({
  children,
  className,
  durationMs = DURATION.settle,
  ease = EASE_RISE,
  rotate = 0,
}: {
  children: ReactNode;
  className?: string;
  durationMs?: number;
  ease?: readonly [number, number, number, number];
  rotate?: number;
}) {
  const { enabled, y } = useContext(StaggerContext);
  const itemVariants: Variants = {
    hidden: { opacity: 0, rotate, y },
    show: {
      opacity: 1,
      transition: {
        duration: durationMs / 1000,
        ease,
      },
      rotate: 0,
      y: 0,
    },
  };

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
