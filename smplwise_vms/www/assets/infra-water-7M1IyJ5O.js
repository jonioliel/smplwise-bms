import{bc as Ee,i as q,g as P,bb as et,b8 as O,cG as Ye,b9 as wt,E as zt,C as at,F as C,G as d,a as X,S as tt,md as it,me as rt,T as N,ak as b,A as c,e as r,bP as Re,H as Z,w as ut,j as mt,mf as Oe,du as Ge,mg as ne,ip as oe,jP as Je,jM as Qe,jN as le,jO as de,iq as Xe,mh as Ze,mi as ts,mj as es,mk as ss,jQ as as}from"./index-BKxQRAkH.js";import{a4 as J,a8 as Bt,a7 as Gt}from"./format-CqFt42Jg.js";import{e as Le}from"./styles-DkXNBB4G.js";import{s as is,u as rs}from"./static-C97oFVVa.js";import{i as ns,a as os}from"./infra-pages-C2cRYMEU.js";import{l as ls}from"./lead-reserve-CqqzWBLm.js";import{s as ds,a as cs}from"./sr-heading-DLZJ8HCr.js";import"./sw-logo-art-Va6y_cIM.js";const R="infra/water/",ht=t=>{const e=new URLSearchParams;for(const[n,i]of Object.entries(t))i!==void 0&&i!==""&&e.set(n,String(i));const a=e.toString();return a?`?${a}`:""},vt={night_from:"01:00",night_to:"05:00",night_min_lph:6,night_min_intervals:8},yt={durations:[15,60,240,1440],default:60,max:10080},w={listMeters:async()=>q()?(await P(`${R}meters`)).items:[],meter:t=>P(`${R}meters/${encodeURIComponent(t)}`),candidates:async(t="")=>q()?(await P(`${R}candidates${ht({q:t,include_rejected:!0})}`)).items:[],createMeter:t=>O(`${R}meters`,t),patchMeter:(t,e)=>wt(`${R}meters/${encodeURIComponent(t.id)}`,{revision:t.revision,...e}),retireMeter:t=>et(`${R}meters/${encodeURIComponent(t.id)}${ht({revision:t.revision})}`),replaceMeter:(t,e)=>O(`${R}meters/${encodeURIComponent(t.id)}/replace`,{revision:t.revision,...e}),series:async(t,e,a,n)=>q()?(await P(`${R}meters/${encodeURIComponent(t)}/series${ht({from:a,to:n,bucket:e})}`)).items:[],consumption:async(t,e,a)=>q()?P(`${R}consumption${ht({from:t,to:e,bucket:a})}`):{from:t,to:e,items:[],total_litres:null,previous_total_litres:null,series:[]},consumptionCsvUrl:(t,e,a)=>Ye(`${R}consumption.csv${ht({from:t,to:e,lang:a})}`),manualReadings:async t=>q()?(await P(`${R}meters/${encodeURIComponent(t)}/manual-readings`)).items:[],addManual:(t,e)=>O(`${R}meters/${encodeURIComponent(t)}/manual-readings`,e),undoManual:(t,e)=>O(`${R}meters/${encodeURIComponent(t)}/manual-readings/${encodeURIComponent(e)}/undo`,{}),events:async(t,e)=>{if(!q())return{items:[],summary:{open:0,acked:0,last_7d:0,open_leaks:0,snoozed:0}};const a=await P(`${R}events${ht({state:t,meter_id:e})}`);return e||hs(a.summary.open),a},ack:t=>O(`${R}events/${encodeURIComponent(t)}/ack`,{}),snooze:(t,e)=>O(`${R}events/${encodeURIComponent(t)}/snooze`,e===void 0?{}:{minutes:e}),unsnooze:t=>et(`${R}events/${encodeURIComponent(t)}/snooze`),alerts:async()=>q()?P(`${R}alerts`):{rules:vt,snooze:yt,snooze_limits:{min:5,max:43200,count:12},row_version:0,can_edit:!0},saveSnooze:(t,e)=>Ee(`${R}alerts`,{snooze:t,row_version:e})};let Jt=0;const Qt=new Set,us=()=>Jt;function hs(t){if(t!==Jt){Jt=t;for(const e of Qt)e(t)}}function ps(t){return Qt.add(t),()=>Qt.delete(t)}let Pt=null;async function At(t=!1){if(!t&&Pt&&Date.now()-Pt.at<6e4)return Pt.cfg;let e=null;try{e=await w.alerts()}catch{e=null}return Pt={at:Date.now(),cfg:e},e}const ce=t=>{const[e,a]=t.split(":").map(Number);return(e||0)*60+(a||0)};function ms(t,e=new Date){const a=ce(t.night_from),n=ce(t.night_to),i=(p,F)=>new Date(p.getFullYear(),p.getMonth(),p.getDate(),Math.floor(F/60),F%60),o=e.getHours()*60+e.getMinutes(),l=new Date(e);o<a&&!(n<a&&o<n)&&l.setDate(l.getDate()-1);const u=i(l,a),f=new Date(u);n<=a&&f.setDate(f.getDate()+1);const h=i(f,n);return{from:u,to:h>e?e:h}}function fs(t){const e=t.map(a=>a.litres).filter(a=>a!=null);return e.length?Math.round(Math.min(...e)*10)/10:null}function Ie(t){const e=t.rules?.night_rule;return typeof e=="boolean"?!e:t.kind==="irrigation"}const ue=new Map;async function Be(t,e){const a={},n=ms(e);return await Promise.all(t.map(async i=>{if(Ie(i))return void(a[i.id]="off");if(i.status==="retired"||i.value_l===null)return void(a[i.id]=null);const o=ue.get(i.id);if(o&&Date.now()-o.at<6e5)return void(a[i.id]=o.v);try{const l=fs(await w.series(i.id,"1h",n.from.toISOString(),n.to.toISOString()));ue.set(i.id,{at:Date.now(),v:l}),a[i.id]=l}catch{a[i.id]=null}})),a}const Fe=t=>t.area_id??"_none";function he(t,e="ללא קומה",a="ללא אזור"){const n=new Map;for(const i of t){const o=i.floor_id??"",l=n.get(o)??{floor_id:o,name:i.floor_name??e,count:0,areas:[]};l.count++;const u=Fe(i),f=l.areas.find(h=>h.area_id===u);f?f.count++:l.areas.push({area_id:u,name:i.area_name??a,count:1}),n.set(o,l)}return[...n.values()]}const $="infra/water/",lt=t=>{const e=new URLSearchParams;for(const[n,i]of Object.entries(t))i!==void 0&&i!==""&&e.set(n,String(i));const a=e.toString();return a?`?${a}`:""},Ht=()=>`wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`,v={sharedSettings:()=>P(`${$}billing/shared`),listCustomers:t=>q()?P(`${$}customers${lt({q:t})}`):Promise.resolve({items:[],total:0}),customer:t=>P(`${$}customers/${t}`),nextCustomerNumber:()=>P(`${$}customers/next-number`),createCustomer:t=>O(`${$}customers`,t),updateCustomer:(t,e)=>wt(`${$}customers/${t}`,e),deleteCustomer:(t,e)=>et(`${$}customers/${t}${lt({base_revision:e})}`),listTariffs:()=>q()?P(`${$}tariffs`):Promise.resolve({items:[]}),createTariff:t=>O(`${$}tariffs`,t),renameTariff:(t,e)=>wt(`${$}tariffs/${t}`,{name:e}),deleteTariff:t=>et(`${$}tariffs/${t}`),addVersion:(t,e)=>O(`${$}tariffs/${t}/versions`,e),correctVersion:(t,e,a)=>wt(`${$}tariffs/${t}/versions/${e}`,a),deleteVersion:(t,e)=>et(`${$}tariffs/${t}/versions/${e}`),listAccounts:t=>q()?P(`${$}accounts${lt({q:t})}`):Promise.resolve({items:[],summary:{active:0,drafts:0}}),account:t=>P(`${$}accounts/${t}`),accountStatus:t=>P(`${$}accounts/${t}/status`),accountHistory:(t,e=12)=>P(`${$}accounts/${t}/history${lt({past:e})}`),accountBills:t=>P(`${$}accounts/${t}/bills`),createAccount:t=>O(`${$}accounts`,t),updateAccount:(t,e)=>wt(`${$}accounts/${t}`,e),deleteAccount:(t,e)=>et(`${$}accounts/${t}${lt({base_revision:e})}`),preset:(t,e,a,n)=>O(`${$}formula/preset`,{preset:t,meter_ids:e,main_meter_id:a,percent:n}),listBills:(t={})=>q()?P(`${$}bills${lt(t)}`):Promise.resolve({items:[],total:0,counts:{draft:0,issued:0,sent:0,paid:0,void:0},sums:{open:"0.00",paid:"0.00"}}),bill:t=>P(`${$}bills/${t}`),billEvents:t=>P(`${$}bills/${t}/events`),createBill:(t,e)=>O(`${$}accounts/${t}/bills`,{period:e,client_request_id:Ht()}),recalculate:t=>O(`${$}bills/${t.id}/recalculate`,{row_version:t.row_version}),deleteDraft:t=>et(`${$}bills/${t.id}${lt({row_version:t.row_version})}`),issue:(t,e=Ht())=>O(`${$}bills/${t.id}/issue`,{row_version:t.row_version,client_request_id:e}),markSent:(t,e,a="")=>O(`${$}bills/${t.id}/sent`,{how:e,note:a,row_version:t.row_version}),markPaid:(t,e="")=>O(`${$}bills/${t.id}/paid`,{reference:e,row_version:t.row_version}),void:(t,e)=>O(`${$}bills/${t.id}/void`,{reason:e,row_version:t.row_version}),correct:t=>O(`${$}bills/${t.id}/correct`,{client_request_id:Ht()}),snooze:(t,e)=>O(`infra/water/events/${t}/snooze`,e===void 0?{}:{minutes:e}),unsnooze:t=>et(`infra/water/events/${t}/snooze`),saveSnooze:(t,e)=>Ee("infra/water/alerts",{snooze:t,row_version:e})},vs=zt`
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
`,nt=[Le,vs],$s=new Intl.NumberFormat("he-IL",{minimumFractionDigits:3,maximumFractionDigits:3}),gs=new Intl.NumberFormat("he-IL",{minimumFractionDigits:2,maximumFractionDigits:2});function k(t){if(t==null||t==="")return"-";const e=typeof t=="number"?t:Number(t);return Number.isFinite(e)?$s.format(e):"-"}function A(t){if(t==null||t==="")return"";const e=typeof t=="number"?t:Number(t);return Number.isFinite(e)?`${gs.format(e)} ₪`:""}const kt={draft:{label:"טיוטה",cls:"c-mut"},issued:{label:"הונפק",cls:"c-acc"},sent:{label:"נשלח",cls:"c-warn"},paid:{label:"שולם",cls:"c-ok"},void:{label:"בוטל",cls:"c-err"}};function jt(t){return t.status==="paused"?{label:"מושהה",cls:"c-mut"}:t.stale_meters.length?{label:"מונה לא מדווח",cls:"c-warn"}:{label:"פעיל",cls:"c-ok"}}const pe={off:"בלי יצירה אוטומטית",draft:"ליצור טיוטה",issue:"להנפיק אוטומטית"};function me(t,e){return`${t===1?"חודשית":"דו-חודשית"} · מה-${e}`}function bs(t){return{water:t.filter(e=>e.component==="water"),sewage:t.filter(e=>e.component==="sewage")}}function st(t){return t<60?`${t} ד׳`:t===60?"שעה":t<1440?t%60===0?`${t/60} שעות`:`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")} שעות`:t===1440?"יממה":t%1440===0?`${t/1440} ימים`:`${Math.round(t/1440*10)/10} ימים`}function ae(t,e,a="Asia/Jerusalem"){const n=new Date(t.getTime()+e*6e4),i=u=>new Intl.DateTimeFormat("en-CA",{timeZone:a,year:"numeric",month:"2-digit",day:"2-digit"}).format(u),o=new Intl.DateTimeFormat("he-IL",{timeZone:a,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(n),l=Math.round((Date.parse(i(n))-Date.parse(i(t)))/864e5);return l<=0?o:l===1?`מחר ${o}`:`${l} ימים, ${o}`}const Nt={min:5,max:43200,count:12};function qt(t){return!Number.isInteger(t.max)||t.max<Nt.min||t.max>Nt.max?"המקסימום הוא בין 5 דקות ל-30 ימים.":!t.durations.length||t.durations.length>Nt.count?"יש להציע בין משך אחד ל-12 משכים.":t.durations.some(e=>!Number.isInteger(e)||e<Nt.min||e>t.max)?"משך נדנוד ארוך מהמקסימום.":t.durations.includes(t.default)?null:"ברירת המחדל חייבת להיות אחד מהמשכים המוצעים."}function ws(t,e){return Math.round(t*(e==="min"?1:e==="hour"?60:1440))}function ys(t,e,a,n){const i=Number(t)+Number(e);return Number.isFinite(i)?a==="inc_vat"?Math.round(i*100)/100:n===null?null:Math.round(i*(1+Number(n)/100)*100)/100:null}function Xt(t){const e=t;if(!e||typeof e!="object")return null;if(typeof e.m=="string")return[{sign:1,meter_id:e.m}];if((e.op==="+"||e.op==="-")&&Array.isArray(e.args)&&e.args.length>=2){const a=e.args.map(o=>Xt(o));if(a.some(o=>o===null))return null;const[n,...i]=a;return[...n,...i.flatMap(o=>e.op==="-"?o.map(l=>({...l,sign:l.sign*-1})):o)]}return null}function fe(t){const e=new Set,a=t.filter(l=>l.meter_id&&!e.has(l.meter_id)&&e.add(l.meter_id)),n=a.filter(l=>l.sign>0),i=a.filter(l=>l.sign<0);if(!n.length)return null;let o={m:n[0].meter_id};for(const l of n.slice(1))o={op:"+",args:[o,{m:l.meter_id}]};for(const l of i)o={op:"-",args:[o,{m:l.meter_id}]};return o}function _s(t,e){return(t.state==="issued"||t.state==="sent")&&!!t.due_date&&t.due_date<e}const Ue={tab:"מים",pageRow:"עמודים",offTitle:"המודול כבוי",offHint:"מוני מים מופעלים בהגדרות המערכת",toSettings:"להגדרות",forbidden:"אין הרשאה",noScreen:"אין מסך",retry:"נסה שוב",cancel:"ביטול",save:"שמירה",back:"חזרה",close:"סגירה",remove:"הסרה",add:"הוספה",loading:"טוען",csv:"ייצוא CSV",m3:"מ״ק",litre:"ליטר",lph:"ליטר לשעה",ils:"₪",search:"חיפוש מונה",view:"תצוגה",cards:"כרטיסים",table:"טבלה",addMeter:"הוספת מונה",allAreas:"כל האזורים",areas:"אזורים",area:"אזור",tToday:"היום",tMonth:"מתחילת החודש",tReporting:"מדווחים",tOf:"מתוך {n}",tLeak:"דליפה חשודה",tMeters:"מונים",colName:"שם",colArea:"אזור",colReading:"קריאה נוכחית (מ״ק)",colToday:"היום",colMonth:"מתחילת החודש",colNight:"ספיקת לילה",colState:"מצב",todayM3:"מ״ק היום",nightOff:"כבוי",emptyMeters:"אין מונים עדיין",noResults:"לא נמצאו מונים",loadMetersError:"לא ניתן לטעון את המונים",stReporting:"מדווח",stNotReporting:"לא מדווח",stNotReportingSince:"לא מדווח מ-{t}",stPaused:"מושהה",stRetired:"הוצא משימוש",stLeak:"דליפה חשודה",stAbnormal:"צריכה חריגה",addTitle:"הוספת מונה",candSearch:"חיפוש חיישן לפי שם",candNone:"לא נמצאו חיישנים מתאימים",candRejected:"לא מתאים",meterName:"שם המונה",meterKind:"סוג",added:"המונה נוסף",kMain:"ראשי",kSub:"משני",kIrrigation:"השקיה",kCooling:"קירור",kPool:"בריכה",kOther:"אחר",cardLoadError:"לא ניתן לטעון את המונה",fArea:"אזור",fReading:"קריאה נוכחית",fLast:"דיווח אחרון",fUnit:"יחידה",fUnitValue:"מ״ק · מונה מצטבר",fKind:"סוג",fNight:"ספיקת לילה",fNightOff:"כלל הלילה כבוי (השקיה)",fRules:"כללי דליפה",fRulesDefault:"ברירת המחדל של המערכת · לילה {w}",fRulesOwn:"כללים של המונה · לילה {w}",usage:"צריכה",range:"טווח",r24h:"24 שעות",r30d:"30 ימים",r12m:"12 חודשים",chartAria:"גרף צריכה, {r}",chartError:"לא ניתן לטעון את גרף הצריכה",chartNoData:"אין נתונים לתקופה",nightNote:"ליטר לשעה · חלון הלילה {w} מודגש",openAlerts:"התראות פתוחות",epochs:"תקופות מונה",epochStart:"קריאת התחלה",epochUntil:"עד",epochActive:"פעיל",reasonFirst:"התקנה",reasonReplaced:"החלפת מונה",reasonSource:"שינוי מקור",readings:"קריאות ידניות וכיול",manualReading:"קריאה ידנית",noReadings:"אין קריאות ידניות",readingAt:"מועד הקריאה",readingValue:"קריאה",readingNote:"הערה (לא חובה)",readingSaved:"הקריאה נשמרה",readingUndo:"ביטול קריאה",readingVoided:"בוטלה",effAllocation:"הושלם פער דיווח",effRecorded:"נשמרה להשוואה",rename:"שינוי שם",renameTitle:"שינוי שם המונה",replace:"החלפת מונה",replaceFinal:"קריאה סופית של המונה הישן",replaceStart:"קריאת התחלה של המונה החדש",replaceNote:"הערה (לא חובה)",replaceBad:"צריך להזין קריאה תקינה",pause:"השהיה",resume:"חידוש",removeTitle:"הסרת המונה",removeBody:"המונה יוסר מהרשימה. הנתונים שנאספו יישמרו.",nameRequired:"צריך לכתוב שם למונה",ack:"אישור",acked:"ההתראה אושרה",snooze:"נדנוד {d}",snoozeOther:"משך נדנוד אחר",snoozeTo:"נדנוד ל...",snoozeUntil:"עד {t}",snoozedUntil:"מנודנדת עד {t}",snoozedToast:"ההתראה נודנדה ל-{d} (עד {t})",snoozeFoot:"המשכים נקבעים בהגדרות",unsnooze:"סיום נדנוד",fOpen:"פתוחות",fAll:"הכול",filter:"סינון",leakRules:"כללי דליפה",tOpen:"פתוחות",tClosedWeek:"נסגרו השבוע",tSnoozed:"מנודנדות",tRule:"כללי דליפה",ruleValue:"{lph} ליטר לשעה · {dur}",colMeter:"מונה",colKind:"סוג",colSince:"מאז",colValue:"ערך",akNight:"דליפה · ספיקה רציפה בלילה",akBurst:"פריצה",akAbnormal:"צריכה חריגה",akOffline:"לא מדווח",akHealth:"תקלה במונה",asOpen:"פתוחה",asAcked:"אושרה · {who}",asClosed:"נסגרה",asClosedBy:"נסגרה · {who}",valueRate:"{v} ליטר לשעה",valueRateTh:"{v} ליטר לשעה (סף {t})",valueAbnormal:"{v} מ״ק, רגיל {m}",emptyAlerts:"אין התראות",loadAlertsError:"לא ניתן לטעון את ההתראות",rToday:"היום",r7d:"7 ימים",rPrevMonth:"חודש קודם",tTotal:"סה״כ בטווח",tVsPrev:"לעומת התקופה הקודמת",tDailyAvg:"ממוצע יומי",tNightAvg:"ספיקת לילה ממוצעת",dailyUsage:"צריכה יומית",hourlyUsage:"צריכה לפי שעה",legendDay:"יום",legendNight:"לילה {w}",legendLeak:"דליפה חשודה",colUsage:"צריכה (מ״ק)",colShare:"חלק",colVsPrev:"לעומת הקודם",vsPrevShort:"לעומת הקודם",night:"לילה",emptyUsage:"אין נתוני צריכה עדיין",loadUsageError:"לא ניתן לטעון את הצריכה",csvDone:"הקובץ הורד",accSearch:"חיפוש חשבון או לקוח",newAccount:"חשבון חדש",tActiveAccounts:"חשבונות פעילים",tPeriodUsage:"צריכה בתקופה",tAmountSoFar:"סכום עד כה",tDrafts:"טיוטות לבדיקה",colAccount:"חשבון",colCustomer:"לקוח",colFormula:"נוסחה",colPeriod:"תקופה",colPeriodUsage:"צריכה בתקופה (מ״ק)",colAmount:"סכום עד כה",colLastBill:"חיוב אחרון",emptyAccounts:"אין חשבונות עדיין",noAccounts:"לא נמצאו חשבונות",loadAccountsError:"לא ניתן לטעון את החשבונות",accounts:"חשבונות",tabStatus:"מצב",tabHistory:"היסטוריה",tabBills:"חיובים",edit:"עריכה",createBill:"יצירת טיוטת חיוב",accDayOf:"יום {d} מתוך {n}",tForecast:"צפי לתקופה",tNextBill:"החיוב הבא",colStartReading:"קריאה בתחילת התקופה",colCurrentReading:"קריאה נוכחית",colContribution:"תרומה",staleNote:"המונה {name} לא מדווח: הצריכה שלו לא נספרת עד שידווח שוב.",customerCard:"כרטיס לקוח",priceCard:"מחיר",waterPrice:"מים למ״ק",sewagePrice:"ביוב למ״ק",incVat:"כולל מע״מ",exVat:"לפני מע״מ",vat:"מע״מ",autoMode:"חיוב אוטומטי",hMeasured:"נמדד",hPartial:"חלקי",hMissing:"חסר",hOpen:"פתוחה",colChange:"שינוי",colSum:"סכום",noHistory:"אין היסטוריה עדיין",noBills:"אין חיובים לחשבון",loadAccountError:"לא ניתן לטעון את החשבון",accFormNew:"חשבון חדש",accFormEdit:"עריכת חשבון",accName:"שם החשבון",accCustomer:"לקוח",accPickCustomer:"בחירת לקוח",accFormula:"נוסחת מונים",accAddPlus:"+ מונה",accAddMinus:"− מונה",accLossPreset:"הפרש כללי (אובדן ודליפות)",accPickMeter:"בחירת מונה",accMainMeter:"מונה ראשי",accTariff:"תעריף",accPeriod:"תקופה",accMonthly:"חודשית",accBimonthly:"דו-חודשית",accAnchorDay:"יום תחילת התקופה",accFirstStart:"תחילת התקופה הראשונה",accAuto:"מצב חיוב אוטומטי",accStatus:"מצב החשבון",accActive:"פעיל",accPaused:"מושהה",accDelete:"מחיקת חשבון",accDeleteBody:"החשבון יימחק. חיובים שהונפקו נשמרים.",errName:"צריך לכתוב שם",errCustomer:"צריך לבחור לקוח",errFormula:"צריך לפחות מונה אחד בסימן +",errTariff:"צריך לבחור תעריף",errDate:"תאריך לא תקין",billSearch:"חיפוש מספר או לקוח",stateFilter:"סינון לפי מצב",tBillDrafts:"טיוטות",tOpenAmount:"ממתינים לתשלום",tPaid:"שולמו",tLate:"באיחור",colNumber:"מספר",colM3:"מ״ק",colTotal:"סה״כ כולל מע״מ",colDue:"לתשלום עד",emptyBills:"אין חיובים עדיין",noBillsFound:"לא נמצאו חיובים",loadBillsError:"לא ניתן לטעון את החיובים",toAccounts:"לחשבונות",bills:"חיובים",billNo:"חיוב {no}",billDraft:"טיוטת חיוב",loadBillError:"לא ניתן לטעון את החיוב",pItem:"פריט",pQty:"כמות",pPrice:"מחיר",pAmount:"סכום",pWater:"מים",pSewage:"ביוב",pSubtotal:"סה״כ לפני מע״מ",pVat:"מע״מ {p}%",pTotal:"סה״כ לתשלום",pPeriod:"תקופה",pCustomerNo:"מספר לקוח",pIssued:"תאריך הנפקה",pDue:"לתשלום עד",pFormula:"מונים",details:"פרטים",log:"יומן",replaces:"מחליף את {no}",replacedBy:"הוחלף בחיוב המתוקן",originAuto:"נוצר אוטומטית",originManual:"נוצר ידנית",source:"מקור",sentOn:"נשלח",paidOn:"שולם",pdf:"PDF",pdfLater:"הפקת PDF לחיוב מים תתווסף בהמשך",aRecalc:"חישוב מחדש",aIssue:"הנפקה",aSent:"סימון כנשלח",aPaid:"סימון כשולם",aCorrect:"תיקון",aVoid:"ביטול חיוב",aDelete:"מחיקת טיוטה",dIssueTitle:"הנפקת חיוב",dIssueBody:"החיוב יקבל מספר. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.",dVoidTitle:"ביטול חיוב",dVoidBody:"החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.",dVoidReason:"סיבת הביטול",dReasonRequired:"צריך לכתוב סיבה",dCorrectTitle:"תיקון חיוב",dCorrectBody:"תיווצר טיוטה מתוקנת. כשהיא תונפק, החיוב המקורי יבוטל אוטומטית.",dCorrectGo:"יצירת טיוטה מתוקנת",dSentTitle:"סימון כנשלח",dSentHow:"אופן משלוח",howEmail:"דוא״ל",howHand:"ביד",howOther:"אחר",dPaidTitle:"סימון כשולם",dPaidRef:"אסמכתה (לא חובה)",dDeleteTitle:"מחיקת טיוטה",dDeleteBody:"הטיוטה תימחק. אפשר ליצור אחרת מעמוד החשבון.",optional:"לא חובה",evCreated:"נוצרה טיוטה",evRecalculated:"חושב מחדש",evIssued:"הונפק",evSent:"סומן כנשלח",evPaid:"סומן כשולם",evVoided:"בוטל",evCorrected:"נוצר תיקון",evDeleted:"נמחק",custSearch:"חיפוש לקוח",newCustomer:"לקוח חדש",colCustNo:"מספר",colAddress:"כתובת / יחידה",colPhone:"טלפון",colEmail:"דוא״ל",colAccounts:"חשבונות",colBalance:"יתרה פתוחה",emptyCustomers:"אין לקוחות עדיין",noCustomers:"לא נמצאו לקוחות",loadCustomersError:"לא ניתן לטעון את הלקוחות",loadCustomerError:"לא ניתן לטעון את הלקוח",cName:"שם הלקוח",cNumber:"מספר לקוח",cTaxId:"ח.פ. / ע.מ. (לא חובה)",cAddress:"כתובת למשלוח החיוב",cPhone:"טלפון",cEmail:"דוא״ל",cNotes:"הערות",cNoAccounts:"אין חשבונות ללקוח",cRecentBills:"חיובים אחרונים",cDelete:"מחיקת לקוח",cDeleteBody:"הלקוח יימחק. חיובים שהונפקו שומרים עותק של פרטיו.",cDeleteRefused:"אי אפשר למחוק לקוח שיש לו חשבונות (מים או חשמל).",cShared:"כרטיס הלקוח משותף עם החשמל",errEmail:"כתובת דוא״ל לא תקינה",errCustNo:"מספר לקוח הוא ספרות בלבד",sTariffs:"תעריפי מים וביוב",sAlerts:"התראות והשהיה",sections:"חלקי ההגדרות",usedBy:"בשימוש ב-{n} חשבונות",newVersion:"גרסה חדשה",newTariff:"תעריף חדש",colFrom:"בתוקף מ-",colWaterM3:"מים למ״ק",colSewageM3:"ביוב למ״ק",colIncVat:"כולל מע״מ",current:"נוכחי",locked:"נעול",tariffName:"שם התעריף",priceMode:"המחיר מוזן",modeEx:"לפני מע״מ",modeInc:"כולל מע״מ",errPrice:"מחיר לא תקין",noTariffs:"אין תעריפים עדיין",loadTariffsError:"לא ניתן לטעון את התעריפים",delVersion:"מחיקת גרסה",shared:"משותף עם החשבון",sharedTitle:"משותף עם החשמל",sharedNote:"מע״מ, פרטי העסק, מספור, תנאי תשלום ושמירת נתונים - מהגדרות החיוב של החשמל.",vatInForce:"מע״מ בתוקף",toShared:"להגדרות החיוב המשותפות",snoozeCard:"השהיית התראה (נדנוד)",snoozeDurations:"משכי נדנוד מוצעים",snoozeAddValue:"משך להוספה",snoozeUnit:"יחידה",uMin:"דקות",uHour:"שעות",uDay:"ימים",snoozeDefault:"ברירת מחדל של כפתור «נדנוד»",snoozeMax:"נדנוד מרבי",removeDuration:"הסרת {d}",keepOne:"חייב להישאר לפחות משך אחד",saved:"נשמר",rulesCard:"כללי דליפה",rWindow:"חלון לילה",rThreshold:"סף",rDuration:"משך",rulesReadonly:"הכללים נשארים כפי שאושרו ואינם משתנים כאן.",noConfigure:"שינוי ההגדרות זמין למנהלי מערכת",conflict:"מישהו אחר שינה בינתיים. הנתונים רועננו, נסו שוב.",hours:"{n} שעות",hour1:"שעה",hours2:"שעתיים",minutes:"{n} דקות"},ks={tab:"Water",pageRow:"Pages",offTitle:"The module is off",offHint:"Water meters are switched on in the system settings",toSettings:"To settings",forbidden:"No permission",noScreen:"No screen",retry:"Try again",cancel:"Cancel",save:"Save",back:"Back",close:"Close",remove:"Remove",add:"Add",loading:"Loading",csv:"Export CSV",m3:"m³",litre:"L",lph:"L/h",ils:"₪",search:"Search meter",view:"View",cards:"Cards",table:"Table",addMeter:"Add meter",allAreas:"All areas",areas:"Areas",area:"Area",tToday:"Today",tMonth:"Month to date",tReporting:"Reporting",tOf:"of {n}",tLeak:"Suspected leak",tMeters:"meters",colName:"Name",colArea:"Area",colReading:"Current reading (m³)",colToday:"Today",colMonth:"Month to date",colNight:"Night flow",colState:"State",todayM3:"m³ today",nightOff:"Off",emptyMeters:"No meters yet",noResults:"No meters found",loadMetersError:"The meters could not be loaded",stReporting:"Reporting",stNotReporting:"Not reporting",stNotReportingSince:"Not reporting since {t}",stPaused:"Paused",stRetired:"Retired",stLeak:"Suspected leak",stAbnormal:"Abnormal use",addTitle:"Add meter",candSearch:"Search sensors by name",candNone:"No suitable sensors found",candRejected:"Not suitable",meterName:"Meter name",meterKind:"Kind",added:"The meter was added",kMain:"Main",kSub:"Sub-meter",kIrrigation:"Irrigation",kCooling:"Cooling",kPool:"Pool",kOther:"Other",cardLoadError:"The meter could not be loaded",fArea:"Area",fReading:"Current reading",fLast:"Last report",fUnit:"Unit",fUnitValue:"m³ · cumulative meter",fKind:"Kind",fNight:"Night flow",fNightOff:"Night rule off (irrigation)",fRules:"Leak rules",fRulesDefault:"System default · night {w}",fRulesOwn:"Meter rules · night {w}",usage:"Consumption",range:"Range",r24h:"24 hours",r30d:"30 days",r12m:"12 months",chartAria:"Consumption chart, {r}",chartError:"The consumption chart could not be loaded",chartNoData:"No data for the period",nightNote:"L/h · the night window {w} is highlighted",openAlerts:"Open alerts",epochs:"Counter lives",epochStart:"Start reading",epochUntil:"until",epochActive:"Active",reasonFirst:"Installation",reasonReplaced:"Meter replaced",reasonSource:"Source changed",readings:"Manual readings",manualReading:"Manual reading",noReadings:"No manual readings",readingAt:"Read at",readingValue:"Reading",readingNote:"Note (optional)",readingSaved:"The reading was saved",readingUndo:"Undo reading",readingVoided:"Undone",effAllocation:"Reporting gap filled",effRecorded:"Kept for comparison",rename:"Rename",renameTitle:"Rename the meter",replace:"Replace meter",replaceFinal:"Final reading of the old meter",replaceStart:"Start reading of the new meter",replaceNote:"Note (optional)",replaceBad:"Enter a valid reading",pause:"Pause",resume:"Resume",removeTitle:"Remove the meter",removeBody:"The meter leaves the list. The collected data is kept.",nameRequired:"Write a name for the meter",ack:"Acknowledge",acked:"The alert was acknowledged",snooze:"Snooze {d}",snoozeOther:"Other snooze duration",snoozeTo:"Snooze for...",snoozeUntil:"until {t}",snoozedUntil:"Snoozed until {t}",snoozedToast:"Snoozed for {d} (until {t})",snoozeFoot:"The durations are set in settings",unsnooze:"End snooze",fOpen:"Open",fAll:"All",filter:"Filter",leakRules:"Leak rules",tOpen:"Open",tClosedWeek:"Closed this week",tSnoozed:"Snoozed",tRule:"Leak rules",ruleValue:"{lph} L/h · {dur}",colMeter:"Meter",colKind:"Kind",colSince:"Since",colValue:"Value",akNight:"Leak · continuous night flow",akBurst:"Burst",akAbnormal:"Abnormal use",akOffline:"Not reporting",akHealth:"Meter fault",asOpen:"Open",asAcked:"Acknowledged · {who}",asClosed:"Closed",asClosedBy:"Closed · {who}",valueRate:"{v} L/h",valueRateTh:"{v} L/h (threshold {t})",valueAbnormal:"{v} m³, usual {m}",emptyAlerts:"No alerts",loadAlertsError:"The alerts could not be loaded",rToday:"Today",r7d:"7 days",rPrevMonth:"Previous month",tTotal:"Total in range",tVsPrev:"Versus the previous period",tDailyAvg:"Daily average",tNightAvg:"Average night flow",dailyUsage:"Daily consumption",hourlyUsage:"Hourly consumption",legendDay:"Day",legendNight:"Night {w}",legendLeak:"Suspected leak",colUsage:"Consumption (m³)",colShare:"Share",colVsPrev:"Versus previous",vsPrevShort:"vs previous",night:"night",emptyUsage:"No consumption data yet",loadUsageError:"The consumption could not be loaded",csvDone:"The file was downloaded",accSearch:"Search account or customer",newAccount:"New account",tActiveAccounts:"Active accounts",tPeriodUsage:"Consumption in period",tAmountSoFar:"Amount so far",tDrafts:"Drafts to review",colAccount:"Account",colCustomer:"Customer",colFormula:"Formula",colPeriod:"Period",colPeriodUsage:"Consumption in period (m³)",colAmount:"Amount so far",colLastBill:"Last bill",emptyAccounts:"No accounts yet",noAccounts:"No accounts found",loadAccountsError:"The accounts could not be loaded",accounts:"Accounts",tabStatus:"Status",tabHistory:"History",tabBills:"Bills",edit:"Edit",createBill:"Create a draft bill",accDayOf:"Day {d} of {n}",tForecast:"Period forecast",tNextBill:"Next bill",colStartReading:"Reading at period start",colCurrentReading:"Current reading",colContribution:"Contribution",staleNote:"The meter {name} is not reporting: its consumption is not counted until it reports again.",customerCard:"Customer card",priceCard:"Price",waterPrice:"Water per m³",sewagePrice:"Sewage per m³",incVat:"Incl. VAT",exVat:"Excl. VAT",vat:"VAT",autoMode:"Automatic billing",hMeasured:"Measured",hPartial:"Partial",hMissing:"Missing",hOpen:"Open",colChange:"Change",colSum:"Amount",noHistory:"No history yet",noBills:"No bills for the account",loadAccountError:"The account could not be loaded",accFormNew:"New account",accFormEdit:"Edit account",accName:"Account name",accCustomer:"Customer",accPickCustomer:"Choose a customer",accFormula:"Meter formula",accAddPlus:"+ meter",accAddMinus:"− meter",accLossPreset:"Overall difference (losses and leaks)",accPickMeter:"Choose a meter",accMainMeter:"Main meter",accTariff:"Tariff",accPeriod:"Period",accMonthly:"Monthly",accBimonthly:"Every two months",accAnchorDay:"Period start day",accFirstStart:"First period starts",accAuto:"Automatic bill mode",accStatus:"Account state",accActive:"Active",accPaused:"Paused",accDelete:"Delete account",accDeleteBody:"The account is deleted. Issued bills are kept.",errName:"Write a name",errCustomer:"Choose a customer",errFormula:"At least one meter with a + sign is needed",errTariff:"Choose a tariff",errDate:"Invalid date",billSearch:"Search number or customer",stateFilter:"Filter by state",tBillDrafts:"Drafts",tOpenAmount:"Awaiting payment",tPaid:"Paid",tLate:"Overdue",colNumber:"Number",colM3:"m³",colTotal:"Total incl. VAT",colDue:"Due",emptyBills:"No bills yet",noBillsFound:"No bills found",loadBillsError:"The bills could not be loaded",toAccounts:"To accounts",bills:"Bills",billNo:"Bill {no}",billDraft:"Draft bill",loadBillError:"The bill could not be loaded",pItem:"Item",pQty:"Quantity",pPrice:"Price",pAmount:"Amount",pWater:"Water",pSewage:"Sewage",pSubtotal:"Subtotal excl. VAT",pVat:"VAT {p}%",pTotal:"Total to pay",pPeriod:"Period",pCustomerNo:"Customer number",pIssued:"Issue date",pDue:"Due",pFormula:"Meters",details:"Details",log:"Log",replaces:"Replaces {no}",replacedBy:"Replaced by the corrected bill",originAuto:"Created automatically",originManual:"Created manually",source:"Origin",sentOn:"Sent",paidOn:"Paid",pdf:"PDF",pdfLater:"A PDF of a water bill comes later",aRecalc:"Recalculate",aIssue:"Issue",aSent:"Mark sent",aPaid:"Mark paid",aCorrect:"Correct",aVoid:"Void bill",aDelete:"Delete draft",dIssueTitle:"Issue the bill",dIssueBody:"The bill gets a number. After issuing it cannot be edited, only voided or corrected.",dVoidTitle:"Void the bill",dVoidBody:"The bill stays in the list as void. The number is never reused.",dVoidReason:"Reason",dReasonRequired:"Write a reason",dCorrectTitle:"Correct the bill",dCorrectBody:"A corrected draft is created. When it is issued, the original bill is voided automatically.",dCorrectGo:"Create a corrected draft",dSentTitle:"Mark as sent",dSentHow:"Sent by",howEmail:"E-mail",howHand:"By hand",howOther:"Other",dPaidTitle:"Mark as paid",dPaidRef:"Reference (optional)",dDeleteTitle:"Delete the draft",dDeleteBody:"The draft is deleted. Another one can be created from the account page.",optional:"Optional",evCreated:"Draft created",evRecalculated:"Recalculated",evIssued:"Issued",evSent:"Marked sent",evPaid:"Marked paid",evVoided:"Voided",evCorrected:"Correction created",evDeleted:"Deleted",custSearch:"Search customer",newCustomer:"New customer",colCustNo:"Number",colAddress:"Address / unit",colPhone:"Phone",colEmail:"E-mail",colAccounts:"Accounts",colBalance:"Open balance",emptyCustomers:"No customers yet",noCustomers:"No customers found",loadCustomersError:"The customers could not be loaded",loadCustomerError:"The customer could not be loaded",cName:"Customer name",cNumber:"Customer number",cTaxId:"Company / VAT id (optional)",cAddress:"Billing address",cPhone:"Phone",cEmail:"E-mail",cNotes:"Notes",cNoAccounts:"The customer has no accounts",cRecentBills:"Recent bills",cDelete:"Delete customer",cDeleteBody:"The customer is deleted. Issued bills keep a copy of the details.",cDeleteRefused:"A customer with accounts (water or electricity) cannot be deleted.",cShared:"The customer card is shared with electricity",errEmail:"Invalid e-mail address",errCustNo:"A customer number is digits only",sTariffs:"Water and sewage tariffs",sAlerts:"Alerts and snooze",sections:"Settings sections",usedBy:"Used by {n} accounts",newVersion:"New version",newTariff:"New tariff",colFrom:"In force from",colWaterM3:"Water per m³",colSewageM3:"Sewage per m³",colIncVat:"Incl. VAT",current:"Current",locked:"Locked",tariffName:"Tariff name",priceMode:"Prices entered",modeEx:"Excl. VAT",modeInc:"Incl. VAT",errPrice:"Invalid price",noTariffs:"No tariffs yet",loadTariffsError:"The tariffs could not be loaded",delVersion:"Delete version",shared:"Shared with the account",sharedTitle:"Shared with electricity",sharedNote:"VAT, business details, numbering, payment terms and retention come from the electricity billing settings.",vatInForce:"VAT in force",toShared:"To the shared billing settings",snoozeCard:"Alert snooze",snoozeDurations:"Offered snooze durations",snoozeAddValue:"Duration to add",snoozeUnit:"Unit",uMin:"minutes",uHour:"hours",uDay:"days",snoozeDefault:"Default of the «snooze» button",snoozeMax:"Maximum snooze",removeDuration:"Remove {d}",keepOne:"At least one duration must remain",saved:"Saved",rulesCard:"Leak rules",rWindow:"Night window",rThreshold:"Threshold",rDuration:"Duration",rulesReadonly:"The rules stay as approved and are not changed here.",noConfigure:"Changing the settings is for system administrators",conflict:"Someone else changed this meanwhile. The data was refreshed, try again.",hours:"{n} hours",hour1:"an hour",hours2:"two hours",minutes:"{n} minutes"};function ie(){return(typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"").startsWith("en")?"en":"he"}const xs={he:Ue,en:ks};function s(t,e,a=ie()){const n=xs[a][t]??Ue[t]??t;return e?n.replace(/\{(\w+)\}/g,(i,o)=>o in e?String(e[o]):i):n}var Ss=Object.defineProperty,As=Object.getOwnPropertyDescriptor,D=(t,e,a,n)=>{for(var i=n>1?void 0:n?As(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ss(e,a,i),i};const L="/infra/water/accounts",Kt=t=>r`<span class="chip ${t.cls}">${t.label}</span>`,Ft=t=>r`<span class="chip ${kt[t.state].cls}" data-bill-state=${t.state}>${kt[t.state].label}</span>`,Ut=t=>t?`${J(t.from)} - ${J(t.to)}`:"-",Tt=(t=6)=>r`<div class="card" aria-busy="true">${Array.from({length:t},()=>r`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`,Cs=()=>new Date().toISOString().slice(0,10),zs=()=>`${Cs().slice(0,8)}01`,ve=()=>({name:"",customer_id:"",terms:[{sign:1,meter_id:""}],keepAst:null,tariff_id:"",period_months:1,period_anchor_day:1,first_period_start:zs(),auto_mode:"draft",status:"active"});let x=class extends X{constructor(){super(...arguments),this.bubbleSkin=new tt(this),this.segments=[],this.params=new URLSearchParams,this.access=it(),this.st="loading",this.rows=[],this.drafts=null,this.statuses={},this.q="",this.acc=null,this.accSt="loading",this.status=null,this.history=null,this.bills=null,this.error="",this.busy=!1,this.form=ve(),this.errs={},this.customers=[],this.tariffs=[],this.meters=[],this.confirmDel=!1,this.shown=""}connectedCallback(){super.connectedCallback(),this.stop=rt(t=>this.access=t)}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const[e,a]=this.segments,n=`${e??""}/${a??""}`;if(n===this.shown)return;const i=this.shown.split("/")[0];this.shown=n,this.error="",this.errs={},this.confirmDel=!1,e?e==="new"?this.openForm(null):((e!==i||!this.acc)&&this.loadAccount(e),a==="edit"&&this.openForm(e),a==="history"&&!this.history&&this.loadHistory(e),a==="bills"&&!this.bills&&this.access.bills&&this.loadBills(e)):this.loadList()}async loadList(){this.st="loading";try{const t=await v.listAccounts();this.rows=t.items,this.drafts=t.summary.drafts,this.st="ready";const e={};await Promise.all(t.items.slice(0,60).map(async a=>e[a.id]=await v.accountStatus(a.id).catch(()=>null))),this.statuses=e}catch{this.st="error"}}async loadAccount(t){this.accSt="loading",this.history=null,this.bills=null;try{const[e,a]=await Promise.all([v.account(t),v.accountStatus(t).catch(()=>null)]);this.acc=e,this.status=a,this.accSt="ready";const n=this.segments[1];n==="history"&&this.loadHistory(t),n==="bills"&&this.access.bills&&this.loadBills(t)}catch(e){this.error=N(e),this.accSt="error"}}async loadHistory(t){try{this.history=(await v.accountHistory(t)).periods}catch{this.history=[]}}async loadBills(t){try{this.bills=(await v.accountBills(t)).items}catch{this.bills=[]}}async openForm(t){this.errs={},this.error="",t||(this.form=ve());const[e,a,n]=await Promise.all([v.listCustomers().then(i=>i.items).catch(()=>[]),v.listTariffs().then(i=>i.items).catch(()=>[]),w.listMeters().catch(()=>[])]);if(this.customers=e,this.tariffs=a,this.meters=n.filter(i=>i.status!=="retired"),t){const i=this.acc?.id===t?this.acc:await v.account(t).catch(()=>null);if(i){const o=Xt(i.formula.ast);this.form={name:i.name,customer_id:i.customer?.id??"",terms:o??[],keepAst:o?null:i.formula.ast,tariff_id:i.tariff.id,period_months:i.period_months,period_anchor_day:i.period_anchor_day,first_period_start:i.first_period_start,auto_mode:i.auto_mode,status:i.status}}}else!this.form.tariff_id&&a.length===1&&(this.form={...this.form,tariff_id:a[0].id})}setF(t,e){this.form={...this.form,[t]:e},this.errs[t]&&(this.errs={...this.errs,[t]:""})}setTerm(t,e){const a=this.form.terms.map((n,i)=>i===t?{...n,...e}:n);this.form={...this.form,terms:a,keepAst:null},this.errs={...this.errs,formula:""}}async lossPreset(){const t=this.form.terms.find(e=>e.sign>0&&e.meter_id)?.meter_id??this.meters.find(e=>e.kind==="main")?.id??this.meters[0]?.id;if(t)try{const e=await v.preset("main_minus_subs",this.meters.map(n=>n.id),t),a=Xt(e.ast);a&&(this.form={...this.form,terms:a,keepAst:null,name:this.form.name||s("accLossPreset")})}catch(e){this.error=N(e)}}validate(){const t=this.form,e={};return t.name.trim()||(e.name=s("errName")),t.customer_id||(e.customer_id=s("errCustomer")),!t.keepAst&&!fe(t.terms)&&(e.formula=s("errFormula")),t.tariff_id||(e.tariff_id=s("errTariff")),/^\d{4}-\d{2}-\d{2}$/.test(t.first_period_start)||(e.first_period_start=s("errDate")),this.errs=e,!Object.keys(e).length}async save(t){if(this.busy||!this.validate())return;const e=this.form,a={name:e.name.trim(),customer_id:e.customer_id,tariff_id:e.tariff_id,period_months:e.period_months,period_anchor_day:e.period_anchor_day,first_period_start:e.first_period_start,auto_mode:e.auto_mode,...e.keepAst?{}:{formula:{ast:fe(e.terms)}}};this.busy=!0,this.error="";try{if(t&&this.acc){const n=await v.updateAccount(t,{...a,status:e.status,base_revision:this.acc.revision});this.acc=n,b(`${L}/${n.id}`),this.loadAccount(n.id)}else{const n=await v.createAccount(a);b(`${L}/${n.id}`)}}catch(n){this.error=N(n)}finally{this.busy=!1}}async removeRecord(){if(!(!this.acc||this.busy)){this.busy=!0;try{await v.deleteAccount(this.acc.id,this.acc.revision),this.acc=null,b(L)}catch(t){this.error=N(t),this.confirmDel=!1}finally{this.busy=!1}}}fld(t,e,a,n=!1){return r`<div class="fld ${n?"wide":""}"><label for="wa-${t}">${e}</label>${a}${this.errs[t]?r`<div class="msg" role="alert" data-field-error=${t}>${this.errs[t]}</div>`:c}</div>`}renderForm(t){const e=this.form,a=n=>r`<option value="" ?selected=${!n}>${s("accPickMeter")}</option>${this.meters.map(i=>r`<option value=${i.id} ?selected=${i.id===n}>${i.display_name}</option>`)}`;return r`<sw-sheet open wide .heading=${s(t?"accFormEdit":"accFormNew")} data-account-form @close=${()=>b(t?`${L}/${t}`:L)}>
      <div class="col">
        <div class="formgrid">
          ${this.fld("name",s("accName"),r`<input id="wa-name" name="name" class=${this.errs.name?"err":""} .value=${e.name} @input=${n=>this.setF("name",n.target.value)} />`,!0)}
          ${this.fld("customer_id",s("accCustomer"),r`<select id="wa-customer_id" name="customer_id" @change=${n=>this.setF("customer_id",n.target.value)}><option value="" ?selected=${!e.customer_id}>${s("accPickCustomer")}</option>${this.customers.map(n=>r`<option value=${n.id} ?selected=${n.id===e.customer_id}>${n.name} · ${n.customer_number}</option>`)}</select>`)}
          ${this.fld("tariff_id",s("accTariff"),r`<select id="wa-tariff_id" name="tariff_id" @change=${n=>this.setF("tariff_id",n.target.value)}><option value="" ?selected=${!e.tariff_id}>-</option>${this.tariffs.map(n=>r`<option value=${n.id} ?selected=${n.id===e.tariff_id}>${n.name}</option>`)}</select>`)}
        </div>
        <div class="fld"><span class="lbl">${s("accFormula")}</span>
          ${e.keepAst&&this.acc?r`<div class="mut" data-formula-kept>${this.acc.formula.sentence_he}</div>`:c}
          <div class="list" data-formula-terms>${e.terms.map((n,i)=>r`<div class="row" style="flex-wrap:nowrap" data-term=${i}>
            <div class="seg" role="group" aria-label=${s("accFormula")}><button type="button" aria-pressed=${n.sign>0?"true":"false"} data-sign="+" @click=${()=>this.setTerm(i,{sign:1})}>+</button><button type="button" aria-pressed=${n.sign<0?"true":"false"} data-sign="-" @click=${()=>this.setTerm(i,{sign:-1})}>−</button></div>
            <select aria-label=${s("accPickMeter")} style="flex:1" @change=${o=>this.setTerm(i,{meter_id:o.target.value})}>${a(n.meter_id)}</select>
            <button type="button" class="btn ghost sm icononly" aria-label=${s("remove")} @click=${()=>this.form={...this.form,terms:e.terms.filter((o,l)=>l!==i),keepAst:null}}><sw-icon name="close" size="13"></sw-icon></button></div>`)}</div>
          <div class="row">
            <button type="button" class="btn sm" data-add-plus @click=${()=>this.form={...e,terms:[...e.terms,{sign:1,meter_id:""}],keepAst:null}}>${s("accAddPlus")}</button>
            <button type="button" class="btn sm" data-add-minus @click=${()=>this.form={...e,terms:[...e.terms,{sign:-1,meter_id:""}],keepAst:null}}>${s("accAddMinus")}</button>
            <span class="sp"></span>
            <button type="button" class="btn sm" data-loss-preset ?disabled=${!this.meters.length} @click=${()=>void this.lossPreset()}>${s("accLossPreset")}</button></div>
          ${this.errs.formula?r`<div class="msg" role="alert" data-field-error="formula">${this.errs.formula}</div>`:c}</div>
        <div class="formgrid">
          <div class="fld"><span class="lbl">${s("accPeriod")}</span><div class="seg" role="group" aria-label=${s("accPeriod")}>
            <button type="button" aria-pressed=${e.period_months===1?"true":"false"} @click=${()=>this.setF("period_months",1)}>${s("accMonthly")}</button>
            <button type="button" aria-pressed=${e.period_months===2?"true":"false"} @click=${()=>this.setF("period_months",2)}>${s("accBimonthly")}</button></div></div>
          ${this.fld("period_anchor_day",s("accAnchorDay"),r`<input id="wa-period_anchor_day" type="number" min="1" max="31" class="ltr" .value=${String(e.period_anchor_day)} @input=${n=>this.setF("period_anchor_day",Math.min(31,Math.max(1,Number(n.target.value)||1)))} />`)}
          ${this.fld("first_period_start",s("accFirstStart"),r`<input id="wa-first_period_start" type="date" lang=${Re()} class="ltr ${this.errs.first_period_start?"err":""}" .value=${e.first_period_start} @change=${n=>this.setF("first_period_start",n.target.value)} />`)}
          ${this.fld("auto_mode",s("accAuto"),r`<select id="wa-auto_mode" @change=${n=>this.setF("auto_mode",n.target.value)}>${["off","draft","issue"].map(n=>r`<option value=${n} ?selected=${n===e.auto_mode}>${pe[n]}</option>`)}</select>`)}
          ${t?r`<div class="fld"><span class="lbl">${s("accStatus")}</span><div class="seg" role="group" aria-label=${s("accStatus")}>
            <button type="button" aria-pressed=${e.status==="active"?"true":"false"} @click=${()=>this.setF("status","active")}>${s("accActive")}</button>
            <button type="button" aria-pressed=${e.status==="paused"?"true":"false"} @click=${()=>this.setF("status","paused")}>${s("accPaused")}</button></div></div>`:c}
        </div>
        ${this.error?r`<div class="alert err" role="alert">${this.error}</div>`:c}
        <div class="row formacts"><button type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${()=>void this.save(t)}>${s("save")}</button>
          <button type="button" class="btn" @click=${()=>b(t?`${L}/${t}`:L)}>${s("cancel")}</button><span class="sp"></span>
          ${t?r`<button type="button" class="btn dng" data-delete @click=${()=>this.confirmDel=!0}>${s("accDelete")}</button>`:c}</div>
      </div>
      <elec-dialog heading=${s("accDelete")} ?open=${this.confirmDel} data-dialog="delete-account" @close=${()=>this.confirmDel=!1}>
        <div>${s("accDeleteBody")}</div>
        <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeRecord()}>${s("accDelete")}</button>
        <button slot="actions" type="button" class="btn" @click=${()=>this.confirmDel=!1}>${s("cancel")}</button>
      </elec-dialog>
    </sw-sheet>`}renderList(){const t=this.access.bills,e=this.q.trim(),a=this.rows.filter(p=>!e||p.name.includes(e)||(p.customer?.name??"").includes(e)),n=r`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-acc-search placeholder=${s("accSearch")} aria-label=${s("accSearch")} .value=${this.q} @input=${p=>this.q=p.target.value} /></label>
      <span class="sp"></span>
      ${this.access.manage?r`<button type="button" class="btn pri" data-new-account @click=${()=>b(`${L}/new`)}><sw-icon name="plus" size="15"></sw-icon>${s("newAccount")}</button>`:c}
    </div>`;if(this.st==="loading")return r`<div class="page" data-water="accounts" data-state="loading">${n}${Tt()}</div>`;if(this.st==="error")return r`<div class="page" data-water="accounts" data-state="error"><sw-state-panel state="error" heading=${s("loadAccountsError")} actionLabel=${s("retry")} @action=${()=>void this.loadList()}></sw-state-panel></div>`;if(!this.rows.length)return r`<div class="page" data-water="accounts" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${s("emptyAccounts")}>${this.access.manage?r`<button type="button" class="btn pri" data-new-account @click=${()=>b(`${L}/new`)}>${s("newAccount")}</button>`:c}</sw-state-panel></div>`;const i=this.statuses,o=this.rows.reduce((p,F)=>p+Number(i[F.id]?.m3_so_far??0),0),l=this.rows.reduce((p,F)=>p+Number(i[F.id]?.amount_so_far??0),0),u=r`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tActiveAccounts")}</div><div class="v"><span class="num">${this.rows.filter(p=>p.status==="active").length}</span></div></div>
      <div class="tile"><div class="k">${s("tPeriodUsage")}</div><div class="v"><span class="num">${k(o)}</span><span class="u">${s("m3")}</span></div></div>
      ${t?r`<div class="tile"><div class="k">${s("tAmountSoFar")}</div><div class="v"><span class="num">${A(l).replace(" ₪","")}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${s("tDrafts")}</div><div class="v"><span class="num">${this.drafts??0}</span></div></div>`:c}
    </div>`,f=p=>p.last_bill?r`${p.last_bill.number?r`<span class="num">${p.last_bill.number}</span>`:s("tBillDrafts")} ${Ft(p.last_bill)}`:r`<span class="mut">-</span>`,h=a.length?r`<div class="card flush scrollx desk-only"><table class="t" data-acc-table>
          <thead><tr><th>${s("colAccount")}</th><th>${s("colCustomer")}</th><th class="hide-tablet">${s("colFormula")}</th><th>${s("colPeriod")}</th><th class="n">${s("colPeriodUsage")}</th>${t?r`<th class="n">${s("colAmount")}</th><th>${s("colLastBill")}</th>`:c}<th>${s("colState")}</th></tr></thead>
          <tbody>${a.map(p=>r`<tr class="go" data-account-row=${p.id} @click=${()=>b(`${L}/${p.id}`)}>
            <td class="b"><a class="rowlink" href=${`#${L}/${p.id}`} @click=${F=>F.stopPropagation()}>${p.name}</a></td><td>${p.customer?.name??"-"}</td>
            <td class="mut ell hide-tablet">${p.formula.sentence_he}</td><td>${me(p.period_months,p.period_anchor_day)}</td>
            <td class="n"><span class="num">${k(i[p.id]?.m3_so_far??null)}</span></td>
            ${t?r`<td class="n"><span class="num">${i[p.id]?.amount_so_far!==void 0?A(i[p.id]?.amount_so_far):""}</span></td><td>${f(p)}</td>`:c}
            <td>${Kt(jt(p))}</td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-acc-rows>${a.map(p=>r`<a class="li" href=${`#${L}/${p.id}`} data-account-row=${p.id}>
          <div class="grow"><div class="t1">${p.name}</div><div class="t2">${p.customer?.name??""} · <span class="num">${k(i[p.id]?.m3_so_far??null)}</span> ${s("m3")}${t&&i[p.id]?.amount_so_far?r` · <span class="num">${A(i[p.id]?.amount_so_far)}</span>`:c}</div></div>${Kt(jt(p))}</a>`)}</div>`:r`<sw-state-panel icon="search" state="empty" compact heading=${s("noAccounts")}></sw-state-panel>`;return r`<div class="page" data-water="accounts" data-state="ready">${n}${u}${h}</div>`}renderStatus(t){const e=this.status,a=this.access.bills,n=r`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tPeriodUsage")}</div><div class="v"><span class="num">${k(e?.m3_so_far??null)}</span><span class="u">${s("m3")}</span></div></div>
      <div class="tile"><div class="k">${s("colPeriod")}</div><div class="v"><span class="num" style="font-size:var(--sw-fs-md)">${e?.day_of_period&&e.days?s("accDayOf",{d:e.day_of_period,n:e.days}):"-"}</span></div></div>
      <div class="tile"><div class="k">${s("tForecast")}</div><div class="v"><span class="num">${k(e?.m3_forecast??null)}</span><span class="u">${s("m3")}</span></div></div>
      ${a?r`<div class="tile"><div class="k">${s("tAmountSoFar")}</div><div class="v"><span class="num">${e?.amount_so_far?A(e.amount_so_far).replace(" ₪",""):"-"}</span><span class="u">₪</span></div></div>`:c}
    </div>`,i=r`<div class="card flush scrollx" data-acc-meters><table class="t">
      <thead><tr><th>${s("colMeter")}</th><th class="n">${s("colStartReading")}</th><th class="n">${s("colCurrentReading")}</th><th class="n">${s("colUsage")}</th><th class="n">${s("colContribution")}</th></tr></thead>
      <tbody>${(e?.meters??[]).map(u=>r`<tr data-acc-meter=${u.meter_id}><td class="b">${Number(u.coefficient)<0?"− ":""}${u.name}${u.reporting?c:r` <span class="chip c-warn">${s("stNotReporting")}</span>`}</td>
        <td class="n"><span class="num">${k(u.start_m3)}</span></td><td class="n"><span class="num">${k(u.current_m3)}</span></td><td class="n"><span class="num">${k(u.consumption_m3)}</span></td><td class="n"><span class="num">${k(u.contribution_m3)}</span></td></tr>`)}</tbody></table></div>`,o=t.tariff,l=r`<div class="col">
      <div class="card"><div class="hd"><b>${s("customerCard")}</b></div><dl class="kv"><dt>${s("cName")}</dt><dd>${t.customer?.name??"-"}</dd><dt>${s("cNumber")}</dt><dd class="num">${t.customer?.customer_number??"-"}</dd>${t.customer?.address?r`<dt>${s("cAddress")}</dt><dd>${t.customer.address}</dd>`:c}</dl></div>
      <div class="card"><div class="hd"><b>${s("priceCard")}</b></div><dl class="kv"><dt>${s("accTariff")}</dt><dd>${o.name}</dd>
        ${a&&o.water_price!=null?r`<dt>${s("waterPrice")}</dt><dd class="num">${A(o.water_price)}</dd><dt>${s("sewagePrice")}</dt><dd class="num">${A(o.sewage_price)}</dd><dt>${s("colIncVat")}</dt><dd class="num">${o.price_inc_vat?A(o.price_inc_vat):"-"}</dd>`:c}
        <dt>${s("autoMode")}</dt><dd>${pe[t.auto_mode]}</dd></dl></div>
      <div class="card"><div class="hd"><b>${s("tNextBill")}</b></div><dl class="kv"><dt>${s("colPeriod")}</dt><dd class="num">${Ut(t.next_period)}</dd><dt>${s("accPeriod")}</dt><dd>${me(t.period_months,t.period_anchor_day)}</dd></dl></div>
    </div>`;return r`${n}${(e?.stale??[]).map(u=>r`<div class="alert warn" role="status"><span class="x" aria-hidden="true">!</span><div>${s("staleNote",{name:u.name})}</div></div>`)}<div class="cols side"><div class="col"><div class="mut">${t.formula.sentence_he}</div>${i}</div>${l}</div>`}renderHistory(){const t=this.history;if(!t)return Tt(4);if(!t.length)return r`<sw-state-panel icon="history" state="empty" compact heading=${s("noHistory")}></sw-state-panel>`;const e={measured:s("hMeasured"),partial:s("hPartial"),missing:s("hMissing"),open:s("hOpen")};return r`<div class="card flush scrollx" data-acc-history><table class="t"><thead><tr><th>${s("colPeriod")}</th><th class="n">${s("colM3")}</th><th class="n">${s("colChange")}</th><th>${s("colState")}</th>${this.access.bills?r`<th class="n">${s("colSum")}</th>`:c}</tr></thead>
      <tbody>${t.map((a,n)=>{const i=t[n+1]?.m3,o=a.m3!==null&&i?Math.round((Number(a.m3)-Number(i))/Number(i)*100):null;return r`<tr><td class="num" style="text-align:start">${Ut(a)}</td><td class="n"><span class="num">${k(a.m3)}</span></td><td class="n ${o===null||o===0?"":o>0?"up":"down"}"><span class="num">${o===null?"-":`${o>0?"+":""}${o}%`}</span></td>
          <td>${e[a.status]}</td>${this.access.bills?r`<td class="n"><span class="num">${a.bill?.total?A(a.bill.total):"-"}</span></td>`:c}</tr>`})}</tbody></table></div>`}renderBills(){if(!this.access.bills)return r`<sw-state-panel state="forbidden" compact></sw-state-panel>`;const t=this.bills;return t?t.length?re(t,!1):r`<sw-state-panel icon="list" state="empty" compact heading=${s("noBills")}></sw-state-panel>`:Tt(4)}async createDraft(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await v.createBill(t.id);b(`/infra/water/bills/${e.id}`)}catch(e){this.error=N(e)}finally{this.busy=!1}}}renderAccount(t,e){if(this.accSt==="loading"&&this.acc?.id!==t)return r`<div class="page" data-water="account" data-state="loading">${Tt(5)}</div>`;if(this.accSt==="error"||!this.acc)return r`<div class="page" data-water="account" data-state="error"><div class="backrow"><a class="btn ghost sm" href=${`#${L}`}><sw-icon name="chevronBack" size="13"></sw-icon>${s("accounts")}</a></div>
        <sw-state-panel state="error" heading=${s("loadAccountError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.loadAccount(t)}></sw-state-panel></div>`;const a=this.acc,n=e==="history"||e==="bills"?e:"status";return r`<div class="page" data-water="account" data-state="ready" data-account-id=${a.id}>
      <div class="backrow"><a class="btn ghost sm" href=${`#${L}`} data-back><sw-icon name="chevronBack" size="13"></sw-icon>${s("accounts")}</a><b class="h3">${a.name}</b>${Kt(jt(a))}<span class="sp"></span>
        ${this.access.bills?r`<button type="button" class="btn" data-create-bill ?disabled=${this.busy} @click=${()=>void this.createDraft(a)}>${s("createBill")}</button>`:c}
        ${this.access.manage?r`<button type="button" class="btn" data-edit @click=${()=>b(`${L}/${a.id}/edit`)}><sw-icon name="edit" size="14"></sw-icon>${s("edit")}</button>`:c}</div>
      <div class="seg" role="group" aria-label=${s("accounts")} data-acc-tabs style="align-self:flex-start">
        <button type="button" aria-pressed=${n==="status"?"true":"false"} @click=${()=>b(`${L}/${a.id}`)}>${s("tabStatus")}</button>
        <button type="button" aria-pressed=${n==="history"?"true":"false"} @click=${()=>b(`${L}/${a.id}/history`)}>${s("tabHistory")}</button>
        ${this.access.bills?r`<button type="button" aria-pressed=${n==="bills"?"true":"false"} @click=${()=>b(`${L}/${a.id}/bills`)}>${s("tabBills")}</button>`:c}</div>
      ${this.error&&!this.segments.includes("edit")?r`<div class="alert err" role="alert">${this.error}</div>`:c}
      ${n==="status"?this.renderStatus(a):n==="history"?this.renderHistory():this.renderBills()}
    </div>`}render(){if(!this.access.view)return r`<sw-state-panel state="forbidden" data-water="accounts" data-state="forbidden"></sw-state-panel>`;const[t,e]=this.segments;return t?t==="new"?r`${this.renderList()}${this.access.manage?this.renderForm(null):c}`:r`${this.renderAccount(t,e??"")}${e==="edit"&&this.access.manage?this.renderForm(t):c}`:this.renderList()}};x.styles=[nt,at];D([C({attribute:!1})],x.prototype,"segments",2);D([C({attribute:!1})],x.prototype,"params",2);D([d()],x.prototype,"access",2);D([d()],x.prototype,"st",2);D([d()],x.prototype,"rows",2);D([d()],x.prototype,"drafts",2);D([d()],x.prototype,"statuses",2);D([d()],x.prototype,"q",2);D([d()],x.prototype,"acc",2);D([d()],x.prototype,"accSt",2);D([d()],x.prototype,"status",2);D([d()],x.prototype,"history",2);D([d()],x.prototype,"bills",2);D([d()],x.prototype,"error",2);D([d()],x.prototype,"busy",2);D([d()],x.prototype,"form",2);D([d()],x.prototype,"errs",2);D([d()],x.prototype,"customers",2);D([d()],x.prototype,"tariffs",2);D([d()],x.prototype,"meters",2);D([d()],x.prototype,"confirmDel",2);x=D([Z("water-accounts-page")],x);function re(t,e){const a=n=>b(`/infra/water/bills/${n.id}`);return r`<div class="card flush scrollx ${e?"":"desk-only"}"><table class="t" data-bill-table>
      <thead><tr><th>${s("colNumber")}</th><th>${s("colCustomer")}</th><th>${s("colAccount")}</th><th>${s("colPeriod")}</th><th class="n">${s("colM3")}</th><th class="n">${s("colTotal")}</th><th>${s("colDue")}</th><th>${s("colState")}</th></tr></thead>
      <tbody>${t.map(n=>r`<tr class="go" data-bill-row=${n.id} @click=${()=>a(n)}>
        <td class="b"><a class="rowlink num" href=${`#/infra/water/bills/${n.id}`} @click=${i=>i.stopPropagation()}>${n.number??s("tBillDrafts")}</a></td><td>${n.customer.name??"-"}</td><td>${n.account_name}</td>
        <td class="num" style="text-align:start">${Ut(n.period)}</td><td class="n"><span class="num">${k(n.m3)}</span></td><td class="n"><span class="num">${n.total!==void 0?A(n.total):""}</span></td>
        <td class="num" style="text-align:start">${n.due_date?J(n.due_date):"-"}</td><td>${Ft(n)}</td></tr>`)}</tbody></table></div>
    ${e?c:r`<div class="list phone-only" style="flex-direction:column" data-bill-rows>${t.map(n=>r`<a class="li" href=${`#/infra/water/bills/${n.id}`} data-bill-row=${n.id}>
      <div class="grow"><div class="t1"><span class="num">${n.number??s("tBillDrafts")}</span> · ${n.customer.name??""}</div><div class="t2">${n.account_name} · <span class="num">${Ut(n.period)}</span> · <span class="num">${k(n.m3)}</span> ${s("m3")}</div></div>
      <div class="rowend">${Ft(n)}<div class="t2 num">${n.total!==void 0?A(n.total):""}</div></div></a>`)}</div>`}`}var Ds=Object.defineProperty,Ps=Object.getOwnPropertyDescriptor,Dt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Ps(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ds(e,a,i),i};const Q=t=>t==null?"-":k(t/1e3),Ct=t=>t==="off"?s("nightOff"):t==null?"-":String(t),Zt={main:"kMain",sub:"kSub",irrigation:"kIrrigation",cooling:"kCooling",pool:"kPool",other:"kOther"},Rt=t=>t in Zt?s(Zt[t]):t,Ve=Object.keys(Zt),We=["night_flow","burst"];function xt(t,e){const a=e.filter(n=>n.meter_id===t&&!n.closed_at);return a.some(n=>We.includes(n.kind))?"leak":a.some(n=>n.kind==="abnormal")?"abnormal":null}function He(t,e){return e==="leak"?r`<span class="chip c-err" data-status="leak">${s("stLeak")}</span>`:e==="abnormal"?r`<span class="chip c-warn" data-status="abnormal">${s("stAbnormal")}</span>`:t.state==="reporting"?r`<span class="chip c-ok" data-status="reporting">${s("stReporting")}</span>`:t.state==="paused"?r`<span class="chip c-mut" data-status="paused">${s("stPaused")}</span>`:t.state==="retired"?r`<span class="chip c-mut" data-status="retired">${s("stRetired")}</span>`:r`<span class="chip c-warn" data-status="not_reporting">${t.last_report_at?s("stNotReportingSince",{t:Bt(t.last_report_at)}):s("stNotReporting")}</span>`}const $e={night_flow:"akNight",burst:"akBurst",abnormal:"akAbnormal",offline:"akOffline",health:"akHealth"},Ot=t=>t in $e?s($e[t]):t,Mt=t=>typeof t=="number"&&Number.isFinite(t)?t:typeof t=="string"&&t.trim()!==""&&Number.isFinite(Number(t))?Number(t):null,Lt=new Intl.NumberFormat("en-US",{maximumFractionDigits:1});function It(t){const e=t.value??{};if(t.kind==="night_flow"||t.kind==="burst"){const a=Mt(e.floor_lph??e.rate_lph),n=Mt(e.threshold_lph);return a===null?"-":n===null?s("valueRate",{v:Lt.format(a)}):s("valueRateTh",{v:Lt.format(a),t:Lt.format(n)})}if(t.kind==="abnormal"){const a=Mt(e.today_l),n=Mt(e.median_l);return a===null?"-":s("valueAbnormal",{v:k(a/1e3),m:n===null?"-":k(n/1e3)})}return"-"}function ge(t){return t.closed_at?r`<span class="chip c-ok" data-event-state="closed">${t.ack_by_display?s("asClosedBy",{who:t.ack_by_display}):s("asClosed")}</span>`:t.snoozed_until?r`<span class="chip c-mut" data-event-state="snoozed">${s("snoozedUntil",{t:Bt(t.snoozed_until)})}</span>`:t.ack_at?r`<span class="chip c-acc" data-event-state="acked">${s("asAcked",{who:t.ack_by_display??""})}</span>`:r`<span class="chip ${t.severity==="alarm"||We.includes(t.kind)?"c-err":"c-warn"}" data-event-state="open">${s("asOpen")}</span>`}function je(t,e,a=i=>Lt.format(i),n=640){const i=Math.max(320,Math.round(n)),o=170,l=26;if(!t.length)return r`<div class="mut">${s("chartNoData")}</div>`;const u=Math.max(...t.map(g=>g.value),1)*1.15,f=(i-l*2)/t.length,h=Math.min(f*.64,24),p=Math.ceil(t.length/12),F=t.reduce((g,Y,m)=>Y.value>t[g].value?m:g,0);return r`<svg class="chart" viewBox="0 0 ${i} ${o}" role="img" aria-label=${e} data-chart>
    ${t.map((g,Y)=>g.win?ut`<rect class="win" x=${i-l-(Y+1)*f} y="4" width=${f} height=${o-26} />`:c)}
    ${ut`<line x1=${l} x2=${i-l} y1=${o-22} y2=${o-22} class="grid" />`}
    ${t.map((g,Y)=>{const m=Math.max(g.value>0?2:0,g.value/u*(o-44)),T=g.night?Math.min(m,Math.max(g.night>0?2:0,g.night/u*(o-44))):0,G=i-l-(Y+1)*f+(f-h)/2,ot=Y===t.length-1,$t=g.leak?"bar leak":ot?"bar hi":"bar";return ut`<rect class=${$t} x=${G} y=${o-22-m} width=${h} height=${m} rx="3"><title>${g.title??`${g.label}: ${a(g.value)}`}</title></rect>
        ${T?ut`<rect class=${g.leak?"bar leak":"bar night"} x=${G} y=${o-22-T} width=${h} height=${T}><title>${g.title??`${g.label}: ${a(g.value)}`}</title></rect>`:c}
        ${Y%p===0||ot?ut`<text x=${G+h/2} y=${o-6} text-anchor="middle">${g.label}</text>`:c}
        ${ot||Y===F?ut`<text x=${G+h/2} y=${o-27-m} text-anchor="middle" class="val">${a(g.value)}</text>`:c}`})}
  </svg>`}let ct=class extends X{constructor(){super(...arguments),this.settings=null,this.disabled=!1,this.open=!1,this.pos={top:0,left:0},this.onDoc=t=>{t.composedPath().includes(this)||(this.open=!1)},this.onKey=t=>{t.key==="Escape"&&(this.open=!1)}}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this.onDoc,!0),document.addEventListener("keydown",this.onKey)}disconnectedCallback(){document.removeEventListener("click",this.onDoc,!0),document.removeEventListener("keydown",this.onKey),super.disconnectedCallback()}fire(t){this.open=!1,this.dispatchEvent(new CustomEvent("snooze",{detail:{minutes:t},bubbles:!0,composed:!0}))}toggle(t){t.stopPropagation();const e=t.currentTarget.getBoundingClientRect();this.pos={top:Math.min(e.bottom+4,window.innerHeight-240),left:Math.max(8,Math.min(e.left,window.innerWidth-200))},this.open=!this.open}render(){const t=this.settings;if(!t)return c;const e=new Date;return r`<span class="snz" @click=${a=>a.stopPropagation()}>
        <button class="btn sm" type="button" data-snooze=${t.default} ?disabled=${this.disabled} @click=${()=>this.fire(t.default)}><sw-icon name="bellOff" size="13"></sw-icon>${s("snooze",{d:st(t.default)})}</button>
        <button class="btn sm icononly" type="button" data-snooze-menu aria-haspopup="menu" aria-expanded=${this.open?"true":"false"} aria-label=${s("snoozeOther")} ?disabled=${this.disabled} @click=${a=>this.toggle(a)}><sw-icon name="chevronDown" size="13"></sw-icon></button>
      </span>
      ${this.open?r`<div class="menu" role="menu" style="top:${this.pos.top}px;left:${this.pos.left}px" data-snooze-list>
            <div class="mh">${s("snoozeTo")}</div>
            ${t.durations.filter(a=>a<=t.max).map(a=>r`<button type="button" role="menuitem" data-pick=${a} @click=${n=>{n.stopPropagation(),this.fire(a)}}>${st(a)} <span class="mut">(${s("snoozeUntil",{t:ae(e,a)})})</span></button>`)}
            <div class="mh">${s("snoozeFoot")}</div>
          </div>`:c}`}};ct.styles=[Le,zt`
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
    `];Dt([C({attribute:!1})],ct.prototype,"settings",2);Dt([C({type:Boolean})],ct.prototype,"disabled",2);Dt([d()],ct.prototype,"open",2);Dt([d()],ct.prototype,"pos",2);ct=Dt([Z("water-snooze")],ct);function te(t,e){try{const a=localStorage.getItem(t);return a?JSON.parse(a):e}catch{return e}}function ee(t,e){try{localStorage.setItem(t,JSON.stringify(e))}catch{}}function qe(t){return t===60?s("hour1"):t===120?s("hours2"):t%60===0?s("hours",{n:t/60}):s("minutes",{n:t})}var Ns=Object.defineProperty,Ts=Object.getOwnPropertyDescriptor,S=(t,e,a,n)=>{for(var i=n>1?void 0:n?Ts(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ns(e,a,i),i};const be={hours:"r24h",days:"r30d",months:"r12m"},we={first:"reasonFirst",replaced:"reasonReplaced",source_changed:"reasonSource"},_t=t=>String(t).padStart(2,"0"),Ms=t=>`${t.getFullYear()}-${_t(t.getMonth()+1)}-${_t(t.getDate())}T${_t(t.getHours())}:${_t(t.getMinutes())}`,Es=(t,e)=>{const a=t.getHours()*60+t.getMinutes(),[n,i]=e.night_from.split(":").map(Number),[o,l]=e.night_to.split(":").map(Number),u=n*60+i,f=o*60+l;return u<=f?a>=u&&a<f:a>=u||a<f};let y=class extends X{constructor(){super(...arguments),this.bubbleSkin=new tt(this),this.meterId="",this.canManage=!1,this.canAck=!1,this.rules=vt,this.snooze=null,this.night=void 0,this.detail=null,this.phase="loading",this.error="",this.range="hours",this.bars=[],this.chartError=!1,this.alerts=[],this.readings=[],this.dlg="",this.busy=!1,this.actionError="",this.notice="",this.f1="",this.f2="",this.f3="",this.unit="m3",this.kind="",this.seq=0}willUpdate(t){t.has("meterId")&&this.meterId&&this.load()}fire(t){this.dispatchEvent(new CustomEvent(t,{bubbles:!0,composed:!0}))}async load(){const t=++this.seq;this.phase="loading";try{const e=await w.meter(this.meterId);if(t!==this.seq)return;this.detail=e,this.phase="ready",this.canManage&&this.loadReadings(),await this.loadAlerts(),t===this.seq&&this.loadSeries()}catch(e){if(t!==this.seq)return;this.error=N(e),this.phase="error"}}async refresh(){try{this.detail=await w.meter(this.meterId)}catch{}}async loadAlerts(){try{this.alerts=(await w.events("open",this.meterId)).items}catch{this.alerts=[]}}async loadReadings(){try{this.readings=await w.manualReadings(this.meterId)}catch{this.readings=[]}}async loadSeries(){const t=this.range,e=new Date,a=t==="hours"?1:t==="days"?30:365,n=new Date(e.getTime()-a*864e5);try{const i=await w.series(this.meterId,t==="hours"?"1h":"1d",n.toISOString(),e.toISOString());if(t!==this.range)return;const o=xt(this.meterId,this.alerts)==="leak";if(t==="hours")this.bars=i.map(l=>{const u=new Date(l.start),f=Es(u,this.rules);return{label:_t(u.getHours()),value:l.litres??0,win:f,leak:f&&o}});else if(t==="days")this.bars=i.map(l=>({label:String(new Date(l.start).getDate()),value:(l.litres??0)/1e3}));else{const l=new Map;for(const u of i){const f=new Date(u.start),h=`${f.getMonth()+1}/${String(f.getFullYear()).slice(2)}`;l.set(h,(l.get(h)??0)+(u.litres??0)/1e3)}this.bars=[...l.entries()].map(([u,f])=>({label:u,value:f}))}this.chartError=!1}catch{this.chartError=!0}}flash(t){this.notice=t,window.setTimeout(()=>this.notice="",4e3)}async act(t,e){if(!this.busy){this.busy=!0,this.actionError="";try{await t(),e?.(),this.fire("changed")}catch(a){this.actionError=a instanceof mt&&a.code==="revision_conflict"?s("conflict"):N(a),a instanceof mt&&a.code==="revision_conflict"&&await this.refresh()}finally{this.busy=!1}}}ack(t){this.act(()=>w.ack(t.id),()=>{this.flash(s("acked")),this.loadAlerts()})}doSnooze(t,e){const a=!!this.snooze;this.act(()=>w.snooze(t.id,a?e:void 0),()=>{this.flash(s("snoozedToast",{d:st(e),t:ae(new Date,e)})),this.loadAlerts()})}openDlg(t){const e=this.detail;this.actionError="",this.f1=t==="rename"?e?.display_name??"":t==="replace"?e?.value_l!=null?String(e.value_l/1e3):"":t==="reading"?Ms(new Date):"",this.f2=t==="replace"?"0":"",this.f3="",this.kind=e?.kind??"other",this.unit="m3",this.dlg=t}save(){const t=this.detail;if(t)if(this.dlg==="rename"){const e=this.f1.trim();if(!e)return void(this.actionError=s("nameRequired"));this.act(()=>w.patchMeter(t,{display_name:e,...this.kind!==t.kind?{kind:this.kind}:{}}),()=>{this.dlg="",this.refresh()})}else if(this.dlg==="replace"){const e=Number(this.f1),a=Number(this.f2);if(this.f1.trim()===""||!Number.isFinite(e)||e<0||this.f2.trim()===""||!Number.isFinite(a)||a<0)return void(this.actionError=s("replaceBad"));this.act(()=>w.replaceMeter(t,{old_final_reading_l:e*1e3,new_start_reading_l:a*1e3,note:this.f3.trim()||void 0}),()=>{this.dlg="",this.load()})}else if(this.dlg==="reading"){const e=this.f2.trim().replace(",",".");if(!e||!Number.isFinite(Number(e))||Number(e)<0||!this.f1)return void(this.actionError=s("replaceBad"));this.act(()=>w.addManual(t.id,{read_at:new Date(this.f1).toISOString(),value:e,unit:this.unit,note:this.f3.trim()||void 0}),()=>{this.dlg="",this.flash(s("readingSaved")),this.loadReadings(),this.refresh()})}else this.dlg==="remove"&&this.act(()=>w.retireMeter(t),()=>{this.dlg="",this.fire("close")})}renderAlerts(){return this.alerts.length?r`<h3 class="sec">${s("openAlerts")}</h3>
      <div class="list" data-open-alerts>${this.alerts.map(t=>r`<div class="li" data-alert=${t.id}>
        <div class="grow"><div class="t1">${Ot(t.kind)} · ${It(t)}</div><div class="t2 wrap">${s("colSince")} <span class="num">${Bt(t.opened_at)}</span>${t.snoozed_until?r` · ${s("snoozedUntil",{t:Bt(t.snoozed_until)})}`:c}</div></div>
        ${this.canAck?r`<span class="acts">${t.can_ack?r`<button class="btn sm pri" type="button" data-ack ?disabled=${this.busy} @click=${()=>this.ack(t)}>${s("ack")}</button>`:c}
          ${t.can_snooze?r`<water-snooze .settings=${this.snooze??{durations:[60],default:60,max:60}} ?disabled=${this.busy} @snooze=${e=>this.doSnooze(t,e.detail.minutes)}></water-snooze>`:c}</span>`:c}
      </div>`)}</div>`:c}renderReadings(){return this.canManage?r`<div class="row"><h3 class="sec">${s("readings")}</h3><span class="sp"></span><button class="btn sm" type="button" data-reading @click=${()=>this.openDlg("reading")}>${s("manualReading")}</button></div>
      ${this.readings.length?r`<div class="list" data-readings>${this.readings.slice(0,5).map(t=>r`<div class="li"><div class="grow"><div class="t1"><span class="num">${Q(t.litres)}</span> ${s("m3")}</div>
            <div class="t2">${Gt(t.read_at)} · ${t.voided_at?s("readingVoided"):t.effect==="allocation"?s("effAllocation"):s("effRecorded")}${t.note?` · ${t.note}`:""}</div></div>
            ${t.voided_at?c:r`<button class="btn sm ghost" type="button" data-undo-reading ?disabled=${this.busy} @click=${()=>void this.act(()=>w.undoManual(this.meterId,t.id),()=>void this.loadReadings())}>${s("readingUndo")}</button>`}</div>`)}</div>`:r`<div class="mut">${s("noReadings")}</div>`}`:c}renderBody(t){const e=xt(t.id,this.alerts),a=Ie(t),n=`${this.rules.night_from}-${this.rules.night_to}`,i=t.rules&&Object.keys(t.rules).length>0;return r`<div class="body" data-meter-card=${t.id}>
      <div class="row">${He(t,e)}</div>
      ${this.notice?r`<div class="notice" role="status">${this.notice}</div>`:c}
      <dl class="kv">
        <dt>${s("fArea")}</dt><dd>${t.area_name??"-"}${t.floor_name?` · ${t.floor_name}`:""}</dd>
        <dt>${s("fReading")}</dt><dd><span class="num">${Q(t.value_l)}</span> <span class="mut">${s("m3")}</span></dd>
        <dt>${s("fLast")}</dt><dd><span class="num">${Gt(t.last_report_at)}</span></dd>
        <dt>${s("fUnit")}</dt><dd>${s("fUnitValue")}</dd>
        <dt>${s("fKind")}</dt><dd>${Rt(t.kind)}</dd>
        <dt>${s("fNight")}</dt><dd>${a?s("fNightOff"):this.night===null||this.night===void 0?"-":r`<span class="num ${e==="leak"?"bad":""}">${Ct(this.night)}</span> ${s("lph")}`}</dd>
        <dt>${s("fRules")}</dt><dd>${i?s("fRulesOwn",{w:n}):s("fRulesDefault",{w:n})}</dd>
      </dl>
      <div class="row"><h3 class="sec">${s("usage")}</h3><span class="sp"></span>
        <div class="seg" role="group" aria-label=${s("range")}>${["hours","days","months"].map(o=>r`<button type="button" aria-pressed=${this.range===o?"true":"false"} data-range=${o} @click=${()=>{this.range=o,this.loadSeries()}}>${s(be[o])}</button>`)}</div></div>
      ${this.chartError?r`<div class="alert err" role="alert">${s("chartError")}</div>`:je(this.bars,s("chartAria",{r:s(be[this.range])}),this.range==="hours"?o=>String(Math.round(o)):o=>o.toFixed(o<10?2:1))}
      ${this.range==="hours"?r`<div class="mut">${s("nightNote",{w:n})}</div>`:c}
      ${this.renderAlerts()}
      <h3 class="sec">${s("epochs")}</h3>
      <div class="list" data-epochs>${t.epochs.map(o=>r`<div class="li"><div class="grow"><div class="t1">${we[o.reason]?s(we[o.reason]):o.reason} · <span class="num">${J(o.started_at)}</span></div>
        <div class="t2 wrap">${s("epochStart")} <span class="num">${Q(o.start_reading_l)}</span>${o.ended_at?r` · ${s("epochUntil")} <span class="num">${J(o.ended_at)}</span>`:""}${o.note?` · ${o.note}`:""}</div></div>${o.ended_at?c:r`<span class="chip c-acc nodot">${s("epochActive")}</span>`}</div>`)}</div>
      ${this.renderReadings()}
      ${this.actionError&&!this.dlg?r`<div class="alert err" role="alert" data-meter-action-error>${this.actionError}</div>`:c}
      ${this.canManage?r`<div class="actions">
            <sw-button data-meter-rename @click=${()=>this.openDlg("rename")}>${s("rename")}</sw-button>
            <sw-button data-meter-replace @click=${()=>this.openDlg("replace")}>${s("replace")}</sw-button>
            <sw-button data-meter-pause ?disabled=${this.busy||t.status==="retired"} @click=${()=>void this.act(()=>w.patchMeter(t,{status:t.status==="paused"?"active":"paused"}),()=>void this.load())}>${t.status==="paused"?s("resume"):s("pause")}</sw-button>
            <span class="sp"></span>
            <sw-button variant="danger" data-meter-remove @click=${()=>this.openDlg("remove")}>${s("remove")}</sw-button>
          </div>`:c}
    </div>`}field(t,e,a,n,i={}){return r`<div class="fld ${i.wide?"wide":""}"><label for=${t}>${e}</label><div class="inp"><input id=${t} type=${i.type??"text"} inputmode=${i.type?"text":"decimal"} .value=${a} @input=${o=>n(o.target.value)} />${i.suffix?r`<span class="mut">${i.suffix}</span>`:c}</div></div>`}renderDialogs(){const t=this.actionError&&this.dlg?r`<div class="alert err wide" role="alert">${this.actionError}</div>`:c,e=(a,n=!1)=>r`<sw-button slot="footer" variant=${n?"danger":"primary"} data-dialog-save ?disabled=${this.busy} @click=${()=>this.save()}>${a}</sw-button><sw-button slot="footer" @click=${()=>this.dlg=""}>${s("cancel")}</sw-button>`;return r`
      <sw-dialog ?open=${this.dlg==="remove"} heading=${s("removeTitle")} data-meter-remove-dialog @close=${()=>this.dlg=""}>
        <div>${s("removeBody")}</div>${t}${e(s("remove"),!0)}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="rename"} heading=${s("renameTitle")} data-meter-rename-dialog @close=${()=>this.dlg=""}>
        <div class="form">${this.field("wrn",s("meterName"),this.f1,a=>this.f1=a,{type:"text",wide:!0})}
          <div class="fld wide"><label for="wkd">${s("meterKind")}</label><div class="inp"><select id="wkd" @change=${a=>this.kind=a.target.value}>${Ve.map(a=>r`<option value=${a} ?selected=${a===this.kind}>${Rt(a)}</option>`)}</select></div></div>${t}</div>
        ${e(s("save"))}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="replace"} heading=${s("replace")} data-meter-replace-dialog @close=${()=>this.dlg=""}>
        <div class="form">${this.field("wfr",s("replaceFinal"),this.f1,a=>this.f1=a,{suffix:s("m3")})}${this.field("wsr",s("replaceStart"),this.f2,a=>this.f2=a,{suffix:s("m3")})}
          ${this.field("wnt",s("replaceNote"),this.f3,a=>this.f3=a,{type:"text",wide:!0})}${t}</div>
        ${e(s("replace"))}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="reading"} heading=${s("manualReading")} data-meter-reading-dialog @close=${()=>this.dlg=""}>
        <div class="form">${this.field("wra",s("readingAt"),this.f1,a=>this.f1=a,{type:"datetime-local",wide:!0})}
          ${this.field("wrv",s("readingValue"),this.f2,a=>this.f2=a)}
          <div class="fld"><label for="wru">${s("fUnit")}</label><div class="inp"><select id="wru" @change=${a=>this.unit=a.target.value}><option value="m3" ?selected=${this.unit==="m3"}>${s("m3")}</option><option value="L" ?selected=${this.unit==="L"}>${s("litre")}</option></select></div></div>
          ${this.field("wrn2",s("readingNote"),this.f3,a=>this.f3=a,{type:"text",wide:!0})}${t}</div>
        ${e(s("save"))}
      </sw-dialog>`}render(){const t=this.detail,e=t?[Rt(t.kind),t.area_name,t.floor_name].filter(Boolean).join(" · "):"";return r`
      <sw-drawer ?open=${!this.dlg} modal heading=${t?.display_name??""} subheading=${e} data-meter-drawer @close=${()=>{this.dlg||this.fire("close")}}>
        ${this.phase==="loading"?r`<sw-state-panel state="loading" compact></sw-state-panel>`:c}
        ${this.phase==="error"?r`<sw-state-panel state="error" compact heading=${s("cardLoadError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.load()}></sw-state-panel>`:c}
        ${this.phase==="ready"&&t?this.renderBody(t):c}
      </sw-drawer>
      ${this.renderDialogs()}`}};y.styles=[nt,zt`
      :host {
        display: contents;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 4px 0 8px;
      }
      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      .form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .form .wide {
        grid-column: 1 / -1;
      }
      @media (max-width: 520px) {
        .form {
          grid-template-columns: 1fr;
        }
      }
    `];S([C()],y.prototype,"meterId",2);S([C({type:Boolean})],y.prototype,"canManage",2);S([C({type:Boolean})],y.prototype,"canAck",2);S([C({attribute:!1})],y.prototype,"rules",2);S([C({attribute:!1})],y.prototype,"snooze",2);S([C({attribute:!1})],y.prototype,"night",2);S([d()],y.prototype,"detail",2);S([d()],y.prototype,"phase",2);S([d()],y.prototype,"error",2);S([d()],y.prototype,"range",2);S([d()],y.prototype,"bars",2);S([d()],y.prototype,"chartError",2);S([d()],y.prototype,"alerts",2);S([d()],y.prototype,"readings",2);S([d()],y.prototype,"dlg",2);S([d()],y.prototype,"busy",2);S([d()],y.prototype,"actionError",2);S([d()],y.prototype,"notice",2);S([d()],y.prototype,"f1",2);S([d()],y.prototype,"f2",2);S([d()],y.prototype,"f3",2);S([d()],y.prototype,"unit",2);S([d()],y.prototype,"kind",2);y=S([Z("water-meter-card")],y);var Rs=Object.defineProperty,Os=Object.getOwnPropertyDescriptor,H=(t,e,a,n)=>{for(var i=n>1?void 0:n?Os(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Rs(e,a,i),i};const Ls=6e4,Et=t=>String(t).padStart(2,"0"),pt=t=>{if(!t)return"-";const e=new Date(t);return`${Et(e.getDate())}.${Et(e.getMonth()+1)} ${Et(e.getHours())}:${Et(e.getMinutes())}`},Is=t=>/^[=+\-@\t\r]/.test(t)?`'${t}`:t,Bs=t=>`"${Is(t).replace(/"/g,'""')}"`;let U=class extends X{constructor(){super(...arguments),this.bubbleSkin=new tt(this),this.segments=[],this.params=new URLSearchParams,this.items=[],this.summary=null,this.rules=vt,this.snooze=null,this.phase="loading",this.error="",this.actionError="",this.notice="",this.filter="open",this.busy=!1,this.access=it(),this.poll=0}connectedCallback(){super.connectedCallback(),this.stop=rt(t=>this.access=t),this.load(!0),this.poll=window.setInterval(()=>void this.load(!1),Ls),At().then(t=>{t&&(this.rules=t.rules,this.snooze=t.snooze)})}disconnectedCallback(){this.stop?.(),window.clearInterval(this.poll),super.disconnectedCallback()}async load(t){t&&(this.phase="loading");try{const e=await w.events("all");this.items=e.items,this.summary=e.summary,this.phase="ready"}catch(e){(t||this.phase!=="ready")&&(this.error=N(e),this.phase="error")}}flash(t){this.notice=t,window.setTimeout(()=>this.notice="",4e3)}async act(t,e){if(!this.busy){this.busy=!0,this.actionError="";try{await t(),this.flash(e),await this.load(!1)}catch(a){this.actionError=N(a)}finally{this.busy=!1}}}snoozeEv(t,e){this.act(()=>w.snooze(t.id,this.snooze?e:void 0),s("snoozedToast",{d:st(e),t:ae(new Date,e)}))}openMeter(t){if(t.closed_at)return;const e={};this.params.forEach((a,n)=>e[n]=a),b("/infra/water/alerts",{...e,meter:t.meter_id})}onKey(t,e){(t.key==="Enter"||t.key===" ")&&t.target===t.currentTarget&&(t.preventDefault(),this.openMeter(e))}closeMeter(){const t={};this.params.forEach((e,a)=>a!=="meter"&&(t[a]=e)),b("/infra/water/alerts",t)}exportCsv(t){const e=ie()==="he",a=[s("colMeter"),s("colArea"),s("colKind"),s("colSince"),e?"עד":"Until",s("colValue"),s("colState")],n=u=>u.closed_at?s("asClosed"):u.snoozed_until?s("snoozedUntil",{t:pt(u.snoozed_until)}):u.ack_at?s("asAcked",{who:u.ack_by_display??""}):s("asOpen"),i=[a,...t.map(u=>[u.meter_name,[u.area_name,u.floor_name].filter(Boolean).join(" · "),Ot(u.kind),pt(u.opened_at),u.closed_at?pt(u.closed_at):"",It(u),n(u)])],o=new Blob(["\uFEFF"+i.map(u=>u.map(Bs).join(",")).join(`\r
`)],{type:"text/csv;charset=utf-8"}),l=document.createElement("a");l.href=URL.createObjectURL(o),l.download=`water-alerts-${new Date().toISOString().slice(0,10)}.csv`,l.click(),window.setTimeout(()=>URL.revokeObjectURL(l.href),1e3),this.flash(s("csvDone"))}actions(t){return t.closed_at||!this.access.ack?c:r`<span class="acts">${t.can_ack?r`<button class="btn sm pri" type="button" data-ack ?disabled=${this.busy} @click=${e=>{e.stopPropagation(),this.act(()=>w.ack(t.id),s("acked"))}}>${s("ack")}</button>`:c}
      ${t.can_snooze?r`<water-snooze .settings=${this.snooze??{durations:[60],default:60,max:60}} ?disabled=${this.busy} @snooze=${e=>this.snoozeEv(t,e.detail.minutes)}></water-snooze>`:c}</span>`}render(){if(!this.access.view)return r`<sw-state-panel state="forbidden" data-water="alerts" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return r`<div data-water="alerts" data-state="loading" aria-busy="true"><div class="card">${Array.from({length:7},()=>r`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;if(this.phase==="error")return r`<div data-water="alerts" data-state="error"><sw-state-panel state="error" heading=${s("loadAlertsError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.load(!0)}></sw-state-panel></div>`;const t=Date.now()-7*864e5,e=this.items.filter(h=>h.closed_at&&Date.parse(h.closed_at)>=t).length,a=this.filter==="all"?this.items:this.items.filter(h=>!h.closed_at),n=this.summary,i=this.rules,o=this.params.get("meter")??"",l=r`<div class="row head">
      <div class="seg" role="group" aria-label=${s("filter")} data-alert-filter>
        <button type="button" aria-pressed=${this.filter==="open"?"true":"false"} data-f="open" @click=${()=>this.filter="open"}>${s("fOpen")}</button>
        <button type="button" aria-pressed=${this.filter==="all"?"true":"false"} data-f="all" @click=${()=>this.filter="all"}>${s("fAll")}</button></div>
      <span class="sp"></span>
      <button class="btn" type="button" data-csv ?disabled=${!a.length} @click=${()=>this.exportCsv(a)}><sw-icon name="download" size="15"></sw-icon>${s("csv")}</button>
      ${this.access.manage||this.access.configure?r`<button class="btn" type="button" data-leak-rules @click=${()=>b("/infra/water/settings",{set:"alerts"})}>${s("leakRules")}</button>`:c}
    </div>`,u=r`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tOpen")}</div><div class="v ${n?.open?"alarm":""}"><span class="num" data-t-open>${n?.open??0}</span></div></div>
      <div class="tile"><div class="k">${s("tClosedWeek")}</div><div class="v"><span class="num" data-t-closed>${e}</span></div></div>
      <div class="tile"><div class="k">${s("tSnoozed")}</div><div class="v"><span class="num" data-t-snz>${n?.snoozed??0}</span></div></div>
      <div class="tile"><div class="k">${s("tRule")}</div><div class="v"><span class="num nw">${i.night_from}-${i.night_to}</span><span class="u">${s("ruleValue",{lph:i.night_min_lph,dur:qe(i.night_min_intervals*15)})}</span></div></div>
    </div>`,f=a.length?r`<div class="card flush scrollx desk-only fitbox"><table class="t" data-alerts-table>
          <thead><tr><th>${s("colMeter")}</th><th>${s("colArea")}</th><th>${s("colKind")}</th><th>${s("colSince")}</th><th class="n">${s("colValue")}</th><th>${s("colState")}</th><th></th></tr></thead>
          <tbody>${a.map(h=>r`<tr class=${h.closed_at?"":"pick"} tabindex=${h.closed_at?-1:0} data-alert=${h.id} @click=${()=>this.openMeter(h)} @keydown=${p=>this.onKey(p,h)}>
            <td class="b">${h.meter_name}</td><td>${h.area_name??"-"}<span class="mut dsk">${h.floor_name?` · ${h.floor_name}`:""}</span></td><td>${Ot(h.kind)}</td>
            <td><span class="num">${pt(h.opened_at)}</span>${h.closed_at?r`<span class="mut"> - <span class="num">${pt(h.closed_at)}</span></span>`:c}</td>
            <td class="n">${It(h)}</td><td>${ge(h)}</td><td class="n">${this.actions(h)}</td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-alerts-rows>${a.map(h=>r`<div class="li ${h.closed_at?"dis":"pick"}" role=${h.closed_at?c:"button"} tabindex=${h.closed_at?c:0} data-alert=${h.id} @click=${()=>this.openMeter(h)} @keydown=${p=>this.onKey(p,h)}>
          <div class="grow"><div class="t1">${h.meter_name} · ${Ot(h.kind)}</div><div class="t2 wrap">${h.area_name??""} · ${s("colSince")} <span class="num">${pt(h.opened_at)}</span> · ${It(h)}</div></div>${ge(h)}${this.actions(h)}</div>`)}</div>`:r`<sw-state-panel icon="check" state="empty" heading=${s("emptyAlerts")} data-no-alerts></sw-state-panel>`;return r`<div class="page fit" data-water="alerts" data-state=${a.length?"ready":"empty"}>
      ${l}
      ${this.notice?r`<div class="notice" role="status" data-notice>${this.notice}</div>`:c}
      ${this.actionError?r`<div class="alert err" role="alert">${this.actionError}</div>`:c}
      ${u}${f}
      ${o?r`<water-meter-card .meterId=${o} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} @close=${()=>this.closeMeter()} @changed=${()=>void this.load(!1)}></water-meter-card>`:c}
    </div>`}};U.styles=[nt,at];H([C({attribute:!1})],U.prototype,"segments",2);H([C({attribute:!1})],U.prototype,"params",2);H([d()],U.prototype,"items",2);H([d()],U.prototype,"summary",2);H([d()],U.prototype,"rules",2);H([d()],U.prototype,"snooze",2);H([d()],U.prototype,"phase",2);H([d()],U.prototype,"error",2);H([d()],U.prototype,"actionError",2);H([d()],U.prototype,"notice",2);H([d()],U.prototype,"filter",2);H([d()],U.prototype,"busy",2);H([d()],U.prototype,"access",2);U=H([Z("water-alerts-page")],U);var Fs=Object.defineProperty,Us=Object.getOwnPropertyDescriptor,I=(t,e,a,n)=>{for(var i=n>1?void 0:n?Us(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Fs(e,a,i),i};const gt="/infra/water/bills",Vs=["draft","issued","sent","paid","void"],bt=t=>`${J(t.from)} - ${J(t.to)}`,ye=()=>{const t=new Date;return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`},Ws=t=>`"${(/^[=+\-@\t\r]/.test(t)?`'${t}`:t).replace(/"/g,'""')}"`,_e=(t=6)=>r`<div class="card" aria-busy="true">${Array.from({length:t},()=>r`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`,ke={email:"howEmail",hand:"howHand",other:"howOther"},Hs={recalculate:"aRecalc",issue:"aIssue",sent:"aSent",paid:"aPaid",correct:"aCorrect",void:"aVoid",delete:"aDelete"},xe={created:"evCreated",draft:"evCreated",recalculated:"evRecalculated",recalculate:"evRecalculated",issued:"evIssued",issue:"evIssued",auto_issue:"evIssued",auto_draft:"evCreated",sent:"evSent",paid:"evPaid",voided:"evVoided",void:"evVoided",corrected:"evCorrected",correct:"evCorrected",deleted:"evDeleted"};let M=class extends X{constructor(){super(...arguments),this.bubbleSkin=new tt(this),this.segments=[],this.params=new URLSearchParams,this.access=it(),this.st="loading",this.all=[],this.sums={open:"0.00",paid:"0.00"},this.filter="",this.q="",this.bill=null,this.billSt="loading",this.events=[],this.dlg="",this.reason="",this.how="email",this.ref="",this.busy=!1,this.error="",this.shown=null}connectedCallback(){super.connectedCallback(),this.stop=rt(t=>this.access=t)}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const e=this.segments[0]??"";e!==this.shown&&(this.shown=e,this.dlg="",this.error="",e?this.loadBill(e):this.loadList())}async loadList(){this.st="loading";try{const t=await v.listBills();this.all=t.items,this.sums=t.sums,this.st="ready"}catch{this.st="error"}}async loadBill(t){this.billSt="loading";try{this.bill=await v.bill(t),this.billSt="ready",this.loadEvents(t)}catch(e){this.error=N(e),this.billSt="error"}}async loadEvents(t){try{this.events=(await v.billEvents(t)).items}catch{this.events=[]}}open(t){this.dlg=t,this.error="",this.reason="",this.ref="",this.how="email"}async act(t){if(!(this.busy||!this.bill)){this.busy=!0,this.error="";try{const e=await t();if(this.dlg="",e){if(e.id!==this.bill.id){b(`${gt}/${e.id}`);return}this.bill=e,this.loadEvents(e.id)}}catch(e){this.error=N(e)}finally{this.busy=!1}}}exportCsv(t){const e=[s("colNumber"),s("colCustomer"),s("colAccount"),s("colPeriod"),s("colM3"),s("colTotal"),s("colDue"),s("colState")],a=t.map(o=>[o.number??"",o.customer.name??"",o.account_name,bt(o.period),o.m3??"",o.total??"",o.due_date??"",kt[o.state].label]),n=new Blob(["\uFEFF"+[e,...a].map(o=>o.map(Ws).join(",")).join(`\r
`)],{type:"text/csv;charset=utf-8"}),i=document.createElement("a");i.href=URL.createObjectURL(n),i.download=`water-bills-${ye()}.csv`,i.click(),window.setTimeout(()=>URL.revokeObjectURL(i.href),1e3)}renderList(){if(this.st==="loading")return r`<div class="page" data-water="bills" data-state="loading">${_e(7)}</div>`;if(this.st==="error")return r`<div class="page" data-water="bills" data-state="error"><sw-state-panel state="error" heading=${s("loadBillsError")} actionLabel=${s("retry")} @action=${()=>void this.loadList()}></sw-state-panel></div>`;if(!this.all.length)return r`<div class="page" data-water="bills" data-state="empty"><sw-state-panel icon="list" state="empty" heading=${s("emptyBills")}><button type="button" class="btn pri" @click=${()=>b("/infra/water/accounts")}>${s("toAccounts")}</button></sw-state-panel></div>`;const t=o=>this.all.filter(l=>l.state===o).length,e=this.q.trim(),a=this.all.filter(o=>(!this.filter||o.state===this.filter)&&(!e||(o.number??"").includes(e)||(o.customer.name??"").includes(e)||o.account_name.includes(e))),n=ye(),i=this.all.filter(o=>_s(o,n)).length;return r`<div class="page" data-water="bills" data-state=${a.length?"ready":"filtered-empty"}>
      <div class="row head">
        <div class="seg scroll-seg" role="group" aria-label=${s("stateFilter")} data-bill-filter>
          <button type="button" data-filter="" aria-pressed=${this.filter===""?"true":"false"} @click=${()=>this.filter=""}>${s("fAll")} <span class="num">${this.all.length}</span></button>
          ${Vs.map(o=>r`<button type="button" data-filter=${o} aria-pressed=${this.filter===o?"true":"false"} @click=${()=>this.filter=o}>${kt[o].label} <span class="num">${t(o)}</span></button>`)}</div>
        <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-bill-search placeholder=${s("billSearch")} aria-label=${s("billSearch")} .value=${this.q} @input=${o=>this.q=o.target.value} /></label>
        <span class="sp"></span>
        <button class="btn" type="button" data-csv ?disabled=${!a.length} @click=${()=>this.exportCsv(a)}><sw-icon name="download" size="15"></sw-icon>${s("csv")}</button>
      </div>
      <div class="tiles" data-tiles>
        <div class="tile"><div class="k">${s("tBillDrafts")}</div><div class="v"><span class="num" data-bt="draft">${t("draft")}</span></div></div>
        <div class="tile"><div class="k">${s("tOpenAmount")}</div><div class="v"><span class="num" data-bt="open">${A(this.sums.open).replace(" ₪","")}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${s("tPaid")}</div><div class="v"><span class="num" data-bt="paid">${A(this.sums.paid).replace(" ₪","")}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${s("tLate")}</div><div class="v ${i?"alarm":""}"><span class="num" data-bt="late">${i}</span></div></div>
      </div>
      ${a.length?re(a,!1):r`<sw-state-panel icon="search" state="empty" compact heading=${s("noBillsFound")}></sw-state-panel>`}
    </div>`}paper(t){const e=t.snapshot,a=bs(e.lines??[]),n=(o,l)=>r`<tr data-line=${o.component}><td>${l}${(e.lines??[]).filter(u=>u.component===o.component).length>1?r` <span class="mut num">${bt(o)}</span>`:c}</td>
      <td class="n"><span class="num">${k(o.m3)}</span> ${s("m3")}</td><td class="n"><span class="num">${A(o.unit_price_ex_vat)}</span></td><td class="n"><span class="num">${A(o.amount_ex_vat)}</span></td></tr>`,i=[...new Set((e.lines??[]).map(o=>o.vat_rate_percent))];return r`<div class="paper" data-bill-paper>
      <div class="row" style="align-items:flex-start"><div><b class="h3">${e.business?.name??""}</b>${e.business?.registration_no?r`<div class="mut num">${e.business.registration_no}</div>`:c}${e.business?.address?r`<div class="mut">${e.business.address}</div>`:c}</div>
        <span class="sp"></span><div style="text-align:end"><b>${e.doc?.title_he??s("billDraft")}</b>${e.doc?.subtitle_he?r`<div class="mut">${e.doc.subtitle_he}</div>`:c}<div class="num">${t.number??s("tBillDrafts")}</div></div></div>
      <dl class="kv">
        <dt>${s("colCustomer")}</dt><dd>${e.customer?.name??""} · <span class="num">${e.customer?.customer_number??""}</span>${e.customer?.address?` · ${e.customer.address}`:""}</dd>
        <dt>${s("colAccount")}</dt><dd>${e.account?.name??t.account_name}</dd>
        <dt>${s("pPeriod")}</dt><dd class="num">${bt(t.period)}</dd>
        <dt>${s("pFormula")}</dt><dd>${e.account?.formula?.sentence_he??""}</dd>
        ${t.issue_date?r`<dt>${s("pIssued")}</dt><dd class="num">${J(t.issue_date)}</dd>`:c}
        <dt>${s("pDue")}</dt><dd class="num">${J(t.due_date??e.bill?.expected_due_date??null)}</dd>
      </dl>
      <table><thead><tr><th>${s("pItem")}</th><th class="n">${s("pQty")}</th><th class="n">${s("pPrice")}</th><th class="n">${s("pAmount")}</th></tr></thead>
        <tbody>${a.water.map(o=>n(o,s("pWater")))}${a.sewage.map(o=>n(o,s("pSewage")))}</tbody>
        <tfoot>
          <tr><td colspan="3">${s("pSubtotal")}</td><td class="n"><span class="num" data-subtotal>${A(e.totals?.amount_ex_vat)}</span></td></tr>
          <tr><td colspan="3">${s("pVat",{p:i.join(" / ")})}</td><td class="n"><span class="num" data-vat>${A(e.totals?.vat_amount)}</span></td></tr>
          <tr class="tot"><td colspan="3">${s("pTotal")}</td><td class="n"><span class="num" data-total>${A(e.totals?.total)}</span></td></tr>
        </tfoot></table>
      ${(e.notes??[]).map(o=>r`<div class="mut">${o.text_he}</div>`)}
    </div>`}renderBill(){const t=this.segments[0],e=r`<a class="btn ghost sm" href=${`#${gt}`} data-back><sw-icon name="chevronBack" size="13"></sw-icon>${s("bills")}</a>`;if(this.billSt==="loading"&&this.bill?.id!==t)return r`<div class="page" data-water="bill" data-state="loading">${_e(5)}</div>`;if(this.billSt==="error"||!this.bill)return r`<div class="page" data-water="bill" data-state="error"><div class="backrow">${e}</div><sw-state-panel state="error" heading=${s("loadBillError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.loadBill(t)}></sw-state-panel></div>`;const a=this.bill,n=["issue","sent","paid","recalculate","correct","void","delete"],i=[...a.actions].sort((u,f)=>n.indexOf(u)-n.indexOf(f)),o=u=>{const f=u==="void"||u==="delete",h=u==="issue"||u==="paid",p=()=>u==="recalculate"?void this.act(()=>v.recalculate(a)):this.open(u);return r`<button type="button" class="btn ${h?"pri":""} ${f?"dng":""}" data-act=${u} ?disabled=${this.busy} @click=${p}>${s(Hs[u]??"aIssue")}</button>`},l=r`<div class="col">
      <div class="card"><div class="hd"><b>${s("details")}</b></div><dl class="kv" data-bill-details>
        <dt>${s("colAccount")}</dt><dd><a class="lnk" href=${`#/infra/water/accounts/${a.account_id}`}>${a.account_name}</a></dd><dt>${s("colCustomer")}</dt><dd>${a.customer.name??"-"}</dd>
        <dt>${s("pPeriod")}</dt><dd class="num">${bt(a.period)}</dd><dt>${s("colM3")}</dt><dd class="num">${k(a.m3)}</dd>
        ${a.sent?r`<dt>${s("sentOn")}</dt><dd><span class="num">${J(a.sent.at)}</span> · ${s(ke[a.sent.how]??"howOther")}</dd>`:c}
        ${a.paid?r`<dt>${s("paidOn")}</dt><dd><span class="num">${J(a.paid.at)}</span>${a.paid.reference?r` · <span class="num">${a.paid.reference}</span>`:c}</dd>`:c}
        <dt>${s("source")}</dt><dd>${a.origin==="auto"?s("originAuto"):s("originManual")}</dd></dl></div>
      <div class="card"><div class="hd"><b>${s("log")}</b></div><div class="list" data-bill-log>${this.events.map(u=>r`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${Gt(u.at)}</span><span>${xe[u.action]?s(xe[u.action]):u.action}${u.actor.display_name?` · ${u.actor.display_name}`:""}</span></div>`)}</div></div>
    </div>`;return r`<div class="page" data-water="bill" data-state="ready" data-bill-state=${a.state} data-bill-id=${a.id}>
      <div class="backrow">${e}<b class="h3 num" data-bill-number>${a.number?s("billNo",{no:a.number}):s("billDraft")}</b>${Ft(a)}
        ${a.replaces_bill_id&&a.snapshot.bill?.replaces?r`<span class="mut">${s("replaces",{no:""})}<a class="lnk num" href=${`#${gt}/${a.replaces_bill_id}`}>${a.snapshot.bill.replaces.number??""}</a></span>`:c}
        ${a.replaced_by_bill_id?r`<a class="lnk mut" href=${`#${gt}/${a.replaced_by_bill_id}`}>${s("replacedBy")}</a>`:c}
        <span class="sp"></span>${i.map(o)}
        <button type="button" class="btn" disabled title=${s("pdfLater")} aria-describedby="wpdf" data-pdf><sw-icon name="download" size="15"></sw-icon>${s("pdf")}</button></div>
      <div class="mut" id="wpdf" data-pdf-reason>${s("pdfLater")}</div>
      ${a.state==="void"&&a.void?r`<div class="alert err" role="alert"><span class="x" aria-hidden="true">!</span><div><b>${kt.void.label}:</b> ${a.void.reason}</div></div>`:c}
      ${this.error&&!this.dlg?r`<div class="alert err" role="alert">${this.error}</div>`:c}
      <div class="cols side"><div style="min-inline-size:0">${this.paper(a)}</div>${l}</div>
      ${this.dialogs(a)}
    </div>`}dialogs(t){const e=this.error&&this.dlg?r`<div class="alert err" role="alert">${this.error}</div>`:c,a=r`<button slot="actions" type="button" class="btn" @click=${()=>this.dlg=""}>${s("cancel")}</button>`,n=!this.reason.trim();return r`
      <elec-dialog heading=${s("dIssueTitle")} ?open=${this.dlg==="issue"} data-dialog="issue" @close=${()=>this.dlg=""}>
        <div>${s("dIssueBody")}</div><dl class="kv"><dt>${s("colAccount")}</dt><dd>${t.account_name}</dd><dt>${s("pPeriod")}</dt><dd class="num">${bt(t.period)}</dd><dt>${s("pTotal")}</dt><dd class="num">${A(t.total)}</dd></dl>${e}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.issue(t))}>${s("aIssue")}</button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dVoidTitle")} ?open=${this.dlg==="void"} data-dialog="void" @close=${()=>this.dlg=""}>
        <div>${s("dVoidBody")}</div>
        <div class="fld"><label for="wvr">${s("dVoidReason")}</label><textarea id="wvr" data-reason aria-required="true" .value=${this.reason} @input=${i=>this.reason=i.target.value}></textarea></div>${e}
        <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy||n} @click=${()=>void this.act(()=>v.void(t,this.reason.trim()))}>${s("aVoid")}</button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dCorrectTitle")} ?open=${this.dlg==="correct"} data-dialog="correct" @close=${()=>this.dlg=""}>
        <div>${s("dCorrectBody")}</div>${e}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.correct(t))}>${s("dCorrectGo")}</button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dSentTitle")} ?open=${this.dlg==="sent"} data-dialog="sent" @close=${()=>this.dlg=""}>
        <div class="fld"><span class="lbl">${s("dSentHow")}</span><div class="seg" role="group" aria-label=${s("dSentHow")}>${["email","hand","other"].map(i=>r`<button type="button" data-how=${i} aria-pressed=${this.how===i?"true":"false"} @click=${()=>this.how=i}>${s(ke[i])}</button>`)}</div></div>${e}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.markSent(t,this.how))}>${s("save")}</button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dPaidTitle")} ?open=${this.dlg==="paid"} data-dialog="paid" @close=${()=>this.dlg=""}>
        <div class="fld"><label for="wpr">${s("dPaidRef")}</label><input id="wpr" class="ltr" data-reference placeholder=${s("optional")} .value=${this.ref} @input=${i=>this.ref=i.target.value} /></div>${e}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.markPaid(t,this.ref.trim()))}>${s("save")}</button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dDeleteTitle")} ?open=${this.dlg==="delete"} data-dialog="delete" @close=${()=>this.dlg=""}>
        <div>${s("dDeleteBody")}</div>${e}
        <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{await v.deleteDraft(t),b(gt)})}>${s("aDelete")}</button>${a}
      </elec-dialog>`}render(){return this.access.bills?this.segments[0]?this.renderBill():this.renderList():r`<sw-state-panel state="forbidden" data-water="bills" data-state="forbidden"></sw-state-panel>`}};M.styles=[nt,at];I([C({attribute:!1})],M.prototype,"segments",2);I([C({attribute:!1})],M.prototype,"params",2);I([d()],M.prototype,"access",2);I([d()],M.prototype,"st",2);I([d()],M.prototype,"all",2);I([d()],M.prototype,"sums",2);I([d()],M.prototype,"filter",2);I([d()],M.prototype,"q",2);I([d()],M.prototype,"bill",2);I([d()],M.prototype,"billSt",2);I([d()],M.prototype,"events",2);I([d()],M.prototype,"dlg",2);I([d()],M.prototype,"reason",2);I([d()],M.prototype,"how",2);I([d()],M.prototype,"ref",2);I([d()],M.prototype,"busy",2);I([d()],M.prototype,"error",2);M=I([Z("water-bills-page")],M);var js=Object.defineProperty,qs=Object.getOwnPropertyDescriptor,j=(t,e,a,n)=>{for(var i=n>1?void 0:n?qs(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&js(e,a,i),i};const dt="/infra/water/customers",Ks=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,Se=(t="")=>({name:"",customer_number:t,tax_id:"",address:"",phone:"",email:"",notes:""}),Ae=(t=6)=>r`<div class="card" aria-busy="true">${Array.from({length:t},()=>r`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`;let V=class extends X{constructor(){super(...arguments),this.bubbleSkin=new tt(this),this.segments=[],this.params=new URLSearchParams,this.access=it(),this.st="loading",this.list=[],this.q="",this.card=null,this.cardSt="loading",this.form=Se(),this.errs={},this.busy=!1,this.error="",this.confirmDel=!1,this.shown=null}connectedCallback(){super.connectedCallback(),this.stop=rt(t=>this.access=t),this.access.bills&&this.loadList()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const e=this.segments[0]??"";e!==this.shown&&(this.shown=e,this.error="",this.errs={},this.confirmDel=!1,e?e==="new"?(this.card=null,this.cardSt="ready",this.form=Se(),v.nextCustomerNumber().then(a=>this.form={...this.form,customer_number:a.customer_number}).catch(()=>{})):this.loadCard(e):this.card=null)}async loadList(){this.st="loading";try{this.list=(await v.listCustomers()).items,this.st="ready"}catch{this.st="error"}}async loadCard(t){this.cardSt="loading";try{const e=await v.customer(t);this.card=e,this.form={name:e.name,customer_number:e.customer_number,tax_id:e.tax_id??"",address:e.address??"",phone:e.phone??"",email:e.email??"",notes:e.notes??""},this.cardSt="ready"}catch{this.cardSt="error"}}validate(){const t={};return this.form.name.trim()||(t.name=s("errName")),this.form.email&&!Ks.test(this.form.email)&&(t.email=s("errEmail")),this.form.customer_number&&!/^\d{1,9}$/.test(this.form.customer_number)&&(t.customer_number=s("errCustNo")),this.errs=t,!Object.keys(t).length}async save(){if(!(this.busy||!this.validate())){this.busy=!0,this.error="";try{const t={...this.form,name:this.form.name.trim()};if(this.card){const e={...t};t.customer_number===this.card.customer_number&&delete e.customer_number,this.card=await v.updateCustomer(this.card.id,{...e,base_revision:this.card.revision}),await this.loadList()}else{const e=await v.createCustomer({...t,customer_number:t.customer_number||void 0});await this.loadList(),b(`${dt}/${e.id}`)}}catch(t){const e=t instanceof mt?t.body.details?.fields:void 0;e?.length?this.errs=Object.fromEntries(e.map(a=>[a,N(t)])):this.error=N(t)}finally{this.busy=!1}}}async removeRecord(){if(!(!this.card||this.busy)){this.busy=!0;try{await v.deleteCustomer(this.card.id,this.card.revision),this.confirmDel=!1,await this.loadList(),b(dt)}catch(t){this.confirmDel=!1,this.error=t instanceof mt&&t.status===409?N(t)||s("cDeleteRefused"):N(t)}finally{this.busy=!1}}}field(t,e,a={}){const n=this.errs[t],i=!this.access.manage,o=l=>{this.form={...this.form,[t]:l},this.errs[t]&&(this.errs={...this.errs,[t]:""})};return r`<div class="fld ${a.wide?"wide":""}"><label for="wc-${t}">${s(e)}</label>
      ${a.area?r`<textarea id="wc-${t}" name=${t} ?readonly=${i} .value=${this.form[t]} @input=${l=>o(l.target.value)}></textarea>`:r`<input id="wc-${t}" name=${t} class="${a.ltr?"ltr":""} ${n?"err":""}" aria-invalid=${n?"true":"false"} ?readonly=${i} .value=${this.form[t]} @input=${l=>o(l.target.value)} />`}
      ${n?r`<div class="msg" role="alert" data-field-error=${t}>${n}</div>`:c}</div>`}renderCard(){const t=this.card,e=!!t&&(t.account_count>0||t.energy_account_count>0);return r`<sw-sheet open wide .heading=${s(t?"customerCard":"newCustomer")} data-customer-card @close=${()=>b(dt)}>
      <div class="col">
        ${this.cardSt==="loading"?Ae(4):this.cardSt==="error"?r`<sw-state-panel state="error" compact heading=${s("loadCustomerError")} actionLabel=${s("retry")} @action=${()=>void this.loadCard(this.segments[0])}></sw-state-panel>`:r`
          <div class="form">${this.field("name","cName",{wide:!0})}${this.field("customer_number","cNumber",{ltr:!0})}${this.field("tax_id","cTaxId",{ltr:!0})}
            ${this.field("address","cAddress",{wide:!0})}${this.field("phone","cPhone",{ltr:!0})}${this.field("email","cEmail",{ltr:!0})}${this.field("notes","cNotes",{wide:!0,area:!0})}</div>
          <div class="mut">${s("cShared")}</div>
          ${t?r`<b class="h3">${s("accounts")}</b>
            <div class="list" data-customer-accounts>${(t.accounts??[]).map(a=>r`<a class="li" href=${`#/infra/water/accounts/${a.id}`}><div class="grow"><div class="t1">${a.name}</div></div>${a.status==="paused"?r`<span class="chip c-mut">${s("accPaused")}</span>`:c}</a>`)}${t.accounts?.length?c:r`<div class="mut">${s("cNoAccounts")}</div>`}</div>
            ${t.bills?.length?r`<b class="h3">${s("cRecentBills")}</b>${re(t.bills.slice(0,4),!0)}`:c}`:c}
          ${this.error?r`<div class="alert err" role="alert" data-customer-error>${this.error}</div>`:c}
          ${this.access.manage?r`<div class="row formacts"><button type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("save")}</button><span class="sp"></span>
            ${t?r`<button type="button" class="btn dng" data-delete title=${e?s("cDeleteRefused"):""} @click=${()=>{e?this.error=s("cDeleteRefused"):this.confirmDel=!0}}>${s("cDelete")}</button>`:c}</div>`:c}`}
        <elec-dialog heading=${s("cDelete")} ?open=${this.confirmDel} data-dialog="delete-customer" @close=${()=>this.confirmDel=!1}>
          <div>${s("cDeleteBody")}</div>
          <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeRecord()}>${s("cDelete")}</button>
          <button slot="actions" type="button" class="btn" @click=${()=>this.confirmDel=!1}>${s("cancel")}</button>
        </elec-dialog>
      </div>
    </sw-sheet>`}render(){if(!this.access.bills)return r`<sw-state-panel state="forbidden" data-water="customers" data-state="forbidden"></sw-state-panel>`;const t=this.q.trim(),e=this.list.filter(i=>!t||i.name.includes(t)||i.customer_number.includes(t)||(i.address??"").includes(t)),a=r`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-cust-search placeholder=${s("custSearch")} aria-label=${s("custSearch")} .value=${this.q} @input=${i=>this.q=i.target.value} /></label>
      <span class="sp"></span>
      ${this.access.manage?r`<button type="button" class="btn pri" data-new-customer @click=${()=>b(`${dt}/new`)}><sw-icon name="plus" size="15"></sw-icon>${s("newCustomer")}</button>`:c}
    </div>`;let n;return this.st==="loading"?n=Ae(5):this.st==="error"?n=r`<sw-state-panel state="error" heading=${s("loadCustomersError")} actionLabel=${s("retry")} @action=${()=>void this.loadList()}></sw-state-panel>`:this.list.length?e.length?n=r`<div class="card flush scrollx desk-only"><table class="t" data-cust-table>
          <thead><tr><th>${s("colCustNo")}</th><th>${s("colName")}</th><th>${s("colAddress")}</th><th>${s("colPhone")}</th><th>${s("colEmail")}</th><th class="n">${s("colAccounts")}</th><th class="n">${s("colBalance")}</th></tr></thead>
          <tbody>${e.map(i=>r`<tr class="go" data-customer-row=${i.id} @click=${()=>b(`${dt}/${i.id}`)}>
            <td class="num" style="text-align:start">${i.customer_number}</td><td class="b"><a class="rowlink" href=${`#${dt}/${i.id}`} @click=${o=>o.stopPropagation()}>${i.name}</a></td>
            <td>${i.address??""}</td><td class="num" style="text-align:start">${i.phone??""}</td><td class="num" style="text-align:start">${i.email??""}</td>
            <td class="n"><span class="num">${i.account_count}</span></td><td class="n"><span class="num">${i.open_balance!==void 0?A(i.open_balance):""}</span></td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-cust-rows>${e.map(i=>r`<a class="li" href=${`#${dt}/${i.id}`} data-customer-row=${i.id}>
          <div class="grow"><div class="t1">${i.name} · <span class="num">${i.customer_number}</span></div><div class="t2">${i.address??""}${i.phone?r` · <span class="num">${i.phone}</span>`:c}</div></div>
          <div class="rowend"><div class="t2 num">${i.open_balance!==void 0?A(i.open_balance):""}</div></div></a>`)}</div>`:n=r`<sw-state-panel icon="search" state="empty" compact heading=${s("noCustomers")}></sw-state-panel>`:n=r`<sw-state-panel icon="users" state="empty" heading=${s("emptyCustomers")}></sw-state-panel>`,r`<div class="page" data-water="customers" data-state=${this.st}>${a}${n}${this.segments[0]?this.renderCard():c}</div>`}};V.styles=[nt,at];j([C({attribute:!1})],V.prototype,"segments",2);j([C({attribute:!1})],V.prototype,"params",2);j([d()],V.prototype,"access",2);j([d()],V.prototype,"st",2);j([d()],V.prototype,"list",2);j([d()],V.prototype,"q",2);j([d()],V.prototype,"card",2);j([d()],V.prototype,"cardSt",2);j([d()],V.prototype,"form",2);j([d()],V.prototype,"errs",2);j([d()],V.prototype,"busy",2);j([d()],V.prototype,"error",2);j([d()],V.prototype,"confirmDel",2);V=j([Z("water-customers-page")],V);var Ys=Object.defineProperty,Gs=Object.getOwnPropertyDescriptor,z=(t,e,a,n)=>{for(var i=n>1?void 0:n?Gs(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ys(e,a,i),i};const Ce="sw.water.meters.view",ze="sw.water.meters.collapsed",Js=6e4;let _=class extends X{constructor(){super(...arguments),this.bubbleSkin=new tt(this),this.segments=[],this.params=new URLSearchParams,this.meters=[],this.open=[],this.night={},this.rules=vt,this.snooze=null,this.phase="loading",this.error="",this.q="",this.view=te(Ce,"table"),this.collapsed=te(ze,[]),this.access=it(),this.notice="",this.cq="",this.cands=[],this.candPhase="idle",this.picked=null,this.newName="",this.newKind="sub",this.adding=!1,this.addError="",this.poll=0,this.candTimer=0}connectedCallback(){super.connectedCallback(),this.stop=rt(t=>this.access=t),this.load(!0),this.poll=window.setInterval(()=>void this.load(!1),Js)}disconnectedCallback(){this.stop?.(),window.clearInterval(this.poll),window.clearTimeout(this.candTimer),super.disconnectedCallback()}willUpdate(t){t.has("params")&&this.params.get("add")==="1"&&this.candPhase==="idle"&&this.access.manage&&this.searchCands()}async load(t){t&&(this.phase="loading");try{const[e,a]=await Promise.all([w.listMeters(),w.events("open").catch(()=>null)]);if(this.meters=e,a&&(this.open=a.items),this.phase="ready",this.error="",t){const n=await At();n&&(this.rules=n.rules,this.snooze=n.snooze),this.night=await Be(e,this.rules)}}catch(e){(t||this.phase!=="ready")&&(this.error=N(e),this.phase="error")}}get areaFilter(){return this.params.get("area")??""}setParams(t){const e=new URLSearchParams(this.params);for(const[n,i]of Object.entries(t))i?e.set(n,i):e.delete(n);const a={};e.forEach((n,i)=>a[i]=n),b("/infra/water/meters",a)}setView(t){this.view=t,ee(Ce,t)}toggleFloor(t){this.collapsed=this.collapsed.includes(t)?this.collapsed.filter(e=>e!==t):[...this.collapsed,t],ee(ze,this.collapsed)}visible(){const t=this.q.trim().toLowerCase(),e=this.areaFilter;return this.meters.filter(a=>(!e||Fe(a)===e)&&(!t||`${a.display_name} ${a.device_name??""} ${a.area_name??""}`.toLowerCase().includes(t)))}openMeter(t){this.setParams({meter:t.id,add:null})}onKey(t,e){(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.openMeter(e))}chip(t){return He(t,xt(t.id,this.open))}renderTiles(){const t=this.meters.filter(i=>i.status!=="retired"),e=i=>t.some(o=>o[i]!=null)?t.reduce((o,l)=>o+(l[i]??0),0)/1e3:null,a=t.filter(i=>i.state==="reporting").length,n=t.filter(i=>xt(i.id,this.open)==="leak").length;return r`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tToday")}</div><div class="v"><span class="num" data-t="today">${k(e("today_l"))}</span><span class="u">${s("m3")}</span></div></div>
      <div class="tile"><div class="k">${s("tMonth")}</div><div class="v"><span class="num" data-t="month">${k(e("month_l"))}</span><span class="u">${s("m3")}</span></div></div>
      <div class="tile"><div class="k">${s("tReporting")}</div><div class="v"><span class="num" data-t="reporting">${a}</span><span class="u">${s("tOf",{n:t.length})}</span></div></div>
      <div class="tile"><div class="k">${s("tLeak")}</div><div class="v ${n?"alarm":""}" data-t-leak><span class="num" data-t="leaks">${n}</span><span class="u">${s("tMeters")}</span></div></div>
    </div>`}renderTree(){const t=he(this.meters),e=this.areaFilter;return r`<nav class="tree" aria-label=${s("areas")} data-area-tree>
      <button type="button" aria-current=${e?"false":"true"} data-area="" @click=${()=>this.setParams({area:null})}>${s("allAreas")} <span class="cnt num">${this.meters.length}</span></button>
      ${t.map(a=>{const n=this.collapsed.includes(a.floor_id);return r`<button type="button" class="fl" aria-expanded=${n?"false":"true"} data-floor=${a.floor_id} @click=${()=>this.toggleFloor(a.floor_id)}>
            <sw-icon name=${n?"chevronBack":"chevronDown"} size="14"></sw-icon>${a.name}<span class="cnt num">${a.count}</span></button>
          ${n?c:a.areas.map(i=>r`<button type="button" class="ar" aria-current=${e===i.area_id?"true":"false"} data-area=${i.area_id} @click=${()=>this.setParams({area:i.area_id})}>${i.name}<span class="cnt num">${i.count}</span></button>`)}`})}
    </nav>`}renderTable(t){return r`<div class="card flush scrollx desk-only"><table class="t" data-meters-table>
      <thead><tr><th>${s("colName")}</th><th>${s("colArea")}</th><th class="n">${s("colReading")}</th><th class="n">${s("colToday")}</th><th class="n dsk">${s("colMonth")}</th><th class="n">${s("colNight")}</th><th>${s("colState")}</th></tr></thead>
      <tbody>${t.map(e=>r`<tr class="pick" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
        <td class="b">${e.display_name}</td><td>${e.area_name??"-"}<span class="mut dsk">${e.floor_name?` · ${e.floor_name}`:""}</span></td>
        <td class="n"><span class="num">${Q(e.value_l)}</span></td><td class="n"><span class="num">${Q(e.today_l)}</span></td><td class="n dsk"><span class="num">${Q(e.month_l)}</span></td>
        <td class="n"><span class="num ${xt(e.id,this.open)==="leak"?"bad":""}">${Ct(this.night[e.id])}</span></td>
        <td>${this.chip(e)}</td></tr>`)}</tbody></table></div>`}renderCards(t){return r`<div class="cards desk-only" data-meters-cards>${t.map(e=>r`<div class="card mcard" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="row"><b>${e.display_name}</b><span class="sp"></span>${this.chip(e)}</div>
      <div class="mut">${e.area_name??""}${e.floor_name?` · ${e.floor_name}`:""}</div>
      <div class="row base"><span class="big num">${Q(e.today_l)}</span><span class="mut">${s("todayM3")}</span><span class="sp"></span><span class="mut num">${Q(e.value_l)}</span></div>
      <div class="mut">${s("colNight")} <span class="num">${Ct(this.night[e.id])}</span>${typeof this.night[e.id]=="number"?` ${s("lph")}`:""}</div></div>`)}</div>`}renderRows(t){return r`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${t.map(e=>r`<div class="li pick" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="grow"><div class="t1">${e.display_name}</div><div class="t2">${e.area_name??""} · ${s("tToday")} <span class="num">${Q(e.today_l)}</span> ${s("m3")}</div></div>
      <div class="rowend">${this.chip(e)}<div class="t2 num">${Q(e.value_l)}</div></div></div>`)}</div>`}openAdd(){this.picked=null,this.newName="",this.newKind="sub",this.addError="",this.cq="",this.setParams({add:"1",meter:null}),this.searchCands()}async searchCands(){this.candPhase="loading";try{this.cands=await w.candidates(this.cq.trim()),this.candPhase="ready"}catch{this.candPhase="error"}}onCq(t){this.cq=t,window.clearTimeout(this.candTimer),this.candTimer=window.setTimeout(()=>void this.searchCands(),300)}pick(t){t.verdict==="rejected"||t.already_meter_id||(this.picked=t,this.newName=t.device_name||t.name)}async confirmAdd(){const t=this.picked;if(!(!t||this.adding)){if(!this.newName.trim())return void(this.addError=s("nameRequired"));this.adding=!0,this.addError="";try{await w.createMeter({source_ref:t.ref,display_name:this.newName.trim(),kind:this.newKind}),this.setParams({add:null}),this.notice=s("added"),window.setTimeout(()=>this.notice="",5e3),await this.load(!1)}catch(e){this.addError=N(e)}finally{this.adding=!1}}}renderAdd(){return this.params.get("add")==="1"&&this.access.manage?r`<sw-dialog open wide heading=${s("addTitle")} data-add-dialog @close=${()=>this.setParams({add:null})}>
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-cand-search placeholder=${s("candSearch")} aria-label=${s("candSearch")} .value=${this.cq} @input=${e=>this.onCq(e.target.value)} /></label>
      <div class="cand list" data-candidates>
        ${this.candPhase==="loading"?r`<sw-state-panel state="loading" compact></sw-state-panel>`:c}
        ${this.candPhase==="error"?r`<sw-state-panel state="error" compact actionLabel=${s("retry")} @action=${()=>void this.searchCands()}></sw-state-panel>`:c}
        ${this.candPhase==="ready"&&!this.cands.length?r`<sw-state-panel icon="drop" state="empty" compact heading=${s("candNone")}></sw-state-panel>`:c}
        ${this.candPhase==="ready"?this.cands.map(e=>{const a=e.verdict==="rejected"||!!e.already_meter_id;return r`<div class="li ${a?"dis":"pick"}" role="button" tabindex=${a?-1:0} aria-disabled=${a?"true":"false"} aria-pressed=${this.picked?.ref===e.ref?"true":"false"} data-cand=${e.ref}
                @click=${()=>this.pick(e)} @keydown=${n=>{(n.key==="Enter"||n.key===" ")&&(n.preventDefault(),this.pick(e))}}>
                <div class="grow"><div class="t1">${e.device_name||e.name}</div><div class="t2 wrap">${[e.area_name,e.unit].filter(Boolean).join(" · ")}${e.verdict!=="accepted"&&e.message?r` · <span class=${e.verdict==="rejected"?"bad":""}>${e.message}</span>`:c}</div></div>
                ${a?r`<span class="chip c-mut nodot">${s("candRejected")}</span>`:c}</div>`}):c}
      </div>
      ${this.picked?r`<div class="formgrid">
            <div class="fld"><label for="wnm">${s("meterName")}</label><div class="inp"><input id="wnm" data-add-name .value=${this.newName} @input=${e=>this.newName=e.target.value} /></div></div>
            <div class="fld"><label for="wnk">${s("meterKind")}</label><div class="inp"><select id="wnk" data-add-kind @change=${e=>this.newKind=e.target.value}>${Ve.map(e=>r`<option value=${e} ?selected=${e===this.newKind}>${Rt(e)}</option>`)}</select></div></div>
          </div>`:c}
      ${this.addError?r`<div class="alert err" role="alert" data-add-error>${this.addError}</div>`:c}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked||this.adding} @click=${()=>void this.confirmAdd()}>${s("add")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.setParams({add:null})}>${s("cancel")}</sw-button>
    </sw-dialog>`:c}renderHead(){const t=he(this.meters);return r`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-meters-search placeholder=${s("search")} aria-label=${s("search")} .value=${this.q} @input=${e=>this.q=e.target.value} /></label>
      <div class="seg desk-only" role="group" aria-label=${s("view")}><button type="button" aria-pressed=${this.view==="cards"?"true":"false"} data-view="cards" @click=${()=>this.setView("cards")}>${s("cards")}</button><button type="button" aria-pressed=${this.view==="table"?"true":"false"} data-view="table" @click=${()=>this.setView("table")}>${s("table")}</button></div>
      <span class="sp"></span>
      <label class="inp phone-only"><select data-area-select aria-label=${s("area")} @change=${e=>this.setParams({area:e.target.value||null})}>
        <option value="" ?selected=${!this.areaFilter}>${s("allAreas")}</option>
        ${t.flatMap(e=>e.areas.map(a=>r`<option value=${a.area_id} ?selected=${a.area_id===this.areaFilter}>${a.name}</option>`))}</select></label>
      ${this.access.manage?r`<sw-button variant="primary" icon="plus" data-add-meter @click=${()=>this.openAdd()}>${s("addMeter")}</sw-button>`:c}
    </div>`}render(){if(!this.access.view)return r`<sw-state-panel state="forbidden" data-water="meters" data-state="forbidden"></sw-state-panel>`;const t=this.params.get("meter")??"",e=t?r`<water-meter-card .meterId=${t} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} .night=${this.night[t]}
          @close=${()=>this.setParams({meter:null})} @changed=${()=>void this.load(!1)}></water-meter-card>`:c;if(this.phase==="loading")return r`<div data-water="meters" data-state="loading" aria-busy="true"><div class="card">${Array.from({length:7},()=>r`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;if(this.phase==="error")return r`<div data-water="meters" data-state="error"><sw-state-panel state="error" heading=${s("loadMetersError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.load(!0)}></sw-state-panel></div>`;if(!this.meters.length)return r`<div data-water="meters" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${s("emptyMeters")}>${this.access.manage?r`<sw-button variant="primary" icon="plus" data-add-meter @click=${()=>this.openAdd()}>${s("addMeter")}</sw-button>`:c}</sw-state-panel>${this.renderAdd()}</div>`;const a=this.visible(),n=a.length?r`${this.view==="cards"?this.renderCards(a):this.renderTable(a)}${this.renderRows(a)}`:r`<sw-state-panel icon="drop" state="empty" compact heading=${s("noResults")} data-no-results></sw-state-panel>`;return r`<div class="page" data-water="meters" data-state="ready">
      ${this.renderHead()}
      ${this.notice?r`<div class="notice" role="status" data-notice>${this.notice}</div>`:c}
      ${this.renderTiles()}
      <div class="cols"><div class="card tree-card">${this.renderTree()}</div><div class="mlist">${n}</div></div>
      ${this.renderAdd()}${e}
    </div>`}};_.styles=[nt,zt`
      .cols {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 14px;
        align-items: start;
      }
      .tree {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tree button {
        display: flex;
        align-items: center;
        gap: 8px;
        inline-size: 100%;
        min-block-size: var(--elec-touch);
        padding: 0 10px;
        border: 0;
        background: transparent;
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        border-radius: var(--sw-r-sm);
        cursor: pointer;
        text-align: start;
        transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      @media (hover: hover) and (pointer: fine) {
        .tree button:hover {
          background: var(--sw-surface-2);
        }
      }
      .tree button:active {
        transform: scale(var(--sw-press-scale));
        background: var(--sw-surface-3);
      }
      .tree button:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: calc(var(--sw-focus-w) * -1);
      }
      /* WKWATER-POLISH-2331 (as R5-MEDIA-ENERGY-297 on the electricity meters): the chosen area is a filled accent field, its count on it */
      .tree button[aria-current='true'] {
        background: var(--sw-accent);
        color: var(--sw-text-inverse);
        font-weight: var(--sw-fw-bold);
        box-shadow: var(--sw-shadow-primary);
      }
      /* DARK-REVIEW-2342: the count at full ink - at opacity 0.85 it read 3.7-3.9:1 on the dark accent (classic, infra, soft) and ~4.0:1
         in light; the name beside it is bold, so the count stays the quieter of the two by weight alone */
      .tree button[aria-current='true'] .cnt {
        color: var(--sw-text-inverse);
      }
      .tree .fl {
        color: var(--sw-text-2);
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-xs);
      }
      .tree .ar {
        padding-inline-start: 30px;
      }
      .tree .cnt {
        margin-inline-start: auto;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
      }
      .tree sw-icon {
        flex: none;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 12px;
      }
      .mcard {
        display: flex;
        flex-direction: column;
        gap: 6px;
        text-align: start;
        font: inherit;
        color: inherit;
        cursor: pointer;
        min-block-size: var(--elec-touch);
      }
      /* WKWATER-POLISH-2331 (R5-MEDIA-ENERGY-297): today's m³ is the card's display numeral; the card answers the press */
      .mcard .big {
        font-size: var(--sw-fs-4xl);
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.05;
        font-variant-numeric: tabular-nums;
        color: var(--sw-heading, var(--sw-text));
      }
      .mcard {
        transition: transform var(--sw-t-press) var(--sw-ease-out), box-shadow var(--sw-t-fast) var(--sw-ease);
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .mcard:active {
        transform: scale(var(--sw-press-scale));
        box-shadow: var(--sw-shadow-1);
      }
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
      @media (max-width: 899px) {
        .cols {
          grid-template-columns: minmax(0, 1fr);
        }
        .tree-card {
          display: none;
        }
        .head .inp {
          flex: 1 1 200px;
        }
        .head .inp.phone-only {
          flex: 1 1 160px;
        }
      }
      /* WKWATER-POLISH-2331 (NOSCROLL-297, the electricity meters' rule; owner rule: a control screen fits the viewport on a desktop):
         the tree and the meters list take the height left under the head and the tiles; the table (its header row stays in place), the
         cards and the tree each scroll inside their own box, never the page. Below 240 px of room the row keeps that height. */
      @media (min-width: 900px) {
        [data-water='meters'][data-state='ready'] {
          flex: 1 1 auto;
          min-block-size: 0;
        }
        .cols {
          flex: 1 1 auto;
          min-block-size: 240px;
          grid-template-rows: minmax(0, 1fr);
        }
        .cols > .tree-card {
          max-block-size: 100%;
          box-sizing: border-box;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .cols > .mlist {
          display: flex;
          flex-direction: column;
          max-block-size: 100%;
          min-block-size: 0;
          min-inline-size: 0;
        }
        .mlist > .scrollx,
        .mlist > .cards {
          min-block-size: 0;
          overflow: auto;
          scrollbar-width: thin;
        }
        .mlist > .cards {
          padding: 2px;
          grid-auto-rows: max-content;
          align-content: start;
        }
        .mlist table.t thead th {
          position: sticky;
          inset-block-start: 0;
          z-index: 1;
        }
      }
    `,at];z([C({attribute:!1})],_.prototype,"segments",2);z([C({attribute:!1})],_.prototype,"params",2);z([d()],_.prototype,"meters",2);z([d()],_.prototype,"open",2);z([d()],_.prototype,"night",2);z([d()],_.prototype,"rules",2);z([d()],_.prototype,"snooze",2);z([d()],_.prototype,"phase",2);z([d()],_.prototype,"error",2);z([d()],_.prototype,"q",2);z([d()],_.prototype,"view",2);z([d()],_.prototype,"collapsed",2);z([d()],_.prototype,"access",2);z([d()],_.prototype,"notice",2);z([d()],_.prototype,"cq",2);z([d()],_.prototype,"cands",2);z([d()],_.prototype,"candPhase",2);z([d()],_.prototype,"picked",2);z([d()],_.prototype,"newName",2);z([d()],_.prototype,"newKind",2);z([d()],_.prototype,"adding",2);z([d()],_.prototype,"addError",2);_=z([Z("water-meters-page")],_);var Qs=Object.defineProperty,Xs=Object.getOwnPropertyDescriptor,B=(t,e,a,n)=>{for(var i=n>1?void 0:n?Xs(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Qs(e,a,i),i};const Zs=[1440,10080,43200],De=/^\d{1,6}(\.\d{1,4})?$/,Pe=(t=5)=>r`<div class="card" aria-busy="true">${Array.from({length:t},()=>r`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div></div>`)}</div>`;let E=class extends X{constructor(){super(...arguments),this.bubbleSkin=new tt(this),this.segments=[],this.params=new URLSearchParams,this.access=it(),this.tariffs=null,this.tariffsErr=!1,this.shared=null,this.cfg=null,this.cfgLoaded=!1,this.snooze=yt,this.addN="30",this.addU="min",this.snoozeErr="",this.notice="",this.vf=null,this.vErr="",this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.stop=rt(t=>this.access=t),this.loadPrices(),this.loadAlerts()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}get section(){const t=this.params.get("set");return t==="alerts"?"alerts":t==="prices"||this.access.manage||this.access.bills?"prices":"alerts"}async loadPrices(){if(!(!this.access.manage&&!this.access.bills))try{const[t,e]=await Promise.all([v.listTariffs(),v.sharedSettings().catch(()=>null)]);this.tariffs=t.items,this.shared=e,this.tariffsErr=!1}catch{this.tariffsErr=!0,this.tariffs=[]}}async loadAlerts(){const t=await At(!0);this.cfg=t,this.snooze=t?{...t.snooze,durations:[...t.snooze.durations]}:{...yt,durations:[...yt.durations]},this.cfgLoaded=!0}flash(t){this.notice=t,window.setTimeout(()=>this.notice="",4e3)}openVersion(t){const e=t?.current;this.vErr="",this.vf={tariffId:t?.id??null,name:"",from:new Date().toISOString().slice(0,10),water:e?.water_price??"",sewage:e?.sewage_price??"0",mode:e?.price_mode??this.shared?.default_price_mode??"ex_vat"}}async saveVersion(){const t=this.vf;if(!(!t||this.busy)){if(!t.tariffId&&!t.name.trim())return void(this.vErr=s("errName"));if(!/^\d{4}-\d{2}-\d{2}$/.test(t.from))return void(this.vErr=s("errDate"));if(!De.test(t.water.trim())||Number(t.water)<=0||!De.test(t.sewage.trim()||"0"))return void(this.vErr=s("errPrice"));this.busy=!0,this.vErr="";try{const e={effective_from:t.from,water_price:t.water.trim(),sewage_price:t.sewage.trim()||"0",price_mode:t.mode};t.tariffId?await v.addVersion(t.tariffId,e):await v.createTariff({name:t.name.trim(),...e}),this.vf=null,this.flash(s("saved")),await this.loadPrices()}catch(e){this.vErr=N(e)}finally{this.busy=!1}}}async deleteVersion(t,e){if(!this.busy){this.busy=!0,this.error="";try{await v.deleteVersion(t.id,e.id),await this.loadPrices()}catch(a){this.error=N(a)}finally{this.busy=!1}}}sharedLink(){const t=this.shared?.edit_link??"";return t.startsWith("#/system/")?t:Oe}renderPrices(){if(!this.access.manage&&!this.access.bills)return r`<sw-state-panel state="forbidden" compact></sw-state-panel>`;if(this.tariffs===null)return Pe();const t=this.shared?.vat.current?.rate_percent??null,e=this.access.manage,a=this.tariffsErr?r`<sw-state-panel state="error" heading=${s("loadTariffsError")} actionLabel=${s("retry")} @action=${()=>void this.loadPrices()}></sw-state-panel>`:r`${this.tariffs.length?c:r`<sw-state-panel icon="drop" state="empty" compact heading=${s("noTariffs")}></sw-state-panel>`}
        ${this.tariffs.map(i=>r`<div class="card flush" data-tariff=${i.id}>
          <div class="hd" style="padding:14px 16px 0"><b>${i.name}</b><span class="sp"></span><span class="mut">${s("usedBy",{n:i.used_by})}</span>
            ${e?r`<button class="btn sm" type="button" data-new-version @click=${()=>this.openVersion(i)}>${s("newVersion")}</button>`:c}</div>
          <div class="scrollx"><table class="t"><thead><tr><th>${s("colFrom")}</th><th class="n">${s("colWaterM3")}</th><th class="n">${s("colSewageM3")}</th><th class="n">${s("colIncVat")}</th><th></th></tr></thead>
            <tbody>${i.versions.map(o=>{const l=o.price_inc_vat??ys(o.water_price,o.sewage_price,o.price_mode,i.vat_rate_percent??t);return r`<tr data-version=${o.id}><td class="num" style="text-align:start">${J(o.effective_from)} ${i.current?.id===o.id?r`<span class="chip c-ok nodot">${s("current")}</span>`:c}${o.locked?r` <span class="chip c-mut nodot" data-locked>${s("locked")}</span>`:c}</td>
                <td class="n"><span class="num">${A(o.water_price)}</span></td><td class="n"><span class="num">${A(o.sewage_price)}</span></td><td class="n"><span class="num">${l===null?"-":A(l)}</span></td>
                <td class="n">${e&&!o.locked&&i.versions.length>1?r`<button class="btn ghost sm icononly" type="button" aria-label=${s("delVersion")} title=${s("delVersion")} ?disabled=${this.busy} @click=${()=>void this.deleteVersion(i,o)}><sw-icon name="trash" size="13"></sw-icon></button>`:c}</td></tr>`})}</tbody></table></div></div>`)}
        ${e?r`<button class="btn" type="button" style="align-self:flex-start" data-new-tariff @click=${()=>this.openVersion(null)}><sw-icon name="plus" size="13"></sw-icon>${s("newTariff")}</button>`:c}`,n=r`<div class="card" data-card="shared"><div class="hd"><b>${s("sharedTitle")}</b></div>
      <div class="mut" style="margin-block-end:10px">${s("sharedNote")}</div>
      <dl class="kv"><dt>${s("vatInForce")}</dt><dd class="num" data-vat>${t===null?"-":`${t}%`}</dd></dl>
      <a class="btn sm" style="margin-block-start:10px;align-self:flex-start" href=${this.sharedLink()} data-shared-link>${s("toShared")}</a></div>`;return r`<div class="cols side"><div class="col">${a}${this.error?r`<div class="alert err" role="alert">${this.error}</div>`:c}</div><div class="col">${n}</div></div>`}renderVersionDialog(){const t=this.vf;if(!t)return c;const e=(a,n)=>this.vf={...t,[a]:n};return r`<elec-dialog open heading=${t.tariffId?s("newVersion"):s("newTariff")} data-dialog="version" @close=${()=>this.vf=null}>
      <div class="formgrid">
        ${t.tariffId?c:r`<div class="fld wide"><label for="wtn">${s("tariffName")}</label><input id="wtn" data-tariff-name .value=${t.name} @input=${a=>e("name",a.target.value)} /></div>`}
        <div class="fld"><label for="wtf">${s("colFrom")}</label><input id="wtf" type="date" lang=${Re()} class="ltr" .value=${t.from} @change=${a=>e("from",a.target.value)} /></div>
        <div class="fld"><span class="lbl">${s("priceMode")}</span><div class="seg" role="group" aria-label=${s("priceMode")}>
          <button type="button" aria-pressed=${t.mode==="ex_vat"?"true":"false"} @click=${()=>e("mode","ex_vat")}>${s("modeEx")}</button>
          <button type="button" aria-pressed=${t.mode==="inc_vat"?"true":"false"} @click=${()=>e("mode","inc_vat")}>${s("modeInc")}</button></div></div>
        <div class="fld"><label for="wtw">${s("colWaterM3")}</label><input id="wtw" class="ltr" inputmode="decimal" data-water-price .value=${t.water} @input=${a=>e("water",a.target.value)} /></div>
        <div class="fld"><label for="wts">${s("colSewageM3")}</label><input id="wts" class="ltr" inputmode="decimal" data-sewage-price .value=${t.sewage} @input=${a=>e("sewage",a.target.value)} /></div>
      </div>
      ${this.vErr?r`<div class="alert err" role="alert">${this.vErr}</div>`:c}
      <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.saveVersion()}>${s("save")}</button>
      <button slot="actions" type="button" class="btn" @click=${()=>this.vf=null}>${s("cancel")}</button>
    </elec-dialog>`}setSnooze(t){this.snooze=t,this.snoozeErr=qt(t)??""}addDuration(){const t=ws(Number(this.addN),this.addU);!Number.isFinite(t)||t<=0||this.snooze.durations.includes(t)||this.setSnooze({...this.snooze,durations:[...this.snooze.durations,t].sort((e,a)=>e-a)})}removeDuration(t){const e=this.snooze;if(e.durations.length<2)return void(this.snoozeErr=s("keepOne"));const a=e.durations.filter(n=>n!==t);this.setSnooze({...e,durations:a,default:a.includes(e.default)?e.default:a[0]})}async saveSnooze(){const t=qt(this.snooze);if(t)return void(this.snoozeErr=t);if(!this.busy){this.busy=!0,this.snoozeErr="";try{const e=await w.saveSnooze(this.snooze,this.cfg?.row_version);this.cfg=this.cfg?{...this.cfg,snooze:e.snooze,row_version:e.row_version}:e,await At(!0),this.flash(s("saved"))}catch(e){this.snoozeErr=e instanceof mt&&e.code==="revision_conflict"?s("conflict"):N(e),e instanceof mt&&e.code==="revision_conflict"&&await this.loadAlerts()}finally{this.busy=!1}}}renderAlerts(){if(!this.cfgLoaded)return Pe();const t=this.access.configure&&(this.cfg?.can_edit??!0),e=this.snooze,a=this.cfg?.rules??vt,n=[...new Set([...Zs,e.max])].sort((o,l)=>o-l),i=JSON.stringify(e)!==JSON.stringify(this.cfg?.snooze??yt);return r`<div class="cols side"><div class="col"><div class="card" data-card="snooze"><div class="hd"><b>${s("snoozeCard")}</b></div>
        <div class="fld"><span class="lbl">${s("snoozeDurations")}</span><div class="chips-ed" data-sn-chips>
          ${e.durations.map(o=>r`<span class="chip nodot" data-duration=${o}>${st(o)}${t?r`<button type="button" aria-label=${s("removeDuration",{d:st(o)})} data-sn-del=${o} @click=${()=>this.removeDuration(o)}><sw-icon name="close" size="13"></sw-icon></button>`:c}</span>`)}
          ${t?r`<span class="row" style="gap:6px;flex-wrap:nowrap"><input type="number" min="1" aria-label=${s("snoozeAddValue")} style="inline-size:76px" data-sn-n .value=${this.addN} @input=${o=>this.addN=o.target.value} />
            <select aria-label=${s("snoozeUnit")} style="inline-size:96px" data-sn-u @change=${o=>this.addU=o.target.value}>
              <option value="min" ?selected=${this.addU==="min"}>${s("uMin")}</option><option value="hour" ?selected=${this.addU==="hour"}>${s("uHour")}</option><option value="day" ?selected=${this.addU==="day"}>${s("uDay")}</option></select>
            <button class="btn sm" type="button" data-sn-add @click=${()=>this.addDuration()}>${s("add")}</button></span>`:c}</div></div>
        <div class="formgrid" style="margin-block-start:12px">
          <div class="fld"><label for="sn-def">${s("snoozeDefault")}</label><select id="sn-def" data-sn-def ?disabled=${!t} @change=${o=>this.setSnooze({...e,default:Number(o.target.value)})}>${e.durations.map(o=>r`<option value=${o} ?selected=${o===e.default}>${st(o)}</option>`)}</select></div>
          <div class="fld"><label for="sn-max">${s("snoozeMax")}</label><select id="sn-max" data-sn-max ?disabled=${!t} @change=${o=>this.setSnooze({...e,max:Number(o.target.value)})}>${n.map(o=>r`<option value=${o} ?selected=${o===e.max}>${st(o)}</option>`)}</select></div>
        </div>
        ${this.snoozeErr?r`<div class="msg" role="alert" data-sn-error>${this.snoozeErr}</div>`:c}
        ${t?r`<div class="row" style="margin-block-start:12px"><button type="button" class="btn pri" data-sn-save ?disabled=${this.busy||!i||!!qt(e)} @click=${()=>void this.saveSnooze()}>${s("save")}</button></div>`:r`<div class="mut" style="margin-block-start:10px">${s("noConfigure")}</div>`}
      </div></div>
      <div class="col"><div class="card" data-card="rules"><div class="hd"><b>${s("rulesCard")}</b></div><dl class="kv">
        <dt>${s("rWindow")}</dt><dd class="num">${a.night_from}-${a.night_to}</dd><dt>${s("rThreshold")}</dt><dd>${a.night_min_lph} ${s("lph")}</dd><dt>${s("rDuration")}</dt><dd>${qe(a.night_min_intervals*15)}</dd></dl>
        <div class="mut" style="margin-block-start:8px">${s("rulesReadonly")}</div></div></div></div>`}render(){if(!this.access.manage&&!this.access.configure)return r`<sw-state-panel state="forbidden" data-water="settings" data-state="forbidden"></sw-state-panel>`;const t=this.section,e=a=>b("/infra/water/settings",{set:a});return r`<div class="page" data-water="settings" data-state="ready" data-section=${t}>
      <div class="seg sect-nav" role="group" aria-label=${s("sections")} data-set-nav>
        ${this.access.manage||this.access.bills?r`<button type="button" data-set="prices" aria-pressed=${t==="prices"?"true":"false"} @click=${()=>e("prices")}>${s("sTariffs")}</button>`:c}
        <button type="button" data-set="alerts" aria-pressed=${t==="alerts"?"true":"false"} @click=${()=>e("alerts")}>${s("sAlerts")}</button></div>
      ${this.notice?r`<div class="notice" role="status" data-notice>${this.notice}</div>`:c}
      ${t==="prices"?this.renderPrices():this.renderAlerts()}
      ${this.renderVersionDialog()}
    </div>`}};E.styles=[nt,at];B([C({attribute:!1})],E.prototype,"segments",2);B([C({attribute:!1})],E.prototype,"params",2);B([d()],E.prototype,"access",2);B([d()],E.prototype,"tariffs",2);B([d()],E.prototype,"tariffsErr",2);B([d()],E.prototype,"shared",2);B([d()],E.prototype,"cfg",2);B([d()],E.prototype,"cfgLoaded",2);B([d()],E.prototype,"snooze",2);B([d()],E.prototype,"addN",2);B([d()],E.prototype,"addU",2);B([d()],E.prototype,"snoozeErr",2);B([d()],E.prototype,"notice",2);B([d()],E.prototype,"vf",2);B([d()],E.prototype,"vErr",2);B([d()],E.prototype,"busy",2);B([d()],E.prototype,"error",2);E=B([Z("water-settings-page")],E);var ta=Object.defineProperty,ea=Object.getOwnPropertyDescriptor,K=(t,e,a,n)=>{for(var i=n>1?void 0:n?ea(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&ta(e,a,i),i};const Ne={today:"rToday","7d":"r7d","30d":"r30d",prev:"rPrevMonth"},Te="sw.water.usage.range",St=t=>String(t).padStart(2,"0"),Ke=t=>`${t.getFullYear()}-${St(t.getMonth()+1)}-${St(t.getDate())}`,Vt=t=>{const[e,a]=t.split(":").map(Number);return e*60+(a||0)};function Yt(t,e=new Date){const a=new Date(e.getFullYear(),e.getMonth(),e.getDate());if(t==="today")return{from:a,to:e,days:1};if(t==="prev"){const i=new Date(e.getFullYear(),e.getMonth()-1,1),o=new Date(e.getFullYear(),e.getMonth(),1);return{from:i,to:o,days:Math.round((o.getTime()-i.getTime())/864e5)}}const n=t==="7d"?7:30;return{from:new Date(a.getFullYear(),a.getMonth(),a.getDate()-(n-1)),to:e,days:n}}function sa(t,e,a,n){const i=Vt(a.night_from),o=Vt(a.night_to),l=h=>{const p=h.getHours()*60+h.getMinutes();return i<=o?p>=i&&p<o:p>=i||p<o},u=t.series??[];if(e==="today")return u.map(h=>{const p=new Date(h.start);return{label:St(p.getHours()),value:(h.litres??0)/1e3,win:l(p)}});const f=new Map;for(const h of u){const p=new Date(h.start),F=Ke(p),g=f.get(F)??{value:0,night:0,d:p};g.value+=(h.litres??0)/1e3,l(p)&&(g.night+=(h.litres??0)/1e3),f.set(F,g)}return[...f.entries()].map(([h,p])=>({label:String(p.d.getDate()),value:p.value,night:p.night,leak:n.has(h),title:`${St(p.d.getDate())}.${St(p.d.getMonth()+1)}: ${k(p.value)} ${s("m3")}, ${s("night")} ${Math.round(p.night*1e3)} ${s("litre")}`}))}let W=class extends X{constructor(){super(...arguments),this.bubbleSkin=new tt(this),this.segments=[],this.params=new URLSearchParams,this.range=te(Te,"30d"),this.data=null,this.meters=[],this.leakDays=new Set,this.night={},this.rules=vt,this.phase="loading",this.error="",this.access=it(),this.chartW=640,this.seq=0,this.ro=null,this.observed=null}connectedCallback(){super.connectedCallback(),this.stop=rt(t=>this.access=t),this.load()}disconnectedCallback(){this.stop?.(),this.ro?.disconnect(),this.ro=null,this.observed=null,super.disconnectedCallback()}updated(){const t=this.renderRoot.querySelector("[data-usage-chart]");t!==this.observed&&(this.ro?.disconnect(),this.observed=t,!(!t||typeof ResizeObserver!="function")&&(this.ro??=new ResizeObserver(e=>{const a=Math.floor(e[e.length-1].contentRect.width);a>0&&Math.abs(a-this.chartW)>1&&(this.chartW=a)}),this.ro.observe(t)))}async load(){const t=++this.seq;this.phase="loading";const e=Yt(this.range);try{const a=await At();a&&(this.rules=a.rules);const[n,i,o]=await Promise.all([w.consumption(e.from.toISOString(),e.to.toISOString(),"1h"),w.listMeters(),w.events("all").catch(()=>({items:[]}))]);if(t!==this.seq)return;this.data=n,this.meters=i,this.leakDays=new Set(o.items.filter(l=>l.kind==="night_flow").map(l=>Ke(new Date(l.opened_at)))),this.phase="ready",this.night=await Be(i,this.rules)}catch(a){if(t!==this.seq)return;this.error=N(a),this.phase="error"}}setRange(t){this.range=t,ee(Te,t),this.load()}csv(){const t=Yt(this.range),e=document.createElement("a");e.href=w.consumptionCsvUrl(t.from.toISOString(),t.to.toISOString(),ie()),e.download="",e.click()}renderHead(){return r`<div class="row head">
      <div class="seg ranges" role="group" aria-label=${s("range")} data-ranges>${["today","7d","30d","prev"].map(t=>r`<button type="button" aria-pressed=${this.range===t?"true":"false"} data-range=${t} @click=${()=>this.setRange(t)}>${s(Ne[t])}</button>`)}</div>
      <span class="sp"></span>
      <button class="btn" type="button" data-csv ?disabled=${this.phase!=="ready"||!this.data?.items.length} @click=${()=>this.csv()}><sw-icon name="download" size="15"></sw-icon>${s("csv")}</button>
    </div>`}render(){if(!this.access.view)return r`<sw-state-panel state="forbidden" data-water="usage" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return r`<div class="page" data-water="usage" data-state="loading" aria-busy="true">${this.renderHead()}<div class="card">${Array.from({length:7},()=>r`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;if(this.phase==="error"||!this.data)return r`<div class="page" data-water="usage" data-state="error">${this.renderHead()}<sw-state-panel state="error" heading=${s("loadUsageError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.load()}></sw-state-panel></div>`;const t=this.data;if(!t.items.length)return r`<div data-water="usage" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${s("emptyUsage")}>${this.access.manage?r`<sw-button variant="primary" icon="plus" data-add-meter @click=${()=>b("/infra/water/meters",{add:"1"})}>${s("addMeter")}</sw-button>`:c}</sw-state-panel></div>`;const e=Yt(this.range),a=t.total_litres,n=t.previous_total_litres,i=a!==null&&n?Math.round((a-n)/n*100):null,o=sa(t,this.range,this.rules,this.leakDays),l=(t.series??[]).filter(m=>{const T=new Date(m.start),G=T.getHours()*60+T.getMinutes(),ot=Vt(this.rules.night_from),$t=Vt(this.rules.night_to);return m.litres!==null&&(ot<=$t?G>=ot&&G<$t:G>=ot||G<$t)}),u=l.length?Math.round(l.reduce((m,T)=>m+(T.litres??0),0)/l.length):null,f=`${this.rules.night_from}-${this.rules.night_to}`,h=new Map(this.meters.map(m=>[m.id,m])),p=[...t.items].sort((m,T)=>(T.litres??-1)-(m.litres??-1)),F=(m,T)=>m===null||!T?null:Math.round((m-T)/T*100),g=m=>m===null?"-":`${m>0?"+":""}${m}%`,Y=m=>m===null||m===0?"":m>0?"up":"down";return r`<div class="page fit" data-water="usage" data-state="ready">
      ${this.renderHead()}
      <div class="tiles" data-tiles>
        <div class="tile"><div class="k">${s("tTotal")}</div><div class="v"><span class="num" data-t="total">${k(a===null?null:a/1e3)}</span><span class="u">${s("m3")}</span></div></div>
        <div class="tile"><div class="k">${s("tVsPrev")}</div><div class="v ${Y(i)}"><span class="num" data-t="vs">${g(i)}</span></div></div>
        <div class="tile"><div class="k">${s("tDailyAvg")}</div><div class="v"><span class="num" data-t="avg">${k(a===null?null:a/1e3/Math.max(1,e.days))}</span><span class="u">${s("m3")}</span></div></div>
        <div class="tile"><div class="k">${s("tNightAvg")}</div><div class="v"><span class="num" data-t="night">${u??"-"}</span><span class="u">${s("lph")}</span></div></div>
      </div>
      <div class="card">
        <div class="hd"><h3 class="sec">${this.range==="today"?s("hourlyUsage"):s("dailyUsage")}</h3><span class="sp"></span>
          <div class="legend"><span><i style="background:var(--sw-accent)"></i>${s("legendDay")}</span><span><i style="background:color-mix(in srgb, var(--sw-heading, var(--sw-text)) 55%, var(--sw-surface-3))"></i>${s("legendNight",{w:f})}</span><span><i style="background:var(--sw-danger)"></i>${s("legendLeak")}</span></div></div>
        <div class="usage-chart" data-usage-chart>${je(o,`${s("dailyUsage")} · ${s(Ne[this.range])}`,m=>m.toFixed(m<10?2:1),this.chartW)}</div>
      </div>
      <div class="card flush scrollx desk-only fitbox"><table class="t" data-usage-table>
        <thead><tr><th>${s("colName")}</th><th>${s("colArea")}</th><th class="n">${s("colUsage")}</th><th>${s("colShare")}</th><th class="n">${s("colVsPrev")}</th><th class="n">${s("colNight")}</th></tr></thead>
        <tbody>${p.map(m=>{const T=F(m.litres,m.previous_litres),G=m.share===null?0:Math.round(m.share*100);return r`<tr data-meter=${m.meter_id}><td class="b">${m.display_name}</td><td>${m.area_name??"-"}<span class="mut dsk">${m.floor_name?` · ${m.floor_name}`:""}</span></td>
            <td class="n"><span class="num">${k(m.litres===null?null:m.litres/1e3)}</span></td>
            <td><span class="share"><i><b style="width:${G}%"></b></i><span class="num mut">${G}%</span></span></td>
            <td class="n ${Y(T)}"><span class="num">${g(T)}</span></td><td class="n"><span class="num">${h.has(m.meter_id)?Ct(this.night[m.meter_id]):"-"}</span></td></tr>`})}</tbody></table></div>
      <div class="list phone-only" style="flex-direction:column" data-usage-rows>${p.map(m=>{const T=F(m.litres,m.previous_litres);return r`<div class="li"><div class="grow"><div class="t1">${m.display_name}</div><div class="t2">${m.area_name??""} · <span class="num">${m.share===null?0:Math.round(m.share*100)}%</span> · ${s("vsPrevShort")} <span class="num ${Y(T)}">${g(T)}</span> · ${s("night")} ${Ct(this.night[m.meter_id])}</div></div>
          <div class="amt num">${k(m.litres===null?null:m.litres/1e3)} ${s("m3")}</div></div>`})}</div>
    </div>`}};W.styles=[nt,at];K([C({attribute:!1})],W.prototype,"segments",2);K([C({attribute:!1})],W.prototype,"params",2);K([d()],W.prototype,"range",2);K([d()],W.prototype,"data",2);K([d()],W.prototype,"meters",2);K([d()],W.prototype,"leakDays",2);K([d()],W.prototype,"night",2);K([d()],W.prototype,"rules",2);K([d()],W.prototype,"phase",2);K([d()],W.prototype,"error",2);K([d()],W.prototype,"access",2);K([d()],W.prototype,"chartW",2);W=K([Z("water-usage-page")],W);var aa=Object.defineProperty,ia=Object.getOwnPropertyDescriptor,Wt=(t,e,a,n)=>{for(var i=n>1?void 0:n?ia(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&aa(e,a,i),i};const se=Ze.map(t=>({id:t.id,label:t.label,tag:`water-${t.id}-page`,money:es.includes(t.id),manage:ts.includes(t.id)}));function ra(t){const e=t[1]==="water"?t[2]:void 0;return se.find(a=>a.id===e)?.id??"meters"}function Me(t,e){return e.view&&(!t.money||e.bills)&&(!t.manage||ss(e))}let ft=class extends X{constructor(){super(...arguments),this.bubbleSkin=new tt(this),this.route=null,this.access=it(),this.alerts=us(),this.tabsMode=new Ge(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=rt(t=>this.access=t),this.stopCount=ps(t=>this.alerts=t),ne()}disconnectedCallback(){this.stop?.(),this.stopCount?.(),oe(this),this.pagesChip=null,super.disconnectedCallback()}body(t,e){const a=this.access,n=this.route;if(!a.loaded)return r`<sw-state-panel state="loading" data-water=${t} data-state="loading"></sw-state-panel>`;if(a.failed)return r`<sw-state-panel state="error" heading=${s("loadMetersError")} actionLabel=${s("retry")} data-water=${t} data-state="error" @action=${()=>void ne()}></sw-state-panel>`;if(!a.enabled)return r`<sw-state-panel state="stale" heading=${s("offTitle")} hint=${s("offHint")} data-water=${t} data-state="off">
        ${a.manage||a.configure?r`<sw-button size="sm" data-to-settings @click=${()=>b(Oe.slice(1))}>${s("toSettings")}</sw-button>`:c}
      </sw-state-panel>`;if(!Me(e,a))return r`<sw-state-panel state="forbidden" data-water=${t} data-state="forbidden"></sw-state-panel>`;if(!customElements.get(e.tag))return r`<sw-state-panel icon="drop" state="empty" heading=${s("noScreen")} data-water=${t} data-state="empty"></sw-state-panel>`;const i=is(e.tag);return rs`<${i} .segments=${(n?.segments??[]).slice(3)} .params=${n?.params??new URLSearchParams}></${i}>`}render(){const t=this.access,e=ra(this.route?.segments??[]),a=se.find(h=>h.id===e),n=t.loaded&&!t.failed&&t.enabled&&t.view,i=n?se.filter(h=>Me(h,t)):[],o=Je("infra.water",i.map(h=>({id:h.id,label:h.label,href:`#/infra/water/${h.id}`,...h.id==="alerts"&&this.alerts?{count:this.alerts}:{}})),q()),l=n&&Qe(le,q(),as).length<2?r`<sw-tabs .items=${le.filter(h=>h.id==="water")} active="water" .variant=${de("infra")} data-infra-l1></sw-tabs>`:c,u=o.length>0&&ns(this.tabsMode.value,o.length);this.pagesChip=u?os(s("pageRow"),o,e,h=>b(`/infra/water/${h}`)):null;const f=u||!o.length?c:r`<sw-tabs .items=${o} .active=${e} .variant=${de("infra.water")} data-infra-pages></sw-tabs>`;return r`${ds(s("tab"),!0)}<div class="rows lead-head" data-water-shell>${l}${f}</div><div class="body" data-page=${e}>${this.body(e,a)}</div>`}updated(){this.pagesChip?Xe(this,this.pagesChip):oe(this)}};ft.styles=[cs,ls,zt`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-block-size: 100%;
      padding: 14px var(--sw-page-pad) 24px;
      max-inline-size: var(--sw-content-max);
      inline-size: 100%;
      box-sizing: border-box;
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
  `,at];Wt([C({attribute:!1})],ft.prototype,"route",2);Wt([d()],ft.prototype,"access",2);Wt([d()],ft.prototype,"alerts",2);ft=Wt([Z("infra-water")],ft);export{ft as InfraWater,se as WATER_PAGES,Me as pageAllowed,ra as waterPageOf};
//# sourceMappingURL=infra-water-7M1IyJ5O.js.map
