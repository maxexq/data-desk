// The music player's engine and state. It lives outside any window, so music keeps
// playing while the player is minimized; closing the player window stops it.
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY } from '../config';
import { useWM } from '../state/wm';
import { Radio, STATIONS } from './radio';
import { BUILT_IN, type Track } from './tracks';

export type Repeat = 'all' | 'one' | 'off';

interface PlayerState {
  tracks: Track[];
  index: number;
  status: 'stopped' | 'playing' | 'paused';
  volume: number; // 0..1
  shuffle: boolean;
  repeat: Repeat;
  time: number; // seconds into the current track
  duration: number; // Infinity for a station
  error: string | null;
  play: (index?: number) => void;
  pause: () => void;
  toggle: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addFiles: (files: FileList | File[]) => void;
}

// ---------- audio graph: source → volume → analyser → speakers ----------
let ctx: AudioContext | null = null;
let volume: GainNode;
let analyser: AnalyserNode;
let audio: HTMLAudioElement | null = null;
let radio: Radio | null = null;
let stationStart = 0; // ctx time the station started, minus time already played
let clock: ReturnType<typeof setInterval> | null = null;

function graph() {
  if (ctx) return ctx;
  ctx = new AudioContext();
  volume = ctx.createGain();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.75;
  volume.connect(analyser).connect(ctx.destination);
  audio = new Audio();
  audio.preload = 'auto';
  ctx.createMediaElementSource(audio).connect(volume);
  audio.addEventListener('timeupdate', () => usePlayer.setState({ time: audio!.currentTime }));
  audio.addEventListener('durationchange', () => usePlayer.setState({ duration: audio!.duration || 0 }));
  audio.addEventListener('ended', () => usePlayer.getState().repeat === 'one' ? usePlayer.getState().play() : advance(1, true));
  audio.addEventListener('error', () => usePlayer.setState({ error: 'เปิดไฟล์นี้ไม่ได้', status: 'stopped' }));
  volume.gain.value = curve(usePlayer.getState().volume);
  return ctx;
}

/** Ears hear volume logarithmically; a squared slider feels even. */
const curve = (v: number) => v * v;

/** For the spectrum display. Null until something has played. */
export const getAnalyser = () => (ctx ? analyser : null);

function halt() {
  radio?.stop();
  radio = null;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  if (clock) clearInterval(clock);
  clock = null;
}

function advance(dir: 1 | -1, auto = false): void {
  const s: PlayerState = usePlayer.getState();
  const n = s.tracks.length;
  if (!n) return;
  let i: number;
  if (s.shuffle && n > 1) {
    do i = Math.floor(Math.random() * n);
    while (i === s.index);
  } else {
    i = s.index + dir;
    if (i >= n || i < 0) {
      if (auto && s.repeat === 'off') return s.stop();
      i = (i + n) % n;
    }
  }
  s.play(i);
}

export const usePlayer: UseBoundStore<StoreApi<PlayerState>> = create<PlayerState>()(
  persist<PlayerState, [], [], Pick<PlayerState, 'index' | 'volume' | 'shuffle' | 'repeat'>>(
    (set, get): PlayerState => ({
      tracks: BUILT_IN,
      index: 0,
      status: 'stopped',
      volume: 0.6,
      shuffle: false,
      repeat: 'all',
      time: 0,
      duration: 0,
      error: null,

      play: (index) => {
        const s = get();
        const c = graph();
        void c.resume();
        // Resume a paused track.
        if (index === undefined && s.status === 'paused') {
          const t = s.tracks[s.index];
          if (t?.kind === 'file') void audio!.play();
          set({ status: 'playing' });
          return;
        }
        const i = Math.max(0, Math.min(index ?? s.index, s.tracks.length - 1));
        const track = s.tracks[i];
        if (!track) return;
        halt();
        set({ index: i, status: 'playing', time: 0, error: null });
        if (track.kind === 'station') {
          radio = new Radio(c, volume, STATIONS.find((x) => x.id === track.station)!);
          radio.start();
          stationStart = c.currentTime;
          set({ duration: Infinity });
          clock = setInterval(() => {
            if (get().status === 'playing') set({ time: c.currentTime - stationStart });
          }, 250);
        } else {
          audio!.src = track.url;
          set({ duration: 0 });
          audio!.play().catch(() => set({ error: 'เปิดไฟล์นี้ไม่ได้', status: 'stopped' }));
        }
      },

      pause: () => {
        const s = get();
        if (s.status !== 'playing') return;
        // A station pauses by suspending the whole audio clock; its scheduler simply waits.
        if (s.tracks[s.index]?.kind === 'station') void ctx?.suspend();
        else audio?.pause();
        set({ status: 'paused' });
      },

      toggle: () => (get().status === 'playing' ? get().pause() : get().play()),

      stop: () => {
        halt();
        set({ status: 'stopped', time: 0 });
      },

      next: () => advance(1),
      prev: () => (get().time > 3 && get().tracks[get().index]?.kind === 'file' ? get().seek(0) : advance(-1)),

      seek: (t) => {
        if (audio && get().tracks[get().index]?.kind === 'file' && Number.isFinite(audio.duration)) audio.currentTime = t;
      },

      setVolume: (v) => {
        const vol = Math.max(0, Math.min(1, v));
        if (ctx) volume.gain.setTargetAtTime(curve(vol), ctx.currentTime, 0.03);
        set({ volume: vol });
      },

      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'all' ? 'one' : s.repeat === 'one' ? 'off' : 'all' })),

      addFiles: (files) => {
        const added: Track[] = [...files]
          .filter((f) => f.type.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|flac|opus)$/i.test(f.name))
          .map((f) => ({
            kind: 'file',
            id: `local-${f.name}-${f.size}`,
            title: f.name.replace(/\.[^.]+$/, ''),
            artist: 'ไฟล์ในเครื่อง',
            genre: 'local',
            url: URL.createObjectURL(f),
            local: true,
          }));
        set((s) => ({ tracks: [...s.tracks, ...added.filter((a) => !s.tracks.some((t) => t.id === a.id))] }));
      },
    }),
    {
      name: `${STORAGE_KEY}-player`,
      version: 1,
      // Local files are object URLs that die with the page, so they are never saved.
      partialize: (s) => ({ index: s.index, volume: s.volume, shuffle: s.shuffle, repeat: s.repeat }),
      merge: (saved, cur) => {
        const p = (saved ?? {}) as Partial<PlayerState>;
        return { ...cur, ...p, index: Math.min(p.index ?? 0, cur.tracks.length - 1) };
      },
    },
  ),
);

// Closing the player window turns the music off, like quitting the app.
useWM.subscribe((s, prev) => {
  if (prev.wins.music?.open && !s.wins.music?.open) usePlayer.getState().stop();
});
