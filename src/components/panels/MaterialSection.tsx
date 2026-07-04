import type { Element } from '../../types';
import { MATERIALS, materialById } from '../../library/materials';
import { useDesignStore } from '../../store/designStore';
import { ColorField } from '../ui/ColorField';
import { SelectField } from '../ui/SelectField';
import { Field, Section } from '../ui/Section';

/**
 * Material editor shared by every element type: a visual swatch grid of the
 * preset library (texture thumbnails where available), plus tint + finish.
 */
export function MaterialSection({ element }: { element: Element }) {
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const updateElement = useDesignStore((s) => s.updateElement);

  const apply = (recipe: (el: Element) => void) => {
    pushHistory();
    updateElement(element.id, recipe);
  };

  return (
    <Section title={`Material — ${element.material.name}`}>
      <div className="grid grid-cols-7 gap-1">
        {MATERIALS.map((m) => {
          const active = element.material.id === m.id;
          return (
            <button
              key={m.id}
              title={m.name}
              onClick={() =>
                apply((el) => {
                  el.material = { ...materialById(m.id) };
                })
              }
              className={`h-7 w-7 rounded-md border transition-transform hover:scale-110
                ${active ? 'border-accent ring-2 ring-accent/50' : 'border-edge'}`}
              style={
                m.texture
                  ? {
                      backgroundImage: `url(/assets/textures/${m.texture}/color.jpg)`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : { backgroundColor: m.color }
              }
            />
          );
        })}
      </div>
      <Field label="Tint">
        <ColorField
          value={element.material.color}
          onChange={(color) =>
            apply((el) => {
              el.material.color = color;
              el.material.name = 'Custom';
            })
          }
        />
      </Field>
      <Field label="Finish">
        <SelectField
          value={element.material.finish}
          options={['matte', 'satin', 'glossy', 'textured'].map((f) => ({ value: f, label: f }))}
          onChange={(finish) =>
            apply((el) => {
              el.material.finish = finish as Element['material']['finish'];
              el.material.roughness =
                finish === 'glossy' ? 0.2 : finish === 'satin' ? 0.55 : finish === 'textured' ? 1 : 0.9;
            })
          }
        />
      </Field>
      <p className="text-[10px] leading-snug text-ink-faint">
        Textured presets tile in real meters in 3D; the tint multiplies over the texture.
      </p>
    </Section>
  );
}
