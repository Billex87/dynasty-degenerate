import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";

import {
  buildTileAttrs,
  buildTileClassName,
  type TileSize,
  type TileTone,
} from "@/components/tiles/tileUtils";

type ActionTileBaseProps = {
  tone?: TileTone;
  size?: TileSize;
  selected?: boolean;
  disabled?: boolean;
  label: ReactNode;
  helper?: ReactNode;
  icon?: ReactNode;
  pressed?: boolean;
  children?: ReactNode;
};

type ActionTileButtonProps =
  & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">
  & ActionTileBaseProps
  & { as?: "button" };

type ActionTileAnchorProps =
  & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children">
  & ActionTileBaseProps
  & { as: "a"; href: string };

export type ActionTileProps = ActionTileButtonProps | ActionTileAnchorProps;

export function ActionTile(props: ActionTileProps) {
  const {
    tone = "neutral",
    size = "sm",
    selected,
    disabled,
    label,
    helper,
    icon,
    pressed,
    className = "",
    children,
    ...rest
  } = props;

  if (props.as === "a") {
    const {
      as: _as,
      href,
      onClick,
      ...anchorProps
    } = rest as ActionTileAnchorProps & Omit<ActionTileBaseProps, never>;

    const handleAnchorClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (onClick) {
        onClick(event);
      }
    };

    return (
      <a
        href={href}
        className={buildTileClassName({
          tone,
          size,
          variant: "action",
          className,
          state: disabled ? "disabled" : selected ? "selected" : "default",
        })}
        {...buildTileAttrs({ tone, selected, disabled })}
        aria-disabled={disabled || undefined}
        aria-pressed={pressed === undefined ? undefined : pressed}
        onClick={handleAnchorClick}
        {...anchorProps}
      >
        {icon ? <span className="dd-tile__icon">{icon}</span> : null}
        <span className="dd-tile__content">
          <span className="dd-tile__label">{label}</span>
          {helper ? <small className="dd-tile__helper">{helper}</small> : null}
          {children ? <span className="dd-tile__body">{children}</span> : null}
        </span>
      </a>
    );
  }

  const {
    as: _as,
    type,
    onClick,
    ...buttonProps
  } = rest as ActionTileButtonProps & Omit<ActionTileBaseProps, never>;

  return (
    <button
      type={type ?? "button"}
      disabled={disabled}
      className={buildTileClassName({
        tone,
        size,
        variant: "action",
        className,
        state: disabled
          ? "disabled"
          : selected
            ? "selected"
            : "default",
      })}
      {...buildTileAttrs({ tone, selected, disabled })}
      aria-pressed={pressed === undefined ? undefined : pressed}
      onClick={onClick}
      {...buttonProps}
    >
      {icon ? <span className="dd-tile__icon">{icon}</span> : null}
      <span className="dd-tile__content">
        <span className="dd-tile__label">{label}</span>
        {helper ? <small className="dd-tile__helper">{helper}</small> : null}
        {children ? <span className="dd-tile__body">{children}</span> : null}
      </span>
    </button>
  );
}
