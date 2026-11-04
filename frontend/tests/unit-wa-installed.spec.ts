import { test, expect } from '@playwright/test';
import { WI_KEYS, WI_TABLES, wi } from '../src/i18n/wa-installed';
import { blockers, jobTone, jobWord, pacedEditable, recentJobs, syncTone } from '../src/messaging/wa-installed-model';
import { INSTALLED_COMMANDS, demoInstalledView, resetDemoWaInstalled, waInstalledApi, type InstalledJob } from '../src/api/wa-installed';

// WISKEY-WA-QUEUE-2400: the pure logic, the words and the demo backend of the installed-client messaging card. Runs in Node (no page):
//   npx playwright test -c playwright.unit.config.ts tests/unit-wa-installed.spec.ts

const job = (over: Partial<InstalledJob> = {}): InstalledJob => ({
  operation_id: 'tplq-0000000001', template_id: 'access', person_id: 'p1', state: 'queued', outcome: 'pending', code: null,
  created_at: '2026-11-04T08:00:00+00:00', updated_at: '2026-11-04T08:00:00+00:00', ...over,
});

test('every key exists in all four languages, placeholders match, and no text names a platform', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    expect(Object.keys(WI_TABLES[lang]).sort(), lang).toEqual([...WI_KEYS].sort());
    for (const k of WI_KEYS) {
      expect(WI_TABLES[lang][k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(WI_TABLES[lang][k], `${lang}.${k}`).not.toMatch(/home assistant|wiskey|hikvision|\bHA\b/i);  // the page's copy rule
    }
  }
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
  for (const k of WI_KEYS) for (const lang of ['en', 'ar', 'ru'] as const) expect(ph(WI_TABLES[lang][k]), `${lang}.${k}`).toBe(ph(WI_TABLES.he[k]));
  expect(wi('ttl', { n: 120 }, 'en')).toBe('A message waits in the queue for up to 120 seconds');
});

test('no word claims delivery: "sent" is the provider accepting it', () => {
  for (const lang of ['he', 'en'] as const) {
    expect(WI_TABLES[lang].job_sent).not.toMatch(/נמסר|delivered/i);
    expect(WI_TABLES[lang].delivery).toMatch(/מסירה|delivery/i);
  }
});

test('a job gets its honest word; an unknown is never sent or failed', () => {
  expect(jobWord(job())).toBe('pending');
  expect(jobWord(job({ state: 'dispatching' }))).toBe('pending');
  expect(jobWord(job({ state: 'completed', outcome: 'accepted', code: 'provider_accepted' }))).toBe('sent');
  expect(jobWord(job({ state: 'cancelled', outcome: 'not_sent', code: 'cancelled_before_dispatch' }))).toBe('cancelled');
  expect(jobWord(job({ state: 'completed', outcome: 'not_sent', code: 'rate_limited' }))).toBe('paced');
  expect(jobWord(job({ state: 'completed', outcome: 'not_sent', code: 'queue_expired' }))).toBe('expired');
  expect(jobWord(job({ state: 'completed', outcome: 'not_sent', code: 'source_changed_before_dispatch' }))).toBe('not_sent');
  expect(jobWord(job({ state: 'unknown', outcome: 'unknown', code: 'ack_lost_no_replay' }))).toBe('unknown');
  expect(jobTone('sent')).toBe('ok');
  expect(jobTone('unknown')).toBe('warn');
  expect(jobTone('pending')).toBe('muted');
  expect(jobTone('cancelled')).toBe('bad');
});

test('blockers follow the server order and name a missing transport', () => {
  const v = demoInstalledView();
  expect(blockers(v)).toEqual(['permit_closed']);  // the production build: the permit is closed
  v.gates = { messaging_enabled: false, template_switch: false, permit: false };
  v.commands['whatsapp/template_enqueue_v1'] = false;
  v.commands['whatsapp/template_send_v3'] = false;
  expect(blockers(v)).toEqual(['messaging_off', 'template_switch_off', 'permit_closed', 'queue_unavailable']);
  v.commands['whatsapp/template_send_v3'] = true;
  expect(blockers(v)).not.toContain('queue_unavailable');
  v.gates = { messaging_enabled: true, template_switch: true, permit: true };
  expect(blockers(v)).toEqual([]);
});

test('the paced switch can be turned on only while WisKey lists it, and off always', () => {
  const v = demoInstalledView();
  expect(pacedEditable(v)).toBe(false);
  v.commands['whatsapp/send_pacing_v1'] = true;
  expect(pacedEditable(v)).toBe(true);
  v.commands['whatsapp/send_pacing_v1'] = false;
  v.settings.send_pacing_v1 = true;
  expect(pacedEditable(v)).toBe(true);
});

test('sync tones and the recent-jobs cut', () => {
  expect(syncTone('synced')).toBe('ok');
  expect(syncTone('unknown')).toBe('warn');
  expect(syncTone('refused')).toBe('bad');
  expect(syncTone(null)).toBe('muted');
  const many = Array.from({ length: 9 }, (_, i) => job({ operation_id: `tplq-000000000${i}` }));
  expect(recentJobs(many).map((j) => j.operation_id)).toEqual(many.slice(0, 5).map((j) => j.operation_id));
  expect(recentJobs(many, -1)).toEqual([]);
});

test('the demo backend: no history command, the paced opt-in and a sync', async () => {
  resetDemoWaInstalled();
  const api = waInstalledApi();
  const v = await api.view();
  expect(Object.keys(v.commands).sort()).toEqual([...INSTALLED_COMMANDS].sort());
  expect(v.excluded).toContain('whatsapp/history');
  expect(v.delivery_receipts).toBe(false);
  expect(JSON.stringify(v)).not.toMatch(/\+972|phone/);
  expect((await api.save({ send_pacing_v1: true })).settings.send_pacing_v1).toBe(true);
  const s = await api.sync();
  expect(s.sync?.outcome).toBe('synced');
  resetDemoWaInstalled();
  expect((await api.view()).settings.send_pacing_v1).toBe(false);
});
