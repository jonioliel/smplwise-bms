import type { Page, Route } from '@playwright/test';
import { installMulti } from './multi-nvr-mock';

// LISTENER-DEADLINE-2540: the NVR change log's "revert" against a MOCKED backend (tests/multi-nvr-mock.ts: invented recorders; nothing is
// written anywhere). The notify card can write, and its change list holds one applied change, `ch-7`. POST nvr/changes/ch-7/rollback answers
// as the server of CAST-RELAY-HARDEN-2540 does: 409 `changed_since` (the device was edited since) or 409 `already_rolled_back`, unless the
// body is the literal {"force": true}, which reverts (201) - every body the page sent is kept in `bodies` (null = no body).

export const CHANGE_ID = 'ch-7';
const TEXTS = {
  he: { changed: 'ההגדרה במכשיר שונתה מאז השינוי הזה; ההחזרה תדרוס את מה שיש בו עכשיו. אפשר לאשר החזרה בכל זאת.', already: 'השינוי הזה כבר הוחזר.' },
  en: { changed: 'The setting on the device has changed since this change; undoing it would overwrite what it holds now. You can confirm the undo anyway.', already: 'This change has already been undone.' },
};

export interface UndoState {
  mode: 'changed_since' | 'already_rolled_back' | 'ok';
  status: 'applied' | 'rolled_back';
  bodies: (Record<string, unknown> | null)[];
}

export async function installUndo(page: Page, opts: { mode: UndoState['mode']; lang?: 'he' | 'en' }): Promise<UndoState> {
  const lang = opts.lang ?? 'he';
  await installMulti(page);
  const st: UndoState = { mode: opts.mode, status: 'applied', bodies: [] };
  const change = () => ({ id: CHANGE_ID, kind: 'notify', permission: 'nvr.config.events', target: 'Notify ch1', path: '/ISAPI/Event/triggers/VMD-1', status: st.status,
    error: null, rollback_of: null, note: lang === 'en' ? 'Motion notify on' : 'הפעלת התראת תנועה', actor_username: 'joni', created_at: '2026-10-04T08:30:00Z', has_before: true, has_after: true, writes_enabled: true });
  if (lang === 'en') {
    await page.addInitScript(() => { try { localStorage.setItem('sw.ui.lang', 'en'); } catch { /* about:blank has no storage */ } });
    await page.route('**/api/v1/me/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }) }));
  }
  await page.route('**/api/v1/nvr/**', async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'nvr/notify') {
      return json({ channels: [{ camera_id: 'cam-1', channel: 1, name: lang === 'en' ? 'Entrance' : 'כניסה', motion: { supported: true, center: true }, smart: {}, smart_supported: 0, smart_center: 0 }],
        permission: 'nvr.config.events', can_write: true, labels: {}, writes_enabled: true, recorder_id: 'nvr-1' });
    }
    if (p === 'nvr/changes') return json({ changes: [change()] });
    if (p === `nvr/changes/${CHANGE_ID}/rollback` && req.method() === 'POST') {
      const body = req.postData() ? (req.postDataJSON() as Record<string, unknown>) : null;
      st.bodies.push(body);
      const forced = !!body && body.force === true;
      const refuse = (code: string, text: string) => json({ code, user_message: text, retryable: false, correlation_id: 'c-1', details: { change_id: CHANGE_ID, force_allowed: true } }, 409);
      if (!forced && st.status === 'rolled_back') return refuse('already_rolled_back', TEXTS[lang].already);
      if (!forced && st.mode === 'changed_since') return refuse('changed_since', TEXTS[lang].changed);
      if (!forced && st.mode === 'already_rolled_back') {
        st.status = 'rolled_back'; // undone meanwhile in another window: the refresh shows it
        return refuse('already_rolled_back', TEXTS[lang].already);
      }
      st.status = 'rolled_back';
      return json({ ...change(), id: 'ch-8', rollback_of: CHANGE_ID, status: 'applied' }, 201);
    }
    return route.fallback();
  });
  return st;
}

export async function openSetup(page: Page, q = '') {
  await page.goto('about:blank');
  await page.goto(`/?design=a${q}#/system/setup`);
  await page.waitForSelector('sw-app');
}

export const NOTIFY = 'sw-app system-setup [data-nvr-notify]';
