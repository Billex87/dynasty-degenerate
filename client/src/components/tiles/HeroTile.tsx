import type { ReactNode } from "react";

import {
  buildTileAttrs,
  buildTileClassName,
  type TileSize,
  type TileTone,
} from "@/components/tiles/tileUtils";

type HeroTileProps = {
  tone?: TileTone;
  size?: TileSize;
  selected?: boolean;
  disabled?: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
};

export function HeroTile({
  tone = "brand",
  size = "lg",
  selected,
  disabled,
  title,
  subtitle,
  description,
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLElement> & HeroTileProps) {
  return (
    <section
      className={buildTileClassName({
        tone,
        size,
        variant: "hero",
        className,
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
      {(title || subtitle || description) && (
        <header className="dd-tile__hero-header">
          {title ? <h2 className="dd-tile__hero-title">{title}</h2> : null}
          {subtitle ? (
            <p className="dd-tile__hero-subtitle">{subtitle}</p>
          ) : null}
          {description ? (
            <p className="dd-tile__hero-description">{description}</p>
          ) : null}
        </header>
      )}
      {children ? <div className="dd-tile__content">{children}</div> : null}
    </section>
  );
}
