import { icon as I } from './icons.mjs';
import { getGroups, getAll } from './tokens.mjs';
import { current, skinIds, skins } from './skin.mjs';
import { doc, rail, bottomBar, corner, shell, areaContent, areaCss, listCss, camTile, tile, tg, kpi, areaTile, slider, roomCard, fbtn, viewSeg } from './screens.mjs';

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
.shad div{width:150px;height:90px;border-radius:var(--sw-r-md);background:var(--sw-surface-solid);border:1px solid var(--sw-border);display:grid;place-items:center;font:500 11px var(--sw-font-mono);color:var(--sw-text-2)}
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
.skinbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
`;

const contrastJs = `
<script>
(function(){
  function parse(c){c=c.trim();var m;
    if((m=c.match(/^#([0-9a-f]{6})$/i))){var n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255,1];}
    if((m=c.match(/^rgba?\\(([^)]+)\\)$/i))){var p=m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);return [p[0],p[1],p[2],p.length>3?p[3]:1];}
    if(c==='transparent')return [0,0,0,0];
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

const sheetHead = (title, sub, tag) => `<header class="sheet-head"><div><h1 class="h1" style="font-size:34px">${title}</h1><div class="sub">${sub}</div></div><span class="tag">${tag} · ${current().id}</span></header>`;

function pane(scheme, inner, extraCls = '') {
  return `<div class="pane scheme-${scheme} ${extraCls}" data-scheme="${scheme}"><span class="pl">${scheme}</span>${inner}</div>`;
}
function pair(innerFn, cls = '') { return `<div class="pair">${pane('light', innerFn('light'), cls)}${pane('dark', innerFn('dark'), cls)}</div>`; }
const rgbOf = (trip, a) => `rgba(${trip.split(' ').join(',')},${a})`;

// ---------- foundations: colour ----------
export function foundationsColor() {
  const all = getAll(); const skin = current();
  const colourGroups = getGroups().filter((g) => ['surface', 'text', 'accent', 'state', 'glow', 'role', 'canvas'].includes(g.id));
  const isColour = (v) => /^(#|rgb|\d+ \d+ \d+$)/.test(v) || v.includes('gradient');
  const swatch = (v) => (/^\d+ \d+ \d+$/.test(v) ? `<i style="background:rgb(${v})"></i>` : `<i style="background:${v}"></i>`);
  const rows = colourGroups.map((g) => `<section class="sec"><h2 class="h2">${g.title}</h2>
    <div class="trow2" style="border-bottom-width:2px"><span class="faint">token</span><span class="faint">light</span><span class="faint">dark</span></div>
    ${Object.entries(g.tokens).map(([k, v]) => `<div class="trow2"><span class="tn">${k}</span>
      <span class="sw scheme-light" style="background:none;padding:2px 0">${isColour(v.light) ? swatch(v.light) : ''}<code>${v.light}</code></span>
      <span class="sw scheme-dark" style="background:none;padding:2px 0">${isColour(v.dark) ? swatch(v.dark) : ''}<code>${v.dark}</code></span></div>`).join('')}</section>`).join('');

  // contrast pairs: [label, fg, bg-layers, min]. Layers are composited bottom-up over the real canvas colour.
  const pairs = (s) => {
    const bloom = skin.bloom ? [
      ['גוף על L1 · הקנבס בנקודה הבהירה ביותר', '--sw-text', `--sw-surface>${skin.bloom[s]}>--sw-bg`, 4.5],
      ['כיתוב על L1 · הקנבס בנקודה הבהירה ביותר', '--sw-text-3', `--sw-surface>${skin.bloom[s]}>--sw-bg`, 4.5],
    ] : [];
    const onFill = (trip) => rgbOf(all[trip][s], all['--sw-glow-fill-start'][s] === '0' ? 0 : all['--sw-glow-fill-start'][s]);
    return [
      ['גוף על L1 · קנבס', '--sw-text', '--sw-surface>--sw-bg', 4.5],
      ...bloom,
      ['משני על L1', '--sw-text-2', '--sw-surface>--sw-bg', 4.5],
      ['כיתוב (text-3) על L1', '--sw-text-3', '--sw-surface>--sw-bg', 4.5],
      ['גוף על fallback אטום', '--sw-text', '--sw-surface-solid', 4.5],
      ['כיתוב על fallback אטום', '--sw-text-3', '--sw-surface-solid', 4.5],
      ['משני על L2 בתוך L1', '--sw-text-2', '--sw-surface-2>--sw-surface>--sw-bg', 4.5],
      ['כיתוב על L2 בתוך L1', '--sw-text-3', '--sw-surface-2>--sw-surface>--sw-bg', 4.5],
      ['גוף על L3 (מסילה)', '--sw-text', '--sw-surface-3>--sw-surface>--sw-bg', 4.5],
      ['כיתוב על L3 (קבוצת רשימה)', '--sw-text-3', '--sw-surface-3>--sw-surface>--sw-bg', 4.5],
      ['משני על הקנבס', '--sw-text-2', '--sw-bg', 4.5],
      ['accent-text על L1', '--sw-accent-text', '--sw-surface>--sw-bg', 4.5],
      ['accent-text על accent-soft', '--sw-accent-text', '--sw-accent-soft>--sw-surface>--sw-bg', 4.5],
      ['טקסט כפתור ראשי על accent', skin.primaryText[s], '--sw-accent', 4.5],
      ['טקסט הפוך על segment נבחר (Tesla) / כותרת על thumb', s === 'light' ? '--sw-heading' : '--sw-heading', '--sw-surface-2-solid', 4.5],
      ['live-text על live-soft (badge)', '--sw-live-text', '--sw-live-soft>--sw-surface>--sw-bg', 4.5],
      ['stale-text על stale-soft', '--sw-stale-text', '--sw-stale-soft>--sw-surface>--sw-bg', 4.5],
      ['danger-text על danger-soft (כפתור danger)', '--sw-danger-text', '--sw-danger-soft>--sw-surface>--sw-bg', 4.5],
      ['forbidden-text על forbidden-soft', '--sw-forbidden-text', '--sw-forbidden-soft>--sw-surface>--sw-bg', 4.5],
      ['offline-text על offline-soft', '--sw-offline-text', '--sw-offline-soft>--sw-surface>--sw-bg', 4.5],
      ['unknown-text על unknown-soft', '--sw-unknown-text', '--sw-unknown-soft>--sw-surface>--sw-bg', 4.5],
      ['purple-text על מילוי partial', '--sw-purple-text', 'rgba(124,92,240,.14)>--sw-surface>--sw-bg', 4.5],
      ['live-text (KPI "הכול נעול") על L1', '--sw-live-text', '--sw-surface>--sw-bg', 4.5],
      ['warm-fg על מילוי warm (צ׳יפ)', '--sw-role-warm-fg', `${rgbOf(all['--sw-role-warm'][s], all['--sw-role-fill-a'][s])}>--sw-surface>--sw-bg`, 4.5],
      ['success-fg על מילוי success', '--sw-role-success-fg', `${rgbOf(all['--sw-role-success'][s], all['--sw-role-fill-a'][s])}>--sw-surface>--sw-bg`, 4.5],
      ['accent-fg על מילוי accent', '--sw-role-accent-fg', `${rgbOf(all['--sw-role-accent'][s], all['--sw-role-fill-a'][s])}>--sw-surface>--sw-bg`, 4.5],
      ['כותרת על אריח "דולק" (חם)', '--sw-heading', `${onFill('--sw-on-warm')}>--sw-surface-2>--sw-surface>--sw-bg`, 4.5],
      ['גוף על אריח "דולק" (קר)', '--sw-text', `${onFill('--sw-on-cool')}>--sw-surface-2>--sw-surface>--sw-bg`, 4.5],
      ['שם מצלמה (לבן) על scrim וידאו', '#ffffff', 'rgba(4,8,16,.78)>#6d7d6b', 4.5],
      ['אייקון live (נקודה) על L1 · 3:1', '--sw-live', '--sw-surface>--sw-bg', 3],
      ['אייקון stale (נקודה) על L1 · 3:1', '--sw-stale', '--sw-surface>--sw-bg', 3],
      ['אייקון danger על L1 · 3:1', '--sw-danger', '--sw-surface>--sw-bg', 3],
      ['מסילת toggle דולק על L2 · 3:1', '--sw-toggle-on', '--sw-surface-2>--sw-surface>--sw-bg', 3],
      ['accent (אייקון, פס פעיל) על הקנבס · 3:1', '--sw-accent', '--sw-bg', 3],
      ['focus ring על הקנבס · 3:1', '--sw-focus', '--sw-bg', 3],
    ];
  };
  const contrast = pair((s) => `<div class="cgrid">${pairs(s).map(([l, fg, bg, min]) => `<div data-pair="${fg}|${bg}" data-min="${min}"><div class="cc"><span class="lbl">${l}</span><span class="val">…</span></div></div>`).join('')}</div>`);
  const stack = (s) => `<div class="gl-stack">${skin.bloom ? `<span class="blob" style="background:rgb(${all['--sw-on-warm'][s]} / .55);top:-30px;inset-inline-start:40px"></span><span class="blob" style="background:rgb(${all['--sw-on-cool'][s]} / .5);bottom:-40px;inset-inline-end:60px"></span>` : ''}
    <div class="glass" style="position:absolute;inset:22px 22px 22px 40%;padding:14px"><div class="sec-title">L1 · פאנל</div><div class="glass-2" style="margin-top:10px;padding:10px"><span class="muted">L2 · אריח מקונן</span><div class="inset" style="margin-top:8px;height:32px;display:flex;align-items:center;padding:0 10px;font-size:12.5px">L3 · מסילה / inset</div></div></div>
    <div class="glass solid" style="position:absolute;inset:22px 62% 22px 22px;padding:14px"><div class="sec-title">fallback אטום</div><div class="muted" style="font-size:12.5px;margin-top:6px">בלי backdrop-filter, prefers-reduced-transparency</div></div></div>`;

  const body = `<div class="sheet-wrap">
  ${sheetHead('יסודות · צבע', `${skin.nameHe} · קנבס, 3 רמות משטח + fallback אטום, קווי שיער, טקסט ×5, accent, 9 צבעי מצב + soft, "דולק", 7 תפקידי צבע, קנבס תוכנית`, 'foundations-color · light + dark')}
  <section class="sec"><h2 class="h2">ניגודיות מחושבת (WCAG, מורכב על הקנבס בפועל)</h2><p class="muted" style="max-width:900px">כל צמד מחושב בזמן פתיחת הלוח מתוך הטוקנים של הסקין: המשטחים מורכבים על צבע הבסיס של הקנבס${skin.bloom ? ' (ובמקרה הגרוע — על הנקודה הבהירה ביותר של הגרדיאנט)' : ''}, L2 מורכב על L1. AA = ≥ 4.5:1 לטקסט גוף; AA-large = ≥ 3:1 לאייקונים, מסילות ומחווני מצב.</p>${contrast}</section>
  <section class="sec"><h2 class="h2">הקנבס והחומר — ${skin.copy.material}</h2><p class="muted" style="max-width:900px">${skin.copy.canvasNote} ${skin.copy.materialNote}</p>${pair(stack)}</section>
  ${rows}
  </div>${contrastJs}`;
  return doc({ title: 'Arx · יסודות · צבע', scheme: 'light', css: sheetCss, body, label: 'foundations-color', fontPrefix: fontPrefixFor() });
}

const fontPrefixFor = () => (current().id === 'domus' ? 'fonts/' : '../fonts/');
const px = (k) => getAll()[k].light;

// ---------- foundations: type ----------
export function foundationsType() {
  const skin = current();
  const scale = [
    ['H1 עמוד / שם חדר', 'הבית של רון', `--sw-h1 ${px('--sw-h1')} (phone ${px('--sw-h1-phone')}) · ${px('--sw-h1-weight')} · lh ${px('--sw-h1-lh')} · tracking ${px('--sw-h1-tracking')}`, 'font-size:var(--sw-h1);font-weight:var(--sw-h1-weight);letter-spacing:var(--sw-h1-tracking);line-height:var(--sw-h1-lh);color:var(--sw-heading)'],
    ['H2 קומה / דיאלוג', 'לכבות 16 התקנים בבניין?', `--sw-h2 ${px('--sw-h2')} · tracking ${px('--sw-h2-tracking')}`, 'font-size:var(--sw-h2);letter-spacing:var(--sw-h2-tracking);color:var(--sw-heading)'],
    ['כותרת מקטע', 'תאורה <span class="count muted" style="font-weight:400;font-size:12.5px">6 התקנים</span>', `--sw-fs-section ${px('--sw-fs-section')} · ${px('--sw-fw-section')}`, 'font-size:var(--sw-fs-section);font-weight:var(--sw-fw-section);color:var(--sw-heading)'],
    ['שם חדר בכרטיס', 'חדר שינה הורים', `--sw-fs-2xl ${px('--sw-fs-2xl')} · 700`, 'font-size:var(--sw-fs-2xl);font-weight:700;color:var(--sw-heading)'],
    ['שם התקן / אריח', 'תאורת תקרה', `--sw-fs-md ${px('--sw-fs-md')} · 600`, 'font-size:var(--sw-fs-md);font-weight:600;color:var(--sw-heading)'],
    ['גוף', 'שורה מציגה את הדבר, את מצבו ואת הפקד', `--sw-fs-md ${px('--sw-fs-md')} · 400 · lh ${px('--sw-lh')}`, 'font-size:var(--sw-fs-md)'],
    ['משני / מצב', 'דולק · 60%', `--sw-fs-sm ${px('--sw-fs-sm')} · 400 · text-2`, 'font-size:var(--sw-fs-sm);color:var(--sw-text-2)'],
    ['כיתוב / תווית ווידג׳ט', 'מזג אוויר · לחות 61%', `--sw-fs-xs ${px('--sw-fs-xs')} · 600 · text-3 · tracking .3px`, 'font-size:var(--sw-fs-xs);font-weight:600;color:var(--sw-text-3);letter-spacing:.3px'],
    ['ספרות טבלאיות', '<span class="num">16/48 · 08:15 · 24.5°</span>', 'font-variant-numeric: tabular-nums · direction ltr', 'font-size:22px;font-weight:700;color:var(--sw-heading)'],
    ['קריאה גדולה (שעון)', '<span class="num">15:33</span><small style="font-size:.42em;color:var(--sw-text-3);font-weight:500;letter-spacing:0">38</small>', `--sw-fs-reading ${px('--sw-fs-reading')} (phone ${px('--sw-fs-reading-phone')}) · ${px('--sw-fw-reading')} · tracking ${px('--sw-reading-tracking')}`, 'font-size:var(--sw-fs-reading);font-weight:var(--sw-fw-reading);letter-spacing:var(--sw-reading-tracking);line-height:1;color:var(--sw-heading)'],
    ['קריאה גדולה (טמפרטורה)', '<span class="num">23°</span>', `--sw-fs-reading · ${px('--sw-fw-reading')}`, 'font-size:var(--sw-fs-reading);font-weight:var(--sw-fw-reading);letter-spacing:var(--sw-reading-tracking);line-height:1;color:var(--sw-heading)'],
    ['מונו (מזהים, חותמות זמן — מסכי הגדרות בלבד)', '<span class="mono">cam-014 · 2026-10-01 08:15:32</span>', '--sw-font-mono 12.5px', 'font-size:12.5px'],
  ];
  const body = `<div class="sheet-wrap">
  ${sheetHead('יסודות · טיפוגרפיה', `${skin.nameHe} · משפחה: Heebo (SIL OFL 1.1; עברית + לטינית, מגיע עם המוצר) — משקלים 400 / 500 / 600 / 700. מספרים תמיד tabular ו-LTR.`, 'foundations-type')}
  ${pair((s) => scale.map(([n, sample, meta, style]) => `<div class="type-row"><div><div class="lbl-s" style="margin:0 0 4px">${n}</div><div class="meta">${meta}</div></div><div style="${style}">${sample}</div></div>`).join(''))}
  <section class="sec"><h2 class="h2">כללים</h2><table class="mo-table"><tr><th>כלל</th><th>ערך</th></tr>
  <tr><td>סקאלה</td><td><code>xs ${px('--sw-fs-xs')}</code> · <code>sm ${px('--sw-fs-sm')}</code> · <code>md ${px('--sw-fs-md')}</code> · <code>lg ${px('--sw-fs-lg')}</code> · <code>xl ${px('--sw-fs-xl')}</code> · <code>2xl ${px('--sw-fs-2xl')}</code> · <code>3xl ${px('--sw-fs-3xl')}</code>; <code>--dv-fs-item-name → sm</code>, <code>--dv-fs-tile-name → md</code>, <code>--dv-fs-title → section</code>, <code>--dv-fs-value-big → 3xl</code></td></tr>
  <tr><td>כותרת מתכווצת בגלילה</td><td>שם החדר ${px('--sw-h1')} → ${px('--sw-h2')} (H2) אחרי 48px גלילה, חזרה מתחת ל-32px; שורת החדרים נשארת דבוקה מתחת; משך <code>--sw-t-med</code></td></tr>
  <tr><td>Line-height</td><td>גוף ${px('--sw-lh')} · כותרות וקריאות ${px('--sw-h1-lh')}–${px('--sw-lh-tight')} (<code>--sw-lh-tight</code>)</td></tr>
  <tr><td>Tracking</td><td>H1 ${px('--sw-h1-tracking')} · H2 ${px('--sw-h2-tracking')} · קריאות ${px('--sw-reading-tracking')} · כיתובים +0.3</td></tr>
  <tr><td>מינימום</td><td>אין טקסט מתחת ל-${px('--sw-fs-xs')}; טקסט על תמונה (שם מצלמה) ${px('--sw-fs-sm')} 600 עם scrim</td></tr>
  <tr><td>מספרים ומזהים</td><td><code>.num</code> = tabular-nums + <code>direction:ltr; unicode-bidi:isolate</code> — לא מתהפכים ב-RTL</td></tr>
  <tr><td>Fallback</td><td>"Segoe UI", -apple-system, "Noto Sans Hebrew", Roboto, Arial — כולם עם עברית; אותה משפחה בכל הסקינים</td></tr></table></section>
  </div>`;
  return doc({ title: 'Arx · יסודות · טיפוגרפיה', css: sheetCss, body, label: 'foundations-type', fontPrefix: fontPrefixFor() });
}

// ---------- foundations: shape (radii, shadows, material) ----------
export function foundationsShape() {
  const all = getAll(); const skin = current();
  const body = `<div class="sheet-wrap">
  ${sheetHead('יסודות · צורה, עומק וחומר', `${skin.nameHe} · רדיוסים · 3 רמות צל + אגודל · ${skin.copy.material} · fallback`, 'foundations-shape')}
  <section class="sec"><h2 class="h2">רדיוסים</h2>${pair(() => `<div class="rad">
    <div style="border-radius:var(--sw-r-sm)">sm ${px('--sw-r-sm')} · פקד</div><div style="border-radius:var(--sw-r-md)">md ${px('--sw-r-md')} · אריח</div><div style="border-radius:var(--sw-r-lg)">lg ${px('--sw-r-lg')} · פאנל</div><div style="border-radius:var(--sw-r-xl)">xl ${px('--sw-r-xl')} · דיאלוג</div><div style="border-radius:var(--sw-r-pill);width:120px;height:40px">pill ${px('--sw-r-pill')}</div></div>
    <p class="muted" style="font-size:12.5px;margin-top:8px">כלל קינון: רדיוס פנימי ≤ רדיוס חיצוני − ריפוד. סרגל lg, אריח md, אריח מצלמה md, פקד sm, צ׳יפ/segment/toggle pill.</p>`)}</section>
  <section class="sec"><h2 class="h2">צללים</h2>${pair(() => `<div class="shad"><div style="box-shadow:var(--sw-shadow-1)">shadow-1 · כרטיס</div><div style="box-shadow:var(--sw-shadow-2)">shadow-2 · hover / popover</div><div style="box-shadow:var(--sw-shadow-3)">shadow-3 · dialog / drawer</div><div style="box-shadow:var(--sw-shadow-thumb);width:44px;height:44px;border-radius:50%;background:#fff"></div></div>
    <table class="mo-table"><tr><th>טוקן</th><th>ערך</th></tr>${['--sw-shadow-1', '--sw-shadow-2', '--sw-shadow-3', '--sw-shadow-thumb', '--sw-highlight'].map((k) => `<tr><td><code>${k}</code></td><td><code style="font-size:11px">${all[k].light}</code><br><code style="font-size:11px">${all[k].dark}</code></td></tr>`).join('')}</table>
    <p class="muted" style="font-size:12.5px">${skin.copy.shadowNote}</p>`)}</section>
  <section class="sec"><h2 class="h2">החומר — ${skin.copy.material}</h2>${pair((s) => `<div class="gl-stack" style="height:250px">${skin.bloom ? `<span class="blob" style="background:rgb(${all['--sw-on-warm'][s]} / .6);top:-20px;inset-inline-start:20px;width:200px;height:200px"></span><span class="blob" style="background:rgb(${all['--sw-on-cool'][s]} / .55);bottom:-50px;inset-inline-end:30px;width:220px;height:220px"></span>` : ''}
      <div class="glass" style="position:absolute;inset:18px 18px 18px 46%;padding:14px"><div class="sec-title">L1 · panel</div><div class="muted" style="font-size:12px">surface · ${all['--sw-glass-blur'].light} · border · shadow-1</div>
        <div class="glass-2" style="margin-top:10px;padding:10px"><div style="font-weight:600;font-size:13px">L2 · nested tile</div><div class="muted" style="font-size:12px">surface-2 · ${all['--sw-glass-nested'].light}</div><div class="inset" style="margin-top:8px;height:30px;display:flex;align-items:center;padding:0 10px;font-size:12px">L3 · surface-3 מסילה / ring</div></div></div>
      <div class="glass solid" style="position:absolute;inset:18px 56% 18px 18px;padding:14px"><div class="sec-title">fallback אטום</div><div class="muted" style="font-size:12px">surface-solid / surface-2-solid / surface-3-solid — אותו layout</div><div class="glass-2 solid" style="margin-top:10px;padding:10px;font-size:13px">L2 אטום</div></div></div>`)}
    <p class="muted" style="font-size:12.5px;max-width:900px">${skin.copy.materialNote}</p>
    <table class="mo-table"><tr><th>רמה</th><th>light</th><th>dark</th><th>blur</th><th>fallback</th></tr>
    <tr><td>L1 panel / card / rail</td><td><code>${all['--sw-surface'].light}</code></td><td><code>${all['--sw-surface'].dark}</code></td><td><code>${all['--sw-glass-blur'].light}</code>; סרגל/פינה <code>${all['--sw-glass-blur-nav'].light}</code>; sheet <code>${all['--sw-glass-blur-sheet'].light}</code></td><td><code>${all['--sw-surface-solid'].light}</code> / <code>${all['--sw-surface-solid'].dark}</code></td></tr>
    <tr><td>L2 tile inside L1</td><td><code>${all['--sw-surface-2'].light}</code></td><td><code>${all['--sw-surface-2'].dark}</code></td><td>${all['--sw-glass-nested'].light}</td><td><code>${all['--sw-surface-2-solid'].light}</code> / <code>${all['--sw-surface-2-solid'].dark}</code></td></tr>
    <tr><td>L3 track / ring / inset / list group</td><td><code>${all['--sw-surface-3'].light}</code></td><td><code>${all['--sw-surface-3'].dark}</code></td><td>none</td><td><code>${all['--sw-surface-3-solid'].light}</code> / <code>${all['--sw-surface-3-solid'].dark}</code></td></tr>
    <tr><td>overlay (scrim)</td><td><code>${all['--sw-overlay'].light}</code></td><td><code>${all['--sw-overlay'].dark}</code></td><td>—</td><td>—</td></tr>
    <tr><td><code>prefers-contrast: more</code></td><td colspan="4">L1 → ${all['--sw-glass-contrast-a'].light === '1' ? 'כבר אטום' : `${Math.round(+all['--sw-glass-contrast-a'].light * 100)}% אטום (--sw-glass-contrast-a)`}, L2 אטום, קווי שיער <code>--sw-border-strong</code></td></tr>
    <tr><td><code>prefers-reduced-transparency</code> / אין backdrop-filter</td><td colspan="4">כל רמה → הערך ה-solid שלה; אין שינוי layout</td></tr>
    <tr><td>אריחי וידאו</td><td colspan="4">לא חומר: <code>--sw-video-bg</code> אטום, קו שיער 1px, בלי blur/צל/אנימציה (עד 32 אריחים)</td></tr></table></section>
  <section class="sec"><h2 class="h2">"דולק"</h2><p class="muted" style="font-size:12.5px;max-width:900px">${skin.copy.onNote}</p>${pair(() => `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">${tile({ name: 'תאורת תקרה', state: 'דולק · 60%', ic: 'bulb', on: true, kind: 'cool', ctl: tg(true) })}${tile({ name: 'וילון סלון', state: 'פתוח · 60%', ic: 'layers', on: true, kind: 'warm', ctl: tg(true) })}${tile({ name: 'מערכת הגברה', state: 'פעיל', ic: 'bolt', on: true, kind: 'switch', ctl: tg(true) })}</div>`)}</section>
  </div>`;
  return doc({ title: 'Arx · יסודות · צורה וחומר', css: sheetCss, body, label: 'foundations-shape', fontPrefix: fontPrefixFor() });
}

// ---------- foundations: motion + focus ----------
export function foundationsMotion() {
  const all = getAll(); const skin = current();
  const rows = [
    ['משכים', `<code>--sw-t-fast</code> ${px('--sw-t-fast')} · <code>--sw-t-med</code> ${px('--sw-t-med')} · <code>--sw-t-slow</code> ${px('--sw-t-slow')}`],
    ['Easing', `standard <code>${px('--sw-ease')}</code> · enter <code>${px('--sw-ease-enter')}</code> · exit <code>${px('--sw-ease-exit')}</code> · thumb <code>${px('--sw-ease-thumb')}</code>`],
    ['אופי הסקין', skin.copy.motionNote],
    ['Drawer (פאנל צד 360)', 'כניסה: translateX מהקצה ההתחלתי 24px → 0 + opacity, t-slow enter; יציאה t-med exit; scrim 0 → 1 ב-t-med'],
    ['Bottom sheet (טלפון)', 'כניסה: translateY 100% → 0, t-slow enter; יציאה t-med exit; גרירה בידית עוקבת אחרי האצבע, שחרור מתחת ל-40% סוגר'],
    ['Dialog', 'כניסה: scale .96 → 1 + opacity, t-med enter; יציאה t-fast exit; scrim במקביל'],
    ['Popover / תפריט משתמש', 'כניסה: scale .98 + translateY 4px, t-fast enter; יציאה t-fast'],
    ['Tab / segmented thumb', 'האגודל נע (translate) t-med ב-easing thumb; הטקסט מחליף צבע ב-t-fast'],
    ['Toggle', 'אגודל t-med thumb-easing; מסילה משנה צבע t-med standard'],
    ['אריח "דולק"', 'רקע וגבול t-slow standard (מצב אופטימי מתחיל מיד)'],
    ['כותרת החדר מתכווצת', `שם החדר ${px('--sw-h1')} → ${px('--sw-h2')} ב-t-med, מופעל ב-scroll ≥ 48px, מבוטל מתחת ל-32px; שורת החדרים והכפתור "קומה" נשארים דבוקים`],
    ['סידור רשימה / grid', 'פריטים שמשנים מקום: transform t-med standard; פריט נגרר: scale 1.02 + shadow-2 ללא transition'],
    ['Hover lift', `<code>--sw-hover-lift</code> ${px('--sw-hover-lift')} + shadow-2, t-fast; רק לכרטיסים אינטראקטיביים; אף פעם לא לאריחי וידאו`],
    ['Skeleton / loading', 'shimmer 1.4s linear, רק בפאנל state=loading; spinner 1s'],
    ['<code>prefers-reduced-motion</code>', 'כל המשכים 0ms; hover lift מבוטל; shimmer סטטי; ה-scrim מופיע מיד'],
  ];
  const body = `<div class="sheet-wrap">
  ${sheetHead('יסודות · תנועה ו-focus', `${skin.nameHe} · 3 משכים + 4 easings · כניסה/יציאה לכל שכבה · טבעת focus אחת לכל המערכת`, 'foundations-motion')}
  <section class="sec"><h2 class="h2">תנועה</h2><div class="pane"><table class="mo-table"><tr><th style="width:220px">מה</th><th>מפרט</th></tr>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table></div></section>
  <section class="sec"><h2 class="h2">Focus ring</h2>${pair((s) => `<div class="demo" style="gap:18px;align-items:flex-start">
      <div><div class="lbl-s">על הקנבס</div><button class="btn secondary focus" style="margin-top:8px">כפתור</button></div>
      <div class="glass" style="padding:14px"><div class="lbl-s">על פאנל</div><div class="row" style="margin-top:8px;gap:12px"><span class="tg small on focus" style="border-radius:999px"><span class="tr"></span></span><button class="btn primary focus">שמור</button><div class="tile focus" style="width:190px">${I('bulb', { cls: 'ring' })}<span class="tbody"><div class="tname">ספוט סלון</div><div class="tstate">דולק</div></span></div></div></div>
      <div><div class="lbl-s">על וידאו (טבעת כפולה)</div><div class="vid focus-video" style="margin-top:8px"><div class="scene s1"></div><div class="nm" style="position:absolute;bottom:0;inset-inline:0;padding:16px 10px 8px;color:#fff;font-size:12.5px;font-weight:600;background:linear-gradient(to top,rgba(4,8,16,.75),transparent)"><span class="dot live" style="border:1.5px solid #fff"></span> כניסה ראשית</div></div></div>
    </div>
    <table class="mo-table" style="margin-top:12px"><tr><th>כלל</th><th>ערך</th></tr>
    <tr><td>צבע</td><td><code>--sw-focus</code> ${all['--sw-focus'][s]}</td></tr><tr><td>עובי / offset</td><td><code>--sw-focus-w</code> 2px · <code>--sw-focus-offset</code> 2px (outline, לא box-shadow — לא נחתך ב-overflow)</td></tr>
    <tr><td>רדיוס</td><td>עוקב אחרי רדיוס הרכיב (outline עוקב אחרי border-radius)</td></tr><tr><td>על וידאו / תמונה</td><td>טבעת כפולה: 2px <code>--sw-text-inverse</code> פנימי + 2px <code>--sw-focus</code> חיצוני (box-shadow), כדי שתיראה על כל תמונה</td></tr>
    <tr><td>מתי</td><td><code>:focus-visible</code> בלבד (לא בלחיצת עכבר); בתוך שדה — הגבול הופך ל-focus + הילה <code>--sw-accent-soft</code> 3px</td></tr></table>`)}</section>
  </div>`;
  return doc({ title: 'Arx · יסודות · תנועה ו-focus', css: sheetCss, body, label: 'foundations-motion', fontPrefix: fontPrefixFor() });
}

// ---------- components sheet ----------
export function componentsSheet() {
  const skin = current();
  const sec = (title, fn, note = '') => `<section class="sec"><h2 class="h2">${title}</h2>${note ? `<p class="muted" style="font-size:12.5px;max-width:900px">${note}</p>` : ''}<div class="cmp">${pane('light', fn('light'))}${pane('dark', fn('dark'))}</div></section>`;
  const railDemo = () => `<div class="rails">${['s', 'm', 'l', 'xl'].map((p) => `<div><div class="lbl-s" style="margin-bottom:6px">preset ${p}</div>${rail({ preset: p, active: 'home', labels: p !== 's' })}</div>`).join('')}
    <div style="flex:1;min-width:0"><div class="lbl-s" style="margin-bottom:6px">פינה צפה · אווטאר · כפתור קומה</div><div class="row" style="gap:10px;position:relative;margin-bottom:6px"><span class="corner" style="position:static">${corner().replace('<div class="corner">', '').replace('</div>', '')}</span><span class="corner" style="position:static">${corner({ health: 'warn' }).replace('<div class="corner">', '').replace('</div>', '')}</span><span class="corner" style="position:static">${corner({ health: 'error' }).replace('<div class="corner">', '').replace('</div>', '')}</span><span class="avatar lg">יו<i class="adot"></i></span><span class="avatar">Da</span>${fbtn('קומה 1')}</div>
    <div class="lbl-s" style="margin:14px 0 6px">פס תחתון (טלפון 390)</div><div class="phone-frame" style="max-width:100%">${bottomBar({ active: 'security' })}</div>
    <div class="lbl-s" style="margin:14px 0 6px">מראה LTR</div><div class="phone-frame ltr" dir="ltr" style="max-width:100%">${bottomBar({ active: 'home' })}</div></div></div>
    <div class="lbl-s" style="margin-top:12px">מצבי פריט (preset l) · rest / hover / active / focus / בלי תווית</div><div class="glass rail-l" style="display:flex;gap:8px;padding:10px;width:max-content;max-width:100%">${[['rest', ''], ['hover', 'hover'], ['active', 'active'], ['focus', 'focus']].map(([n, c]) => `<div style="width:72px;text-align:center"><a class="rail-item ${c}" style="width:72px">${I('shield')}<span>אבטחה</span></a><div class="lbl-s" style="margin-top:6px">${n}</div></div>`).join('')}<div style="width:72px;text-align:center"><a class="rail-item nolabel" style="width:72px">${I('map')}</a><div class="lbl-s" style="margin-top:6px">no label</div></div></div>`;

  const tabsDemo = () => `<div class="demo col">
    <div class="lbl-s">שורת חדרים (pill) · rest / active / hover / focus / גלישה עם דהייה</div>
    <div class="tabs rooms fade" style="max-width:520px"><span class="tab on">סלון <span class="n">13</span></span><span class="tab hover">מטבח <span class="n">8</span></span><span class="tab focus">חדר ילדים</span><span class="tab">חדר שינה הורים</span><span class="tab">משרד</span><span class="tab">מרפסת</span><span class="tab">מחסן</span></div>
    <div class="lbl-s">underline (טלפון / הגדרות)</div><div class="tabs underline" style="max-width:420px"><span class="tab on">תמונת מצב</span><span class="tab">כל המצלמות</span><span class="tab hover">תצוגות שמורות</span><span class="tab focus">בריאות</span></div>
    <div class="lbl-s">segmented · תצוגה (3) · 2 קטעים · disabled · סרגל מקטעים</div><div class="demo">${viewSeg('cards')}<div class="seg"><button>קירור</button><button class="on">חימום</button><button>אוטו</button></div><div class="seg disabled"><button class="on">מחשב</button><button>טלפון</button></div><div class="seg lg"><button class="on">${I('camera')}לייב</button><button>${I('clockHistory')}חקירה</button><button>${I('siren')}אזעקה</button></div></div>
    <div class="lbl-s">LTR</div><div dir="ltr" class="ltr demo"><div class="tabs"><span class="tab on">Living room</span><span class="tab">Kitchen</span></div><div class="seg"><button class="on">Tiles</button><button>Cards</button><button>List</button></div></div></div>`;

  const cardDemo = () => `<div class="demo" style="align-items:stretch">
    <div class="glass card" style="width:220px"><div class="sec-title">rest</div><div class="muted" style="font-size:12.5px">כרטיס L1</div></div>
    <div class="glass card lift interactive" style="width:220px;transform:translateY(var(--sw-hover-lift));box-shadow:var(--sw-shadow-2)"><div class="sec-title">hover (interactive)</div><div class="muted" style="font-size:12.5px">lift · shadow-2</div></div>
    <div class="glass card flush" style="width:220px"><div class="scene s6" style="position:relative;height:70px"></div><div style="padding:10px 14px"><div class="sec-title">flush</div></div></div>
    <div class="glass card" style="width:290px"><div class="card-head"><span class="dbadge" style="--role:var(--sw-role-warm);--role-fg:var(--sw-role-warm-fg)">${I('bulb')}</span><h3 class="sec-title">כותרת מקטע${I('chevron', { mirror: true, cls: 'disc' })}<span class="count"><span class="num">6</span> התקנים</span></h3><button class="btn ghost sm">${I('power')}כבה הכל</button></div><div class="tile">${I('bulb', { cls: 'ring' })}<span class="tbody"><div class="tname">תוכן</div><div class="tstate">כבוי</div></span></div></div></div>`;

  const roomDemo = () => `<div class="demo col"><div class="lbl-s">כרטיס חדר (הבית, כרטיסים) · off / on · ללא שיוך</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${roomCard({ name: 'מטבח', ic: 'home', n: 8, act: 0, amb: [['thermo', '25°'], ['bulb', '0/4'], ['bolt', '0/2']] })}${roomCard({ name: 'סלון', ic: 'home', on: true, n: 13, act: 5, amb: [['thermo', '24.5°'], ['droplet', '48%'], ['bulb', '4/6', true], ['wave', 'קירור 22°', true]] })}<a class="glass room unassigned" href="#"><div class="rh"><span class="dbadge lg">${I('inbox')}</span><span class="grow"><div class="rn">ללא שיוך</div><div class="rs"><span class="num">4</span> התקנים</div></span>${I('chevron', { mirror: true, cls: 'faint' })}</div></a></div>
    <div class="lbl-s">שורות רשימה (תצוגת רשימה) · קבוצה · שורת אזור · שורת התקן on / off / לא זמין · שורת מצלמה</div>
    <div class="glass ltable areas" style="border-radius:var(--sw-r-md)"><div class="lgroup">${I('layers', { size: 16, cls: 'faint' })}קרקע<span class="count"><span class="num">4</span> אזורים</span><span class="act"><button class="btn ghost sm">${I('power')}כבה קומה</button></span></div>
      <a class="lrow on warm" href="#"><span class="lname"><span class="ring">${I('home')}</span><span>סלון</span><span class="dot on"></span></span><span class="lc">קרקע</span><span class="lc"><b class="num">24.5°</b></span><span class="lc on">${I('bulb')}<b class="num">4/6</b></span><span class="lc">${I('wave')}<b class="num">22°</b></span><span class="lc">${I('monitor')}<b class="num">1/1</b></span><span class="lc"><b class="num">13</b></span><span class="lact"><button class="btn ghost icon">${I('power')}</button><button class="btn ghost icon">${I('chevron', { mirror: true })}</button></span></a>
      <a class="lrow" href="#"><span class="lname"><span class="ring">${I('home')}</span><span>מטבח</span></span><span class="lc">קרקע</span><span class="lc"><b class="num">25°</b></span><span class="lc">${I('bulb')}<b class="num">0/4</b></span><span class="lc"><span class="faint">—</span></span><span class="lc">${I('bolt')}<b class="num">0/2</b></span><span class="lc"><b class="num">8</b></span><span class="lact"><button class="btn ghost icon">${I('power')}</button><button class="btn ghost icon">${I('chevron', { mirror: true })}</button></span></a></div>
    <div class="glass ltable devices" style="border-radius:var(--sw-r-md)">
      <div class="lrow on cool"><span class="lname"><span class="ring">${I('bulb')}</span><span>תאורת תקרה</span></span><span class="lc on"><b>דולק · 60%</b></span><span class="lc">בהירות <span class="num">60%</span></span><span class="ctl">${tg(true)}</span></div>
      <div class="lrow"><span class="lname"><span class="ring">${I('bulb')}</span><span>מנורת קריאה</span></span><span class="lc"><b>כבוי</b></span><span class="lc">—</span><span class="ctl">${tg(false)}</span></div>
      <div class="lrow unavail"><span class="lname"><span class="ring">${I('fan')}</span><span>מאוורר תקרה</span></span><span class="lc"><b>לא זמין</b></span><span class="lc">אין תקשורת · <span class="num">14</span> דק׳</span><span class="ctl">${tg(false, ' disabled')}</span></div>
      <div class="lrow"><span class="lname"><span class="thumb"><span class="scene s1"></span></span><span>כניסה ראשית</span></span><span class="lc"><span class="badge live"><span class="dot"></span>חי</span></span><span class="lc"><span class="num">1920×1080</span></span><span class="ctl"><button class="btn ghost icon">${I('play')}</button></span></div></div></div>`;

  const kpiDemo = () => `<div class="demo col"><div class="lbl-s">compact · tone neutral / live / stale / forbidden · badge · expanded</div>
    <div class="demo" style="display:grid;grid-template-columns:repeat(3,1fr)">${kpi({ ic: 'bolt', v: '0/32', l: 'מתגים פעילים' }).replace('class="kpi', 'class="kpi glass')}${kpi({ ic: 'lock', v: '1/1', l: 'מנעולים נעולים', d: 'הכול נעול', tone: 'live' }).replace('class="kpi', 'class="kpi glass')}${kpi({ ic: 'camera', v: '14/16', l: 'מצלמות · 2 לא מעודכנות', tone: 'stale' }).replace('class="kpi', 'class="kpi glass')}${kpi({ ic: 'eyeOff', v: '2', l: 'ללא הרשאה', tone: 'forbidden' }).replace('class="kpi', 'class="kpi glass')}
    <button class="kpi glass accent"><span class="ring">${I('bell')}</span><span class="tbody"><span class="kv num">12</span><div class="kl">אירועים · 24 שע׳</div></span><span class="badge count">3</span></button>
    <button class="kpi glass warm focus" aria-expanded="true"><span class="ring">${I('bulb')}</span><span class="tbody"><span class="kv num">16/48</span><div class="kl">תאורה דולקת</div></span>${I('chevron', { cls: 'faint', size: 18 })}</button></div>
    <div class="lbl-s">cards layout · hover</div><div class="demo">${kpi({ ic: 'layers', v: '8/16', l: 'תריסים פתוחים', tone: 'accent' }).replace('class="kpi', 'class="kpi glass cards').replace('<button', '<button style="width:170px"')}${kpi({ ic: 'wave', v: '8/8', l: 'מיזוג פעיל', tone: 'cool' }).replace('class="kpi', 'class="kpi glass cards lift').replace('<button', '<button style="width:170px;transform:translateY(var(--sw-hover-lift));box-shadow:var(--sw-shadow-2)"')}</div></div>`;

  const btnDemo = () => `<div class="demo col">${['primary', 'secondary', 'ghost', 'danger'].map((v) => `<div class="demo"><span class="lbl-s" style="width:70px;direction:ltr;text-align:start">${v}</span><button class="btn ${v} sm">${I('power')}קטן</button><button class="btn ${v}">${I('power')}בינוני</button><button class="btn ${v} lg">${I('power')}גדול · 44</button><button class="btn ${v} hover">hover</button><button class="btn ${v} focus">focus</button><button class="btn ${v}" disabled>disabled</button><button class="btn ${v} icon" aria-label="icon">${I('dots')}</button><button class="btn ${v} icon round lg" aria-label="round">${I('plus')}</button></div>`).join('')}
    <div class="demo"><span class="lbl-s" style="width:70px">master</span><span class="master">${I('power')}</span><span class="master on">${I('power')}</span><span class="master">${I('power')}<span class="badge count">3</span></span><span class="lbl-s">כבוי / דולק / חלקי (44px)</span></div>
    <p class="muted" style="font-size:12px">יעד מגע: כל כפתור במסך מפעיל מקבל <code>.touch</code> — אזור לחיצה ≥ 44×44 גם כשהגודל החזותי 30/36.</p></div>`;

  const chipDemo = () => `<div class="demo"><span class="chip">לא נבחר</span><span class="chip sel">נבחר</span><span class="chip">עם ספירה <span class="n num">12</span></span><span class="chip"><span class="dot live"></span>עם נקודה</span><span class="chip">${I('wave')}עם אייקון</span><span class="chip warm">${I('wave')}קירור · <span class="num">22°</span></span><span class="chip ghost">${I('play')}מדיה · ריק</span><span class="chip focus">focus</span><span class="chip disabled">disabled</span></div>
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
    <div class="field ro" style="width:200px"><label>read-only</label><div class="in">מקליט ראשי</div></div>
    <div class="field inline" style="width:320px"><label>inline</label><div class="in grow">360</div></div></div>`;

  const tileDemo = () => `<div class="demo col"><div class="lbl-s">אריח התקן · off / on קר (תאורה) / on חם (תריס) / on ירוק (מתג) / לא זמין / pending</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${tile({ name: 'מנורת קריאה', state: 'כבוי', ic: 'bulb', ctl: tg(false) })}${tile({ name: 'תאורת תקרה', state: 'דולק · 60%', ic: 'bulb', on: true, kind: 'cool', ctl: tg(true), col: true, extra: slider(60) })}${tile({ name: 'וילון סלון', state: 'פתוח · 60%', ic: 'layers', on: true, kind: 'warm', ctl: `<span class="cover-ctl"><button class="btn">${I('up')}</button><button class="btn">${I('stop')}</button><button class="btn">${I('down')}</button></span>` })}${tile({ name: 'מערכת הגברה', state: 'פעיל', ic: 'bolt', on: true, kind: 'switch', ctl: tg(true) })}${tile({ name: 'מאוורר תקרה', state: 'לא זמין', ic: 'fan', unavail: true, ctl: tg(false, ' disabled') })}${tile({ name: 'שקע יציע', state: 'מדליק…', ic: 'bolt', ctl: `<span class="tg small on" style="opacity:.7"><span class="tr"></span></span>` })}</div>
    <div class="lbl-s">אריח אזור (תצוגת אריחים) · off / on · אריח מצלמה ×7 (אותה משפחה: רדיוס md, שם + נקודה)</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${areaTile({ name: 'מטבח', c: [['bulb', '0/4'], ['bolt', '0/2']] })}${areaTile({ name: 'סלון', on: true, c: [['bulb', '4/6'], ['wave', '1/1']] })}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px">${[['כניסה ראשית', 'live', 's1'], ['מחסן', 'snapshot', 's2'], ['מעלית', 'connecting', ''], ['שער', 'offline', ''], ['גג', 'forbidden', ''], ['לובי', 'unknown', ''], ['חניון', 'stale', 's3']].map((c) => `<div style="aspect-ratio:16/9;display:grid">${camTile(c)}</div>`).join('')}<div style="aspect-ratio:16/9;display:grid">${camTile(['אולם · selected', 'live', 's5'], { sel: true })}</div></div></div>`;

  const stateDemo = () => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${[['loading', 'loader', 'טוען…', ''], ['empty', 'inbox', 'אין התקנים באזור', 'התקנים שישויכו יופיעו כאן'], ['error', 'alert', 'לא ניתן לטעון', 'תשתית המערכת לא הגיבה'], ['forbidden', 'eyeOff', 'אין הרשאה למסך הזה', ''], ['stale', 'clockHistory', 'הנתונים לא מעודכנים', 'עדכון אחרון לפני 6 דק׳'], ['partial', 'info', 'חלק מהמקורות לא זמינים', '2 מתוך 3 מקורות']].map(([s, ic, t, h]) => `<div class="glass"><div class="state ${s}" style="padding:22px 12px"><span class="sic">${I(ic, { cls: s === 'loading' ? 'spin' : '' })}</span><div class="st" style="font-size:15px">${t}</div>${h ? `<div class="sh" style="font-size:12.5px">${h}</div>` : ''}</div></div>`).join('')}</div>`;

  // further families from COMPONENT_INVENTORY (coverage inspired by entrant A's COMPONENT_COVERAGE): popover / user menu, table,
  // recordings timeline, 24-hour week grid, steps, banners. Geometry (timeline, hours) stays LTR.
  const popDemo = () => `<div class="demo" style="align-items:flex-start;gap:24px">
    <div class="glass pop"><div class="pwho"><span class="avatar lg">יו<i class="adot"></i></span><span><b>יוני</b><span>מנהל · <span class="num">3</span> התראות</span></span></div><div class="psep"></div>
      <div class="prow">${I('layers')}גודל תפריט הצד<span class="end">גדול</span></div><div class="prow hover">${I('home')}עריכת המסך הראשי</div><div class="prow">${I('settings')}הגדרות</div><div class="psep"></div><div class="prow">${I('door')}יציאה</div></div>
    <div class="glass pop" style="width:240px"><div class="prow">${I('expand')}הרחב</div><div class="prow">${I('snapshot')}שמור צילום</div><div class="prow" style="color:var(--sw-danger-text)">${I('eyeOff')}הסתר מהקיר</div></div>
    <div><div class="lbl-s" style="margin-bottom:6px">banners · error / setup / stale</div><div class="demo col" style="width:520px">
      <div class="banner error">${I('alert')}<span class="grow"><b>אין חיבור לתשתית המערכת</b> · מנסה שוב</span><span class="acts"><button class="btn ghost sm">פרטים</button><button class="btn ghost icon sm" aria-label="סגור">${I('x')}</button></span></div>
      <div class="banner setup">${I('info')}<span class="grow"><b>ההתקנה לא הושלמה</b> · <span class="num">2</span> צעדים נותרו</span><span class="acts"><button class="btn primary sm">המשך</button></span></div>
      <div class="banner stale">${I('clockHistory')}<span class="grow">הנתונים מלפני <span class="num">6</span> דק׳</span><span class="acts"><button class="btn ghost sm">${I('refresh')}רענן</button></span></div></div></div></div>`;

  const tableDemo = () => `<div class="demo col"><div class="lbl-s">טבלה · rest / hover / selected · תמונה ממוזערת · ספרות טבלאיות</div>
    <div class="glass tbl" style="--cols:100px minmax(160px,1fr) 120px 90px 64px 44px">
      <div class="th"><span>שעה</span><span>מצלמה</span><span>סוג</span><span>משך</span><span></span><span></span></div>
      ${[['15:32', 'כניסה ראשית', 'תנועה', '0:42', 's1', ''], ['15:18', 'חניון', 'תנועה', '1:05', 's3', 'hover'], ['14:51', 'שער', 'דלת נפתחה', '0:12', 's6', 'sel'], ['14:20', 'לובי', 'תנועה', '0:31', 's2', '']].map(([t, c, k, d, s, cls]) => `<div class="tr ${cls}"><span class="num">${t}</span><span>${c}</span><span class="badge ${k === 'תנועה' ? 'stale' : 'recorded'}"><span class="dot"></span>${k}</span><span class="num muted">${d}</span><span class="thumb"><span class="scene ${s}"></span></span><button class="btn ghost icon sm" aria-label="צפה">${I('play')}</button></div>`).join('')}</div>
    <div class="lbl-s">empty · loading</div><div class="demo"><div class="glass tbl" style="width:300px"><div class="state compact"><span class="sic">${I('inbox')}</span><div class="st" style="font-size:var(--sw-fs-md)">אין אירועים היום</div></div></div><div class="glass tbl" style="width:300px;padding:10px;gap:8px"><span class="skeleton" style="height:14px;width:80%"></span><span class="skeleton" style="height:14px;width:60%"></span><span class="skeleton" style="height:14px;width:70%"></span></div></div></div>`;

  const timelineDemo = () => `<div class="demo col"><div class="lbl-s">ציר זמן הקלטות · LTR תמיד · מוקלט / פער / משוער · אירועים · סימניות · עכשיו · scrubbing</div>
    <div class="glass card"><div class="tl"><div class="ticks">${['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((t) => `<span>${t}</span>`).join('')}</div>
      <div class="track"><span class="seg" style="left:0;width:34%"></span><span class="seg gap" style="left:34%;width:7%"></span><span class="seg" style="left:41%;width:31%"></span><span class="seg est" style="left:72%;width:12%"></span>
        ${[8, 19, 27, 46, 58, 66].map((x) => `<span class="ev" style="left:${x}%"></span>`).join('')}<span class="bm" style="left:22%"></span><span class="bm" style="left:61%"></span><span class="scrub" data-t="15:32:10" style="left:59%"></span><span class="now" style="left:84%"></span></div>
      <div class="ticks"><span class="badge recorded"><span class="dot"></span>מוקלט</span><span class="badge stale"><span class="dot"></span>אירוע תנועה</span><span class="badge partial"><span class="dot"></span>סימנייה</span><span class="badge unknown"><span class="dot"></span>משוער</span><span class="badge offline"><span class="dot"></span>פער</span></div></div></div>
    <div class="lbl-s">רשת שבועית 24 שעות · שעות LTR, ימים RTL · rest / painting / read-only</div>
    <div class="glass card"><div class="wg"><span></span>${Array.from({ length: 24 }, (_, h) => `<span class="h">${h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>`).join('')}
      ${['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((d, di) => `<span class="d">${d}</span>${Array.from({ length: 24 }, (_, h) => `<span class="c${(h >= 7 && h <= 9) || (h >= 17 && h <= 22) ? ' on' : ''}${di === 5 && h >= 14 && h <= 16 ? ' motion' : ''}${di === 2 && h === 12 ? ' paint' : ''}"></span>`).join('')}`).join('')}</div></div>
    <div class="lbl-s">steps · done / current / upcoming (RTL, מתהפך ב-LTR)</div><div class="demo"><div class="steps" style="width:460px"><span class="st done"><i>${I('check', { size: 14 })}</i>חיבור</span><span class="ln"></span><span class="st cur"><i>2</i>מצלמות</span><span class="ln"></span><span class="st"><i>3</i>הרשאות</span></div></div></div>`;

  const body = `<div class="sheet-wrap" style="max-width:1400px">
  ${sheetHead('גיליון רכיבים', `${skin.nameHe} · כל רכיב בכל מצב · light ו-dark זה לצד זה · RTL (+ LTR לכיווניים)`, 'components · RTL first')}
  ${sec('סרגל צד · פינה · אווטאר · כפתור קומה · פס תחתון', railDemo, skin.copy.railNote)}
  ${sec('שורת חדרים · לשוניות · segmented (אריחים · כרטיסים · רשימה)', tabsDemo)}
  ${sec('כרטיס · כותרת מקטע עם › ו-"N התקנים"', cardDemo)}
  ${sec('כרטיס חדר · שורות רשימה', roomDemo, 'כרטיס החדר הוא היחידה של הבית בתצוגת כרטיסים: שם גדול, עובדות סביבתיות כצ׳יפים, "פרטים" ופעולת שורה. שורת הרשימה היא אותו מידע בשורה אחת: דבר + עובדות + מצב + פקד.')}
  ${sec('אריח KPI', kpiDemo)}
  ${sec('כפתורים', btnDemo)}
  ${sec('צ׳יפים ו-badges', chipDemo)}
  ${sec('Toggle', toggleDemo, 'יעד המגע 44 (ריפוד שקוף). האגודל נע לקצה הסוף — מתהפך ב-LTR.')}
  ${sec('אריחים: התקן · אזור · מצלמה', tileDemo, 'אריח וידאו אינו חומר: רקע אטום, קו שיער, בלי blur/צל/אנימציה. מצבי אריח בצורה + טקסט: מנותק = מסגרת מקווקוות + אייקון + סיבה; ללא הרשאה = מילוי מפוספס + "אין הרשאה"; צילום = צ׳יפ על התמונה; לא מעודכן = צ׳יפ ענבר עם זמן.')}
  ${sec('דיאלוג · אישור "כבה הכל" · locked', dialogDemo, 'אישור = שאלה עם ספירה + שורת סייג אחת + 2 כפתורים (danger primary) + "פרטים" מקופל. אין פסקאות.')}
  ${sec('Drawer · bottom sheet · modal', drawerDemo)}
  ${sec('שדה טופס', fieldDemo)}
  ${sec('פאנל מצב ×6', stateDemo)}
  ${sec('Popover · תפריט משתמש · banners', popDemo, 'popover = L1 עם shadow-2 וחץ; שורות 44px; פעולה מסוכנת בצבע danger-text. banner = שורה אחת: אייקון + משפט + פעולה + סגירה; אין פסקאות.')}
  ${sec('טבלה', tableDemo, 'שורה = 48px compact, כותרת 40px ב-text-3; hover = L3, נבחר = accent-soft; thumbnail 56×32; ספרות tabular.')}
  ${sec('ציר זמן · רשת שבועית · steps', timelineDemo, 'גאומטריה שרצה משמאל לימין גם ב-RTL: ציר הזמן ושעות הרשת. הימים (א–ש) נשארים RTL בעמודת התוויות. מצבים בצורה + צבע + תווית.')}
  </div>`;
  return doc({ title: 'Arx · גיליון רכיבים', css: sheetCss + areaCss + listCss, body, label: 'components', fontPrefix: fontPrefixFor() });
}

// ---------- area states board ----------
export function areaStatesBoard() {
  const frame = (state, label, note) => `<section class="sec"><div class="states-label"><span class="badge ${state === 'error' ? 'error' : state === 'unavailable' ? 'stale' : state === 'readonly' ? 'historic' : 'neutral'}">${label}</span><span class="muted" style="font-size:12.5px">${note}</span></div><div class="states-frame">${shell({ active: 'home', content: areaContent({ state }) })}</div></section>`;
  const body = `<div style="padding:26px 30px 40px;display:flex;flex-direction:column;gap:22px">
    <header class="sheet-head"><div><h1 class="h1" style="font-size:34px">מסך האזור · לוח מצבים</h1><div class="sub">loading · empty · error · unavailable · read-only — 1440, light. כל מצב בצורה + טקסט, לא בצבע בלבד.</div></div><span class="tag faint" style="direction:ltr">area-states · 1440 · light · ${current().id}</span></header>
    ${frame('loading', 'loading', 'שלד של 4 כרטיסי תחום; הכותרת, כפתור הקומה ושורת החדרים כבר מוצגים')}
    ${frame('empty', 'empty', 'אזור בלי התקנים — פאנל מצב אחד, בלי שורת רמז, בלי שם פלטפורמה')}
    ${frame('error', 'error', 'שגיאת טעינה עם "נסה שוב"')}
    ${frame('unavailable', 'unavailable', 'תחום שלם לא זמין (תריסים: מסגרת compact עם אייקון וסיבה) + התקן בודד לא זמין (מאוורר תקרה: מקווקו, פקד מושבת, סיבה ב-tooltip)')}
    ${frame('readonly', 'read-only (צופה)', 'אריחים ללא פקדים, "כבה הכל" ופקדי המיזוג לא מוצגים (לא אפורים) — נראות לפי הרשאות')}
  </div>`;
  return doc({ title: 'Arx · מסך האזור · מצבים', css: sheetCss + areaCss, body, label: 'area-states', fontPrefix: fontPrefixFor() });
}

// ---------- index ----------
export function indexPage(boards, rendersRel = '../renders/') {
  const skin = current();
  const groupsIdx = [
    ['יסודות', boards.filter((b) => b.file.startsWith('foundations'))],
    ['רכיבים', boards.filter((b) => b.file.startsWith('components'))],
    ['הבית — כרטיסים', boards.filter((b) => b.file.startsWith('home-') && !b.file.startsWith('home-list') && !b.file.startsWith('home-kpi') && !b.file.startsWith('home-panel'))],
    ['הבית — ווידג׳טים אופציונליים (שורת KPI · רצועת מזגנים · עץ המבנה)', boards.filter((b) => b.file.startsWith('home-kpi'))],
    ['הבית — כיוון ב "לוח צד" (עמודת ווידג׳טים + שורת KPI)', boards.filter((b) => b.file.startsWith('home-panel'))],
    ['הבית — רשימה', boards.filter((b) => b.file.startsWith('home-list'))],
    ['מסך אזור — כרטיסים (+ fallback אטום)', boards.filter((b) => b.file.startsWith('area-') && !b.file.startsWith('area-states') && !b.file.startsWith('area-list'))],
    ['מסך אזור — רשימה', boards.filter((b) => b.file.startsWith('area-list'))],
    ['קיר מצלמות — רשת', boards.filter((b) => b.file.startsWith('wall-') && !b.file.startsWith('wall-list'))],
    ['קיר מצלמות — רשימה', boards.filter((b) => b.file.startsWith('wall-list'))],
    ['לוח מצבים', boards.filter((b) => b.file.startsWith('area-states'))],
    ['מראות LTR — לוחות מלאים (בית · אזור)', boards.filter((b) => b.file.startsWith('mirrors/'))],
  ];
  const skinLinks = skinIds.map((id) => `<a class="btn ${id === skin.id ? 'primary' : 'secondary'}" href="${id === 'domus' ? (skin.id === 'domus' ? '' : '../') : (skin.id === 'domus' ? `${id}/` : `../${id}/`)}index.html">${skins[id].nameHe}</a>`).join('');
  const body = `<div class="sheet-wrap">
  <header class="sheet-head"><div><h1 class="h1" style="font-size:34px">Arx · סקין "${skin.nameHe}"</h1><div class="sub">מבנה אחד לשלושת הסקינים · יסודות + גיליון רכיבים + 3 מסכים × כרטיסים/רשימה × 1440/390 × light/dark + לוח מצבים</div></div><span class="tag">entrant-claude · ${skin.id}</span></header>
  <div class="skinbar"><span class="faint" style="font-size:var(--sw-fs-sm)">סקין</span>${skinLinks}<span style="flex:1"></span><button class="btn secondary" onclick="document.documentElement.dataset.scheme='light'">light</button><button class="btn secondary" onclick="document.documentElement.dataset.scheme='dark'">dark</button><a class="btn ghost" href="${skin.id === 'domus' ? '../' : '../../'}SKINS_HE.md">SKINS_HE.md</a><a class="btn ghost" href="${skin.id === 'domus' ? '../' : '../../'}RATIONALE_HE.md">RATIONALE_HE.md</a></div>
  ${groupsIdx.map(([t, list]) => `<section class="sec"><h2 class="h2">${t}</h2><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${list.map((b) => `<a class="glass card lift" href="${b.file}" style="display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit"><img src="${rendersRel}${b.file.replace('.html', '.png')}" alt="" style="width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:var(--sw-r-sm);border:1px solid var(--sw-border)"><b style="font-size:13px;direction:ltr;text-align:start">${b.file.replace('.html', '')}</b><span class="faint" style="font-size:12px;direction:ltr;text-align:start">${b.w}×${b.h}${b.full ? ' · full page' : ''}</span></a>`).join('')}</div></section>`).join('')}
  </div>`;
  return doc({ title: `Arx · לוחות העיצוב · ${skin.id}`, css: sheetCss, body, fontPrefix: fontPrefixFor() });
}
