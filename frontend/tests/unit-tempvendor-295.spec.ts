import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chosenVendors, recipientPicks, vendorChannel, vendorChannelReason, vendorChannelsOffered } from '../src/temperature/model';
import { reportQs, type RecipientsResponse, type ReportRecipient } from '../src/api/temperature';
import { TT_KEYS, TT_TABLES, tt } from '../src/i18n/temperature';

// TEMPVENDOR-295: the temperature report dialog sends to a vendor - the channel is picked per vendor and per report and never switched
// automatically; vendors stay disabled while vendor reports are off; no ticket action and no platform branding in the dialog.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tempvendor-295.spec.ts
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const vendor = (extra: Partial<ReportRecipient> = {}): ReportRecipient => ({
  id: 'v1', name: 'קירור הצפון', company: 'קירור הצפון בע"מ', has_phone: true, selectable: true, reason: null, channel: 'whatsapp',
  channels: { whatsapp: 'ok', email: 'ok' }, ...extra,
});
const rec = (vendors: ReportRecipient[], email = true): RecipientsResponse => ({
  users: [{ id: 'p1', name: 'יוני', reach: 'ok', selectable: true }], vendors, send_hours: { from: '07:00', to: '21:00' }, attachment: 'none', attachment_modes: ['none', 'link'],
  vendor_reports: { enabled: true, email },
});

test.describe('the recipients that are sent', () => {
  test('users go by id, a vendor goes with the channel chosen for THIS report', () => {
    const r = rec([vendor()]);
    expect(recipientPicks(r, ['p1', 'v1'], {})).toEqual([{ kind: 'user', id: 'p1' }, { kind: 'vendor', id: 'v1', channel: 'whatsapp' }]);
    expect(recipientPicks(r, ['v1'], { v1: 'email' })).toEqual([{ kind: 'vendor', id: 'v1', channel: 'email' }]);
    expect(recipientPicks(null, ['p1'], {})).toEqual([{ kind: 'user', id: 'p1' }]);
    expect(recipientPicks(rec([vendor()], false), ['v1'], { v1: 'email' })).toEqual([{ kind: 'vendor', id: 'v1', channel: 'whatsapp' }]);
  });

  test('the first channel the server can carry is the starting channel; no automatic switch when the picked one is not available', () => {
    expect(vendorChannel(vendor({ channel: 'email', channels: { whatsapp: 'no_whatsapp', email: 'ok' } }))).toBe('email');
    expect(vendorChannel(vendor({ channel: undefined }))).toBe('whatsapp');
    expect(vendorChannel(vendor(), 'email')).toBe('email');
    expect(vendorChannel(vendor(), 'email', false)).toBe('whatsapp'); // e-mail is not offered while its switch is off
    const noWa = vendor({ channel: 'email', channels: { whatsapp: 'no_whatsapp', email: 'ok' } });
    expect(vendorChannelReason(noWa, 'whatsapp')).toBe('no_whatsapp');
    expect(vendorChannelReason(noWa, 'email')).toBe('ok');
    expect(vendorChannelReason(vendor({ channels: undefined }), 'email')).toBe('no_contact');
  });

  test('e-mail is offered only while its switch is on', () => {
    expect(vendorChannelsOffered(false)).toEqual(['whatsapp']);
    expect(vendorChannelsOffered(true)).toEqual(['whatsapp', 'email']);
  });

  test('vendors among the chosen are counted (the preview is the vendor text only when nobody else is chosen)', () => {
    const r = rec([vendor(), vendor({ id: 'v2' })]);
    expect(chosenVendors(r, [])).toBe(0);
    expect(chosenVendors(r, ['p1', 'v1'])).toBe(1);
    expect(chosenVendors(r, ['v1', 'v2'])).toBe(2);
    expect(chosenVendors(null, ['v1'])).toBe(0);
  });

  test('the preview asks for the vendor text only when told to', () => {
    const base = { units: ['u1'], range: '24h' as const, lang: 'he' as const };
    expect(reportQs(base)).not.toContain('external');
    expect(reportQs({ ...base, external: true })).toContain('external=1');
  });
});

test.describe('words and rules', () => {
  const NEW = ['waChannelWhatsapp', 'waChannelEmail', 'waReason_no_whatsapp', 'waReason_no_email', 'waReason_reports_email_off', 'waReason_no_contact', 'waStatus_handed'] as const;

  test('he / en / ar / ru all have the new words, and Arabic / Russian differ from the Hebrew fallback', () => {
    for (const k of NEW) {
      for (const lang of ['he', 'en', 'ar', 'ru'] as const) expect([k, lang, (TT_TABLES[lang][k] ?? '').length > 0]).toEqual([k, lang, true]);
    }
    expect(tt('waReason_no_email', undefined, 'ar')).not.toBe(tt('waReason_no_email', undefined, 'he'));
    expect(tt('waReason_no_email', undefined, 'ru')).not.toBe(tt('waReason_no_email', undefined, 'he'));
    expect(TT_KEYS).toContain('waStatus_handed');
  });

  test('the reasons are short words, not paragraphs, and name no platform and no ticket action', () => {
    for (const k of TT_KEYS.filter((x) => x.startsWith('waReason_') || x.startsWith('waChannel') || x === 'waStatus_handed')) {
      for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
        const v = TT_TABLES[lang][k] ?? '';
        expect([k, lang, v.length <= 60]).toEqual([k, lang, true]);
        expect([k, lang, /Home Assistant|\bHA\b|Ingress|ticket|service request|קריאת שירות|פנייה/i.test(v)]).toEqual([k, lang, false]);
      }
    }
  });

  test('the dialog offers no service-request action and no platform name (the tickets-module-off rule has nothing to hide here)', () => {
    const src = readFileSync(path.join(SRC, 'temperature/whatsapp.ts'), 'utf8');
    expect(/open[A-Za-z]*Ticket|ticket-new|service.request|openTicket|createTicket/i.test(src)).toBe(false);
    expect(/Home Assistant|\bIngress\b/.test(src)).toBe(false);
    // vendors stay a disabled "coming later" row until the server says the channels are available
    expect(src).toContain("!!p.channels");
    expect(src).toContain('waComingLater');
    // the chosen channel travels with the pick; nothing in the dialog switches channel by itself
    expect(src).toContain('recipientPicks(this.rec, this.chosen, this.channels)');
    expect(/channel\s*=\s*['"]whatsapp['"]\s*;?\s*\/\/.*fallback|fallback/i.test(src)).toBe(false);
  });
});
