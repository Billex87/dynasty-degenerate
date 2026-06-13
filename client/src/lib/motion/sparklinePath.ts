function formatPathNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(2)).toString();
}

export function buildSparklinePath(
  points: readonly number[],
  width: number,
  height: number,
): string {
  const values = points.filter(Number.isFinite);
  if (values.length < 2 || width <= 0 || height <= 0) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const last = values.length - 1;

  return values
    .map((value, index) => {
      const x = (index / last) * width;
      const progress = range === 0 ? 0.5 : (value - min) / range;
      const y = height - progress * height;
      return `${index === 0 ? "M" : "L"} ${formatPathNumber(x)} ${formatPathNumber(y)}`;
    })
    .join(" ");
}
