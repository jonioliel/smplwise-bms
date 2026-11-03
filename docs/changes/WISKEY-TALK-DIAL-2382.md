# WISKEY-TALK-DIAL-2382 - Arx-native dial and talk to a WisKey station

Branch `pilot/WISKEY-TALK-DIAL-2382`, cut from `origin/fix/STATION-WS-PATH-2381` (5753a4a1d, the one-`api/v1` socket path fix). Target release:
**2.38.2 (activation)**, per the owner's release split of 03.11 (Q8). Fakes and mocks only: the lab was not touched.

## 1. What the owner gets

- **Settings › מתגי מסכי כניסה › תצוגת מסך התחנות** has a new row, **"מקור הווידאו והדיבור"**. It appears while the media setting is not off.
  - The choices are **"Arx (וידאו בלבד)"** (`access.station_media_provider = local`, the default) and **"WisKey (וידאו ודיבור)"** (`auto`).
  - Under the label, one line says in plain Hebrew what WisKey mode still needs. For example, the lab case of 03.11 reads:
    "חסר למצב WisKey: WisKey לא מפרסם פקודות וידאו ל-Arx; WisKey לא מפרסם פקודות דיבור ל-Arx".
  - The choice is saved through `PATCH /settings` and audited (`settings.update`) like every other row. The key existed already but had no UI until now.
- **The station drawer's "חיוג לעמדה"** follows the owner's answer of 03.11 (Q2 "ג").
  - When talk is offered, the button IS Arx's own talk session. It uses the existing `POST .../talk` and talk socket, with one start request that is
    never retried.
  - During the talk, the row shows the in-call duration ("בשיחה 0:42"), the time left, a mute toggle, and **"ניתוק"** (hang up).
  - A small secondary link, **"בלוח הקלאסי"**, stays beside the button.
  - When talk is not offered, the drawer says why in one sentence, with the classic panel as the secondary way. It never falls back silently.
  - The drawer now has a single talk control. It moved from under the player into the call section, at one stable position, so an open talk
    survives a ringing or in-call change.
  - The live view still mutes its own sound for that station's talk: it listens for the `talk-floor` event on the window.
- **Every talk reason has Hebrew text** in the drawer (`talk.reason` of `GET /access-control/stations/{id}/media`):

| reason | when | drawer text |
|---|---|---|
| `off` | the setting is "video" | דיבור מהמסך כבוי בהגדרות (וידאו בלבד) |
| `provider_local` | **new**: the source is Arx's own (video only) | המקור המקומי מציג וידאו בלבד, בלי דיבור |
| `pairing` | **new**: WisKey was chosen, but no pairing key can sign (absent, unreadable, or rotated) | חסר צימוד חתום למערכת האינטרקום, ולכן אין דיבור מהמסך |
| `not_listed` | **new**: WisKey's discovery does not list the W10 talk commands for Arx (or the contract is incompatible) | מערכת האינטרקום לא מפרסמת פקודות דיבור ל-Arx |
| `unsupported` | WisKey lists talk, but this station offers none (also any other provider's descriptor without talk) | העמדה הזו לא מציעה דיבור |
| `wiskey_unavailable` | **new**: WisKey was chosen, but it is not reachable now or its answer failed; Arx's own video serves | מערכת האינטרקום לא זמינה כרגע; מוצג וידאו מהמקור המקומי |
| `forbidden` | no `access.call` on the station | אין הרשאה לדבר עם העמדה |
| any other value, or `state: unavailable` | - | דיבור אינו זמין כרגע |

Before this change, `provider_local` and `not_listed` were both reported as `unsupported`.

With `access.station_media = off`, the drawer is exactly as before: the dashed classic-panel dial link, and no media read.

## 2. What "dial" means on WisKey's side (owner decision Q2 "ג": no ring feature)

Read from `C:\hik intercom`, branch `origin/codex/wiskey-mac-m12-policy-b-2026-11-02`. The lab probe (WisKey 2.0.1-rc.10, read only, by the
coordinator) agrees.

- **WisKey has no command that rings a door station or calls a resident's indoor unit.** No `call_station`, `dial`, `ring`, `invite` or
  `callIndoor` exists. "יעד חיוג" in WisKey's docs is the station's own call target for its bell button. Akuvox `dial()` / `call.dial` exists only as a plan.
- `media/call {station_id}` is **read only**. It returns `call_commands`, `state`, `last_result` and `busy`, and opens no call or audio
  (`health_api.py`, `MediaClient.call_context`).
- `media/signal {station_id, command: answer|reject|hangUp}` is one ISAPI `PUT /ISAPI/VideoIntercom/callSignal`, and only for a call that
  already exists (`ringing` for answer/reject, `in_call` for hangUp). `reject` and `hangUp` also close the station's media. No audio is carried.
  **Arx already uses it**: the drawer's answer / reject / hang-up buttons (`routers/access_control.py`, `intercom_client.signal`). This branch
  does not change that path.
- `media/provider_check`, `media/provider_discover`, `media/settings_get` and `media/settings_update` are WisKey's own go2rtc settings. They carry no talk.
- WisKey's `media/talk_open` opens the station's Hikvision two-way audio channel directly (`/ISAPI/System/TwoWayAudio/channels/1/open`), and also
  on an idle station. It never sends a call or door command.

So **dial = an Arx talk session** (`media/station_descriptor` -> `media/talk_open`, signed). No new W10 command was needed, and none was invented.

## 3. Backend

- `services/intercom_media.py`:
  - `signing_problem(conn)`: `not_paired` / `key_rotated` / None. It uses the signer's own key rule; nothing is signed and the key is never returned.
  - `readiness(settings, conn)`: the facts `provider_for` decides on, plus the closed `READINESS_CODES`:
    - `wiskey_unreachable` (the feed has no current copy);
    - `api_incompatible`;
    - `video_not_listed`;
    - `talk_not_listed` (now named on its own, even when video is not listed either);
    - `pairing_missing`;
    - `pairing_key_rotated`.

    It is read only and never builds or uses the signed provider (a test pins this).
  - `talk_gap(settings, conn, descriptor)`: the reasons in the table above.
- `routers/intercom_media.py`:
  - `talk.reason` comes from `talk_gap`.
  - **New** `GET /api/v1/access-control/station-media/readiness`. It requires `system.configure` on the installation (a refusal is audited by
    `require`). It returns `{choice, active, mode, wiskey: {reachable, video_listed, talk_listed, signing}, missing[], video_ready, talk_ready}`.
- `contracts/API_INVENTORY.md` is **not regenerated** here: that is a release step (`scripts/api_inventory.py`), and the 2.38.2 train adds this one route.

## 4. Frontend

- `api/station-media.ts`: `STATION_MEDIA_PROVIDER_KEY`, `parseProvider`, `getStationMediaReadiness`, `readinessSummary`, `TALK_REASONS` / `talkReason`, `dialState`.
- `i18n/wiskey-station-media.ts`: the `dial` and `source` strings, in Hebrew and English.
- `wiskey/talk-session.ts`: `openedAt` and `secondsOpen()` (the in-call duration counts from the station's channel opening).
- `components/wk-talk-button.ts`: the `dial` mode and `idleLabel` (the phone glyph, "חיוג לעמדה" or "דיבור עם העמדה" while the station is in a
  call), the elapsed time, and "ניתוק".
- `components/wk-station-live.ts`: `talkHere`. With it false, the talk control is the call section's, and the window `talk-floor` listener mutes the
  player.
- `screens/wiskey-stations.ts`: `dialControl`. `liveArea` no longer draws the talk button or classic link for a caller who may call, and
  `talkControl(large)` steps aside once the media was read.
- `screens/wiskey-stations-views.ts`: the `dialControl` hook and the stable dial slot in the call section.
- `screens/wiskey-stations-css.ts`: `.dialnative` and `.cs.dialwhy` (the reason wraps and is never cut).
- `screens/system-access-display.ts`: the source row and the readiness line.

## 5. Shared edits (other agents' areas: minimal, additive)

- `screens/wiskey-stations.ts`, `wiskey-stations-views.ts`, `wiskey-stations-css.ts`: the stations screen, which the inbound-calls work may also
  touch. These are additive hooks only. `callRow` (answer / reject / hangUp) is unchanged.
- `tests/wiskey-station-media-mocks.ts`: a `talkReason` override (default null = unchanged behaviour).
- Spec selectors in `evidence-` / `layout-` / `pixel-wiskey-station-media.spec.ts`: `wk-station-live wk-talk-button` -> `wk-talk-button`, and the
  classic link -> `[data-wk-dial="reason"] [data-wk-dial-classic]`.
- Not touched: `system-wiskey-diagnostics*`, the pairing backend (`ha_bridge`, `bridge_keys`, `wiskey_media_bridge.py`: read only), `wiskey_auto_install`,
  `bridge_install`, and incoming-call notifications.

## 6. Recorded contradiction

The coordinator asked for the exact text "WisKey לא מפרסם פקודות דיבור ל-Arx" in both the source row and the drawer's reason. The operator drawer
has a standing rule that it never names the integration (UI_COPY_RULES; the `BANNED` list of `evidence-wiskey-station-media.spec.ts`).

- The Settings row uses the exact text.
- The drawer says "מערכת האינטרקום לא מפרסמת פקודות דיבור ל-Arx".

The owner can choose otherwise. That would change the rule and its spec too.

## 7. For the WisKey team

1. **The six W10 commands are not listed for Arx.** WisKey 2.0.1-rc.10 in the lab: `overview.api` = version 1, min_client 0, 258 commands, none
   of `media/station_descriptor`, `media/stream_lease`, `media/talk_open|frame|floor|close`. With this, Arx's WisKey mode can serve neither video nor
   talk; the Settings row now says so. Please check whether the handlers are registered in rc.10 and only filtered out of the service user's list
   (panel permissions), or not shipped. Also check whether `direct/capabilities` on `/api/hikvision_intercom/arx_bridge/v1/ws` lists them.
2. No new command is requested. The owner decided (03.11, Q2 "ג") that dial = Arx's talk session, with no ring feature. A future "ring the station /
   call an indoor unit" would need a new WisKey command; it is not asked for now.

## 8. Tests

See the closing report and section 9 for the exact commands and results.

## 9. Results

(filled in below by the runs of this branch)
