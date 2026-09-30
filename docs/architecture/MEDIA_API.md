# CR-015 Multimedia ("מולטימדיה · מסכים ושלט") — binding API contract and work plan

Status: **CONTRACT for 0.1.149** (screens, the remote, media cards in areas and home). Design and decisions:
`docs/changes/CR-015-MEDIA-SCREENS.md` ("the CR"; § refs below marked CR §n). Typed client (S0, done):
`frontend/src/api/media-screens.ts`; mock adapter: `frontend/src/api/media-screens-mock.ts`; unit spec
`frontend/tests/unit-media-screens.spec.ts`. Architect branch `pilot/CR015-media-arch` (on `g0/intake` 0.1.148).
Precedence inside CR-015: this contract > the CR's proposals > the mockup. Contract changes only by the coordinator.

## 1. Conventions

Router `routers/multimedia.py`, prefix `/api/v1`, tag `multimedia` (`/api/v1/media/*` is the camera video router).
Pydantic bodies with `extra="forbid"`; errors are `ApiError` (`{code, user_message, retryable, correlation_id,
details}`, Hebrew messages). Writes that act on a device carry `client_request_id` (8–80 chars, idempotent per user)
and `expires_at` (UTC `Z`, ≤ 60 s ahead; past → 409 `expired`). Times are UTC ISO. Volume is 0–100 on the wire (HA's
0–1 is converted server-side). Nothing in any response carries an entity id of a hidden endpoint, a MAC, an HA
identifier, an IP or an HA URL; `anchor_entity_id` is returned to `system.configure` holders only (admin routes).

## 2. Types (TypeScript mirror; the client file is authoritative for field names)

### 2.1 Device (list item)

```ts
type MediaKind = 'screen' | 'receiver' | 'speaker' | 'player' | 'group';   // 0.1.149 lists 'screen' only
type ProfileId = 'samsung_smart' | 'lg_webos' | 'android_tv' | 'generic';
type PowerState = 'on' | 'off' | 'art' | 'standby' | 'unavailable' | 'unknown';
interface MediaDevice {
  key: string; name: string; kind: MediaKind; profile: ProfileId;
  floor_id: string | null; floor_name: string | null; area_id: string | null; area_name: string | null;
  public: boolean;
  live: MediaLive; caps: MediaCaps;
  audio_link: { key: string; name: string; default: 'screen' | 'linked' } | null;
  can: { control: boolean; power: boolean; public_ok: boolean; bulk: boolean };   // for THIS caller, THIS device
}
interface MediaLive {
  power: PowerState; play: 'playing' | 'paused' | 'idle' | null;
  confirmed: boolean;            // false: heuristic state, or nothing reported since our last command
  since: string | null;          // unavailable since
  now: { kind: 'app'|'source'|'channel'|'art'|'home'|'saver'|'none'; label: string; app_id: string|null; source_id: string|null;
         title: string|null; channel: string|null; position_s: number|null; duration_s: number|null; position_at: string|null;
         artwork: string|null /* relative URL of the proxy, versioned */; glyph: Glyph; hue: number|null };
  volume: { level: number|null; muted: boolean|null; target: 'screen'|'linked'; step_only: boolean };
  sound_output: string | null;
}
interface MediaCaps {
  power_on: boolean; power_on_reason: string | null /* 'no_remote_wake' | 'unavailable' */; power_off: boolean;
  volume_set: boolean; volume_step: boolean; mute: boolean; sources: boolean; apps: boolean; sound_outputs: string[];
  transport: { play: boolean; pause: boolean; stop: boolean; next: boolean; previous: boolean; seek: boolean };
  keys: KeyId[]; text: boolean; touchpad: boolean; art_mode: boolean;
}
```

`KeyId` = `up down left right ok back home menu exit info guide source tools settings chlist prech volup voldown mute
chup chdown n0…n9 red green yellow blue play pause stop rew ff` (never a power key). `caps` already reflects the live
state of the primary endpoints, the profile, the per-screen model keys and admin overrides.

### 2.2 Detail

`MediaDeviceDetail = MediaDevice & { sources: SourceItem[]; apps: SourceItem[]; recent: RecentItem[]; remote:
RemoteConfig; model_keys: KeyId[] }`, where `SourceItem = { id /* the TV's own string */, label, kind:
'source'|'app'|'channel', glyph, hue }` (hidden items are omitted for everyone on this route), `RecentItem = { kind:
'source'|'app', id, label, glyph }` (last 6 confirmed picks; the UI shows 3), `RemoteConfig = { sections: {id:
RemoteSection, on}[], more: RemoteSection[], scope: 'default'|'device' }`, `RemoteSection = recent nav dpad touch vol ch
pbk nums colors text xtra`.

### 2.3 Status

```json
{ "enabled": true,
  "bridge": { "paired": true, "version": "0.4.0", "media_ready": true },
  "can": { "read": true, "control": true, "power": true, "public": false, "bulk": false, "layout": false,
           "configure": false, "personalize": false },
  "counts": { "screens": 8, "on": 3, "pending_approval": null },
  "profiles_version": 1 }
```

`can.*` = held anywhere (per-device truth is `device.can`). `pending_approval` is a number only for `system.configure`.

### 2.4 Layout (addition A)

```ts
interface MediaLayout { version: 1; group_by: 'floor'|'area'|'none'; floor_order: string[]; pinned: string[];
  order: string[]; cards: Record<string /*device key*/, { on: boolean; size: 's'|'m'|'l'; phone_on: boolean|null;
  phone_size: 's'|'m'|null }> }
interface MediaPersonal { group_by: 'floor'|'area'|'none'|null; order: string[]|null;
  cards: Record<string, { on?: boolean; size?: 's'|'m'|'l' }> }
```

Limits: ≤ 300 keys in `order`/`cards`, ≤ 24 `pinned`, device keys `^[a-f0-9]{32}$` (the mock's `md-<name>` keys are
demo only), floor ids as HA ids ≤ 128. Unknown keys are kept on write (a device may be temporarily absent) and
ignored on read; the janitor prunes keys of devices deleted for 30 days.

## 3. Routes

| # | Method | Path | Auth |
|---|---|---|---|
| 3.1 | GET | `/multimedia/status` | signed in |
| 3.2 | GET | `/multimedia/devices?kind=screen&floor=&area=&q=` | `media.read` (scoped) |
| 3.3 | GET | `/multimedia/devices/{key}` | `media.read` at the anchor |
| 3.4 | POST | `/multimedia/devices/{key}/commands` | `media.control` / `media.power` (+ `media.public`) at the anchor |
| 3.5 | GET | `/multimedia/devices/{key}/artwork?v=` | `media.read` at the anchor |
| 3.6 | GET / PUT / DELETE | `/multimedia/layout` | GET `media.read`; PUT / DELETE `media.layout` (installation) |
| 3.7 | GET / PUT | `/multimedia/remote-default` | GET `media.read`; PUT `media.layout` |
| 3.8 | PUT | `/multimedia/devices/{key}/remote` | `media.layout` at the anchor |
| 3.9 | GET / POST | `/multimedia/actions/preview?scope=&id=` · `/multimedia/actions` | `media.bulk` at the floor/area |
| 3.10 | GET | `/multimedia/profiles` | `media.read` |
| 3.11 | GET | `/multimedia/admin/devices` | `system.configure` |
| 3.12 | PUT | `/multimedia/admin/devices/{key}` | `system.configure` |
| 3.13 | POST | `/multimedia/admin/links` | `system.configure` |
| 3.14 | POST | `/multimedia/admin/approve` | `system.configure` |
| 3.15 | PUT | `/me/prefs` key `multimedia.personal` (existing route) | `screen.personalize` |

An invisible device is 404 `not_found` (never 403, never listed). A device not approved is invisible to everyone but
the admin routes. `multimedia.enabled = false` → every route but 3.1 and 3.11–3.14 answers 404 `feature_disabled`.

### 3.2 List

`{ "devices": MediaDevice[] }` sorted by name; `kind` defaults to `screen`. Example item:

```json
{ "key": "5f0c…e1", "name": "טלוויזיה סלון", "kind": "screen", "profile": "samsung_smart",
  "floor_id": "ground", "floor_name": "קומת קרקע", "area_id": "living_room", "area_name": "סלון", "public": false,
  "live": { "power": "on", "play": "playing", "confirmed": true, "since": null,
            "now": { "kind": "app", "label": "Netflix", "app_id": "Netflix", "source_id": null, "title": "סדרה · עונה 2",
                     "channel": null, "position_s": 1520, "duration_s": 3120, "position_at": "2026-09-30T18:02:11Z",
                     "artwork": null, "glyph": "film", "hue": 265 },
            "volume": { "level": 38, "muted": false, "target": "linked", "step_only": false }, "sound_output": null },
  "caps": { "power_on": true, "power_on_reason": null, "power_off": true, "volume_set": true, "volume_step": true,
            "mute": true, "sources": true, "apps": true, "sound_outputs": [],
            "transport": { "play": true, "pause": true, "stop": true, "next": true, "previous": true, "seek": false },
            "keys": ["up", "down", "left", "right", "ok", "back", "home", "menu", "volup", "voldown", "mute", "chup", "chdown"],
            "text": true, "touchpad": true, "art_mode": false },
  "audio_link": { "key": "9a1…", "name": "מגבר סלון", "default": "linked" },
  "can": { "control": true, "power": true, "public_ok": true, "bulk": false } }
```

### 3.4 Commands

Body: one `MediaCommand` + `client_request_id` + `expires_at`:

| `command` | Fields | Needs | HA call (primary endpoint) |
|---|---|---|---|
| `power_on` / `power_off` | — | power | `media_player.turn_on` / `turn_off` (vendor) |
| `volume_set` | `level` 0–100, `target?` | control | `media_player.volume_set` (clamped to `volume_max`) |
| `volume_step` | `direction` up/down, `target?` | control | `media_player.volume_up/down`, else the profile key |
| `mute` | `muted`, `target?` | control | `media_player.volume_mute` |
| `source` | `source_id` (∈ curated, visible sources) | power (+public) | `media_player.select_source` |
| `app` | `app_id` (∈ curated apps) | power (+public) | `select_source` (Samsung/LG) / `remote.turn_on activity` (Android) |
| `sound_output` | `output` ∈ `caps.sound_outputs` | power | `webostv.select_sound_output` |
| `transport` | `action` play/pause/play_pause/stop/next/previous | control | `media_player.media_*` |
| `key` | `key` ∈ `caps.keys` | control | profile transport (CR §4) |
| `text` | `text` 1–200, no control chars | control (+public) | Samsung `play_media send_text`, Android `remote.send_command "text:…"` |

`target` (`screen`|`linked`) chooses the volume endpoint when a receiver is linked (default `audio_link.default`).
Response 202:

```json
{ "command_id": "c1f2…", "status": "accepted", "action_id": "a81be07c19d2", "confirm": "state", "error": null }
```

`status`: `accepted` (HA took the call; poll `GET /ha/actions/{action_id}` for `confirmed` / `unknown`), `sent` (keys,
text, steps: no observable effect, `action_id` null), `refused` (the bridge or HA said no; `error` = its code, 200 with
the audit row written). The UI shows "המסך לא אישר את הפקודה" when an accepted command is not confirmed within 8 s.

**Errors** (Hebrew messages verbatim in `routers/multimedia.py`, mirrored in `ERROR_LABEL` of the client):

| HTTP | code | When |
|---|---|---|
| 403 | `forbidden` | missing `media.control` / `media.power` at the anchor |
| 403 | `public_screen` | source / app / text on a public screen without `media.public` |
| 404 | `not_found` | unknown, invisible or unapproved device |
| 409 | `screen_off` | anything but `power_on` while off / standby / art |
| 409 | `unavailable` | the primary endpoint is unavailable |
| 409 | `power_pending` | a power command on this device is still pending (≤ 8 s) or < 2 s since the last |
| 409 | `expired` | `expires_at` in the past |
| 422 | `not_supported` | not in `caps` / not in the profile / hidden source / unknown app |
| 422 | `validation` | shape, range, text length |
| 429 | `rate_limited` | keys 5/s burst 8 per device, 10/s per user; `volume_set` 4/s; text 1/s (dropped, never queued) |
| 503 | `bridge_outdated` | paired bridge older than 0.4.0 |
| 503 | `bridge_not_paired` / `ha_unavailable` | as the existing action route |

### 3.5 Artwork

Proxies the now-playing endpoint's `entity_picture` through the add-on's HA session. Only for real content art (CR
§11); else 404. `image/jpeg|png|webp`, ≤ 512 KB, `Cache-Control: private, max-age=60`. `v` = a hash the device's
`live.now.artwork` URL carries so a change refetches.

### 3.6 Layout

`GET` → `{ installation: MediaLayout, personal: MediaPersonal|null, revision, can_edit, can_personalize }` (`personal`
only for `screen.personalize` holders; the effective merge is the client's `effectiveLayout`). `PUT { layout,
base_revision }` → same shape; 409 `revision_conflict` when `base_revision` is stale; audited `media.layout.update`.
`DELETE` → 204, back to the automatic layout, audited `media.layout.reset`.

### 3.7 / 3.8 Remote configuration

`GET /multimedia/remote-default` → `RemoteConfig` (`scope: "default"`); `PUT { sections, more }` (all 11 sections
exactly once; `more` ⊂ sections). `PUT /multimedia/devices/{key}/remote`:

```json
{ "remote": { "sections": [{ "id": "recent", "on": true }, …], "more": ["nums", "colors"] },
  "sources": [{ "id": "HDMI1", "label": "HDMI 1 · ממיר", "hidden": false, "kind": "source", "glyph": "hdmi" }],
  "apps": [{ "id": "Netflix", "label": null, "hidden": false, "glyph": null }] }
```

`remote: null` returns the screen to the default. `sources` / `apps` are full ordered lists (unknown ids ignored,
missing live ids appended at the end, labels ≤ 40 chars). Response: the new `MediaDeviceDetail`. Audited
`media.remote.update`.

### 3.9 Bulk (decision 7a)

`GET /multimedia/actions/preview?scope=floor|area&id=<ha floor/area id>` →
`{ scope, id, label, counts: { send, already_off, not_confirmed, unavailable, not_allowed }, devices: [{ key, name,
will: "off"|"skip", reason }] }`. `POST { scope, id, kind: "screens_off", confirmed: true, client_request_id,
expires_at }` → 202 `{ bulk_id, status }`; poll the existing `GET /devices/actions/{bulk_id}`. Scope `building` → 422
`validation`. Engine: `services/device_bulk.py` with the media resolver (CR §5.5).

### 3.10 Profiles

`{ "version": 1, "profiles": [{ "id": "lg_webos", "keys": ["up", …], "text": false, "apps": "source_list",
"extras": ["info", "guide", "exit"] }] }` — vocabularies only (no service names, no codes).

### 3.11–3.14 Administration (`#/system/multimedia`)

- `GET /multimedia/admin/devices` → `{ devices: [{ key, name, kind, kind_source, approved, public, profile,
  profile_source, confidence, anchor_entity_id, floor_name, area_name, audio_link_key, audio_default, volume_max,
  model_keys, also_turns_on: string[] /* SSV sync_turn_on names, read-only */, endpoints: [{ endpoint_id, platform,
  role, rule, link_source, hidden, primary_for: Control[] }] }], suggestions: [{ endpoint_id, device_key, rule: "weak",
  reason }] }`.
- `PUT /multimedia/admin/devices/{key}` body (every field optional): `{ display_name, kind, approved, public, profile,
  audio_link_key, audio_default, volume_max, model_keys, primary: { power?, volume?, mute?, sources?, apps?, keys?,
  now_playing? /* endpoint ids of this device */ } }` → the admin row; audited `media.device.update`.
- `POST /multimedia/admin/links { op: "link"|"unlink"|"ignore"|"restore", endpoint_id, device_key? }` → `{ devices }`
  (rebuilt); audited `media.link`. `POST /multimedia/admin/approve { device_keys: [...], approved: true }` → counts;
  audited `media.approve`.

### 3.15 Personal layout

`PUT /me/prefs { "multimedia.personal": MediaPersonal | null }` — validated by `services/media_layout.normalise_personal`;
refused (403 `personalize_required`) without `screen.personalize`; hidden on read without it (the `home.personal` rule).

## 4. Events, mock and the S0 client

- `/ha/ws` frames: `{ type: "media_state", payload: { device_key, entity_id /*anchor*/, live: MediaLive } }` (≤ 4/s per
  device, only to subscribers who see the anchor under `media.read`); `{ type: "media_devices_changed", payload: {
  reason: "registry"|"curation"|"approval"|"layout" } }` (refetch). `HaPush` in `api/ha.ts` gains both (S2).
- The MOCK adapter (`media-screens-mock.ts`): the mockup's eight screens (Samsung + receiver, LG TV source, Frame art,
  Android off, generic, LG without wake, Android saver + receiver, LG unavailable), all routes except artwork and
  admin, same error codes, mutations kept per page load, `sent[]` log for specs, `resetMediaMock()` for tests.
- The client: types above, `media()` picks HTTP (`isApi()`) or the mock, `sendCommand()`, and pure helpers
  (`stateText`, `commandOffered`, `remoteSections`, `effectiveLayout`, `resolveCards`, `moveKey`, `bulkCandidates`,
  `KeyThrottle` token bucket 5/s burst 8). Verified 2026-09-30: `npx tsc --noEmit` clean; the unit spec 9 passed.

## 5. Parallel work plan

All agents branch from `pilot/CR015-media-arch` (or `g0/intake` after it merges). Python
`C:\cloude\smplwisebms\.venv\Scripts\python.exe`, pytest workers=1, targeted files only; Node per CLAUDE.md with a
`node_modules` junction to `C:\cloude\smplwisebms\frontend\node_modules`. Nobody bumps versions or edits CHANGELOG,
`management/*`, `contracts/API_INVENTORY.md` (release round), this document or the S0 client (coordinator). Run
`bash C:/cloude/smplwisebms/secrets/scan_staged.sh` before every commit; never read `secrets/` or `private-evidence/`;
no device, HA or lab contact. Model: Sonnet for S1–S4; Opus reviews the command path before the merge.

### S1 — backend: model, dedupe, routes, bridge commands, RBAC, migrations (`pilot/CR015-s1-backend`)

```
Goal: CR §3-§6, §9-§11 and this contract §1-§3 on the server, plus bridge 0.4.0.
Owns: routers/multimedia.py; services/media_model.py (ladder, kinds, roles, primaries, caps; pure), media_profiles.py
  (data, v1), media_commands.py (resolve, validate, rate limits, audit), media_layout.py (layout, personal, remote
  default); migrations 0041_media_devices.sql, 0042_media_role_grants.sql; custom_components/smplwise_bridge/
  media_policy.py; tests/test_media_*.py, tests/test_bridge_media_policy.py.
Touches (sole editor): main.py, roles.json, routers/access.py, role-catalog.design.json, routers/settings.py
  (multimedia.enabled, .remote_default), routers/me.py + services/user_prefs.py (multimedia.personal, NAV_TAB_IDS),
  services/ha_bridge.py (ACTIONS, route "media"), routers/ha.py (use_media_screen, media_state scope), ha_sync.py +
  ha_client.py (ha_devices mirror, ATTR_ALLOW, artwork map, media_state), device_bulk.py (media resolver, 8a), the
  bridge __init__/const/manifest 0.4.0 (then scripts/sync_integration.py).
Interfaces: exactly §2-§3; the S0 client must work against it unchanged.
Done: every route and error code tested; rungs 1-6 incl. the two-Samsung guard; no power key reachable; entity_picture
  in no API; migrations up on a 0.1.148 DB copy; + test_access, test_devices, test_ha, test_migrations,
  test_ui_settings, test_home_config green. Estimate 26-32 agent-hours.
```

### S2 — frontend: screens page, cards, layout editor, settings, navigation (`pilot/CR015-s2-screens`)

```
Goal: CR §7.1, §7.6, §8, §9 against the S0 client (mock until S1 merges).
Owns: screens/multimedia-screens.ts (header, room chips, floor menu, search/filter, groups, ?edit=1),
  components/media-screen-card.ts (<media-screen-card .device .size .compact @open-remote>, shared with S3),
  screens/multimedia-edit-panel.ts (order, pin, size, desktop/phone visibility, group_by, floor order; the
  home-edit-panel.ts patterns), screens/system-multimedia.ts (approval, connections, remote default, display line),
  styles/media-glass.ts (--mm-* tokens; always glass; light/dark from devices.scheme); specs unit-media-layout.spec.ts,
  evidence-media-screens.spec.ts (demo; 1440/820/390; loading/empty/error/ready/view-only/editor; RTL).
Touches (sole editor): shell/nav.ts (NAV_A, NavTabId, TAB_PERMISSIONS, applyMultimediaHidden, isMultimediaEditRoute),
  shell/sw-app.ts (routes #/multimedia/*, #/system/multimedia), api/ha.ts (HaPush media_state /
  media_devices_changed).
Interfaces: opens the remote with <media-remote .deviceKey .open @close> by tag (S3); floor bulk via
  media().bulkPreview/bulkRun with the existing confirmation dialog pattern (devices-bulk.ts).
Done: no brand names/logos/hints on operator screens; edit mode from the user menu only (registerScreenEdit
  'multimedia-layout'); personal override saved via /me/prefs; tsc clean; specs run and reported. Estimate 22-28 h.
```

### S3 — frontend: remote, profiles UI, area card, home widget (`pilot/CR015-s3-remote`)

```
Goal: CR §4 (UI side), §7.2-§7.5.
Owns: components/media-remote.ts (<media-remote .deviceKey .open @close> in sw-drawer modal: header power/source/apps,
  sections per remoteSections(), sources/apps tabs, audio switch, states off/art/unavailable/no-wake/view-only/pending/
  not-confirmed/rate-limited, desktop keys, hold-repeat 200 ms / 10 s for arrows+volume, KeyThrottle),
  media-remote-pad.ts (d-pad; touchpad sends d-pad keys), media-remote-keys.ts (label/glyph per KeyId);
  screens/multimedia-remote-editor.ts ("עריכת השלט", registerScreenEdit 'multimedia-remote'); screens/
  devices-media-card.ts (<media-area-card>: library media type + built-in area card, one card per device, area "כבה
  הכל"); home widget 'media' (api/home-config.ts WidgetId, home-widgets.ts); specs unit-media-remote.spec.ts,
  evidence-media-remote.spec.ts (demo; 1440/820/390; every state; RTL; four profiles).
Touches (sole editor): screens/devices-area.ts (media render hook only), devices-layout-cards.ts (media description),
  services/home_config.py + tests/test_home_config.py (widget 'media'), sw-app.ts one import line after S2's.
Interfaces: uses <media-screen-card> (S2) by tag; a local stub under tests/ until S2 merges.
Done: every key through sendCommand + KeyThrottle; no power key UI; no power-on when opened; nothing shown that caps
  does not allow; tsc clean; specs run and reported. Estimate 24-30 h.
```

### S4 — live fixture, evidence, probe, user guide (`pilot/CR015-s4-evidence`)

```
Goal: CR §14 live part, §15.2 probe, the user guide.
Owns: frontend/tests/fixtures/media_fake_ha.py (devices_fake_ha pattern; registries WITH device rows and synthetic
  MACs; Samsung SSV + Cast + SmartThings + MA-export duplicates; LG with/without turn-on and external_speaker; Android
  remote + media_player + Cast; generic; linked receiver; a _stuck TV; fake bridge reads custom_components
  ALLOWED_SERVICES, applies effects after 0.4 s, logs keys/text at GET /media-log on the control server);
  evidence-media-live.spec.ts (SW_LIVE=1: one card per TV, confirmed / not confirmed, exact key codes per profile, 429
  drop, public refusal, bulk skips, area-card remote, editor + personal); scripts/media_probe.py + tests (read-only WS
  allow-list: auth, get_states, entity/device registry lists, get_services; counts and key sets only, never names or
  MACs, to private-evidence/media-probe-<date>/); docs/user-guide/he/42-multimedia_HE.md, screens.json, 80/81 guides.
Touches: nothing else.
Done: live spec green on a throwaway backend (never the lab); screenshots to docs/design/evidence/CR-015/; the guide
  uses "תשתית המערכת", never HA names on operator text. Estimate 14-18 h.
```

### 5.1 Merge order, reviews and shared files

1. **S1** → 2. **S2** → 3. **S3** → 4. **S4**, then an **Opus review of the command path** (routers/multimedia.py,
services/media_commands.py, media_profiles.py, ha_bridge ACTIONS, the bridge's media_policy.py, device_bulk resolver,
the `use_media_screen` refusal) with fixes by S1, then the **full suite** (backend all, frontend unit + evidence +
live) in the release round. Frontend branches work on the mock and are harmless before S1 (the rail entry is gated on
`media.read`, which no role holds until S1).

| Shared file | Sole editor |
|---|---|
| `roles.json`, `routers/access.py`, `role-catalog.design.json`, `routers/settings.py`, `routers/me.py`, `services/user_prefs.py`, `main.py`, `migrations/` | S1 |
| `services/ha_bridge.py`, `ha_sync.py`, `ha_client.py`, `device_bulk.py`, `routers/ha.py`, `custom_components/smplwise_bridge/*` | S1 |
| `frontend/src/shell/nav.ts`, `frontend/src/api/ha.ts`, `sw-app.ts` routes | S2 (S3 adds one import line) |
| `screens/devices-area.ts`, `devices-layout-cards.ts`, `home-widgets.ts`, `api/home-config.ts`, `services/home_config.py` | S3 |
| `frontend/src/api/media-screens*.ts`, this document, the CR | coordinator |
| `management/*`, CHANGELOG, versions, `contracts/API_INVENTORY.md` | release round |

### 5.2 Critical path and totals

S1 (26–32 h) and S3 (24–30 h) bound the calendar; S2 22–28 h, S4 14–18 h, review + fixes 6–8 h. Total **92–116
agent-hours**. Live acceptance on the owner's systems needs bridge 0.4.0 installed and the read-only probe first.

### 5.3 Definition of done (every agent)

Targeted tests actually run and reported (NOT_RUN is not PASS); UI screenshots at 1440 / 820 / 390 with loading /
empty / error / ready; no brand names or HA names on operator screens; no secrets, lab data or real identifiers in
fixtures; commit on the agent's own branch with the CLAUDE.md trailer; a closing report per AGENTS.md.
