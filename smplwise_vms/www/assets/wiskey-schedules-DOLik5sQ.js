import{b4 as I,g as Q,cG as Ee,cE as Pe,bE as Le,ay as _,i as ee,A as l,b as r,ei as T,k as te,a as Z,bn as se,h$ as Me,i0 as We,j as u,ab as q,jz as qe,a3 as V,cA as Fe,n as He,bf as de,aB as F,a4 as ce}from"./index-DJHEuoub.js";import"./sw-table-BdIEYBQo.js";import"./sw-view-switch-Drz23Y1j.js";import"./sw-week-grid-DeiYFBWC.js";import"./wk-deep-links-ZN-8IFz9.js";import{g as Be,a as Ue,b as Ke,c as Je}from"./access-stations-HqhMwt0m.js";import{T as Y,s as he,P as Ve,d as G,p as pe,i as Ye,a as c,b as H,f as Ge,c as ue,C as Xe,e as Ze,g as Qe,h as et,j as tt,k as st,l as at,t as it,m as nt,n as ot,o as rt}from"./schedules-logic-YifVUqlL.js";import"./sw-logo-art-MaHPMZFI.js";import"./deep-links-Ct6LEgFZ.js";import"./wiskey-format-O1tpLoU4.js";import"./wiskey-DrQ23MHQ.js";const lt=()=>I("access-control/schedules"),dt=()=>I("access-control/schedules/plans"),ct=()=>I("access-control/schedules/operations"),ht=Q`
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
  .muted {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
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
`;function we(e){return e("access.schedules.manage")||e("system.configure")}const z=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],pt=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],ut=["Sunday","Monday","Tuesday","Wednesday","Thursday"],K=8,wt=64,mt=32,ae=/^(?:[01]\d|2[0-3]):[0-5]\d$/,ie=/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/,ft=/^\d{4}-\d{2}-\d{2}$/,ne=()=>Object.fromEntries(z.map(e=>[e,[]])),me=(e="")=>({name:e,weekly:ne(),holidays:[]});function fe(e){const t=ne();for(const s of z)t[s]=(e.weekly?.[s]??[]).map(a=>({start:a.start,end:a.end}));return{name:e.name??"",weekly:t,holidays:(e.holidays??[]).map(s=>({name:s.name??"",start:s.start??"",end:s.end??"",periods:(s.periods??[]).map(a=>({start:a.start,end:a.end}))}))}}const bt=(e,t)=>JSON.stringify(J(e))===JSON.stringify(J(t));function J(e){const t=s=>[...s].sort((a,i)=>a.start.localeCompare(i.start));return{name:e.name,weekly:Object.fromEntries(z.map(s=>[s,t(e.weekly[s]??[])])),holidays:[...e.holidays].map(s=>({...s,periods:t(s.periods)})).sort((s,a)=>s.start.localeCompare(a.start))}}const k=e=>e==="24:00"?1440:Number(e.slice(0,2))*60+Number(e.slice(3,5));function be(e,t){if(e.length>K)return[{code:"schedule_period_limit",where:t}];const s=[];if(e.forEach((i,o)=>{!ae.test(i.start)||!ie.test(i.end)?s.push({code:"schedule_invalid_time",where:`${t}.${o}`}):k(i.start)>=k(i.end)&&s.push({code:"schedule_invalid_time",where:`${t}.${o}`})}),s.length)return s;const a=[...e].sort((i,o)=>k(i.start)-k(o.start));for(let i=1;i<a.length;i++)if(k(a[i-1].end)>k(a[i].start))return[{code:"schedule_overlap",where:t}];return[]}function R(e){if(!ft.test(e))return!1;const[t,s,a]=e.split("-").map(Number),i=new Date(Date.UTC(t,s-1,a));return t>=2e3&&t<=2037&&i.getUTCMonth()===s-1&&i.getUTCDate()===a}function ge(e){return e.length>mt||!e.trim()||/[\u0000-\u001f]/.test(e)}function gt(e){const t=[];ge(e.name)&&t.push({code:"invalid_text",where:"name"});for(const a of z)t.push(...be(e.weekly[a]??[],`weekly.${a}`));e.holidays.length>wt&&t.push({code:"schedule_holiday_limit",where:"holidays"}),e.holidays.forEach((a,i)=>{const o=`holidays.${i}`;ge(a.name)&&t.push({code:"invalid_text",where:`${o}.name`}),R(a.start)||t.push({code:"schedule_invalid_date",where:`${o}.start`}),R(a.end)||t.push({code:"schedule_invalid_date",where:`${o}.end`}),R(a.start)&&R(a.end)&&a.start>a.end&&t.push({code:"schedule_invalid_date",where:o}),t.push(...be(a.periods,`${o}.periods`))});const s=e.holidays.filter(a=>R(a.start)&&R(a.end)).sort((a,i)=>a.start.localeCompare(i.start));for(let a=1;a<s.length;a++)if(s[a-1].end>=s[a].start){t.push({code:"schedule_holiday_overlap",where:"holidays"});break}return t}const v=(e,t)=>e.find(s=>s.where===t||s.where.startsWith(`${t}.`));function oe(e,t,s){return{...e,weekly:{...e.weekly,[t]:s}}}function vt(e){if(e.length>=K)return null;if(!e.length)return{start:"08:00",end:"17:00"};const t=Math.max(...e.map(i=>k(i.end)));if(t>=1439)return null;const s=Math.min(1440,t+60),a=i=>i===1440?"24:00":`${String(Math.floor(i/60)).padStart(2,"0")}:${String(i%60).padStart(2,"0")}`;return{start:a(t),end:a(s)}}function yt(e,t){const s=vt(e.weekly[t]??[]);return s?oe(e,t,[...e.weekly[t]??[],s]):e}function $t(e,t,s){return oe(e,t,(e.weekly[t]??[]).filter((a,i)=>i!==s))}function ve(e,t,s,a,i){return oe(e,t,(e.weekly[t]??[]).map((o,d)=>d===s?{...o,[a]:i}:o))}function kt(e,t,s){const a={...e.weekly};for(const i of s)i!==t&&(a[i]=(e.weekly[t]??[]).map(o=>({...o})));return{...e,weekly:a}}function _t(e,t){const s={name:"",start:t,end:t,periods:[]};return{...e,holidays:[...e.holidays,s]}}function D(e,t,s){return{...e,holidays:e.holidays.map((a,i)=>i===t?{...a,...s}:a)}}function xt(e,t){return{...e,holidays:e.holidays.filter((s,a)=>a!==t)}}function je(e){return z.map(t=>(e[t]??[]).filter(s=>ae.test(s.start)&&ie.test(s.end)).map(s=>({begin:`${s.start}:00`,end:`${s.end}:00`})))}function St(e,t){const s=je(t),a=ne();return z.forEach((i,o)=>{const d=(e[o]??[]).map(f=>({start:f.begin.slice(0,5),end:f.end.slice(0,5)==="24:00"?"24:00":f.end.slice(0,5)})),h=JSON.stringify(ye(e[o]??[]))===JSON.stringify(ye(s[o]??[]));a[i]=h?(t[i]??[]).map(f=>({...f})):d}),a}function ye(e){const t=Array.from({length:24},()=>!1);for(const s of e){const a=Math.floor(k(s.begin.slice(0,5))/60),i=Math.min(24,Math.ceil(k(s.end.slice(0,5))/60));for(let o=a;o<i;o++)t[o]=!0}return t}function Oe(e){return z.reduce((t,s)=>t+(e[s]??[]).reduce((a,i)=>ae.test(i.start)&&ie.test(i.end)?a+Math.max(0,k(i.end)-k(i.start)):a,0),0)}function re(e,t){const a=e?.checks.find(i=>i.kind===t)?.capabilities?.ids;return Array.isArray(a)&&a.length===2?[a[0],a[1]]:null}function $e(e,t,s){if(s&&s.holidays.length===e&&e===0==(s.holiday_group===null))return{...s,holidays:[...s.holidays]};const a=(o,d)=>re(t,o)?.[1]??d,i=a("holiday",64);return{template:a("template",1),weekly:a("weekly",1),holiday_group:e?a("holiday_group",1):null,holidays:Array.from({length:e},(o,d)=>Math.max(1,i-d))}}function ke(e,t){const s={},a=(i,o,d)=>{if(d===null||!Number.isInteger(d)||d<1||d>65535)s[i]="schedule_binding_invalid";else{const h=re(t,o);h&&(d<h[0]||d>h[1])&&(s[i]="schedule_binding_out_of_range")}};return a("template","template",e.template),a("weekly","weekly",e.weekly),e.holidays.length&&a("holiday_group","holiday_group",e.holiday_group),e.holidays.forEach((i,o)=>a(`holidays.${o}`,"holiday",i)),new Set(e.holidays).size!==e.holidays.length&&(s.holidays="schedule_binding_invalid"),s}function _e(e){switch(e){case"verified":case"ready":return"live";case"blocked":case"interrupted":return"stale";case"failed":return"error";case"cancelled":return"offline";case"pending":case"queued":case"checking":return"neutral";default:return"unknown"}}const xe=e=>e==="pending"||e==="queued"||e==="checking";function Tt(e){return e.status==="queued"?"neutral":e.status==="refused"?"error":e.status==="not_sent"?"offline":"unknown"}function B(e){const t=new Date(e),s=a=>String(a).padStart(2,"0");return{date:`${t.getFullYear()}-${s(t.getMonth()+1)}-${s(t.getDate())}`,time:`${s(t.getHours())}:${s(t.getMinutes())}`}}const Re={manageTitle:"ניהול ספריית לוחות הזמנים",manageOpen:"ניהול הספרייה",newSchedule:"לוח זמנים חדש",importFile:"ייבוא מקובץ",exportFile:"ייצוא לקובץ",edit:"עריכה",remove:"מחיקה",deploy:"פריסה לעמדות",assess:"בדיקת התאמה לעמדה",editorNew:"לוח זמנים חדש",editorEdit:"עריכת {name}",name:"שם",namePlaceholder:"למשל: שעות משרד",weekTitle:"שבוע",gridHint:"גרירה על הלוח מסמנת שעות שלמות; לדקות מדויקות ערכו את השעות בכל יום",addWindow:"הוספת חלון",removeWindow:"הסרת החלון",from:"מ־",to:"עד",closedDay:"סגור",copyTo:"העתקה לימי חול",copyAll:"העתקה לכל השבוע",holidaysTitle:"חגים ותאריכים מיוחדים",holidaysHint:"בתאריכים אלה חלים החלונות של החג במקום השבוע",addHoliday:"הוספת תאריך מיוחד",holidayName:"שם",holidayFrom:"מתאריך",holidayTo:"עד תאריך",holidayClosed:"סגור כל היום",removeHoliday:"הסרת התאריך",summaryHours:"{h} שעות בשבוע",checkTitle:"בדיקה מקדימה",checkAt:"בדיקה לתאריך ושעה",checkRun:"בדיקה",checkOpen:"ב־{date} {time} הדלתות ייפתחו לפי לוח הזמנים ({source})",checkClosed:"ב־{date} {time} לוח הזמנים סגור ({source})",sourceWeekly:"לפי השבוע",sourceHoliday:"לפי {name}",checkNeeded:"לפני שמירה יש להריץ בדיקה מקדימה",checkStale:"הטיוטה השתנתה מאז הבדיקה - יש לבדוק שוב",checkOk:"הבדיקה עברה",save:"שמירה",cancel:"ביטול",close:"סגירה",saving:"שומר…",confirmSaveTitle:"לשמור את לוח הזמנים?",confirmSaveNew:'לוח הזמנים "{name}" יתווסף לספרייה. הוא לא נשלח לאף עמדה עד שתפרסו אותו.',confirmSaveEdit:'לוח הזמנים "{name}" יעודכן בספרייה (גרסה {rev}).',affectsPlans:'יש לו הצעות פריסה ל־{stations}. אחרי השמירה הן יסומנו "הספרייה השתנתה" ויהיה צורך להכין אותן מחדש.',confirmDeleteTitle:"למחוק את לוח הזמנים?",confirmDelete:'לוח הזמנים "{name}" יימחק מהספרייה.',confirmSend:"אישור",saved:"נשמר בספרייה",deleted:"נמחק מהספרייה",importTitle:"ייבוא לוחות זמנים",importPick:"בחירת קובץ",importPreview:"{n} לוחות זמנים בקובץ · {c} בשם שכבר קיים",importAppend:"הייבוא מוסיף לספרייה ואינו מחליף לוחות קיימים",importApply:"ייבוא",importDone:"יובאו {n} לוחות זמנים",importTooLarge:"הקובץ גדול מדי לייבוא מכאן",importRow:"{name} · {p} חלונות · {h} חגים",assessTitle:"התאמה לעמדה",pickStation:"עמדה",assessRun:"בדיקה",assessFits:"לוח הזמנים מתאים ליכולות העמדה",assessExceeds:"לוח הזמנים חורג מיכולות העמדה",assessUnknown:"העמדה לא דיווחה על כל היכולות - לא ידוע אם הוא מתאים",limitRow:"{key}: נדרש {needed} · זמין {available}",baselineTitle:"נקודת השוואה",baselineState:"מצב: {state}",baselineSave:"שמירה כנקודת השוואה",baselineClear:"ניקוי נקודת ההשוואה",baselineSaved:"נקודת ההשוואה נשמרה",baselineCleared:"נקודת ההשוואה נוקתה",deployTitle:'פריסת "{name}" לעמדות',deployStations:"עמדות",deployStep1:"בחירת עמדות ומשבצות",deployStep2:"בדיקה מקדימה",deployStep3:"אישור ופריסה",slotsTitle:"משבצות בעמדה",slotsHint:"מספרי המשבצות בעמדה ללוח הזמנים. הטווח לפי מה שהעמדה דיווחה",slotTemplate:"תבנית",slotWeekly:"שבוע",slotGroup:"קבוצת חגים",slotHoliday:"חג {n}",range:"טווח {a}-{b}",readStation:"קריאת העמדה",reading:"קורא את העמדה… (עד שתי דקות)",previewRun:"בדיקה מקדימה",previewAll:"בדיקה מקדימה לכל העמדות",impactTitle:"מה ייפגע",impactStation:"עמדה: {name}",impactDoors:"דלתות: {doors}",impactNoDoors:"לעמדה אין דלתות מנוהלות",impactPeople:"{explicit} אנשים עם לוח זמנים משלהם · {implicit} לפי ברירת המחדל של העמדה · {read} נקראו",impactPeopleUnknown:"לא ידוע כמה אנשים בעמדה (הקריאה נכשלה)",conflictsTitle:"התנגשויות",resourceRow:"{kind} {id}: {state}",externalRef:"בשימוש מחוץ להצעה",activeRes:"פעיל בעמדה",blockersTitle:"חוסמים",savePlans:"שמירת ההצעות",plansSaved:"נשמרו {n} הצעות פריסה",deployNow:"פריסה",confirmDeployTitle:"לפרוס ל־{n} עמדות?",confirmDeploy:"לכל עמדה תיווצר עבודת פריסה והבדיקה שלה תרוץ ברקע. ייכתב לעמדה רק מה שהמערכת מאשרת.",progressTitle:"התקדמות הפריסה",progressDone:"הפריסה הסתיימה",progressRunning:"בודק את העמדות…",jobLine:"{station}: {status}",writesOff:'WisKey עדיין לא מאשר כתיבה של לוחות זמנים לעמדות - כל עבודה תיעצר ב"חסום" ולא ייכתב דבר לעמדה.',deployWritesOff:'שימו לב: כרגע פריסה לא משנה דבר בעמדות. WisKey עדיין לא הפעיל כתיבה של לוחות זמנים לעמדות, ולכן פריסה רק יוצרת עבודה ומריצה בדיקה מקדימה. העבודה תיעצר במצב "חסום" ושום דבר לא ייכתב לעמדה. ההודעה תיעלם כש־WisKey יפעיל את הכתיבה.',confirmDeployWritesOff:'כרגע WisKey לא כותב לוחות זמנים לעמדות: העבודות ייווצרו וייבדקו, ייעצרו במצב "חסום", ושום דבר לא ייכתב לעמדות.',jobsTitle:"עבודות פריסה",jobsEmpty:"אין עבודות פריסה",jobRecheck:"בדיקה שוב",jobCancel:"ביטול",jobArchive:"לארכיון",plansTitle:"הצעות פריסה",planRecheck:"בדיקה חוזרת",planDelete:"מחיקת ההצעה",planClaim:"לקיחת אחריות",planRelease:"שחרור אחריות",claimed:"באחריות Arx",confirmPlanDelete:"למחוק את הצעת הפריסה ל־{station}?",confirmClaimTitle:"לקחת אחריות על המשבצות?",confirmClaim:"המשבצות {keys} בעמדה {station} יסומנו כמנוהלות מכאן. זו הצהרה בלבד: היא לא כותבת לעמדה.",confirmRelease:"לשחרר את האחריות על המשבצות?",confirmRecheck:"לקרוא שוב את העמדה ולעדכן את ההצעה?",confirmJob:'לבצע "{action}" לעבודה של {station}?',done:"בוצע",st_queued:"בתור",st_refused:"נדחה",st_unknown:"לא ידוע אם בוצע",st_not_sent:"לא נשלח",refusedBy:"WisKey סירב: {reason}",notSent:"לא נשלח: {reason}",unknownOutcome:"נשלח ולא התקבלה תשובה ברורה - ייתכן שבוצע. רעננו ובדקו לפני שמנסים שוב.",noStations:"אין עמדות מחוברות",offline:"לא מחוברת",stationsPicked:"עמדות שנבחרו: {n}",stale:"הנתונים אינם עדכניים - רעננו לפני שינוי",forbidden:"אין לך הרשאה לנהל את ספריית לוחות הזמנים"},Ie={manageTitle:"Schedule library",manageOpen:"Manage library",newSchedule:"New schedule",importFile:"Import",exportFile:"Export",edit:"Edit",remove:"Delete",deploy:"Deploy to stations",save:"Save",cancel:"Cancel",close:"Close",refusedBy:"WisKey refused: {reason}",deployWritesOff:'Note: deploying does not change the stations yet. WisKey has not enabled schedule writing to stations, so a deploy only creates the job and runs its preflight check. The job stops as "blocked" and nothing is written to a station. This note goes away once WisKey enables writing.',confirmDeployWritesOff:'WisKey does not write schedules to stations yet: the jobs are created and checked, stop as "blocked", and nothing is written to the stations.',assess:"Check the station fit",editorNew:"New schedule",editorEdit:"Edit {name}",name:"Name",namePlaceholder:"For example: office hours",weekTitle:"Week",gridHint:"Dragging on the grid marks whole hours; for exact minutes, edit the times of each day",addWindow:"Add a window",removeWindow:"Remove the window",from:"From",to:"To",closedDay:"Closed",copyTo:"Copy to weekdays",copyAll:"Copy to the whole week",holidaysTitle:"Holidays and special dates",holidaysHint:"On these dates the holiday windows apply instead of the week",addHoliday:"Add a special date",holidayName:"Name",holidayFrom:"From date",holidayTo:"To date",holidayClosed:"Closed all day",removeHoliday:"Remove the date",summaryHours:"{h} hours a week",checkTitle:"Preflight check",checkAt:"Check a date and time",checkRun:"Check",checkOpen:"On {date} at {time} the doors open according to the schedule ({source})",checkClosed:"On {date} at {time} the schedule is closed ({source})",sourceWeekly:"by the week",sourceHoliday:"by {name}",checkNeeded:"Run a preflight check before saving",checkStale:"The draft has changed since the check - check again",checkOk:"The check passed",saving:"Saving…",confirmSaveTitle:"Save the schedule?",confirmSaveNew:'The schedule "{name}" will be added to the library. It is not sent to any station until you deploy it.',confirmSaveEdit:'The schedule "{name}" will be updated in the library (version {rev}).',affectsPlans:'It has deployment plans for {stations}. After saving they will be marked "library changed" and will need to be prepared again.',confirmDeleteTitle:"Delete the schedule?",confirmDelete:'The schedule "{name}" will be deleted from the library.',confirmSend:"Confirm",saved:"Saved to the library",deleted:"Deleted from the library",importTitle:"Import schedules",importPick:"Choose a file",importPreview:"{n} schedules in the file · {c} with a name that already exists",importAppend:"Importing adds to the library and does not replace existing schedules",importApply:"Import",importDone:"{n} schedules imported",importTooLarge:"The file is too large to import from here",importRow:"{name} · {p} windows · {h} holidays",assessTitle:"Station fit",pickStation:"Station",assessRun:"Check",assessFits:"The schedule fits the station's capabilities",assessExceeds:"The schedule exceeds the station's capabilities",assessUnknown:"The station did not report all its capabilities - it is not known whether the schedule fits",limitRow:"{key}: {needed} needed · {available} available",baselineTitle:"Baseline",baselineState:"State: {state}",baselineSave:"Save as the baseline",baselineClear:"Clear the baseline",baselineSaved:"Baseline saved",baselineCleared:"Baseline cleared",deployTitle:'Deploy "{name}" to stations',deployStations:"Stations",deployStep1:"Choose stations and slots",deployStep2:"Preflight check",deployStep3:"Confirm and deploy",slotsTitle:"Station slots",slotsHint:"The slot numbers for the schedule on the station. The range follows what the station reported",slotTemplate:"Template",slotWeekly:"Week",slotGroup:"Holiday group",slotHoliday:"Holiday {n}",range:"Range {a}-{b}",readStation:"Read the station",reading:"Reading the station… (up to two minutes)",previewRun:"Preflight check",previewAll:"Preflight check for all stations",impactTitle:"What will be affected",impactStation:"Station: {name}",impactDoors:"Doors: {doors}",impactNoDoors:"The station has no managed doors",impactPeople:"{explicit} people with their own schedule · {implicit} on the station default · {read} read",impactPeopleUnknown:"Unknown how many people are on the station (the read failed)",conflictsTitle:"Conflicts",resourceRow:"{kind} {id}: {state}",externalRef:"Used outside the plan",activeRes:"Active on the station",blockersTitle:"Blockers",savePlans:"Save the plans",plansSaved:"{n} deployment plans saved",deployNow:"Deploy",confirmDeployTitle:"Deploy to {n} stations?",confirmDeploy:"A deployment job is created for each station and its check runs in the background. Only what the system approves is written to the station.",progressTitle:"Deployment progress",progressDone:"The deployment has finished",progressRunning:"Checking the stations…",jobLine:"{station}: {status}",writesOff:'WisKey does not allow writing schedules to stations yet - every job stops at "blocked" and nothing is written to the station.',jobsTitle:"Deployment jobs",jobsEmpty:"No deployment jobs",jobRecheck:"Check again",jobCancel:"Cancel",jobArchive:"Archive",plansTitle:"Deployment plans",planRecheck:"Check again",planDelete:"Delete the plan",planClaim:"Take ownership",planRelease:"Release ownership",claimed:"Owned by Arx",confirmPlanDelete:"Delete the deployment plan for {station}?",confirmClaimTitle:"Take ownership of the slots?",confirmClaim:"Slots {keys} on station {station} will be marked as managed from here. This is a declaration only: it does not write to the station.",confirmRelease:"Release ownership of the slots?",confirmRecheck:"Read the station again and update the plan?",confirmJob:'Run "{action}" on the job for {station}?',done:"Done",st_queued:"Queued",st_refused:"Refused",st_unknown:"Unknown whether it ran",st_not_sent:"Not sent",notSent:"Not sent: {reason}",unknownOutcome:"Sent, but no clear answer came back - it may have run. Refresh and check before trying again.",noStations:"No connected stations",offline:"Not connected",stationsPicked:"Stations selected: {n}",stale:"The data is out of date - refresh before making a change",forbidden:"You do not have permission to manage the schedule library"};function At(){return Pe(["en"])}function n(e,t){const s=(At()==="en"?Ie[e]:void 0)??Re[e];return Ee(s,t)}const L={Sunday:"ראשון",Monday:"שני",Tuesday:"שלישי",Wednesday:"רביעי",Thursday:"חמישי",Friday:"שישי",Saturday:"שבת"},Dt={Sunday:"א׳",Monday:"ב׳",Tuesday:"ג׳",Wednesday:"ד׳",Thursday:"ה׳",Friday:"ו׳",Saturday:"ש׳"},zt={template:"תבנית",weekly:"שבוע",holiday_group:"קבוצת חגים",holiday:"חג"},jt={matches:"תואם",different:"שונה בעמדה",not_observed:"לא קיים בעמדה",unreadable:"לא נקרא",unsupported:"לא נתמך"},Ot={missing:"אין",unchanged:"ללא שינוי",changed:"השתנה בעמדה",incomplete:"חלקי",identity_changed:"העמדה הוחלפה",unavailable:"לא זמין"},Se={pending:"ממתין",queued:"בתור",checking:"בבדיקה",blocked:"חסום",ready:"מוכן",interrupted:"נקטע",failed:"נכשל",cancelled:"בוטל",verified:"אומת"},Rt={template_resources:"תבניות",weekly_resources:"שבועות",holiday_group_resources:"קבוצות חגים",holiday_resources:"חגים",weekly_per_day:"חלונות ביום",weekly_periods:"חלונות בשבוע",weekly_precision:"דיוק השעות",holiday_per_day:"חלונות בחג",holiday_periods:"חלונות בחג",holiday_precision:"דיוק שעות החג",weekdays:"ימים",holiday_membership:"חגים בקבוצה"},It={unauthorized:"לחשבון השירות של Arx אין הרשאת ניהול לוחות זמנים ב־WisKey",revision_conflict:"מישהו אחר שינה את הרשומה בינתיים",schedule_not_found:"לוח הזמנים לא נמצא",schedule_limit:"הספרייה מלאה (עד 100)",schedule_invalid_time:"שעה לא תקינה או סיום לפני התחלה",schedule_overlap:"חלונות חופפים באותו יום",schedule_period_limit:"יותר מ־8 חלונות ביום",schedule_invalid_week:"השבוע חייב לכלול את שבעת הימים",schedule_invalid_date:"תאריך לא תקין (2000-2037, התחלה לפני סוף)",schedule_holiday_limit:"יותר מ־64 תאריכים מיוחדים",schedule_holiday_overlap:"תאריכים מיוחדים חופפים",invalid_text:"שם ריק או ארוך מ־32 תווים",schedule_transfer_invalid:"הקובץ אינו קובץ ייצוא תקין",schedule_import_expired:"הבדיקה פגה או הוחלפה",schedule_plan_expired:"הבדיקה פגה או הוחלפה",schedule_claim_expired:"הבדיקה פגה או הוחלפה",schedule_baseline_expired:"הבדיקה פגה או הוחלפה",schedule_preview_required:"הבדיקה המקדימה חסרה או פגה",schedule_plan_resource_reserved:"המשבצות שמורות להצעה אחרת",schedule_binding_invalid:"מספרי משבצות לא תקינים",schedule_binding_out_of_range:"משבצת מחוץ לטווח של העמדה",schedule_compilation_limit:"חורג מיכולות העמדה",schedule_compilation_unknown:"העמדה לא דיווחה על יכולותיה",schedule_claim_conflict:"המשבצות כבר באחריות הצעה אחרת",schedule_claim_in_use:"עבודת פריסה פעילה משתמשת באחריות",schedule_operation_exists:"כבר קיימת עבודת פריסה להצעה",schedule_operation_retained:"העבודה עדיין רצה או אינה במצב סופי",schedule_source_changed:"לוח הזמנים השתנה מאז ההצעה",schedule_plan_device_changed:"העמדה הוחלפה מאז ההצעה",schedule_read_busy:"העמדה כבר נקראת",schedule_writes_unverified:"כתיבה לעמדה עדיין לא אומתה ב־WisKey",schedule_ownership_unknown:"לא הוצהרה אחריות על המשבצות",schedule_ownership_changed:"המשבצות השתנו מאז ההצהרה",schedule_inventory_incomplete:"קריאת העמדה לא הושלמה",schedule_plan_users_unreadable:"לא ניתן היה לקרוא את המשתמשים בעמדה",schedule_plan_user_defaults:"יש בעמדה משתמשים לפי ברירת מחדל",schedule_plan_external_references:"המשבצות בשימוש מחוץ להצעה",schedule_plan_capabilities_changed:"יכולות העמדה השתנו",schedule_plan_active_resources:"המשבצות פעילות בעמדה",schedule_plan_observation_incomplete:"חלק מהמשבצות לא נקראו",schedule_plan_holiday_membership_unknown:"לא ידוע כמה חגים קבוצה מקבלת",station_offline:"העמדה אינה מחוברת",connection_failed:"העמדה לא ענתה בזמן",authentication_failed:"העמדה דחתה את פרטי ההתחברות",schedule_operation_failed:"הבדיקה המוקדמת נכשלה",schedule_operation_interrupted:"הבדיקה נקטעה"},y=e=>e&&It[e]||e||"";Le("i18n/schedule-editor",{he:Re,en:Ie});var Ct=Object.defineProperty,Nt=Object.getOwnPropertyDescriptor,C=(e,t,s,a)=>{for(var i=a>1?void 0:a?Nt(t,s):t,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&Ct(t,s,i),i};let A=class extends ee{constructor(){super(...arguments),this.faults=[],this.narrow=!1,this.today="2026-01-01",this.disabled=!1}emit(e){this.dispatchEvent(new CustomEvent("draft-change",{detail:e,bubbles:!0,composed:!0}))}fault(e){const t=v(this.faults,e);return t?r`<span class="err" role="alert" data-se-fault=${e}>${y(t.code)}</span>`:l}render(){const e=this.draft;if(!e)return l;const t=!!v(this.faults,"name");return r`
      <div class="sec">
        <label class="field name">${n("name")}
          <input data-se-name maxlength="32" .value=${e.name} placeholder=${n("namePlaceholder")} aria-invalid=${String(t)} ?disabled=${this.disabled}
            @input=${s=>this.emit({...e,name:s.target.value})} />
        </label>
        ${this.fault("name")}
      </div>
      <div class="sec" data-se-week>
        <h4><sw-icon name="calendar" size=${14}></sw-icon>${n("weekTitle")}<span class="sum" data-se-hours>${n("summaryHours",{h:Math.round(Oe(e.weekly)/60*10)/10})}</span></h4>
        ${this.narrow?l:r`<sw-week-grid data-se-grid ?editable=${!this.disabled} .days=${je(e.weekly)} .modes=${[{id:"on",label:n("weekTitle"),color:"var(--sw-accent)"}]}
                @change=${s=>this.emit({...e,weekly:St(s.detail.days,e.weekly)})}></sw-week-grid>
              <p class="hint">${n("gridHint")}</p>`}
        <div class="days">${pt.map(s=>this.renderDay(s))}</div>
      </div>
      <div class="sec" data-se-holidays>
        <h4><sw-icon name="star" size=${14}></sw-icon>${n("holidaysTitle")}<span class="sum">${e.holidays.length||""}</span></h4>
        <p class="hint">${n("holidaysHint")}</p>
        ${this.fault("holidays")}
        ${e.holidays.map((s,a)=>this.renderHoliday(a))}
        <div><wk-action-button tone="dashed" icon="plus" data-se-add-holiday ?disabled=${this.disabled||e.holidays.length>=64}
          @click=${()=>this.emit(_t(e,this.today))}>${n("addHoliday")}</wk-action-button></div>
      </div>
    `}renderDay(e){const t=this.draft,s=t.weekly[e]??[],a=this.narrow?Dt[e]:L[e];return r`<div class="day" data-se-day=${e}>
      <span class="dn" title=${L[e]}>${a}</span>
      <div class="wins">
        ${s.length?l:r`<span class="closed">${n("closedDay")}</span>`}
        ${s.map((i,o)=>{const d=!!v(this.faults,`weekly.${e}.${o}`);return r`<span class="win" data-se-win=${`${e}.${o}`} ?data-bad=${d}>
            <input type="time" lang=${T()} step="60" aria-label=${`${L[e]} ${n("from")}`} .value=${i.start} ?disabled=${this.disabled} data-se-start
              @change=${h=>this.emit(ve(t,e,o,"start",h.target.value))} />
            <span aria-hidden="true">–</span>
            <input type="time" lang=${T()} step="60" aria-label=${`${L[e]} ${n("to")}`} .value=${i.end==="24:00"?"23:59":i.end} ?disabled=${this.disabled} data-se-end
              @change=${h=>{const f=h.target.value;this.emit(ve(t,e,o,"end",f==="23:59"&&i.end==="24:00"?"24:00":f))}} />
            <button class="x" type="button" aria-label=${n("removeWindow")} data-se-remove-win ?disabled=${this.disabled} @click=${()=>this.emit($t(t,e,o))}><sw-icon name="close" size=${14}></sw-icon></button>
          </span>`})}
        <button class="x" type="button" aria-label=${`${n("addWindow")} · ${L[e]}`} title=${n("addWindow")} data-se-add-win=${e}
          ?disabled=${this.disabled||s.length>=K} @click=${()=>this.emit(yt(t,e))}><sw-icon name="plus" size=${16}></sw-icon></button>
        ${e==="Sunday"&&s.length?r`<wk-action-button tone="quiet" icon="copy" data-se-copy ?disabled=${this.disabled} @click=${()=>this.emit(kt(t,"Sunday",ut))}>${n("copyTo")}</wk-action-button>`:l}
        ${this.fault(`weekly.${e}`)}
      </div>
    </div>`}renderHoliday(e){const t=this.draft,s=t.holidays[e],a=`holidays.${e}`;return r`<div class="hol" data-se-holiday=${e}>
      <label class="field hn">${n("holidayName")}
        <input maxlength="32" .value=${s.name} aria-invalid=${String(!!v(this.faults,`${a}.name`))} ?disabled=${this.disabled} data-se-hname
          @input=${i=>this.emit(D(t,e,{name:i.target.value}))} />
      </label>
      <label class="field">${n("holidayFrom")}
        <input type="date" lang=${T()} .value=${s.start} aria-invalid=${String(!!v(this.faults,`${a}.start`))} ?disabled=${this.disabled} data-se-hstart
          @change=${i=>this.emit(D(t,e,{start:i.target.value}))} />
      </label>
      <label class="field">${n("holidayTo")}
        <input type="date" lang=${T()} .value=${s.end} aria-invalid=${String(!!v(this.faults,`${a}.end`))} ?disabled=${this.disabled} data-se-hend
          @change=${i=>this.emit(D(t,e,{end:i.target.value}))} />
      </label>
      <button class="x" type="button" aria-label=${n("removeHoliday")} data-se-remove-holiday ?disabled=${this.disabled} @click=${()=>this.emit(xt(t,e))}><sw-icon name="trash" size=${16}></sw-icon></button>
      <div class="wins">
        ${s.periods.length?l:r`<span class="closed">${n("holidayClosed")}</span>`}
        ${s.periods.map((i,o)=>r`<span class="win" ?data-bad=${!!v(this.faults,`${a}.periods.${o}`)}>
          <input type="time" lang=${T()} step="60" aria-label=${`${s.name} ${n("from")}`} .value=${i.start} ?disabled=${this.disabled}
            @change=${d=>this.emit(D(t,e,{periods:s.periods.map((h,f)=>f===o?{...h,start:d.target.value}:h)}))} />
          <span aria-hidden="true">–</span>
          <input type="time" lang=${T()} step="60" aria-label=${`${s.name} ${n("to")}`} .value=${i.end==="24:00"?"23:59":i.end} ?disabled=${this.disabled}
            @change=${d=>this.emit(D(t,e,{periods:s.periods.map((h,f)=>f===o?{...h,end:d.target.value}:h)}))} />
          <button class="x" type="button" aria-label=${n("removeWindow")} ?disabled=${this.disabled}
            @click=${()=>this.emit(D(t,e,{periods:s.periods.filter((d,h)=>h!==o)}))}><sw-icon name="close" size=${14}></sw-icon></button>
        </span>`)}
        <button class="x" type="button" aria-label=${n("addWindow")} data-se-add-hwin ?disabled=${this.disabled||s.periods.length>=K}
          @click=${()=>this.emit(D(t,e,{periods:[...s.periods,s.periods.length?{start:s.periods[s.periods.length-1].end==="24:00"?"23:00":s.periods[s.periods.length-1].end,end:"24:00"}:{start:"08:00",end:"13:00"}]}))}>
          <sw-icon name="plus" size=${16}></sw-icon></button>
        ${this.fault(`${a}.periods`)} ${this.fault(`${a}.start`)} ${this.fault(`${a}.end`)} ${v(this.faults,a)&&!v(this.faults,`${a}.start`)&&!v(this.faults,`${a}.end`)&&!v(this.faults,`${a}.periods`)&&!v(this.faults,`${a}.name`)?this.fault(a):l}
      </div>
    </div>`}};A.styles=Q`
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
  `;C([_({attribute:!1})],A.prototype,"draft",2);C([_({attribute:!1})],A.prototype,"faults",2);C([_({type:Boolean})],A.prototype,"narrow",2);C([_()],A.prototype,"today",2);C([_({type:Boolean,reflect:!0})],A.prototype,"disabled",2);A=C([te("wk-schedule-draft-form")],A);const N="access-control/schedules",Et=15e3;function Ce(){return{confirmed:!0,client_request_id:We(),expires_at:new Date(Me()+Et).toISOString().replace(/\.\d{3}Z$/,"Z")}}const E=(e,t)=>se(`${N}/actions/${e}`,t),$=(e,t)=>se(`${N}/actions/${e}`,{...t,...Ce()}),Pt=(e,t,s)=>E("check",{data:e,date:t,time:s}),Lt=(e,t)=>$("create",{data:e,check_id:t}),Mt=(e,t,s,a)=>$("update",{schedule_id:e,revision:t,data:s,check_id:a}),Wt=(e,t)=>$("delete",{schedule_id:e,revision:t}),qt=e=>E("import_preview",{document:e}),Ft=e=>$("import_apply",{preview_id:e}),Ht=()=>I(`${N}/export`),Bt=e=>E("readiness",{station_id:e}),Ut=(e,t)=>E("assess",{station_id:e,data:t}),Kt=(e,t)=>$("baseline_save",{station_id:e,preview_id:t}),Jt=(e,t)=>$("baseline_clear",{station_id:e,revision:t}),Vt=(e,t,s,a)=>E("plan_preview",{station_id:e,schedule_id:t,revision:s,bindings:a}),Yt=e=>$("plan_save",{preview_id:e}),Gt=(e,t)=>$("plan_recheck",{plan_id:e,revision:t}),Xt=(e,t)=>$("plan_delete",{plan_id:e,revision:t}),Zt=(e,t)=>E("claim_preview",{plan_id:e,revision:t}),Qt=e=>$("claim_confirm",{preview_id:e}),es=(e,t)=>$("claim_release",{claim_id:e,revision:t}),ts=e=>se(`${N}/actions/deploy`,{plans:e,...Ce()}),ss=(e,t,s)=>$(e,{job_id:t,revision:s}),as=e=>I(`${N}/jobs${e.length?"?"+e.map(t=>`ids=${encodeURIComponent(t)}`).join("&"):""}`),is=()=>I(`${N}/claims`);function M(e){if(e instanceof Z){const t=e.body?.details??{},s=String(t.outcome??""),a=s==="refused"?"refused":s==="not_sent"?"not_sent":s==="unknown"?"unknown":[400,403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",i=Number(t.retry_after_s);return{status:a,code:String(t.wiskey_code??e.body?.code??"")||null,message:e.body?.user_message||e.message,field:typeof t.field=="string"?t.field:null,retryAfter:Number.isFinite(i)&&i>=0?i:null}}return{status:"unknown",code:"network",message:"",field:null,retryAfter:null}}var ns=Object.defineProperty,os=Object.getOwnPropertyDescriptor,m=(e,t,s,a)=>{for(var i=a>1?void 0:a?os(t,s):t,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&ns(t,s,i),i};const Te={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"},rs=2e3,ls=18e4,ds=6e4;let w=class extends ee{constructor(){super(...arguments),this.stations=[],this.library=null,this.plans=null,this.ops=null,this.live=!0,this.narrow=!1,this.editing=null,this.draft=me(),this.checkAt=B(Date.now()),this.checked=null,this.busy=null,this.assessStation="",this.assessment=null,this.importing=null,this.deploying=null,this.targets=[],this.progress=null,this.ask=null,this.note=null,this.claims=null,this.pollTimer=0,this.pollStarted=0}get writesOff(){return this.ops?.writes_enabled===!1}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.pollTimer)}willUpdate(e){e.has("stations")&&!this.assessStation&&(this.assessStation=this.stations.find(t=>t.online)?.id??"")}changed(){this.dispatchEvent(new CustomEvent("sched-changed",{bubbles:!0,composed:!0}))}stationName(e){return this.stations.find(t=>t.id===e)?.name??e??""}say(e,t){if(!e){this.note={tone:"ok",text:t??n("done"),code:null};return}const s=e.status==="refused"?n("refusedBy",{reason:y(e.code)||e.message}):e.status==="not_sent"?n("notSent",{reason:e.message||y(e.code)}):n("unknownOutcome");this.note={tone:e.status,text:s,code:e.code}}async run(e,t,s,a=!0){this.busy=e;try{const i=await t();return a&&(this.say(null,s),this.changed()),i}catch(i){const o=M(i);return this.say(o),a&&o.status!=="not_sent"&&this.changed(),null}finally{this.busy=null}}openEditor(e){this.editing=e,this.draft=e==="new"?me():fe(e),this.checked=null,this.assessment=null,this.checkAt=B(Date.now()),this.note=null}closeEditor(){this.editing=null,this.ask=null}async runCheck(){const e=J(this.draft),t=await this.run("check",()=>Pt(e,this.checkAt.date,this.checkAt.time),void 0,!1);t?.check_id&&(this.checked={draft:e,id:t.check_id,result:t.data})}checkValid(){return!!this.checked&&bt(this.checked.draft,this.draft)}async save(){const e=this.checked,t=this.editing;if(this.ask=null,!e||!t)return;await this.run("save",()=>t==="new"?Lt(e.draft,e.id):Mt(t.id,t.revision??0,e.draft,e.id),n("saved"))?this.closeEditor():this.checked=null}async runAssess(){if(!this.assessStation)return;const e=this.assessStation,t=await this.run("assess",()=>Ut(e,J(this.draft)),void 0,!1);t&&(this.assessment={station:e,data:t.data,previewId:t.baseline_preview_id??null})}async baseline(e){const t=this.assessment;if(this.ask=null,!!t)if(e==="baseline_save"&&t.previewId){const s=await this.run("baseline",()=>Kt(t.station,t.previewId),n("baselineSaved"));s&&(this.assessment={...t,previewId:null,data:{...t.data,baseline:{...t.data.baseline,state:"unchanged",revision:s.data.revision}}})}else e==="baseline_clear"&&t.data.baseline.revision&&await this.run("baseline",()=>Jt(t.station,t.data.baseline.revision),n("baselineCleared"))&&(this.assessment={...t,data:{...t.data,baseline:{...t.data.baseline,state:"missing",revision:0}}})}async pickFile(e){const t=e.target,s=t.files?.[0];if(t.value="",!s)return;if(s.size>ds){this.note={tone:"not_sent",text:n("importTooLarge"),code:null};return}const a=await s.text(),i=await this.run("import",()=>qt(a),void 0,!1);i?.preview_id&&(this.importing={preview:i.data,previewId:i.preview_id,file:s.name},this.ask={kind:"import"})}async applyImport(){const e=this.importing;if(this.ask=null,!e)return;const t=await this.run("import",()=>Ft(e.previewId));t&&(this.note={tone:"ok",text:n("importDone",{n:t.data.length}),code:null}),this.importing=null}async exportFile(){const e=await this.run("export",()=>Ht(),void 0,!1);if(!e)return;const t=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),s=document.createElement("a");s.href=URL.createObjectURL(t),s.download=`schedules-${B(Date.now()).date}.json`,s.click(),window.setTimeout(()=>URL.revokeObjectURL(s.href),1e3)}openDeploy(e){this.deploying=e,this.targets=[],this.progress=null,this.note=null}closeDeploy(){window.clearTimeout(this.pollTimer),this.deploying=null,this.targets=[],this.progress=null,this.ask=null}previousBindings(e){return(this.plans??[]).find(s=>s.station_id===e&&s.draft_id===this.deploying?.id)?.bindings??null}toggleTarget(e){const t=this.deploying;this.targets.some(s=>s.stationId===e)?this.targets=this.targets.filter(s=>s.stationId!==e):this.targets=[...this.targets,{stationId:e,readiness:null,bindings:$e(t.holidays?.length??0,null,this.previousBindings(e)),phase:"idle",previewId:null,impact:null,plan:null,error:null}]}patchTarget(e,t){this.targets=this.targets.map(s=>s.stationId===e?{...s,...t}:s)}async readTarget(e){this.patchTarget(e.stationId,{phase:"reading",error:null});try{const t=await Bt(e.stationId),s=this.previousBindings(e.stationId)?e.bindings:$e(this.deploying?.holidays?.length??0,t.data);this.patchTarget(e.stationId,{phase:"idle",readiness:t.data,bindings:s})}catch(t){this.patchTarget(e.stationId,{phase:"error",error:M(t)})}}async previewTarget(e){const t=this.deploying;this.patchTarget(e.stationId,{phase:"previewing",error:null,previewId:null,impact:null});try{const s=await Vt(e.stationId,t.id,t.revision??0,e.bindings);this.patchTarget(e.stationId,{phase:"previewed",previewId:s.preview_id??null,impact:s.impact??null,plan:s.data})}catch(s){this.patchTarget(e.stationId,{phase:"error",error:M(s)})}}async previewAll(){for(const e of this.targets)e.phase==="previewed"||e.phase==="saved"||Object.keys(ke(e.bindings,e.readiness)).length||await this.previewTarget(this.targets.find(t=>t.stationId===e.stationId))}async deploy(){this.ask=null,this.busy="deploy";try{for(const t of this.targets.filter(s=>s.phase==="previewed"&&s.previewId)){this.patchTarget(t.stationId,{phase:"saving"});try{const s=await Yt(t.previewId);this.patchTarget(t.stationId,{phase:"saved",plan:s.data,previewId:null})}catch(s){this.patchTarget(t.stationId,{phase:"error",error:M(s),previewId:null})}}const e=this.targets.filter(t=>t.phase==="saved"&&t.plan);if(this.changed(),!e.length)return;try{const t=await ts(e.map(s=>({plan_id:s.plan.id,revision:s.plan.revision??1})));this.progress={results:t.results,jobs:Object.fromEntries(t.results.filter(s=>s.job).map(s=>[s.job.id,s.job])),done:!1,writesEnabled:null},this.pollStarted=Date.now(),this.poll()}catch(t){this.say(M(t))}}finally{this.busy=null}}async poll(){const e=this.progress;if(!e)return;const t=Object.keys(e.jobs);if(!t.length){this.progress={...e,done:!0};return}try{const s=await as(t);if(s.jobs){const a={...e.jobs};for(const i of s.jobs)a[i.id]=i;this.progress={...e,jobs:a,done:s.done,writesEnabled:s.writes_enabled}}}catch{}!this.progress?.done&&Date.now()-this.pollStarted<ls&&this.deploying?this.pollTimer=window.setTimeout(()=>void this.poll(),rs):this.changed()}async loadClaims(){try{const e=await is();this.claims=e.claims}catch{this.claims=null}}async claimPreview(e){const t=await this.run(`claim:${e.id}`,()=>Zt(e.id,e.revision??0),void 0,!1);t?.preview_id&&(this.ask={kind:"claim",plan:e,previewId:t.preview_id,keys:(t.data.resource_keys??[]).filter(Boolean)})}async confirmAsk(){const e=this.ask;if(e){if(this.ask=null,e.kind==="save")return this.save();if(e.kind==="import")return this.applyImport();if(e.kind==="deploy")return this.deploy();if(e.kind==="baseline_save"||e.kind==="baseline_clear")return this.baseline(e.kind);if(e.kind==="delete"){await this.run(`delete:${e.schedule.id}`,()=>Wt(e.schedule.id,e.schedule.revision??0),n("deleted"));return}if(e.kind==="plan_recheck"){await this.run(`plan:${e.plan.id}`,()=>Gt(e.plan.id,e.plan.revision??0));return}if(e.kind==="plan_delete"){await this.run(`plan:${e.plan.id}`,()=>Xt(e.plan.id,e.plan.revision??0));return}if(e.kind==="claim"){await this.run(`claim:${e.plan.id}`,()=>Qt(e.previewId)),await this.loadClaims();return}if(e.kind==="release"){await this.run(`claim:${e.claim.plan_id}`,()=>es(e.claim.id,e.claim.revision??0)),await this.loadClaims();return}e.kind==="job"&&await this.run(`job:${e.job.id}`,()=>ss(e.action,e.job.id,e.job.revision??0))}}firstUpdated(){this.loadClaims()}render(){const e=this.library??[],t=!this.live||!!this.busy;return r`<sw-card>
        <div class="block" data-se-library>
          <div class="bh">
            <h3>${n("manageTitle")}</h3>
            <span class="n">${e.length}</span>
            <span class="sp"></span>
            <wk-action-button tone="primary" icon="plus" data-se-new ?disabled=${t} @click=${()=>this.openEditor("new")}>${n("newSchedule")}</wk-action-button>
            <span>
              <input type="file" accept="application/json,.json" data-se-file @change=${s=>void this.pickFile(s)} ?disabled=${t} />
              <wk-action-button tone="quiet" icon="upload" data-se-import ?busy=${this.busy==="import"} ?disabled=${t}
                @click=${s=>s.currentTarget.previousElementSibling.click()}>${n("importFile")}</wk-action-button>
            </span>
            <wk-action-button tone="quiet" icon="download" data-se-export ?busy=${this.busy==="export"} ?disabled=${!!this.busy||!e.length} @click=${()=>void this.exportFile()}>${n("exportFile")}</wk-action-button>
          </div>
          ${this.live?l:r`<p class="warn" role="status" data-se-stale>${n("stale")}</p>`}
          ${this.writesOff?r`<p class="warn" role="note" data-se-writes-off>${n("deployWritesOff")}</p>`:l}
          ${this.note&&!this.editing&&!this.deploying?this.renderNote():l}
          <div class="rows">${e.map(s=>this.renderScheduleRow(s))}</div>
        </div>
      </sw-card>
      ${this.renderPlans()} ${this.renderJobs()} ${this.renderEditor()} ${this.renderDeploy()} ${this.editing||this.deploying?l:this.renderAsk()}`}renderNote(){const e=this.note;return r`<p class="note" role="status" data-se-note=${e.tone} data-se-code=${e.code??""} data-tone=${e.tone}>${e.text}</p>`}plansFor(e){return(this.plans??[]).filter(t=>t.draft_id===e)}renderScheduleRow(e){const t=this.plansFor(e.id),s=Math.round(Oe(fe(e).weekly)/60*10)/10,a=!this.live||!!this.busy;return r`<div class="row" data-se-row=${e.id}>
      <div class="main">
        <span class="t">${e.name??"—"}</span>
        <span class="s">${[n("summaryHours",{h:s}),e.holidays?.length?`${e.holidays.length} · ${n("holidaysTitle")}`:"",t.length?t.map(i=>this.stationName(i.station_id)).join(", "):""].filter(Boolean).join(" · ")}</span>
      </div>
      <div class="acts">
        <wk-action-button tone="quiet" icon="edit" data-se-edit=${e.id} ?disabled=${a} @click=${()=>this.openEditor(e)}>${n("edit")}</wk-action-button>
        <wk-action-button tone="quiet" icon="upload" data-se-deploy=${e.id} ?disabled=${a} @click=${()=>this.openDeploy(e)}>${n("deploy")}</wk-action-button>
        <wk-action-button tone="quiet" icon="trash" icon-only label=${n("remove")} data-se-delete=${e.id} ?disabled=${a} @click=${()=>this.ask={kind:"delete",schedule:e}}></wk-action-button>
      </div>
    </div>`}renderPlans(){const e=this.plans??[];if(!e.length)return l;const t=!this.live||!!this.busy;return r`<sw-card>
      <div class="block" data-se-plans>
        <div class="bh"><h3>${n("plansTitle")}</h3><span class="n">${e.length}</span></div>
        <div class="rows">
          ${e.map(s=>{const a=(this.claims??[]).find(o=>o.plan_id===s.id)??null,i=(s.report?.blockers??[]).filter(Boolean);return r`<div class="row" data-se-plan=${s.id}>
              <div class="main">
                <span class="t">${s.name??"—"} · ${this.stationName(s.station_id)}</span>
                <span class="s" data-se-plan-blockers>${i.map(o=>y(o)).join(" · ")}</span>
              </div>
              ${a?r`<sw-badge kind="live" label=${n("claimed")} data-se-claimed></sw-badge>`:l}
              <div class="acts">
                <wk-action-button tone="quiet" icon="refresh" data-se-recheck=${s.id} ?busy=${this.busy===`plan:${s.id}`} ?disabled=${t} @click=${()=>this.ask={kind:"plan_recheck",plan:s}}>${n("planRecheck")}</wk-action-button>
                ${a?r`<wk-action-button tone="quiet" icon="unlock" data-se-release=${s.id} ?disabled=${t} @click=${()=>this.ask={kind:"release",claim:a}}>${n("planRelease")}</wk-action-button>`:r`<wk-action-button tone="quiet" icon="lock" data-se-claim=${s.id} ?busy=${this.busy===`claim:${s.id}`} ?disabled=${t} @click=${()=>void this.claimPreview(s)}>${n("planClaim")}</wk-action-button>`}
                <wk-action-button tone="quiet" icon="trash" icon-only label=${n("planDelete")} data-se-plan-delete=${s.id} ?disabled=${t} @click=${()=>this.ask={kind:"plan_delete",plan:s}}></wk-action-button>
              </div>
            </div>`})}
        </div>
      </div>
    </sw-card>`}renderJobs(){const e=[...this.ops?.jobs??[]];if(!e.length)return l;const t=!this.live||!!this.busy;return r`<sw-card>
      <div class="block" data-se-jobs>
        <div class="bh"><h3>${n("jobsTitle")}</h3><span class="n">${e.length}</span></div>
        <div class="rows">
          ${e.map(s=>{const a=s.status??"unknown",i=xe(a),o=a==="cancelled"||a==="verified";return r`<div class="row" data-se-job=${s.id} data-status=${a}>
              <div class="main">
                <span class="t">${s.name??"—"} · ${this.stationName(s.station_id)}</span>
                <span class="s">${s.error?y(s.error):(s.blockers??[]).filter(Boolean).map(d=>y(d)).join(" · ")}</span>
              </div>
              <sw-badge kind=${Te[_e(a)]} label=${Se[a]??a}></sw-badge>
              <div class="acts">
                ${i||o?l:r`<wk-action-button tone="quiet" icon="refresh" data-se-job-check=${s.id} ?disabled=${t} @click=${()=>this.ask={kind:"job",action:"job_check",job:s}}>${n("jobRecheck")}</wk-action-button>`}
                ${i||o?l:r`<wk-action-button tone="quiet" icon="close" data-se-job-cancel=${s.id} ?disabled=${t} @click=${()=>this.ask={kind:"job",action:"job_cancel",job:s}}>${n("jobCancel")}</wk-action-button>`}
                ${o?r`<wk-action-button tone="quiet" icon="inbox" data-se-job-archive=${s.id} ?disabled=${t} @click=${()=>this.ask={kind:"job",action:"job_archive",job:s}}>${n("jobArchive")}</wk-action-button>`:l}
              </div>
            </div>`})}
        </div>
      </div>
    </sw-card>`}renderEditor(){const e=this.editing;if(!e)return l;const t=gt(this.draft),s=t.length===0,a=this.checkValid(),i=e==="new"?[]:this.plansFor(e.id),o=e==="new"?n("editorNew"):n("editorEdit",{name:e.name??""}),d=!!this.busy;return r`<sw-drawer modal open heading=${o} data-se-editor=${e==="new"?"new":e.id} @close=${h=>h.target===h.currentTarget&&this.closeEditor()}>
      <wk-schedule-draft-form .draft=${this.draft} .faults=${t} ?narrow=${this.narrow} today=${B(Date.now()).date} ?disabled=${d}
        @draft-change=${h=>this.draft=h.detail}></wk-schedule-draft-form>
      <div class="panel" data-se-check>
        <h4><sw-icon name="check" size=${14}></sw-icon>${n("checkTitle")}</h4>
        <div class="line">
          <label class="f">${n("checkAt")}<input type="date" lang=${T()} .value=${this.checkAt.date} @change=${h=>this.checkAt={...this.checkAt,date:h.target.value}} /></label>
          <label class="f">&nbsp;<input type="time" lang=${T()} step="60" .value=${this.checkAt.time} @change=${h=>this.checkAt={...this.checkAt,time:h.target.value}} /></label>
          <wk-action-button icon="check" data-se-check-run ?busy=${this.busy==="check"} ?disabled=${d||!s||!this.live} @click=${()=>void this.runCheck()}>${n("checkRun")}</wk-action-button>
        </div>
        ${this.checked?r`<span class="result" role="status" data-se-check-result data-ok=${String(!!this.checked.result.within_window)}>${this.checkLine(this.checked.result)}${a?"":` · ${n("checkStale")}`}</span>`:r`<span class="s">${n("checkNeeded")}</span>`}
      </div>
      ${this.renderAssess(s)}
      ${this.note?this.renderNote():l}
      ${i.length?r`<p class="warn" data-se-affects>${n("affectsPlans",{stations:i.map(h=>this.stationName(h.station_id)).join(", ")})}</p>`:l}
      <div slot="footer" class="foot">
        <wk-action-button data-se-cancel @click=${()=>this.closeEditor()}>${n("cancel")}</wk-action-button>
        <wk-action-button tone="primary" icon="check" data-se-save ?busy=${this.busy==="save"} ?disabled=${d||!s||!a||!this.live} @click=${()=>this.ask={kind:"save"}}>${n("save")}</wk-action-button>
      </div>
      ${this.renderAsk()}
    </sw-drawer>`}checkLine(e){const t=e.source==="holiday"?n("sourceHoliday",{name:e.holiday??""}):n("sourceWeekly");return n(e.within_window?"checkOpen":"checkClosed",{date:e.date??"",time:e.time??"",source:t})}renderAssess(e){const t=this.stations.filter(i=>i.online),s=this.assessment,a=!!this.busy;return r`<div class="panel" data-se-assess>
      <h4><sw-icon name="cpu" size=${14}></sw-icon>${n("assessTitle")}</h4>
      <div class="line">
        <div class="f"><span>${n("pickStation")}</span>
          <sw-dropdown data-se-assess-station label=${n("pickStation")} .value=${this.assessStation}
            .items=${t.map(i=>({id:i.id,label:i.name}))}
            @change=${i=>this.assessStation=i.detail.id}></sw-dropdown>
        </div>
        <wk-action-button icon="search" data-se-assess-run ?busy=${this.busy==="assess"} ?disabled=${a||!e||!this.assessStation||!this.live} @click=${()=>void this.runAssess()}>${n("assessRun")}</wk-action-button>
      </div>
      ${this.busy==="assess"?r`<span class="s">${n("reading")}</span>`:l}
      ${s?r`<span class="result" role="status" data-se-assess-state=${s.data.assessment.state??"unknown"}>${s.data.assessment.state==="fits"?n("assessFits"):s.data.assessment.state==="exceeds"?n("assessExceeds"):n("assessUnknown")}</span>
            <ul class="plain">${s.data.assessment.limits.map(i=>r`<li data-state=${i.state??""}>${n("limitRow",{key:Rt[i.key??""]??i.key??"",needed:i.needed??"—",available:i.available??"—"})}</li>`)}</ul>
            <span class="s" data-se-baseline=${s.data.baseline.state??""}>${n("baselineTitle")} · ${n("baselineState",{state:Ot[s.data.baseline.state??""]??s.data.baseline.state??"—"})}</span>
            <div class="line">
              ${s.previewId?r`<wk-action-button tone="quiet" icon="bookmark" data-se-baseline-save ?disabled=${a} @click=${()=>this.ask={kind:"baseline_save"}}>${n("baselineSave")}</wk-action-button>`:l}
              ${s.data.baseline.revision?r`<wk-action-button tone="quiet" icon="trash" data-se-baseline-clear ?disabled=${a} @click=${()=>this.ask={kind:"baseline_clear"}}>${n("baselineClear")}</wk-action-button>`:l}
            </div>`:l}
    </div>`}renderDeploy(){const e=this.deploying;if(!e)return l;const t=this.targets.filter(a=>a.phase==="previewed"),s=!!this.busy||this.targets.some(a=>a.phase==="reading"||a.phase==="previewing"||a.phase==="saving");return r`<sw-drawer modal open heading=${n("deployTitle",{name:e.name??""})} data-se-deploy-drawer=${e.id} @close=${a=>a.target===a.currentTarget&&this.closeDeploy()}>
      ${this.note?this.renderNote():l}
      ${this.progress?this.renderProgress():r`
        ${this.writesOff?r`<p class="warn" role="note" data-se-deploy-warning>${n("deployWritesOff")}</p>`:l}
        <div class="panel" data-se-targets>
          <h4><sw-icon name="building" size=${14}></sw-icon>${n("deployStep1")}</h4>
          ${this.stations.length?l:r`<span class="s">${n("noStations")}</span>`}
          <div class="picks">
            ${this.stations.map(a=>{const i=this.targets.some(o=>o.stationId===a.id);return r`<label class="pick" ?data-on=${i} ?data-off=${!a.online} data-se-pick=${a.id}>
                <input type="checkbox" .checked=${i} ?disabled=${!a.online||s} @change=${()=>this.toggleTarget(a.id)} />
                ${a.name}${a.online?"":` · ${n("offline")}`}
              </label>`})}
          </div>
          ${this.targets.length?r`<span class="s">${n("stationsPicked",{n:this.targets.length})}</span>`:l}
        </div>
        ${this.targets.map(a=>this.renderTarget(a,e,s))}
      `}
      <div slot="footer" class="foot">
        <wk-action-button data-se-deploy-close @click=${()=>this.closeDeploy()}>${this.progress?n("close"):n("cancel")}</wk-action-button>
        ${this.progress?l:r`<wk-action-button icon="search" data-se-preview-all ?disabled=${s||!this.targets.length||!this.live} @click=${()=>void this.previewAll()}>${n("previewAll")}</wk-action-button>
              <wk-action-button tone="primary" icon="upload" data-se-deploy-go ?busy=${this.busy==="deploy"} ?disabled=${s||!t.length||!this.live} @click=${()=>this.ask={kind:"deploy"}}>${n("deployNow")}${t.length?` (${t.length})`:""}</wk-action-button>`}
      </div>
      ${this.renderAsk()}
    </sw-drawer>`}renderTarget(e,t,s){const a=t.holidays?.length??0,i=ke(e.bindings,e.readiness),o=(d,h,f,j,P)=>{const p=re(e.readiness,f);return r`<label class="f">${h}${p?r` <span class="s">${n("range",{a:p[0],b:p[1]})}</span>`:l}
        <input type="number" inputmode="numeric" min="1" max="65535" .value=${j===null?"":String(j)} aria-invalid=${String(!!i[d])} data-se-slot=${d}
          ?disabled=${s||e.phase==="saved"} @change=${x=>this.patchTarget(e.stationId,{bindings:P(Number(x.target.value)),phase:"idle",previewId:null,impact:null})} />
      </label>`};return r`<div class="target" data-se-target=${e.stationId} data-phase=${e.phase}>
      <div class="bh"><h3>${this.stationName(e.stationId)}</h3><span class="sp"></span>
        <wk-action-button tone="quiet" icon="cpu" data-se-read=${e.stationId} ?busy=${e.phase==="reading"} ?disabled=${s||e.phase==="saved"} @click=${()=>void this.readTarget(e)}>${n("readStation")}</wk-action-button>
      </div>
      <span class="s">${n("slotsHint")}</span>
      <div class="line">
        ${o("template",n("slotTemplate"),"template",e.bindings.template,d=>({...e.bindings,template:d}))}
        ${o("weekly",n("slotWeekly"),"weekly",e.bindings.weekly,d=>({...e.bindings,weekly:d}))}
        ${a?o("holiday_group",n("slotGroup"),"holiday_group",e.bindings.holiday_group,d=>({...e.bindings,holiday_group:d})):l}
        ${e.bindings.holidays.map((d,h)=>o(`holidays.${h}`,n("slotHoliday",{n:h+1}),"holiday",d,f=>({...e.bindings,holidays:e.bindings.holidays.map((j,P)=>P===h?f:j)})))}
      </div>
      ${Object.values(i).length?r`<span class="s" role="alert" data-se-slot-fault>${y(Object.values(i)[0])}</span>`:l}
      ${e.phase==="reading"||e.phase==="previewing"?r`<span class="s line"><span class="spin" aria-hidden="true"></span>${n("reading")}</span>`:l}
      ${e.error?r`<p class="note" role="status" data-tone=${e.error.status} data-se-target-error=${e.error.code??""}>${e.error.status==="refused"?n("refusedBy",{reason:y(e.error.code)}):e.error.status==="not_sent"?n("notSent",{reason:e.error.message}):n("unknownOutcome")}</p>`:l}
      ${e.impact?this.renderImpact(e.impact):l}
      ${e.phase!=="previewed"&&e.phase!=="saved"?r`<div><wk-action-button icon="search" data-se-preview=${e.stationId} ?busy=${e.phase==="previewing"} ?disabled=${s||Object.keys(i).length>0||!this.live} @click=${()=>void this.previewTarget(e)}>${n("previewRun")}</wk-action-button></div>`:l}
    </div>`}renderImpact(e){const t=e.station?.doors??[],s=e.people,a=(e.resources??[]).filter(o=>o.state&&o.state!=="matches"||o.externally_referenced||o.active),i=(e.blockers??[]).filter(Boolean);return r`<div class="panel" data-se-impact>
      <h4><sw-icon name="target" size=${14}></sw-icon>${n("impactTitle")}</h4>
      <ul class="plain">
        <li data-se-impact-station>${n("impactStation",{name:e.station?.name??e.station?.id??""})}</li>
        <li data-se-impact-doors>${t.length?n("impactDoors",{doors:t.map(o=>o.name??`#${o.index}`).join(", ")}):n("impactNoDoors")}</li>
        <li data-se-impact-people>${s&&s.state==="complete"?n("impactPeople",{explicit:s.explicit??"—",implicit:s.implicit??"—",read:s.read??"—"}):n("impactPeopleUnknown")}</li>
      </ul>
      ${a.length?r`<h4>${n("conflictsTitle")}</h4><ul class="plain" data-se-conflicts>${a.map(o=>r`<li>${n("resourceRow",{kind:zt[o.kind??""]??o.kind??"",id:o.id??"—",state:jt[o.state??""]??o.state??""})}${o.externally_referenced?` · ${n("externalRef")}`:""}${o.active?` · ${n("activeRes")}`:""}</li>`)}</ul>`:l}
      ${i.length?r`<h4>${n("blockersTitle")}</h4><ul class="plain" data-se-blockers>${i.map(o=>r`<li data-code=${o}>${y(o)}</li>`)}</ul>`:l}
    </div>`}renderProgress(){const e=this.progress;return r`<div class="panel prog" data-se-progress data-done=${String(e.done)}>
      <h4>${e.done?r`<sw-icon name="check" size=${14}></sw-icon>${n("progressDone")}`:r`<span class="spin" aria-hidden="true"></span>${n("progressRunning")}`}</h4>
      ${e.writesEnabled===!1?r`<p class="warn" data-se-writes-off>${n("writesOff")}</p>`:l}
      ${e.results.map(t=>{const s=t.job?e.jobs[t.job.id]??t.job:null,a=s?Se[s.status??""]??s.status??"":n(`st_${t.status}`),i=s?s.error?y(s.error):(s.blockers??[]).filter(Boolean).map(d=>y(d)).join(" · "):y(t.code)||t.reason||"",o=s?_e(s.status):Tt(t);return r`<div class="row" data-se-result=${t.station?.id??t.plan_id} data-status=${s?.status??t.status}>
          <div class="main"><span class="t">${t.station?.name??this.stationName(t.station?.id)}</span><span class="s">${i}</span></div>
          ${s&&xe(s.status)?r`<span class="spin" aria-hidden="true"></span>`:l}
          <sw-badge kind=${Te[o]} label=${a}></sw-badge>
        </div>`})}
    </div>`}renderAsk(){const e=this.ask;if(!e)return l;let t="",s=l;const a=e.kind==="delete"||e.kind==="plan_delete";switch(e.kind){case"save":{const i=this.editing,o=i&&i!=="new"?this.plansFor(i.id):[];t=n("confirmSaveTitle"),s=r`<p class="sentence" data-se-sentence>${i==="new"?n("confirmSaveNew",{name:this.draft.name}):n("confirmSaveEdit",{name:this.draft.name,rev:(i?.revision??0)+1})}</p>
          ${o.length?r`<p class="sentence">${n("affectsPlans",{stations:o.map(d=>this.stationName(d.station_id)).join(", ")})}</p>`:l}`;break}case"delete":{const i=this.plansFor(e.schedule.id);t=n("confirmDeleteTitle"),s=r`<p class="sentence" data-se-sentence>${n("confirmDelete",{name:e.schedule.name??""})}</p>
          ${i.length?r`<p class="sentence">${n("affectsPlans",{stations:i.map(o=>this.stationName(o.station_id)).join(", ")})}</p>`:l}`;break}case"import":{const i=this.importing;t=n("importTitle"),s=r`<p class="sentence" data-se-sentence>${n("importPreview",{n:i.preview.count??0,c:i.preview.name_collisions??0})}</p>
          <ul class="plain">${i.preview.items.map(o=>r`<li>${n("importRow",{name:o.name??"—",p:o.weekly_periods??0,h:o.holidays??0})}</li>`)}</ul>
          <p class="sentence s">${n("importAppend")}</p>`;break}case"deploy":{const i=this.targets.filter(o=>o.phase==="previewed");t=n("confirmDeployTitle",{n:i.length}),s=r`<p class="sentence" data-se-sentence>${n("confirmDeploy")}</p>
          ${this.writesOff?r`<p class="sentence warn" data-se-confirm-writes-off>${n("confirmDeployWritesOff")}</p>`:l}
          <ul class="plain">${i.map(o=>r`<li>${this.stationName(o.stationId)} · ${(o.impact?.station?.doors??[]).map(d=>d.name).join(", ")}${o.impact?.people?.explicit!=null?` · ${n("impactPeople",{explicit:o.impact.people.explicit,implicit:o.impact.people.implicit??"—",read:o.impact.people.read??"—"})}`:""}</li>`)}</ul>`;break}case"baseline_save":case"baseline_clear":t=e.kind==="baseline_save"?n("baselineSave"):n("baselineClear"),s=r`<p class="sentence" data-se-sentence>${this.stationName(this.assessment?.station)}</p>`;break;case"plan_recheck":t=n("planRecheck"),s=r`<p class="sentence" data-se-sentence>${n("confirmRecheck")} (${this.stationName(e.plan.station_id)})</p>`;break;case"plan_delete":t=n("planDelete"),s=r`<p class="sentence" data-se-sentence>${n("confirmPlanDelete",{station:this.stationName(e.plan.station_id)})}</p>`;break;case"claim":t=n("confirmClaimTitle"),s=r`<p class="sentence" data-se-sentence>${n("confirmClaim",{keys:e.keys.join(", "),station:this.stationName(e.plan.station_id)})}</p>`;break;case"release":t=n("planRelease"),s=r`<p class="sentence" data-se-sentence>${n("confirmRelease")}</p>`;break;case"job":{const i={job_check:n("jobRecheck"),job_cancel:n("jobCancel"),job_archive:n("jobArchive")}[e.action];t=i,s=r`<p class="sentence" data-se-sentence>${n("confirmJob",{action:i,station:this.stationName(e.job.station_id)})}</p>`;break}}return r`<sw-dialog open heading=${t} data-se-confirm=${e.kind} @close=${i=>i.target===i.currentTarget&&(this.ask=null)}>
      ${s}
      <div slot="footer">
        <wk-action-button data-se-confirm-cancel @click=${()=>this.ask=null}>${n("cancel")}</wk-action-button>
        <wk-action-button tone=${a?"danger":"primary"} data-se-confirm-send ?disabled=${!this.live} @click=${()=>void this.confirmAsk()}>${n("confirmSend")}</wk-action-button>
      </div>
    </sw-dialog>`}};w.styles=Q`
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
  `;m([_({attribute:!1})],w.prototype,"stations",2);m([_({attribute:!1})],w.prototype,"library",2);m([_({attribute:!1})],w.prototype,"plans",2);m([_({attribute:!1})],w.prototype,"ops",2);m([_({type:Boolean})],w.prototype,"live",2);m([_({type:Boolean})],w.prototype,"narrow",2);m([u()],w.prototype,"editing",2);m([u()],w.prototype,"draft",2);m([u()],w.prototype,"checkAt",2);m([u()],w.prototype,"checked",2);m([u()],w.prototype,"busy",2);m([u()],w.prototype,"assessStation",2);m([u()],w.prototype,"assessment",2);m([u()],w.prototype,"importing",2);m([u()],w.prototype,"deploying",2);m([u()],w.prototype,"targets",2);m([u()],w.prototype,"progress",2);m([u()],w.prototype,"ask",2);m([u()],w.prototype,"note",2);m([u()],w.prototype,"claims",2);w=m([te("wk-schedule-library")],w);var cs=Object.defineProperty,hs=Object.getOwnPropertyDescriptor,g=(e,t,s,a)=>{for(var i=a>1?void 0:a?hs(t,s):t,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&cs(t,s,i),i};const Ae="sw.wiskey.schedules.view",ps=3e4,U={state:"loading",data:null,at:0,fresh:!0,fetchedAt:null},S=(e,t=null)=>({state:e,data:t,at:Date.now(),fresh:!0,fetchedAt:null});function us(e){try{return localStorage.getItem(e)}catch{return null}}function ws(e,t){try{localStorage.setItem(e,t)}catch{}}const X={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"},De={kind:"iana",name:"Asia/Jerusalem"},ze={loaded:!0,model:null,firmware:null,capabilities:null,clock:null,event_status:null,scanned_at:null,scanning:!1,reconciled_at:null,last_poll_ms:null},ms=[{id:"d1",name:"שער ראשי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"שער"}],has_camera:!1,camera_entity:null,last_seen:null,zone:De,technical:ze,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!1,camera_entity:null,last_seen:null,zone:De,technical:ze,errors:null}],W=[{start:"07:00",end:"09:00"}],fs={d1:{programs:[],saved:[],timezone:"Asia/Jerusalem",native_supported:!1},d2:{programs:[{door:1,revision:1,enabled:!0,removing:!1,policy:{timezone:"Asia/Jerusalem",name:"בוקר",weekly:{Sunday:W,Monday:W,Tuesday:W,Wednesday:W,Thursday:W},holidays:[]},execution:{owned:!1,attempted:null,status:"idle"},error:null,checked_at:null}],saved:[],timezone:"Asia/Jerusalem",native_supported:!1}};let b=class extends ee{constructor(){super(...arguments),this.feed=null,this.error="",this.access={screen:!0,library:!0,edit:!1},this.wanted=null,this.view=us(Ae)==="table"?"table":"door",this.narrow=typeof window<"u"&&window.innerWidth<Y,this.sheet=!1,this.programs={},this.codes={},this.library=U,this.plans=U,this.ops=U,this.features={},this.manage=!1,this.managing=q().params.get("manage")==="1",this.stopSession=null,this.stopRoute=null,this.poll=0,this.loading=!1,this.loadAgain=!1,this.inFlight=new Set,this.featuresRead=!1,this.mq=typeof matchMedia=="function"?matchMedia(`(max-width: ${Y-1}px)`):null,this.onMedia=()=>{this.narrow=window.innerWidth<Y},this.onVisible=()=>{document.hidden||this.load()}}connectedCallback(){super.connectedCallback(),this.mq?.addEventListener("change",this.onMedia),this.wanted=q().params.get("door"),this.stopRoute=qe(e=>this.onRoute(e)),V()&&(this.stopSession=Fe(()=>{this.access=he(ce,F),this.manage=we(F)}),this.access=he(ce,F),this.manage=we(F),this.access.screen&&(this.load(),this.poll=window.setInterval(()=>{document.hidden||this.load()},Ve),document.addEventListener("visibilitychange",this.onVisible)))}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMedia),this.stopRoute?.(),this.stopRoute=null,this.stopSession?.(),this.stopSession=null,window.clearInterval(this.poll),document.removeEventListener("visibilitychange",this.onVisible)}onRoute(e){if(e.mode!=="wiskey")return;this.managing=e.params.get("manage")==="1";const t=e.params.get("door");t!==this.wanted&&(this.wanted=t,this.loadNeeded())}demo(){return!V()}stations(){return this.demo()?ms:this.feed?.stations??[]}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{this.feed=await Be(),this.error=""}catch(e){e instanceof Z&&e.status===403?this.access={...this.access,screen:!1}:this.error=He(e)}await this.readFeatures(),await this.loadNeeded(),await this.loadLibrary()}while(this.loadAgain)}finally{this.loading=!1}}async readFeatures(){if(!this.featuresRead)try{const e=await Ue();this.features=Object.fromEntries(Object.entries(e.features??{}).map(([t,s])=>[t,s.available])),this.featuresRead=!0}catch{}}needed(){const e=G(this.stations());if(this.effectiveView()==="table")return[...new Set(e.map(s=>s.stationId))];const t=pe(e,this.wanted);return t?[t.stationId]:[]}async loadNeeded(){if(!this.demo())for(const e of this.needed()){const t=Math.min(this.programs[e]?.at??0,this.codes[e]?.at??0);Date.now()-t<ps||await this.loadStation(e)}}classify(e,t,s){const a=Date.now();if(e.state==="ready"&&t!==null&&t!==void 0)return{state:"ready",data:t,at:a,fresh:e.fresh!==!1,fetchedAt:e.fetched_at};const i=e.state==="unsupported"?"unsupported":Ye(e.last_error)?"busy":"error";return i==="unsupported"?S(i):{state:i,data:s?.data??null,at:a,fresh:!1,fetchedAt:s?.fetchedAt??null}}failed(e,t){return e instanceof Z&&(e.status===403||e.status===404)?S("forbidden"):{state:"error",data:t?.data??null,at:Date.now(),fresh:!1,fetchedAt:t?.fetchedAt??null}}async loadStation(e){if(!this.inFlight.has(e)){this.inFlight.add(e);try{if(this.features.door_programs===!1)this.programs={...this.programs,[e]:S("unsupported")};else{this.programs[e]||(this.programs={...this.programs,[e]:U});try{const t=await Ke(e);this.programs={...this.programs,[e]:this.classify(t,t.programs,this.programs[e])}}catch(t){this.programs={...this.programs,[e]:this.failed(t,this.programs[e])}}}if(this.features.public_codes===!1)this.codes={...this.codes,[e]:S("unsupported")};else try{const t=await Je(e);this.codes={...this.codes,[e]:this.classify(t,t.codes,this.codes[e])}}catch(t){this.codes={...this.codes,[e]:this.failed(t,this.codes[e])}}}finally{this.inFlight.delete(e)}}}async loadLibrary(){if(this.demo()||!this.access.library)return;const e=async(t,s,a)=>{if(this.features[t]===!1)return S("unsupported");try{const i=await s();return this.classify(i,i.schedules,a)}catch(i){return this.failed(i,a)}};if(this.library=await e("schedules",lt,this.library),this.library.state==="forbidden"){this.plans=S("forbidden"),this.ops=S("forbidden");return}this.plans=await e("schedule_plans",dt,this.plans),this.ops=await e("schedule_operations",ct,this.ops)}effectiveView(){return this.narrow?"door":this.view}setView(e){this.view=e,ws(Ae,e),this.loadNeeded()}pick(e){if(this.sheet=!1,this.wanted===e&&this.effectiveView()==="door")return;this.wanted=e,this.view==="table"&&this.setView("door");const t=q();if(t.mode==="wiskey"){const s=new URLSearchParams(t.params);s.set("door",e),de(t.path,s)}this.loadNeeded()}refresh(){this.programs=Object.fromEntries(Object.entries(this.programs).map(([e,t])=>[e,{...t,at:0}])),this.codes=Object.fromEntries(Object.entries(this.codes).map(([e,t])=>[e,{...t,at:0}])),this.load()}zoneOf(e){return this.stations().find(t=>t.id===e)?.zone??this.feed?.default_zone??null}programsOf(e){return this.demo()?S("ready",fs[e]??null):this.programs[e]}codesOf(e){return this.demo()?S("ready",{public_pin_state:e==="d2"?"configured":"absent",slots:[],capabilities:{advertised:null,min:null,max:null},checked_at:null}):this.codes[e]}staleLine(e,t,s){return e.fresh||!e.data?l:r`<p class="status" role="status" data-sch-stale=${s}>${c("stale",{t:H(e.fetchedAt,t)||"—"})}</p>`}render(){const e=c("title");if(V()&&!this.access.screen)return r`<sw-page heading=${e}><div data-sch data-sch-state="forbidden"><sw-state-panel quiet state="forbidden" heading=${c("noPermission")} data-sch-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return r`<sw-page heading=${e}><div data-sch data-sch-state=${this.error?"error":"loading"}>${this.error?r`<sw-state-panel quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="error" @action=${()=>this.refresh()}></sw-state-panel>`:r`<sw-state-panel quiet state="loading" heading=${c("loading")} data-sch-panel="loading"></sw-state-panel>`}</div></sw-page>`;if(!this.demo()&&this.feed.stations===null){const t=this.feed.state==="ready"?"error":this.feed.state,s=Ge(t);return r`<sw-page heading=${e}><div data-sch data-sch-state=${`feed:${this.feed.state}`}>
        <sw-state-panel icon="calendar" quiet state=${s.panel} heading=${s.heading} actionLabel=${s.panel==="error"||s.panel==="stale"?c("retry"):""} data-sch-panel=${`feed:${this.feed.state}`} @action=${()=>this.refresh()}></sw-state-panel>
      </div></sw-page>`}return this.renderReady()}setManaging(e){this.managing=e;const t=q();if(t.mode==="wiskey"){const s=new URLSearchParams(t.params);e?s.set("manage","1"):s.delete("manage"),de(t.path,s)}e&&this.loadLibrary()}renderManaging(){const e=this.stations(),t=this.library;return r`<sw-page wide heading=${c("title")} subheading=${ue(G(e).length,t.data?t.data.length:null)}>
      <sw-button slot="actions" variant="ghost" icon="chevronBack" data-sch-manage-close @click=${()=>this.setManaging(!1)}>${c("viewDoor")}</sw-button>
      <sw-button slot="actions" variant="ghost" icon="refresh" data-sch-refresh label=${c("refresh")} @click=${()=>this.refresh()}>${c("refresh")}</sw-button>
      <div data-sch data-sch-state=${t.data?"ready":t.state} data-sch-view="manage">
        ${t.data?this.renderManage(e):t.state==="loading"?r`<sw-state-panel quiet state="loading" heading=${c("loading")} data-sch-panel="manage-loading"></sw-state-panel>`:r`<sw-state-panel quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="manage-error" @action=${()=>this.refresh()}></sw-state-panel>`}
      </div>
    </sw-page>`}renderReady(){if(this.manage&&this.managing&&!this.demo()&&this.access.library)return this.renderManaging();const e=this.stations(),t=G(e),s=this.effectiveView(),a=pe(t,this.wanted),i=this.demo()?!1:this.access.library&&this.library.state!=="forbidden",o=i&&this.library.data?this.library.data.length:null,d=!this.demo()&&this.feed?.fresh===!1;return r`<sw-page wide heading=${c("title")} subheading=${ue(t.length,o)}>
      ${this.access.edit&&!this.demo()?r`<sw-button slot="actions" variant="ghost" icon="edit" data-sch-edit @click=${()=>window.location.hash=Xe}>${c("editClassic")}</sw-button>`:l}
      ${this.manage&&this.access.library&&!this.demo()?r`<sw-button slot="actions" variant="ghost" icon="calendar" data-sch-manage-open @click=${()=>this.setManaging(!0)}>${n("manageOpen")}</sw-button>`:l}
      <sw-button slot="actions" variant="ghost" icon="refresh" data-sch-refresh label=${c("refresh")} @click=${()=>this.refresh()}>${c("refresh")}</sw-button>
      ${this.demo()?l:r`<wk-deep-links slot="actions" place="schedules" mode="menu"></wk-deep-links>`}
      ${t.length&&!this.narrow?r`<sw-view-switch slot="actions" data-sch-views label=${c("viewLabel")} .value=${s} .options=${[{id:"door",label:c("viewDoor"),icon:"calendar"},{id:"table",label:c("viewTable"),icon:"table"}]} @change=${h=>this.setView(h.detail)}></sw-view-switch>`:l}
      <div data-sch data-sch-state=${t.length?"ready":"empty"} data-sch-view=${s}>
        ${d?r`<p class="status" role="status" data-sch-stale="stations">${c("stale",{t:H(this.feed?.fetched_at,this.feed?.default_zone??null)||"—"})}</p>`:l}
        ${t.length?s==="table"?this.renderTable(t):this.renderDoorView(t,a):r`<sw-state-panel icon="calendar" quiet state="empty" heading=${c("noDoors")} data-sch-panel="empty"></sw-state-panel>`}
        ${i?this.renderLibrary(e):l}
      </div>
      ${t.length?this.renderSheet(t,a):l}
    </sw-page>`}renderDoorList(e,t,s=!1){return r`<nav class="doors" aria-label=${c("doorsHeading")} data-sch-door-list=${s?"sheet":"side"}>
      ${s?l:r`<div class="ttl">${c("doorsHeading")}</div>`}
      ${Ze(e).map(a=>r`<div class="station" data-sch-station=${a.stationId}><span class="dot ${a.online?"":"off"}" aria-hidden="true"></span>${a.stationName}</div>
          ${a.doors.map(i=>r`<button type="button" aria-current=${String(i.key===t?.key)} data-sch-door=${i.key} @click=${()=>this.pick(i.key)}><span class="name">${i.doorName}</span></button>`)}`)}
    </nav>`}renderSheet(e,t){return r`<sw-drawer modal ?open=${this.sheet} heading=${c("pickDoor")} data-sch-sheet @close=${s=>s.target===s.currentTarget&&(this.sheet=!1)}>
      ${this.renderDoorList(e,t,!0)}
    </sw-drawer>`}renderDoorView(e,t){return t?r`<div class="layout">
      <aside class="doorcol"><sw-card flush>${this.renderDoorList(e,t)}</sw-card></aside>
      <section class="main" data-sch-door-view=${t.key}>
        <button type="button" class="chip" data-sch-door-chip aria-haspopup="dialog" @click=${()=>this.sheet=!0}>
          <sw-icon name="door" size=${16}></sw-icon><span class="name">${c("doorAt",{door:t.doorName,station:t.stationName})}</span><sw-icon name="chevronDown" size=${12}></sw-icon>
        </button>
        ${this.renderDoor(t)}
      </section>
    </div>`:l}renderCodePill(e){const t=this.codesOf(e);if(t?.state==="unsupported"||t?.state==="forbidden")return l;const s=t?.data?Qe(t.data):"unknown";return r`<sw-badge kind=${s==="set"?"live":s==="unset"?"neutral":"unknown"} label=${c("codePill",{state:et(s)})} data-sch-code=${s}></sw-badge>`}renderDoor(e){const t=this.programsOf(e.stationId),s=this.zoneOf(e.stationId),a=r`<div class="doorhead">
      <h2 data-sch-door-title>${c("doorAt",{door:e.doorName,station:e.stationName})}</h2>
      ${e.online?l:r`<span class="sub" data-sch-offline>${c("offline")}</span>`}
      <span class="sp"></span>
      ${this.renderCodePill(e.stationId)}
    </div>`;let i;return!t||t.state==="loading"&&!t.data?i=r`<sw-state-panel compact quiet state="loading" heading=${c("loading")} data-sch-panel="door-loading"></sw-state-panel>`:t.state==="unsupported"?i=r`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("sUnsupported")} data-sch-panel="door-unsupported"></sw-state-panel>`:t.state==="forbidden"?i=r`<sw-state-panel compact quiet state="forbidden" heading=${c("noPermission")} data-sch-panel="door-forbidden"></sw-state-panel>`:t.data?i=this.renderProgram(e,t,s):i=t.state==="busy"?r`<sw-state-panel compact quiet state="stale" heading=${c("busy")} data-sch-panel="door-busy"></sw-state-panel>`:r`<sw-state-panel compact quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="door-error" @action=${()=>void this.loadStation(e.stationId)}></sw-state-panel>`,r`${a}${i}`}renderProgram(e,t,s){const a=tt(e,t.data),i=this.staleLine(t,s,"door");if(a.none)return r`${i}<sw-card><div class="block"><sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("noProgram")} data-sch-panel="no-program"></sw-state-panel></div></sw-card>`;const o=st(a.state);return r`${i}<sw-card>
      <div class="block" data-sch-program=${a.state}>
        <div class="bh"><h3>${c("programsTitle")}</h3><span class="sp"></span><sw-badge kind=${X[o]} label=${at(`st_${a.state}`,"st_unknown")} data-sch-program-state=${a.state}></sw-badge></div>
        <div class="prog">
          <span class="name" data-sch-program-name>${a.name}</span>
          ${a.execution?r`<span class="muted" data-sch-execution>${a.execution}</span>`:l}
        </div>
        <sw-week-grid data-sch-week aria-label=${c("weekLabel")} .days=${a.days} .modes=${[{id:"hold",label:c("legendHold"),color:"var(--sw-accent)"}]}></sw-week-grid>
        ${a.unreadable?r`<span class="muted" data-sch-hours-unknown>${c("hoursUnknown")}</span>`:l}
        ${a.lines.length?r`<ul class="lines" data-sch-lines>${a.lines.map(d=>r`<li>${d}</li>`)}</ul>`:l}
        ${a.dates.length?r`<div class="dates" data-sch-dates><h4>${c("datesTitle")}</h4><ul class="lines">${a.dates.map(d=>r`<li>${d}</li>`)}</ul></div>`:l}
        ${a.checkedAt||a.timezone?r`<span class="muted">${[a.checkedAt?c("checked",{when:H(a.checkedAt,s)}):"",a.timezone?c("zone",{zone:a.timezone}):""].filter(Boolean).join(" · ")}</span>`:l}
      </div>
    </sw-card>`}renderTable(e){const t=Object.fromEntries(e.map(o=>[o.stationId,this.programsOf(o.stationId)?.data??null])),s=Object.fromEntries(e.map(o=>[o.stationId,this.codesOf(o.stationId)?.data??null])),a=it(e,t,s),i=[{key:"door",label:c("colDoor"),render:o=>r`<b>${o.door}</b>`},{key:"station",label:c("colStation")},{key:"program",label:c("colProgram")},{key:"kind",label:c("colKind")},{key:"when",label:c("colWhen")},{key:"state",label:c("colState"),render:o=>o.state?r`<sw-badge kind=${X[o.tone]} label=${o.state}></sw-badge>`:""},{key:"code",label:c("colCode"),render:o=>r`<span data-sch-code=${o.codeState}>${o.code}</span>`}];return r`<sw-table dense data-sch-table .rowKey=${"key"} .columns=${i} .rows=${a} @row-select=${o=>this.pick(o.detail.id)}></sw-table>`}renderManage(e){const t=this.feed?.fresh===!1||!this.library.fresh;return r`<div class="manage" data-sch-manage>
      <wk-schedule-library .stations=${[...e]} .library=${this.library.data} .plans=${this.plans.data} .ops=${this.ops.data} ?live=${!t} ?narrow=${this.narrow}
        @sched-changed=${()=>void this.loadLibrary()}></wk-schedule-library>
    </div>`}renderLibrary(e){const t=nt(e),s=this.feed?.default_zone??null,a=p=>p.state==="forbidden"||p.state==="unsupported",i=this.library,o=a(this.plans)?null:this.plans;if(a(i)&&!o)return l;const d=(p,x,O,le,Ne)=>r`<sw-card>
      <div class="block" data-sch-block=${x}>
        <div class="bh"><h3>${p}</h3>${le!==null?r`<span class="n">${le}</span>`:l}</div>
        ${O.state==="loading"&&!O.data?r`<sw-state-panel compact quiet state="loading" heading=${c("loading")}></sw-state-panel>`:O.state==="unsupported"?r`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("sUnsupported")} data-sch-panel=${`${x}-unsupported`}></sw-state-panel>`:O.data?r`${this.staleLine(O,s,x)}${Ne}`:O.state==="busy"?r`<sw-state-panel compact quiet state="stale" heading=${c("busy")} data-sch-panel=${`${x}-busy`}></sw-state-panel>`:r`<sw-state-panel compact quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel=${`${x}-error`} @action=${()=>this.refresh()}></sw-state-panel>`}
      </div>
    </sw-card>`,h=ot(i.data,o?.data??null,t),f=rt(o?.data??null,a(this.ops)?null:this.ops.data,i.data,t),j=h.length?r`<div class="rows">${h.map(p=>r`<div class="row" data-sch-lib-row=${p.id}>
            <div class="main"><span class="t">${p.name}${p.version?r` <span class="muted">${p.version}</span>`:l}</span>
              ${p.lines.map(x=>r`<span class="s">${x}</span>`)}
              <span class="s">${[p.holidays,p.proposals].filter(Boolean).join(" · ")}</span></div>
          </div>`)}</div>`:r`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("libraryEmpty")} data-sch-panel="library-empty"></sw-state-panel>`,P=f.length?r`<div class="rows">${f.map(p=>r`<div class="row" data-sch-plan-row=${p.id}>
            <div class="main"><span class="t">${p.name} · ${p.station}</span>
              <span class="s">${[p.state!==p.source?p.source:"",p.outdated?c("outdated"):"",p.notApplied?c("notApplied"):"",p.checkedAt?c("checked",{when:H(p.checkedAt,p.stationId&&this.zoneOf(p.stationId)||s)}):""].filter(Boolean).join(" · ")}</span></div>
            <sw-badge kind=${X[p.tone]} label=${p.state} data-sch-plan-state=${p.tone}></sw-badge>
          </div>`)}</div>`:r`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("plansEmpty")} data-sch-panel="plans-empty"></sw-state-panel>`;return r`<div class="two" data-sch-library>
      ${a(i)?l:d(c("libraryTitle"),"library",i,i.data?i.data.length:null,j)}
      ${o?d(c("plansTitle"),"plans",o,o.data?o.data.length:null,P):l}
    </div>`}};b.styles=ht;g([u()],b.prototype,"feed",2);g([u()],b.prototype,"error",2);g([u()],b.prototype,"access",2);g([u()],b.prototype,"wanted",2);g([u()],b.prototype,"view",2);g([u()],b.prototype,"narrow",2);g([u()],b.prototype,"sheet",2);g([u()],b.prototype,"programs",2);g([u()],b.prototype,"codes",2);g([u()],b.prototype,"library",2);g([u()],b.prototype,"plans",2);g([u()],b.prototype,"ops",2);g([u()],b.prototype,"features",2);g([u()],b.prototype,"manage",2);g([u()],b.prototype,"managing",2);b=g([te("wiskey-schedules")],b);export{b as WiskeySchedules};
