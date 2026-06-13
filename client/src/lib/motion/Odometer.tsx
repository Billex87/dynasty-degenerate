import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DURATION, EASE_RISE, STAGGER_STEP, cssEase } from "./motionTokens";
import { formatCount, splitDigits } from "./motionMath";
import { useAnimationsEnabled } from "./useAnimationsEnabled";

const STRIP_DIGITS = Array.from({ length: 10 }, (_, digit) => digit);

export type OdometerProps = {
  value: number;
  durationMs?: number;
  digitStepMs?: number;
  formatter?: (value: number) => string;
  plus?: boolean;
  className?: string;
};

export default function Odometer({
  value,
  durationMs = DURATION.settle,
  digitStepMs = STAGGER_STEP.loose,
  formatter,
  plus,
  className,
}: OdometerProps) {
  const animationsEnabled = useAnimationsEnabled();
  const formatted = useMemo(
    () => (formatter ? formatter(value) : formatCount(value, { plus })),
    [formatter, plus, value],
  );
  const previousFormattedRef = useRef<string | null>(null);
  const previousDigits = useMemo(
    () => getDigitsByPosition(previousFormattedRef.current),
    [formatted],
  );

  useEffect(() => {
    previousFormattedRef.current = formatted;
  }, [formatted]);

  if (!animationsEnabled) {
    return <span className={className}>{formatted}</span>;
  }

  const tokens = splitDigits(formatted);
  const digitCount = tokens.filter((token) => token.kind === "digit").length;
  let digitIndex = 0;

  return (
    <span aria-label={formatted} className={className} role="text">
      {tokens.map((token, index) => {
        if (token.kind === "char") {
          return (
            <span aria-hidden="true" key={`char-${index}`}>
              {token.char}
            </span>
          );
        }

        const positionFromRight = digitCount - digitIndex - 1;
        const delayMs = digitIndex * digitStepMs;
        const previousDigit = previousDigits.get(positionFromRight) ?? 0;
        digitIndex += 1;

        return (
          <DigitColumn
            delayMs={delayMs}
            digit={token.digit}
            durationMs={durationMs}
            initialDigit={previousDigit}
            key={`digit-${positionFromRight}`}
          />
        );
      })}
    </span>
  );
}

function DigitColumn({
  digit,
  initialDigit,
  durationMs,
  delayMs,
}: {
  digit: number;
  initialDigit: number;
  durationMs: number;
  delayMs: number;
}) {
  const [displayDigit, setDisplayDigit] = useState(initialDigit);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDisplayDigit(digit));
    return () => window.cancelAnimationFrame(frame);
  }, [digit]);

  const stripStyle: CSSProperties = {
    transform: `translate3d(0, -${displayDigit}em, 0)`,
    transition: `transform ${durationMs}ms ${cssEase(EASE_RISE)} ${delayMs}ms`,
  };

  return (
    <span
      aria-hidden="true"
      className="inline-block h-[1em] overflow-hidden align-[-0.08em]"
    >
      <span className="block will-change-transform" style={stripStyle}>
        {STRIP_DIGITS.map((stripDigit) => (
          <span className="block h-[1em] leading-[1em]" key={stripDigit}>
            {stripDigit}
          </span>
        ))}
      </span>
    </span>
  );
}

function getDigitsByPosition(formatted: string | null) {
  const digits = formatted
    ? splitDigits(formatted).flatMap((token) => (token.kind === "digit" ? [token.digit] : []))
    : [];
  const byPosition = new Map<number, number>();

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    byPosition.set(digits.length - index - 1, digits[index]);
  }

  return byPosition;
}
