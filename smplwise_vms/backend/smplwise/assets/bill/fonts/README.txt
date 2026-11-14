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

Noto (2.0.2): NotoSans-cy-400.ttf, NotoSans-cy-700.ttf (Noto Sans, Cyrillic subset: U+0400-052F, U+1C80-1C8F,
U+2DE0-2DFF, U+A640-A69F) and NotoSansArabic-ar-400.ttf, NotoSansArabic-ar-700.ttf (Noto Sans Arabic, Arabic subset:
U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, with every layout feature kept so the letters join).
Source: the Debian package fonts-noto-core (Noto Sans 2.x / Noto Sans Arabic 2.x, Google, SIL OFL 1.1), subset with
fontTools pyftsubset (--layout-features='*' --no-hinting). Used only as the fallback for names typed in those scripts
(customers, meters, addresses); the bill layout itself stays Heebo. "Noto" is a Reserved Font Name of the Noto project:
these files are modified subsets and are therefore named NotoSans-cy / NotoSansArabic-ar, not distributed as "Noto".
License: the same SIL OFL 1.1 text in OFL.txt (Copyright 2012 Google Inc., Noto Project Authors).
