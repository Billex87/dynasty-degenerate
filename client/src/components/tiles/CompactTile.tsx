import type { ReactNode } from "react";

import {
  buildTileAttrs,
  buildTileClassName,
  type TileSize,
  type TileTone,
  type TileVariant,
} from "@/components/tiles/tileUtils";

type CompactTileVariantProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  icon?: ReactNode;
  as?: "article" | "aside" | "section" | "div" | "span";
  tone?: TileTone;
  size?: TileSize;
  selected?: boolean;
  disabled?: boolean;
  variant?: TileVariant;
};

export function CompactTile({
  title,
  subtitle,
  meta,
  aside,
  icon,
  as = "article",
  tone = "neutral",
  size = "sm",
  selected,
  disabled,
  variant = "compact",
  className = "",
  children,
  ...rest
}: Omit<React.HTMLAttributes<HTMLElement>, "title"> & CompactTileVariantProps) {
  const Tag = as;

  return (
    <Tag
      className={buildTileClassName({
        tone,
        size,
        variant,
        className,
        state: disabled
          ? "disabled"
          : selected
            ? "selected"
            : "default",
      })}
      {...buildTileAttrs({ tone, selected, disabled })}
      aria-disabled={disabled || undefined}
      aria-pressed={selected || undefined}
      {...rest}
    >
      {icon ? <span className="dd-tile__icon">{icon}</span> : null}
      <span className="dd-tile__content">
        <span className="dd-tile__title">{title}</span>
        {subtitle ? <span className="dd-tile__subtitle">{subtitle}</span> : null}
        {meta ? <span className="dd-tile__meta">{meta}</span> : null}
        {children ? <span className="dd-tile__body">{children}</span> : null}
      </span>
      {aside ? <span className="dd-tile__aside">{aside}</span> : null}
    </Tag>
  );
}
