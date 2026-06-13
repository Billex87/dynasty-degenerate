import { Children, Fragment, isValidElement, type ReactNode } from "react";

import { MotionReveal } from "@/lib/motion";

export function ReportMotionSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;

  return (
    <MotionReveal className={className} in="view" y={14}>
      {children}
    </MotionReveal>
  );
}

export function ReportMotionSectionStack({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const items = flattenMotionChildren(children);

  return (
    <div className={className}>
      {items.map((child, index) =>
        child ? (
          <ReportMotionSection className="dd-motion-section-item" key={index}>
            {child}
          </ReportMotionSection>
        ) : (
          child
        )
      )}
    </div>
  );
}

function flattenMotionChildren(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap(child => {
    if (isValidElement(child) && child.type === Fragment) {
      return flattenMotionChildren(
        (child.props as { children?: ReactNode }).children
      );
    }

    return [child];
  });
}
