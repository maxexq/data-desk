import { memo, useCallback, useEffect, useState } from 'react';
import { SnapshotError, deleteSnapshot, listSnapshots, readDump, restoreSnapshot, takeSnapshot, type SnapshotMeta } from '../../lib/snapshot';
import { getTicket } from '../../tickets';
import { useGame, withDb } from '../../state/game';
import { Icon } from '../../ui/icons';
import { openApp } from '../../ui/open';
import { SqlCode } from '../../ui/SqlCode';

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short', hour12: false });

export const Snapshot = memo(function Snapshot() {
  const active = useGame((s) => s.active);
  const ready = useGame((s) => s.ready);
  const inTxn = useGame((s) => s.inTxn);
  const ticket = active ? getTicket(active) : undefined;
  const [list, setList] = useState<SnapshotMeta[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [view, setView] = useState<{ meta: SnapshotMeta; sql: string } | null>(null);

  const reload = useCallback(async () => setList(await listSnapshots()), []);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!ticket)
    return (
      <div className="empty th">
        <Icon name="camera" size={48} />
        <p>Snapshot เซฟ workspace ของ ticket ที่เปิดอยู่ เลือกงานจาก Inbox ก่อน</p>
        <button className="btn raised" onClick={() => openApp('inbox')}>
          <Icon name="inbox" /> เปิด Inbox
        </button>
      </div>
    );

  const mine = list.filter((s) => s.ticketId === ticket.id);

  const act = async (label: string, fn: () => Promise<unknown>, refresh = false) => {
    setBusy(label);
    setError(null);
    try {
      await withDb(fn, { refresh });
      await reload();
    } catch (e) {
      setError(e instanceof SnapshotError ? e.message : `ผิดพลาด: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    act('Saving…', async () => {
      await takeSnapshot(ticket.id, name || `${ticket.no} #${mine.length + 1}`);
      setName('');
      useGame.getState().say('ถ่าย snapshot แล้ว');
    });

  if (view)
    return (
      <div className="snap">
        <div className="toolbar">
          <button className="btn raised" onClick={() => setView(null)}>
            <Icon name="x" /> ปิดไฟล์
          </button>
          <span className="mono">{view.meta.name}.sql</span>
          <span className="spacer" />
          <span className="kbd th">ไฟล์นี้คือสิ่งที่ pg_dump เขียนออกมาจริง เอาไปรันใน PostgreSQL ที่ไหนก็ได้</span>
        </div>
        <div className="snap-dump sel" data-testid="snapshot-dump">
          <SqlCode code={view.sql} />
        </div>
      </div>
    );

  return (
    <div className="snap">
      <div className="snap-take raised">
        <div className="th">
          <b>{ticket.no}</b> {ticket.title}
        </div>
        <div className="snap-row">
          <input
            className="field sunken"
            aria-label="ชื่อ snapshot"
            placeholder={`${ticket.no} #${mine.length + 1}`}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !inTxn && !busy && void save()}
          />
          <button className="btn raised primary" data-testid="snapshot-save" disabled={!ready || inTxn || !!busy} onClick={() => void save()}>
            <Icon name="camera" /> Take snapshot
          </button>
        </div>
        {inTxn && <p className="th bad">มี transaction เปิดค้างอยู่ COMMIT หรือ ROLLBACK ก่อน เพราะ pg_dump เห็นเฉพาะข้อมูลที่ COMMIT แล้ว</p>}
        {error && (
          <p className="th bad" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="snap-list sunken" data-testid="snapshot-list">
        {mine.length === 0 && <p className="th dim pad">ยังไม่มี snapshot ของงานนี้ ลองถ่ายไว้ก่อนแก้อะไรใหญ่ๆ แบบที่คนทำงานจริง backup ก่อน migrate</p>}
        {mine.map((s) => (
          <div key={s.id} className="snap-item" data-snapshot={s.name}>
            <Icon name="floppy" size={32} />
            <div className="snap-meta">
              <b className="th">{s.name}</b>
              <span className="mono dim">
                {when(s.at)} · {s.tables} table{s.tables === 1 ? '' : 's'} · {kb(s.bytes)}
              </span>
            </div>
            {confirm === s.id ? (
              <div className="snap-confirm th">
                <span>แทนที่ workspace ตอนนี้?</span>
                <button
                  className="btn raised primary"
                  onClick={() => {
                    setConfirm(null);
                    void act('Restoring…', async () => {
                      await restoreSnapshot(s.id);
                      useGame.getState().say(`ย้อน workspace กลับไปที่ "${s.name}" แล้ว`);
                    }, true);
                  }}
                >
                  Restore
                </button>
                <button className="btn raised" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="snap-actions">
                <button className="btn raised" disabled={!!busy} onClick={() => setConfirm(s.id)}>
                  <Icon name="reset" /> Restore
                </button>
                <button
                  className="btn raised"
                  onClick={async () => {
                    const sql = await readDump(s.id);
                    if (sql) setView({ meta: s, sql });
                  }}
                >
                  <Icon name="note" /> View .sql
                </button>
                <button className="btn raised" aria-label={`ลบ ${s.name}`} disabled={!!busy} onClick={() => void act('Deleting…', () => deleteSnapshot(s.id))}>
                  <Icon name="trash" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="statusbar">
        <span className="sunken cell mono" data-testid="snapshot-status">
          {busy ?? `${mine.length} snapshot${mine.length === 1 ? '' : 's'}`}
        </span>
        <span className="sunken cell mono">pg_dump --schema=ws</span>
        <span className="sunken cell th">เก็บในเบราว์เซอร์นี้</span>
      </div>
    </div>
  );
});
