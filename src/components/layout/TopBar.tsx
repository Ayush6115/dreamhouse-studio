import { useRef } from 'react';
import { FolderOpen, Layout, Magnet, Moon, Redo2, Ruler, Save, Sparkles, Sun } from 'lucide-react';
import { useDesignStore } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';
import { downloadDocumentJSON, importDocumentJSON } from '../../store/persistence';
import { IconButton } from '../ui/IconButton';
import { Segmented } from '../ui/Segmented';
import { ExportMenu } from '../../features/export/ExportMenu';

export function TopBar() {
  const doc = useDesignStore((s) => s.doc);
  const setDocName = useDesignStore((s) => s.setDocName);
  const setUnitSystem = useDesignStore((s) => s.setUnitSystem);
  const viewMode = useDesignStore((s) => s.viewMode);
  const setViewMode = useDesignStore((s) => s.setViewMode);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const canUndo = useDesignStore((s) => s.past.length > 0);
  const canRedo = useDesignStore((s) => s.future.length > 0);
  const snapEnabled = useDesignStore((s) => s.snapEnabled);
  const setSnapEnabled = useDesignStore((s) => s.setSnapEnabled);
  const showDimensions = useDesignStore((s) => s.showDimensions);
  const setShowDimensions = useDesignStore((s) => s.setShowDimensions);
  const dayNight = useDesignStore((s) => s.dayNight);
  const setDayNight = useDesignStore((s) => s.setDayNight);
  const loadDocument = useDesignStore((s) => s.loadDocument);
  const activeLevelId = useDesignStore((s) => s.activeLevelId);
  const setActiveLevel = useDesignStore((s) => s.setActiveLevel);
  const sunHour = useDesignStore((s) => s.sunHour);
  const setSunHour = useDesignStore((s) => s.setSunHour);
  const showToast = useUiStore((s) => s.showToast);
  const setProjectsOpen = useUiStore((s) => s.setProjectsOpen);
  const renderQuality = useUiStore((s) => s.renderQuality);
  const setRenderQuality = useUiStore((s) => s.setRenderQuality);
  const fileRef = useRef<HTMLInputElement>(null);

  const onOpenFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      loadDocument(await importDocumentJSON(file));
      showToast(`Imported ${file.name} as a new project`);
    } catch {
      showToast('Could not read that file');
    }
  };

  return (
    <header className="app-chrome flex h-12 shrink-0 items-center gap-2 border-b border-edge bg-surface-1 px-3">
      {/* brand */}
      <div className="mr-1 flex items-center gap-2">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 11.5 12 4l9 7.5" stroke="#4f8cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 10.5V20h12v-9.5" stroke="#9aa6b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 20v-5h4v5" stroke="#4f8cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-semibold tracking-tight">DreamHouse Studio</span>
      </div>

      <input
        key={doc.id}
        defaultValue={doc.name}
        onBlur={(e) => setDocName(e.target.value.trim() || 'Untitled Home')}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-8 w-40 rounded-md border border-transparent bg-transparent px-2 text-sm text-ink-dim
          hover:border-edge focus:border-accent focus:text-ink focus:outline-none"
        title="Project name"
      />

      {doc.levels.length > 1 && viewMode !== '3d' && (
        <select
          value={activeLevelId}
          onChange={(e) => setActiveLevel(e.target.value)}
          title="Active floor"
          className="h-8 rounded-md border border-edge bg-surface-2 px-1.5 text-xs text-ink focus:border-accent focus:outline-none"
        >
          {[...doc.levels]
            .sort((a, b) => b.elevation - a.elevation)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      )}

      <div className="mx-1 h-6 w-px bg-edge" />

      <IconButton label="Projects" onClick={() => setProjectsOpen(true)}>
        <Layout size={16} />
      </IconButton>
      <IconButton label="Import (.dreamhouse.json)" onClick={() => fileRef.current?.click()}>
        <FolderOpen size={16} />
      </IconButton>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          void onOpenFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <IconButton label="Save project file (Ctrl+S)" onClick={() => downloadDocumentJSON(doc)}>
        <Save size={16} />
      </IconButton>

      <div className="mx-1 h-6 w-px bg-edge" />

      <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
        <Redo2 size={16} style={{ transform: 'scaleX(-1)' }} />
      </IconButton>
      <IconButton label="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo}>
        <Redo2 size={16} />
      </IconButton>

      <div className="flex-1" />

      <Segmented
        value={viewMode}
        onChange={setViewMode}
        options={[
          { value: 'plan', label: 'Plan', title: 'Floor plan (1)' },
          { value: '3d', label: '3D', title: '3D view (2)' },
          { value: 'elevation', label: 'Elevation', title: 'Façade designer (3)' },
        ]}
      />

      <div className="flex-1" />

      {viewMode === '3d' && (
        <>
          {dayNight === 'day' && (
            <label className="flex items-center gap-1.5 text-[10px] text-ink-faint" title="Sun position (time of day)">
              <span className="tabular-nums">{String(Math.floor(sunHour)).padStart(2, '0')}:{sunHour % 1 ? '30' : '00'}</span>
              <input
                type="range"
                min={6}
                max={18}
                step={0.5}
                value={sunHour}
                onChange={(e) => setSunHour(Number(e.target.value))}
                className="w-24 accent-[#e8a34b]"
              />
            </label>
          )}
          <IconButton
            label={dayNight === 'day' ? 'Switch to night' : 'Switch to day'}
            onClick={() => setDayNight(dayNight === 'day' ? 'night' : 'day')}
          >
            {dayNight === 'day' ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
          <IconButton
            label={renderQuality === 'high' ? 'Quality: High (AO + SMAA) — click for Fast' : 'Quality: Fast — click for High'}
            active={renderQuality === 'high'}
            onClick={() => setRenderQuality(renderQuality === 'high' ? 'fast' : 'high')}
          >
            <Sparkles size={16} />
          </IconButton>
        </>
      )}
      <IconButton label="Toggle snapping" active={snapEnabled} onClick={() => setSnapEnabled(!snapEnabled)}>
        <Magnet size={16} />
      </IconButton>
      <IconButton label="Toggle dimensions" active={showDimensions} onClick={() => setShowDimensions(!showDimensions)}>
        <Ruler size={16} />
      </IconButton>

      <Segmented
        value={doc.unitSystem}
        onChange={setUnitSystem}
        options={[
          { value: 'metric', label: 'm', title: 'Metric' },
          { value: 'imperial', label: 'ft', title: 'Imperial' },
        ]}
      />

      <ExportMenu />
    </header>
  );
}
