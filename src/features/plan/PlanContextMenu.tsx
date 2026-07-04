import { useEffect } from 'react';
import { Copy, Group, RotateCw, Trash2, ArrowLeftRight } from 'lucide-react';
import { useDesignStore } from '../../store/designStore';
import type { OpeningElement } from '../../types';

const LockIcon = ({ open }: { open?: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    {open ? <path d="M8 11V7a4 4 0 0 1 7.5-2" /> : <path d="M8 11V7a4 4 0 0 1 8 0v4" />}
  </svg>
);

interface Props {
  x: number;
  y: number;
  targetId: string;
  onClose: () => void;
}

/** Right-click menu for plan elements. */
export function PlanContextMenu({ x, y, targetId, onClose }: Props) {
  const level = useDesignStore((s) => s.doc.levels.find((l) => l.id === s.activeLevelId));
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const duplicateElements = useDesignStore((s) => s.duplicateElements);
  const removeElements = useDesignStore((s) => s.removeElements);
  const updateElement = useDesignStore((s) => s.updateElement);
  const groupElements = useDesignStore((s) => s.groupElements);
  const ungroupElements = useDesignStore((s) => s.ungroupElements);
  const lockElements = useDesignStore((s) => s.lockElements);

  const element = level?.elements.find((e) => e.id === targetId);
  const ids = selectedIds.includes(targetId) ? selectedIds : [targetId];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      // Let the menu's own buttons fire first.
      if ((e.target as HTMLElement).closest('[data-context-menu]')) return;
      onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  if (!element) return null;

  if (element.locked) {
    return (
      <div
        data-context-menu
        className="anim-fade-in absolute z-50 w-44 rounded-lg border border-edge bg-surface-2 p-1 shadow-xl"
        style={{ left: x, top: y }}
      >
        <button
          onClick={() => {
            pushHistory();
            lockElements([targetId], false);
            onClose();
          }}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:bg-surface-3"
        >
          <LockIcon open />
          <span className="flex-1">Unlock</span>
        </button>
      </div>
    );
  }

  const rotatable =
    element.type === 'furniture' ||
    element.type === 'column' ||
    element.type === 'staircase' ||
    element.type === 'roof';
  const isDoor = element.type === 'door';

  const item = (label: string, icon: React.ReactNode, action: () => void, shortcut?: string, danger = false) => (
    <button
      key={label}
      onClick={() => {
        action();
        onClose();
      }}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors
        ${danger ? 'text-danger hover:bg-danger/10' : 'text-ink hover:bg-surface-3'}`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-ink-faint">{shortcut}</span>}
    </button>
  );

  return (
    <div
      data-context-menu
      className="anim-fade-in absolute z-50 w-44 rounded-lg border border-edge bg-surface-2 p-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      {item('Duplicate', <Copy size={13} />, () => {
        pushHistory();
        duplicateElements(ids);
      }, 'Ctrl+D')}
      {rotatable &&
        item('Rotate 45°', <RotateCw size={13} />, () => {
          pushHistory();
          for (const id of ids) {
            updateElement(id, (el) => {
              if (
                el.type === 'furniture' ||
                el.type === 'column' ||
                el.type === 'staircase' ||
                el.type === 'roof'
              ) {
                el.transform.rotation += Math.PI / 4;
              }
            });
          }
        }, 'R')}
      {isDoor &&
        item('Flip swing', <ArrowLeftRight size={13} />, () => {
          pushHistory();
          updateElement(targetId, (el) => {
            const o = el as OpeningElement;
            o.swing = (o.swing ?? 1) === 1 ? -1 : 1;
          });
        })}
      {ids.length > 1 &&
        item('Group', <Group size={13} />, () => {
          pushHistory();
          groupElements(ids);
        }, 'Ctrl+G')}
      {element.groupId &&
        item('Ungroup', <Group size={13} />, () => {
          pushHistory();
          ungroupElements(ids);
        }, 'Ctrl+⇧+G')}
      {item('Lock', <LockIcon />, () => {
        pushHistory();
        lockElements(ids, true);
      })}
      <div className="my-1 h-px bg-edge-soft" />
      {item('Delete', <Trash2 size={13} />, () => {
        pushHistory();
        removeElements(ids);
      }, 'Del', true)}
    </div>
  );
}
