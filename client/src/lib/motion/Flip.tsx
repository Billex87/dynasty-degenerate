import { createContext, useContext } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import type { HTMLMotionProps, Variants } from "framer-motion";
import { DURATION, EASE_RISE, STAGGER_STEP } from "./motionTokens";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

type FlipContextValue = {
  enabled: boolean;
  y: number;
  layoutDelayStepMs: number;
};

const FlipContext = createContext<FlipContextValue>({
  enabled: true,
  y: 10,
  layoutDelayStepMs: 0,
});

export function FlipList({
  children,
  delayStepMs = STAGGER_STEP.tight,
  initialDelayMs = 0,
  layoutDelayStepMs = 0,
  y = 10,
  in: trigger = "mount",
  className,
  ...rest
}: {
  children: ReactNode;
  delayStepMs?: number;
  initialDelayMs?: number;
  layoutDelayStepMs?: number;
  y?: number;
  in?: "mount" | "view";
} & Omit<
  HTMLMotionProps<"div">,
  "animate" | "children" | "initial" | "layout" | "variants" | "viewport" | "whileInView"
>) {
  const animationsEnabled = useAnimationsEnabled();
  const variants: Variants = {
    hidden: {},
    show: {
      transition: {
        delayChildren: initialDelayMs / 1000,
        staggerChildren: delayStepMs / 1000,
      },
    },
  };
  const contextValue = { enabled: animationsEnabled, y, layoutDelayStepMs };

  if (!animationsEnabled) {
    return (
      <FlipContext.Provider value={contextValue}>
        <div className={className} {...(rest as HTMLAttributes<HTMLDivElement>)}>
          {children}
        </div>
      </FlipContext.Provider>
    );
  }

  return (
    <FlipContext.Provider value={contextValue}>
      <motion.div
        animate={trigger === "mount" ? "show" : undefined}
        className={className}
        initial="hidden"
        layout
        {...rest}
        variants={variants}
        viewport={trigger === "view" ? { once: true } : undefined}
        whileInView={trigger === "view" ? "show" : undefined}
      >
        {children}
      </motion.div>
    </FlipContext.Provider>
  );
}

export function FlipItem({
  children,
  className,
  index = 0,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  index?: number;
} & Omit<HTMLMotionProps<"div">, "children" | "layout" | "transition" | "variants">) {
  const { enabled, y, layoutDelayStepMs } = useContext(FlipContext);
  const variants: Variants = {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1,
      transition: {
        duration: DURATION.settle / 1000,
        ease: EASE_RISE,
      },
      y: 0,
    },
  };

  if (!enabled) {
    return (
      <div className={className} {...(rest as HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      layout
      transition={{
        layout: {
          delay: (layoutDelayStepMs * index) / 1000,
          duration: DURATION.flip / 1000,
          ease: EASE_RISE,
        },
      }}
      variants={variants}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
