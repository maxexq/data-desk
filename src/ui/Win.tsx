import { memo, useRef, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { TASKBAR_H, useWM } from '../state/wm';
import { Icon, type IconName } from './icons';
import { showMenu, wantsNativeMenu, type MenuItem } from './menu';

export interface AppDef {
  id: string;
  title: string;
  icon: IconName;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  desktop?: string; // label when shown as a desktop icon
  render: () => ReactNode;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Track a pointer drag; `onMove` gets the delta, `onEnd` the final delta. */
function drag(e: RPointerEvent, onMove: (dx: number, dy: number) => void, onEnd: (dx: number, dy: number) => void) {
  e.preventDefault();
  const sx = e.clientX;
  const sy = e.clientY;
  let dx = 0;
  let dy = 0;
  const move = (ev: PointerEvent) => {
    dx = ev.clientX - sx;
    dy = ev.clientY - sy;
    onMove(dx, dy);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    onEnd(dx, dy);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

export const Win = memo(function Win({ def }: { def: AppDef }) {
  const s = useWM((st) => st.wins[def.id]);
  const isTop = useWM((st) => st.topId === def.id);
  const ref = useRef<HTMLElement>(null);
  if (!s || !s.open || s.min) return null;

  const wm = useWM.getState();
  const minW = def.minW ?? 260;
  const minH = def.minH ?? 160;

  const startMove = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || s.max) return;
    const el = ref.current!;
    // Move with a transform while dragging (no React work), commit once on release.
    const lim = (dx: number, dy: number) =>
      [
        clamp(s.x + dx, 48 - s.w, window.innerWidth - 48) - s.x,
        clamp(s.y + dy, 0, window.innerHeight - TASKBAR_H - 30) - s.y,
      ] as const;
    drag(
      e,
      (dx, dy) => {
        const [x, y] = lim(dx, dy);
        el.style.transform = `translate(${x}px,${y}px)`;
      },
      (dx, dy) => {
        const [x, y] = lim(dx, dy);
        el.style.transform = '';
        if (x || y) wm.place(def.id, { x: s.x + x, y: s.y + y });
      },
    );
  };

  const startResize = (e: RPointerEvent) => {
    const el = ref.current!;
    const size = (dx: number, dy: number) =>
      [
        clamp(s.w + dx, minW, window.innerWidth - s.x),
        clamp(s.h + dy, minH, window.innerHeight - TASKBAR_H - s.y),
      ] as const;
    drag(
      e,
      (dx, dy) => {
        const [w, h] = size(dx, dy);
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      },
      (dx, dy) => {
        const [w, h] = size(dx, dy);
        wm.place(def.id, { w, h });
      },
    );
  };

  const menu: MenuItem[] = [
    { label: s.max ? 'Restore' : 'Maximize', icon: s.max ? 'restore' : 'max', onSelect: () => wm.toggleMax(def.id) },
    { label: 'Minimize', icon: 'min', onSelect: () => wm.minimize(def.id) },
    { separator: true },
    { label: 'Close', icon: 'x', onSelect: () => wm.close(def.id) },
  ];

  const style = s.max
    ? { left: 0, top: 0, width: '100%', height: `calc(100% - ${TASKBAR_H}px)`, zIndex: s.z }
    : { left: s.x, top: s.y, width: s.w, height: s.h, zIndex: s.z };

  return (
    <section
      ref={ref}
      className={`win raised${isTop ? ' is-top' : ''}`}
      style={style}
      aria-label={def.title}
      onPointerDownCapture={() => wm.focus(def.id)}
      onContextMenu={(e) => !wantsNativeMenu(e.target) && showMenu(e, menu)}
    >
      <header className="win-title" onPointerDown={startMove} onDoubleClick={() => wm.toggleMax(def.id)}>
        <Icon name={def.icon} />
        <span className="win-name">{def.title}</span>
        <button className="ctl raised" aria-label={`ย่อ ${def.title}`} onClick={() => wm.minimize(def.id)}>
          <Icon name="min" size={12} />
        </button>
        <button
          className="ctl raised"
          aria-label={s.max ? `คืนขนาด ${def.title}` : `ขยาย ${def.title}`}
          onClick={() => wm.toggleMax(def.id)}
        >
          <Icon name={s.max ? 'restore' : 'max'} size={12} />
        </button>
        <button className="ctl raised" aria-label={`ปิด ${def.title}`} onClick={() => wm.close(def.id)}>
          <Icon name="x" size={12} />
        </button>
      </header>
      <div className="win-body">{def.render()}</div>
      {!s.max && <div className="grip" onPointerDown={startResize} aria-hidden="true" />}
    </section>
  );
});
