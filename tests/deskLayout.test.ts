import { describe, expect, it } from 'vitest';
import { CELL, ORIGIN, cellToPoint, layoutIcons, pointToCell, reorder, rowsFor, snapAll } from '../src/lib/deskLayout';

const ids = ['a', 'b', 'c', 'd', 'e'];

describe('desktop icon layout', () => {
  it('converts between cells and points', () => {
    expect(cellToPoint(0, 0)).toEqual(ORIGIN);
    expect(pointToCell(cellToPoint(2, 3))).toEqual({ col: 2, row: 3 });
    expect(pointToCell({ x: ORIGIN.x + CELL.w * 0.6, y: -50 })).toEqual({ col: 1, row: 0 });
  });

  it('fits as many rows as the desktop height allows, never fewer than one', () => {
    expect(rowsFor(ORIGIN.y + CELL.h * 4 + 10)).toBe(4);
    expect(rowsFor(20)).toBe(1);
  });

  it('auto-arrange fills columns top to bottom and ignores stored positions', () => {
    const at = layoutIcons(ids, { a: { x: 500, y: 300 } }, 2, true);
    expect(ids.map((id) => pointToCell(at[id]))).toEqual([
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 0 },
    ]);
  });

  it('keeps hand-placed icons and flows the rest around them', () => {
    const at = layoutIcons(ids, { c: cellToPoint(0, 1), e: { x: 333, y: 77 } }, 3, false);
    expect(at.c).toEqual(cellToPoint(0, 1));
    expect(at.e).toEqual({ x: 333, y: 77 }); // free placement survives
    expect(at.a).toEqual(cellToPoint(0, 0));
    expect(at.b).toEqual(cellToPoint(0, 2)); // skipped c's cell
    expect(at.d).toEqual(cellToPoint(1, 0));
  });

  it('re-flows icons that no longer fit or share a cell', () => {
    const low = cellToPoint(0, 5);
    const at = layoutIcons(['a', 'b', 'c'], { a: low, b: cellToPoint(1, 0), c: cellToPoint(1, 0) }, 3, false);
    expect(at.a).toEqual(cellToPoint(0, 0)); // row 5 is off a 3-row desktop
    expect(at.b).toEqual(cellToPoint(1, 0));
    expect(at.c).toEqual(cellToPoint(0, 1));
    expect(new Set(Object.values(at).map((p) => `${p.x},${p.y}`)).size).toBe(3);
  });

  it('reorders by moving one icon to an index', () => {
    expect(reorder(ids, 'd', 0)).toEqual(['d', 'a', 'b', 'c', 'e']);
    expect(reorder(ids, 'a', 99)).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(reorder(ids, 'b', 2)).toEqual(['a', 'c', 'b', 'd', 'e']);
  });

  it('snaps free positions to the grid without stacking two icons', () => {
    const near = { x: ORIGIN.x + CELL.w + 9, y: ORIGIN.y + 11 };
    const out = snapAll(['a', 'b'], { a: near, b: { x: near.x - 15, y: near.y - 5 } });
    expect(out.a).toEqual(cellToPoint(1, 0));
    expect(out.b).toBeUndefined();
  });
});
