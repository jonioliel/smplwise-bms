# CR-HA-WORDING-2443: no platform name outside Settings (guard), console wording, the diagnostics site-location text

Branch `pilot/CR-HA-WORDING-2443` (worktree `C:\cloude\smplwise-hawording`), cut from `origin/release/2438-train` at
`aa20f05ae` (the train head after `git fetch`, 18.11.2026 evening). Covers MASTER_PLAN row `pilot/CR-HA-WORDING-2436`
(code review 06:HA-1, 08:F26) and the small translation row of lead decision 3a of CR-UI-POLISH-2443 (the diagnostics
"site location for the sun" text). By instruction: no entry check queued, nothing run on the runner.

## Scope after the owner's decision

The row was written "only after owner decision O8" (a: replace everywhere / b: replace except installer steps / c: leave in
Settings). The owner answered it as round 32 **Q-DES-10 = c (ג)**: "Home Assistant" stays in the settings screens (it becomes
one data source among several) - recorded in `docs/design/system/DESIGN.md` and the header of `i18n/msg/system-b.ts`. All 65
lines of 06:HA-1 are in settings screens (`system-access`, `-automations`, `-schedules`, `-audit`, `-alarm`, `-diagnostics`,
`-cast`, `-multimedia-players`), so **no settings text is reworded here**. What the row still owes:

1. **The guard** (06:HA-1 "Tests"): `frontend/tests/unit-no-ha-branding-2443.spec.ts`, node only, 4 cases. It parses every
   `src/**/*.ts` with the TypeScript compiler and reads each string and template text (comments never count; `css` templates
   and comments inside a template are skipped) and fails on "Home Assistant" / "Home-Assistant" or the word "HA" outside the
   settings area (`screens/system-*.ts` and `i18n/msg/system-a.ts` / `system-b.ts`). Both checks are case-sensitive, so ids such
   as `homeassistant` (the auth provider type), `<home-assistant>`, `ha.` or `?tab=ha` do not count. Outside Settings, four files
   keep the name on purpose, each listed with the reason and with the names that carry the text out of the file:
   - `i18n/local-identity.ts` - keys `tabSub`, `haBadge`, `suggestAlso`, `si*` (local users / service identity tabs);
   - `api/access.ts` - `SYNC_LABEL`, `ACTION_LABEL` (Settings › Access);
   - `api/setup.ts` - `demoSetupState` (the setup wizard's demo answers);
   - `fixtures/catalog.ts` - `demoRoles`, `demoAudit` (Settings › Access / Audit), and the demo event source code `'HA'`, which
     the events screen shows as "מערכת הבית" (asserted).
   A second case checks that every other file naming one of those carriers is a settings screen, so an operator screen that
   starts to show one of these texts fails too. An allow-list fragment that no longer matches fails (the list only shrinks).
   Current tree: no operator-screen hit (the review's finding that every non-settings screen is clean still holds on the train).
   "Companion" (the platform's phone app, a notification channel name) is not one of the two words and is not checked.
2. **08:F26** - `frontend/src/arx/auth.ts`: the console note on a PKCE refusal now names "the sign-in service" instead of the
   platform. Console only, never on screen; asserted by the guard's fourth case.
3. **The confirm in `system-alarm.ts`** named by the row is already the system's dialog (`confirmDialog`, converted before this
   branch); nothing to do.

## The diagnostics site-location text (lead decision 3a, CR-UI-POLISH-2443)

`screens/system-diagnostics.ts` had no translation yet (held during I18N-EN-SWITCH-2438). Its site-location rows (Settings ›
General › Video and media) now read their text through `tr()` of `i18n/msg/system-a.ts` - the source-text table whose stated
range (`system-access*.ts` … `system-home-screen.ts`, in name order) holds `system-diagnostics.ts`. Nine keys, in a new
`// system-diagnostics.ts` block between `system-design.ts` and `system-home-screen.ts`: the label "מיקום האתר לשמש בתלת־ממד"
-> "Site location for the sun in 3D" (the English the 3D map card's hint of CR-UI-POLISH-2443 already points at), the two home-
location lines, the source options (by the home's location (default) / Manual), the manual row, its hint and the latitude /
longitude labels. Settings screen, so "Home Assistant" stays in both languages where the Hebrew says it (Q-DES-10).

**Hebrew is identical.** `tr()` returns its argument in Hebrew; the only composed line is
`tr('מיקום הבית בהגדרות Home Assistant: {lat}, {lon}', …)` + the unchanged ` · <time zone>` suffix, which fills to the same
text as the former template. The rest of `system-diagnostics.ts` stays untranslated (a later translation row).

Not done: `docs/i18n/GLOSSARY_EN.md` (no new term; avoided a third concurrent glossary hunk with COMBINED-B / -C and UI-POLISH)
and `docs/i18n/MISSING_KEYS_EN.*` (a generated report; regenerating it here would conflict with every translation branch).

## Pixels

None expected: no Hebrew text, style or layout changed (the English interface of the nine keys is not in any baseline). So no
baselines to refresh. If the gate shows a diff on the settings General tab it is a bug of this branch.

## Overlaps (merge order)

- `system-diagnostics.ts`: CR-MODAL-STACK-B-2442, CR-FE-NITS-2442 and the FE-DEAD-* branches touch other hunks (imports near
  line 47, lines 217-717, 1100-2007); this branch adds one import line after `../i18n/settings-cards` and edits 824-845.
- `i18n/msg/system-a.ts`: CR-I18N-COMBINED-C-2442 changes two keys near 830 / 949; this block is inserted before
  `// system-home-screen.ts` (around 642) - no shared lines.
- `arx/auth.ts`: other open branches touch lines 15-298 but not 242-244.

## Tests actually run (workstation, PC loaded; nothing on the runner)

- `npx tsc --noEmit`: clean (exit 0).
- Playwright unit config, `--workers=1`, 11 node-only spec files: **71 passed, 0 failed** - the new
  `unit-no-ha-branding-2443` (4), `unit-diag-tabs-2440` (the settings chunk's source-size budget with `msg/system-a` now imported),
  `unit-settings-rows-2380`, `unit-uxfix-nav-295` (both read `system-diagnostics.ts`), the i18n specs `unit-i18n-core`,
  `-cal-elec-completeness`, `-cal-elec-lint`, `-home`, `-map-wizard-2441`, `unit-nav-labels-2436`, and `unit-arx-pending-tokens`
  (reads `arx/auth.ts`).
- `node scripts/i18n_missing_keys.mjs` (report only, nothing written): `msg/system-a` 1005 keys, **missing 0**; its gap of 2 is
  the two "מחיקה" keys that CR-I18N-COMBINED-C-2442 changes (not this branch).

## NOT_RUN

- Pixel / layout / evidence suites and the page unit specs (`SW_UNIT_PAGES=1`): runner only, not tonight (the 2.43.8 release
  gate holds it). No pixel spec is expected to move; if one does, the candidates are the settings General-tab specs
  (`pixel-*settings*` / `pixel-*diagnostics*` of the "video and media" section) - baselines to refresh on the runner after 2.43.8.
- Entry check: not queued (instruction).
