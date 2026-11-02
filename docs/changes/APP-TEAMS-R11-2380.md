# APP-TEAMS-R11-2380 - update package for the external app teams (docs only)

Task: M1 of `private/planning/NEXT_PHASE_DISPLAY_MOBILE_PLAN_2026-11-02.md` (A1, the docs part of A7, A4). Branch `docs/APP-TEAMS-R11-2380` from
`origin/main` (2.35.0, `03205b5c7`). No code, no device, no runner; nothing was run for this record.

## What is in the repository

- The previously untracked mobile handoff files are tracked now: `mobile/ios-shell/HANDOFF_IOS_CODEX.md`, `HANDOFF_IOS_ADDENDUM_SENSORS_PUSH.md`,
  `HANDOFF_IOS_ADDENDUM_2_DECISIONS.md`, `CODEX_PROMPT_IOS_HE.txt`, `mobile/android-shell/HANDOFF_ANDROID_ADDENDUM_SENSORS_PUSH.md`,
  `mobile/ios-shell/brand/` (app icon, PWA icons, SmplWise logo and mark) and `EMPLOYEE_NOTICE_DRAFT_HE.md`.
- Secrets read of every file (text and the PNG chunks of the brand images): no address, token, serial, MAC, e-mail or personal data. The files
  carry public identifiers only (bundle ids, App Group name, the Arx brand colours). Nothing was redacted or left out.
- `HANDOFF_IOS_CODEX.md` section 1: the brand table named a `smplwise-mark.png` that is not in the folder and a mint wordmark; it now names
  the real files and colours.
- A4: `EMPLOYEE_NOTICE_DRAFT_HE.md` describes the phone-side Wi-Fi match (contract v2.1 section 2.1, default `phone`): only the result and the time
  reach the server, no network name and no hash; a bracketed server-mode alternative (hash sent and kept); needs the location permission; runs only
  with the network sensor on. It is a draft for counsel, not legal advice. Presence stays OFF until counsel approves and the owner switches it on.

## The package (private, not in git)

`private/handoff-package/APP_TEAMS_R11_2026-11-03/`: the Hebrew prompt (written to work whether or not the 30.10 status request was sent, owner
question 10), the BUILT / NOT_RUN / BLOCKED table of what the server provides, the attachments list, the attachments and one zip. The owner
sends it; Arx does not.

Server facts come from `origin/main` (2.35.0), the 2.36.0 train (`release/2360-train` @ `eb9525d9b`) and, for contract v2.2, branch
`pilot/MOBILE-CONTRACT-V22-2380` @ `aed13eda4` (lead's message of 2026-11-03). The package attaches contract v2.2, `presence-sensor-values.v2.2.example.json`,
`contracts/fixtures/device_key_rotation/` (incl. `replace_vector.json`, test key only) and `APPREFRESH-DEVICEKEY-SPEC.md` rev 2. v2.2 items are marked
"בגרסה הבאה" (server value check defaults to `off` = the 2.1 behaviour, so 2.1.x apps are unaffected); the prompt asks both teams for S-1, S-2, S-4,
W-3 and K-5 status (P-1 added). K-5 itself is already BUILT on main (device-key pin, `409 device_key_bound`); v2.2 adds the normative section and fixtures.
The area presence line (anonymous count, no contract change) is the only other train-only item. Marked "not built": the brand-logo API for apps (L-2) and
narrowing the quiet window to phone/browser push (Q-3).

## NOT_RUN

Every device and real-server check of the apps (2.1.5 build 12), real FCM/APNs, the relay (not deployed), the session-exchange 303 proof (supervised run
only). Not done here: A7's registry rows in `management/tasks.json` (owned by H1).
