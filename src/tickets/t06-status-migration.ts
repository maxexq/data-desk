import type { Phase, Ticket } from './types';

const ONE = (v: number | string | boolean) => [[v]];
const hasColumn = (col: string) =>
  `SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = '${col}'`;

const UP = `BEGIN;

ALTER TABLE orders
  ADD COLUMN status text NOT NULL DEFAULT 'pending'
  CONSTRAINT orders_status_check CHECK (status IN ('pending', 'done', 'cancelled'));

UPDATE orders SET status = 'done' WHERE is_done;

ALTER TABLE orders DROP COLUMN is_done;

COMMIT;`;

const DOWN = `BEGIN;

ALTER TABLE orders ADD COLUMN is_done boolean NOT NULL DEFAULT false;

UPDATE orders SET is_done = true WHERE status = 'done';

ALTER TABLE orders DROP COLUMN status;

COMMIT;`;

const transactional = (file: string) => [
  { pattern: /\bbegin\b[\s\S]*\bcommit\b/i, name: `${file} ครอบด้วย BEGIN … COMMIT (สำเร็จทั้งหมดหรือไม่เปลี่ยนอะไรเลย)` },
];

const afterUp = (label: string): Phase => ({
  label,
  run: 'up.sql',
  mustMatch: transactional('up.sql'),
  tests: [
    { name: 'มีคอลัมน์ status', sql: hasColumn('status'), expect: ONE(1) },
    { name: 'คอลัมน์ is_done ถูกลบแล้ว', sql: hasColumn('is_done'), expect: ONE(0) },
    {
      name: 'ข้อมูลเดิมถูกแปลงครบ: done 6 แถว, pending 4 แถว',
      sql: 'SELECT status, count(*) FROM orders GROUP BY status ORDER BY status',
      expect: [
        ['done', 6],
        ['pending', 4],
      ],
    },
    { name: "ออเดอร์ใหม่ได้ status 'pending' เอง", sql: "INSERT INTO orders (customer) VALUES ('New') RETURNING status", expect: ONE('pending') },
    { name: "ใส่ status 'cancelled' ได้", sql: "INSERT INTO orders (customer, status) VALUES ('New', 'cancelled')", expect: 'ok' },
    { name: 'status ที่ไม่รู้จักถูกปฏิเสธ', sql: "INSERT INTO orders (customer, status) VALUES ('New', 'banana')", expect: { error: '23514' } },
    { name: 'status ว่างถูกปฏิเสธ', sql: "INSERT INTO orders (customer, status) VALUES ('New', NULL)", expect: { error: '23502' } },
  ],
});

export const t06: Ticket = {
  id: 't06',
  no: 'T-106',
  title: 'ออเดอร์ต้องยกเลิกได้',
  from: 'Non · Backend',
  kind: 'project',
  level: 7,
  skills: ['ALTER TABLE', 'Backfill', 'up / down migration', 'Rollback'],
  xp: 700,
  body: [
    'ตาราง orders มีคอลัมน์ is_done เป็น boolean แต่ตอนนี้ลูกค้ายกเลิกออเดอร์ได้แล้ว true กับ false ไม่พอ ผมอยากเปลี่ยนเป็นคอลัมน์ status ที่มี 3 ค่า: pending, done, cancelled',
    'ทีมเราไม่ deploy migration ที่ถอยกลับไม่ได้ เขียนสองไฟล์: up.sql เดินหน้า และ down.sql ถอยกลับให้ตารางเหมือนเดิม',
    "up.sql: เพิ่มคอลัมน์ status ชนิด text ห้ามว่าง ค่าเริ่มต้น 'pending' รับได้แค่ 3 ค่านั้น แปลงข้อมูลเดิม (is_done เป็น true ให้เป็น 'done' นอกนั้น 'pending') แล้วลบคอลัมน์ is_done",
    "down.sql: เพิ่ม is_done ชนิด boolean ห้ามว่าง ค่าเริ่มต้น false กลับมา ให้เป็น true เมื่อ status เป็น 'done' แล้วลบคอลัมน์ status",
    'เมื่อกด "ส่งงาน" ระบบจะรันบนสำเนาใหม่ตามลำดับ: up → ตรวจ → down → ตรวจ → up อีกรอบ → ตรวจ ทั้งสองไฟล์ต้องครอบด้วย BEGIN … COMMIT',
  ],
  files: [
    { name: 'up.sql', initial: '-- เดินหน้า: is_done → status\nBEGIN;\n\n\nCOMMIT;\n' },
    { name: 'down.sql', initial: '-- ถอยกลับ: status → is_done\nBEGIN;\n\n\nCOMMIT;\n' },
  ],
  seed: `
CREATE TABLE orders (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer text NOT NULL,
  is_done boolean NOT NULL DEFAULT false
);
INSERT INTO orders (customer, is_done) VALUES
('Somchai', true), ('Malee', true), ('Anan', false), ('Kanya', true), ('Somchai', false),
('Malee', true), ('Anan', true), ('Kanya', false), ('Somchai', true), ('Malee', false);
`,
  tasks: [
    {
      goal: 'เขียน up.sql และ down.sql ให้ผ่านทั้งสามรอบ แล้วกดส่งงาน',
      skill: 'Reversible migration',
      check: {
        kind: 'script',
        phases: [
          afterUp('รอบแรก'),
          {
            label: 'ถอยกลับ',
            run: 'down.sql',
            mustMatch: transactional('down.sql'),
            tests: [
              { name: 'คอลัมน์ is_done กลับมา', sql: hasColumn('is_done'), expect: ONE(1) },
              { name: 'คอลัมน์ status หายไป', sql: hasColumn('status'), expect: ONE(0) },
              { name: 'ออเดอร์ที่เสร็จแล้วยังเป็น 6 แถว', sql: 'SELECT count(*) FROM orders WHERE is_done', expect: ONE(6) },
              { name: 'ไม่มีแถวหาย (10 แถว)', sql: 'SELECT count(*) FROM orders', expect: ONE(10) },
              { name: 'ออเดอร์ใหม่ได้ is_done เป็น false เอง', sql: "INSERT INTO orders (customer) VALUES ('New') RETURNING is_done", expect: ONE(false) },
            ],
          },
          afterUp('รอบสอง หลังถอยกลับ'),
        ],
      },
      hints: [
        'ลำดับของ up มีสามจังหวะ: เพิ่มของใหม่ → ย้ายข้อมูลเดิมไปของใหม่ (backfill) → ลบของเก่า ส่วน down ทำสามจังหวะเดียวกันในทิศกลับ (manual บทที่ 10)',
        "ALTER TABLE orders ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN (…)) จะเติม 'pending' ให้ทุกแถวเดิมทันที จากนั้น UPDATE เฉพาะแถวที่ is_done เป็น true แล้วค่อย DROP COLUMN",
        "โครง up.sql: BEGIN; ALTER TABLE orders ADD COLUMN status ______; UPDATE orders SET status = 'done' WHERE ______; ALTER TABLE orders DROP COLUMN ______; COMMIT;",
      ],
      solution: { 'up.sql': UP, 'down.sql': DOWN },
    },
  ],
  debrief: [
    'migration ที่ดีมีทางถอย และทั้งทางไปและทางกลับควรสำเร็จทั้งหมดหรือไม่เปลี่ยนอะไรเลย ใน Postgres ทำได้เพราะ ALTER TABLE อยู่ใน transaction ได้',
    "down ของงานนี้เสียข้อมูลบางส่วน: ออเดอร์ที่ 'cancelled' จะกลายเป็น is_done = false ซึ่งแยกไม่ออกจาก 'pending' ทางถอยของจริงจึงมักใช้ได้แค่ช่วงสั้นๆ หลัง deploy ก่อนที่ข้อมูลแบบใหม่จะเข้ามา",
    'ในระบบที่มีผู้ใช้อยู่ตลอด งานนี้จะแบ่งเป็นหลาย deploy: เพิ่มคอลัมน์ใหม่ → ให้แอปเขียนทั้งสองคอลัมน์ → backfill เป็นชุดเล็กๆ → ย้ายการอ่านไปคอลัมน์ใหม่ → เลิกเขียนคอลัมน์เก่า → ลบคอลัมน์เก่า เพราะการลบคอลัมน์ที่แอปเวอร์ชันเก่ายังใช้อยู่จะทำให้แอปพัง',
  ],
};
