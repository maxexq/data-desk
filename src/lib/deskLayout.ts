// Where desktop icons go. Pure functions, so the rules are unit-tested without a browser.

export interface Point {
  x: number;
  y: number;
}

export const CELL = { w: 92, h: 86 };
export const ORIGIN = { x: 8, y: 10 };

export const cellToPoint = (col: number, row: number): Point => ({ x: ORIGIN.x + col * CELL.w, y: ORIGIN.y + row * CELL.h });

export const pointToCell = (p: Point) => ({
  col: Math.max(0, Math.round((p.x - ORIGIN.x) / CELL.w)),
  row: Math.max(0, Math.round((p.y - ORIGIN.y) / CELL.h)),
});

/** Rows of icons that fit above the taskbar. */
export const rowsFor = (desktopHeight: number) => Math.max(1, Math.floor((desktopHeight - ORIGIN.y) / CELL.h));

const cellKey = (col: number, row: number) => `${col}:${row}`;

/**
 * Position of every icon.
 * - auto-arrange: icons fill columns top to bottom in `ids` order, ignoring stored positions.
 * - otherwise: an icon keeps its stored position if it still fits on screen; the rest take the
 *   first free cells, column by column (this is also how new icons and a smaller window are handled).
 */
export function layoutIcons(ids: string[], stored: Record<string, Point>, rows: number, autoArrange: boolean): Record<string, Point> {
  const out: Record<string, Point> = {};
  if (autoArrange) {
    ids.forEach((id, i) => (out[id] = cellToPoint(Math.floor(i / rows), i % rows)));
    return out;
  }
  const maxY = cellToPoint(0, rows - 1).y;
  const taken = new Set<string>();
  const pending: string[] = [];
  for (const id of ids) {
    const p = stored[id];
    if (!p || p.y > maxY || p.x < 0 || p.y < 0) {
      pending.push(id);
      continue;
    }
    const { col, row } = pointToCell(p);
    const onGrid = cellToPoint(col, row).x === p.x && cellToPoint(col, row).y === p.y;
    if (onGrid && taken.has(cellKey(col, row))) {
      pending.push(id); // two icons stored on one cell: the later one moves
      continue;
    }
    taken.add(cellKey(col, row));
    out[id] = p;
  }
  let i = 0;
  for (const id of pending) {
    while (taken.has(cellKey(Math.floor(i / rows), i % rows))) i++;
    taken.add(cellKey(Math.floor(i / rows), i % rows));
    out[id] = cellToPoint(Math.floor(i / rows), i % rows);
  }
  return out;
}

/** Move `id` so that it sits at `index` in the order (used when dropping an icon with auto-arrange on). */
export function reorder(ids: string[], id: string, index: number): string[] {
  const rest = ids.filter((x) => x !== id);
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, id);
  return rest;
}

/** Snap every stored position to its nearest cell; if two land on the same cell the later one is dropped (and re-flows). */
export function snapAll(ids: string[], stored: Record<string, Point>): Record<string, Point> {
  const out: Record<string, Point> = {};
  const taken = new Set<string>();
  for (const id of ids) {
    const p = stored[id];
    if (!p) continue;
    const { col, row } = pointToCell(p);
    if (taken.has(cellKey(col, row))) continue;
    taken.add(cellKey(col, row));
    out[id] = cellToPoint(col, row);
  }
  return out;
}
