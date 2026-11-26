import{bg as R,gz as Be,j as J,br as Ue,bt as Je,bs as Ve,bu as Ye,z as $,a as V,A as d,b as o,ei as j,m as Y,c as re,iH as Ge,F as L,bO as Xe,hX as Ze,dk as Qe,k as h,bw as es,an as G,l7 as ss,af as ae,d1 as ts,q as as,d7 as be,aM as X,ag as ve}from"./index-C0HbI5eb.js";import"./sw-table-CyivE6N7.js";import"./sw-view-switch-DdymHlyg.js";import"./sw-week-grid-yHF5lO7F.js";import"./wk-deep-links-C76AKGEV.js";import{g as is,a as ns,b as os,c as rs}from"./access-stations-CFuvr04V.js";import{T as ie,s as ge,P as ls,d as ne,p as $e,i as ds,a as c,b as Z,f as cs,c as ye,C as hs,e as ps,g as us,h as ws,j as fs,k as ms,l as bs,t as vs,m as gs,n as $s,o as ys}from"./schedules-logic-BltnSru_.js";import"./sw-logo-art-PLtEZJxU.js";import"./deep-links-BBum4OZD.js";import"./wiskey-format-BsQdpprG.js";import"./wiskey-BLgv2wLA.js";const ks=()=>R("access-control/schedules"),_s=()=>R("access-control/schedules/plans"),xs=()=>R("access-control/schedules/operations"),Ss=J`
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
  ${Be}
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
`;function ke(e){return e("access.schedules.manage")||e("system.configure")}const I=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],Ts=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],zs=["Sunday","Monday","Tuesday","Wednesday","Thursday"],se=8,As=64,Os=32,le=/^(?:[01]\d|2[0-3]):[0-5]\d$/,de=/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/,js=/^\d{4}-\d{2}-\d{2}$/,ce=()=>Object.fromEntries(I.map(e=>[e,[]])),_e=(e="")=>({name:e,weekly:ce(),holidays:[]});function xe(e){const s=ce();for(const t of I)s[t]=(e.weekly?.[t]??[]).map(a=>({start:a.start,end:a.end}));return{name:e.name??"",weekly:s,holidays:(e.holidays??[]).map(t=>({name:t.name??"",start:t.start??"",end:t.end??"",periods:(t.periods??[]).map(a=>({start:a.start,end:a.end}))}))}}const Ds=(e,s)=>JSON.stringify(te(e))===JSON.stringify(te(s));function te(e){const s=t=>[...t].sort((a,i)=>a.start.localeCompare(i.start));return{name:e.name,weekly:Object.fromEntries(I.map(t=>[t,s(e.weekly[t]??[])])),holidays:[...e.holidays].map(t=>({...t,periods:s(t.periods)})).sort((t,a)=>t.start.localeCompare(a.start))}}const _=e=>e==="24:00"?1440:Number(e.slice(0,2))*60+Number(e.slice(3,5));function Se(e,s){if(e.length>se)return[{code:"schedule_period_limit",where:s}];const t=[];if(e.forEach((i,r)=>{!le.test(i.start)||!de.test(i.end)?t.push({code:"schedule_invalid_time",where:`${s}.${r}`}):_(i.start)>=_(i.end)&&t.push({code:"schedule_invalid_time",where:`${s}.${r}`})}),t.length)return t;const a=[...e].sort((i,r)=>_(i.start)-_(r.start));for(let i=1;i<a.length;i++)if(_(a[i-1].end)>_(a[i].start))return[{code:"schedule_overlap",where:s}];return[]}function W(e){if(!js.test(e))return!1;const[s,t,a]=e.split("-").map(Number),i=new Date(Date.UTC(s,t-1,a));return s>=2e3&&s<=2037&&i.getUTCMonth()===t-1&&i.getUTCDate()===a}function Te(e){return e.length>Os||!e.trim()||/[\u0000-\u001f]/.test(e)}function Rs(e){const s=[];Te(e.name)&&s.push({code:"invalid_text",where:"name"});for(const a of I)s.push(...Se(e.weekly[a]??[],`weekly.${a}`));e.holidays.length>As&&s.push({code:"schedule_holiday_limit",where:"holidays"}),e.holidays.forEach((a,i)=>{const r=`holidays.${i}`;Te(a.name)&&s.push({code:"invalid_text",where:`${r}.name`}),W(a.start)||s.push({code:"schedule_invalid_date",where:`${r}.start`}),W(a.end)||s.push({code:"schedule_invalid_date",where:`${r}.end`}),W(a.start)&&W(a.end)&&a.start>a.end&&s.push({code:"schedule_invalid_date",where:r}),s.push(...Se(a.periods,`${r}.periods`))});const t=e.holidays.filter(a=>W(a.start)&&W(a.end)).sort((a,i)=>a.start.localeCompare(i.start));for(let a=1;a<t.length;a++)if(t[a-1].end>=t[a].start){s.push({code:"schedule_holiday_overlap",where:"holidays"});break}return s}const y=(e,s)=>e.find(t=>t.where===s||t.where.startsWith(`${s}.`));function he(e,s,t){return{...e,weekly:{...e.weekly,[s]:t}}}function Es(e){if(e.length>=se)return null;if(!e.length)return{start:"08:00",end:"17:00"};const s=Math.max(...e.map(i=>_(i.end)));if(s>=1439)return null;const t=Math.min(1440,s+60),a=i=>i===1440?"24:00":`${String(Math.floor(i/60)).padStart(2,"0")}:${String(i%60).padStart(2,"0")}`;return{start:a(s),end:a(t)}}function Is(e,s){const t=Es(e.weekly[s]??[]);return t?he(e,s,[...e.weekly[s]??[],t]):e}function Ns(e,s,t){return he(e,s,(e.weekly[s]??[]).filter((a,i)=>i!==t))}function ze(e,s,t,a,i){return he(e,s,(e.weekly[s]??[]).map((r,l)=>l===t?{...r,[a]:i}:r))}function Ps(e,s,t){const a={...e.weekly};for(const i of t)i!==s&&(a[i]=(e.weekly[s]??[]).map(r=>({...r})));return{...e,weekly:a}}function Cs(e,s){const t={name:"",start:s,end:s,periods:[]};return{...e,holidays:[...e.holidays,t]}}function E(e,s,t){return{...e,holidays:e.holidays.map((a,i)=>i===s?{...a,...t}:a)}}function Ws(e,s){return{...e,holidays:e.holidays.filter((t,a)=>a!==s)}}function We(e){return I.map(s=>(e[s]??[]).filter(t=>le.test(t.start)&&de.test(t.end)).map(t=>({begin:`${t.start}:00`,end:`${t.end}:00`})))}function Ls(e,s){const t=We(s),a=ce();return I.forEach((i,r)=>{const l=(e[r]??[]).map(b=>({start:b.begin.slice(0,5),end:b.end.slice(0,5)==="24:00"?"24:00":b.end.slice(0,5)})),p=JSON.stringify(Ae(e[r]??[]))===JSON.stringify(Ae(t[r]??[]));a[i]=p?(s[i]??[]).map(b=>({...b})):l}),a}function Ae(e){const s=Array.from({length:24},()=>!1);for(const t of e){const a=Math.floor(_(t.begin.slice(0,5))/60),i=Math.min(24,Math.ceil(_(t.end.slice(0,5))/60));for(let r=a;r<i;r++)s[r]=!0}return s}function Le(e){return I.reduce((s,t)=>s+(e[t]??[]).reduce((a,i)=>le.test(i.start)&&de.test(i.end)?a+Math.max(0,_(i.end)-_(i.start)):a,0),0)}function pe(e,s){const a=e?.checks.find(i=>i.kind===s)?.capabilities?.ids;return Array.isArray(a)&&a.length===2?[a[0],a[1]]:null}function Oe(e,s,t){if(t&&t.holidays.length===e&&e===0==(t.holiday_group===null))return{...t,holidays:[...t.holidays]};const a=(r,l)=>pe(s,r)?.[1]??l,i=a("holiday",64);return{template:a("template",1),weekly:a("weekly",1),holiday_group:e?a("holiday_group",1):null,holidays:Array.from({length:e},(r,l)=>Math.max(1,i-l))}}function je(e,s){const t={},a=(i,r,l)=>{if(l===null||!Number.isInteger(l)||l<1||l>65535)t[i]="schedule_binding_invalid";else{const p=pe(s,r);p&&(l<p[0]||l>p[1])&&(t[i]="schedule_binding_out_of_range")}};return a("template","template",e.template),a("weekly","weekly",e.weekly),e.holidays.length&&a("holiday_group","holiday_group",e.holiday_group),e.holidays.forEach((i,r)=>a(`holidays.${r}`,"holiday",i)),new Set(e.holidays).size!==e.holidays.length&&(t.holidays="schedule_binding_invalid"),t}function De(e){switch(e){case"verified":case"ready":return"live";case"blocked":case"interrupted":return"stale";case"failed":return"error";case"cancelled":return"offline";case"pending":case"queued":case"checking":return"neutral";default:return"unknown"}}const Re=e=>e==="pending"||e==="queued"||e==="checking";function Ms(e){return e.status==="queued"?"neutral":e.status==="refused"?"error":e.status==="not_sent"?"offline":"unknown"}function Q(e){const s=new Date(e),t=a=>String(a).padStart(2,"0");return{date:`${s.getFullYear()}-${t(s.getMonth()+1)}-${t(s.getDate())}`,time:`${t(s.getHours())}:${t(s.getMinutes())}`}}const Me={manageTitle:"ניהול ספריית לוחות הזמנים",manageOpen:"ניהול הספרייה",newSchedule:"לוח זמנים חדש",importFile:"ייבוא מקובץ",exportFile:"ייצוא לקובץ",edit:"עריכה",remove:"מחיקה",deploy:"פריסה לעמדות",assess:"בדיקת התאמה לעמדה",editorNew:"לוח זמנים חדש",editorEdit:"עריכת {name}",name:"שם",namePlaceholder:"למשל: שעות משרד",weekTitle:"שבוע",gridHint:"גרירה על הלוח מסמנת שעות שלמות; לדקות מדויקות ערכו את השעות בכל יום",addWindow:"הוספת חלון",removeWindow:"הסרת החלון",from:"מ־",to:"עד",closedDay:"סגור",copyTo:"העתקה לימי חול",copyAll:"העתקה לכל השבוע",holidaysTitle:"חגים ותאריכים מיוחדים",holidaysHint:"בתאריכים אלה חלים החלונות של החג במקום השבוע",addHoliday:"הוספת תאריך מיוחד",holidayName:"שם",holidayFrom:"מתאריך",holidayTo:"עד תאריך",holidayClosed:"סגור כל היום",removeHoliday:"הסרת התאריך",summaryHours:"{h} שעות בשבוע",checkTitle:"בדיקה מקדימה",checkAt:"בדיקה לתאריך ושעה",checkRun:"בדיקה",checkOpen:"ב־{date} {time} הדלתות ייפתחו לפי לוח הזמנים ({source})",checkClosed:"ב־{date} {time} לוח הזמנים סגור ({source})",sourceWeekly:"לפי השבוע",sourceHoliday:"לפי {name}",checkNeeded:"לפני שמירה יש להריץ בדיקה מקדימה",checkStale:"הטיוטה השתנתה מאז הבדיקה - יש לבדוק שוב",checkOk:"הבדיקה עברה",save:"שמירה",cancel:"ביטול",close:"סגירה",saving:"שומר…",confirmSaveTitle:"לשמור את לוח הזמנים?",confirmSaveNew:'לוח הזמנים "{name}" יתווסף לספרייה. הוא לא נשלח לאף עמדה עד שתפרסו אותו.',confirmSaveEdit:'לוח הזמנים "{name}" יעודכן בספרייה (גרסה {rev}).',affectsPlans:'יש לו הצעות פריסה ל־{stations}. אחרי השמירה הן יסומנו "הספרייה השתנתה" ויהיה צורך להכין אותן מחדש.',confirmDeleteTitle:"למחוק את לוח הזמנים?",confirmDelete:'לוח הזמנים "{name}" יימחק מהספרייה.',confirmSend:"אישור",saved:"נשמר בספרייה",deleted:"נמחק מהספרייה",importTitle:"ייבוא לוחות זמנים",importPick:"בחירת קובץ",importPreview:"{n} לוחות זמנים בקובץ · {c} בשם שכבר קיים",importAppend:"הייבוא מוסיף לספרייה ואינו מחליף לוחות קיימים",importApply:"ייבוא",importDone:"יובאו {n} לוחות זמנים",importTooLarge:"הקובץ גדול מדי לייבוא מכאן",importRow:"{name} · {p} חלונות · {h} חגים",assessTitle:"התאמה לעמדה",pickStation:"עמדה",assessRun:"בדיקה",assessFits:"לוח הזמנים מתאים ליכולות העמדה",assessExceeds:"לוח הזמנים חורג מיכולות העמדה",assessUnknown:"העמדה לא דיווחה על כל היכולות - לא ידוע אם הוא מתאים",limitRow:"{key}: נדרש {needed} · זמין {available}",baselineTitle:"נקודת השוואה",baselineState:"מצב: {state}",baselineSave:"שמירה כנקודת השוואה",baselineClear:"ניקוי נקודת ההשוואה",baselineSaved:"נקודת ההשוואה נשמרה",baselineCleared:"נקודת ההשוואה נוקתה",deployTitle:'פריסת "{name}" לעמדות',deployStations:"עמדות",deployStep1:"בחירת עמדות ומשבצות",deployStep2:"בדיקה מקדימה",deployStep3:"אישור ופריסה",slotsTitle:"משבצות בעמדה",slotsHint:"מספרי המשבצות בעמדה ללוח הזמנים. הטווח לפי מה שהעמדה דיווחה",slotTemplate:"תבנית",slotWeekly:"שבוע",slotGroup:"קבוצת חגים",slotHoliday:"חג {n}",range:"טווח {a}-{b}",readStation:"קריאת העמדה",reading:"קורא את העמדה… (עד שתי דקות)",previewRun:"בדיקה מקדימה",previewAll:"בדיקה מקדימה לכל העמדות",impactTitle:"מה ייפגע",impactStation:"עמדה: {name}",impactDoors:"דלתות: {doors}",impactNoDoors:"לעמדה אין דלתות מנוהלות",impactPeople:"{explicit} אנשים עם לוח זמנים משלהם · {implicit} לפי ברירת המחדל של העמדה · {read} נקראו",impactPeopleUnknown:"לא ידוע כמה אנשים בעמדה (הקריאה נכשלה)",conflictsTitle:"התנגשויות",resourceRow:"{kind} {id}: {state}",externalRef:"בשימוש מחוץ להצעה",activeRes:"פעיל בעמדה",blockersTitle:"חוסמים",savePlans:"שמירת ההצעות",plansSaved:"נשמרו {n} הצעות פריסה",deployNow:"פריסה",confirmDeployTitle:"לפרוס ל־{n} עמדות?",confirmDeploy:"לכל עמדה תיווצר עבודת פריסה והבדיקה שלה תרוץ ברקע. ייכתב לעמדה רק מה שהמערכת מאשרת.",progressTitle:"התקדמות הפריסה",progressDone:"הפריסה הסתיימה",progressRunning:"בודק את העמדות…",jobLine:"{station}: {status}",writesOff:'WisKey עדיין לא מאשר כתיבה של לוחות זמנים לעמדות - כל עבודה תיעצר ב"חסום" ולא ייכתב דבר לעמדה.',deployWritesOff:'שימו לב: כרגע פריסה לא משנה דבר בעמדות. WisKey עדיין לא הפעיל כתיבה של לוחות זמנים לעמדות, ולכן פריסה רק יוצרת עבודה ומריצה בדיקה מקדימה. העבודה תיעצר במצב "חסום" ושום דבר לא ייכתב לעמדה. ההודעה תיעלם כש־WisKey יפעיל את הכתיבה.',confirmDeployWritesOff:'כרגע WisKey לא כותב לוחות זמנים לעמדות: העבודות ייווצרו וייבדקו, ייעצרו במצב "חסום", ושום דבר לא ייכתב לעמדות.',jobsTitle:"עבודות פריסה",jobsEmpty:"אין עבודות פריסה",sx_title:"מצב הביצוע ב־WisKey",sx_hint:"האישור וההרצה של לוח זמנים על העמדות נעשים רק במסך של WisKey, על ידי בעל המערכת. כאן רואים את המצב בלבד - Arx לא מאשר ולא מריץ.",sx_switch:"הצגת מצב הביצוע מ־WisKey",sx_switchOffHint:"כבוי: לא נקרא דבר מ־WisKey והמסך נשאר כפי שהיה.",sx_unsupported:"WisKey המחובר לא מציע קריאת מצב ביצוע לחיבור של Arx. לא נשלח דבר.",sx_unavailable:"החיבור החתום ל־WisKey אינו פעיל כרגע. לא נשלח דבר.",sx_failed:"לא הצלחנו לקרוא את ההגדרה. נסו לרענן.",sx_loading:"בודק…",sx_check:"בדיקת מצב",sx_none:"אין עבודות פריסה לבדיקה.",sx_more:"ועוד {n} עבודות - הבדיקה מוצגת לחמש האחרונות.",sx_readAt:"נבדק {t}",sx_statusFailed:"בדיקת המצב לא הצליחה ({reason}). מה שידוע קודם נשאר כמו שהוא.",sx_steps:"{v} מתוך {n} שלבים אומתו",sx_p_not_read:"לא נבדק",sx_p_waiting_owner:"ממתין לבעל המערכת",sx_p_review_pending:"ממתין לאישור",sx_p_approved:"אושר, טרם הורץ",sx_p_rejected:"האישור נדחה",sx_p_executing:"בהרצה",sx_p_attention:"נדרש טיפול",sx_p_executed:"הורץ ואומת",sx_p_failed:"נכשל",sx_p_cancelled:"בוטל",sx_p_not_found:"לא נמצא",sx_p_unknown:"לא ידוע",sx_h_not_read:"עוד לא נבדק מול WisKey.",sx_h_waiting_owner:"העבודה נמצאת ב־WisKey. השלב הבא - אישור והרצה - הוא של בעל המערכת במסך של WisKey.",sx_h_review_pending:"במסך של WisKey ממתינה בקשה לאישור נוסף של העבודה הזו.",sx_h_approved:"העבודה אושרה במסך של WisKey ועדיין לא הורצה.",sx_h_rejected:"האישור נדחה במסך של WisKey. לא נכתב דבר לעמדה.",sx_h_executing:"WisKey מריץ את העבודה על העמדה.",sx_h_attention:"ההרצה נקטעה או דורשת התאוששות - ההחלטה במסך של WisKey.",sx_h_executed:"WisKey מדווח שכל השלבים נכתבו ונקראו בחזרה מהעמדה.",sx_h_failed:"ההרצה נכשלה.",sx_h_cancelled:"העבודה בוטלה ב־WisKey.",sx_h_not_found:"WisKey לא מכיר את העבודה הזו (אולי הועברה לארכיון).",sx_h_unknown:"אי אפשר לדעת כרגע. רק בדיקת מצב נוספת של אותה עבודה תכריע.",sx_writesOwnerOnly:"שימו לב: פריסה ב־Arx רק יוצרת עבודה ומריצה בדיקה מקדימה. לוח הזמנים נכתב לעמדה רק אחרי שבעל המערכת מאשר ומריץ את העבודה במסך של WisKey.",jobRecheck:"בדיקה שוב",jobCancel:"ביטול",jobArchive:"לארכיון",plansTitle:"הצעות פריסה",planRecheck:"בדיקה חוזרת",planDelete:"מחיקת ההצעה",planClaim:"לקיחת אחריות",planRelease:"שחרור אחריות",claimed:"באחריות Arx",confirmPlanDelete:"למחוק את הצעת הפריסה ל־{station}?",confirmClaimTitle:"לקחת אחריות על המשבצות?",confirmClaim:"המשבצות {keys} בעמדה {station} יסומנו כמנוהלות מכאן. זו הצהרה בלבד: היא לא כותבת לעמדה.",confirmRelease:"לשחרר את האחריות על המשבצות?",confirmRecheck:"לקרוא שוב את העמדה ולעדכן את ההצעה?",confirmJob:'לבצע "{action}" לעבודה של {station}?',done:"בוצע",st_queued:"בתור",st_refused:"נדחה",st_unknown:"לא ידוע אם בוצע",st_not_sent:"לא נשלח",refusedBy:"WisKey סירב: {reason}",notSent:"לא נשלח: {reason}",unknownOutcome:"נשלח ולא התקבלה תשובה ברורה - ייתכן שבוצע. רעננו ובדקו לפני שמנסים שוב.",noStations:"אין עמדות מחוברות",offline:"לא מחוברת",stationsPicked:"עמדות שנבחרו: {n}",stale:"הנתונים אינם עדכניים - רעננו לפני שינוי",forbidden:"אין לך הרשאה לנהל את ספריית לוחות הזמנים",sr_title:"קריאות לוחות זמנים מהעמדה",sr_hint:"קריאה בלבד: WisKey קורא את העמדה ברקע ו־Arx בודק את המצב. שום דבר לא נכתב לעמדה, ו־Arx אינו מפעיל לוחות זמנים בעמדות.",sr_unsupported:"גרסת WisKey המחוברת אינה מציעה קריאות חתומות של לוחות זמנים - לא נשלח דבר.",sr_unavailable:"החיבור החתום ל־WisKey אינו זמין כרגע - לא נשלח דבר.",sr_failed:"לא ניתן היה לטעון את הקריאות.",sr_loading:"טוען…",sr_station:"עמדה",sr_readiness:"קריאת מוכנות",sr_dependencies:"קריאת תלויות",sr_check:"בדיקת מצב",sr_none:"עדיין לא נקראה עמדה.",sr_more:"ועוד {n} קודמות",sr_a_readiness:"מוכנות העמדה",sr_a_dependencies:"תלויות בעמדה",sr_a_assess:"התאמה לעמדה",sr_a_plan_preview:"הצעת פריסה",sr_a_plan_recheck:"בדיקה חוזרת של הצעה",sr_a_claim_preview:"בדיקת אחריות",sr_s_sending:"נשלח כעת",sr_s_not_sent:"לא נשלח",sr_s_accepted:"התקבל, ממתין",sr_s_running:"בקריאה",sr_s_completed:"הושלם",sr_s_refused:"WisKey סירב",sr_s_unknown:"לא ידוע",sr_unknownHint:"לא ידוע אם הקריאה התחילה - רק בדיקת מצב יכולה לומר. הבקשה לא תישלח שוב.",sr_sumReadiness:"{readable} מתוך {total} סוגים נקראו",sr_sumDependencies:"{users} משתמשים נקראו בעמדה",sr_sumPlan:"גרסת ההצעה שהוחזרה: {revision}",sr_sumDone:"התקבלה תשובה",sr_sumNoData:"הושלם, אך התשובה לא הייתה קריאה",sr_statusFailed:"בדיקת המצב לא הצליחה: {reason}"},qe=Ve("en","i18n/schedule-editor","en");function qs(){return Je(["en"])}function n(e,s){const t=(qs()==="en"?qe[e]:void 0)??Me[e];return Ue(t,s)}const K={Sunday:"ראשון",Monday:"שני",Tuesday:"שלישי",Wednesday:"רביעי",Thursday:"חמישי",Friday:"שישי",Saturday:"שבת"},Fs={Sunday:"א׳",Monday:"ב׳",Tuesday:"ג׳",Wednesday:"ד׳",Thursday:"ה׳",Friday:"ו׳",Saturday:"ש׳"},Hs={template:"תבנית",weekly:"שבוע",holiday_group:"קבוצת חגים",holiday:"חג"},Ks={matches:"תואם",different:"שונה בעמדה",not_observed:"לא קיים בעמדה",unreadable:"לא נקרא",unsupported:"לא נתמך"},Bs={missing:"אין",unchanged:"ללא שינוי",changed:"השתנה בעמדה",incomplete:"חלקי",identity_changed:"העמדה הוחלפה",unavailable:"לא זמין"},Ee={pending:"ממתין",queued:"בתור",checking:"בבדיקה",blocked:"חסום",ready:"מוכן",interrupted:"נקטע",failed:"נכשל",cancelled:"בוטל",verified:"אומת"},Us={template_resources:"תבניות",weekly_resources:"שבועות",holiday_group_resources:"קבוצות חגים",holiday_resources:"חגים",weekly_per_day:"חלונות ביום",weekly_periods:"חלונות בשבוע",weekly_precision:"דיוק השעות",holiday_per_day:"חלונות בחג",holiday_periods:"חלונות בחג",holiday_precision:"דיוק שעות החג",weekdays:"ימים",holiday_membership:"חגים בקבוצה"},Js={unauthorized:"לחשבון השירות של Arx אין הרשאת ניהול לוחות זמנים ב־WisKey",revision_conflict:"מישהו אחר שינה את הרשומה בינתיים",schedule_not_found:"לוח הזמנים לא נמצא",schedule_limit:"הספרייה מלאה (עד 100)",schedule_invalid_time:"שעה לא תקינה או סיום לפני התחלה",schedule_overlap:"חלונות חופפים באותו יום",schedule_period_limit:"יותר מ־8 חלונות ביום",schedule_invalid_week:"השבוע חייב לכלול את שבעת הימים",schedule_invalid_date:"תאריך לא תקין (2000-2037, התחלה לפני סוף)",schedule_holiday_limit:"יותר מ־64 תאריכים מיוחדים",schedule_holiday_overlap:"תאריכים מיוחדים חופפים",invalid_text:"שם ריק או ארוך מ־32 תווים",schedule_transfer_invalid:"הקובץ אינו קובץ ייצוא תקין",schedule_import_expired:"הבדיקה פגה או הוחלפה",schedule_plan_expired:"הבדיקה פגה או הוחלפה",schedule_claim_expired:"הבדיקה פגה או הוחלפה",schedule_baseline_expired:"הבדיקה פגה או הוחלפה",schedule_preview_required:"הבדיקה המקדימה חסרה או פגה",schedule_plan_resource_reserved:"המשבצות שמורות להצעה אחרת",schedule_binding_invalid:"מספרי משבצות לא תקינים",schedule_binding_out_of_range:"משבצת מחוץ לטווח של העמדה",schedule_compilation_limit:"חורג מיכולות העמדה",schedule_compilation_unknown:"העמדה לא דיווחה על יכולותיה",schedule_claim_conflict:"המשבצות כבר באחריות הצעה אחרת",schedule_claim_in_use:"עבודת פריסה פעילה משתמשת באחריות",schedule_operation_exists:"כבר קיימת עבודת פריסה להצעה",schedule_operation_retained:"העבודה עדיין רצה או אינה במצב סופי",schedule_source_changed:"לוח הזמנים השתנה מאז ההצעה",schedule_plan_device_changed:"העמדה הוחלפה מאז ההצעה",schedule_read_busy:"העמדה כבר נקראת",schedule_writes_unverified:"כתיבה לעמדה עדיין לא אומתה ב־WisKey",schedule_ownership_unknown:"לא הוצהרה אחריות על המשבצות",schedule_ownership_changed:"המשבצות השתנו מאז ההצהרה",schedule_inventory_incomplete:"קריאת העמדה לא הושלמה",schedule_plan_users_unreadable:"לא ניתן היה לקרוא את המשתמשים בעמדה",schedule_plan_user_defaults:"יש בעמדה משתמשים לפי ברירת מחדל",schedule_plan_external_references:"המשבצות בשימוש מחוץ להצעה",schedule_plan_capabilities_changed:"יכולות העמדה השתנו",schedule_plan_active_resources:"המשבצות פעילות בעמדה",schedule_plan_observation_incomplete:"חלק מהמשבצות לא נקראו",schedule_plan_holiday_membership_unknown:"לא ידוע כמה חגים קבוצה מקבלת",station_offline:"העמדה אינה מחוברת",connection_failed:"העמדה לא ענתה בזמן",authentication_failed:"העמדה דחתה את פרטי ההתחברות",schedule_operation_failed:"הבדיקה המוקדמת נכשלה",schedule_operation_interrupted:"הבדיקה נקטעה"},m=e=>e&&Js[e]||e||"";Ye("i18n/schedule-editor",{he:Me,en:qe});var Vs=Object.defineProperty,Ys=Object.getOwnPropertyDescriptor,M=(e,s,t,a)=>{for(var i=a>1?void 0:a?Ys(s,t):s,r=e.length-1,l;r>=0;r--)(l=e[r])&&(i=(a?l(s,t,i):l(i))||i);return a&&i&&Vs(s,t,i),i};let D=class extends V{constructor(){super(...arguments),this.faults=[],this.narrow=!1,this.today="2026-01-01",this.disabled=!1}emit(e){this.dispatchEvent(new CustomEvent("draft-change",{detail:e,bubbles:!0,composed:!0}))}fault(e){const s=y(this.faults,e);return s?o`<span class="err" role="alert" data-se-fault=${e}>${m(s.code)}</span>`:d}render(){const e=this.draft;if(!e)return d;const s=!!y(this.faults,"name");return o`
      <div class="sec">
        <label class="field name">${n("name")}
          <input data-se-name maxlength="32" .value=${e.name} placeholder=${n("namePlaceholder")} aria-invalid=${String(s)} ?disabled=${this.disabled}
            @input=${t=>this.emit({...e,name:t.target.value})} />
        </label>
        ${this.fault("name")}
      </div>
      <div class="sec" data-se-week>
        <h4><sw-icon name="calendar" size=${14}></sw-icon>${n("weekTitle")}<span class="sum" data-se-hours>${n("summaryHours",{h:Math.round(Le(e.weekly)/60*10)/10})}</span></h4>
        ${this.narrow?d:o`<sw-week-grid data-se-grid ?editable=${!this.disabled} .days=${We(e.weekly)} .modes=${[{id:"on",label:n("weekTitle"),color:"var(--sw-accent)"}]}
                @change=${t=>this.emit({...e,weekly:Ls(t.detail.days,e.weekly)})}></sw-week-grid>
              <p class="hint">${n("gridHint")}</p>`}
        <div class="days">${Ts.map(t=>this.renderDay(t))}</div>
      </div>
      <div class="sec" data-se-holidays>
        <h4><sw-icon name="star" size=${14}></sw-icon>${n("holidaysTitle")}<span class="sum">${e.holidays.length||""}</span></h4>
        <p class="hint">${n("holidaysHint")}</p>
        ${this.fault("holidays")}
        ${e.holidays.map((t,a)=>this.renderHoliday(a))}
        <div><wk-action-button tone="dashed" icon="plus" data-se-add-holiday ?disabled=${this.disabled||e.holidays.length>=64}
          @click=${()=>this.emit(Cs(e,this.today))}>${n("addHoliday")}</wk-action-button></div>
      </div>
    `}renderDay(e){const s=this.draft,t=s.weekly[e]??[],a=this.narrow?Fs[e]:K[e];return o`<div class="day" data-se-day=${e}>
      <span class="dn" title=${K[e]}>${a}</span>
      <div class="wins">
        ${t.length?d:o`<span class="closed">${n("closedDay")}</span>`}
        ${t.map((i,r)=>{const l=!!y(this.faults,`weekly.${e}.${r}`);return o`<span class="win" data-se-win=${`${e}.${r}`} ?data-bad=${l}>
            <input type="time" lang=${j()} step="60" aria-label=${`${K[e]} ${n("from")}`} .value=${i.start} ?disabled=${this.disabled} data-se-start
              @change=${p=>this.emit(ze(s,e,r,"start",p.target.value))} />
            <span aria-hidden="true">–</span>
            <input type="time" lang=${j()} step="60" aria-label=${`${K[e]} ${n("to")}`} .value=${i.end==="24:00"?"23:59":i.end} ?disabled=${this.disabled} data-se-end
              @change=${p=>{const b=p.target.value;this.emit(ze(s,e,r,"end",b==="23:59"&&i.end==="24:00"?"24:00":b))}} />
            <button class="x" type="button" aria-label=${n("removeWindow")} data-se-remove-win ?disabled=${this.disabled} @click=${()=>this.emit(Ns(s,e,r))}><sw-icon name="close" size=${14}></sw-icon></button>
          </span>`})}
        <button class="x" type="button" aria-label=${`${n("addWindow")} · ${K[e]}`} title=${n("addWindow")} data-se-add-win=${e}
          ?disabled=${this.disabled||t.length>=se} @click=${()=>this.emit(Is(s,e))}><sw-icon name="plus" size=${16}></sw-icon></button>
        ${e==="Sunday"&&t.length?o`<wk-action-button tone="quiet" icon="copy" data-se-copy ?disabled=${this.disabled} @click=${()=>this.emit(Ps(s,"Sunday",zs))}>${n("copyTo")}</wk-action-button>`:d}
        ${this.fault(`weekly.${e}`)}
      </div>
    </div>`}renderHoliday(e){const s=this.draft,t=s.holidays[e],a=`holidays.${e}`;return o`<div class="hol" data-se-holiday=${e}>
      <label class="field hn">${n("holidayName")}
        <input maxlength="32" .value=${t.name} aria-invalid=${String(!!y(this.faults,`${a}.name`))} ?disabled=${this.disabled} data-se-hname
          @input=${i=>this.emit(E(s,e,{name:i.target.value}))} />
      </label>
      <label class="field">${n("holidayFrom")}
        <input type="date" lang=${j()} .value=${t.start} aria-invalid=${String(!!y(this.faults,`${a}.start`))} ?disabled=${this.disabled} data-se-hstart
          @change=${i=>this.emit(E(s,e,{start:i.target.value}))} />
      </label>
      <label class="field">${n("holidayTo")}
        <input type="date" lang=${j()} .value=${t.end} aria-invalid=${String(!!y(this.faults,`${a}.end`))} ?disabled=${this.disabled} data-se-hend
          @change=${i=>this.emit(E(s,e,{end:i.target.value}))} />
      </label>
      <button class="x" type="button" aria-label=${n("removeHoliday")} data-se-remove-holiday ?disabled=${this.disabled} @click=${()=>this.emit(Ws(s,e))}><sw-icon name="trash" size=${16}></sw-icon></button>
      <div class="wins">
        ${t.periods.length?d:o`<span class="closed">${n("holidayClosed")}</span>`}
        ${t.periods.map((i,r)=>o`<span class="win" ?data-bad=${!!y(this.faults,`${a}.periods.${r}`)}>
          <input type="time" lang=${j()} step="60" aria-label=${`${t.name} ${n("from")}`} .value=${i.start} ?disabled=${this.disabled}
            @change=${l=>this.emit(E(s,e,{periods:t.periods.map((p,b)=>b===r?{...p,start:l.target.value}:p)}))} />
          <span aria-hidden="true">–</span>
          <input type="time" lang=${j()} step="60" aria-label=${`${t.name} ${n("to")}`} .value=${i.end==="24:00"?"23:59":i.end} ?disabled=${this.disabled}
            @change=${l=>this.emit(E(s,e,{periods:t.periods.map((p,b)=>b===r?{...p,end:l.target.value}:p)}))} />
          <button class="x" type="button" aria-label=${n("removeWindow")} ?disabled=${this.disabled}
            @click=${()=>this.emit(E(s,e,{periods:t.periods.filter((l,p)=>p!==r)}))}><sw-icon name="close" size=${14}></sw-icon></button>
        </span>`)}
        <button class="x" type="button" aria-label=${n("addWindow")} data-se-add-hwin ?disabled=${this.disabled||t.periods.length>=se}
          @click=${()=>this.emit(E(s,e,{periods:[...t.periods,t.periods.length?{start:t.periods[t.periods.length-1].end==="24:00"?"23:00":t.periods[t.periods.length-1].end,end:"24:00"}:{start:"08:00",end:"13:00"}]}))}>
          <sw-icon name="plus" size=${16}></sw-icon></button>
        ${this.fault(`${a}.periods`)} ${this.fault(`${a}.start`)} ${this.fault(`${a}.end`)} ${y(this.faults,a)&&!y(this.faults,`${a}.start`)&&!y(this.faults,`${a}.end`)&&!y(this.faults,`${a}.periods`)&&!y(this.faults,`${a}.name`)?this.fault(a):d}
      </div>
    </div>`}};D.styles=J`
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
  `;M([$({attribute:!1})],D.prototype,"draft",2);M([$({attribute:!1})],D.prototype,"faults",2);M([$({type:Boolean})],D.prototype,"narrow",2);M([$()],D.prototype,"today",2);M([$({type:Boolean,reflect:!0})],D.prototype,"disabled",2);D=M([Y("wk-schedule-draft-form")],D);const q="access-control/schedules",Gs=15e3;function Fe(){return{confirmed:!0,client_request_id:Qe(),expires_at:Xe(Ze()+Gs)}}const F=(e,s)=>L(`${q}/actions/${e}`,s),k=(e,s)=>L(`${q}/actions/${e}`,{...s,...Fe()}),Xs=(e,s,t)=>F("check",{data:e,date:s,time:t}),Zs=(e,s)=>k("create",{data:e,check_id:s}),Qs=(e,s,t,a)=>k("update",{schedule_id:e,revision:s,data:t,check_id:a}),et=(e,s)=>k("delete",{schedule_id:e,revision:s}),st=e=>F("import_preview",{document:e}),tt=e=>k("import_apply",{preview_id:e}),at=()=>R(`${q}/export`),it=e=>F("readiness",{station_id:e}),nt=(e,s)=>F("assess",{station_id:e,data:s}),ot=(e,s)=>k("baseline_save",{station_id:e,preview_id:s}),rt=(e,s)=>k("baseline_clear",{station_id:e,revision:s}),lt=(e,s,t,a)=>F("plan_preview",{station_id:e,schedule_id:s,revision:t,bindings:a}),dt=e=>k("plan_save",{preview_id:e}),ct=(e,s)=>k("plan_recheck",{plan_id:e,revision:s}),ht=(e,s)=>k("plan_delete",{plan_id:e,revision:s}),pt=(e,s)=>F("claim_preview",{plan_id:e,revision:s}),ut=e=>k("claim_confirm",{preview_id:e}),wt=(e,s)=>k("claim_release",{claim_id:e,revision:s}),ft=e=>L(`${q}/actions/deploy`,{plans:e,...Fe()}),mt=(e,s,t)=>k(e,{job_id:s,revision:t}),bt=e=>R(`${q}/jobs${e.length?"?"+e.map(s=>`ids=${encodeURIComponent(s)}`).join("&"):""}`),vt=()=>R(`${q}/claims`);function z(e){if(e instanceof re){const s=e.body?.details??{},t=String(s.outcome??""),a=t==="refused"?"refused":t==="not_sent"?"not_sent":t==="unknown"?"unknown":[400,403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",i=Number(s.retry_after_s);return{status:a,code:String(s.wiskey_code??e.body?.code??"")||null,message:e.body?.user_message||e.message,field:Ge(e)[0]??null,retryAfter:Number.isFinite(i)&&i>=0?i:null}}return{status:"unknown",code:"network",message:"",field:null,retryAfter:null}}const ue="access-control/schedules/reads",gt=()=>R(ue),$t=(e,s)=>L(ue,{action:e,parameters:s}),yt=e=>L(`${ue}/${encodeURIComponent(e)}/status`),kt=["sending","not_sent","accepted","running","completed","refused","unknown"],_t=5;function we(e){return kt.includes(e??"")?e:"unknown"}function xt(e){switch(we(e)){case"completed":return"live";case"accepted":case"running":case"sending":return"neutral";case"refused":return"error";case"not_sent":return"offline";default:return"unknown"}}function U(e,s=!1){return s?"failed":e?e.state==="supported"||e.state==="unsupported"?e.state:"unavailable":"loading"}function St(e,s,t,a){return U(e)==="supported"&&s&&!t&&a===!0}function Tt(e,s,t){return e.can_check===!0&&!e.final&&U(s)==="supported"&&!0}const zt=e=>typeof e=="number"&&Number.isFinite(e)?e:null;function At(e){if(we(e.state)!=="completed")return null;const s=e.data;if(!s)return{key:"sumNoData",vars:{}};if(e.action==="readiness"){const t=Array.isArray(s.checks)?s.checks:[];return{key:"sumReadiness",vars:{readable:t.filter(i=>i&&i.read_state==="readable").length,total:t.length}}}if(e.action==="dependencies"){const t=s.users??null,a=zt(t?.read);return{key:"sumDependencies",vars:{users:a===null?"?":a}}}return e.plan_revision!==null&&e.plan_revision!==void 0?{key:"sumPlan",vars:{revision:e.plan_revision}}:{key:"sumDone",vars:{}}}function Ot(e,s=_t){const t=[...e??[]].sort((a,i)=>a.created_at<i.created_at?1:a.created_at>i.created_at?-1:0);return{rows:t.slice(0,s),more:Math.max(0,t.length-s)}}var jt=Object.defineProperty,Dt=Object.getOwnPropertyDescriptor,O=(e,s,t,a)=>{for(var i=a>1?void 0:a?Dt(s,t):s,r=e.length-1,l;r>=0;r--)(l=e[r])&&(i=(a?l(s,t,i):l(i))||i);return a&&i&&jt(s,t,i),i};const Rt={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"};let x=class extends V{constructor(){super(...arguments),this.stations=[],this.live=!0,this.support=null,this.reads=[],this.failed=!1,this.station="",this.busy=null,this.note=null}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(e){e.has("stations")&&!this.stations.some(s=>s.id===this.station&&s.online)&&(this.station=this.stations.find(s=>s.online)?.id??"")}async load(){try{const e=await gt();this.support=e.support,this.reads=e.reads,this.failed=!1}catch{this.failed=!0}}merge(e){e&&(this.reads=[e,...this.reads.filter(s=>s.request_id!==e.request_id)])}async start(e){if(!(!this.station||this.busy)){this.busy=e,this.note=null;try{const s=await $t(e,{station_id:this.station});this.support=s.support,this.merge(s.read)}catch(s){const t=z(s);this.note=t.message||m(t.code)}finally{this.busy=null}}}async check(e){if(!this.busy){this.busy=`check:${e.request_id}`,this.note=null;try{const s=await yt(e.request_id);this.support=s.support,this.merge(s.read);const t=s.status_read;t&&t.outcome!=="ok"&&t.outcome!=="not_needed"&&(this.note=n("sr_statusFailed",{reason:m(t.code)||t.outcome}))}catch(s){const t=z(s);this.note=n("sr_statusFailed",{reason:t.message||m(t.code)})}finally{this.busy=null}}}stationName(e){return this.stations.find(s=>s.id===e)?.name??e}supportLine(){const e=U(this.support,this.failed);return e==="supported"?d:o`<p class=${e==="loading"?"s":"warn"} role="status" data-sr-support=${e}>${n(e==="unsupported"?"sr_unsupported":e==="unavailable"?"sr_unavailable":e==="failed"?"sr_failed":"sr_loading")}</p>`}render(){const e=U(this.support,this.failed)==="supported",s=this.stations.filter(l=>l.online),t=this.stations.find(l=>l.id===this.station)??null,a=St(this.support,this.live,!!this.busy,t?!!t.online:null),{rows:i,more:r}=Ot(this.reads);return o`<sw-card>
      <div class="block" data-sr data-sr-state=${U(this.support,this.failed)}>
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
    </sw-card>`}renderRow(e){const s=we(e.state),t=At(e),a=s==="unknown"?n("sr_unknownHint"):s==="refused"||s==="not_sent"?m(e.wiskey_code):t?n(`sr_${t.key}`,t.vars):"",i=e.action==="plan_recheck"||e.action==="claim_preview"?(e.subject??"").slice(0,8):this.stationName(e.subject);return o`<div class="row" data-sr-read=${e.request_id} data-state=${s}>
      <div class="main">
        <span class="t">${n(`sr_a_${e.action}`)} · ${i}</span>
        ${a?o`<span class="s">${a}</span>`:d}
      </div>
      <sw-badge kind=${Rt[xt(s)]} label=${n(`sr_s_${s}`)}></sw-badge>
      ${Tt(e,this.support)?o`<wk-action-button tone="quiet" icon="refresh" data-sr-check=${e.request_id} ?busy=${this.busy===`check:${e.request_id}`}
            ?disabled=${!!this.busy} @click=${()=>void this.check(e)}>${n("sr_check")}</wk-action-button>`:d}
    </div>`}};x.styles=J`
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
  `;O([$({attribute:!1})],x.prototype,"stations",2);O([$({type:Boolean})],x.prototype,"live",2);O([h()],x.prototype,"support",2);O([h()],x.prototype,"reads",2);O([h()],x.prototype,"failed",2);O([h()],x.prototype,"station",2);O([h()],x.prototype,"busy",2);O([h()],x.prototype,"note",2);x=O([Y("wk-schedule-reads")],x);const fe="access-control/schedules/execution",Et=()=>R(fe),It=e=>L(`${fe}/${encodeURIComponent(e)}/status`),Nt=e=>es(`${fe}/settings`,{enabled:e}),Pt=["waiting_owner","review_pending","approved","rejected","executing","attention","executed","failed","cancelled","not_found","unknown","not_read"],Ct=5;function Wt(e){return e?Pt.includes(e.phase)?e.phase:"unknown":"not_read"}function Lt(e){switch(e){case"executed":return"live";case"waiting_owner":case"review_pending":case"attention":return"stale";case"rejected":case"failed":return"error";case"cancelled":case"not_found":return"offline";case"approved":case"executing":case"not_read":return"neutral";default:return"unknown"}}function He(e,s=!1){return s?"failed":e?e.state==="supported"||e.state==="unsupported"||e.state==="off"?e.state:"unavailable":"loading"}function Mt(e,s,t){return!s?.enabled||He(s.support)!=="supported"||t?!1:!e?.final}function qt(e){const s=e.slice(0,Ct);return{rows:s,more:Math.max(0,e.length-s.length)}}function Ft(e){return!!e?.enabled&&(e.jobs??[]).some(s=>s.phase==="executed")}var Ht=Object.defineProperty,Kt=Object.getOwnPropertyDescriptor,N=(e,s,t,a)=>{for(var i=a>1?void 0:a?Kt(s,t):s,r=e.length-1,l;r>=0;r--)(l=e[r])&&(i=(a?l(s,t,i):l(i))||i);return a&&i&&Ht(s,t,i),i};const Bt={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"};let A=class extends V{constructor(){super(...arguments),this.stations=[],this.jobs=[],this.view=null,this.failed=!1,this.busy=null,this.note=null}connectedCallback(){super.connectedCallback(),this.hidden=!0,this.load()}willUpdate(){const e=this.view;this.hidden=this.failed?!e?.can_configure:!e||!e.enabled&&!e.can_configure}set(e){this.view=e,this.failed=!1,this.dispatchEvent(new CustomEvent("sx-change",{detail:{executed:Ft(e)},bubbles:!0,composed:!0}))}async load(){try{this.set(await Et())}catch{this.view=null,this.failed=!0}}async toggle(e){if(!this.busy){this.busy="switch",this.note=null;try{this.set(await Nt(e))}catch(s){const t=z(s);this.note=t.message||m(t.code)}finally{this.busy=null}}}async check(e){const s=this.view;if(!(this.busy||!s)){this.busy=`check:${e}`,this.note=null;try{const t=await It(e),a=t.job?[t.job,...s.jobs.filter(r=>r.job_id!==e)]:s.jobs;this.set({...s,support:t.support,jobs:a});const i=t.status_read;i.outcome!=="ok"&&i.outcome!=="not_needed"&&(this.note=n("sx_statusFailed",{reason:m(i.code)||i.outcome}))}catch(t){const a=z(t);this.note=n("sx_statusFailed",{reason:a.message||m(a.code)})}finally{this.busy=null}}}stationName(e){return this.stations.find(s=>s.id===e)?.name??e??"—"}readOf(e){return this.view?.jobs.find(s=>s.job_id===e)??null}switchRow(){const e=this.view;return e.can_configure?o`<sw-toggle data-sx-switch size="sm" label=${n("sx_switch")} ?checked=${e.enabled} ?disabled=${this.busy==="switch"}
      @change=${s=>void this.toggle(s.detail.checked===!0)}></sw-toggle>`:d}render(){const e=this.view;if(this.failed)return e?.can_configure?o`<p class="warn" role="status" data-sx-failed>${n("sx_failed")}</p>`:d;if(!e)return d;if(!e.enabled)return e.can_configure?o`<sw-card>
        <div class="block" data-sx data-sx-state="off">
          <div class="bh"><h3>${n("sx_title")}</h3><span class="sp"></span>${this.switchRow()}</div>
          <p class="hint">${n("sx_switchOffHint")}</p>
          ${this.note?o`<p class="warn" role="status" data-sx-note>${this.note}</p>`:d}
        </div>
      </sw-card>`:d;const s=He(e.support),{rows:t,more:a}=qt(this.jobs);return o`<sw-card>
      <div class="block" data-sx data-sx-state=${s}>
        <div class="bh"><h3>${n("sx_title")}</h3><span class="sp"></span>${this.switchRow()}</div>
        <p class="hint">${n("sx_hint")}</p>
        ${s==="unsupported"||s==="unavailable"?o`<p class="warn" role="status" data-sx-support=${s}>${n(s==="unsupported"?"sx_unsupported":"sx_unavailable")}</p>`:d}
        ${this.note?o`<p class="warn" role="status" data-sx-note>${this.note}</p>`:d}
        ${t.length?o`<div class="rows">${t.map(i=>this.renderRow(i))}</div>`:o`<p class="s" data-sx-none>${n("sx_none")}</p>`}
        ${a?o`<p class="s" data-sx-more>${n("sx_more",{n:a})}</p>`:d}
      </div>
    </sw-card>`}renderRow(e){const s=this.readOf(e.id),t=Wt(s),a=[n(`sx_h_${t}`)];s?.code&&t!=="executed"&&a.push(m(s.code)),s&&s.steps_total>0&&a.push(n("sx_steps",{v:s.steps_verified,n:s.steps_total}));const i=Mt(s,this.view,!!this.busy);return o`<div class="row" data-sx-job=${e.id} data-phase=${t}>
      <div class="main">
        <span class="t">${e.name??"—"} · ${this.stationName(e.station_id)}</span>
        <span class="s">${a.filter(Boolean).join(" · ")}</span>
      </div>
      <sw-badge kind=${Bt[Lt(t)]} label=${n(`sx_p_${t}`)}></sw-badge>
      ${s?.final?d:o`<wk-action-button tone="quiet" icon="refresh" data-sx-check=${e.id} ?busy=${this.busy===`check:${e.id}`} ?disabled=${!i}
            @click=${()=>void this.check(e.id)}>${n("sx_check")}</wk-action-button>`}
    </div>`}};A.styles=J`
    :host {
      display: block;
    }
    /* nothing to show (off for a user without the switch right, not loaded, failed): no box at all, so the library's flex gap stays
       exactly as before this block existed */
    :host([hidden]) {
      display: none;
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
    .rows {
      display: flex;
      flex-direction: column;
    }
    .row {
      display: flex;
      flex-wrap: wrap; /* a narrow screen puts the badge and the check under the text */
      align-items: center;
      gap: var(--sw-s-3);
      padding-block: var(--sw-s-3);
      border-block-start: thin solid var(--sw-border);
      min-inline-size: 0;
    }
    .row:first-child {
      border-block-start: 0;
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      /* the text keeps a readable width: on a phone the badge and the check go to the next line instead of squeezing it */
      flex: 1 1 20em;
      min-inline-size: 0;
    }
    .t {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      overflow-wrap: anywhere;
    }
  `;N([$({attribute:!1})],A.prototype,"stations",2);N([$({attribute:!1})],A.prototype,"jobs",2);N([h()],A.prototype,"view",2);N([h()],A.prototype,"failed",2);N([h()],A.prototype,"busy",2);N([h()],A.prototype,"note",2);A=N([Y("wk-schedule-exec")],A);var Ut=Object.defineProperty,Jt=Object.getOwnPropertyDescriptor,f=(e,s,t,a)=>{for(var i=a>1?void 0:a?Jt(s,t):s,r=e.length-1,l;r>=0;r--)(l=e[r])&&(i=(a?l(s,t,i):l(i))||i);return a&&i&&Ut(s,t,i),i};const Ie={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"},Vt=2e3,Yt=18e4,Gt=6e4;let w=class extends V{constructor(){super(...arguments),this.stations=[],this.library=null,this.plans=null,this.ops=null,this.live=!0,this.narrow=!1,this.editing=null,this.draft=_e(),this.checkAt=Q(Date.now()),this.checked=null,this.busy=null,this.assessStation="",this.assessment=null,this.importing=null,this.deploying=null,this.targets=[],this.progress=null,this.ask=null,this.note=null,this.claims=null,this.pollTimer=0,this.pollStarted=0,this.ownerRan=!1}get writesOff(){return this.ops?.writes_enabled===!1}writesOffText(){return n(this.ownerRan?"sx_writesOwnerOnly":"deployWritesOff")}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.pollTimer)}willUpdate(e){e.has("stations")&&!this.assessStation&&(this.assessStation=this.stations.find(s=>s.online)?.id??"")}changed(){this.dispatchEvent(new CustomEvent("sched-changed",{bubbles:!0,composed:!0}))}stationName(e){return this.stations.find(s=>s.id===e)?.name??e??""}say(e,s){if(!e){this.note={tone:"ok",text:s??n("done"),code:null};return}const t=e.status==="refused"?n("refusedBy",{reason:m(e.code)||e.message}):e.status==="not_sent"?n("notSent",{reason:e.message||m(e.code)}):n("unknownOutcome");this.note={tone:e.status,text:t,code:e.code}}async run(e,s,t,a=!0){this.busy=e;try{const i=await s();return a&&(this.say(null,t),this.changed()),i}catch(i){const r=z(i);return this.say(r),a&&r.status!=="not_sent"&&this.changed(),null}finally{this.busy=null}}openEditor(e){this.editing=e,this.draft=e==="new"?_e():xe(e),this.checked=null,this.assessment=null,this.checkAt=Q(Date.now()),this.note=null}closeEditor(){this.editing=null,this.ask=null}async runCheck(){const e=te(this.draft),s=await this.run("check",()=>Xs(e,this.checkAt.date,this.checkAt.time),void 0,!1);s?.check_id&&(this.checked={draft:e,id:s.check_id,result:s.data})}checkValid(){return!!this.checked&&Ds(this.checked.draft,this.draft)}async save(){const e=this.checked,s=this.editing;if(this.ask=null,!e||!s)return;await this.run("save",()=>s==="new"?Zs(e.draft,e.id):Qs(s.id,s.revision??0,e.draft,e.id),n("saved"))?this.closeEditor():this.checked=null}async runAssess(){if(!this.assessStation)return;const e=this.assessStation,s=await this.run("assess",()=>nt(e,te(this.draft)),void 0,!1);s&&(this.assessment={station:e,data:s.data,previewId:s.baseline_preview_id??null})}async baseline(e){const s=this.assessment;if(this.ask=null,!!s)if(e==="baseline_save"&&s.previewId){const t=await this.run("baseline",()=>ot(s.station,s.previewId),n("baselineSaved"));t&&(this.assessment={...s,previewId:null,data:{...s.data,baseline:{...s.data.baseline,state:"unchanged",revision:t.data.revision}}})}else e==="baseline_clear"&&s.data.baseline.revision&&await this.run("baseline",()=>rt(s.station,s.data.baseline.revision),n("baselineCleared"))&&(this.assessment={...s,data:{...s.data,baseline:{...s.data.baseline,state:"missing",revision:0}}})}async pickFile(e){const s=e.target,t=s.files?.[0];if(s.value="",!t)return;if(t.size>Gt){this.note={tone:"not_sent",text:n("importTooLarge"),code:null};return}const a=await t.text(),i=await this.run("import",()=>st(a),void 0,!1);i?.preview_id&&(this.importing={preview:i.data,previewId:i.preview_id,file:t.name},this.ask={kind:"import"})}async applyImport(){const e=this.importing;if(this.ask=null,!e)return;const s=await this.run("import",()=>tt(e.previewId));s&&(this.note={tone:"ok",text:n("importDone",{n:s.data.length}),code:null}),this.importing=null}async exportFile(){const e=await this.run("export",()=>at(),void 0,!1);if(!e)return;const s=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),t=document.createElement("a");t.href=URL.createObjectURL(s),t.download=`schedules-${Q(Date.now()).date}.json`,t.click(),window.setTimeout(()=>URL.revokeObjectURL(t.href),1e3)}openDeploy(e){this.deploying=e,this.targets=[],this.progress=null,this.note=null}closeDeploy(){window.clearTimeout(this.pollTimer),this.deploying=null,this.targets=[],this.progress=null,this.ask=null}previousBindings(e){return(this.plans??[]).find(t=>t.station_id===e&&t.draft_id===this.deploying?.id)?.bindings??null}toggleTarget(e){const s=this.deploying;this.targets.some(t=>t.stationId===e)?this.targets=this.targets.filter(t=>t.stationId!==e):this.targets=[...this.targets,{stationId:e,readiness:null,bindings:Oe(s.holidays?.length??0,null,this.previousBindings(e)),phase:"idle",previewId:null,impact:null,plan:null,error:null}]}patchTarget(e,s){this.targets=this.targets.map(t=>t.stationId===e?{...t,...s}:t)}async readTarget(e){this.patchTarget(e.stationId,{phase:"reading",error:null});try{const s=await it(e.stationId),t=this.previousBindings(e.stationId)?e.bindings:Oe(this.deploying?.holidays?.length??0,s.data);this.patchTarget(e.stationId,{phase:"idle",readiness:s.data,bindings:t})}catch(s){this.patchTarget(e.stationId,{phase:"error",error:z(s)})}}async previewTarget(e){const s=this.deploying;this.patchTarget(e.stationId,{phase:"previewing",error:null,previewId:null,impact:null});try{const t=await lt(e.stationId,s.id,s.revision??0,e.bindings);this.patchTarget(e.stationId,{phase:"previewed",previewId:t.preview_id??null,impact:t.impact??null,plan:t.data})}catch(t){this.patchTarget(e.stationId,{phase:"error",error:z(t)})}}async previewAll(){for(const e of this.targets)e.phase==="previewed"||e.phase==="saved"||Object.keys(je(e.bindings,e.readiness)).length||await this.previewTarget(this.targets.find(s=>s.stationId===e.stationId))}async deploy(){this.ask=null,this.busy="deploy";try{for(const s of this.targets.filter(t=>t.phase==="previewed"&&t.previewId)){this.patchTarget(s.stationId,{phase:"saving"});try{const t=await dt(s.previewId);this.patchTarget(s.stationId,{phase:"saved",plan:t.data,previewId:null})}catch(t){this.patchTarget(s.stationId,{phase:"error",error:z(t),previewId:null})}}const e=this.targets.filter(s=>s.phase==="saved"&&s.plan);if(this.changed(),!e.length)return;try{const s=await ft(e.map(t=>({plan_id:t.plan.id,revision:t.plan.revision??1})));this.progress={results:s.results,jobs:Object.fromEntries(s.results.filter(t=>t.job).map(t=>[t.job.id,t.job])),done:!1,writesEnabled:null},this.pollStarted=Date.now(),this.poll()}catch(s){this.say(z(s))}}finally{this.busy=null}}async poll(){const e=this.progress;if(!e)return;const s=Object.keys(e.jobs);if(!s.length){this.progress={...e,done:!0};return}try{const t=await bt(s);if(t.jobs){const a={...e.jobs};for(const i of t.jobs)a[i.id]=i;this.progress={...e,jobs:a,done:t.done,writesEnabled:t.writes_enabled}}}catch{}!this.progress?.done&&Date.now()-this.pollStarted<Yt&&this.deploying?this.pollTimer=window.setTimeout(()=>void this.poll(),Vt):this.changed()}async loadClaims(){try{const e=await vt();this.claims=e.claims}catch{this.claims=null}}async claimPreview(e){const s=await this.run(`claim:${e.id}`,()=>pt(e.id,e.revision??0),void 0,!1);s?.preview_id&&(this.ask={kind:"claim",plan:e,previewId:s.preview_id,keys:(s.data.resource_keys??[]).filter(Boolean)})}async confirmAsk(){const e=this.ask;if(e){if(this.ask=null,e.kind==="save")return this.save();if(e.kind==="import")return this.applyImport();if(e.kind==="deploy")return this.deploy();if(e.kind==="baseline_save"||e.kind==="baseline_clear")return this.baseline(e.kind);if(e.kind==="delete"){await this.run(`delete:${e.schedule.id}`,()=>et(e.schedule.id,e.schedule.revision??0),n("deleted"));return}if(e.kind==="plan_recheck"){await this.run(`plan:${e.plan.id}`,()=>ct(e.plan.id,e.plan.revision??0));return}if(e.kind==="plan_delete"){await this.run(`plan:${e.plan.id}`,()=>ht(e.plan.id,e.plan.revision??0));return}if(e.kind==="claim"){await this.run(`claim:${e.plan.id}`,()=>ut(e.previewId)),await this.loadClaims();return}if(e.kind==="release"){await this.run(`claim:${e.claim.plan_id}`,()=>wt(e.claim.id,e.claim.revision??0)),await this.loadClaims();return}e.kind==="job"&&await this.run(`job:${e.job.id}`,()=>mt(e.action,e.job.id,e.job.revision??0))}}firstUpdated(){this.loadClaims()}render(){const e=this.library??[],s=!this.live||!!this.busy;return o`<sw-card>
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
          ${this.writesOff?o`<p class="warn" role="note" data-se-writes-off data-sx-owner-ran=${this.ownerRan?"yes":"no"}>${this.writesOffText()}</p>`:d}
          ${this.note&&!this.editing&&!this.deploying?this.renderNote():d}
          <div class="rows">${e.map(t=>this.renderScheduleRow(t))}</div>
        </div>
      </sw-card>
      ${this.renderPlans()} ${this.renderJobs()}
      <wk-schedule-reads data-se-reads .stations=${this.stations} ?live=${this.live}></wk-schedule-reads>
      <wk-schedule-exec data-se-exec .stations=${this.stations} .jobs=${this.ops?.jobs??[]}
        @sx-change=${t=>this.ownerRan=t.detail.executed}></wk-schedule-exec>
      ${this.renderEditor()} ${this.renderDeploy()} ${this.editing||this.deploying?d:this.renderAsk()}`}renderNote(){const e=this.note;return o`<p class="note" role="status" data-se-note=${e.tone} data-se-code=${e.code??""} data-tone=${e.tone}>${e.text}</p>`}plansFor(e){return(this.plans??[]).filter(s=>s.draft_id===e)}renderScheduleRow(e){const s=this.plansFor(e.id),t=Math.round(Le(xe(e).weekly)/60*10)/10,a=!this.live||!!this.busy;return o`<div class="row" data-se-row=${e.id}>
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
                <span class="s" data-se-plan-blockers>${i.map(r=>m(r)).join(" · ")}</span>
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
          ${e.map(t=>{const a=t.status??"unknown",i=Re(a),r=a==="cancelled"||a==="verified";return o`<div class="row" data-se-job=${t.id} data-status=${a}>
              <div class="main">
                <span class="t">${t.name??"—"} · ${this.stationName(t.station_id)}</span>
                <span class="s">${t.error?m(t.error):(t.blockers??[]).filter(Boolean).map(l=>m(l)).join(" · ")}</span>
              </div>
              <sw-badge kind=${Ie[De(a)]} label=${Ee[a]??a}></sw-badge>
              <div class="acts">
                ${i||r?d:o`<wk-action-button tone="quiet" icon="refresh" data-se-job-check=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"job",action:"job_check",job:t}}>${n("jobRecheck")}</wk-action-button>`}
                ${i||r?d:o`<wk-action-button tone="quiet" icon="close" data-se-job-cancel=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"job",action:"job_cancel",job:t}}>${n("jobCancel")}</wk-action-button>`}
                ${r?o`<wk-action-button tone="quiet" icon="inbox" data-se-job-archive=${t.id} ?disabled=${s} @click=${()=>this.ask={kind:"job",action:"job_archive",job:t}}>${n("jobArchive")}</wk-action-button>`:d}
              </div>
            </div>`})}
        </div>
      </div>
    </sw-card>`}renderEditor(){const e=this.editing;if(!e)return d;const s=Rs(this.draft),t=s.length===0,a=this.checkValid(),i=e==="new"?[]:this.plansFor(e.id),r=e==="new"?n("editorNew"):n("editorEdit",{name:e.name??""}),l=!!this.busy;return o`<sw-drawer modal open heading=${r} data-se-editor=${e==="new"?"new":e.id} @close=${p=>p.target===p.currentTarget&&this.closeEditor()}>
      <wk-schedule-draft-form .draft=${this.draft} .faults=${s} ?narrow=${this.narrow} today=${Q(Date.now()).date} ?disabled=${l}
        @draft-change=${p=>this.draft=p.detail}></wk-schedule-draft-form>
      <div class="panel" data-se-check>
        <h4><sw-icon name="check" size=${14}></sw-icon>${n("checkTitle")}</h4>
        <div class="line">
          <label class="f">${n("checkAt")}<input type="date" lang=${j()} .value=${this.checkAt.date} @change=${p=>this.checkAt={...this.checkAt,date:p.target.value}} /></label>
          <label class="f">&nbsp;<input type="time" lang=${j()} step="60" .value=${this.checkAt.time} @change=${p=>this.checkAt={...this.checkAt,time:p.target.value}} /></label>
          <wk-action-button icon="check" data-se-check-run ?busy=${this.busy==="check"} ?disabled=${l||!t||!this.live} @click=${()=>void this.runCheck()}>${n("checkRun")}</wk-action-button>
        </div>
        ${this.checked?o`<span class="result" role="status" data-se-check-result data-ok=${String(!!this.checked.result.within_window)}>${this.checkLine(this.checked.result)}${a?"":` · ${n("checkStale")}`}</span>`:o`<span class="s">${n("checkNeeded")}</span>`}
      </div>
      ${this.renderAssess(t)}
      ${this.note?this.renderNote():d}
      ${i.length?o`<p class="warn" data-se-affects>${n("affectsPlans",{stations:i.map(p=>this.stationName(p.station_id)).join(", ")})}</p>`:d}
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
            <ul class="plain">${t.data.assessment.limits.map(i=>o`<li data-state=${i.state??""}>${n("limitRow",{key:Us[i.key??""]??i.key??"",needed:i.needed??"—",available:i.available??"—"})}</li>`)}</ul>
            <span class="s" data-se-baseline=${t.data.baseline.state??""}>${n("baselineTitle")} · ${n("baselineState",{state:Bs[t.data.baseline.state??""]??t.data.baseline.state??"—"})}</span>
            <div class="line">
              ${t.previewId?o`<wk-action-button tone="quiet" icon="bookmark" data-se-baseline-save ?disabled=${a} @click=${()=>this.ask={kind:"baseline_save"}}>${n("baselineSave")}</wk-action-button>`:d}
              ${t.data.baseline.revision?o`<wk-action-button tone="quiet" icon="trash" data-se-baseline-clear ?disabled=${a} @click=${()=>this.ask={kind:"baseline_clear"}}>${n("baselineClear")}</wk-action-button>`:d}
            </div>`:d}
    </div>`}renderDeploy(){const e=this.deploying;if(!e)return d;const s=this.targets.filter(a=>a.phase==="previewed"),t=!!this.busy||this.targets.some(a=>a.phase==="reading"||a.phase==="previewing"||a.phase==="saving");return o`<sw-drawer modal open heading=${n("deployTitle",{name:e.name??""})} data-se-deploy-drawer=${e.id} @close=${a=>a.target===a.currentTarget&&this.closeDeploy()}>
      ${this.note?this.renderNote():d}
      ${this.progress?this.renderProgress():o`
        ${this.writesOff?o`<p class="warn" role="note" data-se-deploy-warning>${this.writesOffText()}</p>`:d}
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
    </sw-drawer>`}renderTarget(e,s,t){const a=s.holidays?.length??0,i=je(e.bindings,e.readiness),r=(l,p,b,P,H)=>{const u=pe(e.readiness,b);return o`<label class="f">${p}${u?o` <span class="s">${n("range",{a:u[0],b:u[1]})}</span>`:d}
        <input type="number" inputmode="numeric" min="1" max="65535" .value=${P===null?"":String(P)} aria-invalid=${String(!!i[l])} data-se-slot=${l}
          ?disabled=${t||e.phase==="saved"} @change=${S=>this.patchTarget(e.stationId,{bindings:H(Number(S.target.value)),phase:"idle",previewId:null,impact:null})} />
      </label>`};return o`<div class="target" data-se-target=${e.stationId} data-phase=${e.phase}>
      <div class="bh"><h3>${this.stationName(e.stationId)}</h3><span class="sp"></span>
        <wk-action-button tone="quiet" icon="cpu" data-se-read=${e.stationId} ?busy=${e.phase==="reading"} ?disabled=${t||e.phase==="saved"} @click=${()=>void this.readTarget(e)}>${n("readStation")}</wk-action-button>
      </div>
      <span class="s">${n("slotsHint")}</span>
      <div class="line">
        ${r("template",n("slotTemplate"),"template",e.bindings.template,l=>({...e.bindings,template:l}))}
        ${r("weekly",n("slotWeekly"),"weekly",e.bindings.weekly,l=>({...e.bindings,weekly:l}))}
        ${a?r("holiday_group",n("slotGroup"),"holiday_group",e.bindings.holiday_group,l=>({...e.bindings,holiday_group:l})):d}
        ${e.bindings.holidays.map((l,p)=>r(`holidays.${p}`,n("slotHoliday",{n:p+1}),"holiday",l,b=>({...e.bindings,holidays:e.bindings.holidays.map((P,H)=>H===p?b:P)})))}
      </div>
      ${Object.values(i).length?o`<span class="s" role="alert" data-se-slot-fault>${m(Object.values(i)[0])}</span>`:d}
      ${e.phase==="reading"||e.phase==="previewing"?o`<span class="s line"><span class="spin" aria-hidden="true"></span>${n("reading")}</span>`:d}
      ${e.error?o`<p class="note" role="status" data-tone=${e.error.status} data-se-target-error=${e.error.code??""}>${e.error.status==="refused"?n("refusedBy",{reason:m(e.error.code)}):e.error.status==="not_sent"?n("notSent",{reason:e.error.message}):n("unknownOutcome")}</p>`:d}
      ${e.impact?this.renderImpact(e.impact):d}
      ${e.phase!=="previewed"&&e.phase!=="saved"?o`<div><wk-action-button icon="search" data-se-preview=${e.stationId} ?busy=${e.phase==="previewing"} ?disabled=${t||Object.keys(i).length>0||!this.live} @click=${()=>void this.previewTarget(e)}>${n("previewRun")}</wk-action-button></div>`:d}
    </div>`}renderImpact(e){const s=e.station?.doors??[],t=e.people,a=(e.resources??[]).filter(r=>r.state&&r.state!=="matches"||r.externally_referenced||r.active),i=(e.blockers??[]).filter(Boolean);return o`<div class="panel" data-se-impact>
      <h4><sw-icon name="target" size=${14}></sw-icon>${n("impactTitle")}</h4>
      <ul class="plain">
        <li data-se-impact-station>${n("impactStation",{name:e.station?.name??e.station?.id??""})}</li>
        <li data-se-impact-doors>${s.length?n("impactDoors",{doors:s.map(r=>r.name??`#${r.index}`).join(", ")}):n("impactNoDoors")}</li>
        <li data-se-impact-people>${t&&t.state==="complete"?n("impactPeople",{explicit:t.explicit??"—",implicit:t.implicit??"—",read:t.read??"—"}):n("impactPeopleUnknown")}</li>
      </ul>
      ${a.length?o`<h4>${n("conflictsTitle")}</h4><ul class="plain" data-se-conflicts>${a.map(r=>o`<li>${n("resourceRow",{kind:Hs[r.kind??""]??r.kind??"",id:r.id??"—",state:Ks[r.state??""]??r.state??""})}${r.externally_referenced?` · ${n("externalRef")}`:""}${r.active?` · ${n("activeRes")}`:""}</li>`)}</ul>`:d}
      ${i.length?o`<h4>${n("blockersTitle")}</h4><ul class="plain" data-se-blockers>${i.map(r=>o`<li data-code=${r}>${m(r)}</li>`)}</ul>`:d}
    </div>`}renderProgress(){const e=this.progress;return o`<div class="panel prog" data-se-progress data-done=${String(e.done)}>
      <h4>${e.done?o`<sw-icon name="check" size=${14}></sw-icon>${n("progressDone")}`:o`<span class="spin" aria-hidden="true"></span>${n("progressRunning")}`}</h4>
      ${e.writesEnabled===!1?o`<p class="warn" data-se-writes-off>${n("writesOff")}</p>`:d}
      ${e.results.map(s=>{const t=s.job?e.jobs[s.job.id]??s.job:null,a=t?Ee[t.status??""]??t.status??"":n(`st_${s.status}`),i=t?t.error?m(t.error):(t.blockers??[]).filter(Boolean).map(l=>m(l)).join(" · "):m(s.code)||s.reason||"",r=t?De(t.status):Ms(s);return o`<div class="row" data-se-result=${s.station?.id??s.plan_id} data-status=${t?.status??s.status}>
          <div class="main"><span class="t">${s.station?.name??this.stationName(s.station?.id)}</span><span class="s">${i}</span></div>
          ${t&&Re(t.status)?o`<span class="spin" aria-hidden="true"></span>`:d}
          <sw-badge kind=${Ie[r]} label=${a}></sw-badge>
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
    </sw-dialog>`}};w.styles=J`
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
  `;f([$({attribute:!1})],w.prototype,"stations",2);f([$({attribute:!1})],w.prototype,"library",2);f([$({attribute:!1})],w.prototype,"plans",2);f([$({attribute:!1})],w.prototype,"ops",2);f([$({type:Boolean})],w.prototype,"live",2);f([$({type:Boolean})],w.prototype,"narrow",2);f([h()],w.prototype,"editing",2);f([h()],w.prototype,"draft",2);f([h()],w.prototype,"checkAt",2);f([h()],w.prototype,"checked",2);f([h()],w.prototype,"busy",2);f([h()],w.prototype,"assessStation",2);f([h()],w.prototype,"assessment",2);f([h()],w.prototype,"importing",2);f([h()],w.prototype,"deploying",2);f([h()],w.prototype,"targets",2);f([h()],w.prototype,"progress",2);f([h()],w.prototype,"ask",2);f([h()],w.prototype,"note",2);f([h()],w.prototype,"claims",2);f([h()],w.prototype,"ownerRan",2);w=f([Y("wk-schedule-library")],w);var Xt=Object.defineProperty,Zt=Object.getOwnPropertyDescriptor,g=(e,s,t,a)=>{for(var i=a>1?void 0:a?Zt(s,t):s,r=e.length-1,l;r>=0;r--)(l=e[r])&&(i=(a?l(s,t,i):l(i))||i);return a&&i&&Xt(s,t,i),i};const Ne="sw.wiskey.schedules.view",Qt=3e4,ee={state:"loading",data:null,at:0,fresh:!0,fetchedAt:null},T=(e,s=null)=>({state:e,data:s,at:Date.now(),fresh:!0,fetchedAt:null});function ea(e){try{return localStorage.getItem(e)}catch{return null}}function sa(e,s){try{localStorage.setItem(e,s)}catch{}}const oe={live:"live",stale:"stale",error:"error",offline:"offline",unknown:"unknown",neutral:"neutral"},Pe={kind:"iana",name:"Asia/Jerusalem"},Ce={loaded:!0,model:null,firmware:null,capabilities:null,clock:null,event_status:null,scanned_at:null,scanning:!1,reconciled_at:null,last_poll_ms:null},ta=[{id:"d1",name:"שער ראשי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"שער"}],has_camera:!1,camera_entity:null,last_seen:null,zone:Pe,technical:Ce,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!1,camera_entity:null,last_seen:null,zone:Pe,technical:Ce,errors:null}],B=[{start:"07:00",end:"09:00"}],aa={d1:{programs:[],saved:[],timezone:"Asia/Jerusalem",native_supported:!1},d2:{programs:[{door:1,revision:1,enabled:!0,removing:!1,policy:{timezone:"Asia/Jerusalem",name:"בוקר",weekly:{Sunday:B,Monday:B,Tuesday:B,Wednesday:B,Thursday:B},holidays:[]},execution:{owned:!1,attempted:null,status:"idle"},error:null,checked_at:null}],saved:[],timezone:"Asia/Jerusalem",native_supported:!1}};let v=class extends V{constructor(){super(...arguments),this.feed=null,this.error="",this.access={screen:!0,library:!0,edit:!1},this.wanted=null,this.view=ea(Ne)==="table"?"table":"door",this.narrow=typeof window<"u"&&window.innerWidth<ie,this.sheet=!1,this.programs={},this.codes={},this.library=ee,this.plans=ee,this.ops=ee,this.features={},this.manage=!1,this.managing=G().params.get("manage")==="1",this.stopSession=null,this.stopRoute=null,this.poll=0,this.loading=!1,this.loadAgain=!1,this.inFlight=new Set,this.featuresRead=!1,this.mq=typeof matchMedia=="function"?matchMedia(`(max-width: ${ie-1}px)`):null,this.onMedia=()=>{this.narrow=window.innerWidth<ie},this.onVisible=()=>{document.hidden||this.load()}}connectedCallback(){super.connectedCallback(),this.mq?.addEventListener("change",this.onMedia),this.wanted=G().params.get("door"),this.stopRoute=ss(e=>this.onRoute(e)),ae()&&(this.stopSession=ts(()=>{this.access=ge(ve,X),this.manage=ke(X)}),this.access=ge(ve,X),this.manage=ke(X),this.access.screen&&(this.load(),this.poll=window.setInterval(()=>{document.hidden||this.load()},ls),document.addEventListener("visibilitychange",this.onVisible)))}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMedia),this.stopRoute?.(),this.stopRoute=null,this.stopSession?.(),this.stopSession=null,window.clearInterval(this.poll),document.removeEventListener("visibilitychange",this.onVisible)}onRoute(e){if(e.mode!=="wiskey")return;this.managing=e.params.get("manage")==="1";const s=e.params.get("door");s!==this.wanted&&(this.wanted=s,this.loadNeeded())}demo(){return!ae()}stations(){return this.demo()?ta:this.feed?.stations??[]}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{this.feed=await is(),this.error=""}catch(e){e instanceof re&&e.status===403?this.access={...this.access,screen:!1}:this.error=as(e)}await this.readFeatures(),await this.loadNeeded(),await this.loadLibrary()}while(this.loadAgain)}finally{this.loading=!1}}async readFeatures(){if(!this.featuresRead)try{const e=await ns();this.features=Object.fromEntries(Object.entries(e.features??{}).map(([s,t])=>[s,t.available])),this.featuresRead=!0}catch{}}needed(){const e=ne(this.stations());if(this.effectiveView()==="table")return[...new Set(e.map(t=>t.stationId))];const s=$e(e,this.wanted);return s?[s.stationId]:[]}async loadNeeded(){if(!this.demo())for(const e of this.needed()){const s=Math.min(this.programs[e]?.at??0,this.codes[e]?.at??0);Date.now()-s<Qt||await this.loadStation(e)}}classify(e,s,t){const a=Date.now();if(e.state==="ready"&&s!==null&&s!==void 0)return{state:"ready",data:s,at:a,fresh:e.fresh!==!1,fetchedAt:e.fetched_at};const i=e.state==="unsupported"?"unsupported":ds(e.last_error)?"busy":"error";return i==="unsupported"?T(i):{state:i,data:t?.data??null,at:a,fresh:!1,fetchedAt:t?.fetchedAt??null}}failed(e,s){return e instanceof re&&(e.status===403||e.status===404)?T("forbidden"):{state:"error",data:s?.data??null,at:Date.now(),fresh:!1,fetchedAt:s?.fetchedAt??null}}async loadStation(e){if(!this.inFlight.has(e)){this.inFlight.add(e);try{if(this.features.door_programs===!1)this.programs={...this.programs,[e]:T("unsupported")};else{this.programs[e]||(this.programs={...this.programs,[e]:ee});try{const s=await os(e);this.programs={...this.programs,[e]:this.classify(s,s.programs,this.programs[e])}}catch(s){this.programs={...this.programs,[e]:this.failed(s,this.programs[e])}}}if(this.features.public_codes===!1)this.codes={...this.codes,[e]:T("unsupported")};else try{const s=await rs(e);this.codes={...this.codes,[e]:this.classify(s,s.codes,this.codes[e])}}catch(s){this.codes={...this.codes,[e]:this.failed(s,this.codes[e])}}}finally{this.inFlight.delete(e)}}}async loadLibrary(){if(this.demo()||!this.access.library)return;const e=async(s,t,a)=>{if(this.features[s]===!1)return T("unsupported");try{const i=await t();return this.classify(i,i.schedules,a)}catch(i){return this.failed(i,a)}};if(this.library=await e("schedules",ks,this.library),this.library.state==="forbidden"){this.plans=T("forbidden"),this.ops=T("forbidden");return}this.plans=await e("schedule_plans",_s,this.plans),this.ops=await e("schedule_operations",xs,this.ops)}effectiveView(){return this.narrow?"door":this.view}setView(e){this.view=e,sa(Ne,e),this.loadNeeded()}pick(e){if(this.sheet=!1,this.wanted===e&&this.effectiveView()==="door")return;this.wanted=e,this.view==="table"&&this.setView("door");const s=G();if(s.mode==="wiskey"){const t=new URLSearchParams(s.params);t.set("door",e),be(s.path,t)}this.loadNeeded()}refresh(){this.programs=Object.fromEntries(Object.entries(this.programs).map(([e,s])=>[e,{...s,at:0}])),this.codes=Object.fromEntries(Object.entries(this.codes).map(([e,s])=>[e,{...s,at:0}])),this.load()}zoneOf(e){return this.stations().find(s=>s.id===e)?.zone??this.feed?.default_zone??null}programsOf(e){return this.demo()?T("ready",aa[e]??null):this.programs[e]}codesOf(e){return this.demo()?T("ready",{public_pin_state:e==="d2"?"configured":"absent",slots:[],capabilities:{advertised:null,min:null,max:null},checked_at:null}):this.codes[e]}staleLine(e,s,t){return e.fresh||!e.data?d:o`<p class="status" role="status" data-sch-stale=${t}>${c("stale",{t:Z(e.fetchedAt,s)||"—"})}</p>`}render(){const e=c("title");if(ae()&&!this.access.screen)return o`<sw-page heading=${e}><div data-sch data-sch-state="forbidden"><sw-state-panel quiet state="forbidden" heading=${c("noPermission")} data-sch-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return o`<sw-page heading=${e}><div data-sch data-sch-state=${this.error?"error":"loading"}>${this.error?o`<sw-state-panel quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="error" @action=${()=>this.refresh()}></sw-state-panel>`:o`<sw-state-panel quiet state="loading" heading=${c("loading")} data-sch-panel="loading"></sw-state-panel>`}</div></sw-page>`;if(!this.demo()&&this.feed.stations===null){const s=this.feed.state==="ready"?"error":this.feed.state,t=cs(s);return o`<sw-page heading=${e}><div data-sch data-sch-state=${`feed:${this.feed.state}`}>
        <sw-state-panel icon="calendar" quiet state=${t.panel} heading=${t.heading} actionLabel=${t.panel==="error"||t.panel==="stale"?c("retry"):""} data-sch-panel=${`feed:${this.feed.state}`} @action=${()=>this.refresh()}></sw-state-panel>
      </div></sw-page>`}return this.renderReady()}setManaging(e){this.managing=e;const s=G();if(s.mode==="wiskey"){const t=new URLSearchParams(s.params);e?t.set("manage","1"):t.delete("manage"),be(s.path,t)}e&&this.loadLibrary()}renderManaging(){const e=this.stations(),s=this.library;return o`<sw-page wide heading=${c("title")} subheading=${ye(ne(e).length,s.data?s.data.length:null)}>
      <sw-button slot="actions" variant="ghost" icon="chevronBack" data-sch-manage-close @click=${()=>this.setManaging(!1)}>${c("viewDoor")}</sw-button>
      <sw-button slot="actions" variant="ghost" icon="refresh" data-sch-refresh label=${c("refresh")} @click=${()=>this.refresh()}>${c("refresh")}</sw-button>
      <div data-sch data-sch-state=${s.data?"ready":s.state} data-sch-view="manage">
        ${s.data?this.renderManage(e):s.state==="loading"?o`<sw-state-panel quiet state="loading" heading=${c("loading")} data-sch-panel="manage-loading"></sw-state-panel>`:o`<sw-state-panel quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="manage-error" @action=${()=>this.refresh()}></sw-state-panel>`}
      </div>
    </sw-page>`}renderReady(){if(this.manage&&this.managing&&!this.demo()&&this.access.library)return this.renderManaging();const e=this.stations(),s=ne(e),t=this.effectiveView(),a=$e(s,this.wanted),i=this.demo()?!1:this.access.library&&this.library.state!=="forbidden",r=i&&this.library.data?this.library.data.length:null,l=!this.demo()&&this.feed?.fresh===!1;return o`<sw-page wide heading=${c("title")} subheading=${ye(s.length,r)}>
      ${this.access.edit&&!this.demo()?o`<sw-button slot="actions" variant="ghost" icon="edit" data-sch-edit @click=${()=>window.location.hash=hs}>${c("editClassic")}</sw-button>`:d}
      ${this.manage&&this.access.library&&!this.demo()?o`<sw-button slot="actions" variant="ghost" icon="calendar" data-sch-manage-open @click=${()=>this.setManaging(!0)}>${n("manageOpen")}</sw-button>`:d}
      <sw-button slot="actions" variant="ghost" icon="refresh" data-sch-refresh label=${c("refresh")} @click=${()=>this.refresh()}>${c("refresh")}</sw-button>
      ${this.demo()?d:o`<wk-deep-links slot="actions" place="schedules" mode="menu"></wk-deep-links>`}
      ${s.length&&!this.narrow?o`<sw-view-switch slot="actions" data-sch-views label=${c("viewLabel")} .value=${t} .options=${[{id:"door",label:c("viewDoor"),icon:"calendar"},{id:"table",label:c("viewTable"),icon:"table"}]} @change=${p=>this.setView(p.detail)}></sw-view-switch>`:d}
      <div data-sch data-sch-state=${s.length?"ready":"empty"} data-sch-view=${t}>
        ${l?o`<p class="status" role="status" data-sch-stale="stations">${c("stale",{t:Z(this.feed?.fetched_at,this.feed?.default_zone??null)||"—"})}</p>`:d}
        ${s.length?t==="table"?this.renderTable(s):this.renderDoorView(s,a):o`<sw-state-panel icon="calendar" quiet state="empty" heading=${c("noDoors")} data-sch-panel="empty"></sw-state-panel>`}
        ${i?this.renderLibrary(e):d}
      </div>
      ${s.length?this.renderSheet(s,a):d}
    </sw-page>`}renderDoorList(e,s,t=!1){return o`<nav class="doors" aria-label=${c("doorsHeading")} data-sch-door-list=${t?"sheet":"side"}>
      ${t?d:o`<div class="ttl">${c("doorsHeading")}</div>`}
      ${ps(e).map(a=>o`<div class="station" data-sch-station=${a.stationId}><span class="dot ${a.online?"":"off"}" aria-hidden="true"></span>${a.stationName}</div>
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
    </div>`:d}renderCodePill(e){const s=this.codesOf(e);if(s?.state==="unsupported"||s?.state==="forbidden")return d;const t=s?.data?us(s.data):"unknown";return o`<sw-badge kind=${t==="set"?"live":t==="unset"?"neutral":"unknown"} label=${c("codePill",{state:ws(t)})} data-sch-code=${t}></sw-badge>`}renderDoor(e){const s=this.programsOf(e.stationId),t=this.zoneOf(e.stationId),a=o`<div class="doorhead">
      <h2 data-sch-door-title>${c("doorAt",{door:e.doorName,station:e.stationName})}</h2>
      ${e.online?d:o`<span class="sub" data-sch-offline>${c("offline")}</span>`}
      <span class="sp"></span>
      ${this.renderCodePill(e.stationId)}
    </div>`;let i;return!s||s.state==="loading"&&!s.data?i=o`<sw-state-panel compact quiet state="loading" heading=${c("loading")} data-sch-panel="door-loading"></sw-state-panel>`:s.state==="unsupported"?i=o`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("sUnsupported")} data-sch-panel="door-unsupported"></sw-state-panel>`:s.state==="forbidden"?i=o`<sw-state-panel compact quiet state="forbidden" heading=${c("noPermission")} data-sch-panel="door-forbidden"></sw-state-panel>`:s.data?i=this.renderProgram(e,s,t):i=s.state==="busy"?o`<sw-state-panel compact quiet state="stale" heading=${c("busy")} data-sch-panel="door-busy"></sw-state-panel>`:o`<sw-state-panel compact quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel="door-error" @action=${()=>void this.loadStation(e.stationId)}></sw-state-panel>`,o`${a}${i}`}renderProgram(e,s,t){const a=fs(e,s.data),i=this.staleLine(s,t,"door");if(a.none)return o`${i}<sw-card><div class="block"><sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("noProgram")} data-sch-panel="no-program"></sw-state-panel></div></sw-card>`;const r=ms(a.state);return o`${i}<sw-card>
      <div class="block" data-sch-program=${a.state}>
        <div class="bh"><h3>${c("programsTitle")}</h3><span class="sp"></span><sw-badge kind=${oe[r]} label=${bs(`st_${a.state}`,"st_unknown")} data-sch-program-state=${a.state}></sw-badge></div>
        <div class="prog">
          <span class="name" data-sch-program-name>${a.name}</span>
          ${a.execution?o`<span class="muted" data-sch-execution>${a.execution}</span>`:d}
        </div>
        <sw-week-grid data-sch-week aria-label=${c("weekLabel")} .days=${a.days} .modes=${[{id:"hold",label:c("legendHold"),color:"var(--sw-accent)"}]}></sw-week-grid>
        ${a.unreadable?o`<span class="muted" data-sch-hours-unknown>${c("hoursUnknown")}</span>`:d}
        ${a.lines.length?o`<ul class="lines" data-sch-lines>${a.lines.map(l=>o`<li>${l}</li>`)}</ul>`:d}
        ${a.dates.length?o`<div class="dates" data-sch-dates><h4>${c("datesTitle")}</h4><ul class="lines">${a.dates.map(l=>o`<li>${l}</li>`)}</ul></div>`:d}
        ${a.checkedAt||a.timezone?o`<span class="muted">${[a.checkedAt?c("checked",{when:Z(a.checkedAt,t)}):"",a.timezone?c("zone",{zone:a.timezone}):""].filter(Boolean).join(" · ")}</span>`:d}
      </div>
    </sw-card>`}renderTable(e){const s=Object.fromEntries(e.map(r=>[r.stationId,this.programsOf(r.stationId)?.data??null])),t=Object.fromEntries(e.map(r=>[r.stationId,this.codesOf(r.stationId)?.data??null])),a=vs(e,s,t),i=[{key:"door",label:c("colDoor"),render:r=>o`<b>${r.door}</b>`},{key:"station",label:c("colStation")},{key:"program",label:c("colProgram")},{key:"kind",label:c("colKind")},{key:"when",label:c("colWhen")},{key:"state",label:c("colState"),render:r=>r.state?o`<sw-badge kind=${oe[r.tone]} label=${r.state}></sw-badge>`:""},{key:"code",label:c("colCode"),render:r=>o`<span data-sch-code=${r.codeState}>${r.code}</span>`}];return o`<sw-table dense data-sch-table .rowKey=${"key"} .columns=${i} .rows=${a} @row-select=${r=>this.pick(r.detail.id)}></sw-table>`}renderManage(e){const s=this.feed?.fresh===!1||!this.library.fresh;return o`<div class="manage" data-sch-manage>
      <wk-schedule-library .stations=${[...e]} .library=${this.library.data} .plans=${this.plans.data} .ops=${this.ops.data} ?live=${!s} ?narrow=${this.narrow}
        @sched-changed=${()=>void this.loadLibrary()}></wk-schedule-library>
    </div>`}renderLibrary(e){const s=gs(e),t=this.feed?.default_zone??null,a=u=>u.state==="forbidden"||u.state==="unsupported",i=this.library,r=a(this.plans)?null:this.plans;if(a(i)&&!r)return d;const l=(u,S,C,me,Ke)=>o`<sw-card>
      <div class="block" data-sch-block=${S}>
        <div class="bh"><h3>${u}</h3>${me!==null?o`<span class="n">${me}</span>`:d}</div>
        ${C.state==="loading"&&!C.data?o`<sw-state-panel compact quiet state="loading" heading=${c("loading")}></sw-state-panel>`:C.state==="unsupported"?o`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("sUnsupported")} data-sch-panel=${`${S}-unsupported`}></sw-state-panel>`:C.data?o`${this.staleLine(C,t,S)}${Ke}`:C.state==="busy"?o`<sw-state-panel compact quiet state="stale" heading=${c("busy")} data-sch-panel=${`${S}-busy`}></sw-state-panel>`:o`<sw-state-panel compact quiet state="error" heading=${c("error")} actionLabel=${c("retry")} data-sch-panel=${`${S}-error`} @action=${()=>this.refresh()}></sw-state-panel>`}
      </div>
    </sw-card>`,p=$s(i.data,r?.data??null,s),b=ys(r?.data??null,a(this.ops)?null:this.ops.data,i.data,s),P=p.length?o`<div class="rows">${p.map(u=>o`<div class="row" data-sch-lib-row=${u.id}>
            <div class="main"><span class="t">${u.name}${u.version?o` <span class="muted">${u.version}</span>`:d}</span>
              ${u.lines.map(S=>o`<span class="s">${S}</span>`)}
              <span class="s">${[u.holidays,u.proposals].filter(Boolean).join(" · ")}</span></div>
          </div>`)}</div>`:o`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("libraryEmpty")} data-sch-panel="library-empty"></sw-state-panel>`,H=b.length?o`<div class="rows">${b.map(u=>o`<div class="row" data-sch-plan-row=${u.id}>
            <div class="main"><span class="t">${u.name} · ${u.station}</span>
              <span class="s">${[u.state!==u.source?u.source:"",u.outdated?c("outdated"):"",u.notApplied?c("notApplied"):"",u.checkedAt?c("checked",{when:Z(u.checkedAt,u.stationId&&this.zoneOf(u.stationId)||t)}):""].filter(Boolean).join(" · ")}</span></div>
            <sw-badge kind=${oe[u.tone]} label=${u.state} data-sch-plan-state=${u.tone}></sw-badge>
          </div>`)}</div>`:o`<sw-state-panel icon="calendar" compact quiet state="empty" heading=${c("plansEmpty")} data-sch-panel="plans-empty"></sw-state-panel>`;return o`<div class="two" data-sch-library>
      ${a(i)?d:l(c("libraryTitle"),"library",i,i.data?i.data.length:null,P)}
      ${r?l(c("plansTitle"),"plans",r,r.data?r.data.length:null,H):d}
    </div>`}};v.styles=Ss;g([h()],v.prototype,"feed",2);g([h()],v.prototype,"error",2);g([h()],v.prototype,"access",2);g([h()],v.prototype,"wanted",2);g([h()],v.prototype,"view",2);g([h()],v.prototype,"narrow",2);g([h()],v.prototype,"sheet",2);g([h()],v.prototype,"programs",2);g([h()],v.prototype,"codes",2);g([h()],v.prototype,"library",2);g([h()],v.prototype,"plans",2);g([h()],v.prototype,"ops",2);g([h()],v.prototype,"features",2);g([h()],v.prototype,"manage",2);g([h()],v.prototype,"managing",2);v=g([Y("wiskey-schedules")],v);export{v as WiskeySchedules};
