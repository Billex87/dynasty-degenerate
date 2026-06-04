import type { ReactNode } from "react";

import {
  buildTileAttrs,
  buildTileClassName,
  type TileSize,
  type TileTone,
} from "@/components/tiles/tileUtils";

type MediaTileProps = {
  media: ReactNode;
  tone?: TileTone;
  size?: TileSize;
  selected?: boolean;
  disabled?: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
};

export function MediaTile({
  media,
  tone = "neutral",
  size = "md",
  selected,
  disabled,
  title,
  subtitle,
  children,
  className = "",
  ...rest
}: Omit<React.HTMLAttributes<HTMLElement>, "title"> & MediaTileProps) {
  return (
    <article
      className={buildTileClassName({
        tone,
        size,
        variant: "media",
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
      <figure className="dd-tile__media">{media}</figure>
      <div className="dd-tile__content">
        {title ? <header className="dd-tile__header">{title}</header> : null}
        {subtitle ? <p className="dd-tile__subtitle">{subtitle}</p> : null}
        {children}
      </div>
    </article>
  );
}
