import type { CSSProperties } from 'react';

const DEFAULT_MAX_BALANCED_GRID_COLUMNS = 6;

type BalancedGridStyle = CSSProperties & {
  '--dd-balanced-grid-columns'?: string;
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

  return {
    '--dd-balanced-grid-columns': String(columns),
  };
}
