import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SKIN, SELECTABLE_SKIN_IDS, SKIN_IDS, SKINS, isFrozenSkin } from '../src/design/skins';
import { CHIP_ON_CSS, skinTable, tokensCss } from '../src/design/css';
import { CHIP_ON_MODES, DEFAULT_CHIP_ON, isChipOn } from '../src/design/apply';
import { brandTokens } from '../src/design/brand';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';

// DOMUS-DEFAULT-2439 (owner round 33). Node only.
//   Q-DES-1 a: Domus is the default skin (frontend DEFAULT_SKIN and the backend default of ui.skin agree); classic and the others stay selectable.
//   Q-DES-3 b: the selected chip is the strengthened light blue - a deeper ink, an accent ring, a check mark - and a setting
//              (ui.chip_selected: strong | soft | filled | dark). WCAG 2.x, every skin, light and dark:
//              ink on the field >= 4.5:1 (1.4.3), the ring against what the chip sits on >= 3:1 (1.4.11).
// The in-browser receipt of the same two numbers on real screens is tests/evidence-polish2-295.spec.ts ("the choice buttons are legible").

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
const flat = (f: string) => read(f).replace(/\s+/g, ' ');
const PY = readFileSync(path.resolve(HERE, '../../smplwise_vms/backend/smplwise/routers/settings.py'), 'utf8');

type Scheme = 'light' | 'dark';
function resolver(id: (typeof SKIN_IDS)[number], scheme: Scheme) {
  const t = skinTable(id);
  return (name: string): RGBA => {
    const raw = t[name]?.[scheme];
    const c = raw ? parseColor(raw) : null;
    if (!c) throw new Error(`${id}/${scheme}: cannot resolve ${name} (${raw})`);
    return c;
  };
}

test('Q-DES-1: Domus is the default skin on both sides; every other live skin stays selectable; nothing is migrated', () => {
  expect(DEFAULT_SKIN).toBe('domus');
  expect(PY).toMatch(/^ {4}"ui\.skin": "domus",$/m);
  expect([...SELECTABLE_SKIN_IDS]).toEqual(['classic', 'domus', 'tesla', 'crystal', 'infra', 'soft']);
  expect(SKINS.domus.stage).toBe('stable');
  // a stored row wins over the default (read_settings: stored.get(key, default)); the unknown-value fallback is the same default
  expect(PY).toContain('value = stored.get(key, default) or default');
  expect(PY).toContain('else DEFAULTS["ui.skin"]');
  // the runtime falls back to the same constant (no second literal)
  expect(flat('design/apply.ts')).toContain("let installation: Installation = { skin: DEFAULT_SKIN, scheme: 'light', motion: 'auto', rail: 'auto', enter: 'on', chip: DEFAULT_CHIP_ON };");
});

test('Q-DES-3: the setting - the same four values, the same default, in the frontend, the token CSS and the backend', () => {
  expect([...CHIP_ON_MODES]).toEqual(['strong', 'soft', 'filled', 'dark']);
  expect(DEFAULT_CHIP_ON).toBe('strong');
  expect(isChipOn('soft')).toBe(true);
  expect(isChipOn('blue')).toBe(false);
  expect(PY).toContain('"ui.chip_selected": "strong",');
  expect(PY).toContain('ui_chip_selected: str | None = Field(default=None, pattern="^(strong|soft|filled|dark)$", alias="ui.chip_selected")');
  expect(PY).toContain('if out.get("ui.chip_selected") not in ("strong", "soft", "filled", "dark"):');
  // one block per alternative, none for the default (the default is the fragment's own fallbacks)
  for (const m of CHIP_ON_MODES.filter((x) => x !== DEFAULT_CHIP_ON)) expect(CHIP_ON_CSS).toContain(`:root[data-chip-on="${m}"]`);
  expect(CHIP_ON_CSS).not.toContain('data-chip-on="strong"');
  expect(tokensCss()).toContain(CHIP_ON_CSS);
  // only the default shows the check
  expect(CHIP_ON_CSS.match(/--sw-chip-on-check:none/g)?.length).toBe(3);
  // the design layer writes the attribute, the settings card offers the four, the shell applies the stored one
  expect(flat('design/apply.ts')).toContain("if (root.getAttribute('data-chip-on') !== installation.chip) root.setAttribute('data-chip-on', installation.chip);");
  const card = flat('screens/system-design.ts');
  expect(card).toContain('data-chip-on-row');
  expect(card).toContain("'ui.chip_selected': this.draftChip");
  expect(flat('shell/sw-app.ts')).toContain("ps['ui.chip_selected']);");
});

test('Q-DES-3: one fragment draws the selected chip - sw-chip and every local chip read it; no skin repaints it', () => {
  const s = flat('components/sw-chip.ts');
  const frag = flat('styles/chip-selected.ts');
  expect(frag).toContain('background: var(--sw-chip-on-bg, var(--sw-accent-soft));');
  expect(frag).toContain('color: var(--sw-chip-on-ink, var(--sw-accent-text-strong));');
  expect(frag).toContain('border-color: var(--sw-chip-on-ring, var(--sw-accent));');
  // CSS only: a style module and a node spec load it without a component
  expect(read('styles/chip-selected.ts')).not.toMatch(/customElement|LitElement|from '\.\.\/components/);
  expect(s).toContain(':host([selected]) button { ${chipSelected} }');
  // the check: an icon in sw-chip, a ::before fragment for the local chips, both switched off by the same knob
  expect(s).toContain('${this.selected ? html`<sw-icon class="ck" name="check" size=${12} aria-hidden="true"></sw-icon>` : \'\'}');
  expect(s).toContain('.ck { display: var(--sw-chip-on-check, inline-flex);');
  expect(frag).toContain('display: var(--sw-chip-on-check, inline-block);');
  // the selected chip does not lift on hover (the skins lift every chip): the component's rule outranks the skin sheet
  expect(s).toMatch(/:host\(\[selected\]\) button\.sw-hit:hover:not\(:disabled\) \{ \$\{chipSelectedHover\} transform: none; \}/);
  for (const id of SKIN_IDS) expect(SKINS[id].rules, id).not.toContain('sw-chip[selected]');
  // the local chips that drew the soft pair by hand now import the fragments
  for (const f of [
    'components/notify-css.ts', 'screens/automation-drawer.ts', 'screens/devices-automations.ts', 'screens/devices-schedules.ts', 'screens/mapping-assistant.ts',
    'screens/multimedia-screens.ts', 'screens/schedule-create-dialog.ts', 'screens/system-automations.ts', 'styles/media-page.ts', 'tickets/chip-selected.ts',
    'tickets/list-toolbar.ts', 'tickets/settings-styles.ts', 'tickets/styles.ts', 'tickets/table-styles.ts',
  ]) {
    const t = flat(f);
    expect(t, f).toContain('import { chipSelected, chipSelectedCheck } from');
    expect(t, f).toContain('{ ${chipSelected} }');
    expect(t, f).toMatch(/::before \{ \$\{chipSelectedCheck\} \}/);
  }
  // a glass screen bridges the deeper ink; where its palette has none, the palette's text ink
  expect(flat('styles/devices-themes.ts')).toContain('--sw-accent-text-strong: var(--dv-accent-text-strong, var(--dv-text));');
});

test('Q-DES-3: strong (default) - ink on the field >= 4.5:1 and the ring >= 3:1 from the panel and from the canvas, every skin, light and dark', () => {
  const rows: string[] = [];
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    for (const scheme of ['light', 'dark'] as const) {
      const v = resolver(id, scheme);
      for (const bed of ['--sw-surface-solid', '--sw-bg'] as const) {
        const ground = v(bed);
        const field = over(v('--sw-accent-soft'), ground);
        const text = contrastRatio(over(v('--sw-accent-text-strong'), field), field);
        const ring = contrastRatio(over(v('--sw-accent'), ground), ground);
        const row = `${id}/${scheme} on ${bed}: ink ${text.toFixed(2)}, ring ${ring.toFixed(2)}`;
        rows.push(row);
        // the ring is asked of the skins that are drawn: the frozen bubble skin reads as domus at runtime (its dark accent is 2.56:1)
        if (!(text >= 4.5) || (!isFrozenSkin(id) && !(ring >= 3))) fails.push(row);
      }
      // the deeper ink is deeper: more contrast on the field than the accent ink it comes from
      const panel = v('--sw-surface-solid');
      const field = over(v('--sw-accent-soft'), panel);
      expect(contrastRatio(over(v('--sw-accent-text-strong'), field), field), `${id}/${scheme} deeper than the accent ink`).toBeGreaterThan(contrastRatio(over(v('--sw-accent-text'), field), field));
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('Q-DES-3: the numbers the owner saw for Domus (round 33 page, option b): ink 7.8 / 7.6, ring 5.7 / 6.7', () => {
  const t = skinTable('domus');
  expect(t['--sw-accent-text-strong']).toEqual({ light: '#143a9e', dark: '#c5d9ff' });
  const num = (scheme: Scheme, soft: string) => {
    const v = resolver('domus', scheme);
    const panel = v('--sw-surface-solid');
    const field = over(parseColor(soft)!, panel);
    return { text: contrastRatio(over(v('--sw-accent-text-strong'), field), field), ring: contrastRatio(v('--sw-accent'), panel) };
  };
  // the page drew the dark field at 24 % of the accent; the skin's own soft token is 20 % - both pass, the token is what ships
  const light = num('light', t['--sw-accent-soft'].light);
  const dark = num('dark', t['--sw-accent-soft'].dark);
  console.log(`domus light: ink ${light.text.toFixed(2)} ring ${light.ring.toFixed(2)}; dark: ink ${dark.text.toFixed(2)} ring ${dark.ring.toFixed(2)}`);
  expect(light.text).toBeGreaterThanOrEqual(7.5);
  expect(dark.text).toBeGreaterThanOrEqual(7.5);
  expect(light.ring).toBeGreaterThanOrEqual(5.5);
  expect(dark.ring).toBeGreaterThanOrEqual(6.5);
});

test('Q-DES-3: the alternatives keep their label >= 4.5:1 (soft, filled, dark), every live skin, light and dark', () => {
  const rows: string[] = [];
  const fails: string[] = [];
  for (const id of SELECTABLE_SKIN_IDS) {
    for (const scheme of ['light', 'dark'] as const) {
      const v = resolver(id, scheme);
      const panel = v('--sw-surface-solid');
      const soft = over(v('--sw-accent-soft'), panel);
      const pairs: [string, number][] = [
        ['soft', contrastRatio(over(v('--sw-accent-text'), soft), soft)],
        ['filled', contrastRatio(v('--sw-text-inverse'), over(v('--sw-accent'), panel))],
        ['dark', contrastRatio(v('--sw-surface-solid'), over(v('--sw-text'), panel))],
      ];
      for (const [mode, r] of pairs) {
        const row = `${id}/${scheme} ${mode}: ${r.toFixed(2)}`;
        rows.push(row);
        if (!(r >= 4.5)) fails.push(row);
      }
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('an installer accent (ui.accent) carries its own deeper ink, light and dark', () => {
  for (const theme of ['light', 'dark'] as const) {
    const t = brandTokens({ accent: '#0a7d5a', toggle: 'default' }, theme, '#ffffff');
    expect(t['--sw-accent-text-strong'], theme).toMatch(/^color-mix\(in srgb, #0a7d5a \d+%, #(000000|ffffff)\)$/);
  }
  expect(Object.keys(brandTokens({ accent: 'default', toggle: 'default' }, 'light', '#ffffff'))).not.toContain('--sw-accent-text-strong');
});
