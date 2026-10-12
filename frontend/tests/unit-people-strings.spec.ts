import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PEOPLE_KEYS, pt } from '../src/i18n/access-people';

// CR-036 S7: the strings of the native people screen. Node only. Every key a screen asks for exists (a typo would show the key
// itself to an operator), and no string names the platform or an internal code (docs/design/UI_COPY_RULES.md): the area is "בקרת
// כניסה", the classic panel "חלון האינטרקום", the platform is never named on an operator screen.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const FILES = ['screens/wiskey-people.ts', 'screens/wiskey-person-drawer.ts', 'screens/wiskey-message-dialog.ts'];

test('every key the people screens ask for exists', () => {
  const known = new Set<string>(PEOPLE_KEYS);
  const missing: string[] = [];
  for (const f of FILES) {
    const text = readFileSync(path.join(SRC, f), 'utf8');
    for (const m of text.matchAll(/\bpt\('([a-z_.]+)'/g)) if (!known.has(m[1])) missing.push(`${f}: ${m[1]}`);
    // keys built from a template (state.${s}, rights.${r}, credential.${c}, sort.${s}, category.${c}, sync.${status}): every member exists
  }
  expect(missing).toEqual([]);
  for (const prefix of ['state.', 'rights.', 'credential.', 'sort.', 'category.', 'sync.']) expect(PEOPLE_KEYS.some((k) => k.startsWith(prefix)), prefix).toBe(true);
  for (const s of ['active', 'inactive', 'expired', 'upcoming', 'archived']) expect(known.has(`state.${s}` as never), s).toBe(true);
  for (const r of ['assigned', 'unassigned', 'disabled']) expect(known.has(`rights.${r}` as never), r).toBe(true);
  for (const c of ['pin', 'no_pin', 'card', 'no_card']) expect(known.has(`credential.${c}` as never), c).toBe(true);
  for (const s of ['name', 'name_desc', 'employee']) expect(known.has(`sort.${s}` as never), s).toBe(true);
  for (const c of ['staff', 'visitor', 'contractor']) expect(known.has(`category.${c}` as never), c).toBe(true);
  for (const s of ['synced', 'pending', 'syncing', 'conflict', 'error', 'delete_pending', 'offline', 'unknown', 'unassigned']) expect(known.has(`sync.${s}` as never), s).toBe(true);
});

test('no string names the platform, an internal code or a permission id', () => {
  const bad: string[] = [];
  for (const key of PEOPLE_KEYS) {
    const text = pt(key);
    if (/WisKey|Home Assistant|Ingress|hikvision|add-on|תוסף|\bHA\b/i.test(text)) bad.push(`${key}: platform name`);
    if (/\bCR-\d+|\bS\d+\b|access\.[a-z]+/.test(text)) bad.push(`${key}: internal code`);
  }
  expect(bad).toEqual([]);
});

test('placeholders are filled', () => {
  expect(pt('page.count_of', { shown: 50, total: 312 })).toBe('50 מתוך 312');
  expect(pt('msg.rate', { minutes: 14 })).toBe('הגעת למכסת ההודעות · אפשר לשלוח שוב בעוד 14 דק׳');
  expect(pt('msg.preview_bulk', { send: 2, skip: '' })).toBe('יישלח ל־2');
});

test('the screens use no raw platform word either (a string typed in a template)', () => {
  const bad: string[] = [];
  for (const f of FILES) {
    const text = readFileSync(path.join(SRC, f), 'utf8');
    // Hebrew text inside the templates, outside comments: a platform name there is a rule break
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(/[א-ת][^`'"<>${}\n]*/g)) if (/WisKey|Home Assistant|Ingress/i.test(m[0])) bad.push(`${f}: ${m[0]}`);
    if (/['"`>]\s*WisKey|Home Assistant/.test(code.replace(/data-wiskey[\w-]*/g, ''))) bad.push(`${f}: a platform name in a string`);
  }
  expect(bad).toEqual([]);
  expect(readdirSync(SRC).length).toBeGreaterThan(0);
});
