import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApps } from './apps/registry';
import { APP_NAME } from './config';
import { getDb } from './lib/pg';
import { useGame } from './state/game';
import { useWM } from './state/wm';
import { DesktopIcons, Taskbar, Toast } from './ui/Desktop';
import { openApp } from './ui/open';
import { Win } from './ui/Win';

/** Resume the open ticket, or show the inbox when there is none. */
function openDefaults() {
  const { active, openTicket } = useGame.getState();
  if (active) {
    void openTicket(active);
    openApp('console');
    openApp('ticket');
  } else {
    openApp('inbox');
  }
}

export default function App() {
  const [boot, setBoot] = useState<'loading' | 'ready' | string>('loading');
  const crt = useGame((s) => s.crt);
  const justClosed = useGame((s) => s.justClosed);

  const onReset = useCallback(() => {
    useGame.getState().resetAll();
    useWM.getState().closeAll();
    openDefaults();
  }, []);
  const apps = useMemo(() => buildApps(onReset), [onReset]);

  useEffect(() => {
    document.title = APP_NAME;
    getDb().then(
      () => {
        setBoot('ready');
        openDefaults();
      },
      (e) => setBoot(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  useEffect(() => {
    if (justClosed) openApp('closed');
  }, [justClosed]);

  if (boot !== 'ready')
    return (
      <div className="boot mono" role="status">
        {boot === 'loading' ? (
          <>
            <div>{APP_NAME}</div>
            <div className="boot-sub">Starting PostgreSQL…</div>
          </>
        ) : (
          `เปิดฐานข้อมูลไม่สำเร็จ: ${boot}`
        )}
      </div>
    );

  return (
    <div className="desktop">
      <DesktopIcons apps={apps} />
      {apps.map((a) => (
        <Win key={a.id} def={a} />
      ))}
      <Toast />
      <Taskbar apps={apps} />
      {crt && <div className="crt" aria-hidden="true" />}
    </div>
  );
}
