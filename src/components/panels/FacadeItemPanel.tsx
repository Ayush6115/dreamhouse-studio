import type { FacadeElementItem } from '../../types';
import { useDesignStore } from '../../store/designStore';
import { Field, Section } from '../ui/Section';
import { MaterialSection } from './MaterialSection';
import { AngleField, LengthField } from './fields';

/** Properties for an element placed on a façade (elevation designer). */
export function FacadeItemPanel({ item }: { item: FacadeElementItem }) {
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const updateElement = useDesignStore((s) => s.updateElement);
  const apply = (recipe: (el: FacadeElementItem) => void) => {
    pushHistory();
    updateElement(item.id, (el) => recipe(el as FacadeElementItem));
  };

  return (
    <>
      <Section title="Façade element">
        <Field label="Horizontal">
          <LengthField value={item.transform.position.x} onCommit={(v) => apply((el) => (el.transform.position.x = v))} />
        </Field>
        <Field label="Height">
          <LengthField value={item.transform.position.z} min={0} onCommit={(v) => apply((el) => (el.transform.position.z = v))} />
        </Field>
        <Field label="Width">
          <LengthField value={item.dimensions.width} min={0.05} onCommit={(v) => apply((el) => (el.dimensions.width = v))} />
        </Field>
        <Field label="Tall">
          <LengthField value={item.dimensions.height} min={0.05} onCommit={(v) => apply((el) => (el.dimensions.height = v))} />
        </Field>
        <Field label="Rotation">
          <AngleField value={item.transform.rotation} onCommit={(v) => apply((el) => (el.transform.rotation = v))} />
        </Field>
        <Field label="Stacking">
          <div className="flex gap-1">
            <button
              className="h-7 flex-1 rounded border border-edge bg-surface-2 text-xs text-ink-dim hover:text-ink"
              onClick={() => apply((el) => (el.layer = (el.layer ?? 0) - 1))}
              title="Draw behind other elements"
            >
              ↓ Back
            </button>
            <button
              className="h-7 flex-1 rounded border border-edge bg-surface-2 text-xs text-ink-dim hover:text-ink"
              onClick={() => apply((el) => (el.layer = (el.layer ?? 0) + 1))}
              title="Draw in front of other elements"
            >
              ↑ Front
            </button>
          </div>
        </Field>
      </Section>
      <MaterialSection element={item} />
    </>
  );
}
