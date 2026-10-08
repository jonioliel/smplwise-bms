# Next release - draft notes (CR-021 S4 part)

Draft for the release engineer; merge into `smplwise_vms/CHANGELOG.md` and the release notes of the next version. Source branch:
`pilot/CR021-s3-apply`. No migration, no version bump here, bridge unchanged.

## עברית

**עדכון גרסה מתוך Arx - השלמות**

- **הגנה מפני חזרה לגרסה ישנה:** Arx מציע ומתקין רק גרסה גבוהה מהמותקנת. גרסה ישנה יותר או זהה לא מוצעת, גם אם תשתית
  המערכת מסמנת אותה כעדכון.
- **"נדרשת הפעלה מחדש של תשתית המערכת" לפי הערות הגרסה:** גרסה שהערות השחרור שלה מסומנות `[platform-restart]` מציגה, אחרי
  ההתקנה, את השורה בלשונית העדכונים ואת הנקודה בתפריט המשתמש. ההפעלה מחדש נשארת לחיצה ואישור של מנהל.
- **מדריך:** עמוד חדש "עדכון גרסה והפעלה מחדש מתוך Arx" (`83-updates_HE.md`).

איך מפעילים: אין מה להפעיל. הלשונית הגדרות › מערכת › עדכונים קיימת מגרסה 0.1.159, למנהלי מערכת בלבד.

## English

**In-app update - completion**

- **Downgrade guard:** Arx offers and installs only a version strictly higher than the installed one. An older or equal store
  version is never offered, even when the platform flags it as an update.
- **"Platform restart required" from the release notes:** a release whose own notes carry `[platform-restart]` shows the row on the
  Updates tab and the user-menu dot after it is installed. The restart stays a confirmed action of an administrator.
- **Guide:** new page "Updates and restarts from inside Arx" (`83-updates_HE.md`).

How to enable: nothing to enable. Settings > System > Updates exists since 0.1.159, for system administrators only.

## Release-engineer notes

- Convention (D8): a release that needs one platform restart after it is installed adds a line containing `[platform-restart]` to
  its own `## <version>` section of `smplwise_vms/CHANGELOG.md`. The image now carries that file (`Dockerfile`).
- Before release: owner confirms the store-repository protection (GitHub 2FA; `main` and `v*` tags: no deletion, no force-push) -
  `docs/security/CR021_SELF_UPDATE_SECURITY_NOTES.md` section 3.
- Tier: S/M (backend + the update fixture spec). Security review items: notes section 4.
