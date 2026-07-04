import { useDesignStore } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';
import { useMetrics } from '../../store/calculations';
import { formatArea, formatLength } from '../../geometry/units';

const TOOL_HINTS: Record<string, string> = {
  select: 'Click to select · drag to move · Shift-click adds · R rotates · Del deletes',
  plot: 'Click to place vertices · type a length (e.g. 36.4ft) to lock it · right-click undoes · Enter closes',
  wall: 'Click to chain segments · type a length to lock it · right-click undoes · Enter/Esc ends',
  door: 'Hover a wall and click to place the door',
  window: 'Hover a wall and click to place the window',
  column: 'Click to place a column',
  beam: 'Click the two beam endpoints',
  staircase: 'Click to place a staircase · R rotates after selecting',
  room: 'Trace the room corners · click the first vertex (or Enter) to close',
  roof: 'Click two corners of the roof footprint · edit style, pitch and skylights after placing',
  furniture: 'Pick an item in the Library, then click to place it',
  note: 'Click anywhere to place a text note · edit the wording in the panel',
  measure: 'Click two points to measure · Esc clears',
  'facade-item': 'Pick a façade component, then click to place it',
};

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-ink-faint">{label}</span>
      <span className="font-medium tabular-nums text-ink-dim">{value}</span>
    </span>
  );
}

export function StatusBar() {
  const tool = useDesignStore((s) => s.tool);
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const viewMode = useDesignStore((s) => s.viewMode);
  const cursor = useUiStore((s) => s.cursorWorld);
  const zoom = useUiStore((s) => s.zoom);
  const metrics = useMetrics();

  return (
    <footer className="app-chrome flex h-8 shrink-0 items-center gap-4 overflow-hidden border-t border-edge bg-surface-1 px-3 text-[11px]">
      <span className="hidden truncate text-ink-faint md:inline">
        {viewMode === '3d' ? 'Drag to orbit · scroll to zoom · right-drag to pan' : (TOOL_HINTS[tool] ?? '')}
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-3 overflow-hidden sm:gap-4">
        <span className="hidden sm:contents">
          <Chip label="Plot" value={formatArea(metrics.plotArea, unit)} />
          <Chip
            label="Buildable"
            value={metrics.buildableArea === null ? '—' : formatArea(metrics.buildableArea, unit)}
          />
        </span>
        <Chip label="Built-up" value={formatArea(metrics.builtUpArea, unit)} />
        <Chip label="Carpet" value={formatArea(metrics.carpetArea, unit)} />
        <span className="hidden sm:contents">
          <Chip label="Walls" value={formatLength(metrics.totalWallLength, unit)} />
        </span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3 tabular-nums text-ink-faint">
        {cursor && viewMode === 'plan' && (
          <span>
            {formatLength(cursor.x, unit)}, {formatLength(cursor.y, unit)}
          </span>
        )}
        <span>{Math.round((zoom / 50) * 100)}%</span>
      </div>
    </footer>
  );
}
