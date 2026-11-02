import{a as h,S as b,i as v,sB as m,R as w,sC as u,jl as g,A as c,e as i,sD as f,aj as y,C as x,E as $,G as l,H as k}from"./index-D0R90ECk.js";import"./sw-chip-B3vbD_Km.js";import{I as _}from"./investigate-r5-css-eYJgcmvO.js";import"./sw-logo-art-Va6y_cIM.js";var z=Object.defineProperty,j=Object.getOwnPropertyDescriptor,d=(e,a,t,r)=>{for(var n=r>1?void 0:r?j(a,t):a,s=e.length-1,p;s>=0;s--)(p=e[s])&&(n=(r?p(a,t,n):p(n))||n);return r&&n&&z(a,t,n),n};const A=[{scene:"entrance",when:"14.09.2026 10:14",cam:"כניסה ראשית",why:"NVR: זיהוי אדם (Smart)"},{scene:"lobby",when:"14.09.2026 10:13",cam:"לובי",why:"NVR: תנועה + סמיכות במפה לכניסה"},{scene:"parking",when:"14.09.2026 06:43",cam:"חניה מקורה",why:"NVR: חציית קו"},{scene:"entrance",when:"14.09.2026 08:12",cam:"כניסה ראשית",why:"התקן: דלת נפתחה + תנועה"},{scene:"corridor",when:"13.09.2026 23:10",cam:"מסדרון מזרחי",why:"NVR: זיהוי אדם"},{scene:"backyard",when:"13.09.2026 18:03",cam:"חצר אחורית",why:"NVR: תנועה"}];let o=class extends h{constructor(){super(...arguments),this.bubbleSkin=new b(this),this.by="person",this.q="",this.answer=null,this.providers=null,this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),v()&&this.loadProviders()}async loadProviders(){try{this.providers=await m()}catch(e){this.error=w(e)}}async run(){const e=this.q.trim();if(e){this.busy=!0,this.error="";try{this.answer=await u(e)}catch(a){this.error=w(a)}finally{this.busy=!1}}}fmt(e){try{return g(new Date(e))}catch{return e}}renderApi(){const e=this.answer,a=this.providers,t=a?.providers.find(s=>s.id==="local"),r=a?.providers.find(s=>s.id==="external"),n={person:"אדם",vehicle:"רכב",motion:"תנועה",line:"חציית קו",field:"חדירה",door:"דלת",offline:"ניתוק",coverage_gap:"פער כיסוי",other:"אחר"};return i`
      <sw-page heading="חיפוש AI" subheading="שאלה חופשית → מסננים של מרכז האירועים (סוג, מקום, זמן) · baseline מקומי ללא רשת · ספק חיצוני רק ב־opt-in">
        <sw-badge slot="actions" kind=${a?.active==="local"?"live":"unknown"} label=${a?a.active==="local"?`ספק: baseline מקומי · ${t?.model_version??""}`:a.active==="none"?"חיפוש סמנטי כבוי":`ספק: ${a.active}`:"טוען…"}></sw-badge>
        <div class="wrap">
          <div class="searchrow">
            <sw-field><input type="search" data-semantic-q placeholder="למשל: אדם בלובי אתמול בערב · vehicle near the gate this morning" aria-label="חיפוש" .value=${this.q} @input=${s=>this.q=s.target.value} @keydown=${s=>{s.key==="Enter"&&this.run()}} /></sw-field>
            <sw-button variant="primary" icon="search" data-semantic-run ?disabled=${this.busy||!this.q.trim()} @click=${()=>this.run()}>חפש</sw-button>
          </div>
          ${this.error?i`<div class="note" style="color:var(--sw-danger)">${this.error}</div>`:c}
          ${e?i`<sw-card heading="כך פורשה השאלה" subheading=${`${e.provider.name} · ${e.provider.model_version} · ללא רשת`} data-semantic-parsed>
                  <div class="chips">
                    ${e.parsed.objects.map(s=>i`<sw-chip selected icon="target">${f[s]??s}</sw-chip>`)}
                    ${e.parsed.places.map(s=>i`<sw-chip selected icon=${s.kind==="camera"?"camera":s.kind==="floor"?"floor":"map"} title=${`התאמה ${s.match==="exact"?"מדויקת":"חלקית"} למונח "${s.term}"`}>${s.name}${s.match==="partial"?" (~)":""}</sw-chip>`)}
                    ${e.parsed.window?i`<sw-chip selected icon="clock">${e.parsed.window.label}</sw-chip>`:c}
                    ${!e.parsed.objects.length&&!e.parsed.places.length&&!e.parsed.window?i`<span class="note">לא זוהה סוג, מקום או זמן — מוצגים אירועי היום בהיקף שלך.</span>`:c}
                  </div>
                  ${e.unsupported.length?i`<div class="note" style="margin-block-start:6px;color:var(--sw-warning-text)" data-semantic-unsupported>לא נתמך ב־baseline המקומי: ${e.unsupported.map(s=>`"${s.term}" — ${s.reason.startsWith("color")?"צבע":"מאפיין מראה"} דורש ספק ניתוח ב־opt-in`).join(" · ")}</div>`:c}
                  ${e.parsed.leftovers.length?i`<div class="note" style="margin-block-start:4px">מילים שלא שימשו: ${e.parsed.leftovers.join(", ")}</div>`:c}
                </sw-card>
                <div class="head"><span>${e.total} התאמות (לפי metadata)</span><a href="#/investigate/events">מרכז האירועים</a></div>
                ${e.results.length?i`<div class="list">${e.results.map(s=>i`<div class="row" data-semantic-result data-confidence=${s.match.confidence} @click=${()=>y(`/investigate/events/${s.id}`)}>
                        <sw-badge kind=${s.match.confidence==="exact"?"live":"stale"} label=${s.match.confidence==="exact"?"התאמה מדויקת":"התאמה חלקית"}></sw-badge>
                        <div class="body"><strong>${n[s.type]??s.type} · ${s.camera_name??"—"}</strong><span class="note">${this.fmt(s.occurred_at)} · ${s.confidence==="measured"?"נמדד במכשיר":"משוער"} · ${s.match.basis.join(" · ")}</span></div>
                      </div>`)}</div>`:i`<div class="note">אין אירועים תואמים בהיקף ובחלון הזמן.</div>`}
                <div class="note" data-semantic-note>${e.note}</div>`:i`<div class="note">כתוב שאלה חופשית בעברית או באנגלית. ה־baseline מבין סוג (אדם/רכב/תנועה/דלת/חצייה/חדירה), מקומות מהקטלוג (חדרים, קומות, מצלמות) וזמן (היום, אתמול, בערב, 08:00–09:30, השבוע).</div>`}
          <sw-card heading="ספקי ניתוח" subheading="מדיניות פרטיות, גרסת מודל, תקציב ו־opt-in הם חלק מהחוזה של כל ספק" data-semantic-provider>
            ${t?i`<div class="prov"><strong>${t.name}</strong> · גרסה ${t.model_version} · ${t.network?"רשת":"ללא רשת"} · תקציב יומי ${t.budget_daily}<div class="note">${t.privacy}</div><div class="note">יכולות: ${t.capabilities.join(", ")}</div></div>`:c}
            ${r?i`<div class="prov" style="margin-block-start:8px"><strong>${r.name}</strong> · ${r.available===!1?"לא זמין":"זמין"} · opt-in נדרש<div class="note">${r.privacy}</div><div class="note">${r.reason??""}</div><div class="note">הגדרות: ai.provider=${a?.settings["ai.provider"]} · ai.privacy_ack=${a?.settings["ai.privacy_ack"]} · ai.budget_daily=${a?.settings["ai.budget_daily"]}</div></div>`:c}
            <div class="actions" style="margin-block-start:8px"><sw-button size="sm" icon="upload" disabled title="דורש ספק ניתוח חיצוני ב־opt-in">חיפוש לפי תמונה</sw-button><sw-button size="sm" icon="aperture" disabled title="דורש ספק ניתוח חיצוני ב־opt-in">השתמש בפריים הנוכחי</sw-button><span class="note">חיפוש לפי תמונה, צבע ומראה אינו פעיל עד שמוגדר ספק עם הסכמה ותקציב.</span></div>
          </sw-card>
        </div>
      </sw-page>
    `}render(){return v()?this.renderApi():i`
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
            ${A.map(e=>i`<div class="res" @click=${()=>window.location.hash="#/investigate/playback"}><div class="pic"><sw-scene kind=${e.scene}></sw-scene><span class="demo">דמו</span></div><div class="cap">${e.when}<small>${e.cam} · ${e.why}</small></div></div>`)}
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
    @media (max-width: 767px) {
      .results {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,x,_];d([l()],o.prototype,"by",2);d([l()],o.prototype,"q",2);d([l()],o.prototype,"answer",2);d([l()],o.prototype,"providers",2);d([l()],o.prototype,"busy",2);d([l()],o.prototype,"error",2);o=d([k("investigate-search")],o);export{o as InvestigateSearch};
//# sourceMappingURL=investigate-search-BJ6e0OAG.js.map
