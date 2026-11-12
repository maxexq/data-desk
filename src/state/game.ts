import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../config';
import { inspectResult, describeWorkspace, judge, resetWorkspace, type Report, type TableInfo } from '../lib/judge';
import { execSql, explainError, inTransaction, lastRows, measurePages, type Cell, type ExecOutcome, type PageStats } from '../lib/pg';
import { TICKETS, getTicket } from '../tickets';
import { todayKey } from '../tickets/daily';
import type { Ticket } from '../tickets/types';

export interface Tab {
  id: string;
  title: string;
  sql: string;
  file?: boolean; // a deliverable file of the ticket (not closable, read by the judge)
}

interface TabSet {
  tabs: Tab[];
  active: string;
  next: number;
}

export interface Progress {
  task: number;
  done: boolean;
  queries: number;
  hints: number;
  hintLevel: number;
}

export type RunView =
  | { kind: 'rows'; columns: string[]; values: Cell[][]; total: number; ms: number; pages?: PageStats | null }
  | { kind: 'ok'; statements: number; affected: number; ms: number }
  | { kind: 'error'; raw: string; friendly: string; hint?: string };

const MAX_ROWS = 500;
const NO_PROGRESS: Progress = { task: 0, done: false, queries: 0, hints: 0, hintLevel: 0 };

interface GameState {
  active: string | null;
  progress: Record<string, Progress>;
  tabsets: Record<string, TabSet>;
  history: string[];
  notes: string;
  crt: boolean;
  unlockAll: boolean;
  legacyUnlocked: string[];
  streak: { last: string | null; count: number };
  // not persisted
  ready: boolean;
  running: boolean;
  inTxn: boolean;
  dbVersion: number;
  tables: TableInfo[] | null;
  results: Record<string, RunView | undefined>;
  report: Report | null;
  justClosed: string | null;
  toast: { id: number; text: string } | null;

  openTicket: (id: string) => Promise<void>;
  resetData: () => Promise<void>;
  /** Re-read tables and transaction state from the database (the desktop's Refresh). */
  refreshDb: () => Promise<void>;
  run: (tabId: string) => Promise<void>;
  submit: () => Promise<void>;
  nextHint: () => void;
  setSql: (tabId: string, sql: string) => void;
  addTab: (sql?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setNotes: (notes: string) => void;
  setCrt: (on: boolean) => void;
  setUnlockAll: (on: boolean) => void;
  say: (text: string) => void;
  resetAll: () => void;
}

let toastId = 0;

// There is one database connection. Queue every multi-step database action so two of
// them (a reset and a run, or React StrictMode's double effect) can never interleave.
let chain: Promise<unknown> = Promise.resolve();
const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
};

/**
 * Use the ticket database from outside the game store (Snapshot, ER Diagram) without
 * interleaving with a run, a check or a reset. With `refresh`, the game re-reads tables
 * and transaction state afterwards.
 */
export const withDb = <T,>(fn: () => Promise<T>, opts: { refresh?: boolean } = {}): Promise<T> =>
  serial(async () => {
    try {
      return await fn();
    } finally {
      if (opts.refresh && useGame.getState().active) {
        const [inTxn, tables] = [await inTransaction(), await describeWorkspace()];
        useGame.setState((s) => ({ inTxn, tables, dbVersion: s.dbVersion + 1 }));
      }
    }
  });

/** How a query's outcome is shown in a console. */
export function toView(out: ExecOutcome): RunView {
  if (!out.ok) return { kind: 'error', raw: out.error.message, friendly: explainError(out.error), hint: out.error.hint };
  const last = lastRows(out.results);
  if (last) return { kind: 'rows', columns: last.columns, values: last.values.slice(0, MAX_ROWS), total: last.values.length, ms: out.ms };
  return { kind: 'ok', statements: out.results.length, affected: out.results.reduce((n, r) => n + r.affected, 0), ms: out.ms };
}

const newTabSet = (t: Ticket): TabSet => {
  const files: Tab[] = (t.files ?? []).map((f, i) => ({ id: `f${i}`, title: f.name, sql: f.initial, file: true }));
  const scratch: Tab = { id: 't1', title: 'Query 1', sql: t.files ? '' : 'SELECT * FROM ' };
  return { tabs: [...files, scratch], active: files[0]?.id ?? 't1', next: 2 };
};

export const resultKey = (ticketId: string, tabId: string) => `${ticketId}/${tabId}`;

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      const ticket = () => {
        const id = get().active;
        return id ? getTicket(id) : undefined;
      };
      const patchProgress = (id: string, p: Partial<Progress>) =>
        set((s) => ({ progress: { ...s.progress, [id]: { ...(s.progress[id] ?? NO_PROGRESS), ...p } } }));
      const patchTabs = (fn: (ts: TabSet) => TabSet) =>
        set((s) => (s.active && s.tabsets[s.active] ? { tabsets: { ...s.tabsets, [s.active]: fn(s.tabsets[s.active]) } } : s));

      /** Refresh everything derived from the database after it may have changed. */
      const refresh = async () => {
        const [inTxn, tables] = [await inTransaction(), await describeWorkspace()];
        set((s) => ({ inTxn, tables, dbVersion: s.dbVersion + 1 }));
      };

      const advance = (t: Ticket) => {
        const p = get().progress[t.id] ?? NO_PROGRESS;
        const task = p.task + 1;
        const done = task >= t.tasks.length;
        patchProgress(t.id, { task, done, hintLevel: 0 });
        if (!done) {
          set({ toast: { id: ++toastId, text: `ผ่านขั้นที่ ${task} แล้ว ไปขั้นที่ ${task + 1}` } });
          return;
        }
        set((s) => {
          let streak = s.streak;
          if (t.kind === 'daily') {
            const today = t.id.slice(6);
            const d = new Date(`${today}T12:00:00`);
            d.setDate(d.getDate() - 1);
            streak = { last: today, count: s.streak.last === todayKey(d) ? s.streak.count + 1 : s.streak.last === today ? s.streak.count : 1 };
          }
          return { streak, justClosed: t.id, toast: { id: ++toastId, text: `ปิด ${t.no} แล้ว +${t.xp} XP` } };
        });
      };

      return {
        active: null,
        progress: {},
        tabsets: {},
        history: [],
        notes: '',
        crt: true,
        unlockAll: false,
        legacyUnlocked: [],
        streak: { last: null, count: 0 },
        ready: false,
        running: false,
        inTxn: false,
        dbVersion: 0,
        tables: null,
        results: {},
        report: null,
        justClosed: null,
        toast: null,

        openTicket: (id) => serial(async () => {
          const t = getTicket(id);
          if (!t) return;
          set((s) => ({
            active: id,
            ready: false,
            report: null,
            progress: s.progress[id] ? s.progress : { ...s.progress, [id]: NO_PROGRESS },
            tabsets: s.tabsets[id] ? s.tabsets : { ...s.tabsets, [id]: newTabSet(t) },
          }));
          await resetWorkspace(t, get().progress[id]?.task ?? 0);
          if (get().active !== id) return; // another ticket was opened meanwhile
          await refresh();
          set({ ready: true });
        }),

        refreshDb: () => serial(async () => {
          if (get().active) await refresh();
        }),

        resetData: () => serial(async () => {
          const t = ticket();
          if (!t) return;
          set({ ready: false, report: null });
          await resetWorkspace(t, get().progress[t.id]?.task ?? 0);
          await refresh();
          set({ ready: true, toast: { id: ++toastId, text: 'ข้อมูลของ ticket นี้กลับเป็นค่าตั้งต้นแล้ว' } });
        }),

        run: (tabId) => serial(async () => {
          const t = ticket();
          const s0 = get();
          const sql = t && s0.tabsets[t.id]?.tabs.find((x) => x.id === tabId)?.sql.trim();
          if (!t || !sql || s0.running || !s0.ready) return;
          set({ running: true, report: null });
          const out = await execSql(sql);
          const view = toView(out);
          // The page meter: how many 8 KB pages this query read (only for a single read-only statement).
          if (view.kind === 'rows') view.pages = await measurePages(sql);
          const rows = (out.ok && lastRows(out.results)) || { columns: [] as string[], values: [] as Cell[][] };
          const p = get().progress[t.id] ?? NO_PROGRESS;
          patchProgress(t.id, { queries: p.queries + 1 });
          set((s) => ({
            running: false,
            results: { ...s.results, [resultKey(t.id, tabId)]: view },
            history: [sql, ...s.history.filter((q) => q !== sql)].slice(0, 40),
          }));
          const task = t.tasks[p.task];
          if (out.ok && !p.done && task?.check.kind === 'result') {
            const report = await inspectResult(task.check, rows, view.kind === 'rows' ? view.pages : null);
            set({ report: { ...report, taskLabel: `ขั้นที่ ${p.task + 1}: ${task.goal}` } });
            if (report.pass) advance(t);
          }
          await refresh();
        }),

        submit: () => serial(async () => {
          const t = ticket();
          const s0 = get();
          if (!t || s0.running || !s0.ready) return;
          const p = s0.progress[t.id] ?? NO_PROGRESS;
          const task = t.tasks[p.task];
          if (!task || p.done) return;
          set({ running: true });
          const files = Object.fromEntries((s0.tabsets[t.id]?.tabs ?? []).filter((x) => x.file).map((x) => [x.title, x.sql]));
          const report = await judge(t, task.check, files);
          set({ running: false, report });
          if (report.pass) advance(t);
          await refresh();
        }),

        nextHint: () => {
          const t = ticket();
          if (!t) return;
          const p = get().progress[t.id] ?? NO_PROGRESS;
          if (!p.done && p.hintLevel < 3) patchProgress(t.id, { hintLevel: p.hintLevel + 1, hints: p.hints + 1 });
        },

        setSql: (tabId, sql) => patchTabs((ts) => ({ ...ts, tabs: ts.tabs.map((x) => (x.id === tabId ? { ...x, sql } : x)) })),
        addTab: (sql = '') =>
          patchTabs((ts) => {
            const id = `t${ts.next}`;
            return { tabs: [...ts.tabs, { id, title: `Query ${ts.next}`, sql }], active: id, next: ts.next + 1 };
          }),
        closeTab: (tabId) =>
          patchTabs((ts) => {
            const tab = ts.tabs.find((x) => x.id === tabId);
            if (!tab || tab.file || ts.tabs.length === 1) return ts;
            const i = ts.tabs.indexOf(tab);
            const tabs = ts.tabs.filter((x) => x.id !== tabId);
            return { ...ts, tabs, active: ts.active === tabId ? tabs[Math.max(0, i - 1)].id : ts.active };
          }),
        setActiveTab: (tabId) => patchTabs((ts) => ({ ...ts, active: tabId })),

        setNotes: (notes) => set({ notes }),
        setCrt: (crt) => set({ crt }),
        setUnlockAll: (unlockAll) => set({ unlockAll }),
        say: (text) => set({ toast: { id: ++toastId, text } }),
        resetAll: () =>
          set({ active: null, progress: {}, legacyUnlocked: [], tabsets: {}, history: [], streak: { last: null, count: 0 }, results: {}, report: null, justClosed: null, ready: false, tables: null }),
      };
    },
    {
      name: STORAGE_KEY,
      version: 4,
      migrate: (persisted, version) => {
        const saved = persisted as Partial<GameState>;
        // Every campaign order a save may have been played under. Inserting tickets must never
        // lock something the player could already open, so anything open under an older order stays open.
        // A save is checked against each order from the one it was made under onward.
        const pastOrders = [
          ['t01', 't02', 't03', 't04', 't05', 't06', 't07'], // v1
          ['t01', 'f01', 't02', 'f02', 'f03', 't03', 't04', 't05', 't06', 't07'], // v2: foundation tickets
          ['t01', 'f04', 'f01', 't02', 'f05', 'f02', 'f03', 'f06', 't03', 't04', 't05', 't06', 't07'], // v3: T-101A, T-102A, T-102D
        ].slice(Math.max(0, version - 1));
        const openUnder = (order: string[]) =>
          order.filter((id, i) => i === 0 || saved.progress?.[id] || saved.progress?.[order[i - 1]]?.done);
        return {
          active: saved.active ?? null, progress: saved.progress ?? {}, tabsets: saved.tabsets ?? {},
          history: saved.history ?? [], notes: saved.notes ?? '', crt: saved.crt ?? true,
          unlockAll: saved.unlockAll ?? false, streak: saved.streak ?? { last: null, count: 0 },
          legacyUnlocked: [...new Set([...(saved.legacyUnlocked ?? []), ...pastOrders.flatMap(openUnder)])],
        };
      },
      partialize: (s) => ({
        active: s.active,
        progress: s.progress,
        tabsets: s.tabsets,
        history: s.history,
        notes: s.notes,
        crt: s.crt,
        unlockAll: s.unlockAll,
        legacyUnlocked: s.legacyUnlocked,
        streak: s.streak,
      }),
    },
  ),
);

/* ---------- selectors ---------- */

export const progressOf = (s: GameState, id: string): Progress => s.progress[id] ?? NO_PROGRESS;

export const totalXp = (s: GameState): number =>
  Object.entries(s.progress).reduce((sum, [id, p]) => (p.done ? sum + (getTicket(id)?.xp ?? 0) : sum), 0);

/** Preserve access from old saves; new players follow the expanded campaign order. */
export const isUnlocked = (s: GameState, id: string): boolean => {
  const i = TICKETS.findIndex((t) => t.id === id);
  return i <= 0 || s.unlockAll || s.legacyUnlocked.includes(id) || !!s.progress[id] || !!s.progress[TICKETS[i - 1].id]?.done;
};

/** Table → columns, for the editor's autocomplete. */
export const schemaOf = (tables: TableInfo[] | null): Record<string, string[]> =>
  Object.fromEntries((tables ?? []).map((t) => [t.name, t.columns.map((c) => c.name)]));
