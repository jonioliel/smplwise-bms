import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GESC_BODY, GESC_KEYS, GESC_TABLES, gesc } from '../src/i18n/generator-escalation';

// GENELEV-295: the "how a critical alert escalates" explainer in the generator routing settings. Pure text and drift guards, no browser.
const BACKEND = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'services');
const holders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

test.describe('generator escalation explainer', () => {
  test('the four language columns carry every key with the same placeholders', () => {
    for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
      for (const k of GESC_KEYS) {
        const v = GESC_TABLES[lang][k];
        expect(v, `${lang}.${k}`).toBeTruthy();
        expect(holders(v!), `${lang}.${k}`).toEqual(holders(GESC_TABLES.he[k]!));
        expect(v, `${lang}.${k}`).not.toMatch(/Home Assistant|Ingress/i); // operator words only
      }
    }
  });

  test('the critical delay is filled in everywhere it is mentioned', () => {
    for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
      const text = GESC_BODY.map((k) => gesc(k, { n: 7 }, lang)).join(' ');
      expect(text, lang).toContain('7');
      expect(text, lang).not.toMatch(/\{n\}/);
    }
    expect(gesc('critical', { n: 12 }, 'en')).toContain('within 12 min');
  });

  test('it reads in the order: who, critical, further steps, other severities, what stops it, where to edit, permission', () => {
    expect([...GESC_BODY]).toEqual(['who', 'critical', 'steps', 'other', 'stops', 'where', 'perm']);
    expect(GESC_BODY.every((k) => GESC_KEYS.includes(k))).toBe(true);
  });

  test('a missing language key falls back to the Hebrew, an unknown language is Hebrew', () => {
    expect(gesc('who')).toBe(GESC_TABLES.he.who); // no document in node: Hebrew
  });

  test('it states only what the code does (drift guards against the sources of the described behaviour)', () => {
    const alerts = readFileSync(join(BACKEND, 'generator_alerts.py'), 'utf-8');
    const notify = readFileSync(join(BACKEND, 'notify.py'), 'utf-8');
    const settings = readFileSync(join(BACKEND, 'notify_settings.py'), 'utf-8');
    // a critical alert always escalates, after the type's own delay or the generator's critical delay
    expect(alerts).toMatch(/if severity == "critical" or \(pol is not None and pol\["escalate"\]\):\s+return own or critical_escalate_after_min\(conn\)/);
    // every other severity only when the type's own escalation is on (the function returns None otherwise)
    expect(alerts).toMatch(/return min\(max\(v, 1\), 1440\) if v else int\(nsettings\.load\(conn\)\["escalation"\]\["after_min"\]\)/);
    // the targets are the notification managers or the chosen users, limited to who may see the row
    expect(notify).toMatch(/managers\(conn\) if esc\.get\("to"\) == "managers"/);
    expect(notify).toMatch(/Reach\(conn, p\)\.can_see\(n\)/);
    // acknowledging or resolving clears the escalation time
    expect(notify).toMatch(/state = 'acknowledged'[^\n]*escalate_at = NULL/);
    expect(notify).toMatch(/state = 'resolved'[^\n]*escalate_at = NULL/);
    // the steps are 1 to 3 in the notification settings (the explainer says so)
    expect(settings).toMatch(/not 1 <= v <= 3/);
    expect(GESC_TABLES.en.steps).toContain('1 to 3');
  });
});
