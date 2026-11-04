import type { Page, Route } from '@playwright/test';
import { installAccessMock, NOW, type AccessMock, type MockOptions } from './access-control-mocks';
import { installParityMock } from './access-parity-mocks';

// SETTINGS-INTERCOM-CARDS-2401: the mocked backend of Settings › "מתגי מסכי כניסה" with every card of layout a drawn - the access-control
// mock (an administrator: the switches, the display / announcements, the parity report), plus the incoming-call banner setting and a paired
// pairing status, so the call banner and the pairing card have their real content. Synthetic data only: nothing reaches WisKey, Home
// Assistant or a station.

export const D = 'sw-app system-diagnostics';
export const FOLDS = `${D} sw-fold-cards`;
export const ACCESS = '/system/diagnostics?tab=access-control';

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const W10 = ['media/station_descriptor', 'media/stream_lease', 'media/talk_open', 'media/talk_frame', 'media/talk_floor', 'media/talk_close'];
const line = (key: string, label: string, text: string) => ({ key, label, state: 'ok', reason: `${key}_ok`, text, fix: null, facts: {} });

/** A paired installation (the shape of GET system/wiskey-pairing; synthetic). */
export const PAIRED = {
  generated_at: '2026-09-27T10:29:00+00:00',
  verdict: 'paired',
  paired: true,
  talk_ready: true,
  probe: { at: '2026-09-27T10:00:00+00:00', accepted: true, code: null, outcome: null, service_subject: true, repository: true, discovery_error: null, capabilities: { schema_version: 1, protocol: 'wiskey-direct-ws.v1', commands: ['direct/capabilities', ...W10], families: ['direct', 'media'], talk_audio: true, stations: 4, clock: null, skew_s: 0.1 } },
  owner_steps: [],
  repair: { available: false, reason: null, announce: false, addon_url: 'http://arx-addon.test:8099' },
  lines: [
    line('bridge', 'גשר Arx בתשתית המערכת', 'הגשר מותקן ומצומד; הוא שולח עדכון חתום כל דקה.'),
    line('component', 'רכיב WisKey', 'WisKey 2.0.1 · התקנה ידנית.'),
    line('key', 'מפתח הצימוד', 'יש מפתח צימוד והוא יכול לחתום.'),
    line('acceptance', 'WisKey מקבל את המפתח', 'WisKey קיבל את החתימה של Arx וזיהה אותו כזהות שירות.'),
    line('discovery', 'חוזה הגילוי (פקודות מדיה ודיבור)', '6 מתוך 6 פקודות המדיה והדיבור מפורסמות.'),
    line('provider', 'מקור הווידאו והדיבור', 'Arx בוחר לבד.'),
    line('rotation', 'החלפת מפתח הגשר', 'החלפת מפתח הגשר כבויה.'),
    line('last_error', 'שגיאה אחרונה', 'אין שגיאה.'),
  ],
  features: [
    { row: 1, key: 'direct_api', group: 'חיבור', label: 'החיבור הישיר ל־WisKey', state: 'on', reasons: [], link: null },
    { row: 2, key: 'door_windows', group: 'דלתות', label: 'חלונות דלת', state: 'off', reasons: [{ code: 'windows_off', kind: 'SET', text: 'חלונות הדלת כבויים.', fix: 'חלונות דלת › הגדרות.' }], link: null },
  ],
};

export interface CardsMock {
  access: AccessMock;
  /** PUT bodies of the call-banner setting */
  callSaves: unknown[];
}

/** Installs the mocks; `layout` is the saved `access.settings_layout` (undefined = the server default, cards). */
export async function installCardsMock(page: Page, opts: MockOptions & { layout?: 'cards' | 'tabs' | 'list' } = {}): Promise<CardsMock> {
  const { layout, ...rest } = opts;
  const settings: Record<string, string> = { ...(rest.settings ?? {}) };
  settings['access.settings_layout'] = layout ?? 'cards';
  const access = await installAccessMock(page, { ...rest, settings });
  await installParityMock(page, access, 'ready');
  const m: CardsMock = { access, callSaves: [] };
  let calls = { mode: 'everyone', roles: [] as string[], stations: [] as string[], sound: true };
  await page.route('**/api/v1/intercom/calls/settings', async (route) => {
    if (route.request().method() === 'PUT') {
      calls = route.request().postDataJSON() as typeof calls;
      m.callSaves.push(calls);
    }
    return json(route, {
      settings: calls,
      defaults: { mode: 'off', roles: [], stations: [], sound: true },
      roles: [{ id: 'operator', name: 'מפעיל' }, { id: 'site_admin', name: 'מנהל אתר' }],
      stations: [{ id: 'gate', name: 'שער ראשי' }, { id: 'lobby', name: 'לובי' }],
    });
  });
  await page.route('**/api/v1/system/wiskey-pairing**', (route) => json(route, PAIRED));
  return m;
}

/** Opens Settings › "מתגי מסכי כניסה" (fixed clock) and waits for the tab's first card or list. */
export async function openAccess(page: Page, hash = ACCESS, o: { skin?: string; scheme?: 'light' | 'dark'; clearStorage?: boolean } = {}): Promise<void> {
  await page.clock.setFixedTime(NOW);
  if (o.clearStorage !== false) {
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('sw-cards-spec-cleared')) {
          localStorage.clear();
          sessionStorage.setItem('sw-cards-spec-cleared', '1');
        }
      } catch {
        /* storage unavailable */
      }
    });
  }
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${o.skin ?? 'classic'}&scheme=${o.scheme ?? 'light'}#${hash}`);
  await page.waitForSelector('sw-app');
}

/** The vertical overflow of everything that could scroll the page (the NOSCROLL-295 / 297 probe). */
export const pageOverflow = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    const screen = main ? [...main.querySelectorAll<HTMLElement>(':scope > *, :scope > div > *')].reverse().find((el) => el.tagName.includes('-') && !el.tagName.startsWith('SW-DEMO') && el.tagName !== 'SW-TABS') : null;
    const over = (el: Element | null | undefined) => (el ? el.scrollHeight - el.clientHeight : 0);
    return { doc: over(document.scrollingElement), main: over(main), wrap: screen && screen.parentElement !== main ? over(screen.parentElement) : 0, screen: over(screen), tag: screen?.tagName.toLowerCase() ?? '' };
  });

/** The cards' geometry: the headers drawn, the open card, its body (and whether it scrolls inside), the window. */
export const foldGeometry = (page: Page) =>
  page.evaluate(() => {
    const diag = document.querySelector('sw-app')?.shadowRoot?.querySelector('system-diagnostics');
    const fold = diag?.shadowRoot?.querySelector('sw-fold-cards');
    const list = fold?.shadowRoot?.querySelector('.list') as HTMLElement | null;
    const heads = [...(fold?.shadowRoot?.querySelectorAll<HTMLElement>('.head') ?? [])].filter((h) => !h.hidden);
    const open = heads.find((h) => h.getAttribute('aria-expanded') === 'true')?.dataset.foldToggle ?? '';
    const body = open ? (diag?.shadowRoot?.querySelector<HTMLElement>(`.afold-body[data-access-fold="${open}"]`) ?? null) : null;
    const r = body?.getBoundingClientRect();
    return {
      wide: list?.dataset.foldWide === 'true',
      heads: heads.map((h) => h.dataset.foldToggle ?? ''),
      headH: heads.map((h) => Math.round(h.getBoundingClientRect().height)),
      lastHead: heads.length ? Math.round(heads[heads.length - 1].getBoundingClientRect().bottom) : 0,
      open,
      bodyTop: r ? Math.round(r.top) : 0,
      bodyBottom: r ? Math.round(r.bottom) : 0,
      bodyH: r ? Math.round(r.height) : 0,
      bodyInner: body ? body.scrollHeight - body.clientHeight : 0,
      bodyScroll: !!body?.hasAttribute('data-fold-scroll'),
      win: innerHeight,
      docW: document.scrollingElement ? document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth : 0,
    };
  });
