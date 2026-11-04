import{g as E,E as Q,F as _,a as ee,A as l,e as r,bO as T,H as se,j as Z,b7 as te,bx as Re,by as Ne,G as u,aA as F,b_ as Pe,i as K,ar as Ce,R as Le,r as de,av as W,l as ce}from"./index-BJ665FDN.js";import"./sw-table-BkX6TAOZ.js";import{c as Me,d as qe,g as Fe,b as We}from"./access-stations-DPb-BnbY.js";import"./sw-week-grid-BEenqYhL.js";import"./wk-deep-links-FWYwUrCZ.js";import{T as Y,s as he,P as Be,d as G,p as pe,i as He,a as c,b as B,f as Ue,c as ue,C as Je,e as Ve,g as Ke,h as Ye,j as Ge,k as Xe,l as Ze,t as Qe,m as es,n as ss,o as ts}from"./schedules-logic-u5AQJ0Sk.js";import"./sw-logo-art-Va6y_cIM.js";import"./deep-links-BulfUhTh.js";import"./wiskey-format-B1C9aa4N.js";const as=()=>E("access-control/schedules"),is=()=>E("access-control/schedules/plans"),ns=()=>E("access-control/schedules/operations"),os=Q`
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
  /* R5-SECURITY: a hover only under a fine pointer; the chosen door is a filled accent field, 700; the row sinks on pointer-down */
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
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
    font-weight: var(--sw-fw-bold);
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
`;function we(e){return e("access.schedules.manage")||e("system.configure")}const D=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],rs=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],ls=["Sunday","Monday","Tuesday","Wednesday","Thursday"],J=8,ds=64,cs=32,ae=/^(?:[01]\d|2[0-3]):[0-5]\d$/,ie=/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/,hs=/^\d{4}-\d{2}-\d{2}$/,ne=()=>Object.fromEntries(D.map(e=>[e,[]])),me=(e="")=>({name:e,weekly:ne(),holidays:[]});function fe(e){const s=ne();for(const t of D)s[t]=(e.weekly?.[t]??[]).map(a=>({start:a.start,end:a.end}));return{name:e.name??"",weekly:s,holidays:(e.holidays??[]).map(t=>({name:t.name??"",start:t.start??"",end:t.end??"",periods:(t.periods??[]).map(a=>({start:a.start,end:a.end}))}))}}const ps=(e,s)=>JSON.stringify(V(e))===JSON.stringify(V(s));function V(e){const s=t=>[...t].sort((a,i)=>a.start.localeCompare(i.start));return{name:e.name,weekly:Object.fromEntries(D.map(t=>[t,s(e.weekly[t]??[])])),holidays:[...e.holidays].map(t=>({...t,periods:s(t.periods)})).sort((t,a)=>t.start.localeCompare(a.start))}}const k=e=>e==="24:00"?1440:Number(e.slice(0,2))*60+Number(e.slice(3,5));function be(e,s){if(e.length>J)return[{code:"schedule_period_limit",where:s}];const t=[];if(e.forEach((i,o)=>{!ae.test(i.start)||!ie.test(i.end)?t.push({code:"schedule_invalid_time",where:`${s}.${o}`}):k(i.start)>=k(i.end)&&t.push({code:"schedule_invalid_time",where:`${s}.${o}`})}),t.length)return t;const a=[...e].sort((i,o)=>k(i.start)-k(o.start));for(let i=1;i<a.length;i++)if(k(a[i-1].end)>k(a[i].start))return[{code:"schedule_overlap",where:s}];return[]}function O(e){if(!hs.test(e))return!1;const[s,t,a]=e.split("-").map(Number),i=new Date(Date.UTC(s,t-1,a));return s>=2e3&&s<=2037&&i.getUTCMonth()===t-1&&i.getUTCDate()===a}function ge(e){return e.length>cs||!e.trim()||/[\u0000-\u001f]/.test(e)}function us(e){const s=[];ge(e.name)&&s.push({code:"invalid_text",where:"name"});for(const a of D)s.push(...be(e.weekly[a]??[],`weekly.${a}`));e.holidays.length>ds&&s.push({code:"schedule_holiday_limit",where:"holidays"}),e.holidays.forEach((a,i)=>{const o=`holidays.${i}`;ge(a.name)&&s.push({code:"invalid_text",where:`${o}.name`}),O(a.start)||s.push({code:"schedule_invalid_date",where:`${o}.start`}),O(a.end)||s.push({code:"schedule_invalid_date",where:`${o}.end`}),O(a.start)&&O(a.end)&&a.start>a.end&&s.push({code:"schedule_invalid_date",where:o}),s.push(...be(a.periods,`${o}.periods`))});const t=e.holidays.filter(a=>O(a.start)&&O(a.end)).sort((a,i)=>a.start.localeCompare(i.start));for(let a=1;a<t.length;a++)if(t[a-1].end>=t[a].start){s.push({code:"schedule_holiday_overlap",where:"holidays"});break}return s}const v=(e,s)=>e.find(t=>t.where===s||t.where.startsWith(`${s}.`));function oe(e,s,t){return{...e,weekly:{...e.weekly,[s]:t}}}function ws(e){if(e.length>=J)return null;if(!e.length)return{start:"08:00",end:"17:00"};const s=Math.max(...e.map(i=>k(i.end)));if(s>=1439)return null;const t=Math.min(1440,s+60),a=i=>i===1440?"24:00":`${String(Math.floor(i/60)).padStart(2,"0")}:${String(i%60).padStart(2,"0")}`;return{start:a(s),end:a(t)}}function ms(e,s){const t=ws(e.weekly[s]??[]);return t?oe(e,s,[...e.weekly[s]??[],t]):e}function fs(e,s,t){return oe(e,s,(e.weekly[s]??[]).filter((a,i)=>i!==t))}function ve(e,s,t,a,i){return oe(e,s,(e.weekly[s]??[]).map((o,d)=>d===t?{...o,[a]:i}:o))}function bs(e,s,t){const a={...e.weekly};for(const i of t)i!==s&&(a[i]=(e.weekly[s]??[]).map(o=>({...o})));return{...e,weekly:a}}function gs(e,s){const t={name:"",start:s,end:s,periods:[]};return{...e,holidays:[...e.holidays,t]}}function z(e,s,t){return{...e,holidays:e.holidays.map((a,i)=>i===s?{...a,...t}:a)}}function vs(e,s){return{...e,holidays:e.holidays.filter((t,a)=>a!==s)}}function je(e){return D.map(s=>(e[s]??[]).filter(t=>ae.test(t.start)&&ie.test(t.end)).map(t=>({begin:`${t.start}:00`,end:`${t.end}:00`})))}function $s(e,s){const t=je(s),a=ne();return D.forEach((i,o)=>{const d=(e[o]??[]).map(f=>({start:f.begin.slice(0,5),end:f.end.slice(0,5)==="24:00"?"24:00":f.end.slice(0,5)})),h=JSON.stringify($e(e[o]??[]))===JSON.stringify($e(t[o]??[]));a[i]=h?(s[i]??[]).map(f=>({...f})):d}),a}function $e(e){const s=Array.from({length:24},()=>!1);for(const t of e){const a=Math.floor(k(t.begin.slice(0,5))/60),i=Math.min(24,Math.ceil(k(t.end.slice(0,5))/60));for(let o=a;o<i;o++)s[o]=!0}return s}function Ie(e){return D.reduce((s,t)=>s+(e[t]??[]).reduce((a,i)=>ae.test(i.start)&&ie.test(i.end)?a+Math.max(0,k(i.end)-k(i.start)):a,0),0)}function re(e,s){const a=e?.checks.find(i=>i.kind===s)?.capabilities?.ids;return Array.isArray(a)&&a.length===2?[a[0],a[1]]:null}function ye(e,s,t){if(t&&t.holidays.length===e&&e===0==(t.holiday_group===null))return{...t,holidays:[...t.holidays]};const a=(o,d)=>re(s,o)?.[1]??d,i=a("holiday",64);return{template:a("template",1),weekly:a("weekly",1),holiday_group:e?a("holiday_group",1):null,holidays:Array.from({length:e},(o,d)=>Math.max(1,i-d))}}function ke(e,s){const t={},a=(i,o,d)=>{if(d===null||!Number.isInteger(d)||d<1||d>65535)t[i]="schedule_binding_invalid";else{const h=re(s,o);h&&(d<h[0]||d>h[1])&&(t[i]="schedule_binding_out_of_range")}};return a("template","template",e.template),a("weekly","weekly",e.weekly),e.holidays.length&&a("holiday_group","holiday_group",e.holiday_group),e.holidays.forEach((i,o)=>a(`holidays.${o}`,"holiday",i)),new Set(e.holidays).size!==e.holidays.length&&(t.holidays="schedule_binding_invalid"),t}function _e(e){switch(e){case"verified":case"ready":return"live";case"blocked":case"interrupted":return"stale";case"failed":return"error";case"cancelled":return"offline";case"pending":case"queued":case"checking":return"neutral";default:return"unknown"}}const xe=e=>e==="pending"||e==="queued"||e==="checking";function ys(e){return e.status==="queued"?"neutral":e.status==="refused"?"error":e.status==="not_sent"?"offline":"unknown"}function H(e){const s=new Date(e),t=a=>String(a).padStart(2,"0");return{date:`${s.getFullYear()}-${t(s.getMonth()+1)}-${t(s.getDate())}`,time:`${t(s.getHours())}:${t(s.getMinutes())}`}}const ks={manageTitle:"ניהול ספריית לוחות הזמנים",manageOpen:"ניהול הספרייה",newSchedule:"לוח זמנים חדש",importFile:"ייבוא מקובץ",exportFile:"ייצוא לקובץ",edit:"עריכה",remove:"מחיקה",deploy:"פריסה לעמדות",assess:"בדיקת התאמה לעמדה",editorNew:"לוח זמנים חדש",editorEdit:"עריכת {name}",name:"שם",namePlaceholder:"למשל: שעות משרד",weekTitle:"שבוע",gridHint:"גרירה על הלוח מסמנת שעות שלמות; לדקות מדויקות ערכו את השעות בכל יום",addWindow:"הוספת חלון",removeWindow:"הסרת החלון",from:"מ־",to:"עד",closedDay:"סגור",copyTo:"העתקה לימי חול",copyAll:"העתקה לכל השבוע",holidaysTitle:"חגים ותאריכים מיוחדים",holidaysHint:"בתאריכים אלה חלים החלונות של החג במקום השבוע",addHoliday:"הוספת תאריך מיוחד",holidayName:"שם",holidayFrom:"מתאריך",holidayTo:"עד תאריך",holidayClosed:"סגור כל היום",removeHoliday:"הסרת התאריך",summaryHours:"{h} שעות בשבוע",checkTitle:"בדיקה מקדימה",checkAt:"בדיקה לתאריך ושעה",checkRun:"בדיקה",checkOpen:"ב־{date} {time} הדלתות ייפתחו לפי לוח הזמנים ({source})",checkClosed:"ב־{date} {time} לוח הזמנים סגור ({source})",sourceWeekly:"לפי השבוע",sourceHoliday:"לפי {name}",checkNeeded:"לפני שמירה יש להריץ בדיקה מקדימה",checkStale:"הטיוטה השתנתה מאז הבדיקה - יש לבדוק שוב",checkOk:"הבדיקה עברה",save:"שמירה",cancel:"ביטול",close:"סגירה",saving:"שומר…",confirmSaveTitle:"לשמור את לוח הזמנים?",confirmSaveNew:'לוח הזמנים "{name}" יתווסף לספרייה. הוא לא נשלח לאף עמדה עד שתפרסו אותו.',confirmSaveEdit:'לוח הזמנים "{name}" יעודכן בספרייה (גרסה {rev}).',affectsPlans:'יש לו הצעות פריסה ל־{stations}. אחרי השמירה הן יסומנו "הספרייה השתנתה" ויהיה צורך להכין אותן מחדש.',confirmDeleteTitle:"למחוק את לוח הזמנים?",confirmDelete:'לוח הזמנים "{name}" יימחק מהספרייה.',confirmSend:"אישור",saved:"נשמר בספרייה",deleted:"נמחק מהספרייה",importTitle:"ייבוא לוחות זמנים",importPick:"בחירת קובץ",importPreview:"{n} לוחות זמנים בקובץ · {c} בשם שכבר קיים",importAppend:"הייבוא מוסיף לספרייה ואינו מחליף לוחות קיימים",importApply:"ייבוא",importDone:"יובאו {n} לוחות זמנים",importTooLarge:"הקובץ גדול מדי לייבוא מכאן",importRow:"{name} · {p} חלונות · {h} חגים",assessTitle:"התאמה לעמדה",pickStation:"עמדה",assessRun:"בדיקה",assessFits:"לוח הזמנים מתאים ליכולות העמדה",assessExceeds:"לוח הזמנים חורג מיכולות העמדה",assessUnknown:"העמדה לא דיווחה על כל היכולות - לא ידוע אם הוא מתאים",limitRow:"{key}: נדרש {needed} · זמין {available}",baselineTitle:"נקודת השוואה",baselineState:"מצב: {state}",baselineSave:"שמירה כנקודת השוואה",baselineClear:"ניקוי נקודת ההשוואה",baselineSaved:"נקודת ההשוואה נשמרה",baselineCleared:"נקודת ההשוואה נוקתה",deployTitle:'פריסת "{name}" לעמדות',deployStations:"עמדות",deployStep1:"בחירת עמדות ומשבצות",deployStep2:"בדיקה מקדימה",deployStep3:"אישור ופריסה",slotsTitle:"משבצות בעמדה",slotsHint:"מספרי המשבצות בעמדה ללוח הזמנים. הטווח לפי מה שהעמדה דיווחה",slotTemplate:"תבנית",slotWeekly:"שבוע",slotGroup:"קבוצת חגים",slotHoliday:"חג {n}",range:"טווח {a}-{b}",readStation:"קריאת העמדה",reading:"קורא את העמדה… (עד שתי דקות)",previewRun:"בדיקה מקדימה",previewAll:"בדיקה מקדימה לכל העמדות",impactTitle:"מה ייפגע",impactStation:"עמדה: {name}",impactDoors:"דלתות: {doors}",impactNoDoors:"לעמדה אין דלתות מנוהלות",impactPeople:"{explicit} אנשים עם לוח זמנים משלהם · {implicit} לפי ברירת המחדל של העמדה · {read} נקראו",impactPeopleUnknown:"לא ידוע כמה אנשים בעמדה (הקריאה נכשלה)",conflictsTitle:"התנגשויות",resourceRow:"{kind} {id}: {state}",externalRef:"בשימוש מחוץ להצעה",activeRes:"פעיל בעמדה",blockersTitle:"חוסמים",savePlans:"שמירת ההצעות",plansSaved:"נשמרו {n} הצעות פריסה",deployNow:"פריסה",confirmDeployTitle:"לפרוס ל־{n} עמדות?",confirmDeploy:"לכל עמדה תיווצר עבודת פריסה והבדיקה שלה תרוץ ברקע. ייכתב לעמדה רק מה שהמערכת מאשרת.",progressTitle:"התקדמות הפריסה",progressDone:"הפריסה הסתיימה",progressRunning:"בודק את העמדות…",jobLine:"{station}: {status}",writesOff:'WisKey עדיין לא מאשר כתיבה של לוחות זמנים לעמדות - כל עבודה תיעצר ב"חסום" ולא ייכתב דבר לעמדה.',jobsTitle:"עבודות פריסה",jobsEmpty:"אין עבודות פריסה",jobRecheck:"בדיקה שוב",jobCancel:"ביטול",jobArchive:"לארכיון",plansTitle:"הצעות פריסה",planRecheck:"בדיקה חוזרת",planDelete:"מחיקת ההצעה",planClaim:"לקיחת אחריות",planRelease:"שחרור אחריות",claimed:"באחריות Arx",confirmPlanDelete:"למחוק את הצעת הפריסה ל־{station}?",confirmClaimTitle:"לקחת אחריות על המשבצות?",confirmClaim:"המשבצות {keys} בעמדה {station} יסומנו כמנוהלות מכאן. זו הצהרה בלבד: היא לא כותבת לעמדה.",confirmRelease:"לשחרר את האחריות על המשבצות?",confirmRecheck:"לקרוא שוב את העמדה ולעדכן את ההצעה?",confirmJob:'לבצע "{action}" לעבודה של {station}?',done:"בוצע",st_queued:"בתור",st_refused:"נדחה",st_unknown:"לא ידוע אם בוצע",st_not_sent:"לא נשלח",refusedBy:"WisKey סירב: {reason}",notSent:"לא נשלח: {reason}",unknownOutcome:"נשלח ולא התקבלה תשובה ברורה - ייתכן שבוצע. רעננו ובדקו לפני שמנסים שוב.",noStations:"אין עמדות מחוברות",offline:"לא מחוברת",stationsPicked:"עמדות שנבחרו: {n}",stale:"הנתונים אינם עדכניים - רעננו לפני שינוי",forbidden:"אין לך הרשאה לנהל את ספריית לוחות הזמנים"},_s={manageTitle:"Schedule library",manageOpen:"Manage library",newSchedule:"New schedule",importFile:"Import",exportFile:"Export",edit:"Edit",remove:"Delete",deploy:"Deploy to stations",save:"Save",cancel:"Cancel",close:"Close",refusedBy:"WisKey refused: {reason}"};function xs(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function n(e,s){const t=(xs()==="en"?_s[e]:void 0)??ks[e];return s?t.replace(/\{(\w+)\}/g,(a,i)=>i in s?String(s[i]):a):t}const L={Sunday:"ראשון",Monday:"שני",Tuesday:"שלישי",Wednesday:"רביעי",Thursday:"חמישי",Friday:"שישי",Saturday:"שבת"},Ss={Sunday:"א׳",Monday:"ב׳",Tuesday:"ג׳",Wednesday:"ד׳",Thursday:"ה׳",Friday:"ו׳",Saturday:"ש׳"},Ts={template:"תבנית",weekly:"שבוע",holiday_group:"קבוצת חגים",holiday:"חג"},As={matches:"תואם",different:"שונה בעמדה",not_observed:"לא קיים בעמדה",unreadable:"לא נקרא",unsupported:"לא נתמך"},zs={missing:"אין",unchanged:"ללא שינוי",changed:"השתנה בעמדה",incomplete:"חלקי",identity_changed:"העמדה הוחלפה",unavailable:"לא זמין"},Se={pending:"ממתין",queued:"בתור",checking:"בבדיקה",blocked:"חסום",ready:"מוכן",interrupted:"נקטע",failed:"נכשל",cancelled:"בוטל",verified:"אומת"},Ds={template_resources:"תבניות",weekly_resources:"שבועות",holiday_group_resources:"קבוצות חגים",holiday_resources:"חגים",weekly_per_day:"חלונות ביום",weekly_periods:"חלונות בשבוע",weekly_precision:"דיוק השעות",holiday_per_day:"חלונות בחג",holiday_periods:"חלונות בחג",holiday_precision:"דיוק שעות החג",weekdays:"ימים",holiday_membership:"חגים בקבוצה"},js={unauthorized:"לחשבון השירות של Arx אין הרשאת ניהול לוחות זמנים ב־WisKey",revision_conflict:"מישהו אחר שינה את הרשומה בינתיים",schedule_not_found:"לוח הזמנים לא נמצא",schedule_limit:"הספרייה מלאה (עד 100)",schedule_invalid_time:"שעה לא תקינה או סיום לפני התחלה",schedule_overlap:"חלונות חופפים באותו יום",schedule_period_limit:"יותר מ־8 חלונות ביום",schedule_invalid_week:"השבוע חייב לכלול את שבעת הימים",schedule_invalid_date:"תאריך לא תקין (2000-2037, התחלה לפני סוף)",schedule_holiday_limit:"יותר מ־64 תאריכים מיוחדים",schedule_holiday_overlap:"תאריכים מיוחדים חופפים",invalid_text:"שם ריק או ארוך מ־32 תווים",schedule_transfer_invalid:"הקובץ אינו קובץ ייצוא תקין",schedule_import_expired:"הבדיקה פגה או הוחלפה",schedule_plan_expired:"הבדיקה פגה או הוחלפה",schedule_claim_expired:"הבדיקה פגה או הוחלפה",schedule_baseline_expired:"הבדיקה פגה או הוחלפה",schedule_preview_required:"הבדיקה המקדימה חסרה או פגה",schedule_plan_resource_reserved:"המשבצות שמורות להצעה אחרת",schedule_binding_invalid:"מספרי משבצות לא תקינים",schedule_binding_out_of_range:"משבצת מחוץ לטווח של העמדה",schedule_compilation_limit:"חורג מיכולות העמדה",schedule_compilation_unknown:"העמדה לא דיווחה על יכולותיה",schedule_claim_conflict:"המשבצות כבר באחריות הצעה אחרת",schedule_claim_in_use:"עבודת פריסה פעילה משתמשת באחריות",schedule_operation_exists:"כבר קיימת עבודת פריסה להצעה",schedule_operation_retained:"העבודה עדיין רצה או אינה במצב סופי",schedule_source_changed:"לוח הזמנים השתנה מאז ההצעה",schedule_plan_device_changed:"העמדה הוחלפה מאז ההצעה",schedule_read_busy:"העמדה כבר נקראת",schedule_writes_unverified:"כתיבה לעמדה עדיין לא אומתה ב־WisKey",schedule_ownership_unknown:"לא הוצהרה אחריות על המשבצות",schedule_ownership_changed:"המשבצות השתנו מאז ההצהרה",schedule_inventory_incomplete:"קריאת העמדה לא הושלמה",schedule_plan_users_unreadable:"לא ניתן היה לקרוא את המשתמשים בעמדה",schedule_plan_user_defaults:"יש בעמדה משתמשים לפי ברירת מחדל",schedule_plan_external_references:"המשבצות בשימוש מחוץ להצעה",schedule_plan_capabilities_changed:"יכולות העמדה השתנו",schedule_plan_active_resources:"המשבצות פעילות בעמדה",schedule_plan_observation_incomplete:"חלק מהמשבצות לא נקראו",schedule_plan_holiday_membership_unknown:"לא ידוע כמה חגים קבוצה מקבלת",station_offline:"העמדה אינה מחוברת",connection_failed:"העמדה לא ענתה בזמן",authentication_failed:"העמדה דחתה את פרטי ההתחברות",schedule_operation_failed:"הבדיקה המוקדמת נכשלה",schedule_operation_interrupted:"הבדיקה נקטעה"},$=e=>e&&js[e]||e||"";var Is=Object.defineProperty,Os=Object.getOwnPropertyDescriptor,R=(e,s,t,a)=>{for(var i=a>1?void 0:a?Os(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&Is(s,t,i),i};let A=class extends ee{constructor(){super(...arguments),this.faults=[],this.narrow=!1,this.today="2026-01-01",this.disabled=!1}emit(e){this.dispatchEvent(new CustomEvent("draft-change",{detail:e,bubbles:!0,composed:!0}))}fault(e){const s=v(this.faults,e);return s?r`<span class="err" role="alert" data-se-fault=${e}>${$(s.code)}</span>`:l}render(){const e=this.draft;if(!e)return l;const s=!!v(this.faults,"name");return r`
      <div class="sec">
        <label class="field name">${n("name")}
          <input data-se-name maxlength="32" .value=${e.name} placeholder=${n("namePlaceholder")} aria-invalid=${String(s)} ?disabled=${this.disabled}
            @input=${t=>this.emit({...e,name:t.target.value})} />
        </label>
        ${this.fault("name")}
      </div>
      <div class="sec" data-se-week>
        <h4><sw-icon name="calendar" size=${14}></sw-icon>${n("weekTitle")}<span class="sum" data-se-hours>${n("summaryHours",{h:Math.round(Ie(e.weekly)/60*10)/10})}</span></h4>
        ${this.narrow?l:r`<sw-week-grid data-se-grid ?editable=${!this.disabled} .days=${je(e.weekly)} .modes=${[{id:"on",label:n("weekTitle"),color:"var(--sw-accent)"}]}
                @change=${t=>this.emit({...e,weekly:$s(t.detail.days,e.weekly)})}></sw-week-grid>
              <p class="hint">${n("gridHint")}</p>`}
        <div class="days">${rs.map(t=>this.renderDay(t))}</div>
      </div>
      <div class="sec" data-se-holidays>
        <h4><sw-icon name="star" size=${14}></sw-icon>${n("holidaysTitle")}<span class="sum">${e.holidays.length||""}</span></h4>
        <p class="hint">${n("holidaysHint")}</p>
        ${this.fault("holidays")}
        ${e.holidays.map((t,a)=>this.renderHoliday(a))}
        <div><wk-action-button tone="dashed" icon="plus" data-se-add-holiday ?disabled=${this.disabled||e.holidays.length>=64}
          @click=${()=>this.emit(gs(e,this.today))}>${n("addHoliday")}</wk-action-button></div>
      </div>
    `}renderDay(e){const s=this.draft,t=s.weekly[e]??[],a=this.narrow?Ss[e]:L[e];return r`<div class="day" data-se-day=${e}>
      <span class="dn" title=${L[e]}>${a}</span>
      <div class="wins">
        ${t.length?l:r`<span class="closed">${n("closedDay")}</span>`}
        ${t.map((i,o)=>{const d=!!v(this.faults,`weekly.${e}.${o}`);return r`<span class="win" data-se-win=${`${e}.${o}`} ?data-bad=${d}>
            <input type="time" lang=${T()} step="60" aria-label=${`${L[e]} ${n("from")}`} .value=${i.start} ?disabled=${this.disabled} data-se-start
              @change=${h=>this.emit(ve(s,e,o,"start",h.target.value))} />
            <span aria-hidden="true">–</span>
            <input type="time" lang=${T()} step="60" aria-label=${`${L[e]} ${n("to")}`} .value=${i.end==="24:00"?"23:59":i.end} ?disabled=${this.disabled} data-se-end
              @change=${h=>{const f=h.target.value;this.emit(ve(s,e,o,"end",f==="23:59"&&i.end==="24:00"?"24:00":f))}} />
            <button class="x" type="button" aria-label=${n("removeWindow")} data-se-remove-win ?disabled=${this.disabled} @click=${()=>this.emit(fs(s,e,o))}><sw-icon name="close" size=${14}></sw-icon></button>
          </span>`})}
        <button class="x" type="button" aria-label=${`${n("addWindow")} · ${L[e]}`} title=${n("addWindow")} data-se-add-win=${e}
          ?disabled=${this.disabled||t.length>=J} @click=${()=>this.emit(ms(s,e))}><sw-icon name="plus" size=${16}></sw-icon></button>
        ${e==="Sunday"&&t.length?r`<wk-action-button tone="quiet" icon="copy" data-se-copy ?disabled=${this.disabled} @click=${()=>this.emit(bs(s,"Sunday",ls))}>${n("copyTo")}</wk-action-button>`:l}
        ${this.fault(`weekly.${e}`)}
      </div>
    </div>`}renderHoliday(e){const s=this.draft,t=s.holidays[e],a=`holidays.${e}`;return r`<div class="hol" data-se-holiday=${e}>
      <label class="field hn">${n("holidayName")}
        <input maxlength="32" .value=${t.name} aria-invalid=${String(!!v(this.faults,`${a}.name`))} ?disabled=${this.disabled} data-se-hname
          @input=${i=>this.emit(z(s,e,{name:i.target.value}))} />
      </label>
      <label class="field">${n("holidayFrom")}
        <input type="date" lang=${T()} .value=${t.start} aria-invalid=${String(!!v(this.faults,`${a}.start`))} ?disabled=${this.disabled} data-se-hstart
          @change=${i=>this.emit(z(s,e,{start:i.target.value}))} />
      </label>
      <label class="field">${n("holidayTo")}
        <input type="date" lang=${T()} .value=${t.end} aria-invalid=${String(!!v(this.faults,`${a}.end`))} ?disabled=${this.disabled} data-se-hend
          @change=${i=>this.emit(z(s,e,{end:i.target.value}))} />
      </label>
      <button class="x" type="button" aria-label=${n("removeHoliday")} data-se-remove-holiday ?disabled=${this.disabled} @click=${()=>this.emit(vs(s,e))}><sw-icon name="trash" size=${16}></sw-icon></button>
      <div class="wins">
        ${t.periods.length?l:r`<span class="closed">${n("holidayClosed")}</span>`}
        ${t.periods.map((i,o)=>r`<span class="win" ?data-bad=${!!v(this.faults,`${a}.periods.${o}`)}>
          <input type="time" lang=${T()} step="60" aria-label=${`${t.name} ${n("from")}`} .value=${i.start} ?disabled=${this.disabled}
            @change=${d=>this.emit(z(s,e,{periods:t.periods.map((h,f)=>f===o?{...h,start:d.target.value}:h)}))} />
          <span aria-hidden="true">–</span>
          <input type="time" lang=${T()} step="60" aria-label=${`${t.name} ${n("to")}`} .value=${i.end==="24:00"?"23:59":i.end} ?disabled=${this.disabled}
            @change=${d=>this.emit(z(s,e,{periods:t.periods.map((h,f)=>f===o?{...h,end:d.target.value}:h)}))} />
          <button class="x" type="button" aria-label=${n("removeWindow")} ?disabled=${this.disabled}
            @click=${()=>this.emit(z(s,e,{periods:t.periods.filter((d,h)=>h!==o)}))}><sw-icon name="close" size=${14}></sw-icon></button>
        </span>`)}
        <button class="x" type="button" aria-label=${n("addWindow")} data-se-add-hwin ?disabled=${this.disabled||t.periods.length>=J}
          @click=${()=>this.emit(z(s,e,{periods:[...t.periods,t.periods.length?{start:t.periods[t.periods.length-1].end==="24:00"?"23:00":t.periods[t.periods.length-1].end,end:"24:00"}:{start:"08:00",end:"13:00"}]}))}>
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
  `;R([_({attribute:!1})],A.prototype,"draft",2);R([_({attribute:!1})],A.prototype,"faults",2);R([_({type:Boolean})],A.prototype,"narrow",2);R([_()],A.prototype,"today",2);R([_({type:Boolean,reflect:!0})],A.prototype,"disabled",2);A=R([se("wk-schedule-draft-form")],A);const N="access-control/schedules",Es=15e3;function Oe(){return{confirmed:!0,client_request_id:Ne(),expires_at:new Date(Re()+Es).toISOString().replace(/\.\d{3}Z$/,"Z")}}const P=(e,s)=>te(`${N}/actions/${e}`,s),y=(e,s)=>te(`${N}/actions/${e}`,{...s,...Oe()}),Rs=(e,s,t)=>P("check",{data:e,date:s,time:t}),Ns=(e,s)=>y("create",{data:e,check_id:s}),Ps=(e,s,t,a)=>y("update",{schedule_id:e,revision:s,data:t,check_id:a}),Cs=(e,s)=>y("delete",{schedule_id:e,revision:s}),Ls=e=>P("import_preview",{document:e}),Ms=e=>y("import_apply",{preview_id:e}),qs=()=>E(`${N}/export`),Fs=e=>P("readiness",{station_id:e}),Ws=(e,s)=>P("assess",{station_id:e,data:s}),Bs=(e,s)=>y("baseline_save",{station_id:e,preview_id:s}),Hs=(e,s)=>y("baseline_clear",{station_id:e,revision:s}),Us=(e,s,t,a)=>P("plan_preview",{station_id:e,schedule_id:s,revision:t,bindings:a}),Js=e=>y("plan_save",{preview_id:e}),Vs=(e,s)=>y("plan_recheck",{plan_id:e,revision:s}),Ks=(e,s)=>y("plan_delete",{plan_id:e,revision:s}),Ys=(e,s)=>P("claim_preview",{plan_id:e,revision:s}),Gs=e=>y("claim_confirm",{preview_id:e}),Xs=(e,s)=>y("claim_release",{claim_id:e,revision:s}),Zs=e=>te(`${N}/actions/deploy`,{plans:e,...Oe()}),Qs=(e,s,t)=>y(e,{job_id:s,revision:t}),et=e=>E(`${N}/jobs${e.length?"?"+e.map(s=>`ids=${encodeURIComponent(s)}`).join("&"):""}`),st=()=>E(`${N}/claims`);function M(e){if(e instanceof Z){const s=e.body?.details??{},t=String(s.outcome??""),a=t==="refused"?"refused":t==="not_sent"?"not_sent":t==="unknown"?"unknown":[400,403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",i=Number(s.retry_after_s);return{status:a,code:String(s.wiskey_code??e.body?.code??"")||null,message:e.body?.user_message||e.message,field:typeof s.field=="string"?s.field:null,retryAfter:Number.isFinite(i)&&i>=0?i:null}}return{status:"unknown",code:"network",message:"",field:null,retryAfter:null}}var tt=Object.defineProperty,at=Object.getOwnPropertyDescriptor,m=(e,s,t,a)=>{for(var i=a>1?void 0:a?at(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&tt(s,t,i),i};const Te={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"},it=2e3,nt=18e4,ot=6e4;let w=class extends ee{constructor(){super(...arguments),this.stations=[],this.library=null,this.plans=null,this.ops=null,this.live=!0,this.narrow=!1,this.editing=null,this.draft=me(),this.checkAt=H(Date.now()),this.checked=null,this.busy=null,this.assessStation="",this.assessment=null,this.importing=null,this.deploying=null,this.targets=[],this.progress=null,this.ask=null,this.note=null,this.claims=null,this.pollTimer=0,this.pollStarted=0}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.pollTimer)}willUpdate(e){e.has("stations")&&!this.assessStation&&(this.assessStation=this.stations.find(s=>s.online)?.id??"")}changed(){this.dispatchEvent(new CustomEvent("sched-changed",{bubbles:!0,composed:!0}))}stationName(e){return this.stations.find(s=>s.id===e)?.name??e??""}say(e,s){if(!e){this.note={tone:"ok",text:s??n("done"),code:null};return}const t=e.status==="refused"?n("refusedBy",{reason:$(e.code)||e.message}):e.status==="not_sent"?n("notSent",{reason:e.message||$(e.code)}):n("unknownOutcome");this.note={tone:e.status,text:t,code:e.code}}async run(e,s,t,a=!0){this.busy=e;try{const i=await s();return a&&(this.say(null,t),this.changed()),i}catch(i){const o=M(i);return this.say(o),a&&o.status!=="not_sent"&&this.changed(),null}finally{this.busy=null}}openEditor(e){this.editing=e,this.draft=e==="new"?me():fe(e),this.checked=null,this.assessment=null,this.checkAt=H(Date.now()),this.note=null}closeEditor(){this.editing=null,this.ask=null}async runCheck(){const e=V(this.draft),s=await this.run("check",()=>Rs(e,this.checkAt.date,this.checkAt.time),void 0,!1);s?.check_id&&(this.checked={draft:e,id:s.check_id,result:s.data})}checkValid(){return!!this.checked&&ps(this.checked.draft,this.draft)}async save(){const e=this.checked,s=this.editing;if(this.ask=null,!e||!s)return;await this.run("save",()=>s==="new"?Ns(e.draft,e.id):Ps(s.id,s.revision??0,e.draft,e.id),n("saved"))?this.closeEditor():this.checked=null}async runAssess(){if(!this.assessStation)return;const e=this.assessStation,s=await this.run("assess",()=>Ws(e,V(this.draft)),void 0,!1);s&&(this.assessment={station:e,data:s.data,previewId:s.baseline_preview_id??null})}async baseline(e){const s=this.assessment;if(this.ask=null,!!s)if(e==="baseline_save"&&s.previewId){const t=await this.run("baseline",()=>Bs(s.station,s.previewId),n("baselineSaved"));t&&(this.assessment={...s,previewId:null,data:{...s.data,baseline:{...s.data.baseline,state:"unchanged",revision:t.data.revision}}})}else e==="baseline_clear"&&s.data.baseline.revision&&await this.run("baseline",()=>Hs(s.station,s.data.baseline.revision),n("baselineCleared"))&&(this.assessment={...s,data:{...s.data,baseline:{...s.data.baseline,state:"missing",revision:0}}})}async pickFile(e){const s=e.target,t=s.files?.[0];if(s.value="",!t)return;if(t.size>ot){this.note={tone:"not_sent",text:n("importTooLarge"),code:null};return}const a=await t.text(),i=await this.run("import",()=>Ls(a),void 0,!1);i?.preview_id&&(this.importing={preview:i.data,previewId:i.preview_id,file:t.name},this.ask={kind:"import"})}async applyImport(){const e=this.importing;if(this.ask=null,!e)return;const s=await this.run("import",()=>Ms(e.previewId));s&&(this.note={tone:"ok",text:n("importDone",{n:s.data.length}),code:null}),this.importing=null}async exportFile(){const e=await this.run("export",()=>qs(),void 0,!1);if(!e)return;const s=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),t=document.createElement("a");t.href=URL.createObjectURL(s),t.download=`schedules-${H(Date.now()).date}.json`,t.click(),window.setTimeout(()=>URL.revokeObjectURL(t.href),1e3)}openDeploy(e){this.deploying=e,this.targets=[],this.progress=null,this.note=null}closeDeploy(){window.clearTimeout(this.pollTimer),this.deploying=null,this.targets=[],this.progress=null,this.ask=null}previousBindings(e){return(this.plans??[]).find(t=>t.station_id===e&&t.draft_id===this.deploying?.id)?.bindings??null}toggleTarget(e){const s=this.deploying;this.targets.some(t=>t.stationId===e)?this.targets=this.targets.filter(t=>t.stationId!==e):this.targets=[...this.targets,{stationId:e,readiness:null,bindings:ye(s.holidays?.length??0,null,this.previousBindings(e)),phase:"idle",previewId:null,impact:null,plan:null,error:null}]}patchTarget(e,s){this.targets=this.targets.map(t=>t.stationId===e?{...t,...s}:t)}async readTarget(e){this.patchTarget(e.stationId,{phase:"reading",error:null});try{const s=await Fs(e.stationId),t=this.previousBindings(e.stationId)?e.bindings:ye(this.deploying?.holidays?.length??0,s.data);this.patchTarget(e.stationId,{phase:"idle",readiness:s.data,bindings:t})}catch(s){this.patchTarget(e.stationId,{phase:"error",error:M(s)})}}async previewTarget(e){const s=this.deploying;this.patchTarget(e.stationId,{phase:"previewing",error:null,previewId:null,impact:null});try{const t=await Us(e.stationId,s.id,s.revision??0,e.bindings);this.patchTarget(e.stationId,{phase:"previewed",previewId:t.preview_id??null,impact:t.impact??null,plan:t.data})}catch(t){this.patchTarget(e.stationId,{phase:"error",error:M(t)})}}async previewAll(){for(const e of this.targets)e.phase==="previewed"||e.phase==="saved"||Object.keys(ke(e.bindings,e.readiness)).length||await this.previewTarget(this.targets.find(s=>s.stationId===e.stationId))}async deploy(){this.ask=null,this.busy="deploy";try{for(const s of this.targets.filter(t=>t.phase==="previewed"&&t.previewId)){this.patchTarget(s.stationId,{phase:"saving"});try{const t=await Js(s.previewId);this.patchTarget(s.stationId,{phase:"saved",plan:t.data,previewId:null})}catch(t){this.patchTarget(s.stationId,{phase:"error",error:M(t),previewId:null})}}const e=this.targets.filter(s=>s.phase==="saved"&&s.plan);if(this.changed(),!e.length)return;try{const s=await Zs(e.map(t=>({plan_id:t.plan.id,revision:t.plan.revision??1})));this.progress={results:s.results,jobs:Object.fromEntries(s.results.filter(t=>t.job).map(t=>[t.job.id,t.job])),done:!1,writesEnabled:null},this.pollStarted=Date.now(),this.poll()}catch(s){this.say(M(s))}}finally{this.busy=null}}async poll(){const e=this.progress;if(!e)return;const s=Object.keys(e.jobs);if(!s.length){this.progress={...e,done:!0};return}try{const t=await et(s);if(t.jobs){const a={...e.jobs};for(const i of t.jobs)a[i.id]=i;this.progress={...e,jobs:a,done:t.done,writesEnabled:t.writes_enabled}}}catch{}!this.progress?.done&&Date.now()-this.pollStarted<nt&&this.deploying?this.pollTimer=window.setTimeout(()=>void this.poll(),it):this.changed()}async loadClaims(){try{const e=await st();this.claims=e.claims}catch{this.claims=null}}async claimPreview(e){const s=await this.run(`claim:${e.id}`,()=>Ys(e.id,e.revision??0),void 0,!1);s?.preview_id&&(this.ask={kind:"claim",plan:e,previewId:s.preview_id,keys:(s.data.resource_keys??[]).filter(Boolean)})}async confirmAsk(){const e=this.ask;if(e){if(this.ask=null,e.kind==="save")return this.save();if(e.kind==="import")return this.applyImport();if(e.kind==="deploy")return this.deploy();if(e.kind==="baseline_save"||e.kind==="baseline_clear")return this.baseline(e.kind);if(e.kind==="delete"){await this.run(`delete:${e.schedule.id}`,()=>Cs(e.schedule.id,e.schedule.revision??0),n("deleted"));return}if(e.kind==="plan_recheck"){await this.run(`plan:${e.plan.id}`,()=>Vs(e.plan.id,e.plan.revision??0));return}if(e.kind==="plan_delete"){await this.run(`plan:${e.plan.id}`,()=>Ks(e.plan.id,e.plan.revision??0));return}if(e.kind==="claim"){await this.run(`claim:${e.plan.id}`,()=>Gs(e.previewId)),await this.loadClaims();return}if(e.kind==="release"){await this.run(`claim:${e.claim.plan_id}`,()=>Xs(e.claim.id,e.claim.revision??0)),await this.loadClaims();return}e.kind==="job"&&await this.run(`job:${e.job.id}`,()=>Qs(e.action,e.job.id,e.job.revision??0))}}firstUpdated(){this.loadClaims()}render(){const e=this.library??[],s=!this.live||!!this.busy;return r`<sw-card>
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
          ${this.live?l:r`<p class="warn" role="status" data-se-stale>${n("stale")}</p>`}
          ${this.note&&!this.editing&&!this.deploying?this.renderNote():l}
          <div class="rows">${e.map(t=>this.renderScheduleRow(t))}</div>
        </div>
      </sw-card>
      ${this.renderPlans()} ${this.renderJobs()} ${this.renderEditor()} ${this.renderDeploy()} ${this.editing||this.deploying?l:this.renderAsk()}`}renderNote(){const e=this.note;return r`<p class="note" role="status" data-se-note=${e.tone} data-se-code=${e.code??""} data-tone=${e.tone}>${e.text}</p>`}plansFor(e){return(this.plans??[]).filter(s=>s.draft_id===e)}renderScheduleRow(e){const s=this.plansFor(e.id),t=Math.round(Ie(fe(e).weekly)/60*10)/10,a=!this.live||!!this.busy;return r`<div class="row" data-se-row=${e.id}>
      <div class="main">
        <span class="t">${e.name??"—"}</span>
        <span class="s">${[n("summaryHours",{h:t}),e.holidays?.length?`${e.holidays.length} · ${n("holidaysTitle")}`:"",s.length?s.map(i=>this.stationName(i.station_id)).join(", "):""].filter(Boolean).join(" · ")}</span>
      </div>
      <div class="acts">
        <wk-action-button tone="quiet" icon="edit" data-se-edit=${e.id} ?disabled=${a} @click=${()=>this.openEditor(e)}>${n("edit")}</wk-action-button>
        <wk-action-button tone="quiet" icon="upload" data-se-deploy=${e.id} ?disabled=${a} @click=${()=>this.openDeploy(e)}>${n("deploy")}</wk-action-button>
        <wk-action-button tone="quiet" icon="trash" icon-only label=${n("remove")} data-se-delete=${e.id} ?disabled=${a} @click=${()=>this.ask={kind:"delete",schedule:e}}></wk-action-button>
      </div>
    </div>`}renderPlans(){const e=this.plans??[];if(!e.length)return l;const s=!this.live||!!this.busy;return r`<sw-card>
      <div class="block" data-se-plans>
        <div class="bh"><h3>${n("plansTitle")}</h3><span class="n">${e.length}</span></div>
        <div class="rows">
          ${e.map(t=>{const a=(this.claims??[]).find(o=>o.plan_id===t.id)??null,i=(t.report?.blockers??[]).filter(Boolean);return r`<div class="row" data-se-plan=${t.id}>
              <div class="main">
                <span class="t">${t.name??"—"} · ${this.stationName(t.station_id)}</span>
                <span class="s" data-se-plan-blockers>${i.map(o=>$(o)).join(" · ")}</span>
              </div>
              ${a?r`<sw-badge kind="live" label=${n("claimed")} data-se-claimed></sw-badge>`:l}
              <div class="acts">
                <wk-action-button tone="quiet" icon="refresh" data-se-recheck=${t.id} ?busy=${this.busy===`plan:${t.id}`} ?disabled=${s} @click=${()=>this.ask={kind:"plan_recheck",plan:t}}>${n("planRecheck")}</wk-action-button>
                ${a?r`<wk-action-button tone="quiet" icon="unlock" data-se-release=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"release",claim:a}}>${n("planRelease")}</wk-action-button>`:r`<wk-action-button tone="quiet" icon="lock" data-se-claim=${t.id} ?busy=${this.busy===`claim:${t.id}`} ?disabled=${s} @click=${()=>void this.claimPreview(t)}>${n("planClaim")}</wk-action-button>`}
                <wk-action-button tone="quiet" icon="trash" icon-only label=${n("planDelete")} data-se-plan-delete=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"plan_delete",plan:t}}></wk-action-button>
              </div>
            </div>`})}
        </div>
      </div>
    </sw-card>`}renderJobs(){const e=[...this.ops?.jobs??[]];if(!e.length)return l;const s=!this.live||!!this.busy;return r`<sw-card>
      <div class="block" data-se-jobs>
        <div class="bh"><h3>${n("jobsTitle")}</h3><span class="n">${e.length}</span></div>
        ${this.ops&&!this.ops.writes_enabled?r`<p class="warn" data-se-writes-off>${n("writesOff")}</p>`:l}
        <div class="rows">
          ${e.map(t=>{const a=t.status??"unknown",i=xe(a),o=a==="cancelled"||a==="verified";return r`<div class="row" data-se-job=${t.id} data-status=${a}>
              <div class="main">
                <span class="t">${t.name??"—"} · ${this.stationName(t.station_id)}</span>
                <span class="s">${t.error?$(t.error):(t.blockers??[]).filter(Boolean).map(d=>$(d)).join(" · ")}</span>
              </div>
              <sw-badge kind=${Te[_e(a)]} label=${Se[a]??a}></sw-badge>
              <div class="acts">
                ${i||o?l:r`<wk-action-button tone="quiet" icon="refresh" data-se-job-check=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"job",action:"job_check",job:t}}>${n("jobRecheck")}</wk-action-button>`}
                ${i||o?l:r`<wk-action-button tone="quiet" icon="close" data-se-job-cancel=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"job",action:"job_cancel",job:t}}>${n("jobCancel")}</wk-action-button>`}
                ${o?r`<wk-action-button tone="quiet" icon="inbox" data-se-job-archive=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"job",action:"job_archive",job:t}}>${n("jobArchive")}</wk-action-button>`:l}
              </div>
            </div>`})}
        </div>
      </div>
    </sw-card>`}renderEditor(){const e=this.editing;if(!e)return l;const s=us(this.draft),t=s.length===0,a=this.checkValid(),i=e==="new"?[]:this.plansFor(e.id),o=e==="new"?n("editorNew"):n("editorEdit",{name:e.name??""}),d=!!this.busy;return r`<sw-drawer modal open heading=${o} data-se-editor=${e==="new"?"new":e.id} @close=${h=>h.target===h.currentTarget&&this.closeEditor()}>
      <wk-schedule-draft-form .draft=${this.draft} .faults=${s} ?narrow=${this.narrow} today=${H(Date.now()).date} ?disabled=${d}
        @draft-change=${h=>this.draft=h.detail}></wk-schedule-draft-form>
      <div class="panel" data-se-check>
        <h4><sw-icon name="check" size=${14}></sw-icon>${n("checkTitle")}</h4>
        <div class="line">
          <label class="f">${n("checkAt")}<input type="date" lang=${T()} .value=${this.checkAt.date} @change=${h=>this.checkAt={...this.checkAt,date:h.target.value}} /></label>
          <label class="f">&nbsp;<input type="time" lang=${T()} step="60" .value=${this.checkAt.time} @change=${h=>this.checkAt={...this.checkAt,time:h.target.value}} /></label>
          <wk-action-button icon="check" data-se-check-run ?busy=${this.busy==="check"} ?disabled=${d||!t||!this.live} @click=${()=>void this.runCheck()}>${n("checkRun")}</wk-action-button>
        </div>
        ${this.checked?r`<span class="result" role="status" data-se-check-result data-ok=${String(!!this.checked.result.within_window)}>${this.checkLine(this.checked.result)}${a?"":` · ${n("checkStale")}`}</span>`:r`<span class="s">${n("checkNeeded")}</span>`}
      </div>
      ${this.renderAssess(t)}
      ${this.note?this.renderNote():l}
      ${i.length?r`<p class="warn" data-se-affects>${n("affectsPlans",{stations:i.map(h=>this.stationName(h.station_id)).join(", ")})}</p>`:l}
      <div slot="footer" class="foot">
        <wk-action-button data-se-cancel @click=${()=>this.closeEditor()}>${n("cancel")}</wk-action-button>
        <wk-action-button tone="primary" icon="check" data-se-save ?busy=${this.busy==="save"} ?disabled=${d||!t||!a||!this.live} @click=${()=>this.ask={kind:"save"}}>${n("save")}</wk-action-button>
      </div>
      ${this.renderAsk()}
    </sw-drawer>`}checkLine(e){const s=e.source==="holiday"?n("sourceHoliday",{name:e.holiday??""}):n("sourceWeekly");return n(e.within_window?"checkOpen":"checkClosed",{date:e.date??"",time:e.time??"",source:s})}renderAssess(e){const s=this.stations.filter(i=>i.online),t=this.assessment,a=!!this.busy;return r`<div class="panel" data-se-assess>
      <h4><sw-icon name="cpu" size=${14}></sw-icon>${n("assessTitle")}</h4>
      <div class="line">
        <label class="f">${n("pickStation")}
          <select data-se-assess-station .value=${this.assessStation} @change=${i=>this.assessStation=i.target.value}>
            ${s.map(i=>r`<option value=${i.id} ?selected=${i.id===this.assessStation}>${i.name}</option>`)}
          </select>
        </label>
        <wk-action-button icon="search" data-se-assess-run ?busy=${this.busy==="assess"} ?disabled=${a||!e||!this.assessStation||!this.live} @click=${()=>void this.runAssess()}>${n("assessRun")}</wk-action-button>
      </div>
      ${this.busy==="assess"?r`<span class="s">${n("reading")}</span>`:l}
      ${t?r`<span class="result" role="status" data-se-assess-state=${t.data.assessment.state??"unknown"}>${t.data.assessment.state==="fits"?n("assessFits"):t.data.assessment.state==="exceeds"?n("assessExceeds"):n("assessUnknown")}</span>
            <ul class="plain">${t.data.assessment.limits.map(i=>r`<li data-state=${i.state??""}>${n("limitRow",{key:Ds[i.key??""]??i.key??"",needed:i.needed??"—",available:i.available??"—"})}</li>`)}</ul>
            <span class="s" data-se-baseline=${t.data.baseline.state??""}>${n("baselineTitle")} · ${n("baselineState",{state:zs[t.data.baseline.state??""]??t.data.baseline.state??"—"})}</span>
            <div class="line">
              ${t.previewId?r`<wk-action-button tone="quiet" icon="bookmark" data-se-baseline-save ?disabled=${a} @click=${()=>this.ask={kind:"baseline_save"}}>${n("baselineSave")}</wk-action-button>`:l}
              ${t.data.baseline.revision?r`<wk-action-button tone="quiet" icon="trash" data-se-baseline-clear ?disabled=${a} @click=${()=>this.ask={kind:"baseline_clear"}}>${n("baselineClear")}</wk-action-button>`:l}
            </div>`:l}
    </div>`}renderDeploy(){const e=this.deploying;if(!e)return l;const s=this.targets.filter(a=>a.phase==="previewed"),t=!!this.busy||this.targets.some(a=>a.phase==="reading"||a.phase==="previewing"||a.phase==="saving");return r`<sw-drawer modal open heading=${n("deployTitle",{name:e.name??""})} data-se-deploy-drawer=${e.id} @close=${a=>a.target===a.currentTarget&&this.closeDeploy()}>
      ${this.note?this.renderNote():l}
      ${this.progress?this.renderProgress():r`
        <div class="panel" data-se-targets>
          <h4><sw-icon name="building" size=${14}></sw-icon>${n("deployStep1")}</h4>
          ${this.stations.length?l:r`<span class="s">${n("noStations")}</span>`}
          <div class="picks">
            ${this.stations.map(a=>{const i=this.targets.some(o=>o.stationId===a.id);return r`<label class="pick" ?data-on=${i} ?data-off=${!a.online} data-se-pick=${a.id}>
                <input type="checkbox" .checked=${i} ?disabled=${!a.online||t} @change=${()=>this.toggleTarget(a.id)} />
                ${a.name}${a.online?"":` · ${n("offline")}`}
              </label>`})}
          </div>
          ${this.targets.length?r`<span class="s">${n("stationsPicked",{n:this.targets.length})}</span>`:l}
        </div>
        ${this.targets.map(a=>this.renderTarget(a,e,t))}
      `}
      <div slot="footer" class="foot">
        <wk-action-button data-se-deploy-close @click=${()=>this.closeDeploy()}>${this.progress?n("close"):n("cancel")}</wk-action-button>
        ${this.progress?l:r`<wk-action-button icon="search" data-se-preview-all ?disabled=${t||!this.targets.length||!this.live} @click=${()=>void this.previewAll()}>${n("previewAll")}</wk-action-button>
              <wk-action-button tone="primary" icon="upload" data-se-deploy-go ?busy=${this.busy==="deploy"} ?disabled=${t||!s.length||!this.live} @click=${()=>this.ask={kind:"deploy"}}>${n("deployNow")}${s.length?` (${s.length})`:""}</wk-action-button>`}
      </div>
      ${this.renderAsk()}
    </sw-drawer>`}renderTarget(e,s,t){const a=s.holidays?.length??0,i=ke(e.bindings,e.readiness),o=(d,h,f,j,C)=>{const p=re(e.readiness,f);return r`<label class="f">${h}${p?r` <span class="s">${n("range",{a:p[0],b:p[1]})}</span>`:l}
        <input type="number" inputmode="numeric" min="1" max="65535" .value=${j===null?"":String(j)} aria-invalid=${String(!!i[d])} data-se-slot=${d}
          ?disabled=${t||e.phase==="saved"} @change=${x=>this.patchTarget(e.stationId,{bindings:C(Number(x.target.value)),phase:"idle",previewId:null,impact:null})} />
      </label>`};return r`<div class="target" data-se-target=${e.stationId} data-phase=${e.phase}>
      <div class="bh"><h3>${this.stationName(e.stationId)}</h3><span class="sp"></span>
        <wk-action-button tone="quiet" icon="cpu" data-se-read=${e.stationId} ?busy=${e.phase==="reading"} ?disabled=${t||e.phase==="saved"} @click=${()=>void this.readTarget(e)}>${n("readStation")}</wk-action-button>
      </div>
      <span class="s">${n("slotsHint")}</span>
      <div class="line">
        ${o("template",n("slotTemplate"),"template",e.bindings.template,d=>({...e.bindings,template:d}))}
        ${o("weekly",n("slotWeekly"),"weekly",e.bindings.weekly,d=>({...e.bindings,weekly:d}))}
        ${a?o("holiday_group",n("slotGroup"),"holiday_group",e.bindings.holiday_group,d=>({...e.bindings,holiday_group:d})):l}
        ${e.bindings.holidays.map((d,h)=>o(`holidays.${h}`,n("slotHoliday",{n:h+1}),"holiday",d,f=>({...e.bindings,holidays:e.bindings.holidays.map((j,C)=>C===h?f:j)})))}
      </div>
      ${Object.values(i).length?r`<span class="s" role="alert" data-se-slot-fault>${$(Object.values(i)[0])}</span>`:l}
      ${e.phase==="reading"||e.phase==="previewing"?r`<span class="s line"><span class="spin" aria-hidden="true"></span>${n("reading")}</span>`:l}
      ${e.error?r`<p class="note" role="status" data-tone=${e.error.status} data-se-target-error=${e.error.code??""}>${e.error.status==="refused"?n("refusedBy",{reason:$(e.error.code)}):e.error.status==="not_sent"?n("notSent",{reason:e.error.message}):n("unknownOutcome")}</p>`:l}
      ${e.impact?this.renderImpact(e.impact):l}
      ${e.phase!=="previewed"&&e.phase!=="saved"?r`<div><wk-action-button icon="search" data-se-preview=${e.stationId} ?busy=${e.phase==="previewing"} ?disabled=${t||Object.keys(i).length>0||!this.live} @click=${()=>void this.previewTarget(e)}>${n("previewRun")}</wk-action-button></div>`:l}
    </div>`}renderImpact(e){const s=e.station?.doors??[],t=e.people,a=(e.resources??[]).filter(o=>o.state&&o.state!=="matches"||o.externally_referenced||o.active),i=(e.blockers??[]).filter(Boolean);return r`<div class="panel" data-se-impact>
      <h4><sw-icon name="target" size=${14}></sw-icon>${n("impactTitle")}</h4>
      <ul class="plain">
        <li data-se-impact-station>${n("impactStation",{name:e.station?.name??e.station?.id??""})}</li>
        <li data-se-impact-doors>${s.length?n("impactDoors",{doors:s.map(o=>o.name??`#${o.index}`).join(", ")}):n("impactNoDoors")}</li>
        <li data-se-impact-people>${t&&t.state==="complete"?n("impactPeople",{explicit:t.explicit??"—",implicit:t.implicit??"—",read:t.read??"—"}):n("impactPeopleUnknown")}</li>
      </ul>
      ${a.length?r`<h4>${n("conflictsTitle")}</h4><ul class="plain" data-se-conflicts>${a.map(o=>r`<li>${n("resourceRow",{kind:Ts[o.kind??""]??o.kind??"",id:o.id??"—",state:As[o.state??""]??o.state??""})}${o.externally_referenced?` · ${n("externalRef")}`:""}${o.active?` · ${n("activeRes")}`:""}</li>`)}</ul>`:l}
      ${i.length?r`<h4>${n("blockersTitle")}</h4><ul class="plain" data-se-blockers>${i.map(o=>r`<li data-code=${o}>${$(o)}</li>`)}</ul>`:l}
    </div>`}renderProgress(){const e=this.progress;return r`<div class="panel prog" data-se-progress data-done=${String(e.done)}>
      <h4>${e.done?r`<sw-icon name="check" size=${14}></sw-icon>${n("progressDone")}`:r`<span class="spin" aria-hidden="true"></span>${n("progressRunning")}`}</h4>
      ${e.writesEnabled===!1?r`<p class="warn" data-se-writes-off>${n("writesOff")}</p>`:l}
      ${e.results.map(s=>{const t=s.job?e.jobs[s.job.id]??s.job:null,a=t?Se[t.status??""]??t.status??"":n(`st_${s.status}`),i=t?t.error?$(t.error):(t.blockers??[]).filter(Boolean).map(d=>$(d)).join(" · "):$(s.code)||s.reason||"",o=t?_e(t.status):ys(s);return r`<div class="row" data-se-result=${s.station?.id??s.plan_id} data-status=${t?.status??s.status}>
          <div class="main"><span class="t">${s.station?.name??this.stationName(s.station?.id)}</span><span class="s">${i}</span></div>
          ${t&&xe(t.status)?r`<span class="spin" aria-hidden="true"></span>`:l}
          <sw-badge kind=${Te[o]} label=${a}></sw-badge>
        </div>`})}
    </div>`}renderAsk(){const e=this.ask;if(!e)return l;let s="",t=l;const a=e.kind==="delete"||e.kind==="plan_delete";switch(e.kind){case"save":{const i=this.editing,o=i&&i!=="new"?this.plansFor(i.id):[];s=n("confirmSaveTitle"),t=r`<p class="sentence" data-se-sentence>${i==="new"?n("confirmSaveNew",{name:this.draft.name}):n("confirmSaveEdit",{name:this.draft.name,rev:(i?.revision??0)+1})}</p>
          ${o.length?r`<p class="sentence">${n("affectsPlans",{stations:o.map(d=>this.stationName(d.station_id)).join(", ")})}</p>`:l}`;break}case"delete":{const i=this.plansFor(e.schedule.id);s=n("confirmDeleteTitle"),t=r`<p class="sentence" data-se-sentence>${n("confirmDelete",{name:e.schedule.name??""})}</p>
          ${i.length?r`<p class="sentence">${n("affectsPlans",{stations:i.map(o=>this.stationName(o.station_id)).join(", ")})}</p>`:l}`;break}case"import":{const i=this.importing;s=n("importTitle"),t=r`<p class="sentence" data-se-sentence>${n("importPreview",{n:i.preview.count??0,c:i.preview.name_collisions??0})}</p>
          <ul class="plain">${i.preview.items.map(o=>r`<li>${n("importRow",{name:o.name??"—",p:o.weekly_periods??0,h:o.holidays??0})}</li>`)}</ul>
          <p class="sentence s">${n("importAppend")}</p>`;break}case"deploy":{const i=this.targets.filter(o=>o.phase==="previewed");s=n("confirmDeployTitle",{n:i.length}),t=r`<p class="sentence" data-se-sentence>${n("confirmDeploy")}</p>
          <ul class="plain">${i.map(o=>r`<li>${this.stationName(o.stationId)} · ${(o.impact?.station?.doors??[]).map(d=>d.name).join(", ")}${o.impact?.people?.explicit!=null?` · ${n("impactPeople",{explicit:o.impact.people.explicit,implicit:o.impact.people.implicit??"—",read:o.impact.people.read??"—"})}`:""}</li>`)}</ul>`;break}case"baseline_save":case"baseline_clear":s=e.kind==="baseline_save"?n("baselineSave"):n("baselineClear"),t=r`<p class="sentence" data-se-sentence>${this.stationName(this.assessment?.station)}</p>`;break;case"plan_recheck":s=n("planRecheck"),t=r`<p class="sentence" data-se-sentence>${n("confirmRecheck")} (${this.stationName(e.plan.station_id)})</p>`;break;case"plan_delete":s=n("planDelete"),t=r`<p class="sentence" data-se-sentence>${n("confirmPlanDelete",{station:this.stationName(e.plan.station_id)})}</p>`;break;case"claim":s=n("confirmClaimTitle"),t=r`<p class="sentence" data-se-sentence>${n("confirmClaim",{keys:e.keys.join(", "),station:this.stationName(e.plan.station_id)})}</p>`;break;case"release":s=n("planRelease"),t=r`<p class="sentence" data-se-sentence>${n("confirmRelease")}</p>`;break;case"job":{const i={job_check:n("jobRecheck"),job_cancel:n("jobCancel"),job_archive:n("jobArchive")}[e.action];s=i,t=r`<p class="sentence" data-se-sentence>${n("confirmJob",{action:i,station:this.stationName(e.job.station_id)})}</p>`;break}}return r`<sw-dialog open heading=${s} data-se-confirm=${e.kind} @close=${i=>i.target===i.currentTarget&&(this.ask=null)}>
      ${t}
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
    input,
    select {
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
    label.f {
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
  `;m([_({attribute:!1})],w.prototype,"stations",2);m([_({attribute:!1})],w.prototype,"library",2);m([_({attribute:!1})],w.prototype,"plans",2);m([_({attribute:!1})],w.prototype,"ops",2);m([_({type:Boolean})],w.prototype,"live",2);m([_({type:Boolean})],w.prototype,"narrow",2);m([u()],w.prototype,"editing",2);m([u()],w.prototype,"draft",2);m([u()],w.prototype,"checkAt",2);m([u()],w.prototype,"checked",2);m([u()],w.prototype,"busy",2);m([u()],w.prototype,"assessStation",2);m([u()],w.prototype,"assessment",2);m([u()],w.prototype,"importing",2);m([u()],w.prototype,"deploying",2);m([u()],w.prototype,"targets",2);m([u()],w.prototype,"progress",2);m([u()],w.prototype,"ask",2);m([u()],w.prototype,"note",2);m([u()],w.prototype,"claims",2);w=m([se("wk-schedule-library")],w);var rt=Object.defineProperty,lt=Object.getOwnPropertyDescriptor,g=(e,s,t,a)=>{for(var i=a>1?void 0:a?lt(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&rt(s,t,i),i};const Ae="sw.wiskey.schedules.view",dt=3e4,U={state:"loading",data:null,at:0,fresh:!0,fetchedAt:null},S=(e,s=null)=>({state:e,data:s,at:Date.now(),fresh:!0,fetchedAt:null});function ct(e){try{return localStorage.getItem(e)}catch{return null}}function ht(e,s){try{localStorage.setItem(e,s)}catch{}}const X={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"},ze={kind:"iana",name:"Asia/Jerusalem"},De={loaded:!0,model:null,firmware:null,capabilities:null,clock:null,event_status:null,scanned_at:null,scanning:!1,reconciled_at:null,last_poll_ms:null},pt=[{id:"d1",name:"שער ראשי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"שער"}],has_camera:!1,camera_entity:null,last_seen:null,zone:ze,technical:De,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!1,camera_entity:null,last_seen:null,zone:ze,technical:De,errors:null}],q=[{start:"07:00",end:"09:00"}],ut={d1:{programs:[],saved:[],timezone:"Asia/Jerusalem",native_supported:!1},d2:{programs:[{door:1,revision:1,enabled:!0,removing:!1,policy:{timezone:"Asia/Jerusalem",name:"בוקר",weekly:{Sunday:q,Monday:q,Tuesday:q,Wednesday:q,Thursday:q},holidays:[]},execution:{owned:!1,attempted:null,status:"idle"},error:null,checked_at:null}],saved:[],timezone:"Asia/Jerusalem",native_supported:!1}};let b=class extends ee{constructor(){super(...arguments),this.feed=null,this.error="",this.access={screen:!0,library:!0,edit:!1},this.wanted=null,this.view=ct(Ae)==="table"?"table":"door",this.narrow=typeof window<"u"&&window.innerWidth<Y,this.sheet=!1,this.programs={},this.codes={},this.library=U,this.plans=U,this.ops=U,this.features={},this.manage=!1,this.managing=F().params.get("manage")==="1",this.stopSession=null,this.stopRoute=null,this.poll=0,this.loading=!1,this.loadAgain=!1,this.inFlight=new Set,this.featuresRead=!1,this.mq=typeof matchMedia=="function"?matchMedia(`(max-width: ${Y-1}px)`):null,this.onMedia=()=>{this.narrow=window.innerWidth<Y},this.onVisible=()=>{document.hidden||this.load()}}connectedCallback(){super.connectedCallback(),this.mq?.addEventListener("change",this.onMedia),this.wanted=F().params.get("door"),this.stopRoute=Pe(e=>this.onRoute(e)),K()&&(this.stopSession=Ce(()=>{this.access=he(ce,W),this.manage=we(W)}),this.access=he(ce,W),this.manage=we(W),this.access.screen&&(this.load(),this.poll=window.setInterval(()=>{document.hidden||this.load()},Be),document.addEventListener("visibilitychange",this.onVisible)))}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMedia),this.stopRoute?.(),this.stopRoute=null,this.stopSession?.(),this.stopSession=null,window.clearInterval(this.poll),document.removeEventListener("visibilitychange",this.onVisible)}onRoute(e){if(e.mode!=="wiskey")return;this.managing=e.params.get("manage")==="1";const s=e.params.get("door");s!==this.wanted&&(this.wanted=s,this.loadNeeded())}demo(){return!K()}stations(){return this.demo()?pt:this.feed?.stations??[]}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{this.feed=await Me(),this.error=""}catch(e){e instanceof Z&&e.status===403?this.access={...this.access,screen:!1}:this.error=Le(e)}await this.readFeatures(),await this.loadNeeded(),await this.loadLibrary()}while(this.loadAgain)}finally{this.loading=!1}}async readFeatures(){if(!this.featuresRead)try{const e=await qe();this.features=Object.fromEntries(Object.entries(e.features??{}).map(([s,t])=>[s,t.available])),this.featuresRead=!0}catch{}}needed(){const e=G(this.stations());if(this.effectiveView()==="table")return[...new Set(e.map(t=>t.stationId))];const s=pe(e,this.wanted);return s?[s.stationId]:[]}async loadNeeded(){if(!this.demo())for(const e of this.needed()){const s=Math.min(this.programs[e]?.at??0,this.codes[e]?.at??0);Date.now()-s<dt||await this.loadStation(e)}}classify(e,s,t){const a=Date.now();if(e.state==="ready"&&s!==null&&s!==void 0)return{state:"ready",data:s,at:a,fresh:e.fresh!==!1,fetchedAt:e.fetched_at};const i=e.state==="unsupported"?"unsupported":He(e.last_error)?"busy":"error";return i==="unsupported"?S(i):{state:i,data:t?.data??null,at:a,fresh:!1,fetchedAt:t?.fetchedAt??null}}failed(e,s){return e instanceof Z&&(e.status===403||e.status===404)?S("forbidden"):{state:"error",data:s?.data??null,at:Date.now(),fresh:!1,fetchedAt:s?.fetchedAt??null}}async loadStation(e){if(!this.inFlight.has(e)){this.inFlight.add(e);try{if(this.features.door_programs===!1)this.programs={...this.programs,[e]:S("unsupported")};else{this.programs[e]||(this.programs={...this.programs,[e]:U});try{const s=await Fe(e);this.programs={...this.programs,[e]:this.classify(s,s.programs,this.programs[e])}}catch(s){this.programs={...this.programs,[e]:this.failed(s,this.programs[e])}}}if(this.features.public_codes===!1)this.codes={...this.codes,[e]:S("unsupported")};else try{const s=await We(e);this.codes={...this.codes,[e]:this.classify(s,s.codes,this.codes[e])}}catch(s){this.codes={...this.codes,[e]:this.failed(s,this.codes[e])}}}finally{this.inFlight.delete(e)}}}async loadLibrary(){if(this.demo()||!this.access.library)return;const e=async(s,t,a)=>{if(this.features[s]===!1)return S("unsupported");try{const i=await t();return this.classify(i,i.schedules,a)}catch(i){return this.failed(i,a)}};if(this.library=await e("schedules",as,this.library),this.library.state==="forbidden"){this.plans=S("forbidden"),this.ops=S("forbidden");return}this.plans=await e("schedule_plans",is,this.plans),this.ops=await e("schedule_operations",ns,this.ops)}effectiveView(){return this.narrow?"door":this.view}setView(e){this.view=e,ht(Ae,e),this.loadNeeded()}pick(e){if(this.sheet=!1,this.wanted===e&&this.effectiveView()==="door")return;this.wanted=e,this.view==="table"&&this.setView("door");const s=F();if(s.mode==="wiskey"){const t=new URLSearchParams(s.params);t.set("door",e),de(s.path,t)}this.loadNeeded()}refresh(){this.programs=Object.fromEntries(Object.entries(this.programs).map(([e,s])=>[e,{...s,at:0}])),this.codes=Object.fromEntries(Object.entries(this.codes).map(([e,s])=>[e,{...s,at:0}])),this.load()}zoneOf(e){return this.stations().find(s=>s.id===e)?.zone??this.feed?.default_zone??null}programsOf(e){return this.demo()?S("ready",ut[e]??null):this.programs[e]}codesOf(e){return this.demo()?S("ready",{public_pin_state:e==="d2"?"configured":"absent",slots:[],capabilities:{advertised:null,min:null,max:null},checked_at:null}):this.codes[e]}staleLine(e,s,t){return e.fresh||!e.data?l:r`<p class="status" role="status" data-sch-stale=${t}>${c("stale",{t:B(e.fetchedAt,s)||"—"})}</p>`}render(){const e=c("title");if(K()&&!this.access.screen)return r`<sw-page heading=${e}><div data-sch data-sch-state="forbidden"><sw-state-panel quiet state="forbidden" heading=${c("noPermission")} data-sch-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return r`<sw-page heading=${e}><div data-sch data-sch-state=${this.error?"error":"loading"}>${this.error?r`<sw-state-panel quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="error" @action=${()=>this.refresh()}></sw-state-panel>`:r`<sw-state-panel quiet state="loading" heading=${c("loading")} data-sch-panel="loading"></sw-state-panel>`}</div></sw-page>`;if(!this.demo()&&this.feed.stations===null){const s=this.feed.state==="ready"?"error":this.feed.state,t=Ue(s);return r`<sw-page heading=${e}><div data-sch data-sch-state=${`feed:${this.feed.state}`}>
        <sw-state-panel icon="calendar" quiet state=${t.panel} heading=${t.heading} actionLabel=${t.panel==="error"||t.panel==="stale"?c("retry"):""} data-sch-panel=${`feed:${this.feed.state}`} @action=${()=>this.refresh()}></sw-state-panel>
      </div></sw-page>`}return this.renderReady()}setManaging(e){this.managing=e;const s=F();if(s.mode==="wiskey"){const t=new URLSearchParams(s.params);e?t.set("manage","1"):t.delete("manage"),de(s.path,t)}e&&this.loadLibrary()}renderManaging(){const e=this.stations(),s=this.library;return r`<sw-page wide heading=${c("title")} subheading=${ue(G(e).length,s.data?s.data.length:null)}>
      <sw-button slot="actions" variant="ghost" icon="chevronBack" data-sch-manage-close @click=${()=>this.setManaging(!1)}>${c("viewDoor")}</sw-button>
      <sw-button slot="actions" variant="ghost" icon="refresh" data-sch-refresh label=${c("refresh")} @click=${()=>this.refresh()}>${c("refresh")}</sw-button>
      <div data-sch data-sch-state=${s.data?"ready":s.state} data-sch-view="manage">
        ${s.data?this.renderManage(e):s.state==="loading"?r`<sw-state-panel quiet state="loading" heading=${c("loading")} data-sch-panel="manage-loading"></sw-state-panel>`:r`<sw-state-panel quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="manage-error" @action=${()=>this.refresh()}></sw-state-panel>`}
      </div>
    </sw-page>`}renderReady(){if(this.manage&&this.managing&&!this.demo()&&this.access.library)return this.renderManaging();const e=this.stations(),s=G(e),t=this.effectiveView(),a=pe(s,this.wanted),i=this.demo()?!1:this.access.library&&this.library.state!=="forbidden",o=i&&this.library.data?this.library.data.length:null,d=!this.demo()&&this.feed?.fresh===!1;return r`<sw-page wide heading=${c("title")} subheading=${ue(s.length,o)}>
      ${this.access.edit&&!this.demo()?r`<sw-button slot="actions" variant="ghost" icon="edit" data-sch-edit @click=${()=>window.location.hash=Je}>${c("editClassic")}</sw-button>`:l}
      ${this.manage&&this.access.library&&!this.demo()?r`<sw-button slot="actions" variant="ghost" icon="calendar" data-sch-manage-open @click=${()=>this.setManaging(!0)}>${n("manageOpen")}</sw-button>`:l}
      <sw-button slot="actions" variant="ghost" icon="refresh" data-sch-refresh label=${c("refresh")} @click=${()=>this.refresh()}>${c("refresh")}</sw-button>
      ${this.demo()?l:r`<wk-deep-links slot="actions" place="schedules" mode="menu"></wk-deep-links>`}
      ${s.length&&!this.narrow?r`<sw-view-switch slot="actions" data-sch-views label=${c("viewLabel")} .value=${t} .options=${[{id:"door",label:c("viewDoor"),icon:"calendar"},{id:"table",label:c("viewTable"),icon:"table"}]} @change=${h=>this.setView(h.detail)}></sw-view-switch>`:l}
      <div data-sch data-sch-state=${s.length?"ready":"empty"} data-sch-view=${t}>
        ${d?r`<p class="status" role="status" data-sch-stale="stations">${c("stale",{t:B(this.feed?.fetched_at,this.feed?.default_zone??null)||"—"})}</p>`:l}
        ${s.length?t==="table"?this.renderTable(s):this.renderDoorView(s,a):r`<sw-state-panel icon="calendar" quiet state="empty" heading=${c("noDoors")} data-sch-panel="empty"></sw-state-panel>`}
        ${i?this.renderLibrary(e):l}
      </div>
      ${s.length?this.renderSheet(s,a):l}
    </sw-page>`}renderDoorList(e,s,t=!1){return r`<nav class="doors" aria-label=${c("doorsHeading")} data-sch-door-list=${t?"sheet":"side"}>
      ${t?l:r`<div class="ttl">${c("doorsHeading")}</div>`}
      ${Ve(e).map(a=>r`<div class="station" data-sch-station=${a.stationId}><span class="dot ${a.online?"":"off"}" aria-hidden="true"></span>${a.stationName}</div>
          ${a.doors.map(i=>r`<button type="button" aria-current=${String(i.key===s?.key)} data-sch-door=${i.key} @click=${()=>this.pick(i.key)}><span class="name">${i.doorName}</span></button>`)}`)}
    </nav>`}renderSheet(e,s){return r`<sw-drawer modal ?open=${this.sheet} heading=${c("pickDoor")} data-sch-sheet @close=${t=>t.target===t.currentTarget&&(this.sheet=!1)}>
      ${this.renderDoorList(e,s,!0)}
    </sw-drawer>`}renderDoorView(e,s){return s?r`<div class="layout">
      <aside class="doorcol"><sw-card flush>${this.renderDoorList(e,s)}</sw-card></aside>
      <section class="main" data-sch-door-view=${s.key}>
        <button type="button" class="chip" data-sch-door-chip aria-haspopup="dialog" @click=${()=>this.sheet=!0}>
          <sw-icon name="door" size=${16}></sw-icon><span class="name">${c("doorAt",{door:s.doorName,station:s.stationName})}</span><sw-icon name="chevronDown" size=${12}></sw-icon>
        </button>
        ${this.renderDoor(s)}
      </section>
    </div>`:l}renderCodePill(e){const s=this.codesOf(e);if(s?.state==="unsupported"||s?.state==="forbidden")return l;const t=s?.data?Ke(s.data):"unknown";return r`<sw-badge kind=${t==="set"?"live":t==="unset"?"neutral":"unknown"} label=${c("codePill",{state:Ye(t)})} data-sch-code=${t}></sw-badge>`}renderDoor(e){const s=this.programsOf(e.stationId),t=this.zoneOf(e.stationId),a=r`<div class="doorhead">
      <h2 data-sch-door-title>${c("doorAt",{door:e.doorName,station:e.stationName})}</h2>
      ${e.online?l:r`<span class="sub" data-sch-offline>${c("offline")}</span>`}
      <span class="sp"></span>
      ${this.renderCodePill(e.stationId)}
    </div>`;let i;return!s||s.state==="loading"&&!s.data?i=r`<sw-state-panel compact quiet state="loading" heading=${c("loading")} data-sch-panel="door-loading"></sw-state-panel>`:s.state==="unsupported"?i=r`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("sUnsupported")} data-sch-panel="door-unsupported"></sw-state-panel>`:s.state==="forbidden"?i=r`<sw-state-panel compact quiet state="forbidden" heading=${c("noPermission")} data-sch-panel="door-forbidden"></sw-state-panel>`:s.data?i=this.renderProgram(e,s,t):i=s.state==="busy"?r`<sw-state-panel compact quiet state="stale" heading=${c("busy")} data-sch-panel="door-busy"></sw-state-panel>`:r`<sw-state-panel compact quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="door-error" @action=${()=>void this.loadStation(e.stationId)}></sw-state-panel>`,r`${a}${i}`}renderProgram(e,s,t){const a=Ge(e,s.data),i=this.staleLine(s,t,"door");if(a.none)return r`${i}<sw-card><div class="block"><sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("noProgram")} data-sch-panel="no-program"></sw-state-panel></div></sw-card>`;const o=Xe(a.state);return r`${i}<sw-card>
      <div class="block" data-sch-program=${a.state}>
        <div class="bh"><h3>${c("programsTitle")}</h3><span class="sp"></span><sw-badge kind=${X[o]} label=${Ze(`st_${a.state}`,"st_unknown")} data-sch-program-state=${a.state}></sw-badge></div>
        <div class="prog">
          <span class="name" data-sch-program-name>${a.name}</span>
          ${a.execution?r`<span class="muted" data-sch-execution>${a.execution}</span>`:l}
        </div>
        <sw-week-grid data-sch-week aria-label=${c("weekLabel")} .days=${a.days} .modes=${[{id:"hold",label:c("legendHold"),color:"var(--sw-accent)"}]}></sw-week-grid>
        ${a.unreadable?r`<span class="muted" data-sch-hours-unknown>${c("hoursUnknown")}</span>`:l}
        ${a.lines.length?r`<ul class="lines" data-sch-lines>${a.lines.map(d=>r`<li>${d}</li>`)}</ul>`:l}
        ${a.dates.length?r`<div class="dates" data-sch-dates><h4>${c("datesTitle")}</h4><ul class="lines">${a.dates.map(d=>r`<li>${d}</li>`)}</ul></div>`:l}
        ${a.checkedAt||a.timezone?r`<span class="muted">${[a.checkedAt?c("checked",{when:B(a.checkedAt,t)}):"",a.timezone?c("zone",{zone:a.timezone}):""].filter(Boolean).join(" · ")}</span>`:l}
      </div>
    </sw-card>`}renderTable(e){const s=Object.fromEntries(e.map(o=>[o.stationId,this.programsOf(o.stationId)?.data??null])),t=Object.fromEntries(e.map(o=>[o.stationId,this.codesOf(o.stationId)?.data??null])),a=Qe(e,s,t),i=[{key:"door",label:c("colDoor"),render:o=>r`<b>${o.door}</b>`},{key:"station",label:c("colStation")},{key:"program",label:c("colProgram")},{key:"kind",label:c("colKind")},{key:"when",label:c("colWhen")},{key:"state",label:c("colState"),render:o=>o.state?r`<sw-badge kind=${X[o.tone]} label=${o.state}></sw-badge>`:""},{key:"code",label:c("colCode"),render:o=>r`<span data-sch-code=${o.codeState}>${o.code}</span>`}];return r`<sw-table dense data-sch-table .rowKey=${"key"} .columns=${i} .rows=${a} @row-select=${o=>this.pick(o.detail.id)}></sw-table>`}renderManage(e){const s=this.feed?.fresh===!1||!this.library.fresh;return r`<div class="manage" data-sch-manage>
      <wk-schedule-library .stations=${[...e]} .library=${this.library.data} .plans=${this.plans.data} .ops=${this.ops.data} ?live=${!s} ?narrow=${this.narrow}
        @sched-changed=${()=>void this.loadLibrary()}></wk-schedule-library>
    </div>`}renderLibrary(e){const s=es(e),t=this.feed?.default_zone??null,a=p=>p.state==="forbidden"||p.state==="unsupported",i=this.library,o=a(this.plans)?null:this.plans;if(a(i)&&!o)return l;const d=(p,x,I,le,Ee)=>r`<sw-card>
      <div class="block" data-sch-block=${x}>
        <div class="bh"><h3>${p}</h3>${le!==null?r`<span class="n">${le}</span>`:l}</div>
        ${I.state==="loading"&&!I.data?r`<sw-state-panel compact quiet state="loading" heading=${c("loading")}></sw-state-panel>`:I.state==="unsupported"?r`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("sUnsupported")} data-sch-panel=${`${x}-unsupported`}></sw-state-panel>`:I.data?r`${this.staleLine(I,t,x)}${Ee}`:I.state==="busy"?r`<sw-state-panel compact quiet state="stale" heading=${c("busy")} data-sch-panel=${`${x}-busy`}></sw-state-panel>`:r`<sw-state-panel compact quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel=${`${x}-error`} @action=${()=>this.refresh()}></sw-state-panel>`}
      </div>
    </sw-card>`,h=ss(i.data,o?.data??null,s),f=ts(o?.data??null,a(this.ops)?null:this.ops.data,i.data,s),j=h.length?r`<div class="rows">${h.map(p=>r`<div class="row" data-sch-lib-row=${p.id}>
            <div class="main"><span class="t">${p.name}${p.version?r` <span class="muted">${p.version}</span>`:l}</span>
              ${p.lines.map(x=>r`<span class="s">${x}</span>`)}
              <span class="s">${[p.holidays,p.proposals].filter(Boolean).join(" · ")}</span></div>
          </div>`)}</div>`:r`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("libraryEmpty")} data-sch-panel="library-empty"></sw-state-panel>`,C=f.length?r`<div class="rows">${f.map(p=>r`<div class="row" data-sch-plan-row=${p.id}>
            <div class="main"><span class="t">${p.name} · ${p.station}</span>
              <span class="s">${[p.state!==p.source?p.source:"",p.outdated?c("outdated"):"",p.notApplied?c("notApplied"):"",p.checkedAt?c("checked",{when:B(p.checkedAt,p.stationId&&this.zoneOf(p.stationId)||t)}):""].filter(Boolean).join(" · ")}</span></div>
            <sw-badge kind=${X[p.tone]} label=${p.state} data-sch-plan-state=${p.tone}></sw-badge>
          </div>`)}</div>`:r`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("plansEmpty")} data-sch-panel="plans-empty"></sw-state-panel>`;return r`<div class="two" data-sch-library>
      ${a(i)?l:d(c("libraryTitle"),"library",i,i.data?i.data.length:null,j)}
      ${o?d(c("plansTitle"),"plans",o,o.data?o.data.length:null,C):l}
    </div>`}};b.styles=os;g([u()],b.prototype,"feed",2);g([u()],b.prototype,"error",2);g([u()],b.prototype,"access",2);g([u()],b.prototype,"wanted",2);g([u()],b.prototype,"view",2);g([u()],b.prototype,"narrow",2);g([u()],b.prototype,"sheet",2);g([u()],b.prototype,"programs",2);g([u()],b.prototype,"codes",2);g([u()],b.prototype,"library",2);g([u()],b.prototype,"plans",2);g([u()],b.prototype,"ops",2);g([u()],b.prototype,"features",2);g([u()],b.prototype,"manage",2);g([u()],b.prototype,"managing",2);b=g([se("wiskey-schedules")],b);export{b as WiskeySchedules};
//# sourceMappingURL=wiskey-schedules-CH7dcpDf.js.map
