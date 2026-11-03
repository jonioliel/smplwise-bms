import{E as Z,F as S,a as W,A as c,e as o,H as Y,i as ce,bY as Ds,b7 as X,g as A,bb as mt,j as y,G as h,b5 as Fs,bw as ke,hU as He,C as Re,S as wt,R as ge,P as Bs,yC as St,av as bt,gE as js,uk as Ks,e1 as Us,w as Rt,jr as vs,b8 as Ws,yD as Ys,cK as Gs,yE as Qs,yF as Js,yG as Ce,yH as Ie,iY as Xs,i_ as Ot,j0 as be,dP as Zs,yI as Tt,fo as ea,yJ as ta}from"./index-CHCc2mtA.js";import"./security-alarm-Df7hJhuE.js";import"./system-alarm-zY9qk4kt.js";import{u as ys,p as Ct,d as sa,P as Et,e as Mt,f as Nt,S as aa,R as ra,g as ia,h as na,i as oa,j as la,k as ca}from"./nvr-h264-preset-CWl-CnDx.js";import{F as da,G as ha}from"./access-grants-BQQIh3Qb.js";import{s as xs}from"./status-css-DDw6Lvoa.js";import{s as C,p as Lt,c as Pt}from"./pending-model-Cht6LwLi.js";import"./settings-form-DJX3k3J7.js";import"./sw-logo-art-Va6y_cIM.js";var pa=Object.defineProperty,ua=Object.getOwnPropertyDescriptor,_s=(e,t,s,a)=>{for(var r=a>1?void 0:a?ua(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&pa(t,s,r),r};let De=class extends W{constructor(){super(...arguments),this.model=null,this.cancel=()=>this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=this.model;return o`<sw-dialog ?open=${!!e} heading=${e?.heading??""} data-nvr-confirm-dialog @close=${t=>{t.stopPropagation(),this.cancel()}}>
      ${e?o`<p data-nvr-confirm-lead>${e.lead}</p>
            <p class="count" data-nvr-confirm-count>${e.count}</p>
            <details data-nvr-confirm-details>
              <summary>פרטים</summary>
              ${e.names?o`<ul class="names" data-nvr-confirm-names tabindex="0" aria-label="המצלמות">${e.names.map(t=>o`<li>${t}</li>`)}</ul>`:o`<ul>${e.details.map(t=>o`<li data-field=${t.field}><span class="k">${t.label}</span><bdi>${t.from}</bdi><span class="arrow" aria-hidden="true">←</span><bdi>${t.to}</bdi></li>`)}</ul>`}
            </details>
            ${e.extraLabel?o`<div class="extra"><sw-button variant="ghost" size="sm" data-nvr-extra @click=${()=>this.dispatchEvent(new CustomEvent("extra",{bubbles:!0,composed:!0}))}>${e.extraLabel}</sw-button></div>`:c}
            <sw-button slot="footer" variant="ghost" data-nvr-cancel @click=${this.cancel}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-confirm @click=${()=>this.dispatchEvent(new CustomEvent("confirm",{bubbles:!0,composed:!0}))}>${e.confirmLabel}</sw-button>`:c}
    </sw-dialog>`}};De.styles=Z`
    :host {
      display: contents;
    }
    p {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .count {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
    details {
      font-size: var(--sw-fs-sm);
    }
    summary {
      cursor: pointer;
      color: var(--sw-accent-text);
      min-block-size: 32px;
      display: flex;
      align-items: center;
    }
    summary:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
      border-radius: var(--sw-r-2xs);
    }
    ul {
      list-style: none;
      margin: 4px 0 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }
    .extra {
      display: flex;
      justify-content: flex-start;
    }
    /* a multi-camera change lists every camera: hundreds scroll inside the list, the dialog keeps its size */
    ul.names {
      max-block-size: min(36dvh, 240px);
      overflow: auto;
      overscroll-behavior: contain;
    }
    ul.names li {
      display: block;
      overflow-wrap: anywhere;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: baseline;
    }
    li .k {
      color: var(--sw-text-3);
    }
    bdi {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .arrow {
      color: var(--sw-text-3);
    }
    /* R5-LIVE-297 (the HOMEFABLE type scale in the one confirmation): the lead line 14 px in the reading ink, the number of changes a
       WELL with a 17 px bold line - the one thing the owner must read before he presses - and the change list as wells */
    p {
      font-size: var(--sw-fs-md);
      line-height: 1.45;
    }
    .count {
      padding: 10px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-heading);
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.01em;
    }
    summary {
      font-weight: var(--sw-fw-semibold);
    }
    ul:not(.names) li {
      padding: 7px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    /* R5-LIVE-297 Fable pass (the Opus count well sat in the dialog's own grey): the number of changes is a 20 px / 800 line in a
       14 % accent field with a 4 px accent bar - the one thing read before the press; the lead 15 px in the reading ink */
    p {
      font-size: var(--sw-fs-lg);
      color: var(--sw-text);
    }
    .count {
      padding: 12px 16px;
      border-radius: var(--sw-r-lg);
      background: color-mix(in srgb, var(--sw-accent) 14%, var(--sw-surface));
      box-shadow: inset -4px 0 0 var(--sw-accent); /* the start edge in RTL (offsets are physical) */
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    :host-context([dir='ltr']) .count {
      box-shadow: inset 4px 0 0 var(--sw-accent);
    }
    summary {
      font-size: var(--sw-fs-md);
      min-block-size: 36px;
    }
    ul:not(.names) li {
      font-size: var(--sw-fs-md);
      padding: 9px 14px;
    }
  `;_s([S({attribute:!1})],De.prototype,"model",2);De=_s([Y("nvr-confirm")],De);function fa(e){if(!e||typeof e!="object")return null;const t=e,s="options"in t&&!Array.isArray(t.codec)?t.options:t;if(!ma(s))return null;const a=s;return a.locks?a:{...a,locks:{}}}const Ee=e=>Array.isArray(e),xe=e=>!!e&&typeof e=="object"&&!Array.isArray(e),It=e=>e==null||xe(e)&&typeof e.min=="number"&&typeof e.max=="number";function ma(e){if(!xe(e))return!1;const t=e;return Ee(t.codec)&&xe(t.profile)&&xe(t.resolution)&&Ee(t.fps)&&Ee(t.bitrate_mode)&&Ee(t.quality)&&It(t.bitrate_kbps)&&It(t.gop)&&(t.locks===void 0||xe(t.locks))}const J=encodeURIComponent,wa={recorders:()=>A("nvr/recorders"),cameras:e=>A(`nvr/cameras${e?`?recorder_id=${J(e)}`:""}`),camera:e=>A(`nvr/cameras/${J(e)}`),options:async(e,t,s)=>fa(await A(`nvr/cameras/${J(e)}/streams/${J(t)}/options${s?`?codec=${J(s)}`:""}`)),writeStream:(e,t,s)=>mt(`nvr/cameras/${J(e)}/streams/${J(t)}`,s),changes:(e,t=30)=>A(`nvr/changes?camera_id=${J(e)}&limit=${t}`),undo:e=>X(`nvr/changes/${J(e)}/rollback`,{confirm:!0}),addChannel:(e,t)=>X(`nvr/recorders/${J(e)}/channels`,t),removeChannel:(e,t)=>Ds(`nvr/cameras/${J(e)}/channel`,{method:"DELETE",body:JSON.stringify({confirm_name:t})})};function $s(e){if(!e.codec)return["unknown","codec_unknown"];if(e.codec==="H.265")return["unknown","h265"];if(e.codec==="MJPEG")return["no","mjpeg"];if(e.codec!=="H.264")return["unknown","codec_other"];if(e.b_frames===!0)return["no","b_frames"];if(e.svc===!0)return["unknown","svc"];const t=(e.profile??"").toLowerCase();return e.b_frames===!1||t.startsWith("baseline")||t.startsWith("bp")||t.startsWith("constrained")?["ok","h264_no_b_frames"]:["ok","h264"]}const F=e=>JSON.parse(JSON.stringify(e)),Me={recorder_id:"nvr-1",name:"NVR ראשי",vendor:"hikvision",model:"DS-7616NI-DEMO",firmware:"V4.84 demo",enabled:!0,online:!0,checked_at:"2026-10-01T09:00:00Z",error:null,capabilities:{read_encodings:!0,write_encodings:!0,add_channel:!0,remove_channel:!0,max_channels:16,used_channels:4,encoding_fields:["codec","profile","resolution","fps","bitrate_mode","bitrate_kbps","quality","gop","svc","smart_codec"]}},ks={codec:["H.264","H.265"],profile:{"H.264":["Baseline","Main","High"],"H.265":["Main"]},resolution:{"H.264":["2560x1440","1920x1080","1280x720"],"H.265":["2560x1440","1920x1080"]},fps:[25,20,15,12,10,8,6,4,2,1],fps_full:!0,bitrate_mode:["CBR","VBR"],bitrate_kbps:{min:32,max:8192},quality:[10,30,45,60,75,90],gop:{min:1,max:400},svc:!0,smart_codec:!0,b_frames:!1,locks:{smart_codec:["gop","bitrate_mode","quality"]},source:"capabilities"},ba={...ks,resolution:{"H.264":["640x360","640x480","352x288"],"H.265":["640x360","640x480"]},bitrate_kbps:{min:32,max:2048},smart_codec:!1,locks:{}};function re(e,t,s){const a={stream_ref:e,role:t,enabled:!0,codec:"H.264",codec_raw:"H.264",codec_plus:!1,profile:null,resolution:"1920x1080",fps:25,fps_full:!1,bitrate_mode:"VBR",bitrate_kbps:2048,quality:60,gop:50,svc:null,smart_codec:!1,b_frames:null,webrtc:"unknown",webrtc_reason:"codec_unknown",fields:{b_frames:{supported:!1,editable:!1}},writable:!0,not_writable_reason:null,etag:`${e}-1`,...s};return a.svc===null&&(a.fields.svc={supported:!1,editable:!1}),[a.webrtc,a.webrtc_reason]=$s(a),a.codec_plus=a.smart_codec===!0||String(a.codec_raw??"").endsWith("+"),a}function ga(){const e=(s,a,r,i={})=>({camera_id:`demo-cam-${s}`,recorder_id:"nvr-1",source_ref:String(s),channel:s,name:a,online:!0,enabled_in_arx:!0,streams:r,error:null,...i}),t=s=>re(`${s}02`,"sub",{resolution:"640x360",fps:20,bitrate_kbps:1024});return[e(1,"כניסה",[re("101","main",{resolution:"2560x1440",fps:null,fps_full:!0,bitrate_kbps:3072,svc:!0}),t(1)]),e(2,"חניה",[re("201","main",{resolution:"2560x1440",fps:null,fps_full:!0,bitrate_kbps:3072,svc:!0}),t(2)]),e(3,"חצר אחורית",[re("301","main",{codec:"H.265",codec_raw:"H.265",profile:"Main",resolution:"2560x1440",bitrate_kbps:2048,svc:!1}),re("302","sub",{codec:"H.265",codec_raw:"H.265",profile:"Main",resolution:"640x360",fps:20,bitrate_kbps:512,svc:!0,smart_codec:!0}),re("303","third",{resolution:"1280x720",fps:12,bitrate_kbps:1024})]),e(4,"מחסן",[re("401","main",{resolution:"1920x1080",svc:!1,profile:"High"}),t(4)],{online:!1})]}function z(e,t,s,a={}){throw new y(e,{code:t,user_message:s,retryable:!1,correlation_id:"demo",details:a})}const qt={codec:"קידוד",profile:"פרופיל",resolution:"רזולוציה",fps:"FPS",bitrate_mode:"סוג קצב",bitrate_kbps:"קצב",quality:"איכות",gop:"GOP",svc:"SVC",smart_codec:"Smart codec",b_frames:"B-frames"};class va{constructor(){this.cameras_=ga(),this.changes_=[],this.seq=0}find(t){return this.cameras_.find(s=>s.camera_id===t)??z(404,"not_found","המצלמה לא נמצאה.")}optionsOf(t){return F(t.role==="main"?ks:ba)}async recorders(){return{recorders:[{...F(Me),capabilities:{...Me.capabilities,used_channels:this.cameras_.length}}],can_write:!0}}async cameras(t){return{cameras:F(this.cameras_.filter(s=>!t||s.recorder_id===t)),recorders_failed:[],stale:!1,can_write:!0}}async camera(t){const s=this.find(t);return{camera:F(s),can_write:!0,options:Object.fromEntries(s.streams.map(a=>[a.stream_ref,this.optionsOf(a)]))}}async options(t,s,a){const r=this.find(t).streams.find(n=>n.stream_ref===s)??z(404,"not_found","הזרם לא נמצא."),i=this.optionsOf(r);return a&&!i.codec.includes(a)&&z(422,"value_not_allowed","הערך אינו נתמך במצלמה.",{field:"codec",allowed:i.codec}),i}async writeStream(t,s,a){const r=this.find(t),i=r.streams.find(v=>v.stream_ref===s)??z(404,"not_found","הזרם לא נמצא.");a.confirm!==!0&&z(422,"confirm_required","נדרש אישור."),a.if_match!==i.etag&&z(409,"stale","הערכים השתנו ב־NVR. נטען מחדש.",{stream:F(i)}),r.online===!1&&z(503,"source_unavailable","המצלמה אינה זמינה כרגע.");const n=this.optionsOf(i),l=a.changes,p=Object.keys(l);p.length||z(422,"validation","אין מה לשנות.");const d=l.codec??i.codec??"H.264",m=(v,Oe,Te)=>{Oe||z(422,"value_not_allowed","הערך אינו נתמך במצלמה.",{field:v,allowed:Te??[]})};for(const v of p)i.fields[v]?.supported===!1&&z(422,"field_not_supported",`${qt[v]} אינו נתמך בזרם הזה.`,{field:v});l.codec!==void 0&&m("codec",n.codec.includes(l.codec),n.codec),l.profile!==void 0&&m("profile",(n.profile[d]??[]).includes(l.profile),n.profile[d]),l.resolution!==void 0&&m("resolution",(n.resolution[d]??[]).includes(l.resolution),n.resolution[d]),l.fps!==void 0&&m("fps",l.fps==="full"?n.fps_full:n.fps.includes(l.fps),n.fps),l.bitrate_mode!==void 0&&m("bitrate_mode",n.bitrate_mode.includes(l.bitrate_mode),n.bitrate_mode),l.bitrate_kbps!==void 0&&m("bitrate_kbps",l.bitrate_kbps>=n.bitrate_kbps.min&&l.bitrate_kbps<=n.bitrate_kbps.max,[n.bitrate_kbps.min,n.bitrate_kbps.max]),l.quality!==void 0&&m("quality",(l.bitrate_mode??i.bitrate_mode)==="VBR"&&n.quality.includes(l.quality),n.quality),l.gop!==void 0&&m("gop",l.gop>=n.gop.min&&l.gop<=n.gop.max,[n.gop.min,n.gop.max]),l.svc!==void 0&&m("svc",n.svc),l.smart_codec!==void 0&&m("smart_codec",n.smart_codec),l.b_frames!==void 0&&z(422,"field_not_supported","B-frames אינו נתמך בזרם הזה.",{field:"b_frames"});const f=l.smart_codec??i.smart_codec;for(const v of f?n.locks.smart_codec??[]:[])v in l&&v!=="smart_codec"&&z(422,"field_locked",`${qt[v]} נעול כש־Smart codec פעיל.`,{field:v,locked_by:"smart_codec"});const $=F(i),k=[],E=[],Q=(v,Oe,Te)=>{i[Oe]===Te?E.push(v):(i[Oe]=Te,k.push(v))};if(l.codec!==void 0&&(Q("codec","codec",l.codec),i.codec_raw=l.codec,l.profile===void 0&&(i.profile=null)),l.profile!==void 0&&Q("profile","profile",l.profile),l.resolution!==void 0&&Q("resolution","resolution",l.resolution),l.fps!==void 0){const v=l.fps==="full";i.fps_full===v&&(v||i.fps===l.fps)?E.push("fps"):([i.fps_full,i.fps]=[v,v?null:l.fps],k.push("fps"))}l.bitrate_mode!==void 0&&Q("bitrate_mode","bitrate_mode",l.bitrate_mode),l.bitrate_kbps!==void 0&&Q("bitrate_kbps","bitrate_kbps",l.bitrate_kbps),l.quality!==void 0&&Q("quality","quality",l.quality),l.gop!==void 0&&Q("gop","gop",l.gop),l.svc!==void 0&&Q("svc","svc",l.svc),l.smart_codec!==void 0&&Q("smart_codec","smart_codec",l.smart_codec),[i.webrtc,i.webrtc_reason]=$s(i),k.length&&(i.etag=`${i.stream_ref}-${++this.seq+1}`);const kt=`demo-change-${++this.seq}`;if(!k.length)return{change:null,stream:F(i),applied_fields:[],unchanged_fields:E,reboot_required:!1};const Hs=Object.fromEntries(k.map(v=>[v,[$[v],i[v]]])),zt=new Date().toISOString();return this.changes_.push({id:kt,camera_id:t,stream_ref:s,before:$,after:F(i),status:"applied",fields:Hs,created_at:zt}),{change:{id:kt,status:"applied",kind:"stream_encoding",created_at:zt},stream:F(i),applied_fields:k,unchanged_fields:E,reboot_required:!1}}async changes(t,s=30){return{changes:this.changes_.filter(r=>r.camera_id===t).reverse().slice(0,s).map(r=>({id:r.id,status:r.status,kind:"stream_encoding",created_at:r.created_at,camera_id:r.camera_id,stream_ref:r.stream_ref,fields:r.fields}))}}async undo(t){const s=this.changes_.find(p=>p.id===t)??z(404,"not_found","השינוי לא נמצא.");s.status!=="applied"&&z(409,"not_rollbackable","אין לשינוי הזה מסמך קודם להחזיר.",{status:s.status});const a=this.find(s.camera_id),r=a.streams.findIndex(p=>p.stream_ref===s.stream_ref);(r<0||a.streams[r].etag!==s.after.etag)&&z(409,"stale","הערכים השתנו ב־NVR. נטען מחדש."),a.streams[r]={...F(s.before),etag:`${s.stream_ref}-${++this.seq+1}`},s.status="rolled_back";const i=`demo-change-${++this.seq}`,n=new Date().toISOString(),l=Object.fromEntries(Object.entries(s.fields).map(([p,d])=>[p,[d[1],d[0]]]));return this.changes_.push({id:i,camera_id:s.camera_id,stream_ref:s.stream_ref,before:s.after,after:F(a.streams[r]),status:"applied",fields:l,created_at:n}),{change:{id:i,status:"applied",kind:"stream_encoding",created_at:n},stream:F(a.streams[r]),rollback_of:t,reboot_required:!1}}async addChannel(t,s){t!==Me.recorder_id&&z(404,"not_found","ה־NVR לא נמצא."),s.confirm!==!0&&z(422,"confirm_required","נדרש אישור."),(!s.name.trim()||!s.address.trim()||!s.username.trim()||!s.password)&&z(422,"validation","חסרים פרטים.");const a=new Set(this.cameras_.map(l=>l.channel)),r=Me.capabilities.max_channels??0;let i=1;for(;a.has(i);)i++;return i>r&&z(409,"channel_slots_full","אין ערוץ פנוי ב־NVR."),this.cameras_.push({camera_id:`demo-cam-${i}`,recorder_id:t,source_ref:String(i),channel:i,name:s.name.trim(),online:!0,enabled_in_arx:!0,error:null,streams:[re(`${i}01`,"main",{svc:!1}),re(`${i}02`,"sub",{resolution:"640x360",fps:20,bitrate_kbps:1024})]}),{change:{id:`demo-change-${++this.seq}`,status:"applied",kind:"channel_add",created_at:new Date().toISOString()},channel:{source_ref:String(i),name:s.name.trim(),online:!0},discovery:"queued"}}async removeChannel(t,s){const a=this.find(t);s.trim()!==a.name&&z(422,"confirm_required","השם אינו תואם."),this.cameras_=this.cameras_.filter(r=>r.camera_id!==t)}}let ya=null;const pe=()=>ce()?wa:ya??=new va,K="—",j={main:"ראשי",sub:"משני",third:"שלישי",other:"נוסף"},it={main:0,sub:1,third:2,other:3};function xa(e){const t=[];for(const s of e){const a={cameraKey:`${s.recorder_id}:${s.source_ref}`,recorderId:s.recorder_id,cameraId:s.camera_id,channel:s.channel,cameraName:s.name,online:s.online,enabledInArx:s.enabled_in_arx,error:s.error};s.streams.length||t.push({...a,key:`${a.cameraKey}:none`,stream:null});for(const r of s.streams)t.push({...a,key:`${a.cameraKey}:${r.stream_ref}`,stream:r})}return t}function _e(e){return!e||!e.codec?K:e.codec_plus&&(e.codec==="H.264"||e.codec==="H.265")?`${e.codec}+`:e.codec}const _a=e=>e?.codec==="H.265";function nt(e){return e?.resolution?e.resolution.replace(/x/i,"×"):K}function At(e){return e?e.fps_full?"מלא":e.fps===null||e.fps===void 0?K:String(Number.isInteger(e.fps)?e.fps:Number(e.fps.toFixed(2))):K}function Vt(e){return e?.bitrate_kbps?`${e.bitrate_kbps} kbps`:K}function $a(e){return e?.svc===!0?"פעיל":e?.svc===!1?"כבוי":K}const Ht={ok:"מתנגן בדפדפן",no:"לא מתנגן בדפדפן",unknown:"לא ידוע"};function Dt(e){return e==null?K:String(e)}const Ue={q:"",codec:"",role:"",svc:"",webrtc:""},Ft=e=>!!(e.q.trim()||e.codec||e.role||e.svc||e.webrtc);function ka(e){const t=e.stream;return[e.cameraName,`ערוץ ${e.channel}`,String(e.channel),t?j[t.role]:"",t?t.role:"",_e(t),t?.codec_raw??"",t?.profile??"",nt(t),t?.resolution??"",t?.bitrate_mode??"",t?.stream_ref??"",t?.svc===!0?"svc":""].join(" ").toLowerCase()}function za(e,t){let s=t.toLowerCase();const a=[...s.matchAll(/ערוץ\s*(\d+)/g)].map(n=>Number(n[1]));if(s=s.replace(/ערוץ\s*\d+/g," "),a.length&&!a.includes(e.channel))return!1;const r=s.split(/\s+/).filter(Boolean);if(!r.length)return!0;const i=ka(e);return r.every(n=>i.includes(n))}function Sa(e,t){return e.filter(s=>{const a=s.stream;if(!za(s,t.q))return!1;if(t.codec){const r=a?.codec==="H.264"?"h264":a?.codec==="H.265"?"h265":"other";if(!a||r!==t.codec)return!1}if(t.role){const r=a?.role==="main"||a?.role==="sub"?a.role:"other";if(!a||r!==t.role)return!1}if(t.svc){const r=a?.svc===!0?"on":a?.svc===!1?"off":"none";if(!a||r!==t.svc)return!1}return!(t.webrtc&&(!a||a.webrtc!==t.webrtc))})}const zs={key:"channel",dir:"asc"},Ra={no:0,unknown:1,ok:2};function Bt(e,t){const s=e.stream;switch(t){case"channel":return e.channel;case"camera":return e.cameraName;case"role":return s?it[s.role]:null;case"codec":return s?.codec?_e(s):null;case"svc":return s?.svc===!0?1:s?.svc===!1?0:null;case"resolution":{const a=/^(\d+)x(\d+)$/i.exec(s?.resolution??"");return a?Number(a[1])*Number(a[2]):null}case"fps":return s?s.fps_full?Number.MAX_SAFE_INTEGER:s.fps??null:null;case"bitrate":return s?.bitrate_kbps??null;case"gop":return s?.gop??null;case"webrtc":return s?Ra[s.webrtc]??1:null}}function Oa(e,t=zs){const s=t.dir==="desc"?-1:1,a=new Intl.Collator("he",{numeric:!0,sensitivity:"base"}),r=(i,n)=>i.channel-n.channel||(i.stream?it[i.stream.role]:9)-(n.stream?it[n.stream.role]:9)||(i.stream?.stream_ref??"").localeCompare(n.stream?.stream_ref??"");return[...e].sort((i,n)=>{const l=Bt(i,t.key),p=Bt(n,t.key);if(l===null&&p===null)return r(i,n);if(l===null)return 1;if(p===null)return-1;const d=typeof l=="number"&&typeof p=="number"?l-p:a.compare(String(l),String(p));return d?d*s:r(i,n)})}function Ta(e,t){return e.key===t?{key:t,dir:e.dir==="asc"?"desc":"asc"}:{key:t,dir:"asc"}}function Ca(e){const t=new Set;let s=0,a=0;for(const r of e)t.add(r.cameraKey),r.stream&&(s++,r.stream.webrtc==="no"&&a++);return{cameras:t.size,streams:s,notWebrtc:a}}function Ea(e,t){return t===0||e[t-1].cameraKey!==e[t].cameraKey}const w={codec:"קידוד",profile:"פרופיל",resolution:"רזולוציה",fps:"FPS",bitrate_mode:"סוג קצב",bitrate_kbps:"קצב",quality:"איכות",gop:"GOP",svc:"SVC",smart_codec:"Smart codec",b_frames:"B-frames"},ve={show:!1,enabled:!1,reason:""},N={read_only:"השינוי אינו זמין",not_supported:"ה־NVR אינו תומך בשינוי הזרם הזה",capabilities_unreadable:"יכולות הזרם אינן ידועות",proxied:"ה־NVR אינו מאפשר לשנות את הזרם הזה",offline:"המצלמה אינה מקוונת",stale:"ה־NVR אינו זמין",detail_error:"ה־NVR אינו זמין",no_options:"יכולות הזרם אינן ידועות",device_refused:"ה־NVR אינו מעביר שינויים למצלמה הזו",write_api_missing:"ה־NVR אינו תומך בשינוי הגדרות זרם",no_caps:"יכולות הזרם אינן ידועות",writes_disabled:"כתיבה ל־NVR הזה כבויה"},Ss=e=>e?N[e]??N.no_options:N.read_only;function Ma(e,t,s,a){if(!s||!a.canWrite||!t.camera_id||e==="svc"&&s.svc===null||a.detail===null)return ve;if(a.stale)return{show:!0,enabled:!1,reason:N.stale};if(a.detail==="error")return{show:!0,enabled:!1,reason:N.detail_error};if(a.detail.stale)return{show:!0,enabled:!1,reason:N.stale};if(a.detail.can_write===!1)return ve;const r=a.detail.camera.streams.find(n=>n.stream_ref===s.stream_ref)??s;if(r.writable===!1)return{show:!0,enabled:!1,reason:Ss(r.not_writable_reason)};if(r.writable!==!0)return ve;if(t.online===!1)return{show:!0,enabled:!1,reason:N.offline};const i=a.detail.options?.[s.stream_ref];return i?e==="svc"&&!i.svc?{show:!0,enabled:!1,reason:N.not_supported}:s.etag===null?{show:!0,enabled:!1,reason:N.stale}:{show:!0,enabled:!0,reason:""}:{show:!0,enabled:!1,reason:N.no_options}}function ie(e,t){return t==null||t===""?K:typeof t=="boolean"?t?"פעיל":"כבוי":e==="fps"?t==="full"||t===0?"מלא":String(t):e==="resolution"?String(t).replace(/x/i,"×"):e==="bitrate_kbps"?`${t} kbps`:String(t)}const ot=e=>e===1?"שינוי אחד":`${e} שינויים`;function Na(e,t){return t==="fps"?e.fps_full?"full":e.fps:e[t]}function Rs(e,t,s){const a=Object.keys(s).filter(l=>s[l]!==void 0),r=a.length===1?a[0]:null,i=`${e} · ${j[t.role]}. השידור ייקטע לכמה שניות.`,n=a.map(l=>({field:l,label:w[l],from:ie(l,Na(t,l)),to:ie(l,s[l])}));if(r==="svc"){const l=s.svc===!0;return{heading:l?"להפעיל SVC?":"לכבות SVC?",lead:i,count:ot(1),confirmLabel:l?"הפעל":"כבה",details:n}}return{heading:"לשמור את השינויים?",lead:i,count:ot(a.length),confirmLabel:"שמור",details:n}}const La=e=>e.code==="source_unavailable"&&e.details?.outcome==="unknown",jt={stale:"הערכים השתנו ב־NVR. נטען מחדש.",write_in_progress:"שינוי אחר של הזרם הזה מתבצע. נסו שוב בעוד רגע.",batch_in_progress:"מתבצע שינוי מרובה",nvr_busy:"ה־NVR עסוק. נסו שוב בעוד רגע.",nvr_no_effect:"ה־NVR אישר את השינוי אבל לא שינה את ההגדרה.",nvr_diverged:"ה־NVR שינה רק חלק מההגדרות. נטען מחדש.",nvr_not_supported:"ה־NVR אינו תומך בשינוי הזה.",nvr_rejected:"ה־NVR דחה את השינוי.",capabilities_unreadable:"יכולות הזרם אינן ידועות, ולכן השינוי בוטל.",confirm_required:"נדרש אישור.",value_not_allowed:"הערך אינו נתמך במצלמה.",field_locked:"השדה נעול כרגע.",field_not_supported:"השדה אינו נתמך בזרם הזה.",not_rollbackable:"אי אפשר לבטל את השינוי הזה.",forbidden:"אין הרשאה לפעולה הזו.",source_unavailable:"ה־NVR אינו זמין.",source_forbidden:"ל־NVR אין הרשאה לשינוי הזה."};function Fe(e){if(La(e))return{text:"הסטטוס נבדק",reload:!0};const t=e.code==="stale"||e.code==="nvr_diverged";return e.code==="value_not_allowed"&&typeof e.details?.codec=="string"&&e.user_message?{text:e.user_message,reload:t}:e.code==="value_not_allowed"&&typeof e.details?.field=="string"&&e.details.field in w?{text:`${w[e.details.field]}: ${jt.value_not_allowed}`,reload:t}:{text:jt[e.code]??(e.user_message||"השינוי לא נשמר."),reload:t}}const oe=e=>e==null?"":String(e);function gt(e){return{codec:oe(e.codec),profile:oe(e.profile),resolution:oe(e.resolution),fps:e.fps_full?"full":oe(e.fps),bitrate_mode:oe(e.bitrate_mode),bitrate_kbps:oe(e.bitrate_kbps),quality:oe(e.quality),gop:oe(e.gop),svc:e.svc,smart_codec:e.smart_codec}}const lt=e=>/^\d{1,7}$/.test(e.trim())?Number(e):null;function vt(e,t,s){const a=s.codec||e.codec||"",r=n=>e.fields[n]?.supported!==!1,i=[];return r("codec")&&t.codec.length&&i.push("codec"),r("profile")&&(t.profile[a]??[]).length&&i.push("profile"),r("resolution")&&(t.resolution[a]??[]).length&&i.push("resolution"),r("fps")&&(t.fps.length||t.fps_full)&&i.push("fps"),r("bitrate_mode")&&t.bitrate_mode.length&&i.push("bitrate_mode"),r("bitrate_kbps")&&t.bitrate_kbps&&i.push("bitrate_kbps"),r("quality")&&t.quality.length&&i.push("quality"),r("gop")&&t.gop&&i.push("gop"),r("svc")&&t.svc&&e.svc!==null&&i.push("svc"),r("smart_codec")&&t.smart_codec&&e.smart_codec!==null&&i.push("smart_codec"),i}function yt(e,t,s,a){if(t.fields[e]?.editable===!1)return t.fields[e]?.locked_by??e;for(const[r,i]of Object.entries(s.locks))if(i?.includes(e)&&e!==r&&a[r]===!0)return r;return e==="quality"&&a.bitrate_mode!=="VBR"?"bitrate_mode":null}function We(e,t,s){const a=[],r=s.codec||e.codec||"",i=gt(e);for(const n of vt(e,t,s))if(!yt(n,e,t,s)&&!(s.codec===i.codec&&n in i&&s[n]===i[n]))switch(n){case"codec":t.codec.includes(s.codec)||a.push(n);break;case"profile":(t.profile[r]??[]).includes(s.profile)||a.push(n);break;case"resolution":(t.resolution[r]??[]).includes(s.resolution)||a.push(n);break;case"fps":(s.fps==="full"?!t.fps_full:!t.fps.includes(Number(s.fps)))&&a.push(n);break;case"bitrate_mode":t.bitrate_mode.includes(s.bitrate_mode)||a.push(n);break;case"bitrate_kbps":{const l=lt(s.bitrate_kbps);(l===null||l<t.bitrate_kbps.min||l>t.bitrate_kbps.max)&&a.push(n);break}case"quality":t.quality.includes(Number(s.quality))||a.push(n);break;case"gop":{const l=lt(s.gop);(l===null||l<t.gop.min||l>t.gop.max)&&a.push(n);break}}return a}function Kt(e,t,s){const a={},r=gt(e);for(const i of vt(e,t,s))if(!yt(i,e,t,s))switch(i){case"codec":case"profile":case"resolution":case"bitrate_mode":s[i]&&s[i]!==r[i]&&(a[i]=s[i]);break;case"fps":s.fps&&s.fps!==r.fps&&(a.fps=s.fps==="full"?"full":Number(s.fps));break;case"bitrate_kbps":case"quality":case"gop":{const n=lt(s[i]);n!==null&&s[i]!==r[i]&&(a[i]=n);break}case"svc":case"smart_codec":s[i]!==null&&s[i]!==r[i]&&(a[i]=s[i]);break}return a}function Pa(e,t){const s=e.codec,a={...e};return(t.profile[s]??[]).includes(a.profile)||(a.profile=""),(t.resolution[s]??[]).includes(a.resolution)||(a.resolution=""),a}function Ia(e){let t=e.fields;if(t==null)try{t=e.fields_json?JSON.parse(e.fields_json):null}catch{t=null}if(!t||typeof t!="object"||Array.isArray(t))return[];const s=[];for(const[a,r]of Object.entries(t))Array.isArray(r)&&r.length===2?s.push({field:a,from:ie(a,r[0]),to:ie(a,r[1])}):r&&typeof r=="object"&&"to"in r&&s.push({field:a,from:ie(a,r.from),to:ie(a,r.to)});return s}const qa=e=>w[e]??e,Aa={pending:"בתהליך",applied:"נשמר",unchanged:"ללא שינוי",no_effect:"לא נקלט",refused:"נדחה",failed:"נכשל",diverged:"נשמר חלקית",rolled_back:"בוטל"};function Va(e,t,s=5){return e.filter(a=>a.kind==="stream_encoding"&&a.stream_ref===t).sort((a,r)=>a.created_at<r.created_at?1:a.created_at>r.created_at?-1:0).slice(0,s)}function Ha(e){const t=e[0];return t&&(t.status==="applied"||t.status==="diverged")?t:null}function Da(e,t){return e instanceof y?{status:e.status,code:e.code,user_message:e.body.user_message,details:e.body.details??{}}:t?{status:0,code:"source_unavailable",details:{outcome:"unknown"}}:{status:0,code:"network",user_message:"אין חיבור לשרת."}}function ct(e,t){const s=Da(e,t),a=s.code==="stale"&&s.details?.stream&&typeof s.details.stream=="object"?s.details.stream:null;return{ok:!1,line:Fe(s),code:s.code,stream:a}}async function Os(e,t,s){if(t.etag===null)return ct(new y(409,{code:"stale",user_message:"",retryable:!1,correlation_id:"",details:{}}),!1);try{const a=await pe().writeStream(e,t.stream_ref,{if_match:t.etag,confirm:!0,changes:s});return{ok:!0,stream:a.stream,change:a.change,rebootRequired:a.reboot_required,kind:"write",unchanged:a.change===null}}catch(a){return ct(a,!0)}}async function Ts(e){try{const t=await pe().undo(e);return{ok:!0,stream:t.stream,change:t.change,rebootRequired:t.reboot_required,kind:"undo",unchanged:!1}}catch(t){return ct(t,!0)}}var Fa=Object.defineProperty,Ba=Object.getOwnPropertyDescriptor,D=(e,t,s,a)=>{for(var r=a>1?void 0:a?Ba(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&Fa(t,s,r),r};const ae={gone:"הזרם אינו זמין כרגע. סגרו את החלונית ופתחו שוב.",loading:"טוען את האפשרויות של הקידוד. נסו שוב בעוד רגע.",no_options:"יכולות הזרם אינן ידועות, ולכן אי אפשר לשמור.",invalid:"יש לבחור ערך תקין",nothing:"אין שינויים לשמירה.",failed:"השינוי לא נשמר. נסו שוב."};let q=class extends W{constructor(){super(...arguments),this.open=!1,this.camera=null,this.stream=null,this.options=null,this.draft=null,this.opts=null,this.optsCodec="",this.loading=!1,this.confirm=null,this.busy=!1,this.line="",this.history=null,this.pending=null,this.hseq=0,this.oseq=0,this.key="",this.save=()=>{try{const e=this.stream,t=this.opts;if(!e||!this.draft||!this.camera?.camera_id)return void(this.line=ae.gone);if(this.loading)return void(this.line=ae.loading);if(!t||!this.optsFit)return void(this.line=ae.no_options);const s=We(e,t,this.draft);if(s.length)return void(this.line=`${ae.invalid}: ${s.map(r=>w[r]).join(", ")}`);const a=Kt(e,t,this.draft);if(!Object.keys(a).length)return void(this.line=ae.nothing);this.line="",this.pending=a,this.confirm=Rs(this.camera.name,e,a)}catch(e){console.error("nvr editor: save failed",e),this.pending=null,this.confirm=null,this.line=ae.failed}},this.close=()=>this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}willUpdate(e){const t=this.stream,s=this.open&&t&&this.camera?`${this.camera.camera_id}:${t.stream_ref}:${t.etag}`:"";if(s!==this.key){const a=!this.key&&!!s;this.key=s,s&&t&&(this.draft=gt(t),this.opts=this.options,this.optsCodec=t.codec??"",this.oseq++,this.loading=!1,a&&(this.line="",this.history=null),this.loadHistory())}else e.has("options")&&this.draft&&t&&this.draft.codec===(t.codec??"")&&(this.opts=this.options,this.optsCodec=t.codec??"")}get optsFit(){return!!this.opts&&!!this.draft&&!this.loading&&this.optsCodec===this.draft.codec}updated(){const e=this.draft;if(e)for(const t of this.renderRoot.querySelectorAll("select[data-f]")){const s=String(e[t.dataset.f]??"");t.value!==s&&(t.value=s)}}async loadHistory(){const e=this.camera,t=this.stream;if(!e?.camera_id||!t)return;const s=++this.hseq;try{const a=await pe().changes(e.camera_id,30);if(s!==this.hseq)return;this.history=Va(a.changes,t.stream_ref,5)}catch{s===this.hseq&&(this.history=[])}}set(e,t){this.draft&&(this.draft={...this.draft,[e]:t},this.line="")}async onCodec(e){const t=this.camera,s=this.stream;if(!this.draft||!t?.camera_id||!s){this.line=ae.gone;return}this.set("codec",e);const a=++this.oseq;this.loading=!0;try{const r=await pe().options(t.camera_id,s.stream_ref,e);if(a!==this.oseq||!this.draft)return;if(!r){this.line=Fe({status:503,code:"capabilities_unreadable"}).text;return}this.opts=r,this.optsCodec=e,this.draft=Pa(this.draft,r)}catch(r){if(a!==this.oseq)return;this.line=Fe({status:r.status??0,code:r.code??"network",user_message:r.message}).text}finally{a===this.oseq&&(this.loading=!1)}}async confirmed(){const e=this.camera,t=this.stream,s=this.pending;if(this.confirm=null,this.pending=null,!e?.camera_id||!t||!s){this.line=ae.gone;return}this.busy=!0,this.line="";try{const a=await Os(e.camera_id,t,s);this.result(a)}catch(a){console.error("nvr editor: write failed",a),this.line=ae.failed}finally{this.busy=!1}}async undo(e){this.busy=!0,this.line="";const t=await Ts(e);this.busy=!1,this.result(t)}result(e){e.ok||(this.line=e.line.text),this.dispatchEvent(new CustomEvent("written",{detail:{result:e},bubbles:!0,composed:!0}))}select(e,t,s,a,r,i){const n=this.draft,l=String(n[e]??"");return o`<label class="f ${r?"bad":""}" data-field=${e}>
      <span class="l">${t}</span>
      <select data-f=${e} aria-label=${t} title=${a??""} ?disabled=${!!a||this.busy} @change=${p=>e==="codec"?void this.onCodec(p.target.value):this.set(e,p.target.value)}>
        ${l===""||!s.includes(l)?o`<option value="" selected disabled>—</option>`:c}
        ${s.map(p=>o`<option value=${p} ?selected=${p===l}>${i?i(p):p}</option>`)}
      </select>
    </label>`}number(e,t,s,a,r,i){const n=this.draft;return o`<label class="f ${i?"bad":""}" data-field=${e}>
      <span class="l">${t}</span>
      <input type="number" inputmode="numeric" min=${s} max=${a} step="1" aria-label=${t} title=${r??""} .value=${n[e]} ?disabled=${!!r||this.busy} @input=${l=>this.set(e,l.target.value)} />
    </label>`}toggle(e,t,s){const a=this.draft;return o`<div class="f sw" data-field=${e}>
      <span class="l">${t}</span>
      <sw-toggle label=${t} labelHidden .checked=${a[e]===!0} ?disabled=${!!s||this.busy} title=${s??""} data-editor-toggle=${e}
        @change=${r=>this.set(e,r.detail.checked)}></sw-toggle>
    </div>`}fields(){const e=this.stream,t=this.opts,s=this.draft,a=new Set(We(e,t,s)),r=s.codec||e.codec||"",i=n=>yt(n,e,t,s)?`${w[n]} נעול`:null;return vt(e,t,s).map(n=>{switch(n){case"codec":return this.select(n,w[n],t.codec,i(n),a.has(n));case"profile":return this.select(n,w[n],t.profile[r]??[],i(n),a.has(n));case"resolution":return this.select(n,w[n],t.resolution[r]??[],i(n),a.has(n),l=>l.replace(/x/i,"×"));case"fps":return this.select(n,w[n],[...t.fps_full?["full"]:[],...t.fps.map(String)],i(n),a.has(n),l=>l==="full"?"מלא":l);case"bitrate_mode":return this.select(n,w[n],t.bitrate_mode,i(n),a.has(n));case"quality":return this.select(n,w[n],t.quality.map(String),i(n),a.has(n));case"bitrate_kbps":return this.number(n,w[n],t.bitrate_kbps.min,t.bitrate_kbps.max,i(n),a.has(n));case"gop":return this.number(n,w[n],t.gop.min,t.gop.max,i(n),a.has(n));case"svc":case"smart_codec":return this.toggle(n,w[n],i(n));default:return c}})}when(e){const t=new Date(e);return Number.isNaN(t.getTime())?"":Fs(t)}renderHistory(){const e=this.history;if(!e||!e.length)return c;const t=Ha(e);return o`<details class="history" data-nvr-history>
      <summary>שינויים אחרונים</summary>
      <ol>${e.map(s=>o`<li data-change=${s.id} data-status=${s.status}>
          <span class="when">${this.when(s.created_at)} · ${Aa[s.status]??s.status}</span>
          <span class="what">${Ia(s).map(a=>o`<span>${qa(a.field)} <bdi>${a.from}</bdi> ← <bdi>${a.to}</bdi></span>`)}</span>
          ${t&&t.id===s.id?o`<sw-button size="sm" data-nvr-undo-change ?disabled=${this.busy} @click=${()=>void this.undo(s.id)}>בטל</sw-button>`:c}
        </li>`)}</ol>
    </details>`}render(){const e=this.stream,t=this.camera,s=this.open&&!!e&&!!t&&!!this.draft&&!!this.opts,a=s?Kt(e,this.opts,this.draft):{},r=Object.keys(a).length>0,i=s?We(e,this.opts,this.draft).length===0:!1;return o`<sw-drawer modal ?open=${this.open} heading=${t?.name??""} subheading=${e?`${j[e.role]}`:""} data-nvr-editor @close=${n=>{n.stopPropagation(),this.close()}}>
      ${s?o`<form @submit=${n=>n.preventDefault()} data-nvr-editor-form aria-busy=${this.busy}>${this.fields()}</form>
            ${this.line?o`<p class="line" role="status" data-nvr-editor-line>${this.line}</p>`:c}
            ${this.renderHistory()}
            <sw-button slot="footer" variant="ghost" data-nvr-editor-cancel @click=${this.close}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-editor-save ?disabled=${!r||!i||this.busy||!this.optsFit} @click=${this.save}>שמור</sw-button>`:c}
      <nvr-confirm .model=${this.confirm} @confirm=${()=>void this.confirmed()} @cancel=${()=>(this.confirm=null,this.pending=null)}></nvr-confirm>
    </sw-drawer>`}};q.styles=Z`
    :host {
      display: contents;
      --r5-drawer-ms: var(--sw-spring-drawer-ms);
    }
    /* R5-LIVE-297 (emil-design-eng: a panel lands in 200-400 ms): the Arx skins' drawer travel is 630 ms, long for a form opened
       from a table row; this drawer clamps it to 380 ms and keeps every faster skin's own value */
    sw-drawer {
      --sw-spring-drawer-ms: clamp(200ms, var(--r5-drawer-ms), 380ms);
    }
    form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    @media (max-width: 480px) {
      form {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .f {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    .f.sw {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      min-block-size: 44px;
      padding: 0 2px;
    }
    .f > span.l,
    .f.sw > span.l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .f.sw > span.l {
      font-size: var(--sw-fs-sm);
    }
    select,
    input {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 44px;
      padding: 5px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      direction: ltr;
      text-align: start;
      font-variant-numeric: tabular-nums;
    }
    select:focus,
    input:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    select:disabled,
    input:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .bad select,
    .bad input {
      border-color: var(--sw-danger);
    }
    sw-toggle {
      padding: 10px 1px;
    }
    .line {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      padding: 8px 10px;
    }
    details.history {
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: 8px;
      font-size: var(--sw-fs-sm);
    }
    details.history summary {
      cursor: pointer;
      color: var(--sw-text-2);
      min-block-size: 36px;
      display: flex;
      align-items: center;
    }
    details.history summary:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
      border-radius: var(--sw-r-2xs);
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    ol li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 2px 8px;
      align-items: center;
      padding-block: 4px;
      border-block-end: 1px solid var(--sw-border);
    }
    ol li:last-child {
      border-block-end: 0;
    }
    .when {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
    }
    .what {
      grid-column: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 2px 10px;
    }
    li sw-button {
      grid-column: 2;
      grid-row: 1 / span 2;
    }
    bdi {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .muted {
      color: var(--sw-text-3);
    }
    /* R5-LIVE-297 (the HOMEFABLE tiers inside the stream editor): each setting is a WELL (surface-2, rounded) with its label 12.5 px
       semibold in the heading ink over a control that sits a tier up (surface, first shadow, 14 px semibold value); the two switches
       are the same wells, so the drawer reads as ten equal blocks instead of floating labels; the history rows are wells too */
    form {
      gap: 8px;
    }
    .f {
      gap: 7px;
      padding: 10px 12px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    .f.sw {
      padding: 4px 12px;
      min-block-size: 56px;
    }
    .f > span.l,
    .f.sw > span.l {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .f.sw > span.l {
      font-size: var(--sw-fs-md);
    }
    select,
    input {
      border-color: var(--sw-border);
      box-shadow: var(--sw-shadow-1);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .bad {
      background: var(--sw-danger-soft);
    }
    .line {
      font-size: var(--sw-fs-md);
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
    }
    ol li {
      padding: 8px 12px;
      border-block-end: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    details.history summary {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    /* R5-LIVE-297 Fable pass: the wells breathe (12 / 14 px), the label 13 px / 700, the control a 46 px key with a 15 px / 700 value;
       the switch wells show their word at 15 px / 700 */
    form {
      gap: 10px;
    }
    .f {
      gap: 8px;
      padding: 12px 14px 14px;
      border-radius: var(--sw-r-lg);
    }
    .f > span.l,
    .f.sw > span.l {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
    }
    .f.sw > span.l {
      font-size: var(--sw-fs-lg);
    }
    .f.sw {
      padding: 6px 14px;
      min-block-size: 60px;
    }
    select,
    input {
      min-block-size: 46px;
      border-color: transparent;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      border-radius: var(--sw-r-md);
    }
    select:focus,
    input:focus {
      border-color: var(--sw-accent);
    }
    .bad select,
    .bad input {
      border-color: var(--sw-danger);
    }
  `;D([S({type:Boolean})],q.prototype,"open",2);D([S({attribute:!1})],q.prototype,"camera",2);D([S({attribute:!1})],q.prototype,"stream",2);D([S({attribute:!1})],q.prototype,"options",2);D([h()],q.prototype,"draft",2);D([h()],q.prototype,"opts",2);D([h()],q.prototype,"optsCodec",2);D([h()],q.prototype,"loading",2);D([h()],q.prototype,"confirm",2);D([h()],q.prototype,"busy",2);D([h()],q.prototype,"line",2);D([h()],q.prototype,"history",2);q=D([Y("nvr-camera-editor")],q);var ja=Object.defineProperty,Ka=Object.getOwnPropertyDescriptor,fe=(e,t,s,a)=>{for(var r=a>1?void 0:a?Ka(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&ja(t,s,r),r};let ne=class extends W{constructor(){super(...arguments),this.message="",this.actionLabel="",this.linkLabel="",this.linkHref="",this.duration=1e4,this.busy=!1,this.timer=null}arm(){this.timer&&clearTimeout(this.timer),this.timer=this.duration>0?setTimeout(()=>this.dispatchEvent(new CustomEvent("dismiss",{bubbles:!0,composed:!0})),this.duration):null}updated(e){(e.has("message")||e.has("duration"))&&this.arm()}disconnectedCallback(){super.disconnectedCallback(),this.timer&&clearTimeout(this.timer),this.timer=null}render(){return this.message?o`<div class="toast" role="status" aria-live="polite" data-nvr-toast>
      <span data-nvr-toast-text>${this.message}</span>
      ${this.actionLabel?o`<button type="button" data-nvr-undo ?disabled=${this.busy} @click=${()=>this.dispatchEvent(new CustomEvent("undo",{bubbles:!0,composed:!0}))}>${this.actionLabel}</button>`:c}
      ${this.linkLabel&&this.linkHref?o`<a href=${this.linkHref} data-nvr-toast-link>${this.linkLabel}</a>`:c}
      <button type="button" class="x" aria-label="סגור" data-nvr-toast-close @click=${()=>this.dispatchEvent(new CustomEvent("dismiss",{bubbles:!0,composed:!0}))}>✕</button>
    </div>`:c}};ne.styles=Z`
    :host {
      position: fixed;
      inset-block-end: calc(var(--sw-bottomnav-h) + 16px);
      inset-inline: 0;
      margin-inline: auto;
      inline-size: max-content;
      max-inline-size: calc(100vw - 32px);
      z-index: var(--sw-z-toast);
      display: block;
    }
    .toast {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 6px 8px 6px 14px;
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      font-size: var(--sw-fs-sm);
      min-block-size: 44px;
    }
    button,
    a {
      border: 0;
      background: transparent;
      color: var(--sw-toast-action);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      padding: 0 10px;
      min-block-size: 44px;
      min-inline-size: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      border-radius: var(--sw-r-sm);
    }
    button:focus-visible,
    a:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: -2px;
    }
    button[disabled] {
      opacity: 0.6;
      cursor: default;
    }
    .x {
      color: inherit;
      opacity: 0.8;
      font-size: var(--sw-fs-lg);
    }
  `;fe([S()],ne.prototype,"message",2);fe([S()],ne.prototype,"actionLabel",2);fe([S()],ne.prototype,"linkLabel",2);fe([S()],ne.prototype,"linkHref",2);fe([S({type:Number})],ne.prototype,"duration",2);fe([S({type:Boolean})],ne.prototype,"busy",2);ne=fe([Y("nvr-undo-toast")],ne);const qe=encodeURIComponent;function dt(e){if(!e||typeof e!="object")return null;const t=e;if(typeof t.batch_id=="string")return t;if(t.batch&&typeof t.batch=="object")return dt(t.batch);if(Array.isArray(t.batches)){const s=t.batches.filter(a=>!!a&&typeof a=="object"&&typeof a.batch_id=="string");return s.find(a=>a.state==="running")??s[0]??null}return null}const Ua=500;function le(e){return{...e,rollback_of:e.rollback_of??e.source_batch_id??null}}async function Wa(e){let t=null;const s=[];let a=0;for(let r=0;r<400;r++){const i=await A(`nvr/stream-batches/${qe(e)}?offset=${a}&limit=${Ua}`);if(t??=i,s.push(...i.items??[]),i.next_offset===null||i.next_offset===void 0||i.next_offset<=a)break;a=i.next_offset}return le({...t,items:s})}const Ya={start:async e=>le(await X("nvr/stream-batches",e)),get:e=>Wa(e),active:async()=>{const e=dt(await A("nvr/stream-batches?active=1"));return e?le(e):null},stop:async e=>{const t=dt(await X(`nvr/stream-batches/${qe(e)}/stop`,{}));return t?le(t):null},undo:async e=>le(await X(`nvr/stream-batches/${qe(e)}/rollback`,{confirm:!0})),previewEncoding:e=>X("nvr/encoding-batches/preview",e),startEncoding:async e=>le(await X("nvr/encoding-batches",e)),recheck:async e=>le(await X(`nvr/stream-batches/${qe(e)}/verify`,{})),recent:async()=>((await A("nvr/stream-batches"))?.batches??[]).filter(t=>!!t&&typeof t.batch_id=="string").map(le)},I=()=>Ya,Ae={confirmed:"המצלמה אישרה",nvr_accepted:"המקליט קיבל",still_old:"עדיין בקידוד הקודם",restart_needed:"צריך אתחול",failed:"נכשל",unchanged:"כבר מוגדר"},Ga={confirmed:"ok",nvr_accepted:"info",still_old:"warn",restart_needed:"warn",failed:"bad",unchanged:"muted"},Qa=["still_old","restart_needed","failed"],Cs=e=>typeof e=="string"&&e in Ae;function Ja(e){if(!e||!Cs(e.outcome))return"";if(e.label)return e.label;switch(e.outcome){case"confirmed":return e.expected?`המצלמה אישרה (${e.expected})`:Ae.confirmed;case"still_old":return e.media_codec?`עדיין ${e.media_codec}`:Ae.still_old;case"failed":return`נכשל: ${e.reason??"השינוי לא בוצע"}`;default:return Ae[e.outcome]}}const Xa=e=>e&&Cs(e.outcome)?Ga[e.outcome]:"muted",Za="אם ה־NVR מסרב לשנות מצלמה",er=[{id:"skip",label:"לדלג ולהמשיך"},{id:"stop",label:"לעצור את כל ההמרה"}],tr={skip:"המצלמה נשארת כמו שהיא ונרשמת בדוח, וההמרה ממשיכה לשאר המצלמות.",stop:"ההמרה נעצרת במצלמה הראשונה שה־NVR מסרב לשנות; מה שכבר השתנה נשאר, ואפשר להחזיר אותו."},Ut=(e,t="skip")=>e==="skip"||e==="stop"?e:t,Wt="בסוף תוצג בדיקה של מה שכל מצלמה שולחת בפועל.";function sr(e){return e==="skip"?`השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה; מצלמה שה־NVR מסרב לשנות תדולג וההמרה תמשיך. ${Wt}`:`השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה. ${Wt}`}function ar(e){return e==="skip"?"השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה; מצלמה שה־NVR מסרב להחזיר תדולג, ואפשר לנסות אותה שוב.":"השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה ותעצור בשגיאה הראשונה."}const Yt=e=>e?.state==="running"||e?.state==="pending",B=e=>typeof e=="number"&&e>0?e:0,ht=e=>e.filter(Boolean).join(" · "),de=e=>e===1?"זרם אחד":`${e} זרמים`;function rr(e){if(!e||e.state==="none")return"";if(e.state==="pending")return"הבדיקה תתחיל בסיום השינוי.";if(e.state==="running")return"בודק מה כל מצלמה שולחת בפועל…";const t=e.counts??{},s=ht([B(t.confirmed)>0&&`המצלמה אישרה: ${de(B(t.confirmed))}`,B(t.nvr_accepted)>0&&`המקליט קיבל (לא נבדק במצלמה): ${de(B(t.nvr_accepted))}`,B(t.still_old)>0&&`עדיין בקידוד הקודם: ${de(B(t.still_old))}`,B(t.restart_needed)>0&&`צריך אתחול: ${de(B(t.restart_needed))}`,B(t.failed)>0&&`נכשל: ${de(B(t.failed))}`,(e.skipped?.length??0)>0&&`דולגו: ${de(e.skipped.length)}`,B(t.unchanged)>0&&`כבר מוגדר: ${de(B(t.unchanged))}`]);return e.state==="interrupted"?ht(["הבדיקה נקטעה; אפשר לבדוק שוב",s]):s||"אין זרמים בדוח."}function $e(e,t){const s=e.items??[];return t==="worklist"?s.filter(a=>!!a.verify&&Qa.includes(a.verify.outcome)):t==="skipped"?s.filter(a=>a.skipped===!0):s}function ir(e){const t=$e(e,"all").length,s=$e(e,"worklist").length,a=$e(e,"skipped").length;return[{id:"all",label:"כל הזרמים",count:t},{id:"worklist",label:"מצלמות שלא השתנו",count:s},{id:"skipped",label:"דולגו",count:a}].filter(r=>r.id!=="skipped"||r.count>0)}function nr(e){return e.kind==="rollback"?"דוח בדיקה · החזרה לערכים הקודמים":"דוח בדיקה · שינוי קידוד"}function or(e){switch(e.code){case"verify_too_soon":return"בדיקה חוזרת אפשרית בעוד כמה שניות.";case"verify_in_progress":return"הבדיקה עדיין מתבצעת.";case"nothing_to_verify":return"אין מצלמות לבדיקה חוזרת.";case"verify_not_available":return"בדיקה חוזרת קיימת רק לשינוי קידוד.";case"network":return"אין חיבור לשרת.";default:return e.status===403?"אין הרשאה לפעולה הזו.":e.user_message||"הבדיקה לא התחילה."}}const Gt="בדיקה חוזרת קוראת בלבד: רשימת הזרמים מה־NVR ומה שהמצלמות שולחות. שום הגדרה לא משתנה.";function lr(e){return e.filter(t=>t.mode==="encoding").sort((t,s)=>String(s.created_at??"").localeCompare(String(t.created_at??"")))}function Es(e){if(!e)return"";const t=new Date(e);if(Number.isNaN(t.getTime()))return"";const s=a=>String(a).padStart(2,"0");return`${s(t.getDate())}.${s(t.getMonth()+1)} ${s(t.getHours())}:${s(t.getMinutes())}`}function cr(e){const t=e.kind==="rollback"?"החזרה לערכים הקודמים":e.settings?.codec?`המרה ל־${e.settings.codec}`:"שינוי קידוד";return ht([t,Es(e.created_at)])}function dr(e,t){const s=r=>r.find(i=>i.role==="main")??null;return(t&&t!=="error"?s(t.camera.streams):null)??s(e.streams)}function hr(e,t,s){if(s)return[];const a=[];for(const r of e){if(!r.camera_id||r.online===!1)continue;const i=t.get(r.camera_id);if(i==="error"||i&&i.can_write===!1)continue;const n=dr(r,i);!n||n.codec!=="H.264"||n.svc!==!0||n.writable===!1||!n.etag||i&&i.options&&i.options[n.stream_ref]===null||a.push({cameraId:r.camera_id,recorderId:r.recorder_id,name:r.name,channel:r.channel,streamRef:n.stream_ref,etag:n.etag})}return a.sort((r,i)=>r.channel-i.channel||r.name.localeCompare(i.name,"he"))}function pr(e,t){let s=t.trim().toLowerCase();if(!s)return e;const a=[...s.matchAll(/ערוץ\s*(\d+)/g)].map(i=>Number(i[1]));s=s.replace(/ערוץ\s*\d+/g," ");const r=s.split(/\s+/).filter(Boolean);return e.filter(i=>{if(a.length&&!a.includes(i.channel))return!1;const n=`${i.name} ${i.channel}`.toLowerCase();return r.every(l=>n.includes(l))})}function ur(e,t){const s=new Set(e);for(const a of t)s.add(a.cameraId);return s}function fr(e){return new Set(e?[e]:[])}function mr(e,t,s){if(t===s)return new Set(e);const a=new Set(e);return a.has(t)?a.delete(t):a.add(t),a}const Ye=2,Ne=(e,t)=>e.filter(s=>t.has(s.cameraId));function Ms(e,t,s,a,r=5){const i=s*a;if(s<=0)return{start:0,end:0,top:0,total:0};const n=Math.max(0,Math.floor(e/a)),l=Math.min(s,Math.max(0,n-r)),p=Math.min(s,Math.ceil((e+Math.max(t,a))/a)+r);return{start:l,end:p,top:l*a,total:i}}const wr=(e,t,s)=>Math.max(0,e*s-Math.max(0,t-s)/2),Ns=["applied","unchanged","rolled_back"],xt=["failed","refused","no_effect","diverged"],je=["running","pending"],he=e=>e!=="running",pt=e=>(e.items??[]).some(t=>t.status==="unknown"||je.includes(t.status));function Ke(e){const t={};if(e.items)for(const n of e.items)t[n.status]=(t[n.status]??0)+1;else Object.assign(t,e.counts??{});const s=(...n)=>n.reduce((l,p)=>l+(t[p]??0),0),a=e.total??(e.items?e.items.length:Object.values(t).reduce((n,l)=>n+(l??0),0)),r=s(...Ns),i=s(...xt);return{total:a,ok:r,bad:i,unknown:s("unknown"),inFlight:s(...je),queued:s("queued"),notAttempted:s("not_attempted"),processed:r+i,applied:e.kind==="rollback"?s("applied")+s("rolled_back"):s("applied"),restored:e.kind==="rollback"?s("applied","rolled_back"):s("applied")}}const Ls=e=>e===1?"מצלמה אחת":`${e} מצלמות`,ze=e=>e===1?"במצלמה אחת":`ב־${e} מצלמות`,Ps=e=>e===1?"בזרם אחד":`ב־${e} זרמים`,Be=e=>e.mode==="encoding",Ve=(e,t)=>Be(e)?Ps(t):ze(t);function Qt(e){return Ns.includes(e.status)?"ok":xt.includes(e.status)?"bad":e.status==="unknown"?"unk":je.includes(e.status)?"spin":e.status==="not_attempted"?"skip":"wait"}function br(e,t){switch(e.status){case"queued":return"";case"running":case"pending":return t==="rollback"?"מחזיר":"מתבצע";case"applied":return t==="rollback"?"הוחזר":"נשמר";case"rolled_back":return"הוחזר";case"unchanged":return"ללא שינוי";case"unknown":return"לא ברור אם בוצע. נבדק מול ה־NVR.";case"not_attempted":return"לא בוצע";default:return Fe({code:e.error_code??e.status,user_message:e.user_message??void 0}).text}}function Is(e){return(e.items??[]).find(t=>xt.includes(t.status))??(e.items??[]).find(t=>t.status==="unknown")??null}function Jt(e){const t=e.items??[],s=i=>t.findIndex(i),a=s(i=>je.includes(i.status));if(a>=0)return a;if(he(e.state)){const i=Is(e);return i?t.indexOf(i):0}const r=s(i=>i.status==="queued");return r>=0?r:0}const Ge=e=>e.filter(Boolean).join(" · ");function gr(e,t,s=!1){const a=Ke(e),r=e.kind==="rollback",i=Is(e),n=i?t(i):"",l=a.total-a.restored,p=pt(e)||e.state==="running"||e.can_rollback===!1,d=!!i&&(e.state==="stopped_unknown"||e.state!=="running"&&e.stopped_reason==="unknown_unverified"),m={canStop:!1,showUndo:!1,canUndo:!1,showRetry:!1};if(e.state==="running")return{...m,tone:"running",title:`${a.processed} מתוך ${a.total}`,sub:s?"עוצר אחרי המצלמה הנוכחית":a.unknown?"נבדק מול ה־NVR":"",canStop:!s};const f=Q=>Ve(e,Q),$=Ge(r?[a.restored>0&&`הוחזר ${f(a.restored)}`,l>0&&`לא הוחזר ${f(l)}`]:[a.applied>0&&`נשמר ${f(a.applied)}`,a.bad>0&&`נכשל ${f(a.bad)}`,a.unknown>0&&`לא ברור אם בוצע ${f(a.unknown)}`,a.notAttempted>0&&`לא בוצע ${f(a.notAttempted)}`]),k=!r&&a.applied>0?{showUndo:!0,canUndo:!p}:{},E=r&&l>0&&e.rollback_of&&e.state!=="completed"?{showRetry:!0}:{};if(e.state==="interrupted"&&e.stopped_reason==="unknown_not_applied"&&i)return{...m,...k,...E,tone:"error",title:r?`ההחזרה נעצרה במצלמה ${n}`:`נעצר במצלמה ${n}`,sub:$};if(d)return{...m,...k,...E,tone:"error",title:r?`ההחזרה נעצרה: לא ברור אם בוצע במצלמה ${n}`:`נעצר: לא ברור אם בוצע במצלמה ${n}`,sub:$};switch(e.state){case"completed":return{...m,...k,tone:(e.skipped??0)>0?"warn":"done",title:Be(e)?r?`הקידוד הוחזר ${f(a.restored)}`:a.applied>0?`הקידוד עודכן ${f(a.applied)}`:"ללא שינוי":r?`SVC הוחזר ${ze(a.restored)}`:a.applied>0?`SVC כבוי ${ze(a.applied)}`:"ללא שינוי",sub:Ge([!r&&a.applied>0&&a.ok>a.applied&&`ללא שינוי ${f(a.ok-a.applied)}`,(e.skipped??0)>0&&`דולג ${f(e.skipped??0)}`])};case"stopped":return{...m,...k,...E,tone:"warn",title:r?"ההחזרה נעצרה בבקשתך":"נעצר בבקשתך",sub:$};case"failed":return{...m,...k,...E,tone:"error",title:r?`ההחזרה נעצרה במצלמה ${n}`:`נעצר במצלמה ${n}`,sub:$};default:return{...m,...k,...E,tone:"error",title:r?"ההחזרה נקטעה באמצע":"השינוי נקטע באמצע",sub:$}}}function vr(e){const t=Ke(e),s=(e.skipped??0)>0?` · דולג ${Ve(e,e.skipped??0)}`:"";return e.kind==="rollback"?{message:`בוטל ${Ve(e,t.restored)}${s}`,undo:!1}:t.applied===0?{message:`ללא שינוי${s}`,undo:!1}:{message:`נשמר ${Ve(e,t.applied)}${s}`,undo:!0}}function Qe(e,t){switch(e.code){case"batch_in_progress":return{text:"מתבצע שינוי מרובה",reload:!1};case"batch_not_enabled":return{text:"השינוי המרובה אינו זמין.",reload:!1};case"forbidden":return{text:"אין הרשאה לפעולה הזו.",reload:!1};case"stale":{const s=typeof e.details?.index=="number"?e.details.index:typeof e.details?.target=="number"?e.details.target:null,a=s!==null&&t?t(s):null;return{text:a?`הערכים של ${a} השתנו ב־NVR. נטען מחדש.`:"הערכים השתנו ב־NVR. נטען מחדש.",reload:!0}}case"batch_target_not_allowed":return{text:"אחת המצלמות אינה מתאימה לשינוי. נטען מחדש.",reload:!0};case"write_in_progress":return{text:"שינוי אחר של אחד הזרמים מתבצע. נסו שוב בעוד רגע.",reload:!1};case"capabilities_unreadable":return{text:"יכולות הזרם אינן ידועות, ולכן השינוי בוטל.",reload:!1};case"confirm_required":return{text:"נדרש אישור.",reload:!1};case"not_rollbackable":return{text:"אי אפשר לבטל את השינוי הזה.",reload:!1};case"source_unavailable":return{text:"ה־NVR אינו זמין.",reload:!1};case"network":return{text:"אין חיבור לשרת.",reload:!1};default:return{text:e.status===422?e.user_message||"הבחירה אינה תקינה.":e.user_message||"הפעולה לא בוצעה.",reload:!1}}}const yr="השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה.",Xt="השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה ותעצור בשגיאה הראשונה.";function xr(e){return{heading:`לכבות SVC ${ze(e.length)}?`,lead:yr,count:Ls(e.length),confirmLabel:"כבה",details:[],names:e}}function _r(e,t="svc",s){return t==="encoding"?{heading:`להחזיר את הקידוד ${Ps(e.length)}?`,lead:s?ar(s):Xt,count:e.length===1?"זרם אחד":`${e.length} זרמים`,confirmLabel:"החזר",details:[],names:e}:{heading:`להחזיר SVC ${ze(e.length)}?`,lead:Xt,count:Ls(e.length),confirmLabel:"החזר",details:[],names:e}}const ut="sw.nvr.batch.last";var $r=Object.defineProperty,kr=Object.getOwnPropertyDescriptor,L=(e,t,s,a)=>{for(var r=a>1?void 0:a?kr(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&$r(t,s,r),r};const zr=44,Zt=52,es=o`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>`,Sr=o`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>`,Le=e=>{try{e?window.localStorage.setItem(ut,e):window.localStorage.removeItem(ut)}catch{}},Rr=()=>{try{return window.localStorage.getItem(ut)}catch{return null}};let O=class extends W{constructor(){super(...arguments),this.candidates=[],this.info={},this.streams={},this.phase="closed",this.selected=new Set,this.fixedId=null,this.q="",this.line="",this.starting=!1,this.batch=null,this.stopping=!1,this.offline=!1,this.confirmFor=null,this.listTop=0,this.viewH=360,this.pollSeq=0,this.timer=null,this.follow=!0,this.focusedKey="",this.nameOf=e=>{const t=e.camera_id?this.info[e.camera_id]?.name??e.camera_id:"—",s=this.batch?.mode==="encoding"&&e.camera_id?this.streams[`${e.camera_id}:${e.stream_ref}`]:"";return s?`${t} · ${s}`:t},this.onScroll=e=>{this.listTop=e.target.scrollTop},this.takeControl=()=>{this.follow=!1}}openSelect(e){this.fixedId=e,this.selected=new Set([e]),this.q="",this.line="",this.listTop=0,this.phase="select"}async resume(){if(!this.batch)try{const e=await I().active();if(e){this.adopt(await this.full(e),!0);return}const t=Rr();t&&this.adopt(await I().get(t),!0)}catch(e){e instanceof y&&e.status===404&&Le(null)}}show(){this.batch&&(this.follow=!0,this.phase="progress")}async undoAll(e){await this.runUndo(e)}async followBatch(e){this.line="",this.phase="progress";try{this.adopt(await this.full(e),!1,!0)}catch{this.adopt(e,!1,!0)}}async full(e){return I().get(e.batch_id)}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}adopt(e,t=!1,s=!1){this.pollSeq++,this.stopping=!1,this.offline=!1,this.focusedKey="",this.follow=!0,this.batch=e,Le(e.batch_id),this.emit("batch-change",{batch:e}),t&&(this.phase="progress"),this.timer&&clearTimeout(this.timer);const a=this.nextDelay(e);a!==null&&this.armPoll(e.batch_id,a),s&&he(e.state)&&this.finished(e)}nextDelay(e){return e.state==="running"?1500:pt(e)?5e3:null}armPoll(e,t){this.timer&&clearTimeout(this.timer);const s=this.pollSeq;this.timer=setTimeout(()=>void this.poll(e,s),t)}async poll(e,t){if(t!==this.pollSeq)return;let s=null;try{s=await I().get(e),this.offline=!1}catch(r){if(t!==this.pollSeq)return;if(r instanceof y&&r.status===404){this.forget();return}this.offline=!0}if(t!==this.pollSeq)return;s&&this.apply(s);const a=this.batch;if(a&&a.batch_id===e){const r=s?this.nextDelay(s):3e3;r!==null&&this.armPoll(e,r)}}apply(e){const t=this.batch;this.batch=e,(e.state!=="running"||t&&t.batch_id!==e.batch_id)&&(this.stopping=!1),this.emit("batch-change",{batch:e}),t&&t.batch_id===e.batch_id&&t.state==="running"&&he(e.state)&&this.finished(e)}finished(e){this.emit("batch-refresh"),Be(e)&&e.state==="completed"&&this.emit("verify-report",{batchId:e.batch_id}),e.state==="completed"?(this.phase="closed",Le(null),this.emit("batch-finished",{batch:e})):(this.phase="progress",this.follow=!0)}forget(){this.pollSeq++,this.timer&&clearTimeout(this.timer),this.timer=null,this.batch=null,this.phase="closed",Le(null),this.emit("batch-change",{batch:null})}closeDialog(){if(this.phase==="progress"&&this.batch&&he(this.batch.state)&&!pt(this.batch)){this.forget();return}this.phase="closed"}disconnectedCallback(){super.disconnectedCallback(),this.pollSeq++,this.timer&&clearTimeout(this.timer),this.timer=null}pickedNames(){return Ne(this.candidates,this.selected).map(e=>e.name)}askStart(){Ne(this.candidates,this.selected).length<Ye||(this.line="",this.confirmFor={model:xr(this.pickedNames()),run:()=>void this.start()},this.phase="confirm")}async start(){this.confirmFor=null;const e=Ne(this.candidates,this.selected);if(e.length<Ye){this.phase="select";return}const t=e.map(a=>({camera_id:a.cameraId,stream_ref:a.streamRef,if_match:a.etag})),s=new Set(e.map(a=>a.recorderId));this.starting=!0,this.batch=null,this.line="",this.phase="progress";try{const a=await I().start({confirm:!0,changes:{svc:!1},targets:t,...s.size===1?{recorder_id:e[0].recorderId}:{}});this.adopt(await this.full(a),!1,!0),this.starting=!1}catch(a){if(this.starting=!1,!(a instanceof y)||a.status>=500)try{const l=await I().active();if(l){this.adopt(await this.full(l));return}}catch{}const i=a instanceof y?{status:a.status,code:a.code,user_message:a.body.user_message,details:a.body.details??{}}:{status:0,code:"network"},n=Qe(i,l=>{const p=e[l];return p?p.name:null});this.line=n.text,this.phase="select",n.reload&&this.emit("batch-refresh")}}async stop(){const e=this.batch;if(!(!e||this.stopping)){this.stopping=!0,this.line="";try{const t=await I().stop(e.batch_id);t&&this.apply(t)}catch(t){t instanceof y?this.line=Qe({status:t.status,code:t.code,user_message:t.body.user_message}).text:this.offline=!0,this.stopping=!1}this.batch&&this.batch.batch_id===e.batch_id&&!he(this.batch.state)&&this.armPoll(e.batch_id,400)}}askUndo(){const e=this.batch;if(!e)return;const t=e.kind==="rollback"?e.rollback_of:e.batch_id;if(!t)return;const s=(e.items??[]).filter(a=>e.kind==="rollback"?Qt(a)!=="ok":a.status==="applied").map(this.nameOf);this.line="",this.confirmFor={model:_r(s,e.mode,e.on_refusal),run:()=>void this.runUndo(t)},this.phase="undo-confirm"}async runUndo(e){this.confirmFor=null;const t=this.batch;this.starting=!0,this.line="",this.phase="progress";try{const s=await I().undo(e);this.adopt(await this.full(s),!1,!0),this.starting=!1}catch(s){if(this.starting=!1,!(s instanceof y)||s.status>=500)try{const i=await I().active();if(i){this.adopt(await this.full(i));return}}catch{}const r=s instanceof y?{status:s.status,code:s.code,user_message:s.body.user_message,details:s.body.details??{}}:{status:0,code:"network"};this.line=Qe(r).text,t?(this.batch=t,this.phase="progress"):this.phase="closed"}}willUpdate(e){if(e.has("candidates")&&this.selected.size){const t=new Set(this.candidates.map(a=>a.cameraId)),s=[...this.selected].filter(a=>t.has(a));s.length!==this.selected.size&&(this.selected=new Set(s)),this.fixedId&&!t.has(this.fixedId)&&(this.fixedId=null)}}updated(){const e=this.renderRoot.querySelector(".vl");if(e&&(Math.abs(e.clientHeight-this.viewH)>1&&e.clientHeight>0&&(this.viewH=e.clientHeight),this.phase==="progress"&&this.batch?.items?.length&&this.follow)){const t=this.batch,s=`${t.batch_id}:${t.state}:${Jt(t)}`;s!==this.focusedKey&&(this.focusedKey=s,e.scrollTop=wr(Jt(t),e.clientHeight||this.viewH,Zt))}}vlist(e,t,s,a,r,i=e){const n=Ms(this.listTop,this.viewH,e,t),l=[];for(let d=n.start;d<n.end;d++)l.push(d);const p=Math.max(i,3)*t;return o`<div class="vl" role="list" aria-label=${r} tabindex="0" data-nvr-batch-list=${s} data-rows=${e} style=${`--vl-fit:${p}px`} @scroll=${this.onScroll} @wheel=${this.takeControl} @touchstart=${this.takeControl} @pointerdown=${this.takeControl}>
      <div class="space" style="padding-block:${n.top}px ${Math.max(0,n.total-n.top-(n.end-n.start)*t)}px">${ke(l,d=>d,d=>a(d))}</div>
    </div>`}selectRow(e){const t=this.selected.has(e.cameraId),s=e.cameraId===this.fixedId;return o`<button type="button" class="sel" role="checkbox" aria-checked=${t?"true":"false"} aria-disabled=${s?"true":"false"} data-nvr-batch-cam=${e.cameraId}
      @click=${()=>this.selected=mr(this.selected,e.cameraId,this.fixedId)}>
      <span class="box" aria-hidden="true">${t?es:c}</span><span class="nm">${e.name}</span><span class="meta">ערוץ <span class="ltr">${e.channel}</span> · <bdi class="ltr">H.264</bdi></span>
    </button>`}renderSelect(){const e=pr(this.candidates,this.q),t=Ne(this.candidates,this.selected).length,s=this.q.trim().length>0;return o`<sw-dialog wide ?open=${this.phase==="select"} heading="כיבוי SVC בכמה מצלמות" data-nvr-batch-select @close=${a=>{a.stopPropagation(),this.phase="closed"}}>
      ${this.phase==="select"?o`<div class="tools">
              <sw-field><input type="search" placeholder="חיפוש מצלמה" aria-label="חיפוש מצלמה" data-nvr-batch-search .value=${this.q} @input=${a=>{this.q=a.target.value,this.listTop=0;const r=this.renderRoot.querySelector(".vl");r&&(r.scrollTop=0)}} /></sw-field>
              <sw-button size="sm" data-nvr-batch-all ?disabled=${!e.length} @click=${()=>this.selected=ur(this.selected,e)}>${s?`בחר הכל (${e.length})`:"בחר הכל"}</sw-button>
              <sw-button size="sm" variant="ghost" data-nvr-batch-clear @click=${()=>this.selected=fr(this.fixedId)}>נקה</sw-button>
            </div>
            <div class="count" data-nvr-batch-count role="status">${`נבחרו ${t} מתוך ${this.candidates.length}`}${s?` · ${e.length} תוצאות`:""}</div>
            ${e.length?this.vlist(e.length,zr,"select",a=>this.selectRow(e[a]),"מצלמות",this.candidates.length):o`<p class="msg" data-nvr-batch-none role="status">אין מצלמות שמתאימות לחיפוש.</p>`}
            ${this.line?o`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>`:c}
            ${He()?c:o`<div class="more"><sw-button size="sm" variant="ghost" data-nvr-batch-to-encoding @click=${()=>{this.phase="closed",this.emit("encoding-open")}}>שינוי קידוד לכמה מצלמות</sw-button></div>`}
            <sw-button slot="footer" variant="ghost" data-nvr-batch-cancel @click=${()=>this.phase="closed"}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-batch-next ?disabled=${t<Ye} @click=${()=>this.askStart()}>המשך</sw-button>`:c}
    </sw-dialog>`}icon(e){return o`<span class="ic ${e}" aria-hidden="true">${e==="ok"?es:e==="bad"?Sr:e==="unk"?"?":c}</span>`}progressRow(e,t){const s=Qt(t),a=br(t,e.kind),r=t.camera_id?this.info[t.camera_id]:null;return o`<div class="row ${s}" role="listitem" data-nvr-batch-item=${t.index} data-status=${t.status}>
      ${this.icon(s)}
      <div class="txt"><span class="nm">${this.nameOf(t)}${r?o` <span class="meta">ערוץ <span class="ltr">${r.channel}</span></span>`:c}</span>${a?o`<span class="ln" data-nvr-batch-item-line title=${a}>${a}</span>`:c}</div>
    </div>`}renderProgress(){const e=this.batch;if(!(this.phase==="progress"))return o`<sw-dialog wide data-nvr-batch-progress></sw-dialog>`;if(!e)return o`<sw-dialog wide open heading=${this.starting?"מתחיל":"שינוי מרובה"} data-nvr-batch-progress @close=${n=>{n.stopPropagation(),this.phase="closed"}}>
        ${this.starting?o`<div class="bar" role="progressbar" aria-label="מתחיל"><i style="inline-size:8%"></i></div>`:c}
        ${this.line?o`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>`:c}
        ${this.starting?c:o`<sw-button slot="footer" variant="primary" data-nvr-batch-close @click=${()=>this.phase="closed"}>סגור</sw-button>`}
      </sw-dialog>`;const s=gr(e,this.nameOf,this.stopping),a=Ke(e),r=a.total?Math.round(a.processed/a.total*100):0,i=e.items??[];return o`<sw-dialog wide open heading=${s.title} subheading=${s.sub} data-nvr-batch-progress data-state=${e.state} data-kind=${e.kind} @close=${n=>{n.stopPropagation(),this.closeDialog()}}>
      <div class="bar ${s.tone==="error"||s.tone==="warn"?"error":s.tone==="done"?"done":""}" role="progressbar" aria-valuemin="0" aria-valuemax=${a.total} aria-valuenow=${a.processed} aria-label="התקדמות"><i style="inline-size:${r}%"></i></div>
      ${this.vlist(i.length,Zt,"progress",n=>this.progressRow(e,i[n]),"מצלמות")}
      ${this.offline?o`<p class="msg" data-nvr-batch-offline role="status">אין חיבור לשרת. ממשיך לנסות.</p>`:c}
      ${this.line?o`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>`:c}
      ${s.canStop?o`<sw-button slot="footer" variant="danger" data-nvr-batch-stop @click=${()=>void this.stop()}>עצור</sw-button>`:c}
      ${s.showUndo?o`<sw-button slot="footer" data-nvr-batch-undo ?disabled=${!s.canUndo} title=${s.canUndo?"":"לא ברור אם בוצע. נבדק מול ה־NVR."} @click=${()=>this.askUndo()}>${ys(e.mode)}</sw-button>`:c}
      ${s.showRetry?o`<sw-button slot="footer" data-nvr-batch-retry @click=${()=>this.askUndo()}>נסה שוב</sw-button>`:c}
      ${Be(e)&&he(e.state)?o`<sw-button slot="footer" data-nvr-batch-report @click=${()=>this.emit("verify-report",{batchId:e.batch_id})}>דוח בדיקה</sw-button>`:c}
      ${he(e.state)?o`<sw-button slot="footer" variant="primary" data-nvr-batch-close @click=${()=>this.closeDialog()}>סגור</sw-button>`:c}
    </sw-dialog>`}render(){return o`${this.renderSelect()}
      <nvr-confirm .model=${this.phase==="confirm"||this.phase==="undo-confirm"?this.confirmFor?.model??null:null}
        @confirm=${e=>{e.stopPropagation();const t=this.confirmFor;t&&t.run()}}
        @cancel=${e=>{e.stopPropagation();const t=this.phase==="confirm"?"select":"progress";this.confirmFor=null,this.phase=t}}></nvr-confirm>
      ${this.renderProgress()}`}};O.styles=Z`
    :host {
      display: contents;
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .tools sw-field {
      flex: 1 1 180px;
      min-inline-size: 0;
    }
    .count {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .vl {
      contain: inline-size;
      inline-size: 100%;
      box-sizing: border-box;
      block-size: clamp(180px, 46dvh, 440px);
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .vl:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .space {
      box-sizing: border-box;
      inline-size: 100%;
    }
    @media (max-width: 1100px) {
      .tools sw-field input {
        min-block-size: 44px;
      }
    }
    .sel {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 10px;
      inline-size: 100%;
      block-size: 44px;
      padding-inline: 12px;
      border-block-end: 1px solid var(--sw-border);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .sel:hover:not([aria-disabled='true']) {
      background: var(--sw-surface-2);
    }
    .sel:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .sel[aria-disabled='true'] {
      cursor: default;
    }
    .box {
      flex: none;
      inline-size: 20px;
      block-size: 20px;
      border-radius: var(--sw-r-2xs);
      border: 2px solid var(--sw-border-strong);
      display: grid;
      place-items: center;
      color: var(--sw-text-inverse);
      background: transparent;
    }
    .sel[aria-checked='true'] .box {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .sel[aria-disabled='true'] .box {
      opacity: 0.6;
    }
    .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .row {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 10px;
      block-size: 52px;
      padding-inline: 12px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row .txt {
      flex: 1;
      min-inline-size: 0;
      display: grid;
      gap: 1px;
    }
    .row .ln {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row.bad .ln,
    .row.unk .ln {
      color: var(--sw-text-2);
    }
    .row.skip .nm {
      color: var(--sw-text-3);
    }
    .ic {
      flex: none;
      inline-size: 22px;
      block-size: 22px;
      border-radius: 50%;
      display: grid;
      place-items: center;
    }
    .ic.ok {
      color: var(--sw-success);
      background: var(--sw-success-soft);
    }
    .ic.bad {
      color: var(--sw-danger);
      background: var(--sw-danger-soft);
    }
    .ic.unk {
      color: var(--sw-warning-text);
      background: var(--sw-warning-soft);
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .ic.wait::before,
    .ic.skip::before {
      content: '';
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-text-3);
    }
    .ic.skip::before {
      opacity: 0.5;
    }
    .ic.spin::before {
      content: '';
      inline-size: 16px;
      block-size: 16px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      border-block-start-color: var(--sw-accent);
      animation: nvr-b-spin 0.8s linear infinite;
    }
    @keyframes nvr-b-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ic.spin::before {
        animation: none;
      }
    }
    .bar {
      block-size: 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar > i {
      display: block;
      block-size: 100%;
      border-radius: inherit;
      background: var(--sw-accent);
      transition: inline-size var(--sw-t-med) var(--sw-ease-out);
    }
    .bar.error > i {
      background: var(--sw-danger);
    }
    .bar.done > i {
      background: var(--sw-success);
    }
    .msg {
      margin: 0;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .sel {
        block-size: 44px;
      }
    }
    /* CAMADMIN-POLISH-2331 (the R5-LIVE-297 language of the multi-camera encoding dialog, carried to the SVC checklist and the progress of
       both): the list is a WELL (surface-2, no outline, no hairlines between rows) that is only as tall as its rows need (a short batch
       no longer floats in a half-empty box; the 44 / 52 px windowed row heights are untouched); a chosen camera is a 26 % accent field
       with a 4 px bar at its start edge, its name bold in the heading ink; rows tint on hover only under a fine pointer and darken on
       press; the count is a bold numeral; a progress row names its camera in bold, its outcome line under it; messages are wells */
    .vl {
      block-size: min(clamp(180px, 46dvh, 440px), var(--vl-fit, 100dvh));
      border-color: transparent;
      background: var(--sw-surface-2);
    }
    .tools {
      gap: 8px 10px;
    }
    .count {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .sel,
    .row {
      border-block-end: 0;
      padding-inline: 14px;
    }
    .sel {
      gap: 12px;
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
      transition: background-color var(--sw-t-fast) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .sel:hover:not([aria-disabled='true']) {
      background: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .sel:hover:not([aria-disabled='true']) {
        background: var(--sw-surface-3);
      }
    }
    .sel:active:not([aria-disabled='true']) {
      background: var(--sw-pressed-wash);
    }
    .sel[aria-checked='true'] {
      background: color-mix(in srgb, var(--sw-accent) 26%, var(--sw-surface));
      /* the bar sits at the row's START edge: box-shadow offsets are physical, so RTL (the default) is the right edge */
      box-shadow: inset -4px 0 0 var(--sw-accent);
    }
    :host-context([dir='ltr']) .sel[aria-checked='true'] {
      box-shadow: inset 4px 0 0 var(--sw-accent);
    }
    @media (hover: hover) and (pointer: fine) {
      .sel[aria-checked='true']:hover:not([aria-disabled='true']) {
        background: color-mix(in srgb, var(--sw-accent) 32%, var(--sw-surface));
      }
      /* DARK-REVIEW-2342: with the light dark-scheme accents of domus / crystal a 32 % field lifted the bed until the --sw-text-2 meta
         line read 4.3-4.4:1; dark hovers at 28 % (>= 4.7:1 every skin, tests/unit-dark-polish-beds.spec.ts) - still a step above the
         26 % resting field. Light keeps 32 % (light-dark() keys on the page's color-scheme; the rule above is the fallback of an engine without it). */
      .sel[aria-checked='true']:hover:not([aria-disabled='true']) {
        background: light-dark(color-mix(in srgb, var(--sw-accent) 32%, var(--sw-surface)), color-mix(in srgb, var(--sw-accent) 28%, var(--sw-surface)));
      }
    }
    .sel[aria-checked='true'] .nm {
      font-weight: var(--sw-fw-bold);
    }
    .box {
      inline-size: 22px;
      block-size: 22px;
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
    }
    .sel[aria-checked='true'] .box {
      box-shadow: none;
    }
    /* A11Y-POLISHED-2342 + DARK-REVIEW-2342: the unchecked box's 2 px --sw-border-strong edge read 1.3-2.0:1 on the light row and
       1.5-2.3:1 on the dark one (a checkbox boundary needs 3:1, WCAG 1.4.11). Light draws it in the muted ink (>= 4.9:1 every skin), dark
       in the muted ink at 70 % (3.2-4.3:1, tests/unit-dark-polish-beds.spec.ts on fix/DARK-REVIEW-2342). light-dark() keys on the page's
       color-scheme (it inherits into the shadow root); an engine without it drops the line and keeps the old edge. */
    .sel:not([aria-checked='true']) .box {
      border-color: light-dark(var(--sw-text-3), color-mix(in srgb, var(--sw-text-3) 70%, transparent));
    }
    .sel[aria-disabled='true'] .box {
      opacity: 0.7;
    }
    .sel .meta {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .row {
      gap: 12px;
      font-size: var(--sw-fs-md);
    }
    .row .nm {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .row .nm .meta {
      font-weight: var(--sw-fw-medium);
    }
    .row.skip .nm {
      font-weight: var(--sw-fw-semibold);
    }
    .row .ln {
      font-size: var(--sw-fs-sm);
    }
    .row.bad {
      background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface-2));
    }
    .row.bad .ln {
      color: var(--sw-danger-text);
    }
    .row.unk {
      background: color-mix(in srgb, var(--sw-warning) 12%, var(--sw-surface-2));
    }
    .row.unk .ln {
      color: var(--sw-warning-text);
      /* A11Y-POLISHED-2342: on the 12 % warning row the warning ink read 4.29:1 in classic light (4.27 bubble); light mixes a quarter of
         the body ink in (>= 5.4:1), dark unchanged */
      color: light-dark(color-mix(in srgb, var(--sw-warning-text) 75%, var(--sw-text)), var(--sw-warning-text));
    }
    .ic {
      inline-size: 24px;
      block-size: 24px;
    }
    .msg {
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-md);
    }
    .msg[role='alert'] {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .more {
      display: flex;
      justify-content: flex-start;
    }
    @media (prefers-reduced-motion: reduce) {
      .sel,
      .bar > i {
        transition: none;
      }
    }
  `;L([S({attribute:!1})],O.prototype,"candidates",2);L([S({attribute:!1})],O.prototype,"info",2);L([S({attribute:!1})],O.prototype,"streams",2);L([h()],O.prototype,"phase",2);L([h()],O.prototype,"selected",2);L([h()],O.prototype,"fixedId",2);L([h()],O.prototype,"q",2);L([h()],O.prototype,"line",2);L([h()],O.prototype,"starting",2);L([h()],O.prototype,"batch",2);L([h()],O.prototype,"stopping",2);L([h()],O.prototype,"offline",2);L([h()],O.prototype,"confirmFor",2);L([h()],O.prototype,"listTop",2);L([h()],O.prototype,"viewH",2);O=L([Y("nvr-camera-batch")],O);const Or=(e,t)=>`${e}:${t}`,ts={main:0,sub:1,third:2,other:3};function Tr(e,t){return t&&t!=="error"?t.camera.streams.find(s=>s.stream_ref===e.stream_ref)??e:e}function Cr(e,t,s){const a=[];for(const r of e){if(!r.camera_id)continue;const i=t.get(r.camera_id);if(!(i&&i!=="error"&&i.can_write===!1))for(const n of r.streams){const l=Tr(n,i);let p="";s?p=N.stale:i===void 0?p="נטען":i==="error"||i&&i.stale?p=N.detail_error:r.online===!1?p=N.offline:l.writable===!1?p=Ss(l.not_writable_reason):i.options?.[l.stream_ref]?l.etag||(p=N.stale):p=N.no_options,a.push({key:Or(r.camera_id,l.stream_ref),cameraId:r.camera_id,recorderId:r.recorder_id,cameraName:r.name,channel:r.channel,streamRef:l.stream_ref,role:l.role,codec:l.codec,resolution:l.resolution,svc:l.svc,webrtc:l.webrtc??"unknown",selectable:!p,reason:p})}}return a.sort((r,i)=>r.channel-i.channel||r.cameraName.localeCompare(i.cameraName,"he")||ts[r.role]-ts[i.role]||r.streamRef.localeCompare(i.streamRef))}const Je={q:"",codec:"",role:"",svc:"",webrtc:""},Er=e=>!!(e.q.trim()||e.codec||e.role||e.svc||e.webrtc);function Mr(e,t){let s=t.q.trim().toLowerCase();const a=[...s.matchAll(/ערוץ\s*(\d+)/g)].map(i=>Number(i[1]));s=s.replace(/ערוץ\s*\d+/g," ");const r=s.split(/\s+/).filter(Boolean);return e.filter(i=>{if(t.role&&i.role!==t.role||t.codec==="h264"&&i.codec!=="H.264"||t.codec==="h265"&&i.codec!=="H.265"||t.codec==="other"&&(i.codec==="H.264"||i.codec==="H.265")||t.svc==="on"&&i.svc!==!0||t.svc==="off"&&i.svc!==!1||t.svc==="none"&&i.svc!==null||t.webrtc&&i.webrtc!==t.webrtc||a.length&&!a.includes(i.channel))return!1;const n=`${i.cameraName} ${i.channel} ${j[i.role]} ${i.codec??""}`.toLowerCase();return r.every(l=>n.includes(l))})}function Nr(e,t){const s=new Set(e);for(const a of t)a.selectable&&s.add(a.key);return s}function Lr(e,t){const s=new Set(e);return s.has(t.key)?s.delete(t.key):t.selectable&&s.add(t.key),s}const Xe=(e,t)=>e.filter(s=>s.selectable&&t.has(s.key)),Ze={codec:"",resolution:"",fps:"",bitrate_mode:"",bitrate_kbps:"",quality:"",gop:"",svc:"",smart_codec:""},ss="ללא שינוי",as=e=>{const t=/^(\d+)x(\d+)$/.exec(e);return t?Number(t[1])*Number(t[2]):0};function et(e,t,s){const a={codec:[],resolution:[],fps:[],fpsFull:!1,bitrateMode:[],bitrate:null,quality:[],gop:null,svc:!1,smart:!1},r=(i,n)=>{i.includes(n)||i.push(n)};for(const i of e){const n=t.get(i.cameraId),l=n&&n!=="error"?n.options?.[i.streamRef]:null;if(l){for(const p of l.codec)(p==="H.264"||p==="H.265")&&r(a.codec,p);for(const p of l.resolution[s||i.codec||""]??[])r(a.resolution,p);for(const p of l.fps)r(a.fps,p);a.fpsFull||=l.fps_full;for(const p of l.bitrate_mode)r(a.bitrateMode,p);l.bitrate_kbps&&(a.bitrate=a.bitrate?{min:Math.min(a.bitrate.min,l.bitrate_kbps.min),max:Math.max(a.bitrate.max,l.bitrate_kbps.max)}:{...l.bitrate_kbps});for(const p of l.quality)r(a.quality,p);l.gop&&(a.gop=a.gop?{min:Math.min(a.gop.min,l.gop.min),max:Math.max(a.gop.max,l.gop.max)}:{...l.gop}),a.svc||=l.svc,a.smart||=l.smart_codec}}return a.codec.sort(),a.resolution.sort((i,n)=>as(n)-as(i)),a.fps.sort((i,n)=>n-i),a.bitrateMode.sort(),a.quality.sort((i,n)=>n-i),a}const rs=e=>/^\d{1,7}$/.test(e.trim())?Number(e.trim()):null;function is(e,t){const s={},a=[];if(e.codec&&(s.codec=e.codec),e.resolution&&(s.resolution=e.resolution),e.fps&&(s.fps=e.fps==="full"?"full":Number(e.fps)),e.bitrate_mode&&(s.bitrate_mode=e.bitrate_mode),e.bitrate_kbps.trim()){const r=rs(e.bitrate_kbps);r===null||r<1||t.bitrate&&(r<t.bitrate.min||r>t.bitrate.max)?a.push("bitrate_kbps"):s.bitrate_kbps=r}if(e.quality&&(s.quality=Number(e.quality)),e.gop.trim()){const r=rs(e.gop);r===null||r<1||t.gop&&(r<t.gop.min||r>t.gop.max)?a.push("gop"):s.gop=r}return e.svc&&(s.svc=e.svc==="on"),e.smart_codec&&(s.smart_codec=e.smart_codec==="on"),{settings:s,invalid:a}}const ns=e=>Object.keys(e).length>0;function Pr(e,t,s){const a={...e,codec:t};return a.resolution&&!s.resolution.includes(a.resolution)&&(a.resolution=""),a}function Ir(e,t){return{...e,bitrate_mode:t,quality:t==="CBR"?"":e.quality}}const os="הצפייה החיה מנגנת ב־WebRTC רק H.264.";function qr(e){const t=["codec","profile","resolution","fps","bitrate_mode","bitrate_kbps","quality","gop","svc","smart_codec"],s=new Map(e.notes.filter(a=>a.kind==="adjusted").map(a=>[a.field,a.message]));return Object.entries(e.fields??{}).sort(([a],[r])=>t.indexOf(a)-t.indexOf(r)).map(([a,[r,i]])=>({field:a,label:w[a]??a,from:ie(a,r),to:ie(a,i),adjusted:s.has(a),why:s.get(a)??""}))}const Ar=e=>e.notes.filter(t=>t.kind==="kept").map(t=>({label:w[t.field]??t.field,why:t.message}));function Vr(e){const t=e.counts,s=a=>a===1?"זרם אחד":`${a} זרמים`;return[t.change?`ישתנו ${s(t.change)}`:"אין מה לשנות",t.skip?`לא ניתן: ${s(t.skip)}`:"",t.unchanged?`כבר מוגדרים: ${s(t.unchanged)}`:""].filter(Boolean).join(" · ")}function Hr(e,t){return{confirm:!0,settings:e.settings,recorder_id:e.recorder_id,targets:e.items.filter(s=>s.status==="change"&&s.if_match).map(s=>({camera_id:s.camera_id,stream_ref:s.stream_ref,if_match:s.if_match,changes:s.changes})),...t?{on_refusal:t}:{}}}const Dr=e=>e===1?"בזרם אחד":`ב־${e} זרמים`,Fr="השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה.";function Br(e,t,s){const a=e.items.filter(r=>r.status==="change");return{heading:`לשנות את הקידוד ${Dr(a.length)}?`,lead:s?sr(s):Fr,count:ot(e.changes_total),confirmLabel:"החל",details:[],names:a.map(t)}}const jr=(e,t)=>t&&t in j?`${e} · ${j[t]}`:e;function ls(e){switch(e.code){case"stale":case"plan_changed":return{text:"ההגדרות במצלמות השתנו. התצוגה המקדימה נטענה מחדש.",reload:!0};case"batch_in_progress":return{text:"מתבצע שינוי מרובה",reload:!1};case"batch_target_not_allowed":return{text:"אחד הזרמים כבר אינו מתאים. התצוגה המקדימה נטענה מחדש.",reload:!0};case"write_in_progress":return{text:"שינוי אחר של אחד הזרמים מתבצע. נסו שוב בעוד רגע.",reload:!1};case"forbidden":return{text:"אין הרשאה לפעולה הזו.",reload:!1};case"source_unavailable":case"source_timeout":return{text:"ה־NVR אינו זמין.",reload:!1};case"network":return{text:"אין חיבור לשרת.",reload:!1};default:return{text:e.user_message||"הפעולה לא בוצעה.",reload:!1}}}const Kr=e=>e?`${e.min}–${e.max}`:K;var Ur=Object.defineProperty,Wr=Object.getOwnPropertyDescriptor,R=(e,t,s,a)=>{for(var r=a>1?void 0:a?Wr(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&Ur(t,s,r),r};const Yr=44,Gr=60,Qr=o`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>`;let _=class extends W{constructor(){super(...arguments),this.rows=[],this.details=new Map,this.phase="closed",this.selected=new Set,this.filters={...Je},this.draft={...Ze},this.plan=null,this.tab="change",this.busy=!1,this.line="",this.confirmModel=null,this.listTop=0,this.viewH=360,this.presetScope="all",this.presetRole="both",this.presetMode=!1,this.onRefusal="skip",this.refusalKnown=!1,this.nameOf=e=>{const t=this.rows.find(s=>s.cameraId===e.camera_id&&s.streamRef===e.stream_ref);return jr(t?.cameraName??e.camera_id,e.role??t?.role)}}open(){this.selected=new Set,this.filters={...Je},this.draft={...Ze},this.plan=null,this.line="",this.listTop=0,this.presetMode=!1,this.phase="select"}willUpdate(e){if(e.has("rows")&&this.selected.size){const t=new Set(this.rows.filter(a=>a.selectable).map(a=>a.key)),s=[...this.selected].filter(a=>t.has(a));s.length!==this.selected.size&&(this.selected=new Set(s))}}updated(){const e=this.renderRoot.querySelector(".vl");e&&e.clientHeight>0&&Math.abs(e.clientHeight-this.viewH)>1&&(this.viewH=e.clientHeight)}resetScroll(){this.listTop=0;const e=this.renderRoot.querySelector(".vl");e&&(e.scrollTop=0)}vlist(e,t,s,a,r){const i=Ms(this.listTop,this.viewH,e,t),n=[];for(let l=i.start;l<i.end;l++)n.push(l);return o`<div class="vl" role="list" aria-label=${r} tabindex="0" data-nvr-enc-list=${s} data-rows=${e} @scroll=${l=>this.listTop=l.target.scrollTop}>
      <div class="space" style="padding-block:${i.top}px ${Math.max(0,i.total-i.top-(i.end-i.start)*t)}px">${ke(n,l=>l,l=>a(l))}</div>
    </div>`}dd(e,t,s,a,r){return o`<sw-dropdown data-nvr-enc-dd=${t} .label=${e} .placeholder=${e} .value=${s} .items=${a} @change=${i=>r(i.detail.id)}></sw-dropdown>`}selectRow(e){const t=this.selected.has(e.key),s=e.selectable?`${e.codec??""}${e.resolution?` · ${e.resolution.replace(/x/i,"×")}`:""}`:e.reason;return o`<button type="button" class="sel" role="checkbox" aria-checked=${t?"true":"false"} aria-disabled=${e.selectable?"false":"true"} data-nvr-enc-stream=${e.key}
      title=${e.selectable?"":e.reason} @click=${()=>this.selected=Lr(this.selected,e)}>
      <span class="box" aria-hidden="true">${t?Qr:c}</span>
      <span class="nm">${e.cameraName} · ${j[e.role]}</span>
      <span class="meta">${e.selectable?o`<bdi class="ltr">${s}</bdi>`:s}</span>
    </button>`}patchFilters(e){this.filters={...this.filters,...e},this.resetScroll()}renderSelect(){const e=this.filters,t=Mr(this.rows,e),s=Xe(this.rows,this.selected).length,a=this.rows.filter(i=>i.selectable).length,r=Er(e);return o`${this.renderPreset()}<div class="tools" data-nvr-enc-filters>
        <sw-field class="q"><input type="search" placeholder="חיפוש מצלמה" aria-label="חיפוש מצלמה" data-nvr-enc-search .value=${e.q} @input=${i=>this.patchFilters({q:i.target.value})} /></sw-field>
        ${this.dd("זרם","role",e.role,[{id:"",label:"כל הזרמים"},{id:"main",label:"ראשי"},{id:"sub",label:"משני"}],i=>this.patchFilters({role:i}))}
        ${this.dd("קידוד","codec",e.codec,[{id:"",label:"כל הקידודים"},{id:"h264",label:"H.264"},{id:"h265",label:"H.265"},{id:"other",label:"אחר"}],i=>this.patchFilters({codec:i}))}
        ${this.dd("SVC","svc",e.svc,[{id:"",label:"כל ה־SVC"},{id:"on",label:"SVC פעיל"},{id:"off",label:"SVC כבוי"},{id:"none",label:"ללא SVC"}],i=>this.patchFilters({svc:i}))}
        ${this.dd("WebRTC","webrtc",e.webrtc,[{id:"",label:"כל ה־WebRTC"},{id:"ok",label:"מתנגן"},{id:"no",label:"לא מתנגן"},{id:"unknown",label:"לא ידוע"}],i=>this.patchFilters({webrtc:i}))}
      </div>
      <div class="tools">
        <sw-button size="sm" data-nvr-enc-all ?disabled=${!t.some(i=>i.selectable)} @click=${()=>this.selected=Nr(this.selected,t)}>${r?`בחר הכל (${t.filter(i=>i.selectable).length})`:"בחר הכל"}</sw-button>
        <sw-button size="sm" variant="ghost" data-nvr-enc-clear @click=${()=>this.selected=new Set}>נקה</sw-button>
        ${r?o`<sw-button size="sm" variant="ghost" data-nvr-enc-unfilter @click=${()=>this.patchFilters({...Je})}>נקה סינון</sw-button>`:c}
      </div>
      <div class="count" data-nvr-enc-count role="status">${`נבחרו ${s} מתוך ${a}`}${r?` · ${t.length} תוצאות`:""}</div>
      ${t.length?this.vlist(t.length,Yr,"select",i=>this.selectRow(t[i]),"זרמים"):o`<p class="msg" data-nvr-enc-none role="status">אין זרמים שמתאימים לסינון.</p>`}
      ${this.line?o`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>`:c}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-cancel @click=${()=>this.phase="closed"}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-next ?disabled=${s<1} @click=${()=>this.toSettings()}>המשך</sw-button>`}toSettings(){this.line="",this.presetMode=!1,this.phase="settings"}renderPreset(){const e=Ct(this.rows,this.selected,this.presetScope,this.presetRole),t=sa(this.rows,this.selected,this.presetScope,this.presetRole,N.writes_disabled),s=e.length===0;return o`<section class="preset" data-nvr-h264-preset aria-label=${Et}>
      <div class="preset-head">
        <span class="preset-title">${Et}</span>
        <p class="note" data-nvr-h264-why>${Mt} ${Nt}</p>
      </div>
      <div class="tools">
        ${this.dd("מצלמות","h264-scope",this.presetScope,aa,a=>(this.presetScope=a,this.line=""))}
        ${this.dd("זרמים","h264-role",this.presetRole,ra,a=>(this.presetRole=a,this.line=""))}
        <sw-button size="sm" variant="primary" data-nvr-h264-run ?disabled=${s||this.busy} @click=${()=>this.runPreset()}>${this.busy&&this.presetMode?"בודק…":ia(e.length)}</sw-button>
        <sw-button size="sm" variant="ghost" data-nvr-verify-reports @click=${()=>this.emit("verify-reports")}>דוחות בדיקה קודמים</sw-button>
      </div>
      ${s||t.writesOff?o`<p class="msg" data-nvr-h264-empty role="status">${s?na(this.presetScope,t,this.selected.size):`${t.writesOff} זרמים לא ישתנו: שינויי הגדרות ב־NVR כבויים (הגדרות החיבור).`}</p>`:c}
    </section>`}runPreset(){const e=Ct(this.rows,this.selected,this.presetScope,this.presetRole);e.length&&(this.selected=oa(e),this.draft={...Ze,codec:"H.264"},this.presetMode=!0,this.runPreview())}renderSettings(){const e=this.draft,t=Xe(this.rows,this.selected),s=et(t,this.details,e.codec),{settings:a,invalid:r}=is(e,s),i={id:"",label:ss},n=[i,{id:"on",label:"פעיל"},{id:"off",label:"כבוי"}],l=d=>this.draft={...this.draft,...d},p=(d,m)=>o`<sw-field label=${w[d]+(d==="bitrate_kbps"?" (kbps)":"")} hint=${r.includes(d)?`טווח ${Kr(m)}`:""}>
        <input inputmode="numeric" placeholder=${ss} aria-label=${w[d]} data-nvr-enc-input=${d} aria-invalid=${r.includes(d)?"true":"false"} .value=${e[d]} @input=${f=>l({[d]:f.target.value})} />
      </sw-field>`;return o`<p class="count" data-nvr-enc-picked>${`נבחרו ${t.length===1?"זרם אחד":`${t.length} זרמים`}`}</p>
      <div class="form" data-nvr-enc-form>
        <sw-field label=${w.codec}>${this.dd(w.codec,"codec-target",e.codec,[i,...s.codec.map(d=>({id:d,label:d}))],d=>this.draft=Pr(this.draft,d,et(t,this.details,d)))}</sw-field>
        <sw-field label=${w.resolution}>${this.dd(w.resolution,"resolution",e.resolution,[i,...s.resolution.map(d=>({id:d,label:ie("resolution",d)}))],d=>l({resolution:d}))}</sw-field>
        <sw-field label=${w.fps}>${this.dd(w.fps,"fps",e.fps,[i,...s.fpsFull?[{id:"full",label:"מלא"}]:[],...s.fps.map(d=>({id:String(d),label:String(d)}))],d=>l({fps:d}))}</sw-field>
        <sw-field label=${w.bitrate_mode}>${this.dd(w.bitrate_mode,"bitrate_mode",e.bitrate_mode,[i,...s.bitrateMode.map(d=>({id:d,label:d}))],d=>this.draft=Ir(this.draft,d))}</sw-field>
        ${p("bitrate_kbps",s.bitrate)}
        <sw-field label=${w.quality}>${this.dd(w.quality,"quality",e.quality,[i,...e.bitrate_mode==="CBR"?[]:s.quality.map(d=>({id:String(d),label:String(d)}))],d=>l({quality:d}))}</sw-field>
        ${p("gop",s.gop)}
        ${s.svc?o`<sw-field label="SVC">${this.dd("SVC","svc-target",e.svc,n,d=>l({svc:d}))}</sw-field>`:c}
        ${s.smart?o`<sw-field label=${w.smart_codec}>${this.dd(w.smart_codec,"smart_codec",e.smart_codec,n,d=>l({smart_codec:d}))}</sw-field>`:c}
      </div>
      ${e.codec?o`<p class="note" data-nvr-enc-webrtc>${os}</p>`:c}
      ${this.line?o`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>`:c}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-back @click=${()=>(this.phase="select",this.line="")}>חזרה</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-preview ?disabled=${!ns(a)||r.length>0||this.busy} @click=${()=>void this.runPreview()}>${this.busy?"בודק…":"תצוגה מקדימה"}</sw-button>`}async runPreview(e=!1){const t=Xe(this.rows,this.selected),{settings:s,invalid:a}=this.presetMode?{settings:{...la},invalid:[]}:is(this.draft,et(t,this.details,this.draft.codec));if(!t.length||!ns(s)||a.length)return;this.busy=!0,e||(this.line="");const r=new Set(t.map(i=>i.recorderId));try{const i=await I().previewEncoding({settings:s,targets:t.map(n=>({camera_id:n.cameraId,stream_ref:n.streamRef})),...r.size===1?{recorder_id:t[0].recorderId}:{}});this.plan=i,this.refusalKnown=i.on_refusal==="skip"||i.on_refusal==="stop",this.onRefusal=Ut(i.on_refusal),this.tab=i.counts.change?"change":i.counts.skip?"skip":"unchanged",this.phase="preview",this.resetScroll()}catch(i){const n=i instanceof y?{status:i.status,code:i.code,user_message:i.body.user_message}:{code:"network"};this.line=ls(n).text}finally{this.busy=!1}}previewRow(e){let t;if(e.status==="skip")t=o`<span class="ln" data-nvr-enc-reason title=${e.message??""}>${e.message??""}</span>`;else if(e.status==="unchanged")t=o`<span class="ln muted">כבר מוגדר כך</span>`;else{const s=qr(e),a=Ar(e),r=[...s.filter(i=>i.adjusted).map(i=>`${i.label}: ${i.why}`),...a.map(i=>`${i.label}: ${i.why}`)].join(`
`);t=o`<span class="ln" data-nvr-enc-delta title=${r}>${s.map((i,n)=>o`${n?" · ":""}${i.label} <bdi class="ltr">${i.from}</bdi> <span class="arrow" aria-hidden="true">←</span> <bdi class="ltr ${i.adjusted?"adj":""}" data-adjusted=${i.adjusted?"true":"false"}>${i.to}${i.adjusted?"*":""}</bdi>`)}${a.length?o` · <span class="muted" data-nvr-enc-kept>${a.map(i=>i.label).join(", ")} ${"ללא שינוי"}</span>`:c}</span>`}return o`<div class="row" role="listitem" data-nvr-enc-item=${e.index} data-status=${e.status}><span class="nm">${this.nameOf(e)}</span>${t}</div>`}renderPreview(){const e=this.plan;if(!e)return c;const t=e.items.filter(r=>r.status===this.tab),s=[{id:"change",label:"ישתנו",count:e.counts.change},{id:"skip",label:"לא ניתן",count:e.counts.skip},{id:"unchanged",label:"כבר מוגדרים",count:e.counts.unchanged}].filter(r=>r.count>0||r.id==="change"),a=e.adjusted>0;return o`<p class="sum" data-nvr-enc-summary role="status">${Vr(e)}</p>
      ${this.presetMode?o`<p class="note" data-nvr-h264-preview-note>${Mt} ${Nt} רזולוציה, קצב פריימים וקצב סיביות נשארים כמו שהם, אלא אם המצלמה דורשת התאמה. ${ca}</p>`:e.settings.codec?o`<p class="note" data-nvr-enc-webrtc>${os}</p>`:c}
      ${a?o`<p class="note" data-nvr-enc-adjusted>* הותאם למה שהמצלמה מאפשרת</p>`:c}
      <sw-tabs data-nvr-enc-tabs .items=${s} .active=${this.tab} group-label="תצוגה מקדימה" @change=${r=>(this.tab=r.detail.id,this.resetScroll())}></sw-tabs>
      ${t.length?this.vlist(t.length,Gr,"preview",r=>this.previewRow(t[r]),"תצוגה מקדימה"):o`<p class="msg" data-nvr-enc-empty role="status">אין זרמים ברשימה הזו.</p>`}
      ${this.refusalKnown&&e.counts.change>1?o`<div class="tools" data-nvr-enc-refusal>${this.dd(Za,"on-refusal",this.onRefusal,[...er],r=>this.onRefusal=Ut(r))}<span class="note" data-nvr-enc-refusal-hint>${tr[this.onRefusal]}</span></div>`:c}
      ${e.batch_in_progress?o`<p class="msg" data-nvr-enc-busy role="status">מתבצע שינוי מרובה</p>`:c}
      ${this.line?o`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>`:c}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-back @click=${()=>(this.phase=this.presetMode?"select":"settings",this.line="")}>חזרה</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-apply ?disabled=${!e.counts.change||e.batch_in_progress||this.busy} @click=${()=>this.askConfirm()}>${e.counts.change?`החל על ${e.counts.change===1?"זרם אחד":`${e.counts.change} זרמים`}`:"החל"}</sw-button>`}askConfirm(){const e=this.plan;!e||!e.counts.change||(this.line="",this.confirmModel=Br(e,this.nameOf,this.refusalKnown?this.onRefusal:void 0),this.phase="confirm")}async start(){const e=this.plan;if(this.confirmModel=null,!!e){this.busy=!0,this.phase="preview";try{const t=await I().startEncoding(Hr(e,this.refusalKnown?this.onRefusal:void 0));this.handOff(t)}catch(t){if(!(t instanceof y)||t.status>=500)try{const i=await I().active();if(i){this.handOff(i);return}}catch{}const a=t instanceof y?{status:t.status,code:t.code,user_message:t.body.user_message}:{code:"network"},r=ls(a);r.reload&&(this.busy=!1,await this.runPreview(!0)),this.line=r.text}finally{this.busy=!1}}}handOff(e){this.phase="closed",this.plan=null,this.emit("encoding-started",{batch:e})}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}render(){const e=this.phase==="select"||this.phase==="settings"||this.phase==="preview",t=this.phase==="settings"?"ההגדרות החדשות":this.phase==="preview"?"תצוגה מקדימה":"שינוי קידוד לכמה מצלמות";return o`<sw-dialog wide ?open=${e} heading=${t} data-nvr-enc data-phase=${this.phase} ?locked=${this.busy} @close=${s=>{s.stopPropagation(),this.phase="closed"}}>
        ${this.phase==="select"?this.renderSelect():this.phase==="settings"?this.renderSettings():this.phase==="preview"?this.renderPreview():c}
      </sw-dialog>
      <nvr-confirm .model=${this.phase==="confirm"?this.confirmModel:null}
        @confirm=${s=>{s.stopPropagation(),this.start()}}
        @cancel=${s=>{s.stopPropagation(),this.confirmModel=null,this.phase="preview"}}></nvr-confirm>`}};_.styles=Z`
    :host {
      display: contents;
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .tools sw-field.q {
      flex: 1 1 180px;
      min-inline-size: 0;
    }
    .count {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .vl {
      contain: inline-size;
      inline-size: 100%;
      box-sizing: border-box;
      block-size: clamp(180px, 42dvh, 420px);
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .vl:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .space {
      box-sizing: border-box;
      inline-size: 100%;
    }
    .sel {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 10px;
      inline-size: 100%;
      block-size: 44px;
      padding-inline: 12px;
      border-block-end: 1px solid var(--sw-border);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .sel:hover:not([aria-disabled='true']) {
      background: var(--sw-surface-2);
    }
    .sel:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .sel[aria-disabled='true'] {
      cursor: default;
      color: var(--sw-text-3);
    }
    .box {
      flex: none;
      inline-size: 20px;
      block-size: 20px;
      border-radius: var(--sw-r-2xs);
      border: 2px solid var(--sw-border-strong);
      display: grid;
      place-items: center;
      color: var(--sw-text-inverse);
    }
    .sel[aria-checked='true'] .box {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .sel[aria-disabled='true'] .box {
      opacity: 0.4;
    }
    .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-inline-size: 50%;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .form {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
      gap: 10px 12px;
    }
    .form sw-dropdown {
      inline-size: 100%;
    }
    .form input {
      direction: ltr;
      text-align: start;
    }
    /* the Hebrew "ללא שינוי" placeholder reads right-to-left; a typed number stays left-to-right */
    .form input:placeholder-shown {
      direction: rtl;
    }
    .msg {
      margin: 0;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .note {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .sum {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
    .row {
      box-sizing: border-box;
      display: grid;
      align-content: center;
      gap: 2px;
      block-size: 60px;
      padding-inline: 12px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .row .nm {
      flex: none;
    }
    .row .ln {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .ln.muted {
      color: var(--sw-text-3);
    }
    .adj {
      color: var(--sw-warning-text, var(--sw-text));
      font-weight: var(--sw-fw-semibold);
    }
    .arrow,
    .muted {
      color: var(--sw-text-3);
    }
    /* touch targets (layout guard): the preview's tabs grow their hit area to 44 px (the shared knob), and the text fields are 44 px
       high in touch layouts, as the multi-camera checklist's search */
    sw-tabs {
      --sw-tab-min-h: 44px;
      /* a flex item of the dialog's scrolling body: never squeezed below its own height (it scrolls sideways, so its automatic minimum is 0) */
      flex: none;
    }
    @media (max-width: 1100px) {
      sw-field input {
        min-block-size: 44px;
      }
      /* touch layouts: 44 px whatever the desktop touch dial (the bubble skin sizes tab buttons by it; the shell does the same, bubble.ts) */
      sw-tabs {
        --sw-touch-desktop: 44px;
      }
    }
    /* R5-LIVE-297 (the HOMEFABLE tiers in the multi-camera encoding dialog; the windowed rows keep their 44 / 60 px heights): the list is
       a WELL (surface-2, no outline) inside the dialog; a chosen stream is a FILLED accent row with its name in bold heading ink, not
       only a ticked box; rows tint on hover only under a fine pointer and darken on press; the count is a bold numeral */
    .vl {
      border-color: transparent;
      background: var(--sw-surface-2);
    }
    .sel {
      font-size: var(--sw-fs-md);
      transition: background-color var(--sw-t-fast) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
    }
    .sel:hover:not([aria-disabled='true']) {
      background: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .sel:hover:not([aria-disabled='true']) {
        background: var(--sw-surface-3);
      }
    }
    .sel:active:not([aria-disabled='true']) {
      background: var(--sw-pressed-wash);
    }
    .sel[aria-checked='true'] {
      background: color-mix(in srgb, var(--sw-accent) 20%, var(--sw-surface)); /* 50 % test: accent-soft vanished in dark */
    }
    .vl {
      border-radius: var(--sw-r-lg);
    }
    .sel[aria-checked='true'] .nm {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .box {
      background: var(--sw-surface);
    }
    .count {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .row {
      font-size: var(--sw-fs-md);
    }
    .row .nm {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .sum {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .msg {
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
    }
    /* R5-LIVE-297 Fable pass (the Opus list still had hairlines between the rows and a 20 % tint that vanished in dark): the rows sit
       in the well with NO lines (the windowed 44 / 60 px heights untouched); a chosen stream is a 26 % accent field with a 4 px accent
       bar at its start edge and a 22 px box; the count is a 20 px / 800 display line; the plan rows are bold in the heading ink */
    .sel,
    .row {
      border-block-end: 0;
    }
    .sel {
      padding-inline: 14px;
      gap: 12px;
      color: var(--sw-heading);
    }
    .sel[aria-checked='true'] {
      background: color-mix(in srgb, var(--sw-accent) 26%, var(--sw-surface));
      /* the bar sits at the row's START edge: box-shadow offsets are physical, so RTL (the default) is the right edge */
      box-shadow: inset -4px 0 0 var(--sw-accent);
    }
    :host-context([dir='ltr']) .sel[aria-checked='true'] {
      box-shadow: inset 4px 0 0 var(--sw-accent);
    }
    .box {
      inline-size: 22px;
      block-size: 22px;
      border-radius: var(--sw-r-xs);
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-1);
    }
    .sel[aria-checked='true'] .box {
      box-shadow: none;
    }
    /* A11Y-POLISHED-2342 + DARK-REVIEW-2342: the unchecked box's 2 px --sw-border-strong edge read 1.3-2.0:1 on the light row and
       1.5-2.3:1 on the dark one (a checkbox boundary needs 3:1, WCAG 1.4.11). Light draws it in the muted ink (>= 4.9:1 every skin), dark
       in the muted ink at 70 % (3.2-4.3:1, tests/unit-dark-polish-beds.spec.ts on fix/DARK-REVIEW-2342). light-dark() keys on the page's
       color-scheme (it inherits into the shadow root); an engine without it drops the line and keeps the old edge. */
    .sel:not([aria-checked='true']) .box {
      border-color: light-dark(var(--sw-text-3), color-mix(in srgb, var(--sw-text-3) 70%, transparent));
    }
    .sel .meta {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .count {
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    .row {
      padding-inline: 14px;
    }
    .row .nm {
      font-weight: var(--sw-fw-bold);
    }
    .adj {
      font-weight: var(--sw-fw-bold);
    }
    .sum {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
    }
    /* NVR-H264-BULK-2341: the H.264 preset - a quiet well above the checklist (no border; the checklist below keeps its own look) */
    .preset {
      display: grid;
      gap: 8px;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
      min-inline-size: 0;
    }
    .preset-head {
      display: grid;
      gap: 2px;
    }
    .preset-title {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
  `;R([S({attribute:!1})],_.prototype,"rows",2);R([S({attribute:!1})],_.prototype,"details",2);R([h()],_.prototype,"phase",2);R([h()],_.prototype,"selected",2);R([h()],_.prototype,"filters",2);R([h()],_.prototype,"draft",2);R([h()],_.prototype,"plan",2);R([h()],_.prototype,"tab",2);R([h()],_.prototype,"busy",2);R([h()],_.prototype,"line",2);R([h()],_.prototype,"confirmModel",2);R([h()],_.prototype,"listTop",2);R([h()],_.prototype,"viewH",2);R([h()],_.prototype,"presetScope",2);R([h()],_.prototype,"presetRole",2);R([h()],_.prototype,"presetMode",2);R([h()],_.prototype,"onRefusal",2);R([h()],_.prototype,"refusalKnown",2);_=R([Y("nvr-encoding-batch")],_);var Jr=Object.defineProperty,Xr=Object.getOwnPropertyDescriptor,ee=(e,t,s,a)=>{for(var r=a>1?void 0:a?Xr(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&Jr(t,s,r),r};const Zr=2e3;let H=class extends W{constructor(){super(...arguments),this.info={},this.streams={},this.open=!1,this.view="report",this.fromList=!1,this.batch=null,this.recent=null,this.tab="all",this.line="",this.busy=!1,this.seq=0,this.timer=null}async show(e,t=!1){this.open=!0,this.view="report",this.fromList=t,this.tab="all",this.line="",this.batch=this.batch?.batch_id===e?this.batch:null,await this.read(e,++this.seq)}async showList(){this.stopPolling(),this.open=!0,this.view="list",this.line="",this.recent=null;try{this.recent=lr(await I().recent())}catch{this.recent=[],this.line="לא ניתן לקרוא את הדוחות."}}async read(e,t){try{const s=await I().get(e);if(t!==this.seq||!this.open)return;this.batch=s,this.tab!=="all"&&!$e(s,this.tab).length&&(this.tab="all"),(s.state==="running"||Yt(s.verify))&&this.arm(e,t)}catch(s){if(t!==this.seq)return;this.line=s instanceof y&&s.status===404?"הדוח לא נמצא.":"אין חיבור לשרת. ממשיך לנסות.",s instanceof y&&s.status===404||this.arm(e,t)}}arm(e,t){this.stopPolling(),this.timer=setTimeout(()=>void this.read(e,t),Zr)}stopPolling(){this.timer&&clearTimeout(this.timer),this.timer=null}close(){this.seq++,this.stopPolling(),this.open=!1}disconnectedCallback(){super.disconnectedCallback(),this.seq++,this.stopPolling()}async recheck(){const e=this.batch;if(!(!e||this.busy)){this.busy=!0,this.line="";try{this.batch=await I().recheck(e.batch_id),this.arm(e.batch_id,this.seq)}catch(t){const s=t instanceof y?{status:t.status,code:t.code,user_message:t.body.user_message}:{status:0,code:"network"};this.line=or(s)}finally{this.busy=!1}}}nameOf(e){const t=e.camera_id?this.info[e.camera_id]?.name??e.camera_id:"—",s=e.camera_id?this.streams[`${e.camera_id}:${e.stream_ref}`]:"";return s?`${t} · ${s}`:t}row(e){const t=e.verify??null,s=t?Ja(t):Yt(this.batch?.verify)?"בבדיקה":"לא נבדק",a=e.camera_id?this.info[e.camera_id]?.channel:void 0;return o`<div class="row" role="listitem" data-nvr-verify-item=${e.index} data-outcome=${t?.outcome??""}>
      <span class="nm">${this.nameOf(e)}${a!==void 0?o` <span class="meta">ערוץ <span class="ltr">${a}</span></span>`:c}</span>
      <span class="chip ${Xa(t)}" data-nvr-verify-chip title=${s}>${s}</span>
      ${t?.detail?o`<span class="ln" data-nvr-verify-detail>${t.detail}</span>`:c}
    </div>`}renderReport(){const e=this.batch;if(!e)return o`<p class="msg" role="status">טוען…</p>${this.line?o`<p class="msg" role="alert">${this.line}</p>`:c}`;const t=$e(e,this.tab),s=ir(e),a=!!e.verify?.can_recheck&&!this.busy;return o`<p class="sum" data-nvr-verify-summary role="status">${rr(e.verify)||"אין בדיקה לשינוי הזה."}</p>
      <sw-tabs data-nvr-verify-tabs .items=${s} .active=${this.tab} group-label="דוח בדיקה" @change=${r=>this.tab=r.detail.id}></sw-tabs>
      ${t.length?o`<div class="list" role="list" aria-label="זרמים" data-nvr-verify-list=${this.tab}>${ke(t,r=>r.index,r=>this.row(r))}</div>`:o`<p class="msg" data-nvr-verify-empty role="status">${this.tab==="worklist"?"כל המצלמות השתנו.":"אין זרמים ברשימה הזו."}</p>`}
      <p class="hint" data-nvr-verify-hint>${Gt}</p>
      ${this.line?o`<p class="msg" data-nvr-verify-line role="alert">${this.line}</p>`:c}
      ${this.fromList?o`<sw-button slot="footer" variant="ghost" data-nvr-verify-back @click=${()=>void this.showList()}>לכל הדוחות</sw-button>`:c}
      <sw-button slot="footer" data-nvr-verify-recheck ?disabled=${!a} title=${Gt} @click=${()=>void this.recheck()}>${this.busy?"שולח…":"בדוק שוב"}</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-verify-close @click=${()=>this.close()}>סגור</sw-button>`}renderList(){const e=this.recent;return o`${e===null?o`<p class="msg" role="status">טוען…</p>`:e.length?o`<div class="list" role="list" aria-label="דוחות" data-nvr-verify-reports>${ke(e,t=>t.batch_id,t=>o`<button type="button" class="pick" role="listitem" data-nvr-verify-open=${t.batch_id} @click=${()=>void this.show(t.batch_id,!0)}>${cr(t)}</button>`)}</div>`:o`<p class="msg" data-nvr-verify-none role="status">אין עדיין דוחות של שינוי קידוד.</p>`}
      ${this.line?o`<p class="msg" role="alert">${this.line}</p>`:c}
      <sw-button slot="footer" variant="primary" data-nvr-verify-close @click=${()=>this.close()}>סגור</sw-button>`}render(){const e=this.batch,t=this.view==="list"?"דוחות בדיקה":e?nr(e):"דוח בדיקה",s=this.view==="report"&&e?Es(e.verify?.checked_at??e.created_at??null):"";return o`<sw-dialog wide ?open=${this.open} heading=${t} subheading=${s} data-nvr-verify data-view=${this.view} @close=${a=>{a.stopPropagation(),this.close()}}>${this.open?this.view==="list"?this.renderList():this.renderReport():c}</sw-dialog>`}};H.styles=Z`
    :host {
      display: contents;
    }
    .sum {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .hint {
      margin: 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .list {
      display: grid;
      align-content: start;
      max-block-size: clamp(180px, 46dvh, 440px);
      overflow-y: auto;
      overscroll-behavior: contain;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 2px 10px;
      align-items: center;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .nm {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ln {
      grid-column: 1 / -1;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .chip {
      justify-self: end;
      padding: 2px 8px;
      border-radius: var(--sw-r-pill, 999px);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium, 500);
      white-space: nowrap;
      max-inline-size: 46vw;
      overflow: hidden;
      text-overflow: ellipsis;
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .chip.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .chip.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .chip.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .pick {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .pick:hover {
      background: var(--sw-surface-2);
    }
    .pick:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .msg {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
  `;ee([S({attribute:!1})],H.prototype,"info",2);ee([S({attribute:!1})],H.prototype,"streams",2);ee([h()],H.prototype,"open",2);ee([h()],H.prototype,"view",2);ee([h()],H.prototype,"fromList",2);ee([h()],H.prototype,"batch",2);ee([h()],H.prototype,"recent",2);ee([h()],H.prototype,"tab",2);ee([h()],H.prototype,"line",2);ee([h()],H.prototype,"busy",2);H=ee([Y("nvr-verify-report")],H);var ei=Object.defineProperty,ti=Object.getOwnPropertyDescriptor,P=(e,t,s,a)=>{for(var r=a>1?void 0:a?ti(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&ei(t,s,r),r};const cs="ה־NVR אינו זמין. מוצגים הערכים האחרונים.",tt="מתבצע שינוי מרובה",ds=[{id:"channel",label:"ערוץ",sort:"channel"},{id:"camera",label:"מצלמה",sort:"camera"},{id:"role",label:"זרם",sort:"role"},{id:"codec",label:"קידוד",sort:"codec"},{id:"svc",label:"SVC",sort:"svc"},{id:"resolution",label:"רזולוציה",sort:"resolution"},{id:"fps",label:"FPS",sort:"fps"},{id:"bitrate",label:"קצב",sort:"bitrate"},{id:"gop",label:"GOP",sort:"gop"},{id:"webrtc",label:"WebRTC",sort:"webrtc"}],si=o`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>`,ai=o`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>`;let T=class extends W{constructor(){super(...arguments),this.bubbleSkin=new wt(this),this.data=null,this.recorder=null,this.recorders=[],this.recorderFilter="",this.loading=!0,this.failure=null,this.filters={...Ue},this.sort={...zs},this.details=new Map,this.busy=new Set,this.lines=new Map,this.confirm=null,this.editing=null,this.toast=null,this.batch=null,this.seq=0,this.toasts=0}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(){this.toggleAttribute("data-rw",!!this.data?.can_write)}async load(){const e=++this.seq;this.loading=!0;try{const t=pe(),[s,a]=await Promise.all([t.cameras(),t.recorders().catch(()=>null)]);if(e!==this.seq)return;this.data=s,this.recorder=a?.recorders[0]??null,this.recorders=a?.recorders??[],this.failure=null,this.details=new Map,this.lines=new Map,s.stale&&!s.cameras.length?(this.data=null,this.failure={status:503,code:s.error??"source_unavailable",message:cs}):(this.prefetch(s,e),s.can_write&&!s.stale&&this.updateComplete.then(()=>this.batchEl()?.resume()))}catch(t){if(e!==this.seq)return;this.data=null,this.failure={status:t instanceof y?t.status:0,code:t instanceof y?t.code:"network",message:ge(t)}}finally{e===this.seq&&(this.loading=!1)}}async prefetch(e,t){if(!e.can_write||e.stale)return;const s=e.cameras.filter(p=>p.camera_id&&p.streams.length).map(p=>p.camera_id);let a=0;const r=new Map;let i=null;const n=()=>{i&&clearTimeout(i),i=null,!(t!==this.seq||!r.size)&&(this.commitDetails(new Map(r)),r.clear())},l=async()=>{for(;a<s.length&&t===this.seq;)await this.readCamera(s[a++],t,r),r.size>=25?n():i||(i=setTimeout(n,150))};await Promise.all([l(),l(),l()]),n()}commitDetails(e){if(this.details=new Map([...this.details,...e]),!this.data)return;const t=new Map;for(const[s,a]of e)a!=="error"&&a.camera.streams.length&&t.set(s,a.camera.streams);t.size&&(this.data={...this.data,cameras:this.data.cameras.map(s=>s.camera_id&&t.has(s.camera_id)?{...s,streams:t.get(s.camera_id)}:s)})}async readCamera(e,t=this.seq,s){let a;try{a=await pe().camera(e)}catch{a="error"}t===this.seq&&(s?s.set(e,a):this.commitDetails(new Map([[e,a]])))}cameraById(e){return this.data?.cameras.find(t=>t.camera_id===e)??null}streamOf(e,t){return this.cameraById(e)?.streams.find(s=>s.stream_ref===t)??null}ctrl(e,t){const s=this.data;if(!s||!t.cameraId)return{show:!1,enabled:!1,reason:""};const a=Ma(e,{camera_id:t.cameraId,online:t.online},t.stream,{canWrite:s.can_write,stale:s.stale,detail:this.details.get(t.cameraId)??null});return a.show&&this.batchRunning?{show:!0,enabled:!1,reason:tt}:a}get batchRunning(){return this.batch?.state==="running"}batchEl(){return this.renderRoot.querySelector("nvr-camera-batch")}cameraInfo(){const e={},t=this.multiRecorder;for(const s of this.data?.cameras??[])s.camera_id&&(e[s.camera_id]={name:t?`${s.name} · ${this.recorderName(s.recorder_id)}`:s.name,channel:s.channel});return e}streamRoles(){const e={};for(const t of this.data?.cameras??[])if(t.camera_id)for(const s of t.streams)e[`${t.camera_id}:${s.stream_ref}`]=j[s.role];return e}encEl(){return this.renderRoot.querySelector("nvr-encoding-batch")}openReport(e){const t=this.renderRoot.querySelector("nvr-verify-report");t&&(e?t.show(e):t.showList())}openEncoding(){this.batchRunning||(this.toast=null,this.encEl()?.open())}isBusy(e){return!!e.cameraId&&!!e.stream&&this.busy.has(`${e.cameraId}:${e.stream.stream_ref}`)}setBusy(e,t){const s=new Set(this.busy);t?s.add(e):s.delete(e),this.busy=s}setLine(e,t){const s=new Map(this.lines);t?s.set(e,t):s.delete(e),this.lines=s}replaceStream(e,t){const s=i=>({...t,writable:t.writable??i?.writable??null,not_writable_reason:t.not_writable_reason??i?.not_writable_reason??null}),a=i=>({...i,streams:i.streams.map(n=>n.stream_ref===t.stream_ref?s(n):n)});this.data&&(this.data={...this.data,cameras:this.data.cameras.map(i=>i.camera_id===e?a(i):i)});const r=this.details.get(e);r&&r!=="error"&&(this.details=new Map(this.details).set(e,{...r,camera:a(r.camera)}))}showToast(e,t={}){this.toast={n:++this.toasts,message:e,...t}}applyResult(e,t,s,a){const r=`${this.cameraById(e)?.recorder_id??"nvr-1"}:${this.cameraById(e)?.source_ref??""}:${t}`;if(s.ok){this.replaceStream(e,s.stream),a==="editor"&&(this.editing=null),this.setLine(r,null),s.kind==="undo"?this.showToast(s.rebootRequired?"השינוי בוטל. ה־NVR מבקש הפעלה מחדש.":"השינוי בוטל",s.rebootRequired?{reboot:!0}:{}):s.unchanged||!s.change?this.showToast("ללא שינוי"):this.showToast(s.rebootRequired?"נשמר. ה־NVR מבקש הפעלה מחדש.":"נשמר",{undo:{changeId:s.change.id,cameraId:e,ref:t},...s.rebootRequired?{reboot:!0}:{}});return}s.stream&&this.replaceStream(e,s.stream),a==="row"&&this.setLine(r,s.line.text),s.line.reload&&this.readCamera(e),s.code==="batch_in_progress"&&this.batchEl()?.resume()}onSvc(e,t){const s=t.stream;if(e.target.checked=s?.svc===!0,!s||!t.cameraId||this.isBusy(t)||!this.ctrl("svc",t).enabled)return;const a={svc:s.svc!==!0};this.setLine(t.key,null);const r=Rs(t.cameraName,s,a),i=this.batchCandidates();a.svc===!1&&this.data?.can_batch===!0&&i.length>=2&&i.some(n=>n.cameraId===t.cameraId)&&(r.extraLabel="החל גם על מצלמות נוספות"),this.confirm={model:r,cameraId:t.cameraId,ref:s.stream_ref,changes:a}}recorderIds(){return[...new Set((this.data?.cameras??[]).map(e=>e.recorder_id))]}get multiRecorder(){return this.recorderIds().length>1}recorderName(e){return this.recorders.find(t=>t.recorder_id===e)?.name??e}batchRecorder(){return this.multiRecorder&&(this.recorderFilter||this.recorderIds()[0])||null}batchCandidates(){const e=this.data,t=this.batchRecorder();return e?hr(e.cameras,this.details,e.stale).filter(s=>!t||s.recorderId===t):[]}openBatch(){const e=this.confirm;this.confirm=null,e&&this.batchEl()?.openSelect(e.cameraId)}onBatchFinished(e){const t=vr(e);this.showToast(t.message,t.undo?{batchUndo:e.batch_id,batchMode:e.mode}:{})}async confirmed(){const e=this.confirm;this.confirm=null;const t=e&&this.streamOf(e.cameraId,e.ref);if(!e||!t)return;const s=`${e.cameraId}:${e.ref}`;this.toast=null,this.setBusy(s,!0);const a=await Os(e.cameraId,t,e.changes);this.setBusy(s,!1),this.applyResult(e.cameraId,e.ref,a,"row")}async undoToast(){const e=this.toast;if(e?.batchUndo&&!e.busy){const i=e.batchUndo;this.toast=null,await this.batchEl()?.undoAll(i);return}if(!e?.undo||e.busy)return;const{changeId:t,cameraId:s,ref:a}=e.undo;this.toast={...e,busy:!0},this.setBusy(`${s}:${a}`,!0);const r=await Ts(t);this.setBusy(`${s}:${a}`,!1),this.toast=null,this.applyResult(s,a,r,"row")}openEditor(e){!e.cameraId||!e.stream||!this.ctrl("edit",e).enabled||this.isBusy(e)||(this.toast=null,this.setLine(e.key,null),this.editing={cameraId:e.cameraId,ref:e.stream.stream_ref})}renderSvc(e){const t=this.ctrl("svc",e),s=e.stream;if(!t.show||!s)return $a(s);const a=this.isBusy(e),r=`SVC · ${e.cameraName} · ${j[s.role]}`;return o`<span class="swc ${a?"pending":""}"><sw-toggle data-svc-toggle .checked=${s.svc===!0} ?disabled=${!t.enabled||a} label=${r} labelHidden title=${t.reason||c}
      aria-busy=${a?"true":"false"} @change=${i=>this.onSvc(i,e)}></sw-toggle>${a?o`<span class="spin" role="status" aria-label="שומר" data-pending></span>`:c}</span>`}renderPen(e){const t=this.ctrl("edit",e);return!t.show||!e.stream?c:o`<button type="button" class="pen" data-edit-stream aria-label=${`עריכה · ${e.cameraName} · ${j[e.stream.role]}`} title=${t.reason||"עריכה"} ?disabled=${!t.enabled||this.isBusy(e)} @click=${()=>this.openEditor(e)}><sw-icon name="edit" size="16"></sw-icon></button>`}renderEditor(){const e=this.editing,t=e?this.cameraById(e.cameraId):null,s=e?this.streamOf(e.cameraId,e.ref):null,a=e?this.details.get(e.cameraId):null,r=s&&a&&a!=="error"?a.options?.[s.stream_ref]??null:null;return o`<nvr-camera-editor ?open=${!!(e&&t&&s&&r)} .camera=${t} .stream=${s} .options=${r}
      @close=${()=>this.editing=null} @written=${i=>e&&this.applyResult(e.cameraId,e.ref,i.detail.result,"editor")}></nvr-camera-editor>`}renderToast(){const e=this.toast;return e?Bs(e.n,o`<nvr-undo-toast message=${e.message} actionLabel=${e.batchUndo?e.batchMode==="encoding"?ys("encoding"):"בטל":e.undo?"בטל":""} linkLabel=${e.reboot?"ל־NVR":""} linkHref=${e.reboot?"#/system/security/nvr":""} ?busy=${!!e.busy}
      @undo=${()=>void this.undoToast()} @dismiss=${()=>!e.busy&&(this.toast=null)}></nvr-undo-toast>`):c}patch(e){this.filters={...this.filters,...e}}select(e,t,s,a){return o`<sw-field><select aria-label=${e} data-nvr-filter=${a} .value=${this.filters[t]} @change=${r=>this.patch({[t]:r.target.value})}>
      ${s.map(([r,i])=>o`<option value=${r} ?selected=${r===this.filters[t]}>${i}</option>`)}
    </select></sw-field>`}renderToolbar(e,t){const s=this.filters;return o`<div class="toolbar" data-nvr-toolbar>
      <sw-field class="search"><input type="search" placeholder="חיפוש מצלמה, קידוד, רזולוציה" aria-label="חיפוש" data-nvr-search .value=${s.q} @input=${a=>this.patch({q:a.target.value})} /></sw-field>
      ${this.multiRecorder?o`<sw-field><select aria-label="NVR" data-nvr-filter="recorder" .value=${this.recorderFilter} @change=${a=>this.recorderFilter=a.target.value}>
            <option value="" ?selected=${!this.recorderFilter}>כל ה־NVR</option>
            ${this.recorderIds().map(a=>o`<option value=${a} ?selected=${a===this.recorderFilter}>${this.recorderName(a)}</option>`)}
          </select></sw-field>`:c}
      ${this.select("קידוד","codec",[["","כל הקידודים"],["h264","H.264"],["h265","H.265"],["other","אחר"]],"codec")}
      ${this.select("סוג זרם","role",[["","כל הזרמים"],["main","ראשי"],["sub","משני"],["other","נוסף"]],"role")}
      ${this.select("SVC","svc",[["","כל ה־SVC"],["on","SVC פעיל"],["off","SVC כבוי"],["none","ללא SVC"]],"svc")}
      ${this.select("WebRTC","webrtc",[["","כל ה־WebRTC"],["ok","מתנגן"],["no","לא מתנגן"],["unknown","לא ידוע"]],"webrtc")}
      ${Ft(s)||this.recorderFilter?o`<sw-button size="sm" variant="ghost" data-nvr-clear @click=${()=>{this.filters={...Ue},this.recorderFilter=""}}>נקה</sw-button>`:c}
      ${this.data?.can_write&&this.data.can_batch===!0&&!this.data.stale&&!He()?o`<sw-button size="sm" data-nvr-encoding-open ?disabled=${this.batchRunning} title=${this.batchRunning?tt:""} @click=${()=>this.openEncoding()}>שינוי קידוד לכמה מצלמות</sw-button>`:c}
      <sw-button size="sm" icon="refresh" data-nvr-refresh ?disabled=${this.loading} @click=${()=>void this.load()}>רענון</sw-button>
      <span class="count" data-nvr-count>${Ft(s)||this.recorderFilter?`${e} מתוך ${t} זרמים`:`${t} זרמים`}</span>
    </div>`}headerCell(e){const t=this.sort.key===e.sort,s=t?this.sort.dir==="asc"?"ascending":"descending":"none";return o`<th scope="col" class=${e.id==="channel"?"c-chan":""} aria-sort=${s} data-col=${e.id}>
      ${e.sort?o`<button type="button" data-nvr-sort=${e.sort} @click=${()=>this.sort=Ta(this.sort,e.sort)}>${e.label}<span class="arrow" aria-hidden="true">${t?this.sort.dir==="asc"?"▲":"▼":""}</span></button>`:o`<span style="padding:9px 10px;display:inline-block">${e.label}</span>`}
    </th>`}verdict(e){const t=e.stream?.webrtc??"unknown",s=e.stream!==null;return o`<span class="v ${s?t:"unknown"}" role="img" aria-label=${s?Ht[t]:K} title=${s?Ht[t]:""} data-verdict=${s?t:"none"}>${s?t==="ok"?si:t==="no"?ai:K:K}</span>`}renderRow(e,t){const s=e[t],a=s.stream,r=Ea(e,t),i=this.lines.get(s.key);return o`<tr class="${r?"first":"repeat"} ${s.enabledInArx?"":"off"} ${s.online===!1?"down":""}" data-stream-row data-camera=${s.cameraKey} data-stream=${a?.stream_ref??""}>
      <td class="muted c-chan" data-col="channel"><span class="ltr">${s.channel}</span></td>
      <td data-col="camera"><span class="cam">${s.online===!1?o`<span class="dot" title="לא מקוונת" data-offline></span>`:c}${s.cameraName}</span>${this.multiRecorder?o`<span class="muted" data-nvr-recorder> · ${this.recorderName(s.recorderId)}</span>`:c}<span class="chan muted"> ערוץ <span class="ltr">${s.channel}</span></span></td>
      <td data-col="role">${a?j[a.role]:o`<span class="muted" data-unread>לא נקרא</span>`}</td>
      <td data-col="codec"><span class="ltr">${this.codecCell(a)}${a?.profile?o` <bdi class="muted">${a.profile}</bdi>`:c}</span></td>
      <td data-col="svc">${this.renderSvc(s)}</td>
      <td data-col="resolution"><bdi class="ltr">${nt(a)}</bdi></td>
      <td data-col="fps"><span class="ltr">${At(a)}</span></td>
      <td data-col="bitrate"><span class="ltr"><bdi>${Vt(a)}</bdi>${a?.bitrate_mode&&a.bitrate_kbps?o` <span class="muted">${a.bitrate_mode}</span>`:c}</span></td>
      <td data-col="gop"><span class="ltr">${Dt(a?.gop)}</span></td>
      <td data-col="webrtc">${this.verdict(s)}</td>
      ${this.data?.can_write?o`<td data-col="edit" class="act">${this.renderPen(s)}</td>`:c}
    </tr>${i?o`<tr class="msg" data-row-line-row><td colspan=${ds.length+1} data-nvr-line role="status">${i}</td></tr>`:c}`}codecCell(e){return _a(e)?o`<bdi class="h265" data-h265-badge title=${St} aria-label=${`${_e(e)} · ${St}`}>${_e(e)}</bdi>`:o`<bdi>${_e(e)}</bdi>`}renderCard(e){const t=e.stream;return o`<div class="card ${e.enabledInArx?"":"off"} ${e.online===!1?"down":""}" data-stream-card data-camera=${e.cameraKey} data-stream=${t?.stream_ref??""}>
      <div class="head"><span class="cam">${e.online===!1?o`<span class="dot" title="לא מקוונת"></span>`:c}${e.cameraName}</span>${this.multiRecorder?o`<span class="muted" data-nvr-recorder>${this.recorderName(e.recorderId)}</span>`:c}<span class="muted">ערוץ <span class="ltr">${e.channel}</span></span><span style="margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px">${this.verdict(e)}${this.renderPen(e)}</span></div>
      ${t?o`<div class="line"><span>${j[t.role]}</span><span class="ltr">${this.codecCell(t)}</span><bdi class="ltr">${nt(t)}</bdi><span class="ltr">${At(t)}</span></div>
          <div class="line facts"><span class="svcline">SVC ${this.renderSvc(e)}</span><bdi class="ltr">${Vt(t)}${t.bitrate_mode&&t.bitrate_kbps?` ${t.bitrate_mode}`:""}</bdi><span>GOP <span class="ltr">${Dt(t.gop)}</span></span>${t.profile?o`<bdi class="ltr muted">${t.profile}</bdi>`:c}</div>`:o`<div class="line muted" data-unread>לא נקרא</div>`}
      ${this.lines.get(e.key)?o`<div class="msgline" data-nvr-line role="status">${this.lines.get(e.key)}</div>`:c}
    </div>`}renderBody(){const e=this.data;if(!e)return c;const t=xa(e.cameras),s=this.multiRecorder?this.recorderFilter:"",a=Oa(Sa(s?t.filter(n=>n.recorderId===s):t,this.filters),this.sort),r=Ca(t),i=t.length?a.length?o`<div class="wrap" data-nvr-table>
              <table>
                <thead><tr>${ds.map(n=>this.headerCell(n))}${e.can_write?o`<th scope="col" data-col="edit"><span class="vh">עריכה</span></th>`:c}</tr></thead>
                <tbody>${a.map((n,l)=>this.renderRow(a,l))}</tbody>
              </table>
            </div>
            <div class="cards" data-nvr-cards>${a.map(n=>this.renderCard(n))}</div>`:o`<sw-state-panel icon="filter" state="empty" heading="אין זרמים שמתאימים לסינון." actionLabel="נקה סינון" data-nvr-no-match @action=${()=>this.filters={...Ue}}></sw-state-panel>`:o`<sw-state-panel icon="camera" state="empty" heading="לא נמצאו מצלמות ב־NVR." actionLabel="רענן" data-nvr-empty @action=${()=>void this.load()}></sw-state-panel>`;return o`
      ${this.batchRunning&&this.batch?this.renderStrip(this.batch):c}
      ${e.stale?o`<div class="note" data-nvr-stale role="status"><span>${cs}</span><sw-button size="sm" data-nvr-retry ?disabled=${this.loading} @click=${()=>void this.load()}>נסה שוב</sw-button></div>`:c}
      ${t.length?this.renderToolbar(a.length,r.streams):c}
      ${i}`}renderStrip(e){const t=Ke(e);return o`<div class="note" data-nvr-batch-strip role="status"><span data-nvr-batch-strip-text>${tt} · <span class="ltr">${t.processed}</span> מתוך <span class="ltr">${t.total}</span></span><sw-button size="sm" data-nvr-batch-show @click=${()=>this.batchEl()?.show()}>הצג</sw-button></div>`}renderBatch(){const e=this.data;return e?.can_write?o`<nvr-camera-batch .candidates=${this.batchCandidates()} .info=${this.cameraInfo()} .streams=${this.streamRoles()}
      @batch-change=${t=>this.batch=t.detail.batch}
      @batch-finished=${t=>this.onBatchFinished(t.detail.batch)}
      @batch-refresh=${()=>void this.load()}
      @verify-report=${t=>this.openReport(t.detail.batchId)}
      @encoding-open=${()=>this.openEncoding()}></nvr-camera-batch>
      ${e.can_batch===!0?o`<nvr-encoding-batch .rows=${Cr(e.cameras,this.details,e.stale)} .details=${this.details}
            @verify-reports=${()=>this.openReport(null)}
            @encoding-started=${t=>void this.batchEl()?.followBatch(t.detail.batch)}></nvr-encoding-batch>
          <nvr-verify-report .info=${this.cameraInfo()} .streams=${this.streamRoles()}></nvr-verify-report>`:c}`:c}subheading(){if(this.multiRecorder)return this.recorderFilter?this.recorderName(this.recorderFilter):`${this.recorderIds().length} מקליטים`;const e=this.recorder;return e?[e.name,e.model].filter(Boolean).join(" · "):""}render(){const e=this.failure;let t;return this.loading&&!this.data?t=o`<sw-state-panel state="loading" data-nvr-loading></sw-state-panel>`:e?.status===403?t=o`<sw-state-panel state="forbidden" data-nvr-forbidden></sw-state-panel>`:e?.code==="nvr_not_configured"?t=o`<sw-state-panel icon="camera" state="empty" heading="אין NVR מחובר" actionLabel="לחיבורים" data-nvr-none @action=${()=>window.location.hash="#/system/setup"}></sw-state-panel>`:e?t=o`<sw-state-panel state="error" heading="ה־NVR אינו זמין." hint=${e.status===503?"":e.message} actionLabel="נסה שוב" data-nvr-error @action=${()=>void this.load()}></sw-state-panel>`:t=this.renderBody(),o`<sw-page crumbs="הגדרות | אבטחה" heading="הגדרות מצלמות" subheading=${this.subheading()}><div data-nvr-cameras data-state=${this.loading&&!this.data?"loading":e?"error":this.data?.stale?"stale":"ready"} style="display:contents">${t}</div></sw-page>
      ${this.data?.can_write?this.renderEditor():c}
      ${this.renderBatch()}
      <nvr-confirm .model=${this.confirm?.model??null} @confirm=${()=>void this.confirmed()} @cancel=${()=>this.confirm=null} @extra=${()=>this.openBatch()}></nvr-confirm>
      ${this.renderToast()}`}};T.styles=[Z`
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .toolbar sw-field {
      inline-size: 150px;
    }
    .toolbar sw-field.search {
      inline-size: 240px;
    }
    .count {
      margin-inline-start: auto;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .note {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 8px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-stale-soft);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .wrap {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      overflow-x: auto;
      max-inline-size: 100%;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th,
    td {
      padding: 8px 10px;
      text-align: start;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      white-space: nowrap;
    }
    th {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface);
      padding: 0;
    }
    th button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 9px 10px;
      cursor: pointer;
      color: inherit;
      font: inherit;
    }
    th button:hover,
    th[aria-sort='ascending'] button,
    th[aria-sort='descending'] button {
      color: var(--sw-text);
    }
    th button:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
      border-radius: var(--sw-r-2xs);
    }
    .arrow {
      inline-size: 8px;
      font-size: var(--sw-fs-2xs);
      color: var(--sw-accent-text);
    }
    tbody tr.first td {
      border-block-start: 2px solid var(--sw-border);
    }
    tbody tr:first-child td {
      border-block-start: 0;
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    tbody tr:hover {
      background: var(--sw-surface-2);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
      display: inline-block;
    }
    .muted {
      color: var(--sw-text-3);
    }
    /* LIVE-H265-2341: the H.265 badge (its title carries the Hebrew hint) */
    .h265 {
      display: inline-block;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--sw-warning-soft);
      color: var(--sw-text);
      font-size: var(--sw-fs-2xs);
      font-weight: 600;
      cursor: help;
    }
    .repeat .cam {
      color: var(--sw-text-3);
    }
    .off .cam {
      color: var(--sw-text-3);
    }
    .dot {
      display: inline-block;
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-text-3);
      margin-inline-end: 6px;
      vertical-align: middle;
    }
    .v {
      display: inline-grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border-radius: 50%;
    }
    .v.ok {
      color: var(--sw-success-text);
      background: var(--sw-success-soft);
    }
    .v.no {
      color: var(--sw-danger-text);
      background: var(--sw-danger-soft);
    }
    .v.unknown {
      color: var(--sw-text-3);
    }
    .chan {
      display: none;
      font-size: var(--sw-fs-xs);
    }
    /* tablet widths: the channel folds into the camera cell and the cells tighten, so all columns fit without scrolling */
    @media (max-width: 1100px) {
      .c-chan {
        display: none;
      }
      .chan {
        display: inline;
      }
      th button {
        padding: 8px 6px;
      }
      td {
        padding: 7px 6px;
      }
    }
    /* S2: the SVC switch, the pencil, the pending spinner and the one muted line under a row */
    .vh {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    td.act {
      inline-size: 1%;
      text-align: end;
    }
    .swc {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    sw-toggle {
      vertical-align: middle;
    }
    .spin {
      inline-size: 14px;
      block-size: 14px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      border-block-start-color: var(--sw-accent);
      animation: nvr-spin 0.8s linear infinite;
    }
    @keyframes nvr-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spin {
        animation: none;
      }
    }
    .pen {
      all: unset;
      box-sizing: border-box;
      display: inline-grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .pen:hover:not([disabled]) {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .pen:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .pen[disabled] {
      opacity: 0.45;
      cursor: not-allowed;
    }
    tr.msg td {
      white-space: normal;
      color: var(--sw-text-2);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .msgline {
      color: var(--sw-text-2);
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      padding: 6px 8px;
      font-size: var(--sw-fs-sm);
    }
    .svcline {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    /* touch layouts: the switch's box and the pencil are 44 px targets */
    @media (max-width: 1100px) {
      sw-toggle {
        padding: 10px 1px;
      }
      .pen {
        inline-size: 44px;
        block-size: 44px;
      }
      /* the toolbar's fields and the sort headers are 44 px targets in touch layouts (layout guard) */
      .toolbar sw-field select,
      .toolbar sw-field input {
        min-block-size: 44px;
      }
      th button {
        min-block-size: 44px;
        min-inline-size: 44px;
        justify-content: center;
      }
    }
    .cards {
      display: none;
    }
    .card {
      display: grid;
      gap: 3px;
      padding: 10px 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      font-size: var(--sw-fs-sm);
    }
    .card .head {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
    }
    .card .line {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      align-items: center;
    }
    .card .facts {
      color: var(--sw-text-2);
    }
    @media (max-width: 767px) {
      .wrap {
        display: none;
      }
      .cards {
        display: grid;
        gap: 8px;
      }
      .toolbar sw-field,
      .toolbar sw-field.search {
        inline-size: calc(50% - 4px);
      }
      .toolbar sw-field.search {
        inline-size: 100%;
      }
      .count {
        inline-size: 100%;
        margin: 0;
      }
    }
    /* S2: with the switch and pencil columns the table needs about 900 px; a holder of nvr.configure gets the cards below that */
    @media (max-width: 899px) {
      :host([data-rw]) .wrap {
        display: none;
      }
      :host([data-rw]) .cards {
        display: grid;
        gap: 8px;
      }
      :host([data-rw]) .toolbar sw-field,
      :host([data-rw]) .toolbar sw-field.search {
        inline-size: calc(50% - 4px);
      }
      :host([data-rw]) .toolbar sw-field.search {
        inline-size: 100%;
      }
      :host([data-rw]) .count {
        inline-size: 100%;
        margin: 0;
      }
    }
    /* R5-LIVE-297 (the HOMEFABLE method on the cameras settings, columns and order untouched): the table is the one card of the screen
       (radius lg); its head is a tinted band with 12.5 px semibold labels instead of grey 11 px; each camera opens with its name in
       14 px bold heading ink and its second stream is quieter; a camera that is down is a FILLED offline row (the tint across the
       row, a solid dot) instead of a 7 px grey dot; the pencil is a raised key that sinks on press; the count is a bold numeral;
       row and key hovers only under a fine pointer */
    .wrap {
      border-radius: var(--sw-r-lg);
    }
    th {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    th button {
      padding-block: 11px;
    }
    td {
      padding-block: 10px;
    }
    tbody tr.first td[data-col='camera'] .cam {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    tbody tr.repeat td {
      color: var(--sw-text-2);
    }
    tbody tr.first td {
      border-block-start: 1px solid var(--sw-border-strong);
    }
    tbody tr:first-child td {
      border-block-start: 0;
    }
    tbody tr.down td {
      background: color-mix(in srgb, var(--sw-offline) 26%, var(--sw-surface)); /* loop 1: 16 % vanished on white */
    }
    tbody tr.down td[data-col='camera'] .cam {
      color: var(--sw-text-2);
    }
    .dot {
      inline-size: 9px;
      block-size: 9px;
      background: var(--sw-offline);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sw-offline) 30%, transparent);
      margin-inline-end: 8px;
    }
    tbody tr:hover {
      background: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      tbody tr:not(.msg):hover td {
        background: var(--sw-surface-2);
      }
      tbody tr.down:hover td {
        background: color-mix(in srgb, var(--sw-offline) 24%, var(--sw-surface));
      }
    }
    .v {
      inline-size: 26px;
      block-size: 26px;
    }
    .count {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .pen {
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-heading);
      box-shadow: var(--sw-shadow-1);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition: background-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .pen:hover:not([disabled]) {
      background: var(--sw-surface);
      color: var(--sw-heading);
    }
    @media (hover: hover) and (pointer: fine) {
      .pen:hover:not([disabled]) {
        background: var(--sw-surface-2);
        box-shadow: var(--sw-shadow-2);
      }
    }
    .pen:active:not([disabled]) {
      transform: scale(var(--sw-press-scale, 0.92));
      box-shadow: none;
      background: var(--sw-pressed-wash);
    }
    .pen[disabled] {
      box-shadow: none;
      background: transparent;
    }
    .card {
      gap: 6px;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
    }
    .card .head .cam {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .card .line:not(.facts) {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .card .facts {
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    /* break-ui (cams-worst, 390 px): a long camera name ran past the card's edge and pushed the WebRTC mark and the pencil off the
       screen - the name takes the head's first line and wraps, the mark and the pencil keep their own line end */
    .card .head {
      flex-wrap: wrap;
    }
    .card .head .cam {
      flex: 1 1 auto;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    /* break-ui (desktop): a long name widened the whole table into a sideways scroll - the name is clamped to one line at 280 px */
    td[data-col='camera'] .cam {
      display: inline-block;
      max-inline-size: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }
    .card.down {
      background: color-mix(in srgb, var(--sw-offline) 26%, var(--sw-surface));
    }
    @media (prefers-reduced-motion: reduce) {
      .pen:active:not([disabled]) {
        transform: none;
      }
    }
    /* R5-LIVE-297 Fable pass (the Opus table still read as hairlines at one weight): the head is a 13 px / 700 band in the heading ink
       on surface-3; a camera's rows are separated by a 6 px step in the page tone (no 1 px line between cameras); the camera's name is
       15 px / 800, its main stream's codec and resolution 14 px / 700 in the heading ink, the second stream quiet; the WebRTC mark 28
       px; the pencil a 36 px raised key; the phone card's stream word is a filled tag */
    .wrap {
      border-color: transparent;
      box-shadow: var(--sw-shadow-2);
    }
    th {
      background: var(--sw-surface-3);
      color: var(--sw-heading);
      font-weight: var(--sw-fw-bold);
    }
    th button {
      padding-block: 12px;
    }
    td {
      padding-block: 11px;
      border-block-end: 0;
    }
    tbody tr.first td {
      border-block-start: 6px solid var(--sw-bg);
    }
    tbody tr:first-child td {
      border-block-start: 0;
    }
    tbody tr.first td[data-col='camera'] .cam {
      font-size: var(--sw-fs-lg);
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    tbody tr.first td[data-col='codec'],
    tbody tr.first td[data-col='resolution'] {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    tbody tr.repeat td {
      background: var(--sw-surface-2);
    }
    tbody tr.repeat td[data-col='camera'] .cam {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    tbody tr.down td,
    tbody tr.down.repeat td {
      background: color-mix(in srgb, var(--sw-offline) 26%, var(--sw-surface));
    }
    .v {
      inline-size: 28px;
      block-size: 28px;
    }
    .pen {
      inline-size: 36px;
      block-size: 36px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    .count {
      font-size: var(--sw-fs-lg);
      font-weight: 800;
    }
    .card {
      border-color: transparent;
      box-shadow: var(--sw-shadow-2);
    }
    .card .head .cam {
      font-size: var(--sw-fs-lg);
      font-weight: 800;
    }
    .card .line:not(.facts) > :first-child {
      display: inline-flex;
      align-items: center;
      min-block-size: 24px;
      padding: 0 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 1100px) {
      .pen {
        inline-size: 44px;
        block-size: 44px;
      }
      /* GATE-FIX-2270: at a tablet width the R5 band (13 px / 700 labels) and the 15 px / 800 name widened the table past its card
         (a sideways scroll at 820 px); there the labels keep the compact 11 px size and the name and the main stream's codec and
         resolution the table's own size (the name still bold) - all still in the heading ink */
      th {
        font-size: var(--sw-fs-xs);
      }
      tbody tr.first td[data-col='camera'] .cam {
        font-size: inherit;
      }
      tbody tr.first td[data-col='codec'],
      tbody tr.first td[data-col='resolution'] {
        font-weight: var(--sw-fw-regular);
      }
    }
  `,Re];P([h()],T.prototype,"data",2);P([h()],T.prototype,"recorder",2);P([h()],T.prototype,"recorders",2);P([h()],T.prototype,"recorderFilter",2);P([h()],T.prototype,"loading",2);P([h()],T.prototype,"failure",2);P([h()],T.prototype,"filters",2);P([h()],T.prototype,"sort",2);P([h()],T.prototype,"details",2);P([h()],T.prototype,"busy",2);P([h()],T.prototype,"lines",2);P([h()],T.prototype,"confirm",2);P([h()],T.prototype,"editing",2);P([h()],T.prototype,"toast",2);P([h()],T.prototype,"batch",2);T=P([Y("system-security-cameras")],T);const st=encodeURIComponent,ye={readMask:e=>A(`cameras/${st(e)}/privacy-mask`),previewMasks:e=>X("nvr/privacy-masks/preview",{items:e}),applyMasks:e=>X("nvr/privacy-masks/apply",{items:e,confirm:!0}),changes:(e,t=20)=>A(`nvr/changes?camera_id=${st(e)}&limit=${t}`),undoChange:e=>X(`nvr/changes/${st(e)}/rollback`,{confirm:!0})},_t={tab:"מסכות פרטיות",crumbs:"הגדרות | אבטחה",heading:"מסכות פרטיות",cameras:"מצלמות",camera_edited:"נערכה",snapshot_alt:"תמונה מהמצלמה {name}",no_picture:"אין תמונה מהמצלמה",mask_on:"מסכה פעילה",add_region:"הוספת אזור",delete_region:"מחיקת אזור",discard:"ביטול השינויים",region_n:"אזור {n}",region_poly:"אזור {n} (צורה חופשית)",regions_count:"{n} מתוך {max} אזורים",region_keys:"חצים מזיזים. Shift וחצים משנים גודל. Delete מוחק.",corner:"פינה {name}",corner_tl:"שמאלית עליונה",corner_tr:"ימנית עליונה",corner_bl:"שמאלית תחתונה",corner_br:"ימנית תחתונה",review:"בדיקת השינויים ({n})",reviewing:"קורא את המצלמות…",back:"חזרה לעריכה",next:"המשך לאישור",write:"כתיבה ל־NVR",cancel:"ביטול",preview_title:"לפני ואחרי",before:"לפני",after:"אחרי",st_ready:"ייכתב",st_unchanged:"ללא שינוי",st_invalid:"לא תקין",st_skipped:"לא ייכתב",confirm_title:"כתיבת מסכות פרטיות",confirm_lead:"המסכה מכסה את התמונה בצפייה החיה ובהקלטה. הכתיבה נשלחת רק עכשיו, פעם אחת.",confirm_count:"{n} מצלמות ייכתבו",confirm_count_one:"מצלמה אחת תיכתב",applying:"כותב…",result_title:"תוצאות הכתיבה",res_applied:"נכתב ואומת",res_unchanged:"ללא שינוי",res_skipped:"לא נכתב",res_failed:"הכתיבה נכשלה",res_not_attempted:"לא נוסה",restored:"המקור הוחזר",not_restored:"המקור לא אומת, יש לבדוק במצלמה",undo:"ביטול הכתיבה",undoing:"מחזיר…",undone:"הוחזר למצב הקודם",done:"סיום",log_title:"היסטוריית שינויים",log_empty:"עדיין לא נכתבו מסכות במצלמה הזו",log_applied:"נכתב",log_rolled_back:"בוטל",log_failed:"נכשל",log_diverged:"לא אומת",log_other:"אחר",off_switch:"כתיבת מסכות פרטיות כבויה בהגדרות המערכת, ולכן אפשר רק לצפות. מנהל מערכת יכול להפעיל אותה.",off_perm:"אין לך הרשאה לשנות מסכות פרטיות, ולכן אפשר רק לצפות.",off_remote:"מסכות פרטיות משתנות רק ברשת המקומית, ולכן אפשר רק לצפות.",loading:"טוען",retry:"נסו שוב",err_cameras:"רשימת המצלמות לא נטענה",err_mask:"המסכה של המצלמה לא נקראה",forbidden:"אין הרשאה לצפות במסכות פרטיות",empty_cameras:"אין מצלמות לעריכה",inv_need_region:"מסכה פעילה צריכה לפחות אזור אחד",inv_too_many:"מותרים עד {max} אזורים",inv_too_small:"אזור קטן מדי",e_feature_disabled:"כתיבת מסכות פרטיות כבויה בהגדרות המערכת.",e_forbidden:"אין הרשאה לפעולה הזו.",e_stale:"המסכה במצלמה השתנתה מאז הבדיקה. יש לבדוק שוב.",e_validation:"המסכה אינה תקינה למצלמה הזו.",e_nvr_not_supported:"המצלמה אינה תומכת במסכות פרטיות.",e_source_forbidden:"המצלמה אינה זמינה לכתיבה.",e_changed_since:"המסכה במצלמה שונתה מאז, ולכן אין החזרה אוטומטית.",e_not_rollbackable:"אי אפשר להחזיר את השינוי הזה.",e_nvr_verify_mismatch:"ההחזרה לא אומתה. יש לבדוק את המצלמה.",e_generic:"הפעולה נכשלה. לא נשלח דבר נוסף.",sw_label:"כתיבת מסכות פרטיות ל-NVR",sw_confirm:"שום דבר לא נכתב לפני לחיצה על כפתור הכתיבה בכל פעם.",sw_turn_on:"הפעלה",sw_saving:"שומר…",sw_err:"השינוי לא נשמר. נסו שוב."},ri={tab:"Privacy masks",crumbs:"Settings | Security",heading:"Privacy masks",cameras:"Cameras",camera_edited:"edited",snapshot_alt:"Picture from camera {name}",no_picture:"No picture from the camera",mask_on:"Mask on",add_region:"Add region",delete_region:"Delete region",discard:"Discard changes",region_n:"Region {n}",region_poly:"Region {n} (free shape)",regions_count:"{n} of {max} regions",region_keys:"Arrow keys move. Shift with arrows resizes. Delete removes.",corner:"Corner {name}",corner_tl:"top left",corner_tr:"top right",corner_bl:"bottom left",corner_br:"bottom right",review:"Review changes ({n})",reviewing:"Reading the cameras…",back:"Back to editing",next:"Continue to confirm",write:"Write to NVR",cancel:"Cancel",preview_title:"Before and after",before:"Before",after:"After",st_ready:"Will be written",st_unchanged:"No change",st_invalid:"Not valid",st_skipped:"Will not be written",confirm_title:"Write privacy masks",confirm_lead:"A mask covers the picture in live view and in the recording. The write is sent now, once.",confirm_count:"{n} cameras will be written",confirm_count_one:"One camera will be written",applying:"Writing…",result_title:"Write results",res_applied:"Written and verified",res_unchanged:"No change",res_skipped:"Not written",res_failed:"Write failed",res_not_attempted:"Not attempted",restored:"Original restored",not_restored:"Original not verified, check the camera",undo:"Undo write",undoing:"Restoring…",undone:"Restored to the previous state",done:"Done",log_title:"Change history",log_empty:"No masks written on this camera yet",log_applied:"Written",log_rolled_back:"Undone",log_failed:"Failed",log_diverged:"Not verified",log_other:"Other",off_switch:"Writing privacy masks is turned off in system settings, so this page is view only. A system administrator can turn it on.",off_perm:"You do not have permission to change privacy masks, so this page is view only.",off_remote:"Privacy masks can only be changed on the local network, so this page is view only.",loading:"Loading",retry:"Try again",err_cameras:"The camera list did not load",err_mask:"The camera mask could not be read",forbidden:"You do not have permission to view privacy masks",empty_cameras:"No cameras to edit",inv_need_region:"An active mask needs at least one region",inv_too_many:"Up to {max} regions are allowed",inv_too_small:"A region is too small",e_feature_disabled:"Writing privacy masks is turned off in system settings.",e_forbidden:"You do not have permission for this action.",e_stale:"The mask on the camera changed since the review. Review again.",e_validation:"The mask is not valid for this camera.",e_nvr_not_supported:"The camera does not support privacy masks.",e_source_forbidden:"The camera cannot be written to.",e_changed_since:"The mask on the camera changed since, so there is no automatic undo.",e_not_rollbackable:"This change cannot be undone.",e_nvr_verify_mismatch:"The restore was not verified. Check the camera.",e_generic:"The action failed. Nothing else was sent.",sw_label:"Write privacy masks to the NVR",sw_confirm:"Nothing is written until you press the write button each time.",sw_turn_on:"Turn on",sw_saving:"Saving…",sw_err:"The change was not saved. Try again."},ii={tab:"أقنعة الخصوصية",crumbs:"الإعدادات | الأمان",heading:"أقنعة الخصوصية",cameras:"الكاميرات",camera_edited:"تم التعديل",snapshot_alt:"صورة من الكاميرا {name}",no_picture:"لا توجد صورة من الكاميرا",mask_on:"القناع مفعّل",add_region:"إضافة منطقة",delete_region:"حذف المنطقة",discard:"تجاهل التغييرات",region_n:"المنطقة {n}",region_poly:"المنطقة {n} (شكل حر)",regions_count:"{n} من {max} مناطق",region_keys:"مفاتيح الأسهم تحرّك. Shift مع الأسهم يغيّر الحجم. Delete يحذف.",corner:"الزاوية {name}",corner_tl:"العلوية اليسرى",corner_tr:"العلوية اليمنى",corner_bl:"السفلية اليسرى",corner_br:"السفلية اليمنى",review:"مراجعة التغييرات ({n})",reviewing:"جارٍ قراءة الكاميرات…",back:"العودة إلى التحرير",next:"المتابعة إلى التأكيد",write:"الكتابة إلى NVR",cancel:"إلغاء",preview_title:"قبل وبعد",before:"قبل",after:"بعد",st_ready:"ستتم الكتابة",st_unchanged:"بدون تغيير",st_invalid:"غير صالح",st_skipped:"لن تتم الكتابة",confirm_title:"كتابة أقنعة الخصوصية",confirm_lead:"يغطي القناع الصورة في العرض المباشر وفي التسجيل. تُرسل الكتابة الآن مرة واحدة.",confirm_count:"ستتم الكتابة إلى {n} كاميرات",confirm_count_one:"ستتم الكتابة إلى كاميرا واحدة",applying:"جارٍ الكتابة…",result_title:"نتائج الكتابة",res_applied:"تمت الكتابة والتحقق",res_unchanged:"بدون تغيير",res_skipped:"لم تتم الكتابة",res_failed:"فشلت الكتابة",res_not_attempted:"لم تتم المحاولة",restored:"تمت استعادة الأصل",not_restored:"لم يتم التحقق من الأصل، افحص الكاميرا",undo:"التراجع عن الكتابة",undoing:"جارٍ الاستعادة…",undone:"تمت الاستعادة إلى الحالة السابقة",done:"إنهاء",log_title:"سجل التغييرات",log_empty:"لم تُكتب أقنعة على هذه الكاميرا بعد",log_applied:"تمت الكتابة",log_rolled_back:"تم التراجع",log_failed:"فشل",log_diverged:"لم يتم التحقق",log_other:"أخرى",off_switch:"كتابة أقنعة الخصوصية متوقفة في إعدادات النظام، لذلك الصفحة للعرض فقط. يمكن لمسؤول النظام تفعيلها.",off_perm:"ليست لديك صلاحية تغيير أقنعة الخصوصية، لذلك الصفحة للعرض فقط.",off_remote:"لا يمكن تغيير أقنعة الخصوصية إلا من الشبكة المحلية، لذلك الصفحة للعرض فقط.",loading:"جارٍ التحميل",retry:"حاول مرة أخرى",err_cameras:"تعذّر تحميل قائمة الكاميرات",err_mask:"تعذّرت قراءة قناع الكاميرا",forbidden:"ليست لديك صلاحية عرض أقنعة الخصوصية",empty_cameras:"لا توجد كاميرات للتحرير",inv_need_region:"القناع المفعّل يحتاج إلى منطقة واحدة على الأقل",inv_too_many:"يُسمح بحتى {max} مناطق",inv_too_small:"منطقة صغيرة جدًا",e_feature_disabled:"كتابة أقنعة الخصوصية متوقفة في إعدادات النظام.",e_forbidden:"ليست لديك صلاحية لهذا الإجراء.",e_stale:"تغيّر القناع في الكاميرا منذ المراجعة. راجع مرة أخرى.",e_validation:"القناع غير صالح لهذه الكاميرا.",e_nvr_not_supported:"الكاميرا لا تدعم أقنعة الخصوصية.",e_source_forbidden:"لا يمكن الكتابة إلى الكاميرا.",e_changed_since:"تغيّر القناع في الكاميرا منذ ذلك الحين، لذلك لا يوجد تراجع تلقائي.",e_not_rollbackable:"لا يمكن التراجع عن هذا التغيير.",e_nvr_verify_mismatch:"لم يتم التحقق من الاستعادة. افحص الكاميرا.",e_generic:"فشل الإجراء. لم يُرسل أي شيء آخر.",sw_label:"كتابة أقنعة الخصوصية إلى NVR",sw_confirm:"لا يُكتب شيء قبل الضغط على زر الكتابة في كل مرة.",sw_turn_on:"تشغيل",sw_saving:"جارٍ الحفظ…",sw_err:"لم يتم حفظ التغيير. حاول مرة أخرى."},ni={tab:"Маски приватности",crumbs:"Настройки | Безопасность",heading:"Маски приватности",cameras:"Камеры",camera_edited:"изменена",snapshot_alt:"Изображение с камеры {name}",no_picture:"Нет изображения с камеры",mask_on:"Маска включена",add_region:"Добавить область",delete_region:"Удалить область",discard:"Отменить изменения",region_n:"Область {n}",region_poly:"Область {n} (произвольная форма)",regions_count:"{n} из {max} областей",region_keys:"Стрелки перемещают. Shift со стрелками меняет размер. Delete удаляет.",corner:"Угол: {name}",corner_tl:"левый верхний",corner_tr:"правый верхний",corner_bl:"левый нижний",corner_br:"правый нижний",review:"Проверить изменения ({n})",reviewing:"Чтение камер…",back:"Назад к редактированию",next:"Перейти к подтверждению",write:"Записать в NVR",cancel:"Отмена",preview_title:"До и после",before:"До",after:"После",st_ready:"Будет записано",st_unchanged:"Без изменений",st_invalid:"Недопустимо",st_skipped:"Не будет записано",confirm_title:"Запись масок приватности",confirm_lead:"Маска закрывает изображение в живом просмотре и в записи. Запись отправляется сейчас, один раз.",confirm_count:"Будет записано камер: {n}",confirm_count_one:"Будет записана одна камера",applying:"Запись…",result_title:"Результаты записи",res_applied:"Записано и проверено",res_unchanged:"Без изменений",res_skipped:"Не записано",res_failed:"Запись не удалась",res_not_attempted:"Не выполнялось",restored:"Оригинал восстановлен",not_restored:"Оригинал не подтверждён, проверьте камеру",undo:"Отменить запись",undoing:"Восстановление…",undone:"Возвращено прежнее состояние",done:"Готово",log_title:"История изменений",log_empty:"На этой камере маски ещё не записывались",log_applied:"Записано",log_rolled_back:"Отменено",log_failed:"Ошибка",log_diverged:"Не подтверждено",log_other:"Другое",off_switch:"Запись масок приватности выключена в настройках системы, поэтому страница только для просмотра. Включить её может администратор системы.",off_perm:"У вас нет права изменять маски приватности, поэтому страница только для просмотра.",off_remote:"Маски приватности меняются только в локальной сети, поэтому страница только для просмотра.",loading:"Загрузка",retry:"Повторить",err_cameras:"Список камер не загрузился",err_mask:"Не удалось прочитать маску камеры",forbidden:"Нет права просматривать маски приватности",empty_cameras:"Нет камер для редактирования",inv_need_region:"Включённой маске нужна хотя бы одна область",inv_too_many:"Допускается не более {max} областей",inv_too_small:"Область слишком мала",e_feature_disabled:"Запись масок приватности выключена в настройках системы.",e_forbidden:"Нет права на это действие.",e_stale:"Маска на камере изменилась после проверки. Проверьте снова.",e_validation:"Маска недопустима для этой камеры.",e_nvr_not_supported:"Камера не поддерживает маски приватности.",e_source_forbidden:"В камеру нельзя записывать.",e_changed_since:"Маска на камере с тех пор изменилась, автоматического возврата нет.",e_not_rollbackable:"Это изменение нельзя отменить.",e_nvr_verify_mismatch:"Восстановление не подтверждено. Проверьте камеру.",e_generic:"Действие не удалось. Больше ничего не отправлено.",sw_label:"Запись масок приватности в NVR",sw_confirm:"Ничего не записывается, пока вы каждый раз не нажмёте кнопку записи.",sw_turn_on:"Включить",sw_saving:"Сохранение…",sw_err:"Изменение не сохранено. Повторите попытку."},oi={he:_t,en:ri,ar:ii,ru:ni};function qs(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}function u(e,t,s=qs()){const a=oi[s][e]??_t[e]??e;return t?a.replace(/\{(\w+)\}/g,(r,i)=>i in t?String(t[i]):r):a}function we(e,t=qs()){const s=`e_${e}`;return s in _t?u(s,void 0,t):u("e_generic",void 0,t)}const M=4,at={width:704,height:576},As=e=>[[e.x,e.y],[e.x+e.w,e.y],[e.x+e.w,e.y+e.h],[e.x,e.y+e.h]];function li(e){if(e.length!==4)return null;const t=[...new Set(e.map(n=>n[0]))],s=[...new Set(e.map(n=>n[1]))];if(t.length!==2||s.length!==2||new Set(e.map(n=>`${n[0]},${n[1]}`)).size!==4)return null;const r=Math.min(...t),i=Math.min(...s);return{x:r,y:i,w:Math.max(...t)-r,h:Math.max(...s)-i}}let ci=0;const ft=()=>`r${++ci}`;function di(e,t){return{enabled:e,regions:t.map(s=>({key:ft(),rect:li(s.points),points:s.points.map(a=>[a[0],a[1]])}))}}const hi=e=>({enabled:e.enabled,regions:e.regions.map(t=>({key:t.key,rect:t.rect?{...t.rect}:null,points:t.points.map(s=>[...s])}))}),te=(e,t,s)=>Math.min(s,Math.max(t,e));function $t(e,t){const s=te(Math.round(e.w),M,t.width),a=te(Math.round(e.h),M,t.height);return{x:te(Math.round(e.x),0,t.width-s),y:te(Math.round(e.y),0,t.height-a),w:s,h:a}}const pi=(e,t=!1)=>({x:Math.max(1,Math.round(e.width/(t?10:100))),y:Math.max(1,Math.round(e.height/(t?10:100)))}),ui=e=>e==="ArrowLeft"||e==="ArrowRight"||e==="ArrowUp"||e==="ArrowDown";function fi(e,t,s,a,r=!1){const i=pi(a,r),n=t==="ArrowLeft"?-i.x:t==="ArrowRight"?i.x:0,l=t==="ArrowUp"?-i.y:t==="ArrowDown"?i.y:0;return $t(s?{...e,w:e.w+n,h:e.h+l}:{...e,x:e.x+n,y:e.y+l},a)}function mi(e,t,s,a,r){const i=t==="tl"||t==="bl",n=t==="tl"||t==="tr",l=i?e.x+e.w:e.x,p=n?e.y+e.h:e.y,d=te(Math.round(s),0,r.width),m=te(Math.round(a),0,r.height);let f=Math.min(l,d),$=Math.max(l,d),k=Math.min(p,m),E=Math.max(p,m);return $-f<M&&(d<l?(f=Math.max(0,l-M),$=f+M):($=Math.min(r.width,l+M),f=$-M)),E-k<M&&(m<p?(k=Math.max(0,p-M),E=k+M):(E=Math.min(r.height,p+M),k=E-M)),{x:f,y:k,w:$-f,h:E-k}}function hs(e,t,s,a,r){const i=te(Math.round(Math.min(e,s)),0,r.width),n=te(Math.round(Math.max(e,s)),0,r.width),l=te(Math.round(Math.min(t,a)),0,r.height),p=te(Math.round(Math.max(t,a)),0,r.height);return n-i>=M&&p-l>=M?{x:i,y:l,w:n-i,h:p-l}:null}function wi(e,t){const s=Math.round(e.width/5),a=Math.round(e.height/5),r=t%5*Math.round(e.width/25);return $t({x:Math.round((e.width-s)/2)+r,y:Math.round((e.height-a)/2)+r,w:s,h:a},e)}const bi=e=>JSON.stringify(e.map(t=>[t[0],t[1]]).sort((t,s)=>t[0]-s[0]||t[1]-s[1])),ps=e=>e.map(t=>bi(t.points)).sort();function gi(e,t){return e.enabled===t.enabled&&JSON.stringify(ps(e.regions))===JSON.stringify(ps(t.regions))}const vi=e=>e.rect?As(e.rect):e.points,us=e=>({enabled:e.enabled,regions:e.regions.map(t=>({points:vi(t)}))}),yi=(e,t)=>!gi(us(e),us(t));function xi(e,t,s){if(e.regions.length>t)return"too_many";if(e.enabled&&e.regions.length===0)return"need_region";for(const a of e.regions)if(a.rect&&(a.rect.w<M||a.rect.h<M||a.rect.x<0||a.rect.y<0||a.rect.x+a.rect.w>s.width||a.rect.y+a.rect.h>s.height))return"too_small";return null}function fs(e,t,s){return{camera_id:e,enabled:t.enabled,regions:t.regions.map(a=>({points:a.rect?As(a.rect):a.points})),...s?{etag:s}:{}}}function ms(e,t){const s=(a,r)=>`${(a/r*100).toFixed(3)}%`;return{left:s(e.x,t.width),top:s(e.y,t.height),width:s(e.w,t.width),height:s(e.h,t.height)}}const ws=e=>e.map(t=>`${t[0]},${t[1]}`).join(" "),bs=e=>(e?.regions??[]).map(t=>t.points);function _i(e){const t=e.find(s=>s.kind==="privacy_mask");return t&&t.status==="applied"&&!t.rollback_of?t:null}var $i=Object.defineProperty,ki=Object.getOwnPropertyDescriptor,g=(e,t,s,a)=>{for(var r=a>1?void 0:a?ki(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&$i(t,s,r),r};const zi=["tl","tr","bl","br"];let b=class extends W{constructor(){super(...arguments),this.cameras=null,this.failure=null,this.loading=!0,this.selected="",this.loaded=new Map,this.drafts=new Map,this.regionKey="",this.step="edit",this.preview=null,this.previewing=!1,this.confirmOpen=!1,this.applying=!1,this.applied=null,this.line="",this.ghost=null,this.history=null,this.undoing="",this.undone=new Set,this.brokenShot=new Set,this.switchOn=null,this.switchAsk=!1,this.switchBusy=!1,this.switchErr=!1,this.avail=0,this.drag=null,this.onResize=()=>this.measure(),this.addRegion=()=>{this.edit((e,t)=>{const s=this.cur;if(!s||e.regions.length>=s.view.max_regions)return;const a=ft();e.regions.push({key:a,rect:wi(t,e.regions.length),points:[]}),e.enabled||(e.enabled=!0),this.regionKey=a}),this.updateComplete.then(()=>this.shadowRoot?.querySelector(`[data-pm-region="${this.regionKey}"]`)?.focus())},this.discard=()=>{const e=new Map(this.drafts);e.delete(this.selected),this.drafts=e,this.regionKey=""},this.toggleMask=()=>{this.edit(e=>{e.enabled=!e.enabled})},this.review=async()=>{if(this.canReview){this.previewing=!0,this.line="";try{const e=[...this.drafts.entries()].map(([t,s])=>fs(t,s));this.preview=await ye.previewMasks(e),this.step="review"}catch(e){this.line=we(e instanceof y?e.code:"generic")}finally{this.previewing=!1}}},this.backToEdit=()=>{this.preview=null,this.confirmOpen=!1,this.step="edit"},this.write=async()=>{if(this.applying||!this.preview)return;const e=this.readyRows;if(e.length){this.applying=!0,this.line="";try{const t=e.map(a=>{const r=this.drafts.get(a.camera_id);return fs(a.camera_id,r,a.etag)});this.applied=await ye.applyMasks(t),this.confirmOpen=!1,this.step="done";const s=new Map(this.drafts);for(const a of this.applied.results)(a.status==="applied"||a.status==="unchanged")&&s.delete(a.camera_id);this.drafts=s;for(const a of this.applied.results)a.status==="applied"&&this.loadMask(a.camera_id,!0);this.loadHistory(this.selected)}catch(t){this.confirmOpen=!1,this.line=we(t instanceof y?t.code:"generic"),this.step="edit",this.preview=null}finally{this.applying=!1}}},this.undo=async(e,t)=>{if(!this.undoing){this.undoing=e,this.line="";try{await ye.undoChange(e);const s=new Set(this.undone);s.add(e),this.undone=s;const a=new Map(this.drafts);a.delete(t),this.drafts=a,await this.loadMask(t,!0),this.selected===t&&this.loadHistory(t)}catch(s){this.line=we(s instanceof y?s.code:"generic")}finally{this.undoing=""}}},this.finish=()=>{this.applied=null,this.preview=null,this.step="edit",this.loadHistory(this.selected)}}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),this.loadCameras(),this.loadSwitch()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize)}updated(){this.measure()}measure(){const e=this.shadowRoot?.querySelector("[data-pm-layout]");if(!e)return;let t=null;for(let r=e.parentNode;r;r=r instanceof ShadowRoot?r.host:r.parentNode)if(r instanceof Element){const i=getComputedStyle(r).overflowY;if((i==="auto"||i==="scroll")&&r.scrollHeight>r.clientHeight){t=r;break}}const s=e.getBoundingClientRect().top+(t?t.scrollTop:window.scrollY),a=Math.round(window.innerHeight-s-24);Math.abs(a-this.avail)>2&&(this.avail=a)}async loadSwitch(){if(!(!ce()||He()||!bt("system.configure")))try{const e=await js();this.switchOn=e.can_edit===!1?null:e.settings["nvr.privacy_mask_write"]==="true"}catch{this.switchOn=null}}async saveSwitch(e){if(!this.switchBusy){this.switchBusy=!0,this.switchErr=!1;try{const t=await Ks({"nvr.privacy_mask_write":e?"true":"false"});this.switchOn=(t.settings?.["nvr.privacy_mask_write"]??(e?"true":"false"))==="true",this.switchAsk=!1}catch{this.switchErr=!0}finally{this.switchBusy=!1}}}onSwitch(){this.switchBusy||this.switchOn===null||(this.switchOn?this.saveSwitch(!1):(this.switchErr=!1,this.switchAsk=!this.switchAsk))}renderSwitch(){return this.switchOn===null||this.step!=="edit"?c:o`<div class="swrow" data-pm-switch-row>
      <button type="button" class="sw-switch" role="switch" aria-checked=${this.switchOn?"true":"false"} data-pm-switch ?disabled=${this.switchBusy||this.applying} @click=${this.onSwitch}><span class="track" aria-hidden="true"></span>${u("sw_label")}</button>
      ${this.switchAsk&&!this.switchOn?o`<div class="ask" data-pm-switch-ask role="group"><span>${u("sw_confirm")}</span>
            <sw-button size="lg" variant="ghost" data-pm-switch-cancel ?disabled=${this.switchBusy} @click=${()=>this.switchAsk=!1}>${u("cancel")}</sw-button>
            <sw-button size="lg" variant="primary" data-pm-switch-confirm ?disabled=${this.switchBusy} @click=${()=>void this.saveSwitch(!0)}>${this.switchBusy?u("sw_saving"):u("sw_turn_on")}</sw-button></div>`:c}
      ${this.switchErr?o`<span class="err" data-pm-switch-err role="alert">${u("sw_err")}</span>`:c}
    </div>`}async loadCameras(){this.loading=!0;try{if(!ce()){this.cameras=[],this.failure=null;return}const e=await pe().cameras();this.cameras=e.cameras.filter(t=>!!t.camera_id),this.failure=null,this.cameras.length&&!this.selected&&this.select(this.cameras[0].camera_id)}catch(e){this.cameras=null,this.failure={status:e instanceof y?e.status:0,code:e instanceof y?e.code:"network"}}finally{this.loading=!1}}async loadMask(e,t=!1){if(!t&&this.loaded.get(e)&&this.loaded.get(e)!=="error")return;const s=new Map(this.loaded);s.set(e,"loading"),this.loaded=s;try{const a=await ye.readMask(e),r=a.normalized?.width&&a.normalized?.height?{width:a.normalized.width,height:a.normalized.height}:at,i=new Map(this.loaded);i.set(e,{view:a,original:di(a.enabled,a.regions),frame:r,shot:Date.now()}),this.loaded=i}catch{const a=new Map(this.loaded);a.set(e,"error"),this.loaded=a}}async loadHistory(e){this.history=null;try{const t=await ye.changes(e,20);this.selected===e&&(this.history=t.changes.filter(s=>s.kind==="privacy_mask"))}catch{this.selected===e&&(this.history=[])}}async select(e){this.selected=e,this.regionKey="",this.line="",this.history=null,await this.loadMask(e),this.loadHistory(e)}get cur(){const e=this.loaded.get(this.selected);return e&&e!=="error"&&e!=="loading"?e:null}draftFor(e){const t=this.loaded.get(e);return!t||t==="error"||t==="loading"?null:this.drafts.get(e)??t.original}get lock(){const e=this.cur;return e?He()?"off_remote":e.view.can_write?this.switchOn??e.view.write_enabled?"":"off_switch":"off_perm":""}edit(e){const t=this.cur;if(!t||this.lock)return;const s=hi(this.drafts.get(this.selected)??t.original);e(s,t.frame);const a=new Map(this.drafts);yi(t.original,s)?a.set(this.selected,s):a.delete(this.selected),this.drafts=a}invalidFor(e){const t=this.loaded.get(e),s=this.drafts.get(e);return!t||t==="error"||t==="loading"||!s?null:xi(s,t.view.max_regions,t.frame)}nameOf(e){return this.cameras?.find(t=>t.camera_id===e)?.name??e}deleteRegion(e){const t=this.draftFor(this.selected),s=t?t.regions.findIndex(r=>r.key===e):-1;this.edit(r=>{r.regions=r.regions.filter(i=>i.key!==e)});const a=this.draftFor(this.selected);this.regionKey=a&&a.regions.length?a.regions[Math.min(s,a.regions.length-1)].key:"",this.updateComplete.then(()=>{(this.regionKey?this.shadowRoot?.querySelector(`[data-pm-region="${this.regionKey}"]`):this.shadowRoot?.querySelector("[data-pm-add]")?.shadowRoot?.querySelector("button"))?.focus()})}setRect(e,t){this.edit(s=>{const a=s.regions.find(r=>r.key===e);a&&(a.rect=t)})}framePoint(e){const t=this.cur,s=this.shadowRoot?.querySelector("[data-pm-frame]");if(!t||!s)return null;const a=s.getBoundingClientRect();return!a.width||!a.height?null:{x:(e.clientX-a.left)/a.width*t.frame.width,y:(e.clientY-a.top)/a.height*t.frame.height}}onFrameDown(e){const t=this.cur;if(!t||this.lock||e.button!==0||e.pointerType==="touch"||e.target.closest("[data-pm-region],[data-pm-handle]"))return;const s=this.draftFor(this.selected);if(!s||s.regions.length>=t.view.max_regions)return;const a=this.framePoint(e);a&&(e.currentTarget.setPointerCapture(e.pointerId),this.drag={kind:"draw",key:"",px:a.x,py:a.y,rect:null},this.regionKey="")}onRegionDown(e,t,s){if(this.lock||e.button!==0)return;const a=this.framePoint(e);a&&(e.stopPropagation(),e.currentTarget.setPointerCapture(e.pointerId),this.regionKey=t,this.drag={kind:"move",key:t,px:a.x,py:a.y,rect:s})}onHandleDown(e,t,s,a){if(this.lock||e.button!==0)return;const r=this.framePoint(e);r&&(e.stopPropagation(),e.currentTarget.setPointerCapture(e.pointerId),this.drag={kind:"corner",key:t,px:r.x,py:r.y,rect:s,corner:a})}onPointerMove(e){const t=this.drag,s=this.cur;if(!t||!s)return;const a=this.framePoint(e);a&&(t.kind==="draw"?this.ghost=hs(t.px,t.py,a.x,a.y,s.frame):t.kind==="move"&&t.rect?this.setRect(t.key,$t({...t.rect,x:t.rect.x+(a.x-t.px),y:t.rect.y+(a.y-t.py)},s.frame)):t.kind==="corner"&&t.rect&&t.corner&&this.setRect(t.key,mi(t.rect,t.corner,a.x,a.y,s.frame)))}onPointerUp(e){const t=this.drag,s=this.cur;if(this.drag=null,!(!t||!s)&&t.kind==="draw"){const a=this.framePoint(e),r=a?hs(t.px,t.py,a.x,a.y,s.frame):null;if(this.ghost=null,r){const i=ft();this.edit(n=>{n.regions.length>=s.view.max_regions||(n.regions.push({key:i,rect:r,points:[]}),n.enabled=!0)}),this.regionKey=i}}}onRegionKey(e,t){const s=this.cur;if(!s||this.lock)return;const r=this.draftFor(this.selected)?.regions.find(i=>i.key===t);r&&(e.key==="Delete"||e.key==="Backspace"?(e.preventDefault(),this.deleteRegion(t)):ui(e.key)&&r.rect&&(e.preventDefault(),this.setRect(t,fi(r.rect,e.key,e.shiftKey,s.frame,e.ctrlKey||e.metaKey))))}get invalidCameras(){return[...this.drafts.keys()].filter(e=>this.invalidFor(e))}get canReview(){return!this.lock&&!!this.cur&&this.drafts.size>0&&this.invalidCameras.length===0&&!this.previewing}get readyRows(){return(this.preview?.items??[]).filter(e=>e.status==="ready")}regionLabel(e,t){return u(t?"region_n":"region_poly",{n:e+1})}invalidText(e,t){return e==="need_region"?u("inv_need_region"):e==="too_many"?u("inv_too_many",{max:t}):e==="too_small"?u("inv_too_small"):""}renderPicture(e,t){return this.brokenShot.has(e)?o`<div class="nopic">${u("no_picture")}</div>`:o`<img alt="" src=${Us(e,t)} @error=${()=>this.brokenShot=new Set(this.brokenShot).add(e)} />`}thumb(e,t,s,a){return o`<div class="thumb" style=${`aspect-ratio:${t.width} / ${t.height}`}>
      ${this.renderPicture(e,a)}
      <svg viewBox=${`0 0 ${t.width} ${t.height}`} preserveAspectRatio="none" aria-hidden="true">${s.map(r=>Rt`<polygon points=${ws(r)}></polygon>`)}</svg>
    </div>`}renderCameras(){return o`<ul class="cams" data-pm-cameras aria-label=${u("cameras")}>
      ${this.cameras.map(e=>{const t=e.camera_id;return o`<li>
          <button type="button" class="cam" data-pm-camera=${t} aria-current=${t===this.selected?"true":"false"} ?disabled=${this.step!=="edit"} @click=${()=>void this.select(t)}>
            ${this.drafts.has(t)?o`<span class="dot" data-pm-edited aria-hidden="true"></span><span class="vh">${u("camera_edited")}</span>`:c}
            <span>${e.name}</span><bdi>${e.channel}</bdi>
          </button>
        </li>`})}
    </ul>`}renderEditor(){const e=this.cur;if(this.loaded.get(this.selected)==="error")return{main:o`<sw-state-panel state="error" heading=${u("err_mask")} actionLabel=${u("retry")} data-pm-mask-error @action=${()=>void this.loadMask(this.selected,!0)}></sw-state-panel>`,insp:c,foot:c};if(!e)return{main:o`<sw-state-panel state="loading" heading=${u("loading")} data-pm-mask-loading></sw-state-panel>`,insp:c,foot:c};const s=this.draftFor(this.selected),a=this.lock,r=this.invalidFor(this.selected),i=s.regions.find(d=>d.key===this.regionKey)??null,n=o`
      <div class="bar">
        <button type="button" class="sw-switch" role="switch" aria-checked=${s.enabled?"true":"false"} data-pm-enabled ?disabled=${!!a} @click=${this.toggleMask}><span class="track" aria-hidden="true"></span>${u("mask_on")}</button>
        <sw-button size="lg" data-pm-add ?disabled=${!!a||s.regions.length>=e.view.max_regions} @click=${this.addRegion}>${u("add_region")}</sw-button>
        <sw-button size="lg" variant="ghost" data-pm-delete ?disabled=${!!a||!i} @click=${()=>i&&this.deleteRegion(i.key)}>${u("delete_region")}</sw-button>
        <sw-button size="lg" variant="ghost" data-pm-discard ?disabled=${!this.drafts.has(this.selected)} @click=${this.discard}>${u("discard")}</sw-button>
        <span class="count" data-pm-count>${u("regions_count",{n:s.regions.length,max:e.view.max_regions})}</span>
      </div>
      <div class="stage" style=${`--pm-w:${e.frame.width};--pm-h:${e.frame.height}`}>
      <div class="frame ${a?"ro":""}" data-pm-frame style=${`aspect-ratio:${e.frame.width} / ${e.frame.height}`}
        @pointerdown=${d=>this.onFrameDown(d)} @pointermove=${d=>this.onPointerMove(d)} @pointerup=${d=>this.onPointerUp(d)} @pointercancel=${()=>(this.drag=null,this.ghost=null)}>
        ${this.renderPicture(this.selected,e.shot)}
        <svg viewBox=${`0 0 ${e.frame.width} ${e.frame.height}`} preserveAspectRatio="none" aria-hidden="true">
          ${s.regions.map(d=>Rt`<polygon class=${[d.key===this.regionKey?"sel":"",s.enabled?"":"off"].join(" ")} points=${ws(d.rect?[[d.rect.x,d.rect.y],[d.rect.x+d.rect.w,d.rect.y],[d.rect.x+d.rect.w,d.rect.y+d.rect.h],[d.rect.x,d.rect.y+d.rect.h]]:d.points)}></polygon>`)}
        </svg>
        ${ke(s.regions,d=>d.key,(d,m)=>this.renderRegion(d.key,m,d.rect,d.points,e.frame,!!a))}
        ${this.ghost?o`<div class="ghost" style=${this.styleOf(ms(this.ghost,e.frame))}></div>`:c}
      </div>
      </div>
      <span id="pm-keys" class="vh">${u("region_keys")}</span>
      ${r||this.invalidCameras.length?o`<p class="err" data-pm-invalid role="alert">${this.invalidCameras.map(d=>`${this.nameOf(d)}: ${this.invalidText(this.invalidFor(d),this.loaded.get(d).view.max_regions)}`).join(" · ")}</p>`:c}`,l=o`<div class="insp" data-pm-inspector>
      ${s.regions.length?o`<ul class="regions" data-pm-regions aria-label=${u("regions_count",{n:s.regions.length,max:e.view.max_regions})}>
            ${s.regions.map((d,m)=>o`<li>
                <button type="button" class="pick" data-pm-pick=${d.key} aria-pressed=${d.key===this.regionKey?"true":"false"} @click=${()=>this.regionKey=d.key}>${this.regionLabel(m,d.rect)}</button>
                <sw-button size="lg" variant="ghost" iconOnly icon="close" label=${`${u("delete_region")}: ${this.regionLabel(m,d.rect)}`} data-pm-remove=${d.key} ?disabled=${!!a} @click=${()=>this.deleteRegion(d.key)}></sw-button>
              </li>`)}
          </ul>`:o`<ul class="regions" data-pm-regions></ul>`}
      ${this.renderHistory()}
    </div>`,p=o`<div class="foot edit-foot">
      ${this.line?o`<p class="err" data-pm-line role="alert">${this.line}</p>`:c}
      <sw-button size="lg" variant="primary" data-pm-review ?disabled=${!this.canReview} @click=${()=>void this.review()}>${this.previewing?u("reviewing"):u("review",{n:this.drafts.size})}</sw-button>
    </div>`;return{main:n,insp:l,foot:p}}styleOf(e){return`left:${e.left};top:${e.top};width:${e.width};height:${e.height}`}renderRegion(e,t,s,a,r,i){const n=a.map(f=>f[0]),l=a.map(f=>f[1]),p=s??{x:Math.min(...n),y:Math.min(...l),w:Math.max(...n)-Math.min(...n),h:Math.max(...l)-Math.min(...l)},d=e===this.regionKey,m=this.regionLabel(t,s);return o`<div class="reg ${i?"ro":""}" data-pm-region=${e} data-pm-index=${t+1} data-pm-rect=${s?`${s.x},${s.y},${s.w},${s.h}`:"free"} style=${this.styleOf(ms(p,r))}
      role="group" tabindex=${i?-1:0} aria-label=${m} aria-describedby="pm-keys" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Delete"
      @focus=${()=>this.regionKey=e}
      @pointerdown=${f=>s&&this.onRegionDown(f,e,s)} @pointermove=${f=>this.onPointerMove(f)} @pointerup=${f=>this.onPointerUp(f)}
      @keydown=${f=>this.onRegionKey(f,e)}>
      ${d&&s&&!i?zi.map(f=>o`<div class="handle ${f}" data-pm-handle=${f} aria-hidden="true" @pointerdown=${$=>this.onHandleDown($,e,s,f)} @pointermove=${$=>this.onPointerMove($)} @pointerup=${$=>this.onPointerUp($)}></div>`):c}
    </div>`}changeStatus(e){if(e.rollback_of)return u("log_applied");const t=e.status;return u(t==="applied"?"log_applied":t==="rolled_back"?"log_rolled_back":t==="failed"?"log_failed":t==="diverged"?"log_diverged":"log_other")}renderHistory(){if(this.history===null)return c;const e=_i(this.history),t=this.lock;return o`<section class="history" data-pm-history aria-label=${u("log_title")}>
      <h3>${u("log_title")}</h3>
      ${this.history.length?o`<ul>
            ${this.history.slice(0,5).map(s=>o`<li data-pm-change=${s.id} data-status=${s.status}>
                <span class="when">${this.when(s.created_at)}</span><span>${this.changeStatus(s)}</span>
                ${e&&e.id===s.id&&!this.undone.has(s.id)?o`<sw-button size="lg" variant="ghost" data-pm-undo=${s.id} ?disabled=${!!this.undoing||!!t} @click=${()=>void this.undo(s.id,this.selected)}>${this.undoing===s.id?u("undoing"):u("undo")}</sw-button>`:c}
              </li>`)}
          </ul>`:o`<p class="muted" data-pm-history-empty>${u("log_empty")}</p>`}
    </section>`}when(e){const t=new Date(e);return Number.isNaN(t.getTime())?"":vs(t)}statusText(e){return u(e==="ready"?"st_ready":e==="unchanged"?"st_unchanged":e==="invalid"?"st_invalid":"st_skipped")}renderReview(){const e=this.preview;if(!e)return c;const t=this.readyRows.length;return o`<div class="review" data-pm-review-step>
      <h3>${u("preview_title")}</h3>
      ${e.items.map(s=>{const a=this.loaded.get(s.camera_id),r=s.before?.normalized?.width?{width:s.before.normalized.width,height:s.before.normalized.height??at.height}:a&&a!=="error"&&a!=="loading"?a.frame:at,i=a&&a!=="error"&&a!=="loading"?a.shot:0;return o`<article class="rv-card" data-pm-preview=${s.camera_id} data-status=${s.status}>
          <header><span class="name">${s.name||this.nameOf(s.camera_id)}</span><span class="st-chip ${s.status}" data-pm-status>${this.statusText(s.status)}</span>${s.status==="invalid"||s.status==="skipped"?o`<span class="err">${we(s.reason??"generic")}</span>`:c}</header>
          ${s.before&&s.after?o`<div class="pair">
                <figure><figcaption>${u("before")}</figcaption>${this.thumb(s.camera_id,r,bs(s.before.enabled?s.before:{...s.before,regions:[]}),i)}</figure>
                <figure><figcaption>${u("after")}</figcaption>${this.thumb(s.camera_id,r,bs(s.after.enabled?s.after:{...s.after,regions:[]}),i)}</figure>
              </div>`:c}
        </article>`})}
      <div class="foot">
        <sw-button size="lg" variant="ghost" data-pm-back @click=${this.backToEdit}>${u("back")}</sw-button>
        <sw-button size="lg" variant="primary" data-pm-next ?disabled=${!t} @click=${()=>this.confirmOpen=!0}>${u("next")}</sw-button>
      </div>
    </div>`}renderConfirm(){const e=this.readyRows;return o`<sw-dialog ?open=${this.confirmOpen} heading=${u("confirm_title")} data-pm-confirm-dialog @close=${t=>{t.stopPropagation(),this.applying||(this.confirmOpen=!1)}}>
      ${this.confirmOpen?o`<p>${u("confirm_lead")}</p>
            <p class="count" data-pm-confirm-count>${e.length===1?u("confirm_count_one"):u("confirm_count",{n:e.length})}</p>
            <ul data-pm-confirm-cameras>${e.map(t=>o`<li data-pm-confirm-camera=${t.camera_id}>${t.name||this.nameOf(t.camera_id)}</li>`)}</ul>
            <sw-button size="lg" slot="footer" variant="ghost" data-pm-cancel ?disabled=${this.applying} @click=${()=>this.confirmOpen=!1}>${u("cancel")}</sw-button>
            <sw-button size="lg" slot="footer" variant="primary" data-pm-confirm ?disabled=${this.applying||!e.length} @click=${()=>void this.write()}>${this.applying?u("applying"):u("write")}</sw-button>`:c}
    </sw-dialog>`}resultText(e){switch(e.status){case"applied":return{text:u("res_applied"),bad:!1};case"unchanged":return{text:u("res_unchanged"),bad:!1};case"skipped":return{text:`${u("res_skipped")}: ${we(e.reason??"generic")}`,bad:!0};case"not_attempted":return{text:u("res_not_attempted"),bad:!1};default:return{text:`${u("res_failed")}: ${we(e.reason??"generic")}${e.restored===!0?`. ${u("restored")}`:e.restored===!1?`. ${u("not_restored")}`:""}`,bad:!0}}}renderDone(){const e=this.applied;return e?o`<div class="review" data-pm-done-step>
      <h3>${u("result_title")}</h3>
      <ul class="results" data-pm-results>
        ${e.results.map(t=>{const s=this.resultText(t),a=!!t.change_id&&this.undone.has(t.change_id);return o`<li data-pm-result=${t.camera_id} data-status=${t.status}>
            <span class="name">${this.nameOf(t.camera_id)}</span><span class="st ${s.bad?"bad":""}">${a?u("undone"):s.text}</span>
            ${t.status==="applied"&&t.change_id&&!a?o`<sw-button size="lg" variant="ghost" data-pm-undo=${t.change_id} ?disabled=${!!this.undoing} @click=${()=>void this.undo(t.change_id,t.camera_id)}>${this.undoing===t.change_id?u("undoing"):u("undo")}</sw-button>`:c}
          </li>`})}
      </ul>
      ${this.line?o`<p class="err" data-pm-line role="alert">${this.line}</p>`:c}
      <div class="foot"><sw-button size="lg" variant="primary" data-pm-finish @click=${this.finish}>${u("done")}</sw-button></div>
    </div>`:c}render(){let e;if(this.loading&&!this.cameras)e=o`<sw-state-panel state="loading" heading=${u("loading")} data-pm-loading></sw-state-panel>`;else if(this.failure?.status===403)e=o`<sw-state-panel state="forbidden" heading=${u("forbidden")} quiet data-pm-forbidden></sw-state-panel>`;else if(this.failure)e=o`<sw-state-panel state="error" heading=${u("err_cameras")} actionLabel=${u("retry")} data-pm-error @action=${()=>void this.loadCameras()}></sw-state-panel>`;else if(!this.cameras?.length)e=o`<sw-state-panel icon="camera" state="empty" heading=${u("empty_cameras")} quiet data-pm-empty></sw-state-panel>`;else{const t=this.step==="edit"?this.lock:"",s=this.step==="edit"?this.renderEditor():null;e=o`${this.renderSwitch()}${t?o`<p class="banner" data-pm-lock=${t} role="status">${u(t)}</p>`:c}
        <div class="pm">
          <div class="layout" data-pm-layout style=${this.avail?`--pm-avail:${this.avail}px`:""}>
            ${this.renderCameras()}
            <div class="main" data-pm-step=${this.step}>${s?s.main:this.step==="review"?this.renderReview():this.renderDone()}</div>
            ${s?o`${s.insp}${s.foot}`:c}
          </div>
        </div>`}return o`<sw-page crumbs=${u("crumbs")} heading=${u("heading")}><div data-pm-screen data-state=${this.loading&&!this.cameras?"loading":this.failure?"error":"ready"} style="display:contents">${e}</div></sw-page>${this.renderConfirm()}`}};b.styles=Z`
    :host {
      display: contents;
    }
    /* CAMADMIN-POLISH-2331: the editor is one container. Narrow (a phone, a narrow pane): one column - the cameras as a strip, the toolbar
       and the picture, the regions and the history, the review button in a footer that sticks to the bottom of the view. Wide (760 px of
       content and a window at least 560 px tall): the cameras and the inspector (regions, history) share the start column and the review
       button closes it; the picture column fits the window, so nothing - the primary action least of all - lies below the fold */
    .pm {
      container: pm / inline-size;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: 'cams' 'main' 'insp' 'foot';
      gap: var(--sw-s-4);
      align-items: start;
    }
    .layout > .cams {
      grid-area: cams;
    }
    .layout > .main {
      grid-area: main;
    }
    .layout > .insp {
      grid-area: insp;
    }
    .layout > .edit-foot {
      grid-area: foot;
    }
    @container pm (min-width: 760px) {
      .layout {
        grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
        grid-template-areas: 'cams main' 'insp main' 'foot main';
        grid-template-rows: auto minmax(0, 1fr) auto;
        column-gap: var(--sw-s-5);
        row-gap: var(--sw-s-3);
      }
    }
    .banner {
      margin: 0 0 var(--sw-s-3, 12px);
      padding: 10px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .cams {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    @container pm (max-width: 759.98px) {
      .cams {
        flex-direction: row;
        overflow-x: auto;
        padding-block-end: 4px;
        scroll-snap-type: x proximity;
        scrollbar-width: thin;
      }
      .cams li {
        flex: 0 0 auto;
        max-inline-size: 85%;
        scroll-snap-align: start;
      }
    }
    .cam {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      min-block-size: 44px;
      padding: 0 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      text-align: start;
      white-space: nowrap;
      box-sizing: border-box;
      min-inline-size: 0;
    }
    .cam > span:not([class]) {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cam[aria-current='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .cam .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-accent);
      flex: none;
    }
    .cam bdi {
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .main {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sw-s-3, 12px);
      min-inline-size: 0;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .bar .count {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      margin-inline-start: auto;
    }
    .sw-switch {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      padding: 0 4px;
      border: 0;
      background: none;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .sw-switch .track {
      inline-size: 44px;
      block-size: 26px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-toggle-off);
      position: relative;
      flex: none;
    }
    .sw-switch .track::after {
      content: '';
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      inline-size: 20px;
      block-size: 20px;
      border-radius: 50%;
      background: var(--sw-toggle-thumb);
      transition: transform 120ms ease;
    }
    .sw-switch[aria-checked='true'] .track {
      background: var(--sw-accent);
    }
    .sw-switch[aria-checked='true'] .track::after {
      transform: translateX(18px);
    }
    :host-context([dir='rtl']) .sw-switch[aria-checked='true'] .track::after {
      transform: translateX(-18px);
    }
    .swrow {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 12px;
      margin: 0 0 var(--sw-s-3, 12px);
    }
    .swrow .ask {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .swrow .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .swrow .ask sw-button {
        min-block-size: 44px;
      }
    }
    .sw-switch:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    button:focus-visible,
    [tabindex]:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    /* the picture: LTR in every language (video and geometry are never mirrored) */
    .frame {
      direction: ltr;
      position: relative;
      box-sizing: border-box;
      inline-size: 100%;
      max-inline-size: 960px;
      background: var(--sw-surface-3);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      user-select: none;
      touch-action: pan-y;
      cursor: crosshair;
    }
    .frame.ro {
      cursor: default;
    }
    .frame img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: fill;
      pointer-events: none;
      -webkit-user-drag: none;
    }
    .frame .nopic {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      pointer-events: none;
    }
    .frame svg {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      pointer-events: none;
    }
    .frame svg polygon {
      fill: rgba(0, 0, 0, 0.78);
      stroke: var(--sw-on-video);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }
    .frame svg polygon.sel {
      stroke: var(--sw-accent);
      stroke-width: 3;
    }
    .frame svg polygon.off {
      fill: rgba(0, 0, 0, 0.25);
      stroke-dasharray: 6 4;
    }
    .reg {
      position: absolute;
      box-sizing: border-box;
      cursor: move;
      touch-action: none;
      border-radius: 2px;
    }
    .reg.ro {
      cursor: default;
      pointer-events: none;
    }
    .reg:focus-visible {
      outline: 3px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .handle {
      position: absolute;
      inline-size: 44px;
      block-size: 44px;
      display: grid;
      place-items: center;
      touch-action: none;
      cursor: nwse-resize;
    }
    .handle::after {
      content: '';
      inline-size: 16px;
      block-size: 16px;
      border-radius: 50%;
      background: var(--sw-accent);
      border: 2px solid var(--sw-on-video);
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
    }
    .handle.tl {
      inset-block-start: -22px;
      inset-inline-start: -22px;
    }
    .handle.tr {
      inset-block-start: -22px;
      inset-inline-end: -22px;
      cursor: nesw-resize;
    }
    .handle.bl {
      inset-block-end: -22px;
      inset-inline-start: -22px;
      cursor: nesw-resize;
    }
    .handle.br {
      inset-block-end: -22px;
      inset-inline-end: -22px;
    }
    .ghost {
      position: absolute;
      border: 2px dashed var(--sw-accent);
      pointer-events: none;
    }
    .regions {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 4px;
    }
    .regions li {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .regions .pick {
      flex: 1;
      min-block-size: 44px;
      padding: 0 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
    }
    .regions .pick[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .vh {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      margin: 0;
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      margin: 0;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .history ul,
    .results {
      list-style: none;
      margin: 4px 0 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .history li,
    .results li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      min-block-size: 44px;
      padding: 4px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      font-size: var(--sw-fs-sm);
    }
    .history li .when {
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .results .name {
      min-inline-size: 0;
      overflow-wrap: anywhere;
      font-weight: var(--sw-fw-medium);
    }
    .results .st {
      color: var(--sw-text-2);
    }
    .results .st.bad {
      color: var(--sw-danger-text);
    }
    .review {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sw-s-3, 12px);
    }
    .rv-card {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      padding: 12px;
      display: grid;
      gap: 8px;
    }
    .rv-card header {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
      align-items: baseline;
    }
    .rv-card .name {
      overflow-wrap: anywhere;
      font-weight: var(--sw-fw-semibold);
    }
    [data-pm-confirm-cameras] li {
      overflow-wrap: anywhere;
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .pair figcaption {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-end: 4px;
    }
    .pair figure {
      margin: 0;
    }
    .thumb {
      direction: ltr;
      position: relative;
      box-sizing: border-box;
      inline-size: 100%;
      background: var(--sw-surface-3);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-2xs);
      overflow: hidden;
    }
    .thumb img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: fill;
    }
    .thumb svg {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }
    .thumb svg polygon {
      fill: rgba(0, 0, 0, 0.78);
      stroke: var(--sw-on-video);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }
    .st-chip {
      font-size: var(--sw-fs-xs);
      padding: 2px 8px;
      border-radius: var(--sw-r-pill, 999px);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
    }
    .st-chip.ready {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
      border-color: transparent;
    }
    .st-chip.invalid,
    .st-chip.skipped {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      border-color: transparent;
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    sw-dialog ul {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      display: grid;
      gap: 4px;
      max-block-size: min(36dvh, 240px);
      overflow: auto;
    }
    sw-dialog p {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    sw-dialog .count {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }

    /* CAMADMIN-POLISH-2331 - the R5-LIVE-297 camera-settings language on this screen (wells instead of outlined boxes, a chosen row as a
       filled accent field with a bar at its start edge, names bold in the heading ink, counts as bold numerals, hovers only under a fine
       pointer, presses that give), and the fit of the wide layout */
    .banner {
      border-color: transparent;
      border-radius: var(--sw-r-lg);
      background: color-mix(in srgb, var(--sw-warning) 14%, var(--sw-surface));
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      padding: 12px 16px;
    }
    .cams {
      gap: 2px;
      padding: 4px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    .cam {
      gap: 10px;
      padding: 0 14px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: transparent;
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      transition: background-color var(--sw-t-fast) var(--sw-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      .cam:hover:not([disabled]):not([aria-current='true']) {
        background: var(--sw-surface-3);
      }
    }
    .cam:active:not([disabled]) {
      background: var(--sw-pressed-wash);
    }
    .cam[aria-current='true'] {
      background: color-mix(in srgb, var(--sw-accent) 22%, var(--sw-surface));
      box-shadow: inset -4px 0 0 var(--sw-accent); /* the start edge in RTL (offsets are physical) */
      font-weight: var(--sw-fw-bold);
    }
    :host-context([dir='ltr']) .cam[aria-current='true'] {
      box-shadow: inset 4px 0 0 var(--sw-accent);
    }
    .cam[disabled] {
      cursor: default;
      color: var(--sw-text-2);
    }
    .cam[disabled][aria-current='true'] {
      color: var(--sw-heading);
    }
    .cam bdi {
      margin-inline-start: auto;
      min-inline-size: 22px;
      padding: 1px 7px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      text-align: center;
    }
    .cam .dot {
      inline-size: 9px;
      block-size: 9px;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--sw-accent) 25%, transparent);
    }
    .bar {
      gap: 8px;
      padding: 6px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    .bar .count {
      padding-inline: 8px;
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
    }
    .bar .sw-switch {
      padding-inline: 8px 12px;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .frame {
      border-color: transparent;
      border-radius: var(--sw-r-media);
      box-shadow: var(--sw-shadow-2);
      background: var(--sw-video-bg);
    }
    .frame .nopic {
      color: var(--sw-on-video-2);
    }
    .ghost {
      background: color-mix(in srgb, var(--sw-accent) 20%, transparent);
      border-radius: var(--sw-r-2xs);
    }
    .insp {
      display: grid;
      align-content: start;
      gap: var(--sw-s-4);
      min-inline-size: 0;
    }
    .regions:empty {
      display: none;
    }
    .regions {
      gap: 2px;
      padding: 4px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    .regions li {
      gap: 4px;
    }
    .regions .pick {
      border: 0;
      border-radius: var(--sw-r-md);
      background: transparent;
      padding: 0 14px;
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      -webkit-tap-highlight-color: transparent;
      transition: background-color var(--sw-t-fast) var(--sw-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      .regions .pick:hover:not([aria-pressed='true']) {
        background: var(--sw-surface-3);
      }
    }
    .regions .pick:active {
      background: var(--sw-pressed-wash);
    }
    .regions .pick[aria-pressed='true'] {
      background: color-mix(in srgb, var(--sw-accent) 22%, var(--sw-surface));
      box-shadow: inset -4px 0 0 var(--sw-accent);
      font-weight: var(--sw-fw-bold);
    }
    :host-context([dir='ltr']) .regions .pick[aria-pressed='true'] {
      box-shadow: inset 4px 0 0 var(--sw-accent);
    }
    h3 {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      margin-block-end: 6px;
    }
    .history ul {
      margin: 0;
      gap: 2px;
      padding: 4px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    .history li,
    .results li {
      border: 0;
      border-radius: var(--sw-r-md);
      padding-block: 4px;
      padding-inline: 14px 6px;
      background: transparent;
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .history li .when {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .history li sw-button,
    .results li sw-button {
      margin-inline-start: auto;
    }
    .history li[data-status='failed'],
    .history li[data-status='diverged'] {
      background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface-2));
    }
    .history .muted {
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    .results {
      margin: 0;
      gap: 2px;
      padding: 4px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    .results .name {
      font-weight: var(--sw-fw-bold);
    }
    .results .st {
      font-weight: var(--sw-fw-medium);
    }
    .results .st.bad {
      color: var(--sw-danger-text);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-md);
    }
    p.err[role='alert'] {
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
    }
    .review h3 {
      font-size: var(--sw-fs-lg);
    }
    .rv-card {
      border-color: transparent;
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2);
      padding: 14px;
      gap: 10px;
    }
    .rv-card .name {
      font-size: var(--sw-fs-lg);
      font-weight: 800;
      color: var(--sw-heading);
      letter-spacing: -0.01em;
    }
    .rv-card[data-status='invalid'],
    .rv-card[data-status='skipped'] {
      background: color-mix(in srgb, var(--sw-danger) 8%, var(--sw-surface));
    }
    .pair figcaption {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-text-2);
    }
    .thumb {
      border-color: transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-video-bg);
    }
    .st-chip {
      display: inline-flex;
      align-items: center;
      min-block-size: 24px;
      padding: 0 10px;
      border: 0;
      background: var(--sw-surface-3);
      color: var(--sw-heading);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
    }
    .st-chip.ready {
      color: var(--sw-success-text);
    }
    .st-chip.invalid,
    .st-chip.skipped {
      color: var(--sw-danger-text);
    }
    .foot {
      gap: 8px 12px;
    }
    /* the review button's footer: on a phone it sticks to the bottom of the view (on the page surface, a soft lift) so the action is
       always in reach; in the wide layout it closes the start column */
    .edit-foot {
      display: grid;
      gap: 8px;
      position: sticky;
      inset-block-end: 0;
      z-index: 2;
      padding-block: var(--sw-s-2);
      background: var(--sw-bg);
    }
    .edit-foot sw-button {
      justify-self: stretch;
    }
    sw-dialog p {
      font-size: var(--sw-fs-md);
      color: var(--sw-text);
    }
    sw-dialog .count {
      padding: 12px 16px;
      border-radius: var(--sw-r-lg);
      background: color-mix(in srgb, var(--sw-accent) 14%, var(--sw-surface));
      box-shadow: inset -4px 0 0 var(--sw-accent);
      color: var(--sw-heading);
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    :host-context([dir='ltr']) sw-dialog .count {
      box-shadow: inset 4px 0 0 var(--sw-accent);
    }
    sw-dialog ul li {
      padding: 7px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-heading);
      font-weight: var(--sw-fw-semibold);
    }
    @container pm (min-width: 760px) {
      @media (min-height: 560px) {
        .layout {
          block-size: max(420px, var(--pm-avail, 640px));
          align-items: stretch;
        }
        .layout > .cams {
          max-block-size: calc(var(--pm-avail, 640px) * 0.4);
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .layout > .insp {
          min-block-size: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
        }
        .layout > .edit-foot {
          position: static;
          margin: 0;
          padding: 0;
          background: none;
        }
        .main {
          min-block-size: 0;
          grid-template-rows: auto minmax(0, 1fr) auto;
          align-content: stretch;
        }
        .main[data-pm-step='review'],
        .main[data-pm-step='done'] {
          display: block;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
        }
        .stage {
          container-type: size;
          min-block-size: 200px;
        }
        .stage .frame {
          inline-size: min(100cqw, 100cqh * var(--pm-w) / var(--pm-h));
          max-inline-size: none;
        }
        .review .foot {
          position: sticky;
          inset-block-end: 0;
          padding-block: var(--sw-s-2);
          background: var(--sw-bg);
        }
      }
    }
  `;g([h()],b.prototype,"cameras",2);g([h()],b.prototype,"failure",2);g([h()],b.prototype,"loading",2);g([h()],b.prototype,"selected",2);g([h()],b.prototype,"loaded",2);g([h()],b.prototype,"drafts",2);g([h()],b.prototype,"regionKey",2);g([h()],b.prototype,"step",2);g([h()],b.prototype,"preview",2);g([h()],b.prototype,"previewing",2);g([h()],b.prototype,"confirmOpen",2);g([h()],b.prototype,"applying",2);g([h()],b.prototype,"applied",2);g([h()],b.prototype,"line",2);g([h()],b.prototype,"ghost",2);g([h()],b.prototype,"history",2);g([h()],b.prototype,"undoing",2);g([h()],b.prototype,"undone",2);g([h()],b.prototype,"brokenShot",2);g([h()],b.prototype,"switchOn",2);g([h()],b.prototype,"switchAsk",2);g([h()],b.prototype,"switchBusy",2);g([h()],b.prototype,"switchErr",2);g([h()],b.prototype,"avail",2);b=g([Y("system-security-privacy-masks")],b);var Si=Object.defineProperty,Ri=Object.getOwnPropertyDescriptor,G=(e,t,s,a)=>{for(var r=a>1?void 0:a?Ri(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&Si(t,s,r),r};const rt="access.unknown_person_uniform_404";let V=class extends W{constructor(){super(...arguments),this.loading=!0,this.failed="",this.policy=null,this.retention="",this.cap="",this.worker=null,this.uniform=null,this.canEdit=!1,this.busy="",this.error="",this.saved=!1,this.ticketsRev=0}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.loading=!0,this.failed="";try{const e=await A("settings");this.canEdit=!!e.can_edit&&(!ce()||bt("system.configure")),this.uniform=String(e.settings[rt]??"true")==="true";const t=String(e.settings["tickets.enabled"]??"false")==="true",[s,a]=await Promise.all([da().catch(()=>null),t?A("tickets/settings").catch(()=>null):Promise.resolve(null)]);this.policy=s?{pending_retention_days:s.pending_retention_days,pending_max_per_vendor:s.pending_max_per_vendor}:null,this.retention=s?String(s.pending_retention_days):"",this.cap=s?String(s.pending_max_per_vendor):"",this.worker=a?!!a.vendor_portal?.start_worker:null,this.ticketsRev=a?.revision??0}catch(e){this.failed=ge(e)}finally{this.loading=!1}}async run(e,t){if(!this.busy){this.busy=e,this.error="",this.saved=!1;try{await t(),this.saved=!0}catch(s){this.error=`${C("saveFailed")} · ${ge(s)}`}finally{this.busy=""}}}savePolicy(){const e=Lt(this.retention),t=Pt(this.cap);e===null||t===null||this.run("policy",async()=>{const s=await ha({pending_retention_days:e,pending_max_per_vendor:t});this.policy={pending_retention_days:s.pending_retention_days,pending_max_per_vendor:s.pending_max_per_vendor},this.retention=String(s.pending_retention_days),this.cap=String(s.pending_max_per_vendor)})}flipWorker(){if(this.worker===null)return;const e=!this.worker;this.run("worker",async()=>{const t=await mt("tickets/settings",{revision:this.ticketsRev,vendor_portal:{start_worker:e}});this.worker=!!t.vendor_portal?.start_worker,this.ticketsRev=t.revision})}flipUniform(){if(this.uniform===null)return;const e=!this.uniform;this.run("uniform",async()=>{const t=await Ws("settings",{[rt]:String(e)});this.uniform=String(t.settings[rt]??"true")==="true"})}toggle(e,t,s,a){return o`<button type="button" class="sw" role="switch" aria-checked=${String(s)} data-public-switch=${e} ?disabled=${!this.canEdit||!!this.busy} @click=${a}>
      <span class="t">${t}</span><span class="track" aria-hidden="true"></span>
    </button>`}body(){if(this.loading)return o`<sw-state-panel state="loading"></sw-state-panel>`;if(this.failed)return o`<sw-state-panel state="error" heading=${C("loadFailed")} hint=${this.failed} actionLabel=${C("retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=Lt(this.retention),t=Pt(this.cap),s=!!this.policy&&(e!==this.policy.pending_retention_days||t!==this.policy.pending_max_per_vendor);return o`<sw-card flush data-public-settings>
      ${this.policy?o`<section class="grp" data-public-group="pending">
            <h4>${C("secPending")}</h4>
            <div class="fields">
              <div class="f"><label for="ret">${C("retention")}</label>
                <input id="ret" inputmode="numeric" data-public-retention .value=${this.retention} aria-invalid=${String(e===null)} ?disabled=${!this.canEdit} @input=${a=>this.retention=a.target.value} />
                <small class=${e===null?"bad":""}>${e===null?C("invalidRetention"):C("zeroOff")}</small></div>
              <div class="f"><label for="cap">${C("cap")}</label>
                <input id="cap" inputmode="numeric" data-public-cap .value=${this.cap} aria-invalid=${String(t===null)} ?disabled=${!this.canEdit} @input=${a=>this.cap=a.target.value} />
                <small class=${t===null?"bad":""}>${t===null?C("invalidCap"):C("zeroOff")}</small></div>
            </div>
            <div class="row"><sw-button variant="primary" data-public-save ?disabled=${!this.canEdit||!s||e===null||t===null||!!this.busy} @click=${()=>this.savePolicy()}>${C("save")}</sw-button></div>
          </section>`:c}
      ${this.worker!==null?o`<section class="grp" data-public-group="portal"><h4>${C("secPortal")}</h4>${this.toggle("start_worker",C("startWorker"),this.worker,()=>this.flipWorker())}</section>`:c}
      ${this.uniform!==null?o`<section class="grp" data-public-group="access"><h4>${C("secAccess")}</h4>${this.toggle("uniform_404",C("uniform404"),this.uniform,()=>this.flipUniform())}</section>`:c}
      ${this.error?o`<div class="note err" role="alert" data-public-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:c}
      ${this.saved&&!this.error?o`<div class="grp"><span class="ok" role="status" data-public-saved><sw-icon name="check" size=${16}></sw-icon>${C("saved")}</span></div>`:c}
    </sw-card>`}render(){return o`<sw-page crumbs="הגדרות | אבטחה" heading=${C("title")}>${this.body()}</sw-page>`}};V.styles=[xs,Z`
      :host { display: block; }
      .grp { display: grid; gap: 12px; padding: 14px; border-block-start: 1px solid var(--sw-border); }
      .grp h4 { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
      .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
      .f { display: grid; gap: 4px; }
      .f label { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .f input { inline-size: 100%; box-sizing: border-box; min-block-size: var(--sw-touch-desktop); padding: 0 12px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border-strong); background: var(--sw-surface-solid); color: var(--sw-text); font: inherit; font-variant-numeric: tabular-nums; }
      .f input[aria-invalid='true'] { border-color: var(--sw-danger); }
      .f small { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .f .bad { color: var(--sw-danger-text, var(--sw-danger)); }
      .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); display: inline-flex; gap: 6px; align-items: center; }
      .sw { display: flex; align-items: center; gap: 14px; inline-size: 100%; min-block-size: var(--sw-touch-desktop); padding: 6px 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: start; cursor: pointer; }
      .sw:disabled { cursor: default; opacity: var(--sw-disabled-opacity); }
      .sw:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
      .sw { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      .sw:active:not(:disabled) .track { transform: scale(var(--sw-press-scale)); }
      .sw .t { flex: 1; min-inline-size: 0; font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
      .track { flex: none; position: relative; inline-size: 42px; block-size: 24px; border-radius: var(--sw-r-pill); background: var(--sw-toggle-off); transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease); }
      .track::after { content: ''; position: absolute; inset-block-start: 3px; inset-inline-start: 3px; inline-size: 18px; block-size: 18px; border-radius: 50%; background: var(--sw-toggle-thumb); box-shadow: var(--sw-shadow-1); transition: transform var(--sw-t-fast) var(--sw-ease); }
      .sw[aria-checked='true'] .track { background: var(--sw-toggle-on); }
      .sw[aria-checked='true'] .track::after { transform: translateX(-18px); }
      :host-context([dir='ltr']) .sw[aria-checked='true'] .track::after { transform: translateX(18px); }
      @media (max-width: 767px) { .grp { padding: 12px; } .fields { grid-template-columns: minmax(0, 1fr); } }
      @media (prefers-reduced-motion: reduce) { .track, .track::after { transition: none; } }
    `,Re];G([h()],V.prototype,"loading",2);G([h()],V.prototype,"failed",2);G([h()],V.prototype,"policy",2);G([h()],V.prototype,"retention",2);G([h()],V.prototype,"cap",2);G([h()],V.prototype,"worker",2);G([h()],V.prototype,"uniform",2);G([h()],V.prototype,"canEdit",2);G([h()],V.prototype,"busy",2);G([h()],V.prototype,"error",2);G([h()],V.prototype,"saved",2);V=G([Y("system-security-public")],V);const Oi=["wiskey.acr5_access_state","wiskey.acr5_normalize_user","wiskey.acr5_presence","wiskey.acr5_feature_plans"],Ti={"wiskey.acr5_access_state":"access","wiskey.acr5_normalize_user":"schedule","wiskey.acr5_presence":"presence","wiskey.acr5_feature_plans":"plans"},Pe="wiskey.auto_install",Ci=()=>A("wiskey/switches"),Ei=(e,t)=>mt("wiskey/switches",{switches:{[e]:t}});function Mi(e){return e.go_live_permitted===!0}function Ni(e){return e.auto_install_permitted===!0}function gs(e){return e instanceof y?e.code==="auto_install_not_permitted"?"installPermit":e.code==="wiskey_not_permitted"||e.status===409?"permit":e.status===403?"forbidden":e.status===422?"invalid":"other":"other"}const Li=(e,t)=>e?.switches?.[t]==="on"?"on":"off",Vs={tab:"קריאות בקרת כניסה",title:"קריאות בקרת כניסה",lead:"מתגים שמאפשרים למערכת לבקש מידע ממערכת בקרת הכניסה. כל מתג כבוי כברירת מחדל.",on:"פועל",off:"כבוי",detailsKey:"שם פנימי",accessTitle:"מצב הגישה של אדם",accessText:"בדיקה מול בקרת הכניסה אם הרשאה שבוטלה אכן הוסרה.",scheduleTitle:"השוואת לוח זמנים",scheduleText:"בדיקה אם לוח הזמנים אצל בקרת הכניסה זהה למה שאושר.",presenceTitle:"נוכחות",presenceText:"מידע לבירור בלבד; אינו משמש להוכחת הסרה.",plansTitle:"תוכניות יכולות",plansText:"קריאה של תוכניות בלבד; שום תוכנית אינה מבוצעת.",permitMissing:"אי אפשר להפעיל עדיין: הגרסה הזו אינה כוללת אישור הפעלה לקריאה הזו.",permitRefused:"ההפעלה נדחתה: הגרסה הזו אינה כוללת אישור הפעלה לקריאה הזו. המתג נשאר כבוי.",forbidden:"רק מנהל מערכת יכול לשנות הגדרה זו.",invalid:"הבקשה אינה תקינה.",failed:"השמירה נכשלה",loadFailed:"הטעינה נכשלה",retry:"נסו שוב",turnOn:"הפעלה",turnOff:"כיבוי",cancel:"ביטול",confirmOnQ:'להפעיל את "{name}"?',confirmOnText:"המערכת תתחיל לבקש מידע זה ממערכת בקרת הכניסה. אפשר לכבות שוב בכל רגע.",confirmOffQ:'לכבות את "{name}"?',confirmOffText:"המערכת תפסיק לבקש מידע זה. מה שאי אפשר לוודא ייחשב כלא ידוע.",doneOn:"המתג הופעל",doneOff:"המתג כובה",installGroup:"התקנה אוטומטית",installTitle:"התקנה אוטומטית של רכיב בקרת הכניסה",installText:"כשמופעל, המערכת מתקינה ומעדכנת את רכיב בקרת הכניסה בעצמה, רק אחרי שכל הבדיקות עוברות. התקנה ידנית או זרה לעולם אינה נדרסת.",installPermitMissing:"אי אפשר להפעיל עדיין: בדיקת התאימות של סביבת ההתקנה עדיין אינה יכולה לעבור, ובדיקת המעבדה המבודדת טרם הושלמה.",installPermitRefused:"ההפעלה נדחתה: בדיקת התאימות של סביבת ההתקנה עדיין אינה יכולה לעבור, ובדיקת המעבדה המבודדת טרם הושלמה. המתג נשאר כבוי.",installConfirmOnText:"המערכת תתקין ותעדכן את רכיב בקרת הכניסה בעצמה, רק כשכל הבדיקות עוברות. התקנה ידנית או זרה לא תידרס. אפשר לכבות בכל רגע.",installConfirmOffText:"המערכת תפסיק להתקין ולעדכן את רכיב בקרת הכניסה. מה שכבר מותקן נשאר כפי שהוא."},Pi={tab:"Access-control reads",title:"Access-control reads",lead:"Switches that let the system ask the access-control system for information. Every switch is off by default.",on:"On",off:"Off",detailsKey:"Internal name",accessTitle:"A person's access state",accessText:"Checks with access control that a revoked permission was really removed.",scheduleTitle:"Schedule comparison",scheduleText:"Checks that the schedule held by access control matches what was approved.",presenceTitle:"Presence",presenceText:"Information for inquiry only; never used as proof of removal.",plansTitle:"Capability plans",plansText:"Reads plans only; no plan is ever carried out.",permitMissing:"It cannot be turned on yet: this version has no go-live permit for this read.",permitRefused:"Turning it on was refused: this version has no go-live permit for this read. The switch stays off.",forbidden:"Only a system administrator can change this setting.",invalid:"The request is not valid.",failed:"Saving failed",loadFailed:"Loading failed",retry:"Try again",turnOn:"Turn on",turnOff:"Turn off",cancel:"Cancel",confirmOnQ:'Turn on "{name}"?',confirmOnText:"The system will start asking access control for this information. You can turn it off again at any time.",confirmOffQ:'Turn off "{name}"?',confirmOffText:"The system will stop asking for this information. Anything that cannot be verified counts as unknown.",doneOn:"The switch is on",doneOff:"The switch is off",installGroup:"Automatic installation",installTitle:"Automatic installation of the access-control component",installText:"When on, the system installs and updates the access-control component by itself, only after every check passes. A manual or foreign installation is never overwritten.",installPermitMissing:"It cannot be turned on yet: the compatibility check of the installation environment cannot pass yet, and the isolated lab test is not done.",installPermitRefused:"Turning it on was refused: the compatibility check of the installation environment cannot pass yet, and the isolated lab test is not done. The switch stays off.",installConfirmOnText:"The system will install and update the access-control component by itself, only when every check passes. A manual or foreign installation is never overwritten. You can turn it off at any time.",installConfirmOffText:"The system will stop installing and updating the access-control component. What is already installed stays as it is."},Ii={tab:"قراءات التحكم في الدخول",title:"قراءات التحكم في الدخول",lead:"مفاتيح تتيح للنظام طلب معلومات من نظام التحكم في الدخول. كل مفتاح متوقف افتراضيا.",on:"يعمل",off:"متوقف",detailsKey:"الاسم الداخلي",accessTitle:"حالة وصول شخص",accessText:"تحقق لدى التحكم في الدخول من أن صلاحية ملغاة أُزيلت فعلا.",scheduleTitle:"مقارنة الجدول الزمني",scheduleText:"تحقق من أن الجدول لدى التحكم في الدخول مطابق لما تمت الموافقة عليه.",presenceTitle:"التواجد",presenceText:"معلومات للاستعلام فقط؛ لا تُستخدم كدليل على الإزالة.",plansTitle:"خطط القدرات",plansText:"قراءة الخطط فقط؛ لا تُنفذ أي خطة.",permitMissing:"لا يمكن التشغيل بعد: هذا الإصدار لا يتضمن إذن تشغيل لهذه القراءة.",permitRefused:"رُفض التشغيل: هذا الإصدار لا يتضمن إذن تشغيل لهذه القراءة. يبقى المفتاح متوقفا.",forbidden:"مدير النظام فقط يمكنه تغيير هذا الإعداد.",invalid:"الطلب غير صالح.",failed:"فشل الحفظ",loadFailed:"فشل التحميل",retry:"حاول مرة أخرى",turnOn:"تشغيل",turnOff:"إيقاف",cancel:"إلغاء",confirmOnQ:'تشغيل "{name}"؟',confirmOnText:"سيبدأ النظام بطلب هذه المعلومات من التحكم في الدخول. يمكن إيقافه مجددا في أي وقت.",confirmOffQ:'إيقاف "{name}"؟',confirmOffText:"سيتوقف النظام عن طلب هذه المعلومات. ما لا يمكن التحقق منه يُعد غير معروف.",doneOn:"تم تشغيل المفتاح",doneOff:"تم إيقاف المفتاح",installGroup:"التثبيت التلقائي",installTitle:"التثبيت التلقائي لمكوّن التحكم في الدخول",installText:"عند التشغيل، يثبّت النظام مكوّن التحكم في الدخول ويحدّثه بنفسه، فقط بعد نجاح كل الفحوص. لا يُستبدل أبدا تثبيت يدوي أو غريب.",installPermitMissing:"لا يمكن التشغيل بعد: فحص توافق بيئة التثبيت لا يمكنه النجاح بعد، واختبار المختبر المعزول لم يكتمل.",installPermitRefused:"رُفض التشغيل: فحص توافق بيئة التثبيت لا يمكنه النجاح بعد، واختبار المختبر المعزول لم يكتمل. يبقى المفتاح متوقفا.",installConfirmOnText:"سيثبّت النظام مكوّن التحكم في الدخول ويحدّثه بنفسه، فقط عند نجاح كل الفحوص. لن يُستبدل تثبيت يدوي أو غريب. يمكن الإيقاف في أي وقت.",installConfirmOffText:"سيتوقف النظام عن تثبيت مكوّن التحكم في الدخول وتحديثه. ما هو مثبت يبقى كما هو."},qi={tab:"Запросы к контролю доступа",title:"Запросы к контролю доступа",lead:"Переключатели, позволяющие системе запрашивать данные у системы контроля доступа. По умолчанию все выключены.",on:"Включён",off:"Выключен",detailsKey:"Внутреннее имя",accessTitle:"Состояние доступа человека",accessText:"Проверка у контроля доступа, что отозванное разрешение действительно снято.",scheduleTitle:"Сравнение расписания",scheduleText:"Проверка, что расписание в контроле доступа совпадает с утверждённым.",presenceTitle:"Присутствие",presenceText:"Только справочные данные; не служат доказательством снятия.",plansTitle:"Планы возможностей",plansText:"Только чтение планов; ни один план не выполняется.",permitMissing:"Пока включить нельзя: в этой версии нет разрешения на запуск этого запроса.",permitRefused:"Включение отклонено: в этой версии нет разрешения на запуск этого запроса. Переключатель остаётся выключенным.",forbidden:"Изменить эту настройку может только администратор системы.",invalid:"Некорректный запрос.",failed:"Не удалось сохранить",loadFailed:"Не удалось загрузить",retry:"Повторить",turnOn:"Включить",turnOff:"Выключить",cancel:"Отмена",confirmOnQ:"Включить «{name}»?",confirmOnText:"Система начнёт запрашивать эти данные у контроля доступа. Выключить можно в любой момент.",confirmOffQ:"Выключить «{name}»?",confirmOffText:"Система перестанет запрашивать эти данные. То, что нельзя проверить, считается неизвестным.",doneOn:"Переключатель включён",doneOff:"Переключатель выключен",installGroup:"Автоматическая установка",installTitle:"Автоматическая установка компонента контроля доступа",installText:"Если включено, система сама устанавливает и обновляет компонент контроля доступа, только после прохождения всех проверок. Ручная или чужая установка никогда не перезаписывается.",installPermitMissing:"Пока включить нельзя: проверка совместимости среды установки пока не может пройти, а тест в изолированной лаборатории не завершён.",installPermitRefused:"Включение отклонено: проверка совместимости среды установки пока не может пройти, а тест в изолированной лаборатории не завершён. Переключатель остаётся выключенным.",installConfirmOnText:"Система будет сама устанавливать и обновлять компонент контроля доступа, только когда все проверки пройдены. Ручная или чужая установка не перезаписывается. Выключить можно в любой момент.",installConfirmOffText:"Система перестанет устанавливать и обновлять компонент контроля доступа. Уже установленное остаётся как есть."};function Ai(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}const Vi={he:Vs,en:Pi,ar:Ii,ru:qi};function x(e,t,s=Ai()){const a=Vi[s][e]??Vs[e]??e;return t?a.replace(/\{(\w+)\}/g,(r,i)=>i in t?String(t[i]):r):a}var Hi=Object.defineProperty,Di=Object.getOwnPropertyDescriptor,se=(e,t,s,a)=>{for(var r=a>1?void 0:a?Di(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&Hi(t,s,r),r};let U=class extends W{constructor(){super(...arguments),this.loading=!0,this.failed="",this.forbidden=!1,this.view=null,this.pending=null,this.busy=!1,this.dlgError="",this.error="",this.done=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.loading=!0,this.failed="",this.forbidden=!1;try{this.view=await Ci()}catch(e){gs(e)==="forbidden"?this.forbidden=!0:this.failed=ge(e)}finally{this.loading=!1}}get canEdit(){return!ce()||bt("system.configure")}ask(e,t){this.busy||!this.canEdit||(this.error="",this.done=null,this.dlgError="",this.pending={key:e,next:t})}refusalText(e,t){return e==="installPermit"?x("installPermitRefused"):e==="permit"?x("permitRefused"):e==="forbidden"?x("forbidden"):e==="invalid"?x("invalid"):`${x("failed")} · ${ge(t)}`}async confirm(){const e=this.pending;if(!(!e||this.busy)){this.busy=!0,this.dlgError="";try{this.view=await Ei(e.key,e.next),this.done=e.next,this.pending=null}catch(t){const s=gs(t);(s==="permit"||s==="installPermit")&&this.view?(this.view=s==="installPermit"?{...this.view,auto_install_permitted:!1}:{...this.view,go_live_permitted:!1},this.pending=null,this.error=this.refusalText(s,t)):this.dlgError=this.refusalText(s,t)}finally{this.busy=!1}}}stem(e){return e===Pe?"install":Ti[e]}name(e){return x(`${this.stem(e)}Title`)}row(e,t){const s=Li(e,t)==="on",a=t===Pe,r=!s&&!(a?Ni(e):Mi(e)),i=this.stem(t);return o`<div class="sw-row" data-wiskey-switch=${i} data-state=${s?"on":"off"}>
      <div>
        <h4 class="t">${this.name(t)}<span class="pill" data-state=${s?"on":"off"} data-wiskey-state>${x(s?"on":"off")}</span></h4>
        <p class="x">${x(`${i}Text`)}</p>
        <p class="k" data-wiskey-details>${x("detailsKey")}: <code>${t}</code></p>
      </div>
      <sw-button variant=${s?"secondary":"primary"} data-wiskey-toggle ?disabled=${!this.canEdit||this.busy||r} @click=${()=>this.ask(t,s?"off":"on")}>${x(s?"turnOff":"turnOn")}</sw-button>
      ${r?o`<p class="why" data-wiskey-permit><sw-icon name="info" size="14"></sw-icon>${x(a?"installPermitMissing":"permitMissing")}</p>`:c}
    </div>`}dialog(){const e=this.pending;if(!e)return c;const t=e.next==="on",s=e.key===Pe,a=this.name(e.key);return o`<sw-dialog open heading=${x(t?"confirmOnQ":"confirmOffQ",{name:a})} data-wiskey-dialog=${e.next} @close=${()=>{this.busy||(this.pending=null)}}>
      <p style="margin:0">${x(s?t?"installConfirmOnText":"installConfirmOffText":t?"confirmOnText":"confirmOffText")}</p>
      ${this.dlgError?o`<p class="err-line" role="alert" data-wiskey-dialog-error>${this.dlgError}</p>`:c}
      <div class="foot"><sw-button variant="ghost" data-wiskey-cancel ?disabled=${this.busy} @click=${()=>this.pending=null}>${x("cancel")}</sw-button>
        <sw-button variant=${t?"primary":"danger"} data-wiskey-confirm ?disabled=${this.busy} @click=${()=>void this.confirm()}>${x(t?"turnOn":"turnOff")}</sw-button></div>
    </sw-dialog>`}body(){if(this.loading)return o`<sw-state-panel state="loading"></sw-state-panel>`;if(this.forbidden)return o`<sw-state-panel state="forbidden" data-wiskey-forbidden></sw-state-panel>`;if(this.failed||!this.view)return o`<sw-state-panel state="error" heading=${x("loadFailed")} hint=${this.failed} actionLabel=${x("retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=this.view;return o`<sw-card flush data-wiskey-switches>
      <p class="lead">${x("lead")}</p>
      ${Oi.map(t=>this.row(e,t))}
      <h3 class="grp-h" data-wiskey-install-group>${x("installGroup")}</h3>
      ${this.row(e,Pe)}
      ${this.error?o`<div class="note err" role="alert" data-wiskey-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:c}
      ${this.done&&!this.error?o`<div class="grp"><span class="ok" role="status" data-wiskey-saved><sw-icon name="check" size=${16}></sw-icon>${x(this.done==="on"?"doneOn":"doneOff")}</span></div>`:c}
    </sw-card>
    ${this.dialog()}`}render(){return o`<sw-page crumbs="הגדרות | אבטחה" heading=${x("title")}>${this.body()}</sw-page>`}};U.styles=[xs,Z`
      :host { display: block; }
      .lead { margin: 0; padding: 14px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .sw-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 14px; align-items: center; padding: 14px; border-block-start: 1px solid var(--sw-border); }
      .sw-row .t { margin: 0; font-size: var(--sw-fs-lg); color: var(--sw-heading); font-weight: var(--sw-fw-bold); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } /* R5-SECURITY: the switch's name 15/700 */
      .sw-row .x { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .sw-row .k { margin: 4px 0 0; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .sw-row .k code { font-family: var(--sw-font-mono, monospace); direction: ltr; unicode-bidi: isolate; }
      .sw-row .why { grid-column: 1 / -1; margin: 0; display: inline-flex; gap: 6px; align-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .pill { display: inline-flex; align-items: center; min-block-size: 24px; padding: 0 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); background: var(--sw-surface-3, var(--sw-border)); color: var(--sw-text-2); } /* R5-SECURITY: the state is a filled 12.5/700 field */
      .pill[data-state='on'] { background: var(--sw-success-bg, var(--sw-toggle-on)); color: var(--sw-success-text, var(--sw-text)); }
      .foot { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-block-start: 14px; }
      .err-line { margin: 10px 0 0; color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
      .grp { padding: 14px; border-block-start: 1px solid var(--sw-border); }
      .grp-h { margin: 0; padding: 14px 14px 0; border-block-start: 1px solid var(--sw-border); color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); }
      .grp-h + .sw-row { border-block-start: 0; }
      .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); display: inline-flex; gap: 6px; align-items: center; }
      @media (max-width: 767px) { .sw-row { grid-template-columns: minmax(0, 1fr); } }
    `,Re];se([h()],U.prototype,"loading",2);se([h()],U.prototype,"failed",2);se([h()],U.prototype,"forbidden",2);se([h()],U.prototype,"view",2);se([h()],U.prototype,"pending",2);se([h()],U.prototype,"busy",2);se([h()],U.prototype,"dlgError",2);se([h()],U.prototype,"error",2);se([h()],U.prototype,"done",2);U=se([Y("system-security-wiskey")],U);var Fi=Object.defineProperty,Bi=Object.getOwnPropertyDescriptor,me=(e,t,s,a)=>{for(var r=a>1?void 0:a?Bi(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&Fi(t,s,r),r};function ji(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?String(e):vs(t)}let ue=class extends W{constructor(){super(...arguments),this.bubbleSkin=new wt(this),this.sub="",this.panelId="",this.presenceKnown=Ys()!==null,this.tabsMode=new Gs(this,"settings"),this.giveUp=0}connectedCallback(){super.connectedCallback(),this.stopPresence=Qs(e=>{ta(e),this.presenceKnown=e!==null,this.requestUpdate()}),Js(),this.giveUp=window.setTimeout(()=>this.presenceKnown=!0,2500)}disconnectedCallback(){super.disconnectedCallback(),this.stopPresence?.(),window.clearTimeout(this.giveUp)}get api(){return ce()}permitted(e){const t=Ce.find(s=>s.id===e);return!!t&&(!this.api||Ie(t.href??"",be))}offered(){return Xs(Ce,this.api,be)}redirectTo(e){const t=e==="alarm"&&this.panelId?`?panel=${encodeURIComponent(this.panelId)}`:"";window.location.replace(`#/system/security/${e}${t}`)}render(){const e=this.offered();if(!Ce.some(r=>r.id===this.sub)||!this.permitted(this.sub)){if(this.api&&!this.presenceKnown)return o`<sw-state-panel state="loading"></sw-state-panel>`;const r=e[0]?.href?.split("/").pop();return r?(queueMicrotask(()=>this.redirectTo(r)),o`<sw-state-panel state="loading"></sw-state-panel>`):o`<sw-page crumbs="הגדרות" heading="אבטחה"><sw-state-panel state="forbidden" data-security-settings-forbidden></sw-state-panel></sw-page>`}const s=Ce.find(r=>r.id===this.sub),a=s&&!e.some(r=>r.id===s.id)?[...e,s]:e;return o`${a.length>1?o`<div class="tabs" data-security-settings-tabs><sw-tabs .variant=${this.tabsMode.props(Ot("system.security")).variant} ?adaptive=${this.tabsMode.props(Ot("system.security")).adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} .items=${a} .active=${this.sub}></sw-tabs></div>`:c}
      ${this.sub==="alarm"?o`<security-alarm .panelId=${this.panelId}></security-alarm>`:this.sub==="manage"?o`<sw-page crumbs="הגדרות | אבטחה" heading="ניהול אזעקה" subheading="לוחות, קוד הלוח, שיוך חיישנים לעקיפה ומדיניות מרחוק"><system-alarm-settings ?canEdit=${this.api&&be("system.configure",!0)}></system-alarm-settings></sw-page>`:this.sub==="cameras"?o`<system-security-cameras></system-security-cameras>`:this.sub==="privacy-masks"?o`<system-security-privacy-masks></system-security-privacy-masks>`:this.sub==="public"?o`<system-security-public></system-security-public>`:this.sub==="wiskey"?o`<system-security-wiskey></system-security-wiskey>`:this.sub==="incidents"?o`<sw-page crumbs="הגדרות | אבטחה" heading="מצב אירוע חי" subheading="עמוד אחד לאירוע בזמן אמת: צפייה בלבד, ללא פעולה פיזית"><incident-settings-form data-incident-settings-page></incident-settings-form></sw-page>`:o`<system-security-nvr></system-security-nvr>`}`}};ue.styles=[ea,Z`
    .tabs {
      padding: 14px var(--sw-page-pad) 0;
    }
    .tabs sw-tabs[data-variant^='underline'] {
      inline-size: 100%;
    }
    .rows {
      display: grid;
    }
    .warn {
      color: var(--sw-warning-text);
    }
  `,Re];me([S()],ue.prototype,"sub",2);me([S()],ue.prototype,"panelId",2);me([h()],ue.prototype,"presenceKnown",2);ue=me([Y("system-security")],ue);let Se=class extends W{constructor(){super(...arguments),this.bubbleSkin=new wt(this),this.h=null,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(ce())try{this.h=await A("health"),this.error=""}catch(e){this.error=ge(e)}}render(){if(!ce())return o`<sw-page crumbs="הגדרות | אבטחה" heading="NVR"><sw-state-panel icon="shield" state="empty" heading="המצב מוצג מול שרת אמיתי" hint="במצב הדגמה אין NVR לקרוא."></sw-state-panel></sw-page>`;if(this.error&&!this.h)return o`<sw-page crumbs="הגדרות | אבטחה" heading="NVR"><sw-state-panel state="error" heading="מצב ה־NVR לא נטען" hint=${this.error} actionLabel="נסו שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`;if(!this.h)return o`<sw-page crumbs="הגדרות | אבטחה" heading="NVR"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.h,t=Zs()||e.mode==="ha_only",s=[{href:"#/system/setup",label:"חיבורים והגדרות ה־NVR",show:Ie("#/system/setup",be)},{href:Tt,label:"הגדרות מצלמות",show:!t&&Ie(Tt,be)},{href:"#/investigate/health",label:"בריאות מצלמות",show:!t&&Ie("#/investigate/health",be)}].filter(a=>a.show);return o`<sw-page crumbs="הגדרות | אבטחה" heading="NVR" subheading=${t?"ללא NVR":e.nvr_configured?"מוגדר":"לא מוגדר"}>
      <sw-card heading="מצב" data-security-nvr>
        <div class="rows">
          <div class="row"><span>NVR</span><span class=${t?"":e.nvr_configured?"msg ok":"msg err"}>${t?"מצב ללא NVR":e.nvr_configured?"מוגדר":"לא מוגדר"}</span></div>
          ${t?c:o`<div class="row"><span>זרם התראות</span><span class=${e.events.ingest.connected?"msg ok":"msg err"}>${e.events.ingest.connected?"מחובר":"מנותק"}</span></div>
                <div class="row"><span>ערוצים שגולו</span><span>${e.discovery.cameras}</span></div>
                <div class="row"><span>גילוי אחרון תקין</span><span class=${e.discovery.cameras_last_error?"warn":""}>${ji(e.discovery.cameras_last_ok)}</span></div>`}
        </div>
        ${s.length?o`<div class="actions">${s.map(a=>o`<sw-button size="sm" variant="ghost" @click=${()=>window.location.hash=a.href}>${a.label}</sw-button>`)}</div>`:c}
      </sw-card>
    </sw-page>`}};Se.styles=[ue.styles,Re];me([h()],Se.prototype,"h",2);me([h()],Se.prototype,"error",2);Se=me([Y("system-security-nvr")],Se);export{ue as SystemSecurity,Se as SystemSecurityNvr};
//# sourceMappingURL=system-security-B_r274XH.js.map
