import { Plus, Trash2 } from 'lucide-react';
import { useActiveFacade, useDesignStore } from '../../store/designStore';
import { ColorField } from '../ui/ColorField';
import { Field, Section } from '../ui/Section';
import { LengthField } from './fields';

/** Shown in elevation mode with nothing selected: manage façades. */
export function FacadePanel() {
  const doc = useDesignStore((s) => s.doc);
  const facade = useActiveFacade();
  const setActiveFacade = useDesignStore((s) => s.setActiveFacade);
  const addFacade = useDesignStore((s) => s.addFacade);
  const removeFacade = useDesignStore((s) => s.removeFacade);
  const updateFacade = useDesignStore((s) => s.updateFacade);
  const pushHistory = useDesignStore((s) => s.pushHistory);

  if (!facade) return null;

  return (
    <>
      <Section title="Façades">
        <div className="flex flex-col gap-1">
          {doc.facades.map((f) => (
            <div
              key={f.id}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs
                ${f.id === facade.id ? 'border-accent bg-accent-soft text-ink' : 'border-edge bg-surface-2 text-ink-dim'}`}
            >
              <button className="flex-1 truncate text-left" onClick={() => setActiveFacade(f.id)}>
                {f.name}
              </button>
              {doc.facades.length > 1 && (
                <button title="Delete façade" className="text-ink-faint hover:text-danger" onClick={() => removeFacade(f.id)}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addFacade}
            className="mt-1 inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-edge py-1 text-xs text-ink-dim hover:border-accent hover:text-accent"
          >
            <Plus size={13} /> Add façade
          </button>
        </div>
      </Section>

      <Section title={facade.name}>
        <Field label="Name">
          <input
            key={facade.id}
            defaultValue={facade.name}
            onBlur={(e) => updateFacade(facade.id, { name: e.target.value.trim() || facade.name })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="h-7 w-full rounded border border-edge bg-surface-2 px-2 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </Field>
        <Field label="Width">
          <LengthField
            value={facade.width}
            min={2}
            max={60}
            onCommit={(v) => {
              pushHistory();
              updateFacade(facade.id, { width: v });
            }}
          />
        </Field>
        <Field label="Height">
          <LengthField
            value={facade.height}
            min={2}
            max={30}
            onCommit={(v) => {
              pushHistory();
              updateFacade(facade.id, { height: v });
            }}
          />
        </Field>
        <Field label="Backdrop">
          <ColorField
            value={facade.backdropColor}
            onChange={(c) => {
              pushHistory();
              updateFacade(facade.id, { backdropColor: c });
            }}
          />
        </Field>
        <p className="text-[10px] leading-snug text-ink-faint">
          Compose the façade from the library (F). Drag components to position them; edit sizes and
          materials here after selecting.
        </p>
      </Section>
    </>
  );
}
