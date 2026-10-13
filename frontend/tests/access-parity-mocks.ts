import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { PERMS, WIRE, type AccessMock, type Persona } from './access-control-mocks';

// CR-036 S12: the parity report's mock, layered over tests/access-control-mocks.ts (a route registered later answers first, so the shared mock
// is not edited). The replies are tests/fixtures/access_parity_wire.json - checked against the real endpoint by
// backend/tests/test_access_parity_wire.py. Invented counts and digests only.

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PARITY_WIRE = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'access_parity_wire.json'), 'utf8')) as Record<string, any>;

export interface ParityMock {
  /** The query of every parity request, in order. */
  asked: Record<string, string>[];
  /** ready (default): the admin report, or the operator one for `as_user`; busy: 409; hold: answers when `release()` is called; forbidden:
   * 403 station_scoped (a site manager restricted to some stations). */
  mode: 'ready' | 'busy' | 'hold' | 'forbidden';
  release: () => void;
}

/** The directory users the subject picker lists (identity/users): two invented operators. */
const USERS = [
  { id: 'u-operator-a', name: 'מפעיל שער ראשי', username: 'op-a', is_admin: false, active: true, source: 'vms', sync_status: 'dev', synced_at: null, first_seen_at: null, last_seen_at: null, groups: [], bindings: [], is_self: false },
  { id: 'u-viewer', name: 'צופה', username: 'viewer', is_admin: false, active: true, source: 'vms', sync_status: 'dev', synced_at: null, first_seen_at: null, last_seen_at: null, groups: [], bindings: [], is_self: false },
];

export async function installParityMock(page: Page, access: AccessMock, mode: ParityMock['mode'] = 'ready'): Promise<ParityMock> {
  const st: ParityMock = { asked: [], mode, release: () => undefined };
  const gate = new Promise<void>((resolve) => (st.release = resolve));
  const persona = (): Persona => access.opts.persona ?? 'admin';
  const holds = (perm: string, installation = false) => (installation ? PERMS[persona()].installation : PERMS[persona()].any).includes(perm);
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

  await page.route('**/api/v1/access-control/parity**', async (route) => {
    const q = Object.fromEntries(new URL(route.request().url()).searchParams.entries());
    st.asked.push(q);
    access.calls.push({ method: route.request().method(), path: 'access-control/parity', query: q });
    if (!holds('access.admin.read')) return route.fulfill(json({ ...clone(WIRE.errors.forbidden), details: { permission: 'access.admin.read', target_type: 'installation', target_id: '*', reason: 'no_binding' } }, 403));
    if (st.mode === 'forbidden' || persona() === 'scopedAdmin') return route.fulfill(json({ ...clone(WIRE.errors.forbidden), details: { permission: 'access.admin.read', target_type: 'installation', target_id: '*', reason: 'station_scoped' } }, 403));
    if (q.as_user && !holds('system.configure', true)) return route.fulfill(json({ ...clone(WIRE.errors.forbidden), details: { permission: 'system.configure', target_type: 'installation', target_id: '*', reason: 'no_binding' } }, 403));
    if (st.mode === 'busy') return route.fulfill(json(clone(PARITY_WIRE.busy), 409));
    if (st.mode === 'hold') await gate;
    const body = clone(q.as_user ? PARITY_WIRE.operator : PARITY_WIRE.admin);
    body.parity.window_hours = Number(q.hours ?? 24);
    return route.fulfill(json({ ...body, sync: clone(WIRE.sync) }));
  });
  await page.route('**/api/v1/identity/users', (route) =>
    route.fulfill(json({ users: holds('identity.directory.read', true) || holds('system.configure', true) ? USERS : [], directory: { paired: false, last_directory_at: null, users: 0 }, revision: 1, can_assign: false })),
  );
  return st;
}
