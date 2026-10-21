import { test, expect } from '@playwright/test';
import { mayOpenIdentityCard, actionsOf, bucketOf, counts, datesText, evidenceRefOk, goneReferenceOk, ladder, narrowWindow, readOutcome, readbackView, uiState, visible, whyKey, wiskeyOffline } from '../src/access-external/model';
import { XT_KEYS, XT_TABLES, xt } from '../src/i18n/access-external';
import type { Grant } from '../src/api/access-grants';
import { grantOf } from './access-external-mocks';

// SHAREDID-293: the pure logic of the external-access screen and its words. Runs in Node (no page):
//   npx playwright test tests/unit-access-external.spec.ts --project=desktop

const TZ = 'Asia/Jerusalem';
const base = (over: Record<string, unknown> = {}): Grant =>
  grantOf({ id: 'gx', state: 'active', name: 'א', company: null, stations: [['st-a', 'לובי', [1]]], vf: '2026-10-22T05:00:00', vu: '2026-10-24T14:00:00', link: { origin: 'created_from_arx', state: 'linked' }, code: 'sent', ...over } as never) as unknown as Grant;

test('owner decision 2: "Active - verified" only from the server\'s stored read-back proof', () => {
  expect(uiState(base())).toBe('accepted');
  expect(uiState({ ...base(), scope_verified: true })).toBe('verified');
  // a narrowing still to push is never verified, whatever the flag says
  expect(uiState({ ...base(), scope_verified: true, needs_push: true })).toBe('sync');
  // the doors state alone (or a proof time) never makes it verified
  expect(uiState({ ...base(), doors_state: 'verified_central', scope_verified: false })).toBe('accepted');
  expect(ladder({ ...base(), scope_verified: true }).steps.map((s) => s.mark)).toEqual(['done', 'done', 'done', 'done', 'done']);
  expect(ladder(base()).steps.at(-1)?.mark).toBe('no');
});

test('the states and buckets of the mockup', () => {
  expect(uiState(base({ state: 'requested', pending: true }))).toBe('draft');
  expect(uiState(base({ state: 'requested' }))).toBe('pending');
  expect(uiState(base({ state: 'approved' }))).toBe('pushing');
  expect(uiState(base({ state: 'unknown' }))).toBe('unknown');
  expect(uiState(base({ state: 'ended', closure: true }))).toBe('gone');
  expect(bucketOf(base({ state: 'revoking' }))).toBe('attention');
  expect(bucketOf(base({ state: 'requested' }))).toBe('waiting');
  expect(bucketOf(base({ amend: [['st-a', [1]], ['st-b', [1]]] }))).toBe('waiting');
  expect(bucketOf(base({ state: 'approved' }))).toBe('moving');
  expect(bucketOf(base())).toBe('active');
  expect(bucketOf(base({ state: 'revoked' }))).toBe('history');
  const all = [base(), base({ state: 'revoking' }), base({ state: 'revoked' })];
  expect(counts(all)).toEqual({ attention: 1, waiting: 0, moving: 0, active: 1, history: 1 });
  expect(visible(all, { filter: 'live', q: '', station: '', source: '' })).toHaveLength(2);
  expect(visible(all, { filter: 'history', q: '', station: '', source: '' })).toHaveLength(1);
});

test('why a revocation is not done: a missing person, an unresolved create, a person Arx did not create', () => {
  expect(whyKey(base({ state: 'revoking', link: { origin: 'created_from_arx', state: 'wiskey_missing' } }))).toBe('why_revoking_missing');
  expect(whyKey(base({ state: 'revoking', link: null, unresolved: true }))).toBe('why_revoking_unresolved');
  expect(whyKey(base({ state: 'revoking', link: { origin: 'matched', state: 'linked' } }))).toBe('why_revoking_notours');
  expect(ladder(base({ state: 'revoking', link: { origin: 'created_from_arx', state: 'wiskey_missing' } })).steps.map((s) => s.mark)).toEqual(['done', 'unk', 'unk', 'no']);
});

test('WKV2B-295: a revoke that ended on a v1 answer is "revoked, not verified by the other side", never the clean revoked state', () => {
  for (const state of ['revoked', 'ended']) {
    expect(uiState(base({ state }))).toBe(state);
    expect(uiState(base({ state, revoke_proof: 'verified' }))).toBe(state);
    expect(uiState(base({ state, revoke_proof: 'unverified' }))).toBe('revoked_unverified');
  }
  expect(uiState(base({ state: 'revoking', revoke_proof: 'unverified' }))).toBe('revoking');
  expect(whyKey(base({ state: 'revoked', revoke_proof: 'unverified' }))).toBe('why_revoked_unverified');
  expect(bucketOf(base({ state: 'revoked', revoke_proof: 'unverified' }))).toBe('history');
  expect(ladder(base({ state: 'revoked', revoke_proof: 'unverified' })).steps.map((s) => s.mark)).toEqual(['done', 'done', 'unk', 'no']);
  expect(ladder(base({ state: 'revoked' })).steps.map((s) => s.mark)).toEqual(['done', 'done', 'done', 'done']);
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    const t = XT_TABLES[lang];
    expect(t.st_revoked_unverified, lang).toBeTruthy();
    expect(t.st_revoked_unverified, lang).not.toBe(t.st_revoked);
    expect(t.why_revoked_unverified, lang).toBeTruthy();
  }
});

test('owner decision 3: the manual "confirmed gone" is offered to a system administrator only, and only for a missing person', () => {
  const missing = base({ state: 'revoking', link: { origin: 'created_from_arx', state: 'wiskey_missing' } });
  expect(actionsOf(missing, true).gone).toBe(true);
  expect(actionsOf(missing, false).gone).toBe(false);
  expect(actionsOf(base({ state: 'revoking' }), true).gone).toBe(false);
  expect(goneReferenceOk('פנייה 5521 לאחראי WisKey')).toBe(true);
  expect(goneReferenceOk('קצר')).toBe(false);
  expect(goneReferenceOk('התקשרתי 050-123-4567')).toBe(false);
  expect(evidenceRefOk('TICKET-5521:readback')).toBe(true);
  expect(evidenceRefOk('בדיקה מול יומן')).toBe(false);
});

test('the approval only narrows the window, in the installation zone and across the DST end', () => {
  const vf = '2026-10-22T05:00:00Z';
  const vu = '2026-10-26T15:00:00Z'; // Mon 17:00 local after the DST end on 25.10 (UTC+2)
  const same = narrowWindow(vf, vu, '2026-10-22', '2026-10-26', TZ, 14);
  expect(same).toMatchObject({ valid_from: vf, valid_until: vu, days: 5, error: null });
  const n = narrowWindow(vf, vu, '2026-10-23', '2026-10-25', TZ, 14);
  expect(n.error).toBeNull();
  expect(n.valid_from).toBe('2026-10-23T05:00:00Z'); // 08:00 local, UTC+3
  expect(n.valid_until).toBe('2026-10-25T15:00:00Z'); // 17:00 local on the 25th: UTC+2
  expect(narrowWindow(vf, vu, '2026-10-21', '2026-10-25', TZ, 14).error).toBe('outside');
  expect(narrowWindow(vf, vu, '2026-10-25', '2026-10-23', TZ, 14).error).toBe('before');
  expect(narrowWindow(vf, vu, '2026-10-22', '2026-10-26', TZ, 3).error).toBe('too_long');
  expect(datesText(vf, vu, TZ)).toBe('22.10-26.10');
  expect(datesText('2026-10-20T05:00:00Z', '2026-10-20T14:00:00Z', TZ)).toBe('20.10');
});

test('GRANTSMIN-295: every kind of drift and every record origin has its words', () => {
  const kinds = ['missing', 'scope', 'unknown', 'sync_pending', 'name', 'unverified', 'idle_person'];
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of kinds) {
      expect(XT_TABLES[lang][`dk_${k}` as keyof typeof XT_TABLES.he], `${lang}.dk_${k}`).toBeTruthy();
      expect(XT_TABLES[lang][`dkt_${k}` as keyof typeof XT_TABLES.he], `${lang}.dkt_${k}`).toBeTruthy();
    }
    for (const o of ['created_from_arx', 'matched']) expect(XT_TABLES[lang][`rec_${o}` as keyof typeof XT_TABLES.he]).toBeTruthy();
  }
  expect(xt('drAll', { n: 5 }, 'en')).toBe('All differences (5)');
  expect(xt('exportDone', { n: 14 }, 'he')).toContain('14');
});

test('the words: every key in all four languages, placeholders kept, and the product is "WisKey" (owner decision 1)', () => {
  const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const lang of ['en', 'ar', 'ru'] as const) {
    const t = XT_TABLES[lang];
    expect(Object.keys(t).sort()).toEqual([...XT_KEYS].sort());
    for (const k of XT_KEYS) {
      expect(t[k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(holes(t[k]), `${lang}.${k}`).toBe(holes(XT_TABLES.he[k]));
    }
  }
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of XT_KEYS) {
      const v = XT_TABLES[lang][k].toLowerCase();
      expect(v, `${lang}.${k} names the product`).not.toMatch(/אינטרקום|intercom|الاتصال الداخلي|домофон/);
      expect(v, `${lang}.${k}: no home-platform name`).not.toMatch(/home assistant|\bha\b|ingress/);
    }
  }
  expect(xt('st_verified', undefined, 'he')).toBe('פעיל · אומת');
  expect(xt('revokingBanner', { n: 2 }, 'en')).toBe('Revocations not yet proven: 2');
});

// SHAREDUI-295: the read-back wait has no number (the owner: "the 75-second counter looks problematic")
test('the read-back wait: shown for an unknown outcome and an unproven revocation, never as a countdown', () => {
  expect(readbackView(base({ state: 'unknown' }), false)).toBe('pending');
  expect(readbackView(base({ state: 'revoking' }), false)).toBe('pending');
  expect(readbackView(base({ state: 'unknown' }), true)).toBe('offline');
  for (const st of ['active', 'requested', 'approved', 'revoked', 'ended', 'refused']) expect(readbackView(base({ state: st }), false)).toBeNull();
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of XT_KEYS.filter((x) => x.startsWith('rb_'))) {
      const v = XT_TABLES[lang][k];
      expect(v, `${lang}.${k}`).not.toMatch(/\b75\b|0:\d\d|\d+\s*(?:s|sec|שניות|ثانية|сек)\b/);
    }
  }
});

test('"read back now" ends in a terminal answer: the same state says when it was checked, a new state is named', () => {
  const u = base({ state: 'unknown' });
  expect(readOutcome(u, u)).toEqual({ kind: 'still', key: 'rb_still_unknown' });
  expect(readOutcome(u, null)).toEqual({ kind: 'still', key: 'rb_still_unknown' });
  expect(readOutcome(u, base())).toEqual({ kind: 'changed', key: 'st_accepted' });
  expect(readOutcome(base({ state: 'revoking' }), base({ state: 'revoked' }))).toEqual({ kind: 'changed', key: 'st_revoked' });
  expect(readOutcome(base({ state: 'revoking' }), base({ state: 'revoking' }))).toEqual({ kind: 'still', key: 'rb_still_revoking' });
  expect(readOutcome(base(), { ...base(), scope_verified: true })).toEqual({ kind: 'changed', key: 'st_verified' });
  expect(xt('rb_still_unknown', { t: '10:20' }, 'en')).toBe('Checked at 10:20: still not known.');
});

test('WisKey is called offline only when the server says so, and only while the feature is on', () => {
  expect(wiskeyOffline({ enabled: true, wiskey: { reachable: false } })).toBe(true);
  expect(wiskeyOffline({ enabled: true, wiskey: { reachable: true } })).toBe(false);
  expect(wiskeyOffline({ enabled: false, wiskey: { reachable: false } })).toBe(false);
  expect(wiskeyOffline({ enabled: true })).toBe(false); // an older server without the field: not claimed
  expect(wiskeyOffline(null)).toBe(false);
});

test('DIRPERM-295: the identity card opens for tickets.configure, tickets.directory or the grant permission - nobody else', () => {
  const held = (...p: string[]) => (x: string) => p.includes(x);
  expect(mayOpenIdentityCard(false, held('tickets.directory'))).toBe(true);
  expect(mayOpenIdentityCard(false, held('tickets.configure'))).toBe(true);
  expect(mayOpenIdentityCard(true, held())).toBe(true);
  expect(mayOpenIdentityCard(false, held('tickets.handlers', 'tickets.manage'))).toBe(false);
  expect(mayOpenIdentityCard(false, held())).toBe(false);
});
