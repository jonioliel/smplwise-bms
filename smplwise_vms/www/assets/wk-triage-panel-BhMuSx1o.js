import{b4 as P,bn as m,a as A,h$ as x,bs as N,i0 as O,cE as D,bE as B,g as U,ay as z,j as h,i as L,n as u,u as j,A as r,b as i,k as W}from"./index-CkOaAZ0k.js";import{g as q,a as F,b as I}from"./access-status-C5pUdEN3.js";import{U as g,a as M}from"./wiskey-format-D8sxb_B6.js";const K=[15,60,240,1440,10080],H=["planned_maintenance","network_work","investigating"],V=15e3,S=()=>({client_request_id:O(),expires_at:new Date(x()+V).toISOString().replace(/\.\d{3}Z$/,"Z")}),f=encodeURIComponent,Z=()=>P("access-control/triage"),G=(e,t,n)=>m(`access-control/stations/${f(e)}/conflicts/${f(t)}/review`,{kind:n}),J=(e,t)=>m(`access-control/triage/reviews/${f(e)}/resolve`,{direction:t,confirmed:!0,...S()}),Q=(e,t,n,d,o)=>m(`access-control/stations/${f(e)}/alerts/${f(t)}/${n}`,{confirmed:!0,...n==="snooze"?{duration_minutes:d,reason:o}:{},...S()}),X=e=>N("access-control/triage/settings",{notify:e});function v(e){if(e instanceof A){const t=e.body?.details??{},n=String(t.outcome??"");let d=n==="refused"?"failed":n==="not_sent"?"not_sent":n==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown";e.code==="triage_stale"&&(d="stale");const o=Number(t.retry_after_s);return{status:d,code:String(t.wiskey_code??e.code??"")||null,message:e.body?.user_message||"",retry_after_s:Number.isFinite(o)&&o>=0?o:null}}return{status:"unknown",code:"network",message:"",retry_after_s:null}}function b(e){return e.kind==="person"?"person":e.kind==="removal"?"removal":null}function Y(e){return(e.kind==="removal"?["delete"]:["central","device"]).map(n=>({direction:n,allowed:!!e.impact.actions?.[n]?.allowed,reason:e.impact.actions?.[n]?.reason??null}))}function ee(e,t=x()){return Math.floor((Date.parse(e.expires_at)-t)/1e3)}const $=e=>`${e.station_id}:${e.person?.id??""}`,y=e=>`${e.station_id??""}:${e.kind}`;function te(e){return e.suppressed?e.suppression?.kind?["restore"]:[]:["snooze"]}function se(e){return e.suppression?.kind||e.kind}const ne=["access.admin.read","access.stations.manage","system.configure"];function ce(e){return ne.some(t=>e(t))}function k(e){if(!e)return"…";const t=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(e);return t?`${Number(t[3])}.${Number(t[2])}.${t[1]} ${t[4]}:${t[5]}`:e}const E={title:"התנגשויות והתראות עמדות",subtitle:"מה שמסומן באדום במצב המערכת: התנגשויות סנכרון של אנשים, מחיקות שממתינות לבדיקה והתראות עמדות. כל החלטה עוברת בדיקה ואישור.",link:"התנגשויות והתראות",tabs:{conflicts:"התנגשויות",alerts:"התראות"},openFull:"למסך המלא",refresh:"רענון",loading:"טוען…",readOnly:"צפייה בלבד: פתרון התנגשויות וטיפול בהתראות דורשים הרשאת ניהול עמדות בכל המערכת או הרשאת מנהל מערכת.",conflicts:{heading:"התנגשויות סנכרון",empty:"אין התנגשויות. כל האנשים מסונכרנים עם העמדות.",count:e=>e===1?"התנגשות אחת":`${e} התנגשויות`,kind:{person:"אדם",removal:"מחיקה ממתינה",revocation:"ביטול הרשאה",other:"אחר"},state:{conflict:"התנגשות",error:"שגיאה",pending:"ממתין",delete_pending:"מחיקה ממתינה",other:"אחר"},person:"אדם",station:"עמדה",hiddenPerson:"אדם (השם מוסתר לפי ההרשאות)",noReview:"מתעדכן עם סנכרון האדם; אין לו פתרון נפרד",review:"בדיקה",lastError:"שגיאה אחרונה"},drawer:{heading:"בדיקת התנגשות",reading:"קורא את הרשומה מהעמדה…",intro:"הבדיקה קוראת את הרשומה מהעמדה ומשווה אותה לרשומה המנוהלת. דבר לא משתנה עד שמאשרים.",reviewed:"נבדק",expires:e=>e>0?`הבדיקה בתוקף עוד ${Math.ceil(e/60)} דקות`:"הבדיקה פגה - יש לבדוק שוב",managed:"הרשומה המנוהלת",device:"בעמדה",missing:"לא קיים",differences:"שדות שונים",noDifferences:"אין הבדלים בשדות שנבדקו",plan:"מה ישתנה בעמדה אם הרשומה המנוהלת תוחל",affected:"עמדות שהאדם משויך אליהן",affectedHint:"עדכון הרשומה לפי העמדה משנה את הרשומה שכל העמדות האלה יקבלו.",unverified:"הקוד האישי לא נבדק: העמדה לא מדווחת עליו.",choose:"מה לעשות",notAllowed:"לא אפשרי כרגע",again:"בדיקה מחדש",close:"סגירה",field:{presence:"קיום ברשומה",display_name:"שם",user_type:"סוג משתמש",validity:"תוקף",door_rights:"דלתות",pin:"קוד אישי",schedule:"לוח זמנים",privileged:"הרשאת ניהול בעמדה",other_credentials:"אמצעי זיהוי אחרים",cards:"כרטיסים",other:"שדה אחר"},planPerson:{create:"האדם ייווצר בעמדה",delete:"האדם יוסר מהעמדה",update:"פרטי האדם יעודכנו",none:"פרטי האדם לא ישתנו",unknown:"לא ידוע"},planPin:{none:"הקוד האישי לא ישתנה",remove:"הקוד האישי יוסר",set:"יוגדר קוד אישי",change:"הקוד האישי יוחלף",unknown:"לא ידוע"},cards:(e,t,n)=>`כרטיסים: ${e} יתווספו, ${t} יוסרו, ${n} יעודכנו`,side:{name:"שם",validity:"תוקף",doors:"דלתות",pin:"קוד אישי",cards:"כרטיסים",yes:"מוגדר",no:"לא מוגדר",unknown:"לא ידוע",always:"ללא הגבלה"}},direction:{central:{label:"להחיל את הרשומה המנוהלת על העמדה",hint:"העמדה תסונכרן מחדש לפי הרשומה המנוהלת. מה שנמצא בעמדה ושונה ממנה יוחלף."},device:{label:"לעדכן את הרשומה לפי העמדה",hint:"הרשומה המנוהלת תקבל את הפרטים שבעמדה, וכל העמדות שהאדם משויך אליהן יקבלו אותם בסנכרון הבא."},delete:{label:"להמשיך במחיקה מהעמדה",hint:"האדם נמחק מהמערכת; העמדה הזו עוד מחזיקה אותו. האישור ממשיך את המחיקה ממנה בסנכרון הבא."}},reason:{deletion_not_pending:"אין מחיקה ממתינה לאדם הזה",ownership_missing:"האדם לא שויך לעמדה הזו",user_not_found:"האדם כבר לא קיים",device_user_missing:"האדם לא נמצא בעמדה",unknown:"הסיבה לא ידועה"},confirm:{heading:"אישור פתרון התנגשות",body:"הפעולה תישלח פעם אחת. המערכת תבדוק שוב את הרשומה בעמדה לפני השינוי; אם משהו השתנה מאז הבדיקה - שום דבר לא ישתנה ותתבקשו לבדוק שוב.",ok:"אישור ושליחה",cancel:"ביטול"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"התקבל: הסנכרון של העמדה נכנס לתור ויתבצע בדקות הקרובות",completed:"בוצע",failed:"נדחה",not_sent:"לא נשלח",unknown:"נשלח, אך לא התקבלה תשובה ברורה - בדקו את הרשימה לפני שמנסים שוב",stale:"הרשומה השתנתה מאז הבדיקה - לא שונה דבר. בדקו שוב."},statusShort:{sending:"שולח",sent:"נשלח",acknowledged:"התקבל",completed:"בוצע",failed:"נדחה",not_sent:"לא נשלח",unknown:"לא ברור",stale:"השתנה"},alerts:{heading:"התראות עמדות",empty:"אין התראות פעילות.",showSnoozed:"להציג גם מושתקות",count:(e,t)=>`${e} פעילות · ${t} מושתקות`,kind:{offline:"העמדה לא מחוברת",sync_stalled:"הסנכרון תקוע",sync_conflict:"התנגשות סנכרון",sync_error:"שגיאת סנכרון",event_gap:"פער בזרם האירועים",clock_drift:"שעון העמדה סוטה",maintenance:"כל ההתראות של העמדה",other:"אחר"},severity:{error:"חמור",warning:"אזהרה"},since:"מאז",snoozedUntil:"מושתק עד",snooze:"השתקה",restore:"ביטול השתקה",stationSnooze:"השתקת כל העמדה (תחזוקה)",noAck:"התראה נסגרת מעצמה כשהמצב חוזר לתקין; אין לה אישור קבלה או סגירה ידנית.",durationLabel:"משך",reasonLabel:"סיבה",duration:{15:"15 דקות",60:"שעה",240:"4 שעות",1440:"יום",10080:"שבוע"},reasons:{planned_maintenance:"תחזוקה מתוכננת",network_work:"עבודות רשת",investigating:"בבדיקה"},confirmSnooze:"השתקת ההתראה",confirmRestore:"ביטול ההשתקה",confirmBody:"ההשתקה משנה רק את התצוגה וההתראות - לא את העמדה עצמה. היא נשלחת פעם אחת."},notify:{label:"להעביר התראות עמדות חדשות למרכז ההתראות",hint:"כבוי כברירת מחדל. כשמופעל: התראה אחת לכל עמדה וסוג, נסגרת כשההתראה מסתיימת או מושתקת. מי מקבל ובאיזה ערוץ - לפי הגדרות ההתראות, כולל שעות שקט.",on:"מופעל",off:"כבוי",noEdit:"שינוי דורש הרשאת מנהל מערכת."},feedDown:"אין חיבור פעיל למערכת הכניסה; הפעולות לא יישלחו עד שהחיבור יחזור."},C={title:"Conflicts and station alerts",subtitle:"What is marked red in the system status: people sync conflicts, deletions awaiting review and station alerts. Every decision goes through a review and a confirmation.",link:"Conflicts and alerts",tabs:{conflicts:"Conflicts",alerts:"Alerts"},openFull:"Open the full screen",refresh:"Refresh",loading:"Loading…",readOnly:"View only: resolving conflicts and handling alerts need the station management permission for the whole system, or the system administrator permission.",conflicts:{heading:"Sync conflicts",empty:"No conflicts. Everyone is in sync with the stations.",count:e=>e===1?"One conflict":`${e} conflicts`,kind:{person:"Person",removal:"Pending deletion",revocation:"Permission revocation",other:"Other"},state:{conflict:"Conflict",error:"Error",pending:"Pending",delete_pending:"Pending deletion",other:"Other"},person:"Person",station:"Station",hiddenPerson:"Person (name hidden by your permissions)",noReview:"Updates with the person's sync; it has no separate resolution",review:"Review",lastError:"Last error"},drawer:{heading:"Conflict review",reading:"Reading the record from the station…",intro:"The review reads the record from the station and compares it with the managed record. Nothing changes until you confirm.",reviewed:"Reviewed",expires:e=>{if(e<=0)return"The review has expired - review again";const t=Math.ceil(e/60);return t===1?"The review is valid for 1 more minute":`The review is valid for ${t} more minutes`},managed:"The managed record",device:"On the station",missing:"Missing",differences:"Fields that differ",noDifferences:"No differences in the checked fields",plan:"What will change on the station if the managed record is applied",affected:"Stations the person is assigned to",affectedHint:"Updating the record from the station changes the record that all these stations will receive.",unverified:"The personal code was not checked: the station does not report it.",choose:"What to do",notAllowed:"Not possible right now",again:"Review again",close:"Close",field:{presence:"Present in the record",display_name:"Name",user_type:"User type",validity:"Validity",door_rights:"Doors",pin:"Personal code",schedule:"Schedule",privileged:"Station admin permission",other_credentials:"Other credentials",cards:"Cards",other:"Other field"},planPerson:{create:"The person will be created on the station",delete:"The person will be removed from the station",update:"The person's details will be updated",none:"The person's details will not change",unknown:"Unknown"},planPin:{none:"The personal code will not change",remove:"The personal code will be removed",set:"A personal code will be set",change:"The personal code will be replaced",unknown:"Unknown"},cards:(e,t,n)=>`Cards: ${e} to add, ${t} to remove, ${n} to update`,side:{name:"Name",validity:"Validity",doors:"Doors",pin:"Personal code",cards:"Cards",yes:"Set",no:"Not set",unknown:"Unknown",always:"No limit"}},direction:{central:{label:"Apply the managed record to the station",hint:"The station will be synced again from the managed record. Whatever on the station differs from it will be replaced."},device:{label:"Update the record from the station",hint:"The managed record takes the details on the station, and every station the person is assigned to receives them in the next sync."},delete:{label:"Continue the deletion from the station",hint:"The person was deleted from the system; this station still holds them. Confirming continues the deletion from it in the next sync."}},reason:{deletion_not_pending:"There is no pending deletion for this person",ownership_missing:"The person was not assigned to this station",user_not_found:"The person no longer exists",device_user_missing:"The person was not found on the station",unknown:"The reason is unknown"},confirm:{heading:"Confirm the conflict resolution",body:"The action is sent once. The system checks the record on the station again before the change; if anything has changed since the review, nothing is changed and you will be asked to review again.",ok:"Confirm and send",cancel:"Cancel"},status:{sending:"Sending…",sent:"Sent, waiting for a reply",acknowledged:"Received: the station's sync is queued and will run in the next few minutes",completed:"Done",failed:"Refused",not_sent:"Not sent",unknown:"Sent, but no clear reply came back - check the list before trying again",stale:"The record changed since the review - nothing was changed. Review again."},statusShort:{sending:"Sending",sent:"Sent",acknowledged:"Received",completed:"Done",failed:"Refused",not_sent:"Not sent",unknown:"Unclear",stale:"Changed"},alerts:{heading:"Station alerts",empty:"No active alerts.",showSnoozed:"Show snoozed too",count:(e,t)=>`${e} active · ${t} snoozed`,kind:{offline:"Station offline",sync_stalled:"Sync stalled",sync_conflict:"Sync conflict",sync_error:"Sync error",event_gap:"Gap in the event stream",clock_drift:"Station clock drifting",maintenance:"All alerts of the station",other:"Other"},severity:{error:"Severe",warning:"Warning"},since:"Since",snoozedUntil:"Snoozed until",snooze:"Snooze",restore:"Cancel the snooze",stationSnooze:"Snooze the whole station (maintenance)",noAck:"An alert closes by itself when the state is back to normal; it cannot be acknowledged or closed by hand.",durationLabel:"Duration",reasonLabel:"Reason",duration:{15:"15 minutes",60:"1 hour",240:"4 hours",1440:"1 day",10080:"1 week"},reasons:{planned_maintenance:"Planned maintenance",network_work:"Network work",investigating:"Under investigation"},confirmSnooze:"Snooze the alert",confirmRestore:"Cancel the snooze",confirmBody:"Snoozing changes only the display and the notifications - not the station itself. It is sent once."},notify:{label:"Forward new station alerts to the notification centre",hint:"Off by default. When on: one notification per station and type, closed when the alert ends or is snoozed. Who receives it, and on which channel, follows the notification settings, including quiet hours.",on:"On",off:"Off",noEdit:"Changing this needs the system administrator permission."},feedDown:"No active connection to the access control system; actions will not be sent until the connection is back."},s=D(["en"])==="en"?C:E;B("i18n/wiskey-triage",{he:E,en:C});var ie=Object.defineProperty,ae=Object.getOwnPropertyDescriptor,c=(e,t,n,d)=>{for(var o=d>1?void 0:d?ae(t,n):t,a=e.length-1,p;a>=0;a--)(p=e[a])&&(o=(d?p(t,n,o):p(o))||o);return d&&o&&ie(t,n,o),o};const re={sending:"unknown",sent:"unknown",acknowledged:"live",completed:"live",failed:"error",not_sent:"stale",unknown:"stale",stale:"stale"},_=4;let l=class extends L{constructor(){super(...arguments),this.mode="full",this.tab="conflicts",this.view=null,this.conflicts=null,this.alerts=null,this.alertCounts={active:0,snoozed:0},this.names={},this.zone=g,this.phase="loading",this.error="",this.conflictsError="",this.alertsError="",this.showSnoozed=!1,this.results={},this.reviewing=null,this.review=null,this.reviewError=null,this.reviewBusy=!1,this.asking=null,this.sending=!1,this.resolved=null,this.draft=null,this.alertBusy=!1,this.notifyBusy=!1,this.now=Date.now(),this.timer=0,this.seq=0}connectedCallback(){super.connectedCallback(),this.load(),this.timer=window.setInterval(()=>this.now=Date.now(),15e3)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}async load(){const e=++this.seq;this.phase=this.view?this.phase:"loading";try{const[t,n,d,o]=await Promise.allSettled([Z(),q(),F({includeSuppressed:!0,limit:200}),I()]);if(e!==this.seq)return;if(t.status==="rejected")throw t.reason;if(this.view=t.value,n.status==="fulfilled"?(this.conflicts=n.value.conflicts??[],this.conflictsError=n.value.conflicts?"":s.feedDown):(this.conflicts=null,this.conflictsError=u(n.reason)),d.status==="fulfilled"){const a=d.value.alerts;this.alerts=a?.items??[],this.alertCounts={active:a?.active_count??0,snoozed:a?.suppressed_count??0},this.alertsError=a?"":s.feedDown}else this.alerts=null,this.alertsError=u(d.reason);o.status==="fulfilled"&&(this.names=Object.fromEntries((o.value.stations??[]).map(a=>[a.id,a.name])),this.zone=o.value.default_zone??g),this.phase="ready",this.error=""}catch(t){if(e!==this.seq)return;this.phase="error",this.error=u(t)}}station(e){return e&&this.names[e]||e||"—"}time(e){return M(e,j(),this.zone)}async openReview(e){const t=b(e);if(!(!t||!e.person?.id)){this.reviewing=e,this.review=null,this.reviewError=null,this.resolved=null,this.asking=null,this.reviewBusy=!0;try{this.review=await G(e.station_id,e.person.id,t)}catch(n){this.reviewError=v(n)}finally{this.reviewBusy=!1}}}closeReview(){this.reviewing=null,this.review=null,this.asking=null,this.reviewError=null,this.resolved&&this.load(),this.resolved=null}async resolve(e){const t=this.review,n=this.reviewing;if(!t||!n||this.sending)return;this.sending=!0;const d=$(n);this.results={...this.results,[d]:{status:"sending",code:null,message:"",retry_after_s:null}};let o;try{await J(t.review_id,e),o={status:"acknowledged",code:null,message:"",retry_after_s:null}}catch(a){o=v(a)}this.results={...this.results,[d]:o},this.resolved=o,this.asking=null,this.sending=!1}renderConflicts(){const e=this.conflicts,t=!!this.view?.may_resolve,n=e&&this.mode==="compact"?e.slice(0,_):e;return i`<section class="wrap" data-wkt-conflicts>
      ${this.mode==="compact"?i`<div class="bar"><h4>${s.conflicts.heading}</h4><span class="muted">${e?s.conflicts.count(e.length):""}</span></div>`:r}
      ${this.conflictsError?i`<div class="err" role="alert">${this.conflictsError}</div>`:r}
      ${e===null?r:e.length===0?i`<div class="list"><div class="empty" data-wkt-empty>${s.conflicts.empty}</div></div>`:i`<div class="list">${n.map(d=>this.renderConflict(d,t))}</div>
              ${n.length<e.length?i`<a class="more" href="#/wiskey/conflicts" data-wkt-more>${s.openFull} (${e.length})</a>`:r}`}
    </section>`}renderConflict(e,t){const n=$(e),d=b(e),o=this.results[n],a=this.view?.recent?.conflicts?.[n],p=e.person?.display_name||(e.person?.id?s.conflicts.hiddenPerson:"—");return i`<div class="row" data-wkt-conflict=${n} data-kind=${e.kind}>
      <div class="main">
        <b>${p}</b>
        <span class="sub">${s.conflicts.kind[e.kind]??s.conflicts.kind.other}${e.person?.employee_no?i` · <bdi>${e.person.employee_no}</bdi>`:r}</span>
      </div>
      <div class="main">
        <span><bdi>${this.station(e.station_id)}</bdi></span>
        ${e.last_error?i`<span class="sub">${s.conflicts.lastError}: <code>${e.last_error}</code></span>`:r}
      </div>
      <sw-badge kind=${e.sync_state==="error"?"error":"stale"} label=${s.conflicts.state[e.sync_state]??s.conflicts.state.other}></sw-badge>
      <div class="acts">
        ${d&&t?i`<sw-button size="sm" icon="search" data-wkt-review ?disabled=${o?.status==="sending"} @click=${()=>this.openReview(e)}>${s.conflicts.review}</sw-button>`:d?r:i`<span class="sub">${s.conflicts.noReview}</span>`}
      </div>
      ${o?this.renderResult(o):a?this.renderResult({status:a.status,code:a.code,message:"",retry_after_s:null},a.at):r}
    </div>`}renderResult(e,t){return i`<div class="result" data-wkt-result=${e.status} role=${e.status==="failed"||e.status==="stale"?"alert":"status"}>
      <sw-badge kind=${re[e.status]} label=${s.statusShort[e.status]??e.status}></sw-badge>
      <span>${e.message||s.status[e.status]}${e.code&&e.status!=="acknowledged"&&e.status!=="completed"?i` <code>${e.code}</code>`:r}${t?i` · <bdi>${this.time(t)}</bdi>`:r}</span>
    </div>`}side(e,t){const n=s.drawer.side;if(!e||!e.present)return s.drawer.missing;switch(t){case"name":return e.display_name??"—";case"validity":return e.validity.timed?`${k(e.validity.from)} – ${k(e.validity.until)}`:n.always;case"doors":return e.door_rights.length?e.door_rights.join(", "):"—";case"pin":return e.pin_configured===null?n.unknown:e.pin_configured?n.yes:n.no;case"cards":return String(e.card_count)}}renderReview(){const e=this.reviewing;if(!e)return r;const t=this.review,n=t?ee(t,this.now):0,d=new Set(t?.impact.differences??[]),o=(a,p,T)=>{const w=T.some(R=>d.has(R));return i`<span class=${w?"diff":""}>${a}</span><span class=${w?"diff":""}><bdi>${this.side(t.impact.central,p)}</bdi></span><span class=${w?"diff":""}><bdi>${this.side(t.impact.device,p)}</bdi></span>`};return i`<sw-drawer modal open heading=${s.drawer.heading} subheading=${`${e.person?.display_name||s.conflicts.hiddenPerson} · ${this.station(e.station_id)}`} data-wkt-drawer
      @close=${a=>a.target===a.currentTarget&&this.closeReview()}>
      <div class="rv">
        ${this.reviewBusy?i`<div class="note" data-wkt-reading aria-busy="true">${s.drawer.reading}</div>`:i`<div class="muted">${s.drawer.intro}</div>`}
        ${this.reviewError?i`<div class="err" role="alert" data-wkt-review-error>${this.reviewError.message||s.status[this.reviewError.status]} ${this.reviewError.code?i`<code>${this.reviewError.code}</code>`:r}</div>`:r}
        ${t?i`<div class="muted" data-wkt-reviewed>${s.drawer.reviewed}: <bdi>${this.time(t.impact.reviewed_at)}</bdi> · <span data-wkt-ttl>${s.drawer.expires(n)}</span></div>
              ${t.kind==="person"?i`<div class="cmp" data-wkt-compare>
                    <span class="h"></span><span class="h">${s.drawer.managed}</span><span class="h">${s.drawer.device}</span>
                    ${o(s.drawer.side.name,"name",["display_name","presence"])} ${o(s.drawer.side.validity,"validity",["validity"])}
                    ${o(s.drawer.side.doors,"doors",["door_rights"])} ${o(s.drawer.side.pin,"pin",["pin"])} ${o(s.drawer.side.cards,"cards",["cards"])}
                  </div>`:i`<div class="cmp" data-wkt-compare><span class="h"></span><span class="h">${s.drawer.device}</span><span class="h"></span>
                    ${["name","doors","cards"].map(a=>i`<span>${s.drawer.side[a]}</span><span><bdi>${this.side(t.impact.device,a)}</bdi></span><span></span>`)}</div>`}
              <div>
                <b>${s.drawer.differences}</b>
                <div class="chips" data-wkt-diffs>${t.impact.differences.length?t.impact.differences.map(a=>i`<span class="chip">${s.drawer.field[a]??s.drawer.field.other}</span>`):i`<span class="muted">${s.drawer.noDifferences}</span>`}</div>
              </div>
              ${t.impact.plan&&t.kind==="person"?i`<div data-wkt-plan><b>${s.drawer.plan}</b><ul>
                    <li>${s.drawer.planPerson[t.impact.plan.person??"unknown"]??s.drawer.planPerson.unknown}</li>
                    <li>${s.drawer.planPin[t.impact.plan.pin??"unknown"]??s.drawer.planPin.unknown}</li>
                    <li>${s.drawer.cards(t.impact.plan.cards_add??0,t.impact.plan.cards_remove??0,t.impact.plan.cards_update??0)}</li>
                  </ul></div>`:r}
              ${t.impact.affected_stations.length?i`<div data-wkt-affected><b>${s.drawer.affected}</b><div class="chips">${t.impact.affected_stations.map(a=>i`<span class="chip"><bdi>${this.station(a)}</bdi></span>`)}</div>
                    ${t.kind==="person"?i`<div class="muted">${s.drawer.affectedHint}</div>`:r}</div>`:r}
              ${t.impact.unverified_fields.includes("pin")?i`<div class="note">${s.drawer.unverified}</div>`:r}
              <div><b>${s.drawer.choose}</b></div>
              ${Y(t).map(a=>i`<div class="choice" data-wkt-choice=${a.direction} data-allowed=${String(a.allowed)}>
                  <b>${s.direction[a.direction].label}</b>
                  <span class="muted">${s.direction[a.direction].hint}</span>
                  ${a.allowed?i`<div><sw-button size="sm" variant=${a.direction==="central"?"primary":"secondary"} data-wkt-choose=${a.direction}
                        ?disabled=${this.sending||n<=0||!!this.resolved} @click=${()=>this.asking=a.direction}>${s.direction[a.direction].label}</sw-button></div>`:i`<span class="why">${s.drawer.notAllowed}: ${s.reason[a.reason??"unknown"]??a.reason}</span>`}
                </div>`)}
              ${this.resolved?i`<div data-wkt-resolved>${this.renderResult(this.resolved)}</div>`:r}`:r}
        ${this.renderConfirm()}
      </div>
      <sw-button slot="footer" variant="ghost" data-wkt-close @click=${()=>this.closeReview()}>${s.drawer.close}</sw-button>
      ${!this.reviewBusy&&(this.reviewError||this.resolved||t&&n<=0)?i`<sw-button slot="footer" icon="refresh" data-wkt-again @click=${()=>this.openReview(e)}>${s.drawer.again}</sw-button>`:r}
    </sw-drawer>`}renderConfirm(){const e=this.asking;return e?i`<sw-dialog open heading=${s.confirm.heading} data-wkt-confirm @close=${t=>{t.stopPropagation(),this.asking=null}}>
      <div class="dlg">
        <b>${s.direction[e].label}</b>
        <div>${s.direction[e].hint}</div>
        <div class="muted">${s.confirm.body}</div>
      </div>
      <div class="dfoot">
        <sw-button variant="ghost" @click=${()=>this.asking=null}>${s.confirm.cancel}</sw-button>
        <sw-button variant=${e==="central"?"primary":"danger"} data-wkt-confirm-ok ?disabled=${this.sending} @click=${()=>this.resolve(e)}>${this.sending?s.status.sending:s.confirm.ok}</sw-button>
      </div>
    </sw-dialog>`:r}visibleAlerts(){const e=this.alerts??[];return this.mode==="full"&&this.showSnoozed?e:e.filter(t=>!t.suppressed)}ask(e,t,n=t==="restore"?se(e):e.kind){this.draft={alert:e,action:t,kind:n,duration:60,reason:n==="maintenance"?"planned_maintenance":"investigating"}}async sendAlert(){const e=this.draft;if(!e||this.alertBusy||!e.alert.station_id)return;this.alertBusy=!0;const t=y(e.alert);this.results={...this.results,[t]:{status:"sending",code:null,message:"",retry_after_s:null}};let n;try{await Q(e.alert.station_id,e.kind,e.action,e.duration,e.reason),n={status:"completed",code:null,message:"",retry_after_s:null}}catch(d){n=v(d)}this.results={...this.results,[t]:n},this.draft=null,this.alertBusy=!1,(n.status==="completed"||n.status==="stale")&&this.load()}renderAlerts(){const e=!!this.view?.may_act_alerts,t=this.visibleAlerts(),n=this.mode==="compact"?t.slice(0,_):t;return i`<section class="wrap" data-wkt-alerts>
      <div class="bar">
        ${this.mode==="compact"?i`<h4>${s.alerts.heading}</h4>`:r}
        <span class="muted" data-wkt-alert-count>${s.alerts.count(this.alertCounts.active,this.alertCounts.snoozed)}</span>
        <span class="sp"></span>
        ${this.mode==="full"?i`<label class="chk"><input type="checkbox" data-wkt-show-snoozed .checked=${this.showSnoozed} @change=${d=>this.showSnoozed=d.target.checked} />${s.alerts.showSnoozed}</label>`:r}
      </div>
      ${this.alertsError?i`<div class="err" role="alert">${this.alertsError}</div>`:r}
      ${this.alerts===null?r:n.length===0?i`<div class="list"><div class="empty" data-wkt-empty>${s.alerts.empty}</div></div>`:i`<div class="list">${n.map(d=>this.renderAlert(d,e))}</div>
              ${n.length<t.length?i`<a class="more" href="#/wiskey/alerts" data-wkt-more>${s.openFull} (${t.length})</a>`:r}`}
      ${this.mode==="full"?i`<div class="note" data-wkt-no-ack>${s.alerts.noAck}</div>`:r}
    </section>`}renderAlert(e,t){const n=y(e),d=this.results[n],o=this.view?.recent?.alerts?.[n];return i`<div class="row" data-wkt-alert=${e.id} data-suppressed=${String(e.suppressed)}>
      <div class="main">
        <b>${s.alerts.kind[e.kind]??s.alerts.kind.other}</b>
        <span class="sub"><bdi>${e.station_name||this.station(e.station_id)}</bdi></span>
      </div>
      <div class="main">
        ${e.suppressed&&e.suppression?i`<span>${s.alerts.snoozedUntil} <bdi>${this.time(e.suppression.until)}</bdi></span><span class="sub">${s.alerts.reasons[e.suppression.reason??""]??""}${e.suppression.kind==="maintenance"?` · ${s.alerts.kind.maintenance}`:""}</span>`:i`<span class="sub">${s.alerts.since} <bdi>${this.time(e.observed_since)}</bdi></span>`}
      </div>
      <sw-badge kind=${e.suppressed?"neutral":e.severity==="error"?"error":"stale"} label=${e.suppressed?s.alerts.snooze:s.alerts.severity[e.severity]??e.severity}></sw-badge>
      <div class="acts">
        ${t&&e.station_id?te(e).map(a=>a==="snooze"?i`<sw-button size="sm" icon="bellOff" data-wkt-snooze ?disabled=${d?.status==="sending"} @click=${()=>this.ask(e,"snooze")}>${s.alerts.snooze}</sw-button>`:i`<sw-button size="sm" icon="bell" data-wkt-restore ?disabled=${d?.status==="sending"} @click=${()=>this.ask(e,"restore")}>${s.alerts.restore}</sw-button>`):r}
      </div>
      ${d?this.renderResult(d):o?this.renderResult({status:o.status,code:o.code,message:"",retry_after_s:null},o.at):r}
    </div>`}renderAlertDialog(){const e=this.draft;if(!e)return r;const t=e.action==="snooze";return i`<sw-dialog open heading=${t?s.alerts.confirmSnooze:s.alerts.confirmRestore} data-wkt-alert-dialog @close=${n=>{n.stopPropagation(),this.draft=null}}>
      <div class="dlg">
        <b>${s.alerts.kind[e.alert.kind]??e.alert.kind} · <bdi>${e.alert.station_name||this.station(e.alert.station_id)}</bdi></b>
        ${t?i`<label class="chk"><input type="checkbox" data-wkt-whole-station .checked=${e.kind==="maintenance"}
                @change=${n=>this.draft={...e,kind:n.target.checked?"maintenance":e.alert.kind}} />${s.alerts.stationSnooze}</label>
              <div class="f"><span>${s.alerts.durationLabel}</span>
                <sw-dropdown block data-wkt-duration label=${s.alerts.durationLabel} .value=${String(e.duration)}
                  .items=${K.map(n=>({id:String(n),label:s.alerts.duration[n]}))}
                  @change=${n=>this.draft={...e,duration:Number(n.detail.id)}}></sw-dropdown></div>
              <div class="f"><span>${s.alerts.reasonLabel}</span>
                <sw-dropdown block data-wkt-reason label=${s.alerts.reasonLabel} .value=${e.reason}
                  .items=${H.map(n=>({id:n,label:s.alerts.reasons[n]}))}
                  @change=${n=>this.draft={...e,reason:n.detail.id}}></sw-dropdown></div>`:e.kind==="maintenance"?i`<div>${s.alerts.kind.maintenance}</div>`:r}
        <div class="muted">${s.alerts.confirmBody}</div>
      </div>
      <div class="dfoot">
        <sw-button variant="ghost" @click=${()=>this.draft=null}>${s.confirm.cancel}</sw-button>
        <sw-button variant="primary" data-wkt-alert-ok ?disabled=${this.alertBusy} @click=${()=>this.sendAlert()}>${this.alertBusy?s.status.sending:t?s.alerts.snooze:s.alerts.restore}</sw-button>
      </div>
    </sw-dialog>`}async setNotify(e){this.notifyBusy=!0;try{const t=await X(e);this.view&&(this.view={...this.view,notify:t.notify})}catch(t){this.error=u(t)}finally{this.notifyBusy=!1}}renderNotify(){const e=this.view?.notify;return!e||this.mode!=="full"?r:i`<div class="notify" data-wkt-notify=${e.enabled?"on":"off"}>
      <div class="main"><b>${s.notify.label}</b><span class="sub">${s.notify.hint}</span>${e.can_edit?r:i`<span class="sub">${s.notify.noEdit}</span>`}</div>
      ${this.renderNotifyPick(e.enabled,!e.can_edit||this.notifyBusy)}
    </div>`}renderNotifyPick(e,t){return i`<sw-dropdown data-wkt-notify-select label=${s.notify.label} .value=${e?"on":"off"}
      .items=${[{id:"off",label:s.notify.off},{id:"on",label:s.notify.on}]}
      ?inert=${t} aria-disabled=${t?"true":r} style=${t?"opacity: var(--sw-disabled-opacity)":""}
      @change=${n=>this.setNotify(n.detail.id==="on")}></sw-dropdown>`}render(){if(this.phase==="loading"&&!this.view)return i`<div class="note" data-wkt-loading aria-busy="true">${s.loading}</div>`;if(this.phase==="error"&&!this.view)return i`<div class="err" role="alert" data-wkt-error>${this.error}</div>`;const e=!!this.view?.may_resolve,t=this.conflicts?.length??0,n=this.alertCounts.active;return i`<div class="wrap" data-wkt-panel=${this.mode}>
      <div class="bar">
        ${this.mode==="full"?i`<div class="tabs" role="tablist">
              <button role="tab" data-wkt-tab="conflicts" aria-selected=${String(this.tab==="conflicts")} @click=${()=>this.switchTab("conflicts")}>${s.tabs.conflicts}<span class="n">${t}</span></button>
              <button role="tab" data-wkt-tab="alerts" aria-selected=${String(this.tab==="alerts")} @click=${()=>this.switchTab("alerts")}>${s.tabs.alerts}<span class="n">${n}</span></button>
            </div>`:r}
        <span class="sp"></span>
        ${this.mode==="compact"?i`<a href="#/wiskey/conflicts" data-wkt-open-full>${s.openFull}</a>`:r}
        <sw-button size="sm" variant="ghost" icon="refresh" data-wkt-refresh @click=${()=>this.load()}>${s.refresh}</sw-button>
      </div>
      ${this.error?i`<div class="err" role="alert">${this.error}</div>`:r}
      ${!e&&this.view?i`<div class="note" data-wkt-readonly>${s.readOnly}</div>`:r}
      ${this.mode==="compact"?i`${this.renderConflicts()} ${this.renderAlerts()}`:this.tab==="alerts"?i`${this.renderAlerts()} ${this.renderNotify()}`:this.renderConflicts()}
      ${this.renderReview()} ${this.renderAlertDialog()}
    </div>`}switchTab(e){e!==this.tab&&(this.tab=e,this.dispatchEvent(new CustomEvent("wkt-tab",{detail:{tab:e},bubbles:!0,composed:!0})))}};l.styles=U`
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
  `;c([z()],l.prototype,"mode",2);c([z()],l.prototype,"tab",2);c([h()],l.prototype,"view",2);c([h()],l.prototype,"conflicts",2);c([h()],l.prototype,"alerts",2);c([h()],l.prototype,"alertCounts",2);c([h()],l.prototype,"names",2);c([h()],l.prototype,"zone",2);c([h()],l.prototype,"phase",2);c([h()],l.prototype,"error",2);c([h()],l.prototype,"conflictsError",2);c([h()],l.prototype,"alertsError",2);c([h()],l.prototype,"showSnoozed",2);c([h()],l.prototype,"results",2);c([h()],l.prototype,"reviewing",2);c([h()],l.prototype,"review",2);c([h()],l.prototype,"reviewError",2);c([h()],l.prototype,"reviewBusy",2);c([h()],l.prototype,"asking",2);c([h()],l.prototype,"sending",2);c([h()],l.prototype,"resolved",2);c([h()],l.prototype,"draft",2);c([h()],l.prototype,"alertBusy",2);c([h()],l.prototype,"notifyBusy",2);c([h()],l.prototype,"now",2);l=c([W("wk-triage-panel")],l);export{ce as m,s as t};
