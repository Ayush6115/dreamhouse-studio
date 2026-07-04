import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

/** Square icon button used in the toolbar and tool palette. */
export function IconButton({ label, active = false, className = '', children, ...rest }: Props) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors
        focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:pointer-events-none
        ${active ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:bg-surface-2 hover:text-ink'}
        ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
