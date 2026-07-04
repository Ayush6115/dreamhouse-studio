import { useEffect, useState } from 'react';

interface Props {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}

export function ColorField({ value, onChange, disabled }: Props) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commitText = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(text)) onChange(text);
    else setText(value);
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border border-edge bg-surface-2 p-0.5 disabled:opacity-40"
      />
      <input
        type="text"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-7 w-full rounded border border-edge bg-surface-2 px-2 text-xs text-ink
          focus:border-accent focus:outline-none disabled:opacity-40"
      />
    </div>
  );
}
