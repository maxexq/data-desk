import type { Cell, Rows } from '../lib/pg';

/** One hidden test, run inside a transaction that is rolled back afterwards. */
export interface Test {
  name: string;
  sql: string;
  /** 'ok' = must not fail, a SQLSTATE like '23505' = must fail with that code, rows = last result must equal these. */
  expect: 'ok' | Cell[][] | { error: string };
}

export type Check =
  /** Checked automatically on every Run against the query's result. */
  | { kind: 'result'; expect: string; ordered?: boolean }
  | { kind: 'result'; test: (r: Rows) => boolean }
  /** Submit: tests run against the player's live workspace. */
  | { kind: 'state'; tests: Test[]; noOpenTxn?: boolean; rollbackFirst?: boolean }
  /** Submit: the player's files run on a fresh copy of the seed, phase by phase. */
  | { kind: 'script'; phases: Phase[] }
  /** Submit: the query's plan must not read the whole table. */
  | { kind: 'plan'; query: string; table: string };

export interface Phase {
  label: string;
  run?: string; // file name to execute before the tests
  mustMatch?: { pattern: RegExp; name: string }[]; // light lint on that file
  tests: Test[];
}

export interface Task {
  goal: string;
  skill: string;
  hints: [string, string, string];
  check: Check;
  /** A model answer: one statement/script, or one script per file. Used by the test-suite and shown after closing. */
  solution: string | Record<string, string>;
}

export type TicketKind = 'investigate' | 'request' | 'incident' | 'review' | 'project' | 'daily';

export interface Ticket {
  id: string;
  no: string;
  title: string;
  from: string;
  kind: TicketKind;
  level: number; // 1 (SELECT) … 9 (architecture)
  skills: string[];
  body: string[];
  attachments?: { id: string; file: string; fromTask?: number; summary: string }[]; // art ids in apps/clueArt
  seed: string;
  /** Runs after the seed in the player's workspace only, while task 0 is open (e.g. leave a transaction open). */
  afterSeed?: string;
  files?: { name: string; initial: string }[];
  tasks: Task[];
  debrief: string[];
  xp: number;
}

export const KIND_LABEL: Record<TicketKind, string> = {
  investigate: 'สืบสวน',
  request: 'คำขอ',
  incident: 'เหตุด่วน',
  review: 'รีวิว',
  project: 'โปรเจกต์',
  daily: 'ประจำวัน',
};
