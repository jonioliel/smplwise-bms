import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIN_IDS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor } from '../src/design/contrast';

// A11Y-POLISHED-2342: the static half of the accessibility pass over the screens polished on 2026-10-31 / 11-01
// (docs/changes/A11Y-POLISHED-2342.md). It reads the sources, so a rule that can be checked without a browser is checked on every run:
//   1. (whole app) an icon-only sw-button carries a label - it becomes the button's aria-label and its tooltip;
//   2. (whole app) a native <button> with nothing but an icon in it carries aria-label / aria-labelledby / title, or is hidden from
//      assistive technology on purpose (aria-hidden="true");
//   3. (polished screens) a role="tablist" row handles the arrow keys on its own element (@keydown);
//   4. (polished screens) text is not coloured with a bare state colour (--sw-warning, --sw-danger, --sw-success, ...): in the light
//      scheme those measure 2.0-3.8:1 on the surface; the *-text twins are the text inks. Icons, glyphs and rings keep the bare colour;
//   5. the shared contracts this pass added: sw-popover closes on Escape, a stacked sw-dialog takes Escape only at the top, sw-field
//      names its slotted control, the phone tree sheet of the home screen closes on Escape and traps Tab;
//   6. (tokens, every skin, light scheme) each state's text ink reads >= 4.5:1 on its own soft fill and on the surface.
//   npx playwright test -c playwright.unit.config.ts tests/unit-a11y-polished-lint.spec.ts
// The browser halves are tests/a11y-dialog-focus-2310.spec.ts (dialog focus) and tests/layout-a11y-295.spec.ts (touch targets).

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
const ALL = walk(SRC).map((f) => path.relative(SRC, f).split(path.sep).join('/'));

/** The screens and shared parts polished on 2026-10-31 / 11-01 (the *-POLISH-2331, SHARED-POLISH-2342, OWNER-R12-2341,
 * POLISH-LEFTOVERS-2341, SETTINGS-TABS-SCROLL-2331, SWITCH-LIGHT-DIMMER-2331, TREE-HIDE-UNASSIGNED-2331 and NVR-H264-BULK-2341 changes). */
const POLISHED = [
  'components/nvr-connection-form.ts', 'components/nvr-writes-switch.ts', 'components/sw-automation-row.ts', 'components/sw-dialog.ts',
  'components/sw-popover.ts', 'components/sw-state-panel.ts', 'components/sw-table.ts', 'components/sw-tabs.ts', 'components/tab-strip.ts',
  'insights/chrome.ts', 'insights/styles.ts',
  'screens/area-quick-sheet.ts', 'screens/devices-area-bubble.ts', 'screens/devices-area.ts', 'screens/devices-automations.ts',
  'screens/devices-building.ts', 'screens/devices-bulk.ts', 'screens/devices-controls.ts', 'screens/devices-layout-css.ts', 'screens/devices-layout.ts',
  'screens/devices-notices-css.ts', 'screens/devices-notices.ts', 'screens/devices-schedules.ts', 'screens/devices-synoptic.ts',
  'screens/devices-tiles-panel.ts', 'screens/explore-floor-map.ts', 'screens/explore-floors.ts', 'screens/home-ambient-bar.ts',
  'screens/home-edit-panel.ts', 'screens/home-screen-options.ts', 'screens/home-widgets-bv1.ts', 'screens/infra-generator.ts',
  'screens/infra-report.ts', 'screens/infra-water.ts', 'screens/insights-doors.ts', 'screens/insights-settings.ts', 'screens/insights-waste.ts',
  'screens/investigate-cases.ts', 'screens/investigate-event-detail.ts', 'screens/investigate-events.ts', 'screens/investigate-exports.ts',
  'screens/investigate-ha-events.ts', 'screens/investigate-time.ts', 'screens/multimedia-players.ts', 'screens/multimedia-remote-editor.ts',
  'screens/nvr-camera-batch.ts', 'screens/nvr-encoding-batch.ts', 'screens/nvr-h264-preset.ts', 'screens/plan-area-links-admin.ts',
  'screens/plan-studio6-panel.ts', 'screens/schedule-create-dialog.ts', 'screens/schedule-slot-panel.ts', 'screens/schedule-table-view.ts',
  'screens/system-access.ts', 'screens/system-automations.ts', 'screens/system-brand-logos.ts', 'screens/system-calendar-sync.ts',
  'screens/system-calendars.ts', 'screens/system-cast.ts', 'screens/system-doors.ts', 'screens/system-fleet-report.ts',
  'screens/system-local-users.ts', 'screens/system-look.ts', 'screens/system-messaging-accounts.ts', 'screens/system-multimedia-players.ts',
  'screens/system-notifications.ts', 'screens/system-palette-editor.ts', 'screens/system-plan-view.ts', 'screens/system-presence-places.ts',
  'screens/system-schedules.ts', 'screens/system-security-cameras.ts', 'screens/system-security-privacy-masks.ts', 'screens/system-setup.ts',
  'screens/system-tabs-mode.ts', 'screens/system-tabs.ts', 'screens/system-tickets.ts', 'screens/system-wall.ts', 'screens/system-xs-options.ts',
  'screens/tickets-board.ts', 'screens/tickets-list.ts', 'screens/tickets-maintenance.ts', 'screens/tickets-rfqs.ts', 'screens/tickets-table.ts',
  'screens/tree-unassigned.ts', 'screens/water/page-accounts.ts', 'screens/water/page-alerts.ts', 'screens/water/page-bills.ts',
  'screens/water/page-customers.ts', 'screens/water/page-meters.ts', 'screens/water/page-settings.ts', 'screens/water/page-usage.ts',
  'screens/wiskey-stations-css.ts', 'styles/media-page.ts', 'styles/settings.ts', 'styles/tech-details.ts',
  'tickets/list-filter-row.ts', 'tickets/list-text.ts', 'tickets/list-toolbar.ts', 'tickets/my-numbers.ts', 'tickets/table-filter-panel.ts',
  'water/styles.ts', 'water/ui.ts', 'xsection/sw-xsection.ts', 'xsection/xs-model.ts',
];

/** The text of a start tag from `<name` on, to its closing `>` - `${...}` expressions (arrow functions hold a `>`) and quotes skipped. */
function startTag(src: string, at: number): string {
  let i = at + 1;
  let depth = 0;
  let quote = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = '';
      continue;
    }
    if (depth === 0 && (c === '"' || c === "'")) {
      quote = c;
      continue;
    }
    if (c === '$' && src[i + 1] === '{') {
      depth++;
      i++;
      continue;
    }
    if (depth > 0 && c === '{') depth++;
    else if (depth > 0 && c === '}') depth--;
    else if (depth === 0 && c === '>') break;
  }
  return src.slice(at, i + 1);
}
const lineOf = (src: string, at: number) => src.slice(0, at).split('\n').length;

test('an icon-only sw-button always carries a label (its accessible name and tooltip)', () => {
  const bad: string[] = [];
  for (const f of ALL) {
    const src = read(f);
    for (const m of src.matchAll(/<sw-button\b/g)) {
      const tag = startTag(src, m.index!);
      if (!/\siconOnly\b/i.test(tag)) continue;
      if (!/\s\.?label=(?!""|'')/.test(tag)) bad.push(`${f}:${lineOf(src, m.index!)}`);
    }
  }
  expect(bad, 'icon-only sw-button without label=').toEqual([]);
});

test('a native button with only an icon in it has an accessible name', () => {
  const bad: string[] = [];
  for (const f of ALL) {
    const src = read(f);
    for (const m of src.matchAll(/<button\b/g)) {
      const tag = startTag(src, m.index!);
      if (/aria-label=|aria-labelledby=|\stitle=|aria-hidden="true"/.test(tag)) continue;
      const end = src.indexOf('</button>', m.index! + tag.length);
      if (end < 0) continue;
      const body = src.slice(m.index! + tag.length, end);
      if (/<button\b/.test(body)) continue; // not one simple button (a template boundary in between)
      const rest = body
        .replace(/<sw-icon\b[^]*?(<\/sw-icon>|\/>)/g, '')
        .replace(/<svg\b[^]*?<\/svg>/g, '')
        .replace(/<!--[^]*?-->/g, '');
      // anything left - text, an expression, a slot, a child element - may carry the name; only a bare icon is flagged
      if (rest.trim() === '') bad.push(`${f}:${lineOf(src, m.index!)}`);
    }
  }
  expect(bad, 'icon-only <button> without aria-label / title').toEqual([]);
});

test('polished screens: a role="tablist" row walks its tabs with the arrow keys', () => {
  const bad: string[] = [];
  for (const f of POLISHED) {
    const src = read(f);
    for (const m of src.matchAll(/role="tablist"/g)) {
      const tag = startTag(src, src.lastIndexOf('<', m.index!));
      if (!/@keydown=/.test(tag)) bad.push(`${f}:${lineOf(src, m.index!)}`);
    }
  }
  expect(bad, 'tablist without @keydown (use tablistKeydown from components/a11y-keys.ts)').toEqual([]);
});

/** Selectors that colour an icon, a glyph or a ring with the bare state colour (non-text: 3:1 is the bar), with the reason. */
const BARE_OK: Record<string, string> = {
  'screens/devices-tiles-panel.ts | button.master': 'an icon-only ring button: the glyph and the 2 px ring are non-text (3:1)',
  "screens/plan-studio6-panel.ts | .walkrow .star[aria-pressed='true']": 'the star glyph: the bare colour is the fallback line, light-dark() draws the warning ink in light',
  'screens/explore-floors.ts | .floor.on .chev': 'the chevron glyph of the open floor',
  'screens/devices-layout-css.ts | .lay-libIcon': 'a library icon tile',
  'screens/devices-building.ts | .fcard header h2 .ftitle:hover': 'the hover tint of a floor title (at rest it is the heading ink)',
};
const BARE_TEXT = /(^|[^-])color:\s*var\(--sw-(warning|danger|success|accent|shared|stale|forbidden)\)/;

test('polished screens: text is never coloured with a bare state colour (the *-text inks read 4.5:1 in light)', () => {
  const bad: string[] = [];
  for (const f of POLISHED) {
    const src = read(f);
    for (const m of src.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
      if (!BARE_TEXT.test(m[2])) continue;
      const sel = m[1].split('*/').pop()!.trim().replace(/\s+/g, ' ');
      if (/sw-icon|svg|\bi\b|dot|\.ic\b|icon|::before|::after/.test(sel)) continue; // a glyph, a dot or a drawn mark
      if (BARE_OK[`${f} | ${sel}`]) continue;
      bad.push(`${f}:${lineOf(src, m.index!)} ${sel}`);
    }
    for (const m of src.matchAll(/style="[^"]*color:var\(--sw-(warning|danger|success)\)[^"]*">[^<\s$]/g)) bad.push(`${f}:${lineOf(src, m.index!)} inline style on text`);
  }
  expect(bad, 'bare state colour on text - use var(--sw-<state>-text), or exempt an icon in BARE_OK with the reason').toEqual([]);
});

test('shared contracts: popover Escape, the dialog stack, the field names its control, the phone tree sheet', () => {
  const pop = read('components/sw-popover.ts');
  expect(pop).toMatch(/addEventListener\('keydown', this\.onKey\)/);
  expect(pop).toMatch(/e\.key !== 'Escape'/);
  expect(pop).toMatch(/back\.focus\(/);
  expect(read('components/sw-dialog.ts')).toMatch(/OPEN_STACK\[OPEN_STACK\.length - 1\]/);
  expect(read('components/sw-field.ts')).toMatch(/setAttribute\('aria-label', this\.label\)/);
  const keys = read('components/a11y-keys.ts');
  expect(keys).toMatch(/export function tablistKeydown/);
  expect(keys).toMatch(/export function modalKeydown/);
  expect(read('screens/devices-building.ts')).toMatch(/data-tree-sheet\s+@keydown=\$\{\(e: KeyboardEvent\) => modalKeydown\(/);

  // the light-scheme marks the dark review measured (fix/DARK-REVIEW-2342 "not fixed" list): checkbox edge, KPI dot, star, unknown row, toast icon
  for (const f of ['screens/nvr-camera-batch.ts', 'screens/nvr-encoding-batch.ts']) expect(read(f)).toMatch(/\.sel:not\(\[aria-checked='true'\]\) \.box \{\s*border-color: light-dark\(var\(--sw-text-3\)/);
  expect(read('insights/styles.ts')).toMatch(/\.kpi \.dot \{ background: light-dark\(var\(--c-ink\)/);
  expect(read('screens/plan-studio6-panel.ts')).toMatch(/color: light-dark\(var\(--sw-warning-text\), var\(--sw-warning\)\)/);
  expect(read('screens/nvr-camera-batch.ts')).toMatch(/\.row\.unk \.ln \{[^}]*light-dark\(color-mix\(in srgb, var\(--sw-warning-text\) 75%/);
  for (const f of ['screens/system-tickets.ts', 'screens/tickets-rfqs.ts']) expect(read(f), f).not.toMatch(/\.toast\.bad \.ic[^{]*\{\s*color: var\(--sw-danger\);/);
});

test('tokens, light scheme: each state text ink reads >= 4.5:1 on its soft fill and on the surface, in every skin', () => {
  const STATES = ['accent', 'danger', 'forbidden', 'live', 'offline', 'recorded', 'shared', 'stale', 'success', 'unknown', 'warning'];
  const bad: string[] = [];
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    const v = (n: string) => t[n]?.light ?? '';
    const bg = parseColor(v('--sw-bg'));
    const solid = parseColor(v('--sw-surface-solid')) ?? bg;
    if (!bg || !solid) throw new Error(`${id}: no page or surface colour`);
    const surface = parseColor(v('--sw-surface'));
    const beds = { solid, surface: surface ? over(surface, bg) : solid };
    for (const s of STATES) {
      const ink = parseColor(v(`--sw-${s}-text`));
      if (!ink) continue;
      const soft = parseColor(v(`--sw-${s}-soft`));
      for (const [name, bed] of Object.entries(beds)) {
        const r = contrastRatio(ink, bed);
        if (r < 4.5) bad.push(`${id} --sw-${s}-text on ${name}: ${r.toFixed(2)}`);
        if (soft) {
          const rs = contrastRatio(ink, over(soft, bed));
          if (rs < 4.5) bad.push(`${id} --sw-${s}-text on --sw-${s}-soft over ${name}: ${rs.toFixed(2)}`);
        }
      }
    }
  }
  expect(bad).toEqual([]);
});
