import { test, expect } from '@playwright/test';
import {
  CAPABILITY_LABEL, capabilityLines, durationText, keptStatusFilter, linkPlan, originText, presetFromTemplate, statusFilterOptions, statusText,
} from '../src/access-external/wiskey-visits-logic';
import type { GuestTemplate, VisitCapability, VisitLink } from '../src/api/wiskey-visits';

// WISKEY-VISITS-2407: the pure part of the visits panel - capability lines with the server's Hebrew reason, status / origin texts, what an
// invitation's record state allows (an unknown outcome is only ever checked, never re-sent), and a guest template as an invite preset.
// Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-visits.spec.ts

const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|\bHA\b/i;
const cap = (over: Partial<VisitCapability> = {}): VisitCapability => ({ available: true, reason: null, message: null, ...over });
const link = (over: Partial<VisitLink> = {}): VisitLink => ({
  invite_id: 'inv1', state: 'never', pushed_revision: null, current_revision: 3, in_sync: false, pushable: true, wiskey_visit_id: null, last_code: null,
  attempted_at: null, ...over,
});

test('capability lines show available or the server reason, never a bare code', () => {
  const lines = capabilityLines({
    visits: cap(),
    templates: cap({ available: false, reason: 'not_listed', message: 'מערכת בקרת הכניסה המותקנת אינה מציעה את הפעולה הזו לזהות של Arx.' }),
    push: cap({ available: false, reason: 'push_not_offered', message: null }),
  });
  expect(lines.map((l) => l.name)).toEqual(['visits', 'templates', 'push']);
  expect(lines[0]).toMatchObject({ tone: 'ok', text: 'זמין' });
  expect(lines[1].text).toContain('אינה מציעה');
  expect(lines[2]).toMatchObject({ tone: 'warn', text: 'לא זמין (push_not_offered)' });
  const off = capabilityLines({ visits: cap(), templates: cap(), push: cap({ available: false, reason: 'push_off', message: 'כבוי' }) });
  expect(off[2].tone).toBe('off');
});

test('operator texts never name the vendor or the platform', () => {
  const texts = [
    ...Object.values(CAPABILITY_LABEL),
    ...(['pending', 'approved', 'rejected', 'cancelled', 'superseded', 'ended', 'unknown'] as const).map((s) => statusText(s).text),
    originText({ origin: 'arx' }).text, originText({ origin: 'wiskey' }).text,
    ...(['never', 'sending', 'pushed', 'refused', 'not_sent', 'unknown'] as const).map((s) => linkPlan(link({ state: s }), true).text),
  ];
  for (const t of texts) expect(t).not.toMatch(BANNED);
});

test('a visit created in the access-control system is read only; an Arx invitation is marked as Arx', () => {
  expect(originText({ origin: 'wiskey' })).toEqual({ text: 'נוצר במערכת בקרת הכניסה · צפייה בלבד', tone: 'off' });
  expect(originText({ origin: 'arx' }).tone).toBe('acc');
  expect(statusText('approved')).toEqual({ text: 'מאושר', tone: 'ok' });
  expect(statusText('bogus' as never)).toEqual({ text: 'לא ידוע', tone: 'off' });
});

test('an Arx record that ended has its own label, not "unknown" (WISKEY-R6-2520)', () => {
  expect(statusText('ended')).toEqual({ text: 'הסתיים', tone: 'off' });
  expect(statusText('ended').text).not.toBe(statusText('unknown').text);
});

test('the record plan: push when allowed, check after an unknown, nothing while sending or in sync', () => {
  expect(linkPlan(link(), true).action).toBe('push');
  expect(linkPlan(link(), false).action).toBe('none');
  expect(linkPlan(link({ pushable: false }), true).action).toBe('none');
  expect(linkPlan(link({ state: 'unknown' }), true)).toEqual({ action: 'reconcile', text: 'תוצאה לא ברורה', tone: 'warn' });
  expect(linkPlan(link({ state: 'unknown' }), false).action).toBe('reconcile');
  expect(linkPlan(link({ state: 'sending' }), true).action).toBe('none');
  expect(linkPlan(link({ state: 'pushed', in_sync: true, pushed_revision: 3 }), true)).toEqual({ action: 'none', text: 'נרשם', tone: 'ok' });
  expect(linkPlan(link({ state: 'pushed', in_sync: false, pushed_revision: 2 }), true)).toEqual({ action: 'push', text: 'נרשם · יש עדכון לשליחה', tone: 'warn' });
  expect(linkPlan(link({ state: 'refused', last_code: 'installation_unavailable' }), true).action).toBe('push');
});

test('a guest template becomes an invite preset of its length, doors sorted', () => {
  const t: GuestTemplate = { id: 'tpl', label: 'אורח', access_category: 'contractor', duration_minutes: 120, doors: { 'entry-a': [2, 1] }, weekly_hours: false, updated_at: null };
  const start = Date.UTC(2026, 10, 7, 8, 0, 31, 500);
  expect(presetFromTemplate(t, start)).toEqual({ doors: { 'entry-a': [1, 2] }, valid_from: '2026-11-07T08:00:00Z', valid_until: '2026-11-07T10:00:00Z', category: 'contractor' });
  expect(presetFromTemplate({ ...t, duration_minutes: null }, start)).toBeNull();
  expect(presetFromTemplate({ ...t, doors: {} }, start)).toBeNull();
  expect(presetFromTemplate({ ...t, access_category: 'unknown' }, start)?.category).toBe('visitor');
});

test('durations read naturally', () => {
  expect(durationText(120)).toBe('2 שעות');
  expect(durationText(60)).toBe('שעה');
  expect(durationText(1440)).toBe('יום');
  expect(durationText(2880)).toBe('2 ימים');
  expect(durationText(45)).toBe('45 דקות');
  expect(durationText(null)).toBe('—');
});

// WISKEY-VISITS-ENDED-FILTER-2520: the status filter appears only when the server lists `ended` (the connected system offers it)
const SIX = ['all', 'pending', 'approved', 'rejected', 'cancelled', 'superseded'];

test('no status filter on a system that does not offer ended (rc.10: the panel stays as it was)', () => {
  expect(statusFilterOptions(undefined)).toBeNull();
  expect(statusFilterOptions(cap())).toBeNull(); // an older server: no `statuses`
  expect(statusFilterOptions(cap({ statuses: SIX }))).toBeNull();
  expect(statusFilterOptions(cap({ available: false, reason: 'no_copy', statuses: [...SIX, 'ended'] }))).toBeNull();
  expect(statusFilterOptions(cap({ statuses: 'ended' as never }))).toBeNull();
});

test('the status filter with ended: fixed order, own labels, unknown values dropped', () => {
  const opts = statusFilterOptions(cap({ statuses: ['ended', ...SIX, 'expired'] }));
  expect(opts?.map((o) => o.value)).toEqual([...SIX, 'ended']);
  expect(opts?.[0].label).toBe('הכל');
  expect(opts?.find((o) => o.value === 'ended')?.label).toBe('הסתיים');
  expect(opts?.find((o) => o.value === 'pending')?.label).toBe(statusText('pending').text);
  for (const o of opts ?? []) expect(o.label).not.toMatch(BANNED);
});

test('the chosen filter survives a reload only while it is still offered', () => {
  const opts = statusFilterOptions(cap({ statuses: [...SIX, 'ended'] }));
  expect(keptStatusFilter('ended', opts)).toBe('ended');
  expect(keptStatusFilter('ended', null)).toBe('all');
  expect(keptStatusFilter('pending', null)).toBe('all');
  expect(keptStatusFilter('all', null)).toBe('all');
});
