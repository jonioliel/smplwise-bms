# CR-TV-FONTS-ESCAPE-2443 - TV board: escape every feed value (08:F05), lobby fonts per style family (08:F04)

Branch `pilot/CR-TV-FONTS-ESCAPE-2443`, cut from `origin/release/2438-train` at `5bcea468d` (merge of FIX-2438-REDS, newest head
after `git fetch` on 18.11 evening). Code-review plan row `pilot/CR-TV-FONTS-ESCAPE-2436` (MASTER_PLAN ~line 306), REMAINING_WORK G7.

## 1. Security first: escaping (review 08:F05)

The TV page builds its markup by string concatenation from a feed and a bus-times digest that are cast (`as Feed`, `as TransitDigest`),
never validated, and `esc()` left `'` alone. The page CSP (`script-src 'self'`) blocks script, so this was defence in depth, not an open hole.

**Failing tests first** (run on the base, before any fix):
- `frontend/tests/unit-notice-tv-escape-2443.spec.ts` (Node, 5 tests): every pure builder (hx-parts, the ticker item, the classic and V2
  bus-times panels in every state) with the hostile string `"'><x-pwn data-pwn="1" data-pwn2='1'>` in every field, numbers included.
  Base: **5 failed** - e.g. `sidePanel` produced `data-bus-state=""'><x-pwn data-pwn="1" ...>` (a real element from the data), `v2Panel`
  the same, `bmore` `data-n`, and `esc()` did not escape `'`.
- `frontend/tests/notice-tv-hostile-2443.spec.ts` (browser, 22 tests: classic templates 1-3 / modes / band / bus column and strip / forecast
  days, V2 landscape and portrait, and all eight styles with and without the urgent take-over; a hostile feed + digest + announcement).
  Base: 18 of 20 executed tests showed injected `<x-pwn>` elements (weather temperature `w.now.t` / `x.t`, notice `severity` in `data-sev`,
  announcement `language` in `lang="..."` in both the classic overlay and the styles' announcement). The two V2 tests timed out on a wait
  selector of the spec (fixed afterwards: `.b2hd`), so V2 was not shown red on the base; the run stopped at concierge (worker crash,
  workstation load) - the remaining styles were not run on the base.

**Fix** (`82ca61291`): `esc()` escapes `'` (`&#39;`); new `num()` prints a finite number exactly as the old concatenation and escapes
anything else; every non-literal value in `main.ts`, `skin-board.ts`, `hx-engine.ts`, `hx-parts.ts`, `transit-view.ts`, `v2-transit.ts` goes
through `esc()` / `num()`; the announcement overlay (`announce/screen-overlay.ts`, not in this row's file list, so not edited) gets an
escaped language tag from `main.ts` (identical for every valid tag). Values from closed sets (`tv2Of`, `headerOf`, `saverOf`, layouts,
internal icon names and sizes) were checked and left as they are. Output for valid feeds is unchanged (an escaped apostrophe renders the same).

## 2. Lobby fonts per style family (review 08:F04)

### LAN listener allow-list (read first, kept closed)
`smplwise_vms/backend/smplwise/services/notices/page.py`: the listener (`listener.py`, port 18094) serves `/b/<slug>` (the page) and
`/assets/<name>` only when `<name>` is in a set built by crawling from `notice-tv.html`: `assets/*.js|css|woff2` names in the HTML, then for
every reached `.js` file its `"./x.js|css"` import strings and `assets/x.js|css|woff2` names. CSS files are not crawled, so a woff2 named
only by `url()` inside a CSS file would NOT be served - which is why the fonts stay inlined as data: URLs. Nothing in the backend changed.

### Change
- `scripts/notice_tv_fonts.py` writes `frontend/src/notice-tv/tv-fonts-hitech.css` (LobbySans + LobbyMono: Lumen, Axis, Prism; 216,648 B)
  and `tv-fonts-luxury.css` (LobbyFrank + LobbyDavid + LobbyBodoni: Gallery, Concierge, Stone; 273,776 B) instead of one `tv-fonts.css`
  (489,919 B, removed). The 21 `@font-face` rules are byte-identical to the old file and in the same order (checked). `--check` mode added.
- `main.ts`: no static import of the fonts; `lobbyFonts(skin)` imports the active family's sheet once and draws the style only when it is in
  (then `document.fonts.ready` -> refit, as at start-up); a failed load still draws (fallback fonts). Ink, Sign, classic and V2 load none.
- Woff2 sources moved `frontend/public/fonts/lobby/` -> `frontend/fonts-src/lobby/` (git mv, with the OFL texts). The five OFL texts also
  stay in `frontend/public/fonts/lobby/`, so the licences still ship inside the add-on (`www/fonts/lobby/OFL-*.txt`); the 452 KB of woff2 no
  longer reach `www`. The committed `smplwise_vms/www` is NOT rebuilt here: the release build (`build:addon`) drops `www/fonts/lobby/*.woff2`.
- `backend/tests/test_font_licences.py`: new source path; one OFL per lobby family at the source and in the shipped folder; no woff2 under
  `public/fonts/lobby`; the generated sheets are current (`notice_tv_fonts.py --check`).
- `docs/fonts/LOBBY_FONTS.md`: new layout.

### Rendering unchanged - before / after (vite dev server, `?design=<x>`, lobby feed, 1920x1080)
`frontend/tests/notice-tv-fonts-2443.spec.ts` records per design the lobby faces defined, the faces really loaded, the computed
`font-family | weight` of every text element and the widths of the titles / clock / temperature. Recorded on the base (static sheet) and
after the split, for all ten designs (classic, v2, ink, sign, lumen, axis, prism, gallery, concierge, stone):
**loaded faces, computed fonts and widths identical in all ten**. Defined lobby faces: 16 distinct keys on every board before -> 7 (hi-tech),
9 (luxury), 0 (classic, V2, Ink, Sign) after.

### Built page behind the listener's rules (scratch, not committed)
A build of the TV entry alone (`vite build` with `input: notice-tv.html`, into the scratchpad): `notice-tv-*.css` 230.6 KB (was 719,630 B in
the review's measurement), plus `tv-fonts-hitech-*.css` 216 KB and `tv-fonts-luxury-*.css` 273 KB. `page._read()` on that build allows
exactly `notice-tv-*.js`, `notice-tv-*.css`, `tv-fonts-hitech-*.css`, `tv-fonts-luxury-*.css`; `page.asset()` refuses anything else.
A browser run against that build with the listener's rules (HTML from `page.page_html()`, assets only from the allow-list, the page CSP on
every response): Lumen fetched only the hi-tech sheet and loaded LobbySans/LobbyMono; Gallery and Concierge only the luxury sheet
(LobbyFrank; LobbyDavid + LobbyBodoni); Ink no sheet; no request refused, no CSP violation (4 passed).

## Tests actually run (workstation, `--workers=1`, private vite dev server :4391)
- `npx tsc --noEmit`: exit 0 (final tree)
- `unit-notice-tv-escape-2443.spec.ts`: 5 failed on the base; 5 passed after the fix. Final run of the three new specs on the final tree: **37 passed** (22 + 5 + 10)
- `notice-tv-hostile-2443.spec.ts`: base see above; 22 passed after the fix (before the font split) and again after it (in the final 37)
- `notice-tv-fonts-2443.spec.ts`: 10 recorded on the base (its assertions fail there by design: every board defined all faces); after the
  split 10 passed (in the final 37)
- Existing Node units around the touched builders: `unit-boardv2-297`, `unit-busstatus-297`, `unit-bustimes-295`, `unit-lobbystyles-2300`,
  `unit-noticerss-295`, `unit-notice-tv-logic`, `unit-tv-fit-2380`, `unit-tv-chips-2381`: 91 passed (after the escape fix)
- Backend (`.venv` python, `-p no:xdist`): `test_font_licences.py` + `test_notices_106.py` (the listener / page tests): **48 passed** (5 of them the font-licence tests, also run alone: 5 passed)

## NOT_RUN
- `pixel-notice-tv-mock.spec.ts`, `pixel-notice-tv-portrait-chips.spec.ts`, `evidence-notice-tv.spec.ts` and the other TV pixel / layout
  specs for every style (row's test column; `font-display: block` timing changes) - runner only, no runner use tonight. No baseline change is
  expected (computed fonts, loaded faces and widths are identical, see above).
- No entry check queued (evening brief: not until the 2.43.8 release gate has finished).
- Full production build (`npm run build:addon`) and the committed `www` - release step.

## Follow-ups / found on the way
- Pre-existing generator bug kept on purpose (rendering must not change): `"-hebrew-" in stem` also matches `plex-sans-hebrew-latin-*`, so
  the five Plex Sans Latin files carry the HEBREW unicode-range (14 Hebrew ranges, 7 Latin ones in the sheets). Latin letters in Lumen /
  Axis / Prism are therefore drawn in Heebo today (not IBM Plex), and the ~100 KB of Plex Latin draws no glyph. Fixing it changes pixels
  (Latin text, digits in LobbySans): owner question.
- `THIRD_PARTY_NOTICES.md` (both copies) and `docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md` still name `frontend/public/fonts/lobby/` and
  `www/fonts/lobby/` as the font location; outside this row's file list (the OFL texts are still there).
- Comments in `tv-hitech.css` / `tv-luxury.css` still say "inlined by tv-fonts.css" (outside the file list; comment only).
- A hostile `severity` such as `constructor` makes `SEV_LOOK[...]` return a function, now escaped into a class name (inert); a strict
  own-property lookup would be cleaner.
