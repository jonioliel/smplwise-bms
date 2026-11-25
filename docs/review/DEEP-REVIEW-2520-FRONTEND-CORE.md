# Deep review 2.52 - FRONTEND-CORE

Reviewed head: `origin/release/2520-train` at `eadaa25b81c0e65c86d8aa6ff5f108816bcc7c2d` (read-only worktree).
Area: the frontend foundation - shell (`shell/sw-app.ts` and its controllers), routing, session and sign-in (`api/session.ts`,
`arx/*`, passkeys / WebAuthn, step-up), the API client and its error readers, shared components (dialog, confirm, sheet, field,
toggle, pager / page-fit, modal stack, scroll lock, toast), i18n machinery and the language switch, service worker / push, polling
and sockets, lazy loading.

Method: code reading only, each finding followed end to end through the code path at this head. **Nothing was executed**: no unit
spec, no build, no browser run (NOT_RUN). "Confirmed" below means confirmed by reading the whole path; a finding whose trigger
depends on browser or network behaviour that was not reproduced is marked PLAUSIBLE.

Earlier rounds: the code comments reference the review of 2026-11-13 (ids `06:*`, `07:F*`, `08:F*`) and its fixes
(CR-API-PATHS-2439, CR-API-BLOB-2436, CR-MODAL-STACK-2441, CR-SHELL-TIMERS-2439, SESSION-DEMO-WS-2435, CR-POLL-SCREENS-A-2436 ...).
None of the findings below repeats one of those ids; where a finding touches code one of them introduced, it says so.

## Summary

| Id | Severity | Title | File:line |
|---|---|---|---|
| FC-01 | medium | `sw-toggle` flips itself; a refused or cancelled change leaves the switch showing a state that was never saved | `frontend/src/components/sw-toggle.ts:149-153`, `frontend/src/screens/automation-editor-base.ts:1145-1155,1489` |
| FC-02 | medium (security / privacy) | A browser's Web Push subscription survives the remote sign-out: the signed-out device keeps receiving that user's notifications | `frontend/src/arx/auth.ts:624-653`, `frontend/src/pwa/push.ts:110-138`, `smplwise_vms/backend/smplwise/services/ha_user_auth.py:1406-1427` |
| FC-03 | medium | Remote channel: a start or a 401 while the sign-in service is unreachable drops a valid 90-day sign-in to the sign-in page (and can reload the page); signing in again orphans the stored refresh token | `frontend/src/arx/boot.ts:30-33,84-101`, `frontend/src/arx/auth.ts:461-513,531-558` |
| FC-04 | medium | Confirmation dialog: Enter confirms whatever holds the focus except the cancel button - Enter on the close (X) button confirms a destructive action | `frontend/src/components/confirm-dialog.ts:79-93` |
| FC-05 | medium (PLAUSIBLE) | No request timeout anywhere; one hung `fetch` is shared with every later caller of the same GET and stops that screen's poll for good | `frontend/src/api/client.ts:127-140,194-216`, `frontend/src/api/live-refresh.ts` (`canRun`, `runSlot`) |
| FC-06 | medium | A page left open across an add-on update is never told: no build comparison with the server; the only notice needs a service worker and a `visibilitychange` | `frontend/src/pwa/register.ts:155-176`, `frontend/src/shell/lazy-screens.ts:231-248` |
| FC-07 | low | The personal language is read once, before the remote sign-in exists; on the remote channel a first sign-in (and any start after the session cookie ended) keeps the wrong language | `frontend/src/main.ts:18`, `frontend/src/i18n/ui-lang.ts:48-57`, `frontend/src/arx/boot.ts:25-40` |
| FC-08 | low | `describeError`: the friendly fallback sentence is unreachable (users read `http_502`), and every `TypeError` is reported as "no connection to the server" | `frontend/src/api/client.ts:168,243-247` |
| FC-09 | low | `/me/ws`: a listener that throws on a frame skips the permissions check of that frame; socket frame handlers swallow subscriber exceptions | `frontend/src/api/session.ts:164-174`, `frontend/src/api/ha.ts:497-517` |
| FC-10 | low | A malformed `%` in three route segments throws inside the shell's render | `frontend/src/shell/sw-app.ts:2764,2848,2853`, `frontend/src/shell/nav.ts:179` |
| FC-11 | low | `/me/ws` has no final close code: a socket refused for an ended session reconnects for ever and the shell is never told | `frontend/src/api/session.ts:152-161` |
| FC-12 | low (PLAUSIBLE) | Step-up: requests refused at the same moment share one dialog opened with the first request's action | `frontend/src/shell/step-up.ts:15-22` |

Counts: critical 0, high 0, medium 6 (one PLAUSIBLE), low 6 (one PLAUSIBLE).

---

## Findings

### FC-01 (medium) - `sw-toggle` flips itself; a refused or cancelled change leaves the switch on a state that was never saved

`frontend/src/components/sw-toggle.ts:149-153`:

```ts
private flip() {
  if (this.disabled) return;
  this.checked = !this.checked;
  this.dispatchEvent(new CustomEvent('change', { detail: { checked: this.checked }, ... }));
}
```

The element changes its own `checked` before the screen has decided anything. Screens bind `.checked=${modelValue}`. Lit commits a
property binding only when the value differs from the value it committed last, so when the model does NOT change (the save was
refused, the person cancelled a confirmation or the step-up dialog, the network failed) the re-render writes nothing and the switch
stays where the press put it.

Confirmed instance - `frontend/src/screens/automation-editor-base.ts:1489` binds `.checked=${on}` (`on` = `item.state !== 'off'`),
handler at `:1145-1155`:

- turning ON an automation with `unknown_effects`: `this.dialog = 'enable'; return;` - the switch already shows ON. The person
  cancels the confirmation: `item.state` is still `off`, the binding value is still `false`, nothing is written, the editor shows
  the automation as active while it is disabled;
- any refusal (`catch (e) { this.note = automationErrorText(e); }`): the note appears, the switch keeps showing the value that was
  refused.

Why it matters more since 2.49: the step-up gate answers settings changes with 403 `step_up_required`; a person who cancels the
code dialog gets exactly this path on every switch whose handler does not put the element back.

Scale: 374 `<sw-toggle` uses in `frontend/src` (non-test); 29 bind through `live(...)` (the `switchPress` pattern of
CR-CMP2-TOAST-2440), a few handlers reset the element by hand (`el.checked = !on`, e.g. `components/frigate-control-settings.ts:98`),
and some screens happen to rebuild the switch because their failure path goes through a loading state (`screens/system-cast.ts`,
`screens/system-announcements.ts`, `components/device-activity.ts`). The rest depend on what their failure path does; they were not
audited one by one.

Suggested fix: make it impossible to get wrong instead of fixing screens one at a time - bind every model-backed switch as
`.checked=${live(value)}` (Lit then compares with the element's real property and puts it back on the next render) and add a
ratchet spec next to `unit-no-native-dialogs` that fails on a `<sw-toggle ... .checked=${` without `live(` unless the handler is a
pure local draft assignment. A regression spec for the automation editor (press, cancel the confirmation, the switch reads off).

### FC-02 (medium, security / privacy) - the Web Push subscription survives the remote sign-out

`frontend/src/arx/auth.ts:624-653` (`logout`): revokes the refresh token, deletes the Arx session, clears both token stores and the
seed - and never touches this browser's push subscription. `unsubscribeThisDevice` (`frontend/src/pwa/push.ts:110-118`) is called
only from the notification settings screen (`pwa/notifications-settings.ts:219`).

Backend side, read to confirm: `services/ha_user_auth.py:1406-1427` `logout` ends "the app's device token and push registration"
through `presence.end_on_sign_out` (XSECFIX-297) - that is the native app's registration, matched by user agent; the rows of
`push_subscriptions` written by `POST push/subscriptions` are not removed (`routers/remote.py:136-147` does nothing more). The
service worker (`frontend/src/pwa/sw.ts:188-218`) shows whatever arrives, session or not, and its `ack` / `snooze` buttons work by
token without a session (by design).

Failure scenario: a person signs in to Arx on a shared or borrowed computer / tablet (remote channel), switches notifications on,
later presses "יציאה" (or is signed out by the idle lock, or an administrator ends the sign-in from the sessions list). The browser
keeps receiving that person's notifications - titles and bodies of alerts, door events, system faults - and can acknowledge or
snooze them, until someone else signs in on that browser (`syncSubscription` then moves the row) or the row is pruned as stale.
"Sign out everywhere" has the same gap for every other browser of the user.

Suggested fix: (1) `logout()` first asks the worker registration for the current subscription and, when there is one, deletes its
server row (`endpointHash` + `DELETE push/subscriptions/<id>`, or a new `DELETE push/subscriptions/current` taking the endpoint) and
calls `sub.unsubscribe()`, before the session is deleted; (2) server side, a remote sign-out, a revoked sign-in and "sign out
everywhere" should drop the push rows registered through that sign-in (the row would need the sign-in id; today only `channel` is
kept). (2) is the part that also covers a browser that is offline or closed when the sign-in ends. Backend half belongs to the
security area; listed here because the client half is `arx/auth.ts`.

### FC-03 (medium) - remote channel: a valid sign-in falls to the sign-in page when the sign-in service cannot be reached

Three places treat "could not refresh right now" as "signed out":

1. `frontend/src/arx/boot.ts:30-33`

   ```ts
   setUnauthorizedHandler(async () => {
     const ok = await refreshNow();
     if (!ok) window.location.reload();
     return ok;
   });
   ```

   `refreshNow()` (`arx/auth.ts:461-513`) returns `false` in two very different cases: the sign-in was refused (tokens cleared), and
   "no connection, or the server says try again" (`:490-494`: tokens KEPT, a 30 s retry timer armed). The handler reloads the page in
   both.

2. `arx/auth.ts:539` - `resume()` returns `refreshNow()`; with the access token past its last five minutes (it lives about half an
   hour, so this is the normal case for a phone that was idle) a network failure or a 5xx of the token endpoint makes `resume()`
   answer `false`, and `bootRemote` (`boot.ts:84-101`) shows the sign-in page with no notice.

3. `arx/auth.ts:540-557` - with a fresh access token, a failed `exchange` (network, 5xx) is thrown; `boot.ts:97-101` shows the
   sign-in page with the error text.

Failure scenarios (inputs -> outcome):

- The installed PWA is opened without connectivity (garage, lift). The worker serves the cached shell; `resume()` cannot refresh;
  the person sees a username / password form although the sign-in is valid for 90 days. When the network returns, the 30 s timer
  refreshes silently in the background, but the page stays on the form until a manual reload.
- The platform restarts while the add-on keeps answering: an API call gets 401 (the session cookie ended with its access token),
  the token endpoint answers 502, the handler reloads the page, and the reload lands on the sign-in form as above.
- In both cases a person who simply signs in again gets a NEW refresh token; `completeSignIn` -> `saveTokens` overwrites the stored
  one without revoking it, so the old refresh token stays valid at the sign-in service until its own expiry (an entry in the user's
  token list that no device holds any more).

Suggested fix: let `refreshNow()` say why it failed (`'ok' | 'retry' | 'ended'`). On `'retry'`: the 401 handler returns `false`
without reloading (the request fails like any offline request), and `bootRemote` shows the existing "no connection, trying again"
state (`sw-state-panel state="stale"`, as `renderRetry` does for `/me`) and retries on the timer and on `online`, mounting the shell
when the refresh succeeds. Only `'ended'` shows the sign-in form. Before a fresh sign-in overwrites stored tokens, revoke the
previous refresh token.

### FC-04 (medium) - confirmation dialog: Enter confirms from the close button

`frontend/src/components/confirm-dialog.ts:79-93`: the dialog listens on `window` in the capture phase; for Enter it calls
`preventDefault()` and `this.answer(!onCancel)`, where `onCancel` is true only when the focused element is the cancel button.

The dialog's focus trap (`sw-dialog`) cycles through the header's close button too (`data-dialog-close`, first in the box). Focus
starts on the confirm button; one Tab wraps to the close button. Enter there: the default click on the close button is prevented
and the dialog answers **true**. The same holds for any focusable element a `TemplateResult` body brings (a link, a field).

Failure scenario: a keyboard or screen-reader user opens a delete confirmation (`danger: true`), tabs to "סגור" (the X) to back
out and presses Enter - the deletion runs. (Space on the same button closes without confirming, because only Enter is intercepted.)

Suggested fix: Enter confirms only while the focus is on the confirm button or on nothing focusable inside the box (the native
box's behaviour is the default button, and it has no other buttons to land on); on any other button or link let the key through so
the element's own click runs (`answer(false)` for the close button via `@close`). Add the case to the confirm dialog's spec.

### FC-05 (medium, PLAUSIBLE) - no request timeout; one hung request is shared and stops a poll for good

- `frontend/src/api/client.ts:127-140` (`fetchApi`): `fetch` with no timeout and no default `AbortSignal`.
- `:194-216`: a plain GET in flight is shared by address (`inflightGets`); the entry is removed only when the request settles.
- `frontend/src/api/live-refresh.ts`: a slot is re-armed only after its read settled (`runSlot` ends with `arm`), and `canRun`
  answers `false` while `s.running` - on the timer, on resume, on `online` and for `refreshOne` (`runSlot` returns at once).

So a request that never settles is permanent for the page: every later `get('me')`, `get('settings')`, ... of the same address
receives the same pending promise (including `loadSession`'s retry), and a screen's poll never fires again; the "try now" buttons
that go through `refreshOne` do nothing. Only a reload recovers.

Whether a request can hang without the browser failing it is the unproven part (hence PLAUSIBLE): it is the classic half-open
connection after a phone sleeps or changes network; the same codebase already treats sockets that way
(`api/reconnecting-socket.ts`: "a phone that slept never gets a close event"). HTTP has no such guard here.

Suggested fix: a default deadline in `fetchApi` for requests without their own signal (`AbortSignal.timeout(...)`; long for
uploads and blob downloads, e.g. 30 s for JSON GETs, opt-out per call), mapped to a retryable `ApiError`/`TypeError` so the
existing offline states show. Optionally a watchdog in `LiveController`: a read running longer than a few periods no longer blocks
the slot.

### FC-06 (medium) - an open page is never told that the add-on was updated

What exists: (a) the service worker's "update ready" notice (`frontend/src/pwa/register.ts:155-176`) - only in a secure context
(`:216`, so not on a plain-http local address, the case `api/request-id.ts` documents as real), and its own update check runs only
on a `visibilitychange` to visible after 30 minutes; (b) `reloadOnceForNewRelease` (`shell/lazy-screens.ts:231-248`) - only when a
lazy chunk that was never loaded fails.

Nothing compares the running bundle (`__ARX_BUILD__`, used only by the worker's cache name and `components/update-run.ts:260`) with
the server's version.

Failure scenario: an operator desk, a wall tablet or a kiosk page stays open (always visible, so no `visibilitychange`; or on
plain http, so no worker). The add-on is updated. The page keeps running the old bundle against the new API for days: its chunks
are already loaded, so nothing fails loudly. 2.52 itself tightens request bodies (`extra=forbid` on the NVR / privacy-mask / camera
writes, ADR019-L14-STRICT-F123-2520), so an old client can be refused with a validation error the operator cannot explain; new
fields and renamed codes are silently missing.

Suggested fix: the server already greets every `/me/ws` connection with `hello` (and the socket reconnects on every add-on
restart): add the add-on version to that payload (and to `/me`), compare with `__ARX_BUILD__` in `api/session.ts`, and on a
mismatch raise the same "גרסה חדשה - רענון" notice (`pwa.updateReady`), reloading automatically on the wall / kiosk routes where
nobody is there to press it.

### FC-07 (low) - the personal language is not applied after a remote sign-in

`frontend/src/main.ts:18` calls `syncUiLang()` once while the entry module is evaluated. On the remote channel no session exists
at that moment unless the previous session cookie is still alive (it ends with the access token): `GET me/prefs` answers 401, the
401 handler is not installed yet (`arx/boot.ts:30` runs later, in `startApp`), and `syncUiLang` swallows the error
(`i18n/ui-lang.ts:54-56`). Nothing calls it again: `startApp()` mounts the shell without it.

Scenario: a user whose stored language is English signs in on a new phone (or a Hebrew user on a browser whose mirror says `en`):
the whole session is in the wrong language until a manual reload made while the cookie is alive (which then reloads once more into
the right language). The same happens on every PWA start after an idle period when the language was changed on another device.

Suggested fix: call `syncUiLang()` from `startApp()` (after the session exists) on the remote channel, or have the shell call it
when the session first becomes `api`; keep the early call for Ingress, where identity is there from the first request.

### FC-08 (low) - `describeError` shows raw codes and mislabels programming errors

`frontend/src/api/client.ts:168`: an answer without the server's envelope becomes `{ code: 'http_<status>', user_message:
statusText }`. `:244`: `closedErrorText(code) ?? (user_message || code || tr('השרת דחה את הבקשה ({status})'))`. `code` is never
empty, so the translated fallback sentence can never be chosen. `statusText` is empty over HTTP/2 (the remote channel) and English
over HTTP/1.1, so during an add-on restart or a proxy error every screen's error line reads `http_502` or "Bad Gateway".

`:245`: `if (err instanceof TypeError) return tr('אין חיבור לשרת.')`. `fetch` does reject with `TypeError`, but so does any
`undefined.x` thrown inside a screen's `try` around its load (for instance after `api()` returned `null` for a 200 with a non-JSON
body, `:219-226`). The operator is told the server is unreachable while it answered.

Suggested fix: in `describeError`, treat a code that starts with `http_` as "no code" (use the translated sentence with the
status); raise a dedicated `NetworkError` from `fetchApi` (wrap the `fetch` rejection) and reserve the "no connection" text for it.

### FC-09 (low) - a throwing listener hides a permissions frame; frame handlers swallow subscriber errors

`frontend/src/api/session.ts:164-174`: `meFrame` runs `meListeners.forEach((fn) => fn(env))` and only then looks at
`permissions_changed` / the `hello` fingerprint, all inside one `try { } catch { /* ignore */ }`. A listener that throws (the
notification store's `live`, the incoming-call listener ...) on that frame skips the permissions handling: the shell does not
re-read `/me` and keeps the old navigation (the server still refuses what is no longer allowed, so this is not an authorization
gap). `frontend/src/api/ha.ts:497-517` has the same shape: the `catch` meant for malformed JSON also swallows an exception thrown
by the screen's own `onMessage`, so a bug in a live handler is invisible (no console line) and looks like "live updates stopped".

Suggested fix: parse inside the `try`, dispatch outside it; call each listener in its own `try` that logs
(`console.error`), and run the permissions check first.

### FC-10 (low) - a malformed escape in a route segment throws during render

`frontend/src/shell/sw-app.ts:2764` (`#/investigate/incidents/<id>`), `:2848` (`#/devices/areas/<id>`), `:2853`
(`#/devices/schedules/<id>`) and `shell/nav.ts:179` call `decodeURIComponent` on a hash segment. `#/devices/areas/50%` (a pasted or
truncated link) throws `URIError` inside `renderRoute`; the shell's update rejects and the previous screen (or nothing) stays until
the next route change, with no message.

Suggested fix: one `safeDecode(segment)` (returns the segment as written when it cannot be decoded) used by the four call sites.

### FC-11 (low) - `/me/ws` reconnects for ever after the session ended

`frontend/src/api/session.ts:152-161`: `watchPermissions` opens the shared reconnecting socket without `finalClose`. The server
closes an unauthenticated handshake with 4401 (`routers/me.py`), and `api/ha.ts:485` already stops on 4401 / 4403 for `ha/ws`; here
the socket keeps reconnecting (2 s .. 60 s back-off) for the life of the page and nothing tells the session, so a page whose
sign-in ended stays drawn as signed in until its next API call.

Suggested fix: `finalClose: (code) => code === 4401 || code === 4403`, and on that close call `loadSession()` once (it turns the
shell to `unauthenticated`, or on the remote channel runs the 401 refresh path).

### FC-12 (low, PLAUSIBLE) - concurrent step-up refusals share the first request's dialog

`frontend/src/shell/step-up.ts:15-22`: `pending ??= ...stepUpDialog(details)`. Requests refused at the same moment share one
dialog and one answer, as documented - but the dialog is opened with the FIRST refusal's `details` (its `action`, `methods`,
`once`). When the second request needs a proof for a different action (a once-action proof is "for exactly one call",
`api/client.ts:88`), its single retry is refused again and the screen shows the raw refusal after the person has just confirmed.
Needs two gated changes in flight together (a bulk save), not reproduced.

Suggested fix: share the dialog only between refusals with the same `action`; queue a different action behind the open dialog.

---

## Improvements (short)

1. **One `ha/ws` socket.** `subscribeHa` (`api/ha.ts:471`) opens a socket per caller; there are 15 call sites, and on an ordinary
   page 2-3 are open together (the screen's, `components/cast-store.ts:42` for the shell's cast pill, `api/alarm-presence.ts:47`
   for as long as no alarm panel was found). Each receives and parses every entity state change. A shared, reference-counted
   socket with fan-out removes the duplicate traffic and the duplicate JSON parsing; `haPushLive()` then is simply "the shared
   socket is open".
2. **English pack at start.** `i18n/lang-packs.ts` waits (top-level await) for one chunk holding every module's English (its own
   comment: 1.4 MB) before anything is evaluated. Splitting it by area (shell + the landing screen first, the rest with the lazy
   screen chunks) would take most of that off an English user's start.
3. **`confirm-dialog.ts` keeps a private `OPEN` list and its own `deepActive`**, next to `components/modal-stack.ts` which was
   written to be the one stack (CR-MODAL-STACK-2441). Moving it onto `takesEscape` / `isTopLayer` removes the second source of
   truth (and is the natural place to fix FC-04).
4. **Listeners held while closed.** Every `sw-dropdown` in the page keeps a capture `pointerdown` listener on `document`
   (`sw-dropdown.ts:1219`), every `sw-dialog` and `sw-sheet` a `keydown` listener on `window`, open or not. Each is cheap; on the
   settings screens (dozens of dropdowns) attaching on open / detaching on close is a simple saving.
5. **`sw-app.ts` `updated()`** (`:2199-2251`) runs about ten `querySelector` passes and several attribute writes after every shell
   render (every store notification requests one). Guarding the block on "route, tab row or skin changed" would make the many
   `requestUpdate()` subscriptions in `connectedCallback` cheaper.
6. **Session start work in one promise chain.** `sw-app.ts:1976-2033`: the settings `.then(...)` applies about forty settings in a
   row behind `.catch(() => undefined)`; one throwing apply function silently skips everything after it (the landing still
   happens in `finally`). Logging the caught error would make such a failure visible.
7. **`api()` returns `null` for a 2xx body that is not JSON** (`client.ts:219-226`) typed as `T`. Throwing a typed "bad answer"
   error there would turn a later `TypeError` in the screen into a clear message (see FC-08).

## Checked and fine

- **API client** (`api/client.ts`): `path` / `query` encoding (CR-API-PATHS-2439) - every interpolated value is one encoded
  segment; relative URLs resolve against `document.baseURI` on both channels; the 401 retry and the step-up retry each happen
  once; the inline step-up header is removed before the request leaves; in-flight GET sharing never caches past the answer and
  never shares a request with headers or a signal; `fieldsOf` / `problemsOf` read the canonical forms first and every legacy form
  (ADR-019 step 0) without throwing on foreign shapes.
- **Session** (`api/session.ts`): demo is shown only when no backend can be behind the page (never under Ingress or the remote
  base); a failed `/me` grants nothing (all capabilities off) and retries with back-off and on `online`; a re-read that fails
  keeps the last answer; the `hello` fingerprint is the same function as `/me`'s (`routers/me.py:57,263`), so a reconnect does not
  re-mount the screen by itself.
- **Reconnecting socket and polling** (`api/reconnecting-socket.ts`, `api/live-refresh.ts`, `components/poll-controller.ts`):
  back-off with jitter, a constructor that throws is retried, half-open detection, resume handling, `stop()` leaves no timer,
  listener or socket; a poll cancelled inside its own read is removed; a host that disconnects during a read is not re-armed.
- **Sign-in page and tokens** (`arx/auth.ts`, `arx/arx-login.ts`, `arx/local-auth.ts`, `arx/hass-tokens.ts`): PKCE with one
  fallback and no loop; the password goes only to the sign-in service or (Arx-only identity) to the add-on over the same origin;
  tokens that have not passed the second factor stay in memory only; a refused exchange revokes the fresh refresh token; the seed
  for the embedded panel is written only when it is ours and removed in the browser-session mode; the welcome token is taken from
  the fragment by a strict pattern and removed from the address; concurrent refreshes share one promise.
- **WebAuthn** (`arx/webauthn.ts`, `api/step-up-passkey.ts`, `api/passkeys.ts`): base64url both ways, only public material leaves
  the browser, a cancelled ceremony is distinguished from a server refusal, the remote passkey offer is used once and renewed when
  older than 40 s, the passkey button is offered only at the origin the server named.
- **Step-up dialog** (`components/sw-step-up-dialog.ts`, `shell/step-up.ts`): answers once, removal without an answer is `false`,
  a wrong code keeps the dialog, recovery codes are not offered for once-actions.
- **Service worker** (`pwa/sw.ts`, `pwa/deeplink.ts`, `pwa/push-v2.ts`, `pwa/register.ts`): never handles `api/`, Range or
  cross-origin requests; navigations are network-first and only a top-level document gets the shell; hashed assets are cached only
  when `ok` and same-origin `basic`; old release caches are deleted on activate; push payloads are parsed defensively and a click
  can only open an in-app hash route (no absolute URL, no other path); the `arx-context` message accepts only a same-origin path;
  the update hand-over (PWA-UPDATE-STALL-2435) cannot loop. Its Hebrew-only words are known (`i18n-keep`; the language work is on
  another branch, not in this head).
- **Lazy screens** (`shell/lazy-screens.ts`): a failed chunk is retried with a delay, the reload for a new release happens at
  most once a minute and never offline, background warm-ups never reload the page.
- **Shared overlays**: `components/modal-stack.ts` (one Escape per press, Tab trap ownership), `sw-dialog` (focus in, focus back,
  top layer, locked state), `components/scroll-lock.ts` (reference-counted, restores the inline values), `shell/overlay-history.ts`
  (one history entry per overlay, Back closes it, a navigation drops it first), `components/toast-controller.ts` (timers end with
  the host).
- **Fields and paging**: `sw-field` (observers disconnected, accessible name and unit description only when the screen set none),
  `sw-pager` (clamped), `components/page-fit.ts` (resets on a new set, bounded re-measure, observer released).
- **i18n core** (`i18n/core.ts`, `msg.ts`, `lang-packs.ts`, `ui-lang*.ts`, `locale.ts`): fallback chain language -> Hebrew -> key,
  a failed pack leaves Hebrew words and is retried, the language switch cannot reload in a loop (mirror read-back), `en-GB` keeps
  day-month order and the 24-hour clock; the per-user caches of the navigation order and the look are keyed by user id and ignore
  another user's copy.
- **Injection surface in this area**: `unsafeHTML` / `unsafeSVG` in the shared components only render static icon and logo
  tables; the Android download link accepts only an https address or the add-on's own route; `home-paint.js` validates the stored
  colour; no `window.open`, no `postMessage` listener without an origin check in the shell (the WisKey embed and the notice TV
  frame belong to other areas).
- **Build**: source maps are produced but moved out of the package by `frontend/scripts/sourcemaps-archive.mjs` and checked by
  `scripts/release_check.py`; a bundle budget script exists (`frontend/scripts/bundle-budget.mjs`). Not run here.

Not covered in depth (time-boxed; listed so the coverage is honest): `shell/nav.ts` (2017 lines - the tab tables and landing
rules), `shell/tabs-mode.ts`, `shell/header-fit.ts`, `components/sw-dropdown.ts` beyond its listeners, `sw-sheet` / `sw-drawer` /
`sw-table` / `sw-tabs` internals, `design/*` (tokens, skins, palettes, contrast), `shell/sw-user-menu.ts`, the generated wire
types beyond their use in the files above.
