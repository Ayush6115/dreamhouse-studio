import { useCallback, useEffect, useState } from 'react';
import { Copy, FilePlus2, Pencil, Trash2, X } from 'lucide-react';
import { useDesignStore } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';
import {
  deleteProject,
  duplicateProject,
  listProjects,
  loadProjectDoc,
  renameProject,
  saveProjectDoc,
  type ProjectMeta,
} from '../../store/persistence';

/** Project manager: open, create, rename, duplicate and delete projects. */
export function ProjectsDialog() {
  const open = useUiStore((s) => s.projectsOpen);
  const setOpen = useUiStore((s) => s.setProjectsOpen);
  const showToast = useUiStore((s) => s.showToast);
  const activeId = useDesignStore((s) => s.doc.id);
  const loadDocument = useDesignStore((s) => s.loadDocument);
  const newDocument = useDesignStore((s) => s.newDocument);
  const setDocName = useDesignStore((s) => s.setDocName);

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const refresh = useCallback(() => setProjects(listProjects()), []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, setOpen]);

  if (!open) return null;

  const openProject = (id: string) => {
    if (id === activeId) return setOpen(false);
    // Make sure the current project is saved before switching.
    saveProjectDoc(useDesignStore.getState().doc);
    const doc = loadProjectDoc(id);
    if (!doc) return showToast('Could not open that project');
    loadDocument(doc);
    setOpen(false);
  };

  const fmtDate = (t: number) => {
    const d = new Date(t);
    const today = new Date();
    return d.toDateString() === today.toDateString()
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString();
  };

  return (
    <div
      className="anim-fade-in absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="anim-scale-in flex max-h-[80%] w-[680px] max-w-[92%] flex-col rounded-xl border border-edge bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-edge-soft px-4 py-3">
          <h2 className="text-sm font-semibold">Projects</h2>
          <button className="text-ink-faint transition-colors hover:text-ink" onClick={() => setOpen(false)} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
          {/* new project */}
          <button
            onClick={() => {
              saveProjectDoc(useDesignStore.getState().doc);
              newDocument();
              setOpen(false);
              showToast('New project created');
            }}
            className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-edge text-ink-dim transition-colors hover:border-accent hover:text-accent"
          >
            <FilePlus2 size={20} />
            <span className="text-xs font-medium">New project</span>
          </button>

          {projects.map((p) => (
            <div
              key={p.id}
              className={`group relative flex flex-col overflow-hidden rounded-lg border transition-colors
                ${p.id === activeId ? 'border-accent' : 'border-edge hover:border-ink-faint'}`}
            >
              <button className="block h-24 w-full overflow-hidden bg-[#f4f2ec]" onClick={() => openProject(p.id)}>
                {p.thumb ? (
                  <img src={p.thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-[#a09a8a]">no preview yet</span>
                )}
              </button>
              <div className="flex items-center gap-1 border-t border-edge-soft bg-surface-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  {renaming === p.id ? (
                    <input
                      autoFocus
                      defaultValue={p.name}
                      onBlur={(e) => {
                        const name = e.target.value.trim() || p.name;
                        renameProject(p.id, name);
                        if (p.id === activeId) setDocName(name);
                        setRenaming(null);
                        refresh();
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      className="h-6 w-full rounded border border-accent bg-surface-1 px-1 text-[11px] text-ink focus:outline-none"
                    />
                  ) : (
                    <button className="block w-full truncate text-left text-[11px] font-medium text-ink" onClick={() => openProject(p.id)}>
                      {p.name}
                      {p.id === activeId && <span className="ml-1 text-[9px] text-accent">· open</span>}
                    </button>
                  )}
                  <div className="text-[9px] text-ink-faint">{fmtDate(p.updatedAt)}</div>
                </div>
                <button title="Rename" className="text-ink-faint hover:text-ink" onClick={() => setRenaming(p.id)}>
                  <Pencil size={12} />
                </button>
                <button
                  title="Duplicate"
                  className="text-ink-faint hover:text-ink"
                  onClick={() => {
                    duplicateProject(p.id);
                    refresh();
                  }}
                >
                  <Copy size={12} />
                </button>
                <button
                  title="Delete"
                  className="text-ink-faint hover:text-danger"
                  onClick={() => {
                    if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
                    deleteProject(p.id);
                    if (p.id === activeId) {
                      const next = listProjects().find((m) => m.id !== p.id);
                      const doc = next && loadProjectDoc(next.id);
                      if (doc) loadDocument(doc);
                      else newDocument();
                    }
                    refresh();
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="border-t border-edge-soft px-4 py-2 text-[10px] text-ink-faint">
          Projects live in your browser. Use the Save button for a portable .dreamhouse.json file.
        </p>
      </div>
    </div>
  );
}
