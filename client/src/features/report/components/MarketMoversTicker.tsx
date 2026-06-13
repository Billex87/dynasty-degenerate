import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, RadioTower } from "lucide-react";
import type { WeeklyMomentum } from "@shared/types";
import { useAnimationsEnabled } from "@/lib/motion";
import { buildMarketMoverItems, type MarketMoverItem } from "@/features/report/lib/marketMotion";

type MarketMoversTickerProps = {
  risers?: WeeklyMomentum[];
  fallers?: WeeklyMomentum[];
};

function MarketMoverChip({ item }: { item: MarketMoverItem }) {
  const Icon = item.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="market-movers-ticker-item" data-direction={item.direction}>
      <span className="market-movers-ticker-icon" aria-hidden="true">
        <Icon size={14} strokeWidth={2.4} />
      </span>
      <strong>{item.name}</strong>
      <em>{item.position}</em>
      <b>{item.valueLabel}</b>
      <span>{item.pctLabel}</span>
    </span>
  );
}

export function MarketMoversTicker({
  risers,
  fallers,
}: MarketMoversTickerProps) {
  const animationsEnabled = useAnimationsEnabled();
  const items = useMemo(
    () => buildMarketMoverItems({ risers, fallers, limit: 12 }),
    [fallers, risers],
  );
  const shouldDrift = animationsEnabled && items.length > 3;

  return (
    <section
      className="market-movers-ticker dd-glass-cold"
      aria-labelledby="market-movers-ticker-title"
      data-empty={items.length ? undefined : "true"}
    >
      <div className="market-movers-ticker-heading">
        <span className="market-movers-ticker-kicker">
          <RadioTower size={14} aria-hidden="true" />
          Market Wire
        </span>
        <p id="market-movers-ticker-title">
          Weekly risers and fallers from this report.
        </p>
      </div>
      <div
        className="market-movers-ticker-window dd-edge-fade-rail"
        tabIndex={items.length ? 0 : -1}
        aria-label="Weekly market movers"
      >
        {items.length ? (
          <div
            className="market-movers-ticker-track"
            data-animated={shouldDrift ? "true" : undefined}
            role="list"
          >
            <span className="market-movers-ticker-segment" role="presentation">
              {items.map(item => (
                <MarketMoverChip key={item.id} item={item} />
              ))}
            </span>
            {shouldDrift ? (
              <span
                className="market-movers-ticker-segment"
                aria-hidden="true"
                role="presentation"
              >
                {items.map(item => (
                  <MarketMoverChip key={`${item.id}-duplicate`} item={item} />
                ))}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="market-movers-ticker-empty">
            No weekly value movers were included in this report.
          </span>
        )}
      </div>
    </section>
  );
}
