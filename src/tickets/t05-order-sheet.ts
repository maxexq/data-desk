import type { Ticket } from './types';

const ONE = (v: number | string) => [[v]];

const SOLUTION = `BEGIN;

CREATE TABLE customers (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL UNIQUE
);

CREATE TABLE items (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  unit_price_baht integer NOT NULL CHECK (unit_price_baht > 0)
);

CREATE TABLE sales (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id),
  item_id integer NOT NULL REFERENCES items (id),
  qty integer NOT NULL CHECK (qty > 0),
  sold_on date NOT NULL
);

INSERT INTO customers (name, phone)
SELECT DISTINCT customer_name, phone FROM order_sheet;

INSERT INTO items (name, unit_price_baht)
SELECT DISTINCT item_name, unit_price FROM order_sheet;

INSERT INTO sales (customer_id, item_id, qty, sold_on)
SELECT c.id, i.id, o.qty, o.sold_on::date
FROM order_sheet AS o
JOIN customers AS c ON c.phone = o.phone
JOIN items AS i ON i.name = o.item_name;

COMMIT;`;

export const t05: Ticket = {
  id: 't05',
  no: 'T-105',
  title: 'สมุดจดออเดอร์ของป้าจันทร์',
  from: 'ป้าจันทร์ · เจ้าของร้าน',
  kind: 'project',
  level: 6,
  skills: ['CREATE TABLE', 'PRIMARY / FOREIGN KEY', 'NOT NULL / UNIQUE / CHECK', 'INSERT … SELECT'],
  xp: 600,
  body: [
    'ป้าจดออเดอร์ลงสเปรดชีตมาตลอด ลูกค้าคนเดิมถูกพิมพ์ชื่อกับเบอร์ซ้ำทุกแถว ราคาก็พิมพ์ซ้ำทุกครั้ง วันก่อนพิมพ์เบอร์ผิดไปแถวหนึ่ง เลยไม่รู้ว่าเป็นลูกค้าคนเดียวกันหรือเปล่า ช่วยทำให้เป็นระบบหน่อยนะลูก',
    'สเปรดชีตถูกนำเข้ามาเป็นตาราง order_sheet แล้ว เขียนสคริปต์ในแท็บ schema.sql ที่สร้างตารางใหม่ 3 ตารางตามสเปกด้านล่าง แล้วย้ายข้อมูลจาก order_sheet เข้าไปให้ครบ (ไม่ต้องลบ order_sheet)',
    'customers: id, name, phone (ห้ามว่างทั้งคู่ และเบอร์โทรห้ามซ้ำ)',
    'items: id, name (ห้ามซ้ำ), unit_price_baht เป็นจำนวนเต็มที่มากกว่า 0',
    'sales: id, customer_id และ item_id ที่อ้างถึงสองตารางแรก, qty มากกว่า 0, sold_on เป็นชนิด date (ทุกคอลัมน์ห้ามว่าง)',
    'id ของทุกตารางให้ฐานข้อมูลสร้างให้เอง เมื่อกด "ส่งงาน" ระบบจะรัน schema.sql บนสำเนาใหม่ของข้อมูลตั้งต้น แล้วทดสอบทั้งข้อมูลและกฎของตาราง ระหว่างทำ ลองรันใน workspace ได้ และกด Reset data เมื่ออยากเริ่มใหม่',
  ],
  files: [{ name: 'schema.sql', initial: '-- สร้างตาราง customers, items, sales แล้วย้ายข้อมูลจาก order_sheet\n' }],
  seed: `
CREATE TABLE order_sheet (
  row_no integer PRIMARY KEY,
  customer_name text,
  phone text,
  item_name text,
  unit_price integer,
  qty integer,
  sold_on text
);
INSERT INTO order_sheet VALUES
(1,'Somchai','081-111-1111','Mango Sticky Rice',80,2,'2026-11-01'),
(2,'Somchai','081-111-1111','Thai Tea',45,1,'2026-11-01'),
(3,'Malee','082-222-2222','Coconut Ice Cream',60,3,'2026-11-01'),
(4,'Anan','083-333-3333','Mango Sticky Rice',80,1,'2026-11-02'),
(5,'Kanya','084-444-4444','Pandan Jelly',35,4,'2026-11-02'),
(6,'Malee','082-222-2222','Thai Tea',45,2,'2026-11-02'),
(7,'Somchai','081-111-1111','Mango Sticky Rice',80,1,'2026-11-03'),
(8,'Anan','083-333-3333','Coconut Ice Cream',60,2,'2026-11-03'),
(9,'Kanya','084-444-4444','Mango Sticky Rice',80,2,'2026-11-03'),
(10,'Malee','082-222-2222','Pandan Jelly',35,1,'2026-11-04'),
(11,'Anan','083-333-3333','Thai Tea',45,3,'2026-11-04'),
(12,'Somchai','081-111-1111','Coconut Ice Cream',60,1,'2026-11-04');
`,
  tasks: [
    {
      goal: 'เขียน schema.sql ให้สร้างตารางตามสเปกและย้ายข้อมูลครบ แล้วกดส่งงาน',
      skill: 'Schema design',
      check: {
        kind: 'script',
        phases: [
          {
            label: '',
            run: 'schema.sql',
            tests: [
              { name: 'มีลูกค้า 4 คน ไม่ซ้ำ', sql: 'SELECT count(*) FROM customers', expect: ONE(4) },
              { name: 'มีสินค้า 4 รายการ ไม่ซ้ำ', sql: 'SELECT count(*) FROM items', expect: ONE(4) },
              { name: 'ย้ายรายการขายครบ 12 แถว', sql: 'SELECT count(*) FROM sales', expect: ONE(12) },
              {
                name: 'ยอดขายรวมเท่ากับในสมุด (1,285 บาท)',
                sql: 'SELECT sum(s.qty * i.unit_price_baht) FROM sales s JOIN items i ON i.id = s.item_id',
                expect: ONE(1285),
              },
              {
                name: 'Somchai มี 4 รายการ (เชื่อมลูกค้าถูกคน)',
                sql: "SELECT count(*) FROM sales s JOIN customers c ON c.id = s.customer_id WHERE c.name = 'Somchai'",
                expect: ONE(4),
              },
              {
                name: 'sold_on เป็นชนิด date',
                sql: "SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'sales' AND column_name = 'sold_on'",
                expect: ONE('date'),
              },
              { name: 'เพิ่มลูกค้าใหม่ได้โดยไม่ต้องใส่ id', sql: "INSERT INTO customers (name, phone) VALUES ('New', '089-999-9999')", expect: 'ok' },
              { name: 'เบอร์โทรซ้ำถูกปฏิเสธ', sql: "INSERT INTO customers (name, phone) SELECT 'Dup', phone FROM customers LIMIT 1", expect: { error: '23505' } },
              { name: 'ลูกค้าไม่มีชื่อถูกปฏิเสธ', sql: "INSERT INTO customers (name, phone) VALUES (NULL, '080-000-0000')", expect: { error: '23502' } },
              { name: 'ราคา 0 หรือติดลบถูกปฏิเสธ', sql: "INSERT INTO items (name, unit_price_baht) VALUES ('Free Lunch', 0)", expect: { error: '23514' } },
              {
                name: 'ขายให้ลูกค้าที่ไม่มีอยู่จริงถูกปฏิเสธ',
                sql: "INSERT INTO sales (customer_id, item_id, qty, sold_on) SELECT 999999, id, 1, DATE '2026-11-05' FROM items LIMIT 1",
                expect: { error: '23503' },
              },
              {
                name: 'จำนวน 0 ชิ้นถูกปฏิเสธ',
                sql: "INSERT INTO sales (customer_id, item_id, qty, sold_on) SELECT c.id, i.id, 0, DATE '2026-11-05' FROM customers c, items i LIMIT 1",
                expect: { error: '23514' },
              },
            ],
          },
        ],
      },
      hints: [
        'เริ่มจากถามว่า "ของ" ในสมุดมีกี่ชนิด: ลูกค้า สินค้า และการขาย แต่ละชนิดเป็นหนึ่งตาราง ข้อมูลของลูกค้าเก็บครั้งเดียวในตาราง customers แล้วให้ sales อ้างถึงด้วย customer_id (manual บทที่ 9)',
        'id ที่สร้างเอง: integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY กฎอื่นเขียนต่อท้ายคอลัมน์: NOT NULL, UNIQUE, CHECK (qty > 0), REFERENCES customers (id) ส่วนการย้ายข้อมูลใช้ INSERT INTO … SELECT DISTINCT … FROM order_sheet',
        'ลำดับ: สร้าง customers และ items ก่อน แล้วเติมข้อมูลด้วย SELECT DISTINCT จากนั้นเติม sales ด้วยการ JOIN order_sheet กับ customers (ด้วย phone) และ items (ด้วย name) เพื่อหา id และแปลงวันที่ด้วย sold_on::date',
      ],
      solution: { 'schema.sql': SOLUTION },
    },
  ],
  debrief: [
    'เมื่อข้อเท็จจริงหนึ่งอย่างถูกเก็บที่เดียว การแก้ไขก็ทำที่เดียว เบอร์ของลูกค้าจะไม่มีทางไม่ตรงกันระหว่างแถวอีก',
    'constraint คือการให้ฐานข้อมูลช่วยเฝ้ากฎแทนเรา: NOT NULL, UNIQUE, CHECK และ FOREIGN KEY ปฏิเสธข้อมูลผิดตั้งแต่ตอนบันทึก ไม่ว่าจะมาจากแอปไหนหรือจากคนพิมพ์ SQL เอง',
    'การครอบทั้งสคริปต์ด้วย BEGIN … COMMIT ทำให้ถ้าขั้นใดพลาด จะไม่มีตารางครึ่งๆ กลางๆ ค้างอยู่ ใน Postgres คำสั่งสร้างและแก้ตารางก็ ROLLBACK ได้',
  ],
  reply: { from: 'ป้าจันทร์ · เจ้าของร้าน', body: [
    'ขอบใจมากนะ ทีนี้ป้าไม่ต้องแก้เบอร์ลูกค้าคนเดียวซ้ำหลายบรรทัดแล้ว ข้อมูลเดิมก็ยังอยู่ครบ',
    'ป้าถาม Non ไปด้วยว่าออเดอร์ที่ยกเลิกควรเก็บยังไง เขากำลังแก้ระบบอยู่ ฝากไปช่วยดู T-106 หน่อยนะ',
  ] },
};
