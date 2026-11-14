-- TKTPLMIG (owner decision 2026-10-16): the numeric quick-reply line must not exist in ANY installation. The starter texts lost it in
-- 3c90295e; this migration rewrites the message templates an installation SAVED or customised (`ticket_templates`, kind 'message') that
-- still hold it, in all four languages: the known line (he / en / ar / ru, exact text) is replaced IN PLACE by the sentence that the link
-- must be opened. The replacement is on the substring only, so the newline before it (LF or CRLF), spaces after it and every other character
-- stay as they were; a body without the line is not selected, so a second run changes nothing (idempotent). Rows that change get
-- revision + 1, updated_at = now and updated_by 'system:migration-0092' (the same bookkeeping as an editor save). Templates have no
-- history table and no content hash. Nothing else is touched: not `ticket_outbox` (it keeps template id + revision, never the text;
-- queued or sent messages are never rewritten), not other kinds, not the code-owned starters.
-- Final number 0092 (integ/263, release 2.6.3; it was 0089 on pilot/TKTPLMIG).

UPDATE ticket_templates
   SET body = REPLACE(REPLACE(REPLACE(REPLACE(body, 'לאישור מהיר השב 1 = התקבל, 2 = בטיפול', 'חובה להיכנס לקישור כדי להמשיך בטיפול.'), 'Quick reply: 1 = received, 2 = in progress', 'You must open the link to continue the handling.'), 'للرد السريع: 1 = تم الاستلام، 2 = قيد المعالجة', 'يجب فتح الرابط لمتابعة المعالجة.'), 'Быстрый ответ: 1 = получено, 2 = в работе', 'Чтобы продолжить работу, необходимо открыть ссылку.'),
       revision = revision + 1,
       updated_by = 'system:migration-0092',
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
 WHERE kind = 'message'
   AND (instr(body, 'לאישור מהיר השב 1 = התקבל, 2 = בטיפול') > 0
    OR instr(body, 'Quick reply: 1 = received, 2 = in progress') > 0
    OR instr(body, 'للرد السريع: 1 = تم الاستلام، 2 = قيد المعالجة') > 0
    OR instr(body, 'Быстрый ответ: 1 = получено, 2 = в работе') > 0);
