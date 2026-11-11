import type { Task, Ticket } from './types';

// These tasks compare complete results, including duplicate rows and requested ordering.
const task = (goal: string, skill: string, solution: string, hints: Task['hints'], ordered = true): Task => ({
  goal, skill, solution, hints, check: { kind: 'result', expect: solution, ordered },
});
const format = 'จำนวนและลำดับคอลัมน์ต้องตรงตามโจทย์ ตั้งชื่อคอลัมน์เองได้ และเรียงแถวตามที่ระบุ';

export const sorting: Ticket = {
  id: 'f01', no: 'T-101B', title: 'จัดรายการก่อนประชุม', from: 'Ploy · Sales', kind: 'request', level: 2, xp: 100,
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
  id: 'f02', no: 'T-102B', title: 'ลูกค้าที่หายไปจากรายงาน', from: 'Mint · HR', kind: 'investigate', level: 3, xp: 120,
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
  reply: { from: 'Mint · HR', body: ['ได้รายชื่อครบแล้วค่ะ ก่อนจัดอันดับยอดขาย ช่วยตรวจช่วงวันที่และจัดกลุ่มยอดใน T-102C ต่ออีกนิดนะคะ'] },
};

export const dates: Ticket = {
  id: 'f03', no: 'T-102C', title: 'ยอดขายรอยต่อเดือน', from: 'Ploy · Sales', kind: 'request', level: 3, xp: 120,
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
  reply: { from: 'Ploy · Sales', body: ['ตัวเลขรอยต่อเดือนถูกต้องแล้วค่ะ แต่ Fon ฝ่ายบัญชีเพิ่งโทรมาว่ายอดในรายงานสาขาไม่ตรงกับเงินที่รับจริง ช่วยดู T-102D ก่อนนะคะ'] },
};

export const filtering: Ticket = {
  id: 'f04', no: 'T-101A', title: 'หาลูกค้าให้ถูกคน', from: 'Nok · Marketing', kind: 'request', level: 2, xp: 100,
  skills: ['AND / OR', 'IN', 'ILIKE', 'NOT EXISTS'],
  body: ['ฝ่ายการตลาดจะส่งคูปองข้าวเหนียวมะม่วง แต่รายชื่อรอบก่อนส่งผิดคนไปครึ่งหนึ่ง รอบนี้ช่วยกรองให้แม่นทีละกลุ่มนะ', format],
  seed: `CREATE TABLE customers (id integer PRIMARY KEY, name text NOT NULL, city text NOT NULL, tier text NOT NULL, email text NOT NULL, referred_by integer REFERENCES customers(id));
INSERT INTO customers VALUES (1,'Anya','Bangkok','gold','anya@gmail.com',NULL),(2,'Ben','Chiang Mai','silver','Ben@GMAIL.com',1),(3,'Chai','Chiang Mai','gold','chai@mango.co',1),(4,'Dao','Phuket','gold','dao@gmail.com',NULL),(5,'Eve','Bangkok','silver','eve@gmail.com.th',3),(6,'Fai','Bangkok','gold','fai@Gmail.com',NULL),(7,'Gun','Khon Kaen','silver','gun@hotmail.com',2);`,
  tasks: [
    task("หาลูกค้าระดับ 'gold' ที่อยู่ 'Bangkok' หรือ 'Chiang Mai' ผลลัพธ์: id, name เรียง id จากน้อยไปมาก", 'AND / OR + IN',
      "SELECT id, name FROM customers WHERE tier = 'gold' AND city IN ('Bangkok', 'Chiang Mai') ORDER BY id;",
      ['AND ทำงานก่อน OR เหมือนคูณก่อนบวก ถ้าเขียนเรียงกันเฉยๆ ความหมายจะเปลี่ยน', "tier = 'gold' AND city = 'Bangkok' OR city = 'Chiang Mai' จะได้คน Chiang Mai ทุกระดับมาด้วย ใส่วงเล็บหรือใช้ IN", "โครง: SELECT id, name FROM customers WHERE tier = 'gold' AND city IN ('Bangkok', '______') ORDER BY id"]),
    task('หาลูกค้าที่ใช้อีเมล @gmail.com ไม่ว่าจะพิมพ์ตัวเล็กหรือตัวใหญ่ ผลลัพธ์: id, email เรียง id จากน้อยไปมาก', 'ILIKE',
      "SELECT id, email FROM customers WHERE email ILIKE '%@gmail.com' ORDER BY id;",
      ['LIKE แยกตัวพิมพ์เล็กกับใหญ่ ส่วน ILIKE ไม่แยก (หรือใช้ lower(email) LIKE ...)', "% แทนตัวอักษรกี่ตัวก็ได้ ให้ % อยู่หน้าอย่างเดียว เพื่อไม่ให้ได้ gmail.com.th มาด้วย", "โครง: SELECT id, email FROM customers WHERE email ILIKE '______' ORDER BY id"]),
    task('หาลูกค้าที่ยังไม่เคยแนะนำใครมาเลย (ไม่มีใครมี referred_by เป็น id ของเขา) ผลลัพธ์: id, name เรียง id จากน้อยไปมาก', 'NOT EXISTS',
      'SELECT c.id, c.name FROM customers AS c WHERE NOT EXISTS (SELECT 1 FROM customers AS r WHERE r.referred_by = c.id) ORDER BY c.id;',
      ['ลอง NOT IN (SELECT referred_by FROM customers) ดู แล้วสังเกตว่าทำไมได้ 0 แถว', 'referred_by มี NULL อยู่ x NOT IN (1, 2, NULL) จึงไม่เคยเป็นจริง ใช้ NOT EXISTS ซึ่งไม่สะดุด NULL', 'โครง: SELECT c.id, c.name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM customers r WHERE r.referred_by = ______) ORDER BY c.id']),
  ],
  debrief: ['AND ผูกแน่นกว่า OR จึงควรใส่วงเล็บหรือใช้ IN ทุกครั้งที่ผสมกัน ILIKE เทียบโดยไม่สนตัวพิมพ์ และ NOT IN กับ subquery ที่มี NULL จะได้ผลว่างเปล่าเสมอ ใช้ NOT EXISTS แทนจะปลอดภัยกว่า'],
  reply: { from: 'Nok · Marketing', body: ['คูปองรอบนี้ถึงมือถูกคนแล้ว ขอบคุณมาก! Ploy ฝ่ายขายรอให้ช่วยจัดรายการก่อนประชุมใน T-101B อยู่นะ'] },
};

export const averages: Ticket = {
  id: 'f05', no: 'T-102A', title: 'ค่าเฉลี่ยที่หลอกตา', from: 'Ploy · Sales', kind: 'investigate', level: 3, xp: 120,
  skills: ['COUNT(col)', 'COUNT(DISTINCT)', 'NULLIF', 'Weighted average'],
  body: ['ผู้จัดการสาขาเถียงกันว่าใครรีวิวดีกว่าและใครขายเก่งกว่า แต่ตัวเลขในสไลด์คนละชุดกันเลยค่ะ ช่วยคำนวณใหม่ให้ถูกที', 'stars เป็น NULL เมื่อลูกค้าเขียนรีวิวแต่ไม่ให้ดาว และ visitors เป็น 0 ในวันที่สาขาปิด', format],
  seed: `CREATE TABLE reviews (id integer PRIMARY KEY, branch text NOT NULL, customer_id integer NOT NULL, stars integer CHECK (stars BETWEEN 1 AND 5));
INSERT INTO reviews VALUES (1,'Ari',10,5),(2,'Ari',11,NULL),(3,'Ari',10,4),(4,'Siam',12,3),(5,'Siam',13,NULL),(6,'Siam',14,NULL),(7,'Siam',12,5),(8,'Nimman',15,2);
CREATE TABLE traffic (branch text NOT NULL, day date NOT NULL, visitors integer NOT NULL, orders integer NOT NULL, PRIMARY KEY (branch, day));
INSERT INTO traffic VALUES ('Ari','2026-11-01',200,23),('Ari','2026-11-02',12,5),('Siam','2026-11-01',500,41),('Siam','2026-11-02',0,0),('Nimman','2026-11-01',100,30),('Nimman','2026-11-02',300,31);`,
  tasks: [
    task('สรุปรีวิวรายสาขา ผลลัพธ์: branch, จำนวนรีวิวทั้งหมด, จำนวนรีวิวที่ให้ดาว, จำนวนลูกค้าไม่ซ้ำ, ดาวเฉลี่ยปัดทศนิยม 2 ตำแหน่ง เรียงชื่อสาขา', 'COUNT(*) / COUNT(col) / COUNT(DISTINCT)',
      'SELECT branch, COUNT(*), COUNT(stars), COUNT(DISTINCT customer_id), ROUND(AVG(stars), 2) FROM reviews GROUP BY branch ORDER BY branch;',
      ['COUNT(*) นับแถว COUNT(stars) นับเฉพาะแถวที่ stars ไม่เป็น NULL และ COUNT(DISTINCT customer_id) นับคนไม่ซ้ำ', 'AVG ข้าม NULL ให้เองอยู่แล้ว ถ้าแปลง NULL เป็น 0 จะกดค่าเฉลี่ยให้ต่ำเกินจริง', 'โครง: SELECT branch, COUNT(*), COUNT(______), COUNT(DISTINCT ______), ROUND(AVG(stars), 2) FROM reviews GROUP BY branch ORDER BY branch']),
    task('อัตราซื้อต่อวัน (ออเดอร์ ÷ คนเข้าร้าน × 100) ปัดทศนิยม 1 ตำแหน่ง วันที่ไม่มีคนเข้าให้เป็น NULL ผลลัพธ์: branch, day, อัตรา เรียง day แล้ว branch', 'NULLIF',
      'SELECT branch, day, ROUND(100.0 * orders / NULLIF(visitors, 0), 1) FROM traffic ORDER BY day, branch;',
      ['หารด้วย 0 ทำให้ทั้ง query พัง ส่วน int ÷ int ปัดเศษทิ้ง (5 / 12 = 0)', 'NULLIF(visitors, 0) คืน NULL เมื่อ visitors เป็น 0 และการหารด้วย NULL ได้ NULL ไม่ error คูณด้วย 100.0 ก่อนเพื่อให้เป็นทศนิยม', 'โครง: SELECT branch, day, ROUND(100.0 * orders / NULLIF(______, 0), 1) FROM traffic ORDER BY day, branch']),
    task('อัตราซื้อรวมของแต่ละสาขาตลอดช่วง ปัดทศนิยม 1 ตำแหน่ง ผลลัพธ์: branch, อัตรา เรียงชื่อสาขา', 'Weighted average',
      'SELECT branch, ROUND(100.0 * SUM(orders) / NULLIF(SUM(visitors), 0), 1) FROM traffic GROUP BY branch ORDER BY branch;',
      ['ค่าเฉลี่ยของเปอร์เซ็นต์รายวันให้วันที่คนน้อยมีน้ำหนักเท่าวันที่คนเยอะ', 'รวมออเดอร์ทั้งหมด ÷ รวมคนเข้าทั้งหมด แทน AVG ของอัตรารายวัน', 'โครง: SELECT branch, ROUND(100.0 * SUM(orders) / NULLIF(SUM(______), 0), 1) FROM traffic GROUP BY branch ORDER BY branch']),
  ],
  debrief: ['COUNT(*), COUNT(col) และ COUNT(DISTINCT col) ตอบคำถามต่างกัน AVG ข้าม NULL อยู่แล้ว ใช้ NULLIF กันหารศูนย์ และคูณ 100.0 กันการปัดเศษแบบจำนวนเต็ม ส่วนอัตรารวมต้องคิดจากผลรวมทั้งสองฝั่ง ไม่ใช่เฉลี่ยเปอร์เซ็นต์รายวัน'],
  reply: { from: 'Ploy · Sales', body: ['สไลด์ตรงกันแล้วค่ะ Ari ไม่ได้ขายเก่งขนาดนั้นจริงๆ ด้วย 555 ต่อไป Mint ฝากตรวจรายชื่อลูกค้าใน T-102B นะคะ'] },
};

export const fanout: Ticket = {
  id: 'f06', no: 'T-102D', title: 'ยอดขายบวมสามเท่า', from: 'Fon · Finance', kind: 'incident', level: 4, xp: 150,
  skills: ['JOIN fan-out', 'Pre-aggregation (CTE)', 'Reconciliation'],
  body: [
    'รายงานสาขาที่ทีมทำไว้บอกว่าเก็บเงินได้มากกว่ายอดขาย ซึ่งเป็นไปไม่ได้ ฝ่ายบัญชีต้องปิดงบคืนนี้ ช่วยหาว่าตัวเลขบวมจากไหน แล้วทำรายงานที่ถูกให้หน่อย',
    'ออเดอร์หนึ่งมีอาหารได้หลายรายการ (order_items) และจ่ายได้หลายครั้ง เช่นแยกบิล (payments)',
    format,
  ],
  seed: `CREATE TABLE orders (id integer PRIMARY KEY, branch text NOT NULL);
INSERT INTO orders VALUES (1,'Ari'),(2,'Ari'),(3,'Siam'),(4,'Siam'),(5,'Nimman');
CREATE TABLE order_items (order_id integer NOT NULL REFERENCES orders(id), menu text NOT NULL, qty integer NOT NULL, price_baht integer NOT NULL);
INSERT INTO order_items VALUES (1,'ข้าวเหนียวมะม่วง',2,120),(1,'ชาไทย',1,60),(2,'ข้าวเหนียวมะม่วง',1,120),(3,'ข้าวเหนียวมะม่วง',3,120),(3,'ชาไทย',2,60),(3,'น้ำมะพร้าว',1,50),(4,'ชาไทย',1,60),(5,'ข้าวเหนียวมะม่วง',1,120),(5,'น้ำมะพร้าว',2,50);
CREATE TABLE payments (id integer PRIMARY KEY, order_id integer NOT NULL REFERENCES orders(id), method text NOT NULL, amount_baht integer NOT NULL);
INSERT INTO payments VALUES (1,1,'cash',300),(2,2,'qr',60),(3,2,'cash',60),(4,3,'card',300),(5,3,'qr',230),(6,5,'qr',100);`,
  tasks: [
    task('ยอดขายตามรายการอาหารของแต่ละสาขา (qty × price_baht) ผลลัพธ์: branch, ยอดขาย เรียงชื่อสาขา', 'JOIN + SUM',
      'SELECT o.branch, SUM(i.qty * i.price_baht) FROM orders AS o JOIN order_items AS i ON i.order_id = o.id GROUP BY o.branch ORDER BY o.branch;',
      ['ยอดขายอยู่ที่ order_items แต่ชื่อสาขาอยู่ที่ orders', 'JOIN ด้วย i.order_id = o.id แล้ว GROUP BY สาขา', 'โครง: SELECT o.branch, SUM(i.qty * i.price_baht) FROM orders o JOIN order_items i ON i.order_id = o.id GROUP BY ______ ORDER BY o.branch']),
    task('รายงานสาขา: ยอดขายคู่กับยอดที่ชำระแล้ว ผลลัพธ์: branch, ยอดขาย, ยอดชำระ เรียงชื่อสาขา', 'Pre-aggregation',
      `WITH sold AS (
  SELECT o.branch, SUM(i.qty * i.price_baht) AS sold FROM orders AS o JOIN order_items AS i ON i.order_id = o.id GROUP BY o.branch
), paid AS (
  SELECT o.branch, SUM(p.amount_baht) AS paid FROM orders AS o JOIN payments AS p ON p.order_id = o.id GROUP BY o.branch
)
SELECT sold.branch, sold.sold, COALESCE(paid.paid, 0) FROM sold LEFT JOIN paid ON paid.branch = sold.branch ORDER BY sold.branch;`,
      ['ถ้า JOIN orders กับ order_items และ payments พร้อมกัน ออเดอร์ที่มีอาหาร 2 รายการ × จ่าย 2 ครั้งจะกลายเป็น 4 แถว แล้ว SUM ก็นับซ้ำ', 'รวมแต่ละตารางให้เหลือหนึ่งแถวต่อสาขาก่อน (pre-aggregate) ใน CTE แยกกัน แล้วค่อย JOIN ผลรวมเข้าด้วยกัน', 'โครง: WITH sold AS (... GROUP BY o.branch), paid AS (... GROUP BY o.branch) SELECT sold.branch, sold.sold, COALESCE(paid.paid, 0) FROM sold LEFT JOIN paid ON ______ ORDER BY sold.branch']),
    task('ออเดอร์ที่ยังจ่ายไม่ครบ ผลลัพธ์: id, branch, ยอดที่ต้องจ่าย, ยอดที่จ่ายแล้ว (ไม่มีให้เป็น 0), ยอดค้าง เรียง id จากน้อยไปมาก', 'Reconciliation',
      `WITH due AS (
  SELECT order_id, SUM(qty * price_baht) AS due FROM order_items GROUP BY order_id
), paid AS (
  SELECT order_id, SUM(amount_baht) AS paid FROM payments GROUP BY order_id
)
SELECT o.id, o.branch, due.due, COALESCE(paid.paid, 0), due.due - COALESCE(paid.paid, 0)
FROM orders AS o
JOIN due ON due.order_id = o.id
LEFT JOIN paid ON paid.order_id = o.id
WHERE due.due > COALESCE(paid.paid, 0)
ORDER BY o.id;`,
      ['คิดยอดต้องจ่ายและยอดจ่ายแล้วต่อออเดอร์แยกกันก่อน เหมือนขั้นที่แล้วแต่ GROUP BY order_id', 'ออเดอร์ที่ยังไม่จ่ายเลยไม่มีแถวใน payments ต้อง LEFT JOIN และ COALESCE เป็น 0 ไม่อย่างนั้นออเดอร์นั้นจะหายไป', 'โครง: ... FROM orders o JOIN due ON due.order_id = o.id LEFT JOIN paid ON paid.order_id = o.id WHERE due.due > COALESCE(______, 0) ORDER BY o.id']),
  ],
  debrief: [
    'JOIN ตารางลูกหลายตารางที่ต่างคนต่างมีหลายแถวต่อแม่ (fan-out) ทำให้แถวคูณกันและ SUM นับซ้ำ วิธีแก้คือรวมแต่ละตารางให้เหลือหนึ่งแถวต่อ key ก่อน แล้วค่อย JOIN ผลรวม',
    'การกระทบยอด (reconciliation) แบบนี้ใช้จริงทุกครั้งที่ปิดงบ: คิดสองฝั่งแยกกัน, LEFT JOIN ให้ฝั่งที่ยังไม่มีข้อมูลไม่หาย, แล้วดูส่วนต่าง',
  ],
  reply: { from: 'Fon · Finance', body: ['ปิดงบทันเที่ยงคืนพอดี! ส่วนที่ค้างจ่ายสองออเดอร์ แจ้งสาขาให้ตามเก็บแล้ว Mint บอกว่าพร้อมจัดอันดับพนักงานใน T-103 แล้วนะ'] },
};
