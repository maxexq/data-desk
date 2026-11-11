// The judge: sets up a ticket's workspace and decides whether a task is done.
// No DOM here, so the same code runs in the browser and in the test-suite.
import type { Check, Test, Ticket } from '../tickets/types';
import { execSql, explainError, inTransaction, lastRows, type Cell, type Rows } from './pg';

export interface ReportLine {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface Report {
  pass: boolean;
  lines: ReportLine[];
}

const WS = 'ws'; // the player's workspace schema
const JUDGE = 'judge'; // scratch schema for script checks

async function must(sql: string) {
  const r = await execSql(sql);
  if (!r.ok) throw new Error(`${r.error.message} — while running: ${sql.slice(0, 80)}`);
  return r.results;
}

async function seedSchema(schema: string, ticket: Ticket) {
  await execSql('ROLLBACK'); // leave any open block (a warning, not an error, when there is none)
  await must(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}; SET search_path TO ${schema};`);
  await must(ticket.seed);
}

/** (Re)create the player's workspace for a ticket. */
export async function resetWorkspace(ticket: Ticket, taskIndex = 0) {
  await seedSchema(WS, ticket);
  if (ticket.afterSeed && taskIndex === 0) await must(ticket.afterSeed);
}

/** Compare cells as text, with numbers normalised so 12, 12.0 and '12' are equal. */
const norm = (v: Cell): string => {
  if (v === null) return '\u0000NULL';
  if (typeof v === 'boolean') return v ? 't' : 'f';
  const s = String(v);
  return /^-?\d+(\.\d+)?$/.test(s) ? String(Number(s)) : s;
};
const key = (row: Cell[]) => row.map(norm).join('\u0001');

export function sameRows(a: Cell[][], b: Cell[][], ordered = false): boolean {
  if (a.length !== b.length) return false;
  const ka = a.map(key);
  const kb = b.map(key);
  if (!ordered) {
    ka.sort();
    kb.sort();
  }
  return ka.every((k, i) => k === kb[i]);
}

/** Result checks run on every query. `rows` is the player's last result (possibly empty). */
export async function checkResult(check: Extract<Check, { kind: 'result' }>, rows: Rows): Promise<boolean> {
  if ('test' in check) return check.test(rows);
  const ref = await execSql(check.expect);
  if (!ref.ok) return false;
  const want = lastRows(ref.results);
  return !!want && sameRows(rows.values, want.values, check.ordered);
}

async function runTest(t: Test, savepoint: boolean): Promise<ReportLine> {
  await execSql(savepoint ? 'SAVEPOINT judge_sp' : 'BEGIN');
  const r = await execSql(t.sql);
  await execSql(savepoint ? 'ROLLBACK TO SAVEPOINT judge_sp; RELEASE SAVEPOINT judge_sp' : 'ROLLBACK');
  if (t.expect === 'ok') return r.ok ? { name: t.name, ok: true } : { name: t.name, ok: false, detail: explainError(r.error) };
  if (!Array.isArray(t.expect)) {
    if (r.ok) return { name: t.name, ok: false, detail: 'คำสั่งนี้ควรถูกฐานข้อมูลปฏิเสธ แต่กลับผ่าน' };
    return r.error.code === t.expect.error
      ? { name: t.name, ok: true }
      : { name: t.name, ok: false, detail: `ถูกปฏิเสธด้วยเหตุผลอื่น: ${r.error.message}` };
  }
  if (!r.ok) return { name: t.name, ok: false, detail: explainError(r.error) };
  const got = lastRows(r.results)?.values ?? [];
  if (sameRows(got, t.expect, true)) return { name: t.name, ok: true };
  const show = (rows: Cell[][]) => (rows.length === 1 && rows[0].length === 1 ? String(rows[0][0]) : JSON.stringify(rows));
  return { name: t.name, ok: false, detail: `ได้ ${show(got)} แต่ควรเป็น ${show(t.expect)}` };
}

async function runTests(tests: Test[], savepoint = false): Promise<ReportLine[]> {
  const lines: ReportLine[] = [];
  for (const t of tests) lines.push(await runTest(t, savepoint));
  return lines;
}

const finish = (lines: ReportLine[]): Report => ({ pass: lines.every((l) => l.ok), lines });

async function judgeState(check: Extract<Check, { kind: 'state' }>): Promise<Report> {
  const lines: ReportLine[] = [];
  let open = await inTransaction();
  if (check.noOpenTxn) {
    lines.push(
      open
        ? { name: 'ไม่มี transaction ค้างอยู่', ok: false, detail: 'session ยังอยู่ใน transaction ที่ยังไม่ COMMIT หรือ ROLLBACK งานที่ยังไม่ COMMIT ถือว่ายังไม่เกิดขึ้น' }
        : { name: 'ไม่มี transaction ค้างอยู่', ok: true },
    );
  }
  if (open && check.rollbackFirst) {
    // Judge what is really committed: uncommitted work does not count.
    await execSql('ROLLBACK');
    open = false;
  }
  if (open && !(await execSql('SELECT 1')).ok) {
    lines.push({ name: 'ตรวจข้อมูล', ok: false, detail: 'transaction ที่ค้างอยู่พังไปแล้ว (มี error ก่อนหน้า) ต้อง ROLLBACK ก่อน' });
    return finish(lines);
  }
  lines.push(...(await runTests(check.tests, open)));
  return finish(lines);
}

async function judgeScript(ticket: Ticket, check: Extract<Check, { kind: 'script' }>, files: Record<string, string>): Promise<Report> {
  const lines: ReportLine[] = [];
  await seedSchema(JUDGE, ticket);
  try {
    for (const phase of check.phases) {
      if (phase.run) {
        const src = files[phase.run] ?? '';
        const label = `รัน ${phase.run}${phase.label ? ` (${phase.label})` : ''}`;
        if (!src.trim()) {
          lines.push({ name: label, ok: false, detail: 'ไฟล์ยังว่างอยู่' });
          break;
        }
        const r = await execSql(src);
        if (!r.ok) {
          lines.push({ name: label, ok: false, detail: explainError(r.error) });
          break;
        }
        if (await inTransaction()) {
          await execSql('ROLLBACK');
          lines.push({ name: label, ok: false, detail: 'สคริปต์เปิด transaction ค้างไว้ (ลืม COMMIT) งานทั้งหมดจึงถูกยกเลิก' });
          break;
        }
        lines.push({ name: label, ok: true });
        for (const m of phase.mustMatch ?? []) {
          lines.push(m.pattern.test(src) ? { name: m.name, ok: true } : { name: m.name, ok: false, detail: `ไม่พบใน ${phase.run}` });
        }
      }
      lines.push(...(await runTests(phase.tests)));
      if (!lines.every((l) => l.ok)) break; // later phases build on this one
    }
  } finally {
    await execSql('ROLLBACK');
    await execSql(`SET search_path TO ${WS}`);
  }
  return finish(lines);
}

interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

async function judgePlan(check: Extract<Check, { kind: 'plan' }>): Promise<Report> {
  if (await inTransaction())
    return finish([{ name: 'อ่านแผนการทำงาน', ok: false, detail: 'มี transaction ค้างอยู่ COMMIT หรือ ROLLBACK ก่อน' }]);
  await execSql(`ANALYZE ${check.table}`);
  const r = await execSql(`EXPLAIN (FORMAT JSON) ${check.query}`);
  if (!r.ok) return finish([{ name: 'อ่านแผนการทำงาน', ok: false, detail: explainError(r.error) }]);
  const cell = r.results[0].values[0][0];
  const root = (typeof cell === 'string' ? JSON.parse(cell) : cell)[0].Plan as PlanNode;
  const nodes: PlanNode[] = [];
  const walk = (n: PlanNode) => {
    nodes.push(n);
    n.Plans?.forEach(walk);
  };
  walk(root);
  const seq = nodes.find((n) => n['Node Type'] === 'Seq Scan' && n['Relation Name'] === check.table);
  const idx = nodes.find((n) => n['Index Name']);
  return finish([
    seq
      ? { name: `ไม่อ่านตาราง ${check.table} ทั้งตาราง`, ok: false, detail: `แผนยังเป็น Seq Scan on ${check.table} ฐานข้อมูลต้องอ่านทุกแถวเพื่อหาคำตอบ` }
      : { name: `ไม่อ่านตาราง ${check.table} ทั้งตาราง`, ok: true, detail: idx ? `ใช้ index ${idx['Index Name']} (${idx['Node Type']})` : undefined },
  ]);
}

/** Run a Submit-type check. `files` maps file name → content for script checks. */
export async function judge(ticket: Ticket, check: Check, files: Record<string, string> = {}): Promise<Report> {
  switch (check.kind) {
    case 'state':
      return judgeState(check);
    case 'script':
      return judgeScript(ticket, check, files);
    case 'plan':
      return judgePlan(check);
    case 'result':
      return finish([{ name: 'ขั้นนี้ตรวจจากผลลัพธ์ของ query', ok: false, detail: 'รัน query ใน SQL Console แล้วระบบจะตรวจให้เอง' }]);
  }
}

export interface TableInfo {
  name: string;
  columns: { name: string; type: string; nullable: boolean }[];
  constraints: string[];
  rowCount: number;
}

/** Describe the workspace for the Tables window and the editor's autocomplete. */
export async function describeWorkspace(): Promise<TableInfo[] | null> {
  if (await inTransaction()) {
    // Still fine to read inside a healthy block; an aborted one cannot be read at all.
    if (!(await execSql('SELECT 1')).ok) return null;
  }
  const cols = await execSql(
    `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = '${WS}' ORDER BY table_name, ordinal_position`,
  );
  const cons = await execSql(
    `SELECT c.relname, pg_get_constraintdef(k.oid) FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = '${WS}' AND k.contype <> 'n' ORDER BY c.relname, k.contype DESC, k.conname`,
  );
  const idx = await execSql(`SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = '${WS}' ORDER BY indexname`);
  if (!cols.ok || !cons.ok || !idx.ok) return null;
  const tables = new Map<string, TableInfo>();
  for (const [t, c, type, nullable] of cols.results[0].values) {
    const name = String(t);
    if (!tables.has(name)) tables.set(name, { name, columns: [], constraints: [], rowCount: 0 });
    tables.get(name)!.columns.push({ name: String(c), type: String(type), nullable: nullable === 'YES' });
  }
  for (const [t, def] of cons.results[0].values) tables.get(String(t))?.constraints.push(String(def));
  for (const [t, def] of idx.results[0].values) {
    const d = String(def).replace(`${WS}.`, '');
    // Indexes that only back a PRIMARY KEY / UNIQUE constraint are already listed above.
    if (!/_pkey |_key /.test(d)) tables.get(String(t))?.constraints.push(d);
  }
  for (const info of tables.values()) {
    const n = await execSql(`SELECT count(*) FROM ${WS}."${info.name}"`);
    if (n.ok) info.rowCount = Number(n.results[0].values[0][0]);
  }
  return [...tables.values()];
}

export async function previewTable(name: string, limit = 200): Promise<Rows | null> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;
  const r = await execSql(`SELECT * FROM ${WS}."${name}" LIMIT ${limit}`);
  return r.ok ? r.results[0] : null;
}
