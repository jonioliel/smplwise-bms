import { test, expect } from '@playwright/test';
import {
  TAB_PERMISSIONS,
  TICKETS_ACCOUNTS_HREF,
  TICKETS_ALL_HREF,
  TICKETS_BOARD_HREF,
  TICKETS_DEPARTMENT_HREF,
  TICKETS_HANDLERS_HREF,
  TICKETS_MINE_HREF,
  TICKETS_OVERVIEW_HREF,
  TICKETS_RFQS_HREF,
  TICKETS_SECTION_HREFS,
  TICKETS_TABS,
  applyExternalPlacement,
  applyRfqQuestions,
  applyTabsConfig,
  applyTicketsHidden,
  crumbsOf,
  legacyRedirect,
  normalizeTabsConfig,
  normalizeTicketsSectionRow,
  tabAllowed,
  ticketsAllPages,
  ticketsPageOf,
  ticketsPageTabs,
  ticketsSectionOf,
  ticketsSectionRow,
  ticketsSectionRowShown,
  ticketsSectionTarget,
  visibleAreas,
  visibleTabs,
  type Can,
  type TicketsSection,
} from '../src/shell/nav';
import { setTicketNames } from '../src/tickets/naming';

// SERVICEIA1-295 (owner decisions 24.10, docs/changes/SERVICE-IA-PROPOSAL.md): slice 1 of the service-management reorganisation is NAVIGATION
// ONLY - the area's row becomes four sections (בקשות · תחזוקה ובקרה · ספקים וכספים · סקירה ודוחות), each with its pages as a second row.
// These node-only checks pin: the grouping per role, the PARITY of the entry points per role (every page the old one-row navigation offered a
// role is still offered, under its section, with the same href - and nothing more), the redirects of the new section addresses (every old
// address untouched), the single-section setting, the RFQ-questions badge / dot and the migration of a stored `ui.tabs` value.
//   npx playwright test -c playwright.unit.config.ts tests/unit-serviceia1-nav.spec.ts

const ids = (items: { id: string }[]) => items.map((i) => i.id);
const holding = (...perms: string[]): Can => (p) => perms.includes(p);

/** The area's row BEFORE slice 1 (release 2.14.0): the nine tabs, in order, with their hrefs. */
const OLD_TABS: readonly { id: string; href: string }[] = [
  { id: 'overview', href: TICKETS_OVERVIEW_HREF },
  { id: 'mine', href: TICKETS_MINE_HREF },
  { id: 'department', href: TICKETS_DEPARTMENT_HREF },
  { id: 'board', href: TICKETS_BOARD_HREF },
  { id: 'all', href: TICKETS_ALL_HREF },
  { id: 'handlers', href: TICKETS_HANDLERS_HREF },
  { id: 'rfqs', href: TICKETS_RFQS_HREF },
  { id: 'accounts', href: TICKETS_ACCOUNTS_HREF },
  { id: 'external', href: '#/tickets/external' },
];
/** The old TAB_PERMISSIONS rows of those hrefs (copied from 2.14.0 - they must not change). */
const OLD_PERMISSIONS: Record<string, string[]> = {
  [TICKETS_MINE_HREF]: ['tickets.view', 'tickets.create'],
  [TICKETS_DEPARTMENT_HREF]: ['tickets.view'],
  [TICKETS_ALL_HREF]: ['tickets.all_departments'],
  [TICKETS_OVERVIEW_HREF]: ['tickets.manage'],
  [TICKETS_BOARD_HREF]: ['tickets.manage'],
  [TICKETS_HANDLERS_HREF]: ['tickets.configure', 'tickets.manage'],
  [TICKETS_ACCOUNTS_HREF]: ['tickets.costs.view'],
  [TICKETS_RFQS_HREF]: ['tickets.external', 'tickets.costs'],
  '#/tickets/external': ['access.external.grant'],
};
/** What the old row offered a role: the old rule exactly (the permission gate; "גישת חוץ" only while placed under service management). */
function oldOffered(can: Can, placement: 'access' | 'tickets' | 'both'): string[] {
  return OLD_TABS.filter((t) => (t.id !== 'external' || placement !== 'access') && tabAllowed(t.href, can)).map((t) => t.href);
}
/** What the new navigation offers: the pages of every visible section (level 1 → level 2). */
function newOffered(can: Can): string[] {
  return visibleTabs(TICKETS_TABS, true, can).flatMap((s) => ticketsPageTabs(s.id as TicketsSection, true, can)).map((p) => p.href ?? '');
}

/** The personas of the proposal (§3) with their typical holdings. */
const ROLES: Record<string, string[]> = {
  employee: ['tickets.create'],
  handler: ['tickets.view'],
  deptManager: ['tickets.view', 'tickets.create', 'tickets.manage'],
  finance: ['tickets.costs', 'tickets.costs.view'],
  financeViewer: ['tickets.view', 'tickets.costs.view'],
  moduleAdmin: ['tickets.view', 'tickets.create', 'tickets.configure'],
  allDepartments: ['tickets.view', 'tickets.all_departments', 'tickets.manage'],
  externalApprover: ['access.external.grant'],
  systemAdmin: ['tickets.view', 'tickets.create', 'tickets.manage', 'tickets.all_departments', 'tickets.configure', 'tickets.costs', 'tickets.costs.view', 'tickets.external', 'access.external.grant'],
  nobody: [],
};

test.beforeEach(() => applyTicketsHidden({ 'tickets.enabled': 'true' }));
test.afterEach(() => {
  applyTabsConfig({});
  applyTicketsHidden(null);
  applyExternalPlacement({});
  applyRfqQuestions(0);
  setTicketNames(null);
});

test('the structure: four sections, every old page in exactly one section, hrefs and permissions unchanged', () => {
  expect(ids(TICKETS_TABS)).toEqual(['requests', 'maintenance', 'vendors', 'reports']);
  expect(TICKETS_TABS.map((t) => t.label)).toEqual(['בקשות', 'תחזוקה ובקרה', 'ספקים וכספים', 'סקירה ודוחות']);
  expect(TICKETS_TABS.map((t) => t.short)).toEqual(['בקשות', 'תחזוקה', 'ספקים', 'סקירה']);
  const pages = ticketsAllPages();
  expect(pages.map((p) => p.href).sort()).toEqual(OLD_TABS.map((t) => t.href).sort()); // nothing lost, nothing added, no href renamed
  expect(new Set(ids(pages)).size).toBe(pages.length);
  for (const [href, need] of Object.entries(OLD_PERMISSIONS)) expect(TAB_PERMISSIONS[href], href).toEqual(need);
  for (const href of Object.values(TICKETS_SECTION_HREFS)) expect(TAB_PERMISSIONS[href], 'a section has no permission of its own').toBeUndefined();
});

test('grouping per role (proposal §3): the sections and pages each persona is offered', () => {
  const view = (perms: string[]) => visibleTabs(TICKETS_TABS, true, holding(...perms)).map((s) => [s.id, ids(ticketsPageTabs(s.id as TicketsSection, true, holding(...perms)))]);
  expect(view(ROLES.employee)).toEqual([['requests', ['mine']]]);
  expect(view(ROLES.handler)).toEqual([['requests', ['mine', 'department']]]);
  expect(view(ROLES.deptManager)).toEqual([['requests', ['mine', 'department', 'board']], ['vendors', ['handlers']], ['reports', ['overview']]]);
  expect(view(ROLES.finance)).toEqual([['vendors', ['rfqs', 'accounts']]]);
  expect(view(ROLES.moduleAdmin)).toEqual([['requests', ['mine', 'department']], ['vendors', ['handlers']]]);
  expect(view(ROLES.systemAdmin)).toEqual([['requests', ['mine', 'department', 'board', 'all']], ['vendors', ['handlers', 'rfqs', 'accounts']], ['reports', ['overview']]]);
  expect(view(ROLES.externalApprover), '"גישת חוץ" sits under access control by default').toEqual([]);
  applyExternalPlacement({ 'access.external.placement': 'tickets' });
  expect(view(ROLES.externalApprover)).toEqual([['vendors', ['external']]]);
  expect(view(ROLES.systemAdmin).find(([id]) => id === 'vendors')?.[1]).toEqual(['handlers', 'rfqs', 'accounts', 'external']);
  // תחזוקה ובקרה has no page on this build: never offered, to anybody, with or without a backend
  expect(ids(visibleTabs(TICKETS_TABS, true, () => true))).not.toContain('maintenance');
  expect(ids(visibleTabs(TICKETS_TABS, false))).toEqual(['requests', 'vendors', 'reports']);
  // the module switch still closes the whole area
  applyTicketsHidden({ 'tickets.enabled': 'false' });
  expect(visibleTabs(TICKETS_TABS, true, () => true)).toEqual([]);
});

test('PARITY: per role and per placement, the new navigation offers exactly the pages the old row offered (same hrefs), and the area entry is unchanged', () => {
  for (const placement of ['access', 'tickets', 'both'] as const) {
    applyExternalPlacement({ 'access.external.placement': placement });
    for (const [role, perms] of Object.entries(ROLES)) {
      const can = holding(...perms);
      const before = oldOffered(can, placement);
      const after = newOffered(can);
      expect([...after].sort(), `${role} / ${placement}`).toEqual([...before].sort());
      // the area (rail / bottom bar) is offered exactly when it was, and opens where it opened (mine while offered, else the first page)
      const area = visibleAreas(true, can).find((a) => a.id === 'tickets');
      expect(!!area, `${role} / ${placement}: area offered`).toBe(before.length > 0);
      if (area) expect(area.href, `${role} / ${placement}: area entry`).toBe(before.includes(TICKETS_MINE_HREF) ? TICKETS_MINE_HREF : before[0]);
    }
  }
});

test('every section entry opens on its first visible page; the arrays are not mutated', () => {
  const fin = holding(...ROLES.finance);
  expect(visibleTabs(TICKETS_TABS, true, fin).map((s) => [s.id, s.href])).toEqual([['vendors', TICKETS_RFQS_HREF]]);
  const adm = holding(...ROLES.systemAdmin);
  expect(visibleTabs(TICKETS_TABS, true, adm).map((s) => s.href)).toEqual([TICKETS_MINE_HREF, TICKETS_HANDLERS_HREF, TICKETS_OVERVIEW_HREF]);
  expect(TICKETS_TABS.find((t) => t.id === 'vendors')?.href).toBe(TICKETS_HANDLERS_HREF);
});

test('redirects: the four section addresses land on the first page the user may open; every old address stays where it is', () => {
  const route = (path: string) => {
    const [p, q = ''] = path.split('?');
    const segments = p.split('/').filter(Boolean);
    return { path: p, segments, params: new URLSearchParams(q), mode: segments[0] as 'tickets' };
  };
  const access = (perms: string[], ready = true) => ({ api: true, ready, can: holding(...perms) });
  const adm = access(ROLES.systemAdmin);
  expect(legacyRedirect(route('/tickets/requests'), adm)).toBe('/tickets/mine');
  expect(legacyRedirect(route('/tickets/vendors?seg=vendors'), adm), 'the query travels').toBe('/tickets/handlers?seg=vendors');
  expect(legacyRedirect(route('/tickets/reports'), adm)).toBe('/tickets/overview');
  expect(legacyRedirect(route('/tickets/vendors'), access(ROLES.finance))).toBe('/tickets/rfqs');
  // a section the user is not offered (or one without pages on this build) lands on the first section he is offered
  expect(legacyRedirect(route('/tickets/reports'), access(ROLES.handler))).toBe('/tickets/mine');
  expect(legacyRedirect(route('/tickets/maintenance'), adm)).toBe('/tickets/mine');
  expect(legacyRedirect(route('/tickets/maintenance'), access(ROLES.finance))).toBe('/tickets/rfqs');
  // nothing decided while the session loads; the demo (no backend) uses the built-in lists
  expect(legacyRedirect(route('/tickets/vendors'), access(ROLES.finance, false))).toBeNull();
  expect(legacyRedirect(route('/tickets/vendors'))).toBe('/tickets/handlers');
  // every old address (and its deep links) is untouched
  for (const p of ['/tickets', '/tickets/mine', '/tickets/department?status=closed', '/tickets/all', '/tickets/board?pane=handlers', '/tickets/overview?dept=d1', '/tickets/handlers?seg=review', '/tickets/rfqs?rfq=r1&view=compare', '/tickets/accounts', '/tickets/external?grant=g1', '/tickets/0123456789abcdef', '/tickets/mine?new=1']) {
    expect(legacyRedirect(route(p), adm), p).toBeNull();
  }
  expect(ticketsSectionTarget('nonsense', true, holding(...ROLES.finance))).toBe(TICKETS_RFQS_HREF);
  expect(ticketsSectionTarget('vendors', true, holding())).toBe(TICKETS_MINE_HREF); // nothing offered: the list answers for itself
});

test('the active section / page and the breadcrumb of every tickets route', () => {
  const r = (path: string) => {
    const segments = path.split('?')[0].split('/').filter(Boolean);
    return { path, segments, params: new URLSearchParams(), mode: 'tickets' as const };
  };
  const cases: [string, string, string][] = [
    ['/tickets', 'requests', 'mine'], ['/tickets/mine', 'requests', 'mine'], ['/tickets/department', 'requests', 'department'], ['/tickets/all', 'requests', 'all'],
    ['/tickets/board', 'requests', 'board'], ['/tickets/0123456789abcdef', 'requests', ''], ['/tickets/handlers', 'vendors', 'handlers'], ['/tickets/rfqs', 'vendors', 'rfqs'],
    ['/tickets/accounts', 'vendors', 'accounts'], ['/tickets/external', 'vendors', 'external'], ['/tickets/overview', 'reports', 'overview'], ['/tickets/vendors', 'vendors', ''],
  ];
  for (const [p, sec, page] of cases) {
    expect(ticketsSectionOf(r(p)), p).toBe(sec);
    expect(ticketsPageOf(r(p)), p).toBe(page);
  }
  expect(crumbsOf(r('/tickets/accounts'))).toEqual(['ניהול השירות', 'ספקים וכספים', 'חשבון ספקים']);
  expect(crumbsOf(r('/tickets/board'))).toEqual(['ניהול השירות', 'בקשות', 'לוח מנהל']);
  expect(crumbsOf(r('/tickets/0123456789abcdef'))).toEqual(['ניהול השירות', 'בקשות']);
});

test('the single-section setting (owner 24.10, item 11): hidden by default, "always" draws the row for one section; a corrupt value is the default', () => {
  expect(ticketsSectionRow()).toBe('hide_single');
  expect(ticketsSectionRowShown(1)).toBe(false);
  expect(ticketsSectionRowShown(2)).toBe(true);
  expect(ticketsSectionRowShown(0)).toBe(false);
  applyTabsConfig({ 'ui.tickets_section_row': 'always' });
  expect(ticketsSectionRow()).toBe('always');
  expect(ticketsSectionRowShown(1)).toBe(true);
  expect(ticketsSectionRowShown(0), 'nothing to show stays nothing').toBe(false);
  applyTabsConfig({ 'ui.tickets_section_row': 'bogus' });
  expect(ticketsSectionRow()).toBe('hide_single');
  expect(normalizeTicketsSectionRow(undefined)).toBe('hide_single');
  // the employee (one section) gets no section row by default - only the page row when it has two pages or more (the handler)
  const employee = visibleTabs(TICKETS_TABS, true, holding(...ROLES.employee));
  expect(ticketsSectionRowShown(employee.length)).toBe(false);
  expect(ticketsPageTabs('requests', true, holding(...ROLES.handler)).length).toBe(2);
});

test('the RFQ questions: a number on the page entry, a dot on the section (no number), the area count unchanged', () => {
  applyRfqQuestions(4);
  const vendors = visibleTabs(TICKETS_TABS, true, holding(...ROLES.systemAdmin)).find((s) => s.id === 'vendors')!;
  expect(vendors.dot).toBe(true);
  expect(vendors.alert, 'the dropdown chip shows the dot too').toBe(true);
  expect(vendors.badge).toBeUndefined();
  expect(ticketsPageTabs('vendors', true, holding(...ROLES.systemAdmin)).find((p) => p.id === 'rfqs')?.badge).toBe(4);
  expect(visibleTabs(TICKETS_TABS, true, holding(...ROLES.systemAdmin)).find((s) => s.id === 'requests')?.dot).toBeUndefined();
  applyRfqQuestions(0);
  expect(visibleTabs(TICKETS_TABS, true, holding(...ROLES.systemAdmin)).find((s) => s.id === 'vendors')?.dot).toBeUndefined();
});

test('ui.tabs: a value stored before the sections is migrated on read (order, hidden pages, a fully hidden section); a new-shape value is kept', () => {
  expect(normalizeTabsConfig({ tickets: { order: ['board', 'overview'], hidden: ['handlers', 'rfqs', 'accounts'] } })).toEqual({
    tickets: { order: ['requests', 'reports'], hidden: ['vendors'] },
    'tickets.requests': { order: ['board'], hidden: [] },
    'tickets.vendors': { order: [], hidden: ['handlers', 'rfqs', 'accounts'] },
  });
  expect(normalizeTabsConfig({ tickets: { order: ['all', 'mine'], hidden: ['department'], style: 'underline' } })).toEqual({
    tickets: { order: ['requests'], hidden: [], style: 'underline' },
    'tickets.requests': { order: ['all', 'mine'], hidden: ['department'] },
  });
  expect(normalizeTabsConfig({ tickets: { order: [], hidden: ['overview'] } }), 'the only page of a section hidden: the section is hidden').toEqual({ tickets: { order: [], hidden: ['reports'] } });
  const fresh = { tickets: { order: ['vendors', 'requests'], hidden: ['reports'] }, 'tickets.requests': { order: ['board'], hidden: [] } };
  expect(normalizeTabsConfig(fresh)).toEqual(fresh);
  // a row the administrator already configured in the new shape is not overwritten by an old entry
  expect(normalizeTabsConfig({ tickets: { order: ['mine'], hidden: [] }, 'tickets.requests': { order: ['all'], hidden: [] } })['tickets.requests']).toEqual({ order: ['all'], hidden: [] });
  // and it shapes the rows the shell draws: what was hidden stays hidden
  applyTabsConfig({ 'ui.tabs': { tickets: { order: ['board', 'overview'], hidden: ['handlers', 'rfqs', 'accounts'] } } });
  const adm = holding(...ROLES.systemAdmin);
  expect(ids(visibleTabs(TICKETS_TABS, true, adm))).toEqual(['requests', 'reports']);
  expect(visibleTabs(TICKETS_TABS, true, adm)[0].href).toBe(TICKETS_BOARD_HREF);
  expect(visibleAreas(true, adm).find((a) => a.id === 'tickets')?.href, 'the configured order decides where the area opens').toBe(TICKETS_BOARD_HREF);
});

test('D33: a renamed module renames the requests section; the other sections keep their names', () => {
  setTicketNames({ he: { one: 'תקלה', many: 'תקלות', gender: 'f' } });
  expect(TICKETS_TABS.map((t) => t.label)).toEqual(['תקלות', 'תחזוקה ובקרה', 'ספקים וכספים', 'סקירה ודוחות']);
  expect(TICKETS_TABS[0].short).toBe('תקלות');
});
