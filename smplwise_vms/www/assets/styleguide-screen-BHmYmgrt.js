const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as f}from"./sw-logo-art-PLtEZJxU.js";import{a as g,eT as b,dD as s,b as r,aF as c,A as p,j as u,k as x,m as $}from"./index-D3xHkfje.js";import{a as y}from"./settings-CBX0_39g.js";import"./sw-chip-C1wXYX1O.js";import"./sw-floor-iso-DqJqjtqm.js";import"./sw-steps-BvpfXI7u.js";import"./sw-timeline-DZLor4AW.js";import{d as w,a as k}from"./demo-3d-2ewBmxvU.js";import{b as m}from"./scene-builder-DvhxEr1O.js";import{w as v,W as z}from"./webgl-DO5-W6JA.js";import"./shared-space-Dy_9mTS7.js";import"./zones-CwaLa5Ir.js";import"./map-D3bqut0m.js";import"./material-resolve-C8q1uF_o.js";import"./quality-ladder-BIYtMgBU.js";var S=Object.defineProperty,_=Object.getOwnPropertyDescriptor,h=(e,a,l,t)=>{for(var i=t>1?void 0:t?_(a,l):a,d=e.length-1,n;d>=0;d--)(n=e[d])&&(i=(t?n(a,l,i):n(i))||i);return t&&i&&S(a,l,i),i};const E=[["--sw-bg",s("רקע")],["--sw-surface",s("משטח")],["--sw-surface-3",s("משטח 3")],["--sw-border",s("גבול")],["--sw-text",s("טקסט")],["--sw-text-2",s("טקסט משני")],["--sw-text-3",s("טקסט שלישי")],["--sw-accent",s("כחול")],["--sw-accent-soft",s("כחול רך")],["--sw-live",s("חי")],["--sw-offline",s("מנותק")],["--sw-stale",s("מיושן")],["--sw-danger",s("שגיאה")],["--sw-purple",s("סגול (דלת)")]],L=["live","recorded","historic","offline","stale","partial","unknown","forbidden","error"],R=["loading","empty","error","forbidden","stale","partial"],O=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night","building","house"],A=["dashboard","building","camera","bell","history","system","search","user","play","pause","back10","forward10","aperture","volume","mic","expand","close","chevron","chevronDown","warning","info","lock","unlock","offline","refresh","layers","floor","plus","minus","fit","door","light","sensor","check","clock","download","pin","more","map","upload","list","target","filter","users","shield","storage","edit","case","rule","link","grid","home","star","calendar","trash","eye","cpu","activity","image","wifi","signal","move","bookmark","route"];let o=class extends g{constructor(){super(...arguments),this.demo3d={loading:!1,error:"",desc:null,selected:null},this.demoRealistic=!1}async load3d(){if(!(this.demo3d.loading||this.demo3d.desc)){this.demo3d={...this.demo3d,loading:!0,error:""};try{await f(()=>import("./sw-plan-3d-C16rBrEd.js").then(a=>a.s),__vite__mapDeps([0]),import.meta.url);const e=w("f0");this.demo3d={loading:!1,error:"",desc:e?m(e):null,selected:null}}catch(e){this.demo3d={loading:!1,error:e instanceof Error?e.message:String(e),desc:null,selected:null}}}}onRealistic(e){if(e===this.demoRealistic||!this.demo3d.desc)return;this.demoRealistic=e;const a=w("f0");a&&(this.demo3d={...this.demo3d,desc:m({...a,realistic:e})})}render(){return r`
      <h2>${s("ספריית רכיבים ו־tokens (v3)")}</h2>
      <p class="lead">${s('מקור השפה החזותית: שלושת לוחות ההדמיה ב־docs/design/reference. ממשק קומפקטי (12px), משטחים לבנים על רקע קריר, מחיצות דקות, כחול אחד במשורה, ירוק רק ל"מחובר", צל שקט, סצנות מאוירות עד חיבור זרמים.')}</p>

      <h3>${s("צבעים")}</h3>
      <div class="swatches">
        ${E.map(([e,a])=>r`<div class="swatch"><div class="c" style="background:var(${e})"></div><div class="n"><span>${a}</span><span class="ltr">${e}</span></div></div>`)}
      </div>

      <h3>${s("טיפוגרפיה (Heebo, מארח מקומית)")}</h3>
      <div class="type">
        <p style="font-size:32px;font-weight:var(--sw-fw-bold);letter-spacing:-0.03em;color:var(--sw-heading)">${s("ספרת תצוגה 32 · 1.3 TB")}</p>
        <p style="font-size:var(--sw-h1);font-weight:var(--sw-h1-weight);letter-spacing:var(--sw-h1-tracking);color:var(--sw-heading)">${s("כותרת עמוד 26")}</p>
        <p style="font-size:var(--sw-fs-2xl);font-weight:var(--sw-fw-bold);color:var(--sw-heading)">${s("כותרת מצב / Hero 20")}</p>
        <p style="font-size:var(--sw-fs-xl);font-weight:var(--sw-fw-bold);color:var(--sw-heading)">${s("כותרת כרטיס 17")}</p>
        <p style="font-size:var(--sw-fs-md);font-weight:var(--sw-fw-semibold);color:var(--sw-heading)">${s("תווית שורה 14")}</p>
        <p>${s("טקסט גוף 13: מפה של אתר, מבנה וקומה היא משטח העבודה המרכזי.")}</p>
        <p style="font-size:var(--sw-fs-sm);color:var(--sw-text-2)">${s("הסבר משני 12.5")}</p>
        <p style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${s("תווית 11 ·")} <span class="ltr">2026-09-14T08:05:38Z</span> ${s("נשאר LTR")}</p>
      </div>

      <h3>${s("מדרגות המשטח (עמוד · Hero · כרטיס · באר)")}</h3>
      <div class="ladder">
        <div class="hero"><b>${s("Hero: העצם הראשי")}</b><span class="big">84</span><small>${s("רדיוס גדול, צל 2 וקו אור עליון; אחד למסך.")}</small></div>
        <div class="card"><b>${s("כרטיס")}</b><small>${s("משטח, צל 1, כותרת 17/700. כל sw-card במסכי ההגדרות.")}</small></div>
        <div class="well"><b>${s("באר")}</b><small>${s("surface-2, בלי מתאר; שורת הגדרה, אריח התקן, מונה.")}</small></div>
      </div>

      <h3>${s("כרטיסי KPI")}</h3>
      <div class="kpis">
        <sw-kpi icon="camera" tone="live" value="24" label=${s("מצלמות")} detail=${s("מחוברות")}></sw-kpi>
        <sw-kpi icon="building" value="3" label=${s("אתרים")} detail=${s("פעילים")} tone="neutral"></sw-kpi>
        <sw-kpi icon="bell" value="12" label=${s("אירועים")} detail=${s("ב־24 השעות")} tone="neutral" badge=${s("3 חדשים")}></sw-kpi>
        <sw-kpi icon="shield" tone="stale" value=${s("חלקי")} label=${s("מצב מערכת")} detail=${s("גשר לא רענן")}></sw-kpi>
      </div>

      <h3>${s("סצנות מאוירות (מצייני מקום, לא פריימים)")}</h3>
      <div class="scenes">${O.map(e=>r`<div><sw-scene kind=${e}></sw-scene><span>${e}</span></div>`)}</div>

      <h3>${s("אריחי מצלמה")}</h3>
      <div class="grid">
        <sw-camera-tile name=${s("כניסה ראשית")} state="live" scene="entrance"></sw-camera-tile>
        <sw-camera-tile name=${s("חדר מדרגות")} state="stale" scene="corridor"></sw-camera-tile>
        <sw-camera-tile name=${s("מסדרון מזרחי")} state="offline"></sw-camera-tile>
        <sw-camera-tile name=${s("חניה")} state="forbidden"></sw-camera-tile>
      </div>

      <h3>${s("כפתורים, צ׳יפים, טאבים")}</h3>
      <div class="row">
        <sw-button variant="primary" icon="play">${s("ראשי")}</sw-button>
        <sw-button icon="history">${s("משני")}</sw-button>
        <sw-button variant="ghost" icon="pin">${s("שקוף")}</sw-button>
        <sw-button variant="danger">${s("מסוכן")}</sw-button>
        <sw-button variant="primary" disabled>${s("מושבת")}</sw-button>
        <sw-button size="sm">${s("קטן")}</sw-button>
        <sw-button iconOnly icon="refresh" label=${s("רענון")}></sw-button>
        <sw-chip selected>${s("הכל")}</sw-chip><sw-chip dot="#ef4444">${s("תנועה")}</sw-chip><sw-chip dot="#2f6bff">${s("אדם")}</sw-chip><sw-chip dot="#22c55e">${s("רכב")}</sw-chip>
        <sw-tabs .items=${[{id:"a",label:s("כל האתרים"),count:3},{id:"b",label:s("מבנים")},{id:"c",label:s("מפה")}]} active="a"></sw-tabs>
        <sw-toggle checked label=${s("מופעל")}></sw-toggle>
        <sw-avatar name=${s("יוני")}></sw-avatar>
      </div>

      <h3>${s("תגי מצב (צורה + טקסט, לא צבע בלבד)")}</h3>
      <div class="row">${L.map(e=>r`<sw-badge kind=${e}></sw-badge>`)}</div>

      <h3>${s("ציר זמן, שלבים, קומות איזומטריות")}</h3>
      <sw-timeline .segments=${b} .events=${[{minute:614,kind:"person",label:s("אדם")},{minute:582,kind:"vehicle",label:s("רכב")}]} .cursor=${615}></sw-timeline>
      <div class="row" style="margin-block-start:10px">
        <sw-card style="flex:1;min-inline-size:280px"><sw-steps .steps=${[s("גילוי"),s("הגדרה"),s("בדיקה"),s("סיום")]} .current=${1}></sw-steps></sw-card>
        <sw-floor-iso .rooms=${c("f0")} selected></sw-floor-iso>
        <sw-floor-iso .rooms=${c("f-1")}></sw-floor-iso>
        <sw-floor-iso empty></sw-floor-iso>
      </div>

      <h3>${s("מצבי מסך")}</h3>
      <div class="grid">
        ${R.map(e=>r`<div class="panel"><sw-state-panel state=${e} actionLabel=${e==="error"?s("נסה שוב"):""}></sw-state-panel></div>`)}
      </div>

      <h3>${s("תלת-ממד סכמטי (T087)")}</h3>
      <div data-3d-demo style="display:flex;flex-direction:column;gap:8px;max-inline-size:720px">
        ${this.demo3d.desc?r`<sw-plan-3d style="block-size:360px;border:1px solid var(--sw-border);border-radius:var(--sw-r-md)" .description=${this.demo3d.desc} .selectedId=${this.demo3d.selected} .labels=${k("f0")}
                .cameras=${[{id:"cam-1",label:s("כניסה ראשית")},{id:"cam-2",label:s("לובי")}]} exportName="demo-floor"
                @part-select=${e=>this.demo3d={...this.demo3d,selected:e.detail.id}}
                @realistic-change=${e=>this.onRealistic(e.detail.on)}></sw-plan-3d>
              <div style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">${s("נבחר:")} <span class="ltr" data-3d-demo-selected>${this.demo3d.selected??""}</span></div>`:r`<div><sw-button icon="cube" data-3d-demo-load ?disabled=${!v()||this.demo3d.loading} @click=${()=>this.load3d()}>${this.demo3d.loading?s("טוען…"):s("טען תצוגת 3D")}</sw-button>
              ${v()?p:r`<span data-3d-unavailable style="margin-inline-start:8px">${z}</span>`}
              ${this.demo3d.error?r`<span style="color:var(--sw-danger);margin-inline-start:8px">${this.demo3d.error}</span>`:p}</div>`}
      </div>

      <h3>${s("אייקונים")}</h3>
      <div class="icons">${A.map(e=>r`<div class="icon"><sw-icon .name=${e} size=${18}></sw-icon><span class="ltr">${e}</span></div>`)}</div>
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
