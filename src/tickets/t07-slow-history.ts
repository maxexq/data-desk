import type { Ticket } from './types';

const QUERY = 'SELECT * FROM orders WHERE customer_id = 4242 ORDER BY ordered_at DESC LIMIT 20';

export const t07: Ticket = {
  id: 't07',
  no: 'T-107',
  title: 'หน้าประวัติออเดอร์ช้า',
  from: 'Krit · CTO',
  kind: 'incident',
  level: 8,
  skills: ['EXPLAIN', 'CREATE INDEX', 'Composite index'],
  xp: 800,
  body: [
    'ลูกค้าบ่นว่าหน้า "ออเดอร์ล่าสุดของฉัน" ในแอปโหลดช้าขึ้นทุกเดือน ตาราง orders ตอนนี้มี 100,000 แถว และ query ที่หน้านั้นใช้คืออันนี้:',
    QUERY,
    'ห้ามแก้ query เพราะอยู่ในแอปที่ปล่อยไปแล้ว ให้แก้ที่ฐานข้อมูล',
  ],
  seed: `
CREATE TABLE orders (
  id integer PRIMARY KEY,
  customer_id integer NOT NULL,
  ordered_at timestamp NOT NULL,
  total_baht integer NOT NULL
);
INSERT INTO orders
SELECT g, (g * 7919) % 5000, timestamp '2026-01-01 08:00' + (g * interval '4 minutes'), 20 + (g * 37 % 500)
FROM generate_series(1, 100000) AS g;
ANALYZE orders;
`,
  tasks: [
    {
      goal: 'ดูก่อนว่าฐานข้อมูลทำงานอย่างไร: รัน EXPLAIN ของ query ในโจทย์',
      skill: 'EXPLAIN',
      check: { kind: 'result', test: (r) => r.columns[0] === 'QUERY PLAN' && r.values.some((row) => String(row[0]).includes('orders')) },
      hints: [
        'EXPLAIN ไม่ได้รัน query จริง แต่แสดงแผนที่ฐานข้อมูลเลือก (manual บทที่ 11)',
        'พิมพ์คำว่า EXPLAIN นำหน้า query เดิมทั้งก้อน',
        `EXPLAIN ${QUERY}`,
      ],
      solution: `EXPLAIN ${QUERY};`,
    },
    {
      goal: 'ทำให้ query นี้ไม่ต้องอ่านทั้งตาราง แล้วกดส่งงาน (ลองรัน EXPLAIN อีกครั้งเพื่อดูว่าแผนเปลี่ยนไปอย่างไร)',
      skill: 'CREATE INDEX',
      check: { kind: 'plan', table: 'orders', query: QUERY },
      hints: [
        'บรรทัด "Seq Scan on orders" ในแผนแปลว่าอ่านทุกแถวเพื่อหาแถวของลูกค้าคนเดียว index คือสารบัญที่ทำให้กระโดดไปหาแถวที่ต้องการได้',
        'สร้าง index บนคอลัมน์ที่อยู่ใน WHERE: CREATE INDEX ชื่อ ON ตาราง (คอลัมน์)',
        'CREATE INDEX orders_customer_ordered_idx ON orders (customer_id, ordered_at DESC) ใส่คอลัมน์ที่ใช้เรียงต่อท้าย ฐานข้อมูลจะได้ไม่ต้องเรียงเองอีกรอบ',
      ],
      solution: 'CREATE INDEX orders_customer_ordered_idx ON orders (customer_id, ordered_at DESC);',
    },
  ],
  debrief: [
    'index บน (customer_id, ordered_at) ตอบ query นี้ได้ทั้งการหาและการเรียง: แถวของลูกค้าคนเดียวอยู่ติดกันใน index และเรียงตามเวลาอยู่แล้ว',
    'index มีราคา: ทุก INSERT และ UPDATE ต้องปรับ index ด้วย จึงสร้างเฉพาะที่มี query ใช้จริง และบนตารางเล็กฐานข้อมูลอาจเลือกอ่านทั้งตารางต่อไปเพราะเร็วกว่า',
    'บนระบบจริงที่มีคนใช้อยู่ CREATE INDEX แบบปกติจะกันการเขียนตารางระหว่างสร้าง ทีมส่วนใหญ่จึงใช้ CREATE INDEX CONCURRENTLY ซึ่งต้องรันนอก transaction',
  ],
};
