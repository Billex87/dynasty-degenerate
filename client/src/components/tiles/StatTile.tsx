import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react";

import {
  buildTileAttrs,
  buildTileClassName,
  type TileSize,
  type TileTone,
} from "@/components/tiles/tileUtils";

type StatTileProps = {
  as?: "article" | "section" | "div" | "p";
  tone?: TileTone;
  size?: TileSize;
  selected?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  value?: ReactNode;
  valueProps?: HTMLAttributes<HTMLElement>;
  subLabel?: ReactNode;
  helper?: ReactNode;
  childrenPosition?: "before" | "after";
  children?: ReactNode;
};

export function StatTile({
  as = "section",
  tone = "neutral",
  size = "sm",
  selected,
  disabled,
  label,
  value,
  valueProps,
  subLabel,
  helper,
  childrenPosition = "after",
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLElement> & StatTileProps) {
  const safeValueProps = valueProps || {};
  const Tag = as;
  const usesGlassSurface = className.includes("dd-glass");

  return (
    <Tag
      className={buildTileClassName({
        tone,
        size,
        variant: "stat",
        className: `${usesGlassSurface ? "" : "dd-current"} ${className}`.trim(),
        state: disabled
          ? "disabled"
          : selected
            ? "selected"
            : "default",
      })}
      {...buildTileAttrs({ tone, selected, disabled })}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {usesGlassSurface ? null : <span className="dd-current-line" aria-hidden="true" />}
      {label ? <span className="dd-tile__label">{label}</span> : null}
      {children && childrenPosition === "before" ? children : null}
      {value !== undefined ? (
        <strong
          className="dd-tile__value"
          style={safeValueProps.style as CSSProperties | undefined}
          {...safeValueProps}
        >
          {value}
        </strong>
      ) : null}
      {children && childrenPosition === "after" ? children : null}
      {subLabel ? <em className="dd-tile__sub">{subLabel}</em> : null}
      {helper ? <small className="dd-tile__helper">{helper}</small> : null}
    </Tag>
  );
}
