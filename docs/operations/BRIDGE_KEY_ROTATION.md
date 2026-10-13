# Rotating the bridge trust key (CR-040)

The add-on and the bridge (the `smplwise_bridge` integration inside the system infrastructure) sign every message they exchange - device
commands, schedules, automations, casting, the user directory, the door path - with one shared key, the **trust key**. Its generation
number is the **trust epoch** (shown as "דור"). The bridge owns the epoch. A rotation moves both sides to a new key and the next epoch in
**one atomic switch**: there is never a moment in which two keys are valid.

Design and threat table: `docs/changes/CR-040-KEY-ROTATION.md`.

## Who, where, when

- **Permission:** `access.trust.rotate` ("בקרת כניסה: החלפת מפתח האמון של הגשר"). System administrators hold it. Anyone else gets it through a
  custom role that lists it among its sensitive permissions, bound to that person at installation scope. It is never delegable.
- **Where:** Settings › בקרת כניסה › **מפתח הגשר**, from the local network only (the remote channel shows "זמין רק מהרשת המקומית").
- **When:** on an event only - staff or administrator change, a policy review, after reinstalling the bridge. Nothing rotates on a timer.
- **Not for a suspected leak.** The next key is derived from the current one; someone who already holds the current key and can watch
  the system infrastructure could follow. If a leak is suspected, **re-pair** with a fresh key instead (Settings › חיבורים, the bridge
  pairing code, "regenerate", then install / confirm the bridge again).

## Before the first rotation

1. The add-on version that carries CR-040 is installed.
2. The bridge is **0.8.1** or newer: the add-on copies it into the system infrastructure at start; restart the infrastructure once so it
   loads.
3. The segment shows "גרסה 0.8.1 · תומך בהחלפת מפתח" and "אישור אחרון מהגשר: דור N". Until the bridge reports support, the button is off
   and the segment says what is missing.

## Rotating

1. Press **החלפת מפתח…**. Read the confirmation, tick **הבנתי**, press **החלפת המפתח**.
2. For a second or two every action through the bridge is refused before it is sent ("הפעולה לא נשלחה: מפתח האבטחה של החיבור לתשתית
   המערכת מוחלף כרגע..."). Nothing is queued and nothing is retried by itself; people simply try again.
3. The result appears at once:

| Result | Meaning | What to do |
|---|---|---|
| **הוחלף** | Both sides hold the new key (generation N+1). The old key is refused from that moment. | Nothing. Within a minute the line "אישור אחרון מהגשר" shows the new generation. |
| **לא הוחלף** (with a reason) | The request never left, or the bridge refused it before changing anything. The previous key stays valid. | Fix the reason (for example the bridge was busy, or it reported another generation) and start a new rotation. |
| **לא ידוע** | The request may have reached the bridge but no answer came back. Actions through the bridge stay paused. | Press **בדיקת מצב** (or wait: the add-on asks by itself about 35 s later, then once a minute). The rotation is never sent again; the check finds out what really happened and fences a request the bridge never received, so it can never apply later. |

## Special cases

- **"הגשר אינו מקבל אף אחד מהמפתחות"** - the bridge holds a third key (re-paired by hand, or the infrastructure was restored from an older
  backup). Re-pair: Settings › חיבורים, regenerate the pairing code, then re-install / confirm the bridge. The open request is closed as
  "הוחלף בצימוד מחדש"; the generation starts again at 1.
- **The system infrastructure was restored from a backup taken before a rotation** - the bridge is back on an old key; every action through
  it fails at the signature check. Re-pair as above. A rotation cannot repair this.
- **The add-on restarted in the middle of a rotation** - the request shows "לא ידוע" ("Arx הופעל מחדש באמצע") and is resolved by the status
  check like any other.
- A restore of an Arx backup never brings back or changes the key, the generation or an open request (none of them is in an archive).

## What is recorded, what is never shown

- Audit actions: `bridge.trust.rotation.requested`, `.refused`, `.result`, `.status_check`, `.interrupted`, `.superseded`,
  `bridge.trust.epoch_adopted`. Each holds who, the request id, the generations and the outcome - nothing else.
- No screen, log, audit row, table or backup ever contains the key, the next key, the salt, the proof, a nonce or a signature.
- The results list keeps the last 20 requests; request rows are never deleted.

## Limits (stated, not hidden)

- A rotation is not a re-anchor: it changes nothing about the WisKey clock anchor or any eligibility to lower it.
- Whether WisKey-side capabilities survive a rotation is **NOT_PROVEN** (no live test has been run; nothing here claims it).
- No live or lab rotation has been run. The first one belongs on a lab copy, then on the live system with the owner's approval.
