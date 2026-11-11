import { expect, openTicket, playTicket, setEditor, test, ticketOf } from './desk';

test('a closed ticket, XP and file tabs survive a reload', async ({ desk }) => {
  const t = ticketOf('t01');
  await openTicket(desk, t.id);
  await playTicket(desk, t);

  await openTicket(desk, 't05');
  await setEditor(desk, '-- work in progress');

  await desk.reload();
  await expect(desk.getByTestId('run')).toBeEnabled({ timeout: 45_000 });
  await expect(desk.getByTestId('xp')).toHaveText(`${t.xp} XP`);
  await expect(desk.locator('.cm-content')).toHaveText('-- work in progress');

  await desk.locator('.start').click();
  await expect(desk.locator('[data-ticket="t01"]')).toHaveAttribute('data-status', 'closed');
});
