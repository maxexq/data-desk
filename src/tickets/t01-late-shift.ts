import type { Rows } from '../lib/pg';
import type { Ticket } from './types';

const flat = (r: Rows) => r.values.flat().map(String);
const has = (r: Rows, ...xs: string[]) => {
  const f = flat(r);
  return xs.every((x) => f.includes(x));
};

export const t01: Ticket = {
  id: 't01',
  no: 'T-101',
  title: 'The Late Shift',
  from: 'Krit · CTO',
  kind: 'investigate',
  level: 1,
  skills: ['SELECT', 'WHERE', 'JOIN'],
  xp: 100,
  body: [
    'โฟลเดอร์ archive ทั้งโฟลเดอร์บนเซิร์ฟเวอร์ถูกลบเมื่อคืน หลัง 21:00 ทุกคนบอกว่ากลับบ้านไปแล้ว แต่ประตูทุกบานบันทึกการรูดบัตรไว้',
    'ตารางของงานนี้ดูได้ในหน้าต่าง Tables ส่วนคำตอบให้หาด้วยการพิมพ์ query ใน SQL Console ทำตามรายการด้านล่างทีละข้อ ระบบจะตรวจผลลัพธ์ให้เองทุกครั้งที่กด Run',
  ],
  attachments: [
    { id: 'sign', file: 'door_sign.jpg', summary: 'ชื่อห้องสะกดว่า Server Room และทุกครั้งที่รูดบัตรจะเกิด 1 แถวใน door_logs (in หรือ out)' },
    { id: 'memo', file: 'hr_memo.png', summary: 'เลขบัตร (badge_id) คือสิ่งเดียวที่เชื่อม "คน" ในตาราง suspects กับ "การรูดบัตร" ใน door_logs' },
    { id: 'interview', file: 'interviews.png', summary: 'คำให้การทั้งหมดอยู่ในตาราง statements คนพูดอะไรก็ได้ แต่ประตูไม่โกหก' },
    { id: 'syslog', file: 'syslog.txt', fromTask: 2, summary: 'คำสั่งลบถูกพิมพ์ตอน 21:42 จากคีย์บอร์ดในห้อง Server Room คนร้ายต้องอยู่ในห้องตอนนั้น' },
    { id: 'cctv', file: 'cctv_2142.jpg', fromTask: 3, summary: 'กล้องช่วยอะไรไม่ได้ แต่ถ้า 21:42 อยู่ระหว่างเวลา in กับ out ของใคร คนนั้นอยู่ในห้อง' },
  ],
  seed: `
CREATE TABLE suspects (badge_id integer PRIMARY KEY, name text NOT NULL, role text NOT NULL);
INSERT INTO suspects VALUES
(2093,'Lena Park','Accountant'),
(3310,'Dev Okafor','Intern'),
(4471,'Mara Quill','Sysadmin'),
(5128,'Otto Brand','Night Guard'),
(6002,'Iris Vance','Cleaner'),
(7240,'Ben Ashby','Manager');

CREATE TABLE door_logs (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  time text NOT NULL,
  badge_id integer NOT NULL REFERENCES suspects (badge_id),
  door text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out'))
);
INSERT INTO door_logs (time, badge_id, door, direction) VALUES
('08:02',4471,'Lobby','in'),('08:15',2093,'Lobby','in'),('08:31',7240,'Lobby','in'),('08:58',3310,'Lobby','in'),
('10:15',4471,'Server Room','in'),('10:50',4471,'Server Room','out'),
('12:04',2093,'Cafeteria','in'),('12:10',3310,'Cafeteria','in'),('12:12',7240,'Cafeteria','in'),
('12:41',2093,'Cafeteria','out'),('12:55',3310,'Cafeteria','out'),('13:02',7240,'Cafeteria','out'),
('15:20',3310,'Loading Dock','in'),('15:44',3310,'Loading Dock','out'),
('17:35',2093,'Lobby','out'),('18:00',5128,'Lobby','in'),('18:10',7240,'Lobby','out'),('18:30',6002,'Lobby','in'),
('19:02',3310,'Lobby','out'),('19:15',6002,'Cafeteria','in'),('19:50',6002,'Cafeteria','out'),
('20:11',4471,'Server Room','in'),('20:48',4471,'Server Room','out'),('20:55',4471,'Lobby','out'),
('21:05',5128,'Server Room','in'),('21:12',5128,'Server Room','out'),('21:20',6002,'Loading Dock','in'),
('21:30',3310,'Lobby','in'),('21:36',3310,'Server Room','in'),('21:48',6002,'Loading Dock','out'),
('21:58',3310,'Server Room','out'),('22:03',3310,'Lobby','out'),('22:10',6002,'Lobby','out'),
('22:50',5128,'Server Room','in'),('22:55',5128,'Server Room','out'),('23:30',5128,'Loading Dock','in');

CREATE TABLE statements (badge_id integer NOT NULL REFERENCES suspects (badge_id), left_building_at text, statement text NOT NULL);
INSERT INTO statements VALUES
(2093,'17:35','Went home at the usual time.'),
(3310,'19:00','Left around seven. Went straight to bed. Zzz.'),
(4471,'20:30','Was home by half past eight. Ask my cat.'),
(5128,NULL,'On shift all night. Checked every room. And the fridge. Twice.'),
(6002,'22:10','Cleaned the cafeteria and the dock, then left.'),
(7240,'18:10','Left after the budget meeting. It was a long one.');
`,
  tasks: [
    {
      goal: 'ดูรายชื่อผู้ต้องสงสัยทั้งหมดในตาราง suspects',
      skill: 'SELECT',
      check: { kind: 'result', test: (r) => has(r, 'Lena Park', 'Dev Okafor', 'Mara Quill', 'Otto Brand', 'Iris Vance', 'Ben Ashby'), feedback: 'ผลลัพธ์ต้องมีชื่อผู้ต้องสงสัยครบทุกคน ลองสำรวจ suspects โดยยังไม่กรองแถว' },
      hints: [
        'ทุกคำค้นเริ่มด้วย SELECT ตามด้วยสิ่งที่อยากดู แล้ว FROM ตามด้วยชื่อตาราง (manual บทที่ 1)',
        'เครื่องหมาย * แปลว่าเอาทุกคอลัมน์ เหมาะกับการสำรวจตารางครั้งแรก',
        'โครง: SELECT * FROM ______   (เติมชื่อตารางผู้ต้องสงสัย)',
      ],
      solution: 'SELECT * FROM suspects;',
    },
    {
      goal: 'หาบันทึกประตูของห้อง Server Room ที่เกิดหลัง 21:00',
      skill: 'WHERE',
      check: { kind: 'result', test: (r) => has(r, '21:36', '21:05') && !has(r, '20:11') && !has(r, '10:15') && !flat(r).includes('Lobby'), feedback: 'ตรวจทั้งชื่อห้องและเวลาใน WHERE ต้องเป็น Server Room หลัง 21:00 และแสดงเวลาในผลลัพธ์ด้วย' },
      hints: [
        'ใช้ WHERE กรองแถวในตาราง door_logs ถ้ามีสองเงื่อนไขให้เชื่อมด้วย AND (manual บทที่ 2)',
        "รูปป้ายหน้าห้องในไฟล์แนบบอกค่าที่ต้องใช้กับคอลัมน์ door ส่วนเวลาเทียบแบบข้อความได้ เช่น time > '21:00'",
        "โครง: SELECT * FROM door_logs WHERE door = '______' AND time > '______'",
      ],
      solution: "SELECT * FROM door_logs WHERE door = 'Server Room' AND time > '21:00';",
    },
    {
      goal: 'คำสั่งลบถูกพิมพ์ในห้องตอน 21:42 ทำให้ผลลัพธ์มี "ชื่อ" คู่กับเวลาเข้าออกของห้องนั้นหลัง 21:00 ในตารางเดียว',
      skill: 'JOIN',
      check: { kind: 'result', test: (r) => has(r, 'Dev Okafor', '21:36') && !has(r, 'Mara Quill') && r.values.length <= 8, feedback: 'ผลลัพธ์ต้องมีชื่อคู่กับเวลารูดบัตร ตรวจการ JOIN ผ่าน badge_id และคงเงื่อนไขห้องกับเวลาไว้' },
      hints: [
        'door_logs มีแค่ badge_id ไม่มีชื่อ ชื่ออยู่ในตาราง suspects ต้องเอาสองตารางมาต่อกันด้วย JOIN (manual บทที่ 4)',
        'จับคู่ด้วยคอลัมน์ที่มีทั้งสองตาราง: JOIN suspects AS s ON s.badge_id = d.badge_id แล้วคงเงื่อนไข WHERE เดิมไว้',
        "โครง: SELECT s.name, d.time, d.direction FROM door_logs AS d JOIN suspects AS s ON ______ = ______ WHERE d.door = 'Server Room' AND d.time > '21:00'",
      ],
      solution: `SELECT s.name, d.time, d.direction
FROM door_logs AS d
JOIN suspects AS s ON s.badge_id = d.badge_id
WHERE d.door = 'Server Room' AND d.time > '21:00'
ORDER BY d.time;`,
    },
    {
      goal: 'ปิดงาน: ดูคู่ in / out ว่าใครอยู่ในห้องตอน 21:42 แล้วรัน query ที่คืนแถวเดียว คอลัมน์เดียว คือชื่อของคนคนนั้น',
      skill: 'WHERE',
      check: { kind: 'result', test: (r) => r.values.length === 1 && r.values[0].length === 1 && r.values[0][0] === 'Dev Okafor', feedback: 'ส่งเฉพาะชื่อหนึ่งคน เป็นหนึ่งแถวหนึ่งคอลัมน์ โดยเวลา in / out ของคนนั้นต้องครอบคลุม 21:42' },
      hints: [
        'จากผลลัพธ์ข้อก่อน หาคนที่มีเวลา in ก่อน 21:42 และเวลา out หลัง 21:42',
        'เมื่อรู้ว่าเป็นใครแล้ว เลือกเฉพาะคอลัมน์ name จากตาราง suspects และกรองให้เหลือคนเดียว',
        'โครง: SELECT name FROM suspects WHERE badge_id = ______',
      ],
      solution: 'SELECT name FROM suspects WHERE badge_id = 3310;',
    },
  ],
  debrief: [
    'Dev Okafor เด็กฝึกงาน ออกจากตึกตอน 19:02 ตามที่ให้การ แต่รูดบัตรกลับเข้ามาตอน 21:30 แล้วอยู่ในห้อง Server Room ตั้งแต่ 21:36 ถึง 21:58 ซึ่งครอบเวลา 21:42',
    'สิ่งที่ได้ฝึก: อ่านตารางด้วย SELECT กรองด้วย WHERE และต่อสองตารางด้วย JOIN ผ่านคอลัมน์ที่ใช้ร่วมกัน',
  ],
  reply: { from: 'Krit · CTO', body: [
    'ได้รับหลักฐานแล้ว ผมจะคุยกับ Dev ต่อเอง ขอบคุณที่ไล่จากบันทึกประตู ไม่ได้ตัดสินจากคำให้การอย่างเดียว',
    'Nok ฝ่ายการตลาดฝากกรองรายชื่อลูกค้าใน T-101A ส่วน Ploy ฝ่าย Sales รอให้จัดรายการใน T-101B ก่อนรวมยอดใน T-102 นะ',
  ] },
};
