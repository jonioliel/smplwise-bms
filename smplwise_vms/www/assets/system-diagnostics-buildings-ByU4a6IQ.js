const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as k}from"./sw-logo-art-PLtEZJxU.js";import{j as D,z as O,k as c,a as P,q as u,j_ as T,c as L,u as N,aE as f,dL as t,A as d,b as r,m as j,a3 as H,BY as V,af as R,BZ as G,B_ as q,jS as _,jQ as U,jU as X,jR as K,B$ as W,C0 as Y,fj as Z,C1 as Q,C2 as J,C3 as ss,am as es,C4 as I,C5 as ts,C6 as as,C7 as is,C8 as ns,g_ as M,C9 as rs,jY as os,jZ as ls}from"./index-CVsAtsN7.js";import{l as ds,d as S,o as cs,n as ps,R as hs,F as gs,s as us,e as ms}from"./mb-safety-BoyAL8MS.js";import{l as ws}from"./live-BzyW7Ndf.js";import{t as g}from"./media-z6U6q6he.js";var vs=Object.defineProperty,fs=Object.getOwnPropertyDescriptor,v=(s,e,a,n)=>{for(var i=n>1?void 0:n?fs(e,a):e,o=s.length-1,p;o>=0;o--)(p=s[o])&&(i=(n?p(e,a,i):p(i))||i);return n&&i&&vs(e,a,i),i};const m=(s,e)=>typeof s[e]=="string"?s[e]:"",b=(s,e)=>typeof s[e]=="number"?s[e]:0,x=(s,e=4)=>{const a=Array.isArray(s)?s.filter(n=>typeof n=="string"):[];return a.length>e?`${a.slice(0,e).join(", ")} ${t("ועוד {n}",{n:a.length-e})}`:a.join(", ")};let w=class extends P{constructor(){super(...arguments),this.open=!1,this.report=null,this.ack=!1,this.busy=!1,this.error=""}willUpdate(s){s.has("open")&&this.open&&(this.report=null,this.ack=!1,this.error="",this.load())}async load(){try{this.report=await ds()}catch(s){this.error=u(s)}}async enable(){const s=this.report;if(!(!s||!S(s,this.ack).canEnable||this.busy)){this.busy=!0,this.error="";try{const e=await T(!0,s.digest);this.dispatchEvent(new CustomEvent("enabled",{detail:e}))}catch(e){e instanceof L&&(e.code==="check_stale"||e.code==="check_blocked")&&(this.ack=!1,await this.load()),this.error=u(e)}finally{this.busy=!1}}}close(){this.dispatchEvent(new CustomEvent("close"))}when(s){const e=new Date(s);return Number.isNaN(e.getTime())?s:e.toLocaleString(N(),{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}words(s){const e=s.items,a=f(s.count),n=i=>s.count>i.length&&i.length>=4?[...i.slice(0,4),t("ועוד {n}",{n:f(s.count-4)})]:i.slice(0,4);switch(s.code){case"entity_cross_building":return{title:t("{n} התקנים מוצבים במפה של בניין אחד, אבל האזור שלהם ממופה לבניין אחר",{n:a}),lines:n(e.map(i=>t("{name}: במפה של {placed}, ממופה ל{building} (אזור {area})",{name:m(i,"name"),placed:m(i,"placed_in"),building:m(i,"building"),area:m(i,"area")})))};case"reach_gain":return{title:t("{n} התקנים יתווספו למי שיש לו הרשאה לבניין",{n:a}),lines:e.map(i=>`${t("{building}: {devices} התקנים",{building:m(i,"name"),devices:f(b(i,"devices"))})}${b(i,"sensitive")?` · ${t("{n} רגישים ({names})",{n:f(b(i,"sensitive")),names:x(i.sensitive_names,2)})}`:""} · ${b(i,"holders")?t("בעלי הרשאה: {names}",{names:x(i.holder_names)}):t("אין בעלי הרשאה לבניין")}`).slice(0,6)};case"single_building":return{title:t("באתר יש בניין אחד. המסך הראשי לא ישתנה, אבל המיפוי ייכנס להרשאות לפי בניין."),lines:[]};case"mapping_empty":return{title:t("שום אזור עוד לא ממופה לבניין, ולכן ההפעלה לא תשנה כלום."),lines:[]};case"unmapped_areas":return{title:t("{n} אזורים עם התקנים לא שייכים לאף בניין",{n:a}),lines:[x(e.map(i=>m(i,"name")),8)]};case"versions_since":return{title:t("{n} גרסאות מיפוי הוחלו מאז ההפעלה האחרונה",{n:a}),lines:n(e.map(i=>t("גרסה {number} · {when} · {by}",{number:f(b(i,"number")),when:this.when(m(i,"created_at")),by:m(i,"by")})))};case"stale_rows":return{title:t("{n} שורות מיפוי מצביעות על קומה או בניין שנמחקו. הן לא נחשבות.",{n:a}),lines:[]};default:return{title:s.code,lines:[]}}}renderFinding(s){const e=this.words(s),a=s.severity==="blocking"?"warning":s.severity==="warning"?"info":"check",n=s.severity==="blocking"?t("חוסם"):s.severity==="warning"?t("לבדיקה"):t("לידיעה");return r`<div class="f ${s.severity}" data-mb-finding=${s.code} data-severity=${s.severity}>
      <sw-icon name=${a} size=${16}></sw-icon>
      <span><b>${e.title}</b><span class="sev">${n}</span></span>
      ${e.lines.length?r`<ul>${e.lines.map(i=>r`<li>${i}</li>`)}</ul>`:d}
    </div>`}render(){if(!this.open)return d;const s=this.report,e=S(s,this.ack);return r`<sw-dialog open wide heading=${t("בדיקה לפני הפעלת ריבוי בניינים")} subheading=${t("מה ישתנה בהרשאות ובמסך הראשי כשמפעילים")} data-mb-check @close=${a=>{a.stopPropagation(),this.close()}}>
      ${s?r`<p class="lead">${s.reach_mode==="map_and_mapping"?t("אחרי ההפעלה, מי שיש לו הרשאה לבניין יגיע גם להתקנים שהאזור שלהם ממופה לבניין. עברו על הממצאים לפני שמפעילים."):t("ההרשאה לבניין היא לפי מיקום במפה בלבד, ולכן המיפוי לא מוסיף הרשאות. עברו על הממצאים לפני שמפעילים.")}</p>
          <div class="list" data-mb-findings>
            ${s.findings.length?cs(s).map(a=>this.renderFinding(a)):r`<div class="ok" data-mb-clean>${t("לא נמצא שום דבר שדורש בדיקה.")}</div>`}
          </div>
          ${e.blocked?r`<div class="err" role="alert" data-mb-blocked>${t("יש ממצא חוסם. תקנו אותו במפה או במיפוי, ואז בדקו שוב. מנהל הרשאות יכול גם להגדיר לדלג על הבדיקה.")}</div>`:r`<sw-toggle class="ack" data-mb-ack .checked=${this.ack} label=${t("עברתי על הממצאים")} @change=${a=>{a.stopPropagation(),this.ack=a.detail.checked}}></sw-toggle>`}`:this.error?d:r`<div class="msg">${t("בודק…")}</div>`}
      ${this.error?r`<div class="err" role="alert">${this.error}</div>`:d}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.close()}>${t("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" icon="building" data-mb-enable ?disabled=${!e.canEnable||this.busy} @click=${()=>void this.enable()}>${t("הפעל ריבוי בניינים")}</sw-button>
    </sw-dialog>`}};w.styles=D`
    .lead {
      margin: 0 0 var(--sw-s-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .list {
      display: grid;
      gap: var(--sw-s-2);
    }
    .f {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--sw-s-1) var(--sw-s-3);
      align-items: start;
      padding: var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .f.blocking {
      background: var(--sw-danger-soft);
    }
    .f.warning {
      background: var(--sw-warning-soft);
    }
    .f > sw-icon {
      margin-block-start: calc(var(--sw-s-1) / 2);
      color: var(--sw-text-2);
    }
    .f.blocking > sw-icon {
      color: var(--sw-danger-text, var(--sw-danger));
    }
    .f.warning > sw-icon {
      color: var(--sw-warning-text);
    }
    .f b {
      color: var(--sw-heading);
    }
    .f .sev {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      margin-inline-start: var(--sw-s-1h);
      color: var(--sw-text-2);
    }
    .f.blocking .sev {
      color: var(--sw-danger-text, var(--sw-danger));
    }
    .f ul {
      grid-column: 2;
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: calc(var(--sw-s-1) / 2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .ok {
      padding: var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      font-size: var(--sw-fs-sm);
    }
    .ack {
      display: block;
      margin-block-start: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .msg {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger-text, var(--sw-danger));
      font-size: var(--sw-fs-sm);
      margin-block-start: var(--sw-s-2);
    }
  `;v([O({type:Boolean})],w.prototype,"open",2);v([c()],w.prototype,"report",2);v([c()],w.prototype,"ack",2);v([c()],w.prototype,"busy",2);v([c()],w.prototype,"error",2);w=v([j("mb-enable-check")],w);var bs=Object.defineProperty,$s=Object.getOwnPropertyDescriptor,h=(s,e,a,n)=>{for(var i=n>1?void 0:n?$s(e,a):e,o=s.length-1,p;o>=0;o--)(p=s[o])&&(i=(n?p(e,a,i):p(i))||i);return n&&i&&bs(e,a,i),i};let z=null;function ys(){return z??=Promise.all([k(()=>import("./mapping-assistant-QSAzx6vN.js"),__vite__mapDeps([0]),import.meta.url),k(()=>import("./mapping-decide-BeeAdqgJ.js"),__vite__mapDeps([0]),import.meta.url),k(()=>import("./mapping-rules-Bdw7e2kk.js"),__vite__mapDeps([0]),import.meta.url)]).then(()=>{},s=>{throw z=null,s}),z}const $={floor_inherit:{label:t("אזור בלי סימון בקומה של בניין ברור"),hint:t('למשל "חדר אשפה" בקומה "א · קרקע"'),options:{on:t("לפי הקומה"),off:t("לשאול")}},auto_insert:{label:t("שם חדש עם סימון מוכר, אחרי ההחלה"),hint:t('למשל "ב · חדר אופניים" שנוסף במערכת הבית'),options:{off:t('לחכות ל"אשר"'),on:t("להכניס לבד")}},new_token:{label:t("סימון שאין לו בניין - מה להציע ראשון"),hint:t('למשל "ה · קומה 1" כשאין בניין ה'),options:{new_first:t("בניין חדש"),existing_first:t("בניין קיים"),unassigned_first:t("לא משויך")}}},_s={apply:t("החלה מהאשף"),confirm:t("אישור שמות חדשים"),auto:t("הוכנסו לבד"),restore:t("חזרה לגרסה")};let l=class extends P{constructor(){super(...arguments),this.compact=!1,this.data=null,this.error="",this.forbidden=!1,this.busy=!1,this.assistant=null,this.assistantReady=!1,this.confirmRestore=null,this.floorDialog=null,this.singleFloors=[],this.xs=null,this.message="",this.forceFull=!1,this.checkOpen=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=(await H()).sites[0];if(!e){this.error=t("אין עדיין אתר. צרו אתר ובניין במפה ‹ אתרים.");return}this.data=await V(R()?e.id:"site1"),this.singleFloors=(e.buildings??[]).flatMap(a=>a.floors??[]),this.error=""}catch(s){s?.status===403?this.forbidden=!0:this.error=u(s)}}get single(){return!!this.data&&this.data.buildings.length<2&&!this.forceFull}async toggleMulti(){if(!(!this.data||this.busy)){if(!this.data.multi_building&&ps(this.data.review_mode)){this.message="",this.checkOpen=!0;return}this.busy=!0,this.message="";try{const s=await T(!this.data.multi_building);this.data={...this.data,multi_building:s.enabled},this.message=s.enabled?t("תצוגת ריבוי הבניינים פעילה במסך הראשי."):t("תצוגת ריבוי הבניינים כבויה: המסך הראשי מציג בניין אחד, כמו קודם. המיפוי נשמר.")}catch(s){this.error=u(s)}finally{this.busy=!1}}}async setSetting(s,e){if(this.data)try{const a=await G(this.data.site.id,{[s]:e});this.data={...this.data,settings:a.settings}}catch(a){this.error=u(a)}}async restore(s){if(this.data){this.busy=!0;try{const e=await q(this.data.site.id,s.number);this.confirmRestore=null,this.message=t("נוצרה גרסה {n} עם התוכן של גרסה {from}.",{n:e.version,from:s.number}),await this.load()}catch(e){this.error=u(e)}finally{this.busy=!1}}}bName(s){return!s||s.t==="none"?t("לא משויך"):s.t==="new"?s.name:this.data?.buildings.find(e=>e.id===s.id)?.name??""}computed(){const s=this.data,e=s.buildings.map(o=>({id:o.id,name:o.name,shared:o.is_shared})),a=_(s.mapItems,s.parsed,{buildings:e,settings:s.settings}),n=U(s.mapItems,s.parsed.spec),i=X(s.mapItems,a,e,K(n,s.parsed,e));return{res:a,sum:i,health:W(s.mapItems,a,s.seen,Y(s.mapItems,a,e,s.ourFloors,s.links,s.parsed.levels))}}render(){if(this.forbidden)return r`<sw-card heading=${t("בניינים ומיפוי")}><div class="msg">${t("רק מי שמנהל את תוכן האתר יכול לראות ולשנות את המיפוי.")}</div></sw-card>`;if(!this.data)return this.error?r`<div class="err" role="alert">${this.error}</div>`:r`<div class="msg">${t("טוען…")}</div>`;const s=this.data,e=this.assistant&&this.assistantReady?r`<mapping-assistant .data=${s} start=${this.assistant.start} ?advancedOpen=${this.assistant.advanced}
          @close=${()=>{this.assistant=null,this.load()}} @applied=${()=>{}}></mapping-assistant>`:d;if(this.single)return r`${this.renderSwitch()}${this.renderSingle()}${e}${this.renderFloorDialog()}${this.renderCheck()}`;const a=this.computed();return this.compact?r`${this.renderSwitch()}<div class="head" style="margin-block-start:12px"><p>${s.versions.length?t("המיפוי הוחל (גרסה {n}).",{n:s.versions[0].number}):t("עדיין לא מופה: איזה שם במערכת הבית שייך לאיזה בניין אצלנו.")}</p>
        <sw-button variant="primary" icon="play" data-mapping-open @click=${()=>this.assistant={start:"mark",advanced:!1}}>${s.versions.length?t("פתח את האשף מחדש"):t("פתח את אשף המיפוי")}</sw-button></div>${e}${this.renderCheck()}`:r`
      <div class="head"><p>${t("איזה שם במערכת הבית שייך לאיזה בניין אצלנו. האשף קורא את כל השמות, מציע, ושואל רק על החריגים. שום דבר לא משתנה במערכת הבית עצמה.")}</p>
        <sw-button variant="primary" icon="play" data-mapping-open @click=${()=>this.assistant={start:"mark",advanced:!1}}>${s.versions.length?t("פתח את האשף מחדש"):t("פתח את אשף המיפוי")}</sw-button>
        <sw-button variant="ghost" icon="filter" data-mapping-advanced @click=${()=>this.assistant={start:"mark",advanced:!0}}>${t("מתקדם")}</sw-button></div>
      ${this.message?r`<div class="msg" role="status" style="margin-block-end:12px">${this.message}</div>`:d}
      ${this.error?r`<div class="err" role="alert" style="margin-block-end:12px">${this.error}</div>`:d}
      <div class="grid">
        <div class="col">${this.renderHealth(a.health)}${this.renderSwitch()}${this.renderBuildings(a.sum)}</div>
        <div class="col">${this.renderVersions()}${this.renderSettings()}</div>
      </div>
      ${e}${this.renderRestoreDialog()}${this.renderCheck()}`}renderCheck(){return this.checkOpen?r`<mb-enable-check open @close=${()=>this.checkOpen=!1}
      @enabled=${()=>{this.checkOpen=!1,this.data&&(this.data={...this.data,multi_building:!0}),this.message=t("תצוגת ריבוי הבניינים פעילה במסך הראשי.")}}></mb-enable-check>`:d}renderSwitch(){const s=this.data,e=s.multi_building;return r`<sw-card data-mapping-switch><div class="sw">
      <div class="t"><b>${t("הפעל ריבוי בניינים")}</b>
        <span>${e?t('פעיל: המסך הראשי מציג את האתר לפי בניינים, עם מעבר בין בניינים ו"כבה הכל" לכל בניין.'):t("כבוי: המסך הראשי מציג בניין אחד, בדיוק כמו היום. אפשר להכין את המיפוי כבר עכשיו - שום דבר לא משתנה במסך הראשי עד שמפעילים.")}</span>
        ${s.can_toggle?d:r`<span class="muted">${t("רק מי שמנהל את התוכן של כל האתרים יכול להפעיל או לכבות.")}</span>`}
        <span class="state ${e?"on":""}" data-mapping-switch-state=${e?"on":"off"}>${e?t("פעיל"):t("כבוי")}</span></div>
      <sw-toggle .checked=${ws(e)} label=${t("ריבוי בניינים")} labelHidden data-mapping-toggle ?disabled=${!s.can_toggle||this.busy} @change=${Z(e,()=>void this.toggleMulti())}></sw-toggle>
    </div></sw-card>`}renderHealth(s){return l.healthCard?l.healthCard(this,s):d}get mapping(){return this.data}reload(){return this.load()}showError(s){this.error=s}willUpdate(){!this.assistant||this.assistantReady||ys().then(()=>this.assistantReady=!0,s=>{this.assistant=null,this.error=u(s)})}openAssistant(s){this.assistant={start:s,advanced:!1}}renderBuildings(s){const e=this.data,a=e.versions.length>0;return r`<sw-card heading=${t("הבניינים")} subheading=${a?t("לפי המיפוי של גרסה {n}",{n:e.versions[0].number}):t("עדיין לא הוחל מיפוי - כך האשף היה קורא את השמות")} data-mapping-buildings>
      <div class="rows">
        ${s.buildings.filter(n=>n.target.t==="b").map(n=>{const i=n.target.t==="b"&&e.buildings.find(o=>o.id===n.target.id)?.is_shared;return r`<div class="row"><span class="g ${i?"sh":""}"><sw-icon name=${i?"sparkle":"building"} size=${16}></sw-icon></span>
            <span class="t"><b>${this.bName(n.target)}</b><span>${t("{n} קומות",{n:n.floors})} · ${t("{n} אזורים",{n:n.areas})}${n.tokens.length?` · ${n.tokens.map(o=>`"${o}"`).join(", ")}`:""}${n.manual?` · ${t("{n} החלטות ידניות",{n:n.manual})}`:""}</span></span></div>`})}
        <div class="row"><span class="g un">?</span><span class="t"><b>${t("לא משויך")}</b><span>${t("{n} קומות",{n:s.unassigned.floors})} · ${t("{n} אזורים",{n:s.unassigned.areas})}${s.open?` · ${t("{n} מחכים להחלטה",{n:s.open})}`:""}</span></span>
          ${s.open?r`<sw-button size="sm" data-mapping-decide @click=${()=>this.assistant={start:"decide",advanced:!1}}>${t("החלט עכשיו")}</sw-button>`:d}</div>
      </div></sw-card>`}renderVersions(){const s=this.data,e=a=>{const n=new Date(a);return Number.isNaN(n.getTime())?a:n.toLocaleString(N(),{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})};return r`<sw-card heading=${t("גרסאות")} subheading=${t("חזרה לגרסה ישנה יוצרת גרסה חדשה עם התוכן שלה. שום דבר לא נמחק.")} data-mapping-versions>
      ${s.versions.length?r`<div class="rows">${s.versions.slice(0,8).map(a=>r`<div class="row vr ${a.current?"cur":""}" data-mapping-version=${a.number}>
            <span class="k">${a.number}</span>
            <span class="t"><b>${t("גרסה {n}",{n:a.number})}${a.current?` · ${t("נוכחית")}`:""}</b><span>${e(a.created_at)}${a.by?` · ${a.by}`:""} · ${_s[a.kind]}${a.restored_from?` ${a.restored_from}`:""}</span></span>
            ${a.current?r`<span class="pill">${t("פעילה")}</span>`:r`<sw-button size="sm" icon="history" data-mapping-restore=${a.number} @click=${()=>this.confirmRestore=a}>${t("חזרה לגרסה זו")}</sw-button>`}</div>`)}</div>`:r`<div class="msg">${t('אין עדיין גרסאות. כל "החל" באשף יוצר גרסה.')}</div>`}
    </sw-card>`}renderSettings(){const s=this.data,e=a=>r`<div class="set" data-mapping-setting=${a}>
      <span class="l">${$[a].label}</span><span class="h">${$[a].hint}</span>
      <sw-segmented label=${$[a].label} value=${String(s.settings[a])}
        @change=${n=>{const i=I[a].find(o=>String(o)===n.detail.value);i!==void 0&&this.setSetting(a,i)}}
        .options=${I[a].map(n=>({value:String(n),label:$[a].options[n],attrs:{"data-mapping-option":String(n)}}))}></sw-segmented></div>`;return r`<sw-card heading=${t("איך המיפוי מתנהג")} data-mapping-settings>${e("floor_inherit")}${e("auto_insert")}${e("new_token")}${this.renderReach()}${this.renderReview()}${this.renderFilter()}</sw-card>`}renderReach(){const s=this.data,e=s.building_reach??"map_and_mapping",a=s.can_set_reach===!0&&!this.busy;return r`<div class="set" data-mapping-setting="building_reach">
      <span class="l">${t("הרשאת בניין לפי")}</span>
      <span class="h">${e==="map_and_mapping"?t("מי שקיבל הרשאה לבניין שולט בהתקנים שמוצבים במפות הקומות שלו, וגם בהתקנים שהאזור שלהם ממופה לבניין."):t("מי שקיבל הרשאה לבניין שולט בהתקנים שמוצבים במפות הקומות שלו בלבד.")} ${t("חל רק כשריבוי בניינים פעיל.")}${s.can_set_reach?"":` ${t("רק מנהל הרשאות יכול לשנות.")}`}</span>
      <sw-segmented label=${t("הרשאת בניין לפי")} value=${e} ?disabled=${!a} @change=${n=>void this.setReach(n.detail.value)}
        .options=${Q.map(n=>({value:n,label:J[n],attrs:{"data-mapping-option":n}}))}></sw-segmented></div>`}renderReview(){const s=this.data,e=s.review_mode??"required",a=s.can_set_review===!0&&!this.busy,n={required:t("חובה"),skip:t("לדלג")};return r`<div class="set" data-mapping-setting="review">
      <span class="l">${t("בדיקה לפני הפעלת ריבוי בניינים")}</span>
      <span class="h">${e==="required"?t("לפני ההפעלה מוצגת בדיקה של המיפוי ושל ההרשאות שישתנו, ורק אחריה אפשר להפעיל."):t("ההפעלה מיידית, בלי בדיקה. תוצאות הבדיקה נרשמות ביומן הפעולות.")}${s.can_set_review?"":` ${t("רק מנהל הרשאות יכול לשנות.")}`}</span>
      <sw-segmented label=${t("בדיקה לפני הפעלת ריבוי בניינים")} value=${e} ?disabled=${!a} @change=${i=>void this.setReviewMode(i.detail.value)}
        .options=${hs.map(i=>({value:i,label:n[i],attrs:{"data-mapping-option":i}}))}></sw-segmented></div>`}renderFilter(){const s=this.data,e=s.filter_mode??"on",a=(s.can_set_filter??s.can_toggle)===!0&&!this.busy,n={on:t("מוצג"),off:t("מוסתר")};return r`<div class="set" data-mapping-setting="filter">
      <span class="l">${t("סינון לפי בניין ברשימות")}</span>
      <span class="h">${e==="on"?t("כשריבוי בניינים פועל, מוני החשמל, התזמונים, החדרים המשותפים, חיפוש ההתקנים בעורך התוכנית, החיפוש הכללי, ובממשק הביתי גם לוח ההודעות והחדרים המשותפים, מציעים בחירת בניין. רק תצוגה: זה לא משנה מי רואה מה."):t("הרשימות מוצגות לכל האתר, בלי בחירת בניין.")}</span>
      <sw-segmented label=${t("סינון לפי בניין ברשימות")} value=${e} ?disabled=${!a} @change=${i=>void this.setFilter(i.detail.value)}
        .options=${gs.map(i=>({value:i,label:n[i],attrs:{"data-mapping-option":i}}))}></sw-segmented></div>`}async setFilter(s){if(!(!this.data||this.busy||(this.data.filter_mode??"on")===s)){this.busy=!0,this.message="";try{const e=await us(s);this.data={...this.data,filter_mode:e.mode},this.message=t("הגדרת הסינון לפי בניין עודכנה.")}catch(e){this.error=u(e)}finally{this.busy=!1}}}async setReviewMode(s){if(!(!this.data||this.busy||(this.data.review_mode??"required")===s)){this.busy=!0,this.message="";try{const e=await ms(s);this.data={...this.data,review_mode:e.mode},this.message=t("ההגדרה של הבדיקה לפני ההפעלה עודכנה.")}catch(e){this.error=u(e)}finally{this.busy=!1}}}async setReach(s){if(!(!this.data||this.busy||this.data.building_reach===s)){this.busy=!0,this.message="";try{const e=await ss(s);this.data={...this.data,building_reach:e.mode},this.message=t("הרשאת הבניין עודכנה.")}catch(e){this.error=u(e)}finally{this.busy=!1}}}renderRestoreDialog(){const s=this.confirmRestore;return s?r`<sw-dialog open heading=${t("חזרה לגרסה {n}",{n:s.number})} subheading=${t("המיפוי יחזור לשורות של הגרסה הזו")} @close=${()=>this.confirmRestore=null}>
      <div class="msg">${t("תיווצר גרסה חדשה עם התוכן של גרסה {n}. הגרסה הנוכחית נשמרת ואפשר לחזור אליה. בניינים וקומות שנוצרו לא יימחקו, ושום דבר לא משתנה במערכת הבית.",{n:s.number})}</div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.confirmRestore=null}>${t("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" icon="history" data-mapping-restore-confirm ?disabled=${this.busy} @click=${()=>void this.restore(s)}>${t("חזרה לגרסה {n}",{n:s.number})}</sw-button>
    </sw-dialog>`:d}renderSingle(){const s=this.data,e=s.buildings[0];return r`<sw-card heading=${e?e.name:t("בניין אחד")} subheading=${t("באתר יש בניין אחד: כל קומה מקושרת לקומה במערכת הבית בנפרד")} data-mapping-single style="margin-block-start:16px">
      <div class="rows">${this.singleFloors.map(a=>r`<div class="row"><span class="g"><sw-icon name="floor" size=${16}></sw-icon></span>
          <span class="t"><b>${a.name}</b><span>${s.links.floors.filter(n=>n.floor_id===a.id).length?t("מקושרת"):t("לפי המפלס או השם")}</span></span>
          <sw-button size="sm" icon="link" data-mapping-floor-link=${a.id} @click=${()=>void this.openFloor(a)}>${t("קישור למערכת הבית")}</sw-button></div>`)}</div>
      <div class="head" style="margin:14px 0 0"><p>${t("יש לכם כמה בניינים באותה מערכת בית? האשף יזהה אותם לפי השמות וייצור אותם.")}</p>
        <sw-button variant="ghost" icon="play" data-mapping-open @click=${()=>{this.forceFull=!0,this.assistant={start:"mark",advanced:!1}}}>${t("פתח את אשף המיפוי")}</sw-button></div>
    </sw-card>`}async openFloor(s){this.xs=await es(),this.floorDialog=s}renderFloorDialog(){const s=this.floorDialog;return s?r`<sw-floor-home-link .floor=${s} .floors=${this.singleFloors} .floorNames=${new Map(this.singleFloors.map(e=>[e.id,e.name]))} .tree=${this.xs?.tree??null} .links=${this.xs?.links??null}
      singleBuilding ?demo=${!R()} @close=${()=>this.floorDialog=null}
      @saved=${e=>{this.floorDialog=null,this.xs&&(this.xs={...this.xs,links:e.detail.links}),this.load()}}></sw-floor-home-link>`:d}};l.styles=D`
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
  `;l.healthCard=null;h([O({type:Boolean})],l.prototype,"compact",2);h([c()],l.prototype,"data",2);h([c()],l.prototype,"error",2);h([c()],l.prototype,"forbidden",2);h([c()],l.prototype,"busy",2);h([c()],l.prototype,"assistant",2);h([c()],l.prototype,"assistantReady",2);h([c()],l.prototype,"confirmRestore",2);h([c()],l.prototype,"floorDialog",2);h([c()],l.prototype,"singleFloors",2);h([c()],l.prototype,"xs",2);h([c()],l.prototype,"message",2);h([c()],l.prototype,"forceFull",2);h([c()],l.prototype,"checkOpen",2);l=h([j("system-mapping")],l);const y=s=>s.buildings.map(e=>({id:e.id,name:e.name,shared:e.is_shared}));async function A(s,e,a){const n=_(s.mapItems,s.parsed,{buildings:y(s),settings:s.settings}),i=new Set(e.map(M)),o=rs(os(s.mapItems,n,y(s),s.ourFloors,s.links,s.parsed.levels),i);return(await ls(s.site.id,{state:s.parsed,revision:s.revision,plan:{...o,items:[...i]},kind:a,summary:{confirmed:i.size}})).version}function ks(s,e){const n=_(s.mapItems,s.parsed,{buildings:y(s),settings:s.settings}).get(M(e))?.to;return!n||n.t==="none"?"":n.t==="new"?n.name:s.buildings.find(i=>i.id===n.id)?.name??""}function xs(s){const e=y(s),a=_(s.mapItems,s.parsed,{buildings:e,settings:s.settings});return is(s.mapItems,a,s.parsed,e,s.haLabels)}function E(s){return r`<span data-mapping-label-coverage>${ts(xs(s))}</span>`}let C=!1;async function zs(s){const e=s.mapping;if(R()||!e||C||e.settings.auto_insert!=="on"||!e.seen)return;const a=ns(e);if(a.ready.length){C=!0;try{await A(e,a.ready,"auto"),await s.reload()}catch{C=!1}}}function Cs(s){const e=as(s);return e?r`<div class="health ok" role="status" data-mapping-auto-notice><sw-icon name="sparkle" size=${22}></sw-icon><div class="t"><b>${e}</b><span>${g("לפי הסימונים והכללים השמורים, בגרסה {number}. אפשר לחזור לגרסה קודמת בכל רגע.",{number:s.versions[0].number})}</span></div></div>`:d}function Rs(s,e){const a=s.mapping;return a?a.seen?r`${Cs(a)}${Es(s,a,e)}`:r`<div class="health ok" data-mapping-health="labels"><sw-icon name="info" size=${22}></sw-icon><div class="t"><b>${g("תוויות ממערכת הבית")}</b>${E(a)}</div></div>`:d}function Es(s,e,a){if(!a.fresh.length)return r`<div class="health ok" data-mapping-health="ok"><sw-icon name="check" size=${22}></sw-icon><div class="t"><b>${g("המיפוי מעודכן")}</b><span>${g("כל השמות במערכת הבית מוכרים מאז ההחלה האחרונה.")}</span>${E(e)}</div></div>`;e.settings.auto_insert==="on"&&a.ready.length&&zs(s);const n=a.ready.slice(0,2).map(p=>g('"{name}" ← {where}',{name:p.name,where:ks(e,p)})).join(", "),i=a.open.slice(0,2).map(p=>`"${p.name}"`).join(", "),o=a.fresh.length;return r`<div class="health" data-mapping-health="fresh"><sw-icon name="warning" size=${22}></sw-icon>
    <div class="t"><b data-mapping-health-count>${o===1?g("{n} שם חדש במערכת הבית",{n:o}):g("{n} שמות חדשים במערכת הבית",{n:o})}</b>
      <span>${a.ready.length?`${g("לפי הסימון: {sample}",{sample:n})}${a.ready.length>2?g(" ועוד {n}",{n:a.ready.length-2}):""}. `:""}${a.open.length?`${i}${a.open.length>2?g(" ועוד {n}",{n:a.open.length-2}):""}${g(" - צריך החלטה.")}`:""}</span>${E(e)}</div>
    ${a.ready.length?r`<sw-button size="sm" variant="primary" icon="check" data-mapping-confirm @click=${async p=>{const F=p.currentTarget;F.disabled=!0;try{await A(e,a.ready,"confirm"),await s.reload()}catch(B){F.disabled=!1,Fs(s,B)}}}>${g("אשר {length}",{length:a.ready.length})}</sw-button>`:d}
    ${a.open.length?r`<sw-button size="sm" data-mapping-health-decide @click=${()=>s.openAssistant("decide")}>${a.open.length===1?g('החלט על "{name}"',{name:a.open[0].name}):g("החלט על {length}",{length:a.open.length})}</sw-button>`:d}
  </div>`}function Fs(s,e){s.showError(u(e))}l.healthCard=Rs;
