import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { path, query } from '../src/api/client';

// CR-API-PATHS-2439 (review 07:F15, 07:F21): the `path` tagged template and `query()` of api/client.ts, and the API modules that
// interpolated raw ids into their paths. Node only.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test.describe('path`...` (api/client.ts)', () => {
  test('a server-issued id is byte-identical: 16 hex, uuid, the usual id characters', () => {
    for (const id of ['0f3a9b1c2d4e5f60', '6f1e2d3c-4b5a-4968-8776-655443322110', 'cam_12.sub-2', 'switch.schedule_lobby', 'ABCxyz019', 42]) {
      expect(path`cases/${id}/items`).toBe(`cases/${id}/items`);
    }
  });

  test('an id that holds a slash, dots or a query cannot leave its segment', () => {
    expect(path`cases/${'../admin'}`).toBe('cases/..%2Fadmin');
    expect(path`cases/${'a/b'}/items`).toBe('cases/a%2Fb/items');
    expect(path`cases/${'x?y=1#z'}`).toBe('cases/x%3Fy%3D1%23z');
    expect(path`cases/${'a b'}`).toBe('cases/a%20b');
    // resolved against the API base, the route stays the route (a raw `${id}` of '../../x' climbed out of it)
    const base = 'https://arx.example/app/api/v1/';
    expect(new URL(path`cases/${'../../x'}/items`, base).pathname).toBe('/app/api/v1/cases/..%2F..%2Fx/items');
    expect(new URL(`cases/${'../../x'}/items`, base).pathname).toBe('/app/api/x/items'); // out of /api/v1/
  });

  test('every value is encoded the encodeURIComponent way; the literal parts are left as written', () => {
    const v = 'ü:*\'()!~';
    expect(path`a/${v}/b.${'json'}`).toBe(`a/${encodeURIComponent(v)}/b.json`);
    expect(path`no-values`).toBe('no-values');
    expect(path`${'x'}`).toBe('x');
    expect(path`floors/${'f1'}/zones/${true}`).toBe('floors/f1/zones/true');
  });
});

test.describe('query() (api/client.ts)', () => {
  test('keys in their order, empty values left out, false and 0 kept', () => {
    expect(query({ a: 1, b: 'x', c: undefined, d: null, e: '', f: false, g: 0 })).toBe('?a=1&b=x&f=false&g=0');
    expect(query({})).toBe('');
    expect(query({ only: undefined })).toBe('');
  });

  test('the same bytes as the hand-written strings it replaced (encodeURIComponent, not URLSearchParams)', () => {
    const at = '2026-11-14T09:00:00.000+02:00';
    expect(query({ at })).toBe(`?at=${encodeURIComponent(at)}`);
    expect(query({ q: 'a b' })).toBe('?q=a%20b'); // URLSearchParams would write a+b
    expect(query({ stations: ['s1', 's2'].join(','), credential: 'pin' })).toBe(`?stations=${encodeURIComponent('s1,s2')}&credential=pin`);
    expect(query({ from_floor_id: 'f/1' })).toBe('?from_floor_id=f%2F1');
  });

  test('the converted optional flags keep their old shape', () => {
    // catalog.deleteFloor: `${force ? '?force=true' : ''}`
    for (const force of [true, false]) expect(query({ force: force || undefined })).toBe(force ? '?force=true' : '');
    // cases.getCase: `${check ? '' : '?check=false'}`
    for (const check of [true, false]) expect(query({ check: check ? undefined : false })).toBe(check ? '' : '?check=false');
    // access.deleteGroup: `${revision ? `?revision=${revision}` : ''}`
    for (const revision of [undefined, 0, 7]) expect(query({ revision: revision || undefined })).toBe(revision ? `?revision=${revision}` : '');
    // media.liveWsUrl: `?profile=${profile}${h265 ? `&h265=${h265}` : ''}${fallback ? `&fallback=${fallback}` : ''}`
    for (const h265 of ['', '0', '1'] as const)
      for (const fallback of ['', 'sub_down'])
        expect(query({ profile: 'sub', h265: h265 || undefined, fallback: fallback || undefined })).toBe(`?profile=sub${h265 ? `&h265=${h265}` : ''}${fallback ? `&fallback=${fallback}` : ''}`);
    // geometry package preview: `?mode=${mode}${acceptForeign ? '&accept_foreign=true' : ''}`
    for (const acceptForeign of [true, false]) expect(query({ mode: 'merge', accept_foreign: acceptForeign || undefined })).toBe(`?mode=merge${acceptForeign ? '&accept_foreign=true' : ''}`);
  });
});

/** The modules this branch converted: no raw interpolation is left in a path segment of an API call. */
const CONVERTED = [
  'access.ts', 'background.ts', 'brand.ts', 'cases.ts', 'catalog.ts', 'floor-images.ts', 'frigate.ts', 'geometry.ts', 'maps.ts', 'media.ts',
  'nvr.ts', 'plans.ts', 'recordings.ts', 'rules.ts', 'setup.ts', 'skins.ts', 'views.ts', 'water-billing.ts', 'zones.ts',
];
/** A template literal whose path part interpolates a value after a slash, without `path` and without an encoder. */
const RAW_SEGMENT = /(?<!path)`[a-z0-9_./-]*\/\$\{(?!enc\(|encodeURIComponent\()/;

test.describe('the API modules (07:F15)', () => {
  for (const f of CONVERTED) {
    test(`api/${f}: every id in a path goes through path\`...\``, () => {
      const lines = src(`api/${f}`).split('\n').filter((l) => RAW_SEGMENT.test(l));
      expect(lines).toEqual([]);
    });
  }

  test('the named query strings: access-grants `credential` and access-profiles go through query()', () => {
    expect(src('api/access-grants.ts')).toContain("get<ApproversReply>('access-grants/approvers' + query({ stations: stations.join(','), credential }))");
    expect(src('api/access-profiles.ts')).toContain('(`${BASE}/versions` + query({ offset, limit }))');
  });
});

test.describe('shared type names (07:F21)', () => {
  test('Severity and Weekday have one definition (api/types.ts); the old modules re-export it', () => {
    const types = src('api/types.ts');
    expect(types).toContain("export type Severity = 'info' | 'alert' | 'critical';");
    expect(types).toContain("export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';");
    for (const f of ['api/notices.ts', 'api/notifications.ts', 'api/tickets.ts']) {
      expect(src(f)).not.toMatch(/export type Severity =/);
      expect(src(f)).toContain("export type { Severity } from './types';");
    }
    for (const f of ['api/automations.ts', 'api/notifications.ts']) {
      expect(src(f)).not.toMatch(/export type Weekday =/);
      expect(src(f)).toContain("export type { Weekday } from './types';");
    }
  });
});
