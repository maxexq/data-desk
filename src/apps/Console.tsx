import { Suspense, lazy, memo, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { resultKey, schemaOf, useGame, type RunView } from '../state/game';
import { getTicket } from '../tickets';
import { Grid } from '../ui/Grid';
import { Icon } from '../ui/icons';
import { openApp } from '../ui/open';
import { editor } from './editorHandle';

const SqlEditor = lazy(() => import('./SqlEditor'));

export const Result = memo(function Result({ r }: { r: RunView | undefined }) {
  if (!r)
    return (
      <div className="result-msg th">
        <p className="dim">ผลลัพธ์ของแท็บนี้จะแสดงตรงนี้ กด Run หรือ Ctrl+Enter</p>
      </div>
    );
  if (r.kind === 'error')
    return (
      <div className="result-msg th" role="alert">
        <h4 className="bad">Query error</h4>
        <p>{r.friendly}</p>
        <p className="mono dim">ERROR: {r.raw}</p>
        {r.hint && <p className="mono dim">HINT: {r.hint}</p>}
      </div>
    );
  if (r.kind === 'ok')
    return (
      <div className="result-msg th">
        <h4>OK</h4>
        <p>
          รันสำเร็จ {r.statements} คำสั่ง มีแถวที่ถูกเปลี่ยน {r.affected} แถว เปิดหน้าต่าง Tables เพื่อดูผล
        </p>
      </div>
    );
  if (r.total === 0)
    return (
      <div className="result-msg th">
        <h4>No rows</h4>
        <p>query รันได้ แต่ไม่มีแถวไหนตรงกับเงื่อนไข ลองเช็กตัวสะกดและตัวพิมพ์เล็กใหญ่ของค่าใน WHERE</p>
      </div>
    );
  return <Grid columns={r.columns} values={r.values} />;
});

export function statusOf(r: RunView | undefined): string {
  if (!r) return 'Ready';
  if (r.kind === 'rows') return `${r.total} row${r.total === 1 ? '' : 's'}${r.total > r.values.length ? ` (showing ${r.values.length})` : ''} · ${r.ms} ms`;
  if (r.kind === 'ok') return `OK · ${r.affected} affected · ${r.ms} ms`;
  return 'Error';
}

/** Pages read by the last query, like SQL Server's SET STATISTICS IO: the number that tells a fast query from a slow one. */
function PageMeter({ result, budget }: { result: RunView | undefined; budget?: number }) {
  const stats = result?.kind === 'rows' ? result.pages : undefined;
  const over = budget !== undefined && stats ? stats.pages > budget : false;
  const text = stats ? `${stats.pages.toLocaleString()} page${stats.pages === 1 ? '' : 's'}` : '— pages';
  const title = stats
    ? `อ่านข้อมูล ${stats.pages} page (page ละ 8 KB) · แผน: ${stats.nodes.join(' → ')}`
    : 'จำนวน page ที่ query อ่าน วัดได้เมื่อรัน SELECT คำสั่งเดียว';
  return (
    <span className={`sunken cell mono pages${over ? ' bad' : ''}`} data-testid="pages" title={title}>
      {text}
      {budget !== undefined && <span className="dim">{`\u00a0/ งบ ${budget}`}</span>}
    </span>
  );
}

export const Console = memo(function Console() {
  const ticketId = useGame((s) => s.active);
  const tabs = useGame(useShallow((s) => (s.active ? (s.tabsets[s.active]?.tabs ?? []).map((t) => `${t.id}\u0000${t.title}\u0000${t.file ? 1 : 0}`) : [])));
  const active = useGame((s) => (s.active ? s.tabsets[s.active]?.active : undefined));
  const result = useGame((s) => (s.active && active ? s.results[resultKey(s.active, active)] : undefined));
  const running = useGame((s) => s.running);
  const ready = useGame((s) => s.ready);
  // The current step's page budget, if it has one.
  const budget = useGame((s) => {
    if (!s.active) return undefined;
    const t = getTicket(s.active);
    const p = s.progress[s.active];
    const check = t?.tasks[p?.task ?? 0]?.check;
    return check && check.kind === 'result' && 'maxPages' in check && !p?.done ? check.maxPages : undefined;
  });
  const inTxn = useGame((s) => s.inTxn);
  const history = useGame((s) => s.history);
  const tables = useGame((s) => s.tables);
  const schema = useMemo(() => schemaOf(tables), [tables]);
  const [showHistory, setShowHistory] = useState(false);
  const g = useGame.getState();

  if (!ticketId || !active)
    return (
      <div className="empty th">
        <Icon name="terminal" size={48} />
        <p>ยังไม่ได้เปิด ticket เลือกงานจาก Inbox ก่อน แล้ว SQL Console จะเชื่อมกับฐานข้อมูลของงานนั้น</p>
        <button className="btn raised" onClick={() => openApp('inbox')}>
          <Icon name="inbox" /> เปิด Inbox
        </button>
      </div>
    );

  return (
    <div className="search">
      <div className="tabstrip" role="tablist" aria-label="Query tabs">
        {tabs.map((key) => {
          const [id, title, file] = key.split('\u0000');
          const on = id === active;
          return (
            <div key={id} className={`tab raised${on ? ' on' : ''}${file === '1' ? ' is-file' : ''}`}>
              <button role="tab" aria-selected={on} className="tab-btn" onClick={() => g.setActiveTab(id)}>
                {file === '1' && <Icon name="note" size={14} />} {title}
              </button>
              {file !== '1' && tabs.length > 1 && (
                <button className="tab-x" aria-label={`ปิดแท็บ ${title}`} onClick={() => g.closeTab(id)}>
                  <Icon name="x" size={10} />
                </button>
              )}
            </div>
          );
        })}
        <button className="tab raised tab-add" aria-label="เพิ่มแท็บใหม่" onClick={() => g.addTab()}>
          <Icon name="plus" size={12} />
        </button>
      </div>

      <div className="tabpanel raised">
        <Suspense fallback={<div className="editor sunken dim mono pad">Loading editor…</div>}>
          <SqlEditor
            key={`${ticketId}/${active}`}
            doc={g.tabsets[ticketId]?.tabs.find((t) => t.id === active)?.sql ?? ''}
            onChange={(sql) => useGame.getState().setSql(active, sql)}
            onRun={() => void useGame.getState().run(active)}
            schema={schema}
            handle={editor}
          />
        </Suspense>

        <div className="toolbar">
          <button className="btn raised primary" data-testid="run" disabled={running || !ready} onClick={() => void g.run(active)}>
            <Icon name="play" /> Run
          </button>
          <button className="btn raised" data-testid="format" onClick={() => void editor.format()}>
            <Icon name="wand" /> Format
          </button>
          <button className="btn raised" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
            <Icon name="clock" /> History
          </button>
          <button className="btn raised" onClick={() => openApp('tables')}>
            <Icon name="table" /> Tables
          </button>
          <span className="spacer" />
          <span className="kbd th">Ctrl+Enter รัน · Shift+Alt+F จัดรูปแบบ</span>
        </div>

        {showHistory ? (
          <div className="results sunken">
            <div className="hist">
              {history.length === 0 && <p className="th dim pad">ยังไม่มี query ที่รันไป</p>}
              {history.map((q) => (
                <button
                  key={q}
                  className="hist-item mono"
                  onClick={() => {
                    editor.setDoc(q);
                    setShowHistory(false);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="results sunken sel" data-testid="result" aria-live="polite">
            <Result r={result} />
          </div>
        )}
        <div className="statusbar">
          <span className="sunken cell mono" data-testid="status">{!ready ? 'Loading data…' : running ? 'Running…' : statusOf(result)}</span>
          {inTxn && (
            <span className="sunken cell mono txn" data-testid="txn" title="มี transaction เปิดค้างอยู่ ยังไม่ COMMIT หรือ ROLLBACK">
              TXN OPEN
            </span>
          )}
          <PageMeter result={result} budget={budget} />
          <span className="sunken cell mono">PostgreSQL 18</span>
        </div>
      </div>
    </div>
  );
});
