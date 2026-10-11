# CR-029 / ST7 product port - slice S5-B: kiosk and wall display

**Branch:** `pilot/ST7-s5-kiosk` (from `integ/247` a8b6a21d). **Binds to:** CR-029 sections 3.3, 3.4 (the kiosk row of the performance
table), 4.5 (pointer lock), 4.6, 7 and the S5 row of section 8; CR-030 sections 4, 4.1, 4.2 and 8 (the wall's per-screen configuration,
the map band, burn-in, Settings); the S3 notes (`CR-029-ST7-S3-NOTES.md`: stills, the wall display flag, "the kiosk idle swap timer and the
wall tablet's own override UI are S5") and the S0 notes P7 ("per-display dials ... may be overridden in that browser only (S5)").
The other half of S5 - touch joystick, tap-to-walk, the minimap, saved positions and the route tour - is built on a separate branch
(`pilot/ST7-s5-touch`) in `sw-plan-3d.ts` / `walk-*.ts`; this slice touches none of `walk-controller.ts`, `walk-minimap.ts`,
`walk-session.ts` or a touch handler.

## 1. What S5-B covers

| S5 item (CR-029 section 3.4 / 8) | Built here | Where |
|---|---|---|
| Idle still + "no frames when idle" | `KioskIdle` (pure, fake-timer tests); the 3D element swaps to the host's slotted still after `idleS` seconds without input or plan change and STOPS its frame loop; input or a plan change wakes it | `map/kiosk-idle.ts`, `sw-plan-3d.ts`, `scene-three.ts` (`setPaused`) |
| Wall-screen override of the plan mode and quality | the screen's own `plan` block in the wall profile (`mode`, `quality`, `idle_s`), over this browser's pin, over the installation's dials; Settings drawer section; the plan drawn in the map band of the wall | `services/wall.py` (`Plan`), `map/wall-plan-mode.ts`, `wall/sw-wall-plan.ts`, `screens/system-wall.ts` |
| Pointer lock opt-in, degrading inside an iframe that refuses it | `PointerLockGate`: blocked-up-front where the frame is known to forbid it, a refusal learned from any request, remembered for the tab session, the walk falls back to drag with a one-line note | `map/pointer-lock-gate.ts`, `sw-plan-3d.ts` |
| Pause rendering when the tab is hidden; thermal note | `visibilitychange` pauses the frame loop (also in WebViews that keep running requestAnimationFrame); section 3 below is the thermal note | `sw-plan-3d.ts`, `scene-three.ts` |

## 2. The idle behaviour

**Idle** means: no input AND no change of what the plan shows of its devices, for `idleS` seconds. `idleS` comes from `plan.view.kiosk_idle_s`
(S0: 0 = never, 10, 30, 120, 600 seconds; default 30), a wall browser's pin, or the screen's own setting (section 5).

- **The machine** (`KioskIdle`): `active` -> `idle` after `idleS` of silence; one timer whatever the input rate (an input only stamps the time);
  `input()` wakes; `change()` wakes (option `wakeOnChange`, on) and counts as activity while awake; `hold()` keeps it awake while something draws
  on purpose (an eye-level walk, a route tour: the element holds it while `walkState` is not `off`); the screen coming back (`setVisible(true)`)
  is a person waking the tablet; a changed `idleS` wakes an idle view so the new rule starts live; a late timer after the tablet slept goes
  idle once. The clock and timers are injected, so the unit tests drive every rule with a fake scheduler.
- **The swap** (`sw-plan-3d`): properties `idleS`, `changeKey`, and a named slot `idle-still`. Idle: the slotted still fades in over the stopped
  view (the skin's `--sw-t-state`), the view is paused, `data-idle` / `data-paused` are set and a `kiosk-idle` event is dispatched. Awake: the
  loop resumes with ONE frame that shows everything that changed meanwhile, the still fades out. Window-level listeners (capture, passive) read
  `pointerdown`, `pointermove`, `keydown`, `wheel`, `touchstart`, so a touch anywhere counts; the wake touch lands on the still (it takes
  pointer events while shown) and does not operate what is under it.
- **Why in the element, not by unmounting it from the host** (the S3 `viewMode(idle)` input stays `false` in the hosts): unmounting frees
  the GPU memory but a wake then rebuilds the view and recompiles the level-3 shaders (the prototype measured 5-15 s on an integrated GPU);
  a paused view wakes in one frame. With an instant wake a plan change can wake the live view without any cost, so "a device state change
  wakes it" (the task) and "zero frames when nothing changes" (CR-029 section 3.4) both hold without thrashing between views.
- **What the still shows**: the host's `sw-plan-stills` (S3) for the current level, style and time band, with the live room states drawn over it
  (lit rooms through their masks, open doors, presence). It follows the clock by itself (`autoBand`: the band is re-read once a minute, so a
  wall that idles all evening goes from the day picture to sunset and night without a host render). Without a current still set nothing covers
  the view; the frame loop stops all the same and the last picture stays on screen.
- **What counts as a change** (`map/plan-change-key.ts`): which rooms are lit, where there is presence (the boolean), which openings are open,
  each circuit's switch (unknown is its own value), each camera's status, each room's lock and alarm state. Not the presence tint's fade steps or
  age and not the temperatures - they drift without anything happening and would wake an idle kiosk twelve times per window.
- **Two surfaces** are wall displays: the floor map opened with `?display=wall` (S3; wired in `explore-floor-map.ts`) and the map band of the
  portrait CR-030 wall display (`sw-wall-plan`, section 5). Both pass the same props to the same element.

| Wakes the idle view | Does not |
|---|---|
| a pointer, key, wheel or touch anywhere on the page | a hidden tab (it pauses; coming back wakes) |
| a change of the plan's signature (a lamp circuit, a door, presence, a camera) | a temperature or a presence-fade step |
| the screen / tab becoming visible again | the sun's minute tick, a texture arriving, a resize (they record a change; the next resume draws it) |
| a new `idleS` setting | - |

## 3. A hidden tab, and the thermal behaviour (note for the kiosk checklist, CR-029 section 3.4 / 9)

`SceneView.setPaused(true)` cancels the waiting frame and makes every later `invalidate` a no-op until `setPaused(false)`, which draws exactly one
frame. Gated that way: state pushes, resizes, textures and models arriving, the sun / sky minute tick, the theme observer, continuous mode, a
thumbnail pass (skipped while paused; the resume re-renders the strip, which asks again) and `redrawNow`. Not gated: an explicit capture or
export. The frame-budget probe is ended when the view pauses and runs again on resume (a paused view measures 0 fps and would otherwise lower
the rung). The reasons are a set (`PauseGate`: `hidden`, `idle`, `host`): clearing one never un-pauses another.

Browsers already stop `requestAnimationFrame` in a background tab; the explicit pause matters where they do not (some Android WebViews and
kiosk browsers keep it running with the screen off) and for the walk's own loop and the continuous probe.

What draws what on a wall tablet that runs 24/7, by state:

| State | WebGL frames | Other work |
|---|---|---|
| Live, nothing changing | 0 (render on demand since T087) | the sun / sky tick once a minute at level 3 (one frame, only when the sun moved visibly), the 1 s wall clock (DOM) |
| Live, something changes | one frame per change; a door leaf or a presence fade animates for 350 ms - a few seconds | - |
| Walking / the quality probe | continuous (the probe only for its first 2.5 s after a mount or a rung change) | - |
| **Idle with a still** | **0** (the loop is stopped) | the still is an SVG with no animation frame; one timer per minute re-reads the time band; the 30 s refresh of the floor's circuit switches (network) |
| Hidden tab | 0 | timers are throttled by the browser |

Honest limits: the numbers are frame counts the tests assert (the counter stands still), not temperatures. While idle the WebGL context and its
textures stay resident (that is what makes the wake instant); a "deep idle" that disposes the view after many minutes is a lever recorded here,
not built. No tablet was measured: case temperature, battery draw and the real wake time are **NOT_RUN** and belong to the S7 owner checklist
(24 h on a wall tablet, live versus idle; the frame rows above are the prediction).

## 4. Pointer lock

Opt-in stays the rule: `plan.view mouse_mode` is `drag` by default (a personal dial, S0); `lock` always asks, `auto` asks only outside a frame
(the walk's own rule, unchanged). `PointerLockGate` makes the asking safe where the product really runs, inside the Home Assistant Ingress frame:

- `blocked` (why it cannot work here, or null): the API is missing (iPad Safari); the page runs in a same-origin frame whose `sandbox` attribute
  lacks `allow-pointer-lock` (read through `window.frameElement`); or a refusal was already seen in this tab session. A cross-origin frame cannot be
  read, so the request decides.
- `effectiveMode(mode)`: `lock` / `auto` become `drag` while blocked. The element uses it when the dials load, so a blocked page never asks.
- `attach()`: the gate listens for `pointerlockerror` on the document, so a refusal of ANY request - the walk makes its own - is learned once,
  remembered for the tab session (`sessionStorage`, memory when storage is blocked), and reported once: the running walk moves to drag and shows
  "pointer lock is not available on this page - looking stays on drag". The person's stored dial is untouched, so the same account outside the frame
  still gets the lock. A `pointerlockerror` after the lock has worked once is the browser's cool-down after Esc and is not remembered.
- `request(target)` for any caller that asks through the gate: never throws, never rejects; a synchronous SecurityError, a rejected promise, the
  event, or silence for 1.2 s are all one verdict, `refused`.

Tested: node (`unit-pointer-lock-gate.spec.ts`: every refusal form, up-front blocking, memory across walks, the cool-down, reference-counted
listeners) and a real Chromium page (`evidence-pointer-lock.spec.ts`: a sandboxed iframe refuses the real request; the gate reads the frame it runs in
from inside it). **Not verified on the real Ingress page** (NOT_RUN): which sandbox / permission policy HA's panel frame carries is not known from
this repository; the gate is built to need neither. An opt-in button in the walk bar (CR-029 section 4.5) is not built - the bar belongs to the
touch half - the dial is the opt-in; and the personal-dial screen the dial needs is still the S0 gap.

## 5. The screen's own plan setting (CR-030)

Per-screen options of a wall live in the profile (`wall_profiles.config_json`, validated by `WallConfig`, edited in הגדרות › מסכי קיר, delivered
with `wall/config`, applied live over the wall WebSocket when the version changes). S5-B adds the `plan` block - **no migration**, an older row
reads as follow:

| Field | Values | Follow means |
|---|---|---|
| `plan.mode` | `follow`, `live`, `stills` | this browser's pin, then `plan.view wall_display` |
| `plan.quality` | `follow`, `auto`, `realistic`, `lite`, `full`, `schematic` | no forcing: the viewer's own choice, then the dials |
| `plan.idle_s` | `follow`, `0`, `10`, `30`, `120`, `600` | this browser's pin, then `plan.view kiosk_idle_s` |

`PATCH wall/profiles/{user}` merges the block and validates it in full (nothing is clamped silently; the lists are the `plan.view` lists plus
follow, a test pins that), audits the diff as `config.plan.*`, and a no-op writes nothing. `map/wall-plan-mode.ts` resolves the three layers
(`resolveWallPlan`): **the screen's setting > this browser's pin > the installation's dials**. A fixed quality is FORCED over the signed-in user's own
choice (`sw-plan-3d.qualityForce`): a wall tablet has no person (S0 notes P7), and the screen's setting must hold whatever its user last picked.

This browser's pin (a wall browser with no profile, the S3 floor-map wall): `?display=wall&plan=stills&quality=schematic&idle=120` is remembered
like `display=wall` itself (`localStorage`); `-` or `follow` removes one pin; `display=desk` clears them all.

**Settings.** הגדרות › מסכי קיר › the drawer gets a "מפה" section (show the map on a portrait wall; the plan view, the 3D quality and the idle time,
each starting on "כמו בהגדרות המערכת"; a note when the wall has no floor, because then no map can show). הגדרות › כללי › וידאו ומדיה gets the
installation's idle time ("מסך קיר — מעבר לתמונה מוכנה", the S0 dial that had no row). The settings search finds both.

**The map band** (`sw-wall` fills the slot it reserved for Studio 6 through `sw-wall-plan`, fetched on demand): it loads the profile's floor
(the map bundle, the structure document, the library, the look dials), draws the baked stills or the live 3D in the bare `kiosk` view of
`sw-plan-3d` (no bar, level strip, time pill, hints or tooltips; the canvas takes no pointer: a touch on the plan is a touch on the wall), idles
into the still and wakes as in section 2, and takes the WALL's theme: `theme: dark | light` forces the plan's colours (`map/theme-scope.ts` sets
the skin table's wanted column as inline custom properties on the plan's wrapper, because the product's tokens switch on the root and a dark wall
on a light installation must not hold a bright plan) and the stills' style. A wall user holds `map.read` and `video.live` only (the kiosk role): the
bundle brings the structure, the zones, the stills and the circuit switches, not entity states - so the lit rooms come from the floor's circuits
(`wall/wall-plan-scene.ts`, a stale switch lights nothing), and no door, presence or temperature is drawn. The floor is re-read every 30 s (a
hidden tab does not ask); a new publish reloads the structure. A profile with no floor keeps the empty surface (and the drawer says so).

## 6. Contradictions recorded

| # | What disagrees | Decision | Why |
|---|---|---|---|
| S5B-1 | CR-029 section 7: setting `plan.kiosk.idle_still_min` (minutes, 0 = off) | `plan.view kiosk_idle_s` (seconds: 0 / 10 / 30 / 120 / 600, default 30) as S0 built it | the owner's 2026-10-09/10 decisions arrived through S0; one dial |
| S5B-2 | S3 notes: the host swaps with `viewMode({ idle })` (an unmount) | the swap happens inside `sw-plan-3d` (slot + pause); the hosts leave `idle: false` | an instant wake; a change can wake the view for free |
| S5B-3 | S0 notes P7: per-display dials "overridden in that browser only" | both: the browser pin (route parameters) for a wall with no profile, and the screen's own setting in the CR-030 profile (this task) | a profile is the wall's per-screen model; the floor-map wall has none |
| S5B-4 | CR-029 section 4.5: "an opt-in button that silently stays disabled" | the `mouse_mode` dial is the opt-in; no walk-bar button | the walk bar is the touch half's file; the dial exists since S0 |
| S5B-5 | S3 `viewMode.idle` doc: "elapsed with no change"; this task: "wakes on input or on a device state change" | idle = no input AND no change; a change wakes | both sentences hold |
| S5B-6 | CR-030 section 4.1 leaves the map band's content open | the plan of the profile's floor (stills / live), not the 2D canvas | S3 notes: "embedding sw-plan-stills in sw-wall is S5" |

## 7. Not in S5-B (owner-visible)

- The touch half: joystick polish, tap-to-walk, pinch FOV, the minimap, saved positions and the route tour (`pilot/ST7-s5-touch`).
- Real-device evidence (NOT_RUN): a wall tablet's temperature, battery and real wake time; the pointer-lock behaviour on the real Ingress page.
- The wall plan shows no doors, presence or temperatures and no cameras (a wall user holds no entity states; a wall-scoped state read is a CR-030
  follow-up); a wall with camera-scope bindings only has no floor, so no map; the band follows the wall's theme but not the skin's glass
  materials beyond the tokens.
- A deep-idle unload of the WebGL context (section 3) and a "tap-to-tour while idle" mode.
- The Hebrew user guide page `docs/user-guide/he/45-wall-mode_HE.md` does not describe the new Settings yet (it is generated into the guide).
- The personal-dial screen for `mouse_mode` (S0 gap): the walk honours the dial, but no screen sets it.

## 8. Test record

See the final report of the slice for the counts and the runner results; the specs are `unit-kiosk-idle` (15), `unit-pointer-lock-gate` (13),
`unit-wall-plan-mode` (10), `unit-plan-change-key` (3), `unit-wall-plan-scene` (8), `test_wall.py` (+2), and, in a browser,
`unit-plan-3d-kiosk` (7), `evidence-pointer-lock` (4) and `evidence-wall-plan`.
