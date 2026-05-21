import type { CSSProperties } from "react";

type HeaderCssLightsProps = {
  className?: string;
};

const HEADER_LIGHTS = [
  ["6%", "46%", "76px", "#00C8E8", "18px", "0s", "9.8s", ".26", ".42", "1.22", "1.55", "10px", "-4px"],
  ["12%", "38%", "34px", "#00C8E8", "7px", ".15s", "4.9s", ".54", ".48", "1.75", ".86", "-8px", "3px"],
  ["18%", "57%", "18px", "#E85A10", "5px", ".8s", "3.7s", ".82", ".55", "2.15", ".72", "6px", "-2px"],
  ["25%", "41%", "12px", "#F4A020", "3px", "1.9s", "6.4s", ".66", ".62", "1.45", ".95", "-5px", "1px"],
  ["47%", "52%", "20px", "#00C8E8", "5px", ".5s", "7.6s", ".28", ".5", "1.62", "1.05", "4px", "-3px"],
  ["68%", "44%", "14px", "#00C8E8", "4px", "2.4s", "5.2s", ".7", ".68", "2.4", ".8", "-6px", "2px"],
  ["84%", "42%", "58px", "#E85A10", "15px", ".35s", "8.7s", ".36", ".44", "1.5", "1.18", "-12px", "5px"],
  ["92%", "30%", "26px", "#F4A020", "6px", "1.4s", "4.3s", ".58", ".54", "1.95", ".78", "7px", "-4px"],
] as const;

export function HeaderCssLights({ className = "" }: HeaderCssLightsProps) {
  return (
    <div
      className={`dd-header-css-lights ${className}`.trim()}
      aria-hidden="true"
    >
      {HEADER_LIGHTS.map(
        (
          [
            x,
            y,
            size,
            color,
            blur,
            delay,
            duration,
            peak,
            minScale,
            maxScale,
            endScale,
            driftX,
            driftY,
          ],
          index
        ) => (
          <span
            key={`${x}-${y}-${index}`}
            style={
              {
                "--x": x,
                "--y": y,
                "--size": size,
                "--color": color,
                "--blur": blur,
                "--delay": delay,
                "--duration": duration,
                "--peak": peak,
                "--min-scale": minScale,
                "--max-scale": maxScale,
                "--end-scale": endScale,
                "--drift-x": driftX,
                "--drift-y": driftY,
              } as CSSProperties
            }
          />
        )
      )}
    </div>
  );
}
