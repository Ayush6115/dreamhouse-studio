import { useMemo } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import { PLOT_ID, useDesignStore } from '../../../store/designStore';
import { useUiStore } from '../../../store/uiStore';
import { ensureClockwise, polygonBounds, polygonCentroid } from '../../../geometry/polygon';
import { buildableRegion } from '../../../geometry/setbacks';
import { DimLabel } from '../DimLabel';
import { VertexHandle } from '../VertexHandle';

interface Props {
  vpScale: number;
}

/** Plot boundary, setback (buildable) region, dimensions, north + road markers. */
export function PlotLayer({ vpScale }: Props) {
  const plot = useDesignStore((s) => s.doc.plot);
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const selected = useDesignStore((s) => s.selectedIds.includes(PLOT_ID));
  const tool = useDesignStore((s) => s.tool);
  const showDimensions = useDesignStore((s) => s.showDimensions);
  const selectedVertices = useUiStore((s) => s.selectedPlotVertices);

  const boundary = plot.boundary;
  const autoRegion = useMemo(
    () =>
      boundary.length >= 3
        ? buildableRegion(boundary, plot.roadDirection, plot.setbacks, plot.edgeSetbacks)
        : null,
    [boundary, plot.roadDirection, plot.setbacks, plot.edgeSetbacks],
  );
  const override = plot.buildableOverride && plot.buildableOverride.length >= 3 ? plot.buildableOverride : null;

  const cw = useMemo(() => (boundary.length >= 3 ? ensureClockwise(boundary) : []), [boundary]);

  if (boundary.length < 3) return null;

  const flat = boundary.flatMap((p) => [p.x, p.y]);
  const bounds = polygonBounds(boundary);
  const centroid = polygonCentroid(boundary);

  // Road marker position: from the centroid, walk toward the road compass
  // direction just past the plot extent.
  const roadRad = (plot.roadDirection * Math.PI) / 180;
  const roadDir = { x: Math.sin(roadRad), y: -Math.cos(roadRad) };
  const extent =
    Math.abs(roadDir.x) * (bounds.max.x - bounds.min.x) / 2 +
    Math.abs(roadDir.y) * (bounds.max.y - bounds.min.y) / 2;
  const roadPos = {
    x: centroid.x + roadDir.x * (extent + 1.6),
    y: centroid.y + roadDir.y * (extent + 1.6),
  };

  return (
    // Reference geometry: hit-testable only with the Select tool, so plot
    // and setback outlines never intercept drawing/placement clicks.
    <Group listening={tool === 'select'}>
      {/* ground fill (non-interactive) */}
      <Line points={flat} closed fill="rgba(163,177,138,0.16)" listening={false} />

      {/* legal setback envelope (clickable — selects the plot to edit setbacks) */}
      {autoRegion && (
        <Line
          points={autoRegion.flatMap((p) => [p.x, p.y])}
          closed
          stroke="#7ba05b"
          strokeWidth={1.2}
          strokeScaleEnabled={false}
          dash={[7, 5]}
          opacity={override ? 0.45 : 1}
          hitStrokeWidth={override ? 0 : 12 / vpScale}
          listening={!override}
          elementId={PLOT_ID}
        />
      )}

      {/* boundary — the clickable part of the plot (hit width in SCREEN px) */}
      <Line
        points={flat}
        closed
        stroke={selected ? '#2f6fee' : '#6b6353'}
        strokeWidth={selected ? 2.5 : 2}
        strokeScaleEnabled={false}
        hitStrokeWidth={14 / vpScale}
        elementId={PLOT_ID}
      />

      {/* live edge dimensions (offset outward; cw winding → outward is -perp) */}
      {showDimensions &&
        cw.map((p, i) => (
          <DimLabel
            key={i}
            a={p}
            b={cw[(i + 1) % cw.length]}
            vpScale={vpScale}
            unit={unit}
            offsetM={-0.55}
            color="#7a6f4f"
          />
        ))}

      {/* vertex handles (shift-click adds to a multi-selection; right-click deletes) */}
      {selected &&
        tool === 'select' &&
        boundary.map((p, i) => (
          <VertexHandle
            key={`h${i}`}
            x={p.x}
            y={p.y}
            vpScale={vpScale}
            emphasized={selectedVertices.includes(i)}
            elementId={PLOT_ID}
            handle={{ kind: 'plot-vertex', index: i }}
          />
        ))}

      {/* edge index badges (match the Edges list in the panel) */}
      {selected &&
        tool === 'select' &&
        boundary.map((p, i) => {
          const q = boundary[(i + 1) % boundary.length];
          const mx = (p.x + q.x) / 2;
          const my = (p.y + q.y) / 2;
          return (
            <Group key={`e${i}`} x={mx} y={my} listening={false}>
              <Circle radius={7.5 / vpScale} fill="#2f6fee" opacity={0.9} />
              <Text
                text={String(i + 1)}
                fontSize={9 / vpScale}
                fill="#ffffff"
                fontStyle="bold"
                width={16 / vpScale}
                x={-8 / vpScale}
                y={-4.5 / vpScale}
                align="center"
              />
            </Group>
          );
        })}

      {/* north arrow */}
      <Group
        x={bounds.max.x + 1.6}
        y={bounds.min.y}
        rotation={plot.northAngle}
        listening={false}
      >
        <Circle radius={0.55} stroke="#7a6f4f" strokeWidth={1.2} strokeScaleEnabled={false} />
        <Line points={[0, 0.4, 0, -0.4]} stroke="#7a6f4f" strokeWidth={1.2} strokeScaleEnabled={false} />
        <Line points={[-0.14, -0.16, 0, -0.4, 0.14, -0.16]} closed fill="#7a6f4f" />
        <Text text="N" x={-0.1} y={0.52} fontSize={0.32} fill="#7a6f4f" fontStyle="bold" />
      </Group>

      {/* road marker */}
      <Group x={roadPos.x} y={roadPos.y} listening={false}>
        <Text
          text="R O A D"
          fontSize={16 / vpScale}
          fill="#8a8272"
          fontStyle="bold"
          x={-1.1}
          y={-0.2}
          width={2.2}
          align="center"
        />
      </Group>
    </Group>
  );
}
