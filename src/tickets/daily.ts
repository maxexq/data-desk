// The daily ticket: same shape as any other ticket, but the data and the
// question come from the date, so every day is new and nobody can memorise it.
import type { Task, Ticket } from './types';

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const BRANCHES = ['Siam', 'Ari', 'Nimman', 'Old Town', 'Thonglor'];

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayKey(d);
};

interface Order {
  id: number;
  branch: number;
  day: string;
  total: number;
  status: 'paid' | 'refunded';
}

function makeOrders(date: string, salt: number): Order[] {
  const r = rng(hash(date) + salt);
  return Array.from({ length: 48 }, (_, i) => {
    const branch = 1 + Math.floor(r() * BRANCHES.length);
    return {
      id: 1001 + i,
      branch,
      day: addDays(date, -Math.floor(r() * 7)),
      total: 40 + Math.floor(r() * 460),
      // Branch 1 never refunds, so "branches without refunds" always has an answer.
      status: branch !== 1 && r() < 0.18 ? 'refunded' : 'paid',
    };
  });
}

/** No two groups may share the same sum, otherwise "the top one" has no single right answer. */
function distinctSums(orders: Order[]): boolean {
  const by = (keyOf: (o: Order) => string) => {
    const m = new Map<string, number>();
    for (const o of orders) if (o.status === 'paid') m.set(keyOf(o), (m.get(keyOf(o)) ?? 0) + o.total);
    return new Set(m.values()).size === m.size;
  };
  return by((o) => String(o.branch)) && by((o) => o.day);
}

export function makeDaily(date: string): Ticket {
  let salt = 0;
  let orders = makeOrders(date, salt);
  while (!distinctSums(orders)) orders = makeOrders(date, ++salt);

  const pick = hash(date);
  const branch = BRANCHES[pick % BRANCHES.length];
  const floor = 200 + (pick % 5) * 50;

  const templates: Task[] = [
    {
      goal: `ออเดอร์ของสาขา ${branch} ที่ยอดตั้งแต่ ${floor} บาทขึ้นไป ผลลัพธ์ 2 คอลัมน์: id ของออเดอร์, ยอด เรียงจากยอดมากไปน้อย (ยอดเท่ากันเรียงตาม id)`,
      skill: 'JOIN + WHERE + ORDER BY',
      check: {
        kind: 'result',
        ordered: true,
        expect: `SELECT o.id, o.total_baht FROM orders o JOIN branches b ON b.id = o.branch_id WHERE b.name = '${branch}' AND o.total_baht >= ${floor} ORDER BY o.total_baht DESC, o.id`,
      },
      hints: [
        'ชื่อสาขาอยู่ในตาราง branches ส่วนยอดอยู่ใน orders ต้อง JOIN ด้วย branch_id',
        'กรองสองเงื่อนไขด้วย AND แล้วเรียงด้วย ORDER BY สองคอลัมน์',
        `โครง: SELECT o.id, o.total_baht FROM orders AS o JOIN branches AS b ON b.id = o.branch_id WHERE b.name = '______' AND o.total_baht >= ______ ORDER BY o.total_baht DESC, o.id`,
      ],
      solution: `SELECT o.id, o.total_baht
FROM orders AS o
JOIN branches AS b ON b.id = o.branch_id
WHERE b.name = '${branch}' AND o.total_baht >= ${floor}
ORDER BY o.total_baht DESC, o.id;`,
    },
    {
      goal: 'จำนวนออเดอร์ของแต่ละสถานะ ผลลัพธ์ 2 คอลัมน์: status, จำนวน',
      skill: 'GROUP BY',
      check: { kind: 'result', expect: 'SELECT status, count(*) FROM orders GROUP BY status' },
      hints: ['จัดกลุ่มตามคอลัมน์ status', 'ใช้ COUNT(*) นับแถวในแต่ละกลุ่ม', 'โครง: SELECT status, COUNT(*) FROM orders GROUP BY ______'],
      solution: 'SELECT status, COUNT(*) AS order_count FROM orders GROUP BY status;',
    },
    {
      goal: "สาขาที่ยอดขายรวม (เฉพาะ 'paid') สูงที่สุด 1 สาขา ผลลัพธ์ 2 คอลัมน์: ชื่อสาขา, ยอดรวม",
      skill: 'SUM + ORDER BY + LIMIT',
      check: {
        kind: 'result',
        expect: "SELECT b.name, sum(o.total_baht) FROM orders o JOIN branches b ON b.id = o.branch_id WHERE o.status = 'paid' GROUP BY b.name ORDER BY 2 DESC LIMIT 1",
      },
      hints: [
        'รวมยอดต่อสาขาด้วย SUM กับ GROUP BY ก่อน',
        'เรียงยอดรวมจากมากไปน้อย แล้วเอาแค่แถวแรกด้วย LIMIT 1',
        "โครง: SELECT b.name, SUM(o.total_baht) AS revenue FROM orders AS o JOIN branches AS b ON b.id = o.branch_id WHERE o.status = 'paid' GROUP BY b.name ORDER BY revenue DESC LIMIT ______",
      ],
      solution: `SELECT b.name, SUM(o.total_baht) AS revenue
FROM orders AS o
JOIN branches AS b ON b.id = o.branch_id
WHERE o.status = 'paid'
GROUP BY b.name
ORDER BY revenue DESC
LIMIT 1;`,
    },
    {
      goal: "ยอดขายรวมรายวัน (เฉพาะ 'paid') ผลลัพธ์ 2 คอลัมน์: วันที่, ยอดรวม เรียงจากวันล่าสุดไปวันเก่าสุด",
      skill: 'GROUP BY date',
      check: {
        kind: 'result',
        ordered: true,
        expect: "SELECT ordered_on, sum(total_baht) FROM orders WHERE status = 'paid' GROUP BY ordered_on ORDER BY ordered_on DESC",
      },
      hints: [
        'หนึ่งกลุ่มคือหนึ่งวัน: GROUP BY ordered_on',
        "กรอง status ด้วย WHERE ก่อนจัดกลุ่ม แล้วเรียงด้วย ORDER BY ordered_on DESC",
        "โครง: SELECT ordered_on, SUM(total_baht) FROM orders WHERE status = 'paid' GROUP BY ______ ORDER BY ______ DESC",
      ],
      solution: `SELECT ordered_on, SUM(total_baht) AS revenue
FROM orders
WHERE status = 'paid'
GROUP BY ordered_on
ORDER BY ordered_on DESC;`,
    },
    {
      goal: 'สาขาที่ไม่มีออเดอร์ refunded เลย ผลลัพธ์ 1 คอลัมน์: ชื่อสาขา',
      skill: 'NOT EXISTS / LEFT JOIN',
      check: {
        kind: 'result',
        expect: "SELECT b.name FROM branches b WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.branch_id = b.id AND o.status = 'refunded')",
      },
      hints: [
        'โจทย์ถามถึงสิ่งที่ "ไม่มี" จึงเริ่มจากตาราง branches แล้วเช็กว่าไม่มีแถวใน orders ที่ตรงเงื่อนไข',
        "ใช้ WHERE NOT EXISTS (SELECT 1 FROM orders … ) หรือ LEFT JOIN ที่ใส่เงื่อนไข refunded ไว้ใน ON แล้วกรอง o.id IS NULL",
        "โครง: SELECT b.name FROM branches AS b WHERE NOT EXISTS (SELECT 1 FROM orders AS o WHERE o.branch_id = b.id AND o.status = '______')",
      ],
      solution: `SELECT b.name
FROM branches AS b
WHERE NOT EXISTS (
  SELECT 1 FROM orders AS o
  WHERE o.branch_id = b.id AND o.status = 'refunded'
);`,
    },
  ];

  const values = orders.map((o) => `(${o.id},${o.branch},DATE '${o.day}',${o.total},'${o.status}')`).join(',\n');
  return {
    id: `daily-${date}`,
    no: 'DAILY',
    title: `งานประจำวัน ${date}`,
    from: 'Ploy · Sales',
    kind: 'daily',
    level: 2,
    skills: [templates[pick % templates.length].skill],
    xp: 50,
    body: [
      'สรุปยอด 7 วันล่าสุดให้หน่อยค่ะ ข้อมูลอยู่ในตาราง orders กับ branches ข้อมูลและคำถามของงานนี้เปลี่ยนทุกวัน',
      'จำนวนและลำดับคอลัมน์ต้องตรงตามที่ขอ ส่วนชื่อคอลัมน์ตั้งอย่างไรก็ได้',
    ],
    seed: `
CREATE TABLE branches (id integer PRIMARY KEY, name text NOT NULL UNIQUE);
INSERT INTO branches VALUES ${BRANCHES.map((b, i) => `(${i + 1},'${b}')`).join(',')};
CREATE TABLE orders (
  id integer PRIMARY KEY,
  branch_id integer NOT NULL REFERENCES branches (id),
  ordered_on date NOT NULL,
  total_baht integer NOT NULL,
  status text NOT NULL CHECK (status IN ('paid', 'refunded'))
);
INSERT INTO orders VALUES
${values};
`,
    tasks: [templates[pick % templates.length]],
    debrief: ['กลับมาพรุ่งนี้จะมีข้อมูลชุดใหม่และคำถามใหม่ ทำต่อเนื่องทุกวันเพื่อสะสม streak'],
  };
}
