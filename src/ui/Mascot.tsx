import { memo, useEffect, useState } from 'react';
import { progressOf, useGame } from '../state/game';
import { useMascot, type Mood } from '../state/mascot';
import { getTicket } from '../tickets';
import { Icon } from './icons';
import { MascotArt } from './MascotArt';

const NAME = 'น้องข้าวเหนียว';

/** The hint ladder for the current task: concept → approach → skeleton, never the full answer. */
function Hints() {
  const id = useGame((s) => s.active);
  const p = useGame((s) => (s.active ? progressOf(s, s.active) : null));
  const ticket = id ? getTicket(id) : undefined;
  const task = ticket && p ? ticket.tasks[p.task] : undefined;
  if (!ticket || !p) return <p>เปิด ticket จาก Inbox ก่อนนะ แล้วเราจะช่วยใบ้ขั้นที่กำลังทำให้</p>;
  if (!task) return <p>ticket นี้ปิดไปแล้ว ไม่มีอะไรให้ใบ้แล้วล่ะ เก่งมาก!</p>;
  return (
    <>
      {p.hintLevel === 0 ? (
        <p>
          ติดขั้นนี้อยู่เหรอ? คำใบ้มี 3 ระดับ เริ่มจากแนวคิด แล้วค่อยๆ ชัดขึ้นจนเห็นโครงคำตอบ แต่จะไม่เฉลยทั้งหมดนะ ลองทีละอันก่อน
        </p>
      ) : (
        task.hints.slice(0, p.hintLevel).map((h, i) => (
          <p key={i} data-testid="mascot-hint">
            <b className="mono">{i + 1}/3</b> {h}
          </p>
        ))
      )}
      <div className="mascot-actions">
        {p.hintLevel < 3 ? (
          <button className="btn raised primary" data-testid="mascot-next" onClick={() => useGame.getState().nextHint()}>
            <Icon name="bulb" /> {p.hintLevel === 0 ? 'ขอคำใบ้แรก' : 'ขอคำใบ้ต่อ'} ({p.hintLevel + 1}/3)
          </button>
        ) : (
          <span className="dim">หมดคำใบ้แล้ว ที่เหลือลุยเองได้!</span>
        )}
      </div>
    </>
  );
}

export const Mascot = memo(function Mascot() {
  const bubble = useMascot((s) => s.bubble);
  const met = useMascot((s) => s.met);
  const hintLevel = useGame((s) => (s.active ? progressOf(s, s.active).hintLevel : 0));
  const [talking, setTalking] = useState(false);

  // Say hello once, a moment after the desktop appears.
  useEffect(() => {
    if (met) return;
    const t = setTimeout(() => !useMascot.getState().bubble && useMascot.getState().intro(), 1500);
    return () => clearTimeout(t);
  }, [met]);

  // Move the mouth for a moment whenever there is something new to say.
  useEffect(() => {
    if (!bubble) return;
    setTalking(true);
    const t = setTimeout(() => setTalking(false), 1200);
    const hide = bubble.kind === 'say' && bubble.autoHide ? setTimeout(() => useMascot.getState().close(), bubble.autoHide) : null;
    return () => {
      clearTimeout(t);
      if (hide) clearTimeout(hide);
    };
  }, [bubble, hintLevel]);

  if (!bubble) return null;
  const close = () => useMascot.getState().close();
  const mood: Mood = talking ? 'talk' : bubble.kind === 'say' ? bubble.mood : bubble.kind === 'hints' ? 'think' : 'happy';

  return (
    <aside className="mascot" aria-label={NAME} data-testid="mascot">
      <div className="mascot-bubble th" role="status">
        <div className="mascot-head">
          <b>{NAME}</b>
          <button className="ctl raised" aria-label={`ปิด ${NAME}`} onClick={close}>
            <Icon name="x" size={10} />
          </button>
        </div>
        {bubble.kind === 'hints' && <Hints />}
        {bubble.kind === 'intro' && (
          <>
            <p>สวัสดี! เราชื่อ{NAME} ผู้ช่วยประจำ Mango Sticky Data Co. ติดตรงไหนกดปุ่ม Hint ในหน้าต่าง Ticket แล้วเราจะมาใบ้ให้</p>
            <p className="dim">ถ้าเห็นว่าติดนานหรือพลาดแบบที่คนชอบพลาด เราอาจทักเองด้วย ปิดได้ใน Settings</p>
            <div className="mascot-actions">
              <button className="btn raised primary" onClick={close}>
                ยินดีที่ได้รู้จัก
              </button>
            </div>
          </>
        )}
        {bubble.kind === 'say' && (
          <>
            <p data-testid="mascot-say">{bubble.text}</p>
            {bubble.offerHint && (
              <div className="mascot-actions">
                <button className="btn raised primary" onClick={() => useMascot.getState().showHints()}>
                  <Icon name="bulb" /> ขอคำใบ้
                </button>
                <button className="btn raised" onClick={close}>
                  ขอลองเองก่อน
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <button className={`mascot-body${mood === 'happy' ? ' hop' : ''}`} aria-label={`${NAME}: ซ่อน`} title="คลิกเพื่อซ่อน" onClick={close}>
        <MascotArt mood={mood} />
      </button>
    </aside>
  );
});
