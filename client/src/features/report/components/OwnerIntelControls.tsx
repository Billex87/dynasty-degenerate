export type OwnerIntelSortMode = "dynasty" | "contender" | "rebuilder";

const OWNER_INTEL_SORT_OPTIONS: Array<{
  key: OwnerIntelSortMode;
  label: string;
  shortLabel: string;
}> = [
  { key: "dynasty", label: "Dynasty", shortLabel: "DYN" },
  { key: "contender", label: "Contender", shortLabel: "CON" },
  { key: "rebuilder", label: "Rebuilder", shortLabel: "REB" },
];

export function OwnerIntelSortControls({
  value,
  onChange,
}: {
  value: OwnerIntelSortMode;
  onChange: (nextValue: OwnerIntelSortMode) => void;
}) {
  return (
    <span className="owner-intel-sort-controls" aria-label="Sort managers">
      {OWNER_INTEL_SORT_OPTIONS.map(option => (
        <button
          key={option.key}
          type="button"
          className={`owner-intel-sort-button${value === option.key ? " owner-intel-sort-button-active" : ""}`}
          aria-pressed={value === option.key}
          data-owner-intel-sort={option.key}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onChange(option.key);
          }}
        >
          <span className="owner-intel-sort-label-full">{option.label}</span>
          <span className="owner-intel-sort-label-short">
            {option.shortLabel}
          </span>
        </button>
      ))}
    </span>
  );
}

export function LeagueRosterScannerModeControls({
  value,
  onChange,
}: {
  value: OwnerIntelSortMode;
  onChange: (nextValue: OwnerIntelSortMode) => void;
}) {
  return (
    <span
      className="trade-war-mode-tabs trade-war-mode-tabs-header"
      role="tablist"
      aria-label="Scout leaguemates value view"
    >
      {OWNER_INTEL_SORT_OPTIONS.map(option => (
        <button
          key={option.key}
          type="button"
          role="tab"
          className={`trade-war-mode-tab trade-war-mode-tab-${option.key} ${
            value === option.key ? "active" : ""
          }`}
          aria-selected={value === option.key}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onChange(option.key);
          }}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}
