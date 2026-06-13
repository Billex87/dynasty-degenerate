export function RecentEntrySuggestions({
  label,
  options,
  onSelect,
}: {
  label: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  if (!options.length) return null;

  return (
    <div className="home-autocomplete-panel dd-glass-strong" role="listbox" aria-label={label}>
      <span>Recent</span>
      {options.map(option => (
        <button
          key={option}
          type="button"
          role="option"
          className="home-autocomplete-option dd-glass-cold dd-pressable"
          onMouseDown={event => event.preventDefault()}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
