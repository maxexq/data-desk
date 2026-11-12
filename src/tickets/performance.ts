// Chapter: make it fast. Every step here is judged by the page meter as well as the result:
// how many 8 KB pages the query had to read (EXPLAIN ANALYZE, BUFFERS).
import { format } from './foundations';
import type { Task, Ticket } from './types';

const pagesNote = 'ขั้นที่มีงบ page ต้องได้ผลลัพธ์ถูกและอ่านข้อมูลไม่เกินงบ ดูตัวเลขได้ที่ช่อง pages ใต้ SQL Console (1 page = 8 KB)';

const fast = (goal: string, skill: string, solution: string, maxPages: number | undefined, hints: [string, string, string], setup?: string[]): Task => ({
  goal,
  skill,
  hints,
  check: { kind: 'result', expect: solution, ordered: true, ...(maxPages ? { maxPages } : {}) },
  solution,
  ...(setup ? { setup } : {}),
});

const CURSOR = "('2026-01-01 01:51:07', 20002)";

export const keyset: Ticket = {
  id: 'p01', no: 'T-108', title: 'หน้าลึกยิ่งช้า', from: 'Beam · Backend', kind: 'incident', level: 7, xp: 200,
  skills: ['Keyset pagination', 'Row comparison', 'Page meter'],
  body: [
    'หน้าฟีดรีวิวของร้านเปิดหน้าแรกเร็วมาก แต่ใครเลื่อนไปหน้าลึกๆ ระบบช้าจน timeout ตอนนี้ใช้ ORDER BY ... OFFSET (หน้า × 20) LIMIT 20',
    'มีโพสต์ 60,000 โพสต์ และ index posts_feed บน (created_at DESC, id DESC) อยู่แล้ว โพสต์หลายอันเกิดในวินาทีเดียวกัน จึงต้องเรียงด้วย id เป็นตัวตัดสินเสมอ',
    `หน้าที่ผู้ใช้กำลังดูจบที่โพสต์ id 20002 ซึ่ง created_at = '2026-01-01 01:51:07'`,
    pagesNote,
    format,
  ],
  seed: `CREATE TABLE posts (id integer PRIMARY KEY, created_at timestamp NOT NULL, title text NOT NULL, body text NOT NULL);
INSERT INTO posts SELECT n, TIMESTAMP '2026-01-01' + (n / 3) * INTERVAL '1 second', 'รีวิว #' || n, repeat('ข้าวเหนียวมะม่วงอร่อยมาก ', 10) FROM generate_series(1, 60000) AS n;
CREATE INDEX posts_feed ON posts (created_at DESC, id DESC);
ANALYZE posts;`,
  tasks: [
    fast('หน้าแรก: 20 โพสต์ใหม่สุด ผลลัพธ์: id, created_at, title เรียงใหม่ไปเก่า (เวลาเท่ากันให้ id มากก่อน)', 'ORDER BY + LIMIT',
      'SELECT id, created_at, title FROM posts ORDER BY created_at DESC, id DESC LIMIT 20;', 20,
      ['หน้าแรกอ่านจากหัวของ index แล้วหยุดที่ 20 แถว จึงถูกและเร็วอยู่แล้ว', 'ORDER BY ให้ตรงกับ index (created_at DESC, id DESC) ฐานข้อมูลจะเดินตาม index โดยไม่ต้องเรียงใหม่', 'โครง: SELECT id, created_at, title FROM posts ORDER BY created_at DESC, ______ DESC LIMIT 20']),
    fast('หน้าถัดไป: 20 โพสต์ที่อยู่ถัดจากโพสต์ id 20002 (เก่ากว่า) ผลลัพธ์: id, created_at, title เรียงเหมือนเดิม งบ 20 page', 'Keyset pagination',
      `SELECT id, created_at, title FROM posts WHERE (created_at, id) < ${CURSOR} ORDER BY created_at DESC, id DESC LIMIT 20;`, 20,
      ['OFFSET 39999 ได้ผลถูก แต่ฐานข้อมูลต้องเดินผ่าน 39,999 แถวแล้วทิ้ง ดูตัวเลข pages แล้วจะเห็นเอง', 'จำ "ตำแหน่ง" ของแถวสุดท้ายแทนจำนวนแถวที่ข้าม แล้วขอเฉพาะแถวที่มาหลังจากนั้น: WHERE (created_at, id) < (เวลา, id) เทียบสองคอลัมน์พร้อมกัน', `โครง: SELECT id, created_at, title FROM posts WHERE (created_at, id) < ${CURSOR.replace('20002', '______')} ORDER BY created_at DESC, id DESC LIMIT 20`]),
    fast('หน้าก่อนหน้า: 20 โพสต์ที่ใหม่กว่าโพสต์ id 20002 ที่อยู่ติดกับมัน แสดงเรียงใหม่ไปเก่าเหมือนหน้าอื่น ผลลัพธ์: id, created_at, title งบ 20 page', 'Keyset backwards',
      `SELECT id, created_at, title FROM (
  SELECT id, created_at, title FROM posts WHERE (created_at, id) > ${CURSOR} ORDER BY created_at, id LIMIT 20
) AS page
ORDER BY created_at DESC, id DESC;`, 20,
      ['ย้อนกลับคือเดินอีกทาง: เอาแถวที่ "มากกว่า" ตำแหน่งนี้ เรียงจากน้อยไปมาก แล้วหยิบ 20 แถวที่ใกล้ที่สุด', 'ได้ 20 แถวแล้วต้องกลับลำดับให้เป็นใหม่ไปเก่าเหมือนหน้าอื่น ครอบด้วย subquery แล้ว ORDER BY อีกชั้น', `โครง: SELECT * FROM (SELECT id, created_at, title FROM posts WHERE (created_at, id) > ${CURSOR} ORDER BY created_at, id LIMIT 20) AS page ORDER BY ______`]),
  ],
  debrief: [
    'OFFSET n ไม่ได้ "กระโดด" ฐานข้อมูลต้องอ่านแล้วทิ้ง n แถวก่อนเสมอ หน้ายิ่งลึกยิ่งช้า ส่วน keyset (seek) pagination จำค่าของแถวสุดท้ายแล้วให้ index พาไปตรงนั้นเลย จึงเร็วเท่ากันทุกหน้า',
    'ต้องเรียงด้วยคอลัมน์ที่ไม่ซ้ำเป็นตัวท้ายเสมอ (ที่นี่คือ id) ไม่อย่างนั้นแถวที่เวลาเท่ากันจะหายหรือซ้ำระหว่างหน้า ข้อแลกเปลี่ยน: keyset กระโดดไปหน้า 500 ตรงๆ ไม่ได้ เหมาะกับฟีดเลื่อนต่อและปุ่มถัดไป/ก่อนหน้า',
  ],
  reply: { from: 'Beam · Backend', body: ['ฟีดเลื่อนลื่นทุกหน้าแล้ว timeout หายเกลี้ยง! แต่ทีมรายงานบ่นว่าเพิ่ง "สร้าง index แล้วก็ยังช้า" ฝากดู T-109 ต่อหน่อย'] },
};

export const sargable: Ticket = {
  id: 'p02', no: 'T-109', title: 'ทำ index แล้วก็ยังช้า', from: 'Ploy · Sales', kind: 'investigate', level: 7, xp: 200,
  skills: ['Sargable WHERE', 'Range on timestamps', 'Expression index'],
  body: [
    'ตาราง orders มี 100,000 แถว และมี index บน created_at กับ customer_email แล้ว แต่รายงานสองตัวนี้ยังอ่านทั้งตาราง:',
    "SELECT count(*), sum(total_baht) FROM orders WHERE created_at::date = '2026-03-15';",
    "SELECT id FROM orders WHERE lower(customer_email) = 'user42@mango.co' ORDER BY id;",
    'อีเมลในระบบเก่าพิมพ์ตัวเล็กตัวใหญ่ปนกัน เช่น user42@mango.co, User42@Mango.co, USER42@MANGO.CO คือคนเดียวกัน',
    pagesNote,
    format,
  ],
  seed: `CREATE TABLE orders (id integer PRIMARY KEY, customer_email text NOT NULL, created_at timestamp NOT NULL, total_baht integer NOT NULL);
INSERT INTO orders
SELECT n,
  CASE n % 3 WHEN 0 THEN 'user' || (n % 5000) || '@mango.co' WHEN 1 THEN 'User' || (n % 5000) || '@Mango.co' ELSE 'USER' || (n % 5000) || '@MANGO.CO' END,
  TIMESTAMP '2026-01-01' + n * INTERVAL '2 minutes',
  50 + n % 400
FROM generate_series(1, 100000) AS n;
CREATE INDEX orders_created ON orders (created_at);
CREATE INDEX orders_email ON orders (customer_email);
ANALYZE orders;`,
  tasks: [
    fast("ยอดของวันที่ 15 มีนาคม 2026 ผลลัพธ์: จำนวนออเดอร์, ยอดรวม งบ 30 page", 'Sargable range',
      "SELECT count(*), sum(total_baht) FROM orders WHERE created_at >= '2026-03-15' AND created_at < '2026-03-16';", 30,
      ['index เก็บค่า created_at ตามที่เป็น ถ้าครอบคอลัมน์ด้วยฟังก์ชันหรือ ::date ฐานข้อมูลต้องคำนวณทุกแถวก่อนจึงรู้ว่าตรงไหม เลยใช้ index ไม่ได้', "ให้คอลัมน์อยู่เปล่าๆ ฝั่งหนึ่ง แล้วเขียนเงื่อนไขเป็นช่วง: ตั้งแต่ต้นวัน ถึงก่อนต้นวันถัดไป", "โครง: SELECT count(*), sum(total_baht) FROM orders WHERE created_at >= '2026-03-15' AND created_at < '______'"]),
    {
      goal: 'สร้าง index ที่ช่วยการค้นหาอีเมลแบบไม่สนตัวพิมพ์เล็กใหญ่ แล้วกดส่งงาน',
      skill: 'Expression index',
      hints: ['index orders_email เก็บอีเมลตามที่พิมพ์ไว้ แต่ query ค้นด้วย lower(customer_email) ซึ่งเป็นค่าคนละตัว', 'PostgreSQL ทำ index บนผลของ expression ได้ เช่น lower(customer_email) แล้ว query ที่ใช้ expression เดียวกันจะใช้ index นั้น', 'โครง: CREATE INDEX orders_email_lower ON orders (______(customer_email));'],
      check: {
        kind: 'state',
        tests: [{ name: 'มี index บน lower(customer_email)', sql: "SELECT count(*) > 0 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'orders' AND indexdef ILIKE '%lower(customer_email)%'", expect: [[true]] }],
      },
      solution: 'CREATE INDEX orders_email_lower ON orders (lower(customer_email));',
    },
    fast("ออเดอร์ทั้งหมดของ user42@mango.co ไม่ว่าจะพิมพ์ตัวพิมพ์แบบไหน ผลลัพธ์: id เรียงจากน้อยไปมาก งบ 40 page", 'Use the index',
      "SELECT id FROM orders WHERE lower(customer_email) = 'user42@mango.co' ORDER BY id;", 40,
      ["ถ้าค้นด้วย customer_email = 'user42@mango.co' ตรงๆ จะได้แค่แถวที่พิมพ์ตัวเล็กหมด", 'ใช้ expression ให้ตรงกับที่สร้าง index ไว้ทุกตัวอักษร: lower(customer_email) = ค่าตัวเล็ก', "โครง: SELECT id FROM orders WHERE lower(customer_email) = '______' ORDER BY id"]),
  ],
  debrief: [
    'เงื่อนไขที่ใช้ index ได้ (sargable) คือเงื่อนไขที่คอลัมน์อยู่เปล่าๆ: created_at >= x AND created_at < y ใช้ได้ แต่ created_at::date = x, date_trunc(...) = x หรือ คอลัมน์ + 1 = x ใช้ไม่ได้',
    'ถ้าจำเป็นต้องค้นด้วยฟังก์ชันจริงๆ ให้สร้าง expression index บนฟังก์ชันนั้น และเขียน query ให้ตรงกับ expression เดิม ส่วนการค้นแบบ LIKE ที่ขึ้นต้นด้วย % ใช้ B-tree index ไม่ได้เลย ต้องใช้ index แบบอื่น (เช่น pg_trgm)',
  ],
  reply: { from: 'Ploy · Sales', body: ['รายงานรายวันขึ้นมาในพริบตาเลยค่ะ Beam บอกว่าหน้า "ยอดของลูกค้า" ยังอ่านข้อมูลเยอะเกินจำเป็น ดู T-110 ให้หน่อยนะคะ'] },
};

const coverQuery = 'SELECT status, sum(total_baht) FROM sales WHERE customer_id = 42 GROUP BY status ORDER BY status;';

export const covering: Ticket = {
  id: 'p03', no: 'T-110', title: 'index ที่คลุมทั้ง query', from: 'Beam · Backend', kind: 'request', level: 8, xp: 220,
  skills: ['Covering index (INCLUDE)', 'Index Only Scan', 'VACUUM'],
  body: [
    'หน้า "ยอดของลูกค้า" เรียกทุกครั้งที่ลูกค้าเปิดแอป ตาราง sales มี 100,000 แถว ทุกแถวมีโน้ตยาวทำให้ 1 page เก็บได้ไม่กี่แถว',
    'มี index sales_customer บน customer_id แล้ว แต่แถวของลูกค้าแต่ละคนกระจายอยู่ทั่วตาราง ฐานข้อมูลจึงต้องไปเปิด page ของตารางทีละแถว',
    pagesNote,
    format,
  ],
  seed: `CREATE TABLE sales (id integer PRIMARY KEY, customer_id integer NOT NULL, status text NOT NULL, total_baht integer NOT NULL, note text NOT NULL);
INSERT INTO sales SELECT n, n % 1000, (ARRAY['paid', 'paid', 'paid', 'refunded', 'pending'])[1 + n % 5], 40 + n % 300, repeat('หมายเหตุ ', 30) FROM generate_series(1, 100000) AS n;
CREATE INDEX sales_customer ON sales (customer_id);
ANALYZE sales;`,
  tasks: [
    fast('ยอดรวมของลูกค้า customer_id 42 แยกตามสถานะ ผลลัพธ์: status, ยอดรวม เรียงตามชื่อ status', 'GROUP BY',
      coverQuery, undefined,
      ['เริ่มจากเขียนให้ผลถูกก่อน แล้วสังเกตตัวเลข pages', 'WHERE customer_id = 42 แล้ว GROUP BY status', 'โครง: SELECT status, sum(total_baht) FROM sales WHERE customer_id = 42 GROUP BY ______ ORDER BY status']),
    fast('query เดิม แต่ให้อ่านไม่เกิน 15 page (ตอนนี้ราว 100 page) โดยไม่แก้ query', 'Covering index',
      coverQuery, 15,
      ['ที่ช้าเพราะทุกแถวที่เจอใน index ต้องย้อนไปเปิด page ของตารางเพื่อเอา status กับ total_baht ถ้า index มีคอลัมน์ครบเอง ฐานข้อมูลก็ไม่ต้องไปเปิดตาราง', 'CREATE INDEX ... ON sales (customer_id) INCLUDE (status, total_baht) ทำ covering index แล้วรัน VACUUM sales; หนึ่งครั้ง เพื่อให้ฐานข้อมูลรู้ว่า page ไหนไม่ต้องตรวจซ้ำ (visibility map) จึงจะใช้ Index Only Scan ได้', 'ทำทีละคำสั่ง: CREATE INDEX sales_cover ON sales (customer_id) INCLUDE (______, ______); แล้ว VACUUM sales; แล้วรัน query เดิม'],
      ['CREATE INDEX sales_cover ON sales (customer_id) INCLUDE (status, total_baht);', 'VACUUM sales;']),
  ],
  debrief: [
    'covering index คือ index ที่มีทุกคอลัมน์ที่ query ต้องใช้ (คีย์สำหรับค้นหา + คอลัมน์ที่ INCLUDE ไว้) ฐานข้อมูลตอบได้จาก index อย่างเดียว เป็น Index Only Scan',
    'Index Only Scan ใน PostgreSQL ต้องพึ่ง visibility map ที่ VACUUM (หรือ autovacuum) อัปเดต ถ้าตารางเพิ่งถูกเขียนมาก มันจะยังต้องย้อนไปตรวจตาราง ส่วนราคาของ covering index คือขนาดที่ใหญ่ขึ้นและการเขียนที่ช้าลง จึงใช้กับ query ที่เรียกบ่อยจริงๆ',
  ],
  reply: { from: 'Beam · Backend', body: ['จาก 100 เหลือไม่กี่ page หน้าแอปไวขึ้นเห็นๆ อีกเรื่องสุดท้าย: ระบบ event ใหม่ใช้ UUID สุ่มเป็น primary key ทีม infra บอกว่า index โตเร็วผิดปกติ ไปดูกันที่ T-111'] },
};

export const uuids: Ticket = {
  id: 'p04', no: 'T-111', title: 'UUID สุ่มทำ index บวม', from: 'Krit · CTO', kind: 'project', level: 8, xp: 250,
  skills: ['uuidv7()', 'Index size', 'ID + public UUID'],
  body: [
    'ระบบเก็บ event ใช้ id แบบ UUID สุ่ม (gen_random_uuid(), เวอร์ชัน 4) ทุกแถวใหม่จึงไปแทรกกลาง index แบบสุ่ม page เต็มแล้วต้องแยกครึ่งอยู่เรื่อยๆ',
    'PostgreSQL 18 มี uuidv7() ที่ขึ้นต้นด้วยเวลา แถวใหม่จึงต่อท้าย index เสมอ ลองพิสูจน์ด้วยตัวเลข แล้วออกแบบตารางลูกค้าใหม่ให้ถูกตั้งแต่แรก',
    'ตาราง events มีอยู่แล้วแต่ยังว่าง',
  ],
  seed: `CREATE TABLE events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`,
  tasks: [
    {
      goal: "สร้างตาราง events_v7 แบบเดียวกับ events แต่ id ใช้ DEFAULT uuidv7() แล้วใส่ 30,000 แถวลงทั้ง events และ events_v7 (kind เป็นอะไรก็ได้) จากนั้นกดส่งงาน",
      skill: 'uuidv7()',
      hints: ['สร้างตารางใหม่ด้วย CREATE TABLE โดยเปลี่ยนแค่ DEFAULT ของ id', 'ใส่ข้อมูลทีละมากๆ ด้วย INSERT ... SELECT ... FROM generate_series(1, 30000)', "โครง: CREATE TABLE events_v7 (id uuid PRIMARY KEY DEFAULT ______(), kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()); INSERT INTO events (kind) SELECT 'view' FROM generate_series(1, 30000); แล้วทำแบบเดียวกันกับ events_v7"],
      check: {
        kind: 'state',
        tests: [
          { name: 'events มี 30,000 แถว', sql: 'SELECT count(*) FROM events', expect: [[30000]] },
          { name: 'events_v7 มี 30,000 แถว', sql: 'SELECT count(*) FROM events_v7', expect: [[30000]] },
          { name: 'id ของ events_v7 เป็น UUID เวอร์ชัน 7', sql: 'SELECT bool_and(uuid_extract_version(id) = 7) FROM events_v7', expect: [[true]] },
        ],
      },
      solution: `CREATE TABLE events_v7 (id uuid PRIMARY KEY DEFAULT uuidv7(), kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO events (kind) SELECT 'view' FROM generate_series(1, 30000);
INSERT INTO events_v7 (kind) SELECT 'view' FROM generate_series(1, 30000);`,
    },
    {
      goal: 'เทียบขนาด index ของ primary key ทั้งสองตาราง ผลลัพธ์: ขนาด (byte) ของ events_pkey, ขนาดของ events_v7_pkey',
      skill: 'pg_relation_size',
      hints: ['primary key ทุกตัวมี index ชื่อ <ตาราง>_pkey', "pg_relation_size('ชื่อ index') บอกขนาดเป็น byte (ถ้าอยากอ่านง่ายลอง pg_size_pretty ครอบดูก่อน แล้วค่อยส่งเป็นตัวเลข)", "โครง: SELECT pg_relation_size('events_pkey'), pg_relation_size('______')"],
      check: {
        kind: 'result',
        test: (r) => r.values.length === 1 && r.values[0].length === 2 && Number(r.values[0][0]) > Number(r.values[0][1]) && Number(r.values[0][1]) > 0,
        feedback: 'ต้องได้ 1 แถว 2 คอลัมน์ เป็นตัวเลข byte: events_pkey ก่อน แล้ว events_v7_pkey และต้องใส่ข้อมูลครบจากขั้นที่แล้วก่อน',
      },
      solution: "SELECT pg_relation_size('events_pkey'), pg_relation_size('events_v7_pkey');",
    },
    {
      goal: 'ออกแบบตาราง customers แบบ ID + UUID: id เป็น bigint identity primary key ใช้ JOIN ภายใน, public_id เป็น uuid ไม่ว่าง ไม่ซ้ำ ค่าเริ่มต้น uuidv7() ใช้ใน URL และ API, name เป็น text ไม่ว่าง แล้วกดส่งงาน',
      skill: 'ID + public UUID',
      hints: ['id ภายในเป็นเลขเรียงต่อกัน เล็ก JOIN เร็ว ส่วน public_id ให้คนภายนอกเห็นโดยเดาลำดับลูกค้าไม่ได้', 'bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY กับ uuid NOT NULL UNIQUE DEFAULT uuidv7()', 'โครง: CREATE TABLE customers (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, public_id uuid NOT NULL ______ DEFAULT uuidv7(), name text NOT NULL);'],
      check: {
        kind: 'state',
        tests: [
          { name: 'id เป็น bigint identity', sql: "SELECT data_type, is_identity FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'customers' AND column_name = 'id'", expect: [['bigint', 'YES']] },
          { name: 'id เป็น primary key', sql: "SELECT count(*) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage k USING (constraint_schema, constraint_name) WHERE tc.table_schema = current_schema() AND tc.table_name = 'customers' AND tc.constraint_type = 'PRIMARY KEY' AND k.column_name = 'id'", expect: [[1]] },
          { name: 'public_id ได้ UUID เวอร์ชัน 7 เอง', sql: "INSERT INTO customers (name) VALUES ('Anya') RETURNING uuid_extract_version(public_id)", expect: [[7]] },
          { name: 'public_id ซ้ำกันไม่ได้', sql: "INSERT INTO customers (name) VALUES ('Anya'); INSERT INTO customers (name, public_id) SELECT 'Ben', public_id FROM customers", expect: { error: '23505' } },
          { name: 'public_id ว่างไม่ได้', sql: "INSERT INTO customers (name, public_id) VALUES ('Chai', NULL)", expect: { error: '23502' } },
          { name: 'name ว่างไม่ได้', sql: 'INSERT INTO customers (name) VALUES (NULL)', expect: { error: '23502' } },
        ],
      },
      solution: 'CREATE TABLE customers (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, public_id uuid NOT NULL UNIQUE DEFAULT uuidv7(), name text NOT NULL);',
    },
  ],
  debrief: [
    'UUID สุ่ม (v4) ทำให้ทุกแถวใหม่ไปแทรกกลาง B-tree แบบสุ่ม page แตกครึ่งบ่อย index จึงใหญ่กว่าและ cache ไม่อยู่ ส่วน UUIDv7 ขึ้นต้นด้วยเวลา แถวใหม่ต่อท้ายเสมอเหมือนเลขเรียง index จึงแน่นกว่า (ในขั้นที่ 2 คุณเพิ่งเห็นตัวเลขเอง)',
    'แบบที่ใช้กันบ่อยคือ id ภายในเป็น bigint identity ไว้ JOIN และ foreign key ส่วน public_id เป็น UUID ไว้ให้ภายนอกเห็น เพราะเลขเรียงทำให้คนเดาจำนวนลูกค้าหรือไล่ URL ได้ ข้อระวังของ v7 คือมันบอกเวลาที่สร้างแถวได้',
  ],
  reply: { from: 'Krit · CTO', body: [
    'ตัวเลขชัดมาก ทีม infra เปลี่ยนเป็น uuidv7 ตั้งแต่วันนี้',
    'จากไล่บันทึกประตูวันแรก ถึงออกแบบตาราง ย้ายข้อมูล และทำให้ทุก query อ่านเท่าที่จำเป็น คุณปิดงานหลักครบทุกบทแล้ว แวะรับงานประจำวัน หรือทดลองกับข้อมูลใน Sandbox ต่อได้เลย',
  ] },
};
