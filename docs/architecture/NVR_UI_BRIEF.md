# NVR camera settings - UI brief for the mockup (CR-020)

**Status:** brief, 2026-10-01. For a later mockup agent; nothing built. Data: `frontend/src/api/nvr-settings.ts`
(`nvrSettings()` returns an in-memory demo without a backend - use it for the mockup). Contract:
`NVR_SETTINGS_API.md`. Copy rules: `docs/design/UI_COPY_RULES.md`; owner rules: short confirmations, no hints, badges or
paragraphs beyond what a step needs, management lives only in Settings. Design language: the v2 tokens and the existing
settings screens (`frontend/src/screens/system-*.ts`); components `sw-page`, `sw-card`, `sw-tabs`, `sw-table`,
`sw-toggle`, `sw-dialog`, `sw-drawer`, `sw-state-panel`, `sw-button`.

## 1. Where it lives

Default (owner Q1 option א): הגדרות › אבטחה gets a fourth tab after "NVR":
`אזעקה · ניהול אזעקה · NVR · הגדרות מצלמות`, route `#/system/security/cameras`, added to `SECURITY_SETTINGS_TABS`
in `shell/nav.ts`, `TAB_PERMISSIONS['#/system/security/cameras'] = ['system.configure']`, installation-only
(`INSTALLATION_ONLY_HREFS`), hidden in NVR-less mode like the other NVR pages. The "NVR" status page gets one link row
"הגדרות מצלמות" to the new tab.
If the owner picks ב: a settings tab "NVR" (`#/system/nvr`) with `מצב · הגדרות מצלמות · יומן שינויים`; the screen
itself is the same, only the address and tab row change. Mock both tab rows; build the page once.

Settings screens may name technical things exactly (H.264, SVC, GOP, ISAPI is not shown though - say "NVR").

## 2. The table (desktop, ≥ 1024 px)

Page heading "הגדרות מצלמות", subheading = recorder name + model (`NVR ראשי · DS-7616NI-DEMO`). With more than one recorder
(later), a segmented recorder picker sits under the heading; with one, nothing.

One block per camera, one row per stream (main first). The camera cells span its stream rows.

| Column | Content | Notes |
|---|---|---|
| מצלמה | name, then `ערוץ 3` in muted text | an offline camera: a grey dot before the name; disabled in Arx: the name muted |
| זרם | `ראשי` / `משני` / `שלישי` / `נוסף` | |
| קידוד | `H.264` / `H.265` / `MJPEG` + profile in muted text (`High`) | |
| SVC | `sw-toggle` | §3; text `—` when the stream has no SVC element |
| רזולוציה | `2560×1440` | LTR inside RTL (`<bdi>`), tabular numbers |
| FPS | `25` or `מלא` | |
| קצב | `3072 kbps` + `VBR` muted | |
| GOP | `50` | |
| B-frames | `כן` / `לא` / `—` | read-only on the lab firmware (`—`) |
| Smart codec | `sw-toggle` | same behaviour as SVC |
| WebRTC | a small check or cross icon only (no word) | tooltip: `מתנגן בדפדפן` / `לא מתנגן בדפדפן` |
| (actions) | pencil icon → editor drawer | admins only |

Rules: `—` for every value the device does not report (never a guessed default). No colour coding beyond the existing
status tokens; no per-row hint text; no "recommended" badges. Sorting: by channel (fixed). A search field is not needed
under 32 cameras; above, the standard filter input of `sw-table`.

## 3. Editing

### 3.1 Toggles (SVC, smart codec)

1. Tap → the toggle does **not** move yet; `sw-dialog` opens.
2. Confirm → the toggle shows a pending state (spinner in the knob, row inputs disabled) until the server answers.
3. Success → toggle in the new position; toast `נשמר` with action `בטל` for 10 s (undo = rollback route; the undo
   itself confirms nothing more, it restores what the administrator just had).
4. Failure → toggle stays where it was; one muted line under the row with the server's `user_message` (e.g.
   `ה־NVR עסוק, נסה שוב בעוד רגע`), cleared on the next action. `stale` → the row reloads with the device's values and
   the line `הערכים השתנו ב־NVR. נטען מחדש.`
5. `reboot_required` → toast `נשמר. ה־NVR מבקש הפעלה מחדש.` with a link to the NVR page (reboot stays there).

### 3.2 Confirmation texts (Hebrew, short)

Title is the question, body is one line (two only for retention-affecting fields), buttons verb / `ביטול`.

| Change | Title | Body | Confirm button |
|---|---|---|---|
| SVC off | `לכבות SVC?` | `{מצלמה} · {זרם}. השידור ייקטע לכמה שניות.` | `כבה` |
| SVC on | `להפעיל SVC?` | `{מצלמה} · {זרם}. השידור ייקטע לכמה שניות.` | `הפעל` |
| Smart codec on / off | `להפעיל Smart codec?` / `לכבות Smart codec?` | same line | `הפעל` / `כבה` |
| Codec | `לעבור ל־{H.264}?` | `{מצלמה} · {זרם}. השידור ייקטע לכמה שניות.` + `ימי ההקלטה בדיסק עשויים להשתנות.` | `שנה` |
| Resolution / bitrate | `לשנות {רזולוציה} ל־{1920×1080}?` | same two lines | `שנה` |
| Any other field / several fields from the drawer | `לשמור את השינויים?` | `{מצלמה} · {זרם}: {שדה} {ערך}, {שדה} {ערך}.` + `השידור ייקטע לכמה שניות.` | `שמור` |
| Remove camera (S3) | `להסיר את {מצלמה} מה־NVR?` | `הקלד את שם המצלמה לאישור.` + text field | `הסר` (enabled when the name matches) |

If the owner picks Q3 ב, codec and resolution use the typed-name pattern of the removal row.

### 3.3 Editor drawer (pencil)

`sw-drawer` from the inline-end side (left in RTL), heading `{מצלמה} · {זרם}`. Fields, each a select with the
device's own options (`GET /nvr/cameras/{id}` `options`): קידוד, פרופיל, רזולוציה, FPS, סוג קצב (CBR / VBR), קצב
(kbps, number input with the device's min-max), איכות (VBR only), GOP (number), SVC, Smart codec, B-frames.
Changing the codec reloads the resolution and FPS lists for that codec. A field the device locks (`locks`, e.g. GOP
under smart codec) is disabled, no explanation text. A field the device does not have is not shown. Footer:
`שמור` (enabled only when something changed) → the confirmation of §3.2 → same pending / success / failure flow.
Below the fields, a collapsed `יומן שינויים` list of this stream's last 5 changes (time, who, what) with `בטל` on the
newest applied one.

### 3.4 Add camera (S3, if the owner keeps it)

Header button `הוסף מצלמה` (admins only, hidden when the recorder has no free slot). Drawer fields: שם, כתובת, פורט
(8000), פרוטוקול (Hikvision / ONVIF), משתמש, סיסמה (password input, never prefilled), ערוץ במצלמה (1). Button `הוסף`.
No confirmation dialog for add (nothing existing changes). Result: the new camera appears after discovery with a
pending row `מתווספת…`.

## 4. Permission states

| Who | Sees |
|---|---|
| system administrator (`system.configure` + `nvr.configure`) | everything above |
| `system.configure` without `nvr.configure` (not possible with built-in roles; keep the state for safety) | the table read-only: toggles rendered as text `פעיל` / `כבוי`, no pencil, no add / remove |
| anyone else | no tab; a direct URL shows the standard no-access state |
| camera denied by scope (T055) | that camera is absent |
| NVR-less installation | no tab; a direct URL shows `אין NVR מחובר` with a link to הגדרות › חיבורים |

The UI never decides access; every write is checked on the server.

## 5. Loading, empty, error

| State | Render |
|---|---|
| loading | `sw-state-panel` loading inside the card; table skeleton with 3 camera blocks |
| empty | `לא נמצאו מצלמות ב־NVR.` + button `רענן` |
| NVR unreachable, registry has values | the table from the last reading (main and sub only), every control disabled, one line above it: `ה־NVR אינו זמין. מוצגים הערכים האחרונים.` + `נסה שוב` |
| NVR unreachable, nothing known | `sw-state-panel` error `ה־NVR אינו זמין.` + `נסה שוב` |
| one camera's streams unreadable | that block shows `—` everywhere and a muted `לא נקרא` in the stream cell |
| stream not writable (`writable:false`) | its toggles and pencil disabled; no text |

## 6. Phone (< 768 px)

One card per camera (name, channel, online dot). Inside, one compact row per stream: `ראשי · H.264 · 2560×1440 · 25`
on one line, then the SVC and Smart codec toggles side by side with their labels. Tap the row → the editor as a
full-screen sheet (same fields as §3.3). Confirmation dialogs are bottom sheets. Rarely used columns (GOP, B-frames,
bitrate mode, WebRTC) appear only in the sheet. No horizontal scrolling.

## 7. RTL and evidence

Hebrew RTL layout; codec names, resolutions, numbers and units stay LTR (`<bdi>`). There is no video or map on this
screen, so nothing to keep un-mirrored. The mockup delivers desktop, phone and RTL screenshots of loading, empty, error
(unreachable with last values), ready, the SVC confirmation, the pending toggle, the success toast with `בטל`, the
editor drawer, and the read-only state.
