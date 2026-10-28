# External access - the first live session with the owner (runbook)

Task: EXTERNALBUILD-297 (slice X3). Status: **procedure only - NOT_RUN.** Nothing in this document has been executed against a real WisKey,
station, door, WhatsApp account or Home Assistant. Every physical or device-writing step below is done **by the owner or with the owner's
explicit approval for that one action**, in a session with the lead. Sub-agents never run any step of this runbook.

Scope of the session: enable the external access on the owner's installation, give ONE time-bounded keypad code to ONE test contact (the
owner's own confirmed WhatsApp number) for ONE internal door, use it once, revoke it with read-back proof, and switch everything off again.
Optional block 6 repeats the flow with a one-time code.

## Hebrew summary (תקציר בעברית)

1. לפני הסשן: גרסה עם EXTERNALBUILD-297 מותקנת; בודקים את "מוכנות להפעלה" (בחלון "הגדרות" של מסך גישת חוץ) - הכל "תקין" או שהבעלים מאשר מה חסר.
2. בוחרים דלת פנימית אחת ומסמנים את העמדה שלה "כניסה לאנשים חיצוניים". מדליקים את המתג "אישור ביטול ממערכת הכניסה" (`wiskey.acr5_access_state`).
3. מדליקים את גישת החוץ (מופעלת). יוצרים איש קשר לבדיקה עם המספר של הבעלים ומאמתים את המספר בקוד.
4. בקשה ידנית לדלת האחת, לחלון של שעה-שעתיים היום, קוד בוואטסאפ; אדם שני (או מנהל מערכת) מאשר.
5. מחכים ל"פעיל · אומת"; הקוד מגיע בוואטסאפ (אם החלון מתחיל בקרוב - מיד). **הבעלים** מקליד את הקוד בדלת - כניסה אחת.
6. ביטול ידני; מחכים ל"בוטל" עם אישור מערכת הכניסה (או "בוטל, לא אומת בצד השני" בגרסה ישנה של WisKey). מנסים שוב את הקוד - הדלת לא נפתחת.
7. מכבים את גישת החוץ (או משאירים לפי החלטת הבעלים). רושמים תוצאה לכל שלב: עבר / נכשל / לא בוצע. בלי קוד, מספר טלפון או כתובת IP בתיעוד.
8. חזרה לאחור בכל רגע: "ביטול כל הגישות" (הקלדת "בטל הכל") ואז כיבוי המתג.

## 0. Preconditions (before the session day)

| # | Check | Who | How |
|---|---|---|---|
| P1 | The installed add-on carries EXTERNALBUILD-297 (readiness block visible) | lead | Settings dialog of the external-access screen shows "מוכנות להפעלה" |
| P2 | A full gate passed on the release that carries it | lead | release report |
| P3 | WisKey connection mode decided: `access.station_media_provider` stays `local`, or `auto` with the automatic fallback to the service channel (both write through the service channel today) | owner | readiness line "נתיב הכתיבה" says which path |
| P4 | A WhatsApp account mapped to the use "קודי כניסה לאנשים חיצוניים" (`access.codes`, inherits `tickets.codes`) and able to send | owner | readiness line "משלוח הקוד בוואטסאפ" = תקין |
| P5 | The owner chose ONE internal door (not a building entrance) and is physically next to it during block 4 | owner | - |
| P6 | Owner approval recorded in chat for: (a) enabling the switch, (b) the one provisioning write to WisKey, (c) the one keypad entry, (d) the revoke | owner | chat, per action |

## 1. Pre-checks (read-only)

1. Open the external-access screen -> **הגדרות** -> section **"מוכנות להפעלה"**. Record every line (state + reason code; no values).
2. Or from a shell on the host (read-only): `python scripts/eccact_activation_status.py --readiness --db <db path>` (runtime lines show `unknown`).
3. Expected before enabling: `switch` blocked (off) - that is fine; every REQUIRED line `ok` except what the owner accepts in writing.
   - `revoke_proof` = `proof_switch_off` -> do step 2.2 first.
   - `write_path` = `direct_fallback` -> acceptable (writes go over the service channel; the reason is shown).
   - `entrances` = none -> do step 2.1.

## 2. Prepare (settings only, owner approval (a))

1. Flag the chosen door's station as **"כניסה לאנשים חיצוניים"** (`PUT /api/v1/access-grants/entrances/{station_id}` `{entrance: true}`; or the station's setting in the screen).
2. Turn on **`wiskey.acr5_access_state`** (WisKey switches screen). Re-open the readiness block: `revoke_proof` should become `proof_v2` (verified)
   or `proof_v1` (revoked, not verified by the other side) after the first readback negotiation; `proof_not_negotiated` until then is expected.
3. Turn on the main switch: Settings dialog -> **"גישת חוץ במערכת זו" -> מופעלת** (audited `settings.changed` with before/after).
4. Re-run the readiness block and record it.

## 3. The grant (owner approval (b) before step 3.4)

1. Create a test contact (directory person, no vendor) with the **owner's own** WhatsApp number; confirm the number by code (the contact page
   "verify with a code"; the owner reads the code).
2. External-access screen -> **בקשת גישה**: that contact, the one door (one relay), today, a 1-2 hour window starting within the next hour,
   credential "קוד אישי בוואטסאפ", code type **"לכל התקופה"**, tick "the person received the privacy notice".
3. Approve: a second person with the approve permissions on that station, or the system administrator ("אני מאשר עכשיו").
4. The worker provisions within seconds (create person inert -> doors + validity + hours). Wait for **"פעיל · אומת"** (read-back proof) or press
   "קריאה חוזרת עכשיו". Record: state, `doors_state`, the readiness line `last_write` (which path the write took).
5. The code is sent at once (the window starts soon). The owner receives the WhatsApp message (doors, dates, hours, "personal"). **Nobody copies
   the code into chat, a ticket, a log or a document.**

## 4. The entry (owner approval (c); the owner acts, not an agent)

1. The owner types the code on the door's keypad once. Record: door opened yes/no, and the time (minute precision).
2. Optional: the access-control events screen shows the granted entry for that person (no code shown).

## 5. Revoke (owner approval (d))

1. Drawer of the grant -> **ביטול הגישה** (typed word). The grant moves to **"בביטול"**.
2. Wait for **"בוטל"**: Arx's own readback shows no door, no PIN, inactive, AND the access_state answer shows no pending revocation
   (`revoke_proof = verified`), or a v1 answer in the clean shape (`unverified`, shown as "בוטל, לא אומת בצד השני").
   If it stays "בביטול" > 10 minutes: record the drawer's "why" text and the readiness `revoke_proof` line; do NOT close it by hand in the session.
3. The owner tries the same code once more at the door: it must NOT open. Record the result.

## 6. Optional: one-time code (same approvals, repeated)

Repeat blocks 3-5 with code type **"לכניסה אחת"**. After the first entry the grant should move to "בביטול" by itself within about a
minute (the entry watch reads WisKey's granted events), then to "הסתיים". A second try with the same code after that must fail. Record the
seconds between the entry and "בביטול" (the best-effort gap).

## 7. Close

1. Decide with the owner: leave `access.external_grants` on, or turn it off (Settings dialog -> כבויה). Turning it off stops new provisioning;
   existing grants run to their end unless "ביטול כל הגישות" is used.
2. `wiskey.acr5_access_state` stays on if the switch stays on (otherwise revokes never complete).
3. Record per step PASS / FAIL / NOT_RUN in `private-evidence/external-access-session-<date>.md` - no PIN, no phone number, no IP, no serial.
   Screenshots only of Arx screens, with the phone number masked (the screen masks it already).

## Rollback (at any point)

1. External-access screen -> **ביטול כל הגישות** (type "בטל הכל"): every live grant withdrawn now; strips follow with read-back proof.
2. Settings -> **כבויה**.
3. If a revoke cannot be proven (WisKey unreachable): the drawer keeps "בביטול" with hourly alerts; WisKey's own validity window still expires
   the code at its end (the window was 1-2 hours). The WisKey person can be removed in WisKey's own panel by the owner if needed.

## What this session does NOT cover

Visitors (switch `access.visitors` stays off), cards, the vendor arrival page, building entrances, offline stations (W-a), the direct
service-writer (not available until WisKey publishes the contract), SMS.
