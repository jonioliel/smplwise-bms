import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { CHANNEL_LABEL, announceStatus, channelCell, defaultPolicies, deliveryLine } from '../src/api/notifications';
import { resetNotifyMock } from '../src/api/notifications-mock';
import { failurePanel, policyWithChannel } from '../src/components/notify-logic';
import { NOTIFY_ICONS } from '../src/components/notify-icons';

// RESPONSE-HINTS-2480 (owner N58): the delivery log shows deliveries of the spoken-announcement channel (`announce`, ANN2), but the
// channel lists of the notification settings did not know it. It now has its name in Hebrew and English, a switch per source (the
// policy's `channels.announce`, the same flag the server validates), a card in "ערוצים" and a failures-panel card. The delivery log
// keeps the channel as plain text (no pictogram in the shared table). No browser page.

type Doc = { documentElement: { lang: string } };
const g = globalThis as unknown as { document?: Doc };
function withLang<T>(lang: string, fn: () => T): T {
  const prev = g.document;
  g.document = { documentElement: { lang } };
  try {
    return fn();
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
}

test('the channel has its name (he: הכרזה; en: Announcement, docs/i18n/GLOSSARY_EN.md)', async () => {
  expect(CHANNEL_LABEL.announce).toBe('הכרזה'); // the label table is built in Hebrew when the module loads (the test document has no lang)
  for (const pack of ['api-notify', 'components']) {
    const en = (await import(`../src/i18n/lang/en/i18n/msg/${pack}.ts`)).en as Record<string, string>;
    expect(en['הכרזה'], pack).toBe('Announcement');
  }
});

test('a source switches the channel like the others: an editable cell, the policy flag the server reads', () => {
  const p = defaultPolicies()[0];
  expect(channelCell(p, 'announce')).toEqual({ on: false, editable: true, note: null });
  const on = policyWithChannel(p, 'announce', true);
  expect(on.channels.announce).toBe(true);
  expect(channelCell(on, 'announce').on).toBe(true);
  expect(policyWithChannel(on, 'announce', false).channels.announce).toBe(false);
  expect(on.channels.inbox).toBe(true); // the centre stays on
});

test('the "ערוצים" card: on while a source routes to it, off otherwise', () => {
  withLang('he', () => {
    const ps = defaultPolicies();
    expect(announceStatus(ps)).toEqual({ state: 'off', text: 'כבוי' });
    const two = ps.map((p, i) => (i < 2 ? policyWithChannel(p, 'announce', true) : p));
    expect(announceStatus(two)).toEqual({ state: 'on', text: '2 מקורות מנותבים להכרזה' });
  });
  withLang('en', () => expect(announceStatus([policyWithChannel(defaultPolicies()[0], 'announce', true)]).text).toBe('Sources routed to announcements: 1'));
});

test('the failures panel names the channel; the own-delivery line says "בהכרזה"', async () => {
  const m = resetNotifyMock({ viewer: 'admin' });
  const card = failurePanel(await m.stats()).find((c) => c.channel === 'announce');
  expect(card).toMatchObject({ label: 'הכרזה', sent: 1, failed: 0, tone: 'ok' });
  const log = await m.adminDeliveries({ channel: 'announce' });
  expect(log.map((d) => [d.channel, d.user_display, CHANNEL_LABEL[d.channel]])).toEqual([['announce', '', 'הכרזה']]);
  withLang('he', () => {
    const line = deliveryLine({ my_deliveries: [{ channel: 'announce', status: 'sent', reason: null, at: '2026-11-03T10:00:00Z' }] }, 'Asia/Jerusalem');
    expect(line?.text.startsWith('נשלח בהכרזה')).toBe(true);
  });
});

test('the settings screen: a switch per source and a card in "ערוצים" with the horn pictogram; the log column stays text only', () => {
  const src = readFileSync(new URL('../src/screens/system-notifications.ts', import.meta.url), 'utf8');
  expect(src).toContain("chip('announce', ann, 'horn')");
  expect(src).toContain('data-channel="announce"');
  expect(src).toContain("{ key: 'channel', label: tr('ערוץ'), render: (d) => CHANNEL_LABEL[d.channel] }");
  expect(NOTIFY_ICONS.horn).toMatch(/^<path /);
});
