import{br as T,bs as m,bt as E,bu as q,a as _,aX as D,p as A,q as f,e as C,cX as L,A as p,b as n,ei as O,b4 as F,j as I,z as M,k as c,m as N}from"./index-CoJbESCx.js";import"./sw-table-DhR8Spy7.js";import"./sw-chip-C7It7kNL.js";import{s as P,i as H,l as V,f as K}from"./events-C74h9cko.js";import{d as u}from"./recordings-8b8Csc_3.js";import{b as R}from"./bubble-chrome-Da7T662v.js";import{I as Z}from"./investigate-r5-css-DHv046wq.js";import"./sw-logo-art-PLtEZJxU.js";const v={title:"אירועי חיישנים",subtitle:"דלתות, תנועה ומנעולים מהחיישנים · לקריאה בלבד · אזור זמן {tz}",readOnly:"לקריאה בלבד",search:"חיפוש חופשי (שם חיישן, פרטי אירוע)",searchLabel:"חיפוש חופשי",type:"סוג",typeAll:"כל סוגי האירועים",typeDoor:"דלת / מנעול",typeMotion:"תנועה",typeOther:"אחר (אזעקה)",area:"אזור",areaAll:"כל האזורים",areaFloor:"{floor}",areaZone:"{floor} › {zone}",rangeLabel:"טווח ימים",range1:"יום",range7:"7 ימים",range30:"30 יום",dateLabel:"תאריך",colEvent:"אירוע",colSensor:"חיישן",colArea:"אזור",colTime:"זמן",colSeverity:"חומרה",sevInfo:"מידע",sevAlert:"התראה",sevCritical:"קריטי",summary:"{n} אירועים · {a} התראות · {s} חיישנים",live:"עדכונים חיים: פעיל",liveConnecting:"עדכונים חיים: מתחבר…",noArea:"לא ממוקם בתוכנית",opened:"נפתח",closed:"נסגר",locked:"ננעל",unlocked:"המנעול נפתח",motionStart:"זוהתה תנועה",motionEnd:"התנועה הסתיימה",unavailable:"החיישן אינו זמין",restored:"החיישן חזר לפעול",alarmChanged:"מצב האזעקה: {to}",stateChange:"מצב: {from} ← {to}",repeats:"{n} חזרות",drawerSensor:"חיישן",drawerEvent:"אירוע",drawerArea:"אזור",drawerTime:"זמן",drawerFrom:"מצב קודם",drawerTo:"מצב חדש",drawerCertainty:"ודאות",drawerMeasured:"נמדד על ידי החיישן",drawerSource:"מקור",drawerSourceValue:"חיישן התקן (מעבר מצב)",drawerNoClip:"אין הקלטה או תמונה לאירוע: ההתקנה פועלת בלי מצלמות מקושרות.",close:"סגור",emptyTitle:"אין אירועי חיישנים בטווח הזה",emptyHint:"אירוע נרשם כשדלת, חיישן תנועה או מנעול משנים מצב.",emptyFiltered:"אין אירועים שמתאימים למסננים",emptyFilteredHint:"שנו את הטווח, את האזור או את הסוג.",clearFilters:"נקה מסננים",loadError:"לא ניתן לטעון את האירועים",retry:"נסה שוב",unsupported:'המסנן אינו נתמך כאן, לא "אין תוצאות": {why}',truncated:"מוצגים {n} האירועים האחרונים; צמצמו את הטווח כדי לראות את השאר.",stateOn:"פעיל",stateOff:"כבוי"},$=m("en","i18n/ha-events","en"),x=m("ar","i18n/ha-events","ar"),k=m("ru","i18n/ha-events","ru");function j(){return E(["en","ar","ru"])}const B={he:v,en:$,ar:x,ru:k},U=["ar","ru"];function a(e,t,i=j()){const s=B[i][e]??v[e]??e;return T(s,t)}q("i18n/ha-events",{he:v,en:$,ar:x,ru:k},U);const X=[{value:"door",label:"typeDoor"},{value:"motion",label:"typeMotion"},{value:"other",label:"typeOther"}],g=new Set(["on","open","opening","unlocked","unlocking","triggered","detected"]),b=new Set(["off","closed","closing","locked","locking","clear","disarmed"]);function w(e,t){const i=e.details??{},s=String(i.to??"").toLowerCase(),r=String(i.from??""),h=String(i.domain??""),o=(S,z)=>a(S,z,t);if(i.availability==="lost")return o("unavailable");if(i.availability==="restored")return o("restored");if(e.type==="door"){if(h==="lock")return s==="locked"?o("locked"):s==="unlocked"?o("unlocked"):o("stateChange",{from:r,to:String(i.to??"")});if(g.has(s))return o("opened");if(b.has(s))return o("closed")}if(e.type==="motion"){if(g.has(s))return o("motionStart");if(b.has(s))return o("motionEnd")}return e.type==="other"&&h==="alarm_control_panel"?o("alarmChanged",{to:String(i.to??"")}):o("stateChange",{from:r,to:String(i.to??"")})}function G(e){if(!e)return[];const t=[];for(const i of e.places)for(const s of i.buildings)for(const r of s.floors){const h=`${s.name} · ${r.name}`;t.push({value:`floor:${r.id}`,label:a("areaFloor",{floor:h})});for(const o of r.zones)t.push({value:`zone:${o.id}`,label:a("areaZone",{floor:h,zone:o.name})})}return t}function y(e){return e?e.zone?`${e.zone} · ${e.floor_name}`:e.floor_name:""}var J=Object.defineProperty,Y=Object.getOwnPropertyDescriptor,d=(e,t,i,s)=>{for(var r=s>1?void 0:s?Y(t,i):t,h=e.length-1,o;h>=0;h--)(o=e[h])&&(r=(s?o(t,i,r):o(r))||r);return s&&r&&J(t,i,r),r};let l=class extends _{constructor(){super(...arguments),this.bubbleSkin=new D(this),this.date="",this.events=null,this.selected=null,this.error="",this.tz="Asia/Jerusalem",this.type="",this.area="",this.q="",this.rangeDays=1,this.facets=null,this.unsupported=[],this.live=!1,this.narrow=typeof window<"u"&&window.matchMedia("(max-width: 767px)").matches,this.qTimer=0,this.pushTimer=0,this.reqSeq=0,this.onMedia=()=>{this.narrow=!!this.mq?.matches},this.onKey=e=>{if(this.narrow||!this.selected||e.altKey||e.ctrlKey||e.metaKey||e.defaultPrevented||e.composedPath().some(r=>r instanceof HTMLElement&&(r.tagName==="INPUT"||r.tagName==="SELECT"||r.tagName==="TEXTAREA"||r.isContentEditable)))return;if(e.key==="Escape"){e.preventDefault(),this.selected=null;return}if(e.key!=="ArrowDown"&&e.key!=="ArrowUp")return;const i=(this.events??[]).map(r=>r.id),s=i[i.indexOf(this.selected)+(e.key==="ArrowDown"?1:-1)];!s||i.indexOf(this.selected)<0||(e.preventDefault(),this.selected=s,this.updateComplete.then(()=>{const r=this.renderRoot.querySelector("sw-table")?.shadowRoot?.querySelector(`tr[data-row-id="${CSS.escape(s)}"]`);r&&(r.style.scrollMarginBlock="48px 12px",r.scrollIntoView({block:"nearest"}))}))}}connectedCallback(){super.connectedCallback(),this.mq=window.matchMedia("(max-width: 767px)"),this.mq.addEventListener("change",this.onMedia),this.narrow=this.mq.matches,window.addEventListener("keydown",this.onKey),this.init(),this.unsubscribe=P(e=>this.onPushed(e),(e,t)=>{this.live=t})}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMedia),window.removeEventListener("keydown",this.onKey),this.unsubscribe?.(),window.clearTimeout(this.qTimer),window.clearTimeout(this.pushTimer)}async init(){try{const e=await A();this.tz=e["time.zone"]??"Asia/Jerusalem",this.date||(this.date=u(new Date,this.tz)),this.loadFacets(),await this.load()}catch(e){this.error=f(e)}}async loadFacets(){try{this.facets=await H()}catch{this.facets=null}}window(){if(this.rangeDays<=1)return{date:this.date||void 0};const e=new Date(`${this.date||u(new Date,this.tz)}T23:59:59.999Z`),t=new Date(e.getTime()-(this.rangeDays-1)*864e5);return t.setUTCHours(0,0,0,0),{from:t.toISOString(),to:e.toISOString()}}async load(){const e=++this.reqSeq,[t,i]=this.area.split(":");try{const s=await V({...this.window(),source:"ha",type:this.type||void 0,query:this.q.trim()||void 0,limit:500,floorId:t==="floor"?i:void 0,zoneId:t==="zone"?i:void 0});if(e!==this.reqSeq)return;this.events=s.events,this.unsupported=s.filters?.unsupported??[],this.error=""}catch(s){if(e!==this.reqSeq)return;this.error=f(s)}}onPushed(e){e.source!=="ha"||!this.events||(window.clearTimeout(this.pushTimer),this.pushTimer=window.setTimeout(()=>void this.load(),800))}onSearchInput(e){this.q=e,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>void this.load(),350)}get filtered(){return!!(this.type||this.area||this.q.trim())}clearFilters(){this.type="",this.area="",this.q="",this.load()}fmt(e){return C(new Date(e),{timeZone:this.tz,seconds:!0})}fmtDate(e){return L(new Date(e),{timeZone:this.tz})}sev(e){return a(e==="critical"?"sevCritical":e==="alert"?"sevAlert":"sevInfo")}columns(){return[{key:"type",label:a("colEvent"),render:e=>{const t=e;return n`<span class="ty" style="--tone:${K[t.type]??"var(--sw-tl-offline)"}"><i></i>${w(t)}</span>${t.count>1?n`<div class="sub">${a("repeats",{n:t.count})}</div>`:p}`}},{key:"camera_name",label:a("colSensor"),render:e=>n`${String(e.camera_name??"—")}`},{key:"place",label:a("colArea"),render:e=>{const t=y(e.place);return t?n`${t}`:n`<span class="sub">${a("noArea")}</span>`}},{key:"occurred_at",label:a("colTime"),render:e=>n`<span class="ltr" style="font-weight:700;font-size:var(--sw-fs-md);font-variant-numeric:tabular-nums;color:var(--sw-heading)">${this.fmt(String(e.occurred_at))}</span><div class="sub ltr">${this.fmtDate(String(e.occurred_at))}</div>`},{key:"severity",label:a("colSeverity"),render:e=>n`<sw-badge ?filled=${e.severity!=="info"} kind=${e.severity==="critical"?"error":e.severity==="alert"?"stale":"neutral"} label=${this.sev(String(e.severity))}></sw-badge>`}]}renderFilters(){const e=G(this.facets);return n`
      <div class="filters" data-ha-filters>
        <sw-field><input type="search" data-ha-q placeholder=${a("search")} aria-label=${a("searchLabel")} .value=${this.q} @input=${t=>this.onSearchInput(t.target.value)} /></sw-field>
        <sw-field><select aria-label=${a("type")} data-ha-type @change=${t=>{this.type=t.target.value,this.load()}}>
          <option value="" ?selected=${!this.type}>${a("typeAll")}</option>
          ${X.map(t=>n`<option value=${t.value} ?selected=${this.type===t.value}>${a(t.label)}</option>`)}
        </select></sw-field>
        <sw-field><select aria-label=${a("area")} data-ha-area @change=${t=>{this.area=t.target.value,this.load()}}>
          <option value="" ?selected=${!this.area}>${a("areaAll")}</option>
          ${e.map(t=>n`<option value=${t.value} ?selected=${this.area===t.value}>${t.label}</option>`)}
        </select></sw-field>
        <sw-field><input type="date" lang=${O()} .value=${this.date} max=${u(new Date,this.tz)} data-ltr data-ha-date aria-label=${a("dateLabel")} @change=${t=>{this.date=t.target.value,this.load()}} /></sw-field>
        <span class="rangepick" role="group" aria-label=${a("rangeLabel")} data-ha-range>
          ${[[1,"range1"],[7,"range7"],[30,"range30"]].map(([t,i])=>n`<button class=${this.rangeDays===t?"on":""} aria-pressed=${this.rangeDays===t} data-ha-range-set=${t} @click=${()=>{this.rangeDays=t,this.load()}}>${a(i)}</button>`)}
        </span>
      </div>`}renderBody(){if(this.error&&!this.events)return n`<sw-state-panel state="error" heading=${a("loadError")} hint=${this.error} actionLabel=${a("retry")} @action=${()=>void this.init()}></sw-state-panel>`;if(!this.events)return n`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.events,t=e.filter(r=>r.severity!=="info").length,i=new Set(e.map(r=>String(r.details.entity_id??r.camera_name??r.id))).size,s=e.find(r=>r.id===this.selected)??null;return n`
      <div class="banner" data-ha-status>
        <span class="dot ${this.live?"on":""}"></span>
        <span data-ha-summary>${a("summary",{n:e.length,a:t,s:i})}</span>
        <span>· ${this.live?a("live"):a("liveConnecting")}</span>
        <span class="ro" data-ha-readonly><sw-icon name="eye" size=${14}></sw-icon>${a("readOnly")}</span>
      </div>
      ${this.unsupported.length?n`<div class="banner warn" data-ha-unsupported>${a("unsupported",{why:this.unsupported.map(r=>r.reason).join(" · ")})}</div>`:p}
      ${this.error?n`<div class="banner warn">${this.error}</div>`:p}
      ${e.length>=500?n`<div class="banner" data-ha-truncated>${a("truncated",{n:e.length})}</div>`:p}
      <div class="stage">
        ${e.length?n`<sw-table data-ha-table .columns=${this.columns()} .rows=${e} .selected=${this.selected} @row-select=${r=>this.selected=r.detail.id}></sw-table>`:this.filtered?n`<sw-state-panel icon="filter" state="empty" data-ha-empty="filtered" heading=${a("emptyFiltered")} hint=${a("emptyFilteredHint")}><div style="margin-block-start:10px"><sw-button size="sm" data-ha-clear @click=${()=>this.clearFilters()}>${a("clearFilters")}</sw-button></div></sw-state-panel>`:n`<sw-state-panel icon="sensor" state="empty" data-ha-empty="none" heading=${a("emptyTitle")} hint=${a("emptyHint")}></sw-state-panel>`}
        ${s?this.renderDrawer(s):p}
      </div>`}renderDrawer(e){const t=e.details;return n`<sw-drawer open ?modal=${this.narrow} heading=${w(e)} subheading=${`${e.camera_name??""} · ${this.fmt(e.occurred_at)}`} data-ha-drawer @close=${()=>this.selected=null}>
      <dl class="r5-facts">
        <div class="wide"><dt>${a("drawerEvent")}</dt><dd>${w(e)}${e.count>1?` · ${a("repeats",{n:e.count})}`:""}</dd></div>
        <div><dt>${a("drawerSensor")}</dt><dd>${e.camera_name??"—"}</dd></div>
        <div><dt>${a("drawerArea")}</dt><dd>${y(e.place)||a("noArea")}</dd></div>
        <div><dt>${a("drawerTime")}</dt><dd><span class="ltr">${this.fmtDate(e.occurred_at)} ${this.fmt(e.occurred_at)}</span></dd></div>
        <div><dt>${a("colSeverity")}</dt><dd>${this.sev(e.severity)}</dd></div>
        ${t.from!=null&&t.from!==""?n`<div><dt>${a("drawerFrom")}</dt><dd class="ltr">${String(t.from)}</dd></div>`:p}
        ${t.to!=null&&t.to!==""?n`<div><dt>${a("drawerTo")}</dt><dd class="ltr">${String(t.to)}</dd></div>`:p}
        <div><dt>${a("drawerCertainty")}</dt><dd>${a("drawerMeasured")}</dd></div>
        <div><dt>${a("drawerSource")}</dt><dd>${a("drawerSourceValue")}</dd></div>
      </dl>
      <div class="noclip" data-ha-noclip><sw-icon name="info" size=${14}></sw-icon><span>${a("drawerNoClip")}</span></div>
      <div slot="footer"><sw-button variant="ghost" size="sm" @click=${()=>this.selected=null}>${a("close")}</sw-button></div>
    </sw-drawer>`}render(){return n`
      <sw-page heading=${a("title")} subheading=${a("subtitle",{tz:this.tz})}>
        ${this.renderFilters()}
        ${this.renderBody()}
      </sw-page>
    `}};l.styles=[I`
    /* EVENTS-POLISH-2331 (the event centre's fix, same pattern): from a tablet up the screen takes the height the shell leaves it, the list
       scrolls inside its own box with a sticky header and the drawer is as tall as that box, so its footer stays in view; a phone keeps the
       page scroll and gets a full-screen modal sheet. */
    :host { display: flex; flex-direction: column; min-block-size: 0; min-inline-size: 0; }
    sw-page { flex: 1; min-block-size: 0; }
    @media (min-width: 768px) {
      sw-page { block-size: 100%; padding-block-end: 16px; }
      .stage { flex: 1; min-block-size: 240px; display: flex; flex-direction: column; }
      .stage > sw-table { flex: 0 1 auto; min-block-size: 0; }
    }
    sw-drawer[data-ha-drawer] { --sw-drawer-sheet-h: 100dvh; --sw-drawer-sheet-max-h: 100dvh; }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .filters sw-field { inline-size: 160px; }
    .filters sw-field:has(input[type='search']) { inline-size: 240px; }
    .filters .grow { flex: 1; }
    .rangepick { display: inline-flex; gap: 2px; background: var(--sw-surface-3); border-radius: var(--sw-r-sm); padding: 2px; }
    .rangepick button { font: inherit; font-size: var(--sw-fs-xs); border: 0; background: transparent; color: var(--sw-text-2); border-radius: var(--sw-r-xs); padding: 4px 8px; cursor: pointer; min-block-size: 28px; }
    .rangepick button.on { background: var(--sw-seg-key, var(--sw-surface)); color: var(--sw-seg-key-ink, var(--sw-accent-text)); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    /* R5-INVESTIGATE-297: the status line reads as a stat strip (the count a display numeral), the rows at 13 px */
    .banner[data-ha-status] { font-size: var(--sw-fs-sm); padding: 8px 14px; background: var(--sw-surface); box-shadow: var(--sw-shadow-1); }
    .banner[data-ha-status] [data-ha-summary] { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    .banner { font-size: var(--sw-fs-xs); padding: 6px 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); border: 1px solid var(--sw-border); color: var(--sw-text-2); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; line-height: 1.5; margin-block: 8px; }
    .banner.warn { background: var(--sw-warning-soft); border-color: color-mix(in srgb, var(--sw-warning) 40%, transparent); color: var(--sw-warning-text); }
    .dot { inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--sw-offline); display: inline-block; box-shadow: 0 0 0 2px var(--sw-offline-soft); flex: none; }
    .dot.on { background: var(--sw-online, var(--sw-accent)); box-shadow: 0 0 0 2px var(--sw-accent-soft); }
    .ro { display: inline-flex; gap: 6px; align-items: center; margin-inline-start: auto; color: var(--sw-text-3); }
    .stage { position: relative; min-block-size: 280px; margin-block-start: 8px; }
    .ty { display: inline-flex; align-items: center; gap: 7px; font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-md); color: var(--sw-heading); }
    .ty i { inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--tone); box-shadow: 0 0 0 2px color-mix(in srgb, var(--tone) 22%, transparent); flex: none; }
    .sub { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; font-size: var(--sw-fs-sm); }
    dt { color: var(--sw-text-3); }
    dd { margin: 0; }
    .noclip { margin-block-start: 12px; padding: 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-text-2); font-size: var(--sw-fs-xs); display: flex; gap: 8px; align-items: flex-start; }
    ${F}
    @media (max-width: 767px) {
      .filters sw-field, .filters sw-field:has(input[type='search']) { inline-size: 100%; }
      .ro { margin-inline-start: 0; }
    }
  `,R,Z];d([M()],l.prototype,"date",2);d([c()],l.prototype,"events",2);d([c()],l.prototype,"selected",2);d([c()],l.prototype,"error",2);d([c()],l.prototype,"tz",2);d([c()],l.prototype,"type",2);d([c()],l.prototype,"area",2);d([c()],l.prototype,"q",2);d([c()],l.prototype,"rangeDays",2);d([c()],l.prototype,"facets",2);d([c()],l.prototype,"unsupported",2);d([c()],l.prototype,"live",2);d([c()],l.prototype,"narrow",2);l=d([N("investigate-ha-events")],l);export{l as InvestigateHaEvents};
