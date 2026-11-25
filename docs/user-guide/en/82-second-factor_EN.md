# Second factor, passkeys, step-up and the Android app download

Source: original (English edition of `docs/user-guide/he/82-second-factor_HE.md`, written for 2.51.0 by MFA-REVIEW-DOCS-2520).
Security review of the mechanism: `docs/security/MFA-REVIEW-2520.md`. Screen names are given in English with the Hebrew label in
brackets where the screen shows Hebrew only.

## What it is

A *second factor* is something only you have, on top of the password. Arx knows four:

| Method | What it is | Where it works |
|---|---|---|
| **Authenticator-app code** | a 6-digit code that changes every 30 s (Google Authenticator, Microsoft Authenticator, ...) | remote sign-in, step-up, removing your own factor |
| **Recovery codes** | 10 one-time codes `XXXX-XXXX`, for a lost phone | instead of the code at sign-in, when removing the factor, and for an ordinary step-up (not for every action - see below) |
| **Passkey** | fingerprint, face or device PIN through the browser | step-up. For Arx-only accounts also sign-in; for home-system users step-up only |
| **Phone key** | a key the Android app keeps in the phone, unlocked by fingerprint or screen lock | inside the app: remote sign-in and step-up |

On top of them, three administrator settings:

1. **Remote sign-in factor policy** - who must have a factor to sign in from outside. Default: **optional for everyone**, mode **report**.
2. **Confirm before sensitive changes** (step-up) - confirm your identity again before changing settings, users or permissions, and
   before disarming the alarm, bypassing a zone or opening a door. **Off by default**: while off, the second factor is asked at sign-in only.
3. **Resetting another user's methods** - for someone who lost everything.

**Without any action by a user or an administrator nothing changes:** no requirement, no extra prompts, and the local channel (inside
the home system) is never asked.

## How do I... (every user)

Everything is in one place: user menu (avatar) > **My account** > **Security** ("אבטחה"). The top of the section summarises: the
authenticator app on or off, passkeys, phone keys, recovery codes left (amber when few are left) and long-lived tokens.

### Turn on the authenticator code

1. **Sign in again** if your current sign-in is older than 5 minutes. From outside, a factor - the first one **or any further one** (a
   passkey, a phone key, new recovery codes) - can only be added from a fresh sign-in; otherwise you see "this needs a fresh sign-in".
   This keeps someone who stole an old session from putting their own factor on your account. On the local network the rule does not
   apply. While step-up is on, a confirmation of your identity counts instead (as before).
2. In "Two-step verification", press **Turn on**. A QR code appears with a key to type underneath.
3. Scan the QR code in the authenticator app (or type the key) and enter the 6-digit code. **Confirm**.
4. **Ten recovery codes appear - once only.** Print them or store them somewhere safe, away from the phone.
5. Your other remote sign-ins end (the current one stays), and every device of yours is told that a factor was added.

From now on every **new** remote sign-in asks for the password and then the code. A sign-in that is already open carries on.

### Recovery codes

- Each code works **once**. "Security" shows how many are left; at 3 or fewer you get a warning.
- **New codes:** "New codes" > **Create** - every old code stops working at once. You enter the current code from the app (or, from
  outside, sign in again within 5 minutes; while step-up is on a passkey or the phone key also confirms - **never** a recovery code).
  Every device of yours is told that new codes were made (never the codes themselves).
- **Lost the phone:** at sign-in pick "Recovery code" instead of "App", sign in, then in "Security" remove the two-step verification with
  another recovery code and turn it on again with the new phone.
- A recovery code is **not** accepted for the actions that always demand their own confirmation (resetting another user, revealing the
  bridge-key code) or for adding a factor (a new code, a passkey, a phone key, new recovery codes).

### Passkey

1. The administrator must first set the site's **public address** (without it passkeys are unavailable).
2. "Security" > "Passkeys" > **Add**. The browser asks for a fingerprint, face or the device PIN.
3. From outside, a fresh sign-in (5 minutes) is needed, as for the code - also when the account already has a factor (while step-up is
   on, a confirmation of your identity instead).
4. A user with administrative permissions needs a passkey that verifies the user (fingerprint / face / device PIN); the browser asks for it.
5. You can name, rename and remove passkeys. Every device of yours is told when one is added **or removed**.

**Important:** for a home-system user a passkey is a **step-up method only**. The remote sign-in still asks for the app code (or the
phone key in the app). For Arx-only accounts (accounts created in Arx itself) a passkey is also a way to sign in.

### Phone key (Android app)

1. A key is added **from the Android app** (its security screen). The phone asks for a fingerprint or the screen lock. From outside a
   fresh sign-in is needed here too (also for a further key). Revoking a key tells every device of yours.
2. From then on, signing in from inside the app, the phone signs instead of you typing a code, and step-up offers "Confirm with the phone key".
3. "Security" > "Phone keys" lists what unlocks each key, whether it is "hardware-attested" or a "software key", when it was added and
   last used. **Revoke** removes a key (a lost phone). A key marked "does not count" must be registered again.
4. The phone key works only inside the app; in a browser use the code or a passkey.

### Typing a code

- A code already used is refused: wait for the next one.
- **Five wrong codes (recovery codes included) lock code entry for 10 minutes** (kept across a restart). The phone key has its own lockout.

### "Confirm identity" before a change (when the administrator turned it on)

With step-up on and a method on your account, changing settings, users or permissions, disarming the alarm, bypassing a zone or opening
a door opens **"Confirm identity"**: the app code, a passkey, the phone key (in the app) or a recovery code. After that you are not asked
again for the time the administrator set (5 minutes by default). Some actions ask **every time** ("valid for one change") - a recovery
code is not accepted there. "Your confirmation" in "Security" shows until when you are confirmed.

When the administrator also turned these on, the window has two more ways, each for **one action only**:

- **"Approve on the phone"** - from a screen with no code or passkey (a computer, for example), when you have a phone key. The screen
  shows a two-digit number; on the phone the app opens "Approval request": type the number and confirm with a fingerprint, face or the
  screen lock. A wrong number or **"Not me - deny"** denies the request, and a new one can be sent only after a few minutes. If you did
  not ask for it - deny it.
- **Your personal alarm code** - for disarming the alarm and bypassing a zone only. Wrong codes count towards the same lockout as the
  alarm code on the alarm screen.

## How do I... (system administrator)

All second-factor settings live in Settings > **Users and permissions** > tab **Two-step verification** ("אימות דו־שלבי"). Visible
to holders of `system.configure` (edit) or `rbac.assign` (read only); not to a delegated site administrator.

### 1. Turn on "Confirm before sensitive changes"

Card **"Confirm before sensitive changes"**:

| Field | Values | Default |
|---|---|---|
| **Ask for confirmation before changes** | on / off | **off** (sign-in only) |
| **Confirmation lasts (minutes)** | 0 to 30; 0 = every change | 5 |
| **On the local network too** | on / off | off - the local network stays the way back into the system |
| **Approve on the phone** | on / off | off - when on, another screen can be approved on the phone with the phone key (typing the on-screen number) |
| **Personal alarm code as confirmation** | on / off | off - when on, the personal code confirms one alarm disarm or zone bypass |

- It applies only to users with a method (code, passkey or phone key). Users without one are not asked. With **Personal alarm code as
  confirmation** on, a user with a personal alarm code is asked for it before disarming or bypassing a zone (and only there).
- Phone approval and the alarm code **never** confirm the every-time actions (below) nor adding or removing sign-in methods.
- A long-lived token from outside is never asked (owner decision; such tokens can be refused on the policy card).
- **Always, even with the switch off,** confirmed every time: resetting another user's methods, revealing the bridge-key code, and an
  administrator removing another Arx user's passkey. **With the switch on** also: granting the system administrator role, and restoring
  a backup.
- **Before turning it on:** make sure you yourself have a working method; saving the setting will itself ask for a confirmation.
- **Recommended** on any system reachable from outside: while the switch is off, whoever obtained an open session of a user can add
  another factor to that account (a phone key, a passkey, new recovery codes) without any confirmation. See "Limits".

### 2. Remote sign-in factor policy

Card **"Remote sign-in factor policy"** (checked at every new remote sign-in; never on the local network):

- **Who must use two-step verification:** optional for everyone (default) - required for administrators - required for holders of
  sensitive permissions - required for everyone.
- **Mode:** **report** (default) - computed and shown, blocks nobody; **enforce** - a user who must have a factor and has none cannot
  sign in remotely until they enrol one (from a local sign-in).
- **Wall-panel exemption:** on by default.
- **Long-lived tokens from outside:** allowed (default) - refused for users who must have a factor - refused for everyone.
- In enforce mode a home-system user who turned on the home system's own MFA may satisfy the policy without an Arx factor - provided
  their sign-in was made after that MFA was first seen.

The **"Policy compliance"** card shows users, how many must have a factor, how many of them do, who is missing one and who is exempt.
Choosing another policy without saving shows a **preview** ("not saved yet") of who would have to enrol. **Read that list before
switching to enforce.**

**Per-user and per-role exceptions:** in the user drawer (row "Two-step verification at remote sign-in") and on the role card in the
**Roles** tab: "inherit", "optional" or "required". The user's own setting wins, then their roles (one role "required" is enough), then
the global setting. "Required" ends the open remote sign-ins of affected users who have no factor.

**What a required user without a factor sees:** a message that the administrator requires two-step verification and that it is turned
on in "My account" from a local sign-in. Make sure such a user has a local way in before you set "required".

### 3. Reset a user's methods (they lost everything)

1. Settings > Users and permissions > the user > row **Two-step verification**. It lists all the user's methods: code, passkeys, phone
   keys, recovery codes left, and whether the home system's MFA was seen for them.
2. **From outside, sign in again first** if your own sign-in is older than 5 minutes - otherwise the dialog says "resetting from outside
   needs a fresh sign-in" and offers no confirm button (from 2.52; on the local network the rule does not apply).
3. **Reset**. The dialog shows what will be removed. **Type the user's username** to confirm.
4. Confirm **your own** identity: app code, passkey or phone key - **on every reset, never a recovery code**.
5. Afterwards: **every** method of the user is gone (code, recovery codes, passkeys, phone keys), every sign-in and device of theirs is
   signed out (phone notifications too), they are told, **and the managers are told**. If the policy requires a factor of them, their
   next remote sign-in asks them to enrol again (the home system's MFA does not count until they do).

**Removing an Arx user's passkey** (Users and permissions > Arx users > the user > "Remove passkey") follows the same rules from
2.52: the same dialog (what goes, typing the username, your own code), the same limits below, and the user **and the managers** are
told. If it was their last factor, they too must enrol again.

Reset limits (every refusal is in the audit log):

- not yourself (use "Remove" in your own account, with a code);
- **at most 3 resets per hour** per administrator (removing an Arx user's passkey counts against the same budget);
- **never the last system administrator who can sign in remotely** if, after the reset, no administrator could. Give another
  administrator a factor first;
- **from outside only with a fresh sign-in** of yours (5 minutes) - also for removing an Arx user's passkey;
- **from where:** the setting `security.factor_reset_channel` - `any` (default, from anywhere) or `local` (local network only).
  Narrowing to `local` works from anywhere; **widening back to `any` only from the local network**. From 2.52 it also covers an
  administrator removing an Arx user's passkey. It has no screen yet - change it through the settings API (a screen is proposed in the review).

### 4. Passkeys and phone keys - system settings

| Setting key | Meaning | Default |
|---|---|---|
| `security.local_public_url` | the public address; no passkeys without it | empty |
| `security.passkeys_all_users` | passkeys for every user (`off` = Arx-only accounts; passkeys already made stop counting) | `on` |
| `security.device_key_auth` | what unlocks the phone key: `biometric_or_screen_lock` or `biometric` only | `biometric_or_screen_lock` |
| `security.device_key_attestation` | hardware attestation of the phone key: `off` - `preferred` (checked and recorded, not enforced) - `required` (only a hardware-attested key counts) | `preferred` |

## Android app download

1. Settings > Remote access > card **"Android app download"**: **download address** (https only; empty = not shown), **version label**
   and **SHA-256** (optional). The link appears on the remote sign-in screen on Android devices only, and never inside the app.
2. **Built-in APK:** when a signed APK is put into the system image it is offered by itself, with version, size and SHA-256. An address
   you set always wins over it.

## Limits - honestly

- **While step-up is off (the default)**, adding a factor from outside needs only a sign-in of the same session within the last 5
  minutes (from 2.52; before, a factor next to an existing one needed nothing). Whoever steals a session in its first 5 minutes - or
  knows the password and passes the sign-in - can still add one; every device of the user is then told. For a stronger rule (a code,
  passkey or phone key before every factor change) **turn step-up on.** On the local network nothing is asked (the break-glass path).
- In `preferred` mode (the default) a phone key the hardware did not attest is accepted too. For a sensitive site: `required`.
- The user **is told** (from 2.52, on every device: inbox, browser notifications, the app) when a factor is added or removed, when new
  recovery codes are made and when someone signs in with a recovery code - only what happened, never a code, a key name or who did it
  (that is in the audit log). The notices can be tuned like any other in Settings > Notifications ("A change to the account's sign-in
  methods").
- An administrator who has no method of their own resets other users' methods with no code of their own - from outside only within 5
  minutes of signing in (from 2.52), plus the typed username and the 3-per-hour limit. **Every administrator should enrol a factor.**
- The second factor protects signing in to Arx from outside. It does not protect the home system itself; a home-system token is a full
  credential for it.
- A long-lived token from outside is never asked to confirm, not even before opening a door or disarming (owner decision).
- The "from where may a reset be done" setting has no screen yet.
- **The current Android app is a debug build.** Do not set a download address until there is a signed release build.
- Tested against test systems only: not with a physical authenticator app scanning the QR, not with a real passkey, not with a real phone.

## Good to know

- The code's secret is stored encrypted and never shown again; recovery codes are stored as hashes only; passkeys and phone keys as
  public keys only.
- **No method ever goes into a backup:** a restore never brings back a removed key, and after moving to a new server every user adds
  their methods again.
- Turning on, removing, resetting, confirming and refusing are all in the audit log - never a code, secret, signature or key name.
- Turning the code on, or a reset, cancels the phone app's device codes (`arxd_...`); the app registers again at its next sign-in.
