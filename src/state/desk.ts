import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../config';
import { snapAll, type Point } from '../lib/deskLayout';

interface DeskState {
  order: string[]; // icon ids, in arrangement order
  pos: Record<string, Point>; // hand-placed positions (ignored while auto-arrange is on)
  autoArrange: boolean;
  alignGrid: boolean;
  refreshTick: number; // bumped by Refresh to replay the redraw flicker (not persisted)
  setOrder: (order: string[]) => void;
  place: (moves: Record<string, Point>) => void;
  /** Lay the icons out again in this order, dropping every hand-placed position. */
  arrange: (order: string[]) => void;
  toggleAutoArrange: () => void;
  toggleAlignGrid: () => void;
  refresh: () => void;
  reset: () => void;
}

export const useDesk = create<DeskState>()(
  persist(
    (set) => ({
      order: [],
      pos: {},
      autoArrange: false,
      alignGrid: true,
      refreshTick: 0,
      setOrder: (order) => set({ order }),
      place: (moves) => set((s) => ({ pos: { ...s.pos, ...moves } })),
      arrange: (order) => set({ order, pos: {} }),
      toggleAutoArrange: () => set((s) => ({ autoArrange: !s.autoArrange, pos: s.autoArrange ? s.pos : {} })),
      toggleAlignGrid: () => set((s) => (s.alignGrid ? { alignGrid: false } : { alignGrid: true, pos: snapAll(Object.keys(s.pos), s.pos) })),
      refresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
      reset: () => set({ order: [], pos: {}, autoArrange: false, alignGrid: true }),
    }),
    {
      name: `${STORAGE_KEY}-desktop`,
      version: 1,
      partialize: (s) => ({ order: s.order, pos: s.pos, autoArrange: s.autoArrange, alignGrid: s.alignGrid }),
    },
  ),
);
