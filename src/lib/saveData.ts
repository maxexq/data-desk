// What a signed-in player's save holds, and how a save from the server is merged with this device's.
// Pure functions: the rules are unit-tested.
import type { Progress, TabSet } from '../state/game';

export interface SaveData {
  v: 1;
  progress: Record<string, Progress>;
  legacyUnlocked: string[];
  streak: { last: string | null; count: number };
  notes: string;
  tabsets: Record<string, TabSet>;
  installed: string[];
  seen: string[];
}

/** How far a ticket got: closed beats any step, a later step beats an earlier one. */
const reach = (p: Progress) => (p.done ? Number.MAX_SAFE_INTEGER : p.task);

function better(a: Progress | undefined, b: Progress | undefined): Progress {
  if (!a) return b!;
  if (!b) return a;
  const win = reach(b) > reach(a) || (reach(b) === reach(a) && b.queries > a.queries) ? b : a;
  return { ...win, queries: Math.max(a.queries, b.queries), hints: Math.max(a.hints, b.hints), hintLevel: win.hintLevel };
}

const union = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])];

/**
 * Nothing a player earned on either side is lost: each ticket keeps the furthest progress,
 * unlocks and installed apps are combined, and the more recent streak wins.
 * Notes: the server's copy wins unless it is empty (it is the one every device writes to).
 * Open SQL tabs stay as they are on this device, and are filled in from the server for tickets
 * this device has not opened yet.
 */
export function mergeSaves(local: SaveData, remote: Partial<SaveData> | null | undefined): SaveData {
  if (!remote || remote.v !== 1) return local;
  const ids = union(Object.keys(local.progress), Object.keys(remote.progress ?? {}));
  const progress = Object.fromEntries(ids.map((id) => [id, better(local.progress[id], remote.progress?.[id])]));
  const ls = local.streak;
  const rs = remote.streak ?? { last: null, count: 0 };
  const streak = (rs.last ?? '') > (ls.last ?? '') ? rs : (ls.last ?? '') > (rs.last ?? '') ? ls : { last: ls.last, count: Math.max(ls.count, rs.count) };
  return {
    v: 1,
    progress,
    legacyUnlocked: union(local.legacyUnlocked, remote.legacyUnlocked),
    streak,
    notes: remote.notes ? remote.notes : local.notes,
    tabsets: { ...(remote.tabsets ?? {}), ...local.tabsets },
    installed: union(local.installed, remote.installed),
    seen: union(local.seen, remote.seen),
  };
}

/** Saves are capped at 256 KB on the server; open SQL tabs are the first thing to leave out. */
export function fitForUpload(save: SaveData, limit = 240 * 1024): SaveData {
  const size = (x: unknown) => new TextEncoder().encode(JSON.stringify({ data: x })).length;
  if (size(save) <= limit) return save;
  const lean = { ...save, tabsets: {} };
  return size(lean) <= limit ? lean : { ...lean, notes: lean.notes.slice(0, 20_000) };
}
