// Signing in with Google or GitHub, and keeping progress in step with the server.
// When the site runs without its backend (local dev, tests) everything here stays out of sight.
import { create } from 'zustand';
import { fitForUpload, mergeSaves, type SaveData } from '../lib/saveData';
import { useGame } from './game';
import { useShelf, type ShelfId } from './shelf';

export type Provider = 'google' | 'github';

export interface Account {
  id: string;
  provider: Provider;
  name: string;
  avatarUrl: string | null;
}

interface AccountState {
  /** checking → offline (no backend) | signed-out | signed-in */
  status: 'checking' | 'offline' | 'signed-out' | 'signed-in';
  user: Account | null;
  providers: Provider[];
  sync: 'idle' | 'saving' | 'saved' | 'error';
  savedAt: number | null;
  check: () => Promise<void>;
  login: (p: Provider) => void;
  logout: () => Promise<void>;
  syncNow: () => Promise<void>;
}

export const LOGIN_ERRORS: Record<string, string> = {
  cancelled: 'ยกเลิกการเข้าสู่ระบบแล้ว',
  state: 'การเข้าสู่ระบบหมดเวลาหรือถูกเปิดจากหน้าอื่น ลองใหม่อีกครั้ง',
  provider: 'ผู้ให้บริการไม่ยืนยันการเข้าสู่ระบบ ลองใหม่อีกครั้ง',
  not_configured: 'ระบบนี้ยังไม่ได้ตั้งค่าการเข้าสู่ระบบแบบนี้',
  server: 'เซิร์ฟเวอร์มีปัญหาระหว่างเข้าสู่ระบบ ลองใหม่อีกครั้ง',
};

const isJson = (r: Response) => (r.headers.get('content-type') ?? '').includes('application/json');

/** This device's save, in the shape the server keeps. */
function snapshot(): SaveData {
  const g = useGame.getState();
  const sh = useShelf.getState();
  return {
    v: 1,
    progress: g.progress,
    legacyUnlocked: g.legacyUnlocked,
    streak: g.streak,
    notes: g.notes,
    tabsets: g.tabsets,
    installed: sh.installed,
    seen: sh.seen,
  };
}

function apply(save: SaveData) {
  useGame.setState({ progress: save.progress, legacyUnlocked: save.legacyUnlocked, streak: save.streak, notes: save.notes, tabsets: save.tabsets });
  useShelf.setState({ installed: save.installed as ShelfId[], seen: save.seen as ShelfId[] });
}

let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let applying = false;

async function upload(keepalive = false) {
  const s = useAccount.getState();
  if (s.status !== 'signed-in') return;
  useAccount.setState({ sync: 'saving' });
  try {
    const r = await fetch('/api/progress', {
      method: 'PUT',
      credentials: 'same-origin',
      keepalive,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: fitForUpload(snapshot()) }),
    });
    if (r.status === 401) return void useAccount.setState({ status: 'signed-out', user: null, sync: 'idle' });
    if (!r.ok) throw new Error(String(r.status));
    useAccount.setState({ sync: 'saved', savedAt: Date.now() });
  } catch {
    useAccount.setState({ sync: 'error' });
  }
}

const scheduleUpload = () => {
  if (applying) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void upload(), 2500);
};

/** Pull the server's save, merge it with this device's, then keep uploading changes. */
async function startSync() {
  try {
    const r = await fetch('/api/progress', { credentials: 'same-origin' });
    if (r.ok && isJson(r)) {
      const { data } = (await r.json()) as { data: Partial<SaveData> | null };
      applying = true;
      apply(mergeSaves(snapshot(), data));
      applying = false;
    }
  } catch {
    // offline for a moment: keep playing locally, the next change will try again
  }
  await upload();
  unsubscribe?.();
  const a = useGame.subscribe((s, p) => {
    if (s.progress !== p.progress || s.notes !== p.notes || s.streak !== p.streak || s.tabsets !== p.tabsets) scheduleUpload();
  });
  const b = useShelf.subscribe((s, p) => {
    if (s.installed !== p.installed) scheduleUpload();
  });
  unsubscribe = () => (a(), b());
}

export const useAccount = create<AccountState>((set, get) => ({
  status: 'checking',
  user: null,
  providers: [],
  sync: 'idle',
  savedAt: null,

  check: async () => {
    try {
      const r = await fetch('/api/me', { credentials: 'same-origin' });
      if (!r.ok || !isJson(r)) return set({ status: 'offline' });
      const { user, providers } = (await r.json()) as { user: Account | null; providers: Provider[] };
      if (!providers.length && !user) return set({ status: 'offline' });
      set({ user, providers, status: user ? 'signed-in' : 'signed-out' });
      if (user) await startSync();
    } catch {
      set({ status: 'offline' });
    }
  },

  login: (p) => {
    window.location.assign(`/api/auth/${p}/login`);
  },

  logout: async () => {
    if (timer) clearTimeout(timer);
    await upload();
    unsubscribe?.();
    unsubscribe = null;
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    set({ status: 'signed-out', user: null, sync: 'idle', savedAt: null });
    useGame.getState().say('ออกจากระบบแล้ว ความคืบหน้ายังอยู่ในเครื่องนี้');
  },

  syncNow: async () => {
    if (get().status === 'signed-in') await startSync();
  },
}));

// Leaving the page: send what is pending, even as the tab closes.
if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer);
      timer = null;
      void upload(true);
    }
  });

/** The server sends the browser back with ?login=… or ?login_error=…: say what happened, then tidy the address bar. */
export function readLoginResult() {
  const url = new URL(window.location.href);
  const ok = url.searchParams.get('login');
  const err = url.searchParams.get('login_error');
  if (!ok && !err) return;
  url.searchParams.delete('login');
  url.searchParams.delete('login_error');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return err ? (LOGIN_ERRORS[err] ?? 'เข้าสู่ระบบไม่สำเร็จ') : `เข้าสู่ระบบด้วย ${ok === 'google' ? 'Google' : 'GitHub'} แล้ว ความคืบหน้าจะซิงก์ข้ามเครื่องให้อัตโนมัติ`;
}
