Heebo for the electricity bill PDF (CR-023 P3)

Files: Heebo-he-400.ttf, Heebo-he-700.ttf (Hebrew subset), Heebo-la-400.ttf, Heebo-la-700.ttf (Latin subset).
Source: the product's own Heebo web-font subsets (frontend/public/fonts/heebo-hebrew-*.woff2, heebo-latin-*.woff2, from
Google Fonts), converted to plain TrueType and cut to static instances at weights 400 and 700 with fontTools
(fontTools.varLib.instancer). TrueType is used so the PDF engine needs no WOFF2 decoder.
These are modified (subset, converted) versions of Heebo; the name is not a Reserved Font Name.
License: SIL Open Font License 1.1, see OFL.txt. Keep this folder together with OFL.txt (the license requires it
to travel with the fonts); the repository's third-party notices should list "Heebo, SIL OFL 1.1".
Glyph coverage: Hebrew letters, points and punctuation (including the shekel sign and the geresh/gershayim), Latin,
digits and common punctuation. Characters outside that are not drawn by the main layout (they would show as missing
glyphs); the model keeps user text to those scripts in practice, and the tests pin the Hebrew + Latin + digits case.
