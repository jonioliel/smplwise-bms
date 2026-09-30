# CR-015 — Multimedia: screens and the remote ("מולטימדיה · מסכים ושלט")

**Status:** approved for development by the owner on 2026-09-30 (mockup v2, branch `pilot/media-mockup`,
`docs/design/mockups/media/index.html`) with two additions: (A) the cards of the "מסכים" page are editable like the home
screen (order, placement, size, per-screen visibility; the same user-menu edit mode), (B) media cards can be added to the
area screens through the area card library and open the same remote. Every recommendation of
`docs/design/mockups/media/decisions-HE.md` is adopted (§2) unless the owner objects later.
**Release:** 0.1.149 (task T098). **Contract:** `docs/architecture/MEDIA_API.md` (types, routes, examples, the parallel
work plan). **Typed client:** `frontend/src/api/media-screens.ts` + `media-screens-mock.ts` (S0, this branch).
**Sources:** `docs/research/TV_REMOTE_INTEGRATIONS_NOTES.md` (branch `pilot/media-mockup`, "TV notes"),
`docs/research/MUSIC_ASSISTANT_API_NOTES.md` (branch `pilot/media-research`, "MA notes"), CR-007 (device control),
`SCHEDULER_API.md` (contract style). No device, HA or lab system was contacted for this document.

## 1. Scope

| In 0.1.149 | In 0.1.150 (model ready now, no UI) |
|---|---|
| Rail entry "מולטימדיה", page "מסכים": one card per physical screen, grouped by floor, room chips, search, state filter | "נגנים ורמקולים", "קבוצות" pages |
| The remote: side panel (desktop/tablet, right side next to the rail) and bottom sheet (phone) | Music Assistant (MA) direct connection, queues, browse, groups |
| Power, volume, mute, sources, apps, transport, keys (d-pad/touchpad, nav, channels, numbers, colours, text) | Receivers/speakers as their own cards; MA transport |
| Media device model with dedupe (§3), brand profiles (§4), command path (§5), RBAC (§6) | `kind` receiver/speaker/player/group rendered |
| Screens page editor (addition A), area card + home widget (addition B), settings "מדיה" | Announcements (never without a separate decision) |
| Floor "כבה מסכים" and area "כבה הכל" (screens only, confirmed) | |

Linked receivers/soundbars appear in 0.1.149 only as the "שמע: מגבר סלון" line of a screen and as the volume target.

## 2. Owner decisions (adopted 2026-09-30)

| # | Decision | Where |
|---|---|---|
| 1b | One card per physical screen after dedupe (vendor + SmartThings + Cast + DLNA + MA = one), and only screens approved in settings | §3, §9 |
| 2a | Separate rail entry "מולטימדיה" between "מפה" and WisKey | §8 |
| 3b | Three permissions: view · control (volume, keys, transport) · power and source; within the user's floor scope | §6 |
| 4a | Separate permission "מסכים ציבוריים" for app/source change and typing on screens marked public; default site admin | §6 |
| 5b | Remote default: arrows, back/home/menu, volume, channels, transport, recent; numbers, colours, typing behind "עוד מקשים" | §7.2 |
| 6a | Remote editing (sections, source/app order): installation default + per-screen override, via "עריכת השלט" in the user menu | §7.3 |
| 7a | Floor "כבה מסכים" / area "כבה הכל" with confirmation (question + count, details folded), only screens confirmed on, real outcome per screen | §5.5 |
| 8a | The devices area's "כבה אזור" / "כבה הכל בבניין" include screens only (not receivers, not speakers) | §5.5 |
| 9b | Curated sources per screen (order, hide, rename "HDMI 1 · ממיר"), apps in their own tab with neutral glyphs (no logos), "אחרונים" row | §7.4 |
| 10a | A receiver is linked to a screen: card line "שמע: …", remote switch "רמקולי המסך / מגבר", volume follows the choice; the receiver also lives on its own (0.1.150) | §3.4 |
| 11a | No MA for TVs: TVs are controlled only through their vendor integration; MA endpoints of a TV are hidden | §3.2 |
| 12a | Area card: small "now showing" image, name and state, power, volume and mute, "שלט" (the same remote) | §7.5 |
| 13a | Light/dark follows `devices.scheme` (light by default) | §9 |
| 14a | Multimedia is always in the glass style (the remote is built around it), whatever `devices.style` says | §9 |

Research rules adopted with them: power only through `turn_on`/`turn_off`, never a POWER key; "off" is not trusted
("לא אושר" after 8 s); no automatic power-on when the remote opens; no queued or retried physical command.

## 3. The media device model

### 3.1 Principle

The UI renders **media devices** (physical devices), never entities. An entity is an **endpoint** of a device, tagged
with a role; each control of a device answers through one **primary endpoint**. Capabilities come from the live
`supported_features` of that endpoint; the brand **profile** only adds the remote-key vocabulary (TV notes §1.1).

### 3.2 Storage (migration `0041_media_devices.sql`)

- `ha_devices` — a minimal mirror of HA's device registry, filled by the existing registry refresh (`ha_sync`,
  `config/device_registry/list` is already fetched): `device_id` PK, `name`, `name_by_user`, `manufacturer`, `model`,
  `via_device_id`, `area_id`, `connections_json` (MACs normalised: lower-case, no separators), `identifiers_json`
  (normalised `[domain, id]` pairs), `updated_at`, `removed_at`. **Private**: MACs and identifiers never leave the
  backend (no API field, no log line, no fixture with real values).
- `media_devices` — one row per physical device: `device_key` (our UUID hex, stable across entity churn), `kind`
  (`screen|receiver|speaker|player|group`; `group` reserved for 0.1.150), `kind_source` (`auto|manual`),
  `display_name` (NULL = derived), `anchor_entity_id` (the device's home for name, area and **scope**), `profile`
  (NULL = detected), `approved` (0/1; decision 1b), `is_public` (0/1), `audio_link_key` (another device, a receiver),
  `audio_default` (`screen|linked`), `volume_max` (0–100 or NULL), `primary_json` (per-control admin override, NULL =
  automatic), `sources_json`, `apps_json` (curation), `remote_json` (per-screen remote override, NULL = default),
  `recent_json` (last 6 confirmed source/app picks), `confidence`, `created_at`, `updated_at`, `removed_at` (tombstone:
  a device whose endpoints all vanished keeps its curation for 30 days, then the janitor deletes it).
- `media_device_endpoints` — `endpoint_id` PK (`ha:<entity_id>`; `ma:<player_id>` reserved for 0.1.150), `source`
  (`ha|ma`), `ref`, `device_key`, `role` (`vendor|remote|cast|dlna|smartthings|ma_export|ma_import|ma_native|
  ma_universal|other`), `platform`, `rule` (which ladder rung joined it), `link_source` (`auto|manual`), `hidden` (a
  duplicate: listed only in settings › "חיבורים"), `updated_at`. One endpoint belongs to at most one device.
- `media_link_rules` — the administrator's overrides, applied after the ladder: `endpoint_id` PK, `rule`
  (`link|unlink|ignore`), `device_key` (for `link`), `set_by`, `set_at`. Audited (`media.link`).
- `media_layouts` — the screens page layout (addition A): `scope` PK (`installation`), `layout_json`, `revision`,
  `updated_by`, `updated_at`. Personal overrides live in `/me/prefs` (`multimedia.personal`, §7.1).

`0042_media_role_grants.sql` (data only): every custom role holding `devices.read` gains `media.read`; holding
`devices.control` gains `media.control` and `media.power` (JSON1 `json_insert`, idempotent), so no one loses control of a
TV they had through the devices area (§6.3). Next free numbers: 0040 is taken by `pilot/climate-hoffnung`
(`0040_climate_kind.sql`); no branch uses 0041+ (checked with `git ls-tree` on every `pilot/*` branch, 2026-09-30).
If another branch claims 0041 first, the later merge renumbers (the scheduler precedent, T097).

### 3.3 Dedupe ladder (`services/media_model.py`, pure; rebuilt on every registry refresh)

Evaluated in order; the first positive rung wins and is recorded with its confidence (MA notes §4.2, TV notes §8).

| Rung | Rule | Confidence | Effect |
|---|---|---|---|
| 1 | Same HA `device_id` (every `media_player.*` and `remote.*` of that device) | exact | merge |
| 2 | MA loop: an MA-created entity (platform `music_assistant`) whose player id is an HA `media_player.` entity id (import), or whose device is `("music_assistant", player_id)` of an imported player | exact | merge, role `ma_import` / `ma_export`, hidden |
| 3 | MAC: a normalised MAC in `connections` of two HA devices | strong | merge |
| 4 | Identifiers: equal UUID / serial / Cast UUID across two devices' `identifiers` (normalised: lower-case, `uuid:` prefix and dashes stripped) | strong | merge (UNVERIFIED per integration; TV notes §12.6) |
| 5 | Same HA area + normalised name match (brand, "TV", "Cast", "DLNA", "SmartThings", model digits stripped) | weak | **suggestion only** in settings ("הצעת איחוד"), never automatic |
| 6 | Manual `media_link_rules` (`link` / `unlink` / `ignore`) | manual | overrides 1–5 |

Guards: two endpoints of the **same platform** on **different** HA devices are never merged (two Samsung TVs); IP is never
used (DHCP; MA notes §4.2.6); a weak rung never merges across areas; `ignore` removes an endpoint from every device.

### 3.4 Kind, roles and primary endpoints

- **Kind** (manual wins): `device_class` `tv`/`projector` → screen; `receiver` → receiver; `speaker` → speaker; vendor
  TV platforms (`samsungtv_smart`, `samsungtv`, `webostv`, `androidtv_remote`, `androidtv`, `braviatv`, `philips_js`) →
  screen; `music_assistant` / `cast` without a TV sibling → player; else player. 0.1.149 renders `screen` only.
- **Roles**: the vendor TV integration's `media_player` = `vendor`, its `remote.*` = `remote`, `cast` / `dlna_dmr` /
  `smartthings` / MA = their roles (hidden duplicates, visible in settings).
- **Primary per control** (default; admin override in `primary_json`):

| Control | Primary | Never |
|---|---|---|
| power | `vendor` | Cast (its "on" launches an app), MA |
| keys, text | the profile's key endpoint (§4) | — |
| sources, apps | `vendor` (Android: `remote` activities) | Cast, MA (MA shows only "External") |
| volume, mute | linked receiver when `audio_default = linked`, or when LG `sound_output` is `external_*`; else `vendor`; else Cast (Android TV has no `VOLUME_SET`) | — |
| now playing, transport | Cast when it reports `playing`/`paused` with metadata, else `vendor` | — |

The screen's **power state** is the vendor endpoint's; "off" from a missing endpoint is never inferred (TV notes §1.6).

### 3.5 Capability matrix (server-computed `caps`)

From the primary endpoint's `supported_features` bits (TURN_ON 128, TURN_OFF 256, VOLUME_SET 4, VOLUME_STEP 1024,
VOLUME_MUTE 8, SELECT_SOURCE 2048, PLAY 16384, PAUSE 1, STOP 4096, NEXT 32, PREVIOUS 16, SEEK 2) plus the profile flags
(keys, numbers, colours, channels, text, touchpad) and state rules: LG without `TURN_ON` → power-on disabled with
reason `no_remote_wake` (tooltip only); LG with `external_speaker` → no volume slider; Android Remote → steps only;
Samsung Frame `art_mode_status` → `power: "art"`. Apps exist when an app list exists (§7.4). Nothing is rendered
that `caps` does not allow; the server refuses the same (§5.2).

## 4. Brand profiles (`services/media_profiles.py`, data, versioned `PROFILES_VERSION = 1`)

Detected from the vendor endpoint's registry `platform` (`ha_entities.platform`); an admin may pin a profile.

| Profile | Detected from | Keys | Text | Apps | Extra |
|---|---|---|---|---|---|
| `samsung_smart` | `samsungtv_smart` (custom, SSV) | `media_player.play_media` `{media_content_type: "send_key", media_content_id: "KEY_…"}` on the vendor entity | `play_media` `send_text` (≤ 200) | `select_source` (SSV merges apps into `source_list`) | art mode read-only |
| `lg_webos` | `webostv` (core) | `webostv.button {button}` | off (UNVERIFIED) | `select_source` (apps in `source_list`) | `webostv.select_sound_output` |
| `android_tv` | `androidtv_remote` (core) | `remote.send_command {command}` on the `remote.*` endpoint | `remote.send_command "text:…"` | `remote.turn_on {activity}` from `activity_list` | — |
| `generic` | anything else (incl. core `samsungtv`, `androidtv` ADB, Cast only) | none | none | none | power, volume, sources, transport only |

**Key vocabulary** (our `KeyId` → platform code) is the table of TV notes §6: `up down left right ok back home menu exit
info guide source tools settings chlist prech volup voldown mute chup chdown 0–9 red green yellow blue play pause stop
rew ff`. A key missing from a profile is not rendered and is refused. Samsung blue (`KEY_CYAN`) and LG rew/ff stay off
until verified live. **Power keys never exist** in any profile (`KEY_POWER`, `KEY_POWEROFF`, `POWER`); the touchpad
sends d-pad keys. Model-specific extras are enabled per screen in settings, never guessed.

**Unavailable when off**: keys, text, sources, apps, volume and transport are inert while the screen is `off`, `art`
(except power-on "מעבר לצפייה"), `unavailable` or `unknown`; the remote shows the big power button over a dimmed pad.
A generic screen, or a profile whose key endpoint is unavailable while the vendor `media_player` is not, falls back to
the generic surface.

## 5. Commands

### 5.1 One path

`POST /multimedia/devices/{key}/commands` (contract §3.4). The client names a **device and a command**, never an
entity or a service: the server resolves the primary endpoint, the profile code and the HA service. Every call goes
through `ha_bridge.validate_action` and the signed bridge (`smplwise_bridge.execute`) with the caller's HA user as the
context, exactly like `routers/ha.py run_action` (idempotent `client_request_id`, `expires_at`, `ha_actions` row,
confirmation poll `GET /ha/actions/{id}`).

### 5.2 Allow-list additions (`ha_bridge.ACTIONS`, flag `route: "media"`) and bridge 0.4.0

| Action id | Service | Arguments | Confirmation |
|---|---|---|---|
| existing `media_player.turn_on` / `turn_off` / `volume_set` / `volume_mute` / `media_play` / `media_pause` / `media_stop` | unchanged | unchanged | unchanged |
| `media_player.volume_up`, `volume_down` | media_player | — | none (sent) |
| `media_player.media_play_pause`, `media_next_track`, `media_previous_track` | media_player | — | none |
| `media_player.select_source` | media_player | `source` str 1–120 | attribute `source` |
| `media_player.play_media` | media_player | `media_content_type` enum `send_key`/`send_text`, `media_content_id` str 1–200 | none |
| `remote.send_command` | remote | `command` str 1–205 | none |
| `remote.turn_on` | remote | `activity` str 1–200 (required) | attribute `current_activity` |
| `webostv.button` | webostv | `button` enum (LG list, no power) | none |
| `webostv.select_sound_output` | webostv | `sound_output` str 1–40 | attribute `sound_output` |

- `route: "media"` actions are refused by `POST /ha/entities/{id}/actions` (409 `use_media_screen`, audited), so the
  generic path can never send an arbitrary `play_media` or key. In addition every `media_player`/`remote` entity that is
  an endpoint of an **approved** media device is refused there too (the alarm/scheduler precedent): the media
  permissions, rate limits and audit are the only authority for a managed screen.
- The add-on validates more than the schema: the key is in the device's profile and `caps`; `select_source` value is in
  the endpoint's live `source_list` and not hidden by curation; `activity` is in `activity_list`; text ≤ 200 chars
  without control characters; `send_key` content matches `^KEY_[A-Z0-9_]{1,24}$` and is not a power key.
- **Bridge 0.4.0** (`custom_components/smplwise_bridge`, mirrored by `scripts/sync_integration.py`): `ALLOWED_SERVICES`
  += the rows above; new dependency-free `media_policy.py` re-checks independently: no power key in any transport, key
  codes against the profile tables, `source` ∈ the entity's current `source_list`, `activity` ∈ `activity_list`, text
  length, `remote.turn_on` only with `activity`, never `remote.turn_off` / `webostv.command` / `play_media` of any other
  type. An add-on with media commands refuses them (503 `bridge_outdated`) while the paired bridge is older than 0.4.0.

### 5.3 Rate limits and timing (server-enforced; the UI mirrors them)

| What | Limit |
|---|---|
| Keys (incl. volume/channel keys) | per device 5/s, burst 8; per user 10/s across devices → 429 `rate_limited` (dropped, never queued) |
| Hold-to-repeat | client only, arrows and volume, 200 ms interval, stops on release, capped at 10 s |
| `volume_set` | per device 4/s (the client debounces, last value wins); `volume_max` ceiling clamps |
| Power | one power command per device in flight; a second within 8 s → 409 `power_pending`; min 2 s between power commands |
| Text | 1/s per device, ≤ 200 chars, never pre-filled |
| Pending UI | spinner until the state confirms; after 8 s "המסך לא אישר את הפקודה" and back to the last confirmed state |

### 5.4 Never

Power toggles or power keys; `remote.turn_off`; automatic power-on when the remote opens; retries or queues after a
reconnect (AGENTS.md); commands to an `off`/`unavailable` screen other than power-on; cross-device side effects from our
UI (SSV `sync_turn_on/off` and LG turn-on automations are shown read-only in settings as "גם מדליק: …").

### 5.5 Bulk

- **Multimedia** (decision 7a): floor "כבה מסכים" and area "כבה הכל", `media.bulk` at that floor/area; building-wide is not
  offered (7b not taken). `GET /multimedia/actions/preview` then `POST /multimedia/actions` with `confirmed: true`; the
  engine is `services/device_bulk.py` (same records, in-flight bound, honest per-device outcome, poll
  `GET /devices/actions/{bulk_id}`), with a media target resolver: approved screens only, their **power endpoint only**,
  only screens confirmed on (`on/playing/paused/idle` with `confirmed: true`) or in art mode; `off`, `standby`,
  `unknown`, `unavailable` and unconfirmed are counted as skipped with a reason. Receivers are never included (a
  receiver may feed other rooms).
- **Devices area** (decision 8a): the existing `screens_off` / `all_off` kinds keep `devices.control_bulk` but resolve
  `media_player` targets through the same resolver (screens only, power endpoint only, confirmed on); `screens_on` is
  limited the same way. Unclassified players are listed as "לא כלול: לא מוגדר כמסך".

## 6. Permissions

### 6.1 Catalogue (`roles.json`, `routers/access.py` PERMISSION_LABELS, `contracts/examples/role-catalog.design.json`)

| Permission | Hebrew label | Allows | Default roles | Sensitive |
|---|---|---|---|---|
| `media.read` | צפייה במסכים ובמולטימדיה | the page, cards, state, now playing, remote (read) | viewer, operator, editor, site_admin, system_admin (like `devices.read`; not kiosk) | no |
| `media.control` | שליטה במסכים: עוצמה, מקשים וניגון | volume, mute, keys, touchpad, transport, text | operator, site_admin, system_admin | no |
| `media.power` | הדלקה וכיבוי של מסכים והחלפת מקור | power on/off, source, app, sound output | operator, site_admin, system_admin | no |
| `media.public` | מסכים ציבוריים: החלפת מקור ואפליקציה והקלדה | the same on screens marked public | site_admin, system_admin | **yes** |
| `media.bulk` | כיבוי מרוכז של מסכים בקומה או באזור | floor/area "כבה מסכים" | site_admin, system_admin | **yes** |
| `media.layout` | עריכת מסך המולטימדיה והשלט | the screens page layout, remote defaults and per-screen remote curation | site_admin, system_admin | no |

Device merge/split, kinds, approval, public flag, audio links, profiles and the settings page use `system.configure`
(the scheduler precedent: no separate config permission). A custom role grants the two sensitive ones only by naming
them among its sensitive permissions. `screen.personalize` (existing) gates the personal layout override (§7.1).

### 6.2 Evaluation (every route, server-side)

Scope = the device's `anchor_entity_id` placement (`ha_scope.entity_allowed`, shared spaces included; HA areas and
floors are never a scope). A command passes when: permission at the anchor (`media.control` or `media.power` by
command), the device is approved and visible, the live primary endpoint supports it (`caps`), the profile has the
key, a public screen's source/app/text needs `media.public` at the anchor, the rate limit allows it, and the bridge
is ≥ 0.4.0. HA's own per-user permissions still apply through the bridge context. Denials are audited with their code.

### 6.3 Relation to existing permissions

`devices.read` keeps the building counts ("מסכים דולקים"); `devices.control` no longer reaches a managed screen (§5.2)
— migration 0042 gives custom roles the equivalent media grants; built-in roles get them in `roles.json`.
`ha.entity.control` holders are refused on managed screens too (one authority). `/ha/ws` stays gated by
`entity.state.read`; `media_state` frames are additionally filtered by `media.read` scope.

## 7. Screens page, editor, remote, area card, home widget

### 7.1 The "מסכים" page and its editor (addition A)

- Glass page (mockup v2): large title, scrolling room chips, floor button with the floor menu ("כבה מסכים"); cards
  grouped by floor (or area, or none); search and a state filter (all / on / off / unavailable); phone: horizontal
  compact cards, remote as a bottom sheet.
- **Edit mode** reuses the home screen's model and entry: the page registers `registerScreenEdit({ id: 'multimedia-
  layout', label: 'עריכת מסך המולטימדיה', can: media.layout && !phone-restricted })` (shell/screen-edit.ts); the user
  menu item enters `#/multimedia/screens?edit=1` (tab row hidden while editing, like `isHomeEditRoute`). The edit bar has
  save / cancel / "ברירת מחדל"; the side panel mirrors `home-edit-panel.ts`: drag or up/down to **order**, move a card
  into "מועדפים" (a pinned top row) or back to its group (**placement**), **size** s/m/l per variant, **visible on
  desktop / on phone** per screen, group by floor/area/none, floor order.
- **Stored**: installation layout in `media_layouts` (`PUT /multimedia/layout`, `media.layout`, optimistic `revision`,
  409 on conflict, audited `media.layout.update`); a **personal override** in `/me/prefs` `multimedia.personal` (order,
  per-card on/size, group_by) only for holders of `screen.personalize` — refused on write and hidden on read without
  it, exactly like `home.personal`; the server returns the effective layout. Unknown/vanished keys are ignored on read
  and pruned on the next save. `ui.mobile.hide_layout_editor` hides the editor on phones.

### 7.2 The remote (`<media-remote>` inside `sw-drawer modal`)

Right-side panel next to the rail (desktop/tablet), bottom sheet (phone). Header: power · source · apps (mockup v2).
Body sections (default order and visibility, decision 5b): `recent`, `nav` (back/home/menu), `dpad` (or `touch`),
`vol` (rocker + slider when `volume_set`, mute), `ch`, `pbk`; behind "עוד מקשים": `nums`, `colors`, `text`, `xtra`.
Tabs "מקורות" / "אפליקציות". Audio switch "רמקולי המסך / מגבר" when a receiver is linked. Keyboard shortcuts on desktop
(arrows, Enter, Backspace) only while the remote has focus and no field is being typed in. Pressed feedback and a haptic
tap where supported. States: loading, unavailable ("לא זמין · מאז HH:MM" and nothing else), off (big power, dimmed pad),
no remote wake (power disabled, reason in the tooltip), view-only (`media.read` only: state visible, controls absent),
pending, not confirmed, rate-limited (the press is dropped with a short shake, no text).

### 7.3 Remote editing (decision 6a)

"עריכת השלט" in the user menu while a remote is open (`registerScreenEdit` id `multimedia-remote`, `media.layout`):
scope "למסך הזה" / "ברירת מחדל לכל המסכים"; section on/off and order; sources and apps order, hide, rename, glyph;
the read-only "חיבורים" list (which endpoint answers what) for `system.configure` holders. Stored in
`multimedia.remote_default` (setting, written by `PUT /multimedia/remote-default` with `media.layout`) and
`media_devices.remote_json` / `sources_json` / `apps_json` (`PUT /multimedia/devices/{key}/remote`).

### 7.4 Sources and apps

Sources = the endpoint's `source_list`, curated (order, hide, rename, glyph); a pick sends the entity's **own string**,
never the display name. Samsung/LG merge inputs and apps in one list: the split is a curation field `kind:
source|app|channel` with a default heuristic (TV, HDMI n, AV, USB, Component, Live TV → source; else app); Android apps
come from `activity_list`. Apps are shown with neutral glyphs and our own hues, never brand logos or colours. "אחרונים"
= the last 3 confirmed picks per screen (server-kept, not synced to the TV).

### 7.5 Area card and home widget (addition B)

- **Area card**: the library's `media` type (existing `CARD_TYPES.media`, `routers/device_layouts.py CUSTOM_TYPES`)
  renders `<media-area-card>`: one compact `<media-screen-card>` per screen of the area (dedupe applied: several
  endpoints of one TV = one card) with the small now-showing image, name/state, power, volume, mute, "שלט" (same
  `<media-remote>`), and "כבה הכל" for the area's screens (`media.bulk`). Custom `media` cards store entity ids as
  today; any endpoint id maps to its device; a device appears once. Non-screen players keep the existing row until
  0.1.150. The built-in area card follows the same rendering.
- **Home widget** `media` ("מסכים", `api/home-config.ts WidgetId`, `services/home_config.py`): count of screens on, the
  on screens as chips (tap → remote), same sizes/phone rules as the other widgets; hidden without `media.read`.

### 7.6 Phone and tablet

Phone (≤ 599 px): cards horizontal and compact, floors as chips, remote as a bottom sheet with the pad centred, "עוד
מקשים" folded, sources/apps as a grid. Tablet: two-column cards, side remote. The rail entry follows `nav.order`; the
bottom bar gains the entry (users may reorder/hide as today).

## 8. Navigation and routes

`NAV_A` += `{ id: 'multimedia', icon: 'play', label: 'מולטימדיה', href: '#/multimedia/screens' }` between `explore` and
`wiskey`; `NavTabId` and `services/user_prefs.NAV_TAB_IDS` += `multimedia`; `TAB_PERMISSIONS['#/multimedia/screens'] =
['media.read']`; `multimedia.enabled = false` hides it (`applyMultimediaHidden`, the schedules pattern). One tab in
0.1.149 ("מסכים"; the tab row is hidden while it is the only one). Routes: `#/multimedia/screens` (query `floor`,
`area`, `q`, `state`, `remote=<key>`, `edit=1`), settings `#/system/multimedia` (`system.configure`,
installation-only). The HTTP API lives under `/api/v1/multimedia/*` because `/api/v1/media/*` is the camera video
router and the `media.*` settings keys are the video settings.

## 9. Settings (הגדרות › מולטימדיה, `#/system/multimedia`, `system.configure`, audited `settings.update` / `media.device.update`)

- **מסכים**: every discovered device with kind, confidence, approval toggle ("אשר את כל המסכים שזוהו" as one action),
  display name, floor/area (read from HA), public flag, profile (detected / pinned), linked receiver, default audio
  target, volume ceiling, model extra keys, "גם מדליק: …" read-only.
- **חיבורים**: endpoints per device (integration name, role, rung, hidden), link / unlink / ignore, weak-rung merge
  suggestions.
- **שלט**: the remote default sections (also editable from "עריכת השלט").
- **תצוגה**: read-only line "זכוכית תמיד; בהיר/כהה לפי חשמל והתקנים" (decisions 13a/14a are fixed, no setting).
- Keys: `multimedia.enabled` (`true`), `multimedia.remote_default` (JSON, validated by `services/media_layout.py`).
  Safety rules are not settings.

## 10. Audit (`audit.audit`, resource_type `media_device`, resource_id = device_key)

`media.command` (power, source, app, volume_set, mute, transport, sound_output: with `ha_actions` id, endpoint id, result),
`media.keys` (aggregated: one row per user and device per 60 s window with counts per `KeyId`), `media.text` (length
only, never the text), `media.bulk` (+ the bulk's per-device records), `media.layout.update` / `media.layout.reset`,
`media.remote.update`, `media.device.update`, `media.link`, `media.approve`. Denials carry the `ApiError` code.
Never MACs, identifiers, IPs, tokens or artwork URLs.

## 11. Events

- `media_state` on `/ha/ws`: when a state event hits an endpoint, `ha_sync` recomputes that device's `live` from the
  in-memory model and publishes `{ type: "media_state", device_key, entity_id: <anchor>, live }` (throttled to 4/s per
  device); delivered only to subscribers who see the anchor under `media.read`.
- `media_devices_changed` (no ids) after a model rebuild, curation, approval or layout change: clients refetch.
- `entity_picture` (a tokenised HA proxy URL) is **never** added to `ATTR_ALLOW`; `ha_sync` keeps it server-side in
  memory for `GET /multimedia/devices/{key}/artwork`, which proxies the image (≤ 512 KB, 60 s cache) and only for real
  content art (Cast/MA metadata, content types video/movie/episode/tvshow/music) — never app or channel logos.
- `ATTR_ALLOW` += `source_list` (≤ 100 × 80 chars), `app_id`, `app_name`, `media_content_type`, `media_channel`,
  `media_duration`, `media_position`, `media_position_updated_at`, `sound_output`, `sound_mode`, `art_mode_status`,
  `activity_list`, `current_activity`, `group_members`, `mass_player_type`, `active_queue` (the last three for 0.1.150).
  Never `ip_address`.

## 12. Safety

1. No physical action without one explicit tap; the remote never powers on by itself; no power keys, ever.
2. Bulk off: confirmation (question + count, details folded), screens confirmed on only, honest per-screen result.
3. Rate limits and debounce server-side (§5.3); no queue, no retry after reconnect; client request ids idempotent.
4. Only the fixed key set of the profile; no arbitrary service, no `play_media` beyond `send_key`/`send_text`.
5. Public screens: source/app/text need `media.public`; text never logged.
6. Managed screens are operated only here (§5.2); bridge 0.4.0 re-validates independently.
7. MACs/identifiers stay in the backend; artwork proxied, never an HA URL in the browser.

## 13. API contract (summary; full shapes in MEDIA_API.md §3)

| Method | Path | Auth |
|---|---|---|
| GET | `/multimedia/status` | signed in |
| GET | `/multimedia/devices` | `media.read` |
| GET | `/multimedia/devices/{key}` | `media.read` + visible |
| POST | `/multimedia/devices/{key}/commands` | `media.control` / `media.power` (+ `media.public`) |
| GET | `/multimedia/devices/{key}/artwork` | `media.read` + visible |
| GET / PUT / DELETE | `/multimedia/layout` | read: `media.read`; write/reset: `media.layout` |
| GET / PUT | `/multimedia/remote-default` | read: `media.read`; write: `media.layout` |
| PUT | `/multimedia/devices/{key}/remote` | `media.layout` |
| GET | `/multimedia/profiles` | `media.read` |
| GET | `/multimedia/actions/preview` · POST `/multimedia/actions` | `media.bulk` at the floor/area |
| GET | `/multimedia/admin/devices` | `system.configure` |
| PUT | `/multimedia/admin/devices/{key}` | `system.configure` |
| POST | `/multimedia/admin/links` · `/multimedia/admin/approve` | `system.configure` |
| PUT | `/me/prefs` key `multimedia.personal` (existing route) | `screen.personalize` |

Router `routers/multimedia.py`, tag `multimedia`, registered after `devices` in `main.py`, so
`scripts/api_inventory.py --write` lists every row above (release round).

## 14. Tests

- **Backend unit/API** (S1): `test_media_model.py` (ladder rungs 1–6 incl. the two-Samsung guard, kinds, roles,
  primary per control, LG `external_speaker`, Android remote+Cast pair, SSV merged list split, art mode, unavailable,
  tombstones), `test_media_profiles.py` (vocabulary, no power keys, detection), `test_media_commands.py` (every
  command → exact service call; refusals: caps, profile, hidden source, public screen, off screen, bridge < 0.4.0, 429,
  409 `power_pending`, idempotency, expiry), `test_media_api.py` (every route × permission × scope, view-only, public),
  `test_media_layout.py` (normalise, revision 409, personal gated and hidden), `test_media_bulk.py` (skips, screens
  only, devices-area 8a), `test_media_sync.py` (`ha_devices` mirror, MAC normalisation, `media_state` scope,
  `entity_picture` never in attributes), plus `test_migrations.py`, `test_access.py`, `test_devices.py`, `test_ha.py`
  (`use_media_screen`), `test_ui_settings.py`, `test_user_prefs.py`, `test_home_config.py`.
- **Bridge** (S1): `test_bridge_media_policy.py` (module by path; power keys at any position, source/activity
  membership, text, types), drift test: bridge services ⊂ add-on media actions.
- **Frontend** (S2/S3): unit specs for layout resolution, remote section rules, key throttle; evidence specs in demo
  mode at 1440/820/390 (loading, empty, error, ready, view-only, off, unavailable, pending, not confirmed, editor).
- **Live** (S4): `frontend/tests/fixtures/media_fake_ha.py` — a fake HA with a Samsung (SSV) TV + its Cast +
  SmartThings + MA-export duplicates, an LG with and without turn-on, an Android TV (remote + media_player + Cast), a
  generic screen, a receiver linked to a screen, a `_stuck` TV; registries with devices/connections (synthetic MACs); the
  fake bridge reads the canonical `ALLOWED_SERVICES`, applies effects, and logs keys on the control server so specs
  assert the exact codes sent. `evidence-media-live.spec.ts` (SW_LIVE=1): dedupe to one card, power confirm, not
  confirmed, keys per profile, rate limit, bulk skips, area card remote, editor save/personal.

## 15. Open risks

1. Brand behaviour is UNVERIFIED until live: SSV art-mode state and list kinds, LG off/turn-on states, Samsung blue key,
   LG text, which integrations register MAC `connections` (rungs 3–4) — mitigated by the manual rung and settings.
2. The owner's two systems run different HA / SSV / MA versions (MA notes §6, not contacted); the probe of phase 0
   (read-only registry + states dump, `scripts/media_probe.py`, S4) runs before live acceptance.
3. Bridge 0.4.0 must be installed on each system before media commands work (503 `bridge_outdated` until then).
4. Removing managed screens from the generic path changes behaviour for map cards controlling a TV (§5.2) — owner
   question 2 in the report.
5. Key storms: mitigated by server limits; HA/TV-side websockets may still drop keys (not confirmable by design).

## 16. Deliberately different from the HA cards (media-control card, universal-remote-card)

One card per **physical device** (HA shows one per entity, duplicates included); power is on/off, never a toggle or a
POWER key; only a fixed per-profile key set, no `perform-action`/templates/URLs; per-floor RBAC, a public-screen
permission and audited bulk off with honest per-screen outcomes; "not confirmed" is shown instead of optimistic truth;
rate limits and no auto-repeat beyond arrows/volume; neutral glyphs instead of brand logos; RTL and phone bottom sheet
from day one; layout editable by a permission (`media.layout`) with a personal override, stored in our database, not in
HA dashboards.
