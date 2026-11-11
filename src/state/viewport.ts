// Screen size and input type, kept current as the browser resizes or the phone rotates.
import { create } from 'zustand';

/** Below this the desktop metaphor gets cramped: windows go full-screen, one at a time. */
export const COMPACT_W = 760;
export const COMPACT_H = 500;

interface Viewport {
  w: number;
  h: number;
  /** Phone-sized: every window is maximized and cannot be dragged or resized. */
  compact: boolean;
  /** Touch is the main pointer: bigger targets, tap to open, long-press for menus. */
  coarse: boolean;
}

const read = (): Viewport => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    w,
    h,
    compact: w < COMPACT_W || h < COMPACT_H,
    coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
  };
};

export const useViewport = create<Viewport>(read);

let frame = 0;
const update = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const next = read();
    const cur = useViewport.getState();
    if (next.w !== cur.w || next.h !== cur.h || next.coarse !== cur.coarse) useViewport.setState(next);
  });
};
window.addEventListener('resize', update);
window.addEventListener('orientationchange', update);
window.matchMedia?.('(pointer: coarse)').addEventListener?.('change', update);
