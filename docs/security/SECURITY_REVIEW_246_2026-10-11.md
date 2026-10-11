# Security review - candidate 2.4.6 (origin/integ/246 96e6032c)

Date: 2026-10-11. Task SEC246, branch `pilot/SEC246-review`, worktree `C:\cloude\wt-sec246` (from origin/integ/246 96e6032c, which
contains the releases 2.4.3 - 2.4.5 and the 2.4.6 candidate merges). Review only: no product code was changed; the proofs of concept
are in `smplwise_vms/backend/tests/test_security_review_246_poc.py` (own commits).

## Scope

`git diff 31fe5d7c..96e6032c` (31fe5d7c = release 2.4.2, the baseline of `SECURITY_REVIEW_242_2026-10-08.md`). Backend: every changed
file under `smplwise_vms/backend/smplwise/` (43 files). Frontend: the changed files that touch styles, images, deep links, keyboard
activation or confirmations (listed per area below). Generated `www` bundles, fixtures, evidence images, documentation-only and
test-only changes were not reviewed. No device, lab host, Home Assistant, NVR or Frigate was contacted.

Areas, as requested:
1. Settings background pictures (CRY): `routers/ui_background.py`, `services/backup.py` (`_file_refs`, `RESTORABLE_ROOTS`),
   `routers/settings.py` (`ui.background`, `ui.background_images`), `services/user_prefs.py`, `body_limit.py`,
   frontend `design/background.ts`, `api/background.ts`, `screens/system-design.ts`.
2. Self-update switch and apply path: `services/self_update.py` (`apply_enabled`, `is_newer`), `services/update_runs.py`,
   `routers/system_update.py`, `services/release_notes.py`, `main.py`, `routers/settings.py`.
3. Brand colours: `services/brand_colors.py`, `routers/settings.py`, frontend `design/brand.ts`.
4. Device type overrides (DEVTYPE): `services/device_types.py`, `routers/devices.py`, migration 0073, `services/devices.py`,
   `services/device_activity.py`, `services/backup.py` (`DEVICE_TYPE_TABLES`, `KEEP_WHEN_ABSENT`).
5. Turn-all-on (ALLON): `routers/devices.py` `bulk_run`, `services/device_bulk.py`.
6. Sticky 3D quality: `services/user_prefs.py` (`plan.quality`), `routers/me.py`, `routers/settings.py`.
7. Settings navigation / search / deep links: frontend `screens/system-index.ts`, `screens/system-nav.ts`,
   `screens/devices-type-admin.ts`, `screens/system-diagnostics.ts`.
8. Security screens: frontend `components/sw-camera-tile.ts`, `screens/security-alarm.ts`.
9. Crystal skin: frontend `design/skins/crystal.ts`, `design/tokens.ts`, `design/background.ts`.
10. Everything else in the diff touching auth / RBAC / limits / files / SQL / SSRF / injection / logs: LAT1 instant toggle
    (`routers/ha.py`, `services/ha_client.py`, `services/ha_actions.py`, `services/ha_sync.py`), HA 2026.10 compatibility
    (`auth.py` username normalisation, `routers/access.py` audit filter, `services/connection_probe.py` port 80 rule,
    `routers/nvr_connection.py`, `routers/automations.py` `/automations/compat`, `services/ha_compat.py`,
    `services/automation_model.py`, `services/automation_ops.py`), and the SEC243 / SEC244 fixes (`services/ha_user_auth.py`,
    `routers/remote.py`, `services/plan_anchor_scope.py`, `routers/plan_geometry.py`, `routers/plan_package.py`,
    `services/plan_package.py`, `routers/anchors.py`, `routers/skins.py`, `services/skins/store.py`, `services/wall_path.py`,
    `routers/plans.py`, `services/recorders/frigate_config.py`, `services/frigate_config_svc.py`).

Paths below are relative to `smplwise_vms/backend/smplwise/` unless stated otherwise.

## Method

Code reading of every changed backend file above and of the listed frontend files (plus a grep of every added frontend line for
`unsafeHTML`, `innerHTML`, `unsafeCSS`, `insertAdjacentHTML`, `eval`, `new Function`, `window.open`, `document.write`), and proofs
of concept against the in-process test client with fakes only.

What was run:
- On the runner (`private/runner/run_smart.py backend pilot/SEC246-review ...`):
  - header SHA a7de0bef: `tests/test_security_review_246_poc.py` - **6 passed** (every PoC holds, i.e. every finding it covers is open).
  - header SHA 93bf170c: the 2.4.2 regression file `tests/test_security_review_242_poc.py` (20 tests), `tests/test_lat1_toggle_latency.py`
    (3), `test_devices.py::test_area_section_turn_all_on_mirrors_turn_all_off`, and the first five PoCs - **29 passed**; and
    `test_ui_background`, `test_brand_colors`, `test_device_types`, `test_self_update_switch`, `test_self_update_s4_downgrade`,
    `test_username_normalisation` with the two PoC files - **64 passed** (2 tests of the 242 file deselected by an over-broad `-k` in
    that run; both passed in the 29-test run).
- On the workstation, a scratch measurement of the Pillow decode path of `_store` alone (no app, no network), quoted in L1.
- NOT_RUN: the full backend suite, the frontend suites (unit, evidence, tsc), anything against a real Home Assistant (including how
  HA 2026.10 itself normalises usernames, see I6), browser behaviour of the restored-picture case (I2) beyond the response headers.

The PoC tests assert the CURRENT (unfixed) behaviour, so they pass while a finding is open and fail on purpose once a fix lands
(invert them into regression tests then, or drop them).

Severity rubric (as in the 2.4.2 review): Critical = unauthenticated compromise or safety bypass; High = privilege escalation,
cross-scope data exposure or a physical action without its control; Medium = an ordinary authenticated role can deny service or read
data it is denied; Low = needs an administrator / a holder of the pairing secret, defence in depth, integrity or audit gaps with a
narrow trigger; Informational = hardening, consistency, or no demonstrated impact.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 4 |
| Informational | 9 |

| ID | Severity | Component | Title | Owner decision needed |
|---|---|---|---|---|
| L1 | Low | `routers/ui_background.py:66-91` | Background upload: no pixel ceiling before a full decode (decompression amplification) | No |
| L2 | Low | `services/device_bulk.py:227-257`, `services/device_types.py`, `routers/devices.py:875` | Turn-all-on reaches a switch the administrator typed as a valve / water heater | Yes |
| L3 | Low | `routers/ha.py:288-335` | LAT1: a device command leaves before it is durably recorded; a busy database leaves no record and no audit row | Yes |
| L4 | Low | `services/backup.py:54-73, 369-371`, `services/self_update.py:342-347` | A replace restore silently switches self-update back on (no keep rule, no own audit row) | Yes |
| I1 | Info | `body_limit.py:53, 127-140`, `routers/ui_background.py:31` | Background upload capped at 1 MiB by the default body limit (12 MB advertised) | No |
| I2 | Info | `services/backup.py:64, 390-395`, `routers/ui_background.py:133-141` | A restored background is served byte for byte as `image/jpeg`, no re-encoding, no `nosniff` | No |
| I3 | Info | `services/floor_images.py:84`, `services/wall_photos.py:114`, `services/plan_render.py:17` | Pillow's `MAX_IMAGE_PIXELS` is a process-wide value three modules overwrite | No |
| I4 | Info | `routers/ui_background.py:88-91` | Two concurrent uploads of one slot share one temporary file name | No |
| I5 | Info | `services/self_update.py:355`, `services/update_runs.py:331-332` | Downgrade guard: the page's `update_available` still uses `!=`; a switch refusal is not audited | No |
| I6 | Info | `auth.py:165-185` | Bootstrap administrator match is now strip + casefold (wider than before) | No (verify) |
| I7 | Info | `routers/ha.py:193, 199, 270-284` | LAT1: `Server-Timing` exposed; 8-worker global dispatch pool; duplicate waits up to 20 s per request | No |
| I8 | Info | `services/connection_probe.py:181-225` | `X-Forwarded-Host` names are DNS-resolved during the NVR probe | No |
| I9 | Info | `routers/settings.py:117, 85-86` | `update.apply_enabled` and the picture stamps are readable by every settings reader; `system.configure` alone governs the update switch | No |

## LOW

### L1 - Background upload: no pixel ceiling before a full decode (decompression amplification)
- Component: `routers/ui_background.py:66-91` (`_store`).
- Description: the upload is sniffed by magic bytes and capped at 12 MB (in practice 1 MiB, I1), then `Image.open` -> `exif_transpose`
  -> `convert("RGB")` decode the whole picture before `thumbnail` reduces it. There is no width x height check (compare
  `services/floor_images.validate`: 36 MP ceiling checked before decoding, and `wall_photos`: 40 MP). The only bound is Pillow's
  process-wide `MAX_IMAGE_PIXELS`, which is a warning (not a refusal) between 1x and 2x of its value, and whose value depends on
  which module ran last (I3; 60 M after `plan_render` is imported, so up to about 120 MP is decoded).
- Exploit scenario: a holder of `system.configure` (or a session of one, e.g. a stolen remote session) posts a flat PNG of 10900 x 10900
  (14.5 KB) to `POST /settings/background/day`, in parallel from several connections. Each request decodes about 119 MP into
  1-bit, a copy, and a 4-byte-per-pixel RGB image in a threadpool thread. On a small Home Assistant host a handful of parallel requests
  exhausts memory (the add-on, and possibly HA core, is OOM-killed). No rate limit on the route.
- Evidence:
  - `test_poc_l1_background_upload_decodes_a_49_megapixel_picture_with_no_pixel_ceiling`: a 7000 x 7000 PNG (well under 1 MiB) is
    accepted (201) and reaches the decode step at full size (the decode itself is replaced by a recorder in the test).
  - Workstation measurement of the same decode chain (Pillow, Python 3.12): 7000 x 7000 PNG of 6 022 bytes -> peak commit +235 MB,
    1.2 s; 10900 x 10900 PNG of 14 499 bytes -> peak commit +568 MB, 1.7 s (about 40 000x amplification of the request body).
- Confidence: high (measured). Exploitable: remotely, authenticated, administrator only - hence Low.
- Recommendation: read `im.size` right after `Image.open` and refuse above a ceiling (for example 40 MP, 422 `too_many_pixels`) before
  any decode; use `im.draft("RGB", (2560, 2560))` for JPEG so the decoder downsamples; do not rely on the global `MAX_IMAGE_PIXELS`;
  optionally a per-user limit on the upload (one at a time).

### L2 - Turn-all-on reaches a switch the administrator typed as a valve / water heater
- Component: `services/device_bulk.py:227-257` (`SwitchPolicy`: only the CR-019 protection list excludes a switch),
  `services/device_types.py` (the override is "presentation only"), `routers/devices.py:875` (`bulk_run`, kinds `switches_on`),
  frontend `screens/devices-area-design.ts` (`SECTION_BULK`: "הדלק הכל" next to "כבה הכל" in the switches section).
- Description: 2.4.2 L7 (a switch NAMED like a valve / water heater turns on without confirmation and in bulk) was accepted by the
  owner on 2026-10-09 for the name-based guess. Two changes since then widen it: DEVTYPE lets an administrator state explicitly that
  a switch IS a valve or a water heater (`device_type_override`), and ALLON puts a one-tap "turn everything on" into every area's
  switches section. The bulk path and the single-switch path never read the override, so a switch the administrator has typed as
  a valve or water heater is turned on by "הדלק הכל" exactly like a plain relay, and singly without a confirmation grant (the real
  `valve.open_valve` asks for one). The confirmation dialog of the bulk lists the targets, which is the only safeguard.
- Exploit scenario: no malice needed. A site administrator (or a custom role holding `devices.control_bulk`) taps "הדלק הכל" in the garden area to turn on the
  lighting relays; the irrigation main valve (typed `valve` by the administrator, not added to the protection list) and the boiler
  (typed `water_heater`) are switched on too.
- Evidence: `test_poc_l2_a_switch_the_administrator_typed_valve_is_turned_on_by_turn_all_on`: two relays typed `valve` and
  `water_heater` are both in the `switches_on` preview targets, neither is excluded, and a single `switch.turn_on` of the typed valve
  answers 202 without a confirmation grant.
- Confidence: high (proven). Exploitable: the bulk by any holder of `devices.control_bulk` (built-in: site_admin, system_admin), the
  single turn-on by any holder of `devices.control` (operator and above); physical effect.
- Recommendation (owner decision): either (a) leave a switch whose effective type (override, else name guess) is `valve` /
  `water_heater` out of the ON kind `switches_on` (the OFF kinds may keep it) with a reason "סוג רגיש" and require the
  valve's confirmation for its single `switch.turn_on`; or (b) setting the type to `valve` / `water_heater` adds the switch to the
  CR-019 protection list automatically (an administrator can remove it); or (c) accept, and record that the DEVTYPE override does not
  change behaviour (it says "presentation only" today, which is accurate but easy to misread in Settings).

### L3 - LAT1: a device command leaves before it is durably recorded; a busy database leaves no record and no audit row
- Component: `routers/ha.py:288-335` (`_run_action`): the signed call is submitted to the dispatch pool (`:297`) before the pending
  `ha_actions` row is committed; a failure of the pending row is only logged (`:299-307`); the row and the `ha.action` audit row are
  written once, after the answer, by `_answer` with three retries.
- Description: before LAT1 the request held the write gate, inserted the pending row and released the lock (commit) before the call,
  so a database that could not record meant no command. Now the command leaves first. If the database stays busy (a long writer, a
  stuck backup or migration) or the process dies between the call and `_answer`, the command reached Home Assistant but Arx has no
  `ha_actions` row, no `ha.action` audit row, and the client gets a 500 (so a user may click again). The docstring's "the row exists
  before the answer is recorded" holds only when the pending write succeeds. AGENTS.md treats physical commands as "record, then
  send"; this is a deliberate latency trade-off (owner bug report LAT1), but its audit consequence was not stated.
- Exploit scenario: integrity / non-repudiation. A user unlocks or switches something while the database is saturated (or an insider
  saturates it on purpose with a heavy export) and the action leaves no trace in the audit log or the device history.
- Evidence: `test_poc_l3_a_device_command_leaves_even_when_nothing_can_be_recorded`: with every `ha.action*` write failing as
  "database is locked", `POST /ha/entities/switch.lobby_sign/actions` sends `turn_off` to the (fake) bridge, answers 500, and leaves no
  `ha_actions` row and no `ha.action` audit row.
- Confidence: high (proven with an injected busy database). Exploitable: needs a database that stays busy for the retry window, or a
  crash at the wrong moment.
- Recommendation (owner decision): keep the fast path but make the record unconditional: (a) when the pending row could not be
  written, keep retrying the final record in the background (a queue drained by a worker) instead of raising, and log the full
  action at WARNING with user, entity, action and request id so the server log is the audit of last resort; or (b) for the sensitive
  domains (lock, alarm, valve, siren, cover of the door layer) go back to "record, then send" and keep fire-first for the everyday
  domains only.

### L4 - A replace restore silently switches self-update back on
- Component: `services/backup.py:54-73` (`SETTINGS_KEEP` does not hold `update.apply_enabled`), `:369-371` (a `replace` restore
  deletes every other settings row), `services/self_update.py:342-347` (`apply_enabled`: a missing row reads as ON).
- Description: an administrator who switched installing from Arx off (2.4.4, `update.apply_enabled = false`, audited as
  `system.update.apply_enabled`) has it switched back on by a `replace` restore of any archive written while it was on - including
  every archive from before 2.4.4 - with no `system.update.apply_enabled` audit row (only the generic restore row). The product
  already treats comparable safety state this way: CR-019 switch protection and the DEVTYPE tables are `KEEP_WHEN_ABSENT`
  ("an older backup must never unprotect every switch").
- Exploit scenario: posture regression, not an escalation (the restore needs the same administrator who could flip the switch). After
  a disaster-recovery restore the installation again installs updates from Arx although the operator's policy said manual-only, and
  nothing in the audit says the switch changed.
- Evidence: `test_poc_l4_a_replace_restore_of_an_earlier_archive_silently_switches_self_update_back_on`: backup (switch on) -> PATCH
  off (one audit row) -> restore -> `apply_enabled` is True and there is still exactly one `system.update.apply_enabled` row.
- Confidence: high (proven). Exploitable: administrator action, no attacker gain.
- Recommendation (owner decision): (a) add `update.apply_enabled` to `SETTINGS_KEEP` (a restore never changes the switch), or
  (b) keep the archive's value but write a `system.update.apply_enabled` audit row with `{"to": ..., "via": "restore"}` when the value
  changes, and show it in the restore result.

## INFORMATIONAL

- I1 - The background upload is capped at 1 MiB, not 12 MB (functional, also bounds L1's request size). `body_limit.LIMITS`
  (`body_limit.py:127-140`) has no entry for `POST /api/v1/settings/background/{slot}`, so `DEFAULT_MAX = 1 MiB` (`:53`) applies and
  the route's `IMAGE_MAX_BYTES = 12 MB` and the frontend's "<= 12 MB" are unreachable; an ordinary phone photo is refused with 413
  `payload_too_large` (stage `request_body`). `tests/test_ui_background.py::test_background_upload_bounds_the_picture_and_refuses_oversize`
  passes only because both limits answer 413. Evidence: `test_poc_i1_...`. Recommendation: add a `LIMITS` row (12 MiB, like
  `floor_image`) together with the L1 pixel ceiling, never without it.
- I2 - A restored background is served byte for byte. A restore writes `ui_backgrounds/<slot>.jpg` from the archive unchanged
  (`services/backup.py:64, 390-395`; the path itself is safe: built from the fixed slot list, `restorable` checks it). The upload's
  re-encoding (the content guarantee) is not repeated, and `GET /settings/background/{slot}` answers `image/jpeg` with
  `Cache-Control: private` but no `X-Content-Type-Options: nosniff` outside the remote channel. An archive is unsigned, so anyone
  who can hand an administrator an archive controls those bytes. Browsers do not sniff an explicit `image/jpeg` into HTML, so no
  script execution was shown (NOT_RUN in a browser); the plan files restored under `plans/` have the same property (pre-existing).
  Evidence: `test_poc_i2_...` (an SVG with a script is restored and served as is). Recommendation: re-encode (or at least verify by
  decoding) restored pictures, and add `nosniff` to the picture response (as `routers/cases.py`, `events.py`, `frigate.py` do).
- I3 - `PIL.Image.MAX_IMAGE_PIXELS` is set at import by `services/plan_render.py:17` (60 M), lowered by `services/wall_photos.py:114`
  (40 M) on every wall-photo call and raised by `services/floor_images.py:84` (`max(...)`, 72 M). The decompression-bomb threshold
  of every other decoder (the background upload, catalog images, skins) therefore depends on which request ran last, and threads race
  on it. Recommendation: one value set once at start, and explicit per-route ceilings (L1).
- I4 - `_store` writes `<slot>.jpg.tmp` then replaces; two concurrent uploads of the same slot write the same temporary file
  (`routers/ui_background.py:88-91`), which can publish a truncated / mixed JPEG (administrator only, integrity of a cosmetic file).
  Recommendation: a unique temporary name (`tempfile.NamedTemporaryFile(dir=..., delete=False)`).
- I5 - The downgrade guard (`self_update.is_newer`) is applied where it matters: `parse_info` (both the check and the apply
  pre-check), so `POST /system/update/apply` refuses an older or equal store version with 409 `update_not_available`. The page
  (`self_update.view`, `services/self_update.py:355`) still recomputes `update_available` as `latest != installed`, so after a manual
  update past the last checked version the page can offer the older "latest" until the next check (the apply then refuses it).
  The 409 `self_update_disabled` refusal (`services/update_runs.py:331-332`) writes no audit row (the worker-side refusal does finish the
  run as failed). Recommendation: use `is_newer` in `view`; audit the refusal as `system.update.apply` denied.
- I6 - `auth.maybe_bootstrap` now matches the configured bootstrap username with `strip().casefold()` (`auth.py:165-185`) instead of
  exact equality. Within one HA that enforces the same normalisation two users cannot collide, but older HA user records created before
  the normalisation (for example `Admin` and `admin`, or names that only casefold together such as `ß` / `ss`) could both match while
  `bootstrap_state` is pending; the first of them to open Arx through Ingress becomes `system_admin`. Whether HA 2026.10 migrates or
  refuses such legacy pairs was NOT verified (no HA contacted). Recommendation: on a pending bootstrap, refuse to bootstrap (and audit)
  when HA reports more than one user whose name normalises to the configured one, or compare HA user ids once known.
- I7 - LAT1 operational notes (`routers/ha.py`): every action answer carries a `Server-Timing` header and a `timing_ms` field (internal
  hop timings, also on the remote channel; low value to an attacker); the bridge dispatch pool is global with 8 workers (`:199`), so
  8 slow calls (HA hanging until the 15 s timeout) delay every other user's command; a duplicate `client_request_id` request waits up to
  20 s on the first one (`:280`) and occupies a threadpool thread meanwhile. No amplification beyond the user's own requests was found.
- I8 - `connection_probe.ha_host_port_field` (`services/connection_probe.py:204-225`) resolves the names from `ha_host_names`, which
  include the request's `X-Forwarded-Host`, inside the probe budget. These names can only add a refusal (port 80 to the HA host), never
  allow anything, but a caller who can set that header makes the add-on perform a DNS lookup of a name of their choice (the probe needs
  the NVR configuration permission). Recommendation: take the forwarded host only from the Ingress proxy (`source == "ingress"`), or
  compare it by name only without resolving.
- I9 - `GET /settings` returns `update.apply_enabled` and `ui.background_images` to every settings reader (viewer included); harmless
  but the update policy is administrator information. The update switch is governed by `system.configure` (PATCH /settings) while
  installing needs `system.update`; with the built-in roles both belong to `system_admin` only, but a custom role holding
  `system.update` without `system.configure` cannot see or turn the switch back on, and one holding only `system.configure` can turn
  installing back on for the update holders. Documented in `CR021_SELF_UPDATE_SECURITY_NOTES.md`; worth a line in the custom-role
  editor.

## Verified safe

- Background pictures:
  - The slot is a closed list (`day` / `night`, 404 otherwise); every file name is built from the slot, never from the upload's name or
    content type; storage only under `<data_dir>/ui_backgrounds/`. The type is decided by content (PNG / JPEG / WebP magic), and the
    stored file is always a fresh JPEG encoded by Pillow, so EXIF, GPS, ICC, XMP, comments and any appended payload are dropped; an
    animated PNG / WebP keeps only its first frame; SVG and any other format are refused 415; a broken image is 422 (decoder errors,
    `DecompressionBombError` and `MemoryError` included, are caught).
  - Upload and delete need `system.configure` at installation scope and are audited (`settings.update` with the slot); reading needs a
    signed-in principal and is `Cache-Control: private`. `ui.background_images` cannot be written through `PATCH /settings` (not in
    `SettingsPatch`).
  - Backup: the archive references only `ui_backgrounds/day.jpg` / `night.jpg` derived from the stamps setting through the fixed slot
    list; restore writes only paths that pass `restorable` (no traversal). A corrupt stamps value reads as "no pictures".
  - Per-user override (`/me/prefs` `ui.background`) is a closed list (`builtin|none|custom`), per user, null = follow.
  - Frontend: the picture address is `apiUrl('settings/background/<slot>')` + `?v=` + `encodeURIComponent(stamp)`, and the CSS value
    strips `"` and `\` before `url("...")`; the stamp string (arbitrary after a restore) cannot break out of the CSS value.
- Brand colours: server (`brand_colors.normalize`) and client (`normalizeBrand`) both accept only `default`, a preset id, `accent` (switch
  colour only) or `^#[0-9a-fA-F]{6}$`; the stored value is re-validated on every read (a corrupt row reads as `default`); the client builds
  `color-mix(...)` only from the validated hex and writes custom properties with `style.setProperty`. No CSS injection path found
  (also from a tampered `localStorage` cache: it is re-normalised).
- Self-update switch: checked twice (the request before anything is stored or sent, and the worker right before the update call); a
  replay of an existing idempotency key only returns the existing run; the apply pre-check refuses a non-newer store version
  (`is_newer`, fail closed on a non-numeric version); the permission for apply / restart is unchanged (`system.update`, same-origin
  check, capped body). `release_notes` reads only the local CHANGELOG of the image (size-capped, never upstream text) and only adds a
  restart reason; it never triggers a restart.
- Device type overrides: `system.configure` checked before the body (`_configure_holder_early_ro`), JSON only, the kind is a literal
  list and checked per domain (`switch`, `input_boolean` only), the entity must exist (`removed_at IS NULL`), 1..500 ids de-duplicated,
  parameterised SQL, one audit row per change plus a batch row (and a denied row for a refused single change); migration 0073 has a
  CHECK on the kind. The override changes only the presentation (`activity_kind`); no permission or control decision reads it (see L2
  for why that matters). Backup: an archive without the tables keeps the current rows (`KEEP_WHEN_ABSENT`), and `device_climate_kind` now
  travels with the archive.
- Turn-all-on: same server path as turn-all-off - `devices.control_bulk`, preview then confirmed run, the run re-resolves on the server
  and refuses a changed set (`target_changed`, digest), CR-019 protected switches, door layer and alarm-managed rows excluded, never
  `input_boolean`, one attempt audit row with entity ids and actor (`test_area_section_turn_all_on_mirrors_turn_all_off` passed).
- Sticky 3D quality: `plan.quality` closed list `auto|1|2` per user (`/me/prefs`) and per installation (`PATCH /settings`,
  `system.configure`); presentation only.
- Settings navigation / search: the index is a static table in the bundle; nothing is fetched to build it, so it reveals no server data;
  entries follow the tab visibility (`visibleGroups(isApi(), canNav)`), and every destination checks its own permission (the device-types
  card renders only for an editor of the settings, and the API refuses others). Deep-link parameters (`?tab=`, `?section=`) are compared
  with fixed strings only (`section === 'device-types'`), never used as a selector or in markup. No new HTML sink in the added frontend
  code (the one new `window.open` opens the internal clip address with `noopener`).
- Security screens: the camera tile's Enter / Space handler acts only when the tile itself is the event target (no inner shadow control
  exists, slotted controls keep their own key handling), and it only opens the camera; the alarm screen keeps the code prompt and
  `needsConfirm` on bypass, and the server-side alarm / door checks were not changed in this diff.
- Crystal skin: a token table only (no `url()`, no external resource); the built-in backgrounds are static files of the bundle; CSP
  `img-src 'self' data: blob:` on the remote channel is unchanged.
- LAT1: every permission / scope / confirmation check still runs before the call (on the read connection); duplicate clicks are
  de-duplicated in memory and re-checked on a fresh snapshot (never a second call); the kept-alive HTTP client never retries a command
  and keeps the token per request, not on the client.
- HA 2026.10 compatibility: the audit `actor` filter uses a deterministic SQL function with a bound parameter (no SQL injection; an empty
  normalised name matches nothing); `/automations/compat` is read-only and `system.configure`; the HA-administrator refusal mapping only
  changes the message; the port-80 rule only adds refusals.
- Fixes of 2.4.3 - 2.4.5 hold: the 2.4.2 regression file (`test_security_review_242_poc.py`, 20 tests: M1, M2, L1, L2, L3, L4, L5, L6)
  passed on the runner at this candidate. L4's `limit_ip` is applied to every limiter key built from the client address
  (`exchange`, `_bearer_session`, `app-download`, APK, logout, CSP).

## L-series residuals (from the 2.4.2 review)

| ID | Status at integ/246 96e6032c | Evidence |
|---|---|---|
| L1 | Fixed (SEC244); the documented shared-room `view_hash` residual and the scoped diff listing remain | 242 regression tests passed |
| L3 | Fixed (SEC244) | `test_l3_*` (4 tests) passed |
| L7 | Accepted (owner 2026-10-09) - exposure widened by DEVTYPE + ALLON, see L2 above | `test_poc_l2_...` |
| L8 | Open: bridge still 0.8.0 in both copies (`custom_components/smplwise_bridge` and `smplwise_vms/integration/smplwise_bridge`, identical, `diff -r` clean); `execute` still only checks that `entity_id` is truthy | `custom_components/smplwise_bridge/__init__.py:307` |

## Residual risks

- L8 (bridge 0.8.1) is still the only defence-in-depth gap on the HA side; a compromised add-on can target every valve with
  `entity_id: "all"`.
- L3 makes the audit trail of device commands best-effort under database pressure; together with 2.4.2 L4's flush semantics, the
  database is now a soft dependency of both the rate limiter and the command audit.
- Unsigned backup archives remain a trust boundary (I2): an administrator must only restore archives they made.
- Not reviewed: the frontend beyond the listed files (Plan Studio curve fitting, kiosk / wall, media, electricity, PWA prompts), the
  mobile apps and push relay, `frontend/scripts/*` (build-time only), the `www` bundle, and anything on real devices.

## Top items to fix first

1. L1 + I1 together: a pixel ceiling before decoding, then the 12 MiB body-limit row.
2. L2: owner decision on typed valves / water heaters in turn-all-on and single turn-on.
3. L3: make the command record unconditional (background retry or WARNING log), or record-then-send for sensitive domains.
4. L4: keep or audit `update.apply_enabled` across a restore.
5. L8 (carried over): bridge 0.8.1.

## Fix status

Fixing task SEC246-fixes, branch `pilot/SEC246-fixes` (fix commit 2f338239; owner decisions for L2 / L3 / L4 of 2026-10-11). The PoC file
`tests/test_security_review_246_poc.py` now holds the regression tests of the fixed behaviour (every PoC in it was inverted).

| ID | Status | Branch / SHA | What changed | PoC inverted |
|---|---|---|---|---|
| L1 | Fixed | pilot/SEC246-fixes 2f338239 | `routers/ui_background.reencode`: header-only `Image.open` (PNG / JPEG / WebP only), width x height checked before any decode (JPEG 64 MP, decoded at a reduced scale via `draft`; PNG / WebP 40 MP) -> 422 `too_many_pixels` (also for a `DecompressionBombError`); one decode at a time per process (`_decode_slot`, waits 5 s, then 429 `busy`) | Yes: `test_l1_a_huge_dimension_png_of_a_few_kb_is_refused_before_any_decode` (+ bomb, phone-photo and decode-guard tests) |
| L2 | Fixed (owner decision 2026-10-11) | pilot/SEC246-fixes 2f338239 | A switch whose FIXED type (`device_type_override`) is `valve` / `water_heater` is left out of `switches_on` (reason `sensitive_type`, counted in `skipped.sensitive_type`, listed in the dialog's details) unless an administrator includes that device: `PUT /devices/entities/{id}/bulk-on` (system.configure, checked before the body, audited `devices.bulk_on_allowed`, a refusal too; 409 `not_sensitive_type` for any other type), Settings › סוגי התקנים checkbox "לכלול בהדלק הכל" (default off). A type change drops the inclusion. Stored as the settings row `devices.bulk_on_allowed` (travels with a backup; an archive without it - every older one - leaves every typed device out). OFF kinds and the single turn-on unchanged (owner) | Yes: `test_l2_turn_all_on_leaves_out_a_switch_the_administrator_typed_valve_or_water_heater` (+ include / audit / RBAC / backup tests) |
| L3 | Fixed (owner decision 2026-10-11) | pilot/SEC246-fixes 2f338239 | `routers/ha._run_action`: the pending `ha_actions` row and an `ha.action` row (`reason: attempt`, `phase: attempt`) are committed in one write BEFORE the signed call; the write waits at most `PENDING_WAIT_S` = 2 s (`Database.write_aside(wait_s=...)`), else 503 `busy` (`details.sent: false`), nothing sent, a WARNING log line with user / entity / action / request id. The outcome row follows as before (two `ha.action` rows per sent command). LAT1: the idle bound is kept; a write lock held 1.5 s now delays the call until the record is written (by design; `test_lat1_toggle_latency.py` updated, numbers in the task report) | Yes: `test_l3_a_device_command_is_not_sent_when_its_record_cannot_be_written` (+ order test) |
| L4 | Fixed (owner decision 2026-10-11) | pilot/SEC246-fixes 2f338239 | `update.apply_enabled` joined `SETTINGS_KEEP`: never written to an archive, never restored (also not from an older archive that holds it); every restore writes a `system.update.apply_enabled` audit row (`reason: kept_on_restore`, `kept`, `archive`, `archive_differed`) and answers `update_apply_enabled` | Yes: `test_l4_a_replace_restore_keeps_the_current_self_update_switch_and_audits_it` (+ older-archive test) |
| I1 | Fixed | pilot/SEC246-fixes 2f338239 | `body_limit.LIMITS` row `ui_background`: `POST settings/background/{slot}` = 12 MiB + 64 KiB (with the L1 guard in place); CR-008 section 9 table updated | Yes: `test_i1_a_background_over_one_mib_is_no_longer_refused_by_the_default_body_limit` (+ limit-row test) |
| I2 | Fixed | pilot/SEC246-fixes 2f338239 | A restore passes each `ui_backgrounds/*` file through `reencode` and writes the fresh JPEG atomically; a failing file is not written (the slot's old file removed) and listed in `backgrounds_rejected`; the picture response carries `X-Content-Type-Options: nosniff` and a fixed `image/jpeg` | Yes: `test_i2_a_restored_non_picture_is_not_written_and_never_served` (+ re-encode / nosniff test) |
| I3 | Fixed | pilot/SEC246-fixes 2f338239 | `services/image_guard.py` sets `MAX_IMAGE_PIXELS` once (60 M, plan_render's value); `plan_render`, `floor_images`, `wall_photos` import it and no longer write it; their own ceilings (36 MP, 40 MP) stay explicit checks. Side effect: a wall photo between 80 M and 120 M pixels is now `too_many_pixels` (413) instead of `corrupt_image` (422) | New test `test_i3_no_module_but_image_guard_writes_pillows_process_wide_threshold` |
| I4 | Fixed | pilot/SEC246-fixes 2f338239 | `write_atomic`: `tempfile.mkstemp` in the slot folder + `os.replace` (and the decode guard serialises same-slot uploads) | New tests `test_i4_*` |
| I5 | Fixed | pilot/SEC246-fixes 2f338239 | `self_update.view` uses `is_newer`. The 409 `self_update_disabled` refusal was already audited once as `system.update.apply` denied by `routers/system_update._refused` (the review missed that path); a regression test pins it to exactly one row | New tests `test_i5_*` |
| I6 | Open (verify against HA 2026.10) | | | |
| I7 | Open | | | |
| I8 | Open | | | |
| I9 | Open | | | |
| L8 (2.4.2) | Open | | | |
