// PostgreSQL in the browser (PGlite). One instance, one connection, so a BEGIN
// in one call stays open until the player sends COMMIT or ROLLBACK, exactly
// like a psql session.
import { PGlite, types } from '@electric-sql/pglite';

export type Cell = string | number | boolean | null;

export interface Rows {
  columns: string[];
  values: Cell[][];
}

export interface StmtResult extends Rows {
  affected: number;
  isQuery: boolean;
}

export interface PgError {
  message: string;
  code: string;
  detail?: string;
  hint?: string;
  position?: number;
}

export type ExecOutcome = { ok: true; results: StmtResult[]; ms: number } | { ok: false; error: PgError; ms: number };

const asText = (v: string) => v;
// Keep dates and times exactly as Postgres prints them instead of JS Date objects.
const parsers = Object.fromEntries(
  [types.DATE, types.TIME, types.TIMETZ, types.TIMESTAMP, types.TIMESTAMPTZ, types.INTERVAL, types.JSON, types.JSONB].map((t) => [t, asText]),
);

let dbPromise: Promise<PGlite> | null = null;

/** A fresh PostgreSQL server. The game uses one for tickets; Sandbox starts its own. */
export const createDb = () => PGlite.create({ parsers });

export function getDb(): Promise<PGlite> {
  dbPromise ??= createDb();
  return dbPromise;
}

/** For tests: start over with a clean server. */
export async function closeDb() {
  const db = await dbPromise;
  dbPromise = null;
  await db?.close();
}

const toCell = (v: unknown): Cell => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v);
};

const toError = (e: unknown): PgError => {
  const x = e as Partial<PgError> & { position?: string | number };
  return {
    message: x.message ?? String(e),
    code: x.code ?? '',
    detail: x.detail || undefined,
    hint: x.hint || undefined,
    position: x.position ? Number(x.position) : undefined,
  };
};

export type Exec = (sql: string) => Promise<ExecOutcome>;

/** Run one or more statements on the ticket database. Never throws: errors come back as `{ ok: false }`. */
export const execSql: Exec = async (sql) => execOn(await getDb(), sql);

/** Run one or more statements on any server. Never throws. */
export async function execOn(db: PGlite, sql: string): Promise<ExecOutcome> {
  const t0 = performance.now();
  const ms = () => Math.round((performance.now() - t0) * 10) / 10;
  try {
    const raw = await db.exec(sql, { rowMode: 'array' });
    const results = raw.map((r) => ({
      columns: r.fields.map((f) => f.name),
      values: (r.rows as unknown[][]).map((row) => row.map(toCell)),
      affected: r.affectedRows ?? 0,
      isQuery: r.fields.length > 0,
    }));
    return { ok: true, results, ms: ms() };
  } catch (e) {
    return { ok: false, error: toError(e), ms: ms() };
  }
}

/** Last statement that returned columns, if any. */
export const lastRows = (results: StmtResult[]): StmtResult | undefined => [...results].reverse().find((r) => r.isQuery);

/** True while the session has an open transaction block (including an aborted one). */
export async function inTransaction(exec: Exec = execSql): Promise<boolean> {
  // SAVEPOINT is only legal inside a block: outside it fails with 25P01 and changes nothing.
  const probe = await exec('SAVEPOINT dd_probe');
  if (probe.ok) {
    await exec('RELEASE SAVEPOINT dd_probe');
    return true;
  }
  return probe.error.code !== '25P01'; // 25P02 = inside an aborted block
}

/** Explain a Postgres error in plain Thai, keyed on SQLSTATE. */
export function explainError(e: PgError): string {
  const q = (s: string) => e.message.match(new RegExp(s))?.[1];
  switch (e.code) {
    case '42P01':
      return `ไม่มีตารางชื่อ "${q('relation "(.+?)"') ?? '?'}" เปิดหน้าต่าง Tables เพื่อดูชื่อตารางที่มี แล้วเช็กตัวสะกด`;
    case '42703':
      return `ไม่มีคอลัมน์ชื่อ "${q('column "?(.+?)"? does not exist') ?? '?'}" ถ้าตั้งใจให้เป็นข้อความ ต้องครอบด้วย ' ' (single quote) เพราะ " " ใน Postgres หมายถึงชื่อคอลัมน์`;
    case '42702':
      return `คอลัมน์ "${q('column reference "(.+?)"') ?? '?'}" มีอยู่ในมากกว่าหนึ่งตาราง ให้นำหน้าด้วยชื่อย่อของตาราง เช่น s.name`;
    case '42601':
      return `เขียนผิดรูปแบบแถวๆ "${q('at or near "(.+?)"') ?? 'ท้ายคำสั่ง'}" ลองดูว่าก่อนหน้านั้นขาดคำ ขาดจุลภาค ลืมปิดวงเล็บ หรือเรียงลำดับผิดหรือเปล่า (SELECT → FROM → JOIN → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT)`;
    case '42803':
      return 'คอลัมน์ที่อยู่ใน SELECT ต้องอยู่ใน GROUP BY ด้วย หรือไม่ก็ต้องอยู่ในฟังก์ชันสรุปอย่าง COUNT / SUM';
    case '42883':
      return 'ไม่มีฟังก์ชันหรือตัวดำเนินการที่ใช้กับชนิดข้อมูลนี้ มักเกิดจากเทียบข้อมูลคนละชนิด เช่น ตัวเลขกับข้อความ ลองแปลงชนิดด้วย ::';
    case '42P07':
      return `มีตารางหรือ index ชื่อ "${q('relation "(.+?)"') ?? '?'}" อยู่แล้ว ถ้าอยากเริ่มใหม่ให้กด Reset data`;
    case '42701':
      return `มีคอลัมน์ชื่อ "${q('column "(.+?)"') ?? '?'}" อยู่แล้วในตารางนี้`;
    case '22P02':
      return 'ค่าที่ใส่แปลงเป็นชนิดข้อมูลของคอลัมน์ไม่ได้ เช่น ใส่ข้อความในคอลัมน์ตัวเลข หรือวันที่ผิดรูปแบบ (ใช้ YYYY-MM-DD)';
    case '22012':
      return 'หารด้วยศูนย์ ลองใช้ NULLIF(ตัวหาร, 0) เพื่อให้ผลเป็น NULL แทน';
    case '23505':
      return `ค่าซ้ำกับแถวที่มีอยู่ ซึ่งขัดกับ UNIQUE หรือ PRIMARY KEY${e.detail ? ` (${e.detail})` : ''}`;
    case '23503':
      return `ขัดกับ FOREIGN KEY: แถวนี้อ้างถึงข้อมูลที่ไม่มีอยู่ หรือกำลังลบแถวที่ยังมีตารางอื่นอ้างถึง${e.detail ? ` (${e.detail})` : ''}`;
    case '23502':
      return `คอลัมน์ "${q('column "(.+?)"') ?? '?'}" เป็น NOT NULL จึงใส่ค่าว่างไม่ได้ ถ้ากำลังเพิ่ม NOT NULL ให้ตารางที่มีข้อมูล ต้องเติมค่าให้ครบทุกแถวก่อน`;
    case '23514':
      return `ค่าไม่ผ่านเงื่อนไข CHECK "${q('constraint "(.+?)"') ?? ''}" ของตาราง`;
    case '25P02':
      return 'transaction นี้พังไปแล้วเพราะคำสั่งก่อนหน้า error คำสั่งหลังจากนั้นจะถูกปฏิเสธทั้งหมด ต้องส่ง ROLLBACK ก่อนแล้วเริ่มใหม่';
    case '25001':
      return 'คำสั่งนี้รันใน transaction ไม่ได้ ต้อง COMMIT หรือ ROLLBACK ก่อน';
    case '2BP01':
      return 'ลบไม่ได้เพราะยังมีของอื่นพึ่งพาสิ่งนี้อยู่ (เช่น foreign key หรือ view)';
    default:
      return e.message;
  }
}
