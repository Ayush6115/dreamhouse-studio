import { NumberField } from '../ui/NumberField';
import { formatLength, parseLength } from '../../geometry/units';
import { useDesignStore } from '../../store/designStore';

interface LengthFieldProps {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

/** Unit-aware length input: displays "3.50 m" / "11' 6"", parses both ways. */
export function LengthField({ value, onCommit, min, max, step, disabled }: LengthFieldProps) {
  const unit = useDesignStore((s) => s.doc.unitSystem);
  return (
    <NumberField
      value={value}
      onCommit={onCommit}
      format={(v) => formatLength(v, unit)}
      parse={(t) => parseLength(t, unit)}
      min={min}
      max={max}
      step={step ?? 0.1}
      disabled={disabled}
    />
  );
}

interface AngleFieldProps {
  /** Radians in, radians out. */
  value: number;
  onCommit: (rad: number) => void;
  disabled?: boolean;
}

export function AngleField({ value, onCommit, disabled }: AngleFieldProps) {
  return (
    <NumberField
      value={(value * 180) / Math.PI}
      onCommit={(deg) => onCommit((deg * Math.PI) / 180)}
      format={(v) => `${(Math.round(v * 10) / 10 + 360) % 360}°`}
      parse={(t) => {
        const v = Number.parseFloat(t.replace('°', ''));
        return Number.isNaN(v) ? null : v;
      }}
      step={15}
      disabled={disabled}
    />
  );
}
