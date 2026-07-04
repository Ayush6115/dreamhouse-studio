import { Plus, Trash2 } from 'lucide-react';
import type { RoofElement, RoofStyleType } from '../../types';
import { useDesignStore } from '../../store/designStore';
import { roofRise } from '../../geometry/roof';
import { formatLength } from '../../geometry/units';
import { Field, Section } from '../ui/Section';
import { SelectField } from '../ui/SelectField';
import { NumberField } from '../ui/NumberField';
import { MaterialSection } from './MaterialSection';
import { AngleField, LengthField } from './fields';

export function RoofPanel({ roof }: { roof: RoofElement }) {
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const updateElement = useDesignStore((s) => s.updateElement);
  const apply = (recipe: (el: RoofElement) => void) => {
    pushHistory();
    updateElement(roof.id, (el) => recipe(el as RoofElement));
  };

  const rise = roofRise(
    roof.roofStyle,
    roof.dimensions.width + 2 * roof.overhang,
    roof.dimensions.depth + 2 * roof.overhang,
    roof.pitch,
  );

  return (
    <>
      <Section title="Roof">
        <Field label="Style">
          <SelectField
            value={roof.roofStyle}
            options={[
              { value: 'gable', label: 'Gable' },
              { value: 'hip', label: 'Hip' },
              { value: 'shed', label: 'Shed (mono)' },
              { value: 'barrel', label: 'Barrel (curved)' },
              { value: 'flat', label: 'Flat' },
            ]}
            onChange={(v) => apply((el) => (el.roofStyle = v as RoofStyleType))}
          />
        </Field>
        {roof.roofStyle !== 'flat' && (
          <Field label="Pitch">
            <NumberField
              value={roof.pitch}
              min={5}
              max={60}
              step={1}
              format={(v) => `${Math.round(v)}°`}
              parse={(t) => {
                const v = Number.parseFloat(t.replace('°', ''));
                return Number.isNaN(v) ? null : v;
              }}
              onCommit={(v) => apply((el) => (el.pitch = v))}
            />
          </Field>
        )}
        <Field label="Overhang">
          <LengthField value={roof.overhang} min={0} max={1.5} step={0.05} onCommit={(v) => apply((el) => (el.overhang = v))} />
        </Field>
        <Field label="Width">
          <LengthField value={roof.dimensions.width} min={0.5} onCommit={(v) => apply((el) => (el.dimensions.width = v))} />
        </Field>
        <Field label="Depth">
          <LengthField value={roof.dimensions.depth} min={0.5} onCommit={(v) => apply((el) => (el.dimensions.depth = v))} />
        </Field>
        <Field label="Base height">
          <LengthField value={roof.transform.position.z} min={0} onCommit={(v) => apply((el) => (el.transform.position.z = v))} />
        </Field>
        <Field label="Rotation">
          <AngleField value={roof.transform.rotation} onCommit={(v) => apply((el) => (el.transform.rotation = v))} />
        </Field>
        {roof.roofStyle === 'flat' ? (
          <Field label="Parapet">
            <LengthField value={roof.parapetHeight} min={0} max={1.8} step={0.05} onCommit={(v) => apply((el) => (el.parapetHeight = v))} />
          </Field>
        ) : (
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-dim">Ridge rise</span>
            <span className="font-medium tabular-nums">{formatLength(rise, unit)}</span>
          </div>
        )}
      </Section>

      <Section title={`Skylights (${roof.skylights.length})`}>
        {roof.skylights.map((sk, i) => (
          <div key={i} className="rounded-md border border-edge-soft p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-dim">Skylight {i + 1}</span>
              <button
                title="Remove skylight"
                className="text-ink-faint hover:text-danger"
                onClick={() => apply((el) => el.skylights.splice(i, 1))}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['X', sk.x, (v: number) => apply((el) => (el.skylights[i].x = v))],
                  ['Y', sk.y, (v: number) => apply((el) => (el.skylights[i].y = v))],
                  ['W', sk.width, (v: number) => apply((el) => (el.skylights[i].width = Math.max(0.3, v)))],
                  ['D', sk.depth, (v: number) => apply((el) => (el.skylights[i].depth = Math.max(0.3, v)))],
                ] as const
              ).map(([label, value, commit]) => (
                <label key={label} className="flex items-center gap-1 text-[10px] text-ink-faint">
                  {label}
                  <LengthField value={value} onCommit={commit} />
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => apply((el) => el.skylights.push({ x: 0, y: -el.dimensions.depth / 4, width: 0.8, depth: 1.0 }))}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-edge py-1 text-xs text-ink-dim hover:border-accent hover:text-accent"
        >
          <Plus size={13} /> Add skylight
        </button>
        <p className="text-[10px] leading-snug text-ink-faint">
          Positions are measured from the roof center. Skylights seat themselves on the slope.
        </p>
      </Section>

      {roof.roofStyle !== 'flat' && (
        <Section title={`Dormers (${roof.dormers.length})`}>
          {roof.dormers.map((dm, i) => (
            <div key={i} className="rounded-md border border-edge-soft p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink-dim">Dormer {i + 1}</span>
                <button
                  title="Remove dormer"
                  className="text-ink-faint hover:text-danger"
                  onClick={() => apply((el) => el.dormers.splice(i, 1))}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['X', dm.x, (v: number) => apply((el) => (el.dormers[i].x = v))],
                    ['Y', dm.y, (v: number) => apply((el) => (el.dormers[i].y = v))],
                    ['W', dm.width, (v: number) => apply((el) => (el.dormers[i].width = Math.max(0.6, v)))],
                    ['H', dm.height, (v: number) => apply((el) => (el.dormers[i].height = Math.max(0.6, v)))],
                  ] as const
                ).map(([label, value, commit]) => (
                  <label key={label} className="flex items-center gap-1 text-[10px] text-ink-faint">
                    {label}
                    <LengthField value={value} onCommit={commit} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              apply((el) => el.dormers.push({ x: 0, y: el.dimensions.depth / 4, width: 1.2, height: 1.4 }))
            }
            className="inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-edge py-1 text-xs text-ink-dim hover:border-accent hover:text-accent"
          >
            <Plus size={13} /> Add dormer
          </button>
          <p className="text-[10px] leading-snug text-ink-faint">
            The dormer's front faces the nearer eave and seats itself on the slope.
          </p>
        </Section>
      )}

      <MaterialSection element={roof} />
    </>
  );
}
