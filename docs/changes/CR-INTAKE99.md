# CR-INTAKE99 - free-text request intake (r099) and the requester page without an account (r098)

**Status:** PROPOSED - design only, no code (branch `pilot/INTAKE99-295`, base `origin/main` v2.12.4 @ `320e5555`).
**Board items:** r099 (free-text intake: WhatsApp message or public web form -> a STRUCTURED draft request -> human approval) and
r098 (a tenant / resident / employee page with no account: open a request and follow its status through a signed link or phone
verification).
**Everything here is OFF by default** and lives inside the tickets module (`tickets.enabled`); with the tickets module off there is no
intake, no draft queue, no requester page and no "open a request" action anywhere (owner rule 2026-10-20).
**This is a NEW PUBLIC SURFACE and a NEW ANONYMOUS WRITE PATH.** Before any switch of section 11 is turned on outside a lab it needs a
Fable public-surface review against `docs/security/TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md` (sections 1-7) and the bar set by
`private/planning/SECURITY_REVIEW_DOCLINKS_2026-10-23.md` (controls table of its section 3, preconditions P3-P5 of its section 5).
**No external AI model is required or used.** The first slice is deterministic and rule-based; a pluggable classifier interface exists
for later, and any non-local classifier needs its own change request and owner approval (section 4.9).

Precedence note: `MASTER_SPEC_HE.md` and `docs/security/` win over this record. Contradictions found while writing it are listed in
section 16, not silently resolved.

---

## 1. Goal and non-goals

### 1.1 Goal

1. A person who has no Arx account (a tenant, a resident, an employee of a tenant company, a visitor) can report a problem in his own
   words - "המעלית בבניין B תקועה בקומה 3, דחוף" - by WhatsApp to the installation's number or through a public web form.
2. Arx turns the text into a **draft** service request with suggested fields: department, category, place (site / building / floor /
   room or organisation location), urgency (the department's priority key), a title and the description. Every suggestion carries the
   phrase that produced it ("evidence") and a confidence.
3. A **handler** (holder of the new permission `tickets.intake`) sees the draft in a "draft requests" queue, corrects what is wrong,
   and approves it -> one ordinary ticket through `create.create_ticket()` (origin `inbound`). Or merges it into an existing ticket
   (a note), or rejects it (not a request / spam / duplicate). **Nothing is dispatched, assigned or notified to a vendor before a human
   approved it.**
4. The requester can follow the request without an account: a signed status link sent to him after approval, or - optionally - a
   phone-verification sign-in that lists his own requests. He sees a short, fixed set of fields, can add a note, and can say "fixed" /
   "not fixed" after the request is done.

### 1.2 Non-goals (first release of this CR)

- No automatic ticket creation, assignment, dispatch or vendor message from free text. Ever, in this CR.
- No external AI / LLM call, no cloud NLP, no model download. (A local or cloud classifier is a later CR behind section 4.9.)
- No reading of WhatsApp media (`media_url` stays never-read, review T11-3). Photos come only through the web form and the existing
  hostile-image pipeline (`image_intake.py`), and only in slice 6.
- No resident directory / tenant CRM. The requester record is the minimum needed to answer one person about his own requests.
- No voice messages, no group chats, no other languages than Hebrew in the rule set of slice 2 (English / Arabic / Russian lexicons are
  later data, not later code; the pipeline is language-tagged from the start).
- No payment, billing or cost visibility for requesters.

---

## 2. What exists and is reused (nothing duplicated)

| Need | Existing piece (path under `smplwise_vms/backend/smplwise/`) | How this CR uses it |
|---|---|---|
| WhatsApp inbound events | `services/ha_sync.py` `TICKET_EVENTS` (`whatsapp_message_received`, `whatsapp_button_pressed`); `services/tickets/inbound.py` (normalise, account filter, freshness, 24 h dedupe, sender HMAC, `unknown_sender`) | The intake hook takes over ONLY the `unknown_sender` / `no live ticket` branch on the intake account (section 3.1). Every existing rule (freshness, dedupe, no media fetch, no raw event logged) applies unchanged and BEFORE intake. |
| Trust boundary of HA events | `inbound.py` docstring: an HA event is not authenticated; inbound is ADVISORY | Intake drafts from WhatsApp are marked `sender_verified = 0` (section 6.1). |
| Text hygiene | `services/tickets/text_hygiene.py` `clean_text` / `clean_field` / `csv_cell`, `AUTO_LINKIFY = False` | Every intake text passes `clean_text` before length checks and before the extractor sees it. |
| Ticket creation | `services/tickets/create.py` `TicketSpec` / `create_ticket()` (origin already allows `inbound`; `location_id`, `place_other`) | Approval calls it as the approver. No second creation path. |
| Places | `place.py` (`Place`, `place_text`), `org_locations.py` (organisation locations), floors / zones / buildings of the plan, `ticket_categories`, `ticket_departments`, `ticket_priorities` (0079) | The extractor's lexicon is BUILT from these rows (section 4.3). |
| Public listener | `public_app.py`, `public_http.py` (edge, `ROUTES` fullmatch, headers, uniform 404, 16 in flight), `ratelimit.py` (`PublicRateGate`, `RequestCost`), `read_json()` strict models, `Idempotency` | New routes are added through `PublicDeps.extra_routers`, exactly like `public_portal.py` / `public_consent.py` / `public_documents.py`. |
| Bearer tokens | `links.py` (192-bit HMAC-derived tokens, fragment transport, `sha256` lookup, generation) | Status link token kind `s.` with its own domain separator (section 8.2). |
| Phone sign-in | `vendor_portal.py` + `public_portal.py` (`202 sent_if_registered`, background lookup, 6-digit code, 30 min absolute session cookie, uniform refusals) | The requester sign-in is the same pattern with its own cookie, scope and caps (section 8.3). |
| Codes | `codes.py`, `phone_verify.py` (derived digits, HMAC storage, single use, 5 wrong = end, send caps) | Requester codes reuse the engine; new budget lines (section 8.5). |
| Consent / notice | `public_consent.py`, `services/intercom_consent.py` (versioned notice, compare-and-set) | The web form's privacy notice version is stored with the draft (section 7.3). |
| Outbox / pacing | `outbox.py`, `messaging_accounts.py` (uses), `wa_pacing.py` (classes, budget, backoff) | Replies to requesters go through the outbox on a new use `tickets.intake` and the `ticket` pacing class. |
| Notifications | `notify_sources.py`, `notify_bridge.py`, `notify_matrix.py` | Two new sources; titles carry counts only, never the requester's text (section 10). |
| Retention | `retention.py` janitor step | Intake purge step (section 7.2). |
| Images | `image_intake.py` | Web-form photos (slice 6 only). |

---

## 3. Flows

### 3.1 Flow A - WhatsApp message to the installation's number

```
HA event whatsapp_message_received
  -> inbound.normalise / account filter / freshness / dedupe        (unchanged; stale, duplicate end here)
  -> inbound.decide: live ticket or RFQ match?  yes -> existing behaviour (advisory status / note) - intake never sees it
                                                  no  -> result unknown_sender
  -> NEW intake.accept(msg) only when ALL hold:
       intake.enabled AND intake.whatsapp AND the event's account is the account mapped to use `tickets.intake`
       AND msg_type is chat (text) AND the text is non-empty after clean_text
  -> abuse gate (section 6): sender caps, installation caps, queue cap, block list   -> refused silently (envelope row only)
  -> coalesce: an OPEN draft of the same sender_key younger than intake.coalesce_min (default 10) gets the text appended
     (at most 5 messages / 2000 characters per draft), else a new draft
  -> extractor.suggest(text, lexicon)   (pure, section 4)  -> draft row: suggestions + evidence + confidence
  -> notification source ticket.intake_new (counts only)
  -> NO reply by default (Q14 holds; intake.ack_reply is a separate switch, section 10.2)
```

The `ticket_inbound` row keeps `result = 'unknown_sender'` and `reason = 'intake'` (the column `reason` is free text: no rebuild of the
0081 CHECK), plus the new `intake_draft_id`. A button tap (`whatsapp_button_pressed`) never creates a draft.

A sender who has a live ticket keeps today's behaviour: his text is a note on that ticket, not a new draft. A sender who wants a SECOND
request while one is live writes "בקשה חדשה" (section 4.7 command words) - slice 3.

### 3.2 Flow B - public web form

```
GET  /t/                                    the existing static shell; the page reads location.hash
GET  /t/api/intake/config                   brand, notice version + text id, the fields to show, the place pickers
                                            (organisation locations and buildings/floors NAMES only - section 8.6) ; uniform 404 while off
POST /t/api/intake/submit                   {text, place_hint?, phone?, notice_version, client_request_id, hp, t}
                                            -> 202 {"code": "received", "ref": "<short display ref>"} ; never a ticket number
```

- The form is reachable at the bare root `https://<host>/request` (like `/support` of the vendor portal), only while `intake.web_form`
  is on; otherwise every intake route is the uniform 404.
- One free-text box (the point of the feature), an optional place picker (organisation location or building + floor + free text),
  an optional mobile number, the privacy notice with its version, and a submit button. No category picker in slice 4 (the extractor
  suggests; a picker would be a second, contradictory signal). Category picker is owner question Q7.
- `hp` is a honeypot field (hidden by CSS, must be empty) and `t` is the page-render time echoed back (a submit faster than 3 s or older
  than 2 h is refused as `invalid` - same answer as any malformed body). These are cheap bot filters, not security controls.
- With `intake.web_form_requires_phone` on (recommended, Q3) the submit first runs the phone-code flow of section 8.3 and the draft is
  `sender_verified = 1`; without it the draft is anonymous unless a number is typed, and a typed number is `sender_verified = 0`
  (never used to send anything until a handler approves - section 6.4).

### 3.3 Flow C - the draft queue and approval (operator app, Ingress)

Screen "בקשות ממתינות לאישור" under the tickets module (list + detail, light and dark, list/table view per the design rules).

- List: received time, channel (WhatsApp / form), verified badge, suggested department / category / place / urgency with confidence
  dots, the first line of the text, "possible duplicate" marker. Sorted urgent-first, then oldest-first.
- Detail: the full text (plain text; evidence phrases highlighted from server-computed offsets, rendered as text spans - never HTML),
  every suggested field as an editable picker pre-filled with the suggestion and showing "מזוהה לפי: '<phrase>'", the possible
  duplicates (open tickets of the same place + category in the last 7 days, and open drafts of the same sender), the requester's
  masked number (last four digits).
- Actions:
  - **אשר ופתח בקשה** - validates the edited fields, then `create_ticket(TicketSpec(origin='inbound', ...))` as the approver (the
    approver needs `tickets.create` where the ticket lies, exactly like a manual request). The draft becomes `approved` with the
    ticket id; a requester row is written (section 5.3); the requester update (section 10.2) is queued if enabled.
  - **צרף לבקשה קיימת** - the text becomes a note (`visible_external = 0`) on the chosen visible ticket; the requester row links to it.
  - **דחה** with a reason from a fixed list: `not_a_request`, `duplicate`, `spam`, `abusive`, `out_of_scope`, `test`; optional
    "block this sender for 30 days" (section 6.2).
  - **שמור טיוטה** - edits without a decision (revision-checked).
- Concurrency: compare-and-set on `revision`; two handlers approving the same draft -> the second gets 409 `draft_changed`.
- Every decision is audited (`ticket.intake.approve | merge | reject | edit`) with ids and the field keys changed - never the text or
  the number.
- A draft nobody decided expires after `intake.draft_ttl_days` (default 14) -> `expired`, purged per section 7.2; the backlog
  source (section 10.1) fires before that.

### 3.4 Flow D - the requester follows his request (r098)

Two entries, both optional and both OFF by default:

1. **Status link** (`requester_page.status_link`): after approval (or merge) the requester gets ONE WhatsApp message (or, for a form
   submission with a verified number, the same) "פנייתך התקבלה ונפתחה כבקשה מס' 1042. מעקב: https://<host>/t/#s.<token>". The page
   shows the allow-listed fields of section 8.6 and two actions: add a note, and after `done` "טופל" / "לא טופל".
2. **Phone sign-in** (`requester_page.phone_login`): at `https://<host>/my-requests` the person types his mobile; ALWAYS
   `202 sent_if_registered`; a code goes out only if that number has at least one requester row (section 8.3). After the code: a
   30-minute read-mostly session listing his own requests (open + closed within `requester_page.closed_months`, default 2), each
   opening the same status view; plus "open a new request" (the web form, pre-verified).

### 3.5 Flow E - requester status notices

Optional (`requester_page.notices`, default off): a short WhatsApp notice to the requester on `approved`, `done` and `closed` /
`cancelled` (never on assignment, never with an assignee's or vendor's name, never with internal notes). Send hours of the department,
the `ticket` pacing class, at most 3 notices per request and 10 per number per day. A "not fixed" answer from the requester never
changes the status: it puts the ticket in "waiting for the manager" (`waiting_reason = requester_not_fixed`) with a timeline row; the
manager decides on a reopen.

---

## 4. The rule-based extraction design

### 4.1 Shape

A pure module `services/tickets/intake_rules.py` (no SQL, no I/O; unit-testable message by message):

```
suggest(text: str, lexicon: Lexicon, *, lang="he") -> Suggestion
Suggestion = {department_id?, category_id?, place: {location_id? | building_id? floor_id? zone_id?, place_other},
              urgency: urgent|high|normal|low, title, description,
              fields: {name: {value, confidence: high|medium|low|none, evidence: [(start, end, rule_id)]}},
              flags: [safety, possible_multi_issue, possible_question, profanity, too_short]}
```

`Lexicon` is built per installation by `intake_lexicon.build(conn)` from the live rows (categories, departments, priorities, locations,
buildings, floors, zones) plus the configurer's synonyms (table `ticket_intake_lexicon`, section 5) plus the shipped seed lexicon
(`intake_seed_he.json`, data, reviewed like code). It is cached and rebuilt on any change of those rows (a revision counter).

### 4.2 Normalisation (before any matching; applied to text AND to every lexicon phrase, so both sides meet in one form)

1. `clean_text` (controls, bidi, zero-width removed; NFC).
2. Remove niqqud and cantillation (U+0591-U+05C7 except U+05BE maqaf, which becomes a space).
3. Fold final letters for matching only: ך->כ, ם->מ, ן->נ, ף->פ, ץ->צ (the stored text is unchanged; offsets map back to the original).
4. Geresh / gershayim and their ASCII look-alikes (`'`, `"`, U+05F3, U+05F4, U+2019, U+201D) are unified; `ק'` and `קומה` are both kept
   as tokens so the place rules can see the abbreviation.
5. Digits: Arabic-Indic and full-width digits -> ASCII; `-1`, `מינוס 1`, `מינוס אחת` -> `-1`; Hebrew number words 0-20 and
   `ראשונה/שנייה/שלישית ... עשירית` -> digits (the list is in the seed lexicon).
6. Lower-case Latin; collapse repeated letters beyond 2 (`דחוווווף` -> `דחווף` -> matched by the fuzzy rule 4.4.4); collapse
   repeated punctuation, but COUNT `!` runs (urgency signal 4.6).
7. Tokenise on whitespace and punctuation; keep each token's original span.
8. Prefix stripping, Hebrew only, as ALTERNATIVES (the token is tried as written first): one or two of the proclitics
   `ו ה ב ל מ ש כ` in the orders `ו?ש?(ב|ל|מ|כ|ה)?` (e.g. `ובמעלית` -> `מעלית`, `שבקומה` -> `קומה`, `מהחניון` -> `חניון`), and
   only when the remaining stem is at least 2 letters AND the stripped form is a lexicon entry. A token is never stripped to match a
   stop-list stem (4.8).

### 4.3 Lexicon sources and precedence

| Source | Example | Weight |
|---|---|---|
| The installation's own names (exact, normalised) | category "מעליות", building "בניין B", location "מרכז לוגיסטי צפון", zone "חדר 204" | 3 |
| The configurer's synonyms (`ticket_intake_lexicon`) | category "מעליות" <- "ליפט", "מעלית שירות" | 3 |
| The seed lexicon, mapped to the installation's category by DOMAIN (`ticket_categories.domains_json`) or by the configurer's one-time mapping screen | seed domain `elevator` -> the category whose domains include `elevator` | 2 |
| Generic words (seed, low) | "תקלה", "בעיה", "לא עובד" | 0 (never decide, only `too_short` / `possible_question` logic) |

A seed domain that no installation category maps to is simply unused (no suggestion), and the mapping screen lists the unmapped
domains that matched in the last 30 days (counts only), so the configurer sees what the lexicon is missing.

### 4.4 Category rules (seed lexicon, Hebrew; domain -> phrases)

Each entry is a phrase of 1-4 normalised tokens; multi-token phrases match in order with at most one unrelated token between them.

| Domain | Phrases (seed, slice 2) | Example message -> expected domain |
|---|---|---|
| `elevator` | מעלית, ליפט, מעלית תקועה, המעלית לא מגיעה, כפתור מעלית, דלת מעלית, תקוע במעלית | "המעלית בבניין B לא מגיעה לקומה 3" -> elevator |
| `plumbing` | נזילה, דליפה, טפטוף, מטפטף, סתימה, סתום, אסלה, כיור, ברז, צנרת, ביוב, הצפה, מים על הרצפה, אין מים, לחץ מים | "יש נזילה מהתקרה בשירותים בקומה 2" -> plumbing |
| `electrical` | אין חשמל, הפסקת חשמל, קצר, שקע, תקע, ממסר, לוח חשמל, נפל החשמל, ניצוצות, חוט חשוף | "אין חשמל בכל הקומה" -> electrical |
| `lighting` | נורה, נורה שרופה, תאורה, מנורה, פנס, חושך במדרגות, האור לא נדלק | "נורה שרופה בחדר המדרגות" -> lighting |
| `hvac` | מזגן, מיזוג, לא מקרר, לא מחמם, חם מאוד, קר מאוד, מפוח, אוורור, טפטוף מהמזגן | "המזגן בחדר 204 לא מקרר" -> hvac |
| `access` | דלת, מנעול, קודן, כרטיס כניסה, צ'יפ, אינטרקום, שער, מחסום, לא נפתח, ננעל, תקוע בחוץ | "הקודן בכניסה הראשית לא עובד" -> access |
| `parking` | חניה, חניון, מחסום חניון, שער חניון, רכב חוסם, תפס לי חניה | "מישהו חוסם את החניה שלי בחניון -1" -> parking |
| `cleaning` | ניקיון, לכלוך, מלוכלך, פח, פחים, אשפה, זבל, ריח רע, שפכו, כתם | "הפחים בחדר האשפה מלאים" -> cleaning |
| `pest` | ג'וקים, מקקים, עכברים, חולדה, נמלים, יתושים, הדברה | "ראינו עכבר במטבחון" -> pest |
| `safety` | ריח גז, גז, עשן, שריפה, אש, אזעקת אש, ספרינקלר, מטף, גלאי עשן, יציאת חירום חסומה | "יש ריח גז בלובי" -> safety (+ urgent, 4.6) |
| `gardening` | גינה, גינון, השקיה, ממטרות, עץ נפל, גיזום, דשא | "הממטרות לא נסגרות" -> gardening |
| `it` | אינטרנט, וויפי, wifi, רשת, מדפסת, מחשב | "אין אינטרנט בקומה 5" -> it |
| `structure` | סדק, טיח, רטיבות, עובש, תקרה נפלה, אריח, חלון שבור, זכוכית שבורה | "יש סדק בקיר בלובי" -> structure |

Scoring: per domain, sum of matched entries' weights; a multi-token phrase scores its length; an entry inside a matched longer phrase
of ANOTHER domain does not score (longest-match wins: "דלת מעלית" is elevator, not access; "טפטוף מהמזגן" is hvac, not plumbing).
Decision:

- top score >= 3 and top >= 2 x second -> confidence `high`;
- top score >= 2 and top > second -> `medium`;
- a tie or top < 2 -> `low` with the two candidates shown, the field left EMPTY (the handler picks). An empty field is always better
  than a confident wrong one.
- two domains each >= 3 and neither 2x the other -> flag `possible_multi_issue` ("המזגן לא עובד וגם יש נזילה") - the handler may split
  the draft into two (slice 3 "פצל").

Department: the category's department. With no category, the department of the place's default (CR-ORG-LOCATIONS per-department
default is NOT used - it maps department -> location, not the reverse); else the installation's intake default department
(`intake.default_department`, required while intake is on).

### 4.5 Place rules (Hebrew)

Matched against the installation's own place names first (weight 3), then the patterns below, which only produce a place when a real
row of the installation matches the extracted number / name; otherwise the matched phrase goes to `place_other` (free text) so it is
not lost.

| Rule id | Pattern (normalised tokens) | Example -> result |
|---|---|---|
| `P-floor-num` | `(קומה|קומת|ק') <n>` , `ב?קומה ה?<ordinal>` , `<n> קומה` | "בקומה 3" / "ק' 3" / "בקומה השלישית" -> floor 3 of the building in scope |
| `P-floor-ground` | `קומת קרקע`, `קרקע`, `קומה 0`, `לובי`, `מבואה` | "בלובי" -> ground floor (and the zone named לובי if any) |
| `P-floor-neg` | `(מינוס|-)<n>`, `מרתף`, `חניון <n>` with n<0 | "בחניון -1" -> floor -1 (+ parking zone) |
| `P-roof` | `גג`, `על הגג`, `קומת גג` | "דליפה מהגג" -> roof floor if it exists |
| `P-building` | `בניין <letter|n|name>`, `מבנה <x>`, `אגף <x>`, `בית <n>` | "בניין B" / "אגף צפוני" -> building row by name or label |
| `P-room` | `(חדר|משרד|דירה|יחידה) <n>` | "חדר 204" -> the zone named "204"/"חדר 204"; "דירה 12" -> zone or place_other |
| `P-named` | an installation zone / location name, longest match | "חדר ישיבות גדול", "מטבחון קומה 2" -> that zone |
| `P-stairs` | `חדר מדרגות`, `מדרגות` (+ optional floor) | "חושך במדרגות בקומה 4" -> stairwell zone of floor 4 |

Disambiguation:

- A floor number with no building, on a site with several buildings: the floor stays a suggestion only if exactly one building has
  that floor; otherwise `place.confidence = low` and the handler picks the building.
- `P-room` numbers are matched to zones ONLY by the zone's own name; Arx never infers "204 = floor 2".
- A number that is also a phone-number fragment, a time (`10:30`), a date (`3/11`) or a price (`₪`, `ש"ח`) is not a floor or room.
- A verified requester with exactly one past approved request whose place was confirmed may get that place as a `low` suggestion
  ("ייתכן: כמו בפנייה הקודמת") - never higher, never without the evidence label. Slice 3, Q8.

### 4.6 Urgency rules

The output is a priority KEY (`urgent | high | normal | low`) of the chosen department; default `normal`. The category's
`default_priority_id` is the base; the rules below raise or lower it.

**Safety triggers -> `urgent` + flag `safety` (the queue shows these first and the `ticket.intake_new` notification is sent at the
department's urgent severity):**

| Rule id | Phrases | Note |
|---|---|---|
| `U-gas` | ריח גז, דליפת גז, מריח גז | the token `גז` ALONE is only `high` (4.8: "גזם", "גזרה" never match - whole-token rule) |
| `U-fire` | שריפה, שרפה, אש, עשן, יש עשן, בוער, נשרף, אזעקת אש | `אש` only as a whole token after prefix stripping; `אשפה` never matches (stop-list) |
| `U-trapped` | תקוע/תקועה/תקועים במעלית, נתקע במעלית, ננעל במעלית, אנשים במעלית | elevator + person inside |
| `U-flood` | הצפה, מוצף, מים זורמים, פיצוץ צינור, צינור התפוצץ | |
| `U-electric` | ניצוצות, חוט חשוף, מכת חשמל, התחשמל, ריח שרוף מהלוח | |
| `U-medical` | פצוע, נפל ונפגע, איבד הכרה, אמבולנס, מד"א | also flag `emergency_services`: the draft detail shows "במקרה חירום חייגו 101 / 102 / 100" - Arx is not an emergency service |
| `U-security` | פריצה, פורץ, חשוד, אלימות | + `emergency_services` flag (100) |

**Raise to `high`:** דחוף, בדחיפות, מיידי, מהר, בהקדם, עכשיו, כבר שעה, כבר יומיים, `!!!` (three or more), all-Latin caps words
"URGENT/ASAP". At most one step up from the base (normal -> high); only the safety rules reach `urgent`.

**Lower to `low`:** לא דחוף, כשיש זמן, כשנוח, בהזדמנות, לא בוער ("לא בוער" is the idiom "not urgent" and is a whole-phrase entry
that wins over `U-fire` by longest match - test case).

**Negation:** a safety trigger preceded within two tokens by `אין`, `לא`, `בלי`, `כבר לא`, `נגמר`, `הפסיק`, `סודר` is NOT a trigger
("אין ריח גז יותר", "כבר לא מטפטף") - but the draft is still flagged `safety_negated` so the handler sees why urgency was not raised.
Negation never applies to the symptom phrases that contain the negation themselves (`אין חשמל`, `אין מים`, `לא נפתח`), which are
listed as whole phrases.

**Safety bias (asymmetric costs):** a missed urgent is worse than a false urgent. The acceptance gate of section 13.2 therefore
requires a higher recall for `urgent` than precision. A handler always confirms; a false `urgent` costs one click.

### 4.7 Title, description, command words

- Title: the first sentence (up to `.`, `?`, `!`, or a line break), cleaned, cut at a word boundary to `model.TITLE_MAX` (120); if
  shorter than 8 characters: `<category name> - <place_text>`; if neither, "פנייה ללא נושא".
- Description: the whole cleaned text (all coalesced messages, each prefixed by its time), cut to `model.DESCRIPTION_MAX` (4000).
- Command words (slice 3, WhatsApp only, the whole message must be the command): `בקשה חדשה` (start a new draft even with a live
  ticket), `ביטול` (withdraws the sender's newest OPEN draft - never a ticket), `סטטוס` (with `requester_page.status_link` on: re-send
  the status link of his newest live request, within the send caps). No other commands. Unknown single words are text.

### 4.8 Confusion and false-positive plan

1. **Whole-token matching after prefix stripping** - never substring matching. Stop-list of stems that must not be produced by
   stripping or that look like triggers: `אשפה` (not `אש`), `אשר`, `אשמה`, `גזם`, `גזרה`, `גזבר`, `חשמלאי` (a person, not a fault:
   domain `electrical` weight 1, no urgency), `מעליתן`, `פחד` (not `פח`), `פחית`, `ברזל` (not `ברז`), `דלתות` handled as plural of
   `דלת`, `מים` alone weight 1 (it appears in "מים חמים", "מי שתייה", "שם המשפחה מימון").
2. **Longest match wins** across domains ("דלת מעלית", "שער חניון", "טפטוף מהמזגן", "לא בוער", "ריח שרוף מהלוח").
3. **Known confusable pairs** are fixture cases with the expected answer, and every new confusable reported by a handler becomes one:

   | Message | Trap | Expected |
   |---|---|---|
   | "הפח ליד המעלית מלא" | elevator vs cleaning | cleaning (place hint: near the elevator); elevator scores 1 (a place word here) - rule: a domain word inside `ליד <x>` / `מול <x>` / `ב<x>` after a stronger domain is a PLACE hint, weight 0 for the domain |
   | "אין מים חמים במטבחון" | plumbing vs hvac (boiler) | plumbing medium; seed entry `מים חמים` -> domain `plumbing` (boiler lives under plumbing unless the installation maps `water_heater`) |
   | "החשמלאי לא הגיע" | electrical fault vs complaint about a visit | electrical low + flag `possible_followup` (a complaint about an existing visit -> "attach to existing" is suggested first) |
   | "לא בוער, כשיש זמן להחליף נורה" | fire | lighting, low |
   | "האש בגריל בחצר לא נכבית" | fire | urgent (deliberately: false urgent accepted) |
   | "מישהו השאיר רכב ליד שער החניון והשער לא נסגר" | parking vs access | parking (longest phrase `שער חניון`) |
   | "קומה 3 חדר 3" | floor vs room numbers | floor 3, zone named "3" of floor 3 only if it exists, else place_other "חדר 3" |
   | "התקשרתי ב-10:30 על המזגן בחדר 204" | time as a number | hvac, zone 204, no floor 10 |
   | "תודה רבה!!!" | `!!!` | flag `possible_question`/`not_a_request` (gratitude lexicon), urgency unchanged; queue sorts it last |
   | "מתי מגיע הטכנאי?" | question | flag `possible_followup` |
4. **Abstain over guess.** Every field has an explicit `none` confidence and is left empty below `medium`.
5. **Feedback loop without text.** On approval, `ticket_intake_feedback` records per field: suggested value id, final value id,
   confidence, rule ids that fired. A weekly counter view (configurer, counts only) lists the rules most often overridden and the
   suggestions most often left empty-then-filled, so the configurer adds synonyms. No text is kept for this purpose.
6. **Regression corpus** in `tests/fixtures/intake_he/` (synthetic messages only - never real tenant messages; real examples from the
   lab are rewritten by hand before they enter the repository, the private-evidence rule).

### 4.9 The pluggable classifier interface (for later; not wired to any provider in this CR)

```python
class IntakeClassifier(Protocol):
    name: str                 # "rules" (built in), later e.g. "local_model"
    def suggest(self, text: str, lexicon: LexiconView, *, lang: str, deadline_s: float) -> Suggestion: ...
```

Rules for every implementation (enforced by the caller, not trusted to the classifier):

- Input: the cleaned text and a `LexiconView` (ids and names of categories / places / priorities). Never the phone number, the sender
  key, the requester's other requests, or any ticket data.
- Output is validated: every id must exist in the view; anything else is dropped; free text from a classifier may only fill `title`
  (re-cleaned, length-capped) - it can never become an action, a recipient, a URL or a status. A classifier answer is a SUGGESTION
  with the same confidence scale, shown with the label of its source, and the rule classifier's evidence is always shown next to it.
- `deadline_s` default 2 s; a timeout or an exception -> the rule suggestion stands (fail to rules, never to "no draft").
- Prompt injection: a later model classifier would read attacker-controlled text. The output validation above is the control; the
  approval step is the second. That is why the interface returns ids only.
- Setting `intake.classifier` = `rules` (default) | `off` (no suggestions, empty draft fields). Any other value needs its own change
  request covering where the text goes (a non-local classifier sends tenant text outside the installation - a privacy notice change and
  owner approval), cost, and a review. Not part of this CR.

---

## 5. Data model

### 5.1 Draft states

`open` -> `approved` | `merged` | `rejected` | `withdrawn` (the sender's `ביטול`) | `expired`. Final states are immutable except for the
retention purge. `open` drafts are edited with revision compare-and-set.

### 5.2 Migration (PROVISIONAL `0170_ticket_intake.sql`, one file, additive; renumbered at integration per the migration rule)

```sql
-- CR-INTAKE99: free-text intake drafts, requester records, requester page sessions, intake lexicon, feedback counters.
-- Nothing here is read while tickets.enabled or intake.enabled is off.

CREATE TABLE ticket_intake_drafts (
  id                TEXT PRIMARY KEY,
  channel           TEXT NOT NULL CHECK (channel IN ('whatsapp', 'web')),
  state             TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','approved','merged','rejected','withdrawn','expired')),
  revision          INTEGER NOT NULL DEFAULT 1,
  received_at       TEXT NOT NULL,
  last_message_at   TEXT NOT NULL,
  message_count     INTEGER NOT NULL DEFAULT 1 CHECK (message_count BETWEEN 1 AND 5),
  text              TEXT,                    -- cleaned, <= 2000; NULLed by the purge (7.2)
  sender_key        TEXT,                    -- HMAC(k_tickets, digits) or NULL (anonymous form, @lid sender)
  phone_enc         TEXT,                    -- the reply address, sealed with the module key (7.1); NULL when none / purged
  sender_verified   INTEGER NOT NULL DEFAULT 0,  -- 1 only after a requester code on the web form
  account_key       TEXT,                    -- WhatsApp: the intake account key
  net_key           TEXT,                    -- web: HMAC of the client /24 or /64 (abuse counting only; purged with the text)
  lang              TEXT NOT NULL DEFAULT 'he',
  notice_version    TEXT,                    -- web: the privacy notice version the person saw
  suggestion_json   TEXT NOT NULL DEFAULT '{}',  -- the extractor's output (ids, confidence, evidence offsets, rule ids, flags)
  edited_json       TEXT NOT NULL DEFAULT '{}',  -- the handler's working values
  urgency_key       TEXT,                    -- denormalised for sorting
  flags             TEXT NOT NULL DEFAULT '[]',
  decided_by        TEXT, decided_at TEXT,
  reject_reason     TEXT CHECK (reject_reason IS NULL OR reject_reason IN
                      ('not_a_request','duplicate','spam','abusive','out_of_scope','test')),
  ticket_id         TEXT,                    -- approved / merged
  client_request_id TEXT                     -- web idempotency
);
CREATE INDEX idx_intake_open ON ticket_intake_drafts (state, urgency_key, received_at) WHERE state = 'open';
CREATE INDEX idx_intake_sender ON ticket_intake_drafts (sender_key, received_at) WHERE sender_key IS NOT NULL;
CREATE UNIQUE INDEX idx_intake_client_req ON ticket_intake_drafts (client_request_id) WHERE client_request_id IS NOT NULL;

CREATE TABLE ticket_requesters (             -- one row per (ticket, person who asked)
  id              TEXT PRIMARY KEY,
  ticket_id       TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  draft_id        TEXT REFERENCES ticket_intake_drafts(id) ON DELETE SET NULL,
  phone_key       TEXT,                      -- HMAC match index (phone sign-in)
  phone_enc       TEXT,                      -- sealed reply address
  lang            TEXT NOT NULL DEFAULT 'he',
  link_generation INTEGER NOT NULL DEFAULT 1,
  link_key_id     TEXT,                      -- module key id that derives the status token
  token_hash      TEXT UNIQUE,               -- sha256(status token) - the one indexed lookup
  link_expires_at TEXT,
  notices_sent    INTEGER NOT NULL DEFAULT 0,
  verdict         TEXT CHECK (verdict IS NULL OR verdict IN ('fixed','not_fixed')),
  verdict_at      TEXT,
  created_at      TEXT NOT NULL,
  erased_at       TEXT
);
CREATE INDEX idx_requesters_phone ON ticket_requesters (phone_key) WHERE phone_key IS NOT NULL AND erased_at IS NULL;

CREATE TABLE ticket_requester_sessions (     -- phone sign-in sessions (sha256 only), 30 min absolute
  id_hash     TEXT PRIMARY KEY,
  phone_key   TEXT NOT NULL,
  net_key     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE TABLE ticket_requester_codes (        -- codes.py pattern: HMAC only, derived digits, single use
  id          TEXT PRIMARY KEY,               -- 128-bit, the derivation input
  phone_key   TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  key_id      TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('signin','form')),
  created_at  TEXT NOT NULL, expires_at TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0, consumed_at TEXT, outbox_id TEXT
);
CREATE INDEX idx_requester_codes_phone ON ticket_requester_codes (phone_key, created_at);

CREATE TABLE ticket_intake_lexicon (         -- configurer synonyms
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('category','place','urgency','stop','domain_map')),
  target_id   TEXT,                           -- category / location / zone / building id, or a priority key, or a seed domain
  phrase      TEXT NOT NULL,                  -- as typed (<= 60, clean_field, no URL)
  norm        TEXT NOT NULL,                  -- normalised form (4.2)
  lang        TEXT NOT NULL DEFAULT 'he',
  created_by  TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE (kind, norm, lang, target_id)
);

CREATE TABLE ticket_intake_feedback (        -- counts material only; no text, no number
  draft_id    TEXT NOT NULL, field TEXT NOT NULL,
  suggested   TEXT, final TEXT, confidence TEXT, rules TEXT NOT NULL DEFAULT '[]', at TEXT NOT NULL,
  PRIMARY KEY (draft_id, field)
);

CREATE TABLE ticket_intake_blocks (          -- 30-day sender blocks by a handler
  sender_key  TEXT PRIMARY KEY, until TEXT NOT NULL, by_user TEXT NOT NULL, at TEXT NOT NULL
);

ALTER TABLE ticket_inbound ADD COLUMN intake_draft_id TEXT;
```

Plus, in the same file, the `ticket_outbox` rebuild (the 0089 / 0128 pattern: new table, copy, swap, indexes) to add the purposes
`intake_ack`, `requester_update` and `requester_code` to its `purpose` CHECK, and `channel.PURPOSES` / `message_templates.FIXED_PURPOSES`
in code. The rebuild is the one non-additive step; it is needed only from slice 5 on, but the migration stays one file per the rule.
Integration note: other open branches may also rebuild `ticket_outbox`; the integrator orders them and folds the purpose lists.

`backup.SETTINGS_KEEP` gains the intake settings block; the lexicon table is in the project backup; drafts, requesters, sessions and
codes are NOT in the project backup (personal data with short retention; a restore loses open drafts - accepted, Q10).

---

## 6. Spam and abuse

### 6.1 Unknown senders and spoofing (WhatsApp)

- Trust boundary (inherited): any HA administrator, automation or script can fire `whatsapp_message_received` with any number. An
  intake draft from WhatsApp is therefore `sender_verified = 0`, shown with "שולח לא מאומת". It can never be approved into anything
  other than a `new` ticket, and nothing is ever SENT to its number until a handler approved the draft (6.4).
- `intake.whatsapp_senders`: `any` (default when WhatsApp intake is on; the point is people without accounts) | `known` (only numbers
  that match a directory contact / requester row; everything else is refused silently). Q4.
- WhatsApp itself identifies the sender's number; Arx does not trust that more than the HA event allows (above).

### 6.2 Caps (checked before the extractor runs; the cheap checks first)

| Cap | Default | Bound | On hit |
|---|---|---|---|
| Messages per sender per 10 min (coalesced into one draft) | 5 | 1-10 | more text is dropped; the draft gets flag `truncated` |
| New drafts per sender per day / per week | 5 / 15 | 1-20 / 1-50 | refused silently (envelope row, `reason = intake_cap`) |
| New drafts per installation per hour / per day | 60 / 300 | 10-200 / 50-1000 | refused + `ticket.intake_flood` notification once per hour |
| Open drafts in the queue | 500 | 50-2000 | new drafts refused + `ticket.intake_flood` (never drop an older draft) |
| Text per message / per draft | 1000 / 2000 chars after cleaning | fixed | truncated, flag `truncated` |
| Web submits per client network per hour / per day | 5 / 20 | 1-20 / 5-100 | 429 `rate_limited` (the edge) |
| Web submits per installation per hour | 60 | 10-300 | 429 for everyone + notification |
| Handler block list | 30 days per sender_key | 1-90 | refused silently |

Counting rule: a refused message never creates a draft row, never reaches the extractor and never notifies anyone (only the envelope
in `ticket_inbound`, which keeps no content for `unknown_sender`). The web edge uses `PublicRateGate` with a new kind `intake_write`
whose budget is SPENT only once a draft row was stored (`RequestCost.effect`).

### 6.3 Attachments policy

- WhatsApp: media is NEVER read (`media_url` never fetched, the existing rule). A media message with a caption -> the caption is text;
  the draft gets flag `has_media` and the detail says "הפונה שלח קובץ שלא נשמר - בקשו ממנו לצרף תמונה בטופס". No media message
  ever creates a draft by itself (an empty caption -> ignored).
- Web form: no file in slices 4-5. Slice 6 adds up to 3 photos through `image_intake.py` (JPEG/PNG by magic bytes, metadata stripped,
  re-encoded, 8 MiB each, the storage cap checked before the body is read), only for `sender_verified = 1` submissions (Q6), stored
  as draft attachments and moved to the ticket on approval; purged with a rejected draft.
- No other file types, ever, on this surface.

### 6.4 Nothing goes out before a human

The intake path itself sends nothing. The only outbound messages are those of section 10.2, and each of them requires an APPROVED
draft (or a verified web submission for the receipt, if Q2 = b). This removes the "spam relay" lever: a forged HA event or a form
with a stranger's number cannot make Arx message that stranger.

### 6.5 Injection of text into the UI and elsewhere

- `clean_text` before storage (bidi overrides, zero-width, controls, zalgo), NFC.
- Rendering: Lit text bindings / `textContent` only; no `unsafeHTML`, no Markdown, **no auto-linkify** (`AUTO_LINKIFY = False`): a URL
  in a tenant message is plain text on the handler's screen (phishing lever, review T9-2). Evidence highlighting is built from
  server offsets into text nodes; the client never builds HTML from the text.
- Notifications: the requester's text never enters a push / e-mail / WhatsApp notification title or body (counts, department, urgency
  only - the TKNOTIFMATRIX rule).
- Title derived from text: the same hygiene; it is shown everywhere a ticket title is shown, which already treats titles as hostile.
- CSV export of drafts (configurer, slice 3): `csv_cell` on every text cell.
- The handler's approval form submits ids from pickers; the text fields are the cleaned text, re-cleaned on save.
- Classifier injection: section 4.9.

---

## 7. Privacy

### 7.1 Phone numbers

- Stored for two purposes only: matching (`phone_key` / `sender_key` = HMAC under the module key, the existing scheme) and replying
  (`phone_enc`: the digits sealed with the module key - AEAD under a key derived `intake|seal` from the module key, so a database file
  alone does not reveal numbers; a key rotation re-seals live rows or drops them with their links, the documents precedent).
- Shown masked (last four digits) to `tickets.intake` holders; the full number only to `tickets.configure` or to a holder of
  `tickets.external` managing the ticket's department (the contacts D25 rule). Never in an audit row, a log line, an exception,
  a notification, an export of drafts or a URL.
- The requester is NOT added to the contact directory automatically. "Add to directory" is an explicit configurer action (slice 7, Q9).

### 7.2 Retention (janitor step in `retention.py`, hourly)

| Data | Kept | Then |
|---|---|---|
| Rejected / withdrawn / expired draft | 7 days (`intake.rejected_keep_days`, 1-30) | text, phone_enc, net_key NULLed; row kept 90 days for counts, then deleted |
| Approved / merged draft | 30 days | text, phone_enc NULLed (the text now lives in the ticket); row deleted at 90 days |
| Open draft | until decided or `draft_ttl_days` (14) | -> expired |
| Requester row | while the ticket is open + `requester_page.keep_after_close_days` (30, 7-180) | phone_enc, phone_key, token_hash NULLed (`erased_at`), the link dies |
| Requester sessions / codes | expiry + 24 h | deleted |
| Feedback counters | 365 days | deleted |
| `ticket_inbound` envelope | the existing rule | unchanged |

The ticket itself follows the tickets module's own retention / purge (`purge_after`) - the requester's description is part of it.

### 7.3 Notice and consent

- Web form: the privacy notice (versioned text, owner-approved wording, Hebrew first) is shown above the submit button; the version is
  stored with the draft (`notice_version`). Submitting is the act; no pre-ticked box. A version change makes old pages answer 409
  `notice_changed` (the consent-page pattern).
- WhatsApp: the person initiated the conversation; the first outbound reply (when enabled) carries one line with the notice link. No
  marketing, no other use of the number - a fixed rule in code (the number is reachable only by the intake / requester purposes).
- Requester rights: "erase me" through the requester page (slice 7) or by a configurer (`DELETE /tickets/admin/requesters/{id}`):
  phone data and link go at once; the ticket text stays under the module's retention (it is the organisation's service record) unless
  the configurer erases the description too (the contacts erase precedent). Export: the configurer can export what one requester
  wrote (drafts + requester rows of one `phone_key`).
- Legal: Israeli privacy law (Protection of Privacy Law and its 2024 amendment, in force 2025) obligations - notice content, purpose
  limitation, data-security regulations' classification of this database - are for the lawyer-bound pack
  (`legal_pack_technician_privacy_2026-10-18` precedent). This CR implements minimisation, short retention, masking and erasure; it
  does not assert legal compliance. Q11.

---

## 8. The requester page (r098) - design and threat model

### 8.1 Surfaces

All on the existing public listener (container port 18093, behind the edge), only while `tickets.enabled`, the add-on option
`tickets_public`, `requester_page.enabled` and the specific sub-switch are on; otherwise the uniform 404.

| Route | Kind (edge) | Purpose |
|---|---|---|
| `GET /t/api/intake/config` | static_read | form config (8.6 lists what it may contain) |
| `POST /t/api/intake/submit` | intake_write | Flow B |
| `POST /t/api/requester/start` | code_send | `{phone, purpose}` -> ALWAYS `202 sent_if_registered` (purpose `form`: always "sent" for a well-formed number, see 8.5) |
| `POST /t/api/requester/verify` | code_verify | `{phone, code}` -> 200 + cookie, or the ONE refusal `422 code_invalid` |
| `GET /t/api/requester/items` | session_read | his requests (allow-list) |
| `GET /t/api/requester/request` | token_read | the status view, by `X-Ticket-Token` (status link) or by session + `{item}` |
| `POST /t/api/requester/note` | token_write | `{text, client_request_id}` |
| `POST /t/api/requester/verdict` | token_write | `{verdict: fixed | not_fixed, client_request_id}` - only while status `done` |
| `POST /t/api/requester/logout` | session_write | idempotent, same answer always |

### 8.2 Status link token

- `token = base64url(HMAC-SHA256(k_tickets, "req|" + requester_id + "|" + generation))[:32]` -> 192 bits, domain-separated from
  `tkt|`, `doc|`, RFQ and consent tokens; derived, never stored; `token_hash = sha256(token)` UNIQUE, one indexed lookup.
- Transport: URL fragment `https://<host>/t/#s.<token>`; the page reads `location.hash`, calls `history.replaceState` before loading
  the chunk, sends `X-Ticket-Token`; token in memory only (no storage), like the doc mode. WhatsApp only (no e-mail copy of the
  fragment - the M-01 lesson; an e-mail channel would need the redeem form `/t/r/<rid>`, not in this CR).
- Expiry: while the ticket is open + 30 days after close/cancel (`keep_after_close_days`), hard ceiling 180 days from creation in code
  and CHECK. Revoked by: erase, a configurer's "new link" (generation + 1, slice 7 - the L-01 lesson: single-link revocation from day
  one), ticket purge, module key rotation (all links of all kinds), `requester_page.status_link` off (every link, earlier ones too,
  is the uniform 404).
- It is a bearer capability scoped to ONE request of ONE requester. Forwarding it shares that request's minimal status view.

### 8.3 Phone sign-in

- `start`: a well-formed number -> `202 {"code":"sent_if_registered"}` immediately; the lookup and the send run in a background task
  after the answer (the `public_portal.start` pattern: same bytes, same timing class for known and unknown numbers). A malformed number
  -> 422 (depends on the input only). A code is sent only when the number has a live requester row.
- `verify`: correct code -> `200` + cookie `__Host-arx_req` (HttpOnly, Secure, SameSite=Strict, Path=/t/api/requester, 30 min
  absolute, never extended); the code answers only on the client network that asked for it (review F6 of the portal). Wrong / expired /
  consumed / no code -> the same `422 code_invalid`.
- Session scope: requester rows with that `phone_key`, not erased, ticket visible to requesters (not purged). Read + note + verdict.

### 8.4 Threat model

| Threat | Control | Residual |
|---|---|---|
| Token guessing / enumeration | 192-bit HMAC token; one indexed lookup by hash; uniform 404 for every dead state (unknown, expired, revoked, erased, purged, switch off); unknown-token failures 20 / min per /24 or /64 and 300 / min installation-wide (existing `PublicRateGate`); per-token windows created only after a token proved valid | none practical |
| Request-number enumeration | the page never accepts a ticket number or draft id as an identifier; items are addressed by an opaque per-session index | none |
| Phone enumeration (is X a tenant?) | `202 sent_if_registered` for every well-formed number, background lookup, identical bytes and timing class; `form` purpose always sends (8.5) so it reveals nothing either | the person who owns the number learns a code was asked for - by design |
| Code brute force | 6 digits, 10 min, single use, 5 wrong guesses end the code; network-bound verify; malformed values and guesses with no live code are not counted (codes.py T5a rules) | ~5 / 10^6 per code |
| Message pumping / cost abuse (making Arx send codes to many numbers) | codes go only to numbers with a requester row (`signin`) or to the number of a form being submitted (`form`, capped): 1 / 60 s and 3 / day per number, 10 / day per client network, 50 / day per installation for the whole requester surface, separate from the portal and phone_verify budgets so tenants cannot starve vendors; the `ticket` pacing class of `wa_pacing` with its backoff | a determined attacker can spend the 50 / day; Arx then refuses `code_rate_limited` for everyone until the day turns and notifies managers |
| Replay of writes | `client_request_id` idempotency (`Idempotency.run`), the token / session checked before the body is read; verdict compare-and-set (one verdict per `done` cycle) | none |
| Replay of a captured link | bearer by design within its expiry; minimal view; revocation in 8.2 | a forwarded link shows status to whoever holds it (accepted, Q5) |
| Session theft | HttpOnly + Secure + SameSite=Strict, `__Host-` prefix, Path-scoped, 30 min absolute, stored as sha256, logout kills it | device compromise |
| CSRF | custom header (`X-Ticket-Token`) or SameSite=Strict cookie + JSON-only body (415 otherwise) + no CORS headers ever | none |
| Abuse of notes (harassment of staff, flooding) | 3 notes per hour, 10 per day per requester row; 1000 chars; text hygiene; a note never changes status; handler can "mute notes" on a ticket | slow drip within caps |
| Abuse of the verdict | only while `done`; `not_fixed` only flags "waiting for the manager", never reopens | none |
| Stored XSS via note / text | `clean_text`, text-only rendering on both surfaces, no linkify, CSP `default-src 'none'` on the public page (existing headers) | renderer regressions -> screen review item |
| Information leak through the view | allow-list (8.6); assignee / vendor names, internal notes, costs, other requesters, SLA, ticket internals never present; a repository test asserts the answer keys | none |
| CDN cache poisoning / cross-user cache | every requester answer `Cache-Control: private, no-store`; shared URLs differ only by header/cookie -> precondition P4 of the doclinks review (no "Cache Everything" on `/t/*` and the prefix; `cf-cache-status: DYNAMIC` check), plus `Cloudflare-CDN-Cache-Control: no-store` on these routes | deployment fact - UNKNOWN until checked live |
| Wrong client network keying | precondition P5 (`public.trusted_proxy_cidrs` matching the tunnel) | deployment fact |
| Forged WhatsApp event creates a requester row for a victim's number | requester rows exist only after a handler's approval; the approver sees "שולח לא מאומת"; a status link / notice to an unverified number needs `requester_page.notify_unverified` (default off, Q2) | an approver who approves a forged draft with notices on sends ONE status message to that number |
| Spam through the web form | 6.2 caps, honeypot / timing, optional phone requirement (Q3), queue cap, nothing auto-dispatched | handler time |
| Denial of the handler queue | queue cap + flood notification + block list + "reject all from this network" bulk action (slice 3) | a flood fills the queue up to its cap |
| Module off | edge 404 while `tickets.enabled` is off, fail-closed until the first settings read (existing) | none |

### 8.5 Why the `form` purpose always sends

To submit a verified form, the person must prove the number he types. That code must be sent whether or not the number is "known",
so this path cannot be used to test whether a number belongs to a tenant; it is the expensive path and therefore carries the tightest
caps (3 / day per number, 10 / day per network, shared 50 / day installation). With `intake.web_form_requires_phone` off it is never
used.

### 8.6 What the requester sees (allow-list, `requester_view.KEYS`)

Request number, the title, HIS OWN description (as he wrote it, after hygiene; never an edited internal version), the category NAME,
the place text (`place_text` as approved), a requester status in plain words collapsed from the ticket status
(`new`/`assigned` -> "התקבלה", `acknowledged`/`in_progress` -> "בטיפול", `waiting_part` -> "ממתין לחלק", `done` -> "טופלה - האם הבעיה
נפתרה?", `closed` -> "נסגרה", `cancelled` -> "בוטלה", `returned` -> "בטיפול"), created / last-change / closed dates, his own notes,
and timeline rows explicitly marked `visible_requester` by a handler (a new flag, default 0; slice 7). Never: assignee or vendor names,
ETA (Q12), internal notes, cost, SLA, other requesters, photos of others, the department's members, the organisation's internal
location details beyond `place_text`.

`/t/api/intake/config` exposes only: organisation name and logo (existing brand), notice version and text, the field switches, and the
names of organisation locations / buildings / floors that the configurer marked `public_pick = 1` (default none) - so the form never
publishes the building's internal map.

---

## 9. Permissions

| Action | Permission | Scope |
|---|---|---|
| See the draft queue, read drafts, edit, reject, merge, block a sender | NEW `tickets.intake` (sensitive: it reveals tenant text) | installation (drafts have no place until approved) |
| Approve a draft into a ticket | `tickets.intake` AND `tickets.create` where the ticket will lie (the approver is the creator) | the chosen place |
| Merge into an existing ticket | `tickets.intake` AND the ticket visible AND `tickets.manage` for its department | that ticket |
| See the full requester number | `tickets.configure`, or `tickets.external` + manager of the ticket's department (D25) | as contacts |
| Intake settings, lexicon, notice text, public pick list | `system.configure` (settings) / `tickets.configure` (lexicon, pick list) | installation |
| Mark a timeline row `visible_requester`, "new link", erase a requester | `tickets.manage` for the department / `tickets.configure` for erase | department / installation |

`tickets.intake` is added to `TICKET_PERMISSIONS`, granted to no role by default; the owner decides the default grant (Q1). A
department manager does not automatically see the queue - drafts are unrouted text from strangers.

---

## 10. Notifications

### 10.1 To staff (CR-018 sources; `notify_sources.SOURCE_DEFS`)

| Source | Recipients | Title / body | Default |
|---|---|---|---|
| `ticket.intake_new` | `tickets.intake` holders (new rule `intake_handlers`) | "פנייה חדשה ממתינה לאישור" + counts and the suggested urgency / department name; never text, never number | push on; urgent `safety` drafts at `critical` severity |
| `ticket.intake_backlog` | same | "N פניות ממתינות יותר מ-X שעות" (X = `intake.backlog_hours`, default 4) | on, once per X |
| `ticket.intake_flood` | `tickets.intake` + `managers` | "התקבלו פניות רבות - קליטה הוגבלה" | on, once per hour |
| `ticket.requester_not_fixed` | the ticket's managers | "הפונה דיווח שהבעיה לא נפתרה" + ticket number | on |

The digest / matrix of TKNOTIFMATRIX applies to `ticket.intake_backlog` and `ticket.requester_not_fixed`; `ticket.intake_new` with the
`safety` flag ignores the digest (urgent-immediate rule).

### 10.2 To requesters (outbox; WhatsApp only; use `tickets.intake`; pacing class `ticket`)

| Purpose | When | Text (fixed, code-owned, four languages) | Switch |
|---|---|---|---|
| `intake_ack` | after approval (default) - or on receipt (Q2) | "פנייתך התקבלה" (+ request number after approval) (+ status link if on) (+ notice line) | `intake.ack_reply` off |
| `requester_update` | approved, done, closed / cancelled | "עדכון לגבי פנייה 1042: טופלה. האם הבעיה נפתרה? <link>" | `requester_page.notices` off |
| `requester_code` | sign-in / form code | the portal-code text pattern, "we will never ask you for this code" | with the phone switches |

No template sends (no 24 h-window bypass): a reply is sent only inside the WhatsApp customer-service window that the person's own
message opened; outside it, `not_sent / window_closed` and the status link is simply not sent (the requester can still sign in).
Whether `ha-whatsapp` can tell Arx the window state is UNVERIFIED; slice 5 assumes "inside 24 h of his last message" by Arx's own
clock and treats anything else as closed. This touches the rule "no automatic replies (Q14)" - section 16, Q2.

---

## 11. Module switches (all default OFF; `tickets.settings` block `intake` / `requester_page`, `system.configure`, audited)

| Key | Default | Requires |
|---|---|---|
| `intake.enabled` | false | `tickets.enabled`; `intake.default_department` set |
| `intake.whatsapp` | false | `intake.enabled`; an account mapped to use `tickets.intake` (Q13: a separate number recommended) |
| `intake.whatsapp_senders` | `any` | - |
| `intake.web_form` | false | `intake.enabled`; add-on option `tickets_public`; public base URL probed |
| `intake.web_form_requires_phone` | true (once the web form is on) | `intake.web_form` |
| `intake.classifier` | `rules` | - (`off` = empty suggestions) |
| `intake.ack_reply` | false | `intake.whatsapp` or a verified web form |
| `intake.draft_ttl_days`, `rejected_keep_days`, `coalesce_min`, `backlog_hours`, caps of 6.2 | see tables | bounded in code |
| `requester_page.enabled` | false | `tickets_public`; `intake.enabled` |
| `requester_page.status_link` | false | `requester_page.enabled` |
| `requester_page.phone_login` | false | `requester_page.enabled` |
| `requester_page.notices` | false | `requester_page.status_link` |
| `requester_page.notify_unverified` | false | - |
| `requester_page.keep_after_close_days`, `closed_months` | 30, 2 | bounded |

Turning `intake.enabled` off: no new drafts; the queue stays readable (read-only) for `intake.draft_ttl_days` so nothing received is
lost, then expires normally. Turning `requester_page.*` off: every link and session is the uniform 404 at once (no data deleted).
Settings > service management shows a readiness list (the pattern of `readiness.py`): what is missing for each switch.

---

## 12. Operator app routes (Ingress app, `/api/v1/tickets/intake/...`; no public exposure)

`GET /drafts` (page, filters), `GET /drafts/{id}`, `PUT /drafts/{id}` (edit, revision), `POST /drafts/{id}/approve`,
`POST /drafts/{id}/merge`, `POST /drafts/{id}/reject`, `POST /drafts/{id}/split` (slice 3), `POST /senders/block` (by draft id - the
client never handles a sender key), `GET|PUT /intake/lexicon`, `GET /intake/stats` (counts), `POST /requesters/{id}/new-link`,
`DELETE /requesters/{id}`. Every route checks the module switch first, then the permission, then the body.

---

## 13. Tests plan

### 13.1 Unit (pure)

- `test_intake_normalise.py`: niqqud, final letters, geresh variants, digits (Arabic-Indic, full-width, `מינוס`), number words,
  repeated letters, offset mapping back to the original text, prefix stripping alternatives and the stop-list.
- `test_intake_rules_category.py`: every seed entry, longest-match, multi-issue flag, abstain on ties, the confusable table of 4.8
  (each row one case).
- `test_intake_rules_place.py`: every rule of 4.5 against a fixture site (two buildings, floors -1..5, named zones), time / date /
  price numbers ignored, single-building disambiguation.
- `test_intake_rules_urgency.py`: every safety trigger, negation window, `לא בוער`, the raise / lower words, one-step cap, flags.
- `test_intake_classifier_contract.py`: a fake classifier returning unknown ids, free text, a URL, a timeout, an exception -> all
  dropped / fall back to rules.

### 13.2 Corpus gate

`tests/fixtures/intake_he/corpus.jsonl` - at least 300 synthetic labelled messages (category, place, urgency) including 40 safety
cases and 60 confusables. Gate (fails the suite): urgent recall >= 0.97 on the safety subset, urgent precision >= 0.6; category
precision >= 0.85 on answered cases with coverage >= 0.6 (abstaining counts as not answered, not as wrong); place precision >= 0.9.
The numbers are recorded in the slice notes on every lexicon change.

### 13.3 Service / integration (fakes)

- Inbound routing: a live-ticket sender still gets the note path; unknown sender on the intake account -> draft; on another account ->
  unchanged `unknown_sender`; stale / duplicate never reach intake; media without caption -> nothing; `media_url` never read (spy).
- Coalescing, caps of 6.2 (each one), block list, queue cap, flood notification once per hour.
- Approval -> exactly one `create_ticket` call with origin `inbound`, the approver's permissions enforced, revision conflict 409,
  merge permissions, reject reasons, audit rows contain no text / number (grep the audit payloads).
- Retention: every row of 7.2 at its boundary.
- Module off / intake off: every route 404 / no draft / no notification; read-only queue after switch-off.
- Notifications: titles and bodies never contain draft text (assert over rendered payloads).

### 13.4 Public surface (`test_intake_public_*.py`, the `test_vendorq_294_documents.py` model)

- Uniform 404 for every dead state, byte-identical; off by default; route shapes fullmatch; HEAD/OPTIONS 404.
- `start` timing class and bytes identical for known / unknown numbers; malformed 422; code caps (each), network-bound verify, 5 wrong
  -> dead, malformed not counted.
- Token: domain separation from `tkt|` / `doc|` / RFQ / consent; only hash stored; never in logs (log capture), expiry ceiling,
  generation revocation, erase, key rotation.
- Headers on every answer: `no-store`, `Cloudflare-CDN-Cache-Control: no-store`, CSP, no CORS, cookie attributes.
- View allow-list: the answer keys are exactly `requester_view.KEYS`; assignee / vendor / internal note never present.
- Submit: honeypot / timing refusals are the same `invalid`; idempotent `client_request_id`; budget spent only on stored drafts.
- Frontend: `frontend/tests/unit-public-intake.spec.ts` (fragment read + replaceState before chunk load, no storage, text-only
  rendering, no linkify), handler screen unit tests (evidence spans are text nodes), Playwright demo of the queue (fixture data).

### 13.5 NOT_RUN expectations

Live WhatsApp intake on the lab account, the 24 h-window behaviour of `ha-whatsapp`, Cloudflare cache status, WhatsApp in-app browser
behaviour of the status page: NOT_RUN until a task-specific owner approval; reported as such.

---

## 14. Slices (smallest first; each its own branch, OFF by default, its own notes file)

| # | Slice | Contains | Public surface? | Depends |
|---|---|---|---|---|
| 1 | Rules engine + corpus | `intake_rules.py`, normalisation, seed lexicon JSON, `intake_lexicon.build`, corpus fixtures and the gate; no table, no route, no UI | no | - |
| 2 | Drafts from WhatsApp + queue (read / reject) | migration 0170, the inbound hook, caps / coalescing / blocks, the draft queue screen with reject + edit, `ticket.intake_new` / `backlog` / `flood`, retention step | no | 1 |
| 3 | Approve / merge / split + lexicon screen + feedback counters | approval through `create_ticket`, merge, split, command words, the configurer's synonyms and domain mapping, stats | no | 2 |
| 4 | Public web form (no photos, no replies) | `/request` root, config + submit routes, honeypot / timing, edge kind `intake_write`, notice version | YES - Fable review before switch-on | 3 |
| 5 | Requester status link + replies | requester rows, `s.` token, status view, note / verdict, `intake_ack` / `requester_update`, outbox rebuild purposes, 24 h window rule | YES - Fable review | 3 (4 optional) |
| 6 | Phone sign-in + verified form + photos | `requester/start|verify|items|logout`, codes, sessions, `form` purpose, web-form photos through `image_intake` | YES - Fable review | 4, 5 |
| 7 | Requester rights and polish | erase / export, "new link", `visible_requester` timeline flag, add-to-directory, English / Arabic / Russian lexicons (data) | partly | 5 |

Slices 1-3 deliver r099 for WhatsApp with zero new public surface; that is the recommended first release. r098 starts at slice 5.

---

## 15. Owner questions (recommendation first in each)

1. **Who gets the new permission "קליטת פניות" by default?**
   (a) nobody - the owner grants it to named users (recommended: it shows strangers' text and numbers); (b) every department manager;
   (c) administrators only.
2. **When does a WhatsApp requester get a reply?**
   (a) only after a handler approved the draft - one message with the request number (and the status link if enabled) (recommended:
   nothing is sent to a number before a human looked; keeps the "no automatic replies" rule for unreviewed text);
   (b) an automatic "received" on arrival, then the number after approval; (c) never reply.
3. **Does the web form require phone verification?**
   (a) yes, a code to the typed mobile before submit (recommended: stops most form spam and gives a reply address that was proven);
   (b) optional - anonymous submissions allowed; (c) no web form at all, WhatsApp only.
4. **Who may open a draft by WhatsApp?**
   (a) any number (recommended for tenants without accounts; caps and the block list handle abuse); (b) only numbers already known to
   Arx (directory or earlier requests).
5. **The status link is a bearer link (whoever holds it sees that one request's minimal status). Acceptable?**
   (a) yes, with the minimal view of 8.6 and expiry 30 days after close (recommended); (b) require the phone code for every view
   (no links, sign-in only); (c) links, but expiring 7 days after close.
6. **Photos from requesters?**
   (a) only on the verified web form, up to 3, through the existing safe image pipeline, in a later slice (recommended); (b) also from
   WhatsApp (would require reading media - against the current rule); (c) no photos.
7. **Category picker on the web form?**
   (a) no - free text only, the rules suggest and the handler decides (recommended: that is the feature); (b) an optional picker.
8. **Suggest the requester's previous place?**
   (a) yes, as a low-confidence hint only, verified requesters only (recommended); (b) no.
9. **Add requesters to the contact directory?**
   (a) never automatically; a configurer may add one by hand (recommended); (b) automatically after the first approved request.
10. **Drafts and requester numbers are left out of the project backup (a restore loses open drafts). Acceptable?**
    (a) yes (recommended: short-lived personal data); (b) include them.
11. **Privacy notice wording for the form and the first reply:**
    (a) the lead drafts it, it goes to the lawyer pack before any switch-on outside the lab (recommended); (b) the owner supplies it.
12. **Show the requester an expected date (ETA)?**
    (a) no in this CR - status words only (recommended: an ETA promise to a tenant is a commitment the department did not make);
    (b) yes, when the assignee set one.
13. **Which WhatsApp number receives intake?**
    (a) a separate number mapped to the new use "קליטת פניות" (recommended: tenant traffic never mixes with vendor replies, and pacing
    is per number); (b) the existing tickets number.
14. **First release scope:**
    (a) slices 1-3 (WhatsApp drafts, queue, approval - no new public surface), then decide on the public parts (recommended);
    (b) slices 1-5 together; (c) the web form first.

---

## 16. Contradictions and open points recorded (not silently resolved)

1. `inbound.py` rule "no automatic replies (Q14)" vs r099/r098 asking for a tenant to "follow its status". This CR keeps Q14 for
   unreviewed text (no reply before approval) and adds replies only after a human decision, behind switches (Q2).
2. The vendor portal treats WhatsApp numbers that a configurer set as unproven (`require_confirmed_number`); a WhatsApp intake sender
   is equally unproven (HA event trust boundary). This CR never gives an unverified sender a session or a code-free sign-in.
3. The 24 h customer-service window: whether `ha-whatsapp` reports it is UNVERIFIED; this CR assumes Arx's own clock (section 10.2).
4. The `ticket_outbox` rebuild may collide with other open branches that add purposes; the integrator folds them (section 5.2).
5. Cloudflare cache rules and the trusted proxy CIDRs (doclinks review P4 / P5) are deployment facts this CR cannot verify; they are
   preconditions for slices 4-6.
6. Board item wording says "AI"-free "turns it into a structured request"; the owner rule (approval mandatory) means the output is a
   DRAFT, never a request, until approved. Recorded as the intended reading.

---

## 17. NOT_RUN / limits of this record

Design only. No code, no migration file, no test exists yet; every test named above is a plan. Nothing was run against HA, WhatsApp,
the NVR, go2rtc or the runner while writing it. The Hebrew rule tables are a seed for slice 1 and will be tuned by the corpus gate.
