// The playlist the player starts with. Stations are generated live (radio.ts); files are
// served from public/music/. Every file here must be free to redistribute: list its licence.
import { STATIONS } from './radio';

export type Track =
  | { kind: 'station'; id: string; title: string; artist: string; genre: string; station: string }
  | {
      kind: 'file';
      id: string;
      title: string;
      artist: string;
      genre: string;
      url: string;
      license?: string;
      source?: string; // page the file came from
      local?: boolean; // added by the player from their own computer, this session only
    };

export const BUILT_IN: Track[] = [
  ...STATIONS.map(
    (s): Track => ({ kind: 'station', id: `fm-${s.id}`, title: s.name, artist: 'Data Desk FM', genre: s.genre, station: s.id }),
  ),
  // Files go here, e.g.
  // { kind: 'file', id: 'chill-lofi', title: 'Chill lofi inspired', artist: 'omfgdude', genre: 'lofi',
  //   url: 'music/chill-lofi.mp3', license: 'CC0', source: 'https://opengameart.org/content/chill-lofi-inspired' },
];
