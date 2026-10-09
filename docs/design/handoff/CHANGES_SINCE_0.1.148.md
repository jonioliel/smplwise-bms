# What changed since 0.1.148 (designer view, written 2026-10-09 for product 2.4.2)

One page for a designer who knows the 0.1.148 handoff. Compared: release 0.1.148.1 (`1fab444b`, 2026-09-30) and `main` @ `31fe5d7c`
(2.4.2, 2026-10-08); 1259 commits, 402 changed files under `frontend/src`. Details and file paths are in the three inventories; this page is
the index. Facts were read from the code; nothing was run against a device and no screen was re-shot.

## Design system

- **One token table** `frontend/src/design/tokens.ts`: 214 `--sw-*` names with light AND dark values (0.1.148: 122 names, light only, in
  the now deleted `styles/tokens.css`). 92 names are new, none removed. The whole product has a dark scheme (light / dark / auto, per
  installation and per browser). `TOKEN_CONTRACT.md` §0, §3.
- **Skins**: `classic` (default), `domus`, `tesla`, `bubble`; a skin = token overrides (both columns) + ≤ 50 component rules; bubble also
  restructures home, area, multimedia and ~48 list / settings screens. `TOKEN_CONTRACT.md` §9.
- **Look dials** (`ui.look`, personal override): density, surface, popup, radius, slider, transparency, scale, touch, palette, performance
  (full / lite), material (none / frosted / paper / neon), depth, tint. Ten ready palettes + custom palettes with a contrast-warning editor.
- **Tab presentation**: tabs / hybrid / dropdown per tab group at every width; eight dropdown styles (`sw-dropdown`); phone pair row.
- **Contrast gate**: `frontend/tests/unit-design-tokens.spec.ts` checks ≥ 4.5:1 per skin × scheme (× palette for the wash).
- Unchanged: the `--dv-*` glass knobs and the four device themes, breakpoints, rail presets, z-index scale, LTR media / map / timeline.

## Navigation and areas

- Rail: ראשי · אבטחה · מפה · **מולטימדיה** (NEW) · WisKey · **תשתיות** (NEW); settings still from the user menu.
- Home tab 2 renamed **"קברניט"**: תזמונים · **אוטומציות · סצנות · סקריפטים** (NEW).
- Settings gained **עדכונים, מסכי קיר, אוטומציות, מולטימדיה, תשתיות**, and the security sub-tab **מצלמות**.
- Capability panels (`no_nvr`, `no_media`) replace the NVR-less switch; a presence gate for the phone app; wall display mode for tablets.

## New screens (all listed in `SCREEN_INVENTORY.md`)

| Area | Screens |
|---|---|
| Shell | Notification centre (sheet / page) with deep links; device activity popup; cast pill; restart banner; update markers; 2FA in the account level; bubble phone dock |
| ראשי | Automations / scenes / scripts list + drawer (H7), builder / code editors (H8), media card in an area (H11), bubble area / home (H10), equipment cards |
| אבטחה | Frigate review (S9 rebuilt), cast to screen and Frigate camera control on the single camera (S3), map ↔ wall / playback multi-pick |
| מפה | Curved and glass walls, own floor image alignment, marker clusters, 3D night mode, plan package import / export, architect request |
| מולטימדיה | Screens + TV remote (MM1), players / speakers with queue and library (MM2), groups (MM3), my cast screens (MM4) |
| תשתיות | Electricity meters, accounts (wizard, formula and time-of-use editors, charts), bills (A4 paper / PDF), customers; generator live, alerts, charts, history |
| הגדרות | Updates (G13), wall displays (G14), automations (G15), multimedia incl. cast and announcements (G16), infrastructure incl. generator routing (G17), NVR cameras + batch encoding (G18), look and design (G19), phone app / presence (G20), protected switches (G21); notifications admin rebuilt (G2); several recorders + Frigate control in connections (G8) |
| Standalone | Wall display for fixed tablets (K2) |

## Components

85 custom elements in `components/` (0.1.148: 33) plus wall, map, electricity (22) and generator (6) elements. New families: Bubble
primitives (`sw-dropdown`, `sw-sheet`, `sw-pill`, `sw-vslider`), automations (`sw-block-card`, `automation-card`, `run-trace`,
`scene-capture`, `script-fields-form`), cast, multimedia (cards, remote, player panel, queue, library, dialogs), notifications, Frigate,
recorders, update / restarts, device activity, second factor. Changed: `sw-tabs` (dropdown / hybrid), `sw-drawer` (action slot),
`sw-dialog` (wide), `sw-chip` (disabled), `sw-camera-tile` (still refresh), `sw-live-player`, `sw-timeline` (colour tokens), `sw-icon` (98
icons). `COMPONENT_INVENTORY.md` §1a, §2a, §3a.

## Permissions

34 new permission ids (analytics.*, automation / scene / script, energy.*, generator.*, media.*, notify.manage, nvr.configure, presence.*,
system.update, wall.view); no role added; `nvr.config.stream` removed. New permission-gated variants: `SCREEN_INVENTORY.md` §9a.

## Contradictions and stale statements found during the refresh (recorded, not fixed)

1. `frontend/src/shell/nav.ts` grants the reviews tab to `analytics.read`, a permission no role or backend file defines (roles hold
   `analytics.review`).
2. The Astra brief (2026-10-08, §6 item 4) says the smallest type step is `--sw-fs-xs` = 12 px; in classic it is **11 px** (bubble and
   tesla set 12 px).
3. `docs/design/SKIN_AUTHORING_HE.md` §1-§2 list the skins as classic / domus / tesla (bubble missing); §6 says bubble has 30 rules (it has
   49); its dial table calls palettes "next phase" (shipped in 0.1.155) and lacks surface `none` and the `slider` / `performance` dials. The
   `design/css.ts` header comment has the same omission.
4. `docs/design/DEVICE_THEMES.md` §2 still says the app shell is light only (`tokens.css` with `color-scheme: light`).
5. `sw-floor-glyph` has no usage left in the code.
6. `current/` screenshots are from 0.1.148; a fresh capture of every screen with demo data (1440 / 1024 / 390 × light / dark) was NOT run.
