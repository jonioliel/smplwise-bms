"""HOME-V3-P1-2430: mechanical port of the round-27 mockup v3.css into frontend/src/home/home-styles-v3.ts (same rules as home-styles.ts).

Usage: python scripts/home_port_v3_css.py <private/.../round27/home-full-v3/v3.css> frontend/src/home/home-styles-v3.ts
"""
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
css = open(src, encoding='utf-8').read()
# drop the demo panel section (a mockup tool)
css = re.sub(r'/\* ---- the demo panel.*?(?=/\* ---- loop 1)', '', css, flags=re.S)
css = css.replace('--sw-', '--hs-')
css = css.replace('#ovl', '.ovl')
css = css.replace('[data-theme="light"] ', ':host([data-hs-scheme="light"]) ')
css = re.sub(r'(?<![\w-])body > ', '', css)
css = re.sub(r'(?<![\w-])body:has\(', ':host(:has(', css)  # never used in phase 1 screens; kept harmless
assert '`' not in css and '${' not in css
head = """// GENERATED from the approved round-27 home mockup v3 (private/design-system-2026-10-27/round27/home-full-v3/v3.css) by the same
// mechanical port as home-styles.ts: --sw-* renamed --hs-*, #ovl -> .ovl, [data-theme="light"] -> :host([data-hs-scheme="light"]), the demo
// panel dropped. The whole v3 sheet is ported once (HOME-V3-P1-2430) so phases 2 and 3 add screens without touching styles. Do not hand-edit;
// product-only additions go to home-styles-extra.ts.
import { css, unsafeCSS } from 'lit';

export const homeV3Styles = css`${unsafeCSS(String.raw`"""
open(dst, 'w', encoding='utf-8', newline='\n').write(head + css.rstrip() + '\n`)}`;\n')
print(len(css))
