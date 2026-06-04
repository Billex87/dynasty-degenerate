import type { HTMLAttributes } from "react";

export type TileTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "violet"
  | "info"
  | "good"
  | "warn";

export type TileSize = "sm" | "md" | "lg";

export type TileVariant =
  | "compact"
  | "card"
  | "media"
  | "stat"
  | "action"
  | "hero";

export type TileState = "default" | "selected" | "disabled";

export type TileClassProps = {
  tone?: TileTone;
  size?: TileSize;
  variant: TileVariant;
  className?: string;
  state?: TileState;
};

function normalizeTileTone(tone?: TileTone): "neutral" | "brand" | "success" | "warning" | "danger" | "violet" {
  if (tone === "good") return "success";
  if (tone === "warn") return "warning";
  if (tone === "info") return "brand";
  return tone || "neutral";
}

function normalizeLegacyTone(tone?: TileTone): "neutral" | "info" | "good" | "warn" | "danger" {
  if (tone === "success") return "good";
  if (tone === "warning") return "warn";
  if (tone === "danger") return "danger";
  if (tone === "violet") return "info";
  return "info";
}

function buildTileToneClass(tone?: TileTone) {
  return `dd-tile-tone-${normalizeTileTone(tone)}`;
}

export function buildTileClassName({
  tone,
  size,
  variant,
  className = "",
  state,
}: TileClassProps) {
  const classes = [
    "dd-tile",
    `dd-tile--${variant}`,
    buildTileToneClass(tone),
    size ? `is-${size}` : "is-md",
    state === "selected" ? "is-selected" : "",
    state === "disabled" ? "is-disabled" : "",
    className,
  ];

  return classes.filter(Boolean).join(" ");
}

export function buildTileAttrs({
  tone,
  selected,
  disabled,
}: {
  tone?: TileTone;
  selected?: boolean;
  disabled?: boolean;
}) {
  return {
    "data-dd-tone": normalizeTileTone(tone),
    "data-tone": normalizeLegacyTone(tone),
    "data-dd-selected": selected ? "true" : undefined,
    "data-dd-disabled": disabled ? "true" : undefined,
  } as const;
}

export type TileAriaProps = Pick<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "aria-describedby" | "aria-live"
>;
