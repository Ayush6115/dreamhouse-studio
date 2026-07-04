import { BUILDABLE_ID, useDesignStore } from '../../store/designStore';
import { polygonArea, polygonPerimeter } from '../../geometry/polygon';
import { buildableRegion, classifyEdges } from '../../geometry/setbacks';
import { add, dist, norm, scale, sub } from '../../geometry/vec';
import { formatArea, formatLength } from '../../geometry/units';
import { Button } from '../ui/Button';
import { Field, Section } from '../ui/Section';
import { NumberField } from '../ui/NumberField';
import { LengthField } from './fields';

const parseDeg = (t: string): number | null => {
  const v = Number.parseFloat(t.replace('°', ''));
  return Number.isNaN(v) ? null : ((v % 360) + 360) % 360;
};

export function PlotPanel() {
  const plot = useDesignStore((s) => s.doc.plot);
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const updatePlot = useDesignStore((s) => s.updatePlot);
  const setPlotBoundary = useDesignStore((s) => s.setPlotBoundary);
  const setTool = useDesignStore((s) => s.setTool);
  const setSelection = useDesignStore((s) => s.setSelection);

  const hasBoundary = plot.boundary.length >= 3;
  const region = hasBoundary
    ? buildableRegion(plot.boundary, plot.roadDirection, plot.setbacks, plot.edgeSetbacks)
    : null;
  const hasOverride = !!plot.buildableOverride && plot.buildableOverride.length >= 3;
  const edgeSides = hasBoundary ? classifyEdges(plot.boundary, plot.roadDirection) : [];

  const commitSetback = (side: 'front' | 'rear' | 'left' | 'right') => (v: number) => {
    pushHistory();
    updatePlot({ setbacks: { ...plot.setbacks, [side]: v } });
  };

  return (
    <>
      <Section title="Plot">
        {hasBoundary ? (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-dim">Area</span>
              <span className="font-medium tabular-nums">{formatArea(polygonArea(plot.boundary), unit)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-dim">Perimeter</span>
              <span className="font-medium tabular-nums">{formatLength(polygonPerimeter(plot.boundary), unit)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-dim">Vertices</span>
              <span className="font-medium tabular-nums">{plot.boundary.length}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-ink-dim">No boundary yet — draw one with the Plot tool.</p>
        )}
        <div className="mt-1 flex gap-2">
          <Button size="sm" onClick={() => setTool('plot')}>
            {hasBoundary ? 'Redraw' : 'Draw plot'}
          </Button>
          {hasBoundary && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                pushHistory();
                setPlotBoundary([]);
                setSelection([]);
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <p className="text-[10px] leading-snug text-ink-faint">
          Drag vertices to reshape (Shift-click selects several; right-click deletes one; double-click
          an edge to add one). Drag the outline to move the whole plot.
        </p>
      </Section>

      {hasBoundary && (
        <Section title={`Edges (${plot.boundary.length})`}>
          {plot.boundary.map((p, i) => {
            const q = plot.boundary[(i + 1) % plot.boundary.length];
            const len = dist(p, q);
            return (
              <div key={i} className="grid grid-cols-[52px_1fr] items-center gap-2 text-xs text-ink-dim">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft text-[9px] font-bold text-accent">
                    {i + 1}
                  </span>
                  Edge
                </span>
                <LengthField
                  value={len}
                  min={0.1}
                  onCommit={(v) => {
                    // Move the edge's END vertex along the edge direction, so
                    // only this edge and the following one change.
                    if (len < 1e-9) return;
                    pushHistory();
                    const dir = norm(sub(q, p));
                    const pts = plot.boundary.map((pt2) => ({ ...pt2 }));
                    pts[(i + 1) % pts.length] = add(p, scale(dir, v));
                    setPlotBoundary(pts);
                  }}
                />
              </div>
            );
          })}
          <p className="text-[10px] leading-snug text-ink-faint">
            Numbers match the badges on the canvas. Enter applies; the edge's end vertex slides along
            the edge direction. Accepts 36.4ft, 3.5m, 3500mm, 11'6"…
          </p>
        </Section>
      )}

      <Section title="Setbacks">
        <Field label="Front">
          <LengthField value={plot.setbacks.front} min={0} onCommit={commitSetback('front')} />
        </Field>
        <Field label="Rear">
          <LengthField value={plot.setbacks.rear} min={0} onCommit={commitSetback('rear')} />
        </Field>
        <Field label="Left">
          <LengthField value={plot.setbacks.left} min={0} onCommit={commitSetback('left')} />
        </Field>
        <Field label="Right">
          <LengthField value={plot.setbacks.right} min={0} onCommit={commitSetback('right')} />
        </Field>

        {hasBoundary && (
          <details className="mt-1">
            <summary className="cursor-pointer text-[11px] text-ink-dim hover:text-ink">
              Per-edge overrides…
            </summary>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {plot.boundary.map((_, i) => {
                const side = edgeSides[i];
                const override = plot.edgeSetbacks?.[i] ?? null;
                const sideDefault =
                  side === 'front'
                    ? plot.setbacks.front
                    : side === 'rear'
                      ? plot.setbacks.rear
                      : side === 'left'
                        ? plot.setbacks.left
                        : plot.setbacks.right;
                return (
                  <div key={i} className="grid grid-cols-[72px_1fr_auto] items-center gap-1.5 text-[11px] text-ink-dim">
                    <span>
                      <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft text-[9px] font-bold text-accent">
                        {i + 1}
                      </span>
                      {side}
                    </span>
                    <LengthField
                      value={override ?? sideDefault}
                      min={0}
                      onCommit={(v) => {
                        pushHistory();
                        const arr = plot.boundary.map((_, j) => plot.edgeSetbacks?.[j] ?? null);
                        arr[i] = v;
                        updatePlot({ edgeSetbacks: arr });
                      }}
                    />
                    <button
                      title="Reset to side default"
                      className={`text-[10px] ${override !== null ? 'text-warn hover:text-ink' : 'text-ink-faint/40'}`}
                      disabled={override === null}
                      onClick={() => {
                        pushHistory();
                        const arr = plot.boundary.map((_, j) => plot.edgeSetbacks?.[j] ?? null);
                        arr[i] = null;
                        updatePlot({ edgeSetbacks: arr });
                      }}
                    >
                      auto
                    </button>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {hasBoundary && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-dim">Buildable area</span>
            <span className={`font-medium tabular-nums ${region || hasOverride ? '' : 'text-danger'}`}>
              {hasOverride
                ? formatArea(polygonArea(plot.buildableOverride!), unit)
                : region
                  ? formatArea(polygonArea(region), unit)
                  : 'setbacks too large'}
            </span>
          </div>
        )}

        {hasBoundary && !hasOverride && region && (
          <Button
            size="sm"
            onClick={() => {
              pushHistory();
              updatePlot({ buildableOverride: region.map((p) => ({ ...p })) });
              setSelection([BUILDABLE_ID]);
            }}
          >
            Customize buildable footprint
          </Button>
        )}
        {hasOverride && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setSelection([BUILDABLE_ID])}>
              Edit footprint
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                pushHistory();
                updatePlot({ buildableOverride: undefined, setbackWaiver: undefined });
              }}
            >
              Reset to auto
            </Button>
          </div>
        )}
        <p className="text-[10px] leading-snug text-ink-faint">
          The dashed green line is the legal envelope from the setbacks. Customizing gives you a
          freely editable footprint validated against it — e.g. a rectangular house inside an
          irregular plot.
        </p>
      </Section>

      <Section title="Orientation">
        <Field label="North angle">
          <NumberField
            value={plot.northAngle}
            format={(v) => `${Math.round(v)}°`}
            parse={parseDeg}
            step={15}
            onCommit={(northAngle) => {
              pushHistory();
              updatePlot({ northAngle });
            }}
          />
        </Field>
        <Field label="Road direction">
          <NumberField
            value={plot.roadDirection}
            format={(v) => `${Math.round(v)}°`}
            parse={parseDeg}
            step={45}
            onCommit={(roadDirection) => {
              pushHistory();
              updatePlot({ roadDirection });
            }}
          />
        </Field>
        <p className="text-[10px] leading-snug text-ink-faint">
          0° = top of screen (north). Road direction decides which setback is the front.
        </p>
      </Section>
    </>
  );
}
