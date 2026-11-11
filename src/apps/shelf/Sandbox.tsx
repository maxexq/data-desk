import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { inTransaction } from '../../lib/pg';
import { DATASETS, openSandbox, sandboxDataset, sandboxExec, type Dataset } from '../../lib/sandbox';
import { toView, type RunView } from '../../state/game';
import { useShelf } from '../../state/shelf';
import { Icon } from '../../ui/icons';
import { openApp } from '../../ui/open';
import { Result, statusOf } from '../Console';
import { newHandle } from '../editorHandle';
import type { Schema } from '../SqlEditor';

const SqlEditor = lazy(() => import('../SqlEditor'));

async function readSchema(): Promise<Schema> {
  const r = await sandboxExec(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
  );
  const out: Schema = {};
  if (r.ok) for (const [t, c] of r.results[0].values) (out[String(t)] ??= []).push(String(c));
  return out;
}

export const Sandbox = memo(function Sandbox() {
  const datasetId = useShelf((s) => s.sandboxDataset);
  const erd = useShelf((s) => s.installed.includes('erd'));
  const ds = DATASETS.find((d) => d.id === datasetId) ?? DATASETS[0];
  const handle = useMemo(newHandle, []);
  const [state, setState] = useState<'loading' | 'ready' | string>(sandboxDataset() === datasetId ? 'ready' : 'loading');
  const [result, setResult] = useState<RunView | undefined>();
  const [running, setRunning] = useState(false);
  const [inTxn, setInTxn] = useState(false);
  const [schema, setSchema] = useState<Schema>({});
  const [generation, setGeneration] = useState(0); // remounts the editor after a reload

  const load = useCallback(async (id: Dataset['id'], fresh: boolean) => {
    setState('loading');
    setResult(undefined);
    setInTxn(false);
    try {
      if (fresh || sandboxDataset() !== id) await openSandbox(id);
      setSchema(await readSchema());
      setState('ready');
    } catch (e) {
      setState(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load(datasetId, false);
  }, [datasetId, load]);

  const run = async () => {
    const sql = (useShelf.getState().sandboxSql[datasetId] ?? ds.starter).trim();
    if (!sql || running || state !== 'ready') return;
    setRunning(true);
    const out = await sandboxExec(sql);
    setResult(toView(out));
    setInTxn(await inTransaction(sandboxExec));
    setSchema(await readSchema());
    setRunning(false);
  };

  const tableCount = Object.keys(schema).length;

  return (
    <div className="search sandbox">
      <div className="toolbar sandbox-bar">
        <label className="th" htmlFor="sandbox-ds">
          ชุดข้อมูล
        </label>
        <select
          id="sandbox-ds"
          className="field sunken"
          data-testid="sandbox-dataset"
          value={datasetId}
          disabled={state === 'loading'}
          onChange={(e) => useShelf.getState().setSandboxDataset(e.target.value as Dataset['id'])}
        >
          {DATASETS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          className="btn raised"
          disabled={state === 'loading'}
          title="ทิ้งทุกอย่างที่แก้ แล้วโหลดชุดข้อมูลนี้ใหม่"
          onClick={() => void load(datasetId, true).then(() => setGeneration((g) => g + 1))}
        >
          <Icon name="reset" /> Reload data
        </button>
        {erd && (
          <button className="btn raised" onClick={() => openApp('erd')}>
            <Icon name="diagram" /> ER Diagram
          </button>
        )}
      </div>
      <p className="sandbox-about th dim">
        {ds.blurb}
        {ds.source && (
          <>
            {' '}
            ที่มา:{' '}
            <a href={ds.source.url} target="_blank" rel="noreferrer">
              {ds.source.label}
            </a>{' '}
            ({ds.source.license})
          </>
        )}
      </p>

      <div className="tabpanel raised">
        <Suspense fallback={<div className="editor sunken dim mono pad">Loading editor…</div>}>
          <SqlEditor
            key={`${datasetId}/${generation}`}
            doc={useShelf.getState().sandboxSql[datasetId] ?? ds.starter}
            onChange={(sql) => useShelf.getState().setSandboxSql(datasetId, sql)}
            onRun={() => void run()}
            schema={schema}
            handle={handle}
            label="Sandbox SQL editor"
          />
        </Suspense>
        <div className="toolbar">
          <button className="btn raised primary" data-testid="sandbox-run" disabled={running || state !== 'ready'} onClick={() => void run()}>
            <Icon name="play" /> Run
          </button>
          <button className="btn raised" onClick={() => void handle.format()}>
            <Icon name="wand" /> Format
          </button>
          <span className="spacer" />
          <span className="kbd th">แยกจากฐานข้อมูลของ ticket แก้อะไรก็ได้</span>
        </div>
        <div className="results sunken sel" data-testid="sandbox-result" aria-live="polite">
          {state !== 'ready' && state !== 'loading' ? (
            <div className="result-msg th" role="alert">
              <h4 className="bad">โหลดชุดข้อมูลไม่สำเร็จ</h4>
              <p className="mono dim">{state}</p>
            </div>
          ) : (
            <Result r={result} />
          )}
        </div>
        <div className="statusbar">
          <span className="sunken cell mono" data-testid="sandbox-status">
            {state === 'loading' ? 'Loading dataset…' : running ? 'Running…' : statusOf(result)}
          </span>
          {inTxn && (
            <span className="sunken cell mono txn" title="มี transaction เปิดค้างอยู่ใน Sandbox">
              TXN OPEN
            </span>
          )}
          <span className="sunken cell mono">
            {tableCount} table{tableCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
});
