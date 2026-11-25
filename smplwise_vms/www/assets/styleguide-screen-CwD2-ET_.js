const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as f}from"./sw-logo-art-PLtEZJxU.js";import{i as g,eS as b,dC as e,b as r,aE as c,A as p,g as u,j as x,k as $}from"./index-BMsqo0rz.js";import{a as y}from"./settings-yylxou_W.js";import"./sw-chip-DyINCaPW.js";import"./sw-floor-iso-BUW2hNkQ.js";import"./sw-steps-D6VpO0Vt.js";import"./sw-timeline-BfqA-kTH.js";import{d as w,a as k}from"./demo-3d-C9YXJG4b.js";import{b as m}from"./scene-builder-ik7ZgWvN.js";import{w as v,W as z}from"./webgl-DXVY2AQu.js";import"./shared-space-DhoSrrhw.js";import"./zones-Cc082C3s.js";import"./map-Ce8gybQ2.js";import"./material-resolve-AmHse_Vl.js";import"./quality-ladder-D3nCZEwJ.js";var S=Object.defineProperty,_=Object.getOwnPropertyDescriptor,h=(s,a,l,t)=>{for(var i=t>1?void 0:t?_(a,l):a,d=s.length-1,n;d>=0;d--)(n=s[d])&&(i=(t?n(a,l,i):n(i))||i);return t&&i&&S(a,l,i),i};const E=[["--sw-bg",e("רקע")],["--sw-surface",e("משטח")],["--sw-surface-3",e("משטח 3")],["--sw-border",e("גבול")],["--sw-text",e("טקסט")],["--sw-text-2",e("טקסט משני")],["--sw-text-3",e("טקסט שלישי")],["--sw-accent",e("כחול")],["--sw-accent-soft",e("כחול רך")],["--sw-live",e("חי")],["--sw-offline",e("מנותק")],["--sw-stale",e("מיושן")],["--sw-danger",e("שגיאה")],["--sw-purple",e("סגול (דלת)")]],L=["live","recorded","historic","offline","stale","partial","unknown","forbidden","error"],R=["loading","empty","error","forbidden","stale","partial"],O=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night","building","house"],A=["dashboard","building","camera","bell","history","system","search","user","play","pause","back10","forward10","aperture","volume","mic","expand","close","chevron","chevronDown","warning","info","lock","unlock","offline","refresh","layers","floor","plus","minus","fit","door","light","sensor","check","clock","download","pin","more","map","upload","list","target","filter","users","shield","storage","edit","case","rule","link","grid","home","star","calendar","trash","eye","cpu","activity","image","wifi","signal","move","bookmark","route"];let o=class extends g{constructor(){super(...arguments),this.demo3d={loading:!1,error:"",desc:null,selected:null},this.demoRealistic=!1}async load3d(){if(!(this.demo3d.loading||this.demo3d.desc)){this.demo3d={...this.demo3d,loading:!0,error:""};try{await f(()=>import("./sw-plan-3d-SZ5UEQ7W.js").then(a=>a.s),__vite__mapDeps([0]),import.meta.url);const s=w("f0");this.demo3d={loading:!1,error:"",desc:s?m(s):null,selected:null}}catch(s){this.demo3d={loading:!1,error:s instanceof Error?s.message:String(s),desc:null,selected:null}}}}onRealistic(s){if(s===this.demoRealistic||!this.demo3d.desc)return;this.demoRealistic=s;const a=w("f0");a&&(this.demo3d={...this.demo3d,desc:m({...a,realistic:s})})}render(){return r`
      <h2>${e("ספריית רכיבים ו־tokens (v3)")}</h2>
      <p class="lead">${e('מקור השפה החזותית: שלושת לוחות ההדמיה ב־docs/design/reference. ממשק קומפקטי (12px), משטחים לבנים על רקע קריר, מחיצות דקות, כחול אחד במשורה, ירוק רק ל"מחובר", צל שקט, סצנות מאוירות עד חיבור זרמים.')}</p>

      <h3>${e("צבעים")}</h3>
      <div class="swatches">
        ${E.map(([s,a])=>r`<div class="swatch"><div class="c" style="background:var(${s})"></div><div class="n"><span>${a}</span><span class="ltr">${s}</span></div></div>`)}
      </div>

      <h3>${e("טיפוגרפיה (Heebo, מארח מקומית)")}</h3>
      <div class="type">
        <p style="font-size:32px;font-weight:var(--sw-fw-bold);letter-spacing:-0.03em;color:var(--sw-heading)">${e("ספרת תצוגה 32 · 1.3 TB")}</p>
        <p style="font-size:var(--sw-h1);font-weight:var(--sw-h1-weight);letter-spacing:var(--sw-h1-tracking);color:var(--sw-heading)">${e("כותרת עמוד 26")}</p>
        <p style="font-size:var(--sw-fs-2xl);font-weight:var(--sw-fw-bold);color:var(--sw-heading)">${e("כותרת מצב / Hero 20")}</p>
        <p style="font-size:var(--sw-fs-xl);font-weight:var(--sw-fw-bold);color:var(--sw-heading)">${e("כותרת כרטיס 17")}</p>
        <p style="font-size:var(--sw-fs-md);font-weight:var(--sw-fw-semibold);color:var(--sw-heading)">${e("תווית שורה 14")}</p>
        <p>${e("טקסט גוף 13: מפה של אתר, מבנה וקומה היא משטח העבודה המרכזי.")}</p>
        <p style="font-size:var(--sw-fs-sm);color:var(--sw-text-2)">${e("הסבר משני 12.5")}</p>
        <p style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${e("תווית 11 ·")} <span class="ltr">2026-09-14T08:05:38Z</span> ${e("נשאר LTR")}</p>
      </div>

      <h3>${e("מדרגות המשטח (עמוד · Hero · כרטיס · באר)")}</h3>
      <div class="ladder">
        <div class="hero"><b>${e("Hero: העצם הראשי")}</b><span class="big">84</span><small>${e("רדיוס גדול, צל 2 וקו אור עליון; אחד למסך.")}</small></div>
        <div class="card"><b>${e("כרטיס")}</b><small>${e("משטח, צל 1, כותרת 17/700. כל sw-card במסכי ההגדרות.")}</small></div>
        <div class="well"><b>${e("באר")}</b><small>${e("surface-2, בלי מתאר; שורת הגדרה, אריח התקן, מונה.")}</small></div>
      </div>

      <h3>${e("כרטיסי KPI")}</h3>
      <div class="kpis">
        <sw-kpi icon="camera" tone="live" value="24" label=${e("מצלמות")} detail=${e("מחוברות")}></sw-kpi>
        <sw-kpi icon="building" value="3" label=${e("אתרים")} detail=${e("פעילים")} tone="neutral"></sw-kpi>
        <sw-kpi icon="bell" value="12" label=${e("אירועים")} detail=${e("ב־24 השעות")} tone="neutral" badge=${e("3 חדשים")}></sw-kpi>
        <sw-kpi icon="shield" tone="stale" value=${e("חלקי")} label=${e("מצב מערכת")} detail=${e("גשר לא רענן")}></sw-kpi>
      </div>

      <h3>${e("סצנות מאוירות (מצייני מקום, לא פריימים)")}</h3>
      <div class="scenes">${O.map(s=>r`<div><sw-scene kind=${s}></sw-scene><span>${s}</span></div>`)}</div>

      <h3>${e("אריחי מצלמה")}</h3>
      <div class="grid">
        <sw-camera-tile name=${e("כניסה ראשית")} state="live" scene="entrance"></sw-camera-tile>
        <sw-camera-tile name=${e("חדר מדרגות")} state="stale" scene="corridor"></sw-camera-tile>
        <sw-camera-tile name=${e("מסדרון מזרחי")} state="offline"></sw-camera-tile>
        <sw-camera-tile name=${e("חניה")} state="forbidden"></sw-camera-tile>
      </div>

      <h3>${e("כפתורים, צ׳יפים, טאבים")}</h3>
      <div class="row">
        <sw-button variant="primary" icon="play">${e("ראשי")}</sw-button>
        <sw-button icon="history">${e("משני")}</sw-button>
        <sw-button variant="ghost" icon="pin">${e("שקוף")}</sw-button>
        <sw-button variant="danger">${e("מסוכן")}</sw-button>
        <sw-button variant="primary" disabled>${e("מושבת")}</sw-button>
        <sw-button size="sm">${e("קטן")}</sw-button>
        <sw-button iconOnly icon="refresh" label=${e("רענון")}></sw-button>
        <sw-chip selected>${e("הכל")}</sw-chip><sw-chip dot="#ef4444">${e("תנועה")}</sw-chip><sw-chip dot="#2f6bff">${e("אדם")}</sw-chip><sw-chip dot="#22c55e">${e("רכב")}</sw-chip>
        <sw-tabs .items=${[{id:"a",label:e("כל האתרים"),count:3},{id:"b",label:e("מבנים")},{id:"c",label:e("מפה")}]} active="a"></sw-tabs>
        <sw-toggle checked label=${e("מופעל")}></sw-toggle>
        <sw-avatar name=${e("יוני")}></sw-avatar>
      </div>

      <h3>${e("תגי מצב (צורה + טקסט, לא צבע בלבד)")}</h3>
      <div class="row">${L.map(s=>r`<sw-badge kind=${s}></sw-badge>`)}</div>

      <h3>${e("ציר זמן, שלבים, קומות איזומטריות")}</h3>
      <sw-timeline .segments=${b} .events=${[{minute:614,kind:"person",label:e("אדם")},{minute:582,kind:"vehicle",label:e("רכב")}]} .cursor=${615}></sw-timeline>
      <div class="row" style="margin-block-start:10px">
        <sw-card style="flex:1;min-inline-size:280px"><sw-steps .steps=${[e("גילוי"),e("הגדרה"),e("בדיקה"),e("סיום")]} .current=${1}></sw-steps></sw-card>
        <sw-floor-iso .rooms=${c("f0")} selected></sw-floor-iso>
        <sw-floor-iso .rooms=${c("f-1")}></sw-floor-iso>
        <sw-floor-iso empty></sw-floor-iso>
      </div>

      <h3>${e("מצבי מסך")}</h3>
      <div class="grid">
        ${R.map(s=>r`<div class="panel"><sw-state-panel state=${s} actionLabel=${s==="error"?e("נסה שוב"):""}></sw-state-panel></div>`)}
      </div>

      <h3>${e("תלת-ממד סכמטי (T087)")}</h3>
      <div data-3d-demo style="display:flex;flex-direction:column;gap:8px;max-inline-size:720px">
        ${this.demo3d.desc?r`<sw-plan-3d style="block-size:360px;border:1px solid var(--sw-border);border-radius:var(--sw-r-md)" .description=${this.demo3d.desc} .selectedId=${this.demo3d.selected} .labels=${k("f0")}
                .cameras=${[{id:"cam-1",label:e("כניסה ראשית")},{id:"cam-2",label:e("לובי")}]} exportName="demo-floor"
                @part-select=${s=>this.demo3d={...this.demo3d,selected:s.detail.id}}
                @realistic-change=${s=>this.onRealistic(s.detail.on)}></sw-plan-3d>
              <div style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">${e("נבחר:")} <span class="ltr" data-3d-demo-selected>${this.demo3d.selected??""}</span></div>`:r`<div><sw-button icon="cube" data-3d-demo-load ?disabled=${!v()||this.demo3d.loading} @click=${()=>this.load3d()}>${this.demo3d.loading?e("טוען…"):e("טען תצוגת 3D")}</sw-button>
              ${v()?p:r`<span data-3d-unavailable style="margin-inline-start:8px">${z}</span>`}
              ${this.demo3d.error?r`<span style="color:var(--sw-danger);margin-inline-start:8px">${this.demo3d.error}</span>`:p}</div>`}
      </div>

      <h3>${e("אייקונים")}</h3>
      <div class="icons">${A.map(s=>r`<div class="icon"><sw-icon .name=${s} size=${18}></sw-icon><span class="ltr">${s}</span></div>`)}</div>
    `}};o.styles=[y,u`
    :host {
      display: block;
      padding: 14px 24px 24px;
      max-inline-size: var(--sw-content-max);
    }
    /* R5-SYSTEM-297: the guide reads in the product's own scale - the page heading, 17/700 section titles, a body-sized lead */
    h2 {
      font-family: var(--sw-font-heading, var(--sw-font));
      font-size: var(--sw-h1, var(--sw-fs-2xl));
      font-weight: var(--sw-h1-weight, var(--sw-fw-bold));
      letter-spacing: var(--sw-h1-tracking, -0.01em);
      color: var(--sw-heading, var(--sw-text));
      margin: 0 0 4px;
    }
    h3 {
      font-size: var(--sw-fs-xl);
      margin: 26px 0 10px;
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.01em;
      color: var(--sw-heading, var(--sw-text));
    }
    .lead {
      color: var(--sw-text-2);
      margin: 0 0 12px;
      font-size: var(--sw-fs-md);
      max-inline-size: 90ch;
    }
    /* the surface ladder of HOMEFABLE / R5: the page, a hero (large radius, shadow 2 + light line), a card (shadow 1), a well (surface-2) */
    .ladder {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .ladder > div {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
    }
    .ladder .hero {
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    }
    .ladder .card {
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
    }
    .ladder .well {
      border-radius: var(--sw-r-md);
      border-color: transparent;
      background: var(--sw-surface-2);
    }
    .ladder b {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .ladder .big {
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--sw-text));
    }
    .ladder small {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .swatches {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 8px;
    }
    .swatch {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      background: var(--sw-surface);
      font-size: var(--sw-fs-xs);
    }
    .swatch .c {
      block-size: 36px;
    }
    .swatch .n {
      padding: 5px 8px;
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }
    .type p {
      margin: 0 0 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }
    .scenes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .scenes div {
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      position: relative;
      font-size: var(--sw-fs-2xs);
    }
    .scenes span {
      position: absolute;
      inset-inline-start: 6px;
      inset-block-end: 5px;
      color: var(--sw-on-video);
      text-shadow: 0 1px 2px color-mix(in srgb, var(--sw-video-shadow-ink) 60%, transparent);
      direction: ltr;
    }
    .icons {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      gap: 6px;
    }
    .icon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 8px 4px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      font-size: var(--sw-fs-2xs);
      color: var(--sw-text-2);
    }
    .panel {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 10px;
    }
  `];h([x()],o.prototype,"demo3d",2);o=h([$("styleguide-screen")],o);export{o as StyleguideScreen};
