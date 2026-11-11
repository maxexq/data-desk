# Data Desk 97

เกมฝึก SQL บนเดสก์ท็อปย้อนยุค ผู้เล่นเป็นคนดูแลข้อมูลของบริษัท รับงานเป็น ticket ตั้งแต่ `SELECT` แรก ไปจนถึงออกแบบตาราง
เขียน migration ที่ถอยกลับได้ และแก้ query ช้าด้วย index ทุกอย่างรันในเบราว์เซอร์บน PostgreSQL จริง ไม่มี backend

ชื่อเกมเป็นชื่อชั่วคราว เปลี่ยนได้ที่ `src/config.ts` ที่เดียว

## เริ่มใช้งาน

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # รันเฉลยของทุก ticket ผ่านตัวตรวจ (ต้องผ่านก่อน deploy)
npm run e2e      # Playwright: เล่นเกมจริงบน production build (ครั้งแรกรัน npx playwright install)
npm run build    # ตรวจ type แล้วสร้างไฟล์ลง dist/
npm run preview
```

`dist/` เป็น static site ล้วน (ประมาณ 17 MB เพราะมี PostgreSQL แบบ WebAssembly) วางบน static host ใดก็ได้
host ต้องอนุญาต WebAssembly และเสิร์ฟไฟล์ `.wasm` กับ `.data` ได้ ถ้า host ไม่ยอมเสิร์ฟ `.data` ให้ build ด้วย
`DD_DATA_EXT=wasm npm run build` เพื่อส่งไฟล์เดียวกันภายใต้นามสกุลที่ host รับ (ดู `vite.config.ts`)

## Deploy บน Cloudflare Pages

เชื่อม repo นี้กับ Cloudflare Pages แล้วตั้งค่า build command เป็น `npm run build` และ output directory เป็น `dist`
(เวอร์ชัน Node อ่านจาก `.node-version`) หรือ deploy จากเครื่องด้วย `npm run build && npx wrangler pages deploy`

## เทสต์

- `npm test` (Vitest) รันเฉลยของทุก ticket ผ่านตัวตรวจใน Node: ยืนยันว่าโจทย์ถูกและแก้ได้
- `npm run e2e` (Playwright) เล่นผ่าน UI จริง: PostgreSQL บูตในเบราว์เซอร์, ticket ตัวแทนของตัวตรวจทั้ง 4 แบบ, editor,
  transaction ค้าง, ความคืบหน้าหลัง reload, งานประจำวันกับ streak และระบบหน้าต่าง SQL ที่ใช้มาจาก `solution` ของ ticket เอง
- `npm run e2e:smoke` รันเฉพาะเทสต์ที่ติดป้าย `@smoke` ใช้กับเว็บจริงได้: `E2E_BASE_URL=https://data-desk.pages.dev npm run e2e:smoke`
- CI (`.github/workflows/ci.yml`) รันทั้งสองชุดทุก push เข้า `main` และทุก pull request โดย Firefox กับ WebKit รันเฉพาะ smoke

## Stack

| ส่วน | ใช้อะไร |
|---|---|
| Build / UI | Vite, React 19, TypeScript |
| ฐานข้อมูล | PGlite (PostgreSQL 18 แบบ WebAssembly) การเชื่อมต่อเดียว จึงมี session จริง: `BEGIN` ค้างได้ และ DDL ย้อนกลับได้ |
| State | zustand เก็บความคืบหน้า แท็บ โน้ต และ streak ลง localStorage (ข้อมูลในฐานข้อมูลไม่ถูกเก็บ จะสร้างใหม่จาก seed เมื่อเปิด ticket) |
| SQL editor | CodeMirror 6 + `@codemirror/lang-sql` (PostgreSQL) autocomplete จากตารางจริงใน workspace |
| จัดรูปแบบ SQL | `sql-formatter` |
| เทสต์ | Vitest รัน PGlite ใน Node |

## โครงสร้าง

```
src/
  config.ts             ชื่อเกมและ key ของ localStorage
  tickets/
    types.ts            รูปร่างของ Ticket, Task และ Check ทั้ง 4 แบบ
    t01 … t07           งานหลัก 7 ใบ (ข้อมูลตั้งต้น ขั้นตอน คำใบ้ เฉลย สรุป)
    daily.ts            ตัวสร้างงานประจำวันจากวันที่
    index.ts            ลำดับของงานหลัก และตำแหน่ง (rank) ตาม XP
  lib/
    pg.ts               เปิด PGlite, รัน SQL, แปล error ตาม SQLSTATE เป็นภาษาไทย
    judge.ts            สร้าง workspace ของ ticket และตัวตรวจทั้งหมด (ไม่มี DOM จึงใช้ในเทสต์ได้)
    formatSql.ts        ตัวจัดรูปแบบ SQL
  state/game.ts         สถานะเกม: ticket ที่เปิด ความคืบหน้า แท็บ ผลตรวจ
  state/wm.ts           ตัวจัดการหน้าต่าง
  ui/                   หน้าต่าง เดสก์ท็อป taskbar ไอคอนพิกเซล ตารางผลลัพธ์
  apps/                 Inbox, Ticket, SQL Console, Tables, Manual, Notepad, Hint, Settings, ไฟล์แนบ
tests/tickets.test.ts   เล่นทุก ticket ด้วยเฉลยของมันเอง
```

## ตัวตรวจ 4 แบบ (`Check` ใน `tickets/types.ts`)

| kind | ตรวจเมื่อ | ตรวจอะไร | ใช้กับ |
|---|---|---|---|
| `result` | ทุกครั้งที่กด Run | ผลลัพธ์ของ query เทียบกับ query อ้างอิง (`expect`) หรือฟังก์ชัน (`test`) | อ่านข้อมูล: SELECT ถึง window function |
| `state` | กดส่งงาน | รันเทสต์ลับกับ workspace ของผู้เล่น (ใน transaction ที่ rollback ทิ้ง) ตรวจได้ว่ามี transaction ค้างไหม และไม่นับงานที่ยังไม่ COMMIT | transaction, แก้ข้อมูล |
| `script` | กดส่งงาน | รันไฟล์ของผู้เล่นบนสำเนาใหม่ของ seed ทีละเฟส (เช่น up → down → up) แล้วทดสอบทั้งข้อมูลและ constraint | ออกแบบตาราง, migration |
| `plan` | กดส่งงาน | อ่าน `EXPLAIN (FORMAT JSON)` ว่าไม่มี Seq Scan บนตารางที่กำหนด | index |

## เพิ่ม ticket ใหม่

1. คัดลอกไฟล์ ticket ที่ใกล้เคียงใน `src/tickets/` แล้วแก้ `seed`, `body`, `tasks`
2. ทุก task ต้องมี `solution` เทสต์จะใช้มันยืนยันสองอย่าง: ยังไม่ทำอะไรต้องไม่ผ่าน และเฉลยต้องผ่าน
3. เพิ่มเข้า `TICKETS` ใน `src/tickets/index.ts` ตามลำดับความยาก แล้วรัน `npm test`

ข้อควรระวังเมื่อเขียนโจทย์แบบ `result` ที่ต้องเรียงลำดับ (`ordered: true`): ข้อมูลตั้งต้นต้องไม่มีค่าเท่ากันในคอลัมน์ที่ใช้เรียง
ไม่อย่างนั้นคำตอบที่ถูกจะมีได้หลายลำดับ

## สิ่งที่ยังไม่มี

- ระดับ 9 (การทำงานพร้อมกันหลาย session, lock, isolation) PGlite มีการเชื่อมต่อเดียว จึงจำลองผู้ใช้สองคนพร้อมกันไม่ได้
- งานประเภท "รีวิว" (หา bug ใน query ของคนอื่น) มีชนิดเตรียมไว้ใน `TicketKind` แต่ยังไม่มีโจทย์
- workspace ไม่ถูกบันทึกข้ามการโหลดหน้าใหม่ ตารางที่ผู้เล่นสร้างค้างไว้จะหาย (ไฟล์ในแท็บยังอยู่)

## ที่มาของเนื้อหาใน manual

กฎใน Instruction Manual สรุปจากเอกสารเหล่านี้ และมีลิงก์กำกับท้ายแต่ละบทในเกม

- PostgreSQL 18 Documentation: Table Expressions, Comparison Operators, Pattern Matching, Sorting Rows, Aggregate Functions,
  Window Functions, Transactions, Constraints, ALTER TABLE, Using EXPLAIN — https://www.postgresql.org/docs/18/
- Strong Migrations README — https://www.rubydoc.info/gems/strong_migrations/2.0.1
- SQL Style Guide โดย Simon Holywell (CC BY-SA 4.0) — https://www.sqlstyle.guide/
- Mozilla Data Docs — SQL Style Guide — https://docs.telemetry.mozilla.org/concepts/sql_style
