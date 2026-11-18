import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { avatarInitials } from '../src/components/avatar-initials';
import { actorView } from '../src/components/device-activity-logic';

// CR-INITIALS-B-2443: the two copies CR-INITIALS-2443 left outside its row now use the shared rule too.
const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => fs.readFileSync(path.join(here, '..', 'src', p), 'utf8');

const names = ['Dana Levi', 'dana levi', 'דנה בת שבע כהן', 'אלון ד.', 'Jean-Pierre Dupont', 'מיזוג', '𝒜lice 𝒵eta', 'לובי Lobby-12', 'Montgomery III', 'קומה 2', '👨‍👩‍👧‍👦'];

test('device activity: a person actor draws the shared initials rule', () => {
  for (const n of names) {
    const v = actorView({ actor: { type: 'person', name: n }, source: undefined, confidence: 'exact' } as never);
    expect(v.initials, JSON.stringify(n)).toBe(avatarInitials(n));
  }
  expect(actorView({ actor: { type: 'person', name: 'דנה בת שבע כהן' } } as never).initials).toBe('דכ'); // first + LAST word (was first two)
  expect(actorView({ actor: { type: 'person', name: 'dana levi' } } as never).initials).toBe('DL'); // upper-cased (was 'dl')
  expect(actorView({ actor: { type: 'person', name: '𝒜lice 𝒵eta' } } as never).initials).toBe('𝒜𝒵'); // never half a surrogate pair
  expect(actorView({ actor: { type: 'person', name: '👨‍👩‍👧‍👦' } } as never).initials).toBe(''); // no letter: the call site draws the person icon
  expect(actorView({ actor: { type: 'automation', name: 'Night mode' } } as never).initials).toBe(''); // a non-person keeps its glyph
});

test('access request dialog: the private initials() method delegates to the shared rule (source check, a Lit class is not importable in Node)', () => {
  const s = src('access-external/request-dialog.ts');
  expect(s).toContain("import { avatarInitials } from '../components/avatar-initials';");
  const body = /private initials\([^)]*\)[^{]*\{[\s\S]*?\n  \}/.exec(s)?.[0] ?? '';
  expect(body).toContain("avatarInitials(name) || '?'");
  expect(body).not.toMatch(/split\(|\[0\]|slice\(0, 2\)/);
});
