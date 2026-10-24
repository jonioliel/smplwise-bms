מסירת המקור הפרטי המקורי של Arx למאק, דרך הבעלים — סבב4, 24.10.2026

זוהי חבילת מקור/קבלות ותיעוד בלבד. אין שינוי מוצר, אין מיזוג ארבעת הענפים ואין מועמד משולב. בסיס ענף מסירה זה הוא WKDIRECT המקורי; אין לייחס לקומיט המסירה בדיקות מוצר.
SOURCE_ARCHIVES.json מתאר את ארכיוני האימות המקומיים; הם נשארו ב-Windows ואינם ארבעה קבצים חסרים במסירה. הבתים המקוריים מכל הארבעה מסופקים פעם אחת ב-source/SOURCE_BLOBS.zip, עם ארבעת *_MANIFEST.json (CODE, מסלול, mode, Git blob, SHA256, גודל). source/SOURCE_CONTAINER.json מאמת את המכל. MATERIALIZE_SOURCE.py משחזר עותקים נפרדים ומאמת כל בית, בלי לייבא או להריץ מוצר.

source_scope מפורש בכל manifest: backend מקור ובדיקות/fixtures; frontend src/tests והגדרות/lock; שני מקורות smplwise_bridge; config.yaml; מסמכי היחידה והנחיות. זה אינו כל המאגר ההיסטורי/נכסי הבנייה. לשאר מקור מקורי השתמשו באותו CODE במאגר Arx הפרטי; אין fallback ציבורי או shim.

קריאה: original-reply/ (שני הקבצים המקוריים בשלמותם), branch-docs/, SOURCE_SYMBOL_HASHES.json, WINDOWS_INTAKE_VERIFICATION.json, RECEIPT_FILE_MANIFEST.json, receipts/. כל34 קובצי הקבלות נשמרו, כולל pre-commit וה-SKIP וה-stderr המקוריים. אימות hashes מוכיח העתקה, לא ביצוע מחדש או lineage שלא סופק.
הרצה לצורכי חילוץ חומר בלבד: python3 MATERIALIZE_SOURCE.py --output /absolute/new/directory
לא מחלצים לתוך checkout של WisKey. נתיבי Windows בקבלות הם provenance בלבד.
הוראות הפיתוח למאק נמצאות במסירת WisKey הנפרדת arx-round4-reply-mac-handoff; הבעלים מעביר אותה. אין הודעה ישירה לצוותים.
