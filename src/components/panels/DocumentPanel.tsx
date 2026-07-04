import { Plus, Trash2 } from 'lucide-react';
import { useDesignStore } from '../../store/designStore';
import { useMetrics } from '../../store/calculations';
import { formatArea, formatLength } from '../../geometry/units';
import { Field, Section } from '../ui/Section';
import { LengthField } from './fields';
import { NumberField } from '../ui/NumberField';

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-dim">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}

/** Shown when nothing is selected: project, levels and live calculations. */
export function DocumentPanel() {
  const doc = useDesignStore((s) => s.doc);
  const activeLevelId = useDesignStore((s) => s.activeLevelId);
  const setActiveLevel = useDesignStore((s) => s.setActiveLevel);
  const addLevel = useDesignStore((s) => s.addLevel);
  const addBasement = useDesignStore((s) => s.addBasement);
  const removeLevel = useDesignStore((s) => s.removeLevel);
  const updateLevel = useDesignStore((s) => s.updateLevel);
  const showLevelGhost = useDesignStore((s) => s.showLevelGhost);
  const setShowLevelGhost = useDesignStore((s) => s.setShowLevelGhost);
  const setGridSize = useDesignStore((s) => s.setGridSize);
  const gridSize = useDesignStore((s) => s.gridSize);
  const metrics = useMetrics();
  const unit = doc.unitSystem;

  const activeLevel = doc.levels.find((l) => l.id === activeLevelId);

  return (
    <>
      <Section title="Calculations">
        <MetricRow label="Plot area" value={formatArea(metrics.plotArea, unit)} />
        <MetricRow
          label="Buildable area"
          value={metrics.buildableArea === null ? '—' : formatArea(metrics.buildableArea, unit)}
        />
        <MetricRow label="Built-up area" value={formatArea(metrics.builtUpArea, unit)} />
        <MetricRow label="Carpet area" value={formatArea(metrics.carpetArea, unit)} />
        <MetricRow label="Wall length" value={formatLength(metrics.totalWallLength, unit)} />
        {doc.levels.length > 1 && (
          <MetricRow label="Built-up (all floors)" value={formatArea(metrics.totalBuiltUpArea, unit)} />
        )}
        <p className="mt-1 text-[10px] leading-snug text-ink-faint">
          Built-up = rooms ∪ walls footprint · Carpet = Σ room areas. Values update live with every edit.
        </p>
      </Section>

      <Section title="Levels">
        <div className="flex flex-col gap-1">
          {[...doc.levels].sort((a, b) => b.elevation - a.elevation).map((level) => (
            <div
              key={level.id}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs
                ${level.id === activeLevelId ? 'border-accent bg-accent-soft text-ink' : 'border-edge bg-surface-2 text-ink-dim'}`}
            >
              <button className="flex-1 truncate text-left" onClick={() => setActiveLevel(level.id)}>
                {level.name}
              </button>
              {doc.levels.length > 1 && (
                <button
                  title="Delete level"
                  className="text-ink-faint hover:text-danger"
                  onClick={() => removeLevel(level.id)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-1">
            <button
              onClick={addLevel}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-edge py-1 text-xs text-ink-dim hover:border-accent hover:text-accent"
            >
              <Plus size={13} /> Floor above
            </button>
            <button
              onClick={addBasement}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-edge py-1 text-xs text-ink-dim hover:border-accent hover:text-accent"
            >
              <Plus size={13} /> Basement
            </button>
          </div>
          <label className="mt-1 flex items-center gap-2 text-xs text-ink-dim">
            <input
              type="checkbox"
              checked={showLevelGhost}
              onChange={(e) => setShowLevelGhost(e.target.checked)}
              className="accent-[#4f8cff]"
            />
            Show floor below as underlay
          </label>
          <p className="text-[10px] leading-snug text-ink-faint">
            Staircases span their level's full height and appear as a ghost on the floor above for
            alignment. Rename the top level “Terrace” and use flat roofs with parapets for terraces.
          </p>
        </div>
        {activeLevel && (
          <>
            <Field label="Name">
              <input
                key={activeLevel.id}
                defaultValue={activeLevel.name}
                onBlur={(e) => updateLevel(activeLevel.id, { name: e.target.value.trim() || activeLevel.name })}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="h-7 w-full rounded border border-edge bg-surface-2 px-2 text-xs text-ink focus:border-accent focus:outline-none"
              />
            </Field>
            <Field label="Floor height">
              <LengthField
                value={activeLevel.height}
                min={2.2}
                max={6}
                onCommit={(height) => updateLevel(activeLevel.id, { height })}
              />
            </Field>
            <Field label="Elevation">
              <LengthField
                value={activeLevel.elevation}
                onCommit={(elevation) => updateLevel(activeLevel.id, { elevation })}
              />
            </Field>
          </>
        )}
      </Section>

      <Section title="Canvas">
        <Field label="Grid size">
          <NumberField
            value={gridSize}
            onCommit={setGridSize}
            min={0.05}
            max={5}
            step={0.05}
            format={(v) => `${v} m`}
            parse={(t) => {
              const v = Number.parseFloat(t);
              return Number.isNaN(v) ? null : v;
            }}
          />
        </Field>
        <p className="text-[10px] leading-snug text-ink-faint">
          Draw the plot with the Plot tool, then walls. Select anything to edit it here.
        </p>
      </Section>
    </>
  );
}
