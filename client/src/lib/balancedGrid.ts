import type { CSSProperties } from 'react';

const DEFAULT_MAX_BALANCED_GRID_COLUMNS = 6;

type BalancedGridStyle = CSSProperties & {
  '--dd-balanced-grid-columns'?: string;
  '--dd-balanced-grid-columns-md'?: string;
  '--dd-balanced-grid-columns-sm'?: string;
  '--dd-balanced-grid-columns-xs'?: string;
  '--dd-balanced-grid-item-width'?: string;
  '--dd-balanced-grid-item-width-md'?: string;
  '--dd-balanced-grid-item-width-sm'?: string;
  '--dd-balanced-grid-item-width-xs'?: string;
};

export function getBalancedGridColumnCount(
  itemCount: number,
  maxColumns = DEFAULT_MAX_BALANCED_GRID_COLUMNS,
): number | undefined {
  if (!Number.isFinite(itemCount) || itemCount <= 0) return undefined;

  const safeMaxColumns = Math.max(1, Math.floor(maxColumns));
  const safeItemCount = Math.max(1, Math.floor(itemCount));
  const targetRows = Math.ceil(safeItemCount / safeMaxColumns);

  return Math.ceil(safeItemCount / targetRows);
}

export function getBalancedGridStyle(
  itemCount: number,
  maxColumns = DEFAULT_MAX_BALANCED_GRID_COLUMNS,
): BalancedGridStyle | undefined {
  const columns = getBalancedGridColumnCount(itemCount, maxColumns);

  if (!columns) return undefined;
  const mdColumns =
    getBalancedGridColumnCount(itemCount, Math.min(maxColumns, 4)) || columns;
  const smColumns =
    getBalancedGridColumnCount(itemCount, Math.min(maxColumns, 3)) || columns;
  const xsColumns =
    getBalancedGridColumnCount(itemCount, Math.min(maxColumns, 2)) || columns;
  const getItemWidth = (columnCount: number) =>
    `calc((100% - (${columnCount - 1} * var(--dd-balanced-grid-gap, 0px))) / ${columnCount})`;

  return {
    '--dd-balanced-grid-columns': String(columns),
    '--dd-balanced-grid-columns-md': String(mdColumns),
    '--dd-balanced-grid-columns-sm': String(smColumns),
    '--dd-balanced-grid-columns-xs': String(xsColumns),
    '--dd-balanced-grid-item-width': getItemWidth(columns),
    '--dd-balanced-grid-item-width-md': getItemWidth(mdColumns),
    '--dd-balanced-grid-item-width-sm': getItemWidth(smColumns),
    '--dd-balanced-grid-item-width-xs': getItemWidth(xsColumns),
  };
}
