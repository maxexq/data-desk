import { expect, openTicket, playTicket, test, ticketOf } from './desk';

for (const id of ['f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f07', 'f08', 'f09']) {
  test(`foundation ${id}: complete every step and show debrief`, async ({ desk }) => {
    const ticket = ticketOf(id);
    await openTicket(desk, id);
    await playTicket(desk, ticket);
    await expect(desk.getByTestId('coworker-reply')).toBeVisible();
    await expect(desk.getByTestId('xp')).toHaveText(`${ticket.xp} XP`);
  });
}
