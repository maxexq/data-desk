import type { Ticket } from './types';

const MONTHLY = `SELECT to_char(s.sold_on, 'YYYY-MM') AS month, st.name, sum(s.amount_baht) AS total
FROM sales s JOIN staff st ON st.id = s.staff_id
GROUP BY 1, 2`;

export const t03: Ticket = {
  id: 't03',
  no: 'T-103',
  title: 'พนักงานขายดีเด่นประจำเดือน',
  from: 'Mint · HR',
  kind: 'request',
  level: 4,
  skills: ['CTE (WITH)', 'Window functions', 'RANK()'],
  xp: 300,
  body: [
    'HR จะแจกโบนัสข้าวเหนียวมะม่วงให้คนที่ขายได้มากที่สุดของแต่ละเดือน (ส.ค. ถึง ต.ค.) ข้อมูลการขายอยู่ในตาราง sales และ staff',
    "เดือนให้แสดงเป็นข้อความรูปแบบ 'YYYY-MM' ใช้ to_char(sold_on, 'YYYY-MM') ได้",
  ],
  seed: `
CREATE TABLE staff (id integer PRIMARY KEY, name text NOT NULL UNIQUE);
INSERT INTO staff VALUES (1,'Ploy'),(2,'Non'),(3,'Beam'),(4,'Tar'),(5,'Fah');

CREATE TABLE sales (
  id integer PRIMARY KEY,
  staff_id integer NOT NULL REFERENCES staff (id),
  sold_on date NOT NULL,
  amount_baht integer NOT NULL CHECK (amount_baht > 0)
);
INSERT INTO sales
SELECT g, (g * 3 % 5) + 1, date '2026-08-01' + (g * 11 % 92), 150 + (g * 53 % 900)
FROM generate_series(1, 90) AS g;
`,
  tasks: [
    {
      goal: "ยอดขายรวมของแต่ละคนในแต่ละเดือน ผลลัพธ์ 3 คอลัมน์: เดือน ('YYYY-MM'), ชื่อ, ยอดรวม",
      skill: 'GROUP BY หลายคอลัมน์',
      check: { kind: 'result', expect: MONTHLY },
      hints: [
        'จัดกลุ่มได้มากกว่าหนึ่งคอลัมน์: หนึ่งกลุ่มคือหนึ่งคู่ของ (เดือน, คน)',
        "สร้างคอลัมน์เดือนด้วย to_char(s.sold_on, 'YYYY-MM') แล้วใส่นิพจน์เดียวกันใน GROUP BY",
        "โครง: SELECT to_char(s.sold_on, 'YYYY-MM') AS month, st.name, SUM(s.amount_baht) FROM sales AS s JOIN staff AS st ON st.id = s.staff_id GROUP BY ______, ______",
      ],
      solution: `SELECT to_char(s.sold_on, 'YYYY-MM') AS month, st.name, SUM(s.amount_baht) AS total
FROM sales AS s
JOIN staff AS st ON st.id = s.staff_id
GROUP BY to_char(s.sold_on, 'YYYY-MM'), st.name;`,
    },
    {
      goal: 'คนที่ขายได้มากที่สุดของแต่ละเดือน เดือนละ 1 คน ผลลัพธ์ 3 คอลัมน์: เดือน, ชื่อ, ยอดรวม เรียงตามเดือน',
      skill: 'CTE + RANK()',
      check: {
        kind: 'result',
        ordered: true,
        expect: `WITH m AS (${MONTHLY}), r AS (SELECT m.*, rank() OVER (PARTITION BY month ORDER BY total DESC) AS rk FROM m) SELECT month, name, total FROM r WHERE rk = 1 ORDER BY month`,
      },
      hints: [
        'เอา query ข้อแรกมาตั้งชื่อด้วย WITH monthly AS (…) แล้วเขียน query ต่อจากมันได้เหมือนเป็นตาราง (manual บทที่ 7)',
        'RANK() OVER (PARTITION BY month ORDER BY total DESC) ให้อันดับ 1 กับคนที่ยอดสูงสุดของแต่ละเดือน แต่กรองด้วย WHERE ในชั้นเดียวกันไม่ได้ ต้องห่ออีกชั้นก่อน',
        'โครง: WITH monthly AS (…ข้อแรก…), ranked AS (SELECT *, RANK() OVER (PARTITION BY month ORDER BY total DESC) AS rk FROM monthly) SELECT month, name, total FROM ranked WHERE rk = ______ ORDER BY month',
      ],
      solution: `WITH monthly AS (
  SELECT to_char(s.sold_on, 'YYYY-MM') AS month, st.name, SUM(s.amount_baht) AS total
  FROM sales AS s
  JOIN staff AS st ON st.id = s.staff_id
  GROUP BY to_char(s.sold_on, 'YYYY-MM'), st.name
),
ranked AS (
  SELECT month, name, total,
         RANK() OVER (PARTITION BY month ORDER BY total DESC) AS rk
  FROM monthly
)
SELECT month, name, total
FROM ranked
WHERE rk = 1
ORDER BY month;`,
    },
  ],
  debrief: [
    'window function คำนวณข้ามแถวที่เกี่ยวข้องโดยไม่ยุบแถวเหมือน GROUP BY และถูกคำนวณหลัง WHERE / GROUP BY / HAVING จึงต้องคำนวณในชั้นหนึ่ง แล้วกรองผลในชั้นถัดไป',
    'CTE (WITH) ช่วยแบ่ง query ยาวเป็นขั้นที่มีชื่อ อ่านจากบนลงล่างได้เหมือนขั้นตอนการทำงาน',
  ],
  reply: { from: 'Mint · HR', body: [
    'รายชื่อพร้อมแล้วค่ะ คราวนี้จัดอันดับแยกเดือนได้ครบ ไม่เผลอให้รางวัลเฉพาะคนที่ยอดรวมทั้งช่วงสูงสุด',
    'กำลังจะสั่งขนม แต่ Beam ส่งข้อความมาว่าราคาในร้านกลายเป็นศูนย์หมดแล้ว ช่วยดู T-104 ให้เขาก่อนนะคะ!',
  ] },
};
