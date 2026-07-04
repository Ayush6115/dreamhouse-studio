import { BUILDABLE_ID, PLOT_ID, useDesignStore } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';
import type { Element } from '../../types';
import { Button } from '../ui/Button';
import { DocumentPanel } from '../panels/DocumentPanel';
import { FacadePanel } from '../panels/FacadePanel';
import { PlotPanel } from '../panels/PlotPanel';
import { BuildablePanel } from '../panels/BuildablePanel';
import { ItemPanel, OpeningPanel, RoomPanel, WallPanel } from '../panels/ElementPanels';
import { FacadeItemPanel } from '../panels/FacadeItemPanel';
import { RoofPanel } from '../panels/RoofPanel';
import { NotePanel } from '../panels/NotePanel';
import { AlignPanel } from '../panels/AlignPanel';

/** Right-hand panel: reflects the current selection (or the document). */
export function PropertiesPanel() {
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const doc = useDesignStore((s) => s.doc);
  const viewMode = useDesignStore((s) => s.viewMode);
  const activeLevelId = useDesignStore((s) => s.activeLevelId);
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const removeElements = useDesignStore((s) => s.removeElements);
  const mobileOpen = useUiStore((s) => s.mobilePanelOpen);
  const setMobileOpen = useUiStore((s) => s.setMobilePanelOpen);

  const level = doc.levels.find((l) => l.id === activeLevelId);
  const findElement = (id: string): Element | undefined =>
    level?.elements.find((e) => e.id === id) ??
    doc.facades.flatMap((f) => f.elements).find((e) => e.id === id);

  let body: React.ReactNode;

  if (selectedIds.length === 0) {
    body = viewMode === 'elevation' ? <FacadePanel /> : <DocumentPanel />;
  } else if (selectedIds.length === 1 && selectedIds[0] === PLOT_ID) {
    body = <PlotPanel />;
  } else if (selectedIds.length === 1 && selectedIds[0] === BUILDABLE_ID) {
    body = <BuildablePanel />;
  } else if (selectedIds.length === 1) {
    const el = findElement(selectedIds[0]);
    if (!el) {
      body = <DocumentPanel />;
    } else {
      switch (el.type) {
        case 'wall':
          body = <WallPanel wall={el} />;
          break;
        case 'door':
        case 'window':
          body = <OpeningPanel opening={el} />;
          break;
        case 'room':
          body = <RoomPanel room={el} />;
          break;
        case 'roof':
          body = <RoofPanel roof={el} />;
          break;
        case 'note':
          body = <NotePanel note={el} />;
          break;
        case 'facade-element':
          body = <FacadeItemPanel item={el} />;
          break;
        default:
          body = <ItemPanel item={el} />;
      }
    }
  } else {
    body = (
      <>
        <div className="px-3 py-3 text-xs text-ink-dim">
          <p className="mb-2">{selectedIds.length} elements selected.</p>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              pushHistory();
              removeElements(selectedIds);
            }}
          >
            Delete all
          </Button>
        </div>
        <AlignPanel ids={selectedIds} />
      </>
    );
  }

  const showDelete =
    selectedIds.length === 1 && selectedIds[0] !== PLOT_ID && findElement(selectedIds[0]) !== undefined;

  return (
    <aside
      className={`app-chrome w-72 shrink-0 flex-col overflow-y-auto border-l border-edge bg-surface-1
        ${mobileOpen ? 'fixed inset-y-0 right-0 z-40 flex shadow-2xl' : 'hidden'} lg:static lg:z-auto lg:flex lg:shadow-none`}
    >
      {/* mobile-only close */}
      <button
        onClick={() => setMobileOpen(false)}
        className="flex h-9 shrink-0 items-center justify-center gap-1 border-b border-edge-soft text-xs text-ink-dim lg:hidden"
      >
        Close panel
      </button>
      {body}
      {showDelete && (
        <div className="px-3 py-3">
          <Button
            size="sm"
            variant="danger"
            className="w-full"
            onClick={() => {
              pushHistory();
              removeElements(selectedIds);
            }}
          >
            Delete element
          </Button>
        </div>
      )}
    </aside>
  );
}
