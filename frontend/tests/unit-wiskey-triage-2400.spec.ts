import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import {
  DURATIONS,
  REASONS,
  TRIAGE_NEED,
  alertActions,
  alertKey,
  choices,
  conflictKey,
  mayOpenTriage,
  outcomeOf,
  restoreKind,
  reviewKind,
  reviewSecondsLeft,
  type Review,
} from '../src/api/wiskey-triage';
import { tt } from '../src/i18n/wiskey-triage';
import { DEEP_LINKS, PLACES, deepLinksFor, linkFor } from '../src/wiskey/deep-links';
import { parseRoute } from '../src/router';
import { wiskeyRoute } from '../src/shell/nav';

// WISKEY-CONFLICTS-2400 (plan task T5): the pure parts of the conflicts and fleet alerts screen - how a failed step is read (never "done"
// unless the server said so), what a conflict row and a review offer, the alert actions WisKey has (snooze / restore - no acknowledge, no
// close), who may open the screen, the deep-link map's native routes, and the copy (Hebrew, no platform name). Node only, no page.
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-triage-2400.spec.ts

const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|\bHA\b/i;
const err = (status: number, code: string, details: Record<string, unknown> = {}, user_message = '') =>
  new ApiError(status, { code, user_message, retryable: false, correlation_id: 'x', details } as never);

test.describe('reading a step honestly', () => {
  test('the server outcome decides; a refusal before sending is not_sent; a network failure is unknown', () => {
    expect(outcomeOf(err(502, 'triage_failed', { outcome: 'refused', wiskey_code: 'device_unavailable' })).status).toBe('failed');
    expect(outcomeOf(err(502, 'triage_failed', { outcome: 'refused', wiskey_code: 'device_unavailable' })).code).toBe('device_unavailable');
    expect(outcomeOf(err(504, 'triage_outcome_unknown', { outcome: 'unknown' })).status).toBe('unknown');
    expect(outcomeOf(err(409, 'confirmation_required', { outcome: 'not_sent' })).status).toBe('not_sent');
    for (const s of [403, 404, 409, 415, 422, 429]) expect(outcomeOf(err(s, 'x')).status, String(s)).toBe('not_sent');
    expect(outcomeOf(err(500, 'x')).status).toBe('unknown');
    expect(outcomeOf(new TypeError('Failed to fetch'))).toEqual({ status: 'unknown', code: 'network', message: '', retry_after_s: null });
  });

  test('a changed record is "stale": nothing changed, review again', () => {
    const o = outcomeOf(err(409, 'triage_stale', { outcome: 'refused', wiskey_code: 'review_stale' }, 'השתנה'));
    expect(o).toEqual({ status: 'stale', code: 'review_stale', message: 'השתנה', retry_after_s: null });
  });

  test('the limits carry their wait', () => {
    expect(outcomeOf(err(429, 'triage_cooldown', { outcome: 'not_sent', retry_after_s: 7.5 })).retry_after_s).toBe(7.5);
    expect(outcomeOf(err(429, 'triage_cooldown', { outcome: 'not_sent', retry_after_s: -1 })).retry_after_s).toBeNull();
  });
});

const impact = (actions: Partial<Record<'central' | 'device' | 'delete', boolean>>) =>
  ({
    actions: {
      central: { allowed: !!actions.central, reason: actions.central ? null : 'ownership_missing' },
      device: { allowed: !!actions.device, reason: actions.device ? null : 'device_user_missing' },
      delete: { allowed: !!actions.delete, reason: actions.delete ? null : 'deletion_not_pending' },
    },
  }) as Review['impact'];

test.describe('conflicts', () => {
  test('a person and a removal can be reviewed; a revocation follows the person and has no resolution of its own', () => {
    expect(reviewKind({ kind: 'person' })).toBe('person');
    expect(reviewKind({ kind: 'removal' })).toBe('removal');
    expect(reviewKind({ kind: 'revocation' })).toBeNull();
    expect(reviewKind({ kind: 'something_new' })).toBeNull();
  });

  test('a review offers the person two directions and a removal one, each with WisKey\'s verdict', () => {
    expect(choices({ kind: 'person', impact: impact({ central: true }) })).toEqual([
      { direction: 'central', allowed: true, reason: null },
      { direction: 'device', allowed: false, reason: 'device_user_missing' },
    ]);
    expect(choices({ kind: 'removal', impact: impact({ delete: true, central: true }) })).toEqual([{ direction: 'delete', allowed: true, reason: null }]);
  });

  test('a review expires against the server clock', () => {
    const at = Date.parse('2026-11-04T08:00:00Z');
    expect(reviewSecondsLeft({ expires_at: '2026-11-04T08:10:00Z' }, at)).toBe(600);
    expect(reviewSecondsLeft({ expires_at: '2026-11-04T07:59:00Z' }, at)).toBeLessThan(0);
    expect(tt.drawer.expires(600)).toContain('10');
    expect(tt.drawer.expires(-1)).toContain('לבדוק שוב');
  });

  test('row keys', () => {
    expect(conflictKey({ station_id: 'entry-c', person: { id: 'u7', display_name: null, employee_no: null } })).toBe('entry-c:u7');
    expect(alertKey({ station_id: 'entry-a', kind: 'clock_drift' })).toBe('entry-a:clock_drift');
  });
});

test.describe('fleet alerts', () => {
  test('WisKey has snooze and restore only - no acknowledge, no close', () => {
    expect(alertActions({ suppressed: false, suppression: null, kind: 'offline' })).toEqual(['snooze']);
    expect(alertActions({ suppressed: true, suppression: { kind: 'offline', reason: 'investigating', until: null, created_at: null }, kind: 'offline' })).toEqual(['restore']);
    expect(alertActions({ suppressed: true, suppression: null, kind: 'offline' })).toEqual([]);
    expect(tt.alerts.noAck).toMatch(/אין לה אישור קבלה או סגירה/);
  });

  test('a station-wide (maintenance) snooze is restored as such', () => {
    expect(restoreKind({ kind: 'offline', suppression: { kind: 'maintenance', reason: 'planned_maintenance', until: null, created_at: null } })).toBe('maintenance');
    expect(restoreKind({ kind: 'offline', suppression: null })).toBe('offline');
  });

  test('the durations and reasons are exactly WisKey\'s, each with Hebrew words', () => {
    expect([...DURATIONS]).toEqual([15, 60, 240, 1440, 10080]);
    expect([...REASONS]).toEqual(['planned_maintenance', 'network_work', 'investigating']);
    for (const d of DURATIONS) expect(tt.alerts.duration[d]).toMatch(/[֐-׿0-9]/);
    for (const r of REASONS) expect(tt.alerts.reasons[r]).toMatch(/[֐-׿]/);
  });
});

test.describe('who opens it, and where it is linked from', () => {
  test('the status page reader, a station manager or a system administrator', () => {
    expect(mayOpenTriage((p) => p === 'access.admin.read')).toBe(true);
    expect(mayOpenTriage((p) => p === 'access.stations.manage')).toBe(true);
    expect(mayOpenTriage((p) => p === 'system.configure')).toBe(true);
    expect(mayOpenTriage((p) => p === 'access.read')).toBe(false);
  });

  test('the deep-link map: alerts.act and conflicts.resolve are native, with the screen\'s own rule', () => {
    expect(linkFor('alerts.act')).toBe('#/wiskey/alerts');
    expect(linkFor('conflicts.resolve')).toBe('#/wiskey/conflicts');
    expect(DEEP_LINKS['alerts.act'].native?.need).toEqual([...TRIAGE_NEED]);
    expect(DEEP_LINKS['conflicts.resolve'].native?.need).toEqual([...TRIAGE_NEED]);
    expect(PLACES.stations).toContain('conflicts.resolve');
    expect(PLACES.stations).toContain('alerts.act');
    expect(PLACES['settings-status']).toContain('alerts.act'); // the status segment shows the conflicts list itself
  });

  test('the native links need the screen permission and the WisKey area shown; no panel needed', () => {
    const ids = (v: Parameters<typeof deepLinksFor>[1]) => deepLinksFor('stations', v).map((l) => `${l.id}:${l.kind}`);
    expect(ids({ panel: false, admin: false, can: (p) => p === 'access.admin.read' })).toEqual(['conflicts.resolve:native', 'alerts.act:native']);
    expect(ids({ panel: false, admin: false, can: () => false })).toEqual([]);
    expect(ids({ panel: true, admin: true, can: () => true, area: false }).filter((x) => x.endsWith(':native'))).toEqual([]);
  });

  test('the native routes never become the embedded panel', () => {
    for (const h of ['#/wiskey/conflicts', '#/wiskey/alerts']) {
      const r = parseRoute(h);
      expect(r.mode).toBe('wiskey');
      expect(['conflicts', 'alerts']).toContain(r.segments[1]);
    }
    // the router renders <wiskey-triage> for these segments BEFORE asking wiskeyRoute (shell/sw-app.ts); wiskeyRoute alone would embed
    expect(wiskeyRoute(parseRoute('#/wiskey/sync'), true).kind).toBe('embed');
  });
});

test.describe('copy', () => {
  test('Hebrew everywhere, never a platform name', () => {
    const walk = (v: unknown, path: string): void => {
      if (typeof v === 'string') {
        expect(v, path).not.toMatch(BANNED);
        return;
      }
      if (typeof v === 'function') {
        const s = String((v as (...a: number[]) => string)(3, 1, 0));
        expect(s, path).not.toMatch(BANNED);
        expect(s, path).toMatch(/[֐-׿]/);
        return;
      }
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(tt, 'tt');
    expect(tt.title).toMatch(/[֐-׿]/);
  });

  test('every outcome has words, and "acknowledged" says the sync was queued, not done', () => {
    for (const s of ['sending', 'sent', 'acknowledged', 'completed', 'failed', 'not_sent', 'unknown', 'stale']) {
      expect(tt.status[s], s).toMatch(/[֐-׿]/);
      expect(tt.statusShort[s], s).toMatch(/[֐-׿]/);
    }
    expect(tt.status.acknowledged).toMatch(/לתור/);
    expect(tt.status.unknown).toMatch(/לא התקבלה תשובה ברורה/);
  });
});
