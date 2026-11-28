import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StepSaves, type StepTimers } from '../src/calendars/step-saves';

// FIX-CALENDAR-2570 (second deep review of 2.57, CU2-30): the number steppers of הגדרות › יומנים. Node only: the timers are driven by hand.

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => fs.readFileSync(path.join(here, '..', 'src', f), 'utf8');

function manualTimers() {
  let seq = 0;
  const live = new Map<number, () => void>();
  const timers: StepTimers = {
    set: (fn) => { seq += 1; live.set(seq, fn); return seq; },
    clear: (h) => { live.delete(h as number); },
  };
  const elapse = () => { const fns = [...live.values()]; live.clear(); fns.forEach((f) => f()); };
  return { timers, elapse, pending: () => live.size };
}

test('two steppers changed within the pause both save (one timer per key)', () => {
  const t = manualTimers();
  const s = new StepSaves(500, t.timers);
  const saved: [string, unknown][] = [];
  s.change('att.cancel_notice_delay_s', 7, () => 6, (v) => saved.push(['delay', v]));
  s.change('policy.max_attendees', 51, () => ({ cal: 'a' }), (v) => saved.push(['max', v]));
  t.elapse();
  expect(saved).toEqual([['delay', 7], ['max', 51]]); // 2.56: the second change cancelled the first save
});

test('a burst saves its last value once, with the value shown BEFORE the burst', () => {
  const t = manualTimers();
  const s = new StepSaves(500, t.timers);
  const saved: [unknown, unknown][] = [];
  let shown = 10;
  for (const v of [11, 12, 13]) {
    const was = shown;
    shown = v;
    s.change('cal.reopen_days', v, () => was, (val, first) => saved.push([val, first]));
  }
  expect(t.pending()).toBe(1);
  t.elapse();
  expect(saved).toEqual([[13, 10]]); // a refusal restores 10, never an unsaved 12
  s.change('cal.reopen_days', 14, () => 13, (val, first) => saved.push([val, first]));
  t.elapse();
  expect(saved[1]).toEqual([14, 13]); // a new burst captures afresh
});

test('switching the calendar flushes its pending change to THAT calendar', () => {
  const t = manualTimers();
  const s = new StepSaves(500, t.timers);
  const saved: [unknown, unknown][] = [];
  s.change('policy.max_attendees', 60, () => ({ cal: 'cal-a' }), (v, f) => saved.push([v, f]));
  s.change('att.cancel_notice_delay_s', 9, () => 6, (v, f) => saved.push([v, f]));
  s.flush('policy.');
  expect(saved).toEqual([[60, { cal: 'cal-a' }]]); // sent now, with the calendar it was made on
  expect(s.waiting('att.')).toEqual({ cancel_notice_delay_s: 9 });
  expect(s.waiting('policy.')).toEqual({});
  t.elapse();
  expect(saved).toHaveLength(2); // the other key still saves once, and the flushed one is not sent twice
});

test('drop forgets every pending save', () => {
  const t = manualTimers();
  const s = new StepSaves(500, t.timers);
  const saved: unknown[] = [];
  s.change('cal.reopen_days', 8, () => 7, (v) => saved.push(v));
  s.drop();
  t.elapse();
  expect(saved).toEqual([]);
});

test('the settings screens send changed keys only (merge) and use one debounce per key', () => {
  expect(src('api/calendars.ts')).toContain("put('/calendar/settings?merge=true',");
  expect(src('api/calendar-attendees.ts')).toContain("patchSettings: (p) => put('/calendar/attendee-settings?merge=true', p)");
  const screen = src('screens/system-calendars.ts');
  expect(screen).toContain('this.api.patchSettings(patch, this.rev)');
  expect(screen).toContain('attendeesApi().patchSettings(patch)');
  expect(screen).toContain("this.steps.flush('policy.')");
  expect(screen).not.toMatch(/attTimer|stepTimer/);
  expect(src('screens/system-calendar-sync.ts')).toContain('this.api.patchSettings(');
});

test('SA2-06: both settings screens name the version they loaded and reload on a stale save', () => {
  expect(src('api/calendars.ts')).toContain("put('/calendar/settings?merge=true', base === undefined ? p : { ...p, base_revision: base })");
  for (const f of ['screens/system-calendars.ts', 'screens/system-calendar-sync.ts']) {
    const s = src(f);
    expect(s).toMatch(/patchSettings\([^)]*, this\.rev\)/);
    expect(s).toContain("e.code === 'revision_conflict'");
    expect(s).toContain('const fresh = await this.api.settings();');
    expect(s).toContain('this.saveChain.then(run, run)'); // one save at a time: each names the latest version
  }
});
