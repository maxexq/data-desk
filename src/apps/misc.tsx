// Small apps: Notepad, Hint, Settings and the attachment viewer.
import { memo, useState } from 'react';
import { APP_NAME } from '../config';
import { progressOf, useGame } from '../state/game';
import { getTicket } from '../tickets';
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

export const Hint = memo(function Hint() {
  const id = useGame((s) => s.active);
  const p = useGame((s) => (s.active ? progressOf(s, s.active) : null));
  const ticket = id ? getTicket(id) : undefined;
  const task = ticket && p ? ticket.tasks[p.task] : undefined;
  return (
    <div className="hint th">
      <div className="hint-body sunken sel">
        {!ticket || !p ? (
          <p className="dim">เปิด ticket ก่อน แล้วคำใบ้ของขั้นที่กำลังทำจะอยู่ที่นี่</p>
        ) : !task ? (
          <p>ticket นี้ปิดแล้ว ไม่มีคำใบ้เหลือ</p>
        ) : p.hintLevel === 0 ? (
          <p className="dim">คำใบ้มี 3 ระดับ จากแนวคิด ไปจนถึงโครงของคำตอบ (แต่ไม่เฉลยทั้งหมด) กด Next hint เมื่อพร้อม การใช้คำใบ้ถูกนับไว้ในสรุปงาน</p>
        ) : (
          task.hints.slice(0, p.hintLevel).map((h, i) => (
            <p key={i}>
              <b className="mono">{i + 1}/3</b> {h}
            </p>
          ))
        )}
      </div>
      <div className="toolbar end">
        <button className="btn raised" disabled={!task || !p || p.hintLevel >= 3} onClick={() => useGame.getState().nextHint()}>
          <Icon name="bulb" /> Next hint
        </button>
      </div>
    </div>
  );
});

export const Settings = memo(function Settings({ onReset }: { onReset: () => void }) {
  const crt = useGame((s) => s.crt);
  const unlockAll = useGame((s) => s.unlockAll);
  const [confirm, setConfirm] = useState(false);
  const g = useGame.getState();
  return (
    <div className="settings th">
      <label className="check">
        <input type="checkbox" checked={crt} onChange={(e) => g.setCrt(e.target.checked)} />
        เส้น scanline แบบจอ CRT
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
