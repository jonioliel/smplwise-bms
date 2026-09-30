// Skin 2 — "iOS / Apple": system-like scale, large titles, grouped inset lists with hairline separators,
// 14/22/28/32 continuous corners on a soft grey canvas (light) / true black with elevated greys (dark), a floating
// translucent rail and a floating pill bar, segmented controls and switches, spring motion, system blue with
// semantic green/orange/red. On the phone the same DOM composes as grouped lists and two-column KPI tiles.
// The feel, not the assets: Heebo stays, icons are ours, no Apple names or glyphs.
import { same, lt, derive } from '../src/token-helpers.mjs';
import { groups as base } from './domus.mjs';

const BLUE = lt('#0071e3', '#0071e3'); // system blue at the "web" depth: 4.7:1 with white button text in both schemes; the brighter #0a84ff is the dark hover/focus tint

export const groups = derive(base, {
  // canvas + surfaces: grouped background (light) / true black + elevated greys (dark). No blooms, no highlight hairline.
  '--sw-bg': lt('#f2f2f7', '#000000'),
  '--sw-canvas': lt('linear-gradient(#f2f2f7, #f2f2f7)', 'linear-gradient(#000000, #000000)'),
  '--sw-surface': lt('rgba(255,255,255,.80)', 'rgba(28,28,30,.80)'),
  '--sw-surface-solid': lt('#ffffff', '#1c1c1e'),
  '--sw-surface-2': lt('rgba(118,118,128,.08)', 'rgba(118,118,128,.14)'),
  '--sw-surface-2-solid': lt('#ffffff', '#2c2c2e'),
  '--sw-surface-3': lt('rgba(118,118,128,.12)', 'rgba(118,118,128,.24)'),
  '--sw-surface-3-solid': lt('#e5e5ea', '#3a3a3c'),
  '--sw-border': lt('rgba(60,60,67,.24)', 'rgba(84,84,88,.65)'),
  '--sw-border-strong': lt('rgba(60,60,67,.36)', 'rgba(84,84,88,.95)'),
  '--sw-highlight': same('transparent'),
  '--sw-overlay': lt('rgba(0,0,0,.40)', 'rgba(0,0,0,.62)'),
  '--sw-video-bg': same('#000000'),
  // text: label / secondary / tertiary — tertiary darkened to hold 4.5:1 on white and on the grouped grey
  '--sw-text': lt('#000000', '#ffffff'),
  '--sw-heading': lt('#000000', '#ffffff'),
  '--sw-text-2': lt('#48484d', '#aeaeb2'),
  '--sw-text-3': lt('#6a6a70', '#98989d'),
  '--sw-text-inverse': lt('#ffffff', '#000000'),
  // accent: system blue
  '--sw-accent': BLUE, '--sw-accent-hover': lt('#0062c4', '#0a84ff'),
  '--sw-accent-soft': lt('rgba(0,113,227,.12)', 'rgba(10,132,255,.20)'),
  '--sw-accent-text': lt('#0060c0', '#5aa2ff'),
  '--sw-nav': BLUE, '--sw-focus': lt('#0071e3', '#409cff'),
  // semantic states: green / orange / red / grey (greens darkened in light to hold 3:1 as indicators)
  '--sw-live': lt('#1e9640', '#30d158'), '--sw-live-soft': lt('rgba(30,150,64,.14)', 'rgba(48,209,88,.20)'),
  '--sw-recorded': BLUE, '--sw-recorded-soft': lt('rgba(0,113,227,.12)', 'rgba(10,132,255,.20)'),
  '--sw-offline': lt('#8e8e93', '#98989d'), '--sw-offline-soft': lt('rgba(142,142,147,.16)', 'rgba(152,152,157,.22)'),
  '--sw-stale': lt('#c46a00', '#ff9f0a'), '--sw-stale-soft': lt('rgba(255,149,0,.16)', 'rgba(255,159,10,.22)'),
  '--sw-unknown': lt('#aeaeb2', '#636366'), '--sw-unknown-soft': lt('rgba(174,174,178,.18)', 'rgba(99,99,102,.30)'),
  '--sw-danger': lt('#e0281e', '#ff453a'), '--sw-danger-soft': lt('rgba(255,59,48,.12)', 'rgba(255,69,58,.22)'),
  '--sw-warning': lt('#c46a00', '#ff9f0a'), '--sw-warning-soft': lt('rgba(255,149,0,.16)', 'rgba(255,159,10,.22)'),
  '--sw-success': lt('#1e9640', '#30d158'), '--sw-success-soft': lt('rgba(30,150,64,.14)', 'rgba(48,209,88,.20)'),
  '--sw-forbidden': lt('#d70015', '#ff375f'), '--sw-forbidden-soft': lt('rgba(215,0,21,.12)', 'rgba(255,55,95,.22)'),
  '--sw-purple': lt('#af52de', '#bf5af2'),
  '--sw-live-text': lt('#166d2e', '#30d158'), '--sw-recorded-text': lt('#0060c0', '#5aa2ff'),
  '--sw-offline-text': lt('#55555a', '#b8b8bd'), '--sw-stale-text': lt('#7f4400', '#ff9f0a'),
  '--sw-unknown-text': lt('#5c5c61', '#aeaeb2'), '--sw-danger-text': lt('#b51d14', '#ff6b63'),
  '--sw-warning-text': lt('#7f4400', '#ff9f0a'), '--sw-success-text': lt('#166d2e', '#30d158'),
  '--sw-forbidden-text': lt('#a8000f', '#ff6482'), '--sw-purple-text': lt('#7d2fa8', '#d69bff'),
  '--sw-toggle-on': lt('#1e9640', '#30d158'),
  // "on": no glow — a flat warm tint and a filled icon square, the same on a room card, a device row and a list row
  // (lights are warm too: one "on" language across home and area); switches stay green. The alphas describe the tint.
  '--sw-on-warm': same('255 149 0'), '--sw-on-cool': same('255 149 0'), '--sw-on-switch': lt('30 150 64', '48 209 88'),
  '--sw-glow-fill-start': lt('.12', '.13'), '--sw-glow-fill-end': lt('.12', '.13'), '--sw-glow-border': same('0'), '--sw-glow-halo': same('0'),
  // roles
  '--sw-role-accent': same('0 113 227'), '--sw-role-accent-fg': lt('#0060c0', '#5aa2ff'),
  '--sw-role-warm': same('255 149 0'), '--sw-role-warm-fg': lt('#7f4400', '#ffbd59'),
  '--sw-role-cool': lt('50 173 230', '100 210 255'), '--sw-role-cool-fg': lt('#0a6690', '#8fdcff'),
  '--sw-role-success': lt('30 150 64', '48 209 88'), '--sw-role-success-fg': lt('#166d2e', '#7fe5a0'),
  '--sw-role-warning': same('255 159 10'), '--sw-role-warning-fg': lt('#7f4400', '#ffc26b'),
  '--sw-role-danger': lt('224 40 30', '255 69 58'), '--sw-role-danger-fg': lt('#b51d14', '#ff8d85'),
  '--sw-role-neutral': same('142 142 147'), '--sw-role-neutral-fg': lt('#48484a', '#d1d1d6'),
  '--sw-role-fill-a': lt('.14', '.24'), '--sw-role-border-a': lt('.40', '.55'),
  // plan canvas: only the accent-derived colours change
  '--sw-map-glass': lt('#5ab0ff', '#0a84ff'), '--sw-map-candidate': BLUE, '--sw-map-presence': BLUE,
  '--sw-fov': lt('rgba(0,113,227,.12)', 'rgba(10,132,255,.16)'), '--sw-circuit-1': BLUE,
  // type: system scale (12 / 13 / 15 / 17 / 20 / 22 / 28), large title 34, light readings
  '--sw-fs-xs': same('12px'), '--sw-fs-sm': same('13px'), '--sw-fs-md': same('15px'), '--sw-fs-lg': same('17px'),
  '--sw-fs-xl': same('20px'), '--sw-fs-2xl': same('22px'), '--sw-fs-3xl': same('28px'),
  '--sw-h1': same('34px'), '--sw-h1-phone': same('34px'), '--sw-h1-tracking': same('0.2px'), '--sw-h1-lh': same('1.15'),
  '--sw-h2': same('22px'), '--sw-h2-tracking': same('0px'),
  '--sw-fs-section': same('17px'), '--sw-fw-section': same('600'),
  '--sw-fs-reading': same('60px'), '--sw-fs-reading-phone': same('50px'), '--sw-fw-reading': same('400'), '--sw-reading-tracking': same('-1px'),
  '--sw-lh': same('1.4'),
  // space: rows 52, icon squares 32, tighter card padding
  '--sw-page-pad': same('24px'), '--sw-tile-gap': same('8px'), '--sw-card-gap': same('16px'), '--sw-card-pad': same('16px'),
  '--sw-row-h': same('52px'), '--sw-row-h-compact': same('44px'), '--sw-icon-ring': same('32px'), '--sw-icon-ring-lg': same('40px'),
  // radii: 14 control / 22 tile / 28 panel / 32 dialog — the contemporary continuous-corner scale (judge round 2)
  '--sw-r-sm': same('14px'), '--sw-r-md': same('22px'), '--sw-r-lg': same('28px'), '--sw-r-xl': same('32px'),
  // elevation: grouped cards carry no shadow; popovers and sheets do; the switch thumb has the classic drop
  '--sw-shadow-1': same('none'),
  '--sw-shadow-2': lt('0 6px 20px rgba(0,0,0,.10)', '0 8px 24px rgba(0,0,0,.60)'),
  '--sw-shadow-3': lt('0 20px 60px rgba(0,0,0,.22)', '0 24px 70px rgba(0,0,0,.80)'),
  '--sw-shadow-thumb': lt('0 3px 8px rgba(0,0,0,.15), 0 3px 1px rgba(0,0,0,.06)', '0 3px 8px rgba(0,0,0,.45), 0 3px 1px rgba(0,0,0,.2)'),
  // material: cards opaque; only the rail, the bar and the corner are translucent
  '--sw-glass-blur': same('none'), '--sw-glass-blur-nav': same('blur(20px) saturate(1.8)'), '--sw-glass-blur-sheet': same('blur(20px) saturate(1.8)'),
  '--sw-glass-contrast-a': same('1'), '--sw-glass-sheen': same('linear-gradient(transparent, transparent)'),
  '--sw-icon-ring-on-bg': same('rgba(255,255,255,.22)'),
  // motion: a touch slower, spring on thumbs, no hover lift
  '--sw-t-fast': same('150ms'), '--sw-t-med': same('250ms'), '--sw-t-slow': same('400ms'),
  '--sw-ease': same('cubic-bezier(.25, .1, .25, 1)'), '--sw-ease-thumb': same('cubic-bezier(.34, 1.56, .64, 1)'),
  '--sw-hover-lift': same('0px'),
});

export const rules = `
/* ios · cards are opaque grouped containers without an outline; only the rail, bar, corner and sheet are translucent material */
.glass{background:var(--sw-surface-solid);border-color:transparent}
.rail-in,.bar,.corner,.sheet{background:var(--sw-surface);-webkit-backdrop-filter:var(--sw-glass-blur-nav);backdrop-filter:var(--sw-glass-blur-nav)}
/* ios · floating rail: a rounded translucent column 12px off the edges with a real shadow; rounded selection, no indicator bar */
.rail{padding:var(--sw-rail-gap) 0;padding-inline-start:var(--sw-rail-gap)}
.rail-in{border-radius:var(--sw-r-lg);border-inline-end:0;box-shadow:var(--sw-shadow-2);padding-inline:8px}
.rail-item{border-radius:var(--sw-r-sm)}
/* ios · phone: the bottom bar floats as a pill 12px off the edges; the active item sits on a tinted pill */
.bar{bottom:10px;margin-inline:12px;border-radius:var(--sw-r-pill);border-top:0;padding:6px 8px;box-shadow:var(--sw-shadow-2)}
.bar-item.active .pill{background:var(--sw-accent-soft)}
/* ios · grouped-list rhythm: grey filled pills, blue text button for the floor, small grey group headers with the facts in grey */
.chip{background:var(--sw-surface-3);border-color:transparent}
.chip.warm{border-color:transparent}
.fbtn{background:var(--sw-surface-solid);border-color:transparent;color:var(--sw-accent-text)} .fbtn .ic{color:inherit}
.floor .fh .facts,.floor .fh .facts b{color:var(--sw-text-3);font-weight:var(--sw-fw-regular)}
.room .rn{font-size:var(--sw-fs-xl);font-weight:var(--sw-fw-semibold);letter-spacing:0}
/* ios · grouped inset lists: rows without fills, hairline separators, last row clean */
.tile,.sens,.lrow{background:transparent;border:0;border-radius:0;border-bottom:1px solid var(--sw-border);padding-inline:10px}
.tiles1 > .tile:last-child,.tiles2 > .tile:last-child,.tiles2 > .tile:nth-last-child(2):nth-child(odd),.sens2 > .sens:nth-last-child(-n+2),.lgroup .lrow:last-child{border-bottom:0}
.tile.unavail .ring{border:1.5px dashed var(--sw-border-strong);background:transparent}
/* ios · "on" = filled icon square + the same flat warm tint on a room card, a device row, an area tile and a list row; no glow */
.ring{border-radius:8px}
.dbadge{border-radius:8px;background:rgb(var(--role,var(--sw-role-accent)));color:#fff}
.tile.on .ring,.lrow.on .ring,.atile.on .dbadge,.room.on .dbadge{background:rgb(var(--g));color:#fff}
.atile{background:var(--sw-surface-3);border-color:transparent}
.atile.on,.room.on,.tile.on,.lrow.on{background:rgb(var(--g) / calc(var(--sw-glow-fill-start) * .6));border-color:transparent;box-shadow:none}
.tile.on,.lrow.on{border-radius:var(--sw-r-sm)}
.kpi .ring{background:rgb(var(--tone,var(--sw-role-neutral)));color:#fff}
/* ios · segmented control (grey track, white thumb) and switch (51×31) */
.seg{border-radius:9px;padding:2px;gap:2px}
.seg > *{border-radius:7px;min-height:28px;font-weight:var(--sw-fw-medium)}
.seg > .on{box-shadow:var(--sw-shadow-thumb);font-weight:var(--sw-fw-semibold)}
.tg .tr,.tg.small .tr{width:51px;height:31px;border:0;background:var(--sw-surface-3-solid)}
.tg .tr::after,.tg.small .tr::after{width:27px;height:27px}
.tg.on .tr::after,.tg.small.on .tr::after{translate:20px 0}
.tg.on .tr:dir(rtl)::after,.tg.small.on .tr:dir(rtl)::after{translate:-20px 0}
/* ios · buttons: filled / tinted / plain; white text on the filled one in both schemes */
.btn.primary{color:#fff;box-shadow:none}
.btn.secondary{background:var(--sw-accent-soft);border-color:transparent;color:var(--sw-accent-text)}
.tabs .tab.on{border-color:transparent;box-shadow:none;background:var(--sw-accent-soft)}
.slider .thumb{width:28px;height:28px}
/* ios · grouped-list section headers: small, grey, above the group */
.floor .fh .h2,.lgroup{font-size:var(--sw-fs-sm);color:var(--sw-text-3);font-weight:var(--sw-fw-medium)}
.lgroup{background:var(--sw-surface-solid);min-height:36px}
/* ios · phone composition of the same DOM: the building facts as KPI tiles in two columns (Control-Center rhythm, the
   --sw-kpi-compact-* knobs), each floor as one grouped list — a white container of area rows with hairlines and a disclosure */
@media (max-width:767px){
  .home .head .facts{display:grid;grid-template-columns:repeat(var(--sw-kpi-compact-cols-phone),1fr);gap:var(--sw-kpi-compact-grid-gap);margin-top:12px}
  .home .head .facts span{background:var(--sw-surface-solid);border-radius:var(--sw-r-md);min-height:var(--sw-row-h);padding:var(--sw-kpi-compact-pad-block) var(--sw-kpi-compact-pad-inline);gap:var(--sw-kpi-compact-gap);white-space:normal;color:var(--sw-text-2)}
  .home .head .facts span:last-child:nth-child(odd){grid-column:1 / -1}
  .home .head .facts b{font-size:var(--sw-kpi-compact-value-fs);color:var(--sw-heading)}
  .home .head .facts .ic{width:22px;height:22px}
  .rooms{gap:0;background:var(--sw-surface-solid);border-radius:var(--sw-r-lg);overflow:hidden}
  .room{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 8px;padding:10px 14px;border-radius:0;border-bottom:1px solid var(--sw-border)}
  .rooms > .room:last-child{border-bottom:0}
  .room .amb{gap:6px 10px}
  .room .rf{grid-column:2;grid-row:1 / span 2;margin:0;flex-direction:row-reverse;gap:0}
  .room .rf .more{color:transparent;width:24px;justify-content:center}
  .room .rf .more .ic{color:var(--sw-text-3);width:18px;height:18px}
  .room .amb .chip{height:auto;padding:0;background:transparent}
}
`;

export const skin = {
  id: 'ios', name: 'iOS / Apple', nameHe: 'iOS / Apple', groups, rules,
  primaryText: { light: '#ffffff', dark: '#ffffff' },
  copy: {
    material: 'משטחים אטומים על קנבס מקובץ',
    materialNote: 'הכרטיסים הם מכלים אטומים (לבן / אפור מוגבה) על קנבס אפור-רך (light) או שחור אמיתי (dark). חומר שקוף רק בסרגל, בפס התחתון ובפינה. אין קו שיער עליון, אין צל לכרטיס במנוחה.',
    canvasNote: 'הקנבס שטוח: #f2f2f7 ב-light, #000000 ב-dark. העומק מגיע מרמות האפור (1c/2c/3a) ולא מצל או blur.',
    onNote: 'אין glow: "דולק" = ריבוע אייקון מלא בצבע המצב + טינט חם שטוח על השורה/הכרטיס — אותה שפה בכרטיס החדר (בית), בשורת ההתקן (אזור) ובשורת הרשימה. תאורה ותריסים חמים (כתום), מתגים ירוקים.',
    shadowNote: 'shadow-1 = none. הפרדה בין שורות בקו שיער (separator .24/.65); הסרגל הצף, הפס הצף, popover ו-sheet מקבלים shadow-2/3; אגודל ה-toggle מקבל את הצל הקלאסי.',
    motionNote: 'אגודלים ומתגים בקפיץ (cubic-bezier(.34,1.56,.64,1)); משכים 150/250/400; אין hover lift.',
    railNote: 'סרגל צד צף: עמודה שקופה-מטושטשת ברדיוס 28, 12px מהקצוות, עם shadow-2; פריט פעיל = מילוי accent-soft מעוגל 14, בלי פס. בטלפון: פס תחתון צף בצורת pill, 12px מהקצוות, פעיל = כחול על pill מוטנט.',
  },
};
