// Sandbox: a second PostgreSQL server loaded with a sample dataset, separate from the
// ticket database so nothing the player does here can touch a ticket's workspace.
import type { PGlite } from '@electric-sql/pglite';
import { createDb, execOn, type Exec, type ExecOutcome } from './pg';

export interface Dataset {
  id: 'chinook' | 'pagila' | 'empty';
  name: string;
  blurb: string;
  source?: { label: string; url: string; license: string };
  /** Loaded on demand: the SQL is a few hundred KB to a few MB. */
  load?: () => Promise<string>;
  starter: string;
}

export const DATASETS: Dataset[] = [
  {
    id: 'chinook',
    name: 'Chinook — ร้านเพลงออนไลน์',
    blurb: 'ศิลปิน อัลบั้ม เพลง ลูกค้า ใบแจ้งหนี้ และพนักงาน 11 ตาราง ชุดข้อมูลฝึก SQL ที่ใช้กันทั่วโลก',
    source: { label: 'lerocha/chinook-database', url: 'https://github.com/lerocha/chinook-database', license: 'MIT' },
    load: () => import('../datasets/chinook.sql?raw').then((m) => m.default),
    starter: `-- ศิลปินที่มีเพลงมากที่สุด
SELECT a.name, count(*) AS tracks
FROM track AS t
JOIN album AS al ON al.album_id = t.album_id
JOIN artist AS a ON a.artist_id = al.artist_id
GROUP BY a.name
ORDER BY tracks DESC
LIMIT 10;`,
  },
  {
    id: 'pagila',
    name: 'Pagila — ร้านเช่าหนัง',
    blurb: 'หนัง นักแสดง หมวดหมู่ สาขา การเช่า และการชำระเงิน 15 ตาราง (Sakila ฉบับ PostgreSQL ตัดให้เบาลง)',
    source: { label: 'devrimgunduz/pagila', url: 'https://github.com/devrimgunduz/pagila', license: 'PostgreSQL License' },
    load: () => import('../datasets/pagila.sql?raw').then((m) => m.default),
    starter: `-- หมวดหนังที่ทำรายได้มากที่สุด
SELECT c.name AS category, sum(p.amount) AS revenue
FROM payment AS p
JOIN rental AS r ON r.rental_id = p.rental_id
JOIN inventory AS i ON i.inventory_id = r.inventory_id
JOIN film_category AS fc ON fc.film_id = i.film_id
JOIN category AS c ON c.category_id = fc.category_id
GROUP BY c.name
ORDER BY revenue DESC;`,
  },
  {
    id: 'empty',
    name: 'ฐานข้อมูลว่าง',
    blurb: 'ไม่มีตารางเลย ลองออกแบบและสร้างเองตั้งแต่ศูนย์',
    starter: `CREATE TABLE note (
  note_id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);`,
  },
];

let server: { db: PGlite; dataset: Dataset['id'] } | null = null;
let opening: Promise<void> | null = null;

/** Start a fresh server with a dataset, closing the previous one. */
export function openSandbox(id: Dataset['id']): Promise<void> {
  const run = async () => {
    const ds = DATASETS.find((d) => d.id === id)!;
    const old = server;
    server = null;
    await old?.db.close();
    const [db, sql] = await Promise.all([createDb(), ds.load?.() ?? Promise.resolve('')]);
    if (sql) await db.exec(sql);
    server = { db, dataset: id };
  };
  opening = (opening ?? Promise.resolve()).then(run, run);
  return opening;
}

export const sandboxDataset = () => server?.dataset ?? null;

/** Run SQL in the sandbox. Never throws. */
export const sandboxExec: Exec = async (sql): Promise<ExecOutcome> => {
  await opening;
  if (!server) return { ok: false, error: { message: 'Sandbox is not open', code: '' }, ms: 0 };
  return execOn(server.db, sql);
};
