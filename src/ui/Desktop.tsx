import { memo, useEffect, useState } from 'react';
import { APP_NAME } from '../config';
import { totalXp, useGame } from '../state/game';
import { useWM } from '../state/wm';
import { rankOf } from '../tickets';
import { Icon } from './icons';
import { openApp } from './open';
import type { AppDef } from './Win';

export const DesktopIcons = memo(function DesktopIcons({ apps }: { apps: AppDef[] }) {
  return (
    <nav className="desk-icons" aria-label="Desktop">
      {apps
        .filter((a) => a.desktop)
        .map((a) => (
          <button key={a.id} className="desk-icon" onClick={() => openApp(a.id)}>
            <span className="desk-art">
              <Icon name={a.icon} size={48} />
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
  const xp = useGame(totalXp);
  const streak = useGame((s) => s.streak.count);
  return (
    <footer className="taskbar raised">
      <button className="btn raised start" onClick={() => openApp('inbox')}>
        <Icon name="inbox" size={20} /> {APP_NAME}
      </button>
      <div className="tasks">
        {order.map((id) => {
          const a = apps.find((x) => x.id === id);
          if (!a) return null;
          return (
            <button key={id} className={`btn raised task${topId === id ? ' pressed' : ''}`} onClick={() => useWM.getState().taskClick(id)}>
              <Icon name={a.icon} /> <span>{a.title}</span>
            </button>
          );
        })}
      </div>
      <div className="tray sunken mono">
        <span>{rankOf(xp)}</span>
        <span>{xp} XP</span>
        <span>streak {streak}</span>
        <span>
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
