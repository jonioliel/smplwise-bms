# NOTICEPUSH-295: push on publish for the notice board, and the approved SmplWise logo on the remaining surfaces

Branch `pilot/NOTICEPUSH-295`, cut from `origin/release/2180` (`5bc8d0add`, v2.17.0 + notice-board slices A, B, E, the add-notice fix and the
logo-strip fix). Two independent slices, two commits. No migration. Everything stays behind `notices.enabled` (OFF) and the add-on option
`notice_boards` (false). No real notification or network send in any test.

## Slice F - the notice is a source in the notification pipeline (CR-NOTICE106 section 7, slice 2; gap rows N4 and S3)

### Behaviour

- Publishing a notice can send it **once** to its audience through the CR-018 pipeline: source `notice.published`, category `building`
  ("הודעות לבניין"), recipient rule `notice`, subject kind `notice`. Title = the notice title, body = its first 160 characters, link
  `#/devices/notices`. No person and no audience is named in the payload. The signal is emitted inside the publish transaction with the
  dedupe key `notice:<id>:<push_generation>`; the notifier thread sends after the commit through each recipient's own channels
  (inbox always, web push, the phone app, WhatsApp when it is on). Channels by default: inbox, web push and the app on; e-mail off (the
  administrator may turn it on in the policy screen like for any source). The source is listed in the notification policy screen only
  while the notice board is on.
- **Recipients** = `audience.resolve_users` (the same function as the compose preview count and the reading test), then the pipeline's own
  visibility ceiling: the user is in the notice's audience, or holds `notices.manage` (so a manager sees the sent item in the deliveries
  screen). A TV-only notice (empty audience) and an audience nobody is in push nobody (`recipients: 0`, no row).
- **Resolved** when the notice is archived (at once, in the archive route) and by the hourly notices janitor when it has ended or was
  deleted (`push.resolve_ended`), so the inbox never keeps a dead notice as unread.
- **Once**: only a draft publishes, and editing a published notice never pushes again. There is no re-send route in this slice
  (`POST /notices/{id}/push` of the CR stays unbuilt; `push_generation` is kept at 0).
- **Whether a publish pushes**: the author's tick wins (`push: true` / `false`). Without a tick `notices.push_default` decides:
  `by_severity` (the default; only a critical notice), `always`, `never`. An ordinary notice therefore never pushes unless the author
  ticks it. An explicit `push: true` needs `notices.push` (403 `forbidden`, audited `notices.push` denied, nothing created or published);
  the installation's default is the administrator's policy and needs nothing from the author. A draft remembers a tick (`push_requested`
  = 1); publishing it later without a body uses that tick, otherwise the default.
- A failing pipeline never blocks the publish: the notice is published and the answer says `push.error = "emit_failed"`.
- Audit: `notices.publish` as before, plus `notices.push` with `{recipients, sent}` (counts only) when a push was wanted.

### API

`POST /notices` accepts `push: bool | null` (with `publish: true` it decides this publish; without, it is remembered on the draft) and answers
`push: {requested, sent, recipients}` when it published. `PATCH /notices/{id}` accepts `push` for a draft. `POST /notices/{id}/publish`
accepts an optional body `{push}` and always answers `push`. `GET /notices` -> `defaults.push_default`. A manager's notice carries
`push_requested` and `pushed_at`.

### UI

- Compose dialog (`frontend/src/notices/compose-dialog.ts`): the checkbox "שליחת התראה לנמענים בפרסום" with the hint "פעם אחת, בערוצים שכל
  נמען בחר". Its value before the author touches it follows the defaults card: under "לפי חומרה" an urgent notice is ticked and an
  important one **suggested** (ticked), an ordinary one is not; "תמיד" / "אף פעם" override. Disabled (and unticked) for a TV-only
  audience and for a writer without `notices.push` (then nothing is sent from the dialog and the server's default applies); not offered for
  an already published notice. The success message says how many recipients the push reached.
- Defaults card (`frontend/src/screens/system-notices.ts`, one added row): "התראה בפרסום" = לפי חומרה / תמיד / אף פעם.
- Notification centre (`api/notifications.ts`, `notify-logic.ts`, `system-notifications.ts`): the category "הודעות לבניין", the recipient
  rule label "קהל היעד של ההודעה" and the source row (client-side visibility is trusted for the `notice` kind: the server filters).

### Answer to the owner: does a push refresh the notice-board TV screens?

**No - and it does not need to.** A TV never receives a push. The TV page (`frontend/src/notice-tv/main.ts`) **polls** its board feed
`GET /api/v1/notices/display/<slug>` every **30 seconds** (`POLL_MS = 30_000`, `tv-logic.ts`) with `If-None-Match`; the server answers
**304** while the feed's version is unchanged and **200** with the new feed otherwise. The version (`board.version`, the ETag) is
`sha256(max(stamps) | payload)` cut to 12 hex digits, where the stamps are the board's `updated_at`, each active notice's `updated_at`
and the start / end instants of its notices that have passed, and the payload is the whole feed (notices, display settings, weather, news,
building-status chips, logos, the remote-control command). Publishing a notice tagged to a board runs `touch_boards_of` (board
`updated_at` = now), so the version changes at once; the TV sees it on its next poll: **at most 30 seconds after publish** (a notice that
starts later changes the version when its start passes). A changed version triggers a re-render; a new urgent notice takes over the screen
on that render, an ordinary one joins the rotation (default 12 s per notice, `rotate_s`). Three missed polls (about 90 s) mark the board
"stale"; the weather / news / chips inside the feed refresh on the same poll (news server cache 15 minutes). So the push (phones, inbox)
and the TV refresh are independent: the push reaches people through the notification channels, the TV picks the notice up from the feed
within 30 s whether or not a push was sent.

### Tests (slice F)

- Backend `smplwise_vms/backend/tests/test_notices_push_295.py` (15): the decision table; an ordinary notice does not push unless ticked;
  critical pushes by default and can be unticked; the defaults card always / never and the tick wins; recipients are the audience only;
  a TV-only notice pushes nobody; notification visibility (audience and managers only); the source is listed only while the module is on
  (channels app on, e-mail off); an explicit tick needs `notices.push` (403 audited, nothing created, default still works); a draft
  remembers the tick; sent once and edits never push again; archive resolves; the janitor resolves an ended notice; a failing
  pipeline does not block the publish; the push text.
- Frontend unit `tests/unit-noticepush-295.spec.ts` (3); evidence specs added to `tests/evidence-notices.spec.ts` (3): the checkbox
  follows the severity default and the tick is sent, TV-only disables it, a writer without `notices.push` sends no tick, the defaults card
  select.

## Slice L - the approved SmplWise logo on the surfaces LOGOFIT-295 left

LOGOFIT-295 replaced the mint logo in `sw-brand.ts` only. The artwork is now the approved mockup's (`#sw-mark`, `#sw-word`,
`#sw-word-dark` of `logos-mockup-v3.html`: blue tile `#2767ed`, white S, `#8fe1ff` dot; light "Smpl" grey `#5e6d88` + "Wise" `#2767ed`; dark
"Smpl" `#ffffff` + "Wise" `#8fb2ff`; Heebo) on every remaining surface that drew the mint PNG.

### Changed

| Surface | Before | Now |
|---|---|---|
| Notice-board TV bundle (`frontend/src/notice-tv/main.ts`, `tv.css`) | `smplwise-logo.png` inlined as a data URI | inline SVG from the new `frontend/src/design/sw-logo-art.ts` (`swWordSvg(dark)`): day / light file in the day theme, dark file in the night theme and the always-dark take-over; box = the approved TV mock-up's footprint 148 x 40 (portrait 132 x 36), the old 190 px picture box is gone |
| Kiosk wall header (`frontend/src/screens/kiosk-wall.ts`) | `<img src=brand/smplwise-mark.png>` | `<sw-brand kind="product" mark scheme="dark" .h=24>` (the existing component, no second copy) |
| App tab icon (`frontend/index.html`) | `brand/smplwise-mark.png` (mint) | `brand/smplwise-mark.svg` + the PNG as fallback |
| `frontend/public/brand/smplwise-mark.png`, `smplwise-logo.png` | mint artwork | mark re-rendered from the approved artwork (256x256, still used as the tab-icon fallback and by a test fixture), new `smplwise-mark.svg`; `smplwise-logo.png` deleted (nothing referenced it any more), as were the unused `productLogoUrl()` / `productMarkUrl()` |
| Backend PDF reports | the word "SmplWise" as bold text in the header of the **building report** and the **temperature / HACCP report** | the approved wordmark (light) as the bundled picture `smplwise_vms/backend/smplwise/assets/bill/brand/smplwise-word.png` (944x256), reached through ONE new exact URL `bill-brand:smplwise-word.png` in the sandboxed `LockedFetcher` (everything else stays refused); alt text "SmplWise" |
| `frontend/notice-tv.html` | three unused `sw-mark` / `sw-word` / `sw-word-dark` symbols (an old copy with other colours) | removed |

The rasters are rendered by `scripts/brand/render_smplwise_logo.py` from the single constant `SW_MARK_INNER` in `sw-logo-art.ts` (mark by
MuPDF, the word with the bundled Heebo 700 - the heaviest weight the application ships; the mockup asks for 800), so a raster cannot
drift from the SVG.

### Deliberately left

- `frontend/src/components/sw-brand.ts`: untouched (LOGOFIT-295). Its constants and the new `sw-logo-art.ts` are the same drawing; a unit
  test keeps them identical. A follow-up may let `sw-brand` import the constant.
- PWA / home-screen icons (`frontend/public/icons/arx-*.png`, `arx.svg`) and the Android / iOS launcher icons under `mobile/`: they are the
  separate "A" Arx app icon, not the mint SmplWise logo.
- The bill PDFs (electricity / water) and the fpdf2 plain-text fallbacks: they carry only the text "הופק ב-SmplWise Arx" in the footer and
  the installation's own logo, no SmplWise artwork. `smplwise_vms/www/` (built output, incl. `www/brand/*.png`) is regenerated by the
  integrator, not here.
- `docs/` mockups and archived design baselines still show the old art as history.
- Finding: the backend PDF assets never contained the mint PNG; the old PDF "logo" was only text, so the PDF change above adds the
  approved picture rather than replacing a wrong one. If the owner prefers the text, revert `building_report.py` / `temperature_report.py`
  (two lines) - the fetcher change is harmless alone.

### Tests (slice L)

- Backend `tests/test_logo_mockup_295.py` (3): the bundled rasters are the mockup tile blue (not mint), light / dark word colours, the PDF
  fetcher serves exactly the one brand URL and refuses traversal, other names, files, http and data URLs. One assertion added to each of
  `test_insight215_report.py` and `test_infra_temperature_report.py` (the report HTML carries the brand picture).
- Frontend unit `tests/unit-swlogo-295.spec.ts` (4): same artwork as `sw-brand.ts`, colours light / dark, alt handling, the moved surfaces no
  longer reference the mint files. `tests/evidence-brand-tv.spec.ts` updated (the product logo is an SVG, light file by day, dark file on the
  take-over).

## Pixel baselines

No committed pixel baseline contains the notice-board TV or the kiosk wall header (checked: `*-snapshots` directories). Expected to
change when the runner next draws them: `pixel-notice-tv-mock.spec.ts` compares the product TV live against the approved TV mock-up and
should get closer to it (the mock-up draws this logo; the Smpl / Wise colours differ slightly from the mock-up's own `#1e2e47` / `#9dbcff`,
the owner's spec of 24.10 was followed); evidence screenshots of the TV and the kiosk wall. Nothing refreshed here.

## Open questions

1. Re-send ("שליחה חוזרת", `notices.push`, new generation) - not built; wanted in a later slice?
2. Under "לפי חומרה" an important (alert) notice is only **suggested** (the checkbox is ticked in the dialog, the server default does not
   send it). Should the server default send it as well?
3. A critical notice written by someone without `notices.push` is pushed by the installation's default. Intended (policy of the administrator)
   or should it need the permission too?
4. PDF header: keep the new picture, or the plain text?
