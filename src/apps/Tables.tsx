import { memo, useEffect, useState } from 'react';
import { previewTable } from '../lib/judge';
import type { Rows } from '../lib/pg';
import { useGame } from '../state/game';
import { Grid } from '../ui/Grid';
import { Icon } from '../ui/icons';

/** Schema browser for the open ticket's workspace. Refreshes after every run. */
export const Tables = memo(function Tables() {
  const tables = useGame((s) => s.tables);
  const version = useGame((s) => s.dbVersion);
  const ticketId = useGame((s) => s.active);
  const [picked, setPicked] = useState<string | null>(null);
  const [rows, setRows] = useState<Rows | null>(null);

  const name = tables?.some((t) => t.name === picked) ? picked : (tables?.[0]?.name ?? null);
  const info = tables?.find((t) => t.name === name);

  useEffect(() => {
    let live = true;
    if (!name) return setRows(null);
    previewTable(name).then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [name, version]);

  if (!ticketId) return <div className="empty th">เปิด ticket ก่อน แล้วตารางของงานนั้นจะแสดงที่นี่</div>;
  if (!tables)
    return (
      <div className="empty th">
        <p>อ่านตารางไม่ได้ เพราะ transaction ที่ค้างอยู่มี error ให้รัน ROLLBACK ใน SQL Console ก่อน</p>
      </div>
    );
  if (tables.length === 0) return <div className="empty th">workspace นี้ยังไม่มีตาราง</div>;

  return (
    <div className="tables">
      <nav className="tablelist" aria-label="ตาราง">
        {tables.map((t) => (
          <button key={t.name} className={`btn raised${t.name === name ? ' pressed' : ''}`} onClick={() => setPicked(t.name)}>
            <Icon name="table" /> <span className="grow">{t.name}</span> <span className="mono dim">{t.rowCount}</span>
          </button>
        ))}
      </nav>
      {info && (
        <div className="tableview">
          <div className="schema mono sel">
            {info.columns.map((c) => (
              <span key={c.name} className="col">
                <b>{c.name}</b> {c.type}
                {!c.nullable && <span className="nn">NOT NULL</span>}
              </span>
            ))}
          </div>
          {info.constraints.length > 0 && (
            <div className="constraints mono sel">
              {info.constraints.map((c, i) => (
                <div key={i}>{c}</div>
              ))}
            </div>
          )}
          <div className="results sunken sel">{rows && <Grid columns={rows.columns} values={rows.values} />}</div>
          <div className="statusbar">
            <span className="sunken cell mono">
              {info.rowCount} rows{info.rowCount > 200 ? ' (showing 200)' : ''}
            </span>
            <span className="sunken cell mono">{info.columns.length} columns</span>
          </div>
        </div>
      )}
    </div>
  );
});
