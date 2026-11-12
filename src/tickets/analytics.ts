// Chapter: the data team. Window functions over time, gaps in time series, cohorts.
import { format, task } from './foundations';
import type { Ticket } from './types';

export const latest: Ticket = {
  id: 'f07', no: 'T-103A', title: 'ลูกค้าคนเดิม สั่งล่าสุดเมื่อไหร่', from: 'Nok · Marketing', kind: 'request', level: 5, xp: 150,
  skills: ['ROW_NUMBER', 'LAG', 'PARTITION BY'],
  body: [
    'จะส่งข้อความ "คิดถึงนะ" ให้ลูกค้าที่หายไปนาน ต้องรู้ว่าแต่ละคนสั่งครั้งล่าสุดคือออเดอร์ไหน และปกติเว้นช่วงกี่วัน',
    'ลูกค้าบางคนสั่งสองออเดอร์ในวันเดียวกัน ถ้าวันเท่ากันให้ถือว่า id ที่มากกว่าเป็นออเดอร์ทีหลัง',
    format,
  ],
  seed: `CREATE TABLE orders (id integer PRIMARY KEY, customer_id integer NOT NULL, ordered_on date NOT NULL, total_baht integer NOT NULL);
INSERT INTO orders VALUES (1,1,'2026-08-03',240),(2,2,'2026-08-05',120),(3,1,'2026-08-20',300),(4,3,'2026-09-01',180),(5,2,'2026-09-02',120),(6,1,'2026-09-15',360),(7,3,'2026-09-15',90),(8,2,'2026-10-01',240),(9,3,'2026-10-04',150),(10,3,'2026-10-04',60);`,
  tasks: [
    task('ออเดอร์ล่าสุดของลูกค้าแต่ละคน คนละ 1 แถว ผลลัพธ์: customer_id, id ของออเดอร์, ordered_on, total_baht เรียง customer_id', 'ROW_NUMBER',
      `WITH ranked AS (
  SELECT customer_id, id, ordered_on, total_baht,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_on DESC, id DESC) AS rn
  FROM orders
)
SELECT customer_id, id, ordered_on, total_baht FROM ranked WHERE rn = 1 ORDER BY customer_id;`,
      ['หา MAX(ordered_on) แล้ว JOIN กลับจะได้ 2 แถวเมื่อมีสองออเดอร์ในวันล่าสุดเดียวกัน', 'ROW_NUMBER() ให้เลข 1, 2, 3… ไม่ซ้ำในแต่ละกลุ่ม (PARTITION BY customer_id) ใส่ id DESC ต่อท้าย ORDER BY เพื่อตัดสินวันเท่ากัน แล้วเก็บเฉพาะแถวที่ได้ 1', 'โครง: WITH ranked AS (SELECT ..., ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_on DESC, ______ DESC) AS rn FROM orders) SELECT ... FROM ranked WHERE rn = 1 ORDER BY customer_id']),
    task('แต่ละออเดอร์ห่างจากออเดอร์ก่อนหน้าของลูกค้าคนเดียวกันกี่วัน (ออเดอร์แรกเป็น NULL) ผลลัพธ์: id, customer_id, ordered_on, จำนวนวัน เรียง customer_id แล้ว ordered_on แล้ว id', 'LAG',
      `SELECT id, customer_id, ordered_on,
  ordered_on - LAG(ordered_on) OVER (PARTITION BY customer_id ORDER BY ordered_on, id) AS days_since
FROM orders
ORDER BY customer_id, ordered_on, id;`,
      ['LAG(col) หยิบค่าจากแถวก่อนหน้าตามลำดับที่กำหนดใน OVER', 'ถ้าไม่ PARTITION BY customer_id แถวแรกของลูกค้าคนหนึ่งจะไปเทียบกับออเดอร์ของอีกคน ส่วน date - date ได้จำนวนวันเป็นตัวเลขเลย', 'โครง: SELECT id, customer_id, ordered_on, ordered_on - LAG(ordered_on) OVER (PARTITION BY ______ ORDER BY ordered_on, id) FROM orders ORDER BY customer_id, ordered_on, id']),
    task("ยอดขายรายเดือนและส่วนต่างจากเดือนก่อน ผลลัพธ์: เดือนรูปแบบ 'YYYY-MM', ยอดขาย, ส่วนต่าง (เดือนแรกเป็น NULL) เรียงเดือน", 'LAG on aggregates',
      `WITH monthly AS (
  SELECT to_char(ordered_on, 'YYYY-MM') AS month, SUM(total_baht) AS revenue FROM orders GROUP BY 1
)
SELECT month, revenue, revenue - LAG(revenue) OVER (ORDER BY month) AS change FROM monthly ORDER BY month;`,
      ['สรุปยอดรายเดือนก่อน แล้วค่อยใช้ LAG กับผลสรุป', 'window function ทำงานหลัง GROUP BY ใส่การรวมใน CTE แล้วเรียก LAG ข้างนอก (หรือ LAG(SUM(total_baht)) ก็ได้)', "โครง: WITH monthly AS (SELECT to_char(ordered_on, 'YYYY-MM') AS month, SUM(total_baht) AS revenue FROM orders GROUP BY 1) SELECT month, revenue, revenue - LAG(______) OVER (ORDER BY month) FROM monthly ORDER BY month"]),
  ],
  debrief: [
    'ROW_NUMBER ใช้ดึง "แถวล่าสุดต่อกลุ่ม" ได้คนละหนึ่งแถวเสมอ ต่างจาก MAX แล้ว JOIN กลับที่ได้แถวซ้ำเมื่อค่าเท่ากัน (PostgreSQL มี DISTINCT ON ทำแบบเดียวกันได้)',
    'LAG / LEAD มองแถวก่อนหน้าและถัดไป ต้องกำหนดกลุ่มด้วย PARTITION BY ให้ถูก และ window function คำนวณหลัง GROUP BY จึงใช้กับยอดสรุปได้',
  ],
  reply: { from: 'Nok · Marketing', body: ['ได้รายชื่อคนที่หายไปนานแล้ว เดือนตุลายอดตกไป 300 บาทด้วย Ploy บอกว่ากราฟรายวันของเธอดูแปลกๆ ฝากดู T-103B ต่อนะ'] },
};

export const gaps: Ticket = {
  id: 'f08', no: 'T-103B', title: 'กราฟมีรู', from: 'Ploy · Sales', kind: 'investigate', level: 5, xp: 150,
  skills: ['Running total', 'generate_series', 'Moving average'],
  body: [
    'กราฟยอดขายรายวันของสาขา Ari ช่วง 1–10 พฤศจิกายนดูกระโดดไปมา บางวันไม่มีจุดเลยเพราะร้านปิดซ่อมแอร์ ตารางเลยไม่มีแถวของวันนั้น',
    'ทีมอยากได้ยอดสะสม กับเส้นค่าเฉลี่ย 3 วันที่นับวันปิดร้านเป็น 0 ด้วย',
    format,
  ],
  seed: `CREATE TABLE daily_sales (day date PRIMARY KEY, revenue integer NOT NULL);
INSERT INTO daily_sales VALUES ('2026-11-01',500),('2026-11-02',700),('2026-11-05',300),('2026-11-06',900),('2026-11-07',600),('2026-11-09',400),('2026-11-10',800);`,
  tasks: [
    task('ยอดสะสมตั้งแต่วันแรก ผลลัพธ์: day, revenue, ยอดสะสม เรียงวัน', 'Running total',
      'SELECT day, revenue, SUM(revenue) OVER (ORDER BY day) AS running FROM daily_sales ORDER BY day;',
      ['SUM ปกติยุบทุกแถวเหลือแถวเดียว แต่ SUM(...) OVER (...) คงทุกแถวไว้', 'เมื่อใส่ ORDER BY ใน OVER ผลรวมจะนับตั้งแต่แถวแรกจนถึงแถวปัจจุบัน', 'โครง: SELECT day, revenue, SUM(revenue) OVER (ORDER BY ______) FROM daily_sales ORDER BY day']),
    task("ทำตารางครบทุกวัน 1–10 พฤศจิกายน 2026 วันที่ไม่มียอดให้เป็น 0 ผลลัพธ์: day (เป็นชนิด date), revenue เรียงวัน", 'generate_series',
      `SELECT d::date AS day, COALESCE(s.revenue, 0) AS revenue
FROM generate_series(DATE '2026-11-01', DATE '2026-11-10', INTERVAL '1 day') AS d
LEFT JOIN daily_sales AS s ON s.day = d::date
ORDER BY day;`,
      ['ข้อมูลที่ไม่มีแถวสร้างจากตารางเดิมไม่ได้ ต้องมีรายการวันทั้งหมดก่อน', "generate_series(DATE '2026-11-01', DATE '2026-11-10', INTERVAL '1 day') สร้างทุกวันให้ (ได้ timestamp ให้แปลงด้วย ::date) แล้ว LEFT JOIN ยอดขาย", "โครง: SELECT d::date, COALESCE(s.revenue, 0) FROM generate_series(DATE '2026-11-01', DATE '2026-11-10', INTERVAL '1 day') AS d LEFT JOIN daily_sales s ON s.day = ______ ORDER BY 1"]),
    task('ค่าเฉลี่ยเคลื่อนที่ 3 วัน (วันนี้กับ 2 วันก่อนหน้า นับวันปิดร้านเป็น 0) ปัดทศนิยม 1 ตำแหน่ง ครบทั้ง 10 วัน ผลลัพธ์: day, revenue, ค่าเฉลี่ย เรียงวัน', 'Window frame',
      `WITH days AS (
  SELECT d::date AS day, COALESCE(s.revenue, 0) AS revenue
  FROM generate_series(DATE '2026-11-01', DATE '2026-11-10', INTERVAL '1 day') AS d
  LEFT JOIN daily_sales AS s ON s.day = d::date
)
SELECT day, revenue, ROUND(AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS avg_3d
FROM days
ORDER BY day;`,
      ['ถ้าเฉลี่ยบนตารางเดิม "2 แถวก่อนหน้า" ของวันที่ 5 คือวันที่ 1 กับ 2 ไม่ใช่ 3 กับ 4', 'เติมวันให้ครบก่อน (ขั้นที่แล้ว) ใน CTE แล้วใช้ AVG(...) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)', 'โครง: WITH days AS (ขั้นที่แล้ว) SELECT day, revenue, ROUND(AVG(revenue) OVER (ORDER BY day ROWS BETWEEN ______ PRECEDING AND CURRENT ROW), 1) FROM days ORDER BY day']),
  ],
  debrief: [
    'Window function แบบมี ORDER BY ให้ยอดสะสมโดยไม่ยุบแถว ส่วน ROWS BETWEEN … กำหนดกรอบเองได้ เช่นค่าเฉลี่ย 3 วัน',
    'ข้อมูลที่ "ไม่มีแถว" ต้องสร้างแกนเวลาให้ครบด้วย generate_series แล้ว LEFT JOIN ก่อนคำนวณ ไม่อย่างนั้นค่าเฉลี่ยเคลื่อนที่จะข้ามวันที่หายไปโดยไม่รู้ตัว',
  ],
  reply: { from: 'Ploy · Sales', body: ['กราฟเรียบขึ้นเยอะ และเห็นเลยว่าช่วงซ่อมแอร์ยอดหายไปเท่าไหร่ ผู้บริหารถามต่อว่าลูกค้าใหม่กลับมาซื้อซ้ำไหม ฝากดู T-103C นะคะ'] },
};

export const cohorts: Ticket = {
  id: 'f09', no: 'T-103C', title: 'ลูกค้าใหม่กลับมาไหม', from: 'Krit · CTO', kind: 'project', level: 6, xp: 200,
  skills: ['Cohort', 'Retention', 'COUNT(DISTINCT)'],
  body: [
    'บอร์ดอยากรู้ว่าลูกค้าที่เริ่มซื้อในแต่ละเดือนยังกลับมาซื้อในเดือนต่อๆ ไปไหม ตัวเลขนี้เรียกว่า retention และคนที่เริ่มเดือนเดียวกันเรียกว่า cohort เดียวกัน',
    'นับเป็นจำนวนคน ไม่ใช่จำนวนออเดอร์ คนที่สั่งสองครั้งในเดือนเดียวนับเป็นหนึ่งคน',
    format,
  ],
  seed: `CREATE TABLE orders (id integer PRIMARY KEY, customer_id integer NOT NULL, ordered_on date NOT NULL);
INSERT INTO orders VALUES (1,1,'2026-09-02'),(2,2,'2026-09-05'),(3,3,'2026-09-10'),(4,4,'2026-09-12'),(5,4,'2026-09-28'),(6,1,'2026-10-03'),(7,1,'2026-10-20'),(8,3,'2026-10-11'),(9,5,'2026-10-02'),(10,6,'2026-10-15'),(11,7,'2026-10-21'),(12,7,'2026-10-30'),(13,1,'2026-11-01'),(14,2,'2026-11-04'),(15,5,'2026-11-08'),(16,8,'2026-11-09');`,
  tasks: [
    task("cohort ของลูกค้าแต่ละคน (เดือนที่สั่งครั้งแรก) ผลลัพธ์: customer_id, เดือนรูปแบบ 'YYYY-MM' เรียง customer_id", 'Cohort',
      "SELECT customer_id, to_char(MIN(ordered_on), 'YYYY-MM') AS cohort FROM orders GROUP BY customer_id ORDER BY customer_id;",
      ['เดือนแรกของลูกค้าคือเดือนของออเดอร์ที่เก่าที่สุด', 'GROUP BY customer_id แล้วใช้ MIN(ordered_on) จากนั้นแปลงเป็นเดือนด้วย to_char', "โครง: SELECT customer_id, to_char(MIN(______), 'YYYY-MM') FROM orders GROUP BY customer_id ORDER BY customer_id"]),
    task('แต่ละ cohort มีกี่คน และกี่คนกลับมาซื้อในเดือนถัดไปทันที ผลลัพธ์: cohort, จำนวนลูกค้า, จำนวนที่กลับมา, เปอร์เซ็นต์ปัดทศนิยม 1 ตำแหน่ง เรียง cohort', 'Retention',
      `WITH firsts AS (
  SELECT customer_id, date_trunc('month', MIN(ordered_on)) AS cohort FROM orders GROUP BY customer_id
), next_month AS (
  SELECT DISTINCT o.customer_id
  FROM orders AS o
  JOIN firsts AS f ON f.customer_id = o.customer_id
  WHERE date_trunc('month', o.ordered_on) = f.cohort + INTERVAL '1 month'
)
SELECT to_char(f.cohort, 'YYYY-MM') AS cohort,
  COUNT(*) AS customers,
  COUNT(n.customer_id) AS returned,
  ROUND(100.0 * COUNT(n.customer_id) / COUNT(*), 1) AS pct
FROM firsts AS f
LEFT JOIN next_month AS n ON n.customer_id = f.customer_id
GROUP BY f.cohort
ORDER BY f.cohort;`,
      ['ทำทีละชั้น: หา cohort ของแต่ละคนก่อน แล้วหาว่าใครมีออเดอร์ในเดือน cohort + 1 เดือน', "date_trunc('month', วันที่) ปัดเป็นต้นเดือน เทียบกับ cohort + INTERVAL '1 month' ใช้ DISTINCT หรือ COUNT(DISTINCT) เพราะคนที่สั่งสองครั้งต้องนับครั้งเดียว และ LEFT JOIN ให้ cohort ที่ไม่มีใครกลับมายังอยู่", "โครง: WITH firsts AS (... date_trunc('month', MIN(ordered_on)) ...), next_month AS (SELECT DISTINCT o.customer_id FROM orders o JOIN firsts f ... WHERE date_trunc('month', o.ordered_on) = f.cohort + INTERVAL '______') SELECT ..., COUNT(*), COUNT(n.customer_id), ROUND(100.0 * COUNT(n.customer_id) / COUNT(*), 1) FROM firsts f LEFT JOIN next_month n ... GROUP BY f.cohort"]),
    task('ตาราง retention: แต่ละ cohort กับเดือนที่ห่างจากเดือนแรก (0 = เดือนแรก) มีลูกค้ายังซื้ออยู่กี่คน แสดงเฉพาะเดือนที่มีคนซื้อ ผลลัพธ์: cohort, จำนวนเดือนที่ห่าง, จำนวนลูกค้า เรียง cohort แล้วจำนวนเดือน', 'Retention matrix',
      `WITH firsts AS (
  SELECT customer_id, date_trunc('month', MIN(ordered_on)) AS cohort FROM orders GROUP BY customer_id
), active AS (
  SELECT DISTINCT customer_id, date_trunc('month', ordered_on) AS month FROM orders
)
SELECT to_char(f.cohort, 'YYYY-MM') AS cohort,
  (EXTRACT(YEAR FROM a.month) - EXTRACT(YEAR FROM f.cohort)) * 12 + EXTRACT(MONTH FROM a.month) - EXTRACT(MONTH FROM f.cohort) AS month_number,
  COUNT(*) AS customers
FROM firsts AS f
JOIN active AS a ON a.customer_id = f.customer_id
GROUP BY f.cohort, a.month
ORDER BY f.cohort, a.month;`,
      ['ต่อยอดจากขั้นที่แล้ว แต่แทนที่จะดูแค่เดือนถัดไป ให้ดูทุกเดือนที่แต่ละคนมีออเดอร์', 'ทำรายการ (ลูกค้า, เดือนที่ซื้อ) แบบไม่ซ้ำ แล้ว JOIN กับ cohort ระยะห่าง = (ปีต่าง × 12) + เดือนต่าง', 'โครง: WITH firsts AS (...), active AS (SELECT DISTINCT customer_id, date_trunc(\'month\', ordered_on) AS month FROM orders) SELECT ..., (EXTRACT(YEAR FROM a.month) - EXTRACT(YEAR FROM f.cohort)) * 12 + EXTRACT(MONTH FROM a.month) - EXTRACT(MONTH FROM ______), COUNT(*) FROM firsts f JOIN active a ... GROUP BY f.cohort, a.month ORDER BY f.cohort, a.month']),
  ],
  debrief: [
    'Cohort analysis แบ่งลูกค้าตามเดือนแรกที่ซื้อ แล้วดูว่าแต่ละกลุ่มยังอยู่กี่คนในเดือนต่อๆ ไป เป็นตัวเลขที่บอร์ดและนักลงทุนถามบ่อยที่สุดตัวหนึ่ง',
    'หลักที่ใช้ได้กับงานวิเคราะห์ทุกแบบ: ทำทีละชั้นด้วย CTE (หาเดือนแรก → หาเดือนที่ active → นับ), นับ "คน" ด้วย DISTINCT ไม่ใช่นับแถว และ LEFT JOIN ให้กลุ่มที่เป็นศูนย์ยังอยู่ในรายงาน',
  ],
  reply: { from: 'Krit · CTO', body: ['บอร์ดชอบตาราง retention มาก cohort กันยายนกลับมาครึ่งหนึ่งถือว่าดีเลย ต่อไปเป็นงานหลังบ้าน: มีคนตั้งราคาเมนูเป็น 0 ทั้งร้าน! ด่วนที่ T-104'] },
};
