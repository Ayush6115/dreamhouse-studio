import { useMemo } from 'react';
import { Arrow, Group, Line, Text } from 'react-konva';
import { BUILDABLE_ID, useDesignStore } from '../../../store/designStore';
import { ensureClockwise } from '../../../geometry/polygon';
import { buildableRegion, polygonDifference, polygonIntersection } from '../../../geometry/setbacks';
import { setbackAnnotations } from '../../../geometry/setbackAnnotations';
import { formatLength } from '../../../geometry/units';
import { DimLabel } from '../DimLabel';
import { VertexHandle } from '../VertexHandle';

interface Props {
  vpScale: number;
}

/**
 * The hand-edited buildable footprint. Rendered as the TOPMOST plan layer so
 * its outline and vertex handles always win hit-testing over rooms, walls
 * and furniture beneath — footprint editing works anywhere on the plan.
 */
export function BuildableLayer({ vpScale }: Props) {
  const plot = useDesignStore((s) => s.doc.plot);
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const tool = useDesignStore((s) => s.tool);
  const buildableSelected = useDesignStore((s) => s.selectedIds.includes(BUILDABLE_ID));

  const override = plot.buildableOverride && plot.buildableOverride.length >= 3 ? plot.buildableOverride : null;
  const boundary = plot.boundary;

  const autoRegion = useMemo(
    () =>
      boundary.length >= 3
        ? buildableRegion(boundary, plot.roadDirection, plot.setbacks, plot.edgeSetbacks)
        : null,
    [boundary, plot.roadDirection, plot.setbacks, plot.edgeSetbacks],
  );

  // Validation: red = outside the plot (hard error), amber = inside the plot
  // but intruding into the legal setback strip (hidden once accepted).
  const outsidePlot = useMemo(
    () => (override ? polygonDifference(override, boundary) : []),
    [override, boundary],
  );
  const setbackIntrusion = useMemo(() => {
    if (!override || !autoRegion || plot.setbackWaiver) return [];
    return polygonDifference(override, autoRegion).flatMap((part) => polygonIntersection(part, boundary));
  }, [override, autoRegion, boundary, plot.setbackWaiver]);

  const showDimensions = useDesignStore((s) => s.showDimensions);
  const region = override ?? autoRegion;
  const annotations = useMemo(
    () => (showDimensions && boundary.length >= 3 && region ? setbackAnnotations(boundary, region) : []),
    [showDimensions, boundary, region],
  );

  const annotationNodes = (
    <Group listening={false}>
      {annotations.map((ann, i) => {
        const dx = ann.to.x - ann.from.x;
        const dy = ann.to.y - ann.from.y;
        let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (ang > 90 || ang <= -90) ang += 180;
        const mid = { x: (ann.from.x + ann.to.x) / 2, y: (ann.from.y + ann.to.y) / 2 };
        return (
          <Group key={`sa${i}`}>
            <Arrow
              points={[ann.from.x, ann.from.y, ann.to.x, ann.to.y]}
              stroke="#948a6d"
              fill="#948a6d"
              strokeWidth={0.9}
              strokeScaleEnabled={false}
              pointerAtBeginning
              pointerLength={6 / vpScale}
              pointerWidth={4.5 / vpScale}
            />
            <Group x={mid.x} y={mid.y} rotation={ang}>
              <Text
                text={formatLength(ann.distance, unit, 1) + (ann.note === 'varies' ? ' · varies' : '')}
                fontSize={11 / vpScale}
                fill="#6b6040"
                width={3}
                x={-1.5}
                y={i % 2 === 0 ? -14 / vpScale : 4 / vpScale}
                align="center"
              />
            </Group>
          </Group>
        );
      })}
    </Group>
  );

  if (!override) return annotations.length > 0 ? annotationNodes : null;

  return (
    // Reference footprint: selectable only with the Select tool.
    <Group listening={tool === 'select'}>
      {annotationNodes}
      {/* fill is reference-only — it must never swallow clicks meant for
          elements inside the footprint; only the OUTLINE is selectable */}
      <Line
        points={override.flatMap((p) => [p.x, p.y])}
        closed
        fill="rgba(123,160,91,0.10)"
        listening={false}
      />
      <Line
        points={override.flatMap((p) => [p.x, p.y])}
        closed
        fillEnabled={false}
        stroke={buildableSelected ? '#2f6fee' : '#5d8a3f'}
        strokeWidth={buildableSelected ? 2.4 : 1.8}
        strokeScaleEnabled={false}
        hitStrokeWidth={14 / vpScale}
        elementId={BUILDABLE_ID}
      />
      {/* validation fills */}
      {outsidePlot.map((part, i) => (
        <Line
          key={`vp${i}`}
          points={part.flatMap((p) => [p.x, p.y])}
          closed
          fill="rgba(229,89,94,0.35)"
          stroke="#e5595e"
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
      {setbackIntrusion.map((part, i) => (
        <Line
          key={`vs${i}`}
          points={part.flatMap((p) => [p.x, p.y])}
          closed
          fill="rgba(232,163,75,0.3)"
          stroke="#e8a34b"
          strokeWidth={1.2}
          strokeScaleEnabled={false}
          dash={[4, 3]}
          listening={false}
        />
      ))}
      {/* vertex handles */}
      {buildableSelected &&
        tool === 'select' &&
        override.map((p, i) => (
          <VertexHandle
            key={`bh${i}`}
            x={p.x}
            y={p.y}
            vpScale={vpScale}
            color="#5d8a3f"
            elementId={BUILDABLE_ID}
            handle={{ kind: 'buildable-vertex', index: i }}
          />
        ))}
      {/* live edge dimensions while editing (labels outside the footprint) */}
      {buildableSelected &&
        (() => {
          const cwOv = ensureClockwise(override);
          return cwOv.map((p, i) => (
            <DimLabel
              key={`bd${i}`}
              a={p}
              b={cwOv[(i + 1) % cwOv.length]}
              vpScale={vpScale}
              unit={unit}
              offsetM={-0.35}
              color="#5d8a3f"
            />
          ));
        })()}
    </Group>
  );
}
