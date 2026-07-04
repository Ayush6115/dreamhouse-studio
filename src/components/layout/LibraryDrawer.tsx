import { useMemo, useState, type ReactNode } from 'react';
import {
  Armchair,
  Bath,
  BedDouble,
  Box,
  Columns2,
  CookingPot,
  DoorOpen,
  Fence,
  Flower2,
  Grid2x2,
  Lamp,
  Layers,
  Refrigerator,
  Search,
  ShowerHead,
  Sofa,
  Sparkles,
  Star,
  Table2,
  Trees,
  Tv,
  WashingMachine,
  X,
} from 'lucide-react';
import { useDesignStore } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';
import { CATALOG, CATALOG_CATEGORIES, type CatalogItem } from '../../library/catalog';
import { FACADE_CATALOG, FACADE_CATEGORIES, type FacadeCatalogItem } from '../../library/facadeCatalog';
import { formatLength } from '../../geometry/units';

/**
 * Component store: searchable, with favorites and recently-used sections.
 * Shows the interior catalog in plan view, the façade catalog in elevation.
 */

const SYMBOL_ICONS: Record<string, ReactNode> = {
  bed: <BedDouble size={22} />,
  sofa: <Sofa size={22} />,
  'sofa-l': <Sofa size={22} />,
  armchair: <Armchair size={22} />,
  'table-rect': <Table2 size={22} />,
  'table-round': <Table2 size={22} />,
  chair: <Armchair size={22} />,
  wardrobe: <Box size={22} />,
  dresser: <Box size={22} />,
  'tv-unit': <Tv size={22} />,
  bookshelf: <Layers size={22} />,
  counter: <Table2 size={22} />,
  island: <Table2 size={22} />,
  fridge: <Refrigerator size={22} />,
  stove: <CookingPot size={22} />,
  sink: <ShowerHead size={22} />,
  toilet: <Bath size={22} />,
  washbasin: <Bath size={22} />,
  shower: <ShowerHead size={22} />,
  bathtub: <Bath size={22} />,
  'washing-machine': <WashingMachine size={22} />,
  plant: <Flower2 size={22} />,
  rug: <Layers size={22} />,
  'floor-patch': <Layers size={22} />,
  'lamp-floor': <Lamp size={22} />,
  'lamp-ceiling': <Lamp size={22} />,
  'ceiling-panel': <Layers size={22} />,
  box: <Box size={22} />,
  // façade symbols
  'window-4pane': <Grid2x2 size={22} />,
  'window-tall': <Grid2x2 size={22} />,
  'window-arch': <Grid2x2 size={22} />,
  'window-round': <Grid2x2 size={22} />,
  'door-panel': <DoorOpen size={22} />,
  'door-double': <DoorOpen size={22} />,
  railing: <Fence size={22} />,
  gate: <Fence size={22} />,
  cladding: <Layers size={22} />,
  tiles: <Grid2x2 size={22} />,
  panel: <Layers size={22} />,
  pergola: <Columns2 size={22} />,
  sconce: <Lamp size={22} />,
  column: <Columns2 size={22} />,
  parapet: <Layers size={22} />,
  awning: <Layers size={22} />,
  solar: <Sparkles size={22} />,
  tree: <Trees size={22} />,
  shrub: <Trees size={22} />,
};

type AnyItem = CatalogItem | FacadeCatalogItem;

const FAVORITES = '★ Favorites';
const RECENT = 'Recent';

export function LibraryDrawer() {
  const viewMode = useDesignStore((s) => s.viewMode);
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const setTool = useDesignStore((s) => s.setTool);
  const open = useUiStore((s) => s.libraryOpen);
  const setOpen = useUiStore((s) => s.setLibraryOpen);
  const activeCatalogId = useUiStore((s) => s.activeCatalogId);
  const setActiveCatalogId = useUiStore((s) => s.setActiveCatalogId);
  const favorites = useUiStore((s) => s.favorites);
  const recents = useUiStore((s) => s.recents);
  const toggleFavorite = useUiStore((s) => s.toggleFavorite);

  const isElevation = viewMode === 'elevation';
  const all: AnyItem[] = isElevation ? FACADE_CATALOG : CATALOG;
  const baseCategories = isElevation ? FACADE_CATEGORIES : CATALOG_CATEGORIES;

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = [...baseCategories];
    const ids = new Set(all.map((i) => i.id));
    if (recents.some((r) => ids.has(r))) cats.unshift(RECENT);
    if (favorites.some((f) => ids.has(f))) cats.unshift(FAVORITES);
    return cats;
  }, [baseCategories, all, favorites, recents]);

  const activeCategory = category && categories.includes(category) ? category : categories[0];

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return all.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    if (activeCategory === FAVORITES) return all.filter((i) => favorites.includes(i.id));
    if (activeCategory === RECENT)
      return recents.map((id) => all.find((i) => i.id === id)).filter((i): i is AnyItem => !!i);
    return all.filter((i) => i.category === activeCategory);
  }, [all, query, activeCategory, favorites, recents]);

  if (!open || viewMode === '3d') return null;

  return (
    <div className="app-chrome anim-slide-in-left flex w-72 shrink-0 flex-col border-r border-edge bg-surface-1">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-edge-soft px-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          {isElevation ? 'Façade Store' : 'Interior Store'}
        </span>
        <button className="text-ink-faint transition-colors hover:text-ink" onClick={() => setOpen(false)} aria-label="Close library">
          <X size={15} />
        </button>
      </div>

      {/* search */}
      <div className="border-b border-edge-soft p-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${all.length} components…`}
            className="h-8 w-full rounded-md border border-edge bg-surface-2 pl-8 pr-7 text-xs text-ink
              placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* categories */}
      {!query && (
        <div className="flex shrink-0 flex-wrap gap-1 border-b border-edge-soft p-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors
                ${c === activeCategory ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-dim hover:text-ink'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* items */}
      <div className="grid flex-1 auto-rows-min grid-cols-2 content-start gap-2 overflow-y-auto p-2">
        {items.length === 0 && (
          <p className="col-span-2 px-2 py-6 text-center text-xs text-ink-faint">
            {query ? `Nothing matches “${query}”.` : 'Star components to collect them here.'}
          </p>
        )}
        {items.map((item) => {
          const active = activeCatalogId === item.id;
          const fav = favorites.includes(item.id);
          const production = 'glb' in item && item.glb;
          const secondDim = isElevation ? (item as FacadeCatalogItem).height : (item as CatalogItem).depth;
          return (
            <div
              key={item.id}
              className={`group relative flex flex-col items-center gap-1 rounded-lg border p-2 pt-3 text-center transition-all
                ${active ? 'border-accent bg-accent-soft shadow-[0_0_0_1px_var(--color-accent)]' : 'border-edge bg-surface-2 hover:border-ink-faint'}`}
            >
              <button
                title={fav ? 'Remove from favorites' : 'Add to favorites'}
                onClick={() => toggleFavorite(item.id)}
                className={`absolute right-1.5 top-1.5 transition-colors ${fav ? 'text-warn' : 'text-ink-faint opacity-0 group-hover:opacity-100 hover:text-warn'}`}
              >
                <Star size={13} fill={fav ? 'currentColor' : 'none'} />
              </button>
              {production && (
                <span className="absolute left-1.5 top-1.5 rounded bg-ok/15 px-1 text-[9px] font-semibold text-ok" title="Production 3D model (CC0)">
                  3D
                </span>
              )}
              <button
                className="flex w-full flex-col items-center gap-1"
                onClick={() => {
                  setActiveCatalogId(item.id);
                  setTool(isElevation ? 'facade-item' : 'furniture');
                }}
                title={`${item.name} — click, then click the canvas to place`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-md ${active ? 'text-accent' : 'text-ink-dim'}`}>
                  {SYMBOL_ICONS[item.symbol] ?? <Box size={22} />}
                </span>
                <span className="text-[11px] leading-tight text-ink">{item.name}</span>
                <span className="text-[10px] tabular-nums text-ink-faint">
                  {formatLength(item.width, unit)} × {formatLength(secondDim, unit)}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <p className="shrink-0 border-t border-edge-soft p-2 text-[10px] leading-snug text-ink-faint">
        Items marked <span className="font-semibold text-ok">3D</span> use production CC0 models; others are
        parametric. Everything stays editable after placing.
      </p>
    </div>
  );
}
