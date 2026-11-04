import{a as b,S as m,i as v,tx as f,R as w,ty as u,kc as g,A as d,e as a,tz as y,aj as h,C as x,E as $,G as p,H as k}from"./index-D2ApsviK.js";import"./sw-chip-B2wSk6WH.js";import{I as z}from"./investigate-r5-css-eeSbOZhW.js";import"./sw-logo-art-Va6y_cIM.js";var _=Object.defineProperty,j=Object.getOwnPropertyDescriptor,l=(e,i,r,t)=>{for(var n=t>1?void 0:t?j(i,r):i,s=e.length-1,c;s>=0;s--)(c=e[s])&&(n=(t?c(i,r,n):c(n))||n);return t&&n&&_(i,r,n),n};const E=[{scene:"entrance",when:"14.09.2026 10:14",cam:"כניסה ראשית",why:"NVR: זיהוי אדם (Smart)"},{scene:"lobby",when:"14.09.2026 10:13",cam:"לובי",why:"NVR: תנועה + סמיכות במפה לכניסה"},{scene:"parking",when:"14.09.2026 06:43",cam:"חניה מקורה",why:"NVR: חציית קו"},{scene:"entrance",when:"14.09.2026 08:12",cam:"כניסה ראשית",why:"התקן: דלת נפתחה + תנועה"},{scene:"corridor",when:"13.09.2026 23:10",cam:"מסדרון מזרחי",why:"NVR: זיהוי אדם"},{scene:"backyard",when:"13.09.2026 18:03",cam:"חצר אחורית",why:"NVR: תנועה"}];let o=class extends b{constructor(){super(...arguments),this.bubbleSkin=new m(this),this.by="person",this.q="",this.answer=null,this.providers=null,this.busy=!1,this.error="",this.errorFrom="search"}connectedCallback(){super.connectedCallback(),v()&&this.loadProviders()}async loadProviders(){try{this.providers=await f(),this.errorFrom==="providers"&&(this.error="")}catch(e){this.errorFrom="providers",this.error=w(e)}}async run(){const e=this.q.trim();if(e){this.busy=!0,this.errorFrom==="search"&&(this.error="");try{this.answer=await u(e)}catch(i){this.errorFrom="search",this.error=w(i)}finally{this.busy=!1}}}fmt(e){try{return g(new Date(e))}catch{return e}}renderApi(){const e=this.answer,i=this.providers,r=i?.providers.find(s=>s.id==="local"),t=i?.providers.find(s=>s.id==="external"),n={person:"אדם",vehicle:"רכב",motion:"תנועה",line:"חציית קו",field:"חדירה",door:"דלת",offline:"ניתוק",coverage_gap:"פער כיסוי",other:"אחר"};return a`
      <sw-page heading="חיפוש AI" subheading="שאלה חופשית → מסננים של מרכז האירועים (סוג, מקום, זמן) · baseline מקומי ללא רשת · ספק חיצוני רק ב־opt-in">
        <sw-badge slot="actions" kind=${i?.active==="local"?"live":"unknown"} label=${i?i.active==="local"?`ספק: baseline מקומי · ${r?.model_version??""}`:i.active==="none"?"חיפוש סמנטי כבוי":`ספק: ${i.active}`:this.error&&this.errorFrom==="providers"?"הספקים לא נקראו":"טוען…"}></sw-badge>
        <div class="wrap">
          <div class="searchrow">
            <sw-field><input type="search" data-semantic-q placeholder="למשל: אדם בלובי אתמול בערב · vehicle near the gate this morning" aria-label="חיפוש" .value=${this.q} @input=${s=>this.q=s.target.value} @keydown=${s=>{s.key==="Enter"&&this.run()}} /></sw-field>
            <sw-button variant="primary" icon="search" data-semantic-run ?disabled=${this.busy||!this.q.trim()} @click=${()=>this.run()}>חפש</sw-button>
          </div>
          ${this.error?a`<sw-state-panel compact state="error" heading=${this.errorFrom==="providers"?"ספקי הניתוח לא נקראו":"החיפוש לא הושלם"} hint=${this.error} actionLabel="נסה שוב" data-semantic-error
                @action=${()=>void(this.errorFrom==="providers"?this.loadProviders():this.run())}></sw-state-panel>`:d}
          ${this.busy?a`<sw-state-panel compact state="loading" heading="מחפש…" hint="מפרש את השאלה ומסנן את האירועים בהיקף שלך" data-semantic-loading></sw-state-panel>`:e?a`<sw-card heading="כך פורשה השאלה" subheading=${`${e.provider.name} · ${e.provider.model_version} · ללא רשת`} data-semantic-parsed>
                  <div class="chips">
                    ${e.parsed.objects.map(s=>a`<sw-chip selected icon="target">${y[s]??s}</sw-chip>`)}
                    ${e.parsed.places.map(s=>a`<sw-chip selected icon=${s.kind==="camera"?"camera":s.kind==="floor"?"floor":"map"} title=${`התאמה ${s.match==="exact"?"מדויקת":"חלקית"} למונח "${s.term}"`}>${s.name}${s.match==="partial"?" (~)":""}</sw-chip>`)}
                    ${e.parsed.window?a`<sw-chip selected icon="clock">${e.parsed.window.label}</sw-chip>`:d}
                    ${!e.parsed.objects.length&&!e.parsed.places.length&&!e.parsed.window?a`<span class="note">לא זוהה סוג, מקום או זמן — מוצגים אירועי היום בהיקף שלך.</span>`:d}
                  </div>
                  ${e.unsupported.length?a`<div class="note" style="margin-block-start:6px;color:var(--sw-warning-text)" data-semantic-unsupported>לא נתמך ב־baseline המקומי: ${e.unsupported.map(s=>`"${s.term}" — ${s.reason.startsWith("color")?"צבע":"מאפיין מראה"} דורש ספק ניתוח ב־opt-in`).join(" · ")}</div>`:d}
                  ${e.parsed.leftovers.length?a`<div class="note" style="margin-block-start:4px">מילים שלא שימשו: ${e.parsed.leftovers.join(", ")}</div>`:d}
                </sw-card>
                <div class="head"><span>${e.total} התאמות (לפי metadata)</span><a href="#/investigate/events">מרכז האירועים</a></div>
                ${e.results.length?a`<div class="list">${e.results.map(s=>a`<div class="row" role="link" tabindex="0" data-semantic-result data-confidence=${s.match.confidence} @click=${()=>h(`/investigate/events/${s.id}`)} @keydown=${c=>{(c.key==="Enter"||c.key===" ")&&(c.preventDefault(),h(`/investigate/events/${s.id}`))}}>
                        <sw-badge kind=${s.match.confidence==="exact"?"live":"stale"} label=${s.match.confidence==="exact"?"התאמה מדויקת":"התאמה חלקית"}></sw-badge>
                        <div class="body"><strong>${n[s.type]??s.type} · ${s.camera_name??"—"}</strong><span class="note">${this.fmt(s.occurred_at)} · ${s.confidence==="measured"?"נמדד במכשיר":"משוער"} · ${s.match.basis.join(" · ")}</span></div>
                      </div>`)}</div>`:a`<div class="note">אין אירועים תואמים בהיקף ובחלון הזמן.</div>`}
                <div class="note" data-semantic-note>${e.note}</div>`:a`<div class="note">כתוב שאלה חופשית בעברית או באנגלית. ה־baseline מבין סוג (אדם/רכב/תנועה/דלת/חצייה/חדירה), מקומות מהקטלוג (חדרים, קומות, מצלמות) וזמן (היום, אתמול, בערב, 08:00–09:30, השבוע).</div>`}
          <sw-card heading="ספקי ניתוח" subheading="מדיניות פרטיות, גרסת מודל, תקציב ו־opt-in הם חלק מהחוזה של כל ספק" data-semantic-provider>
            ${r?a`<div class="prov"><strong>${r.name}</strong> · גרסה ${r.model_version} · ${r.network?"רשת":"ללא רשת"} · תקציב יומי ${r.budget_daily}<div class="note">${r.privacy}</div><div class="note">יכולות: ${r.capabilities.join(", ")}</div></div>`:d}
            ${t?a`<div class="prov" style="margin-block-start:8px"><strong>${t.name}</strong> · ${t.available===!1?"לא זמין":"זמין"} · opt-in נדרש<div class="note">${t.privacy}</div><div class="note">${t.reason??""}</div><div class="note">הגדרות: ai.provider=${i?.settings["ai.provider"]} · ai.privacy_ack=${i?.settings["ai.privacy_ack"]} · ai.budget_daily=${i?.settings["ai.budget_daily"]}</div></div>`:d}
            <div class="actions" style="margin-block-start:8px"><sw-button size="sm" icon="upload" disabled title="דורש ספק ניתוח חיצוני ב־opt-in">חיפוש לפי תמונה</sw-button><sw-button size="sm" icon="aperture" disabled title="דורש ספק ניתוח חיצוני ב־opt-in">השתמש בפריים הנוכחי</sw-button><span class="note">חיפוש לפי תמונה, צבע ומראה אינו פעיל עד שמוגדר ספק עם הסכמה ותקציב.</span></div>
          </sw-card>
        </div>
      </sw-page>
    `}render(){return v()?this.renderApi():a`
      <sw-page heading="חיפוש AI" subheading="מצא בדיוק את מה שאתה מחפש · חיפוש סמנטי רק עם אינדקס אמיתי · נתוני הדגמה">
        <sw-badge slot="actions" kind="unknown" label="אין ספק AI מוגדר · רמה 0 (מטא־דאטה NVR)"></sw-badge>
        <div class="wrap">
          <div class="searchrow">
            <sw-field><input type="search" value="אדם בכניסה הראשית היום" aria-label="חיפוש" /></sw-field>
            <sw-button variant="primary" icon="search">חפש</sw-button>
          </div>
          <sw-tabs .items=${[{id:"person",label:"אדם"},{id:"vehicle",label:"רכב"},{id:"object",label:"עצם"},{id:"color",label:"צבע"},{id:"time",label:"זמן"},{id:"site",label:"אתר"}]} .active=${this.by} @change=${e=>this.by=e.detail.id}></sw-tabs>
          <sw-card>
            <div class="by">
              <div class="ref"><sw-scene kind="entrance"></sw-scene></div>
              <div class="txt">
                <b>חיפוש לפי ${this.by==="person"?"אדם":this.by==="vehicle"?"רכב":"מאפיין"}</b>
                <p>מציאת הופעות של אותו אדם בכל המצלמות. פורש כ: סוג = אדם · קומה 0 · היום. זיהוי צבע, פנים או טקסט חופשי אינם פעילים עד שמוגדר ספק ומאושר dataset.</p>
                <div class="actions"><sw-button variant="primary" size="sm" icon="upload" disabled>העלאת תמונה</sw-button><sw-button size="sm" icon="aperture" disabled>השתמש בפריים הנוכחי</sw-button><sw-chip selected icon="target">אדם</sw-chip><sw-chip selected icon="floor">קומה 0</sw-chip><sw-chip selected icon="clock">היום</sw-chip></div>
              </div>
            </div>
          </sw-card>
          <div class="head"><span>התאמות (לפי מטא־דאטה)</span><a href="#/investigate/events">הצג הכל</a></div>
          <div class="results">
            ${E.map(e=>a`<div class="res" @click=${()=>window.location.hash="#/investigate/playback"}><div class="pic"><sw-scene kind=${e.scene}></sw-scene><span class="demo">דמו</span></div><div class="cap">${e.when}<small>${e.cam} · ${e.why}</small></div></div>`)}
          </div>
        </div>
      </sw-page>
    `}};o.styles=[$`
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      border: 1px solid var(--sw-line);
      cursor: pointer;
    }
    .row .body {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .prov {
      font-size: var(--sw-fs-sm);
    }
    .wrap {
      max-inline-size: 860px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .by {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .by .ref {
      inline-size: 160px;
      block-size: 100px;
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-2);
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
    }
    .by .ref sw-scene {
      position: absolute;
      inset: 0;
    }
    .by .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .by b {
      display: block;
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      color: var(--sw-heading);
      letter-spacing: -0.02em;
    }
    .by p {
      margin: 2px 0 10px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      color: var(--sw-heading);
      letter-spacing: -0.02em;
    }
    .head a {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
    }
    .results {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    /* R5-INVESTIGATE-297: a match is an object - picture on top, the time as the title on a well, sinks on pointer-down */
    .res {
      cursor: pointer;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      overflow: hidden;
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    .res:active {
      transform: scale(var(--sw-press-scale));
    }
    .res .pic {
      position: relative;
      aspect-ratio: 16 / 10;
      overflow: hidden;
    }
    .res .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .res .pic .demo {
      position: absolute;
      inset-inline-end: 6px;
      inset-block-start: 6px;
      font-size: var(--sw-fs-2xs);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-2xs);
      padding: 1px 6px;
    }
    .res .cap {
      padding: 8px 12px 10px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
      line-height: 1.3;
      font-variant-numeric: tabular-nums;
    }
    .res .cap small {
      display: block;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-regular, 400);
      color: var(--sw-text-3);
    }
    .searchrow {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .searchrow sw-field {
      flex: 1;
    }
    /* POLISH4-WP2 (D10): a result row and a match card are targets - a wash on a fine pointer only (no sticky hover on touch), the
       press on pointer-down (a wash + the skin's press scale), a focus ring for the keyboard; still under reduced motion */
    .row {
      -webkit-tap-highlight-color: transparent;
      transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .row:active {
      background: var(--sw-pressed-wash);
      transform: scale(var(--sw-press-scale));
    }
    .row:focus-visible,
    .res:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .res {
      -webkit-tap-highlight-color: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .row:hover {
        background: var(--sw-surface-2);
      }
      .res:hover {
        border-color: var(--sw-border-strong);
      }
      .head a:hover {
        text-decoration: underline;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .row,
      .res {
        transition: none;
      }
      .row:active,
      .res:active {
        transform: none;
      }
    }
    @media (max-width: 767px) {
      .results {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      /* the phone: the reference picture sits above its text instead of squeezing it to a 150 px column */
      .by {
        flex-direction: column;
        align-items: stretch;
      }
      .by .ref {
        inline-size: 100%;
        block-size: 120px;
      }
      .head {
        font-size: var(--sw-fs-lg);
      }
      .row {
        align-items: flex-start;
      }
    }
  `,x,z];l([p()],o.prototype,"by",2);l([p()],o.prototype,"q",2);l([p()],o.prototype,"answer",2);l([p()],o.prototype,"providers",2);l([p()],o.prototype,"busy",2);l([p()],o.prototype,"error",2);o=l([k("investigate-search")],o);export{o as InvestigateSearch};
//# sourceMappingURL=investigate-search-CkwHAzr1.js.map
