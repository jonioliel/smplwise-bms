# NOTICESAVER-295 - notice board TV: screen saver, logo layouts, right-aligned clock (slice A of 2.17.1)

Base: pilot/NOTICEADD-295 (65da82d90). No migration. Everything stays behind `notices.enabled` and the add-on option `notice_boards`.

## What changed
- `display.saver` (`off` default, `wash`, `cycle`, `wave`, `ambient`) and `display.logos` (`a` default, `b`, `c`) are stored in the board's
  display JSON. `services/notices/model.py`: `SAVERS`, `LOGO_LAYOUTS`, defaults, normalisation (a PATCH with a bad value is refused with 422;
  a stored/old board reads the defaults).
- TV page (`frontend/src/notice-tv/`): the mock-up's `#saver` layer (wash exactly as `notice-106-tv-v4-wash-original.html`, with its day ink
  variant; cycle = slow orbit + wash every 10 min; wave; ambient) in `tv.css` / `main.ts`; the layer is built once per mode so re-renders do not
  restart its animation. Test hooks `?saver=` and `?logos=` override the board.
- Logo layouts: a = v4 (company in the header, SmplWise in the footer; template 2 keeps both in the header); b = both together at the end of the
  bottom row, header row removed; c = both in the header at opposite ends plus the line "מופעל על ידי SmplWise Arx" in the bottom row.
  The SmplWise artwork is the existing inlined PNG (independent of LOGOFIT-295).
- Bug fix: the clock was left-aligned in RTL; `:root[lang="he"] .clock .t { text-align: right }`.
- Drift (T2) now as in the v4+saver mock-up: 8 positions, at most 12 px, one step per 45 s, 8 s ease; `cycle` disables it (CSS orbit).
- Settings: `frontend/src/notices/display-saver.ts` (`<notice-display-saver>`), one import and one tag in `displayTab()`; two segmented choices
  (שומר מסך, מיקום הלוגואים); the live preview iframe shows the choice (draft display is posted to it). Hebrew strings in `i18n/notices.ts`.
- `docs/design/mockups/notice-106/tv.html` replaced by the restored wash-original mock-up (the reference of `pixel-notice-tv-mock.spec.ts`).

## Tests
- Backend: `tests/test_notices_106.py` (new `test_saver_and_logo_layout_defaults_and_validation`).
- Frontend: `tests/unit-noticesaver-295.spec.ts`, `tests/notice-tv-saver-295.spec.ts` (clock at 1920x1080, 1280x720, 3840x2160; savers; logo layouts).

## Expected pixel changes
No baseline was refreshed. `pixel-notice-tv-mock.spec.ts` compares with the mock-up file, which is updated in this change, and passes. Linux
screenshot baselines that include the TV clock column in template 1 (the clock moves to the right edge of its column) are expected to change
in any spec that screenshots the TV page; the integrator refreshes them once.
