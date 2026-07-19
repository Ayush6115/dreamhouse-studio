import { Circle, Group, Rect, Text } from 'react-konva';
import type { Element } from '../../../types';
import { useDesignStore } from '../../../store/designStore';
import { catalogItemById } from '../../../library/catalog';
import { solveStairElement } from '../../../engine/stair';
import { stairPlanBlock } from '../../../engine/stairPlan';
import { PrimGlyph, Symbol2DShape } from '../symbols2d';

const deg = (rad: number) => (rad * 180) / Math.PI;

/** Columns, beams, staircases and furniture symbols. */
export function ItemsLayer() {
  const level = useDesignStore((s) => s.doc.levels.find((l) => l.id === s.activeLevelId));
  const selectedIds = useDesignStore((s) => s.selectedIds);
  if (!level) return null;

  const items = level.elements.filter(
    (e) =>
      e.type === 'column' ||
      e.type === 'beam' ||
      e.type === 'staircase' ||
      e.type === 'furniture' ||
      e.type === 'note',
  );

  return (
    <Group>
      {items.map((el: Element) => {
        if (el.visible === false) return null;
        const selected = selectedIds.includes(el.id);
        const { width: w, depth: d } = el.dimensions;

        if (el.type === 'beam') {
          const mx = (el.start.x + el.end.x) / 2;
          const my = (el.start.y + el.end.y) / 2;
          const len = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
          const ang = deg(Math.atan2(el.end.y - el.start.y, el.end.x - el.start.x));
          return (
            <Group key={el.id} x={mx} y={my} rotation={ang} elementId={el.id}>
              <Rect
                x={-len / 2}
                y={-d / 2}
                width={len}
                height={d}
                stroke={selected ? '#2f6fee' : '#8b8474'}
                strokeWidth={selected ? 1.6 : 1}
                strokeScaleEnabled={false}
                dash={[7, 4]}
              />
              {/* invisible hit area */}
              <Rect x={-len / 2} y={-d / 2 - 0.05} width={len} height={d + 0.1} opacity={0} />
            </Group>
          );
        }

        const t = el.transform;
        const selectionBox = selected && (
          <Rect
            x={-w / 2 - 0.08}
            y={-d / 2 - 0.08}
            width={w + 0.16}
            height={d + 0.16}
            stroke="#2f6fee"
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            dash={[5, 3]}
            listening={false}
          />
        );

        if (el.type === 'column') {
          return (
            <Group key={el.id} x={t.position.x} y={t.position.y} rotation={deg(t.rotation)} elementId={el.id}>
              {el.profile === 'round' ? (
                <Circle radius={w / 2} fill="#3c3831" />
              ) : (
                <Rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#3c3831" />
              )}
              {selectionBox}
            </Group>
          );
        }

        if (el.type === 'note') {
          return (
            <Group key={el.id} x={t.position.x} y={t.position.y} rotation={deg(t.rotation)} elementId={el.id}>
              <Rect x={-w / 2} y={-d / 2} width={w} height={d} opacity={0} />
              <Text
                text={el.text}
                fontSize={el.dimensions.height}
                fontFamily="Inter Variable, system-ui, sans-serif"
                fill={el.material.color}
                width={w}
                x={-w / 2}
                y={-d / 2}
                align="center"
                lineHeight={1.3}
                listening={false}
              />
              {selectionBox}
            </Group>
          );
        }

        if (el.type === 'staircase') {
          const sol = solveStairElement(el, level.height ?? el.dimensions.height);
          return (
            <Group key={el.id} x={t.position.x} y={t.position.y} rotation={deg(t.rotation)} elementId={el.id}>
              {/* hit region */}
              <Rect x={-w / 2} y={-d / 2} width={w} height={d} opacity={0} />
              <PrimGlyph prims={stairPlanBlock(w, d, sol)} stroke="#3d382f" body="#eceade" />
              <Text
                text={`UP ${sol.risers}R`}
                fontSize={0.18}
                fontStyle="600"
                fill={sol.ok ? '#3d382f' : '#b3701f'}
                x={sol.type === 'u-shaped' ? w / 2 - 0.78 : 0.1}
                y={d / 2 - 0.36}
                listening={false}
              />
              {selectionBox}
            </Group>
          );
        }

        // furniture
        const def = el.type === 'furniture' ? catalogItemById(el.catalogId) : undefined;
        return (
          <Group
            key={el.id}
            x={t.position.x}
            y={t.position.y}
            rotation={deg(t.rotation)}
            scaleX={t.scale.x}
            scaleY={t.scale.y}
            elementId={el.id}
          >
            {/* hit region */}
            <Rect x={-w / 2} y={-d / 2} width={w} height={d} opacity={0} />
            <Symbol2DShape kind={def?.symbol ?? 'box'} w={w} d={d} color={el.material.color} />
            {selectionBox}
          </Group>
        );
      })}
    </Group>
  );
}
