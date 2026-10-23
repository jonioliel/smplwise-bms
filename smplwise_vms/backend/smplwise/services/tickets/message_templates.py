"""CR-038 9.7 / 14.3 / D26 / D33: message templates - placeholders, validation, the starter texts in he / en / ar / ru, the choice of
a template for a contact's language, and rendering.

Rules (9.7):
- Allow-listed placeholders only (PLACEHOLDERS). `{link}` is mandatory in assign / reminder / reopened / update and in the cost messages that ask the vendor to act
  (cost_rejected / cost_reopened - TK251, 11A.7); `{code}` is
  mandatory in, and allowed only in, the `code` template, which carries no link and no ticket title (this module is stricter and
  also refuses `{place}` and `{device}` there: a forwarded code message discloses nothing about the ticket).
- No Unicode Cc / Cf characters (control, bidi, zero-width - review T9), no URL other than `{link}`, at most 1000 rendered
  characters (checked against worst-case values at save time; capped values at send time).
- `{module_name}` / `{module_name_plural}` (D33) render in the CONTACT's language from the `display_name` setting (14.3); an
  agreeing word is written `{g:f=<feminine>|m=<masculine>|n=<neuter>}` and follows the noun's gender in that language. Starter
  texts never hard-code the module's noun (a lint test enforces it), so renaming the module changes every starter message.
- The rendered text is never stored and never logged: the outbox keeps template id + revision + params without `{link}` /
  `{code}`; the two secrets are passed to `render` at send time only.
- Rendering is ONE pass (a value is never scanned for placeholders again).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping

from . import naming as _naming
from .channel import CODE_PURPOSES, DEFAULT_LANG, LANGS, LINK_PURPOSES, PURPOSES, TEMPLATE_LINK_PURPOSES, Button, one_line, strip_controls

PLACEHOLDERS = ("name", "number", "department", "title", "place", "device", "priority", "organization", "link", "code",
                "manager", "eta", "module_name", "module_name_plural",
                "due", "window",  # TKRFQ1: a request for quotation's deadline and wanted work window (local time, display text)
                "location",  # CR-ORG-LOCATIONS: the request's organisation location (name · street, city; + the map link when switched on)
                "files")  # RFQATT: "N files are attached (see the link)" in the vendor's language - a count only, never a name or a URL
SECRET_PLACEHOLDERS = frozenset({"link", "code"})  # never in params_json; passed at send time only
# PRIVORG-291: a param only the code-owned fixed starters use (never a placeholder an editor may type into a stored template)
FIXED_ONLY_PARAMS = frozenset({"privacy_contact"})
PARAM_KEYS = (frozenset(PLACEHOLDERS) - SECRET_PLACEHOLDERS - {"module_name", "module_name_plural"}) | FIXED_ONLY_PARAMS
CODE_FORBIDDEN = frozenset({"link", "title", "place", "device", "location"})
RENDERED_MAX = 1000
BODY_MAX = 1500

# per-placeholder caps: worst-case values at save time, hard caps at send time
VALUE_MAX = {"name": 80, "number": 7, "department": 60, "title": 120, "place": 200, "device": 80, "priority": 30,
             "organization": 60, "link": 120, "code": 6, "manager": 80, "eta": 24, "module_name": 30, "module_name_plural": 30,
             "due": 24, "window": 40, "location": 200, "files": 60, "privacy_contact": 80}
SECRET_MAX = {"link": 400, "code": 6}  # send time (slice 5b): the real URL is system-made and never cut (a cut link is a dead link)

# 14.3 defaults - ONE source (slice 5b unified the two naming schemes): slice 1's naming.DEFAULTS (`tickets.name`, tokens {ticket} /
# {tickets}) for all four languages; these templates keep their {module_name} / {module_name_plural} tokens, rendered from the same
# names (the outbox passes naming.names_for per language). English has no grammatical gender there: "n" here.
DEFAULT_DISPLAY_NAME: dict[str, dict[str, Any]] = {
    lang: {"one": _naming.DEFAULTS[lang]["one"], "many": _naming.DEFAULTS[lang]["many"], "gender": _naming.DEFAULTS[lang]["gender"] or "n"}
    for lang in LANGS
}
# the default nouns (and listed case forms) that user-facing message texts must not hard-code (14.3 lint); the earlier message-core
# defaults stay listed too
DEFAULT_NOUNS = tuple(dict.fromkeys(
    [_naming.DEFAULTS[lang][form] for lang in LANGS for form in ("one", "many")]
    + ["ticket", "tickets", "طلب", "طلبات", "заявка", "заявки", "заявку", "заявок"]))

_TOKEN = re.compile(r"\{([^{}]*)\}")
_GENDER = re.compile(r"^g:([fmn]=[^|{}]*)(\|[fmn]=[^|{}]*)*$")
# a URL that is not {link}: a scheme, `www.`, a punycode label, or (deep review B5) a bare domain followed by a path - labels
# joined by dots, the last one of letters only (2+), then `/` - which WhatsApp turns into a link ("evil.example/x"). Numbers
# with dots and slashes ("1.5/2", "2.5.6/ב") are not domains.
_URL = re.compile(r"(?i)\b(?:https?://|www\.|xn--)|\b[\w-]+(?:\.[\w-]+)*\.[^\W\d_]{2,}/")

# the reply words and button captions per language (buttons are OFF by default, 9.3)
BUTTON_TEXT = {
    "he": {"ack": "התקבל", "wip": "בטיפול"},
    "en": {"ack": "Received", "wip": "In progress"},
    "ar": {"ack": "تم الاستلام", "wip": "قيد المعالجة"},
    "ru": {"ack": "Получено", "wip": "В работе"},
}
BUTTON_ACTIONS = ("ack", "wip")

# Starter templates (one per purpose x language). ar / ru need a native speaker's review before the release (slice 8, 9.7).
STARTERS: dict[str, dict[str, str]] = {
    "assign": {
        "he": "שלום {name},\n{module_name} {number} ({department}): {title}\n{place}\nלעדכון הטיפול: {link}\nחובה להיכנס לקישור כדי להמשיך בטיפול.",
        "en": "Hello {name},\nNew {module_name} #{number} ({department}): {title}\n{place}\nUpdate the handling: {link}\nYou must open the link to continue the handling.",
        "ar": "مرحبًا {name}،\n{module_name} رقم {number} ({department}): {title}\n{place}\nلتحديث المعالجة: {link}\nيجب فتح الرابط لمتابعة المعالجة.",
        "ru": "Здравствуйте, {name}!\n{g:f=Новая|m=Новый|n=Новое} {module_name} № {number} ({department}): {title}\n{place}\nОбновить статус: {link}\nЧтобы продолжить работу, необходимо открыть ссылку.",
    },
    "reminder": {
        "he": "תזכורת: {module_name} {number} ({department}): {title}\nלעדכון הטיפול: {link}\nחובה להיכנס לקישור כדי להמשיך בטיפול.",
        "en": "Reminder: {module_name} #{number} ({department}): {title}\nUpdate the handling: {link}\nYou must open the link to continue the handling.",
        "ar": "تذكير: {module_name} رقم {number} ({department}): {title}\nلتحديث المعالجة: {link}\nيجب فتح الرابط لمتابعة المعالجة.",
        "ru": "Напоминание: {module_name} № {number} ({department}): {title}\nОбновить статус: {link}\nЧтобы продолжить работу, необходимо открыть ссылку.",
    },
    "code": {
        "he": "קוד האימות: {code}\nהקוד בתוקף 10 דקות. אין למסור אותו לאחרים.",
        "en": "Verification code: {code}\nValid for 10 minutes. Do not share it.",
        "ar": "رمز التحقق: {code}\nصالح لمدة 10 دقائق. لا تشاركه مع أحد.",
        "ru": "Код подтверждения: {code}\nДействует 10 минут. Никому его не сообщайте.",
    },
    "closed": {
        "he": "{module_name} {number} ({department}) {g:f=נסגרה|m=נסגר|n=נסגר}. תודה.",
        "en": "{module_name} #{number} ({department}) is closed. Thank you.",
        "ar": "تم إغلاق {module_name} رقم {number} ({department}). شكرًا.",
        "ru": "{module_name} № {number} ({department}) {g:f=закрыта|m=закрыт|n=закрыто}. Спасибо.",
    },
    "reassigned": {
        "he": "{module_name} {number} ({department}) {g:f=הועברה|m=הועבר|n=הועבר} לטיפול אחר. הקישור שקיבלתם אינו פעיל עוד.",
        "en": "{module_name} #{number} ({department}) was handed to someone else. Your link no longer works.",
        "ar": "تم تحويل {module_name} رقم {number} ({department}) إلى جهة أخرى. الرابط الذي استلمته لم يعد فعالًا.",
        "ru": "{module_name} № {number} ({department}) {g:f=передана|m=передан|n=передано} другому исполнителю. Ваша ссылка больше не действует.",
    },
    "reopened": {
        "he": "{module_name} {number} ({department}) {g:f=נפתחה|m=נפתח|n=נפתח} מחדש: {title}\n{place}\nלעדכון הטיפול: {link}\nחובה להיכנס לקישור כדי להמשיך בטיפול.",
        "en": "{module_name} #{number} ({department}) was reopened: {title}\n{place}\nUpdate the handling: {link}\nYou must open the link to continue the handling.",
        "ar": "أعيد فتح {module_name} رقم {number} ({department}): {title}\n{place}\nلتحديث المعالجة: {link}\nيجب فتح الرابط لمتابعة المعالجة.",
        "ru": "{module_name} № {number} ({department}) {g:f=открыта|m=открыт|n=открыто} снова: {title}\n{place}\nОбновить статус: {link}\nЧтобы продолжить работу, необходимо открыть ссылку.",
    },
    "update": {
        "he": "עדכון: {module_name} {number} ({department}): {title}\n{place}\nלעדכון הטיפול: {link}",
        "en": "Update: {module_name} #{number} ({department}): {title}\n{place}\nUpdate the handling: {link}",
        "ar": "تحديث: {module_name} رقم {number} ({department}): {title}\n{place}\nلتحديث المعالجة: {link}",
        "ru": "Обновление: {module_name} № {number} ({department}): {title}\n{place}\nОбновить статус: {link}",
    },
    # slice 9 (11A.7): the vendor's cost claim - never an amount in a message. TK251: a message that asks the vendor to act
    # carries the handler link ({link}, the claim step - claim mode until the claim window ends); the approval carries none
    "cost_rejected": {
        "he": "דרישת התשלום ל{module_name} {number} ({department}) הוחזרה לתיקון.\nלעיון בהערה ולהגשה מחדש: {link}",
        "en": "The cost claim for {module_name} #{number} ({department}) was sent back for correction.\nSee the note and resubmit: {link}",
        "ar": "أعيدت مطالبة التكلفة لـ {module_name} رقم {number} ({department}) للتصحيح.\nللاطلاع على الملاحظة وإعادة التقديم: {link}",
        "ru": "Счёт по {module_name} № {number} ({department}) возвращён на исправление.\nЗамечание и повторная отправка: {link}",
    },
    "cost_approved": {
        "he": "דרישת התשלום ל{module_name} {number} ({department}) אושרה. תודה.",
        "en": "The cost claim for {module_name} #{number} ({department}) was approved. Thank you.",
        "ar": "تمت الموافقة على مطالبة التكلفة لـ {module_name} رقم {number} ({department}). شكرًا.",
        "ru": "Счёт по {module_name} № {number} ({department}) одобрен. Спасибо.",
    },
    "cost_reopened": {
        "he": "אפשר שוב להגיש דרישת תשלום ל{module_name} {number} ({department}).\nלהגשה: {link}",
        "en": "You can submit the cost claim for {module_name} #{number} ({department}) again.\nSubmit it here: {link}",
        "ar": "يمكنكم مجددًا تقديم مطالبة التكلفة لـ {module_name} رقم {number} ({department}).\nللتقديم: {link}",
        "ru": "Вы снова можете отправить счёт по {module_name} № {number} ({department}).\nОтправить: {link}",
    },
    # TKRFQ1 (docs/tickets/RFQ_BACKEND_CONTRACT.md section 8): requests for quotation. Never an amount, a phone number or free text;
    # `{number}` is the RFQ's running number, `{due}` / `{window}` display texts in the installation's zone. An award never sends one
    # of these by itself (the manager confirms a draft); vendors who were not selected get nothing.
    "rfq_invite": {
        "he": "שלום {name},\nבקשה להצעת מחיר מס' {number}: {title}\n{place}\nמועד אחרון להצעה: {due}\nחלון עבודה רצוי: {window}\n{files}\nפרטים וטופס ההצעה: {link}\nאפשר גם לסמן בקישור שאינכם מעוניינים.\n{organization}",
        "en": "Hello {name},\nRequest for quotation no. {number}: {title}\n{place}\nQuote deadline: {due}\nWanted work window: {window}\n{files}\nDetails and the quote form: {link}\nYou can also mark in the link that you are not interested.\n{organization}",
        "ar": "مرحبًا {name}،\nدعوة لتقديم عرض سعر رقم {number}: {title}\n{place}\nآخر موعد لتقديم العرض: {due}\nموعد العمل المرغوب: {window}\n{files}\nالتفاصيل ونموذج العرض: {link}\nيمكنكم أيضًا الإشارة في الرابط إلى أنكم غير مهتمين.\n{organization}",
        "ru": "Здравствуйте, {name}!\nЗапрос коммерческого предложения № {number}: {title}\n{place}\nСрок подачи предложения: {due}\nЖелательные сроки работ: {window}\n{files}\nПодробности и форма предложения: {link}\nПо ссылке можно также отметить, что вам это не интересно.\n{organization}",
    },
    "rfq_reminder": {
        "he": "תזכורת: המועד להגשת הצעת מחיר ל\"{title}\" (מס' {number}) מסתיים {due}.\nלהגשה: {link}",
        "en": "Reminder: the quote deadline for \"{title}\" (no. {number}) is {due}.\nSubmit here: {link}",
        "ar": "تذكير: آخر موعد لتقديم عرض السعر لـ\"{title}\" (رقم {number}) هو {due}.\nللتقديم: {link}",
        "ru": "Напоминание: срок подачи предложения по «{title}» (№ {number}) истекает {due}.\nПодать: {link}",
    },
    "rfq_update": {
        "he": "יש הודעה חדשה לגבי ההצעה שלכם ל\"{title}\" (מס' {number}).\nלצפייה ולתשובה: {link}",
        "en": "There is a new message about your quote for \"{title}\" (no. {number}).\nView and reply: {link}",
        "ar": "توجد رسالة جديدة بخصوص عرض السعر الخاص بكم لـ\"{title}\" (رقم {number}).\nللاطلاع والرد: {link}",
        "ru": "Новое сообщение по вашему предложению «{title}» (№ {number}).\nПосмотреть и ответить: {link}",
    },
    "rfq_cancelled": {
        "he": "הבקשה להצעת מחיר \"{title}\" (מס' {number}) בוטלה. תודה על ההצעה.",
        "en": "The request for quotation \"{title}\" (no. {number}) was cancelled. Thank you for your quote.",
        "ar": "تم إلغاء الدعوة لتقديم عرض السعر \"{title}\" (رقم {number}). شكرًا على عرضكم.",
        "ru": "Запрос предложения «{title}» (№ {number}) отменён. Спасибо за ваше предложение.",
    },
    "rfq_order": {
        "he": "ההצעה שלכם ל\"{title}\" (מס' {number}) אושרה. מועד העבודה: {window}.\nהזמנת העבודה והמסמכים: {link}\nנא לאשר את המועד בקישור.",
        "en": "Your quote for \"{title}\" (no. {number}) was approved. Work dates: {window}.\nThe work order and documents: {link}\nPlease confirm the dates through the link.",
        "ar": "تمت الموافقة على عرض السعر الخاص بكم لـ\"{title}\" (رقم {number}). موعد العمل: {window}.\nأمر العمل والمستندات: {link}\nيرجى تأكيد الموعد عبر الرابط.",
        "ru": "Ваше предложение по «{title}» (№ {number}) утверждено. Сроки работ: {window}.\nЗаказ-наряд и документы: {link}\nПожалуйста, подтвердите сроки по ссылке.",
    },
    "test": {
        "he": "הודעת בדיקה. אין צורך להשיב.",
        "en": "Test message. No reply needed.",
        "ar": "رسالة اختبار. لا حاجة للرد.",
        "ru": "Тестовое сообщение. Отвечать не нужно.",
    },
    # TKNOTIFOTP: the number-verification code - a FIXED, code-owned text (never editable in Settings, no free text, no ticket
    # detail, no link). ar / ru need a native review like every starter.
    "phone_verify": {
        "he": "קוד לאימות מספר הטלפון: {code}\nהקוד בתוקף 10 דקות. אין למסור אותו לאחרים. אם לא ביקשתם אימות, התעלמו מההודעה.",
        "en": "Phone number verification code: {code}\nValid for 10 minutes. Do not share it. If you did not ask for this, ignore this message.",
        "ar": "رمز التحقق من رقم الهاتف: {code}\nصالح لمدة 10 دقائق. لا تشاركه مع أحد. إذا لم تكن أنت من بادر بالتحقق، تجاهل هذه الرسالة.",
        "ru": "Код подтверждения номера телефона: {code}\nДействует 10 минут. Никому его не сообщайте. Если вы не запрашивали код, проигнорируйте это сообщение.",
    },
}
FIXED_PURPOSES = frozenset({"phone_verify", "intake_reply"})  # TKNOTIFOTP: always the starter above - a stored template is never used or accepted

# VPORTAL 2.6.4 review F2: code-owned VARIANTS of a fixed purpose, chosen by the outbox row's `template_id` ('starter:<name>') -
# never editable, never a stored template. `portal_code` is the vendor portal's sign-in code (purpose `phone_verify`, the same
# outbox rules: WhatsApp only, never held, never a fallback): it names the organisation (its own line, dropped when the name is not
# set) and the purpose, says the code is valid 10 minutes (vendor_portal.CODE_TTL) and that the organisation never asks for it - so
# a vendor phoned by someone "verifying the number" can tell a sign-in code from an office action. ar / ru need a native review.
FIXED_STARTERS: dict[str, dict[str, str]] = {
    "portal_code": {
        "he": "{organization}\nקוד הכניסה לאזור הספקים: {code}\nהקוד בתוקף 10 דקות.\nלעולם לא נבקש מכם את הקוד הזה, גם לא בטלפון. אין למסור אותו לאיש.\nאם לא ביקשתם להיכנס, התעלמו מההודעה.",
        "en": "{organization}\nVendor area sign-in code: {code}\nValid for 10 minutes.\nWe will never ask you for this code, not even by phone. Do not share it with anyone.\nIf you did not try to sign in, ignore this message.",
        "ar": "{organization}\nرمز الدخول إلى منطقة الموردين: {code}\nصالح لمدة 10 دقائق.\nلن نسألكم عن هذا الرمز أبدًا، ولا حتى عبر الهاتف. لا تشاركوه مع أي شخص.\nإذا لم تحاولوا الدخول، تجاهلوا هذه الرسالة.",
        "ru": "{organization}\nКод входа в кабинет поставщика: {code}\nДействует 10 минут.\nМы никогда не попросим вас сообщить этот код, даже по телефону. Никому его не сообщайте.\nЕсли вы не пытались войти, проигнорируйте это сообщение.",
    },
    # PRIVORG-291: the number-verification code to a directory person (a technician) once the installation set a privacy contact point:
    # the fixed text plus ONE neutral privacy line (the organisation line is dropped when no name is set). No legal wording.
    # ar / ru need a native review.
    "verify_privacy": {
        "he": "{organization}\nקוד לאימות מספר הטלפון: {code}\nהקוד בתוקף 10 דקות. אין למסור אותו לאחרים. אם לא ביקשתם אימות, התעלמו מההודעה.\nשאלות בנושא פרטיות: {privacy_contact}",
        "en": "{organization}\nPhone number verification code: {code}\nValid for 10 minutes. Do not share it. If you did not ask for this, ignore this message.\nPrivacy questions: {privacy_contact}",
        "ar": "{organization}\nرمز التحقق من رقم الهاتف: {code}\nصالح لمدة 10 دقائق. لا تشاركه مع أحد. إذا لم تكن أنت من بادر بالتحقق، تجاهل هذه الرسالة.\nلأسئلة الخصوصية: {privacy_contact}",
        "ru": "{organization}\nКод подтверждения номера телефона: {code}\nДействует 10 минут. Никому его не сообщайте. Если вы не запрашивали код, проигнорируйте это сообщение.\nВопросы о конфиденциальности: {privacy_contact}",
    },
}
# PRIVTEXT-293: the number-verification code to a TECHNICIAN (access_grants.is_technician) - the fixed text plus the short technician notice
# (access_grants.NOTICE_SHORT, kept word for word: a test compares them) and, when the installation set one, the privacy contact line.
# Chosen only by phone_verify._privacy_variant; never for a vendor contact. ar / ru need a native review; wording pending legal review.
FIXED_STARTERS["verify_technician"] = {
    "he": "{organization}\nקוד לאימות מספר הטלפון: {code}\nהקוד בתוקף 10 דקות. אין למסור אותו לאחרים. אם לא ביקשתם אימות, התעלמו מההודעה.\n"
          "שמך, מספר הטלפון שלך ורישומי הכניסה שלך (שעה ודלת) נשמרים לצורך אבטחת המבנה בלבד, עד שהארגון מוחק אותם. לעיון, לתיקון או למחיקה: מנהל המבנה.",
    "en": "{organization}\nPhone number verification code: {code}\nValid for 10 minutes. Do not share it. If you did not ask for this, ignore this message.\n"
          "Your name, phone number and entry records (time and door) are kept for building security only, until the organisation deletes them. "
          "To see, correct or delete them: the building manager.",
    "ar": "{organization}\nرمز التحقق من رقم الهاتف: {code}\nصالح لمدة 10 دقائق. لا تشاركه مع أحد. إذا لم تكن أنت من بادر بالتحقق، تجاهل هذه الرسالة.\n"
          "يُحفظ اسمك ورقم هاتفك وسجلّ عمليات دخولك (الوقت والباب) لأغراض أمن المبنى فقط، إلى أن تحذفها المؤسسة. "
          "للاطلاع عليها أو تصحيحها أو حذفها: مدير المبنى.",
    "ru": "{organization}\nКод подтверждения номера телефона: {code}\nДействует 10 минут. Никому его не сообщайте. Если вы не запрашивали код, проигнорируйте это сообщение.\n"
          "Ваше имя, номер телефона и данные о ваших входах (время и дверь) хранятся только для обеспечения безопасности здания "
          "до их удаления организацией. Ознакомление, исправление или удаление — через управляющего зданием.",
}
# the same plus the installation's privacy contact line (the verify_privacy last line, so that wording stays in one place); chosen when a contact is set
FIXED_STARTERS["verify_technician_contact"] = {lang: body + "\n" + FIXED_STARTERS["verify_privacy"][lang].rsplit("\n", 1)[1]
                                               for lang, body in FIXED_STARTERS["verify_technician"].items()}

# CR-INTAKE99 (owner answers 144 and 267, 2026-10-24): the two FIXED replies to a requester's WhatsApp number - code-owned, never
# editable, no free text. `intake_unlisted`: the number is not on the managed list (no draft is kept). `intake_approved`: a handler
# approved the request; the number of the new request. ar / ru are an initial translation and need a native review.
INTAKE_STARTERS: dict[str, dict[str, str]] = {}
INTAKE_STARTERS["intake_unlisted"] = {
    "he": "המספר שלך אינו רשום במערכת. כדי לפתוח פנייה יש לפנות להנהלת הבניין ולבקש שיוסיפו אותך.",
    "en": "Your number is not registered. To open a request, please ask the building management to add you.",
    "ar": "رقمك غير مسجل في النظام. يرجى التوجه إلى إدارة المبنى لإضافتك.",
    "ru": "Ваш номер не зарегистрирован. Чтобы подать обращение, попросите управляющую компанию добавить вас.",
}
INTAKE_STARTERS["intake_approved"] = {
    "he": "פנייתך התקבלה. מספר הטיפול: {number}.",
    "en": "Your request was received. Reference number: {number}.",
    "ar": "تم استلام رسالتك. رقم المتابعة: {number}.",
    "ru": "Ваше обращение принято. Номер: {number}.",
}
STARTERS["intake_reply"] = INTAKE_STARTERS["intake_unlisted"]
FIXED_VARIANTS = {"intake_reply": frozenset({"intake_unlisted", "intake_approved"}), "phone_verify": frozenset({"portal_code", "verify_privacy", "verify_technician", "verify_technician_contact"})}  # the fixed purpose each variant belongs to


def fixed_starter(purpose: str, template_id: str | None, lang: str) -> TemplateText | None:
    """The code-owned text of a FIXED purpose: its variant when the row names one ('starter:portal_code[:<lang>]'), else the purpose's
    own starter. Any other template id is ignored (a fixed purpose never renders a stored or foreign text)."""
    parts = (template_id or "").split(":")
    name = parts[1] if len(parts) >= 2 and parts[0] == "starter" else ""
    if name in FIXED_VARIANTS.get(purpose, ()):
        texts = FIXED_STARTERS.get(name) or INTAKE_STARTERS[name]  # CR-INTAKE99: the intake replies are their own purpose (below)
        lang = lang if lang in texts else DEFAULT_LANG
        return TemplateText(id=f"starter:{name}:{lang}", purpose=purpose, lang=lang, body=texts[lang])
    return starter(purpose, lang)


# TKSTAFF1 (owner 2026-10-16): the assignment message of an internal employee's no-login STAFF link (services/tickets/staff_links.py),
# chosen by the outbox row's `template_id` ('starter:<id>:<lang>') - code-owned, not editable in Settings (a staff text must keep its
# one-URL / no-quick-reply shape). `staff_assign_code` (a verification code is required - the default, R8) has NO quick-reply line:
# a reply to a code-protected link is only a note (security design 4); `staff_assign` keeps it. ar / ru need a native review.
STAFF_STARTERS: dict[str, dict[str, str]] = {
    "staff_assign_code": {
        "he": "שלום {name},\n{module_name} {number} ({department}): {title}\n{place}\nלעדכון הטיפול ללא כניסה למערכת: {link}",
        "en": "Hello {name},\n{module_name} #{number} ({department}): {title}\n{place}\nUpdate the handling without signing in: {link}",
        "ar": "مرحبًا {name}،\n{module_name} رقم {number} ({department}): {title}\n{place}\nلتحديث المعالجة دون تسجيل الدخول: {link}",
        "ru": "Здравствуйте, {name}!\n{module_name} № {number} ({department}): {title}\n{place}\nОбновить статус без входа в систему: {link}",
    },
    "staff_assign": {
        "he": "שלום {name},\n{module_name} {number} ({department}): {title}\n{place}\nלעדכון הטיפול ללא כניסה למערכת: {link}\nחובה להיכנס לקישור כדי להמשיך בטיפול.",
        "en": "Hello {name},\n{module_name} #{number} ({department}): {title}\n{place}\nUpdate the handling without signing in: {link}\nYou must open the link to continue the handling.",
        "ar": "مرحبًا {name}،\n{module_name} رقم {number} ({department}): {title}\n{place}\nلتحديث المعالجة دون تسجيل الدخول: {link}\nيجب فتح الرابط لمتابعة المعالجة.",
        "ru": "Здравствуйте, {name}!\n{module_name} № {number} ({department}): {title}\n{place}\nОбновить статус без входа в систему: {link}\nЧтобы продолжить работу, необходимо открыть ссылку.",
    },
}


def staff_template_id(require_code: bool, lang: str) -> str:
    lang = lang if lang in LANGS else DEFAULT_LANG
    return f"starter:{'staff_assign_code' if require_code else 'staff_assign'}:{lang}"


def staff_starter(name: str, lang: str) -> "TemplateText | None":
    """The staff starter `name` in `lang` (Hebrew when the language has none); its purpose is `assign` (a link purpose)."""
    texts = STAFF_STARTERS.get(name)
    if not texts:
        return None
    lang = lang if lang in texts else DEFAULT_LANG
    return TemplateText(id=f"starter:{name}:{lang}", purpose="assign", lang=lang, body=texts[lang])


def staff_starter_by_id(template_id: str | None) -> "TemplateText | None":
    """'starter:staff_assign[_code]:<lang>' -> its TemplateText; anything else -> None."""
    parts = (template_id or "").split(":")
    if len(parts) != 3 or parts[0] != "starter" or parts[1] not in STAFF_STARTERS:
        return None
    return staff_starter(parts[1], parts[2])


# CR-AWARD-NOTICE (owner request 2026-10-17): the award notice - a code-owned VARIANT of the `rfq_update` purpose (an RFQ link message:
# the existing purpose, its send-hours rules, its link handling), chosen by the outbox row's `template_id`
# ('starter:rfq_award_notice:<lang>'). Never editable in Settings and never a stored template: the binding / advance-notice wording is the
# organisation's commitment text, not a free text. No amount, no date, no phone. ar / ru: developer translations pending a native review.
AWARD_NOTICE = "rfq_award_notice"
CODE_VARIANTS: dict[str, tuple[str, dict[str, str]]] = {
    AWARD_NOTICE: ("rfq_update", {
        "he": "ההצעה שלכם ל\"{title}\" (מס' {number}) אושרה, והיא מחייבת מעכשיו.\nאם תצטרכו לדחות את העבודה, חובה להודיע על כך מראש דרך הקישור: {link}\n{organization}",
        "en": "Your quote for \"{title}\" (no. {number}) was approved and is now binding.\nIf you need to postpone the work, you must notify us in advance through the link: {link}\n{organization}",
        "ar": "تمت الموافقة على عرض السعر الخاص بكم لـ\"{title}\" (رقم {number})، وأصبح ملزمًا من الآن.\nإذا احتجتم إلى تأجيل العمل، يجب إبلاغنا بذلك مسبقًا عبر الرابط: {link}\n{organization}",
        "ru": "Ваше предложение по «{title}» (№ {number}) утверждено и с этого момента является обязательным.\nЕсли вам нужно перенести работы, вы обязаны заранее сообщить об этом по ссылке: {link}\n{organization}",
    }),
}

# PHYSENTRY070-295 (owner decision GRANTS3 Q3 / 2026-10-21): the vendor notice when the manager cancels the arrival step ("physical entry
# required") of an assignment - a code-owned VARIANT of the `update` purpose (a link message: send-hours rules and link handling of that
# purpose), chosen by the outbox row's `template_id`. Never editable and never a stored template. ar / ru: developer translations pending a native review.
ARRIVAL_CANCELLED = "arrival_cancelled"
CODE_VARIANTS[ARRIVAL_CANCELLED] = ("update", {
    "he": "עדכון: {module_name} {number} ({department}): בקשת הכניסה לאתר בוטלה. אין להגיע לפי הבקשה הקודמת.\nלעדכון הטיפול: {link}",
    "en": "Update: {module_name} #{number} ({department}): the site entry request was cancelled. Please do not arrive on the earlier request.\nUpdate the handling: {link}",
    "ar": "تحديث: {module_name} رقم {number} ({department}): لم يعد طلب الدخول إلى الموقع مطلوبًا، يرجى عدم الحضور بناءً على طلب سابق.\nلتحديث المعالجة: {link}",
    "ru": "Обновление: {module_name} № {number} ({department}): запрос на доступ на объект больше не нужен, не приезжайте по прежнему запросу.\nОбновить статус: {link}",
})


def variant_template_id(name: str, lang: str) -> str:
    texts = CODE_VARIANTS[name][1]
    return f"starter:{name}:{lang if lang in texts else DEFAULT_LANG}"


def variant_by_id(template_id: str | None, purpose: str | None = None) -> "TemplateText | None":
    """'starter:<variant>:<lang>' of a code-owned variant -> its TemplateText (only for the purpose it belongs to); anything else -> None."""
    parts = (template_id or "").split(":")
    if len(parts) != 3 or parts[0] != "starter" or parts[1] not in CODE_VARIANTS:
        return None
    own, texts = CODE_VARIANTS[parts[1]]
    if purpose is not None and purpose != own:
        return None
    lang = parts[2] if parts[2] in texts else DEFAULT_LANG
    return TemplateText(id=f"starter:{parts[1]}:{lang}", purpose=own, lang=lang, body=texts[lang])


class TemplateError(ValueError):
    """`code` is a stable word; the message never carries a value."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class TemplateText:
    """One stored template (`ticket_templates kind='message'`), or a starter (`id` = 'starter:<purpose>:<lang>', no revision)."""

    id: str
    purpose: str
    lang: str
    body: str = field(repr=False)
    department_id: str | None = None
    revision: int | None = None
    active: bool = True

    @property
    def is_starter(self) -> bool:
        return self.id.startswith("starter:")


def starter(purpose: str, lang: str) -> TemplateText | None:
    texts = STARTERS.get(purpose)
    if not texts:
        return None
    lang = lang if lang in texts else DEFAULT_LANG
    return TemplateText(id=f"starter:{purpose}:{lang}", purpose=purpose, lang=lang, body=texts[lang])


def choose(candidates: Iterable[TemplateText], *, purpose: str, lang: str, department_id: str | None) -> TemplateText | None:
    """D26: the contact's language first, then Hebrew. Within a language: the department's template, then the installation's, then
    the starter of that language (the spec's starters ship in he / en / ar / ru as templates of their own, 9.7 - slice 5b reading:
    an Arabic-speaking vendor gets the Arabic starter rather than an administrator's Hebrew text). Hebrew is the fallback only for a
    purpose without a starter in the contact's language (the cost notices of slice 9)."""
    lang = lang if lang in LANGS else DEFAULT_LANG
    live = [t for t in candidates if t.active and t.purpose == purpose]
    order = [lang] if lang == DEFAULT_LANG else [lang, DEFAULT_LANG]
    for want in order:
        for dept in ((department_id, None) if department_id else (None,)):
            for t in live:
                if t.lang == want and t.department_id == dept:
                    return t
        own = STARTERS.get(purpose, {})
        if want in own:
            return starter(purpose, want)
    return starter(purpose, lang)


# ---------------------------------------------------------------- module name (D33)

def names_for(display_name: Mapping[str, Any] | None, lang: str) -> dict[str, str]:
    """The module's noun forms and gender in `lang`, falling back field by field to the defaults of that language."""
    lang = lang if lang in LANGS else DEFAULT_LANG
    base = dict(DEFAULT_DISPLAY_NAME[lang])
    doc = display_name.get(lang) if isinstance(display_name, Mapping) else None
    if isinstance(doc, Mapping):
        for key in ("one", "many"):
            value = one_line(doc.get(key), VALUE_MAX["module_name"]).replace("{", "").replace("}", "")
            if value:
                base[key] = value
        if doc.get("gender") in ("f", "m", "n"):
            base["gender"] = doc["gender"]
    return base


def _gender_choice(token: str, gender: str) -> str:
    forms = dict(part.split("=", 1) for part in token[2:].split("|"))
    for g in (gender, "m", "f", "n"):
        if g in forms:
            return forms[g]
    return ""


# ---------------------------------------------------------------- validation (save time)

_WORST = {k: "W" * v for k, v in VALUE_MAX.items()}


def problems(purpose: str, body: Any, *, for_contacts: bool = True) -> list[dict[str, str]]:
    """Field problems of one message template ([] = valid). Codes: purpose_unknown, empty, too_long, control_chars,
    brace_unbalanced, placeholder_unknown, gender_malformed, url_not_link, link_required, code_required, code_not_allowed,
    code_discloses."""
    out: list[dict[str, str]] = []

    def add(code: str) -> None:
        if not any(p["code"] == code for p in out):
            out.append({"code": code, "field": "body"})

    if purpose not in PURPOSES:
        return [{"code": "purpose_unknown", "field": "purpose"}]
    if not isinstance(body, str) or not body.strip():
        return [{"code": "empty", "field": "body"}]
    if len(body) > BODY_MAX:
        add("too_long")
    if any(unicodedata.category(ch) in ("Cc", "Cf", "Zl", "Zp") for ch in body.replace("\r\n", "\n") if ch != "\n"):
        add("control_chars")
    if body.count("{") != body.count("}") or "{" in _TOKEN.sub("", body) or "}" in _TOKEN.sub("", body):
        add("brace_unbalanced")
    names = []
    for m in _TOKEN.finditer(body):
        token = m.group(1)
        if token.startswith("g:"):
            if not _GENDER.match(token) or _URL.search(token):
                add("gender_malformed")
            continue
        if token not in PLACEHOLDERS:
            add("placeholder_unknown")
            continue
        names.append(token)
    if _URL.search(_TOKEN.sub("", body)):
        add("url_not_link")
    if purpose in CODE_PURPOSES:
        if "code" not in names:
            add("code_required")
        if CODE_FORBIDDEN.intersection(names):
            add("code_discloses")
    else:
        if "code" in names:
            add("code_not_allowed")
        if for_contacts and purpose in TEMPLATE_LINK_PURPOSES and "link" not in names:
            add("link_required")
    if not any(p["code"] in ("brace_unbalanced", "gender_malformed") for p in out):
        worst = render(body, _WORST, lang="he", display_name={l: {"one": "W" * 30, "many": "W" * 30} for l in LANGS},
                       secrets={"link": _WORST["link"], "code": _WORST["code"]}, check_length=False)
        if len(worst) > RENDERED_MAX:
            add("too_long")
    return out


def check_params(params: Mapping[str, Any]) -> dict[str, str]:
    """`params_json` of an outbox row: allow-listed keys only, never `{link}` / `{code}` (or anything else). Values become strings."""
    bad = [k for k in params if k not in PARAM_KEYS]
    if bad:
        raise TemplateError("param_not_allowed")
    return {k: one_line(v, VALUE_MAX[k]) for k, v in params.items()}


# ---------------------------------------------------------------- rendering (send time)

def render(body: str, params: Mapping[str, Any], *, lang: str, display_name: Mapping[str, Any] | None = None,
           secrets: Mapping[str, str] | None = None, check_length: bool = True) -> str:
    """Fill a template in ONE pass. Values are one line, Cc/Cf stripped and capped; a line that was only placeholders and renders
    empty (e.g. no place) is dropped. Raises TemplateError('too_long') when the result passes RENDERED_MAX (provably not sent)."""
    names = names_for(display_name, lang)
    values: dict[str, str] = {k: one_line(params.get(k), VALUE_MAX[k]) for k in PARAM_KEYS}
    for key in SECRET_PLACEHOLDERS:
        values[key] = one_line((secrets or {}).get(key), SECRET_MAX[key])
    values["module_name"] = names["one"]
    values["module_name_plural"] = names["many"]

    def sub(m: re.Match[str]) -> str:
        token = m.group(1)
        if token.startswith("g:") and _GENDER.match(token):
            return _gender_choice(token, names["gender"])
        value = values.get(token, "")
        if token in ("module_name", "module_name_plural") and not m.string[:m.start()].strip():
            value = value[:1].upper() + value[1:]  # a line that starts with the noun starts with a capital (en / ru)
        return value

    lines = []
    for line in strip_controls(body, multiline=True).split("\n"):
        filled = _TOKEN.sub(sub, line)
        if filled.strip() or not line.strip():
            lines.append(filled.rstrip())
        # a line that had content but rendered empty is dropped
    text = "\n".join(lines).strip()
    if check_length and len(text) > RENDERED_MAX:
        raise TemplateError("too_long")
    return text


def buttons_for(nonce: str, lang: str) -> tuple[Button, ...]:
    texts = BUTTON_TEXT.get(lang) or BUTTON_TEXT[DEFAULT_LANG]
    return tuple(Button(id=f"t:{nonce}:{action}", text=texts[action]) for action in BUTTON_ACTIONS)


RFQ_LABEL = {"he": "בקשה להצעת מחיר", "en": "Request for quotation", "ar": "عرض سعر", "ru": "Запрос предложения"}


def footer_for(params: Mapping[str, Any], *, lang: str, display_name: Mapping[str, Any] | None = None, purpose: str | None = None,
               rfq: bool = False) -> str:
    """The WhatsApp footer / e-mail subject: the module's noun and the number - or, for a request for quotation (TKRFQ1), its own
    label (an RFQ is not a ticket). `rfq`: the outbox row belongs to an RFQ (its `rfq_id`), e.g. the RFQ link's verification `code`
    (review F6, 2.6.3: RFQ-07's code must not read like ticket 7's)."""
    number = one_line(params.get('number'), VALUE_MAX['number'])
    if rfq or (purpose and purpose.startswith("rfq_")):
        return f"{RFQ_LABEL.get(lang, RFQ_LABEL[DEFAULT_LANG])} {number}".strip()
    names = names_for(display_name, lang)
    return f"{names['one']} {number}".strip()
