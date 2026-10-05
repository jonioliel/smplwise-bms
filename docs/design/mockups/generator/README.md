# Generator control - mockup gallery (CR-031 phase A)

Static mockups for the owner's approval of the generator module (`docs/changes/CR-031-GENERATOR.md`). Design only: no
product code, no migration, no device access. Fake data only (an invented site, an invented controller, invented values).
Branch `pilot/GEN1-generator-mockup`.

Open `index.html` (Hebrew review index: one link per screen, the assumed sensor catalogue, the owner questions) or
`gallery.html` directly. The gallery bar picks the screen, the width (1440 / 820 / 390), light or dark and the skin
(classic, domus, tesla, bubble); the state is kept in the URL hash (`#s=live&d=phone&t=dark&k=bubble`).

Files: `styles.css` is the token sheet copied from the electricity mockup (itself from `frontend/src/design/tokens.ts`
and the four skins); `gen.css` holds the generator-only classes (power-flow diagram, gauges, alert cards, routing
matrix); `app.js` renders every screen. Heebo comes from `../bubble-taste/fonts.css`.

Rules applied: Hebrew RTL, the power-flow geometry is never mirrored, no platform name outside Settings (the source is
"תשתית המערכת" only in the detection card and the empty state), clean operator screens, short confirmations, list views
on the phone, touch targets at 390.

ASSUMPTION: the sensor and alert catalogue is generic (no generator integration exists in the repository or in the lab
system); the real mapping comes from the owner's entity export (index.html, question 1).
