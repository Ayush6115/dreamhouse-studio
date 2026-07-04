import type { DesignDocument } from '../types';
import { newId } from '../types';
import { useDesignStore } from './designStore';
import { planSVG } from '../features/export/svg';
import { rasterizeSVG } from '../features/export/raster';

/**
 * Persistence seam, V2: multiple projects in localStorage with an index of
 * metadata (name, updated time, plan thumbnail). A backend later only needs
 * to replace this module — nothing else touches storage.
 */

const LEGACY_KEY = 'dreamhouse-studio:doc:v1';
const INDEX_KEY = 'dreamhouse:projects:v1';
const DOC_KEY = (id: string) => `dreamhouse:project:${id}`;

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  /** Small JPEG data-URL of the floor plan. */
  thumb?: string;
}

const readJSON = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJSON = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded — drop thumbnails to make room, then retry once.
    try {
      const index = readJSON<ProjectMeta[]>(INDEX_KEY) ?? [];
      writeIndex(index.map((m) => ({ ...m, thumb: undefined })));
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — in-memory doc is intact */
    }
  }
};

const writeIndex = (index: ProjectMeta[]): void => {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* non-fatal */
  }
};

export function listProjects(): ProjectMeta[] {
  const index = readJSON<ProjectMeta[]>(INDEX_KEY) ?? [];
  return [...index].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProjectDoc(id: string): DesignDocument | null {
  const doc = readJSON<DesignDocument>(DOC_KEY(id));
  if (!doc || doc.version !== 1 || !Array.isArray(doc.levels)) return null;
  // Forward-migrate fields added after a project was saved.
  for (const level of doc.levels) {
    for (const el of level.elements) {
      if (el.type === 'roof') {
        el.skylights ??= [];
        el.dormers ??= [];
        el.parapetHeight ??= 0;
      }
    }
  }
  return doc;
}

export function saveProjectDoc(doc: DesignDocument): void {
  writeJSON(DOC_KEY(doc.id), doc);
  const index = readJSON<ProjectMeta[]>(INDEX_KEY) ?? [];
  const existing = index.find((m) => m.id === doc.id);
  if (existing) {
    existing.name = doc.name;
    existing.updatedAt = Date.now();
  } else {
    index.push({ id: doc.id, name: doc.name, updatedAt: Date.now() });
  }
  writeIndex(index);
}

export function saveProjectThumb(id: string, thumb: string): void {
  const index = readJSON<ProjectMeta[]>(INDEX_KEY) ?? [];
  const meta = index.find((m) => m.id === id);
  if (meta) {
    meta.thumb = thumb;
    writeIndex(index);
  }
}

export function deleteProject(id: string): void {
  try {
    localStorage.removeItem(DOC_KEY(id));
  } catch {
    /* ignore */
  }
  writeIndex((readJSON<ProjectMeta[]>(INDEX_KEY) ?? []).filter((m) => m.id !== id));
}

export function duplicateProject(id: string): ProjectMeta | null {
  const doc = loadProjectDoc(id);
  if (!doc) return null;
  const copy: DesignDocument = { ...doc, id: newId(), name: `${doc.name} copy` };
  saveProjectDoc(copy);
  return listProjects().find((m) => m.id === copy.id) ?? null;
}

export function renameProject(id: string, name: string): void {
  const doc = loadProjectDoc(id);
  if (doc) {
    doc.name = name;
    saveProjectDoc(doc);
  }
}

/** One-time upgrade of the V1 single-document storage. */
export function migrateLegacy(): void {
  const legacy = readJSON<DesignDocument>(LEGACY_KEY);
  if (!legacy || legacy.version !== 1) return;
  if (!loadProjectDoc(legacy.id)) saveProjectDoc(legacy);
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function loadMostRecent(): DesignDocument | null {
  const [first] = listProjects();
  return first ? loadProjectDoc(first.id) : null;
}

// ------------------------------------------------------------ file transfer

export function downloadDocumentJSON(doc: DesignDocument): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.name.replace(/[^\w-]+/g, '_') || 'design'}.dreamhouse.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importDocumentJSON(file: File): Promise<DesignDocument> {
  return file.text().then((text) => {
    const doc = JSON.parse(text) as DesignDocument;
    if (doc.version !== 1 || !Array.isArray(doc.levels) || !doc.plot) {
      throw new Error('Not a valid DreamHouse Studio file.');
    }
    // Imported files get a fresh id so they never clobber an existing project.
    return { ...doc, id: newId() };
  });
}

// ---------------------------------------------------------------- autosave

const THUMB_INTERVAL = 15_000;
let lastThumbAt = 0;

async function maybeUpdateThumb(doc: DesignDocument): Promise<void> {
  const now = Date.now();
  if (now - lastThumbAt < THUMB_INTERVAL) return;
  lastThumbAt = now;
  try {
    const thumb = await rasterizeSVG(planSVG(doc, doc.levels[0]?.id ?? ''), {
      targetWidth: 360,
      mime: 'image/jpeg',
      quality: 0.72,
    });
    saveProjectThumb(doc.id, thumb);
  } catch {
    /* thumbnails are best-effort */
  }
}

/** Debounced autosave — call once at app startup. */
export function startAutosave(debounceMs = 600): () => void {
  let timer: number | undefined;
  const unsubscribe = useDesignStore.subscribe((state, prev) => {
    if (state.doc === prev.doc) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      saveProjectDoc(state.doc);
      void maybeUpdateThumb(state.doc);
    }, debounceMs);
  });
  return () => {
    window.clearTimeout(timer);
    unsubscribe();
  };
}
