import { memo, useState, type ReactNode } from 'react';
import { useGame } from '../state/game';
import { Icon } from '../ui/icons';
import { openApp } from '../ui/open';
import { SqlCode } from '../ui/SqlCode';

// Every rule below is paraphrased from the references in SOURCES, not invented for the game.
const PG = 'https://www.postgresql.org/docs/18/';
const SOURCES = {
  tableExpr: { label: 'PostgreSQL — Table Expressions (FROM, JOIN, WHERE, GROUP BY)', url: `${PG}queries-table-expressions.html` },
  comparison: { label: 'PostgreSQL — Comparison Functions and Operators', url: `${PG}functions-comparison.html` },
  matching: { label: 'PostgreSQL — Pattern Matching (LIKE, ILIKE)', url: `${PG}functions-matching.html` },
  order: { label: 'PostgreSQL — Sorting Rows (ORDER BY)', url: `${PG}queries-order.html` },
  agg: { label: 'PostgreSQL Tutorial — Aggregate Functions', url: `${PG}tutorial-agg.html` },
  window: { label: 'PostgreSQL Tutorial — Window Functions', url: `${PG}tutorial-window.html` },
  txn: { label: 'PostgreSQL Tutorial — Transactions', url: `${PG}tutorial-transactions.html` },
  constraints: { label: 'PostgreSQL — Constraints', url: `${PG}ddl-constraints.html` },
  alter: { label: 'PostgreSQL — ALTER TABLE', url: `${PG}sql-altertable.html` },
  explain: { label: 'PostgreSQL — Using EXPLAIN', url: `${PG}using-explain.html` },
  explainCmd: { label: 'PostgreSQL — EXPLAIN (ตัวเลือก BUFFERS)', url: `${PG}sql-explain.html` },
  pageLayout: { label: 'PostgreSQL — Database Page Layout', url: `${PG}storage-page-layout.html` },
  indexOnly: { label: 'PostgreSQL — Index-Only Scans and Covering Indexes', url: `${PG}indexes-index-only-scans.html` },
  exprIndex: { label: 'PostgreSQL — Indexes on Expressions', url: `${PG}indexes-expressional.html` },
  uuid: { label: 'PostgreSQL — UUID Functions (uuidv7)', url: `${PG}functions-uuid.html` },
  noOffset: { label: 'Markus Winand — We need tool support for keyset pagination (Use The Index, Luke)', url: 'https://use-the-index-luke.com/no-offset' },
  strong: { label: 'Strong Migrations — README (ankane/strong_migrations)', url: 'https://www.rubydoc.info/gems/strong_migrations/2.0.1' },
  holywell: { label: 'SQL Style Guide โดย Simon Holywell (CC BY-SA 4.0)', url: 'https://www.sqlstyle.guide/' },
  mozilla: { label: 'Mozilla Data Docs — SQL Style Guide', url: 'https://docs.telemetry.mozilla.org/concepts/sql_style' },
} as const;

interface Chapter {
  tab: string;
  title: string;
  lead: string;
  points: ReactNode[];
  code: string;
  note?: string;
  sources: (keyof typeof SOURCES)[];
}

const C = ({ children }: { children: string }) => <code>{children}</code>;

const CHAPTERS: Chapter[] = [
  {
    tab: '1 · SELECT',
    title: 'บทที่ 1: SELECT … FROM — ขอดูข้อมูลจากตาราง',
    lead: 'ทุกคำค้นบอกสองอย่าง: อยากดูคอลัมน์ไหน (SELECT) จากตารางไหน (FROM)',
    points: [
      <>
        <C>*</C> แปลว่าทุกคอลัมน์ เหมาะกับการสำรวจตารางครั้งแรก เมื่อรู้ว่าต้องการอะไรแล้วให้เขียนชื่อคอลัมน์เอง บรรทัดละคอลัมน์
      </>,
      <>
        ตั้งชื่อใหม่ให้คอลัมน์ในผลลัพธ์ด้วย <C>AS</C>
      </>,
      <>
        ให้คิดเป็นสายพาน: เริ่มจากตารางใน FROM แล้ว WHERE, GROUP BY, HAVING แปลงตารางนั้นต่อกันเป็นทอดๆ ก่อนที่ SELECT จะเลือกคอลัมน์
        แม้จะเขียน SELECT ก่อน แต่ให้อ่านจาก FROM
      </>,
    ],
    code: `SELECT
  name,
  role AS job
FROM
  suspects;`,
    sources: ['tableExpr', 'mozilla'],
  },
  {
    tab: '2 · WHERE',
    title: 'บทที่ 2: WHERE — เก็บเฉพาะแถวที่เงื่อนไขเป็นจริง',
    lead: 'WHERE ถูกตรวจกับทุกแถว แถวที่ได้ผลเป็นจริงเท่านั้นที่ผ่าน',
    points: [
      <>
        ข้อความต้องอยู่ใน single quote <C>'Lobby'</C> ส่วน double quote <C>"Lobby"</C> ใน Postgres หมายถึงชื่อคอลัมน์หรือตาราง
      </>,
      <>
        <C>x BETWEEN a AND b</C> รวมปลายทั้งสองข้าง มีค่าเท่ากับ <C>{'x >= a AND x <= b'}</C>
      </>,
      <>
        <C>x IN ('a', 'b')</C> ใช้แทน OR หลายๆ ตัว
      </>,
      <>
        <C>LIKE</C> ค้นแบบบางส่วน: <C>%</C> แทนตัวอักษรกี่ตัวก็ได้ <C>_</C> แทนหนึ่งตัว ใน Postgres <C>LIKE</C> แยกตัวพิมพ์เล็กใหญ่
        ถ้าไม่อยากแยกให้ใช้ <C>ILIKE</C> (เป็นของ Postgres เอง ไม่อยู่ในมาตรฐาน SQL)
      </>,
      <>
        เก็บวันและเวลาด้วยชนิด <C>date</C> / <C>timestamp</C> และเขียนค่าแบบ ISO 8601 (<C>'2026-11-01'</C>) ticket แรกเก็บเวลาเป็นข้อความ
        HH:MM ซึ่งเทียบก่อนหลังได้เพราะมีเลขศูนย์นำหน้าครบ แต่คำนวณช่วงเวลาไม่ได้
      </>,
    ],
    code: `SELECT
  *
FROM
  door_logs
WHERE
  door IN ('Cafeteria', 'Lobby')
  AND time BETWEEN '12:00' AND '13:00';`,
    sources: ['comparison', 'matching', 'holywell'],
  },
  {
    tab: '3 · ORDER BY',
    title: 'บทที่ 3: ORDER BY และ LIMIT — เรียงและตัดผลลัพธ์',
    lead: 'ถ้าไม่เขียน ORDER BY ลำดับของแถวที่ได้ "ไม่ถูกกำหนด" ขึ้นกับแผนการทำงานและตำแหน่งบนดิสก์ อย่าเชื่อลำดับที่บังเอิญเห็น',
    points: [
      <>
        เรียงจากน้อยไปมาก (<C>ASC</C>) เป็นค่าเริ่มต้น ใส่ <C>DESC</C> เพื่อกลับด้าน เรียงหลายคอลัมน์ได้ คอลัมน์ถัดไปใช้ตัดสินเมื่อคอลัมน์ก่อนหน้าเท่ากัน
      </>,
      <>
        Postgres ถือว่า <C>NULL</C> ใหญ่กว่าทุกค่า จึงอยู่ท้ายสุดเมื่อเรียง ASC และอยู่หน้าสุดเมื่อเรียง DESC เปลี่ยนได้ด้วย{' '}
        <C>NULLS FIRST</C> / <C>NULLS LAST</C> (ฐานข้อมูลบางตัวทำกลับกัน จึงควรเขียนให้ชัดเมื่อมี NULL)
      </>,
      <>
        <C>LIMIT n</C> เอาไม่เกิน n แถว เพราะลำดับไม่ถูกกำหนดถ้าไม่มี ORDER BY การใช้ LIMIT โดยไม่เรียงจึงได้แถวที่คาดเดาไม่ได้
      </>,
    ],
    code: `SELECT
  ordered_on,
  total_baht
FROM
  orders
ORDER BY
  total_baht DESC,
  ordered_on
LIMIT
  5;`,
    sources: ['order'],
  },
  {
    tab: '4 · JOIN',
    title: 'บทที่ 4: JOIN — เอาสองตารางมาต่อกัน',
    lead: 'JOIN จับคู่แถวของตารางซ้ายกับแถวของตารางขวา โดย ON บอกว่าคู่ไหนถือว่า "ตรงกัน"',
    points: [
      <>
        <C>JOIN</C> เฉยๆ คือ <C>INNER JOIN</C>: ได้เฉพาะคู่ที่ตรงเงื่อนไข ส่วนการคั่นตารางด้วยจุลภาคโดยไม่มีเงื่อนไขจะได้ทุกคู่ที่เป็นไปได้ (N × M แถว)
      </>,
      <>
        <C>LEFT JOIN</C> ทำ inner join ก่อน แล้วเติมแถวของตารางซ้ายที่ไม่มีคู่กลับเข้ามา โดยคอลัมน์ของตารางขวาเป็น NULL ใช้หา "สิ่งที่ไม่มี" ได้
      </>,
      <>
        ใน LEFT JOIN เงื่อนไขที่อยู่ใน <C>ON</C> กับที่อยู่ใน <C>WHERE</C> ให้ผลต่างกัน: ON ตัดสินว่าจับคู่ได้ไหม ส่วน WHERE
        กรองหลังจับคู่แล้ว และอาจทิ้งแถวที่ถูกเติม NULL ไปด้วย
      </>,
      <>
        เขียนชนิดของ JOIN ให้ชัดและไม่ใช้จุลภาค ตั้งชื่อย่อตารางด้วย <C>AS</C> แล้วนำหน้าคอลัมน์ด้วยชื่อย่อ (<C>s.name</C>)
        จำเป็นเมื่อสองตารางมีคอลัมน์ชื่อเดียวกัน
      </>,
    ],
    code: `SELECT
  b.name,
  o.total_baht
FROM
  branches AS b
  LEFT JOIN orders AS o
    ON o.branch_id = b.id
    AND o.status = 'refunded'
WHERE
  o.id IS NULL;`,
    note: 'ตัวอย่างนี้หาสาขาที่ไม่มี refund เลย (ตารางจาก T-102)',
    sources: ['tableExpr', 'mozilla', 'holywell'],
  },
  {
    tab: '5 · NULL',
    title: 'บทที่ 5: NULL — ค่าที่ "ไม่รู้"',
    lead: 'NULL ไม่ใช่ศูนย์และไม่ใช่ข้อความว่าง มันแปลว่าไม่มีข้อมูล',
    points: [
      <>
        การเทียบปกติให้ผลเป็น NULL (ไม่รู้) เมื่อฝั่งใดฝั่งหนึ่งเป็น NULL ดังนั้น <C>WHERE x = NULL</C> จะไม่ตรงกับแถวไหนเลย ใช้{' '}
        <C>IS NULL</C> / <C>IS NOT NULL</C> แทน
      </>,
      <>
        ถ้าอยากเทียบสองค่าโดยนับ NULL เป็นค่าหนึ่ง ใช้ <C>IS DISTINCT FROM</C> ซึ่งให้ผลจริงหรือเท็จเสมอ
      </>,
      <>
        <C>CHECK</C> ถือว่าผ่านเมื่อเงื่อนไขเป็นจริง "หรือ NULL" จึงกัน NULL ไม่ได้ ต้องใช้ <C>NOT NULL</C> คู่กัน
      </>,
      <>
        <C>UNIQUE</C> ยอมให้มี NULL หลายแถวได้ เพราะ NULL สองตัวไม่ถือว่าเท่ากัน
      </>,
    ],
    code: `SELECT
  badge_id,
  statement
FROM
  statements
WHERE
  left_building_at IS NULL;`,
    sources: ['comparison', 'constraints'],
  },
  {
    tab: '6 · GROUP BY',
    title: 'บทที่ 6: GROUP BY — สรุปหลายแถวเป็นตัวเลขเดียว',
    lead: 'ฟังก์ชันสรุป (COUNT, SUM, AVG, MIN, MAX) คำนวณผลเดียวจากหลายแถว และ GROUP BY แบ่งแถวเป็นกลุ่มเพื่อให้ได้ผลสรุปกลุ่มละแถว',
    points: [
      <>คอลัมน์ใน SELECT ที่ไม่ได้อยู่ในฟังก์ชันสรุป ต้องอยู่ใน GROUP BY ด้วย</>,
      <>
        <C>WHERE</C> เลือกแถว "ก่อน" จัดกลุ่ม จึงใช้ฟังก์ชันสรุปใน WHERE ไม่ได้ ส่วน <C>HAVING</C> เลือกกลุ่ม "หลัง" สรุปเสร็จ
      </>,
      <>
        เงื่อนไขที่ไม่ต้องใช้ผลสรุปให้ใส่ใน WHERE เพราะฐานข้อมูลไม่ต้องจัดกลุ่มและคำนวณแถวที่จะถูกทิ้ง
      </>,
    ],
    code: `SELECT
  b.name,
  COUNT(*) AS refunds
FROM
  orders AS o
  JOIN branches AS b
    ON b.id = o.branch_id
WHERE
  o.status = 'refunded'
GROUP BY
  b.name
HAVING
  COUNT(*) >= 3;`,
    sources: ['agg', 'tableExpr'],
  },
  {
    tab: '7 · Window',
    title: 'บทที่ 7: WITH และ window function',
    lead: 'window function คำนวณข้ามแถวที่เกี่ยวข้องกับแถวปัจจุบัน คล้ายฟังก์ชันสรุป แต่แถวไม่ถูกยุบรวม ทุกแถวยังอยู่ครบ',
    points: [
      <>
        สิ่งที่ทำให้เป็น window function คือ <C>OVER (…)</C> ต่อท้าย: <C>PARTITION BY</C> แบ่งแถวเป็นกลุ่ม และ <C>ORDER BY</C>{' '}
        ข้างในกำหนดลำดับที่ใช้คำนวณ
      </>,
      <>
        ใช้ได้เฉพาะใน SELECT และ ORDER BY เพราะถูกคำนวณหลัง WHERE, GROUP BY และ HAVING ถ้าจะกรองด้วยผลของมัน
        ต้องคำนวณในชั้นหนึ่งแล้วกรองในชั้นถัดไป
      </>,
      <>
        <C>WITH ชื่อ AS (…)</C> ตั้งชื่อให้ query ย่อย แล้วใช้ชื่อนั้นเหมือนตารางใน query ถัดไป ทำให้แบ่งงานเป็นขั้นและอ่านจากบนลงล่างได้
      </>,
    ],
    code: `WITH ranked AS (
  SELECT
    staff_id,
    amount_baht,
    RANK() OVER (
      PARTITION BY staff_id
      ORDER BY amount_baht DESC
    ) AS rk
  FROM
    sales
)
SELECT
  staff_id,
  amount_baht
FROM
  ranked
WHERE
  rk = 1;`,
    note: 'ยอดขายครั้งที่สูงที่สุดของแต่ละคน (ตารางจาก T-103)',
    sources: ['window'],
  },
  {
    tab: '8 · Transaction',
    title: 'บทที่ 8: Transaction — ได้ทั้งหมดหรือไม่ได้เลย',
    lead: 'transaction มัดหลายขั้นเป็นงานเดียว ถ้าขั้นใดล้มเหลว ขั้นที่ทำไปแล้วจะไม่มีผลกับฐานข้อมูลเลย',
    points: [
      <>
        <C>BEGIN</C> เริ่ม, <C>COMMIT</C> บันทึกถาวรและให้คนอื่นเห็น, <C>ROLLBACK</C> ยกเลิกทุกอย่างตั้งแต่ BEGIN
      </>,
      <>transaction อื่นจะไม่เห็นการเปลี่ยนแปลงที่ยังไม่ COMMIT และเมื่อ COMMIT จะเห็นทั้งหมดพร้อมกัน</>,
      <>
        ถ้าไม่พิมพ์ BEGIN แต่ละคำสั่งจะถูกครอบด้วย BEGIN/COMMIT ของตัวเองโดยอัตโนมัติ <C>UPDATE</C> ที่ลืม WHERE จึงแก้คืนไม่ได้
      </>,
      <>
        หลังมี error ใน transaction คำสั่งถัดไปจะถูกปฏิเสธทั้งหมด ทางออกคือ ROLLBACK หรือถอยไปที่ <C>SAVEPOINT</C> ที่ตั้งไว้ก่อนหน้าด้วย{' '}
        <C>ROLLBACK TO</C>
      </>,
      <>นิสัยที่ดีเมื่อแก้ข้อมูลจริง: BEGIN → แก้ → SELECT ตรวจว่าเปลี่ยนเฉพาะแถวที่ตั้งใจ → COMMIT หรือ ROLLBACK</>,
    ],
    code: `BEGIN;

UPDATE stock
SET qty = qty - 30
WHERE branch = 'Siam' AND item = 'mango';

UPDATE stock
SET qty = qty + 30
WHERE branch = 'Ari' AND item = 'mango';

COMMIT;`,
    sources: ['txn'],
  },
  {
    tab: '9 · Design',
    title: 'บทที่ 9: ออกแบบตารางและ constraint',
    lead: 'เก็บข้อเท็จจริงหนึ่งอย่างไว้ที่เดียว แล้วให้ตารางอื่นอ้างถึง จากนั้นให้ฐานข้อมูลเฝ้ากฎแทนเราด้วย constraint',
    points: [
      <>
        <C>PRIMARY KEY</C> คือ UNIQUE + NOT NULL ใช้ระบุแถว ตารางหนึ่งมีได้อันเดียว และเอกสาร Postgres แนะนำให้ทุกตารางมี
      </>,
      <>
        <C>NOT NULL</C>: เอกสารแนะนำว่าในการออกแบบส่วนใหญ่ คอลัมน์ส่วนมากควรเป็น NOT NULL
      </>,
      <>
        <C>FOREIGN KEY</C> (<C>REFERENCES</C>) บังคับว่าค่าที่อ้างถึงต้องมีอยู่จริงในอีกตาราง กำหนดได้ว่าจะเกิดอะไรเมื่อแถวที่ถูกอ้างถึงถูกลบ:
        ห้ามลบ (ค่าเริ่มต้น), <C>ON DELETE CASCADE</C> ลบตาม หรือ <C>SET NULL</C>
      </>,
      <>
        Postgres ไม่สร้าง index ให้คอลัมน์ที่เป็น foreign key เอง (ฝั่งที่ถูกอ้างถึงมี index อยู่แล้ว) ถ้า JOIN หรือลบจากตารางแม่บ่อย ควรสร้างเอง
      </>,
      <>
        <C>CHECK</C> ใช้กับกฎของค่าในแถวเดียว เช่น <C>{'qty > 0'}</C> และตั้งชื่อ constraint ได้ด้วย <C>CONSTRAINT ชื่อ</C> เพื่อให้ข้อความ
        error อ่านรู้เรื่องและแก้ภายหลังได้ง่าย
      </>,
    ],
    code: `CREATE TABLE sales (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id),
  qty integer NOT NULL CONSTRAINT qty_positive CHECK (qty > 0),
  sold_on date NOT NULL
);`,
    sources: ['constraints', 'holywell'],
  },
  {
    tab: '10 · Migration',
    title: 'บทที่ 10: Migration — เปลี่ยนตารางที่มีข้อมูลอยู่',
    lead: 'การเปลี่ยน schema บนระบบจริงมีความเสี่ยงสองแบบ: ล็อกตารางนานจนแอปค้าง และทำให้แอปเวอร์ชันที่ยังรันอยู่พัง',
    points: [
      <>
        <C>ALTER TABLE</C> ส่วนใหญ่ถือล็อกที่กันทั้งการอ่านและเขียน (ACCESS EXCLUSIVE) คำถามจึงเป็น "ถือนานแค่ไหน"
      </>,
      <>
        เร็ว: <C>ADD COLUMN</C> ที่มี DEFAULT เป็นค่าคงที่ (ไม่เขียนตารางใหม่) ช้า: เปลี่ยนชนิดคอลัมน์ (มักเขียนใหม่ทั้งตาราง) และ{' '}
        <C>SET NOT NULL</C> (ต้องอ่านทั้งตารางเพื่อตรวจ)
      </>,
      <>
        constraint บนตารางใหญ่: เพิ่มแบบ <C>NOT VALID</C> ก่อน (มีผลกับแถวใหม่ทันที ไม่ตรวจแถวเก่า) แล้ว <C>VALIDATE CONSTRAINT</C>{' '}
        ทีหลัง ซึ่งใช้ล็อกที่เบากว่า
      </>,
      <>
        เปลี่ยนชื่อหรือชนิดคอลัมน์โดยแอปไม่พัง ทำแบบขยายแล้วหด: เพิ่มคอลัมน์ใหม่ → เขียนทั้งสองคอลัมน์ → backfill ข้อมูลเก่า → ย้ายการอ่าน →
        เลิกเขียนคอลัมน์เก่า → ลบคอลัมน์เก่า
      </>,
      <>backfill ตารางใหญ่เป็นชุดเล็กๆ แยกจาก transaction ที่แก้ schema เพราะ transaction ยาวจะถือล็อกไว้ตลอด</>,
      <>
        ทุก migration ควรมีทางถอย (down) และใน Postgres ครอบคำสั่งแก้ schema ด้วย BEGIN … COMMIT ได้ ถ้าขั้นใดพลาดจะไม่เหลือสภาพครึ่งๆ
        กลางๆ
      </>,
    ],
    code: `-- 1) มีผลกับแถวใหม่ทันที ไม่ตรวจแถวเก่า
ALTER TABLE orders
  ADD CONSTRAINT orders_total_positive
  CHECK (total_baht > 0) NOT VALID;

-- 2) ตรวจแถวเก่าทีหลัง ด้วยล็อกที่เบากว่า
ALTER TABLE orders
  VALIDATE CONSTRAINT orders_total_positive;`,
    note: 'ในเกม ตารางเล็กและไม่มีผู้ใช้อื่น T-106 จึงทำในขั้นเดียวได้ กฎข้างบนคือสิ่งที่ต้องคิดเมื่อตารางใหญ่และแอปรันอยู่',
    sources: ['alter', 'strong'],
  },
  {
    tab: '11 · Index',
    title: 'บทที่ 11: EXPLAIN และ index',
    lead: 'ก่อนแก้ query ที่ช้า ให้ดูก่อนว่าฐานข้อมูลตั้งใจจะทำอะไร EXPLAIN แสดงแผนนั้นโดยไม่รัน query จริง',
    points: [
      <>
        แผนเป็นต้นไม้ อ่านจากบรรทัดในสุดขึ้นมา <C>Seq Scan</C> คืออ่านทุกแถว <C>Index Scan</C> คือกระโดดไปหาแถวผ่าน index และ{' '}
        <C>Bitmap Heap Scan</C> คือใช้ index รวบรวมตำแหน่งก่อนแล้วค่อยอ่านเป็นชุด
      </>,
      <>
        ตัวเลขในวงเล็บคือค่าประมาณ: cost เริ่มต้น..cost รวม, จำนวนแถวที่คาด และความกว้างของแถว หน่วยของ cost ไม่ใช่เวลา ใช้เทียบระหว่างแผน
      </>,
      <>
        <C>EXPLAIN ANALYZE</C> รัน query จริงแล้วแสดงเวลาจริง ถ้าเป็นคำสั่งแก้ข้อมูล ให้ครอบด้วย BEGIN … ROLLBACK
      </>,
      <>index ที่เรียงตรงกับ ORDER BY ทำให้ไม่ต้องเรียงซ้ำ index หลายคอลัมน์จึงควรเรียงคอลัมน์ตามที่ query ใช้: คอลัมน์ที่กรองด้วย = ก่อน แล้วตามด้วยคอลัมน์ที่เรียง</>,
      <>
        บนตารางเล็ก ฐานข้อมูลจะเลือก Seq Scan แม้มี index เพราะเร็วกว่า ผลจากตารางทดสอบเล็กๆ จึงใช้ทำนายตารางจริงไม่ได้ และแผนขึ้นกับสถิติจาก{' '}
        <C>ANALYZE</C>
      </>,
      <>
        บนระบบที่มีคนใช้อยู่ การสร้าง index แบบปกติกันการเขียนตารางระหว่างสร้าง จึงนิยมใช้ <C>CREATE INDEX CONCURRENTLY</C>
      </>,
    ],
    code: `EXPLAIN
SELECT
  *
FROM
  orders
WHERE
  customer_id = 4242
ORDER BY
  ordered_at DESC
LIMIT
  20;`,
    sources: ['explain', 'strong', 'constraints'],
  },
  {
    tab: '12 · Pages',
    title: 'บทที่ 12: Page — วัดว่า query อ่านเยอะแค่ไหน',
    lead: 'ฐานข้อมูลไม่ได้อ่านทีละแถว มันอ่านทีละ page ขนาด 8 KB จำนวน page ที่อ่านจึงเป็นตัวเลขที่บอกว่า query ทำงานหนักแค่ไหน ช่อง pages ใต้ SQL Console แสดงตัวเลขนี้ทุกครั้งที่รัน SELECT',
    points: [
      <>
        ตารางและ index ถูกเก็บเป็น page ละ 8 KB แถวยิ่งกว้าง 1 page ยิ่งเก็บได้น้อยแถว ตัวเลขในเกมมาจาก <C>EXPLAIN (ANALYZE, BUFFERS)</C>{' '}
        คือจำนวน page ที่แตะทั้งที่อยู่ใน memory แล้ว (hit) และที่ต้องอ่านเพิ่ม (read)
      </>,
      <>
        <C>OFFSET 40000</C> ไม่ได้กระโดด ฐานข้อมูลต้องอ่านแล้วทิ้ง 40,000 แถวก่อน หน้าลึกจึงช้า ทางแก้คือ keyset pagination: จำค่าของแถวสุดท้าย แล้ว{' '}
        <C>{'WHERE (created_at, id) < (…)'}</C> ให้ index พาไปตรงนั้น และต้องมีคอลัมน์ที่ไม่ซ้ำ (เช่น id) เป็นตัวตัดสินท้ายสุด
      </>,
      <>
        index เก็บค่าของคอลัมน์ตามที่เป็น ถ้าเขียน <C>created_at::date = …</C> หรือ <C>lower(email) = …</C> ฐานข้อมูลต้องคำนวณทุกแถวก่อน ให้เขียนเป็นช่วง{' '}
        <C>{'created_at >= … AND created_at < …'}</C> หรือสร้าง index บน expression นั้นตรงๆ
      </>,
      <>
        index ปกติบอกแค่ว่าแถวอยู่ไหน แล้วต้องไปเปิด page ของตารางทีละแถว ถ้าใส่คอลัมน์ที่ query ใช้ไว้ใน index ด้วย <C>INCLUDE (…)</C> จะได้{' '}
        <C>Index Only Scan</C> ซึ่งต้องมี visibility map ที่ <C>VACUUM</C> อัปเดตไว้
      </>,
      <>
        UUID สุ่ม (<C>gen_random_uuid()</C>) ทำให้แถวใหม่ไปแทรกกลาง index แบบสุ่มจน page แตกบ่อย <C>uuidv7()</C> (PostgreSQL 18)
        ขึ้นต้นด้วยเวลา แถวใหม่จึงต่อท้าย index เหมือนเลขเรียง
      </>,
      <>index ทุกตัวมีราคา: ใช้พื้นที่ และทำให้ INSERT / UPDATE ช้าลง สร้างเฉพาะที่มี query ใช้จริง แล้ววัดผลด้วยตัวเลข pages ก่อนและหลัง</>,
    ],
    code: `-- ช้าขึ้นเรื่อยๆ ตามความลึกของหน้า
SELECT id, created_at, title FROM posts
ORDER BY created_at DESC, id DESC
OFFSET 40000 LIMIT 20;

-- เร็วเท่ากันทุกหน้า (ใช้ค่าของแถวสุดท้ายในหน้าที่แล้ว)
SELECT id, created_at, title FROM posts
WHERE (created_at, id) < ('2026-01-01 01:51:07', 20002)
ORDER BY created_at DESC, id DESC
LIMIT 20;`,
    note: 'ลองรันทั้งสองแบบใน T-108 แล้วเทียบตัวเลขในช่อง pages',
    sources: ['pageLayout', 'explainCmd', 'noOffset', 'exprIndex', 'indexOnly', 'uuid'],
  },
  {
    tab: '13 · Style',
    title: 'บทที่ 13: เขียนให้คนอ่านออก',
    lead: 'ฐานข้อมูลไม่สนว่าเราจัดบรรทัดยังไง แต่คนที่อ่าน query ต่อ (รวมถึงตัวเราในอีกสัปดาห์) สน',
    points: [
      <>
        เขียนคำสงวนเป็นตัวพิมพ์ใหญ่ ชื่อตารางและคอลัมน์เป็นตัวพิมพ์เล็กแบบ <C>snake_case</C> editor ในเกมทำตัวพิมพ์ใหญ่ให้เองขณะพิมพ์
      </>,
      <>ให้คำหลักของแต่ละส่วน (SELECT, FROM, WHERE, ORDER BY) อยู่บรรทัดของตัวเอง ชิดซ้ายตรงกัน แล้วย่อหน้าเนื้อหาเข้าไปหนึ่งระดับ และขึ้นบรรทัดใหม่ก่อน AND / OR</>,
      <>เมื่อเลือกหลายคอลัมน์ ให้เขียนบรรทัดละคอลัมน์ จุลภาคอยู่ท้ายบรรทัด</>,
      <>
        ใส่ <C>AS</C> ทุกครั้งที่ตั้งชื่อย่อ และตั้งชื่อย่อให้สื่อถึงของจริง เช่น อักษรตัวแรกของชื่อตาราง
      </>,
      <>
        บอกชนิดของ JOIN ให้ชัด และวาง <C>ON</C> ไว้บรรทัดถัดไปโดยย่อหน้าเข้า
      </>,
      <>
        style guide สองฉบับนี้เห็นต่างกันเรื่องการจัดแนว แต่ย้ำตรงกันว่าสิ่งสำคัญคือเลือกแบบเดียวแล้วใช้ให้สม่ำเสมอ ปุ่ม Format
        ในเกมจัดแบบชิดซ้ายตามแนวของ Mozilla
      </>,
    ],
    code: `-- อ่านยาก
select s.name,d.time from door_logs d,suspects s where s.badge_id=d.badge_id and d.door='Lobby';

-- อ่านง่าย
SELECT
  s.name,
  d.time
FROM
  door_logs AS d
  JOIN suspects AS s
    ON s.badge_id = d.badge_id
WHERE
  d.door = 'Lobby';`,
    note: 'ลองวางแบบ "อ่านยาก" ลงใน SQL Console แล้วกด Format',
    sources: ['holywell', 'mozilla'],
  },
];

export const Manual = memo(function Manual() {
  const [i, setI] = useState(0);
  const hasTicket = useGame((s) => !!s.active);
  const ch = CHAPTERS[i];
  const copy = () => {
    useGame.getState().addTab(ch.code);
    openApp('console');
  };
  return (
    <div className="manual">
      <nav className="chapters" aria-label="Chapter select">
        <div className="panel-title">Chapter Select</div>
        {CHAPTERS.map((c, n) => (
          <button key={c.tab} className={`btn raised${n === i ? ' pressed' : ''}`} aria-current={n === i} onClick={() => setI(n)}>
            {c.tab}
          </button>
        ))}
      </nav>
      <article className="page sunken th sel" key={i}>
        <h2>{ch.title}</h2>
        <p className="lead">{ch.lead}</p>
        <ul>
          {ch.points.map((p, n) => (
            <li key={n}>{p}</li>
          ))}
        </ul>
        <SqlCode code={ch.code} />
        <div className="toolbar">
          <button className="btn raised" disabled={!hasTicket} onClick={copy}>
            <Icon name="terminal" /> เปิดในแท็บใหม่ของ Console
          </button>
          {ch.note && <span className="dim">{ch.note}</span>}
        </div>
        <footer>
          <div className="panel-title">อ้างอิง</div>
          {ch.sources.map((k) => (
            <a key={k} href={SOURCES[k].url} target="_blank" rel="noreferrer">
              {SOURCES[k].label}
            </a>
          ))}
        </footer>
      </article>
    </div>
  );
});
