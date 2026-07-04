import type { NoteElement } from '../../types';
import { useDesignStore } from '../../store/designStore';
import { noteBounds } from '../../features/plan/factories';
import { ColorField } from '../ui/ColorField';
import { Field, Section } from '../ui/Section';
import { AngleField, LengthField } from './fields';

export function NotePanel({ note }: { note: NoteElement }) {
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const updateElement = useDesignStore((s) => s.updateElement);
  const apply = (recipe: (el: NoteElement) => void) => {
    pushHistory();
    updateElement(note.id, (el) => {
      recipe(el as NoteElement);
      const n = el as NoteElement;
      const box = noteBounds(n.text, n.dimensions.height);
      n.dimensions.width = box.width;
      n.dimensions.depth = box.depth;
    });
  };

  return (
    <Section title="Text note">
      <textarea
        key={note.id}
        defaultValue={note.text}
        rows={3}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => {
          const v = e.target.value;
          if (v !== note.text) apply((el) => (el.text = v || 'Text'));
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        className="w-full rounded border border-edge bg-surface-2 px-2 py-1.5 text-xs leading-snug text-ink
          focus:border-accent focus:outline-none"
        placeholder="Type your note… (Shift+Enter for a new line)"
      />
      <Field label="Text size">
        <LengthField
          value={note.dimensions.height}
          min={0.1}
          max={2}
          step={0.05}
          onCommit={(v) => apply((el) => (el.dimensions.height = v))}
        />
      </Field>
      <Field label="Color">
        <ColorField value={note.material.color} onChange={(c) => apply((el) => (el.material.color = c))} />
      </Field>
      <Field label="Rotation">
        <AngleField value={note.transform.rotation} onCommit={(v) => apply((el) => (el.transform.rotation = v))} />
      </Field>
      <p className="text-[10px] leading-snug text-ink-faint">
        Text size is in real meters, so notes scale with the drawing and appear in exports. Drag the
        note to move it; R rotates.
      </p>
    </Section>
  );
}
