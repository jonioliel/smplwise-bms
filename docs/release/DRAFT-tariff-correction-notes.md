# Release-notes draft: tariff price correction (not released)

- EN: A price in the prices screen can now be corrected: saving a price on the date of an existing one replaces it after one confirmation, and each version in the editor has a "Correct" button (price, incl./excl. VAT, start date). Issued bills never change - if one used the price, the corrected price starts after the last issued period, and the confirmation says so. Every correction is audited.
- HE: אפשר לתקן מחיר במסך המחירים: שמירת מחיר בתאריך שכבר קיים מחליפה אותו אחרי אישור אחד, ולכל גרסה בעורך יש כפתור "תיקון" (מחיר, כולל/לפני מע״מ, תאריך התחלה). חיובים שהופקו לא משתנים - אם חיוב כזה השתמש במחיר, המחיר המתוקן יחול מהתקופה שאחרי החיוב האחרון, והאישור אומר זאת. כל תיקון נרשם ביומן.
- How to enable: nothing to enable (energy.manage holders see it automatically); no migration.
- EN (addition): after a correction, existing DRAFT bills in the corrected range are recomputed automatically (the confirmation says how many; one audit row per draft; a draft that fails to recompute is reported and does not undo the correction). Issued, sent, paid and cancelled bills are never touched.
- HE (תוספת): אחרי תיקון מחיר, טיוטות קיימות בטווח המתוקן מחושבות מחדש אוטומטית (האישור אומר כמה, שורת ביקורת לכל טיוטה; טיוטה שנכשלה מדווחת ולא מבטלת את התיקון). חיובים שהופקו, נשלחו, שולמו או בוטלו לא משתנים.
