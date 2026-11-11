// Inbox (list of work), the open ticket, and the "ticket closed" summary.
import { memo, useMemo } from 'react';
import { isUnlocked, progressOf, totalXp, useGame } from '../state/game';
import { useMascot } from '../state/mascot';
import { useWM } from '../state/wm';
import { TICKETS, getTicket, rankOf } from '../tickets';
import { todayKey } from '../tickets/daily';
import { KIND_LABEL, type Ticket } from '../tickets/types';
import { Icon } from '../ui/icons';
import { openApp } from '../ui/open';
import { SqlCode } from '../ui/SqlCode';

/** Open a ticket and arrange the windows the player needs for it. */
export function startTicket(id: string) {
  void useGame.getState().openTicket(id);
  useWM.getState().close('inbox');
  openApp('console');
  openApp('ticket');
}

const Level = ({ n }: { n: number }) => (
  <span className="level" aria-label={`ระดับ ${n} จาก 9`}>
    {Array.from({ length: 9 }, (_, i) => (
      <i key={i} className={i < n ? 'on' : ''} />
    ))}
  </span>
);

/* ---------------- Inbox ---------------- */
export const Inbox = memo(function Inbox() {
  const progress = useGame((s) => s.progress);
  const unlockAll = useGame((s) => s.unlockAll);
  const active = useGame((s) => s.active);
  const streak = useGame((s) => s.streak);
  const today = todayKey();
  const daily = useMemo(() => getTicket(`daily-${today}`)!, [today]);
  const state = useGame.getState();

  const row = (t: Ticket) => {
    const p = progressOf(state, t.id);
    const locked = t.kind !== 'daily' && !isUnlocked({ ...state, progress, unlockAll }, t.id);
    const status = locked ? 'locked' : p.done ? 'closed' : progress[t.id] ? 'open' : 'new';
    return (
      <button
        key={t.id}
        className={`ticket-row${t.id === active ? ' current' : ''} is-${status}`}
        data-ticket={t.kind === 'daily' ? 'daily' : t.id}
        data-status={status}
        disabled={locked}
        onClick={() => startTicket(t.id)}
        aria-label={`${t.no} ${t.title} สถานะ ${status}`}
      >
        <span className="st">
          <Icon name={locked ? 'lock' : p.done ? 'check' : t.kind === 'daily' ? 'star' : 'ticket'} size={20} />
        </span>
        <span className="no mono">{t.no}</span>
        <span className="tt th">
          <b>{locked ? '— ล็อกอยู่ ปิด ticket ก่อนหน้าก่อน —' : t.title}</b>
          {!locked && <span className="from">{t.from}</span>}
        </span>
        <span className={`kind k-${t.kind} th`}>{KIND_LABEL[t.kind]}</span>
        <Level n={t.level} />
        <span className="state mono">{status === 'open' ? `${p.task}/${t.tasks.length}` : status.toUpperCase()}</span>
      </button>
    );
  };

  return (
    <div className="inbox">
      <div className="inbox-list sunken">
        <div className="group th">งานประจำวัน · streak {streak.last === today || streak.count === 0 ? streak.count : `${streak.count} (ทำวันนี้เพื่อรักษาไว้)`} วัน</div>
        {row(daily)}
        <div className="group th">งานหลัก · ปิดตามลำดับเพื่อปลดล็อกงานถัดไป</div>
        {TICKETS.map(row)}
      </div>
      <div className="statusbar">
        <span className="sunken cell mono">
          {TICKETS.filter((t) => progress[t.id]?.done).length}/{TICKETS.length} closed
        </span>
        <span className="sunken cell mono">{rankOf(totalXp({ ...state, progress }))}</span>
      </div>
    </div>
  );
});

/* ---------------- Ticket ---------------- */
export const TicketView = memo(function TicketView() {
  const id = useGame((s) => s.active);
  const p = useGame((s) => (s.active ? progressOf(s, s.active) : null));
  const report = useGame((s) => s.report);
  const running = useGame((s) => s.running);
  const ready = useGame((s) => s.ready);
  const ticket = id ? getTicket(id) : undefined;
  const g = useGame.getState();

  if (!ticket || !p)
    return (
      <div className="empty th">
        <Icon name="ticket" size={48} />
        <p>ยังไม่ได้เปิดงาน เลือก ticket จาก Inbox เพื่อเริ่ม</p>
        <button className="btn raised" onClick={() => openApp('inbox')}>
          <Icon name="inbox" /> เปิด Inbox
        </button>
      </div>
    );

  const task = ticket.tasks[p.task];
  const needsSubmit = !!task && task.check.kind !== 'result';

  return (
    <div className="ticket">
      <div className="ticket-scroll sunken sel">
        <header className="ticket-head">
          <div className="mono dim">
            {ticket.no} · {KIND_LABEL[ticket.kind]} · from {ticket.from}
          </div>
          <h2 className="th">{ticket.title}</h2>
          <div className="skills">
            <Level n={ticket.level} />
            {ticket.skills.map((s) => (
              <span key={s} className="tag mono">
                {s}
              </span>
            ))}
          </div>
        </header>

        {ticket.body.map((line, i) =>
          /^(SELECT|WITH|EXPLAIN)\b/.test(line) ? (
            <SqlCode key={i} code={line} />
          ) : (
            <p key={i} className="th">
              {line}
            </p>
          ),
        )}

        {ticket.attachments && (
          <div className="attachments">
            <div className="panel-title">ไฟล์แนบ</div>
            <div className="files">
              {ticket.attachments.map((a) => {
                const locked = p.task < (a.fromTask ?? 0);
                return (
                  <button key={a.id} className="file" disabled={locked} aria-label={locked ? 'ไฟล์แนบที่ยังล็อกอยู่' : a.file} onClick={() => openApp(`att-${a.id}`)}>
                    <Icon name={locked ? 'lock' : a.file.endsWith('.txt') ? 'terminal' : 'image'} size={36} />
                    <span>{locked ? '???' : a.file}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="panel-title">สิ่งที่ต้องทำ</div>
        {ticket.tasks.map((t, i) => (
          <div key={i} className={`goal th${i < p.task ? ' done' : i === p.task ? ' now' : ''}`} data-task-state={i < p.task ? 'done' : i === p.task ? 'now' : 'todo'}>
            <span className="tick sunken">{i < p.task && <Icon name="check" size={12} />}</span>
            <span>
              <span className="goal-text">{t.goal}</span> <span className="tag mono">{t.skill}</span>
            </span>
          </div>
        ))}

        {report && (
          <div className={`report ${report.pass ? 'pass' : 'fail'}`} role="status" data-testid="report" data-pass={report.pass}>
            <div className="panel-title">ผลตรวจล่าสุด: {report.pass ? 'ผ่านทั้งหมด' : 'ยังไม่ผ่าน'}</div>
            {report.taskLabel && <p className="th">{report.taskLabel}</p>}
            {report.lines.map((l, i) => (
              <div key={i} className={`line th ${l.ok ? 'ok' : 'no'}`} data-testid="report-line" data-ok={l.ok}>
                <span className="mono">{l.ok ? 'PASS' : 'FAIL'}</span>
                <span>
                  {l.name}
                  {l.detail && (report.expandable ? (
                    <details key={`${id}-${p.task}-${p.queries}`} className="result-detail">
                      <summary>ดูแนวทางแก้ไข</summary>
                      <span className="detail">{l.detail}</span>
                    </details>
                  ) : <span className="detail">{l.detail}</span>)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar">
        <button className="btn raised" data-testid="reset-data" disabled={!ready || running} onClick={() => void g.resetData()}>
          <Icon name="reset" /> Reset data
        </button>
        <button className="btn raised" data-testid="hint" onClick={() => useMascot.getState().showHints()}>
          <Icon name="bulb" /> Hint
        </button>
        <span className="spacer" />
        {p.done ? (
          <button className="btn raised primary" onClick={() => (useGame.setState({ justClosed: ticket.id }), openApp('closed'))}>
            <Icon name="check" /> ดูสรุปงาน
          </button>
        ) : needsSubmit ? (
          <button className="btn raised primary" data-testid="submit" disabled={!ready || running} onClick={() => void g.submit()}>
            <Icon name="send" /> {running ? 'กำลังตรวจ…' : 'ส่งงาน'}
          </button>
        ) : (
          <span className="th dim hintline">ขั้นนี้ตรวจอัตโนมัติเมื่อกด Run</span>
        )}
      </div>
    </div>
  );
});

/* ---------------- Ticket closed ---------------- */
export const Closed = memo(function Closed() {
  const id = useGame((s) => s.justClosed);
  const xp = useGame(totalXp);
  const p = useGame((s) => (s.justClosed ? progressOf(s, s.justClosed) : null));
  const ticket = id ? getTicket(id) : undefined;
  if (!ticket || !p) return <div className="empty th">ยังไม่มีงานที่เพิ่งปิด</div>;

  const next = TICKETS[TICKETS.findIndex((t) => t.id === ticket.id) + 1];
  return (
    <div className="solved sel" data-testid="closed" data-ticket={ticket.id}>
      <div className="stamp-wrap">
        <span className="stamp">CLOSED</span>
      </div>
      <h3 className="th">
        {ticket.no} · {ticket.title}
      </h3>
      {ticket.reply && (
        <section className="coworker-reply sunken th" aria-label="ข้อความตอบกลับ" data-testid="coworker-reply">
          <div className="panel-title">ข้อความตอบกลับ · {ticket.reply.from}</div>
          {ticket.reply.body.map((line, i) => <p key={i}>{line}</p>)}
        </section>
      )}
      {ticket.debrief.map((d, i) => (
        <p key={i} className="th">
          {d}
        </p>
      ))}
      <div className="stats">
        <span className="sunken cell mono">+{ticket.xp} XP</span>
        <span className="sunken cell mono">{p.queries} runs</span>
        <span className="sunken cell mono">{p.hints} hints</span>
        <span className="sunken cell mono">
          {rankOf(xp)} · {xp} XP
        </span>
      </div>
      <div className="panel-title">คำตอบตัวอย่าง</div>
      {ticket.tasks.map((t, i) =>
        typeof t.solution === 'string' ? (
          <div key={i}>
            {ticket.tasks.length > 1 && <div className="th dim sol-label">ขั้นที่ {i + 1}</div>}
            <SqlCode code={t.solution} />
          </div>
        ) : (
          Object.entries(t.solution).map(([file, code]) => (
            <div key={file}>
              <div className="mono dim sol-label">{file}</div>
              <SqlCode code={code} />
            </div>
          ))
        ),
      )}
      <div className="toolbar end">
        <button className="btn raised" onClick={() => openApp('inbox')}>
          <Icon name="inbox" /> กลับไป Inbox
        </button>
        {next && ticket.kind !== 'daily' && (
          <button
            className="btn raised primary"
            onClick={() => {
              useWM.getState().close('closed');
              startTicket(next.id);
            }}
          >
            <Icon name="ticket" /> งานถัดไป: {next.no}
          </button>
        )}
      </div>
    </div>
  );
});
