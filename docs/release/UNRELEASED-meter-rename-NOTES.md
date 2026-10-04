# Unreleased: a friendly name for every electricity meter

Branch `pilot/meter-rename` (on top of `pilot/meter-device-name`). Not released; no version bump; no migration.

## English

**What changed**
- Adding a meter (infra > electricity > meters > "Add a meter"): a name field appears under the picker for each picked sensor. It is pre-filled with the device name (else the sensor name), required, trimmed, at most 120 characters.
- The meter card has a "Rename" action, visible only with `energy.manage`. It validates the name, warns (but allows) a name another meter already has, and, on a revision conflict, tells the operator in Hebrew that someone else changed the meter, refreshes the card and keeps the typed name.
- The rename is audited as `energy.meter.update` with `name_from` and `name_to` (a meter name is not a secret).
- The friendly name is shown wherever the meter appears; the device and sensor names remain the secondary line.

**Already existed (verified, not rebuilt):** `display_name` on `POST /energy/meters`, `PATCH /energy/meters/{id}` (`energy.manage`, revision-checked, trimmed, empty refused with 422, over 120 refused by the schema), the audit entry `energy.meter.update`.

**Sealed bills do not change.** An issued bill's snapshot stores the meter name at sealing time and is read back from the snapshot; renaming a meter only affects drafts and documents created afterwards (a draft is recomputed from the live name). Covered by a backend test that issues a bill, renames the meter and compares the snapshot and its SHA-256. The rename dialog says so in Hebrew.

**Known consequence:** formulas typed as text match a meter by a UNIQUE name, so two meters with the same name make text formulas ambiguous. That is why a duplicate only warns; the account wizard picks meters by id and is not affected.

**How to use:** open a meter, press "Rename", type, save. When adding: edit the pre-filled name, then "Add".

## עברית

**מה השתנה**
- בהוספת מונה מופיע שדה שם לכל חיישן שנבחר, ממולא מראש משם המכשיר (אחרת שם החיישן), חובה, בלי רווחים בקצוות, עד 120 תווים.
- בכרטיס המונה יש "שינוי שם" (רק עם `energy.manage`): בדיקת תקינות, אזהרה בלי חסימה על שם קיים, ובהתנגשות גרסה הודעה בעברית שמישהו אחר שינה את המונה (הכרטיס מתרענן והשם שהוקלד נשמר).
- השינוי נרשם ביומן הביקורת עם שם ישן ושם חדש.

**כבר היה:** שדה השם בהוספה וב-PATCH עם בדיקת גרסה והרשאה, וכן רישום ביומן.

**חיובים שהונפקו לא משתנים:** תמונת המצב החתומה שומרת את שם המונה כפי שהיה, והשינוי משפיע רק על טיוטות ומסמכים חדשים. הדבר נבדק בבדיקת backend וכתוב בחלון שינוי השם.

**שימו לב:** נוסחאות שנכתבות כטקסט מזהות מונה לפי שם ייחודי, ולכן שני מונים עם אותו שם מקשים על נוסחת טקסט. לכן שם כפול רק מזהיר.

**איך משתמשים:** פותחים מונה, "שינוי שם", מקלידים ושומרים. בהוספה: עורכים את השם המוצע ולוחצים "הוספה".
