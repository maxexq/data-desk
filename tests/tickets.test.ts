// Every ticket must be solvable by its own model answer, and must not pass untouched.
import { afterAll, describe, expect, it } from 'vitest';
import { checkResult, judge, resetWorkspace } from '../src/lib/judge';
import { closeDb, execSql, inTransaction, lastRows } from '../src/lib/pg';
import { TICKETS } from '../src/tickets';
import { makeDaily } from '../src/tickets/daily';
import type { Ticket } from '../src/tickets/types';

const EMPTY = { columns: [], values: [] };

async function playThrough(ticket: Ticket) {
  await resetWorkspace(ticket, 0);
  for (const [i, task] of ticket.tasks.entries()) {
    const label = `${ticket.no} task ${i + 1}`;
    const files = typeof task.solution === 'string' ? {} : task.solution;
    const initial = Object.fromEntries((ticket.files ?? []).map((f) => [f.name, f.initial]));

    if (task.check.kind === 'result') {
      expect(await checkResult(task.check, EMPTY), `${label}: passes with an empty result`).toBe(false);
      const out = await execSql(task.solution as string);
      expect(out.ok, `${label}: solution fails: ${out.ok ? '' : out.error.message}`).toBe(true);
      const rows = out.ok ? lastRows(out.results) : undefined;
      expect(await checkResult(task.check, rows ?? EMPTY), `${label}: solution rejected`).toBe(true);
    } else {
      const before = await judge(ticket, task.check, initial);
      expect(before.pass, `${label}: passes before any work`).toBe(false);
      if (typeof task.solution === 'string') {
        const out = await execSql(task.solution);
        expect(out.ok, `${label}: solution fails: ${out.ok ? '' : out.error.message}`).toBe(true);
      }
      const after = await judge(ticket, task.check, files);
      expect(after.pass, `${label}: ${JSON.stringify(after.lines.filter((l) => !l.ok))}`).toBe(true);
    }
  }
}

afterAll(closeDb);

describe('campaign tickets', () => {
  for (const ticket of TICKETS) {
    it(`${ticket.no} ${ticket.title}`, () => playThrough(ticket), 60_000);
  }
});

describe('daily ticket', () => {
  it('is solvable for 14 consecutive days and deterministic', async () => {
    for (let d = 1; d <= 14; d++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`;
      expect(makeDaily(date).seed).toBe(makeDaily(date).seed);
      await playThrough(makeDaily(date));
    }
  }, 120_000);
});

describe('judge', () => {
  it('rejects a script that forgets COMMIT', async () => {
    const t06 = TICKETS.find((t) => t.id === 't06')!;
    const sol = t06.tasks[0].solution as Record<string, string>;
    const report = await judge(t06, t06.tasks[0].check, { ...sol, 'up.sql': sol['up.sql'].replace('COMMIT;', '') });
    expect(report.pass).toBe(false);
    expect(report.lines[0].detail).toContain('COMMIT');
  });

  it('detects an open transaction immediately, and an aborted one', async () => {
    await execSql('ROLLBACK');
    expect(await inTransaction()).toBe(false);
    await execSql('BEGIN');
    expect(await inTransaction()).toBe(true);
    await execSql('SELECT 1/0');
    expect(await inTransaction()).toBe(true);
    await execSql('ROLLBACK');
    expect(await inTransaction()).toBe(false);
  });

  it('does not count uncommitted work', async () => {
    const t04 = TICKETS.find((t) => t.id === 't04')!;
    await resetWorkspace(t04, 1);
    await execSql("BEGIN; UPDATE menu SET price_baht = 89 WHERE name = 'Mango Sticky Rice';");
    const report = await judge(t04, t04.tasks[1].check);
    expect(report.pass).toBe(false);
  });

  it('leaves the workspace usable after a script check', async () => {
    const t05 = TICKETS.find((t) => t.id === 't05')!;
    await resetWorkspace(t05, 0);
    await judge(t05, t05.tasks[0].check, t05.tasks[0].solution as Record<string, string>);
    const r = await execSql('SELECT count(*) FROM order_sheet');
    expect(r.ok && r.results[0].values[0][0]).toBe(12);
    const leaked = await execSql('SELECT count(*) FROM customers');
    expect(leaked.ok).toBe(false); // the judge's tables live in its own schema
  });
});
