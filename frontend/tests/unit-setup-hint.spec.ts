import { test, expect } from '@playwright/test';
import { dismissalFor, hintVisible, isOptionalStep, parseDismissal, summarizeSetup, type SetupDismissal } from '../src/shell/setup-hint';
import { demoSetupState, type SetupStep, type StepId, type StepStatus } from '../src/api/setup';

// TKWIZHINT: the shell's "complete the installation" hint counts REQUIRED steps only (floors/plan and a camera on the map are
// optional), disappears once those are done, and its dismissal is the user's own and re-opens for a newly failed required step.

const IDS: StepId[] = ['install', 'nvr', 'ha', 'go2rtc', 'floor', 'camera'];

function steps(status: Partial<Record<StepId, StepStatus>>, withFlag = true): SetupStep[] {
  return IDS.map((id, i) => ({
    id, index: i + 1, title: id, status: status[id] ?? 'done', summary: '', facts: [], evidence: {}, problem: null, warnings: [],
    settings_link: { href: '#', label: '' }, source: 'local', checked_at: '',
    ...(withFlag ? { optional: id === 'floor' || id === 'camera' } : {}),
  }));
}

test.describe('required vs optional counting', () => {
  test('only the required steps are counted: 4 of 4 with floors and camera still todo is ready', () => {
    const s = summarizeSetup({ steps: steps({ floor: 'todo', camera: 'todo' }) });
    expect(s).toEqual({ ready: true, done: 4, total: 4, failed: [], next: null });
  });

  test('an open required step keeps the count honest and names the next one', () => {
    const s = summarizeSetup({ steps: steps({ ha: 'failed', go2rtc: 'todo', floor: 'todo' }) });
    expect(s).toMatchObject({ ready: false, done: 2, total: 4, failed: ['ha'], next: 'ha' });
  });

  test('an optional step is not required even when it is failed or skipped', () => {
    const s = summarizeSetup({ steps: steps({ floor: 'failed', camera: 'skipped' }) });
    expect(s.ready).toBe(true);
    expect(s.failed).toEqual([]);
  });

  test('a step skipped on purpose (NVR-less) is in neither count', () => {
    const s = summarizeSetup({ steps: steps({ nvr: 'not_applicable', camera: 'not_applicable' }) });
    expect(s).toMatchObject({ ready: true, done: 3, total: 3 });
  });

  test('an unsupported installation is never ready, whatever the steps say', () => {
    expect(summarizeSetup({ steps: steps({}), installation: { supported: false } }).ready).toBe(false);
  });

  test('a backend without the optional field falls back to floor + camera', () => {
    const st = steps({ floor: 'todo', camera: 'todo' }, false);
    expect(st.map((x) => isOptionalStep(x))).toEqual([false, false, false, false, true, true]);
    expect(summarizeSetup({ steps: st })).toMatchObject({ ready: true, done: 4, total: 4 });
    expect(isOptionalStep({ id: 'nvr', optional: true })).toBe(true); // the server's flag wins
  });

  test('the demo fixture: the camera step waits, yet the required steps are all done', () => {
    const d = demoSetupState(false);
    expect(d.steps.find((x) => x.id === 'camera')!.status).toBe('todo');
    expect(d.ready).toBe(true);
  });
});

test.describe('hint visibility and dismissal', () => {
  const open = summarizeSetup({ steps: steps({ ha: 'failed', go2rtc: 'todo' }) });

  test('shown while a required step is open, never when ready', () => {
    expect(hintVisible(open, null)).toBe(true);
    expect(hintVisible(summarizeSetup({ steps: steps({ floor: 'todo' }) }), null)).toBe(false);
    expect(hintVisible(null, null)).toBe(false);
  });

  test('dismissed stays dismissed (todo steps, same failures, a fixed failure)', () => {
    const dis = dismissalFor(open);
    expect(dis).toEqual({ dismissed: true, failed: ['ha'] });
    expect(hintVisible(open, dis)).toBe(false);
    expect(hintVisible(summarizeSetup({ steps: steps({ go2rtc: 'todo' }) }), dis)).toBe(false);
  });

  test('a newly failed required step shows the hint again; a failed optional one does not', () => {
    const dis = dismissalFor(open);
    expect(hintVisible(summarizeSetup({ steps: steps({ ha: 'failed', nvr: 'failed' }) }), dis)).toBe(true);
    expect(hintVisible(summarizeSetup({ steps: steps({ ha: 'failed', floor: 'failed' }) }), dis)).toBe(false);
  });

  test('a dismissal made with nothing failing is re-opened by the first failure', () => {
    const dis = dismissalFor(summarizeSetup({ steps: steps({ go2rtc: 'todo' }) }));
    expect(dis.failed).toEqual([]);
    expect(hintVisible(summarizeSetup({ steps: steps({ go2rtc: 'failed' }) }), dis)).toBe(true);
  });

  test('the stored value is parsed defensively', () => {
    expect(parseDismissal(null)).toBeNull();
    expect(parseDismissal('x')).toBeNull();
    expect(parseDismissal({ dismissed: false })).toBeNull();
    expect(parseDismissal({ dismissed: true, failed: ['nvr', 3, 'ha'] })).toEqual({ dismissed: true, failed: ['nvr', 'ha'] } satisfies SetupDismissal);
    expect(parseDismissal({ dismissed: true })).toEqual({ dismissed: true, failed: [] });
  });
});
