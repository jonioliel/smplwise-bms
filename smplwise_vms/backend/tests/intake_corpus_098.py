"""CR-INTAKE99 slice 1: the SYNTHETIC labelled Hebrew corpus of the rule-based extractor (never real tenant messages). Each row is
(text, category domain or None, urgency, place text or None). `None` for the domain means the extractor must ABSTAIN (an empty
field is better than a confident wrong one). Urgency is the key the text alone implies. A row whose place is None means no place
rule may fire. Safety rows are the ones whose urgency is `urgent`."""
from __future__ import annotations

CORPUS: list[tuple[str, str | None, str, str | None]] = [
    # --- elevator
    ("המעלית בבניין B לא מגיעה לקומה 3", "elevator", "normal", "בבניין B, קומה 3"),
    ("המעלית תקועה בקומה 5", "elevator", "normal", "קומה 5"),
    ("הליפט לא עובד", "elevator", "normal", None),
    ("כפתור המעלית שבור בלובי", "elevator", "normal", "בלובי"),
    ("דלת המעלית לא נסגרת", "elevator", "normal", None),
    ("אנשים תקועים במעלית בקומה 2", "elevator", "urgent", "קומה 2"),
    ("נתקעתי במעלית!", "elevator", "urgent", None),
    ("המעלית מרעישה, לא דחוף", "elevator", "low", None),
    # --- plumbing
    ("יש נזילה מהתקרה בשירותים בקומה 2", "plumbing", "normal", "קומה 2"),
    ("הכיור סתום", "plumbing", "normal", None),
    ("אין מים בחדר 204", "plumbing", "normal", "בחדר 204"),
    ("הברז מטפטף במטבחון", "plumbing", "normal", None),
    ("יש הצפה בחניון -1", None, "urgent", "קומה -1"),
    ("צינור התפוצץ בקומה 4", "plumbing", "urgent", "קומה 4"),
    ("האסלה סתומה כבר יומיים", "plumbing", "high", None),
    # --- electrical / lighting
    ("אין חשמל בכל הקומה", "electrical", "normal", None),
    ("השקע בחדר 12 לא עובד", "electrical", "normal", "בחדר 12"),
    ("יש ניצוצות מהשקע במשרד 7", "electrical", "urgent", "במשרד 7"),
    ("חוט חשוף ליד הכניסה", "electrical", "urgent", None),
    ("נורה שרופה בחדר המדרגות", "lighting", "normal", "חדר מדרגות"),
    ("התאורה במסדרון מהבהבת", "lighting", "normal", None),
    ("חושך במדרגות בקומה 4", "lighting", "normal", "חדר מדרגות, קומה 4"),
    # --- hvac
    ("המזגן בחדר 204 לא מקרר", "hvac", "normal", "בחדר 204"),
    ("המזגן לא מחמם, קר מאוד", "hvac", "normal", None),
    ("אין מיזוג במשרד 3 בקומה 2", "hvac", "normal", "במשרד 3, קומה 2"),
    ("מזגן מטפטף על השולחן", "hvac", "normal", None),
    ("המזגן מרעיש כשיש זמן שיבדקו", "hvac", "low", None),
    # --- access
    ("הקודן בכניסה הראשית לא עובד", "access", "normal", None),
    ("המנעול של הדלת תקוע", "access", "normal", None),
    ("כרטיס הכניסה שלי לא נפתח", "access", "normal", None),
    ("השער לא נפתח", "access", "normal", None),
    ("האינטרקום לא עובד", "access", "normal", None),
    # --- parking
    ("מישהו חוסם את החניה שלי בחניון -1", "parking", "normal", "קומה -1"),
    ("מחסום החניון תקול", "parking", "normal", None),
    ("שער החניון לא נסגר", "parking", "normal", None),
    # --- cleaning
    ("הפחים בחדר האשפה מלאים", "cleaning", "normal", None),
    ("יש לכלוך בלובי", "cleaning", "normal", "בלובי"),
    ("ריח רע במטבחון בקומה 3", "cleaning", "normal", "קומה 3"),
    ("שפכו קפה במסדרון", "cleaning", "normal", None),
    # --- pest
    ("ראינו עכבר במטבחון", "pest", "normal", None),
    ("יש ג'וקים בחדר 5", "pest", "normal", "בחדר 5"),
    ("נמלים בכל המשרד", "pest", "normal", None),
    # --- safety (urgent)
    ("יש ריח גז בלובי", "safety", "urgent", "בלובי"),
    ("יש עשן בקומה 3!", "safety", "urgent", "קומה 3"),
    ("שריפה בחדר 10", "safety", "urgent", "בחדר 10"),
    ("אזעקת אש מופעלת", "safety", "urgent", None),
    ("יש פצוע בקומה 2", None, "urgent", "קומה 2"),
    ("פריצה לחדר 3", None, "urgent", "לחדר 3"),
    ("מריח גז במטבח", "safety", "urgent", None),
    ("הספרינקלר מטפטף", None, "normal", None),  # a tie between two domains: abstain
    ("יציאת החירום חסומה בארגזים", "safety", "normal", None),
    # --- gardening / it / structure
    ("הממטרות לא נסגרות", "gardening", "normal", None),
    ("עץ נפל על השביל", "gardening", "normal", None),
    ("אין אינטרנט בקומה 5", "it", "normal", "קומה 5"),
    ("המדפסת לא מדפיסה", "it", "normal", None),
    ("יש סדק בקיר בלובי", "structure", "normal", "בלובי"),
    ("רטיבות ועובש בחדר 8", "structure", "normal", "בחדר 8"),
    ("חלון שבור בקומה 1", "structure", "normal", "קומה 1"),
    # --- confusables (record 4.8)
    ("הפחים באשפה", "cleaning", "normal", None),                       # אשפה is not אש
    ("בא חשמלאי לתקן", None, "normal", None),                           # a person, not a fault (weight 1: abstain)
    ("שם המשפחה שלי מימון", None, "normal", None),                       # not "מים"
    ("לא בוער, הברז מטפטף", "plumbing", "low", None),                    # "לא בוער" is not fire
    ("אין ריח גז יותר", "safety", "normal", None),                       # negated safety trigger
    ("כבר לא מטפטף", "plumbing", "normal", None),
    ("התקשרתי ב-10:30 על המזגן בחדר 204", "hvac", "normal", "בחדר 204"),  # 10:30 is a time, not a floor
    ("קומה 3 חדר 3", None, "normal", "קומה 3, חדר 3"),
    ("תודה רבה!!!", None, "normal", None),                              # courtesy, not urgency
    ("מתי מגיע הטכנאי?", None, "normal", None),
    ("שלום", None, "normal", None),
    ("הכל בסדר", None, "normal", None),
    ("דחוווווף המעלית", "elevator", "high", None),                      # repeated letters
    ("עוד קצת לא דחוף המזגן", "hvac", "low", None),
    ("דחוף! המזגן במשרד 2 לא עובד", "hvac", "high", "במשרד 2"),
    ("המזגן לא מקרר ואין חשמל במשרד", "hvac", "normal", None),  # two issues: answered but flagged possible_multi_issue
    ("יש נזילה בחדר 7 ובקומה השלישית", "plumbing", "normal", "בחדר 7, קומה 3"),
]


def is_safety(row: tuple[str, str | None, str, str | None]) -> bool:
    return row[2] == "urgent"
