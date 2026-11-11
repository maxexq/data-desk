import { describe, expect, it, vi } from 'vitest';

// The mascot module subscribes to the game store; only the pure check is under test here.
vi.mock('../src/state/game', () => ({ useGame: { subscribe: () => () => {} }, resultKey: () => '' }));
const { idEqualsId } = await import('../src/state/mascot');

describe('idEqualsId', () => {
  it.each([
    ['SELECT * FROM sales AS s JOIN staff AS st ON st.id = s.id', 'st.id = s.id'],
    ['SELECT * FROM sales s JOIN staff st ON s.id=st.id', 's.id=st.id'.replace('=', ' = ')],
    ['SELECT * FROM sales JOIN staff ON staff.id = sales.id', 'staff.id = sales.id'],
  ])('flags %s', (sql, want) => expect(idEqualsId(sql)).toBe(want));

  it.each([
    'SELECT * FROM sales AS s JOIN staff AS st ON st.id = s.staff_id',
    'SELECT * FROM sales AS a JOIN sales AS b ON b.id = a.id',
    'SELECT * FROM t WHERE t.id = t.id',
    'SELECT 1',
  ])('leaves %s alone', (sql) => expect(idEqualsId(sql)).toBeNull());
});
