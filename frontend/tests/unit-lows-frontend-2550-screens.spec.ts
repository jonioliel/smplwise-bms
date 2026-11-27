import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { pickedShown } from '../src/screens/schedules-logic';
import { EVENTS_LIMIT, eventsRange } from '../src/screens/investigate-events-logic';
import { keepNewerRows } from '../src/tickets/table-model';
import { rollbackMove } from '../src/calendars/grid-logic';
import { bulkItemFailed, bulkResultOf } from '../src/screens/map-room-bulk';

// LOWS-FRONTEND-2550: the low findings of the 2.52 deep review on the operator screens - the floor map (SCR-52), water and temperature
// deletes (SCR-53), the schedules list (SCR-54), the event centre (SCR-55), tickets and calendars (SCR-56), the home in English (SCR-57).
// Node only, no page:
//   npx playwright test -c playwright.unit.config.ts tests/unit-lows-frontend-2550-screens.spec.ts
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test.describe('SCR-52 the map room card "all off"', () => {
  test('one batch at a time: a second tap while the first batch is sending starts nothing', () => {
    const s = src('screens/explore-floor-map.ts');
    const run = s.slice(s.indexOf('private async runBulk('), s.indexOf('private renderRoomConfirm()'));
    expect(run).toMatch(/if \(this\.bulkRunning\) return;\s*\n\s*this\.bulkRunning = true;/);
    expect(run).toMatch(/finally \{\s*\n\s*this\.bulkRunning = false;/);
  });
});

test.describe('SCR-52 the room card says how many devices "all off" left on (owner answer Q1 a)', () => {
  test('refused or failed devices are counted; an unknown or pending answer is not claimed as "not turned off"', () => {
    expect(bulkItemFailed('אין חיבור לשרת.', null)).toBe(true);
    expect(bulkItemFailed('', 'failed')).toBe(true);
    expect(bulkItemFailed('', 'denied')).toBe(true);
    expect(bulkItemFailed('', 'confirmed')).toBe(false);
    expect(bulkItemFailed('', 'unknown')).toBe(false);
    expect(bulkItemFailed('', 'pending')).toBe(false);
    expect(bulkResultOf(2, 5)).toEqual({ failed: 2, total: 5 });
    expect(bulkResultOf(0, 5)).toBeNull();
    expect(bulkResultOf(0, 0)).toBeNull();
  });

  test('the map counts each device of the batch and hands the result to its own room card, which shows the line', () => {
    const map = src('screens/explore-floor-map.ts');
    const run = map.slice(map.indexOf('private async runBulk('), map.indexOf('private renderRoomConfirm()'));
    expect(run).toContain('if (!(await this.send(it.entityId, it.spec, true))) failed += 1;');
    expect(run).toContain('if (this.selectedZoneId === zone) this.bulkResult = bulkResultOf(failed, sent);');
    expect(map).toContain('private async send(entityId: string, spec: HaActionSpec, confirmed: boolean): Promise<boolean>');
    expect(map).toContain('.bulkResult=${this.bulkResult}');
    expect(map).toContain("if (changed.has('selectedZoneId') && this.bulkResult) this.bulkResult = null;");
    const card = src('components/sw-room-card.ts');
    expect(card).toContain("data-room-bulk-result>${tr('{failed} מתוך {total} לא כובו'");
    expect(card).toMatch(/\.empty\.bulk-left \{\s*color: var\(--sw-warning-text\);/);
    expect(src('i18n/lang/en/i18n/msg/components.ts')).toContain("'{failed} מתוך {total} לא כובו': '{failed} of {total} were not turned off',");
  });
});

test.describe('SCR-53 deletes behind a confirmation', () => {
  test('a water price version asks first, naming its date', () => {
    const s = src('screens/water/page-settings.ts');
    const del = s.slice(s.indexOf('private async deleteVersion('), s.indexOf('private sharedLink()'));
    expect(del).toMatch(/await confirmDialog\(\{ body: wt\('delVersionConfirm', \{ date: fmtDate\(v\.effective_from\) \}\), danger: true/);
    expect(del.indexOf('confirmDialog')).toBeLessThan(del.indexOf('waterBilling.deleteVersion'));
    expect(src('i18n/lang/en/water/i18n.ts')).toContain("delVersionConfirm: 'Delete the price version from {date}?',");
  });

  test('a scheduled temperature report asks first and a refused delete says so', () => {
    const s = src('temperature/whatsapp.ts');
    const del = s.slice(s.indexOf('private async removeSchedule('), s.indexOf('private async saveSchedule()'));
    expect(del).toMatch(/await confirmDialog\(\{ body: tt\('waDeleteConfirm', \{ when \}\), danger: true/);
    expect(del).toMatch(/catch \(e\) \{\s*\n\s*this\.err = describeError\(e\);/);
    expect(s).not.toMatch(/@click=\$\{async \(\) => \{ await deleteSchedule\(s\.id\)/);
    expect(src('i18n/lang/en/i18n/temperature.ts')).toContain("waDeleteConfirm: 'Delete the scheduled report ({when})?',");
  });
});

test.describe('SCR-54 the schedules bulk bar', () => {
  test('bulk enable / disable acts only on the selected schedules the filter shows', () => {
    const shown = [{ id: 'a' }, { id: 'c' }];
    expect(pickedShown(shown, new Set(['a', 'b', 'c']))).toEqual([{ id: 'a' }, { id: 'c' }]); // 'b' is hidden by the filter
    expect(pickedShown(shown, new Set(['b']))).toEqual([]);
    const s = src('screens/devices-schedules.ts');
    const bulk = s.slice(s.indexOf('private async bulk('), s.indexOf('private async bulk(') + 400);
    expect(bulk).toMatch(/const picked = this\.pickedNow\(\);/);
    expect(s).not.toMatch(/const picked = \(this\.items \?\? \[\]\)\.filter\(\(s\) => this\.selected\.has\(s\.id\)\);/);
    expect(s).toMatch(/const n = this\.selected\.size \? this\.pickedNow\(\)\.length : 0;/);
  });
});

test.describe('SCR-55 the event centre', () => {
  test('a multi-day range uses the installation zone\'s day edges (not UTC)', () => {
    // 7 days ending 26.11.2026 in Israel (+02:00 in winter): from 20.11 00:00 local = 19.11 22:00 UTC, to 26.11 23:59:59.999 local
    expect(eventsRange('2026-11-26', 7, 'Asia/Jerusalem')).toEqual({ from: '2026-11-19T22:00:00.000Z', to: '2026-11-26T21:59:59.999Z' });
    // summer time (+03:00)
    expect(eventsRange('2026-07-15', 30, 'Asia/Jerusalem')).toEqual({ from: '2026-06-15T21:00:00.000Z', to: '2026-07-15T20:59:59.999Z' });
    // across the autumn change (25.10.2026: +03:00 -> +02:00): each edge in its own offset
    expect(eventsRange('2026-10-27', 7, 'Asia/Jerusalem')).toEqual({ from: '2026-10-20T21:00:00.000Z', to: '2026-10-27T21:59:59.999Z' });
    expect(eventsRange('2026-11-26', 7, 'UTC')).toEqual({ from: '2026-11-20T00:00:00.000Z', to: '2026-11-26T23:59:59.999Z' });
    const s = src('screens/investigate-events.ts');
    expect(s).not.toMatch(/T23:59:59\.999Z`\)/);
    expect(s).toMatch(/return eventsRange\(this\.date \|\| dateInZone\(new Date\(\), this\.tz\), this\.rangeDays, this\.tz\);/);
  });

  test('a list that reached the row limit says so (and that "mark all handled" covers only what is shown)', () => {
    expect(EVENTS_LIMIT).toBe(500);
    const s = src('screens/investigate-events.ts');
    expect(s).toMatch(/limit: EVENTS_LIMIT,/);
    expect(s).toMatch(/this\.mode !== 'windows' && this\.events\.length >= EVENTS_LIMIT\s*\n\s*\? html`<div class="banner" data-events-capped>/);
    expect(src('i18n/lang/en/i18n/msg/investigate.ts')).toContain('Only the latest {n} events are shown.');
  });
});

test.describe('SCR-56 tickets and calendars', () => {
  test('a poll answer never puts back an older revision of a row changed on screen meanwhile', () => {
    const shown = [{ id: 't1', status: 'in_progress', revision: 5 }, { id: 't2', status: 'open', revision: 2 }];
    const poll = [{ id: 't1', status: 'open', revision: 4 }, { id: 't2', status: 'closed', revision: 3 }, { id: 't3', status: 'open', revision: 1 }];
    expect(keepNewerRows(shown, poll)).toEqual([shown[0], poll[1], poll[2]]);
    expect(keepNewerRows(null, poll)).toEqual(poll);
    expect(src('screens/tickets-table.ts')).toMatch(/this\.rows = keepNewerRows\(this\.rows, \[\.\.\.prev, \.\.\.page\.items/);
  });

  test('a refused drag goes back where it was at once (even when the reload fails too)', () => {
    const occ = [{ occurrence_id: 'o1', calendar_id: 'c2', start: '2026-11-26T10:00:00Z', end: '2026-11-26T11:00:00Z', title: 'x' }, { occurrence_id: 'o2', calendar_id: 'c1', start: 's', end: 'e', title: 'y' }];
    const back = rollbackMove(occ, 'o1', { calendarId: 'c1', start: '2026-11-26T08:00:00Z', end: '2026-11-26T09:00:00Z' });
    expect(back[0]).toEqual({ occurrence_id: 'o1', calendar_id: 'c1', start: '2026-11-26T08:00:00Z', end: '2026-11-26T09:00:00Z', title: 'x' });
    expect(back[1]).toBe(occ[1]);
    const s = src('calendars/view-calendar.ts');
    expect(s).toMatch(/this\.occ = rollbackMove\(this\.occ, o\.occurrence_id, before\);\s*\n\s*this\.showToast\(calErrorText\(err\), false, true\);\s*\n\s*this\.reload\(\);/);
  });
});

test.describe('SCR-57 the home in English (left to right)', () => {
  const css = src('home/home-styles.ts');
  const rule = (sel: string) => {
    const at = css.indexOf(`${sel} {`);
    expect(at, sel).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  test('the dimmer fill and its edge are mirrored in English; the value follows the document direction', () => {
    expect(css).toContain('.dim-fill:dir(ltr) {transform-origin: 0 50%;}'); // the fill grows from the left (an individual `scale` would mirror it around its own origin, off the bar)
    expect(css).toContain('.dim-edge:dir(ltr) {scale: -1 1;}');
    expect(css).toContain('.dim-v:dir(ltr) {right: auto; left: var(--dim-v-at);}');
    expect(css).toContain('.dim.lo .dim-v:dir(ltr) {left: auto; right: var(--dim-v-at);}');
  });

  test('the user menu, room temperature, camera star and theme tick use logical insets (no physical left / right)', () => {
    for (const sel of ['.sheet.umenu', '.sheet.umenu.at-rail', '.rtemp', '.cam-t .star', '.thm .tick']) {
      const r = rule(sel);
      expect(r, sel).not.toMatch(/[\s;{](left|right):/);
      expect(r, sel).toMatch(/inset-inline-(start|end):/);
    }
    // Hebrew is unchanged: each logical side is the physical side it replaced in right-to-left
    expect(rule('.sheet.umenu')).toContain('inset-inline-end: 22px'); // was left: 22px
    expect(rule('.sheet.umenu.at-rail')).toContain('inset-inline-start: 84px'); // was right: 84px
    expect(rule('.rtemp')).toContain('inset-inline-start: 18px'); // was right: 18px
    expect(rule('.cam-t .star')).toContain('inset-inline-end: 8px'); // was left: 8px
    expect(rule('.thm .tick')).toContain('inset-inline-end: 14px'); // was left: 14px
    expect(css).toContain('.sheet.umenu.at-rail {inset-inline-start: 12px; inset-block-end: 68px;}'); // the phone override, was right: 12px
  });
});
