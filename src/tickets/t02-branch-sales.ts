import type { Ticket } from './types';

export const t02: Ticket = {
  id: 't02',
  no: 'T-102',
  title: 'ยอดขายรายสาขา',
  from: 'Ploy · Sales',
  kind: 'request',
  level: 3,
  skills: ['GROUP BY', 'SUM / COUNT', 'HAVING'],
  xp: 200,
  body: [
    'พรุ่งนี้มีประชุมผู้จัดการสาขา ขอตัวเลขสรุปของ 10 วันแรกของเดือนหน่อยค่ะ ข้อมูลอยู่ในตาราง orders กับ branches',
    'ระบบจะเทียบผลลัพธ์ของคุณกับคำตอบที่ถูก จำนวนคอลัมน์และลำดับคอลัมน์ต้องตรงตามที่ขอ ส่วนชื่อคอลัมน์ตั้งอย่างไรก็ได้',
  ],
  seed: `
CREATE TABLE branches (id integer PRIMARY KEY, name text NOT NULL UNIQUE, province text NOT NULL);
INSERT INTO branches VALUES (1,'Siam','Bangkok'),(2,'Ari','Bangkok'),(3,'Nimman','Chiang Mai'),(4,'Old Town','Phuket');

CREATE TABLE orders (
  id integer PRIMARY KEY,
  branch_id integer NOT NULL REFERENCES branches (id),
  ordered_on date NOT NULL,
  total_baht integer NOT NULL CHECK (total_baht > 0),
  status text NOT NULL CHECK (status IN ('paid', 'refunded'))
);
INSERT INTO orders
SELECT g,
       (g % 7 % 4) + 1,
       date '2026-11-01' + (g % 10),
       80 + (g * 37 % 400),
       CASE WHEN g % 9 = 0 OR g % 14 = 0 OR g % 20 = 3 THEN 'refunded' ELSE 'paid' END
FROM generate_series(1, 60) AS g;
`,
  tasks: [
    {
      goal: 'นับจำนวนออเดอร์ของแต่ละสาขา ผลลัพธ์ 2 คอลัมน์: branch_id, จำนวนออเดอร์',
      skill: 'GROUP BY',
      check: { kind: 'result', expect: 'SELECT branch_id, count(*) FROM orders GROUP BY branch_id' },
      hints: [
        'GROUP BY รวมแถวที่มีค่าเดียวกันเป็นกลุ่ม แล้วฟังก์ชันอย่าง COUNT(*) จะนับแถวในแต่ละกลุ่ม (manual บทที่ 6)',
        'คอลัมน์ที่อยู่ใน SELECT โดยไม่อยู่ในฟังก์ชันสรุป ต้องอยู่ใน GROUP BY ด้วย',
        'โครง: SELECT branch_id, COUNT(*) FROM orders GROUP BY ______',
      ],
      solution: 'SELECT branch_id, COUNT(*) AS order_count FROM orders GROUP BY branch_id;',
    },
    {
      goal: "ยอดขายรวมของแต่ละสาขา นับเฉพาะออเดอร์ที่ status เป็น 'paid' ผลลัพธ์ 2 คอลัมน์: ชื่อสาขา, ยอดรวม เรียงจากยอดมากไปน้อย",
      skill: 'SUM + JOIN',
      check: {
        kind: 'result',
        ordered: true,
        expect: "SELECT b.name, sum(o.total_baht) FROM orders o JOIN branches b ON b.id = o.branch_id WHERE o.status = 'paid' GROUP BY b.name ORDER BY 2 DESC",
      },
      hints: [
        'ชื่อสาขาอยู่ในตาราง branches ต้อง JOIN ก่อน แล้วค่อย GROUP BY ชื่อสาขา',
        'กรองออเดอร์ที่ไม่นับด้วย WHERE (ก่อนจัดกลุ่ม) แล้วเรียงด้วย ORDER BY … DESC',
        "โครง: SELECT b.name, SUM(o.total_baht) AS revenue FROM orders AS o JOIN branches AS b ON ______ WHERE o.status = 'paid' GROUP BY ______ ORDER BY revenue DESC",
      ],
      solution: `SELECT b.name, SUM(o.total_baht) AS revenue
FROM orders AS o
JOIN branches AS b ON b.id = o.branch_id
WHERE o.status = 'paid'
GROUP BY b.name
ORDER BY revenue DESC;`,
    },
    {
      goal: 'สาขาที่มีออเดอร์ refunded ตั้งแต่ 3 ครั้งขึ้นไป ผลลัพธ์ 2 คอลัมน์: ชื่อสาขา, จำนวนครั้งที่ refund',
      skill: 'HAVING',
      check: {
        kind: 'result',
        expect: "SELECT b.name, count(*) FROM orders o JOIN branches b ON b.id = o.branch_id WHERE o.status = 'refunded' GROUP BY b.name HAVING count(*) >= 3",
      },
      hints: [
        'WHERE กรองแถวก่อนจัดกลุ่ม ส่วน HAVING กรองกลุ่มหลังจากนับเสร็จแล้ว',
        "ใช้ WHERE status = 'refunded' เพื่อเลือกแถว แล้วใช้ HAVING COUNT(*) >= 3 เพื่อเลือกกลุ่ม",
        "โครง: SELECT b.name, COUNT(*) FROM orders AS o JOIN branches AS b ON b.id = o.branch_id WHERE o.status = 'refunded' GROUP BY b.name HAVING ______",
      ],
      solution: `SELECT b.name, COUNT(*) AS refunds
FROM orders AS o
JOIN branches AS b ON b.id = o.branch_id
WHERE o.status = 'refunded'
GROUP BY b.name
HAVING COUNT(*) >= 3;`,
    },
  ],
  debrief: [
    'เงื่อนไขที่ไม่ต้องใช้ผลสรุป (status) ใส่ใน WHERE เพราะกรองก่อนจัดกลุ่ม ฐานข้อมูลจึงไม่ต้องเสียแรงสรุปแถวที่จะทิ้งอยู่แล้ว เงื่อนไขที่ใช้ผลสรุป (จำนวนครั้ง) ต้องอยู่ใน HAVING',
  ],
  reply: { from: 'Ploy · Sales', body: [
    'ได้ตัวเลขเข้าประชุมแล้วค่ะ ดีที่แยกยอด paid ออกจาก refunded ไม่อย่างนั้นยอดคงดูสวยเกินจริง',
    'Mint ฝากตรวจรายชื่อลูกค้าใน T-102A และช่วงวันที่ใน T-102B ก่อนค่ะ จากนั้นค่อยไปจัดอันดับพนักงานใน T-103 ได้ข่าวว่ารางวัลเป็นข้าวเหนียวมะม่วง',
  ] },
};
