import{e as r,w as C,E as H,F as m,G as c,a as Y,j as E,A as l,H as q,R as ie,i as $,b$ as ne,aj as ae,cr as oe,bO as G}from"./index-D2ApsviK.js";import"./sw-table-D2eCp8aj.js";import{g as re,f as le,e as de,a as ce,b as he,c as pe,d as N}from"./access-events-DM3kanNQ.js";import{h as W,d as I,l as S,a as ee,b as _,c as x,s as D,e as ue,f as we,g as fe,E as Z,i as ge,w as V,r as me,j as b,k as ve,m as L,p as ye,R as be,A as xe,D as $e,n as K,o as ke,q as _e,t as ze,u as R}from"./events-logic-CB6NBjhX.js";import{o as Te,a as Ce,U as j,t as U}from"./wiskey-format-B1C9aa4N.js";import{a as M}from"./access-CdCLPs_-.js";import{p as Se,a as De}from"./events-print-BofHdYv3.js";import"./sw-logo-art-Va6y_cIM.js";const te={title:"פעילות",updatedAt:"עודכן {t}",staleAt:"הנתונים אינם עדכניים · עודכן {t}",staleNever:"הנתונים אינם עדכניים",pending:"יש אירועים חדשים",refresh:"רענון",searchLabel:"חיפוש אדם",searchPlaceholder:"חיפוש",viewGroup:"תצוגה",viewList:"רשימה",viewTable:"טבלה",print:"הדפסה",export:"ייצוא",filters:"מסננים",clear:"ניקוי מסננים",range:"תקופה",rangeAll:"כל התקופה",rangeToday:"היום",rangeYesterday:"אתמול",rangeWeek:"7 ימים אחרונים",rangeCustom:"טווח מותאם…",rangeCustomShown:"טווח מותאם",station:"תחנה",stationAll:"כל התחנות",result:"תוצאה",resultAll:"כל התוצאות",method:"אמצעי",methodAll:"כל האמצעים",door:"דלת",doorAll:"כל הדלתות",doorN:"דלת {n}",granted:"אושר",denied:"נדחה",unknown:"לא ידוע",card:"כרטיס",pin:"קוד",dayToday:"היום",dayYesterday:"אתמול",dayUnknown:"ללא תאריך",unidentified:"לא זוהה",ring:"שיחה מהעמדה",removedStation:"תחנה שהוסרה",more:"טען עוד",loadingMore:"טוען…",colTime:"זמן",colResult:"תוצאה",colPerson:"אדם",colStation:"תחנה",colDoor:"דלת",colMethod:"אמצעי",type_access_granted:"אושר",type_access_denied:"נדחה",type_attempt_limit:"חריגת ניסיונות",type_unlock_record:"פתיחה",type_door_unlocked:"המנעול שוחרר",type_door_locked:"המנעול נעול",type_contact_open:"המגע פתוח",type_contact_closed:"המגע סגור",type_unlock_exception:"תקלה בפתיחה",type_door_not_opened:"הדלת לא נפתחה",type_door_not_closed:"הדלת לא נסגרה",type_ring:"שיחה",type_unknown:"לא ידוע",long_access_granted:"אימות אושר",long_access_denied:"אימות נדחה",long_attempt_limit:"הגעה למגבלת ניסיונות קוד",long_unlock_record:"דיווח פתיחה מהמכשיר",long_door_unlocked:"המכשיר מדווח שהמנעול שוחרר",long_door_locked:"המכשיר מדווח שהמנעול נעול",long_contact_open:"המגע מדווח פתוח",long_contact_closed:"המגע מדווח סגור",long_unlock_exception:"תקלה בפתיחה",long_door_not_opened:"התראת דלת שלא נפתחה",long_door_not_closed:"התראת דלת שלא נסגרה",long_ring:"צלצול בפעמון",long_unknown:"לא ידוע",noPermission:"המסך הזה אינו זמין לך",empty:"אין פעילות בטווח הזה",emptyAll:"אין פעילות להצגה",emptyMore:"לא נמצאו אירועים בקטע שנסרק",stateNotConfigured:"בקרת הכניסה אינה מחוברת בסביבה הזו",stateConnecting:"מתחבר לבקרת הכניסה…",stateUnavailable:"אין חיבור לבקרת הכניסה",stateUnavailableHint:"החיבור מתחדש אוטומטית",stateNotInstalled:"בקרת הכניסה אינה מותקנת",stateRefused:"בקרת הכניסה דחתה את הגישה",stateError:"לא ניתן לטעון את הפעילות",stateErrorHint:"הבקשה לא הושלמה. אפשר לנסות שוב",stateRate:"בקרת הכניסה עמוסה כרגע",stateRateHint:"נסו שוב בעוד כמה שניות",stateUnsupported:"הגרסה המותקנת אינה תומכת ביומן הפעילות",retry:"נסה שוב",toSettings:"להגדרות בקרת כניסה",cursorExpired:"הרשימה התעדכנה. יש לטעון מההתחלה",reloadFromStart:"טען מההתחלה",historyGap:"ייתכן שחסרות רשומות מהתחנה {name}",storageFailed:"הרשומות החדשות נשמרות בזיכרון בלבד",crTitle:"טווח מותאם",crFrom:"מתאריך",crUntil:"עד תאריך",crZone:"לפי אזור הזמן {zone}",crApply:"החל",crCancel:"ביטול",dEvent:"אירוע",dTime:"זמן",dStation:"תחנה",dDoor:"דלת",dMethod:"אמצעי",dType:"סוג אירוע",dTimeSource:"מקור הזמן",dReceived:"התקבל",tsDevice:"העמדה",tsReceived:"קבלה במערכת",dPerson:"אדם",dName:"שם",dEmployee:"מספר עובד",dPicture:"תמונה מהאירוע",dPictureAlt:"תמונה מהאירוע",dPictureLoading:"טוען תמונה…",dPictureFail:"לא ניתן לטעון את התמונה",dPictureGone:"התמונה אינה זמינה",dRecordKind:"סוג רשומה",dIdentity:"זיהוי",dOrigin:"מקור הרשומה",dDelay:"איחור בהגעה",dDelaySeconds:"{n} שניות",dRecovered:"רשומה היסטורית",dDetailFail:"פרטי האירוע אינם זמינים כרגע",identity_identified:"זוהה לפי מספר עובד ושם",identity_id_only:"זוהה לפי מספר עובד בלבד",identity_identity_unavailable:"אין זהות זמינה",origin_history_query:"שחזור היסטוריה",origin_call_poll:"בדיקת שיחה",origin_device_time_missing:"אין זמן במכשיר",origin_device_time_ahead:"שעון המכשיר מקדים",origin_delayed_stream:"הגיע באיחור",origin_device_not_current:"המכשיר אינו מעודכן",origin_live_stream:"בזמן אמת",close:"סגור",exTitle:"ייצוא פעילות",exBody:"קובץ CSV לפי המסננים הנוכחיים · ללא תמונות",exLogged:"הייצוא נרשם ביומן הפעולות.",exGo:"ייצוא",exCancel:"ביטול",exBusy:"מייצא…",exClose:"סגור",exDone:"הקובץ הורד · {n} שורות",exDoneNoCount:"הקובץ הורד",exAgain:"ייצוא נוסף",exStation:"תחנה לייצוא",exStationNeeded:"יש לבחור תחנה לייצוא",exStationPick:"בחרו תחנה",exUnsupported:"הגרסה המותקנת אינה תומכת בייצוא",exUnavailable:"בקרת הכניסה אינה זמינה כרגע. נסו שוב בעוד רגע",exForbidden:"אין הרשאה לייצא מהתחנה הזו",exInvalid:"המסננים אינם תקינים",exOther:"הייצוא נכשל",prTitle:"פעילות",prPeriod:"תקופה: {range}",prStation:"תחנה: {name}",prFooter:"הודפס {t} · {n} שורות",prUnavailable:"אי אפשר להדפיס מהדפדפן הזה",prNothing:"אין שורות להדפסה"},Ae={title:"Activity",updatedAt:"Updated {t}",staleAt:"The data is not current · updated {t}",staleNever:"The data is not current",pending:"There are new events",refresh:"Refresh",searchLabel:"Search a person",searchPlaceholder:"Search",viewGroup:"View",viewList:"List",viewTable:"Table",print:"Print",export:"Export",filters:"Filters",clear:"Clear filters",range:"Period",rangeAll:"All time",rangeToday:"Today",rangeYesterday:"Yesterday",rangeWeek:"Last 7 days",rangeCustom:"Custom range…",rangeCustomShown:"Custom range",station:"Station",stationAll:"All stations",result:"Result",resultAll:"All results",method:"Method",methodAll:"All methods",door:"Door",doorAll:"All doors",doorN:"Door {n}",granted:"Granted",denied:"Denied",unknown:"Unknown",card:"Card",pin:"Code",dayToday:"Today",dayYesterday:"Yesterday",dayUnknown:"No date",unidentified:"Not identified",ring:"Call from the station",removedStation:"Removed station",more:"Load more",loadingMore:"Loading…",colTime:"Time",colResult:"Result",colPerson:"Person",colStation:"Station",colDoor:"Door",colMethod:"Method",noPermission:"This screen is not available to you",empty:"No activity in this period",emptyAll:"No activity to show",retry:"Try again",exTitle:"Export activity",exBody:"A CSV file with the current filters · no pictures",exLogged:"The export is recorded in the action log.",exGo:"Export",exCancel:"Cancel",exBusy:"Exporting…",exClose:"Close",exDone:"The file was downloaded · {n} rows",close:"Close",dEvent:"Event",dTime:"Time",dStation:"Station",dDoor:"Door",dMethod:"Method",dPerson:"Person",dPicture:"Event picture"};function se(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function t(e,s){const i=(se()==="en"?Ae[e]:void 0)??te[e];return s?i.replace(/\{(\w+)\}/g,(n,a)=>a in s?String(s[a]):n):i}function z(e,s,i="unknown"){const n=`${e}${s??""}`;return n in te?t(n):t(i)}const Ee={print:C`<path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/>`,table:C`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M3 15h18M9 5v14"/>`,card:C`<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10.5h18M7 15h3"/>`,window:C`<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>`};function B(e,s=16){return r`<svg viewBox="0 0 24 24" width=${s} height=${s} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${Ee[e]}</svg>`}var Pe=Object.defineProperty,Oe=Object.getOwnPropertyDescriptor,y=(e,s,i,n)=>{for(var a=n>1?void 0:n?Oe(s,i):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(a=(n?d(s,i,a):d(a))||a);return n&&a&&Pe(s,i,a),a};let g=class extends Y{constructor(){super(...arguments),this.event=null,this.stationName="",this.detailOn=!0,this.portraitOn=!0,this.now=new Date,this.portrait={kind:"none"},this.detail={kind:"idle"},this.ctl=null,this.loadedFor=""}willUpdate(e){e.has("event")&&(this.event?.id??"")!==this.loadedFor&&this.begin()}disconnectedCallback(){super.disconnectedCallback(),this.end()}end(){this.ctl?.abort(),this.ctl=null,this.portrait.kind==="ready"&&URL.revokeObjectURL(this.portrait.url),this.loadedFor=""}begin(){this.end(),this.portrait={kind:"none"},this.detail={kind:"idle"};const e=this.event;e&&(this.loadedFor=e.id,this.ctl=new AbortController,this.loadDetail(e,this.ctl),this.loadPortrait(e,this.ctl))}async loadDetail(e,s){if(this.detailOn){this.detail={kind:"loading"};try{const i=await re(e.id,s.signal);if(s.signal.aborted)return;this.detail=i.state==="unsupported"?{kind:"unsupported"}:i.event?{kind:"ready",event:i.event}:{kind:"failed"}}catch{s.signal.aborted||(this.detail={kind:"failed"})}}}async loadPortrait(e,s){if(!(!this.portraitOn||!W(e)||!e.station_id||!e.timestamp)){this.portrait={kind:"loading"};try{const i=await le(e.id,e.station_id,e.timestamp,s.signal);if(s.signal.aborted)return;this.portrait={kind:"ready",url:URL.createObjectURL(i)}}catch(i){if(s.signal.aborted)return;const n=i instanceof E?i.code:"";this.portrait={kind:n==="intercom_photo_not_found"||n==="intercom_event_not_found"?"gone":"error"}}}}retryPortrait(){const e=this.event;!e||!this.ctl||this.loadPortrait(e,this.ctl)}when(e){if(!e.timestamp)return"—";const s=Date.parse(e.timestamp);if(!Number.isFinite(s))return"—";const i=I(e.timestamp,this.zone),n=S(this.now.getTime(),this.zone);return`${i===n?t("dayToday"):i===ee(n,-1)?t("dayYesterday"):_(i)} ${x(e.timestamp,this.zone,!0)}`}row(e,s,i=""){return r`<dt>${e}</dt><dd data-ev-field=${i||l}>${s}</dd>`}render(){const e=this.event;if(!e)return l;const s=e.timestamp?Date.parse(e.timestamp):NaN,i=Number.isFinite(s)?Te(Ce(s,this.zone)):"",a=(this.detail.kind==="ready"?this.detail.event:null)?.evidence??null,o=a?.time_source??e.time_source,d=e.received_at&&e.time_source!=="received"?`${x(e.received_at,this.zone,!0)}`:"",u=a?.arrival_delay_seconds,T=this.portraitOn&&W(e),f=this.portrait,O=!!(e.person_name||e.employee_no);return r`
      <section class="sect" data-ev-section="event">
        <h4>${B("card",13)}${t("dEvent")}</h4>
        <dl>
          ${this.row(t("dTime"),r`<bdi>${this.when(e)}</bdi>${i?r` <bdi class="muted">${i}</bdi>`:l}`,"time")}
          ${this.row(t("dStation"),this.stationName||"—","station")}
          ${e.door?this.row(t("dDoor"),e.door,"door"):l}
          ${D(e)?this.row(t("dMethod"),e.authentication==="card"?t("card"):e.authentication==="pin"?t("pin"):t("unknown"),"method"):l}
          ${this.row(t("dType"),z("long_",e.event_type),"type")}
          ${o?this.row(t("dTimeSource"),t(o==="received"?"tsReceived":"tsDevice"),"time-source"):l}
          ${d?this.row(t("dReceived"),r`<bdi>${d}</bdi>`,"received"):l}
          ${a?.identity_state?this.row(t("dIdentity"),z("identity_",a.identity_state),"identity"):l}
          ${a?.origin?this.row(t("dOrigin"),z("origin_",a.origin),"origin"):l}
          ${u?this.row(t("dDelay"),t("dDelaySeconds",{n:u}),"delay"):l}
          ${e.recovered?this.row(t("dRecordKind"),t("dRecovered"),"recovered"):l}
        </dl>
        ${this.detail.kind==="failed"?r`<div class="muted" data-ev-detail-failed>${t("dDetailFail")}</div>`:l}
      </section>
      ${T?r`<section class="sect sens" data-ev-section="portrait" aria-label=${t("dPicture")}>
            <h4><sw-icon name="lock" size=${13}></sw-icon>${t("dPicture")}</h4>
            <div class="frame ${f.kind==="loading"?"loading":""}" data-ev-portrait=${f.kind} role=${f.kind==="loading"?"status":l} aria-label=${f.kind==="loading"?t("dPictureLoading"):l}>
              ${f.kind==="ready"?r`<img src=${f.url} alt=${t("dPictureAlt")} data-ev-portrait-img />`:f.kind==="gone"?r`<div class="msg"><sw-icon name="image" size=${24}></sw-icon><span>${t("dPictureGone")}</span></div>`:f.kind==="error"?r`<div class="msg"><sw-icon name="warning" size=${24}></sw-icon><span>${t("dPictureFail")}</span><sw-button size="lg" variant="secondary" icon="refresh" data-ev-portrait-retry @click=${()=>this.retryPortrait()}>${t("retry")}</sw-button></div>`:r`<sw-icon name="user" size=${28}></sw-icon>`}
            </div>
          </section>`:l}
      ${O?r`<section class="sect" data-ev-section="person">
            <h4><sw-icon name="user" size=${13}></sw-icon>${t("dPerson")}</h4>
            <dl>
              ${e.person_name?this.row(t("dName"),e.person_name,"name"):l}
              ${e.employee_no?this.row(t("dEmployee"),r`<bdi>${e.employee_no}</bdi>`,"employee"):l}
            </dl>
          </section>`:l}
    `}};g.styles=H`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    /* R5-SECURITY: the sections are wells (a tone step, no edge, radius lg); headings 14.5/700 in the heading ink; values 600 */
    .sect {
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .sect.sens {
      background: var(--sw-surface-3);
    }
    h4 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    dl {
      display: grid;
      grid-template-columns: minmax(84px, 110px) minmax(0, 1fr);
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-base);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    dd:first-of-type {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    bdi {
      unicode-bidi: isolate;
    }
    .frame {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      display: grid;
      place-items: center;
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .frame img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
      display: block;
    }
    .frame .msg {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 12px;
      text-align: center;
      font-size: var(--sw-fs-sm);
    }
    .frame.loading::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(100deg, transparent 30%, var(--sw-skeleton-shine) 50%, transparent 70%);
      animation: sheen 1.4s var(--sw-ease) infinite;
    }
    @keyframes sheen {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(100%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .frame.loading::after {
        animation: none;
      }
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
  `;y([m({attribute:!1})],g.prototype,"event",2);y([m({attribute:!1})],g.prototype,"zone",2);y([m()],g.prototype,"stationName",2);y([m({type:Boolean})],g.prototype,"detailOn",2);y([m({type:Boolean})],g.prototype,"portraitOn",2);y([m({attribute:!1})],g.prototype,"now",2);y([c()],g.prototype,"portrait",2);y([c()],g.prototype,"detail",2);g=y([q("wiskey-event-drawer")],g);var Ne=Object.defineProperty,Le=Object.getOwnPropertyDescriptor,v=(e,s,i,n)=>{for(var a=n>1?void 0:n?Le(s,i):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(a=(n?d(s,i,a):d(a))||a);return n&&a&&Ne(s,i,a),a};const Re={station_required:"exStationNeeded",unsupported:"exUnsupported",unavailable:"exUnavailable",forbidden:"exForbidden",invalid:"exInvalid",other:"exOther"};function Ue(e,s){const i=URL.createObjectURL(e),n=document.createElement("a");n.href=i,n.download=s,n.rel="noopener",document.body.appendChild(n),n.click(),n.remove(),window.setTimeout(()=>URL.revokeObjectURL(i),3e4)}let w=class extends Y{constructor(){super(...arguments),this.open=!1,this.filters={},this.stations=[],this.zone=j,this.phase="idle",this.needStation=!1,this.station="",this.rows=null,this.failure=null,this.ctl=null}willUpdate(e){e.has("open")&&this.open&&(this.phase="idle",this.needStation=!1,this.rows=null,this.failure=null,this.station=this.filters.station_id??"")}disconnectedCallback(){super.disconnectedCallback(),this.ctl?.abort()}close(){this.ctl?.abort(),this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}async go(){if(this.phase==="busy")return;this.phase="busy",this.failure=null,this.ctl?.abort();const e=this.ctl=new AbortController,s={...this.filters,...this.station?{station_id:this.station}:{}};try{const i=await de(s,e.signal);if(e.signal.aborted)return;Ue(i.blob,ue(new Date,this.zone)),this.rows=i.rows,this.phase="done"}catch(i){if(e.signal.aborted)return;const n=i instanceof E?we(i.status,i.code):"other";n==="station_required"&&(this.needStation=!0),this.failure=n,this.phase="error"}}render(){const e=this.phase==="busy",s=this.phase==="done";return r`<sw-dialog ?open=${this.open} ?locked=${e} heading=${t("exTitle")} @close=${i=>{i.stopPropagation(),this.close()}} data-ev-export>
      <p data-ev-export-body>${t("exBody")}</p>
      <p class="muted" data-ev-export-logged>${t("exLogged")}</p>
      ${this.needStation?r`<sw-field label=${t("exStation")}>
            <select data-ev-export-station .value=${this.station} ?disabled=${e} @change=${i=>this.station=i.target.value}>
              <option value="" ?selected=${!this.station}>${t("exStationPick")}</option>
              ${this.stations.map(i=>r`<option value=${i.id} ?selected=${i.id===this.station}>${i.name}</option>`)}
            </select>
          </sw-field>`:l}
      ${s?r`<div class="result ok" role="status" data-ev-export-result="done"><sw-icon name="check" size=${16}></sw-icon>${this.rows===null?t("exDoneNoCount"):t("exDone",{n:this.rows.toLocaleString("he-IL")})}</div>`:this.phase==="error"&&this.failure?r`<div class="result warn" role="alert" data-ev-export-result=${this.failure}><sw-icon name="warning" size=${16}></sw-icon>${t(Re[this.failure])}</div>`:l}
      <div slot="footer" class="foot">
        ${s?r`<sw-button size="lg" variant="primary" data-ev-export-close @click=${()=>this.close()}>${t("exClose")}</sw-button>`:r`<sw-button size="lg" variant="primary" icon="download" data-ev-export-go ?disabled=${e||this.needStation&&!this.station} @click=${()=>void this.go()}>${t(e?"exBusy":"exGo")}</sw-button>
              <sw-button size="lg" data-ev-export-cancel ?disabled=${e} @click=${()=>this.close()}>${t("exCancel")}</sw-button>`}
      </div>
    </sw-dialog>`}};w.styles=H`
    p {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-base);
    }
    p.muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .result {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
    }
    .result.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .result.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    select {
      min-block-size: max(var(--sw-touch-desktop), 44px);
    }
    .foot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      inline-size: 100%;
    }
  `;v([m({type:Boolean,reflect:!0})],w.prototype,"open",2);v([m({attribute:!1})],w.prototype,"filters",2);v([m({attribute:!1})],w.prototype,"stations",2);v([m({attribute:!1})],w.prototype,"zone",2);v([c()],w.prototype,"phase",2);v([c()],w.prototype,"needStation",2);v([c()],w.prototype,"station",2);v([c()],w.prototype,"rows",2);v([c()],w.prototype,"failure",2);w=v([q("wiskey-events-export")],w);class P{constructor(s,i=()=>{}){this.fetchPage=s,this.changed=i,this.snapshot=P.initial(),this.applied={},this.generation=0,this.queued=null,this.isDisposed=!1}static initial(){return{reply:null,page:null,pages:0,shownAt:null,everReady:!1,busy:!1,loadingMore:!1,cursorExpired:!1,pendingUpdate:!1,error:"",forbidden:!1}}get snap(){return this.snapshot}get disposed(){return this.isDisposed}get filters(){return this.applied}setFilters(s){this.applied=s}markForbidden(){this.snapshot={...this.snapshot,forbidden:!0},this.changed()}restart(s){return this.generation++,this.queued=null,this.applied=s,this.snapshot={...this.snapshot,busy:!1,loadingMore:!1,page:null,pages:0,shownAt:null,cursorExpired:!1,pendingUpdate:!1,error:""},this.load("reload")}reload(){return this.load("reload")}notice(){return this.load("notice")}more(){return this.load("more")}dispose(){this.isDisposed=!0,this.generation++}set(s){this.snapshot={...this.snapshot,...s},this.isDisposed||this.changed()}async load(s){if(this.isDisposed||this.snapshot.forbidden)return;if(this.snapshot.busy){s==="reload"?this.queued="reload":s==="notice"&&!this.queued&&(this.queued="notice");return}if(s==="notice"&&this.snapshot.pages>1){this.set({pendingUpdate:!0});return}const i=s==="more",n=i?this.snapshot.page?.next??null:null;if(i&&!n)return;const a=++this.generation;this.set({busy:!0,loadingMore:i});try{const o=await this.fetchPage(this.applied,n);if(a!==this.generation)return;const d={reply:o,error:"",cursorExpired:!1};o.events&&(d.everReady=!0,i&&this.snapshot.page?(d.page=fe(this.snapshot.page,o.events),d.pages=this.snapshot.pages+1):(d.page=o.events,d.pages=1,d.shownAt=o.fetched_at,d.pendingUpdate=!1)),this.set(d)}catch(o){if(a!==this.generation)return;o instanceof E&&o.status===403?this.set({forbidden:!0}):o instanceof E&&o.code==="intercom_cursor_expired"?this.set({cursorExpired:!0}):this.set({error:ie(o)})}finally{if(a===this.generation){this.set({busy:!1,loadingMore:!1});const o=this.queued;o&&(this.queued=null,this.load(o))}}}}var Me=Object.defineProperty,Fe=Object.getOwnPropertyDescriptor,p=(e,s,i,n)=>{for(var a=n>1?void 0:n?Fe(s,i):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(a=(n?d(s,i,a):d(a))||a);return n&&a&&Me(s,i,a),a};const Ie=3e4,je=450,X="sw.wiskey.events.view",A={kind:"iana",name:"Asia/Jerusalem"},J=[{id:"d1",name:"שער ראשי",online:!0,zone:A},{id:"d2",name:"לובי",online:!0,zone:A},{id:"d3",name:"חניון",online:!0,zone:A}],k=(e,s,i,n,a={})=>({id:e,station_id:s,timestamp:i,received_at:i,time_source:"device",person_name:n,employee_no:null,authentication:"card",result:"granted",event_type:"access_granted",recovered:!1,door:1,portrait:null,...a}),Q={state:"ready",configured:!0,last_error:null,fetched_at:null,events:{records:[k("e1","d1","2026-09-27T07:58:12+03:00","דנה כהן"),k("e2","d2","2026-09-27T07:41:03+03:00",null,{authentication:"pin",employee_no:"2044",door:2}),k("e3","d3","2026-09-26T22:10:40+03:00",null,{authentication:"unknown",result:"denied",event_type:"access_denied",door:null}),k("e4","d1","2026-09-26T18:03:55+03:00","יוסי לוי",{authentication:"pin",result:"denied",event_type:"access_denied"}),k("e5","d2","2026-09-26T17:30:00+03:00",null,{authentication:"unknown",result:"unknown",event_type:"ring",door:null})],next:null,retention_days:30,capacity:5e3,membership_basis:null,storage_failed:!1,stations:{},complete:!0,incomplete_reason:null}},Be="min-block-size:max(44px,var(--sw-touch-desktop,44px));padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer",F={ok:"live",err:"error",warn:"stale",acc:"recorded",unk:"unknown",neutral:"neutral"};let h=class extends Y{constructor(){super(),this.rev=0,this.noAccess=!1,this.stations=null,this.defaultZone=j,this.features=null,this.filters={...Z},this.filterNote="",this.customOpen=!1,this.customDraft={start:"",end:""},this.customError="",this.view="list",this.phone=!1,this.selectedId="",this.exportOpen=!1,this.note="",this.search="",this.known={},this.stop=null,this.poll=0,this.searchTimer=0,this.stationsBusy=!1,this.stationsAgain=!1,this.media=null,this.session=0,this.onMedia=e=>{this.phone=e.matches},this.feed=this.makeFeed()}makeFeed(){return new P((e,s)=>this.fetchPage(e,s),()=>this.rev+=1)}connectedCallback(){super.connectedCallback(),this.media=typeof matchMedia=="function"?matchMedia("(max-width: 767px)"):null,this.phone=!!this.media?.matches,this.media?.addEventListener("change",this.onMedia);try{const e=localStorage.getItem(X);(e==="table"||e==="list")&&(this.view=e)}catch{}if($()){if(this.feed.disposed&&(this.feed=this.makeFeed()),!M().events){this.noAccess=!0,this.feed.markForbidden();return}this.filters=ge(window.location.hash),this.search=this.filters.person,this.start(++this.session)}}disconnectedCallback(){super.disconnectedCallback(),this.session++,this.media?.removeEventListener("change",this.onMedia),this.stop?.(),this.stop=null,this.setPolling(!1),window.clearTimeout(this.searchTimer),this.feed.dispose()}async start(e){this.loadFeatures(),await this.loadStations(),e===this.session&&(this.apply(),this.stop=ne(s=>{(s.type==="intercom_refresh"||s.type==="intercom_state")&&this.onChangeNotice()},s=>{this.setPolling(!s),s&&this.onChangeNotice()}))}setPolling(e){window.clearInterval(this.poll),this.poll=e?window.setInterval(()=>this.onChangeNotice(),Ie):0}fetchPage(e,s){return ce(e,s)}zoneContext(){return{zoneOf:e=>this.stations?.find(s=>s.id===e)?.zone??null,fallback:this.defaultZone}}async loadStations(){if(this.stationsBusy){this.stationsAgain=!0;return}this.stationsBusy=!0;try{do{this.stationsAgain=!1;try{const e=await he();e.stations&&(this.stations=e.stations,this.defaultZone=e.default_zone??j,this.rezone())}catch{}}while(this.stationsAgain)}finally{this.stationsBusy=!1}}async loadFeatures(){try{this.features=await pe()}catch{this.features=null}}fresh(){if(this.filters.range==="all"||this.filters.range==="custom")return;const e=V(this.filters,new Date,this.zoneContext(),this.known);"filters"in e&&this.feed.setFilters(e.filters)}onChangeNotice(){this.loadStations(),this.fresh(),this.feed.notice()}refresh(){this.fresh(),this.feed.reload()}apply(){if(!$())return;const e=V(this.filters,new Date,this.zoneContext(),this.known);if("error"in e){this.filterNote=e.error;return}this.filterNote="",this.known={start:e.start,end:e.end},this.selectedId="",this.feed.restart(e.filters)}rezone(){const e=this.filters;if(e.station_id&&this.stations&&!this.stations.some(s=>s.id===e.station_id)){this.filters={...e,station_id:""},this.apply();return}}set(e,s){const i=this.filters;let n={...i,[e]:s};if(e==="station_id"&&i.range==="custom"){const a=me(n,b(i,this.zoneContext()),b(n,this.zoneContext()),this.known);n=a.state,this.known=a.known,this.filterNote=a.cleared?"filter_zone_changed_invalid":""}this.filters=n,this.apply()}onRange(e){if(e==="custom"){const s=b(this.filters,this.zoneContext()),i=this.filters.customStart,n=this.filters.customEnd,a=S(Date.now(),s);this.customDraft={start:i||`${a}T00:00`,end:n||""},this.customError="",this.customOpen=!0;return}this.set("range",e)}applyCustom(){const e={...this.filters,range:"custom",customStart:this.customDraft.start,customEnd:this.customDraft.end},s=b(e,this.zoneContext()),i=ve(e,new Date,s,{});if("error"in i){this.customError=i.error;return}this.customOpen=!1,this.known={},this.filters=e,this.apply()}clearAll(){this.filters={...Z},this.search="",this.known={},this.filterNote="",this.apply()}onSearch(e){this.search=e,window.clearTimeout(this.searchTimer),this.searchTimer=window.setTimeout(()=>this.commitSearch(),je)}commitSearch(){window.clearTimeout(this.searchTimer);const e=this.search.trim();e!==this.filters.person.trim()&&this.set("person",e)}setView(e){this.view=e;try{localStorage.setItem(X,e)}catch{}}stationList(){return $()?this.stations??[]:J}stationName(e){if(!e)return"—";const s=this.stationList().find(i=>i.id===e);return s?s.name:($()?this.stations:J)?t("removedStation"):e}zoneOf(e){return this.stationList().find(s=>s.id===e.station_id)?.zone??($()?this.defaultZone:A)}methodText(e){return e.authentication==="card"?t("card"):e.authentication==="pin"?t("pin"):t("unknown")}titleText(e){const s=L(e);return s.kind==="person"||s.kind==="employee"?s.text:s.kind==="ring"?t("ring"):s.kind==="unidentified"?t("unidentified"):z("type_",s.text)}pillLabel(e){const s=ye(e);return s==="granted"?t("granted"):s==="denied"?t("denied"):z("type_",s)}subText(e){return[this.stationName(e.station_id),e.door?t("doorN",{n:e.door}):"",D(e)?this.methodText(e):""].filter(Boolean).join(" · ")}dayWord(e,s,i){if(!s)return t("dayUnknown");const n=S(i.getTime(),e);return s===n?t("dayToday"):s===ee(n,-1)?t("dayYesterday"):_(s)}whenText(e,s){const i=this.zoneOf(e),n=I(e.timestamp,i);return`${this.dayWord(i,n,s)} ${x(e.timestamp,i)}`}updatedText(e,s){const i=e?x(e,this.defaultZone):"";return!i||i==="—"?s?t("staleNever"):"":t(s?"staleAt":"updatedAt",{t:i})}open(e){this.selectedId=e}closeDrawer(){this.selectedId=""}print(){const e=this.feed.snap.page?.records??[];if(this.note="",!e.length){this.note=t("prNothing");return}const s=new Date,i=b(this.filters,this.zoneContext()),n=this.filters.range==="all"?t("rangeAll"):this.filters.range==="today"?t("rangeToday"):this.filters.range==="yesterday"?t("rangeYesterday"):this.filters.range==="week"?t("rangeWeek"):t("rangeCustomShown"),a=[t("prPeriod",{range:n}),this.filters.station_id?t("prStation",{name:this.stationName(this.filters.station_id)}):""].filter(Boolean).join(" · "),o=e.map(u=>{const T=this.zoneOf(u),f=L(u),O=f.kind==="person"?[f.text,u.employee_no].filter(Boolean).join(" · "):this.titleText(u);return[`${_(I(u.timestamp,T))} ${x(u.timestamp,T,!0)}`,this.pillLabel(u),O,this.stationName(u.station_id),u.door?String(u.door):"",D(u)?this.methodText(u):""]}),d=Se({title:t("prTitle"),subtitle:a,columns:[t("colTime"),t("colResult"),t("colPerson"),t("colStation"),t("colDoor"),t("colMethod")],rows:o,footer:t("prFooter",{t:`${_(S(s.getTime(),i))} ${x(s.toISOString(),i)}`,n:o.length}),lang:se()});De(d)||(this.note=t("prUnavailable"))}toSettings(){ae("/system/access-control")}render(){const e=!$();if(!e&&(this.noAccess||this.feed.snap.forbidden))return r`<sw-page heading=${t("title")}><sw-state-panel quiet data-wiskey-state="no_permission" state="forbidden" heading=${t("noPermission")}></sw-state-panel></sw-page>`;const s=e?{...P.initial(),reply:Q,page:Q.events,pages:1,everReady:!0}:this.feed.snap,i=s.reply,n=!!s.page&&!!i&&i.state!=="ready";return r`<sw-page heading=${t("title")} subheading=${n?"":this.updatedText(s.shownAt,!1)} wide>
      ${this.renderActions(e,s.page?.records.length??0)}
      ${this.renderChips()}
      ${this.renderNotes(s,n)}
      ${this.renderBody(s,e)}
      ${this.renderDrawer(s.page?.records??[],e)}
      ${this.renderCustom()}
      ${e?l:r`<wiskey-events-export ?open=${this.exportOpen} .filters=${this.feed.filters} .stations=${this.stationList()} .zone=${b(this.filters,this.zoneContext())} @close=${()=>this.exportOpen=!1}></wiskey-events-export>`}
    </sw-page>`}renderActions(e,s){const i=!e&&M().export&&N(this.features,"events_export"),n=this.view==="table"&&!this.phone,a=this.phone;return r`<div slot=${oe(a?void 0:"actions")} class="actions" data-phone=${String(a)}>
      <label class="search">
        <sw-icon name="search" size=${16}></sw-icon>
        <input type="search" data-wiskey-search aria-label=${t("searchLabel")} placeholder=${t("searchPlaceholder")} maxlength="128" .value=${this.search} ?disabled=${e}
          @input=${o=>this.onSearch(o.target.value)} @keydown=${o=>o.key==="Enter"&&this.commitSearch()} />
      </label>
      ${i?r`<sw-button size="lg" class="ib" ?block=${a} data-wiskey-export icon="download" @click=${()=>this.exportOpen=!0}><span class="lbl">${t("export")}</span></sw-button>`:l}
      <sw-button size="lg" class="ib" ?block=${a} data-wiskey-print ?disabled=${e||!s} @click=${()=>this.print()}><span class="bl">${B("print",15)}<span class="lbl">${t("print")}</span></span></sw-button>
      ${a?l:r`<div class="seg" role="group" aria-label=${t("viewGroup")}>
            <button type="button" data-wiskey-view="list" aria-pressed=${String(!n)} title=${t("viewList")} aria-label=${t("viewList")} @click=${()=>this.setView("list")}><sw-icon name="list" size=${16}></sw-icon></button>
            <button type="button" data-wiskey-view="table" aria-pressed=${String(n)} title=${t("viewTable")} aria-label=${t("viewTable")} @click=${()=>this.setView("table")}>${B("table",16)}</button>
          </div>`}
      ${e?l:r`<sw-button size="lg" class="ib" ?block=${a} data-wiskey-events-refresh variant="ghost" icon="refresh" ?disabled=${this.feed.snap.busy} @click=${()=>this.refresh()}><span class="lbl">${t("refresh")}</span></sw-button>`}
    </div>`}rangeItems(){return[{id:"all",label:t("rangeAll")},{id:"today",label:t("rangeToday")},{id:"yesterday",label:t("rangeYesterday")},{id:"week",label:t("rangeWeek")},{id:"custom",label:t("rangeCustomShown")}]}renderChips(){const e=this.filters,s=[{id:"",label:t("stationAll")},...this.stationList().map(o=>({id:o.id,label:o.name}))],i=[{id:"",label:t("resultAll")},...be.map(o=>({id:o,label:t(o)}))],n=[{id:"",label:t("methodAll")},...xe.map(o=>({id:o,label:t(o==="card"?"card":o==="pin"?"pin":"unknown")}))],a=[{id:"",label:t("doorAll")},...$e.map(o=>({id:o,label:t("doorN",{n:o})}))];return r`<div class="chips" role="group" aria-label=${t("filters")} data-wiskey-events-filters>
      <sw-dropdown tall data-wiskey-filter="range" label=${t("range")} icon="calendar" .items=${this.rangeItems()} .value=${e.range} @change=${o=>this.onRange(o.detail.id)}></sw-dropdown>
      <sw-dropdown tall data-wiskey-filter="station" label=${t("station")} icon="door" .items=${s} .value=${e.station_id} @change=${o=>this.set("station_id",o.detail.id)}></sw-dropdown>
      <sw-dropdown tall data-wiskey-filter="result" label=${t("result")} icon="check" .items=${i} .value=${e.result} @change=${o=>this.set("result",o.detail.id)}></sw-dropdown>
      <sw-dropdown tall data-wiskey-filter="method" label=${t("method")} icon="lock" .items=${n} .value=${e.authentication} @change=${o=>this.set("authentication",o.detail.id)}></sw-dropdown>
      <sw-dropdown tall data-wiskey-filter="door" label=${t("door")} icon="unlock" .items=${a} .value=${e.door} @change=${o=>this.set("door",o.detail.id)}></sw-dropdown>
      ${K(e)?r`<sw-button variant="ghost" size="lg" data-wiskey-filter-clear @click=${()=>this.clearAll()}>${t("clear")}</sw-button>`:l}
    </div>`}renderNotes(e,s){const i=e.page,n=i?ke(i):[];return r`
      ${s?r`<div class="note stale" role="status" data-wiskey-stale><sw-icon name="offline" size=${16}></sw-icon><span>${this.updatedText(e.shownAt,!0)}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>this.refresh()}>${t("refresh")}</sw-button></div>`:l}
      ${e.pendingUpdate?r`<div class="note info" role="status" data-wiskey-events-pending><sw-icon name="info" size=${16}></sw-icon><span>${t("pending")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>this.refresh()}>${t("refresh")}</sw-button></div>`:l}
      ${e.cursorExpired?r`<div class="note err" role="alert" data-wiskey-events-cursor-expired><sw-icon name="warning" size=${16}></sw-icon><span>${t("cursorExpired")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>this.refresh()}>${t("reloadFromStart")}</sw-button></div>`:l}
      ${i?.storage_failed?r`<div class="note err" role="alert" data-wiskey-events-storage><sw-icon name="warning" size=${16}></sw-icon><span>${t("storageFailed")}</span></div>`:l}
      ${n.map(a=>r`<div class="note stale" role="status" data-wiskey-events-history=${a}><sw-icon name="warning" size=${16}></sw-icon><span>${t("historyGap",{name:this.stationName(a)})}</span></div>`)}
      ${this.filterNote==="filter_zone_changed_invalid"?r`<div class="note info" role="status" data-wiskey-events-filter-note><span>${U(this.filterNote)}</span></div>`:l}
      ${this.filterNote&&this.filterNote!=="filter_zone_changed_invalid"?r`<div class="note err" role="alert" data-wiskey-events-filter-error=${this.filterNote}><span>${U(this.filterNote)}</span></div>`:l}
      ${this.note?r`<div class="note info" role="status" data-wiskey-events-note><span>${this.note}</span></div>`:l}
    `}panel(e,s){if(!e)return r`<sw-state-panel data-wiskey-state="load_error" state="error" heading=${t("stateError")} hint=${s||t("stateErrorHint")} actionLabel=${t("retry")} @action=${()=>this.refresh()}></sw-state-panel>`;const i=M().admin,n=_e(e.state,e.last_error),o={ha_not_configured:{panel:"stale",heading:t("stateNotConfigured"),action:i?t("toSettings"):void 0},connecting:{panel:"loading",heading:t("stateConnecting")},ha_unavailable:{panel:"stale",heading:t("stateUnavailable"),hint:t("stateUnavailableHint")},not_installed:{panel:"empty",heading:t("stateNotInstalled"),action:i?t("toSettings"):void 0},forbidden:{panel:"forbidden",heading:t("stateRefused")},unsupported:{panel:"empty",heading:t("stateUnsupported")}}[e.state]??(n==="rate"?{panel:"stale",heading:t("stateRate"),hint:t("stateRateHint"),action:t("retry")}:{panel:"error",heading:t("stateError"),hint:t("stateErrorHint"),action:t("retry")});return r`<sw-state-panel icon="history" quiet data-wiskey-state=${e.state} state=${o.panel} heading=${o.heading} hint=${o.hint??""} actionLabel=${o.action??""}
      @action=${()=>o.action===t("toSettings")?this.toSettings():this.refresh()}></sw-state-panel>`}skeleton(){return r`<sw-card flush><div class="sk-list" aria-busy="true" data-wiskey-events-loading>${[0,1,2,3,4,5,6,7].map(()=>r`<div class="sk-row"><span class="sk dotp"></span><span class="sk-main"><span class="sk l"></span><span class="sk m"></span></span><span class="sk pill"></span></div>`)}</div></sw-card>`}renderBody(e,s){const i=e.page;if(!i)return e.busy||!e.reply&&!e.error?this.skeleton():this.panel(e.reply,e.error);const n=i.records,a=i.next&&!s?r`<div class="more"><sw-button size="lg" data-wiskey-events-more ?disabled=${e.busy} @click=${()=>void this.feed.more()}>${e.loadingMore?t("loadingMore"):t("more")}</sw-button></div>`:l;if(!n.length){if(i.next)return r`<sw-state-panel icon="history" quiet compact state="empty" data-wiskey-events-empty heading=${t("emptyMore")}></sw-state-panel>${a}`;const d=K(this.filters)>0;return r`<sw-state-panel icon="history" quiet state="empty" data-wiskey-events-empty heading=${t(d?"empty":"emptyAll")} actionLabel=${d?t("clear"):""} @action=${()=>this.clearAll()}></sw-state-panel>`}const o=this.view==="table"&&!this.phone;return r`<span class="sr" data-wiskey-events-count=${n.length}></span>${o?this.renderTable(n):this.renderList(n)}${a}`}renderList(e){const i=ze(e,n=>this.zoneOf(n),new Date);return r`<sw-card flush class="feed" data-wiskey-events-list>
      ${i.map(n=>r`<div class="grp" role="heading" aria-level="3" data-wiskey-day=${n.date||"unknown"}>${n.kind==="today"?t("dayToday"):n.kind==="yesterday"?t("dayYesterday"):n.kind==="unknown"?t("dayUnknown"):_(n.date)}</div>
          ${n.rows.map(a=>this.renderRow(a))}`)}
    </sw-card>`}renderRow(e){const s=this.zoneOf(e),i=R(e),n=this.titleText(e);return r`<button type="button" class="row" data-row-id=${e.id} data-row-tone=${i.dot} data-wiskey-event @click=${()=>this.open(e.id)}>
      <time class="time" datetime=${e.timestamp??""} data-wiskey-event-time><bdi>${x(e.timestamp,s)}</bdi></time>
      <span class="dot ${i.dot}" aria-hidden="true"></span>
      <span class="main"><span class="t" data-wiskey-event-person>${n}</span><span class="s" data-wiskey-event-station>${this.subText(e)}</span></span>
      <sw-badge data-wiskey-event-result=${e.result} kind=${F[i.pill]} label=${this.pillLabel(e)}></sw-badge>
      <sw-icon class="chev" name="chevronBack" size=${16}></sw-icon>
    </button>`}columns(e){const s=i=>i;return[{key:"time",label:t("colTime"),render:i=>r`<button type="button" style=${Be} data-wiskey-event @click=${()=>this.open(s(i).id)}><time datetime=${s(i).timestamp??""} data-wiskey-event-time><bdi>${this.whenText(s(i),e)}</bdi></time></button>`},{key:"result",label:t("colResult"),render:i=>r`<sw-badge data-wiskey-event-result=${s(i).result} kind=${F[R(s(i)).pill]} label=${this.pillLabel(s(i))}></sw-badge>`},{key:"person",label:t("colPerson"),render:i=>{const n=s(i),a=L(n);return r`<span data-wiskey-event-person>${a.kind==="person"?r`${a.text}${n.employee_no?r` · <bdi>${n.employee_no}</bdi>`:l}`:this.titleText(n)}</span>`}},{key:"station",label:t("colStation"),render:i=>r`<span data-wiskey-event-station>${this.stationName(s(i).station_id)}</span>`},{key:"door",label:t("colDoor"),render:i=>s(i).door?String(s(i).door):"—"},{key:"method",label:t("colMethod"),render:i=>D(s(i))?this.methodText(s(i)):"—"}]}renderTable(e){return r`<sw-table dense data-wiskey-events-table .columns=${this.columns(new Date)} .rows=${e} .selected=${this.selectedId||null} @row-select=${s=>this.open(s.detail.id)}></sw-table>`}renderDrawer(e,s){const i=this.selectedId?e.find(a=>a.id===this.selectedId):void 0,n=i?R(i):null;return r`<sw-drawer modal ?open=${!!i} heading=${i?this.titleText(i):""} @close=${()=>this.closeDrawer()} data-wiskey-event-drawer>
      ${i&&n?r`<sw-badge slot="action" data-wiskey-event-detail-result kind=${F[n.pill]} label=${this.pillLabel(i)}></sw-badge>`:l}
      ${i?r`<wiskey-event-drawer data-wiskey-event-detail=${i.id} .event=${i} .zone=${this.zoneOf(i)} .now=${new Date} stationName=${this.stationName(i.station_id)}
            .detailOn=${!s&&N(this.features,"event_detail")} .portraitOn=${!s&&N(this.features,"event_portrait")}></wiskey-event-drawer>`:l}
    </sw-drawer>`}renderCustom(){const e=b(this.filters,this.zoneContext());return r`<sw-dialog ?open=${this.customOpen} heading=${t("crTitle")} @close=${()=>this.customOpen=!1} data-wiskey-custom-range>
      <sw-field label=${t("crFrom")}><input type="datetime-local" lang=${G()} data-wiskey-filter-start .value=${this.customDraft.start} @input=${s=>this.customDraft={...this.customDraft,start:s.target.value}} /></sw-field>
      <sw-field label=${t("crUntil")}><input type="datetime-local" lang=${G()} data-wiskey-filter-end .value=${this.customDraft.end} @input=${s=>this.customDraft={...this.customDraft,end:s.target.value}} /></sw-field>
      <div class="zone" data-wiskey-events-zone>${t("crZone",{zone:e.name})}</div>
      ${this.customError?r`<div class="note err" role="alert" data-wiskey-events-filter-error=${this.customError}><span>${U(this.customError)}</span></div>`:l}
      <div slot="footer" class="foot">
        <sw-button size="lg" variant="primary" data-wiskey-custom-apply @click=${()=>this.applyCustom()}>${t("crApply")}</sw-button>
        <sw-button size="lg" data-wiskey-custom-cancel @click=${()=>this.customOpen=!1}>${t("crCancel")}</sw-button>
      </div>
    </sw-dialog>`}};h.styles=H`
    /* every control of this screen - the shared buttons and the dialogs' close buttons included - has the touch size: the desktop dial
       (44 px unless the owner chose the 32 px one) and 44 px on touch layouts. The control-height tokens inherit into the components'
       shadow roots. */
    :host {
      display: block;
      --_t: var(--sw-touch-desktop, 44px);
      --sw-ctl-h-sm: var(--_t);
      --sw-ctl-h-md: var(--_t);
      --sw-ctl-h-lg: var(--_t);
    }
    @media (max-width: 1100px) {
      :host {
        --_t: max(44px, var(--sw-touch-desktop, 44px));
      }
    }
    .bl {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .foot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      inline-size: 100%;
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .search {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      inline-size: 260px;
      min-inline-size: 0;
      padding-inline: 12px;
      box-sizing: border-box;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-3);
    }
    .search:focus-within {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .search input {
      /* an explicit zero width: a text input's intrinsic width is also its minimum, and a row of icon buttons beside it must fit a phone */
      flex: 1 1 0;
      inline-size: 0;
      min-inline-size: 0;
      min-block-size: var(--_t);
      padding: 0;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-base);
    }
    .actions[data-phone='true'] {
      flex-wrap: nowrap;
      inline-size: 100%;
    }
    .actions[data-phone='true'] .search {
      flex: 1 1 0;
      inline-size: auto;
    }
    .actions[data-phone='true'] sw-button.ib {
      flex: none;
      inline-size: 44px;
    }
    .actions[data-phone='true'] .lbl {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .seg {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-inline-size: var(--_t);
      min-block-size: var(--_t);
      padding: 0 10px;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface-solid));
      color: var(--sw-seg-key-ink, var(--sw-heading));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    .g {
      display: inline-flex;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    @media (max-width: 767px) {
      /* one scrolling row that bleeds to the screen's edges: sw-page's phone padding is 12 px */
      .chips {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        margin-inline: -12px;
        padding-inline: 12px;
      }
      .chips::-webkit-scrollbar {
        display: none;
      }
      .chips > * {
        flex: none;
      }
    }
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .note > span {
      flex: 1 1 200px;
    }
    .note.info {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .note.stale {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .feed {
      display: block;
    }
    /* R5-SECURITY: the day heading is a heading (13/800 in the heading ink on a tone step) */
    .grp {
      padding: 9px 14px;
      background: var(--sw-surface-3);
      border-block-start: 1px solid var(--sw-border);
      color: var(--sw-heading, var(--sw-text));
      font-size: var(--sw-fs-md);
      font-weight: 800;
      letter-spacing: 0.01em;
    }
    .grp:first-child {
      border-block-start: 0;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      inline-size: 100%;
      min-block-size: max(56px, var(--_t));
      padding: 8px 14px;
      border: 0;
      border-block-start: 1px solid var(--sw-border);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
      box-sizing: border-box;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .grp + .row {
      border-block-start: 0;
    }
    /* R5-SECURITY (mobile-native / emil): a hover only under a fine pointer; the row sinks on pointer-down; a refused entry is a
       filled danger field, a call a filled accent field (status as a field, never a wash) */
    @media (hover: hover) and (pointer: fine) {
      .row:hover {
        background: var(--sw-hover-wash);
      }
    }
    .row:active {
      transform: scale(var(--sw-press-scale));
    }
    .row[data-row-tone='err'] {
      background: var(--sw-danger-soft);
    }
    .row[data-row-tone='warn'] {
      background: var(--sw-warning-soft);
    }
    .row:focus-visible {
      outline-offset: -2px;
    }
    .time {
      /* the time is the display figure of a log row: 15/800, tabular, in the heading ink */
      flex: none;
      min-inline-size: 56px;
      color: var(--sw-heading, var(--sw-text));
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
    }
    .dot {
      flex: none;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: var(--sw-unknown);
      box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 0%, var(--sw-surface));
    }
    sw-badge {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      line-height: 18px;
      padding-block: 2px;
      min-inline-size: 64px;
      justify-content: center;
    }
    .dot.ok {
      background: var(--sw-live);
    }
    .dot.err {
      background: var(--sw-danger);
    }
    .dot.warn {
      background: var(--sw-warning);
    }
    .main {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .main .t {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .main .s {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chev {
      flex: none;
      color: var(--sw-text-3);
    }
    :host-context([dir='ltr']) .chev {
      transform: scaleX(-1);
    }
    .more {
      display: flex;
      justify-content: center;
      padding: 14px;
    }
    .zone {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    sw-dialog input {
      min-block-size: var(--_t);
    }
    .sk-list {
      display: flex;
      flex-direction: column;
    }
    .sk-row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 56px;
      padding: 8px 14px;
      border-block-start: 1px solid var(--sw-border);
    }
    .sk-row:first-child {
      border-block-start: 0;
    }
    .sk-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sk {
      display: block;
      border-radius: var(--sw-r-xs);
      background: var(--sw-skeleton);
    }
    .sk.l {
      inline-size: 38%;
      block-size: 12px;
    }
    .sk.m {
      inline-size: 24%;
      block-size: 10px;
    }
    .sk.dotp {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
    }
    .sk.pill {
      inline-size: 64px;
      block-size: 22px;
      border-radius: var(--sw-r-pill);
    }
  `;p([c()],h.prototype,"rev",2);p([c()],h.prototype,"noAccess",2);p([c()],h.prototype,"stations",2);p([c()],h.prototype,"defaultZone",2);p([c()],h.prototype,"features",2);p([c()],h.prototype,"filters",2);p([c()],h.prototype,"filterNote",2);p([c()],h.prototype,"customOpen",2);p([c()],h.prototype,"customDraft",2);p([c()],h.prototype,"customError",2);p([c()],h.prototype,"view",2);p([c()],h.prototype,"phone",2);p([c()],h.prototype,"selectedId",2);p([c()],h.prototype,"exportOpen",2);p([c()],h.prototype,"note",2);p([c()],h.prototype,"search",2);h=p([q("wiskey-events")],h);export{h as WiskeyEvents};
//# sourceMappingURL=wiskey-events-6FD6uT8J.js.map
