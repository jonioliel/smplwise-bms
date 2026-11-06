import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// FRIGATE-F2B-2405: a drift guard between the Frigate control routes the server offers and the calls the operator screens make.
// T116 said "there is no operator screen for the F2b calls yet" long after FRGD (CR-029 section 12) had built them; this spec keeps the
// two sides honest from now on. It reads the FastAPI decorators of routers/frigate_f2b.py, routers/frigate_control.py and the clip
// routes of routers/frigate.py, and the calls in src/api/frigate-control.ts (get / put / post / patch / apiUrl over `${base(rid)}`),
// and compares METHOD + path with the parameters blanked. PTZ is the one deliberate gap: the UI offers no PTZ call while the server's
// code flag PTZ_RELEASED is False (owner 2026-10-06: no PTZ now); the day the flag flips, this spec asks for the pad.
// Node only: no server, no browser.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUTERS = path.resolve(HERE, '../../smplwise_vms/backend/smplwise/routers');
const SVC = path.resolve(HERE, '../../smplwise_vms/backend/smplwise/services/frigate_control_svc.py');
const CLIENT = path.resolve(HERE, '../src/api/frigate-control.ts');

type Route = string; // "METHOD frigate/{}/exports/{}/case"

function serverRoutes(file: string, only?: RegExp): Route[] {
  const src = fs.readFileSync(path.join(ROUTERS, file), 'utf8');
  const out: Route[] = [];
  for (const m of src.matchAll(/@router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
    const p = m[2].replace(/^\//, '').replace(/\{[^}]+\}/g, '{}');
    if (!only || only.test(p)) out.push(`${m[1].toUpperCase()} ${p}`);
  }
  return out;
}

function clientRoutes(): Route[] {
  const src = fs.readFileSync(CLIENT, 'utf8');
  const out: Route[] = [];
  for (const m of src.matchAll(/\b(get|put|post|patch|del|apiUrl)\b(?:<[^`]*?>)?\(\s*`(\$\{base\(rid\)\}[^`]*)`/g)) {
    const method = m[1] === 'apiUrl' ? 'GET' : m[1] === 'del' ? 'DELETE' : m[1].toUpperCase();
    const p = m[2]
      .replace('${base(rid)}', 'frigate/{}')
      .replace(/\$\{[^}]*\?[^}]*\}/g, '') // a conditional query part (`${supervised ? '?supervised=true' : ''}`)
      .replace(/\$\{[^}]*\}/g, '{}')
      .split('?')[0];
    out.push(`${method} ${p}`);
  }
  return out;
}

const CLIENT_ROUTES = new Set(clientRoutes());
/** Server routes the screens deliberately do not call, each with its reason (a new entry needs one too). */
const NO_UI_CALLER: Record<Route, string> = {
  // F2 read helper: the profile the stored mapping names for one alarm state. The profiles tab already reads the whole mapping
  // (GET .../profiles -> rules) and the automatic profile (F2b, GET .../profile-auto) shows the live suggestions; kept for API callers.
  'GET frigate/{}/profile-suggestion': 'the mapping is read whole by GET .../profiles; suggestions come from GET .../profile-auto',
};
const ptzReleased = (): boolean => /^PTZ_RELEASED\s*=\s*True\b/m.test(fs.readFileSync(SVC, 'utf8'));

test('the parser sees the client: a known F2b call and a known F2 call are found', () => {
  expect(CLIENT_ROUTES.has('POST frigate/{}/exports/{}/delete')).toBe(true);
  expect(CLIENT_ROUTES.has('GET frigate/{}/control/policy')).toBe(true);
  expect(CLIENT_ROUTES.has('GET frigate/{}/cameras/{}/clip.mp4')).toBe(true);
});

test('every F2b route (automatic profile, exports, cases, manual events, first writes) has a caller in the operator screens', () => {
  const routes = serverRoutes('frigate_f2b.py');
  expect(routes.length, 'the router was read').toBeGreaterThanOrEqual(16);
  expect(routes.filter((r) => !CLIENT_ROUTES.has(r)), 'server routes without a UI caller').toEqual([]);
});

test('the three clip reads (camera window, event, review item) have a caller', () => {
  const routes = serverRoutes('frigate.py', /clip\.mp4$/);
  expect(routes).toHaveLength(3);
  expect(routes.filter((r) => !CLIENT_ROUTES.has(r))).toEqual([]);
});

test('every F2 control route has a caller, except PTZ while the server has not released it', () => {
  const routes = serverRoutes('frigate_control.py');
  const ptz = routes.filter((r) => r.endsWith('/ptz'));
  expect(ptz, 'the PTZ routes exist on the server').toHaveLength(2);
  expect(routes.filter((r) => !r.endsWith('/ptz') && !CLIENT_ROUTES.has(r) && !(r in NO_UI_CALLER)), 'server routes without a UI caller').toEqual([]);
  for (const r of Object.keys(NO_UI_CALLER)) expect(routes, `the excepted route ${r} still exists (drop the exception otherwise)`).toContain(r);
  if (ptzReleased()) {
    // the owner released PTZ: the pad is due (CR-029 section 10, owner answer 2026-10-06 q10 "prepare for later")
    expect(ptz.filter((r) => !CLIENT_ROUTES.has(r)), 'PTZ is released: the operator pad must call these').toEqual([]);
  } else {
    expect(ptz.filter((r) => CLIENT_ROUTES.has(r)), 'PTZ is not released: the UI must not call it').toEqual([]);
  }
});

test('every client call goes to a route the server has (no stale call after a server rename)', () => {
  const server = new Set([...serverRoutes('frigate_f2b.py'), ...serverRoutes('frigate_control.py'), ...serverRoutes('frigate_config.py'), ...serverRoutes('frigate.py')]);
  expect([...CLIENT_ROUTES].filter((r) => !server.has(r)), 'client calls with no server route').toEqual([]);
});
