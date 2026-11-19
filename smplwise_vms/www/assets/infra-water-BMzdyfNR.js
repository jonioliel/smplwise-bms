import{br as Es,a2 as G,b5 as S,bW as Z,bm as P,bs as Hs,bn as wt,xf as ns,bU as os,g as Vt,u as Wt,bG as Ks,bH as Ys,aU as st,ax as E,j as c,i as et,aL as ct,yV as at,yW as it,n as M,Y as b,A as d,b as n,ek as Ns,k as X,a5 as ht,eD as Gs,a as mt,eR as Js,yX as Rs,en as Qs,yY as ls,ep as ds,eq as Xs,er as Zs,et as te,yZ as se,y_ as ee,y$ as ae,z0 as ie}from"./index-rXjlW4bK.js";import{f as J,a as Ft,m as re,M as ne,b as Jt,c as cs,d as oe,e as le,g as hs,h as de,i as ce,j as he,k as ue,l as pe}from"./meters-page-base-l01UknPw.js";import{e as Os}from"./styles-CJNCG9DU.js";import"./sw-place-tree-CLZutrtt.js";import{s as me,u as $e}from"./static-Cbe0XT7g.js";import{i as ve,a as fe}from"./infra-pages-xW8PtIJR.js";import"./sw-logo-art-PLtEZJxU.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";const D="infra/water/",ut=t=>{const s=new URLSearchParams;for(const[r,i]of Object.entries(t))i!==void 0&&i!==""&&s.set(r,String(i));const a=s.toString();return a?`?${a}`:""},vt={night_from:"01:00",night_to:"05:00",night_min_lph:6,night_min_intervals:8},yt={durations:[15,60,240,1440],default:60,max:10080},w={listMeters:async()=>G()?(await S(`${D}meters`)).items:[],meter:t=>S(`${D}meters/${encodeURIComponent(t)}`),candidates:async(t="")=>G()?(await S(`${D}candidates${ut({q:t,include_rejected:!0})}`)).items:[],createMeter:t=>P(`${D}meters`,t),patchMeter:(t,s)=>wt(`${D}meters/${encodeURIComponent(t.id)}`,{revision:t.revision,...s}),retireMeter:t=>Z(`${D}meters/${encodeURIComponent(t.id)}${ut({revision:t.revision})}`),replaceMeter:(t,s)=>P(`${D}meters/${encodeURIComponent(t.id)}/replace`,{revision:t.revision,...s}),series:async(t,s,a,r)=>G()?(await S(`${D}meters/${encodeURIComponent(t)}/series${ut({from:a,to:r,bucket:s})}`)).items:[],consumption:async(t,s,a)=>G()?S(`${D}consumption${ut({from:t,to:s,bucket:a})}`):{from:t,to:s,items:[],total_litres:null,previous_total_litres:null,series:[]},consumptionCsvUrl:(t,s,a)=>Hs(`${D}consumption.csv${ut({from:t,to:s,lang:a})}`),manualReadings:async t=>G()?(await S(`${D}meters/${encodeURIComponent(t)}/manual-readings`)).items:[],addManual:(t,s)=>P(`${D}meters/${encodeURIComponent(t)}/manual-readings`,s),undoManual:(t,s)=>P(`${D}meters/${encodeURIComponent(t)}/manual-readings/${encodeURIComponent(s)}/undo`,{}),events:async(t,s)=>{if(!G())return{items:[],summary:{open:0,acked:0,last_7d:0,open_leaks:0,snoozed:0}};const a=await S(`${D}events${ut({state:t,meter_id:s})}`);return s||be(a.summary.open),a},ack:t=>P(`${D}events/${encodeURIComponent(t)}/ack`,{}),snooze:(t,s)=>P(`${D}events/${encodeURIComponent(t)}/snooze`,s===void 0?{}:{minutes:s}),unsnooze:t=>Z(`${D}events/${encodeURIComponent(t)}/snooze`),alerts:async()=>G()?S(`${D}alerts`):{rules:vt,snooze:yt,snooze_limits:{min:5,max:43200,count:12},row_version:0,can_edit:!0},saveSnooze:(t,s)=>Es(`${D}alerts`,{snooze:t,row_version:s})};let Qt=0;const Xt=new Set,ge=()=>Qt;function be(t){if(t!==Qt){Qt=t;for(const s of Xt)s(t)}}function we(t){return Xt.add(t),()=>Xt.delete(t)}let Dt=null;async function zt(t=!1){if(!t&&Dt&&Date.now()-Dt.at<6e4)return Dt.cfg;let s=null;try{s=await w.alerts()}catch{s=null}return Dt={at:Date.now(),cfg:s},s}const us=t=>{const[s,a]=t.split(":").map(Number);return(s||0)*60+(a||0)};function ye(t,s=new Date){const a=us(t.night_from),r=us(t.night_to),i=(u,T)=>new Date(u.getFullYear(),u.getMonth(),u.getDate(),Math.floor(T/60),T%60),o=s.getHours()*60+s.getMinutes(),l=new Date(s);o<a&&!(r<a&&o<r)&&l.setDate(l.getDate()-1);const h=i(l,a),$=new Date(h);r<=a&&$.setDate($.getDate()+1);const p=i($,r);return{from:h,to:p>s?s:p}}function _e(t){const s=t.map(a=>a.litres).filter(a=>a!=null);return s.length?Math.round(Math.min(...s)*10)/10:null}function Ts(t){const s=t.rules?.night_rule;return typeof s=="boolean"?!s:t.kind==="irrigation"}const ps=new Map;async function Ls(t,s){const a={},r=ye(s);return await Promise.all(t.map(async i=>{if(Ts(i))return void(a[i.id]="off");if(i.status==="retired"||i.value_l===null)return void(a[i.id]=null);const o=ps.get(i.id);if(o&&Date.now()-o.at<6e5)return void(a[i.id]=o.v);try{const l=_e(await w.series(i.id,"1h",r.from.toISOString(),r.to.toISOString()));ps.set(i.id,{at:Date.now(),v:l}),a[i.id]=l}catch{a[i.id]=null}})),a}const Fs=t=>t.area_id??"_none";function ke(t,s=ns("ללא קומה"),a=ns("ללא אזור")){const r=new Map;for(const i of t){const o=i.floor_id??"",l=r.get(o)??{floor_id:o,name:i.floor_name??s,count:0,areas:[]};l.count++;const h=Fs(i),$=l.areas.find(p=>p.area_id===h);$?$.count++:l.areas.push({area_id:h,name:i.area_name??a,count:1}),r.set(o,l)}return[...r.values()]}const f="infra/water/",ot=t=>{const s=new URLSearchParams;for(const[r,i]of Object.entries(t))i!==void 0&&i!==""&&s.set(r,String(i));const a=s.toString();return a?`?${a}`:""},qt=()=>`wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`,v={sharedSettings:()=>S(`${f}billing/shared`),listCustomers:t=>G()?S(`${f}customers${ot({q:t})}`):Promise.resolve({items:[],total:0}),customer:t=>S(`${f}customers/${t}`),nextCustomerNumber:()=>S(`${f}customers/next-number`),createCustomer:t=>P(`${f}customers`,t),updateCustomer:(t,s)=>wt(`${f}customers/${t}`,s),deleteCustomer:(t,s)=>Z(`${f}customers/${t}${ot({base_revision:s})}`),listTariffs:()=>G()?S(`${f}tariffs`):Promise.resolve({items:[]}),createTariff:t=>P(`${f}tariffs`,t),renameTariff:(t,s)=>wt(`${f}tariffs/${t}`,{name:s}),deleteTariff:t=>Z(`${f}tariffs/${t}`),addVersion:(t,s)=>P(`${f}tariffs/${t}/versions`,s),correctVersion:(t,s,a)=>wt(`${f}tariffs/${t}/versions/${s}`,a),deleteVersion:(t,s)=>Z(`${f}tariffs/${t}/versions/${s}`),listAccounts:t=>G()?S(`${f}accounts${ot({q:t})}`):Promise.resolve({items:[],summary:{active:0,drafts:0}}),account:t=>S(`${f}accounts/${t}`),accountStatus:t=>S(`${f}accounts/${t}/status`),accountHistory:(t,s=12)=>S(`${f}accounts/${t}/history${ot({past:s})}`),accountBills:t=>S(`${f}accounts/${t}/bills`),createAccount:t=>P(`${f}accounts`,t),updateAccount:(t,s)=>wt(`${f}accounts/${t}`,s),deleteAccount:(t,s)=>Z(`${f}accounts/${t}${ot({base_revision:s})}`),preset:(t,s,a,r)=>P(`${f}formula/preset`,{preset:t,meter_ids:s,main_meter_id:a,percent:r}),listBills:(t={})=>G()?S(`${f}bills${ot(t)}`):Promise.resolve({items:[],total:0,counts:{draft:0,issued:0,sent:0,paid:0,void:0},sums:{open:"0.00",paid:"0.00"}}),bill:t=>S(`${f}bills/${t}`),billEvents:t=>S(`${f}bills/${t}/events`),createBill:(t,s)=>P(`${f}accounts/${t}/bills`,{period:s,client_request_id:qt()}),recalculate:t=>P(`${f}bills/${t.id}/recalculate`,{row_version:t.row_version}),deleteDraft:t=>Z(`${f}bills/${t.id}${ot({row_version:t.row_version})}`),issue:(t,s=qt())=>P(`${f}bills/${t.id}/issue`,{row_version:t.row_version,client_request_id:s}),markSent:(t,s,a="")=>P(`${f}bills/${t.id}/sent`,{how:s,note:a,row_version:t.row_version}),markPaid:(t,s="")=>P(`${f}bills/${t.id}/paid`,{reference:s,row_version:t.row_version}),void:(t,s)=>P(`${f}bills/${t.id}/void`,{reason:s,row_version:t.row_version}),correct:t=>P(`${f}bills/${t.id}/correct`,{client_request_id:qt()}),snooze:(t,s)=>P(os`infra/water/events/${t}/snooze`,s===void 0?{}:{minutes:s}),unsnooze:t=>Z(os`infra/water/events/${t}/snooze`),saveSnooze:(t,s)=>Es("infra/water/alerts",{snooze:t,row_version:s})},xe=Vt`
  :host {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .head .inp {
    flex: 0 1 280px;
  }
  dl.kv {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 14px;
    margin: 0;
    font-size: var(--sw-fs-sm);
  }
  dl.kv dt {
    color: var(--sw-text-3);
  }
  dl.kv dd {
    margin: 0;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  h3.sec {
    margin: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
  }
  svg.chart {
    inline-size: 100%;
    block-size: auto;
    max-block-size: 170px;
    display: block;
  }
  svg.chart .grid {
    stroke: var(--sw-border-strong);
  }
  svg.chart .bar {
    fill: color-mix(in srgb, var(--sw-accent) 38%, var(--sw-surface-3));
  }
  svg.chart .bar.hi {
    fill: var(--sw-accent);
  }
  svg.chart .bar.night {
    fill: color-mix(in srgb, var(--sw-heading, var(--sw-text)) 55%, var(--sw-surface-3));
  }
  svg.chart .bar.leak {
    fill: var(--sw-danger);
  }
  svg.chart .win {
    fill: color-mix(in srgb, var(--sw-heading, var(--sw-text)) 7%, transparent);
  }
  svg.chart text {
    fill: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  svg.chart text.val {
    fill: var(--sw-text-2);
  }
  /* WKWATER-POLISH-2331: the chart is drawn at the card's own width (page-usage.ts measures it), so it fills the card instead of a
     560 px island beside an empty half */
  .usage-chart {
    min-inline-size: 0;
  }
  .legend {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .legend i {
    display: inline-block;
    inline-size: 10px;
    block-size: 10px;
    border-radius: 2px;
    margin-inline-end: 4px;
    vertical-align: -1px;
  }
  .share {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .share i {
    display: inline-block;
    inline-size: 56px;
    block-size: 6px;
    border-radius: 3px;
    background: var(--sw-surface-3);
    overflow: hidden;
  }
  .share i b {
    display: block;
    block-size: 100%;
    background: var(--sw-accent);
  }
  .up {
    color: var(--sw-danger-text);
  }
  .down {
    color: var(--sw-success-text);
  }
  .bad {
    color: var(--sw-danger-text);
    font-weight: var(--sw-fw-semibold);
  }
  .acts {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
  }
  .li .acts {
    flex: none;
  }
  table.t td {
    padding-block: 9px;
  }
  .backrow {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .cols.side {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 14px;
    align-items: start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .cols.side .card {
    padding: 12px 14px;
  }
  .cols.side .kv {
    gap: 3px 14px;
  }
  .formgrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .formgrid .wide {
    grid-column: 1 / -1;
  }
  .chips-ed {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .chips-ed .chip {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  .chips-ed .chip::before {
    display: none;
  }
  .chips-ed .chip button {
    all: unset;
    cursor: pointer;
    display: inline-grid;
    place-items: center;
    inline-size: 18px;
    block-size: 18px;
    border-radius: 50%;
  }
  .chips-ed .chip button:hover,
  .chips-ed .chip button:focus-visible {
    background: var(--sw-surface-3);
  }
  .sect-nav {
    align-self: flex-start;
  }
  /* WKWATER-POLISH-2331: the page rules that were inline styles - a tile whose figure is an alarm, the end column of a phone row (the
     chip over the reading), its amount line, the skeleton rows, the bill log rows */
  /* a time window (01:00-05:00) is one LTR unit: it never breaks at its dash, never reads backwards in RTL */
  .tile .v .nw {
    white-space: nowrap;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .tile .v.alarm {
    color: var(--sw-danger-text);
  }
  .rowend {
    flex: none;
    text-align: end;
  }
  .rowend .t2 {
    margin-block-start: var(--sw-s-1);
  }
  .li .amt {
    flex: none;
    text-align: end;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading, var(--sw-text));
  }
  .skrow {
    padding-block: 10px;
  }
  .li.pick:focus-visible,
  table.t tr.pick:focus-visible td,
  table.t tr.go:focus-visible td {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: calc(var(--sw-focus-w) * -1);
  }
  /* NOSCROLL-297 on the usage and alerts pages (infra-water.ts gives them the height under the tab rows): the list's card shrinks to the
     room left and scrolls inside, its header row in place; it never grows past its rows */
  @media (min-width: 900px) {
    .page.fit {
      flex: 1 1 auto;
      min-block-size: 0;
    }
    .page.fit > .fitbox {
      flex: 0 1 auto;
      min-block-size: 160px;
      overflow: auto;
      scrollbar-width: thin;
    }
    .page.fit > .fitbox table.t thead th {
      position: sticky;
      inset-block-start: 0;
      z-index: 1;
    }
  }
  /* a sheet's form keeps its save / cancel row in view: the row sticks to the foot of the scrolling sheet body */
  .formacts {
    position: sticky;
    inset-block-end: 0;
    z-index: 2;
    margin-block-end: calc(var(--sw-s-3) * -1);
    padding-block: var(--sw-s-3);
    background: var(--sw-surface-solid, var(--sw-surface));
    box-shadow: 0 -1px 0 var(--sw-border);
  }
  /* the bills page's state filter: on a narrow window the segments scroll sideways inside their own row, the search takes the next line */
  @media (max-width: 1099px) {
    .seg.scroll-seg {
      max-inline-size: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
  }
  .phone-only {
    display: none;
  }
  .notice {
    font-size: var(--sw-fs-sm);
    color: var(--sw-success-text, var(--sw-live-text));
  }
  .paper {
    background: var(--sw-surface-solid, var(--sw-surface));
    color: var(--sw-text);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-md);
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .paper table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--sw-fs-sm);
  }
  .paper th,
  .paper td {
    padding: 6px 8px;
    border-block-end: 1px solid var(--sw-border);
    text-align: start;
  }
  .paper th.n,
  .paper td.n {
    text-align: end;
  }
  .paper tfoot td {
    font-weight: var(--sw-fw-semibold);
    border-block-end: 0;
  }
  .paper .tot td {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading, var(--sw-text));
  }
  @media (max-width: 899px) {
    .cols.side {
      grid-template-columns: minmax(0, 1fr);
    }
    .phone-only {
      display: flex;
    }
    .desk-only {
      display: none;
    }
  }
  @media (max-width: 767px) {
    .formgrid {
      grid-template-columns: minmax(0, 1fr);
    }
    .li {
      flex-wrap: wrap;
    }
    .li .acts {
      flex-basis: 100%;
      justify-content: flex-start;
    }
  }
  @media (max-width: 1099px) {
    .dsk {
      display: none;
    }
  }
`,rt=[Os,xe],Se=new Intl.NumberFormat(Wt(),{minimumFractionDigits:3,maximumFractionDigits:3});new Intl.NumberFormat(Wt(),{maximumFractionDigits:1});const ze=new Intl.NumberFormat(Wt(),{minimumFractionDigits:2,maximumFractionDigits:2});function y(t){if(t==null||t==="")return"-";const s=typeof t=="number"?t:Number(t);return Number.isFinite(s)?Se.format(s):"-"}function k(t){if(t==null||t==="")return"";const s=typeof t=="number"?t:Number(t);return Number.isFinite(s)?`${ze.format(s)} ₪`:""}const kt={draft:{label:"טיוטה",cls:"c-mut"},issued:{label:"הונפק",cls:"c-acc"},sent:{label:"נשלח",cls:"c-warn"},paid:{label:"שולם",cls:"c-ok"},void:{label:"בוטל",cls:"c-err"}};function Ht(t){return t.status==="paused"?{label:"מושהה",cls:"c-mut"}:t.stale_meters.length?{label:"מונה לא מדווח",cls:"c-warn"}:{label:"פעיל",cls:"c-ok"}}const ms={off:"בלי יצירה אוטומטית",draft:"ליצור טיוטה",issue:"להנפיק אוטומטית"};function $s(t,s){return`${t===1?"חודשית":"דו-חודשית"} · מה-${s}`}function Ce(t){return{water:t.filter(s=>s.component==="water"),sewage:t.filter(s=>s.component==="sewage")}}function tt(t){return t<60?`${t} ד׳`:t===60?"שעה":t<1440?t%60===0?`${t/60} שעות`:`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")} שעות`:t===1440?"יממה":t%1440===0?`${t/1440} ימים`:`${Math.round(t/1440*10)/10} ימים`}function es(t,s,a="Asia/Jerusalem"){const r=new Date(t.getTime()+s*6e4),i=h=>new Intl.DateTimeFormat("en-CA",{timeZone:a,year:"numeric",month:"2-digit",day:"2-digit"}).format(h),o=new Intl.DateTimeFormat(Wt(),{timeZone:a,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(r),l=Math.round((Date.parse(i(r))-Date.parse(i(t)))/864e5);return l<=0?o:l===1?`מחר ${o}`:`${l} ימים, ${o}`}const Pt={min:5,max:43200,count:12};function Kt(t){return!Number.isInteger(t.max)||t.max<Pt.min||t.max>Pt.max?"המקסימום הוא בין 5 דקות ל-30 ימים.":!t.durations.length||t.durations.length>Pt.count?"יש להציע בין משך אחד ל-12 משכים.":t.durations.some(s=>!Number.isInteger(s)||s<Pt.min||s>t.max)?"משך נדנוד ארוך מהמקסימום.":t.durations.includes(t.default)?null:"ברירת המחדל חייבת להיות אחד מהמשכים המוצעים."}function Ae(t,s){return Math.round(t*(s==="min"?1:s==="hour"?60:1440))}function De(t,s,a,r){const i=Number(t)+Number(s);return Number.isFinite(i)?a==="inc_vat"?Math.round(i*100)/100:r===null?null:Math.round(i*(1+Number(r)/100)*100)/100:null}function Zt(t){const s=t;if(!s||typeof s!="object")return null;if(typeof s.m=="string")return[{sign:1,meter_id:s.m}];if((s.op==="+"||s.op==="-")&&Array.isArray(s.args)&&s.args.length>=2){const a=s.args.map(o=>Zt(o));if(a.some(o=>o===null))return null;const[r,...i]=a;return[...r,...i.flatMap(o=>s.op==="-"?o.map(l=>({...l,sign:l.sign*-1})):o)]}return null}function vs(t){const s=new Set,a=t.filter(l=>l.meter_id&&!s.has(l.meter_id)&&s.add(l.meter_id)),r=a.filter(l=>l.sign>0),i=a.filter(l=>l.sign<0);if(!r.length)return null;let o={m:r[0].meter_id};for(const l of r.slice(1))o={op:"+",args:[o,{m:l.meter_id}]};for(const l of i)o={op:"-",args:[o,{m:l.meter_id}]};return o}function Pe(t,s){return(t.state==="issued"||t.state==="sent")&&!!t.due_date&&t.due_date<s}const as={tab:"מים",pageRow:"עמודים",offTitle:"המודול כבוי",offHint:"מוני מים מופעלים בהגדרות המערכת",toSettings:"להגדרות",forbidden:"אין הרשאה",noScreen:"אין מסך",retry:"נסה שוב",cancel:"ביטול",save:"שמירה",back:"חזרה",close:"סגירה",remove:"הסרה",add:"הוספה",loading:"טוען",csv:"ייצוא CSV",m3:"מ״ק",litre:"ליטר",lph:"ליטר לשעה",ils:"₪",search:"חיפוש מונה",view:"תצוגה",cards:"כרטיסים",table:"טבלה",addMeter:"הוספת מונה",allAreas:"כל האזורים",areas:"אזורים",fold:"כיווץ",unfold:"הרחבה",area:"אזור",tToday:"היום",tMonth:"מתחילת החודש",tReporting:"מדווחים",tOf:"מתוך {n}",tLeak:"דליפה חשודה",tMeters:"מונים",colName:"שם",colArea:"אזור",colReading:"קריאה נוכחית (מ״ק)",colToday:"היום",colMonth:"מתחילת החודש",colNight:"ספיקת לילה",colState:"מצב",todayM3:"מ״ק היום",nightOff:"כבוי",emptyMeters:"אין מונים עדיין",noResults:"לא נמצאו מונים",loadMetersError:"לא ניתן לטעון את המונים",stReporting:"מדווח",stNotReporting:"לא מדווח",stNotReportingSince:"לא מדווח מ-{t}",stPaused:"מושהה",stRetired:"הוצא משימוש",stLeak:"דליפה חשודה",stAbnormal:"צריכה חריגה",addTitle:"הוספת מונה",candSearch:"חיפוש חיישן לפי שם",candNone:"לא נמצאו חיישנים מתאימים",candRejected:"לא מתאים",meterName:"שם המונה",meterKind:"סוג",added:"המונה נוסף",kMain:"ראשי",kSub:"משני",kIrrigation:"השקיה",kCooling:"קירור",kPool:"בריכה",kOther:"אחר",cardLoadError:"לא ניתן לטעון את המונה",fArea:"אזור",fReading:"קריאה נוכחית",fLast:"דיווח אחרון",fUnit:"יחידה",fUnitValue:"מ״ק · מונה מצטבר",fKind:"סוג",fNight:"ספיקת לילה",fNightOff:"כלל הלילה כבוי (השקיה)",fRules:"כללי דליפה",fRulesDefault:"ברירת המחדל של המערכת · לילה {w}",fRulesOwn:"כללים של המונה · לילה {w}",usage:"צריכה",range:"טווח",r24h:"24 שעות",r30d:"30 ימים",r12m:"12 חודשים",chartAria:"גרף צריכה, {r}",chartError:"לא ניתן לטעון את גרף הצריכה",chartNoData:"אין נתונים לתקופה",nightNote:"ליטר לשעה · חלון הלילה {w} מודגש",openAlerts:"התראות פתוחות",epochs:"תקופות מונה",epochStart:"קריאת התחלה",epochUntil:"עד",epochActive:"פעיל",reasonFirst:"התקנה",reasonReplaced:"החלפת מונה",reasonSource:"שינוי מקור",readings:"קריאות ידניות וכיול",manualReading:"קריאה ידנית",noReadings:"אין קריאות ידניות",readingAt:"מועד הקריאה",readingValue:"קריאה",readingNote:"הערה (לא חובה)",readingSaved:"הקריאה נשמרה",readingUndo:"ביטול קריאה",readingVoided:"בוטלה",effAllocation:"הושלם פער דיווח",effRecorded:"נשמרה להשוואה",rename:"שינוי שם",renameTitle:"שינוי שם המונה",replace:"החלפת מונה",replaceFinal:"קריאה סופית של המונה הישן",replaceStart:"קריאת התחלה של המונה החדש",replaceNote:"הערה (לא חובה)",replaceBad:"צריך להזין קריאה תקינה",pause:"השהיה",resume:"חידוש",removeTitle:"הסרת המונה",removeBody:"המונה יוסר מהרשימה. הנתונים שנאספו יישמרו.",nameRequired:"צריך לכתוב שם למונה",ack:"אישור",acked:"ההתראה אושרה",snooze:"נדנוד {d}",snoozeOther:"משך נדנוד אחר",snoozeTo:"נדנוד ל...",snoozeUntil:"עד {t}",snoozedUntil:"מנודנדת עד {t}",snoozedToast:"ההתראה נודנדה ל-{d} (עד {t})",snoozeFoot:"המשכים נקבעים בהגדרות",unsnooze:"סיום נדנוד",fOpen:"פתוחות",fAll:"הכול",filter:"סינון",leakRules:"כללי דליפה",tOpen:"פתוחות",tClosedWeek:"נסגרו השבוע",tSnoozed:"מנודנדות",tRule:"כללי דליפה",ruleValue:"{lph} ליטר לשעה · {dur}",colMeter:"מונה",colKind:"סוג",colSince:"מאז",colValue:"ערך",akNight:"דליפה · ספיקה רציפה בלילה",akBurst:"פריצה",akAbnormal:"צריכה חריגה",akOffline:"לא מדווח",akHealth:"תקלה במונה",asOpen:"פתוחה",asAcked:"אושרה · {who}",asClosed:"נסגרה",asClosedBy:"נסגרה · {who}",valueRate:"{v} ליטר לשעה",valueRateTh:"{v} ליטר לשעה (סף {t})",valueAbnormal:"{v} מ״ק, רגיל {m}",emptyAlerts:"אין התראות",loadAlertsError:"לא ניתן לטעון את ההתראות",rToday:"היום",r7d:"7 ימים",rPrevMonth:"חודש קודם",tTotal:"סה״כ בטווח",tVsPrev:"לעומת התקופה הקודמת",tDailyAvg:"ממוצע יומי",tNightAvg:"ספיקת לילה ממוצעת",dailyUsage:"צריכה יומית",hourlyUsage:"צריכה לפי שעה",legendDay:"יום",legendNight:"לילה {w}",legendLeak:"דליפה חשודה",colUsage:"צריכה (מ״ק)",colShare:"חלק",colVsPrev:"לעומת הקודם",vsPrevShort:"לעומת הקודם",night:"לילה",emptyUsage:"אין נתוני צריכה עדיין",loadUsageError:"לא ניתן לטעון את הצריכה",csvDone:"הקובץ הורד",accSearch:"חיפוש חשבון או לקוח",newAccount:"חשבון חדש",tActiveAccounts:"חשבונות פעילים",tPeriodUsage:"צריכה בתקופה",tAmountSoFar:"סכום עד כה",tDrafts:"טיוטות לבדיקה",colAccount:"חשבון",colCustomer:"לקוח",colFormula:"נוסחה",colPeriod:"תקופה",colPeriodUsage:"צריכה בתקופה (מ״ק)",colAmount:"סכום עד כה",colLastBill:"חיוב אחרון",emptyAccounts:"אין חשבונות עדיין",noAccounts:"לא נמצאו חשבונות",loadAccountsError:"לא ניתן לטעון את החשבונות",accounts:"חשבונות",tabStatus:"מצב",tabHistory:"היסטוריה",tabBills:"חיובים",edit:"עריכה",createBill:"יצירת טיוטת חיוב",accDayOf:"יום {d} מתוך {n}",tForecast:"צפי לתקופה",tNextBill:"החיוב הבא",colStartReading:"קריאה בתחילת התקופה",colCurrentReading:"קריאה נוכחית",colContribution:"תרומה",staleNote:"המונה {name} לא מדווח: הצריכה שלו לא נספרת עד שידווח שוב.",customerCard:"כרטיס לקוח",priceCard:"מחיר",waterPrice:"מים למ״ק",sewagePrice:"ביוב למ״ק",incVat:"כולל מע״מ",exVat:"לפני מע״מ",vat:"מע״מ",autoMode:"חיוב אוטומטי",hMeasured:"נמדד",hPartial:"חלקי",hMissing:"חסר",hOpen:"פתוחה",colChange:"שינוי",colSum:"סכום",noHistory:"אין היסטוריה עדיין",noBills:"אין חיובים לחשבון",loadAccountError:"לא ניתן לטעון את החשבון",accFormNew:"חשבון חדש",accFormEdit:"עריכת חשבון",accName:"שם החשבון",accCustomer:"לקוח",accPickCustomer:"בחירת לקוח",accFormula:"נוסחת מונים",accAddPlus:"+ מונה",accAddMinus:"− מונה",accLossPreset:"הפרש כללי (אובדן ודליפות)",accPickMeter:"בחירת מונה",accMainMeter:"מונה ראשי",accTariff:"תעריף",accPeriod:"תקופה",accMonthly:"חודשית",accBimonthly:"דו-חודשית",accAnchorDay:"יום תחילת התקופה",accFirstStart:"תחילת התקופה הראשונה",accAuto:"מצב חיוב אוטומטי",accStatus:"מצב החשבון",accActive:"פעיל",accPaused:"מושהה",accDelete:"מחיקת חשבון",accDeleteBody:"החשבון יימחק. חיובים שהונפקו נשמרים.",errName:"צריך לכתוב שם",errCustomer:"צריך לבחור לקוח",errFormula:"צריך לפחות מונה אחד בסימן +",errTariff:"צריך לבחור תעריף",errDate:"תאריך לא תקין",billSearch:"חיפוש מספר או לקוח",stateFilter:"סינון לפי מצב",tBillDrafts:"טיוטות",tOpenAmount:"ממתינים לתשלום",tPaid:"שולמו",tLate:"באיחור",colNumber:"מספר",colM3:"מ״ק",colTotal:"סה״כ כולל מע״מ",colDue:"לתשלום עד",emptyBills:"אין חיובים עדיין",noBillsFound:"לא נמצאו חיובים",loadBillsError:"לא ניתן לטעון את החיובים",toAccounts:"לחשבונות",bills:"חיובים",billNo:"חיוב {no}",billDraft:"טיוטת חיוב",loadBillError:"לא ניתן לטעון את החיוב",pItem:"פריט",pQty:"כמות",pPrice:"מחיר",pAmount:"סכום",pWater:"מים",pSewage:"ביוב",pSubtotal:"סה״כ לפני מע״מ",pVat:"מע״מ {p}%",pTotal:"סה״כ לתשלום",pPeriod:"תקופה",pCustomerNo:"מספר לקוח",pIssued:"תאריך הנפקה",pDue:"לתשלום עד",pFormula:"מונים",details:"פרטים",log:"יומן",replaces:"מחליף את {no}",replacedBy:"הוחלף בחיוב המתוקן",originAuto:"נוצר אוטומטית",originManual:"נוצר ידנית",source:"מקור",sentOn:"נשלח",paidOn:"שולם",pdf:"PDF",pdfLater:"הפקת PDF לחיוב מים תתווסף בהמשך",aRecalc:"חישוב מחדש",aIssue:"הנפקה",aSent:"סימון כנשלח",aPaid:"סימון כשולם",aCorrect:"תיקון",aVoid:"ביטול חיוב",aDelete:"מחיקת טיוטה",dIssueTitle:"הנפקת חיוב",dIssueBody:"החיוב יקבל מספר. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.",dVoidTitle:"ביטול חיוב",dVoidBody:"החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.",dVoidReason:"סיבת הביטול",dReasonRequired:"צריך לכתוב סיבה",dCorrectTitle:"תיקון חיוב",dCorrectBody:"תיווצר טיוטה מתוקנת. כשהיא תונפק, החיוב המקורי יבוטל אוטומטית.",dCorrectGo:"יצירת טיוטה מתוקנת",dSentTitle:"סימון כנשלח",dSentHow:"אופן משלוח",howEmail:"דוא״ל",howHand:"ביד",howOther:"אחר",dPaidTitle:"סימון כשולם",dPaidRef:"אסמכתה (לא חובה)",dDeleteTitle:"מחיקת טיוטה",dDeleteBody:"הטיוטה תימחק. אפשר ליצור אחרת מעמוד החשבון.",optional:"לא חובה",evCreated:"נוצרה טיוטה",evRecalculated:"חושב מחדש",evIssued:"הונפק",evSent:"סומן כנשלח",evPaid:"סומן כשולם",evVoided:"בוטל",evCorrected:"נוצר תיקון",evDeleted:"נמחק",custSearch:"חיפוש לקוח",newCustomer:"לקוח חדש",colCustNo:"מספר",colAddress:"כתובת / יחידה",colPhone:"טלפון",colEmail:"דוא״ל",colAccounts:"חשבונות",colBalance:"יתרה פתוחה",emptyCustomers:"אין לקוחות עדיין",noCustomers:"לא נמצאו לקוחות",loadCustomersError:"לא ניתן לטעון את הלקוחות",loadCustomerError:"לא ניתן לטעון את הלקוח",cName:"שם הלקוח",cNumber:"מספר לקוח",cTaxId:"ח.פ. / ע.מ. (לא חובה)",cAddress:"כתובת למשלוח החיוב",cPhone:"טלפון",cEmail:"דוא״ל",cNotes:"הערות",cNoAccounts:"אין חשבונות ללקוח",cRecentBills:"חיובים אחרונים",cDelete:"מחיקת לקוח",cDeleteBody:"הלקוח יימחק. חיובים שהונפקו שומרים עותק של פרטיו.",cDeleteRefused:"אי אפשר למחוק לקוח שיש לו חשבונות (מים או חשמל).",cShared:"כרטיס הלקוח משותף עם החשמל",errEmail:"כתובת דוא״ל לא תקינה",errCustNo:"מספר לקוח הוא ספרות בלבד",sTariffs:"תעריפי מים וביוב",sAlerts:"התראות והשהיה",sections:"חלקי ההגדרות",usedBy:"בשימוש ב-{n} חשבונות",newVersion:"גרסה חדשה",newTariff:"תעריף חדש",colFrom:"בתוקף מ-",colWaterM3:"מים למ״ק",colSewageM3:"ביוב למ״ק",colIncVat:"כולל מע״מ",current:"נוכחי",locked:"נעול",tariffName:"שם התעריף",priceMode:"המחיר מוזן",modeEx:"לפני מע״מ",modeInc:"כולל מע״מ",errPrice:"מחיר לא תקין",noTariffs:"אין תעריפים עדיין",loadTariffsError:"לא ניתן לטעון את התעריפים",delVersion:"מחיקת גרסה",shared:"משותף עם החשבון",sharedTitle:"משותף עם החשמל",sharedNote:"מע״מ, פרטי העסק, מספור, תנאי תשלום ושמירת נתונים - מהגדרות החיוב של החשמל.",vatInForce:"מע״מ בתוקף",toShared:"להגדרות החיוב המשותפות",snoozeCard:"השהיית התראה (נדנוד)",snoozeDurations:"משכי נדנוד מוצעים",snoozeAddValue:"משך להוספה",snoozeUnit:"יחידה",uMin:"דקות",uHour:"שעות",uDay:"ימים",snoozeDefault:"ברירת מחדל של כפתור «נדנוד»",snoozeMax:"נדנוד מרבי",removeDuration:"הסרת {d}",keepOne:"חייב להישאר לפחות משך אחד",saved:"נשמר",rulesCard:"כללי דליפה",rWindow:"חלון לילה",rThreshold:"סף",rDuration:"משך",rulesReadonly:"הכללים נשארים כפי שאושרו ואינם משתנים כאן.",noConfigure:"שינוי ההגדרות זמין למנהלי מערכת",conflict:"מישהו אחר שינה בינתיים. הנתונים רועננו, נסו שוב.",hours:"{n} שעות",hour1:"שעה",hours2:"שעתיים",minutes:"{n} דקות"},Bs=Ks("en","water/i18n","en");function is(){return(typeof document<"u"?(document.documentElement?.lang||"").toLowerCase():"").startsWith("en")?"en":"he"}const Me={he:as,en:Bs};function e(t,s,a=is()){const r=Me[a][t]??as[t]??t;return s?r.replace(/\{(\w+)\}/g,(i,o)=>o in s?String(s[o]):i):r}Ys("water/i18n",{he:as,en:Bs});var Ee=Object.defineProperty,Ne=Object.getOwnPropertyDescriptor,x=(t,s,a,r)=>{for(var i=r>1?void 0:r?Ne(s,a):s,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(s,a,i):l(i))||i);return r&&i&&Ee(s,a,i),i};const N="/infra/water/accounts",Yt=t=>n`<span class="chip ${t.cls}">${t.label}</span>`,Bt=t=>n`<span class="chip ${kt[t.state].cls}" data-bill-state=${t.state}>${kt[t.state].label}</span>`,It=t=>t?`${J(t.from)} - ${J(t.to)}`:"-",Mt=(t=6)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`,Re=()=>new Date().toISOString().slice(0,10),Oe=()=>`${Re().slice(0,8)}01`,fs=()=>({name:"",customer_id:"",terms:[{sign:1,meter_id:""}],keepAst:null,tariff_id:"",period_months:1,period_anchor_day:1,first_period_start:Oe(),auto_mode:"draft",status:"active"});let _=class extends et{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.st="loading",this.rows=[],this.drafts=null,this.statuses={},this.q="",this.acc=null,this.accSt="loading",this.status=null,this.history=null,this.bills=null,this.error="",this.busy=!1,this.form=fs(),this.errs={},this.customers=[],this.tariffs=[],this.meters=[],this.confirmDel=!1,this.shown=""}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t)}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const[s,a]=this.segments,r=`${s??""}/${a??""}`;if(r===this.shown)return;const i=this.shown.split("/")[0];this.shown=r,this.error="",this.errs={},this.confirmDel=!1,s?s==="new"?this.openForm(null):((s!==i||!this.acc)&&this.loadAccount(s),a==="edit"&&this.openForm(s),a==="history"&&!this.history&&this.loadHistory(s),a==="bills"&&!this.bills&&this.access.bills&&this.loadBills(s)):this.loadList()}async loadList(){this.st="loading";try{const t=await v.listAccounts();this.rows=t.items,this.drafts=t.summary.drafts,this.st="ready";const s={};await Promise.all(t.items.slice(0,60).map(async a=>s[a.id]=await v.accountStatus(a.id).catch(()=>null))),this.statuses=s}catch{this.st="error"}}async loadAccount(t){this.accSt="loading",this.history=null,this.bills=null;try{const[s,a]=await Promise.all([v.account(t),v.accountStatus(t).catch(()=>null)]);this.acc=s,this.status=a,this.accSt="ready";const r=this.segments[1];r==="history"&&this.loadHistory(t),r==="bills"&&this.access.bills&&this.loadBills(t)}catch(s){this.error=M(s),this.accSt="error"}}async loadHistory(t){try{this.history=(await v.accountHistory(t)).periods}catch{this.history=[]}}async loadBills(t){try{this.bills=(await v.accountBills(t)).items}catch{this.bills=[]}}async openForm(t){this.errs={},this.error="",t||(this.form=fs());const[s,a,r]=await Promise.all([v.listCustomers().then(i=>i.items).catch(()=>[]),v.listTariffs().then(i=>i.items).catch(()=>[]),w.listMeters().catch(()=>[])]);if(this.customers=s,this.tariffs=a,this.meters=r.filter(i=>i.status!=="retired"),t){const i=this.acc?.id===t?this.acc:await v.account(t).catch(()=>null);if(i){const o=Zt(i.formula.ast);this.form={name:i.name,customer_id:i.customer?.id??"",terms:o??[],keepAst:o?null:i.formula.ast,tariff_id:i.tariff.id,period_months:i.period_months,period_anchor_day:i.period_anchor_day,first_period_start:i.first_period_start,auto_mode:i.auto_mode,status:i.status}}}else!this.form.tariff_id&&a.length===1&&(this.form={...this.form,tariff_id:a[0].id})}setF(t,s){this.form={...this.form,[t]:s},this.errs[t]&&(this.errs={...this.errs,[t]:""})}setTerm(t,s){const a=this.form.terms.map((r,i)=>i===t?{...r,...s}:r);this.form={...this.form,terms:a,keepAst:null},this.errs={...this.errs,formula:""}}async lossPreset(){const t=this.form.terms.find(s=>s.sign>0&&s.meter_id)?.meter_id??this.meters.find(s=>s.kind==="main")?.id??this.meters[0]?.id;if(t)try{const s=await v.preset("main_minus_subs",this.meters.map(r=>r.id),t),a=Zt(s.ast);a&&(this.form={...this.form,terms:a,keepAst:null,name:this.form.name||e("accLossPreset")})}catch(s){this.error=M(s)}}validate(){const t=this.form,s={};return t.name.trim()||(s.name=e("errName")),t.customer_id||(s.customer_id=e("errCustomer")),!t.keepAst&&!vs(t.terms)&&(s.formula=e("errFormula")),t.tariff_id||(s.tariff_id=e("errTariff")),/^\d{4}-\d{2}-\d{2}$/.test(t.first_period_start)||(s.first_period_start=e("errDate")),this.errs=s,!Object.keys(s).length}async save(t){if(this.busy||!this.validate())return;const s=this.form,a={name:s.name.trim(),customer_id:s.customer_id,tariff_id:s.tariff_id,period_months:s.period_months,period_anchor_day:s.period_anchor_day,first_period_start:s.first_period_start,auto_mode:s.auto_mode,...s.keepAst?{}:{formula:{ast:vs(s.terms)}}};this.busy=!0,this.error="";try{if(t&&this.acc){const r=await v.updateAccount(t,{...a,status:s.status,base_revision:this.acc.revision});this.acc=r,b(`${N}/${r.id}`),this.loadAccount(r.id)}else{const r=await v.createAccount(a);b(`${N}/${r.id}`)}}catch(r){this.error=M(r)}finally{this.busy=!1}}async removeRecord(){if(!(!this.acc||this.busy)){this.busy=!0;try{await v.deleteAccount(this.acc.id,this.acc.revision),this.acc=null,b(N)}catch(t){this.error=M(t),this.confirmDel=!1}finally{this.busy=!1}}}fld(t,s,a,r=!1){return n`<div class="fld ${r?"wide":""}"><label for="wa-${t}">${s}</label>${a}${this.errs[t]?n`<div class="msg" role="alert" data-field-error=${t}>${this.errs[t]}</div>`:d}</div>`}renderForm(t){const s=this.form,a=r=>n`<option value="" ?selected=${!r}>${e("accPickMeter")}</option>${this.meters.map(i=>n`<option value=${i.id} ?selected=${i.id===r}>${i.display_name}</option>`)}`;return n`<sw-sheet open wide .heading=${e(t?"accFormEdit":"accFormNew")} data-account-form @close=${()=>b(t?`${N}/${t}`:N)}>
      <div class="col">
        <div class="formgrid">
          ${this.fld("name",e("accName"),n`<input id="wa-name" name="name" class=${this.errs.name?"err":""} .value=${s.name} @input=${r=>this.setF("name",r.target.value)} />`,!0)}
          ${this.fld("customer_id",e("accCustomer"),n`<select id="wa-customer_id" name="customer_id" @change=${r=>this.setF("customer_id",r.target.value)}><option value="" ?selected=${!s.customer_id}>${e("accPickCustomer")}</option>${this.customers.map(r=>n`<option value=${r.id} ?selected=${r.id===s.customer_id}>${r.name} · ${r.customer_number}</option>`)}</select>`)}
          ${this.fld("tariff_id",e("accTariff"),n`<select id="wa-tariff_id" name="tariff_id" @change=${r=>this.setF("tariff_id",r.target.value)}><option value="" ?selected=${!s.tariff_id}>-</option>${this.tariffs.map(r=>n`<option value=${r.id} ?selected=${r.id===s.tariff_id}>${r.name}</option>`)}</select>`)}
        </div>
        <div class="fld"><span class="lbl">${e("accFormula")}</span>
          ${s.keepAst&&this.acc?n`<div class="mut" data-formula-kept>${this.acc.formula.sentence_he}</div>`:d}
          <div class="list" data-formula-terms>${s.terms.map((r,i)=>n`<div class="row" style="flex-wrap:nowrap" data-term=${i}>
            <div class="seg" role="group" aria-label=${e("accFormula")}><button type="button" aria-pressed=${r.sign>0?"true":"false"} data-sign="+" @click=${()=>this.setTerm(i,{sign:1})}>+</button><button type="button" aria-pressed=${r.sign<0?"true":"false"} data-sign="-" @click=${()=>this.setTerm(i,{sign:-1})}>−</button></div>
            <select aria-label=${e("accPickMeter")} style="flex:1" @change=${o=>this.setTerm(i,{meter_id:o.target.value})}>${a(r.meter_id)}</select>
            <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${e("remove")} @click=${()=>this.form={...this.form,terms:s.terms.filter((o,l)=>l!==i),keepAst:null}}></sw-button></div>`)}</div>
          <div class="row">
            <sw-button size="sm" data-add-plus @click=${()=>this.form={...s,terms:[...s.terms,{sign:1,meter_id:""}],keepAst:null}}>${e("accAddPlus")}</sw-button>
            <sw-button size="sm" data-add-minus @click=${()=>this.form={...s,terms:[...s.terms,{sign:-1,meter_id:""}],keepAst:null}}>${e("accAddMinus")}</sw-button>
            <span class="sp"></span>
            <sw-button size="sm" data-loss-preset ?disabled=${!this.meters.length} @click=${()=>void this.lossPreset()}>${e("accLossPreset")}</sw-button></div>
          ${this.errs.formula?n`<div class="msg" role="alert" data-field-error="formula">${this.errs.formula}</div>`:d}</div>
        <div class="formgrid">
          <div class="fld"><span class="lbl">${e("accPeriod")}</span><div class="seg" role="group" aria-label=${e("accPeriod")}>
            <button type="button" aria-pressed=${s.period_months===1?"true":"false"} @click=${()=>this.setF("period_months",1)}>${e("accMonthly")}</button>
            <button type="button" aria-pressed=${s.period_months===2?"true":"false"} @click=${()=>this.setF("period_months",2)}>${e("accBimonthly")}</button></div></div>
          ${this.fld("period_anchor_day",e("accAnchorDay"),n`<input id="wa-period_anchor_day" type="number" min="1" max="31" class="ltr" .value=${String(s.period_anchor_day)} @input=${r=>this.setF("period_anchor_day",Math.min(31,Math.max(1,Number(r.target.value)||1)))} />`)}
          ${this.fld("first_period_start",e("accFirstStart"),n`<input id="wa-first_period_start" type="date" lang=${Ns()} class="ltr ${this.errs.first_period_start?"err":""}" .value=${s.first_period_start} @change=${r=>this.setF("first_period_start",r.target.value)} />`)}
          ${this.fld("auto_mode",e("accAuto"),n`<select id="wa-auto_mode" @change=${r=>this.setF("auto_mode",r.target.value)}>${["off","draft","issue"].map(r=>n`<option value=${r} ?selected=${r===s.auto_mode}>${ms[r]}</option>`)}</select>`)}
          ${t?n`<div class="fld"><span class="lbl">${e("accStatus")}</span><div class="seg" role="group" aria-label=${e("accStatus")}>
            <button type="button" aria-pressed=${s.status==="active"?"true":"false"} @click=${()=>this.setF("status","active")}>${e("accActive")}</button>
            <button type="button" aria-pressed=${s.status==="paused"?"true":"false"} @click=${()=>this.setF("status","paused")}>${e("accPaused")}</button></div></div>`:d}
        </div>
        ${this.error?n`<div class="alert err" role="alert">${this.error}</div>`:d}
        <div class="row formacts"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save(t)}>${e("save")}</sw-button>
          <sw-button @click=${()=>b(t?`${N}/${t}`:N)}>${e("cancel")}</sw-button><span class="sp"></span>
          ${t?n`<sw-button variant="danger" data-delete @click=${()=>this.confirmDel=!0}>${e("accDelete")}</sw-button>`:d}</div>
      </div>
      <elec-dialog heading=${e("accDelete")} ?open=${this.confirmDel} data-dialog="delete-account" @close=${()=>this.confirmDel=!1}>
        <div>${e("accDeleteBody")}</div>
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeRecord()}>${e("accDelete")}</sw-button>
        <sw-button slot="actions" @click=${()=>this.confirmDel=!1}>${e("cancel")}</sw-button>
      </elec-dialog>
    </sw-sheet>`}renderList(){const t=this.access.bills,s=this.q.trim(),a=this.rows.filter(u=>!s||u.name.includes(s)||(u.customer?.name??"").includes(s)),r=n`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-acc-search placeholder=${e("accSearch")} aria-label=${e("accSearch")} .value=${this.q} @input=${u=>this.q=u.target.value} /></label>
      <span class="sp"></span>
      ${this.access.manage?n`<sw-button variant="primary" icon="plus" data-new-account @click=${()=>b(`${N}/new`)}>${e("newAccount")}</sw-button>`:d}
    </div>`;if(this.st==="loading")return n`<div class="page" data-water="accounts" data-state="loading">${r}${Mt()}</div>`;if(this.st==="error")return n`<div class="page" data-water="accounts" data-state="error"><sw-state-panel state="error" heading=${e("loadAccountsError")} actionLabel=${e("retry")} @action=${()=>void this.loadList()}></sw-state-panel></div>`;if(!this.rows.length)return n`<div class="page" data-water="accounts" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${e("emptyAccounts")}>${this.access.manage?n`<sw-button variant="primary" data-new-account @click=${()=>b(`${N}/new`)}>${e("newAccount")}</sw-button>`:d}</sw-state-panel></div>`;const i=this.statuses,o=this.rows.reduce((u,T)=>u+Number(i[T.id]?.m3_so_far??0),0),l=this.rows.reduce((u,T)=>u+Number(i[T.id]?.amount_so_far??0),0),h=n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${e("tActiveAccounts")}</div><div class="v"><span class="num">${this.rows.filter(u=>u.status==="active").length}</span></div></div>
      <div class="tile"><div class="k">${e("tPeriodUsage")}</div><div class="v"><span class="num">${y(o)}</span><span class="u">${e("m3")}</span></div></div>
      ${t?n`<div class="tile"><div class="k">${e("tAmountSoFar")}</div><div class="v"><span class="num">${k(l).replace(" ₪","")}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${e("tDrafts")}</div><div class="v"><span class="num">${this.drafts??0}</span></div></div>`:d}
    </div>`,$=u=>u.last_bill?n`${u.last_bill.number?n`<span class="num">${u.last_bill.number}</span>`:e("tBillDrafts")} ${Bt(u.last_bill)}`:n`<span class="mut">-</span>`,p=a.length?n`<div class="card flush scrollx desk-only"><table class="t" data-acc-table>
          <thead><tr><th>${e("colAccount")}</th><th>${e("colCustomer")}</th><th class="hide-tablet">${e("colFormula")}</th><th>${e("colPeriod")}</th><th class="n">${e("colPeriodUsage")}</th>${t?n`<th class="n">${e("colAmount")}</th><th>${e("colLastBill")}</th>`:d}<th>${e("colState")}</th></tr></thead>
          <tbody>${a.map(u=>n`<tr class="go" data-account-row=${u.id} @click=${()=>b(`${N}/${u.id}`)}>
            <td class="b"><a class="rowlink" href=${`#${N}/${u.id}`} @click=${T=>T.stopPropagation()}>${u.name}</a></td><td>${u.customer?.name??"-"}</td>
            <td class="mut ell hide-tablet">${u.formula.sentence_he}</td><td>${$s(u.period_months,u.period_anchor_day)}</td>
            <td class="n"><span class="num">${y(i[u.id]?.m3_so_far??null)}</span></td>
            ${t?n`<td class="n"><span class="num">${i[u.id]?.amount_so_far!==void 0?k(i[u.id]?.amount_so_far):""}</span></td><td>${$(u)}</td>`:d}
            <td>${Yt(Ht(u))}</td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-acc-rows>${a.map(u=>n`<a class="li" href=${`#${N}/${u.id}`} data-account-row=${u.id}>
          <div class="grow"><div class="t1">${u.name}</div><div class="t2">${u.customer?.name??""} · <span class="num">${y(i[u.id]?.m3_so_far??null)}</span> ${e("m3")}${t&&i[u.id]?.amount_so_far?n` · <span class="num">${k(i[u.id]?.amount_so_far)}</span>`:d}</div></div>${Yt(Ht(u))}</a>`)}</div>`:n`<sw-state-panel icon="search" state="empty" compact heading=${e("noAccounts")}></sw-state-panel>`;return n`<div class="page" data-water="accounts" data-state="ready">${r}${h}${p}</div>`}renderStatus(t){const s=this.status,a=this.access.bills,r=n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${e("tPeriodUsage")}</div><div class="v"><span class="num">${y(s?.m3_so_far??null)}</span><span class="u">${e("m3")}</span></div></div>
      <div class="tile"><div class="k">${e("colPeriod")}</div><div class="v"><span class="num" style="font-size:var(--sw-fs-md)">${s?.day_of_period&&s.days?e("accDayOf",{d:s.day_of_period,n:s.days}):"-"}</span></div></div>
      <div class="tile"><div class="k">${e("tForecast")}</div><div class="v"><span class="num">${y(s?.m3_forecast??null)}</span><span class="u">${e("m3")}</span></div></div>
      ${a?n`<div class="tile"><div class="k">${e("tAmountSoFar")}</div><div class="v"><span class="num">${s?.amount_so_far?k(s.amount_so_far).replace(" ₪",""):"-"}</span><span class="u">₪</span></div></div>`:d}
    </div>`,i=n`<div class="card flush scrollx" data-acc-meters><table class="t">
      <thead><tr><th>${e("colMeter")}</th><th class="n">${e("colStartReading")}</th><th class="n">${e("colCurrentReading")}</th><th class="n">${e("colUsage")}</th><th class="n">${e("colContribution")}</th></tr></thead>
      <tbody>${(s?.meters??[]).map(h=>n`<tr data-acc-meter=${h.meter_id}><td class="b">${Number(h.coefficient)<0?"− ":""}${h.name}${h.reporting?d:n` <span class="chip c-warn">${e("stNotReporting")}</span>`}</td>
        <td class="n"><span class="num">${y(h.start_m3)}</span></td><td class="n"><span class="num">${y(h.current_m3)}</span></td><td class="n"><span class="num">${y(h.consumption_m3)}</span></td><td class="n"><span class="num">${y(h.contribution_m3)}</span></td></tr>`)}</tbody></table></div>`,o=t.tariff,l=n`<div class="col">
      <div class="card"><div class="hd"><b>${e("customerCard")}</b></div><dl class="kv"><dt>${e("cName")}</dt><dd>${t.customer?.name??"-"}</dd><dt>${e("cNumber")}</dt><dd class="num">${t.customer?.customer_number??"-"}</dd>${t.customer?.address?n`<dt>${e("cAddress")}</dt><dd>${t.customer.address}</dd>`:d}</dl></div>
      <div class="card"><div class="hd"><b>${e("priceCard")}</b></div><dl class="kv"><dt>${e("accTariff")}</dt><dd>${o.name}</dd>
        ${a&&o.water_price!=null?n`<dt>${e("waterPrice")}</dt><dd class="num">${k(o.water_price)}</dd><dt>${e("sewagePrice")}</dt><dd class="num">${k(o.sewage_price)}</dd><dt>${e("colIncVat")}</dt><dd class="num">${o.price_inc_vat?k(o.price_inc_vat):"-"}</dd>`:d}
        <dt>${e("autoMode")}</dt><dd>${ms[t.auto_mode]}</dd></dl></div>
      <div class="card"><div class="hd"><b>${e("tNextBill")}</b></div><dl class="kv"><dt>${e("colPeriod")}</dt><dd class="num">${It(t.next_period)}</dd><dt>${e("accPeriod")}</dt><dd>${$s(t.period_months,t.period_anchor_day)}</dd></dl></div>
    </div>`;return n`${r}${(s?.stale??[]).map(h=>n`<div class="alert warn" role="status"><span class="x" aria-hidden="true">!</span><div>${e("staleNote",{name:h.name})}</div></div>`)}<div class="cols side"><div class="col"><div class="mut">${t.formula.sentence_he}</div>${i}</div>${l}</div>`}renderHistory(){const t=this.history;if(!t)return Mt(4);if(!t.length)return n`<sw-state-panel icon="history" state="empty" compact heading=${e("noHistory")}></sw-state-panel>`;const s={measured:e("hMeasured"),partial:e("hPartial"),missing:e("hMissing"),open:e("hOpen")};return n`<div class="card flush scrollx" data-acc-history><table class="t"><thead><tr><th>${e("colPeriod")}</th><th class="n">${e("colM3")}</th><th class="n">${e("colChange")}</th><th>${e("colState")}</th>${this.access.bills?n`<th class="n">${e("colSum")}</th>`:d}</tr></thead>
      <tbody>${t.map((a,r)=>{const i=t[r+1]?.m3,o=a.m3!==null&&i?Math.round((Number(a.m3)-Number(i))/Number(i)*100):null;return n`<tr><td class="num" style="text-align:start">${It(a)}</td><td class="n"><span class="num">${y(a.m3)}</span></td><td class="n ${o===null||o===0?"":o>0?"up":"down"}"><span class="num">${o===null?"-":`${o>0?"+":""}${o}%`}</span></td>
          <td>${s[a.status]}</td>${this.access.bills?n`<td class="n"><span class="num">${a.bill?.total?k(a.bill.total):"-"}</span></td>`:d}</tr>`})}</tbody></table></div>`}renderBills(){if(!this.access.bills)return n`<sw-state-panel state="forbidden" compact></sw-state-panel>`;const t=this.bills;return t?t.length?rs(t,!1):n`<sw-state-panel icon="list" state="empty" compact heading=${e("noBills")}></sw-state-panel>`:Mt(4)}async createDraft(t){if(!this.busy){this.busy=!0,this.error="";try{const s=await v.createBill(t.id);b(`/infra/water/bills/${s.id}`)}catch(s){this.error=M(s)}finally{this.busy=!1}}}renderAccount(t,s){if(this.accSt==="loading"&&this.acc?.id!==t)return n`<div class="page" data-water="account" data-state="loading">${Mt(5)}</div>`;if(this.accSt==="error"||!this.acc)return n`<div class="page" data-water="account" data-state="error"><div class="backrow"><a class="btn ghost sm" href=${`#${N}`}><sw-icon name="chevronBack" size="13"></sw-icon>${e("accounts")}</a></div>
        <sw-state-panel state="error" heading=${e("loadAccountError")} hint=${this.error} actionLabel=${e("retry")} @action=${()=>void this.loadAccount(t)}></sw-state-panel></div>`;const a=this.acc,r=s==="history"||s==="bills"?s:"status";return n`<div class="page" data-water="account" data-state="ready" data-account-id=${a.id}>
      <div class="backrow"><a class="btn ghost sm" href=${`#${N}`} data-back><sw-icon name="chevronBack" size="13"></sw-icon>${e("accounts")}</a><b class="h3">${a.name}</b>${Yt(Ht(a))}<span class="sp"></span>
        ${this.access.bills?n`<sw-button data-create-bill ?disabled=${this.busy} @click=${()=>void this.createDraft(a)}>${e("createBill")}</sw-button>`:d}
        ${this.access.manage?n`<sw-button icon="edit" data-edit @click=${()=>b(`${N}/${a.id}/edit`)}>${e("edit")}</sw-button>`:d}</div>
      <div class="seg" role="group" aria-label=${e("accounts")} data-acc-tabs style="align-self:flex-start">
        <button type="button" aria-pressed=${r==="status"?"true":"false"} @click=${()=>b(`${N}/${a.id}`)}>${e("tabStatus")}</button>
        <button type="button" aria-pressed=${r==="history"?"true":"false"} @click=${()=>b(`${N}/${a.id}/history`)}>${e("tabHistory")}</button>
        ${this.access.bills?n`<button type="button" aria-pressed=${r==="bills"?"true":"false"} @click=${()=>b(`${N}/${a.id}/bills`)}>${e("tabBills")}</button>`:d}</div>
      ${this.error&&!this.segments.includes("edit")?n`<div class="alert err" role="alert">${this.error}</div>`:d}
      ${r==="status"?this.renderStatus(a):r==="history"?this.renderHistory():this.renderBills()}
    </div>`}render(){if(!this.access.view)return n`<sw-state-panel state="forbidden" data-water="accounts" data-state="forbidden"></sw-state-panel>`;const[t,s]=this.segments;return t?t==="new"?n`${this.renderList()}${this.access.manage?this.renderForm(null):d}`:n`${this.renderAccount(t,s??"")}${s==="edit"&&this.access.manage?this.renderForm(t):d}`:this.renderList()}};_.styles=[rt,st];x([E({attribute:!1})],_.prototype,"segments",2);x([E({attribute:!1})],_.prototype,"params",2);x([c()],_.prototype,"access",2);x([c()],_.prototype,"st",2);x([c()],_.prototype,"rows",2);x([c()],_.prototype,"drafts",2);x([c()],_.prototype,"statuses",2);x([c()],_.prototype,"q",2);x([c()],_.prototype,"acc",2);x([c()],_.prototype,"accSt",2);x([c()],_.prototype,"status",2);x([c()],_.prototype,"history",2);x([c()],_.prototype,"bills",2);x([c()],_.prototype,"error",2);x([c()],_.prototype,"busy",2);x([c()],_.prototype,"form",2);x([c()],_.prototype,"errs",2);x([c()],_.prototype,"customers",2);x([c()],_.prototype,"tariffs",2);x([c()],_.prototype,"meters",2);x([c()],_.prototype,"confirmDel",2);_=x([X("water-accounts-page")],_);function rs(t,s){const a=r=>b(`/infra/water/bills/${r.id}`);return n`<div class="card flush scrollx ${s?"":"desk-only"}"><table class="t" data-bill-table>
      <thead><tr><th>${e("colNumber")}</th><th>${e("colCustomer")}</th><th>${e("colAccount")}</th><th>${e("colPeriod")}</th><th class="n">${e("colM3")}</th><th class="n">${e("colTotal")}</th><th>${e("colDue")}</th><th>${e("colState")}</th></tr></thead>
      <tbody>${t.map(r=>n`<tr class="go" data-bill-row=${r.id} @click=${()=>a(r)}>
        <td class="b"><a class="rowlink num" href=${`#/infra/water/bills/${r.id}`} @click=${i=>i.stopPropagation()}>${r.number??e("tBillDrafts")}</a></td><td>${r.customer.name??"-"}</td><td>${r.account_name}</td>
        <td class="num" style="text-align:start">${It(r.period)}</td><td class="n"><span class="num">${y(r.m3)}</span></td><td class="n"><span class="num">${r.total!==void 0?k(r.total):""}</span></td>
        <td class="num" style="text-align:start">${r.due_date?J(r.due_date):"-"}</td><td>${Bt(r)}</td></tr>`)}</tbody></table></div>
    ${s?d:n`<div class="list phone-only" style="flex-direction:column" data-bill-rows>${t.map(r=>n`<a class="li" href=${`#/infra/water/bills/${r.id}`} data-bill-row=${r.id}>
      <div class="grow"><div class="t1"><span class="num">${r.number??e("tBillDrafts")}</span> · ${r.customer.name??""}</div><div class="t2">${r.account_name} · <span class="num">${It(r.period)}</span> · <span class="num">${y(r.m3)}</span> ${e("m3")}</div></div>
      <div class="rowend">${Bt(r)}<div class="t2 num">${r.total!==void 0?k(r.total):""}</div></div></a>`)}</div>`}`}var Te=Object.defineProperty,Le=Object.getOwnPropertyDescriptor,At=(t,s,a,r)=>{for(var i=r>1?void 0:r?Le(s,a):s,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(s,a,i):l(i))||i);return r&&i&&Te(s,a,i),i};const Q=t=>t==null?"-":y(t/1e3),Ct=t=>t==="off"?e("nightOff"):t==null?"-":String(t),ts={main:"kMain",sub:"kSub",irrigation:"kIrrigation",cooling:"kCooling",pool:"kPool",other:"kOther"},Rt=t=>t in ts?e(ts[t]):t,Is=Object.keys(ts),Us=["night_flow","burst"];function xt(t,s){const a=s.filter(r=>r.meter_id===t&&!r.closed_at);return a.some(r=>Us.includes(r.kind))?"leak":a.some(r=>r.kind==="abnormal")?"abnormal":null}function Vs(t,s){return s==="leak"?n`<span class="chip c-err" data-status="leak">${e("stLeak")}</span>`:s==="abnormal"?n`<span class="chip c-warn" data-status="abnormal">${e("stAbnormal")}</span>`:t.state==="reporting"?n`<span class="chip c-ok" data-status="reporting">${e("stReporting")}</span>`:t.state==="paused"?n`<span class="chip c-mut" data-status="paused">${e("stPaused")}</span>`:t.state==="retired"?n`<span class="chip c-mut" data-status="retired">${e("stRetired")}</span>`:n`<span class="chip c-warn" data-status="not_reporting">${t.last_report_at?e("stNotReportingSince",{t:Ft(t.last_report_at)}):e("stNotReporting")}</span>`}const gs={night_flow:"akNight",burst:"akBurst",abnormal:"akAbnormal",offline:"akOffline",health:"akHealth"},Ot=t=>t in gs?e(gs[t]):t,Et=t=>typeof t=="number"&&Number.isFinite(t)?t:typeof t=="string"&&t.trim()!==""&&Number.isFinite(Number(t))?Number(t):null,Tt=new Intl.NumberFormat("en-US",{maximumFractionDigits:1});function Lt(t){const s=t.value??{};if(t.kind==="night_flow"||t.kind==="burst"){const a=Et(s.floor_lph??s.rate_lph),r=Et(s.threshold_lph);return a===null?"-":r===null?e("valueRate",{v:Tt.format(a)}):e("valueRateTh",{v:Tt.format(a),t:Tt.format(r)})}if(t.kind==="abnormal"){const a=Et(s.today_l),r=Et(s.median_l);return a===null?"-":e("valueAbnormal",{v:y(a/1e3),m:r===null?"-":y(r/1e3)})}return"-"}function bs(t){return t.closed_at?n`<span class="chip c-ok" data-event-state="closed">${t.ack_by_display?e("asClosedBy",{who:t.ack_by_display}):e("asClosed")}</span>`:t.snoozed_until?n`<span class="chip c-mut" data-event-state="snoozed">${e("snoozedUntil",{t:Ft(t.snoozed_until)})}</span>`:t.ack_at?n`<span class="chip c-acc" data-event-state="acked">${e("asAcked",{who:t.ack_by_display??""})}</span>`:n`<span class="chip ${t.severity==="alarm"||Us.includes(t.kind)?"c-err":"c-warn"}" data-event-state="open">${e("asOpen")}</span>`}function Ws(t,s,a=i=>Tt.format(i),r=640){const i=Math.max(320,Math.round(r)),o=170,l=26;if(!t.length)return n`<div class="mut">${e("chartNoData")}</div>`;const h=Math.max(...t.map(g=>g.value),1)*1.15,$=(i-l*2)/t.length,p=Math.min($*.64,24),u=Math.ceil(t.length/12),T=t.reduce((g,K,m)=>K.value>t[g].value?m:g,0);return n`<svg class="chart" viewBox="0 0 ${i} ${o}" role="img" aria-label=${s} data-chart>
    ${t.map((g,K)=>g.win?ht`<rect class="win" x=${i-l-(K+1)*$} y="4" width=${$} height=${o-26} />`:d)}
    ${ht`<line x1=${l} x2=${i-l} y1=${o-22} y2=${o-22} class="grid" />`}
    ${t.map((g,K)=>{const m=Math.max(g.value>0?2:0,g.value/h*(o-44)),z=g.night?Math.min(m,Math.max(g.night>0?2:0,g.night/h*(o-44))):0,Y=i-l-(K+1)*$+($-p)/2,nt=K===t.length-1,ft=g.leak?"bar leak":nt?"bar hi":"bar";return ht`<rect class=${ft} x=${Y} y=${o-22-m} width=${p} height=${m} rx="3"><title>${g.title??`${g.label}: ${a(g.value)}`}</title></rect>
        ${z?ht`<rect class=${g.leak?"bar leak":"bar night"} x=${Y} y=${o-22-z} width=${p} height=${z}><title>${g.title??`${g.label}: ${a(g.value)}`}</title></rect>`:d}
        ${K%u===0||nt?ht`<text x=${Y+p/2} y=${o-6} text-anchor="middle">${g.label}</text>`:d}
        ${nt||K===T?ht`<text x=${Y+p/2} y=${o-27-m} text-anchor="middle" class="val">${a(g.value)}</text>`:d}`})}
  </svg>`}let dt=class extends et{constructor(){super(...arguments),this.settings=null,this.disabled=!1,this.open=!1,this.pos={top:0,left:0},this.onDoc=t=>{t.composedPath().includes(this)||(this.open=!1)},this.onKey=t=>{t.key==="Escape"&&(this.open=!1)}}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this.onDoc,!0),document.addEventListener("keydown",this.onKey)}disconnectedCallback(){document.removeEventListener("click",this.onDoc,!0),document.removeEventListener("keydown",this.onKey),super.disconnectedCallback()}fire(t){this.open=!1,this.dispatchEvent(new CustomEvent("snooze",{detail:{minutes:t},bubbles:!0,composed:!0}))}toggle(t){t.stopPropagation();const s=t.currentTarget.getBoundingClientRect();this.pos={top:Math.min(s.bottom+4,window.innerHeight-240),left:Math.max(8,Math.min(s.left,window.innerWidth-200))},this.open=!this.open}render(){const t=this.settings;if(!t)return d;const s=new Date;return n`<span class="snz" @click=${a=>a.stopPropagation()}>
        <button class="btn sm" type="button" data-snooze=${t.default} ?disabled=${this.disabled} @click=${()=>this.fire(t.default)}><sw-icon name="bellOff" size="13"></sw-icon>${e("snooze",{d:tt(t.default)})}</button>
        <button class="btn sm icononly" type="button" data-snooze-menu aria-haspopup="menu" aria-expanded=${this.open?"true":"false"} aria-label=${e("snoozeOther")} ?disabled=${this.disabled} @click=${a=>this.toggle(a)}><sw-icon name="chevronDown" size="13"></sw-icon></button>
      </span>
      ${this.open?n`<div class="menu" role="menu" style="top:${this.pos.top}px;left:${this.pos.left}px" data-snooze-list>
            <div class="mh">${e("snoozeTo")}</div>
            ${t.durations.filter(a=>a<=t.max).map(a=>n`<button type="button" role="menuitem" data-pick=${a} @click=${r=>{r.stopPropagation(),this.fire(a)}}>${tt(a)} <span class="mut">(${e("snoozeUntil",{t:es(s,a)})})</span></button>`)}
            <div class="mh">${e("snoozeFoot")}</div>
          </div>`:d}`}};dt.styles=[Os,Vt`
      :host {
        display: inline-flex;
      }
      .snz {
        display: inline-flex;
      }
      .snz .btn:first-child {
        border-start-end-radius: 0;
        border-end-end-radius: 0;
      }
      .snz .btn + .btn {
        border-start-start-radius: 0;
        border-end-start-radius: 0;
        margin-inline-start: -1px;
        padding-inline: 6px;
      }
      .menu {
        position: fixed;
        z-index: calc(var(--sw-z-modal, 1000) + 5);
        display: flex;
        flex-direction: column;
        min-inline-size: 150px;
        padding: 4px;
        background: var(--sw-menu-surface);
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-md);
        box-shadow: var(--sw-shadow-2, 0 8px 24px rgba(0, 0, 0, 0.18));
      }
      .menu button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: var(--sw-r-sm);
        font-size: var(--sw-fs-sm);
        color: var(--sw-text);
      }
      .menu button:hover,
      .menu button:focus-visible {
        background: var(--sw-surface-2);
      }
      .menu .mh {
        padding: 6px 12px 2px;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
    `];At([E({attribute:!1})],dt.prototype,"settings",2);At([E({type:Boolean})],dt.prototype,"disabled",2);At([c()],dt.prototype,"open",2);At([c()],dt.prototype,"pos",2);dt=At([X("water-snooze")],dt);function Fe(t,s){try{const a=localStorage.getItem(t);return a?JSON.parse(a):s}catch{return s}}function Be(t,s){try{localStorage.setItem(t,JSON.stringify(s))}catch{}}function js(t){return t===60?e("hour1"):t===120?e("hours2"):t%60===0?e("hours",{n:t/60}):e("minutes",{n:t})}var Ie=Object.defineProperty,Ue=Object.getOwnPropertyDescriptor,j=(t,s,a,r)=>{for(var i=r>1?void 0:r?Ue(s,a):s,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(s,a,i):l(i))||i);return r&&i&&Ie(s,a,i),i};const ws={hours:"r24h",days:"r30d",months:"r12m"},ys={first:"reasonFirst",replaced:"reasonReplaced",source_changed:"reasonSource"},_t=t=>String(t).padStart(2,"0"),Ve=t=>`${t.getFullYear()}-${_t(t.getMonth()+1)}-${_t(t.getDate())}T${_t(t.getHours())}:${_t(t.getMinutes())}`,We=(t,s)=>{const a=t.getHours()*60+t.getMinutes(),[r,i]=s.night_from.split(":").map(Number),[o,l]=s.night_to.split(":").map(Number),h=r*60+i,$=o*60+l;return h<=$?a>=h&&a<$:a>=h||a<$};let B=class extends ne{constructor(){super("hours"),this.canAck=!1,this.rules=vt,this.snooze=null,this.night=void 0,this.bars=[],this.alerts=[],this.readings=[],this.toaster=new Gs(this,{ms:4e3}),this.f1="",this.f2="",this.f3="",this.unit="m3",this.kind=""}get notice(){return this.toaster.text}fetchDetail(){return w.meter(this.meterId)}async afterLoad(t){this.canManage&&this.loadReadings(),await this.loadAlerts(),t()&&this.loadSeries()}titles(t){return{heading:t.display_name??"",subheading:[Rt(t.kind),t.area_name,t.floor_name].filter(Boolean).join(" · ")}}texts(){return{loadError:e("cardLoadError"),retry:e("retry")}}async loadAlerts(){try{this.alerts=(await w.events("open",this.meterId)).items}catch{this.alerts=[]}}async loadReadings(){try{this.readings=await w.manualReadings(this.meterId)}catch{this.readings=[]}}async fetchSeries(t,s,a,r){const i=await w.series(this.meterId,s,a,r);return()=>{const o=xt(this.meterId,this.alerts)==="leak";if(t==="hours")this.bars=i.map(l=>{const h=new Date(l.start),$=We(h,this.rules);return{label:_t(h.getHours()),value:l.litres??0,win:$,leak:$&&o}});else if(t==="days")this.bars=i.map(l=>({label:String(new Date(l.start).getDate()),value:(l.litres??0)/1e3}));else{const l=new Map;for(const h of i){const $=new Date(h.start),p=`${$.getMonth()+1}/${String($.getFullYear()).slice(2)}`;l.set(p,(l.get(p)??0)+(h.litres??0)/1e3)}this.bars=[...l.entries()].map(([h,$])=>({label:h,value:$}))}}}flash(t){this.toaster.show(t)}async act(t,s){if(!this.busy){this.busy=!0,this.actionError="";try{await t(),s?.(),this.fire("changed")}catch(a){this.actionError=a instanceof mt&&a.code==="revision_conflict"?e("conflict"):M(a),a instanceof mt&&a.code==="revision_conflict"&&await this.refresh()}finally{this.busy=!1}}}ack(t){this.act(()=>w.ack(t.id),()=>{this.flash(e("acked")),this.loadAlerts()})}doSnooze(t,s){const a=!!this.snooze;this.act(()=>w.snooze(t.id,a?s:void 0),()=>{this.flash(e("snoozedToast",{d:tt(s),t:es(new Date,s)})),this.loadAlerts()})}openDlg(t){const s=this.detail;this.actionError="",this.f1=t==="rename"?s?.display_name??"":t==="replace"?s?.value_l!=null?String(s.value_l/1e3):"":t==="reading"?Ve(new Date):"",this.f2=t==="replace"?"0":"",this.f3="",this.kind=s?.kind??"other",this.unit="m3",this.dlg=t}save(){const t=this.detail;if(t)if(this.dlg==="rename"){const s=this.f1.trim();if(!s)return void(this.actionError=e("nameRequired"));this.act(()=>w.patchMeter(t,{display_name:s,...this.kind!==t.kind?{kind:this.kind}:{}}),()=>{this.dlg="",this.refresh()})}else if(this.dlg==="replace"){const s=Number(this.f1),a=Number(this.f2);if(this.f1.trim()===""||!Number.isFinite(s)||s<0||this.f2.trim()===""||!Number.isFinite(a)||a<0)return void(this.actionError=e("replaceBad"));this.act(()=>w.replaceMeter(t,{old_final_reading_l:s*1e3,new_start_reading_l:a*1e3,note:this.f3.trim()||void 0}),()=>{this.dlg="",this.load()})}else if(this.dlg==="reading"){const s=this.f2.trim().replace(",",".");if(!s||!Number.isFinite(Number(s))||Number(s)<0||!this.f1)return void(this.actionError=e("replaceBad"));this.act(()=>w.addManual(t.id,{read_at:new Date(this.f1).toISOString(),value:s,unit:this.unit,note:this.f3.trim()||void 0}),()=>{this.dlg="",this.flash(e("readingSaved")),this.loadReadings(),this.refresh()})}else this.dlg==="remove"&&this.act(()=>w.retireMeter(t),()=>{this.dlg="",this.fire("close")})}renderAlerts(){return this.alerts.length?n`<h3 class="sec">${e("openAlerts")}</h3>
      <div class="list" data-open-alerts>${this.alerts.map(t=>n`<div class="li" data-alert=${t.id}>
        <div class="grow"><div class="t1">${Ot(t.kind)} · ${Lt(t)}</div><div class="t2 wrap">${e("colSince")} <span class="num">${Ft(t.opened_at)}</span>${t.snoozed_until?n` · ${e("snoozedUntil",{t:Ft(t.snoozed_until)})}`:d}</div></div>
        ${this.canAck?n`<span class="acts">${t.can_ack?n`<sw-button variant="primary" size="sm" data-ack ?disabled=${this.busy} @click=${()=>this.ack(t)}>${e("ack")}</sw-button>`:d}
          ${t.can_snooze?n`<water-snooze .settings=${this.snooze??{durations:[60],default:60,max:60}} ?disabled=${this.busy} @snooze=${s=>this.doSnooze(t,s.detail.minutes)}></water-snooze>`:d}</span>`:d}
      </div>`)}</div>`:d}renderReadings(){return this.canManage?n`<div class="row"><h3 class="sec">${e("readings")}</h3><span class="sp"></span><sw-button size="sm" data-reading @click=${()=>this.openDlg("reading")}>${e("manualReading")}</sw-button></div>
      ${this.readings.length?n`<div class="list" data-readings>${this.readings.slice(0,5).map(t=>n`<div class="li"><div class="grow"><div class="t1"><span class="num">${Q(t.litres)}</span> ${e("m3")}</div>
            <div class="t2">${Jt(t.read_at)} · ${t.voided_at?e("readingVoided"):t.effect==="allocation"?e("effAllocation"):e("effRecorded")}${t.note?` · ${t.note}`:""}</div></div>
            ${t.voided_at?d:n`<sw-button variant="ghost" size="sm" data-undo-reading ?disabled=${this.busy} @click=${()=>void this.act(()=>w.undoManual(this.meterId,t.id),()=>void this.loadReadings())}>${e("readingUndo")}</sw-button>`}</div>`)}</div>`:n`<div class="mut">${e("noReadings")}</div>`}`:d}renderBody(t){const s=xt(t.id,this.alerts),a=Ts(t),r=`${this.rules.night_from}-${this.rules.night_to}`,i=t.rules&&Object.keys(t.rules).length>0;return n`<div class="body" data-meter-card=${t.id}>
      <div class="row">${Vs(t,s)}</div>
      ${this.notice?n`<div class="notice" role="status">${this.notice}</div>`:d}
      <dl class="kv">
        <dt>${e("fArea")}</dt><dd>${t.area_name??"-"}${t.floor_name?` · ${t.floor_name}`:""}</dd>
        <dt>${e("fReading")}</dt><dd><span class="num">${Q(t.value_l)}</span> <span class="mut">${e("m3")}</span></dd>
        <dt>${e("fLast")}</dt><dd><span class="num">${Jt(t.last_report_at)}</span></dd>
        <dt>${e("fUnit")}</dt><dd>${e("fUnitValue")}</dd>
        <dt>${e("fKind")}</dt><dd>${Rt(t.kind)}</dd>
        <dt>${e("fNight")}</dt><dd>${a?e("fNightOff"):this.night===null||this.night===void 0?"-":n`<span class="num ${s==="leak"?"bad":""}">${Ct(this.night)}</span> ${e("lph")}`}</dd>
        <dt>${e("fRules")}</dt><dd>${i?e("fRulesOwn",{w:r}):e("fRulesDefault",{w:r})}</dd>
      </dl>
      <div class="row"><h3 class="sec">${e("usage")}</h3><span class="sp"></span>
        ${this.rangeSeg(e("range"),o=>e(ws[o]))}</div>
      ${this.chartError?n`<div class="alert err" role="alert">${e("chartError")}</div>`:Ws(this.bars,e("chartAria",{r:e(ws[this.range])}),this.range==="hours"?o=>String(Math.round(o)):o=>o.toFixed(o<10?2:1))}
      ${this.range==="hours"?n`<div class="mut">${e("nightNote",{w:r})}</div>`:d}
      ${this.renderAlerts()}
      <h3 class="sec">${e("epochs")}</h3>
      <div class="list" data-epochs>${t.epochs.map(o=>n`<div class="li"><div class="grow"><div class="t1">${ys[o.reason]?e(ys[o.reason]):o.reason} · <span class="num">${J(o.started_at)}</span></div>
        <div class="t2 wrap">${e("epochStart")} <span class="num">${Q(o.start_reading_l)}</span>${o.ended_at?n` · ${e("epochUntil")} <span class="num">${J(o.ended_at)}</span>`:""}${o.note?` · ${o.note}`:""}</div></div>${o.ended_at?d:n`<span class="chip c-acc nodot">${e("epochActive")}</span>`}</div>`)}</div>
      ${this.renderReadings()}
      ${this.actionError&&!this.dlg?n`<div class="alert err" role="alert" data-meter-action-error>${this.actionError}</div>`:d}
      ${this.canManage?this.actionsRow({rename:e("rename"),replace:e("replace"),pause:t.status==="paused"?e("resume"):e("pause"),remove:e("remove"),pauseDisabled:this.busy||t.status==="retired",onRename:()=>this.openDlg("rename"),onReplace:()=>this.openDlg("replace"),onPause:()=>void this.act(()=>w.patchMeter(t,{status:t.status==="paused"?"active":"paused"}),()=>void this.load()),onRemove:()=>this.openDlg("remove")}):d}
    </div>`}field(t,s,a,r,i={}){return n`<div class="fld ${i.wide?"wide":""}"><label for=${t}>${s}</label><div class="inp"><input id=${t} type=${i.type??"text"} inputmode=${i.type?"text":"decimal"} .value=${a} @input=${o=>r(o.target.value)} />${i.suffix?n`<span class="mut">${i.suffix}</span>`:d}</div></div>`}renderDialogs(){const t=this.actionError&&this.dlg?n`<div class="alert err wide" role="alert">${this.actionError}</div>`:d,s=(a,r=!1)=>n`<sw-button slot="footer" variant=${r?"danger":"primary"} data-dialog-save ?disabled=${this.busy} @click=${()=>this.save()}>${a}</sw-button><sw-button slot="footer" @click=${()=>this.dlg=""}>${e("cancel")}</sw-button>`;return n`
      <sw-dialog ?open=${this.dlg==="remove"} heading=${e("removeTitle")} data-meter-remove-dialog @close=${()=>this.dlg=""}>
        <div>${e("removeBody")}</div>${t}${s(e("remove"),!0)}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="rename"} heading=${e("renameTitle")} data-meter-rename-dialog @close=${()=>this.dlg=""}>
        <div class="form">${this.field("wrn",e("meterName"),this.f1,a=>this.f1=a,{type:"text",wide:!0})}
          <div class="fld wide"><label for="wkd">${e("meterKind")}</label><div class="inp"><select id="wkd" @change=${a=>this.kind=a.target.value}>${Is.map(a=>n`<option value=${a} ?selected=${a===this.kind}>${Rt(a)}</option>`)}</select></div></div>${t}</div>
        ${s(e("save"))}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="replace"} heading=${e("replace")} data-meter-replace-dialog @close=${()=>this.dlg=""}>
        <div class="form">${this.field("wfr",e("replaceFinal"),this.f1,a=>this.f1=a,{suffix:e("m3")})}${this.field("wsr",e("replaceStart"),this.f2,a=>this.f2=a,{suffix:e("m3")})}
          ${this.field("wnt",e("replaceNote"),this.f3,a=>this.f3=a,{type:"text",wide:!0})}${t}</div>
        ${s(e("replace"))}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="reading"} heading=${e("manualReading")} data-meter-reading-dialog @close=${()=>this.dlg=""}>
        <div class="form">${this.field("wra",e("readingAt"),this.f1,a=>this.f1=a,{type:"datetime-local",wide:!0})}
          ${this.field("wrv",e("readingValue"),this.f2,a=>this.f2=a)}
          <div class="fld"><label for="wru">${e("fUnit")}</label><div class="inp"><select id="wru" @change=${a=>this.unit=a.target.value}><option value="m3" ?selected=${this.unit==="m3"}>${e("m3")}</option><option value="L" ?selected=${this.unit==="L"}>${e("litre")}</option></select></div></div>
          ${this.field("wrn2",e("readingNote"),this.f3,a=>this.f3=a,{type:"text",wide:!0})}${t}</div>
        ${s(e("save"))}
      </sw-dialog>`}};B.styles=[rt,re];j([E({type:Boolean})],B.prototype,"canAck",2);j([E({attribute:!1})],B.prototype,"rules",2);j([E({attribute:!1})],B.prototype,"snooze",2);j([E({attribute:!1})],B.prototype,"night",2);j([c()],B.prototype,"bars",2);j([c()],B.prototype,"alerts",2);j([c()],B.prototype,"readings",2);j([c()],B.prototype,"f1",2);j([c()],B.prototype,"f2",2);j([c()],B.prototype,"f3",2);j([c()],B.prototype,"unit",2);j([c()],B.prototype,"kind",2);B=j([X("water-meter-card")],B);var je=Object.defineProperty,qe=Object.getOwnPropertyDescriptor,V=(t,s,a,r)=>{for(var i=r>1?void 0:r?qe(s,a):s,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(s,a,i):l(i))||i);return r&&i&&je(s,a,i),i};const He=6e4,Nt=t=>String(t).padStart(2,"0"),pt=t=>{if(!t)return"-";const s=new Date(t);return`${Nt(s.getDate())}.${Nt(s.getMonth()+1)} ${Nt(s.getHours())}:${Nt(s.getMinutes())}`},Ke=t=>/^[=+\-@\t\r]/.test(t)?`'${t}`:t,Ye=t=>`"${Ke(t).replace(/"/g,'""')}"`;let L=class extends et{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.items=[],this.summary=null,this.rules=vt,this.snooze=null,this.phase="loading",this.error="",this.actionError="",this.notice="",this.filter="open",this.busy=!1,this.access=at(),this.poller=new Js(this)}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.load(!0),this.poller.every("rows",He,()=>this.load(!1)),zt().then(t=>{t&&(this.rules=t.rules,this.snooze=t.snooze)})}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}async load(t){t&&(this.phase="loading");try{const s=await w.events("all");this.items=s.items,this.summary=s.summary,this.phase="ready"}catch(s){(t||this.phase!=="ready")&&(this.error=M(s),this.phase="error")}}flash(t){this.notice=t,window.setTimeout(()=>this.notice="",4e3)}async act(t,s){if(!this.busy){this.busy=!0,this.actionError="";try{await t(),this.flash(s),await this.load(!1)}catch(a){this.actionError=M(a)}finally{this.busy=!1}}}snoozeEv(t,s){this.act(()=>w.snooze(t.id,this.snooze?s:void 0),e("snoozedToast",{d:tt(s),t:es(new Date,s)}))}openMeter(t){if(t.closed_at)return;const s={};this.params.forEach((a,r)=>s[r]=a),b("/infra/water/alerts",{...s,meter:t.meter_id})}onKey(t,s){(t.key==="Enter"||t.key===" ")&&t.target===t.currentTarget&&(t.preventDefault(),this.openMeter(s))}closeMeter(){const t={};this.params.forEach((s,a)=>a!=="meter"&&(t[a]=s)),b("/infra/water/alerts",t)}exportCsv(t){const s=is()==="he",a=[e("colMeter"),e("colArea"),e("colKind"),e("colSince"),s?"עד":"Until",e("colValue"),e("colState")],r=h=>h.closed_at?e("asClosed"):h.snoozed_until?e("snoozedUntil",{t:pt(h.snoozed_until)}):h.ack_at?e("asAcked",{who:h.ack_by_display??""}):e("asOpen"),i=[a,...t.map(h=>[h.meter_name,[h.area_name,h.floor_name].filter(Boolean).join(" · "),Ot(h.kind),pt(h.opened_at),h.closed_at?pt(h.closed_at):"",Lt(h),r(h)])],o=new Blob(["\uFEFF"+i.map(h=>h.map(Ye).join(",")).join(`\r
`)],{type:"text/csv;charset=utf-8"}),l=document.createElement("a");l.href=URL.createObjectURL(o),l.download=`water-alerts-${new Date().toISOString().slice(0,10)}.csv`,l.click(),window.setTimeout(()=>URL.revokeObjectURL(l.href),1e3),this.flash(e("csvDone"))}actions(t){return t.closed_at||!this.access.ack?d:n`<span class="acts">${t.can_ack?n`<sw-button variant="primary" size="sm" data-ack ?disabled=${this.busy} @click=${s=>{s.stopPropagation(),this.act(()=>w.ack(t.id),e("acked"))}}>${e("ack")}</sw-button>`:d}
      ${t.can_snooze?n`<water-snooze .settings=${this.snooze??{durations:[60],default:60,max:60}} ?disabled=${this.busy} @snooze=${s=>this.snoozeEv(t,s.detail.minutes)}></water-snooze>`:d}</span>`}render(){if(!this.access.view)return n`<sw-state-panel state="forbidden" data-water="alerts" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return n`<div data-water="alerts" data-state="loading" aria-busy="true"><div class="card">${Array.from({length:7},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;if(this.phase==="error")return n`<div data-water="alerts" data-state="error"><sw-state-panel state="error" heading=${e("loadAlertsError")} hint=${this.error} actionLabel=${e("retry")} @action=${()=>void this.load(!0)}></sw-state-panel></div>`;const t=Date.now()-7*864e5,s=this.items.filter(p=>p.closed_at&&Date.parse(p.closed_at)>=t).length,a=this.filter==="all"?this.items:this.items.filter(p=>!p.closed_at),r=this.summary,i=this.rules,o=this.params.get("meter")??"",l=n`<div class="row head">
      <div class="seg" role="group" aria-label=${e("filter")} data-alert-filter>
        <button type="button" aria-pressed=${this.filter==="open"?"true":"false"} data-f="open" @click=${()=>this.filter="open"}>${e("fOpen")}</button>
        <button type="button" aria-pressed=${this.filter==="all"?"true":"false"} data-f="all" @click=${()=>this.filter="all"}>${e("fAll")}</button></div>
      <span class="sp"></span>
      <sw-button icon="download" data-csv ?disabled=${!a.length} @click=${()=>this.exportCsv(a)}>${e("csv")}</sw-button>
      ${this.access.manage||this.access.configure?n`<sw-button data-leak-rules @click=${()=>b("/infra/water/settings",{set:"alerts"})}>${e("leakRules")}</sw-button>`:d}
    </div>`,h=n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${e("tOpen")}</div><div class="v ${r?.open?"alarm":""}"><span class="num" data-t-open>${r?.open??0}</span></div></div>
      <div class="tile"><div class="k">${e("tClosedWeek")}</div><div class="v"><span class="num" data-t-closed>${s}</span></div></div>
      <div class="tile"><div class="k">${e("tSnoozed")}</div><div class="v"><span class="num" data-t-snz>${r?.snoozed??0}</span></div></div>
      <div class="tile"><div class="k">${e("tRule")}</div><div class="v"><span class="num nw">${i.night_from}-${i.night_to}</span><span class="u">${e("ruleValue",{lph:i.night_min_lph,dur:js(i.night_min_intervals*15)})}</span></div></div>
    </div>`,$=a.length?n`<div class="card flush scrollx desk-only fitbox"><table class="t" data-alerts-table>
          <thead><tr><th>${e("colMeter")}</th><th>${e("colArea")}</th><th>${e("colKind")}</th><th>${e("colSince")}</th><th class="n">${e("colValue")}</th><th>${e("colState")}</th><th></th></tr></thead>
          <tbody>${a.map(p=>n`<tr class=${p.closed_at?"":"pick"} tabindex=${p.closed_at?-1:0} data-alert=${p.id} @click=${()=>this.openMeter(p)} @keydown=${u=>this.onKey(u,p)}>
            <td class="b">${p.meter_name}</td><td>${p.area_name??"-"}<span class="mut dsk">${p.floor_name?` · ${p.floor_name}`:""}</span></td><td>${Ot(p.kind)}</td>
            <td><span class="num">${pt(p.opened_at)}</span>${p.closed_at?n`<span class="mut"> - <span class="num">${pt(p.closed_at)}</span></span>`:d}</td>
            <td class="n">${Lt(p)}</td><td>${bs(p)}</td><td class="n">${this.actions(p)}</td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-alerts-rows>${a.map(p=>n`<div class="li ${p.closed_at?"dis":"pick"}" role=${p.closed_at?d:"button"} tabindex=${p.closed_at?d:0} data-alert=${p.id} @click=${()=>this.openMeter(p)} @keydown=${u=>this.onKey(u,p)}>
          <div class="grow"><div class="t1">${p.meter_name} · ${Ot(p.kind)}</div><div class="t2 wrap">${p.area_name??""} · ${e("colSince")} <span class="num">${pt(p.opened_at)}</span> · ${Lt(p)}</div></div>${bs(p)}${this.actions(p)}</div>`)}</div>`:n`<sw-state-panel icon="check" state="empty" heading=${e("emptyAlerts")} data-no-alerts></sw-state-panel>`;return n`<div class="page fit" data-water="alerts" data-state=${a.length?"ready":"empty"}>
      ${l}
      ${this.notice?n`<div class="notice" role="status" data-notice>${this.notice}</div>`:d}
      ${this.actionError?n`<div class="alert err" role="alert">${this.actionError}</div>`:d}
      ${h}${$}
      ${o?n`<water-meter-card .meterId=${o} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} @close=${()=>this.closeMeter()} @changed=${()=>void this.load(!1)}></water-meter-card>`:d}
    </div>`}};L.styles=[rt,st];V([E({attribute:!1})],L.prototype,"segments",2);V([E({attribute:!1})],L.prototype,"params",2);V([c()],L.prototype,"items",2);V([c()],L.prototype,"summary",2);V([c()],L.prototype,"rules",2);V([c()],L.prototype,"snooze",2);V([c()],L.prototype,"phase",2);V([c()],L.prototype,"error",2);V([c()],L.prototype,"actionError",2);V([c()],L.prototype,"notice",2);V([c()],L.prototype,"filter",2);V([c()],L.prototype,"busy",2);V([c()],L.prototype,"access",2);L=V([X("water-alerts-page")],L);var Ge=Object.defineProperty,Je=Object.getOwnPropertyDescriptor,R=(t,s,a,r)=>{for(var i=r>1?void 0:r?Je(s,a):s,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(s,a,i):l(i))||i);return r&&i&&Ge(s,a,i),i};const gt="/infra/water/bills",Qe=["draft","issued","sent","paid","void"],bt=t=>`${J(t.from)} - ${J(t.to)}`,_s=()=>{const t=new Date;return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`},Xe=t=>`"${(/^[=+\-@\t\r]/.test(t)?`'${t}`:t).replace(/"/g,'""')}"`,ks=(t=6)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`,xs={email:"howEmail",hand:"howHand",other:"howOther"},Ze={recalculate:"aRecalc",issue:"aIssue",sent:"aSent",paid:"aPaid",correct:"aCorrect",void:"aVoid",delete:"aDelete"},Ss={created:"evCreated",draft:"evCreated",recalculated:"evRecalculated",recalculate:"evRecalculated",issued:"evIssued",issue:"evIssued",auto_issue:"evIssued",auto_draft:"evCreated",sent:"evSent",paid:"evPaid",voided:"evVoided",void:"evVoided",corrected:"evCorrected",correct:"evCorrected",deleted:"evDeleted"};let C=class extends et{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.st="loading",this.all=[],this.sums={open:"0.00",paid:"0.00"},this.filter="",this.q="",this.bill=null,this.billSt="loading",this.events=[],this.dlg="",this.reason="",this.how="email",this.ref="",this.busy=!1,this.error="",this.shown=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t)}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const s=this.segments[0]??"";s!==this.shown&&(this.shown=s,this.dlg="",this.error="",s?this.loadBill(s):this.loadList())}async loadList(){this.st="loading";try{const t=await v.listBills();this.all=t.items,this.sums=t.sums,this.st="ready"}catch{this.st="error"}}async loadBill(t){this.billSt="loading";try{this.bill=await v.bill(t),this.billSt="ready",this.loadEvents(t)}catch(s){this.error=M(s),this.billSt="error"}}async loadEvents(t){try{this.events=(await v.billEvents(t)).items}catch{this.events=[]}}open(t){this.dlg=t,this.error="",this.reason="",this.ref="",this.how="email"}async act(t){if(!(this.busy||!this.bill)){this.busy=!0,this.error="";try{const s=await t();if(this.dlg="",s){if(s.id!==this.bill.id){b(`${gt}/${s.id}`);return}this.bill=s,this.loadEvents(s.id)}}catch(s){this.error=M(s)}finally{this.busy=!1}}}exportCsv(t){const s=[e("colNumber"),e("colCustomer"),e("colAccount"),e("colPeriod"),e("colM3"),e("colTotal"),e("colDue"),e("colState")],a=t.map(o=>[o.number??"",o.customer.name??"",o.account_name,bt(o.period),o.m3??"",o.total??"",o.due_date??"",kt[o.state].label]),r=new Blob(["\uFEFF"+[s,...a].map(o=>o.map(Xe).join(",")).join(`\r
`)],{type:"text/csv;charset=utf-8"}),i=document.createElement("a");i.href=URL.createObjectURL(r),i.download=`water-bills-${_s()}.csv`,i.click(),window.setTimeout(()=>URL.revokeObjectURL(i.href),1e3)}renderList(){if(this.st==="loading")return n`<div class="page" data-water="bills" data-state="loading">${ks(7)}</div>`;if(this.st==="error")return n`<div class="page" data-water="bills" data-state="error"><sw-state-panel state="error" heading=${e("loadBillsError")} actionLabel=${e("retry")} @action=${()=>void this.loadList()}></sw-state-panel></div>`;if(!this.all.length)return n`<div class="page" data-water="bills" data-state="empty"><sw-state-panel icon="list" state="empty" heading=${e("emptyBills")}><sw-button variant="primary" @click=${()=>b("/infra/water/accounts")}>${e("toAccounts")}</sw-button></sw-state-panel></div>`;const t=o=>this.all.filter(l=>l.state===o).length,s=this.q.trim(),a=this.all.filter(o=>(!this.filter||o.state===this.filter)&&(!s||(o.number??"").includes(s)||(o.customer.name??"").includes(s)||o.account_name.includes(s))),r=_s(),i=this.all.filter(o=>Pe(o,r)).length;return n`<div class="page" data-water="bills" data-state=${a.length?"ready":"filtered-empty"}>
      <div class="row head">
        <div class="seg scroll-seg" role="group" aria-label=${e("stateFilter")} data-bill-filter>
          <button type="button" data-filter="" aria-pressed=${this.filter===""?"true":"false"} @click=${()=>this.filter=""}>${e("fAll")} <span class="num">${this.all.length}</span></button>
          ${Qe.map(o=>n`<button type="button" data-filter=${o} aria-pressed=${this.filter===o?"true":"false"} @click=${()=>this.filter=o}>${kt[o].label} <span class="num">${t(o)}</span></button>`)}</div>
        <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-bill-search placeholder=${e("billSearch")} aria-label=${e("billSearch")} .value=${this.q} @input=${o=>this.q=o.target.value} /></label>
        <span class="sp"></span>
        <sw-button icon="download" data-csv ?disabled=${!a.length} @click=${()=>this.exportCsv(a)}>${e("csv")}</sw-button>
      </div>
      <div class="tiles" data-tiles>
        <div class="tile"><div class="k">${e("tBillDrafts")}</div><div class="v"><span class="num" data-bt="draft">${t("draft")}</span></div></div>
        <div class="tile"><div class="k">${e("tOpenAmount")}</div><div class="v"><span class="num" data-bt="open">${k(this.sums.open).replace(" ₪","")}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${e("tPaid")}</div><div class="v"><span class="num" data-bt="paid">${k(this.sums.paid).replace(" ₪","")}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${e("tLate")}</div><div class="v ${i?"alarm":""}"><span class="num" data-bt="late">${i}</span></div></div>
      </div>
      ${a.length?rs(a,!1):n`<sw-state-panel icon="search" state="empty" compact heading=${e("noBillsFound")}></sw-state-panel>`}
    </div>`}paper(t){const s=t.snapshot,a=Ce(s.lines??[]),r=(o,l)=>n`<tr data-line=${o.component}><td>${l}${(s.lines??[]).filter(h=>h.component===o.component).length>1?n` <span class="mut num">${bt(o)}</span>`:d}</td>
      <td class="n"><span class="num">${y(o.m3)}</span> ${e("m3")}</td><td class="n"><span class="num">${k(o.unit_price_ex_vat)}</span></td><td class="n"><span class="num">${k(o.amount_ex_vat)}</span></td></tr>`,i=[...new Set((s.lines??[]).map(o=>o.vat_rate_percent))];return n`<div class="paper" data-bill-paper>
      <div class="row" style="align-items:flex-start"><div><b class="h3">${s.business?.name??""}</b>${s.business?.registration_no?n`<div class="mut num">${s.business.registration_no}</div>`:d}${s.business?.address?n`<div class="mut">${s.business.address}</div>`:d}</div>
        <span class="sp"></span><div style="text-align:end"><b>${s.doc?.title_he??e("billDraft")}</b>${s.doc?.subtitle_he?n`<div class="mut">${s.doc.subtitle_he}</div>`:d}<div class="num">${t.number??e("tBillDrafts")}</div></div></div>
      <dl class="kv">
        <dt>${e("colCustomer")}</dt><dd>${s.customer?.name??""} · <span class="num">${s.customer?.customer_number??""}</span>${s.customer?.address?` · ${s.customer.address}`:""}</dd>
        <dt>${e("colAccount")}</dt><dd>${s.account?.name??t.account_name}</dd>
        <dt>${e("pPeriod")}</dt><dd class="num">${bt(t.period)}</dd>
        <dt>${e("pFormula")}</dt><dd>${s.account?.formula?.sentence_he??""}</dd>
        ${t.issue_date?n`<dt>${e("pIssued")}</dt><dd class="num">${J(t.issue_date)}</dd>`:d}
        <dt>${e("pDue")}</dt><dd class="num">${J(t.due_date??s.bill?.expected_due_date??null)}</dd>
      </dl>
      <table><thead><tr><th>${e("pItem")}</th><th class="n">${e("pQty")}</th><th class="n">${e("pPrice")}</th><th class="n">${e("pAmount")}</th></tr></thead>
        <tbody>${a.water.map(o=>r(o,e("pWater")))}${a.sewage.map(o=>r(o,e("pSewage")))}</tbody>
        <tfoot>
          <tr><td colspan="3">${e("pSubtotal")}</td><td class="n"><span class="num" data-subtotal>${k(s.totals?.amount_ex_vat)}</span></td></tr>
          <tr><td colspan="3">${e("pVat",{p:i.join(" / ")})}</td><td class="n"><span class="num" data-vat>${k(s.totals?.vat_amount)}</span></td></tr>
          <tr class="tot"><td colspan="3">${e("pTotal")}</td><td class="n"><span class="num" data-total>${k(s.totals?.total)}</span></td></tr>
        </tfoot></table>
      ${(s.notes??[]).map(o=>n`<div class="mut">${o.text_he}</div>`)}
    </div>`}renderBill(){const t=this.segments[0],s=n`<a class="btn ghost sm" href=${`#${gt}`} data-back><sw-icon name="chevronBack" size="13"></sw-icon>${e("bills")}</a>`;if(this.billSt==="loading"&&this.bill?.id!==t)return n`<div class="page" data-water="bill" data-state="loading">${ks(5)}</div>`;if(this.billSt==="error"||!this.bill)return n`<div class="page" data-water="bill" data-state="error"><div class="backrow">${s}</div><sw-state-panel state="error" heading=${e("loadBillError")} hint=${this.error} actionLabel=${e("retry")} @action=${()=>void this.loadBill(t)}></sw-state-panel></div>`;const a=this.bill,r=["issue","sent","paid","recalculate","correct","void","delete"],i=[...a.actions].sort((h,$)=>r.indexOf(h)-r.indexOf($)),o=h=>{const $=h==="void"||h==="delete",p=h==="issue"||h==="paid",u=()=>h==="recalculate"?void this.act(()=>v.recalculate(a)):this.open(h);return n`<sw-button variant=${$?"danger":p?"primary":"secondary"} data-act=${h} ?disabled=${this.busy} @click=${u}>${e(Ze[h]??"aIssue")}</sw-button>`},l=n`<div class="col">
      <div class="card"><div class="hd"><b>${e("details")}</b></div><dl class="kv" data-bill-details>
        <dt>${e("colAccount")}</dt><dd><a class="lnk" href=${`#/infra/water/accounts/${a.account_id}`}>${a.account_name}</a></dd><dt>${e("colCustomer")}</dt><dd>${a.customer.name??"-"}</dd>
        <dt>${e("pPeriod")}</dt><dd class="num">${bt(a.period)}</dd><dt>${e("colM3")}</dt><dd class="num">${y(a.m3)}</dd>
        ${a.sent?n`<dt>${e("sentOn")}</dt><dd><span class="num">${J(a.sent.at)}</span> · ${e(xs[a.sent.how]??"howOther")}</dd>`:d}
        ${a.paid?n`<dt>${e("paidOn")}</dt><dd><span class="num">${J(a.paid.at)}</span>${a.paid.reference?n` · <span class="num">${a.paid.reference}</span>`:d}</dd>`:d}
        <dt>${e("source")}</dt><dd>${a.origin==="auto"?e("originAuto"):e("originManual")}</dd></dl></div>
      <div class="card"><div class="hd"><b>${e("log")}</b></div><div class="list" data-bill-log>${this.events.map(h=>n`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${Jt(h.at)}</span><span>${Ss[h.action]?e(Ss[h.action]):h.action}${h.actor.display_name?` · ${h.actor.display_name}`:""}</span></div>`)}</div></div>
    </div>`;return n`<div class="page" data-water="bill" data-state="ready" data-bill-state=${a.state} data-bill-id=${a.id}>
      <div class="backrow">${s}<b class="h3 num" data-bill-number>${a.number?e("billNo",{no:a.number}):e("billDraft")}</b>${Bt(a)}
        ${a.replaces_bill_id&&a.snapshot.bill?.replaces?n`<span class="mut">${e("replaces",{no:""})}<a class="lnk num" href=${`#${gt}/${a.replaces_bill_id}`}>${a.snapshot.bill.replaces.number??""}</a></span>`:d}
        ${a.replaced_by_bill_id?n`<a class="lnk mut" href=${`#${gt}/${a.replaced_by_bill_id}`}>${e("replacedBy")}</a>`:d}
        <span class="sp"></span>${i.map(o)}
        <button type="button" class="btn" disabled title=${e("pdfLater")} aria-describedby="wpdf" data-pdf><sw-icon name="download" size="15"></sw-icon>${e("pdf")}</button></div>
      <div class="mut" id="wpdf" data-pdf-reason>${e("pdfLater")}</div>
      ${a.state==="void"&&a.void?n`<div class="alert err" role="alert"><span class="x" aria-hidden="true">!</span><div><b>${kt.void.label}:</b> ${a.void.reason}</div></div>`:d}
      ${this.error&&!this.dlg?n`<div class="alert err" role="alert">${this.error}</div>`:d}
      <div class="cols side"><div style="min-inline-size:0">${this.paper(a)}</div>${l}</div>
      ${this.dialogs(a)}
    </div>`}dialogs(t){const s=this.error&&this.dlg?n`<div class="alert err" role="alert">${this.error}</div>`:d,a=n`<sw-button slot="actions" @click=${()=>this.dlg=""}>${e("cancel")}</sw-button>`,r=!this.reason.trim();return n`
      <elec-dialog heading=${e("dIssueTitle")} ?open=${this.dlg==="issue"} data-dialog="issue" @close=${()=>this.dlg=""}>
        <div>${e("dIssueBody")}</div><dl class="kv"><dt>${e("colAccount")}</dt><dd>${t.account_name}</dd><dt>${e("pPeriod")}</dt><dd class="num">${bt(t.period)}</dd><dt>${e("pTotal")}</dt><dd class="num">${k(t.total)}</dd></dl>${s}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.issue(t))}>${e("aIssue")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${e("dVoidTitle")} ?open=${this.dlg==="void"} data-dialog="void" @close=${()=>this.dlg=""}>
        <div>${e("dVoidBody")}</div>
        <div class="fld"><label for="wvr">${e("dVoidReason")}</label><textarea id="wvr" data-reason aria-required="true" .value=${this.reason} @input=${i=>this.reason=i.target.value}></textarea></div>${s}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy||r} @click=${()=>void this.act(()=>v.void(t,this.reason.trim()))}>${e("aVoid")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${e("dCorrectTitle")} ?open=${this.dlg==="correct"} data-dialog="correct" @close=${()=>this.dlg=""}>
        <div>${e("dCorrectBody")}</div>${s}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.correct(t))}>${e("dCorrectGo")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${e("dSentTitle")} ?open=${this.dlg==="sent"} data-dialog="sent" @close=${()=>this.dlg=""}>
        <div class="fld"><span class="lbl">${e("dSentHow")}</span><div class="seg" role="group" aria-label=${e("dSentHow")}>${["email","hand","other"].map(i=>n`<button type="button" data-how=${i} aria-pressed=${this.how===i?"true":"false"} @click=${()=>this.how=i}>${e(xs[i])}</button>`)}</div></div>${s}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.markSent(t,this.how))}>${e("save")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${e("dPaidTitle")} ?open=${this.dlg==="paid"} data-dialog="paid" @close=${()=>this.dlg=""}>
        <div class="fld"><label for="wpr">${e("dPaidRef")}</label><input id="wpr" class="ltr" data-reference placeholder=${e("optional")} .value=${this.ref} @input=${i=>this.ref=i.target.value} /></div>${s}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.markPaid(t,this.ref.trim()))}>${e("save")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${e("dDeleteTitle")} ?open=${this.dlg==="delete"} data-dialog="delete" @close=${()=>this.dlg=""}>
        <div>${e("dDeleteBody")}</div>${s}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{await v.deleteDraft(t),b(gt)})}>${e("aDelete")}</sw-button>${a}
      </elec-dialog>`}render(){return this.access.bills?this.segments[0]?this.renderBill():this.renderList():n`<sw-state-panel state="forbidden" data-water="bills" data-state="forbidden"></sw-state-panel>`}};C.styles=[rt,st];R([E({attribute:!1})],C.prototype,"segments",2);R([E({attribute:!1})],C.prototype,"params",2);R([c()],C.prototype,"access",2);R([c()],C.prototype,"st",2);R([c()],C.prototype,"all",2);R([c()],C.prototype,"sums",2);R([c()],C.prototype,"filter",2);R([c()],C.prototype,"q",2);R([c()],C.prototype,"bill",2);R([c()],C.prototype,"billSt",2);R([c()],C.prototype,"events",2);R([c()],C.prototype,"dlg",2);R([c()],C.prototype,"reason",2);R([c()],C.prototype,"how",2);R([c()],C.prototype,"ref",2);R([c()],C.prototype,"busy",2);R([c()],C.prototype,"error",2);C=R([X("water-bills-page")],C);var ta=Object.defineProperty,sa=Object.getOwnPropertyDescriptor,W=(t,s,a,r)=>{for(var i=r>1?void 0:r?sa(s,a):s,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(s,a,i):l(i))||i);return r&&i&&ta(s,a,i),i};const lt="/infra/water/customers",zs=(t=6)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`;let F=class extends et{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.st="loading",this.list=[],this.q="",this.card=null,this.cardSt="loading",this.form=cs(),this.errs={},this.busy=!1,this.error="",this.confirmDel=!1,this.shown=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.access.bills&&this.loadList()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const s=this.segments[0]??"";s!==this.shown&&(this.shown=s,this.error="",this.errs={},this.confirmDel=!1,s?s==="new"?(this.card=null,this.cardSt="ready",this.form=cs(),v.nextCustomerNumber().then(a=>this.form={...this.form,customer_number:a.customer_number}).catch(()=>{})):this.loadCard(s):this.card=null)}async loadList(){this.st="loading";try{this.list=(await v.listCustomers()).items,this.st="ready"}catch{this.st="error"}}async loadCard(t){this.cardSt="loading";try{const s=await v.customer(t);this.card=s,this.form=oe(s),this.cardSt="ready"}catch{this.cardSt="error"}}validate(){const t={name:e("errName"),email:e("errEmail"),customer_number:e("errCustNo")},s={};for(const a of le(this.form,{numberRequired:!1}))s[a]=t[a];return this.errs=s,!Object.keys(s).length}async save(){if(!(this.busy||!this.validate())){this.busy=!0,this.error="";try{const t=hs(this.form);if(this.card)this.card=await v.updateCustomer(this.card.id,{...hs(this.form,this.card),base_revision:this.card.revision}),await this.loadList();else{const s=await v.createCustomer({...t,customer_number:t.customer_number||void 0});await this.loadList(),b(`${lt}/${s.id}`)}}catch(t){const s=t instanceof mt?t.body.details?.fields:void 0;s?.length?this.errs=Object.fromEntries(s.map(a=>[a,M(t)])):this.error=M(t)}finally{this.busy=!1}}}async removeRecord(){if(!(!this.card||this.busy)){this.busy=!0;try{await v.deleteCustomer(this.card.id,this.card.revision),this.confirmDel=!1,await this.loadList(),b(lt)}catch(t){this.confirmDel=!1,this.error=t instanceof mt&&t.status===409?M(t)||e("cDeleteRefused"):M(t)}finally{this.busy=!1}}}field(t,s,a={}){return de(t,{idPrefix:"wc-",label:e(s),value:this.form[t],error:this.errs[t],readonly:!this.access.manage,wide:a.wide,ltr:a.ltr,area:a.area,onInput:r=>{this.form={...this.form,[t]:r},this.errs[t]&&(this.errs={...this.errs,[t]:""})}})}renderCard(){const t=this.card,s=!!t&&(t.account_count>0||t.energy_account_count>0);return n`<sw-sheet open wide .heading=${e(t?"customerCard":"newCustomer")} data-customer-card @close=${()=>b(lt)}>
      <div class="col">
        ${this.cardSt==="loading"?zs(4):this.cardSt==="error"?n`<sw-state-panel state="error" compact heading=${e("loadCustomerError")} actionLabel=${e("retry")} @action=${()=>void this.loadCard(this.segments[0])}></sw-state-panel>`:n`
          <div class="form">${this.field("name","cName",{wide:!0})}${this.field("customer_number","cNumber",{ltr:!0})}${this.field("tax_id","cTaxId",{ltr:!0})}
            ${this.field("address","cAddress",{wide:!0})}${this.field("phone","cPhone",{ltr:!0})}${this.field("email","cEmail",{ltr:!0})}${this.field("notes","cNotes",{wide:!0,area:!0})}</div>
          <div class="mut">${e("cShared")}</div>
          ${t?n`<b class="h3">${e("accounts")}</b>
            <div class="list" data-customer-accounts>${(t.accounts??[]).map(a=>n`<a class="li" href=${`#/infra/water/accounts/${a.id}`}><div class="grow"><div class="t1">${a.name}</div></div>${a.status==="paused"?n`<span class="chip c-mut">${e("accPaused")}</span>`:d}</a>`)}${t.accounts?.length?d:n`<div class="mut">${e("cNoAccounts")}</div>`}</div>
            ${t.bills?.length?n`<b class="h3">${e("cRecentBills")}</b>${rs(t.bills.slice(0,4),!0)}`:d}`:d}
          ${this.error?n`<div class="alert err" role="alert" data-customer-error>${this.error}</div>`:d}
          ${this.access.manage?n`<div class="row formacts"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>${e("save")}</sw-button><span class="sp"></span>
            ${t?n`<sw-button variant="danger" data-delete title=${s?e("cDeleteRefused"):""} @click=${()=>{s?this.error=e("cDeleteRefused"):this.confirmDel=!0}}>${e("cDelete")}</sw-button>`:d}</div>`:d}`}
        <elec-dialog heading=${e("cDelete")} ?open=${this.confirmDel} data-dialog="delete-customer" @close=${()=>this.confirmDel=!1}>
          <div>${e("cDeleteBody")}</div>
          <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeRecord()}>${e("cDelete")}</sw-button>
          <sw-button slot="actions" @click=${()=>this.confirmDel=!1}>${e("cancel")}</sw-button>
        </elec-dialog>
      </div>
    </sw-sheet>`}render(){if(!this.access.bills)return n`<sw-state-panel state="forbidden" data-water="customers" data-state="forbidden"></sw-state-panel>`;const t=this.q.trim(),s=this.list.filter(i=>ce(i,t,[i.address])),a=n`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-cust-search placeholder=${e("custSearch")} aria-label=${e("custSearch")} .value=${this.q} @input=${i=>this.q=i.target.value} /></label>
      <span class="sp"></span>
      ${this.access.manage?n`<sw-button variant="primary" icon="plus" data-new-customer @click=${()=>b(`${lt}/new`)}>${e("newCustomer")}</sw-button>`:d}
    </div>`;let r;return this.st==="loading"?r=zs(5):this.st==="error"?r=n`<sw-state-panel state="error" heading=${e("loadCustomersError")} actionLabel=${e("retry")} @action=${()=>void this.loadList()}></sw-state-panel>`:this.list.length?s.length?r=n`<div class="card flush scrollx desk-only"><table class="t" data-cust-table>
          <thead><tr><th>${e("colCustNo")}</th><th>${e("colName")}</th><th>${e("colAddress")}</th><th>${e("colPhone")}</th><th>${e("colEmail")}</th><th class="n">${e("colAccounts")}</th><th class="n">${e("colBalance")}</th></tr></thead>
          <tbody>${s.map(i=>n`<tr class="go" data-customer-row=${i.id} @click=${()=>b(`${lt}/${i.id}`)}>
            <td class="num" style="text-align:start">${i.customer_number}</td><td class="b"><a class="rowlink" href=${`#${lt}/${i.id}`} @click=${o=>o.stopPropagation()}>${i.name}</a></td>
            <td>${i.address??""}</td><td class="num" style="text-align:start">${i.phone??""}</td><td class="num" style="text-align:start">${i.email??""}</td>
            <td class="n"><span class="num">${i.account_count}</span></td><td class="n"><span class="num">${i.open_balance!==void 0?k(i.open_balance):""}</span></td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-cust-rows>${s.map(i=>n`<a class="li" href=${`#${lt}/${i.id}`} data-customer-row=${i.id}>
          <div class="grow"><div class="t1">${i.name} · <span class="num">${i.customer_number}</span></div><div class="t2">${i.address??""}${i.phone?n` · <span class="num">${i.phone}</span>`:d}</div></div>
          <div class="rowend"><div class="t2 num">${i.open_balance!==void 0?k(i.open_balance):""}</div></div></a>`)}</div>`:r=n`<sw-state-panel icon="search" state="empty" compact heading=${e("noCustomers")}></sw-state-panel>`:r=n`<sw-state-panel icon="users" state="empty" heading=${e("emptyCustomers")}></sw-state-panel>`,n`<div class="page" data-water="customers" data-state=${this.st}>${a}${r}${this.segments[0]?this.renderCard():d}</div>`}};F.styles=[rt,st];W([E({attribute:!1})],F.prototype,"segments",2);W([E({attribute:!1})],F.prototype,"params",2);W([c()],F.prototype,"access",2);W([c()],F.prototype,"st",2);W([c()],F.prototype,"list",2);W([c()],F.prototype,"q",2);W([c()],F.prototype,"card",2);W([c()],F.prototype,"cardSt",2);W([c()],F.prototype,"form",2);W([c()],F.prototype,"errs",2);W([c()],F.prototype,"busy",2);W([c()],F.prototype,"error",2);W([c()],F.prototype,"confirmDel",2);F=W([X("water-customers-page")],F);var ea=Object.defineProperty,aa=Object.getOwnPropertyDescriptor,q=(t,s,a,r)=>{for(var i=r>1?void 0:r?aa(s,a):s,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(s,a,i):l(i))||i);return r&&i&&ea(s,a,i),i};let I=class extends pe{constructor(){super({viewKey:"sw.water.meters.view",collapseKey:"sw.water.meters.collapsed",route:"/infra/water/meters",access:at,onAccess:it}),this.open=[],this.night={},this.rules=vt,this.snooze=null,this.cq="",this.cands=[],this.candPhase="idle",this.picked=null,this.newName="",this.newKind="sub",this.adding=!1,this.addError="",this.loadedEvents=null,this.candTimer=0}disconnectedCallback(){window.clearTimeout(this.candTimer),super.disconnectedCallback()}willUpdate(t){t.has("params")&&this.params.get("add")==="1"&&this.candPhase==="idle"&&this.access.manage&&this.searchCands()}texts(){return{search:e("search"),view:e("view"),cards:e("cards"),table:e("table"),area:e("area"),areas:e("areas"),allAreas:e("allAreas"),fold:e("fold"),unfold:e("unfold"),addMeter:e("addMeter"),loadError:e("loadMetersError"),retry:e("retry")}}async fetchMeters(){const[t,s]=await Promise.all([w.listMeters(),w.events("open").catch(()=>null)]);return this.loadedEvents=s,t}async afterLoad(t,s){const a=this.loadedEvents;if(a&&(this.open=a.items),t){const r=await zt();r&&(this.rules=r.rules,this.snooze=r.snooze),this.night=await Ls(s,this.rules)}}areaTree(){return ke(this.meters)}inArea(t,s){const a=s.startsWith("floor:")?s.slice(6):null;return a!==null?(t.floor_id??"")===a:Fs(t)===s}matchesSearch(t,s){return`${t.display_name} ${t.device_name??""} ${t.area_name??""}`.toLowerCase().includes(s)}openMeter(t){this.setParams({meter:t.id,add:null})}chip(t){return Vs(t,xt(t.id,this.open))}renderTiles(){const t=this.meters.filter(i=>i.status!=="retired"),s=i=>t.some(o=>o[i]!=null)?t.reduce((o,l)=>o+(l[i]??0),0)/1e3:null,a=t.filter(i=>i.state==="reporting").length,r=t.filter(i=>xt(i.id,this.open)==="leak").length;return n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${e("tToday")}</div><div class="v"><span class="num" data-t="today">${y(s("today_l"))}</span><span class="u">${e("m3")}</span></div></div>
      <div class="tile"><div class="k">${e("tMonth")}</div><div class="v"><span class="num" data-t="month">${y(s("month_l"))}</span><span class="u">${e("m3")}</span></div></div>
      <div class="tile"><div class="k">${e("tReporting")}</div><div class="v"><span class="num" data-t="reporting">${a}</span><span class="u">${e("tOf",{n:t.length})}</span></div></div>
      <div class="tile"><div class="k">${e("tLeak")}</div><div class="v ${r?"alarm":""}" data-t-leak><span class="num" data-t="leaks">${r}</span><span class="u">${e("tMeters")}</span></div></div>
    </div>`}renderTable(t){return n`<div class="card flush scrollx desk-only"><table class="t" data-meters-table>
      <thead><tr><th>${e("colName")}</th><th>${e("colArea")}</th><th class="n">${e("colReading")}</th><th class="n">${e("colToday")}</th><th class="n dsk">${e("colMonth")}</th><th class="n">${e("colNight")}</th><th>${e("colState")}</th></tr></thead>
      <tbody>${t.map(s=>n`<tr class="pick" tabindex="0" data-meter=${s.id} @click=${()=>this.openMeter(s)} @keydown=${a=>this.onKey(a,s)}>
        <td class="b">${s.display_name}</td><td>${s.area_name??"-"}<span class="mut dsk">${s.floor_name?` · ${s.floor_name}`:""}</span></td>
        <td class="n"><span class="num">${Q(s.value_l)}</span></td><td class="n"><span class="num">${Q(s.today_l)}</span></td><td class="n dsk"><span class="num">${Q(s.month_l)}</span></td>
        <td class="n"><span class="num ${xt(s.id,this.open)==="leak"?"bad":""}">${Ct(this.night[s.id])}</span></td>
        <td>${this.chip(s)}</td></tr>`)}</tbody></table></div>`}renderCards(t){return n`<div class="cards desk-only" data-meters-cards>${t.map(s=>n`<div class="card mcard" role="button" tabindex="0" data-meter=${s.id} @click=${()=>this.openMeter(s)} @keydown=${a=>this.onKey(a,s)}>
      <div class="row"><b>${s.display_name}</b><span class="sp"></span>${this.chip(s)}</div>
      <div class="mut">${s.area_name??""}${s.floor_name?` · ${s.floor_name}`:""}</div>
      <div class="row base"><span class="big num">${Q(s.today_l)}</span><span class="mut">${e("todayM3")}</span><span class="sp"></span><span class="mut num">${Q(s.value_l)}</span></div>
      <div class="mut">${e("colNight")} <span class="num">${Ct(this.night[s.id])}</span>${typeof this.night[s.id]=="number"?` ${e("lph")}`:""}</div></div>`)}</div>`}renderRows(t){return n`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${t.map(s=>n`<div class="li pick" role="button" tabindex="0" data-meter=${s.id} @click=${()=>this.openMeter(s)} @keydown=${a=>this.onKey(a,s)}>
      <div class="grow"><div class="t1">${s.display_name}</div><div class="t2">${s.area_name??""} · ${e("tToday")} <span class="num">${Q(s.today_l)}</span> ${e("m3")}</div></div>
      <div class="rowend">${this.chip(s)}<div class="t2 num">${Q(s.value_l)}</div></div></div>`)}</div>`}openAdd(){this.picked=null,this.newName="",this.newKind="sub",this.addError="",this.cq="",this.setParams({add:"1",meter:null}),this.searchCands()}async searchCands(){this.candPhase="loading";try{this.cands=await w.candidates(this.cq.trim()),this.candPhase="ready"}catch{this.candPhase="error"}}onCq(t){this.cq=t,window.clearTimeout(this.candTimer),this.candTimer=window.setTimeout(()=>void this.searchCands(),300)}pick(t){t.verdict==="rejected"||t.already_meter_id||(this.picked=t,this.newName=t.device_name||t.name)}async confirmAdd(){const t=this.picked;if(!(!t||this.adding)){if(!this.newName.trim())return void(this.addError=e("nameRequired"));this.adding=!0,this.addError="";try{await w.createMeter({source_ref:t.ref,display_name:this.newName.trim(),kind:this.newKind}),this.setParams({add:null}),this.notice=e("added"),window.setTimeout(()=>this.notice="",5e3),await this.load(!1)}catch(s){this.addError=M(s)}finally{this.adding=!1}}}renderAdd(){return this.params.get("add")==="1"&&this.access.manage?n`<sw-dialog open wide heading=${e("addTitle")} data-add-dialog @close=${()=>this.setParams({add:null})}>
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-cand-search placeholder=${e("candSearch")} aria-label=${e("candSearch")} .value=${this.cq} @input=${s=>this.onCq(s.target.value)} /></label>
      <div class="cand list" data-candidates>
        ${this.candPhase==="loading"?n`<sw-state-panel state="loading" compact></sw-state-panel>`:d}
        ${this.candPhase==="error"?n`<sw-state-panel state="error" compact actionLabel=${e("retry")} @action=${()=>void this.searchCands()}></sw-state-panel>`:d}
        ${this.candPhase==="ready"&&!this.cands.length?n`<sw-state-panel icon="drop" state="empty" compact heading=${e("candNone")}></sw-state-panel>`:d}
        ${this.candPhase==="ready"?this.cands.map(s=>{const a=s.verdict==="rejected"||!!s.already_meter_id;return n`<div class="li ${a?"dis":"pick"}" role="button" tabindex=${a?-1:0} aria-disabled=${a?"true":"false"} aria-pressed=${this.picked?.ref===s.ref?"true":"false"} data-cand=${s.ref}
                @click=${()=>this.pick(s)} @keydown=${r=>{(r.key==="Enter"||r.key===" ")&&(r.preventDefault(),this.pick(s))}}>
                <div class="grow"><div class="t1">${s.device_name||s.name}</div><div class="t2 wrap">${[s.area_name,s.unit].filter(Boolean).join(" · ")}${s.verdict!=="accepted"&&s.message?n` · <span class=${s.verdict==="rejected"?"bad":""}>${s.message}</span>`:d}</div></div>
                ${a?n`<span class="chip c-mut nodot">${e("candRejected")}</span>`:d}</div>`}):d}
      </div>
      ${this.picked?n`<div class="formgrid">
            <div class="fld"><label for="wnm">${e("meterName")}</label><div class="inp"><input id="wnm" data-add-name .value=${this.newName} @input=${s=>this.newName=s.target.value} /></div></div>
            <div class="fld"><label for="wnk">${e("meterKind")}</label><div class="inp"><select id="wnk" data-add-kind @change=${s=>this.newKind=s.target.value}>${Is.map(s=>n`<option value=${s} ?selected=${s===this.newKind}>${Rt(s)}</option>`)}</select></div></div>
          </div>`:d}
      ${this.addError?n`<div class="alert err" role="alert" data-add-error>${this.addError}</div>`:d}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked||this.adding} @click=${()=>void this.confirmAdd()}>${e("add")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.setParams({add:null})}>${e("cancel")}</sw-button>
    </sw-dialog>`:d}frame(t,s){return n`<div class=${t==="ready"?"page":d} data-water="meters" data-state=${t} aria-busy=${t==="loading"?"true":d}>${s}</div>`}renderForbidden(){return n`<sw-state-panel state="forbidden" data-water="meters" data-state="forbidden"></sw-state-panel>`}skeletonRow(t){return n`<div class="row skrow">${t}</div>`}renderEmpty(t){return n`<sw-state-panel icon="drop" state="empty" heading=${e("emptyMeters")}>${t}</sw-state-panel>`}renderNoResults(){return n`<sw-state-panel icon="drop" state="empty" compact heading=${e("noResults")} data-no-results></sw-state-panel>`}renderCard(t){return n`<water-meter-card .meterId=${t} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} .night=${this.night[t]}
          @close=${()=>this.setParams({meter:null})} @changed=${()=>void this.load(!1)}></water-meter-card>`}};I.styles=[rt,he,Vt`
      .mcard:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      .mcard .base {
        align-items: baseline;
      }
      .cand {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-block-size: 300px;
        overflow: auto;
      }
      .cand .li[aria-pressed='true'] {
        outline: 2px solid var(--sw-accent);
      }
    `,ue,st];q([c()],I.prototype,"open",2);q([c()],I.prototype,"night",2);q([c()],I.prototype,"rules",2);q([c()],I.prototype,"snooze",2);q([c()],I.prototype,"cq",2);q([c()],I.prototype,"cands",2);q([c()],I.prototype,"candPhase",2);q([c()],I.prototype,"picked",2);q([c()],I.prototype,"newName",2);q([c()],I.prototype,"newKind",2);q([c()],I.prototype,"adding",2);q([c()],I.prototype,"addError",2);I=q([X("water-meters-page")],I);var ia=Object.defineProperty,ra=Object.getOwnPropertyDescriptor,O=(t,s,a,r)=>{for(var i=r>1?void 0:r?ra(s,a):s,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(s,a,i):l(i))||i);return r&&i&&ia(s,a,i),i};const na=[1440,10080,43200],Cs=/^\d{1,6}(\.\d{1,4})?$/,As=(t=5)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div></div>`)}</div>`;let A=class extends et{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.tariffs=null,this.tariffsErr=!1,this.shared=null,this.cfg=null,this.cfgLoaded=!1,this.snooze=yt,this.addN="30",this.addU="min",this.snoozeErr="",this.notice="",this.vf=null,this.vErr="",this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.loadPrices(),this.loadAlerts()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}get section(){const t=this.params.get("set");return t==="alerts"?"alerts":t==="prices"||this.access.manage||this.access.bills?"prices":"alerts"}async loadPrices(){if(!(!this.access.manage&&!this.access.bills))try{const[t,s]=await Promise.all([v.listTariffs(),v.sharedSettings().catch(()=>null)]);this.tariffs=t.items,this.shared=s,this.tariffsErr=!1}catch{this.tariffsErr=!0,this.tariffs=[]}}async loadAlerts(){const t=await zt(!0);this.cfg=t,this.snooze=t?{...t.snooze,durations:[...t.snooze.durations]}:{...yt,durations:[...yt.durations]},this.cfgLoaded=!0}flash(t){this.notice=t,window.setTimeout(()=>this.notice="",4e3)}openVersion(t){const s=t?.current;this.vErr="",this.vf={tariffId:t?.id??null,name:"",from:new Date().toISOString().slice(0,10),water:s?.water_price??"",sewage:s?.sewage_price??"0",mode:s?.price_mode??this.shared?.default_price_mode??"ex_vat"}}async saveVersion(){const t=this.vf;if(!(!t||this.busy)){if(!t.tariffId&&!t.name.trim())return void(this.vErr=e("errName"));if(!/^\d{4}-\d{2}-\d{2}$/.test(t.from))return void(this.vErr=e("errDate"));if(!Cs.test(t.water.trim())||Number(t.water)<=0||!Cs.test(t.sewage.trim()||"0"))return void(this.vErr=e("errPrice"));this.busy=!0,this.vErr="";try{const s={effective_from:t.from,water_price:t.water.trim(),sewage_price:t.sewage.trim()||"0",price_mode:t.mode};t.tariffId?await v.addVersion(t.tariffId,s):await v.createTariff({name:t.name.trim(),...s}),this.vf=null,this.flash(e("saved")),await this.loadPrices()}catch(s){this.vErr=M(s)}finally{this.busy=!1}}}async deleteVersion(t,s){if(!this.busy){this.busy=!0,this.error="";try{await v.deleteVersion(t.id,s.id),await this.loadPrices()}catch(a){this.error=M(a)}finally{this.busy=!1}}}sharedLink(){const t=this.shared?.edit_link??"";return t.startsWith("#/system/")?t:Rs}renderPrices(){if(!this.access.manage&&!this.access.bills)return n`<sw-state-panel state="forbidden" compact></sw-state-panel>`;if(this.tariffs===null)return As();const t=this.shared?.vat.current?.rate_percent??null,s=this.access.manage,a=this.tariffsErr?n`<sw-state-panel state="error" heading=${e("loadTariffsError")} actionLabel=${e("retry")} @action=${()=>void this.loadPrices()}></sw-state-panel>`:n`${this.tariffs.length?d:n`<sw-state-panel icon="drop" state="empty" compact heading=${e("noTariffs")}></sw-state-panel>`}
        ${this.tariffs.map(i=>n`<div class="card flush" data-tariff=${i.id}>
          <div class="hd" style="padding:14px 16px 0"><b>${i.name}</b><span class="sp"></span><span class="mut">${e("usedBy",{n:i.used_by})}</span>
            ${s?n`<sw-button size="sm" data-new-version @click=${()=>this.openVersion(i)}>${e("newVersion")}</sw-button>`:d}</div>
          <div class="scrollx"><table class="t"><thead><tr><th>${e("colFrom")}</th><th class="n">${e("colWaterM3")}</th><th class="n">${e("colSewageM3")}</th><th class="n">${e("colIncVat")}</th><th></th></tr></thead>
            <tbody>${i.versions.map(o=>{const l=o.price_inc_vat??De(o.water_price,o.sewage_price,o.price_mode,i.vat_rate_percent??t);return n`<tr data-version=${o.id}><td class="num" style="text-align:start">${J(o.effective_from)} ${i.current?.id===o.id?n`<span class="chip c-ok nodot">${e("current")}</span>`:d}${o.locked?n` <span class="chip c-mut nodot" data-locked>${e("locked")}</span>`:d}</td>
                <td class="n"><span class="num">${k(o.water_price)}</span></td><td class="n"><span class="num">${k(o.sewage_price)}</span></td><td class="n"><span class="num">${l===null?"-":k(l)}</span></td>
                <td class="n">${s&&!o.locked&&i.versions.length>1?n`<sw-button variant="ghost" size="sm" iconOnly icon="trash" label=${e("delVersion")} ?disabled=${this.busy} @click=${()=>void this.deleteVersion(i,o)}></sw-button>`:d}</td></tr>`})}</tbody></table></div></div>`)}
        ${s?n`<sw-button icon="plus" style="align-self:flex-start" data-new-tariff @click=${()=>this.openVersion(null)}>${e("newTariff")}</sw-button>`:d}`,r=n`<div class="card" data-card="shared"><div class="hd"><b>${e("sharedTitle")}</b></div>
      <div class="mut" style="margin-block-end:10px">${e("sharedNote")}</div>
      <dl class="kv"><dt>${e("vatInForce")}</dt><dd class="num" data-vat>${t===null?"-":`${t}%`}</dd></dl>
      <a class="btn sm" style="margin-block-start:10px;align-self:flex-start" href=${this.sharedLink()} data-shared-link>${e("toShared")}</a></div>`;return n`<div class="cols side"><div class="col">${a}${this.error?n`<div class="alert err" role="alert">${this.error}</div>`:d}</div><div class="col">${r}</div></div>`}renderVersionDialog(){const t=this.vf;if(!t)return d;const s=(a,r)=>this.vf={...t,[a]:r};return n`<elec-dialog open heading=${t.tariffId?e("newVersion"):e("newTariff")} data-dialog="version" @close=${()=>this.vf=null}>
      <div class="formgrid">
        ${t.tariffId?d:n`<div class="fld wide"><label for="wtn">${e("tariffName")}</label><input id="wtn" data-tariff-name .value=${t.name} @input=${a=>s("name",a.target.value)} /></div>`}
        <div class="fld"><label for="wtf">${e("colFrom")}</label><input id="wtf" type="date" lang=${Ns()} class="ltr" .value=${t.from} @change=${a=>s("from",a.target.value)} /></div>
        <div class="fld"><span class="lbl">${e("priceMode")}</span><div class="seg" role="group" aria-label=${e("priceMode")}>
          <button type="button" aria-pressed=${t.mode==="ex_vat"?"true":"false"} @click=${()=>s("mode","ex_vat")}>${e("modeEx")}</button>
          <button type="button" aria-pressed=${t.mode==="inc_vat"?"true":"false"} @click=${()=>s("mode","inc_vat")}>${e("modeInc")}</button></div></div>
        <div class="fld"><label for="wtw">${e("colWaterM3")}</label><input id="wtw" class="ltr" inputmode="decimal" data-water-price .value=${t.water} @input=${a=>s("water",a.target.value)} /></div>
        <div class="fld"><label for="wts">${e("colSewageM3")}</label><input id="wts" class="ltr" inputmode="decimal" data-sewage-price .value=${t.sewage} @input=${a=>s("sewage",a.target.value)} /></div>
      </div>
      ${this.vErr?n`<div class="alert err" role="alert">${this.vErr}</div>`:d}
      <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.saveVersion()}>${e("save")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.vf=null}>${e("cancel")}</sw-button>
    </elec-dialog>`}setSnooze(t){this.snooze=t,this.snoozeErr=Kt(t)??""}addDuration(){const t=Ae(Number(this.addN),this.addU);!Number.isFinite(t)||t<=0||this.snooze.durations.includes(t)||this.setSnooze({...this.snooze,durations:[...this.snooze.durations,t].sort((s,a)=>s-a)})}removeDuration(t){const s=this.snooze;if(s.durations.length<2)return void(this.snoozeErr=e("keepOne"));const a=s.durations.filter(r=>r!==t);this.setSnooze({...s,durations:a,default:a.includes(s.default)?s.default:a[0]})}async saveSnooze(){const t=Kt(this.snooze);if(t)return void(this.snoozeErr=t);if(!this.busy){this.busy=!0,this.snoozeErr="";try{const s=await w.saveSnooze(this.snooze,this.cfg?.row_version);this.cfg=this.cfg?{...this.cfg,snooze:s.snooze,row_version:s.row_version}:s,await zt(!0),this.flash(e("saved"))}catch(s){this.snoozeErr=s instanceof mt&&s.code==="revision_conflict"?e("conflict"):M(s),s instanceof mt&&s.code==="revision_conflict"&&await this.loadAlerts()}finally{this.busy=!1}}}renderAlerts(){if(!this.cfgLoaded)return As();const t=this.access.configure&&(this.cfg?.can_edit??!0),s=this.snooze,a=this.cfg?.rules??vt,r=[...new Set([...na,s.max])].sort((o,l)=>o-l),i=JSON.stringify(s)!==JSON.stringify(this.cfg?.snooze??yt);return n`<div class="cols side"><div class="col"><div class="card" data-card="snooze"><div class="hd"><b>${e("snoozeCard")}</b></div>
        <div class="fld"><span class="lbl">${e("snoozeDurations")}</span><div class="chips-ed" data-sn-chips>
          ${s.durations.map(o=>n`<span class="chip nodot" data-duration=${o}>${tt(o)}${t?n`<button type="button" aria-label=${e("removeDuration",{d:tt(o)})} data-sn-del=${o} @click=${()=>this.removeDuration(o)}><sw-icon name="close" size="13"></sw-icon></button>`:d}</span>`)}
          ${t?n`<span class="row" style="gap:6px;flex-wrap:nowrap"><input type="number" min="1" aria-label=${e("snoozeAddValue")} style="inline-size:76px" data-sn-n .value=${this.addN} @input=${o=>this.addN=o.target.value} />
            <select aria-label=${e("snoozeUnit")} style="inline-size:96px" data-sn-u @change=${o=>this.addU=o.target.value}>
              <option value="min" ?selected=${this.addU==="min"}>${e("uMin")}</option><option value="hour" ?selected=${this.addU==="hour"}>${e("uHour")}</option><option value="day" ?selected=${this.addU==="day"}>${e("uDay")}</option></select>
            <sw-button size="sm" data-sn-add @click=${()=>this.addDuration()}>${e("add")}</sw-button></span>`:d}</div></div>
        <div class="formgrid" style="margin-block-start:12px">
          <div class="fld"><label for="sn-def">${e("snoozeDefault")}</label><select id="sn-def" data-sn-def ?disabled=${!t} @change=${o=>this.setSnooze({...s,default:Number(o.target.value)})}>${s.durations.map(o=>n`<option value=${o} ?selected=${o===s.default}>${tt(o)}</option>`)}</select></div>
          <div class="fld"><label for="sn-max">${e("snoozeMax")}</label><select id="sn-max" data-sn-max ?disabled=${!t} @change=${o=>this.setSnooze({...s,max:Number(o.target.value)})}>${r.map(o=>n`<option value=${o} ?selected=${o===s.max}>${tt(o)}</option>`)}</select></div>
        </div>
        ${this.snoozeErr?n`<div class="msg" role="alert" data-sn-error>${this.snoozeErr}</div>`:d}
        ${t?n`<div class="row" style="margin-block-start:12px"><sw-button variant="primary" data-sn-save ?disabled=${this.busy||!i||!!Kt(s)} @click=${()=>void this.saveSnooze()}>${e("save")}</sw-button></div>`:n`<div class="mut" style="margin-block-start:10px">${e("noConfigure")}</div>`}
      </div></div>
      <div class="col"><div class="card" data-card="rules"><div class="hd"><b>${e("rulesCard")}</b></div><dl class="kv">
        <dt>${e("rWindow")}</dt><dd class="num">${a.night_from}-${a.night_to}</dd><dt>${e("rThreshold")}</dt><dd>${a.night_min_lph} ${e("lph")}</dd><dt>${e("rDuration")}</dt><dd>${js(a.night_min_intervals*15)}</dd></dl>
        <div class="mut" style="margin-block-start:8px">${e("rulesReadonly")}</div></div></div></div>`}render(){if(!this.access.manage&&!this.access.configure)return n`<sw-state-panel state="forbidden" data-water="settings" data-state="forbidden"></sw-state-panel>`;const t=this.section,s=a=>b("/infra/water/settings",{set:a});return n`<div class="page" data-water="settings" data-state="ready" data-section=${t}>
      <div class="seg sect-nav" role="group" aria-label=${e("sections")} data-set-nav>
        ${this.access.manage||this.access.bills?n`<button type="button" data-set="prices" aria-pressed=${t==="prices"?"true":"false"} @click=${()=>s("prices")}>${e("sTariffs")}</button>`:d}
        <button type="button" data-set="alerts" aria-pressed=${t==="alerts"?"true":"false"} @click=${()=>s("alerts")}>${e("sAlerts")}</button></div>
      ${this.notice?n`<div class="notice" role="status" data-notice>${this.notice}</div>`:d}
      ${t==="prices"?this.renderPrices():this.renderAlerts()}
      ${this.renderVersionDialog()}
    </div>`}};A.styles=[rt,st];O([E({attribute:!1})],A.prototype,"segments",2);O([E({attribute:!1})],A.prototype,"params",2);O([c()],A.prototype,"access",2);O([c()],A.prototype,"tariffs",2);O([c()],A.prototype,"tariffsErr",2);O([c()],A.prototype,"shared",2);O([c()],A.prototype,"cfg",2);O([c()],A.prototype,"cfgLoaded",2);O([c()],A.prototype,"snooze",2);O([c()],A.prototype,"addN",2);O([c()],A.prototype,"addU",2);O([c()],A.prototype,"snoozeErr",2);O([c()],A.prototype,"notice",2);O([c()],A.prototype,"vf",2);O([c()],A.prototype,"vErr",2);O([c()],A.prototype,"busy",2);O([c()],A.prototype,"error",2);A=O([X("water-settings-page")],A);var oa=Object.defineProperty,la=Object.getOwnPropertyDescriptor,H=(t,s,a,r)=>{for(var i=r>1?void 0:r?la(s,a):s,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(s,a,i):l(i))||i);return r&&i&&oa(s,a,i),i};const Ds={today:"rToday","7d":"r7d","30d":"r30d",prev:"rPrevMonth"},Ps="sw.water.usage.range",St=t=>String(t).padStart(2,"0"),qs=t=>`${t.getFullYear()}-${St(t.getMonth()+1)}-${St(t.getDate())}`,Ut=t=>{const[s,a]=t.split(":").map(Number);return s*60+(a||0)};function Gt(t,s=new Date){const a=new Date(s.getFullYear(),s.getMonth(),s.getDate());if(t==="today")return{from:a,to:s,days:1};if(t==="prev"){const i=new Date(s.getFullYear(),s.getMonth()-1,1),o=new Date(s.getFullYear(),s.getMonth(),1);return{from:i,to:o,days:Math.round((o.getTime()-i.getTime())/864e5)}}const r=t==="7d"?7:30;return{from:new Date(a.getFullYear(),a.getMonth(),a.getDate()-(r-1)),to:s,days:r}}function da(t,s,a,r){const i=Ut(a.night_from),o=Ut(a.night_to),l=p=>{const u=p.getHours()*60+p.getMinutes();return i<=o?u>=i&&u<o:u>=i||u<o},h=t.series??[];if(s==="today")return h.map(p=>{const u=new Date(p.start);return{label:St(u.getHours()),value:(p.litres??0)/1e3,win:l(u)}});const $=new Map;for(const p of h){const u=new Date(p.start),T=qs(u),g=$.get(T)??{value:0,night:0,d:u};g.value+=(p.litres??0)/1e3,l(u)&&(g.night+=(p.litres??0)/1e3),$.set(T,g)}return[...$.entries()].map(([p,u])=>({label:String(u.d.getDate()),value:u.value,night:u.night,leak:r.has(p),title:`${St(u.d.getDate())}.${St(u.d.getMonth()+1)}: ${y(u.value)} ${e("m3")}, ${e("night")} ${Math.round(u.night*1e3)} ${e("litre")}`}))}let U=class extends et{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.range=Fe(Ps,"30d"),this.data=null,this.meters=[],this.leakDays=new Set,this.night={},this.rules=vt,this.phase="loading",this.error="",this.access=at(),this.chartW=640,this.seq=0,this.ro=null,this.observed=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.load()}disconnectedCallback(){this.stop?.(),this.ro?.disconnect(),this.ro=null,this.observed=null,super.disconnectedCallback()}updated(){const t=this.renderRoot.querySelector("[data-usage-chart]");t!==this.observed&&(this.ro?.disconnect(),this.observed=t,!(!t||typeof ResizeObserver!="function")&&(this.ro??=new ResizeObserver(s=>{const a=Math.floor(s[s.length-1].contentRect.width);a>0&&Math.abs(a-this.chartW)>1&&(this.chartW=a)}),this.ro.observe(t)))}async load(){const t=++this.seq;this.phase="loading";const s=Gt(this.range);try{const a=await zt();a&&(this.rules=a.rules);const[r,i,o]=await Promise.all([w.consumption(s.from.toISOString(),s.to.toISOString(),"1h"),w.listMeters(),w.events("all").catch(()=>({items:[]}))]);if(t!==this.seq)return;this.data=r,this.meters=i,this.leakDays=new Set(o.items.filter(l=>l.kind==="night_flow").map(l=>qs(new Date(l.opened_at)))),this.phase="ready",this.night=await Ls(i,this.rules)}catch(a){if(t!==this.seq)return;this.error=M(a),this.phase="error"}}setRange(t){this.range=t,Be(Ps,t),this.load()}csv(){const t=Gt(this.range),s=document.createElement("a");s.href=w.consumptionCsvUrl(t.from.toISOString(),t.to.toISOString(),is()),s.download="",s.click()}renderHead(){return n`<div class="row head">
      <div class="seg ranges" role="group" aria-label=${e("range")} data-ranges>${["today","7d","30d","prev"].map(t=>n`<button type="button" aria-pressed=${this.range===t?"true":"false"} data-range=${t} @click=${()=>this.setRange(t)}>${e(Ds[t])}</button>`)}</div>
      <span class="sp"></span>
      <sw-button icon="download" data-csv ?disabled=${this.phase!=="ready"||!this.data?.items.length} @click=${()=>this.csv()}>${e("csv")}</sw-button>
    </div>`}render(){if(!this.access.view)return n`<sw-state-panel state="forbidden" data-water="usage" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return n`<div class="page" data-water="usage" data-state="loading" aria-busy="true">${this.renderHead()}<div class="card">${Array.from({length:7},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;if(this.phase==="error"||!this.data)return n`<div class="page" data-water="usage" data-state="error">${this.renderHead()}<sw-state-panel state="error" heading=${e("loadUsageError")} hint=${this.error} actionLabel=${e("retry")} @action=${()=>void this.load()}></sw-state-panel></div>`;const t=this.data;if(!t.items.length)return n`<div data-water="usage" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${e("emptyUsage")}>${this.access.manage?n`<sw-button variant="primary" icon="plus" data-add-meter @click=${()=>b("/infra/water/meters",{add:"1"})}>${e("addMeter")}</sw-button>`:d}</sw-state-panel></div>`;const s=Gt(this.range),a=t.total_litres,r=t.previous_total_litres,i=a!==null&&r?Math.round((a-r)/r*100):null,o=da(t,this.range,this.rules,this.leakDays),l=(t.series??[]).filter(m=>{const z=new Date(m.start),Y=z.getHours()*60+z.getMinutes(),nt=Ut(this.rules.night_from),ft=Ut(this.rules.night_to);return m.litres!==null&&(nt<=ft?Y>=nt&&Y<ft:Y>=nt||Y<ft)}),h=l.length?Math.round(l.reduce((m,z)=>m+(z.litres??0),0)/l.length):null,$=`${this.rules.night_from}-${this.rules.night_to}`,p=new Map(this.meters.map(m=>[m.id,m])),u=[...t.items].sort((m,z)=>(z.litres??-1)-(m.litres??-1)),T=(m,z)=>m===null||!z?null:Math.round((m-z)/z*100),g=m=>m===null?"-":`${m>0?"+":""}${m}%`,K=m=>m===null||m===0?"":m>0?"up":"down";return n`<div class="page fit" data-water="usage" data-state="ready">
      ${this.renderHead()}
      <div class="tiles" data-tiles>
        <div class="tile"><div class="k">${e("tTotal")}</div><div class="v"><span class="num" data-t="total">${y(a===null?null:a/1e3)}</span><span class="u">${e("m3")}</span></div></div>
        <div class="tile"><div class="k">${e("tVsPrev")}</div><div class="v ${K(i)}"><span class="num" data-t="vs">${g(i)}</span></div></div>
        <div class="tile"><div class="k">${e("tDailyAvg")}</div><div class="v"><span class="num" data-t="avg">${y(a===null?null:a/1e3/Math.max(1,s.days))}</span><span class="u">${e("m3")}</span></div></div>
        <div class="tile"><div class="k">${e("tNightAvg")}</div><div class="v"><span class="num" data-t="night">${h??"-"}</span><span class="u">${e("lph")}</span></div></div>
      </div>
      <div class="card">
        <div class="hd"><h3 class="sec">${this.range==="today"?e("hourlyUsage"):e("dailyUsage")}</h3><span class="sp"></span>
          <div class="legend"><span><i style="background:var(--sw-accent)"></i>${e("legendDay")}</span><span><i style="background:color-mix(in srgb, var(--sw-heading, var(--sw-text)) 55%, var(--sw-surface-3))"></i>${e("legendNight",{w:$})}</span><span><i style="background:var(--sw-danger)"></i>${e("legendLeak")}</span></div></div>
        <div class="usage-chart" data-usage-chart>${Ws(o,`${e("dailyUsage")} · ${e(Ds[this.range])}`,m=>m.toFixed(m<10?2:1),this.chartW)}</div>
      </div>
      <div class="card flush scrollx desk-only fitbox"><table class="t" data-usage-table>
        <thead><tr><th>${e("colName")}</th><th>${e("colArea")}</th><th class="n">${e("colUsage")}</th><th>${e("colShare")}</th><th class="n">${e("colVsPrev")}</th><th class="n">${e("colNight")}</th></tr></thead>
        <tbody>${u.map(m=>{const z=T(m.litres,m.previous_litres),Y=m.share===null?0:Math.round(m.share*100);return n`<tr data-meter=${m.meter_id}><td class="b">${m.display_name}</td><td>${m.area_name??"-"}<span class="mut dsk">${m.floor_name?` · ${m.floor_name}`:""}</span></td>
            <td class="n"><span class="num">${y(m.litres===null?null:m.litres/1e3)}</span></td>
            <td><span class="share"><i><b style="width:${Y}%"></b></i><span class="num mut">${Y}%</span></span></td>
            <td class="n ${K(z)}"><span class="num">${g(z)}</span></td><td class="n"><span class="num">${p.has(m.meter_id)?Ct(this.night[m.meter_id]):"-"}</span></td></tr>`})}</tbody></table></div>
      <div class="list phone-only" style="flex-direction:column" data-usage-rows>${u.map(m=>{const z=T(m.litres,m.previous_litres);return n`<div class="li"><div class="grow"><div class="t1">${m.display_name}</div><div class="t2">${m.area_name??""} · <span class="num">${m.share===null?0:Math.round(m.share*100)}%</span> · ${e("vsPrevShort")} <span class="num ${K(z)}">${g(z)}</span> · ${e("night")} ${Ct(this.night[m.meter_id])}</div></div>
          <div class="amt num">${y(m.litres===null?null:m.litres/1e3)} ${e("m3")}</div></div>`})}</div>
    </div>`}};U.styles=[rt,st];H([E({attribute:!1})],U.prototype,"segments",2);H([E({attribute:!1})],U.prototype,"params",2);H([c()],U.prototype,"range",2);H([c()],U.prototype,"data",2);H([c()],U.prototype,"meters",2);H([c()],U.prototype,"leakDays",2);H([c()],U.prototype,"night",2);H([c()],U.prototype,"rules",2);H([c()],U.prototype,"phase",2);H([c()],U.prototype,"error",2);H([c()],U.prototype,"access",2);H([c()],U.prototype,"chartW",2);U=H([X("water-usage-page")],U);var ca=Object.defineProperty,ha=Object.getOwnPropertyDescriptor,jt=(t,s,a,r)=>{for(var i=r>1?void 0:r?ha(s,a):s,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(s,a,i):l(i))||i);return r&&i&&ca(s,a,i),i};const ss=ee.map(t=>({id:t.id,label:t.label,tag:`water-${t.id}-page`,money:ie.includes(t.id),manage:ae.includes(t.id)}));function ua(t){const s=t[1]==="water"?t[2]:void 0;return ss.find(a=>a.id===s)?.id??"meters"}function Ms(t,s){return s.view&&(!t.money||s.bills)&&(!t.manage||se(s))}let $t=class extends et{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.route=null,this.access=at(),this.alerts=ge(),this.tabsMode=new Qs(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.stopCount=we(t=>this.alerts=t),ls()}disconnectedCallback(){this.stop?.(),this.stopCount?.(),ds(this),this.pagesChip=null,super.disconnectedCallback()}body(t,s){const a=this.access,r=this.route;if(!a.loaded)return n`<sw-state-panel state="loading" data-water=${t} data-state="loading"></sw-state-panel>`;if(a.failed)return n`<sw-state-panel state="error" heading=${e("loadMetersError")} actionLabel=${e("retry")} data-water=${t} data-state="error" @action=${()=>void ls()}></sw-state-panel>`;if(!a.enabled)return n`<sw-state-panel state="stale" heading=${e("offTitle")} hint=${e("offHint")} data-water=${t} data-state="off">
        ${a.manage||a.configure?n`<sw-button size="sm" data-to-settings @click=${()=>b(Rs.slice(1))}>${e("toSettings")}</sw-button>`:d}
      </sw-state-panel>`;if(!Ms(s,a))return n`<sw-state-panel state="forbidden" data-water=${t} data-state="forbidden"></sw-state-panel>`;if(!customElements.get(s.tag))return n`<sw-state-panel icon="drop" state="empty" heading=${e("noScreen")} data-water=${t} data-state="empty"></sw-state-panel>`;const i=me(s.tag);return $e`<${i} .segments=${(r?.segments??[]).slice(3)} .params=${r?.params??new URLSearchParams}></${i}>`}render(){const t=this.access,s=ua(this.route?.segments??[]),a=ss.find($=>$.id===s),i=t.loaded&&!t.failed&&t.enabled&&t.view?ss.filter($=>Ms($,t)):[],o=Xs("infra.water",i.map($=>({id:$.id,label:$.label,href:`#/infra/water/${$.id}`,...$.id==="alerts"&&this.alerts?{count:this.alerts}:{}})),G()),l=o.length>0&&ve(this.tabsMode.value,o.length);this.pagesChip=l?fe(e("pageRow"),o,s,$=>b(`/infra/water/${$}`)):null;const h=l||!o.length?d:n`<sw-tabs .items=${o} .active=${s} .variant=${Zs("infra.water")} data-infra-pages></sw-tabs>`;return n`<sw-page heading=${e("tab")} data-infra-page="water">${h===d?d:n`<div class="rows" data-water-shell>${h}</div>`}<div class="body" data-page=${s}>${this.body(s,a)}</div></sw-page>`}updated(){this.pagesChip?te(this,this.pagesChip):ds(this)}};$t.styles=[Vt`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      inline-size: 100%;
    }
    sw-page {
      flex: 1 1 auto;
      min-block-size: 0;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .body {
      min-inline-size: 0;
    }
    .body > * {
      display: block;
    }
    /* WKWATER-POLISH-2331 (NOSCROLL-297, as infra-electricity.ts): the control pages - meters, usage, alerts - take the height left under
       the tab rows; their table (or cards) and the areas tree scroll inside their own boxes (screens/water/page-*.ts, water/styles.ts
       .page.fit). The documents (accounts, bills, customers, settings) keep the page scroll. */
    @media (min-width: 900px) {
      .body[data-page='meters'],
      .body[data-page='usage'],
      .body[data-page='alerts'] {
        flex: 1 1 auto;
        min-block-size: 0;
        display: flex;
        flex-direction: column;
      }
      .body[data-page='meters'] > *,
      .body[data-page='usage'] > *,
      .body[data-page='alerts'] > * {
        flex: 1 1 auto;
        min-block-size: 0;
        display: flex;
        flex-direction: column;
      }
    }
  `,st];jt([E({attribute:!1})],$t.prototype,"route",2);jt([c()],$t.prototype,"access",2);jt([c()],$t.prototype,"alerts",2);$t=jt([X("infra-water")],$t);export{$t as InfraWater};
