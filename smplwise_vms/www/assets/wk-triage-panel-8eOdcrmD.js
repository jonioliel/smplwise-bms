import{L as A,au as m,R as C,cC as _,av as B,am as P,i as T,n as z,r as p,a as N,ak as h,p as r,q as a,x as O}from"./index-C5kZ9jiu.js";import{g as D,a as L,b as j}from"./access-status-cd2fZWka.js";import{U as $,c as I}from"./wiskey-format-BJBSoZNO.js";const q=[15,60,240,1440,10080],U=["planned_maintenance","network_work","investigating"],F=15e3,E=()=>({client_request_id:P(),expires_at:new Date(_()+F).toISOString().replace(/\.\d{3}Z$/,"Z")}),w=encodeURIComponent,K=()=>A("access-control/triage"),M=(e,s,i)=>m(`access-control/stations/${w(e)}/conflicts/${w(s)}/review`,{kind:i}),Z=(e,s)=>m(`access-control/triage/reviews/${w(e)}/resolve`,{direction:s,confirmed:!0,...E()}),H=(e,s,i,d,o)=>m(`access-control/stations/${w(e)}/alerts/${w(s)}/${i}`,{confirmed:!0,...i==="snooze"?{duration_minutes:d,reason:o}:{},...E()}),W=e=>B("access-control/triage/settings",{notify:e});function v(e){if(e instanceof C){const s=e.body?.details??{},i=String(s.outcome??"");let d=i==="refused"?"failed":i==="not_sent"?"not_sent":i==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown";e.code==="triage_stale"&&(d="stale");const o=Number(s.retry_after_s);return{status:d,code:String(s.wiskey_code??e.code??"")||null,message:e.body?.user_message||"",retry_after_s:Number.isFinite(o)&&o>=0?o:null}}return{status:"unknown",code:"network",message:"",retry_after_s:null}}function g(e){return e.kind==="person"?"person":e.kind==="removal"?"removal":null}function G(e){return(e.kind==="removal"?["delete"]:["central","device"]).map(i=>({direction:i,allowed:!!e.impact.actions?.[i]?.allowed,reason:e.impact.actions?.[i]?.reason??null}))}function J(e,s=_()){return Math.floor((Date.parse(e.expires_at)-s)/1e3)}const b=e=>`${e.station_id}:${e.person?.id??""}`,y=e=>`${e.station_id??""}:${e.kind}`;function Q(e){return e.suppressed?e.suppression?.kind?["restore"]:[]:["snooze"]}function V(e){return e.suppression?.kind||e.kind}const X=["access.admin.read","access.stations.manage","system.configure"];function ne(e){return X.some(s=>e(s))}function k(e){if(!e)return"…";const s=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(e);return s?`${Number(s[3])}.${Number(s[2])}.${s[1]} ${s[4]}:${s[5]}`:e}const t={title:"התנגשויות והתראות עמדות",subtitle:"מה שמסומן באדום במצב המערכת: התנגשויות סנכרון של אנשים, מחיקות שממתינות לבדיקה והתראות עמדות. כל החלטה עוברת בדיקה ואישור.",link:"התנגשויות והתראות",tabs:{conflicts:"התנגשויות",alerts:"התראות"},openFull:"למסך המלא",refresh:"רענון",loading:"טוען…",readOnly:"צפייה בלבד: פתרון התנגשויות וטיפול בהתראות דורשים הרשאת ניהול עמדות בכל המערכת או הרשאת מנהל מערכת.",conflicts:{heading:"התנגשויות סנכרון",empty:"אין התנגשויות. כל האנשים מסונכרנים עם העמדות.",count:e=>e===1?"התנגשות אחת":`${e} התנגשויות`,kind:{person:"אדם",removal:"מחיקה ממתינה",revocation:"ביטול הרשאה",other:"אחר"},state:{conflict:"התנגשות",error:"שגיאה",pending:"ממתין",delete_pending:"מחיקה ממתינה",other:"אחר"},person:"אדם",station:"עמדה",hiddenPerson:"אדם (השם מוסתר לפי ההרשאות)",noReview:"מתעדכן עם סנכרון האדם; אין לו פתרון נפרד",review:"בדיקה",lastError:"שגיאה אחרונה"},drawer:{heading:"בדיקת התנגשות",reading:"קורא את הרשומה מהעמדה…",intro:"הבדיקה קוראת את הרשומה מהעמדה ומשווה אותה לרשומה המנוהלת. דבר לא משתנה עד שמאשרים.",reviewed:"נבדק",expires:e=>e>0?`הבדיקה בתוקף עוד ${Math.ceil(e/60)} דקות`:"הבדיקה פגה - יש לבדוק שוב",managed:"הרשומה המנוהלת",device:"בעמדה",missing:"לא קיים",differences:"שדות שונים",noDifferences:"אין הבדלים בשדות שנבדקו",plan:"מה ישתנה בעמדה אם הרשומה המנוהלת תוחל",affected:"עמדות שהאדם משויך אליהן",affectedHint:"עדכון הרשומה לפי העמדה משנה את הרשומה שכל העמדות האלה יקבלו.",unverified:"הקוד האישי לא נבדק: העמדה לא מדווחת עליו.",choose:"מה לעשות",notAllowed:"לא אפשרי כרגע",again:"בדיקה מחדש",close:"סגירה",field:{presence:"קיום ברשומה",display_name:"שם",user_type:"סוג משתמש",validity:"תוקף",door_rights:"דלתות",pin:"קוד אישי",schedule:"לוח זמנים",privileged:"הרשאת ניהול בעמדה",other_credentials:"אמצעי זיהוי אחרים",cards:"כרטיסים",other:"שדה אחר"},planPerson:{create:"האדם ייווצר בעמדה",delete:"האדם יוסר מהעמדה",update:"פרטי האדם יעודכנו",none:"פרטי האדם לא ישתנו",unknown:"לא ידוע"},planPin:{none:"הקוד האישי לא ישתנה",remove:"הקוד האישי יוסר",set:"יוגדר קוד אישי",change:"הקוד האישי יוחלף",unknown:"לא ידוע"},cards:(e,s,i)=>`כרטיסים: ${e} יתווספו, ${s} יוסרו, ${i} יעודכנו`,side:{name:"שם",validity:"תוקף",doors:"דלתות",pin:"קוד אישי",cards:"כרטיסים",yes:"מוגדר",no:"לא מוגדר",unknown:"לא ידוע",always:"ללא הגבלה"}},direction:{central:{label:"להחיל את הרשומה המנוהלת על העמדה",hint:"העמדה תסונכרן מחדש לפי הרשומה המנוהלת. מה שנמצא בעמדה ושונה ממנה יוחלף."},device:{label:"לעדכן את הרשומה לפי העמדה",hint:"הרשומה המנוהלת תקבל את הפרטים שבעמדה, וכל העמדות שהאדם משויך אליהן יקבלו אותם בסנכרון הבא."},delete:{label:"להמשיך במחיקה מהעמדה",hint:"האדם נמחק מהמערכת; העמדה הזו עוד מחזיקה אותו. האישור ממשיך את המחיקה ממנה בסנכרון הבא."}},reason:{deletion_not_pending:"אין מחיקה ממתינה לאדם הזה",ownership_missing:"האדם לא שויך לעמדה הזו",user_not_found:"האדם כבר לא קיים",device_user_missing:"האדם לא נמצא בעמדה",unknown:"הסיבה לא ידועה"},confirm:{heading:"אישור פתרון התנגשות",body:"הפעולה תישלח פעם אחת. המערכת תבדוק שוב את הרשומה בעמדה לפני השינוי; אם משהו השתנה מאז הבדיקה - שום דבר לא ישתנה ותתבקשו לבדוק שוב.",ok:"אישור ושליחה",cancel:"ביטול"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"התקבל: הסנכרון של העמדה נכנס לתור ויתבצע בדקות הקרובות",completed:"בוצע",failed:"נדחה",not_sent:"לא נשלח",unknown:"נשלח, אך לא התקבלה תשובה ברורה - בדקו את הרשימה לפני שמנסים שוב",stale:"הרשומה השתנתה מאז הבדיקה - לא שונה דבר. בדקו שוב."},statusShort:{sending:"שולח",sent:"נשלח",acknowledged:"התקבל",completed:"בוצע",failed:"נדחה",not_sent:"לא נשלח",unknown:"לא ברור",stale:"השתנה"},alerts:{heading:"התראות עמדות",empty:"אין התראות פעילות.",showSnoozed:"להציג גם מושתקות",count:(e,s)=>`${e} פעילות · ${s} מושתקות`,kind:{offline:"העמדה לא מחוברת",sync_stalled:"הסנכרון תקוע",sync_conflict:"התנגשות סנכרון",sync_error:"שגיאת סנכרון",event_gap:"פער בזרם האירועים",clock_drift:"שעון העמדה סוטה",maintenance:"כל ההתראות של העמדה",other:"אחר"},severity:{error:"חמור",warning:"אזהרה"},since:"מאז",snoozedUntil:"מושתק עד",snooze:"השתקה",restore:"ביטול השתקה",stationSnooze:"השתקת כל העמדה (תחזוקה)",noAck:"התראה נסגרת מעצמה כשהמצב חוזר לתקין; אין לה אישור קבלה או סגירה ידנית.",durationLabel:"משך",reasonLabel:"סיבה",duration:{15:"15 דקות",60:"שעה",240:"4 שעות",1440:"יום",10080:"שבוע"},reasons:{planned_maintenance:"תחזוקה מתוכננת",network_work:"עבודות רשת",investigating:"בבדיקה"},confirmSnooze:"השתקת ההתראה",confirmRestore:"ביטול ההשתקה",confirmBody:"ההשתקה משנה רק את התצוגה וההתראות - לא את העמדה עצמה. היא נשלחת פעם אחת."},notify:{label:"להעביר התראות עמדות חדשות למרכז ההתראות",hint:"כבוי כברירת מחדל. כשמופעל: התראה אחת לכל עמדה וסוג, נסגרת כשההתראה מסתיימת או מושתקת. מי מקבל ובאיזה ערוץ - לפי הגדרות ההתראות, כולל שעות שקט.",on:"מופעל",off:"כבוי",noEdit:"שינוי דורש הרשאת מנהל מערכת."},feedDown:"אין חיבור פעיל למערכת הכניסה; הפעולות לא יישלחו עד שהחיבור יחזור."};var Y=Object.defineProperty,ee=Object.getOwnPropertyDescriptor,c=(e,s,i,d)=>{for(var o=d>1?void 0:d?ee(s,i):s,n=e.length-1,u;n>=0;n--)(u=e[n])&&(o=(d?u(s,i,o):u(o))||o);return d&&o&&Y(s,i,o),o};const se={sending:"unknown",sent:"unknown",acknowledged:"live",completed:"live",failed:"error",not_sent:"stale",unknown:"stale",stale:"stale"},x=4;let l=class extends N{constructor(){super(...arguments),this.mode="full",this.tab="conflicts",this.view=null,this.conflicts=null,this.alerts=null,this.alertCounts={active:0,snoozed:0},this.names={},this.zone=$,this.phase="loading",this.error="",this.conflictsError="",this.alertsError="",this.showSnoozed=!1,this.results={},this.reviewing=null,this.review=null,this.reviewError=null,this.reviewBusy=!1,this.asking=null,this.sending=!1,this.resolved=null,this.draft=null,this.alertBusy=!1,this.notifyBusy=!1,this.now=Date.now(),this.timer=0,this.seq=0}connectedCallback(){super.connectedCallback(),this.load(),this.timer=window.setInterval(()=>this.now=Date.now(),15e3)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}async load(){const e=++this.seq;this.phase=this.view?this.phase:"loading";try{const[s,i,d,o]=await Promise.allSettled([K(),D(),L({includeSuppressed:!0,limit:200}),j()]);if(e!==this.seq)return;if(s.status==="rejected")throw s.reason;if(this.view=s.value,i.status==="fulfilled"?(this.conflicts=i.value.conflicts??[],this.conflictsError=i.value.conflicts?"":t.feedDown):(this.conflicts=null,this.conflictsError=h(i.reason)),d.status==="fulfilled"){const n=d.value.alerts;this.alerts=n?.items??[],this.alertCounts={active:n?.active_count??0,snoozed:n?.suppressed_count??0},this.alertsError=n?"":t.feedDown}else this.alerts=null,this.alertsError=h(d.reason);o.status==="fulfilled"&&(this.names=Object.fromEntries((o.value.stations??[]).map(n=>[n.id,n.name])),this.zone=o.value.default_zone??$),this.phase="ready",this.error=""}catch(s){if(e!==this.seq)return;this.phase="error",this.error=h(s)}}station(e){return e&&this.names[e]||e||"—"}time(e){return I(e,"he-IL",this.zone)}async openReview(e){const s=g(e);if(!(!s||!e.person?.id)){this.reviewing=e,this.review=null,this.reviewError=null,this.resolved=null,this.asking=null,this.reviewBusy=!0;try{this.review=await M(e.station_id,e.person.id,s)}catch(i){this.reviewError=v(i)}finally{this.reviewBusy=!1}}}closeReview(){this.reviewing=null,this.review=null,this.asking=null,this.reviewError=null,this.resolved&&this.load(),this.resolved=null}async resolve(e){const s=this.review,i=this.reviewing;if(!s||!i||this.sending)return;this.sending=!0;const d=b(i);this.results={...this.results,[d]:{status:"sending",code:null,message:"",retry_after_s:null}};let o;try{await Z(s.review_id,e),o={status:"acknowledged",code:null,message:"",retry_after_s:null}}catch(n){o=v(n)}this.results={...this.results,[d]:o},this.resolved=o,this.asking=null,this.sending=!1}renderConflicts(){const e=this.conflicts,s=!!this.view?.may_resolve,i=e&&this.mode==="compact"?e.slice(0,x):e;return a`<section class="wrap" data-wkt-conflicts>
      ${this.mode==="compact"?a`<div class="bar"><h4>${t.conflicts.heading}</h4><span class="muted">${e?t.conflicts.count(e.length):""}</span></div>`:r}
      ${this.conflictsError?a`<div class="err" role="alert">${this.conflictsError}</div>`:r}
      ${e===null?r:e.length===0?a`<div class="list"><div class="empty" data-wkt-empty>${t.conflicts.empty}</div></div>`:a`<div class="list">${i.map(d=>this.renderConflict(d,s))}</div>
              ${i.length<e.length?a`<a class="more" href="#/wiskey/conflicts" data-wkt-more>${t.openFull} (${e.length})</a>`:r}`}
    </section>`}renderConflict(e,s){const i=b(e),d=g(e),o=this.results[i],n=this.view?.recent?.conflicts?.[i],u=e.person?.display_name||(e.person?.id?t.conflicts.hiddenPerson:"—");return a`<div class="row" data-wkt-conflict=${i} data-kind=${e.kind}>
      <div class="main">
        <b>${u}</b>
        <span class="sub">${t.conflicts.kind[e.kind]??t.conflicts.kind.other}${e.person?.employee_no?a` · <bdi>${e.person.employee_no}</bdi>`:r}</span>
      </div>
      <div class="main">
        <span><bdi>${this.station(e.station_id)}</bdi></span>
        ${e.last_error?a`<span class="sub">${t.conflicts.lastError}: <code>${e.last_error}</code></span>`:r}
      </div>
      <sw-badge kind=${e.sync_state==="error"?"error":"stale"} label=${t.conflicts.state[e.sync_state]??t.conflicts.state.other}></sw-badge>
      <div class="acts">
        ${d&&s?a`<sw-button size="sm" icon="search" data-wkt-review ?disabled=${o?.status==="sending"} @click=${()=>this.openReview(e)}>${t.conflicts.review}</sw-button>`:d?r:a`<span class="sub">${t.conflicts.noReview}</span>`}
      </div>
      ${o?this.renderResult(o):n?this.renderResult({status:n.status,code:n.code,message:"",retry_after_s:null},n.at):r}
    </div>`}renderResult(e,s){return a`<div class="result" data-wkt-result=${e.status} role=${e.status==="failed"||e.status==="stale"?"alert":"status"}>
      <sw-badge kind=${se[e.status]} label=${t.statusShort[e.status]??e.status}></sw-badge>
      <span>${e.message||t.status[e.status]}${e.code&&e.status!=="acknowledged"&&e.status!=="completed"?a` <code>${e.code}</code>`:r}${s?a` · <bdi>${this.time(s)}</bdi>`:r}</span>
    </div>`}side(e,s){const i=t.drawer.side;if(!e||!e.present)return t.drawer.missing;switch(s){case"name":return e.display_name??"—";case"validity":return e.validity.timed?`${k(e.validity.from)} – ${k(e.validity.until)}`:i.always;case"doors":return e.door_rights.length?e.door_rights.join(", "):"—";case"pin":return e.pin_configured===null?i.unknown:e.pin_configured?i.yes:i.no;case"cards":return String(e.card_count)}}renderReview(){const e=this.reviewing;if(!e)return r;const s=this.review,i=s?J(s,this.now):0,d=new Set(s?.impact.differences??[]),o=(n,u,S)=>{const f=S.some(R=>d.has(R));return a`<span class=${f?"diff":""}>${n}</span><span class=${f?"diff":""}><bdi>${this.side(s.impact.central,u)}</bdi></span><span class=${f?"diff":""}><bdi>${this.side(s.impact.device,u)}</bdi></span>`};return a`<sw-drawer modal open heading=${t.drawer.heading} subheading=${`${e.person?.display_name||t.conflicts.hiddenPerson} · ${this.station(e.station_id)}`} data-wkt-drawer
      @close=${n=>n.target===n.currentTarget&&this.closeReview()}>
      <div class="rv">
        ${this.reviewBusy?a`<div class="note" data-wkt-reading aria-busy="true">${t.drawer.reading}</div>`:a`<div class="muted">${t.drawer.intro}</div>`}
        ${this.reviewError?a`<div class="err" role="alert" data-wkt-review-error>${this.reviewError.message||t.status[this.reviewError.status]} ${this.reviewError.code?a`<code>${this.reviewError.code}</code>`:r}</div>`:r}
        ${s?a`<div class="muted" data-wkt-reviewed>${t.drawer.reviewed}: <bdi>${this.time(s.impact.reviewed_at)}</bdi> · <span data-wkt-ttl>${t.drawer.expires(i)}</span></div>
              ${s.kind==="person"?a`<div class="cmp" data-wkt-compare>
                    <span class="h"></span><span class="h">${t.drawer.managed}</span><span class="h">${t.drawer.device}</span>
                    ${o(t.drawer.side.name,"name",["display_name","presence"])} ${o(t.drawer.side.validity,"validity",["validity"])}
                    ${o(t.drawer.side.doors,"doors",["door_rights"])} ${o(t.drawer.side.pin,"pin",["pin"])} ${o(t.drawer.side.cards,"cards",["cards"])}
                  </div>`:a`<div class="cmp" data-wkt-compare><span class="h"></span><span class="h">${t.drawer.device}</span><span class="h"></span>
                    ${["name","doors","cards"].map(n=>a`<span>${t.drawer.side[n]}</span><span><bdi>${this.side(s.impact.device,n)}</bdi></span><span></span>`)}</div>`}
              <div>
                <b>${t.drawer.differences}</b>
                <div class="chips" data-wkt-diffs>${s.impact.differences.length?s.impact.differences.map(n=>a`<span class="chip">${t.drawer.field[n]??t.drawer.field.other}</span>`):a`<span class="muted">${t.drawer.noDifferences}</span>`}</div>
              </div>
              ${s.impact.plan&&s.kind==="person"?a`<div data-wkt-plan><b>${t.drawer.plan}</b><ul>
                    <li>${t.drawer.planPerson[s.impact.plan.person??"unknown"]??t.drawer.planPerson.unknown}</li>
                    <li>${t.drawer.planPin[s.impact.plan.pin??"unknown"]??t.drawer.planPin.unknown}</li>
                    <li>${t.drawer.cards(s.impact.plan.cards_add??0,s.impact.plan.cards_remove??0,s.impact.plan.cards_update??0)}</li>
                  </ul></div>`:r}
              ${s.impact.affected_stations.length?a`<div data-wkt-affected><b>${t.drawer.affected}</b><div class="chips">${s.impact.affected_stations.map(n=>a`<span class="chip"><bdi>${this.station(n)}</bdi></span>`)}</div>
                    ${s.kind==="person"?a`<div class="muted">${t.drawer.affectedHint}</div>`:r}</div>`:r}
              ${s.impact.unverified_fields.includes("pin")?a`<div class="note">${t.drawer.unverified}</div>`:r}
              <div><b>${t.drawer.choose}</b></div>
              ${G(s).map(n=>a`<div class="choice" data-wkt-choice=${n.direction} data-allowed=${String(n.allowed)}>
                  <b>${t.direction[n.direction].label}</b>
                  <span class="muted">${t.direction[n.direction].hint}</span>
                  ${n.allowed?a`<div><sw-button size="sm" variant=${n.direction==="central"?"primary":"secondary"} data-wkt-choose=${n.direction}
                        ?disabled=${this.sending||i<=0||!!this.resolved} @click=${()=>this.asking=n.direction}>${t.direction[n.direction].label}</sw-button></div>`:a`<span class="why">${t.drawer.notAllowed}: ${t.reason[n.reason??"unknown"]??n.reason}</span>`}
                </div>`)}
              ${this.resolved?a`<div data-wkt-resolved>${this.renderResult(this.resolved)}</div>`:r}`:r}
        ${this.renderConfirm()}
      </div>
      <sw-button slot="footer" variant="ghost" data-wkt-close @click=${()=>this.closeReview()}>${t.drawer.close}</sw-button>
      ${!this.reviewBusy&&(this.reviewError||this.resolved||s&&i<=0)?a`<sw-button slot="footer" icon="refresh" data-wkt-again @click=${()=>this.openReview(e)}>${t.drawer.again}</sw-button>`:r}
    </sw-drawer>`}renderConfirm(){const e=this.asking;return e?a`<sw-dialog open heading=${t.confirm.heading} data-wkt-confirm @close=${s=>{s.stopPropagation(),this.asking=null}}>
      <div class="dlg">
        <b>${t.direction[e].label}</b>
        <div>${t.direction[e].hint}</div>
        <div class="muted">${t.confirm.body}</div>
      </div>
      <div class="dfoot">
        <sw-button variant="ghost" @click=${()=>this.asking=null}>${t.confirm.cancel}</sw-button>
        <sw-button variant=${e==="central"?"primary":"danger"} data-wkt-confirm-ok ?disabled=${this.sending} @click=${()=>this.resolve(e)}>${this.sending?t.status.sending:t.confirm.ok}</sw-button>
      </div>
    </sw-dialog>`:r}visibleAlerts(){const e=this.alerts??[];return this.mode==="full"&&this.showSnoozed?e:e.filter(s=>!s.suppressed)}ask(e,s,i=s==="restore"?V(e):e.kind){this.draft={alert:e,action:s,kind:i,duration:60,reason:i==="maintenance"?"planned_maintenance":"investigating"}}async sendAlert(){const e=this.draft;if(!e||this.alertBusy||!e.alert.station_id)return;this.alertBusy=!0;const s=y(e.alert);this.results={...this.results,[s]:{status:"sending",code:null,message:"",retry_after_s:null}};let i;try{await H(e.alert.station_id,e.kind,e.action,e.duration,e.reason),i={status:"completed",code:null,message:"",retry_after_s:null}}catch(d){i=v(d)}this.results={...this.results,[s]:i},this.draft=null,this.alertBusy=!1,(i.status==="completed"||i.status==="stale")&&this.load()}renderAlerts(){const e=!!this.view?.may_act_alerts,s=this.visibleAlerts(),i=this.mode==="compact"?s.slice(0,x):s;return a`<section class="wrap" data-wkt-alerts>
      <div class="bar">
        ${this.mode==="compact"?a`<h4>${t.alerts.heading}</h4>`:r}
        <span class="muted" data-wkt-alert-count>${t.alerts.count(this.alertCounts.active,this.alertCounts.snoozed)}</span>
        <span class="sp"></span>
        ${this.mode==="full"?a`<label class="chk"><input type="checkbox" data-wkt-show-snoozed .checked=${this.showSnoozed} @change=${d=>this.showSnoozed=d.target.checked} />${t.alerts.showSnoozed}</label>`:r}
      </div>
      ${this.alertsError?a`<div class="err" role="alert">${this.alertsError}</div>`:r}
      ${this.alerts===null?r:i.length===0?a`<div class="list"><div class="empty" data-wkt-empty>${t.alerts.empty}</div></div>`:a`<div class="list">${i.map(d=>this.renderAlert(d,e))}</div>
              ${i.length<s.length?a`<a class="more" href="#/wiskey/alerts" data-wkt-more>${t.openFull} (${s.length})</a>`:r}`}
      ${this.mode==="full"?a`<div class="note" data-wkt-no-ack>${t.alerts.noAck}</div>`:r}
    </section>`}renderAlert(e,s){const i=y(e),d=this.results[i],o=this.view?.recent?.alerts?.[i];return a`<div class="row" data-wkt-alert=${e.id} data-suppressed=${String(e.suppressed)}>
      <div class="main">
        <b>${t.alerts.kind[e.kind]??t.alerts.kind.other}</b>
        <span class="sub"><bdi>${e.station_name||this.station(e.station_id)}</bdi></span>
      </div>
      <div class="main">
        ${e.suppressed&&e.suppression?a`<span>${t.alerts.snoozedUntil} <bdi>${this.time(e.suppression.until)}</bdi></span><span class="sub">${t.alerts.reasons[e.suppression.reason??""]??""}${e.suppression.kind==="maintenance"?` · ${t.alerts.kind.maintenance}`:""}</span>`:a`<span class="sub">${t.alerts.since} <bdi>${this.time(e.observed_since)}</bdi></span>`}
      </div>
      <sw-badge kind=${e.suppressed?"neutral":e.severity==="error"?"error":"stale"} label=${e.suppressed?t.alerts.snooze:t.alerts.severity[e.severity]??e.severity}></sw-badge>
      <div class="acts">
        ${s&&e.station_id?Q(e).map(n=>n==="snooze"?a`<sw-button size="sm" icon="bellOff" data-wkt-snooze ?disabled=${d?.status==="sending"} @click=${()=>this.ask(e,"snooze")}>${t.alerts.snooze}</sw-button>`:a`<sw-button size="sm" icon="bell" data-wkt-restore ?disabled=${d?.status==="sending"} @click=${()=>this.ask(e,"restore")}>${t.alerts.restore}</sw-button>`):r}
      </div>
      ${d?this.renderResult(d):o?this.renderResult({status:o.status,code:o.code,message:"",retry_after_s:null},o.at):r}
    </div>`}renderAlertDialog(){const e=this.draft;if(!e)return r;const s=e.action==="snooze";return a`<sw-dialog open heading=${s?t.alerts.confirmSnooze:t.alerts.confirmRestore} data-wkt-alert-dialog @close=${i=>{i.stopPropagation(),this.draft=null}}>
      <div class="dlg">
        <b>${t.alerts.kind[e.alert.kind]??e.alert.kind} · <bdi>${e.alert.station_name||this.station(e.alert.station_id)}</bdi></b>
        ${s?a`<label class="chk"><input type="checkbox" data-wkt-whole-station .checked=${e.kind==="maintenance"}
                @change=${i=>this.draft={...e,kind:i.target.checked?"maintenance":e.alert.kind}} />${t.alerts.stationSnooze}</label>
              <div class="f"><span>${t.alerts.durationLabel}</span>
                <sw-dropdown block data-wkt-duration label=${t.alerts.durationLabel} .value=${String(e.duration)}
                  .items=${q.map(i=>({id:String(i),label:t.alerts.duration[i]}))}
                  @change=${i=>this.draft={...e,duration:Number(i.detail.id)}}></sw-dropdown></div>
              <div class="f"><span>${t.alerts.reasonLabel}</span>
                <sw-dropdown block data-wkt-reason label=${t.alerts.reasonLabel} .value=${e.reason}
                  .items=${U.map(i=>({id:i,label:t.alerts.reasons[i]}))}
                  @change=${i=>this.draft={...e,reason:i.detail.id}}></sw-dropdown></div>`:e.kind==="maintenance"?a`<div>${t.alerts.kind.maintenance}</div>`:r}
        <div class="muted">${t.alerts.confirmBody}</div>
      </div>
      <div class="dfoot">
        <sw-button variant="ghost" @click=${()=>this.draft=null}>${t.confirm.cancel}</sw-button>
        <sw-button variant="primary" data-wkt-alert-ok ?disabled=${this.alertBusy} @click=${()=>this.sendAlert()}>${this.alertBusy?t.status.sending:s?t.alerts.snooze:t.alerts.restore}</sw-button>
      </div>
    </sw-dialog>`}async setNotify(e){this.notifyBusy=!0;try{const s=await W(e);this.view&&(this.view={...this.view,notify:s.notify})}catch(s){this.error=h(s)}finally{this.notifyBusy=!1}}renderNotify(){const e=this.view?.notify;return!e||this.mode!=="full"?r:a`<div class="notify" data-wkt-notify=${e.enabled?"on":"off"}>
      <div class="main"><b>${t.notify.label}</b><span class="sub">${t.notify.hint}</span>${e.can_edit?r:a`<span class="sub">${t.notify.noEdit}</span>`}</div>
      ${this.renderNotifyPick(e.enabled,!e.can_edit||this.notifyBusy)}
    </div>`}renderNotifyPick(e,s){return a`<sw-dropdown data-wkt-notify-select label=${t.notify.label} .value=${e?"on":"off"}
      .items=${[{id:"off",label:t.notify.off},{id:"on",label:t.notify.on}]}
      ?inert=${s} aria-disabled=${s?"true":r} style=${s?"opacity: var(--sw-disabled-opacity)":""}
      @change=${i=>this.setNotify(i.detail.id==="on")}></sw-dropdown>`}render(){if(this.phase==="loading"&&!this.view)return a`<div class="note" data-wkt-loading aria-busy="true">${t.loading}</div>`;if(this.phase==="error"&&!this.view)return a`<div class="err" role="alert" data-wkt-error>${this.error}</div>`;const e=!!this.view?.may_resolve,s=this.conflicts?.length??0,i=this.alertCounts.active;return a`<div class="wrap" data-wkt-panel=${this.mode}>
      <div class="bar">
        ${this.mode==="full"?a`<div class="tabs" role="tablist">
              <button role="tab" data-wkt-tab="conflicts" aria-selected=${String(this.tab==="conflicts")} @click=${()=>this.switchTab("conflicts")}>${t.tabs.conflicts}<span class="n">${s}</span></button>
              <button role="tab" data-wkt-tab="alerts" aria-selected=${String(this.tab==="alerts")} @click=${()=>this.switchTab("alerts")}>${t.tabs.alerts}<span class="n">${i}</span></button>
            </div>`:r}
        <span class="sp"></span>
        ${this.mode==="compact"?a`<a href="#/wiskey/conflicts" data-wkt-open-full>${t.openFull}</a>`:r}
        <sw-button size="sm" variant="ghost" icon="refresh" data-wkt-refresh @click=${()=>this.load()}>${t.refresh}</sw-button>
      </div>
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:r}
      ${!e&&this.view?a`<div class="note" data-wkt-readonly>${t.readOnly}</div>`:r}
      ${this.mode==="compact"?a`${this.renderConflicts()} ${this.renderAlerts()}`:this.tab==="alerts"?a`${this.renderAlerts()} ${this.renderNotify()}`:this.renderConflicts()}
      ${this.renderReview()} ${this.renderAlertDialog()}
    </div>`}switchTab(e){e!==this.tab&&(this.tab=e,this.dispatchEvent(new CustomEvent("wkt-tab",{detail:{tab:e},bubbles:!0,composed:!0})))}};l.styles=T`
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
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
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
  `;c([z()],l.prototype,"mode",2);c([z()],l.prototype,"tab",2);c([p()],l.prototype,"view",2);c([p()],l.prototype,"conflicts",2);c([p()],l.prototype,"alerts",2);c([p()],l.prototype,"alertCounts",2);c([p()],l.prototype,"names",2);c([p()],l.prototype,"zone",2);c([p()],l.prototype,"phase",2);c([p()],l.prototype,"error",2);c([p()],l.prototype,"conflictsError",2);c([p()],l.prototype,"alertsError",2);c([p()],l.prototype,"showSnoozed",2);c([p()],l.prototype,"results",2);c([p()],l.prototype,"reviewing",2);c([p()],l.prototype,"review",2);c([p()],l.prototype,"reviewError",2);c([p()],l.prototype,"reviewBusy",2);c([p()],l.prototype,"asking",2);c([p()],l.prototype,"sending",2);c([p()],l.prototype,"resolved",2);c([p()],l.prototype,"draft",2);c([p()],l.prototype,"alertBusy",2);c([p()],l.prototype,"notifyBusy",2);c([p()],l.prototype,"now",2);l=c([O("wk-triage-panel")],l);export{ne as m,t};
//# sourceMappingURL=wk-triage-panel-8eOdcrmD.js.map
