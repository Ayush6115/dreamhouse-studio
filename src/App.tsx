import { useEffect, useRef } from 'react';
import { BUILDABLE_ID, PLOT_ID, useDesignStore, type ToolId } from './store/designStore';
import { useUiStore } from './store/uiStore';
import { downloadDocumentJSON } from './store/persistence';
import { loadImportedCatalog } from './library/catalog';
import { TopBar } from './components/layout/TopBar';
import { ToolPalette } from './components/layout/ToolPalette';
import { LibraryDrawer } from './components/layout/LibraryDrawer';
import { ProjectsDialog } from './components/layout/ProjectsDialog';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { StatusBar } from './components/layout/StatusBar';
import { PlanCanvas } from './features/plan/PlanCanvas';
import { Scene3D } from './features/viewer3d/Scene3D';
import { ElevationCanvas } from './features/elevation/ElevationCanvas';

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  p: 'plot',
  w: 'wall',
  d: 'door',
  n: 'window',
  c: 'column',
  b: 'beam',
  s: 'staircase',
  m: 'room',
  o: 'roof',
  f: 'furniture',
  t: 'note',
  l: 'measure',
};

function useGlobalHotkeys() {
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const setTool = useDesignStore((s) => s.setTool);
  const setViewMode = useDesignStore((s) => s.setViewMode);
  const setLibraryOpen = useUiStore((s) => s.setLibraryOpen);
  const lastNudgeAt = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      // WASD/R/F belong to the walkthrough while it is active.
      if (useUiStore.getState().navMode === 'walk' && useDesignStore.getState().viewMode === '3d') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        downloadDocumentJSON(useDesignStore.getState().doc);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const { selectedIds, pushHistory, duplicateElements } = useDesignStore.getState();
        const ids = selectedIds.filter((id) => !id.startsWith('@'));
        if (ids.length > 0) {
          pushHistory();
          duplicateElements(ids);
        }
        return;
      }
      if (e.key.startsWith('Arrow')) {
        const { selectedIds, viewMode, gridSize, pushHistory, nudgeElements } = useDesignStore.getState();
        if (selectedIds.length === 0 || viewMode === '3d') return;
        e.preventDefault();
        const step = e.shiftKey ? 0.05 : gridSize;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        // One undo entry per burst of nudges, not per keypress.
        if (Date.now() - lastNudgeAt.current > 700) pushHistory();
        lastNudgeAt.current = Date.now();
        nudgeElements(selectedIds, dx, dy);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedIds, doc, pushHistory, removeElements, setPlotBoundary, updatePlot, setSelection } =
          useDesignStore.getState();
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const lockedIds = new Set(
          doc.levels.flatMap((l) => l.elements.filter((el) => el.locked).map((el) => el.id)),
        );
        pushHistory();
        if (selectedIds.includes(PLOT_ID)) setPlotBoundary([]);
        if (selectedIds.includes(BUILDABLE_ID)) {
          updatePlot({ buildableOverride: undefined, setbackWaiver: undefined });
        }
        removeElements(selectedIds.filter((id) => !id.startsWith('@') && !lockedIds.has(id)));
        setSelection([]);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const { selectedIds, pushHistory, groupElements, ungroupElements } = useDesignStore.getState();
        const ids = selectedIds.filter((id) => id !== PLOT_ID);
        if (ids.length === 0) return;
        pushHistory();
        if (e.shiftKey) ungroupElements(ids);
        else if (ids.length > 1) groupElements(ids);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        // CAD convention: Esc always returns to the Select tool.
        if (useDesignStore.getState().tool !== 'select') {
          setTool('select');
          useUiStore.getState().setActiveCatalogId(null);
        }
        return;
      }
      // While a drawing tool is active in the plan, digits belong to the
      // typed-length input — not to view switching.
      const { tool: activeTool, viewMode: vm } = useDesignStore.getState();
      const drawingActive =
        vm === 'plan' && ['plot', 'room', 'wall', 'beam', 'roof', 'measure'].includes(activeTool);
      if (drawingActive && /^[0-9.]$/.test(e.key)) return;
      if (e.key === '1') setViewMode('plan');
      else if (e.key === '2') setViewMode('3d');
      else if (e.key === '3') setViewMode('elevation');
      else {
        const tool = TOOL_KEYS[e.key.toLowerCase()];
        if (tool) {
          const viewMode = useDesignStore.getState().viewMode;
          if (viewMode === '3d') return;
          if (viewMode === 'elevation') {
            if (tool === 'select') setTool('select');
            if (tool === 'furniture') {
              setTool('facade-item');
              setLibraryOpen(true);
            }
            return;
          }
          setTool(tool);
          setLibraryOpen(tool === 'furniture');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, setTool, setViewMode, setLibraryOpen]);
}

function Toast() {
  const toast = useUiStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none absolute bottom-12 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-surface-3 px-4 py-2 text-xs text-ink shadow-lg">
      {toast}
    </div>
  );
}

export default function App() {
  useGlobalHotkeys();
  const viewMode = useDesignStore((s) => s.viewMode);
  const bumpCatalogVersion = useUiStore((s) => s.bumpCatalogVersion);

  // Merge user-imported assets (scripts/import-assets.mjs) into the library.
  useEffect(() => {
    void loadImportedCatalog().then((added) => {
      if (added > 0) bumpCatalogVersion();
    });
  }, [bumpCatalogVersion]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        <ToolPalette />
        <LibraryDrawer />
        <main className="min-w-0 flex-1">
          {viewMode === 'plan' && <PlanCanvas />}
          {viewMode === '3d' && <Scene3D />}
          {viewMode === 'elevation' && <ElevationCanvas />}
        </main>
        <PropertiesPanel />
        <Toast />
        <ProjectsDialog />
        <MobilePanelToggle />
      </div>
      <StatusBar />
    </div>
  );
}

/** Small-screen button that opens the properties panel as an overlay. */
function MobilePanelToggle() {
  const open = useUiStore((s) => s.mobilePanelOpen);
  const setOpen = useUiStore((s) => s.setMobilePanelOpen);
  const selectedCount = useDesignStore((s) => s.selectedIds.length);
  if (open) return null;
  return (
    <button
      onClick={() => setOpen(true)}
      aria-label="Open properties panel"
      className="absolute bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full
        bg-accent-strong text-white shadow-xl transition-colors hover:bg-accent lg:hidden"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M15 3v18" />
      </svg>
      {selectedCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warn px-1 text-[9px] font-bold text-black">
          {selectedCount}
        </span>
      )}
    </button>
  );
}
