import{i as b,aL as f,a3 as h,fn as u,n as w,fo as g,fp as $,A as l,b as i,fq as y,Y as m,aU as x,g as k,j as v,k as z}from"./index-CkOaAZ0k.js";import"./sw-chip-C1MTUyAg.js";import{I as _}from"./investigate-r5-css-CNcHuIOU.js";import{t as e}from"./investigate-B-MtmE0p.js";import"./sw-logo-art-MaHPMZFI.js";var j=Object.defineProperty,q=Object.getOwnPropertyDescriptor,p=(s,r,t,n)=>{for(var o=n>1?void 0:n?q(r,t):r,a=s.length-1,d;a>=0;a--)(d=s[a])&&(o=(n?d(r,t,o):d(o))||o);return n&&o&&j(r,t,o),o};const A=[{scene:"entrance",when:"14.09.2026 10:14",cam:"כניסה ראשית",why:"מקליט: זיהוי אדם (Smart)"},{scene:"lobby",when:"14.09.2026 10:13",cam:"לובי",why:"מקליט: תנועה + סמיכות במפה לכניסה"},{scene:"parking",when:"14.09.2026 06:43",cam:"חניה מקורה",why:"מקליט: חציית קו"},{scene:"entrance",when:"14.09.2026 08:12",cam:"כניסה ראשית",why:"התקן: דלת נפתחה + תנועה"},{scene:"corridor",when:"13.09.2026 23:10",cam:"מסדרון מזרחי",why:"מקליט: זיהוי אדם"},{scene:"backyard",when:"13.09.2026 18:03",cam:"חצר אחורית",why:"מקליט: תנועה"}];let c=class extends b{constructor(){super(...arguments),this.bubbleSkin=new f(this),this.by="person",this.q="",this.answer=null,this.providers=null,this.busy=!1,this.error="",this.errorFrom="search"}connectedCallback(){super.connectedCallback(),h()&&this.loadProviders()}async loadProviders(){try{this.providers=await u(),this.errorFrom==="providers"&&(this.error="")}catch(s){this.errorFrom="providers",this.error=w(s)}}async run(){const s=this.q.trim();if(s){this.busy=!0,this.errorFrom==="search"&&(this.error="");try{this.answer=await g(s)}catch(r){this.errorFrom="search",this.error=w(r)}finally{this.busy=!1}}}fmt(s){try{return $(new Date(s))}catch{return s}}renderApi(){const s=this.answer,r=this.providers,t=r?.providers.find(a=>a.id==="local"),n=r?.providers.find(a=>a.id==="external"),o={person:e("אדם"),vehicle:e("רכב"),motion:e("תנועה"),line:e("חציית קו"),field:e("חדירה"),door:e("דלת"),offline:e("ניתוק"),coverage_gap:e("פער כיסוי"),other:e("אחר")};return i`
      <sw-page heading=${e("חיפוש AI")} subheading=${e("שאלה חופשית → מסננים של מרכז האירועים (סוג, מקום, זמן) · baseline מקומי ללא רשת · ספק חיצוני רק ב־opt-in")}>
        <sw-badge slot="actions" kind=${r?.active==="local"?"live":"unknown"} label=${r?r.active==="local"?e("ספק: baseline מקומי · {version}",{version:t?.model_version??""}):r.active==="none"?e("חיפוש סמנטי כבוי"):e("ספק: {provider}",{provider:r.active}):this.error&&this.errorFrom==="providers"?e("הספקים לא נקראו"):e("טוען…")}></sw-badge>
        <div class="wrap">
          <div class="searchrow">
            <sw-field><input type="search" data-semantic-q placeholder=${e("למשל: אדם בלובי אתמול בערב · vehicle near the gate this morning")} aria-label=${e("חיפוש")} .value=${this.q} @input=${a=>this.q=a.target.value} @keydown=${a=>{a.key==="Enter"&&this.run()}} /></sw-field>
            <sw-button variant="primary" icon="search" data-semantic-run ?disabled=${this.busy||!this.q.trim()} @click=${()=>this.run()}>${e("חפש")}</sw-button>
          </div>
          ${this.error?i`<sw-state-panel compact state="error" heading=${this.errorFrom==="providers"?e("ספקי הניתוח לא נקראו"):e("החיפוש לא הושלם")} hint=${this.error} actionLabel=${e("נסה שוב")} data-semantic-error
                @action=${()=>void(this.errorFrom==="providers"?this.loadProviders():this.run())}></sw-state-panel>`:l}
          ${this.busy?i`<sw-state-panel compact state="loading" heading=${e("מחפש…")} hint=${e("מפרש את השאלה ומסנן את האירועים בהיקף שלך")} data-semantic-loading></sw-state-panel>`:s?i`<sw-card heading=${e("כך פורשה השאלה")} subheading=${`${s.provider.name} · ${s.provider.model_version} · ${e("ללא רשת")}`} data-semantic-parsed>
                  <div class="chips">
                    ${s.parsed.objects.map(a=>i`<sw-chip selected icon="target">${y[a]??a}</sw-chip>`)}
                    ${s.parsed.places.map(a=>i`<sw-chip selected icon=${a.kind==="camera"?"camera":a.kind==="floor"?"floor":"map"} title=${e('התאמה {match} למונח "{term}"',{match:a.match==="exact"?e("מדויקת"):e("חלקית"),term:a.term})}>${a.name}${a.match==="partial"?" (~)":""}</sw-chip>`)}
                    ${s.parsed.window?i`<sw-chip selected icon="clock">${s.parsed.window.label}</sw-chip>`:l}
                    ${!s.parsed.objects.length&&!s.parsed.places.length&&!s.parsed.window?i`<span class="note">${e("לא זוהה סוג, מקום או זמן — מוצגים אירועי היום בהיקף שלך.")}</span>`:l}
                  </div>
                  ${s.unsupported.length?i`<div class="note" style="margin-block-start:6px;color:var(--sw-warning-text)" data-semantic-unsupported>${e("לא נתמך ב־baseline המקומי:")} ${s.unsupported.map(a=>`"${a.term}" — ${e("{what} דורש ספק ניתוח ב־opt-in",{what:a.reason.startsWith("color")?e("צבע"):e("מאפיין מראה")})}`).join(" · ")}</div>`:l}
                  ${s.parsed.leftovers.length?i`<div class="note" style="margin-block-start:4px">${e("מילים שלא שימשו:")} ${s.parsed.leftovers.join(", ")}</div>`:l}
                </sw-card>
                <div class="head"><span>${e("{n} התאמות (לפי metadata)",{n:s.total})}</span><a href="#/investigate/events">${e("מרכז האירועים")}</a></div>
                ${s.results.length?i`<div class="list">${s.results.map(a=>i`<div class="row" role="link" tabindex="0" data-semantic-result data-confidence=${a.match.confidence} @click=${()=>m(`/investigate/events/${a.id}`)} @keydown=${d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),m(`/investigate/events/${a.id}`))}}>
                        <sw-badge kind=${a.match.confidence==="exact"?"live":"stale"} label=${a.match.confidence==="exact"?e("התאמה מדויקת"):e("התאמה חלקית")}></sw-badge>
                        <div class="body"><strong>${o[a.type]??a.type} · ${a.camera_name??"—"}</strong><span class="note">${this.fmt(a.occurred_at)} · ${a.confidence==="measured"?e("נמדד במכשיר"):e("משוער")} · ${a.match.basis.join(" · ")}</span></div>
                      </div>`)}</div>`:i`<div class="note">${e("אין אירועים תואמים בהיקף ובחלון הזמן.")}</div>`}
                <div class="note" data-semantic-note>${s.note}</div>`:i`<div class="note">${e("כתוב שאלה חופשית בעברית או באנגלית. ה־baseline מבין סוג (אדם/רכב/תנועה/דלת/חצייה/חדירה), מקומות מהקטלוג (חדרים, קומות, מצלמות) וזמן (היום, אתמול, בערב, 08:00–09:30, השבוע).")}</div>`}
          <sw-card heading=${e("ספקי ניתוח")} subheading=${e("מדיניות פרטיות, גרסת מודל, תקציב ו־opt-in הם חלק מהחוזה של כל ספק")} data-semantic-provider>
            ${t?i`<div class="prov"><strong>${t.name}</strong> · ${e("גרסה {version}",{version:t.model_version})} · ${t.network?e("רשת"):e("ללא רשת")} · ${e("תקציב יומי {budget}",{budget:t.budget_daily})}<div class="note">${t.privacy}</div><div class="note">${e("יכולות:")} ${t.capabilities.join(", ")}</div></div>`:l}
            ${n?i`<div class="prov" style="margin-block-start:8px"><strong>${n.name}</strong> · ${n.available===!1?e("לא זמין"):e("זמין")} · ${e("opt-in נדרש")}<div class="note">${n.privacy}</div><div class="note">${n.reason??""}</div><div class="note">${e("הגדרות:")} ai.provider=${r?.settings["ai.provider"]} · ai.privacy_ack=${r?.settings["ai.privacy_ack"]} · ai.budget_daily=${r?.settings["ai.budget_daily"]}</div></div>`:l}
            <div class="actions" style="margin-block-start:8px"><sw-button size="sm" icon="upload" disabled title=${e("דורש ספק ניתוח חיצוני ב־opt-in")}>${e("חיפוש לפי תמונה")}</sw-button><sw-button size="sm" icon="aperture" disabled title=${e("דורש ספק ניתוח חיצוני ב־opt-in")}>${e("השתמש בפריים הנוכחי")}</sw-button><span class="note">${e("חיפוש לפי תמונה, צבע ומראה אינו פעיל עד שמוגדר ספק עם הסכמה ותקציב.")}</span></div>
          </sw-card>
        </div>
      </sw-page>
    `}render(){return h()?this.renderApi():i`
      <sw-page heading=${e("חיפוש AI")} subheading=${e("מצא בדיוק את מה שאתה מחפש · חיפוש סמנטי רק עם אינדקס אמיתי · נתוני הדגמה")}>
        <sw-badge slot="actions" kind="unknown" label=${e("אין ספק AI מוגדר · רמה 0 (מטא־דאטה מקליט)")}></sw-badge>
        <div class="wrap">
          <div class="searchrow">
            <sw-field><input type="search" value="אדם בכניסה הראשית היום" aria-label=${e("חיפוש")} /></sw-field>
            <sw-button variant="primary" icon="search">${e("חפש")}</sw-button>
          </div>
          <sw-tabs .items=${[{id:"person",label:e("אדם")},{id:"vehicle",label:e("רכב")},{id:"object",label:e("עצם")},{id:"color",label:e("צבע")},{id:"time",label:e("זמן")},{id:"site",label:e("אתר")}]} .active=${this.by} @change=${s=>this.by=s.detail.id}></sw-tabs>
          <sw-card>
            <div class="by">
              <div class="ref"><sw-scene kind="entrance"></sw-scene></div>
              <div class="txt">
                <b>${e("חיפוש לפי {what}",{what:this.by==="person"?e("אדם"):this.by==="vehicle"?e("רכב"):e("מאפיין")})}</b>
                <p>${e("מציאת הופעות של אותו אדם בכל המצלמות. פורש כ: סוג = אדם · קומה 0 · היום. זיהוי צבע, פנים או טקסט חופשי אינם פעילים עד שמוגדר ספק ומאושר dataset.")}</p>
                <div class="actions"><sw-button variant="primary" size="sm" icon="upload" disabled>${e("העלאת תמונה")}</sw-button><sw-button size="sm" icon="aperture" disabled>${e("השתמש בפריים הנוכחי")}</sw-button><sw-chip selected icon="target">${e("אדם")}</sw-chip><sw-chip selected icon="floor">${e("קומה 0")}</sw-chip><sw-chip selected icon="clock">${e("היום")}</sw-chip></div>
              </div>
            </div>
          </sw-card>
          <div class="head"><span>${e("התאמות (לפי מטא־דאטה)")}</span><a href="#/investigate/events">${e("הצג הכל")}</a></div>
          <div class="results">
            ${A.map(s=>i`<div class="res" @click=${()=>window.location.hash="#/investigate/playback"}><div class="pic"><sw-scene kind=${s.scene}></sw-scene><span class="demo">${e("דמו")}</span></div><div class="cap">${s.when}<small>${s.cam} · ${s.why}</small></div></div>`)}
          </div>
        </div>
      </sw-page>
    `}};c.styles=[k`
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
  `,x,_];p([v()],c.prototype,"by",2);p([v()],c.prototype,"q",2);p([v()],c.prototype,"answer",2);p([v()],c.prototype,"providers",2);p([v()],c.prototype,"busy",2);p([v()],c.prototype,"error",2);c=p([z("investigate-search")],c);export{c as InvestigateSearch};
