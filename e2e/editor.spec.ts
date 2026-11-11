import { expect, openTicket, test } from './desk';

const content = '.cm-content';

test('uppercases keywords while typing, but leaves table and column names alone', async ({ desk }) => {
  await openTicket(desk, 't01');
  await desk.locator(content).click();
  await desk.keyboard.press('ControlOrMeta+a');
  await desk.keyboard.type('select name, role from suspects where name is not null ', { delay: 5 });
  await desk.keyboard.press('Escape');
  await expect(desk.locator(content)).toHaveText('SELECT name, role FROM suspects WHERE name IS NOT NULL ');
});

test('Ctrl+Enter runs the query', async ({ desk }) => {
  await openTicket(desk, 't01');
  await desk.locator(content).click();
  await desk.keyboard.press('ControlOrMeta+a');
  await desk.keyboard.insertText('SELECT * FROM suspects');
  await desk.keyboard.press('ControlOrMeta+Enter');
  await expect(desk.getByTestId('status')).toContainText('6 rows');
});

test('Format lays the query out one clause per line', async ({ desk }) => {
  await openTicket(desk, 't01');
  await desk.locator(content).click();
  await desk.keyboard.press('ControlOrMeta+a');
  await desk.keyboard.insertText("select s.name,d.time from door_logs d join suspects s on s.badge_id=d.badge_id where d.door='Lobby'");
  await desk.getByTestId('format').click();
  const lines = desk.locator(`${content} .cm-line`);
  await expect(lines.first()).toHaveText('SELECT');
  await expect(lines.filter({ hasText: /^\s*ON s\.badge_id = d\.badge_id$/ })).toHaveCount(1);
});

test('each tab keeps its own query and result', async ({ desk }) => {
  await openTicket(desk, 't01');
  await desk.locator(content).click();
  await desk.keyboard.press('ControlOrMeta+a');
  await desk.keyboard.insertText('SELECT * FROM suspects');
  await desk.getByTestId('run').click();
  await expect(desk.getByTestId('status')).toContainText('6 rows');

  await desk.getByRole('button', { name: 'เพิ่มแท็บใหม่' }).click();
  await expect(desk.locator('.cm-placeholder')).toBeVisible(); // a new tab starts empty
  await expect(desk.getByTestId('status')).toHaveText('Ready');

  await desk.getByRole('tab', { name: 'Query 1' }).click();
  await expect(desk.locator(content)).toHaveText('SELECT * FROM suspects');
  await expect(desk.getByTestId('status')).toContainText('6 rows');
});
