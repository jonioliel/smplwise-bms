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

**Phase 2 — config-write, zero physical actuation.** Gated on `access.people.manage` / `access.doors.manage`.
Person editor full CRUD including cards/PINs/timing (S7), card capture *excluded* here (it is PHYSICAL — reader
collection mode — moves to Phase 3), CSV import/export (S9), bulk operations (S5), import/adopt existing device
records (S10), schedules library + deployment plans (S16), profile/group settings (S19), door technical settings
*excluding* anything that can flip a relay (S11 Settings, minus `relayReverseEnabled`), public codes (S11 — this
one is CONFIG-WRITE(D) per the extraction but grants a real access code, so treat it with the same care as a
physical grant even though it is not itself an actuation), sync/conflict resolution (S12), health/audit (S14/S15).

**Phase 3 — physical actions, each individually approved before it is built.** Door release (`stations/
test_unlock`, with a confirmation dialog WisKey itself lacks); door programs (`technical_program_save`/`_action`
— scheduled/immediate real actuation); the ambiguous `technical_update` field (`relayReverseEnabled`); call
answer/reject/hangup (`media/signal`); two-way audio/talk (`audio/*`); TTS (`tts/*`); card capture
(`cards/capture_start`, puts a real reader into physical collection mode).

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
Frontend: a new top-level nav entry, a new screen module per phase-1/2/3/4 screen list above, all built on this
codebase's existing screen/dialog/table conventions (matching the level of design work already put into Plan
Studio and the four existing boards), not a copy of WisKey's own CSS or component structure. Size: comparable to
or larger than Plan Studio (CR-003) in total, but each phase is independently sized like one Plan Studio phase —
expect several releases, not one.

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
