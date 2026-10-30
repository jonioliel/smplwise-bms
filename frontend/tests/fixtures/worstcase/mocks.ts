import type { Page, Route } from '@playwright/test';
import { AREA_PERMS } from '../../bubble-mocks';
import { worstArea, worstTree, type Dataset } from './devices';
import { directory, groups, meName, roles } from './people';

// BREAKUI-297 (P6): one mocked backend that serves a chosen worst-case dataset to the REAL app (Vite dev server, like the bubble specs):
// the building / home screen, the area screen, the floors / areas tree, the side rail's user, the users & permissions screen.
// Everything else answers 404 (the screens show their own error / empty state, which is part of what is measured).
//   await installWorstcase(page, 'worst'); await page.goto('/?design=a&skin=classic&scheme=dark#/devices/building');
// The dataset can also be switched on a running page: `await setWorstcase(page, 'huge')` then reload.

const NOT_FOUND = { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
export const WORST_PERMS = [...AREA_PERMS, 'rbac.read', 'rbac.assign', 'rbac.roles.manage', 'access.admin.read'];

const state = new WeakMap<Page, { ds: Dataset }>();
export const setWorstcase = (page: Page, ds: Dataset) => { const s = state.get(page); if (s) s.ds = ds; };

export async function installWorstcase(page: Page, ds: Dataset, opts: { skin?: string; scheme?: 'light' | 'dark' } = {}): Promise<void> {
  const st = { ds };
  state.set(page, st);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const d = st.ds;
    if (p === 'me') {
      return json(route, {
        user: { id: 'u-0', username: 'wc', display_name: meName(d), source: 'ingress' }, channel: 'local', remote: null, bindings: [],
        permissions_installation: WORST_PERMS, permissions_any: WORST_PERMS, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (p === 'me/prefs') return json(route, req.method() === 'PUT' ? { prefs: req.postDataJSON() ?? {}, stored: [] } : { prefs: {}, stored: [] });
    if (p === 'settings') {
      return json(route, { settings: { 'ui.design': 'a', 'ui.skin': opts.skin ?? 'classic', 'ui.scheme': opts.scheme ?? 'light', 'devices.style': 'smplwise', 'devices.area_design': 'tiles', 'home.info_style': 'cards' }, can_edit: false });
    }
    if (p === 'devices/tree') return json(route, worstTree(d));
    const area = /^devices\/areas\/([^/]+)$/.exec(p);
    if (area) return json(route, worstArea(d));
    if (p === 'identity/users') return json(route, directory(d));
    if (p === 'access/roles') return json(route, roles());
    if (p === 'access/groups') return json(route, groups(d));
    if (p.startsWith('notifications')) return json(route, { unread: d === 'huge' ? 1284 : d === 'one' ? 1 : 0, items: [] });
    return json(route, NOT_FOUND, 404);
  });
}
