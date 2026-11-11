import { memo, useEffect, useRef, useState } from 'react';
import { useGame } from '../../state/game';
import { SHELF, useAvailable, useShelf, type ShelfApp } from '../../state/shelf';
import { useWM } from '../../state/wm';
import { Icon } from '../../ui/icons';
import { openApp } from '../../ui/open';

const STEP_MS = 650; // per file; a 3-disk install takes about 3 seconds

/** "Setup is copying files…", one disk at a time, the way software arrived in 1997. */
function Installer({ app, onDone }: { app: ShelfApp; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const total = app.files.length;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (step >= total) {
      const t = setTimeout(() => done.current(), 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, total]);
  const disk = Math.min(app.disks, Math.floor((step / total) * app.disks) + 1);
  const pct = Math.round((step / total) * 100);
  return (
    <div className="setup-backdrop">
      <div className="setup raised" role="dialog" aria-label={`Installing ${app.title}`} data-testid="installer">
        <div className="win-title">
          <Icon name="floppy" />
          <span className="win-name">{app.title} Setup</span>
        </div>
        <div className="setup-body">
          <div className="setup-disk" style={{ ['--disk' as string]: app.disk }}>
            <Icon name="floppy" size={48} />
          </div>
          <div className="th">
            <p>
              กรุณาใส่แผ่นที่{' '}
              <b>
                {disk} of {app.disks}
              </b>
            </p>
            <p className="mono dim">Copying {app.files[Math.min(step, total - 1)]}…</p>
          </div>
        </div>
        <div className="meter sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="meter-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export const Shelf = memo(function Shelf() {
  const available = useAvailable();
  const installed = useShelf((s) => s.installed);
  const [installing, setInstalling] = useState<ShelfApp | null>(null);

  // Opening the shelf counts as having seen what is on it (clears the blinking dot).
  const availableKey = [...available].join();
  useEffect(() => {
    useShelf.getState().markSeen([...available]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableKey]);

  const finish = (app: ShelfApp) => {
    useShelf.getState().install(app.id);
    setInstalling(null);
    useGame.getState().say(`ติดตั้ง ${app.title} แล้ว ดับเบิลคลิกไอคอนบนเดสก์ท็อปเพื่อเปิด`);
  };

  return (
    <div className="shelf">
      <header className="shelf-head th">
        <Icon name="shelf" size={32} />
        <div>
          <b>Shareware Shelf</b>
          <div className="dim">แผ่นโปรแกรมจากแผนก IT ปิด ticket ให้ครบเงื่อนไขแล้วเอาไปติดตั้งได้เลย</div>
        </div>
      </header>
      <ul className="shelf-list sunken" aria-label="Apps">
        {SHELF.map((app) => {
          const open = available.has(app.id);
          const has = installed.includes(app.id);
          return (
            <li key={app.id} className={`shelf-item${open ? '' : ' locked'}`} data-shelf={app.id} data-state={has ? 'installed' : open ? 'available' : 'locked'}>
              <div className="shelf-disk" style={{ ['--disk' as string]: open ? app.disk : '#c9c5d6' }}>
                <Icon name={open ? app.icon : 'lock'} size={32} />
              </div>
              <div className="shelf-text th">
                <div className="shelf-title">
                  <b>{app.title}</b>{' '}
                  <span className="mono dim">
                    {app.disks} disk{app.disks > 1 ? 's' : ''} · {(app.kb / 1024).toFixed(1)} MB
                  </span>
                </div>
                <p>{app.blurb}</p>
                <p className="dim">{open ? app.why : `ล็อกอยู่: ${app.unlockText}`}</p>
              </div>
              <div className="shelf-actions">
                {has ? (
                  <>
                    <button className="btn raised primary" onClick={() => openApp(app.id)}>
                      <Icon name="play" /> Open
                    </button>
                    <button
                      className="btn raised"
                      onClick={() => {
                        useWM.getState().close(app.id);
                        useShelf.getState().uninstall(app.id);
                      }}
                    >
                      <Icon name="trash" /> Uninstall
                    </button>
                  </>
                ) : (
                  <button className="btn raised" disabled={!open || !!installing} onClick={() => setInstalling(app)}>
                    <Icon name="floppy" /> Install
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {installing && <Installer app={installing} onDone={() => finish(installing)} />}
    </div>
  );
});
