import { TICKETS } from '../tickets';
import { defs } from '../ui/open';
import type { AppDef } from '../ui/Win';
import { Console } from './Console';
import { Manual } from './Manual';
import { Music } from './Music';
import { AttachmentView, Notepad, Settings } from './misc';
import { ErDiagram } from './shelf/ErDiagram';
import { Sandbox } from './shelf/Sandbox';
import { Shelf } from './shelf/Shelf';
import { Snapshot } from './shelf/Snapshot';
import { Tables } from './Tables';
import { Closed, Inbox, TicketView } from './Tickets';

export function buildApps(onReset: () => void): AppDef[] {
  const attachments = TICKETS.flatMap((t) => t.attachments ?? []);
  const apps: AppDef[] = [
    { id: 'inbox', title: 'Inbox', icon: 'inbox', desktop: 'inbox', x: 210, y: 30, w: 760, h: 580, minW: 520, minH: 300, render: () => <Inbox /> },
    { id: 'ticket', title: 'Ticket', icon: 'ticket', desktop: 'ticket', x: 200, y: 12, w: 440, h: 740, minW: 340, minH: 320, render: () => <TicketView /> },
    { id: 'console', title: 'SQL Console', icon: 'terminal', desktop: 'console', x: 652, y: 12, w: 700, h: 660, minW: 440, minH: 380, render: () => <Console /> },
    { id: 'tables', title: 'Tables', icon: 'table', desktop: 'tables', x: 420, y: 150, w: 760, h: 480, minW: 480, minH: 300, render: () => <Tables /> },
    { id: 'manual', title: 'Instruction Manual', icon: 'book', desktop: 'manual', x: 300, y: 40, w: 760, h: 620, minW: 500, minH: 320, render: () => <Manual /> },
    { id: 'notepad', title: 'Notepad', icon: 'note', desktop: 'notepad', x: 240, y: 260, w: 380, h: 380, render: () => <Notepad /> },
    { id: 'shelf', title: 'Shareware Shelf', icon: 'shelf', desktop: 'shareware', x: 260, y: 40, w: 640, h: 560, minW: 460, minH: 360, render: () => <Shelf /> },
    { id: 'sandbox', title: 'Sandbox', icon: 'sandbox', desktop: 'sandbox', store: true, x: 230, y: 20, w: 760, h: 680, minW: 480, minH: 420, render: () => <Sandbox /> },
    { id: 'snapshot', title: 'Snapshot', icon: 'camera', desktop: 'snapshot', store: true, x: 520, y: 60, w: 640, h: 480, minW: 420, minH: 320, render: () => <Snapshot /> },
    { id: 'erd', title: 'ER Diagram', icon: 'diagram', desktop: 'er diagram', store: true, x: 200, y: 30, w: 900, h: 620, minW: 480, minH: 320, render: () => <ErDiagram /> },
    { id: 'settings', title: 'Settings', icon: 'gear', desktop: 'settings', x: 460, y: 180, w: 400, h: 320, render: () => <Settings onReset={onReset} /> },
    { id: 'music', title: 'Desk Tunes', icon: 'music', desktop: 'music', x: 880, y: 60, w: 440, h: 540, minW: 380, minH: 360, render: () => <Music /> },
    { id: 'closed', title: 'Ticket Closed', icon: 'check', x: 330, y: 20, w: 640, h: 700, minW: 420, minH: 320, render: () => <Closed /> },
    ...attachments.map((a, i): AppDef => ({
      id: `att-${a.id}`,
      title: a.file,
      icon: a.file.endsWith('.txt') ? 'terminal' : 'image',
      x: 320 + i * 34,
      y: 50 + i * 26,
      w: 580,
      h: 480,
      minW: 360,
      minH: 300,
      render: () => <AttachmentView id={a.id} summary={a.summary} />,
    })),
  ];
  defs.clear();
  apps.forEach((a) => defs.set(a.id, a));
  return apps;
}
