import { memo, useEffect, useRef, type KeyboardEvent } from 'react';
import { getAnalyser, usePlayer } from '../music/player';
import type { Track } from '../music/tracks';
import { Icon } from '../ui/icons';

const mmss = (t: number) => (Number.isFinite(t) && t >= 0 ? `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '--:--');

/** Bars that follow the music, drawn on a tiny canvas like an LCD. */
function Spectrum({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const bars = 19;
    const peaks = new Array(bars).fill(0);
    const data = new Uint8Array(32);
    let raf = 0;
    const draw = () => {
      const an = getAnalyser();
      if (an && active) an.getByteFrequencyData(data);
      else data.fill(0);
      g.clearRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < bars; i++) {
        // log spacing: low bins are octaves apart, high bins are crowded together
        const v = data[Math.min(31, Math.round(31 ** (i / (bars - 1))))] / 255;
        const h = Math.round(v * (cv.height - 2));
        peaks[i] = Math.max(h, peaks[i] - 0.6);
        for (let y = 0; y < h; y += 2) {
          const r = y / cv.height;
          g.fillStyle = r > 0.75 ? '#ff6b6b' : r > 0.5 ? '#ffd43b' : '#69f0a0';
          g.fillRect(i * 4, cv.height - 1 - y, 3, 1);
        }
        g.fillStyle = '#c3fae8';
        g.fillRect(i * 4, cv.height - 2 - Math.round(peaks[i]), 3, 1);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return <canvas ref={ref} className="amp-spectrum" width={76} height={24} aria-hidden="true" />;
}

const sourceLabel = (t: Track) => (t.kind === 'station' ? 'GEN' : t.local ? 'LOCAL' : 'FILE');

export const Music = memo(function Music() {
  const p = usePlayer();
  const track = p.tracks[p.index];
  const fileInput = useRef<HTMLInputElement>(null);
  const live = p.duration === Infinity;

  // Shortcuts from the classic desktop players: Z X C V B, and Space.
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
    const k = e.key.toLowerCase();
    const map: Record<string, () => void> = { z: p.prev, x: () => p.play(), c: p.pause, v: p.stop, b: p.next, ' ': p.toggle };
    if (map[k]) {
      e.preventDefault();
      map[k]();
    }
  };

  const title = track ? `${p.index + 1}. ${track.title} — ${track.artist} (${track.genre})` : 'No track';

  return (
    <div className="amp" tabIndex={-1} onKeyDown={onKey}>
      <div className="amp-lcd sunken" data-testid="amp-lcd">
        <div className="amp-left">
          <span className="amp-state" aria-label={p.status}>
            {p.status === 'playing' ? '▶' : p.status === 'paused' ? '❚❚' : '■'}
          </span>
          <span className={`amp-time${p.status === 'paused' ? ' blink' : ''}`} data-testid="amp-time">
            {mmss(p.time)}
          </span>
          <Spectrum active={p.status === 'playing'} />
        </div>
        <div className="amp-right">
          <div className="amp-marquee" title={title}>
            <span data-testid="amp-title">
              {title}
              {'   ***   '}
            </span>
            <span aria-hidden="true">
              {title}
              {'   ***   '}
            </span>
          </div>
          <div className="amp-info">
            <span>{track ? sourceLabel(track) : '---'}</span>
            <span>{live ? 'LIVE' : mmss(p.duration)}</span>
            <span>44 kHz</span>
            <span className={p.status === 'playing' ? 'on' : ''}>stereo</span>
          </div>
        </div>
      </div>

      <input
        className="amp-seek"
        type="range"
        aria-label="Seek"
        min={0}
        max={live || !p.duration ? 1 : p.duration}
        step={0.5}
        value={live || !p.duration ? 0 : p.time}
        disabled={live || !p.duration}
        onChange={(e) => p.seek(Number(e.target.value))}
      />

      <div className="amp-controls">
        <div className="amp-buttons">
          <button className="btn raised" aria-label="Previous (Z)" onClick={p.prev}>
            <Icon name="prev" />
          </button>
          <button className="btn raised" aria-label="Play (X)" data-testid="amp-play" onClick={() => p.play()}>
            <Icon name="play" />
          </button>
          <button className="btn raised" aria-label="Pause (C)" data-testid="amp-pause" onClick={p.pause}>
            <Icon name="pause" />
          </button>
          <button className="btn raised" aria-label="Stop (V)" data-testid="amp-stop" onClick={p.stop}>
            <Icon name="stop" />
          </button>
          <button className="btn raised" aria-label="Next (B)" data-testid="amp-next" onClick={p.next}>
            <Icon name="next" />
          </button>
        </div>
        <div className="amp-toggles mono">
          <button className={`btn raised${p.shuffle ? ' pressed' : ''}`} aria-pressed={p.shuffle} onClick={p.toggleShuffle}>
            SHUF
          </button>
          <button className={`btn raised${p.repeat !== 'off' ? ' pressed' : ''}`} title="Repeat: all / one / off" onClick={p.cycleRepeat}>
            REP {p.repeat.toUpperCase()}
          </button>
        </div>
        <label className="amp-vol mono">
          VOL
          <input type="range" aria-label="Volume" min={0} max={1} step={0.02} value={p.volume} onChange={(e) => p.setVolume(Number(e.target.value))} />
        </label>
      </div>
      {p.error && (
        <p className="th bad amp-error" role="alert">
          {p.error}
        </p>
      )}

      <ol className="amp-list sunken mono" aria-label="Playlist">
        {p.tracks.map((t, i) => (
          <li key={t.id}>
            <button
              className={`amp-item${i === p.index ? ' on' : ''}`}
              data-track={t.id}
              onDoubleClick={() => p.play(i)}
              onKeyDown={(e) => e.key === 'Enter' && p.play(i)}
              title="ดับเบิลคลิกเพื่อเล่น"
            >
              <span className="amp-n">{i + 1}.</span>
              <span className="amp-t">
                {t.title} <span className="dim">— {t.artist}</span>
              </span>
              <span className="amp-g">{t.genre}</span>
              {t.kind === 'file' && t.license && (
                <a className="amp-lic" href={t.source} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  {t.license}
                </a>
              )}
            </button>
          </li>
        ))}
      </ol>

      <div className="amp-foot">
        <button className="btn raised" onClick={() => fileInput.current?.click()}>
          <Icon name="plus" /> เพิ่มเพลงจากเครื่อง
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*"
          multiple
          hidden
          data-testid="amp-files"
          onChange={(e) => {
            if (e.target.files) p.addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <span className="th dim">Data Desk FM แต่งสดในเบราว์เซอร์ทุกครั้งที่เล่น ไม่มีวันจบ</span>
      </div>
    </div>
  );
});
