import { useEffect, useState } from 'react';

interface Props {
  value: number;
  /** Called with the parsed value on Enter or blur. */
  onCommit: (value: number) => void;
  /** Render the number for display (e.g. attach a unit). */
  format?: (v: number) => string;
  /** Parse user text back to a number; return null to reject. */
  parse?: (text: string) => number | null;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

/**
 * Text-based numeric input that commits on Enter/blur and supports custom
 * parse/format (used with parseLength for unit-aware fields like "11'6"").
 */
export function NumberField({ value, onCommit, format, parse, min, max, step, disabled }: Props) {
  const display = format ? format(value) : String(Math.round(value * 1000) / 1000);
  const [text, setText] = useState(display);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(display);
  }, [display, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parse ? parse(text) : Number.parseFloat(text);
    if (parsed === null || Number.isNaN(parsed)) {
      setText(display);
      return;
    }
    let v = parsed;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onCommit(v);
  };

  const nudge = (dir: 1 | -1) => {
    if (!step) return;
    let v = value + dir * step;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onCommit(v);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      disabled={disabled}
      onFocus={(e) => {
        setEditing(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        else if (e.key === 'Escape') {
          setText(display);
          setEditing(false);
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          nudge(1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          nudge(-1);
        }
      }}
      className="h-7 w-full rounded border border-edge bg-surface-2 px-2 text-xs text-ink
        focus:border-accent focus:outline-none disabled:opacity-40"
    />
  );
}
