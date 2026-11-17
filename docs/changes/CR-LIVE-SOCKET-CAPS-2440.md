# CR-LIVE-SOCKET-CAPS-2440

Code-review batch 16.11, wave 3A (backend). Plan row `pilot/CR-LIVE-SOCKET-CAPS-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md`; findings 03:F07, 03:F19, 03:F23.
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` (`97080bbc4`).

## What and why

1. **The installation live cap cannot be overshot any more (03:F07).** `live_ws`, `live_ha_ws` and the station video
   socket compared `REGISTRY.count()` with `media.max_live_sessions`, then awaited the codec choice and the stream
   creation (seconds), and the session was registered only later in `_live_relay`. A wall opening sixteen tiles at
   once passed sixteen checks before one registration. `_live_relay` now takes `cap` and repeats the check right
   after the accept, with nothing awaited before the registration, next to the remote cap's own re-check. A single
   open behaves as before; only the racing surplus is refused, with close `4429` (the code the route's own check
   uses and the player already handles). `cap=None` (the default) skips the re-check, so a caller that does not pass
   it behaves as before.
2. **One "tell the socket why, then close" helper (03:F19).** New `close_with_error(websocket, frame, code, *,
   close_apart=False)` in `services/relay.py`: accept if still connecting, one text frame, close. The five callers
   keep their names, payloads and codes: `_refuse_choice` (4415 / 4430), `refuse_media` (4503; the bare 4503 for a
   stream-level refusal is unchanged), `_refuse_socket` (frame, then `WebSocketException(4403)`; `code=None`),
   `_refuse_remote_cap` (4429) in `routers/media.py`, and `close_replaced` (4410, `close_apart=True`: the close is
   tried even when the frame failed) in `routers/playback.py`. Same frames, same codes, same order.
3. **`GET /media/streams` returns only the go2rtc version (03:F23, lead decision L9).** The route returned go2rtc's
   whole `/api` answer, which carries its host and its configuration file path. It now returns
   `"go2rtc": {"version": ...}`. Consumer check (L9's condition): the only reader is
   `frontend/src/screens/system-diagnostics.ts`, which stores the object and shows `version` only;
   `frontend/src/api/media.ts` types it as `Record<string, unknown>`. Same route, same shape for the field the
   screen uses. This is the one deliberate behaviour change of the branch.

## Files

Changed: `smplwise_vms/backend/smplwise/routers/media.py`, `.../routers/playback.py`, `.../services/relay.py`.
New: `smplwise_vms/backend/tests/test_live_socket_caps_2440.py` (the installation-cap race test, the helper's unit
tests, the five refusals' frames and codes, the version-only answer). The row names `tests/test_live_review_fixes.py`
for the race test; it is in the new file instead, with its own fixture, and that file is untouched.

Outside my rows: `smplwise_vms/backend/smplwise/routers/intercom_media.py`, one argument (`cap=cap` in its
`_live_relay` call) so the station video socket gets the same re-check. The file belongs to `CR-INTERCOM-SHARED`
(same agent, later branch); that branch does not touch this line.

## Tests actually run

See the end of this file (filled after the run).
