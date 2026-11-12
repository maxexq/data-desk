import { describe, expect, it } from 'vitest';
import { fitForUpload, mergeSaves, type SaveData } from '../src/lib/saveData';

const p = (task: number, done = false, queries = 1) => ({ task, done, queries, hints: 0, hintLevel: 0 });
const save = (over: Partial<SaveData> = {}): SaveData => ({
  v: 1, progress: {}, legacyUnlocked: [], streak: { last: null, count: 0 }, notes: '', tabsets: {}, installed: [], seen: [], ...over,
});

describe('mergeSaves', () => {
  it('keeps the furthest progress of every ticket from either side', () => {
    const local = save({ progress: { t01: p(9, true), t02: p(1), f01: p(2) } });
    const remote = save({ progress: { t01: p(2), t02: p(3), t03: p(0, false, 5) } });
    const m = mergeSaves(local, remote);
    expect(m.progress.t01.done).toBe(true);
    expect(m.progress.t02.task).toBe(3);
    expect(m.progress.f01.task).toBe(2);
    expect(m.progress.t03.queries).toBe(5);
  });

  it('combines unlocks and installed apps, and takes the newer streak', () => {
    const m = mergeSaves(
      save({ legacyUnlocked: ['t01'], installed: ['erd'], streak: { last: '2026-11-10', count: 4 } }),
      save({ legacyUnlocked: ['t02'], installed: ['sandbox'], streak: { last: '2026-11-12', count: 1 } }),
    );
    expect(m.legacyUnlocked.sort()).toEqual(['t01', 't02']);
    expect(m.installed.sort()).toEqual(['erd', 'sandbox']);
    expect(m.streak).toEqual({ last: '2026-11-12', count: 1 });
  });

  it("uses the server's notes unless they are empty, and keeps this device's open tabs", () => {
    const tabs = (sql: string) => ({ active: 'a', tabs: [{ id: 'a', title: 'Query 1', sql }] });
    expect(mergeSaves(save({ notes: 'here' }), save({ notes: 'there' })).notes).toBe('there');
    expect(mergeSaves(save({ notes: 'here' }), save({ notes: '' })).notes).toBe('here');
    const m = mergeSaves(save({ tabsets: { t01: tabs('local') } }), save({ tabsets: { t01: tabs('remote'), t02: tabs('other') } }));
    expect(m.tabsets.t01.tabs[0].sql).toBe('local');
    expect(m.tabsets.t02.tabs[0].sql).toBe('other');
  });

  it('ignores an empty or unknown server save', () => {
    const local = save({ notes: 'x' });
    expect(mergeSaves(local, null)).toBe(local);
    expect(mergeSaves(local, { v: 2 } as unknown as SaveData)).toBe(local);
  });

  it('drops open tabs first when a save is too large', () => {
    const big = save({ tabsets: { t01: { active: 'a', tabs: [{ id: 'a', title: 'Q', sql: 'x'.repeat(300_000) }] } }, notes: 'keep me' });
    const fitted = fitForUpload(big);
    expect(fitted.tabsets).toEqual({});
    expect(fitted.notes).toBe('keep me');
  });
});
