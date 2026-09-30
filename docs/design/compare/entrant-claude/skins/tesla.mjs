// Skin 3 — "Tesla clean hi-tech": near-monochrome, high contrast, generous whitespace, flat surfaces with no
// shadow or blur, 1px rules, large numerals, sharp 6–8px radii, one cold accent, large targets, dark-first
// (black canvas, light grey text) with a clean white light mode, restrained motion. No trademarks.
import { same, lt, derive } from '../src/token-helpers.mjs';
import { groups as base } from './domus.mjs';

const ACC = lt('#2662f0', '#3d7eff');
const ACC3 = lt('38 98 240', '61 126 255');

export const groups = derive(base, {
  // canvas + surfaces: flat, opaque, separated by 1px rules only
  '--sw-bg': lt('#ffffff', '#000000'),
  '--sw-canvas': lt('linear-gradient(#ffffff, #ffffff)', 'linear-gradient(#000000, #000000)'),
  '--sw-surface': lt('#fafafa', '#0f0f0f'), '--sw-surface-solid': lt('#fafafa', '#0f0f0f'),
  '--sw-surface-2': lt('#f2f2f2', '#171717'), '--sw-surface-2-solid': lt('#f2f2f2', '#171717'),
  '--sw-surface-3': lt('#e6e6e6', '#242424'), '--sw-surface-3-solid': lt('#e6e6e6', '#242424'),
  '--sw-border': lt('rgba(0,0,0,.12)', 'rgba(255,255,255,.12)'),
  '--sw-border-strong': lt('rgba(0,0,0,.28)', 'rgba(255,255,255,.26)'),
  '--sw-highlight': same('transparent'),
  '--sw-overlay': lt('rgba(0,0,0,.50)', 'rgba(0,0,0,.72)'),
  '--sw-video-bg': lt('#111111', '#000000'),
  // text: near-black / light grey; secondary greys hold 4.5:1 on every surface level
  '--sw-text': lt('#171a20', '#e7e7e7'), '--sw-heading': lt('#000000', '#ffffff'),
  '--sw-text-2': lt('#5c5e62', '#a6a6a6'), '--sw-text-3': lt('#5f6268', '#8f8f8f'),
  '--sw-text-inverse': lt('#ffffff', '#000000'),
  // one cold accent
  '--sw-accent': ACC, '--sw-accent-hover': lt('#1d52d1', '#5f97ff'),
  '--sw-accent-soft': lt('rgba(38,98,240,.10)', 'rgba(61,126,255,.16)'),
  '--sw-accent-text': lt('#1f56d6', '#7fadff'), '--sw-nav': ACC, '--sw-focus': lt('#2662f0', '#7fadff'),
  // semantic states kept, desaturated toward the monochrome field
  '--sw-live': lt('#0f9d58', '#2fd070'), '--sw-live-soft': lt('rgba(15,157,88,.10)', 'rgba(47,208,112,.14)'),
  '--sw-recorded': ACC, '--sw-recorded-soft': lt('rgba(38,98,240,.10)', 'rgba(61,126,255,.16)'),
  '--sw-offline': lt('#7a7c80', '#8f8f8f'), '--sw-offline-soft': lt('rgba(122,124,128,.10)', 'rgba(143,143,143,.14)'),
  '--sw-stale': lt('#b8720a', '#f2b134'), '--sw-stale-soft': lt('rgba(196,127,0,.10)', 'rgba(242,177,52,.14)'),
  '--sw-unknown': lt('#a8aaae', '#5c5c5c'), '--sw-unknown-soft': lt('rgba(168,170,174,.12)', 'rgba(92,92,92,.20)'),
  '--sw-danger': lt('#d92c2c', '#ff5a5a'), '--sw-danger-soft': lt('rgba(217,44,44,.10)', 'rgba(255,90,90,.14)'),
  '--sw-warning': lt('#b8720a', '#f2b134'), '--sw-warning-soft': lt('rgba(196,127,0,.10)', 'rgba(242,177,52,.14)'),
  '--sw-success': lt('#0f9d58', '#2fd070'), '--sw-success-soft': lt('rgba(15,157,88,.10)', 'rgba(47,208,112,.14)'),
  '--sw-forbidden': lt('#c81e1e', '#ff6b6b'), '--sw-forbidden-soft': lt('rgba(200,30,30,.10)', 'rgba(255,107,107,.14)'),
  '--sw-purple': lt('#6b4fd8', '#b48cff'),
  '--sw-live-text': lt('#0a7a44', '#2fd070'), '--sw-recorded-text': lt('#1f56d6', '#7fadff'),
  '--sw-offline-text': lt('#55575b', '#b3b3b3'), '--sw-stale-text': lt('#7a4c00', '#f2b134'),
  '--sw-unknown-text': lt('#5c5e62', '#a6a6a6'), '--sw-danger-text': lt('#b01f1f', '#ff5a5a'),
  '--sw-warning-text': lt('#7a4c00', '#f2b134'), '--sw-success-text': lt('#0a7a44', '#2fd070'),
  '--sw-forbidden-text': lt('#a51818', '#ff6b6b'), '--sw-purple-text': lt('#5238b8', '#c9adff'),
  '--sw-toggle-on': lt('#171a20', '#e7e7e7'),
  // "on": one accent for every domain; a 3px rule at the start edge and an accent icon, no gradient, no halo
  '--sw-on-warm': ACC3, '--sw-on-cool': ACC3, '--sw-on-switch': ACC3,
  '--sw-glow-fill-start': same('0'), '--sw-glow-fill-end': same('0'), '--sw-glow-border': same('1'), '--sw-glow-halo': same('0'),
  // roles: outlines rather than fills (fill-a low, border-a high)
  '--sw-role-accent': ACC3, '--sw-role-accent-fg': lt('#1f56d6', '#7fadff'),
  '--sw-role-warm': lt('184 114 10', '242 177 52'), '--sw-role-warm-fg': lt('#7a4c00', '#ffd27a'),
  '--sw-role-cool': ACC3, '--sw-role-cool-fg': lt('#1f56d6', '#7fadff'),
  '--sw-role-success': lt('15 157 88', '47 208 112'), '--sw-role-success-fg': lt('#0a7a44', '#8ee8b3'),
  '--sw-role-warning': lt('184 114 10', '242 177 52'), '--sw-role-warning-fg': lt('#7a4c00', '#ffd27a'),
  '--sw-role-danger': lt('217 44 44', '255 90 90'), '--sw-role-danger-fg': lt('#a82525', '#ff9c9c'),
  '--sw-role-neutral': lt('110 112 116', '140 140 140'), '--sw-role-neutral-fg': lt('#3f4145', '#d0d0d0'),
  '--sw-role-fill-a': lt('.08', '.12'), '--sw-role-border-a': lt('.55', '.60'),
  '--sw-map-glass': lt('#5b8cff', '#3d7eff'), '--sw-map-candidate': ACC, '--sw-map-presence': ACC,
  '--sw-fov': lt('rgba(38,98,240,.10)', 'rgba(61,126,255,.14)'), '--sw-circuit-1': ACC,
  // type: medium-weight titles, large numerals, wider body leading
  '--sw-fs-xs': same('12px'), '--sw-fs-sm': same('13px'), '--sw-fs-md': same('14px'), '--sw-fs-lg': same('16px'),
  '--sw-fs-xl': same('18px'), '--sw-fs-2xl': same('22px'), '--sw-fs-3xl': same('30px'),
  '--sw-h1': same('48px'), '--sw-h1-phone': same('34px'), '--sw-h1-weight': same('500'), '--sw-h1-tracking': same('-0.5px'), '--sw-h1-lh': same('1.05'),
  '--sw-h2': same('26px'), '--sw-h2-tracking': same('-0.3px'),
  '--sw-fs-section': same('15px'), '--sw-fw-section': same('500'),
  '--sw-fs-reading': same('72px'), '--sw-fs-reading-phone': same('56px'), '--sw-fw-reading': same('400'), '--sw-reading-tracking': same('-2px'),
  '--sw-lh': same('1.5'),
  // space: more air
  '--sw-page-pad': same('32px'), '--sw-page-pad-tablet': same('24px'), '--sw-card-pad': same('20px'), '--sw-card-gap': same('20px'), '--sw-tile-gap': same('10px'),
  '--sw-row-h': same('56px'), '--sw-row-h-compact': same('48px'),
  // radii: sharp
  '--sw-r-sm': same('4px'), '--sw-r-md': same('6px'), '--sw-r-lg': same('8px'), '--sw-r-xl': same('8px'), '--sw-r-pill': same('6px'),
  // elevation: none; the top layer is separated by a 1px rule
  '--sw-shadow-1': same('none'), '--sw-shadow-2': same('none'),
  '--sw-shadow-3': lt('0 0 0 1px rgba(0,0,0,.28)', '0 0 0 1px rgba(255,255,255,.26)'),
  '--sw-shadow-thumb': same('none'),
  '--sw-glass-blur': same('none'), '--sw-glass-blur-nav': same('none'), '--sw-glass-blur-sheet': same('none'), '--sw-glass-contrast-a': same('1'),
  // motion: short, no spring, no lift
  '--sw-t-fast': same('100ms'), '--sw-t-med': same('180ms'), '--sw-t-slow': same('260ms'),
  '--sw-ease': same('cubic-bezier(.4, 0, .2, 1)'), '--sw-ease-enter': same('cubic-bezier(.4, 0, .2, 1)'), '--sw-ease-exit': same('cubic-bezier(.4, 0, 1, 1)'),
  '--sw-ease-thumb': same('cubic-bezier(.4, 0, .2, 1)'),
  '--sw-hover-lift': same('0px'),
});

export const rules = `
/* tesla · flat rail column with a 1px rule; monochrome brand mark; active = heading colour + 2px accent rule */
.rail-in{border-radius:0;border-inline-end:1px solid var(--sw-border);background:var(--sw-bg)}
.brand{background:transparent;color:var(--sw-heading);border:1px solid var(--sw-border-strong);border-radius:var(--sw-r-md);box-shadow:none;font-weight:600}
.rail-item.active{background:transparent;color:var(--sw-heading)}
.rail-item.active::before{content:"";position:absolute;inset-inline-start:0;top:50%;translate:0 -50%;width:2px;height:60%;background:var(--sw-accent)}
.bar{background:var(--sw-bg)} .bar-item.active{color:var(--sw-heading)}
.corner{background:var(--sw-surface);border-radius:var(--sw-r-md)} .corner .cbtn{border-radius:var(--sw-r-sm)}
.avatar{background:transparent;border-color:var(--sw-border-strong);color:var(--sw-text)}
/* tesla · titles in medium weight, big numerals */
h1,h2,h3,.h1,.h2,.dialog .q,.kpi .kv,.sens .sv,.widget.alarm .word{font-weight:500}
.kpi .kv{font-size:28px} .sens .sv{font-size:24px}
/* tesla · icon rings are outlines, not fills */
.ring,.dbadge,.state .sic{background:transparent;border:1px solid var(--sw-border-strong)}
.dbadge{border-color:rgb(var(--role,var(--sw-role-accent)) / var(--sw-role-border-a))}
.kpi .ring{border-color:rgb(var(--tone,var(--sw-role-neutral)) / var(--sw-role-border-a))}
/* tesla · "on" = 3px accent rule at the start edge + accent icon outline; no gradient, no halo */
.tile.on,.atile.on,.room.on,.lrow.on{border-inline-start:3px solid rgb(var(--g));box-shadow:none;border-color:var(--sw-border);border-inline-start-color:rgb(var(--g))}
.tile.on .ring,.atile.on .dbadge,.room.on .dbadge,.lrow.on .ring{background:transparent;color:rgb(var(--g));border-color:rgb(var(--g) / .6)}
.dot.on{background:var(--sw-accent)}
.facts .on b,.lrow .lc.on b,.tree .trow .lit.on{color:var(--sw-accent-text)}
/* tesla · segmented = outlined boxes, selected segment inverted */
.seg{background:transparent;border:1px solid var(--sw-border-strong);padding:0;gap:0;overflow:hidden}
.seg > *{border-radius:0;min-height:34px} .seg > * + *{border-inline-start:1px solid var(--sw-border)}
.seg > .on{background:var(--sw-text);color:var(--sw-text-inverse);box-shadow:none}
.tabs .tab.on{background:none;border:0;box-shadow:none;color:var(--sw-heading);position:relative}
.tabs .tab.on::after{content:"";position:absolute;inset-inline:12px;bottom:0;height:2px;background:var(--sw-accent)}
/* tesla · outlined chips, badges, buttons; toggles in monochrome */
.chip{background:transparent} .chip.warm{background:transparent;border-color:var(--sw-border-strong);color:var(--sw-text)} .chip.warm .ic{color:var(--sw-accent)}
.badge{background:transparent;border:1px solid color-mix(in srgb,var(--bd,currentColor) 55%,transparent)} .badge.image,.badge.count{border:0}
.btn.primary{box-shadow:none} .btn.secondary{background:transparent} .btn.danger{background:transparent}
.btn.round,.master{border-radius:var(--sw-r-md)}
.tg .tr{border-radius:999px;border-color:var(--sw-border-strong);background:transparent} .tg .tr::after{background:var(--sw-text-2);box-shadow:none}
.tg.on .tr{border-color:transparent} .tg.on .tr::after{background:var(--sw-text-inverse)}
.slider .track{height:2px} .slider .thumb{width:18px;height:18px;background:var(--sw-heading);box-shadow:none}
.stepper{background:transparent;border:1px solid var(--sw-border-strong)} .stepper .btn{background:transparent;box-shadow:none;border-radius:var(--sw-r-sm)}
.cover-ctl .btn{background:transparent;border:1px solid var(--sw-border)}
.field .in{background:transparent}
/* tesla · camera caption as a solid strip, not a gradient scrim */
.cam .nm{background:rgba(0,0,0,.62);padding:8px 10px;text-shadow:none}
.handle{border-radius:1px}
`;

export const skin = {
  id: 'tesla', name: 'Tesla clean hi-tech', nameHe: 'הייטק נקי (Tesla)', groups, rules,
  primaryText: { light: '#ffffff', dark: '#000000' },
  copy: {
    material: 'משטחים שטוחים, קווי 1px',
    materialNote: 'אין blur ואין צל. שלוש רמות אפור אטומות (0f / 17 / 24 ב-dark, fa / f2 / e6 ב-light) מופרדות בקו 1px. השכבה העליונה (דיאלוג) נבדלת בקו חזק, לא בצל.',
    canvasNote: 'הקנבס שחור טהור (dark, ברירת המחדל) או לבן נקי (light). הרווח הלבן עושה את העבודה של המשטחים.',
    onNote: 'אין glow: "דולק" = פס 3px בצבע ה-accent הקר בקצה ההתחלה של האריח + אייקון בקו accent. accent אחד לכל התחומים; הצבעים הסמנטיים (ירוק/ענבר/אדום) נשארים למצבים.',
    shadowNote: 'shadow-1/2 = none, shadow-thumb = none, shadow-3 = קו 1px. אין highlight.',
    motionNote: 'משכים 100/180/260, easing אחד לכל דבר, בלי קפיץ, בלי hover lift. התנועה היחידה הנראית: מעבר צבע ותנועת אגודל.',
    railNote: 'עמודה שטוחה בצבע הקנבס עם קו 1px בקצה הסוף. פריט פעיל = צבע כותרת + פס 2px accent; אין מילוי. סימן המותג — מונוגרם בקו, בלי גרדיאנט.',
  },
};
