import type { Ticket } from './types';

const ONE = (n: number) => [[n]];

export const t04: Ticket = {
  id: 't04',
  no: 'T-104',
  title: 'ราคาเป็นศูนย์ทั้งร้าน',
  from: 'Beam · Intern',
  kind: 'incident',
  level: 5,
  skills: ['BEGIN / COMMIT', 'ROLLBACK', 'UPDATE อย่างปลอดภัย'],
  xp: 400,
  body: [
    'พี่ครับ ช่วยด้วย ผมจะขึ้นราคา Mango Sticky Rice แต่ลืมใส่ WHERE ตอนนี้ทุกเมนูราคา 0 บาท ยังดีที่ผมพิมพ์ BEGIN ไว้ก่อน และยังไม่ได้ COMMIT',
    'คุณกำลังนั่งอยู่หน้าเครื่องของ Beam session เดิมยังเปิดค้างอยู่ งานนี้ตรวจจากสถานะของฐานข้อมูล เมื่อทำแต่ละข้อเสร็จให้กด "ส่งงาน" ในหน้าต่าง ticket',
  ],
  seed: `
CREATE TABLE menu (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  price_baht integer NOT NULL CHECK (price_baht >= 0)
);
INSERT INTO menu (name, price_baht) VALUES
('Mango Sticky Rice', 80), ('Coconut Ice Cream', 60), ('Thai Tea', 45),
('Pandan Jelly', 35), ('Durian Sticky Rice', 150), ('Iced Coffee', 50);

CREATE TABLE stock (
  branch text NOT NULL,
  item text NOT NULL,
  qty integer NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (branch, item)
);
INSERT INTO stock VALUES ('Siam','mango',120), ('Ari','mango',15), ('Siam','sticky rice',40), ('Ari','sticky rice',30);
`,
  afterSeed: 'BEGIN; UPDATE menu SET price_baht = 0;',
  tasks: [
    {
      goal: 'ยกเลิกความเสียหาย: ทำให้ราคาทุกเมนูกลับเป็นเหมือนก่อนที่ Beam จะเริ่ม โดยไม่ต้องพิมพ์ราคาใหม่เอง',
      skill: 'ROLLBACK',
      check: {
        kind: 'state',
        noOpenTxn: true,
        tests: [
          { name: 'ไม่มีเมนูไหนราคา 0 บาท', sql: 'SELECT count(*) FROM menu WHERE price_baht = 0', expect: ONE(0) },
          { name: 'ราคารวมทุกเมนูเท่าเดิม (420 บาท)', sql: 'SELECT sum(price_baht) FROM menu', expect: ONE(420) },
        ],
      },
      hints: [
        'ลอง SELECT * FROM menu ดูก่อน คุณเห็นราคา 0 เพราะอยู่ใน transaction เดียวกับที่แก้ แต่การแก้นั้นยังไม่ถูกบันทึกถาวร (manual บทที่ 8)',
        'transaction ที่ยังไม่ COMMIT ยกเลิกทั้งหมดได้ด้วยคำสั่งเดียว',
        'คำสั่งคือ ROLLBACK',
      ],
      solution: 'ROLLBACK;',
    },
    {
      goal: 'ทำงานเดิมของ Beam ให้ถูก: ขึ้นราคา Mango Sticky Rice เป็น 89 บาท เมนูอื่นห้ามเปลี่ยน และต้องบันทึกถาวร',
      skill: 'BEGIN … COMMIT',
      check: {
        kind: 'state',
        noOpenTxn: true,
        rollbackFirst: true,
        tests: [
          { name: 'Mango Sticky Rice ราคา 89 บาท', sql: "SELECT price_baht FROM menu WHERE name = 'Mango Sticky Rice'", expect: ONE(89) },
          { name: 'เมนูอื่นราคาเท่าเดิม', sql: "SELECT sum(price_baht) FROM menu WHERE name <> 'Mango Sticky Rice'", expect: ONE(340) },
        ],
      },
      hints: [
        'นิสัยที่ดี: BEGIN ก่อน แล้ว UPDATE แล้ว SELECT ตรวจว่าเปลี่ยนเฉพาะแถวที่ตั้งใจ ถ้าถูกค่อย COMMIT ถ้าผิดก็ ROLLBACK',
        "UPDATE ต้องมี WHERE ที่ระบุแถว: WHERE name = 'Mango Sticky Rice'",
        "โครง: BEGIN; UPDATE menu SET price_baht = ______ WHERE name = '______'; COMMIT;",
      ],
      solution: `BEGIN;
UPDATE menu SET price_baht = 89 WHERE name = 'Mango Sticky Rice';
COMMIT;`,
    },
    {
      goal: 'ย้ายมะม่วง 30 ลูกจากสาขา Siam ไปสาขา Ari ใน transaction เดียว (ตาราง stock) จำนวนรวมของทั้งสองสาขาต้องเท่าเดิม',
      skill: 'Atomic update',
      check: {
        kind: 'state',
        noOpenTxn: true,
        rollbackFirst: true,
        tests: [
          { name: 'Siam เหลือมะม่วง 90 ลูก', sql: "SELECT qty FROM stock WHERE branch = 'Siam' AND item = 'mango'", expect: ONE(90) },
          { name: 'Ari มีมะม่วง 45 ลูก', sql: "SELECT qty FROM stock WHERE branch = 'Ari' AND item = 'mango'", expect: ONE(45) },
          { name: 'มะม่วงรวมยังเป็น 135 ลูก', sql: "SELECT sum(qty) FROM stock WHERE item = 'mango'", expect: ONE(135) },
          { name: 'ข้าวเหนียวไม่ถูกแตะ', sql: "SELECT sum(qty) FROM stock WHERE item = 'sticky rice'", expect: ONE(70) },
        ],
      },
      hints: [
        'การย้ายคือสองคำสั่ง UPDATE: ลดที่หนึ่ง เพิ่มอีกที่หนึ่ง ถ้าเกิดเหตุขัดข้องระหว่างสองคำสั่ง ของจะหายไปเฉยๆ จึงต้องครอบด้วย transaction',
        'qty = qty - 30 สำหรับ Siam และ qty = qty + 30 สำหรับ Ari โดยทั้งสองคำสั่งต้องกรอง item = \'mango\' ด้วย',
        "โครง: BEGIN; UPDATE stock SET qty = qty - 30 WHERE branch = 'Siam' AND item = 'mango'; UPDATE stock SET qty = ______ WHERE ______; COMMIT;",
      ],
      solution: `BEGIN;
UPDATE stock SET qty = qty - 30 WHERE branch = 'Siam' AND item = 'mango';
UPDATE stock SET qty = qty + 30 WHERE branch = 'Ari' AND item = 'mango';
COMMIT;`,
    },
  ],
  debrief: [
    'transaction รวมหลายขั้นเป็นงานเดียวแบบ "ได้ทั้งหมดหรือไม่ได้เลย" คนอื่นจะไม่เห็นการเปลี่ยนแปลงจนกว่าจะ COMMIT และก่อน COMMIT ยังยกเลิกได้ทั้งหมดด้วย ROLLBACK',
    'ถ้าไม่พิมพ์ BEGIN Postgres จะ COMMIT ให้ทันทีหลังแต่ละคำสั่ง UPDATE ที่ลืม WHERE จึงแก้คืนไม่ได้ เหตุการณ์จริงของ Beam รอดเพราะ BEGIN บรรทัดเดียว',
  ],
};
