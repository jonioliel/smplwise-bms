# Electricity meters and bills - mockup gallery (CR-023 P0)

Static mockups for the owner's approval of the electricity module (`docs/changes/CR-023-ELECTRICITY-METERS-BILLS.md`).
Design only: no product code, no migration, no device access. Fake data only (invented building, customers, meters and
amounts). Branch `pilot/electricity-p0`.

Open `index.html` (file:// works; or `python -m http.server` in `docs/design/` and open `/mockups/electricity/index.html`).
The top bar picks the screen, the device width (1440 / 820 / 390), light or dark, the skin (classic, domus, tesla, bubble)
and the user (with the bills permission, or view-only without money). The state is kept in the URL hash, so a link
reproduces a view, e.g. `#s=w2&d=phone&t=dark&k=bubble&p=full`. "מטריצת סקינים" shows a main screen in the four skins x
light/dark side by side.

Tokens: section 1 of `styles.css` is copied verbatim from the approved dropdown-styles mockup (itself copied from
`frontend/src/design/tokens.ts` and the four skins on 2026-10-03). Heebo comes from the Bubble taste mockup's `fonts.css`.
Five proposed module tokens (`--sw-success`, soft fills for success / warning / danger / muted) are marked "proposed"; the real
ones go into `tokens.ts` and every palette in P4. Owner rules applied inside the frames: Hebrew RTL, clean operator screens
(no hint paragraphs), no platform name (the source is "תשתית המערכת" only in the meter picker), the floors/areas tree on
the meters screen, list and table views for meters and accounts, short confirmations.

Screenshots: `docs/evidence/electricity-mockup/` (155 views), produced on the test runner by
`node docs/evidence/electricity-mockup/shots.mjs`, which also fails on page errors and on horizontal overflow of the frame.

## Built / not built

| Element | Built | Where (gallery screen) | Note / reason and plan if not built |
|---|---|---|---|
| Infrastructure area in the rail and phone dock, "חשמל" sub-tab, pages מונים / חשבונות / חיובים / לקוחות | Yes | every screen | - |
| Meters overview with tiles, area tree, table and cards, statuses (מדווח / לא מדווח / מושהה) | Yes | מונים: טבלה / כרטיסים | Phone: list + area chip instead of the tree |
| Meter card (drawer) with daily chart, counter lives (epochs), replace / pause / remove | Yes | כרטיס מונה | Replace-meter and manual-reading dialogs not drawn (actions only); P4 builds them from the CR text |
| Add meter: search by name, verdict per sensor | Yes | הוספת מונה | - |
| kWh-versus-kW validation message | Yes | הודעת קילוואט; אשף 1 חיישן קילוואט נדחה | Also the other rejection reasons in the wizard list |
| Meters loading / empty / load error | Yes | מונים: טעינה / ריק / שגיאה | - |
| Accounts list: table and cards, empty, load error | Yes | רשימת חשבונות | - |
| Account page: consumption status (period progress, forecast, amount so far, formula breakdown), customer, price, next bill | Yes | עמוד חשבון: מצב | - |
| Account page with a meter not reporting | Yes | עמוד חשבון: מונה לא מדווח | - |
| Account history (12-period chart, table with change, amount, bill) | Yes | עמוד חשבון: היסטוריה | 24-month toggle drawn, not wired |
| Account bills tab | Yes | עמוד חשבון: חיובים | - |
| Create a bill: period choice and overlap error | Yes | הפקת חיוב | "טווח אחר" date picker not drawn (standard date fields) |
| Wizard 1 - choose meters by name with search | Yes | אשף 1 | - |
| Wizard 2 - formula editor: presets, token builder, text mode, live check, errors (negative, parentheses) | Yes | אשף 2 (5 screens) | The "+ מונה" menu and the number input popover are drawn as buttons only; behaviour described in CR §6 |
| Wizard 3 - price and VAT (choose a tariff from Settings, before/including VAT, example) | Yes | אשף 3 | - |
| Wizard 4 - billing period with the next periods and their bill numbers | Yes | אשף 4 | Two-monthly variant (cycle month field) not drawn separately; only the toggle |
| Wizard 5 - customer card (new, with a field error; existing customer with several accounts and the letter suffix) | Yes | אשף 5 (2 screens) | - |
| Wizard 6 - review and generate | Yes | אשף 6 | - |
| Backfill step ("נתוני עבר" from the infrastructure statistics) | No | - | Not in the owner's step list; the plan had it as a step. Proposed as an optional line in step 6 in P4 after the owner decides (open question in the report) |
| Bill A4 preview in the conventional layout | Yes | חיוב שהונפק | Customer, period, readings start/end per meter, consumption, price, subtotal, VAT, total, number, notes, footer hash |
| Bill states: draft (watermark), issued, cancelled (watermark), corrected revision, PDF failure | Yes | חיובים (5 screens) | "Sent" and "paid" appear as chips and in the list; their bill page is the same layout |
| Bills list with status filter (טיוטה, הונפק, נשלח, שולם, בוטל) and empty state | Yes | רשימת חיובים | Month and search filters drawn, not wired |
| Dialogs: issue, cancel with required reason, correct (revision -2), mark sent, mark paid | Yes | חיובים: dialogs | - |
| Customers list and customer card | Yes | לקוחות | - |
| Settings › תשתיות › חשמל: prices (tariffs), VAT rate with history, default entry mode | Yes | מחירים ושיעור מע״מ | - |
| Edit tariff with before/including VAT and versions | Yes | עריכת תעריף | - |
| Business details, logo and numbering format, bill header preview | Yes | פרטי העסק | Accent colour picker not drawn (one colour token; P4 reuses the palette editor's picker) |
| Retention (raw 90 days, quarter-hour 26 months, bills and files 7 years, drafts) with sizes and range error | Yes | שמירת נתונים | - |
| Permission rows in Settings › users and permissions | Yes | שורות ההרשאות | - |
| View-only user (no money, no bills/customers pages, forbidden state) | Yes | toggle "צפייה בלבד" on any screen | - |
| Desktop / tablet / phone; light / dark | Yes | every screen | - |
| Skins classic, domus, tesla, bubble | Yes | every screen + skin matrix | Bubble palettes and look dials (radius, density) not modelled; tokens only |
| Real PDF output | Separate | `docs/evidence/electricity-pdf-spike/` | The A4 screen is HTML; a WeasyPrint render of the same layout is in the spike |
| Time-of-use screens, sending by email/WhatsApp, alerts, CSV export | No | - | Out of the first release by owner decision (CR §2); designed in later phases |

## Limits
- Static HTML: buttons navigate between gallery screens, inputs do not accept typing, numbers come from a fixed data set.
- The phone frame is a 390 px desktop render, not a device. The dock sits at the frame bottom.
- Not run through the product's Playwright suites; the evidence script only checks for errors and overflow.
