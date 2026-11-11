/**
 * Handle to the mounted SQL editor, so toolbar buttons and other windows can
 * drive it without importing CodeMirror (which stays in its own lazy chunk).
 * SqlEditor fills these in when it mounts.
 */
export const editor = {
  setDoc: (_text: string): void => {},
  format: async (): Promise<void> => {},
};
