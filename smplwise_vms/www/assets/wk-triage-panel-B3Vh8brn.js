import{bg as P,F as m,c as T,hX as z,bw as N,bO as O,dk as D,bt as L,bs as j,bu as q,gz as F,j as I,z as E,k as p,a as U,q as h,u as H,A as r,b as a,ae as g,m as K}from"./index-B3MtI4W-.js";import{g as M,a as W,b as Z}from"./access-status-oJTIUsto.js";import{U as $,a as G}from"./wiskey-format-D0cBtVXZ.js";const X=[15,60,240,1440,10080],J=["planned_maintenance","network_work","investigating"],Q=15e3,S=()=>({client_request_id:D(),expires_at:O(z()+Q)}),w=encodeURIComponent,V=()=>P("access-control/triage"),Y=(e,t,i)=>m(`access-control/stations/${w(e)}/conflicts/${w(t)}/review`,{kind:i}),ee=(e,t)=>m(`access-control/triage/reviews/${w(e)}/resolve`,{direction:t,confirmed:!0,...S()}),se=(e,t,i,l,o)=>m(`access-control/stations/${w(e)}/alerts/${w(t)}/${i}`,{confirmed:!0,...i==="snooze"?{duration_minutes:l,reason:o}:{},...S()}),te=e=>N("access-control/triage/settings",{notify:e});function v(e){if(e instanceof T){const t=e.body?.details??{},i=String(t.outcome??"");let l=i==="refused"?"failed":i==="not_sent"?"not_sent":i==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown";e.code==="triage_stale"&&(l="stale");const o=Number(t.retry_after_s);return{status:l,code:String(t.wiskey_code??e.code??"")||null,message:e.body?.user_message||"",retry_after_s:Number.isFinite(o)&&o>=0?o:null}}return{status:"unknown",code:"network",message:"",retry_after_s:null}}function b(e){return e.kind==="person"?"person":e.kind==="removal"?"removal":null}function ie(e){return(e.kind==="removal"?["delete"]:["central","device"]).map(i=>({direction:i,allowed:!!e.impact.actions?.[i]?.allowed,reason:e.impact.actions?.[i]?.reason??null}))}function ae(e,t=z()){return Math.floor((Date.parse(e.expires_at)-t)/1e3)}const y=e=>`${e.station_id}:${e.person?.id??""}`,k=e=>`${e.station_id??""}:${e.kind}`;function ne(e){return e.suppressed?e.suppression?.kind?["restore"]:[]:["snooze"]}function re(e){return e.suppression?.kind||e.kind}const oe=["access.admin.read","access.stations.manage","system.configure"];function he(e){return oe.some(t=>e(t))}function _(e){if(!e)return"…";const t=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(e);return t?`${Number(t[3])}.${Number(t[2])}.${t[1]} ${t[4]}:${t[5]}`:e}const A={title:"התנגשויות והתראות עמדות",subtitle:"מה שמסומן באדום במצב המערכת: התנגשויות סנכרון של אנשים, מחיקות שממתינות לבדיקה והתראות עמדות. כל החלטה עוברת בדיקה ואישור.",link:"התנגשויות והתראות",tabs:{conflicts:"התנגשויות",alerts:"התראות"},openFull:"למסך המלא",refresh:"רענון",loading:"טוען…",readOnly:"צפייה בלבד: פתרון התנגשויות וטיפול בהתראות דורשים הרשאת ניהול עמדות בכל המערכת או הרשאת מנהל מערכת.",conflicts:{heading:"התנגשויות סנכרון",empty:"אין התנגשויות. כל האנשים מסונכרנים עם העמדות.",count:e=>e===1?"התנגשות אחת":`${e} התנגשויות`,kind:{person:"אדם",removal:"מחיקה ממתינה",revocation:"ביטול הרשאה",other:"אחר"},state:{conflict:"התנגשות",error:"שגיאה",pending:"ממתין",delete_pending:"מחיקה ממתינה",other:"אחר"},person:"אדם",station:"עמדה",hiddenPerson:"אדם (השם מוסתר לפי ההרשאות)",noReview:"מתעדכן עם סנכרון האדם; אין לו פתרון נפרד",review:"בדיקה",lastError:"שגיאה אחרונה"},drawer:{heading:"בדיקת התנגשות",reading:"קורא את הרשומה מהעמדה…",intro:"הבדיקה קוראת את הרשומה מהעמדה ומשווה אותה לרשומה המנוהלת. דבר לא משתנה עד שמאשרים.",reviewed:"נבדק",expires:e=>e>0?`הבדיקה בתוקף עוד ${Math.ceil(e/60)} דקות`:"הבדיקה פגה - יש לבדוק שוב",managed:"הרשומה המנוהלת",device:"בעמדה",missing:"לא קיים",differences:"שדות שונים",noDifferences:"אין הבדלים בשדות שנבדקו",plan:"מה ישתנה בעמדה אם הרשומה המנוהלת תוחל",affected:"עמדות שהאדם משויך אליהן",affectedHint:"עדכון הרשומה לפי העמדה משנה את הרשומה שכל העמדות האלה יקבלו.",unverified:"הקוד האישי לא נבדק: העמדה לא מדווחת עליו.",choose:"מה לעשות",notAllowed:"לא אפשרי כרגע",again:"בדיקה מחדש",close:"סגירה",field:{presence:"קיום ברשומה",display_name:"שם",user_type:"סוג משתמש",validity:"תוקף",door_rights:"דלתות",pin:"קוד אישי",schedule:"לוח זמנים",privileged:"הרשאת ניהול בעמדה",other_credentials:"אמצעי זיהוי אחרים",cards:"כרטיסים",other:"שדה אחר"},planPerson:{create:"האדם ייווצר בעמדה",delete:"האדם יוסר מהעמדה",update:"פרטי האדם יעודכנו",none:"פרטי האדם לא ישתנו",unknown:"לא ידוע"},planPin:{none:"הקוד האישי לא ישתנה",remove:"הקוד האישי יוסר",set:"יוגדר קוד אישי",change:"הקוד האישי יוחלף",unknown:"לא ידוע"},cards:(e,t,i)=>`כרטיסים: ${e} יתווספו, ${t} יוסרו, ${i} יעודכנו`,side:{name:"שם",validity:"תוקף",doors:"דלתות",pin:"קוד אישי",cards:"כרטיסים",yes:"מוגדר",no:"לא מוגדר",unknown:"לא ידוע",always:"ללא הגבלה"}},direction:{central:{label:"להחיל את הרשומה המנוהלת על העמדה",hint:"העמדה תסונכרן מחדש לפי הרשומה המנוהלת. מה שנמצא בעמדה ושונה ממנה יוחלף."},device:{label:"לעדכן את הרשומה לפי העמדה",hint:"הרשומה המנוהלת תקבל את הפרטים שבעמדה, וכל העמדות שהאדם משויך אליהן יקבלו אותם בסנכרון הבא."},delete:{label:"להמשיך במחיקה מהעמדה",hint:"האדם נמחק מהמערכת; העמדה הזו עוד מחזיקה אותו. האישור ממשיך את המחיקה ממנה בסנכרון הבא."}},reason:{deletion_not_pending:"אין מחיקה ממתינה לאדם הזה",ownership_missing:"האדם לא שויך לעמדה הזו",user_not_found:"האדם כבר לא קיים",device_user_missing:"האדם לא נמצא בעמדה",unknown:"הסיבה לא ידועה"},confirm:{heading:"אישור פתרון התנגשות",body:"הפעולה תישלח פעם אחת. המערכת תבדוק שוב את הרשומה בעמדה לפני השינוי; אם משהו השתנה מאז הבדיקה - שום דבר לא ישתנה ותתבקשו לבדוק שוב.",ok:"אישור ושליחה",cancel:"ביטול"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"התקבל: הסנכרון של העמדה נכנס לתור ויתבצע בדקות הקרובות",completed:"בוצע",failed:"נדחה",not_sent:"לא נשלח",unknown:"נשלח, אך לא התקבלה תשובה ברורה - בדקו את הרשימה לפני שמנסים שוב",stale:"הרשומה השתנתה מאז הבדיקה - לא שונה דבר. בדקו שוב."},statusShort:{sending:"שולח",sent:"נשלח",acknowledged:"התקבל",completed:"בוצע",failed:"נדחה",not_sent:"לא נשלח",unknown:"לא ברור",stale:"השתנה"},alerts:{heading:"התראות עמדות",empty:"אין התראות פעילות.",showSnoozed:"להציג גם מושתקות",count:(e,t)=>`${e} פעילות · ${t} מושתקות`,kind:{offline:"העמדה לא מחוברת",sync_stalled:"הסנכרון תקוע",sync_conflict:"התנגשות סנכרון",sync_error:"שגיאת סנכרון",event_gap:"פער בזרם האירועים",clock_drift:"שעון העמדה סוטה",maintenance:"כל ההתראות של העמדה",other:"אחר"},severity:{error:"חמור",warning:"אזהרה"},since:"מאז",snoozedUntil:"מושתק עד",snooze:"השתקה",restore:"ביטול השתקה",stationSnooze:"השתקת כל העמדה (תחזוקה)",noAck:"התראה נסגרת מעצמה כשהמצב חוזר לתקין; אין לה אישור קבלה או סגירה ידנית.",durationLabel:"משך",reasonLabel:"סיבה",duration:{15:"15 דקות",60:"שעה",240:"4 שעות",1440:"יום",10080:"שבוע"},reasons:{planned_maintenance:"תחזוקה מתוכננת",network_work:"עבודות רשת",investigating:"בבדיקה"},confirmSnooze:"השתקת ההתראה",confirmRestore:"ביטול ההשתקה",confirmBody:"ההשתקה משנה רק את התצוגה וההתראות - לא את העמדה עצמה. היא נשלחת פעם אחת."},notify:{label:"להעביר התראות עמדות חדשות למרכז ההתראות",hint:"כבוי כברירת מחדל. כשמופעל: התראה אחת לכל עמדה וסוג, נסגרת כשההתראה מסתיימת או מושתקת. מי מקבל ובאיזה ערוץ - לפי הגדרות ההתראות, כולל שעות שקט.",on:"מופעל",off:"כבוי",noEdit:"שינוי דורש הרשאת מנהל מערכת."},feedDown:"אין חיבור פעיל למערכת הכניסה; הפעולות לא יישלחו עד שהחיבור יחזור."},C=j("en","i18n/wiskey-triage","en"),s=L(["en"])==="en"?C:A;q("i18n/wiskey-triage",{he:A,en:C});var le=Object.defineProperty,de=Object.getOwnPropertyDescriptor,c=(e,t,i,l)=>{for(var o=l>1?void 0:l?de(t,i):t,n=e.length-1,u;n>=0;n--)(u=e[n])&&(o=(l?u(t,i,o):u(o))||o);return l&&o&&le(t,i,o),o};const ce={sending:"unknown",sent:"unknown",acknowledged:"live",completed:"live",failed:"error",not_sent:"stale",unknown:"stale",stale:"stale"},x=4;let d=class extends U{constructor(){super(...arguments),this.mode="full",this.tab="conflicts",this.view=null,this.conflicts=null,this.alerts=null,this.alertCounts={active:0,snoozed:0},this.names={},this.zone=$,this.phase="loading",this.error="",this.conflictsError="",this.alertsError="",this.showSnoozed=!1,this.results={},this.reviewing=null,this.review=null,this.reviewError=null,this.reviewBusy=!1,this.asking=null,this.sending=!1,this.resolved=null,this.draft=null,this.alertBusy=!1,this.notifyBusy=!1,this.now=Date.now(),this.timer=0,this.seq=0}connectedCallback(){super.connectedCallback(),this.load(),this.timer=window.setInterval(()=>this.now=Date.now(),15e3)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}async load(){const e=++this.seq;this.phase=this.view?this.phase:"loading";try{const[t,i,l,o]=await Promise.allSettled([V(),M(),W({includeSuppressed:!0,limit:200}),Z()]);if(e!==this.seq)return;if(t.status==="rejected")throw t.reason;if(this.view=t.value,i.status==="fulfilled"?(this.conflicts=i.value.conflicts??[],this.conflictsError=i.value.conflicts?"":s.feedDown):(this.conflicts=null,this.conflictsError=h(i.reason)),l.status==="fulfilled"){const n=l.value.alerts;this.alerts=n?.items??[],this.alertCounts={active:n?.active_count??0,snoozed:n?.suppressed_count??0},this.alertsError=n?"":s.feedDown}else this.alerts=null,this.alertsError=h(l.reason);o.status==="fulfilled"&&(this.names=Object.fromEntries((o.value.stations??[]).map(n=>[n.id,n.name])),this.zone=o.value.default_zone??$),this.phase="ready",this.error=""}catch(t){if(e!==this.seq)return;this.phase="error",this.error=h(t)}}station(e){return e&&this.names[e]||e||"—"}time(e){return G(e,H(),this.zone)}async openReview(e){const t=b(e);if(!(!t||!e.person?.id)){this.reviewing=e,this.review=null,this.reviewError=null,this.resolved=null,this.asking=null,this.reviewBusy=!0;try{this.review=await Y(e.station_id,e.person.id,t)}catch(i){this.reviewError=v(i)}finally{this.reviewBusy=!1}}}closeReview(){this.reviewing=null,this.review=null,this.asking=null,this.reviewError=null,this.resolved&&this.load(),this.resolved=null}async resolve(e){const t=this.review,i=this.reviewing;if(!t||!i||this.sending)return;this.sending=!0;const l=y(i);this.results={...this.results,[l]:{status:"sending",code:null,message:"",retry_after_s:null}};let o;try{await ee(t.review_id,e),o={status:"acknowledged",code:null,message:"",retry_after_s:null}}catch(n){o=v(n)}this.results={...this.results,[l]:o},this.resolved=o,this.asking=null,this.sending=!1}renderConflicts(){const e=this.conflicts,t=!!this.view?.may_resolve,i=e&&this.mode==="compact"?e.slice(0,x):e;return a`<section class="wrap" data-wkt-conflicts>
      ${this.mode==="compact"?a`<div class="bar"><h4>${s.conflicts.heading}</h4><span class="muted">${e?s.conflicts.count(e.length):""}</span></div>`:r}
      ${this.conflictsError?a`<div class="err" role="alert">${this.conflictsError}</div>`:r}
      ${e===null?r:e.length===0?a`<div class="list"><div class="empty" data-wkt-empty>${s.conflicts.empty}</div></div>`:a`<div class="list">${i.map(l=>this.renderConflict(l,t))}</div>
              ${i.length<e.length?a`<a class="more" href="#/wiskey/conflicts" data-wkt-more>${s.openFull} (${e.length})</a>`:r}`}
    </section>`}renderConflict(e,t){const i=y(e),l=b(e),o=this.results[i],n=this.view?.recent?.conflicts?.[i],u=e.person?.display_name||(e.person?.id?s.conflicts.hiddenPerson:"—");return a`<div class="row" data-wkt-conflict=${i} data-kind=${e.kind}>
      <div class="main">
        <b>${u}</b>
        <span class="sub">${s.conflicts.kind[e.kind]??s.conflicts.kind.other}${e.person?.employee_no?a` · <bdi>${e.person.employee_no}</bdi>`:r}</span>
      </div>
      <div class="main">
        <span><bdi>${this.station(e.station_id)}</bdi></span>
        ${e.last_error?a`<span class="sub">${s.conflicts.lastError}: <code>${e.last_error}</code></span>`:r}
      </div>
      <sw-badge kind=${e.sync_state==="error"?"error":"stale"} label=${s.conflicts.state[e.sync_state]??s.conflicts.state.other}></sw-badge>
      <div class="acts">
        ${l&&t?a`<sw-button size="sm" icon="search" data-wkt-review ?disabled=${o?.status==="sending"} @click=${()=>this.openReview(e)}>${s.conflicts.review}</sw-button>`:l?r:a`<span class="sub">${s.conflicts.noReview}</span>`}
      </div>
      ${o?this.renderResult(o):n?this.renderResult({status:n.status,code:n.code,message:"",retry_after_s:null},n.at):r}
    </div>`}renderResult(e,t){return a`<div class="result" data-wkt-result=${e.status} role=${e.status==="failed"||e.status==="stale"?"alert":"status"}>
      <sw-badge kind=${ce[e.status]} label=${s.statusShort[e.status]??e.status}></sw-badge>
      <span>${e.message||s.status[e.status]}${e.code&&e.status!=="acknowledged"&&e.status!=="completed"?a` <code>${e.code}</code>`:r}${t?a` · <bdi>${this.time(t)}</bdi>`:r}</span>
    </div>`}side(e,t){const i=s.drawer.side;if(!e||!e.present)return s.drawer.missing;switch(t){case"name":return e.display_name??"—";case"validity":return e.validity.timed?`${_(e.validity.from)} – ${_(e.validity.until)}`:i.always;case"doors":return e.door_rights.length?e.door_rights.join(", "):"—";case"pin":return e.pin_configured===null?i.unknown:e.pin_configured?i.yes:i.no;case"cards":return String(e.card_count)}}renderReview(){const e=this.reviewing;if(!e)return r;const t=this.review,i=t?ae(t,this.now):0,l=new Set(t?.impact.differences??[]),o=(n,u,R)=>{const f=R.some(B=>l.has(B));return a`<span class=${f?"diff":""}>${n}</span><span class=${f?"diff":""}><bdi>${this.side(t.impact.central,u)}</bdi></span><span class=${f?"diff":""}><bdi>${this.side(t.impact.device,u)}</bdi></span>`};return a`<sw-drawer modal open heading=${s.drawer.heading} subheading=${`${e.person?.display_name||s.conflicts.hiddenPerson} · ${this.station(e.station_id)}`} data-wkt-drawer
      @close=${n=>n.target===n.currentTarget&&this.closeReview()}>
      <div class="rv">
        ${this.reviewBusy?a`<div class="note" data-wkt-reading aria-busy="true">${s.drawer.reading}</div>`:a`<div class="muted">${s.drawer.intro}</div>`}
        ${this.reviewError?a`<div class="err" role="alert" data-wkt-review-error>${this.reviewError.message||s.status[this.reviewError.status]} ${this.reviewError.code?a`<code>${this.reviewError.code}</code>`:r}</div>`:r}
        ${t?a`<div class="muted" data-wkt-reviewed>${s.drawer.reviewed}: <bdi>${this.time(t.impact.reviewed_at)}</bdi> · <span data-wkt-ttl>${s.drawer.expires(i)}</span></div>
              ${t.kind==="person"?a`<div class="cmp" data-wkt-compare>
                    <span class="h"></span><span class="h">${s.drawer.managed}</span><span class="h">${s.drawer.device}</span>
                    ${o(s.drawer.side.name,"name",["display_name","presence"])} ${o(s.drawer.side.validity,"validity",["validity"])}
                    ${o(s.drawer.side.doors,"doors",["door_rights"])} ${o(s.drawer.side.pin,"pin",["pin"])} ${o(s.drawer.side.cards,"cards",["cards"])}
                  </div>`:a`<div class="cmp" data-wkt-compare><span class="h"></span><span class="h">${s.drawer.device}</span><span class="h"></span>
                    ${["name","doors","cards"].map(n=>a`<span>${s.drawer.side[n]}</span><span><bdi>${this.side(t.impact.device,n)}</bdi></span><span></span>`)}</div>`}
              <div>
                <b>${s.drawer.differences}</b>
                <div class="chips" data-wkt-diffs>${t.impact.differences.length?t.impact.differences.map(n=>a`<span class="chip">${s.drawer.field[n]??s.drawer.field.other}</span>`):a`<span class="muted">${s.drawer.noDifferences}</span>`}</div>
              </div>
              ${t.impact.plan&&t.kind==="person"?a`<div data-wkt-plan><b>${s.drawer.plan}</b><ul>
                    <li>${s.drawer.planPerson[t.impact.plan.person??"unknown"]??s.drawer.planPerson.unknown}</li>
                    <li>${s.drawer.planPin[t.impact.plan.pin??"unknown"]??s.drawer.planPin.unknown}</li>
                    <li>${s.drawer.cards(t.impact.plan.cards_add??0,t.impact.plan.cards_remove??0,t.impact.plan.cards_update??0)}</li>
                  </ul></div>`:r}
              ${t.impact.affected_stations.length?a`<div data-wkt-affected><b>${s.drawer.affected}</b><div class="chips">${t.impact.affected_stations.map(n=>a`<span class="chip"><bdi>${this.station(n)}</bdi></span>`)}</div>
                    ${t.kind==="person"?a`<div class="muted">${s.drawer.affectedHint}</div>`:r}</div>`:r}
              ${t.impact.unverified_fields.includes("pin")?a`<div class="note">${s.drawer.unverified}</div>`:r}
              <div><b>${s.drawer.choose}</b></div>
              ${ie(t).map(n=>a`<div class="choice" data-wkt-choice=${n.direction} data-allowed=${String(n.allowed)}>
                  <b>${s.direction[n.direction].label}</b>
                  <span class="muted">${s.direction[n.direction].hint}</span>
                  ${n.allowed?a`<div><sw-button size="sm" variant=${n.direction==="central"?"primary":"secondary"} data-wkt-choose=${n.direction}
                        ?disabled=${this.sending||i<=0||!!this.resolved} @click=${()=>this.asking=n.direction}>${s.direction[n.direction].label}</sw-button></div>`:a`<span class="why">${s.drawer.notAllowed}: ${s.reason[n.reason??"unknown"]??n.reason}</span>`}
                </div>`)}
              ${this.resolved?a`<div data-wkt-resolved>${this.renderResult(this.resolved)}</div>`:r}`:r}
        ${this.renderConfirm()}
      </div>
      <sw-button slot="footer" variant="ghost" data-wkt-close @click=${()=>this.closeReview()}>${s.drawer.close}</sw-button>
      ${!this.reviewBusy&&(this.reviewError||this.resolved||t&&i<=0)?a`<sw-button slot="footer" icon="refresh" data-wkt-again @click=${()=>this.openReview(e)}>${s.drawer.again}</sw-button>`:r}
    </sw-drawer>`}renderConfirm(){const e=this.asking;return e?a`<sw-dialog open heading=${s.confirm.heading} data-wkt-confirm @close=${t=>{t.stopPropagation(),this.asking=null}}>
      <div class="dlg">
        <b>${s.direction[e].label}</b>
        <div>${s.direction[e].hint}</div>
        <div class="muted">${s.confirm.body}</div>
      </div>
      <div class="dfoot">
        <sw-button variant="ghost" @click=${()=>this.asking=null}>${s.confirm.cancel}</sw-button>
        <sw-button variant=${e==="central"?"primary":"danger"} data-wkt-confirm-ok ?disabled=${this.sending} @click=${()=>this.resolve(e)}>${this.sending?s.status.sending:s.confirm.ok}</sw-button>
      </div>
    </sw-dialog>`:r}visibleAlerts(){const e=this.alerts??[];return this.mode==="full"&&this.showSnoozed?e:e.filter(t=>!t.suppressed)}ask(e,t,i=t==="restore"?re(e):e.kind){this.draft={alert:e,action:t,kind:i,duration:60,reason:i==="maintenance"?"planned_maintenance":"investigating"}}async sendAlert(){const e=this.draft;if(!e||this.alertBusy||!e.alert.station_id)return;this.alertBusy=!0;const t=k(e.alert);this.results={...this.results,[t]:{status:"sending",code:null,message:"",retry_after_s:null}};let i;try{await se(e.alert.station_id,e.kind,e.action,e.duration,e.reason),i={status:"completed",code:null,message:"",retry_after_s:null}}catch(l){i=v(l)}this.results={...this.results,[t]:i},this.draft=null,this.alertBusy=!1,(i.status==="completed"||i.status==="stale")&&this.load()}renderAlerts(){const e=!!this.view?.may_act_alerts,t=this.visibleAlerts(),i=this.mode==="compact"?t.slice(0,x):t;return a`<section class="wrap" data-wkt-alerts>
      <div class="bar">
        ${this.mode==="compact"?a`<h4>${s.alerts.heading}</h4>`:r}
        <span class="muted" data-wkt-alert-count>${s.alerts.count(this.alertCounts.active,this.alertCounts.snoozed)}</span>
        <span class="sp"></span>
        ${this.mode==="full"?a`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${s.alerts.showSnoozed} data-wkt-show-snoozed .checked=${this.showSnoozed} @change=${l=>this.showSnoozed=g(l)}></sw-toggle>${s.alerts.showSnoozed}</label>`:r}
      </div>
      ${this.alertsError?a`<div class="err" role="alert">${this.alertsError}</div>`:r}
      ${this.alerts===null?r:i.length===0?a`<div class="list"><div class="empty" data-wkt-empty>${s.alerts.empty}</div></div>`:a`<div class="list">${i.map(l=>this.renderAlert(l,e))}</div>
              ${i.length<t.length?a`<a class="more" href="#/wiskey/alerts" data-wkt-more>${s.openFull} (${t.length})</a>`:r}`}
      ${this.mode==="full"?a`<div class="note" data-wkt-no-ack>${s.alerts.noAck}</div>`:r}
    </section>`}renderAlert(e,t){const i=k(e),l=this.results[i],o=this.view?.recent?.alerts?.[i];return a`<div class="row" data-wkt-alert=${e.id} data-suppressed=${String(e.suppressed)}>
      <div class="main">
        <b>${s.alerts.kind[e.kind]??s.alerts.kind.other}</b>
        <span class="sub"><bdi>${e.station_name||this.station(e.station_id)}</bdi></span>
      </div>
      <div class="main">
        ${e.suppressed&&e.suppression?a`<span>${s.alerts.snoozedUntil} <bdi>${this.time(e.suppression.until)}</bdi></span><span class="sub">${s.alerts.reasons[e.suppression.reason??""]??""}${e.suppression.kind==="maintenance"?` · ${s.alerts.kind.maintenance}`:""}</span>`:a`<span class="sub">${s.alerts.since} <bdi>${this.time(e.observed_since)}</bdi></span>`}
      </div>
      <sw-badge kind=${e.suppressed?"neutral":e.severity==="error"?"error":"stale"} label=${e.suppressed?s.alerts.snooze:s.alerts.severity[e.severity]??e.severity}></sw-badge>
      <div class="acts">
        ${t&&e.station_id?ne(e).map(n=>n==="snooze"?a`<sw-button size="sm" icon="bellOff" data-wkt-snooze ?disabled=${l?.status==="sending"} @click=${()=>this.ask(e,"snooze")}>${s.alerts.snooze}</sw-button>`:a`<sw-button size="sm" icon="bell" data-wkt-restore ?disabled=${l?.status==="sending"} @click=${()=>this.ask(e,"restore")}>${s.alerts.restore}</sw-button>`):r}
      </div>
      ${l?this.renderResult(l):o?this.renderResult({status:o.status,code:o.code,message:"",retry_after_s:null},o.at):r}
    </div>`}renderAlertDialog(){const e=this.draft;if(!e)return r;const t=e.action==="snooze";return a`<sw-dialog open heading=${t?s.alerts.confirmSnooze:s.alerts.confirmRestore} data-wkt-alert-dialog @close=${i=>{i.stopPropagation(),this.draft=null}}>
      <div class="dlg">
        <b>${s.alerts.kind[e.alert.kind]??e.alert.kind} · <bdi>${e.alert.station_name||this.station(e.alert.station_id)}</bdi></b>
        ${t?a`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${s.alerts.stationSnooze} data-wkt-whole-station .checked=${e.kind==="maintenance"}
                @change=${i=>this.draft={...e,kind:g(i)?"maintenance":e.alert.kind}}></sw-toggle>${s.alerts.stationSnooze}</label>
              <div class="f"><span>${s.alerts.durationLabel}</span>
                <sw-dropdown block data-wkt-duration label=${s.alerts.durationLabel} .value=${String(e.duration)}
                  .items=${X.map(i=>({id:String(i),label:s.alerts.duration[i]}))}
                  @change=${i=>this.draft={...e,duration:Number(i.detail.id)}}></sw-dropdown></div>
              <div class="f"><span>${s.alerts.reasonLabel}</span>
                <sw-dropdown block data-wkt-reason label=${s.alerts.reasonLabel} .value=${e.reason}
                  .items=${J.map(i=>({id:i,label:s.alerts.reasons[i]}))}
                  @change=${i=>this.draft={...e,reason:i.detail.id}}></sw-dropdown></div>`:e.kind==="maintenance"?a`<div>${s.alerts.kind.maintenance}</div>`:r}
        <div class="muted">${s.alerts.confirmBody}</div>
      </div>
      <div class="dfoot">
        <sw-button variant="ghost" @click=${()=>this.draft=null}>${s.confirm.cancel}</sw-button>
        <sw-button variant="primary" data-wkt-alert-ok ?disabled=${this.alertBusy} @click=${()=>this.sendAlert()}>${this.alertBusy?s.status.sending:t?s.alerts.snooze:s.alerts.restore}</sw-button>
      </div>
    </sw-dialog>`}async setNotify(e){this.notifyBusy=!0;try{const t=await te(e);this.view&&(this.view={...this.view,notify:t.notify})}catch(t){this.error=h(t)}finally{this.notifyBusy=!1}}renderNotify(){const e=this.view?.notify;return!e||this.mode!=="full"?r:a`<div class="notify" data-wkt-notify=${e.enabled?"on":"off"}>
      <div class="main"><b>${s.notify.label}</b><span class="sub">${s.notify.hint}</span>${e.can_edit?r:a`<span class="sub">${s.notify.noEdit}</span>`}</div>
      ${this.renderNotifyPick(e.enabled,!e.can_edit||this.notifyBusy)}
    </div>`}renderNotifyPick(e,t){return a`<sw-dropdown data-wkt-notify-select label=${s.notify.label} .value=${e?"on":"off"}
      .items=${[{id:"off",label:s.notify.off},{id:"on",label:s.notify.on}]}
      ?inert=${t} aria-disabled=${t?"true":r} style=${t?"opacity: var(--sw-disabled-opacity)":""}
      @change=${i=>this.setNotify(i.detail.id==="on")}></sw-dropdown>`}render(){if(this.phase==="loading"&&!this.view)return a`<div class="note" data-wkt-loading aria-busy="true">${s.loading}</div>`;if(this.phase==="error"&&!this.view)return a`<div class="err" role="alert" data-wkt-error>${this.error}</div>`;const e=!!this.view?.may_resolve,t=this.conflicts?.length??0,i=this.alertCounts.active;return a`<div class="wrap" data-wkt-panel=${this.mode}>
      <div class="bar">
        ${this.mode==="full"?a`<div class="tabs" role="tablist">
              <button role="tab" data-wkt-tab="conflicts" aria-selected=${String(this.tab==="conflicts")} @click=${()=>this.switchTab("conflicts")}>${s.tabs.conflicts}<span class="n">${t}</span></button>
              <button role="tab" data-wkt-tab="alerts" aria-selected=${String(this.tab==="alerts")} @click=${()=>this.switchTab("alerts")}>${s.tabs.alerts}<span class="n">${i}</span></button>
            </div>`:r}
        <span class="sp"></span>
        ${this.mode==="compact"?a`<a href="#/wiskey/conflicts" data-wkt-open-full>${s.openFull}</a>`:r}
        <sw-button size="sm" variant="ghost" icon="refresh" data-wkt-refresh @click=${()=>this.load()}>${s.refresh}</sw-button>
      </div>
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:r}
      ${!e&&this.view?a`<div class="note" data-wkt-readonly>${s.readOnly}</div>`:r}
      ${this.mode==="compact"?a`${this.renderConflicts()} ${this.renderAlerts()}`:this.tab==="alerts"?a`${this.renderAlerts()} ${this.renderNotify()}`:this.renderConflicts()}
      ${this.renderReview()} ${this.renderAlertDialog()}
    </div>`}switchTab(e){e!==this.tab&&(this.tab=e,this.dispatchEvent(new CustomEvent("wkt-tab",{detail:{tab:e},bubbles:!0,composed:!0})))}};d.styles=I`
    :host {
      display: block;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3, 12px);
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .bar .sp {
      flex: 1 1 auto;
    }
    .tabs {
      display: inline-flex;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      overflow: hidden;
    }
    .tabs button {
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 6px 14px;
      min-block-size: 36px;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .tabs button[aria-selected='true'] {
      background: var(--sw-accent-soft);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .tabs .n {
      margin-inline-start: 6px;
      padding: 0 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    ${F}
    .note {
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
    }
    .err {
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
    .list {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 6px 12px;
      padding: 10px 14px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      min-block-size: 52px;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .main b {
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .acts {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .result {
      grid-column: 1 / -1;
      display: flex;
      gap: 8px;
      align-items: flex-start;
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
    }
    .empty {
      padding: 14px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    code,
    bdi {
      unicode-bidi: isolate;
    }
    code {
      font-family: var(--sw-font-mono, monospace);
      font-size: var(--sw-fs-xs);
      direction: ltr;
    }
    .more {
      align-self: flex-start;
      font-size: var(--sw-fs-sm);
    }
    label.chk {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-sm);
      min-block-size: 36px;
    }
    .notify {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4px 12px;
      align-items: center;
      padding: 10px 14px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      font-size: var(--sw-fs-sm);
    }
    /* the review drawer */
    .rv {
      display: flex;
      flex-direction: column;
      gap: 14px;
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
    }
    .cmp {
      display: grid;
      grid-template-columns: minmax(90px, auto) 1fr 1fr;
      gap: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      overflow: hidden;
    }
    .cmp > span {
      padding: 6px 8px;
      border-block-end: 1px solid var(--sw-border);
      overflow-wrap: anywhere;
    }
    .cmp > .h {
      background: var(--sw-surface-2);
      font-weight: var(--sw-fw-semibold);
    }
    .cmp > .diff {
      background: var(--sw-warning-soft);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
    }
    .choice {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .choice[data-allowed='false'] {
      opacity: 0.7;
    }
    .choice .why {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    ul {
      margin: 0;
      padding-inline-start: 18px;
    }
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .dlg label:not(.chk),
    .dlg div.f {
      display: grid;
      gap: 4px;
    }
    .dfoot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding-block-start: 12px;
      flex-wrap: wrap;
    }
    @media (max-width: 767px) {
      .row {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .row .acts {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
      .cmp {
        grid-template-columns: minmax(70px, auto) 1fr 1fr;
        font-size: var(--sw-fs-xs);
      }
      .notify {
        grid-template-columns: 1fr;
      }
    }
  `;c([E()],d.prototype,"mode",2);c([E()],d.prototype,"tab",2);c([p()],d.prototype,"view",2);c([p()],d.prototype,"conflicts",2);c([p()],d.prototype,"alerts",2);c([p()],d.prototype,"alertCounts",2);c([p()],d.prototype,"names",2);c([p()],d.prototype,"zone",2);c([p()],d.prototype,"phase",2);c([p()],d.prototype,"error",2);c([p()],d.prototype,"conflictsError",2);c([p()],d.prototype,"alertsError",2);c([p()],d.prototype,"showSnoozed",2);c([p()],d.prototype,"results",2);c([p()],d.prototype,"reviewing",2);c([p()],d.prototype,"review",2);c([p()],d.prototype,"reviewError",2);c([p()],d.prototype,"reviewBusy",2);c([p()],d.prototype,"asking",2);c([p()],d.prototype,"sending",2);c([p()],d.prototype,"resolved",2);c([p()],d.prototype,"draft",2);c([p()],d.prototype,"alertBusy",2);c([p()],d.prototype,"notifyBusy",2);c([p()],d.prototype,"now",2);d=c([K("wk-triage-panel")],d);export{he as m,s as t};
