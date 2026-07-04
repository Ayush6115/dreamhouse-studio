import { useMemo } from 'react';
import { Group, Line } from 'react-konva';
import { BUILDABLE_ID, useDesignStore } from '../../../store/designStore';
import { ensureClockwise } from '../../../geometry/polygon';
import { buildableRegion, polygonDifference, polygonIntersection } from '../../../geometry/setbacks';
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

  if (!override) return null;

  return (
    <Group>
      <Line
        points={override.flatMap((p) => [p.x, p.y])}
        closed
        fill="rgba(123,160,91,0.10)"
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
