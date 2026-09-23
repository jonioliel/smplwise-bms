# Requirements → tasks → acceptance tests

Generated from canonical registries; NOT_RUN does not mean passing.

| Requirement | Phase | Task | Test | Requirement statement |
|---|---|---|---|---|
| R001 | G0 | T001 | AT001 | לקבל Snapshot או Commit של המערכת שבאמת פועלת, ולהפיק הוראות הרצה, רשימת מודולים ותלויות. אין להסיק שהמסמכים ההיסטוריים הם הקוד הפעיל. |
| R002 | G0 | T001 | AT002 | ליצור REUSE_MATRIX לכל יכולת: reuse, wrap, refactor או replace, עם קובץ מקור, התנהגות שנצפתה, סיכון ונימוק. אין למחוק את המקור הישן. |
| R003 | G0 | T002 | AT003 | לאמת גישה מקומית ל־NVR, HA ו־go2rtc מתוך סביבת הפיתוח; לתעד דגם, Firmware, Codec ונתיבים ללא סודות. |
| R004 | G0 | T002 | AT004 | להגדיר חשבונות ייעודיים, גיבוי לפני בדיקה, Read-only כברירת מחדל ויומן פעולות; אין גישה מלאה אוטומטית או פקודות פיזיות בזמן bootstrap. |
| R005 | G0 | T003 | AT005 | ללכוד בקשות ותשובות מצונזרות של discovery, search, pagination, playback, export ו־events שעובדים, עם זמני UTC ותצורת המקור. |
| R006 | G0 | T003 | AT006 | לייצר fixtures של הצלחה, אין הקלטה, forbidden, timeout ו־partial; כתובות עם סיסמה ופרטים אישיים אינם נכנסים ל־Git. |
| R007 | G0 | T004 | AT007 | להריץ תרחישי קלט זהים על המקור הישן וה־adapter החדש ולשמור diff של mapping, search intervals ותוצאות השגיאה. |
| R008 | G0 | T004 | AT008 | לקבוע baseline ביצועים ופריים אמיתי בזמן ידוע; אי־התאמה מתועדת כפער ולא מתוקנת בהזזת שעות קבועה. |
| R009 | G0 | T005 | AT009 | להפיק inventory ורישיונות לתלויות וקוד שנלמד או מועתק, כולל notices רלוונטיים; קוד ספק אינו מועתק ללא זכות שימוש. |
| R010 | G0 | T005 | AT010 | לסרוק סודות, log leaks ונתיבי כתיבה מסוכנים; לגבש טיפול בממצאים לפני הפצת fixtures או build. |
| R011 | G0 | T006 | AT011 | להוכיח מול NVR אמיתי שזמן בקשה ידוע מוביל להקלטה ולפריים הנכונים; למדוד keyframe offset ומיפוי PTS לזמן המקור. |
| R012 | G0 | T006 | AT012 | לבדוק create/update/delete ב־go2rtc על namespace ניסוי: persistence, חיבורי consumers ו־restart. לבחור נתיב session או bounded clip על סמך ראיה. |
| R013 | G0 | T007 | AT013 | לשמר את שלושת לוחות ההדמיה ולממש tokens, ניווט ארבעה מצבים, טיפוגרפיה, ריווח, צבעי מצב ורכיבי בסיס ללא שינוי שפת העיצוב. |
| R014 | G0 | T007 | AT014 | לצלם מפת קומה, מצלמה ומגירת ישות בעברית/RTL ובמובייל; empty/error/stale נראים שונים מנתון חי. |
| R015 | G0 | T008 | AT015 | לאשר גבולות add-on, HA integration ו־go2rtc חיצוני, בעלות על DB/media והחלטות reuse. לתעד חלופות והנחות שנפסלו. |
| R016 | G0 | T008 | AT016 | לנעול חוזי API, מזהים, schema revisions ו־error model לפני עבודת Agents מקבילה; דוגמאות תקינות נכנסות לבדיקת contracts. |
| R017 | PILOT | T009 | AT017 | למסור שלד Add-on/App ייעודי ל־HAOS עם config.yaml, Ingress, image, /data מתמשך ו־CI. go2rtc חיצוני; לא להחליף בתצורת HACS-only, כרטיס בלבד או Web app נפרד. |
| R018 | PILOT | T009 | AT018 | לתעד התקנת Add-on ממאגר Supervisor והתקנת Bridge HA הדק בנפרד; לשמור upgrade/backup/rollback ובדיקות תצורה. חשיפת משתמש רגיל נבחנת ב־T081. |
| R019 | PILOT | T010 | AT019 | למפות balanced/deep למודלים הזמינים בפועל מקומית, לתעד version ו־reasoning; שמות Astra/Sol הם העדפה ולא מזהי API מומצאים. |
| R020 | PILOT | T010 | AT020 | לשמור תקרת הוצאה מאושרת, max attempts והרשאות; task metadata אינו מוצג כאילו הוא מחליף מודל אוטומטית בסשן. |
| R021 | PILOT | T011 | AT021 | כל בקשה מקבלת principal מאומת לפי HA instance/user ID ו־roles/groups מקומיים ל־VMS. HA משתמש רגיל יכול להיות editor או site_admin בלי שינוי is_admin/group_ids ב־HA. |
| R022 | PILOT | T011 | AT022 | לאכוף default deny, scopes ורוויזיות על API/WS/media; bootstrap מפורש למנהל הראשון. אין הרשאה מכותרת לא מהימנה או מ־service token. מינימום RBAC מחייב כבר בפיילוט. |
| R023 | PILOT | T012 | AT023 | לזהות דגם, Firmware ו־capabilities ולשמור states supported/unsupported/unknown/forbidden נפרדים. |
| R024 | PILOT | T012 | AT024 | לא להציג PTZ, audio, smart search או writable recording policy בלי ראיית תמיכה; כל endpoint candidate מתועד עם method ותוצאת בדיקה. |
| R025 | PILOT | T013 | AT025 | לגלות ולמפות input channel, main/sub stream ו־recording track עם מזהים יציבים; אין חישוב קשיח channel*100+1. |
| R026 | PILOT | T013 | AT026 | לשמור alias מקומי, סדר, visibility ו־HA binding בלי לשנות שם NVR; reconnect אינו מייצר מצלמות כפולות. |
| R027 | PILOT | T014 | AT027 | לייצג זמנים פנימיים ב־UTC ולפרש בקשה מקומית לפי IANA והתאריך המבוקש; לבדוק fold/gap, יום 23/25 שעות וחציית חצות. |
| R028 | PILOT | T014 | AT028 | להפריד clock drift, OSD, timezone ו־endpoint quirk; לשמר ערך raw ופרופיל NVR, ולדחות זמן ללא timezone כשמשמעותו אינה ידועה. |
| R029 | PILOT | T015 | AT029 | לאמת API/גרסה, לייצר namespaced live streams בלבד ולמנוע URL או credentials של מקור בדפדפן/לוגים. |
| R030 | PILOT | T015 | AT030 | לשמר streams זרים ולהציג outage נקודתי; HA פנימי או host name לא מוכר אינם מניחים מראש ככתובת שירות. |
| R031 | PILOT | T016 | AT031 | ליישם session ownership, consumer lease, expiry ותקרת sessions; ניתוק הדפדפן או restart אינו משאיר streams ללא גבול. |
| R032 | PILOT | T016 | AT032 | לבדוק ניקוי וקיום הגדרות לאחר restart בלי מחיקת source שלא בבעלות המוצר; no-consumers אינו תנאי יחיד למחיקה בזמן reconnect. |
| R033 | PILOT | T017 | AT033 | להציג וידאו אמיתי עם סטטוס חיבור, שמע בהסכמה ו־fullscreen; מפתח הגישה scoped למצלמה ומשתמש. |
| R034 | PILOT | T017 | AT034 | לבדוק WebRTC ברשת הייחוס ו־MSE/HLS חלופי כשנתמך; failure לא מוצג כ־Live, ו־Ingress לא נחשב פתרון ICE/UDP. |
| R035 | PILOT | T018 | AT035 | לאפשר 1/2/4/6/9/12/16/custom, reorder, resize, pin ושמירת views פר משתמש או משותפים בהרשאה. |
| R036 | PILOT | T018 | AT036 | להפעיל lazy streams, main/sub/auto ו־mobile override; מסך טלפון לא טוען 16 main streams רק כי כך נשמר בדסקטופ. |
| R037 | PILOT | T019 | AT037 | לשמור hierarchy ומזהים יציבים, labels ו־HA area/floor binding; מחיקת קומה עם עוגנים דורשת טיפול מפורש ולא orphan. |
| R038 | PILOT | T019 | AT038 | לשמור מקור תוכנית immutable, draft/revision ו־published version נפרדים; viewer קורא רק גרסה מאושרת ומורשית. |
| R039 | PILOT | T020 | AT039 | לתמוך JPG/PNG ו־PDF עם בחירת עמוד, crop/rotate ושמירת source hash; המקור והטרנספורמציה נשמרים לשחזור. |
| R040 | PILOT | T020 | AT040 | להגביל גודל/עמודים/זמן decode ולבודד rendering; SVG עובר sanitization או נדחה בבטחה; DWG/DXF אינו נתמך בשקט כאילו תמונה. |
| R041 | PILOT | T021 | AT041 | לאפשר drag, numeric placement, rotate, delete, undo/redo ו־camera FOV סכמטי; קואורדינטות מנורמלות נשמרות ללא תלות ב־zoom. |
| R042 | PILOT | T021 | AT042 | לשמור crop/rotation transforms ולבדוק round-trip לאחר resize; RTL אינו משקף תוכנית. מרחקים מדויקים מוצגים רק לאחר scale calibration. |
| R043 | PILOT | T022 | AT043 | לחיצה על עוגן מצלמה מציגה preview בהקשר עם Live/Playback/fullscreen; סגירה חוזרת לאותו floor, zoom ו־selection. |
| R044 | PILOT | T022 | AT044 | להראות זמינות אמיתית וסיבה ל־offline/no permission בלי לפתוח streams לכל הסמנים; לחיצה במובייל נוחה ללא hover. |
| R045 | PILOT | T023 | AT045 | לייבא את כלל הישויות המורשות שנחשפות לחיבור יחד עם domains, attributes, device/area/floor ו־supported features כשהם זמינים. |
| R046 | PILOT | T023 | AT046 | לשמור stable identity ולהתמודד עם rename/remove/disabled/unavailable; ייבוא אינו הצבה אוטומטית של אלפי סמלים או הרשאת פעולה. |
| R047 | PILOT | T024 | AT047 | לסנכרן Snapshot ואירועים ללא אובדן עדכונים בחלון החיבור; לשמור received/occurred, sequence ו־freshness. |
| R048 | PILOT | T024 | AT048 | לאחר reconnect לבצע resync או resume מאומת, לסמן stale בתקופת הניתוק ולא להמציא continuity; בדיקת 1,000 ישויות בנתוני fixture. |
| R049 | PILOT | T025 | AT049 | לגרור ישות למפה ולהציג state/יחידה/זמינות; generic panel קריא ל־domain לא מוכר, widgets ייעודיים ל־light/switch/sensor. |
| R050 | PILOT | T025 | AT050 | לבצע פעולה בטוחה מאושרת דרך allowlist צד שרת ולחכות ל־state confirmation; duplicate click אינו משגר פקודות כפולות. |
| R051 | PILOT | T026 | AT051 | לגבות DB, תוכניות, placements ו־config בלי לשלב secrets גלויים; manifest מציין versions ורכיבים חסרים. |
| R052 | PILOT | T026 | AT052 | להוכיח restore לסביבת ניסוי עם אותם IDs/מיקומים; restore אינו מפעיל אוטומטית פקודות HA או משנה schedule ב־NVR. |
| R053 | PILOT | T027 | AT053 | לממש pagination עד סוף טווח מבוקש ולהחזיר coverage complete/partial/unknown ו־cursor; no result אינו בהכרח no recording. |
| R054 | PILOT | T027 | AT054 | לשמור cache לפי source/track/time/profile, לאחד בקשות ולבטל invalid negative cache כשמידע/retention משתנה. |
| R055 | PILOT | T028 | AT055 | ליישם lifecycle עם requested_at, actual_start/media anchor, generation ו־state; seek מאוחר מבטל תוצאת seek ישנה. |
| R056 | PILOT | T028 | AT056 | לא להניח ששינוי producer מחליף consumer מחובר; להוכיח pause/resume/close/reconnect/expiry ולסמן precision limited כשאין anchor מאומת. |
| R057 | PILOT | T029 | AT057 | להציג טווחי הקלטה, gaps, coverage, date/time לפי אתר ו־scrub מבוקר; לחיצה על שעה פותחת הקלטה ולא Live. |
| R058 | PILOT | T029 | AT058 | לשמור camera/map/time context ומצב loading/error/no recording; מקלדת ומובייל נתמכים, אין כפתור מהירות שאינו ממומש. |
| R059 | PILOT | T030 | AT059 | להציג כותרת ברורה מצב Live או חקירה ותאריך מלא; במצב עבר לא להציג מצב HA נוכחי כאילו היה אז. |
| R060 | PILOT | T030 | AT060 | אם אין history: להציג לא ידוע או current עם תווית בולטת; פעולות פיזיות מנוטרלות במצב חקירה כברירת מחדל. |
| R061 | PILOT | T031 | AT061 | לפרש event stream, active/inactive, heartbeats ו־reconnect; לשמור provenance ו־occurred_at בנפרד מ־received_at. |
| R062 | PILOT | T031 | AT062 | למנוע כפילויות ולהציג gaps; person/vehicle רק כשהמקור מספק אותם, אין backfill היסטורי מומצא. |
| R063 | PILOT | T032 | AT063 | להציג כרטיסי אירוע לפי camera/site/floor/time/type, סטטוס חדש/בטיפול/טופל וקפיצה ל־Playback. |
| R064 | PILOT | T032 | AT064 | לתייג thumbnail חסר או live-only ולא להשתמש בתמונה נוכחית כראיה לאירוע בעבר; Ack נשמר עם משתמש וזמן. |
| R065 | PILOT | T033 | AT065 | להפריד NVR connected, recording available, live transport, HA, database ו־jobs; Online אינו שווה תקינות הקלטה. |
| R066 | PILOT | T033 | AT066 | לספק export logs מצונזר עם correlation ID והמלצה לבדיקה בלי לכלול tokens, RTSP credentials או frames פרטיים. |
| R067 | PILOT | T034 | AT067 | לאשר visually desktop 1440, tablet ומובייל 390 במסלולי map/live/playback/entity; טקסט עברי ומזהים LTR לא מתהפכים. |
| R068 | PILOT | T034 | AT068 | להוכיח keyboard focus, labels, contrast, touch targets ו־reduced motion; אין scroll אופקי במובייל או טבלאות דחוסות חובה. |
| R069 | PILOT | T035 | AT069 | להריץ אמת מקצה לקצה: קומה→מצלמה→Live→שעה קודמת→אירוע, וישות HA→פעולה בטוחה מאושרת. |
| R070 | PILOT | T035 | AT070 | להריץ permission negatives, restart, restore, leak/timeout ו־NVR continuity; לצרף commit, fixtures, screenshots ותוצאות, ללא PASS על בדיקה מדולגת. |
| R071 | PILOT | T036 | AT071 | לפרסם release candidate לתצורת הייחוס בלבד, עם הוראות התקנה, תכונות כבויות, known limits וגיבוי/rollback שנבדקו. |
| R072 | PILOT | T036 | AT072 | לחתום Go/No-Go אנושי; אין שחרור עם דליפת סודות, הרשאות שגויות, פגיעה בהקלטה או זמן מטעה. |
| R073 | BETA | T037 | AT073 | לספק שכבות cameras/security/HVAC/lighting וסינון לפי state/domain/room; חיפוש ישות ממרכז ומדגיש אותה על הקומה הנכונה. |
| R074 | BETA | T037 | AT074 | לממש clustering ומניעת חפיפה עם alternative list; להתנסות ב־500 anchors בלי לפתוח וידאו לכולם. |
| R075 | BETA | T038 | AT075 | לאפשר draft/publish/rollback עם optimistic concurrency ו־revision conflict ברור; פרסום דורש הרשאה ותיעוד. |
| R076 | BETA | T038 | AT076 | בהחלפת תוכנית לשמור bindings ולהציע alignment; preview diff נדרש לפני publish. להחזיק effective-from/version לקישור היסטורי. |
| R077 | BETA | T039 | AT077 | לאפשר room polygons, אזורי הרשאה/התראה ו־stairs/elevator connectors; להבחין בין zone במפה לבין detection polygon בתמונת מצלמה. |
| R078 | BETA | T039 | AT078 | לקשר מצלמות סמוכות ומסלול ידני מאומת; אין הבטחה שהגרף מעיד שאותו אדם עבר בין המצלמות. |
| R079 | BETA | T040 | AT079 | להוסיף climate, cover, fan, media_player ו־helpers לפי יכולות אמיתיות; state cards נשארים זמינים גם אם פעולה לא נתמכת. |
| R080 | BETA | T040 | AT080 | lock/alarm/script/button ופעולות מסוכנות דורשות action allowlist ואישור מתאים; אין auto retry או command queue ל־unlock/disarm. |
| R081 | BETA | T041 | AT081 | לממש מקור history מוגדר או event store מקומי עם coverage/retention; להציג ידוע/לא ידוע לפי זמן, לא forward fill ללא גבול. |
| R082 | BETA | T041 | AT082 | לשחזר מצב עם גרסת התוכנית ומיקום הישות שהיו תקפים; שינוי timezone אינו משנה instant או זהות האירוע. |
| R083 | BETA | T042 | AT083 | לנהל master clock, barrier ו־per-camera actual rendered time; למדוד p95 drift ולא להסתפק בשיגור seek במקביל. |
| R084 | BETA | T042 | AT084 | לטפל במצלמה חסרת הקלטה/מאחרת בלי להסיט את כולן; להציג sync quality ולבטל מהירות לא נתמכת. |
| R085 | BETA | T043 | AT085 | לבחור כמה עוגנים או room ולפתוח Live/Playback synchronized עם context משותף ו־back למיקום המקורי. |
| R086 | BETA | T043 | AT086 | להציג מצלמות זמינות/אסורות/חסרות כיסוי בנפרד; suggested adjacent cameras אינן automatic person tracking. |
| R087 | BETA | T044 | AT087 | לייצר thumbnail מההקלטה בזמן המבוקש עם actual timestamp ו־source; אין צילום Live כתחליף שקט. |
| R088 | BETA | T044 | AT088 | להגביל cache, decode concurrency והיקף prefetch; אין אלפי חיבורי NVR בכל גרירת Timeline. |
| R089 | BETA | T045 | AT089 | לממש PTZ/presets/zoom/talk רק לפי capability מוכח; תנועת PTZ נפסקת על timeout, blur או שחרור לחיצה. |
| R090 | BETA | T045 | AT090 | להבחין digital zoom מהנעת מצלמה; לדרוש הסכמת מיקרופון ו־talk arbitration ולהציג unavailable ללא כפתור מדומה. |
| R091 | BETA | T046 | AT091 | לספק snapshot, bookmark ו־manual recording עם סטטוס אמת ו־timeout כאשר נתמך; start/stop אינו משנה schedule בלי אישור. |
| R092 | BETA | T046 | AT092 | שם ידידותי נשאר מקומי; OSD sync מפורש מציג diff ואישור ומטפל ב־read-only ללא הצלחה שקרית. |
| R093 | BETA | T047 | AT093 | לאגד אירועים לחלונות review עם כללים מוסברים, start/end, cameras ו־severity; לשמור אירועי raw מקוריים. |
| R094 | BETA | T047 | AT094 | להציג spotlight לפי כללים דטרמיניסטיים ו־confidence/source כאשר יש; אפשר לפתוח פריטים שמאחורי סיכום ולתקן קיבוץ. |
| R095 | BETA | T048 | AT095 | לייצא בטווח מוגדר באמצעות endpoint/שיטה שאומתו מול ה־NVR, עם queue, progress, retries בטוחים, cancel ו־partial states. |
| R096 | BETA | T048 | AT096 | להפעיל הרשאת download ייעודית ולשמור זמני requested/actual, source והמרות; כשל יצוא אינו מוחק הקלטה או מאריך retention אוטומטית. |
| R097 | BETA | T049 | AT097 | ליצור Case המקשר אירועים וקטעים מכמה מצלמות, notes, tags ו־status; עריכה נבדקת לפי user permission ו־revision. |
| R098 | BETA | T049 | AT098 | להציג אם bookmark רק מפנה ל־NVR או שהקטע הועתק לשימור; overwritten footage מוצג כחסר ולא מתויג preserved. |
| R099 | V1 | T050 | AT099 | להפיק ZIP עם קטעים, manifest, notes ודו״ח קריא, hash לכל קובץ ופרטי מקור/זמן; לבדוק export/import verification. |
| R100 | V1 | T050 | AT100 | להבהיר hash מוכיח שינוי מאז היצוא ולא את אמיתות הצילום; חתימה/מפתח ואימות מקור הם יכולות נפרדות ולא סמל Original סתמי. |
| R101 | BETA | T051 | AT101 | להציג disk/recording state, retention שנמדד/מוערך וסיבת estimate; לא לאפשר format/RAID/delete recordings במסגרת הפיתוח. |
| R102 | BETA | T051 | AT102 | קריאת schedules מופרדת מכתיבה; שינוי mode/prepost/quota דורש support מוכח, diff, אישור ותוכנית חזרה. |
| R103 | BETA | T052 | AT103 | ליצור trigger/scope/time window/cooldown/actions ולהריץ dry run המציג למה היה נוצר alert בלי לשלוח פקודה פיזית. |
| R104 | BETA | T052 | AT104 | למנוע loops ו־duplicate notifications, להגביל webhooks ולשמור מי שינה חוק; לבחור HA או local owner יחיד לכל אוטומציה. |
| R105 | BETA | T053 | AT105 | לקשר אירועי camera/door/contact בחלון זמן ואזור ולהציג את הראיות והוודאות; pulse unlock אינו הוכחה שדלת נפתחה. |
| R106 | BETA | T053 | AT106 | אין unlock/disarm אוטומטי מפלט AI או קורלציה; timeout, delayed clock ו־missing state נבדקים. |
| R107 | V1 | T054 | AT107 | לשייך camera, ringing event ודלת על המפה ולהציג preview/פעולות רק עבור relays מורשים וקיימים. |
| R108 | V1 | T054 | AT108 | לצרוך את מערכת האינטרקום/HA הקיימת במקום לשכפל user/card provisioning; פעולת פתיחה מאושרת נרשמת ללא המצאת lock state. |
| R109 | V1 | T055 | AT109 | למפות role ו־scope לפי site/floor/camera/action/export ולקבל deny בעת ירושת הרשאה לא חוקית; server filter לכל resource. |
| R110 | V1 | T055 | AT110 | לשמור audit של viewing/export/config/commands בלי סודות, עם retention וגישה מוגבלת; downgrade הרשאה נבדק בסשן פתוח. |
| R111 | BETA | T056 | AT111 | להציע camera/map/event/health wrappers החולקים רכיבים וחוזים עם הממשק הראשי; להשתמש בגשר זהות/הרשאות הקיים מהפיילוט, לא לדחות אותו לשלב הכרטיסים. |
| R112 | BETA | T056 | AT112 | להתקין integration/cards במסלול נפרד מתועד, כגון HACS, לצד Add-on repository; אין duplicate entities, סודות ב־YAML או עקיפת RBAC דרך הכרטיס. |
| R113 | BETA | T057 | AT113 | להציג saved view על מסך גדול, rotation מתון ו־health בלי תפריטי admin; session/kiosk principal עם הרשאות מצומצמות. |
| R114 | BETA | T057 | AT114 | להגביל פעולות unlock ו־settings בקיוסק ולשחזר view לאחר reconnect; מסך אפור/מנותק לא מוצג כמצלמה פעילה. |
| R115 | V1 | T058 | AT115 | לתמוך בקטלוג מאוחד עם מקור NVR לכל מצלמה, timezone פר אתר ו־scope הרשאה; IDs אינם מתנגשים בין מקורות. |
| R116 | V1 | T058 | AT116 | להפריד concurrency, outage ו־search coverage בין NVR; כשל אתר אחד אינו מפיל מפות או חקירה באתר אחר. |
| R117 | BETA | T059 | AT117 | לנעול schema versioned עבור source hash, dimensions, transforms, walls, doors, windows, rooms, connectors ו־uncertainty. |
| R118 | BETA | T059 | AT118 | לבדוק normalized bounds, invalid polygons, missing calibration ו־duplicate IDs; renderer deterministic מצייר אותו JSON באופן עקבי. |
| R119 | V1 | T060 | AT119 | לשלוח ל־AI רק לאחר consent עם prompt version/schema נעולים ותקציב, ולהחזיר geometry ולא עיצוב תמונה סמכותי. |
| R120 | V1 | T060 | AT120 | להתייחס לטקסט בתוכנית כנתון לא הוראה, להחזיר unknown/uncertain ולא להמציא קירות או שמות; raw response אינו מפורסם אוטומטית. |
| R121 | V1 | T061 | AT121 | להציג מקור מול geometry בשכבות, confidence ו־missing elements, ולאפשר תיקון ידני לפני publish. |
| R122 | V1 | T061 | AT122 | לשמור prompt/model/schema/source hashes, corrections ו־approver; reject משאיר את התוכנית הקודמת ואת source intact. |
| R123 | BETA | T062 | AT123 | לחפש type/time/site/floor/room/camera לפי metadata שקיים; ממשק מסביר אילו שדות זמינים ולמה אחרים חסרים. |
| R124 | BETA | T062 | AT124 | תוצאה מקשרת לפריים/אירוע ומקור מידע; מסנן unsupported לא מחזיר 0 כאילו אין התאמות. |
| R125 | V2 | T063 | AT125 | להוסיף adapter לניתוח/embeddings בעל מדיניות privacy, model version, resource budget ו־opt-in; local baseline עובד ללא שירות AI. |
| R126 | V2 | T063 | AT126 | לסנן color/object/free text רק על מקורות שנוצר עבורם metadata מתאים; תוצאות probabilistic מציגות confidence ואינן ראיית זהות. |
| R127 | V2 | T064 | AT127 | להציע adjacent camera/time windows לפי topology ואירועים ולהראות חלופות; המפעיל מאשר רצף ב־Case. |
| R128 | V2 | T064 | AT128 | לסמן hypothetical linkage ולא לטעון אותו אדם/רכב ללא ראיה מתאימה; אין פעולת אבטחה אוטונומית על בסיס ההצעה. |
| R129 | V2 | T065 | AT129 | להגדיר conversion adapter מבודד עם רישיון ותלויות נבדקים, בחירת layers/unit/scale ושימור המקור. |
| R130 | V2 | T065 | AT130 | להשוות geometry ו־units מול מקור ולדחות conversion חלקי ללא הודעה; native CAD parsing אינו assumed dependency של Pilot. |
| R131 | V1 | T066 | AT131 | לממש speed/step רק בנתיב מדיה המוכיח semantics בפועל; להבדיל camera RTSP speed מ־browser playbackRate. |
| R132 | V1 | T066 | AT132 | לבדוק actual source time, audio, gaps ו־sync לאחר שינוי speed; unsupported נשאר disabled עם הסבר. |
| R133 | V2 | T067 | AT133 | לתכנן signed manifest, key rotation, offline verification ומעמד אמון; לבדוק tamper בקובץ, manifest ושרשרת מפתחות. |
| R134 | V2 | T067 | AT134 | להציג integrity-at-export בנפרד מ־capture authenticity; אין הצהרה על קבילות משפטית או מקור מאומת ללא בסיס מתאים. |
| R135 | V1 | T068 | AT135 | למדוד catalogue scale בנפרד ממספר streams/transcodes ולפרסם CPU/RAM/latency/leaks בתצורת ייחוס מתועדת. |
| R136 | V1 | T068 | AT136 | להריץ soak, HA/go2rtc/NVR restarts, export queue ו־disk full; backpressure נבדק וההקלטה המקורית נשארת תקינה. |
| R137 | V1 | T069 | AT137 | לבדוק malicious PDF/SVG, path traversal, XML entities, SSRF, token replay ו־oversized media; אין גישה חופשית ל־URL מהדפדפן. |
| R138 | V1 | T069 | AT138 | לסרוק artifacts/logs/source ו־dependencies, לתעד remediation ולבדוק revoke; API/RTSP של go2rtc אינם מפורסמים חופשי לאינטרנט. |
| R139 | V1 | T070 | AT139 | להפעיל shadow read comparison, migration dry run ומיפוי IDs/config בלי לשנות NVR או לאבד היסטוריית מפות. |
| R140 | V1 | T070 | AT140 | לבצע rollout מדורג ו־rollback אמיתי; decommission של הישן רק באישור לאחר parity וללא מחיקת backup. |
| R141 | V1 | T071 | AT141 | לספק אשף install→NVR→HA→go2rtc→floor→camera עם capability/time checks והסברי failures. |
| R142 | V1 | T071 | AT142 | לכתוב מדריכי שימוש/שחזור/חקירה/פרטיות והרשאות, לצרף screenshots מה־build ולא מהדמיה בלבד. |
| R143 | V1 | T072 | AT143 | לסגור כל דרישה בתחום V1 בראיות עדכניות או בהחרגה מפורשת שמסירה תכונה; no P0/P1 פתוחים במסלולים הנתמכים. |
| R144 | V1 | T072 | AT144 | להפיק signed release approval, tag, builds, migrations, rollback, compatibility matrix ו־known limits; target date אינו מחליף את gates. |
| R145 | V2 | T073 | AT145 | לממש dispatcher רק לאחר אימות CLI מקומי: כל משימה יוצרת invocation נפרד עם model/effort, workspace ו־output schema; אין שליטה מדומה מהצ׳אט. |
| R146 | V2 | T073 | AT146 | לכפות dependency gates, path allowlist, timeout, budget ו־manual stop; test failure תשתיתי אינו מפעיל אינסוף תיקונים או קנייה אוטומטית. |
| R147 | V1 | T074 | AT147 | לשמור screenshots עבור מסכי מפתח ו־state matrix ב־CI, עם masking לווידאו משתנה ותהליך אישור intentional changes. |
| R148 | V1 | T074 | AT148 | לקשר feedback ל־screen/requirement/commit; למדוד time to camera/time to recording ותקלות UX ללא איסוף frames או טקסט רגיש כברירת מחדל. |
| R149 | V1 | T075 | AT149 | להפריד פוליגון זיהוי בתמונת המצלמה מפוליגון חדר במפה; לקרוא ולערוך Motion/Smart zones רק כשהמקור וההרשאה תומכים, עם preview, diff ו־readback. |
| R150 | V1 | T075 | AT150 | מסכת פרטיות אמיתית דורשת אישור, כתיבה מאומתת ובדיקת התוצאה בזרם; overlay בדפדפן אינו מסכת NVR ואינו מגן על הקלטות. אין שינוי אוטומטי בזיהוי או ב־retention. |
| R151 | PILOT | T076 | AT151 | לזהות משתמש לפי ha_instance_id + ha_user_id מאומת; לסנכרן משתמשי התחברות מ־HA דרך גשר מורשה ללא passwords, ללא person.* וללא כתיבה ל־HA auth. |
| R152 | PILOT | T076 | AT152 | להפריד normal/admin/system-generated/disabled; שינוי שם שומר שיוך, שם זהה עם ID חדש אינו יורש הרשאה; כשל sync מסומן stale ולא מוחק את הקטלוג. |
| R153 | PILOT | T077 | AT153 | לממש roles מובנים, קבוצות משתמשי HA ו־bindings מוגבלים ל־installation/site/building/floor/camera/entity; HA admin אינו role מוצר אוטומטי, bootstrap מפורש בלבד. |
| R154 | PILOT | T077 | AT154 | לחשב יכולת יחד עם scope לכל binding; viewer באתר A + editor בקומה B אינו editor באתר A. deny ו־unknown קודמים; placement אינו מעניק גישה לציוד המקושר. |
| R155 | PILOT | T078 | AT155 | להציג קטלוג HA למורשים, קבוצות, תפקידים והיקף; לשייך משתמש HA רגיל כ־editor/site_admin בהיקף מקומי ולהציג preview של ההרשאות בלי שינוי הרשאות HA. |
| R156 | PILOT | T078 | AT156 | אין create-password או promote-HA-admin בממשק. שינוי חברות נבדק על כל bindings של הקבוצה, נרשם באודיט ואינו נותן למנהל קומה ניהול מערכת או קבוצות גלובליות. |
| R157 | PILOT | T079 | AT157 | לבדוק בצד שרת VMS permission + scope + HA user permissions + capability ולהעביר Context של המשתמש; פעולה שהמשתמש אינו מורשה לה ב־HA נחסמת גם כשגשר מחובר בהרשאה גבוהה. |
| R158 | PILOT | T079 | AT158 | לבודד map.edit מ־ha.entity.control; unlock/disarm/talk/export דורשים grants נפרדים. אין proxy לשירותי admin או scripts לא מבוקרים ואין שיגור פעולה גנרית בעזרת user_id מהלקוח. |
| R159 | PILOT | T080 | AT159 | להשעות גישה אחרי מחיקת/השבתת משתמש מאומתת ב־HA ולשמר audit; רענון סטטוס משתמש עד 60 שניות והפסקת sessions תוך 30 שניות מביטול ידוע הם יעדי בדיקה, לא נתונים קיימים. |
| R160 | PILOT | T080 | AT160 | להחיל permission_revision על API, WebSocket, video sessions ו־export jobs/downloads; downgrade ב־VMS חוסם בקשות חדשות מיד ולא מחכה ל־HA polling. כשל identity גורם לחסימת פעולות ולא fallback ל־admin. |
| R161 | PILOT | T081 | AT161 | למסור Add-on/App עם Ingress, אחסון מתמשך וגישה למשתמש HA רגיל באמצעות panel_admin:false לאחר הגנות; לראות תפריט אינו לקבל הרשאה. להוכיח גם פתיחת Ingress בפועל למשתמש הרגיל. |
| R162 | PILOT | T081 | AT162 | לחסום headers מזויפים, פורט ישיר לא מאומת, token replay ושימוש בטוקן Supervisor כזהות המשתמש; נתיב bridge פנימי מאומת ומצומצם, לא פתיחת ingress לכול. |
| R163 | V1 | T082 | AT163 | לאפשר למנהל VMS להגדיר role וקבוצות מותאמים, כולל grants רגישים נפרדים; לפני שינוי להציג השפעה על כל המשתמשים/הקבוצות וה־scopes המשויכים. |
| R164 | V1 | T082 | AT164 | האצלת rbac.assign למנהל אתר מוגבלת ל־allowlist ולהיקף; אין הסלמה עצמית, שינוי role משותף גלובלי, חברוּת בקבוצה חוצת היקפים או מעבר role/scope דרך bulk request. |
| R165 | PILOT | T083 | AT165 | להריץ תרחיש עם מנהל VMS, משתמש HA רגיל שהוא editor בקומה 2 ומשתמש לא משויך; לאשר עריכת קומה 2 ולחסום קומה 3, ניהול משתמשים, הגדרות NVR והסלמה ב־HA. |
| R166 | PILOT | T083 | AT166 | להוכיח deny גם ב־REST/WS/media/thumbnail/export ולא רק בכפתורים; לבדוק שם זהה ID חדש, scope union, downgrade בזמן וידאו, מחיקה, restore ו־last-admin recovery ללא פתיחת גישה אוטומטית. |
| R167 | V2 | T084 | AT167 | כיול קנה מידה בשתי נקודות ומרחק ידוע, ומיחידות השרטוט ב־DXF, עם סטטוס measured/estimated/missing ושארית; שינוי כיול אינו מזיז אף עצם, ומטרים מוצגים רק כשהתוכנית מכוילת. |
| R168 | V2 | T084 | AT168 | מסמך גאומטריה קנוני v2 לכל גרסת תוכנית (קירות, פתחים, מפלסים, תוויות, external_ids) עם טיוטה, פרסום, diff, rollback, אודיט ונעילה אופטימית; שכבת המבנה מוצגת בכל מסך מפה במערכת (מפה חיה, עורך, מפה היסטורית בזמן t, עמוד אירוע, Lovelace), עוברת לגרסת תוכנית חדשה ונכללת בגיבוי. |
| R169 | V2 | T085 | AT169 | ספריית עצמים מובנית (כ־150 פריטים ב־12 קטגוריות, כולל רפואה, ספורט ובטיחות) ופריטים מותאמים, עם חיפוש בעברית ובאנגלית, הצבה, סיבוב, מתיחה ומערך; עצם שמייצג ישות HA הוא הגוף של העוגן הקיים — מיקום אחד, מצב חי אחד, אותן הרשאות. |
| R170 | V2 | T085 | AT170 | מפלסים בקומה (גובה רצפה ותקרה, גם לעוגנים ולחדרים) ומחברים (מדרגות, רמפה, טריבונה, מעלית) בין מפלסים וקומות; מעגלי תאורה (כמה מנורות על ישות מפסק ב־HA) במצב חי ובהפעלה מהמפה החיה בהרשאה; עצמים נמצאים בחיפוש הגלובלי. |
| R171 | V2 | T086 | AT171 | זיהוי מקומי, בלי ענן, של קירות, דלתות וחלונות מתוכנית רסטר, ומיפוי שכבות ובלוקים מ־DXF, כמועמדים עם ציון ביטחון ומסך קבל/דחה/ערוך; שום מועמד אינו מתפרסם בלי אדם. |
| R172 | V2 | T086 | AT172 | סט תוכניות בדיקה (סינתטיות ואמיתיות מצונזרות) עם baseline: לפחות 90% מהקירות ו־80% מהדלתות על סט הייחוס, עד 15 שניות לתוכנית A3; רמז כיול מרוחב דלת מסומן כמשוער. |
| R173 | V2 | T087 | AT173 | תצוגת 3D בתוך מסך המפה (מתג 2D/3D), גם במפה ההיסטורית ובעמוד האירוע, הנבנית באופן דטרמיניסטי מהמסמך: קירות בגובה, פתחים, עצמים, מפלסים ומחברים, מצלמות עם קונוס וישויות HA במצב חי; הבחירה מסונכרנת עם ה־2D והפעולות באותן הרשאות. |
| R174 | V2 | T087 | AT174 | ה־3D נטען כ־chunk נפרד (עד 200KB gzip) רק לפי דרישה, עובד בטלפון ובכרטיס ה־Lovelace (לפחות 30fps עד 3,000 עצמים) ומייצא glTF; כיסוי המצלמות נעצר בקירות (מידע תכנוני) ודף המבנה מציג איזומטרי אמיתי. |
| R175 | V2 | T088 | AT175 | ייצוא SVG/PNG דטרמיניסטי, DXF עם שכבות מוגדרות, וחבילת תוכנית חתומה (מקור, גאומטריה, חדרים, עוגנים, פריטים מותאמים ודוח) עם ייבוא שמשחזר את התוכנית כטיוטה ומדווח על ישויות חסרות. |
| R176 | V2 | T088 | AT176 | round-trip: ייצוא וייבוא של חבילה מחזירים אותו hash גאומטרי; DXF מיוצא נקרא חזרה עם אותן ישויות; ייבוא JSON עובר ולידציה מלאה ונכנס כטיוטה. |
| R177 | V2 | T089 | AT177 | רמת 3D ריאליסטית (חומרים, צללים, שעה ביום) כמתג איכות, וסיור בגובה עין עם התנגשות בקירות ומעבר בדלתות פתוחות. |
| R178 | V2 | T089 | AT178 | ביצועים: לפחות 30fps בטלפון בסצנה של 1,000 עצמים; ברירת המחדל נשארת סכמטית. |
| R179 | V2 | T090 | AT179 | ייצוא IFC4 של הקומה בכותב עצמי: IfcBuildingStorey לכל מפלס, קירות, פתחים, חללים, עצמים לפי מחלקת IFC מהספרייה, מצלמות כ־IfcAudioVisualAppliance ומזהי HA ב־property set, עם GlobalId יציב בין ייצואים. |
| R180 | V2 | T090 | AT180 | ייבוא IFC (קומות, קירות, פתחים, חללים, ריהוט) כמועמדים למסך האישור, אחרי בדיקת זמינות של IfcOpenShell (LGPL) על תמונת ה־add-on; ייבוא חלקי מדווח ואינו מתקבל בשקט. |
