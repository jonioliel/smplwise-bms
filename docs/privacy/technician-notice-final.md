# Technician privacy notice - final wording (he / en / ar / ru)

Status: **PENDING LEGAL REVIEW.** The owner approved this wording (reported 2026-10-20) as the text to ship; counsel has not reviewed it (counsel items C2, C3, C5 in
[README.md](README.md)). Not legal advice. The feature `access.external_grants` is OFF by default. Since 2026-10-21 (owner decision, ECCACT-295)
`GO_LIVE_PERMITTED` is `True`, so a system administrator **can** switch the feature on in the settings; nothing in this document switches it on.
(Corrected 2026-10-27; the earlier text said the permit stays `False`. Re-verified against `origin/release/2241` @ `f1ef67c68`, and checked again on 2026-10-29 against `origin/main` @ `8bd92456a`: the constants, the four texts and the wiring are unchanged.)
The UI shows the texts without any status marking: this status lives in documents only.

## Where each text lives (code-owned, never editable)

| Text | Constant (`smplwise_vms/backend/smplwise/services/access_grants.py`) | Rendered by |
|---|---|---|
| Notice shown to the vendor, version `n2` | `NOTICE_TEXT` (+ `NOTICE_CONTACT`, organisation/contact substitution in `notice_text`) | arrival view `notice.text`, language from the contact (`he` fallback) |
| Vendor attestation next to the mandatory tick | `NOTICE_ATTEST` | arrival view `notice.attest` |
| Entry-code message and hours phrase | `TEMPLATES`, `HOURS_PHRASE` | `render_code_message` |
| Short notice to the technician himself (version B) | `NOTICE_SHORT` (added in PRIVTEXT-293) | the phone-number confirmation message, see "Wiring" |

Organisation name and contact (PRIVORG-291, `services/privacy_org.py`): when the installation set the tickets setting `organization_name` and/or
`privacy.contact` (optional `privacy.link`), the last sentence of `n2` names the organisation (and the contact in brackets) instead of "the building manager",
and the entry-code message starts with the organisation name instead of "SmplWise Arx" (`CODE_MESSAGE_SENDER`). When they are empty, the texts below are
shown exactly. The substitution adds no new legal wording. Visitors invited by a host (`access.visitors`, off by default) receive the same entry-code
message; there is no visitor-specific notice (README, mismatch 9; counsel item C16).

Key parity (`he`, `en`, `ar`, `ru` exactly), NFC form, no control/format characters, no link characters, and "only the language's own script" are checked by
`test_templates_are_well_formed` and `test_the_notice_texts_are_in_their_own_language_and_link_free` in `tests/test_access_grants.py`.
The notice version stays `n2`: the `NOTICE_TEXT` and `NOTICE_ATTEST` wording is unchanged by this task (the approved text is the one already shipped behind the flag).

## Notice `n2` (vendor-facing, third person)

- **he**: לצורך כניסת הטכנאי למבנה נשמרים שמו ומספר הטלפון שלו, ובכל כניסה גם השעה והדלת (ובמקומות שהדבר הופעל - גם תמונה ברגע הכניסה). המידע משמש לאבטחת המבנה ולניהול הכניסות לעבודה זו בלבד. מספר הטלפון משמש רק לאימות המספר ולמשלוח קוד הכניסה האישי בוואטסאפ. המידע נשמר עד שהארגון מוחק אותו, בהתאם למדיניות השמירה שלו. אין חובה חוקית למסור את הפרטים, אך בלעדיהם לא ניתן להנפיק קוד כניסה. לבקשת עיון, תיקון או מחיקה, או בכל שאלה, יש לפנות למנהל המבנה.
- **en**: For the technician to enter the building, the technician's name and phone number are kept, and for each entry the time and the door (and, where this is enabled, a picture taken at the moment of entry). This information is used only for building security and for managing entries for this job. The phone number is used only to confirm the number and to send the personal entry code by WhatsApp. The information is kept until the organisation deletes it, in line with its retention policy. There is no legal obligation to provide these details, but without them no entry code can be issued. To ask to see, correct or delete the information, or with any question, contact the building manager.
- **ar**: لغرض دخول الفني إلى المبنى، يُحفظ اسم الفني ورقم هاتفه، ويُسجَّل عند كل دخول وقتُه والبابُ الذي تمّ الدخول منه (وحيثما فُعِّلت هذه الخاصية، تُلتقط صورة لحظة الدخول أيضًا). تُستخدم هذه المعلومات لأغراض أمن المبنى وإدارة الدخول الخاص بهذا العمل فقط. يُستخدم رقم الهاتف فقط للتحقق منه ولإرسال رمز الدخول الشخصي عبر واتساب. تُحفظ المعلومات إلى أن تحذفها المؤسسة، وفقًا لسياسة الاحتفاظ بالبيانات المعتمدة لديها. تقديم هذه البيانات ليس واجبًا بموجب القانون، غير أنه لا يمكن إصدار رمز دخول بدونها. لطلب الاطلاع على المعلومات أو تصحيحها أو حذفها، أو لأي استفسار، يُرجى التواصل مع مدير المبنى.
- **ru**: Для допуска техника в здание сохраняются его имя и номер телефона, а при каждом входе — время и дверь (а там, где эта функция включена, — также снимок в момент входа). Эти данные используются только для обеспечения безопасности здания и учёта входов в рамках данной работы. Номер телефона используется только для его подтверждения и отправки личного кода входа через WhatsApp. Данные хранятся до их удаления организацией в соответствии с её политикой хранения данных. Предоставление этих данных не является обязательным по закону, однако без них код входа не может быть выдан. Чтобы запросить ознакомление с данными, их исправление или удаление, а также по любым вопросам, обращайтесь к управляющему зданием.

## Vendor attestation (notice, not consent)

- he: הודעתי לטכנאי על האמור לעיל.
- en: I have told the technician the above.
- ar: أبلغتُ الفني بما ورد أعلاه.
- ru: Подтверждаю: техник уведомлён мною об изложенном выше.

The optional consent clause of the legal pack is not included (decision 3, 2026-10-18).

## Short notice to the technician himself (version B, decision 2)

- he: שמך, מספר הטלפון שלך ורישומי הכניסה שלך (שעה ודלת) נשמרים לצורך אבטחת המבנה בלבד, עד שהארגון מוחק אותם. לעיון, לתיקון או למחיקה: מנהל המבנה.
- en: Your name, phone number and entry records (time and door) are kept for building security only, until the organisation deletes them. To see, correct or delete them: the building manager.
- ar: يُحفظ اسمك ورقم هاتفك وسجلّ عمليات دخولك (الوقت والباب) لأغراض أمن المبنى فقط، إلى أن تحذفها المؤسسة. للاطلاع عليها أو تصحيحها أو حذفها: مدير المبنى.
- ru: Ваше имя, номер телефона и данные о ваших входах (время и дверь) хранятся только для обеспечения безопасности здания до их удаления организацией. Ознакомление, исправление или удаление — через управляющего зданием.

## Arabic and Russian review notes

Reviewed by Claude (not a native speaker of either language); a native reader should confirm before go-live.

**Arabic** (Modern Standard Arabic, formal)
- "تُسجَّل عمليات الدخول" is used on purpose: "تسجيل الدخول" reads as "log in" in software Arabic.
- "رمز الدخول" (entry code), not "كلمة المرور" (password) and not the colloquial "كود".
- "مدير المبنى" mirrors the Hebrew "מנהל המבנה"; "إدارة المبنى" is a valid alternative if the owner prefers an office to a person.
- The code message starts with Arabic text so WhatsApp lays the whole message out right-to-left; the product name sits inside the sentence. No bidi control characters.
- Western digits and the Arabic comma and semicolon; tashkeel only where it prevents a misreading.
- Version B uses the second person singular "اسمك" (masculine/generic form, the standard in notices); a gendered alternative would need the contact's gender, which the system does not hold.

**Russian** (formal official register)
- "Справочный номер" for the reference, never "ссылка" (a link): the message must be visibly link-free.
- "код входа" (not "пароль", not "ПИН-код"); "снимок в момент входа" for the entry picture; "учёт входов" for entry logging; "ё" written for clarity.
- The attestation is worded without the vendor's gender ("техник уведомлён мною").
- Version B uses the polite plural "Ваше" (capitalised, as in official notices) and avoids gendered verb forms.
- "управляющий зданием" mirrors "מנהל המבנה"; "администрация здания" is a valid alternative.

## Wiring (PRIVTEXT-293, shipped; re-verified 2026-10-27)

`NOTICE_SHORT` reaches a technician in the phone-number confirmation message through the fixed `phone_verify` variants `verify_technician` and
`verify_technician_contact` (`services/tickets/message_templates.py`), chosen by `phone_verify._privacy_variant` only for a person for whom
`access_grants.is_technician` is true. Every other person (vendor contacts, signed-in users) gets exactly the text they got before. Details:
[technician-verification-message-spec.md](technician-verification-message-spec.md).
