import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultPolicy, mockDoorAutomations, type DoorAutomationStatus, type DoorBlock, type DoorChoice } from '../src/api/door-automations';
import { DAT_DEV_MARKED, DAT_KEYS, DAT_TABLES, dat, datCode } from '../src/i18n/door-automation';
import { canArm, dayOrder, formProblems, payload, stateChip, stateLine, toggleDay, toggleDoor } from '../src/screens/door-automation-logic';

// CR-AUTODOORS-295: the "open a door" block of the automation editor - strings in four languages, the safe defaults, the state chip, the form
// checks and the mock adapter's life cycle. Pure functions, no browser.

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const ON: DoorAutomationStatus = { visible: true, feature: 'on', available: true, killed: false };
const OFF: DoorAutomationStatus = { visible: true, feature: 'off', available: false, killed: false };

function block(extra: Partial<DoorBlock> = {}): DoorBlock {
  return {
    id: 'da_x', automation_id: '9001', automation_name: null, name: 'שער בוקר', state: 'draft', policy: { ...defaultPolicy(), doors: [{ station_id: 's1', relay: 1 }] },
    policy_revision: 1, doors: [{ station_id: 's1', relay: 1, name: 'כניסה' }], bound_item_revision: null, armed_by: null, armed_by_name: null, armed_at: null,
    armed_until: null, disarm_reason: null, disarmed_at: null, created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z', ...extra,
  };
}

test('every string exists in Hebrew and English; Arabic and Russian are dev-marked and cover the operator words', () => {
  for (const k of DAT_KEYS) {
    expect(DAT_TABLES.he[k], k).toBeTruthy();
    expect(DAT_TABLES.en[k], `en ${k}`).toBeTruthy();
  }
  expect(DAT_DEV_MARKED).toEqual(['ar', 'ru']);
  const operator = ['title', 'sub', 'stateDraft', 'stateArmed', 'stateDisarmed', 'off', 'killed', 'arm', 'disarm', 'simulate', 'armTitle', 'armText', 'save', 'edit', 'cancel', 'remove'] as const;
  for (const lang of ['ar', 'ru'] as const) for (const k of operator) expect(DAT_TABLES[lang][k], `${lang} ${k}`).toBeTruthy();
  // placeholders survive translation
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) expect(dat('armText', { days: 30 }, lang)).toContain('30');
  // no platform naming and no internal codes on the operator words
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const v of Object.values(DAT_TABLES[lang])) expect(v ?? '').not.toMatch(/Home Assistant|\bHA\b|WisKey|access\.doors|automation:/);
  }
  expect(datCode('r', 'no_such_code', 'he')).not.toContain('no_such_code');
  expect(datCode('r', 'cooldown', 'en')).toBe('Opened a moment ago');
});

test('a new block starts safe: no door, a short weekday window, the server defaults', () => {
  const p = defaultPolicy();
  expect(p.doors).toEqual([]);
  expect(p.windows).toEqual([{ days: [6, 0, 1, 2, 3], start: '07:00', end: '09:00' }]);
  expect([p.cooldown_s, p.max_per_hour, p.max_per_day, p.arm_days]).toEqual([60, 4, 20, 30]);
  expect(formProblems('שער', p)).toContain('needDoor');
});

test('the chip says what really happens now: stopped and off-in-this-version win over the stored state', () => {
  expect(stateChip(null, ON, 'he').text).toBe('טיוטה · לא פעיל');
  expect(stateChip(block({ state: 'armed' }), ON, 'he')).toEqual({ tone: 'live', text: 'פעיל' });
  expect(stateChip(block({ state: 'armed' }), OFF, 'he')).toEqual({ tone: 'off', text: 'כבוי בגרסה הזו' });
  expect(stateChip(block({ state: 'armed' }), { ...ON, killed: true }, 'en').tone).toBe('warn');
  expect(stateChip(block({ state: 'disarmed', disarm_reason: 'storm' }), ON, 'en').text).toBe('Off');
  expect(stateLine(block({ state: 'disarmed', disarm_reason: 'storm' }), 'en')).toBe('Off: Stopped after repeated attempts');
  expect(stateLine(block({ state: 'armed', armed_by_name: 'Dana', armed_until: '2026-11-19T10:00:00Z' }), 'en')).toBe('Activated by Dana · until 2026-11-19');
});

test('form checks, day order and edits', () => {
  const p = { ...defaultPolicy(), doors: [{ station_id: 's1', relay: 1 }] };
  expect(formProblems('שער', p)).toEqual([]);
  expect(formProblems(' ', p)).toEqual(['name']);
  expect(formProblems('x', { ...p, windows: [] })).toEqual(['needWindow']);
  expect(formProblems('x', { ...p, windows: [{ days: [0], start: '10:00', end: '09:00' }] })).toEqual(['badWindow']);
  expect(formProblems('x', { ...p, windows: [{ days: [], start: '07:00', end: '09:00' }] })).toEqual(['badWindow']);
  expect(formProblems('x', { ...p, windows: [{ days: [0], start: '00:00', end: '24:00' }] })).toEqual([]);
  expect(dayOrder('he')[0]).toBe(6);
  expect(dayOrder('en')[0]).toBe(0);
  expect(toggleDay({ days: [0, 2], start: '07:00', end: '09:00' }, 1).days).toEqual([0, 1, 2]);
  expect(toggleDay({ days: [0, 2], start: '07:00', end: '09:00' }, 2).days).toEqual([0]);
  const two = toggleDoor(p, { station_id: 's2', relay: 2 });
  expect(two.doors).toHaveLength(2);
  expect(toggleDoor(two, { station_id: 's1', relay: 1 }).doors).toEqual([{ station_id: 's2', relay: 2 }]);
  expect(payload({ ...p, cooldown_s: 1, max_per_hour: 99, max_per_day: Number.NaN, arm_days: 400 })).toMatchObject({ cooldown_s: 10, max_per_hour: 30, max_per_day: 1, arm_days: 90 });
});

test('arming is offered only for a saved, unchanged, not-armed block whose doors the person may open, while nothing is stopped', () => {
  const choices: DoorChoice[] = [{ station_id: 's1', relay: 1, name: 'כניסה', online: true, can_arm: true }];
  expect(canArm(block(), ON, choices, false)).toBe(true);
  expect(canArm(block(), OFF, choices, false)).toBe(true); // arming while off is harmless; firing is refused on the server
  expect(canArm(null, ON, choices, false)).toBe(false);
  expect(canArm(block(), ON, choices, true)).toBe(false);
  expect(canArm(block({ state: 'armed' }), ON, choices, false)).toBe(false);
  expect(canArm(block(), { ...ON, killed: true }, choices, false)).toBe(false);
  expect(canArm(block(), ON, [{ ...choices[0], can_arm: false }], false)).toBe(false);
});

test('the mock: hidden unless asked, and an edit of an active block turns it off', async () => {
  expect(await mockDoorAutomations().status()).toEqual({ visible: false });
  const m = mockDoorAutomations({ visible: true });
  expect((await m.status()).available).toBe(false);
  const b = await m.create('9001', 'שער', { ...defaultPolicy(), doors: [{ station_id: 'demo-entry', relay: 1 }] });
  expect(b.state).toBe('draft');
  const armed = await m.arm(b);
  expect(armed.state).toBe('armed');
  const edited = await m.update(armed, 'שער 2', armed.policy);
  expect([edited.state, edited.disarm_reason, edited.policy_revision]).toEqual(['disarmed', 'edited', 2]);
  const sim = await m.simulate(edited);
  expect(sim.would_send).toBe(false);
  await m.remove(edited);
  expect(await m.forAutomation('9001')).toBeNull();
});

test('the builder mounts the block only for a saved automation, and the confirmation is the only place that sends confirmed', () => {
  const builder = readFileSync(join(SRC, 'screens', 'automation-builder.ts'), 'utf8');
  expect(builder).toContain("this.isNew ? nothing : html`<door-automation-block .automationId=${this.itemId}>");
  const api = readFileSync(join(SRC, 'api', 'door-automations.ts'), 'utf8');
  expect(api.match(/confirmed: true/g)).toHaveLength(1);
  const blockSrc = readFileSync(join(SRC, 'screens', 'door-automation-block.ts'), 'utf8');
  expect(blockSrc).toContain('this.api.arm(this.block!)');
  expect(blockSrc.indexOf('private arm()')).toBeGreaterThan(-1);
  // arm() is reached only from the confirmation's yes-button
  expect(blockSrc.match(/this\.arm\(\)/g)).toHaveLength(1);
  expect(blockSrc).toContain("data-confirm-yes ?disabled=${this.busy} @click=${() => void (arm ? this.arm() : this.remove())}");
});
