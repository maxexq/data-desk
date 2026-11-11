import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { execSql } from '../../lib/pg';
import { sandboxDataset, sandboxExec } from '../../lib/sandbox';
import { layoutEr, readSchema, type Box, type ErLink, type ErSchema } from '../../lib/schemaGraph';
import { useGame, withDb } from '../../state/game';
import { useShelf } from '../../state/shelf';
import { Icon } from '../../ui/icons';

const W = 210;
const HEAD = 26;
const ROW = 20;
const SIZE = { w: W, rowH: ROW, headH: HEAD, gapX: 90, gapY: 26 };

type Source = 'workspace' | 'sandbox';

function linkPath(l: ErLink, s: ErSchema, at: Record<string, Box>): string | null {
  const from = s.tables.find((t) => t.name === l.from);
  const to = s.tables.find((t) => t.name === l.to);
  const a = at[l.from];
  const b = at[l.to];
  if (!from || !to || !a || !b) return null;
  const rowY = (box: Box, i: number) => box.y + HEAD + Math.max(0, i) * ROW + ROW / 2;
  const y1 = rowY(a, from.columns.findIndex((c) => c.name === l.fromCols[0]));
  const y2 = rowY(b, to.columns.findIndex((c) => c.name === l.toCols[0]));
  if (l.from === l.to) {
    const x = a.x + W;
    return `M ${x} ${y1} C ${x + 46} ${y1}, ${x + 46} ${y2}, ${x} ${y2}`;
  }
  // Leave from the side that faces the other table.
  const childRight = a.x + W / 2 < b.x + W / 2;
  const x1 = childRight ? a.x + W : a.x;
  const x2 = childRight ? b.x : b.x + W;
  const bend = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + (childRight ? bend : -bend)} ${y1}, ${x2 + (childRight ? -bend : bend)} ${y2}, ${x2} ${y2}`;
}

export const ErDiagram = memo(function ErDiagram() {
  const sandboxInstalled = useShelf((s) => s.installed.includes('sandbox'));
  const active = useGame((s) => s.active);
  const dbVersion = useGame((s) => s.dbVersion);
  const [source, setSource] = useState<Source>(active || !sandboxInstalled ? 'workspace' : 'sandbox');
  const [schema, setSchema] = useState<ErSchema | null>(null);
  const [msg, setMsg] = useState<string | null>('Loading…');
  const [at, setAt] = useState<Record<string, Box>>({});
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ name: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

  const load = useCallback(async () => {
    setMsg('Loading…');
    let s: ErSchema | null;
    if (source === 'workspace') {
      if (!useGame.getState().active) {
        setSchema(null);
        setMsg('ยังไม่ได้เปิด ticket เลือกงานจาก Inbox ก่อน');
        return;
      }
      s = await withDb(() => readSchema(execSql, 'ws'));
      if (!s) {
        setMsg('อ่าน schema ไม่ได้ ถ้า transaction พังอยู่ ให้ ROLLBACK ก่อน');
        return;
      }
    } else {
      if (!sandboxDataset()) {
        setSchema(null);
        setMsg('เปิด Sandbox แล้วเลือกชุดข้อมูลก่อน');
        return;
      }
      s = await readSchema(sandboxExec, 'public');
    }
    setSchema(s);
    setMsg(s && s.tables.length === 0 ? 'ยังไม่มีตาราง' : null);
    setAt((prev) => {
      const fresh = s ? layoutEr(s, SIZE) : {};
      // Keep tables where the player dragged them; new tables take their computed place.
      return Object.fromEntries(Object.entries(fresh).map(([k, v]) => [k, prev[k] ?? v]));
    });
  }, [source]);

  useEffect(() => {
    void load();
  }, [load, source === 'workspace' ? dbVersion : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const bounds = useMemo(() => {
    let w = 0;
    let h = 0;
    for (const t of schema?.tables ?? []) {
      const b = at[t.name];
      if (!b) continue;
      w = Math.max(w, b.x + W + 80);
      h = Math.max(h, b.y + HEAD + t.columns.length * ROW + 40);
    }
    return { w, h };
  }, [schema, at]);

  const onDown = (e: PointerEvent<HTMLElement>, name: string) => {
    if (e.button !== 0) return;
    drag.current = { name, sx: e.clientX, sy: e.clientY, ox: at[name].x, oy: at[name].y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const x = Math.max(0, d.ox + e.clientX - d.sx);
    const y = Math.max(0, d.oy + e.clientY - d.sy);
    setAt((p) => ({ ...p, [d.name]: { x, y } }));
  };
  const onUp = () => (drag.current = null);

  const related = (l: ErLink) => hover !== null && (l.from === hover || l.to === hover);

  return (
    <div className="erd">
      <div className="toolbar">
        <div className="seg" role="radiogroup" aria-label="Source">
          {(['workspace', 'sandbox'] as Source[]).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={source === s}
              className={`btn raised${source === s ? ' pressed' : ''}`}
              disabled={s === 'sandbox' && !sandboxInstalled}
              title={s === 'sandbox' && !sandboxInstalled ? 'ติดตั้ง Sandbox จาก Shareware Shelf ก่อน' : undefined}
              onClick={() => setSource(s)}
            >
              <Icon name={s === 'workspace' ? 'ticket' : 'sandbox'} /> {s === 'workspace' ? 'Ticket' : 'Sandbox'}
            </button>
          ))}
        </div>
        <button className="btn raised" onClick={() => void load()}>
          <Icon name="reset" /> Refresh
        </button>
        <button className="btn raised" onClick={() => schema && setAt(layoutEr(schema, SIZE))}>
          <Icon name="diagram" /> Auto layout
        </button>
        <span className="spacer" />
        <span className="kbd th">ลากหัวตารางเพื่อย้าย · ชี้ที่ตารางเพื่อดูเส้นที่เกี่ยวข้อง</span>
      </div>
      <div className="erd-canvas sunken" data-testid="erd">
        {msg ? (
          <p className="th dim pad">{msg}</p>
        ) : (
          <div className="erd-world" style={{ width: bounds.w, height: bounds.h }}>
            <svg className="erd-lines" width={bounds.w} height={bounds.h} aria-hidden="true">
              <defs>
                {/* crow's foot = "many" end (the table holding the foreign key), bar = "one" end */}
                <marker id="erd-many" viewBox="0 0 12 12" refX="0" refY="6" markerWidth="12" markerHeight="12" orient="auto">
                  <path d="M 12 6 L 0 0 M 12 6 L 0 6 M 12 6 L 0 12" stroke="context-stroke" fill="none" strokeWidth="1.5" />
                </marker>
                <marker id="erd-one" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" orient="auto">
                  <path d="M 8 0 L 8 12" stroke="context-stroke" strokeWidth="2" />
                </marker>
              </defs>
              {schema!.links.map((l) => {
                const d = linkPath(l, schema!, at);
                return d ? (
                  <path key={l.name + l.from} d={d} className={`erd-link${related(l) ? ' on' : ''}`} markerStart="url(#erd-many)" markerEnd="url(#erd-one)">
                    <title>{`${l.from}(${l.fromCols.join(', ')}) → ${l.to}(${l.toCols.join(', ')})`}</title>
                  </path>
                ) : null;
              })}
            </svg>
            {schema!.tables.map((t) =>
              at[t.name] ? (
                <section
                  key={t.name}
                  className={`erd-table raised${hover === t.name ? ' on' : ''}`}
                  data-erd-table={t.name}
                  style={{ left: at[t.name].x, top: at[t.name].y, width: W }}
                  onPointerEnter={() => setHover(t.name)}
                  onPointerLeave={() => setHover(null)}
                >
                  <header className="erd-head mono" onPointerDown={(e) => onDown(e, t.name)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                    {t.name}
                  </header>
                  {t.columns.map((c) => (
                    <div key={c.name} className="erd-col mono" style={{ height: ROW }}>
                      <span className={`erd-key${c.pk ? ' pk' : c.fk ? ' fk' : ''}`}>{c.pk ? 'PK' : c.fk ? 'FK' : ''}</span>
                      <span className={`erd-name${c.notNull ? ' nn' : ''}`}>{c.name}</span>
                      <span className="erd-type dim">{c.type.replace('character varying', 'varchar').replace('timestamp with time zone', 'timestamptz')}</span>
                    </div>
                  ))}
                </section>
              ) : null,
            )}
          </div>
        )}
      </div>
      <div className="statusbar">
        <span className="sunken cell mono" data-testid="erd-status">
          {schema ? `${schema.tables.length} tables · ${schema.links.length} foreign keys` : '—'}
        </span>
        <span className="sunken cell th">PK = primary key · FK = foreign key · ตัวหนา = NOT NULL</span>
      </div>
    </div>
  );
});
