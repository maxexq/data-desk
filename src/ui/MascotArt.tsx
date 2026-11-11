// น้องข้าวเหนียว: a pixel-art sticky-rice ball wearing a slice of mango. Drawn on a 24×24 grid.
import { memo } from 'react';
import type { Mood } from '../state/mascot';

type Px = [x: number, y: number, w: number, h: number, color: string];

const INK = '#1c1a2e';
const RICE = '#fffdf5';
const SHADE = '#e9e3d3';
const GRAIN = '#d8d0bc';
const MANGO = '#ffa94d';
const MANGO_HI = '#ffd43b';
const BLUSH = '#ffa8a8';

/** Body: an ellipse filled row by row, with an outline and a shaded bottom. */
function body(): Px[] {
  const out: Px[] = [];
  const cx = 12;
  const cy = 15.5;
  const rx = 9.6;
  const ry = 7.4;
  for (let y = 8; y <= 23; y++) {
    const t = 1 - ((y + 0.5 - cy) / ry) ** 2;
    if (t <= 0) continue;
    const half = Math.floor(rx * Math.sqrt(t));
    const x0 = cx - half;
    const w = half * 2;
    out.push([x0, y, w, 1, INK]);
    out.push([x0 + 1, y, w - 2, 1, y >= 20 ? SHADE : RICE]);
  }
  // top and bottom outline
  out.push([7, 8, 10, 1, INK], [7, 23, 10, 1, INK]);
  // rice grains
  for (const [x, y] of [
    [6, 12],
    [17, 11],
    [9, 21],
    [15, 21],
    [19, 15],
    [4, 16],
  ])
    out.push([x, y, 2, 1, GRAIN]);
  return out;
}

/** A slice of mango worn like a hat, tilted a little. */
const HAT: Px[] = [
  [8, 4, 9, 1, INK],
  [6, 5, 2, 1, INK],
  [17, 5, 2, 1, INK],
  [5, 6, 1, 2, INK],
  [19, 6, 1, 2, INK],
  [8, 5, 9, 1, MANGO_HI],
  [6, 6, 13, 1, MANGO_HI],
  [6, 7, 13, 2, MANGO],
  [5, 8, 15, 1, INK],
  [9, 6, 1, 1, '#fff'],
  [11, 5, 3, 1, '#fff3bf'],
];

const EYES: Record<Mood, Px[]> = {
  idle: [
    [7, 14, 2, 2, INK],
    [15, 14, 2, 2, INK],
    [7, 14, 1, 1, '#fff'],
    [15, 14, 1, 1, '#fff'],
  ],
  talk: [
    [7, 14, 2, 2, INK],
    [15, 14, 2, 2, INK],
    [7, 14, 1, 1, '#fff'],
    [15, 14, 1, 1, '#fff'],
  ],
  happy: [
    // ^ ^
    [6, 15, 1, 1, INK],
    [7, 14, 1, 1, INK],
    [8, 15, 1, 1, INK],
    [15, 15, 1, 1, INK],
    [16, 14, 1, 1, INK],
    [17, 15, 1, 1, INK],
  ],
  worried: [
    [7, 14, 2, 2, INK],
    [15, 14, 2, 2, INK],
    [6, 12, 2, 1, INK],
    [16, 12, 2, 1, INK],
  ],
  think: [
    [8, 13, 2, 2, INK],
    [16, 13, 2, 2, INK],
  ],
};

const MOUTH: Record<Mood, Px[]> = {
  idle: [
    [10, 17, 1, 1, INK],
    [11, 18, 2, 1, INK],
    [13, 17, 1, 1, INK],
  ],
  talk: [
    [10, 17, 4, 1, INK],
    [10, 18, 4, 1, '#e8590c'],
    [10, 19, 4, 1, INK],
  ],
  happy: [
    [9, 17, 6, 1, INK],
    [10, 18, 4, 1, '#e8590c'],
    [10, 19, 4, 1, INK],
  ],
  worried: [
    [10, 18, 1, 1, INK],
    [11, 17, 2, 1, INK],
    [13, 18, 1, 1, INK],
  ],
  think: [[11, 18, 2, 1, INK]],
};

const EXTRA: Partial<Record<Mood, Px[]>> = {
  worried: [
    [19, 10, 1, 2, '#74c0fc'],
    [18, 12, 3, 1, '#74c0fc'],
  ],
  think: [
    [20, 6, 1, 1, INK],
    [22, 4, 1, 1, INK],
  ],
};

const BODY = body();

export const MascotArt = memo(function MascotArt({ mood, size = 96 }: { mood: Mood; size?: number }) {
  const px = [
    ...BODY,
    ...HAT,
    [5, 16, 2, 1, BLUSH] as Px,
    [17, 16, 2, 1, BLUSH] as Px,
    ...EYES[mood],
    ...MOUTH[mood],
    ...(EXTRA[mood] ?? []),
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true">
      {px.map(([x, y, w, h, c], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={c} />
      ))}
    </svg>
  );
});
