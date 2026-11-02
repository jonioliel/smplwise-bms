# SETTINGS-TABS-SCROLL-2331 - scroll arrows, wheel, swipe and keys for long tab strips

Branch `fix/SETTINGS-TABS-SCROLL-2331`, cut from `origin/main` @ `52a8d9129`. Owner request 2026-11-01: in Settings, when the navigation
is drawn as tabs (the default `tabs` mode, and `hybrid` with more than three items in its bar form), the tab list is very long and
uncomfortable to move through. No version bump, no CHANGELOG entry, no merge (a release train takes it).

## What changed

The change sits in the one shared tab bar, `sw-tabs` (its bar forms: `pill`, `underline`, `underline-compact`), so every long tab strip
gets it, not only Settings: the Settings page row (13 tabs), the shell's settings-section row (pill), the investigation pages, the access
screens, the infra pages and so on. The dropdown form is untouched.

Before, `sw-tabs` already scrolled sideways (hidden scrollbar, proximity snap), faded the edge that hid tabs and revealed the active tab on
load. It had no visible control to scroll with a mouse, a vertical mouse wheel did nothing, and the keyboard could only Tab through every tab.

| Behaviour | Now |
|---|---|
| Arrows | A round arrow at each **reading** side that hides tabs (`data-more` = `start` / `end` / `both`): in Hebrew the start arrow is on the right and points right, the end arrow on the left. Each click scrolls 80% of the visible width toward that side, never past the last tab. Hidden (and not clickable) while that side has nothing more. A mouse affordance: `aria-hidden`, no focus stop. |
| Fade | Kept (`data-fade`, physical, as before), now on the scrolling viewport only, so the arrows sit over a clean fade and are never masked. |
| Mouse wheel / trackpad | A vertical wheel over an overflowing strip scrolls it sideways (down = toward the end). At the edge in that direction the event is left alone, so the page scrolls on. A horizontal trackpad gesture stays the browser's own; ctrl+wheel (pinch zoom) is ignored. |
| Touch swipe | The native sideways scroll of the viewport (`overscroll-behavior-x: contain`, tabs keep `touch-action: manipulation`). |
| Keyboard | With the focus on a tab: ArrowLeft / ArrowRight move the focus to the next / previous tab in reading order (in RTL ArrowLeft is the next), wrapping; Home / End jump to the first / last. The focus moves, Enter / Space opens (links stay links). The focused tab is scrolled into view. |
| Active tab | Revealed on load, on every `active` change (route change), on a box resize, when the row itself resizes (new: the row is observed too) and once the web font is in - now clear of the arrow and the fade (52 px), not only of a 24 px edge. |
| Reduced motion | Arrow and keyboard scrolling are smooth unless motion is reduced (the product's own motion setting, `design/apply.ts motionReduced()`, which follows `prefers-reduced-motion` in `auto`); the arrows' fade-in has no transition under `prefers-reduced-motion: reduce`. The active-tab reveal is always instant. |
| Scroll snap | Removed. The proximity snap re-aligned the strip after a programmatic scroll and put the revealed active tab back under the fade (measured: the Settings "remote access" tab ended at x = 9.5 in a 12..378 box on the phone). The arrows and the keyboard replace what the snap did. |

Structure: the scrolling box is now a `.vp` element (`part="viewport"`, `data-tabs-viewport`) inside the shadow root instead of the host,
with the two arrows (`[data-tabs-arrow=start|end]`) positioned over its ends. The host keeps `data-variant`, `data-fade` and the outside
look; skins' `:host(sw-tabs[...]) .row` rules still apply.

No setting was added: the arrows show only when a strip overflows, so a strip that fits looks exactly as before. If the owner wants the
arrows switchable, it is one more `Choice` in `shell/tabs-mode.ts` (open question below).

## Files

| File | Change |
|---|---|
| `frontend/src/components/tab-strip.ts` | NEW - the strip's arithmetic without the DOM: hidden edges, fade, arrow sides, page step, wheel mapping, key navigation, reveal delta (RTL mapping in one place) |
| `frontend/src/components/sw-tabs.ts` | the viewport + arrows, wheel / key handlers, reveal through `tab-strip.ts`, row observed, snap removed |
| `frontend/tests/unit-tab-strip.spec.ts` | NEW - 12 unit tests of `tab-strip.ts` |
| `frontend/tests/evidence-tabs-scroll-2331.spec.ts` | NEW - browser evidence on the built app (desktop / tablet / mobile) |
| `frontend/tests/evidence-shell.spec.ts`, `frontend/tests/evidence-tabs-styles.spec.ts` | read `scrollWidth` from the viewport instead of the host (one line each) |

## Evidence

`docs/evidence/SETTINGS-TABS-SCROLL-2331/`: `before-<project>-general.png` / `before-<project>-support.png` (origin/main `sw-tabs`,
same app) and `after-<project>-general.png`, `after-<project>-scrolled.png`, `after-<project>-support.png` for desktop (1440), tablet
(1024) and mobile (390).

## Tests

Run locally on the workstation (Windows, Node 24, Chromium), 2026-11-01:

| Test | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `unit-tab-strip` + `unit-token-lint` + `unit-lead-reserve` + `unit-uxfix-rtl` (desktop) | 37 passed, 0 failed |
| `evidence-tabs-scroll-2331` on the built app (`vite preview`, port 4202), desktop / tablet / mobile | 21 passed, 3 skipped (wheel: not on mobile; swipe: mobile only), 0 failed |
| `evidence-tabs-dropdown*`, `evidence-tabs-pair*`, `tabs-mode-apply` (need the Vite dev server) | NOT_RUN as evidence: a first run against the dev server with 3 workers took 2.3 h and failed 150 tests, essentially all on `page.goto` / `waitForSelector` timeouts (the dev server could not keep up, the workstation was out of memory); not a usable signal. The runner gate runs them. |
| `evidence-shell`, `evidence-tabs-styles`, `layout-noscroll-297` on the built app | started after the commit; result in the segment report (NOT_RUN if it did not finish) |

## Pixel baselines likely affected

Any baseline that shows an overflowing `sw-tabs` strip now shows the arrow(s) and a slightly wider fade: most likely
`visual-matrix.spec.ts-snapshots` (phone and tablet shells with long area rows), `pixel-access-*.spec.ts-snapshots` (the access screens'
tabs), `pixel-wiskey-*.spec.ts-snapshots` (WisKey area row on the phone), `pixel-nvr-encoding-batch.spec.ts-snapshots` (its preview tabs).
Strips that fit are unchanged. Per the owner rule the branch refreshes its baselines on the runner before joining a train (not done here:
no runner in this task).

## Open question for the owner

1. Arrows always on when a strip overflows (as built), or a display setting (on / phone off / off)?
