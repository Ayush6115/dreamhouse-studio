import { useCallback, useEffect, useRef, useState } from 'react';
import { Aperture } from 'lucide-react';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { exportRegistry } from '../export/registry';
import { downloadDataURL } from '../export/exporters';
import { useDesignStore } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';

/**
 * Progressive GPU path tracer over the live 3D scene. Physically-based light
 * transport (real GI, soft shadows, glass) converges in the viewport over
 * ~30–60 s; the result can be saved as a PNG at any point. Quality sits well
 * above the realtime view, though below offline studio renders.
 */

type Phase = 'idle' | 'building' | 'rendering' | 'done';

const TARGETS = [
  { label: 'Draft', samples: 120 },
  { label: 'Standard', samples: 350 },
  { label: 'Fine', samples: 800 },
] as const;

export function PhotorealRender() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [samples, setSamples] = useState(0);
  const [target, setTarget] = useState<number>(350);
  const [showTargets, setShowTargets] = useState(false);
  const tracer = useRef<WebGLPathTracer | null>(null);
  const raf = useRef(0);
  const showToast = useUiStore((s) => s.showToast);
  const docName = useDesignStore((s) => s.doc.name);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    tracer.current?.dispose();
    tracer.current = null;
    exportRegistry.three?.setFrameloop('always');
    setPhase('idle');
    setSamples(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = (sampleTarget: number) => {
    const three = exportRegistry.three;
    const scene = exportRegistry.scene3d;
    if (!three || !scene) {
      showToast('3D view is not ready yet');
      return;
    }
    setTarget(sampleTarget);
    setShowTargets(false);
    setPhase('building');
    // Freeze the realtime loop so the path tracer owns the canvas.
    three.setFrameloop('never');

    // Let the "preparing" state paint before the (blocking) BVH build.
    setTimeout(() => {
      try {
        const pt = new WebGLPathTracer(three.gl);
        // MIS off keeps the megashader small enough for ANGLE/D3D shader
        // compilers to build in reasonable time on Windows.
        pt.multipleImportanceSampling = false;
        pt.bounces = 8;
        pt.transmissiveBounces = 10;
        pt.filterGlossyFactor = 0.5;
        pt.tiles.set(2, 2);
        pt.setScene(scene, three.camera);
        tracer.current = pt;
        setPhase('rendering');
        let wasCompiling = true;
        const loop = () => {
          const t = tracer.current;
          if (!t) return;
          if (t.samples >= sampleTarget) {
            setSamples(Math.floor(t.samples));
            setPhase('done');
            return;
          }
          t.renderSample();
          // The path-tracing megashader compiles in the driver during the
          // first frames — surface that state instead of a stuck counter.
          const compiling = (t as unknown as { isCompiling: boolean }).isCompiling;
          if (compiling !== wasCompiling) {
            wasCompiling = compiling;
            setPhase(compiling ? 'building' : 'rendering');
          }
          setSamples(Math.floor(t.samples));
          raf.current = requestAnimationFrame(loop);
        };
        raf.current = requestAnimationFrame(loop);
      } catch (e) {
        console.error('[photoreal] path tracer failed:', e);
        showToast('Photoreal render failed on this device — see console');
        cleanup();
      }
    }, 50);
  };

  const save = () => {
    const canvas = exportRegistry.glCanvas;
    if (canvas) {
      try {
        downloadDataURL(
          canvas.toDataURL('image/png'),
          `${docName.replace(/[^\w-]+/g, '_') || 'design'}_photoreal.png`,
        );
        showToast('Photoreal render saved');
      } catch {
        showToast('Could not read the canvas');
      }
    }
    cleanup();
  };

  if (phase === 'idle') {
    return (
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1.5">
        {showTargets && (
          <div className="anim-fade-in flex flex-col gap-1 rounded-lg border border-edge bg-surface-2 p-1 shadow-xl">
            {TARGETS.map((t) => (
              <button
                key={t.label}
                onClick={() => start(t.samples)}
                className="flex items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-left text-xs text-ink hover:bg-surface-3"
              >
                <span>{t.label}</span>
                <span className="text-[10px] text-ink-faint">{t.samples} samples</span>
              </button>
            ))}
            <p className="max-w-48 px-2.5 py-1 text-[10px] leading-snug text-ink-faint">
              Physically-based render of the current view. More samples = cleaner image, longer
              wait.
            </p>
          </div>
        )}
        <button
          onClick={() => setShowTargets((v) => !v)}
          title="Photoreal render (path traced)"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-edge bg-surface-2/90 px-3 text-sm font-medium text-ink shadow-lg backdrop-blur hover:bg-surface-3"
        >
          <Aperture size={15} />
          <span className="hidden sm:inline">Photoreal</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-10 w-64 rounded-lg border border-edge bg-surface-2/95 p-3 shadow-xl backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">
          {phase === 'building' ? 'Compiling renderer…' : phase === 'done' ? 'Render complete' : 'Path tracing…'}
        </span>
        <span className="text-[10px] tabular-nums text-ink-faint">
          {phase === 'building' ? '' : `${samples} / ${target}`}
        </span>
      </div>
      <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${phase === 'building' ? 4 : Math.min(100, (samples / target) * 100)}%` }}
        />
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={save}
          disabled={phase === 'building' || samples === 0}
          className="h-8 flex-1 rounded-md bg-accent-strong text-xs font-medium text-white hover:bg-accent disabled:opacity-40"
        >
          {phase === 'done' ? 'Save PNG' : 'Stop & save'}
        </button>
        <button
          onClick={cleanup}
          className="h-8 flex-1 rounded-md border border-edge text-xs font-medium text-ink-dim hover:bg-surface-3 hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {phase === 'building' && (
        <p className="mt-2 text-[10px] leading-snug text-ink-faint">
          First render on a device can take a minute or two while the GPU shader compiles.
          Subsequent renders start much faster.
        </p>
      )}
      {phase === 'rendering' && (
        <p className="mt-2 text-[10px] leading-snug text-ink-faint">
          The viewport refines in place. You can stop early — the image is usable once the noise
          settles.
        </p>
      )}
    </div>
  );
}
