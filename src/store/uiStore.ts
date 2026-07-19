import { create } from 'zustand';
import type { Point } from '../types';

/**
 * Ephemeral UI state that is NOT part of the design document, plus small
 * user preferences (favorites/recents) persisted separately from projects.
 */

const FAV_KEY = 'dreamhouse:favorites:v1';
const RECENT_KEY = 'dreamhouse:recents:v1';

const loadList = (key: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const saveList = (key: string, list: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* non-fatal */
  }
};

interface UiState {
  cursorWorld: Point | null;
  zoom: number; // pixels per meter
  toast: string | null;
  /** Catalog item armed for placement (interior library / façade library). */
  activeCatalogId: string | null;
  libraryOpen: boolean;
  projectsOpen: boolean;
  favorites: string[];
  recents: string[];
  /** 3D render quality: 'high' = AO + SMAA post-processing, 'fast' = raw. */
  renderQuality: 'high' | 'fast';
  setRenderQuality: (q: 'high' | 'fast') => void;
  /** 3D navigation: orbit camera or first-person walkthrough. */
  navMode: 'orbit' | 'walk';
  setNavMode: (m: 'orbit' | 'walk') => void;
  /** Dollhouse cutaway: active level only, walls cut low, studio backdrop. */
  cutaway: boolean;
  setCutaway: (v: boolean) => void;
  /** Bumped when imported assets merge into the catalog (re-renders library). */
  catalogVersion: number;
  bumpCatalogVersion: () => void;
  /** Multi-selected plot vertex indices (plot edit mode). */
  selectedPlotVertices: number[];
  setSelectedPlotVertices: (v: number[]) => void;
  /** Raster resolution for exports (persisted). */
  exportQuality: 'draft' | 'standard' | 'high' | 'ultra';
  setExportQuality: (q: 'draft' | 'standard' | 'high' | 'ultra') => void;
  /** Drawing style for plan/elevation sheets (persisted). */
  exportStyle: 'presentation' | 'working';
  setExportStyle: (s: 'presentation' | 'working') => void;
  /** Properties panel visibility on small screens (overlay mode). */
  mobilePanelOpen: boolean;
  setMobilePanelOpen: (open: boolean) => void;
  setCursorWorld: (p: Point | null) => void;
  setZoom: (z: number) => void;
  showToast: (message: string) => void;
  setActiveCatalogId: (id: string | null) => void;
  setLibraryOpen: (open: boolean) => void;
  setProjectsOpen: (open: boolean) => void;
  toggleFavorite: (id: string) => void;
  pushRecent: (id: string) => void;
}

let toastTimer: number | undefined;

export const useUiStore = create<UiState>()((set, get) => ({
  cursorWorld: null,
  zoom: 50,
  toast: null,
  activeCatalogId: null,
  libraryOpen: false,
  projectsOpen: false,
  favorites: loadList(FAV_KEY),
  recents: loadList(RECENT_KEY),
  renderQuality: 'high',
  setRenderQuality: (renderQuality) => set({ renderQuality }),
  navMode: 'orbit',
  setNavMode: (navMode) => set({ navMode }),
  cutaway: false,
  setCutaway: (cutaway) => set({ cutaway }),
  catalogVersion: 0,
  bumpCatalogVersion: () => set((s) => ({ catalogVersion: s.catalogVersion + 1 })),
  selectedPlotVertices: [],
  setSelectedPlotVertices: (selectedPlotVertices) => set({ selectedPlotVertices }),
  mobilePanelOpen: false,
  setMobilePanelOpen: (mobilePanelOpen) => set({ mobilePanelOpen }),
  exportQuality: (() => {
    try {
      const v = localStorage.getItem('dreamhouse:export-quality');
      return v === 'draft' || v === 'standard' || v === 'high' || v === 'ultra' ? v : 'high';
    } catch {
      return 'high';
    }
  })(),
  setExportQuality: (exportQuality) => {
    try {
      localStorage.setItem('dreamhouse:export-quality', exportQuality);
    } catch {
      /* non-fatal */
    }
    set({ exportQuality });
  },
  exportStyle: (() => {
    try {
      const v = localStorage.getItem('dreamhouse:export-style');
      return v === 'working' ? v : 'presentation';
    } catch {
      return 'presentation';
    }
  })(),
  setExportStyle: (exportStyle) => {
    try {
      localStorage.setItem('dreamhouse:export-style', exportStyle);
    } catch {
      /* non-fatal */
    }
    set({ exportStyle });
  },
  setCursorWorld: (cursorWorld) => set({ cursorWorld }),
  setZoom: (zoom) => set({ zoom }),
  setActiveCatalogId: (activeCatalogId) => set({ activeCatalogId }),
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
  setProjectsOpen: (projectsOpen) => set({ projectsOpen }),
  toggleFavorite: (id) => {
    const cur = get().favorites;
    const favorites = cur.includes(id) ? cur.filter((f) => f !== id) : [...cur, id];
    saveList(FAV_KEY, favorites);
    set({ favorites });
  },
  pushRecent: (id) => {
    const recents = [id, ...get().recents.filter((r) => r !== id)].slice(0, 12);
    saveList(RECENT_KEY, recents);
    set({ recents });
  },
  showToast: (message) => {
    set({ toast: message });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => set({ toast: null }), 2600);
  },
}));
