// Small apps: Notepad, Hint, Settings and the attachment viewer.
import { memo, useState } from 'react';
import { APP_NAME } from '../config';
import { useGame } from '../state/game';
import { useMascot } from '../state/mascot';
import { Icon } from '../ui/icons';
import { CLUE_ART } from './clueArt';

export const Notepad = memo(function Notepad() {
  const notes = useGame((s) => s.notes);
  const last = useGame((s) => s.history[0]);
  const g = useGame.getState();
  return (
    <div className="notepad">
      <div className="toolbar">
        <button className="btn raised" disabled={!last} onClick={() => g.setNotes(`${notes}${notes && !notes.endsWith('\n') ? '\n' : ''}${last}\n`)}>
          <Icon name="terminal" /> วาง query ล่าสุด
        </button>
        <button className="btn raised" disabled={!notes} onClick={() => g.setNotes('')}>
          <Icon name="trash" /> ล้าง
        </button>
      </div>
      <textarea
        className="sunken notes"
        aria-label="Notepad"
        spellCheck={false}
        placeholder={'จดทฤษฎี ตัวเลข หรือ query ที่อยากเก็บไว้…\nโน้ตจะถูกเก็บไว้ในเบราว์เซอร์นี้'}
        value={notes}
        onChange={(e) => g.setNotes(e.target.value)}
      />
      <div className="statusbar">
        <span className="sunken cell mono">{notes.length} chars</span>
        <span className="sunken cell mono">Saved</span>
      </div>
    </div>
  );
});

export const Settings = memo(function Settings({ onReset }: { onReset: () => void }) {
  const crt = useGame((s) => s.crt);
  const unlockAll = useGame((s) => s.unlockAll);
  const chatty = useMascot((s) => s.chatty);
  const [confirm, setConfirm] = useState(false);
  const g = useGame.getState();
  return (
    <div className="settings th">
      <label className="check">
        <input type="checkbox" checked={crt} onChange={(e) => g.setCrt(e.target.checked)} />
        เส้น scanline แบบจอ CRT
      </label>
      <label className="check">
        <input type="checkbox" checked={chatty} onChange={(e) => useMascot.getState().setChatty(e.target.checked)} />
        ให้น้องข้าวเหนียวทักเองเมื่อเห็นว่าติดหรือพลาด (ปิดแล้วจะมาเฉพาะตอนกด Hint)
      </label>
      <label className="check">
        <input type="checkbox" checked={unlockAll} onChange={(e) => g.setUnlockAll(e.target.checked)} />
        ปลดล็อกทุก ticket (ข้ามลำดับได้)
      </label>
      <div className="sunken pad">
        <p>ล้างความคืบหน้าทั้งหมดของ {APP_NAME}: ticket ที่ปิดแล้ว แท็บ ประวัติ และ streak (โน้ตใน Notepad ยังอยู่)</p>
        {confirm ? (
          <div className="toolbar">
            <button className="btn raised primary" onClick={onReset}>
              ยืนยัน ล้างทั้งหมด
            </button>
            <button className="btn raised" onClick={() => setConfirm(false)}>
              ยกเลิก
            </button>
          </div>
        ) : (
          <button className="btn raised" onClick={() => setConfirm(true)}>
            <Icon name="trash" /> เริ่มใหม่ทั้งหมด
          </button>
        )}
      </div>
    </div>
  );
});

export const AttachmentView = memo(function AttachmentView({ id, summary }: { id: string; summary: string }) {
  const Art = CLUE_ART[id];
  return (
    <div className="clueview">
      <div className="art sunken">
        <Art />
      </div>
      <div className="caption th sel">
        <span className="tag mono">สรุป</span> {summary}
      </div>
    </div>
  );
});
