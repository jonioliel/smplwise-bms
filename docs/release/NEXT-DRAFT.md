# Next release - draft notes (two branches merged in integ/243)

Both drafts are kept below as written on their branches; the releasing account folds them into CHANGELOG.md and the release notes.

## Part 1 - Next release - CHANGELOG draft lines (HA 2026.10 adaptation, branch `pilot/HA2610-impl`)

Draft only: the releasing account folds these into CHANGELOG.md and the bilingual release notes. No version is set here.

### English

- **Added - HA 2026.10 compatibility check (Settings > Automations, administrators only).** A read-only scan of the existing
  automations and scripts lists what Home Assistant 2026.10 refuses (a state condition with "for" plus a list of states, an
  attribute or an input-helper state) and steps that only an HA administrator may run manually (`mqtt.publish`, `mqtt.dump`,
  Synology reboot / shutdown). The card appears only when something is found and never changes anything.
  New endpoint `GET /api/v1/automations/compat` (`system.configure`).
- **Fixed - a manual run refused by HA as Unauthorized** now says "the run was refused: a step needs a system-infrastructure
  administrator" (403 `requires_ha_admin`) instead of "no control of the device" with an empty name.
- **Fixed - the audit screen's user filter** compares usernames the way HA 2026.10 normalises them (trimmed, case-folded):
  "Joni" finds rows written as "joni". An empty name matches nothing.
- **Changed - NVR connection test:** port 80 is refused only when the target is the HA host itself (Supervisor 2026.08+ may put
  HA core on 80); an NVR on port 80 stays allowed.
- **Changed - climate / water heater temperature unit** follows the entity's `temperature_unit` attribute (HA 2026.11 prep);
  values are shown as reported.
- Tests: the fake HA has 2026.9 / 2026.10 validation profiles (probatio wording, the 2026.10 `for` rule).
- Upstream watch: HA 2026.10 keywords for ha-core, ha-supervisor and ha-dev-blog.
- Enable: nothing to switch on. Upgrade HA only after the checklist in `docs/operations/HA_2026_10_COMPATIBILITY_HE.md` section 3.

### עברית

- **נוסף - בדיקת תאימות ל-2026.10 (הגדרות › אוטומציות, למנהלים בלבד).** בדיקה לקריאה בלבד של האוטומציות והסקריפטים הקיימים:
  תנאי "במשך" שגרסה 2026.10 דוחה, וצעדים שרק מנהל רשאי להפעיל ידנית. הכרטיס מופיע רק כשנמצא משהו, ולא משנה דבר.
- **תוקן - הפעלה ידנית שנדחתה** מציגה "ההפעלה נדחתה: אחד הצעדים דורש מנהל של תשתית המערכת." במקום "אין לך הרשאת שליטה".
- **תוקן - סינון יומן הביקורת לפי משתמש** משווה שמות כמו ש-2026.10 מנרמלת (רווחים ואותיות גדולות).
- **שונה - בדיקת החיבור ל-NVR:** פורט 80 נחסם רק כשהיעד הוא מארח תשתית המערכת עצמו. NVR על פורט 80 מותר.
- **שונה - יחידת הטמפרטורה של מזגנים ודודים** נלקחת מהמאפיין `temperature_unit` כשהוא קיים.
- הפעלה: אין מה להפעיל. לשדרג את תשתית המערכת רק אחרי רשימת הבדיקות בסעיף 3 של מסמך התאימות.

## Part 2 - Next release - draft notes (CR-021 S4 part)

Draft for the release engineer; merge into `smplwise_vms/CHANGELOG.md` and the release notes of the next version. Source branch:
`pilot/CR021-s3-apply`. No migration, no version bump here, bridge unchanged.

### עברית

**עדכון גרסה מתוך Arx - השלמות**

- **הגנה מפני חזרה לגרסה ישנה:** Arx מציע ומתקין רק גרסה גבוהה מהמותקנת. גרסה ישנה יותר או זהה לא מוצעת, גם אם תשתית
  המערכת מסמנת אותה כעדכון.
- **"נדרשת הפעלה מחדש של תשתית המערכת" לפי הערות הגרסה:** גרסה שהערות השחרור שלה מסומנות `[platform-restart]` מציגה, אחרי
  ההתקנה, את השורה בלשונית העדכונים ואת הנקודה בתפריט המשתמש. ההפעלה מחדש נשארת לחיצה ואישור של מנהל.
- **מדריך:** עמוד חדש "עדכון גרסה והפעלה מחדש מתוך Arx" (`83-updates_HE.md`).

איך מפעילים: אין מה להפעיל. הלשונית הגדרות › מערכת › עדכונים קיימת מגרסה 0.1.159, למנהלי מערכת בלבד.

### English

**In-app update - completion**

- **Downgrade guard:** Arx offers and installs only a version strictly higher than the installed one. An older or equal store
  version is never offered, even when the platform flags it as an update.
- **"Platform restart required" from the release notes:** a release whose own notes carry `[platform-restart]` shows the row on the
  Updates tab and the user-menu dot after it is installed. The restart stays a confirmed action of an administrator.
- **Guide:** new page "Updates and restarts from inside Arx" (`83-updates_HE.md`).

How to enable: nothing to enable. Settings > System > Updates exists since 0.1.159, for system administrators only.

### Release-engineer notes

- Convention (D8): a release that needs one platform restart after it is installed adds a line containing `[platform-restart]` to
  its own `## <version>` section of `smplwise_vms/CHANGELOG.md`. The image now carries that file (`Dockerfile`).
- Before release: owner confirms the store-repository protection (GitHub 2FA; `main` and `v*` tags: no deletion, no force-push) -
  `docs/security/CR021_SELF_UPDATE_SECURITY_NOTES.md` section 3.
- Tier: S/M (backend + the update fixture spec). Security review items: notes section 4.
