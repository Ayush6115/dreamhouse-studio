import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useDesignStore } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';
import {
  export3DPNG,
  exportElevationPNG,
  exportElevationSVG,
  exportGLB,
  exportPDFReport,
  exportPlanPNG,
  exportPlanSVG,
} from './exporters';

/** Export dropdown: plan (SVG/PNG), elevation (SVG/PNG), 3D snapshot, PDF report. */
export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const SILENT = 'silent-export-abort';
  const run = (fn: () => void | Promise<void>, doneMsg: string) => async () => {
    setOpen(false);
    setBusy(true);
    try {
      await fn();
      showToast(doneMsg);
    } catch (e) {
      if ((e as Error)?.message !== SILENT) {
        console.error('[export] failed:', e);
        showToast('Export failed — see console');
      }
    } finally {
      setBusy(false);
    }
  };

  const quality = useUiStore((s) => s.exportQuality);
  const setQuality = useUiStore((s) => s.setExportQuality);

  const items: { label: string; hint?: string; onClick: () => void }[] = [
    {
      label: 'Floor plan · SVG',
      hint: 'vector — infinite quality',
      onClick: run(() => {
        const s = useDesignStore.getState();
        exportPlanSVG(s.doc, s.activeLevelId);
      }, 'Plan SVG exported'),
    },
    {
      label: 'Floor plan · PNG',
      hint: quality,
      onClick: run(() => {
        const s = useDesignStore.getState();
        return exportPlanPNG(s.doc, s.activeLevelId, quality);
      }, 'Plan PNG exported'),
    },
    {
      label: 'Elevation · SVG',
      hint: 'vector — infinite quality',
      onClick: run(() => {
        const s = useDesignStore.getState();
        exportElevationSVG(s.doc, s.activeFacadeId);
      }, 'Elevation SVG exported'),
    },
    {
      label: 'Elevation · PNG',
      hint: quality,
      onClick: run(() => {
        const s = useDesignStore.getState();
        return exportElevationPNG(s.doc, s.activeFacadeId, quality);
      }, 'Elevation PNG exported'),
    },
    {
      label: '3D render · PNG',
      hint: 'from 3D view',
      onClick: run(() => {
        const s = useDesignStore.getState();
        if (!export3DPNG(s.doc)) {
          throw new Error('no snapshot');
        }
      }, '3D snapshot exported'),
    },
    {
      label: '3D model · GLB',
      hint: 'needs 3D view open',
      onClick: run(async () => {
        const s = useDesignStore.getState();
        if (!(await exportGLB(s.doc))) {
          showToast('Open the 3D view first, then export the GLB');
          throw new Error(SILENT);
        }
      }, 'GLB model exported'),
    },
    {
      label: 'PDF report',
      hint: `all sheets · ${quality}`,
      onClick: run(() => {
        const s = useDesignStore.getState();
        return exportPDFReport(s.doc, s.activeLevelId, s.activeFacadeId, quality);
      }, 'PDF report exported'),
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        title="Export"
        onClick={() => setOpen(!open)}
        disabled={busy}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors
          ${open ? 'bg-accent-soft text-accent' : 'bg-accent-strong text-white hover:bg-accent'}
          disabled:opacity-50`}
      >
        <Download size={15} />
        {busy ? 'Exporting…' : 'Export'}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-lg border border-edge bg-surface-2 p-1 shadow-xl">
          {/* raster quality */}
          <div className="flex items-center gap-1 border-b border-edge-soft px-2 pb-1.5 pt-1">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
              Quality
            </span>
            {(
              [
                ['draft', '1×'],
                ['standard', '2×'],
                ['high', '3×'],
                ['ultra', '5×'],
              ] as const
            ).map(([q, label]) => (
              <button
                key={q}
                title={`${q} — ${label} resolution${q === 'ultra' ? ' (best possible; large files, slower)' : ''}`}
                onClick={() => setQuality(q)}
                className={`h-6 flex-1 rounded text-[10px] font-medium capitalize transition-colors
                  ${quality === q ? 'bg-accent-soft text-accent' : 'text-ink-dim hover:bg-surface-3 hover:text-ink'}`}
              >
                {q}
              </button>
            ))}
          </div>
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs text-ink hover:bg-surface-3"
            >
              <span>{item.label}</span>
              {item.hint && <span className="text-[10px] text-ink-faint">{item.hint}</span>}
            </button>
          ))}
          <p className="px-2.5 py-1.5 text-[10px] leading-snug text-ink-faint">
            Quality scales PNG/PDF sheet resolution (SVG is always infinite). 3D snapshots use the 3D
            tab's screen resolution.
          </p>
        </div>
      )}
    </div>
  );
}
