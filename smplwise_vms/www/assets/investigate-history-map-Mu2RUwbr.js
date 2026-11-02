const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{E as gt,F as M,a as vt,A as v,e as o,w as D,H as bt,g as yt,j as xt,S as St,i as H,J as zt,ae as It,at as nt,R as q,pz as At,dP as z,bn as C,bf as Dt,b4 as Et,n as ot,_ as Ot,aj as L,pB as X,q as Q,bU as lt,dN as Pt,dO as Lt,dM as ct,rR as Nt,C as Rt,G as b}from"./index-Iu0qJdv4.js";import{l as Tt}from"./lead-reserve-CGZMw7Rv.js";import"./sw-chip-Dwamtm8T.js";import{s as E,m as tt}from"./sw-timeline-C2qTinVo.js";import"./sw-case-picker-DDiFvwae.js";import{c as Ft}from"./cases-C1oLZrxn.js";import"./sw-plan-canvas-QRcwE5Hb.js";import{b0 as Wt,b1 as Ct,a$ as Ht,c2 as qt,k as jt,aZ as Kt,b3 as dt,aX as Ut,d as Vt}from"./shared-space-BG48X26v.js";import{d as N,m as I,r as Zt,i as ht,f as Bt}from"./recordings-0QNGlaME.js";import{x as Gt,w as Yt}from"./geometry-itycmDQr.js";import{l as Jt,a as Xt,f as Qt,d as te}from"./plan-catalog-9KXxt7XJ.js";import{b as ee}from"./scene-builder-CIZLgGcq.js";import{s as O,r as pt,R as j}from"./memo-ByNsa-at.js";import{b as se}from"./part-select-CylWA6VC.js";import{w as A,W as K}from"./webgl-U1M5Oj-F.js";import{I as ae}from"./investigate-r5-css-C46ybBVK.js";import{p as ie}from"./zones-w5IsCSq4.js";import{s as re,a as ne}from"./state-facts-3gITAUBU.js";import"./sw-logo-art-Va6y_cIM.js";import"./candidates-CS7-ly_Q.js";import"./material-resolve-BL0CnPSx.js";var oe=Object.defineProperty,le=Object.getOwnPropertyDescriptor,P=(t,e,a,i)=>{for(var s=i>1?void 0:i?le(e,a):e,r=t.length-1,n;r>=0;r--)(n=t[r])&&(s=(i?n(e,a,s):n(s))||s);return i&&s&&oe(e,a,s),s};let _=class extends vt{constructor(){super(...arguments),this.lanes=[],this.gaps=[],this.from=0,this.to=1,this.cursor=0,this.limit=null}x(t,e){const a=Math.max(1,this.to-this.from);return(t-this.from)/a*e}onClick(t){const e=t.currentTarget.getBoundingClientRect();if(!e.width)return;let a=this.from+(t.clientX-e.left)/e.width*(this.to-this.from);this.limit!==null&&(a=Math.min(a,this.limit)),this.dispatchEvent(new CustomEvent("seek",{detail:{ms:Math.round(a)},bubbles:!0,composed:!0}))}render(){const i=Math.max(1,this.lanes.length*14-2),s=this.x(this.cursor,1e3),r=this.limit!==null&&this.limit<this.to?Math.max(0,this.x(this.limit,1e3)):null;return o`
      <div class="labels">
        ${this.lanes.map(n=>o`<div class="ln ${n.off?"off":""}" style=${`--c:${n.color}`} data-lane=${n.id} data-off=${n.off?"true":"false"} data-locked=${n.locked?"true":"false"}><i></i>${n.label}</div>`)}
      </div>
      <div class="trk"><svg viewBox="0 0 ${1e3} ${i}" preserveAspectRatio="none" role="img" aria-label="שינויים לפי שכבה" @click=${this.onClick}>
        <defs>
          <pattern id="gap" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--sw-warning)" stroke-width="2.5" opacity="0.6" /></pattern>
          <pattern id="chg" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--sw-text-3)" stroke-width="1.5" opacity="0.55" /></pattern>
        </defs>
        ${this.lanes.map((n,l)=>{const c=l*14,u=n.off?.35:1,m=new Set;for(const h of n.marks)m.add(Math.round(this.x(h,1e3)/2)*2);return D`<g data-lane-track=${n.id} opacity=${u}>
            <rect x="0" y=${c+12/2-1} width=${1e3} height="2" rx="1" fill="var(--sw-surface-3)" />
            ${n.locked?v:n.spans.map(h=>{const g=Math.max(0,this.x(h.from,1e3)),d=Math.min(1e3,this.x(h.to,1e3));return d<=g?v:h.kind==="on"?D`<rect x=${g} y=${c+2} width=${Math.max(1.5,d-g)} height=${8} rx="2" fill=${n.color} opacity="0.85" />`:D`<rect x=${g} y=${c+1} width=${Math.max(1.5,d-g)} height=${10} fill="url(#chg)" />`})}
            ${n.locked?v:[...m].filter(h=>h>=0&&h<=1e3).map(h=>D`<rect x=${h-.6} y=${c} width="1.2" height=${12} fill=${n.color} opacity="0.9" />`)}
          </g>`})}
        ${this.gaps.map(n=>{const l=Math.max(0,this.x(n.from,1e3)),c=Math.min(1e3,this.x(n.to,1e3));return c>l?D`<rect data-gap x=${l} y="0" width=${c-l} height=${i} fill="url(#gap)" stroke="var(--sw-warning)" stroke-width="0.5" />`:v})}
        ${r!==null?D`<rect x=${r} y="0" width=${Math.max(0,1e3-r)} height=${i} fill="var(--sw-surface-3)" opacity="0.7" />`:v}
        ${s>=0&&s<=1e3?D`<line x1=${s} x2=${s} y1="0" y2=${i} stroke="var(--sw-accent)" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none" />`:v}
      </svg></div>
    `}};_.styles=gt`
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
  `;P([M({attribute:!1})],_.prototype,"lanes",2);P([M({attribute:!1})],_.prototype,"gaps",2);P([M({type:Number})],_.prototype,"from",2);P([M({type:Number})],_.prototype,"to",2);P([M({type:Number})],_.prototype,"cursor",2);P([M({type:Number})],_.prototype,"limit",2);_=P([bt("sw-history-lanes")],_);function U(t){return new Date(t).toISOString().replace(/\.\d{3}Z$/,"Z")}function ce(t){if(!(t instanceof xt))return null;const e=t.body;return e&&typeof e.code=="string"?e.code:e&&e.error&&typeof e.error.code=="string"?e.error.code:null}function ut(t){return t instanceof xt&&t.status===404}function de(t,e){return yt(`floors/${encodeURIComponent(t)}/history/snapshot?at=${encodeURIComponent(e)}`)}function he(t,e,a,i){const s=new URLSearchParams({from:e,to:a});return i&&i.length&&s.set("layers",i.join(",")),yt(`floors/${encodeURIComponent(t)}/history/range?${s.toString()}`)}const $t=["lights","presence","openings","temperature","devices","alarm"],Z=["lights","presence","openings","temperature","devices","alarm","elevators","cameras","events"],pe=["lights","presence","openings","temperature","devices","alarm","elevators"],V={lights:"תאורה",presence:"נוכחות",openings:"דלתות וחלונות",temperature:"טמפרטורה",devices:"התקנים",alarm:"אזעקה",elevators:"מעליות",cameras:"מצלמות",events:"אירועים"},st={lights:"var(--sw-map-lit)",presence:"var(--sw-map-presence)",openings:"var(--sw-tl-door)",temperature:"var(--sw-map-temp)",devices:"var(--sw-obj-electrical)",alarm:"var(--sw-obj-safety)",elevators:"var(--sw-obj-security)",cameras:"var(--sw-recorded)",events:"var(--sw-tl-motion)"},mt="sw.history.layers";function at(){const t={};for(const e of Z)t[e]=e!=="presence";return t}function ue(t){const e=at();if(!t)return e;try{const a=JSON.parse(t);if(!a||typeof a!="object"||Array.isArray(a))return e;for(const i of Z){const s=a[i];typeof s=="boolean"&&(e[i]=s)}}catch{}return e}function me(t){const e={};for(const a of Z)e[a]=!!t[a];return JSON.stringify(e)}function fe(t){switch(t){case"ok":return{text:"ידוע",look:"ok"};case"empty":return{text:"אין בקומה",look:"unk"};case"not_recorded":return{text:"לא מוקלט",look:"unk"};case"gap":return{text:"פער בהקלטה",look:"warn"};case"not_permitted":return{text:"לא מורשה",look:"lock"};default:return{text:"לא ידוע",look:"unk"}}}function we(t){return t===1?"יום אחד":t===2?"יומיים":t>=3&&t<=10?`${t} ימים`:`${t} יום`}function ge(t){return typeof t=="number"&&t>0?`· ${we(t)}`:""}function rt(t){return(t??[]).map(e=>({from:Date.parse(e.from),to:Date.parse(e.to)})).filter(e=>Number.isFinite(e.from)&&Number.isFinite(e.to)&&e.to>e.from).sort((e,a)=>e.from-a.from)}function kt(t,e){for(const a of t??[]){const i=Date.parse(a.from),s=Date.parse(a.to);if(e>=i&&e<s)return a}return null}const ft=(t,e,a)=>t.some(i=>i.to>e&&i.from<=a),R=t=>({state:null,known:!1,changedAt:null,changedDuring:!1,reason:t});function ve(t,e){let a=0,i=t.length-1,s=-1;for(;a<=i;){const r=a+i>>1;Date.parse(t[r][0])<=e?(s=r,a=r+1):i=r-1}return s}function it(t,e,a){if(a.gaps.some(h=>e>=h.from&&e<h.to))return R("gap");const i=ve(t.points,e),s=i+1<t.points.length||t.bounded_after,r=Math.max(0,a.forwardFillMaxS)*1e3;if(i<0)return t.initial.known?ft(a.gaps,a.from,e)?R("gap"):!s&&e-a.from>r?R("forward_fill_exceeded"):{state:t.initial.state,known:!0,changedAt:null,changedDuring:!1,reason:null}:R("before_history");const[n,l,c]=t.points[i],u=Date.parse(n);if(ft(a.gaps,u,e))return R("gap");if(!s&&e-u>r)return R("forward_fill_exceeded");const m=a.bucketS!==null&&c>1&&e<u+a.bucketS*1e3;return{state:l,known:!0,changedAt:n,changedDuring:m,reason:null}}function be(t){const e={},a={},i={};for(const n of $t){const l=t.layers[n];if(l&&(a[n]=l.status,i[n]=l.retention_days,l.status!=="not_permitted"))for(const[c,u]of Object.entries(l.entities??{}))e[c]={state:u.known?u.state:null,known:!!u.known&&u.state!==null,changedAt:u.changed_at,changedDuring:!1,reason:u.known?null:u.reason,layer:n}}const s={},r=t.layers.elevators;if(r&&(a.elevators=r.status,i.elevators=r.retention_days,r.status!=="not_permitted"))for(const[n,l]of Object.entries(r.items??{}))s[n]={name:l.name,state:l.known?l.state:null,known:!!l.known&&l.state!==null};return t.layers.cameras&&(a.cameras=t.layers.cameras.status),t.layers.events&&(a.events=t.layers.events.status,i.events=t.layers.events.retention_days),{entities:e,elevators:s,status:a,retention:i,coverage:t.coverage??null,source:"snapshot"}}function ye(t,e,a){const i={from:Date.parse(t.from),to:Date.parse(t.to),gaps:rt(t.coverage?.gaps),forwardFillMaxS:t.coverage?.forward_fill_max_s??86400,bucketS:t.bucket_s},s=!!kt(t.coverage?.gaps,e),r={},n={...a?.status??{}},l={...a?.retention??{}};for(const m of $t){const h=t.layers[m];if(h&&(n[m]=h.status==="ok"&&s?"gap":h.status,l[m]=h.retention_days,h.status!=="not_permitted"))for(const[g,d]of Object.entries(h.entities??{}))r[g]={...it(d,e,i),layer:m}}const c={},u=t.layers.elevators;if(u&&(n.elevators=u.status==="ok"&&s?"gap":u.status,l.elevators=u.retention_days,u.status!=="not_permitted"))for(const[m,h]of Object.entries(u.items??{})){const g=it(h,e,i);c[m]={name:h.name,state:g.known?g.state:null,known:g.known}}return{entities:r,elevators:c,status:n,retention:l,coverage:t.coverage??null,source:"range"}}function xe(t){return Wt(t)?"presence":Ct(t)?"openings":Ht(t)?"lights":t.domain==="sensor"&&t.device_class==="temperature"?"temperature":t.domain==="alarm_control_panel"?"alarm":"devices"}function _t(t,e,a){return!!e[t]&&a[t]!=="not_permitted"}function $e(t,e,a){const i={},s={};for(const r of[...a].sort()){const n=t?.entities[r],l=!!n&&n.known&&_t(n.layer,e,t?.status??{});i[r]=l?n.state:null,s[r]=l?n.changedAt:null}return{states:i,lastChanged:s}}function ke(t,e,a=i=>i??""){const i=t.filter(r=>r.polygon.length>=3);let s=0;for(const r of i){const n=a(r.level_id??null);e.some(l=>l.state!==null&&a(l.level_id??null)===n&&ie({x:l.x,y:l.y},r.polygon))&&s++}return{known:s,total:i.length}}function _e(t,e){if(e===null)return!1;switch(t){case"lights":case"presence":return e==="on";case"openings":return qt(e)||e==="unlocked";case"alarm":return e.startsWith("armed")||e==="triggered"||e==="pending"||e==="arming";case"elevators":return e!=="ok";default:return!1}}function Me(t){const e=[];for(const a of["on","changed"]){const i=t.filter(s=>s.kind===a).sort((s,r)=>s.from-r.from);for(const s of i){const r=e.length&&e[e.length-1].kind===a?e[e.length-1]:null;r&&s.from<=r.to?r.to=Math.max(r.to,s.to):e.push({...s})}}return e}function Se(t,e,a,i,s){const r=[],n=[],l=new Set([a,i]),c=Math.max(0,s.forwardFillMaxS)*1e3;for(const[m,,h]of e.points){const g=Date.parse(m);if(g>=a&&g<=i&&(l.add(g),h>0&&n.push(g)),g+c>a&&g+c<i&&l.add(g+c),s.bucketS!==null&&h>1){const d=Math.max(a,g),x=Math.min(i,g+s.bucketS*1e3);x>d&&r.push({from:d,to:x,kind:"changed"})}}s.from+c>a&&s.from+c<i&&l.add(s.from+c);for(const m of s.gaps)m.from>a&&m.from<i&&l.add(m.from),m.to>a&&m.to<i&&l.add(m.to);const u=[...l].sort((m,h)=>m-h);for(let m=0;m+1<u.length;m++){const h=u[m],g=u[m+1];if(g<=h)continue;const d=it(e,h,s);d.known&&_e(t,d.state)&&r.push({from:h,to:g,kind:"on"})}return{spans:r,marks:n}}function ze(t,e,a,i,s,r){const n=r[e]==="not_permitted"||!!t&&(e==="elevators"?t.layers.elevators:t.layers[e])?.status==="not_permitted",l={id:e,label:V[e],color:st[e],off:!s[e]||n,locked:n,spans:[],marks:[]};if(!t||n)return l;const c={from:Date.parse(t.from),to:Date.parse(t.to),gaps:rt(t.coverage?.gaps),forwardFillMaxS:t.coverage?.forward_fill_max_s??86400,bucketS:t.bucket_s},u=Object.values(e==="elevators"?t.layers.elevators?.items??{}:t.layers[e]?.entities??{}),m=[],h=[];for(const g of u){const d=Se(e,g,a,i,c);m.push(...d.spans),h.push(...d.marks)}return l.spans=Me(m),l.marks=[...new Set(h)].sort((g,d)=>g-d),l}function Ie(t,e,a){return rt(t).filter(i=>i.to>e&&i.from<a).map(i=>({from:Math.max(e,i.from),to:Math.min(a,i.to)}))}const Ae=[1,10,60,600];function De(t,e,a,i){const s=t+Math.max(0,e)*a;return s>=i?{t:i,ended:!0}:{t:s,ended:!1}}var Ee=Object.defineProperty,Oe=Object.getOwnPropertyDescriptor,w=(t,e,a,i)=>{for(var s=i>1?void 0:i?Oe(e,a):e,r=t.length-1,n;r>=0;r--)(n=t[r])&&(s=(i?n(e,a,s):n(s))||s);return i&&s&&Ee(e,a,s),s};const et=10,Pe=[{label:"יום",minutes:1440},{label:"6 שע׳",minutes:360},{label:"שעה",minutes:60},{label:"10 דק׳",minutes:10}],Le={ok:"תקין",fault:"תקלה",fire_service:"שירות כבאים",out_of_service:"מושבת",unknown:"לא ידוע"},Ne=150;function wt(t){return t==="person"||t==="vehicle"||t==="motion"||t==="line"||t==="offline"||t==="door"?t:"motion"}let f=class extends vt{constructor(){super(...arguments),this.bubbleSkin=new St(this),this.floorId="f0",this.at="",this.camera="",this.minute=615,this.tz="Asia/Jerusalem",this.date="",this.tree=null,this.bundle=null,this.events=[],this.recordings=new Map,this.selectedId=null,this.loading=!1,this.error="",this.frameAt="",this.frameFailed=!1,this.casePick=null,this.geometry=null,this.level=null,this.catalogLookup=null,this.planImage=!0,this.geomSeq=0,this.frameTimer=0,this.view3d=!1,this.default3d=!1,this.threeState="idle",this.threeError="",this.preset3d="iso",this.catalog3d=null,this.real3d=!1,this.materials3d=null,this.bundleSeq=0,this.itemNames=new Map,this.sceneMemo=null,this.scrub=!1,this.switches=at(),this.snapshot=null,this.snapLoading=!1,this.snapError="",this.range=null,this.rangeNote="",this.mode="snapshot",this.playing=!1,this.speed=1,this.winMinutes=1440,this.winStart=0,this.detailsOpen=!1,this.playMs=0,this.stateMs=0,this.rangeMaxDays=7,this.snapSeq=0,this.rangeSeq=0,this.rangeKey="",this.rangeTimer=0,this.raf=0,this.lastFrame=0,this.lastStateTick=0,this.factsMemo=null,this.replayMemo=null,this.drawnMemo=null,this.roomMemo=null,this.snapReplayMemo=null,this.onKey=t=>{const e=t.composedPath()[0],a=e instanceof HTMLElement&&(e.tagName==="INPUT"||e.tagName==="TEXTAREA"||e.tagName==="SELECT"||e.isContentEditable);if(!(this.scrub&&!a&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&this.onScrubKey(t,e))&&t.key==="3"&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&!a){if(t.preventDefault(),t.repeat)return;this.toggle3d()}},this.markersMemo=null,this.lanesMemo=null,this.tick=t=>{if(!this.playing)return;const e=Math.min(250,Math.max(0,t-this.lastFrame));this.lastFrame=t;const a=De(this.playMs,e,this.speed,this.winToMs);if(this.playMs=a.t,this.minute=this.minuteOfMs(a.t),(a.ended||t-this.lastStateTick>=Ne)&&(this.stateMs=a.t,this.lastStateTick=t),a.ended){this.stopPlay(!0);return}this.raf=requestAnimationFrame(this.tick)}}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onKey),H()&&this.init()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),this.stopPlay(!1),window.clearTimeout(this.rangeTimer),window.clearTimeout(this.frameTimer)}willUpdate(t){t.has("scrub")&&this.toggleAttribute("data-scrub",this.scrub)}updated(t){H()&&(this.default3d&&!this.view3d&&this.hasScene&&A()&&(this.default3d=!1,this.toggle3d()),(t.has("floorId")&&t.get("floorId")!==void 0||t.has("at")&&t.get("at")!==void 0)&&this.init())}async init(){this.loading=!0,this.error="";try{const[t,e]=await Promise.all([zt(),this.tree?Promise.resolve(this.tree):It()]);this.tz=t["time.zone"]??this.tz,this.tree=e,this.scrub=String(t["history.timescrub"]??"false")==="true";const a=Number(t["history.range_max_days"]??7);if(this.rangeMaxDays=Number.isFinite(a)?Math.max(1,Math.min(30,a)):7,this.scrub&&this.restoreSwitches(),this.stopPlay(!1),this.snapshot=null,this.snapError="",this.range=null,this.rangeKey="",this.rangeNote="",H()&&this.floors.length&&!this.floors.some(s=>s.id===this.floorId)){const s=new URLSearchParams(window.location.hash.split("?")[1]??"").toString();window.location.replace(`#/investigate/floors/${this.floors[0].id}/history${s?`?${s}`:""}`);return}const i=this.at?new Date(this.at):new Date;if(this.date=N(i,this.tz),this.minute=I(i,this.tz),this.bundle=await nt(this.floorId,!1,this.instant.toISOString().replace(/\.\d{3}Z$/,"Z")),this.restorePlanImage(),this.level=jt(t["plan.levels"],this.bundle),this.default3d=t["map.default_view"]==="3d"&&!this.view3d,this.geometry=null,this.bundle.source==="api"&&Jt(this.bundle.catalogRevision).then(s=>{this.catalogLookup=Xt(s),this.catalog3d=Qt(s),this.materials3d=te(s),this.itemNames=new Map(s.items.map(r=>[r.id,r.names.he]))}).catch(()=>{}),this.updateGeometry(),this.scheduleFrame(),this.scrub&&(this.fitWindow(!0),this.fetchSnapshot(),this.scheduleRange(0)),this.camera){const s=this.bundle.anchors.find(r=>r.resource_type==="camera"&&r.resource_id===this.camera);this.selectedId=s?.id??null,s&&(this.preset3d={camera:`cam:${s.id}`})}await this.loadDay()}catch(t){this.error=q(t)}finally{this.loading=!1}}setPlanImage(t){this.planImage=t;try{localStorage.setItem(`sw.history.background.${this.floorId}`,t?"1":"0")}catch{}}restorePlanImage(){try{this.planImage=localStorage.getItem(`sw.history.background.${this.floorId}`)!=="0"}catch{this.planImage=!0}}async loadDay(){const t=this.bundle;if(!t)return;const e=t.anchors.filter(r=>r.resource_type==="camera").map(r=>r.resource_id),[a,i]=await Promise.all([At({date:this.date,limit:1e3}).then(r=>r.events.filter(n=>n.camera_id&&e.includes(n.camera_id))).catch(()=>[]),Promise.allSettled(e.map(r=>Zt(r,this.date)))]);this.events=a;const s=new Map;e.forEach((r,n)=>{const l=i[n];s.set(r,l.status==="fulfilled"?l.value:null)}),this.recordings=s}get instant(){return ht(this.date,this.minute,this.tz)}segmentsFor(t){const e=this.recordings.get(t);return e?e.segments.map(a=>{const i=I(new Date(a.start_at),this.tz);let s=I(new Date(a.end_at),this.tz);return s<i&&(s=1440),{startMin:i,endMin:s,kind:a.kind==="continuous"?"continuous":"motion"}}):null}coverageAt(t){const e=this.segmentsFor(t);if(!e)return{state:"unknown"};const a=e.find(i=>this.minute>=i.startMin&&this.minute<=i.endMin);return a?{state:"historic",segment:a}:{state:"unknown"}}eventsNear(t,e=et){const a=this.instant.getTime();return this.events.filter(i=>(!t||i.camera_id===t)&&Math.abs(new Date(i.occurred_at).getTime()-a)<=e*60*1e3).sort((i,s)=>Math.abs(new Date(i.occurred_at).getTime()-a)-Math.abs(new Date(s.occurred_at).getTime()-a))}get apiMarkers(){const t=this.bundle;return t?t.anchors.map(e=>{if(e.resource_type==="camera"){const s=this.coverageAt(e.resource_id),r=this.eventsNear(e.resource_id,5).length,n=e.camera?.name??e.label??e.resource_id;return{id:e.id,kind:"camera",label:r?`${n} · ${r} אירועים`:n,x:e.position.x,y:e.position.y,rotation:e.rotation_degrees,fov:e.field_of_view_degrees??void 0,radius:e.coverage_radius??void 0,polygon:e.coverage_polygon?e.coverage_polygon.map(([l,c])=>({x:l,y:c})):void 0,labelPos:e.label_pos??void 0,level:e.level_id??null,state:s.state}}const a=e.entity?.state_at,i=z(e);return{id:e.id,kind:Dt(e.layer_id,e.entity?.domain),label:a?.known&&a.state?`${i} · ${C({...e.entity??{domain:"",unit:null,device_class:null,attributes:{}},state:a.state})}`:i,x:e.position.x,y:e.position.y,state:a?.known?"historic":"unknown"}}):[]}get selectedAnchor(){return this.bundle?.anchors.find(t=>t.id===this.selectedId)??null}get limitMinute(){return this.date===N(new Date,this.tz)?I(new Date,this.tz):1440}setMinute(t){this.minute=Math.max(0,Math.min(this.limitMinute,t)),this.scrub&&(this.playing&&(this.playMs=this.instant.getTime(),this.stateMs=this.playMs),this.fitWindow(!1)),this.scheduleFrame()}scheduleFrame(){window.clearTimeout(this.frameTimer),this.frameTimer=window.setTimeout(()=>{this.frameAt=this.instant.toISOString().replace(/\.\d{3}Z$/,"Z"),this.frameFailed=!1,this.ensureVersion(),this.scrub&&!this.playing&&this.fetchSnapshot()},600)}async updateGeometry(){const t=this.bundle,e=++this.geomSeq;if(!t||t.source!=="api"||!t.planVersionId){this.geometry=null;return}const a=this.instant.toISOString().replace(/\.\d{3}Z$/,"Z"),i=t.history==="exact"?await Gt(t.planVersionId,a):await Yt(t);e===this.geomSeq&&(this.geometry=i)}async ensureVersion(){const t=this.bundle;if(!t||t.source!=="api"||!t.at)return;const e=this.instant.toISOString().replace(/\.\d{3}Z$/,"Z");if(e===t.at){this.updateGeometry();return}const a=++this.bundleSeq;try{const i=await nt(this.floorId,!1,e);if(a!==this.bundleSeq||this.bundle!==t)return;const s=t.anchors.map(r=>r.resource_id).sort().join(",");this.bundle=i,i.planVersionId!==t.planVersionId&&(this.geometry=null),this.updateGeometry(),this.selectedId&&!i.anchors.some(r=>r.id===this.selectedId)&&(this.selectedId=null),i.anchors.map(r=>r.resource_id).sort().join(",")!==s&&await this.loadDay()}catch{}}renderEntityStates(t){const e=t.anchors.filter(s=>s.resource_type==="ha_entity");if(!e.length)return o`אין ישויות מוצבות בקומה`;const a=e.filter(s=>s.entity?.state_at?.known),i=t.haHistory;return o`${a.length} מתוך ${e.length} ידועות בזמן זה${i?.from?o` <span class="note">(היסטוריה מקומית מ־<span class="ltr">${this.fmtWhen(i.from)}</span>, ${i.retention_days} ימים)</span>`:o` <span class="note">(אין עדיין היסטוריה מקומית)</span>`}
      <div class="evl" style="margin-block-start:4px">${e.slice(0,8).map(s=>{const r=s.entity?.state_at,n=z(s);return o`<div data-history-entity data-known=${r?.known?"true":"false"} data-source=${r?.source??"vms"}><span>${n}${r?.source==="ha_recorder"?o` <span class="note" title="המצב מגיע מהיסטוריית המערכת (מקור משני)">· מקור משני</span>`:v}</span><span class="note">${r?.known&&r.state?o`${C({...s.entity??{domain:"",unit:null,device_class:null,attributes:{}},state:r.state})} · מ־<span class="ltr">${r.changed_at?this.fmt(r.changed_at):""}</span>`:o`לא ידוע${r?.reason?` · ${r.reason}`:""}${r?.state?o` <span class="ltr">(אחרון: ${r.state})</span>`:""}`}</span></div>`})}</div>`}fmtWhen(t){return Et(new Date(t),{timeZone:this.tz})}setDate(t){t&&(this.date=t,this.minute=Math.min(this.minute,this.limitMinute),this.loadDay(),this.scrub&&(this.stopPlay(!1),this.fitWindow(!0),this.scheduleRange(),this.scheduleFrame()))}fmt(t){return ot(new Date(t),{timeZone:this.tz,seconds:!0})}get floors(){return this.tree?.source!=="api"?[]:this.tree.sites.flatMap(t=>(t.buildings??[]).flatMap(e=>(e.floors??[]).map(a=>({id:a.id,name:`${e.name} · ${a.name}`}))))}stateAt(t){return t.entity?.state_at?.known?t.entity.state_at.state:null}get hasScene(){return this.bundle?.source==="api"&&this.geometry!==null}get sceneDescription(){const t=this.bundle,e=this.geometry;if(!this.view3d||!t||t.source!=="api"||!e)return null;const a=this.scrub?this.scrubDrawn:null,i=this.scrub?this.scrubRoomLayer:null,s=[t,e,this.catalog3d,this.level,this.itemNames,this.recordings,this.minute,this.tz,this.real3d,this.materials3d,this.scrub,a,i,this.switches];if(this.sceneMemo&&O(this.sceneMemo.refs,s))return this.sceneMemo.desc;const{entityStates:r,circuitStates:n}=a?{entityStates:a.states,circuitStates:this.scrubCircuits}:pt(t.anchors,t.circuitStates),c=(this.scrub?t.anchors.filter(d=>this.scrubVisible(d)):t.anchors).map(d=>({id:d.id,resource_type:d.resource_type,resource_id:d.resource_id,x:d.position.x,y:d.position.y,rotation:d.rotation_degrees,fov:d.field_of_view_degrees??null,radius:d.coverage_radius??null,polygon:d.coverage_polygon??null,level_id:d.level_id??null,layer_id:d.layer_id,label:z(d),state:a?a.states[d.resource_id]??null:this.stateAt(d),online:d.resource_type==="camera"?this.coverageAt(d.resource_id).state==="historic":null,mount_height_m:d.mount_height_m??null,tilt_deg:d.tilt_deg??null})),u=t.zones.map(d=>({id:d.id,name:d.name,polygon:d.polygon,level_id:d.level_id??null})),m=[JSON.stringify([t.floorId,t.width,t.height,c,r,n,u,Kt(i)]),e,this.catalog3d,this.level,this.itemNames,this.real3d,this.materials3d];if(this.sceneMemo&&O(this.sceneMemo.keys,m))return this.sceneMemo={...this.sceneMemo,refs:s},this.sceneMemo.desc;const h=ee({doc:e,width:t.width,height:t.height,anchors:c,entityStates:r,circuitStates:n,catalog:this.catalog3d,zones:u,level:this.level,anchorsEveryLevel:!0,...i?{roomStates:i}:{},...this.real3d?{realistic:!0,materialsCatalog:this.materials3d}:{}}),g={};for(const d of t.anchors)g[d.id]=z(d);for(const d of e.objects)g[d.id]=d.label||this.itemNames.get(d.item_id)||d.item_id;for(const d of t.zones)g[d.id]=d.name;return this.sceneMemo={refs:s,keys:m,desc:h,labels:g},h}get shows3d(){return this.view3d&&this.threeState==="ready"&&this.sceneDescription!==null}async toggle3d(){if(this.view3d){this.view3d=!1;return}if(!(!A()||!this.hasScene||this.threeState==="loading")){if(this.threeState!=="ready"){this.threeState="loading";try{await Ot(()=>import("./sw-plan-3d-Cx4aAlqT.js"),__vite__mapDeps([0]),import.meta.url),this.threeState="ready"}catch(t){this.threeState="error",this.threeError=q(t);return}}this.view3d=!0}}onPartSelect(t){const{id:e,kind:a}=t.detail;if(!e){this.selectedId=null;return}const i=a?se({id:e,kind:a},this.geometry,this.bundle?.anchors??[]):null;!i||!("anchor"in i)||(this.selectedId=i.anchor,this.frameFailed=!1)}renderPanel(t){return o`<div class="panel">${this.panelCards(t)}</div>`}panelCards(t,e){const a=this.selectedAnchor,i=a?.resource_type==="camera"?a:null,s=i?this.coverageAt(i.resource_id):null,r=i?this.recordings.get(i.resource_id):void 0,n=e?.eventsOff?[]:this.eventsNear(void 0,et),l=this.instant.toISOString().replace(/\.\d{3}Z$/,"Z");return o`
      <sw-card heading="בנקודת הזמן שנבחרה" subheading="זמן ונתונים מאותו רגע" data-history-panel>
        <dl>
          <dt>זמן</dt><dd><span class="ltr" data-history-time>${this.date} ${E(this.minute)}</span> <span class="note">${this.tz}</span></dd>
          <dt>מצלמה נבחרת</dt><dd data-history-camera>${i?i.camera?.name??i.resource_id:"לחץ על מצלמה במפה"}</dd>
          ${i?o`<dt>הקלטה</dt><dd>${r===void 0?"טוען…":r===null?"לא ניתן לבדוק מול ה־NVR":s?.segment?o`יש הקלטה · ${tt(s.segment.startMin)}–${tt(s.segment.endMin)} · ${s.segment.kind==="continuous"?"רציף":"תנועה"}`:"אין הקלטה בזמן זה (פער)"}</dd>
                <dt>אירועים ±5 דק׳</dt><dd>${this.eventsNear(i.resource_id,5).length}</dd>`:v}
          <dt>התקנים</dt><dd data-history-entities>${e?e.entities:this.renderEntityStates(t)}</dd>
          ${e?e.rows:v}
          ${i&&this.frameAt?o`<dt>פריים</dt><dd><div class="frame" data-history-frame>${this.frameFailed?o`<span>אין פריים בהקלטה בזמן זה</span>`:o`<img src=${Bt(i.resource_id,this.frameAt)} alt="פריים מההקלטה בזמן שנבחר" @error=${()=>this.frameFailed=!0} />`}</div></dd>`:v}
          <dt>גרסת תוכנית</dt><dd data-history-plan-version data-history-mode=${t.history??"live"}>${t.history==="exact"&&t.planPublishedAt?o`בתוקף באותו זמן · פורסמה <span class="ltr">${this.fmtWhen(t.planPublishedAt)}</span>${t.planArchivedAt?o` · הוחלפה <span class="ltr">${this.fmtWhen(t.planArchivedAt)}</span>`:""}`:t.historyFrom?o`המפה הנוכחית · היסטוריית המפה מתחילה <span class="ltr">${this.fmtWhen(t.historyFrom)}</span>`:"המפה הנוכחית"}</dd>
        </dl>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-block-start:10px">
          ${i?o`<sw-button variant="primary" size="sm" icon="history" @click=${()=>L("/investigate/playback",{camera:i.resource_id,t:l})}>נגן מכאן</sw-button>`:v}
          ${e?e.actions:v}
          <sw-button size="sm" icon="case" data-add-to-case ?disabled=${!i} title=${i?"קטע של המצלמה הנבחרת סביב הזמן שנבחר (15 שניות לפני, 45 אחרי)":"בחר מצלמה במפה"} @click=${()=>{i&&(this.casePick={kind:"clip",camera_id:i.resource_id,...Ft(this.instant)})}}>הוסף לתיק</sw-button>
        </div>
      </sw-card>
      <sw-case-picker .item=${this.casePick} subheading=${i?`${i.camera?.name??i.resource_id} · ${this.date} ${E(this.minute)}`:""} @close=${()=>this.casePick=null}></sw-case-picker>
      <sw-card heading="אירועים סביב הזמן" subheading=${`±${et} דקות · מצלמות הקומה`}>
        ${n.length?o`<div class="evl" data-history-events>${n.slice(0,8).map(c=>o`<a class=${i&&c.camera_id===i.resource_id?"hit":""} href=${`#/investigate/events/${c.id}`}><span>${X[c.type]??c.type} · ${c.camera_name??c.channel??""}<div class="s">${c.confidence==="inferred"?"נגזר מהקלטה":"התראה מה־NVR"}${c.acked_at?" · טופל":""}</div></span><span class="ltr">${this.fmt(c.occurred_at)}</span></a>`)}</div>`:o`<div class="note">${e?.eventsOff??"אין אירועים בחלון הזה."}</div>`}
      </sw-card>`}renderApi(){const t=this.bundle;if(this.error&&!t)return o`<div class="head lead-head"><h1>מפה היסטורית</h1></div><sw-state-panel state="error" hint=${this.error}></sw-state-panel>`;if(!t)return o`<div class="head lead-head"><h1>מפה היסטורית</h1></div><sw-state-panel state="loading"></sw-state-panel>`;const e=this.selectedAnchor,a=e?.resource_type==="camera"?this.segmentsFor(e.resource_id)??[]:Array.from(this.recordings.keys()).flatMap(s=>this.segmentsFor(s)??[]),i=(e?.resource_type==="camera"?this.events.filter(s=>s.camera_id===e.resource_id):this.events).map(s=>({minute:I(new Date(s.occurred_at),this.tz),kind:wt(s.type),label:`${X[s.type]??s.type}${s.count>1?` ×${s.count}`:""}`}));return o`
      <div class="head lead-head">
        <div><h1>המפה בזמן שנבחר · ${t.floorName}</h1><div class="sub">${t.buildingName} · <span class="ltr">${this.date} ${E(this.minute)}</span> · ${this.tz}</div></div>
        <span class="grow"></span>
        ${this.floors.length>1?o`<sw-field><select aria-label="קומה" @change=${s=>L(`/investigate/floors/${s.target.value}`,{t:this.instant.toISOString()})}>${this.floors.map(s=>o`<option value=${s.id} ?selected=${s.id===this.floorId}>${Q(s.name)}</option>`)}</select></sw-field>`:v}
        ${t.imageUrl?o`<sw-button icon="map" aria-pressed=${this.planImage} data-plan-background title=${this.planImage?"הסתר את תמונת התוכנית":"הצג את תמונת התוכנית"} @click=${()=>this.setPlanImage(!this.planImage)}>תמונת התוכנית</sw-button>`:v}
        <sw-button icon="cube" aria-pressed=${this.view3d} data-view-3d ?disabled=${!this.view3d&&(!A()||!this.hasScene||this.threeState==="loading")}
          title=${A()?this.hasScene?"מקש 3":"אין מבנה מפורסם בזמן הזה":K} @click=${()=>this.toggle3d()}>${this.view3d?"2D":"3D"}</sw-button>
        ${A()?v:o`<span class="note" data-3d-unavailable>${K}</span>`}
        <sw-button icon="live" data-back-live @click=${()=>L(`/explore/floors/${t.floorId}`)}>חזרה למצב חי</sw-button>
      </div>
      <div class="bar"><sw-icon name="clock" size=${14}></sw-icon><span>מצב חקירה היסטורי — פעולות פיזיות אינן זמינות. מצב ללא היסטוריה מוצג כלא ידוע, לא כערך החי האחרון.</span>${this.loading?o`<span class="note">טוען הקלטות ואירועים…</span>`:v}</div>
      <div class="layout">
        <div class="stage">
          <div class="chip"><sw-icon name="building" size=${14}></sw-icon>${t.floorName}</div>
          <div class="hist">מצב היסטורי · <span class="ltr">${E(this.minute)}</span></div>
          ${this.shows3d&&this.sceneDescription?o`<sw-plan-3d data-history-3d .description=${this.sceneDescription} .selectedId=${this.selectedId} .preset=${this.preset3d} .frameKey=${t.floorId} .labels=${this.sceneMemo?.labels??{}}
                .cameras=${t.anchors.filter(s=>s.resource_type==="camera").map(s=>({id:s.id,label:z(s)}))} exportName=${`plan-3d-${t.floorName}-${this.date}`}
                .sunAt=${this.instant.getTime()} .walkable=${j.walkable} .stillsAvailable=${j.stillsAvailable}
                @realistic-change=${s=>{this.real3d!==s.detail.on&&(this.real3d=s.detail.on)}}
                @part-select=${s=>this.onPartSelect(s)}></sw-plan-3d>`:v}
          <sw-plan-canvas style=${this.shows3d?"display:none":""} alwaysLabel .planWidth=${t.width} .planHeight=${t.height} .plan=${t.planSvg} .imageUrl=${t.imageUrl} .hideImage=${!this.planImage} .markers=${this.apiMarkers} .selectedId=${this.selectedId} .zones=${dt(t.zones)} .geometry=${this.geometry} .structureLevel=${this.level} .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(t.anchors.map(s=>[`${s.resource_type}:${s.resource_id}`,{x:s.position.x,y:s.position.y,rotation:s.rotation_degrees}]))} .entityStates=${Object.fromEntries(t.anchors.filter(s=>s.resource_type==="ha_entity").map(s=>[s.resource_id,this.stateAt(s)]))} dimEntities
            @marker-select=${s=>{this.selectedId=s.detail.id,this.frameFailed=!1}}></sw-plan-canvas>
          ${this.threeState==="loading"?o`<div class="hist below" data-3d-loading>טוען תלת-ממד…</div>`:v}
          ${this.threeState==="error"?o`<div class="hist below" data-3d-load-error>תלת-ממד לא נטען: ${this.threeError}</div>`:v}
          ${this.shows3d?v:o`<div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = אין הקלטה / לא ידוע</span><span>התקנים = מצב מההיסטוריה המקומית או לא ידוע</span></div>`}
        </div>
        ${this.renderPanel(t)}
      </div>
      <div class="tl">
        <div class="tlbar">
          <sw-badge kind="historic"></sw-badge>
          <span class="time">${this.date} ${E(this.minute)}</span>
          <sw-chip @click=${()=>this.setMinute(this.minute-60)}>-1 שעה</sw-chip><sw-chip @click=${()=>this.setMinute(this.minute-5)}>-5 דק׳</sw-chip><sw-chip @click=${()=>this.setMinute(this.minute+5)}>+5 דק׳</sw-chip><sw-chip @click=${()=>this.setMinute(this.minute+60)}>+1 שעה</sw-chip>
          <span class="grow"></span>
          <sw-field><input type="date" lang=${lt()} .value=${this.date} max=${N(new Date,this.tz)} data-ltr aria-label="תאריך" @change=${s=>this.setDate(s.target.value)} /></sw-field>
          <span class="note">${e?.resource_type==="camera"?`ציר הזמן: ${e.camera?.name??""}`:"ציר הזמן: כל מצלמות הקומה"}</span>
        </div>
        <sw-timeline .segments=${a} .events=${i} .cursor=${this.minute} .limit=${this.limitMinute} .follow=${!1} precision="estimated" @seek=${s=>this.setMinute(s.detail.minute)} @scrub=${s=>this.setMinute(s.detail.minute)}></sw-timeline>
      </div>
    `}restoreSwitches(){try{this.switches=ue(localStorage.getItem(mt))}catch{this.switches=at()}}toggleLayer(t){this.switches={...this.switches,[t]:!this.switches[t]};try{localStorage.setItem(mt,me(this.switches))}catch{}}featureOff(){this.stopPlay(!1),this.scrub=!1,this.snapshot=null,this.range=null,this.rangeKey=""}async fetchSnapshot(){const t=this.bundle;if(!this.scrub||!t||t.source!=="api")return;const e=U(this.instant);if(this.snapshot&&Date.parse(this.snapshot.at)===Date.parse(e))return;const a=++this.snapSeq,i=this.floorId;this.snapLoading=!0;try{const s=await de(i,e);if(a!==this.snapSeq||i!==this.floorId)return;this.snapshot=s,this.snapError="";const r=Number(s.settings?.range_max_days);Number.isFinite(r)&&r>=1&&(this.rangeMaxDays=Math.min(30,r))}catch(s){if(a!==this.snapSeq)return;if(ut(s)){this.featureOff();return}this.snapError=q(s)}finally{a===this.snapSeq&&(this.snapLoading=!1)}}msAt(t){return ht(this.date,t,this.tz).getTime()}minuteOfMs(t){return t>=this.msAt(1440)?1440:t<=this.msAt(0)?0:Math.max(0,Math.min(1440,I(new Date(t),this.tz)+(t%1e3+1e3)%1e3/6e4))}get winFromMs(){return this.msAt(this.winStart)}get winToMs(){return Math.min(this.msAt(this.winStart+this.winMinutes),this.msAt(this.limitMinute))}fitWindow(t){const e=this.winMinutes;if(!t&&this.minute>=this.winStart&&this.minute<=this.winStart+e)return;const a=e>=1440?0:Math.max(0,Math.min(1440-e,this.minute-e/2));(a!==this.winStart||t)&&(this.winStart=a,this.scheduleRange())}setWindow(t){this.winMinutes=t,this.winStart=t>=1440?0:Math.max(0,Math.min(1440-t,this.minute-t/2)),this.scheduleRange()}onTimelineWindow(t){const e=t.target;this.winMinutes=e.windowMinutes,this.winStart=e.start,this.scheduleRange()}scheduleRange(t=300){window.clearTimeout(this.rangeTimer),this.rangeTimer=window.setTimeout(()=>void this.fetchRange(),t)}async fetchRange(){const t=this.bundle;if(!this.scrub||!t||t.source!=="api")return;const e=this.winFromMs,a=Math.min(this.winToMs,e+this.rangeMaxDays*864e5);if(!(a>e)){this.range=null,this.rangeKey="";return}const i=`${this.floorId}|${e}|${a}`;if(i===this.rangeKey)return;const s=++this.rangeSeq,r=this.floorId;try{const n=await he(r,U(e),U(a),pe);if(s!==this.rangeSeq||r!==this.floorId)return;this.range=n,this.rangeKey=i,this.rangeNote=""}catch(n){if(s!==this.rangeSeq)return;if(ut(n)){this.featureOff();return}const l=ce(n);this.range=null,this.rangeKey="",this.rangeNote=l==="range_too_large"?"יותר מדי שינויים בחלון - בחרו חלון קצר יותר":l==="range_too_long"?"החלון ארוך מהמותר - בחרו חלון קצר יותר":`פסי השכבות לא נטענו: ${q(n)}`}}get replayMs(){return this.playing?this.stateMs:this.instant.getTime()}get snapReplay(){const t=this.snapshot;return t?(this.snapReplayMemo?.snap!==t&&(this.snapReplayMemo={snap:t,value:be(t)}),this.snapReplayMemo.value):null}get replay(){const t=this.replayMs,e=[this.snapshot,this.range,t,this.playing];if(this.replayMemo&&O(this.replayMemo.refs,e))return this.replayMemo.value;let a=null;const i=this.snapshot;return!this.playing&&i&&Math.abs(Date.parse(i.at)-t)<1e3?a=this.snapReplay:this.range&&t>=Date.parse(this.range.from)&&t<=Date.parse(this.range.to)&&(a=ye(this.range,t,this.snapReplay)),this.replayMemo={refs:e,value:a},a}get layerStatus(){return this.replay?.status??this.snapReplay?.status??{}}layerOfAnchor(t){const e=t.resource_id;return this.replay?.entities[e]?.layer??this.snapReplay?.entities[e]?.layer??xe({id:e,domain:t.entity?.domain??e.split(".")[0]??"",device_class:t.entity?.device_class??null,layer_id:t.layer_id})}scrubVisible(t){return t.resource_type==="camera"?this.switches.cameras:!!this.switches[this.layerOfAnchor(t)]}get scrubDrawn(){const t=this.bundle,e=this.replay,a=[t,e,this.switches];if(this.drawnMemo&&O(this.drawnMemo.refs,a))return this.drawnMemo.value;const i=(t?.anchors??[]).filter(r=>r.resource_type==="ha_entity").map(r=>r.resource_id),s=$e(e,this.switches,i);return this.drawnMemo={refs:a,value:s},s}get scrubCircuits(){const t=this.bundle,e=this.replay,a=()=>Object.fromEntries(Object.keys(t?.circuitStates??{}).sort().map(i=>[i,null]));return!t||!e||this.playing||!t.at||Math.abs(Date.parse(t.at)-this.replayMs)>=1e3||!_t("lights",this.switches,e.status)?a():pt(t.anchors,t.circuitStates).circuitStates}factsFor(t,e){const a=this.factsMemo;if(a&&a.geometry===t&&a.w===e.width&&a.h===e.height&&a.catalog===this.catalogLookup)return a.facts;const i=re(t,e.width,e.height,this.catalogLookup);return this.factsMemo={geometry:t,w:e.width,h:e.height,catalog:this.catalogLookup,facts:i},i}get scrubRoomLayer(){const t=this.bundle,e=this.geometry;if(!t||t.source!=="api")return null;const a=this.scrubDrawn,i=this.scrubCircuits,s=[t,e,this.catalogLookup,a,JSON.stringify(i),this.replayMs];if(this.roomMemo&&O(this.roomMemo.refs,s))return this.roomMemo.value;const r=e?this.factsFor(e,t):null;let n=null;if(t.zones.length||r?.openings.length){const l=ne(t.anchors,a.states,{lastChanged:a.lastChanged,withAttributes:!1}),c=(r?.lamps??[]).map(h=>({x:h.x,y:h.y,level_id:h.level_id,on:h.circuit!==null&&i[h.circuit]==="on"||h.entity!==null&&a.states[h.entity]==="on"})),u=t.zones.map(h=>({id:h.id,polygon:h.polygon,level_id:h.level_id??null})),m=this.levelFallback;n=Ut({rooms:u,entities:l,openings:r?.openings??[],lamps:c,size:[t.width,t.height],scaleMPerPx:t.scaleMPerPx,now:this.replayMs,fade:"off",levelOf:h=>h??m})}return this.roomMemo={refs:s,value:n},n}get levelFallback(){const t=this.bundle;return this.geometry?Vt(this.geometry):t?.levels.find(e=>e.is_default)?.id??"L0"}get scrubMarkers(){const t=this.bundle;if(!t)return[];const e=this.scrubDrawn,a=this.layerStatus,i=[t,e,this.switches,this.recordings,this.events,Math.floor(this.minute),this.date],s=String(a.cameras??"");if(this.markersMemo&&this.markersMemo.key===s&&O(this.markersMemo.refs,i))return this.markersMemo.value;const r=a.cameras==="not_permitted",n=new Map(t.anchors.map(c=>[c.id,c])),l=[];for(const c of this.apiMarkers){const u=n.get(c.id);if(!u||!this.scrubVisible(u))continue;if(u.resource_type==="camera"){l.push(r?{...c,label:u.camera?.name??u.label??u.resource_id,state:"unknown"}:c);continue}const m=e.states[u.resource_id]??null,h=z(u);l.push({...c,label:m!==null?`${h} · ${C({...u.entity??{domain:"",unit:null,device_class:null,attributes:{}},state:m})}`:h,state:m!==null?"historic":"unknown"})}return this.markersMemo={refs:i,key:s,value:l},l}scrubLanes(t,e){const a=this.layerStatus,i=JSON.stringify([t,e,a]),s=[this.range,this.switches,this.events];if(this.lanesMemo&&this.lanesMemo.key===i&&O(this.lanesMemo.refs,s))return this.lanesMemo.value;const n=["lights","openings","presence","alarm","elevators"].map(c=>ze(this.range,c,t,e,this.switches,a)),l=a.events==="not_permitted";return n.push({id:"events",label:V.events,color:st.events,off:!this.switches.events||l,locked:l,spans:[],marks:l?[]:this.events.map(c=>Date.parse(c.occurred_at)).filter(c=>c>=t&&c<=e).sort((c,u)=>c-u)}),this.lanesMemo={key:i,refs:s,value:n},n}startPlay(){if(this.playing)return;this.mode="play";const t=this.winToMs;let e=this.instant.getTime();(e>=t-1e3||e<this.winFromMs)&&(e=this.winFromMs),t>e&&(this.playing=!0,this.playMs=e,this.stateMs=e,this.minute=this.minuteOfMs(e),this.lastFrame=performance.now(),this.lastStateTick=this.lastFrame,this.raf=requestAnimationFrame(this.tick))}stopPlay(t){this.raf&&cancelAnimationFrame(this.raf),this.raf=0,this.playing&&(this.playing=!1,this.stateMs=this.playMs,t&&this.scheduleFrame())}togglePlay(){this.playing?this.stopPlay(!0):this.startPlay()}setMode(t){t==="snapshot"&&this.stopPlay(!0),this.mode=t}onScrubKey(t,e){if(t.key===" "||t.code==="Space")return e instanceof HTMLElement&&(e.tagName==="BUTTON"||e.tagName==="A"||e.getAttribute("role")==="switch")?!1:(t.preventDefault(),t.repeat||this.togglePlay(),!0);if(t.key==="ArrowLeft"||t.key==="ArrowRight"){t.preventDefault();const a=t.shiftKey?10:this.winMinutes<=10?1/6:1;return this.setMinute(this.minute+(t.key==="ArrowRight"?a:-a)),!0}return!1}goTo(t){this.stopPlay(!1);const e=new Date(t),a=N(e,this.tz),i=a!==this.date;this.date=a,this.minute=Math.min(this.limitMinute,I(e,this.tz)),i&&this.loadDay(),this.fitWindow(!0),this.scheduleFrame()}fmtHm(t){return ot(new Date(t),{timeZone:this.tz})}renderLayers(t,e){const a=(this.bundle?.anchors??[]).filter(s=>s.resource_type==="camera").map(s=>s.resource_id),i=a.filter(s=>this.coverageAt(s).state==="historic").length;return o`<div class="lcard" data-history-layers>
      <div class="lhd"><h2>שכבות</h2><span class="grow"></span>${this.range?.bucket_s?o`<span class="note">דגימה כל ${Math.max(1,Math.round(this.range.bucket_s/60))} דק׳</span>`:v}</div>
      <div class="layers" role="group" aria-label="שכבות">
        ${Z.map(s=>{const r=t[s],n=r==="not_permitted",l=!!this.switches[s]&&!n,c=fe(r);let u=c.text;r?s==="elevators"&&r==="ok"?u="מצב בלבד":s==="cameras"&&r==="ok"&&(u=`${i} מ־${a.length}`):u=this.snapLoading?"…":"לא ידוע";const m=s==="cameras"?"· לפי ה־NVR":ge(e[s]);return o`<div class="lyr" data-layer=${s} data-off=${l?"false":"true"} data-status=${r??""}>
            <button class="sw" type="button" role="switch" aria-checked=${l?"true":"false"} aria-label=${V[s]} ?disabled=${n} @click=${()=>this.toggleLayer(s)}></button>
            <span class="nm"><i style=${`background:${st[s]}`}></i>${V[s]}${m?o` <span class="cov">${m}</span>`:v}</span>
            <span class="st" data-look=${r?c.look:"unk"}>${n?o`<sw-icon name="lock" size=${13}></sw-icon>`:v}${u}</span>
          </div>`})}
      </div>
    </div>`}reasonText(t){switch(t){case"gap":return"פער בהקלטה";case"forward_fill_exceeded":return"אין שינוי מוקלט קרוב";case"before_history":return"לפני תחילת ההיסטוריה";default:return t??""}}scrubPanelParts(t,e,a){const i=this.scrubDrawn,s=t.anchors.filter(y=>y.resource_type==="ha_entity"),r=s.filter(y=>i.states[y.resource_id]!==null&&i.states[y.resource_id]!==void 0),n=e?.coverage??this.snapshot?.coverage??null,l=s.length?o`${r.length} מתוך ${s.length} ידועות בזמן זה${n?.from?o` <span class="note">(היסטוריה מקומית מ־<span class="ltr">${this.fmtWhen(n.from)}</span>)</span>`:o` <span class="note">(אין עדיין היסטוריה מקומית)</span>`}
        <div class="evl" style="margin-block-start:4px">${s.filter(y=>this.scrubVisible(y)).slice(0,8).map(y=>{const $=this.layerOfAnchor(y),J=a[$]==="not_permitted",p=i.states[y.resource_id]??null,W=e?.entities[y.resource_id],Mt=z(y);return o`<div data-history-entity data-known=${p!==null?"true":"false"} data-layer=${$}><span>${Mt}</span><span class="note">${J?"לא מורשה":p!==null?o`${C({...y.entity??{domain:"",unit:null,device_class:null,attributes:{}},state:p})}${W?.changedAt?o` · מ־<span class="ltr">${this.fmt(W.changedAt)}</span>`:""}${W?.changedDuring?" · השתנה בתוך הדגימה":""}`:o`לא ידוע${W?.reason?` · ${this.reasonText(W.reason)}`:""}`}</span></div>`})}</div>`:o`אין ישויות מוצבות בקומה`,c=ke(t.zones,s.map(y=>({x:y.position.x,y:y.position.y,level_id:y.level_id??null,state:i.states[y.resource_id]??null})),y=>y??this.levelFallback),m=Object.entries(e?.entities??{}).filter(([,y])=>y.layer==="alarm").find(([,y])=>y.known&&y.state!==null),h=a.alarm==="not_permitted"?o`<sw-icon name="lock" size=${12}></sw-icon> לא מורשה`:this.switches.alarm?a.alarm==="empty"?"אין לוח אזעקה בקומה":m?o`${C({domain:"alarm_control_panel",unit:null,device_class:null,attributes:{},state:m[1].state})}${m[1].changedAt?o` · מ־<span class="ltr">${this.fmt(m[1].changedAt)}</span>`:""}`:"לא ידוע":"השכבה כבויה",g=Object.entries(e?.elevators??{}),d=a.elevators!==void 0&&a.elevators!=="empty",x=a.elevators==="not_permitted"?o`<sw-icon name="lock" size=${12}></sw-icon> לא מורשה`:this.switches.elevators?o`<div class="elev">${g.length?g.map(([y,$])=>o`<sw-chip data-elevator=${y}>${$.name} · ${$.known&&$.state?Le[$.state]??$.state:"לא ידוע"}</sw-chip>`):o`<span>לא ידוע</span>`}</div><div class="note">מיקום התא לא מוקלט</div>`:"השכבה כבויה",T=o`
      <dt>חדרים</dt><dd data-history-rooms>${c.total?`${c.known} מתוך ${c.total} ידועים`:"אין חדרים מסומנים בקומה"}</dd>
      <dt>אזעקה</dt><dd data-history-alarm>${h}</dd>
      ${d?o`<dt>מעליות</dt><dd data-history-elevators>${x}</dd>`:v}`,B=a.cameras==="not_permitted",F=this.snapshot?.layers.cameras?.camera_ids,S=B||!this.switches.cameras?[]:F&&F.length?F:t.anchors.filter(y=>y.resource_type==="camera").map(y=>y.resource_id),k=U(this.instant),G=o`<sw-button size="sm" icon="camera" data-history-all-cameras ?disabled=${!S.length} title=${S.length>4?"ארבע המצלמות הראשונות של הקומה":"כל מצלמות הקומה מהזמן שנבחר"}
      @click=${()=>{S.length&&L("/investigate/playback",{camera:S[0],t:k,...S.length>1?{extra:S.slice(1,4).join(",")}:{}})}}>כל מצלמות הקומה מכאן</sw-button>`,Y=a.events==="not_permitted"?"לא מורשה":this.switches.events?null:"השכבה כבויה";return{entities:l,rows:T,actions:G,eventsOff:Y}}renderScrub(){const t=this.bundle;if(this.error&&!t)return o`<div class="head lead-head"><h1>מפה היסטורית</h1></div><sw-state-panel state="error" hint=${this.error}></sw-state-panel>`;if(!t)return o`<div class="head lead-head"><h1>מפה היסטורית</h1></div><sw-state-panel state="loading"></sw-state-panel>`;const e=this.selectedAnchor,a=this.replay,i=this.layerStatus,s=a?.retention??this.snapReplay?.retention??{},r=a?.coverage??this.snapshot?.coverage??this.range?.coverage??null,n=this.replayMs,l=r?kt(r.gaps,n):null,c=this.switches.cameras&&i.cameras!=="not_permitted",u=this.switches.events&&i.events!=="not_permitted",m=c?e?.resource_type==="camera"?this.segmentsFor(e.resource_id)??[]:Array.from(this.recordings.keys()).flatMap(p=>this.segmentsFor(p)??[]):[],h=u?(e?.resource_type==="camera"?this.events.filter(p=>p.camera_id===e.resource_id):this.events).map(p=>({minute:I(new Date(p.occurred_at),this.tz),kind:wt(p.type),label:`${X[p.type]??p.type}${p.count>1?` ×${p.count}`:""}`})):[],g=`${this.date} ${E(this.minute)}`,d=this.winFromMs,x=this.msAt(this.winStart+this.winMinutes),T=this.msAt(this.limitMinute),B=this.playing?this.playMs:this.instant.getTime(),F=this.scrubLanes(d,x),S=Ie(this.range?.coverage?.gaps??r?.gaps,d,x),k=r?.from?Date.parse(r.from):null,G=!!r&&(k===null||n<k),Y=this.scrubRoomLayer,y=this.scrubDrawn,$=r?.from?N(new Date(r.from),this.tz):void 0,J=this.scrubPanelParts(t,a,i);return o`
      <div class="head lead-head">
        <div><h1>המפה בזמן שנבחר · ${t.floorName}</h1><div class="sub">${t.buildingName} · <span class="ltr">${g}</span> · ${this.tz}</div></div>
        <span class="grow"></span>
        <div class="acts-h">
          ${this.floors.length>1?o`<sw-field><select aria-label="קומה" @change=${p=>L(`/investigate/floors/${p.target.value}`,{t:this.instant.toISOString()})}>${this.floors.map(p=>o`<option value=${p.id} ?selected=${p.id===this.floorId}>${Q(p.name)}</option>`)}</select></sw-field>`:v}
          ${t.imageUrl?o`<sw-button icon="map" aria-pressed=${this.planImage} data-plan-background title=${this.planImage?"הסתר את תמונת התוכנית":"הצג את תמונת התוכנית"} @click=${()=>this.setPlanImage(!this.planImage)}><span class="lbl">תמונת התוכנית</span></sw-button>`:v}
          <sw-button icon="cube" aria-pressed=${this.view3d} data-view-3d ?disabled=${!this.view3d&&(!A()||!this.hasScene||this.threeState==="loading")}
            title=${A()?this.hasScene?"מקש 3":"אין מבנה מפורסם בזמן הזה":K} @click=${()=>this.toggle3d()}>${this.view3d?"2D":"3D"}</sw-button>
          ${A()?v:o`<span class="note" data-3d-unavailable>${K}</span>`}
          <sw-button icon="live" data-back-live title="חזרה למצב חי" @click=${()=>L(`/explore/floors/${t.floorId}`)}><span class="lbl">חזרה למצב חי</span></sw-button>
          <sw-button class="details-btn" icon="inbox" data-history-details title="פרטים" aria-expanded=${this.detailsOpen?"true":"false"} @click=${()=>this.detailsOpen=!this.detailsOpen}>פרטים</sw-button>
        </div>
      </div>
      <div class="bar">
        <sw-icon name="clock" size=${14}></sw-icon>
        <span>מצב חקירה היסטורי — פעולות פיזיות אינן זמינות. מצב ללא היסטוריה מוצג כלא ידוע, לא כערך החי האחרון.</span>
        <span class="grow"></span>
        ${this.rangeNote?o`<span class="pill warn" data-history-range-note>${this.rangeNote}</span>`:v}
        ${this.mode==="play"?o`<span class="pill" data-history-mode="play">ניגון · <span class="ltr">${this.fmtHm(d)}–${this.fmtHm(Math.min(x,T))}</span>${this.range?.bucket_s?` · דגימה כל ${Math.max(1,Math.round(this.range.bucket_s/60))} דק׳`:""}</span>`:o`<span class="pill" data-history-mode="snapshot">רגע אחד</span>`}
      </div>
      <div class="layout ts">
        <div class="stage">
          <div class="chip"><sw-icon name="building" size=${14}></sw-icon>${t.floorName}</div>
          <div class="hist ${l?"gap":""}" data-history-tag>מצב היסטורי · <span class="ltr">${E(this.minute)}</span></div>
          ${this.shows3d&&this.sceneDescription?o`<sw-plan-3d data-history-3d .description=${this.sceneDescription} .selectedId=${this.selectedId} .preset=${this.preset3d} .frameKey=${t.floorId} .labels=${this.sceneMemo?.labels??{}}
                .cameras=${t.anchors.filter(p=>p.resource_type==="camera").map(p=>({id:p.id,label:z(p)}))} exportName=${`plan-3d-${t.floorName}-${this.date}`}
                .sunAt=${n} .walkable=${j.walkable} .stillsAvailable=${j.stillsAvailable}
                @realistic-change=${p=>{this.real3d!==p.detail.on&&(this.real3d=p.detail.on)}}
                @part-select=${p=>this.onPartSelect(p)}></sw-plan-3d>`:v}
          <sw-plan-canvas style=${this.shows3d?"display:none":""} alwaysLabel .planWidth=${t.width} .planHeight=${t.height} .plan=${t.planSvg} .imageUrl=${t.imageUrl} .hideImage=${!this.planImage} .markers=${this.scrubMarkers} .selectedId=${this.selectedId} .zones=${dt(t.zones)} .geometry=${this.geometry} .structureLevel=${this.level} .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(t.anchors.map(p=>[`${p.resource_type}:${p.resource_id}`,{x:p.position.x,y:p.position.y,rotation:p.rotation_degrees}]))} .entityStates=${y.states} .roomStates=${Y} dimEntities
            @marker-select=${p=>{this.selectedId=p.detail.id,this.frameFailed=!1}}></sw-plan-canvas>
          ${this.threeState==="loading"?o`<div class="hist below" data-3d-loading>טוען תלת-ממד…</div>`:v}
          ${this.threeState==="error"?o`<div class="hist below" data-3d-load-error>תלת-ממד לא נטען: ${this.threeError}</div>`:v}
          ${this.shows3d?v:o`<div class="legend"><span>כחול = יש הקלטה</span><span>מקווקו = לא ידוע / לא מוקלט</span><span>צהוב = מואר</span><span>כחול בהיר = נוכחות</span></div>`}
          ${l?o`<div class="gapbar" data-history-gap role="status"><sw-icon name="warning" size=${14}></sw-icon><span>פער בהקלטה <span class="ltr">${this.fmtHm(Date.parse(l.from))}–${this.fmtHm(Date.parse(l.to))}</span> — המערכת לא הייתה מחוברת. מצבי ההתקנים לא ידועים, המצלמות לפי ה־NVR.</span></div>`:v}
          ${this.snapLoading&&!a&&!this.snapError?o`<div class="cover" data-history-loading><sw-state-panel state="loading" heading="טוען את מצב הקומה…" hint="היסטוריה מקומית, הקלטות ואירועים."></sw-state-panel></div>`:v}
          ${this.snapError&&!a?o`<div class="cover" data-history-error><sw-state-panel state="error" heading="לא ניתן לטעון את המצב ההיסטורי" hint="המפה הנוכחית מוצגת ללא מצבים. נסו שוב." actionLabel="ניסיון חוזר" @action=${()=>{this.snapshot=null,this.fetchSnapshot()}}></sw-state-panel></div>`:v}
          ${G&&!this.snapLoading&&!this.playing?o`<div class="cover" data-history-none><sw-state-panel icon="history" state="empty" heading="אין עדיין היסטוריה לקומה הזאת" hint=${k!==null?`ההיסטוריה המקומית מתחילה ${this.fmtWhen(r.from)}. לפני כן מוצגת התוכנית בלבד, ההקלטות לפי ה־NVR.`:"לפני תחילת ההיסטוריה המקומית מוצגת התוכנית בלבד, ההקלטות לפי ה־NVR."}
                actionLabel=${k!==null&&k>n?"לרגע הראשון המוקלט":""} @action=${()=>{k!==null&&this.goTo(k)}}></sw-state-panel></div>`:v}
        </div>
        <div class="panel">
          ${this.renderLayers(i,s)}
          <div class="details ${this.detailsOpen?"open":""}" data-history-details-sheet>
            <div class="sheet-hd"><span>פרטים</span><span class="grow"></span><sw-button size="sm" @click=${()=>this.detailsOpen=!1}>סגירה</sw-button></div>
            ${this.panelCards(t,J)}
          </div>
        </div>
      </div>
      <div class="tlx" data-history-timeline>
        <div class="tlrow">
          <sw-badge kind="historic"></sw-badge>
          <span class="time" data-history-time-bar>${g}</span>
          <div class="seg" role="group" aria-label="אופן">
            <button type="button" aria-pressed=${this.mode==="snapshot"?"true":"false"} data-mode="snapshot" @click=${()=>this.setMode("snapshot")}>רגע אחד</button>
            <button type="button" aria-pressed=${this.mode==="play"?"true":"false"} data-mode="play" @click=${()=>this.setMode("play")}>ניגון תקופה</button>
          </div>
          ${this.mode==="play"?o`<button type="button" class="play" data-play aria-label=${this.playing?"השהיה":"ניגון"} aria-pressed=${this.playing?"true":"false"} @click=${()=>this.togglePlay()}><sw-icon name=${this.playing?"pause":"play"} size=${18}></sw-icon></button>
              <div class="seg speed" role="group" aria-label="מהירות">${Ae.map(p=>o`<button type="button" data-speed=${p} aria-pressed=${this.speed===p?"true":"false"} @click=${()=>this.speed=p}>×${p}</button>`)}</div>`:v}
          <sw-chip data-step="-60" @click=${()=>this.setMinute(this.minute-60)}>-1 שעה</sw-chip><sw-chip data-step="-5" @click=${()=>this.setMinute(this.minute-5)}>-5 דק׳</sw-chip><sw-chip data-step="5" @click=${()=>this.setMinute(this.minute+5)}>+5 דק׳</sw-chip><sw-chip data-step="60" @click=${()=>this.setMinute(this.minute+60)}>+1 שעה</sw-chip>
          <span class="grow"></span>
          <div class="seg win" role="group" aria-label="חלון">${Pe.map(p=>o`<button type="button" data-window=${p.minutes} aria-pressed=${this.winMinutes===p.minutes?"true":"false"} @click=${()=>this.setWindow(p.minutes)}>${p.label}</button>`)}</div>
          <span class="dateq"><sw-field><input type="date" lang=${lt()} .value=${this.date} min=${$??""} max=${N(new Date,this.tz)} data-ltr aria-label="תאריך" @change=${p=>this.setDate(p.target.value)} /></sw-field></span>
          ${this.mode==="play"?o`<span class="note keys"><span class="kbd">רווח</span> ניגון · <span class="kbd">←</span><span class="kbd">→</span> צעד</span>`:v}
        </div>
        <div class="track">
          <sw-history-lanes .lanes=${F} .gaps=${S} .from=${d} .to=${x} .cursor=${B} .limit=${T<x?T:null} @seek=${p=>this.setMinute(this.minuteOfMs(p.detail.ms))}></sw-history-lanes>
          <div class="tlwrap">
            <sw-timeline compact .segments=${m} .events=${h} .cursor=${this.minute} .limit=${this.limitMinute} .follow=${!1} .windowMinutes=${this.winMinutes} .viewStart=${this.winStart} precision="estimated"
              @seek=${p=>this.setMinute(p.detail.minute)} @scrub=${p=>this.setMinute(p.detail.minute)} @window-change=${p=>this.onTimelineWindow(p)}></sw-timeline>
          </div>
        </div>
      </div>
    `}get demoMarkers(){const t=i=>i==="cam-3"||this.minute>=190&&this.minute<=205?"unknown":"historic",e=Pt.filter(i=>i.floorId===this.floorId).map(i=>({id:i.id,kind:"camera",label:i.name,x:i.x,y:i.y,rotation:i.rotation,fov:i.fov,state:i.state==="forbidden"?"forbidden":t(i.id)})),a=Lt.filter(i=>i.floorId===this.floorId).map((i,s)=>({id:i.id,kind:i.domain,label:i.name,x:i.x,y:i.y,state:s%2?"unknown":"historic"}));return[...e,...a]}renderDemo(){const t=ct.find(e=>e.id===this.floorId)??ct[0];return o`
      <div class="head lead-head">
        <div><h1>מפה היסטורית · ${Q(t.name)}</h1><div class="sub">מצב המפה בזמן נבחר · פעולות פיזיות כבויות בחקירה · נתוני הדגמה</div></div>
        <span class="grow"></span>
        <a href="#/explore/floors/${t.id}"><sw-button icon="live">חזרה ל־Live</sw-button></a>
      </div>
      <div class="bar">
        <sw-badge kind="historic"></sw-badge>
        <span class="time">2026-09-14 ${tt(this.minute)}</span>
        <input type="range" min="0" max="1439" .value=${String(this.minute)} @input=${e=>this.minute=Number(e.target.value)} aria-label="זמן" />
        <sw-chip @click=${()=>this.minute=Math.max(0,this.minute-60)}>-1 שעה</sw-chip><sw-chip @click=${()=>this.minute=Math.min(1439,this.minute+60)}>+1 שעה</sw-chip>
        <span class="grow"></span>
        <span style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">גרסת מפה 3 (תקפה מ־01.09)</span>
      </div>
      <div class="stage alone">
        <sw-plan-canvas .planWidth=${t.planWidth} .planHeight=${t.planHeight} .plan=${Nt(t.id)} .markers=${this.demoMarkers}></sw-plan-canvas>
        <div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = לא ידוע / פער</span><span>ישות: מצב ידוע אחרון</span></div>
      </div>
    `}render(){return H()?this.scrub?this.renderScrub():this.renderApi():this.renderDemo()}};f.styles=[Tt,gt`
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
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
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
      padding: 8px 12px;
      background: var(--sw-recorded-soft);
      border: 1px solid #cddcff;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      flex-wrap: wrap;
    }
    .time {
      font-family: var(--sw-font-mono);
      direction: ltr;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-accent-text);
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
      box-shadow: var(--sw-shadow-1);
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
      color: var(--sw-text-2);
    }
    .chip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 5px 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
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
      font-weight: var(--sw-fw-semibold);
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
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    dd {
      margin: 0;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
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
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      text-decoration: none;
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    .evl a:active {
      transform: scale(var(--sw-press-scale));
    }
    .evl a.hit {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .evl .s {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
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
    .lyr .sw {
      position: relative;
      inline-size: 30px;
      block-size: 18px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-unknown);
      border: 0;
      cursor: pointer;
      flex: none;
      padding: 0;
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    .lyr .sw::after {
      content: '';
      position: absolute;
      inset-block-start: 2px;
      inset-inline-start: 2px;
      inline-size: 14px;
      block-size: 14px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .lyr .sw[aria-checked='true'] {
      background: var(--sw-accent);
    }
    .lyr .sw[aria-checked='true']::after {
      transform: translateX(-12px);
    }
    .lyr .sw:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: default;
    }
    .lyr .sw:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: 2px;
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
    .seg {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
    }
    .seg button {
      padding: 3px 10px;
      border-radius: calc(var(--sw-r-sm) - 2px);
      color: var(--sw-text-2);
      cursor: pointer;
      font: inherit;
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      border: 0;
      background: transparent;
      min-block-size: 24px;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-thumb, var(--sw-surface-solid, var(--sw-surface)));
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
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
      margin-left: calc(var(--sw-lanes-label-w) + 8px);
      margin-block-start: 4px;
    }
    .track .rangenote {
      direction: rtl;
      font-size: var(--sw-fs-xs);
      color: var(--sw-warning-text);
      padding-block-end: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .lyr .sw,
      .lyr .sw::after {
        transition: none;
      }
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
      .lyr .sw {
        inline-size: 26px;
        block-size: 16px;
      }
      .lyr .sw::after {
        inline-size: 12px;
        block-size: 12px;
      }
      .lyr .sw[aria-checked='true']::after {
        transform: translateX(-10px);
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
  `,Rt,ae];w([M()],f.prototype,"floorId",2);w([M()],f.prototype,"at",2);w([M()],f.prototype,"camera",2);w([b()],f.prototype,"minute",2);w([b()],f.prototype,"tz",2);w([b()],f.prototype,"date",2);w([b()],f.prototype,"tree",2);w([b()],f.prototype,"bundle",2);w([b()],f.prototype,"events",2);w([b()],f.prototype,"recordings",2);w([b()],f.prototype,"selectedId",2);w([b()],f.prototype,"loading",2);w([b()],f.prototype,"error",2);w([b()],f.prototype,"frameAt",2);w([b()],f.prototype,"frameFailed",2);w([b()],f.prototype,"casePick",2);w([b()],f.prototype,"geometry",2);w([b()],f.prototype,"level",2);w([b()],f.prototype,"catalogLookup",2);w([b()],f.prototype,"planImage",2);w([b()],f.prototype,"view3d",2);w([b()],f.prototype,"threeState",2);w([b()],f.prototype,"threeError",2);w([b()],f.prototype,"preset3d",2);w([b()],f.prototype,"catalog3d",2);w([b()],f.prototype,"real3d",2);w([b()],f.prototype,"scrub",2);w([b()],f.prototype,"switches",2);w([b()],f.prototype,"snapshot",2);w([b()],f.prototype,"snapLoading",2);w([b()],f.prototype,"snapError",2);w([b()],f.prototype,"range",2);w([b()],f.prototype,"rangeNote",2);w([b()],f.prototype,"mode",2);w([b()],f.prototype,"playing",2);w([b()],f.prototype,"speed",2);w([b()],f.prototype,"winMinutes",2);w([b()],f.prototype,"winStart",2);w([b()],f.prototype,"detailsOpen",2);w([b()],f.prototype,"playMs",2);w([b()],f.prototype,"stateMs",2);f=w([bt("investigate-history-map")],f);export{f as InvestigateHistoryMap};
//# sourceMappingURL=investigate-history-map-Mu2RUwbr.js.map
