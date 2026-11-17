# AUDIT30-A-GLASS-BRIDGE - design audit round 30, branch A: the glass bridge (styles only)

Branch `pilot/AUDIT30-A-GLASS-BRIDGE`, cut from `origin/pilot/SYS-AUDIT-QUICKFIX-2437` @ `dd16b8409` (that branch is queued for a
train and already edits `styles/devices-themes.ts` and `components/media-remote-css.ts`; building on it avoids a conflict - merge it
first, or merge this branch alone, which carries it). Plan: `private/design-system-2026-10-27/round30/system-audit/FIXES.md` sections
0, 1, 2 and 13. No version bump, no CHANGELOG entry, no migration, no backend change. Frontend only; nothing in `frontend/src/home/**`
touched; no layout or scroll rule changed.

**File ownership (FIXES section 1, branch A):** the only source file edited is `frontend/src/styles/devices-themes.ts` (owned by A).
`devices-palettes.ts`, `media-glass.ts`, `automations-glass.ts` and `components/media-remote-css.ts` are unchanged. No file of another
branch was needed.

**Owner gates:** A1 is `GATE Q2`. No owner answer was in hand; as FIXES rule 0.3 says, the recommended option (א, one face: Heebo /
the product stack) is assumed. A2 is ungated.

## What changed

| Item | Finding | Change |
|---|---|---|
| A1 (#2, GATE Q2, assumed א) | 22 % of the sampled text on 12 glass screens drawn in the OS face | **Already on the base branch** (SYS-AUDIT-QUICKFIX-2437: `--dv-font: var(--sw-font)`, `--mr-font: var(--sw-font)`). Nothing left to change; re-measured below. |
| A2 (#13) | "two darks, two inks": the glass screens drew their own ink (`#1c1c1e` light / `#f5f5f7` dark) and neutral black-grey panels (`rgba(28, 28, 30, .72)`, solid `#1c1c1e`) beside the product's navy screens | `devices-themes.ts`: a new block for palette `default` when its scheme IS the product's (no `data-devices-own-backdrop`): `--dv-text / -2 / -3: var(--sw-text / -2 / -3)`, `--dv-icon-ring-fg: var(--sw-text)`, `--dv-surface-solid / -2-solid: var(--sw-surface-solid / -2-solid)`, `--dv-border / -strong: var(--sw-border / -strong)`, `--dv-backdrop: var(--sw-canvas)`; the translucent `--dv-surface` / `--dv-surface-2` are `color-mix(in srgb, <solid twin> N%, transparent)` at the palette's own glass alpha (64 / 50 % light, 72 / 62 % dark). Shape knobs (blur, radii, gaps, shadows) unchanged. |

How the bridge avoids a cycle: section 1 of the same file writes `--sw-text: var(--dv-text)` & co. on the same host (so nested shared
components follow the knobs). A knob that reads `var(--sw-text)` there would be a custom-property cycle (both invalid). The new block
therefore resets those names with `inherit` (the parent's product value) before reading them - the same move `mediaBubbleKnobs`
(`media-glass.ts`) already makes for the bubble skin. `--sw-surface-solid`, `--sw-surface-2-solid` and `--sw-canvas` are never bridged,
so they are read directly. FIXES wrote the knobs as plain `--dv-text: var(--sw-text)`; as written that is the cycle, so this is the
working form of the same instruction (recorded as a deviation, not a change of intent).

Where the bridge does NOT apply (deliberately):
- a glass host with its own backdrop (`devices.scheme` / `devices.glass_scheme` differs from the product's scheme, BGFIX-293): there the
  product tokens are the OTHER scheme's, so the palette keeps its own literal light / dark blocks (which also stay the static values
  `unit-muted-contrast` and the settings swatches read);
- the non-default palettes (`sand`, `forest`, `graphite`, `devices-palettes.ts`): unchanged, as FIXES asks;
- a media host in the bubble skin (`data-skin="bubble"`): it keeps its own full bridge (`mediaBubbleKnobs`).

## Measured (the audit's probe, run from a copy of the folder)

Probe: a copy of `round30/system-audit/tools` in the session scratchpad, `shoot.mjs` extended (copy only) with a palette sample: the
viewport's corner pixels and the first glass host's resolved knobs. Builds served by `vite preview` on private ports (base build on
4471, this branch on 4472), demo fixtures, classic skin, 1440x900, light and dark, the 12 glass routes of A1 plus `elec-meters`.

Finding 2 (font family of the sampled text nodes, the 12 routes, desktop, light + dark):

| Build | Heebo | `-apple-system` |
|---|---|---|
| audit build 2.43.1 (`data/measure.json` of the audit) | 372 | **1,942** |
| base `SYS-AUDIT-QUICKFIX-2437` | 2,314 | 0 |
| this branch | 2,314 | 0 |

`analyze.mjs`: no `-apple-system` in the family column for any of the 12 (audit build: all 12). Text fit: the 12 routes re-shot at
375x812 dark on this branch; no new truncation seen (the chip rows that scroll sideways did so before).

Finding 13 (glass host knobs, resolved, identical on all 12 glass routes; product = `sw-app`'s token):

| | before (base) | after (this branch) | product |
|---|---|---|---|
| ink light / dark | `#1c1c1e` / `#f5f5f7` | `#1f2b42` / `#e4e9f3` | `#1f2b42` / `#e4e9f3` |
| solid surface light / dark | `#fbfcfe` / `#1c1c1e` | `#ffffff` / `#131a2a` | `#ffffff` / `#131a2a` |
| glass panel dark | `rgba(28, 28, 30, .72)` (blue - red = 2: neutral) | `#131a2a` at 72 % (blue - red = 23: navy) | - |
| hairline light / dark | `rgba(60, 60, 67, .12)` / `rgba(255, 255, 255, .13)` | `#d9e0ea` / `#253148` | same |
| canvas corner, board vs meters, dark | `rgb(7, 11, 20)` / `rgb(6, 10, 19)` | `rgb(7, 11, 20)` / `rgb(6, 10, 19)` | - |

The canvas was already the same behind both screens on the base (BGFIX-293 makes the glass page transparent); what changed hue between
the meters and the board was the glass panels and the ink, which now match. Screenshots: `docs/design/evidence/AUDIT30-A-GLASS-BRIDGE/`
(`before-2431-tickets-board-dark-1440.jpg` from the audit, `tickets-board-{dark,light}-1440.png` this branch).

## Tests

New:
- `frontend/tests/unit-glass-bridge-audit30a.spec.ts` (Node): reads the bridge block from `devices-themes.ts` (every knob maps to its
  product token, no colour literal, the translucent surfaces are `color-mix` of the solid twins), the cycle guard (every `--sw-*` the
  block reads that section 1 writes from a knob is `inherit` in the block), and muted-text contrast `--sw-text-2 / -3` >= 4.5:1 on the
  bridged beds for all 7 skins x 2 schemes, plus "the dark glass panel is not neutral when the product surface is tinted".
- `frontend/tests/evidence-audit30a-glass-bridge.spec.ts` (browser, desktop, demo fixtures): on `#/tickets/board`, `#/devices/schedules`,
  `#/multimedia/players`, `#/system/notifications`, light and dark: the host's resolved knobs equal the product tokens, the host draws in
  the product ink, the dark panel is navy (blue - red >= 8), the panel stays translucent; and the canvas corner behind the board equals the
  one behind the electricity meters. Screenshots into the evidence folder.
- `frontend/tests/pixel-audit30a-glass-bridge.spec.ts`: `tickets board dark is pixel-stable` (fixed clock: the demo board's "today" strip
  and "updated N h ago" are relative to now), desktop and mobile, Linux baselines from the runner.

| Command | Where | Result |
|---|---|---|
| `npm run build` (tsc --noEmit + vite build) | workstation | PASS |
| `npx playwright test -c playwright.unit.config.ts tests/unit-glass-bridge-audit30a.spec.ts` on the BASE `devices-themes.ts` | workstation | 3 failed (as intended) |
| the same on this branch | workstation | 3 passed |
| `unit-glass-bridge-audit30a`, `unit-muted-contrast`, `unit-dark-muted-contrast`, `unit-palettes`, `unit-page-background`, `unit-glass-scheme`, `unit-design-tokens`, `unit-badge-tab-contrast-2437`, `unit-menu-lint` | workstation | 55 passed |
| `evidence-audit30a-glass-bridge.spec.ts --project=desktop` against the BASE build (4471) | workstation | 9 failed, 1 passed (8 knob / ink / navy failures as intended; 1 page-load timeout; the light canvas check passes on the base too - see "Measured") |
| the same against this branch (4472) | workstation | 10 passed |
| `layout-page-background`, `evidence-dark-seg-all-2380`, `evidence-sys-audit-quickfix-2437`, `evidence-palettes` `--project=desktop` (4472) | workstation | 32 passed, 4 skipped |
| `pixel-audit30a-glass-bridge.spec.ts --project=desktop` `-u`, then without | workstation (win32, throwaway baseline, not committed) | 1 passed, 1 passed |

## Pixel baselines (runner, from this branch only)

`private/runner/run_smart.py preview pilot/AUDIT30-A-GLASS-BRIDGE <specs> -u --workers=1 --machine runner`, run from this worktree (the
copy-back lands here; the main checkout `C:\cloude\smplwisebms` was checked clean afterwards):

| Run | Commit | Result |
|---|---|---|
| `tests/visual-matrix.spec.ts tests/pixel-audit30a-glass-bridge.spec.ts -u` | `f57dcd44a` | 78 passed; 3 new baselines written (`tickets-board-dark-{desktop,tablet,mobile}-linux.png`), 0 visual-matrix baselines rewritten (see Known limits) |
| the same without `-u` (proof) | `f2c3c7cc7` | **78 passed**, rc 0 |
| the other 32 specs with `*-linux.png` baselines, all projects, `-u` | `f2c3c7cc7` | 473 passed, 364 skipped (structural smokes / other skins), **0 baselines rewritten** (all matched), so no second run |

The runner entry check (`~/gate2/branch_check.sh pilot/AUDIT30-A-GLASS-BRIDGE`) is queued; its verdict is not part of this note.

## Known limits

- **The existing pixel baselines cannot see this fix.** The hue shift of the dark surfaces (panel `(22, 23, 27)` -> `(16, 22, 36)` over
  the canvas, ink `#f5f5f7` -> `#e4e9f3`) is inside Playwright's default per-pixel threshold (0.2): the `-u` run on the runner rewrote
  none of the 75 visual-matrix baselines, and locally a baseline taken on the base build passed against this branch. The new pixel test
  therefore uses `threshold: 0.02` (base build: 20,983 px different, fails; this branch: stable on two reruns). Other pixel specs keep
  their own tolerance; tightening them is branch J's call (the ratchet / guard branch).

- The tracks (`--dv-surface-3`: segmented-control groove, progress rails), `--dv-neutral-soft`, `--dv-overlay`, the icon-ring fills and
  the shadows stay the glass palette's own neutrals - FIXES lists only ink, solids, borders and backdrop. In dark the segment tracks on the
  service-calls board still read grey-neutral next to the navy panels (visible at 375 px). Bridging them touches the DARK-SEG-ALL-2380
  thumb / track contrast rule; left for the owner (question in the report).
- The remote's own palette (`--mr-*`, `media-remote-css.ts`) and the media `--mm-*` knobs are unchanged (not in A2).
- Only the 12 routes of A1 plus the meters were measured; other glass hosts (the notification centre, the automation builder, the
  media dialogs) follow the same block but were not shot one by one.
- With `devices.scheme` / `devices.glass_scheme` set against the product's scheme, the glass keeps its own palette (by design).

## Rollback

Revert the merge commit. No data, setting or migration is involved.
