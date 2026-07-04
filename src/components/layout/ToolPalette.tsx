import type { ReactNode } from 'react';
import {
  Armchair,
  BrickWall,
  Columns2,
  DoorOpen,
  Grid2x2,
  LandPlot,
  Minus,
  MousePointer2,
  Square,
} from 'lucide-react';
import { useDesignStore, type ToolId } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';
import { IconButton } from '../ui/IconButton';

const StairsIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20h4v-4h4v-4h4V8h4V4" />
  </svg>
);

const RoofIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 13 12 4l10 9" />
    <path d="M5 10.5V13m14-2.5V13" />
    <path d="M8 20h8" opacity="0.5" />
  </svg>
);

const TextIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 5h14M12 5v14" />
  </svg>
);

const MeasureIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m4 20 16-16" />
    <path d="m6.5 17.5 1.5 1.5m1-4 1.5 1.5m1-4 1.5 1.5m1-4L14 11m1-4 1.5 1.5" />
  </svg>
);

interface ToolDef {
  id: ToolId;
  label: string;
  icon: ReactNode;
}

const PLAN_TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select / Move (V)', icon: <MousePointer2 size={16} /> },
  { id: 'plot', label: 'Plot boundary (P)', icon: <LandPlot size={16} /> },
  { id: 'wall', label: 'Wall (W)', icon: <BrickWall size={16} /> },
  { id: 'door', label: 'Door (D)', icon: <DoorOpen size={16} /> },
  { id: 'window', label: 'Window (N)', icon: <Grid2x2 size={16} /> },
  { id: 'column', label: 'Column (C)', icon: <Columns2 size={16} /> },
  { id: 'beam', label: 'Beam (B)', icon: <Minus size={16} /> },
  { id: 'staircase', label: 'Staircase (S)', icon: StairsIcon },
  { id: 'room', label: 'Room tag (M)', icon: <Square size={16} /> },
  { id: 'roof', label: 'Roof (O)', icon: RoofIcon },
  { id: 'furniture', label: 'Interior library (F)', icon: <Armchair size={16} /> },
  { id: 'note', label: 'Text note (T)', icon: TextIcon },
  { id: 'measure', label: 'Measure (L)', icon: MeasureIcon },
];

export function ToolPalette() {
  const tool = useDesignStore((s) => s.tool);
  const setTool = useDesignStore((s) => s.setTool);
  const viewMode = useDesignStore((s) => s.viewMode);
  const libraryOpen = useUiStore((s) => s.libraryOpen);
  const setLibraryOpen = useUiStore((s) => s.setLibraryOpen);

  if (viewMode === '3d') {
    return (
      <nav className="app-chrome flex w-12 shrink-0 flex-col items-center gap-1 border-r border-edge bg-surface-1 py-2" />
    );
  }

  if (viewMode === 'elevation') {
    return (
      <nav className="app-chrome flex w-12 shrink-0 flex-col items-center gap-1 border-r border-edge bg-surface-1 py-2">
        <IconButton label="Select / Move (V)" active={tool === 'select'} onClick={() => setTool('select')}>
          <MousePointer2 size={16} />
        </IconButton>
        <IconButton
          label="Façade library (F)"
          active={tool === 'facade-item' || libraryOpen}
          onClick={() => {
            setTool('facade-item');
            setLibraryOpen(!libraryOpen);
          }}
        >
          <Armchair size={16} />
        </IconButton>
      </nav>
    );
  }

  return (
    <nav className="app-chrome flex w-12 shrink-0 flex-col items-center gap-1 border-r border-edge bg-surface-1 py-2">
      {PLAN_TOOLS.map((t) => (
        <IconButton
          key={t.id}
          label={t.label}
          active={tool === t.id || (t.id === 'furniture' && libraryOpen && tool === 'furniture')}
          onClick={() => {
            setTool(t.id);
            if (t.id === 'furniture') setLibraryOpen(true);
            else setLibraryOpen(false);
          }}
        >
          {t.icon}
        </IconButton>
      ))}
    </nav>
  );
}
