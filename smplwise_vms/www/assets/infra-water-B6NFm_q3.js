import{bs as Ne,a3 as G,b4 as S,bT as Z,bn as P,bt as je,bo as wt,uE as ne,bR as oe,g as Vt,u as Wt,bE as Ke,aU as et,ay as M,j as c,i as st,aL as ct,yx as at,yy as it,n as N,Y as b,A as d,b as n,ei as Me,k as X,a6 as ut,a as mt,eO as qe,yz as Te,en as Ye,yA as le,ep as de,eq as Ge,er as Je,et as Qe,yB as Xe,yC as Ze,yD as ts,yE as es}from"./index-BiEy1mLY.js";import{f as J,a as Bt,m as ss,M as as,b as Jt,c as is,d as rs,e as ns}from"./meters-page-base-DqVYD_DT.js";import{e as Re}from"./styles-CsZmZ4S-.js";import"./sw-place-tree-x5LSOFBw.js";import{s as os,u as ls}from"./static-8MGTjYX2.js";import{i as ds,a as cs}from"./infra-pages-B_sZ4lan.js";import"./sw-logo-art-MaHPMZFI.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";const D="infra/water/",ht=t=>{const e=new URLSearchParams;for(const[r,i]of Object.entries(t))i!==void 0&&i!==""&&e.set(r,String(i));const a=e.toString();return a?`?${a}`:""},vt={night_from:"01:00",night_to:"05:00",night_min_lph:6,night_min_intervals:8},yt={durations:[15,60,240,1440],default:60,max:10080},w={listMeters:async()=>G()?(await S(`${D}meters`)).items:[],meter:t=>S(`${D}meters/${encodeURIComponent(t)}`),candidates:async(t="")=>G()?(await S(`${D}candidates${ht({q:t,include_rejected:!0})}`)).items:[],createMeter:t=>P(`${D}meters`,t),patchMeter:(t,e)=>wt(`${D}meters/${encodeURIComponent(t.id)}`,{revision:t.revision,...e}),retireMeter:t=>Z(`${D}meters/${encodeURIComponent(t.id)}${ht({revision:t.revision})}`),replaceMeter:(t,e)=>P(`${D}meters/${encodeURIComponent(t.id)}/replace`,{revision:t.revision,...e}),series:async(t,e,a,r)=>G()?(await S(`${D}meters/${encodeURIComponent(t)}/series${ht({from:a,to:r,bucket:e})}`)).items:[],consumption:async(t,e,a)=>G()?S(`${D}consumption${ht({from:t,to:e,bucket:a})}`):{from:t,to:e,items:[],total_litres:null,previous_total_litres:null,series:[]},consumptionCsvUrl:(t,e,a)=>je(`${D}consumption.csv${ht({from:t,to:e,lang:a})}`),manualReadings:async t=>G()?(await S(`${D}meters/${encodeURIComponent(t)}/manual-readings`)).items:[],addManual:(t,e)=>P(`${D}meters/${encodeURIComponent(t)}/manual-readings`,e),undoManual:(t,e)=>P(`${D}meters/${encodeURIComponent(t)}/manual-readings/${encodeURIComponent(e)}/undo`,{}),events:async(t,e)=>{if(!G())return{items:[],summary:{open:0,acked:0,last_7d:0,open_leaks:0,snoozed:0}};const a=await S(`${D}events${ht({state:t,meter_id:e})}`);return e||hs(a.summary.open),a},ack:t=>P(`${D}events/${encodeURIComponent(t)}/ack`,{}),snooze:(t,e)=>P(`${D}events/${encodeURIComponent(t)}/snooze`,e===void 0?{}:{minutes:e}),unsnooze:t=>Z(`${D}events/${encodeURIComponent(t)}/snooze`),alerts:async()=>G()?S(`${D}alerts`):{rules:vt,snooze:yt,snooze_limits:{min:5,max:43200,count:12},row_version:0,can_edit:!0},saveSnooze:(t,e)=>Ne(`${D}alerts`,{snooze:t,row_version:e})};let Qt=0;const Xt=new Set,us=()=>Qt;function hs(t){if(t!==Qt){Qt=t;for(const e of Xt)e(t)}}function ps(t){return Xt.add(t),()=>Xt.delete(t)}let Dt=null;async function At(t=!1){if(!t&&Dt&&Date.now()-Dt.at<6e4)return Dt.cfg;let e=null;try{e=await w.alerts()}catch{e=null}return Dt={at:Date.now(),cfg:e},e}const ce=t=>{const[e,a]=t.split(":").map(Number);return(e||0)*60+(a||0)};function ms(t,e=new Date){const a=ce(t.night_from),r=ce(t.night_to),i=(h,O)=>new Date(h.getFullYear(),h.getMonth(),h.getDate(),Math.floor(O/60),O%60),o=e.getHours()*60+e.getMinutes(),l=new Date(e);o<a&&!(r<a&&o<r)&&l.setDate(l.getDate()-1);const u=i(l,a),f=new Date(u);r<=a&&f.setDate(f.getDate()+1);const p=i(f,r);return{from:u,to:p>e?e:p}}function fs(t){const e=t.map(a=>a.litres).filter(a=>a!=null);return e.length?Math.round(Math.min(...e)*10)/10:null}function Ee(t){const e=t.rules?.night_rule;return typeof e=="boolean"?!e:t.kind==="irrigation"}const ue=new Map;async function Oe(t,e){const a={},r=ms(e);return await Promise.all(t.map(async i=>{if(Ee(i))return void(a[i.id]="off");if(i.status==="retired"||i.value_l===null)return void(a[i.id]=null);const o=ue.get(i.id);if(o&&Date.now()-o.at<6e5)return void(a[i.id]=o.v);try{const l=fs(await w.series(i.id,"1h",r.from.toISOString(),r.to.toISOString()));ue.set(i.id,{at:Date.now(),v:l}),a[i.id]=l}catch{a[i.id]=null}})),a}const Le=t=>t.area_id??"_none";function vs(t,e=ne("ללא קומה"),a=ne("ללא אזור")){const r=new Map;for(const i of t){const o=i.floor_id??"",l=r.get(o)??{floor_id:o,name:i.floor_name??e,count:0,areas:[]};l.count++;const u=Le(i),f=l.areas.find(p=>p.area_id===u);f?f.count++:l.areas.push({area_id:u,name:i.area_name??a,count:1}),r.set(o,l)}return[...r.values()]}const $="infra/water/",ot=t=>{const e=new URLSearchParams;for(const[r,i]of Object.entries(t))i!==void 0&&i!==""&&e.set(r,String(i));const a=e.toString();return a?`?${a}`:""},jt=()=>`wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`,v={sharedSettings:()=>S(`${$}billing/shared`),listCustomers:t=>G()?S(`${$}customers${ot({q:t})}`):Promise.resolve({items:[],total:0}),customer:t=>S(`${$}customers/${t}`),nextCustomerNumber:()=>S(`${$}customers/next-number`),createCustomer:t=>P(`${$}customers`,t),updateCustomer:(t,e)=>wt(`${$}customers/${t}`,e),deleteCustomer:(t,e)=>Z(`${$}customers/${t}${ot({base_revision:e})}`),listTariffs:()=>G()?S(`${$}tariffs`):Promise.resolve({items:[]}),createTariff:t=>P(`${$}tariffs`,t),renameTariff:(t,e)=>wt(`${$}tariffs/${t}`,{name:e}),deleteTariff:t=>Z(`${$}tariffs/${t}`),addVersion:(t,e)=>P(`${$}tariffs/${t}/versions`,e),correctVersion:(t,e,a)=>wt(`${$}tariffs/${t}/versions/${e}`,a),deleteVersion:(t,e)=>Z(`${$}tariffs/${t}/versions/${e}`),listAccounts:t=>G()?S(`${$}accounts${ot({q:t})}`):Promise.resolve({items:[],summary:{active:0,drafts:0}}),account:t=>S(`${$}accounts/${t}`),accountStatus:t=>S(`${$}accounts/${t}/status`),accountHistory:(t,e=12)=>S(`${$}accounts/${t}/history${ot({past:e})}`),accountBills:t=>S(`${$}accounts/${t}/bills`),createAccount:t=>P(`${$}accounts`,t),updateAccount:(t,e)=>wt(`${$}accounts/${t}`,e),deleteAccount:(t,e)=>Z(`${$}accounts/${t}${ot({base_revision:e})}`),preset:(t,e,a,r)=>P(`${$}formula/preset`,{preset:t,meter_ids:e,main_meter_id:a,percent:r}),listBills:(t={})=>G()?S(`${$}bills${ot(t)}`):Promise.resolve({items:[],total:0,counts:{draft:0,issued:0,sent:0,paid:0,void:0},sums:{open:"0.00",paid:"0.00"}}),bill:t=>S(`${$}bills/${t}`),billEvents:t=>S(`${$}bills/${t}/events`),createBill:(t,e)=>P(`${$}accounts/${t}/bills`,{period:e,client_request_id:jt()}),recalculate:t=>P(`${$}bills/${t.id}/recalculate`,{row_version:t.row_version}),deleteDraft:t=>Z(`${$}bills/${t.id}${ot({row_version:t.row_version})}`),issue:(t,e=jt())=>P(`${$}bills/${t.id}/issue`,{row_version:t.row_version,client_request_id:e}),markSent:(t,e,a="")=>P(`${$}bills/${t.id}/sent`,{how:e,note:a,row_version:t.row_version}),markPaid:(t,e="")=>P(`${$}bills/${t.id}/paid`,{reference:e,row_version:t.row_version}),void:(t,e)=>P(`${$}bills/${t.id}/void`,{reason:e,row_version:t.row_version}),correct:t=>P(`${$}bills/${t.id}/correct`,{client_request_id:jt()}),snooze:(t,e)=>P(oe`infra/water/events/${t}/snooze`,e===void 0?{}:{minutes:e}),unsnooze:t=>Z(oe`infra/water/events/${t}/snooze`),saveSnooze:(t,e)=>Ne("infra/water/alerts",{snooze:t,row_version:e})},$s=Vt`
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
`,rt=[Re,$s],gs=new Intl.NumberFormat(Wt(),{minimumFractionDigits:3,maximumFractionDigits:3});new Intl.NumberFormat(Wt(),{maximumFractionDigits:1});const bs=new Intl.NumberFormat(Wt(),{minimumFractionDigits:2,maximumFractionDigits:2});function y(t){if(t==null||t==="")return"-";const e=typeof t=="number"?t:Number(t);return Number.isFinite(e)?gs.format(e):"-"}function k(t){if(t==null||t==="")return"";const e=typeof t=="number"?t:Number(t);return Number.isFinite(e)?`${bs.format(e)} ₪`:""}const kt={draft:{label:"טיוטה",cls:"c-mut"},issued:{label:"הונפק",cls:"c-acc"},sent:{label:"נשלח",cls:"c-warn"},paid:{label:"שולם",cls:"c-ok"},void:{label:"בוטל",cls:"c-err"}};function Kt(t){return t.status==="paused"?{label:"מושהה",cls:"c-mut"}:t.stale_meters.length?{label:"מונה לא מדווח",cls:"c-warn"}:{label:"פעיל",cls:"c-ok"}}const he={off:"בלי יצירה אוטומטית",draft:"ליצור טיוטה",issue:"להנפיק אוטומטית"};function pe(t,e){return`${t===1?"חודשית":"דו-חודשית"} · מה-${e}`}function ws(t){return{water:t.filter(e=>e.component==="water"),sewage:t.filter(e=>e.component==="sewage")}}function tt(t){return t<60?`${t} ד׳`:t===60?"שעה":t<1440?t%60===0?`${t/60} שעות`:`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")} שעות`:t===1440?"יממה":t%1440===0?`${t/1440} ימים`:`${Math.round(t/1440*10)/10} ימים`}function se(t,e,a="Asia/Jerusalem"){const r=new Date(t.getTime()+e*6e4),i=u=>new Intl.DateTimeFormat("en-CA",{timeZone:a,year:"numeric",month:"2-digit",day:"2-digit"}).format(u),o=new Intl.DateTimeFormat(Wt(),{timeZone:a,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(r),l=Math.round((Date.parse(i(r))-Date.parse(i(t)))/864e5);return l<=0?o:l===1?`מחר ${o}`:`${l} ימים, ${o}`}const Pt={min:5,max:43200,count:12};function qt(t){return!Number.isInteger(t.max)||t.max<Pt.min||t.max>Pt.max?"המקסימום הוא בין 5 דקות ל-30 ימים.":!t.durations.length||t.durations.length>Pt.count?"יש להציע בין משך אחד ל-12 משכים.":t.durations.some(e=>!Number.isInteger(e)||e<Pt.min||e>t.max)?"משך נדנוד ארוך מהמקסימום.":t.durations.includes(t.default)?null:"ברירת המחדל חייבת להיות אחד מהמשכים המוצעים."}function ys(t,e){return Math.round(t*(e==="min"?1:e==="hour"?60:1440))}function _s(t,e,a,r){const i=Number(t)+Number(e);return Number.isFinite(i)?a==="inc_vat"?Math.round(i*100)/100:r===null?null:Math.round(i*(1+Number(r)/100)*100)/100:null}function Zt(t){const e=t;if(!e||typeof e!="object")return null;if(typeof e.m=="string")return[{sign:1,meter_id:e.m}];if((e.op==="+"||e.op==="-")&&Array.isArray(e.args)&&e.args.length>=2){const a=e.args.map(o=>Zt(o));if(a.some(o=>o===null))return null;const[r,...i]=a;return[...r,...i.flatMap(o=>e.op==="-"?o.map(l=>({...l,sign:l.sign*-1})):o)]}return null}function me(t){const e=new Set,a=t.filter(l=>l.meter_id&&!e.has(l.meter_id)&&e.add(l.meter_id)),r=a.filter(l=>l.sign>0),i=a.filter(l=>l.sign<0);if(!r.length)return null;let o={m:r[0].meter_id};for(const l of r.slice(1))o={op:"+",args:[o,{m:l.meter_id}]};for(const l of i)o={op:"-",args:[o,{m:l.meter_id}]};return o}function ks(t,e){return(t.state==="issued"||t.state==="sent")&&!!t.due_date&&t.due_date<e}const ae={tab:"מים",pageRow:"עמודים",offTitle:"המודול כבוי",offHint:"מוני מים מופעלים בהגדרות המערכת",toSettings:"להגדרות",forbidden:"אין הרשאה",noScreen:"אין מסך",retry:"נסה שוב",cancel:"ביטול",save:"שמירה",back:"חזרה",close:"סגירה",remove:"הסרה",add:"הוספה",loading:"טוען",csv:"ייצוא CSV",m3:"מ״ק",litre:"ליטר",lph:"ליטר לשעה",ils:"₪",search:"חיפוש מונה",view:"תצוגה",cards:"כרטיסים",table:"טבלה",addMeter:"הוספת מונה",allAreas:"כל האזורים",areas:"אזורים",fold:"כיווץ",unfold:"הרחבה",area:"אזור",tToday:"היום",tMonth:"מתחילת החודש",tReporting:"מדווחים",tOf:"מתוך {n}",tLeak:"דליפה חשודה",tMeters:"מונים",colName:"שם",colArea:"אזור",colReading:"קריאה נוכחית (מ״ק)",colToday:"היום",colMonth:"מתחילת החודש",colNight:"ספיקת לילה",colState:"מצב",todayM3:"מ״ק היום",nightOff:"כבוי",emptyMeters:"אין מונים עדיין",noResults:"לא נמצאו מונים",loadMetersError:"לא ניתן לטעון את המונים",stReporting:"מדווח",stNotReporting:"לא מדווח",stNotReportingSince:"לא מדווח מ-{t}",stPaused:"מושהה",stRetired:"הוצא משימוש",stLeak:"דליפה חשודה",stAbnormal:"צריכה חריגה",addTitle:"הוספת מונה",candSearch:"חיפוש חיישן לפי שם",candNone:"לא נמצאו חיישנים מתאימים",candRejected:"לא מתאים",meterName:"שם המונה",meterKind:"סוג",added:"המונה נוסף",kMain:"ראשי",kSub:"משני",kIrrigation:"השקיה",kCooling:"קירור",kPool:"בריכה",kOther:"אחר",cardLoadError:"לא ניתן לטעון את המונה",fArea:"אזור",fReading:"קריאה נוכחית",fLast:"דיווח אחרון",fUnit:"יחידה",fUnitValue:"מ״ק · מונה מצטבר",fKind:"סוג",fNight:"ספיקת לילה",fNightOff:"כלל הלילה כבוי (השקיה)",fRules:"כללי דליפה",fRulesDefault:"ברירת המחדל של המערכת · לילה {w}",fRulesOwn:"כללים של המונה · לילה {w}",usage:"צריכה",range:"טווח",r24h:"24 שעות",r30d:"30 ימים",r12m:"12 חודשים",chartAria:"גרף צריכה, {r}",chartError:"לא ניתן לטעון את גרף הצריכה",chartNoData:"אין נתונים לתקופה",nightNote:"ליטר לשעה · חלון הלילה {w} מודגש",openAlerts:"התראות פתוחות",epochs:"תקופות מונה",epochStart:"קריאת התחלה",epochUntil:"עד",epochActive:"פעיל",reasonFirst:"התקנה",reasonReplaced:"החלפת מונה",reasonSource:"שינוי מקור",readings:"קריאות ידניות וכיול",manualReading:"קריאה ידנית",noReadings:"אין קריאות ידניות",readingAt:"מועד הקריאה",readingValue:"קריאה",readingNote:"הערה (לא חובה)",readingSaved:"הקריאה נשמרה",readingUndo:"ביטול קריאה",readingVoided:"בוטלה",effAllocation:"הושלם פער דיווח",effRecorded:"נשמרה להשוואה",rename:"שינוי שם",renameTitle:"שינוי שם המונה",replace:"החלפת מונה",replaceFinal:"קריאה סופית של המונה הישן",replaceStart:"קריאת התחלה של המונה החדש",replaceNote:"הערה (לא חובה)",replaceBad:"צריך להזין קריאה תקינה",pause:"השהיה",resume:"חידוש",removeTitle:"הסרת המונה",removeBody:"המונה יוסר מהרשימה. הנתונים שנאספו יישמרו.",nameRequired:"צריך לכתוב שם למונה",ack:"אישור",acked:"ההתראה אושרה",snooze:"נדנוד {d}",snoozeOther:"משך נדנוד אחר",snoozeTo:"נדנוד ל...",snoozeUntil:"עד {t}",snoozedUntil:"מנודנדת עד {t}",snoozedToast:"ההתראה נודנדה ל-{d} (עד {t})",snoozeFoot:"המשכים נקבעים בהגדרות",unsnooze:"סיום נדנוד",fOpen:"פתוחות",fAll:"הכול",filter:"סינון",leakRules:"כללי דליפה",tOpen:"פתוחות",tClosedWeek:"נסגרו השבוע",tSnoozed:"מנודנדות",tRule:"כללי דליפה",ruleValue:"{lph} ליטר לשעה · {dur}",colMeter:"מונה",colKind:"סוג",colSince:"מאז",colValue:"ערך",akNight:"דליפה · ספיקה רציפה בלילה",akBurst:"פריצה",akAbnormal:"צריכה חריגה",akOffline:"לא מדווח",akHealth:"תקלה במונה",asOpen:"פתוחה",asAcked:"אושרה · {who}",asClosed:"נסגרה",asClosedBy:"נסגרה · {who}",valueRate:"{v} ליטר לשעה",valueRateTh:"{v} ליטר לשעה (סף {t})",valueAbnormal:"{v} מ״ק, רגיל {m}",emptyAlerts:"אין התראות",loadAlertsError:"לא ניתן לטעון את ההתראות",rToday:"היום",r7d:"7 ימים",rPrevMonth:"חודש קודם",tTotal:"סה״כ בטווח",tVsPrev:"לעומת התקופה הקודמת",tDailyAvg:"ממוצע יומי",tNightAvg:"ספיקת לילה ממוצעת",dailyUsage:"צריכה יומית",hourlyUsage:"צריכה לפי שעה",legendDay:"יום",legendNight:"לילה {w}",legendLeak:"דליפה חשודה",colUsage:"צריכה (מ״ק)",colShare:"חלק",colVsPrev:"לעומת הקודם",vsPrevShort:"לעומת הקודם",night:"לילה",emptyUsage:"אין נתוני צריכה עדיין",loadUsageError:"לא ניתן לטעון את הצריכה",csvDone:"הקובץ הורד",accSearch:"חיפוש חשבון או לקוח",newAccount:"חשבון חדש",tActiveAccounts:"חשבונות פעילים",tPeriodUsage:"צריכה בתקופה",tAmountSoFar:"סכום עד כה",tDrafts:"טיוטות לבדיקה",colAccount:"חשבון",colCustomer:"לקוח",colFormula:"נוסחה",colPeriod:"תקופה",colPeriodUsage:"צריכה בתקופה (מ״ק)",colAmount:"סכום עד כה",colLastBill:"חיוב אחרון",emptyAccounts:"אין חשבונות עדיין",noAccounts:"לא נמצאו חשבונות",loadAccountsError:"לא ניתן לטעון את החשבונות",accounts:"חשבונות",tabStatus:"מצב",tabHistory:"היסטוריה",tabBills:"חיובים",edit:"עריכה",createBill:"יצירת טיוטת חיוב",accDayOf:"יום {d} מתוך {n}",tForecast:"צפי לתקופה",tNextBill:"החיוב הבא",colStartReading:"קריאה בתחילת התקופה",colCurrentReading:"קריאה נוכחית",colContribution:"תרומה",staleNote:"המונה {name} לא מדווח: הצריכה שלו לא נספרת עד שידווח שוב.",customerCard:"כרטיס לקוח",priceCard:"מחיר",waterPrice:"מים למ״ק",sewagePrice:"ביוב למ״ק",incVat:"כולל מע״מ",exVat:"לפני מע״מ",vat:"מע״מ",autoMode:"חיוב אוטומטי",hMeasured:"נמדד",hPartial:"חלקי",hMissing:"חסר",hOpen:"פתוחה",colChange:"שינוי",colSum:"סכום",noHistory:"אין היסטוריה עדיין",noBills:"אין חיובים לחשבון",loadAccountError:"לא ניתן לטעון את החשבון",accFormNew:"חשבון חדש",accFormEdit:"עריכת חשבון",accName:"שם החשבון",accCustomer:"לקוח",accPickCustomer:"בחירת לקוח",accFormula:"נוסחת מונים",accAddPlus:"+ מונה",accAddMinus:"− מונה",accLossPreset:"הפרש כללי (אובדן ודליפות)",accPickMeter:"בחירת מונה",accMainMeter:"מונה ראשי",accTariff:"תעריף",accPeriod:"תקופה",accMonthly:"חודשית",accBimonthly:"דו-חודשית",accAnchorDay:"יום תחילת התקופה",accFirstStart:"תחילת התקופה הראשונה",accAuto:"מצב חיוב אוטומטי",accStatus:"מצב החשבון",accActive:"פעיל",accPaused:"מושהה",accDelete:"מחיקת חשבון",accDeleteBody:"החשבון יימחק. חיובים שהונפקו נשמרים.",errName:"צריך לכתוב שם",errCustomer:"צריך לבחור לקוח",errFormula:"צריך לפחות מונה אחד בסימן +",errTariff:"צריך לבחור תעריף",errDate:"תאריך לא תקין",billSearch:"חיפוש מספר או לקוח",stateFilter:"סינון לפי מצב",tBillDrafts:"טיוטות",tOpenAmount:"ממתינים לתשלום",tPaid:"שולמו",tLate:"באיחור",colNumber:"מספר",colM3:"מ״ק",colTotal:"סה״כ כולל מע״מ",colDue:"לתשלום עד",emptyBills:"אין חיובים עדיין",noBillsFound:"לא נמצאו חיובים",loadBillsError:"לא ניתן לטעון את החיובים",toAccounts:"לחשבונות",bills:"חיובים",billNo:"חיוב {no}",billDraft:"טיוטת חיוב",loadBillError:"לא ניתן לטעון את החיוב",pItem:"פריט",pQty:"כמות",pPrice:"מחיר",pAmount:"סכום",pWater:"מים",pSewage:"ביוב",pSubtotal:"סה״כ לפני מע״מ",pVat:"מע״מ {p}%",pTotal:"סה״כ לתשלום",pPeriod:"תקופה",pCustomerNo:"מספר לקוח",pIssued:"תאריך הנפקה",pDue:"לתשלום עד",pFormula:"מונים",details:"פרטים",log:"יומן",replaces:"מחליף את {no}",replacedBy:"הוחלף בחיוב המתוקן",originAuto:"נוצר אוטומטית",originManual:"נוצר ידנית",source:"מקור",sentOn:"נשלח",paidOn:"שולם",pdf:"PDF",pdfLater:"הפקת PDF לחיוב מים תתווסף בהמשך",aRecalc:"חישוב מחדש",aIssue:"הנפקה",aSent:"סימון כנשלח",aPaid:"סימון כשולם",aCorrect:"תיקון",aVoid:"ביטול חיוב",aDelete:"מחיקת טיוטה",dIssueTitle:"הנפקת חיוב",dIssueBody:"החיוב יקבל מספר. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.",dVoidTitle:"ביטול חיוב",dVoidBody:"החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.",dVoidReason:"סיבת הביטול",dReasonRequired:"צריך לכתוב סיבה",dCorrectTitle:"תיקון חיוב",dCorrectBody:"תיווצר טיוטה מתוקנת. כשהיא תונפק, החיוב המקורי יבוטל אוטומטית.",dCorrectGo:"יצירת טיוטה מתוקנת",dSentTitle:"סימון כנשלח",dSentHow:"אופן משלוח",howEmail:"דוא״ל",howHand:"ביד",howOther:"אחר",dPaidTitle:"סימון כשולם",dPaidRef:"אסמכתה (לא חובה)",dDeleteTitle:"מחיקת טיוטה",dDeleteBody:"הטיוטה תימחק. אפשר ליצור אחרת מעמוד החשבון.",optional:"לא חובה",evCreated:"נוצרה טיוטה",evRecalculated:"חושב מחדש",evIssued:"הונפק",evSent:"סומן כנשלח",evPaid:"סומן כשולם",evVoided:"בוטל",evCorrected:"נוצר תיקון",evDeleted:"נמחק",custSearch:"חיפוש לקוח",newCustomer:"לקוח חדש",colCustNo:"מספר",colAddress:"כתובת / יחידה",colPhone:"טלפון",colEmail:"דוא״ל",colAccounts:"חשבונות",colBalance:"יתרה פתוחה",emptyCustomers:"אין לקוחות עדיין",noCustomers:"לא נמצאו לקוחות",loadCustomersError:"לא ניתן לטעון את הלקוחות",loadCustomerError:"לא ניתן לטעון את הלקוח",cName:"שם הלקוח",cNumber:"מספר לקוח",cTaxId:"ח.פ. / ע.מ. (לא חובה)",cAddress:"כתובת למשלוח החיוב",cPhone:"טלפון",cEmail:"דוא״ל",cNotes:"הערות",cNoAccounts:"אין חשבונות ללקוח",cRecentBills:"חיובים אחרונים",cDelete:"מחיקת לקוח",cDeleteBody:"הלקוח יימחק. חיובים שהונפקו שומרים עותק של פרטיו.",cDeleteRefused:"אי אפשר למחוק לקוח שיש לו חשבונות (מים או חשמל).",cShared:"כרטיס הלקוח משותף עם החשמל",errEmail:"כתובת דוא״ל לא תקינה",errCustNo:"מספר לקוח הוא ספרות בלבד",sTariffs:"תעריפי מים וביוב",sAlerts:"התראות והשהיה",sections:"חלקי ההגדרות",usedBy:"בשימוש ב-{n} חשבונות",newVersion:"גרסה חדשה",newTariff:"תעריף חדש",colFrom:"בתוקף מ-",colWaterM3:"מים למ״ק",colSewageM3:"ביוב למ״ק",colIncVat:"כולל מע״מ",current:"נוכחי",locked:"נעול",tariffName:"שם התעריף",priceMode:"המחיר מוזן",modeEx:"לפני מע״מ",modeInc:"כולל מע״מ",errPrice:"מחיר לא תקין",noTariffs:"אין תעריפים עדיין",loadTariffsError:"לא ניתן לטעון את התעריפים",delVersion:"מחיקת גרסה",shared:"משותף עם החשבון",sharedTitle:"משותף עם החשמל",sharedNote:"מע״מ, פרטי העסק, מספור, תנאי תשלום ושמירת נתונים - מהגדרות החיוב של החשמל.",vatInForce:"מע״מ בתוקף",toShared:"להגדרות החיוב המשותפות",snoozeCard:"השהיית התראה (נדנוד)",snoozeDurations:"משכי נדנוד מוצעים",snoozeAddValue:"משך להוספה",snoozeUnit:"יחידה",uMin:"דקות",uHour:"שעות",uDay:"ימים",snoozeDefault:"ברירת מחדל של כפתור «נדנוד»",snoozeMax:"נדנוד מרבי",removeDuration:"הסרת {d}",keepOne:"חייב להישאר לפחות משך אחד",saved:"נשמר",rulesCard:"כללי דליפה",rWindow:"חלון לילה",rThreshold:"סף",rDuration:"משך",rulesReadonly:"הכללים נשארים כפי שאושרו ואינם משתנים כאן.",noConfigure:"שינוי ההגדרות זמין למנהלי מערכת",conflict:"מישהו אחר שינה בינתיים. הנתונים רועננו, נסו שוב.",hours:"{n} שעות",hour1:"שעה",hours2:"שעתיים",minutes:"{n} דקות"},Be={tab:"Water",pageRow:"Pages",offTitle:"The module is off",offHint:"Water meters are switched on in the system settings",toSettings:"To settings",forbidden:"No permission",noScreen:"No screen",retry:"Try again",cancel:"Cancel",save:"Save",back:"Back",close:"Close",remove:"Remove",add:"Add",loading:"Loading",csv:"Export CSV",m3:"m³",litre:"L",lph:"L/h",ils:"₪",search:"Search meter",view:"View",cards:"Cards",table:"Table",addMeter:"Add meter",allAreas:"All areas",areas:"Areas",fold:"Collapse",unfold:"Expand",area:"Area",tToday:"Today",tMonth:"Month to date",tReporting:"Reporting",tOf:"of {n}",tLeak:"Suspected leak",tMeters:"meters",colName:"Name",colArea:"Area",colReading:"Current reading (m³)",colToday:"Today",colMonth:"Month to date",colNight:"Night flow",colState:"State",todayM3:"m³ today",nightOff:"Off",emptyMeters:"No meters yet",noResults:"No meters found",loadMetersError:"The meters could not be loaded",stReporting:"Reporting",stNotReporting:"Not reporting",stNotReportingSince:"Not reporting since {t}",stPaused:"Paused",stRetired:"Retired",stLeak:"Suspected leak",stAbnormal:"Abnormal use",addTitle:"Add meter",candSearch:"Search sensors by name",candNone:"No suitable sensors found",candRejected:"Not suitable",meterName:"Meter name",meterKind:"Kind",added:"The meter was added",kMain:"Main",kSub:"Sub-meter",kIrrigation:"Irrigation",kCooling:"Cooling",kPool:"Pool",kOther:"Other",cardLoadError:"The meter could not be loaded",fArea:"Area",fReading:"Current reading",fLast:"Last report",fUnit:"Unit",fUnitValue:"m³ · cumulative meter",fKind:"Kind",fNight:"Night flow",fNightOff:"Night rule off (irrigation)",fRules:"Leak rules",fRulesDefault:"System default · night {w}",fRulesOwn:"Meter rules · night {w}",usage:"Consumption",range:"Range",r24h:"24 hours",r30d:"30 days",r12m:"12 months",chartAria:"Consumption chart, {r}",chartError:"The consumption chart could not be loaded",chartNoData:"No data for the period",nightNote:"L/h · the night window {w} is highlighted",openAlerts:"Open alerts",epochs:"Counter lives",epochStart:"Start reading",epochUntil:"until",epochActive:"Active",reasonFirst:"Installation",reasonReplaced:"Meter replaced",reasonSource:"Source changed",readings:"Manual readings",manualReading:"Manual reading",noReadings:"No manual readings",readingAt:"Read at",readingValue:"Reading",readingNote:"Note (optional)",readingSaved:"The reading was saved",readingUndo:"Undo reading",readingVoided:"Undone",effAllocation:"Reporting gap filled",effRecorded:"Kept for comparison",rename:"Rename",renameTitle:"Rename the meter",replace:"Replace meter",replaceFinal:"Final reading of the old meter",replaceStart:"Start reading of the new meter",replaceNote:"Note (optional)",replaceBad:"Enter a valid reading",pause:"Pause",resume:"Resume",removeTitle:"Remove the meter",removeBody:"The meter leaves the list. The collected data is kept.",nameRequired:"Write a name for the meter",ack:"Acknowledge",acked:"The alert was acknowledged",snooze:"Snooze {d}",snoozeOther:"Other snooze duration",snoozeTo:"Snooze for...",snoozeUntil:"until {t}",snoozedUntil:"Snoozed until {t}",snoozedToast:"Snoozed for {d} (until {t})",snoozeFoot:"The durations are set in settings",unsnooze:"End snooze",fOpen:"Open",fAll:"All",filter:"Filter",leakRules:"Leak rules",tOpen:"Open",tClosedWeek:"Closed this week",tSnoozed:"Snoozed",tRule:"Leak rules",ruleValue:"{lph} L/h · {dur}",colMeter:"Meter",colKind:"Kind",colSince:"Since",colValue:"Value",akNight:"Leak · continuous night flow",akBurst:"Burst",akAbnormal:"Abnormal use",akOffline:"Not reporting",akHealth:"Meter fault",asOpen:"Open",asAcked:"Acknowledged · {who}",asClosed:"Closed",asClosedBy:"Closed · {who}",valueRate:"{v} L/h",valueRateTh:"{v} L/h (threshold {t})",valueAbnormal:"{v} m³, usual {m}",emptyAlerts:"No alerts",loadAlertsError:"The alerts could not be loaded",rToday:"Today",r7d:"7 days",rPrevMonth:"Previous month",tTotal:"Total in range",tVsPrev:"Versus the previous period",tDailyAvg:"Daily average",tNightAvg:"Average night flow",dailyUsage:"Daily consumption",hourlyUsage:"Hourly consumption",legendDay:"Day",legendNight:"Night {w}",legendLeak:"Suspected leak",colUsage:"Consumption (m³)",colShare:"Share",colVsPrev:"Versus previous",vsPrevShort:"vs previous",night:"night",emptyUsage:"No consumption data yet",loadUsageError:"The consumption could not be loaded",csvDone:"The file was downloaded",accSearch:"Search account or customer",newAccount:"New account",tActiveAccounts:"Active accounts",tPeriodUsage:"Consumption in period",tAmountSoFar:"Amount so far",tDrafts:"Drafts to review",colAccount:"Account",colCustomer:"Customer",colFormula:"Formula",colPeriod:"Period",colPeriodUsage:"Consumption in period (m³)",colAmount:"Amount so far",colLastBill:"Last bill",emptyAccounts:"No accounts yet",noAccounts:"No accounts found",loadAccountsError:"The accounts could not be loaded",accounts:"Accounts",tabStatus:"Status",tabHistory:"History",tabBills:"Bills",edit:"Edit",createBill:"Create a draft bill",accDayOf:"Day {d} of {n}",tForecast:"Period forecast",tNextBill:"Next bill",colStartReading:"Reading at period start",colCurrentReading:"Current reading",colContribution:"Contribution",staleNote:"The meter {name} is not reporting: its consumption is not counted until it reports again.",customerCard:"Customer card",priceCard:"Price",waterPrice:"Water per m³",sewagePrice:"Sewage per m³",incVat:"Incl. VAT",exVat:"Excl. VAT",vat:"VAT",autoMode:"Automatic billing",hMeasured:"Measured",hPartial:"Partial",hMissing:"Missing",hOpen:"Open",colChange:"Change",colSum:"Amount",noHistory:"No history yet",noBills:"No bills for the account",loadAccountError:"The account could not be loaded",accFormNew:"New account",accFormEdit:"Edit account",accName:"Account name",accCustomer:"Customer",accPickCustomer:"Choose a customer",accFormula:"Meter formula",accAddPlus:"+ meter",accAddMinus:"− meter",accLossPreset:"Overall difference (losses and leaks)",accPickMeter:"Choose a meter",accMainMeter:"Main meter",accTariff:"Tariff",accPeriod:"Period",accMonthly:"Monthly",accBimonthly:"Every two months",accAnchorDay:"Period start day",accFirstStart:"First period starts",accAuto:"Automatic bill mode",accStatus:"Account state",accActive:"Active",accPaused:"Paused",accDelete:"Delete account",accDeleteBody:"The account is deleted. Issued bills are kept.",errName:"Write a name",errCustomer:"Choose a customer",errFormula:"At least one meter with a + sign is needed",errTariff:"Choose a tariff",errDate:"Invalid date",billSearch:"Search number or customer",stateFilter:"Filter by state",tBillDrafts:"Drafts",tOpenAmount:"Awaiting payment",tPaid:"Paid",tLate:"Overdue",colNumber:"Number",colM3:"m³",colTotal:"Total incl. VAT",colDue:"Due",emptyBills:"No bills yet",noBillsFound:"No bills found",loadBillsError:"The bills could not be loaded",toAccounts:"To accounts",bills:"Bills",billNo:"Bill {no}",billDraft:"Draft bill",loadBillError:"The bill could not be loaded",pItem:"Item",pQty:"Quantity",pPrice:"Price",pAmount:"Amount",pWater:"Water",pSewage:"Sewage",pSubtotal:"Subtotal excl. VAT",pVat:"VAT {p}%",pTotal:"Total to pay",pPeriod:"Period",pCustomerNo:"Customer number",pIssued:"Issue date",pDue:"Due",pFormula:"Meters",details:"Details",log:"Log",replaces:"Replaces {no}",replacedBy:"Replaced by the corrected bill",originAuto:"Created automatically",originManual:"Created manually",source:"Origin",sentOn:"Sent",paidOn:"Paid",pdf:"PDF",pdfLater:"A PDF of a water bill comes later",aRecalc:"Recalculate",aIssue:"Issue",aSent:"Mark sent",aPaid:"Mark paid",aCorrect:"Correct",aVoid:"Void bill",aDelete:"Delete draft",dIssueTitle:"Issue the bill",dIssueBody:"The bill gets a number. After issuing it cannot be edited, only voided or corrected.",dVoidTitle:"Void the bill",dVoidBody:"The bill stays in the list as void. The number is never reused.",dVoidReason:"Reason",dReasonRequired:"Write a reason",dCorrectTitle:"Correct the bill",dCorrectBody:"A corrected draft is created. When it is issued, the original bill is voided automatically.",dCorrectGo:"Create a corrected draft",dSentTitle:"Mark as sent",dSentHow:"Sent by",howEmail:"E-mail",howHand:"By hand",howOther:"Other",dPaidTitle:"Mark as paid",dPaidRef:"Reference (optional)",dDeleteTitle:"Delete the draft",dDeleteBody:"The draft is deleted. Another one can be created from the account page.",optional:"Optional",evCreated:"Draft created",evRecalculated:"Recalculated",evIssued:"Issued",evSent:"Marked sent",evPaid:"Marked paid",evVoided:"Voided",evCorrected:"Correction created",evDeleted:"Deleted",custSearch:"Search customer",newCustomer:"New customer",colCustNo:"Number",colAddress:"Address / unit",colPhone:"Phone",colEmail:"E-mail",colAccounts:"Accounts",colBalance:"Open balance",emptyCustomers:"No customers yet",noCustomers:"No customers found",loadCustomersError:"The customers could not be loaded",loadCustomerError:"The customer could not be loaded",cName:"Customer name",cNumber:"Customer number",cTaxId:"Company / VAT id (optional)",cAddress:"Billing address",cPhone:"Phone",cEmail:"E-mail",cNotes:"Notes",cNoAccounts:"The customer has no accounts",cRecentBills:"Recent bills",cDelete:"Delete customer",cDeleteBody:"The customer is deleted. Issued bills keep a copy of the details.",cDeleteRefused:"A customer with accounts (water or electricity) cannot be deleted.",cShared:"The customer card is shared with electricity",errEmail:"Invalid e-mail address",errCustNo:"A customer number is digits only",sTariffs:"Water and sewage tariffs",sAlerts:"Alerts and snooze",sections:"Settings sections",usedBy:"Used by {n} accounts",newVersion:"New version",newTariff:"New tariff",colFrom:"In force from",colWaterM3:"Water per m³",colSewageM3:"Sewage per m³",colIncVat:"Incl. VAT",current:"Current",locked:"Locked",tariffName:"Tariff name",priceMode:"Prices entered",modeEx:"Excl. VAT",modeInc:"Incl. VAT",errPrice:"Invalid price",noTariffs:"No tariffs yet",loadTariffsError:"The tariffs could not be loaded",delVersion:"Delete version",shared:"Shared with the account",sharedTitle:"Shared with electricity",sharedNote:"VAT, business details, numbering, payment terms and retention come from the electricity billing settings.",vatInForce:"VAT in force",toShared:"To the shared billing settings",snoozeCard:"Alert snooze",snoozeDurations:"Offered snooze durations",snoozeAddValue:"Duration to add",snoozeUnit:"Unit",uMin:"minutes",uHour:"hours",uDay:"days",snoozeDefault:"Default of the «snooze» button",snoozeMax:"Maximum snooze",removeDuration:"Remove {d}",keepOne:"At least one duration must remain",saved:"Saved",rulesCard:"Leak rules",rWindow:"Night window",rThreshold:"Threshold",rDuration:"Duration",rulesReadonly:"The rules stay as approved and are not changed here.",noConfigure:"Changing the settings is for system administrators",conflict:"Someone else changed this meanwhile. The data was refreshed, try again.",hours:"{n} hours",hour1:"an hour",hours2:"two hours",minutes:"{n} minutes"};function ie(){return(typeof document<"u"?(document.documentElement?.lang||"").toLowerCase():"").startsWith("en")?"en":"he"}const xs={he:ae,en:Be};function s(t,e,a=ie()){const r=xs[a][t]??ae[t]??t;return e?r.replace(/\{(\w+)\}/g,(i,o)=>o in e?String(e[o]):i):r}Ke("water/i18n",{he:ae,en:Be});var Ss=Object.defineProperty,As=Object.getOwnPropertyDescriptor,x=(t,e,a,r)=>{for(var i=r>1?void 0:r?As(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ss(e,a,i),i};const T="/infra/water/accounts",Yt=t=>n`<span class="chip ${t.cls}">${t.label}</span>`,It=t=>n`<span class="chip ${kt[t.state].cls}" data-bill-state=${t.state}>${kt[t.state].label}</span>`,Ft=t=>t?`${J(t.from)} - ${J(t.to)}`:"-",Nt=(t=6)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`,Cs=()=>new Date().toISOString().slice(0,10),zs=()=>`${Cs().slice(0,8)}01`,fe=()=>({name:"",customer_id:"",terms:[{sign:1,meter_id:""}],keepAst:null,tariff_id:"",period_months:1,period_anchor_day:1,first_period_start:zs(),auto_mode:"draft",status:"active"});let _=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.st="loading",this.rows=[],this.drafts=null,this.statuses={},this.q="",this.acc=null,this.accSt="loading",this.status=null,this.history=null,this.bills=null,this.error="",this.busy=!1,this.form=fe(),this.errs={},this.customers=[],this.tariffs=[],this.meters=[],this.confirmDel=!1,this.shown=""}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t)}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const[e,a]=this.segments,r=`${e??""}/${a??""}`;if(r===this.shown)return;const i=this.shown.split("/")[0];this.shown=r,this.error="",this.errs={},this.confirmDel=!1,e?e==="new"?this.openForm(null):((e!==i||!this.acc)&&this.loadAccount(e),a==="edit"&&this.openForm(e),a==="history"&&!this.history&&this.loadHistory(e),a==="bills"&&!this.bills&&this.access.bills&&this.loadBills(e)):this.loadList()}async loadList(){this.st="loading";try{const t=await v.listAccounts();this.rows=t.items,this.drafts=t.summary.drafts,this.st="ready";const e={};await Promise.all(t.items.slice(0,60).map(async a=>e[a.id]=await v.accountStatus(a.id).catch(()=>null))),this.statuses=e}catch{this.st="error"}}async loadAccount(t){this.accSt="loading",this.history=null,this.bills=null;try{const[e,a]=await Promise.all([v.account(t),v.accountStatus(t).catch(()=>null)]);this.acc=e,this.status=a,this.accSt="ready";const r=this.segments[1];r==="history"&&this.loadHistory(t),r==="bills"&&this.access.bills&&this.loadBills(t)}catch(e){this.error=N(e),this.accSt="error"}}async loadHistory(t){try{this.history=(await v.accountHistory(t)).periods}catch{this.history=[]}}async loadBills(t){try{this.bills=(await v.accountBills(t)).items}catch{this.bills=[]}}async openForm(t){this.errs={},this.error="",t||(this.form=fe());const[e,a,r]=await Promise.all([v.listCustomers().then(i=>i.items).catch(()=>[]),v.listTariffs().then(i=>i.items).catch(()=>[]),w.listMeters().catch(()=>[])]);if(this.customers=e,this.tariffs=a,this.meters=r.filter(i=>i.status!=="retired"),t){const i=this.acc?.id===t?this.acc:await v.account(t).catch(()=>null);if(i){const o=Zt(i.formula.ast);this.form={name:i.name,customer_id:i.customer?.id??"",terms:o??[],keepAst:o?null:i.formula.ast,tariff_id:i.tariff.id,period_months:i.period_months,period_anchor_day:i.period_anchor_day,first_period_start:i.first_period_start,auto_mode:i.auto_mode,status:i.status}}}else!this.form.tariff_id&&a.length===1&&(this.form={...this.form,tariff_id:a[0].id})}setF(t,e){this.form={...this.form,[t]:e},this.errs[t]&&(this.errs={...this.errs,[t]:""})}setTerm(t,e){const a=this.form.terms.map((r,i)=>i===t?{...r,...e}:r);this.form={...this.form,terms:a,keepAst:null},this.errs={...this.errs,formula:""}}async lossPreset(){const t=this.form.terms.find(e=>e.sign>0&&e.meter_id)?.meter_id??this.meters.find(e=>e.kind==="main")?.id??this.meters[0]?.id;if(t)try{const e=await v.preset("main_minus_subs",this.meters.map(r=>r.id),t),a=Zt(e.ast);a&&(this.form={...this.form,terms:a,keepAst:null,name:this.form.name||s("accLossPreset")})}catch(e){this.error=N(e)}}validate(){const t=this.form,e={};return t.name.trim()||(e.name=s("errName")),t.customer_id||(e.customer_id=s("errCustomer")),!t.keepAst&&!me(t.terms)&&(e.formula=s("errFormula")),t.tariff_id||(e.tariff_id=s("errTariff")),/^\d{4}-\d{2}-\d{2}$/.test(t.first_period_start)||(e.first_period_start=s("errDate")),this.errs=e,!Object.keys(e).length}async save(t){if(this.busy||!this.validate())return;const e=this.form,a={name:e.name.trim(),customer_id:e.customer_id,tariff_id:e.tariff_id,period_months:e.period_months,period_anchor_day:e.period_anchor_day,first_period_start:e.first_period_start,auto_mode:e.auto_mode,...e.keepAst?{}:{formula:{ast:me(e.terms)}}};this.busy=!0,this.error="";try{if(t&&this.acc){const r=await v.updateAccount(t,{...a,status:e.status,base_revision:this.acc.revision});this.acc=r,b(`${T}/${r.id}`),this.loadAccount(r.id)}else{const r=await v.createAccount(a);b(`${T}/${r.id}`)}}catch(r){this.error=N(r)}finally{this.busy=!1}}async removeRecord(){if(!(!this.acc||this.busy)){this.busy=!0;try{await v.deleteAccount(this.acc.id,this.acc.revision),this.acc=null,b(T)}catch(t){this.error=N(t),this.confirmDel=!1}finally{this.busy=!1}}}fld(t,e,a,r=!1){return n`<div class="fld ${r?"wide":""}"><label for="wa-${t}">${e}</label>${a}${this.errs[t]?n`<div class="msg" role="alert" data-field-error=${t}>${this.errs[t]}</div>`:d}</div>`}renderForm(t){const e=this.form,a=r=>n`<option value="" ?selected=${!r}>${s("accPickMeter")}</option>${this.meters.map(i=>n`<option value=${i.id} ?selected=${i.id===r}>${i.display_name}</option>`)}`;return n`<sw-sheet open wide .heading=${s(t?"accFormEdit":"accFormNew")} data-account-form @close=${()=>b(t?`${T}/${t}`:T)}>
      <div class="col">
        <div class="formgrid">
          ${this.fld("name",s("accName"),n`<input id="wa-name" name="name" class=${this.errs.name?"err":""} .value=${e.name} @input=${r=>this.setF("name",r.target.value)} />`,!0)}
          ${this.fld("customer_id",s("accCustomer"),n`<select id="wa-customer_id" name="customer_id" @change=${r=>this.setF("customer_id",r.target.value)}><option value="" ?selected=${!e.customer_id}>${s("accPickCustomer")}</option>${this.customers.map(r=>n`<option value=${r.id} ?selected=${r.id===e.customer_id}>${r.name} · ${r.customer_number}</option>`)}</select>`)}
          ${this.fld("tariff_id",s("accTariff"),n`<select id="wa-tariff_id" name="tariff_id" @change=${r=>this.setF("tariff_id",r.target.value)}><option value="" ?selected=${!e.tariff_id}>-</option>${this.tariffs.map(r=>n`<option value=${r.id} ?selected=${r.id===e.tariff_id}>${r.name}</option>`)}</select>`)}
        </div>
        <div class="fld"><span class="lbl">${s("accFormula")}</span>
          ${e.keepAst&&this.acc?n`<div class="mut" data-formula-kept>${this.acc.formula.sentence_he}</div>`:d}
          <div class="list" data-formula-terms>${e.terms.map((r,i)=>n`<div class="row" style="flex-wrap:nowrap" data-term=${i}>
            <div class="seg" role="group" aria-label=${s("accFormula")}><button type="button" aria-pressed=${r.sign>0?"true":"false"} data-sign="+" @click=${()=>this.setTerm(i,{sign:1})}>+</button><button type="button" aria-pressed=${r.sign<0?"true":"false"} data-sign="-" @click=${()=>this.setTerm(i,{sign:-1})}>−</button></div>
            <select aria-label=${s("accPickMeter")} style="flex:1" @change=${o=>this.setTerm(i,{meter_id:o.target.value})}>${a(r.meter_id)}</select>
            <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("remove")} @click=${()=>this.form={...this.form,terms:e.terms.filter((o,l)=>l!==i),keepAst:null}}></sw-button></div>`)}</div>
          <div class="row">
            <sw-button size="sm" data-add-plus @click=${()=>this.form={...e,terms:[...e.terms,{sign:1,meter_id:""}],keepAst:null}}>${s("accAddPlus")}</sw-button>
            <sw-button size="sm" data-add-minus @click=${()=>this.form={...e,terms:[...e.terms,{sign:-1,meter_id:""}],keepAst:null}}>${s("accAddMinus")}</sw-button>
            <span class="sp"></span>
            <sw-button size="sm" data-loss-preset ?disabled=${!this.meters.length} @click=${()=>void this.lossPreset()}>${s("accLossPreset")}</sw-button></div>
          ${this.errs.formula?n`<div class="msg" role="alert" data-field-error="formula">${this.errs.formula}</div>`:d}</div>
        <div class="formgrid">
          <div class="fld"><span class="lbl">${s("accPeriod")}</span><div class="seg" role="group" aria-label=${s("accPeriod")}>
            <button type="button" aria-pressed=${e.period_months===1?"true":"false"} @click=${()=>this.setF("period_months",1)}>${s("accMonthly")}</button>
            <button type="button" aria-pressed=${e.period_months===2?"true":"false"} @click=${()=>this.setF("period_months",2)}>${s("accBimonthly")}</button></div></div>
          ${this.fld("period_anchor_day",s("accAnchorDay"),n`<input id="wa-period_anchor_day" type="number" min="1" max="31" class="ltr" .value=${String(e.period_anchor_day)} @input=${r=>this.setF("period_anchor_day",Math.min(31,Math.max(1,Number(r.target.value)||1)))} />`)}
          ${this.fld("first_period_start",s("accFirstStart"),n`<input id="wa-first_period_start" type="date" lang=${Me()} class="ltr ${this.errs.first_period_start?"err":""}" .value=${e.first_period_start} @change=${r=>this.setF("first_period_start",r.target.value)} />`)}
          ${this.fld("auto_mode",s("accAuto"),n`<select id="wa-auto_mode" @change=${r=>this.setF("auto_mode",r.target.value)}>${["off","draft","issue"].map(r=>n`<option value=${r} ?selected=${r===e.auto_mode}>${he[r]}</option>`)}</select>`)}
          ${t?n`<div class="fld"><span class="lbl">${s("accStatus")}</span><div class="seg" role="group" aria-label=${s("accStatus")}>
            <button type="button" aria-pressed=${e.status==="active"?"true":"false"} @click=${()=>this.setF("status","active")}>${s("accActive")}</button>
            <button type="button" aria-pressed=${e.status==="paused"?"true":"false"} @click=${()=>this.setF("status","paused")}>${s("accPaused")}</button></div></div>`:d}
        </div>
        ${this.error?n`<div class="alert err" role="alert">${this.error}</div>`:d}
        <div class="row formacts"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save(t)}>${s("save")}</sw-button>
          <sw-button @click=${()=>b(t?`${T}/${t}`:T)}>${s("cancel")}</sw-button><span class="sp"></span>
          ${t?n`<sw-button variant="danger" data-delete @click=${()=>this.confirmDel=!0}>${s("accDelete")}</sw-button>`:d}</div>
      </div>
      <elec-dialog heading=${s("accDelete")} ?open=${this.confirmDel} data-dialog="delete-account" @close=${()=>this.confirmDel=!1}>
        <div>${s("accDeleteBody")}</div>
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeRecord()}>${s("accDelete")}</sw-button>
        <sw-button slot="actions" @click=${()=>this.confirmDel=!1}>${s("cancel")}</sw-button>
      </elec-dialog>
    </sw-sheet>`}renderList(){const t=this.access.bills,e=this.q.trim(),a=this.rows.filter(h=>!e||h.name.includes(e)||(h.customer?.name??"").includes(e)),r=n`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-acc-search placeholder=${s("accSearch")} aria-label=${s("accSearch")} .value=${this.q} @input=${h=>this.q=h.target.value} /></label>
      <span class="sp"></span>
      ${this.access.manage?n`<sw-button variant="primary" icon="plus" data-new-account @click=${()=>b(`${T}/new`)}>${s("newAccount")}</sw-button>`:d}
    </div>`;if(this.st==="loading")return n`<div class="page" data-water="accounts" data-state="loading">${r}${Nt()}</div>`;if(this.st==="error")return n`<div class="page" data-water="accounts" data-state="error"><sw-state-panel state="error" heading=${s("loadAccountsError")} actionLabel=${s("retry")} @action=${()=>void this.loadList()}></sw-state-panel></div>`;if(!this.rows.length)return n`<div class="page" data-water="accounts" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${s("emptyAccounts")}>${this.access.manage?n`<sw-button variant="primary" data-new-account @click=${()=>b(`${T}/new`)}>${s("newAccount")}</sw-button>`:d}</sw-state-panel></div>`;const i=this.statuses,o=this.rows.reduce((h,O)=>h+Number(i[O.id]?.m3_so_far??0),0),l=this.rows.reduce((h,O)=>h+Number(i[O.id]?.amount_so_far??0),0),u=n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tActiveAccounts")}</div><div class="v"><span class="num">${this.rows.filter(h=>h.status==="active").length}</span></div></div>
      <div class="tile"><div class="k">${s("tPeriodUsage")}</div><div class="v"><span class="num">${y(o)}</span><span class="u">${s("m3")}</span></div></div>
      ${t?n`<div class="tile"><div class="k">${s("tAmountSoFar")}</div><div class="v"><span class="num">${k(l).replace(" ₪","")}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${s("tDrafts")}</div><div class="v"><span class="num">${this.drafts??0}</span></div></div>`:d}
    </div>`,f=h=>h.last_bill?n`${h.last_bill.number?n`<span class="num">${h.last_bill.number}</span>`:s("tBillDrafts")} ${It(h.last_bill)}`:n`<span class="mut">-</span>`,p=a.length?n`<div class="card flush scrollx desk-only"><table class="t" data-acc-table>
          <thead><tr><th>${s("colAccount")}</th><th>${s("colCustomer")}</th><th class="hide-tablet">${s("colFormula")}</th><th>${s("colPeriod")}</th><th class="n">${s("colPeriodUsage")}</th>${t?n`<th class="n">${s("colAmount")}</th><th>${s("colLastBill")}</th>`:d}<th>${s("colState")}</th></tr></thead>
          <tbody>${a.map(h=>n`<tr class="go" data-account-row=${h.id} @click=${()=>b(`${T}/${h.id}`)}>
            <td class="b"><a class="rowlink" href=${`#${T}/${h.id}`} @click=${O=>O.stopPropagation()}>${h.name}</a></td><td>${h.customer?.name??"-"}</td>
            <td class="mut ell hide-tablet">${h.formula.sentence_he}</td><td>${pe(h.period_months,h.period_anchor_day)}</td>
            <td class="n"><span class="num">${y(i[h.id]?.m3_so_far??null)}</span></td>
            ${t?n`<td class="n"><span class="num">${i[h.id]?.amount_so_far!==void 0?k(i[h.id]?.amount_so_far):""}</span></td><td>${f(h)}</td>`:d}
            <td>${Yt(Kt(h))}</td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-acc-rows>${a.map(h=>n`<a class="li" href=${`#${T}/${h.id}`} data-account-row=${h.id}>
          <div class="grow"><div class="t1">${h.name}</div><div class="t2">${h.customer?.name??""} · <span class="num">${y(i[h.id]?.m3_so_far??null)}</span> ${s("m3")}${t&&i[h.id]?.amount_so_far?n` · <span class="num">${k(i[h.id]?.amount_so_far)}</span>`:d}</div></div>${Yt(Kt(h))}</a>`)}</div>`:n`<sw-state-panel icon="search" state="empty" compact heading=${s("noAccounts")}></sw-state-panel>`;return n`<div class="page" data-water="accounts" data-state="ready">${r}${u}${p}</div>`}renderStatus(t){const e=this.status,a=this.access.bills,r=n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tPeriodUsage")}</div><div class="v"><span class="num">${y(e?.m3_so_far??null)}</span><span class="u">${s("m3")}</span></div></div>
      <div class="tile"><div class="k">${s("colPeriod")}</div><div class="v"><span class="num" style="font-size:var(--sw-fs-md)">${e?.day_of_period&&e.days?s("accDayOf",{d:e.day_of_period,n:e.days}):"-"}</span></div></div>
      <div class="tile"><div class="k">${s("tForecast")}</div><div class="v"><span class="num">${y(e?.m3_forecast??null)}</span><span class="u">${s("m3")}</span></div></div>
      ${a?n`<div class="tile"><div class="k">${s("tAmountSoFar")}</div><div class="v"><span class="num">${e?.amount_so_far?k(e.amount_so_far).replace(" ₪",""):"-"}</span><span class="u">₪</span></div></div>`:d}
    </div>`,i=n`<div class="card flush scrollx" data-acc-meters><table class="t">
      <thead><tr><th>${s("colMeter")}</th><th class="n">${s("colStartReading")}</th><th class="n">${s("colCurrentReading")}</th><th class="n">${s("colUsage")}</th><th class="n">${s("colContribution")}</th></tr></thead>
      <tbody>${(e?.meters??[]).map(u=>n`<tr data-acc-meter=${u.meter_id}><td class="b">${Number(u.coefficient)<0?"− ":""}${u.name}${u.reporting?d:n` <span class="chip c-warn">${s("stNotReporting")}</span>`}</td>
        <td class="n"><span class="num">${y(u.start_m3)}</span></td><td class="n"><span class="num">${y(u.current_m3)}</span></td><td class="n"><span class="num">${y(u.consumption_m3)}</span></td><td class="n"><span class="num">${y(u.contribution_m3)}</span></td></tr>`)}</tbody></table></div>`,o=t.tariff,l=n`<div class="col">
      <div class="card"><div class="hd"><b>${s("customerCard")}</b></div><dl class="kv"><dt>${s("cName")}</dt><dd>${t.customer?.name??"-"}</dd><dt>${s("cNumber")}</dt><dd class="num">${t.customer?.customer_number??"-"}</dd>${t.customer?.address?n`<dt>${s("cAddress")}</dt><dd>${t.customer.address}</dd>`:d}</dl></div>
      <div class="card"><div class="hd"><b>${s("priceCard")}</b></div><dl class="kv"><dt>${s("accTariff")}</dt><dd>${o.name}</dd>
        ${a&&o.water_price!=null?n`<dt>${s("waterPrice")}</dt><dd class="num">${k(o.water_price)}</dd><dt>${s("sewagePrice")}</dt><dd class="num">${k(o.sewage_price)}</dd><dt>${s("colIncVat")}</dt><dd class="num">${o.price_inc_vat?k(o.price_inc_vat):"-"}</dd>`:d}
        <dt>${s("autoMode")}</dt><dd>${he[t.auto_mode]}</dd></dl></div>
      <div class="card"><div class="hd"><b>${s("tNextBill")}</b></div><dl class="kv"><dt>${s("colPeriod")}</dt><dd class="num">${Ft(t.next_period)}</dd><dt>${s("accPeriod")}</dt><dd>${pe(t.period_months,t.period_anchor_day)}</dd></dl></div>
    </div>`;return n`${r}${(e?.stale??[]).map(u=>n`<div class="alert warn" role="status"><span class="x" aria-hidden="true">!</span><div>${s("staleNote",{name:u.name})}</div></div>`)}<div class="cols side"><div class="col"><div class="mut">${t.formula.sentence_he}</div>${i}</div>${l}</div>`}renderHistory(){const t=this.history;if(!t)return Nt(4);if(!t.length)return n`<sw-state-panel icon="history" state="empty" compact heading=${s("noHistory")}></sw-state-panel>`;const e={measured:s("hMeasured"),partial:s("hPartial"),missing:s("hMissing"),open:s("hOpen")};return n`<div class="card flush scrollx" data-acc-history><table class="t"><thead><tr><th>${s("colPeriod")}</th><th class="n">${s("colM3")}</th><th class="n">${s("colChange")}</th><th>${s("colState")}</th>${this.access.bills?n`<th class="n">${s("colSum")}</th>`:d}</tr></thead>
      <tbody>${t.map((a,r)=>{const i=t[r+1]?.m3,o=a.m3!==null&&i?Math.round((Number(a.m3)-Number(i))/Number(i)*100):null;return n`<tr><td class="num" style="text-align:start">${Ft(a)}</td><td class="n"><span class="num">${y(a.m3)}</span></td><td class="n ${o===null||o===0?"":o>0?"up":"down"}"><span class="num">${o===null?"-":`${o>0?"+":""}${o}%`}</span></td>
          <td>${e[a.status]}</td>${this.access.bills?n`<td class="n"><span class="num">${a.bill?.total?k(a.bill.total):"-"}</span></td>`:d}</tr>`})}</tbody></table></div>`}renderBills(){if(!this.access.bills)return n`<sw-state-panel state="forbidden" compact></sw-state-panel>`;const t=this.bills;return t?t.length?re(t,!1):n`<sw-state-panel icon="list" state="empty" compact heading=${s("noBills")}></sw-state-panel>`:Nt(4)}async createDraft(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await v.createBill(t.id);b(`/infra/water/bills/${e.id}`)}catch(e){this.error=N(e)}finally{this.busy=!1}}}renderAccount(t,e){if(this.accSt==="loading"&&this.acc?.id!==t)return n`<div class="page" data-water="account" data-state="loading">${Nt(5)}</div>`;if(this.accSt==="error"||!this.acc)return n`<div class="page" data-water="account" data-state="error"><div class="backrow"><a class="btn ghost sm" href=${`#${T}`}><sw-icon name="chevronBack" size="13"></sw-icon>${s("accounts")}</a></div>
        <sw-state-panel state="error" heading=${s("loadAccountError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.loadAccount(t)}></sw-state-panel></div>`;const a=this.acc,r=e==="history"||e==="bills"?e:"status";return n`<div class="page" data-water="account" data-state="ready" data-account-id=${a.id}>
      <div class="backrow"><a class="btn ghost sm" href=${`#${T}`} data-back><sw-icon name="chevronBack" size="13"></sw-icon>${s("accounts")}</a><b class="h3">${a.name}</b>${Yt(Kt(a))}<span class="sp"></span>
        ${this.access.bills?n`<sw-button data-create-bill ?disabled=${this.busy} @click=${()=>void this.createDraft(a)}>${s("createBill")}</sw-button>`:d}
        ${this.access.manage?n`<sw-button icon="edit" data-edit @click=${()=>b(`${T}/${a.id}/edit`)}>${s("edit")}</sw-button>`:d}</div>
      <div class="seg" role="group" aria-label=${s("accounts")} data-acc-tabs style="align-self:flex-start">
        <button type="button" aria-pressed=${r==="status"?"true":"false"} @click=${()=>b(`${T}/${a.id}`)}>${s("tabStatus")}</button>
        <button type="button" aria-pressed=${r==="history"?"true":"false"} @click=${()=>b(`${T}/${a.id}/history`)}>${s("tabHistory")}</button>
        ${this.access.bills?n`<button type="button" aria-pressed=${r==="bills"?"true":"false"} @click=${()=>b(`${T}/${a.id}/bills`)}>${s("tabBills")}</button>`:d}</div>
      ${this.error&&!this.segments.includes("edit")?n`<div class="alert err" role="alert">${this.error}</div>`:d}
      ${r==="status"?this.renderStatus(a):r==="history"?this.renderHistory():this.renderBills()}
    </div>`}render(){if(!this.access.view)return n`<sw-state-panel state="forbidden" data-water="accounts" data-state="forbidden"></sw-state-panel>`;const[t,e]=this.segments;return t?t==="new"?n`${this.renderList()}${this.access.manage?this.renderForm(null):d}`:n`${this.renderAccount(t,e??"")}${e==="edit"&&this.access.manage?this.renderForm(t):d}`:this.renderList()}};_.styles=[rt,et];x([M({attribute:!1})],_.prototype,"segments",2);x([M({attribute:!1})],_.prototype,"params",2);x([c()],_.prototype,"access",2);x([c()],_.prototype,"st",2);x([c()],_.prototype,"rows",2);x([c()],_.prototype,"drafts",2);x([c()],_.prototype,"statuses",2);x([c()],_.prototype,"q",2);x([c()],_.prototype,"acc",2);x([c()],_.prototype,"accSt",2);x([c()],_.prototype,"status",2);x([c()],_.prototype,"history",2);x([c()],_.prototype,"bills",2);x([c()],_.prototype,"error",2);x([c()],_.prototype,"busy",2);x([c()],_.prototype,"form",2);x([c()],_.prototype,"errs",2);x([c()],_.prototype,"customers",2);x([c()],_.prototype,"tariffs",2);x([c()],_.prototype,"meters",2);x([c()],_.prototype,"confirmDel",2);_=x([X("water-accounts-page")],_);function re(t,e){const a=r=>b(`/infra/water/bills/${r.id}`);return n`<div class="card flush scrollx ${e?"":"desk-only"}"><table class="t" data-bill-table>
      <thead><tr><th>${s("colNumber")}</th><th>${s("colCustomer")}</th><th>${s("colAccount")}</th><th>${s("colPeriod")}</th><th class="n">${s("colM3")}</th><th class="n">${s("colTotal")}</th><th>${s("colDue")}</th><th>${s("colState")}</th></tr></thead>
      <tbody>${t.map(r=>n`<tr class="go" data-bill-row=${r.id} @click=${()=>a(r)}>
        <td class="b"><a class="rowlink num" href=${`#/infra/water/bills/${r.id}`} @click=${i=>i.stopPropagation()}>${r.number??s("tBillDrafts")}</a></td><td>${r.customer.name??"-"}</td><td>${r.account_name}</td>
        <td class="num" style="text-align:start">${Ft(r.period)}</td><td class="n"><span class="num">${y(r.m3)}</span></td><td class="n"><span class="num">${r.total!==void 0?k(r.total):""}</span></td>
        <td class="num" style="text-align:start">${r.due_date?J(r.due_date):"-"}</td><td>${It(r)}</td></tr>`)}</tbody></table></div>
    ${e?d:n`<div class="list phone-only" style="flex-direction:column" data-bill-rows>${t.map(r=>n`<a class="li" href=${`#/infra/water/bills/${r.id}`} data-bill-row=${r.id}>
      <div class="grow"><div class="t1"><span class="num">${r.number??s("tBillDrafts")}</span> · ${r.customer.name??""}</div><div class="t2">${r.account_name} · <span class="num">${Ft(r.period)}</span> · <span class="num">${y(r.m3)}</span> ${s("m3")}</div></div>
      <div class="rowend">${It(r)}<div class="t2 num">${r.total!==void 0?k(r.total):""}</div></div></a>`)}</div>`}`}var Ds=Object.defineProperty,Ps=Object.getOwnPropertyDescriptor,zt=(t,e,a,r)=>{for(var i=r>1?void 0:r?Ps(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ds(e,a,i),i};const Q=t=>t==null?"-":y(t/1e3),Ct=t=>t==="off"?s("nightOff"):t==null?"-":String(t),te={main:"kMain",sub:"kSub",irrigation:"kIrrigation",cooling:"kCooling",pool:"kPool",other:"kOther"},Rt=t=>t in te?s(te[t]):t,Ie=Object.keys(te),Fe=["night_flow","burst"];function xt(t,e){const a=e.filter(r=>r.meter_id===t&&!r.closed_at);return a.some(r=>Fe.includes(r.kind))?"leak":a.some(r=>r.kind==="abnormal")?"abnormal":null}function Ue(t,e){return e==="leak"?n`<span class="chip c-err" data-status="leak">${s("stLeak")}</span>`:e==="abnormal"?n`<span class="chip c-warn" data-status="abnormal">${s("stAbnormal")}</span>`:t.state==="reporting"?n`<span class="chip c-ok" data-status="reporting">${s("stReporting")}</span>`:t.state==="paused"?n`<span class="chip c-mut" data-status="paused">${s("stPaused")}</span>`:t.state==="retired"?n`<span class="chip c-mut" data-status="retired">${s("stRetired")}</span>`:n`<span class="chip c-warn" data-status="not_reporting">${t.last_report_at?s("stNotReportingSince",{t:Bt(t.last_report_at)}):s("stNotReporting")}</span>`}const ve={night_flow:"akNight",burst:"akBurst",abnormal:"akAbnormal",offline:"akOffline",health:"akHealth"},Et=t=>t in ve?s(ve[t]):t,Mt=t=>typeof t=="number"&&Number.isFinite(t)?t:typeof t=="string"&&t.trim()!==""&&Number.isFinite(Number(t))?Number(t):null,Ot=new Intl.NumberFormat("en-US",{maximumFractionDigits:1});function Lt(t){const e=t.value??{};if(t.kind==="night_flow"||t.kind==="burst"){const a=Mt(e.floor_lph??e.rate_lph),r=Mt(e.threshold_lph);return a===null?"-":r===null?s("valueRate",{v:Ot.format(a)}):s("valueRateTh",{v:Ot.format(a),t:Ot.format(r)})}if(t.kind==="abnormal"){const a=Mt(e.today_l),r=Mt(e.median_l);return a===null?"-":s("valueAbnormal",{v:y(a/1e3),m:r===null?"-":y(r/1e3)})}return"-"}function $e(t){return t.closed_at?n`<span class="chip c-ok" data-event-state="closed">${t.ack_by_display?s("asClosedBy",{who:t.ack_by_display}):s("asClosed")}</span>`:t.snoozed_until?n`<span class="chip c-mut" data-event-state="snoozed">${s("snoozedUntil",{t:Bt(t.snoozed_until)})}</span>`:t.ack_at?n`<span class="chip c-acc" data-event-state="acked">${s("asAcked",{who:t.ack_by_display??""})}</span>`:n`<span class="chip ${t.severity==="alarm"||Fe.includes(t.kind)?"c-err":"c-warn"}" data-event-state="open">${s("asOpen")}</span>`}function Ve(t,e,a=i=>Ot.format(i),r=640){const i=Math.max(320,Math.round(r)),o=170,l=26;if(!t.length)return n`<div class="mut">${s("chartNoData")}</div>`;const u=Math.max(...t.map(g=>g.value),1)*1.15,f=(i-l*2)/t.length,p=Math.min(f*.64,24),h=Math.ceil(t.length/12),O=t.reduce((g,q,m)=>q.value>t[g].value?m:g,0);return n`<svg class="chart" viewBox="0 0 ${i} ${o}" role="img" aria-label=${e} data-chart>
    ${t.map((g,q)=>g.win?ut`<rect class="win" x=${i-l-(q+1)*f} y="4" width=${f} height=${o-26} />`:d)}
    ${ut`<line x1=${l} x2=${i-l} y1=${o-22} y2=${o-22} class="grid" />`}
    ${t.map((g,q)=>{const m=Math.max(g.value>0?2:0,g.value/u*(o-44)),A=g.night?Math.min(m,Math.max(g.night>0?2:0,g.night/u*(o-44))):0,Y=i-l-(q+1)*f+(f-p)/2,nt=q===t.length-1,$t=g.leak?"bar leak":nt?"bar hi":"bar";return ut`<rect class=${$t} x=${Y} y=${o-22-m} width=${p} height=${m} rx="3"><title>${g.title??`${g.label}: ${a(g.value)}`}</title></rect>
        ${A?ut`<rect class=${g.leak?"bar leak":"bar night"} x=${Y} y=${o-22-A} width=${p} height=${A}><title>${g.title??`${g.label}: ${a(g.value)}`}</title></rect>`:d}
        ${q%h===0||nt?ut`<text x=${Y+p/2} y=${o-6} text-anchor="middle">${g.label}</text>`:d}
        ${nt||q===O?ut`<text x=${Y+p/2} y=${o-27-m} text-anchor="middle" class="val">${a(g.value)}</text>`:d}`})}
  </svg>`}let dt=class extends st{constructor(){super(...arguments),this.settings=null,this.disabled=!1,this.open=!1,this.pos={top:0,left:0},this.onDoc=t=>{t.composedPath().includes(this)||(this.open=!1)},this.onKey=t=>{t.key==="Escape"&&(this.open=!1)}}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this.onDoc,!0),document.addEventListener("keydown",this.onKey)}disconnectedCallback(){document.removeEventListener("click",this.onDoc,!0),document.removeEventListener("keydown",this.onKey),super.disconnectedCallback()}fire(t){this.open=!1,this.dispatchEvent(new CustomEvent("snooze",{detail:{minutes:t},bubbles:!0,composed:!0}))}toggle(t){t.stopPropagation();const e=t.currentTarget.getBoundingClientRect();this.pos={top:Math.min(e.bottom+4,window.innerHeight-240),left:Math.max(8,Math.min(e.left,window.innerWidth-200))},this.open=!this.open}render(){const t=this.settings;if(!t)return d;const e=new Date;return n`<span class="snz" @click=${a=>a.stopPropagation()}>
        <button class="btn sm" type="button" data-snooze=${t.default} ?disabled=${this.disabled} @click=${()=>this.fire(t.default)}><sw-icon name="bellOff" size="13"></sw-icon>${s("snooze",{d:tt(t.default)})}</button>
        <button class="btn sm icononly" type="button" data-snooze-menu aria-haspopup="menu" aria-expanded=${this.open?"true":"false"} aria-label=${s("snoozeOther")} ?disabled=${this.disabled} @click=${a=>this.toggle(a)}><sw-icon name="chevronDown" size="13"></sw-icon></button>
      </span>
      ${this.open?n`<div class="menu" role="menu" style="top:${this.pos.top}px;left:${this.pos.left}px" data-snooze-list>
            <div class="mh">${s("snoozeTo")}</div>
            ${t.durations.filter(a=>a<=t.max).map(a=>n`<button type="button" role="menuitem" data-pick=${a} @click=${r=>{r.stopPropagation(),this.fire(a)}}>${tt(a)} <span class="mut">(${s("snoozeUntil",{t:se(e,a)})})</span></button>`)}
            <div class="mh">${s("snoozeFoot")}</div>
          </div>`:d}`}};dt.styles=[Re,Vt`
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
    `];zt([M({attribute:!1})],dt.prototype,"settings",2);zt([M({type:Boolean})],dt.prototype,"disabled",2);zt([c()],dt.prototype,"open",2);zt([c()],dt.prototype,"pos",2);dt=zt([X("water-snooze")],dt);function Ns(t,e){try{const a=localStorage.getItem(t);return a?JSON.parse(a):e}catch{return e}}function Ms(t,e){try{localStorage.setItem(t,JSON.stringify(e))}catch{}}function We(t){return t===60?s("hour1"):t===120?s("hours2"):t%60===0?s("hours",{n:t/60}):s("minutes",{n:t})}var Ts=Object.defineProperty,Rs=Object.getOwnPropertyDescriptor,V=(t,e,a,r)=>{for(var i=r>1?void 0:r?Rs(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ts(e,a,i),i};const ge={hours:"r24h",days:"r30d",months:"r12m"},be={first:"reasonFirst",replaced:"reasonReplaced",source_changed:"reasonSource"},_t=t=>String(t).padStart(2,"0"),Es=t=>`${t.getFullYear()}-${_t(t.getMonth()+1)}-${_t(t.getDate())}T${_t(t.getHours())}:${_t(t.getMinutes())}`,Os=(t,e)=>{const a=t.getHours()*60+t.getMinutes(),[r,i]=e.night_from.split(":").map(Number),[o,l]=e.night_to.split(":").map(Number),u=r*60+i,f=o*60+l;return u<=f?a>=u&&a<f:a>=u||a<f};let L=class extends as{constructor(){super("hours"),this.canAck=!1,this.rules=vt,this.snooze=null,this.night=void 0,this.bars=[],this.alerts=[],this.readings=[],this.notice="",this.f1="",this.f2="",this.f3="",this.unit="m3",this.kind=""}fetchDetail(){return w.meter(this.meterId)}async afterLoad(t){this.canManage&&this.loadReadings(),await this.loadAlerts(),t()&&this.loadSeries()}titles(t){return{heading:t.display_name??"",subheading:[Rt(t.kind),t.area_name,t.floor_name].filter(Boolean).join(" · ")}}texts(){return{loadError:s("cardLoadError"),retry:s("retry")}}async loadAlerts(){try{this.alerts=(await w.events("open",this.meterId)).items}catch{this.alerts=[]}}async loadReadings(){try{this.readings=await w.manualReadings(this.meterId)}catch{this.readings=[]}}async fetchSeries(t,e,a,r){const i=await w.series(this.meterId,e,a,r);return()=>{const o=xt(this.meterId,this.alerts)==="leak";if(t==="hours")this.bars=i.map(l=>{const u=new Date(l.start),f=Os(u,this.rules);return{label:_t(u.getHours()),value:l.litres??0,win:f,leak:f&&o}});else if(t==="days")this.bars=i.map(l=>({label:String(new Date(l.start).getDate()),value:(l.litres??0)/1e3}));else{const l=new Map;for(const u of i){const f=new Date(u.start),p=`${f.getMonth()+1}/${String(f.getFullYear()).slice(2)}`;l.set(p,(l.get(p)??0)+(u.litres??0)/1e3)}this.bars=[...l.entries()].map(([u,f])=>({label:u,value:f}))}}}flash(t){this.notice=t,window.setTimeout(()=>this.notice="",4e3)}async act(t,e){if(!this.busy){this.busy=!0,this.actionError="";try{await t(),e?.(),this.fire("changed")}catch(a){this.actionError=a instanceof mt&&a.code==="revision_conflict"?s("conflict"):N(a),a instanceof mt&&a.code==="revision_conflict"&&await this.refresh()}finally{this.busy=!1}}}ack(t){this.act(()=>w.ack(t.id),()=>{this.flash(s("acked")),this.loadAlerts()})}doSnooze(t,e){const a=!!this.snooze;this.act(()=>w.snooze(t.id,a?e:void 0),()=>{this.flash(s("snoozedToast",{d:tt(e),t:se(new Date,e)})),this.loadAlerts()})}openDlg(t){const e=this.detail;this.actionError="",this.f1=t==="rename"?e?.display_name??"":t==="replace"?e?.value_l!=null?String(e.value_l/1e3):"":t==="reading"?Es(new Date):"",this.f2=t==="replace"?"0":"",this.f3="",this.kind=e?.kind??"other",this.unit="m3",this.dlg=t}save(){const t=this.detail;if(t)if(this.dlg==="rename"){const e=this.f1.trim();if(!e)return void(this.actionError=s("nameRequired"));this.act(()=>w.patchMeter(t,{display_name:e,...this.kind!==t.kind?{kind:this.kind}:{}}),()=>{this.dlg="",this.refresh()})}else if(this.dlg==="replace"){const e=Number(this.f1),a=Number(this.f2);if(this.f1.trim()===""||!Number.isFinite(e)||e<0||this.f2.trim()===""||!Number.isFinite(a)||a<0)return void(this.actionError=s("replaceBad"));this.act(()=>w.replaceMeter(t,{old_final_reading_l:e*1e3,new_start_reading_l:a*1e3,note:this.f3.trim()||void 0}),()=>{this.dlg="",this.load()})}else if(this.dlg==="reading"){const e=this.f2.trim().replace(",",".");if(!e||!Number.isFinite(Number(e))||Number(e)<0||!this.f1)return void(this.actionError=s("replaceBad"));this.act(()=>w.addManual(t.id,{read_at:new Date(this.f1).toISOString(),value:e,unit:this.unit,note:this.f3.trim()||void 0}),()=>{this.dlg="",this.flash(s("readingSaved")),this.loadReadings(),this.refresh()})}else this.dlg==="remove"&&this.act(()=>w.retireMeter(t),()=>{this.dlg="",this.fire("close")})}renderAlerts(){return this.alerts.length?n`<h3 class="sec">${s("openAlerts")}</h3>
      <div class="list" data-open-alerts>${this.alerts.map(t=>n`<div class="li" data-alert=${t.id}>
        <div class="grow"><div class="t1">${Et(t.kind)} · ${Lt(t)}</div><div class="t2 wrap">${s("colSince")} <span class="num">${Bt(t.opened_at)}</span>${t.snoozed_until?n` · ${s("snoozedUntil",{t:Bt(t.snoozed_until)})}`:d}</div></div>
        ${this.canAck?n`<span class="acts">${t.can_ack?n`<sw-button variant="primary" size="sm" data-ack ?disabled=${this.busy} @click=${()=>this.ack(t)}>${s("ack")}</sw-button>`:d}
          ${t.can_snooze?n`<water-snooze .settings=${this.snooze??{durations:[60],default:60,max:60}} ?disabled=${this.busy} @snooze=${e=>this.doSnooze(t,e.detail.minutes)}></water-snooze>`:d}</span>`:d}
      </div>`)}</div>`:d}renderReadings(){return this.canManage?n`<div class="row"><h3 class="sec">${s("readings")}</h3><span class="sp"></span><sw-button size="sm" data-reading @click=${()=>this.openDlg("reading")}>${s("manualReading")}</sw-button></div>
      ${this.readings.length?n`<div class="list" data-readings>${this.readings.slice(0,5).map(t=>n`<div class="li"><div class="grow"><div class="t1"><span class="num">${Q(t.litres)}</span> ${s("m3")}</div>
            <div class="t2">${Jt(t.read_at)} · ${t.voided_at?s("readingVoided"):t.effect==="allocation"?s("effAllocation"):s("effRecorded")}${t.note?` · ${t.note}`:""}</div></div>
            ${t.voided_at?d:n`<sw-button variant="ghost" size="sm" data-undo-reading ?disabled=${this.busy} @click=${()=>void this.act(()=>w.undoManual(this.meterId,t.id),()=>void this.loadReadings())}>${s("readingUndo")}</sw-button>`}</div>`)}</div>`:n`<div class="mut">${s("noReadings")}</div>`}`:d}renderBody(t){const e=xt(t.id,this.alerts),a=Ee(t),r=`${this.rules.night_from}-${this.rules.night_to}`,i=t.rules&&Object.keys(t.rules).length>0;return n`<div class="body" data-meter-card=${t.id}>
      <div class="row">${Ue(t,e)}</div>
      ${this.notice?n`<div class="notice" role="status">${this.notice}</div>`:d}
      <dl class="kv">
        <dt>${s("fArea")}</dt><dd>${t.area_name??"-"}${t.floor_name?` · ${t.floor_name}`:""}</dd>
        <dt>${s("fReading")}</dt><dd><span class="num">${Q(t.value_l)}</span> <span class="mut">${s("m3")}</span></dd>
        <dt>${s("fLast")}</dt><dd><span class="num">${Jt(t.last_report_at)}</span></dd>
        <dt>${s("fUnit")}</dt><dd>${s("fUnitValue")}</dd>
        <dt>${s("fKind")}</dt><dd>${Rt(t.kind)}</dd>
        <dt>${s("fNight")}</dt><dd>${a?s("fNightOff"):this.night===null||this.night===void 0?"-":n`<span class="num ${e==="leak"?"bad":""}">${Ct(this.night)}</span> ${s("lph")}`}</dd>
        <dt>${s("fRules")}</dt><dd>${i?s("fRulesOwn",{w:r}):s("fRulesDefault",{w:r})}</dd>
      </dl>
      <div class="row"><h3 class="sec">${s("usage")}</h3><span class="sp"></span>
        ${this.rangeSeg(s("range"),o=>s(ge[o]))}</div>
      ${this.chartError?n`<div class="alert err" role="alert">${s("chartError")}</div>`:Ve(this.bars,s("chartAria",{r:s(ge[this.range])}),this.range==="hours"?o=>String(Math.round(o)):o=>o.toFixed(o<10?2:1))}
      ${this.range==="hours"?n`<div class="mut">${s("nightNote",{w:r})}</div>`:d}
      ${this.renderAlerts()}
      <h3 class="sec">${s("epochs")}</h3>
      <div class="list" data-epochs>${t.epochs.map(o=>n`<div class="li"><div class="grow"><div class="t1">${be[o.reason]?s(be[o.reason]):o.reason} · <span class="num">${J(o.started_at)}</span></div>
        <div class="t2 wrap">${s("epochStart")} <span class="num">${Q(o.start_reading_l)}</span>${o.ended_at?n` · ${s("epochUntil")} <span class="num">${J(o.ended_at)}</span>`:""}${o.note?` · ${o.note}`:""}</div></div>${o.ended_at?d:n`<span class="chip c-acc nodot">${s("epochActive")}</span>`}</div>`)}</div>
      ${this.renderReadings()}
      ${this.actionError&&!this.dlg?n`<div class="alert err" role="alert" data-meter-action-error>${this.actionError}</div>`:d}
      ${this.canManage?this.actionsRow({rename:s("rename"),replace:s("replace"),pause:t.status==="paused"?s("resume"):s("pause"),remove:s("remove"),pauseDisabled:this.busy||t.status==="retired",onRename:()=>this.openDlg("rename"),onReplace:()=>this.openDlg("replace"),onPause:()=>void this.act(()=>w.patchMeter(t,{status:t.status==="paused"?"active":"paused"}),()=>void this.load()),onRemove:()=>this.openDlg("remove")}):d}
    </div>`}field(t,e,a,r,i={}){return n`<div class="fld ${i.wide?"wide":""}"><label for=${t}>${e}</label><div class="inp"><input id=${t} type=${i.type??"text"} inputmode=${i.type?"text":"decimal"} .value=${a} @input=${o=>r(o.target.value)} />${i.suffix?n`<span class="mut">${i.suffix}</span>`:d}</div></div>`}renderDialogs(){const t=this.actionError&&this.dlg?n`<div class="alert err wide" role="alert">${this.actionError}</div>`:d,e=(a,r=!1)=>n`<sw-button slot="footer" variant=${r?"danger":"primary"} data-dialog-save ?disabled=${this.busy} @click=${()=>this.save()}>${a}</sw-button><sw-button slot="footer" @click=${()=>this.dlg=""}>${s("cancel")}</sw-button>`;return n`
      <sw-dialog ?open=${this.dlg==="remove"} heading=${s("removeTitle")} data-meter-remove-dialog @close=${()=>this.dlg=""}>
        <div>${s("removeBody")}</div>${t}${e(s("remove"),!0)}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="rename"} heading=${s("renameTitle")} data-meter-rename-dialog @close=${()=>this.dlg=""}>
        <div class="form">${this.field("wrn",s("meterName"),this.f1,a=>this.f1=a,{type:"text",wide:!0})}
          <div class="fld wide"><label for="wkd">${s("meterKind")}</label><div class="inp"><select id="wkd" @change=${a=>this.kind=a.target.value}>${Ie.map(a=>n`<option value=${a} ?selected=${a===this.kind}>${Rt(a)}</option>`)}</select></div></div>${t}</div>
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
      </sw-dialog>`}};L.styles=[rt,ss];V([M({type:Boolean})],L.prototype,"canAck",2);V([M({attribute:!1})],L.prototype,"rules",2);V([M({attribute:!1})],L.prototype,"snooze",2);V([M({attribute:!1})],L.prototype,"night",2);V([c()],L.prototype,"bars",2);V([c()],L.prototype,"alerts",2);V([c()],L.prototype,"readings",2);V([c()],L.prototype,"notice",2);V([c()],L.prototype,"f1",2);V([c()],L.prototype,"f2",2);V([c()],L.prototype,"f3",2);V([c()],L.prototype,"unit",2);V([c()],L.prototype,"kind",2);L=V([X("water-meter-card")],L);var Ls=Object.defineProperty,Bs=Object.getOwnPropertyDescriptor,W=(t,e,a,r)=>{for(var i=r>1?void 0:r?Bs(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ls(e,a,i),i};const Is=6e4,Tt=t=>String(t).padStart(2,"0"),pt=t=>{if(!t)return"-";const e=new Date(t);return`${Tt(e.getDate())}.${Tt(e.getMonth()+1)} ${Tt(e.getHours())}:${Tt(e.getMinutes())}`},Fs=t=>/^[=+\-@\t\r]/.test(t)?`'${t}`:t,Us=t=>`"${Fs(t).replace(/"/g,'""')}"`;let B=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.items=[],this.summary=null,this.rules=vt,this.snooze=null,this.phase="loading",this.error="",this.actionError="",this.notice="",this.filter="open",this.busy=!1,this.access=at(),this.poller=new qe(this)}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.load(!0),this.poller.every("rows",Is,()=>this.load(!1)),At().then(t=>{t&&(this.rules=t.rules,this.snooze=t.snooze)})}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}async load(t){t&&(this.phase="loading");try{const e=await w.events("all");this.items=e.items,this.summary=e.summary,this.phase="ready"}catch(e){(t||this.phase!=="ready")&&(this.error=N(e),this.phase="error")}}flash(t){this.notice=t,window.setTimeout(()=>this.notice="",4e3)}async act(t,e){if(!this.busy){this.busy=!0,this.actionError="";try{await t(),this.flash(e),await this.load(!1)}catch(a){this.actionError=N(a)}finally{this.busy=!1}}}snoozeEv(t,e){this.act(()=>w.snooze(t.id,this.snooze?e:void 0),s("snoozedToast",{d:tt(e),t:se(new Date,e)}))}openMeter(t){if(t.closed_at)return;const e={};this.params.forEach((a,r)=>e[r]=a),b("/infra/water/alerts",{...e,meter:t.meter_id})}onKey(t,e){(t.key==="Enter"||t.key===" ")&&t.target===t.currentTarget&&(t.preventDefault(),this.openMeter(e))}closeMeter(){const t={};this.params.forEach((e,a)=>a!=="meter"&&(t[a]=e)),b("/infra/water/alerts",t)}exportCsv(t){const e=ie()==="he",a=[s("colMeter"),s("colArea"),s("colKind"),s("colSince"),e?"עד":"Until",s("colValue"),s("colState")],r=u=>u.closed_at?s("asClosed"):u.snoozed_until?s("snoozedUntil",{t:pt(u.snoozed_until)}):u.ack_at?s("asAcked",{who:u.ack_by_display??""}):s("asOpen"),i=[a,...t.map(u=>[u.meter_name,[u.area_name,u.floor_name].filter(Boolean).join(" · "),Et(u.kind),pt(u.opened_at),u.closed_at?pt(u.closed_at):"",Lt(u),r(u)])],o=new Blob(["\uFEFF"+i.map(u=>u.map(Us).join(",")).join(`\r
`)],{type:"text/csv;charset=utf-8"}),l=document.createElement("a");l.href=URL.createObjectURL(o),l.download=`water-alerts-${new Date().toISOString().slice(0,10)}.csv`,l.click(),window.setTimeout(()=>URL.revokeObjectURL(l.href),1e3),this.flash(s("csvDone"))}actions(t){return t.closed_at||!this.access.ack?d:n`<span class="acts">${t.can_ack?n`<sw-button variant="primary" size="sm" data-ack ?disabled=${this.busy} @click=${e=>{e.stopPropagation(),this.act(()=>w.ack(t.id),s("acked"))}}>${s("ack")}</sw-button>`:d}
      ${t.can_snooze?n`<water-snooze .settings=${this.snooze??{durations:[60],default:60,max:60}} ?disabled=${this.busy} @snooze=${e=>this.snoozeEv(t,e.detail.minutes)}></water-snooze>`:d}</span>`}render(){if(!this.access.view)return n`<sw-state-panel state="forbidden" data-water="alerts" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return n`<div data-water="alerts" data-state="loading" aria-busy="true"><div class="card">${Array.from({length:7},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;if(this.phase==="error")return n`<div data-water="alerts" data-state="error"><sw-state-panel state="error" heading=${s("loadAlertsError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.load(!0)}></sw-state-panel></div>`;const t=Date.now()-7*864e5,e=this.items.filter(p=>p.closed_at&&Date.parse(p.closed_at)>=t).length,a=this.filter==="all"?this.items:this.items.filter(p=>!p.closed_at),r=this.summary,i=this.rules,o=this.params.get("meter")??"",l=n`<div class="row head">
      <div class="seg" role="group" aria-label=${s("filter")} data-alert-filter>
        <button type="button" aria-pressed=${this.filter==="open"?"true":"false"} data-f="open" @click=${()=>this.filter="open"}>${s("fOpen")}</button>
        <button type="button" aria-pressed=${this.filter==="all"?"true":"false"} data-f="all" @click=${()=>this.filter="all"}>${s("fAll")}</button></div>
      <span class="sp"></span>
      <sw-button icon="download" data-csv ?disabled=${!a.length} @click=${()=>this.exportCsv(a)}>${s("csv")}</sw-button>
      ${this.access.manage||this.access.configure?n`<sw-button data-leak-rules @click=${()=>b("/infra/water/settings",{set:"alerts"})}>${s("leakRules")}</sw-button>`:d}
    </div>`,u=n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tOpen")}</div><div class="v ${r?.open?"alarm":""}"><span class="num" data-t-open>${r?.open??0}</span></div></div>
      <div class="tile"><div class="k">${s("tClosedWeek")}</div><div class="v"><span class="num" data-t-closed>${e}</span></div></div>
      <div class="tile"><div class="k">${s("tSnoozed")}</div><div class="v"><span class="num" data-t-snz>${r?.snoozed??0}</span></div></div>
      <div class="tile"><div class="k">${s("tRule")}</div><div class="v"><span class="num nw">${i.night_from}-${i.night_to}</span><span class="u">${s("ruleValue",{lph:i.night_min_lph,dur:We(i.night_min_intervals*15)})}</span></div></div>
    </div>`,f=a.length?n`<div class="card flush scrollx desk-only fitbox"><table class="t" data-alerts-table>
          <thead><tr><th>${s("colMeter")}</th><th>${s("colArea")}</th><th>${s("colKind")}</th><th>${s("colSince")}</th><th class="n">${s("colValue")}</th><th>${s("colState")}</th><th></th></tr></thead>
          <tbody>${a.map(p=>n`<tr class=${p.closed_at?"":"pick"} tabindex=${p.closed_at?-1:0} data-alert=${p.id} @click=${()=>this.openMeter(p)} @keydown=${h=>this.onKey(h,p)}>
            <td class="b">${p.meter_name}</td><td>${p.area_name??"-"}<span class="mut dsk">${p.floor_name?` · ${p.floor_name}`:""}</span></td><td>${Et(p.kind)}</td>
            <td><span class="num">${pt(p.opened_at)}</span>${p.closed_at?n`<span class="mut"> - <span class="num">${pt(p.closed_at)}</span></span>`:d}</td>
            <td class="n">${Lt(p)}</td><td>${$e(p)}</td><td class="n">${this.actions(p)}</td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-alerts-rows>${a.map(p=>n`<div class="li ${p.closed_at?"dis":"pick"}" role=${p.closed_at?d:"button"} tabindex=${p.closed_at?d:0} data-alert=${p.id} @click=${()=>this.openMeter(p)} @keydown=${h=>this.onKey(h,p)}>
          <div class="grow"><div class="t1">${p.meter_name} · ${Et(p.kind)}</div><div class="t2 wrap">${p.area_name??""} · ${s("colSince")} <span class="num">${pt(p.opened_at)}</span> · ${Lt(p)}</div></div>${$e(p)}${this.actions(p)}</div>`)}</div>`:n`<sw-state-panel icon="check" state="empty" heading=${s("emptyAlerts")} data-no-alerts></sw-state-panel>`;return n`<div class="page fit" data-water="alerts" data-state=${a.length?"ready":"empty"}>
      ${l}
      ${this.notice?n`<div class="notice" role="status" data-notice>${this.notice}</div>`:d}
      ${this.actionError?n`<div class="alert err" role="alert">${this.actionError}</div>`:d}
      ${u}${f}
      ${o?n`<water-meter-card .meterId=${o} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} @close=${()=>this.closeMeter()} @changed=${()=>void this.load(!1)}></water-meter-card>`:d}
    </div>`}};B.styles=[rt,et];W([M({attribute:!1})],B.prototype,"segments",2);W([M({attribute:!1})],B.prototype,"params",2);W([c()],B.prototype,"items",2);W([c()],B.prototype,"summary",2);W([c()],B.prototype,"rules",2);W([c()],B.prototype,"snooze",2);W([c()],B.prototype,"phase",2);W([c()],B.prototype,"error",2);W([c()],B.prototype,"actionError",2);W([c()],B.prototype,"notice",2);W([c()],B.prototype,"filter",2);W([c()],B.prototype,"busy",2);W([c()],B.prototype,"access",2);B=W([X("water-alerts-page")],B);var Vs=Object.defineProperty,Ws=Object.getOwnPropertyDescriptor,R=(t,e,a,r)=>{for(var i=r>1?void 0:r?Ws(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Vs(e,a,i),i};const gt="/infra/water/bills",Hs=["draft","issued","sent","paid","void"],bt=t=>`${J(t.from)} - ${J(t.to)}`,we=()=>{const t=new Date;return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`},js=t=>`"${(/^[=+\-@\t\r]/.test(t)?`'${t}`:t).replace(/"/g,'""')}"`,ye=(t=6)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`,_e={email:"howEmail",hand:"howHand",other:"howOther"},Ks={recalculate:"aRecalc",issue:"aIssue",sent:"aSent",paid:"aPaid",correct:"aCorrect",void:"aVoid",delete:"aDelete"},ke={created:"evCreated",draft:"evCreated",recalculated:"evRecalculated",recalculate:"evRecalculated",issued:"evIssued",issue:"evIssued",auto_issue:"evIssued",auto_draft:"evCreated",sent:"evSent",paid:"evPaid",voided:"evVoided",void:"evVoided",corrected:"evCorrected",correct:"evCorrected",deleted:"evDeleted"};let C=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.st="loading",this.all=[],this.sums={open:"0.00",paid:"0.00"},this.filter="",this.q="",this.bill=null,this.billSt="loading",this.events=[],this.dlg="",this.reason="",this.how="email",this.ref="",this.busy=!1,this.error="",this.shown=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t)}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const e=this.segments[0]??"";e!==this.shown&&(this.shown=e,this.dlg="",this.error="",e?this.loadBill(e):this.loadList())}async loadList(){this.st="loading";try{const t=await v.listBills();this.all=t.items,this.sums=t.sums,this.st="ready"}catch{this.st="error"}}async loadBill(t){this.billSt="loading";try{this.bill=await v.bill(t),this.billSt="ready",this.loadEvents(t)}catch(e){this.error=N(e),this.billSt="error"}}async loadEvents(t){try{this.events=(await v.billEvents(t)).items}catch{this.events=[]}}open(t){this.dlg=t,this.error="",this.reason="",this.ref="",this.how="email"}async act(t){if(!(this.busy||!this.bill)){this.busy=!0,this.error="";try{const e=await t();if(this.dlg="",e){if(e.id!==this.bill.id){b(`${gt}/${e.id}`);return}this.bill=e,this.loadEvents(e.id)}}catch(e){this.error=N(e)}finally{this.busy=!1}}}exportCsv(t){const e=[s("colNumber"),s("colCustomer"),s("colAccount"),s("colPeriod"),s("colM3"),s("colTotal"),s("colDue"),s("colState")],a=t.map(o=>[o.number??"",o.customer.name??"",o.account_name,bt(o.period),o.m3??"",o.total??"",o.due_date??"",kt[o.state].label]),r=new Blob(["\uFEFF"+[e,...a].map(o=>o.map(js).join(",")).join(`\r
`)],{type:"text/csv;charset=utf-8"}),i=document.createElement("a");i.href=URL.createObjectURL(r),i.download=`water-bills-${we()}.csv`,i.click(),window.setTimeout(()=>URL.revokeObjectURL(i.href),1e3)}renderList(){if(this.st==="loading")return n`<div class="page" data-water="bills" data-state="loading">${ye(7)}</div>`;if(this.st==="error")return n`<div class="page" data-water="bills" data-state="error"><sw-state-panel state="error" heading=${s("loadBillsError")} actionLabel=${s("retry")} @action=${()=>void this.loadList()}></sw-state-panel></div>`;if(!this.all.length)return n`<div class="page" data-water="bills" data-state="empty"><sw-state-panel icon="list" state="empty" heading=${s("emptyBills")}><sw-button variant="primary" @click=${()=>b("/infra/water/accounts")}>${s("toAccounts")}</sw-button></sw-state-panel></div>`;const t=o=>this.all.filter(l=>l.state===o).length,e=this.q.trim(),a=this.all.filter(o=>(!this.filter||o.state===this.filter)&&(!e||(o.number??"").includes(e)||(o.customer.name??"").includes(e)||o.account_name.includes(e))),r=we(),i=this.all.filter(o=>ks(o,r)).length;return n`<div class="page" data-water="bills" data-state=${a.length?"ready":"filtered-empty"}>
      <div class="row head">
        <div class="seg scroll-seg" role="group" aria-label=${s("stateFilter")} data-bill-filter>
          <button type="button" data-filter="" aria-pressed=${this.filter===""?"true":"false"} @click=${()=>this.filter=""}>${s("fAll")} <span class="num">${this.all.length}</span></button>
          ${Hs.map(o=>n`<button type="button" data-filter=${o} aria-pressed=${this.filter===o?"true":"false"} @click=${()=>this.filter=o}>${kt[o].label} <span class="num">${t(o)}</span></button>`)}</div>
        <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-bill-search placeholder=${s("billSearch")} aria-label=${s("billSearch")} .value=${this.q} @input=${o=>this.q=o.target.value} /></label>
        <span class="sp"></span>
        <sw-button icon="download" data-csv ?disabled=${!a.length} @click=${()=>this.exportCsv(a)}>${s("csv")}</sw-button>
      </div>
      <div class="tiles" data-tiles>
        <div class="tile"><div class="k">${s("tBillDrafts")}</div><div class="v"><span class="num" data-bt="draft">${t("draft")}</span></div></div>
        <div class="tile"><div class="k">${s("tOpenAmount")}</div><div class="v"><span class="num" data-bt="open">${k(this.sums.open).replace(" ₪","")}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${s("tPaid")}</div><div class="v"><span class="num" data-bt="paid">${k(this.sums.paid).replace(" ₪","")}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${s("tLate")}</div><div class="v ${i?"alarm":""}"><span class="num" data-bt="late">${i}</span></div></div>
      </div>
      ${a.length?re(a,!1):n`<sw-state-panel icon="search" state="empty" compact heading=${s("noBillsFound")}></sw-state-panel>`}
    </div>`}paper(t){const e=t.snapshot,a=ws(e.lines??[]),r=(o,l)=>n`<tr data-line=${o.component}><td>${l}${(e.lines??[]).filter(u=>u.component===o.component).length>1?n` <span class="mut num">${bt(o)}</span>`:d}</td>
      <td class="n"><span class="num">${y(o.m3)}</span> ${s("m3")}</td><td class="n"><span class="num">${k(o.unit_price_ex_vat)}</span></td><td class="n"><span class="num">${k(o.amount_ex_vat)}</span></td></tr>`,i=[...new Set((e.lines??[]).map(o=>o.vat_rate_percent))];return n`<div class="paper" data-bill-paper>
      <div class="row" style="align-items:flex-start"><div><b class="h3">${e.business?.name??""}</b>${e.business?.registration_no?n`<div class="mut num">${e.business.registration_no}</div>`:d}${e.business?.address?n`<div class="mut">${e.business.address}</div>`:d}</div>
        <span class="sp"></span><div style="text-align:end"><b>${e.doc?.title_he??s("billDraft")}</b>${e.doc?.subtitle_he?n`<div class="mut">${e.doc.subtitle_he}</div>`:d}<div class="num">${t.number??s("tBillDrafts")}</div></div></div>
      <dl class="kv">
        <dt>${s("colCustomer")}</dt><dd>${e.customer?.name??""} · <span class="num">${e.customer?.customer_number??""}</span>${e.customer?.address?` · ${e.customer.address}`:""}</dd>
        <dt>${s("colAccount")}</dt><dd>${e.account?.name??t.account_name}</dd>
        <dt>${s("pPeriod")}</dt><dd class="num">${bt(t.period)}</dd>
        <dt>${s("pFormula")}</dt><dd>${e.account?.formula?.sentence_he??""}</dd>
        ${t.issue_date?n`<dt>${s("pIssued")}</dt><dd class="num">${J(t.issue_date)}</dd>`:d}
        <dt>${s("pDue")}</dt><dd class="num">${J(t.due_date??e.bill?.expected_due_date??null)}</dd>
      </dl>
      <table><thead><tr><th>${s("pItem")}</th><th class="n">${s("pQty")}</th><th class="n">${s("pPrice")}</th><th class="n">${s("pAmount")}</th></tr></thead>
        <tbody>${a.water.map(o=>r(o,s("pWater")))}${a.sewage.map(o=>r(o,s("pSewage")))}</tbody>
        <tfoot>
          <tr><td colspan="3">${s("pSubtotal")}</td><td class="n"><span class="num" data-subtotal>${k(e.totals?.amount_ex_vat)}</span></td></tr>
          <tr><td colspan="3">${s("pVat",{p:i.join(" / ")})}</td><td class="n"><span class="num" data-vat>${k(e.totals?.vat_amount)}</span></td></tr>
          <tr class="tot"><td colspan="3">${s("pTotal")}</td><td class="n"><span class="num" data-total>${k(e.totals?.total)}</span></td></tr>
        </tfoot></table>
      ${(e.notes??[]).map(o=>n`<div class="mut">${o.text_he}</div>`)}
    </div>`}renderBill(){const t=this.segments[0],e=n`<a class="btn ghost sm" href=${`#${gt}`} data-back><sw-icon name="chevronBack" size="13"></sw-icon>${s("bills")}</a>`;if(this.billSt==="loading"&&this.bill?.id!==t)return n`<div class="page" data-water="bill" data-state="loading">${ye(5)}</div>`;if(this.billSt==="error"||!this.bill)return n`<div class="page" data-water="bill" data-state="error"><div class="backrow">${e}</div><sw-state-panel state="error" heading=${s("loadBillError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.loadBill(t)}></sw-state-panel></div>`;const a=this.bill,r=["issue","sent","paid","recalculate","correct","void","delete"],i=[...a.actions].sort((u,f)=>r.indexOf(u)-r.indexOf(f)),o=u=>{const f=u==="void"||u==="delete",p=u==="issue"||u==="paid",h=()=>u==="recalculate"?void this.act(()=>v.recalculate(a)):this.open(u);return n`<sw-button variant=${f?"danger":p?"primary":"secondary"} data-act=${u} ?disabled=${this.busy} @click=${h}>${s(Ks[u]??"aIssue")}</sw-button>`},l=n`<div class="col">
      <div class="card"><div class="hd"><b>${s("details")}</b></div><dl class="kv" data-bill-details>
        <dt>${s("colAccount")}</dt><dd><a class="lnk" href=${`#/infra/water/accounts/${a.account_id}`}>${a.account_name}</a></dd><dt>${s("colCustomer")}</dt><dd>${a.customer.name??"-"}</dd>
        <dt>${s("pPeriod")}</dt><dd class="num">${bt(a.period)}</dd><dt>${s("colM3")}</dt><dd class="num">${y(a.m3)}</dd>
        ${a.sent?n`<dt>${s("sentOn")}</dt><dd><span class="num">${J(a.sent.at)}</span> · ${s(_e[a.sent.how]??"howOther")}</dd>`:d}
        ${a.paid?n`<dt>${s("paidOn")}</dt><dd><span class="num">${J(a.paid.at)}</span>${a.paid.reference?n` · <span class="num">${a.paid.reference}</span>`:d}</dd>`:d}
        <dt>${s("source")}</dt><dd>${a.origin==="auto"?s("originAuto"):s("originManual")}</dd></dl></div>
      <div class="card"><div class="hd"><b>${s("log")}</b></div><div class="list" data-bill-log>${this.events.map(u=>n`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${Jt(u.at)}</span><span>${ke[u.action]?s(ke[u.action]):u.action}${u.actor.display_name?` · ${u.actor.display_name}`:""}</span></div>`)}</div></div>
    </div>`;return n`<div class="page" data-water="bill" data-state="ready" data-bill-state=${a.state} data-bill-id=${a.id}>
      <div class="backrow">${e}<b class="h3 num" data-bill-number>${a.number?s("billNo",{no:a.number}):s("billDraft")}</b>${It(a)}
        ${a.replaces_bill_id&&a.snapshot.bill?.replaces?n`<span class="mut">${s("replaces",{no:""})}<a class="lnk num" href=${`#${gt}/${a.replaces_bill_id}`}>${a.snapshot.bill.replaces.number??""}</a></span>`:d}
        ${a.replaced_by_bill_id?n`<a class="lnk mut" href=${`#${gt}/${a.replaced_by_bill_id}`}>${s("replacedBy")}</a>`:d}
        <span class="sp"></span>${i.map(o)}
        <button type="button" class="btn" disabled title=${s("pdfLater")} aria-describedby="wpdf" data-pdf><sw-icon name="download" size="15"></sw-icon>${s("pdf")}</button></div>
      <div class="mut" id="wpdf" data-pdf-reason>${s("pdfLater")}</div>
      ${a.state==="void"&&a.void?n`<div class="alert err" role="alert"><span class="x" aria-hidden="true">!</span><div><b>${kt.void.label}:</b> ${a.void.reason}</div></div>`:d}
      ${this.error&&!this.dlg?n`<div class="alert err" role="alert">${this.error}</div>`:d}
      <div class="cols side"><div style="min-inline-size:0">${this.paper(a)}</div>${l}</div>
      ${this.dialogs(a)}
    </div>`}dialogs(t){const e=this.error&&this.dlg?n`<div class="alert err" role="alert">${this.error}</div>`:d,a=n`<sw-button slot="actions" @click=${()=>this.dlg=""}>${s("cancel")}</sw-button>`,r=!this.reason.trim();return n`
      <elec-dialog heading=${s("dIssueTitle")} ?open=${this.dlg==="issue"} data-dialog="issue" @close=${()=>this.dlg=""}>
        <div>${s("dIssueBody")}</div><dl class="kv"><dt>${s("colAccount")}</dt><dd>${t.account_name}</dd><dt>${s("pPeriod")}</dt><dd class="num">${bt(t.period)}</dd><dt>${s("pTotal")}</dt><dd class="num">${k(t.total)}</dd></dl>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.issue(t))}>${s("aIssue")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dVoidTitle")} ?open=${this.dlg==="void"} data-dialog="void" @close=${()=>this.dlg=""}>
        <div>${s("dVoidBody")}</div>
        <div class="fld"><label for="wvr">${s("dVoidReason")}</label><textarea id="wvr" data-reason aria-required="true" .value=${this.reason} @input=${i=>this.reason=i.target.value}></textarea></div>${e}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy||r} @click=${()=>void this.act(()=>v.void(t,this.reason.trim()))}>${s("aVoid")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dCorrectTitle")} ?open=${this.dlg==="correct"} data-dialog="correct" @close=${()=>this.dlg=""}>
        <div>${s("dCorrectBody")}</div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.correct(t))}>${s("dCorrectGo")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dSentTitle")} ?open=${this.dlg==="sent"} data-dialog="sent" @close=${()=>this.dlg=""}>
        <div class="fld"><span class="lbl">${s("dSentHow")}</span><div class="seg" role="group" aria-label=${s("dSentHow")}>${["email","hand","other"].map(i=>n`<button type="button" data-how=${i} aria-pressed=${this.how===i?"true":"false"} @click=${()=>this.how=i}>${s(_e[i])}</button>`)}</div></div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.markSent(t,this.how))}>${s("save")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dPaidTitle")} ?open=${this.dlg==="paid"} data-dialog="paid" @close=${()=>this.dlg=""}>
        <div class="fld"><label for="wpr">${s("dPaidRef")}</label><input id="wpr" class="ltr" data-reference placeholder=${s("optional")} .value=${this.ref} @input=${i=>this.ref=i.target.value} /></div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>v.markPaid(t,this.ref.trim()))}>${s("save")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dDeleteTitle")} ?open=${this.dlg==="delete"} data-dialog="delete" @close=${()=>this.dlg=""}>
        <div>${s("dDeleteBody")}</div>${e}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{await v.deleteDraft(t),b(gt)})}>${s("aDelete")}</sw-button>${a}
      </elec-dialog>`}render(){return this.access.bills?this.segments[0]?this.renderBill():this.renderList():n`<sw-state-panel state="forbidden" data-water="bills" data-state="forbidden"></sw-state-panel>`}};C.styles=[rt,et];R([M({attribute:!1})],C.prototype,"segments",2);R([M({attribute:!1})],C.prototype,"params",2);R([c()],C.prototype,"access",2);R([c()],C.prototype,"st",2);R([c()],C.prototype,"all",2);R([c()],C.prototype,"sums",2);R([c()],C.prototype,"filter",2);R([c()],C.prototype,"q",2);R([c()],C.prototype,"bill",2);R([c()],C.prototype,"billSt",2);R([c()],C.prototype,"events",2);R([c()],C.prototype,"dlg",2);R([c()],C.prototype,"reason",2);R([c()],C.prototype,"how",2);R([c()],C.prototype,"ref",2);R([c()],C.prototype,"busy",2);R([c()],C.prototype,"error",2);C=R([X("water-bills-page")],C);var qs=Object.defineProperty,Ys=Object.getOwnPropertyDescriptor,H=(t,e,a,r)=>{for(var i=r>1?void 0:r?Ys(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&qs(e,a,i),i};const lt="/infra/water/customers",Gs=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,xe=(t="")=>({name:"",customer_number:t,tax_id:"",address:"",phone:"",email:"",notes:""}),Se=(t=6)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`;let I=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.st="loading",this.list=[],this.q="",this.card=null,this.cardSt="loading",this.form=xe(),this.errs={},this.busy=!1,this.error="",this.confirmDel=!1,this.shown=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.access.bills&&this.loadList()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const e=this.segments[0]??"";e!==this.shown&&(this.shown=e,this.error="",this.errs={},this.confirmDel=!1,e?e==="new"?(this.card=null,this.cardSt="ready",this.form=xe(),v.nextCustomerNumber().then(a=>this.form={...this.form,customer_number:a.customer_number}).catch(()=>{})):this.loadCard(e):this.card=null)}async loadList(){this.st="loading";try{this.list=(await v.listCustomers()).items,this.st="ready"}catch{this.st="error"}}async loadCard(t){this.cardSt="loading";try{const e=await v.customer(t);this.card=e,this.form={name:e.name,customer_number:e.customer_number,tax_id:e.tax_id??"",address:e.address??"",phone:e.phone??"",email:e.email??"",notes:e.notes??""},this.cardSt="ready"}catch{this.cardSt="error"}}validate(){const t={};return this.form.name.trim()||(t.name=s("errName")),this.form.email&&!Gs.test(this.form.email)&&(t.email=s("errEmail")),this.form.customer_number&&!/^\d{1,9}$/.test(this.form.customer_number)&&(t.customer_number=s("errCustNo")),this.errs=t,!Object.keys(t).length}async save(){if(!(this.busy||!this.validate())){this.busy=!0,this.error="";try{const t={...this.form,name:this.form.name.trim()};if(this.card){const e={...t};t.customer_number===this.card.customer_number&&delete e.customer_number,this.card=await v.updateCustomer(this.card.id,{...e,base_revision:this.card.revision}),await this.loadList()}else{const e=await v.createCustomer({...t,customer_number:t.customer_number||void 0});await this.loadList(),b(`${lt}/${e.id}`)}}catch(t){const e=t instanceof mt?t.body.details?.fields:void 0;e?.length?this.errs=Object.fromEntries(e.map(a=>[a,N(t)])):this.error=N(t)}finally{this.busy=!1}}}async removeRecord(){if(!(!this.card||this.busy)){this.busy=!0;try{await v.deleteCustomer(this.card.id,this.card.revision),this.confirmDel=!1,await this.loadList(),b(lt)}catch(t){this.confirmDel=!1,this.error=t instanceof mt&&t.status===409?N(t)||s("cDeleteRefused"):N(t)}finally{this.busy=!1}}}field(t,e,a={}){const r=this.errs[t],i=!this.access.manage,o=l=>{this.form={...this.form,[t]:l},this.errs[t]&&(this.errs={...this.errs,[t]:""})};return n`<div class="fld ${a.wide?"wide":""}"><label for="wc-${t}">${s(e)}</label>
      ${a.area?n`<textarea id="wc-${t}" name=${t} ?readonly=${i} .value=${this.form[t]} @input=${l=>o(l.target.value)}></textarea>`:n`<input id="wc-${t}" name=${t} class="${a.ltr?"ltr":""} ${r?"err":""}" aria-invalid=${r?"true":"false"} ?readonly=${i} .value=${this.form[t]} @input=${l=>o(l.target.value)} />`}
      ${r?n`<div class="msg" role="alert" data-field-error=${t}>${r}</div>`:d}</div>`}renderCard(){const t=this.card,e=!!t&&(t.account_count>0||t.energy_account_count>0);return n`<sw-sheet open wide .heading=${s(t?"customerCard":"newCustomer")} data-customer-card @close=${()=>b(lt)}>
      <div class="col">
        ${this.cardSt==="loading"?Se(4):this.cardSt==="error"?n`<sw-state-panel state="error" compact heading=${s("loadCustomerError")} actionLabel=${s("retry")} @action=${()=>void this.loadCard(this.segments[0])}></sw-state-panel>`:n`
          <div class="form">${this.field("name","cName",{wide:!0})}${this.field("customer_number","cNumber",{ltr:!0})}${this.field("tax_id","cTaxId",{ltr:!0})}
            ${this.field("address","cAddress",{wide:!0})}${this.field("phone","cPhone",{ltr:!0})}${this.field("email","cEmail",{ltr:!0})}${this.field("notes","cNotes",{wide:!0,area:!0})}</div>
          <div class="mut">${s("cShared")}</div>
          ${t?n`<b class="h3">${s("accounts")}</b>
            <div class="list" data-customer-accounts>${(t.accounts??[]).map(a=>n`<a class="li" href=${`#/infra/water/accounts/${a.id}`}><div class="grow"><div class="t1">${a.name}</div></div>${a.status==="paused"?n`<span class="chip c-mut">${s("accPaused")}</span>`:d}</a>`)}${t.accounts?.length?d:n`<div class="mut">${s("cNoAccounts")}</div>`}</div>
            ${t.bills?.length?n`<b class="h3">${s("cRecentBills")}</b>${re(t.bills.slice(0,4),!0)}`:d}`:d}
          ${this.error?n`<div class="alert err" role="alert" data-customer-error>${this.error}</div>`:d}
          ${this.access.manage?n`<div class="row formacts"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("save")}</sw-button><span class="sp"></span>
            ${t?n`<sw-button variant="danger" data-delete title=${e?s("cDeleteRefused"):""} @click=${()=>{e?this.error=s("cDeleteRefused"):this.confirmDel=!0}}>${s("cDelete")}</sw-button>`:d}</div>`:d}`}
        <elec-dialog heading=${s("cDelete")} ?open=${this.confirmDel} data-dialog="delete-customer" @close=${()=>this.confirmDel=!1}>
          <div>${s("cDeleteBody")}</div>
          <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeRecord()}>${s("cDelete")}</sw-button>
          <sw-button slot="actions" @click=${()=>this.confirmDel=!1}>${s("cancel")}</sw-button>
        </elec-dialog>
      </div>
    </sw-sheet>`}render(){if(!this.access.bills)return n`<sw-state-panel state="forbidden" data-water="customers" data-state="forbidden"></sw-state-panel>`;const t=this.q.trim(),e=this.list.filter(i=>!t||i.name.includes(t)||i.customer_number.includes(t)||(i.address??"").includes(t)),a=n`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-cust-search placeholder=${s("custSearch")} aria-label=${s("custSearch")} .value=${this.q} @input=${i=>this.q=i.target.value} /></label>
      <span class="sp"></span>
      ${this.access.manage?n`<sw-button variant="primary" icon="plus" data-new-customer @click=${()=>b(`${lt}/new`)}>${s("newCustomer")}</sw-button>`:d}
    </div>`;let r;return this.st==="loading"?r=Se(5):this.st==="error"?r=n`<sw-state-panel state="error" heading=${s("loadCustomersError")} actionLabel=${s("retry")} @action=${()=>void this.loadList()}></sw-state-panel>`:this.list.length?e.length?r=n`<div class="card flush scrollx desk-only"><table class="t" data-cust-table>
          <thead><tr><th>${s("colCustNo")}</th><th>${s("colName")}</th><th>${s("colAddress")}</th><th>${s("colPhone")}</th><th>${s("colEmail")}</th><th class="n">${s("colAccounts")}</th><th class="n">${s("colBalance")}</th></tr></thead>
          <tbody>${e.map(i=>n`<tr class="go" data-customer-row=${i.id} @click=${()=>b(`${lt}/${i.id}`)}>
            <td class="num" style="text-align:start">${i.customer_number}</td><td class="b"><a class="rowlink" href=${`#${lt}/${i.id}`} @click=${o=>o.stopPropagation()}>${i.name}</a></td>
            <td>${i.address??""}</td><td class="num" style="text-align:start">${i.phone??""}</td><td class="num" style="text-align:start">${i.email??""}</td>
            <td class="n"><span class="num">${i.account_count}</span></td><td class="n"><span class="num">${i.open_balance!==void 0?k(i.open_balance):""}</span></td></tr>`)}</tbody></table></div>
        <div class="list phone-only" style="flex-direction:column" data-cust-rows>${e.map(i=>n`<a class="li" href=${`#${lt}/${i.id}`} data-customer-row=${i.id}>
          <div class="grow"><div class="t1">${i.name} · <span class="num">${i.customer_number}</span></div><div class="t2">${i.address??""}${i.phone?n` · <span class="num">${i.phone}</span>`:d}</div></div>
          <div class="rowend"><div class="t2 num">${i.open_balance!==void 0?k(i.open_balance):""}</div></div></a>`)}</div>`:r=n`<sw-state-panel icon="search" state="empty" compact heading=${s("noCustomers")}></sw-state-panel>`:r=n`<sw-state-panel icon="users" state="empty" heading=${s("emptyCustomers")}></sw-state-panel>`,n`<div class="page" data-water="customers" data-state=${this.st}>${a}${r}${this.segments[0]?this.renderCard():d}</div>`}};I.styles=[rt,et];H([M({attribute:!1})],I.prototype,"segments",2);H([M({attribute:!1})],I.prototype,"params",2);H([c()],I.prototype,"access",2);H([c()],I.prototype,"st",2);H([c()],I.prototype,"list",2);H([c()],I.prototype,"q",2);H([c()],I.prototype,"card",2);H([c()],I.prototype,"cardSt",2);H([c()],I.prototype,"form",2);H([c()],I.prototype,"errs",2);H([c()],I.prototype,"busy",2);H([c()],I.prototype,"error",2);H([c()],I.prototype,"confirmDel",2);I=H([X("water-customers-page")],I);var Js=Object.defineProperty,Qs=Object.getOwnPropertyDescriptor,j=(t,e,a,r)=>{for(var i=r>1?void 0:r?Qs(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Js(e,a,i),i};let F=class extends ns{constructor(){super({viewKey:"sw.water.meters.view",collapseKey:"sw.water.meters.collapsed",route:"/infra/water/meters",access:at,onAccess:it}),this.open=[],this.night={},this.rules=vt,this.snooze=null,this.cq="",this.cands=[],this.candPhase="idle",this.picked=null,this.newName="",this.newKind="sub",this.adding=!1,this.addError="",this.loadedEvents=null,this.candTimer=0}disconnectedCallback(){window.clearTimeout(this.candTimer),super.disconnectedCallback()}willUpdate(t){t.has("params")&&this.params.get("add")==="1"&&this.candPhase==="idle"&&this.access.manage&&this.searchCands()}texts(){return{search:s("search"),view:s("view"),cards:s("cards"),table:s("table"),area:s("area"),areas:s("areas"),allAreas:s("allAreas"),fold:s("fold"),unfold:s("unfold"),addMeter:s("addMeter"),loadError:s("loadMetersError"),retry:s("retry")}}async fetchMeters(){const[t,e]=await Promise.all([w.listMeters(),w.events("open").catch(()=>null)]);return this.loadedEvents=e,t}async afterLoad(t,e){const a=this.loadedEvents;if(a&&(this.open=a.items),t){const r=await At();r&&(this.rules=r.rules,this.snooze=r.snooze),this.night=await Oe(e,this.rules)}}areaTree(){return vs(this.meters)}inArea(t,e){const a=e.startsWith("floor:")?e.slice(6):null;return a!==null?(t.floor_id??"")===a:Le(t)===e}matchesSearch(t,e){return`${t.display_name} ${t.device_name??""} ${t.area_name??""}`.toLowerCase().includes(e)}openMeter(t){this.setParams({meter:t.id,add:null})}chip(t){return Ue(t,xt(t.id,this.open))}renderTiles(){const t=this.meters.filter(i=>i.status!=="retired"),e=i=>t.some(o=>o[i]!=null)?t.reduce((o,l)=>o+(l[i]??0),0)/1e3:null,a=t.filter(i=>i.state==="reporting").length,r=t.filter(i=>xt(i.id,this.open)==="leak").length;return n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tToday")}</div><div class="v"><span class="num" data-t="today">${y(e("today_l"))}</span><span class="u">${s("m3")}</span></div></div>
      <div class="tile"><div class="k">${s("tMonth")}</div><div class="v"><span class="num" data-t="month">${y(e("month_l"))}</span><span class="u">${s("m3")}</span></div></div>
      <div class="tile"><div class="k">${s("tReporting")}</div><div class="v"><span class="num" data-t="reporting">${a}</span><span class="u">${s("tOf",{n:t.length})}</span></div></div>
      <div class="tile"><div class="k">${s("tLeak")}</div><div class="v ${r?"alarm":""}" data-t-leak><span class="num" data-t="leaks">${r}</span><span class="u">${s("tMeters")}</span></div></div>
    </div>`}renderTable(t){return n`<div class="card flush scrollx desk-only"><table class="t" data-meters-table>
      <thead><tr><th>${s("colName")}</th><th>${s("colArea")}</th><th class="n">${s("colReading")}</th><th class="n">${s("colToday")}</th><th class="n dsk">${s("colMonth")}</th><th class="n">${s("colNight")}</th><th>${s("colState")}</th></tr></thead>
      <tbody>${t.map(e=>n`<tr class="pick" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
        <td class="b">${e.display_name}</td><td>${e.area_name??"-"}<span class="mut dsk">${e.floor_name?` · ${e.floor_name}`:""}</span></td>
        <td class="n"><span class="num">${Q(e.value_l)}</span></td><td class="n"><span class="num">${Q(e.today_l)}</span></td><td class="n dsk"><span class="num">${Q(e.month_l)}</span></td>
        <td class="n"><span class="num ${xt(e.id,this.open)==="leak"?"bad":""}">${Ct(this.night[e.id])}</span></td>
        <td>${this.chip(e)}</td></tr>`)}</tbody></table></div>`}renderCards(t){return n`<div class="cards desk-only" data-meters-cards>${t.map(e=>n`<div class="card mcard" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="row"><b>${e.display_name}</b><span class="sp"></span>${this.chip(e)}</div>
      <div class="mut">${e.area_name??""}${e.floor_name?` · ${e.floor_name}`:""}</div>
      <div class="row base"><span class="big num">${Q(e.today_l)}</span><span class="mut">${s("todayM3")}</span><span class="sp"></span><span class="mut num">${Q(e.value_l)}</span></div>
      <div class="mut">${s("colNight")} <span class="num">${Ct(this.night[e.id])}</span>${typeof this.night[e.id]=="number"?` ${s("lph")}`:""}</div></div>`)}</div>`}renderRows(t){return n`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${t.map(e=>n`<div class="li pick" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="grow"><div class="t1">${e.display_name}</div><div class="t2">${e.area_name??""} · ${s("tToday")} <span class="num">${Q(e.today_l)}</span> ${s("m3")}</div></div>
      <div class="rowend">${this.chip(e)}<div class="t2 num">${Q(e.value_l)}</div></div></div>`)}</div>`}openAdd(){this.picked=null,this.newName="",this.newKind="sub",this.addError="",this.cq="",this.setParams({add:"1",meter:null}),this.searchCands()}async searchCands(){this.candPhase="loading";try{this.cands=await w.candidates(this.cq.trim()),this.candPhase="ready"}catch{this.candPhase="error"}}onCq(t){this.cq=t,window.clearTimeout(this.candTimer),this.candTimer=window.setTimeout(()=>void this.searchCands(),300)}pick(t){t.verdict==="rejected"||t.already_meter_id||(this.picked=t,this.newName=t.device_name||t.name)}async confirmAdd(){const t=this.picked;if(!(!t||this.adding)){if(!this.newName.trim())return void(this.addError=s("nameRequired"));this.adding=!0,this.addError="";try{await w.createMeter({source_ref:t.ref,display_name:this.newName.trim(),kind:this.newKind}),this.setParams({add:null}),this.notice=s("added"),window.setTimeout(()=>this.notice="",5e3),await this.load(!1)}catch(e){this.addError=N(e)}finally{this.adding=!1}}}renderAdd(){return this.params.get("add")==="1"&&this.access.manage?n`<sw-dialog open wide heading=${s("addTitle")} data-add-dialog @close=${()=>this.setParams({add:null})}>
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-cand-search placeholder=${s("candSearch")} aria-label=${s("candSearch")} .value=${this.cq} @input=${e=>this.onCq(e.target.value)} /></label>
      <div class="cand list" data-candidates>
        ${this.candPhase==="loading"?n`<sw-state-panel state="loading" compact></sw-state-panel>`:d}
        ${this.candPhase==="error"?n`<sw-state-panel state="error" compact actionLabel=${s("retry")} @action=${()=>void this.searchCands()}></sw-state-panel>`:d}
        ${this.candPhase==="ready"&&!this.cands.length?n`<sw-state-panel icon="drop" state="empty" compact heading=${s("candNone")}></sw-state-panel>`:d}
        ${this.candPhase==="ready"?this.cands.map(e=>{const a=e.verdict==="rejected"||!!e.already_meter_id;return n`<div class="li ${a?"dis":"pick"}" role="button" tabindex=${a?-1:0} aria-disabled=${a?"true":"false"} aria-pressed=${this.picked?.ref===e.ref?"true":"false"} data-cand=${e.ref}
                @click=${()=>this.pick(e)} @keydown=${r=>{(r.key==="Enter"||r.key===" ")&&(r.preventDefault(),this.pick(e))}}>
                <div class="grow"><div class="t1">${e.device_name||e.name}</div><div class="t2 wrap">${[e.area_name,e.unit].filter(Boolean).join(" · ")}${e.verdict!=="accepted"&&e.message?n` · <span class=${e.verdict==="rejected"?"bad":""}>${e.message}</span>`:d}</div></div>
                ${a?n`<span class="chip c-mut nodot">${s("candRejected")}</span>`:d}</div>`}):d}
      </div>
      ${this.picked?n`<div class="formgrid">
            <div class="fld"><label for="wnm">${s("meterName")}</label><div class="inp"><input id="wnm" data-add-name .value=${this.newName} @input=${e=>this.newName=e.target.value} /></div></div>
            <div class="fld"><label for="wnk">${s("meterKind")}</label><div class="inp"><select id="wnk" data-add-kind @change=${e=>this.newKind=e.target.value}>${Ie.map(e=>n`<option value=${e} ?selected=${e===this.newKind}>${Rt(e)}</option>`)}</select></div></div>
          </div>`:d}
      ${this.addError?n`<div class="alert err" role="alert" data-add-error>${this.addError}</div>`:d}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked||this.adding} @click=${()=>void this.confirmAdd()}>${s("add")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.setParams({add:null})}>${s("cancel")}</sw-button>
    </sw-dialog>`:d}frame(t,e){return n`<div class=${t==="ready"?"page":d} data-water="meters" data-state=${t} aria-busy=${t==="loading"?"true":d}>${e}</div>`}renderForbidden(){return n`<sw-state-panel state="forbidden" data-water="meters" data-state="forbidden"></sw-state-panel>`}skeletonRow(t){return n`<div class="row skrow">${t}</div>`}renderEmpty(t){return n`<sw-state-panel icon="drop" state="empty" heading=${s("emptyMeters")}>${t}</sw-state-panel>`}renderNoResults(){return n`<sw-state-panel icon="drop" state="empty" compact heading=${s("noResults")} data-no-results></sw-state-panel>`}renderCard(t){return n`<water-meter-card .meterId=${t} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} .night=${this.night[t]}
          @close=${()=>this.setParams({meter:null})} @changed=${()=>void this.load(!1)}></water-meter-card>`}};F.styles=[rt,is,Vt`
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
    `,rs,et];j([c()],F.prototype,"open",2);j([c()],F.prototype,"night",2);j([c()],F.prototype,"rules",2);j([c()],F.prototype,"snooze",2);j([c()],F.prototype,"cq",2);j([c()],F.prototype,"cands",2);j([c()],F.prototype,"candPhase",2);j([c()],F.prototype,"picked",2);j([c()],F.prototype,"newName",2);j([c()],F.prototype,"newKind",2);j([c()],F.prototype,"adding",2);j([c()],F.prototype,"addError",2);F=j([X("water-meters-page")],F);var Xs=Object.defineProperty,Zs=Object.getOwnPropertyDescriptor,E=(t,e,a,r)=>{for(var i=r>1?void 0:r?Zs(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Xs(e,a,i),i};const ta=[1440,10080,43200],Ae=/^\d{1,6}(\.\d{1,4})?$/,Ce=(t=5)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div></div>`)}</div>`;let z=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.tariffs=null,this.tariffsErr=!1,this.shared=null,this.cfg=null,this.cfgLoaded=!1,this.snooze=yt,this.addN="30",this.addU="min",this.snoozeErr="",this.notice="",this.vf=null,this.vErr="",this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.loadPrices(),this.loadAlerts()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}get section(){const t=this.params.get("set");return t==="alerts"?"alerts":t==="prices"||this.access.manage||this.access.bills?"prices":"alerts"}async loadPrices(){if(!(!this.access.manage&&!this.access.bills))try{const[t,e]=await Promise.all([v.listTariffs(),v.sharedSettings().catch(()=>null)]);this.tariffs=t.items,this.shared=e,this.tariffsErr=!1}catch{this.tariffsErr=!0,this.tariffs=[]}}async loadAlerts(){const t=await At(!0);this.cfg=t,this.snooze=t?{...t.snooze,durations:[...t.snooze.durations]}:{...yt,durations:[...yt.durations]},this.cfgLoaded=!0}flash(t){this.notice=t,window.setTimeout(()=>this.notice="",4e3)}openVersion(t){const e=t?.current;this.vErr="",this.vf={tariffId:t?.id??null,name:"",from:new Date().toISOString().slice(0,10),water:e?.water_price??"",sewage:e?.sewage_price??"0",mode:e?.price_mode??this.shared?.default_price_mode??"ex_vat"}}async saveVersion(){const t=this.vf;if(!(!t||this.busy)){if(!t.tariffId&&!t.name.trim())return void(this.vErr=s("errName"));if(!/^\d{4}-\d{2}-\d{2}$/.test(t.from))return void(this.vErr=s("errDate"));if(!Ae.test(t.water.trim())||Number(t.water)<=0||!Ae.test(t.sewage.trim()||"0"))return void(this.vErr=s("errPrice"));this.busy=!0,this.vErr="";try{const e={effective_from:t.from,water_price:t.water.trim(),sewage_price:t.sewage.trim()||"0",price_mode:t.mode};t.tariffId?await v.addVersion(t.tariffId,e):await v.createTariff({name:t.name.trim(),...e}),this.vf=null,this.flash(s("saved")),await this.loadPrices()}catch(e){this.vErr=N(e)}finally{this.busy=!1}}}async deleteVersion(t,e){if(!this.busy){this.busy=!0,this.error="";try{await v.deleteVersion(t.id,e.id),await this.loadPrices()}catch(a){this.error=N(a)}finally{this.busy=!1}}}sharedLink(){const t=this.shared?.edit_link??"";return t.startsWith("#/system/")?t:Te}renderPrices(){if(!this.access.manage&&!this.access.bills)return n`<sw-state-panel state="forbidden" compact></sw-state-panel>`;if(this.tariffs===null)return Ce();const t=this.shared?.vat.current?.rate_percent??null,e=this.access.manage,a=this.tariffsErr?n`<sw-state-panel state="error" heading=${s("loadTariffsError")} actionLabel=${s("retry")} @action=${()=>void this.loadPrices()}></sw-state-panel>`:n`${this.tariffs.length?d:n`<sw-state-panel icon="drop" state="empty" compact heading=${s("noTariffs")}></sw-state-panel>`}
        ${this.tariffs.map(i=>n`<div class="card flush" data-tariff=${i.id}>
          <div class="hd" style="padding:14px 16px 0"><b>${i.name}</b><span class="sp"></span><span class="mut">${s("usedBy",{n:i.used_by})}</span>
            ${e?n`<sw-button size="sm" data-new-version @click=${()=>this.openVersion(i)}>${s("newVersion")}</sw-button>`:d}</div>
          <div class="scrollx"><table class="t"><thead><tr><th>${s("colFrom")}</th><th class="n">${s("colWaterM3")}</th><th class="n">${s("colSewageM3")}</th><th class="n">${s("colIncVat")}</th><th></th></tr></thead>
            <tbody>${i.versions.map(o=>{const l=o.price_inc_vat??_s(o.water_price,o.sewage_price,o.price_mode,i.vat_rate_percent??t);return n`<tr data-version=${o.id}><td class="num" style="text-align:start">${J(o.effective_from)} ${i.current?.id===o.id?n`<span class="chip c-ok nodot">${s("current")}</span>`:d}${o.locked?n` <span class="chip c-mut nodot" data-locked>${s("locked")}</span>`:d}</td>
                <td class="n"><span class="num">${k(o.water_price)}</span></td><td class="n"><span class="num">${k(o.sewage_price)}</span></td><td class="n"><span class="num">${l===null?"-":k(l)}</span></td>
                <td class="n">${e&&!o.locked&&i.versions.length>1?n`<sw-button variant="ghost" size="sm" iconOnly icon="trash" label=${s("delVersion")} ?disabled=${this.busy} @click=${()=>void this.deleteVersion(i,o)}></sw-button>`:d}</td></tr>`})}</tbody></table></div></div>`)}
        ${e?n`<sw-button icon="plus" style="align-self:flex-start" data-new-tariff @click=${()=>this.openVersion(null)}>${s("newTariff")}</sw-button>`:d}`,r=n`<div class="card" data-card="shared"><div class="hd"><b>${s("sharedTitle")}</b></div>
      <div class="mut" style="margin-block-end:10px">${s("sharedNote")}</div>
      <dl class="kv"><dt>${s("vatInForce")}</dt><dd class="num" data-vat>${t===null?"-":`${t}%`}</dd></dl>
      <a class="btn sm" style="margin-block-start:10px;align-self:flex-start" href=${this.sharedLink()} data-shared-link>${s("toShared")}</a></div>`;return n`<div class="cols side"><div class="col">${a}${this.error?n`<div class="alert err" role="alert">${this.error}</div>`:d}</div><div class="col">${r}</div></div>`}renderVersionDialog(){const t=this.vf;if(!t)return d;const e=(a,r)=>this.vf={...t,[a]:r};return n`<elec-dialog open heading=${t.tariffId?s("newVersion"):s("newTariff")} data-dialog="version" @close=${()=>this.vf=null}>
      <div class="formgrid">
        ${t.tariffId?d:n`<div class="fld wide"><label for="wtn">${s("tariffName")}</label><input id="wtn" data-tariff-name .value=${t.name} @input=${a=>e("name",a.target.value)} /></div>`}
        <div class="fld"><label for="wtf">${s("colFrom")}</label><input id="wtf" type="date" lang=${Me()} class="ltr" .value=${t.from} @change=${a=>e("from",a.target.value)} /></div>
        <div class="fld"><span class="lbl">${s("priceMode")}</span><div class="seg" role="group" aria-label=${s("priceMode")}>
          <button type="button" aria-pressed=${t.mode==="ex_vat"?"true":"false"} @click=${()=>e("mode","ex_vat")}>${s("modeEx")}</button>
          <button type="button" aria-pressed=${t.mode==="inc_vat"?"true":"false"} @click=${()=>e("mode","inc_vat")}>${s("modeInc")}</button></div></div>
        <div class="fld"><label for="wtw">${s("colWaterM3")}</label><input id="wtw" class="ltr" inputmode="decimal" data-water-price .value=${t.water} @input=${a=>e("water",a.target.value)} /></div>
        <div class="fld"><label for="wts">${s("colSewageM3")}</label><input id="wts" class="ltr" inputmode="decimal" data-sewage-price .value=${t.sewage} @input=${a=>e("sewage",a.target.value)} /></div>
      </div>
      ${this.vErr?n`<div class="alert err" role="alert">${this.vErr}</div>`:d}
      <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.saveVersion()}>${s("save")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.vf=null}>${s("cancel")}</sw-button>
    </elec-dialog>`}setSnooze(t){this.snooze=t,this.snoozeErr=qt(t)??""}addDuration(){const t=ys(Number(this.addN),this.addU);!Number.isFinite(t)||t<=0||this.snooze.durations.includes(t)||this.setSnooze({...this.snooze,durations:[...this.snooze.durations,t].sort((e,a)=>e-a)})}removeDuration(t){const e=this.snooze;if(e.durations.length<2)return void(this.snoozeErr=s("keepOne"));const a=e.durations.filter(r=>r!==t);this.setSnooze({...e,durations:a,default:a.includes(e.default)?e.default:a[0]})}async saveSnooze(){const t=qt(this.snooze);if(t)return void(this.snoozeErr=t);if(!this.busy){this.busy=!0,this.snoozeErr="";try{const e=await w.saveSnooze(this.snooze,this.cfg?.row_version);this.cfg=this.cfg?{...this.cfg,snooze:e.snooze,row_version:e.row_version}:e,await At(!0),this.flash(s("saved"))}catch(e){this.snoozeErr=e instanceof mt&&e.code==="revision_conflict"?s("conflict"):N(e),e instanceof mt&&e.code==="revision_conflict"&&await this.loadAlerts()}finally{this.busy=!1}}}renderAlerts(){if(!this.cfgLoaded)return Ce();const t=this.access.configure&&(this.cfg?.can_edit??!0),e=this.snooze,a=this.cfg?.rules??vt,r=[...new Set([...ta,e.max])].sort((o,l)=>o-l),i=JSON.stringify(e)!==JSON.stringify(this.cfg?.snooze??yt);return n`<div class="cols side"><div class="col"><div class="card" data-card="snooze"><div class="hd"><b>${s("snoozeCard")}</b></div>
        <div class="fld"><span class="lbl">${s("snoozeDurations")}</span><div class="chips-ed" data-sn-chips>
          ${e.durations.map(o=>n`<span class="chip nodot" data-duration=${o}>${tt(o)}${t?n`<button type="button" aria-label=${s("removeDuration",{d:tt(o)})} data-sn-del=${o} @click=${()=>this.removeDuration(o)}><sw-icon name="close" size="13"></sw-icon></button>`:d}</span>`)}
          ${t?n`<span class="row" style="gap:6px;flex-wrap:nowrap"><input type="number" min="1" aria-label=${s("snoozeAddValue")} style="inline-size:76px" data-sn-n .value=${this.addN} @input=${o=>this.addN=o.target.value} />
            <select aria-label=${s("snoozeUnit")} style="inline-size:96px" data-sn-u @change=${o=>this.addU=o.target.value}>
              <option value="min" ?selected=${this.addU==="min"}>${s("uMin")}</option><option value="hour" ?selected=${this.addU==="hour"}>${s("uHour")}</option><option value="day" ?selected=${this.addU==="day"}>${s("uDay")}</option></select>
            <sw-button size="sm" data-sn-add @click=${()=>this.addDuration()}>${s("add")}</sw-button></span>`:d}</div></div>
        <div class="formgrid" style="margin-block-start:12px">
          <div class="fld"><label for="sn-def">${s("snoozeDefault")}</label><select id="sn-def" data-sn-def ?disabled=${!t} @change=${o=>this.setSnooze({...e,default:Number(o.target.value)})}>${e.durations.map(o=>n`<option value=${o} ?selected=${o===e.default}>${tt(o)}</option>`)}</select></div>
          <div class="fld"><label for="sn-max">${s("snoozeMax")}</label><select id="sn-max" data-sn-max ?disabled=${!t} @change=${o=>this.setSnooze({...e,max:Number(o.target.value)})}>${r.map(o=>n`<option value=${o} ?selected=${o===e.max}>${tt(o)}</option>`)}</select></div>
        </div>
        ${this.snoozeErr?n`<div class="msg" role="alert" data-sn-error>${this.snoozeErr}</div>`:d}
        ${t?n`<div class="row" style="margin-block-start:12px"><sw-button variant="primary" data-sn-save ?disabled=${this.busy||!i||!!qt(e)} @click=${()=>void this.saveSnooze()}>${s("save")}</sw-button></div>`:n`<div class="mut" style="margin-block-start:10px">${s("noConfigure")}</div>`}
      </div></div>
      <div class="col"><div class="card" data-card="rules"><div class="hd"><b>${s("rulesCard")}</b></div><dl class="kv">
        <dt>${s("rWindow")}</dt><dd class="num">${a.night_from}-${a.night_to}</dd><dt>${s("rThreshold")}</dt><dd>${a.night_min_lph} ${s("lph")}</dd><dt>${s("rDuration")}</dt><dd>${We(a.night_min_intervals*15)}</dd></dl>
        <div class="mut" style="margin-block-start:8px">${s("rulesReadonly")}</div></div></div></div>`}render(){if(!this.access.manage&&!this.access.configure)return n`<sw-state-panel state="forbidden" data-water="settings" data-state="forbidden"></sw-state-panel>`;const t=this.section,e=a=>b("/infra/water/settings",{set:a});return n`<div class="page" data-water="settings" data-state="ready" data-section=${t}>
      <div class="seg sect-nav" role="group" aria-label=${s("sections")} data-set-nav>
        ${this.access.manage||this.access.bills?n`<button type="button" data-set="prices" aria-pressed=${t==="prices"?"true":"false"} @click=${()=>e("prices")}>${s("sTariffs")}</button>`:d}
        <button type="button" data-set="alerts" aria-pressed=${t==="alerts"?"true":"false"} @click=${()=>e("alerts")}>${s("sAlerts")}</button></div>
      ${this.notice?n`<div class="notice" role="status" data-notice>${this.notice}</div>`:d}
      ${t==="prices"?this.renderPrices():this.renderAlerts()}
      ${this.renderVersionDialog()}
    </div>`}};z.styles=[rt,et];E([M({attribute:!1})],z.prototype,"segments",2);E([M({attribute:!1})],z.prototype,"params",2);E([c()],z.prototype,"access",2);E([c()],z.prototype,"tariffs",2);E([c()],z.prototype,"tariffsErr",2);E([c()],z.prototype,"shared",2);E([c()],z.prototype,"cfg",2);E([c()],z.prototype,"cfgLoaded",2);E([c()],z.prototype,"snooze",2);E([c()],z.prototype,"addN",2);E([c()],z.prototype,"addU",2);E([c()],z.prototype,"snoozeErr",2);E([c()],z.prototype,"notice",2);E([c()],z.prototype,"vf",2);E([c()],z.prototype,"vErr",2);E([c()],z.prototype,"busy",2);E([c()],z.prototype,"error",2);z=E([X("water-settings-page")],z);var ea=Object.defineProperty,sa=Object.getOwnPropertyDescriptor,K=(t,e,a,r)=>{for(var i=r>1?void 0:r?sa(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&ea(e,a,i),i};const ze={today:"rToday","7d":"r7d","30d":"r30d",prev:"rPrevMonth"},De="sw.water.usage.range",St=t=>String(t).padStart(2,"0"),He=t=>`${t.getFullYear()}-${St(t.getMonth()+1)}-${St(t.getDate())}`,Ut=t=>{const[e,a]=t.split(":").map(Number);return e*60+(a||0)};function Gt(t,e=new Date){const a=new Date(e.getFullYear(),e.getMonth(),e.getDate());if(t==="today")return{from:a,to:e,days:1};if(t==="prev"){const i=new Date(e.getFullYear(),e.getMonth()-1,1),o=new Date(e.getFullYear(),e.getMonth(),1);return{from:i,to:o,days:Math.round((o.getTime()-i.getTime())/864e5)}}const r=t==="7d"?7:30;return{from:new Date(a.getFullYear(),a.getMonth(),a.getDate()-(r-1)),to:e,days:r}}function aa(t,e,a,r){const i=Ut(a.night_from),o=Ut(a.night_to),l=p=>{const h=p.getHours()*60+p.getMinutes();return i<=o?h>=i&&h<o:h>=i||h<o},u=t.series??[];if(e==="today")return u.map(p=>{const h=new Date(p.start);return{label:St(h.getHours()),value:(p.litres??0)/1e3,win:l(h)}});const f=new Map;for(const p of u){const h=new Date(p.start),O=He(h),g=f.get(O)??{value:0,night:0,d:h};g.value+=(p.litres??0)/1e3,l(h)&&(g.night+=(p.litres??0)/1e3),f.set(O,g)}return[...f.entries()].map(([p,h])=>({label:String(h.d.getDate()),value:h.value,night:h.night,leak:r.has(p),title:`${St(h.d.getDate())}.${St(h.d.getMonth()+1)}: ${y(h.value)} ${s("m3")}, ${s("night")} ${Math.round(h.night*1e3)} ${s("litre")}`}))}let U=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.range=Ns(De,"30d"),this.data=null,this.meters=[],this.leakDays=new Set,this.night={},this.rules=vt,this.phase="loading",this.error="",this.access=at(),this.chartW=640,this.seq=0,this.ro=null,this.observed=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.load()}disconnectedCallback(){this.stop?.(),this.ro?.disconnect(),this.ro=null,this.observed=null,super.disconnectedCallback()}updated(){const t=this.renderRoot.querySelector("[data-usage-chart]");t!==this.observed&&(this.ro?.disconnect(),this.observed=t,!(!t||typeof ResizeObserver!="function")&&(this.ro??=new ResizeObserver(e=>{const a=Math.floor(e[e.length-1].contentRect.width);a>0&&Math.abs(a-this.chartW)>1&&(this.chartW=a)}),this.ro.observe(t)))}async load(){const t=++this.seq;this.phase="loading";const e=Gt(this.range);try{const a=await At();a&&(this.rules=a.rules);const[r,i,o]=await Promise.all([w.consumption(e.from.toISOString(),e.to.toISOString(),"1h"),w.listMeters(),w.events("all").catch(()=>({items:[]}))]);if(t!==this.seq)return;this.data=r,this.meters=i,this.leakDays=new Set(o.items.filter(l=>l.kind==="night_flow").map(l=>He(new Date(l.opened_at)))),this.phase="ready",this.night=await Oe(i,this.rules)}catch(a){if(t!==this.seq)return;this.error=N(a),this.phase="error"}}setRange(t){this.range=t,Ms(De,t),this.load()}csv(){const t=Gt(this.range),e=document.createElement("a");e.href=w.consumptionCsvUrl(t.from.toISOString(),t.to.toISOString(),ie()),e.download="",e.click()}renderHead(){return n`<div class="row head">
      <div class="seg ranges" role="group" aria-label=${s("range")} data-ranges>${["today","7d","30d","prev"].map(t=>n`<button type="button" aria-pressed=${this.range===t?"true":"false"} data-range=${t} @click=${()=>this.setRange(t)}>${s(ze[t])}</button>`)}</div>
      <span class="sp"></span>
      <sw-button icon="download" data-csv ?disabled=${this.phase!=="ready"||!this.data?.items.length} @click=${()=>this.csv()}>${s("csv")}</sw-button>
    </div>`}render(){if(!this.access.view)return n`<sw-state-panel state="forbidden" data-water="usage" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return n`<div class="page" data-water="usage" data-state="loading" aria-busy="true">${this.renderHead()}<div class="card">${Array.from({length:7},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;if(this.phase==="error"||!this.data)return n`<div class="page" data-water="usage" data-state="error">${this.renderHead()}<sw-state-panel state="error" heading=${s("loadUsageError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.load()}></sw-state-panel></div>`;const t=this.data;if(!t.items.length)return n`<div data-water="usage" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${s("emptyUsage")}>${this.access.manage?n`<sw-button variant="primary" icon="plus" data-add-meter @click=${()=>b("/infra/water/meters",{add:"1"})}>${s("addMeter")}</sw-button>`:d}</sw-state-panel></div>`;const e=Gt(this.range),a=t.total_litres,r=t.previous_total_litres,i=a!==null&&r?Math.round((a-r)/r*100):null,o=aa(t,this.range,this.rules,this.leakDays),l=(t.series??[]).filter(m=>{const A=new Date(m.start),Y=A.getHours()*60+A.getMinutes(),nt=Ut(this.rules.night_from),$t=Ut(this.rules.night_to);return m.litres!==null&&(nt<=$t?Y>=nt&&Y<$t:Y>=nt||Y<$t)}),u=l.length?Math.round(l.reduce((m,A)=>m+(A.litres??0),0)/l.length):null,f=`${this.rules.night_from}-${this.rules.night_to}`,p=new Map(this.meters.map(m=>[m.id,m])),h=[...t.items].sort((m,A)=>(A.litres??-1)-(m.litres??-1)),O=(m,A)=>m===null||!A?null:Math.round((m-A)/A*100),g=m=>m===null?"-":`${m>0?"+":""}${m}%`,q=m=>m===null||m===0?"":m>0?"up":"down";return n`<div class="page fit" data-water="usage" data-state="ready">
      ${this.renderHead()}
      <div class="tiles" data-tiles>
        <div class="tile"><div class="k">${s("tTotal")}</div><div class="v"><span class="num" data-t="total">${y(a===null?null:a/1e3)}</span><span class="u">${s("m3")}</span></div></div>
        <div class="tile"><div class="k">${s("tVsPrev")}</div><div class="v ${q(i)}"><span class="num" data-t="vs">${g(i)}</span></div></div>
        <div class="tile"><div class="k">${s("tDailyAvg")}</div><div class="v"><span class="num" data-t="avg">${y(a===null?null:a/1e3/Math.max(1,e.days))}</span><span class="u">${s("m3")}</span></div></div>
        <div class="tile"><div class="k">${s("tNightAvg")}</div><div class="v"><span class="num" data-t="night">${u??"-"}</span><span class="u">${s("lph")}</span></div></div>
      </div>
      <div class="card">
        <div class="hd"><h3 class="sec">${this.range==="today"?s("hourlyUsage"):s("dailyUsage")}</h3><span class="sp"></span>
          <div class="legend"><span><i style="background:var(--sw-accent)"></i>${s("legendDay")}</span><span><i style="background:color-mix(in srgb, var(--sw-heading, var(--sw-text)) 55%, var(--sw-surface-3))"></i>${s("legendNight",{w:f})}</span><span><i style="background:var(--sw-danger)"></i>${s("legendLeak")}</span></div></div>
        <div class="usage-chart" data-usage-chart>${Ve(o,`${s("dailyUsage")} · ${s(ze[this.range])}`,m=>m.toFixed(m<10?2:1),this.chartW)}</div>
      </div>
      <div class="card flush scrollx desk-only fitbox"><table class="t" data-usage-table>
        <thead><tr><th>${s("colName")}</th><th>${s("colArea")}</th><th class="n">${s("colUsage")}</th><th>${s("colShare")}</th><th class="n">${s("colVsPrev")}</th><th class="n">${s("colNight")}</th></tr></thead>
        <tbody>${h.map(m=>{const A=O(m.litres,m.previous_litres),Y=m.share===null?0:Math.round(m.share*100);return n`<tr data-meter=${m.meter_id}><td class="b">${m.display_name}</td><td>${m.area_name??"-"}<span class="mut dsk">${m.floor_name?` · ${m.floor_name}`:""}</span></td>
            <td class="n"><span class="num">${y(m.litres===null?null:m.litres/1e3)}</span></td>
            <td><span class="share"><i><b style="width:${Y}%"></b></i><span class="num mut">${Y}%</span></span></td>
            <td class="n ${q(A)}"><span class="num">${g(A)}</span></td><td class="n"><span class="num">${p.has(m.meter_id)?Ct(this.night[m.meter_id]):"-"}</span></td></tr>`})}</tbody></table></div>
      <div class="list phone-only" style="flex-direction:column" data-usage-rows>${h.map(m=>{const A=O(m.litres,m.previous_litres);return n`<div class="li"><div class="grow"><div class="t1">${m.display_name}</div><div class="t2">${m.area_name??""} · <span class="num">${m.share===null?0:Math.round(m.share*100)}%</span> · ${s("vsPrevShort")} <span class="num ${q(A)}">${g(A)}</span> · ${s("night")} ${Ct(this.night[m.meter_id])}</div></div>
          <div class="amt num">${y(m.litres===null?null:m.litres/1e3)} ${s("m3")}</div></div>`})}</div>
    </div>`}};U.styles=[rt,et];K([M({attribute:!1})],U.prototype,"segments",2);K([M({attribute:!1})],U.prototype,"params",2);K([c()],U.prototype,"range",2);K([c()],U.prototype,"data",2);K([c()],U.prototype,"meters",2);K([c()],U.prototype,"leakDays",2);K([c()],U.prototype,"night",2);K([c()],U.prototype,"rules",2);K([c()],U.prototype,"phase",2);K([c()],U.prototype,"error",2);K([c()],U.prototype,"access",2);K([c()],U.prototype,"chartW",2);U=K([X("water-usage-page")],U);var ia=Object.defineProperty,ra=Object.getOwnPropertyDescriptor,Ht=(t,e,a,r)=>{for(var i=r>1?void 0:r?ra(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&ia(e,a,i),i};const ee=Xe.map(t=>({id:t.id,label:t.label,tag:`water-${t.id}-page`,money:ts.includes(t.id),manage:Ze.includes(t.id)}));function na(t){const e=t[1]==="water"?t[2]:void 0;return ee.find(a=>a.id===e)?.id??"meters"}function Pe(t,e){return e.view&&(!t.money||e.bills)&&(!t.manage||es(e))}let ft=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.route=null,this.access=at(),this.alerts=us(),this.tabsMode=new Ye(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.stopCount=ps(t=>this.alerts=t),le()}disconnectedCallback(){this.stop?.(),this.stopCount?.(),de(this),this.pagesChip=null,super.disconnectedCallback()}body(t,e){const a=this.access,r=this.route;if(!a.loaded)return n`<sw-state-panel state="loading" data-water=${t} data-state="loading"></sw-state-panel>`;if(a.failed)return n`<sw-state-panel state="error" heading=${s("loadMetersError")} actionLabel=${s("retry")} data-water=${t} data-state="error" @action=${()=>void le()}></sw-state-panel>`;if(!a.enabled)return n`<sw-state-panel state="stale" heading=${s("offTitle")} hint=${s("offHint")} data-water=${t} data-state="off">
        ${a.manage||a.configure?n`<sw-button size="sm" data-to-settings @click=${()=>b(Te.slice(1))}>${s("toSettings")}</sw-button>`:d}
      </sw-state-panel>`;if(!Pe(e,a))return n`<sw-state-panel state="forbidden" data-water=${t} data-state="forbidden"></sw-state-panel>`;if(!customElements.get(e.tag))return n`<sw-state-panel icon="drop" state="empty" heading=${s("noScreen")} data-water=${t} data-state="empty"></sw-state-panel>`;const i=os(e.tag);return ls`<${i} .segments=${(r?.segments??[]).slice(3)} .params=${r?.params??new URLSearchParams}></${i}>`}render(){const t=this.access,e=na(this.route?.segments??[]),a=ee.find(f=>f.id===e),i=t.loaded&&!t.failed&&t.enabled&&t.view?ee.filter(f=>Pe(f,t)):[],o=Ge("infra.water",i.map(f=>({id:f.id,label:f.label,href:`#/infra/water/${f.id}`,...f.id==="alerts"&&this.alerts?{count:this.alerts}:{}})),G()),l=o.length>0&&ds(this.tabsMode.value,o.length);this.pagesChip=l?cs(s("pageRow"),o,e,f=>b(`/infra/water/${f}`)):null;const u=l||!o.length?d:n`<sw-tabs .items=${o} .active=${e} .variant=${Je("infra.water")} data-infra-pages></sw-tabs>`;return n`<sw-page heading=${s("tab")} data-infra-page="water">${u===d?d:n`<div class="rows" data-water-shell>${u}</div>`}<div class="body" data-page=${e}>${this.body(e,a)}</div></sw-page>`}updated(){this.pagesChip?Qe(this,this.pagesChip):de(this)}};ft.styles=[Vt`
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
  `,et];Ht([M({attribute:!1})],ft.prototype,"route",2);Ht([c()],ft.prototype,"access",2);Ht([c()],ft.prototype,"alerts",2);ft=Ht([X("infra-water")],ft);export{ft as InfraWater,ee as WATER_PAGES,Pe as pageAllowed,na as waterPageOf};
