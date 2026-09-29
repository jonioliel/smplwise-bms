# UI copy rule: no platform branding outside settings

Owner decision, 2026-09-29: "In many places the UI says Home Assistant. Remove those mentions and references -
Home Assistant should appear only in the settings screen. The idea is a system that does not look like it runs
on Home Assistant." This is a standing product rule, not a one-off cleanup.

## The rule

User-facing copy (labels, headings, hints, toasts, error messages, empty states, placeholders, badges) never
names **Home Assistant**, **HA**, **Supervisor**, **Ingress**, **add-on** / **תוסף**, the **Companion app**, or
**HACS**, anywhere in the product - **except** inside הגדרות › מערכת (the settings tabs: חיבורים / connections,
the HA bridge tab of כללי, בריאות ועבודות / health, the wizard's NVR/HA/go2rtc steps, גישה מרחוק, and
diagnostics). Inside those settings screens the technical truth stays exact: the bridge, the add-on, the
Supervisor and Home Assistant itself are real, named things an admin needs to see accurately.

This applies to both the frontend (`frontend/src/**/*.ts`, outside `frontend/src/screens/system-*.ts` and the
wizard step texts in `smplwise/services/setup_wizard.py`) and the backend (Hebrew strings returned to the UI:
`smplwise_vms/backend/smplwise/routers/*.py`, `services/*.py`). Audit action names, log lines and code comments
are unaffected - this is about copy a person reads on screen, not identifiers or developer documentation.

A screen or a shared function that serves **both** a settings screen and a non-settings screen (for example
`services/health_report.py`, which builds both the diagnostics tab's detailed `checks` and the top-bar pill's
`items`) keeps the settings-facing half exact and de-brands only the half a non-settings screen renders.

## Replacement vocabulary

Pick the term that fits the sentence; keep it consistent within one screen.

| Instead of | Say |
|---|---|
| Home Assistant (the platform, as a noun) | "תשתית המערכת" |
| HA / Home Assistant credentials ("the HA username and password") | "חשבון המערכת" / "שם המשתמש והסיסמה שלך" |
| the Companion app | "האפליקציה" |
| "מסונכרן עם Home Assistant" / "רענן מ־Home Assistant" | "מסונכרן" / "רענן" |
| "ישויות HA" / "ישות HA" (an HA entity, adjectivally) | "ההתקנים" / "ההתקן" |
| the whole product, generically | "המערכת" |

Two patterns that come up often:
- A status or empty-state sentence that only exists to say "there's no connection to HA" usually reads better
  with the platform mention dropped entirely ("האזור לא נמצא ב־Home Assistant" → "האזור לא נמצא") rather than
  substituted.
- A sentence with "Home Assistant" as its grammatical subject needs the verb's gender fixed when swapped to the
  feminine "תשתית המערכת" (e.g. "Home Assistant אינו זמין" → "תשתית המערכת אינה זמינה", not "אינו זמינה").

## Kept exact

- `frontend/src/screens/system-*.ts` (all of them: diagnostics, setup, access, storage, audit, wizard).
- `smplwise_vms/backend/smplwise/services/setup_wizard.py` (the wizard's own step text and problem/action copy).
- Backend modules that serve only settings screens: `routers/access.py`, `routers/access_groups.py`,
  `routers/skins.py` (the 3D control-image privacy notice, shown verbatim on the settings screen),
  `services/health_report.py`'s `build()` (the diagnostics tab's `checks` list), `services/nvr_system.py`'s
  Supervisor errors (surfaced only from the connections tab's save-NVR flow).
- `frontend/src/pwa/notifications-settings.ts`, routed at `#/system/notifications` alongside diagnostics/access/
  storage - same settings area as `screens/system-*.ts` even though the file lives under `pwa/`.
- `smplwise_vms/backend/smplwise/auth.py:80,85` (`resolve_principal`'s `untrusted_origin` and `identity_missing`
  refusals): these fire only when the reverse proxy in front of the add-on is misconfigured - before any session
  or principal exists, so no screen ever renders them to an ordinary user. They are read by whoever is installing
  or debugging the proxy, for whom "Home Assistant Ingress" and "Supervisor... X-Remote-User" are the actionable
  facts; de-branding them would make the installer's job harder for no user-facing benefit.

De-branded per this rule (for contrast, since the two paragraphs above list what stays exact): `mode.py`'s
`NVR_NOT_CONFIGURED_MESSAGE` (the 409 `ensure_nvr()` raises on `live`/`cases`/`playback`/`media` routes - ordinary
non-settings screens hit this constantly whenever NVR-less mode is on) says "תשתית המערכת" and points at
"בהגדרות SmplWise Arx בתשתית המערכת", not at Home Assistant's Add-ons page.

Source: original (owner instruction 2026-09-29, no prior written record).
