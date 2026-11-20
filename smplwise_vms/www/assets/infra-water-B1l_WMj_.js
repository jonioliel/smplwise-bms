import{br as Re,a2 as H,b5 as S,bW as X,bm as A,bs as Ge,bn as yt,xC as le,bU as de,g as Ut,u as Vt,bG as Je,bH as Qe,aU as et,ax as M,j as c,i as st,aL as ct,yY as at,yZ as it,n as D,Y as w,A as d,b as n,ej as Oe,k as Q,a5 as ut,eC as ae,a as vt,eQ as Ze,y_ as Te,em as Xe,y$ as ce,eo as ue,ep as ts,eq as es,es as ss,z0 as as,z1 as is,z2 as rs,z3 as ns}from"./index-Cwrvr-7C.js";import{t as Le,f as K,a as Ft,m as os,M as ls,b as Yt,c as he,d as ds,e as cs,g as pe,h as us,i as hs,j as ps,k as ms,l as vs}from"./meters-page-base-DHVbrE0o.js";import{e as Fe}from"./styles-CNCJ3iiw.js";import"./sw-table-YC-wBEqU.js";import"./sw-place-tree-C_uxSmm4.js";import{s as fs,u as $s}from"./static-DzpvwdPf.js";import{i as gs,a as bs}from"./infra-pages-DYbYCYgC.js";import"./sw-logo-art-PLtEZJxU.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";const z="infra/water/",ht=t=>{const e=new URLSearchParams;for(const[r,i]of Object.entries(t))i!==void 0&&i!==""&&e.set(r,String(i));const a=e.toString();return a?`?${a}`:""},$t={night_from:"01:00",night_to:"05:00",night_min_lph:6,night_min_intervals:8},_t={durations:[15,60,240,1440],default:60,max:10080},b={listMeters:async()=>H()?(await S(`${z}meters`)).items:[],meter:t=>S(`${z}meters/${encodeURIComponent(t)}`),candidates:async(t="")=>H()?(await S(`${z}candidates${ht({q:t,include_rejected:!0})}`)).items:[],createMeter:t=>A(`${z}meters`,t),patchMeter:(t,e)=>yt(`${z}meters/${encodeURIComponent(t.id)}`,{revision:t.revision,...e}),retireMeter:t=>X(`${z}meters/${encodeURIComponent(t.id)}${ht({revision:t.revision})}`),replaceMeter:(t,e)=>A(`${z}meters/${encodeURIComponent(t.id)}/replace`,{revision:t.revision,...e}),series:async(t,e,a,r)=>H()?(await S(`${z}meters/${encodeURIComponent(t)}/series${ht({from:a,to:r,bucket:e})}`)).items:[],consumption:async(t,e,a)=>H()?S(`${z}consumption${ht({from:t,to:e,bucket:a})}`):{from:t,to:e,items:[],total_litres:null,previous_total_litres:null,series:[]},consumptionCsvUrl:(t,e,a)=>Ge(`${z}consumption.csv${ht({from:t,to:e,lang:a})}`),manualReadings:async t=>H()?(await S(`${z}meters/${encodeURIComponent(t)}/manual-readings`)).items:[],addManual:(t,e)=>A(`${z}meters/${encodeURIComponent(t)}/manual-readings`,e),undoManual:(t,e)=>A(`${z}meters/${encodeURIComponent(t)}/manual-readings/${encodeURIComponent(e)}/undo`,{}),events:async(t,e)=>{if(!H())return{items:[],summary:{open:0,acked:0,last_7d:0,open_leaks:0,snoozed:0}};const a=await S(`${z}events${ht({state:t,meter_id:e})}`);return e||ys(a.summary.open),a},ack:t=>A(`${z}events/${encodeURIComponent(t)}/ack`,{}),snooze:(t,e)=>A(`${z}events/${encodeURIComponent(t)}/snooze`,e===void 0?{}:{minutes:e}),unsnooze:t=>X(`${z}events/${encodeURIComponent(t)}/snooze`),alerts:async()=>H()?S(`${z}alerts`):{rules:$t,snooze:_t,snooze_limits:{min:5,max:43200,count:12},row_version:0,can_edit:!0},saveSnooze:(t,e)=>Re(`${z}alerts`,{snooze:t,row_version:e})};let Gt=0;const Jt=new Set,ws=()=>Gt;function ys(t){if(t!==Gt){Gt=t;for(const e of Jt)e(t)}}function _s(t){return Jt.add(t),()=>Jt.delete(t)}let Dt=null;async function Ct(t=!1){if(!t&&Dt&&Date.now()-Dt.at<6e4)return Dt.cfg;let e=null;try{e=await b.alerts()}catch{e=null}return Dt={at:Date.now(),cfg:e},e}const me=t=>{const[e,a]=t.split(":").map(Number);return(e||0)*60+(a||0)};function ks(t,e=new Date){const a=me(t.night_from),r=me(t.night_to),i=(h,G)=>new Date(h.getFullYear(),h.getMonth(),h.getDate(),Math.floor(G/60),G%60),o=e.getHours()*60+e.getMinutes(),l=new Date(e);o<a&&!(r<a&&o<r)&&l.setDate(l.getDate()-1);const u=i(l,a),m=new Date(u);r<=a&&m.setDate(m.getDate()+1);const p=i(m,r);return{from:u,to:p>e?e:p}}function xs(t){const e=t.map(a=>a.litres).filter(a=>a!=null);return e.length?Math.round(Math.min(...e)*10)/10:null}function Be(t){const e=t.rules?.night_rule;return typeof e=="boolean"?!e:t.kind==="irrigation"}const ve=new Map;async function Ie(t,e){const a={},r=ks(e);return await Promise.all(t.map(async i=>{if(Be(i))return void(a[i.id]="off");if(i.status==="retired"||i.value_l===null)return void(a[i.id]=null);const o=ve.get(i.id);if(o&&Date.now()-o.at<6e5)return void(a[i.id]=o.v);try{const l=xs(await b.series(i.id,"1h",r.from.toISOString(),r.to.toISOString()));ve.set(i.id,{at:Date.now(),v:l}),a[i.id]=l}catch{a[i.id]=null}})),a}const Ue=t=>t.area_id??"_none";function Ss(t,e=le("ללא קומה"),a=le("ללא אזור")){const r=new Map;for(const i of t){const o=i.floor_id??"",l=r.get(o)??{floor_id:o,name:i.floor_name??e,count:0,areas:[]};l.count++;const u=Ue(i),m=l.areas.find(p=>p.area_id===u);m?m.count++:l.areas.push({area_id:u,name:i.area_name??a,count:1}),r.set(o,l)}return[...r.values()]}const $="infra/water/",ot=t=>{const e=new URLSearchParams;for(const[r,i]of Object.entries(t))i!==void 0&&i!==""&&e.set(r,String(i));const a=e.toString();return a?`?${a}`:""},qt=()=>`wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`,f={sharedSettings:()=>S(`${$}billing/shared`),listCustomers:t=>H()?S(`${$}customers${ot({q:t})}`):Promise.resolve({items:[],total:0}),customer:t=>S(`${$}customers/${t}`),nextCustomerNumber:()=>S(`${$}customers/next-number`),createCustomer:t=>A(`${$}customers`,t),updateCustomer:(t,e)=>yt(`${$}customers/${t}`,e),deleteCustomer:(t,e)=>X(`${$}customers/${t}${ot({base_revision:e})}`),listTariffs:()=>H()?S(`${$}tariffs`):Promise.resolve({items:[]}),createTariff:t=>A(`${$}tariffs`,t),renameTariff:(t,e)=>yt(`${$}tariffs/${t}`,{name:e}),deleteTariff:t=>X(`${$}tariffs/${t}`),addVersion:(t,e)=>A(`${$}tariffs/${t}/versions`,e),correctVersion:(t,e,a)=>yt(`${$}tariffs/${t}/versions/${e}`,a),deleteVersion:(t,e)=>X(`${$}tariffs/${t}/versions/${e}`),listAccounts:t=>H()?S(`${$}accounts${ot({q:t})}`):Promise.resolve({items:[],summary:{active:0,drafts:0}}),account:t=>S(`${$}accounts/${t}`),accountStatus:t=>S(`${$}accounts/${t}/status`),accountHistory:(t,e=12)=>S(`${$}accounts/${t}/history${ot({past:e})}`),accountBills:t=>S(`${$}accounts/${t}/bills`),createAccount:t=>A(`${$}accounts`,t),updateAccount:(t,e)=>yt(`${$}accounts/${t}`,e),deleteAccount:(t,e)=>X(`${$}accounts/${t}${ot({base_revision:e})}`),preset:(t,e,a,r)=>A(`${$}formula/preset`,{preset:t,meter_ids:e,main_meter_id:a,percent:r}),listBills:(t={})=>H()?S(`${$}bills${ot(t)}`):Promise.resolve({items:[],total:0,counts:{draft:0,issued:0,sent:0,paid:0,void:0},sums:{open:"0.00",paid:"0.00"}}),bill:t=>S(`${$}bills/${t}`),billEvents:t=>S(`${$}bills/${t}/events`),createBill:(t,e)=>A(`${$}accounts/${t}/bills`,{period:e,client_request_id:qt()}),recalculate:t=>A(`${$}bills/${t.id}/recalculate`,{row_version:t.row_version}),deleteDraft:t=>X(`${$}bills/${t.id}${ot({row_version:t.row_version})}`),issue:(t,e=qt())=>A(`${$}bills/${t.id}/issue`,{row_version:t.row_version,client_request_id:e}),markSent:(t,e,a="")=>A(`${$}bills/${t.id}/sent`,{how:e,note:a,row_version:t.row_version}),markPaid:(t,e="")=>A(`${$}bills/${t.id}/paid`,{reference:e,row_version:t.row_version}),void:(t,e)=>A(`${$}bills/${t.id}/void`,{reason:e,row_version:t.row_version}),correct:t=>A(`${$}bills/${t.id}/correct`,{client_request_id:qt()}),snooze:(t,e)=>A(de`infra/water/events/${t}/snooze`,e===void 0?{}:{minutes:e}),unsnooze:t=>X(de`infra/water/events/${t}/snooze`),saveSnooze:(t,e)=>Re("infra/water/alerts",{snooze:t,row_version:e})},Cs=Ut`
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
  /* CR-CMP2-TABLES-CONSUMPTION-2450: the water tables (sw-table) keep their 9 px rows */
  sw-table.t {
    --sw-table-cell-pad: 9px 12px;
  }
  /* a period's change in a table: a rise in the danger ink, a fall in the success ink (as .up / .down) */
  sw-table.t::part(up) {
    color: var(--sw-danger-text);
  }
  sw-table.t::part(down) {
    color: var(--sw-success-text);
  }
  /* the usage table's share bar (as .share) */
  sw-table.t::part(share) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  sw-table.t::part(share-track) {
    display: inline-block;
    inline-size: 56px;
    block-size: 6px;
    border-radius: 3px;
    background: var(--sw-surface-3);
    overflow: hidden;
  }
  sw-table.t::part(share-fill) {
    display: block;
    block-size: 100%;
    background: var(--sw-accent);
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
`,rt=[Fe,Cs],zs=new Intl.NumberFormat(Vt(),{minimumFractionDigits:3,maximumFractionDigits:3});new Intl.NumberFormat(Vt(),{maximumFractionDigits:1});const As=new Intl.NumberFormat(Vt(),{minimumFractionDigits:2,maximumFractionDigits:2});function y(t){if(t==null||t==="")return"-";const e=typeof t=="number"?t:Number(t);return Number.isFinite(e)?zs.format(e):"-"}function k(t){if(t==null||t==="")return"";const e=typeof t=="number"?t:Number(t);return Number.isFinite(e)?`${As.format(e)} ₪`:""}function fe(t){const e=t.filter(a=>a!=null&&a!==""&&Number.isFinite(Number(a)));return e.length?e.reduce((a,r)=>a+Number(r),0):null}const mt={draft:{label:"טיוטה",cls:"c-mut"},issued:{label:"הונפק",cls:"c-acc"},sent:{label:"נשלח",cls:"c-warn"},paid:{label:"שולם",cls:"c-ok"},void:{label:"בוטל",cls:"c-err"}};function Qt(t){return t.status==="paused"?{label:"מושהה",cls:"c-mut"}:t.stale_meters.length?{label:"מונה לא מדווח",cls:"c-warn"}:{label:"פעיל",cls:"c-ok"}}const $e={off:"בלי יצירה אוטומטית",draft:"ליצור טיוטה",issue:"להנפיק אוטומטית"};function Ve(t,e){return`${t===1?"חודשית":"דו-חודשית"} · מה-${e}`}function Ds(t){return{water:t.filter(e=>e.component==="water"),sewage:t.filter(e=>e.component==="sewage")}}function tt(t){return t<60?`${t} ד׳`:t===60?"שעה":t<1440?t%60===0?`${t/60} שעות`:`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")} שעות`:t===1440?"יממה":t%1440===0?`${t/1440} ימים`:`${Math.round(t/1440*10)/10} ימים`}function ie(t,e,a="Asia/Jerusalem"){const r=new Date(t.getTime()+e*6e4),i=u=>new Intl.DateTimeFormat("en-CA",{timeZone:a,year:"numeric",month:"2-digit",day:"2-digit"}).format(u),o=new Intl.DateTimeFormat(Vt(),{timeZone:a,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(r),l=Math.round((Date.parse(i(r))-Date.parse(i(t)))/864e5);return l<=0?o:l===1?`מחר ${o}`:`${l} ימים, ${o}`}const Pt={min:5,max:43200,count:12};function Ht(t){return!Number.isInteger(t.max)||t.max<Pt.min||t.max>Pt.max?"המקסימום הוא בין 5 דקות ל-30 ימים.":!t.durations.length||t.durations.length>Pt.count?"יש להציע בין משך אחד ל-12 משכים.":t.durations.some(e=>!Number.isInteger(e)||e<Pt.min||e>t.max)?"משך נדנוד ארוך מהמקסימום.":t.durations.includes(t.default)?null:"ברירת המחדל חייבת להיות אחד מהמשכים המוצעים."}function Ps(t,e){return Math.round(t*(e==="min"?1:e==="hour"?60:1440))}function Ms(t,e,a,r){const i=Number(t)+Number(e);return Number.isFinite(i)?a==="inc_vat"?Math.round(i*100)/100:r===null?null:Math.round(i*(1+Number(r)/100)*100)/100:null}function Zt(t){const e=t;if(!e||typeof e!="object")return null;if(typeof e.m=="string")return[{sign:1,meter_id:e.m}];if((e.op==="+"||e.op==="-")&&Array.isArray(e.args)&&e.args.length>=2){const a=e.args.map(o=>Zt(o));if(a.some(o=>o===null))return null;const[r,...i]=a;return[...r,...i.flatMap(o=>e.op==="-"?o.map(l=>({...l,sign:l.sign*-1})):o)]}return null}function ge(t){const e=new Set,a=t.filter(l=>l.meter_id&&!e.has(l.meter_id)&&e.add(l.meter_id)),r=a.filter(l=>l.sign>0),i=a.filter(l=>l.sign<0);if(!r.length)return null;let o={m:r[0].meter_id};for(const l of r.slice(1))o={op:"+",args:[o,{m:l.meter_id}]};for(const l of i)o={op:"-",args:[o,{m:l.meter_id}]};return o}function Es(t,e){return(t.state==="issued"||t.state==="sent")&&!!t.due_date&&t.due_date<e}const re={tab:"מים",pageRow:"עמודים",offTitle:"המודול כבוי",offHint:"מוני מים מופעלים בהגדרות המערכת",toSettings:"להגדרות",forbidden:"אין הרשאה",noScreen:"אין מסך",retry:"נסה שוב",cancel:"ביטול",save:"שמירה",back:"חזרה",close:"סגירה",remove:"הסרה",add:"הוספה",loading:"טוען",csv:"ייצוא CSV",m3:"מ״ק",litre:"ליטר",lph:"ליטר לשעה",ils:"₪",search:"חיפוש מונה",view:"תצוגה",cards:"כרטיסים",table:"טבלה",addMeter:"הוספת מונה",allAreas:"כל האזורים",areas:"אזורים",fold:"כיווץ",unfold:"הרחבה",area:"אזור",tToday:"היום",tMonth:"מתחילת החודש",tReporting:"מדווחים",tOf:"מתוך {n}",tLeak:"דליפה חשודה",tMeters:"מונים",colName:"שם",colArea:"אזור",colReading:"קריאה נוכחית (מ״ק)",colToday:"היום",colMonth:"מתחילת החודש",colNight:"ספיקת לילה",colState:"מצב",todayM3:"מ״ק היום",nightOff:"כבוי",emptyMeters:"אין מונים עדיין",noResults:"לא נמצאו מונים",loadMetersError:"לא ניתן לטעון את המונים",stReporting:"מדווח",stNotReporting:"לא מדווח",stNotReportingSince:"לא מדווח מ-{t}",stPaused:"מושהה",stRetired:"הוצא משימוש",stLeak:"דליפה חשודה",stAbnormal:"צריכה חריגה",addTitle:"הוספת מונה",candSearch:"חיפוש חיישן לפי שם",candNone:"לא נמצאו חיישנים מתאימים",candRejected:"לא מתאים",meterName:"שם המונה",meterKind:"סוג",added:"המונה נוסף",kMain:"ראשי",kSub:"משני",kIrrigation:"השקיה",kCooling:"קירור",kPool:"בריכה",kOther:"אחר",cardLoadError:"לא ניתן לטעון את המונה",fArea:"אזור",fReading:"קריאה נוכחית",fLast:"דיווח אחרון",fUnit:"יחידה",fUnitValue:"מ״ק · מונה מצטבר",fKind:"סוג",fNight:"ספיקת לילה",fNightOff:"כלל הלילה כבוי (השקיה)",fRules:"כללי דליפה",fRulesDefault:"ברירת המחדל של המערכת · לילה {w}",fRulesOwn:"כללים של המונה · לילה {w}",usage:"צריכה",range:"טווח",r24h:"24 שעות",r30d:"30 ימים",r12m:"12 חודשים",chartAria:"גרף צריכה, {r}",chartError:"לא ניתן לטעון את גרף הצריכה",chartNoData:"אין נתונים לתקופה",nightNote:"ליטר לשעה · חלון הלילה {w} מודגש",openAlerts:"התראות פתוחות",epochs:"תקופות מונה",epochStart:"קריאת התחלה",epochUntil:"עד",epochActive:"פעיל",reasonFirst:"התקנה",reasonReplaced:"החלפת מונה",reasonSource:"שינוי מקור",readings:"קריאות ידניות וכיול",manualReading:"קריאה ידנית",noReadings:"אין קריאות ידניות",readingAt:"מועד הקריאה",readingValue:"קריאה",readingNote:"הערה (לא חובה)",readingSaved:"הקריאה נשמרה",readingUndo:"ביטול קריאה",readingVoided:"בוטלה",effAllocation:"הושלם פער דיווח",effRecorded:"נשמרה להשוואה",rename:"שינוי שם",renameTitle:"שינוי שם המונה",replace:"החלפת מונה",replaceFinal:"קריאה סופית של המונה הישן",replaceStart:"קריאת התחלה של המונה החדש",replaceNote:"הערה (לא חובה)",replaceBad:"צריך להזין קריאה תקינה",pause:"השהיה",resume:"חידוש",removeTitle:"הסרת המונה",removeBody:"המונה יוסר מהרשימה. הנתונים שנאספו יישמרו.",nameRequired:"צריך לכתוב שם למונה",ack:"אישור",acked:"ההתראה אושרה",snooze:"נדנוד {d}",snoozeOther:"משך נדנוד אחר",snoozeTo:"נדנוד ל...",snoozeUntil:"עד {t}",snoozedUntil:"מנודנדת עד {t}",snoozedToast:"ההתראה נודנדה ל-{d} (עד {t})",snoozeFoot:"המשכים נקבעים בהגדרות",unsnooze:"סיום נדנוד",fOpen:"פתוחות",fAll:"הכול",filter:"סינון",leakRules:"כללי דליפה",tOpen:"פתוחות",tClosedWeek:"נסגרו השבוע",tSnoozed:"מנודנדות",tRule:"כללי דליפה",ruleValue:"{lph} ליטר לשעה · {dur}",colMeter:"מונה",colKind:"סוג",colSince:"מאז",colValue:"ערך",akNight:"דליפה · ספיקה רציפה בלילה",akBurst:"פריצה",akAbnormal:"צריכה חריגה",akOffline:"לא מדווח",akHealth:"תקלה במונה",asOpen:"פתוחה",asAcked:"אושרה · {who}",asClosed:"נסגרה",asClosedBy:"נסגרה · {who}",valueRate:"{v} ליטר לשעה",valueRateTh:"{v} ליטר לשעה (סף {t})",valueAbnormal:"{v} מ״ק, רגיל {m}",emptyAlerts:"אין התראות",loadAlertsError:"לא ניתן לטעון את ההתראות",rToday:"היום",r7d:"7 ימים",rPrevMonth:"חודש קודם",tTotal:"סה״כ בטווח",tVsPrev:"לעומת התקופה הקודמת",tDailyAvg:"ממוצע יומי",tNightAvg:"ספיקת לילה ממוצעת",dailyUsage:"צריכה יומית",hourlyUsage:"צריכה לפי שעה",legendDay:"יום",legendNight:"לילה {w}",legendLeak:"דליפה חשודה",colUsage:"צריכה (מ״ק)",colShare:"חלק",colVsPrev:"לעומת הקודם",vsPrevShort:"לעומת הקודם",night:"לילה",emptyUsage:"אין נתוני צריכה עדיין",loadUsageError:"לא ניתן לטעון את הצריכה",csvDone:"הקובץ הורד",accSearch:"חיפוש חשבון או לקוח",newAccount:"חשבון חדש",tActiveAccounts:"חשבונות פעילים",tPeriodUsage:"צריכה בתקופה",tAmountSoFar:"סכום עד כה",tDrafts:"טיוטות לבדיקה",colAccount:"חשבון",colCustomer:"לקוח",colFormula:"נוסחה",colPeriod:"תקופה",colPeriodUsage:"צריכה בתקופה (מ״ק)",colAmount:"סכום עד כה",colLastBill:"חיוב אחרון",emptyAccounts:"אין חשבונות עדיין",noAccounts:"לא נמצאו חשבונות",loadAccountsError:"לא ניתן לטעון את החשבונות",accounts:"חשבונות",tabStatus:"מצב",tabHistory:"היסטוריה",tabBills:"חיובים",edit:"עריכה",createBill:"יצירת טיוטת חיוב",accDayOf:"יום {d} מתוך {n}",tForecast:"צפי לתקופה",tNextBill:"החיוב הבא",colStartReading:"קריאה בתחילת התקופה",colCurrentReading:"קריאה נוכחית",colContribution:"תרומה",staleNote:"המונה {name} לא מדווח: הצריכה שלו לא נספרת עד שידווח שוב.",customerCard:"כרטיס לקוח",priceCard:"מחיר",waterPrice:"מים למ״ק",sewagePrice:"ביוב למ״ק",incVat:"כולל מע״מ",exVat:"לפני מע״מ",vat:"מע״מ",autoMode:"חיוב אוטומטי",hMeasured:"נמדד",hPartial:"חלקי",hMissing:"חסר",hOpen:"פתוחה",colChange:"שינוי",colSum:"סכום",noHistory:"אין היסטוריה עדיין",noBills:"אין חיובים לחשבון",loadAccountError:"לא ניתן לטעון את החשבון",accFormNew:"חשבון חדש",accFormEdit:"עריכת חשבון",accName:"שם החשבון",accCustomer:"לקוח",accPickCustomer:"בחירת לקוח",accFormula:"נוסחת מונים",accAddPlus:"+ מונה",accAddMinus:"− מונה",accLossPreset:"הפרש כללי (אובדן ודליפות)",accPickMeter:"בחירת מונה",accMainMeter:"מונה ראשי",accTariff:"תעריף",accPeriod:"תקופה",accMonthly:"חודשית",accBimonthly:"דו-חודשית",accAnchorDay:"יום תחילת התקופה",accFirstStart:"תחילת התקופה הראשונה",accAuto:"מצב חיוב אוטומטי",accStatus:"מצב החשבון",accActive:"פעיל",accPaused:"מושהה",accDelete:"מחיקת חשבון",accDeleteBody:"החשבון יימחק. חיובים שהונפקו נשמרים.",errName:"צריך לכתוב שם",errCustomer:"צריך לבחור לקוח",errFormula:"צריך לפחות מונה אחד בסימן +",errTariff:"צריך לבחור תעריף",errDate:"תאריך לא תקין",billSearch:"חיפוש מספר או לקוח",stateFilter:"סינון לפי מצב",tBillDrafts:"טיוטות",tOpenAmount:"ממתינים לתשלום",tPaid:"שולמו",tLate:"באיחור",colNumber:"מספר",colM3:"מ״ק",colTotal:"סה״כ כולל מע״מ",colDue:"לתשלום עד",emptyBills:"אין חיובים עדיין",noBillsFound:"לא נמצאו חיובים",loadBillsError:"לא ניתן לטעון את החיובים",toAccounts:"לחשבונות",bills:"חיובים",billNo:"חיוב {no}",billDraft:"טיוטת חיוב",loadBillError:"לא ניתן לטעון את החיוב",pItem:"פריט",pQty:"כמות",pPrice:"מחיר",pAmount:"סכום",pWater:"מים",pSewage:"ביוב",pSubtotal:"סה״כ לפני מע״מ",pVat:"מע״מ {p}%",pTotal:"סה״כ לתשלום",pPeriod:"תקופה",pCustomerNo:"מספר לקוח",pIssued:"תאריך הנפקה",pDue:"לתשלום עד",pFormula:"מונים",details:"פרטים",log:"יומן",replaces:"מחליף את {no}",replacedBy:"הוחלף בחיוב המתוקן",originAuto:"נוצר אוטומטית",originManual:"נוצר ידנית",source:"מקור",sentOn:"נשלח",paidOn:"שולם",pdf:"PDF",pdfLater:"הפקת PDF לחיוב מים תתווסף בהמשך",aRecalc:"חישוב מחדש",aIssue:"הנפקה",aSent:"סימון כנשלח",aPaid:"סימון כשולם",aCorrect:"תיקון",aVoid:"ביטול חיוב",aDelete:"מחיקת טיוטה",dIssueTitle:"הנפקת חיוב",dIssueBody:"החיוב יקבל מספר. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.",dVoidTitle:"ביטול חיוב",dVoidBody:"החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.",dVoidReason:"סיבת הביטול",dReasonRequired:"צריך לכתוב סיבה",dCorrectTitle:"תיקון חיוב",dCorrectBody:"תיווצר טיוטה מתוקנת. כשהיא תונפק, החיוב המקורי יבוטל אוטומטית.",dCorrectGo:"יצירת טיוטה מתוקנת",dSentTitle:"סימון כנשלח",dSentHow:"אופן משלוח",howEmail:"דוא״ל",howHand:"ביד",howOther:"אחר",dPaidTitle:"סימון כשולם",dPaidRef:"אסמכתה (לא חובה)",dDeleteTitle:"מחיקת טיוטה",dDeleteBody:"הטיוטה תימחק. אפשר ליצור אחרת מעמוד החשבון.",optional:"לא חובה",evCreated:"נוצרה טיוטה",evRecalculated:"חושב מחדש",evIssued:"הונפק",evSent:"סומן כנשלח",evPaid:"סומן כשולם",evVoided:"בוטל",evCorrected:"נוצר תיקון",evDeleted:"נמחק",custSearch:"חיפוש לקוח",newCustomer:"לקוח חדש",colCustNo:"מספר",colAddress:"כתובת / יחידה",colPhone:"טלפון",colEmail:"דוא״ל",colAccounts:"חשבונות",colBalance:"יתרה פתוחה",emptyCustomers:"אין לקוחות עדיין",noCustomers:"לא נמצאו לקוחות",loadCustomersError:"לא ניתן לטעון את הלקוחות",loadCustomerError:"לא ניתן לטעון את הלקוח",cName:"שם הלקוח",cNumber:"מספר לקוח",cTaxId:"ח.פ. / ע.מ. (לא חובה)",cAddress:"כתובת למשלוח החיוב",cPhone:"טלפון",cEmail:"דוא״ל",cNotes:"הערות",cNoAccounts:"אין חשבונות ללקוח",cRecentBills:"חיובים אחרונים",cDelete:"מחיקת לקוח",cDeleteBody:"הלקוח יימחק. חיובים שהונפקו שומרים עותק של פרטיו.",cDeleteRefused:"אי אפשר למחוק לקוח שיש לו חשבונות (מים או חשמל).",cShared:"כרטיס הלקוח משותף עם החשמל",errEmail:"כתובת דוא״ל לא תקינה",errCustNo:"מספר לקוח הוא ספרות בלבד",sTariffs:"תעריפי מים וביוב",sAlerts:"התראות והשהיה",sections:"חלקי ההגדרות",usedBy:"בשימוש ב-{n} חשבונות",newVersion:"גרסה חדשה",newTariff:"תעריף חדש",colFrom:"בתוקף מ-",colWaterM3:"מים למ״ק",colSewageM3:"ביוב למ״ק",colIncVat:"כולל מע״מ",current:"נוכחי",locked:"נעול",tariffName:"שם התעריף",priceMode:"המחיר מוזן",modeEx:"לפני מע״מ",modeInc:"כולל מע״מ",errPrice:"מחיר לא תקין",noTariffs:"אין תעריפים עדיין",loadTariffsError:"לא ניתן לטעון את התעריפים",delVersion:"מחיקת גרסה",shared:"משותף עם החשבון",sharedTitle:"משותף עם החשמל",sharedNote:"מע״מ, פרטי העסק, מספור, תנאי תשלום ושמירת נתונים - מהגדרות החיוב של החשמל.",vatInForce:"מע״מ בתוקף",toShared:"להגדרות החיוב המשותפות",snoozeCard:"השהיית התראה (נדנוד)",snoozeDurations:"משכי נדנוד מוצעים",snoozeAddValue:"משך להוספה",snoozeUnit:"יחידה",uMin:"דקות",uHour:"שעות",uDay:"ימים",snoozeDefault:"ברירת מחדל של כפתור «נדנוד»",snoozeMax:"נדנוד מרבי",removeDuration:"הסרת {d}",keepOne:"חייב להישאר לפחות משך אחד",saved:"נשמר",rulesCard:"כללי דליפה",rWindow:"חלון לילה",rThreshold:"סף",rDuration:"משך",rulesReadonly:"הכללים נשארים כפי שאושרו ואינם משתנים כאן.",noConfigure:"שינוי ההגדרות זמין למנהלי מערכת",conflict:"מישהו אחר שינה בינתיים. הנתונים רועננו, נסו שוב.",hours:"{n} שעות",hour1:"שעה",hours2:"שעתיים",minutes:"{n} דקות"},We=Je("en","water/i18n","en");function ne(){return(typeof document<"u"?(document.documentElement?.lang||"").toLowerCase():"").startsWith("en")?"en":"he"}const Ns={he:re,en:We};function s(t,e,a=ne()){const r=Ns[a][t]??re[t]??t;return e?r.replace(/\{(\w+)\}/g,(i,o)=>o in e?String(e[o]):i):r}Qe("water/i18n",{he:re,en:We});var Rs=Object.defineProperty,Os=Object.getOwnPropertyDescriptor,x=(t,e,a,r)=>{for(var i=r>1?void 0:r?Os(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Rs(e,a,i),i};const R="/infra/water/accounts",Xt=t=>n`<span class="chip ${t.cls}" data-tone=${Le(t.cls)}>${t.label}</span>`,Wt=t=>n`<span class="chip ${mt[t.state].cls}" data-tone=${Le(mt[t.state].cls)} data-bill-state=${t.state}>${mt[t.state].label}</span>`,Bt=t=>t?`${K(t.from)} - ${K(t.to)}`:"-";function Ts(t,e,a){const r=[{key:"name",label:s("colAccount"),render:i=>n`<a class="t1" href=${`#${R}/${i.id}`} @click=${o=>o.stopPropagation()}>${i.name}</a>`},{key:"customer",label:s("colCustomer"),render:i=>i.customer?.name??"-"},{key:"formula",label:s("colFormula"),kind:["muted","truncate"],hideBelow:"tablet",render:i=>i.formula.sentence_he,cellTitle:i=>i.formula.sentence_he},{key:"period",label:s("colPeriod"),render:i=>Ve(i.period_months,i.period_anchor_day)},{key:"m3",label:s("colPeriodUsage"),kind:"num",render:i=>y(e[i.id]?.m3_so_far??null)}];return t&&r.push({key:"amount",label:s("colAmount"),kind:"num",render:i=>e[i.id]?.amount_so_far!==void 0?k(e[i.id]?.amount_so_far):""},{key:"last",label:s("colLastBill"),kind:"status",render:i=>a(i)}),r.push({key:"state",label:s("colState"),kind:"status",render:i=>Xt(Qt(i))}),r}const Ls=()=>[{key:"name",label:s("colMeter"),render:t=>n`<b>${Number(t.coefficient)<0?"− ":""}${t.name}</b>${t.reporting?d:n` <span class="chip" data-tone="warn">${s("stNotReporting")}</span>`}`},{key:"start",label:s("colStartReading"),kind:"num",render:t=>y(t.start_m3)},{key:"current",label:s("colCurrentReading"),kind:"num",render:t=>y(t.current_m3)},{key:"usage",label:s("colUsage"),kind:"num",render:t=>y(t.consumption_m3)},{key:"contribution",label:s("colContribution"),kind:"num",render:t=>y(t.contribution_m3)}],Mt=(t=6)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`,Fs=()=>new Date().toISOString().slice(0,10),Bs=()=>`${Fs().slice(0,8)}01`,be=()=>({name:"",customer_id:"",terms:[{sign:1,meter_id:""}],keepAst:null,tariff_id:"",period_months:1,period_anchor_day:1,first_period_start:Bs(),auto_mode:"draft",status:"active"});let _=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.st="loading",this.rows=[],this.drafts=null,this.statuses={},this.q="",this.acc=null,this.accSt="loading",this.status=null,this.history=null,this.bills=null,this.error="",this.busy=!1,this.form=be(),this.errs={},this.customers=[],this.tariffs=[],this.meters=[],this.confirmDel=!1,this.shown=""}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t)}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const[e,a]=this.segments,r=`${e??""}/${a??""}`;if(r===this.shown)return;const i=this.shown.split("/")[0];this.shown=r,this.error="",this.errs={},this.confirmDel=!1,e?e==="new"?this.openForm(null):((e!==i||!this.acc)&&this.loadAccount(e),a==="edit"&&this.openForm(e),a==="history"&&!this.history&&this.loadHistory(e),a==="bills"&&!this.bills&&this.access.bills&&this.loadBills(e)):this.loadList()}async loadList(){this.st="loading";try{const t=await f.listAccounts();this.rows=t.items,this.drafts=t.summary.drafts,this.st="ready";const e={};await Promise.all(t.items.slice(0,60).map(async a=>e[a.id]=await f.accountStatus(a.id).catch(()=>null))),this.statuses=e}catch{this.st="error"}}async loadAccount(t){this.accSt="loading",this.history=null,this.bills=null;try{const[e,a]=await Promise.all([f.account(t),f.accountStatus(t).catch(()=>null)]);this.acc=e,this.status=a,this.accSt="ready";const r=this.segments[1];r==="history"&&this.loadHistory(t),r==="bills"&&this.access.bills&&this.loadBills(t)}catch(e){this.error=D(e),this.accSt="error"}}async loadHistory(t){try{this.history=(await f.accountHistory(t)).periods}catch{this.history=[]}}async loadBills(t){try{this.bills=(await f.accountBills(t)).items}catch{this.bills=[]}}async openForm(t){this.errs={},this.error="",t||(this.form=be());const[e,a,r]=await Promise.all([f.listCustomers().then(i=>i.items).catch(()=>[]),f.listTariffs().then(i=>i.items).catch(()=>[]),b.listMeters().catch(()=>[])]);if(this.customers=e,this.tariffs=a,this.meters=r.filter(i=>i.status!=="retired"),t){const i=this.acc?.id===t?this.acc:await f.account(t).catch(()=>null);if(i){const o=Zt(i.formula.ast);this.form={name:i.name,customer_id:i.customer?.id??"",terms:o??[],keepAst:o?null:i.formula.ast,tariff_id:i.tariff.id,period_months:i.period_months,period_anchor_day:i.period_anchor_day,first_period_start:i.first_period_start,auto_mode:i.auto_mode,status:i.status}}}else!this.form.tariff_id&&a.length===1&&(this.form={...this.form,tariff_id:a[0].id})}setF(t,e){this.form={...this.form,[t]:e},this.errs[t]&&(this.errs={...this.errs,[t]:""})}setTerm(t,e){const a=this.form.terms.map((r,i)=>i===t?{...r,...e}:r);this.form={...this.form,terms:a,keepAst:null},this.errs={...this.errs,formula:""}}async lossPreset(){const t=this.form.terms.find(e=>e.sign>0&&e.meter_id)?.meter_id??this.meters.find(e=>e.kind==="main")?.id??this.meters[0]?.id;if(t)try{const e=await f.preset("main_minus_subs",this.meters.map(r=>r.id),t),a=Zt(e.ast);a&&(this.form={...this.form,terms:a,keepAst:null,name:this.form.name||s("accLossPreset")})}catch(e){this.error=D(e)}}validate(){const t=this.form,e={};return t.name.trim()||(e.name=s("errName")),t.customer_id||(e.customer_id=s("errCustomer")),!t.keepAst&&!ge(t.terms)&&(e.formula=s("errFormula")),t.tariff_id||(e.tariff_id=s("errTariff")),/^\d{4}-\d{2}-\d{2}$/.test(t.first_period_start)||(e.first_period_start=s("errDate")),this.errs=e,!Object.keys(e).length}async save(t){if(this.busy||!this.validate())return;const e=this.form,a={name:e.name.trim(),customer_id:e.customer_id,tariff_id:e.tariff_id,period_months:e.period_months,period_anchor_day:e.period_anchor_day,first_period_start:e.first_period_start,auto_mode:e.auto_mode,...e.keepAst?{}:{formula:{ast:ge(e.terms)}}};this.busy=!0,this.error="";try{if(t&&this.acc){const r=await f.updateAccount(t,{...a,status:e.status,base_revision:this.acc.revision});this.acc=r,w(`${R}/${r.id}`),this.loadAccount(r.id)}else{const r=await f.createAccount(a);w(`${R}/${r.id}`)}}catch(r){this.error=D(r)}finally{this.busy=!1}}async removeRecord(){if(!(!this.acc||this.busy)){this.busy=!0;try{await f.deleteAccount(this.acc.id,this.acc.revision),this.acc=null,w(R)}catch(t){this.error=D(t),this.confirmDel=!1}finally{this.busy=!1}}}fld(t,e,a,r=!1){return n`<div class="fld ${r?"wide":""}"><label for="wa-${t}">${e}</label>${a}${this.errs[t]?n`<div class="msg" role="alert" data-field-error=${t}>${this.errs[t]}</div>`:d}</div>`}renderForm(t){const e=this.form,a=r=>n`<option value="" ?selected=${!r}>${s("accPickMeter")}</option>${this.meters.map(i=>n`<option value=${i.id} ?selected=${i.id===r}>${i.display_name}</option>`)}`;return n`<sw-sheet open wide .heading=${s(t?"accFormEdit":"accFormNew")} data-account-form @close=${()=>w(t?`${R}/${t}`:R)}>
      <div class="col">
        <div class="formgrid">
          ${this.fld("name",s("accName"),n`<input id="wa-name" name="name" class=${this.errs.name?"err":""} .value=${e.name} @input=${r=>this.setF("name",r.target.value)} />`,!0)}
          ${this.fld("customer_id",s("accCustomer"),n`<select id="wa-customer_id" name="customer_id" @change=${r=>this.setF("customer_id",r.target.value)}><option value="" ?selected=${!e.customer_id}>${s("accPickCustomer")}</option>${this.customers.map(r=>n`<option value=${r.id} ?selected=${r.id===e.customer_id}>${r.name} · ${r.customer_number}</option>`)}</select>`)}
          ${this.fld("tariff_id",s("accTariff"),n`<select id="wa-tariff_id" name="tariff_id" @change=${r=>this.setF("tariff_id",r.target.value)}><option value="" ?selected=${!e.tariff_id}>-</option>${this.tariffs.map(r=>n`<option value=${r.id} ?selected=${r.id===e.tariff_id}>${r.name}</option>`)}</select>`)}
        </div>
        <div class="fld"><span class="lbl">${s("accFormula")}</span>
          ${e.keepAst&&this.acc?n`<div class="mut" data-formula-kept>${this.acc.formula.sentence_he}</div>`:d}
          <div class="list" data-formula-terms>${e.terms.map((r,i)=>n`<div class="row" style="flex-wrap:nowrap" data-term=${i}>
            <sw-segmented label=${s("accFormula")} value=${r.sign>0?"+":"-"} @change=${o=>this.setTerm(i,{sign:o.detail.value==="+"?1:-1})}
            .options=${[{value:"+",label:"+",attrs:{"data-sign":"+"}},{value:"-",label:"−",attrs:{"data-sign":"-"}}]}></sw-segmented>
            <select aria-label=${s("accPickMeter")} style="flex:1" @change=${o=>this.setTerm(i,{meter_id:o.target.value})}>${a(r.meter_id)}</select>
            <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("remove")} @click=${()=>this.form={...this.form,terms:e.terms.filter((o,l)=>l!==i),keepAst:null}}></sw-button></div>`)}</div>
          <div class="row">
            <sw-button size="sm" data-add-plus @click=${()=>this.form={...e,terms:[...e.terms,{sign:1,meter_id:""}],keepAst:null}}>${s("accAddPlus")}</sw-button>
            <sw-button size="sm" data-add-minus @click=${()=>this.form={...e,terms:[...e.terms,{sign:-1,meter_id:""}],keepAst:null}}>${s("accAddMinus")}</sw-button>
            <span class="sp"></span>
            <sw-button size="sm" data-loss-preset ?disabled=${!this.meters.length} @click=${()=>void this.lossPreset()}>${s("accLossPreset")}</sw-button></div>
          ${this.errs.formula?n`<div class="msg" role="alert" data-field-error="formula">${this.errs.formula}</div>`:d}</div>
        <div class="formgrid">
          <div class="fld"><span class="lbl">${s("accPeriod")}</span><sw-segmented label=${s("accPeriod")} value=${String(e.period_months)} @change=${r=>this.setF("period_months",Number(r.detail.value))}
            .options=${[{value:"1",label:s("accMonthly")},{value:"2",label:s("accBimonthly")}]}></sw-segmented></div>
          ${this.fld("period_anchor_day",s("accAnchorDay"),n`<input id="wa-period_anchor_day" type="number" min="1" max="31" class="ltr" .value=${String(e.period_anchor_day)} @input=${r=>this.setF("period_anchor_day",Math.min(31,Math.max(1,Number(r.target.value)||1)))} />`)}
          ${this.fld("first_period_start",s("accFirstStart"),n`<input id="wa-first_period_start" type="date" lang=${Oe()} class="ltr ${this.errs.first_period_start?"err":""}" .value=${e.first_period_start} @change=${r=>this.setF("first_period_start",r.target.value)} />`)}
          ${this.fld("auto_mode",s("accAuto"),n`<select id="wa-auto_mode" @change=${r=>this.setF("auto_mode",r.target.value)}>${["off","draft","issue"].map(r=>n`<option value=${r} ?selected=${r===e.auto_mode}>${$e[r]}</option>`)}</select>`)}
          ${t?n`<div class="fld"><span class="lbl">${s("accStatus")}</span><sw-segmented label=${s("accStatus")} value=${e.status} @change=${r=>this.setF("status",r.detail.value)}
            .options=${[{value:"active",label:s("accActive")},{value:"paused",label:s("accPaused")}]}></sw-segmented></div>`:d}
        </div>
        ${this.error?n`<div class="alert err" role="alert">${this.error}</div>`:d}
        <div class="row formacts"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save(t)}>${s("save")}</sw-button>
          <sw-button @click=${()=>w(t?`${R}/${t}`:R)}>${s("cancel")}</sw-button><span class="sp"></span>
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
      ${this.access.manage?n`<sw-button variant="primary" icon="plus" data-new-account @click=${()=>w(`${R}/new`)}>${s("newAccount")}</sw-button>`:d}
    </div>`;if(this.st==="loading")return n`<div class="page" data-water="accounts" data-state="loading">${r}${Mt()}</div>`;if(this.st==="error")return n`<div class="page" data-water="accounts" data-state="error"><sw-state-panel state="error" heading=${s("loadAccountsError")} actionLabel=${s("retry")} @action=${()=>void this.loadList()}></sw-state-panel></div>`;if(!this.rows.length)return n`<div class="page" data-water="accounts" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${s("emptyAccounts")}>${this.access.manage?n`<sw-button variant="primary" data-new-account @click=${()=>w(`${R}/new`)}>${s("newAccount")}</sw-button>`:d}</sw-state-panel></div>`;const i=this.statuses,o=fe(this.rows.map(h=>i[h.id]?.m3_so_far)),l=fe(this.rows.map(h=>i[h.id]?.amount_so_far)),u=n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tActiveAccounts")}</div><div class="v"><span class="num">${this.rows.filter(h=>h.status==="active").length}</span></div></div>
      <div class="tile"><div class="k">${s("tPeriodUsage")}</div><div class="v"><span class="num">${y(o)}</span><span class="u">${s("m3")}</span></div></div>
      ${t?n`<div class="tile"><div class="k">${s("tAmountSoFar")}</div><div class="v"><span class="num">${l===null?"-":k(l).replace(" ₪","")}</span><span class="u">₪</span></div></div>
        <div class="tile"><div class="k">${s("tDrafts")}</div><div class="v"><span class="num">${this.drafts??0}</span></div></div>`:d}
    </div>`,m=h=>h.last_bill?n`${h.last_bill.number?n`<span class="num">${h.last_bill.number}</span>`:s("tBillDrafts")} ${Wt(h.last_bill)}`:n`<span class="mut">-</span>`,p=a.length?n`<sw-table class="t card flush desk-only" data-acc-table no-focus-rows .columns=${Ts(t,i,m)} .rows=${a}
          .rowAttrs=${h=>({"data-account-row":String(h.id)})} @row-select=${h=>w(`${R}/${h.detail.id}`)}></sw-table>
        <div class="list phone-only" style="flex-direction:column" data-acc-rows>${a.map(h=>n`<a class="li" href=${`#${R}/${h.id}`} data-account-row=${h.id}>
          <div class="grow"><div class="t1">${h.name}</div><div class="t2">${h.customer?.name??""} · <span class="num">${y(i[h.id]?.m3_so_far??null)}</span> ${s("m3")}${t&&i[h.id]?.amount_so_far?n` · <span class="num">${k(i[h.id]?.amount_so_far)}</span>`:d}</div></div>${Xt(Qt(h))}</a>`)}</div>`:n`<sw-state-panel icon="search" state="empty" compact heading=${s("noAccounts")}></sw-state-panel>`;return n`<div class="page" data-water="accounts" data-state="ready">${r}${u}${p}</div>`}renderStatus(t){const e=this.status,a=this.access.bills,r=n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tPeriodUsage")}</div><div class="v"><span class="num">${y(e?.m3_so_far??null)}</span><span class="u">${s("m3")}</span></div></div>
      <div class="tile"><div class="k">${s("colPeriod")}</div><div class="v"><span class="num" style="font-size:var(--sw-fs-md)">${e?.day_of_period&&e.days?s("accDayOf",{d:e.day_of_period,n:e.days}):"-"}</span></div></div>
      <div class="tile"><div class="k">${s("tForecast")}</div><div class="v"><span class="num">${y(e?.m3_forecast??null)}</span><span class="u">${s("m3")}</span></div></div>
      ${a?n`<div class="tile"><div class="k">${s("tAmountSoFar")}</div><div class="v"><span class="num">${e?.amount_so_far?k(e.amount_so_far).replace(" ₪",""):"-"}</span><span class="u">₪</span></div></div>`:d}
    </div>`,i=n`<sw-table class="t card flush" static-rows data-acc-meters .columns=${Ls()} .rows=${e?.meters??[]}
      .rowAttrs=${u=>({"data-acc-meter":String(u.meter_id)})}></sw-table>`,o=t.tariff,l=n`<div class="col">
      <div class="card"><div class="hd"><b>${s("customerCard")}</b></div><dl class="kv"><dt>${s("cName")}</dt><dd>${t.customer?.name??"-"}</dd><dt>${s("cNumber")}</dt><dd class="num">${t.customer?.customer_number??"-"}</dd>${t.customer?.address?n`<dt>${s("cAddress")}</dt><dd>${t.customer.address}</dd>`:d}</dl></div>
      <div class="card"><div class="hd"><b>${s("priceCard")}</b></div><dl class="kv"><dt>${s("accTariff")}</dt><dd>${o.name}</dd>
        ${a&&o.water_price!=null?n`<dt>${s("waterPrice")}</dt><dd class="num">${k(o.water_price)}</dd><dt>${s("sewagePrice")}</dt><dd class="num">${k(o.sewage_price)}</dd><dt>${s("colIncVat")}</dt><dd class="num">${o.price_inc_vat?k(o.price_inc_vat):"-"}</dd>`:d}
        <dt>${s("autoMode")}</dt><dd>${$e[t.auto_mode]}</dd></dl></div>
      <div class="card"><div class="hd"><b>${s("tNextBill")}</b></div><dl class="kv"><dt>${s("colPeriod")}</dt><dd class="num">${Bt(t.next_period)}</dd><dt>${s("accPeriod")}</dt><dd>${Ve(t.period_months,t.period_anchor_day)}</dd></dl></div>
    </div>`;return n`${r}${(e?.stale??[]).map(u=>n`<div class="alert warn" role="status"><span class="x" aria-hidden="true">!</span><div>${s("staleNote",{name:u.name})}</div></div>`)}<div class="cols side"><div class="col"><div class="mut">${t.formula.sentence_he}</div>${i}</div>${l}</div>`}renderHistory(){const t=this.history;if(!t)return Mt(4);if(!t.length)return n`<sw-state-panel icon="history" state="empty" compact heading=${s("noHistory")}></sw-state-panel>`;const e={measured:s("hMeasured"),partial:s("hPartial"),missing:s("hMissing"),open:s("hOpen")},a=t.map((i,o)=>{const l=t[o+1]?.m3;return{...i,change:i.m3!==null&&l?Math.round((Number(i.m3)-Number(l))/Number(l)*100):null}}),r=[{key:"period",label:s("colPeriod"),render:i=>n`<span class="num">${Bt(i)}</span>`},{key:"m3",label:s("colM3"),kind:"num",render:i=>y(i.m3)},{key:"change",label:s("colChange"),kind:"num",render:i=>n`<span part=${i.change===null||i.change===0?d:i.change>0?"up":"down"}>${i.change===null?"-":`${i.change>0?"+":""}${i.change}%`}</span>`},{key:"status",label:s("colState"),render:i=>e[i.status]}];return this.access.bills&&r.push({key:"sum",label:s("colSum"),kind:"num",render:i=>i.bill?.total?k(i.bill.total):"-"}),n`<sw-table class="t card flush" static-rows data-acc-history .columns=${r} .rows=${a}></sw-table>`}renderBills(){if(!this.access.bills)return n`<sw-state-panel state="forbidden" compact></sw-state-panel>`;const t=this.bills;return t?t.length?oe(t,!1):n`<sw-state-panel icon="list" state="empty" compact heading=${s("noBills")}></sw-state-panel>`:Mt(4)}async createDraft(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await f.createBill(t.id);w(`/infra/water/bills/${e.id}`)}catch(e){this.error=D(e)}finally{this.busy=!1}}}renderAccount(t,e){if(this.accSt==="loading"&&this.acc?.id!==t)return n`<div class="page" data-water="account" data-state="loading">${Mt(5)}</div>`;if(this.accSt==="error"||!this.acc)return n`<div class="page" data-water="account" data-state="error"><div class="backrow"><a class="btn ghost sm" href=${`#${R}`}><sw-icon name="chevronBack" size="13"></sw-icon>${s("accounts")}</a></div>
        <sw-state-panel state="error" heading=${s("loadAccountError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.loadAccount(t)}></sw-state-panel></div>`;const a=this.acc,r=e==="history"||e==="bills"?e:"status";return n`<div class="page" data-water="account" data-state="ready" data-account-id=${a.id}>
      <div class="backrow"><a class="btn ghost sm" href=${`#${R}`} data-back><sw-icon name="chevronBack" size="13"></sw-icon>${s("accounts")}</a><b class="h3">${a.name}</b>${Xt(Qt(a))}<span class="sp"></span>
        ${this.access.bills?n`<sw-button data-create-bill ?disabled=${this.busy} @click=${()=>void this.createDraft(a)}>${s("createBill")}</sw-button>`:d}
        ${this.access.manage?n`<sw-button icon="edit" data-edit @click=${()=>w(`${R}/${a.id}/edit`)}>${s("edit")}</sw-button>`:d}</div>
      <sw-segmented label=${s("accounts")} data-acc-tabs style="align-self:flex-start" value=${r} @change=${i=>w(i.detail.value==="status"?`${R}/${a.id}`:`${R}/${a.id}/${i.detail.value}`)}
        .options=${[{value:"status",label:s("tabStatus")},{value:"history",label:s("tabHistory")},...this.access.bills?[{value:"bills",label:s("tabBills")}]:[]]}></sw-segmented>
      ${this.error&&!this.segments.includes("edit")?n`<div class="alert err" role="alert">${this.error}</div>`:d}
      ${r==="status"?this.renderStatus(a):r==="history"?this.renderHistory():this.renderBills()}
    </div>`}render(){if(!this.access.view)return n`<sw-state-panel state="forbidden" data-water="accounts" data-state="forbidden"></sw-state-panel>`;const[t,e]=this.segments;return t?t==="new"?n`${this.renderList()}${this.access.manage?this.renderForm(null):d}`:n`${this.renderAccount(t,e??"")}${e==="edit"&&this.access.manage?this.renderForm(t):d}`:this.renderList()}};_.styles=[rt,et];x([M({attribute:!1})],_.prototype,"segments",2);x([M({attribute:!1})],_.prototype,"params",2);x([c()],_.prototype,"access",2);x([c()],_.prototype,"st",2);x([c()],_.prototype,"rows",2);x([c()],_.prototype,"drafts",2);x([c()],_.prototype,"statuses",2);x([c()],_.prototype,"q",2);x([c()],_.prototype,"acc",2);x([c()],_.prototype,"accSt",2);x([c()],_.prototype,"status",2);x([c()],_.prototype,"history",2);x([c()],_.prototype,"bills",2);x([c()],_.prototype,"error",2);x([c()],_.prototype,"busy",2);x([c()],_.prototype,"form",2);x([c()],_.prototype,"errs",2);x([c()],_.prototype,"customers",2);x([c()],_.prototype,"tariffs",2);x([c()],_.prototype,"meters",2);x([c()],_.prototype,"confirmDel",2);_=x([Q("water-accounts-page")],_);const Is=()=>[{key:"number",label:s("colNumber"),render:t=>n`<a class="t1" href=${`#/infra/water/bills/${t.id}`} @click=${e=>e.stopPropagation()}><span class="num">${t.number??s("tBillDrafts")}</span></a>`},{key:"customer",label:s("colCustomer"),render:t=>t.customer.name??"-"},{key:"account",label:s("colAccount"),render:t=>t.account_name},{key:"period",label:s("colPeriod"),render:t=>n`<span class="num">${Bt(t.period)}</span>`},{key:"m3",label:s("colM3"),kind:"num",render:t=>y(t.m3)},{key:"total",label:s("colTotal"),kind:"num",render:t=>t.total!==void 0?k(t.total):""},{key:"due",label:s("colDue"),render:t=>n`<span class="num">${t.due_date?K(t.due_date):"-"}</span>`},{key:"state",label:s("colState"),kind:"status",render:t=>Wt(t)}];function oe(t,e){const a=r=>w(`/infra/water/bills/${r.id}`);return n`<sw-table class="t card flush ${e?"":"desk-only"}" data-bill-table no-focus-rows .columns=${Is()} .rows=${t}
      .rowAttrs=${r=>({"data-bill-row":String(r.id)})} @row-select=${r=>a(r.detail.row)}></sw-table>
    ${e?d:n`<div class="list phone-only" style="flex-direction:column" data-bill-rows>${t.map(r=>n`<a class="li" href=${`#/infra/water/bills/${r.id}`} data-bill-row=${r.id}>
      <div class="grow"><div class="t1"><span class="num">${r.number??s("tBillDrafts")}</span> · ${r.customer.name??""}</div><div class="t2">${r.account_name} · <span class="num">${Bt(r.period)}</span> · <span class="num">${y(r.m3)}</span> ${s("m3")}</div></div>
      <div class="rowend">${Wt(r)}<div class="t2 num">${r.total!==void 0?k(r.total):""}</div></div></a>`)}</div>`}`}var Us=Object.defineProperty,Vs=Object.getOwnPropertyDescriptor,At=(t,e,a,r)=>{for(var i=r>1?void 0:r?Vs(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Us(e,a,i),i};const J=t=>t==null?"-":y(t/1e3),zt=t=>t==="off"?s("nightOff"):t==null?"-":String(t),te={main:"kMain",sub:"kSub",irrigation:"kIrrigation",cooling:"kCooling",pool:"kPool",other:"kOther"},Rt=t=>t in te?s(te[t]):t,je=Object.keys(te),ee=["night_flow","burst"];function xt(t,e){const a=e.filter(r=>r.meter_id===t&&!r.closed_at);return a.some(r=>ee.includes(r.kind))?"leak":a.some(r=>r.kind==="abnormal")?"abnormal":null}function qe(t,e){return e==="leak"?n`<span class="chip c-err" data-tone="bad" data-status="leak">${s("stLeak")}</span>`:e==="abnormal"?n`<span class="chip c-warn" data-tone="warn" data-status="abnormal">${s("stAbnormal")}</span>`:t.state==="reporting"?n`<span class="chip c-ok" data-tone="ok" data-status="reporting">${s("stReporting")}</span>`:t.state==="paused"?n`<span class="chip c-mut" data-status="paused">${s("stPaused")}</span>`:t.state==="retired"?n`<span class="chip c-mut" data-status="retired">${s("stRetired")}</span>`:n`<span class="chip c-warn" data-tone="warn" data-status="not_reporting">${t.last_report_at?s("stNotReportingSince",{t:Ft(t.last_report_at)}):s("stNotReporting")}</span>`}const we={night_flow:"akNight",burst:"akBurst",abnormal:"akAbnormal",offline:"akOffline",health:"akHealth"},Ot=t=>t in we?s(we[t]):t,Et=t=>typeof t=="number"&&Number.isFinite(t)?t:typeof t=="string"&&t.trim()!==""&&Number.isFinite(Number(t))?Number(t):null,Tt=new Intl.NumberFormat("en-US",{maximumFractionDigits:1});function Lt(t){const e=t.value??{};if(t.kind==="night_flow"||t.kind==="burst"){const a=Et(e.floor_lph??e.rate_lph),r=Et(e.threshold_lph);return a===null?"-":r===null?s("valueRate",{v:Tt.format(a)}):s("valueRateTh",{v:Tt.format(a),t:Tt.format(r)})}if(t.kind==="abnormal"){const a=Et(e.today_l),r=Et(e.median_l);return a===null?"-":s("valueAbnormal",{v:y(a/1e3),m:r===null?"-":y(r/1e3)})}return"-"}function ye(t){return t.closed_at?n`<span class="chip c-ok" data-tone="ok" data-event-state="closed">${t.ack_by_display?s("asClosedBy",{who:t.ack_by_display}):s("asClosed")}</span>`:t.snoozed_until?n`<span class="chip c-mut" data-event-state="snoozed">${s("snoozedUntil",{t:Ft(t.snoozed_until)})}</span>`:t.ack_at?n`<span class="chip c-acc" data-tone="info" data-event-state="acked">${s("asAcked",{who:t.ack_by_display??""})}</span>`:n`<span class="chip ${t.severity==="alarm"||ee.includes(t.kind)?"c-err":"c-warn"}" data-tone=${t.severity==="alarm"||ee.includes(t.kind)?"bad":"warn"} data-event-state="open">${s("asOpen")}</span>`}function He(t,e,a=i=>Tt.format(i),r=640){const i=Math.max(320,Math.round(r)),o=170,l=26;if(!t.length)return n`<div class="mut">${s("chartNoData")}</div>`;const u=Math.max(...t.map(g=>g.value),1)*1.15,m=(i-l*2)/t.length,p=Math.min(m*.64,24),h=Math.ceil(t.length/12),G=t.reduce((g,Y,v)=>Y.value>t[g].value?v:g,0);return n`<svg class="chart" viewBox="0 0 ${i} ${o}" role="img" aria-label=${e} data-chart>
    ${t.map((g,Y)=>g.win?ut`<rect class="win" x=${i-l-(Y+1)*m} y="4" width=${m} height=${o-26} />`:d)}
    ${ut`<line x1=${l} x2=${i-l} y1=${o-22} y2=${o-22} class="grid" />`}
    ${t.map((g,Y)=>{const v=Math.max(g.value>0?2:0,g.value/u*(o-44)),N=g.night?Math.min(v,Math.max(g.night>0?2:0,g.night/u*(o-44))):0,Z=i-l-(Y+1)*m+(m-p)/2,nt=Y===t.length-1,gt=g.leak?"bar leak":nt?"bar hi":"bar";return ut`<rect class=${gt} x=${Z} y=${o-22-v} width=${p} height=${v} rx="3"><title>${g.title??`${g.label}: ${a(g.value)}`}</title></rect>
        ${N?ut`<rect class=${g.leak?"bar leak":"bar night"} x=${Z} y=${o-22-N} width=${p} height=${N}><title>${g.title??`${g.label}: ${a(g.value)}`}</title></rect>`:d}
        ${Y%h===0||nt?ut`<text x=${Z+p/2} y=${o-6} text-anchor="middle">${g.label}</text>`:d}
        ${nt||Y===G?ut`<text x=${Z+p/2} y=${o-27-v} text-anchor="middle" class="val">${a(g.value)}</text>`:d}`})}
  </svg>`}let dt=class extends st{constructor(){super(...arguments),this.settings=null,this.disabled=!1,this.open=!1,this.pos={top:0,left:0},this.onDoc=t=>{t.composedPath().includes(this)||(this.open=!1)},this.onKey=t=>{t.key==="Escape"&&(this.open=!1)}}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this.onDoc,!0),document.addEventListener("keydown",this.onKey)}disconnectedCallback(){document.removeEventListener("click",this.onDoc,!0),document.removeEventListener("keydown",this.onKey),super.disconnectedCallback()}fire(t){this.open=!1,this.dispatchEvent(new CustomEvent("snooze",{detail:{minutes:t},bubbles:!0,composed:!0}))}toggle(t){t.stopPropagation();const e=t.currentTarget.getBoundingClientRect();this.pos={top:Math.min(e.bottom+4,window.innerHeight-240),left:Math.max(8,Math.min(e.left,window.innerWidth-200))},this.open=!this.open}render(){const t=this.settings;if(!t)return d;const e=new Date;return n`<span class="snz" @click=${a=>a.stopPropagation()}>
        <button class="btn sm" type="button" data-snooze=${t.default} ?disabled=${this.disabled} @click=${()=>this.fire(t.default)}><sw-icon name="bellOff" size="13"></sw-icon>${s("snooze",{d:tt(t.default)})}</button>
        <button class="btn sm icononly" type="button" data-snooze-menu aria-haspopup="menu" aria-expanded=${this.open?"true":"false"} aria-label=${s("snoozeOther")} ?disabled=${this.disabled} @click=${a=>this.toggle(a)}><sw-icon name="chevronDown" size="13"></sw-icon></button>
      </span>
      ${this.open?n`<div class="menu" role="menu" style="top:${this.pos.top}px;left:${this.pos.left}px" data-snooze-list>
            <div class="mh">${s("snoozeTo")}</div>
            ${t.durations.filter(a=>a<=t.max).map(a=>n`<button type="button" role="menuitem" data-pick=${a} @click=${r=>{r.stopPropagation(),this.fire(a)}}>${tt(a)} <span class="mut">(${s("snoozeUntil",{t:ie(e,a)})})</span></button>`)}
            <div class="mh">${s("snoozeFoot")}</div>
          </div>`:d}`}};dt.styles=[Fe,Ut`
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
    `];At([M({attribute:!1})],dt.prototype,"settings",2);At([M({type:Boolean})],dt.prototype,"disabled",2);At([c()],dt.prototype,"open",2);At([c()],dt.prototype,"pos",2);dt=At([Q("water-snooze")],dt);function Ws(t,e){try{const a=localStorage.getItem(t);return a?JSON.parse(a):e}catch{return e}}function js(t,e){try{localStorage.setItem(t,JSON.stringify(e))}catch{}}function Ke(t){return t===60?s("hour1"):t===120?s("hours2"):t%60===0?s("hours",{n:t/60}):s("minutes",{n:t})}var qs=Object.defineProperty,Hs=Object.getOwnPropertyDescriptor,V=(t,e,a,r)=>{for(var i=r>1?void 0:r?Hs(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&qs(e,a,i),i};const _e={hours:"r24h",days:"r30d",months:"r12m"},ke={first:"reasonFirst",replaced:"reasonReplaced",source_changed:"reasonSource"},kt=t=>String(t).padStart(2,"0"),Ks=t=>`${t.getFullYear()}-${kt(t.getMonth()+1)}-${kt(t.getDate())}T${kt(t.getHours())}:${kt(t.getMinutes())}`,Ys=(t,e)=>{const a=t.getHours()*60+t.getMinutes(),[r,i]=e.night_from.split(":").map(Number),[o,l]=e.night_to.split(":").map(Number),u=r*60+i,m=o*60+l;return u<=m?a>=u&&a<m:a>=u||a<m};let L=class extends ls{constructor(){super("hours"),this.canAck=!1,this.rules=$t,this.snooze=null,this.night=void 0,this.bars=[],this.alerts=[],this.readings=[],this.toaster=new ae(this,{ms:4e3}),this.f1="",this.f2="",this.f3="",this.unit="m3",this.kind=""}get notice(){return this.toaster.text}fetchDetail(){return b.meter(this.meterId)}async afterLoad(t){this.canManage&&this.loadReadings(),await this.loadAlerts(),t()&&this.loadSeries()}titles(t){return{heading:t.display_name??"",subheading:[Rt(t.kind),t.area_name,t.floor_name].filter(Boolean).join(" · ")}}texts(){return{loadError:s("cardLoadError"),retry:s("retry")}}async loadAlerts(){try{this.alerts=(await b.events("open",this.meterId)).items}catch{this.alerts=[]}}async loadReadings(){try{this.readings=await b.manualReadings(this.meterId)}catch{this.readings=[]}}async fetchSeries(t,e,a,r){const i=await b.series(this.meterId,e,a,r);return()=>{const o=xt(this.meterId,this.alerts)==="leak";if(t==="hours")this.bars=i.map(l=>{const u=new Date(l.start),m=Ys(u,this.rules);return{label:kt(u.getHours()),value:l.litres??0,win:m,leak:m&&o}});else if(t==="days")this.bars=i.map(l=>({label:String(new Date(l.start).getDate()),value:(l.litres??0)/1e3}));else{const l=new Map;for(const u of i){const m=new Date(u.start),p=`${m.getMonth()+1}/${String(m.getFullYear()).slice(2)}`;l.set(p,(l.get(p)??0)+(u.litres??0)/1e3)}this.bars=[...l.entries()].map(([u,m])=>({label:u,value:m}))}}}flash(t){this.toaster.show(t)}async act(t,e){if(!this.busy){this.busy=!0,this.actionError="";try{await t(),e?.(),this.fire("changed")}catch(a){this.actionError=a instanceof vt&&a.code==="revision_conflict"?s("conflict"):D(a),a instanceof vt&&a.code==="revision_conflict"&&await this.refresh()}finally{this.busy=!1}}}ack(t){this.act(()=>b.ack(t.id),()=>{this.flash(s("acked")),this.loadAlerts()})}doSnooze(t,e){const a=!!this.snooze;this.act(()=>b.snooze(t.id,a?e:void 0),()=>{this.flash(s("snoozedToast",{d:tt(e),t:ie(new Date,e)})),this.loadAlerts()})}openDlg(t){const e=this.detail;this.actionError="",this.f1=t==="rename"?e?.display_name??"":t==="replace"?e?.value_l!=null?String(e.value_l/1e3):"":t==="reading"?Ks(new Date):"",this.f2=t==="replace"?"0":"",this.f3="",this.kind=e?.kind??"other",this.unit="m3",this.dlg=t}save(){const t=this.detail;if(t)if(this.dlg==="rename"){const e=this.f1.trim();if(!e)return void(this.actionError=s("nameRequired"));this.act(()=>b.patchMeter(t,{display_name:e,...this.kind!==t.kind?{kind:this.kind}:{}}),()=>{this.dlg="",this.refresh()})}else if(this.dlg==="replace"){const e=Number(this.f1),a=Number(this.f2);if(this.f1.trim()===""||!Number.isFinite(e)||e<0||this.f2.trim()===""||!Number.isFinite(a)||a<0)return void(this.actionError=s("replaceBad"));this.act(()=>b.replaceMeter(t,{old_final_reading_l:e*1e3,new_start_reading_l:a*1e3,note:this.f3.trim()||void 0}),()=>{this.dlg="",this.load()})}else if(this.dlg==="reading"){const e=this.f2.trim().replace(",",".");if(!e||!Number.isFinite(Number(e))||Number(e)<0||!this.f1)return void(this.actionError=s("replaceBad"));this.act(()=>b.addManual(t.id,{read_at:new Date(this.f1).toISOString(),value:e,unit:this.unit,note:this.f3.trim()||void 0}),()=>{this.dlg="",this.flash(s("readingSaved")),this.loadReadings(),this.refresh()})}else this.dlg==="remove"&&this.act(()=>b.retireMeter(t),()=>{this.dlg="",this.fire("close")})}renderAlerts(){return this.alerts.length?n`<h3 class="sec">${s("openAlerts")}</h3>
      <div class="list" data-open-alerts>${this.alerts.map(t=>n`<div class="li" data-alert=${t.id}>
        <div class="grow"><div class="t1">${Ot(t.kind)} · ${Lt(t)}</div><div class="t2 wrap">${s("colSince")} <span class="num">${Ft(t.opened_at)}</span>${t.snoozed_until?n` · ${s("snoozedUntil",{t:Ft(t.snoozed_until)})}`:d}</div></div>
        ${this.canAck?n`<span class="acts">${t.can_ack?n`<sw-button variant="primary" size="sm" data-ack ?disabled=${this.busy} @click=${()=>this.ack(t)}>${s("ack")}</sw-button>`:d}
          ${t.can_snooze?n`<water-snooze .settings=${this.snooze??{durations:[60],default:60,max:60}} ?disabled=${this.busy} @snooze=${e=>this.doSnooze(t,e.detail.minutes)}></water-snooze>`:d}</span>`:d}
      </div>`)}</div>`:d}renderReadings(){return this.canManage?n`<div class="row"><h3 class="sec">${s("readings")}</h3><span class="sp"></span><sw-button size="sm" data-reading @click=${()=>this.openDlg("reading")}>${s("manualReading")}</sw-button></div>
      ${this.readings.length?n`<div class="list" data-readings>${this.readings.slice(0,5).map(t=>n`<div class="li"><div class="grow"><div class="t1"><span class="num">${J(t.litres)}</span> ${s("m3")}</div>
            <div class="t2">${Yt(t.read_at)} · ${t.voided_at?s("readingVoided"):t.effect==="allocation"?s("effAllocation"):s("effRecorded")}${t.note?` · ${t.note}`:""}</div></div>
            ${t.voided_at?d:n`<sw-button variant="ghost" size="sm" data-undo-reading ?disabled=${this.busy} @click=${()=>void this.act(()=>b.undoManual(this.meterId,t.id),()=>void this.loadReadings())}>${s("readingUndo")}</sw-button>`}</div>`)}</div>`:n`<div class="mut">${s("noReadings")}</div>`}`:d}renderBody(t){const e=xt(t.id,this.alerts),a=Be(t),r=`${this.rules.night_from}-${this.rules.night_to}`,i=t.rules&&Object.keys(t.rules).length>0;return n`<div class="body" data-meter-card=${t.id}>
      <div class="row">${qe(t,e)}</div>
      ${this.notice?n`<div class="notice" role="status">${this.notice}</div>`:d}
      <dl class="kv">
        <dt>${s("fArea")}</dt><dd>${t.area_name??"-"}${t.floor_name?` · ${t.floor_name}`:""}</dd>
        <dt>${s("fReading")}</dt><dd><span class="num">${J(t.value_l)}</span> <span class="mut">${s("m3")}</span></dd>
        <dt>${s("fLast")}</dt><dd><span class="num">${Yt(t.last_report_at)}</span></dd>
        <dt>${s("fUnit")}</dt><dd>${s("fUnitValue")}</dd>
        <dt>${s("fKind")}</dt><dd>${Rt(t.kind)}</dd>
        <dt>${s("fNight")}</dt><dd>${a?s("fNightOff"):this.night===null||this.night===void 0?"-":n`<span class="num ${e==="leak"?"bad":""}">${zt(this.night)}</span> ${s("lph")}`}</dd>
        <dt>${s("fRules")}</dt><dd>${i?s("fRulesOwn",{w:r}):s("fRulesDefault",{w:r})}</dd>
      </dl>
      <div class="row"><h3 class="sec">${s("usage")}</h3><span class="sp"></span>
        ${this.rangeSeg(s("range"),o=>s(_e[o]))}</div>
      ${this.chartError?n`<div class="alert err" role="alert">${s("chartError")}</div>`:He(this.bars,s("chartAria",{r:s(_e[this.range])}),this.range==="hours"?o=>String(Math.round(o)):o=>o.toFixed(o<10?2:1))}
      ${this.range==="hours"?n`<div class="mut">${s("nightNote",{w:r})}</div>`:d}
      ${this.renderAlerts()}
      <h3 class="sec">${s("epochs")}</h3>
      <div class="list" data-epochs>${t.epochs.map(o=>n`<div class="li"><div class="grow"><div class="t1">${ke[o.reason]?s(ke[o.reason]):o.reason} · <span class="num">${K(o.started_at)}</span></div>
        <div class="t2 wrap">${s("epochStart")} <span class="num">${J(o.start_reading_l)}</span>${o.ended_at?n` · ${s("epochUntil")} <span class="num">${K(o.ended_at)}</span>`:""}${o.note?` · ${o.note}`:""}</div></div>${o.ended_at?d:n`<span class="chip c-acc nodot">${s("epochActive")}</span>`}</div>`)}</div>
      ${this.renderReadings()}
      ${this.actionError&&!this.dlg?n`<div class="alert err" role="alert" data-meter-action-error>${this.actionError}</div>`:d}
      ${this.canManage?this.actionsRow({rename:s("rename"),replace:s("replace"),pause:t.status==="paused"?s("resume"):s("pause"),remove:s("remove"),pauseDisabled:this.busy||t.status==="retired",onRename:()=>this.openDlg("rename"),onReplace:()=>this.openDlg("replace"),onPause:()=>void this.act(()=>b.patchMeter(t,{status:t.status==="paused"?"active":"paused"}),()=>void this.load()),onRemove:()=>this.openDlg("remove")}):d}
    </div>`}field(t,e,a,r,i={}){return n`<div class="fld ${i.wide?"wide":""}"><label for=${t}>${e}</label><div class="inp"><input id=${t} type=${i.type??"text"} inputmode=${i.type?"text":"decimal"} .value=${a} @input=${o=>r(o.target.value)} />${i.suffix?n`<span class="mut">${i.suffix}</span>`:d}</div></div>`}renderDialogs(){const t=this.actionError&&this.dlg?n`<div class="alert err wide" role="alert">${this.actionError}</div>`:d,e=(a,r=!1)=>n`<sw-button slot="footer" variant=${r?"danger":"primary"} data-dialog-save ?disabled=${this.busy} @click=${()=>this.save()}>${a}</sw-button><sw-button slot="footer" @click=${()=>this.dlg=""}>${s("cancel")}</sw-button>`;return n`
      <sw-dialog ?open=${this.dlg==="remove"} heading=${s("removeTitle")} data-meter-remove-dialog @close=${()=>this.dlg=""}>
        <div>${s("removeBody")}</div>${t}${e(s("remove"),!0)}
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="rename"} heading=${s("renameTitle")} data-meter-rename-dialog @close=${()=>this.dlg=""}>
        <div class="form">${this.field("wrn",s("meterName"),this.f1,a=>this.f1=a,{type:"text",wide:!0})}
          <div class="fld wide"><label for="wkd">${s("meterKind")}</label><div class="inp"><select id="wkd" @change=${a=>this.kind=a.target.value}>${je.map(a=>n`<option value=${a} ?selected=${a===this.kind}>${Rt(a)}</option>`)}</select></div></div>${t}</div>
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
      </sw-dialog>`}};L.styles=[rt,os];V([M({type:Boolean})],L.prototype,"canAck",2);V([M({attribute:!1})],L.prototype,"rules",2);V([M({attribute:!1})],L.prototype,"snooze",2);V([M({attribute:!1})],L.prototype,"night",2);V([c()],L.prototype,"bars",2);V([c()],L.prototype,"alerts",2);V([c()],L.prototype,"readings",2);V([c()],L.prototype,"f1",2);V([c()],L.prototype,"f2",2);V([c()],L.prototype,"f3",2);V([c()],L.prototype,"unit",2);V([c()],L.prototype,"kind",2);L=V([Q("water-meter-card")],L);var Gs=Object.defineProperty,Js=Object.getOwnPropertyDescriptor,W=(t,e,a,r)=>{for(var i=r>1?void 0:r?Js(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Gs(e,a,i),i};const Qs=6e4,Nt=t=>String(t).padStart(2,"0"),pt=t=>{if(!t)return"-";const e=new Date(t);return`${Nt(e.getDate())}.${Nt(e.getMonth()+1)} ${Nt(e.getHours())}:${Nt(e.getMinutes())}`},Zs=t=>/^[=+\-@\t\r]/.test(t)?`'${t}`:t,Xs=t=>`"${Zs(t).replace(/"/g,'""')}"`;let F=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.items=[],this.summary=null,this.rules=$t,this.snooze=null,this.phase="loading",this.error="",this.actionError="",this.toaster=new ae(this,{ms:4e3}),this.filter="open",this.busy=!1,this.access=at(),this.poller=new Ze(this)}get notice(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.load(!0),this.poller.every("rows",Qs,()=>this.load(!1)),Ct().then(t=>{t&&(this.rules=t.rules,this.snooze=t.snooze)})}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}async load(t){t&&(this.phase="loading");try{const e=await b.events("all");this.items=e.items,this.summary=e.summary,this.phase="ready"}catch(e){(t||this.phase!=="ready")&&(this.error=D(e),this.phase="error")}}flash(t){this.toaster.show(t)}async act(t,e){if(!this.busy){this.busy=!0,this.actionError="";try{await t(),this.flash(e),await this.load(!1)}catch(a){this.actionError=D(a)}finally{this.busy=!1}}}snoozeEv(t,e){this.act(()=>b.snooze(t.id,this.snooze?e:void 0),s("snoozedToast",{d:tt(e),t:ie(new Date,e)}))}openMeter(t){if(t.closed_at)return;const e={};this.params.forEach((a,r)=>e[r]=a),w("/infra/water/alerts",{...e,meter:t.meter_id})}onKey(t,e){(t.key==="Enter"||t.key===" ")&&t.target===t.currentTarget&&(t.preventDefault(),this.openMeter(e))}closeMeter(){const t={};this.params.forEach((e,a)=>a!=="meter"&&(t[a]=e)),w("/infra/water/alerts",t)}exportCsv(t){const e=ne()==="he",a=[s("colMeter"),s("colArea"),s("colKind"),s("colSince"),e?"עד":"Until",s("colValue"),s("colState")],r=u=>u.closed_at?s("asClosed"):u.snoozed_until?s("snoozedUntil",{t:pt(u.snoozed_until)}):u.ack_at?s("asAcked",{who:u.ack_by_display??""}):s("asOpen"),i=[a,...t.map(u=>[u.meter_name,[u.area_name,u.floor_name].filter(Boolean).join(" · "),Ot(u.kind),pt(u.opened_at),u.closed_at?pt(u.closed_at):"",Lt(u),r(u)])],o=new Blob(["\uFEFF"+i.map(u=>u.map(Xs).join(",")).join(`\r
`)],{type:"text/csv;charset=utf-8"}),l=document.createElement("a");l.href=URL.createObjectURL(o),l.download=`water-alerts-${new Date().toISOString().slice(0,10)}.csv`,l.click(),window.setTimeout(()=>URL.revokeObjectURL(l.href),1e3),this.flash(s("csvDone"))}tableColumns(){return[{key:"meter",label:s("colMeter"),render:t=>n`<b>${t.meter_name}</b>`},{key:"area",label:s("colArea"),render:t=>n`${t.area_name??"-"}<span class="mut hb-tablet">${t.floor_name?` · ${t.floor_name}`:""}</span>`},{key:"kind",label:s("colKind"),render:t=>Ot(t.kind)},{key:"since",label:s("colSince"),render:t=>n`<span class="num">${pt(t.opened_at)}</span>${t.closed_at?n`<span class="mut"> - <span class="num">${pt(t.closed_at)}</span></span>`:d}`},{key:"value",label:s("colValue"),align:"end",render:t=>Lt(t)},{key:"state",label:s("colState"),kind:"status",render:t=>ye(t)},{key:"act",label:"",kind:"actions",render:t=>this.actionKeys(t)}]}actions(t){return t.closed_at||!this.access.ack?d:n`<span class="acts">${this.actionKeys(t)}</span>`}actionKeys(t){return t.closed_at||!this.access.ack?d:n`${t.can_ack?n`<sw-button variant="primary" size="sm" data-ack ?disabled=${this.busy} @click=${e=>{e.stopPropagation(),this.act(()=>b.ack(t.id),s("acked"))}}>${s("ack")}</sw-button>`:d}
      ${t.can_snooze?n`<water-snooze .settings=${this.snooze??{durations:[60],default:60,max:60}} ?disabled=${this.busy} @snooze=${e=>this.snoozeEv(t,e.detail.minutes)}></water-snooze>`:d}`}render(){if(!this.access.view)return n`<sw-state-panel state="forbidden" data-water="alerts" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return n`<div data-water="alerts" data-state="loading" aria-busy="true"><div class="card">${Array.from({length:7},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;if(this.phase==="error")return n`<div data-water="alerts" data-state="error"><sw-state-panel state="error" heading=${s("loadAlertsError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.load(!0)}></sw-state-panel></div>`;const t=Date.now()-7*864e5,e=this.items.filter(p=>p.closed_at&&Date.parse(p.closed_at)>=t).length,a=this.filter==="all"?this.items:this.items.filter(p=>!p.closed_at),r=this.summary,i=this.rules,o=this.params.get("meter")??"",l=n`<div class="row head">
      <sw-segmented label=${s("filter")} data-alert-filter value=${this.filter} @change=${p=>this.filter=p.detail.value}
        .options=${[{value:"open",label:s("fOpen"),attrs:{"data-f":"open"}},{value:"all",label:s("fAll"),attrs:{"data-f":"all"}}]}></sw-segmented>
      <span class="sp"></span>
      <sw-button icon="download" data-csv ?disabled=${!a.length} @click=${()=>this.exportCsv(a)}>${s("csv")}</sw-button>
      ${this.access.manage||this.access.configure?n`<sw-button data-leak-rules @click=${()=>w("/infra/water/settings",{set:"alerts"})}>${s("leakRules")}</sw-button>`:d}
    </div>`,u=n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tOpen")}</div><div class="v ${r?.open?"alarm":""}"><span class="num" data-t-open>${r?.open??0}</span></div></div>
      <div class="tile"><div class="k">${s("tClosedWeek")}</div><div class="v"><span class="num" data-t-closed>${e}</span></div></div>
      <div class="tile"><div class="k">${s("tSnoozed")}</div><div class="v"><span class="num" data-t-snz>${r?.snoozed??0}</span></div></div>
      <div class="tile"><div class="k">${s("tRule")}</div><div class="v"><span class="num nw">${i.night_from}-${i.night_to}</span><span class="u">${s("ruleValue",{lph:i.night_min_lph,dur:Ke(i.night_min_intervals*15)})}</span></div></div>
    </div>`,m=a.length?n`<sw-table class="t card flush desk-only fitbox" data-alerts-table .columns=${this.tableColumns()} .rows=${a}
          .rowAttrs=${p=>({"data-alert":String(p.id),"data-closed":!!p.closed_at})}
          @row-select=${p=>this.openMeter(p.detail.row)}></sw-table>
        <div class="list phone-only" style="flex-direction:column" data-alerts-rows>${a.map(p=>n`<div class="li ${p.closed_at?"dis":"pick"}" role=${p.closed_at?d:"button"} tabindex=${p.closed_at?d:0} data-alert=${p.id} @click=${()=>this.openMeter(p)} @keydown=${h=>this.onKey(h,p)}>
          <div class="grow"><div class="t1">${p.meter_name} · ${Ot(p.kind)}</div><div class="t2 wrap">${p.area_name??""} · ${s("colSince")} <span class="num">${pt(p.opened_at)}</span> · ${Lt(p)}</div></div>${ye(p)}${this.actions(p)}</div>`)}</div>`:n`<sw-state-panel icon="check" state="empty" heading=${s("emptyAlerts")} data-no-alerts></sw-state-panel>`;return n`<div class="page fit" data-water="alerts" data-state=${a.length?"ready":"empty"}>
      ${l}
      ${this.notice?n`<div class="notice" role="status" data-notice>${this.notice}</div>`:d}
      ${this.actionError?n`<div class="alert err" role="alert">${this.actionError}</div>`:d}
      ${u}${m}
      ${o?n`<water-meter-card .meterId=${o} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} @close=${()=>this.closeMeter()} @changed=${()=>void this.load(!1)}></water-meter-card>`:d}
    </div>`}};F.styles=[rt,et];W([M({attribute:!1})],F.prototype,"segments",2);W([M({attribute:!1})],F.prototype,"params",2);W([c()],F.prototype,"items",2);W([c()],F.prototype,"summary",2);W([c()],F.prototype,"rules",2);W([c()],F.prototype,"snooze",2);W([c()],F.prototype,"phase",2);W([c()],F.prototype,"error",2);W([c()],F.prototype,"actionError",2);W([c()],F.prototype,"filter",2);W([c()],F.prototype,"busy",2);W([c()],F.prototype,"access",2);F=W([Q("water-alerts-page")],F);var ta=Object.defineProperty,ea=Object.getOwnPropertyDescriptor,E=(t,e,a,r)=>{for(var i=r>1?void 0:r?ea(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&ta(e,a,i),i};const bt="/infra/water/bills",sa=["draft","issued","sent","paid","void"],wt=t=>`${K(t.from)} - ${K(t.to)}`,xe=()=>{const t=new Date;return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`},aa=t=>`"${(/^[=+\-@\t\r]/.test(t)?`'${t}`:t).replace(/"/g,'""')}"`,Se=(t=6)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`,Ce={email:"howEmail",hand:"howHand",other:"howOther"},ia={recalculate:"aRecalc",issue:"aIssue",sent:"aSent",paid:"aPaid",correct:"aCorrect",void:"aVoid",delete:"aDelete"},ze={created:"evCreated",draft:"evCreated",recalculated:"evRecalculated",recalculate:"evRecalculated",issued:"evIssued",issue:"evIssued",auto_issue:"evIssued",auto_draft:"evCreated",sent:"evSent",paid:"evPaid",voided:"evVoided",void:"evVoided",corrected:"evCorrected",correct:"evCorrected",deleted:"evDeleted"};let C=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.st="loading",this.all=[],this.sums={open:"0.00",paid:"0.00"},this.filter="",this.q="",this.bill=null,this.billSt="loading",this.events=[],this.dlg="",this.reason="",this.how="email",this.ref="",this.busy=!1,this.error="",this.shown=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t)}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const e=this.segments[0]??"";e!==this.shown&&(this.shown=e,this.dlg="",this.error="",e?this.loadBill(e):this.loadList())}async loadList(){this.st="loading";try{const t=await f.listBills();this.all=t.items,this.sums=t.sums,this.st="ready"}catch{this.st="error"}}async loadBill(t){this.billSt="loading";try{this.bill=await f.bill(t),this.billSt="ready",this.loadEvents(t)}catch(e){this.error=D(e),this.billSt="error"}}async loadEvents(t){try{this.events=(await f.billEvents(t)).items}catch{this.events=[]}}open(t){this.dlg=t,this.error="",this.reason="",this.ref="",this.how="email"}async act(t){if(!(this.busy||!this.bill)){this.busy=!0,this.error="";try{const e=await t();if(this.dlg="",e){if(e.id!==this.bill.id){w(`${bt}/${e.id}`);return}this.bill=e,this.loadEvents(e.id)}}catch(e){this.error=D(e)}finally{this.busy=!1}}}exportCsv(t){const e=[s("colNumber"),s("colCustomer"),s("colAccount"),s("colPeriod"),s("colM3"),s("colTotal"),s("colDue"),s("colState")],a=t.map(o=>[o.number??"",o.customer.name??"",o.account_name,wt(o.period),o.m3??"",o.total??"",o.due_date??"",mt[o.state].label]),r=new Blob(["\uFEFF"+[e,...a].map(o=>o.map(aa).join(",")).join(`\r
`)],{type:"text/csv;charset=utf-8"}),i=document.createElement("a");i.href=URL.createObjectURL(r),i.download=`water-bills-${xe()}.csv`,i.click(),window.setTimeout(()=>URL.revokeObjectURL(i.href),1e3)}renderList(){if(this.st==="loading")return n`<div class="page" data-water="bills" data-state="loading">${Se(7)}</div>`;if(this.st==="error")return n`<div class="page" data-water="bills" data-state="error"><sw-state-panel state="error" heading=${s("loadBillsError")} actionLabel=${s("retry")} @action=${()=>void this.loadList()}></sw-state-panel></div>`;if(!this.all.length)return n`<div class="page" data-water="bills" data-state="empty"><sw-state-panel icon="list" state="empty" heading=${s("emptyBills")}><sw-button variant="primary" @click=${()=>w("/infra/water/accounts")}>${s("toAccounts")}</sw-button></sw-state-panel></div>`;const t=o=>this.all.filter(l=>l.state===o).length,e=this.q.trim(),a=this.all.filter(o=>(!this.filter||o.state===this.filter)&&(!e||(o.number??"").includes(e)||(o.customer.name??"").includes(e)||o.account_name.includes(e))),r=xe(),i=this.all.filter(o=>Es(o,r)).length;return n`<div class="page" data-water="bills" data-state=${a.length?"ready":"filtered-empty"}>
      <div class="row head">
        <sw-segmented label=${s("stateFilter")} data-bill-filter value=${this.filter} @change=${o=>this.filter=o.detail.value}
          .options=${[{value:"",label:s("fAll"),count:String(this.all.length),attrs:{"data-filter":""}},...sa.map(o=>({value:o,label:mt[o].label,count:String(t(o)),attrs:{"data-filter":o}}))]}></sw-segmented>
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
      ${a.length?oe(a,!1):n`<sw-state-panel icon="search" state="empty" compact heading=${s("noBillsFound")}></sw-state-panel>`}
    </div>`}paper(t){const e=t.snapshot,a=Ds(e.lines??[]),r=(o,l)=>n`<tr data-line=${o.component}><td>${l}${(e.lines??[]).filter(u=>u.component===o.component).length>1?n` <span class="mut num">${wt(o)}</span>`:d}</td>
      <td class="n"><span class="num">${y(o.m3)}</span> ${s("m3")}</td><td class="n"><span class="num">${k(o.unit_price_ex_vat)}</span></td><td class="n"><span class="num">${k(o.amount_ex_vat)}</span></td></tr>`,i=[...new Set((e.lines??[]).map(o=>o.vat_rate_percent))];return n`<div class="paper" data-bill-paper>
      <div class="row" style="align-items:flex-start"><div><b class="h3">${e.business?.name??""}</b>${e.business?.registration_no?n`<div class="mut num">${e.business.registration_no}</div>`:d}${e.business?.address?n`<div class="mut">${e.business.address}</div>`:d}</div>
        <span class="sp"></span><div style="text-align:end"><b>${e.doc?.title_he??s("billDraft")}</b>${e.doc?.subtitle_he?n`<div class="mut">${e.doc.subtitle_he}</div>`:d}<div class="num">${t.number??s("tBillDrafts")}</div></div></div>
      <dl class="kv">
        <dt>${s("colCustomer")}</dt><dd>${e.customer?.name??""} · <span class="num">${e.customer?.customer_number??""}</span>${e.customer?.address?` · ${e.customer.address}`:""}</dd>
        <dt>${s("colAccount")}</dt><dd>${e.account?.name??t.account_name}</dd>
        <dt>${s("pPeriod")}</dt><dd class="num">${wt(t.period)}</dd>
        <dt>${s("pFormula")}</dt><dd>${e.account?.formula?.sentence_he??""}</dd>
        ${t.issue_date?n`<dt>${s("pIssued")}</dt><dd class="num">${K(t.issue_date)}</dd>`:d}
        <dt>${s("pDue")}</dt><dd class="num">${K(t.due_date??e.bill?.expected_due_date??null)}</dd>
      </dl>
      <table><thead><tr><th>${s("pItem")}</th><th class="n">${s("pQty")}</th><th class="n">${s("pPrice")}</th><th class="n">${s("pAmount")}</th></tr></thead>
        <tbody>${a.water.map(o=>r(o,s("pWater")))}${a.sewage.map(o=>r(o,s("pSewage")))}</tbody>
        <tfoot>
          <tr><td colspan="3">${s("pSubtotal")}</td><td class="n"><span class="num" data-subtotal>${k(e.totals?.amount_ex_vat)}</span></td></tr>
          <tr><td colspan="3">${s("pVat",{p:i.join(" / ")})}</td><td class="n"><span class="num" data-vat>${k(e.totals?.vat_amount)}</span></td></tr>
          <tr class="tot"><td colspan="3">${s("pTotal")}</td><td class="n"><span class="num" data-total>${k(e.totals?.total)}</span></td></tr>
        </tfoot></table>
      ${(e.notes??[]).map(o=>n`<div class="mut">${o.text_he}</div>`)}
    </div>`}renderBill(){const t=this.segments[0],e=n`<a class="btn ghost sm" href=${`#${bt}`} data-back><sw-icon name="chevronBack" size="13"></sw-icon>${s("bills")}</a>`;if(this.billSt==="loading"&&this.bill?.id!==t)return n`<div class="page" data-water="bill" data-state="loading">${Se(5)}</div>`;if(this.billSt==="error"||!this.bill)return n`<div class="page" data-water="bill" data-state="error"><div class="backrow">${e}</div><sw-state-panel state="error" heading=${s("loadBillError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.loadBill(t)}></sw-state-panel></div>`;const a=this.bill,r=["issue","sent","paid","recalculate","correct","void","delete"],i=[...a.actions].sort((u,m)=>r.indexOf(u)-r.indexOf(m)),o=u=>{const m=u==="void"||u==="delete",p=u==="issue"||u==="paid",h=()=>u==="recalculate"?void this.act(()=>f.recalculate(a)):this.open(u);return n`<sw-button variant=${m?"danger":p?"primary":"secondary"} data-act=${u} ?disabled=${this.busy} @click=${h}>${s(ia[u]??"aIssue")}</sw-button>`},l=n`<div class="col">
      <div class="card"><div class="hd"><b>${s("details")}</b></div><dl class="kv" data-bill-details>
        <dt>${s("colAccount")}</dt><dd><a class="lnk" href=${`#/infra/water/accounts/${a.account_id}`}>${a.account_name}</a></dd><dt>${s("colCustomer")}</dt><dd>${a.customer.name??"-"}</dd>
        <dt>${s("pPeriod")}</dt><dd class="num">${wt(a.period)}</dd><dt>${s("colM3")}</dt><dd class="num">${y(a.m3)}</dd>
        ${a.sent?n`<dt>${s("sentOn")}</dt><dd><span class="num">${K(a.sent.at)}</span> · ${s(Ce[a.sent.how]??"howOther")}</dd>`:d}
        ${a.paid?n`<dt>${s("paidOn")}</dt><dd><span class="num">${K(a.paid.at)}</span>${a.paid.reference?n` · <span class="num">${a.paid.reference}</span>`:d}</dd>`:d}
        <dt>${s("source")}</dt><dd>${a.origin==="auto"?s("originAuto"):s("originManual")}</dd></dl></div>
      <div class="card"><div class="hd"><b>${s("log")}</b></div><div class="list" data-bill-log>${this.events.map(u=>n`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${Yt(u.at)}</span><span>${ze[u.action]?s(ze[u.action]):u.action}${u.actor.display_name?` · ${u.actor.display_name}`:""}</span></div>`)}</div></div>
    </div>`;return n`<div class="page" data-water="bill" data-state="ready" data-bill-state=${a.state} data-bill-id=${a.id}>
      <div class="backrow">${e}<b class="h3 num" data-bill-number>${a.number?s("billNo",{no:a.number}):s("billDraft")}</b>${Wt(a)}
        ${a.replaces_bill_id&&a.snapshot.bill?.replaces?n`<span class="mut">${s("replaces",{no:""})}<a class="lnk num" href=${`#${bt}/${a.replaces_bill_id}`}>${a.snapshot.bill.replaces.number??""}</a></span>`:d}
        ${a.replaced_by_bill_id?n`<a class="lnk mut" href=${`#${bt}/${a.replaced_by_bill_id}`}>${s("replacedBy")}</a>`:d}
        <span class="sp"></span>${i.map(o)}
        <button type="button" class="btn" disabled title=${s("pdfLater")} aria-describedby="wpdf" data-pdf><sw-icon name="download" size="15"></sw-icon>${s("pdf")}</button></div>
      <div class="mut" id="wpdf" data-pdf-reason>${s("pdfLater")}</div>
      ${a.state==="void"&&a.void?n`<div class="alert err" role="alert"><span class="x" aria-hidden="true">!</span><div><b>${mt.void.label}:</b> ${a.void.reason}</div></div>`:d}
      ${this.error&&!this.dlg?n`<div class="alert err" role="alert">${this.error}</div>`:d}
      <div class="cols side"><div style="min-inline-size:0">${this.paper(a)}</div>${l}</div>
      ${this.dialogs(a)}
    </div>`}dialogs(t){const e=this.error&&this.dlg?n`<div class="alert err" role="alert">${this.error}</div>`:d,a=n`<sw-button slot="actions" @click=${()=>this.dlg=""}>${s("cancel")}</sw-button>`,r=!this.reason.trim();return n`
      <elec-dialog heading=${s("dIssueTitle")} ?open=${this.dlg==="issue"} data-dialog="issue" @close=${()=>this.dlg=""}>
        <div>${s("dIssueBody")}</div><dl class="kv"><dt>${s("colAccount")}</dt><dd>${t.account_name}</dd><dt>${s("pPeriod")}</dt><dd class="num">${wt(t.period)}</dd><dt>${s("pTotal")}</dt><dd class="num">${k(t.total)}</dd></dl>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>f.issue(t))}>${s("aIssue")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dVoidTitle")} ?open=${this.dlg==="void"} data-dialog="void" @close=${()=>this.dlg=""}>
        <div>${s("dVoidBody")}</div>
        <div class="fld"><label for="wvr">${s("dVoidReason")}</label><textarea id="wvr" data-reason aria-required="true" .value=${this.reason} @input=${i=>this.reason=i.target.value}></textarea></div>${e}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy||r} @click=${()=>void this.act(()=>f.void(t,this.reason.trim()))}>${s("aVoid")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dCorrectTitle")} ?open=${this.dlg==="correct"} data-dialog="correct" @close=${()=>this.dlg=""}>
        <div>${s("dCorrectBody")}</div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>f.correct(t))}>${s("dCorrectGo")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dSentTitle")} ?open=${this.dlg==="sent"} data-dialog="sent" @close=${()=>this.dlg=""}>
        <div class="fld"><span class="lbl">${s("dSentHow")}</span><sw-segmented label=${s("dSentHow")} value=${this.how} @change=${i=>this.how=i.detail.value}
        .options=${["email","hand","other"].map(i=>({value:i,label:s(Ce[i]),attrs:{"data-how":i}}))}></sw-segmented></div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>f.markSent(t,this.how))}>${s("save")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dPaidTitle")} ?open=${this.dlg==="paid"} data-dialog="paid" @close=${()=>this.dlg=""}>
        <div class="fld"><label for="wpr">${s("dPaidRef")}</label><input id="wpr" class="ltr" data-reference placeholder=${s("optional")} .value=${this.ref} @input=${i=>this.ref=i.target.value} /></div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(()=>f.markPaid(t,this.ref.trim()))}>${s("save")}</sw-button>${a}
      </elec-dialog>
      <elec-dialog heading=${s("dDeleteTitle")} ?open=${this.dlg==="delete"} data-dialog="delete" @close=${()=>this.dlg=""}>
        <div>${s("dDeleteBody")}</div>${e}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{await f.deleteDraft(t),w(bt)})}>${s("aDelete")}</sw-button>${a}
      </elec-dialog>`}render(){return this.access.bills?this.segments[0]?this.renderBill():this.renderList():n`<sw-state-panel state="forbidden" data-water="bills" data-state="forbidden"></sw-state-panel>`}};C.styles=[rt,et];E([M({attribute:!1})],C.prototype,"segments",2);E([M({attribute:!1})],C.prototype,"params",2);E([c()],C.prototype,"access",2);E([c()],C.prototype,"st",2);E([c()],C.prototype,"all",2);E([c()],C.prototype,"sums",2);E([c()],C.prototype,"filter",2);E([c()],C.prototype,"q",2);E([c()],C.prototype,"bill",2);E([c()],C.prototype,"billSt",2);E([c()],C.prototype,"events",2);E([c()],C.prototype,"dlg",2);E([c()],C.prototype,"reason",2);E([c()],C.prototype,"how",2);E([c()],C.prototype,"ref",2);E([c()],C.prototype,"busy",2);E([c()],C.prototype,"error",2);C=E([Q("water-bills-page")],C);var ra=Object.defineProperty,na=Object.getOwnPropertyDescriptor,U=(t,e,a,r)=>{for(var i=r>1?void 0:r?na(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&ra(e,a,i),i};const lt="/infra/water/customers",Ae=(t=6)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div>`,oa=()=>[{key:"no",label:s("colCustNo"),render:t=>n`<span class="num">${t.customer_number}</span>`},{key:"name",label:s("colName"),render:t=>n`<a class="t1" href=${`#${lt}/${t.id}`} @click=${e=>e.stopPropagation()}>${t.name}</a>`},{key:"address",label:s("colAddress"),render:t=>t.address??""},{key:"phone",label:s("colPhone"),render:t=>n`<span class="num">${t.phone??""}</span>`},{key:"email",label:s("colEmail"),render:t=>n`<span class="num">${t.email??""}</span>`},{key:"accounts",label:s("colAccounts"),kind:"num",render:t=>String(t.account_count)},{key:"balance",label:s("colBalance"),kind:"num",render:t=>t.open_balance!==void 0?k(t.open_balance):""}];let T=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.st="loading",this.list=[],this.q="",this.card=null,this.cardSt="loading",this.form=he(),this.errs={},this.busy=!1,this.error="",this.confirmDel=!1,this.shown=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.access.bills&&this.loadList()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}willUpdate(t){if(!t.has("segments"))return;const e=this.segments[0]??"";e!==this.shown&&(this.shown=e,this.error="",this.errs={},this.confirmDel=!1,e?e==="new"?(this.card=null,this.cardSt="ready",this.form=he(),f.nextCustomerNumber().then(a=>this.form={...this.form,customer_number:a.customer_number}).catch(()=>{})):this.loadCard(e):this.card=null)}async loadList(){this.st="loading";try{this.list=(await f.listCustomers()).items,this.st="ready"}catch{this.st="error"}}async loadCard(t){this.cardSt="loading";try{const e=await f.customer(t);this.card=e,this.form=ds(e),this.cardSt="ready"}catch{this.cardSt="error"}}validate(){const t={name:s("errName"),email:s("errEmail"),customer_number:s("errCustNo")},e={};for(const a of cs(this.form,{numberRequired:!1}))e[a]=t[a];return this.errs=e,!Object.keys(e).length}async save(){if(!(this.busy||!this.validate())){this.busy=!0,this.error="";try{const t=pe(this.form);if(this.card)this.card=await f.updateCustomer(this.card.id,{...pe(this.form,this.card),base_revision:this.card.revision}),await this.loadList();else{const e=await f.createCustomer({...t,customer_number:t.customer_number||void 0});await this.loadList(),w(`${lt}/${e.id}`)}}catch(t){const e=t instanceof vt?t.body.details?.fields:void 0;e?.length?this.errs=Object.fromEntries(e.map(a=>[a,D(t)])):this.error=D(t)}finally{this.busy=!1}}}async removeRecord(){if(!(!this.card||this.busy)){this.busy=!0;try{await f.deleteCustomer(this.card.id,this.card.revision),this.confirmDel=!1,await this.loadList(),w(lt)}catch(t){this.confirmDel=!1,this.error=t instanceof vt&&t.status===409?D(t)||s("cDeleteRefused"):D(t)}finally{this.busy=!1}}}field(t,e,a={}){return us(t,{idPrefix:"wc-",label:s(e),value:this.form[t],error:this.errs[t],readonly:!this.access.manage,wide:a.wide,ltr:a.ltr,area:a.area,onInput:r=>{this.form={...this.form,[t]:r},this.errs[t]&&(this.errs={...this.errs,[t]:""})}})}renderCard(){const t=this.card,e=!!t&&(t.account_count>0||t.energy_account_count>0);return n`<sw-sheet open wide .heading=${s(t?"customerCard":"newCustomer")} data-customer-card @close=${()=>w(lt)}>
      <div class="col">
        ${this.cardSt==="loading"?Ae(4):this.cardSt==="error"?n`<sw-state-panel state="error" compact heading=${s("loadCustomerError")} actionLabel=${s("retry")} @action=${()=>void this.loadCard(this.segments[0])}></sw-state-panel>`:n`
          <div class="form">${this.field("name","cName",{wide:!0})}${this.field("customer_number","cNumber",{ltr:!0})}${this.field("tax_id","cTaxId",{ltr:!0})}
            ${this.field("address","cAddress",{wide:!0})}${this.field("phone","cPhone",{ltr:!0})}${this.field("email","cEmail",{ltr:!0})}${this.field("notes","cNotes",{wide:!0,area:!0})}</div>
          <div class="mut">${s("cShared")}</div>
          ${t?n`<b class="h3">${s("accounts")}</b>
            <div class="list" data-customer-accounts>${(t.accounts??[]).map(a=>n`<a class="li" href=${`#/infra/water/accounts/${a.id}`}><div class="grow"><div class="t1">${a.name}</div></div>${a.status==="paused"?n`<span class="chip c-mut">${s("accPaused")}</span>`:d}</a>`)}${t.accounts?.length?d:n`<div class="mut">${s("cNoAccounts")}</div>`}</div>
            ${t.bills?.length?n`<b class="h3">${s("cRecentBills")}</b>${oe(t.bills.slice(0,4),!0)}`:d}`:d}
          ${this.error?n`<div class="alert err" role="alert" data-customer-error>${this.error}</div>`:d}
          ${this.access.manage?n`<div class="row formacts"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("save")}</sw-button><span class="sp"></span>
            ${t?n`<sw-button variant="danger" data-delete title=${e?s("cDeleteRefused"):""} @click=${()=>{e?this.error=s("cDeleteRefused"):this.confirmDel=!0}}>${s("cDelete")}</sw-button>`:d}</div>`:d}`}
        <elec-dialog heading=${s("cDelete")} ?open=${this.confirmDel} data-dialog="delete-customer" @close=${()=>this.confirmDel=!1}>
          <div>${s("cDeleteBody")}</div>
          <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeRecord()}>${s("cDelete")}</sw-button>
          <sw-button slot="actions" @click=${()=>this.confirmDel=!1}>${s("cancel")}</sw-button>
        </elec-dialog>
      </div>
    </sw-sheet>`}render(){if(!this.access.bills)return n`<sw-state-panel state="forbidden" data-water="customers" data-state="forbidden"></sw-state-panel>`;const t=this.q.trim(),e=this.list.filter(i=>hs(i,t,[i.address])),a=n`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-cust-search placeholder=${s("custSearch")} aria-label=${s("custSearch")} .value=${this.q} @input=${i=>this.q=i.target.value} /></label>
      <span class="sp"></span>
      ${this.access.manage?n`<sw-button variant="primary" icon="plus" data-new-customer @click=${()=>w(`${lt}/new`)}>${s("newCustomer")}</sw-button>`:d}
    </div>`;let r;return this.st==="loading"?r=Ae(5):this.st==="error"?r=n`<sw-state-panel state="error" heading=${s("loadCustomersError")} actionLabel=${s("retry")} @action=${()=>void this.loadList()}></sw-state-panel>`:this.list.length?e.length?r=n`<sw-table class="t card flush desk-only" data-cust-table no-focus-rows .columns=${oa()} .rows=${e}
          .rowAttrs=${i=>({"data-customer-row":String(i.id)})} @row-select=${i=>w(`${lt}/${i.detail.id}`)}></sw-table>
        <div class="list phone-only" style="flex-direction:column" data-cust-rows>${e.map(i=>n`<a class="li" href=${`#${lt}/${i.id}`} data-customer-row=${i.id}>
          <div class="grow"><div class="t1">${i.name} · <span class="num">${i.customer_number}</span></div><div class="t2">${i.address??""}${i.phone?n` · <span class="num">${i.phone}</span>`:d}</div></div>
          <div class="rowend"><div class="t2 num">${i.open_balance!==void 0?k(i.open_balance):""}</div></div></a>`)}</div>`:r=n`<sw-state-panel icon="search" state="empty" compact heading=${s("noCustomers")}></sw-state-panel>`:r=n`<sw-state-panel icon="users" state="empty" heading=${s("emptyCustomers")}></sw-state-panel>`,n`<div class="page" data-water="customers" data-state=${this.st}>${a}${r}${this.segments[0]?this.renderCard():d}</div>`}};T.styles=[rt,et];U([M({attribute:!1})],T.prototype,"segments",2);U([M({attribute:!1})],T.prototype,"params",2);U([c()],T.prototype,"access",2);U([c()],T.prototype,"st",2);U([c()],T.prototype,"list",2);U([c()],T.prototype,"q",2);U([c()],T.prototype,"card",2);U([c()],T.prototype,"cardSt",2);U([c()],T.prototype,"form",2);U([c()],T.prototype,"errs",2);U([c()],T.prototype,"busy",2);U([c()],T.prototype,"error",2);U([c()],T.prototype,"confirmDel",2);T=U([Q("water-customers-page")],T);var la=Object.defineProperty,da=Object.getOwnPropertyDescriptor,j=(t,e,a,r)=>{for(var i=r>1?void 0:r?da(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&la(e,a,i),i};let B=class extends vs{constructor(){super({viewKey:"sw.water.meters.view",collapseKey:"sw.water.meters.collapsed",route:"/infra/water/meters",access:at,onAccess:it}),this.open=[],this.night={},this.rules=$t,this.snooze=null,this.cq="",this.cands=[],this.candPhase="idle",this.picked=null,this.newName="",this.newKind="sub",this.adding=!1,this.addError="",this.loadedEvents=null,this.candTimer=0}disconnectedCallback(){window.clearTimeout(this.candTimer),super.disconnectedCallback()}willUpdate(t){t.has("params")&&this.params.get("add")==="1"&&this.candPhase==="idle"&&this.access.manage&&this.searchCands()}texts(){return{search:s("search"),view:s("view"),cards:s("cards"),table:s("table"),area:s("area"),areas:s("areas"),allAreas:s("allAreas"),fold:s("fold"),unfold:s("unfold"),addMeter:s("addMeter"),loadError:s("loadMetersError"),retry:s("retry")}}async fetchMeters(){const[t,e]=await Promise.all([b.listMeters(),b.events("open").catch(()=>null)]);return this.loadedEvents=e,t}async afterLoad(t,e){const a=this.loadedEvents;if(a&&(this.open=a.items),t){const r=await Ct();r&&(this.rules=r.rules,this.snooze=r.snooze),this.night=await Ie(e,this.rules)}}areaTree(){return Ss(this.meters)}inArea(t,e){const a=e.startsWith("floor:")?e.slice(6):null;return a!==null?(t.floor_id??"")===a:Ue(t)===e}matchesSearch(t,e){return`${t.display_name} ${t.device_name??""} ${t.area_name??""}`.toLowerCase().includes(e)}openMeter(t){this.setParams({meter:t.id,add:null})}chip(t){return qe(t,xt(t.id,this.open))}renderTiles(){const t=this.meters.filter(i=>i.status!=="retired"),e=i=>t.some(o=>o[i]!=null)?t.reduce((o,l)=>o+(l[i]??0),0)/1e3:null,a=t.filter(i=>i.state==="reporting").length,r=t.filter(i=>xt(i.id,this.open)==="leak").length;return n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${s("tToday")}</div><div class="v"><span class="num" data-t="today">${y(e("today_l"))}</span><span class="u">${s("m3")}</span></div></div>
      <div class="tile"><div class="k">${s("tMonth")}</div><div class="v"><span class="num" data-t="month">${y(e("month_l"))}</span><span class="u">${s("m3")}</span></div></div>
      <div class="tile"><div class="k">${s("tReporting")}</div><div class="v"><span class="num" data-t="reporting">${a}</span><span class="u">${s("tOf",{n:t.length})}</span></div></div>
      <div class="tile"><div class="k">${s("tLeak")}</div><div class="v ${r?"alarm":""}" data-t-leak><span class="num" data-t="leaks">${r}</span><span class="u">${s("tMeters")}</span></div></div>
    </div>`}tableColumns(){return[{key:"name",label:s("colName"),render:t=>n`<b>${t.display_name}</b>`},{key:"area",label:s("colArea"),render:t=>n`${t.area_name??"-"}${this.narrow?d:n`<span class="mut">${t.floor_name?` · ${t.floor_name}`:""}</span>`}`},{key:"value",label:s("colReading"),kind:"num",render:t=>J(t.value_l)},{key:"today",label:s("colToday"),kind:"num",render:t=>J(t.today_l)},...this.narrow?[]:[{key:"month",label:s("colMonth"),kind:"num",render:t=>J(t.month_l)}],{key:"night",label:s("colNight"),kind:"num",render:t=>n`<span part=${xt(t.id,this.open)==="leak"?"bad":d}>${zt(this.night[t.id])}</span>`},{key:"state",label:s("colState"),kind:"status",render:t=>this.chip(t)}]}renderTable(t){return n`<sw-table class="t card flush scrollx desk-only" data-meters-table .columns=${this.tableColumns()} .rows=${t}
      .rowAttrs=${e=>({"data-meter":String(e.id)})} @row-select=${e=>this.openMeter(e.detail.row)}></sw-table>`}renderCards(t){return n`<div class="cards desk-only" data-meters-cards>${t.map(e=>n`<div class="card mcard" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="row"><b>${e.display_name}</b><span class="sp"></span>${this.chip(e)}</div>
      <div class="mut">${e.area_name??""}${e.floor_name?` · ${e.floor_name}`:""}</div>
      <div class="row base"><span class="big num">${J(e.today_l)}</span><span class="mut">${s("todayM3")}</span><span class="sp"></span><span class="mut num">${J(e.value_l)}</span></div>
      <div class="mut">${s("colNight")} <span class="num">${zt(this.night[e.id])}</span>${typeof this.night[e.id]=="number"?` ${s("lph")}`:""}</div></div>`)}</div>`}renderRows(t){return n`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${t.map(e=>n`<div class="li pick" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="grow"><div class="t1">${e.display_name}</div><div class="t2">${e.area_name??""} · ${s("tToday")} <span class="num">${J(e.today_l)}</span> ${s("m3")}</div></div>
      <div class="rowend">${this.chip(e)}<div class="t2 num">${J(e.value_l)}</div></div></div>`)}</div>`}openAdd(){this.picked=null,this.newName="",this.newKind="sub",this.addError="",this.cq="",this.setParams({add:"1",meter:null}),this.searchCands()}async searchCands(){this.candPhase="loading";try{this.cands=await b.candidates(this.cq.trim()),this.candPhase="ready"}catch{this.candPhase="error"}}onCq(t){this.cq=t,window.clearTimeout(this.candTimer),this.candTimer=window.setTimeout(()=>void this.searchCands(),300)}pick(t){t.verdict==="rejected"||t.already_meter_id||(this.picked=t,this.newName=t.device_name||t.name)}async confirmAdd(){const t=this.picked;if(!(!t||this.adding)){if(!this.newName.trim())return void(this.addError=s("nameRequired"));this.adding=!0,this.addError="";try{await b.createMeter({source_ref:t.ref,display_name:this.newName.trim(),kind:this.newKind}),this.setParams({add:null}),this.toaster.show(s("added"),{ms:5e3}),await this.load(!1)}catch(e){this.addError=D(e)}finally{this.adding=!1}}}renderAdd(){return this.params.get("add")==="1"&&this.access.manage?n`<sw-dialog open wide heading=${s("addTitle")} data-add-dialog @close=${()=>this.setParams({add:null})}>
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-cand-search placeholder=${s("candSearch")} aria-label=${s("candSearch")} .value=${this.cq} @input=${e=>this.onCq(e.target.value)} /></label>
      <div class="cand list" data-candidates>
        ${this.candPhase==="loading"?n`<sw-state-panel state="loading" compact></sw-state-panel>`:d}
        ${this.candPhase==="error"?n`<sw-state-panel state="error" compact actionLabel=${s("retry")} @action=${()=>void this.searchCands()}></sw-state-panel>`:d}
        ${this.candPhase==="ready"&&!this.cands.length?n`<sw-state-panel icon="drop" state="empty" compact heading=${s("candNone")}></sw-state-panel>`:d}
        ${this.candPhase==="ready"?this.cands.map(e=>{const a=e.verdict==="rejected"||!!e.already_meter_id;return n`<div class="li ${a?"dis":"pick"}" role="button" tabindex=${a?-1:0} aria-disabled=${a?"true":"false"} aria-pressed=${this.picked?.ref===e.ref?"true":"false"} data-cand=${e.ref}
                @click=${()=>this.pick(e)} @keydown=${r=>{(r.key==="Enter"||r.key===" ")&&(r.preventDefault(),this.pick(e))}}>
                <div class="grow"><div class="t1">${e.device_name||e.name}</div><div class="t2 wrap">${[e.area_name,e.unit].filter(Boolean).join(" · ")}${e.verdict!=="ok"&&e.message?n` · <span class=${e.verdict==="rejected"?"bad":""}>${e.message}</span>`:d}</div></div>
                ${a?n`<span class="chip c-mut nodot">${s("candRejected")}</span>`:d}</div>`}):d}
      </div>
      ${this.picked?n`<div class="formgrid">
            <div class="fld"><label for="wnm">${s("meterName")}</label><div class="inp"><input id="wnm" data-add-name .value=${this.newName} @input=${e=>this.newName=e.target.value} /></div></div>
            <div class="fld"><label for="wnk">${s("meterKind")}</label><div class="inp"><select id="wnk" data-add-kind @change=${e=>this.newKind=e.target.value}>${je.map(e=>n`<option value=${e} ?selected=${e===this.newKind}>${Rt(e)}</option>`)}</select></div></div>
          </div>`:d}
      ${this.addError?n`<div class="alert err" role="alert" data-add-error>${this.addError}</div>`:d}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked||this.adding} @click=${()=>void this.confirmAdd()}>${s("add")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.setParams({add:null})}>${s("cancel")}</sw-button>
    </sw-dialog>`:d}frame(t,e){return n`<div class=${t==="ready"?"page":d} data-water="meters" data-state=${t} aria-busy=${t==="loading"?"true":d}>${e}</div>`}renderForbidden(){return n`<sw-state-panel state="forbidden" data-water="meters" data-state="forbidden"></sw-state-panel>`}skeletonRow(t){return n`<div class="row skrow">${t}</div>`}renderEmpty(t){return n`<sw-state-panel icon="drop" state="empty" heading=${s("emptyMeters")}>${t}</sw-state-panel>`}renderNoResults(){return n`<sw-state-panel icon="drop" state="empty" compact heading=${s("noResults")} data-no-results></sw-state-panel>`}renderCard(t){return n`<water-meter-card .meterId=${t} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} .night=${this.night[t]}
          @close=${()=>this.setParams({meter:null})} @changed=${()=>void this.load(!1)}></water-meter-card>`}};B.styles=[rt,ps,Ut`
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
    `,ms,et];j([c()],B.prototype,"open",2);j([c()],B.prototype,"night",2);j([c()],B.prototype,"rules",2);j([c()],B.prototype,"snooze",2);j([c()],B.prototype,"cq",2);j([c()],B.prototype,"cands",2);j([c()],B.prototype,"candPhase",2);j([c()],B.prototype,"picked",2);j([c()],B.prototype,"newName",2);j([c()],B.prototype,"newKind",2);j([c()],B.prototype,"adding",2);j([c()],B.prototype,"addError",2);B=j([Q("water-meters-page")],B);var ca=Object.defineProperty,ua=Object.getOwnPropertyDescriptor,O=(t,e,a,r)=>{for(var i=r>1?void 0:r?ua(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&ca(e,a,i),i};const ha=[1440,10080,43200],De=/^\d{1,6}(\.\d{1,4})?$/,Pe=(t=5)=>n`<div class="card" aria-busy="true">${Array.from({length:t},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div></div>`)}</div>`;let P=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.access=at(),this.tariffs=null,this.tariffsErr=!1,this.shared=null,this.cfg=null,this.cfgLoaded=!1,this.snooze=_t,this.addN="30",this.addU="min",this.snoozeErr="",this.toaster=new ae(this,{ms:4e3}),this.vf=null,this.vErr="",this.busy=!1,this.error=""}get notice(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.loadPrices(),this.loadAlerts()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}get section(){const t=this.params.get("set");return t==="alerts"?"alerts":t==="prices"||this.access.manage||this.access.bills?"prices":"alerts"}async loadPrices(){if(!(!this.access.manage&&!this.access.bills))try{const[t,e]=await Promise.all([f.listTariffs(),f.sharedSettings().catch(()=>null)]);this.tariffs=t.items,this.shared=e,this.tariffsErr=!1}catch{this.tariffsErr=!0,this.tariffs=[]}}async loadAlerts(){const t=await Ct(!0);this.cfg=t,this.snooze=t?{...t.snooze,durations:[...t.snooze.durations]}:{..._t,durations:[..._t.durations]},this.cfgLoaded=!0}flash(t){this.toaster.show(t)}openVersion(t){const e=t?.current;this.vErr="",this.vf={tariffId:t?.id??null,name:"",from:new Date().toISOString().slice(0,10),water:e?.water_price??"",sewage:e?.sewage_price??"0",mode:e?.price_mode??this.shared?.default_price_mode??"ex_vat"}}async saveVersion(){const t=this.vf;if(!(!t||this.busy)){if(!t.tariffId&&!t.name.trim())return void(this.vErr=s("errName"));if(!/^\d{4}-\d{2}-\d{2}$/.test(t.from))return void(this.vErr=s("errDate"));if(!De.test(t.water.trim())||Number(t.water)<=0||!De.test(t.sewage.trim()||"0"))return void(this.vErr=s("errPrice"));this.busy=!0,this.vErr="";try{const e={effective_from:t.from,water_price:t.water.trim(),sewage_price:t.sewage.trim()||"0",price_mode:t.mode};t.tariffId?await f.addVersion(t.tariffId,e):await f.createTariff({name:t.name.trim(),...e}),this.vf=null,this.flash(s("saved")),await this.loadPrices()}catch(e){this.vErr=D(e)}finally{this.busy=!1}}}async deleteVersion(t,e){if(!this.busy){this.busy=!0,this.error="";try{await f.deleteVersion(t.id,e.id),await this.loadPrices()}catch(a){this.error=D(a)}finally{this.busy=!1}}}sharedLink(){const t=this.shared?.edit_link??"";return t.startsWith("#/system/")?t:Te}versionColumns(t,e,a){return[{key:"from",label:s("colFrom"),render:r=>n`<span class="num">${K(r.effective_from)}</span> ${t.current?.id===r.id?n`<span class="chip" data-tone="ok" data-nodot>${s("current")}</span>`:d}${r.locked?n` <span class="chip" data-nodot data-locked>${s("locked")}</span>`:d}`},{key:"water",label:s("colWaterM3"),kind:"num",render:r=>k(r.water_price)},{key:"sewage",label:s("colSewageM3"),kind:"num",render:r=>k(r.sewage_price)},{key:"inc",label:s("colIncVat"),kind:"num",render:r=>{const i=r.price_inc_vat??Ms(r.water_price,r.sewage_price,r.price_mode,t.vat_rate_percent??e);return i===null?"-":k(i)}},{key:"act",label:"",kind:"actions",render:r=>a&&!r.locked&&t.versions.length>1?n`<sw-button variant="ghost" size="sm" iconOnly icon="trash" label=${s("delVersion")} ?disabled=${this.busy} @click=${()=>void this.deleteVersion(t,r)}></sw-button>`:d}]}renderPrices(){if(!this.access.manage&&!this.access.bills)return n`<sw-state-panel state="forbidden" compact></sw-state-panel>`;if(this.tariffs===null)return Pe();const t=this.shared?.vat.current?.rate_percent??null,e=this.access.manage,a=this.tariffsErr?n`<sw-state-panel state="error" heading=${s("loadTariffsError")} actionLabel=${s("retry")} @action=${()=>void this.loadPrices()}></sw-state-panel>`:n`${this.tariffs.length?d:n`<sw-state-panel icon="drop" state="empty" compact heading=${s("noTariffs")}></sw-state-panel>`}
        ${this.tariffs.map(i=>n`<div class="card flush" data-tariff=${i.id}>
          <div class="hd" style="padding:14px 16px 0"><b>${i.name}</b><span class="sp"></span><span class="mut">${s("usedBy",{n:i.used_by})}</span>
            ${e?n`<sw-button size="sm" data-new-version @click=${()=>this.openVersion(i)}>${s("newVersion")}</sw-button>`:d}</div>
          <sw-table bare static-rows class="t" .columns=${this.versionColumns(i,t,e)} .rows=${i.versions}
            .rowAttrs=${o=>({"data-version":String(o.id)})}></sw-table></div>`)}
        ${e?n`<sw-button icon="plus" style="align-self:flex-start" data-new-tariff @click=${()=>this.openVersion(null)}>${s("newTariff")}</sw-button>`:d}`,r=n`<div class="card" data-card="shared"><div class="hd"><b>${s("sharedTitle")}</b></div>
      <div class="mut" style="margin-block-end:10px">${s("sharedNote")}</div>
      <dl class="kv"><dt>${s("vatInForce")}</dt><dd class="num" data-vat>${t===null?"-":`${t}%`}</dd></dl>
      <a class="btn sm" style="margin-block-start:10px;align-self:flex-start" href=${this.sharedLink()} data-shared-link>${s("toShared")}</a></div>`;return n`<div class="cols side"><div class="col">${a}${this.error?n`<div class="alert err" role="alert">${this.error}</div>`:d}</div><div class="col">${r}</div></div>`}renderVersionDialog(){const t=this.vf;if(!t)return d;const e=(a,r)=>this.vf={...t,[a]:r};return n`<elec-dialog open heading=${t.tariffId?s("newVersion"):s("newTariff")} data-dialog="version" @close=${()=>this.vf=null}>
      <div class="formgrid">
        ${t.tariffId?d:n`<div class="fld wide"><label for="wtn">${s("tariffName")}</label><input id="wtn" data-tariff-name .value=${t.name} @input=${a=>e("name",a.target.value)} /></div>`}
        <div class="fld"><label for="wtf">${s("colFrom")}</label><input id="wtf" type="date" lang=${Oe()} class="ltr" .value=${t.from} @change=${a=>e("from",a.target.value)} /></div>
        <div class="fld"><span class="lbl">${s("priceMode")}</span><sw-segmented label=${s("priceMode")} value=${t.mode} @change=${a=>e("mode",a.detail.value)}
          .options=${[{value:"ex_vat",label:s("modeEx")},{value:"inc_vat",label:s("modeInc")}]}></sw-segmented></div>
        <div class="fld"><label for="wtw">${s("colWaterM3")}</label><input id="wtw" class="ltr" inputmode="decimal" data-water-price .value=${t.water} @input=${a=>e("water",a.target.value)} /></div>
        <div class="fld"><label for="wts">${s("colSewageM3")}</label><input id="wts" class="ltr" inputmode="decimal" data-sewage-price .value=${t.sewage} @input=${a=>e("sewage",a.target.value)} /></div>
      </div>
      ${this.vErr?n`<div class="alert err" role="alert">${this.vErr}</div>`:d}
      <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.saveVersion()}>${s("save")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.vf=null}>${s("cancel")}</sw-button>
    </elec-dialog>`}setSnooze(t){this.snooze=t,this.snoozeErr=Ht(t)??""}addDuration(){const t=Ps(Number(this.addN),this.addU);!Number.isFinite(t)||t<=0||this.snooze.durations.includes(t)||this.setSnooze({...this.snooze,durations:[...this.snooze.durations,t].sort((e,a)=>e-a)})}removeDuration(t){const e=this.snooze;if(e.durations.length<2)return void(this.snoozeErr=s("keepOne"));const a=e.durations.filter(r=>r!==t);this.setSnooze({...e,durations:a,default:a.includes(e.default)?e.default:a[0]})}async saveSnooze(){const t=Ht(this.snooze);if(t)return void(this.snoozeErr=t);if(!this.busy){this.busy=!0,this.snoozeErr="";try{const e=await b.saveSnooze(this.snooze,this.cfg?.row_version);this.cfg=this.cfg?{...this.cfg,snooze:e.snooze,row_version:e.row_version}:e,await Ct(!0),this.flash(s("saved"))}catch(e){this.snoozeErr=e instanceof vt&&e.code==="revision_conflict"?s("conflict"):D(e),e instanceof vt&&e.code==="revision_conflict"&&await this.loadAlerts()}finally{this.busy=!1}}}renderAlerts(){if(!this.cfgLoaded)return Pe();const t=this.access.configure&&(this.cfg?.can_edit??!0),e=this.snooze,a=this.cfg?.rules??$t,r=[...new Set([...ha,e.max])].sort((o,l)=>o-l),i=JSON.stringify(e)!==JSON.stringify(this.cfg?.snooze??_t);return n`<div class="cols side"><div class="col"><div class="card" data-card="snooze"><div class="hd"><b>${s("snoozeCard")}</b></div>
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
        ${t?n`<div class="row" style="margin-block-start:12px"><sw-button variant="primary" data-sn-save ?disabled=${this.busy||!i||!!Ht(e)} @click=${()=>void this.saveSnooze()}>${s("save")}</sw-button></div>`:n`<div class="mut" style="margin-block-start:10px">${s("noConfigure")}</div>`}
      </div></div>
      <div class="col"><div class="card" data-card="rules"><div class="hd"><b>${s("rulesCard")}</b></div><dl class="kv">
        <dt>${s("rWindow")}</dt><dd class="num">${a.night_from}-${a.night_to}</dd><dt>${s("rThreshold")}</dt><dd>${a.night_min_lph} ${s("lph")}</dd><dt>${s("rDuration")}</dt><dd>${Ke(a.night_min_intervals*15)}</dd></dl>
        <div class="mut" style="margin-block-start:8px">${s("rulesReadonly")}</div></div></div></div>`}render(){if(!this.access.manage&&!this.access.configure)return n`<sw-state-panel state="forbidden" data-water="settings" data-state="forbidden"></sw-state-panel>`;const t=this.section,e=a=>w("/infra/water/settings",{set:a});return n`<div class="page" data-water="settings" data-state="ready" data-section=${t}>
      <sw-segmented class="sect-nav" label=${s("sections")} data-set-nav value=${t} @change=${a=>e(a.detail.value)}
        .options=${[...this.access.manage||this.access.bills?[{value:"prices",label:s("sTariffs"),attrs:{"data-set":"prices"}}]:[],{value:"alerts",label:s("sAlerts"),attrs:{"data-set":"alerts"}}]}></sw-segmented>
      ${this.notice?n`<div class="notice" role="status" data-notice>${this.notice}</div>`:d}
      ${t==="prices"?this.renderPrices():this.renderAlerts()}
      ${this.renderVersionDialog()}
    </div>`}};P.styles=[rt,et];O([M({attribute:!1})],P.prototype,"segments",2);O([M({attribute:!1})],P.prototype,"params",2);O([c()],P.prototype,"access",2);O([c()],P.prototype,"tariffs",2);O([c()],P.prototype,"tariffsErr",2);O([c()],P.prototype,"shared",2);O([c()],P.prototype,"cfg",2);O([c()],P.prototype,"cfgLoaded",2);O([c()],P.prototype,"snooze",2);O([c()],P.prototype,"addN",2);O([c()],P.prototype,"addU",2);O([c()],P.prototype,"snoozeErr",2);O([c()],P.prototype,"vf",2);O([c()],P.prototype,"vErr",2);O([c()],P.prototype,"busy",2);O([c()],P.prototype,"error",2);P=O([Q("water-settings-page")],P);var pa=Object.defineProperty,ma=Object.getOwnPropertyDescriptor,q=(t,e,a,r)=>{for(var i=r>1?void 0:r?ma(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&pa(e,a,i),i};const Me={today:"rToday","7d":"r7d","30d":"r30d",prev:"rPrevMonth"},Ee="sw.water.usage.range",St=t=>String(t).padStart(2,"0"),Ye=t=>`${t.getFullYear()}-${St(t.getMonth()+1)}-${St(t.getDate())}`,It=t=>{const[e,a]=t.split(":").map(Number);return e*60+(a||0)};function Kt(t,e=new Date){const a=new Date(e.getFullYear(),e.getMonth(),e.getDate());if(t==="today")return{from:a,to:e,days:1};if(t==="prev"){const i=new Date(e.getFullYear(),e.getMonth()-1,1),o=new Date(e.getFullYear(),e.getMonth(),1);return{from:i,to:o,days:Math.round((o.getTime()-i.getTime())/864e5)}}const r=t==="7d"?7:30;return{from:new Date(a.getFullYear(),a.getMonth(),a.getDate()-(r-1)),to:e,days:r}}function va(t,e,a,r){const i=It(a.night_from),o=It(a.night_to),l=p=>{const h=p.getHours()*60+p.getMinutes();return i<=o?h>=i&&h<o:h>=i||h<o},u=t.series??[];if(e==="today")return u.map(p=>{const h=new Date(p.start);return{label:St(h.getHours()),value:(p.litres??0)/1e3,win:l(h)}});const m=new Map;for(const p of u){const h=new Date(p.start),G=Ye(h),g=m.get(G)??{value:0,night:0,d:h};g.value+=(p.litres??0)/1e3,l(h)&&(g.night+=(p.litres??0)/1e3),m.set(G,g)}return[...m.entries()].map(([p,h])=>({label:String(h.d.getDate()),value:h.value,night:h.night,leak:r.has(p),title:`${St(h.d.getDate())}.${St(h.d.getMonth()+1)}: ${y(h.value)} ${s("m3")}, ${s("night")} ${Math.round(h.night*1e3)} ${s("litre")}`}))}function fa(t){return[{key:"name",label:s("colName"),render:e=>n`<b>${e.display_name}</b>`},{key:"area",label:s("colArea"),render:e=>n`${e.area_name??"-"}<span class="mut hb-tablet">${e.floor_name?` · ${e.floor_name}`:""}</span>`},{key:"usage",label:s("colUsage"),kind:"num",render:e=>y(e.litres===null?null:e.litres/1e3)},{key:"share",label:s("colShare"),render:e=>{const a=e.share===null?0:Math.round(e.share*100);return n`<span part="share"><i part="share-track"><b part="share-fill" style="width:${a}%"></b></i><span class="num mut">${a}%</span></span>`}},{key:"vs",label:s("colVsPrev"),kind:"num",render:e=>{const a=t.change(e.litres,e.previous_litres);return n`<span part=${a===null||a===0?d:a>0?"up":"down"}>${t.sign(a)}</span>`}},{key:"night",label:s("colNight"),kind:"num",render:e=>t.byM.has(e.meter_id)?zt(t.night[e.meter_id]):"-"}]}let I=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.segments=[],this.params=new URLSearchParams,this.range=Ws(Ee,"30d"),this.data=null,this.meters=[],this.leakDays=new Set,this.night={},this.rules=$t,this.phase="loading",this.error="",this.access=at(),this.chartW=640,this.seq=0,this.ro=null,this.observed=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.load()}disconnectedCallback(){this.stop?.(),this.ro?.disconnect(),this.ro=null,this.observed=null,super.disconnectedCallback()}updated(){const t=this.renderRoot.querySelector("[data-usage-chart]");t!==this.observed&&(this.ro?.disconnect(),this.observed=t,!(!t||typeof ResizeObserver!="function")&&(this.ro??=new ResizeObserver(e=>{const a=Math.floor(e[e.length-1].contentRect.width);a>0&&Math.abs(a-this.chartW)>1&&(this.chartW=a)}),this.ro.observe(t)))}async load(){const t=++this.seq;this.phase="loading";const e=Kt(this.range);try{const a=await Ct();a&&(this.rules=a.rules);const[r,i,o]=await Promise.all([b.consumption(e.from.toISOString(),e.to.toISOString(),"1h"),b.listMeters(),b.events("all").catch(()=>({items:[]}))]);if(t!==this.seq)return;this.data=r,this.meters=i,this.leakDays=new Set(o.items.filter(l=>l.kind==="night_flow").map(l=>Ye(new Date(l.opened_at)))),this.phase="ready",this.night=await Ie(i,this.rules)}catch(a){if(t!==this.seq)return;this.error=D(a),this.phase="error"}}setRange(t){this.range=t,js(Ee,t),this.load()}csv(){const t=Kt(this.range),e=document.createElement("a");e.href=b.consumptionCsvUrl(t.from.toISOString(),t.to.toISOString(),ne()),e.download="",e.click()}renderHead(){return n`<div class="row head">
      <sw-segmented class="ranges" label=${s("range")} data-ranges value=${this.range} @change=${t=>this.setRange(t.detail.value)}
        .options=${["today","7d","30d","prev"].map(t=>({value:t,label:s(Me[t]),attrs:{"data-range":t}}))}></sw-segmented>
      <span class="sp"></span>
      <sw-button icon="download" data-csv ?disabled=${this.phase!=="ready"||!this.data?.items.length} @click=${()=>this.csv()}>${s("csv")}</sw-button>
    </div>`}render(){if(!this.access.view)return n`<sw-state-panel state="forbidden" data-water="usage" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return n`<div class="page" data-water="usage" data-state="loading" aria-busy="true">${this.renderHead()}<div class="card">${Array.from({length:7},()=>n`<div class="row skrow"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;if(this.phase==="error"||!this.data)return n`<div class="page" data-water="usage" data-state="error">${this.renderHead()}<sw-state-panel state="error" heading=${s("loadUsageError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.load()}></sw-state-panel></div>`;const t=this.data;if(!t.items.length)return n`<div data-water="usage" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${s("emptyUsage")}>${this.access.manage?n`<sw-button variant="primary" icon="plus" data-add-meter @click=${()=>w("/infra/water/meters",{add:"1"})}>${s("addMeter")}</sw-button>`:d}</sw-state-panel></div>`;const e=Kt(this.range),a=t.total_litres,r=t.previous_total_litres,i=a!==null&&r?Math.round((a-r)/r*100):null,o=va(t,this.range,this.rules,this.leakDays),l=(t.series??[]).filter(v=>{const N=new Date(v.start),Z=N.getHours()*60+N.getMinutes(),nt=It(this.rules.night_from),gt=It(this.rules.night_to);return v.litres!==null&&(nt<=gt?Z>=nt&&Z<gt:Z>=nt||Z<gt)}),u=l.length?Math.round(l.reduce((v,N)=>v+(N.litres??0),0)/l.length):null,m=`${this.rules.night_from}-${this.rules.night_to}`,p=new Map(this.meters.map(v=>[v.id,v])),h=[...t.items].sort((v,N)=>(N.litres??-1)-(v.litres??-1)),G=(v,N)=>v===null||!N?null:Math.round((v-N)/N*100),g=v=>v===null?"-":`${v>0?"+":""}${v}%`,Y=v=>v===null||v===0?"":v>0?"up":"down";return n`<div class="page fit" data-water="usage" data-state="ready">
      ${this.renderHead()}
      <div class="tiles" data-tiles>
        <div class="tile"><div class="k">${s("tTotal")}</div><div class="v"><span class="num" data-t="total">${y(a===null?null:a/1e3)}</span><span class="u">${s("m3")}</span></div></div>
        <div class="tile"><div class="k">${s("tVsPrev")}</div><div class="v ${Y(i)}"><span class="num" data-t="vs">${g(i)}</span></div></div>
        <div class="tile"><div class="k">${s("tDailyAvg")}</div><div class="v"><span class="num" data-t="avg">${y(a===null?null:a/1e3/Math.max(1,e.days))}</span><span class="u">${s("m3")}</span></div></div>
        <div class="tile"><div class="k">${s("tNightAvg")}</div><div class="v"><span class="num" data-t="night">${u??"-"}</span><span class="u">${s("lph")}</span></div></div>
      </div>
      <div class="card">
        <div class="hd"><h3 class="sec">${this.range==="today"?s("hourlyUsage"):s("dailyUsage")}</h3><span class="sp"></span>
          <div class="legend"><span><i style="background:var(--sw-accent)"></i>${s("legendDay")}</span><span><i style="background:color-mix(in srgb, var(--sw-heading, var(--sw-text)) 55%, var(--sw-surface-3))"></i>${s("legendNight",{w:m})}</span><span><i style="background:var(--sw-danger)"></i>${s("legendLeak")}</span></div></div>
        <div class="usage-chart" data-usage-chart>${He(o,`${s("dailyUsage")} · ${s(Me[this.range])}`,v=>v.toFixed(v<10?2:1),this.chartW)}</div>
      </div>
      <sw-table class="t card flush desk-only fitbox" static-rows data-usage-table .rows=${h}
        .columns=${fa({byM:p,night:this.night,change:G,sign:g})}
        .rowAttrs=${v=>({"data-meter":String(v.meter_id)})}></sw-table>
      <div class="list phone-only" style="flex-direction:column" data-usage-rows>${h.map(v=>{const N=G(v.litres,v.previous_litres);return n`<div class="li"><div class="grow"><div class="t1">${v.display_name}</div><div class="t2">${v.area_name??""} · <span class="num">${v.share===null?0:Math.round(v.share*100)}%</span> · ${s("vsPrevShort")} <span class="num ${Y(N)}">${g(N)}</span> · ${s("night")} ${zt(this.night[v.meter_id])}</div></div>
          <div class="amt num">${y(v.litres===null?null:v.litres/1e3)} ${s("m3")}</div></div>`})}</div>
    </div>`}};I.styles=[rt,et];q([M({attribute:!1})],I.prototype,"segments",2);q([M({attribute:!1})],I.prototype,"params",2);q([c()],I.prototype,"range",2);q([c()],I.prototype,"data",2);q([c()],I.prototype,"meters",2);q([c()],I.prototype,"leakDays",2);q([c()],I.prototype,"night",2);q([c()],I.prototype,"rules",2);q([c()],I.prototype,"phase",2);q([c()],I.prototype,"error",2);q([c()],I.prototype,"access",2);q([c()],I.prototype,"chartW",2);I=q([Q("water-usage-page")],I);var $a=Object.defineProperty,ga=Object.getOwnPropertyDescriptor,jt=(t,e,a,r)=>{for(var i=r>1?void 0:r?ga(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&$a(e,a,i),i};const se=is.map(t=>({id:t.id,label:t.label,tag:`water-${t.id}-page`,money:ns.includes(t.id),manage:rs.includes(t.id)}));function ba(t){const e=t[1]==="water"?t[2]:void 0;return se.find(a=>a.id===e)?.id??"meters"}function Ne(t,e){return e.view&&(!t.money||e.bills)&&(!t.manage||as(e))}let ft=class extends st{constructor(){super(...arguments),this.bubbleSkin=new ct(this),this.route=null,this.access=at(),this.alerts=ws(),this.tabsMode=new Xe(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=it(t=>this.access=t),this.stopCount=_s(t=>this.alerts=t),ce()}disconnectedCallback(){this.stop?.(),this.stopCount?.(),ue(this),this.pagesChip=null,super.disconnectedCallback()}body(t,e){const a=this.access,r=this.route;if(!a.loaded)return n`<sw-state-panel state="loading" data-water=${t} data-state="loading"></sw-state-panel>`;if(a.failed)return n`<sw-state-panel state="error" heading=${s("loadMetersError")} actionLabel=${s("retry")} data-water=${t} data-state="error" @action=${()=>void ce()}></sw-state-panel>`;if(!a.enabled)return n`<sw-state-panel state="stale" heading=${s("offTitle")} hint=${s("offHint")} data-water=${t} data-state="off">
        ${a.manage||a.configure?n`<sw-button size="sm" data-to-settings @click=${()=>w(Te.slice(1))}>${s("toSettings")}</sw-button>`:d}
      </sw-state-panel>`;if(!Ne(e,a))return n`<sw-state-panel state="forbidden" data-water=${t} data-state="forbidden"></sw-state-panel>`;if(!customElements.get(e.tag))return n`<sw-state-panel icon="drop" state="empty" heading=${s("noScreen")} data-water=${t} data-state="empty"></sw-state-panel>`;const i=fs(e.tag);return $s`<${i} .segments=${(r?.segments??[]).slice(3)} .params=${r?.params??new URLSearchParams}></${i}>`}render(){const t=this.access,e=ba(this.route?.segments??[]),a=se.find(m=>m.id===e),i=t.loaded&&!t.failed&&t.enabled&&t.view?se.filter(m=>Ne(m,t)):[],o=ts("infra.water",i.map(m=>({id:m.id,label:m.label,href:`#/infra/water/${m.id}`,...m.id==="alerts"&&this.alerts?{count:this.alerts}:{}})),H()),l=o.length>0&&gs(this.tabsMode.value,o.length);this.pagesChip=l?bs(s("pageRow"),o,e,m=>w(`/infra/water/${m}`)):null;const u=l||!o.length?d:n`<sw-tabs .items=${o} .active=${e} .variant=${es("infra.water")} data-infra-pages></sw-tabs>`;return n`<sw-page heading=${s("tab")} data-infra-page="water">${u===d?d:n`<div class="rows" data-water-shell>${u}</div>`}<div class="body" data-page=${e}>${this.body(e,a)}</div></sw-page>`}updated(){this.pagesChip?ss(this,this.pagesChip):ue(this)}};ft.styles=[Ut`
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
  `,et];jt([M({attribute:!1})],ft.prototype,"route",2);jt([c()],ft.prototype,"access",2);jt([c()],ft.prototype,"alerts",2);ft=jt([Q("infra-water")],ft);export{ft as InfraWater};
