import { test, expect } from '@playwright/test';
import { alertActive, recipientChoices, toggled, whatsappLocked } from '../src/elevators/model';
import { ELT_TABLES } from '../src/i18n/elevators';
import type { AlertChannel, AlertSettings } from '../src/api/elevators';

// GENELEV-295: the elevator alert recipients settings (master switch off by default, recipients, channels with WhatsApp behind notify.manage).
const KEYS = ['alertsTitle', 'alertsMaster', 'alertsOff', 'alertsRule', 'recRoles', 'recUsers', 'recGroups', 'noRecipients', 'recipientsCount', 'channels', 'chInbox', 'chPush', 'chApp', 'chWhatsapp', 'chNote', 'alertsReadOnly', 'search'] as const;
const holders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
const cfg = (channels: AlertChannel[]) => ({ channels });
const view = (can_whatsapp?: boolean): Pick<AlertSettings, 'can_whatsapp'> => ({ can_whatsapp });

test.describe('elevator alert recipients settings', () => {
  test('nothing is on by default: master off, no recipients means nobody', () => {
    const off = { enabled: false, recipients: { roles: [], users: [], groups: [] }, channels: [] as AlertChannel[] };
    const s = { enabled: false, states: { fire_service: { ...off }, fault: { ...off }, out_of_service: { ...off } } };
    for (const st of ['fire_service', 'fault', 'out_of_service'] as const) expect(alertActive(s, st)).toBe(false);
    expect(recipientChoices(off.recipients)).toBe(0);
    expect(alertActive({ ...s, states: { ...s.states, fault: { ...off, enabled: true } } }, 'fault')).toBe(false); // a state switch alone does nothing
  });

  test('WhatsApp is locked for a viewer without notify.manage unless it is already on (so it can be removed)', () => {
    expect(whatsappLocked(view(false), cfg([]), 'whatsapp')).toBe(true);
    expect(whatsappLocked(view(false), cfg(['whatsapp']), 'whatsapp')).toBe(false);
    expect(whatsappLocked(view(true), cfg([]), 'whatsapp')).toBe(false);
    expect(whatsappLocked(view(undefined), cfg([]), 'whatsapp')).toBe(false); // an older server: the server decides
    expect(whatsappLocked(view(false), cfg([]), 'push')).toBe(false);
    expect(whatsappLocked(view(false), cfg([]), 'app')).toBe(false);
  });

  test('toggling a channel keeps the others and never duplicates', () => {
    expect(toggled(['push'], 'whatsapp', true)).toEqual(['push', 'whatsapp']);
    expect(toggled(['push', 'whatsapp'], 'whatsapp', true)).toEqual(['push', 'whatsapp']);
    expect(toggled(['push', 'whatsapp'], 'whatsapp', false)).toEqual(['push']);
  });

  test('every language carries the settings words with the same placeholders, and the note says e-mail is unavailable', () => {
    for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
      for (const k of KEYS) {
        const v = ELT_TABLES[lang][k];
        expect(v, `${lang}.${k}`).toBeTruthy();
        expect(holders(v!), `${lang}.${k}`).toEqual(holders(ELT_TABLES.he[k]!));
        expect(v, `${lang}.${k}`).not.toMatch(/Home Assistant|Ingress/i);
      }
    }
    expect(ELT_TABLES.en.chNote).toMatch(/E-mail is not available/);
    expect(ELT_TABLES.en.chNote).toMatch(/off by default/);
  });
});
