import type { Page, Route } from '@playwright/test';
import { mockHome, overview } from './home-simple-mocks';

// HONEST-STATES-2540 (deep review SCR-09, SCR-10): the home interface's mock house (tests/home-simple-mocks.ts) with locks and an alarm
// panel the screen cannot read. Invented names, nothing is sent anywhere. The routes below are registered after mockHome's, so they win.
//   'offline'  - the front door's lock is unavailable, the parking gate answers 'unknown', the alarm panel is unavailable
//   'mixed'    - the front door is locked, the parking gate's lock is unavailable, the panel answers 'unknown'
//   'normal'   - the demo house as mockHome serves it (every lock locked, the panel disarmed)

export type HonestCase = 'offline' | 'mixed' | 'normal';

const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type LockRow = { entity_id: string; state: string | null; available: boolean; active: boolean; locked: boolean; unlock_reason?: string; can_unlock?: boolean };

function lockAs(l: LockRow, state: string | null, available: boolean): void {
  l.state = state;
  l.available = available;
  l.active = state === 'locked';
  l.locked = state === 'locked';
}

export function panel(state: string | null, available: boolean) {
  return {
    entity_id: 'alarm_control_panel.house', name: 'אזעקת הבית', platform: null, integration: '', integration_note: '', config_entry_id: null, state, available, fresh: true,
    last_changed: null, changed_by: null, arm_modes: ['arm_home', 'arm_away', 'arm_night'], features_reported: true, code_format: 'number', code_arm_required: false, needs_code_arm: false,
    needs_code_disarm: true, area_name: null, open_sensors: [], bypassed_sensors: [], zones: [], unpaired_controls: [], ready: { ready: true, open: [], faults: [] },
    can: { arm: true, disarm: true, bypass: false, restore: false }, panel_code_set: false, code: { arm: 'none', disarm: 'pin', bypass: 'none' },
  };
}

export async function mockHonestHome(page: Page, c: HonestCase, layout: Record<string, unknown> = {}) {
  const mock = await mockHome(page, { layout });
  if (c === 'normal') return mock;
  const ov = overview('demo');
  for (const r of ov.rooms) {
    for (const l of r.locks as LockRow[]) {
      l.unlock_reason = 'ok';
      l.can_unlock = true;
      if (c === 'offline') {
        if (l.entity_id === 'lock.front') lockAs(l, 'unavailable', false);
        if (l.entity_id === 'lock.gate') lockAs(l, 'unknown', true);
      } else if (l.entity_id === 'lock.gate') lockAs(l, 'unavailable', false);
    }
  }
  await page.route('**/api/v1/home/overview', (r) => json(r, ov));
  const p = c === 'offline' ? panel('unavailable', false) : panel('unknown', true);
  await page.route('**/api/v1/alarm/panels', (r) => json(r, {
    panels: [p], counts: { panels: 1, zones: 0, open: 0, bypassed: 0, faults: 0 }, channel: 'local', remote: { control: true, disarm: true, codeless: false },
    code_mode: 'personal_pin', me: { arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: true }, can_configure: false,
  }));
  await page.route('**/api/v1/alarm/me', (r) => json(r, { arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: true, pin_set_at: null, code_mode: 'personal_pin' }));
  return mock;
}
