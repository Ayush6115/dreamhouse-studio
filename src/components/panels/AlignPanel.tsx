import type { Element } from '../../types';
import { useDesignStore } from '../../store/designStore';
import { obbAabb } from '../../geometry/obb';
import { Section } from '../ui/Section';

/**
 * Align / distribute for multi-selections. Operates on placed items
 * (furniture, columns, staircases, roofs); walls and rooms keep their own
 * vertex-level editing.
 */

type Item = Element & { transform: Element['transform'] };

const isAlignable = (el: Element) =>
  (el.type === 'furniture' || el.type === 'column' || el.type === 'staircase' || el.type === 'roof') &&
  !el.locked;

function boxOf(el: Item) {
  return obbAabb({
    c: { x: el.transform.position.x, y: el.transform.position.y },
    w: el.dimensions.width,
    d: el.dimensions.depth,
    rot: el.transform.rotation,
  });
}

export function AlignPanel({ ids }: { ids: string[] }) {
  const level = useDesignStore((s) => s.doc.levels.find((l) => l.id === s.activeLevelId));
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const updateElement = useDesignStore((s) => s.updateElement);

  const items = (level?.elements.filter((el) => ids.includes(el.id) && isAlignable(el)) ?? []) as Item[];
  if (items.length < 2) return null;

  const applyAll = (compute: (el: Item) => { x?: number; y?: number }) => {
    pushHistory();
    for (const el of items) {
      const target = compute(el);
      updateElement(el.id, (draft) => {
        if (target.x !== undefined) draft.transform.position.x = target.x;
        if (target.y !== undefined) draft.transform.position.y = target.y;
      });
    }
  };

  const align = (edge: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => {
    const boxes = items.map(boxOf);
    const min = { x: Math.min(...boxes.map((b) => b.min.x)), y: Math.min(...boxes.map((b) => b.min.y)) };
    const max = { x: Math.max(...boxes.map((b) => b.max.x)), y: Math.max(...boxes.map((b) => b.max.y)) };
    applyAll((el) => {
      const b = boxOf(el);
      const p = el.transform.position;
      switch (edge) {
        case 'left':
          return { x: p.x + (min.x - b.min.x) };
        case 'right':
          return { x: p.x + (max.x - b.max.x) };
        case 'centerX':
          return { x: p.x + ((min.x + max.x) / 2 - (b.min.x + b.max.x) / 2) };
        case 'top':
          return { y: p.y + (min.y - b.min.y) };
        case 'bottom':
          return { y: p.y + (max.y - b.max.y) };
        case 'centerY':
          return { y: p.y + ((min.y + max.y) / 2 - (b.min.y + b.max.y) / 2) };
      }
    });
  };

  const distribute = (axis: 'x' | 'y') => {
    if (items.length < 3) return;
    const sorted = [...items].sort((a, b) => a.transform.position[axis] - b.transform.position[axis]);
    const first = sorted[0].transform.position[axis];
    const last = sorted[sorted.length - 1].transform.position[axis];
    const step = (last - first) / (sorted.length - 1);
    pushHistory();
    sorted.forEach((el, i) => {
      updateElement(el.id, (draft) => {
        draft.transform.position[axis] = first + i * step;
      });
    });
  };

  const btn = (label: string, action: () => void, disabled = false) => (
    <button
      key={label}
      onClick={action}
      disabled={disabled}
      className="h-7 rounded border border-edge bg-surface-2 text-[10px] font-medium text-ink-dim
        transition-colors hover:text-ink disabled:opacity-35"
    >
      {label}
    </button>
  );

  return (
    <Section title={`Align ${items.length} items`}>
      <div className="grid grid-cols-3 gap-1">
        {btn('⭰ Left', () => align('left'))}
        {btn('⇹ Center', () => align('centerX'))}
        {btn('⭲ Right', () => align('right'))}
        {btn('⭱ Top', () => align('top'))}
        {btn('⇳ Middle', () => align('centerY'))}
        {btn('⭳ Bottom', () => align('bottom'))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {btn('↔ Distribute H', () => distribute('x'), items.length < 3)}
        {btn('↕ Distribute V', () => distribute('y'), items.length < 3)}
      </div>
      <p className="text-[10px] leading-snug text-ink-faint">
        Applies to placed items (furniture, columns, stairs, roofs). Ctrl+G groups the selection.
      </p>
    </Section>
  );
}
