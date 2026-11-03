# WISKEY-PAIRING-2382 - "חיבור Arx ל-WisKey": pairing status, signed check, guided re-pair, and "מצב WisKey"

Branch `pilot/WISKEY-PAIRING-2382`, cut from `origin/main` (efc12d0e3, 2.38.0). No version bump, not merged, no tag. Policy B unchanged:
`wiskey.auto_install` is not touched. Files of the parallel agents (station drawer talk/dial and the provider row, managed install, inbound
calls, deep links, rc.10 pin) are not edited; their features appear only as read-only status with a link.

## 1. The pairing lifecycle (read in both code bases)

### Arx side

| Stage | Where | What happens |
|---|---|---|
| Create | `services/ha_bridge.py` `ensure_pairing` (route `GET /ha/bridge/pairing`) | First call creates the pairing code `secrets.token_urlsafe(24)` in `settings.bridge.secret`; `bridge.paired_at` is blank until the bridge proves it. |
| Deliver to the bridge | `services/bridge_install.py` `announce_discovery` | The add-on posts a Supervisor discovery `{addon_url, pairing_code}` - only while the code is NOT adopted into the key set (K-01) and NOT on a manual WisKey owner profile (`hikvision_intercom_manual_upgrade.json` / `_manual_upgrade_profile.json`). Otherwise the owner types the code into the `smplwise_bridge` config flow. |
| Prove | `routers/ha.py` `/ha/bridge/ping` (config flow) and `/ha/bridge/directory` (every 60 s) | Signed with the code; Arx verifies (`ha_bridge.verify_message`) and records `bridge.paired_at`, `bridge.integration_version`, `bridge.directory_at`. |
| Store / adopt | `services/bridge_keys.py` | The first key-rotation step adopts the code as `g0-legacy` (sealed, AES-GCM per install) and clears `settings.bridge.secret`. |
| Rotate | `services/bridge_rotation.py` (switch `bridge.key_rotation`, ON by default; first rotation = one admin click, later ones automatic per reminder) | A completed rotation makes `g1-...` current. The bridge (`keyset.py`, HA-06) then BLANKS `pairing_code` in its config entry. |
| Sign to WisKey | `services/wiskey_media_bridge.py` `BridgeSigner` / `_key_text`, used by `DirectApiTransport`, `SignedBridgeTransport`, `wiskey_direct_join` | Signs with the plain code or `g0-legacy` only, kid-less v1 recipe. A rotated key is refused locally (`bridge_key_rotated`) - nothing is sent. |
| Show | Settings › גשר Arx (code + regenerate), Settings › הקמה (bridge key card) | Before this change no screen said whether WisKey accepts the key. |
| Re-pair | `GET /ha/bridge/pairing?regenerate=true`, now also `POST /system/wiskey-pairing/repair` | Wipes the key set, new plain code, revokes capture leases, clears the bridge's rotation capability; the bridge must receive the new code. |

Endpoints that read the key: `ha_bridge.signing_key` (all signers), `/ha/bridge/*` verification, `/system/bridge-key`, the W10 provider
(`intercom_media.bridge_provider` via `_CachedKey`), the direct join startup (`main.py`), and now `/system/wiskey-pairing`.

### WisKey side (`C:\hik intercom`, `origin/codex/wiskey-mac-m12-policy-b-2026-11-02`, rc.10)

- `trusted_actions/existing_bridge_auth.py`: `PAIRING_DOMAIN = "smplwise_bridge"`. A signature is verified against `entry.data["pairing_code"]`
  of every LOADED `smplwise_bridge` entry (1..16); exactly one must match; |ts - now| <= 60 s; nonce window 120 s.
- `trusted_actions/direct_bridge_origin.py`: the direct socket `/api/hikvision_intercom/arx_bridge/v1/ws` issues the service subject
  `arx-service:<bridge entry_id>` after a matching `direct/connect`; every later frame re-checks that the entry is still loaded and its
  `pairing_code` unchanged.
- `DIRECT_API_V1.md`: "the transport does not provision keys", "`kid` is not a field in this v1 command envelope". A refused connect is closed
  without a word.
- There is NO separate registration, approval or grant in WisKey's panel for the pairing itself or for the six W10 media/talk commands: WisKey
  trusts whatever code the loaded bridge entry holds.
- People writes through the native service writer additionally need `native_service_grants_v1` in the bridge entry's options
  (`native_service_write_api.py`) or the managed installer's grant; on a manual install nobody writes it (`service_grant_required`).

### Consequences

1. "Paired" = Arx's key can sign (present, readable, not rotated) AND WisKey answered a signed `direct/connect`.
2. **Running the bridge-key rotation disconnects WisKey**: Arx stops signing (`bridge_key_rotated`) and the bridge blanks the code WisKey reads.
   Until WisKey accepts a kid, the rotation must stay off where WisKey is used. The repair action offers to switch it off.
3. On a manual WisKey profile a re-pair cannot reach the bridge by itself; the owner removes and re-adds the SMPLWISE Bridge integration
   (its options are lost with the entry, and the WisKey service subject changes with the entry id). Proposal (not done here, the bridge is
   shared): a `reconfigure` step in the bridge's config flow to replace the code in place.
4. Lab finding (coordinator probe 03.11): bridge -> Arx signing is proven (directory pushes verified); Arx -> WisKey is unproven, and the
   media provider selection (`intercom_media.provider_for`) reads ONLY the feed's `overview.api.commands`, which on rc.10 lists no W10 command
   (`w10.listed` = `not_listed`). So even with `auto` and a good pairing, video and talk stay on Arx's own source. The block shows this as
   its own red line (`provider_feed_gate`); the fix belongs to the talk/dial agent (read `direct/capabilities` in the selection) or to WisKey
   (list W10 in `overview.api`).

## 2. What was built

Backend
- `services/wiskey_pairing.py`: the status (8 lines: bridge, component, key, acceptance, discovery, provider, rotation, last error), each
  `ok / warn / blocked / unknown` with a Hebrew text and, when not ok, a Hebrew "how to fix"; the verdict (`paired / not_paired / unknown`),
  `talk_ready`, the repair offer and the exact owner steps. The probe: one `DirectApiTransport.connect("command")` + `direct/capabilities` +
  `direct/time` (reads only; a single-use nonce each; never retried; at most one per 5 s). Fingerprint = first 8 hex of
  HMAC(key, "arx-wiskey-pairing-fingerprint.v1"). `feed_listing()` exposes `w10.listed` (`not_listed / api_incompatible / commands_unknown /
  discovery_unknown`).
- `services/wiskey_feature_status.py` ("מצב WisKey", plan task T3): 25 checklist rows from the plan's matrix "built but off / blocked"
  (#12, 19-23, 39, 41, 43, 54-57, 65-69, 71, 74, 81, 92, 94, 97), each with its reasons (kind SET / POL / PAIR / WK / OWN / RUN), how to turn
  it on, and a link to the owning screen. Reads settings, build constants, the join / provider state and the last probe; writes nothing.
- `routers/wiskey_pairing.py`: `GET /system/wiskey-pairing` (system.configure; sends nothing), `POST .../probe` ("בדוק חיבור חתום"; system
  administrator; audited `wiskey.pairing.probe` with the outcome code only), `POST .../repair` (system administrator, `confirm: true`, optional
  `pause_rotation` default true; refused 409 when not needed or while a rotation runs; audited `wiskey.pairing.repair` + `settings.changed`
  for the rotation switch). Local sessions only (`remote_channel.BLOCKED_ON_REMOTE`). Registered in `main.py`.

Frontend
- `screens/system-wiskey-pairing.ts` in Settings › מתגי מסכי כניסה, above "WisKey רואה את Arx כ־": verdict, talk readiness, the 8 lines
  (W10 chips, provider choice + feed reason), owner steps, the re-pair (confirmation dialog, rotation checkbox, code + copy + steps when the
  code cannot be announced), and the "מצב WisKey" rows grouped. RTL, phone layout stacks, no "Home Assistant" text.
- `api/wiskey-pairing.ts`: types, calls, pure helpers.

### Coordination with the parallel branches

- `pilot/WISKEY-TALK-DIAL-2382` owns the Settings row "מקור הווידאו והדיבור" (`access.station_media_provider`, values "Arx (וידאו בלבד)" /
  "WisKey (וידאו ודיבור)") and `GET /access-control/station-media/readiness`. This block adds NO provider row and edits nothing in
  `system-access-display.ts`: its provider line uses the same label and value words, links to that row, and lists the same closed readiness
  codes (`wiskey_unreachable`, `api_incompatible`, `video_not_listed`, `talk_not_listed`, `pairing_missing`, `pairing_key_rotated`) computed by
  the same rules (`wiskey_pairing.readiness_codes`, a copy only because that branch is not on main; on the 2.38.2 train it can call
  `intercom_media.readiness`). It also shows `w10.listed`'s own reason (`not_listed / api_incompatible / commands_unknown / discovery_unknown`).
- The signed check is a new signing caller: pinned in `tests/test_t06_admission_295.py` and recorded in
  `docs/changes/T06-ADMISSION-MAPPING-295.md` (WISKEY-PAIRING-2382 addendum).
- Managed install, rc.10 pin, station ops, deep links, inbound calls: status only, with a link where a screen exists.

## 3. What is still needed (outside this branch)

From the owner (lab), in order:
1. Settings › מתגי מסכי כניסה › "חיבור Arx ל-WisKey" › "בדוק חיבור חתום" (system administrator). This is the first signed Arx -> WisKey read.
2. If the key line is red (`key_rotated` / `key_unreadable` / `key_missing`) or WisKey refused: "צימוד מחדש" (keep "turn off the bridge key
   rotation" checked). On the manual profile: in the system infrastructure, Settings › Devices & services › SMPLWISE Bridge › delete
   (note its options first), Add integration › SMPLWISE Bridge with the add-on address and the new code; then "בדוק חיבור חתום" again.
3. If WisKey refused while the bridge line is green: make sure there is exactly one SMPLWISE Bridge entry and it is loaded; restart the
   infrastructure; check again.
4. Do not press "rotate" in the bridge key card while WisKey is used.

From development / WisKey:
- Provider selection reading the signed `direct/capabilities` (talk/dial agent) or WisKey listing W10 in `overview.api` (matrix finding 2).
- The direct join starts only at Arx start-up: after switching the provider to `auto`, Arx must be restarted (shown as RUN).
- WisKey: accept a `kid` (or a re-provision path) if bridge key rotation is to stay on.
- Bridge: a `reconfigure` step so a manual-profile re-pair keeps the entry (and its options and service subject).

## 4. Tests

See the closing report of the branch for the exact commands and results (backend pytest, unit spec, runner browser spec).

## 5. Rollback

Revert the branch commits. No migration, no new setting key (the repair only writes the existing `bridge.secret`, `bridge.paired_at` and
`bridge.key_rotation`); the in-memory probe result is lost on restart.
