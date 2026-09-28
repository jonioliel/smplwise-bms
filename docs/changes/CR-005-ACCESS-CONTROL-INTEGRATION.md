# CR-005 — Access Control tab: embed WisKey (hikvision_intercom) capabilities in SMPLWISE VMS

**Numbering:** registered as CR-005 on 2026-09-27 (CR-001 HA identity/RBAC, CR-002 lab-accounts deviation,
CR-003 Plan Studio, CR-004 floor/level unification, proposed but not started).

**Status:** Proposed 2026-09-27. Full source extraction complete (`docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md`,
~9,800 lines, factual only). This document is the design proposal built from that extraction. Nothing below is
binding until the owner signs off on the open decisions in §7 — in particular, no physical-action capability
(§4) is implemented without its own separate, task-specific approval at the time, regardless of this CR's
overall sign-off.

## 1. The request (owner, 2026-09-27, translated)

The owner built and actively maintains their own Home Assistant custom integration, **WisKey**
(`hikvision_intercom`, HA-facing product name "smplwise access control"), which already has a full, polished,
hand-built HA panel for controlling Hikvision video-intercom door stations — people/credentials, doors, schedules,
events, health, and more. The ask, verbatim in substance: **all of it**, embedded as a new tab in SMPLWISE VMS
next to Map and Investigation, called **"בקרות כניסה" (Access Control)** — full parity, full editing, every
capability that exists in WisKey today — **without removing the WisKey integration itself**, which stays
installed and remains the sole authoritative backend. The owner offered, and this session used, a clone of the
WisKey source repository to make true parity possible rather than working from documentation summaries alone.

This is explicitly the larger of two scope options the owner was offered (a phased minimal read-only slice vs.
full parity); per this project's standing practice, that scope decision is now final, while the *build order* is
still staged into releases the same way every other large feature (Plan Studio, the multi-select trilogy) was
built — read-only first, then writes, with every physical action gated on its own explicit approval.

## 2. What WisKey actually is (facts, not opinion — full detail in the source extraction)

- 25 user-facing screens/dialogs, 143 WebSocket command names (134 core `hikvision_intercom/*` commands plus
  `subscribe`, 6 `audio/*`, 2 `tts/*`), plus 2 HTTP media views and a handful of HA entities/services.
- **WisKey's own authorization model is coarse**: five areas (`overview`, `users`, `events`, `stations`,
  `management`) × three levels (`none`/`view`/`manage`), per HA user, with HA administrators bypassing entirely.
  There is **no per-station, per-door, or per-action grant** — door release, call answer, two-way audio and TTS
  all share one grant (`overview:manage` OR `stations:manage`). WisKey's own docs acknowledge this limit.
- **The only live push channel is data-free.** `subscribe` delivers `{"kind":"refresh"}` or
  `{"kind":"access_revoked"}` — nothing else. The only channel that carries real event data is two HA `event`
  entities per station (`<uid>_doorbell`, `<uid>_access`), which have no WisKey event id and cannot be matched
  back to the activity log.
- **About 10 commands are PHYSICAL** (door release, call answer/reject/hangup, two-way audio start/send/receive/
  mute, TTS speech, card-reader capture-mode), one is ambiguous (a door-parameter write that may flip a relay),
  and one is EXTERNAL (WhatsApp send, a real message to a real person). WisKey's own UI ships **zero confirmation
  dialog before door release**.
- **Autonomous physical actions happen with no screen open**: a 15-second HA-side timer holds a door open on a
  program schedule; a ~300 s periodic reconciliation pushes central data to devices; HA-mode user-timing renews a
  rolling access window on the device.
- **A real secret-handling gap**: `whatsapp/preview` returns a person's PIN in plaintext inside the preview
  message body to any `users:manage` holder — the one PIN-disclosure path found in the whole surface.
- Storage (`.storage/hikvision_intercom.*`) is explicitly **off-limits to any external reader/writer** by
  WisKey's own design and documentation — every legitimate access path is the WS command layer, the `subscribe`
  push, HA entities/services, config-entry diagnostics, and the MSE/RTC media views. This matches SMPLWISE's own
  standing rule (never read/write another integration's `.storage/*` files).
- Full detail — every screen, every command's exact fields/permission/classification, the complete i18n/error
  vocabulary, and 38 open questions/gaps found in the source — is in
  `docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md`. This CR does not repeat that detail; it reasons from it.

## 3. Architecture

**WisKey remains the sole writer.** SMPLWISE's new tab is a pure client of the same command surface WisKey's own
frontend already uses — it issues `hikvision_intercom/<command>` over Home Assistant's core WebSocket API, the
same way WisKey's own panel does, and never touches `.storage/hikvision_intercom.*` directly.

**No new low-level plumbing is needed.** `smplwise_vms/backend/smplwise/services/ha_client.py` already has a
generic, authenticated WebSocket session (`ws_session`) with a typed `call(msg_type, **kwargs)` helper, used
today for other HA integration. A new, thin service module —
`smplwise_vms/backend/smplwise/services/intercom_client.py` — wraps it with one typed async function per WisKey
command SMPLWISE actually surfaces (see the phase lists in §4), plus a long-lived background task that holds one
`subscribe` and re-broadcasts its data-free "refresh" signal to SMPLWISE's own connected clients (mirroring
exactly what WisKey's own panel does with the same signal — refetch, don't expect payload).

**Port the owner's own WisKey frontend source, do not re-derive it from the command inventory.** An earlier
draft of this section under-committed to reuse — corrected here after the owner pointed out that redeveloping
every screen from scratch, when the actual working implementation already exists in their own repository, is a
real waste of the very work this extraction was done to inform. The right split, by layer:
- **Backend Python cannot be reused directly, and should not be** — not because of licensing (it is the owner's
  own code, no such issue exists) but because WisKey's backend modules are the code that owns
  `.storage/hikvision_intercom.*` and talks to the physical ISAPI devices; copying that logic into SMPLWISE would
  create a second writer to the same devices/storage, which is exactly the architecture the owner explicitly
  asked to avoid ("without removing the installation of the integration... use the integration that already runs
  inside HA"). SMPLWISE's backend genuinely has nothing to port here — its whole job is to be a thin caller of
  the same commands, which is why `intercom_client.py` above is small by design, not under-built.
- **Frontend TypeScript/Lit source is the opposite case, and should be ported, not rewritten.** The screen logic
  in the owner's `frontend/src/*.ts` — `panel.ts`'s per-screen render functions, `editorBody`'s validation and
  save-payload construction, every dialog's field mapping and business rules — already correctly encodes years of
  real-world edge cases against the actual devices (masked card numbers, review-token flows, revision-conflict
  handling, and the like, all catalogued in the source extraction). Re-deriving this from the command inventory
  alone would silently drop hard-won correctness. The concrete adaptation needed at the port boundary: every call
  site that does `hass.callWS({type: "hikvision_intercom/...", ...})` (directly, or through the `protectedHass`
  proxy) is rewritten to call a new SMPLWISE frontend helper with the same call shape, which posts to a new
  SMPLWISE backend endpoint that in turn calls `intercom_client.py` — because SMPLWISE's browser client never
  holds HA credentials or talks to HA directly (ADR-005/ADR-012, a standing rule, not a WisKey-specific one), so
  the literal `hass.callWS` transport cannot survive the port unchanged even though almost everything around it
  can. Presentation is also re-skinned onto SMPLWISE's own `sw-*` component library and design tokens rather than
  WisKey's own `wiskey-v4-styles.ts`/CSS, so the new tab reads as part of this product, not a bolted-on panel —
  the UNIFI-style design mandate already established for the rest of SMPLWISE applies here too. Each phase-1..4
  implementation task (§4) should start from the corresponding WisKey source file(s), port the render/validation/
  event-handling logic with the transport and styling substitution described above, and treat "write it from the
  command table" as the fallback only for screens with no real WisKey UI to port from (there are a few — see the
  "backend commands with no screen" list in the extraction, §Y item 1).
- This changes §4's actual time estimate (already given to the owner in chat as a rough order of magnitude) in
  the direction of less effort, since a meaningful share of each phase's work is porting/rewiring existing,
  already-correct logic rather than authoring new logic from a spec — but it is not free either (the transport
  rewrite and the re-skin both take real work), so the estimate is not revised down here until phase 1 is
  actually built and the real per-screen porting cost is measured once.

**SMPLWISE gets its own permission scheme, not a 1:1 mirror of WisKey's five areas.** SMPLWISE already has a
fine-grained, scoped RBAC (permission strings like `map.read`, `sources.configure`, checked per
INSTALLATION/site/etc. via `rbac.py`'s `require`/`authorize`). Every Access Control action in SMPLWISE checks
SMPLWISE's own permission first, exactly like every other tab — proposed new permission strings:
- `access.read` — see stations, people, activity, schedules (read-only).
- `access.people.manage` — create/edit/delete people, cards, PINs, groups, bulk operations, CSV.
- `access.doors.manage` — door programs, public codes, technical settings, schedules/deployment (config-write,
  no physical actuation).
- `access.release` — door release, call answer/hangup, two-way audio, TTS, card capture (**every PHYSICAL
  command**, gated separately from ordinary "manage" so it can be granted narrowly).
- `access.admin` — WisKey-facing admin surfaces (WhatsApp templates, appearance, HA-user permission directory,
  operations center) that WisKey itself reserves to HA administrators.

This deliberately does **not** inherit WisKey's own found problems: no per-door granularity, admins-bypass-
everything, and the client-vs-server gate mismatches catalogued in the extraction (§Y.5). SMPLWISE's RBAC can be
as granular as the product needs later (e.g., per-site or per-door scoping) without touching WisKey at all —
WisKey's own coarse per-command check then becomes a second, background-service-level gate, not the primary one.

**Accountability gap and its mitigation.** WisKey's own audit trail attributes every action to the HA user of the
WebSocket connection that made it. If SMPLWISE's backend proxies every action through **one** shared HA service
account (the add-on's own long-lived token — the only supported way SMPLWISE talks to HA today), WisKey's own
audit log loses per-real-person attribution for anything done through SMPLWISE's tab; every row would show the
same HA user. **Mitigation:** SMPLWISE already has its own `audit()`/`audit_log` mechanism (used for every other
action in the product). Every Access Control action SMPLWISE proxies must be recorded there under the real
SMPLWISE actor, with the underlying WisKey command and outcome as detail — SMPLWISE's own audit log becomes the
accountability record for anything done through this tab, compensating for what WisKey's own log cannot show.
This needs the owner's explicit sign-off (§7, decision 3) since it is a real, if mitigated, trade-off.

**Physical actions get a confirmation SMPLWISE's UI adds that WisKey's own UI lacks.** Every PHYSICAL command
(§2) gets an explicit confirm step in SMPLWISE's UI before it fires — stricter than the source, not equal to it,
matching this project's general posture of being more careful than a reused system where reuse allows it.

## 4. Phased build order (mirrors how every other large feature this session was actually built)

Each phase below is a release-sized slice with its own tests and review, exactly like the Plan Studio phases and
the multi-select trilogy. **No phase begins implementation until the prior phase has shipped and this CR's open
decisions (§7) are resolved for phase 1.** Every capability tagged PHYSICAL below additionally needs its own
separate, explicit, task-specific owner approval at the time it is scheduled — this CR's sign-off approves the
plan and the read/config-write phases, not the physical actions themselves.

**Phase 1 — read-only foundation.** New "בקרות כניסה" nav tab, gated on `access.read`. `intercom_client.py`
service + the background `subscribe` relay. Screens, read-only: Entry Center/overview equivalent (station cards,
online/ringing state, last access — S2), Activity/events (S13), People list + person details (S5/S6, no
editing), Doors/stations overview (S11, no writes). No release, no calls, no edits of any kind. This alone is a
complete, independently useful slice.

> Recorded deviation 2026-09-27 (T054, phase 1a, superseded same day): the WisKey tab first shipped as a sub-tab
> ("WisKey", `#/explore/access/d1`) under the existing "sites" nav group, to keep the boards' six flat top-level
> entries (ADR-009 note in docs/architecture/DECISIONS.md). The owner corrected this the same day: WisKey is now a
> genuine top-level nav destination in both nav designs (`#/wiskey/overview`), a peer of Map/Investigation/System,
> not nested under either - see the follow-up ADR-009 row in docs/architecture/DECISIONS.md recording that
> deliberate exception. `access.read` is still checked at installation scope only, since WisKey stations are not
> mapped to sites or floors - that part of the original decision is unchanged.

> Recorded deviation 2026-09-27 (T054, phase 1a): `access.read` is granted by default to the built-in roles viewer,
> operator, editor, site_admin and system_admin - the same breadth as `map.read` - and not to kiosk, which stays live
> video and map only (T057). §3 names the permission but did not decide its role grants; this is that decision, made by
> the coordinator when reviewing T054, not an implementer default. Consequence to keep in view: every holder sees real
> person names and employee numbers in the stations' last-access records, and phase 1b's people list is planned under
> the same permission. Narrowing it later means removing it from those roles in `roles.json` (and the design catalogue)
> or moving the people screens to a separate permission; custom roles can already leave it out.

**Phase 2 — config-write, zero physical actuation.** Gated on `access.people.manage` / `access.doors.manage`.
Person editor full CRUD including cards/PINs/timing (S7), card capture *excluded* here (it is PHYSICAL — reader
collection mode — moves to Phase 3), CSV import/export (S9), bulk operations (S5), import/adopt existing device
records (S10), schedules library + deployment plans (S16), profile/group settings (S19), door technical settings
*excluding* anything that can flip a relay (S11 Settings, minus `relayReverseEnabled`), public codes (S11 — this
one is CONFIG-WRITE(D) per the extraction but grants a real access code, so treat it with the same care as a
physical grant even though it is not itself an actuation), sync/conflict resolution (S12), health/audit (S14/S15).

> Recorded deviation 2026-09-28 (T054, phase 2 slice A1, person editor core; implements the kick-off decisions 1, 5, 7
> and 8 for people): (1) `access.people.manage` is registered exactly like `access.release` (site_admin + system_admin
> by default, sensitive, installation scope, in the role catalogue and the design contract; a custom role with it among
> its sensitive permissions plus a binding is the per-person grant path). (2) The editor has its own projection
> (`intercom_sync.project_person_editor` / `project_editor_context`, endpoints under `access.people.manage` only):
> phone, `pin_configured`, cards in WisKey's masked form, overrides, `identity_locked`, assignment bookkeeping; the
> `access.read` projection is unchanged and `photo_configured` is not served (no photo in this slice). (3) People writes
> ride a third feed lane (`config`, one slot, own buckets) so a held save never takes a release slot; the write path
> (permission before body, JSON only, envelope, attempt / outcome audit) is the phase-3 one; audit details are field
> names and counts plus id / employee number / display name - never PIN, card number, phone. (4) Refused vs unknown for
> `users/create|update|delete` follows the brief's A.4 table verified against the source (`intercom_client.PRE_STORAGE`);
> `storage_write_failed`, `manager_closed`, `action_failed`, `device_unavailable` and unknown codes are "unknown".
> (5) Station access is sent exactly as WisKey's own editor sends it - `permission_overrides` + `door_permissions` (the
> enabled stations' relays) + `access_policy_revision` (when WisKey has a profile policy) - and never as the legacy
> absolute `assignments`: the review of the first round proved, against WisKey's `group_permissions.prepare`, that under
> `assignments` an already-allowed station keeps its previous relays, so a relay removed from an existing assignment
> would have been silently kept while SMPLWISE reported "saved" (review B1, fixed before merge). A station a group
> grants is shown enabled; every toggle sets a personal override (allow / deny beats the group), as in WisKey. Group
> membership itself and the per-station "inherited from group X" labels come with slice A3. (5a) The editor context is
> served at `/intercom/people-editor/context` (the brief's `/intercom/people/editor-context` would collide with the
> `/intercom/people/{user_id}` route). (6) Cut to A3, stated on the form (no disabled stubs): weekly / dates timing and enforcement, profile
> fields, groups, templates, photos; validity here is permanent / date range in the HA zone only (WisKey's zone-basis
> select is not ported). Cut to A2: card capture and the USB wedge. (7) No `pin_check`: `pin_conflict` at save plus
> `users/pin_generate`. (8) The delete dialog counts the person's assignments; WisKey's own count adds pending
> revocations, which the feed's projection does not carry. (9) The requirement that the add-on's HA user holds
> WisKey's `users:manage` area is stated in DOCS.md and surfaced by the editor context (`writes_listed` /
> `users_manage` from `overview.api.commands` / `access.areas`), unverified against the lab. Open item for the owner:
> a generated PIN is filled into the two password fields only, as WisKey does, so the administrator cannot read it
> to hand it over; whether SMPLWISE should show it once in clear (an owner decision on secret handling) is not decided.
> Decided 2026-09-28 (owner, option ב): after "יצירת PIN ייחודי אוטומטית" the editor shows the freshly generated PIN
> ONCE in clear, with a "העתק" button (Clipboard API; where the browser has none - HA over plain http is not a secure
> context - a note asks to copy it by hand), and hides it again as soon as the administrator copies it, clicks
> "הסתר", edits either PIN field, saves or closes the form; hidden, it is no longer in the DOM (it stays only in the two
> password fields for the save). A stored PIN is never shown - WisKey never returns one - and the value is never
> logged or audited. Evidence: `evidence-wiskey-editor.spec.ts` (a shadow-root walk over clear text). A copied PIN
> stays in the operating system's clipboard (and its clipboard history) until overwritten - outside SMPLWISE's reach;
> stated in DOCS.md.

**Phase 3 — physical actions, each individually approved before it is built.** Door release (`stations/
test_unlock`, with a confirmation dialog WisKey itself lacks); door programs (`technical_program_save`/`_action`
— scheduled/immediate real actuation); the ambiguous `technical_update` field (`relayReverseEnabled`); call
answer/reject/hangup (`media/signal`); two-way audio/talk (`audio/*`); TTS (`tts/*`); card capture
(`cards/capture_start`, puts a real reader into physical collection mode).

> Recorded decision 2026-09-27 (T054, phase 3, first slice): the owner approved all eight physical / external
> capabilities in chat; this slice builds three of them - door release, call answer / reject / hang up, TTS
> announcement - on the entry center. `access.release` is granted by default only to site_admin and system_admin
> (installation scope), not to viewer, kiosk, editor or operator, and is listed in `sensitive_permissions_not_implied`;
> the reasoning is recorded at `routers/access.py` PERMISSION_LABELS. Granting it to operator (the guard-desk role) is
> left to the owner. Confirmation, per §3 / §5: door release goes through a confirmation dialog and the API refuses a
> release without `confirmed: true`; call controls take two taps (the first arms the button for 4 s) - lighter than a
> dialog because the operator is already handling a live call; the announcement is composed and sent from its own
> dialog, which states that the text goes to the selected Home Assistant TTS engine (possibly a cloud provider). A
> release reply is shown as "accepted by WisKey", never as "the door opened". Every attempt is audited under the real
> SMPLWISE actor (§3 accountability). Two-way audio, card capture, door programs, relay reversal and WhatsApp remain
> for later slices.
>
> Review round 1 (2026-09-28), recorded in `routers/access_control.py`'s physical-actions section note: every request
> past the permission check is audited - a pre-send refusal as one `denied` row, a sent command as an attempt row
> committed BEFORE sending plus a best-effort outcome row; an answer WisKey gave with `success: true` but in an
> unexpected shape is "outcome unknown", never "refused"; a relay stays blocked until WisKey's call is really over and
> 10 s more after an unknown outcome; every physical request carries `client_request_id` + `expires_at` (the HA
> bridge's envelope; 15 s from the UI, at most 60 s, re-checked immediately before sending); physical actions have their
> own in-flight slots and rate buckets; a failed overview refetch no longer cuts an announcement that is playing.

> Recorded deviation 2026-09-28 (T054, 0.1.109, station camera stills): the owner reported that the entry-center
> cards showed no camera image. Real WisKey renders its per-station still from HA's camera proxy (`entity_picture`,
> ISAPI `/ISAPI/Streaming/channels/101/picture` behind it) and uses go2rtc only for live video (extraction §0.4-0.5).
> The owner directed the opposite for SMPLWISE: no camera image or video is ever fetched from Home Assistant; the
> still goes through go2rtc like every NVR frame, so the product has one video pipeline (MSE/WebRTC settings included).
> This is a conscious departure from parity, not an oversight. Consequences: (1) the station's RTSP account must be
> held by SMPLWISE, as it already holds the NVR's - new add-on options `wiskey_username`/`wiskey_password` (the same
> account for every station, the owner's stated assumption) plus an admin-only per-station override; (2) that
> override is the first credential the product stores in its own SQLite database rather than in add-on options
> (`routers/settings.py`'s "secrets stay in the add-on options" rule is still the rule for everything else):
> table `wiskey_station_credentials`, `system.configure` only, write-only API, audited without the secret, excluded
> from the product's backups, plaintext at rest exactly like `options.json` under `/data`; (3) the station host comes
> from WisKey's overview (its `stations` area) and is never served, logged or audited; (4) go2rtc keeps the stream
> `smplwise_wiskey_<station>` in memory only (no config write), and the RTSP address is handed to go2rtc once per
> registration because go2rtc before 1.9.14 logs it - every other grab is by name. Still open: the override admin
> screen (API only today), the fixed RTSP port 554 (WisKey does not expose a station's port), and the first check
> against a real go2rtc and a real door station (only the committed fake has been used).

> Recorded decision 2026-09-28 (T054, phase 2 kick-off; answers to `docs/changes/CR-005-PHASE2-BRIEF.md` §4, owner in chat):
> (1) people editing is a new installation permission `access.people.manage`, granted by default to site_admin and
> system_admin only, and the owner must be able to grant it to one specific person or role holder - satisfied by the
> existing custom-role + binding mechanism (`POST /access/roles`, `POST /access/bindings`), so the permission must be
> listed in the role catalogue and the sensitive list like `access.release`; (2) card capture is its own permission
> `access.cards.capture` (in addition to people.manage), same default and the same per-person grant path; (3) door
> programs and relay reversal share one permission `access.doors.physical`, same defaults; visibility of the programs
> list follows WisKey's own rule (not decided separately); (4) pausing or removing a door program is also allowed to
> `access.release` holders, so a guard can end a hold-open; (5) card numbers are shown masked (`•••• 1234`), exactly
> what WisKey returns; (6) photos exactly as WisKey implements them (stored photo shown, capture/upload included);
> (7) access timing in full, including station-native schedules, as WisKey; (8) no live PIN-availability check -
> save-time `pin_conflict` plus "generate unique PIN"; (9) relay mapping and public codes are built with their writes,
> as WisKey has them; (10) the owner considers the physical flows (capture, relay reversal, program activation)
> validated by WisKey's own use and asks for a like-for-like port; no separate lab protocol was requested. Recorded
> as stated; the brief's §6 UNVERIFIED items stay listed (in particular WisKey's own "physical collection still needs
> commissioning" string), so the first real use of each flow is treated as its live test. Sequencing: A1 editor core
> first, then A2 capture, then A3 (schedules/photo), then B1-B3.

> Recorded deviation 2026-09-28 (T054, phase 2 slice A2, card capture; implements kick-off decisions 2 and 10):
> (1) `access.cards.capture` is registered exactly like `access.release` / `access.people.manage` (site_admin +
> system_admin, sensitive, installation scope, role catalogue + design contract, per-person grant through a custom role)
> and is required IN ADDITION to `access.people.manage` on every capture endpoint (readers, start, status, cancel,
> confirm); card capture no longer rides on `access.release` as §3 first wrote. (2) Like-for-like port of WisKey's flow
> (access/enrollment.py, panel.ts:1432-1630): `cards/reader_capabilities` -> `cards/capture_start` -> status ->
> `cards/capture_confirm` or `cards/capture_cancel`, WisKey's own names, payloads (`api_contract: 1` on all five, as
> WisKey's panel sends them) and limits (the reader's 30 s wait inside WisKey's 70 s collection bound, 120 s session,
> one session per station, three in all).
> WisKey never returns the collected number - its status carries `CapturedCard.public()` only (`•••• NNNN`) - so the
> card cannot be "filled into a new-card row" of the draft and saved with the person: the admin approves the card in
> the capture dialog (WisKey's `capture_confirm`, which stores it and requests the stations' sync), behind a
> confirmation naming the person, and the editor then reloads the record with the card among the saved ones (masked).
> Nothing is stored without that approval; capture is offered only for a saved, unmodified person (WisKey
> `editorAction`). (3) Differences from WisKey's panel, as this CR's §5 asks for physical actions: a confirmation step
> before the reader is started (the API refuses a start without `confirmed: true` and the command envelope), a live
> countdown, honest end states WisKey's panel has no text for (cancelled, expired, WisKey no longer knows the session,
> a start / cancel / approval with an unknown outcome - "the reader may still be collecting until WisKey's timeout").
> (4) Sessions are SMPLWISE-owned: WisKey owns sessions by HA user, which is the add-on's one user for every SMPLWISE
> user, so `services/intercom_capture.py` maps each WisKey `session_id` to the SMPLWISE user who started it and serves,
> cancels or confirms it for that user only (404 for anyone else); at most one open capture per SMPLWISE user and per
> station. (5) The browser never polls WisKey: a backend poller reads each session's `cards/capture_status` every
> 1.5 s (WisKey's panel: 1 s per open dialog) and the dialog reads SMPLWISE's copy; the brief's `intercom_capture`
> notices on `/intercom/ws` were NOT used, because that socket is broadcast to every `access.read` holder and would
> carry another user's masked card. A session nobody asked about for 20 s is cancelled by the backend; a session that
> WisKey failed (`error`, e.g. `capture_timeout`) is cancelled on WisKey too (WisKey keeps it, and the station's one
> capture slot, until its TTL; its panel cancels on close / collect again). (6) Lanes: start / cancel / status ride a
> fourth feed lane `capture` (one slot, own buckets; 4 + 2 + 1 + 1 slots against WisKey's 8), the approval rides the
> config lane (a people write), `reader_capabilities` the read lane with a 40 s timeout - a capture can never take a
> door release's slot. (7) Refused vs unknown per command from the source (`intercom_client.PRE_CAPTURE`): start
> refused = PRE_DISPATCH + `manager_closed`, `station_not_found`, `station_offline`, `station_has_no_managed_lock`,
> `user_not_found`, `revision_conflict`, `capture_station_busy`, `capture_limit` (all raised in `start()` before the
> collector exists); unknown = `action_failed`, `device_unavailable`, any other code, a reply without a session id, no
> reply - and the station is then held for the rest of WisKey's 120 s. Cancel refused = PRE_DISPATCH +
> `capture_not_found`, `capture_applying`. Confirm refused = PRE_DISPATCH + `capture_not_found`, `capture_not_ready`,
> `invalid_text`, `user_not_found`, `revision_conflict`, `card_conflict` + the users/update pre-storage codes; unknown =
> `storage_write_failed`, `manager_closed`, `action_failed`, anything else. (8) Audit: start / cancel / confirm rows under
> the real actor (attempt + outcome), the poller's result rows (`captured`, `timeout`, `error`, `expired`, `lost`) and
> the backend's own cancel of an abandoned session under the session's owner - ids, station, reader, states, WisKey's
> codes, `cards_added: 1`; never the number, not even masked. (9) The UI button and dialog use WisKey's Hebrew copy
> ("קריאת כרטיס מהאינטרקום" ...), not a new wording. UNVERIFIED (brief §6, unchanged): capture on a real station
> ("physical collection still needs commissioning"); whether an already-enrolled card presented during collection also
> opens the door; how long the reader stays in collection mode after a cancel / timeout (firmware); the add-on user's
> WisKey `users:manage`. The first real use is the live test (owner decision 10) - recorded in DOCS.md.
> Review round 1 (2026-09-28): (a) the capture poller pays its status reads from a bucket of its own (3 at 1/s; one
> read per session every 2 s, every 3 s while more than one is followed - at most 1 read/s against WisKey) and never
> from a user's or the lane's shared tokens, and a cancel spends no token at all, so polling can never get a cancel
> (or another user's start) refused locally; the dialog's close-time cancel is awaited and retried once. (b) The
> dialog's countdown is the reader's 30 s wait (WisKey's device request deadline, its own "up to 30 seconds" copy),
> not the 70 s bound. (c) Disclosed: the session map is in memory - an SMPLWISE restart during a capture orphans
> WisKey's session, the station stays busy up to 120 s and a new start there is refused `capture_station_busy` (safe;
> in DOCS.md). (d) A session the backend cancelled because nobody asked for it (20 s) carries `reason: abandoned`, and
> the dialog says why.

> Recorded decision 2026-09-28 (embedded panel; owner in chat, translated): "Hybrid, but by default I would not show
> what we built but WisKey as it is. In Settings create a dedicated section for access control and let me choose which
> screen to show for each option. My tendency is to set what we built aside and rely on the iframe - it saves a lot and
> lets me keep developing WisKey without building everything twice."
> **What it changes.** (1) The WisKey area embeds the owner's real WisKey Home Assistant panel as-is: `wiskey-embed`
> frames `/hikvision-intercom` (registered by `hikvision_intercom/panel.py` through `panel_custom`,
> `require_admin=False`, `embed_iframe=False`, webcomponent `hikvision-intercom-panel`). SMPLWISE runs under Supervisor
> Ingress on Home Assistant's own origin, so the root-relative frame is same-origin with HA; HA's default
> `X-Frame-Options: SAMEORIGIN` permits it (Ingress itself is such a frame). (2) הגדרות › בקרות כניסה chooses per screen
> SMPLWISE built - מרכז הכניסה, פעילות, אנשים (with the person editor and card capture that open from it) - between
> "WisKey (מוטמע)" (default) and "SMPLWISE"; settings `access.ui.overview|events|people` = `wiskey|smplwise` in
> `routers/settings.py`, readable by every user (the shell routes by them), changed only with `system.configure`,
> audited as `settings.update` like every product setting. The tab keeps its label and place either way. (3) WisKey's
> other screens are embedded-only tabs in both navigation designs: עמדות (`devices`), סנכרון (`sync`), בריאות (`health`),
> יומן שינויים (`audit`), ניהול (`tools`, the hub of schedules, camera wall, media/clock settings, operations center,
> permission directory, WhatsApp templates, access control). All eight WisKey tabs are offered on `access.read` at
> installation scope (`INSTALLATION_ONLY_HREFS`), as before. (4) Everything built so far stays intact and reachable when
> selected; nothing is deleted. The remaining port slices - A3 (schedules/photo), B1-B3, WhatsApp - are **not built for
> now**; the embedded panel covers them.
> **A principle deliberately relaxed.** §3's "the browser never talks to WisKey directly" no longer holds for the
> embedded screens: inside the frame the browser IS WisKey's own frontend, signed in with the user's own Home Assistant
> session. WisKey's own permissions (its per-area none/view/manage directory), confirmations and audit apply there -
> not SMPLWISE's RBAC, SMPLWISE's physical-action confirmations or SMPLWISE's audit log. SMPLWISE only decides whether
> to offer the tab. Concretely: a user whose HA account holds WisKey `manage` (or is an HA administrator) can release
> doors and edit people inside the embed with no SMPLWISE confirmation and no SMPLWISE audit row (the settings section
> and DOCS.md say so). What SMPLWISE reads inside the frame: `hass.kioskMode` and the keys of `hass.panels` on
> `<home-assistant>`, and the panel's `_tab` and whether its `_session` has loaded - no tokens, no localStorage, no
> entity state, no WisKey data. A user without a Home Assistant login cannot use the embedded screens at all; the SMPLWISE screens
> (still selectable) keep the old model.
> **Deep link.** WisKey's panel keeps its tab in memory (`panel.ts` `_tab`, default `overview`; no URL/hash routing), so
> the tab is applied from the parent through the panel's own `navigate(tab)` - ONCE per SMPLWISE tab change or frame
> load, after the panel's `_session` has loaded (navigate refuses tabs the user may not view, exactly as a click does);
> after that the panel is left alone, so WisKey's own navigation (a tool opened from ניהול, a drill-down) stands, and a
> schedule with unsaved edits sees WisKey's leave-confirm at most once (review 2026-09-28 fix). The frame address carries `?tab=<tab>` for the
> day the panel reads it - a two-line change in WisKey the owner may want to make. Switching between embedded tabs
> navigates the loaded frame; it does not load Home Assistant again.
> **Chrome hiding, levers in order.** (a) Official: the frontend's `hass-kiosk-mode` window event (HA frontend
> 2026.1+, `state/sidebar-mixin.ts`): sets `hass.kioskMode` in memory only, which makes the drawer modal and closed.
> Rejected: `hass-dock-sidebar` / `dockedSidebar="always_hidden"` - persisted to localStorage, which is shared with the
> user's own HA tabs on the same origin, so it would hide their sidebar everywhere. (b) Fallback for older frontends: a
> style injected into `home-assistant-main`'s shadow root hiding `ha-sidebar` and zeroing `--ha-sidebar-width` /
> `--mdc-drawer-width`. (c) If neither takes, the panel works with HA's sidebar visible and a one-line note. The panel's
> own menu button (`hass-toggle-menu`) is swallowed while the chrome is hidden, so it cannot open HA's drawer over it.
> A custom panel has no HA-level header, so the panel's own toolbar is untouched. On a phone (< 870 px) HA's sidebar is
> already a closed modal drawer.
> **Known limits.** (1) Chrome hiding and the deep link are same-origin DOM reach-ins into HA's and WisKey's frontends;
> an HA or WisKey update can break them - they fail soft (sidebar visible, panel opens on its own tab, a note says so).
> (2) Cost: the frame is a second complete HA frontend (its JS, a second WebSocket, the full state subscription) inside
> the Ingress frame - noticeably heavier than a SMPLWISE screen, especially on a phone; the first load takes seconds.
> (3) WisKey's permissions inside are coarser than SMPLWISE's (area-level, no per-action physical confirmation). (4)
> Tested here only against a structural stub of HA's frontend (`frontend/tests/evidence-wiskey-embed.spec.ts`); the
> real nested HA is the owner's lab check: on the LAN over http and remotely - does WisKey load without a login prompt,
> is HA's sidebar hidden (desktop) and does the panel's menu button do nothing, does each tab (overview / events /
> users / devices / sync / health / audit / tools) open the matching WisKey screen, and does "פתח בחלון מלא" open the
> panel. **Phone (Companion app) = top-level navigation, not nested** (see the phone follow-up below): in the app, does
> each WisKey tab show the SMPLWISE screen (overview / events / people) or the note, with no frame, and does
> "פתח ב-WisKey" switch the app to the WisKey panel in place (HA's own sidebar/header around it, the app's back button
> returns to SMPLWISE) - on Android and, if available, iOS. Also: (a) microphone / two-way audio from a station inside the double frame -
> HA's Ingress frame (`ha-panel-app.ts`) carries no `allow` attribute, so it relies on the Permissions Policy default
> (`microphone` = `self`, which a same-origin child frame inherits); our frame grants `microphone; camera; autoplay;
> fullscreen` for its own same-origin source - check the browser actually prompts and the call carries audio both ways;
> (b) after using the embed, open HA normally in another tab and confirm its sidebar is still there (the kiosk lever is
> in-memory only; this is the check that nothing persisted); (c) on a phone, what WisKey's own toolbar menu button does
> (it is swallowed while HA's chrome is hidden - confirm nothing confusing happens).
>
> **Phone follow-up 2026-09-28 (owner report on 0.1.122, Android, inside Home Assistant):** the embed showed
> "לא ניתן לטעון את WisKey מתוך Home Assistant". Cause, from HA's frontend source (home-assistant/frontend `dev`,
> fetched 2026-09-28): `src/data/external.ts` switches the frontend to external auth when `window.externalAppV2`,
> `window.externalApp` (Android) or `webkit.messageHandlers.getExternalAuth` (iOS) exists, and
> `src/external_app/external_auth.ts` then asks the app for a token and waits for the app to call
> `window.externalAuthSetToken`. The app answers in its top document, so a nested HA that sees the bridge waits
> forever (`<home-assistant>` never gets `hass` - our detector timed out and said "not Home Assistant"), and one that
> does not see it has no stored tokens and redirects to `/auth/authorize`. Not verified on a device: whether Android's
> bridge is visible inside the nested frame (Android WebView JS interfaces are normally injected into every frame,
> which matches the timeout the owner saw). **Fix:** `wiskey-embed` never nests in the Companion app - detected before
> framing by the user agent (`Home Assistant/<version>`: Android `HomeAssistantApis.USER_AGENT_STRING`, iOS
> `HomeAssistantAPI.userAgent` + `Mobile/HomeAssistant`) or by the bridge names on this window or the top one (presence
> only). A `/auth/` path inside the frame, or an HA page that never connects within the panel timeout, is
> `login_required` (the frame is dropped), never "not Home Assistant". Without a frame, overview / events / people show
> the SMPLWISE screen and the other tabs a note, each with "פתח ב-WisKey": pushState of `/hikvision-intercom` on the top
> window plus a `location-changed` event, as HA's own `navigate()` does (`src/common/navigate.ts`; routed by
> `src/layouts/home-assistant.ts`), and a full `location.assign` if SMPLWISE's frame is still in place and the panel
> absent after 1 s. The "unreachable" error now names the likely cause and offers "פתח ב-WisKey" too. Evidence:
> `frontend/tests/evidence-wiskey-embed-phone.spec.ts` (Companion user agent, a stand-in top document with the bridge,
> the `/auth/` redirect and the never-connecting page - all stubs, not the real app).
>
> **Embed API v1 adopted 2026-09-29 (WisKey 2.0.0-rc.19, T054).** The WisKey developers shipped the embed mode we asked
> for (`docs/integrations/wiskey/WISKEY_EMBED_MODE_REQUEST.md`); the contract is
> `docs/integrations/wiskey/embed-api-v1/WISKEY_EMBED_API_V1.md`. What replaced what: (1) the frame address is now
> `new URL('/hikvision-intercom', location.origin)` + `?embed=1&tab=…[&tool=…]` (WisKey omits its own toolbar and
> handles HA's sidebar itself) - replaces the root-relative `?tab=` that the old panel ignored; (2) `wiskey:ready`
> (version 1 only; ids + labels only) builds the WisKey tab row in both navigation designs and the phone bottom nav /
> overflow (`nav.ts` `setWiskeyEmbedNav`, WISKEY_TABS rebuilt in place; `users` keeps SMPLWISE's `people` segment, so the
> per-screen choice for מרכז הכניסה / פעילות / אנשים is unchanged), plus a tools row under ניהול from the catalog's
> tools - replaces the fixed eight tabs; (3) a SMPLWISE tab click is a `wiskey:navigate` message (explicit same-origin
> target) and the tab row keeps the previous selection until `wiskey:location` confirms (a declined unsaved-change prompt
> keeps it) - replaces the one-shot call of the panel's internal `navigate(tab)`; (4) the confirmed location is mirrored
> into SMPLWISE's address as `wiskey_tab` / `wiskey_tool` (replaceState, router `ROUTE_REPLACED`, never fed back to
> the panel); back/forward re-send the navigation; (5) `wiskey:title` is shown as text in the embed bar; (6) no
> `hass-kiosk-mode` dispatch, no injected style, no DOM `navigate()` on the v1 path - replaces the chrome levers; (7) a
> "רענן" button reopens the last confirmed tab/tool; leaving the module disposes the connector and removes the frame.
> The connector (`frontend/src/wiskey/embed-connector.ts`) is a typed port of the reference adapter: listener before
> `src`, origin AND source checks, queued navigation before ready, second ready ignored until a deliberate refresh,
> 12 s discovery. **Older WisKey builds:** only when the public root carries no `data-embed-api` marker 12 s after the
> load does the previous adapter (kiosk event / CSS / `navigate()`, described above) run, with a one-line note; marker
> "1" without a handshake is a waiting state (loading / authentication) - never the legacy adapter; any other version
> is an "unsupported" error with "פתח בחלון מלא". Before the handshake a read-only probe still tells the failure states
> apart (sign-in redirect → login_required, not HA, panel not registered, refused frame). The Companion app path is
> unchanged except that "פתח ב-WisKey" and "פתח בחלון מלא" use the normal deep link `/hikvision-intercom?tab=…&tool=…`
> (rc.19 honours it outside embed mode too). Evidence: `frontend/tests/unit-wiskey-embed-connector.spec.ts` (Node, fake
> window + manual clock), `frontend/tests/evidence-wiskey-embed.spec.ts` and `-phone.spec.ts` against a stub HA page
> with a fake panel in four flavours (`frontend/tests/wiskey-fake-ha.ts`: v1, legacy, marker-only, v2) - stubs, not the
> real WisKey. **Deployment checks left for the owner (lab, rc.19 installed, frontend reloaded):** (a) one toolbar
> only - SMPLWISE's bar and tab row, no WisKey toolbar inside; (b) HA's real sidebar is hidden inside the frame on
> desktop and nothing persisted (open HA normally in another tab afterwards: its sidebar is there); (c) the tab row
> shows WisKey's own screen list and labels, each tab and a ניהול tool opens the right screen, back/forward and a
> bookmarked `#/wiskey/tools/media_options` reopen it; (d) a selected restricted WisKey operator sees only their
> permitted tabs and cannot reach others by typing the address; (e) leave the WisKey area and come back, and "רענן":
> the frame reloads on the last screen, with no stuck audio/video; (f) an existing camera / two-way media session
> (camera wall, a station call) inside the nested Ingress frame - microphone prompt, audio both ways, fullscreen.

**Phase 4 — parity completion (peripheral/admin screens).** Camera wall (S4), media/clock settings (S21/S22),
operations center (S23), identity lifecycle report (S17), permission directory (S18), appearance picker (S25),
WhatsApp (S20/S6 send+preview — separately flagged, see §7 decision 4, since it is the one EXTERNAL capability
and carries the plaintext-PIN disclosure noted in §2).

## 5. What SMPLWISE should deliberately do *better* than the source, given the parity request

Full parity is the target for *capability*, not for every implementation quirk found in the extraction. Where
the source has a known rough edge, SMPLWISE should fix it rather than copy it faithfully:
- Add a confirmation step before every PHYSICAL action (§3), where WisKey has none.
- Do not reproduce the client-gate-vs-server-permission mismatches catalogued in the extraction (§Y.5) — gate
  every button on the actual command's real requirement, not a coarser tab-level area.
- Do not let `whatsapp/preview` render a plaintext PIN in the UI without a deliberate, owner-approved decision to
  do so (§7 decision 4) — mask it by default the way SMPLWISE already masks card numbers.
- Keep our own event/activity view honest about the "no true event push" limit (§2) — poll and refetch on the
  `subscribe` refresh signal like WisKey does, and do not claim real-time delivery the underlying system cannot
  provide.

## 6. Scope impact

Backend: one new service module (`intercom_client.py`) reusing existing `ha_client.ws_session`; a new router
(`routers/access_control.py` or similar) exposing SMPLWISE's own REST endpoints per screen, each checking
SMPLWISE's own new permissions before calling through; the new permission strings need a migration to the RBAC
permission catalogue and role-editor UI, following the exact pattern already used for every existing permission.
Frontend: a new top-level nav entry, a new screen module per phase-1/2/3/4 screen list above, each PORTED from
the owner's own WisKey source file(s) per §3 (render/validation/event logic carried over, transport calls
rewired to SMPLWISE's backend, presentation re-skinned onto this codebase's own `sw-*` components and tokens —
matching the level of design work already put into Plan Studio and the four existing boards, not a copy of
WisKey's own CSS or component structure). Size: comparable to or larger than Plan Studio (CR-003) in total, but
each phase is independently sized like one Plan Studio phase — expect several releases, not one.

## 7. Open decisions needing owner sign-off before Phase 1 starts

1. **Phase order.** Confirm read-only-first (§4) is acceptable, or name a different priority slice (for example,
   if door release is the single most-wanted capability, it could be pulled earlier than Phase 3 — but it still
   needs its own explicit physical-action approval whenever it is scheduled).
2. **SMPLWISE's own permission scheme** (§3) instead of mirroring WisKey's five areas 1:1 — confirm this
   direction, or ask for closer parity with WisKey's own area names for the owner's own mental model.
3. **The audit-attribution mitigation** (§3): WisKey's own log will show one shared HA service account for every
   SMPLWISE-driven action; SMPLWISE's own audit log carries the real actor instead. Confirm this is acceptable.
4. **WhatsApp** (S20/S6): the only EXTERNAL capability (sends a real message to a real person) and the one
   plaintext-PIN disclosure path found in the source. Confirm whether it belongs in SMPLWISE's parity target at
   all, or can stay WisKey-panel-only indefinitely since it is a rare, admin-only action.
5. **Long-term coupling to WisKey's own wire protocol.** SMPLWISE's tab depends on the exact
   `hikvision_intercom/*` command shapes of the owner's own actively-maintained integration; a future WisKey
   change could break it. Given WisKey is the owner's own project, this is judged low-risk, but confirm the
   owner is comfortable with that coupling rather than SMPLWISE building a more defensive/versioned shim now.

## 8. Next step

Once §7 is resolved, write the phase-1 implementation plan (file inventory, exact new permission strings, exact
new endpoints/screens) the same way Plan Studio's design doc preceded its phases, and dispatch it through the
same subagent-driven build/review/release loop used for every other feature this session.
