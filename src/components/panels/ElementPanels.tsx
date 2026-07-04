import type {
  BeamElement,
  ColumnElement,
  Element,
  FurnitureElement,
  OpeningElement,
  RoomElement,
  StaircaseElement,
  WallElement,
} from '../../types';
import { useDesignStore } from '../../store/designStore';
import { add, norm, scale as vscale, sub } from '../../geometry/vec';
import { polygonArea, polygonPerimeter } from '../../geometry/polygon';
import { wallLength } from '../../geometry/walls';
import { formatArea, formatLength } from '../../geometry/units';
import { ROOM_TYPE_OPTIONS, roomLabel } from '../../features/plan/factories';
import type { RoomType } from '../../types';
import { Field, Section } from '../ui/Section';
import { SelectField } from '../ui/SelectField';
import { NumberField } from '../ui/NumberField';
import { Button } from '../ui/Button';
import { MaterialSection } from './MaterialSection';
import { AngleField, LengthField } from './fields';

function useElementEdit(id: string) {
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const updateElement = useDesignStore((s) => s.updateElement);
  return (recipe: (el: Element) => void) => {
    pushHistory();
    updateElement(id, recipe);
  };
}

function NameField({ element }: { element: Element }) {
  const apply = useElementEdit(element.id);
  return (
    <Field label="Name">
      <input
        defaultValue={element.name}
        key={element.id + element.name}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== element.name) apply((el) => (el.name = v));
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-7 w-full rounded border border-edge bg-surface-2 px-2 text-xs text-ink focus:border-accent focus:outline-none"
      />
    </Field>
  );
}

// ---------------------------------------------------------------- Wall

export function WallPanel({ wall }: { wall: WallElement }) {
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const apply = useElementEdit(wall.id);
  const len = wallLength(wall);

  return (
    <>
      <Section title="Wall">
        <NameField element={wall} />
        <Field label="Length">
          <LengthField
            value={len}
            min={0.1}
            onCommit={(v) =>
              apply((el) => {
                // Keep the start fixed; slide the end along the wall direction.
                const w = el as WallElement;
                const dir = norm(sub(w.end, w.start));
                w.end = add(w.start, vscale(dir, v));
              })
            }
          />
        </Field>
        <Field label="Thickness">
          <LengthField
            value={wall.dimensions.thickness ?? wall.dimensions.depth}
            min={0.05}
            max={1}
            step={0.01}
            onCommit={(v) =>
              apply((el) => {
                el.dimensions.thickness = v;
                el.dimensions.depth = v;
              })
            }
          />
        </Field>
        <Field label="Height">
          <LengthField
            value={wall.dimensions.height}
            min={0.3}
            max={8}
            onCommit={(v) => apply((el) => (el.dimensions.height = v))}
          />
        </Field>
        <p className="text-[10px] leading-snug text-ink-faint">
          Wall runs {formatLength(len, unit)} along its centerline. Drag its endpoint handles to reshape.
        </p>
      </Section>
      <MaterialSection element={wall} />
    </>
  );
}

// ---------------------------------------------------------------- Opening

export function OpeningPanel({ opening }: { opening: OpeningElement }) {
  const apply = useElementEdit(opening.id);
  const host = useDesignStore((s) =>
    s.doc.levels.find((l) => l.id === s.activeLevelId)?.elements.find((e) => e.id === opening.wallId),
  ) as WallElement | undefined;
  const hostLen = host ? wallLength(host) : 0;

  return (
    <>
      <Section title={opening.type === 'door' ? 'Door' : 'Window'}>
        <NameField element={opening} />
        <Field label="Width">
          <LengthField
            value={opening.dimensions.width}
            min={0.3}
            max={Math.max(0.3, hostLen - 0.1)}
            step={0.05}
            onCommit={(v) => apply((el) => (el.dimensions.width = v))}
          />
        </Field>
        <Field label="Height">
          <LengthField
            value={opening.dimensions.height}
            min={0.3}
            max={host?.dimensions.height ?? 3}
            step={0.05}
            onCommit={(v) => apply((el) => (el.dimensions.height = v))}
          />
        </Field>
        {opening.type === 'window' && (
          <Field label="Sill height">
            <LengthField
              value={opening.sillHeight}
              min={0}
              max={2.5}
              step={0.05}
              onCommit={(v) => apply((el) => ((el as OpeningElement).sillHeight = v))}
            />
          </Field>
        )}
        <Field label="Position">
          <LengthField
            value={opening.offset}
            min={opening.dimensions.width / 2}
            max={Math.max(opening.dimensions.width / 2, hostLen - opening.dimensions.width / 2)}
            onCommit={(v) => apply((el) => ((el as OpeningElement).offset = v))}
          />
        </Field>
        <Field label="Style">
          <SelectField
            value={opening.style}
            options={(opening.type === 'door'
              ? ['single', 'double', 'sliding']
              : ['sliding', 'fixed', 'casement', 'double']
            ).map((s) => ({ value: s, label: s }))}
            onChange={(v) => apply((el) => ((el as OpeningElement).style = v as OpeningElement['style']))}
          />
        </Field>
        {opening.type === 'window' && (
          <Field label="Mullions">
            <NumberField
              value={opening.mullions ?? (opening.style === 'sliding' || opening.style === 'casement' ? 1 : 0)}
              min={0}
              max={6}
              step={1}
              onCommit={(v) => apply((el) => ((el as OpeningElement).mullions = Math.round(v)))}
            />
          </Field>
        )}
        {opening.type === 'door' && (
          <Button size="sm" onClick={() => apply((el) => ((el as OpeningElement).swing = ((el as OpeningElement).swing ?? 1) === 1 ? -1 : 1))}>
            Flip swing
          </Button>
        )}
        <p className="text-[10px] leading-snug text-ink-faint">
          Position is measured from the wall's start to the opening center. Drag the symbol to slide it.
        </p>
      </Section>
      <MaterialSection element={opening} />
    </>
  );
}

// ---------------------------------------------------------------- Room

export function RoomPanel({ room }: { room: RoomElement }) {
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const apply = useElementEdit(room.id);

  return (
    <>
      <Section title="Room">
        <Field label="Type">
          <SelectField
            value={room.roomType}
            options={ROOM_TYPE_OPTIONS}
            onChange={(v) =>
              apply((el) => {
                const r = el as RoomElement;
                const wasAuto = r.name === roomLabel(r.roomType);
                r.roomType = v as RoomType;
                if (wasAuto) r.name = roomLabel(r.roomType);
              })
            }
          />
        </Field>
        <NameField element={room} />
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-dim">Area</span>
          <span className="font-medium tabular-nums">{formatArea(polygonArea(room.boundary), unit)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-dim">Perimeter</span>
          <span className="font-medium tabular-nums">{formatLength(polygonPerimeter(room.boundary), unit)}</span>
        </div>
      </Section>
      <MaterialSection element={room} />
    </>
  );
}

// ---------------------------------------------------------------- Items

type Item = ColumnElement | BeamElement | StaircaseElement | FurnitureElement;

export function ItemPanel({ item }: { item: Item }) {
  const apply = useElementEdit(item.id);
  const titles: Record<Item['type'], string> = {
    column: 'Column',
    beam: 'Beam',
    staircase: 'Staircase',
    furniture: 'Furniture',
  };

  return (
    <>
      <Section title={titles[item.type]}>
        <NameField element={item} />
        {item.type !== 'beam' && (
          <>
            <Field label="X">
              <LengthField value={item.transform.position.x} onCommit={(v) => apply((el) => (el.transform.position.x = v))} />
            </Field>
            <Field label="Y">
              <LengthField value={item.transform.position.y} onCommit={(v) => apply((el) => (el.transform.position.y = v))} />
            </Field>
            <Field label="Rotation">
              <AngleField value={item.transform.rotation} onCommit={(v) => apply((el) => (el.transform.rotation = v))} />
            </Field>
          </>
        )}
        <Field label="Width">
          <LengthField value={item.dimensions.width} min={0.05} onCommit={(v) => apply((el) => (el.dimensions.width = v))} />
        </Field>
        <Field label="Depth">
          <LengthField value={item.dimensions.depth} min={0.05} onCommit={(v) => apply((el) => (el.dimensions.depth = v))} />
        </Field>
        <Field label="Height">
          <LengthField value={item.dimensions.height} min={0.02} onCommit={(v) => apply((el) => (el.dimensions.height = v))} />
        </Field>
        {(item.type === 'furniture' || item.type === 'beam') && (
          <Field label="Elev. (z)">
            <LengthField value={item.transform.position.z} min={0} onCommit={(v) => apply((el) => (el.transform.position.z = v))} />
          </Field>
        )}
        {item.type === 'column' && (
          <Field label="Profile">
            <SelectField
              value={item.profile}
              options={[
                { value: 'rect', label: 'Rectangular' },
                { value: 'round', label: 'Round' },
              ]}
              onChange={(v) => apply((el) => ((el as ColumnElement).profile = v as ColumnElement['profile']))}
            />
          </Field>
        )}
        {item.type === 'staircase' && (
          <Field label="Steps">
            <NumberField value={item.steps} min={3} max={30} step={1} onCommit={(v) => apply((el) => ((el as StaircaseElement).steps = Math.round(v)))} />
          </Field>
        )}
      </Section>
      <MaterialSection element={item} />
    </>
  );
}
