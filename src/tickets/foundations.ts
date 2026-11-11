import type { Task, Ticket } from './types';

// These tasks compare complete results, including duplicate rows and requested ordering.
const task = (goal: string, skill: string, solution: string, hints: Task['hints'], ordered = true): Task => ({
  goal, skill, solution, hints, check: { kind: 'result', expect: solution, ordered },
});
const format = 'จำนวนและลำดับคอลัมน์ต้องตรงตามโจทย์ ตั้งชื่อคอลัมน์เองได้ และเรียงแถวตามที่ระบุ';

export const sorting: Ticket = {
  id: 'f01', no: 'T-101A', title: 'จัดรายการก่อนประชุม', from: 'Ploy · Sales', kind: 'request', level: 2, xp: 100,
  skills: ['ORDER BY', 'LIMIT', 'DISTINCT'],
  body: ['ก่อนสรุปยอดรายสาขา ช่วยจัดรายการออเดอร์ให้ทีมตรวจหน่อยค่ะ มีทั้งยอดเท่ากันและสาขาที่ปรากฏหลายครั้ง', format],
  seed: `CREATE TABLE orders (id integer PRIMARY KEY, branch text NOT NULL, total_baht integer NOT NULL);
INSERT INTO orders VALUES (101,'Siam',450),(102,'Ari',700),(103,'Siam',700),(104,'Nimman',180),(105,'Ari',450),(106,'Siam',90),(107,'Nimman',700);`,
  tasks: [
    task('แสดงออเดอร์ทั้งหมด 3 คอลัมน์: id, branch, total_baht เรียงยอดจากมากไปน้อย ถ้ายอดเท่ากันเรียง id จากน้อยไปมาก', 'ORDER BY',
      'SELECT id, branch, total_baht FROM orders ORDER BY total_baht DESC, id ASC;',
      ['ORDER BY เรียงผลลัพธ์ ส่วน DESC คือมากไปน้อย', 'เพิ่มคอลัมน์ที่สองใน ORDER BY เพื่อกำหนดลำดับเมื่อยอดเท่ากัน', 'โครง: SELECT id, branch, total_baht FROM orders ORDER BY total_baht DESC, ______ ASC']),
    task('เลือกออเดอร์ยอดสูงสุด 3 รายการ ผลลัพธ์: id, total_baht เรียงยอดมากไปน้อย ถ้าเท่ากันเรียง id น้อยไปมาก', 'LIMIT',
      'SELECT id, total_baht FROM orders ORDER BY total_baht DESC, id ASC LIMIT 3;',
      ['เรียงรายการก่อน แล้วจำกัดจำนวนแถวด้วย LIMIT', 'LIMIT อย่างเดียวไม่ได้รับประกันว่าจะได้รายการยอดสูงสุด', 'โครง: SELECT id, total_baht FROM orders ORDER BY total_baht DESC, id ASC LIMIT ______']),
    task('แสดงชื่อสาขาที่มีออเดอร์ ไม่ซ้ำกัน ผลลัพธ์ 1 คอลัมน์: branch เรียงชื่อตามตัวอักษร', 'DISTINCT',
      'SELECT DISTINCT branch FROM orders ORDER BY branch;',
      ['DISTINCT ตัดแถวผลลัพธ์ที่ซ้ำกัน', 'เลือกเฉพาะ branch ถ้าเลือก id ด้วย แต่ละแถวจะไม่ซ้ำกันอยู่แล้ว', 'โครง: SELECT DISTINCT ______ FROM orders ORDER BY branch']),
  ],
  debrief: ['ORDER BY หลายคอลัมน์ทำให้ผลลัพธ์แน่นอนแม้ยอดเท่ากัน ใช้ก่อน LIMIT เพื่อเลือกอันดับต้น ๆ ส่วน DISTINCT พิจารณาทุกคอลัมน์ที่เลือก'],
  reply: { from: 'Ploy · Sales', body: ['รายการพร้อมแล้วค่ะ ต่อไปใน T-102 มาลองรวมออเดอร์เหล่านี้เป็นยอดรายสาขากัน'] },
};

export const missing: Ticket = {
  id: 'f02', no: 'T-102A', title: 'ลูกค้าที่หายไปจากรายงาน', from: 'Mint · HR', kind: 'investigate', level: 3, xp: 120,
  skills: ['IS NULL', 'LEFT JOIN', 'COALESCE'],
  body: ['ทีมกำลังเตรียมโทรขอบคุณลูกค้า แต่บางคนยังไม่มีเบอร์ และคนที่ไม่เคยสั่งซื้อหายไปจากรายงาน ช่วยหาทั้งสองกลุ่มก่อนค่ะ', format],
  seed: `CREATE TABLE customers (id integer PRIMARY KEY, name text NOT NULL, phone text);
INSERT INTO customers VALUES (1,'Anya','0811111111'),(2,'Ben',NULL),(3,'Chai','0833333333'),(4,'Dao',NULL),(5,'Eve','0855555555');
CREATE TABLE orders (id integer PRIMARY KEY, customer_id integer NOT NULL REFERENCES customers(id), total_baht integer NOT NULL);
INSERT INTO orders VALUES (101,1,200),(102,1,300),(103,2,150),(104,4,400);`,
  tasks: [
    task('หาลูกค้าที่ยังไม่มีเบอร์โทร ผลลัพธ์: id, name เรียง id จากน้อยไปมาก', 'IS NULL',
      'SELECT id, name FROM customers WHERE phone IS NULL ORDER BY id;',
      ['NULL หมายถึงไม่มีค่าที่ทราบ ใช้ = NULL เพื่อตรวจไม่ได้', 'ใช้ IS NULL กับคอลัมน์ phone', 'โครง: SELECT id, name FROM customers WHERE ______ IS NULL ORDER BY id']),
    task('หาลูกค้าที่ไม่เคยมีออเดอร์ ผลลัพธ์: id ของลูกค้า, name เรียง id จากน้อยไปมาก', 'LEFT JOIN',
      'SELECT c.id, c.name FROM customers AS c LEFT JOIN orders AS o ON o.customer_id = c.id WHERE o.id IS NULL ORDER BY c.id;',
      ['LEFT JOIN เก็บลูกค้าทางซ้ายไว้ แม้จะไม่มีออเดอร์ที่จับคู่ได้', 'หลัง JOIN แถวที่ไม่พบออเดอร์จะมี o.id เป็น NULL ต่างจากการไม่มีเบอร์โทร', 'โครง: SELECT c.id, c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE ______ IS NULL ORDER BY c.id']),
    task("แสดงลูกค้าทุกคน ผลลัพธ์: id, name, เบอร์โทร โดยแทน NULL ด้วยข้อความ 'ไม่ระบุ' เรียง id จากน้อยไปมาก", 'COALESCE',
      "SELECT id, name, COALESCE(phone, 'ไม่ระบุ') AS phone FROM customers ORDER BY id;",
      ['COALESCE เลือกค่าแรกที่ไม่เป็น NULL', 'ใส่ phone เป็นตัวแรกและข้อความสำรองเป็นตัวที่สอง ไม่ต้อง UPDATE ข้อมูลจริง', "โครง: SELECT id, name, COALESCE(phone, '______') FROM customers ORDER BY id"]),
  ],
  debrief: ['ข้อมูลที่ไม่มีค่าและแถวที่ไม่มีคู่เป็นคนละเรื่อง ใช้ IS NULL ตรวจค่า และ LEFT JOIN เพื่อรักษาแถวที่ไม่มีคู่ ส่วน COALESCE เปลี่ยนเฉพาะสิ่งที่แสดงในผลลัพธ์'],
  reply: { from: 'Mint · HR', body: ['ได้รายชื่อครบแล้วค่ะ ก่อนจัดอันดับยอดขาย ช่วยตรวจช่วงวันที่และจัดกลุ่มยอดใน T-102B ต่ออีกนิดนะคะ'] },
};

export const dates: Ticket = {
  id: 'f03', no: 'T-102B', title: 'ยอดขายรอยต่อเดือน', from: 'Ploy · Sales', kind: 'request', level: 3, xp: 120,
  skills: ['Date ranges', 'CASE', 'COUNT / SUM'],
  body: ['รายงานเดือนพฤศจิกายนมีรายการคืนวันที่ 30 และเที่ยงคืนวันที่ 1 ธันวาคม ช่วยแบ่งเดือนให้ถูกแล้วจัดกลุ่มยอดขายก่อนส่งให้ HR ค่ะ', 'ordered_at เป็น timestamp ใช้ช่วงวันที่แบบรวมจุดเริ่ม แต่ไม่รวมจุดสิ้นสุด เพื่อเก็บรายการทุกเวลาในเดือน', format],
  seed: `CREATE TABLE orders (id integer PRIMARY KEY, ordered_at timestamp NOT NULL, total_baht integer NOT NULL);
INSERT INTO orders VALUES (1,'2026-10-31 23:59:59',700),(2,'2026-11-01 00:00:00',99),(3,'2026-11-15 12:00:00',100),(4,'2026-11-20 09:00:00',499),(5,'2026-11-30 23:59:59',500),(6,'2026-12-01 00:00:00',900);`,
  tasks: [
    task('เลือกออเดอร์เฉพาะเดือนพฤศจิกายน 2026 ผลลัพธ์: id, total_baht เรียง id จากน้อยไปมาก', 'Date ranges',
      "SELECT id, total_baht FROM orders WHERE ordered_at >= DATE '2026-11-01' AND ordered_at < DATE '2026-12-01' ORDER BY id;",
      ['อย่าตัดช่วงที่เที่ยงคืนของวันสุดท้าย เพราะยังมีออเดอร์หลังเวลานั้น', 'ใช้ >= วันแรกของเดือน และ < วันแรกของเดือนถัดไป', "โครง: SELECT id, total_baht FROM orders WHERE ordered_at >= DATE '2026-11-01' AND ordered_at < DATE '______' ORDER BY id"]),
    task("จัดกลุ่มออเดอร์ทุกเดือน ผลลัพธ์: id, กลุ่มยอด โดยต่ำกว่า 100 เป็น 'small', 100–499 เป็น 'medium', ตั้งแต่ 500 เป็น 'large' เรียง id จากน้อยไปมาก", 'CASE',
      "SELECT id, CASE WHEN total_baht < 100 THEN 'small' WHEN total_baht < 500 THEN 'medium' ELSE 'large' END AS size FROM orders ORDER BY id;",
      ['CASE เลือกผลจากเงื่อนไขแรกที่เป็นจริง', 'ตรวจ < 100 ก่อน แล้ว < 500 จะครอบคลุมช่วงกลางที่เหลือ', "โครง: SELECT id, CASE WHEN total_baht < 100 THEN 'small' WHEN total_baht < ______ THEN 'medium' ELSE 'large' END FROM orders ORDER BY id"]),
    task('สรุปออเดอร์เดือนพฤศจิกายน 2026 เป็นแถวเดียว ผลลัพธ์: จำนวนออเดอร์, ยอดรวม', 'WHERE + COUNT / SUM',
      "SELECT COUNT(*), SUM(total_baht) FROM orders WHERE ordered_at >= DATE '2026-11-01' AND ordered_at < DATE '2026-12-01';",
      ['ใช้ช่วงวันที่จากขั้นแรก แล้วสรุปแถวที่เหลือ', 'COUNT(*) นับออเดอร์ ส่วน SUM(total_baht) รวมยอด ไม่ต้อง GROUP BY เมื่อขอรวมทั้งหมดเป็นหนึ่งแถว', "โครง: SELECT COUNT(*), SUM(______) FROM orders WHERE ordered_at >= DATE '2026-11-01' AND ordered_at < DATE '2026-12-01'"]),
  ],
  debrief: ['ช่วงแบบ >= จุดเริ่ม และ < จุดจบ ไม่ทำข้อมูลปลายวันตกหล่น และ CASE ต้องเรียงเงื่อนไขให้ครอบคลุมค่าตรงรอยต่อด้วย ขั้นต่อไปจะใช้ข้อมูลรายเดือนฝึกจัดอันดับ'],
  reply: { from: 'Ploy · Sales', body: ['ตัวเลขรอยต่อเดือนถูกต้องแล้วค่ะ พร้อมส่งต่อให้ Mint จัดอันดับพนักงานใน T-103 แล้ว'] },
};
