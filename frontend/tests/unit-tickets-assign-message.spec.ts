import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignPlan, handlerMessageApplies, messageTarget, outgoingMessage, HANDLER_MESSAGE_MAX } from '../src/tickets/assign-message-model';
import { TICKET_TEXT_EN_KEYS, TICKET_TEXT_KEYS, tt } from '../src/tickets/text';

// TKASSIGNDLG (owner decision 16.10, option C): the assign dialog has an internal note (never shown to the handler) and a separate,
// optional handler message that is sent WITH the assignment; no checkbox decides visibility.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-assign-message.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

test('the handler message is offered to outside contacts and staff contacts only', () => {
  expect(handlerMessageApplies({ outside: true, pickedStaff: false })).toBe(true);
  expect(handlerMessageApplies({ outside: false, pickedStaff: true })).toBe(true);
  expect(handlerMessageApplies({ outside: false, pickedStaff: false })).toBe(false);
});

test('the label says vendor for a vendor and handler for everyone else', () => {
  expect(messageTarget({ outside: true, vendor: true })).toBe('vendor');
  expect(messageTarget({ outside: true, vendor: false })).toBe('handler');
  expect(messageTarget({ outside: false, vendor: true })).toBe('handler');
});

test('the internal note is never external and the message is empty by default', () => {
  expect(assignPlan({ internalNote: '', handlerMessage: '', applies: true })).toEqual({ note: null, note_external: false, message: null });
  expect(assignPlan({ internalNote: '  קוד שער 1234  ', handlerMessage: '   ', applies: true })).toEqual({ note: 'קוד שער 1234', note_external: false, message: null });
  const p = assignPlan({ internalNote: 'פנימי', handlerMessage: ' שלום, נא להגיע בבוקר ', applies: true });
  expect(p).toEqual({ note: 'פנימי', note_external: false, message: 'שלום, נא להגיע בבוקר' });
});

test('a message typed for a handler that cannot receive one is dropped; a long one is cut to the route limit', () => {
  expect(assignPlan({ internalNote: 'x', handlerMessage: 'hello', applies: false }).message).toBeNull();
  expect(outgoingMessage('a'.repeat(HANDLER_MESSAGE_MAX + 50), true)).toHaveLength(HANDLER_MESSAGE_MAX);
});

test('the catalogue: the visibility checkbox is gone, the new keys exist in Hebrew and English, the dialog says the text is sent', () => {
  expect(TICKET_TEXT_KEYS).not.toContain('noteExternal');
  expect(TICKET_TEXT_EN_KEYS).not.toContain('noteExternal');
  for (const k of ['asgInternalHint', 'asgMsgVendor', 'asgMsgHandler', 'asgMsgHint', 'asgMsgPreview', 'asgMsgFailed'] as const) {
    expect(TICKET_TEXT_KEYS).toContain(k);
    expect(TICKET_TEXT_EN_KEYS).toContain(k);
    expect(tt(k).length).toBeGreaterThan(5);
  }
  expect(tt('asgInternalHint')).toContain('לא תוצג למטפל');
  expect(tt('asgMsgHint')).toContain('יישלח');
});

test('the dialog source has no visibility checkbox any more and sends the message after the assignment', () => {
  const src = readFileSync(path.join(SRC, 'tickets/ticket-detail.ts'), 'utf8');
  expect(src).not.toContain("tt('noteExternal')");
  expect(src).not.toContain('dlgFlag');
  expect(src.indexOf('this.ext.submit(')).toBeLessThan(src.indexOf('sendHandlerMessage(t.id'));
  expect(src).toContain('notify: false');
});
