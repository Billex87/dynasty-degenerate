import { Fragment } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { LayoutGroup, motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { DURATION, EASE_RISE } from "./motionTokens";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

export function SharedLayoutGroup({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  const animationsEnabled = useAnimationsEnabled();
  if (!animationsEnabled) return <Fragment>{children}</Fragment>;
  return <LayoutGroup id={id}>{children}</LayoutGroup>;
}

export function SharedLayoutItem({
  children,
  className,
  layoutId,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  layoutId: string;
} & Omit<
  HTMLMotionProps<"div">,
  "children" | "className" | "layout" | "layoutId" | "transition"
>) {
  const animationsEnabled = useAnimationsEnabled();

  if (!animationsEnabled) {
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
      layoutId={layoutId}
      transition={{
        layout: {
          duration: DURATION.flip / 1000,
          ease: EASE_RISE,
        },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
