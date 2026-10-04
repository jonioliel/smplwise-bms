# Unreleased: a friendly name for every electricity meter

Branch `pilot/meter-rename` (on top of `pilot/meter-device-name`). Not released; no version bump; no migration.

## English

**What changed**
- Adding a meter (infra > electricity > meters > "Add a meter"): a name field appears under the picker for each picked sensor. It is pre-filled with the device name (else the sensor name), required, trimmed, at most 120 characters.
- The meter card has a "Rename" action, visible only with `energy.manage`. It validates the name, refuses a name another meter already has (the Save button stays off), and, on a revision conflict, tells the operator in Hebrew that someone else changed the meter, refreshes the card and keeps the typed name.
- The rename is audited as `energy.meter.update` with `name_from` and `name_to` (a meter name is not a secret).
- The friendly name is shown wherever the meter appears; the device and sensor names remain the secondary line.

**Already existed (verified, not rebuilt):** `display_name` on `POST /energy/meters`, `PATCH /energy/meters/{id}` (`energy.manage`, revision-checked, trimmed, empty refused with 422, over 120 refused by the schema), the audit entry `energy.meter.update`.

**Sealed bills do not change.** An issued bill's snapshot stores the meter name at sealing time and is read back from the snapshot; renaming a meter only affects drafts and documents created afterwards (a draft is recomputed from the live name). Covered by a backend test that issues a bill, renames the meter and compares the snapshot and its SHA-256. The rename dialog says so in Hebrew.

**Duplicate names are refused (owner decision).** On create and on rename the server compares the trimmed, case-insensitive name with every meter that is not retired (active and paused ones count) and answers 409 `meter_name_taken`; the UI shows "קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם" and does not proceed. A retired meter does not hold its name. Duplicates that already exist in the data are not touched: reads work, other edits (pause, max kW, area) work, and keeping a meter's current name is accepted; only a NEW colliding name is refused. Reason: text formulas match a meter by its name, so unique names keep them unambiguous.

**How to use:** open a meter, press "Rename", type, save. When adding: edit the pre-filled name, then "Add".

## עברית

**מה השתנה**
- בהוספת מונה מופיע שדה שם לכל חיישן שנבחר, ממולא מראש משם המכשיר (אחרת שם החיישן), חובה, בלי רווחים בקצוות, עד 120 תווים.
- בכרטיס המונה יש "שינוי שם" (רק עם `energy.manage`): בדיקת תקינות, חסימה של שם שכבר קיים אצל מונה אחר, ובהתנגשות גרסה הודעה בעברית שמישהו אחר שינה את המונה (הכרטיס מתרענן והשם שהוקלד נשמר).
- השינוי נרשם ביומן הביקורת עם שם ישן ושם חדש.

**כבר היה:** שדה השם בהוספה וב-PATCH עם בדיקת גרסה והרשאה, וכן רישום ביומן.

**חיובים שהונפקו לא משתנים:** תמונת המצב החתומה שומרת את שם המונה כפי שהיה, והשינוי משפיע רק על טיוטות ומסמכים חדשים. הדבר נבדק בבדיקת backend וכתוב בחלון שינוי השם.

**שמות כפולים נחסמים (החלטת הבעלים):** ביצירה ובשינוי שם, השרת משווה את השם (בלי רווחים בקצוות, בלי הבחנה בין אותיות גדולות לקטנות) לכל מונה שלא הוצא משימוש, כולל מושהים, ומחזיר 409 `meter_name_taken`. ההודעה: "קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם", והשמירה לא ממשיכה. מונה שהוצא משימוש לא מחזיק בשם. כפילויות שכבר קיימות בנתונים לא נפגעות: קריאות ועריכות אחרות עובדות, ושמירת השם הנוכחי מתקבלת; נחסם רק שם חדש שמתנגש. הסיבה: נוסחאות טקסט מזהות מונה לפי שם.

**איך משתמשים:** פותחים מונה, "שינוי שם", מקלידים ושומרים. בהוספה: עורכים את השם המוצע ולוחצים "הוספה".
