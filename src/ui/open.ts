import { useWM } from '../state/wm';
import type { AppDef } from './Win';

/** Filled by apps/registry.tsx. Kept separate so apps can open each other without import cycles. */
export const defs = new Map<string, AppDef>();

export function openApp(id: string) {
  const def = defs.get(id);
  if (def) useWM.getState().open(id, def);
}
