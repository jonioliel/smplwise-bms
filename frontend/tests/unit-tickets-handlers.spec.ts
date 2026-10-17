import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HANDLERS_HREF, SETTINGS_HREF, handlersHref, missingItems, outsideBlock, usersBlock, whatsappNote } from '../src/tickets/readiness-model';
import { S4_EN, S4_HE } from '../src/tickets/text-s4';
import { TAB_PERMISSIONS, TICKETS_HANDLERS_HREF, TICKETS_TABS, activeAreaTab, areaOf } from '../src/shell/nav';
import type { Readiness } from '../src/api/tickets-s4';
import { ticketPermLabel } from '../src/tickets/perm-label';
import { tt } from '../src/tickets/text';

// CR-038 owner request 2026-10-14: the "מטפלים וספקים" page and the assign dialog's readiness - the fifth entry of the area's view menu,
// what sending outside still needs (one reason per group, each with the link to its exact setting), and the texts (Hebrew and English
// complete; never the old words). Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-handlers.spec.ts

const READY: Readiness = {
  public_page: true, public_option: true, base_url: true, module_key: true, public_ready: true, public_missing: [], master_switch: true, account_mapped: true,
  email_fallback: true, email_configured: false, contacts_count: { employee: 1, vendor: 1, person: 2 },
};

test('the fifth entry of the area: "מטפלים וספקים", for the directory\'s readers, in the tickets area', () => {
  // TK258 added "חשבון ספקים" after it (the sixth entry); this one stays the fifth of the scope tabs. MGRDASH put the managers'
  // "סקירה" before them all (index 0), so it is at index 5
  expect(TICKETS_TABS[5]?.id).toBe('handlers');
  expect(TICKETS_TABS[5]?.href).toBe(TICKETS_HANDLERS_HREF);
  expect(TICKETS_HANDLERS_HREF).toBe(HANDLERS_HREF);
  expect(TICKETS_TABS[5]?.label).toBe('מטפלים וספקים');
  expect(TAB_PERMISSIONS[TICKETS_HANDLERS_HREF]).toEqual(['tickets.configure', 'tickets.manage']);
  const r = { path: '/tickets/handlers', mode: 'tickets', segments: ['tickets', 'handlers'], params: new URLSearchParams() } as never;
  expect(areaOf(r)).toBe('tickets');
  expect(activeAreaTab(r)).toBe('handlers');
  expect(handlersHref('vendors')).toBe('#/tickets/handlers?seg=vendors');
  expect(handlersHref()).toBe('#/tickets/handlers');
});

test('the page strip: nothing when everything is ready; each missing prerequisite once, with its setting', () => {
  expect(missingItems(READY)).toEqual([]);
  expect(missingItems(null)).toEqual([]);
  const off = missingItems({ ...READY, public_page: false, public_option: false, base_url: false, master_switch: false, account_mapped: false });
  expect(off.map((i) => i.key)).toEqual(['page_off', 'address', 'switch']); // the account is named once the switch is on
  expect(off.find((i) => i.key === 'switch')?.href).toBe(SETTINGS_HREF.channel);
  expect(missingItems({ ...READY, account_mapped: false }).map((i) => [i.key, i.href])).toEqual([['account', SETTINGS_HREF.accounts]]);
  expect(missingItems({ ...READY, module_key: false }).map((i) => i.key)).toEqual(['key']);
});

test('the assign dialog: one reason per outside group, in order - permission, the handler page, the address, nobody yet', () => {
  const o = { external: true, readiness: READY, publicReady: true, count: 1 };
  expect(outsideBlock('employee', o)).toBeNull();
  expect(outsideBlock('person', { ...o, external: false })?.key).toBe('external');
  expect(outsideBlock('person', { ...o, readiness: { ...READY, public_page: false, base_url: false } })?.key).toBe('page_off');
  expect(outsideBlock('person', { ...o, readiness: { ...READY, base_url: false } })).toMatchObject({ key: 'address', href: SETTINGS_HREF.public });
  expect(outsideBlock('employee', { ...o, count: 0 })).toMatchObject({ key: 'no_employees', href: '#/tickets/handlers', link: 'asgManage' });
  expect(outsideBlock('person', { ...o, count: 0 })).toMatchObject({ key: 'no_contacts', href: '#/tickets/handlers?seg=vendors' });
  // an older server without the readiness object: its public_ready flag decides
  expect(outsideBlock('person', { external: true, readiness: null, publicReady: false, count: 2 })?.key).toBe('page_off');
  expect(outsideBlock('person', { external: true, readiness: null, publicReady: true, count: 2 })).toBeNull();
  // WhatsApp never blocks (the link is e-mailed or copied) - a note instead
  expect(outsideBlock('person', { ...o, readiness: { ...READY, master_switch: false } })).toBeNull();
  expect(whatsappNote({ ...READY, master_switch: false })?.key).toBe('switch');
  expect(whatsappNote({ ...READY, account_mapped: false })?.key).toBe('account');
  expect(whatsappNote(READY)).toBeNull();
  expect(usersBlock(0)).toMatchObject({ key: 'no_members', href: '#/tickets/handlers' });
  expect(usersBlock(2)).toBeNull();
});

test('2.5.0 regression (the הרשאות tab loading forever): every ticket permission has words, an unknown key never throws', () => {
  expect(ticketPermLabel('tickets.costs.view')).toBe('צפייה בעלויות');
  expect(ticketPermLabel('tickets.costs')).toBe('אישור עלויות');
  expect(ticketPermLabel('tickets.configure')).toBe('הגדרות');
  expect(ticketPermLabel('tickets.something_new')).toBe('tickets.something_new');
  expect(() => tt('p_costs.view' as never)).not.toThrow();
  expect(tt('p_costs.view' as never)).toBe('p_costs.view');
});

test('the texts: Hebrew and English complete for the new keys, and never the old words', () => {
  const fresh = Object.keys(S4_HE).filter((k) => /^(hd|rdy|ctNew_|ctEmpty_|ctKind_employee|ctDepartmentsOf|setHandlers|asg(Group|Nobody|Manage|Employees|Outside)|dep(Delete|Restore))/.test(k));
  expect(fresh.length).toBeGreaterThan(30);
  for (const k of fresh) expect(S4_EN[k as keyof typeof S4_EN], k).toBeTruthy();
  const he = Object.values(S4_HE).join('\n');
  expect(he).not.toMatch(/קריא(ה|ות|ת)/);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
  for (const f of ['screens/tickets-handlers.ts', 'tickets/handlers-members.ts', 'tickets/readiness-model.ts', 'tickets/contacts-directory.ts', 'tickets/external-assign.ts']) {
    expect(readFileSync(path.join(root, f), 'utf8'), f).not.toMatch(/קריא(ה|ות|ת)/);
  }
});
