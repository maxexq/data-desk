import { makeDaily } from './daily';
import { t01 } from './t01-late-shift';
import { t02 } from './t02-branch-sales';
import { t03 } from './t03-top-seller';
import { t04 } from './t04-zero-prices';
import { t05 } from './t05-order-sheet';
import { t06 } from './t06-status-migration';
import { t07 } from './t07-slow-history';
import type { Ticket } from './types';

/** The campaign, in unlock order. Add a ticket by writing a file like the others and listing it here. */
export const TICKETS: Ticket[] = [t01, t02, t03, t04, t05, t06, t07];

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
