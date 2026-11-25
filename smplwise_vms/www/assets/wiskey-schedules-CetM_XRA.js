import{bf as I,gn as We,g as Z,bq as Fe,bs as Be,br as He,bt as Ue,y as $,i as Q,A as d,b as o,eh as z,k as ee,a as ne,iv as Ke,E as H,bN as Je,hL as Ve,dj as Ye,j as p,am as U,kX as Ge,ae as se,d0 as Xe,o as Ze,d6 as we,aL as K,af as fe}from"./index-CqeTnh_F.js";import"./sw-table-DkDc_4e_.js";import"./sw-view-switch-CNRV4o-X.js";import"./sw-week-grid-B1HQVa_z.js";import"./wk-deep-links-LVL0__Wk.js";import{g as Qe,a as es,b as ss,c as ts}from"./access-stations-DAxU-mE3.js";import{T as te,s as me,P as as,d as ae,p as be,i as is,a as c,b as J,f as ns,c as ve,C as rs,e as os,g as ls,h as ds,j as cs,k as hs,l as ps,t as us,m as ws,n as fs,o as ms}from"./schedules-logic-ol_xhfN8.js";import"./sw-logo-art-PLtEZJxU.js";import"./deep-links-SW-Nleky.js";import"./wiskey-format-WtbwA7hz.js";import"./wiskey-DzTfTTyN.js";const bs=()=>I("access-control/schedules"),vs=()=>I("access-control/schedules/plans"),gs=()=>I("access-control/schedules/operations"),$s=Z`
  :host {
    display: block;
    --sch-hit: var(--sw-touch-desktop, 44px);
  }
  @media (max-width: 1100px) {
    :host {
      --sch-hit: 44px;
    }
  }
  .status {
    margin: 0;
    padding: var(--sw-s-1) var(--sw-s-3);
    border-radius: var(--sw-r-md);
    background: var(--sw-stale-soft);
    color: var(--sw-stale-text);
    font-size: var(--sw-fs-sm);
  }
  .layout {
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    gap: var(--sw-s-4);
    align-items: start;
    margin-block-start: var(--sw-s-3);
  }
  .layout.solo {
    grid-template-columns: minmax(0, 1fr);
  }
  .doorcol {
    position: sticky;
    inset-block-start: var(--sw-s-3);
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-4);
    min-inline-size: 0;
  }

  /* ---- the door list (a card on a desktop, a sheet on a phone) ---- */
  nav.doors {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sw-s-2);
  }
  .doors .ttl {
    padding: var(--sw-s-2) var(--sw-s-3) var(--sw-s-1);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-3);
  }
  .doors .station {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    padding: var(--sw-s-2) var(--sw-s-3) 0;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  .dot {
    flex: none;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--sw-live);
  }
  .dot.off {
    background: var(--sw-offline);
  }
  .doors button {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-block-size: var(--sch-hit);
    padding-inline: var(--sw-s-3) var(--sw-s-3);
    padding-inline-start: var(--sw-s-5);
    border: 0;
    border-radius: var(--sw-r-sm);
    background: transparent;
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    text-align: start;
    cursor: pointer;
  }
  /* R5-SECURITY: a hover only under a fine pointer; the row sinks on pointer-down.
     AUDIT30-H (finding 14): the chosen door is Blue Wash + Blue Ink + semibold, no border (DESIGN.md: a selected tree / list row),
     not a solid accent field */
  @media (hover: hover) and (pointer: fine) {
    .doors button:hover {
      background: var(--sw-hover-wash);
    }
  }
  .doors button {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  .doors button:active {
    transform: scale(var(--sw-press-scale));
  }
  .doors button[aria-current='true'] {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    font-weight: var(--sw-fw-semibold);
  }
  .doors .station {
    color: var(--sw-heading, var(--sw-text));
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-bold);
  }
  sw-badge {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-bold);
    line-height: 18px;
    padding-block: 2px;
  }
  .doors button .name {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip {
    box-sizing: border-box;
    display: none;
    align-items: center;
    gap: var(--sw-s-2);
    max-inline-size: 100%;
    min-block-size: var(--sch-hit);
    padding-inline: var(--sw-s-4);
    border: 1px solid var(--sw-accent);
    border-radius: var(--sw-r-pill);
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    cursor: pointer;
  }
  .chip .name {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .doors button:focus-visible,
  .chip:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }

  /* ---- the door ---- */
  .doorhead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .doorhead h2 {
    margin: 0;
    min-inline-size: 0;
    /* R5-SECURITY: the door is the heading of the page's main column - 20/800 */
    font-size: var(--sw-fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--sw-heading);
    overflow-wrap: anywhere;
  }
  .doorhead .sub {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .doorhead .sp {
    flex: 1;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    padding: var(--sw-s-4);
    min-inline-size: 0;
  }
  .bh {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .bh h3 {
    margin: 0;
    font-size: var(--sw-fs-lg);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
  }
  .bh .n {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    font-variant-numeric: tabular-nums;
  }
  .bh .sp {
    flex: 1;
  }
  .prog {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .prog .name {
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-md);
    color: var(--sw-heading, var(--sw-text));
    overflow-wrap: anywhere;
  }
  .row .t {
    font-size: var(--sw-fs-md);
    color: var(--sw-heading, var(--sw-text));
  }
  ${We}
  .lines {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
    font-variant-numeric: tabular-nums;
  }
  .dates h4 {
    margin: 0 0 var(--sw-s-1);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  sw-week-grid {
    max-inline-size: 100%;
  }

  /* ---- the library and the proposals ---- */
  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sw-s-4);
    margin-block-start: var(--sw-s-4);
  }
  sw-table {
    margin-block-start: var(--sw-s-3);
  }
  .rows {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: var(--sw-s-3);
    padding-block: var(--sw-s-3);
    border-block-start: 1px solid var(--sw-border);
  }
  .row:first-child {
    border-block-start: 0;
  }
  .row .main {
    flex: 1;
    gap: 2px;
  }
  .row .t {
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text);
    overflow-wrap: anywhere;
  }
  .row .s {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    overflow-wrap: anywhere;
  }
  .row sw-badge {
    flex: none;
  }

  @media (max-width: 1100px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 819px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .doorcol {
      display: none;
    }
    .chip {
      display: inline-flex;
    }
    /* the door chip already names the door on a phone: the title would repeat it */
    .doorhead h2 {
      display: none;
    }
    .block {
      padding: var(--sw-s-3);
    }
  }
`;function ge(e){return e("access.schedules.manage")||e("system.configure")}const R=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],ys=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],ks=["Sunday","Monday","Tuesday","Wednesday","Thursday"],G=8,_s=64,xs=32,re=/^(?:[01]\d|2[0-3]):[0-5]\d$/,oe=/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/,Ss=/^\d{4}-\d{2}-\d{2}$/,le=()=>Object.fromEntries(R.map(e=>[e,[]])),$e=(e="")=>({name:e,weekly:le(),holidays:[]});function ye(e){const s=le();for(const t of R)s[t]=(e.weekly?.[t]??[]).map(a=>({start:a.start,end:a.end}));return{name:e.name??"",weekly:s,holidays:(e.holidays??[]).map(t=>({name:t.name??"",start:t.start??"",end:t.end??"",periods:(t.periods??[]).map(a=>({start:a.start,end:a.end}))}))}}const Ts=(e,s)=>JSON.stringify(X(e))===JSON.stringify(X(s));function X(e){const s=t=>[...t].sort((a,i)=>a.start.localeCompare(i.start));return{name:e.name,weekly:Object.fromEntries(R.map(t=>[t,s(e.weekly[t]??[])])),holidays:[...e.holidays].map(t=>({...t,periods:s(t.periods)})).sort((t,a)=>t.start.localeCompare(a.start))}}const _=e=>e==="24:00"?1440:Number(e.slice(0,2))*60+Number(e.slice(3,5));function ke(e,s){if(e.length>G)return[{code:"schedule_period_limit",where:s}];const t=[];if(e.forEach((i,r)=>{!re.test(i.start)||!oe.test(i.end)?t.push({code:"schedule_invalid_time",where:`${s}.${r}`}):_(i.start)>=_(i.end)&&t.push({code:"schedule_invalid_time",where:`${s}.${r}`})}),t.length)return t;const a=[...e].sort((i,r)=>_(i.start)-_(r.start));for(let i=1;i<a.length;i++)if(_(a[i-1].end)>_(a[i].start))return[{code:"schedule_overlap",where:s}];return[]}function P(e){if(!Ss.test(e))return!1;const[s,t,a]=e.split("-").map(Number),i=new Date(Date.UTC(s,t-1,a));return s>=2e3&&s<=2037&&i.getUTCMonth()===t-1&&i.getUTCDate()===a}function _e(e){return e.length>xs||!e.trim()||/[\u0000-\u001f]/.test(e)}function As(e){const s=[];_e(e.name)&&s.push({code:"invalid_text",where:"name"});for(const a of R)s.push(...ke(e.weekly[a]??[],`weekly.${a}`));e.holidays.length>_s&&s.push({code:"schedule_holiday_limit",where:"holidays"}),e.holidays.forEach((a,i)=>{const r=`holidays.${i}`;_e(a.name)&&s.push({code:"invalid_text",where:`${r}.name`}),P(a.start)||s.push({code:"schedule_invalid_date",where:`${r}.start`}),P(a.end)||s.push({code:"schedule_invalid_date",where:`${r}.end`}),P(a.start)&&P(a.end)&&a.start>a.end&&s.push({code:"schedule_invalid_date",where:r}),s.push(...ke(a.periods,`${r}.periods`))});const t=e.holidays.filter(a=>P(a.start)&&P(a.end)).sort((a,i)=>a.start.localeCompare(i.start));for(let a=1;a<t.length;a++)if(t[a-1].end>=t[a].start){s.push({code:"schedule_holiday_overlap",where:"holidays"});break}return s}const y=(e,s)=>e.find(t=>t.where===s||t.where.startsWith(`${s}.`));function de(e,s,t){return{...e,weekly:{...e.weekly,[s]:t}}}function zs(e){if(e.length>=G)return null;if(!e.length)return{start:"08:00",end:"17:00"};const s=Math.max(...e.map(i=>_(i.end)));if(s>=1439)return null;const t=Math.min(1440,s+60),a=i=>i===1440?"24:00":`${String(Math.floor(i/60)).padStart(2,"0")}:${String(i%60).padStart(2,"0")}`;return{start:a(s),end:a(t)}}function Ds(e,s){const t=zs(e.weekly[s]??[]);return t?de(e,s,[...e.weekly[s]??[],t]):e}function js(e,s,t){return de(e,s,(e.weekly[s]??[]).filter((a,i)=>i!==t))}function xe(e,s,t,a,i){return de(e,s,(e.weekly[s]??[]).map((r,l)=>l===t?{...r,[a]:i}:r))}function Os(e,s,t){const a={...e.weekly};for(const i of t)i!==s&&(a[i]=(e.weekly[s]??[]).map(r=>({...r})));return{...e,weekly:a}}function Is(e,s){const t={name:"",start:s,end:s,periods:[]};return{...e,holidays:[...e.holidays,t]}}function j(e,s,t){return{...e,holidays:e.holidays.map((a,i)=>i===s?{...a,...t}:a)}}function Rs(e,s){return{...e,holidays:e.holidays.filter((t,a)=>a!==s)}}function Ne(e){return R.map(s=>(e[s]??[]).filter(t=>re.test(t.start)&&oe.test(t.end)).map(t=>({begin:`${t.start}:00`,end:`${t.end}:00`})))}function Es(e,s){const t=Ne(s),a=le();return R.forEach((i,r)=>{const l=(e[r]??[]).map(m=>({start:m.begin.slice(0,5),end:m.end.slice(0,5)==="24:00"?"24:00":m.end.slice(0,5)})),h=JSON.stringify(Se(e[r]??[]))===JSON.stringify(Se(t[r]??[]));a[i]=h?(s[i]??[]).map(m=>({...m})):l}),a}function Se(e){const s=Array.from({length:24},()=>!1);for(const t of e){const a=Math.floor(_(t.begin.slice(0,5))/60),i=Math.min(24,Math.ceil(_(t.end.slice(0,5))/60));for(let r=a;r<i;r++)s[r]=!0}return s}function Pe(e){return R.reduce((s,t)=>s+(e[t]??[]).reduce((a,i)=>re.test(i.start)&&oe.test(i.end)?a+Math.max(0,_(i.end)-_(i.start)):a,0),0)}function ce(e,s){const a=e?.checks.find(i=>i.kind===s)?.capabilities?.ids;return Array.isArray(a)&&a.length===2?[a[0],a[1]]:null}function Te(e,s,t){if(t&&t.holidays.length===e&&e===0==(t.holiday_group===null))return{...t,holidays:[...t.holidays]};const a=(r,l)=>ce(s,r)?.[1]??l,i=a("holiday",64);return{template:a("template",1),weekly:a("weekly",1),holiday_group:e?a("holiday_group",1):null,holidays:Array.from({length:e},(r,l)=>Math.max(1,i-l))}}function Ae(e,s){const t={},a=(i,r,l)=>{if(l===null||!Number.isInteger(l)||l<1||l>65535)t[i]="schedule_binding_invalid";else{const h=ce(s,r);h&&(l<h[0]||l>h[1])&&(t[i]="schedule_binding_out_of_range")}};return a("template","template",e.template),a("weekly","weekly",e.weekly),e.holidays.length&&a("holiday_group","holiday_group",e.holiday_group),e.holidays.forEach((i,r)=>a(`holidays.${r}`,"holiday",i)),new Set(e.holidays).size!==e.holidays.length&&(t.holidays="schedule_binding_invalid"),t}function ze(e){switch(e){case"verified":case"ready":return"live";case"blocked":case"interrupted":return"stale";case"failed":return"error";case"cancelled":return"offline";case"pending":case"queued":case"checking":return"neutral";default:return"unknown"}}const De=e=>e==="pending"||e==="queued"||e==="checking";function Ns(e){return e.status==="queued"?"neutral":e.status==="refused"?"error":e.status==="not_sent"?"offline":"unknown"}function V(e){const s=new Date(e),t=a=>String(a).padStart(2,"0");return{date:`${s.getFullYear()}-${t(s.getMonth()+1)}-${t(s.getDate())}`,time:`${t(s.getHours())}:${t(s.getMinutes())}`}}const Ce={manageTitle:"ניהול ספריית לוחות הזמנים",manageOpen:"ניהול הספרייה",newSchedule:"לוח זמנים חדש",importFile:"ייבוא מקובץ",exportFile:"ייצוא לקובץ",edit:"עריכה",remove:"מחיקה",deploy:"פריסה לעמדות",assess:"בדיקת התאמה לעמדה",editorNew:"לוח זמנים חדש",editorEdit:"עריכת {name}",name:"שם",namePlaceholder:"למשל: שעות משרד",weekTitle:"שבוע",gridHint:"גרירה על הלוח מסמנת שעות שלמות; לדקות מדויקות ערכו את השעות בכל יום",addWindow:"הוספת חלון",removeWindow:"הסרת החלון",from:"מ־",to:"עד",closedDay:"סגור",copyTo:"העתקה לימי חול",copyAll:"העתקה לכל השבוע",holidaysTitle:"חגים ותאריכים מיוחדים",holidaysHint:"בתאריכים אלה חלים החלונות של החג במקום השבוע",addHoliday:"הוספת תאריך מיוחד",holidayName:"שם",holidayFrom:"מתאריך",holidayTo:"עד תאריך",holidayClosed:"סגור כל היום",removeHoliday:"הסרת התאריך",summaryHours:"{h} שעות בשבוע",checkTitle:"בדיקה מקדימה",checkAt:"בדיקה לתאריך ושעה",checkRun:"בדיקה",checkOpen:"ב־{date} {time} הדלתות ייפתחו לפי לוח הזמנים ({source})",checkClosed:"ב־{date} {time} לוח הזמנים סגור ({source})",sourceWeekly:"לפי השבוע",sourceHoliday:"לפי {name}",checkNeeded:"לפני שמירה יש להריץ בדיקה מקדימה",checkStale:"הטיוטה השתנתה מאז הבדיקה - יש לבדוק שוב",checkOk:"הבדיקה עברה",save:"שמירה",cancel:"ביטול",close:"סגירה",saving:"שומר…",confirmSaveTitle:"לשמור את לוח הזמנים?",confirmSaveNew:'לוח הזמנים "{name}" יתווסף לספרייה. הוא לא נשלח לאף עמדה עד שתפרסו אותו.',confirmSaveEdit:'לוח הזמנים "{name}" יעודכן בספרייה (גרסה {rev}).',affectsPlans:'יש לו הצעות פריסה ל־{stations}. אחרי השמירה הן יסומנו "הספרייה השתנתה" ויהיה צורך להכין אותן מחדש.',confirmDeleteTitle:"למחוק את לוח הזמנים?",confirmDelete:'לוח הזמנים "{name}" יימחק מהספרייה.',confirmSend:"אישור",saved:"נשמר בספרייה",deleted:"נמחק מהספרייה",importTitle:"ייבוא לוחות זמנים",importPick:"בחירת קובץ",importPreview:"{n} לוחות זמנים בקובץ · {c} בשם שכבר קיים",importAppend:"הייבוא מוסיף לספרייה ואינו מחליף לוחות קיימים",importApply:"ייבוא",importDone:"יובאו {n} לוחות זמנים",importTooLarge:"הקובץ גדול מדי לייבוא מכאן",importRow:"{name} · {p} חלונות · {h} חגים",assessTitle:"התאמה לעמדה",pickStation:"עמדה",assessRun:"בדיקה",assessFits:"לוח הזמנים מתאים ליכולות העמדה",assessExceeds:"לוח הזמנים חורג מיכולות העמדה",assessUnknown:"העמדה לא דיווחה על כל היכולות - לא ידוע אם הוא מתאים",limitRow:"{key}: נדרש {needed} · זמין {available}",baselineTitle:"נקודת השוואה",baselineState:"מצב: {state}",baselineSave:"שמירה כנקודת השוואה",baselineClear:"ניקוי נקודת ההשוואה",baselineSaved:"נקודת ההשוואה נשמרה",baselineCleared:"נקודת ההשוואה נוקתה",deployTitle:'פריסת "{name}" לעמדות',deployStations:"עמדות",deployStep1:"בחירת עמדות ומשבצות",deployStep2:"בדיקה מקדימה",deployStep3:"אישור ופריסה",slotsTitle:"משבצות בעמדה",slotsHint:"מספרי המשבצות בעמדה ללוח הזמנים. הטווח לפי מה שהעמדה דיווחה",slotTemplate:"תבנית",slotWeekly:"שבוע",slotGroup:"קבוצת חגים",slotHoliday:"חג {n}",range:"טווח {a}-{b}",readStation:"קריאת העמדה",reading:"קורא את העמדה… (עד שתי דקות)",previewRun:"בדיקה מקדימה",previewAll:"בדיקה מקדימה לכל העמדות",impactTitle:"מה ייפגע",impactStation:"עמדה: {name}",impactDoors:"דלתות: {doors}",impactNoDoors:"לעמדה אין דלתות מנוהלות",impactPeople:"{explicit} אנשים עם לוח זמנים משלהם · {implicit} לפי ברירת המחדל של העמדה · {read} נקראו",impactPeopleUnknown:"לא ידוע כמה אנשים בעמדה (הקריאה נכשלה)",conflictsTitle:"התנגשויות",resourceRow:"{kind} {id}: {state}",externalRef:"בשימוש מחוץ להצעה",activeRes:"פעיל בעמדה",blockersTitle:"חוסמים",savePlans:"שמירת ההצעות",plansSaved:"נשמרו {n} הצעות פריסה",deployNow:"פריסה",confirmDeployTitle:"לפרוס ל־{n} עמדות?",confirmDeploy:"לכל עמדה תיווצר עבודת פריסה והבדיקה שלה תרוץ ברקע. ייכתב לעמדה רק מה שהמערכת מאשרת.",progressTitle:"התקדמות הפריסה",progressDone:"הפריסה הסתיימה",progressRunning:"בודק את העמדות…",jobLine:"{station}: {status}",writesOff:'WisKey עדיין לא מאשר כתיבה של לוחות זמנים לעמדות - כל עבודה תיעצר ב"חסום" ולא ייכתב דבר לעמדה.',deployWritesOff:'שימו לב: כרגע פריסה לא משנה דבר בעמדות. WisKey עדיין לא הפעיל כתיבה של לוחות זמנים לעמדות, ולכן פריסה רק יוצרת עבודה ומריצה בדיקה מקדימה. העבודה תיעצר במצב "חסום" ושום דבר לא ייכתב לעמדה. ההודעה תיעלם כש־WisKey יפעיל את הכתיבה.',confirmDeployWritesOff:'כרגע WisKey לא כותב לוחות זמנים לעמדות: העבודות ייווצרו וייבדקו, ייעצרו במצב "חסום", ושום דבר לא ייכתב לעמדות.',jobsTitle:"עבודות פריסה",jobsEmpty:"אין עבודות פריסה",jobRecheck:"בדיקה שוב",jobCancel:"ביטול",jobArchive:"לארכיון",plansTitle:"הצעות פריסה",planRecheck:"בדיקה חוזרת",planDelete:"מחיקת ההצעה",planClaim:"לקיחת אחריות",planRelease:"שחרור אחריות",claimed:"באחריות Arx",confirmPlanDelete:"למחוק את הצעת הפריסה ל־{station}?",confirmClaimTitle:"לקחת אחריות על המשבצות?",confirmClaim:"המשבצות {keys} בעמדה {station} יסומנו כמנוהלות מכאן. זו הצהרה בלבד: היא לא כותבת לעמדה.",confirmRelease:"לשחרר את האחריות על המשבצות?",confirmRecheck:"לקרוא שוב את העמדה ולעדכן את ההצעה?",confirmJob:'לבצע "{action}" לעבודה של {station}?',done:"בוצע",st_queued:"בתור",st_refused:"נדחה",st_unknown:"לא ידוע אם בוצע",st_not_sent:"לא נשלח",refusedBy:"WisKey סירב: {reason}",notSent:"לא נשלח: {reason}",unknownOutcome:"נשלח ולא התקבלה תשובה ברורה - ייתכן שבוצע. רעננו ובדקו לפני שמנסים שוב.",noStations:"אין עמדות מחוברות",offline:"לא מחוברת",stationsPicked:"עמדות שנבחרו: {n}",stale:"הנתונים אינם עדכניים - רעננו לפני שינוי",forbidden:"אין לך הרשאה לנהל את ספריית לוחות הזמנים",sr_title:"קריאות לוחות זמנים מהעמדה",sr_hint:"קריאה בלבד: WisKey קורא את העמדה ברקע ו־Arx בודק את המצב. שום דבר לא נכתב לעמדה, ו־Arx אינו מפעיל לוחות זמנים בעמדות.",sr_unsupported:"גרסת WisKey המחוברת אינה מציעה קריאות חתומות של לוחות זמנים - לא נשלח דבר.",sr_unavailable:"החיבור החתום ל־WisKey אינו זמין כרגע - לא נשלח דבר.",sr_failed:"לא ניתן היה לטעון את הקריאות.",sr_loading:"טוען…",sr_station:"עמדה",sr_readiness:"קריאת מוכנות",sr_dependencies:"קריאת תלויות",sr_check:"בדיקת מצב",sr_none:"עדיין לא נקראה עמדה.",sr_more:"ועוד {n} קודמות",sr_a_readiness:"מוכנות העמדה",sr_a_dependencies:"תלויות בעמדה",sr_a_assess:"התאמה לעמדה",sr_a_plan_preview:"הצעת פריסה",sr_a_plan_recheck:"בדיקה חוזרת של הצעה",sr_a_claim_preview:"בדיקת אחריות",sr_s_sending:"נשלח כעת",sr_s_not_sent:"לא נשלח",sr_s_accepted:"התקבל, ממתין",sr_s_running:"בקריאה",sr_s_completed:"הושלם",sr_s_refused:"WisKey סירב",sr_s_unknown:"לא ידוע",sr_unknownHint:"לא ידוע אם הקריאה התחילה - רק בדיקת מצב יכולה לומר. הבקשה לא תישלח שוב.",sr_sumReadiness:"{readable} מתוך {total} סוגים נקראו",sr_sumDependencies:"{users} משתמשים נקראו בעמדה",sr_sumPlan:"גרסת ההצעה שהוחזרה: {revision}",sr_sumDone:"התקבלה תשובה",sr_sumNoData:"הושלם, אך התשובה לא הייתה קריאה",sr_statusFailed:"בדיקת המצב לא הצליחה: {reason}"},Le=He("en","i18n/schedule-editor","en");function Ps(){return Be(["en"])}function n(e,s){const t=(Ps()==="en"?Le[e]:void 0)??Ce[e];return Fe(t,s)}const W={Sunday:"ראשון",Monday:"שני",Tuesday:"שלישי",Wednesday:"רביעי",Thursday:"חמישי",Friday:"שישי",Saturday:"שבת"},Cs={Sunday:"א׳",Monday:"ב׳",Tuesday:"ג׳",Wednesday:"ד׳",Thursday:"ה׳",Friday:"ו׳",Saturday:"ש׳"},Ls={template:"תבנית",weekly:"שבוע",holiday_group:"קבוצת חגים",holiday:"חג"},Ms={matches:"תואם",different:"שונה בעמדה",not_observed:"לא קיים בעמדה",unreadable:"לא נקרא",unsupported:"לא נתמך"},qs={missing:"אין",unchanged:"ללא שינוי",changed:"השתנה בעמדה",incomplete:"חלקי",identity_changed:"העמדה הוחלפה",unavailable:"לא זמין"},je={pending:"ממתין",queued:"בתור",checking:"בבדיקה",blocked:"חסום",ready:"מוכן",interrupted:"נקטע",failed:"נכשל",cancelled:"בוטל",verified:"אומת"},Ws={template_resources:"תבניות",weekly_resources:"שבועות",holiday_group_resources:"קבוצות חגים",holiday_resources:"חגים",weekly_per_day:"חלונות ביום",weekly_periods:"חלונות בשבוע",weekly_precision:"דיוק השעות",holiday_per_day:"חלונות בחג",holiday_periods:"חלונות בחג",holiday_precision:"דיוק שעות החג",weekdays:"ימים",holiday_membership:"חגים בקבוצה"},Fs={unauthorized:"לחשבון השירות של Arx אין הרשאת ניהול לוחות זמנים ב־WisKey",revision_conflict:"מישהו אחר שינה את הרשומה בינתיים",schedule_not_found:"לוח הזמנים לא נמצא",schedule_limit:"הספרייה מלאה (עד 100)",schedule_invalid_time:"שעה לא תקינה או סיום לפני התחלה",schedule_overlap:"חלונות חופפים באותו יום",schedule_period_limit:"יותר מ־8 חלונות ביום",schedule_invalid_week:"השבוע חייב לכלול את שבעת הימים",schedule_invalid_date:"תאריך לא תקין (2000-2037, התחלה לפני סוף)",schedule_holiday_limit:"יותר מ־64 תאריכים מיוחדים",schedule_holiday_overlap:"תאריכים מיוחדים חופפים",invalid_text:"שם ריק או ארוך מ־32 תווים",schedule_transfer_invalid:"הקובץ אינו קובץ ייצוא תקין",schedule_import_expired:"הבדיקה פגה או הוחלפה",schedule_plan_expired:"הבדיקה פגה או הוחלפה",schedule_claim_expired:"הבדיקה פגה או הוחלפה",schedule_baseline_expired:"הבדיקה פגה או הוחלפה",schedule_preview_required:"הבדיקה המקדימה חסרה או פגה",schedule_plan_resource_reserved:"המשבצות שמורות להצעה אחרת",schedule_binding_invalid:"מספרי משבצות לא תקינים",schedule_binding_out_of_range:"משבצת מחוץ לטווח של העמדה",schedule_compilation_limit:"חורג מיכולות העמדה",schedule_compilation_unknown:"העמדה לא דיווחה על יכולותיה",schedule_claim_conflict:"המשבצות כבר באחריות הצעה אחרת",schedule_claim_in_use:"עבודת פריסה פעילה משתמשת באחריות",schedule_operation_exists:"כבר קיימת עבודת פריסה להצעה",schedule_operation_retained:"העבודה עדיין רצה או אינה במצב סופי",schedule_source_changed:"לוח הזמנים השתנה מאז ההצעה",schedule_plan_device_changed:"העמדה הוחלפה מאז ההצעה",schedule_read_busy:"העמדה כבר נקראת",schedule_writes_unverified:"כתיבה לעמדה עדיין לא אומתה ב־WisKey",schedule_ownership_unknown:"לא הוצהרה אחריות על המשבצות",schedule_ownership_changed:"המשבצות השתנו מאז ההצהרה",schedule_inventory_incomplete:"קריאת העמדה לא הושלמה",schedule_plan_users_unreadable:"לא ניתן היה לקרוא את המשתמשים בעמדה",schedule_plan_user_defaults:"יש בעמדה משתמשים לפי ברירת מחדל",schedule_plan_external_references:"המשבצות בשימוש מחוץ להצעה",schedule_plan_capabilities_changed:"יכולות העמדה השתנו",schedule_plan_active_resources:"המשבצות פעילות בעמדה",schedule_plan_observation_incomplete:"חלק מהמשבצות לא נקראו",schedule_plan_holiday_membership_unknown:"לא ידוע כמה חגים קבוצה מקבלת",station_offline:"העמדה אינה מחוברת",connection_failed:"העמדה לא ענתה בזמן",authentication_failed:"העמדה דחתה את פרטי ההתחברות",schedule_operation_failed:"הבדיקה המוקדמת נכשלה",schedule_operation_interrupted:"הבדיקה נקטעה"},v=e=>e&&Fs[e]||e||"";Ue("i18n/schedule-editor",{he:Ce,en:Le});var Bs=Object.defineProperty,Hs=Object.getOwnPropertyDescriptor,C=(e,s,t,a)=>{for(var i=a>1?void 0:a?Hs(s,t):s,r=e.length-1,l;r>=0;r--)(l=e[r])&&(i=(a?l(s,t,i):l(i))||i);return a&&i&&Bs(s,t,i),i};let D=class extends Q{constructor(){super(...arguments),this.faults=[],this.narrow=!1,this.today="2026-01-01",this.disabled=!1}emit(e){this.dispatchEvent(new CustomEvent("draft-change",{detail:e,bubbles:!0,composed:!0}))}fault(e){const s=y(this.faults,e);return s?o`<span class="err" role="alert" data-se-fault=${e}>${v(s.code)}</span>`:d}render(){const e=this.draft;if(!e)return d;const s=!!y(this.faults,"name");return o`
      <div class="sec">
        <label class="field name">${n("name")}
          <input data-se-name maxlength="32" .value=${e.name} placeholder=${n("namePlaceholder")} aria-invalid=${String(s)} ?disabled=${this.disabled}
            @input=${t=>this.emit({...e,name:t.target.value})} />
        </label>
        ${this.fault("name")}
      </div>
      <div class="sec" data-se-week>
        <h4><sw-icon name="calendar" size=${14}></sw-icon>${n("weekTitle")}<span class="sum" data-se-hours>${n("summaryHours",{h:Math.round(Pe(e.weekly)/60*10)/10})}</span></h4>
        ${this.narrow?d:o`<sw-week-grid data-se-grid ?editable=${!this.disabled} .days=${Ne(e.weekly)} .modes=${[{id:"on",label:n("weekTitle"),color:"var(--sw-accent)"}]}
                @change=${t=>this.emit({...e,weekly:Es(t.detail.days,e.weekly)})}></sw-week-grid>
              <p class="hint">${n("gridHint")}</p>`}
        <div class="days">${ys.map(t=>this.renderDay(t))}</div>
      </div>
      <div class="sec" data-se-holidays>
        <h4><sw-icon name="star" size=${14}></sw-icon>${n("holidaysTitle")}<span class="sum">${e.holidays.length||""}</span></h4>
        <p class="hint">${n("holidaysHint")}</p>
        ${this.fault("holidays")}
        ${e.holidays.map((t,a)=>this.renderHoliday(a))}
        <div><wk-action-button tone="dashed" icon="plus" data-se-add-holiday ?disabled=${this.disabled||e.holidays.length>=64}
          @click=${()=>this.emit(Is(e,this.today))}>${n("addHoliday")}</wk-action-button></div>
      </div>
    `}renderDay(e){const s=this.draft,t=s.weekly[e]??[],a=this.narrow?Cs[e]:W[e];return o`<div class="day" data-se-day=${e}>
      <span class="dn" title=${W[e]}>${a}</span>
      <div class="wins">
        ${t.length?d:o`<span class="closed">${n("closedDay")}</span>`}
        ${t.map((i,r)=>{const l=!!y(this.faults,`weekly.${e}.${r}`);return o`<span class="win" data-se-win=${`${e}.${r}`} ?data-bad=${l}>
            <input type="time" lang=${z()} step="60" aria-label=${`${W[e]} ${n("from")}`} .value=${i.start} ?disabled=${this.disabled} data-se-start
              @change=${h=>this.emit(xe(s,e,r,"start",h.target.value))} />
            <span aria-hidden="true">–</span>
            <input type="time" lang=${z()} step="60" aria-label=${`${W[e]} ${n("to")}`} .value=${i.end==="24:00"?"23:59":i.end} ?disabled=${this.disabled} data-se-end
              @change=${h=>{const m=h.target.value;this.emit(xe(s,e,r,"end",m==="23:59"&&i.end==="24:00"?"24:00":m))}} />
            <button class="x" type="button" aria-label=${n("removeWindow")} data-se-remove-win ?disabled=${this.disabled} @click=${()=>this.emit(js(s,e,r))}><sw-icon name="close" size=${14}></sw-icon></button>
          </span>`})}
        <button class="x" type="button" aria-label=${`${n("addWindow")} · ${W[e]}`} title=${n("addWindow")} data-se-add-win=${e}
          ?disabled=${this.disabled||t.length>=G} @click=${()=>this.emit(Ds(s,e))}><sw-icon name="plus" size=${16}></sw-icon></button>
        ${e==="Sunday"&&t.length?o`<wk-action-button tone="quiet" icon="copy" data-se-copy ?disabled=${this.disabled} @click=${()=>this.emit(Os(s,"Sunday",ks))}>${n("copyTo")}</wk-action-button>`:d}
        ${this.fault(`weekly.${e}`)}
      </div>
    </div>`}renderHoliday(e){const s=this.draft,t=s.holidays[e],a=`holidays.${e}`;return o`<div class="hol" data-se-holiday=${e}>
      <label class="field hn">${n("holidayName")}
        <input maxlength="32" .value=${t.name} aria-invalid=${String(!!y(this.faults,`${a}.name`))} ?disabled=${this.disabled} data-se-hname
          @input=${i=>this.emit(j(s,e,{name:i.target.value}))} />
      </label>
      <label class="field">${n("holidayFrom")}
        <input type="date" lang=${z()} .value=${t.start} aria-invalid=${String(!!y(this.faults,`${a}.start`))} ?disabled=${this.disabled} data-se-hstart
          @change=${i=>this.emit(j(s,e,{start:i.target.value}))} />
      </label>
      <label class="field">${n("holidayTo")}
        <input type="date" lang=${z()} .value=${t.end} aria-invalid=${String(!!y(this.faults,`${a}.end`))} ?disabled=${this.disabled} data-se-hend
          @change=${i=>this.emit(j(s,e,{end:i.target.value}))} />
      </label>
      <button class="x" type="button" aria-label=${n("removeHoliday")} data-se-remove-holiday ?disabled=${this.disabled} @click=${()=>this.emit(Rs(s,e))}><sw-icon name="trash" size=${16}></sw-icon></button>
      <div class="wins">
        ${t.periods.length?d:o`<span class="closed">${n("holidayClosed")}</span>`}
        ${t.periods.map((i,r)=>o`<span class="win" ?data-bad=${!!y(this.faults,`${a}.periods.${r}`)}>
          <input type="time" lang=${z()} step="60" aria-label=${`${t.name} ${n("from")}`} .value=${i.start} ?disabled=${this.disabled}
            @change=${l=>this.emit(j(s,e,{periods:t.periods.map((h,m)=>m===r?{...h,start:l.target.value}:h)}))} />
          <span aria-hidden="true">–</span>
          <input type="time" lang=${z()} step="60" aria-label=${`${t.name} ${n("to")}`} .value=${i.end==="24:00"?"23:59":i.end} ?disabled=${this.disabled}
            @change=${l=>this.emit(j(s,e,{periods:t.periods.map((h,m)=>m===r?{...h,end:l.target.value}:h)}))} />
          <button class="x" type="button" aria-label=${n("removeWindow")} ?disabled=${this.disabled}
            @click=${()=>this.emit(j(s,e,{periods:t.periods.filter((l,h)=>h!==r)}))}><sw-icon name="close" size=${14}></sw-icon></button>
        </span>`)}
        <button class="x" type="button" aria-label=${n("addWindow")} data-se-add-hwin ?disabled=${this.disabled||t.periods.length>=G}
          @click=${()=>this.emit(j(s,e,{periods:[...t.periods,t.periods.length?{start:t.periods[t.periods.length-1].end==="24:00"?"23:00":t.periods[t.periods.length-1].end,end:"24:00"}:{start:"08:00",end:"13:00"}]}))}>
          <sw-icon name="plus" size=${16}></sw-icon></button>
        ${this.fault(`${a}.periods`)} ${this.fault(`${a}.start`)} ${this.fault(`${a}.end`)} ${y(this.faults,a)&&!y(this.faults,`${a}.start`)&&!y(this.faults,`${a}.end`)&&!y(this.faults,`${a}.periods`)&&!y(this.faults,`${a}.name`)?this.fault(a):d}
      </div>
    </div>`}};D.styles=Z`
    :host {
      display: block;
      --se-hit: var(--sw-touch-desktop, 44px);
    }
    @media (max-width: 1100px) {
      :host {
        --se-hit: 44px;
      }
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding-block: var(--sw-s-3);
    }
    .sec + .sec {
      border-block-start: 1px solid var(--sw-border);
    }
    h4 {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    h4 .sum {
      margin-inline-start: auto;
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
    }
    label.field {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    input {
      box-sizing: border-box;
      min-block-size: var(--se-hit);
      padding: 0 var(--sw-s-3);
      border: 1px solid var(--sw-border-strong, var(--sw-border));
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: max(16px, var(--sw-fs-sm));
      font-variant-numeric: tabular-nums;
      transition: border-color var(--sw-t-fast) var(--sw-ease);
    }
    input:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 1px;
    }
    input[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    input[type='time'],
    input[type='date'] {
      direction: ltr;
      min-inline-size: 0;
    }
    .name input {
      inline-size: 100%;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    .hint {
      margin: 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .days {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    .day {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr);
      gap: var(--sw-s-2);
      align-items: start;
      padding-block: var(--sw-s-1);
    }
    .day .dn {
      min-block-size: var(--se-hit);
      display: flex;
      align-items: center;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .wins {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
      min-inline-size: 0;
    }
    .win {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-1);
      padding-inline-end: 2px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft, var(--sw-surface-2));
    }
    .win input {
      inline-size: 8.8em; /* room for a 12-hour browser format too (08:00 AM) */
      border-color: transparent;
      background: transparent;
    }
    .win[data-bad] {
      outline: 1px solid var(--sw-danger);
    }
    .closed {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      min-block-size: var(--se-hit);
      display: inline-flex;
      align-items: center;
    }
    button.x {
      inline-size: var(--se-hit);
      block-size: var(--se-hit);
      display: inline-grid;
      place-items: center;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    button.x:active {
      transform: scale(var(--sw-press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      button.x:hover {
        background: var(--sw-hover-wash);
        color: var(--sw-text);
      }
    }
    .hol {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: var(--sw-s-2);
      align-items: end;
      padding: var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
    }
    .hol .wins {
      grid-column: 1 / -1;
    }
    .hol input {
      inline-size: 100%;
    }
    @media (max-width: 640px) {
      .hol {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      }
      .hol .hn {
        grid-column: 1 / -1;
      }
    }
    sw-week-grid {
      max-inline-size: 100%;
      overflow-x: auto;
    }
  `;C([$({attribute:!1})],D.prototype,"draft",2);C([$({attribute:!1})],D.prototype,"faults",2);C([$({type:Boolean})],D.prototype,"narrow",2);C([$()],D.prototype,"today",2);C([$({type:Boolean,reflect:!0})],D.prototype,"disabled",2);D=C([ee("wk-schedule-draft-form")],D);const L="access-control/schedules",Us=15e3;function Me(){return{confirmed:!0,client_request_id:Ye(),expires_at:Je(Ve()+Us)}}const M=(e,s)=>H(`${L}/actions/${e}`,s),k=(e,s)=>H(`${L}/actions/${e}`,{...s,...Me()}),Ks=(e,s,t)=>M("check",{data:e,date:s,time:t}),Js=(e,s)=>k("create",{data:e,check_id:s}),Vs=(e,s,t,a)=>k("update",{schedule_id:e,revision:s,data:t,check_id:a}),Ys=(e,s)=>k("delete",{schedule_id:e,revision:s}),Gs=e=>M("import_preview",{document:e}),Xs=e=>k("import_apply",{preview_id:e}),Zs=()=>I(`${L}/export`),Qs=e=>M("readiness",{station_id:e}),et=(e,s)=>M("assess",{station_id:e,data:s}),st=(e,s)=>k("baseline_save",{station_id:e,preview_id:s}),tt=(e,s)=>k("baseline_clear",{station_id:e,revision:s}),at=(e,s,t,a)=>M("plan_preview",{station_id:e,schedule_id:s,revision:t,bindings:a}),it=e=>k("plan_save",{preview_id:e}),nt=(e,s)=>k("plan_recheck",{plan_id:e,revision:s}),rt=(e,s)=>k("plan_delete",{plan_id:e,revision:s}),ot=(e,s)=>M("claim_preview",{plan_id:e,revision:s}),lt=e=>k("claim_confirm",{preview_id:e}),dt=(e,s)=>k("claim_release",{claim_id:e,revision:s}),ct=e=>H(`${L}/actions/deploy`,{plans:e,...Me()}),ht=(e,s,t)=>k(e,{job_id:s,revision:t}),pt=e=>I(`${L}/jobs${e.length?"?"+e.map(s=>`ids=${encodeURIComponent(s)}`).join("&"):""}`),ut=()=>I(`${L}/claims`);function O(e){if(e instanceof ne){const s=e.body?.details??{},t=String(s.outcome??""),a=t==="refused"?"refused":t==="not_sent"?"not_sent":t==="unknown"?"unknown":[400,403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",i=Number(s.retry_after_s);return{status:a,code:String(s.wiskey_code??e.body?.code??"")||null,message:e.body?.user_message||e.message,field:Ke(e)[0]??null,retryAfter:Number.isFinite(i)&&i>=0?i:null}}return{status:"unknown",code:"network",message:"",field:null,retryAfter:null}}const he="access-control/schedules/reads",wt=()=>I(he),ft=(e,s)=>H(he,{action:e,parameters:s}),mt=e=>H(`${he}/${encodeURIComponent(e)}/status`),bt=["sending","not_sent","accepted","running","completed","refused","unknown"],vt=5;function pe(e){return bt.includes(e??"")?e:"unknown"}function gt(e){switch(pe(e)){case"completed":return"live";case"accepted":case"running":case"sending":return"neutral";case"refused":return"error";case"not_sent":return"offline";default:return"unknown"}}function B(e,s=!1){return s?"failed":e?e.state==="supported"||e.state==="unsupported"?e.state:"unavailable":"loading"}function $t(e,s,t,a){return B(e)==="supported"&&s&&!t&&a===!0}function yt(e,s,t){return e.can_check===!0&&!e.final&&B(s)==="supported"&&!0}const kt=e=>typeof e=="number"&&Number.isFinite(e)?e:null;function _t(e){if(pe(e.state)!=="completed")return null;const s=e.data;if(!s)return{key:"sumNoData",vars:{}};if(e.action==="readiness"){const t=Array.isArray(s.checks)?s.checks:[];return{key:"sumReadiness",vars:{readable:t.filter(i=>i&&i.read_state==="readable").length,total:t.length}}}if(e.action==="dependencies"){const t=s.users??null,a=kt(t?.read);return{key:"sumDependencies",vars:{users:a===null?"?":a}}}return e.plan_revision!==null&&e.plan_revision!==void 0?{key:"sumPlan",vars:{revision:e.plan_revision}}:{key:"sumDone",vars:{}}}function xt(e,s=vt){const t=[...e??[]].sort((a,i)=>a.created_at<i.created_at?1:a.created_at>i.created_at?-1:0);return{rows:t.slice(0,s),more:Math.max(0,t.length-s)}}var St=Object.defineProperty,Tt=Object.getOwnPropertyDescriptor,A=(e,s,t,a)=>{for(var i=a>1?void 0:a?Tt(s,t):s,r=e.length-1,l;r>=0;r--)(l=e[r])&&(i=(a?l(s,t,i):l(i))||i);return a&&i&&St(s,t,i),i};const At={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"};let x=class extends Q{constructor(){super(...arguments),this.stations=[],this.live=!0,this.support=null,this.reads=[],this.failed=!1,this.station="",this.busy=null,this.note=null}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(e){e.has("stations")&&!this.stations.some(s=>s.id===this.station&&s.online)&&(this.station=this.stations.find(s=>s.online)?.id??"")}async load(){try{const e=await wt();this.support=e.support,this.reads=e.reads,this.failed=!1}catch{this.failed=!0}}merge(e){e&&(this.reads=[e,...this.reads.filter(s=>s.request_id!==e.request_id)])}async start(e){if(!(!this.station||this.busy)){this.busy=e,this.note=null;try{const s=await ft(e,{station_id:this.station});this.support=s.support,this.merge(s.read)}catch(s){const t=O(s);this.note=t.message||v(t.code)}finally{this.busy=null}}}async check(e){if(!this.busy){this.busy=`check:${e.request_id}`,this.note=null;try{const s=await mt(e.request_id);this.support=s.support,this.merge(s.read);const t=s.status_read;t&&t.outcome!=="ok"&&t.outcome!=="not_needed"&&(this.note=n("sr_statusFailed",{reason:v(t.code)||t.outcome}))}catch(s){const t=O(s);this.note=n("sr_statusFailed",{reason:t.message||v(t.code)})}finally{this.busy=null}}}stationName(e){return this.stations.find(s=>s.id===e)?.name??e}supportLine(){const e=B(this.support,this.failed);return e==="supported"?d:o`<p class=${e==="loading"?"s":"warn"} role="status" data-sr-support=${e}>${n(e==="unsupported"?"sr_unsupported":e==="unavailable"?"sr_unavailable":e==="failed"?"sr_failed":"sr_loading")}</p>`}render(){const e=B(this.support,this.failed)==="supported",s=this.stations.filter(l=>l.online),t=this.stations.find(l=>l.id===this.station)??null,a=$t(this.support,this.live,!!this.busy,t?!!t.online:null),{rows:i,more:r}=xt(this.reads);return o`<sw-card>
      <div class="block" data-sr data-sr-state=${B(this.support,this.failed)}>
        <div class="bh"><h3>${n("sr_title")}</h3></div>
        <p class="hint">${n("sr_hint")}</p>
        ${this.supportLine()}
        ${e?o`<div class="start">
              <sw-dropdown data-sr-station label=${n("sr_station")} .value=${this.station}
                .items=${s.map(l=>({id:l.id,label:l.name}))}
                @change=${l=>this.station=l.detail.id}></sw-dropdown>
              <wk-action-button icon="search" data-sr-start="readiness" ?busy=${this.busy==="readiness"} ?disabled=${!a}
                @click=${()=>void this.start("readiness")}>${n("sr_readiness")}</wk-action-button>
              <wk-action-button tone="quiet" icon="search" data-sr-start="dependencies" ?busy=${this.busy==="dependencies"} ?disabled=${!a}
                @click=${()=>void this.start("dependencies")}>${n("sr_dependencies")}</wk-action-button>
            </div>`:d}
        ${this.note?o`<p class="warn" role="status" data-sr-note>${this.note}</p>`:d}
        ${i.length?o`<div class="rows">
              ${i.map(l=>this.renderRow(l))}
            </div>`:e?o`<p class="s" data-sr-none>${n("sr_none")}</p>`:d}
        ${r?o`<p class="s" data-sr-more>${n("sr_more",{n:r})}</p>`:d}
      </div>
    </sw-card>`}renderRow(e){const s=pe(e.state),t=_t(e),a=s==="unknown"?n("sr_unknownHint"):s==="refused"||s==="not_sent"?v(e.wiskey_code):t?n(`sr_${t.key}`,t.vars):"",i=e.action==="plan_recheck"||e.action==="claim_preview"?(e.subject??"").slice(0,8):this.stationName(e.subject);return o`<div class="row" data-sr-read=${e.request_id} data-state=${s}>
      <div class="main">
        <span class="t">${n(`sr_a_${e.action}`)} · ${i}</span>
        ${a?o`<span class="s">${a}</span>`:d}
      </div>
      <sw-badge kind=${At[gt(s)]} label=${n(`sr_s_${s}`)}></sw-badge>
      ${yt(e,this.support)?o`<wk-action-button tone="quiet" icon="refresh" data-sr-check=${e.request_id} ?busy=${this.busy===`check:${e.request_id}`}
            ?disabled=${!!this.busy} @click=${()=>void this.check(e)}>${n("sr_check")}</wk-action-button>`:d}
    </div>`}};x.styles=Z`
    :host {
      display: block;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding: var(--sw-s-4);
    }
    .bh {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
    }
    .bh h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .bh .sp {
      flex: 1;
    }
    .hint,
    .s {
      margin: 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .warn {
      margin: 0;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
      font-size: var(--sw-fs-sm);
    }
    .start {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--sw-s-2);
    }
    .rows {
      display: flex;
      flex-direction: column;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      padding-block: var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .row:first-child {
      border-block-start: 0;
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-inline-size: 0;
    }
    .t {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      overflow-wrap: anywhere;
    }
    @media (max-width: 640px) {
      .row {
        flex-wrap: wrap;
      }
      .start sw-dropdown {
        inline-size: 100%;
      }
    }
  `;A([$({attribute:!1})],x.prototype,"stations",2);A([$({type:Boolean})],x.prototype,"live",2);A([p()],x.prototype,"support",2);A([p()],x.prototype,"reads",2);A([p()],x.prototype,"failed",2);A([p()],x.prototype,"station",2);A([p()],x.prototype,"busy",2);A([p()],x.prototype,"note",2);x=A([ee("wk-schedule-reads")],x);var zt=Object.defineProperty,Dt=Object.getOwnPropertyDescriptor,f=(e,s,t,a)=>{for(var i=a>1?void 0:a?Dt(s,t):s,r=e.length-1,l;r>=0;r--)(l=e[r])&&(i=(a?l(s,t,i):l(i))||i);return a&&i&&zt(s,t,i),i};const Oe={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"},jt=2e3,Ot=18e4,It=6e4;let w=class extends Q{constructor(){super(...arguments),this.stations=[],this.library=null,this.plans=null,this.ops=null,this.live=!0,this.narrow=!1,this.editing=null,this.draft=$e(),this.checkAt=V(Date.now()),this.checked=null,this.busy=null,this.assessStation="",this.assessment=null,this.importing=null,this.deploying=null,this.targets=[],this.progress=null,this.ask=null,this.note=null,this.claims=null,this.pollTimer=0,this.pollStarted=0}get writesOff(){return this.ops?.writes_enabled===!1}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.pollTimer)}willUpdate(e){e.has("stations")&&!this.assessStation&&(this.assessStation=this.stations.find(s=>s.online)?.id??"")}changed(){this.dispatchEvent(new CustomEvent("sched-changed",{bubbles:!0,composed:!0}))}stationName(e){return this.stations.find(s=>s.id===e)?.name??e??""}say(e,s){if(!e){this.note={tone:"ok",text:s??n("done"),code:null};return}const t=e.status==="refused"?n("refusedBy",{reason:v(e.code)||e.message}):e.status==="not_sent"?n("notSent",{reason:e.message||v(e.code)}):n("unknownOutcome");this.note={tone:e.status,text:t,code:e.code}}async run(e,s,t,a=!0){this.busy=e;try{const i=await s();return a&&(this.say(null,t),this.changed()),i}catch(i){const r=O(i);return this.say(r),a&&r.status!=="not_sent"&&this.changed(),null}finally{this.busy=null}}openEditor(e){this.editing=e,this.draft=e==="new"?$e():ye(e),this.checked=null,this.assessment=null,this.checkAt=V(Date.now()),this.note=null}closeEditor(){this.editing=null,this.ask=null}async runCheck(){const e=X(this.draft),s=await this.run("check",()=>Ks(e,this.checkAt.date,this.checkAt.time),void 0,!1);s?.check_id&&(this.checked={draft:e,id:s.check_id,result:s.data})}checkValid(){return!!this.checked&&Ts(this.checked.draft,this.draft)}async save(){const e=this.checked,s=this.editing;if(this.ask=null,!e||!s)return;await this.run("save",()=>s==="new"?Js(e.draft,e.id):Vs(s.id,s.revision??0,e.draft,e.id),n("saved"))?this.closeEditor():this.checked=null}async runAssess(){if(!this.assessStation)return;const e=this.assessStation,s=await this.run("assess",()=>et(e,X(this.draft)),void 0,!1);s&&(this.assessment={station:e,data:s.data,previewId:s.baseline_preview_id??null})}async baseline(e){const s=this.assessment;if(this.ask=null,!!s)if(e==="baseline_save"&&s.previewId){const t=await this.run("baseline",()=>st(s.station,s.previewId),n("baselineSaved"));t&&(this.assessment={...s,previewId:null,data:{...s.data,baseline:{...s.data.baseline,state:"unchanged",revision:t.data.revision}}})}else e==="baseline_clear"&&s.data.baseline.revision&&await this.run("baseline",()=>tt(s.station,s.data.baseline.revision),n("baselineCleared"))&&(this.assessment={...s,data:{...s.data,baseline:{...s.data.baseline,state:"missing",revision:0}}})}async pickFile(e){const s=e.target,t=s.files?.[0];if(s.value="",!t)return;if(t.size>It){this.note={tone:"not_sent",text:n("importTooLarge"),code:null};return}const a=await t.text(),i=await this.run("import",()=>Gs(a),void 0,!1);i?.preview_id&&(this.importing={preview:i.data,previewId:i.preview_id,file:t.name},this.ask={kind:"import"})}async applyImport(){const e=this.importing;if(this.ask=null,!e)return;const s=await this.run("import",()=>Xs(e.previewId));s&&(this.note={tone:"ok",text:n("importDone",{n:s.data.length}),code:null}),this.importing=null}async exportFile(){const e=await this.run("export",()=>Zs(),void 0,!1);if(!e)return;const s=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),t=document.createElement("a");t.href=URL.createObjectURL(s),t.download=`schedules-${V(Date.now()).date}.json`,t.click(),window.setTimeout(()=>URL.revokeObjectURL(t.href),1e3)}openDeploy(e){this.deploying=e,this.targets=[],this.progress=null,this.note=null}closeDeploy(){window.clearTimeout(this.pollTimer),this.deploying=null,this.targets=[],this.progress=null,this.ask=null}previousBindings(e){return(this.plans??[]).find(t=>t.station_id===e&&t.draft_id===this.deploying?.id)?.bindings??null}toggleTarget(e){const s=this.deploying;this.targets.some(t=>t.stationId===e)?this.targets=this.targets.filter(t=>t.stationId!==e):this.targets=[...this.targets,{stationId:e,readiness:null,bindings:Te(s.holidays?.length??0,null,this.previousBindings(e)),phase:"idle",previewId:null,impact:null,plan:null,error:null}]}patchTarget(e,s){this.targets=this.targets.map(t=>t.stationId===e?{...t,...s}:t)}async readTarget(e){this.patchTarget(e.stationId,{phase:"reading",error:null});try{const s=await Qs(e.stationId),t=this.previousBindings(e.stationId)?e.bindings:Te(this.deploying?.holidays?.length??0,s.data);this.patchTarget(e.stationId,{phase:"idle",readiness:s.data,bindings:t})}catch(s){this.patchTarget(e.stationId,{phase:"error",error:O(s)})}}async previewTarget(e){const s=this.deploying;this.patchTarget(e.stationId,{phase:"previewing",error:null,previewId:null,impact:null});try{const t=await at(e.stationId,s.id,s.revision??0,e.bindings);this.patchTarget(e.stationId,{phase:"previewed",previewId:t.preview_id??null,impact:t.impact??null,plan:t.data})}catch(t){this.patchTarget(e.stationId,{phase:"error",error:O(t)})}}async previewAll(){for(const e of this.targets)e.phase==="previewed"||e.phase==="saved"||Object.keys(Ae(e.bindings,e.readiness)).length||await this.previewTarget(this.targets.find(s=>s.stationId===e.stationId))}async deploy(){this.ask=null,this.busy="deploy";try{for(const s of this.targets.filter(t=>t.phase==="previewed"&&t.previewId)){this.patchTarget(s.stationId,{phase:"saving"});try{const t=await it(s.previewId);this.patchTarget(s.stationId,{phase:"saved",plan:t.data,previewId:null})}catch(t){this.patchTarget(s.stationId,{phase:"error",error:O(t),previewId:null})}}const e=this.targets.filter(s=>s.phase==="saved"&&s.plan);if(this.changed(),!e.length)return;try{const s=await ct(e.map(t=>({plan_id:t.plan.id,revision:t.plan.revision??1})));this.progress={results:s.results,jobs:Object.fromEntries(s.results.filter(t=>t.job).map(t=>[t.job.id,t.job])),done:!1,writesEnabled:null},this.pollStarted=Date.now(),this.poll()}catch(s){this.say(O(s))}}finally{this.busy=null}}async poll(){const e=this.progress;if(!e)return;const s=Object.keys(e.jobs);if(!s.length){this.progress={...e,done:!0};return}try{const t=await pt(s);if(t.jobs){const a={...e.jobs};for(const i of t.jobs)a[i.id]=i;this.progress={...e,jobs:a,done:t.done,writesEnabled:t.writes_enabled}}}catch{}!this.progress?.done&&Date.now()-this.pollStarted<Ot&&this.deploying?this.pollTimer=window.setTimeout(()=>void this.poll(),jt):this.changed()}async loadClaims(){try{const e=await ut();this.claims=e.claims}catch{this.claims=null}}async claimPreview(e){const s=await this.run(`claim:${e.id}`,()=>ot(e.id,e.revision??0),void 0,!1);s?.preview_id&&(this.ask={kind:"claim",plan:e,previewId:s.preview_id,keys:(s.data.resource_keys??[]).filter(Boolean)})}async confirmAsk(){const e=this.ask;if(e){if(this.ask=null,e.kind==="save")return this.save();if(e.kind==="import")return this.applyImport();if(e.kind==="deploy")return this.deploy();if(e.kind==="baseline_save"||e.kind==="baseline_clear")return this.baseline(e.kind);if(e.kind==="delete"){await this.run(`delete:${e.schedule.id}`,()=>Ys(e.schedule.id,e.schedule.revision??0),n("deleted"));return}if(e.kind==="plan_recheck"){await this.run(`plan:${e.plan.id}`,()=>nt(e.plan.id,e.plan.revision??0));return}if(e.kind==="plan_delete"){await this.run(`plan:${e.plan.id}`,()=>rt(e.plan.id,e.plan.revision??0));return}if(e.kind==="claim"){await this.run(`claim:${e.plan.id}`,()=>lt(e.previewId)),await this.loadClaims();return}if(e.kind==="release"){await this.run(`claim:${e.claim.plan_id}`,()=>dt(e.claim.id,e.claim.revision??0)),await this.loadClaims();return}e.kind==="job"&&await this.run(`job:${e.job.id}`,()=>ht(e.action,e.job.id,e.job.revision??0))}}firstUpdated(){this.loadClaims()}render(){const e=this.library??[],s=!this.live||!!this.busy;return o`<sw-card>
        <div class="block" data-se-library>
          <div class="bh">
            <h3>${n("manageTitle")}</h3>
            <span class="n">${e.length}</span>
            <span class="sp"></span>
            <wk-action-button tone="primary" icon="plus" data-se-new ?disabled=${s} @click=${()=>this.openEditor("new")}>${n("newSchedule")}</wk-action-button>
            <span>
              <input type="file" accept="application/json,.json" data-se-file @change=${t=>void this.pickFile(t)} ?disabled=${s} />
              <wk-action-button tone="quiet" icon="upload" data-se-import ?busy=${this.busy==="import"} ?disabled=${s}
                @click=${t=>t.currentTarget.previousElementSibling.click()}>${n("importFile")}</wk-action-button>
            </span>
            <wk-action-button tone="quiet" icon="download" data-se-export ?busy=${this.busy==="export"} ?disabled=${!!this.busy||!e.length} @click=${()=>void this.exportFile()}>${n("exportFile")}</wk-action-button>
          </div>
          ${this.live?d:o`<p class="warn" role="status" data-se-stale>${n("stale")}</p>`}
          ${this.writesOff?o`<p class="warn" role="note" data-se-writes-off>${n("deployWritesOff")}</p>`:d}
          ${this.note&&!this.editing&&!this.deploying?this.renderNote():d}
          <div class="rows">${e.map(t=>this.renderScheduleRow(t))}</div>
        </div>
      </sw-card>
      ${this.renderPlans()} ${this.renderJobs()}
      <wk-schedule-reads data-se-reads .stations=${this.stations} ?live=${this.live}></wk-schedule-reads>
      ${this.renderEditor()} ${this.renderDeploy()} ${this.editing||this.deploying?d:this.renderAsk()}`}renderNote(){const e=this.note;return o`<p class="note" role="status" data-se-note=${e.tone} data-se-code=${e.code??""} data-tone=${e.tone}>${e.text}</p>`}plansFor(e){return(this.plans??[]).filter(s=>s.draft_id===e)}renderScheduleRow(e){const s=this.plansFor(e.id),t=Math.round(Pe(ye(e).weekly)/60*10)/10,a=!this.live||!!this.busy;return o`<div class="row" data-se-row=${e.id}>
      <div class="main">
        <span class="t">${e.name??"—"}</span>
        <span class="s">${[n("summaryHours",{h:t}),e.holidays?.length?`${e.holidays.length} · ${n("holidaysTitle")}`:"",s.length?s.map(i=>this.stationName(i.station_id)).join(", "):""].filter(Boolean).join(" · ")}</span>
      </div>
      <div class="acts">
        <wk-action-button tone="quiet" icon="edit" data-se-edit=${e.id} ?disabled=${a} @click=${()=>this.openEditor(e)}>${n("edit")}</wk-action-button>
        <wk-action-button tone="quiet" icon="upload" data-se-deploy=${e.id} ?disabled=${a} @click=${()=>this.openDeploy(e)}>${n("deploy")}</wk-action-button>
        <wk-action-button tone="quiet" icon="trash" icon-only label=${n("remove")} data-se-delete=${e.id} ?disabled=${a} @click=${()=>this.ask={kind:"delete",schedule:e}}></wk-action-button>
      </div>
    </div>`}renderPlans(){const e=this.plans??[];if(!e.length)return d;const s=!this.live||!!this.busy;return o`<sw-card>
      <div class="block" data-se-plans>
        <div class="bh"><h3>${n("plansTitle")}</h3><span class="n">${e.length}</span></div>
        <div class="rows">
          ${e.map(t=>{const a=(this.claims??[]).find(r=>r.plan_id===t.id)??null,i=(t.report?.blockers??[]).filter(Boolean);return o`<div class="row" data-se-plan=${t.id}>
              <div class="main">
                <span class="t">${t.name??"—"} · ${this.stationName(t.station_id)}</span>
                <span class="s" data-se-plan-blockers>${i.map(r=>v(r)).join(" · ")}</span>
              </div>
              ${a?o`<sw-badge kind="live" label=${n("claimed")} data-se-claimed></sw-badge>`:d}
              <div class="acts">
                <wk-action-button tone="quiet" icon="refresh" data-se-recheck=${t.id} ?busy=${this.busy===`plan:${t.id}`} ?disabled=${s} @click=${()=>this.ask={kind:"plan_recheck",plan:t}}>${n("planRecheck")}</wk-action-button>
                ${a?o`<wk-action-button tone="quiet" icon="unlock" data-se-release=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"release",claim:a}}>${n("planRelease")}</wk-action-button>`:o`<wk-action-button tone="quiet" icon="lock" data-se-claim=${t.id} ?busy=${this.busy===`claim:${t.id}`} ?disabled=${s} @click=${()=>void this.claimPreview(t)}>${n("planClaim")}</wk-action-button>`}
                <wk-action-button tone="quiet" icon="trash" icon-only label=${n("planDelete")} data-se-plan-delete=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"plan_delete",plan:t}}></wk-action-button>
              </div>
            </div>`})}
        </div>
      </div>
    </sw-card>`}renderJobs(){const e=[...this.ops?.jobs??[]];if(!e.length)return d;const s=!this.live||!!this.busy;return o`<sw-card>
      <div class="block" data-se-jobs>
        <div class="bh"><h3>${n("jobsTitle")}</h3><span class="n">${e.length}</span></div>
        <div class="rows">
          ${e.map(t=>{const a=t.status??"unknown",i=De(a),r=a==="cancelled"||a==="verified";return o`<div class="row" data-se-job=${t.id} data-status=${a}>
              <div class="main">
                <span class="t">${t.name??"—"} · ${this.stationName(t.station_id)}</span>
                <span class="s">${t.error?v(t.error):(t.blockers??[]).filter(Boolean).map(l=>v(l)).join(" · ")}</span>
              </div>
              <sw-badge kind=${Oe[ze(a)]} label=${je[a]??a}></sw-badge>
              <div class="acts">
                ${i||r?d:o`<wk-action-button tone="quiet" icon="refresh" data-se-job-check=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"job",action:"job_check",job:t}}>${n("jobRecheck")}</wk-action-button>`}
                ${i||r?d:o`<wk-action-button tone="quiet" icon="close" data-se-job-cancel=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"job",action:"job_cancel",job:t}}>${n("jobCancel")}</wk-action-button>`}
                ${r?o`<wk-action-button tone="quiet" icon="inbox" data-se-job-archive=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"job",action:"job_archive",job:t}}>${n("jobArchive")}</wk-action-button>`:d}
              </div>
            </div>`})}
        </div>
      </div>
    </sw-card>`}renderEditor(){const e=this.editing;if(!e)return d;const s=As(this.draft),t=s.length===0,a=this.checkValid(),i=e==="new"?[]:this.plansFor(e.id),r=e==="new"?n("editorNew"):n("editorEdit",{name:e.name??""}),l=!!this.busy;return o`<sw-drawer modal open heading=${r} data-se-editor=${e==="new"?"new":e.id} @close=${h=>h.target===h.currentTarget&&this.closeEditor()}>
      <wk-schedule-draft-form .draft=${this.draft} .faults=${s} ?narrow=${this.narrow} today=${V(Date.now()).date} ?disabled=${l}
        @draft-change=${h=>this.draft=h.detail}></wk-schedule-draft-form>
      <div class="panel" data-se-check>
        <h4><sw-icon name="check" size=${14}></sw-icon>${n("checkTitle")}</h4>
        <div class="line">
          <label class="f">${n("checkAt")}<input type="date" lang=${z()} .value=${this.checkAt.date} @change=${h=>this.checkAt={...this.checkAt,date:h.target.value}} /></label>
          <label class="f">&nbsp;<input type="time" lang=${z()} step="60" .value=${this.checkAt.time} @change=${h=>this.checkAt={...this.checkAt,time:h.target.value}} /></label>
          <wk-action-button icon="check" data-se-check-run ?busy=${this.busy==="check"} ?disabled=${l||!t||!this.live} @click=${()=>void this.runCheck()}>${n("checkRun")}</wk-action-button>
        </div>
        ${this.checked?o`<span class="result" role="status" data-se-check-result data-ok=${String(!!this.checked.result.within_window)}>${this.checkLine(this.checked.result)}${a?"":` · ${n("checkStale")}`}</span>`:o`<span class="s">${n("checkNeeded")}</span>`}
      </div>
      ${this.renderAssess(t)}
      ${this.note?this.renderNote():d}
      ${i.length?o`<p class="warn" data-se-affects>${n("affectsPlans",{stations:i.map(h=>this.stationName(h.station_id)).join(", ")})}</p>`:d}
      <div slot="footer" class="foot">
        <wk-action-button data-se-cancel @click=${()=>this.closeEditor()}>${n("cancel")}</wk-action-button>
        <wk-action-button tone="primary" icon="check" data-se-save ?busy=${this.busy==="save"} ?disabled=${l||!t||!a||!this.live} @click=${()=>this.ask={kind:"save"}}>${n("save")}</wk-action-button>
      </div>
      ${this.renderAsk()}
    </sw-drawer>`}checkLine(e){const s=e.source==="holiday"?n("sourceHoliday",{name:e.holiday??""}):n("sourceWeekly");return n(e.within_window?"checkOpen":"checkClosed",{date:e.date??"",time:e.time??"",source:s})}renderAssess(e){const s=this.stations.filter(i=>i.online),t=this.assessment,a=!!this.busy;return o`<div class="panel" data-se-assess>
      <h4><sw-icon name="cpu" size=${14}></sw-icon>${n("assessTitle")}</h4>
      <div class="line">
        <div class="f"><span>${n("pickStation")}</span>
          <sw-dropdown data-se-assess-station label=${n("pickStation")} .value=${this.assessStation}
            .items=${s.map(i=>({id:i.id,label:i.name}))}
            @change=${i=>this.assessStation=i.detail.id}></sw-dropdown>
        </div>
        <wk-action-button icon="search" data-se-assess-run ?busy=${this.busy==="assess"} ?disabled=${a||!e||!this.assessStation||!this.live} @click=${()=>void this.runAssess()}>${n("assessRun")}</wk-action-button>
      </div>
      ${this.busy==="assess"?o`<span class="s">${n("reading")}</span>`:d}
      ${t?o`<span class="result" role="status" data-se-assess-state=${t.data.assessment.state??"unknown"}>${t.data.assessment.state==="fits"?n("assessFits"):t.data.assessment.state==="exceeds"?n("assessExceeds"):n("assessUnknown")}</span>
            <ul class="plain">${t.data.assessment.limits.map(i=>o`<li data-state=${i.state??""}>${n("limitRow",{key:Ws[i.key??""]??i.key??"",needed:i.needed??"—",available:i.available??"—"})}</li>`)}</ul>
            <span class="s" data-se-baseline=${t.data.baseline.state??""}>${n("baselineTitle")} · ${n("baselineState",{state:qs[t.data.baseline.state??""]??t.data.baseline.state??"—"})}</span>
            <div class="line">
              ${t.previewId?o`<wk-action-button tone="quiet" icon="bookmark" data-se-baseline-save ?disabled=${a} @click=${()=>this.ask={kind:"baseline_save"}}>${n("baselineSave")}</wk-action-button>`:d}
              ${t.data.baseline.revision?o`<wk-action-button tone="quiet" icon="trash" data-se-baseline-clear ?disabled=${a} @click=${()=>this.ask={kind:"baseline_clear"}}>${n("baselineClear")}</wk-action-button>`:d}
            </div>`:d}
    </div>`}renderDeploy(){const e=this.deploying;if(!e)return d;const s=this.targets.filter(a=>a.phase==="previewed"),t=!!this.busy||this.targets.some(a=>a.phase==="reading"||a.phase==="previewing"||a.phase==="saving");return o`<sw-drawer modal open heading=${n("deployTitle",{name:e.name??""})} data-se-deploy-drawer=${e.id} @close=${a=>a.target===a.currentTarget&&this.closeDeploy()}>
      ${this.note?this.renderNote():d}
      ${this.progress?this.renderProgress():o`
        ${this.writesOff?o`<p class="warn" role="note" data-se-deploy-warning>${n("deployWritesOff")}</p>`:d}
        <div class="panel" data-se-targets>
          <h4><sw-icon name="building" size=${14}></sw-icon>${n("deployStep1")}</h4>
          ${this.stations.length?d:o`<span class="s">${n("noStations")}</span>`}
          <div class="picks">
            ${this.stations.map(a=>{const i=this.targets.some(r=>r.stationId===a.id);return o`<label class="pick" ?data-on=${i} ?data-off=${!a.online} data-se-pick=${a.id}>
                <input type="checkbox" .checked=${i} ?disabled=${!a.online||t} @change=${()=>this.toggleTarget(a.id)} />
                ${a.name}${a.online?"":` · ${n("offline")}`}
              </label>`})}
          </div>
          ${this.targets.length?o`<span class="s">${n("stationsPicked",{n:this.targets.length})}</span>`:d}
        </div>
        ${this.targets.map(a=>this.renderTarget(a,e,t))}
      `}
      <div slot="footer" class="foot">
        <wk-action-button data-se-deploy-close @click=${()=>this.closeDeploy()}>${this.progress?n("close"):n("cancel")}</wk-action-button>
        ${this.progress?d:o`<wk-action-button icon="search" data-se-preview-all ?disabled=${t||!this.targets.length||!this.live} @click=${()=>void this.previewAll()}>${n("previewAll")}</wk-action-button>
              <wk-action-button tone="primary" icon="upload" data-se-deploy-go ?busy=${this.busy==="deploy"} ?disabled=${t||!s.length||!this.live} @click=${()=>this.ask={kind:"deploy"}}>${n("deployNow")}${s.length?` (${s.length})`:""}</wk-action-button>`}
      </div>
      ${this.renderAsk()}
    </sw-drawer>`}renderTarget(e,s,t){const a=s.holidays?.length??0,i=Ae(e.bindings,e.readiness),r=(l,h,m,E,q)=>{const u=ce(e.readiness,m);return o`<label class="f">${h}${u?o` <span class="s">${n("range",{a:u[0],b:u[1]})}</span>`:d}
        <input type="number" inputmode="numeric" min="1" max="65535" .value=${E===null?"":String(E)} aria-invalid=${String(!!i[l])} data-se-slot=${l}
          ?disabled=${t||e.phase==="saved"} @change=${S=>this.patchTarget(e.stationId,{bindings:q(Number(S.target.value)),phase:"idle",previewId:null,impact:null})} />
      </label>`};return o`<div class="target" data-se-target=${e.stationId} data-phase=${e.phase}>
      <div class="bh"><h3>${this.stationName(e.stationId)}</h3><span class="sp"></span>
        <wk-action-button tone="quiet" icon="cpu" data-se-read=${e.stationId} ?busy=${e.phase==="reading"} ?disabled=${t||e.phase==="saved"} @click=${()=>void this.readTarget(e)}>${n("readStation")}</wk-action-button>
      </div>
      <span class="s">${n("slotsHint")}</span>
      <div class="line">
        ${r("template",n("slotTemplate"),"template",e.bindings.template,l=>({...e.bindings,template:l}))}
        ${r("weekly",n("slotWeekly"),"weekly",e.bindings.weekly,l=>({...e.bindings,weekly:l}))}
        ${a?r("holiday_group",n("slotGroup"),"holiday_group",e.bindings.holiday_group,l=>({...e.bindings,holiday_group:l})):d}
        ${e.bindings.holidays.map((l,h)=>r(`holidays.${h}`,n("slotHoliday",{n:h+1}),"holiday",l,m=>({...e.bindings,holidays:e.bindings.holidays.map((E,q)=>q===h?m:E)})))}
      </div>
      ${Object.values(i).length?o`<span class="s" role="alert" data-se-slot-fault>${v(Object.values(i)[0])}</span>`:d}
      ${e.phase==="reading"||e.phase==="previewing"?o`<span class="s line"><span class="spin" aria-hidden="true"></span>${n("reading")}</span>`:d}
      ${e.error?o`<p class="note" role="status" data-tone=${e.error.status} data-se-target-error=${e.error.code??""}>${e.error.status==="refused"?n("refusedBy",{reason:v(e.error.code)}):e.error.status==="not_sent"?n("notSent",{reason:e.error.message}):n("unknownOutcome")}</p>`:d}
      ${e.impact?this.renderImpact(e.impact):d}
      ${e.phase!=="previewed"&&e.phase!=="saved"?o`<div><wk-action-button icon="search" data-se-preview=${e.stationId} ?busy=${e.phase==="previewing"} ?disabled=${t||Object.keys(i).length>0||!this.live} @click=${()=>void this.previewTarget(e)}>${n("previewRun")}</wk-action-button></div>`:d}
    </div>`}renderImpact(e){const s=e.station?.doors??[],t=e.people,a=(e.resources??[]).filter(r=>r.state&&r.state!=="matches"||r.externally_referenced||r.active),i=(e.blockers??[]).filter(Boolean);return o`<div class="panel" data-se-impact>
      <h4><sw-icon name="target" size=${14}></sw-icon>${n("impactTitle")}</h4>
      <ul class="plain">
        <li data-se-impact-station>${n("impactStation",{name:e.station?.name??e.station?.id??""})}</li>
        <li data-se-impact-doors>${s.length?n("impactDoors",{doors:s.map(r=>r.name??`#${r.index}`).join(", ")}):n("impactNoDoors")}</li>
        <li data-se-impact-people>${t&&t.state==="complete"?n("impactPeople",{explicit:t.explicit??"—",implicit:t.implicit??"—",read:t.read??"—"}):n("impactPeopleUnknown")}</li>
      </ul>
      ${a.length?o`<h4>${n("conflictsTitle")}</h4><ul class="plain" data-se-conflicts>${a.map(r=>o`<li>${n("resourceRow",{kind:Ls[r.kind??""]??r.kind??"",id:r.id??"—",state:Ms[r.state??""]??r.state??""})}${r.externally_referenced?` · ${n("externalRef")}`:""}${r.active?` · ${n("activeRes")}`:""}</li>`)}</ul>`:d}
      ${i.length?o`<h4>${n("blockersTitle")}</h4><ul class="plain" data-se-blockers>${i.map(r=>o`<li data-code=${r}>${v(r)}</li>`)}</ul>`:d}
    </div>`}renderProgress(){const e=this.progress;return o`<div class="panel prog" data-se-progress data-done=${String(e.done)}>
      <h4>${e.done?o`<sw-icon name="check" size=${14}></sw-icon>${n("progressDone")}`:o`<span class="spin" aria-hidden="true"></span>${n("progressRunning")}`}</h4>
      ${e.writesEnabled===!1?o`<p class="warn" data-se-writes-off>${n("writesOff")}</p>`:d}
      ${e.results.map(s=>{const t=s.job?e.jobs[s.job.id]??s.job:null,a=t?je[t.status??""]??t.status??"":n(`st_${s.status}`),i=t?t.error?v(t.error):(t.blockers??[]).filter(Boolean).map(l=>v(l)).join(" · "):v(s.code)||s.reason||"",r=t?ze(t.status):Ns(s);return o`<div class="row" data-se-result=${s.station?.id??s.plan_id} data-status=${t?.status??s.status}>
          <div class="main"><span class="t">${s.station?.name??this.stationName(s.station?.id)}</span><span class="s">${i}</span></div>
          ${t&&De(t.status)?o`<span class="spin" aria-hidden="true"></span>`:d}
          <sw-badge kind=${Oe[r]} label=${a}></sw-badge>
        </div>`})}
    </div>`}renderAsk(){const e=this.ask;if(!e)return d;let s="",t=d;const a=e.kind==="delete"||e.kind==="plan_delete";switch(e.kind){case"save":{const i=this.editing,r=i&&i!=="new"?this.plansFor(i.id):[];s=n("confirmSaveTitle"),t=o`<p class="sentence" data-se-sentence>${i==="new"?n("confirmSaveNew",{name:this.draft.name}):n("confirmSaveEdit",{name:this.draft.name,rev:(i?.revision??0)+1})}</p>
          ${r.length?o`<p class="sentence">${n("affectsPlans",{stations:r.map(l=>this.stationName(l.station_id)).join(", ")})}</p>`:d}`;break}case"delete":{const i=this.plansFor(e.schedule.id);s=n("confirmDeleteTitle"),t=o`<p class="sentence" data-se-sentence>${n("confirmDelete",{name:e.schedule.name??""})}</p>
          ${i.length?o`<p class="sentence">${n("affectsPlans",{stations:i.map(r=>this.stationName(r.station_id)).join(", ")})}</p>`:d}`;break}case"import":{const i=this.importing;s=n("importTitle"),t=o`<p class="sentence" data-se-sentence>${n("importPreview",{n:i.preview.count??0,c:i.preview.name_collisions??0})}</p>
          <ul class="plain">${i.preview.items.map(r=>o`<li>${n("importRow",{name:r.name??"—",p:r.weekly_periods??0,h:r.holidays??0})}</li>`)}</ul>
          <p class="sentence s">${n("importAppend")}</p>`;break}case"deploy":{const i=this.targets.filter(r=>r.phase==="previewed");s=n("confirmDeployTitle",{n:i.length}),t=o`<p class="sentence" data-se-sentence>${n("confirmDeploy")}</p>
          ${this.writesOff?o`<p class="sentence warn" data-se-confirm-writes-off>${n("confirmDeployWritesOff")}</p>`:d}
          <ul class="plain">${i.map(r=>o`<li>${this.stationName(r.stationId)} · ${(r.impact?.station?.doors??[]).map(l=>l.name).join(", ")}${r.impact?.people?.explicit!=null?` · ${n("impactPeople",{explicit:r.impact.people.explicit,implicit:r.impact.people.implicit??"—",read:r.impact.people.read??"—"})}`:""}</li>`)}</ul>`;break}case"baseline_save":case"baseline_clear":s=e.kind==="baseline_save"?n("baselineSave"):n("baselineClear"),t=o`<p class="sentence" data-se-sentence>${this.stationName(this.assessment?.station)}</p>`;break;case"plan_recheck":s=n("planRecheck"),t=o`<p class="sentence" data-se-sentence>${n("confirmRecheck")} (${this.stationName(e.plan.station_id)})</p>`;break;case"plan_delete":s=n("planDelete"),t=o`<p class="sentence" data-se-sentence>${n("confirmPlanDelete",{station:this.stationName(e.plan.station_id)})}</p>`;break;case"claim":s=n("confirmClaimTitle"),t=o`<p class="sentence" data-se-sentence>${n("confirmClaim",{keys:e.keys.join(", "),station:this.stationName(e.plan.station_id)})}</p>`;break;case"release":s=n("planRelease"),t=o`<p class="sentence" data-se-sentence>${n("confirmRelease")}</p>`;break;case"job":{const i={job_check:n("jobRecheck"),job_cancel:n("jobCancel"),job_archive:n("jobArchive")}[e.action];s=i,t=o`<p class="sentence" data-se-sentence>${n("confirmJob",{action:i,station:this.stationName(e.job.station_id)})}</p>`;break}}return o`<sw-dialog open heading=${s} data-se-confirm=${e.kind} @close=${i=>i.target===i.currentTarget&&(this.ask=null)}>
      ${t}
      <div slot="footer">
        <wk-action-button data-se-confirm-cancel @click=${()=>this.ask=null}>${n("cancel")}</wk-action-button>
        <wk-action-button tone=${a?"danger":"primary"} data-se-confirm-send ?disabled=${!this.live} @click=${()=>void this.confirmAsk()}>${n("confirmSend")}</wk-action-button>
      </div>
    </sw-dialog>`}};w.styles=Z`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4);
      margin-block-start: var(--sw-s-4);
      --se-hit: var(--sw-touch-desktop, 44px);
    }
    @media (max-width: 1100px) {
      :host {
        --se-hit: 44px;
      }
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding: var(--sw-s-4);
    }
    .bh {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
    }
    .bh h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .bh .n {
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .bh .sp {
      flex: 1;
    }
    .rows {
      display: flex;
      flex-direction: column;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      padding-block: var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .row:first-child {
      border-block-start: 0;
    }
    .row .main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-inline-size: 0;
    }
    .t {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      overflow-wrap: anywhere;
    }
    .s {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-1);
      justify-content: flex-end;
    }
    @media (max-width: 640px) {
      .row {
        flex-wrap: wrap;
      }
      .acts {
        inline-size: 100%;
        justify-content: flex-start;
      }
    }
    .note {
      margin: 0;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
    .note[data-tone='ok'] {
      background: var(--sw-live-soft, var(--sw-surface-2));
      color: var(--sw-live-text, var(--sw-text));
    }
    .note[data-tone='refused'] {
      background: var(--sw-danger-soft, var(--sw-surface-2));
      color: var(--sw-danger-text);
    }
    .note[data-tone='not_sent'],
    .note[data-tone='unknown'] {
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
    }
    .warn {
      margin: 0;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
      font-size: var(--sw-fs-sm);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      padding: var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
    }
    .panel h4 {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2);
    }
    input {
      box-sizing: border-box;
      min-block-size: var(--se-hit);
      padding: 0 var(--sw-s-3);
      border: 1px solid var(--sw-border-strong, var(--sw-border));
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: max(16px, var(--sw-fs-sm));
      font-variant-numeric: tabular-nums;
    }
    input[type='time'],
    input[type='date'],
    input[type='number'] {
      direction: ltr;
    }
    input[type='number'] {
      inline-size: 6.5em;
    }
    input[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    label.f,
    div.f {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    ul.plain {
      margin: 0;
      padding-inline-start: var(--sw-s-4);
      font-size: var(--sw-fs-sm);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .result {
      font-size: var(--sw-fs-sm);
    }
    .result[data-ok='true'] {
      color: var(--sw-live-text, var(--sw-text));
    }
    .result[data-ok='false'] {
      color: var(--sw-text-2);
    }
    .target {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      padding: var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
    }
    .target[data-phase='previewed'],
    .target[data-phase='saved'] {
      border-color: var(--sw-accent);
    }
    .picks {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    .pick {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--se-hit);
      padding-inline: var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill, 999px);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      touch-action: manipulation;
      transition: border-color var(--sw-t-fast) var(--sw-ease), background var(--sw-t-fast) var(--sw-ease);
    }
    .pick[data-on] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft, var(--sw-surface-2));
    }
    .pick[data-off] {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .pick input {
      min-block-size: 0;
      inline-size: 18px;
      block-size: 18px;
      margin: 0;
      accent-color: var(--sw-accent);
    }
    .prog {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
    }
    .prog .row {
      border-block-start: 1px solid var(--sw-border);
    }
    .spin {
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      border: 2px solid var(--sw-border);
      border-block-start-color: var(--sw-accent);
      animation: spin 700ms linear infinite;
      flex: none;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spin {
        animation: none;
      }
    }
    .sentence {
      margin: 0 0 var(--sw-s-2);
      line-height: 1.5;
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    input[type='file'] {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      opacity: 0;
      pointer-events: none;
    }
  `;f([$({attribute:!1})],w.prototype,"stations",2);f([$({attribute:!1})],w.prototype,"library",2);f([$({attribute:!1})],w.prototype,"plans",2);f([$({attribute:!1})],w.prototype,"ops",2);f([$({type:Boolean})],w.prototype,"live",2);f([$({type:Boolean})],w.prototype,"narrow",2);f([p()],w.prototype,"editing",2);f([p()],w.prototype,"draft",2);f([p()],w.prototype,"checkAt",2);f([p()],w.prototype,"checked",2);f([p()],w.prototype,"busy",2);f([p()],w.prototype,"assessStation",2);f([p()],w.prototype,"assessment",2);f([p()],w.prototype,"importing",2);f([p()],w.prototype,"deploying",2);f([p()],w.prototype,"targets",2);f([p()],w.prototype,"progress",2);f([p()],w.prototype,"ask",2);f([p()],w.prototype,"note",2);f([p()],w.prototype,"claims",2);w=f([ee("wk-schedule-library")],w);var Rt=Object.defineProperty,Et=Object.getOwnPropertyDescriptor,g=(e,s,t,a)=>{for(var i=a>1?void 0:a?Et(s,t):s,r=e.length-1,l;r>=0;r--)(l=e[r])&&(i=(a?l(s,t,i):l(i))||i);return a&&i&&Rt(s,t,i),i};const Ie="sw.wiskey.schedules.view",Nt=3e4,Y={state:"loading",data:null,at:0,fresh:!0,fetchedAt:null},T=(e,s=null)=>({state:e,data:s,at:Date.now(),fresh:!0,fetchedAt:null});function Pt(e){try{return localStorage.getItem(e)}catch{return null}}function Ct(e,s){try{localStorage.setItem(e,s)}catch{}}const ie={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"},Re={kind:"iana",name:"Asia/Jerusalem"},Ee={loaded:!0,model:null,firmware:null,capabilities:null,clock:null,event_status:null,scanned_at:null,scanning:!1,reconciled_at:null,last_poll_ms:null},Lt=[{id:"d1",name:"שער ראשי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"שער"}],has_camera:!1,camera_entity:null,last_seen:null,zone:Re,technical:Ee,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!1,camera_entity:null,last_seen:null,zone:Re,technical:Ee,errors:null}],F=[{start:"07:00",end:"09:00"}],Mt={d1:{programs:[],saved:[],timezone:"Asia/Jerusalem",native_supported:!1},d2:{programs:[{door:1,revision:1,enabled:!0,removing:!1,policy:{timezone:"Asia/Jerusalem",name:"בוקר",weekly:{Sunday:F,Monday:F,Tuesday:F,Wednesday:F,Thursday:F},holidays:[]},execution:{owned:!1,attempted:null,status:"idle"},error:null,checked_at:null}],saved:[],timezone:"Asia/Jerusalem",native_supported:!1}};let b=class extends Q{constructor(){super(...arguments),this.feed=null,this.error="",this.access={screen:!0,library:!0,edit:!1},this.wanted=null,this.view=Pt(Ie)==="table"?"table":"door",this.narrow=typeof window<"u"&&window.innerWidth<te,this.sheet=!1,this.programs={},this.codes={},this.library=Y,this.plans=Y,this.ops=Y,this.features={},this.manage=!1,this.managing=U().params.get("manage")==="1",this.stopSession=null,this.stopRoute=null,this.poll=0,this.loading=!1,this.loadAgain=!1,this.inFlight=new Set,this.featuresRead=!1,this.mq=typeof matchMedia=="function"?matchMedia(`(max-width: ${te-1}px)`):null,this.onMedia=()=>{this.narrow=window.innerWidth<te},this.onVisible=()=>{document.hidden||this.load()}}connectedCallback(){super.connectedCallback(),this.mq?.addEventListener("change",this.onMedia),this.wanted=U().params.get("door"),this.stopRoute=Ge(e=>this.onRoute(e)),se()&&(this.stopSession=Xe(()=>{this.access=me(fe,K),this.manage=ge(K)}),this.access=me(fe,K),this.manage=ge(K),this.access.screen&&(this.load(),this.poll=window.setInterval(()=>{document.hidden||this.load()},as),document.addEventListener("visibilitychange",this.onVisible)))}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMedia),this.stopRoute?.(),this.stopRoute=null,this.stopSession?.(),this.stopSession=null,window.clearInterval(this.poll),document.removeEventListener("visibilitychange",this.onVisible)}onRoute(e){if(e.mode!=="wiskey")return;this.managing=e.params.get("manage")==="1";const s=e.params.get("door");s!==this.wanted&&(this.wanted=s,this.loadNeeded())}demo(){return!se()}stations(){return this.demo()?Lt:this.feed?.stations??[]}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{this.feed=await Qe(),this.error=""}catch(e){e instanceof ne&&e.status===403?this.access={...this.access,screen:!1}:this.error=Ze(e)}await this.readFeatures(),await this.loadNeeded(),await this.loadLibrary()}while(this.loadAgain)}finally{this.loading=!1}}async readFeatures(){if(!this.featuresRead)try{const e=await es();this.features=Object.fromEntries(Object.entries(e.features??{}).map(([s,t])=>[s,t.available])),this.featuresRead=!0}catch{}}needed(){const e=ae(this.stations());if(this.effectiveView()==="table")return[...new Set(e.map(t=>t.stationId))];const s=be(e,this.wanted);return s?[s.stationId]:[]}async loadNeeded(){if(!this.demo())for(const e of this.needed()){const s=Math.min(this.programs[e]?.at??0,this.codes[e]?.at??0);Date.now()-s<Nt||await this.loadStation(e)}}classify(e,s,t){const a=Date.now();if(e.state==="ready"&&s!==null&&s!==void 0)return{state:"ready",data:s,at:a,fresh:e.fresh!==!1,fetchedAt:e.fetched_at};const i=e.state==="unsupported"?"unsupported":is(e.last_error)?"busy":"error";return i==="unsupported"?T(i):{state:i,data:t?.data??null,at:a,fresh:!1,fetchedAt:t?.fetchedAt??null}}failed(e,s){return e instanceof ne&&(e.status===403||e.status===404)?T("forbidden"):{state:"error",data:s?.data??null,at:Date.now(),fresh:!1,fetchedAt:s?.fetchedAt??null}}async loadStation(e){if(!this.inFlight.has(e)){this.inFlight.add(e);try{if(this.features.door_programs===!1)this.programs={...this.programs,[e]:T("unsupported")};else{this.programs[e]||(this.programs={...this.programs,[e]:Y});try{const s=await ss(e);this.programs={...this.programs,[e]:this.classify(s,s.programs,this.programs[e])}}catch(s){this.programs={...this.programs,[e]:this.failed(s,this.programs[e])}}}if(this.features.public_codes===!1)this.codes={...this.codes,[e]:T("unsupported")};else try{const s=await ts(e);this.codes={...this.codes,[e]:this.classify(s,s.codes,this.codes[e])}}catch(s){this.codes={...this.codes,[e]:this.failed(s,this.codes[e])}}}finally{this.inFlight.delete(e)}}}async loadLibrary(){if(this.demo()||!this.access.library)return;const e=async(s,t,a)=>{if(this.features[s]===!1)return T("unsupported");try{const i=await t();return this.classify(i,i.schedules,a)}catch(i){return this.failed(i,a)}};if(this.library=await e("schedules",bs,this.library),this.library.state==="forbidden"){this.plans=T("forbidden"),this.ops=T("forbidden");return}this.plans=await e("schedule_plans",vs,this.plans),this.ops=await e("schedule_operations",gs,this.ops)}effectiveView(){return this.narrow?"door":this.view}setView(e){this.view=e,Ct(Ie,e),this.loadNeeded()}pick(e){if(this.sheet=!1,this.wanted===e&&this.effectiveView()==="door")return;this.wanted=e,this.view==="table"&&this.setView("door");const s=U();if(s.mode==="wiskey"){const t=new URLSearchParams(s.params);t.set("door",e),we(s.path,t)}this.loadNeeded()}refresh(){this.programs=Object.fromEntries(Object.entries(this.programs).map(([e,s])=>[e,{...s,at:0}])),this.codes=Object.fromEntries(Object.entries(this.codes).map(([e,s])=>[e,{...s,at:0}])),this.load()}zoneOf(e){return this.stations().find(s=>s.id===e)?.zone??this.feed?.default_zone??null}programsOf(e){return this.demo()?T("ready",Mt[e]??null):this.programs[e]}codesOf(e){return this.demo()?T("ready",{public_pin_state:e==="d2"?"configured":"absent",slots:[],capabilities:{advertised:null,min:null,max:null},checked_at:null}):this.codes[e]}staleLine(e,s,t){return e.fresh||!e.data?d:o`<p class="status" role="status" data-sch-stale=${t}>${c("stale",{t:J(e.fetchedAt,s)||"—"})}</p>`}render(){const e=c("title");if(se()&&!this.access.screen)return o`<sw-page heading=${e}><div data-sch data-sch-state="forbidden"><sw-state-panel quiet state="forbidden" heading=${c("noPermission")} data-sch-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return o`<sw-page heading=${e}><div data-sch data-sch-state=${this.error?"error":"loading"}>${this.error?o`<sw-state-panel quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="error" @action=${()=>this.refresh()}></sw-state-panel>`:o`<sw-state-panel quiet state="loading" heading=${c("loading")} data-sch-panel="loading"></sw-state-panel>`}</div></sw-page>`;if(!this.demo()&&this.feed.stations===null){const s=this.feed.state==="ready"?"error":this.feed.state,t=ns(s);return o`<sw-page heading=${e}><div data-sch data-sch-state=${`feed:${this.feed.state}`}>
        <sw-state-panel icon="calendar" quiet state=${t.panel} heading=${t.heading} actionLabel=${t.panel==="error"||t.panel==="stale"?c("retry"):""} data-sch-panel=${`feed:${this.feed.state}`} @action=${()=>this.refresh()}></sw-state-panel>
      </div></sw-page>`}return this.renderReady()}setManaging(e){this.managing=e;const s=U();if(s.mode==="wiskey"){const t=new URLSearchParams(s.params);e?t.set("manage","1"):t.delete("manage"),we(s.path,t)}e&&this.loadLibrary()}renderManaging(){const e=this.stations(),s=this.library;return o`<sw-page wide heading=${c("title")} subheading=${ve(ae(e).length,s.data?s.data.length:null)}>
      <sw-button slot="actions" variant="ghost" icon="chevronBack" data-sch-manage-close @click=${()=>this.setManaging(!1)}>${c("viewDoor")}</sw-button>
      <sw-button slot="actions" variant="ghost" icon="refresh" data-sch-refresh label=${c("refresh")} @click=${()=>this.refresh()}>${c("refresh")}</sw-button>
      <div data-sch data-sch-state=${s.data?"ready":s.state} data-sch-view="manage">
        ${s.data?this.renderManage(e):s.state==="loading"?o`<sw-state-panel quiet state="loading" heading=${c("loading")} data-sch-panel="manage-loading"></sw-state-panel>`:o`<sw-state-panel quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="manage-error" @action=${()=>this.refresh()}></sw-state-panel>`}
      </div>
    </sw-page>`}renderReady(){if(this.manage&&this.managing&&!this.demo()&&this.access.library)return this.renderManaging();const e=this.stations(),s=ae(e),t=this.effectiveView(),a=be(s,this.wanted),i=this.demo()?!1:this.access.library&&this.library.state!=="forbidden",r=i&&this.library.data?this.library.data.length:null,l=!this.demo()&&this.feed?.fresh===!1;return o`<sw-page wide heading=${c("title")} subheading=${ve(s.length,r)}>
      ${this.access.edit&&!this.demo()?o`<sw-button slot="actions" variant="ghost" icon="edit" data-sch-edit @click=${()=>window.location.hash=rs}>${c("editClassic")}</sw-button>`:d}
      ${this.manage&&this.access.library&&!this.demo()?o`<sw-button slot="actions" variant="ghost" icon="calendar" data-sch-manage-open @click=${()=>this.setManaging(!0)}>${n("manageOpen")}</sw-button>`:d}
      <sw-button slot="actions" variant="ghost" icon="refresh" data-sch-refresh label=${c("refresh")} @click=${()=>this.refresh()}>${c("refresh")}</sw-button>
      ${this.demo()?d:o`<wk-deep-links slot="actions" place="schedules" mode="menu"></wk-deep-links>`}
      ${s.length&&!this.narrow?o`<sw-view-switch slot="actions" data-sch-views label=${c("viewLabel")} .value=${t} .options=${[{id:"door",label:c("viewDoor"),icon:"calendar"},{id:"table",label:c("viewTable"),icon:"table"}]} @change=${h=>this.setView(h.detail)}></sw-view-switch>`:d}
      <div data-sch data-sch-state=${s.length?"ready":"empty"} data-sch-view=${t}>
        ${l?o`<p class="status" role="status" data-sch-stale="stations">${c("stale",{t:J(this.feed?.fetched_at,this.feed?.default_zone??null)||"—"})}</p>`:d}
        ${s.length?t==="table"?this.renderTable(s):this.renderDoorView(s,a):o`<sw-state-panel icon="calendar" quiet state="empty" heading=${c("noDoors")} data-sch-panel="empty"></sw-state-panel>`}
        ${i?this.renderLibrary(e):d}
      </div>
      ${s.length?this.renderSheet(s,a):d}
    </sw-page>`}renderDoorList(e,s,t=!1){return o`<nav class="doors" aria-label=${c("doorsHeading")} data-sch-door-list=${t?"sheet":"side"}>
      ${t?d:o`<div class="ttl">${c("doorsHeading")}</div>`}
      ${os(e).map(a=>o`<div class="station" data-sch-station=${a.stationId}><span class="dot ${a.online?"":"off"}" aria-hidden="true"></span>${a.stationName}</div>
          ${a.doors.map(i=>o`<button type="button" aria-current=${String(i.key===s?.key)} data-sch-door=${i.key} @click=${()=>this.pick(i.key)}><span class="name">${i.doorName}</span></button>`)}`)}
    </nav>`}renderSheet(e,s){return o`<sw-drawer modal ?open=${this.sheet} heading=${c("pickDoor")} data-sch-sheet @close=${t=>t.target===t.currentTarget&&(this.sheet=!1)}>
      ${this.renderDoorList(e,s,!0)}
    </sw-drawer>`}renderDoorView(e,s){return s?o`<div class="layout">
      <aside class="doorcol"><sw-card flush>${this.renderDoorList(e,s)}</sw-card></aside>
      <section class="main" data-sch-door-view=${s.key}>
        <button type="button" class="chip" data-sch-door-chip aria-haspopup="dialog" @click=${()=>this.sheet=!0}>
          <sw-icon name="door" size=${16}></sw-icon><span class="name">${c("doorAt",{door:s.doorName,station:s.stationName})}</span><sw-icon name="chevronDown" size=${12}></sw-icon>
        </button>
        ${this.renderDoor(s)}
      </section>
    </div>`:d}renderCodePill(e){const s=this.codesOf(e);if(s?.state==="unsupported"||s?.state==="forbidden")return d;const t=s?.data?ls(s.data):"unknown";return o`<sw-badge kind=${t==="set"?"live":t==="unset"?"neutral":"unknown"} label=${c("codePill",{state:ds(t)})} data-sch-code=${t}></sw-badge>`}renderDoor(e){const s=this.programsOf(e.stationId),t=this.zoneOf(e.stationId),a=o`<div class="doorhead">
      <h2 data-sch-door-title>${c("doorAt",{door:e.doorName,station:e.stationName})}</h2>
      ${e.online?d:o`<span class="sub" data-sch-offline>${c("offline")}</span>`}
      <span class="sp"></span>
      ${this.renderCodePill(e.stationId)}
    </div>`;let i;return!s||s.state==="loading"&&!s.data?i=o`<sw-state-panel compact quiet state="loading" heading=${c("loading")} data-sch-panel="door-loading"></sw-state-panel>`:s.state==="unsupported"?i=o`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("sUnsupported")} data-sch-panel="door-unsupported"></sw-state-panel>`:s.state==="forbidden"?i=o`<sw-state-panel compact quiet state="forbidden" heading=${c("noPermission")} data-sch-panel="door-forbidden"></sw-state-panel>`:s.data?i=this.renderProgram(e,s,t):i=s.state==="busy"?o`<sw-state-panel compact quiet state="stale" heading=${c("busy")} data-sch-panel="door-busy"></sw-state-panel>`:o`<sw-state-panel compact quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="door-error" @action=${()=>void this.loadStation(e.stationId)}></sw-state-panel>`,o`${a}${i}`}renderProgram(e,s,t){const a=cs(e,s.data),i=this.staleLine(s,t,"door");if(a.none)return o`${i}<sw-card><div class="block"><sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("noProgram")} data-sch-panel="no-program"></sw-state-panel></div></sw-card>`;const r=hs(a.state);return o`${i}<sw-card>
      <div class="block" data-sch-program=${a.state}>
        <div class="bh"><h3>${c("programsTitle")}</h3><span class="sp"></span><sw-badge kind=${ie[r]} label=${ps(`st_${a.state}`,"st_unknown")} data-sch-program-state=${a.state}></sw-badge></div>
        <div class="prog">
          <span class="name" data-sch-program-name>${a.name}</span>
          ${a.execution?o`<span class="muted" data-sch-execution>${a.execution}</span>`:d}
        </div>
        <sw-week-grid data-sch-week aria-label=${c("weekLabel")} .days=${a.days} .modes=${[{id:"hold",label:c("legendHold"),color:"var(--sw-accent)"}]}></sw-week-grid>
        ${a.unreadable?o`<span class="muted" data-sch-hours-unknown>${c("hoursUnknown")}</span>`:d}
        ${a.lines.length?o`<ul class="lines" data-sch-lines>${a.lines.map(l=>o`<li>${l}</li>`)}</ul>`:d}
        ${a.dates.length?o`<div class="dates" data-sch-dates><h4>${c("datesTitle")}</h4><ul class="lines">${a.dates.map(l=>o`<li>${l}</li>`)}</ul></div>`:d}
        ${a.checkedAt||a.timezone?o`<span class="muted">${[a.checkedAt?c("checked",{when:J(a.checkedAt,t)}):"",a.timezone?c("zone",{zone:a.timezone}):""].filter(Boolean).join(" · ")}</span>`:d}
      </div>
    </sw-card>`}renderTable(e){const s=Object.fromEntries(e.map(r=>[r.stationId,this.programsOf(r.stationId)?.data??null])),t=Object.fromEntries(e.map(r=>[r.stationId,this.codesOf(r.stationId)?.data??null])),a=us(e,s,t),i=[{key:"door",label:c("colDoor"),render:r=>o`<b>${r.door}</b>`},{key:"station",label:c("colStation")},{key:"program",label:c("colProgram")},{key:"kind",label:c("colKind")},{key:"when",label:c("colWhen")},{key:"state",label:c("colState"),render:r=>r.state?o`<sw-badge kind=${ie[r.tone]} label=${r.state}></sw-badge>`:""},{key:"code",label:c("colCode"),render:r=>o`<span data-sch-code=${r.codeState}>${r.code}</span>`}];return o`<sw-table dense data-sch-table .rowKey=${"key"} .columns=${i} .rows=${a} @row-select=${r=>this.pick(r.detail.id)}></sw-table>`}renderManage(e){const s=this.feed?.fresh===!1||!this.library.fresh;return o`<div class="manage" data-sch-manage>
      <wk-schedule-library .stations=${[...e]} .library=${this.library.data} .plans=${this.plans.data} .ops=${this.ops.data} ?live=${!s} ?narrow=${this.narrow}
        @sched-changed=${()=>void this.loadLibrary()}></wk-schedule-library>
    </div>`}renderLibrary(e){const s=ws(e),t=this.feed?.default_zone??null,a=u=>u.state==="forbidden"||u.state==="unsupported",i=this.library,r=a(this.plans)?null:this.plans;if(a(i)&&!r)return d;const l=(u,S,N,ue,qe)=>o`<sw-card>
      <div class="block" data-sch-block=${S}>
        <div class="bh"><h3>${u}</h3>${ue!==null?o`<span class="n">${ue}</span>`:d}</div>
        ${N.state==="loading"&&!N.data?o`<sw-state-panel compact quiet state="loading" heading=${c("loading")}></sw-state-panel>`:N.state==="unsupported"?o`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("sUnsupported")} data-sch-panel=${`${S}-unsupported`}></sw-state-panel>`:N.data?o`${this.staleLine(N,t,S)}${qe}`:N.state==="busy"?o`<sw-state-panel compact quiet state="stale" heading=${c("busy")} data-sch-panel=${`${S}-busy`}></sw-state-panel>`:o`<sw-state-panel compact quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel=${`${S}-error`} @action=${()=>this.refresh()}></sw-state-panel>`}
      </div>
    </sw-card>`,h=fs(i.data,r?.data??null,s),m=ms(r?.data??null,a(this.ops)?null:this.ops.data,i.data,s),E=h.length?o`<div class="rows">${h.map(u=>o`<div class="row" data-sch-lib-row=${u.id}>
            <div class="main"><span class="t">${u.name}${u.version?o` <span class="muted">${u.version}</span>`:d}</span>
              ${u.lines.map(S=>o`<span class="s">${S}</span>`)}
              <span class="s">${[u.holidays,u.proposals].filter(Boolean).join(" · ")}</span></div>
          </div>`)}</div>`:o`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("libraryEmpty")} data-sch-panel="library-empty"></sw-state-panel>`,q=m.length?o`<div class="rows">${m.map(u=>o`<div class="row" data-sch-plan-row=${u.id}>
            <div class="main"><span class="t">${u.name} · ${u.station}</span>
              <span class="s">${[u.state!==u.source?u.source:"",u.outdated?c("outdated"):"",u.notApplied?c("notApplied"):"",u.checkedAt?c("checked",{when:J(u.checkedAt,u.stationId&&this.zoneOf(u.stationId)||t)}):""].filter(Boolean).join(" · ")}</span></div>
            <sw-badge kind=${ie[u.tone]} label=${u.state} data-sch-plan-state=${u.tone}></sw-badge>
          </div>`)}</div>`:o`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("plansEmpty")} data-sch-panel="plans-empty"></sw-state-panel>`;return o`<div class="two" data-sch-library>
      ${a(i)?d:l(c("libraryTitle"),"library",i,i.data?i.data.length:null,E)}
      ${r?l(c("plansTitle"),"plans",r,r.data?r.data.length:null,q):d}
    </div>`}};b.styles=$s;g([p()],b.prototype,"feed",2);g([p()],b.prototype,"error",2);g([p()],b.prototype,"access",2);g([p()],b.prototype,"wanted",2);g([p()],b.prototype,"view",2);g([p()],b.prototype,"narrow",2);g([p()],b.prototype,"sheet",2);g([p()],b.prototype,"programs",2);g([p()],b.prototype,"codes",2);g([p()],b.prototype,"library",2);g([p()],b.prototype,"plans",2);g([p()],b.prototype,"ops",2);g([p()],b.prototype,"features",2);g([p()],b.prototype,"manage",2);g([p()],b.prototype,"managing",2);b=g([ee("wiskey-schedules")],b);export{b as WiskeySchedules};
