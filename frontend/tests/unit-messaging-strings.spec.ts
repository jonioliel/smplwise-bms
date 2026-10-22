import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGING_KEYS, mt, problemText } from '../src/i18n/access-messaging';

// CR-036 WA: the strings of the Settings page "הודעות". Node only. Every key a screen asks for exists (a typo would show the key itself to
// an administrator), and no string names the platform or an internal code (docs/design/UI_COPY_RULES.md): the area is "בקרת כניסה", the
// service "שירות ההודעות". The curly-brace words {name} / {organization} are the TEMPLATES' own placeholders, not a leftover variable.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const FILES = ['screens/system-access-messaging.ts'];

test('every key the Settings page asks for exists', () => {
  const known = new Set<string>(MESSAGING_KEYS);
  const missing: string[] = [];
  for (const f of FILES) {
    const text = readFileSync(path.join(SRC, f), 'utf8');
    for (const m of text.matchAll(/\bmt\('([a-z_.]+)'/g)) if (!known.has(m[1])) missing.push(`${f}: ${m[1]}`);
  }
  expect(missing).toEqual([]);
  // keys built from a template: service.<problem>
  for (const k of ['service.account_required', 'service.account_missing', 'service.account_not_covered', 'service.no_account']) expect(known.has(k as never), k).toBe(true);
});

test('no string names the platform, an internal code or a permission id', () => {
  const bad: string[] = [];
  for (const key of MESSAGING_KEYS) {
    const text = mt(key);
    if (/WisKey|Home Assistant|Ingress|hikvision|add-on|תוסף|\bHA\b/i.test(text)) bad.push(`${key}: platform name`);
    if (/\bCR-\d+|\bS\d+\b|access\.[a-z]+/.test(text)) bad.push(`${key}: internal code`);
  }
  expect(bad).toEqual([]);
});

test('placeholders are filled, and the templates\' own placeholders are left alone', () => {
  expect(mt('bulk.hint', { min: 1, max: 200 })).toBe('בין 1 ל־200');
  expect(mt('template.counter', { n: 12, max: 600 })).toBe('12/600');
  expect(mt('service.account', { name: 'Office line' })).toBe('חשבון: Office line');
  expect(mt('org.hint')).toBe('מחליף את {organization} בתבניות');
  expect(mt('templates.sub')).toContain('{name}');
  expect(mt('templates.sub')).toContain('{organization}');
  expect(problemText('unknown_placeholder')).toContain('{name}');
});

test('no Hebrew literal of the page names the platform either (a string typed in a template)', () => {
  const bad: string[] = [];
  for (const f of FILES) {
    const code = readFileSync(path.join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(/[א-ת][^`'"<>${}\n]*/g)) if (/WisKey|Home Assistant|Ingress/i.test(m[0])) bad.push(`${f}: ${m[0]}`);
  }
  expect(bad).toEqual([]);
});
