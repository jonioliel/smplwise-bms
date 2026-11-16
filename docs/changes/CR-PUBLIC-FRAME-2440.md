# CR-PUBLIC-FRAME-2440 - one page frame for the public ticket page and the public RFQ page (review 08:F16)

Branch `pilot/CR-PUBLIC-FRAME-2440`, cut from `origin/release/2437-train` at 32c4a2275. Row: code-review master plan section 3.3
(wave 2, frontend), `pilot/CR-PUBLIC-FRAME-2436`. No version bump, no migration, no backend file. Identical DOM; pixels: none.

## What changed

- **New `frontend/src/public-ticket/page-frame.ts`** - the builders both public pages carried line for line:
  - `themeToggle(theme, t, onChoice)` - the light / dark button (saves the choice in theme.ts; the page keeps and applies it);
  - `langPicker(lang, t, onPick)` - the language select;
  - `centerScreen(pageClass, head, content)` + `messageContent(t, title, bodyKey, icon, onRetry)` - the message screen (lock /
    clock / done, the optional retry) and the loading screen;
  - `bannerEl(banner, t)` - the page's one banner;
  - `codeCard({ t, code, busy, sub, onSend, onVerify })` - the code gate's card (the page hands in its own "which item" line).
  The builders keep no state. A page hands in its values and what to do on a press, and stays the owner of its language, theme,
  code session and requests.
- **`public-ticket/main.ts`, `public-ticket/rfq/rfq-page.ts`** - `themeToggle()`, `langPicker()`, `screen()` / `msgScreen()`,
  `message()`, `bannerEl()` and `codeScreen()` keep their names and call the builders. Each page keeps what differs: its header,
  its footer, its page class (`page` / `page rfq`), the code screen's own line (the ticket number, or the RFQ reference in an
  `ltr` span) and how it stores a picked language. Imports that only those lines used are dropped.
- **Public bundle rules kept** (`unit-public-ticket.spec.ts` scans every `.ts` of the folder, the new module included): DOM only
  through `dom.ts` `h` (text nodes, no `innerHTML`), no inline style, no link built, no storage outside `theme.ts`, nothing
  imported from the app. The RFQ chunk imports the frame from the entry chunk's module; `main.ts` still imports nothing from `rfq/`
  statically.

## Identical DOM - how it is held

`tests/unit-public-frame-2440.spec.ts` (new, Node only) records what `dom.ts` `h` builds on a stand-in document and compares each
builder with the lines the two pages carried before, written out once more in the spec: the same elements, classes, attributes
in the same order, listeners and text nodes - for every theme, every language, both page classes with and without a header and a
retry, every banner tone, and the code card in 60 combinations (not sent / sent, busy, each page's own line, each message
kind). It also drives the listeners (the toggle hands over the opposite choice, the picker only a language of the page, the code
input writes the page's code state, send / verify call the page).

One wording of behaviour to note, not a change: the code card's input writes into the `code` object it was built with. Both
pages paint again after every assignment of a new `code` object, so the input on screen always belongs to the current one.

## Resolved file list

- new `frontend/src/public-ticket/page-frame.ts`
- `frontend/src/public-ticket/main.ts`
- `frontend/src/public-ticket/rfq/rfq-page.ts`
- new `frontend/tests/unit-public-frame-2440.spec.ts`

Outside my rows: nothing.

## Tests actually run (workstation, 2026-11-16)

- `npx tsc --noEmit` on a focused project (`main.ts`, `rfq/rfq-page.ts`, `page-frame.ts`, the new spec and everything they
  import - the whole public bundle): no errors.
- `npx playwright test -c playwright.unit.config.ts --workers=1` on the 12 `unit-public-*` specs (the 11 of the row and the new
  one): 135 passed, 1 skipped (existing: `unit-public-ticket` skips its built-output check when `www-public` is not built here; this worktree is a sparse checkout without it).

## NOT_RUN

- Full-project `npx tsc --noEmit` (0.1-0.4 GB free RAM during the batch; the focused project covers every file this branch touches
  and every importer of the new module).
- `npm run build:public` and the public bundle's size budget on built output (the frame moved shared lines into the entry chunk's
  module and out of the RFQ chunk; no size is claimed).
- The public Playwright config (`playwright.public.config.ts`, browser specs of the two pages).
- No entry check (per the batch brief: the lead combines).
