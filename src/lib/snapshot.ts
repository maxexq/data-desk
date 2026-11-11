// Snapshot: save and restore a ticket's workspace with a real pg_dump (compiled to WebAssembly).
// The dump is plain SQL, so the player can open it and see what pg_dump writes.
import { idbGet, idbSet } from './idb';
import { execSql, getDb, inTransaction } from './pg';

export interface SnapshotMeta {
  id: string;
  ticketId: string;
  name: string;
  at: string; // ISO time
  bytes: number;
  tables: number;
}

const WS = 'ws';
const indexKey = 'snapshots';
const dumpKey = (id: string) => `snapshot:${id}`;

export const listSnapshots = async () => (await idbGet<SnapshotMeta[]>(indexKey)) ?? [];
export const readDump = async (id: string) => (await idbGet<string>(dumpKey(id))) ?? null;

/** Put the session back the way the game expects after pg_dump or a restore changed its settings. */
async function settle() {
  if (await inTransaction()) await execSql('ROLLBACK');
  await execSql(`RESET ALL; SET search_path TO ${WS}`);
}

export class SnapshotError extends Error {}

/**
 * Dump the workspace schema. Like the real pg_dump, it only sees committed data, so an open
 * transaction must be finished first (it also shares this session, which pg_dump would take over).
 */
export async function takeSnapshot(ticketId: string, name: string): Promise<SnapshotMeta> {
  if (await inTransaction()) throw new SnapshotError('มี transaction เปิดค้างอยู่ COMMIT หรือ ROLLBACK ก่อน แล้วค่อยถ่าย snapshot (pg_dump เห็นเฉพาะข้อมูลที่ COMMIT แล้ว)');
  const { pgDump } = await import('@electric-sql/pglite-tools/pg_dump');
  let sql: string;
  try {
    const file = await pgDump({ pg: await getDb(), args: [`--schema=${WS}`, '--no-owner', '--no-privileges'] });
    sql = await file.text();
  } finally {
    await settle();
  }
  const meta: SnapshotMeta = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ticketId,
    name: name.trim() || 'snapshot',
    at: new Date().toISOString(),
    bytes: new Blob([sql]).size,
    tables: (sql.match(/^CREATE TABLE /gm) ?? []).length,
  };
  await idbSet(dumpKey(meta.id), sql);
  await idbSet(indexKey, [meta, ...(await listSnapshots())]);
  return meta;
}

/** Replace the workspace with a snapshot. Anything not committed is rolled back first. */
export async function restoreSnapshot(id: string) {
  const sql = await readDump(id);
  if (!sql) throw new SnapshotError('ไม่พบไฟล์ของ snapshot นี้');
  if (await inTransaction()) await execSql('ROLLBACK');
  const drop = await execSql(`DROP SCHEMA IF EXISTS ${WS} CASCADE`);
  if (!drop.ok) throw new SnapshotError(drop.error.message);
  const r = await execSql(sql);
  await settle();
  if (!r.ok) throw new SnapshotError(`restore ไม่สำเร็จ: ${r.error.message}`);
}

export async function deleteSnapshot(id: string) {
  await idbSet(indexKey, (await listSnapshots()).filter((s) => s.id !== id));
  await idbSet(dumpKey(id), null);
}
