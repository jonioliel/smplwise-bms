const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as v}from"./sw-logo-art-PLtEZJxU.js";import{dL as e,g as R,ax as I,j as g,i as S,R as D,E5 as T,a2 as x,n as u,kd as C,E6 as F,E7 as N,k5 as f,k3 as O,k7 as P,k4 as A,E8 as L,E9 as M,b as n,A as p,Ea as B,Eb as j,Ec as H,a9 as V,u as G,Ed as X,k as U,U as d,Ee as K,Ef as W,Eg as q,Eh as J,hz as _,Ei as Q,kb as Y,kc as Z}from"./index-kipM9krC.js";import"./sw-floor-home-link-BTE-X78Q.js";var ss=Object.defineProperty,as=Object.getOwnPropertyDescriptor,c=(s,a,t,i)=>{for(var r=i>1?void 0:i?as(a,t):a,l=s.length-1,h;l>=0;l--)(h=s[l])&&(r=(i?h(a,t,r):h(r))||r);return i&&r&&ss(a,t,r),r};let b=null;function ts(){return b??=Promise.all([v(()=>import("./mapping-assistant-DdyNvwv7.js"),__vite__mapDeps([0]),import.meta.url),v(()=>import("./mapping-decide-DGVOV8kP.js"),__vite__mapDeps([0]),import.meta.url),v(()=>import("./mapping-rules-B18Jbpbp.js"),__vite__mapDeps([0]),import.meta.url)]).then(()=>{},s=>{throw b=null,s}),b}const m={floor_inherit:{label:e("אזור בלי סימון בקומה של בניין ברור"),hint:e('למשל "חדר אשפה" בקומה "א · קרקע"'),options:{on:e("לפי הקומה"),off:e("לשאול")}},auto_insert:{label:e("שם חדש עם סימון מוכר, אחרי ההחלה"),hint:e('למשל "ב · חדר אופניים" שנוסף במערכת הבית'),options:{off:e('לחכות ל"אשר"'),on:e("להכניס לבד")}},new_token:{label:e("סימון שאין לו בניין - מה להציע ראשון"),hint:e('למשל "ה · קומה 1" כשאין בניין ה'),options:{new_first:e("בניין חדש"),existing_first:e("בניין קיים"),unassigned_first:e("לא משויך")}}},es={apply:e("החלה מהאשף"),confirm:e("אישור שמות חדשים"),auto:e("הוכנסו לבד"),restore:e("חזרה לגרסה")};let o=class extends S{constructor(){super(...arguments),this.compact=!1,this.data=null,this.error="",this.forbidden=!1,this.busy=!1,this.assistant=null,this.assistantReady=!1,this.confirmRestore=null,this.floorDialog=null,this.singleFloors=[],this.xs=null,this.message="",this.forceFull=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const a=(await D()).sites[0];if(!a){this.error=e("אין עדיין אתר. צרו אתר ובניין במפה ‹ אתרים.");return}this.data=await T(x()?a.id:"site1"),this.singleFloors=(a.buildings??[]).flatMap(t=>t.floors??[]),this.error=""}catch(s){s?.status===403?this.forbidden=!0:this.error=u(s)}}get single(){return!!this.data&&this.data.buildings.length<2&&!this.forceFull}async toggleMulti(){if(!(!this.data||this.busy)){this.busy=!0,this.message="";try{const s=await C(!this.data.multi_building);this.data={...this.data,multi_building:s.enabled},this.message=s.enabled?e("תצוגת ריבוי הבניינים פעילה במסך הראשי."):e("תצוגת ריבוי הבניינים כבויה: המסך הראשי מציג בניין אחד, כמו קודם. המיפוי נשמר.")}catch(s){this.error=u(s)}finally{this.busy=!1}}}async setSetting(s,a){if(this.data)try{const t=await F(this.data.site.id,{[s]:a});this.data={...this.data,settings:t.settings}}catch(t){this.error=u(t)}}async restore(s){if(this.data){this.busy=!0;try{const a=await N(this.data.site.id,s.number);this.confirmRestore=null,this.message=e("נוצרה גרסה {n} עם התוכן של גרסה {from}.",{n:a.version,from:s.number}),await this.load()}catch(a){this.error=u(a)}finally{this.busy=!1}}}bName(s){return!s||s.t==="none"?e("לא משויך"):s.t==="new"?s.name:this.data?.buildings.find(a=>a.id===s.id)?.name??""}computed(){const s=this.data,a=s.buildings.map(l=>({id:l.id,name:l.name,shared:l.is_shared})),t=f(s.mapItems,s.parsed,{buildings:a,settings:s.settings}),i=O(s.mapItems,s.parsed.spec),r=P(s.mapItems,t,a,A(i,s.parsed,a));return{res:t,sum:r,health:L(s.mapItems,t,s.seen,M(s.mapItems,t,a,s.ourFloors,s.links,s.parsed.levels))}}render(){if(this.forbidden)return n`<sw-card heading=${e("בניינים ומיפוי")}><div class="msg">${e("רק מי שמנהל את תוכן האתר יכול לראות ולשנות את המיפוי.")}</div></sw-card>`;if(!this.data)return this.error?n`<div class="err" role="alert">${this.error}</div>`:n`<div class="msg">${e("טוען…")}</div>`;const s=this.data,a=this.assistant&&this.assistantReady?n`<mapping-assistant .data=${s} start=${this.assistant.start} ?advancedOpen=${this.assistant.advanced}
          @close=${()=>{this.assistant=null,this.load()}} @applied=${()=>{}}></mapping-assistant>`:p;if(this.single)return n`${this.renderSwitch()}${this.renderSingle()}${a}${this.renderFloorDialog()}`;const t=this.computed();return this.compact?n`${this.renderSwitch()}<div class="head" style="margin-block-start:12px"><p>${s.versions.length?e("המיפוי הוחל (גרסה {n}).",{n:s.versions[0].number}):e("עדיין לא מופה: איזה שם במערכת הבית שייך לאיזה בניין אצלנו.")}</p>
        <sw-button variant="primary" icon="play" data-mapping-open @click=${()=>this.assistant={start:"mark",advanced:!1}}>${s.versions.length?e("פתח את האשף מחדש"):e("פתח את אשף המיפוי")}</sw-button></div>${a}`:n`
      <div class="head"><p>${e("איזה שם במערכת הבית שייך לאיזה בניין אצלנו. האשף קורא את כל השמות, מציע, ושואל רק על החריגים. שום דבר לא משתנה במערכת הבית עצמה.")}</p>
        <sw-button variant="primary" icon="play" data-mapping-open @click=${()=>this.assistant={start:"mark",advanced:!1}}>${s.versions.length?e("פתח את האשף מחדש"):e("פתח את אשף המיפוי")}</sw-button>
        <sw-button variant="ghost" icon="filter" data-mapping-advanced @click=${()=>this.assistant={start:"mark",advanced:!0}}>${e("מתקדם")}</sw-button></div>
      ${this.message?n`<div class="msg" role="status" style="margin-block-end:12px">${this.message}</div>`:p}
      ${this.error?n`<div class="err" role="alert" style="margin-block-end:12px">${this.error}</div>`:p}
      <div class="grid">
        <div class="col">${this.renderHealth(t.health)}${this.renderSwitch()}${this.renderBuildings(t.sum)}</div>
        <div class="col">${this.renderVersions()}${this.renderSettings()}</div>
      </div>
      ${a}${this.renderRestoreDialog()}`}renderSwitch(){const s=this.data,a=s.multi_building;return n`<sw-card data-mapping-switch><div class="sw">
      <div class="t"><b>${e("הפעל ריבוי בניינים")}</b>
        <span>${a?e('פעיל: המסך הראשי מציג את האתר לפי בניינים, עם מעבר בין בניינים ו"כבה הכל" לכל בניין.'):e("כבוי: המסך הראשי מציג בניין אחד, בדיוק כמו היום. אפשר להכין את המיפוי כבר עכשיו - שום דבר לא משתנה במסך הראשי עד שמפעילים.")}</span>
        ${s.can_toggle?p:n`<span class="muted">${e("רק מי שמנהל את התוכן של כל האתרים יכול להפעיל או לכבות.")}</span>`}
        <span class="state ${a?"on":""}" data-mapping-switch-state=${a?"on":"off"}>${a?e("פעיל"):e("כבוי")}</span></div>
      <button type="button" class="toggle" role="switch" aria-checked=${String(a)} aria-label=${e("ריבוי בניינים")} data-mapping-toggle ?disabled=${!s.can_toggle||this.busy} @click=${()=>void this.toggleMulti()}><i></i></button>
    </div></sw-card>`}renderHealth(s){return o.healthCard?o.healthCard(this,s):p}get mapping(){return this.data}reload(){return this.load()}showError(s){this.error=s}willUpdate(){!this.assistant||this.assistantReady||ts().then(()=>this.assistantReady=!0,s=>{this.assistant=null,this.error=u(s)})}openAssistant(s){this.assistant={start:s,advanced:!1}}renderBuildings(s){const a=this.data,t=a.versions.length>0;return n`<sw-card heading=${e("הבניינים")} subheading=${t?e("לפי המיפוי של גרסה {n}",{n:a.versions[0].number}):e("עדיין לא הוחל מיפוי - כך האשף היה קורא את השמות")} data-mapping-buildings>
      <div class="rows">
        ${s.buildings.filter(i=>i.target.t==="b").map(i=>{const r=i.target.t==="b"&&a.buildings.find(l=>l.id===i.target.id)?.is_shared;return n`<div class="row"><span class="g ${r?"sh":""}"><sw-icon name=${r?"sparkle":"building"} size=${16}></sw-icon></span>
            <span class="t"><b>${this.bName(i.target)}</b><span>${e("{n} קומות",{n:i.floors})} · ${e("{n} אזורים",{n:i.areas})}${i.tokens.length?` · ${i.tokens.map(l=>`"${l}"`).join(", ")}`:""}${i.manual?` · ${e("{n} החלטות ידניות",{n:i.manual})}`:""}</span></span></div>`})}
        <div class="row"><span class="g un">?</span><span class="t"><b>${e("לא משויך")}</b><span>${e("{n} קומות",{n:s.unassigned.floors})} · ${e("{n} אזורים",{n:s.unassigned.areas})}${s.open?` · ${e("{n} מחכים להחלטה",{n:s.open})}`:""}</span></span>
          ${s.open?n`<sw-button size="sm" data-mapping-decide @click=${()=>this.assistant={start:"decide",advanced:!1}}>${e("החלט עכשיו")}</sw-button>`:p}</div>
      </div></sw-card>`}renderVersions(){const s=this.data,a=t=>{const i=new Date(t);return Number.isNaN(i.getTime())?t:i.toLocaleString(G(),{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})};return n`<sw-card heading=${e("גרסאות")} subheading=${e("חזרה לגרסה ישנה יוצרת גרסה חדשה עם התוכן שלה. שום דבר לא נמחק.")} data-mapping-versions>
      ${s.versions.length?n`<div class="rows">${s.versions.slice(0,8).map(t=>n`<div class="row vr ${t.current?"cur":""}" data-mapping-version=${t.number}>
            <span class="k">${t.number}</span>
            <span class="t"><b>${e("גרסה {n}",{n:t.number})}${t.current?` · ${e("נוכחית")}`:""}</b><span>${a(t.created_at)}${t.by?` · ${t.by}`:""} · ${es[t.kind]}${t.restored_from?` ${t.restored_from}`:""}</span></span>
            ${t.current?n`<span class="pill">${e("פעילה")}</span>`:n`<sw-button size="sm" icon="history" data-mapping-restore=${t.number} @click=${()=>this.confirmRestore=t}>${e("חזרה לגרסה זו")}</sw-button>`}</div>`)}</div>`:n`<div class="msg">${e('אין עדיין גרסאות. כל "החל" באשף יוצר גרסה.')}</div>`}
    </sw-card>`}renderSettings(){const s=this.data,a=t=>n`<div class="set" data-mapping-setting=${t}>
      <span class="l">${m[t].label}</span><span class="h">${m[t].hint}</span>
      <span class="seg" role="group" aria-label=${m[t].label}>${X[t].map(i=>n`<button type="button" aria-pressed=${String(s.settings[t]===i)} data-mapping-option=${i}
        @click=${()=>void this.setSetting(t,i)}>${m[t].options[i]}</button>`)}</span></div>`;return n`<sw-card heading=${e("איך המיפוי מתנהג")} data-mapping-settings>${a("floor_inherit")}${a("auto_insert")}${a("new_token")}${this.renderReach()}</sw-card>`}renderReach(){const s=this.data,a=s.building_reach??"map_and_mapping",t=s.can_set_reach===!0&&!this.busy;return n`<div class="set" data-mapping-setting="building_reach">
      <span class="l">${e("הרשאת בניין לפי")}</span>
      <span class="h">${a==="map_and_mapping"?e("מי שקיבל הרשאה לבניין שולט בהתקנים שמוצבים במפות הקומות שלו, וגם בהתקנים שהאזור שלהם ממופה לבניין."):e("מי שקיבל הרשאה לבניין שולט בהתקנים שמוצבים במפות הקומות שלו בלבד.")} ${e("חל רק כשריבוי בניינים פעיל.")}${s.can_set_reach?"":` ${e("רק מנהל הרשאות יכול לשנות.")}`}</span>
      <span class="seg" role="group" aria-label=${e("הרשאת בניין לפי")}>${B.map(i=>n`<button type="button" aria-pressed=${String(a===i)} data-mapping-option=${i} ?disabled=${!t}
        @click=${()=>void this.setReach(i)}>${j[i]}</button>`)}</span></div>`}async setReach(s){if(!(!this.data||this.busy||this.data.building_reach===s)){this.busy=!0,this.message="";try{const a=await H(s);this.data={...this.data,building_reach:a.mode},this.message=e("הרשאת הבניין עודכנה.")}catch(a){this.error=u(a)}finally{this.busy=!1}}}renderRestoreDialog(){const s=this.confirmRestore;return s?n`<sw-dialog open heading=${e("חזרה לגרסה {n}",{n:s.number})} subheading=${e("המיפוי יחזור לשורות של הגרסה הזו")} @close=${()=>this.confirmRestore=null}>
      <div class="msg">${e("תיווצר גרסה חדשה עם התוכן של גרסה {n}. הגרסה הנוכחית נשמרת ואפשר לחזור אליה. בניינים וקומות שנוצרו לא יימחקו, ושום דבר לא משתנה במערכת הבית.",{n:s.number})}</div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.confirmRestore=null}>${e("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" icon="history" data-mapping-restore-confirm ?disabled=${this.busy} @click=${()=>void this.restore(s)}>${e("חזרה לגרסה {n}",{n:s.number})}</sw-button>
    </sw-dialog>`:p}renderSingle(){const s=this.data,a=s.buildings[0];return n`<sw-card heading=${a?a.name:e("בניין אחד")} subheading=${e("באתר יש בניין אחד: כל קומה מקושרת לקומה במערכת הבית בנפרד")} data-mapping-single style="margin-block-start:16px">
      <div class="rows">${this.singleFloors.map(t=>n`<div class="row"><span class="g"><sw-icon name="floor" size=${16}></sw-icon></span>
          <span class="t"><b>${t.name}</b><span>${s.links.floors.filter(i=>i.floor_id===t.id).length?e("מקושרת"):e("לפי המפלס או השם")}</span></span>
          <sw-button size="sm" icon="link" data-mapping-floor-link=${t.id} @click=${()=>void this.openFloor(t)}>${e("קישור למערכת הבית")}</sw-button></div>`)}</div>
      <div class="head" style="margin:14px 0 0"><p>${e("יש לכם כמה בניינים באותה מערכת בית? האשף יזהה אותם לפי השמות וייצור אותם.")}</p>
        <sw-button variant="ghost" icon="play" data-mapping-open @click=${()=>{this.forceFull=!0,this.assistant={start:"mark",advanced:!1}}}>${e("פתח את אשף המיפוי")}</sw-button></div>
    </sw-card>`}async openFloor(s){this.xs=await V(),this.floorDialog=s}renderFloorDialog(){const s=this.floorDialog;return s?n`<sw-floor-home-link .floor=${s} .floors=${this.singleFloors} .floorNames=${new Map(this.singleFloors.map(a=>[a.id,a.name]))} .tree=${this.xs?.tree??null} .links=${this.xs?.links??null}
      singleBuilding ?demo=${!x()} @close=${()=>this.floorDialog=null}
      @saved=${a=>{this.floorDialog=null,this.xs&&(this.xs={...this.xs,links:a.detail.links}),this.load()}}></sw-floor-home-link>`:p}};o.styles=R`
    :host {
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
      gap: var(--sw-gap-lg, 16px);
      align-items: start;
    }
    .col {
      display: grid;
      gap: var(--sw-gap-lg, 16px);
      min-inline-size: 0;
    }
    .head {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      margin-block-end: var(--sw-gap-lg, 16px);
    }
    .head p {
      margin: 0;
      flex: 1 1 320px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      max-inline-size: 75ch;
    }
    .sw {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .sw .t {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: grid;
      gap: 4px;
    }
    .sw .t b {
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
    }
    .sw .t span {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .toggle {
      flex: none;
      inline-size: 52px;
      block-size: 30px;
      border-radius: var(--sw-r-pill);
      border: 0;
      padding: 3px;
      background: var(--sw-border-strong, var(--sw-border));
      cursor: pointer;
      display: flex;
      transition: background-color 160ms ease;
    }
    .toggle i {
      inline-size: 24px;
      block-size: 24px;
      border-radius: 50%;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      transition: transform 200ms var(--sw-ease-out, ease-out);
    }
    .toggle[aria-checked='true'] {
      background: var(--sw-product-toggle-on, var(--sw-accent));
    }
    .toggle[aria-checked='true'] i {
      transform: translateX(-22px);
    }
    .toggle:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: not-allowed;
    }
    .state {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-xs);
      padding: 2px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      inline-size: fit-content;
    }
    .state.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .rows {
      display: grid;
      gap: 6px;
    }
    .row {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
    }
    .row .g {
      flex: none;
      inline-size: 32px;
      block-size: 32px;
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      color: var(--sw-heading);
    }
    .row .g.sh {
      background: var(--sw-shared-soft);
      color: var(--sw-shared-text);
    }
    .row .g.un {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-weight: var(--sw-fw-bold);
    }
    .row .t {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .row .t b {
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .t span {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    .vr.cur {
      background: var(--sw-accent-soft);
    }
    .k {
      flex: none;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      font-size: var(--sw-fs-xs);
    }
    .pill {
      flex: none;
      font-size: var(--sw-fs-xs);
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .set {
      display: grid;
      gap: 6px;
      padding-block: 8px;
      border-block-end: 1px solid var(--sw-border);
    }
    .set:last-child {
      border-block-end: 0;
    }
    .set .l {
      font-size: var(--sw-fs-sm);
      color: var(--sw-heading);
      font-weight: var(--sw-fw-medium);
    }
    .set .h {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .seg {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 2px;
      padding: 2px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      inline-size: fit-content;
      max-inline-size: 100%;
    }
    .seg button {
      font: inherit;
      font-size: var(--sw-fs-sm);
      border: 0;
      background: none;
      color: var(--sw-text-2);
      padding: 6px 12px;
      min-block-size: 34px;
      border-radius: calc(var(--sw-r-md) - 2px);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-heading));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
      font-weight: var(--sw-fw-semibold);
    }
    .seg button:disabled {
      cursor: not-allowed;
    }
    .msg {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .err {
      color: var(--sw-danger-text, var(--sw-danger));
      font-size: var(--sw-fs-sm);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .health {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-warning-soft);
      color: var(--sw-text);
    }
    .health.ok {
      background: var(--sw-accent-soft);
    }
    .health > sw-icon {
      color: var(--sw-warning-text);
      flex: none;
    }
    .health.ok > sw-icon {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .health .t {
      flex: 1 1 280px;
      min-inline-size: 0;
      display: grid;
      gap: 2px;
      font-size: var(--sw-fs-sm);
    }
    .health .t b {
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
    }
    .health .t span {
      color: var(--sw-text-2);
      overflow-wrap: anywhere;
    }
    @media (max-width: 1100px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;o.healthCard=null;c([I({type:Boolean})],o.prototype,"compact",2);c([g()],o.prototype,"data",2);c([g()],o.prototype,"error",2);c([g()],o.prototype,"forbidden",2);c([g()],o.prototype,"busy",2);c([g()],o.prototype,"assistant",2);c([g()],o.prototype,"assistantReady",2);c([g()],o.prototype,"confirmRestore",2);c([g()],o.prototype,"floorDialog",2);c([g()],o.prototype,"singleFloors",2);c([g()],o.prototype,"xs",2);c([g()],o.prototype,"message",2);c([g()],o.prototype,"forceFull",2);o=c([U("system-mapping")],o);const w=s=>s.buildings.map(a=>({id:a.id,name:a.name,shared:a.is_shared}));async function z(s,a,t){const i=f(s.mapItems,s.parsed,{buildings:w(s),settings:s.settings}),r=new Set(a.map(_)),l=Q(Y(s.mapItems,i,w(s),s.ourFloors,s.links,s.parsed.levels),r);return(await Z(s.site.id,{state:s.parsed,revision:s.revision,plan:{...l,items:[...r]},kind:t,summary:{confirmed:r.size}})).version}function is(s,a){const i=f(s.mapItems,s.parsed,{buildings:w(s),settings:s.settings}).get(_(a))?.to;return!i||i.t==="none"?"":i.t==="new"?i.name:s.buildings.find(r=>r.id===i.id)?.name??""}function ns(s){const a=w(s),t=f(s.mapItems,s.parsed,{buildings:a,settings:s.settings});return q(s.mapItems,t,s.parsed,a,s.haLabels)}function y(s){return n`<span data-mapping-label-coverage>${K(ns(s))}</span>`}let $=!1;async function rs(s){const a=s.mapping;if(x()||!a||$||a.settings.auto_insert!=="on"||!a.seen)return;const t=J(a);if(t.ready.length){$=!0;try{await z(a,t.ready,"auto"),await s.reload()}catch{$=!1}}}function os(s){const a=W(s);return a?n`<div class="health ok" role="status" data-mapping-auto-notice><sw-icon name="sparkle" size=${22}></sw-icon><div class="t"><b>${a}</b><span>${d("לפי הסימונים והכללים השמורים, בגרסה {number}. אפשר לחזור לגרסה קודמת בכל רגע.",{number:s.versions[0].number})}</span></div></div>`:p}function ls(s,a){const t=s.mapping;return t?t.seen?n`${os(t)}${ds(s,t,a)}`:n`<div class="health ok" data-mapping-health="labels"><sw-icon name="info" size=${22}></sw-icon><div class="t"><b>${d("תוויות ממערכת הבית")}</b>${y(t)}</div></div>`:p}function ds(s,a,t){if(!t.fresh.length)return n`<div class="health ok" data-mapping-health="ok"><sw-icon name="check" size=${22}></sw-icon><div class="t"><b>${d("המיפוי מעודכן")}</b><span>${d("כל השמות במערכת הבית מוכרים מאז ההחלה האחרונה.")}</span>${y(a)}</div></div>`;a.settings.auto_insert==="on"&&t.ready.length&&rs(s);const i=t.ready.slice(0,2).map(h=>d('"{name}" ← {where}',{name:h.name,where:is(a,h)})).join(", "),r=t.open.slice(0,2).map(h=>`"${h.name}"`).join(", "),l=t.fresh.length;return n`<div class="health" data-mapping-health="fresh"><sw-icon name="warning" size=${22}></sw-icon>
    <div class="t"><b data-mapping-health-count>${l===1?d("{n} שם חדש במערכת הבית",{n:l}):d("{n} שמות חדשים במערכת הבית",{n:l})}</b>
      <span>${t.ready.length?`${d("לפי הסימון: {sample}",{sample:i})}${t.ready.length>2?d(" ועוד {n}",{n:t.ready.length-2}):""}. `:""}${t.open.length?`${r}${t.open.length>2?d(" ועוד {n}",{n:t.open.length-2}):""}${d(" - צריך החלטה.")}`:""}</span>${y(a)}</div>
    ${t.ready.length?n`<sw-button size="sm" variant="primary" icon="check" data-mapping-confirm @click=${async h=>{const k=h.currentTarget;k.disabled=!0;try{await z(a,t.ready,"confirm"),await s.reload()}catch(E){k.disabled=!1,cs(s,E)}}}>${d("אשר {length}",{length:t.ready.length})}</sw-button>`:p}
    ${t.open.length?n`<sw-button size="sm" data-mapping-health-decide @click=${()=>s.openAssistant("decide")}>${t.open.length===1?d('החלט על "{name}"',{name:t.open[0].name}):d("החלט על {length}",{length:t.open.length})}</sw-button>`:p}
  </div>`}function cs(s,a){s.showError(u(a))}o.healthCard=ls;
