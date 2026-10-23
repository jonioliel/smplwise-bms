# CR-VOICE143 - Voice announcements (PA) to speakers and screens in the multimedia area

Status: PROPOSED (design only, 2026-10-23). No product code, migration, test, device, Home Assistant instance or
WisKey was touched to write this. Board item r143. Branch `pilot/VOICE143-295` from `origin/main` 320e55551 (v2.12.4).
Binding only after the owner approves it; contradictions are recorded in section 13, not resolved.

Read with: `CR-016-MEDIA-PLAYERS.md` (players, groups, join/unjoin; decision 6 "no announcements in 0.1.150"),
`docs/architecture/MEDIA_PLAYERS_API.md`, `CR-028-CAST-TO-SCREENS.md`, `CR-036-S18-MEDIA.md` (station talk and
`access.call`), `CR-039-DOOR-WINDOWS-AND-EMERGENCY.md` (emergency announce phrase, OFF until a drill), the media
landscape project notes (dedupe by device), `CR-USR2-ARX-ONLY-IDENTITY.md`.

Evidence marks: **V** read in code at 320e55551; **P** proposal of this CR; **Q** owner question (section 12).

## 0. Finding that shapes this CR: a first slice already exists

"MU2" voice announcements are already built (**V**): `services/announcements.py`, `routers/announcements.py`,
`services/announce_channel.py`, `frontend/src/api/announcements.ts`, permission `media.announce` (sensitive,
installation scope, site_admin and system_admin), `system.configure` for setup and test. It already provides: typed
Hebrew/any-language text (one line, max 200 chars, controls and markup stripped), HA `tts.speak` on an administrator-
allowed list of speakers (`announce.devices`), target by device or area, per-announcement volume (clamped, restored
afterwards when the player exposes `volume_level`), pause-and-resume of music, quiet hours (`suppress` or `lower`,
`critical` exempt), rate limits (`announce.max_per_minute`, 5 s cooldown per room/device), one `announcements` row
plus one `media.announce` audit row per attempt, a rule action `announce`, and the notification channel `announce`.
Default OFF, no target allowed by default. Arx-only identities are refused (`local_identity_not_allowed`) until the
service identity exists. `music_assistant.play_announcement` is refused by name in the bridge (`media_policy.py`).
Separately, station speakers are spoken to through WisKey `tts/start` under `access.call` (CR-036).

So r143 is not a greenfield feature. It is the **completion** of MU2 into a PA: pre-recorded clips, multiple targets
and speaker groups, scheduling, priority classes, real ducking, screens, and an operator screen. Everything below that
already exists is marked "exists" and is reused, not rebuilt.

## 1. Goal

A permitted user opens "Announcements" in the multimedia area, types text (spoken in Hebrew) or picks a pre-recorded
clip, picks targets (rooms, floors, saved speaker groups, individual speakers/screens), and sends now or schedules it.
The system plays it on the chosen players, then restores what each player was doing (source, playback position where
possible, volume). Every announcement is audited by who, what class, where, when and outcome. Nothing is spoken unless
the feature is on, the target is allowed, and the safety rules of section 7 pass.

Non-goals: two-way audio (that is S18 talk), live microphone paging (PA from a browser mic; recorded as future, **Q9**),
telephony, public cloud services, announcements to personal phones (push covers that), fire-alarm functions of any kind.

## 2. Playback path

Two content types, one dispatcher (`services/announcements.py`, extended; single call point `SPEAK` seam stays for tests).

| Content | Path through Home Assistant | Notes |
|---|---|---|
| Text (TTS) | exists: `tts.speak` (engine entity + `media_player_entity_id` list) | engine must be a local one for privacy mode, see section 8 |
| Pre-recorded clip | P: `media_player.play_media` with `media_content_type: music`, `announce: true`, media id = a URL on the add-on's own relay origin with a short-lived token (same pattern as the cast relay, CR-028) | Clip files are uploaded to Arx (mp3/wav/ogg, size and duration capped, section 6), stored under the add-on data dir, never an arbitrary URL. The bridge accepts only the relay origin it announced, like `cast_stream` |
| Text rendered once and cached | P: TTS rendered to a file by HA, then played as a clip | used for scheduled and repeated announcements so the engine is not needed at fire time; cache keyed by (engine, language, text hash), purged with the announcement |

The `announce: true` flag is the HA-native announce feature (`MediaPlayerEntityFeature.MEDIA_ANNOUNCE`): the integration
itself ducks or pauses current media, plays, and restores. Per-target capability decides the strategy (the existing
`_play` code is the fallback, not replaced):

1. Player supports `MEDIA_ANNOUNCE` (Sonos, many Cast, MA players): send with `announce: true`; trust the integration for
   restore; still apply Arx volume handling (below).
2. Player does not: Arx emulation, exactly the exists-path: optional volume set, pause only if it was playing, wait for
   the speech with bounded timeouts (`POLL_S`, `START_WAIT_S`, `MAX_SPEECH_S`), resume only a player Arx paused and nobody
   touched since.
3. Player cannot take TTS or a clip at all (a pure screen or receiver without a media_player service path): the target is
   shown as "not supported" in the picker (capability from the catalog), and a chosen group skips it with a note on the
   row. A screen (Cast TV) is a valid target: it plays the audio and, when `announce_on_screen` is on, shows the text as a
   banner through the existing cast relay page (P, optional slice A4).

**Music Assistant caveat.** `music_assistant.play_announcement` stays refused by name (V `media_policy.py`, CR-016). If
the owner wants MA-native ducking for MA players (**Q4**), a new narrow bridge service `announce_play` is added that only
accepts allow-listed entities, fixed fields and the relay origin; it never forwards arbitrary service data.

## 3. Volume, ducking and restore

* Announcement volume = request volume, else `announce.volume`, else the player's current volume. During quiet hours in
  `lower` mode: `announce.quiet.night_volume`. Every effective level is clamped by the player's own ceiling
  (`volume_max` and `volume_night` of CR-016 7ב) - an announcement can never exceed a ceiling the owner set.
* Restore: the previous `volume_level` is stored in memory per touched player before the change and restored after the
  speech ends, on failure, and on the maximum-time timeout. A restart of the backend mid-announcement leaves the stored
  state in a small table (`announcement_restore`), a startup sweep restores or drops entries older than `MAX_SPEECH_S`.
* Ducking vs pausing: default is pause-and-resume for music (exists, `announce.pause_music`); with `MEDIA_ANNOUNCE`
  players the integration ducks. Streams that cannot be paused (live TV, a call) are never paused: the announcement is
  skipped for that target with the reason `busy_live` unless the class is Emergency (section 5).
* Group members with different volumes: each member gets the announcement volume independently and is restored
  independently; grouped players (join/unjoin) are announced as their leader's group only when the integration
  announces to a group correctly; otherwise per member and the group membership is not changed by an announcement.
  An announcement never joins, unjoins or transfers a queue.

## 4. Targets, resolution and permissions

Target kinds: `device`, `area` (exist); P: `floor`, `group` (a saved announcement group, see below), `all_allowed`
(Emergency class only). Several targets per announcement (a list), de-duplicated by player entity (exists: each entity
once; a speaker reached by two targets speaks once).

* **Allow list stays the authority.** `announce.devices` (exists) is the only set of players that can ever be spoken to,
  chosen by `system.configure`. A room, floor or group resolves only to allowed members; an unknown or not-allowed
  target is "no targets", and the caller never learns which (exists, keep).
* **Announcement groups** (P): named lists of allowed device keys plus optional area/floor refs, created in Settings
  (`system.configure`). They are not HA groups and not MA groups; a recorded group lists keys, so a removed device
  simply drops out and the group reports `missing` (like CR-016 presets).
* **Per-user scope** (P): a new optional layer on top of `media.announce`: a user or role may be limited to certain
  areas/groups (e.g. a floor manager may speak only on his floor). Implemented with the existing area-scoped role
  binding where the RBAC supports it for this permission; if it does not (the permission is installation-scope today),
  the first release ships installation scope only and the scoped binding is slice A5 (**Q3**).
* **Permissions:** `media.announce` (exists) to send now; new `media.announce.schedule` to create/cancel scheduled ones
  (default: site_admin, system_admin); new `media.announce.emergency` for the Emergency class (default: system_admin only,
  and never grantable to a guest role); `media.announce.clips` to upload clips (default: site_admin, system_admin);
  `system.configure` for engine, allow list, groups, limits, quiet hours, test. All sensitive, none granted by default
  to operators. Door/station announcements keep their own `access.call` path and are not merged in (a station is not a
  media player; it is listed as a target only through WisKey and only by a user who also has `access.call` on that
  station chain - slice A6, optional).
* **Identity:** the call runs on the add-on's Home Assistant token (as MU2 does). Arx-only users stay refused
  (`local_identity_not_allowed`) until the service identity phase; this CR does not change that rule (**Q8**).
* No client flag grants anything; every check is server side; a refusal is audited (exists).

## 5. Classes and priority

| Class | Who may send | Quiet hours | Rate limit | Interrupts | Default |
|---|---|---|---|---|---|
| Normal | `media.announce` | obeys (`suppress` or `lower`) | yes | pauses music only; never a live call or fire-safety audio | on when the feature is on |
| Important | `media.announce` + confirm in the UI | `lower` allowed, `suppress` bypassed only if the owner enabled "important speaks at night" | separate lower limit | same as Normal | on |
| Emergency | `media.announce.emergency` only; also the door-emergency phrase of CR-039 once the owner enables it | bypassed (exists as `critical`) | its own small bucket, never starved by Normal | may preempt Normal and Important playing; may pause a live stream | OFF until a drill (matches CR-039 decision) |

* Queue: one announcement plays per target at a time. A busy target queues the next (max queue 5, max wait 60 s, then
  `dropped_busy` on the row). Higher class preempts a lower one that is playing (the lower is cut, marked `preempted`);
  equal class never preempts.
* Emergency cannot be scheduled and cannot be sent by a rule except the CR-039 emergency hook; Emergency text is picked
  from owner-pre-approved phrases (clips or fixed text), free text only for `system_admin` with a confirm dialog.
* Cancel: a running announcement can be stopped from the screen and by the cancel endpoint (stops speech, restores).

## 6. Scheduling and clips

* A scheduled announcement = content + targets + class (Normal/Important only) + one of: once at a local time, or a
  weekly recurrence (days, time), with start/end dates and an "except holidays" flag using the working-hours/holiday
  calendar already in the product (SLACAL). Time zone is the installation zone, DST-safe.
* Stored in a new table `announcement_schedules`; one worker tick (the existing worker pattern; no new process) fires due
  rows through the same `announce()` path, so quiet hours, limits, allow list and audit apply identically. A missed fire
  (backend down) is dropped after a 5 minute grace, recorded as `missed`, never replayed late. Disabled targets at fire
  time are skipped with notes.
* Clips: upload `mp3/wav/ogg`, max 5 MB, max 60 s, scanned for container type by magic bytes, re-encoded to a standard
  format server-side (P: `ffmpeg` only if already present in the add-on image; otherwise accept only a safe subset and
  no transcoding). Clip library has name, duration, uploader, created; deleting a clip used by a schedule is refused.
  Clip content is not audited beyond name/hash; clip files are private data and excluded from exports.

## 7. Safety

1. **Fire-safety is untouchable.** Arx never interrupts, mutes, ducks or preempts any fire-alarm, evacuation or life-safety
   audio system. Those systems are not integrated, not in the allow list, and the picker excludes any player whose
   catalog tag is `life_safety` (a tag the administrator can set; default none). Arx is not a life-safety PA and the UI
   and docs say so. Emergency class here means "building emergency message", not a replacement for the alarm.
2. **Feature OFF by default**, no allowed device by default, no engine by default (exists). Enabling needs
   `system.configure` and a recorded audit row.
3. **Quiet hours** (exists) apply to Normal; configurable per day; Emergency exempt; Important by owner choice.
4. **Max length**: 200 characters per text (exists), 60 s per clip, 4 targets-per-minute burst limit for the same player.
5. **Rate limits** (exists): installation `max_per_minute` (default 6) and 5 s per room/device; P: per-user limit (default 4 per
   10 min) so one account cannot saturate; limited attempts are logged `limited` and answer 429.
6. **Volume ceilings** from CR-016 always win; an absolute announcement ceiling `announce.volume_max` (default 80) applies.
7. **No arbitrary playback**: media ids are only server-issued clip URLs on the relay origin or TTS output; the bridge
   re-checks independently (`media_policy.py` pattern, URL media ids otherwise refused).
8. **Audit of who said what**: every attempt is an `announcements` row + `media.announce*` audit row with user, class,
   targets, source (manual/rule/schedule/notification), outcome, text length bucket. Full text retention: **Q6**.
   Today `announcements.message` holds the text (V); the TTSLOG precedent (2.4.10) stores only a length bucket for
   station TTS. The owner decides (recommendation: keep the text for 90 days, existing `prune`, because "who said what"
   is the stated need; hash only afterwards).
9. **Sanity guards**: text with SSML/markup is stripped (exists); a profanity/abuse filter is **not** built (out of
   scope); the UI shows a confirm for any send to more than 5 speakers or the whole building.
10. **Fail closed**: engine unreachable, entity unavailable or unknown capability means "not spoken", an audited
    `failed` row, never a retry loop (one retry for scheduled ones only, at +30 s).

## 8. Text-to-speech engines and privacy of the text

* Engines come from Home Assistant `tts.*` entities (exists: `announce.engine`, validated `^tts\.[a-z0-9_]{1,80}$`).
* **Without cloud:** Piper (HA add-on / Wyoming; offline, Hebrew voice availability to be verified in the lab, **Q1**),
  and HA "Home Assistant Cloud" is cloud and is excluded from the local-only mode. Google Translate TTS, Azure,
  ElevenLabs, OpenAI are cloud engines: the text leaves the premises.
* Arx marks each engine `local` or `cloud` from a small allow-list of known local integrations (piper, wyoming, espeak
  style) plus an admin override, and shows a visible "this engine sends text outside" badge. Setting `announce.privacy`:
  `local_only` (default when any local engine exists) refuses cloud engines; `any`. Station TTS (WisKey) already warns
  that the text may leave (V).
* Text is never logged to the add-on log at INFO; the HA service call carries the text by necessity, so the HA side
  retention is the infrastructure's own.
* Hebrew quality is the open technical risk; the lab check (a 20-sentence Hebrew sample, numbers/dates/names) gates
  slice A2 and is NOT_RUN until the owner's lab session.

## 9. Screens and UI

* New operator area "Announcements" in the multimedia section: compose (text or clip), target picker (floors/areas tree
  kept, per the standing area-tree rule; groups; individual players with capability badges), class selector, volume,
  preview text length, Send now / Schedule, a history list, and a stop button for a playing announcement.
* Settings: engine and privacy, allow list, groups, quiet hours, limits, clips library, emergency phrases, schedule list.
* Clean operator screens rule (owner 2026-09-30): no hint paragraphs on the operator screen, short confirmations; the
  management parts live only in Settings. No Home Assistant/Ingress wording anywhere outside the Settings screens.
* The tickets-module rule applies: when the tickets module is off, no "open service request" action here.
* Hebrew first (RTL), English strings in the same table; the existing `MESSAGES` he/en pairs are the pattern.

## 10. Tests plan

All sub-agent work uses fakes (the `SPEAK`, `PLAYER_STATE`, `PLAYER_CALL`, `SLEEP` seams exist); nothing reaches a real
speaker. Real playback is NOT_RUN until a lab session the owner approves.

| Area | Tests |
|---|---|
| Resolution | floor/area/group/device union, de-dup by entity, not-allowed and unknown give identical `no_targets`, group with missing member |
| Permissions | each new permission allow/deny, scoped role limited to its floor, Emergency only with its permission, Arx-only identity refused, audit row on every refusal |
| Safety | OFF by default, no-engine, quiet hours per class (suppress/lower/critical), life_safety tag excluded, volume ceilings win, rate limits (installation, per target, per user), max length text/clip, markup stripping |
| Path | `MEDIA_ANNOUNCE` strategy vs emulation: exact service calls and volume/pause/resume order, restore after failure and timeout, restart sweep, live stream not paused, preemption and queue limits, clip URL only on relay origin, URL media ids refused by the bridge |
| Schedule | once/weekly/holiday skip, DST edge, missed grace, disabled target at fire time, clip in use not deletable, fires through `announce()` |
| Privacy | cloud engine refused in `local_only`, badge data in the engine list, text not in INFO logs |
| Contract | bridge `test_bridge_media_policy.py` additions; API inventory regenerated; new routes in the permission matrix test |
| UI | compose/target picker/confirm >5, history, stop; a11y and RTL; Playwright against a fake HA (`media_fake_ha.py` already honours `announce`) |
| Lab (NOT_RUN) | Hebrew Piper sample, `MEDIA_ANNOUNCE` on a real Sonos/Cast, volume restore on real devices, ducking audibility |

## 11. Slices (estimates in sessions, each ends green or reports NOT_RUN honestly)

| Slice | Content | Needs |
|---|---|---|
| A0 | Audit of MU2 UI/API as shipped; write the gap list; migration plan (tables `announcement_schedules`, `announcement_clips`, `announcement_groups`, `announcement_restore`); permissions added (default none) | nothing |
| A1 | Multi-target + floor + saved groups + queue + preemption + stop; classes Normal/Important; per-user rate limit; `announce.volume_max` | A0 |
| A2 | Engines: local/cloud marking, `announce.privacy`, Hebrew lab check hook; `MEDIA_ANNOUNCE` strategy with capability detection | A1, **Q1** |
| A3 | Clips: upload, library, relay playback, bridge re-check | A1, **Q2** |
| A4 | Scheduling + worker tick + holiday calendar; optional on-screen banner on Cast screens | A3 |
| A5 | Emergency class + phrase library + CR-039 hook (gated OFF); optional area-scoped permission binding | A1, **Q3, Q5** |
| A6 | Operator screen + settings screens, Hebrew/English, a11y | A1-A4 |
| A7 | Optional: station speakers as targets via WisKey `access.call` (shared station audio lock, see below) | WisKey W10 status |

**Station audio lock.** A station speaker is also used by two-way talk (S18, one talker slot) and station TTS
(WisKey `tts/start`). A PA announcement that targets a station must take the same single audio slot as talk, never
speak over an active call or talk session, and wait or fail with `busy`. Until the shared lock is confirmed with
WisKey, stations are not offered as announcement targets (A7 stays out of the first release).

## 12. Owner questions (recommendation first)

1. Engine and Hebrew quality. Recommend: **local Piper first, verify Hebrew in a 20-sentence lab sample; cloud engines
   remain available only with `privacy: any` and a visible badge.** Alternatives: ב - cloud Google/Azure as default for
   quality; ג - pre-recorded clips only until Hebrew TTS is good.
2. Clips in the first release. Recommend: **yes, mp3/wav/ogg, 5 MB / 60 s, in A3** (needed for school-bell/ chime style use).
   ב - text only first.
3. Who may announce and where. Recommend: **installation scope now (site_admin, system_admin), area-scoped binding in A5
   only if the RBAC allows it cheaply.** ב - area-scoped from the start (delays A1).
4. Music Assistant native announce. Recommend: **no new bridge service in the first release; MA players use the Arx
   pause-and-resume emulation or HA `announce` when the entity supports it.** ב - add a narrow `announce_play` bridge
   service now.
5. Emergency class. Recommend: **build it but ship OFF, `system_admin` only, fixed owner-approved phrases, enabled only
   after a drill (same rule as CR-039 decision 6).** ב - do not build it in this CR.
6. Text retention in the audit/history. Recommend: **keep the full text 90 days (existing prune), then hash and length
   only.** ב - length bucket only from day one (as TTSLOG for stations, weaker "who said what"). ג - keep forever.
7. Quiet hours for Important. Recommend: **Important obeys `lower` (night volume) but never fully suppressed unless the
   owner turns on "important speaks at night"**; Normal suppressed. ב - Important follows Normal exactly.
8. Arx-only users. Recommend: **unchanged: refused until the service identity phase**; announcements stay with HA-identity
   admins for now. ב - allow Arx users now through a dedicated allow-list.
9. Live microphone paging (speak into a browser mic). Recommend: **out of scope, a separate future CR**; it needs
   audio streaming, echo handling and a stricter permission. ב - include in this CR.
10. Screens (TV Cast) as targets. Recommend: **audio only in the first release, on-screen text banner as A4 optional.**
    ב - banner from the start.
11. Release plan and numbering. Recommend: **ship A1-A3 as one release, A4-A6 as the next; A5 Emergency last and OFF.**
    ב - one big release.

## 13. Contradictions and risks recorded

* CR-016 decision 6 ("no announcements in 0.1.150", `announce` command not reserved) is **superseded in effect** by the
  later MU2 build; this CR does not edit CR-016. The bridge still refuses `music_assistant.play_announcement`; that
  refusal is kept (section 2).
* CR-039 sets the emergency spoken phrase to OFF until heard in a drill; section 5 preserves that and reuses it.
* Station TTS (WisKey, `access.call`) and media-area announce (`media.announce`) use different permissions and
  different audit forms today; they are intentionally not merged (section 4), but the operator might expect one
  screen. The UI shows only media-area targets until A7.
* Risk: HA `MEDIA_ANNOUNCE` behaviour differs per integration; mitigated by capability detection and lab tests (NOT_RUN).
* Risk: Hebrew TTS quality; mitigated by clip support and the lab gate.
* Risk: a public-address function can be abused; mitigated by default OFF, allow list, permissions, limits and audit,
  and by never touching life-safety audio.
