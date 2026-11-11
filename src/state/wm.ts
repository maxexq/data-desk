import { create } from 'zustand';
import { useViewport } from './viewport';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WinState extends Rect {
  open: boolean;
  min: boolean;
  max: boolean;
  z: number;
}

interface WMState {
  wins: Record<string, WinState>;
  order: string[]; // taskbar order (order of first open)
  top: number;
  topId: string | null;
  open: (id: string, def: Rect) => void;
  close: (id: string) => void;
  focus: (id: string) => void;
  minimize: (id: string) => void;
  toggleMax: (id: string) => void;
  place: (id: string, r: Partial<Rect>) => void;
  taskClick: (id: string) => void;
  closeAll: () => void;
  /** Pull every window back inside the screen (after a resize or rotation). */
  refit: () => void;
  /** Minimize every open window (show the desktop). */
  minimizeAll: () => void;
}

export const TASKBAR_H = 40;

/** The area windows may use: the whole screen above the taskbar. */
export const deskArea = () => ({ w: window.innerWidth, h: window.innerHeight - TASKBAR_H });

/** Shrink a window to fit the screen, then move it so no edge is outside. */
export const fitRect = (r: Rect, min = { w: 0, h: 0 }): Rect => {
  const area = deskArea();
  const w = Math.max(Math.min(min.w, area.w), Math.min(r.w, area.w));
  const h = Math.max(Math.min(min.h, area.h), Math.min(r.h, area.h));
  return {
    w,
    h,
    x: Math.max(0, Math.min(r.x, area.w - w)),
    y: Math.max(0, Math.min(r.y, area.h - h)),
  };
};

const topOf = (wins: Record<string, WinState>): string | null => {
  let best: string | null = null;
  let z = -1;
  for (const id in wins) {
    const w = wins[id];
    if (w.open && !w.min && w.z > z) {
      z = w.z;
      best = id;
    }
  }
  return best;
};

export const useWM = create<WMState>((set, get) => ({
  wins: {},
  order: [],
  top: 10,
  topId: null,

  open: (id, def) =>
    set((s) => {
      const prev = s.wins[id];
      const z = s.top + 1;
      const win: WinState = prev
        ? { ...prev, ...fitRect(prev), open: true, min: false, z }
        : { ...fitRect(def), open: true, min: false, max: false, z };
      return {
        wins: { ...s.wins, [id]: win },
        order: s.order.includes(id) ? s.order : [...s.order, id],
        top: z,
        topId: id,
      };
    }),

  close: (id) =>
    set((s) => {
      const wins = { ...s.wins, [id]: { ...s.wins[id], open: false } };
      return { wins, order: s.order.filter((o) => o !== id), topId: topOf(wins) };
    }),

  focus: (id) =>
    set((s) => {
      if (s.topId === id || !s.wins[id]) return s;
      const z = s.top + 1;
      return { wins: { ...s.wins, [id]: { ...s.wins[id], z } }, top: z, topId: id };
    }),

  minimize: (id) =>
    set((s) => {
      const wins = { ...s.wins, [id]: { ...s.wins[id], min: true } };
      return { wins, topId: topOf(wins) };
    }),

  toggleMax: (id) => set((s) => ({ wins: { ...s.wins, [id]: { ...s.wins[id], max: !s.wins[id].max } } })),

  place: (id, r) => set((s) => ({ wins: { ...s.wins, [id]: { ...s.wins[id], ...r } } })),

  taskClick: (id) => {
    const s = get();
    const w = s.wins[id];
    if (!w) return;
    if (w.min) s.open(id, w);
    else if (s.topId === id) s.minimize(id);
    else s.focus(id);
  },

  closeAll: () => set({ wins: {}, order: [], topId: null }),

  refit: () =>
    set((s) => ({
      wins: Object.fromEntries(Object.entries(s.wins).map(([id, w]) => [id, { ...w, ...fitRect(w) }])),
    })),

  minimizeAll: () =>
    set((s) => ({
      wins: Object.fromEntries(Object.entries(s.wins).map(([id, w]) => [id, w.open ? { ...w, min: true } : w])),
      topId: null,
    })),
}));

// Keep windows on screen when the browser is resized or a phone rotates.
useViewport.subscribe(() => useWM.getState().refit());
