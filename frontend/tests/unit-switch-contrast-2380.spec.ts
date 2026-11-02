import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIN_IDS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';

/**
 * A11Y-R4-LEFTOVERS-2380 (leftover 2 of RELEASE-2370-TRAIN's accessibility pass): the OFF track of the shared switch was
 * `--sw-border-strong`, a hairline tone (about 1.2:1 on a card). A switch's track is a UI boundary (WCAG 1.4.11, 3:1), so it now reads
 * a dedicated token, `--sw-toggle-off`. Computed from the token table, for every skin x scheme, against every surface a switch sits on:
 * the page background, the solid surfaces, the translucent surfaces and the nav glass over the page background, the card over each
 * canvas bloom (domus), and the hovered-row fill (--sw-surface-3 over the solid surface). The white thumb must also read on the track.
 * The switch implementations that draw their own track must read the token, not the border.
 */

const MIN = 3;
/** The white thumb on the track: 3:1, except bubble dark - its surfaces are light lilac, so the track (3:1 against them) has to be lighter than any
 * mid-grey that holds a white thumb at 3:1; the thumb keeps 2.3:1 there and the knob's own shadow draws its edge. */
const THUMB_MIN = (id: string, mode: string) => (id === 'bubble' && mode === 'dark' ? 2.3 : MIN);
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');

const colours = (s: string): RGBA[] => (s.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi) ?? []).map((c) => parseColor(c)).filter((c): c is RGBA => !!c);

function beds(id: string, mode: 'light' | 'dark'): { v: (n: string) => string; beds: Record<string, RGBA> } {
  const t = skinTable(id as (typeof SKIN_IDS)[number]);
  const v = (n: string) => t[n][mode];
  const P = (n: string) => {
    const c = parseColor(v(n));
    if (!c) throw new Error(`${id}/${mode} ${n}: cannot parse ${v(n)}`);
    return c;
  };
  const bg = P('--sw-bg');
  const solid = P('--sw-surface-solid');
  const out: Record<string, RGBA> = { bg, 'surface-solid': solid, 'surface-2-solid': P('--sw-surface-2-solid') };
  for (const n of ['--sw-surface', '--sw-surface-2', '--sw-nav-glass']) out[`${n.slice(5)} over bg`] = over(P(n), bg);
  if (id !== 'bubble') out['surface-3 over surface-solid'] = over(P('--sw-surface-3'), solid); // bubble: the slider track / pressed fill, never a bed a switch rests on
  const canvas = colours(v('--sw-canvas'));
  const stops = canvas.filter((c) => c[3] >= 1);
  const blooms = canvas.filter((c) => c[3] < 1 && !(c[0] === 255 && c[1] === 255 && c[2] === 255));
  stops.forEach((s, i) => blooms.forEach((b, j) => (out[`surface over bloom ${j + 1} on stop ${i + 1}`] = over(P('--sw-surface'), over(b, s)))));
  return { v, beds: out };
}

test('the switch off-track (--sw-toggle-off) reads >= 3:1 on every surface, every skin, both schemes; the thumb reads on it', () => {
  const fails: string[] = [];
  const rows: string[] = [];
  for (const id of SKIN_IDS) {
    for (const mode of ['light', 'dark'] as const) {
      const { v, beds: b } = beds(id, mode);
      const track = parseColor(v('--sw-toggle-off'));
      expect(track, `${id}/${mode} --sw-toggle-off must be a plain colour`).not.toBeNull();
      let worst = Infinity;
      let where = '';
      for (const [bed, c] of Object.entries(b)) {
        const r = contrastRatio(over(track!, c), c);
        if (r < worst) [worst, where] = [r, bed];
      }
      const thumb = parseColor(v('--sw-toggle-thumb'))!;
      const tr = contrastRatio(thumb, track!);
      rows.push(`${id}/${mode} ${v('--sw-toggle-off')}: track ${worst.toFixed(2)} (${where}), thumb ${tr.toFixed(2)}`);
      if (worst < MIN) fails.push(`${id}/${mode} track vs ${where}: ${worst.toFixed(2)}`);
      if (tr < THUMB_MIN(id, mode)) fails.push(`${id}/${mode} thumb vs track: ${tr.toFixed(2)}`);
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('the old track (--sw-border-strong) was below 3:1 on a card - the reason for the token', () => {
  let below = 0;
  for (const id of SKIN_IDS) {
    const t = skinTable(id as (typeof SKIN_IDS)[number]);
    const track = parseColor(t['--sw-border-strong'].light);
    const card = parseColor(t['--sw-surface-solid'].light);
    if (track && card && contrastRatio(over(track, card), card) < MIN) below++;
  }
  expect(below).toBeGreaterThan(0);
});

/** Every file that draws its own switch track. */
const OWN_TRACKS: [string, RegExp][] = [
  ['components/sw-toggle.ts', /button \{[^}]*background: var\(--sw-toggle-off\)/s],
  ['incidents/settings-form.ts', /\.sw \{[^}]*background: var\(--sw-toggle-off\)/],
  ['screens/security-alarm.ts', /button\.tgl \{[^}]*background: var\(--sw-toggle-off\)/s],
  ['screens/system-access-messaging.ts', /\.track \{[^}]*background: var\(--sw-toggle-off\)/s],
  ['screens/system-access-policy.ts', /\.track \{[^}]*background: var\(--sw-toggle-off\)/s],
  ['screens/system-brand-installer.ts', /\.tgl \{[^}]*background: var\(--sw-toggle-off\)/],
  ['screens/system-security-privacy-masks.ts', /\.sw-switch \.track \{[^}]*background: var\(--sw-toggle-off\)/s],
  ['screens/system-security-public.ts', /\.track \{[^}]*background: var\(--sw-toggle-off\)/],
  ['screens/wiskey-person-messages.ts', /\.track \{[^}]*background: var\(--sw-toggle-off\)/s],
];

test('every switch that draws its own off track reads --sw-toggle-off (not the hairline border)', () => {
  const bad = OWN_TRACKS.filter(([f, re]) => !re.test(read(f))).map(([f]) => f);
  expect(bad).toEqual([]);
});

test('the tesla ring switch draws its off ring with --sw-toggle-off', () => {
  expect(read('design/skins/tesla.ts')).toMatch(/:host\(sw-toggle\) button \{[^}]*box-shadow: inset 0 0 0 1px var\(--sw-toggle-off\)/);
});
