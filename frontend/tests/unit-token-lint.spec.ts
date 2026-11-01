import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOKEN_NAMES } from '../src/design/tokens';

// DU1 design unification (2026-10-09): the drift guard. The CSS of the shell, the shared components and the screens reads the
// design tokens for type, radii and colours; a literal in one of those places is the start of a second visual language.
//   npx playwright test tests/unit-token-lint.spec.ts --project=desktop
// What is allowed: structural 1-3 px radii, `0` / `50%` / pill, the mask colours of fades (#000 / #fff in mask-image), the
// documented knob layers (--dv-*, --mm-*, --mr-*: styles/devices-themes.ts, media-glass.ts, media-remote-css.ts), the plan canvas
// and 3D neutrals (map/), the printable bill, the offline page (their own documents), and the static style
// swatches of the settings screens (listed in ALLOW_HEX below, each with its reason).

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

/** Files whose CSS may keep literal colours, with the reason (a new entry needs a reason too). */
const ALLOW_HEX: Record<string, string> = {
  'tickets/map-element.ts': 'TKMAP1: the plan drawing and the vendor picture sit on white in both schemes (plan ink is drawn for white, never re-themed)',
  'screens/system-diagnostics.ts': 'static style previews of the device styles (DEVICE_THEMES.md §3: swatches, not knobs)',
  'screens/system-notifications.ts': 'the phone mock of the push preview (a drawn phone, dark in both schemes)',
  'screens/investigate-playback.ts': 'timeline and scrubber HUD on video (LTR geometry, dark in both schemes)',
  'screens/live-camera.ts': 'zone / line editor overlays on video',
  'screens/automation-editor-css.ts': 'the automation builder knobs (--ab-*) carry their own light / dark blocks on the --dv-* layer',
  'screens/automation-editor-base.ts': 'the builder sheet (--ab-*)',
  'screens/devices-layout-css.ts': 'the layout editor grid lines',
  'screens/investigate-cases.ts': 'evidence thumbnails HUD',
  'screens/explore-plan-editor.ts': 'the plan editor canvas HUD',
  'screens/explore-plan-import.ts': 'the import preview canvas',
  'screens/investigate-history-map.ts': 'history map HUD',
  'screens/devices-schedules.ts': 'the summary bar swatches',
  'screens/devices-automations.ts': 'the automation card glyphs',
  'screens/bubble-demo.ts': 'the style guide demo',
  'screens/styleguide-screen.ts': 'the style guide swatches',
  'screens/nvr-camera-batch.ts': 'the encoding table HUD',
  'screens/wiskey-overview.ts': 'the WisKey embed frame',
  'screens/explore-sites.ts': 'the site cards',
  'screens/system-update.ts': 'the update progress glyph',
  'screens/scenes-panel.ts': 'the scene glyphs',
  'components/sw-second-factor.ts': 'the QR code is black on white by definition',
  'components/sw-scene.ts': 'the scene canvas',
  'components/sw-floor-iso.ts': 'the isometric floor glyph (its own neutrals)',
  'components/sw-floor-glyph.ts': 'the floor glyph',
  'components/sw-schedule-grid.ts': 'the 24 h grid (--sc-* knobs on the state tokens; the night band)',
  'components/sw-pill.ts': 'the lit wash mixes toward white by design (bubble)',
  'components/sw-brand.ts': 'LOGOS295: the logo plate - a company logo is drawn for a white (or a dark) ground in both schemes, so the plate is a fixed colour, not a themed surface',
  'screens/system-brand-logos.ts': 'LOGOS295: the Settings card previews of the light and the dark strip / notice board side by side, whatever scheme the page is in (static swatches)',
  'screens/system-brand-installer.ts': 'WHITELABEL097: the installer card previews of the light and the dark strip side by side, and the white switch knob (static swatches)',
  'screens/system-notices.ts': 'NOTICERSS: the news-feed logo plate - a publisher logo is drawn for a white ground in both schemes (the same reason as the sw-brand plate)',
  'screens/investigate-incidents.ts':'LIVEEVENT100: the amber cap chip over a camera tile keeps dark ink in both schemes (the on-video HUD family; the warning fill does not change with the scheme)',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** The CSS template literals of a module (css`...` and CSS-looking plain templates), with `${...}` interpolations blanked. */
function cssBlocks(src: string): string[] {
  const blocks: string[] = [];
  for (const m of src.matchAll(/css`([\s\S]*?)`/g)) blocks.push(m[1]);
  for (const m of src.matchAll(/=\s*`([\s\S]*?)`/g)) {
    const t = m[1];
    if (/\{[^}]*:[^}]*;[^}]*\}/.test(t) && !/\$\{[^}]*html/.test(t) && t.includes('\n')) blocks.push(t);
  }
  return blocks.map((b) => b.replace(/\$\{[^}]*\}/g, ' '));
}

// CR-038: the tickets module's own components and styles (src/tickets/) are read too - a new module starts inside the guard
// CALENDARS-UI-2310: the calendars module (src/calendars/) likewise
const inScope = (rel: string) => /^(components\/sw-|shell\/|screens\/|tickets\/|calendars\/)/.test(rel) && !/\.d\.ts$/.test(rel);

const files = walk(SRC).map((f) => ({ abs: f, rel: path.relative(SRC, f).replace(/\\/g, '/') })).filter((f) => inScope(f.rel));

test('every file in scope is a screen, a shared component or the shell (the lint reads something)', () => {
  expect(files.length).toBeGreaterThan(150);
});

test('font sizes come from the type scale: no `font-size: <px>` in the CSS of the shell, the shared components and the screens', () => {
  const bad: string[] = [];
  for (const f of files) {
    for (const b of cssBlocks(readFileSync(f.abs, 'utf8'))) {
      for (const m of b.matchAll(/font-size:\s*([0-9.]+px)\s*;/g)) {
        // sizes outside the scale are display numbers (a big reading, an SVG label) and stay; the scale's range is 9-27 px
        const n = parseFloat(m[1]);
        if (n >= 9 && n <= 27) bad.push(`${f.rel}: font-size: ${m[1]}`);
      }
    }
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('radii come from the radius scale: no `border-radius: <4..24px>` literal', () => {
  const bad: string[] = [];
  for (const f of files) {
    for (const b of cssBlocks(readFileSync(f.abs, 'utf8'))) {
      for (const m of b.matchAll(/border-radius:\s*([^;{}]+);/g)) {
        for (const part of m[1].trim().split(/\s+/)) {
          const px = /^([0-9.]+)px$/.exec(part);
          if (px && parseFloat(px[1]) >= 4 && parseFloat(px[1]) <= 24) bad.push(`${f.rel}: border-radius: ${m[1].trim()}`);
        }
      }
    }
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('no `var(--sw-x, <literal>)` fallback for a declared token (the token sheet is always present)', () => {
  const names = new Set(TOKEN_NAMES);
  const bad: string[] = [];
  for (const f of files) {
    for (const b of cssBlocks(readFileSync(f.abs, 'utf8'))) {
      for (const m of b.matchAll(/var\((--sw-[a-z0-9-]+),\s*(#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))\s*\)/g)) if (names.has(m[1])) bad.push(`${f.rel}: ${m[0]}`);
    }
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('text and fill colours are tokens: a hex literal on color / background / border needs an entry in ALLOW_HEX', () => {
  const bad: string[] = [];
  const stale: string[] = [];
  const used = new Set<string>();
  for (const f of files) {
    for (const b of cssBlocks(readFileSync(f.abs, 'utf8'))) {
      for (const m of b.matchAll(/(^|[;{\n]\s*)(color|background|background-color|border|border-color|border-block-start|border-block-end|border-inline-start|border-inline-end|outline|fill|stroke)\s*:\s*([^;{}]*)/g)) {
        if (!/#[0-9a-fA-F]{3,8}\b/.test(m[3])) continue;
        used.add(f.rel);
        if (!(f.rel in ALLOW_HEX)) bad.push(`${f.rel}: ${m[2]}: ${m[3].trim().slice(0, 60)}`);
      }
    }
  }
  for (const k of Object.keys(ALLOW_HEX)) if (!used.has(k) && files.some((f) => f.rel === k)) stale.push(k);
  expect(bad, bad.join('\n')).toEqual([]);
  // an allow entry that no longer has a literal is noise: drop it (it keeps the list honest)
  expect(stale, `stale ALLOW_HEX entries:\n${stale.join('\n')}`).toEqual([]);
});

// TKUI7 (service module, 2026-10-16): the service module reads the tokens without a literal or a second token as a fallback,
// and the public-ticket bundle (its own CSS, no skins) declares every --sw token it reads in styles.css.
test('service module: no `var(--sw-x, <anything>)` fallback for a declared token in src/tickets, tickets screens, the view switch and the setup hint', () => {
  const names = new Set(TOKEN_NAMES);
  const scope = files.filter((f) => /^(tickets\/|screens\/(tickets-|system-tickets)|components\/sw-view-switch|shell\/setup-hint)/.test(f.rel));
  expect(scope.length).toBeGreaterThan(100);
  const bad: string[] = [];
  for (const f of scope) {
    for (const b of cssBlocks(readFileSync(f.abs, 'utf8'))) {
      for (const m of b.matchAll(/var\((--sw-[a-z0-9-]+),\s*([^)]*\)?)\)/g)) if (names.has(m[1])) bad.push(`${f.rel}: ${m[0]}`);
    }
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('public ticket bundle: every var(--sw-*) it reads is declared in styles.css, with no literal fallback', () => {
  const dir = path.join(SRC, 'public-ticket');
  const sheets = [path.join(dir, 'styles.css'), path.join(dir, 'claim/claim.css')];
  const declared = new Set([...readFileSync(sheets[0], 'utf8').matchAll(/(--sw-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const bad: string[] = [];
  for (const sheet of sheets) {
    const css = readFileSync(sheet, 'utf8');
    const rel = path.relative(SRC, sheet).split(path.sep).join('/');
    for (const m of css.matchAll(/var\((--sw-[a-z0-9-]+)(,[^;)]*\)?)?\)/g)) {
      if (!declared.has(m[1])) bad.push(`${rel}: ${m[1]} is not declared in public-ticket/styles.css`);
      else if (m[2]) bad.push(`${rel}: ${m[0]} (fallback for a declared token)`);
    }
    // literal radii / font sizes that equal a scale step must use the token
    for (const m of css.matchAll(/border-radius:\s*(12|16|20)px;/g)) bad.push(`${rel}: ${m[0]} (use --sw-r-*)`);
    for (const m of css.matchAll(/font-size:\s*(12|14|16|19|22)px;/g)) bad.push(`${rel}: ${m[0]} (use --sw-fs-*)`);
  }
  expect(bad, bad.join('\n')).toEqual([]);
});
