// Shareware Shelf: extra apps the player unlocks by closing tickets, then installs.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../config';
import type { IconName } from '../ui/icons';
import { useGame } from './game';

export type ShelfId = 'sandbox' | 'snapshot' | 'erd';

export interface ShelfApp {
  id: ShelfId;
  title: string;
  icon: IconName;
  disk: string; // floppy label colour
  blurb: string;
  why: string; // what it teaches, shown on the box
  disks: number;
  kb: number;
  /** Ticket that has to be closed first. The tool should never do a job the player has not done by hand. */
  unlockTicket: string;
  unlockText: string;
  files: string[]; // flashed during the fake install
}

export const SHELF: ShelfApp[] = [
  {
    id: 'sandbox',
    title: 'Sandbox',
    icon: 'sandbox',
    disk: '#ffd43b',
    blurb: 'ฐานข้อมูลเล่นอิสระ พร้อมชุดข้อมูลตัวอย่างที่คนทั่วโลกใช้ฝึก: Chinook (ร้านเพลง) และ Pagila (ร้านเช่าหนัง)',
    why: 'ฝึกต่อได้เรื่อยๆ แม้ ticket หมด และไม่กระทบงานที่ค้างอยู่ เพราะเป็นเซิร์ฟเวอร์แยก',
    disks: 3,
    kb: 1180,
    unlockTicket: 't01',
    unlockText: 'ปิดงาน T-101',
    files: ['SANDBOX.EXE', 'CHINOOK.DAT', 'PAGILA.DAT', 'PAGILA2.DAT', 'README.TXT'],
  },
  {
    id: 'snapshot',
    title: 'Snapshot',
    icon: 'camera',
    disk: '#a5d8ff',
    blurb: 'เซฟ workspace ของ ticket ไว้ แล้วย้อนกลับมาได้ทุกเมื่อ ใช้ pg_dump ตัวจริงที่คอมไพล์เป็น WebAssembly',
    why: 'เห็นว่า pg_dump เขียนไฟล์ backup ออกมาหน้าตาแบบไหน และทำไมมันไม่เห็นข้อมูลที่ยังไม่ COMMIT',
    disks: 2,
    kb: 1640,
    unlockTicket: 't04',
    unlockText: 'ปิดงาน T-104 (transaction)',
    files: ['SNAPSHOT.EXE', 'PG_DUMP.WSM', 'TAPE.DRV'],
  },
  {
    id: 'erd',
    title: 'ER Diagram',
    icon: 'diagram',
    disk: '#b2f2bb',
    blurb: 'วาดตาราง คอลัมน์ และเส้น foreign key จาก schema จริง ทั้งของ ticket และของ Sandbox',
    why: 'มองเห็นความสัมพันธ์ระหว่างตารางก่อนเขียน JOIN และตรวจแบบที่ตัวเองออกแบบ',
    disks: 1,
    kb: 420,
    unlockTicket: 't05',
    unlockText: 'ปิดงาน T-105 (ออกแบบตาราง)',
    files: ['ERDRAW.EXE', 'BOXES.FNT'],
  },
];

export const shelfApp = (id: string) => SHELF.find((a) => a.id === id);

interface ShelfState {
  installed: ShelfId[];
  seen: ShelfId[]; // available apps the player has already looked at on the shelf
  sandboxSql: Record<string, string>;
  sandboxDataset: 'chinook' | 'pagila' | 'empty';
  install: (id: ShelfId) => void;
  uninstall: (id: ShelfId) => void;
  markSeen: (ids: ShelfId[]) => void;
  setSandboxSql: (dataset: string, sql: string) => void;
  setSandboxDataset: (d: ShelfState['sandboxDataset']) => void;
  reset: () => void;
}

export const useShelf = create<ShelfState>()(
  persist(
    (set) => ({
      installed: [],
      seen: [],
      sandboxSql: {},
      sandboxDataset: 'chinook',
      install: (id) => set((s) => ({ installed: s.installed.includes(id) ? s.installed : [...s.installed, id] })),
      uninstall: (id) => set((s) => ({ installed: s.installed.filter((x) => x !== id) })),
      markSeen: (ids) => set((s) => ({ seen: [...new Set([...s.seen, ...ids])] })),
      setSandboxSql: (dataset, sql) => set((s) => ({ sandboxSql: { ...s.sandboxSql, [dataset]: sql } })),
      setSandboxDataset: (sandboxDataset) => set({ sandboxDataset }),
      reset: () => set({ installed: [], seen: [], sandboxSql: {}, sandboxDataset: 'chinook' }),
    }),
    { name: `${STORAGE_KEY}-shelf`, version: 1 },
  ),
);

/** Unlocked by its ticket, or by "unlock all" in Settings. */
export function useAvailable(): Set<ShelfId> {
  const progress = useGame((s) => s.progress);
  const unlockAll = useGame((s) => s.unlockAll);
  return new Set(SHELF.filter((a) => unlockAll || progress[a.unlockTicket]?.done).map((a) => a.id));
}

/** Something new on the shelf: unlocked, not installed, not looked at yet. */
export function useShelfHasNew(): boolean {
  const available = useAvailable();
  const installed = useShelf((s) => s.installed);
  const seen = useShelf((s) => s.seen);
  return [...available].some((id) => !installed.includes(id) && !seen.includes(id));
}
