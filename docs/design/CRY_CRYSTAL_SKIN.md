# CRY - the Crystal skin and the background setting (2026-10-10)

Branch `pilot/CRY-crystal-skin`, built on `pilot/DU1-design-unification` (c151ae20, the unified token layer). Design ADR for a new
skin and one new product setting; no behaviour or API contract changed otherwise, no migration (the setting is a `settings` row,
the pictures are files).

## 1. The skin

`frontend/src/design/skins/crystal.ts` - "Crystal" / "קריסטל": glassy, luminous, refined. Registered like domus / tesla / bubble
(`skins/index.ts` `SKIN_IDS`, `routers/settings.py` `ui.skin` pattern, `test_ui_skin_and_scheme_settings`).

| | Light | Dark |
|---|---|---|
| Canvas | pearl: cyan bloom top-start, lavender bloom bottom-end, a white glint, over `#f4f8fd -> #e6edf7` | deep indigo: cool-blue and violet blooms over `#0d1424 -> #080c16` |
| Panels | white at 58 % + sheen, `blur(28px) saturate(1.4)`, 1 px luminous rim (`--sw-border` white 82 %), top highlight | `rgba(20,28,46,.64)`, rim white 14 %, highlight white 22 % |
| Solid twins | `#f9fbfe` / `#ffffff` / `#e6ecf5` | `#141c2e` / `#1b2538` / `#263248` |
| Text | `#152238` / `#3e4d66` / `#55637c`, heading `#0e1a30` | `#e9eef8` / `#aeb9cf` / `#8d9ab3`, heading white |
| Accent | sapphire `#1e5bd8` (text `#174cbd`) | luminous `#8ab8ff` (text `#9ec4ff`), inverse text `#0b1020` |
| States | the Domus values (semantic colours stay recognisable across skins) | same |
| Type | 10.5 / 11.5 / 12.5 / 13.5 / 14 / 15.5 / 17.5 / 21 / 27, h1 34 px semibold, tracking -0.8 px | same |
| Radii | 5 / 8 / 10 / 14 / 18 / 22 / 28 / pill | same |
| Motion | 220 ms, spring thumb, hover lift -1 px | same |

27 of the 50 rules: canvas (1), rail / brand / corner / phone bar (3), crystal panels with the performance switches (4), the
building tree kept prominent (5), controls (6), switch and pill tabs (7), floating layers on the solid twin with a sheet blur (8),
tables and headings (9), the solid fallbacks for no `backdrop-filter` and `prefers-reduced-transparency` (10). The material
layer (MD1) is not attached to crystal (`MATERIAL_SKINS` stays bubble + domus); attach it by adding the skin to that list.

Contrast: `unit-design-tokens.spec.ts` (text on the solid twins and on `--sw-bg`, state text on soft fills, the translucent sheet's
alpha floor, the lite tier, the wash cap) passes for crystal in both schemes with no exceptions.

## 2. The background artworks

Two original pictures, drawn in code by `frontend/scripts/crystal-backgrounds.mjs` (SVG sources in `frontend/src/design/backgrounds/`,
deterministic seed), rendered by the bundled Chromium at 2560 x 1440 and exported by `frontend/scripts/export_backgrounds.py`
(Pillow) to `frontend/public/backgrounds/`:

| File | What | Size | Luminance (mean / p5 / p95) |
|---|---|---|---|
| `crystal-day.webp` | "pearl atrium": pale sky, sun bloom top-end, tall glass panes with bright edges on the start side, soft rays, a reflective floor | 22 KB | 0.91 / 0.86 / 0.96 |
| `crystal-night.webp` | "indigo skyline": deep sky, moon and stars, two aurora bands, a skyline silhouette with a few lit windows, its reflection in still water | 21 KB | 0.10 / 0.04 / 0.18 |

No photographs, no third-party or AI-generated assets. The pictures keep the central band calm and sit under the skin's veil
(`--sw-bg-veil`: light 42 % pearl, dark 50 % indigo), so text painted directly on the canvas keeps its contrast; the glass panels
carry their own solid-twin contrast guarantee.

## 3. The setting

- `ui.background` (product setting, `system.configure`, audited as `settings.update`, readable by everyone): `builtin` (default; the
  day picture under the light scheme, the night picture under dark - "auto day / night by the product scheme") | `none` | `custom`.
- `ui.background` in `/me/prefs` (any signed-in user; `null` = follow the installation): the same three values. The personal choice
  wins; it follows the user to every device.
- Custom pictures: `POST /settings/background/{day|night}` (multipart `file`; PNG / JPEG / WebP by content, <= 12 MB, re-encoded as a
  JPEG with the longest side 2560 px, stored at `<data_dir>/ui_backgrounds/<slot>.jpg`), `DELETE` the same, `GET` serves it
  (`Cache-Control: private`). The stamps live in `ui.background_images` (`{ day, night }`, read-only through the settings; the
  frontend appends them as the cache key). A missing slot falls back to the other; both missing falls back to the built-in pair.
- Backup: `services/backup.py` reads the stamps row and adds `ui_backgrounds/<slot>.jpg` to the archive; `ui_backgrounds/` is a
  restorable root (`test_background_pictures_travel_with_a_backup`).
- Frontend: `design/background.ts` resolves (`?bg=` > own > installation) and writes `--sw-bg-image` inline on `<html>` plus
  `data-bg`; `design/apply.ts` calls it on every design change. Only the crystal canvas paints `--sw-bg-image`; the other skins
  ignore the picture (the setting is shown with the note "פועל בסגנון קריסטל").
- UI: הגדרות › כללי › מראה המערכת (`screens/system-design.ts`): the "רקע" row (saved with the card's button, administrators), the two
  picture slots when "תמונות שלי" is chosen (upload / replace / remove, at once, server only), and "הרקע אצלי" (saved at once).
  Strings in `i18n/he.ts` + `i18n/en.ts` (`background.*`). No platform naming.

## 4. Evidence

`docs/design/evidence/cry/`: `<screen>-crystal-<scheme>-<width>.png` for home (with the building tree), devices (an area), security
(live), schedules, settings, light + dark, 1440 + 390; `home-crystal-light-none-1440.png` (background off); the settings card with
the custom slots open. Spec: `frontend/tests/evidence-cry.spec.ts` (demo mode, fixed clock).

## 5. Tests

- `frontend/tests/unit-design-tokens.spec.ts` (crystal in the registry; contrast), `unit-crystal-background.spec.ts` (assets under
  250 KB and original, the resolver, the labels, the skin's fallbacks), `unit-token-lint.spec.ts`, `unit-palettes.spec.ts`.
- `smplwise_vms/backend/tests/test_ui_background.py` (5 tests), `test_ui_settings.py` (the skin list).

## 6. Not done / open

- The material dials (MD1) do not reach crystal; the bubble-only look dials (density, radius, transparency) do not either.
- The custom pictures are one pair per installation (not per user): a personal choice can pick them, not upload its own.
- `ui.background_images` is not patchable through `PATCH /settings` (the upload routes own it); a restore brings the stamps and
  the files together, a partial archive (stamp without file) reads as "no picture" on GET (404) and the settings still say custom.
