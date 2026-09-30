import { icon as I } from './icons.mjs';
import { groups, all } from './tokens.mjs';
import { doc, rail, bottomBar, corner, shell, areaContent, areaCss, camTile, tile, tg, kpi, areaTile, slider } from './screens.mjs';

const sheetCss = `
body{padding:0}
.sheet-wrap{max-width:1380px;margin:0 auto;padding:36px 30px 60px;display:flex;flex-direction:column;gap:28px}
.sheet-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.sheet-head .tag{font-size:var(--sw-fs-sm);color:var(--sw-text-3);direction:ltr}
.sec{display:flex;flex-direction:column;gap:12px}
.sec > .h2{margin-top:10px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:stretch}
.pane{padding:18px;border-radius:var(--sw-r-lg);border:1px solid var(--sw-border);position:relative;overflow:hidden}
.pane > .pl{position:absolute;top:8px;inset-inline-end:12px;font:600 10.5px/1 var(--sw-font);letter-spacing:.4px;color:var(--sw-text-3);direction:ltr;text-transform:uppercase}
.trow2{display:grid;grid-template-columns:230px 1fr 1fr;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--sw-border);font-size:var(--sw-fs-sm)}
.trow2 .tn{font-family:var(--sw-font-mono);direction:ltr;text-align:start;color:var(--sw-text)}
.sw{display:flex;align-items:center;gap:8px;min-width:0}
.sw i{display:block;width:34px;height:22px;border-radius:6px;border:1px solid var(--sw-border);flex:none}
.sw code{font-family:var(--sw-font-mono);font-size:11px;color:var(--sw-text-2);direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.cc{border-radius:var(--sw-r-md);padding:10px 12px;border:1px solid var(--sw-border);display:flex;flex-direction:column;gap:2px;min-height:78px}
.cc .lbl{font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-semibold)}
.cc .val{font:600 12px/1.2 var(--sw-font-mono);direction:ltr;text-align:start;margin-top:auto;display:flex;align-items:center;gap:6px}
.cc .val b{padding:1px 6px;border-radius:999px;font-size:10.5px;color:#fff;background:var(--sw-live)}
.cc .val b.fail{background:var(--sw-danger)} .cc .val b.aa3{background:var(--sw-stale)}
.demo{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.demo.col{flex-direction:column;align-items:stretch}
.lbl-s{font-size:var(--sw-fs-xs);color:var(--sw-text-3);font-weight:var(--sw-fw-semibold);letter-spacing:.3px;margin-bottom:-4px}
.type-row{display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--sw-border)}
.type-row .meta{font:500 11px/1.4 var(--sw-font-mono);direction:ltr;text-align:start;color:var(--sw-text-3)}
.rad{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end}
.rad div{width:88px;height:64px;background:var(--sw-surface-2);border:1px solid var(--sw-border-strong);display:grid;place-items:end center;padding-bottom:6px;font:500 11px var(--sw-font-mono);color:var(--sw-text-2)}
.shad{display:flex;gap:28px;flex-wrap:wrap;padding:10px 6px 20px}
.shad div{width:150px;height:90px;border-radius:var(--sw-r-md);background:var(--sw-surface-solid);display:grid;place-items:center;font:500 11px var(--sw-font-mono);color:var(--sw-text-2)}
.gl-stack{position:relative;height:210px;border-radius:var(--sw-r-lg);overflow:hidden;background:var(--sw-canvas),var(--sw-bg)}
.gl-stack .blob{position:absolute;width:160px;height:160px;border-radius:50%;filter:blur(2px)}
.mo-table{width:100%;border-collapse:collapse;font-size:var(--sw-fs-sm)}
.mo-table th,.mo-table td{padding:8px 10px;border-bottom:1px solid var(--sw-border);text-align:start;vertical-align:top}
.mo-table th{color:var(--sw-text-3);font-weight:var(--sw-fw-semibold);font-size:var(--sw-fs-xs)}
.mo-table code{font-family:var(--sw-font-mono);direction:ltr;unicode-bidi:isolate;font-size:11.5px}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.cmp .pane{min-height:120px;display:flex;flex-direction:column;gap:12px}
.rails{display:flex;gap:16px;align-items:flex-start}
.rails .rail{position:static;height:auto}
.rails .rail-in{height:520px}
.phone-frame{width:390px;border:1px solid var(--sw-border);border-radius:24px;overflow:hidden;background:var(--sw-canvas),var(--sw-bg);position:relative}
.phone-frame .bar{position:static}
.vid{position:relative;width:200px;height:112px;border-radius:var(--sw-r-md);background:var(--sw-video-bg);overflow:hidden}
.states-frame{border:1px solid var(--sw-border);border-radius:var(--sw-r-lg);overflow:hidden;position:relative}
.states-frame .app{min-height:0}
.states-frame .rail{position:static;height:auto}
.states-frame .page{min-height:0}
.states-label{display:flex;align-items:center;gap:10px;margin:8px 0 6px}
.states-label .badge{font-size:var(--sw-fs-sm);height:26px}
`;

const contrastJs = `
<script>
(function(){
  function parse(c){c=c.trim();var m;
    if((m=c.match(/^#([0-9a-f]{6})$/i))){var n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255,1];}
    if((m=c.match(/^rgba?\\(([^)]+)\\)$/i))){var p=m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);return [p[0],p[1],p[2],p.length>3?p[3]:1];}
    return null;}
  function over(fg,bg){var a=fg[3];return [fg[0]*a+bg[0]*(1-a),fg[1]*a+bg[1]*(1-a),fg[2]*a+bg[2]*(1-a),1];}
  function lum(c){var r=c.map(function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*r[0]+.7152*r[1]+.0722*r[2];}
  function ratio(a,b){var l1=lum(a),l2=lum(b);var hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+.05)/(lo+.05);}
  function fmt(c){return 'rgb('+c.slice(0,3).map(Math.round).join(' ')+')';}
  document.querySelectorAll('[data-pair]').forEach(function(el){
    var cs=getComputedStyle(el.closest('[data-scheme],.scheme-light,.scheme-dark')||document.documentElement);
    var spec=el.getAttribute('data-pair').split('|'); // fg|bg layers (top..bottom) separated by '>'
    var fgTok=spec[0], layers=spec[1].split('>');
    var get=function(t){return t[0]==='-'?cs.getPropertyValue(t).trim():t;};
    var bg=null;
    for(var i=layers.length-1;i>=0;i--){var c=parse(get(layers[i]));if(!c)continue;bg=bg?over(c,bg):[c[0],c[1],c[2],1];}
    var fg=parse(get(fgTok)); if(fg[3]<1) fg=over(fg,bg);
    var r=ratio(fg,bg); var need=+el.getAttribute('data-min')||4.5;
    var box=el.querySelector('.cc'); box.style.background=fmt(bg); box.style.color=fmt(fg);
    var v=el.querySelector('.val'); var ok=r>=need; var cls=ok?'':(r>=3?'aa3':'fail');
    v.innerHTML=r.toFixed(2)+':1 <b class="'+cls+'">'+(ok?(need>=4.5?'AA':'AA-large'):(r>=3?'3:1 only':'FAIL'))+'</b>';
  });
})();
</script>`;

const sheetHead = (title, sub, tag) => `<header class="sheet-head"><div><h1 class="h1" style="font-size:34px">${title}</h1><div class="sub">${sub}</div></div><span class="tag">${tag}</span></header>`;

function pane(scheme, inner, extraCls = '') {
  return `<div class="pane scheme-${scheme} ${extraCls}" data-scheme="${scheme}"><span class="pl">${scheme}</span>${inner}</div>`;
}
function pair(innerFn, cls = '') { return `<div class="pair">${pane('light', innerFn('light'), cls)}${pane('dark', innerFn('dark'), cls)}</div>`; }

// ---------- foundations: colour ----------
export function foundationsColor() {
  const colourGroups = groups.filter((g) => ['surface', 'text', 'accent', 'state', 'glow', 'role', 'canvas'].includes(g.id));
  const isColour = (v) => /^(#|rgb|\d+ \d+ \d+$)/.test(v) || v.includes('gradient');
  const swatch = (v) => {
    if (/^\d+ \d+ \d+$/.test(v)) return `<i style="background:rgb(${v})"></i>`;
    return `<i style="background:${v}"></i>`;
  };
  const rows = colourGroups.map((g) => `<section class="sec"><h2 class="h2">${g.title}</h2>
    <div class="trow2" style="border-bottom-width:2px"><span class="faint">token</span><span class="faint">light</span><span class="faint">dark</span></div>
    ${Object.entries(g.tokens).map(([k, v]) => `<div class="trow2"><span class="tn">${k}</span>
      <span class="sw scheme-light" style="background:none;padding:2px 0">${isColour(v.light) ? swatch(v.light) : ''}<code>${v.light}</code></span>
      <span class="sw scheme-dark" style="background:none;padding:2px 0">${isColour(v.dark) ? swatch(v.dark) : ''}<code>${v.dark}</code></span></div>`).join('')}</section>`).join('');

  // contrast pairs: [label, fg, bg-layers, min]
  const warmBloom = { light: 'rgba(255,176,80,.30)', dark: 'rgba(255,150,40,.13)' };
  const pairs = (s) => [
    ['גוף על זכוכית L1 · קנבס', '--sw-text', '--sw-surface>--sw-bg', 4.5],
    ['גוף על זכוכית L1 · בלוב חם', '--sw-text', `--sw-surface>${warmBloom[s]}>--sw-bg`, 4.5],
    ['משני על זכוכית L1', '--sw-text-2', '--sw-surface>--sw-bg', 4.5],
    ['כיתוב (text-3) על זכוכית L1', '--sw-text-3', '--sw-surface>--sw-bg', 4.5],
    ['כיתוב על זכוכית L1 · בלוב חם', '--sw-text-3', `--sw-surface>${warmBloom[s]}>--sw-bg`, 4.5],
    ['גוף על fallback אטום', '--sw-text', '--sw-surface-solid', 4.5],
    ['כיתוב על fallback אטום', '--sw-text-3', '--sw-surface-solid', 4.5],
    ['משני על L2 בתוך L1', '--sw-text-2', '--sw-surface-2>--sw-surface>--sw-bg', 4.5],
    ['כיתוב על L2 בתוך L1', '--sw-text-3', '--sw-surface-2>--sw-surface>--sw-bg', 4.5],
    ['גוף על L3 (מסילה)', '--sw-text', '--sw-surface-3>--sw-surface>--sw-bg', 4.5],
    ['משני על הקנבס', '--sw-text-2', '--sw-bg', 4.5],
    ['accent-text על L1', '--sw-accent-text', '--sw-surface>--sw-bg', 4.5],
    ['accent-text על accent-soft', '--sw-accent-text', '--sw-accent-soft>--sw-surface>--sw-bg', 4.5],
    ['טקסט הפוך על accent (כפתור)', s === 'light' ? '#ffffff' : '#0c1018', '--sw-accent', 4.5],
    ['live-text על live-soft (badge)', '--sw-live-text', '--sw-live-soft>--sw-surface>--sw-bg', 4.5],
    ['stale-text על stale-soft', '--sw-stale-text', '--sw-stale-soft>--sw-surface>--sw-bg', 4.5],
    ['danger-text על danger-soft (כפתור danger)', '--sw-danger-text', '--sw-danger-soft>--sw-surface>--sw-bg', 4.5],
    ['forbidden-text על forbidden-soft', '--sw-forbidden-text', '--sw-forbidden-soft>--sw-surface>--sw-bg', 4.5],
    ['offline-text על offline-soft', '--sw-offline-text', '--sw-offline-soft>--sw-surface>--sw-bg', 4.5],
    ['unknown-text על unknown-soft', '--sw-unknown-text', '--sw-unknown-soft>--sw-surface>--sw-bg', 4.5],
    ['purple-text על מילוי partial', '--sw-purple-text', 'rgba(124,92,240,.14)>--sw-surface>--sw-bg', 4.5],
    ['live-text (KPI "הכול נעול") על L1', '--sw-live-text', '--sw-surface>--sw-bg', 4.5],
    ['warm-fg על מילוי warm (צ׳יפ)', '--sw-role-warm-fg', `rgba(${all['--sw-role-warm'][s].split(' ').join(',')},${all['--sw-role-fill-a'][s]})>--sw-surface>--sw-bg`, 4.5],
    ['success-fg על מילוי success', '--sw-role-success-fg', `rgba(${all['--sw-role-success'][s].split(' ').join(',')},${all['--sw-role-fill-a'][s]})>--sw-surface>--sw-bg`, 4.5],
    ['accent-fg על מילוי accent', '--sw-role-accent-fg', `rgba(${all['--sw-role-accent'][s].split(' ').join(',')},${all['--sw-role-fill-a'][s]})>--sw-surface>--sw-bg`, 4.5],
    ['כותרת על אריח "דולק" (glow חם)', '--sw-heading', `rgba(255,150,40,${all['--sw-glow-fill-start'][s]})>--sw-surface-2>--sw-surface>--sw-bg`, 4.5],
    ['משני על אריח "דולק" (glow קר)', '--sw-text', `rgba(90,150,255,${all['--sw-glow-fill-start'][s]})>--sw-surface-2>--sw-surface>--sw-bg`, 4.5],
    ['שם מצלמה (לבן) על scrim וידאו', '#ffffff', 'rgba(4,8,16,.78)>#6d7d6b', 4.5],
    ['אייקון live (נקודה) על L1 · 3:1', '--sw-live', '--sw-surface>--sw-bg', 3],
    ['אייקון stale (נקודה) על L1 · 3:1', '--sw-stale', '--sw-surface>--sw-bg', 3],
    ['אייקון danger על L1 · 3:1', '--sw-danger', '--sw-surface>--sw-bg', 3],
    ['focus ring על הקנבס · 3:1', '--sw-focus', '--sw-bg', 3],
  ];
  const contrast = pair((s) => `<div class="cgrid">${pairs(s).map(([l, fg, bg, min]) => `<div data-pair="${fg}|${bg}" data-min="${min}"><div class="cc"><span class="lbl">${l}</span><span class="val">…</span></div></div>`).join('')}</div>`);

  const body = `<div class="sheet-wrap">
  ${sheetHead('יסודות · צבע', 'קנבס, 3 רמות משטח (זכוכית + fallback אטום), קווי שיער, טקסט ×5, accent, 9 צבעי מצב + soft, glow "דולק", 7 תפקידי צבע, קנבס תוכנית', 'foundations-color · light + dark')}
  <section class="sec"><h2 class="h2">ניגודיות מחושבת (WCAG, מורכב על הקנבס בפועל)</h2><p class="muted" style="max-width:900px">כל צמד מחושב בזמן פתיחת הלוח מתוך הטוקנים: משטחי הזכוכית מורכבים על צבע הבסיס של הקנבס (ובמקרה הגרוע — על ה"בלוב" החם בפינה), L2 מורכב על L1. תגית AA = ≥ 4.5:1 לטקסט גוף; AA-large = ≥ 3:1 לטקסט גדול ואייקונים.</p>${contrast}</section>
  <section class="sec"><h2 class="h2">הקנבס והחומר</h2>${pair((s) => `<div class="gl-stack"><span class="blob" style="background:rgb(255 150 40 / .55);top:-30px;inset-inline-start:40px"></span><span class="blob" style="background:rgb(90 150 255 / .5);bottom:-40px;inset-inline-end:60px"></span>
    <div class="glass" style="position:absolute;inset:22px 22px 22px 40%;padding:14px"><div class="sec-title">זכוכית L1</div><div class="glass-2" style="margin-top:10px;padding:10px"><span class="muted">L2 מקונן · בלי blur</span><div class="inset" style="margin-top:8px;height:32px;display:flex;align-items:center;padding:0 10px;font-size:12.5px">L3 מסילה / inset</div></div></div>
    <div class="glass solid" style="position:absolute;inset:22px 62% 22px 22px;padding:14px"><div class="sec-title">fallback אטום</div><div class="muted" style="font-size:12.5px;margin-top:6px">בלי backdrop-filter, prefers-reduced-transparency</div></div></div>`)}</section>
  ${rows}
  </div>${contrastJs}`;
  return doc({ title: 'Arx · יסודות · צבע', scheme: 'light', css: sheetCss, body, label: 'foundations-color' });
}

// ---------- foundations: type ----------
export function foundationsType() {
  const scale = [
    ['H1 עמוד (Domus)', 'הבית של רון', '--sw-h1 40px (phone 30) · 700 · lh 1.1 · tracking −0.8px', 'font-size:var(--sw-h1);font-weight:700;letter-spacing:var(--sw-h1-tracking);line-height:1.1;color:var(--sw-heading)'],
    ['H2 כותרת בלוח / דיאלוג', 'לכבות 16 התקנים בבניין?', '--sw-h2 24px · 700 · tracking −0.3px', 'font-size:24px;font-weight:700;letter-spacing:-.3px;color:var(--sw-heading)'],
    ['כותרת מקטע', 'תאורה <span class="count muted" style="font-weight:400;font-size:12.5px">2 מתוך 6</span>', '--sw-fs-section 16px · 600', 'font-size:16px;font-weight:600;color:var(--sw-heading)'],
    ['שם התקן / אריח', 'תאורת תקרה', '--sw-fs-md 14px · 600', 'font-size:14px;font-weight:600;color:var(--sw-heading)'],
    ['גוף', 'שורה מציגה את הדבר, את מצבו ואת הפקד', '--sw-fs-md 14px · 400 · lh 1.45', 'font-size:14px'],
    ['משני / מצב', 'דולק · 60%', '--sw-fs-sm 12.5px · 400 · text-2', 'font-size:12.5px;color:var(--sw-text-2)'],
    ['כיתוב / תווית ווידג׳ט', 'מזג אוויר · לחות 61%', '--sw-fs-xs 11.5px · 600 · text-3 · tracking .3px', 'font-size:11.5px;font-weight:600;color:var(--sw-text-3);letter-spacing:.3px'],
    ['ספרות טבלאיות', '<span class="num">16/48 · 08:15 · 24.5°</span>', 'font-variant-numeric: tabular-nums · direction ltr', 'font-size:22px;font-weight:700;color:var(--sw-heading)'],
    ['קריאה גדולה (שעון)', '<span class="num">15:33</span><small style="font-size:.42em;color:var(--sw-text-3);font-weight:500;letter-spacing:0">38</small>', '--sw-fs-reading 56px (phone 44) · 500 · tracking −1.5px', 'font-size:56px;font-weight:500;letter-spacing:-1.5px;line-height:1;color:var(--sw-heading)'],
    ['קריאה גדולה (טמפרטורה)', '<span class="num">23°</span>', '44px · 500 · tracking −1.5px', 'font-size:44px;font-weight:500;letter-spacing:-1.5px;line-height:1;color:var(--sw-heading)'],
    ['מונו (מזהים, תעבורה)', '<span class="mono">MSE · cam-014 · 192.0.2.10</span>', '--sw-font-mono 12.5px', 'font-size:12.5px'],
  ];
  const body = `<div class="sheet-wrap">
  ${sheetHead('יסודות · טיפוגרפיה', 'משפחה: Heebo (Google Fonts, רישיון SIL OFL 1.1; עברית + לטינית, מגיע עם המוצר) — משקלים 400 / 500 / 600 / 700. מספרים תמיד tabular ו-LTR.', 'foundations-type')}
  ${pair((s) => scale.map(([n, sample, meta, style]) => `<div class="type-row"><div><div class="lbl-s" style="margin:0 0 4px">${n}</div><div class="meta">${meta}</div></div><div style="${style}">${sample}</div></div>`).join(''))}
  <section class="sec"><h2 class="h2">כללים</h2><table class="mo-table"><tr><th>כלל</th><th>ערך</th></tr>
  <tr><td>מיפוי לסקאלה הישנה</td><td><code>--sw-fs-xs 11.5</code> · <code>--sw-fs-sm 12.5</code> · <code>--sw-fs-md 14</code> · <code>--sw-fs-lg 15.5</code> · <code>--sw-fs-xl 17</code> · <code>--sw-fs-2xl 21</code> · <code>--sw-fs-3xl 26</code>; <code>--dv-fs-item-name → sm</code>, <code>--dv-fs-tile-name → md</code>, <code>--dv-fs-title → section 16</code>, <code>--dv-fs-value-big → 3xl</code></td></tr>
  <tr><td>כותרת מתכווצת בגלילה</td><td>H1 40 → 24px (H2) אחרי 48px גלילה, חזרה מתחת ל-32px; משך <code>--sw-t-med</code></td></tr>
  <tr><td>Line-height</td><td>גוף 1.45 · כותרות וקריאות 1.1–1.2 (<code>--sw-lh-tight</code>)</td></tr>
  <tr><td>Tracking</td><td>שלילי רק מ-24px ומעלה (−0.3 → −0.8 → −1.5); כיתובים 11.5px +0.3</td></tr>
  <tr><td>מינימום</td><td>אין טקסט מתחת ל-11.5px; טקסט על תמונה (שם מצלמה) 12.5px 600 עם scrim</td></tr>
  <tr><td>מספרים ומזהים</td><td><code>.num</code> = tabular-nums + <code>direction:ltr; unicode-bidi:isolate</code> — לא מתהפכים ב-RTL</td></tr>
  <tr><td>Fallback</td><td>"Segoe UI", -apple-system, "Noto Sans Hebrew", Roboto, Arial — כולם עם עברית; הזכוכית משתמשת באותה משפחה (Heebo מוביל)</td></tr></table></section>
  </div>`;
  return doc({ title: 'Arx · יסודות · טיפוגרפיה', css: sheetCss, body, label: 'foundations-type' });
}

// ---------- foundations: shape (radii, shadows, glass) ----------
export function foundationsShape() {
  const body = `<div class="sheet-wrap">
  ${sheetHead('יסודות · צורה, עומק וזכוכית', 'רדיוסים · 3 רמות צל + אגודל · חומר הזכוכית ל-3 רמות עם fallback', 'foundations-shape')}
  <section class="sec"><h2 class="h2">רדיוסים</h2>${pair(() => `<div class="rad">
    <div style="border-radius:var(--sw-r-sm)">sm 10 · פקד</div><div style="border-radius:var(--sw-r-md)">md 16 · אריח</div><div style="border-radius:var(--sw-r-lg)">lg 24 · פאנל</div><div style="border-radius:var(--sw-r-xl)">xl 28 · דיאלוג</div><div style="border-radius:var(--sw-r-pill);width:120px;height:40px">pill 999</div></div>
    <p class="muted" style="font-size:12.5px;margin-top:8px">כלל קינון: רדיוס פנימי = רדיוס חיצוני − ריפוד (פאנל 24 עם ריפוד 14 → אריח 10–16). סרגל 24, אריח סרגל 16, אריח מצלמה 16, KPI 16, צ׳יפ/segment/toggle pill.</p>`)}</section>
  <section class="sec"><h2 class="h2">צללים</h2>${pair(() => `<div class="shad"><div style="box-shadow:var(--sw-shadow-1)">shadow-1 · כרטיס</div><div style="box-shadow:var(--sw-shadow-2)">shadow-2 · hover / popover</div><div style="box-shadow:var(--sw-shadow-3)">shadow-3 · dialog / drawer</div><div style="box-shadow:var(--sw-shadow-thumb);width:44px;height:44px;border-radius:50%;background:#fff"></div></div>
    <table class="mo-table"><tr><th>טוקן</th><th>ערך</th></tr>${['--sw-shadow-1', '--sw-shadow-2', '--sw-shadow-3', '--sw-shadow-thumb', '--sw-highlight'].map((k) => `<tr><td><code>${k}</code></td><td><code style="font-size:11px">${all[k].light}</code><br><code style="font-size:11px">${all[k].dark}</code></td></tr>`).join('')}</table>
    <p class="muted" style="font-size:12.5px">highlight עליון: קו 1px ב-<code>--sw-highlight</code> בקצה העליון של כל זכוכית L1 (12px משני הצדדים). בכהה הוא עדין (.10) — הזכוכית הכהה נבדלת בעיקר בקו השיער ובצל העמוק יותר, לא בהבהוב.</p>`)}</section>
  <section class="sec"><h2 class="h2">חומר הזכוכית</h2>${pair((s) => `<div class="gl-stack" style="height:250px"><span class="blob" style="background:rgb(255 150 40 / .6);top:-20px;inset-inline-start:20px;width:200px;height:200px"></span><span class="blob" style="background:rgb(90 150 255 / .55);bottom:-50px;inset-inline-end:30px;width:220px;height:220px"></span>
      <div class="glass" style="position:absolute;inset:18px 18px 18px 46%;padding:14px"><div class="sec-title">L1 · panel</div><div class="muted" style="font-size:12px">surface · blur(24px) saturate(1.6) · border · shadow-1 · highlight</div>
        <div class="glass-2" style="margin-top:10px;padding:10px"><div style="font-weight:600;font-size:13px">L2 · nested tile</div><div class="muted" style="font-size:12px">surface-2 · blur: none (כלל קינון)</div><div class="inset" style="margin-top:8px;height:30px;display:flex;align-items:center;padding:0 10px;font-size:12px">L3 · surface-3 מסילה / ring</div></div></div>
      <div class="glass solid" style="position:absolute;inset:18px 56% 18px 18px;padding:14px"><div class="sec-title">fallback אטום</div><div class="muted" style="font-size:12px">surface-solid / surface-2-solid / surface-3-solid — אותו layout</div><div class="glass-2 solid" style="margin-top:10px;padding:10px;font-size:13px">L2 אטום</div></div></div>`)}
    <table class="mo-table"><tr><th>רמה</th><th>light</th><th>dark</th><th>blur</th><th>fallback</th></tr>
    <tr><td>L1 panel / card / rail</td><td><code>${all['--sw-surface'].light}</code></td><td><code>${all['--sw-surface'].dark}</code></td><td><code>blur(24px) saturate(1.6)</code>; סרגל/פינה <code>blur(20px)</code>; bottom sheet <code>blur(32px)</code></td><td><code>${all['--sw-surface-solid'].light}</code> / <code>${all['--sw-surface-solid'].dark}</code></td></tr>
    <tr><td>L2 tile inside L1</td><td><code>${all['--sw-surface-2'].light}</code></td><td><code>${all['--sw-surface-2'].dark}</code></td><td>none (זכוכית מקוננת בלי blur)</td><td><code>${all['--sw-surface-2-solid'].light}</code> / <code>${all['--sw-surface-2-solid'].dark}</code></td></tr>
    <tr><td>L3 track / ring / inset</td><td><code>${all['--sw-surface-3'].light}</code></td><td><code>${all['--sw-surface-3'].dark}</code></td><td>none</td><td><code>${all['--sw-surface-3-solid'].light}</code> / <code>${all['--sw-surface-3-solid'].dark}</code></td></tr>
    <tr><td>overlay (scrim)</td><td><code>${all['--sw-overlay'].light}</code></td><td><code>${all['--sw-overlay'].dark}</code></td><td>—</td><td>—</td></tr>
    <tr><td><code>prefers-contrast: more</code></td><td colspan="4">L1 → 94% אטום (<code>--sw-glass-contrast-a</code>), L2 אטום, קווי שיער <code>--sw-border-strong</code>; הצללים נשארים</td></tr>
    <tr><td><code>prefers-reduced-transparency</code> / אין backdrop-filter</td><td colspan="4">כל רמה → הערך ה-solid שלה; אין שינוי layout; ה-highlight נשאר</td></tr>
    <tr><td>אריחי וידאו</td><td colspan="4">לא זכוכית: <code>--sw-video-bg</code> אטום, קו שיער 1px, בלי blur/צל/אנימציה (עד 32 אריחים)</td></tr></table></section>
  </div>`;
  return doc({ title: 'Arx · יסודות · צורה וזכוכית', css: sheetCss, body, label: 'foundations-shape' });
}

// ---------- foundations: motion + focus ----------
export function foundationsMotion() {
  const rows = [
    ['משכים', '<code>--sw-t-fast</code> 120ms · <code>--sw-t-med</code> 220ms · <code>--sw-t-slow</code> 360ms'],
    ['Easing', 'standard <code>cubic-bezier(.2,0,0,1)</code> · enter <code>cubic-bezier(0,0,.2,1)</code> · exit <code>cubic-bezier(.4,0,1,1)</code> · thumb <code>cubic-bezier(.34,1.3,.64,1)</code>'],
    ['Drawer (פאנל צד 360)', 'כניסה: translateX מהקצה ההתחלתי 24px → 0 + opacity, 320ms enter; יציאה 240ms exit; scrim 0 → 1 ב-t-med'],
    ['Bottom sheet (טלפון)', 'כניסה: translateY 100% → 0, 360ms enter; יציאה 260ms exit; גרירה בידית עוקבת אחרי האצבע, שחרור מתחת ל-40% סוגר'],
    ['Dialog', 'כניסה: scale .96 → 1 + opacity, 220ms enter; יציאה 160ms exit; scrim במקביל'],
    ['Popover / תפריט משתמש', 'כניסה: scale .98 + translateY 4px, 160ms enter; יציאה 120ms'],
    ['Tab / segmented thumb', 'האגודל נע (translate) 220ms ב-easing thumb; הטקסט מחליף צבע ב-t-fast'],
    ['Toggle', 'אגודל 220ms thumb-easing; מסילה משנה צבע 220ms standard'],
    ['אריח "דולק" (glow)', 'רקע וגבול 400ms standard (מצב אופטימי מתחיל מיד); halo מופיע אחרון'],
    ['סידור רשימה / grid', 'פריטים שמשנים מקום: transform 220ms standard; פריט נגרר: scale 1.02 + shadow-2 ללא transition'],
    ['Hover lift', '<code>--sw-hover-lift</code> −2px + shadow-2, 120ms; רק לכרטיסים אינטראקטיביים; אף פעם לא לאריחי וידאו'],
    ['כותרת מתכווצת', 'H1 40 → 24 ב-t-med, מופעל ב-scroll ≥ 48px, מבוטל מתחת ל-32px'],
    ['Skeleton / loading', 'shimmer 1.4s liniar, רק בפאנל state=loading; spinner 1s'],
    ['<code>prefers-reduced-motion</code>', 'כל המשכים 0ms; hover lift מבוטל; shimmer סטטי; ה-scrim מופיע מיד'],
  ];
  const body = `<div class="sheet-wrap">
  ${sheetHead('יסודות · תנועה ו-focus', '3 משכים + 4 easings · כניסה/יציאה לכל שכבה · טבעת focus אחת לכל המערכת', 'foundations-motion')}
  <section class="sec"><h2 class="h2">תנועה</h2><div class="pane"><table class="mo-table"><tr><th style="width:220px">מה</th><th>מפרט</th></tr>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table></div></section>
  <section class="sec"><h2 class="h2">Focus ring</h2>${pair((s) => `<div class="demo" style="gap:18px;align-items:flex-start">
      <div><div class="lbl-s">על הקנבס</div><button class="btn secondary focus" style="margin-top:8px">כפתור</button></div>
      <div class="glass" style="padding:14px"><div class="lbl-s">על זכוכית</div><div class="row" style="margin-top:8px;gap:12px"><span class="tg small on focus" style="border-radius:999px"><span class="tr"></span></span><button class="btn primary focus">שמור</button><div class="tile focus" style="width:190px">${I('bulb', { cls: 'ring' })}<span class="tbody"><div class="tname">ספוט סלון</div><div class="tstate">דולק</div></span></div></div></div>
      <div><div class="lbl-s">על וידאו (טבעת כפולה)</div><div class="vid focus-video" style="margin-top:8px"><div class="scene s1"></div><div class="nm" style="position:absolute;bottom:0;inset-inline:0;padding:16px 10px 8px;color:#fff;font-size:12.5px;font-weight:600;background:linear-gradient(to top,rgba(4,8,16,.75),transparent)"><span class="dot live" style="border:1.5px solid #fff"></span> כניסה ראשית</div></div></div>
    </div>
    <table class="mo-table" style="margin-top:12px"><tr><th>כלל</th><th>ערך</th></tr>
    <tr><td>צבע</td><td><code>--sw-focus</code> ${all['--sw-focus'][s]}</td></tr><tr><td>עובי / offset</td><td><code>--sw-focus-w</code> 2px · <code>--sw-focus-offset</code> 2px (outline, לא box-shadow — לא נחתך ב-overflow)</td></tr>
    <tr><td>רדיוס</td><td>עוקב אחרי רדיוס הרכיב (outline עוקב אחרי border-radius)</td></tr><tr><td>על וידאו / תמונה</td><td>טבעת כפולה: 2px <code>--sw-text-inverse</code> פנימי + 2px <code>--sw-focus</code> חיצוני (box-shadow), כדי שתיראה על כל תמונה</td></tr>
    <tr><td>מתי</td><td><code>:focus-visible</code> בלבד (לא בלחיצת עכבר); בתוך שדה — הגבול הופך ל-focus + hالو <code>--sw-accent-soft</code> 3px</td></tr></table>`)}</section>
  </div>`;
  return doc({ title: 'Arx · יסודות · תנועה ו-focus', css: sheetCss, body, label: 'foundations-motion' });
}

// ---------- components sheet ----------
export function componentsSheet() {
  const sec = (title, fn, note = '') => `<section class="sec"><h2 class="h2">${title}</h2>${note ? `<p class="muted" style="font-size:12.5px;max-width:900px">${note}</p>` : ''}<div class="cmp">${pane('light', fn('light'))}${pane('dark', fn('dark'))}</div></section>`;
  const railDemo = () => `<div class="rails">${['s', 'm', 'l', 'xl'].map((p) => `<div><div class="lbl-s" style="margin-bottom:6px">preset ${p}</div>${rail({ preset: p, active: 'home', labels: p !== 's' })}</div>`).join('')}
    <div style="flex:1;min-width:0"><div class="lbl-s" style="margin-bottom:6px">פינה צפה · אווטאר</div><div class="row" style="gap:10px;position:relative;margin-bottom:6px"><span class="corner" style="position:static">${corner().replace('<div class="corner">', '').replace('</div>', '')}</span><span class="corner" style="position:static">${corner({ health: 'warn' }).replace('<div class="corner">', '').replace('</div>', '')}</span><span class="corner" style="position:static">${corner({ health: 'error' }).replace('<div class="corner">', '').replace('</div>', '')}</span><span class="avatar lg">יו<i class="adot"></i></span><span class="avatar">Da</span></div>
    <div class="lbl-s" style="margin:14px 0 6px">פס תחתון (טלפון 390)</div><div class="phone-frame" style="max-width:100%">${bottomBar({ active: 'security' })}</div>
    <div class="lbl-s" style="margin:14px 0 6px">מראה LTR</div><div class="phone-frame ltr" dir="ltr" style="max-width:100%">${bottomBar({ active: 'home' })}</div></div></div>
    <div class="lbl-s" style="margin-top:12px">מצבי פריט (preset l) · rest / hover / active / focus / בלי תווית</div><div class="glass rail-l" style="display:flex;gap:8px;padding:10px;width:max-content;max-width:100%">${[['rest', ''], ['hover', 'hover'], ['active', 'active'], ['focus', 'focus']].map(([n, c]) => `<div style="width:72px;text-align:center"><a class="rail-item ${c}" style="width:72px">${I('shield')}<span>אבטחה</span></a><div class="lbl-s" style="margin-top:6px">${n}</div></div>`).join('')}<div style="width:72px;text-align:center"><a class="rail-item nolabel" style="width:72px">${I('map')}</a><div class="lbl-s" style="margin-top:6px">no label</div></div></div>`;

  const tabsDemo = () => `<div class="demo col">
    <div class="lbl-s">pill · rest / active / hover / focus / גלישה עם דהייה</div>
    <div class="tabs fade" style="max-width:520px"><span class="tab on">סלון <span class="n">13</span></span><span class="tab hover">מטבח <span class="n">8</span></span><span class="tab focus">חדר ילדים</span><span class="tab">חדר שינה הורים</span><span class="tab">משרד</span><span class="tab">מרפסת</span><span class="tab">מחסן</span></div>
    <div class="lbl-s">underline (טלפון / הגדרות)</div><div class="tabs underline" style="max-width:420px"><span class="tab on">תמונת מצב</span><span class="tab">כל המצלמות</span><span class="tab hover">תצוגות שמורות</span><span class="tab focus">בריאות</span></div>
    <div class="lbl-s">segmented · 2 ו-3 קטעים · disabled · סרגל מקטעים</div><div class="demo"><div class="seg"><button class="on">אריחים</button><button>כרטיסים</button></div><div class="seg"><button>קירור</button><button class="on">חימום</button><button>אוטו</button></div><div class="seg disabled"><button class="on">מחשב</button><button>טלפון</button></div><div class="seg lg"><button class="on">${I('camera')}לייב</button><button>${I('clockHistory')}חקירה</button><button>${I('siren')}אזעקה</button></div></div>
    <div class="lbl-s">LTR</div><div dir="ltr" class="ltr demo"><div class="tabs"><span class="tab on">Living room</span><span class="tab">Kitchen</span></div><div class="seg"><button class="on">Tiles</button><button>Cards</button></div></div></div>`;

  const cardDemo = () => `<div class="demo" style="align-items:stretch">
    <div class="glass card" style="width:220px"><div class="sec-title">rest</div><div class="muted" style="font-size:12.5px">כרטיס זכוכית L1</div></div>
    <div class="glass card lift interactive" style="width:220px;transform:translateY(-2px);box-shadow:var(--sw-shadow-2)"><div class="sec-title">hover (interactive)</div><div class="muted" style="font-size:12.5px">lift −2px · shadow-2</div></div>
    <div class="glass card flush" style="width:220px"><div class="scene s6" style="position:relative;height:70px"></div><div style="padding:10px 14px"><div class="sec-title">flush</div></div></div>
    <div class="glass card" style="width:260px"><div class="card-head"><span class="dbadge" style="--role:var(--sw-role-warm);--role-fg:var(--sw-role-warm-fg)">${I('bulb')}</span><h3 class="sec-title">עם כותרת <span class="count num">2 מתוך 6</span></h3><button class="btn ghost sm">${I('power')}כבה הכל</button></div><div class="tile">${I('bulb', { cls: 'ring' })}<span class="tbody"><div class="tname">תוכן</div><div class="tstate">כבוי</div></span></div></div></div>`;

  const kpiDemo = () => `<div class="demo col"><div class="lbl-s">compact · tone neutral / live / stale / forbidden · badge · expanded</div>
    <div class="demo" style="display:grid;grid-template-columns:repeat(3,1fr)">${kpi({ ic: 'bolt', v: '0/32', l: 'מתגים פעילים' }).replace('class="kpi', 'class="kpi glass')}${kpi({ ic: 'lock', v: '1/1', l: 'מנעולים נעולים', d: 'הכול נעול', tone: 'live' }).replace('class="kpi', 'class="kpi glass')}${kpi({ ic: 'camera', v: '14/16', l: 'מצלמות · 2 לא מעודכנות', tone: 'stale' }).replace('class="kpi', 'class="kpi glass')}${kpi({ ic: 'eyeOff', v: '2', l: 'ללא הרשאה', tone: 'forbidden' }).replace('class="kpi', 'class="kpi glass')}
    <button class="kpi glass accent"><span class="ring">${I('bell')}</span><span class="tbody"><span class="kv num">12</span><div class="kl">אירועים · 24 שע׳</div></span><span class="badge count">3</span></button>
    <button class="kpi glass warm focus" aria-expanded="true"><span class="ring">${I('bulb')}</span><span class="tbody"><span class="kv num">16/48</span><div class="kl">תאורה דולקת</div></span>${I('chevron', { cls: 'faint', size: 18 })}</button></div>
    <div class="lbl-s">cards layout · hover</div><div class="demo">${kpi({ ic: 'layers', v: '8/16', l: 'תריסים פתוחים', tone: 'accent' }).replace('class="kpi', 'class="kpi glass cards').replace('<button', '<button style="width:170px"')}${kpi({ ic: 'wave', v: '8/8', l: 'מיזוג פעיל', tone: 'cool' }).replace('class="kpi', 'class="kpi glass cards lift').replace('<button', '<button style="width:170px;transform:translateY(-2px);box-shadow:var(--sw-shadow-2)"')}</div></div>`;

  const btnDemo = () => `<div class="demo col">${['primary', 'secondary', 'ghost', 'danger'].map((v) => `<div class="demo"><span class="lbl-s" style="width:70px;direction:ltr;text-align:start">${v}</span><button class="btn ${v} sm">${I('power')}קטן</button><button class="btn ${v}">${I('power')}בינוני</button><button class="btn ${v} lg">${I('power')}גדול · 44</button><button class="btn ${v} hover">hover</button><button class="btn ${v} focus">focus</button><button class="btn ${v}" disabled>disabled</button><button class="btn ${v} icon" aria-label="icon">${I('dots')}</button><button class="btn ${v} icon round lg" aria-label="round">${I('plus')}</button></div>`).join('')}
    <div class="demo"><span class="lbl-s" style="width:70px">master</span><span class="master">${I('power')}</span><span class="master on">${I('power')}</span><span class="master">${I('power')}<span class="badge count">3</span></span><span class="lbl-s">כבוי / דולק / חלקי (44px עגול)</span></div>
    <p class="muted" style="font-size:12px">יעד מגע: כל כפתור במסך מפעיל מקבל <code>.touch</code> — אזור לחיצה ≥ 44×44 גם כשהגודל החזותי 30/36.</p></div>`;

  const chipDemo = () => `<div class="demo"><span class="chip">לא נבחר</span><span class="chip sel">נבחר</span><span class="chip">עם ספירה <span class="n num">12</span></span><span class="chip"><span class="dot live"></span>עם נקודה</span><span class="chip">${I('wave')}עם אייקון</span><span class="chip warm">${I('wave')}מזגן לובי · קירור · <span class="num">22°</span></span><span class="chip focus">focus</span><span class="chip disabled">disabled</span></div>
  <div class="lbl-s">badges (10 סוגים · תמיד עם טקסט)</div><div class="demo">${['live·חי', 'recorded·מוקלט', 'historic·היסטורי', 'offline·מנותק', 'stale·לא מעודכן', 'unknown·לא ידוע', 'forbidden·ללא הרשאה', 'error·שגיאה', 'partial·חלקי', '·נתוני הדגמה'].map((s) => { const [k, t] = s.split('·'); return `<span class="badge ${k}"><span class="dot"></span>${t}</span>`; }).join('')}<span class="badge image" style="background:#0f1729">${I('snapshot', { size: 12 })}צילום · on image</span><span class="badge count">3</span></div>`;

  const toggleDemo = () => `<div class="demo" style="gap:22px"><label class="tg on"><span class="tr"></span>דולק</label><label class="tg"><span class="tr"></span>כבוי</label><label class="tg on disabled"><span class="tr"></span>disabled</label><label class="tg focus" style="border-radius:999px"><span class="tr"></span>focus</label><span class="tg small on" aria-label="ללא תווית"><span class="tr"></span></span><span class="tg small" aria-label="ללא תווית"><span class="tr"></span></span><span dir="ltr" class="ltr tg small on"><span class="tr"></span></span><span class="lbl-s">← LTR</span></div>`;

  const dialogDemo = () => `<div class="demo" style="align-items:flex-start">
    <div class="glass dialog" style="width:400px"><div class="row between" style="margin-bottom:12px"><span class="sec-title">הוספה לתצוגה</span><button class="btn ghost icon sm" aria-label="סגור">${I('x')}</button></div><div class="field"><label>שם התצוגה</label><div class="in">קיר כניסה</div></div><div class="field" style="margin-top:10px"><label>פריסה</label><div class="seg" style="align-self:flex-start"><button>4</button><button class="on">9</button><button>16</button></div></div><div class="acts"><button class="btn ghost">ביטול</button><button class="btn primary">שמור</button></div></div>
    <div class="glass dialog" style="width:400px"><div class="q">לכבות <span class="num">16</span> התקנים בבניין?</div><div class="muted" style="margin-top:6px">מנעולים ואזעקה לא נכללים</div><div class="acts"><button class="btn ghost lg">ביטול</button><button class="btn danger fill lg">${I('power')}כבה הכל</button></div><div class="details">${I('chevron', { size: 14 })}פרטים</div></div>
    <div class="glass dialog" style="width:400px;border-color:var(--sw-border-strong)"><div class="row" style="gap:8px;margin-bottom:8px">${I('lock', { cls: 'faint' })}<span class="sec-title">locked · הפעולה רצה</span></div><div class="skeleton" style="height:8px;width:60%"></div><div class="muted" style="margin-top:10px;font-size:12.5px"><span class="num">9</span> מתוך <span class="num">16</span> הושלמו</div></div></div>`;

  const drawerDemo = () => `<div class="demo" style="align-items:flex-start">
    <div class="glass drawer" style="height:300px"><div class="row between"><span class="sec-title">מצלמת לובי</span><button class="btn ghost icon sm">${I('x')}</button></div><div class="vid" style="width:100%;height:150px"><div class="scene s2"></div></div><button class="btn primary">${I('play')}צפה בשידור חי</button><div class="lbl-s">פאנל צד 360 · desktop</div></div>
    <div class="phone-frame" style="height:300px;display:flex;align-items:flex-end"><div class="glass sheet"><div class="handle"></div><div class="sec-title" style="margin-bottom:8px">תאורת תקרה</div><div class="tile on">${I('bulb', { cls: 'ring' })}<span class="tbody"><div class="tname">בהירות</div><div class="tstate">60%</div></span><span class="tctl">${tg(true)}</span></div><div style="margin-top:10px">${slider(60)}</div><div class="lbl-s" style="margin-top:8px">bottom sheet עם ידית · טלפון</div></div></div>
    <div class="glass drawer" style="width:300px;height:300px;border-radius:var(--sw-r-xl)"><div class="sec-title">modal 480 (מוקטן)</div><div class="muted" style="font-size:12.5px">שכבה עליונה, focus trapped, scrim <code>--sw-overlay</code></div><div class="field"><label>סינון</label><div class="in ph">חפש התקן…</div></div><div class="row"><span class="master on">${I('power')}</span><span class="grow"><b>כל התאורה בקומה</b><div class="muted" style="font-size:12px"><span class="num">6</span> דולקים</div></span></div></div></div>`;

  const fieldDemo = () => `<div class="demo" style="align-items:flex-start;gap:16px">
    <div class="field" style="width:200px"><label>rest</label><div class="in ph">שם התצוגה</div></div>
    <div class="field focus" style="width:200px"><label>focus</label><div class="in">קיר כניסה</div></div>
    <div class="field error" style="width:200px"><label>error</label><div class="in">קיר כניסה!</div><span class="hint">השם כבר קיים</span></div>
    <div class="field disabled" style="width:200px"><label>disabled</label><div class="in">לא ניתן לערוך</div></div>
    <div class="field ro" style="width:200px"><label>read-only</label><div class="in">Hikvision DS-7616</div></div>
    <div class="field inline" style="width:320px"><label>inline</label><div class="in grow">360</div></div></div>`;

  const tileDemo = () => `<div class="demo col"><div class="lbl-s">אריח התקן · off / on קר (תאורה) / on חם (אזור-תריס) / on ירוק (מתג) / לא זמין / pending</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${tile({ name: 'מנורת קריאה', state: 'כבוי', ic: 'bulb', ctl: tg(false) })}${tile({ name: 'תאורת תקרה', state: 'דולק · 60%', ic: 'bulb', on: true, kind: 'cool', ctl: tg(true), col: true, extra: slider(60) })}${tile({ name: 'וילון סלון', state: 'פתוח · 60%', ic: 'layers', on: true, kind: 'warm', ctl: `<span class="cover-ctl"><button class="btn">${I('up')}</button><button class="btn">${I('stop')}</button><button class="btn">${I('down')}</button></span>` })}${tile({ name: 'מערכת הגברה', state: 'פעיל', ic: 'bolt', on: true, kind: 'switch', ctl: tg(true) })}${tile({ name: 'מאוורר תקרה', state: 'לא זמין', ic: 'fan', unavail: true, ctl: tg(false, ' disabled') })}${tile({ name: 'שקע יציע', state: 'מדליק…', ic: 'bolt', ctl: `<span class="tg small on" style="opacity:.7"><span class="tr"></span></span>` })}</div>
    <div class="lbl-s">אריח אזור (בית) · off / on · אריח מצלמה ×7 (אותה משפחה: רדיוס 16, שם + נקודה)</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${areaTile({ name: 'מטבח', c: [['bulb', '0/4'], ['bolt', '0/2']] })}${areaTile({ name: 'סלון', on: true, c: [['bulb', '4/6'], ['wave', '1/1']] })}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px">${[['כניסה ראשית', 'live', 's1'], ['מחסן', 'snapshot', 's2'], ['מעלית', 'connecting', ''], ['שער', 'offline', ''], ['גג', 'forbidden', ''], ['לובי', 'unknown', ''], ['חניון', 'stale', 's3']].map((c) => `<div style="aspect-ratio:16/9;display:grid">${camTile(c)}</div>`).join('')}<div style="aspect-ratio:16/9;display:grid">${camTile(['אולם · selected', 'live', 's5'], { sel: true })}</div></div></div>`;

  const stateDemo = () => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${[['loading', 'loader', 'טוען…', ''], ['empty', 'inbox', 'אין התקנים באזור', 'התקנים שישויכו יופיעו כאן'], ['error', 'alert', 'לא ניתן לטעון', 'תשתית המערכת לא הגיבה'], ['forbidden', 'eyeOff', 'אין הרשאה למסך הזה', ''], ['stale', 'clockHistory', 'הנתונים לא מעודכנים', 'עדכון אחרון לפני 6 דק׳'], ['partial', 'info', 'חלק מהמקורות לא זמינים', '2 מתוך 3 מקורות']].map(([s, ic, t, h]) => `<div class="glass"><div class="state ${s}" style="padding:22px 12px"><span class="sic">${I(ic, { cls: s === 'loading' ? 'spin' : '' })}</span><div class="st" style="font-size:15px">${t}</div>${h ? `<div class="sh" style="font-size:12.5px">${h}</div>` : ''}</div></div>`).join('')}</div>`;

  const body = `<div class="sheet-wrap" style="max-width:1400px">
  ${sheetHead('גיליון רכיבים', 'כל רכיב בכל מצב · light ו-dark זה לצד זה · RTL (+ LTR לכיווניים)', 'components · RTL first')}
  ${sec('סרגל צד · פינה · אווטאר · פס תחתון', railDemo, 'רוחב הסרגל = התווית הרחבה ביותר. פריט פעיל: מילוי accent-soft + פס 3px בקצה ההתחלה. הסרגל הוא זכוכית L1 צפה (blur 20px) על הקנבס; בטלפון — פס תחתון זכוכית עם pill למצב פעיל.')}
  ${sec('לשוניות · segmented · סרגל מקטעים', tabsDemo)}
  ${sec('כרטיס', cardDemo)}
  ${sec('אריח KPI', kpiDemo)}
  ${sec('כפתורים', btnDemo)}
  ${sec('צ׳יפים ו-badges', chipDemo)}
  ${sec('Toggle', toggleDemo, 'מסילה 46×28 (טלפון: אותו גודל), אגודל 22, ירוק כשדולק; יעד המגע 44 (ריפוד שקוף). האגודל נע לקצה הסוף — מתהפך ב-LTR.')}
  ${sec('אריחים: התקן · אזור · מצלמה', tileDemo, 'אריח וידאו אינו זכוכית: רקע אטום, קו שיער, בלי blur/צל/אנימציה. מצבי אריח בצורה + טקסט: מנותק = מסגרת מקווקוות + אייקון + סיבה; ללא הרשאה = מילוי מפוספס + "אין הרשאה"; צילום = צ׳יפ על התמונה; לא מעודכן = צ׳יפ ענבר עם זמן.')}
  ${sec('דיאלוג · אישור "כבה הכל" · locked', dialogDemo, 'אישור = שאלה עם ספירה + שורת סייג אחת + 2 כפתורים (danger primary) + "פרטים" מקופל. אין פסקאות.')}
  ${sec('Drawer · bottom sheet · modal', drawerDemo)}
  ${sec('שדה טופס', fieldDemo)}
  ${sec('פאנל מצב ×6', stateDemo)}
  </div>`;
  return doc({ title: 'Arx · גיליון רכיבים', css: sheetCss + areaCss, body, label: 'components' });
}

// ---------- area states board ----------
export function areaStatesBoard() {
  const frame = (state, label, note) => `<section class="sec"><div class="states-label"><span class="badge ${state === 'error' ? 'error' : state === 'unavailable' ? 'stale' : state === 'readonly' ? 'historic' : 'neutral'}">${label}</span><span class="muted" style="font-size:12.5px">${note}</span></div><div class="states-frame">${shell({ active: 'home', content: areaContent({ state }) })}</div></section>`;
  const body = `<div style="padding:26px 30px 40px;display:flex;flex-direction:column;gap:22px">
    <header class="sheet-head"><div><h1 class="h1" style="font-size:34px">מסך האזור · לוח מצבים</h1><div class="sub">loading · empty · error · unavailable · read-only — 1440, light. כל מצב בצורה + טקסט, לא בצבע בלבד.</div></div><span class="tag faint" style="direction:ltr">area-states · 1440 · light</span></header>
    ${frame('loading', 'loading', 'שלד של 3 כרטיסי תחום; הכותרת והלשוניות כבר מוצגות')}
    ${frame('empty', 'empty', 'אזור בלי התקנים — פאנל מצב אחד, שורת רמז אחת, בלי שם פלטפורמה')}
    ${frame('error', 'error', 'שגיאת טעינה עם "נסה שוב"')}
    ${frame('unavailable', 'unavailable', 'תחום שלם לא זמין (תריסים: מסגרת compact עם אייקון וסיבה) + התקן בודד לא זמין (מאוורר תקרה: מקווקו, פקד מושבת, סיבה ב-tooltip)')}
    ${frame('readonly', 'read-only (צופה)', 'אריחים ללא פקדים, "כבה הכל" ופקדי המיזוג לא מוצגים (לא אפורים) — נראות לפי הרשאות')}
  </div>`;
  return doc({ title: 'Arx · מסך האזור · מצבים', css: sheetCss + areaCss, body, label: 'area-states' });
}

// ---------- index ----------
export function indexPage(boards) {
  const groupsIdx = [
    ['יסודות', boards.filter((b) => b.file.startsWith('foundations'))],
    ['רכיבים', boards.filter((b) => b.file.startsWith('components'))],
    ['הבית — מרכז בקרה', boards.filter((b) => b.file.startsWith('home'))],
    ['מסך אזור', boards.filter((b) => b.file.startsWith('area-') && !b.file.startsWith('area-states'))],
    ['קיר מצלמות', boards.filter((b) => b.file.startsWith('wall'))],
    ['לוח מצבים', boards.filter((b) => b.file.startsWith('area-states'))],
  ];
  const body = `<div class="sheet-wrap">
  <header class="sheet-head"><div><h1 class="h1" style="font-size:34px">Arx · כיוון "הייטק Domus"</h1><div class="sub">משימת השוואה, סבב 1 · יסודות + גיליון רכיבים + 3 מסכים × 1440/390 × light/dark + לוח מצבים</div></div><span class="tag">entrant-claude · boards</span></header>
  <div class="row" style="gap:8px"><button class="btn secondary" onclick="document.documentElement.dataset.scheme='light'">light</button><button class="btn secondary" onclick="document.documentElement.dataset.scheme='dark'">dark</button><a class="btn ghost" href="../RATIONALE_HE.md">RATIONALE_HE.md</a><a class="btn ghost" href="../tokens.json">tokens.json</a><a class="btn ghost" href="../tokens.css">tokens.css</a><a class="btn ghost" href="../CHECKLIST.md">CHECKLIST.md</a></div>
  ${groupsIdx.map(([t, list]) => `<section class="sec"><h2 class="h2">${t}</h2><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${list.map((b) => `<a class="glass card lift" href="${b.file}" style="display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit"><img src="../renders/${b.file.replace('.html', '.png')}" alt="" style="width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:10px;border:1px solid var(--sw-border)"><b style="font-size:13px;direction:ltr;text-align:start">${b.file.replace('.html', '')}</b><span class="faint" style="font-size:12px;direction:ltr;text-align:start">${b.w}×${b.h}${b.full ? ' · full page' : ''}</span></a>`).join('')}</div></section>`).join('')}
  </div>`;
  return doc({ title: 'Arx · לוחות העיצוב', css: sheetCss, body });
}
