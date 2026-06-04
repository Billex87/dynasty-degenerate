import type { ReactNode } from "react";

import {
  buildTileAttrs,
  buildTileClassName,
  type TileSize,
  type TileTone,
} from "@/components/tiles/tileUtils";

type CardTileProps = {
  as?: "article" | "aside" | "section" | "div";
  tone?: TileTone;
  size?: TileSize;
  selected?: boolean;
  disabled?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};

export function CardTile({
  as: tag = "article",
  tone = "neutral",
  size = "md",
  selected,
  disabled,
  header,
  footer,
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLElement> & CardTileProps) {
  const Tag = tag;

  return (
    <Tag
      className={buildTileClassName({
        tone,
        size,
        variant: "card",
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
      {header ? <header className="dd-tile__header">{header}</header> : null}
      {children ? <div className="dd-tile__content">{children}</div> : null}
      {footer ? <footer className="dd-tile__footer">{footer}</footer> : null}
    </Tag>
  );
}
