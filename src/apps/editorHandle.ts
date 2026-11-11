/**
 * Handle to a mounted SQL editor, so toolbar buttons and other windows can drive it
 * without importing CodeMirror (which stays in its own lazy chunk). SqlEditor fills it
 * in when it mounts.
 */
export interface EditorHandle {
  setDoc: (text: string) => void;
  format: () => Promise<void>;
}

export const newHandle = (): EditorHandle => ({ setDoc: () => {}, format: async () => {} });

/** The ticket console's editor. */
export const editor = newHandle();
