interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SelectField({ value, options, onChange, disabled }: Props) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-full rounded border border-edge bg-surface-2 px-1.5 text-xs text-ink
        focus:border-accent focus:outline-none disabled:opacity-40"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
