// Every ticket must be solvable by its own model answer, and must not pass untouched.
import { afterAll, describe, expect, it } from 'vitest';
import { checkResult, inspectResult, judge, resetWorkspace } from '../src/lib/judge';
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

describe('foundation mistakes', () => {
  const mistakes: [string, number, string][] = [
    ['f01', 0, 'SELECT id, branch, total_baht FROM orders ORDER BY total_baht DESC, id DESC'],
    ['f01', 1, 'SELECT id, total_baht FROM orders ORDER BY id LIMIT 3'],
    ['f01', 2, 'SELECT branch FROM orders ORDER BY branch'],
    ['f02', 0, 'SELECT id, name FROM customers WHERE phone = NULL ORDER BY id'],
    ['f02', 1, 'SELECT c.id, c.name FROM customers c JOIN orders o ON o.customer_id = c.id ORDER BY c.id'],
    ['f02', 2, 'SELECT id, name, phone FROM customers ORDER BY id'],
    ['f03', 0, "SELECT id, total_baht FROM orders WHERE ordered_at BETWEEN DATE '2026-11-01' AND DATE '2026-11-30' ORDER BY id"],
    ['f03', 1, "SELECT id, CASE WHEN total_baht <= 100 THEN 'small' WHEN total_baht <= 500 THEN 'medium' ELSE 'large' END FROM orders ORDER BY id"],
    ['f03', 2, 'SELECT COUNT(*), SUM(total_baht) FROM orders'],
  ];
  for (const [id, step, sql] of mistakes) {
    it(`${id} step ${step + 1} rejects a common misconception`, async () => {
      const ticket = TICKETS.find((t) => t.id === id)!;
      await resetWorkspace(ticket);
      const out = await execSql(sql);
      expect(out.ok).toBe(true);
      const check = ticket.tasks[step].check;
      if (check.kind !== 'result') throw new Error('Expected a result check');
      expect(await checkResult(check, out.ok ? lastRows(out.results)! : EMPTY)).toBe(false);
    });
  }
});

describe('judge', () => {
  it('explains shape, count, ordering and value errors without revealing reference data', async () => {
    const check = { kind: 'result' as const, expect: 'SELECT * FROM (VALUES (1, 10), (2, 20)) AS v(id, amount) ORDER BY id', ordered: true };
    const cases = [
      { columns: ['id'], values: [[1], [2]], message: 'จำนวนคอลัมน์' },
      { columns: ['id', 'amount'], values: [[1, 10]], message: 'ยังขาด' },
      { columns: ['id', 'amount'], values: [[1, 10], [2, 20], [2, 20]], message: 'ยังเกิน' },
      { columns: ['id', 'amount'], values: [[2, 20], [1, 10]], message: 'ลำดับแถว' },
      { columns: ['id', 'amount'], values: [[1, 10], [1, 10]], message: 'ค่ายังไม่ตรง' },
    ];
    for (const { message, ...rows } of cases) {
      const report = await inspectResult(check, rows);
      expect(report.pass).toBe(false);
      expect(report.lines[0].name).toContain(message);
      expect(JSON.stringify(report)).not.toContain(check.expect);
    }
    expect((await inspectResult({ ...check, ordered: false }, { columns: ['a', 'b'], values: [[2, 20], [1, 10]] })).pass).toBe(true);
    expect((await inspectResult(check, { columns: ['a', 'b'], values: [['1', '10.0'], [2, 20]] })).pass).toBe(true);
  });

  it('uses tailored feedback for open-ended tasks and reports reference failures honestly', async () => {
    const check = TICKETS[0].tasks[0].check;
    const report = await inspectResult(check as Extract<typeof check, { kind: 'result' }>, EMPTY);
    expect(report.pass).toBe(false);
    expect(report.lines[0].detail).toContain('suspects');
    const broken = await inspectResult({ kind: 'result', expect: 'SELECT 1/0' }, EMPTY);
    expect(broken.pass).toBe(false);
    expect(broken.lines[0].name).toBe('ยังตรวจคำตอบไม่ได้');
  });

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
