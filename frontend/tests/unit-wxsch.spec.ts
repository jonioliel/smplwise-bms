import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AccessStation, StationTechnical } from '../src/api/access-stations';
import { doorsOf, parseDoorKey } from '../src/access-control/schedules-logic';
import { enStationsText, heStationsText } from '../src/i18n/wiskey-stations';
import { NATIVE_WISKEY_TABS } from '../src/shell/nav';
import { stationEventsHref, stationSchedulesHref } from '../src/screens/wiskey-stations-logic';

// WXSCH (owner 2026-10-13): the stations drawer's quiet "לוחות זמנים" link to the native schedules screen (S9), opened on the station's
// first door. Plain node: when the link is offered, where it lands, and the clean-operator-screen rules as a source guard.
//   npx playwright test -c playwright.unit.config.ts tests/unit-wxsch.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(HERE, rel), 'utf8');

const TECH = { loaded: true, model: 'DS-KD8003', firmware: 'V2.2.62' } as unknown as StationTechnical;
const station = (over: Partial<AccessStation> = {}): AccessStation => ({
  id: 'lobby',
  name: 'לובי',
  online: true,
  call_state: 'idle',
  sync_state: 'synced',
  lock_enabled: true,
  locks: [{ physical_index: 2, name: 'מחסום' }, { physical_index: 1, name: 'כניסה' }],
  has_camera: true,
  camera_entity: null,
  last_seen: null,
  zone: null,
  technical: TECH,
  errors: null,
  ...over,
});

test.describe('WXSCH: when the drawer offers the schedules link', () => {
  test('on the station\'s FIRST door (lowest relay), as the screen\'s own address', () => {
    expect(stationSchedulesHref(station(), true, true)).toBe('#/wiskey/schedules?door=lobby%3A1');
    expect(stationSchedulesHref(station({ locks: [{ physical_index: 3, name: null }] }), true, true)).toBe('#/wiskey/schedules?door=lobby%3A3');
  });

  test('the address lands on a door the schedules screen lists: its key parses back to the same station and relay', () => {
    for (const s of [station(), station({ id: 'entry-b' }), station({ id: 'a b/c' }), station({ id: 'x:y' })]) {
      const href = stationSchedulesHref(s, true, true)!;
      const key = decodeURIComponent(href.slice('#/wiskey/schedules?door='.length));
      const door = doorsOf([s])[0];
      expect(key).toBe(door.key);
      expect(parseDoorKey(key)).toEqual({ stationId: s.id, door: 1 });
    }
  });

  test('only while the schedules screen IS the native one (else the address shows the embedded panel, which has no schedules)', () => {
    expect(stationSchedulesHref(station(), false, true)).toBeNull();
  });

  test('only for a holder of the schedules view permission (access.stations.read anywhere)', () => {
    expect(stationSchedulesHref(station(), true, false)).toBeNull();
    // the permission the link follows is the one that opens the schedules tab itself
    expect(NATIVE_WISKEY_TABS['#/wiskey/schedules']).toEqual({ screen: 'schedules', need: ['access.stations.read'] });
    expect(read('../src/screens/wiskey-stations-views.ts')).toMatch(/stationSchedulesHref\(s, WISKEY_UI\.schedules === 'smplwise', canAnywhere\('access\.stations\.read'\)\)/);
  });

  test('only for a station the server sent WITH its technical part and with a relay (the schedules screen lists no other door)', () => {
    expect(stationSchedulesHref(station({ technical: null }), true, true)).toBeNull();
    expect(stationSchedulesHref(station({ lock_enabled: false }), true, true)).toBeNull();
    expect(stationSchedulesHref(station({ locks: [] }), true, true)).toBeNull();
    expect(doorsOf([station({ technical: null })])).toEqual([]);
    expect(stationSchedulesHref(station({ id: '' }), true, true)).toBeNull();
  });

  test('independent of the entry-log link: each follows its own screen and permission', () => {
    expect(stationEventsHref('lobby', true, true)).toBe('#/wiskey/events?station=lobby');
    expect(stationEventsHref('lobby', false, true)).toBeNull();
    expect(stationSchedulesHref(station(), true, true)).not.toBeNull();
    expect(stationSchedulesHref(station(), false, true)).toBeNull();
  });
});

test.describe('WXSCH: a quiet link on a clean operator screen', () => {
  const views = read('../src/screens/wiskey-stations-views.ts');
  const links = /function drawerLinks\(([\s\S]*?)\n}\n/.exec(views);

  test('the link is a quiet action button: no badge, no paragraph, no hint beside it', () => {
    expect(links, 'drawerLinks is in the views').not.toBeNull();
    const body = links![0];
    expect(body).toContain('data-wk-station-schedules=');
    expect(body).toMatch(/<wk-action-button tone="quiet" icon="calendar" href=\$\{schedules\}/);
    expect(body).not.toMatch(/<sw-badge|<p[ >]|class="muted"|class="hint"/);
  });

  test('its only string is "לוחות זמנים" (Hebrew) / "Schedules" (English), from the stations module', () => {
    expect(heStationsText.drawer.schedules).toBe('לוחות זמנים');
    expect(enStationsText.drawer.schedules).toBe('Schedules');
    expect(links![0]).toContain('v.text.drawer.schedules');
  });

  test('nothing is drawn when no link is offered (no empty row)', () => {
    expect(links![0]).toMatch(/if \(!events && !schedules\) return nothing;/);
  });

  test('it sits in the drawer only: the cards, the list rows and the table do not carry it', () => {
    expect(views.match(/data-wk-station-schedules/g)).toHaveLength(1);
  });
});
