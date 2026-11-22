import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { segmentedFocusStep, segmentedTabStop } from '../src/components/segmented-logic';

// CR-CMP2-SELECTS-2450 (owner N11, 19.11): the shared segmented control `sw-segmented` - its keyboard rule (node), its contract (the
// source), and the screens that adopted it (no hand-built `.seg` group comes back there). The look is pinned by
// tests/pixel-sw-segmented.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-sw-segmented.spec.ts

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

test.describe('sw-segmented: the focus rule of the arrow keys', () => {
  const all = [true, true, true, true];

  test('left to right: ArrowRight is the next key, ArrowLeft the previous one, both wrap', () => {
    expect(segmentedFocusStep('ArrowRight', 0, all, false)).toBe(1);
    expect(segmentedFocusStep('ArrowRight', 3, all, false)).toBe(0);
    expect(segmentedFocusStep('ArrowLeft', 0, all, false)).toBe(3);
    expect(segmentedFocusStep('ArrowLeft', 2, all, false)).toBe(1);
  });

  test('right to left (the product reads Hebrew): the arrows follow the reading direction', () => {
    expect(segmentedFocusStep('ArrowLeft', 0, all, true)).toBe(1);
    expect(segmentedFocusStep('ArrowRight', 0, all, true)).toBe(3);
    expect(segmentedFocusStep('ArrowLeft', 3, all, true)).toBe(0);
  });

  test('disabled keys are skipped; Home / End go to the first / last enabled key', () => {
    const some = [false, true, false, true, false];
    expect(segmentedFocusStep('ArrowRight', 1, some, false)).toBe(3);
    expect(segmentedFocusStep('ArrowRight', 3, some, false)).toBe(1);
    expect(segmentedFocusStep('Home', 3, some, false)).toBe(1);
    expect(segmentedFocusStep('End', 1, some, false)).toBe(3);
  });

  test('other keys, an empty row and a row with nothing enabled are not ours', () => {
    expect(segmentedFocusStep('Enter', 0, all, false)).toBe(-1);
    expect(segmentedFocusStep('Tab', 0, all, false)).toBe(-1);
    expect(segmentedFocusStep('ArrowRight', 0, [], false)).toBe(-1);
    expect(segmentedFocusStep('ArrowRight', 0, [false, false], false)).toBe(-1);
    expect(segmentedFocusStep('Home', 0, [false, false], false)).toBe(-1);
  });
});

test.describe('sw-segmented: the Tab stop of a roving group (CR-CMP2-SEGMENTED-C-2450)', () => {
  test('the chosen key when it is enabled, else the first enabled key, -1 when nothing is', () => {
    expect(segmentedTabStop(['a', 'b', 'c'], 'b', [true, true, true])).toBe(1);
    expect(segmentedTabStop(['a', 'b', 'c'], 'b', [true, false, true])).toBe(0);
    expect(segmentedTabStop(['a', 'b', 'c'], 'x', [false, true, true])).toBe(1);
    expect(segmentedTabStop(['a', 'b'], 'a', [false, false])).toBe(-1);
    expect(segmentedTabStop([], '', [])).toBe(-1);
  });
});

test.describe('sw-segmented: the contract in the source', () => {
  const src = read('components/sw-segmented.ts');

  test('controlled: a press fires a composed `change` with the value and never moves the thumb itself', () => {
    expect(src).toMatch(/new CustomEvent<SegmentedChange<V>>\('change', \{ detail: \{ value: o\.value \}, bubbles: true, composed: true \}\)/);
    expect(src).not.toMatch(/this\.value\s*=[^=]/);
    // a disabled group / key fires nothing
    expect(src).toMatch(/if \(this\.disabled \|\| o\.disabled\) return;/);
  });

  test('accessible: a named group of toggle buttons (aria-pressed), the arrows move the focus', () => {
    expect(src).toMatch(/role=\$\{radio \? 'radiogroup' : 'group'\} aria-label=\$\{this\.label \|\| nothing\}/);
    // CR-CMP2-SEGMENTED-B-2450: a radio group keeps its radios (role + aria-checked); A11Y-AUDIT-2490 (owner N51): a radio carries no
    // aria-pressed beside aria-checked (axe aria-allowed-attr), a plain group's toggle keys keep aria-pressed
    expect(src).toMatch(/const on = o\.value === this\.value;/);
    expect(src).toMatch(/role=\$\{radio \? 'radio' : nothing\} aria-checked=\$\{radio \? String\(on\) : nothing\}/);
    expect(src).toMatch(/<button type="button" part=\$\{on \? 'key key-on' : 'key'\} class=\$\{cls \|\| nothing\} aria-pressed=\$\{radio \? nothing : on \? 'true' : 'false'\}/);
    expect(src).toMatch(/@keydown=\$\{this\.onKey\}/);
    expect(src).toMatch(/button:focus-visible \{\s*outline: var\(--sw-focus-w, 2px\) solid var\(--sw-focus\);/);
  });

  test('the look is the settings key (POLISH4-WP1) and reads the --sw-seg-* knobs; the chosen key is the dark-safe light pill', () => {
    const settings = read('styles/settings.ts');
    // the same knobs as styles/settings.ts settingsSegStyles, so a glass host that sets them draws the same through the shadow root
    for (const knob of ['--sw-seg-border', '--sw-seg-radius', '--sw-seg-track', '--sw-seg-pad', '--sw-seg-gap', '--sw-seg-btn-radius', '--sw-seg-h', '--sw-seg-divider', '--sw-seg-on-bg', '--sw-seg-on-fg', '--sw-seg-on-shadow']) {
      expect(src, knob).toContain(`var(${knob}`);
      expect(settings, knob).toContain(`var(${knob}`);
    }
    // the chosen key reads either marker (a radio's aria-checked, a toggle key's aria-pressed)
    expect(src).toMatch(/\.seg button\[aria-checked='true'\],\s+\.seg button\[aria-pressed='true'\] \{[^}]*background: var\(--sw-seg-on-bg, var\(--sw-seg-key, var\(--sw-surface\)\)\);[^}]*color: var\(--sw-seg-on-fg, var\(--sw-seg-key-ink, var\(--sw-accent-text\)\)\);/);
    // tokens only: no colour literal
    expect(src.split('static styles')[1]).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  test('rich keys (CR-CMP2-SEGMENTED-C-2450): icon, second line, badge, dimmed; an icon-only key is named by its label', () => {
    for (const f of ['icon?: TemplateResult;', 'sub?: string;', 'badge?: string;', 'badgeAttrs?: Readonly<Record<string, string>>;', 'dimmed?: boolean;']) expect(src, f).toContain(f);
    expect(src).toMatch(/@property\(\{ reflect: true \}\) labels: 'all' \| 'chosen' \| 'none' = 'all';/);
    // a key without an icon always shows its label; `chosen` shows the chosen key's label only
    expect(src).toMatch(/const shown = !o\.icon \|\| this\.labels === 'all' \|\| \(this\.labels === 'chosen' && on\);/);
    // the hidden label names the key and is its tooltip
    expect(src).toMatch(/title=\$\{o\.title \|\| \(shown \? nothing : o\.label\)\} aria-label=\$\{shown \? nothing : o\.label\}/);
    expect(src).toMatch(/<span class="ic" part=\$\{on \? 'icon icon-on' : 'icon'\} aria-hidden="true">/);
    for (const part of ['part="label"', 'part="sub"', 'part="badge"']) expect(src, part).toContain(part);
    // the badge keeps its data-* hooks (the nav size's data-nav-current)
    expect(src).toMatch(/SwSegmented\.hooks\(k\.querySelector\('\.badge'\), o\.badgeAttrs \?\? \{\}\);/);
  });

  test('roving (CR-CMP2-SEGMENTED-C-2450): one Tab stop, the arrows choose as they move, the host still confirms', () => {
    expect(src).toMatch(/tabindex=\$\{this\.roving \? \(i === stop \? '0' : '-1'\) : nothing\}/);
    expect(src).toMatch(/if \(this\.roving && o && o\.value !== this\.value\) this\.press\(o\);/);
  });

  test('touch and motion: a 44 px tall target on a coarse pointer, hover only under a hovering pointer, no motion when reduced', () => {
    expect(src).toMatch(/@media \(max-width: 767px\) and \(pointer: coarse\) \{\s*button::before \{/);
    expect(src).toMatch(/- 44px\) \/ 2\)\)/);
    expect(src).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\s*button:hover/);
    expect(src).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*button \{\s*transition-duration: 0ms;/);
    expect(src).toMatch(/transform: scale\(var\(--sw-press-scale, 1\)\)/);
    // the thumb does not slide (a settings key is pressed tens of times a day): no transform transition on the track
    expect(src).not.toMatch(/\.seg \{[^}]*transition/);
  });
});

/** The screens whose segmented controls moved to sw-segmented: no hand-built `class="seg"` group may come back in them. */
const ADOPTED = [
  'screens/system-look.ts',
  'screens/system-design.ts',
  'screens/system-plan-view.ts',
  'screens/system-brand-logos.ts',
  'screens/system-automations.ts',
  // CR-CMP2-SEGMENTED-B-2450 (every file below has no hand-built group left)
  'calendars/connect-dialogs.ts',
  'calendars/grid-overlays.ts',
  'calendars/resident.ts',
  'calendars/view-approvals.ts',
  'calendars/view-calendar.ts',
  'calendars/view-maint.ts',
  'calendars/view-manage.ts',
  'electricity/elec-account-list.ts',
  'electricity/elec-bill-page.ts',
  'electricity/elec-bills-list.ts',
  'electricity/elec-formula-editor.ts',
  'electricity/elec-settings-calendar.ts',
  'electricity/elec-settings.ts',
  'electricity/elec-wizard.ts',
  'electricity/meter-card-base.ts',
  'electricity/meter-readings.ts',
  'generator/gen-alerts-page.ts',
  'generator/gen-charts-page.ts',
  'generator/gen-live-page.ts',
  'generator/gen-log-page.ts',
  'generator/gen-routing.ts',
  'maintenance/emergency-history.ts',
  'maintenance/emergency-page.ts',
  'maintenance/list-page.ts',
  'maintenance/log-page.ts',
  'maintenance/tags-page.ts',
  'maintenance/task-form.ts',
  'notices/compose-dialog.ts',
  'notices/display-design.ts',
  'notices/display-fit.ts',
  'notices/display-layout.ts',
  'notices/display-saver.ts',
  'notices/display-transit.ts',
  'notices/reads-sheet.ts',
  'screens/system-app-signin.ts',
  'screens/system-building-presence.ts',
  'screens/system-calendars.ts',
  'screens/system-home-screen.ts',
  'screens/system-mapping.ts',
  'screens/system-multimedia.ts',
  'screens/system-notices.ts',
  'screens/system-palette-editor.ts',
  'screens/system-presence.ts',
  'screens/system-quiet-windows.ts',
  'screens/system-schedules.ts',
  'screens/system-tickets.ts',
  'screens/system-timeline-colors.ts',
  'screens/system-update.ts',
  'screens/water/page-accounts.ts',
  'screens/water/page-alerts.ts',
  'screens/water/page-bills.ts',
  'screens/water/page-settings.ts',
  'screens/water/page-usage.ts',
  'temperature/detail.ts',
  'temperature/report.ts',
  'temperature/wizard.ts',
  'tickets/board-settings.ts',
  'tickets/contacts-directory.ts',
  'tickets/costs-tab.ts',
  'tickets/handlers-members.ts',
  'tickets/notify-matrix.ts',
  'tickets/overview-settings.ts',
  'tickets/public-settings.ts',
  'tickets/quote-form.ts',
  'tickets/settings-costs.ts',
  'tickets/settings-dept.ts',
  'tickets/settings-drawer.ts',
  'tickets/settings-message-templates.ts',
  'tickets/settings-table.ts',
  'tickets/ticket-cost-card.ts',
  'tickets/ticket-detail.ts',
  'tickets/work-calendar-card.ts',
  // CR-CMP2-SEGMENTED-C-2450 (rich keys, the glass state strips, the notification settings)
  'access-external/request-dialog.ts',
  'screens/system-nav-size.ts',
  'screens/system-notifications.ts',
  'screens/tickets-board.ts',
  'screens/tickets-handlers.ts',
  'screens/tickets-list.ts',
  'screens/tickets-rfqs.ts',
  'tickets/external-assign.ts',
  // tickets/list-view-switch.ts draws sw-segmented too; its hosts (tickets-list, tickets-board) register it (node unit tests import it)
  'tickets/rfq-new.ts',
  // CR-CMP2-SEGMENTED-C-2450 (glass media, notifications, investigate, schedule editor family, single groups)
  'components/notify-center.ts',
  'components/notify-whatsapp-section.ts',
  'screens/multimedia-screens.ts',
  'screens/multimedia-players.ts',
  'screens/multimedia-edit-panel.ts',
  'screens/multimedia-remote-editor.ts',
  'screens/investigate-history-map.ts',
  'screens/investigate-reviews.ts',
  'screens/schedule-editor.ts',
  'screens/schedule-conditions.ts',
  'screens/schedule-entity-picker.ts',
  // screens/plan-studio6-panel.ts draws it too; its host explore-plan-editor registers it (node unit tests import the panel)
  'screens/infra-report.ts',
  'insights/list-base.ts',
  'screens/explore-presence.ts',
  'screens/devices-tiles-panel.ts',
  'screens/devices-notices.ts',
  'screens/area-quick-sheet.ts',
  'incidents/settings-form.ts',
  'elevators/elevator-settings.ts',
  'components/wk-station-live.ts',
  'components/sw-list-display-settings.ts',
  'components/sw-cast-picker.ts',
  'components/frigate-config-panel.ts',
  'components/frigate-auto-profile.ts',
  'components/camera-source-dialog.ts',
  'shell/sw-user-menu.ts',
  'screens/wiskey-people.ts',
  'screens/wiskey-events.ts',
  // CR-CMP2-SEGMENTED-C-2450 (home settings: real one-of-N choices only - the home .hsw and the row switches stay)
  'screens/home-edit-panel.ts',
  'screens/home-screen-options.ts',
  // the provider strip of system-calendar-sync is a tab strip: sw-tabs (pill) since CR-CMP2-SEGMENTED-C-2450; its other choices are here
  'screens/system-calendar-sync.ts',
  // screens/home-edit-bv1.ts draws it too (registered by home-edit-panel); shell/sw-home-personal.ts's multi-choice row (the summary
  // tiles) is sw-chip-choice multi since CR-CMP2-TABS-2460
  // CR-CMP2-TABS-2460: the tickets overview's department choice (a radio group in a box that scrolls sideways)
  'screens/tickets-overview.ts',
  // CR-HOME-V3-SEGMENTS-2470: the home v3 operator screen (sw-home's seg() serves its screens and the v3 modules, home-p3's seg() phase 3)
  // and the home widgets' edit-bar size choice. The home .hsw and the row switches are not segmented controls and stay (owner N12).
  'home/sw-home.ts',
  'home/home-p3.ts',
  'screens/home-widgets.ts',
];

test('adoption: the adopted screens draw every segmented control with sw-segmented', () => {
  const bad: string[] = [];
  for (const file of ADOPTED) {
    const src = read(file);
    if (/class="seg[\s"]/.test(src)) bad.push(`${file}: a hand-built class="seg" group`);
    if (!src.includes('<sw-segmented')) bad.push(`${file}: no <sw-segmented>`);
    // a file under components/ imports its sibling (./sw-segmented)
    if (!/import '((\.\.\/)+components|\.)\/sw-segmented';/.test(src)) bad.push(`${file}: does not import the component`);
  }
  expect(bad).toEqual([]);
});

// CR-CMP2-SEGMENTED-C-2450: the chip rows that only reused the `.seg` class name are sw-chip-choice (one choice, separate chips)
test.describe('sw-chip-choice: the contract in the source and its adopters', () => {
  const src = read('components/sw-chip-choice.ts');

  test('controlled, a named group of toggle buttons, the arrows move the focus, the data-* hooks land on the chips', () => {
    // CR-CMP2-TABS-2460: a multi row also says which state the press asks for (unit-sw-tabs-2460.spec.ts pins `multi`)
    expect(src).toMatch(/const detail: ChipChoiceChange<V> = this\.multi \? \{ value: o\.value, pressed: !this\.on\(o\) \} : \{ value: o\.value \};/);
    expect(src).toMatch(/new CustomEvent<ChipChoiceChange<V>>\('change', \{ detail, bubbles: true, composed: true \}\)/);
    expect(src).not.toMatch(/this\.value\s*=[^=]/);
    expect(src).toMatch(/if \(this\.disabled \|\| o\.disabled\) return;/);
    expect(src).toMatch(/role="group" aria-label=\$\{this\.label \|\| nothing\}/);
    expect(src).toMatch(/const on = this\.on\(o\);/);
    expect(src).toMatch(/aria-pressed=\$\{on \? 'true' : 'false'\}/);
    expect(src).toMatch(/segmentedFocusStep\(e\.key, from,/);
    expect(src).toMatch(/if \(a\.name\.startsWith\('data-'\) && !\(a\.name in want\)\) c\.removeAttribute\(a\.name\);/);
  });

  test('the look: tokens only, the accent-filled chosen chip, 44 px on a coarse pointer, no motion when reduced, a wrapping row', () => {
    const styles = src.split('static styles')[1];
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
    expect(src).toMatch(/background: var\(--sw-chipc-on-bg, var\(--sw-accent\)\);/);
    expect(src).toMatch(/color: var\(--sw-chipc-on-fg, var\(--sw-text-inverse\)\);/);
    expect(src).toMatch(/@media \(pointer: coarse\) \{\s*button \{\s*min-block-size: max\(44px,/);
    expect(src).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*button \{\s*transition-duration: 0ms;/);
    expect(src).toMatch(/\.row \{[^}]*flex-wrap: wrap;/);
  });

  const CHIP_ADOPTED = [
    'door-windows/event-rules.ts',
    'door-windows/holidays.ts',
    'door-windows/open-for.ts',
    'screens/door-windows.ts',
    'screens/access-external.ts',
    'screens/wiskey-access-diag.ts',
    // CR-CMP2-TABS-2460: the events centre's handling-state and view rows (they were sw-chip rows in a `.seg` span); the personal
    // home panel's summary tiles are a `multi` row
    'screens/investigate-events.ts',
    'shell/sw-home-personal.ts',
  ];
  test('adoption: these screens draw their single-choice chip rows with sw-chip-choice (no hand-built `.seg` row comes back)', () => {
    const bad: string[] = [];
    for (const file of CHIP_ADOPTED) {
      const f = read(file);
      if (/class="seg[\s"]/.test(f)) bad.push(`${file}: a hand-built class="seg" row`);
      if (!f.includes('<sw-chip-choice')) bad.push(`${file}: no <sw-chip-choice>`);
      if (!/import '(\.\.\/)+components\/sw-chip-choice';/.test(f)) bad.push(`${file}: does not import the component`);
    }
    expect(bad).toEqual([]);
  });
});

// CR-CMP2-SEGMENTED-C-2450: a tab strip drawn as segments moves to sw-tabs (pill); sw-tabs carries its data-* hooks and a named warning dot
test('sw-tabs: an item keeps its data-* hooks on its tab, a warning dot can be named; the calendar sync providers use it', () => {
  const tabs = read('components/sw-tabs.ts');
  expect(tabs).toMatch(/attrs\?: Readonly<Record<string, string>>;/);
  expect(tabs).toMatch(/dot\?: boolean \| 'warn';/);
  expect(tabs).toMatch(/role=\$\{it\.dotLabel \? 'img' : nothing\} aria-label=\$\{it\.dotLabel \|\| nothing\} aria-hidden=\$\{it\.dotLabel \? nothing : 'true'\}/);
  expect(tabs).toMatch(/if \(changed\.has\('items'\)\) this\.applyHooks\(\);/);
  const sync = read('screens/system-calendar-sync.ts');
  expect(sync).toMatch(/<sw-tabs variant="pill" group-label=\$\{tr\('ספק'\)\} data-provider-tabs/);
  expect(sync).toMatch(/attrs: \{ 'data-provider-tab': p \}/);
  expect(sync).not.toMatch(/role="tablist"/);
});
