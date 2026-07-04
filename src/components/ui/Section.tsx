import type { ReactNode } from 'react';

/** Titled group inside the properties panel. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-edge-soft px-3 py-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

/** Label + control on one row. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[92px_1fr] items-center gap-2 text-xs text-ink-dim">
      <span className="truncate" title={label}>
        {label}
      </span>
      {children}
    </label>
  );
}
