import { makeDaily } from './daily';
import { t01 } from './t01-late-shift';
import { t02 } from './t02-branch-sales';
import { t03 } from './t03-top-seller';
import { t04 } from './t04-zero-prices';
import { t05 } from './t05-order-sheet';
import { t06 } from './t06-status-migration';
import { t07 } from './t07-slow-history';
import type { Ticket } from './types';

export interface Chapter {
  id: string;
  title: string;
  description: string;
  skills: string;
  tickets: Ticket[];
}

/** Chapters own campaign order; ticket IDs stay stable for existing saves. */
export const CHAPTERS: Chapter[] = [
  { id: 'first-day', title: 'วันแรกที่บริษัท', description: 'ตามรอยเหตุการณ์จากหลักฐาน และหาคำตอบด้วยข้อมูล', skills: 'SELECT · WHERE · JOIN', tickets: [t01] },
  { id: 'sales', title: 'อ่านยอดขายให้เป็น', description: 'เปลี่ยนรายการขายให้เป็นรายงานที่ทีมใช้ตัดสินใจ', skills: 'GROUP BY · HAVING · CTE · Window functions', tickets: [t02, t03] },
  { id: 'recovery', title: 'รับมือข้อมูลผิดพลาด', description: 'กู้สถานการณ์และแก้ข้อมูลอย่างปลอดภัย', skills: 'UPDATE · BEGIN / COMMIT · ROLLBACK', tickets: [t04] },
  { id: 'database', title: 'ออกแบบและดูแลฐานข้อมูล', description: 'จัดระเบียบข้อมูล เปลี่ยนโครงสร้าง และแก้ปัญหาความช้า', skills: 'Schema design · Migration · EXPLAIN · Index', tickets: [t05, t06, t07] },
];

export const TICKETS: Ticket[] = CHAPTERS.flatMap((chapter) => chapter.tickets);
export const chapterOf = (ticketId: string) => CHAPTERS.find((chapter) => chapter.tickets.some((ticket) => ticket.id === ticketId));
export const chapterLabel = (chapter: Chapter) => `บทที่ ${CHAPTERS.indexOf(chapter) + 1} · ${chapter.title}`;

const dailyCache = new Map<string, Ticket>();

export function getTicket(id: string): Ticket | undefined {
  if (id.startsWith('daily-')) {
    const date = id.slice(6);
    if (!dailyCache.has(date)) dailyCache.set(date, makeDaily(date));
    return dailyCache.get(date);
  }
  return TICKETS.find((t) => t.id === id);
}

export const RANKS: [number, string][] = [
  [0, 'Intern'],
  [300, 'Junior Analyst'],
  [600, 'Analyst'],
  [1000, 'Backend Dev'],
  [1600, 'Database Engineer'],
  [2300, 'DBA'],
  [3100, 'Data Architect'],
];

export const rankOf = (xp: number) => [...RANKS].reverse().find(([min]) => xp >= min)![1];
