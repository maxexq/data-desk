// น้องข้าวเหนียว, the company mascot. Gives hints when asked, and (if allowed) speaks up
// when the player looks stuck or falls into a classic trap. Never answers for them.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../config';
import { resultKey, useGame } from './game';

export type Mood = 'idle' | 'talk' | 'happy' | 'worried' | 'think';

export type Bubble =
  | { kind: 'hints' }
  | { kind: 'intro' }
  | { kind: 'say'; text: string; mood: Mood; offerHint?: boolean; autoHide?: number };

interface MascotState {
  bubble: Bubble | null;
  met: boolean; // has introduced itself
  chatty: boolean; // may speak without being asked
  showHints: () => void;
  say: (text: string, mood: Mood, opts?: { offerHint?: boolean; autoHide?: number }) => void;
  intro: () => void;
  close: () => void;
  setChatty: (on: boolean) => void;
}

export const useMascot = create<MascotState>()(
  persist(
    (set) => ({
      bubble: null,
      met: false,
      chatty: true,
      showHints: () => set({ bubble: { kind: 'hints' } }),
      say: (text, mood, opts = {}) => set({ bubble: { kind: 'say', text, mood, ...opts } }),
      intro: () => set({ bubble: { kind: 'intro' } }),
      close: () => set((s) => ({ bubble: null, met: s.met || s.bubble?.kind === 'intro' })),
      setChatty: (chatty) => set({ chatty }),
    }),
    { name: `${STORAGE_KEY}-mascot`, version: 1, partialize: (s) => ({ met: s.met, chatty: s.chatty }) },
  ),
);

/**
 * `a.id = b.id` where a and b are different tables: it runs and the numbers look plausible,
 * but it pairs rows by coincidence. A self-join (same table, two aliases) is left alone.
 */
export const idEqualsId = (sql: string) => {
  const table = new Map<string, string>();
  const KEYWORDS = /^(on|using|where|join|left|right|inner|full|cross|group|order|limit|natural|lateral)$/i;
  for (const m of sql.matchAll(/\b(?:from|join)\s+(\w+)(?:\s+(?:as\s+)?(\w+))?/gi)) {
    const t = m[1].toLowerCase();
    table.set(t, t);
    if (m[2] && !KEYWORDS.test(m[2])) table.set(m[2].toLowerCase(), t);
  }
  for (const m of sql.matchAll(/\b(\w+)\.id\s*=\s*(\w+)\.id\b/gi)) {
    const a = table.get(m[1].toLowerCase()) ?? m[1].toLowerCase();
    const b = table.get(m[2].toLowerCase()) ?? m[2].toLowerCase();
    if (a !== b) return `${m[1]}.id = ${m[2]}.id`;
  }
  return null;
};

// ---------- reactions (only when chatty, and never over a hint the player asked for) ----------
let errors = 0; // failed runs in a row on the current task
const warned = new Set<string>(); // ticket/task where the id = id tip was already given

const speak = (text: string, mood: Mood, opts?: { offerHint?: boolean; autoHide?: number }) => {
  const m = useMascot.getState();
  if (!m.chatty || m.bubble?.kind === 'hints' || m.bubble?.kind === 'intro') return;
  m.say(text, mood, opts);
};

useGame.subscribe((s, prev) => {
  const id = s.active;
  if (!id || id !== prev.active) {
    errors = 0;
    return;
  }
  const p = s.progress[id];
  const p0 = prev.progress[id];

  if (p?.done && !p0?.done) {
    errors = 0;
    return speak('ปิดงานได้แล้ว! เก่งมากเลย ลองอ่านสรุปในหน้าต่าง Ticket Closed ดูนะ มีเรื่องที่ใช้ได้จริงตอนทำงาน', 'happy', { autoHide: 6000 });
  }
  if (p && p0 && p.task > p0.task) {
    errors = 0;
    return speak(`ผ่านขั้นที่ ${p.task} แล้ว ไปต่อกันเลย!`, 'happy', { autoHide: 3500 });
  }

  const tab = s.tabsets[id]?.active;
  if (!tab) return;
  const key = resultKey(id, tab);
  const r = s.results[key];
  if (!r || r === prev.results[key]) return;

  if (r.kind === 'error') {
    errors++;
    if (errors >= 3) {
      errors = 0;
      speak('ลองมาหลายรอบแล้ว ติดตรงไหนเหรอ? อ่านข้อความ error สีแดงก่อนก็ได้ หรือจะเอาคำใบ้ก็ได้นะ', 'worried', { offerHint: true });
    }
    return;
  }
  errors = 0;
  const sql = s.tabsets[id]?.tabs.find((t) => t.id === tab)?.sql ?? '';
  const bad = idEqualsId(sql);
  const where = `${id}/${p?.task ?? 0}`;
  if (bad && !warned.has(where)) {
    warned.add(where);
    speak(
      `เดี๋ยวก่อน! ${bad} คือเทียบรหัสของสองตารางที่ไม่เกี่ยวกัน มันรันได้และตัวเลขดูเหมือนถูก แต่จับคู่แถวมั่ว ปกติต้องเทียบ id กับ foreign key ที่ชี้มา เช่น st.id = s.staff_id ลองเปิด Tables ดูว่าคอลัมน์ไหนชี้ไปตารางไหน`,
      'worried',
    );
  }
});
