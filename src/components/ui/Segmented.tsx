import type { ReactNode } from 'react';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

/** Segmented control (view-mode switcher, day/night toggle…). */
export function Segmented<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="flex items-center rounded-md border border-edge bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`h-7 rounded px-1.5 text-xs font-medium transition-colors sm:px-2.5
            ${value === o.value ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
