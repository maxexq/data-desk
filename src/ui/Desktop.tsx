import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { APP_NAME } from '../config';
import { DEPLOY, deployBadge } from '../deploy';
import { CELL, ORIGIN, cellToPoint, layoutIcons, pointToCell, reorder, rowsFor, type Point } from '../lib/deskLayout';
import { usePlayer } from '../music/player';
import { useAccount } from '../state/account';
import { useDesk } from '../state/desk';
import { useMascot } from '../state/mascot';
import { useShelf, useShelfHasNew } from '../state/shelf';
import { totalXp, useGame } from '../state/game';
import { TASKBAR_H, useWM } from '../state/wm';
import { rankOf } from '../tickets';
import { Icon } from './icons';
import { showMenu, type MenuItem } from './menu';
import { justLongPressed } from './touch';
import { openApp } from './open';
import type { AppDef } from './Win';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/** Height and width of the area icons live in (everything above the taskbar). */
function useDesktopSize() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight - TASKBAR_H });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const on = () => setSize(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

/**
 * Desktop icons that behave like Windows: click selects, double-click (or Enter) opens,
 * drag moves. Right-clicking the empty desktop opens the game's menu.
 */
export const DesktopIcons = memo(function DesktopIcons({ apps }: { apps: AppDef[] }) {
  const desk = useDesk();
  const active = useGame((s) => s.active);
  const size = useDesktopSize();
  const [selected, setSelected] = useState<string | null>(null);
  const layer = useRef<HTMLElement>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null);

  const installed = useShelf((s) => s.installed);
  const shelfNew = useShelfHasNew();
  const icons = useMemo(() => apps.filter((a) => a.desktop && (!a.store || (installed as string[]).includes(a.id))), [apps, installed]);
  // Stored order first, then any icon the stored order does not know yet.
  const ids = useMemo(() => {
    const all = icons.map((a) => a.id);
    return [...desk.order.filter((id) => all.includes(id)), ...all.filter((id) => !desk.order.includes(id))];
  }, [icons, desk.order]);

  const rows = rowsFor(size.h);
  const maxCol = Math.max(0, Math.floor((size.w - ORIGIN.x) / CELL.w) - 1);
  const at = useMemo(() => layoutIcons(ids, desk.pos, rows, desk.autoArrange), [ids, desk.pos, rows, desk.autoArrange]);

  // Refresh replays the old "redraw" flicker.
  useEffect(() => {
    if (desk.refreshTick) layer.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'steps(2, jump-none)' });
  }, [desk.refreshTick]);

  const drop = (id: string, p: Point) => {
    const cell = pointToCell(p);
    const col = clamp(cell.col, 0, maxCol);
    const row = clamp(cell.row, 0, rows - 1);
    if (desk.autoArrange) {
      desk.setOrder(reorder(ids, id, col * rows + row));
    } else if (desk.alignGrid) {
      // Dropping on an occupied cell swaps the two icons.
      const target = cellToPoint(col, row);
      const other = ids.find((o) => o !== id && at[o].x === target.x && at[o].y === target.y);
      desk.place({ ...at, [id]: target, ...(other ? { [other]: at[id] } : {}) });
    } else {
      desk.place({ ...at, [id]: { x: clamp(p.x, 0, size.w - CELL.w), y: clamp(p.y, 0, cellToPoint(0, rows - 1).y) } });
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    setSelected(id);
    if (e.button !== 0) return;
    drag.current = { id, sx: e.clientX, sy: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    e.currentTarget.classList.add('dragging');
    e.currentTarget.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    // On a touch screen one tap opens, as on a phone home screen; a mouse still needs a double-click.
    if (d && !d.moved && e.type === 'pointerup' && e.pointerType !== 'mouse' && !justLongPressed()) return openApp(d.id);
    if (!d?.moved) return;
    e.currentTarget.classList.remove('dragging');
    e.currentTarget.style.transform = '';
    if (e.type === 'pointerup') drop(d.id, { x: at[d.id].x + e.clientX - d.sx, y: at[d.id].y + e.clientY - d.sy });
  };

  const byName = () => [...icons].sort((a, b) => a.desktop!.localeCompare(b.desktop!)).map((a) => a.id);
  const desktopMenu = (): MenuItem[] => [
    {
      label: 'Refresh',
      icon: 'reset',
      onSelect: () => {
        desk.refresh();
        void useGame.getState().refreshDb();
      },
    },
    { separator: true },
    { label: 'Sort by name', onSelect: () => desk.arrange(byName()) },
    { label: 'Sort by default order', onSelect: () => desk.arrange(icons.map((a) => a.id)) },
    { label: 'Auto arrange', checked: desk.autoArrange, onSelect: desk.toggleAutoArrange },
    { label: 'Align to grid', checked: desk.alignGrid, disabled: desk.autoArrange, onSelect: desk.toggleAlignGrid },
    { separator: true },
    { label: 'Open Inbox', icon: 'inbox', onSelect: () => openApp('inbox') },
    { label: 'Ask น้องข้าวเหนียว for a hint', icon: 'bulb', disabled: !active, onSelect: () => useMascot.getState().showHints() },
    { label: 'Reset ticket data', icon: 'trash', disabled: !active, onSelect: () => void useGame.getState().resetData() },
    { label: 'Show desktop', icon: 'min', onSelect: () => useWM.getState().minimizeAll() },
    { label: 'Close all windows', icon: 'x', onSelect: () => useWM.getState().closeAll() },
    { separator: true },
    { label: 'Settings', icon: 'gear', onSelect: () => openApp('settings') },
    { label: 'Restart game', icon: 'play', onSelect: () => window.location.reload() },
  ];

  return (
    <nav
      ref={layer}
      className="desk-icons"
      aria-label="Desktop"
      onPointerDown={(e) => e.target === e.currentTarget && setSelected(null)}
      onContextMenu={(e) => showMenu(e, desktopMenu())}
    >
      {icons.map((a) => (
        <button
          key={a.id}
          data-icon={a.id}
          className={`desk-icon${selected === a.id ? ' selected' : ''}`}
          style={{ left: at[a.id].x, top: at[a.id].y }}
          title="Double-click to open"
          onPointerDown={(e) => onPointerDown(e, a.id)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => openApp(a.id)}
          onKeyDown={(e) => e.key === 'Enter' && openApp(a.id)}
          onFocus={() => setSelected(a.id)}
          onContextMenu={(e) => showMenu(e, [{ label: 'Open', icon: a.icon, onSelect: () => openApp(a.id) }])}
        >
          <span className="desk-art">
            <Icon name={a.icon} size={48} />
            {a.id === 'shelf' && shelfNew && <span className="dot" title="มีแผ่นใหม่" data-testid="shelf-new" />}
          </span>
          <span className="desk-label">{a.desktop}</span>
        </button>
      ))}
    </nav>
  );
});

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  return <>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</>;
}

export const Taskbar = memo(function Taskbar({ apps }: { apps: AppDef[] }) {
  const order = useWM((s) => s.order);
  const topId = useWM((s) => s.topId);
  useWM((s) => s.wins);
  const accountStatus = useAccount((s) => s.status);
  const accountUser = useAccount((s) => s.user);
  const account = accountStatus === 'signed-in' || accountStatus === 'signed-out' ? { status: accountStatus, user: accountUser } : null;
  const nowPlaying = usePlayer((s) => (s.status === 'stopped' ? null : s.tracks[s.index]?.title));
  const xp = useGame(totalXp);
  const streak = useGame((s) => s.streak.count);
  return (
    <footer
      className="taskbar raised"
      onContextMenu={(e) =>
        showMenu(e, [
          { label: 'Show desktop', icon: 'min', onSelect: () => useWM.getState().minimizeAll() },
          { label: 'Close all windows', icon: 'x', onSelect: () => useWM.getState().closeAll() },
        ])
      }
    >
      <button className="btn raised start" onClick={() => openApp('inbox')}>
        <Icon name="inbox" size={20} /> <span className="start-label">{APP_NAME}</span>
      </button>
      <div className="tasks">
        {order.map((id) => {
          const a = apps.find((x) => x.id === id);
          if (!a) return null;
          const wm = useWM.getState();
          const w = wm.wins[id];
          const menu: MenuItem[] = [
            w?.min ? { label: 'Restore', icon: 'restore', onSelect: () => wm.open(id, w) } : { label: 'Minimize', icon: 'min', onSelect: () => wm.minimize(id) },
            { label: w?.max ? 'Restore size' : 'Maximize', icon: 'max', onSelect: () => (wm.open(id, w), wm.toggleMax(id)) },
            { separator: true },
            { label: 'Close', icon: 'x', onSelect: () => wm.close(id) },
          ];
          return (
            <button
              key={id}
              data-task={id}
              className={`btn raised task${topId === id ? ' pressed' : ''}`}
              onClick={() => wm.taskClick(id)}
              onContextMenu={(e) => showMenu(e, menu)}
            >
              <Icon name={a.icon} /> <span>{a.title}</span>
            </button>
          );
        })}
      </div>
      <div className="tray sunken mono">
        {account && (
          <button className="tray-account" data-testid="tray-account" title={account.user ? `${account.user.name} · ซิงก์ความคืบหน้าอยู่` : 'เข้าสู่ระบบเพื่อซิงก์ความคืบหน้า'} onClick={() => openApp('account')}>
            {account.user?.avatarUrl ? <img src={account.user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <Icon name="key" />}
            <span>{account.user ? account.user.name : 'Log on'}</span>
          </button>
        )}
        {nowPlaying && (
          <button className="tray-music" data-testid="tray-music" title={`กำลังเล่น: ${nowPlaying}`} onClick={() => openApp('music')}>
            <Icon name="music" /> <span>{nowPlaying}</span>
          </button>
        )}
        {deployBadge() && (
          <span data-testid="env" className={`env-badge env-${DEPLOY.env}`} title={DEPLOY.commit ? `${DEPLOY.branch} @ ${DEPLOY.commit}` : 'local build'}>
            {deployBadge()}
          </span>
        )}
        <span data-testid="rank">{rankOf(xp)}</span>
        <span data-testid="xp">{xp} XP</span>
        <span data-testid="streak" className="tray-opt">
          streak {streak}
        </span>
        <span className="tray-opt">
          <Clock />
        </span>
      </div>
    </footer>
  );
});

export function Toast() {
  const toast = useGame((s) => s.toast);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    setShown(toast.id);
    const t = setTimeout(() => setShown(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || shown !== toast.id) return null;
  return (
    <button className="toast raised th" role="status" onClick={() => (openApp('ticket'), setShown(null))}>
      <Icon name="ticket" size={20} /> {toast.text}
    </button>
  );
}
