import { test, expect } from '@playwright/test';
import { WM_DEV_MARKED, WM_KEYS, WM_TABLES, wmt, wmtOf } from '../src/i18n/wiskey-managed';
import { ApiError } from '../src/api/client';
import { RUNNABLE_PLANS, STEP_ORDER, isFinished, jobTone, managedRefusal, offers, phraseMatches, refusalCode, type ManagedJob, type ManagedView } from '../src/api/wiskey-managed';

// WISKEY-MANAGED-INSTALL-2382: the words and the pure rules of the "installation and updates" card (#/system/security/wiskey).
// Node-only:  npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-managed.spec.ts

const err = (status: number, code: string) => new ApiError(status, { code, user_message: '', retryable: false, correlation_id: 'x', details: {} });

function view(over: Partial<ManagedView> = {}): ManagedView {
  return {
    switches: { enabled: 'on', core_risk: 'off' },
    phrases: { enabled: 'מאשר ניהול התקנה', core_risk: 'מאשר סיכון סביבה', adopt: 'מאשר העברה לניהול' },
    bundle: { state: 'ok', version: '2.0.1-rc.10' },
    installed: { state: 'present', ownership: 'adopted', version: '2.0.1-rc.10', markers: { component: 'manual', config: 'manual' } },
    plan: 'convert',
    runnable: true,
    adoptable: false,
    adoption: null,
    job: null,
    running: false,
    rollback_available: false,
    unattended_permitted: false,
    ...over,
  };
}

test('every key exists in he / en / ar / ru, non-empty, with the same placeholders', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of WM_KEYS) {
      const v = WM_TABLES[lang][k];
      expect(typeof v === 'string' && v.trim().length > 0, `${lang}.${k}`).toBe(true);
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(ph(v), `${lang}.${k} placeholders`).toBe(ph(WM_TABLES.he[k]));
    }
  }
  expect([...WM_DEV_MARKED]).toEqual(['ar', 'ru']);
});

test('the words never name the home platform, an internal key or a setting name', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of WM_KEYS) {
      const v = WM_TABLES[lang][k];
      expect(/home assistant|\bHA\b|supervisor|hassio|ingress/i.test(v), `${lang}.${k} platform`).toBe(false);
      expect(/wiskey\.|hikvision_intercom|auto_install|OWNER_ON/i.test(v), `${lang}.${k} internal key`).toBe(false);
    }
  }
});

test('every step, plan, ownership, job state and check the server sends has a word', () => {
  for (const s of STEP_ORDER) expect(wmtOf('step_', s), s).not.toBeNull();
  for (const p of ['install', 'upgrade', 'convert', 'up_to_date', 'downgrade_refused', 'same_version_different_content', 'version_unknown', 'bundle_missing', 'not_mapped']) {
    expect(wmtOf('plan_', p), p).not.toBeNull();
  }
  for (const o of ['manual', 'adopted', 'arx_managed', 'legacy', 'unknown', 'missing', 'marker_invalid', 'link', 'unreadable', 'not_mapped']) {
    expect(wmtOf('own_', o), o).not.toBeNull();
  }
  for (const j of ['running', 'succeeded', 'aborted', 'rolled_back', 'rollback_failed', 'interrupted', 'failed']) expect(wmtOf('job_', j), j).not.toBeNull();
  for (const c of ['preflight', 'supervisor', 'core_gate', 'backup_check']) expect(wmtOf('chk_', c), c).not.toBeNull();
  expect(wmtOf('code_', 'no_such_code')).toBeNull();
  expect(wmtOf('code_', null)).toBeNull();
  expect(wmt('typeQ', { name: 'X' }, 'en')).toBe('Turn on "X"?');
});

test('the typed phrase must match exactly (trimmed, NFC), never an empty phrase', () => {
  const p = 'מאשר ניהול התקנה';
  expect(phraseMatches(p, p)).toBe(true);
  expect(phraseMatches(`  ${p} `, p)).toBe(true);
  expect(phraseMatches(p.normalize('NFD'), p)).toBe(true);
  expect(phraseMatches('מאשר', p)).toBe(false);
  expect(phraseMatches(`${p}!`, p)).toBe(false);
  expect(phraseMatches('', '')).toBe(false);
});

test('offers: nothing while the switch is off or a run is active; adopt / run / rollback from the server flags only', () => {
  expect(offers(null)).toEqual({ adopt: false, upgrade: false, rollback: false });
  expect(offers(view({ switches: { enabled: 'off', core_risk: 'off' } }))).toEqual({ adopt: false, upgrade: false, rollback: false });
  expect(offers(view({ running: true, rollback_available: true }))).toEqual({ adopt: false, upgrade: false, rollback: false });
  expect(offers(view())).toEqual({ adopt: false, upgrade: true, rollback: false });
  expect(offers(view({ adoptable: true, runnable: false, plan: 'convert' }))).toEqual({ adopt: true, upgrade: false, rollback: false });
  // a refused plan is never offered even if the server's runnable flag were stale
  for (const plan of ['up_to_date', 'downgrade_refused', 'same_version_different_content', 'version_unknown']) {
    expect(offers(view({ plan })).upgrade, plan).toBe(false);
  }
  expect([...RUNNABLE_PLANS]).toEqual(['install', 'upgrade', 'convert']);
  expect(offers(view({ plan: 'up_to_date', runnable: false, rollback_available: true })).rollback).toBe(true);
});

test('job tone and finished state', () => {
  const j = (state: ManagedJob['state']): ManagedJob => ({ id: 'x', kind: 'convert', state, code: null, from_version: null, to_version: null, steps: [] });
  expect(isFinished(null)).toBe(false);
  expect(isFinished(j('running'))).toBe(false);
  expect(isFinished(j('succeeded'))).toBe(true);
  expect(jobTone(j('succeeded'))).toBe('ok');
  expect(jobTone(j('rolled_back'))).toBe('warn');
  expect(jobTone(j('aborted'))).toBe('warn');
  expect(jobTone(j('rollback_failed'))).toBe('danger');
  expect(jobTone(j('running'))).toBe('info');
});

test('the closed refusals are told apart and worded from the code, never the server text', () => {
  expect(managedRefusal(err(403, 'not_system_admin'))).toBe('forbidden');
  expect(managedRefusal(err(422, 'confirmation_required'))).toBe('confirm');
  expect(managedRefusal(err(409, 'plan_refused'))).toBe('conflict');
  expect(managedRefusal(err(422, 'validation'))).toBe('invalid');
  expect(managedRefusal(new TypeError('x'))).toBe('other');
  expect(refusalCode(err(409, 'adoption_required'))).toBe('adoption_required');
  expect(refusalCode(new Error('x'))).toBeNull();
  expect(wmtOf('code_', 'adoption_required', 'he')).toContain('להעביר');
  expect(wmt('unattended', undefined, 'he')).toContain('כבויה');
});
