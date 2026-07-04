import { PLOT_ID, useDesignStore } from '../../store/designStore';
import { polygonArea } from '../../geometry/polygon';
import { buildableRegion, polygonDifference, polygonIntersection } from '../../geometry/setbacks';
import { formatArea } from '../../geometry/units';
import { Button } from '../ui/Button';
import { Section } from '../ui/Section';

/** Shown while the hand-edited buildable footprint is selected. */
export function BuildablePanel() {
  const plot = useDesignStore((s) => s.doc.plot);
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const updatePlot = useDesignStore((s) => s.updatePlot);
  const setSelection = useDesignStore((s) => s.setSelection);

  const override = plot.buildableOverride;
  if (!override || override.length < 3) return null;

  const auto = buildableRegion(plot.boundary, plot.roadDirection, plot.setbacks, plot.edgeSetbacks);
  const outsidePlot = polygonDifference(override, plot.boundary);
  const intrusion = auto
    ? polygonDifference(override, auto).flatMap((part) => polygonIntersection(part, plot.boundary))
    : [];
  const sum = (parts: { x: number; y: number }[][]) => parts.reduce((s, p) => s + polygonArea(p), 0);

  return (
    <>
      <Section title="Buildable footprint">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-dim">Area</span>
          <span className="font-medium tabular-nums">{formatArea(polygonArea(override), unit)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-dim">Vertices</span>
          <span className="font-medium tabular-nums">{override.length}</span>
        </div>

        {outsidePlot.length > 0 && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1.5 text-[11px] leading-snug text-danger">
            {formatArea(sum(outsidePlot), unit)} extends OUTSIDE the plot (red) — pull those
            vertices back in.
          </p>
        )}
        {intrusion.length > 0 && !plot.setbackWaiver && (
          <div className="rounded-md border border-warn/40 bg-warn/10 px-2 py-1.5">
            <p className="text-[11px] leading-snug text-warn">
              {formatArea(sum(intrusion), unit)} intrudes into the minimum setbacks (amber) — check
              your local regulations.
            </p>
            <button
              onClick={() => {
                pushHistory();
                updatePlot({ setbackWaiver: true });
              }}
              className="mt-1.5 h-6 rounded border border-warn/50 bg-warn/15 px-2 text-[11px] font-medium text-warn transition-colors hover:bg-warn/25"
            >
              Accept intrusion
            </button>
          </div>
        )}
        {intrusion.length > 0 && plot.setbackWaiver && (
          <p className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-[11px] leading-snug text-ink-dim">
            <span>Setback intrusion accepted ({formatArea(sum(intrusion), unit)}).</span>
            <button
              onClick={() => {
                pushHistory();
                updatePlot({ setbackWaiver: undefined });
              }}
              className="ml-2 shrink-0 text-[10px] text-accent hover:underline"
            >
              Re-check
            </button>
          </p>
        )}
        {outsidePlot.length === 0 && intrusion.length === 0 && (
          <p className="rounded-md border border-ok/40 bg-ok/10 px-2 py-1.5 text-[11px] leading-snug text-ok">
            Footprint is inside the plot and respects all setbacks.
          </p>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={() => setSelection([PLOT_ID])}>
            Back to plot
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              pushHistory();
              updatePlot({ buildableOverride: undefined, setbackWaiver: undefined });
              setSelection([PLOT_ID]);
            }}
          >
            Reset to auto
          </Button>
        </div>
        <p className="text-[10px] leading-snug text-ink-faint">
          Drag vertices to reshape (they snap to the grid and plot corners) · double-click an edge to
          add a vertex · right-click a vertex to delete it · drag the outline to move the whole
          footprint.
        </p>
      </Section>
    </>
  );
}
