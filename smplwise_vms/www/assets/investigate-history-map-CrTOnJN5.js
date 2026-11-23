import{g as bt,aw as I,i as $t,A as v,b as c,cx as It,a4 as E,k as xt,b3 as kt,a as Mt,aK as At,a1 as U,p as Dt,Q as Et,aA as lt,by as S,m as tt,eR as O,aP as K,eQ as Ot,aH as Pt,d as ct,W as F,a5 as et,ea as dt,fb as Lt,hw as Rt,hx as Nt,hv as ht,lT as Tt,j as y}from"./index-BYRaM0w7.js";import{l as Ft}from"./lead-reserve-D_HTSLNo.js";import"./sw-chip-CouakMmq.js";import{s as P,m as st}from"./sw-timeline-DktKt4Gz.js";import"./sw-case-picker-COytWSbS.js";import{q as Wt}from"./cases-CoPhke1p.js";import"./sw-plan-canvas-BZK-6nDA.js";import{e as Ct,g as Ht,c as qt,h as jt,i as Kt,z as Ut,l as Vt,k as Bt}from"./shared-space-BabVKdXW.js";import{l as Gt,E as pt}from"./events-DJFUC6D_.js";import{d as W,m as L,r as Yt,i as ut,f as Zt}from"./recordings-i-8eQA11.js";import{c as Jt,b as Qt}from"./geometry-Cdz-oK98.js";import{c as Xt}from"./plan-catalog-BIAc5mPh.js";import{i as te,d as ee,a as se,l as ae,w as ie,r as ne,s as re,h as oe,b as le,c as ce,e as de,f as he}from"./floor-view-shared-JMcW-IGh.js";import{b as pe}from"./scene-builder-CciAaR4z.js";import{a as mt,R as V}from"./replay-3d-CsZBzCUs.js";import{b as ue}from"./part-select-CylWA6VC.js";import{w as R,W as B}from"./webgl-Bv5_9slu.js";import{R as me,s as N}from"./memo-CyxK7byc.js";import{L as ft}from"./latest-DjG5XH9h.js";import{b as fe}from"./bubble-chrome-BtjbJxHL.js";import{I as ge}from"./investigate-r5-css-BZdkNUPY.js";import{t as x}from"./map-CeG_a7WX.js";import{p as we}from"./zones-D8I-3A3Y.js";import{s as ve,a as ye}from"./state-facts-SQFvf1Ou.js";import{t as i}from"./investigate-B0AxkjRZ.js";import{l as be}from"./live-CilGSmOB.js";import"./sw-logo-art-PLtEZJxU.js";import"./candidates-DkdfzNd6.js";import"./material-resolve-DUJGA3lD.js";import"./quality-ladder-UIHBoSTU.js";var $e=Object.defineProperty,xe=Object.getOwnPropertyDescriptor,T=(t,e,s,a)=>{for(var n=a>1?void 0:a?xe(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(a?o(e,s,n):o(n))||n);return a&&n&&$e(e,s,n),n};let z=class extends $t{constructor(){super(...arguments),this.lanes=[],this.gaps=[],this.from=0,this.to=1,this.cursor=0,this.limit=null}x(t,e){const s=Math.max(1,this.to-this.from);return(t-this.from)/s*e}onClick(t){const e=t.currentTarget.getBoundingClientRect();if(!e.width)return;let s=this.from+(t.clientX-e.left)/e.width*(this.to-this.from);this.limit!==null&&(s=Math.min(s,this.limit)),this.dispatchEvent(new CustomEvent("seek",{detail:{ms:Math.round(s)},bubbles:!0,composed:!0}))}render(){const a=Math.max(1,this.lanes.length*14-2),n=this.x(this.cursor,1e3),r=this.limit!==null&&this.limit<this.to?Math.max(0,this.x(this.limit,1e3)):null;return c`
      <div class="labels">
        ${this.lanes.map(o=>c`<div class="ln ${o.off?"off":""}" style=${`--c:${o.color}`} data-lane=${o.id} data-off=${o.off?"true":"false"} data-locked=${o.locked?"true":"false"}><i></i>${o.label}</div>`)}
      </div>
      <div class="trk"><svg viewBox="0 0 ${1e3} ${a}" preserveAspectRatio="none" role="img" aria-label=${It("שינויים לפי שכבה")} @click=${this.onClick}>
        <defs>
          <pattern id="gap" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--sw-warning)" stroke-width="2.5" opacity="0.6" /></pattern>
          <pattern id="chg" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--sw-text-3)" stroke-width="1.5" opacity="0.55" /></pattern>
        </defs>
        ${this.lanes.map((o,l)=>{const d=l*14,h=o.off?.35:1,p=new Set;for(const u of o.marks)p.add(Math.round(this.x(u,1e3)/2)*2);return E`<g data-lane-track=${o.id} opacity=${h}>
            <rect x="0" y=${d+12/2-1} width=${1e3} height="2" rx="1" fill="var(--sw-surface-3)" />
            ${o.locked?v:o.spans.map(u=>{const b=Math.max(0,this.x(u.from,1e3)),f=Math.min(1e3,this.x(u.to,1e3));return f<=b?v:u.kind==="on"?E`<rect x=${b} y=${d+2} width=${Math.max(1.5,f-b)} height=${8} rx="2" fill=${o.color} opacity="0.85" />`:E`<rect x=${b} y=${d+1} width=${Math.max(1.5,f-b)} height=${10} fill="url(#chg)" />`})}
            ${o.locked?v:[...p].filter(u=>u>=0&&u<=1e3).map(u=>E`<rect x=${u-.6} y=${d} width="1.2" height=${12} fill=${o.color} opacity="0.9" />`)}
          </g>`})}
        ${this.gaps.map(o=>{const l=Math.max(0,this.x(o.from,1e3)),d=Math.min(1e3,this.x(o.to,1e3));return d>l?E`<rect data-gap x=${l} y="0" width=${d-l} height=${a} fill="url(#gap)" stroke="var(--sw-warning)" stroke-width="0.5" />`:v})}
        ${r!==null?E`<rect x=${r} y="0" width=${Math.max(0,1e3-r)} height=${a} fill="var(--sw-surface-3)" opacity="0.7" />`:v}
        ${n>=0&&n<=1e3?E`<line x1=${n} x2=${n} y1="0" y2=${a} stroke="var(--sw-accent)" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none" />`:v}
      </svg></div>
    `}};z.styles=bt`
    :host {
      display: grid;
      grid-template-columns: var(--sw-lanes-label-w, 92px) minmax(0, 1fr);
      column-gap: 8px;
      direction: ltr;
      user-select: none;
    }
    .labels {
      display: grid;
      grid-auto-rows: var(--sw-lane-h, 12px);
      row-gap: 2px;
    }
    .ln {
      display: flex;
      align-items: center;
      gap: 5px;
      direction: rtl;
      font-size: var(--sw-fs-2xs);
      line-height: 1;
      color: var(--sw-text-3);
      white-space: nowrap;
      overflow: hidden;
    }
    .ln i {
      flex: none;
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--c, var(--sw-accent));
    }
    .ln.off {
      opacity: 0.45;
    }
    .trk {
      position: relative;
      min-inline-size: 0;
    }
    /* absolutely placed: the row height comes from the labels (the lane height token), the bars stretch to it */
    svg {
      position: absolute;
      inset: 0;
      display: block;
      inline-size: 100%;
      block-size: 100%;
      cursor: crosshair;
    }
  `;T([I({attribute:!1})],z.prototype,"lanes",2);T([I({attribute:!1})],z.prototype,"gaps",2);T([I({type:Number})],z.prototype,"from",2);T([I({type:Number})],z.prototype,"to",2);T([I({type:Number})],z.prototype,"cursor",2);T([I({type:Number})],z.prototype,"limit",2);z=T([xt("sw-history-lanes")],z);function ke(t){if(!(t instanceof Mt))return null;const e=t.body;return e&&typeof e.code=="string"?e.code:e&&e.error&&typeof e.error.code=="string"?e.error.code:null}function gt(t){return t instanceof Mt&&t.status===404}function Me(t,e){return kt(`floors/${encodeURIComponent(t)}/history/snapshot?at=${encodeURIComponent(e)}`)}function _e(t,e,s,a){const n=new URLSearchParams({from:e,to:s});return a&&a.length&&n.set("layers",a.join(",")),kt(`floors/${encodeURIComponent(t)}/history/range?${n.toString()}`)}const _t=["lights","presence","openings","temperature","devices","alarm"],Y=["lights","presence","openings","temperature","devices","alarm","elevators","cameras","events"],Se=["lights","presence","openings","temperature","devices","alarm","elevators"],G={lights:x("תאורה"),presence:x("נוכחות"),openings:x("דלתות וחלונות"),temperature:x("טמפרטורה"),devices:x("התקנים"),alarm:x("אזעקה"),elevators:x("מעליות"),cameras:x("מצלמות"),events:x("אירועים")},it={lights:"var(--sw-map-lit)",presence:"var(--sw-map-presence)",openings:"var(--sw-tl-door)",temperature:"var(--sw-map-temp)",devices:"var(--sw-obj-electrical)",alarm:"var(--sw-obj-safety)",elevators:"var(--sw-obj-security)",cameras:"var(--sw-recorded)",events:"var(--sw-tl-motion)"},wt="sw.history.layers";function nt(){const t={};for(const e of Y)t[e]=e!=="presence";return t}function ze(t){const e=nt();if(!t)return e;try{const s=JSON.parse(t);if(!s||typeof s!="object"||Array.isArray(s))return e;for(const a of Y){const n=s[a];typeof n=="boolean"&&(e[a]=n)}}catch{}return e}function Ie(t){const e={};for(const s of Y)e[s]=!!t[s];return JSON.stringify(e)}function Ae(t){switch(t){case"ok":return{text:x("ידוע"),look:"ok"};case"empty":return{text:x("אין בקומה"),look:"unk"};case"not_recorded":return{text:x("לא מוקלט"),look:"unk"};case"gap":return{text:x("פער בהקלטה"),look:"warn"};case"not_permitted":return{text:x("לא מורשה"),look:"lock"};default:return{text:x("לא ידוע"),look:"unk"}}}function De(t){return t===1?x("יום אחד"):t===2?x("יומיים"):t>=3&&t<=10?x("{n} ימים",{n:t}):x("{n} יום",{n:t})}function Ee(t){return typeof t=="number"&&t>0?`· ${De(t)}`:""}function ot(t){return(t??[]).map(e=>({from:Date.parse(e.from),to:Date.parse(e.to)})).filter(e=>Number.isFinite(e.from)&&Number.isFinite(e.to)&&e.to>e.from).sort((e,s)=>e.from-s.from)}function St(t,e){for(const s of t??[]){const a=Date.parse(s.from),n=Date.parse(s.to);if(e>=a&&e<n)return s}return null}const vt=(t,e,s)=>t.some(a=>a.to>e&&a.from<=s),C=t=>({state:null,known:!1,changedAt:null,changedDuring:!1,reason:t});function Oe(t,e){let s=0,a=t.length-1,n=-1;for(;s<=a;){const r=s+a>>1;Date.parse(t[r][0])<=e?(n=r,s=r+1):a=r-1}return n}function rt(t,e,s){if(s.gaps.some(u=>e>=u.from&&e<u.to))return C("gap");const a=Oe(t.points,e),n=a+1<t.points.length||t.bounded_after,r=Math.max(0,s.forwardFillMaxS)*1e3;if(a<0)return t.initial.known?vt(s.gaps,s.from,e)?C("gap"):!n&&e-s.from>r?C("forward_fill_exceeded"):{state:t.initial.state,known:!0,changedAt:null,changedDuring:!1,reason:null}:C("before_history");const[o,l,d]=t.points[a],h=Date.parse(o);if(vt(s.gaps,h,e))return C("gap");if(!n&&e-h>r)return C("forward_fill_exceeded");const p=s.bucketS!==null&&d>1&&e<h+s.bucketS*1e3;return{state:l,known:!0,changedAt:o,changedDuring:p,reason:null}}function Pe(t){const e={},s={},a={};for(const o of _t){const l=t.layers[o];if(l&&(s[o]=l.status,a[o]=l.retention_days,l.status!=="not_permitted"))for(const[d,h]of Object.entries(l.entities??{}))e[d]={state:h.known?h.state:null,known:!!h.known&&h.state!==null,changedAt:h.changed_at,changedDuring:!1,reason:h.known?null:h.reason,layer:o}}const n={},r=t.layers.elevators;if(r&&(s.elevators=r.status,a.elevators=r.retention_days,r.status!=="not_permitted"))for(const[o,l]of Object.entries(r.items??{}))n[o]={name:l.name,state:l.known?l.state:null,known:!!l.known&&l.state!==null};return t.layers.cameras&&(s.cameras=t.layers.cameras.status),t.layers.events&&(s.events=t.layers.events.status,a.events=t.layers.events.retention_days),{entities:e,elevators:n,status:s,retention:a,coverage:t.coverage??null,source:"snapshot"}}function Le(t,e,s){const a={from:Date.parse(t.from),to:Date.parse(t.to),gaps:ot(t.coverage?.gaps),forwardFillMaxS:t.coverage?.forward_fill_max_s??86400,bucketS:t.bucket_s},n=!!St(t.coverage?.gaps,e),r={},o={...s?.status??{}},l={...s?.retention??{}};for(const p of _t){const u=t.layers[p];if(u&&(o[p]=u.status==="ok"&&n?"gap":u.status,l[p]=u.retention_days,u.status!=="not_permitted"))for(const[b,f]of Object.entries(u.entities??{}))r[b]={...rt(f,e,a),layer:p}}const d={},h=t.layers.elevators;if(h&&(o.elevators=h.status==="ok"&&n?"gap":h.status,l.elevators=h.retention_days,h.status!=="not_permitted"))for(const[p,u]of Object.entries(h.items??{})){const b=rt(u,e,a);d[p]={name:u.name,state:b.known?b.state:null,known:b.known}}return{entities:r,elevators:d,status:o,retention:l,coverage:t.coverage??null,source:"range"}}function Re(t){return Ct(t)?"presence":Ht(t)?"openings":qt(t)?"lights":t.domain==="sensor"&&t.device_class==="temperature"?"temperature":t.domain==="alarm_control_panel"?"alarm":"devices"}function zt(t,e,s){return!!e[t]&&s[t]!=="not_permitted"}function Ne(t,e,s){const a={},n={};for(const r of[...s].sort()){const o=t?.entities[r],l=!!o&&o.known&&zt(o.layer,e,t?.status??{});a[r]=l?o.state:null,n[r]=l?o.changedAt:null}return{states:a,lastChanged:n}}function Te(t,e,s=a=>a??""){const a=t.filter(r=>r.polygon.length>=3);let n=0;for(const r of a){const o=s(r.level_id??null);e.some(l=>l.state!==null&&s(l.level_id??null)===o&&we({x:l.x,y:l.y},r.polygon))&&n++}return{known:n,total:a.length}}function Fe(t,e){if(e===null)return!1;switch(t){case"lights":case"presence":return e==="on";case"openings":return jt(e)||e==="unlocked";case"alarm":return e.startsWith("armed")||e==="triggered"||e==="pending"||e==="arming";case"elevators":return e!=="ok";default:return!1}}function We(t){const e=[];for(const s of["on","changed"]){const a=t.filter(n=>n.kind===s).sort((n,r)=>n.from-r.from);for(const n of a){const r=e.length&&e[e.length-1].kind===s?e[e.length-1]:null;r&&n.from<=r.to?r.to=Math.max(r.to,n.to):e.push({...n})}}return e}function Ce(t,e,s,a,n){const r=[],o=[],l=new Set([s,a]),d=Math.max(0,n.forwardFillMaxS)*1e3;for(const[p,,u]of e.points){const b=Date.parse(p);if(b>=s&&b<=a&&(l.add(b),u>0&&o.push(b)),b+d>s&&b+d<a&&l.add(b+d),n.bucketS!==null&&u>1){const f=Math.max(s,b),M=Math.min(a,b+n.bucketS*1e3);M>f&&r.push({from:f,to:M,kind:"changed"})}}n.from+d>s&&n.from+d<a&&l.add(n.from+d);for(const p of n.gaps)p.from>s&&p.from<a&&l.add(p.from),p.to>s&&p.to<a&&l.add(p.to);const h=[...l].sort((p,u)=>p-u);for(let p=0;p+1<h.length;p++){const u=h[p],b=h[p+1];if(b<=u)continue;const f=rt(e,u,n);f.known&&Fe(t,f.state)&&r.push({from:u,to:b,kind:"on"})}return{spans:r,marks:o}}function He(t,e,s,a,n,r){const o=r[e]==="not_permitted"||!!t&&(e==="elevators"?t.layers.elevators:t.layers[e])?.status==="not_permitted",l={id:e,label:G[e],color:it[e],off:!n[e]||o,locked:o,spans:[],marks:[]};if(!t||o)return l;const d={from:Date.parse(t.from),to:Date.parse(t.to),gaps:ot(t.coverage?.gaps),forwardFillMaxS:t.coverage?.forward_fill_max_s??86400,bucketS:t.bucket_s},h=Object.values(e==="elevators"?t.layers.elevators?.items??{}:t.layers[e]?.entities??{}),p=[],u=[];for(const b of h){const f=Ce(e,b,s,a,d);p.push(...f.spans),u.push(...f.marks)}return l.spans=We(p),l.marks=[...new Set(u)].sort((b,f)=>b-f),l}function qe(t,e,s){return ot(t).filter(a=>a.to>e&&a.from<s).map(a=>({from:Math.max(e,a.from),to:Math.min(s,a.to)}))}const yt=[1,10,60,600];function je(t,e,s,a){const n=t+Math.max(0,e)*s;return n>=a?{t:a,ended:!0}:{t:n,ended:!1}}var Ke=Object.defineProperty,Ue=Object.getOwnPropertyDescriptor,w=(t,e,s,a)=>{for(var n=a>1?void 0:a?Ue(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(a?o(e,s,n):o(n))||n);return a&&n&&Ke(e,s,n),n};const at=10,Ve=[{label:i("יום"),minutes:1440},{label:i("6 שע׳"),minutes:360},{label:i("שעה"),minutes:60},{label:i("10 דק׳"),minutes:10}],Be={ok:i("תקין"),fault:i("תקלה"),fire_service:i("שירות כבאים"),out_of_service:i("מושבת"),unknown:i("לא ידוע")},Ge=150;function Ye(t){return t==="person"||t==="vehicle"||t==="motion"||t==="line"||t==="offline"||t==="door"?t:"motion"}let m=class extends $t{constructor(){super(...arguments),this.bubbleSkin=new At(this),this.floorId="f0",this.at="",this.camera="",this.minute=615,this.tz="Asia/Jerusalem",this.date="",this.tree=null,this.bundle=null,this.events=[],this.recordings=new Map,this.selectedId=null,this.loading=!1,this.error="",this.frameAt="",this.frameFailed=!1,this.casePick=null,this.geometry=null,this.level=null,this.catalogLookup=null,this.planImage=!0,this.geomSeq=0,this.frameTimer=0,this.view3d=!1,this.default3d=!1,this.threeState="idle",this.threeError="",this.preset3d="iso",this.catalog3d=null,this.real3d=!1,this.materials3d=null,this.bundleSeq=0,this.itemNames=new Map,this.sceneMemo=null,this.scrub=!1,this.switches=nt(),this.snapshot=null,this.snapLoading=!1,this.snapError="",this.range=null,this.rangeNote="",this.mode="snapshot",this.playing=!1,this.speed=1,this.winMinutes=1440,this.winStart=0,this.detailsOpen=!1,this.playMs=0,this.stateMs=0,this.rangeMaxDays=7,this.snapSeq=0,this.rangeSeq=0,this.initReads=new ft,this.dayReads=new ft,this.memo=new me,this.rangeKey="",this.rangeTimer=0,this.raf=0,this.lastFrame=0,this.lastStateTick=0,this.factsMemo=null,this.replayMemo=null,this.drawnMemo=null,this.roomMemo=null,this.snapReplayMemo=null,this.onKey=t=>{const e=t.composedPath()[0],s=te(e);if(!(this.scrub&&!s&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&this.onScrubKey(t,e))&&t.key==="3"&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&!s){if(t.preventDefault(),t.repeat)return;this.toggle3d()}},this.markersMemo=null,this.lanesMemo=null,this.tick=t=>{if(!this.playing)return;const e=Math.min(250,Math.max(0,t-this.lastFrame));this.lastFrame=t;const s=je(this.playMs,e,this.speed,this.winToMs);if(this.playMs=s.t,this.minute=this.minuteOfMs(s.t),(s.ended||t-this.lastStateTick>=Ge)&&(this.stateMs=s.t,this.lastStateTick=t),s.ended){this.stopPlay(!0);return}this.raf=requestAnimationFrame(this.tick)}}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onKey),U()&&this.init()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),this.stopPlay(!1),window.clearTimeout(this.rangeTimer),window.clearTimeout(this.frameTimer)}willUpdate(t){t.has("scrub")&&this.toggleAttribute("data-scrub",this.scrub)}updated(t){U()&&(ee(this.default3d,this.view3d,this.hasScene)&&(this.default3d=!1,this.toggle3d()),(t.has("floorId")&&t.get("floorId")!==void 0||t.has("at")&&t.get("at")!==void 0)&&this.init())}async init(){const t=this.initReads.begin();this.loading=!0,this.error="";try{const[e,s]=await Promise.all([Dt(),this.tree?Promise.resolve(this.tree):Et()]);if(!t())return;this.tz=e["time.zone"]??this.tz,this.tree=s,this.scrub=String(e["history.timescrub"]??"false")==="true";const a=Number(e["history.range_max_days"]??7);if(this.rangeMaxDays=Number.isFinite(a)?Math.max(1,Math.min(30,a)):7,this.scrub&&this.restoreSwitches(),this.stopPlay(!1),this.snapshot=null,this.snapError="",this.range=null,this.rangeKey="",this.rangeNote="",U()&&this.floors.length&&!this.floors.some(o=>o.id===this.floorId)){const o=new URLSearchParams(window.location.hash.split("?")[1]??"").toString();window.location.replace(`#/investigate/floors/${this.floors[0].id}/history${o?`?${o}`:""}`);return}const n=this.at?new Date(this.at):new Date;this.date=W(n,this.tz),this.minute=L(n,this.tz);const r=await lt(this.floorId,!1,S(this.instant));if(!t())return;if(this.bundle=r,this.restorePlanImage(),this.level=Kt(e["plan.levels"],this.bundle),this.default3d=se(e)&&!this.view3d,this.geometry=null,this.bundle.source==="api"&&Xt(this.bundle.catalogRevision).then(o=>{const l=ae(o);this.catalogLookup=l.catalogLookup,this.catalog3d=l.catalog3d,this.materials3d=l.materials3d,this.itemNames=l.itemNames}).catch(()=>{}),this.updateGeometry(),this.scheduleFrame(),this.scrub&&(this.fitWindow(!0),this.fetchSnapshot(),this.scheduleRange(0)),this.camera){const o=this.bundle.anchors.find(l=>l.resource_type==="camera"&&l.resource_id===this.camera);this.selectedId=o?.id??null,o&&(this.preset3d={camera:`cam:${o.id}`})}await this.loadDay()}catch(e){if(!t())return;this.error=tt(e)}finally{t()&&(this.loading=!1)}}setPlanImage(t){this.planImage=t,ie("history",this.floorId,t)}restorePlanImage(){this.planImage=ne("history",this.floorId)}async loadDay(){const t=this.bundle;if(!t)return;const e=t.anchors.filter(o=>o.resource_type==="camera").map(o=>o.resource_id),s=this.dayReads.begin(),[a,n]=await Promise.all([Gt({date:this.date,limit:1e3}).then(o=>o.events.filter(l=>l.camera_id&&e.includes(l.camera_id))).catch(()=>[]),Promise.allSettled(e.map(o=>Yt(o,this.date)))]);if(!s())return;this.events=a;const r=new Map;e.forEach((o,l)=>{const d=n[l];r.set(o,d.status==="fulfilled"?d.value:null)}),this.recordings=r}get instant(){return ut(this.date,this.minute,this.tz)}segmentsFor(t){const{recordings:e,tz:s}=this,a=this.memo.get("segmentsByCamera",[e,s],()=>new Map);if(a.has(t))return a.get(t)??null;const n=e.get(t),r=n?n.segments.map(o=>{const l=L(new Date(o.start_at),s);let d=L(new Date(o.end_at),s);return d<l&&(d=1440),{startMin:l,endMin:d,kind:o.kind==="continuous"?"continuous":"motion"}}):null;return a.set(t,r),r}timelineSegments(t,e=!0){const{recordings:s,tz:a}=this;return this.memo.get("tlSegments",[s,a,t,e],()=>e?t!==null?this.segmentsFor(t)??[]:Array.from(s.keys()).flatMap(n=>this.segmentsFor(n)??[]):[])}timelineEvents(t,e=!0){const{events:s,tz:a}=this;return this.memo.get("tlEvents",[s,a,t,e],()=>e?(t!==null?s.filter(n=>n.camera_id===t):s).map(n=>({minute:L(new Date(n.occurred_at),a),kind:Ye(n.type),label:`${pt[n.type]??n.type}${n.count>1?` ×${n.count}`:""}`})):[])}camerasOf(t){return this.memo.get("cameras3d",[t],()=>t.anchors.filter(e=>e.resource_type==="camera").map(e=>({id:e.id,label:O(e)})))}anchorPositionsOf(t){return this.memo.get("anchorPositions",[t.anchors],()=>Object.fromEntries(t.anchors.map(e=>[`${e.resource_type}:${e.resource_id}`,{x:e.position.x,y:e.position.y,rotation:e.rotation_degrees}])))}zonesOf(t){return this.memo.get("zones",[t.zones],()=>Ut(t.zones))}coverageAt(t){const e=this.segmentsFor(t);if(!e)return{state:"unknown"};const s=e.find(a=>this.minute>=a.startMin&&this.minute<=a.endMin);return s?{state:"historic",segment:s}:{state:"unknown"}}eventsNear(t,e=at){const s=this.instant.getTime();return this.events.filter(a=>(!t||a.camera_id===t)&&Math.abs(new Date(a.occurred_at).getTime()-s)<=e*60*1e3).sort((a,n)=>Math.abs(new Date(a.occurred_at).getTime()-s)-Math.abs(new Date(n.occurred_at).getTime()-s))}get apiMarkers(){const t=this.bundle;return t?t.anchors.map(e=>{if(e.resource_type==="camera"){const n=this.coverageAt(e.resource_id),r=this.eventsNear(e.resource_id,5).length,o=e.camera?.name??e.label??e.resource_id;return{id:e.id,kind:"camera",label:r?`${o} · ${i("{n} אירועים",{n:r})}`:o,x:e.position.x,y:e.position.y,rotation:e.rotation_degrees,fov:e.field_of_view_degrees??void 0,radius:e.coverage_radius??void 0,polygon:e.coverage_polygon?e.coverage_polygon.map(([l,d])=>({x:l,y:d})):void 0,labelPos:e.label_pos??void 0,level:e.level_id??null,state:n.state}}const s=e.entity?.state_at,a=O(e);return{id:e.id,kind:Ot(e.layer_id,e.entity?.domain),label:s?.known&&s.state?`${a} · ${K({...e.entity??{domain:"",unit:null,device_class:null,attributes:{}},state:s.state})}`:a,x:e.position.x,y:e.position.y,state:s?.known?"historic":"unknown"}}):[]}get selectedAnchor(){return this.bundle?.anchors.find(t=>t.id===this.selectedId)??null}get limitMinute(){return this.date===W(new Date,this.tz)?L(new Date,this.tz):1440}setMinute(t){this.minute=Math.max(0,Math.min(this.limitMinute,t)),this.scrub&&(this.playing&&(this.playMs=this.instant.getTime(),this.stateMs=this.playMs),this.fitWindow(!1)),this.scheduleFrame()}scheduleFrame(){window.clearTimeout(this.frameTimer),this.frameTimer=window.setTimeout(()=>{this.frameAt=S(this.instant),this.frameFailed=!1,this.ensureVersion(),this.scrub&&!this.playing&&this.fetchSnapshot()},600)}async updateGeometry(){const t=this.bundle,e=++this.geomSeq;if(!t||t.source!=="api"||!t.planVersionId){this.geometry=null;return}const s=S(this.instant),a=t.history==="exact"?await Jt(t.planVersionId,s):await Qt(t);e===this.geomSeq&&(this.geometry=a)}async ensureVersion(){const t=this.bundle;if(!t||t.source!=="api"||!t.at)return;const e=S(this.instant);if(e===t.at){this.updateGeometry();return}const s=++this.bundleSeq;try{const a=await lt(this.floorId,!1,e);if(s!==this.bundleSeq||this.bundle!==t)return;const n=t.anchors.map(r=>r.resource_id).sort().join(",");this.bundle=a,a.planVersionId!==t.planVersionId&&(this.geometry=null),this.updateGeometry(),this.selectedId&&!a.anchors.some(r=>r.id===this.selectedId)&&(this.selectedId=null),a.anchors.map(r=>r.resource_id).sort().join(",")!==n&&await this.loadDay()}catch{}}renderEntityStates(t){const e=t.anchors.filter(n=>n.resource_type==="ha_entity");if(!e.length)return c`${i("אין ישויות מוצבות בקומה")}`;const s=e.filter(n=>n.entity?.state_at?.known),a=t.haHistory;return c`${i("{n} מתוך {total} ידועות בזמן זה",{n:s.length,total:e.length})}${a?.from?c` <span class="note">${i("(היסטוריה מקומית מ־")}<span class="ltr">${this.fmtWhen(a.from)}</span>, ${i("{n} ימים)",{n:String(a.retention_days)})}</span>`:c` <span class="note">${i("(אין עדיין היסטוריה מקומית)")}</span>`}
      <div class="evl" style="margin-block-start:4px">${e.slice(0,8).map(n=>{const r=n.entity?.state_at,o=O(n);return c`<div data-history-entity data-known=${r?.known?"true":"false"} data-source=${r?.source??"vms"}><span>${o}${r?.source==="ha_recorder"?c` <span class="note" title=${i("המצב מגיע מהיסטוריית המערכת (מקור משני)")}>· ${i("מקור משני")}</span>`:v}</span><span class="note">${r?.known&&r.state?c`${K({...n.entity??{domain:"",unit:null,device_class:null,attributes:{}},state:r.state})} · ${i("מ־")}<span class="ltr">${r.changed_at?this.fmt(r.changed_at):""}</span>`:c`${i("לא ידוע")}${r?.reason?` · ${r.reason}`:""}${r?.state?c` <span class="ltr">${i("(אחרון: {state})",{state:r.state})}</span>`:""}`}</span></div>`})}</div>`}fmtWhen(t){return Pt(new Date(t),{timeZone:this.tz})}setDate(t){t&&(this.date=t,this.minute=Math.min(this.minute,this.limitMinute),this.loadDay(),this.scrub&&(this.stopPlay(!1),this.fitWindow(!0),this.scheduleRange(),this.scheduleFrame()))}fmt(t){return ct(new Date(t),{timeZone:this.tz,seconds:!0})}get floors(){return this.tree?.source!=="api"?[]:this.tree.sites.flatMap(t=>(t.buildings??[]).flatMap(e=>(e.floors??[]).map(s=>({id:s.id,name:`${e.name} · ${s.name}`}))))}stateAt(t){return t.entity?.state_at?.known?t.entity.state_at.state:null}get hasScene(){return this.bundle?.source==="api"&&this.geometry!==null}get sceneDescription(){const t=this.bundle,e=this.geometry;if(!this.view3d||!t||t.source!=="api"||!e)return null;const s=this.scrub?this.scrubDrawn:null,a=this.scrub?this.scrubRoomLayer:null,n=[t,e,this.catalog3d,this.level,this.itemNames,this.recordings,this.minute,this.tz,this.real3d,this.materials3d,this.scrub,s,a,this.switches];if(this.sceneMemo&&N(this.sceneMemo.refs,n))return this.sceneMemo.desc;const{entityStates:r,circuitStates:o}=s?{entityStates:s.states,circuitStates:this.scrubCircuits}:mt(t.anchors,t.circuitStates),d=(this.scrub?t.anchors.filter(f=>this.scrubVisible(f)):t.anchors).map(f=>({id:f.id,resource_type:f.resource_type,resource_id:f.resource_id,x:f.position.x,y:f.position.y,rotation:f.rotation_degrees,fov:f.field_of_view_degrees??null,radius:f.coverage_radius??null,polygon:f.coverage_polygon??null,level_id:f.level_id??null,layer_id:f.layer_id,label:O(f),state:s?s.states[f.resource_id]??null:this.stateAt(f),online:f.resource_type==="camera"?this.coverageAt(f.resource_id).state==="historic":null,mount_height_m:f.mount_height_m??null,tilt_deg:f.tilt_deg??null})),h=re(t.zones),p=[JSON.stringify([t.floorId,t.width,t.height,d,r,o,h,Vt(a)]),e,this.catalog3d,this.level,this.itemNames,this.real3d,this.materials3d];if(this.sceneMemo&&N(this.sceneMemo.keys,p))return this.sceneMemo={...this.sceneMemo,refs:n},this.sceneMemo.desc;const u=pe({doc:e,width:t.width,height:t.height,anchors:d,entityStates:r,circuitStates:o,catalog:this.catalog3d,zones:h,level:this.level,anchorsEveryLevel:!0,...a?{roomStates:a}:{},...this.real3d?{realistic:!0,materialsCatalog:this.materials3d}:{}}),b=oe(t.anchors,O,e.objects,this.itemNames,t.zones);return this.sceneMemo={refs:n,keys:p,desc:u,labels:b},u}get shows3d(){return this.view3d&&this.threeState==="ready"&&this.sceneDescription!==null}async toggle3d(){if(this.view3d){this.view3d=!1;return}if(!(!R()||!this.hasScene||this.threeState==="loading")){if(this.threeState!=="ready"){this.threeState="loading";const t=await le();if(t!==null){this.threeState="error",this.threeError=t;return}this.threeState="ready"}this.view3d=!0}}onPartSelect(t){const{id:e,kind:s}=t.detail;if(!e){this.selectedId=null;return}const a=s?ue({id:e,kind:s},this.geometry,this.bundle?.anchors??[]):null;!a||!("anchor"in a)||(this.selectedId=a.anchor,this.frameFailed=!1)}renderPanel(t){return c`<div class="panel">${this.panelCards(t)}</div>`}panelCards(t,e){const s=this.selectedAnchor,a=s?.resource_type==="camera"?s:null,n=a?this.coverageAt(a.resource_id):null,r=a?this.recordings.get(a.resource_id):void 0,o=e?.eventsOff?[]:this.eventsNear(void 0,at),l=S(this.instant);return c`
      <sw-card heading=${i("בנקודת הזמן שנבחרה")} subheading=${i("זמן ונתונים מאותו רגע")} data-history-panel>
        <dl>
          <dt>${i("זמן")}</dt><dd><span class="ltr" data-history-time>${this.date} ${P(this.minute)}</span> <span class="note">${this.tz}</span></dd>
          <dt>${i("מצלמה נבחרת")}</dt><dd data-history-camera>${a?a.camera?.name??a.resource_id:i("לחץ על מצלמה במפה")}</dd>
          ${a?c`<dt>${i("הקלטה")}</dt><dd>${r===void 0?i("טוען…"):r===null?i("לא ניתן לבדוק מול המקליט"):n?.segment?c`${i("יש הקלטה")} · ${st(n.segment.startMin)}–${st(n.segment.endMin)} · ${n.segment.kind==="continuous"?i("רציף"):i("תנועה")}`:i("אין הקלטה בזמן זה (פער)")}</dd>
                <dt>${i("אירועים ±5 דק׳")}</dt><dd>${this.eventsNear(a.resource_id,5).length}</dd>`:v}
          <dt>${i("התקנים")}</dt><dd data-history-entities>${e?e.entities:this.renderEntityStates(t)}</dd>
          ${e?e.rows:v}
          ${a&&this.frameAt?c`<dt>${i("פריים")}</dt><dd><div class="frame" data-history-frame>${this.frameFailed?c`<span>${i("אין פריים בהקלטה בזמן זה")}</span>`:c`<img src=${Zt(a.resource_id,this.frameAt)} alt=${i("פריים מההקלטה בזמן שנבחר")} @error=${()=>this.frameFailed=!0} />`}</div></dd>`:v}
          <dt>${i("גרסת תוכנית")}</dt><dd data-history-plan-version data-history-mode=${t.history??"live"}>${t.history==="exact"&&t.planPublishedAt?c`${i("בתוקף באותו זמן · פורסמה")} <span class="ltr">${this.fmtWhen(t.planPublishedAt)}</span>${t.planArchivedAt?c` · ${i("הוחלפה")} <span class="ltr">${this.fmtWhen(t.planArchivedAt)}</span>`:""}`:t.historyFrom?c`${i("המפה הנוכחית · היסטוריית המפה מתחילה")} <span class="ltr">${this.fmtWhen(t.historyFrom)}</span>`:i("המפה הנוכחית")}</dd>
        </dl>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-block-start:10px">
          ${a?c`<sw-button variant="primary" size="sm" icon="history" @click=${()=>F("/investigate/playback",{camera:a.resource_id,t:l})}>${i("נגן מכאן")}</sw-button>`:v}
          ${e?e.actions:v}
          <sw-button size="sm" icon="case" data-add-to-case ?disabled=${!a} title=${a?i("קטע של המצלמה הנבחרת סביב הזמן שנבחר (15 שניות לפני, 45 אחרי)"):i("בחר מצלמה במפה")} @click=${()=>{a&&(this.casePick={kind:"clip",camera_id:a.resource_id,...Wt(this.instant)})}}>${i("הוסף לתיק")}</sw-button>
        </div>
      </sw-card>
      <sw-case-picker .item=${this.casePick} subheading=${a?`${a.camera?.name??a.resource_id} · ${this.date} ${P(this.minute)}`:""} @close=${()=>this.casePick=null}></sw-case-picker>
      <sw-card heading=${i("אירועים סביב הזמן")} subheading=${`${i("±{n} דקות",{n:at})} · ${i("מצלמות הקומה")}`}>
        ${o.length?c`<div class="evl" data-history-events>${o.slice(0,8).map(d=>c`<a class=${a&&d.camera_id===a.resource_id?"hit":""} href=${`#/investigate/events/${d.id}`}><span>${pt[d.type]??d.type} · ${d.camera_name??d.channel??""}<div class="s">${d.confidence==="inferred"?i("נגזר מהקלטה"):i("התראה מהמקליט")}${d.acked_at?` · ${i("טופל")}`:""}</div></span><span class="ltr">${this.fmt(d.occurred_at)}</span></a>`)}</div>`:c`<div class="note">${e?.eventsOff??i("אין אירועים בחלון הזה.")}</div>`}
      </sw-card>`}renderApi(){const t=this.bundle;if(this.error&&!t)return c`<div class="head lead-head"><h1>${i("מפה היסטורית")}</h1></div><sw-state-panel state="error" hint=${this.error}></sw-state-panel>`;if(!t)return c`<div class="head lead-head"><h1>${i("מפה היסטורית")}</h1></div><sw-state-panel state="loading"></sw-state-panel>`;const e=this.selectedAnchor,s=e?.resource_type==="camera"?e.resource_id:null,a=this.timelineSegments(s),n=this.timelineEvents(s);return c`
      <div class="head lead-head">
        <div><h1>${i("המפה בזמן שנבחר")} · ${t.floorName}</h1><div class="sub">${t.buildingName} · <span class="ltr">${this.date} ${P(this.minute)}</span> · ${this.tz}</div></div>
        <span class="grow"></span>
        ${this.floors.length>1?c`<sw-field><select aria-label=${i("קומה")} @change=${r=>F(`/investigate/floors/${r.target.value}`,{t:this.instant.toISOString()})}>${this.floors.map(r=>c`<option value=${r.id} ?selected=${r.id===this.floorId}>${et(r.name)}</option>`)}</select></sw-field>`:v}
        ${t.imageUrl?c`<sw-button icon="map" aria-pressed=${this.planImage} data-plan-background title=${this.planImage?i("הסתר את תמונת התוכנית"):i("הצג את תמונת התוכנית")} @click=${()=>this.setPlanImage(!this.planImage)}>${i("תמונת התוכנית")}</sw-button>`:v}
        <sw-button icon="cube" aria-pressed=${this.view3d} data-view-3d ?disabled=${!this.view3d&&(!R()||!this.hasScene||this.threeState==="loading")}
          title=${R()?this.hasScene?i("מקש 3"):i("אין מבנה מפורסם בזמן הזה"):B} @click=${()=>this.toggle3d()}>${this.view3d?"2D":"3D"}</sw-button>
        ${R()?v:c`<span class="note" data-3d-unavailable>${B}</span>`}
        <sw-button icon="live" data-back-live @click=${()=>F(`/explore/floors/${t.floorId}`)}>${i("חזרה למצב חי")}</sw-button>
      </div>
      <div class="bar"><sw-icon name="clock" size=${14}></sw-icon><span>${i("מצב חקירה היסטורי — פעולות פיזיות אינן זמינות. מצב ללא היסטוריה מוצג כלא ידוע, לא כערך החי האחרון.")}</span>${this.loading?c`<span class="note">${i("טוען הקלטות ואירועים…")}</span>`:v}</div>
      <div class="layout">
        <div class="stage">
          <div class="chip"><sw-icon name="building" size=${14}></sw-icon>${t.floorName}</div>
          <div class="hist">${i("מצב היסטורי")} · <span class="ltr">${P(this.minute)}</span></div>
          ${this.shows3d&&this.sceneDescription?c`<sw-plan-3d data-history-3d .description=${this.sceneDescription} .selectedId=${this.selectedId} .preset=${this.preset3d} .frameKey=${t.floorId} .labels=${this.sceneMemo?.labels??{}}
                .cameras=${this.camerasOf(t)} exportName=${`plan-3d-${t.floorName}-${this.date}`}
                .sunAt=${this.instant.getTime()} .walkable=${V.walkable} .stillsAvailable=${V.stillsAvailable}
                @realistic-change=${r=>{this.real3d!==r.detail.on&&(this.real3d=r.detail.on)}}
                @part-select=${r=>this.onPartSelect(r)}></sw-plan-3d>`:v}
          <sw-plan-canvas style=${this.shows3d?"display:none":""} alwaysLabel .planWidth=${t.width} .planHeight=${t.height} .plan=${t.planSvg} .imageUrl=${t.imageUrl} .hideImage=${!this.planImage} .markers=${this.apiMarkers} .selectedId=${this.selectedId} .zones=${this.zonesOf(t)} .geometry=${this.geometry} .structureLevel=${this.level} .catalog=${this.catalogLookup} .anchorPositions=${this.anchorPositionsOf(t)} .entityStates=${Object.fromEntries(t.anchors.filter(r=>r.resource_type==="ha_entity").map(r=>[r.resource_id,this.stateAt(r)]))} dimEntities
            @marker-select=${r=>{this.selectedId=r.detail.id,this.frameFailed=!1}}></sw-plan-canvas>
          ${this.threeState==="loading"?c`<div class="hist below" data-3d-loading>${i("טוען תלת-ממד…")}</div>`:v}
          ${this.threeState==="error"?c`<div class="hist below" data-3d-load-error>${i("תלת-ממד לא נטען: {error}",{error:this.threeError})}</div>`:v}
          ${this.shows3d?v:c`<div class="legend"><span>${i("כחול = יש הקלטה בזמן זה")}</span><span>${i("מקווקו = אין הקלטה / לא ידוע")}</span><span>${i("התקנים = מצב מההיסטוריה המקומית או לא ידוע")}</span></div>`}
        </div>
        ${this.renderPanel(t)}
      </div>
      <div class="tl">
        <div class="tlbar">
          <sw-badge kind="historic"></sw-badge>
          <span class="time">${this.date} ${P(this.minute)}</span>
          <sw-chip @click=${()=>this.setMinute(this.minute-60)}>${i("-1 שעה")}</sw-chip><sw-chip @click=${()=>this.setMinute(this.minute-5)}>${i("-5 דק׳")}</sw-chip><sw-chip @click=${()=>this.setMinute(this.minute+5)}>${i("+5 דק׳")}</sw-chip><sw-chip @click=${()=>this.setMinute(this.minute+60)}>${i("+1 שעה")}</sw-chip>
          <span class="grow"></span>
          <sw-field><input type="date" lang=${dt()} .value=${this.date} max=${W(new Date,this.tz)} data-ltr aria-label=${i("תאריך")} @change=${r=>this.setDate(r.target.value)} /></sw-field>
          <span class="note">${e?.resource_type==="camera"?i("ציר הזמן: {name}",{name:e.camera?.name??""}):i("ציר הזמן: כל מצלמות הקומה")}</span>
        </div>
        <sw-timeline .segments=${a} .events=${n} .cursor=${this.minute} .limit=${this.limitMinute} .follow=${!1} precision="estimated" @seek=${r=>this.setMinute(r.detail.minute)} @scrub=${r=>this.setMinute(r.detail.minute)}></sw-timeline>
      </div>
    `}restoreSwitches(){try{this.switches=ze(localStorage.getItem(wt))}catch{this.switches=nt()}}toggleLayer(t){this.switches={...this.switches,[t]:!this.switches[t]};try{localStorage.setItem(wt,Ie(this.switches))}catch{}}featureOff(){this.stopPlay(!1),this.scrub=!1,this.snapshot=null,this.range=null,this.rangeKey=""}async fetchSnapshot(){const t=this.bundle;if(!this.scrub||!t||t.source!=="api")return;const e=S(this.instant);if(this.snapshot&&Date.parse(this.snapshot.at)===Date.parse(e))return;const s=++this.snapSeq,a=this.floorId;this.snapLoading=!0;try{const n=await Me(a,e);if(s!==this.snapSeq||a!==this.floorId)return;this.snapshot=n,this.snapError="";const r=Number(n.settings?.range_max_days);Number.isFinite(r)&&r>=1&&(this.rangeMaxDays=Math.min(30,r))}catch(n){if(s!==this.snapSeq)return;if(gt(n)){this.featureOff();return}this.snapError=tt(n)}finally{s===this.snapSeq&&(this.snapLoading=!1)}}msAt(t){return ut(this.date,t,this.tz).getTime()}minuteOfMs(t){return t>=this.msAt(1440)?1440:t<=this.msAt(0)?0:Math.max(0,Math.min(1440,L(new Date(t),this.tz)+(t%1e3+1e3)%1e3/6e4))}get winFromMs(){return this.msAt(this.winStart)}get winToMs(){return Math.min(this.msAt(this.winStart+this.winMinutes),this.msAt(this.limitMinute))}fitWindow(t){const e=this.winMinutes;if(!t&&this.minute>=this.winStart&&this.minute<=this.winStart+e)return;const s=e>=1440?0:Math.max(0,Math.min(1440-e,this.minute-e/2));(s!==this.winStart||t)&&(this.winStart=s,this.scheduleRange())}setWindow(t){this.winMinutes=t,this.winStart=t>=1440?0:Math.max(0,Math.min(1440-t,this.minute-t/2)),this.scheduleRange()}onTimelineWindow(t){const e=t.target;this.winMinutes=e.windowMinutes,this.winStart=e.start,this.scheduleRange()}scheduleRange(t=300){window.clearTimeout(this.rangeTimer),this.rangeTimer=window.setTimeout(()=>void this.fetchRange(),t)}async fetchRange(){const t=this.bundle;if(!this.scrub||!t||t.source!=="api")return;const e=this.winFromMs,s=Math.min(this.winToMs,e+this.rangeMaxDays*864e5);if(!(s>e)){this.range=null,this.rangeKey="";return}const a=`${this.floorId}|${e}|${s}`;if(a===this.rangeKey)return;const n=++this.rangeSeq,r=this.floorId;try{const o=await _e(r,S(e),S(s),Se);if(n!==this.rangeSeq||r!==this.floorId)return;this.range=o,this.rangeKey=a,this.rangeNote=""}catch(o){if(n!==this.rangeSeq)return;if(gt(o)){this.featureOff();return}const l=ke(o);this.range=null,this.rangeKey="",this.rangeNote=l==="range_too_large"?i("יותר מדי שינויים בחלון - בחרו חלון קצר יותר"):l==="range_too_long"?i("החלון ארוך מהמותר - בחרו חלון קצר יותר"):i("פסי השכבות לא נטענו: {error}",{error:tt(o)})}}get replayMs(){return this.playing?this.stateMs:this.instant.getTime()}get snapReplay(){const t=this.snapshot;return t?(this.snapReplayMemo?.snap!==t&&(this.snapReplayMemo={snap:t,value:Pe(t)}),this.snapReplayMemo.value):null}get replay(){const t=this.replayMs,e=[this.snapshot,this.range,t,this.playing];if(this.replayMemo&&N(this.replayMemo.refs,e))return this.replayMemo.value;let s=null;const a=this.snapshot;return!this.playing&&a&&Math.abs(Date.parse(a.at)-t)<1e3?s=this.snapReplay:this.range&&t>=Date.parse(this.range.from)&&t<=Date.parse(this.range.to)&&(s=Le(this.range,t,this.snapReplay)),this.replayMemo={refs:e,value:s},s}get layerStatus(){return this.replay?.status??this.snapReplay?.status??{}}layerOfAnchor(t){const e=t.resource_id;return this.replay?.entities[e]?.layer??this.snapReplay?.entities[e]?.layer??Re({id:e,domain:t.entity?.domain??e.split(".")[0]??"",device_class:t.entity?.device_class??null,layer_id:t.layer_id})}scrubVisible(t){return t.resource_type==="camera"?this.switches.cameras:!!this.switches[this.layerOfAnchor(t)]}get scrubDrawn(){const t=this.bundle,e=this.replay,s=[t,e,this.switches];if(this.drawnMemo&&N(this.drawnMemo.refs,s))return this.drawnMemo.value;const a=(t?.anchors??[]).filter(r=>r.resource_type==="ha_entity").map(r=>r.resource_id),n=Ne(e,this.switches,a);return this.drawnMemo={refs:s,value:n},n}get scrubCircuits(){const t=this.bundle,e=this.replay,s=()=>Object.fromEntries(Object.keys(t?.circuitStates??{}).sort().map(a=>[a,null]));return!t||!e||this.playing||!t.at||Math.abs(Date.parse(t.at)-this.replayMs)>=1e3||!zt("lights",this.switches,e.status)?s():mt(t.anchors,t.circuitStates).circuitStates}factsFor(t,e){const s=this.factsMemo;if(s&&s.geometry===t&&s.w===e.width&&s.h===e.height&&s.catalog===this.catalogLookup)return s.facts;const a=ve(t,e.width,e.height,this.catalogLookup);return this.factsMemo={geometry:t,w:e.width,h:e.height,catalog:this.catalogLookup,facts:a},a}get scrubRoomLayer(){const t=this.bundle,e=this.geometry;if(!t||t.source!=="api")return null;const s=this.scrubDrawn,a=this.scrubCircuits,n=[t,e,this.catalogLookup,s,JSON.stringify(a),this.replayMs];if(this.roomMemo&&N(this.roomMemo.refs,n))return this.roomMemo.value;const r=e?this.factsFor(e,t):null;let o=null;if(t.zones.length||r?.openings.length){const l=ye(t.anchors,s.states,{lastChanged:s.lastChanged,withAttributes:!1}),d=ce(r,a,s.states),h=de(t.zones),p=this.levelFallback;o=Bt({rooms:h,entities:l,openings:r?.openings??[],lamps:d,size:[t.width,t.height],scaleMPerPx:t.scaleMPerPx,now:this.replayMs,fade:"off",levelOf:u=>u??p})}return this.roomMemo={refs:n,value:o},o}get levelFallback(){return he(this.geometry,this.bundle)}get scrubMarkers(){const t=this.bundle;if(!t)return[];const e=this.scrubDrawn,s=this.layerStatus,a=[t,e,this.switches,this.recordings,this.events,Math.floor(this.minute),this.date],n=String(s.cameras??"");if(this.markersMemo&&this.markersMemo.key===n&&N(this.markersMemo.refs,a))return this.markersMemo.value;const r=s.cameras==="not_permitted",o=new Map(t.anchors.map(d=>[d.id,d])),l=[];for(const d of this.apiMarkers){const h=o.get(d.id);if(!h||!this.scrubVisible(h))continue;if(h.resource_type==="camera"){l.push(r?{...d,label:h.camera?.name??h.label??h.resource_id,state:"unknown"}:d);continue}const p=e.states[h.resource_id]??null,u=O(h);l.push({...d,label:p!==null?`${u} · ${K({...h.entity??{domain:"",unit:null,device_class:null,attributes:{}},state:p})}`:u,state:p!==null?"historic":"unknown"})}return this.markersMemo={refs:a,key:n,value:l},l}scrubLanes(t,e){const s=this.layerStatus,a=JSON.stringify([t,e,s]),n=[this.range,this.switches,this.events];if(this.lanesMemo&&this.lanesMemo.key===a&&N(this.lanesMemo.refs,n))return this.lanesMemo.value;const o=["lights","openings","presence","alarm","elevators"].map(d=>He(this.range,d,t,e,this.switches,s)),l=s.events==="not_permitted";return o.push({id:"events",label:G.events,color:it.events,off:!this.switches.events||l,locked:l,spans:[],marks:l?[]:this.events.map(d=>Date.parse(d.occurred_at)).filter(d=>d>=t&&d<=e).sort((d,h)=>d-h)}),this.lanesMemo={key:a,refs:n,value:o},o}startPlay(){if(this.playing)return;this.mode="play";const t=this.winToMs;let e=this.instant.getTime();(e>=t-1e3||e<this.winFromMs)&&(e=this.winFromMs),t>e&&(this.playing=!0,this.playMs=e,this.stateMs=e,this.minute=this.minuteOfMs(e),this.lastFrame=performance.now(),this.lastStateTick=this.lastFrame,this.raf=requestAnimationFrame(this.tick))}stopPlay(t){this.raf&&cancelAnimationFrame(this.raf),this.raf=0,this.playing&&(this.playing=!1,this.stateMs=this.playMs,t&&this.scheduleFrame())}togglePlay(){this.playing?this.stopPlay(!0):this.startPlay()}setMode(t){t==="snapshot"&&this.stopPlay(!0),this.mode=t}onScrubKey(t,e){if(t.key===" "||t.code==="Space")return e instanceof HTMLElement&&(e.tagName==="BUTTON"||e.tagName==="A"||e.getAttribute("role")==="switch")?!1:(t.preventDefault(),t.repeat||this.togglePlay(),!0);if(t.key==="ArrowLeft"||t.key==="ArrowRight"){t.preventDefault();const s=t.shiftKey?10:this.winMinutes<=10?1/6:1;return this.setMinute(this.minute+(t.key==="ArrowRight"?s:-s)),!0}return!1}goTo(t){this.stopPlay(!1);const e=new Date(t),s=W(e,this.tz),a=s!==this.date;this.date=s,this.minute=Math.min(this.limitMinute,L(e,this.tz)),a&&this.loadDay(),this.fitWindow(!0),this.scheduleFrame()}fmtHm(t){return ct(new Date(t),{timeZone:this.tz})}renderLayers(t,e){const s=(this.bundle?.anchors??[]).filter(n=>n.resource_type==="camera").map(n=>n.resource_id),a=s.filter(n=>this.coverageAt(n).state==="historic").length;return c`<div class="lcard" data-history-layers>
      <div class="lhd"><h2>${i("שכבות")}</h2><span class="grow"></span>${this.range?.bucket_s?c`<span class="note">${i("דגימה כל {n} דק׳",{n:Math.max(1,Math.round(this.range.bucket_s/60))})}</span>`:v}</div>
      <div class="layers" role="group" aria-label=${i("שכבות")}>
        ${Y.map(n=>{const r=t[n],o=r==="not_permitted",l=!!this.switches[n]&&!o,d=Ae(r);let h=d.text;r?n==="elevators"&&r==="ok"?h=i("מצב בלבד"):n==="cameras"&&r==="ok"&&(h=i("{n} מ־{total}",{n:a,total:s.length})):h=this.snapLoading?"…":i("לא ידוע");const p=n==="cameras"?i("· לפי המקליט"):Ee(e[n]);return c`<div class="lyr" data-layer=${n} data-off=${l?"false":"true"} data-status=${r??""}>
            <sw-toggle .checked=${be(l)} label=${G[n]} labelHidden ?disabled=${o} @change=${Lt(l,()=>this.toggleLayer(n))}></sw-toggle>
            <span class="nm"><i style=${`background:${it[n]}`}></i>${G[n]}${p?c` <span class="cov">${p}</span>`:v}</span>
            <span class="st" data-look=${r?d.look:"unk"}>${o?c`<sw-icon name="lock" size=${13}></sw-icon>`:v}${h}</span>
          </div>`})}
      </div>
    </div>`}reasonText(t){switch(t){case"gap":return i("פער בהקלטה");case"forward_fill_exceeded":return i("אין שינוי מוקלט קרוב");case"before_history":return i("לפני תחילת ההיסטוריה");default:return t??""}}scrubPanelParts(t,e,s){const a=this.scrubDrawn,n=t.anchors.filter($=>$.resource_type==="ha_entity"),r=n.filter($=>a.states[$.resource_id]!==null&&a.states[$.resource_id]!==void 0),o=e?.coverage??this.snapshot?.coverage??null,l=n.length?c`${i("{n} מתוך {total} ידועות בזמן זה",{n:r.length,total:n.length})}${o?.from?c` <span class="note">${i("(היסטוריה מקומית מ־")}<span class="ltr">${this.fmtWhen(o.from)}</span>)</span>`:c` <span class="note">${i("(אין עדיין היסטוריה מקומית)")}</span>`}
        <div class="evl" style="margin-block-start:4px">${n.filter($=>this.scrubVisible($)).slice(0,8).map($=>{const k=this.layerOfAnchor($),Q=s[k]==="not_permitted",j=a.states[$.resource_id]??null,g=e?.entities[$.resource_id],X=O($);return c`<div data-history-entity data-known=${j!==null?"true":"false"} data-layer=${k}><span>${X}</span><span class="note">${Q?i("לא מורשה"):j!==null?c`${K({...$.entity??{domain:"",unit:null,device_class:null,attributes:{}},state:j})}${g?.changedAt?c` · ${i("מ־")}<span class="ltr">${this.fmt(g.changedAt)}</span>`:""}${g?.changedDuring?` · ${i("השתנה בתוך הדגימה")}`:""}`:c`${i("לא ידוע")}${g?.reason?` · ${this.reasonText(g.reason)}`:""}`}</span></div>`})}</div>`:c`${i("אין ישויות מוצבות בקומה")}`,d=Te(t.zones,n.map($=>({x:$.position.x,y:$.position.y,level_id:$.level_id??null,state:a.states[$.resource_id]??null})),$=>$??this.levelFallback),p=Object.entries(e?.entities??{}).filter(([,$])=>$.layer==="alarm").find(([,$])=>$.known&&$.state!==null),u=s.alarm==="not_permitted"?c`<sw-icon name="lock" size=${12}></sw-icon> ${i("לא מורשה")}`:this.switches.alarm?s.alarm==="empty"?i("אין לוח אזעקה בקומה"):p?c`${K({domain:"alarm_control_panel",unit:null,device_class:null,attributes:{},state:p[1].state})}${p[1].changedAt?c` · ${i("מ־")}<span class="ltr">${this.fmt(p[1].changedAt)}</span>`:""}`:i("לא ידוע"):i("השכבה כבויה"),b=Object.entries(e?.elevators??{}),f=s.elevators!==void 0&&s.elevators!=="empty",M=s.elevators==="not_permitted"?c`<sw-icon name="lock" size=${12}></sw-icon> ${i("לא מורשה")}`:this.switches.elevators?c`<div class="elev">${b.length?b.map(([$,k])=>c`<sw-chip data-elevator=${$}>${k.name} · ${k.known&&k.state?Be[k.state]??k.state:i("לא ידוע")}</sw-chip>`):c`<span>${i("לא ידוע")}</span>`}</div><div class="note">${i("מיקום התא לא מוקלט")}</div>`:i("השכבה כבויה"),D=c`
      <dt>${i("חדרים")}</dt><dd data-history-rooms>${d.total?i("{n} מתוך {total} ידועים",{n:d.known,total:d.total}):i("אין חדרים מסומנים בקומה")}</dd>
      <dt>${i("אזעקה")}</dt><dd data-history-alarm>${u}</dd>
      ${f?c`<dt>${i("מעליות")}</dt><dd data-history-elevators>${M}</dd>`:v}`,H=s.cameras==="not_permitted",q=this.snapshot?.layers.cameras?.camera_ids,A=H||!this.switches.cameras?[]:q&&q.length?q:t.anchors.filter($=>$.resource_type==="camera").map($=>$.resource_id),Z=S(this.instant),_=c`<sw-button size="sm" icon="camera" data-history-all-cameras ?disabled=${!A.length} title=${A.length>4?i("ארבע המצלמות הראשונות של הקומה"):i("כל מצלמות הקומה מהזמן שנבחר")}
      @click=${()=>{A.length&&F("/investigate/playback",{camera:A[0],t:Z,...A.length>1?{extra:A.slice(1,4).join(",")}:{}})}}>${i("כל מצלמות הקומה מכאן")}</sw-button>`,J=s.events==="not_permitted"?i("לא מורשה"):this.switches.events?null:i("השכבה כבויה");return{entities:l,rows:D,actions:_,eventsOff:J}}renderScrub(){const t=this.bundle;if(this.error&&!t)return c`<div class="head lead-head"><h1>${i("מפה היסטורית")}</h1></div><sw-state-panel state="error" hint=${this.error}></sw-state-panel>`;if(!t)return c`<div class="head lead-head"><h1>${i("מפה היסטורית")}</h1></div><sw-state-panel state="loading"></sw-state-panel>`;const e=this.selectedAnchor,s=this.replay,a=this.layerStatus,n=s?.retention??this.snapReplay?.retention??{},r=s?.coverage??this.snapshot?.coverage??this.range?.coverage??null,o=this.replayMs,l=r?St(r.gaps,o):null,d=this.switches.cameras&&a.cameras!=="not_permitted",h=this.switches.events&&a.events!=="not_permitted",p=e?.resource_type==="camera"?e.resource_id:null,u=this.timelineSegments(p,d),b=this.timelineEvents(p,h),f=`${this.date} ${P(this.minute)}`,M=this.winFromMs,D=this.msAt(this.winStart+this.winMinutes),H=this.msAt(this.limitMinute),q=this.playing?this.playMs:this.instant.getTime(),A=this.scrubLanes(M,D),Z=qe(this.range?.coverage?.gaps??r?.gaps,M,D),_=r?.from?Date.parse(r.from):null,J=!!r&&(_===null||o<_),$=this.scrubRoomLayer,k=this.scrubDrawn,Q=r?.from?W(new Date(r.from),this.tz):void 0,j=this.scrubPanelParts(t,s,a);return c`
      <div class="head lead-head">
        <div><h1>${i("המפה בזמן שנבחר")} · ${t.floorName}</h1><div class="sub">${t.buildingName} · <span class="ltr">${f}</span> · ${this.tz}</div></div>
        <span class="grow"></span>
        <div class="acts-h">
          ${this.floors.length>1?c`<sw-field><select aria-label=${i("קומה")} @change=${g=>F(`/investigate/floors/${g.target.value}`,{t:this.instant.toISOString()})}>${this.floors.map(g=>c`<option value=${g.id} ?selected=${g.id===this.floorId}>${et(g.name)}</option>`)}</select></sw-field>`:v}
          ${t.imageUrl?c`<sw-button icon="map" aria-pressed=${this.planImage} data-plan-background title=${this.planImage?i("הסתר את תמונת התוכנית"):i("הצג את תמונת התוכנית")} @click=${()=>this.setPlanImage(!this.planImage)}><span class="lbl">${i("תמונת התוכנית")}</span></sw-button>`:v}
          <sw-button icon="cube" aria-pressed=${this.view3d} data-view-3d ?disabled=${!this.view3d&&(!R()||!this.hasScene||this.threeState==="loading")}
            title=${R()?this.hasScene?i("מקש 3"):i("אין מבנה מפורסם בזמן הזה"):B} @click=${()=>this.toggle3d()}>${this.view3d?"2D":"3D"}</sw-button>
          ${R()?v:c`<span class="note" data-3d-unavailable>${B}</span>`}
          <sw-button icon="live" data-back-live title=${i("חזרה למצב חי")} @click=${()=>F(`/explore/floors/${t.floorId}`)}><span class="lbl">${i("חזרה למצב חי")}</span></sw-button>
          <sw-button class="details-btn" icon="inbox" data-history-details title=${i("פרטים")} aria-expanded=${this.detailsOpen?"true":"false"} @click=${()=>this.detailsOpen=!this.detailsOpen}>${i("פרטים")}</sw-button>
        </div>
      </div>
      <div class="bar">
        <sw-icon name="clock" size=${14}></sw-icon>
        <span>${i("מצב חקירה היסטורי — פעולות פיזיות אינן זמינות. מצב ללא היסטוריה מוצג כלא ידוע, לא כערך החי האחרון.")}</span>
        <span class="grow"></span>
        ${this.rangeNote?c`<span class="pill warn" data-history-range-note>${this.rangeNote}</span>`:v}
        ${this.mode==="play"?c`<span class="pill" data-history-mode="play">${i("ניגון")} · <span class="ltr">${this.fmtHm(M)}–${this.fmtHm(Math.min(D,H))}</span>${this.range?.bucket_s?` · ${i("דגימה כל {n} דק׳",{n:Math.max(1,Math.round(this.range.bucket_s/60))})}`:""}</span>`:c`<span class="pill" data-history-mode="snapshot">${i("רגע אחד")}</span>`}
      </div>
      <div class="layout ts">
        <div class="stage">
          <div class="chip"><sw-icon name="building" size=${14}></sw-icon>${t.floorName}</div>
          <div class="hist ${l?"gap":""}" data-history-tag>${i("מצב היסטורי")} · <span class="ltr">${P(this.minute)}</span></div>
          ${this.shows3d&&this.sceneDescription?c`<sw-plan-3d data-history-3d .description=${this.sceneDescription} .selectedId=${this.selectedId} .preset=${this.preset3d} .frameKey=${t.floorId} .labels=${this.sceneMemo?.labels??{}}
                .cameras=${this.camerasOf(t)} exportName=${`plan-3d-${t.floorName}-${this.date}`}
                .sunAt=${o} .walkable=${V.walkable} .stillsAvailable=${V.stillsAvailable}
                @realistic-change=${g=>{this.real3d!==g.detail.on&&(this.real3d=g.detail.on)}}
                @part-select=${g=>this.onPartSelect(g)}></sw-plan-3d>`:v}
          <sw-plan-canvas style=${this.shows3d?"display:none":""} alwaysLabel .planWidth=${t.width} .planHeight=${t.height} .plan=${t.planSvg} .imageUrl=${t.imageUrl} .hideImage=${!this.planImage} .markers=${this.scrubMarkers} .selectedId=${this.selectedId} .zones=${this.zonesOf(t)} .geometry=${this.geometry} .structureLevel=${this.level} .catalog=${this.catalogLookup} .anchorPositions=${this.anchorPositionsOf(t)} .entityStates=${k.states} .roomStates=${$} dimEntities
            @marker-select=${g=>{this.selectedId=g.detail.id,this.frameFailed=!1}}></sw-plan-canvas>
          ${this.threeState==="loading"?c`<div class="hist below" data-3d-loading>${i("טוען תלת-ממד…")}</div>`:v}
          ${this.threeState==="error"?c`<div class="hist below" data-3d-load-error>${i("תלת-ממד לא נטען: {error}",{error:this.threeError})}</div>`:v}
          ${this.shows3d?v:c`<div class="legend"><span>${i("כחול = יש הקלטה")}</span><span>${i("מקווקו = לא ידוע / לא מוקלט")}</span><span>${i("צהוב = מואר")}</span><span>${i("כחול בהיר = נוכחות")}</span></div>`}
          ${l?c`<div class="gapbar" data-history-gap role="status"><sw-icon name="warning" size=${14}></sw-icon><span>${i("פער בהקלטה")} <span class="ltr">${this.fmtHm(Date.parse(l.from))}–${this.fmtHm(Date.parse(l.to))}</span> — ${i("המערכת לא הייתה מחוברת. מצבי ההתקנים לא ידועים, המצלמות לפי המקליט.")}</span></div>`:v}
          ${this.snapLoading&&!s&&!this.snapError?c`<div class="cover" data-history-loading><sw-state-panel state="loading" heading=${i("טוען את מצב הקומה…")} hint=${i("היסטוריה מקומית, הקלטות ואירועים.")}></sw-state-panel></div>`:v}
          ${this.snapError&&!s?c`<div class="cover" data-history-error><sw-state-panel state="error" heading=${i("לא ניתן לטעון את המצב ההיסטורי")} hint=${i("המפה הנוכחית מוצגת ללא מצבים. נסו שוב.")} actionLabel=${i("ניסיון חוזר")} @action=${()=>{this.snapshot=null,this.fetchSnapshot()}}></sw-state-panel></div>`:v}
          ${J&&!this.snapLoading&&!this.playing?c`<div class="cover" data-history-none><sw-state-panel icon="history" state="empty" heading=${i("אין עדיין היסטוריה לקומה הזאת")} hint=${_!==null?i("ההיסטוריה המקומית מתחילה {time}. לפני כן מוצגת התוכנית בלבד, ההקלטות לפי המקליט.",{time:this.fmtWhen(r.from)}):i("לפני תחילת ההיסטוריה המקומית מוצגת התוכנית בלבד, ההקלטות לפי המקליט.")}
                actionLabel=${_!==null&&_>o?i("לרגע הראשון המוקלט"):""} @action=${()=>{_!==null&&this.goTo(_)}}></sw-state-panel></div>`:v}
        </div>
        <div class="panel">
          ${this.renderLayers(a,n)}
          <div class="details ${this.detailsOpen?"open":""}" data-history-details-sheet>
            <div class="sheet-hd"><span>${i("פרטים")}</span><span class="grow"></span><sw-button size="sm" @click=${()=>this.detailsOpen=!1}>${i("סגירה")}</sw-button></div>
            ${this.panelCards(t,j)}
          </div>
        </div>
      </div>
      <div class="tlx" data-history-timeline>
        <div class="tlrow">
          <sw-badge kind="historic"></sw-badge>
          <span class="time" data-history-time-bar>${f}</span>
          <sw-segmented label=${i("אופן")} value=${this.mode} @change=${g=>this.setMode(g.detail.value==="play"?"play":"snapshot")}
            .options=${[{value:"snapshot",label:i("רגע אחד"),attrs:{"data-mode":"snapshot"}},{value:"play",label:i("ניגון תקופה"),attrs:{"data-mode":"play"}}]}></sw-segmented>
          ${this.mode==="play"?c`<button type="button" class="play" data-play aria-label=${this.playing?i("השהיה"):i("ניגון")} aria-pressed=${this.playing?"true":"false"} @click=${()=>this.togglePlay()}><sw-icon name=${this.playing?"pause":"play"} size=${18}></sw-icon></button>
              <sw-segmented class="speed" label=${i("מהירות")} value=${String(this.speed)} @change=${g=>this.speed=yt.find(X=>String(X)===g.detail.value)??this.speed}
                .options=${yt.map(g=>({value:String(g),label:`×${g}`,attrs:{"data-speed":String(g)}}))}></sw-segmented>`:v}
          <sw-chip data-step="-60" @click=${()=>this.setMinute(this.minute-60)}>${i("-1 שעה")}</sw-chip><sw-chip data-step="-5" @click=${()=>this.setMinute(this.minute-5)}>${i("-5 דק׳")}</sw-chip><sw-chip data-step="5" @click=${()=>this.setMinute(this.minute+5)}>${i("+5 דק׳")}</sw-chip><sw-chip data-step="60" @click=${()=>this.setMinute(this.minute+60)}>${i("+1 שעה")}</sw-chip>
          <span class="grow"></span>
          <sw-segmented class="win" label=${i("חלון")} value=${String(this.winMinutes)} @change=${g=>this.setWindow(Number(g.detail.value))}
            .options=${Ve.map(g=>({value:String(g.minutes),label:g.label,attrs:{"data-window":String(g.minutes)}}))}></sw-segmented>
          <span class="dateq"><sw-field><input type="date" lang=${dt()} .value=${this.date} min=${Q??""} max=${W(new Date,this.tz)} data-ltr aria-label=${i("תאריך")} @change=${g=>this.setDate(g.target.value)} /></sw-field></span>
          ${this.mode==="play"?c`<span class="note keys"><span class="kbd">${i("רווח")}</span> ${i("ניגון")} · <span class="kbd">←</span><span class="kbd">→</span> ${i("צעד")}</span>`:v}
        </div>
        <div class="track">
          <sw-history-lanes .lanes=${A} .gaps=${Z} .from=${M} .to=${D} .cursor=${q} .limit=${H<D?H:null} @seek=${g=>this.setMinute(this.minuteOfMs(g.detail.ms))}></sw-history-lanes>
          <div class="tlwrap">
            <sw-timeline compact .segments=${u} .events=${b} .cursor=${this.minute} .limit=${this.limitMinute} .follow=${!1} .windowMinutes=${this.winMinutes} .viewStart=${this.winStart} precision="estimated"
              @seek=${g=>this.setMinute(g.detail.minute)} @scrub=${g=>this.setMinute(g.detail.minute)} @window-change=${g=>this.onTimelineWindow(g)}></sw-timeline>
          </div>
        </div>
      </div>
    `}get demoMarkers(){const t=a=>a==="cam-3"||this.minute>=190&&this.minute<=205?"unknown":"historic",e=Rt.filter(a=>a.floorId===this.floorId).map(a=>({id:a.id,kind:"camera",label:a.name,x:a.x,y:a.y,rotation:a.rotation,fov:a.fov,state:a.state==="forbidden"?"forbidden":t(a.id)})),s=Nt.filter(a=>a.floorId===this.floorId).map((a,n)=>({id:a.id,kind:a.domain,label:a.name,x:a.x,y:a.y,state:n%2?"unknown":"historic"}));return[...e,...s]}renderDemo(){const t=ht.find(e=>e.id===this.floorId)??ht[0];return c`
      <div class="head lead-head">
        <div><h1>${i("מפה היסטורית")} · ${et(t.name)}</h1><div class="sub">${i("מצב המפה בזמן נבחר · פעולות פיזיות כבויות בחקירה · נתוני הדגמה")}</div></div>
        <span class="grow"></span>
        <a href="#/explore/floors/${t.id}"><sw-button icon="live">${i("חזרה ל־Live")}</sw-button></a>
      </div>
      <div class="bar">
        <sw-badge kind="historic"></sw-badge>
        <span class="time">2026-09-14 ${st(this.minute)}</span>
        <input type="range" min="0" max="1439" .value=${String(this.minute)} @input=${e=>this.minute=Number(e.target.value)} aria-label=${i("זמן")} />
        <sw-chip @click=${()=>this.minute=Math.max(0,this.minute-60)}>${i("-1 שעה")}</sw-chip><sw-chip @click=${()=>this.minute=Math.min(1439,this.minute+60)}>${i("+1 שעה")}</sw-chip>
        <span class="grow"></span>
        <span style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">${i("גרסת מפה 3 (תקפה מ־01.09)")}</span>
      </div>
      <div class="stage alone">
        <sw-plan-canvas .planWidth=${t.planWidth} .planHeight=${t.planHeight} .plan=${Tt(t.id)} .markers=${this.demoMarkers}></sw-plan-canvas>
        <div class="legend"><span>${i("כחול = יש הקלטה בזמן זה")}</span><span>${i("מקווקו = לא ידוע / פער")}</span><span>${i("ישות: מצב ידוע אחרון")}</span></div>
      </div>
    `}render(){return U()?this.scrub?this.renderScrub():this.renderApi():this.renderDemo()}};m.styles=[Ft,bt`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 14px 24px 12px;
    }
    /* the header dropdown's lead reserve (styles/lead-reserve.ts) is ADDED to the row's own 24 px start padding, never in its place */
    .head.lead-head {
      padding-inline-start: calc(24px + var(--sw-lead-reserve, 0px));
    }
    h1 {
      margin: 0;
    }
    .sub {
      font-size: var(--sw-fs-sm);
      margin-block-start: 2px;
    }
    .grow {
      flex: 1;
    }
    /* R5 assembly (owner decision 2026-10-28, option a): the time bar is the MAPS look - these are the pre-R5 base rules, and the
       R5-MAPS-297 block further down turns them into the recorded-tone status field with the 26 px recorded-tone time */
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 24px 10px;
      background: var(--sw-recorded-soft);
      border: 1px solid color-mix(in srgb, var(--sw-recorded) 35%, transparent);
      font-size: var(--sw-fs-sm);
      flex-wrap: wrap;
    }
    .time {
      direction: ltr;
    }
    input[type='range'] {
      inline-size: 260px;
      direction: ltr;
      accent-color: var(--sw-accent);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 14px;
      margin: 0 24px 12px;
      align-items: start;
    }
    .stage {
      position: relative;
      block-size: 540px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .stage.alone {
      block-size: auto;
      min-block-size: 480px;
      flex: 1;
      margin: 0 24px 24px;
    }
    .stage sw-plan-canvas {
      block-size: 100%;
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      gap: 12px;
      /* the HUD panels over the plan are opaque (owner 2026-10-13, styles/menu-surface.ts): the legend was a white 92 % pill with the dark scheme's light ink on it */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      font-size: var(--sw-fs-xs);
    }
    .chip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      border-radius: var(--sw-r-md);
      padding: 5px 10px;
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .hist {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      /* the "historical state" tag: the opaque surface with a purple hairline and the body ink (purple text on a fixed lavender fill read at 2.4:1 in the dark scheme) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-purple);
      color: var(--sw-text);
      border-radius: var(--sw-r-md);
      padding: 3px 9px; /* 4 / 10 minus the hairline: the tag keeps its size */
      font-size: var(--sw-fs-xs);
    }
    .hist.below {
      inset-block-start: 44px;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
      align-items: center;
    }
    dt {
      font-size: var(--sw-fs-xs);
    }
    dd {
      margin: 0;
      font-size: var(--sw-fs-md);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .evl {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .evl a {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 8px;
      min-block-size: 42px;
      padding: 7px 12px;
      border-radius: var(--sw-r-sm);
      text-decoration: none;
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .evl .s {
      font-size: var(--sw-fs-xs);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-family: var(--sw-font-mono);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .frame {
      margin-block-start: 8px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      background: var(--sw-surface-3);
      aspect-ratio: 16 / 9;
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .frame img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .tl {
      margin: 0 24px 24px;
    }
    .tl sw-field {
      inline-size: 160px;
    }
    .tlbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): a 26/700 title; the time bar is the status field of the screen (the recorded
       tone with its own hairline from the token - the fixed #cddcff was a light line on the dark scheme) and the chosen time its display
       digit (20/700, tabular, interface face); the plan is the hero (shadow 2); the event rows are wells and the one at the chosen time a
       filled accent field; press feedback on the rows; hover only with a fine pointer. */
    h1 {
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.02em;
    }
    .sub {
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
    }
    .bar {
      padding: 12px 16px;
      border-color: var(--sw-recorded);
      box-shadow: var(--sw-shadow-2);
      font-weight: var(--sw-fw-medium);
      border-radius: var(--sw-r-lg);
    }
    .time {
      font-family: inherit;
      font-size: var(--sw-fs-3xl); /* loop 2: the chosen time is the display digit of this screen */
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      line-height: 1.1;
      color: var(--sw-recorded-text);
    }
    .stage {
      box-shadow: var(--sw-shadow-2);
      --sw-map-bg: var(--sw-surface-3); /* loop 2: the ground a tone step down, the plan floats */
      border-color: transparent;
    }
    .chip {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      background: var(--sw-menu-surface); /* a HUD panel keeps the opaque menu surface (unit-menu-lint): weight from the accent edge + ink */
      border: 2px solid var(--sw-accent);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-2);
    }
    .chip sw-icon {
      color: inherit;
    }
    .hist {
      background: color-mix(in srgb, var(--sw-purple) 14%, var(--sw-menu-surface));
      font-weight: var(--sw-fw-bold);
    }
    .legend {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
    dd {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    dt {
      color: var(--sw-text-2);
    }
    .evl a {
      background: var(--sw-surface-2);
      border-color: transparent;
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .evl a:active {
      transform: scale(var(--sw-press-scale));
    }
    .evl a.hit {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      font-weight: var(--sw-fw-semibold);
    }
    .evl .s {
      color: var(--sw-text-2);
    }
    .tlbar {
      font-weight: var(--sw-fw-medium);
    }
    @media (max-width: 767px) {
      .head,
      .bar,
      .tl {
        margin-inline: 12px;
        padding-inline: 12px;
      }
      .head,
      .head.lead-head {
        padding-inline: 0;
      }
      .layout {
        margin-inline: 0;
      }
      .stage {
        border-radius: 0;
      }
      .legend {
        display: none;
      }
    }

    /* ===== CR-TIMESCRUB101 (owner layout rule 2026-10-24): the screen is a fixed-height column and NEVER scrolls - compact
       head, one-line status bar, the plan + panel area takes all the height left (the plan fills it), the timeline bar is
       pinned to the bottom; only the side panel scrolls, inside itself ===== */
    :host([data-scrub]) {
      block-size: 100%;
      min-block-size: 0;
      overflow: hidden;
    }
    :host([data-scrub]) .head {
      flex: none;
      gap: 8px 10px;
      padding-block: 8px 6px;
    }
    :host([data-scrub]) h1 {
      font-size: var(--sw-fs-xl);
      line-height: 1.25;
    }
    :host([data-scrub]) .sub {
      font-size: var(--sw-fs-xs);
      margin-block-start: 0;
    }
    .acts-h {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .details-btn,
    .sheet-hd {
      display: none;
    }
    :host([data-scrub]) .bar {
      flex: none;
      flex-wrap: nowrap;
      padding-block: 5px;
      margin-block-end: 8px;
      min-block-size: 34px;
      box-sizing: border-box;
    }
    :host([data-scrub]) .bar > span:not(.pill) {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      flex: none;
      border-radius: var(--sw-r-pill);
      padding: 2px 9px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      white-space: nowrap;
      background: var(--sw-surface);
      color: var(--sw-recorded-text);
      border: 1px solid color-mix(in srgb, var(--sw-recorded) 35%, transparent);
    }
    .pill.warn {
      color: var(--sw-warning-text);
      background: var(--sw-warning-soft);
      border-color: color-mix(in srgb, var(--sw-warning) 45%, transparent);
    }
    .layout.ts {
      grid-template-rows: minmax(0, 1fr);
      gap: 12px;
      margin-block-end: 10px;
      align-items: stretch;
      flex: 1;
      min-block-size: 0;
      position: relative;
    }
    .layout.ts .stage {
      block-size: auto;
      min-block-size: 0;
    }
    .hist.gap {
      border-color: var(--sw-warning);
    }
    .layout.ts .panel {
      gap: 10px;
      min-block-size: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      padding-inline-end: 2px;
    }
    .details {
      display: contents;
    }
    .cover {
      position: absolute;
      inset: 0;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      /* no scrim: the plan stays readable around the (opaque) state panel */
    }
    .cover sw-state-panel {
      max-inline-size: 420px;
      background: var(--sw-surface-solid, var(--sw-surface));
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2);
    }
    .gapbar {
      position: absolute;
      inset-inline: 12px;
      inset-block-end: 48px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      /* a HUD panel over the plan: the opaque surface with the warning hairline (styles/menu-surface.ts) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-warning);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .lcard {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 12px 14px;
      box-shadow: var(--sw-shadow-1);
      min-inline-size: 0;
    }
    .lhd {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-block-end: 8px;
    }
    .lhd h2 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .lhd .grow {
      flex: 1;
    }
    .layers {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .lyr {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 5px 6px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
      min-block-size: 34px;
      box-sizing: border-box;
    }
    /* R5-INVESTIGATE-297 loop 2: hover only under a fine pointer */
    @media (hover: hover) and (pointer: fine) {
      .lyr:hover {
        background: var(--sw-hover-wash);
      }
    }
    .lyr .nm {
      display: flex;
      align-items: center;
      gap: 7px;
      min-inline-size: 0;
    }
    .lyr .nm i {
      inline-size: 9px;
      block-size: 9px;
      border-radius: 50%;
      background: var(--c, var(--sw-accent));
      flex: none;
    }
    .lyr .cov {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      white-space: nowrap;
    }
    .lyr[data-off='true'] .nm {
      color: var(--sw-text-3);
    }
    .lyr .st {
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .st[data-look='ok'] {
      color: var(--sw-success-text);
    }
    .st[data-look='unk'] {
      color: var(--sw-unknown-text);
    }
    .st[data-look='warn'] {
      color: var(--sw-warning-text);
    }
    .st[data-look='lock'] {
      color: var(--sw-forbidden-text);
    }
    .elev {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .acts {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    /* the timeline bar pinned to the bottom (never scrolled to; sticky is belt-and-braces) */
    .tlx {
      flex: none;
      position: sticky;
      inset-block-end: 0;
      z-index: var(--sw-z-map-ui);
      padding: 6px 24px 10px;
      background: var(--sw-bg);
      border-block-start: 1px solid var(--sw-border);
    }
    .tlrow {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      overflow: hidden;
      margin-block-end: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      min-block-size: 36px;
    }
    .tlrow > * {
      flex: none;
    }
    .tlrow .grow {
      flex: 1;
    }
    .tlrow .time {
      font-size: var(--sw-fs-md);
    }
    .tlrow sw-field {
      inline-size: 150px;
    }
    /* CR-CMP2-SEGMENTED-C-2450: the timeline row's compact keys (mode, speed, window) through the sw-segmented knobs - 24 px keys,
       the extra-small label, the neutral ink on the chosen key */
    .tlrow sw-segmented {
      --sw-seg-h: 24px;
      --sw-seg-key-pad: 10px;
      --sw-seg-fs: var(--sw-fs-xs);
      --sw-seg-fw: var(--sw-fw-regular);
      --sw-seg-on-fw: var(--sw-fw-semibold);
      --sw-seg-radius: var(--sw-r-sm);
      --sw-seg-btn-radius: calc(var(--sw-r-sm) - 2px);
      --sw-seg-on-bg: var(--sw-seg-key, var(--sw-surface-solid, var(--sw-surface)));
      --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-text));
      --sw-seg-wrap: nowrap;
    }
    .play {
      display: inline-grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      cursor: pointer;
      box-shadow: var(--sw-shadow-primary, none);
      font: inherit;
    }
    @media (hover: hover) and (pointer: fine) {
      .play:hover {
        background: var(--sw-accent-hover, var(--sw-accent));
      }
    }
    .play:active {
      transform: scale(var(--sw-press-scale));
    }
    .kbd {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-2xs);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-2xs, 4px);
      padding: 0 4px;
      color: var(--sw-text-3);
    }
    .track {
      position: relative;
      direction: ltr;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-1);
      padding: 6px 10px 2px;
      --sw-lanes-label-w: 92px;
    }
    .track .tlwrap {
      /* CR-FE-NITS-2442 (06:RTL-1): logical. .track is direction: ltr in every language (time runs left to right), so the start edge is the left one */
      margin-inline-start: calc(var(--sw-lanes-label-w) + 8px);
      margin-block-start: 4px;
    }
    .track .rangenote {
      direction: rtl;
      font-size: var(--sw-fs-xs);
      color: var(--sw-warning-text);
      padding-block-end: 2px;
    }
    /* tablet: the two columns stay (the panel narrows and scrolls) so nothing drops below the timeline; one control row
       stays one row - the hour steps, the date and the key hints leave it */
    @media (max-width: 1023px) {
      :host([data-scrub]) .head,
      :host([data-scrub]) .bar,
      .layout.ts {
        margin-inline: 16px;
      }
      :host([data-scrub]) .head,
      :host([data-scrub]) .head.lead-head {
        padding-inline: 0 0;
        padding-inline-start: var(--sw-lead-reserve, 0px);
      }
      .layout.ts {
        grid-template-columns: minmax(0, 1fr) 272px;
        gap: 10px;
      }
      .tlx {
        padding-inline: 16px;
      }
      .tlrow .keys,
      .tlrow .dateq,
      .tlrow [data-step='-60'],
      .tlrow [data-step='60'] {
        display: none;
      }
    }
    /* phone: the layer chips row above the plan, the plan fills the height between them and the pinned timeline, the
       detail cards open as a sheet over the plan ("פרטים") */
    @media (max-width: 767px) {
      :host([data-scrub]) .head,
      :host([data-scrub]) .head.lead-head {
        margin-inline: 0;
        padding: 6px 12px 4px;
        padding-inline-start: calc(12px + var(--sw-lead-reserve, 0px));
        flex-wrap: nowrap;
        gap: 8px;
      }
      :host([data-scrub]) h1 {
        font-size: var(--sw-fs-md);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      :host([data-scrub]) .head > div:first-child {
        min-inline-size: 0;
      }
      :host([data-scrub]) .sub {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .acts-h {
        flex: none;
        gap: 4px;
      }
      .acts-h sw-field,
      .acts-h .note,
      .acts-h .lbl {
        display: none;
      }
      .details-btn {
        display: inline-flex;
      }
      :host([data-scrub]) .bar {
        display: none;
      }
      .layout.ts {
        margin: 0;
        gap: 0;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto minmax(0, 1fr);
      }
      .layout.ts .stage {
        order: 2;
        border-radius: 0;
        border-inline: 0;
      }
      .layout.ts .panel {
        order: 1;
        overflow: visible;
        padding: 0 12px 6px;
        gap: 0;
      }
      .layers {
        flex-direction: row;
        overflow-x: auto;
        scrollbar-width: none;
        gap: 6px;
        padding-block-end: 2px;
      }
      .lcard {
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
      }
      .lcard .lhd {
        display: none;
      }
      .lyr {
        grid-template-columns: auto auto;
        flex: none;
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-pill);
        padding: 3px 10px 3px 6px;
        background: var(--sw-surface);
      }
      .lyr .cov,
      .lyr .st {
        display: none;
      }
      .details {
        display: none;
        position: absolute;
        inset: 0;
        z-index: 8;
        background: var(--sw-bg);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 10px 12px 12px;
        flex-direction: column;
        gap: 10px;
      }
      .details.open {
        display: flex;
      }
      .sheet-hd {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
      }
      .sheet-hd .grow {
        flex: 1;
      }
      .gapbar {
        inset-block-end: 10px;
      }
      .tlx {
        padding: 6px 12px 8px;
      }
      .tlrow {
        gap: 6px;
        min-block-size: 40px;
        margin-block-end: 4px;
      }
      .tlrow .win,
      .tlrow .speed {
        display: none;
      }
      .tlrow .time {
        font-size: var(--sw-fs-sm);
      }
      .track {
        --sw-lanes-label-w: 58px;
        --sw-lane-h: 8px;
        --sw-tl-h: 44px;
        padding: 4px 8px 0;
      }
    }
  `,fe,ge];w([I()],m.prototype,"floorId",2);w([I()],m.prototype,"at",2);w([I()],m.prototype,"camera",2);w([y()],m.prototype,"minute",2);w([y()],m.prototype,"tz",2);w([y()],m.prototype,"date",2);w([y()],m.prototype,"tree",2);w([y()],m.prototype,"bundle",2);w([y()],m.prototype,"events",2);w([y()],m.prototype,"recordings",2);w([y()],m.prototype,"selectedId",2);w([y()],m.prototype,"loading",2);w([y()],m.prototype,"error",2);w([y()],m.prototype,"frameAt",2);w([y()],m.prototype,"frameFailed",2);w([y()],m.prototype,"casePick",2);w([y()],m.prototype,"geometry",2);w([y()],m.prototype,"level",2);w([y()],m.prototype,"catalogLookup",2);w([y()],m.prototype,"planImage",2);w([y()],m.prototype,"view3d",2);w([y()],m.prototype,"threeState",2);w([y()],m.prototype,"threeError",2);w([y()],m.prototype,"preset3d",2);w([y()],m.prototype,"catalog3d",2);w([y()],m.prototype,"real3d",2);w([y()],m.prototype,"scrub",2);w([y()],m.prototype,"switches",2);w([y()],m.prototype,"snapshot",2);w([y()],m.prototype,"snapLoading",2);w([y()],m.prototype,"snapError",2);w([y()],m.prototype,"range",2);w([y()],m.prototype,"rangeNote",2);w([y()],m.prototype,"mode",2);w([y()],m.prototype,"playing",2);w([y()],m.prototype,"speed",2);w([y()],m.prototype,"winMinutes",2);w([y()],m.prototype,"winStart",2);w([y()],m.prototype,"detailsOpen",2);w([y()],m.prototype,"playMs",2);w([y()],m.prototype,"stateMs",2);m=w([xt("investigate-history-map")],m);export{m as InvestigateHistoryMap};
