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
    // AND binds tighter than OR: every Chiang Mai customer slips in
    ['f04', 0, "SELECT id, name FROM customers WHERE tier = 'gold' AND city = 'Bangkok' OR city = 'Chiang Mai' ORDER BY id"],
    ['f04', 1, "SELECT id, email FROM customers WHERE email LIKE '%@gmail.com' ORDER BY id"],
    ['f04', 1, "SELECT id, email FROM customers WHERE email ILIKE '%gmail%' ORDER BY id"],
    // NOT IN against a list holding NULL is never true
    ['f04', 2, 'SELECT id, name FROM customers WHERE id NOT IN (SELECT referred_by FROM customers) ORDER BY id'],
    ['f05', 0, 'SELECT branch, COUNT(*), COUNT(*), COUNT(customer_id), ROUND(AVG(COALESCE(stars, 0)), 2) FROM reviews GROUP BY branch ORDER BY branch'],
    // integer division drops the fraction
    ['f05', 1, 'SELECT branch, day, ROUND(100 * orders / NULLIF(visitors, 0), 1) FROM traffic ORDER BY day, branch'],
    // an average of daily percentages is not the overall rate
    ['f05', 2, 'SELECT branch, ROUND(AVG(100.0 * orders / NULLIF(visitors, 0)), 1) FROM traffic GROUP BY branch ORDER BY branch'],
    // MAX then join back returns both orders on the same latest day
    ['f07', 0, 'SELECT o.customer_id, o.id, o.ordered_on, o.total_baht FROM orders o JOIN (SELECT customer_id, MAX(ordered_on) AS d FROM orders GROUP BY customer_id) m ON m.customer_id = o.customer_id AND m.d = o.ordered_on ORDER BY o.customer_id'],
    // LAG without PARTITION BY compares against another customer's order
    ['f07', 1, 'SELECT id, customer_id, ordered_on, ordered_on - LAG(ordered_on) OVER (ORDER BY ordered_on, id) FROM orders ORDER BY customer_id, ordered_on, id'],
    ['f07', 2, "SELECT to_char(ordered_on, 'YYYY-MM'), SUM(total_baht), SUM(total_baht) - LAG(SUM(total_baht)) OVER (ORDER BY to_char(ordered_on, 'YYYY-MM') DESC) FROM orders GROUP BY 1 ORDER BY 1"],
    ['f08', 0, 'SELECT day, revenue, SUM(revenue) OVER () FROM daily_sales ORDER BY day'],
    // generate_series gives timestamps, not dates
    ['f08', 1, "SELECT d, COALESCE(s.revenue, 0) FROM generate_series(DATE '2026-11-01', DATE '2026-11-10', INTERVAL '1 day') AS d LEFT JOIN daily_sales s ON s.day = d::date ORDER BY d"],
    // a moving average over the raw rows silently skips the closed days
    ['f08', 2, 'SELECT day, revenue, ROUND(AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) FROM daily_sales ORDER BY day'],
    ['f09', 0, "SELECT customer_id, to_char(MAX(ordered_on), 'YYYY-MM') FROM orders GROUP BY customer_id ORDER BY customer_id"],
    // counting orders instead of people
    ['f09', 1, "WITH f AS (SELECT customer_id, date_trunc('month', MIN(ordered_on)) AS c FROM orders GROUP BY customer_id) SELECT to_char(f.c, 'YYYY-MM'), COUNT(DISTINCT f.customer_id), COUNT(o.id), ROUND(100.0 * COUNT(o.id) / COUNT(DISTINCT f.customer_id), 1) FROM f LEFT JOIN orders o ON o.customer_id = f.customer_id AND date_trunc('month', o.ordered_on) = f.c + INTERVAL '1 month' GROUP BY f.c ORDER BY f.c"],
    ['f09', 2, "WITH f AS (SELECT customer_id, date_trunc('month', MIN(ordered_on)) AS c FROM orders GROUP BY customer_id) SELECT to_char(f.c, 'YYYY-MM'), EXTRACT(MONTH FROM o.ordered_on) - EXTRACT(MONTH FROM f.c), COUNT(*) FROM f JOIN orders o ON o.customer_id = f.customer_id GROUP BY 1, 2 ORDER BY 1, 2"],
    ['f06', 0, 'SELECT o.branch, SUM(i.price_baht) FROM orders o JOIN order_items i ON i.order_id = o.id GROUP BY o.branch ORDER BY o.branch'],
    // joining two child tables at once multiplies rows
    ['f06', 1, 'SELECT o.branch, SUM(i.qty * i.price_baht), SUM(p.amount_baht) FROM orders o JOIN order_items i ON i.order_id = o.id JOIN payments p ON p.order_id = o.id GROUP BY o.branch ORDER BY o.branch'],
    // an inner join loses the order nobody has paid for yet
    ['f06', 2, 'WITH due AS (SELECT order_id, SUM(qty * price_baht) AS due FROM order_items GROUP BY order_id), paid AS (SELECT order_id, SUM(amount_baht) AS paid FROM payments GROUP BY order_id) SELECT o.id, o.branch, due.due, paid.paid, due.due - paid.paid FROM orders o JOIN due ON due.order_id = o.id JOIN paid ON paid.order_id = o.id WHERE due.due > paid.paid ORDER BY o.id'],
  ];
  for (const [id, step, sql] of mistakes) {
    it(`${id} step ${step + 1} rejects: ${sql.slice(0, 60)}…`, async () => {
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
