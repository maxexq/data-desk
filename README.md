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

## เข้าสู่ระบบด้วย Google / GitHub

ไม่บังคับ เล่นได้โดยไม่ต้องเข้าสู่ระบบ (ความคืบหน้าอยู่ใน localStorage) ถ้าเข้าสู่ระบบ ความคืบหน้า โน้ต แท็บ SQL และแอปที่ติดตั้งจะซิงก์ขึ้นเซิร์ฟเวอร์

- **Backend:** Cloudflare Pages Functions ใน `functions/api` (โค้ดจริงอยู่ใน `server/`) และ D1 (`data-desk` สำหรับ production, `data-desk-staging` สำหรับ staging กับ preview) ผูกไว้ใน `wrangler.toml`
- **Schema:** `migrations/` ใช้กับฐานจริงด้วย `npx wrangler d1 migrations apply data-desk --remote` (และ `data-desk-staging --remote --env preview`)
- **Flow:** OAuth authorization code + `state` + PKCE (S256) ขอแค่ชื่อกับรูปโปรไฟล์ (Google: `openid profile`, GitHub: ไม่ขอ scope) ไม่เก็บอีเมลและไม่เก็บ access token
- **Session:** cookie `dd_session` (HttpOnly, Secure, SameSite=Lax, 30 วัน) ฐานข้อมูลเก็บแค่ SHA-256 ของค่า cookie คำสั่งที่เขียนข้อมูลต้องมาจาก origin เดียวกัน
- **Sync:** `src/state/account.ts` ดึงเซฟจากเซิร์ฟเวอร์มา merge กับในเครื่อง (`src/lib/saveData.ts`: ticket ละความคืบหน้าที่ไกลที่สุด ไม่มีอะไรหาย) แล้วอัปโหลดเมื่อมีการเปลี่ยนแปลง
- **ถ้าไม่มี backend** (เช่น `npm run dev`) ปุ่ม Log on จะไม่แสดงเลย ส่วน `npx wrangler pages dev dist` รัน backend ในเครื่องได้

ตั้งค่าครั้งแรก (ทำใน dashboard ของแต่ละเจ้า):

| ที่ไหน | ทำอะไร |
|---|---|
| Google Cloud Console → APIs & Services → Credentials | สร้าง OAuth client ID แบบ Web application, Authorized redirect URIs: `https://data-desk.pages.dev/api/auth/google/callback` และ `https://staging.data-desk.pages.dev/api/auth/google/callback` แล้วตั้ง OAuth consent screen เป็น In production (scope แค่ openid / profile ไม่ต้องผ่านการรีวิว) |
| GitHub → Settings → Developer settings → OAuth Apps | สร้าง 2 แอป เพราะแอปหนึ่งมี callback URL ได้อันเดียว: production `https://data-desk.pages.dev/api/auth/github/callback` และ staging `https://staging.data-desk.pages.dev/api/auth/github/callback` |
| Cloudflare → Pages → data-desk → Settings → Variables and Secrets | ใส่ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` เป็น Secret แยก Production (แอป production) กับ Preview (แอป staging) แล้ว deploy ใหม่ |

ผู้ให้บริการที่ยังไม่มี key จะไม่ขึ้นปุ่มให้กด

## ภาพตอนแชร์ลิงก์ (og:image)

`public/og.png` (1200×630) วาดจาก component จริงของเกม (`scripts/og/og.tsx`) แก้แล้วสร้างใหม่ด้วย `node scripts/og/render.mjs`
meta tag อยู่ใน `index.html` และชี้ไปที่ URL ของ production เพราะ Facebook / LINE / X ต้องการ URL เต็ม

## Branch และ environment

| branch | environment | URL | deploy เมื่อ |
|---|---|---|---|
| `main` | production | https://data-desk.pages.dev | merge PR release จาก `staging` (หรือ hotfix) |
| `staging` | staging | https://staging.data-desk.pages.dev | merge PR งานใหม่ |
| อื่นๆ (`feat/…`, `fix/…`) | preview | `https://<branch>.data-desk.pages.dev` | ทุก push (Cloudflare โพสต์ลิงก์ไว้ใน PR) |

ลำดับงานปกติ

```
feat/xxx ──PR──▶ staging ──PR "Release YYYY-MM-DD"──▶ main
   (preview)       (staging)                          (production)
```

1. แตก branch จาก `staging` ตั้งชื่อ `feat/…` หรือ `fix/…` แล้วเปิด PR เข้า `staging`
2. CI ต้องผ่าน แล้ว merge ลองเล่นบน staging
3. พร้อมปล่อยเมื่อไหร่ เปิด PR จาก `staging` เข้า `main`
   (https://github.com/maxexq/data-desk/compare/main...staging) แล้ว merge แบบ **merge commit** ไม่ squash
   เพื่อให้สอง branch มีประวัติเดียวกันและ PR release ครั้งถัดไปไม่มี commit ซ้ำ

Hotfix: แตกจาก `main` เป็น `hotfix/…` เปิด PR เข้า `main` แล้วเปิด PR `main` → `staging` ตามทันที เพื่อไม่ให้ release ถัดไปทับการแก้

แต่ละ build รู้ว่าตัวเองเป็น environment ไหนจาก `CF_PAGES_BRANCH` ที่ Cloudflare ส่งให้ตอน build (ดู `vite.config.ts` และ `src/deploy.ts`)
staging, preview และ build ในเครื่องจะมีป้าย `STAGING` / `PREVIEW <branch>` / `LOCAL` ที่ taskbar ส่วน production ไม่มีป้าย
ความคืบหน้าของผู้เล่นแยกกันเองเพราะแต่ละ URL เป็นคนละ origin (localStorage ไม่ปนกัน)

## Deploy บน Cloudflare Pages

เชื่อม repo นี้กับ Cloudflare Pages แล้วตั้งค่า build command เป็น `npm run build`, output directory เป็น `dist`
และ production branch เป็น `main` (เวอร์ชัน Node อ่านจาก `.node-version`) branch อื่นจะได้ preview deployment อัตโนมัติ
หรือ deploy จากเครื่องด้วย `npm run build && npx wrangler pages deploy`

## เทสต์

- `npm test` (Vitest) รันเฉลยของทุก ticket ผ่านตัวตรวจใน Node: ยืนยันว่าโจทย์ถูกและแก้ได้
- `npm run e2e` (Playwright) เล่นผ่าน UI จริง: PostgreSQL บูตในเบราว์เซอร์, ticket ตัวแทนของตัวตรวจทั้ง 4 แบบ, editor,
  transaction ค้าง, ความคืบหน้าหลัง reload, งานประจำวันกับ streak และระบบหน้าต่าง SQL ที่ใช้มาจาก `solution` ของ ticket เอง
- `npm run e2e:smoke` รันเฉพาะเทสต์ที่ติดป้าย `@smoke` ใช้กับเว็บจริงได้: `E2E_BASE_URL=https://data-desk.pages.dev E2E_EXPECT_ENV=production npm run e2e:smoke`
- CI (`.github/workflows/ci.yml`) รันทั้งสองชุดทุก push เข้า `main` หรือ `staging` และทุก pull request โดย Firefox กับ WebKit รันเฉพาะ smoke
- `.github/workflows/smoke-deployed.yml` รอ Cloudflare deploy เสร็จหลัง push เข้า `main`/`staging` แล้วรัน smoke กับเว็บนั้น
  และตรวจป้าย environment ว่าตรง (staging ต้องไม่ได้ build ของ production) รันซ้ำทุกวัน 09:00 ด้วย

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
    foundations.ts      งานพื้นฐานคั่น 3 ใบ รวม 9 ขั้น: เรียง/จำกัดแถว, ข้อมูลที่ขาด, วันที่และ CASE
    daily.ts            ตัวสร้างงานประจำวันจากวันที่
    index.ts            งานหลักรวม 10 ใบใน 4 บท และตำแหน่ง (rank) ตาม XP
  lib/
    pg.ts               เปิด PGlite, รัน SQL, แปล error ตาม SQLSTATE เป็นภาษาไทย
    judge.ts            สร้าง workspace ของ ticket และตัวตรวจทั้งหมด (ไม่มี DOM จึงใช้ในเทสต์ได้)
    formatSql.ts        ตัวจัดรูปแบบ SQL
  state/game.ts         สถานะเกม: ticket ที่เปิด ความคืบหน้า แท็บ ผลตรวจ
  state/wm.ts           ตัวจัดการหน้าต่าง
  ui/                   หน้าต่าง เดสก์ท็อป taskbar ไอคอนพิกเซล ตารางผลลัพธ์
  apps/                 Inbox, Ticket, SQL Console, Tables, Manual, Notepad, Hint, Settings, ไฟล์แนบ
  apps/shelf/           Shareware Shelf และแอปที่ติดตั้งได้: Sandbox, Snapshot, ER Diagram
  datasets/             ชุดข้อมูลของ Sandbox (สร้างจาก scripts/build-datasets.mjs)
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

## Shareware Shelf

แอปเสริมที่ผู้เล่นได้หลังปิด ticket แล้วกดติดตั้ง (`src/state/shelf.ts`) เงื่อนไขคือแอปต้องไม่ทำงานแทนสิ่งที่ผู้เล่นยังไม่เคยทำเอง

| แอป | ปลดล็อก | ทำอะไร |
|---|---|---|
| Sandbox | ปิด T-101 | เซิร์ฟเวอร์ PGlite ตัวที่สอง แยกจาก ticket พร้อม Chinook, Pagila หรือฐานข้อมูลว่าง |
| Snapshot | ปิด T-104 | `pg_dump --schema=ws` ตัวจริง (`@electric-sql/pglite-tools`) เก็บไฟล์ .sql ไว้ใน IndexedDB แล้ว restore กลับได้ ถ่ายไม่ได้ระหว่าง transaction เปิดค้าง |
| ER Diagram | ปิด T-105 | อ่านตาราง คอลัมน์ และ foreign key จาก `pg_catalog` วาดเป็นแผนภาพ ใช้ได้ทั้ง workspace ของ ticket และ Sandbox |

ชุดข้อมูลและ pg_dump โหลดเมื่อเปิดแอปครั้งแรกเท่านั้น จึงไม่ทำให้หน้าแรกช้าลง

## Desk Tunes (เครื่องเล่นเพลง)

อยู่บนเดสก์ท็อปตั้งแต่แรก เล่นต่อได้ตอนย่อหน้าต่าง ปิดหน้าต่างแล้วเพลงหยุด ปุ่มลัด Z X C V B เหมือนเครื่องเล่นยุคเก่า

- **Data Desk FM** (`src/music/radio.ts`) แต่งเพลงสดด้วย Web Audio API ไม่มีไฟล์เสียงเลย 3 สถานี:
  Rainy Desk (lofi beats + เสียงฝน), Mango Café (cafe jazz, brushes + walking bass), Server Room (chill ambient)
  ทุกสถานีผ่าน saturation กับ low-pass และมีเสียงแผ่นเสียงแตกเบาๆ ระดับเสียงวัดไว้ที่ประมาณ -12 ถึง -16 dB RMS ไม่ clip
- **ไฟล์เพลง** ใส่ใน `public/music/` แล้วเพิ่มใน `src/music/tracks.ts` พร้อมสัญญาอนุญาตและลิงก์ที่มา ต้องเป็นเพลงที่แจกต่อได้ (เช่น CC0)
- **เพลงในเครื่องผู้เล่น** กด "เพิ่มเพลงจากเครื่อง" เล่นได้เฉพาะ session นั้น ไม่ถูกอัปโหลดไปไหน

## ที่มาของชุดข้อมูลใน Sandbox

- **Chinook** 1.4.5 — Copyright (c) 2008-2024 Luis Rocha, MIT License — https://github.com/lerocha/chinook-database
- **Pagila** — Copyright (c) 2015-2026 Devrim Gündüz, PostgreSQL License — https://github.com/devrimgunduz/pagila
  ตัดให้เหลือ 16,044 การเช่าแบบ Sakila เดิม และตัด embedding (pgvector), full-text, UUID, รูปและรหัสผ่านของพนักงาน
  ตาราง payment รวมเป็นตารางเดียวแทน partition

สร้างใหม่ได้ด้วย `node scripts/build-datasets.mjs <โฟลเดอร์ที่มี Chinook_PostgreSql.sql และ pagila-data.sql>`

## สิ่งที่ยังไม่มี

- ระดับ 9 (การทำงานพร้อมกันหลาย session, lock, isolation) PGlite มีการเชื่อมต่อเดียว จึงจำลองผู้ใช้สองคนพร้อมกันไม่ได้
- งานประเภท "รีวิว" (หา bug ใน query ของคนอื่น) มีชนิดเตรียมไว้ใน `TicketKind` แต่ยังไม่มีโจทย์
- workspace ไม่ถูกบันทึกเองข้ามการโหลดหน้าใหม่ ตารางที่ผู้เล่นสร้างค้างไว้จะหาย (ไฟล์ในแท็บยังอยู่) ถ้าติดตั้ง Snapshot แล้วเซฟไว้ก็ restore กลับได้

## ที่มาของเนื้อหาใน manual

กฎใน Instruction Manual สรุปจากเอกสารเหล่านี้ และมีลิงก์กำกับท้ายแต่ละบทในเกม

- PostgreSQL 18 Documentation: Table Expressions, Comparison Operators, Pattern Matching, Sorting Rows, Aggregate Functions,
  Window Functions, Transactions, Constraints, ALTER TABLE, Using EXPLAIN — https://www.postgresql.org/docs/18/
- Strong Migrations README — https://www.rubydoc.info/gems/strong_migrations/2.0.1
- SQL Style Guide โดย Simon Holywell (CC BY-SA 4.0) — https://www.sqlstyle.guide/
- Mozilla Data Docs — SQL Style Guide — https://docs.telemetry.mozilla.org/concepts/sql_style
