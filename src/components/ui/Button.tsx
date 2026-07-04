import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'subtle' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-accent-strong hover:bg-accent text-white',
  subtle: 'bg-surface-2 hover:bg-surface-3 text-ink border border-edge',
  ghost: 'bg-transparent hover:bg-surface-2 text-ink-dim hover:text-ink',
  danger: 'bg-transparent hover:bg-danger/15 text-danger border border-danger/40',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Button({ variant = 'subtle', size = 'md', className = '', children, ...rest }: Props) {
  const sizing = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm';
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors
        focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:pointer-events-none
        ${sizing} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
