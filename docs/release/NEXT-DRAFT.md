# Next release - CHANGELOG draft lines (HA 2026.10 adaptation, branch `pilot/HA2610-impl`)

Draft only: the releasing account folds these into CHANGELOG.md and the bilingual release notes. No version is set here.

## English

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

## עברית

- **נוסף - בדיקת תאימות ל-2026.10 (הגדרות › אוטומציות, למנהלים בלבד).** בדיקה לקריאה בלבד של האוטומציות והסקריפטים הקיימים:
  תנאי "במשך" שגרסה 2026.10 דוחה, וצעדים שרק מנהל רשאי להפעיל ידנית. הכרטיס מופיע רק כשנמצא משהו, ולא משנה דבר.
- **תוקן - הפעלה ידנית שנדחתה** מציגה "ההפעלה נדחתה: אחד הצעדים דורש מנהל של תשתית המערכת." במקום "אין לך הרשאת שליטה".
- **תוקן - סינון יומן הביקורת לפי משתמש** משווה שמות כמו ש-2026.10 מנרמלת (רווחים ואותיות גדולות).
- **שונה - בדיקת החיבור ל-NVR:** פורט 80 נחסם רק כשהיעד הוא מארח תשתית המערכת עצמו. NVR על פורט 80 מותר.
- **שונה - יחידת הטמפרטורה של מזגנים ודודים** נלקחת מהמאפיין `temperature_unit` כשהוא קיים.
- הפעלה: אין מה להפעיל. לשדרג את תשתית המערכת רק אחרי רשימת הבדיקות בסעיף 3 של מסמך התאימות.
