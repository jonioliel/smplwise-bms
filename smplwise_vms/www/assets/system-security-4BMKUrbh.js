import{E as Z,F as R,a as K,A as c,e as o,H as U,i as de,cF as Zs,b8 as V,g as D,bc as Me,j as v,G as d,b6 as ea,zL as ta,zM as sa,bW as Oe,iI as Ue,C as Ne,S as $t,T as fe,Q as aa,zN as It,aw as Ye,hn as ra,vb as ia,eM as na,w as At,kd as Cs,b9 as oa,zO as la,du as ca,zP as da,zQ as pa,zR as Ie,zS as He,jK as ha,jM as qt,jO as ke,ey as ua,zT as Bt,g7 as fa,zU as ma}from"./index-CNy_qMuw.js";import"./security-alarm-ph09fL8-.js";import"./system-alarm-DhCdLXhH.js";import{u as Ms,p as Vt,d as wa,P as Dt,e as Ht,f as Ft,S as ga,R as ba,g as va,h as _a,i as ya,j as xa,k as ka}from"./nvr-h264-preset-CWl-CnDx.js";import{F as $a,G as za}from"./access-grants-NmOCiYaF.js";import{s as zt}from"./status-css-Cn7tLg9a.js";import{s as M,p as jt,c as Kt}from"./pending-model-Cht6LwLi.js";import"./settings-form-qtbR08RL.js";import"./sw-logo-art-Va6y_cIM.js";var Sa=Object.defineProperty,Ra=Object.getOwnPropertyDescriptor,Ns=(e,t,s,a)=>{for(var r=a>1?void 0:a?Ra(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&Sa(t,s,r),r};let We=class extends K{constructor(){super(...arguments),this.model=null,this.cancel=()=>this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=this.model;return o`<sw-dialog ?open=${!!e} heading=${e?.heading??""} data-nvr-confirm-dialog @close=${t=>{t.stopPropagation(),this.cancel()}}>
      ${e?o`<p data-nvr-confirm-lead>${e.lead}</p>
            <p class="count" data-nvr-confirm-count>${e.count}</p>
            <details data-nvr-confirm-details>
              <summary>פרטים</summary>
              ${e.names?o`<ul class="names" data-nvr-confirm-names tabindex="0" aria-label="המצלמות">${e.names.map(t=>o`<li>${t}</li>`)}</ul>`:o`<ul>${e.details.map(t=>o`<li data-field=${t.field}><span class="k">${t.label}</span><bdi>${t.from}</bdi><span class="arrow" aria-hidden="true">←</span><bdi>${t.to}</bdi></li>`)}</ul>`}
            </details>
            ${e.extraLabel?o`<div class="extra"><sw-button variant="ghost" size="sm" data-nvr-extra @click=${()=>this.dispatchEvent(new CustomEvent("extra",{bubbles:!0,composed:!0}))}>${e.extraLabel}</sw-button></div>`:c}
            <sw-button slot="footer" variant="ghost" data-nvr-cancel @click=${this.cancel}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-confirm @click=${()=>this.dispatchEvent(new CustomEvent("confirm",{bubbles:!0,composed:!0}))}>${e.confirmLabel}</sw-button>`:c}
    </sw-dialog>`}};We.styles=Z`
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
  `;Ns([R({attribute:!1})],We.prototype,"model",2);We=Ns([U("nvr-confirm")],We);function Ta(e){if(!e||typeof e!="object")return null;const t=e,s="options"in t&&!Array.isArray(t.codec)?t.options:t;if(!Oa(s))return null;const a=s;return a.locks?a:{...a,locks:{}}}const Ae=e=>Array.isArray(e),Se=e=>!!e&&typeof e=="object"&&!Array.isArray(e),Ut=e=>e==null||Se(e)&&typeof e.min=="number"&&typeof e.max=="number";function Oa(e){if(!Se(e))return!1;const t=e;return Ae(t.codec)&&Se(t.profile)&&Se(t.resolution)&&Ae(t.fps)&&Ae(t.bitrate_mode)&&Ae(t.quality)&&Ut(t.bitrate_kbps)&&Ut(t.gop)&&(t.locks===void 0||Se(t.locks))}const se=encodeURIComponent,Ea={recorders:()=>D("nvr/recorders"),cameras:e=>D(`nvr/cameras${e?`?recorder_id=${se(e)}`:""}`),camera:e=>D(`nvr/cameras/${se(e)}`),options:async(e,t,s)=>Ta(await D(`nvr/cameras/${se(e)}/streams/${se(t)}/options${s?`?codec=${se(s)}`:""}`)),writeStream:(e,t,s)=>Me(`nvr/cameras/${se(e)}/streams/${se(t)}`,s),changes:(e,t=30)=>D(`nvr/changes?camera_id=${se(e)}&limit=${t}`),undo:e=>V(`nvr/changes/${se(e)}/rollback`,{confirm:!0}),addChannel:(e,t)=>V(`nvr/recorders/${se(e)}/channels`,t),removeChannel:(e,t)=>Zs(`nvr/cameras/${se(e)}/channel`,{method:"DELETE",body:JSON.stringify({confirm_name:t})})};function Ls(e){if(!e.codec)return["unknown","codec_unknown"];if(e.codec==="H.265")return["unknown","h265"];if(e.codec==="MJPEG")return["no","mjpeg"];if(e.codec!=="H.264")return["unknown","codec_other"];if(e.b_frames===!0)return["no","b_frames"];if(e.svc===!0)return["unknown","svc"];const t=(e.profile??"").toLowerCase();return e.b_frames===!1||t.startsWith("baseline")||t.startsWith("bp")||t.startsWith("constrained")?["ok","h264_no_b_frames"]:["ok","h264"]}const Q=e=>JSON.parse(JSON.stringify(e)),qe={recorder_id:"nvr-1",name:"NVR ראשי",vendor:"hikvision",model:"DS-7616NI-DEMO",firmware:"V4.84 demo",enabled:!0,online:!0,checked_at:"2026-10-01T09:00:00Z",error:null,capabilities:{read_encodings:!0,write_encodings:!0,add_channel:!0,remove_channel:!0,max_channels:16,used_channels:4,encoding_fields:["codec","profile","resolution","fps","bitrate_mode","bitrate_kbps","quality","gop","svc","smart_codec"]}},Ps={codec:["H.264","H.265"],profile:{"H.264":["Baseline","Main","High"],"H.265":["Main"]},resolution:{"H.264":["2560x1440","1920x1080","1280x720"],"H.265":["2560x1440","1920x1080"]},fps:[25,20,15,12,10,8,6,4,2,1],fps_full:!0,bitrate_mode:["CBR","VBR"],bitrate_kbps:{min:32,max:8192},quality:[10,30,45,60,75,90],gop:{min:1,max:400},svc:!0,smart_codec:!0,b_frames:!1,locks:{smart_codec:["gop","bitrate_mode","quality"]},source:"capabilities"},Ca={...Ps,resolution:{"H.264":["640x360","640x480","352x288"],"H.265":["640x360","640x480"]},bitrate_kbps:{min:32,max:2048},smart_codec:!1,locks:{}};function le(e,t,s){const a={stream_ref:e,role:t,enabled:!0,codec:"H.264",codec_raw:"H.264",codec_plus:!1,profile:null,resolution:"1920x1080",fps:25,fps_full:!1,bitrate_mode:"VBR",bitrate_kbps:2048,quality:60,gop:50,svc:null,smart_codec:!1,b_frames:null,webrtc:"unknown",webrtc_reason:"codec_unknown",fields:{b_frames:{supported:!1,editable:!1}},writable:!0,not_writable_reason:null,etag:`${e}-1`,...s};return a.svc===null&&(a.fields.svc={supported:!1,editable:!1}),[a.webrtc,a.webrtc_reason]=Ls(a),a.codec_plus=a.smart_codec===!0||String(a.codec_raw??"").endsWith("+"),a}function Ma(){const e=(s,a,r,i={})=>({camera_id:`demo-cam-${s}`,recorder_id:"nvr-1",source_ref:String(s),channel:s,name:a,online:!0,enabled_in_arx:!0,streams:r,error:null,...i}),t=s=>le(`${s}02`,"sub",{resolution:"640x360",fps:20,bitrate_kbps:1024});return[e(1,"כניסה",[le("101","main",{resolution:"2560x1440",fps:null,fps_full:!0,bitrate_kbps:3072,svc:!0}),t(1)]),e(2,"חניה",[le("201","main",{resolution:"2560x1440",fps:null,fps_full:!0,bitrate_kbps:3072,svc:!0}),t(2)]),e(3,"חצר אחורית",[le("301","main",{codec:"H.265",codec_raw:"H.265",profile:"Main",resolution:"2560x1440",bitrate_kbps:2048,svc:!1}),le("302","sub",{codec:"H.265",codec_raw:"H.265",profile:"Main",resolution:"640x360",fps:20,bitrate_kbps:512,svc:!0,smart_codec:!0}),le("303","third",{resolution:"1280x720",fps:12,bitrate_kbps:1024})]),e(4,"מחסן",[le("401","main",{resolution:"1920x1080",svc:!1,profile:"High"}),t(4)],{online:!1})]}function S(e,t,s,a={}){throw new v(e,{code:t,user_message:s,retryable:!1,correlation_id:"demo",details:a})}const Wt={codec:"קידוד",profile:"פרופיל",resolution:"רזולוציה",fps:"FPS",bitrate_mode:"סוג קצב",bitrate_kbps:"קצב",quality:"איכות",gop:"GOP",svc:"SVC",smart_codec:"Smart codec",b_frames:"B-frames"};class Na{constructor(){this.cameras_=Ma(),this.changes_=[],this.seq=0}find(t){return this.cameras_.find(s=>s.camera_id===t)??S(404,"not_found","המצלמה לא נמצאה.")}optionsOf(t){return Q(t.role==="main"?Ps:Ca)}async recorders(){return{recorders:[{...Q(qe),capabilities:{...qe.capabilities,used_channels:this.cameras_.length}}],can_write:!0}}async cameras(t){return{cameras:Q(this.cameras_.filter(s=>!t||s.recorder_id===t)),recorders_failed:[],stale:!1,can_write:!0}}async camera(t){const s=this.find(t);return{camera:Q(s),can_write:!0,options:Object.fromEntries(s.streams.map(a=>[a.stream_ref,this.optionsOf(a)]))}}async options(t,s,a){const r=this.find(t).streams.find(n=>n.stream_ref===s)??S(404,"not_found","הזרם לא נמצא."),i=this.optionsOf(r);return a&&!i.codec.includes(a)&&S(422,"value_not_allowed","הערך אינו נתמך במצלמה.",{field:"codec",allowed:i.codec}),i}async writeStream(t,s,a){const r=this.find(t),i=r.streams.find(y=>y.stream_ref===s)??S(404,"not_found","הזרם לא נמצא.");a.confirm!==!0&&S(422,"confirm_required","נדרש אישור."),a.if_match!==i.etag&&S(409,"stale","הערכים השתנו ב־NVR. נטען מחדש.",{stream:Q(i)}),r.online===!1&&S(503,"source_unavailable","המצלמה אינה זמינה כרגע.");const n=this.optionsOf(i),l=a.changes,h=Object.keys(l);h.length||S(422,"validation","אין מה לשנות.");const p=l.codec??i.codec??"H.264",w=(y,Le,Pe)=>{Le||S(422,"value_not_allowed","הערך אינו נתמך במצלמה.",{field:y,allowed:Pe??[]})};for(const y of h)i.fields[y]?.supported===!1&&S(422,"field_not_supported",`${Wt[y]} אינו נתמך בזרם הזה.`,{field:y});l.codec!==void 0&&w("codec",n.codec.includes(l.codec),n.codec),l.profile!==void 0&&w("profile",(n.profile[p]??[]).includes(l.profile),n.profile[p]),l.resolution!==void 0&&w("resolution",(n.resolution[p]??[]).includes(l.resolution),n.resolution[p]),l.fps!==void 0&&w("fps",l.fps==="full"?n.fps_full:n.fps.includes(l.fps),n.fps),l.bitrate_mode!==void 0&&w("bitrate_mode",n.bitrate_mode.includes(l.bitrate_mode),n.bitrate_mode),l.bitrate_kbps!==void 0&&w("bitrate_kbps",l.bitrate_kbps>=n.bitrate_kbps.min&&l.bitrate_kbps<=n.bitrate_kbps.max,[n.bitrate_kbps.min,n.bitrate_kbps.max]),l.quality!==void 0&&w("quality",(l.bitrate_mode??i.bitrate_mode)==="VBR"&&n.quality.includes(l.quality),n.quality),l.gop!==void 0&&w("gop",l.gop>=n.gop.min&&l.gop<=n.gop.max,[n.gop.min,n.gop.max]),l.svc!==void 0&&w("svc",n.svc),l.smart_codec!==void 0&&w("smart_codec",n.smart_codec),l.b_frames!==void 0&&S(422,"field_not_supported","B-frames אינו נתמך בזרם הזה.",{field:"b_frames"});const m=l.smart_codec??i.smart_codec;for(const y of m?n.locks.smart_codec??[]:[])y in l&&y!=="smart_codec"&&S(422,"field_locked",`${Wt[y]} נעול כש־Smart codec פעיל.`,{field:y,locked_by:"smart_codec"});const $=Q(i),z=[],N=[],te=(y,Le,Pe)=>{i[Le]===Pe?N.push(y):(i[Le]=Pe,z.push(y))};if(l.codec!==void 0&&(te("codec","codec",l.codec),i.codec_raw=l.codec,l.profile===void 0&&(i.profile=null)),l.profile!==void 0&&te("profile","profile",l.profile),l.resolution!==void 0&&te("resolution","resolution",l.resolution),l.fps!==void 0){const y=l.fps==="full";i.fps_full===y&&(y||i.fps===l.fps)?N.push("fps"):([i.fps_full,i.fps]=[y,y?null:l.fps],z.push("fps"))}l.bitrate_mode!==void 0&&te("bitrate_mode","bitrate_mode",l.bitrate_mode),l.bitrate_kbps!==void 0&&te("bitrate_kbps","bitrate_kbps",l.bitrate_kbps),l.quality!==void 0&&te("quality","quality",l.quality),l.gop!==void 0&&te("gop","gop",l.gop),l.svc!==void 0&&te("svc","svc",l.svc),l.smart_codec!==void 0&&te("smart_codec","smart_codec",l.smart_codec),[i.webrtc,i.webrtc_reason]=Ls(i),z.length&&(i.etag=`${i.stream_ref}-${++this.seq+1}`);const Lt=`demo-change-${++this.seq}`;if(!z.length)return{change:null,stream:Q(i),applied_fields:[],unchanged_fields:N,reboot_required:!1};const Xs=Object.fromEntries(z.map(y=>[y,[$[y],i[y]]])),Pt=new Date().toISOString();return this.changes_.push({id:Lt,camera_id:t,stream_ref:s,before:$,after:Q(i),status:"applied",fields:Xs,created_at:Pt}),{change:{id:Lt,status:"applied",kind:"stream_encoding",created_at:Pt},stream:Q(i),applied_fields:z,unchanged_fields:N,reboot_required:!1}}async changes(t,s=30){return{changes:this.changes_.filter(r=>r.camera_id===t).reverse().slice(0,s).map(r=>({id:r.id,status:r.status,kind:"stream_encoding",created_at:r.created_at,camera_id:r.camera_id,stream_ref:r.stream_ref,fields:r.fields}))}}async undo(t){const s=this.changes_.find(h=>h.id===t)??S(404,"not_found","השינוי לא נמצא.");s.status!=="applied"&&S(409,"not_rollbackable","אין לשינוי הזה מסמך קודם להחזיר.",{status:s.status});const a=this.find(s.camera_id),r=a.streams.findIndex(h=>h.stream_ref===s.stream_ref);(r<0||a.streams[r].etag!==s.after.etag)&&S(409,"stale","הערכים השתנו ב־NVR. נטען מחדש."),a.streams[r]={...Q(s.before),etag:`${s.stream_ref}-${++this.seq+1}`},s.status="rolled_back";const i=`demo-change-${++this.seq}`,n=new Date().toISOString(),l=Object.fromEntries(Object.entries(s.fields).map(([h,p])=>[h,[p[1],p[0]]]));return this.changes_.push({id:i,camera_id:s.camera_id,stream_ref:s.stream_ref,before:s.after,after:Q(a.streams[r]),status:"applied",fields:l,created_at:n}),{change:{id:i,status:"applied",kind:"stream_encoding",created_at:n},stream:Q(a.streams[r]),rollback_of:t,reboot_required:!1}}async addChannel(t,s){t!==qe.recorder_id&&S(404,"not_found","ה־NVR לא נמצא."),s.confirm!==!0&&S(422,"confirm_required","נדרש אישור."),(!s.name.trim()||!s.address.trim()||!s.username.trim()||!s.password)&&S(422,"validation","חסרים פרטים.");const a=new Set(this.cameras_.map(l=>l.channel)),r=qe.capabilities.max_channels??0;let i=1;for(;a.has(i);)i++;return i>r&&S(409,"channel_slots_full","אין ערוץ פנוי ב־NVR."),this.cameras_.push({camera_id:`demo-cam-${i}`,recorder_id:t,source_ref:String(i),channel:i,name:s.name.trim(),online:!0,enabled_in_arx:!0,error:null,streams:[le(`${i}01`,"main",{svc:!1}),le(`${i}02`,"sub",{resolution:"640x360",fps:20,bitrate_kbps:1024})]}),{change:{id:`demo-change-${++this.seq}`,status:"applied",kind:"channel_add",created_at:new Date().toISOString()},channel:{source_ref:String(i),name:s.name.trim(),online:!0},discovery:"queued"}}async removeChannel(t,s){const a=this.find(t);s.trim()!==a.name&&S(422,"confirm_required","השם אינו תואם."),this.cameras_=this.cameras_.filter(r=>r.camera_id!==t)}}let La=null;const ge=()=>de()?Ea:La??=new Na,J="—",Y={main:"ראשי",sub:"משני",third:"שלישי",other:"נוסף"},ut={main:0,sub:1,third:2,other:3};function Pa(e){const t=[];for(const s of e){const a={cameraKey:`${s.recorder_id}:${s.source_ref}`,recorderId:s.recorder_id,cameraId:s.camera_id,channel:s.channel,cameraName:s.name,online:s.online,enabledInArx:s.enabled_in_arx,error:s.error};s.streams.length||t.push({...a,key:`${a.cameraKey}:none`,stream:null});for(const r of s.streams)t.push({...a,key:`${a.cameraKey}:${r.stream_ref}`,stream:r})}return t}function Re(e){return!e||!e.codec?J:e.codec_plus&&(e.codec==="H.264"||e.codec==="H.265")?`${e.codec}+`:e.codec}const Ia=e=>e?.codec==="H.265";function ft(e){return e?.resolution?e.resolution.replace(/x/i,"×"):J}function Qt(e){return e?e.fps_full?"מלא":e.fps===null||e.fps===void 0?J:String(Number.isInteger(e.fps)?e.fps:Number(e.fps.toFixed(2))):J}function Gt(e){return e?.bitrate_kbps?`${e.bitrate_kbps} kbps`:J}function Aa(e){return e?.svc===!0?"פעיל":e?.svc===!1?"כבוי":J}const Yt={ok:"מתנגן בדפדפן",no:"לא מתנגן בדפדפן",unknown:"לא ידוע"};function Jt(e){return e==null?J:String(e)}const Ze={q:"",codec:"",role:"",svc:"",webrtc:""},Xt=e=>!!(e.q.trim()||e.codec||e.role||e.svc||e.webrtc);function qa(e){const t=e.stream;return[e.cameraName,`ערוץ ${e.channel}`,String(e.channel),t?Y[t.role]:"",t?t.role:"",Re(t),t?.codec_raw??"",t?.profile??"",ft(t),t?.resolution??"",t?.bitrate_mode??"",t?.stream_ref??"",t?.svc===!0?"svc":""].join(" ").toLowerCase()}function Ba(e,t){let s=t.toLowerCase();const a=[...s.matchAll(/ערוץ\s*(\d+)/g)].map(n=>Number(n[1]));if(s=s.replace(/ערוץ\s*\d+/g," "),a.length&&!a.includes(e.channel))return!1;const r=s.split(/\s+/).filter(Boolean);if(!r.length)return!0;const i=qa(e);return r.every(n=>i.includes(n))}function Va(e,t){return e.filter(s=>{const a=s.stream;if(!Ba(s,t.q))return!1;if(t.codec){const r=a?.codec==="H.264"?"h264":a?.codec==="H.265"?"h265":"other";if(!a||r!==t.codec)return!1}if(t.role){const r=a?.role==="main"||a?.role==="sub"?a.role:"other";if(!a||r!==t.role)return!1}if(t.svc){const r=a?.svc===!0?"on":a?.svc===!1?"off":"none";if(!a||r!==t.svc)return!1}return!(t.webrtc&&(!a||a.webrtc!==t.webrtc))})}const Is={key:"channel",dir:"asc"},Da={no:0,unknown:1,ok:2};function Zt(e,t){const s=e.stream;switch(t){case"channel":return e.channel;case"camera":return e.cameraName;case"role":return s?ut[s.role]:null;case"codec":return s?.codec?Re(s):null;case"svc":return s?.svc===!0?1:s?.svc===!1?0:null;case"resolution":{const a=/^(\d+)x(\d+)$/i.exec(s?.resolution??"");return a?Number(a[1])*Number(a[2]):null}case"fps":return s?s.fps_full?Number.MAX_SAFE_INTEGER:s.fps??null:null;case"bitrate":return s?.bitrate_kbps??null;case"gop":return s?.gop??null;case"webrtc":return s?Da[s.webrtc]??1:null}}function Ha(e,t=Is){const s=t.dir==="desc"?-1:1,a=new Intl.Collator("he",{numeric:!0,sensitivity:"base"}),r=(i,n)=>i.channel-n.channel||(i.stream?ut[i.stream.role]:9)-(n.stream?ut[n.stream.role]:9)||(i.stream?.stream_ref??"").localeCompare(n.stream?.stream_ref??"");return[...e].sort((i,n)=>{const l=Zt(i,t.key),h=Zt(n,t.key);if(l===null&&h===null)return r(i,n);if(l===null)return 1;if(h===null)return-1;const p=typeof l=="number"&&typeof h=="number"?l-h:a.compare(String(l),String(h));return p?p*s:r(i,n)})}function Fa(e,t){return e.key===t?{key:t,dir:e.dir==="asc"?"desc":"asc"}:{key:t,dir:"asc"}}function ja(e){const t=new Set;let s=0,a=0;for(const r of e)t.add(r.cameraKey),r.stream&&(s++,r.stream.webrtc==="no"&&a++);return{cameras:t.size,streams:s,notWebrtc:a}}function Ka(e,t){return t===0||e[t-1].cameraKey!==e[t].cameraKey}const g={codec:"קידוד",profile:"פרופיל",resolution:"רזולוציה",fps:"FPS",bitrate_mode:"סוג קצב",bitrate_kbps:"קצב",quality:"איכות",gop:"GOP",svc:"SVC",smart_codec:"Smart codec",b_frames:"B-frames"},$e={show:!1,enabled:!1,reason:""},P={read_only:"השינוי אינו זמין",not_supported:"ה־NVR אינו תומך בשינוי הזרם הזה",capabilities_unreadable:"יכולות הזרם אינן ידועות",proxied:"ה־NVR אינו מאפשר לשנות את הזרם הזה",offline:"המצלמה אינה מקוונת",stale:"ה־NVR אינו זמין",detail_error:"ה־NVR אינו זמין",no_options:"יכולות הזרם אינן ידועות",device_refused:"ה־NVR אינו מעביר שינויים למצלמה הזו",write_api_missing:"ה־NVR אינו תומך בשינוי הגדרות זרם",no_caps:"יכולות הזרם אינן ידועות",writes_disabled:"כתיבה ל־NVR הזה כבויה"},As=e=>e?P[e]??P.no_options:P.read_only;function Ua(e,t,s,a){if(!s||!a.canWrite||!t.camera_id||e==="svc"&&s.svc===null||a.detail===null)return $e;if(a.stale)return{show:!0,enabled:!1,reason:P.stale};if(a.detail==="error")return{show:!0,enabled:!1,reason:P.detail_error};if(a.detail.stale)return{show:!0,enabled:!1,reason:P.stale};if(a.detail.can_write===!1)return $e;const r=a.detail.camera.streams.find(n=>n.stream_ref===s.stream_ref)??s;if(r.writable===!1)return{show:!0,enabled:!1,reason:As(r.not_writable_reason)};if(r.writable!==!0)return $e;if(t.online===!1)return{show:!0,enabled:!1,reason:P.offline};const i=a.detail.options?.[s.stream_ref];return i?e==="svc"&&!i.svc?{show:!0,enabled:!1,reason:P.not_supported}:s.etag===null?{show:!0,enabled:!1,reason:P.stale}:{show:!0,enabled:!0,reason:""}:{show:!0,enabled:!1,reason:P.no_options}}function ce(e,t){return t==null||t===""?J:typeof t=="boolean"?t?"פעיל":"כבוי":e==="fps"?t==="full"||t===0?"מלא":String(t):e==="resolution"?String(t).replace(/x/i,"×"):e==="bitrate_kbps"?`${t} kbps`:String(t)}const mt=e=>e===1?"שינוי אחד":`${e} שינויים`;function Wa(e,t){return t==="fps"?e.fps_full?"full":e.fps:e[t]}function qs(e,t,s){const a=Object.keys(s).filter(l=>s[l]!==void 0),r=a.length===1?a[0]:null,i=`${e} · ${Y[t.role]}. השידור ייקטע לכמה שניות.`,n=a.map(l=>({field:l,label:g[l],from:ce(l,Wa(t,l)),to:ce(l,s[l])}));if(r==="svc"){const l=s.svc===!0;return{heading:l?"להפעיל SVC?":"לכבות SVC?",lead:i,count:mt(1),confirmLabel:l?"הפעל":"כבה",details:n}}return{heading:"לשמור את השינויים?",lead:i,count:mt(a.length),confirmLabel:"שמור",details:n}}const Qa=e=>e.code==="source_unavailable"&&e.details?.outcome==="unknown",es={stale:"הערכים השתנו ב־NVR. נטען מחדש.",write_in_progress:"שינוי אחר של הזרם הזה מתבצע. נסו שוב בעוד רגע.",batch_in_progress:"מתבצע שינוי מרובה",nvr_busy:"ה־NVR עסוק. נסו שוב בעוד רגע.",nvr_no_effect:"ה־NVR אישר את השינוי אבל לא שינה את ההגדרה.",nvr_diverged:"ה־NVR שינה רק חלק מההגדרות. נטען מחדש.",nvr_not_supported:"ה־NVR אינו תומך בשינוי הזה.",nvr_rejected:"ה־NVR דחה את השינוי.",capabilities_unreadable:"יכולות הזרם אינן ידועות, ולכן השינוי בוטל.",confirm_required:"נדרש אישור.",value_not_allowed:"הערך אינו נתמך במצלמה.",field_locked:"השדה נעול כרגע.",field_not_supported:"השדה אינו נתמך בזרם הזה.",not_rollbackable:"אי אפשר לבטל את השינוי הזה.",forbidden:"אין הרשאה לפעולה הזו.",source_unavailable:"ה־NVR אינו זמין.",source_forbidden:"ל־NVR אין הרשאה לשינוי הזה."};function Qe(e){if(Qa(e))return{text:"הסטטוס נבדק",reload:!0};const t=e.code==="stale"||e.code==="nvr_diverged";return e.code==="value_not_allowed"&&typeof e.details?.codec=="string"&&e.user_message?{text:e.user_message,reload:t}:e.code==="value_not_allowed"&&typeof e.details?.field=="string"&&e.details.field in g?{text:`${g[e.details.field]}: ${es.value_not_allowed}`,reload:t}:{text:es[e.code]??(e.user_message||"השינוי לא נשמר."),reload:t}}const he=e=>e==null?"":String(e);function St(e){return{codec:he(e.codec),profile:he(e.profile),resolution:he(e.resolution),fps:e.fps_full?"full":he(e.fps),bitrate_mode:he(e.bitrate_mode),bitrate_kbps:he(e.bitrate_kbps),quality:he(e.quality),gop:he(e.gop),svc:e.svc,smart_codec:e.smart_codec}}const wt=e=>/^\d{1,7}$/.test(e.trim())?Number(e):null;function Rt(e,t,s){const a=s.codec||e.codec||"",r=n=>e.fields[n]?.supported!==!1,i=[];return r("codec")&&t.codec.length&&i.push("codec"),r("profile")&&(t.profile[a]??[]).length&&i.push("profile"),r("resolution")&&(t.resolution[a]??[]).length&&i.push("resolution"),r("fps")&&(t.fps.length||t.fps_full)&&i.push("fps"),r("bitrate_mode")&&t.bitrate_mode.length&&i.push("bitrate_mode"),r("bitrate_kbps")&&t.bitrate_kbps&&i.push("bitrate_kbps"),r("quality")&&t.quality.length&&i.push("quality"),r("gop")&&t.gop&&i.push("gop"),r("svc")&&t.svc&&e.svc!==null&&i.push("svc"),r("smart_codec")&&t.smart_codec&&e.smart_codec!==null&&i.push("smart_codec"),i}function Tt(e,t,s,a){if(t.fields[e]?.editable===!1)return t.fields[e]?.locked_by??e;for(const[r,i]of Object.entries(s.locks))if(i?.includes(e)&&e!==r&&a[r]===!0)return r;return e==="quality"&&a.bitrate_mode!=="VBR"?"bitrate_mode":null}function et(e,t,s){const a=[],r=s.codec||e.codec||"",i=St(e);for(const n of Rt(e,t,s))if(!Tt(n,e,t,s)&&!(s.codec===i.codec&&n in i&&s[n]===i[n]))switch(n){case"codec":t.codec.includes(s.codec)||a.push(n);break;case"profile":(t.profile[r]??[]).includes(s.profile)||a.push(n);break;case"resolution":(t.resolution[r]??[]).includes(s.resolution)||a.push(n);break;case"fps":(s.fps==="full"?!t.fps_full:!t.fps.includes(Number(s.fps)))&&a.push(n);break;case"bitrate_mode":t.bitrate_mode.includes(s.bitrate_mode)||a.push(n);break;case"bitrate_kbps":{const l=wt(s.bitrate_kbps);(l===null||l<t.bitrate_kbps.min||l>t.bitrate_kbps.max)&&a.push(n);break}case"quality":t.quality.includes(Number(s.quality))||a.push(n);break;case"gop":{const l=wt(s.gop);(l===null||l<t.gop.min||l>t.gop.max)&&a.push(n);break}}return a}function ts(e,t,s){const a={},r=St(e);for(const i of Rt(e,t,s))if(!Tt(i,e,t,s))switch(i){case"codec":case"profile":case"resolution":case"bitrate_mode":s[i]&&s[i]!==r[i]&&(a[i]=s[i]);break;case"fps":s.fps&&s.fps!==r.fps&&(a.fps=s.fps==="full"?"full":Number(s.fps));break;case"bitrate_kbps":case"quality":case"gop":{const n=wt(s[i]);n!==null&&s[i]!==r[i]&&(a[i]=n);break}case"svc":case"smart_codec":s[i]!==null&&s[i]!==r[i]&&(a[i]=s[i]);break}return a}function Ga(e,t){const s=e.codec,a={...e};return(t.profile[s]??[]).includes(a.profile)||(a.profile=""),(t.resolution[s]??[]).includes(a.resolution)||(a.resolution=""),a}function Ya(e){let t=e.fields;if(t==null)try{t=e.fields_json?JSON.parse(e.fields_json):null}catch{t=null}if(!t||typeof t!="object"||Array.isArray(t))return[];const s=[];for(const[a,r]of Object.entries(t))Array.isArray(r)&&r.length===2?s.push({field:a,from:ce(a,r[0]),to:ce(a,r[1])}):r&&typeof r=="object"&&"to"in r&&s.push({field:a,from:ce(a,r.from),to:ce(a,r.to)});return s}const Ja=e=>g[e]??e,Xa={pending:"בתהליך",applied:"נשמר",unchanged:"ללא שינוי",no_effect:"לא נקלט",refused:"נדחה",failed:"נכשל",diverged:"נשמר חלקית",rolled_back:"בוטל"};function Za(e,t,s=5){return e.filter(a=>a.kind==="stream_encoding"&&a.stream_ref===t).sort((a,r)=>a.created_at<r.created_at?1:a.created_at>r.created_at?-1:0).slice(0,s)}function er(e){const t=e[0];return t&&(t.status==="applied"||t.status==="diverged")?t:null}function tr(e,t){return e instanceof v?{status:e.status,code:e.code,user_message:e.body.user_message,details:e.body.details??{}}:t?{status:0,code:"source_unavailable",details:{outcome:"unknown"}}:{status:0,code:"network",user_message:"אין חיבור לשרת."}}function gt(e,t){const s=tr(e,t),a=s.code==="stale"&&s.details?.stream&&typeof s.details.stream=="object"?s.details.stream:null;return{ok:!1,line:Qe(s),code:s.code,stream:a}}async function Bs(e,t,s){if(t.etag===null)return gt(new v(409,{code:"stale",user_message:"",retryable:!1,correlation_id:"",details:{}}),!1);try{const a=await ge().writeStream(e,t.stream_ref,{if_match:t.etag,confirm:!0,changes:s});return{ok:!0,stream:a.stream,change:a.change,rebootRequired:a.reboot_required,kind:"write",unchanged:a.change===null}}catch(a){return gt(a,!0)}}async function Vs(e){try{const t=await ge().undo(e);return{ok:!0,stream:t.stream,change:t.change,rebootRequired:t.reboot_required,kind:"undo",unchanged:!1}}catch(t){return gt(t,!0)}}var sr=Object.defineProperty,ar=Object.getOwnPropertyDescriptor,W=(e,t,s,a)=>{for(var r=a>1?void 0:a?ar(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&sr(t,s,r),r};const oe={gone:"הזרם אינו זמין כרגע. סגרו את החלונית ופתחו שוב.",loading:"טוען את האפשרויות של הקידוד. נסו שוב בעוד רגע.",no_options:"יכולות הזרם אינן ידועות, ולכן אי אפשר לשמור.",invalid:"יש לבחור ערך תקין",nothing:"אין שינויים לשמירה.",failed:"השינוי לא נשמר. נסו שוב."};let H=class extends K{constructor(){super(...arguments),this.open=!1,this.camera=null,this.stream=null,this.options=null,this.draft=null,this.opts=null,this.optsCodec="",this.loading=!1,this.confirm=null,this.busy=!1,this.line="",this.history=null,this.pending=null,this.hseq=0,this.oseq=0,this.key="",this.save=()=>{try{const e=this.stream,t=this.opts;if(!e||!this.draft||!this.camera?.camera_id)return void(this.line=oe.gone);if(this.loading)return void(this.line=oe.loading);if(!t||!this.optsFit)return void(this.line=oe.no_options);const s=et(e,t,this.draft);if(s.length)return void(this.line=`${oe.invalid}: ${s.map(r=>g[r]).join(", ")}`);const a=ts(e,t,this.draft);if(!Object.keys(a).length)return void(this.line=oe.nothing);this.line="",this.pending=a,this.confirm=qs(this.camera.name,e,a)}catch(e){console.error("nvr editor: save failed",e),this.pending=null,this.confirm=null,this.line=oe.failed}},this.close=()=>this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}willUpdate(e){const t=this.stream,s=this.open&&t&&this.camera?`${this.camera.camera_id}:${t.stream_ref}:${t.etag}`:"";if(s!==this.key){const a=!this.key&&!!s;this.key=s,s&&t&&(this.draft=St(t),this.opts=this.options,this.optsCodec=t.codec??"",this.oseq++,this.loading=!1,a&&(this.line="",this.history=null),this.loadHistory())}else e.has("options")&&this.draft&&t&&this.draft.codec===(t.codec??"")&&(this.opts=this.options,this.optsCodec=t.codec??"")}get optsFit(){return!!this.opts&&!!this.draft&&!this.loading&&this.optsCodec===this.draft.codec}updated(){const e=this.draft;if(e)for(const t of this.renderRoot.querySelectorAll("select[data-f]")){const s=String(e[t.dataset.f]??"");t.value!==s&&(t.value=s)}}async loadHistory(){const e=this.camera,t=this.stream;if(!e?.camera_id||!t)return;const s=++this.hseq;try{const a=await ge().changes(e.camera_id,30);if(s!==this.hseq)return;this.history=Za(a.changes,t.stream_ref,5)}catch{s===this.hseq&&(this.history=[])}}set(e,t){this.draft&&(this.draft={...this.draft,[e]:t},this.line="")}async onCodec(e){const t=this.camera,s=this.stream;if(!this.draft||!t?.camera_id||!s){this.line=oe.gone;return}this.set("codec",e);const a=++this.oseq;this.loading=!0;try{const r=await ge().options(t.camera_id,s.stream_ref,e);if(a!==this.oseq||!this.draft)return;if(!r){this.line=Qe({status:503,code:"capabilities_unreadable"}).text;return}this.opts=r,this.optsCodec=e,this.draft=Ga(this.draft,r)}catch(r){if(a!==this.oseq)return;this.line=Qe({status:r.status??0,code:r.code??"network",user_message:r.message}).text}finally{a===this.oseq&&(this.loading=!1)}}async confirmed(){const e=this.camera,t=this.stream,s=this.pending;if(this.confirm=null,this.pending=null,!e?.camera_id||!t||!s){this.line=oe.gone;return}this.busy=!0,this.line="";try{const a=await Bs(e.camera_id,t,s);this.result(a)}catch(a){console.error("nvr editor: write failed",a),this.line=oe.failed}finally{this.busy=!1}}async undo(e){this.busy=!0,this.line="";const t=await Vs(e);this.busy=!1,this.result(t)}result(e){e.ok||(this.line=e.line.text),this.dispatchEvent(new CustomEvent("written",{detail:{result:e},bubbles:!0,composed:!0}))}select(e,t,s,a,r,i){const n=this.draft,l=String(n[e]??"");return o`<label class="f ${r?"bad":""}" data-field=${e}>
      <span class="l">${t}</span>
      <select data-f=${e} aria-label=${t} title=${a??""} ?disabled=${!!a||this.busy} @change=${h=>e==="codec"?void this.onCodec(h.target.value):this.set(e,h.target.value)}>
        ${l===""||!s.includes(l)?o`<option value="" selected disabled>—</option>`:c}
        ${s.map(h=>o`<option value=${h} ?selected=${h===l}>${i?i(h):h}</option>`)}
      </select>
    </label>`}number(e,t,s,a,r,i){const n=this.draft;return o`<label class="f ${i?"bad":""}" data-field=${e}>
      <span class="l">${t}</span>
      <input type="number" inputmode="numeric" min=${s} max=${a} step="1" aria-label=${t} title=${r??""} .value=${n[e]} ?disabled=${!!r||this.busy} @input=${l=>this.set(e,l.target.value)} />
    </label>`}toggle(e,t,s){const a=this.draft;return o`<div class="f sw" data-field=${e}>
      <span class="l">${t}</span>
      <sw-toggle label=${t} labelHidden .checked=${a[e]===!0} ?disabled=${!!s||this.busy} title=${s??""} data-editor-toggle=${e}
        @change=${r=>this.set(e,r.detail.checked)}></sw-toggle>
    </div>`}fields(){const e=this.stream,t=this.opts,s=this.draft,a=new Set(et(e,t,s)),r=s.codec||e.codec||"",i=n=>Tt(n,e,t,s)?`${g[n]} נעול`:null;return Rt(e,t,s).map(n=>{switch(n){case"codec":return this.select(n,g[n],t.codec,i(n),a.has(n));case"profile":return this.select(n,g[n],t.profile[r]??[],i(n),a.has(n));case"resolution":return this.select(n,g[n],t.resolution[r]??[],i(n),a.has(n),l=>l.replace(/x/i,"×"));case"fps":return this.select(n,g[n],[...t.fps_full?["full"]:[],...t.fps.map(String)],i(n),a.has(n),l=>l==="full"?"מלא":l);case"bitrate_mode":return this.select(n,g[n],t.bitrate_mode,i(n),a.has(n));case"quality":return this.select(n,g[n],t.quality.map(String),i(n),a.has(n));case"bitrate_kbps":return this.number(n,g[n],t.bitrate_kbps.min,t.bitrate_kbps.max,i(n),a.has(n));case"gop":return this.number(n,g[n],t.gop.min,t.gop.max,i(n),a.has(n));case"svc":case"smart_codec":return this.toggle(n,g[n],i(n));default:return c}})}when(e){const t=new Date(e);return Number.isNaN(t.getTime())?"":ea(t)}renderHistory(){const e=this.history;if(!e||!e.length)return c;const t=er(e);return o`<details class="history" data-nvr-history>
      <summary>שינויים אחרונים</summary>
      <ol>${e.map(s=>o`<li data-change=${s.id} data-status=${s.status}>
          <span class="when">${this.when(s.created_at)} · ${Xa[s.status]??s.status}</span>
          <span class="what">${Ya(s).map(a=>o`<span>${Ja(a.field)} <bdi>${a.from}</bdi> ← <bdi>${a.to}</bdi></span>`)}</span>
          ${t&&t.id===s.id?o`<sw-button size="sm" data-nvr-undo-change ?disabled=${this.busy} @click=${()=>void this.undo(s.id)}>בטל</sw-button>`:c}
        </li>`)}</ol>
    </details>`}render(){const e=this.stream,t=this.camera,s=this.open&&!!e&&!!t&&!!this.draft&&!!this.opts,a=s?ts(e,this.opts,this.draft):{},r=Object.keys(a).length>0,i=s?et(e,this.opts,this.draft).length===0:!1;return o`<sw-drawer modal ?open=${this.open} heading=${t?.name??""} subheading=${e?`${Y[e.role]}`:""} data-nvr-editor @close=${n=>{n.stopPropagation(),this.close()}}>
      ${s?o`<form @submit=${n=>n.preventDefault()} data-nvr-editor-form aria-busy=${this.busy}>${this.fields()}</form>
            ${this.line?o`<p class="line" role="status" data-nvr-editor-line>${this.line}</p>`:c}
            ${this.renderHistory()}
            <sw-button slot="footer" variant="ghost" data-nvr-editor-cancel @click=${this.close}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-editor-save ?disabled=${!r||!i||this.busy||!this.optsFit} @click=${this.save}>שמור</sw-button>`:c}
      <nvr-confirm .model=${this.confirm} @confirm=${()=>void this.confirmed()} @cancel=${()=>(this.confirm=null,this.pending=null)}></nvr-confirm>
    </sw-drawer>`}};H.styles=Z`
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
  `;W([R({type:Boolean})],H.prototype,"open",2);W([R({attribute:!1})],H.prototype,"camera",2);W([R({attribute:!1})],H.prototype,"stream",2);W([R({attribute:!1})],H.prototype,"options",2);W([d()],H.prototype,"draft",2);W([d()],H.prototype,"opts",2);W([d()],H.prototype,"optsCodec",2);W([d()],H.prototype,"loading",2);W([d()],H.prototype,"confirm",2);W([d()],H.prototype,"busy",2);W([d()],H.prototype,"line",2);W([d()],H.prototype,"history",2);H=W([U("nvr-camera-editor")],H);var rr=Object.defineProperty,ir=Object.getOwnPropertyDescriptor,ve=(e,t,s,a)=>{for(var r=a>1?void 0:a?ir(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&rr(t,s,r),r};let pe=class extends K{constructor(){super(...arguments),this.message="",this.actionLabel="",this.linkLabel="",this.linkHref="",this.duration=1e4,this.busy=!1,this.timer=null}arm(){this.timer&&clearTimeout(this.timer),this.timer=this.duration>0?setTimeout(()=>this.dispatchEvent(new CustomEvent("dismiss",{bubbles:!0,composed:!0})),this.duration):null}updated(e){(e.has("message")||e.has("duration"))&&this.arm(),this.message&&sa(this)}disconnectedCallback(){super.disconnectedCallback(),this.timer&&clearTimeout(this.timer),this.timer=null}render(){return this.message?o`<div class="toast" role="status" aria-live="polite" data-nvr-toast>
      <span data-nvr-toast-text>${this.message}</span>
      ${this.actionLabel?o`<button type="button" data-nvr-undo ?disabled=${this.busy} @click=${()=>this.dispatchEvent(new CustomEvent("undo",{bubbles:!0,composed:!0}))}>${this.actionLabel}</button>`:c}
      ${this.linkLabel&&this.linkHref?o`<a href=${this.linkHref} data-nvr-toast-link>${this.linkLabel}</a>`:c}
      <button type="button" class="x" aria-label="סגור" data-nvr-toast-close @click=${()=>this.dispatchEvent(new CustomEvent("dismiss",{bubbles:!0,composed:!0}))}>✕</button>
    </div>`:c}};pe.styles=[ta,Z`
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
  `];ve([R()],pe.prototype,"message",2);ve([R()],pe.prototype,"actionLabel",2);ve([R()],pe.prototype,"linkLabel",2);ve([R()],pe.prototype,"linkHref",2);ve([R({type:Number})],pe.prototype,"duration",2);ve([R({type:Boolean})],pe.prototype,"busy",2);pe=ve([U("nvr-undo-toast")],pe);const Fe=encodeURIComponent;function bt(e){if(!e||typeof e!="object")return null;const t=e;if(typeof t.batch_id=="string")return t;if(t.batch&&typeof t.batch=="object")return bt(t.batch);if(Array.isArray(t.batches)){const s=t.batches.filter(a=>!!a&&typeof a=="object"&&typeof a.batch_id=="string");return s.find(a=>a.state==="running")??s[0]??null}return null}const nr=500;function ue(e){return{...e,rollback_of:e.rollback_of??e.source_batch_id??null}}async function or(e){let t=null;const s=[];let a=0;for(let r=0;r<400;r++){const i=await D(`nvr/stream-batches/${Fe(e)}?offset=${a}&limit=${nr}`);if(t??=i,s.push(...i.items??[]),i.next_offset===null||i.next_offset===void 0||i.next_offset<=a)break;a=i.next_offset}return ue({...t,items:s})}const lr={start:async e=>ue(await V("nvr/stream-batches",e)),get:e=>or(e),active:async()=>{const e=bt(await D("nvr/stream-batches?active=1"));return e?ue(e):null},stop:async e=>{const t=bt(await V(`nvr/stream-batches/${Fe(e)}/stop`,{}));return t?ue(t):null},undo:async e=>ue(await V(`nvr/stream-batches/${Fe(e)}/rollback`,{confirm:!0})),previewEncoding:e=>V("nvr/encoding-batches/preview",e),startEncoding:async e=>ue(await V("nvr/encoding-batches",e)),recheck:async e=>ue(await V(`nvr/stream-batches/${Fe(e)}/verify`,{})),recent:async()=>((await D("nvr/stream-batches"))?.batches??[]).filter(t=>!!t&&typeof t.batch_id=="string").map(ue)},B=()=>lr,je={confirmed:"המצלמה אישרה",nvr_accepted:"המקליט קיבל",still_old:"עדיין בקידוד הקודם",restart_needed:"צריך אתחול",failed:"נכשל",unchanged:"כבר מוגדר"},cr={confirmed:"ok",nvr_accepted:"info",still_old:"warn",restart_needed:"warn",failed:"bad",unchanged:"muted"},dr=["still_old","restart_needed","failed"],Ds=e=>typeof e=="string"&&e in je;function pr(e){if(!e||!Ds(e.outcome))return"";if(e.label)return e.label;switch(e.outcome){case"confirmed":return e.expected?`המצלמה אישרה (${e.expected})`:je.confirmed;case"still_old":return e.media_codec?`עדיין ${e.media_codec}`:je.still_old;case"failed":return`נכשל: ${e.reason??"השינוי לא בוצע"}`;default:return je[e.outcome]}}const hr=e=>e&&Ds(e.outcome)?cr[e.outcome]:"muted",ur="אם ה־NVR מסרב לשנות מצלמה",fr=[{id:"skip",label:"לדלג ולהמשיך"},{id:"stop",label:"לעצור את כל ההמרה"}],mr={skip:"המצלמה נשארת כמו שהיא ונרשמת בדוח, וההמרה ממשיכה לשאר המצלמות.",stop:"ההמרה נעצרת במצלמה הראשונה שה־NVR מסרב לשנות; מה שכבר השתנה נשאר, ואפשר להחזיר אותו."},ss=(e,t="skip")=>e==="skip"||e==="stop"?e:t,as="בסוף תוצג בדיקה של מה שכל מצלמה שולחת בפועל.";function wr(e){return e==="skip"?`השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה; מצלמה שה־NVR מסרב לשנות תדולג וההמרה תמשיך. ${as}`:`השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה. ${as}`}function gr(e){return e==="skip"?"השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה; מצלמה שה־NVR מסרב להחזיר תדולג, ואפשר לנסות אותה שוב.":"השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה ותעצור בשגיאה הראשונה."}const rs=e=>e?.state==="running"||e?.state==="pending",G=e=>typeof e=="number"&&e>0?e:0,vt=e=>e.filter(Boolean).join(" · "),me=e=>e===1?"זרם אחד":`${e} זרמים`;function br(e){if(!e||e.state==="none")return"";if(e.state==="pending")return"הבדיקה תתחיל בסיום השינוי.";if(e.state==="running")return"בודק מה כל מצלמה שולחת בפועל…";const t=e.counts??{},s=vt([G(t.confirmed)>0&&`המצלמה אישרה: ${me(G(t.confirmed))}`,G(t.nvr_accepted)>0&&`המקליט קיבל (לא נבדק במצלמה): ${me(G(t.nvr_accepted))}`,G(t.still_old)>0&&`עדיין בקידוד הקודם: ${me(G(t.still_old))}`,G(t.restart_needed)>0&&`צריך אתחול: ${me(G(t.restart_needed))}`,G(t.failed)>0&&`נכשל: ${me(G(t.failed))}`,(e.skipped?.length??0)>0&&`דולגו: ${me(e.skipped.length)}`,G(t.unchanged)>0&&`כבר מוגדר: ${me(G(t.unchanged))}`]);return e.state==="interrupted"?vt(["הבדיקה נקטעה; אפשר לבדוק שוב",s]):s||"אין זרמים בדוח."}function Te(e,t){const s=e.items??[];return t==="worklist"?s.filter(a=>!!a.verify&&dr.includes(a.verify.outcome)):t==="skipped"?s.filter(a=>a.skipped===!0):s}function vr(e){const t=Te(e,"all").length,s=Te(e,"worklist").length,a=Te(e,"skipped").length;return[{id:"all",label:"כל הזרמים",count:t},{id:"worklist",label:"מצלמות שלא השתנו",count:s},{id:"skipped",label:"דולגו",count:a}].filter(r=>r.id!=="skipped"||r.count>0)}function _r(e){return e.kind==="rollback"?"דוח בדיקה · החזרה לערכים הקודמים":"דוח בדיקה · שינוי קידוד"}function yr(e){switch(e.code){case"verify_too_soon":return"בדיקה חוזרת אפשרית בעוד כמה שניות.";case"verify_in_progress":return"הבדיקה עדיין מתבצעת.";case"nothing_to_verify":return"אין מצלמות לבדיקה חוזרת.";case"verify_not_available":return"בדיקה חוזרת קיימת רק לשינוי קידוד.";case"network":return"אין חיבור לשרת.";default:return e.status===403?"אין הרשאה לפעולה הזו.":e.user_message||"הבדיקה לא התחילה."}}const is="בדיקה חוזרת קוראת בלבד: רשימת הזרמים מה־NVR ומה שהמצלמות שולחות. שום הגדרה לא משתנה.";function xr(e){return e.filter(t=>t.mode==="encoding").sort((t,s)=>String(s.created_at??"").localeCompare(String(t.created_at??"")))}function Hs(e){if(!e)return"";const t=new Date(e);if(Number.isNaN(t.getTime()))return"";const s=a=>String(a).padStart(2,"0");return`${s(t.getDate())}.${s(t.getMonth()+1)} ${s(t.getHours())}:${s(t.getMinutes())}`}function kr(e){const t=e.kind==="rollback"?"החזרה לערכים הקודמים":e.settings?.codec?`המרה ל־${e.settings.codec}`:"שינוי קידוד";return vt([t,Hs(e.created_at)])}function $r(e,t){const s=r=>r.find(i=>i.role==="main")??null;return(t&&t!=="error"?s(t.camera.streams):null)??s(e.streams)}function zr(e,t,s){if(s)return[];const a=[];for(const r of e){if(!r.camera_id||r.online===!1)continue;const i=t.get(r.camera_id);if(i==="error"||i&&i.can_write===!1)continue;const n=$r(r,i);!n||n.codec!=="H.264"||n.svc!==!0||n.writable===!1||!n.etag||i&&i.options&&i.options[n.stream_ref]===null||a.push({cameraId:r.camera_id,recorderId:r.recorder_id,name:r.name,channel:r.channel,streamRef:n.stream_ref,etag:n.etag})}return a.sort((r,i)=>r.channel-i.channel||r.name.localeCompare(i.name,"he"))}function Sr(e,t){let s=t.trim().toLowerCase();if(!s)return e;const a=[...s.matchAll(/ערוץ\s*(\d+)/g)].map(i=>Number(i[1]));s=s.replace(/ערוץ\s*\d+/g," ");const r=s.split(/\s+/).filter(Boolean);return e.filter(i=>{if(a.length&&!a.includes(i.channel))return!1;const n=`${i.name} ${i.channel}`.toLowerCase();return r.every(l=>n.includes(l))})}function Rr(e,t){const s=new Set(e);for(const a of t)s.add(a.cameraId);return s}function Tr(e){return new Set(e?[e]:[])}function Or(e,t,s){if(t===s)return new Set(e);const a=new Set(e);return a.has(t)?a.delete(t):a.add(t),a}const tt=2,Be=(e,t)=>e.filter(s=>t.has(s.cameraId));function Fs(e,t,s,a,r=5){const i=s*a;if(s<=0)return{start:0,end:0,top:0,total:0};const n=Math.max(0,Math.floor(e/a)),l=Math.min(s,Math.max(0,n-r)),h=Math.min(s,Math.ceil((e+Math.max(t,a))/a)+r);return{start:l,end:h,top:l*a,total:i}}const Er=(e,t,s)=>Math.max(0,e*s-Math.max(0,t-s)/2),js=["applied","unchanged","rolled_back"],Ot=["failed","refused","no_effect","diverged"],Je=["running","pending"],we=e=>e!=="running",_t=e=>(e.items??[]).some(t=>t.status==="unknown"||Je.includes(t.status));function Xe(e){const t={};if(e.items)for(const n of e.items)t[n.status]=(t[n.status]??0)+1;else Object.assign(t,e.counts??{});const s=(...n)=>n.reduce((l,h)=>l+(t[h]??0),0),a=e.total??(e.items?e.items.length:Object.values(t).reduce((n,l)=>n+(l??0),0)),r=s(...js),i=s(...Ot);return{total:a,ok:r,bad:i,unknown:s("unknown"),inFlight:s(...Je),queued:s("queued"),notAttempted:s("not_attempted"),processed:r+i,applied:e.kind==="rollback"?s("applied")+s("rolled_back"):s("applied"),restored:e.kind==="rollback"?s("applied","rolled_back"):s("applied")}}const Ks=e=>e===1?"מצלמה אחת":`${e} מצלמות`,Ee=e=>e===1?"במצלמה אחת":`ב־${e} מצלמות`,Us=e=>e===1?"בזרם אחד":`ב־${e} זרמים`,Ge=e=>e.mode==="encoding",Ke=(e,t)=>Ge(e)?Us(t):Ee(t);function ns(e){return js.includes(e.status)?"ok":Ot.includes(e.status)?"bad":e.status==="unknown"?"unk":Je.includes(e.status)?"spin":e.status==="not_attempted"?"skip":"wait"}function Cr(e,t){switch(e.status){case"queued":return"";case"running":case"pending":return t==="rollback"?"מחזיר":"מתבצע";case"applied":return t==="rollback"?"הוחזר":"נשמר";case"rolled_back":return"הוחזר";case"unchanged":return"ללא שינוי";case"unknown":return"לא ברור אם בוצע. נבדק מול ה־NVR.";case"not_attempted":return"לא בוצע";default:return Qe({code:e.error_code??e.status,user_message:e.user_message??void 0}).text}}function Ws(e){return(e.items??[]).find(t=>Ot.includes(t.status))??(e.items??[]).find(t=>t.status==="unknown")??null}function os(e){const t=e.items??[],s=i=>t.findIndex(i),a=s(i=>Je.includes(i.status));if(a>=0)return a;if(we(e.state)){const i=Ws(e);return i?t.indexOf(i):0}const r=s(i=>i.status==="queued");return r>=0?r:0}const st=e=>e.filter(Boolean).join(" · ");function Mr(e,t,s=!1){const a=Xe(e),r=e.kind==="rollback",i=Ws(e),n=i?t(i):"",l=a.total-a.restored,h=_t(e)||e.state==="running"||e.can_rollback===!1,p=!!i&&(e.state==="stopped_unknown"||e.state!=="running"&&e.stopped_reason==="unknown_unverified"),w={canStop:!1,showUndo:!1,canUndo:!1,showRetry:!1};if(e.state==="running")return{...w,tone:"running",title:`${a.processed} מתוך ${a.total}`,sub:s?"עוצר אחרי המצלמה הנוכחית":a.unknown?"נבדק מול ה־NVR":"",canStop:!s};const m=te=>Ke(e,te),$=st(r?[a.restored>0&&`הוחזר ${m(a.restored)}`,l>0&&`לא הוחזר ${m(l)}`]:[a.applied>0&&`נשמר ${m(a.applied)}`,a.bad>0&&`נכשל ${m(a.bad)}`,a.unknown>0&&`לא ברור אם בוצע ${m(a.unknown)}`,a.notAttempted>0&&`לא בוצע ${m(a.notAttempted)}`]),z=!r&&a.applied>0?{showUndo:!0,canUndo:!h}:{},N=r&&l>0&&e.rollback_of&&e.state!=="completed"?{showRetry:!0}:{};if(e.state==="interrupted"&&e.stopped_reason==="unknown_not_applied"&&i)return{...w,...z,...N,tone:"error",title:r?`ההחזרה נעצרה במצלמה ${n}`:`נעצר במצלמה ${n}`,sub:$};if(p)return{...w,...z,...N,tone:"error",title:r?`ההחזרה נעצרה: לא ברור אם בוצע במצלמה ${n}`:`נעצר: לא ברור אם בוצע במצלמה ${n}`,sub:$};switch(e.state){case"completed":return{...w,...z,tone:(e.skipped??0)>0?"warn":"done",title:Ge(e)?r?`הקידוד הוחזר ${m(a.restored)}`:a.applied>0?`הקידוד עודכן ${m(a.applied)}`:"ללא שינוי":r?`SVC הוחזר ${Ee(a.restored)}`:a.applied>0?`SVC כבוי ${Ee(a.applied)}`:"ללא שינוי",sub:st([!r&&a.applied>0&&a.ok>a.applied&&`ללא שינוי ${m(a.ok-a.applied)}`,(e.skipped??0)>0&&`דולג ${m(e.skipped??0)}`])};case"stopped":return{...w,...z,...N,tone:"warn",title:r?"ההחזרה נעצרה בבקשתך":"נעצר בבקשתך",sub:$};case"failed":return{...w,...z,...N,tone:"error",title:r?`ההחזרה נעצרה במצלמה ${n}`:`נעצר במצלמה ${n}`,sub:$};default:return{...w,...z,...N,tone:"error",title:r?"ההחזרה נקטעה באמצע":"השינוי נקטע באמצע",sub:$}}}function Nr(e){const t=Xe(e),s=(e.skipped??0)>0?` · דולג ${Ke(e,e.skipped??0)}`:"";return e.kind==="rollback"?{message:`בוטל ${Ke(e,t.restored)}${s}`,undo:!1}:t.applied===0?{message:`ללא שינוי${s}`,undo:!1}:{message:`נשמר ${Ke(e,t.applied)}${s}`,undo:!0}}function at(e,t){switch(e.code){case"batch_in_progress":return{text:"מתבצע שינוי מרובה",reload:!1};case"batch_not_enabled":return{text:"השינוי המרובה אינו זמין.",reload:!1};case"forbidden":return{text:"אין הרשאה לפעולה הזו.",reload:!1};case"stale":{const s=typeof e.details?.index=="number"?e.details.index:typeof e.details?.target=="number"?e.details.target:null,a=s!==null&&t?t(s):null;return{text:a?`הערכים של ${a} השתנו ב־NVR. נטען מחדש.`:"הערכים השתנו ב־NVR. נטען מחדש.",reload:!0}}case"batch_target_not_allowed":return{text:"אחת המצלמות אינה מתאימה לשינוי. נטען מחדש.",reload:!0};case"write_in_progress":return{text:"שינוי אחר של אחד הזרמים מתבצע. נסו שוב בעוד רגע.",reload:!1};case"capabilities_unreadable":return{text:"יכולות הזרם אינן ידועות, ולכן השינוי בוטל.",reload:!1};case"confirm_required":return{text:"נדרש אישור.",reload:!1};case"not_rollbackable":return{text:"אי אפשר לבטל את השינוי הזה.",reload:!1};case"source_unavailable":return{text:"ה־NVR אינו זמין.",reload:!1};case"network":return{text:"אין חיבור לשרת.",reload:!1};default:return{text:e.status===422?e.user_message||"הבחירה אינה תקינה.":e.user_message||"הפעולה לא בוצעה.",reload:!1}}}const Lr="השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה.",ls="השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה ותעצור בשגיאה הראשונה.";function Pr(e){return{heading:`לכבות SVC ${Ee(e.length)}?`,lead:Lr,count:Ks(e.length),confirmLabel:"כבה",details:[],names:e}}function Ir(e,t="svc",s){return t==="encoding"?{heading:`להחזיר את הקידוד ${Us(e.length)}?`,lead:s?gr(s):ls,count:e.length===1?"זרם אחד":`${e.length} זרמים`,confirmLabel:"החזר",details:[],names:e}:{heading:`להחזיר SVC ${Ee(e.length)}?`,lead:ls,count:Ks(e.length),confirmLabel:"החזר",details:[],names:e}}const yt="sw.nvr.batch.last";var Ar=Object.defineProperty,qr=Object.getOwnPropertyDescriptor,I=(e,t,s,a)=>{for(var r=a>1?void 0:a?qr(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&Ar(t,s,r),r};const Br=44,cs=52,ds=o`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>`,Vr=o`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>`,Ve=e=>{try{e?window.localStorage.setItem(yt,e):window.localStorage.removeItem(yt)}catch{}},Dr=()=>{try{return window.localStorage.getItem(yt)}catch{return null}};let O=class extends K{constructor(){super(...arguments),this.candidates=[],this.info={},this.streams={},this.phase="closed",this.selected=new Set,this.fixedId=null,this.q="",this.line="",this.starting=!1,this.batch=null,this.stopping=!1,this.offline=!1,this.confirmFor=null,this.listTop=0,this.viewH=360,this.pollSeq=0,this.timer=null,this.follow=!0,this.focusedKey="",this.nameOf=e=>{const t=e.camera_id?this.info[e.camera_id]?.name??e.camera_id:"—",s=this.batch?.mode==="encoding"&&e.camera_id?this.streams[`${e.camera_id}:${e.stream_ref}`]:"";return s?`${t} · ${s}`:t},this.onScroll=e=>{this.listTop=e.target.scrollTop},this.takeControl=()=>{this.follow=!1}}openSelect(e){this.fixedId=e,this.selected=new Set([e]),this.q="",this.line="",this.listTop=0,this.phase="select"}async resume(){if(!this.batch)try{const e=await B().active();if(e){this.adopt(await this.full(e),!0);return}const t=Dr();t&&this.adopt(await B().get(t),!0)}catch(e){e instanceof v&&e.status===404&&Ve(null)}}show(){this.batch&&(this.follow=!0,this.phase="progress")}async undoAll(e){await this.runUndo(e)}async followBatch(e){this.line="",this.phase="progress";try{this.adopt(await this.full(e),!1,!0)}catch{this.adopt(e,!1,!0)}}async full(e){return B().get(e.batch_id)}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}adopt(e,t=!1,s=!1){this.pollSeq++,this.stopping=!1,this.offline=!1,this.focusedKey="",this.follow=!0,this.batch=e,Ve(e.batch_id),this.emit("batch-change",{batch:e}),t&&(this.phase="progress"),this.timer&&clearTimeout(this.timer);const a=this.nextDelay(e);a!==null&&this.armPoll(e.batch_id,a),s&&we(e.state)&&this.finished(e)}nextDelay(e){return e.state==="running"?1500:_t(e)?5e3:null}armPoll(e,t){this.timer&&clearTimeout(this.timer);const s=this.pollSeq;this.timer=setTimeout(()=>void this.poll(e,s),t)}async poll(e,t){if(t!==this.pollSeq)return;let s=null;try{s=await B().get(e),this.offline=!1}catch(r){if(t!==this.pollSeq)return;if(r instanceof v&&r.status===404){this.forget();return}this.offline=!0}if(t!==this.pollSeq)return;s&&this.apply(s);const a=this.batch;if(a&&a.batch_id===e){const r=s?this.nextDelay(s):3e3;r!==null&&this.armPoll(e,r)}}apply(e){const t=this.batch;this.batch=e,(e.state!=="running"||t&&t.batch_id!==e.batch_id)&&(this.stopping=!1),this.emit("batch-change",{batch:e}),t&&t.batch_id===e.batch_id&&t.state==="running"&&we(e.state)&&this.finished(e)}finished(e){this.emit("batch-refresh"),Ge(e)&&e.state==="completed"&&this.emit("verify-report",{batchId:e.batch_id}),e.state==="completed"?(this.phase="closed",Ve(null),this.emit("batch-finished",{batch:e})):(this.phase="progress",this.follow=!0)}forget(){this.pollSeq++,this.timer&&clearTimeout(this.timer),this.timer=null,this.batch=null,this.phase="closed",Ve(null),this.emit("batch-change",{batch:null})}closeDialog(){if(this.phase==="progress"&&this.batch&&we(this.batch.state)&&!_t(this.batch)){this.forget();return}this.phase="closed"}disconnectedCallback(){super.disconnectedCallback(),this.pollSeq++,this.timer&&clearTimeout(this.timer),this.timer=null}pickedNames(){return Be(this.candidates,this.selected).map(e=>e.name)}askStart(){Be(this.candidates,this.selected).length<tt||(this.line="",this.confirmFor={model:Pr(this.pickedNames()),run:()=>void this.start()},this.phase="confirm")}async start(){this.confirmFor=null;const e=Be(this.candidates,this.selected);if(e.length<tt){this.phase="select";return}const t=e.map(a=>({camera_id:a.cameraId,stream_ref:a.streamRef,if_match:a.etag})),s=new Set(e.map(a=>a.recorderId));this.starting=!0,this.batch=null,this.line="",this.phase="progress";try{const a=await B().start({confirm:!0,changes:{svc:!1},targets:t,...s.size===1?{recorder_id:e[0].recorderId}:{}});this.adopt(await this.full(a),!1,!0),this.starting=!1}catch(a){if(this.starting=!1,!(a instanceof v)||a.status>=500)try{const l=await B().active();if(l){this.adopt(await this.full(l));return}}catch{}const i=a instanceof v?{status:a.status,code:a.code,user_message:a.body.user_message,details:a.body.details??{}}:{status:0,code:"network"},n=at(i,l=>{const h=e[l];return h?h.name:null});this.line=n.text,this.phase="select",n.reload&&this.emit("batch-refresh")}}async stop(){const e=this.batch;if(!(!e||this.stopping)){this.stopping=!0,this.line="";try{const t=await B().stop(e.batch_id);t&&this.apply(t)}catch(t){t instanceof v?this.line=at({status:t.status,code:t.code,user_message:t.body.user_message}).text:this.offline=!0,this.stopping=!1}this.batch&&this.batch.batch_id===e.batch_id&&!we(this.batch.state)&&this.armPoll(e.batch_id,400)}}askUndo(){const e=this.batch;if(!e)return;const t=e.kind==="rollback"?e.rollback_of:e.batch_id;if(!t)return;const s=(e.items??[]).filter(a=>e.kind==="rollback"?ns(a)!=="ok":a.status==="applied").map(this.nameOf);this.line="",this.confirmFor={model:Ir(s,e.mode,e.on_refusal),run:()=>void this.runUndo(t)},this.phase="undo-confirm"}async runUndo(e){this.confirmFor=null;const t=this.batch;this.starting=!0,this.line="",this.phase="progress";try{const s=await B().undo(e);this.adopt(await this.full(s),!1,!0),this.starting=!1}catch(s){if(this.starting=!1,!(s instanceof v)||s.status>=500)try{const i=await B().active();if(i){this.adopt(await this.full(i));return}}catch{}const r=s instanceof v?{status:s.status,code:s.code,user_message:s.body.user_message,details:s.body.details??{}}:{status:0,code:"network"};this.line=at(r).text,t?(this.batch=t,this.phase="progress"):this.phase="closed"}}willUpdate(e){if(e.has("candidates")&&this.selected.size){const t=new Set(this.candidates.map(a=>a.cameraId)),s=[...this.selected].filter(a=>t.has(a));s.length!==this.selected.size&&(this.selected=new Set(s)),this.fixedId&&!t.has(this.fixedId)&&(this.fixedId=null)}}updated(){const e=this.renderRoot.querySelector(".vl");if(e&&(Math.abs(e.clientHeight-this.viewH)>1&&e.clientHeight>0&&(this.viewH=e.clientHeight),this.phase==="progress"&&this.batch?.items?.length&&this.follow)){const t=this.batch,s=`${t.batch_id}:${t.state}:${os(t)}`;s!==this.focusedKey&&(this.focusedKey=s,e.scrollTop=Er(os(t),e.clientHeight||this.viewH,cs))}}vlist(e,t,s,a,r,i=e){const n=Fs(this.listTop,this.viewH,e,t),l=[];for(let p=n.start;p<n.end;p++)l.push(p);const h=Math.max(i,3)*t;return o`<div class="vl" role="list" aria-label=${r} tabindex="0" data-nvr-batch-list=${s} data-rows=${e} style=${`--vl-fit:${h}px`} @scroll=${this.onScroll} @wheel=${this.takeControl} @touchstart=${this.takeControl} @pointerdown=${this.takeControl}>
      <div class="space" style="padding-block:${n.top}px ${Math.max(0,n.total-n.top-(n.end-n.start)*t)}px">${Oe(l,p=>p,p=>a(p))}</div>
    </div>`}selectRow(e){const t=this.selected.has(e.cameraId),s=e.cameraId===this.fixedId;return o`<button type="button" class="sel" role="checkbox" aria-checked=${t?"true":"false"} aria-disabled=${s?"true":"false"} data-nvr-batch-cam=${e.cameraId}
      @click=${()=>this.selected=Or(this.selected,e.cameraId,this.fixedId)}>
      <span class="box" aria-hidden="true">${t?ds:c}</span><span class="nm">${e.name}</span><span class="meta">ערוץ <span class="ltr">${e.channel}</span> · <bdi class="ltr">H.264</bdi></span>
    </button>`}renderSelect(){const e=Sr(this.candidates,this.q),t=Be(this.candidates,this.selected).length,s=this.q.trim().length>0;return o`<sw-dialog wide ?open=${this.phase==="select"} heading="כיבוי SVC בכמה מצלמות" data-nvr-batch-select @close=${a=>{a.stopPropagation(),this.phase="closed"}}>
      ${this.phase==="select"?o`<div class="tools">
              <sw-field><input type="search" placeholder="חיפוש מצלמה" aria-label="חיפוש מצלמה" data-nvr-batch-search .value=${this.q} @input=${a=>{this.q=a.target.value,this.listTop=0;const r=this.renderRoot.querySelector(".vl");r&&(r.scrollTop=0)}} /></sw-field>
              <sw-button size="sm" data-nvr-batch-all ?disabled=${!e.length} @click=${()=>this.selected=Rr(this.selected,e)}>${s?`בחר הכל (${e.length})`:"בחר הכל"}</sw-button>
              <sw-button size="sm" variant="ghost" data-nvr-batch-clear @click=${()=>this.selected=Tr(this.fixedId)}>נקה</sw-button>
            </div>
            <div class="count" data-nvr-batch-count role="status">${`נבחרו ${t} מתוך ${this.candidates.length}`}${s?` · ${e.length} תוצאות`:""}</div>
            ${e.length?this.vlist(e.length,Br,"select",a=>this.selectRow(e[a]),"מצלמות",this.candidates.length):o`<p class="msg" data-nvr-batch-none role="status">אין מצלמות שמתאימות לחיפוש.</p>`}
            ${this.line?o`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>`:c}
            ${Ue()?c:o`<div class="more"><sw-button size="sm" variant="ghost" data-nvr-batch-to-encoding @click=${()=>{this.phase="closed",this.emit("encoding-open")}}>שינוי קידוד לכמה מצלמות</sw-button></div>`}
            <sw-button slot="footer" variant="ghost" data-nvr-batch-cancel @click=${()=>this.phase="closed"}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-batch-next ?disabled=${t<tt} @click=${()=>this.askStart()}>המשך</sw-button>`:c}
    </sw-dialog>`}icon(e){return o`<span class="ic ${e}" aria-hidden="true">${e==="ok"?ds:e==="bad"?Vr:e==="unk"?"?":c}</span>`}progressRow(e,t){const s=ns(t),a=Cr(t,e.kind),r=t.camera_id?this.info[t.camera_id]:null;return o`<div class="row ${s}" role="listitem" data-nvr-batch-item=${t.index} data-status=${t.status}>
      ${this.icon(s)}
      <div class="txt"><span class="nm">${this.nameOf(t)}${r?o` <span class="meta">ערוץ <span class="ltr">${r.channel}</span></span>`:c}</span>${a?o`<span class="ln" data-nvr-batch-item-line title=${a}>${a}</span>`:c}</div>
    </div>`}renderProgress(){const e=this.batch;if(!(this.phase==="progress"))return o`<sw-dialog wide data-nvr-batch-progress></sw-dialog>`;if(!e)return o`<sw-dialog wide open heading=${this.starting?"מתחיל":"שינוי מרובה"} data-nvr-batch-progress @close=${n=>{n.stopPropagation(),this.phase="closed"}}>
        ${this.starting?o`<div class="bar" role="progressbar" aria-label="מתחיל"><i style="inline-size:8%"></i></div>`:c}
        ${this.line?o`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>`:c}
        ${this.starting?c:o`<sw-button slot="footer" variant="primary" data-nvr-batch-close @click=${()=>this.phase="closed"}>סגור</sw-button>`}
      </sw-dialog>`;const s=Mr(e,this.nameOf,this.stopping),a=Xe(e),r=a.total?Math.round(a.processed/a.total*100):0,i=e.items??[];return o`<sw-dialog wide open heading=${s.title} subheading=${s.sub} data-nvr-batch-progress data-state=${e.state} data-kind=${e.kind} @close=${n=>{n.stopPropagation(),this.closeDialog()}}>
      <div class="bar ${s.tone==="error"||s.tone==="warn"?"error":s.tone==="done"?"done":""}" role="progressbar" aria-valuemin="0" aria-valuemax=${a.total} aria-valuenow=${a.processed} aria-label="התקדמות"><i style="inline-size:${r}%"></i></div>
      ${this.vlist(i.length,cs,"progress",n=>this.progressRow(e,i[n]),"מצלמות")}
      ${this.offline?o`<p class="msg" data-nvr-batch-offline role="status">אין חיבור לשרת. ממשיך לנסות.</p>`:c}
      ${this.line?o`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>`:c}
      ${s.canStop?o`<sw-button slot="footer" variant="danger" data-nvr-batch-stop @click=${()=>void this.stop()}>עצור</sw-button>`:c}
      ${s.showUndo?o`<sw-button slot="footer" data-nvr-batch-undo ?disabled=${!s.canUndo} title=${s.canUndo?"":"לא ברור אם בוצע. נבדק מול ה־NVR."} @click=${()=>this.askUndo()}>${Ms(e.mode)}</sw-button>`:c}
      ${s.showRetry?o`<sw-button slot="footer" data-nvr-batch-retry @click=${()=>this.askUndo()}>נסה שוב</sw-button>`:c}
      ${Ge(e)&&we(e.state)?o`<sw-button slot="footer" data-nvr-batch-report @click=${()=>this.emit("verify-report",{batchId:e.batch_id})}>דוח בדיקה</sw-button>`:c}
      ${we(e.state)?o`<sw-button slot="footer" variant="primary" data-nvr-batch-close @click=${()=>this.closeDialog()}>סגור</sw-button>`:c}
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
  `;I([R({attribute:!1})],O.prototype,"candidates",2);I([R({attribute:!1})],O.prototype,"info",2);I([R({attribute:!1})],O.prototype,"streams",2);I([d()],O.prototype,"phase",2);I([d()],O.prototype,"selected",2);I([d()],O.prototype,"fixedId",2);I([d()],O.prototype,"q",2);I([d()],O.prototype,"line",2);I([d()],O.prototype,"starting",2);I([d()],O.prototype,"batch",2);I([d()],O.prototype,"stopping",2);I([d()],O.prototype,"offline",2);I([d()],O.prototype,"confirmFor",2);I([d()],O.prototype,"listTop",2);I([d()],O.prototype,"viewH",2);O=I([U("nvr-camera-batch")],O);const Hr=(e,t)=>`${e}:${t}`,ps={main:0,sub:1,third:2,other:3};function Fr(e,t){return t&&t!=="error"?t.camera.streams.find(s=>s.stream_ref===e.stream_ref)??e:e}function jr(e,t,s){const a=[];for(const r of e){if(!r.camera_id)continue;const i=t.get(r.camera_id);if(!(i&&i!=="error"&&i.can_write===!1))for(const n of r.streams){const l=Fr(n,i);let h="";s?h=P.stale:i===void 0?h="נטען":i==="error"||i&&i.stale?h=P.detail_error:r.online===!1?h=P.offline:l.writable===!1?h=As(l.not_writable_reason):i.options?.[l.stream_ref]?l.etag||(h=P.stale):h=P.no_options,a.push({key:Hr(r.camera_id,l.stream_ref),cameraId:r.camera_id,recorderId:r.recorder_id,cameraName:r.name,channel:r.channel,streamRef:l.stream_ref,role:l.role,codec:l.codec,resolution:l.resolution,svc:l.svc,webrtc:l.webrtc??"unknown",selectable:!h,reason:h})}}return a.sort((r,i)=>r.channel-i.channel||r.cameraName.localeCompare(i.cameraName,"he")||ps[r.role]-ps[i.role]||r.streamRef.localeCompare(i.streamRef))}const rt={q:"",codec:"",role:"",svc:"",webrtc:""},Kr=e=>!!(e.q.trim()||e.codec||e.role||e.svc||e.webrtc);function Ur(e,t){let s=t.q.trim().toLowerCase();const a=[...s.matchAll(/ערוץ\s*(\d+)/g)].map(i=>Number(i[1]));s=s.replace(/ערוץ\s*\d+/g," ");const r=s.split(/\s+/).filter(Boolean);return e.filter(i=>{if(t.role&&i.role!==t.role||t.codec==="h264"&&i.codec!=="H.264"||t.codec==="h265"&&i.codec!=="H.265"||t.codec==="other"&&(i.codec==="H.264"||i.codec==="H.265")||t.svc==="on"&&i.svc!==!0||t.svc==="off"&&i.svc!==!1||t.svc==="none"&&i.svc!==null||t.webrtc&&i.webrtc!==t.webrtc||a.length&&!a.includes(i.channel))return!1;const n=`${i.cameraName} ${i.channel} ${Y[i.role]} ${i.codec??""}`.toLowerCase();return r.every(l=>n.includes(l))})}function Wr(e,t){const s=new Set(e);for(const a of t)a.selectable&&s.add(a.key);return s}function Qr(e,t){const s=new Set(e);return s.has(t.key)?s.delete(t.key):t.selectable&&s.add(t.key),s}const it=(e,t)=>e.filter(s=>s.selectable&&t.has(s.key)),nt={codec:"",resolution:"",fps:"",bitrate_mode:"",bitrate_kbps:"",quality:"",gop:"",svc:"",smart_codec:""},hs="ללא שינוי",us=e=>{const t=/^(\d+)x(\d+)$/.exec(e);return t?Number(t[1])*Number(t[2]):0};function ot(e,t,s){const a={codec:[],resolution:[],fps:[],fpsFull:!1,bitrateMode:[],bitrate:null,quality:[],gop:null,svc:!1,smart:!1},r=(i,n)=>{i.includes(n)||i.push(n)};for(const i of e){const n=t.get(i.cameraId),l=n&&n!=="error"?n.options?.[i.streamRef]:null;if(l){for(const h of l.codec)(h==="H.264"||h==="H.265")&&r(a.codec,h);for(const h of l.resolution[s||i.codec||""]??[])r(a.resolution,h);for(const h of l.fps)r(a.fps,h);a.fpsFull||=l.fps_full;for(const h of l.bitrate_mode)r(a.bitrateMode,h);l.bitrate_kbps&&(a.bitrate=a.bitrate?{min:Math.min(a.bitrate.min,l.bitrate_kbps.min),max:Math.max(a.bitrate.max,l.bitrate_kbps.max)}:{...l.bitrate_kbps});for(const h of l.quality)r(a.quality,h);l.gop&&(a.gop=a.gop?{min:Math.min(a.gop.min,l.gop.min),max:Math.max(a.gop.max,l.gop.max)}:{...l.gop}),a.svc||=l.svc,a.smart||=l.smart_codec}}return a.codec.sort(),a.resolution.sort((i,n)=>us(n)-us(i)),a.fps.sort((i,n)=>n-i),a.bitrateMode.sort(),a.quality.sort((i,n)=>n-i),a}const fs=e=>/^\d{1,7}$/.test(e.trim())?Number(e.trim()):null;function ms(e,t){const s={},a=[];if(e.codec&&(s.codec=e.codec),e.resolution&&(s.resolution=e.resolution),e.fps&&(s.fps=e.fps==="full"?"full":Number(e.fps)),e.bitrate_mode&&(s.bitrate_mode=e.bitrate_mode),e.bitrate_kbps.trim()){const r=fs(e.bitrate_kbps);r===null||r<1||t.bitrate&&(r<t.bitrate.min||r>t.bitrate.max)?a.push("bitrate_kbps"):s.bitrate_kbps=r}if(e.quality&&(s.quality=Number(e.quality)),e.gop.trim()){const r=fs(e.gop);r===null||r<1||t.gop&&(r<t.gop.min||r>t.gop.max)?a.push("gop"):s.gop=r}return e.svc&&(s.svc=e.svc==="on"),e.smart_codec&&(s.smart_codec=e.smart_codec==="on"),{settings:s,invalid:a}}const ws=e=>Object.keys(e).length>0;function Gr(e,t,s){const a={...e,codec:t};return a.resolution&&!s.resolution.includes(a.resolution)&&(a.resolution=""),a}function Yr(e,t){return{...e,bitrate_mode:t,quality:t==="CBR"?"":e.quality}}const gs="הצפייה החיה מנגנת ב־WebRTC רק H.264.";function Jr(e){const t=["codec","profile","resolution","fps","bitrate_mode","bitrate_kbps","quality","gop","svc","smart_codec"],s=new Map(e.notes.filter(a=>a.kind==="adjusted").map(a=>[a.field,a.message]));return Object.entries(e.fields??{}).sort(([a],[r])=>t.indexOf(a)-t.indexOf(r)).map(([a,[r,i]])=>({field:a,label:g[a]??a,from:ce(a,r),to:ce(a,i),adjusted:s.has(a),why:s.get(a)??""}))}const Xr=e=>e.notes.filter(t=>t.kind==="kept").map(t=>({label:g[t.field]??t.field,why:t.message}));function Zr(e){const t=e.counts,s=a=>a===1?"זרם אחד":`${a} זרמים`;return[t.change?`ישתנו ${s(t.change)}`:"אין מה לשנות",t.skip?`לא ניתן: ${s(t.skip)}`:"",t.unchanged?`כבר מוגדרים: ${s(t.unchanged)}`:""].filter(Boolean).join(" · ")}function ei(e,t){return{confirm:!0,settings:e.settings,recorder_id:e.recorder_id,targets:e.items.filter(s=>s.status==="change"&&s.if_match).map(s=>({camera_id:s.camera_id,stream_ref:s.stream_ref,if_match:s.if_match,changes:s.changes})),...t?{on_refusal:t}:{}}}const ti=e=>e===1?"בזרם אחד":`ב־${e} זרמים`,si="השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה.";function ai(e,t,s){const a=e.items.filter(r=>r.status==="change");return{heading:`לשנות את הקידוד ${ti(a.length)}?`,lead:s?wr(s):si,count:mt(e.changes_total),confirmLabel:"החל",details:[],names:a.map(t)}}const ri=(e,t)=>t&&t in Y?`${e} · ${Y[t]}`:e;function bs(e){switch(e.code){case"stale":case"plan_changed":return{text:"ההגדרות במצלמות השתנו. התצוגה המקדימה נטענה מחדש.",reload:!0};case"batch_in_progress":return{text:"מתבצע שינוי מרובה",reload:!1};case"batch_target_not_allowed":return{text:"אחד הזרמים כבר אינו מתאים. התצוגה המקדימה נטענה מחדש.",reload:!0};case"write_in_progress":return{text:"שינוי אחר של אחד הזרמים מתבצע. נסו שוב בעוד רגע.",reload:!1};case"forbidden":return{text:"אין הרשאה לפעולה הזו.",reload:!1};case"source_unavailable":case"source_timeout":return{text:"ה־NVR אינו זמין.",reload:!1};case"network":return{text:"אין חיבור לשרת.",reload:!1};default:return{text:e.user_message||"הפעולה לא בוצעה.",reload:!1}}}const ii=e=>e?`${e.min}–${e.max}`:J;var ni=Object.defineProperty,oi=Object.getOwnPropertyDescriptor,T=(e,t,s,a)=>{for(var r=a>1?void 0:a?oi(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&ni(t,s,r),r};const li=44,ci=60,di=o`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>`;let k=class extends K{constructor(){super(...arguments),this.rows=[],this.details=new Map,this.phase="closed",this.selected=new Set,this.filters={...rt},this.draft={...nt},this.plan=null,this.tab="change",this.busy=!1,this.line="",this.confirmModel=null,this.listTop=0,this.viewH=360,this.presetScope="all",this.presetRole="both",this.presetMode=!1,this.onRefusal="skip",this.refusalKnown=!1,this.nameOf=e=>{const t=this.rows.find(s=>s.cameraId===e.camera_id&&s.streamRef===e.stream_ref);return ri(t?.cameraName??e.camera_id,e.role??t?.role)}}open(){this.selected=new Set,this.filters={...rt},this.draft={...nt},this.plan=null,this.line="",this.listTop=0,this.presetMode=!1,this.phase="select"}willUpdate(e){if(e.has("rows")&&this.selected.size){const t=new Set(this.rows.filter(a=>a.selectable).map(a=>a.key)),s=[...this.selected].filter(a=>t.has(a));s.length!==this.selected.size&&(this.selected=new Set(s))}}updated(){const e=this.renderRoot.querySelector(".vl");e&&e.clientHeight>0&&Math.abs(e.clientHeight-this.viewH)>1&&(this.viewH=e.clientHeight)}resetScroll(){this.listTop=0;const e=this.renderRoot.querySelector(".vl");e&&(e.scrollTop=0)}vlist(e,t,s,a,r){const i=Fs(this.listTop,this.viewH,e,t),n=[];for(let l=i.start;l<i.end;l++)n.push(l);return o`<div class="vl" role="list" aria-label=${r} tabindex="0" data-nvr-enc-list=${s} data-rows=${e} @scroll=${l=>this.listTop=l.target.scrollTop}>
      <div class="space" style="padding-block:${i.top}px ${Math.max(0,i.total-i.top-(i.end-i.start)*t)}px">${Oe(n,l=>l,l=>a(l))}</div>
    </div>`}dd(e,t,s,a,r){return o`<sw-dropdown data-nvr-enc-dd=${t} .label=${e} .placeholder=${e} .value=${s} .items=${a} @change=${i=>r(i.detail.id)}></sw-dropdown>`}selectRow(e){const t=this.selected.has(e.key),s=e.selectable?`${e.codec??""}${e.resolution?` · ${e.resolution.replace(/x/i,"×")}`:""}`:e.reason;return o`<button type="button" class="sel" role="checkbox" aria-checked=${t?"true":"false"} aria-disabled=${e.selectable?"false":"true"} data-nvr-enc-stream=${e.key}
      title=${e.selectable?"":e.reason} @click=${()=>this.selected=Qr(this.selected,e)}>
      <span class="box" aria-hidden="true">${t?di:c}</span>
      <span class="nm">${e.cameraName} · ${Y[e.role]}</span>
      <span class="meta">${e.selectable?o`<bdi class="ltr">${s}</bdi>`:s}</span>
    </button>`}patchFilters(e){this.filters={...this.filters,...e},this.resetScroll()}renderSelect(){const e=this.filters,t=Ur(this.rows,e),s=it(this.rows,this.selected).length,a=this.rows.filter(i=>i.selectable).length,r=Kr(e);return o`${this.renderPreset()}<div class="tools" data-nvr-enc-filters>
        <sw-field class="q"><input type="search" placeholder="חיפוש מצלמה" aria-label="חיפוש מצלמה" data-nvr-enc-search .value=${e.q} @input=${i=>this.patchFilters({q:i.target.value})} /></sw-field>
        ${this.dd("זרם","role",e.role,[{id:"",label:"כל הזרמים"},{id:"main",label:"ראשי"},{id:"sub",label:"משני"}],i=>this.patchFilters({role:i}))}
        ${this.dd("קידוד","codec",e.codec,[{id:"",label:"כל הקידודים"},{id:"h264",label:"H.264"},{id:"h265",label:"H.265"},{id:"other",label:"אחר"}],i=>this.patchFilters({codec:i}))}
        ${this.dd("SVC","svc",e.svc,[{id:"",label:"כל ה־SVC"},{id:"on",label:"SVC פעיל"},{id:"off",label:"SVC כבוי"},{id:"none",label:"ללא SVC"}],i=>this.patchFilters({svc:i}))}
        ${this.dd("WebRTC","webrtc",e.webrtc,[{id:"",label:"כל ה־WebRTC"},{id:"ok",label:"מתנגן"},{id:"no",label:"לא מתנגן"},{id:"unknown",label:"לא ידוע"}],i=>this.patchFilters({webrtc:i}))}
      </div>
      <div class="tools">
        <sw-button size="sm" data-nvr-enc-all ?disabled=${!t.some(i=>i.selectable)} @click=${()=>this.selected=Wr(this.selected,t)}>${r?`בחר הכל (${t.filter(i=>i.selectable).length})`:"בחר הכל"}</sw-button>
        <sw-button size="sm" variant="ghost" data-nvr-enc-clear @click=${()=>this.selected=new Set}>נקה</sw-button>
        ${r?o`<sw-button size="sm" variant="ghost" data-nvr-enc-unfilter @click=${()=>this.patchFilters({...rt})}>נקה סינון</sw-button>`:c}
      </div>
      <div class="count" data-nvr-enc-count role="status">${`נבחרו ${s} מתוך ${a}`}${r?` · ${t.length} תוצאות`:""}</div>
      ${t.length?this.vlist(t.length,li,"select",i=>this.selectRow(t[i]),"זרמים"):o`<p class="msg" data-nvr-enc-none role="status">אין זרמים שמתאימים לסינון.</p>`}
      ${this.line?o`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>`:c}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-cancel @click=${()=>this.phase="closed"}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-next ?disabled=${s<1} @click=${()=>this.toSettings()}>המשך</sw-button>`}toSettings(){this.line="",this.presetMode=!1,this.phase="settings"}renderPreset(){const e=Vt(this.rows,this.selected,this.presetScope,this.presetRole),t=wa(this.rows,this.selected,this.presetScope,this.presetRole,P.writes_disabled),s=e.length===0;return o`<section class="preset" data-nvr-h264-preset aria-label=${Dt}>
      <div class="preset-head">
        <span class="preset-title">${Dt}</span>
        <p class="note" data-nvr-h264-why>${Ht} ${Ft}</p>
      </div>
      <div class="tools">
        ${this.dd("מצלמות","h264-scope",this.presetScope,ga,a=>(this.presetScope=a,this.line=""))}
        ${this.dd("זרמים","h264-role",this.presetRole,ba,a=>(this.presetRole=a,this.line=""))}
        <sw-button size="sm" variant="primary" data-nvr-h264-run ?disabled=${s||this.busy} @click=${()=>this.runPreset()}>${this.busy&&this.presetMode?"בודק…":va(e.length)}</sw-button>
        <sw-button size="sm" variant="ghost" data-nvr-verify-reports @click=${()=>this.emit("verify-reports")}>דוחות בדיקה קודמים</sw-button>
      </div>
      ${s||t.writesOff?o`<p class="msg" data-nvr-h264-empty role="status">${s?_a(this.presetScope,t,this.selected.size):`${t.writesOff} זרמים לא ישתנו: שינויי הגדרות ב־NVR כבויים (הגדרות החיבור).`}</p>`:c}
    </section>`}runPreset(){const e=Vt(this.rows,this.selected,this.presetScope,this.presetRole);e.length&&(this.selected=ya(e),this.draft={...nt,codec:"H.264"},this.presetMode=!0,this.runPreview())}renderSettings(){const e=this.draft,t=it(this.rows,this.selected),s=ot(t,this.details,e.codec),{settings:a,invalid:r}=ms(e,s),i={id:"",label:hs},n=[i,{id:"on",label:"פעיל"},{id:"off",label:"כבוי"}],l=p=>this.draft={...this.draft,...p},h=(p,w)=>o`<sw-field label=${g[p]+(p==="bitrate_kbps"?" (kbps)":"")} hint=${r.includes(p)?`טווח ${ii(w)}`:""}>
        <input inputmode="numeric" placeholder=${hs} aria-label=${g[p]} data-nvr-enc-input=${p} aria-invalid=${r.includes(p)?"true":"false"} .value=${e[p]} @input=${m=>l({[p]:m.target.value})} />
      </sw-field>`;return o`<p class="count" data-nvr-enc-picked>${`נבחרו ${t.length===1?"זרם אחד":`${t.length} זרמים`}`}</p>
      <div class="form" data-nvr-enc-form>
        <sw-field label=${g.codec}>${this.dd(g.codec,"codec-target",e.codec,[i,...s.codec.map(p=>({id:p,label:p}))],p=>this.draft=Gr(this.draft,p,ot(t,this.details,p)))}</sw-field>
        <sw-field label=${g.resolution}>${this.dd(g.resolution,"resolution",e.resolution,[i,...s.resolution.map(p=>({id:p,label:ce("resolution",p)}))],p=>l({resolution:p}))}</sw-field>
        <sw-field label=${g.fps}>${this.dd(g.fps,"fps",e.fps,[i,...s.fpsFull?[{id:"full",label:"מלא"}]:[],...s.fps.map(p=>({id:String(p),label:String(p)}))],p=>l({fps:p}))}</sw-field>
        <sw-field label=${g.bitrate_mode}>${this.dd(g.bitrate_mode,"bitrate_mode",e.bitrate_mode,[i,...s.bitrateMode.map(p=>({id:p,label:p}))],p=>this.draft=Yr(this.draft,p))}</sw-field>
        ${h("bitrate_kbps",s.bitrate)}
        <sw-field label=${g.quality}>${this.dd(g.quality,"quality",e.quality,[i,...e.bitrate_mode==="CBR"?[]:s.quality.map(p=>({id:String(p),label:String(p)}))],p=>l({quality:p}))}</sw-field>
        ${h("gop",s.gop)}
        ${s.svc?o`<sw-field label="SVC">${this.dd("SVC","svc-target",e.svc,n,p=>l({svc:p}))}</sw-field>`:c}
        ${s.smart?o`<sw-field label=${g.smart_codec}>${this.dd(g.smart_codec,"smart_codec",e.smart_codec,n,p=>l({smart_codec:p}))}</sw-field>`:c}
      </div>
      ${e.codec?o`<p class="note" data-nvr-enc-webrtc>${gs}</p>`:c}
      ${this.line?o`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>`:c}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-back @click=${()=>(this.phase="select",this.line="")}>חזרה</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-preview ?disabled=${!ws(a)||r.length>0||this.busy} @click=${()=>void this.runPreview()}>${this.busy?"בודק…":"תצוגה מקדימה"}</sw-button>`}async runPreview(e=!1){const t=it(this.rows,this.selected),{settings:s,invalid:a}=this.presetMode?{settings:{...xa},invalid:[]}:ms(this.draft,ot(t,this.details,this.draft.codec));if(!t.length||!ws(s)||a.length)return;this.busy=!0,e||(this.line="");const r=new Set(t.map(i=>i.recorderId));try{const i=await B().previewEncoding({settings:s,targets:t.map(n=>({camera_id:n.cameraId,stream_ref:n.streamRef})),...r.size===1?{recorder_id:t[0].recorderId}:{}});this.plan=i,this.refusalKnown=i.on_refusal==="skip"||i.on_refusal==="stop",this.onRefusal=ss(i.on_refusal),this.tab=i.counts.change?"change":i.counts.skip?"skip":"unchanged",this.phase="preview",this.resetScroll()}catch(i){const n=i instanceof v?{status:i.status,code:i.code,user_message:i.body.user_message}:{code:"network"};this.line=bs(n).text}finally{this.busy=!1}}previewRow(e){let t;if(e.status==="skip")t=o`<span class="ln" data-nvr-enc-reason title=${e.message??""}>${e.message??""}</span>`;else if(e.status==="unchanged")t=o`<span class="ln muted">כבר מוגדר כך</span>`;else{const s=Jr(e),a=Xr(e),r=[...s.filter(i=>i.adjusted).map(i=>`${i.label}: ${i.why}`),...a.map(i=>`${i.label}: ${i.why}`)].join(`
`);t=o`<span class="ln" data-nvr-enc-delta title=${r}>${s.map((i,n)=>o`${n?" · ":""}${i.label} <bdi class="ltr">${i.from}</bdi> <span class="arrow" aria-hidden="true">←</span> <bdi class="ltr ${i.adjusted?"adj":""}" data-adjusted=${i.adjusted?"true":"false"}>${i.to}${i.adjusted?"*":""}</bdi>`)}${a.length?o` · <span class="muted" data-nvr-enc-kept>${a.map(i=>i.label).join(", ")} ${"ללא שינוי"}</span>`:c}</span>`}return o`<div class="row" role="listitem" data-nvr-enc-item=${e.index} data-status=${e.status}><span class="nm">${this.nameOf(e)}</span>${t}</div>`}renderPreview(){const e=this.plan;if(!e)return c;const t=e.items.filter(r=>r.status===this.tab),s=[{id:"change",label:"ישתנו",count:e.counts.change},{id:"skip",label:"לא ניתן",count:e.counts.skip},{id:"unchanged",label:"כבר מוגדרים",count:e.counts.unchanged}].filter(r=>r.count>0||r.id==="change"),a=e.adjusted>0;return o`<p class="sum" data-nvr-enc-summary role="status">${Zr(e)}</p>
      ${this.presetMode?o`<p class="note" data-nvr-h264-preview-note>${Ht} ${Ft} רזולוציה, קצב פריימים וקצב סיביות נשארים כמו שהם, אלא אם המצלמה דורשת התאמה. ${ka}</p>`:e.settings.codec?o`<p class="note" data-nvr-enc-webrtc>${gs}</p>`:c}
      ${a?o`<p class="note" data-nvr-enc-adjusted>* הותאם למה שהמצלמה מאפשרת</p>`:c}
      <sw-tabs data-nvr-enc-tabs .items=${s} .active=${this.tab} group-label="תצוגה מקדימה" @change=${r=>(this.tab=r.detail.id,this.resetScroll())}></sw-tabs>
      ${t.length?this.vlist(t.length,ci,"preview",r=>this.previewRow(t[r]),"תצוגה מקדימה"):o`<p class="msg" data-nvr-enc-empty role="status">אין זרמים ברשימה הזו.</p>`}
      ${this.refusalKnown&&e.counts.change>1?o`<div class="tools" data-nvr-enc-refusal>${this.dd(ur,"on-refusal",this.onRefusal,[...fr],r=>this.onRefusal=ss(r))}<span class="note" data-nvr-enc-refusal-hint>${mr[this.onRefusal]}</span></div>`:c}
      ${e.batch_in_progress?o`<p class="msg" data-nvr-enc-busy role="status">מתבצע שינוי מרובה</p>`:c}
      ${this.line?o`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>`:c}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-back @click=${()=>(this.phase=this.presetMode?"select":"settings",this.line="")}>חזרה</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-apply ?disabled=${!e.counts.change||e.batch_in_progress||this.busy} @click=${()=>this.askConfirm()}>${e.counts.change?`החל על ${e.counts.change===1?"זרם אחד":`${e.counts.change} זרמים`}`:"החל"}</sw-button>`}askConfirm(){const e=this.plan;!e||!e.counts.change||(this.line="",this.confirmModel=ai(e,this.nameOf,this.refusalKnown?this.onRefusal:void 0),this.phase="confirm")}async start(){const e=this.plan;if(this.confirmModel=null,!!e){this.busy=!0,this.phase="preview";try{const t=await B().startEncoding(ei(e,this.refusalKnown?this.onRefusal:void 0));this.handOff(t)}catch(t){if(!(t instanceof v)||t.status>=500)try{const i=await B().active();if(i){this.handOff(i);return}}catch{}const a=t instanceof v?{status:t.status,code:t.code,user_message:t.body.user_message}:{code:"network"},r=bs(a);r.reload&&(this.busy=!1,await this.runPreview(!0)),this.line=r.text}finally{this.busy=!1}}}handOff(e){this.phase="closed",this.plan=null,this.emit("encoding-started",{batch:e})}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}render(){const e=this.phase==="select"||this.phase==="settings"||this.phase==="preview",t=this.phase==="settings"?"ההגדרות החדשות":this.phase==="preview"?"תצוגה מקדימה":"שינוי קידוד לכמה מצלמות";return o`<sw-dialog wide ?open=${e} heading=${t} data-nvr-enc data-phase=${this.phase} ?locked=${this.busy} @close=${s=>{s.stopPropagation(),this.phase="closed"}}>
        ${this.phase==="select"?this.renderSelect():this.phase==="settings"?this.renderSettings():this.phase==="preview"?this.renderPreview():c}
      </sw-dialog>
      <nvr-confirm .model=${this.phase==="confirm"?this.confirmModel:null}
        @confirm=${s=>{s.stopPropagation(),this.start()}}
        @cancel=${s=>{s.stopPropagation(),this.confirmModel=null,this.phase="preview"}}></nvr-confirm>`}};k.styles=Z`
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
  `;T([R({attribute:!1})],k.prototype,"rows",2);T([R({attribute:!1})],k.prototype,"details",2);T([d()],k.prototype,"phase",2);T([d()],k.prototype,"selected",2);T([d()],k.prototype,"filters",2);T([d()],k.prototype,"draft",2);T([d()],k.prototype,"plan",2);T([d()],k.prototype,"tab",2);T([d()],k.prototype,"busy",2);T([d()],k.prototype,"line",2);T([d()],k.prototype,"confirmModel",2);T([d()],k.prototype,"listTop",2);T([d()],k.prototype,"viewH",2);T([d()],k.prototype,"presetScope",2);T([d()],k.prototype,"presetRole",2);T([d()],k.prototype,"presetMode",2);T([d()],k.prototype,"onRefusal",2);T([d()],k.prototype,"refusalKnown",2);k=T([U("nvr-encoding-batch")],k);var pi=Object.defineProperty,hi=Object.getOwnPropertyDescriptor,ae=(e,t,s,a)=>{for(var r=a>1?void 0:a?hi(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&pi(t,s,r),r};const ui=2e3;let j=class extends K{constructor(){super(...arguments),this.info={},this.streams={},this.open=!1,this.view="report",this.fromList=!1,this.batch=null,this.recent=null,this.tab="all",this.line="",this.busy=!1,this.seq=0,this.timer=null}async show(e,t=!1){this.open=!0,this.view="report",this.fromList=t,this.tab="all",this.line="",this.batch=this.batch?.batch_id===e?this.batch:null,await this.read(e,++this.seq)}async showList(){this.stopPolling(),this.open=!0,this.view="list",this.line="",this.recent=null;try{this.recent=xr(await B().recent())}catch{this.recent=[],this.line="לא ניתן לקרוא את הדוחות."}}async read(e,t){try{const s=await B().get(e);if(t!==this.seq||!this.open)return;this.batch=s,this.tab!=="all"&&!Te(s,this.tab).length&&(this.tab="all"),(s.state==="running"||rs(s.verify))&&this.arm(e,t)}catch(s){if(t!==this.seq)return;this.line=s instanceof v&&s.status===404?"הדוח לא נמצא.":"אין חיבור לשרת. ממשיך לנסות.",s instanceof v&&s.status===404||this.arm(e,t)}}arm(e,t){this.stopPolling(),this.timer=setTimeout(()=>void this.read(e,t),ui)}stopPolling(){this.timer&&clearTimeout(this.timer),this.timer=null}close(){this.seq++,this.stopPolling(),this.open=!1}disconnectedCallback(){super.disconnectedCallback(),this.seq++,this.stopPolling()}async recheck(){const e=this.batch;if(!(!e||this.busy)){this.busy=!0,this.line="";try{this.batch=await B().recheck(e.batch_id),this.arm(e.batch_id,this.seq)}catch(t){const s=t instanceof v?{status:t.status,code:t.code,user_message:t.body.user_message}:{status:0,code:"network"};this.line=yr(s)}finally{this.busy=!1}}}nameOf(e){const t=e.camera_id?this.info[e.camera_id]?.name??e.camera_id:"—",s=e.camera_id?this.streams[`${e.camera_id}:${e.stream_ref}`]:"";return s?`${t} · ${s}`:t}row(e){const t=e.verify??null,s=t?pr(t):rs(this.batch?.verify)?"בבדיקה":"לא נבדק",a=e.camera_id?this.info[e.camera_id]?.channel:void 0;return o`<div class="row" role="listitem" data-nvr-verify-item=${e.index} data-outcome=${t?.outcome??""}>
      <span class="nm">${this.nameOf(e)}${a!==void 0?o` <span class="meta">ערוץ <span class="ltr">${a}</span></span>`:c}</span>
      <span class="chip ${hr(t)}" data-nvr-verify-chip title=${s}>${s}</span>
      ${t?.detail?o`<span class="ln" data-nvr-verify-detail>${t.detail}</span>`:c}
    </div>`}renderReport(){const e=this.batch;if(!e)return o`<p class="msg" role="status">טוען…</p>${this.line?o`<p class="msg" role="alert">${this.line}</p>`:c}`;const t=Te(e,this.tab),s=vr(e),a=!!e.verify?.can_recheck&&!this.busy;return o`<p class="sum" data-nvr-verify-summary role="status">${br(e.verify)||"אין בדיקה לשינוי הזה."}</p>
      <sw-tabs data-nvr-verify-tabs .items=${s} .active=${this.tab} group-label="דוח בדיקה" @change=${r=>this.tab=r.detail.id}></sw-tabs>
      ${t.length?o`<div class="list" role="list" aria-label="זרמים" data-nvr-verify-list=${this.tab}>${Oe(t,r=>r.index,r=>this.row(r))}</div>`:o`<p class="msg" data-nvr-verify-empty role="status">${this.tab==="worklist"?"כל המצלמות השתנו.":"אין זרמים ברשימה הזו."}</p>`}
      <p class="hint" data-nvr-verify-hint>${is}</p>
      ${this.line?o`<p class="msg" data-nvr-verify-line role="alert">${this.line}</p>`:c}
      ${this.fromList?o`<sw-button slot="footer" variant="ghost" data-nvr-verify-back @click=${()=>void this.showList()}>לכל הדוחות</sw-button>`:c}
      <sw-button slot="footer" data-nvr-verify-recheck ?disabled=${!a} title=${is} @click=${()=>void this.recheck()}>${this.busy?"שולח…":"בדוק שוב"}</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-verify-close @click=${()=>this.close()}>סגור</sw-button>`}renderList(){const e=this.recent;return o`${e===null?o`<p class="msg" role="status">טוען…</p>`:e.length?o`<div class="list" role="list" aria-label="דוחות" data-nvr-verify-reports>${Oe(e,t=>t.batch_id,t=>o`<button type="button" class="pick" role="listitem" data-nvr-verify-open=${t.batch_id} @click=${()=>void this.show(t.batch_id,!0)}>${kr(t)}</button>`)}</div>`:o`<p class="msg" data-nvr-verify-none role="status">אין עדיין דוחות של שינוי קידוד.</p>`}
      ${this.line?o`<p class="msg" role="alert">${this.line}</p>`:c}
      <sw-button slot="footer" variant="primary" data-nvr-verify-close @click=${()=>this.close()}>סגור</sw-button>`}render(){const e=this.batch,t=this.view==="list"?"דוחות בדיקה":e?_r(e):"דוח בדיקה",s=this.view==="report"&&e?Hs(e.verify?.checked_at??e.created_at??null):"";return o`<sw-dialog wide ?open=${this.open} heading=${t} subheading=${s} data-nvr-verify data-view=${this.view} @close=${a=>{a.stopPropagation(),this.close()}}>${this.open?this.view==="list"?this.renderList():this.renderReport():c}</sw-dialog>`}};j.styles=Z`
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
  `;ae([R({attribute:!1})],j.prototype,"info",2);ae([R({attribute:!1})],j.prototype,"streams",2);ae([d()],j.prototype,"open",2);ae([d()],j.prototype,"view",2);ae([d()],j.prototype,"fromList",2);ae([d()],j.prototype,"batch",2);ae([d()],j.prototype,"recent",2);ae([d()],j.prototype,"tab",2);ae([d()],j.prototype,"line",2);ae([d()],j.prototype,"busy",2);j=ae([U("nvr-verify-report")],j);var fi=Object.defineProperty,mi=Object.getOwnPropertyDescriptor,A=(e,t,s,a)=>{for(var r=a>1?void 0:a?mi(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&fi(t,s,r),r};const vs="ה־NVR אינו זמין. מוצגים הערכים האחרונים.",lt="מתבצע שינוי מרובה",_s=[{id:"channel",label:"ערוץ",sort:"channel"},{id:"camera",label:"מצלמה",sort:"camera"},{id:"role",label:"זרם",sort:"role"},{id:"codec",label:"קידוד",sort:"codec"},{id:"svc",label:"SVC",sort:"svc"},{id:"resolution",label:"רזולוציה",sort:"resolution"},{id:"fps",label:"FPS",sort:"fps"},{id:"bitrate",label:"קצב",sort:"bitrate"},{id:"gop",label:"GOP",sort:"gop"},{id:"webrtc",label:"WebRTC",sort:"webrtc"}],wi=o`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>`,gi=o`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>`;let E=class extends K{constructor(){super(...arguments),this.bubbleSkin=new $t(this),this.data=null,this.recorder=null,this.recorders=[],this.recorderFilter="",this.loading=!0,this.failure=null,this.filters={...Ze},this.sort={...Is},this.details=new Map,this.busy=new Set,this.lines=new Map,this.confirm=null,this.editing=null,this.toast=null,this.batch=null,this.seq=0,this.toasts=0}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(){this.toggleAttribute("data-rw",!!this.data?.can_write)}async load(){const e=++this.seq;this.loading=!0;try{const t=ge(),[s,a]=await Promise.all([t.cameras(),t.recorders().catch(()=>null)]);if(e!==this.seq)return;this.data=s,this.recorder=a?.recorders[0]??null,this.recorders=a?.recorders??[],this.failure=null,this.details=new Map,this.lines=new Map,s.stale&&!s.cameras.length?(this.data=null,this.failure={status:503,code:s.error??"source_unavailable",message:vs}):(this.prefetch(s,e),s.can_write&&!s.stale&&this.updateComplete.then(()=>this.batchEl()?.resume()))}catch(t){if(e!==this.seq)return;this.data=null,this.failure={status:t instanceof v?t.status:0,code:t instanceof v?t.code:"network",message:fe(t)}}finally{e===this.seq&&(this.loading=!1)}}async prefetch(e,t){if(!e.can_write||e.stale)return;const s=e.cameras.filter(h=>h.camera_id&&h.streams.length).map(h=>h.camera_id);let a=0;const r=new Map;let i=null;const n=()=>{i&&clearTimeout(i),i=null,!(t!==this.seq||!r.size)&&(this.commitDetails(new Map(r)),r.clear())},l=async()=>{for(;a<s.length&&t===this.seq;)await this.readCamera(s[a++],t,r),r.size>=25?n():i||(i=setTimeout(n,150))};await Promise.all([l(),l(),l()]),n()}commitDetails(e){if(this.details=new Map([...this.details,...e]),!this.data)return;const t=new Map;for(const[s,a]of e)a!=="error"&&a.camera.streams.length&&t.set(s,a.camera.streams);t.size&&(this.data={...this.data,cameras:this.data.cameras.map(s=>s.camera_id&&t.has(s.camera_id)?{...s,streams:t.get(s.camera_id)}:s)})}async readCamera(e,t=this.seq,s){let a;try{a=await ge().camera(e)}catch{a="error"}t===this.seq&&(s?s.set(e,a):this.commitDetails(new Map([[e,a]])))}cameraById(e){return this.data?.cameras.find(t=>t.camera_id===e)??null}streamOf(e,t){return this.cameraById(e)?.streams.find(s=>s.stream_ref===t)??null}ctrl(e,t){const s=this.data;if(!s||!t.cameraId)return{show:!1,enabled:!1,reason:""};const a=Ua(e,{camera_id:t.cameraId,online:t.online},t.stream,{canWrite:s.can_write,stale:s.stale,detail:this.details.get(t.cameraId)??null});return a.show&&this.batchRunning?{show:!0,enabled:!1,reason:lt}:a}get batchRunning(){return this.batch?.state==="running"}batchEl(){return this.renderRoot.querySelector("nvr-camera-batch")}cameraInfo(){const e={},t=this.multiRecorder;for(const s of this.data?.cameras??[])s.camera_id&&(e[s.camera_id]={name:t?`${s.name} · ${this.recorderName(s.recorder_id)}`:s.name,channel:s.channel});return e}streamRoles(){const e={};for(const t of this.data?.cameras??[])if(t.camera_id)for(const s of t.streams)e[`${t.camera_id}:${s.stream_ref}`]=Y[s.role];return e}encEl(){return this.renderRoot.querySelector("nvr-encoding-batch")}openReport(e){const t=this.renderRoot.querySelector("nvr-verify-report");t&&(e?t.show(e):t.showList())}openEncoding(){this.batchRunning||(this.toast=null,this.encEl()?.open())}isBusy(e){return!!e.cameraId&&!!e.stream&&this.busy.has(`${e.cameraId}:${e.stream.stream_ref}`)}setBusy(e,t){const s=new Set(this.busy);t?s.add(e):s.delete(e),this.busy=s}setLine(e,t){const s=new Map(this.lines);t?s.set(e,t):s.delete(e),this.lines=s}replaceStream(e,t){const s=i=>({...t,writable:t.writable??i?.writable??null,not_writable_reason:t.not_writable_reason??i?.not_writable_reason??null}),a=i=>({...i,streams:i.streams.map(n=>n.stream_ref===t.stream_ref?s(n):n)});this.data&&(this.data={...this.data,cameras:this.data.cameras.map(i=>i.camera_id===e?a(i):i)});const r=this.details.get(e);r&&r!=="error"&&(this.details=new Map(this.details).set(e,{...r,camera:a(r.camera)}))}showToast(e,t={}){this.toast={n:++this.toasts,message:e,...t}}applyResult(e,t,s,a){const r=`${this.cameraById(e)?.recorder_id??"nvr-1"}:${this.cameraById(e)?.source_ref??""}:${t}`;if(s.ok){this.replaceStream(e,s.stream),a==="editor"&&(this.editing=null),this.setLine(r,null),s.kind==="undo"?this.showToast(s.rebootRequired?"השינוי בוטל. ה־NVR מבקש הפעלה מחדש.":"השינוי בוטל",s.rebootRequired?{reboot:!0}:{}):s.unchanged||!s.change?this.showToast("ללא שינוי"):this.showToast(s.rebootRequired?"נשמר. ה־NVR מבקש הפעלה מחדש.":"נשמר",{undo:{changeId:s.change.id,cameraId:e,ref:t},...s.rebootRequired?{reboot:!0}:{}});return}s.stream&&this.replaceStream(e,s.stream),a==="row"&&this.setLine(r,s.line.text),s.line.reload&&this.readCamera(e),s.code==="batch_in_progress"&&this.batchEl()?.resume()}onSvc(e,t){const s=t.stream;if(e.target.checked=s?.svc===!0,!s||!t.cameraId||this.isBusy(t)||!this.ctrl("svc",t).enabled)return;const a={svc:s.svc!==!0};this.setLine(t.key,null);const r=qs(t.cameraName,s,a),i=this.batchCandidates();a.svc===!1&&this.data?.can_batch===!0&&i.length>=2&&i.some(n=>n.cameraId===t.cameraId)&&(r.extraLabel="החל גם על מצלמות נוספות"),this.confirm={model:r,cameraId:t.cameraId,ref:s.stream_ref,changes:a}}recorderIds(){return[...new Set((this.data?.cameras??[]).map(e=>e.recorder_id))]}get multiRecorder(){return this.recorderIds().length>1}recorderName(e){return this.recorders.find(t=>t.recorder_id===e)?.name??e}batchRecorder(){return this.multiRecorder&&(this.recorderFilter||this.recorderIds()[0])||null}batchCandidates(){const e=this.data,t=this.batchRecorder();return e?zr(e.cameras,this.details,e.stale).filter(s=>!t||s.recorderId===t):[]}openBatch(){const e=this.confirm;this.confirm=null,e&&this.batchEl()?.openSelect(e.cameraId)}onBatchFinished(e){const t=Nr(e);this.showToast(t.message,t.undo?{batchUndo:e.batch_id,batchMode:e.mode}:{})}async confirmed(){const e=this.confirm;this.confirm=null;const t=e&&this.streamOf(e.cameraId,e.ref);if(!e||!t)return;const s=`${e.cameraId}:${e.ref}`;this.toast=null,this.setBusy(s,!0);const a=await Bs(e.cameraId,t,e.changes);this.setBusy(s,!1),this.applyResult(e.cameraId,e.ref,a,"row")}async undoToast(){const e=this.toast;if(e?.batchUndo&&!e.busy){const i=e.batchUndo;this.toast=null,await this.batchEl()?.undoAll(i);return}if(!e?.undo||e.busy)return;const{changeId:t,cameraId:s,ref:a}=e.undo;this.toast={...e,busy:!0},this.setBusy(`${s}:${a}`,!0);const r=await Vs(t);this.setBusy(`${s}:${a}`,!1),this.toast=null,this.applyResult(s,a,r,"row")}openEditor(e){!e.cameraId||!e.stream||!this.ctrl("edit",e).enabled||this.isBusy(e)||(this.toast=null,this.setLine(e.key,null),this.editing={cameraId:e.cameraId,ref:e.stream.stream_ref})}renderSvc(e){const t=this.ctrl("svc",e),s=e.stream;if(!t.show||!s)return Aa(s);const a=this.isBusy(e),r=`SVC · ${e.cameraName} · ${Y[s.role]}`;return o`<span class="swc ${a?"pending":""}"><sw-toggle data-svc-toggle .checked=${s.svc===!0} ?disabled=${!t.enabled||a} label=${r} labelHidden title=${t.reason||c}
      aria-busy=${a?"true":"false"} @change=${i=>this.onSvc(i,e)}></sw-toggle>${a?o`<span class="spin" role="status" aria-label="שומר" data-pending></span>`:c}</span>`}renderPen(e){const t=this.ctrl("edit",e);return!t.show||!e.stream?c:o`<button type="button" class="pen" data-edit-stream aria-label=${`עריכה · ${e.cameraName} · ${Y[e.stream.role]}`} title=${t.reason||"עריכה"} ?disabled=${!t.enabled||this.isBusy(e)} @click=${()=>this.openEditor(e)}><sw-icon name="edit" size="16"></sw-icon></button>`}renderEditor(){const e=this.editing,t=e?this.cameraById(e.cameraId):null,s=e?this.streamOf(e.cameraId,e.ref):null,a=e?this.details.get(e.cameraId):null,r=s&&a&&a!=="error"?a.options?.[s.stream_ref]??null:null;return o`<nvr-camera-editor ?open=${!!(e&&t&&s&&r)} .camera=${t} .stream=${s} .options=${r}
      @close=${()=>this.editing=null} @written=${i=>e&&this.applyResult(e.cameraId,e.ref,i.detail.result,"editor")}></nvr-camera-editor>`}renderToast(){const e=this.toast;return e?aa(e.n,o`<nvr-undo-toast message=${e.message} actionLabel=${e.batchUndo?e.batchMode==="encoding"?Ms("encoding"):"בטל":e.undo?"בטל":""} linkLabel=${e.reboot?"ל־NVR":""} linkHref=${e.reboot?"#/system/security/nvr":""} ?busy=${!!e.busy}
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
      ${Xt(s)||this.recorderFilter?o`<sw-button size="sm" variant="ghost" data-nvr-clear @click=${()=>{this.filters={...Ze},this.recorderFilter=""}}>נקה</sw-button>`:c}
      ${this.data?.can_write&&this.data.can_batch===!0&&!this.data.stale&&!Ue()?o`<sw-button size="sm" data-nvr-encoding-open ?disabled=${this.batchRunning} title=${this.batchRunning?lt:""} @click=${()=>this.openEncoding()}>שינוי קידוד לכמה מצלמות</sw-button>`:c}
      <sw-button size="sm" icon="refresh" data-nvr-refresh ?disabled=${this.loading} @click=${()=>void this.load()}>רענון</sw-button>
      <span class="count" data-nvr-count>${Xt(s)||this.recorderFilter?`${e} מתוך ${t} זרמים`:`${t} זרמים`}</span>
    </div>`}headerCell(e){const t=this.sort.key===e.sort,s=t?this.sort.dir==="asc"?"ascending":"descending":"none";return o`<th scope="col" class=${e.id==="channel"?"c-chan":""} aria-sort=${s} data-col=${e.id}>
      ${e.sort?o`<button type="button" data-nvr-sort=${e.sort} @click=${()=>this.sort=Fa(this.sort,e.sort)}>${e.label}<span class="arrow" aria-hidden="true">${t?this.sort.dir==="asc"?"▲":"▼":""}</span></button>`:o`<span style="padding:9px 10px;display:inline-block">${e.label}</span>`}
    </th>`}verdict(e){const t=e.stream?.webrtc??"unknown",s=e.stream!==null;return o`<span class="v ${s?t:"unknown"}" role="img" aria-label=${s?Yt[t]:J} title=${s?Yt[t]:""} data-verdict=${s?t:"none"}>${s?t==="ok"?wi:t==="no"?gi:J:J}</span>`}renderRow(e,t){const s=e[t],a=s.stream,r=Ka(e,t),i=this.lines.get(s.key);return o`<tr class="${r?"first":"repeat"} ${s.enabledInArx?"":"off"} ${s.online===!1?"down":""}" data-stream-row data-camera=${s.cameraKey} data-stream=${a?.stream_ref??""}>
      <td class="muted c-chan" data-col="channel"><span class="ltr">${s.channel}</span></td>
      <td data-col="camera"><span class="cam">${s.online===!1?o`<span class="dot" title="לא מקוונת" data-offline></span>`:c}${s.cameraName}</span>${this.multiRecorder?o`<span class="muted" data-nvr-recorder> · ${this.recorderName(s.recorderId)}</span>`:c}<span class="chan muted"> ערוץ <span class="ltr">${s.channel}</span></span></td>
      <td data-col="role">${a?Y[a.role]:o`<span class="muted" data-unread>לא נקרא</span>`}</td>
      <td data-col="codec"><span class="ltr">${this.codecCell(a)}${a?.profile?o` <bdi class="muted">${a.profile}</bdi>`:c}</span></td>
      <td data-col="svc">${this.renderSvc(s)}</td>
      <td data-col="resolution"><bdi class="ltr">${ft(a)}</bdi></td>
      <td data-col="fps"><span class="ltr">${Qt(a)}</span></td>
      <td data-col="bitrate"><span class="ltr"><bdi>${Gt(a)}</bdi>${a?.bitrate_mode&&a.bitrate_kbps?o` <span class="muted">${a.bitrate_mode}</span>`:c}</span></td>
      <td data-col="gop"><span class="ltr">${Jt(a?.gop)}</span></td>
      <td data-col="webrtc">${this.verdict(s)}</td>
      ${this.data?.can_write?o`<td data-col="edit" class="act">${this.renderPen(s)}</td>`:c}
    </tr>${i?o`<tr class="msg" data-row-line-row><td colspan=${_s.length+1} data-nvr-line role="status">${i}</td></tr>`:c}`}codecCell(e){return Ia(e)?o`<bdi class="h265" data-h265-badge title=${It} aria-label=${`${Re(e)} · ${It}`}>${Re(e)}</bdi>`:o`<bdi>${Re(e)}</bdi>`}renderCard(e){const t=e.stream;return o`<div class="card ${e.enabledInArx?"":"off"} ${e.online===!1?"down":""}" data-stream-card data-camera=${e.cameraKey} data-stream=${t?.stream_ref??""}>
      <div class="head"><span class="cam">${e.online===!1?o`<span class="dot" title="לא מקוונת"></span>`:c}${e.cameraName}</span>${this.multiRecorder?o`<span class="muted" data-nvr-recorder>${this.recorderName(e.recorderId)}</span>`:c}<span class="muted">ערוץ <span class="ltr">${e.channel}</span></span><span style="margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px">${this.verdict(e)}${this.renderPen(e)}</span></div>
      ${t?o`<div class="line"><span>${Y[t.role]}</span><span class="ltr">${this.codecCell(t)}</span><bdi class="ltr">${ft(t)}</bdi><span class="ltr">${Qt(t)}</span></div>
          <div class="line facts"><span class="svcline">SVC ${this.renderSvc(e)}</span><bdi class="ltr">${Gt(t)}${t.bitrate_mode&&t.bitrate_kbps?` ${t.bitrate_mode}`:""}</bdi><span>GOP <span class="ltr">${Jt(t.gop)}</span></span>${t.profile?o`<bdi class="ltr muted">${t.profile}</bdi>`:c}</div>`:o`<div class="line muted" data-unread>לא נקרא</div>`}
      ${this.lines.get(e.key)?o`<div class="msgline" data-nvr-line role="status">${this.lines.get(e.key)}</div>`:c}
    </div>`}renderBody(){const e=this.data;if(!e)return c;const t=Pa(e.cameras),s=this.multiRecorder?this.recorderFilter:"",a=Ha(Va(s?t.filter(n=>n.recorderId===s):t,this.filters),this.sort),r=ja(t),i=t.length?a.length?o`<div class="wrap" data-nvr-table>
              <table>
                <thead><tr>${_s.map(n=>this.headerCell(n))}${e.can_write?o`<th scope="col" data-col="edit"><span class="vh">עריכה</span></th>`:c}</tr></thead>
                <tbody>${a.map((n,l)=>this.renderRow(a,l))}</tbody>
              </table>
            </div>
            <div class="cards" data-nvr-cards>${a.map(n=>this.renderCard(n))}</div>`:o`<sw-state-panel icon="filter" state="empty" heading="אין זרמים שמתאימים לסינון." actionLabel="נקה סינון" data-nvr-no-match @action=${()=>this.filters={...Ze}}></sw-state-panel>`:o`<sw-state-panel icon="camera" state="empty" heading="לא נמצאו מצלמות ב־NVR." actionLabel="רענן" data-nvr-empty @action=${()=>void this.load()}></sw-state-panel>`;return o`
      ${this.batchRunning&&this.batch?this.renderStrip(this.batch):c}
      ${e.stale?o`<div class="note" data-nvr-stale role="status"><span>${vs}</span><sw-button size="sm" data-nvr-retry ?disabled=${this.loading} @click=${()=>void this.load()}>נסה שוב</sw-button></div>`:c}
      ${t.length?this.renderToolbar(a.length,r.streams):c}
      ${i}`}renderStrip(e){const t=Xe(e);return o`<div class="note" data-nvr-batch-strip role="status"><span data-nvr-batch-strip-text>${lt} · <span class="ltr">${t.processed}</span> מתוך <span class="ltr">${t.total}</span></span><sw-button size="sm" data-nvr-batch-show @click=${()=>this.batchEl()?.show()}>הצג</sw-button></div>`}renderBatch(){const e=this.data;return e?.can_write?o`<nvr-camera-batch .candidates=${this.batchCandidates()} .info=${this.cameraInfo()} .streams=${this.streamRoles()}
      @batch-change=${t=>this.batch=t.detail.batch}
      @batch-finished=${t=>this.onBatchFinished(t.detail.batch)}
      @batch-refresh=${()=>void this.load()}
      @verify-report=${t=>this.openReport(t.detail.batchId)}
      @encoding-open=${()=>this.openEncoding()}></nvr-camera-batch>
      ${e.can_batch===!0?o`<nvr-encoding-batch .rows=${jr(e.cameras,this.details,e.stale)} .details=${this.details}
            @verify-reports=${()=>this.openReport(null)}
            @encoding-started=${t=>void this.batchEl()?.followBatch(t.detail.batch)}></nvr-encoding-batch>
          <nvr-verify-report .info=${this.cameraInfo()} .streams=${this.streamRoles()}></nvr-verify-report>`:c}`:c}subheading(){if(this.multiRecorder)return this.recorderFilter?this.recorderName(this.recorderFilter):`${this.recorderIds().length} מקליטים`;const e=this.recorder;return e?[e.name,e.model].filter(Boolean).join(" · "):""}render(){const e=this.failure;let t;return this.loading&&!this.data?t=o`<sw-state-panel state="loading" data-nvr-loading></sw-state-panel>`:e?.status===403?t=o`<sw-state-panel state="forbidden" data-nvr-forbidden></sw-state-panel>`:e?.code==="nvr_not_configured"?t=o`<sw-state-panel icon="camera" state="empty" heading="אין NVR מחובר" actionLabel="לחיבורים" data-nvr-none @action=${()=>window.location.hash="#/system/setup"}></sw-state-panel>`:e?t=o`<sw-state-panel state="error" heading="ה־NVR אינו זמין." hint=${e.status===503?"":e.message} actionLabel="נסה שוב" data-nvr-error @action=${()=>void this.load()}></sw-state-panel>`:t=this.renderBody(),o`<sw-page crumbs="הגדרות | אבטחה" heading="הגדרות מצלמות" subheading=${this.subheading()}><div data-nvr-cameras data-state=${this.loading&&!this.data?"loading":e?"error":this.data?.stale?"stale":"ready"} style="display:contents">${t}</div></sw-page>
      ${this.data?.can_write?this.renderEditor():c}
      ${this.renderBatch()}
      <nvr-confirm .model=${this.confirm?.model??null} @confirm=${()=>void this.confirmed()} @cancel=${()=>this.confirm=null} @extra=${()=>this.openBatch()}></nvr-confirm>
      ${this.renderToast()}`}};E.styles=[Z`
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
  `,Ne];A([d()],E.prototype,"data",2);A([d()],E.prototype,"recorder",2);A([d()],E.prototype,"recorders",2);A([d()],E.prototype,"recorderFilter",2);A([d()],E.prototype,"loading",2);A([d()],E.prototype,"failure",2);A([d()],E.prototype,"filters",2);A([d()],E.prototype,"sort",2);A([d()],E.prototype,"details",2);A([d()],E.prototype,"busy",2);A([d()],E.prototype,"lines",2);A([d()],E.prototype,"confirm",2);A([d()],E.prototype,"editing",2);A([d()],E.prototype,"toast",2);A([d()],E.prototype,"batch",2);E=A([U("system-security-cameras")],E);const ct=encodeURIComponent,ze={readMask:e=>D(`cameras/${ct(e)}/privacy-mask`),previewMasks:e=>V("nvr/privacy-masks/preview",{items:e}),applyMasks:e=>V("nvr/privacy-masks/apply",{items:e,confirm:!0}),changes:(e,t=20)=>D(`nvr/changes?camera_id=${ct(e)}&limit=${t}`),undoChange:e=>V(`nvr/changes/${ct(e)}/rollback`,{confirm:!0})},Et={tab:"מסכות פרטיות",crumbs:"הגדרות | אבטחה",heading:"מסכות פרטיות",cameras:"מצלמות",camera_edited:"נערכה",snapshot_alt:"תמונה מהמצלמה {name}",no_picture:"אין תמונה מהמצלמה",mask_on:"מסכה פעילה",add_region:"הוספת אזור",delete_region:"מחיקת אזור",discard:"ביטול השינויים",region_n:"אזור {n}",region_poly:"אזור {n} (צורה חופשית)",regions_count:"{n} מתוך {max} אזורים",region_keys:"חצים מזיזים. Shift וחצים משנים גודל. Delete מוחק.",corner:"פינה {name}",corner_tl:"שמאלית עליונה",corner_tr:"ימנית עליונה",corner_bl:"שמאלית תחתונה",corner_br:"ימנית תחתונה",review:"בדיקת השינויים ({n})",reviewing:"קורא את המצלמות…",back:"חזרה לעריכה",next:"המשך לאישור",write:"כתיבה ל־NVR",cancel:"ביטול",preview_title:"לפני ואחרי",before:"לפני",after:"אחרי",st_ready:"ייכתב",st_unchanged:"ללא שינוי",st_invalid:"לא תקין",st_skipped:"לא ייכתב",confirm_title:"כתיבת מסכות פרטיות",confirm_lead:"המסכה מכסה את התמונה בצפייה החיה ובהקלטה. הכתיבה נשלחת רק עכשיו, פעם אחת.",confirm_count:"{n} מצלמות ייכתבו",confirm_count_one:"מצלמה אחת תיכתב",applying:"כותב…",result_title:"תוצאות הכתיבה",res_applied:"נכתב ואומת",res_unchanged:"ללא שינוי",res_skipped:"לא נכתב",res_failed:"הכתיבה נכשלה",res_not_attempted:"לא נוסה",restored:"המקור הוחזר",not_restored:"המקור לא אומת, יש לבדוק במצלמה",undo:"ביטול הכתיבה",undoing:"מחזיר…",undone:"הוחזר למצב הקודם",done:"סיום",log_title:"היסטוריית שינויים",log_empty:"עדיין לא נכתבו מסכות במצלמה הזו",log_applied:"נכתב",log_rolled_back:"בוטל",log_failed:"נכשל",log_diverged:"לא אומת",log_other:"אחר",off_switch:"כתיבת מסכות פרטיות כבויה בהגדרות המערכת, ולכן אפשר רק לצפות. מנהל מערכת יכול להפעיל אותה.",off_perm:"אין לך הרשאה לשנות מסכות פרטיות, ולכן אפשר רק לצפות.",off_remote:"מסכות פרטיות משתנות רק ברשת המקומית, ולכן אפשר רק לצפות.",loading:"טוען",retry:"נסו שוב",err_cameras:"רשימת המצלמות לא נטענה",err_mask:"המסכה של המצלמה לא נקראה",forbidden:"אין הרשאה לצפות במסכות פרטיות",empty_cameras:"אין מצלמות לעריכה",inv_need_region:"מסכה פעילה צריכה לפחות אזור אחד",inv_too_many:"מותרים עד {max} אזורים",inv_too_small:"אזור קטן מדי",e_feature_disabled:"כתיבת מסכות פרטיות כבויה בהגדרות המערכת.",e_forbidden:"אין הרשאה לפעולה הזו.",e_stale:"המסכה במצלמה השתנתה מאז הבדיקה. יש לבדוק שוב.",e_validation:"המסכה אינה תקינה למצלמה הזו.",e_nvr_not_supported:"המצלמה אינה תומכת במסכות פרטיות.",e_source_forbidden:"המצלמה אינה זמינה לכתיבה.",e_changed_since:"המסכה במצלמה שונתה מאז, ולכן אין החזרה אוטומטית.",e_not_rollbackable:"אי אפשר להחזיר את השינוי הזה.",e_nvr_verify_mismatch:"ההחזרה לא אומתה. יש לבדוק את המצלמה.",e_generic:"הפעולה נכשלה. לא נשלח דבר נוסף.",sw_label:"כתיבת מסכות פרטיות ל-NVR",sw_confirm:"שום דבר לא נכתב לפני לחיצה על כפתור הכתיבה בכל פעם.",sw_turn_on:"הפעלה",sw_saving:"שומר…",sw_err:"השינוי לא נשמר. נסו שוב."},bi={tab:"Privacy masks",crumbs:"Settings | Security",heading:"Privacy masks",cameras:"Cameras",camera_edited:"edited",snapshot_alt:"Picture from camera {name}",no_picture:"No picture from the camera",mask_on:"Mask on",add_region:"Add region",delete_region:"Delete region",discard:"Discard changes",region_n:"Region {n}",region_poly:"Region {n} (free shape)",regions_count:"{n} of {max} regions",region_keys:"Arrow keys move. Shift with arrows resizes. Delete removes.",corner:"Corner {name}",corner_tl:"top left",corner_tr:"top right",corner_bl:"bottom left",corner_br:"bottom right",review:"Review changes ({n})",reviewing:"Reading the cameras…",back:"Back to editing",next:"Continue to confirm",write:"Write to NVR",cancel:"Cancel",preview_title:"Before and after",before:"Before",after:"After",st_ready:"Will be written",st_unchanged:"No change",st_invalid:"Not valid",st_skipped:"Will not be written",confirm_title:"Write privacy masks",confirm_lead:"A mask covers the picture in live view and in the recording. The write is sent now, once.",confirm_count:"{n} cameras will be written",confirm_count_one:"One camera will be written",applying:"Writing…",result_title:"Write results",res_applied:"Written and verified",res_unchanged:"No change",res_skipped:"Not written",res_failed:"Write failed",res_not_attempted:"Not attempted",restored:"Original restored",not_restored:"Original not verified, check the camera",undo:"Undo write",undoing:"Restoring…",undone:"Restored to the previous state",done:"Done",log_title:"Change history",log_empty:"No masks written on this camera yet",log_applied:"Written",log_rolled_back:"Undone",log_failed:"Failed",log_diverged:"Not verified",log_other:"Other",off_switch:"Writing privacy masks is turned off in system settings, so this page is view only. A system administrator can turn it on.",off_perm:"You do not have permission to change privacy masks, so this page is view only.",off_remote:"Privacy masks can only be changed on the local network, so this page is view only.",loading:"Loading",retry:"Try again",err_cameras:"The camera list did not load",err_mask:"The camera mask could not be read",forbidden:"You do not have permission to view privacy masks",empty_cameras:"No cameras to edit",inv_need_region:"An active mask needs at least one region",inv_too_many:"Up to {max} regions are allowed",inv_too_small:"A region is too small",e_feature_disabled:"Writing privacy masks is turned off in system settings.",e_forbidden:"You do not have permission for this action.",e_stale:"The mask on the camera changed since the review. Review again.",e_validation:"The mask is not valid for this camera.",e_nvr_not_supported:"The camera does not support privacy masks.",e_source_forbidden:"The camera cannot be written to.",e_changed_since:"The mask on the camera changed since, so there is no automatic undo.",e_not_rollbackable:"This change cannot be undone.",e_nvr_verify_mismatch:"The restore was not verified. Check the camera.",e_generic:"The action failed. Nothing else was sent.",sw_label:"Write privacy masks to the NVR",sw_confirm:"Nothing is written until you press the write button each time.",sw_turn_on:"Turn on",sw_saving:"Saving…",sw_err:"The change was not saved. Try again."},vi={tab:"أقنعة الخصوصية",crumbs:"الإعدادات | الأمان",heading:"أقنعة الخصوصية",cameras:"الكاميرات",camera_edited:"تم التعديل",snapshot_alt:"صورة من الكاميرا {name}",no_picture:"لا توجد صورة من الكاميرا",mask_on:"القناع مفعّل",add_region:"إضافة منطقة",delete_region:"حذف المنطقة",discard:"تجاهل التغييرات",region_n:"المنطقة {n}",region_poly:"المنطقة {n} (شكل حر)",regions_count:"{n} من {max} مناطق",region_keys:"مفاتيح الأسهم تحرّك. Shift مع الأسهم يغيّر الحجم. Delete يحذف.",corner:"الزاوية {name}",corner_tl:"العلوية اليسرى",corner_tr:"العلوية اليمنى",corner_bl:"السفلية اليسرى",corner_br:"السفلية اليمنى",review:"مراجعة التغييرات ({n})",reviewing:"جارٍ قراءة الكاميرات…",back:"العودة إلى التحرير",next:"المتابعة إلى التأكيد",write:"الكتابة إلى NVR",cancel:"إلغاء",preview_title:"قبل وبعد",before:"قبل",after:"بعد",st_ready:"ستتم الكتابة",st_unchanged:"بدون تغيير",st_invalid:"غير صالح",st_skipped:"لن تتم الكتابة",confirm_title:"كتابة أقنعة الخصوصية",confirm_lead:"يغطي القناع الصورة في العرض المباشر وفي التسجيل. تُرسل الكتابة الآن مرة واحدة.",confirm_count:"ستتم الكتابة إلى {n} كاميرات",confirm_count_one:"ستتم الكتابة إلى كاميرا واحدة",applying:"جارٍ الكتابة…",result_title:"نتائج الكتابة",res_applied:"تمت الكتابة والتحقق",res_unchanged:"بدون تغيير",res_skipped:"لم تتم الكتابة",res_failed:"فشلت الكتابة",res_not_attempted:"لم تتم المحاولة",restored:"تمت استعادة الأصل",not_restored:"لم يتم التحقق من الأصل، افحص الكاميرا",undo:"التراجع عن الكتابة",undoing:"جارٍ الاستعادة…",undone:"تمت الاستعادة إلى الحالة السابقة",done:"إنهاء",log_title:"سجل التغييرات",log_empty:"لم تُكتب أقنعة على هذه الكاميرا بعد",log_applied:"تمت الكتابة",log_rolled_back:"تم التراجع",log_failed:"فشل",log_diverged:"لم يتم التحقق",log_other:"أخرى",off_switch:"كتابة أقنعة الخصوصية متوقفة في إعدادات النظام، لذلك الصفحة للعرض فقط. يمكن لمسؤول النظام تفعيلها.",off_perm:"ليست لديك صلاحية تغيير أقنعة الخصوصية، لذلك الصفحة للعرض فقط.",off_remote:"لا يمكن تغيير أقنعة الخصوصية إلا من الشبكة المحلية، لذلك الصفحة للعرض فقط.",loading:"جارٍ التحميل",retry:"حاول مرة أخرى",err_cameras:"تعذّر تحميل قائمة الكاميرات",err_mask:"تعذّرت قراءة قناع الكاميرا",forbidden:"ليست لديك صلاحية عرض أقنعة الخصوصية",empty_cameras:"لا توجد كاميرات للتحرير",inv_need_region:"القناع المفعّل يحتاج إلى منطقة واحدة على الأقل",inv_too_many:"يُسمح بحتى {max} مناطق",inv_too_small:"منطقة صغيرة جدًا",e_feature_disabled:"كتابة أقنعة الخصوصية متوقفة في إعدادات النظام.",e_forbidden:"ليست لديك صلاحية لهذا الإجراء.",e_stale:"تغيّر القناع في الكاميرا منذ المراجعة. راجع مرة أخرى.",e_validation:"القناع غير صالح لهذه الكاميرا.",e_nvr_not_supported:"الكاميرا لا تدعم أقنعة الخصوصية.",e_source_forbidden:"لا يمكن الكتابة إلى الكاميرا.",e_changed_since:"تغيّر القناع في الكاميرا منذ ذلك الحين، لذلك لا يوجد تراجع تلقائي.",e_not_rollbackable:"لا يمكن التراجع عن هذا التغيير.",e_nvr_verify_mismatch:"لم يتم التحقق من الاستعادة. افحص الكاميرا.",e_generic:"فشل الإجراء. لم يُرسل أي شيء آخر.",sw_label:"كتابة أقنعة الخصوصية إلى NVR",sw_confirm:"لا يُكتب شيء قبل الضغط على زر الكتابة في كل مرة.",sw_turn_on:"تشغيل",sw_saving:"جارٍ الحفظ…",sw_err:"لم يتم حفظ التغيير. حاول مرة أخرى."},_i={tab:"Маски приватности",crumbs:"Настройки | Безопасность",heading:"Маски приватности",cameras:"Камеры",camera_edited:"изменена",snapshot_alt:"Изображение с камеры {name}",no_picture:"Нет изображения с камеры",mask_on:"Маска включена",add_region:"Добавить область",delete_region:"Удалить область",discard:"Отменить изменения",region_n:"Область {n}",region_poly:"Область {n} (произвольная форма)",regions_count:"{n} из {max} областей",region_keys:"Стрелки перемещают. Shift со стрелками меняет размер. Delete удаляет.",corner:"Угол: {name}",corner_tl:"левый верхний",corner_tr:"правый верхний",corner_bl:"левый нижний",corner_br:"правый нижний",review:"Проверить изменения ({n})",reviewing:"Чтение камер…",back:"Назад к редактированию",next:"Перейти к подтверждению",write:"Записать в NVR",cancel:"Отмена",preview_title:"До и после",before:"До",after:"После",st_ready:"Будет записано",st_unchanged:"Без изменений",st_invalid:"Недопустимо",st_skipped:"Не будет записано",confirm_title:"Запись масок приватности",confirm_lead:"Маска закрывает изображение в живом просмотре и в записи. Запись отправляется сейчас, один раз.",confirm_count:"Будет записано камер: {n}",confirm_count_one:"Будет записана одна камера",applying:"Запись…",result_title:"Результаты записи",res_applied:"Записано и проверено",res_unchanged:"Без изменений",res_skipped:"Не записано",res_failed:"Запись не удалась",res_not_attempted:"Не выполнялось",restored:"Оригинал восстановлен",not_restored:"Оригинал не подтверждён, проверьте камеру",undo:"Отменить запись",undoing:"Восстановление…",undone:"Возвращено прежнее состояние",done:"Готово",log_title:"История изменений",log_empty:"На этой камере маски ещё не записывались",log_applied:"Записано",log_rolled_back:"Отменено",log_failed:"Ошибка",log_diverged:"Не подтверждено",log_other:"Другое",off_switch:"Запись масок приватности выключена в настройках системы, поэтому страница только для просмотра. Включить её может администратор системы.",off_perm:"У вас нет права изменять маски приватности, поэтому страница только для просмотра.",off_remote:"Маски приватности меняются только в локальной сети, поэтому страница только для просмотра.",loading:"Загрузка",retry:"Повторить",err_cameras:"Список камер не загрузился",err_mask:"Не удалось прочитать маску камеры",forbidden:"Нет права просматривать маски приватности",empty_cameras:"Нет камер для редактирования",inv_need_region:"Включённой маске нужна хотя бы одна область",inv_too_many:"Допускается не более {max} областей",inv_too_small:"Область слишком мала",e_feature_disabled:"Запись масок приватности выключена в настройках системы.",e_forbidden:"Нет права на это действие.",e_stale:"Маска на камере изменилась после проверки. Проверьте снова.",e_validation:"Маска недопустима для этой камеры.",e_nvr_not_supported:"Камера не поддерживает маски приватности.",e_source_forbidden:"В камеру нельзя записывать.",e_changed_since:"Маска на камере с тех пор изменилась, автоматического возврата нет.",e_not_rollbackable:"Это изменение нельзя отменить.",e_nvr_verify_mismatch:"Восстановление не подтверждено. Проверьте камеру.",e_generic:"Действие не удалось. Больше ничего не отправлено.",sw_label:"Запись масок приватности в NVR",sw_confirm:"Ничего не записывается, пока вы каждый раз не нажмёте кнопку записи.",sw_turn_on:"Включить",sw_saving:"Сохранение…",sw_err:"Изменение не сохранено. Повторите попытку."},yi={he:Et,en:bi,ar:vi,ru:_i};function Qs(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}function u(e,t,s=Qs()){const a=yi[s][e]??Et[e]??e;return t?a.replace(/\{(\w+)\}/g,(r,i)=>i in t?String(t[i]):r):a}function xe(e,t=Qs()){const s=`e_${e}`;return s in Et?u(s,void 0,t):u("e_generic",void 0,t)}const L=4,dt={width:704,height:576},Gs=e=>[[e.x,e.y],[e.x+e.w,e.y],[e.x+e.w,e.y+e.h],[e.x,e.y+e.h]];function xi(e){if(e.length!==4)return null;const t=[...new Set(e.map(n=>n[0]))],s=[...new Set(e.map(n=>n[1]))];if(t.length!==2||s.length!==2||new Set(e.map(n=>`${n[0]},${n[1]}`)).size!==4)return null;const r=Math.min(...t),i=Math.min(...s);return{x:r,y:i,w:Math.max(...t)-r,h:Math.max(...s)-i}}let ki=0;const xt=()=>`r${++ki}`;function $i(e,t){return{enabled:e,regions:t.map(s=>({key:xt(),rect:xi(s.points),points:s.points.map(a=>[a[0],a[1]])}))}}const zi=e=>({enabled:e.enabled,regions:e.regions.map(t=>({key:t.key,rect:t.rect?{...t.rect}:null,points:t.points.map(s=>[...s])}))}),ie=(e,t,s)=>Math.min(s,Math.max(t,e));function Ct(e,t){const s=ie(Math.round(e.w),L,t.width),a=ie(Math.round(e.h),L,t.height);return{x:ie(Math.round(e.x),0,t.width-s),y:ie(Math.round(e.y),0,t.height-a),w:s,h:a}}const Si=(e,t=!1)=>({x:Math.max(1,Math.round(e.width/(t?10:100))),y:Math.max(1,Math.round(e.height/(t?10:100)))}),Ri=e=>e==="ArrowLeft"||e==="ArrowRight"||e==="ArrowUp"||e==="ArrowDown";function Ti(e,t,s,a,r=!1){const i=Si(a,r),n=t==="ArrowLeft"?-i.x:t==="ArrowRight"?i.x:0,l=t==="ArrowUp"?-i.y:t==="ArrowDown"?i.y:0;return Ct(s?{...e,w:e.w+n,h:e.h+l}:{...e,x:e.x+n,y:e.y+l},a)}function Oi(e,t,s,a,r){const i=t==="tl"||t==="bl",n=t==="tl"||t==="tr",l=i?e.x+e.w:e.x,h=n?e.y+e.h:e.y,p=ie(Math.round(s),0,r.width),w=ie(Math.round(a),0,r.height);let m=Math.min(l,p),$=Math.max(l,p),z=Math.min(h,w),N=Math.max(h,w);return $-m<L&&(p<l?(m=Math.max(0,l-L),$=m+L):($=Math.min(r.width,l+L),m=$-L)),N-z<L&&(w<h?(z=Math.max(0,h-L),N=z+L):(N=Math.min(r.height,h+L),z=N-L)),{x:m,y:z,w:$-m,h:N-z}}function ys(e,t,s,a,r){const i=ie(Math.round(Math.min(e,s)),0,r.width),n=ie(Math.round(Math.max(e,s)),0,r.width),l=ie(Math.round(Math.min(t,a)),0,r.height),h=ie(Math.round(Math.max(t,a)),0,r.height);return n-i>=L&&h-l>=L?{x:i,y:l,w:n-i,h:h-l}:null}function Ei(e,t){const s=Math.round(e.width/5),a=Math.round(e.height/5),r=t%5*Math.round(e.width/25);return Ct({x:Math.round((e.width-s)/2)+r,y:Math.round((e.height-a)/2)+r,w:s,h:a},e)}const Ci=e=>JSON.stringify(e.map(t=>[t[0],t[1]]).sort((t,s)=>t[0]-s[0]||t[1]-s[1])),xs=e=>e.map(t=>Ci(t.points)).sort();function Mi(e,t){return e.enabled===t.enabled&&JSON.stringify(xs(e.regions))===JSON.stringify(xs(t.regions))}const Ni=e=>e.rect?Gs(e.rect):e.points,ks=e=>({enabled:e.enabled,regions:e.regions.map(t=>({points:Ni(t)}))}),Li=(e,t)=>!Mi(ks(e),ks(t));function Pi(e,t,s){if(e.regions.length>t)return"too_many";if(e.enabled&&e.regions.length===0)return"need_region";for(const a of e.regions)if(a.rect&&(a.rect.w<L||a.rect.h<L||a.rect.x<0||a.rect.y<0||a.rect.x+a.rect.w>s.width||a.rect.y+a.rect.h>s.height))return"too_small";return null}function $s(e,t,s){return{camera_id:e,enabled:t.enabled,regions:t.regions.map(a=>({points:a.rect?Gs(a.rect):a.points})),...s?{etag:s}:{}}}function zs(e,t){const s=(a,r)=>`${(a/r*100).toFixed(3)}%`;return{left:s(e.x,t.width),top:s(e.y,t.height),width:s(e.w,t.width),height:s(e.h,t.height)}}const Ss=e=>e.map(t=>`${t[0]},${t[1]}`).join(" "),Rs=e=>(e?.regions??[]).map(t=>t.points);function Ii(e){const t=e.find(s=>s.kind==="privacy_mask");return t&&t.status==="applied"&&!t.rollback_of?t:null}var Ai=Object.defineProperty,qi=Object.getOwnPropertyDescriptor,_=(e,t,s,a)=>{for(var r=a>1?void 0:a?qi(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&Ai(t,s,r),r};const Bi=["tl","tr","bl","br"];let b=class extends K{constructor(){super(...arguments),this.cameras=null,this.failure=null,this.loading=!0,this.selected="",this.loaded=new Map,this.drafts=new Map,this.regionKey="",this.step="edit",this.preview=null,this.previewing=!1,this.confirmOpen=!1,this.applying=!1,this.applied=null,this.line="",this.ghost=null,this.history=null,this.undoing="",this.undone=new Set,this.brokenShot=new Set,this.switchOn=null,this.switchAsk=!1,this.switchBusy=!1,this.switchErr=!1,this.avail=0,this.drag=null,this.onResize=()=>this.measure(),this.addRegion=()=>{this.edit((e,t)=>{const s=this.cur;if(!s||e.regions.length>=s.view.max_regions)return;const a=xt();e.regions.push({key:a,rect:Ei(t,e.regions.length),points:[]}),e.enabled||(e.enabled=!0),this.regionKey=a}),this.updateComplete.then(()=>this.shadowRoot?.querySelector(`[data-pm-region="${this.regionKey}"]`)?.focus())},this.discard=()=>{const e=new Map(this.drafts);e.delete(this.selected),this.drafts=e,this.regionKey=""},this.toggleMask=()=>{this.edit(e=>{e.enabled=!e.enabled})},this.review=async()=>{if(this.canReview){this.previewing=!0,this.line="";try{const e=[...this.drafts.entries()].map(([t,s])=>$s(t,s));this.preview=await ze.previewMasks(e),this.step="review"}catch(e){this.line=xe(e instanceof v?e.code:"generic")}finally{this.previewing=!1}}},this.backToEdit=()=>{this.preview=null,this.confirmOpen=!1,this.step="edit"},this.write=async()=>{if(this.applying||!this.preview)return;const e=this.readyRows;if(e.length){this.applying=!0,this.line="";try{const t=e.map(a=>{const r=this.drafts.get(a.camera_id);return $s(a.camera_id,r,a.etag)});this.applied=await ze.applyMasks(t),this.confirmOpen=!1,this.step="done";const s=new Map(this.drafts);for(const a of this.applied.results)(a.status==="applied"||a.status==="unchanged")&&s.delete(a.camera_id);this.drafts=s;for(const a of this.applied.results)a.status==="applied"&&this.loadMask(a.camera_id,!0);this.loadHistory(this.selected)}catch(t){this.confirmOpen=!1,this.line=xe(t instanceof v?t.code:"generic"),this.step="edit",this.preview=null}finally{this.applying=!1}}},this.undo=async(e,t)=>{if(!this.undoing){this.undoing=e,this.line="";try{await ze.undoChange(e);const s=new Set(this.undone);s.add(e),this.undone=s;const a=new Map(this.drafts);a.delete(t),this.drafts=a,await this.loadMask(t,!0),this.selected===t&&this.loadHistory(t)}catch(s){this.line=xe(s instanceof v?s.code:"generic")}finally{this.undoing=""}}},this.finish=()=>{this.applied=null,this.preview=null,this.step="edit",this.loadHistory(this.selected)}}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),this.loadCameras(),this.loadSwitch()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize)}updated(){this.measure()}measure(){const e=this.shadowRoot?.querySelector("[data-pm-layout]");if(!e)return;let t=null;for(let r=e.parentNode;r;r=r instanceof ShadowRoot?r.host:r.parentNode)if(r instanceof Element){const i=getComputedStyle(r).overflowY;if((i==="auto"||i==="scroll")&&r.scrollHeight>r.clientHeight){t=r;break}}const s=e.getBoundingClientRect().top+(t?t.scrollTop:window.scrollY),a=Math.round(window.innerHeight-s-24);Math.abs(a-this.avail)>2&&(this.avail=a)}async loadSwitch(){if(!(!de()||Ue()||!Ye("system.configure")))try{const e=await ra();this.switchOn=e.can_edit===!1?null:e.settings["nvr.privacy_mask_write"]==="true"}catch{this.switchOn=null}}async saveSwitch(e){if(!this.switchBusy){this.switchBusy=!0,this.switchErr=!1;try{const t=await ia({"nvr.privacy_mask_write":e?"true":"false"});this.switchOn=(t.settings?.["nvr.privacy_mask_write"]??(e?"true":"false"))==="true",this.switchAsk=!1}catch{this.switchErr=!0}finally{this.switchBusy=!1}}}onSwitch(){this.switchBusy||this.switchOn===null||(this.switchOn?this.saveSwitch(!1):(this.switchErr=!1,this.switchAsk=!this.switchAsk))}renderSwitch(){return this.switchOn===null||this.step!=="edit"?c:o`<div class="swrow" data-pm-switch-row>
      <button type="button" class="sw-switch" role="switch" aria-checked=${this.switchOn?"true":"false"} data-pm-switch ?disabled=${this.switchBusy||this.applying} @click=${this.onSwitch}><span class="track" aria-hidden="true"></span>${u("sw_label")}</button>
      ${this.switchAsk&&!this.switchOn?o`<div class="ask" data-pm-switch-ask role="group"><span>${u("sw_confirm")}</span>
            <sw-button size="lg" variant="ghost" data-pm-switch-cancel ?disabled=${this.switchBusy} @click=${()=>this.switchAsk=!1}>${u("cancel")}</sw-button>
            <sw-button size="lg" variant="primary" data-pm-switch-confirm ?disabled=${this.switchBusy} @click=${()=>void this.saveSwitch(!0)}>${this.switchBusy?u("sw_saving"):u("sw_turn_on")}</sw-button></div>`:c}
      ${this.switchErr?o`<span class="err" data-pm-switch-err role="alert">${u("sw_err")}</span>`:c}
    </div>`}async loadCameras(){this.loading=!0;try{if(!de()){this.cameras=[],this.failure=null;return}const e=await ge().cameras();this.cameras=e.cameras.filter(t=>!!t.camera_id),this.failure=null,this.cameras.length&&!this.selected&&this.select(this.cameras[0].camera_id)}catch(e){this.cameras=null,this.failure={status:e instanceof v?e.status:0,code:e instanceof v?e.code:"network"}}finally{this.loading=!1}}async loadMask(e,t=!1){if(!t&&this.loaded.get(e)&&this.loaded.get(e)!=="error")return;const s=new Map(this.loaded);s.set(e,"loading"),this.loaded=s;try{const a=await ze.readMask(e),r=a.normalized?.width&&a.normalized?.height?{width:a.normalized.width,height:a.normalized.height}:dt,i=new Map(this.loaded);i.set(e,{view:a,original:$i(a.enabled,a.regions),frame:r,shot:Date.now()}),this.loaded=i}catch{const a=new Map(this.loaded);a.set(e,"error"),this.loaded=a}}async loadHistory(e){this.history=null;try{const t=await ze.changes(e,20);this.selected===e&&(this.history=t.changes.filter(s=>s.kind==="privacy_mask"))}catch{this.selected===e&&(this.history=[])}}async select(e){this.selected=e,this.regionKey="",this.line="",this.history=null,await this.loadMask(e),this.loadHistory(e)}get cur(){const e=this.loaded.get(this.selected);return e&&e!=="error"&&e!=="loading"?e:null}draftFor(e){const t=this.loaded.get(e);return!t||t==="error"||t==="loading"?null:this.drafts.get(e)??t.original}get lock(){const e=this.cur;return e?Ue()?"off_remote":e.view.can_write?this.switchOn??e.view.write_enabled?"":"off_switch":"off_perm":""}edit(e){const t=this.cur;if(!t||this.lock)return;const s=zi(this.drafts.get(this.selected)??t.original);e(s,t.frame);const a=new Map(this.drafts);Li(t.original,s)?a.set(this.selected,s):a.delete(this.selected),this.drafts=a}invalidFor(e){const t=this.loaded.get(e),s=this.drafts.get(e);return!t||t==="error"||t==="loading"||!s?null:Pi(s,t.view.max_regions,t.frame)}nameOf(e){return this.cameras?.find(t=>t.camera_id===e)?.name??e}deleteRegion(e){const t=this.draftFor(this.selected),s=t?t.regions.findIndex(r=>r.key===e):-1;this.edit(r=>{r.regions=r.regions.filter(i=>i.key!==e)});const a=this.draftFor(this.selected);this.regionKey=a&&a.regions.length?a.regions[Math.min(s,a.regions.length-1)].key:"",this.updateComplete.then(()=>{(this.regionKey?this.shadowRoot?.querySelector(`[data-pm-region="${this.regionKey}"]`):this.shadowRoot?.querySelector("[data-pm-add]")?.shadowRoot?.querySelector("button"))?.focus()})}setRect(e,t){this.edit(s=>{const a=s.regions.find(r=>r.key===e);a&&(a.rect=t)})}framePoint(e){const t=this.cur,s=this.shadowRoot?.querySelector("[data-pm-frame]");if(!t||!s)return null;const a=s.getBoundingClientRect();return!a.width||!a.height?null:{x:(e.clientX-a.left)/a.width*t.frame.width,y:(e.clientY-a.top)/a.height*t.frame.height}}onFrameDown(e){const t=this.cur;if(!t||this.lock||e.button!==0||e.pointerType==="touch"||e.target.closest("[data-pm-region],[data-pm-handle]"))return;const s=this.draftFor(this.selected);if(!s||s.regions.length>=t.view.max_regions)return;const a=this.framePoint(e);a&&(e.currentTarget.setPointerCapture(e.pointerId),this.drag={kind:"draw",key:"",px:a.x,py:a.y,rect:null},this.regionKey="")}onRegionDown(e,t,s){if(this.lock||e.button!==0)return;const a=this.framePoint(e);a&&(e.stopPropagation(),e.currentTarget.setPointerCapture(e.pointerId),this.regionKey=t,this.drag={kind:"move",key:t,px:a.x,py:a.y,rect:s})}onHandleDown(e,t,s,a){if(this.lock||e.button!==0)return;const r=this.framePoint(e);r&&(e.stopPropagation(),e.currentTarget.setPointerCapture(e.pointerId),this.drag={kind:"corner",key:t,px:r.x,py:r.y,rect:s,corner:a})}onPointerMove(e){const t=this.drag,s=this.cur;if(!t||!s)return;const a=this.framePoint(e);a&&(t.kind==="draw"?this.ghost=ys(t.px,t.py,a.x,a.y,s.frame):t.kind==="move"&&t.rect?this.setRect(t.key,Ct({...t.rect,x:t.rect.x+(a.x-t.px),y:t.rect.y+(a.y-t.py)},s.frame)):t.kind==="corner"&&t.rect&&t.corner&&this.setRect(t.key,Oi(t.rect,t.corner,a.x,a.y,s.frame)))}onPointerUp(e){const t=this.drag,s=this.cur;if(this.drag=null,!(!t||!s)&&t.kind==="draw"){const a=this.framePoint(e),r=a?ys(t.px,t.py,a.x,a.y,s.frame):null;if(this.ghost=null,r){const i=xt();this.edit(n=>{n.regions.length>=s.view.max_regions||(n.regions.push({key:i,rect:r,points:[]}),n.enabled=!0)}),this.regionKey=i}}}onRegionKey(e,t){const s=this.cur;if(!s||this.lock)return;const r=this.draftFor(this.selected)?.regions.find(i=>i.key===t);r&&(e.key==="Delete"||e.key==="Backspace"?(e.preventDefault(),this.deleteRegion(t)):Ri(e.key)&&r.rect&&(e.preventDefault(),this.setRect(t,Ti(r.rect,e.key,e.shiftKey,s.frame,e.ctrlKey||e.metaKey))))}get invalidCameras(){return[...this.drafts.keys()].filter(e=>this.invalidFor(e))}get canReview(){return!this.lock&&!!this.cur&&this.drafts.size>0&&this.invalidCameras.length===0&&!this.previewing}get readyRows(){return(this.preview?.items??[]).filter(e=>e.status==="ready")}regionLabel(e,t){return u(t?"region_n":"region_poly",{n:e+1})}invalidText(e,t){return e==="need_region"?u("inv_need_region"):e==="too_many"?u("inv_too_many",{max:t}):e==="too_small"?u("inv_too_small"):""}renderPicture(e,t){return this.brokenShot.has(e)?o`<div class="nopic">${u("no_picture")}</div>`:o`<img alt="" src=${na(e,t)} @error=${()=>this.brokenShot=new Set(this.brokenShot).add(e)} />`}thumb(e,t,s,a){return o`<div class="thumb" style=${`aspect-ratio:${t.width} / ${t.height}`}>
      ${this.renderPicture(e,a)}
      <svg viewBox=${`0 0 ${t.width} ${t.height}`} preserveAspectRatio="none" aria-hidden="true">${s.map(r=>At`<polygon points=${Ss(r)}></polygon>`)}</svg>
    </div>`}renderCameras(){return o`<ul class="cams" data-pm-cameras aria-label=${u("cameras")}>
      ${this.cameras.map(e=>{const t=e.camera_id;return o`<li>
          <button type="button" class="cam" data-pm-camera=${t} aria-current=${t===this.selected?"true":"false"} ?disabled=${this.step!=="edit"} @click=${()=>void this.select(t)}>
            ${this.drafts.has(t)?o`<span class="dot" data-pm-edited aria-hidden="true"></span><span class="vh">${u("camera_edited")}</span>`:c}
            <span>${e.name}</span><bdi>${e.channel}</bdi>
          </button>
        </li>`})}
    </ul>`}renderEditor(){const e=this.cur;if(this.loaded.get(this.selected)==="error")return{main:o`<sw-state-panel state="error" heading=${u("err_mask")} actionLabel=${u("retry")} data-pm-mask-error @action=${()=>void this.loadMask(this.selected,!0)}></sw-state-panel>`,insp:c,foot:c};if(!e)return{main:o`<sw-state-panel state="loading" heading=${u("loading")} data-pm-mask-loading></sw-state-panel>`,insp:c,foot:c};const s=this.draftFor(this.selected),a=this.lock,r=this.invalidFor(this.selected),i=s.regions.find(p=>p.key===this.regionKey)??null,n=o`
      <div class="bar">
        <button type="button" class="sw-switch" role="switch" aria-checked=${s.enabled?"true":"false"} data-pm-enabled ?disabled=${!!a} @click=${this.toggleMask}><span class="track" aria-hidden="true"></span>${u("mask_on")}</button>
        <sw-button size="lg" data-pm-add ?disabled=${!!a||s.regions.length>=e.view.max_regions} @click=${this.addRegion}>${u("add_region")}</sw-button>
        <sw-button size="lg" variant="ghost" data-pm-delete ?disabled=${!!a||!i} @click=${()=>i&&this.deleteRegion(i.key)}>${u("delete_region")}</sw-button>
        <sw-button size="lg" variant="ghost" data-pm-discard ?disabled=${!this.drafts.has(this.selected)} @click=${this.discard}>${u("discard")}</sw-button>
        <span class="count" data-pm-count>${u("regions_count",{n:s.regions.length,max:e.view.max_regions})}</span>
      </div>
      <div class="stage" style=${`--pm-w:${e.frame.width};--pm-h:${e.frame.height}`}>
      <div class="frame ${a?"ro":""}" data-pm-frame style=${`aspect-ratio:${e.frame.width} / ${e.frame.height}`}
        @pointerdown=${p=>this.onFrameDown(p)} @pointermove=${p=>this.onPointerMove(p)} @pointerup=${p=>this.onPointerUp(p)} @pointercancel=${()=>(this.drag=null,this.ghost=null)}>
        ${this.renderPicture(this.selected,e.shot)}
        <svg viewBox=${`0 0 ${e.frame.width} ${e.frame.height}`} preserveAspectRatio="none" aria-hidden="true">
          ${s.regions.map(p=>At`<polygon class=${[p.key===this.regionKey?"sel":"",s.enabled?"":"off"].join(" ")} points=${Ss(p.rect?[[p.rect.x,p.rect.y],[p.rect.x+p.rect.w,p.rect.y],[p.rect.x+p.rect.w,p.rect.y+p.rect.h],[p.rect.x,p.rect.y+p.rect.h]]:p.points)}></polygon>`)}
        </svg>
        ${Oe(s.regions,p=>p.key,(p,w)=>this.renderRegion(p.key,w,p.rect,p.points,e.frame,!!a))}
        ${this.ghost?o`<div class="ghost" style=${this.styleOf(zs(this.ghost,e.frame))}></div>`:c}
      </div>
      </div>
      <span id="pm-keys" class="vh">${u("region_keys")}</span>
      ${r||this.invalidCameras.length?o`<p class="err" data-pm-invalid role="alert">${this.invalidCameras.map(p=>`${this.nameOf(p)}: ${this.invalidText(this.invalidFor(p),this.loaded.get(p).view.max_regions)}`).join(" · ")}</p>`:c}`,l=o`<div class="insp" data-pm-inspector>
      ${s.regions.length?o`<ul class="regions" data-pm-regions aria-label=${u("regions_count",{n:s.regions.length,max:e.view.max_regions})}>
            ${s.regions.map((p,w)=>o`<li>
                <button type="button" class="pick" data-pm-pick=${p.key} aria-pressed=${p.key===this.regionKey?"true":"false"} @click=${()=>this.regionKey=p.key}>${this.regionLabel(w,p.rect)}</button>
                <sw-button size="lg" variant="ghost" iconOnly icon="close" label=${`${u("delete_region")}: ${this.regionLabel(w,p.rect)}`} data-pm-remove=${p.key} ?disabled=${!!a} @click=${()=>this.deleteRegion(p.key)}></sw-button>
              </li>`)}
          </ul>`:o`<ul class="regions" data-pm-regions></ul>`}
      ${this.renderHistory()}
    </div>`,h=o`<div class="foot edit-foot">
      ${this.line?o`<p class="err" data-pm-line role="alert">${this.line}</p>`:c}
      <sw-button size="lg" variant="primary" data-pm-review ?disabled=${!this.canReview} @click=${()=>void this.review()}>${this.previewing?u("reviewing"):u("review",{n:this.drafts.size})}</sw-button>
    </div>`;return{main:n,insp:l,foot:h}}styleOf(e){return`left:${e.left};top:${e.top};width:${e.width};height:${e.height}`}renderRegion(e,t,s,a,r,i){const n=a.map(m=>m[0]),l=a.map(m=>m[1]),h=s??{x:Math.min(...n),y:Math.min(...l),w:Math.max(...n)-Math.min(...n),h:Math.max(...l)-Math.min(...l)},p=e===this.regionKey,w=this.regionLabel(t,s);return o`<div class="reg ${i?"ro":""}" data-pm-region=${e} data-pm-index=${t+1} data-pm-rect=${s?`${s.x},${s.y},${s.w},${s.h}`:"free"} style=${this.styleOf(zs(h,r))}
      role="group" tabindex=${i?-1:0} aria-label=${w} aria-describedby="pm-keys" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Delete"
      @focus=${()=>this.regionKey=e}
      @pointerdown=${m=>s&&this.onRegionDown(m,e,s)} @pointermove=${m=>this.onPointerMove(m)} @pointerup=${m=>this.onPointerUp(m)}
      @keydown=${m=>this.onRegionKey(m,e)}>
      ${p&&s&&!i?Bi.map(m=>o`<div class="handle ${m}" data-pm-handle=${m} aria-hidden="true" @pointerdown=${$=>this.onHandleDown($,e,s,m)} @pointermove=${$=>this.onPointerMove($)} @pointerup=${$=>this.onPointerUp($)}></div>`):c}
    </div>`}changeStatus(e){if(e.rollback_of)return u("log_applied");const t=e.status;return u(t==="applied"?"log_applied":t==="rolled_back"?"log_rolled_back":t==="failed"?"log_failed":t==="diverged"?"log_diverged":"log_other")}renderHistory(){if(this.history===null)return c;const e=Ii(this.history),t=this.lock;return o`<section class="history" data-pm-history aria-label=${u("log_title")}>
      <h3>${u("log_title")}</h3>
      ${this.history.length?o`<ul>
            ${this.history.slice(0,5).map(s=>o`<li data-pm-change=${s.id} data-status=${s.status}>
                <span class="when">${this.when(s.created_at)}</span><span>${this.changeStatus(s)}</span>
                ${e&&e.id===s.id&&!this.undone.has(s.id)?o`<sw-button size="lg" variant="ghost" data-pm-undo=${s.id} ?disabled=${!!this.undoing||!!t} @click=${()=>void this.undo(s.id,this.selected)}>${this.undoing===s.id?u("undoing"):u("undo")}</sw-button>`:c}
              </li>`)}
          </ul>`:o`<p class="muted" data-pm-history-empty>${u("log_empty")}</p>`}
    </section>`}when(e){const t=new Date(e);return Number.isNaN(t.getTime())?"":Cs(t)}statusText(e){return u(e==="ready"?"st_ready":e==="unchanged"?"st_unchanged":e==="invalid"?"st_invalid":"st_skipped")}renderReview(){const e=this.preview;if(!e)return c;const t=this.readyRows.length;return o`<div class="review" data-pm-review-step>
      <h3>${u("preview_title")}</h3>
      ${e.items.map(s=>{const a=this.loaded.get(s.camera_id),r=s.before?.normalized?.width?{width:s.before.normalized.width,height:s.before.normalized.height??dt.height}:a&&a!=="error"&&a!=="loading"?a.frame:dt,i=a&&a!=="error"&&a!=="loading"?a.shot:0;return o`<article class="rv-card" data-pm-preview=${s.camera_id} data-status=${s.status}>
          <header><span class="name">${s.name||this.nameOf(s.camera_id)}</span><span class="st-chip ${s.status}" data-pm-status>${this.statusText(s.status)}</span>${s.status==="invalid"||s.status==="skipped"?o`<span class="err">${xe(s.reason??"generic")}</span>`:c}</header>
          ${s.before&&s.after?o`<div class="pair">
                <figure><figcaption>${u("before")}</figcaption>${this.thumb(s.camera_id,r,Rs(s.before.enabled?s.before:{...s.before,regions:[]}),i)}</figure>
                <figure><figcaption>${u("after")}</figcaption>${this.thumb(s.camera_id,r,Rs(s.after.enabled?s.after:{...s.after,regions:[]}),i)}</figure>
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
    </sw-dialog>`}resultText(e){switch(e.status){case"applied":return{text:u("res_applied"),bad:!1};case"unchanged":return{text:u("res_unchanged"),bad:!1};case"skipped":return{text:`${u("res_skipped")}: ${xe(e.reason??"generic")}`,bad:!0};case"not_attempted":return{text:u("res_not_attempted"),bad:!1};default:return{text:`${u("res_failed")}: ${xe(e.reason??"generic")}${e.restored===!0?`. ${u("restored")}`:e.restored===!1?`. ${u("not_restored")}`:""}`,bad:!0}}}renderDone(){const e=this.applied;return e?o`<div class="review" data-pm-done-step>
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
  `;_([d()],b.prototype,"cameras",2);_([d()],b.prototype,"failure",2);_([d()],b.prototype,"loading",2);_([d()],b.prototype,"selected",2);_([d()],b.prototype,"loaded",2);_([d()],b.prototype,"drafts",2);_([d()],b.prototype,"regionKey",2);_([d()],b.prototype,"step",2);_([d()],b.prototype,"preview",2);_([d()],b.prototype,"previewing",2);_([d()],b.prototype,"confirmOpen",2);_([d()],b.prototype,"applying",2);_([d()],b.prototype,"applied",2);_([d()],b.prototype,"line",2);_([d()],b.prototype,"ghost",2);_([d()],b.prototype,"history",2);_([d()],b.prototype,"undoing",2);_([d()],b.prototype,"undone",2);_([d()],b.prototype,"brokenShot",2);_([d()],b.prototype,"switchOn",2);_([d()],b.prototype,"switchAsk",2);_([d()],b.prototype,"switchBusy",2);_([d()],b.prototype,"switchErr",2);_([d()],b.prototype,"avail",2);b=_([U("system-security-privacy-masks")],b);var Vi=Object.defineProperty,Di=Object.getOwnPropertyDescriptor,ee=(e,t,s,a)=>{for(var r=a>1?void 0:a?Di(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&Vi(t,s,r),r};const pt="access.unknown_person_uniform_404";let F=class extends K{constructor(){super(...arguments),this.loading=!0,this.failed="",this.policy=null,this.retention="",this.cap="",this.worker=null,this.uniform=null,this.canEdit=!1,this.busy="",this.error="",this.saved=!1,this.ticketsRev=0}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.loading=!0,this.failed="";try{const e=await D("settings");this.canEdit=!!e.can_edit&&(!de()||Ye("system.configure")),this.uniform=String(e.settings[pt]??"true")==="true";const t=String(e.settings["tickets.enabled"]??"false")==="true",[s,a]=await Promise.all([$a().catch(()=>null),t?D("tickets/settings").catch(()=>null):Promise.resolve(null)]);this.policy=s?{pending_retention_days:s.pending_retention_days,pending_max_per_vendor:s.pending_max_per_vendor}:null,this.retention=s?String(s.pending_retention_days):"",this.cap=s?String(s.pending_max_per_vendor):"",this.worker=a?!!a.vendor_portal?.start_worker:null,this.ticketsRev=a?.revision??0}catch(e){this.failed=fe(e)}finally{this.loading=!1}}async run(e,t){if(!this.busy){this.busy=e,this.error="",this.saved=!1;try{await t(),this.saved=!0}catch(s){this.error=`${M("saveFailed")} · ${fe(s)}`}finally{this.busy=""}}}savePolicy(){const e=jt(this.retention),t=Kt(this.cap);e===null||t===null||this.run("policy",async()=>{const s=await za({pending_retention_days:e,pending_max_per_vendor:t});this.policy={pending_retention_days:s.pending_retention_days,pending_max_per_vendor:s.pending_max_per_vendor},this.retention=String(s.pending_retention_days),this.cap=String(s.pending_max_per_vendor)})}flipWorker(){if(this.worker===null)return;const e=!this.worker;this.run("worker",async()=>{const t=await Me("tickets/settings",{revision:this.ticketsRev,vendor_portal:{start_worker:e}});this.worker=!!t.vendor_portal?.start_worker,this.ticketsRev=t.revision})}flipUniform(){if(this.uniform===null)return;const e=!this.uniform;this.run("uniform",async()=>{const t=await oa("settings",{[pt]:String(e)});this.uniform=String(t.settings[pt]??"true")==="true"})}toggle(e,t,s,a){return o`<button type="button" class="sw" role="switch" aria-checked=${String(s)} data-public-switch=${e} ?disabled=${!this.canEdit||!!this.busy} @click=${a}>
      <span class="t">${t}</span><span class="track" aria-hidden="true"></span>
    </button>`}body(){if(this.loading)return o`<sw-state-panel state="loading"></sw-state-panel>`;if(this.failed)return o`<sw-state-panel state="error" heading=${M("loadFailed")} hint=${this.failed} actionLabel=${M("retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=jt(this.retention),t=Kt(this.cap),s=!!this.policy&&(e!==this.policy.pending_retention_days||t!==this.policy.pending_max_per_vendor);return o`<sw-card flush data-public-settings>
      ${this.policy?o`<section class="grp" data-public-group="pending">
            <h4>${M("secPending")}</h4>
            <div class="fields">
              <div class="f"><label for="ret">${M("retention")}</label>
                <input id="ret" inputmode="numeric" data-public-retention .value=${this.retention} aria-invalid=${String(e===null)} ?disabled=${!this.canEdit} @input=${a=>this.retention=a.target.value} />
                <small class=${e===null?"bad":""}>${e===null?M("invalidRetention"):M("zeroOff")}</small></div>
              <div class="f"><label for="cap">${M("cap")}</label>
                <input id="cap" inputmode="numeric" data-public-cap .value=${this.cap} aria-invalid=${String(t===null)} ?disabled=${!this.canEdit} @input=${a=>this.cap=a.target.value} />
                <small class=${t===null?"bad":""}>${t===null?M("invalidCap"):M("zeroOff")}</small></div>
            </div>
            <div class="row"><sw-button variant="primary" data-public-save ?disabled=${!this.canEdit||!s||e===null||t===null||!!this.busy} @click=${()=>this.savePolicy()}>${M("save")}</sw-button></div>
          </section>`:c}
      ${this.worker!==null?o`<section class="grp" data-public-group="portal"><h4>${M("secPortal")}</h4>${this.toggle("start_worker",M("startWorker"),this.worker,()=>this.flipWorker())}</section>`:c}
      ${this.uniform!==null?o`<section class="grp" data-public-group="access"><h4>${M("secAccess")}</h4>${this.toggle("uniform_404",M("uniform404"),this.uniform,()=>this.flipUniform())}</section>`:c}
      ${this.error?o`<div class="note err" role="alert" data-public-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:c}
      ${this.saved&&!this.error?o`<div class="grp"><span class="ok" role="status" data-public-saved><sw-icon name="check" size=${16}></sw-icon>${M("saved")}</span></div>`:c}
    </sw-card>`}render(){return o`<sw-page crumbs="הגדרות | אבטחה" heading=${M("title")}>${this.body()}</sw-page>`}};F.styles=[zt,Z`
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
    `,Ne];ee([d()],F.prototype,"loading",2);ee([d()],F.prototype,"failed",2);ee([d()],F.prototype,"policy",2);ee([d()],F.prototype,"retention",2);ee([d()],F.prototype,"cap",2);ee([d()],F.prototype,"worker",2);ee([d()],F.prototype,"uniform",2);ee([d()],F.prototype,"canEdit",2);ee([d()],F.prototype,"busy",2);ee([d()],F.prototype,"error",2);ee([d()],F.prototype,"saved",2);F=ee([U("system-security-public")],F);const _e="wiskey/managed",ht=()=>D(_e),Hi=(e,t,s)=>Me(`${_e}/switch`,t==="on"?{switch:e,value:t,confirm:s??""}:{switch:e,value:t}),Fi=e=>Me(`${_e}/keep-runs`,{value:e}),ji=()=>V(`${_e}/check`),Ki=e=>V(`${_e}/adopt`,{confirm:e}),Ui=()=>V(`${_e}/upgrade`),Wi=()=>V(`${_e}/rollback`);function Ts(e,t){return e.trim().normalize("NFC")===t.normalize("NFC")&&t.length>0}const Qi=5,kt=[1,10];function Gi(e){const t=e?.keep_runs;return typeof t=="number"&&Number.isInteger(t)&&t>=kt[0]&&t<=kt[1]?t:Qi}function Yi(e,t){return(e?.switches??{})[t]==="on"?"on":"off"}const Ji=["install","upgrade","convert"];function Xi(e){return!e||e.switches.enabled!=="on"||e.running?{adopt:!1,upgrade:!1,rollback:!1}:{adopt:e.adoptable,upgrade:e.runnable&&Ji.includes(e.plan),rollback:e.rollback_available}}const Zi=["preflight","core_gate","backup_check","snapshot_before","stop_core","backup_local","swap","start_core","verify","rollback","start_core_after_rollback","verify_after_rollback"],en=e=>!!e&&e.state!=="running";function tn(e){return!e||e.state==="running"?"info":e.state==="succeeded"?"ok":e.state==="rolled_back"||e.state==="aborted"||e.state==="interrupted"?"warn":"danger"}function Os(e){return e instanceof v?e.status===403?"forbidden":e.code==="confirmation_required"?"confirm":e.status===409?"conflict":e.status===422?"invalid":"other":"other"}const sn=e=>e instanceof v?e.code:null,Mt={title:"התקנה ועדכון של רכיב בקרת הכניסה",lead:"מנהל מערכת מתקין ומעדכן את הרכיב מכאן, אחרי בדיקת גיבוי מלא. התקנה בעליית התוסף רק אם הופעלה כאן, ואין שדרוג לאחור.",installed:"מותקן",shipped:"זמין בגרסה זו",status:"מצב",none:"לא מותקן",details:"פרטים",on:"פועל",off:"כבוי",turnOn:"הפעלה",turnOff:"כיבוי",cancel:"ביטול",close:"סגירה",retry:"נסו שוב",loadFailed:"הטעינה נכשלה",failed:"הפעולה נכשלה",forbidden:"רק מנהל מערכת יכול לבצע פעולה זו.",own_manual:"הותקן ידנית",own_adopted:"הועבר לניהול המערכת",own_arx_managed:"מנוהל על ידי המערכת",own_legacy:"התקנה קודמת מזוהה",own_unknown:"לא מזוהה",own_missing:"לא מותקן",own_marker_invalid:"סימון ההתקנה הידנית אינו תקין",own_link:"קישור במקום תיקייה",own_unreadable:"לא ניתן לקריאה",own_not_mapped:"תיקיית ההגדרות אינה זמינה",plan_install:"אפשר להתקין",plan_upgrade:"עדכון זמין",plan_convert:"אפשר להעביר לניהול (אותה גרסה)",plan_up_to_date:"מעודכן",plan_downgrade_refused:"המותקן חדש יותר: אין שדרוג לאחור",plan_same_version_different_content:"אותו מספר גרסה עם תוכן אחר: נדרשת בדיקה",plan_version_unknown:"מספר הגרסה אינו מזוהה",plan_bundle_missing:"אין חבילה תקינה בגרסה זו",plan_not_mapped:"תיקיית ההגדרות אינה זמינה",enabledTitle:"התקנה ועדכון דרך המערכת",enabledText:"כשמופעל, מנהל מערכת יכול להתקין, לעדכן ולהחזיר גרסה מכאן. ההפעלה עצמה לא מתקינה דבר.",riskTitle:"קבלת סיכון בבדיקת סביבת ההתקנה",riskText:"מאפשר עדכון כשסביבת ההתקנה נצפתה אך לא ניתן לאמת את מקורה. לא חל על אף תוצאה אחרת, ולא על התקנה בעליית התוסף.",startupTitle:"התקנה ועדכון בעליית התוסף",startupText:"כשמופעל, עדכון זמין מתבצע מעצמו כשהתוסף עולה, עם אותן בדיקות: גיבוי מלא עדכני, בדיקת סביבת ההתקנה, השוואה והחזרה בכשל. התקנה ידנית שלא הועברה לניהול לא תוחלף. ניסיון אחד לכל גרסה.",keepTitle:"כמה עדכונים אחרונים לשמור",keepText:"לכל עדכון נשמרים הגרסה הקודמת והגיבוי הפרטי שלו. הישנים יותר נמחקים אחרי העדכון המוצלח הבא.",keepLabel:"מספר העדכונים",keepSave:"שמירה",keepSaved:"נשמר",originStartup:"בעליית התוסף",typeQ:'להפעיל את "{name}"?',typeText:"כדי לאשר, יש להקליד את המשפט: {phrase}",typeLabel:"משפט האישור",typeWrong:"המשפט אינו תואם. יש להקליד אותו בדיוק.",offQ:'לכבות את "{name}"?',offText:"אי אפשר יהיה להתקין או לעדכן מכאן עד שיופעל שוב. מה שמותקן נשאר כפי שהוא.",adoptButton:"העברה לניהול המערכת",adoptQ:"להעביר את ההתקנה הידנית לניהול המערכת?",adoptText:"המערכת תשמור גיבוי פרטי של הרכיב ושל הרישום. בהתקנה עצמה לא ישתנה דבר עד העדכון הבא.",adoptDone:"ההתקנה עברה לניהול המערכת",checkButton:"בדיקה לפני עדכון",checking:"בודק…",checkTitle:"תוצאת הבדיקה",chk_preflight:"גרסאות, חבילה ובעלות",chk_supervisor:"שירות הניהול של תשתית המערכת",chk_core_gate:"בדיקת סביבת ההתקנה",chk_backup_check:"גיבוי מלא מ-24 השעות האחרונות",chk_pass:"עבר",chk_warn:"עבר בקבלת סיכון",chk_fail:"לא עבר",upgradeButton:"עדכון עכשיו",installButton:"התקנה עכשיו",convertButton:"העברה לניהול עכשיו",upgradeQ:"להתחיל עכשיו?",upgradeText:"תשתית המערכת תיעצר לזמן קצר, הרכיב יוחלף ויאומת, ותשתית המערכת תופעל שוב. בכל כשל הגרסה הקודמת תוחזר.",rollbackButton:"חזרה לגרסה הקודמת",rollbackQ:"לחזור לגרסה הקודמת?",rollbackText:"תשתית המערכת תיעצר לזמן קצר והגרסה הקודמת תוחזר בדיוק כפי שהייתה.",start:"התחלה",progress:"התקדמות",step_preflight:"בדיקות מקדימות",step_core_gate:"בדיקת סביבת ההתקנה",step_backup_check:"בדיקת גיבוי מלא",step_snapshot_before:"רישום המצב לפני",step_stop_core:"עצירת תשתית המערכת",step_backup_local:"גיבוי פרטי",step_swap:"החלפה מאומתת של הרכיב",step_start_core:"הפעלת תשתית המערכת",step_verify:"השוואת לפני ואחרי",step_rollback:"החזרת הגרסה הקודמת",step_start_core_after_rollback:"הפעלה אחרי ההחזרה",step_verify_after_rollback:"השוואה אחרי ההחזרה",job_running:"בביצוע",job_succeeded:"הושלם בהצלחה",job_aborted:"הופסק לפני כל שינוי",job_rolled_back:"נכשל, והגרסה הקודמת הוחזרה",job_rollback_failed:"נכשל וגם ההחזרה נכשלה: יש לשחזר את הגיבוי המלא",job_interrupted:"נקטע בהפעלה מחדש של המערכת: יש לבדוק את המצב",job_failed:"נכשל",lastRun:"הפעולה האחרונה",riskAccepted:"בוצע בקבלת סיכון בבדיקת סביבת ההתקנה",unattended:"ההתקנה האוטומטית הישנה, בלי בדיקת גיבוי והשוואה, נשארת כבויה.",code_core_not_running:"תשתית המערכת לא פועלת",code_validation:"הערך אינו תקין",code_full_backup_missing:"לא נמצא גיבוי מלא",code_full_backup_stale:"הגיבוי המלא האחרון ישן מ-24 שעות",code_backups_unreadable:"אי אפשר לקרוא את רשימת הגיבויים",code_core_gate_unverified:"מקור סביבת ההתקנה אינו מאומת",code_core_did_not_stop:"תשתית המערכת לא נעצרה",code_core_stop_refused:"עצירת תשתית המערכת נדחתה",code_core_did_not_start:"תשתית המערכת לא עלתה בזמן",code_core_start_refused:"הפעלת תשתית המערכת נדחתה",code_entry_not_loaded:"תחנה לא נטענה אחרי ההחלפה",code_entries_changed:"רשימת התחנות השתנתה",code_devices_changed:"רשימת ההתקנים השתנתה",code_entities_changed:"רשימת הישויות השתנתה",code_snapshot_unavailable:"אי אפשר לקרוא את הרישום",code_supervisor_unreachable:"שירות הניהול אינו זמין",code_adoption_required:"יש להעביר את ההתקנה לניהול המערכת קודם",code_plan_refused:"אין עדכון שאפשר לבצע",code_other:"הפעולה נדחתה"},Nt={title:"Installing and updating the access-control component",lead:"A system administrator installs and updates the component from here, after a full-backup check. It installs at add-on start-up only when turned on here, and there is no downgrade.",installed:"Installed",shipped:"Available in this version",status:"Status",none:"Not installed",details:"Details",on:"On",off:"Off",turnOn:"Turn on",turnOff:"Turn off",cancel:"Cancel",close:"Close",retry:"Try again",loadFailed:"Loading failed",failed:"The action failed",forbidden:"Only a system administrator can do this.",own_manual:"Installed by hand",own_adopted:"Handed over to the system",own_arx_managed:"Managed by the system",own_legacy:"Recognised earlier installation",own_unknown:"Not recognised",own_missing:"Not installed",own_marker_invalid:"The manual-installation marker is not valid",own_link:"A link instead of a folder",own_unreadable:"Cannot be read",own_not_mapped:"The settings folder is not available",plan_install:"Can be installed",plan_upgrade:"Update available",plan_convert:"Can be handed over (same version)",plan_up_to_date:"Up to date",plan_downgrade_refused:"The installed one is newer: no downgrade",plan_same_version_different_content:"Same version number, other content: needs a review",plan_version_unknown:"The version number is not recognised",plan_bundle_missing:"No valid package in this version",plan_not_mapped:"The settings folder is not available",enabledTitle:"Install and update through the system",enabledText:"When on, a system administrator can install, update and roll back from here. Turning it on installs nothing.",riskTitle:"Accept the risk of the installation-environment check",riskText:"Allows an update when the installation environment was observed but its origin cannot be verified. Covers no other result, and never an add-on start-up install.",startupTitle:"Install and update when the add-on starts",startupText:"When on, an available update runs by itself when the add-on starts, with the same checks: a recent full backup, the installation-environment check, the comparison and the rollback on failure. A manual installation not handed over is never replaced. One attempt per version.",keepTitle:"How many recent updates to keep",keepText:"Each update keeps the previous version and its private backup. Older ones are removed after the next successful update.",keepLabel:"Number of updates",keepSave:"Save",keepSaved:"Saved",originStartup:"At add-on start-up",typeQ:'Turn on "{name}"?',typeText:"To confirm, type the sentence: {phrase}",typeLabel:"Confirmation sentence",typeWrong:"The sentence does not match. Type it exactly.",offQ:'Turn off "{name}"?',offText:"Nothing can be installed or updated from here until it is turned on again. What is installed stays as it is.",adoptButton:"Hand over to the system",adoptQ:"Hand the manual installation over to the system?",adoptText:"The system keeps a private backup of the component and the registry. Nothing in the installation changes until the next update.",adoptDone:"The installation was handed over to the system",checkButton:"Check before updating",checking:"Checking…",checkTitle:"Check result",chk_preflight:"Versions, package and ownership",chk_supervisor:"The platform management service",chk_core_gate:"Installation-environment check",chk_backup_check:"A full backup from the last 24 hours",chk_pass:"Passed",chk_warn:"Passed with the risk accepted",chk_fail:"Did not pass",upgradeButton:"Update now",installButton:"Install now",convertButton:"Hand over now",upgradeQ:"Start now?",upgradeText:"The platform stops briefly, the component is replaced and verified, and the platform starts again. On any failure the previous version is put back.",rollbackButton:"Back to the previous version",rollbackQ:"Go back to the previous version?",rollbackText:"The platform stops briefly and the previous version is put back exactly as it was.",start:"Start",progress:"Progress",step_preflight:"Preliminary checks",step_core_gate:"Installation-environment check",step_backup_check:"Full-backup check",step_snapshot_before:"Recording the state before",step_stop_core:"Stopping the platform",step_backup_local:"Private backup",step_swap:"Verified component swap",step_start_core:"Starting the platform",step_verify:"Comparing before and after",step_rollback:"Putting the previous version back",step_start_core_after_rollback:"Starting after the rollback",step_verify_after_rollback:"Comparing after the rollback",job_running:"Running",job_succeeded:"Completed",job_aborted:"Stopped before any change",job_rolled_back:"Failed, and the previous version was put back",job_rollback_failed:"Failed, and the rollback failed too: restore the full backup",job_interrupted:"Interrupted by a system restart: check the state",job_failed:"Failed",lastRun:"Last action",riskAccepted:"Done with the installation-environment risk accepted",unattended:"The old automatic installation, without the backup check and the comparison, stays off.",code_core_not_running:"The platform is not running",code_validation:"The value is not valid",code_full_backup_missing:"No full backup found",code_full_backup_stale:"The last full backup is older than 24 hours",code_backups_unreadable:"The backup list cannot be read",code_core_gate_unverified:"The origin of the installation environment is not verified",code_core_did_not_stop:"The platform did not stop",code_core_stop_refused:"Stopping the platform was refused",code_core_did_not_start:"The platform did not come back in time",code_core_start_refused:"Starting the platform was refused",code_entry_not_loaded:"A station did not load after the swap",code_entries_changed:"The station list changed",code_devices_changed:"The device list changed",code_entities_changed:"The entity list changed",code_snapshot_unavailable:"The registry cannot be read",code_supervisor_unreachable:"The management service is not available",code_adoption_required:"Hand the installation over to the system first",code_plan_refused:"There is no update to carry out",code_other:"The action was refused"},an={...Nt,title:"تثبيت وتحديث مكوّن التحكم في الدخول",installed:"المثبّت",shipped:"المتوفر في هذا الإصدار",status:"الحالة",none:"غير مثبّت",details:"تفاصيل",on:"يعمل",off:"متوقف",turnOn:"تشغيل",turnOff:"إيقاف",cancel:"إلغاء",close:"إغلاق",retry:"حاول مرة أخرى",loadFailed:"فشل التحميل",failed:"فشلت العملية",forbidden:"مدير النظام فقط يمكنه تنفيذ ذلك.",enabledTitle:"التثبيت والتحديث عبر النظام",riskTitle:"قبول مخاطرة فحص بيئة التثبيت",adoptButton:"تسليم إلى إدارة النظام",checkButton:"فحص قبل التحديث",upgradeButton:"تحديث الآن",installButton:"تثبيت الآن",convertButton:"تسليم الآن",rollbackButton:"العودة إلى الإصدار السابق",progress:"التقدّم",job_succeeded:"اكتمل",job_running:"قيد التنفيذ"},rn={...Nt,title:"Установка и обновление компонента контроля доступа",installed:"Установлено",shipped:"Доступно в этой версии",status:"Состояние",none:"Не установлено",details:"Подробности",on:"Вкл.",off:"Выкл.",turnOn:"Включить",turnOff:"Выключить",cancel:"Отмена",close:"Закрыть",retry:"Повторить",loadFailed:"Ошибка загрузки",failed:"Действие не удалось",forbidden:"Это может сделать только системный администратор.",enabledTitle:"Установка и обновление через систему",riskTitle:"Принять риск проверки среды установки",adoptButton:"Передать под управление системы",checkButton:"Проверить перед обновлением",upgradeButton:"Обновить сейчас",installButton:"Установить сейчас",convertButton:"Передать сейчас",rollbackButton:"Вернуть предыдущую версию",progress:"Ход выполнения",job_succeeded:"Завершено",job_running:"Выполняется"},nn={he:Mt,en:Nt,ar:an,ru:rn};function Ys(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}function f(e,t,s=Ys()){const a=nn[s][e]??Mt[e]??e;return t?a.replace(/\{(\w+)\}/g,(r,i)=>i in t?String(t[i]):r):a}function re(e,t,s=Ys()){if(!t)return null;const a=`${e}${t}`;return a in Mt?f(a,void 0,s):null}var on=Object.defineProperty,ln=Object.getOwnPropertyDescriptor,q=(e,t,s,a)=>{for(var r=a>1?void 0:a?ln(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&on(t,s,r),r};const cn=2e3;let C=class extends K{constructor(){super(...arguments),this.loading=!0,this.failed="",this.concealed=!1,this.view=null,this.pending=null,this.typed="",this.busy=!1,this.dlgError="",this.error="",this.notice="",this.check=null,this.checking=!1,this.keepDraft=null,this.keepSaving=!1,this.keepNote="",this.timer=null}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.stopPolling()}stopPolling(){this.timer&&clearTimeout(this.timer),this.timer=null}schedulePoll(){this.stopPolling(),this.view?.running&&(this.timer=setTimeout(()=>void this.refresh(),cn))}async refresh(){try{this.view=await ht()}catch{}this.schedulePoll()}async load(){this.loading=!0,this.failed="";try{this.view=await ht()}catch(e){Os(e)==="forbidden"?this.concealed=!0:this.failed=fe(e)}finally{this.loading=!1}this.schedulePoll()}get canEdit(){return!de()||Ye("system.configure")}ask(e){this.busy||!this.canEdit||(this.error="",this.notice="",this.dlgError="",this.typed="",this.pending=e)}phraseFor(e){const t=this.view;return t?e.kind==="adopt"?t.phrases.adopt:e.kind==="switch"&&e.next==="on"?e.name==="core_risk"?t.phrases.core_risk:e.name==="startup"?t.phrases.startup??t.phrases.enabled:t.phrases.enabled:null:null}async saveKeep(){const e=this.keepDraft;if(!(e===null||this.keepSaving||!this.canEdit)){this.keepSaving=!0,this.keepNote="",this.error="";try{this.view=await Fi(e),this.keepDraft=null,this.keepNote=f("keepSaved")}catch(t){this.error=this.refusalText(t)}finally{this.keepSaving=!1}}}keepRow(e){const t=Gi(e),s=this.keepDraft??t,[a,r]=e.keep_runs_range??kt,i=Array.from({length:r-a+1},(l,h)=>a+h),n=this.keepDraft!==null&&this.keepDraft!==t;return o`<div class="row" data-wm-keep data-value=${String(t)}>
      <div>
        <h4 class="t">${f("keepTitle")}${this.keepNote?o`<span class="pill" data-tone="ok" data-wm-keep-saved>${this.keepNote}</span>`:c}</h4>
        <p class="x">${f("keepText")}</p>
      </div>
      <div class="keep">
        <select aria-label=${f("keepLabel")} data-wm-keep-select ?disabled=${!this.canEdit||this.keepSaving||e.running}
          @change=${l=>{this.keepDraft=Number(l.target.value),this.keepNote=""}}>
          ${i.map(l=>o`<option value=${String(l)} ?selected=${l===s}>${l}</option>`)}
        </select>
        <sw-button variant="secondary" data-wm-keep-save ?disabled=${!n||!this.canEdit||this.keepSaving}
          @click=${()=>void this.saveKeep()}>${f("keepSave")}</sw-button>
      </div>
    </div>`}refusalText(e){const t=Os(e);if(t==="forbidden")return f("forbidden");if(t==="confirm")return f("typeWrong");const s=sn(e);return re("code_",s)??`${f("failed")} · ${fe(e)}`}async confirm(){const e=this.pending;if(!e||this.busy)return;const t=this.phraseFor(e);if(t!==null&&!Ts(this.typed,t)){this.dlgError=f("typeWrong");return}this.busy=!0,this.dlgError="";try{e.kind==="switch"?this.view=await Hi(e.name,e.next,t!==null?this.typed.trim():void 0):e.kind==="adopt"?(this.view=await Ki(this.typed.trim()),this.notice=f("adoptDone")):(await(e.kind==="upgrade"?Ui():Wi()),this.check=null,this.view=await ht()),this.pending=null}catch(s){this.dlgError=this.refusalText(s)}finally{this.busy=!1}this.schedulePoll()}async runCheck(){if(!this.checking){this.checking=!0,this.error="";try{this.check=await ji()}catch(e){this.error=this.refusalText(e)}finally{this.checking=!1}}}fact(e,t,s,a){return o`<div class="fact" data-wm-fact=${a}><p class="l">${f(e)}</p><p class="v">${t}</p>${s?o`<p class="s">${s}</p>`:c}</div>`}facts(e){const t=e.installed.ownership,s=e.installed.state==="present"?e.installed.version??"—":f("none"),a=re("plan_",e.plan)??e.plan,r=e.plan==="up_to_date"?"ok":["install","upgrade","convert"].includes(e.plan)?"info":"warn";return o`<div class="facts" data-wm-facts>
      ${this.fact("installed",s,o`<span data-wm-ownership=${t}>${re("own_",t)??t}</span>`,"installed")}
      ${this.fact("shipped",e.bundle.version??"—",e.bundle.state!=="ok"?re("plan_","bundle_missing"):null,"shipped")}
      <div class="fact" data-wm-fact="status"><p class="l">${f("status")}</p><p class="s"><span class="pill" data-tone=${r} data-wm-plan=${e.plan}>${a}</span></p></div>
    </div>`}switchRow(e,t){const s=Yi(e,t)==="on",a=t==="enabled"?"enabled":t==="startup"?"startup":"risk";return o`<div class="row" data-wm-switch=${t} data-state=${s?"on":"off"}>
      <div>
        <h4 class="t">${f(`${a}Title`)}<span class="pill" data-state=${s?"on":"off"}>${f(s?"on":"off")}</span></h4>
        <p class="x">${f(`${a}Text`)}</p>
      </div>
      <sw-button variant=${s?"secondary":"primary"} data-wm-toggle ?disabled=${!this.canEdit||this.busy||e.running}
        @click=${()=>this.ask({kind:"switch",name:t,next:s?"off":"on"})}>${f(s?"turnOff":"turnOn")}</sw-button>
    </div>`}actions(e){const t=Xi(e);if(e.switches.enabled!=="on")return c;const s=e.plan==="install"?"installButton":e.plan==="convert"?"convertButton":"upgradeButton",a=!this.canEdit||this.busy;return o`<div class="actions" data-wm-actions>
      ${t.adopt?o`<sw-button variant="primary" data-wm-adopt ?disabled=${a} @click=${()=>this.ask({kind:"adopt"})}>${f("adoptButton")}</sw-button>`:c}
      ${t.upgrade?o`<sw-button variant="secondary" data-wm-check ?disabled=${a||this.checking} @click=${()=>void this.runCheck()}>${f(this.checking?"checking":"checkButton")}</sw-button>
        <sw-button variant="primary" data-wm-upgrade ?disabled=${a} @click=${()=>this.ask({kind:"upgrade"})}>${f(s)}</sw-button>`:c}
      ${t.rollback?o`<sw-button variant="secondary" data-wm-rollback ?disabled=${a} @click=${()=>this.ask({kind:"rollback"})}>${f("rollbackButton")}</sw-button>`:c}
    </div>`}checkList(){const e=this.check;if(!e)return c;const t=s=>s==="pass"?"check":s==="warn"?"warning":"close";return o`<div class="sec" data-wm-checks data-ready=${e.ready?"yes":"no"}>
      <h4>${f("checkTitle")}</h4>
      <ul class="list">${e.items.map(s=>o`<li data-wm-check-item=${s.name} data-state=${s.state}>
        <sw-icon name=${t(s.state)} size="16"></sw-icon><span>${re("chk_",s.name)??s.name}</span><span>${f(`chk_${s.state}`)}</span>
        ${s.code?o`<span class="c">${re("code_",s.code)??re("plan_",s.plan)??""} <span class="code">${s.code}</span></span>`:c}
      </li>`)}</ul>
    </div>`}jobView(e){if(!e)return c;const t=new Set,s=[...e.steps.map(h=>h.name)],a=en(e);if(!a)for(const h of Zi.slice(0,9))!s.includes(h)&&!(e.kind==="rollback"&&(h==="core_gate"||h==="backup_check"))&&s.push(h);const r=s.filter(h=>t.has(h)?!1:(t.add(h),!0)),i=h=>[...e.steps].reverse().find(p=>p.name===h),n=h=>h==="done"?"check":h==="failed"?"close":h==="running"?"refresh":"clock",l=tn(e);return o`<div class="sec" data-wm-job data-state=${e.state} data-kind=${e.kind}>
      <h4>${f(a?"lastRun":"progress")}<span class="pill" data-tone=${l}>${re("job_",e.state)??e.state}</span>
        ${e.origin==="startup"?o`<span class="pill" data-wm-origin="startup">${f("originStartup")}</span>`:c}
        <span class="code">${e.from_version??"—"} → ${e.to_version??"—"}</span></h4>
      <ul class="list" aria-live="polite">${r.map(h=>{const p=i(h),w=p?.state??"pending";return o`<li data-wm-step=${h} data-state=${w}><sw-icon name=${n(p?.state)} size="16"></sw-icon><span>${re("step_",h)??h}</span><span></span>
          ${p?.code?o`<span class="c">${re("code_",p.code)??""} <span class="code">${p.code}</span></span>`:c}</li>`})}</ul>
      ${e.risk_accepted?o`<div class="msg"><div class="note stale"><sw-icon name="warning" size="16"></sw-icon><span>${f("riskAccepted")}</span></div></div>`:c}
      ${a&&e.state==="rollback_failed"?o`<div class="msg"><div class="note err" role="alert" data-wm-job-alert><sw-icon name="warning" size="16"></sw-icon><span>${f("job_rollback_failed")}</span></div></div>`:c}
    </div>`}dialog(){const e=this.pending;if(!e)return c;const t=this.phraseFor(e);let s="",a="";if(e.kind==="switch"){const l=e.name==="enabled"?"enabled":e.name==="startup"?"startup":"risk",h=f(`${l}Title`);s=f(e.next==="on"?"typeQ":"offQ",{name:h}),a=e.next==="on"?f(`${l}Text`):f("offText")}else e.kind==="adopt"?(s=f("adoptQ"),a=f("adoptText")):e.kind==="upgrade"?(s=f("upgradeQ"),a=f("upgradeText")):(s=f("rollbackQ"),a=f("rollbackText"));const r=t===null||Ts(this.typed,t),i=e.kind==="switch"&&e.next==="off",n=e.kind==="switch"?f(e.next==="on"?"turnOn":"turnOff"):e.kind==="adopt"?f("adoptButton"):f("start");return o`<sw-dialog open heading=${s} data-wm-dialog=${e.kind==="switch"?`${e.name}-${e.next}`:e.kind} @close=${()=>{this.busy||(this.pending=null)}}>
      <p style="margin:0">${a}</p>
      ${t!==null?o`<label class="typed"><span class="lbl">${f("typeText",{phrase:""})}<span class="phrase" data-wm-phrase>${t}</span></span>
        <input data-wm-phrase-input autocomplete="off" spellcheck="false" aria-label=${f("typeLabel")} .value=${this.typed}
          @input=${l=>{this.typed=l.target.value,this.dlgError=""}}
          @keydown=${l=>{l.key==="Enter"&&r&&this.confirm()}}></label>`:c}
      ${this.dlgError?o`<p class="err-line" role="alert" data-wm-dialog-error>${this.dlgError}</p>`:c}
      <div class="foot"><sw-button variant="ghost" data-wm-cancel ?disabled=${this.busy} @click=${()=>this.pending=null}>${f("cancel")}</sw-button>
        <sw-button variant=${i?"danger":"primary"} data-wm-confirm ?disabled=${this.busy||!r} @click=${()=>void this.confirm()}>${n}</sw-button></div>
    </sw-dialog>`}render(){if(this.concealed)return c;if(this.loading)return o`<sw-card flush data-wm-card><sw-state-panel state="loading"></sw-state-panel></sw-card>`;if(this.failed||!this.view)return o`<sw-card flush data-wm-card><sw-state-panel state="error" data-wm-load-error heading=${f("loadFailed")} hint=${this.failed}
        actionLabel=${f("retry")} @action=${()=>void this.load()}></sw-state-panel></sw-card>`;const e=this.view;return o`<sw-card flush data-wm-card data-running=${e.running?"yes":"no"}>
      <h3 class="hd">${f("title")}</h3>
      <p class="lead">${f("lead")}</p>
      ${this.facts(e)}
      ${this.switchRow(e,"enabled")}
      ${e.switches.enabled==="on"?this.switchRow(e,"core_risk"):c}
      ${e.switches.enabled==="on"&&e.phrases.startup?this.switchRow(e,"startup"):c}
      ${e.keep_runs!==void 0?this.keepRow(e):c}
      ${this.actions(e)}
      ${this.checkList()}
      ${this.jobView(e.job)}
      ${this.error?o`<div class="msg" style="padding-block-start:14px"><div class="note err" role="alert" data-wm-error><sw-icon name="warning" size="16"></sw-icon><span>${this.error}</span></div></div>`:c}
      ${this.notice&&!this.error?o`<div class="msg" style="padding-block-start:14px"><div class="note info" role="status" data-wm-notice><sw-icon name="check" size="16"></sw-icon><span>${this.notice}</span></div></div>`:c}
      ${e.unattended_permitted?c:o`<p class="foot-note" data-wm-unattended>${f("unattended")}</p>`}
    </sw-card>
    ${this.dialog()}`}};C.styles=[zt,Z`
      :host { display: block; margin-block-start: 16px; }
      .hd { margin: 0; padding: 14px 14px 0; color: var(--sw-heading); font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); }
      .lead { margin: 4px 0 0; padding: 0 14px 14px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; border-block-start: 1px solid var(--sw-border); }
      .fact { padding: 12px 14px; min-inline-size: 0; }
      .fact + .fact { border-inline-start: 1px solid var(--sw-border); }
      .fact .l { margin: 0; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .fact .v { margin: 4px 0 0; color: var(--sw-heading); font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); direction: ltr; unicode-bidi: isolate; text-align: start; overflow-wrap: anywhere; }
      .fact .s { margin: 4px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-sm); overflow-wrap: anywhere; }
      .pill { display: inline-flex; align-items: center; min-block-size: 24px; padding: 0 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); background: var(--sw-surface-3, var(--sw-border)); color: var(--sw-text-2); }
      .pill[data-tone='ok'], .pill[data-state='on'] { background: var(--sw-success-bg, var(--sw-toggle-on)); color: var(--sw-success-text, var(--sw-text)); }
      .pill[data-tone='warn'] { background: var(--sw-warning-soft, var(--sw-surface-3)); color: var(--sw-text); }
      .pill[data-tone='danger'] { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
      .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 14px; align-items: center; padding: 14px; border-block-start: 1px solid var(--sw-border); }
      .row .t { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); font-weight: var(--sw-fw-bold); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .row .x { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px; border-block-start: 1px solid var(--sw-border); }
      .list { margin: 0; padding: 0 14px 14px; list-style: none; display: grid; gap: 6px; }
      .list li { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 8px; align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text); }
      .list li .c { grid-column: 2 / -1; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .list li[data-state='fail'], .list li[data-state='failed'] { color: var(--sw-danger-text); }
      .list li[data-state='pending'] { color: var(--sw-text-3); }
      .sec { padding: 12px 14px 0; border-block-start: 1px solid var(--sw-border); }
      .sec h4 { margin: 0 0 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); }
      .code { font-family: var(--sw-font-mono, monospace); direction: ltr; unicode-bidi: isolate; }
      .msg { padding: 0 14px 14px; }
      .foot-note { margin: 0; padding: 10px 14px 14px; color: var(--sw-text-3); font-size: var(--sw-fs-xs); border-block-start: 1px solid var(--sw-border); }
      .typed { display: grid; gap: 6px; margin-block-start: 12px; }
      .typed .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .typed .phrase { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
      .typed input { min-block-size: 40px; padding: 0 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border-strong, var(--sw-border)); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-md); }
      .err-line { margin: 10px 0 0; color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
      .foot { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-block-start: 14px; }
      .keep { display: flex; gap: 8px; align-items: center; }
      .keep select { min-block-size: 40px; min-inline-size: 72px; padding: 0 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border-strong, var(--sw-border)); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-md); }
      @media (max-width: 767px) {
        .facts { grid-template-columns: minmax(0, 1fr); }
        .fact + .fact { border-inline-start: 0; border-block-start: 1px solid var(--sw-border); }
        .row { grid-template-columns: minmax(0, 1fr); }
        .actions sw-button { flex: 1 1 100%; }
      }
    `];q([d()],C.prototype,"loading",2);q([d()],C.prototype,"failed",2);q([d()],C.prototype,"concealed",2);q([d()],C.prototype,"view",2);q([d()],C.prototype,"pending",2);q([d()],C.prototype,"typed",2);q([d()],C.prototype,"busy",2);q([d()],C.prototype,"dlgError",2);q([d()],C.prototype,"error",2);q([d()],C.prototype,"notice",2);q([d()],C.prototype,"check",2);q([d()],C.prototype,"checking",2);q([d()],C.prototype,"keepDraft",2);q([d()],C.prototype,"keepSaving",2);q([d()],C.prototype,"keepNote",2);C=q([U("system-security-wiskey-managed")],C);const dn=["wiskey.acr5_access_state","wiskey.acr5_normalize_user","wiskey.acr5_presence","wiskey.acr5_feature_plans"],pn={"wiskey.acr5_access_state":"access","wiskey.acr5_normalize_user":"schedule","wiskey.acr5_presence":"presence","wiskey.acr5_feature_plans":"plans"},De="wiskey.auto_install",hn=()=>D("wiskey/switches"),un=(e,t)=>Me("wiskey/switches",{switches:{[e]:t}});function fn(e){return e.go_live_permitted===!0}function mn(e){return e.auto_install_permitted===!0}function Es(e){return e instanceof v?e.code==="auto_install_not_permitted"?"installPermit":e.code==="wiskey_not_permitted"||e.status===409?"permit":e.status===403?"forbidden":e.status===422?"invalid":"other":"other"}const wn=(e,t)=>e?.switches?.[t]==="on"?"on":"off",Js={tab:"קריאות בקרת כניסה",title:"קריאות בקרת כניסה",lead:"מתגים שמאפשרים למערכת לבקש מידע ממערכת בקרת הכניסה. כל מתג כבוי כברירת מחדל.",on:"פועל",off:"כבוי",detailsKey:"שם פנימי",accessTitle:"מצב הגישה של אדם",accessText:"בדיקה מול בקרת הכניסה אם הרשאה שבוטלה אכן הוסרה.",scheduleTitle:"השוואת לוח זמנים",scheduleText:"בדיקה אם לוח הזמנים אצל בקרת הכניסה זהה למה שאושר.",presenceTitle:"נוכחות",presenceText:"מידע לבירור בלבד; אינו משמש להוכחת הסרה.",plansTitle:"תוכניות יכולות",plansText:"קריאה של תוכניות בלבד; שום תוכנית אינה מבוצעת.",permitMissing:"אי אפשר להפעיל עדיין: הגרסה הזו אינה כוללת אישור הפעלה לקריאה הזו.",permitRefused:"ההפעלה נדחתה: הגרסה הזו אינה כוללת אישור הפעלה לקריאה הזו. המתג נשאר כבוי.",forbidden:"רק מנהל מערכת יכול לשנות הגדרה זו.",invalid:"הבקשה אינה תקינה.",failed:"השמירה נכשלה",loadFailed:"הטעינה נכשלה",retry:"נסו שוב",turnOn:"הפעלה",turnOff:"כיבוי",cancel:"ביטול",confirmOnQ:'להפעיל את "{name}"?',confirmOnText:"המערכת תתחיל לבקש מידע זה ממערכת בקרת הכניסה. אפשר לכבות שוב בכל רגע.",confirmOffQ:'לכבות את "{name}"?',confirmOffText:"המערכת תפסיק לבקש מידע זה. מה שאי אפשר לוודא ייחשב כלא ידוע.",doneOn:"המתג הופעל",doneOff:"המתג כובה",installGroup:"התקנה אוטומטית",installTitle:"התקנה אוטומטית של רכיב בקרת הכניסה",installText:"כשמופעל, המערכת מתקינה ומעדכנת את רכיב בקרת הכניסה בעצמה, רק אחרי שכל הבדיקות עוברות. התקנה ידנית או זרה לעולם אינה נדרסת.",installPermitMissing:"אי אפשר להפעיל עדיין: בדיקת התאימות של סביבת ההתקנה עדיין אינה יכולה לעבור, ובדיקת המעבדה המבודדת טרם הושלמה.",installPermitRefused:"ההפעלה נדחתה: בדיקת התאימות של סביבת ההתקנה עדיין אינה יכולה לעבור, ובדיקת המעבדה המבודדת טרם הושלמה. המתג נשאר כבוי.",installConfirmOnText:"המערכת תתקין ותעדכן את רכיב בקרת הכניסה בעצמה, רק כשכל הבדיקות עוברות. התקנה ידנית או זרה לא תידרס. אפשר לכבות בכל רגע.",installConfirmOffText:"המערכת תפסיק להתקין ולעדכן את רכיב בקרת הכניסה. מה שכבר מותקן נשאר כפי שהוא."},gn={tab:"Access-control reads",title:"Access-control reads",lead:"Switches that let the system ask the access-control system for information. Every switch is off by default.",on:"On",off:"Off",detailsKey:"Internal name",accessTitle:"A person's access state",accessText:"Checks with access control that a revoked permission was really removed.",scheduleTitle:"Schedule comparison",scheduleText:"Checks that the schedule held by access control matches what was approved.",presenceTitle:"Presence",presenceText:"Information for inquiry only; never used as proof of removal.",plansTitle:"Capability plans",plansText:"Reads plans only; no plan is ever carried out.",permitMissing:"It cannot be turned on yet: this version has no go-live permit for this read.",permitRefused:"Turning it on was refused: this version has no go-live permit for this read. The switch stays off.",forbidden:"Only a system administrator can change this setting.",invalid:"The request is not valid.",failed:"Saving failed",loadFailed:"Loading failed",retry:"Try again",turnOn:"Turn on",turnOff:"Turn off",cancel:"Cancel",confirmOnQ:'Turn on "{name}"?',confirmOnText:"The system will start asking access control for this information. You can turn it off again at any time.",confirmOffQ:'Turn off "{name}"?',confirmOffText:"The system will stop asking for this information. Anything that cannot be verified counts as unknown.",doneOn:"The switch is on",doneOff:"The switch is off",installGroup:"Automatic installation",installTitle:"Automatic installation of the access-control component",installText:"When on, the system installs and updates the access-control component by itself, only after every check passes. A manual or foreign installation is never overwritten.",installPermitMissing:"It cannot be turned on yet: the compatibility check of the installation environment cannot pass yet, and the isolated lab test is not done.",installPermitRefused:"Turning it on was refused: the compatibility check of the installation environment cannot pass yet, and the isolated lab test is not done. The switch stays off.",installConfirmOnText:"The system will install and update the access-control component by itself, only when every check passes. A manual or foreign installation is never overwritten. You can turn it off at any time.",installConfirmOffText:"The system will stop installing and updating the access-control component. What is already installed stays as it is."},bn={tab:"قراءات التحكم في الدخول",title:"قراءات التحكم في الدخول",lead:"مفاتيح تتيح للنظام طلب معلومات من نظام التحكم في الدخول. كل مفتاح متوقف افتراضيا.",on:"يعمل",off:"متوقف",detailsKey:"الاسم الداخلي",accessTitle:"حالة وصول شخص",accessText:"تحقق لدى التحكم في الدخول من أن صلاحية ملغاة أُزيلت فعلا.",scheduleTitle:"مقارنة الجدول الزمني",scheduleText:"تحقق من أن الجدول لدى التحكم في الدخول مطابق لما تمت الموافقة عليه.",presenceTitle:"التواجد",presenceText:"معلومات للاستعلام فقط؛ لا تُستخدم كدليل على الإزالة.",plansTitle:"خطط القدرات",plansText:"قراءة الخطط فقط؛ لا تُنفذ أي خطة.",permitMissing:"لا يمكن التشغيل بعد: هذا الإصدار لا يتضمن إذن تشغيل لهذه القراءة.",permitRefused:"رُفض التشغيل: هذا الإصدار لا يتضمن إذن تشغيل لهذه القراءة. يبقى المفتاح متوقفا.",forbidden:"مدير النظام فقط يمكنه تغيير هذا الإعداد.",invalid:"الطلب غير صالح.",failed:"فشل الحفظ",loadFailed:"فشل التحميل",retry:"حاول مرة أخرى",turnOn:"تشغيل",turnOff:"إيقاف",cancel:"إلغاء",confirmOnQ:'تشغيل "{name}"؟',confirmOnText:"سيبدأ النظام بطلب هذه المعلومات من التحكم في الدخول. يمكن إيقافه مجددا في أي وقت.",confirmOffQ:'إيقاف "{name}"؟',confirmOffText:"سيتوقف النظام عن طلب هذه المعلومات. ما لا يمكن التحقق منه يُعد غير معروف.",doneOn:"تم تشغيل المفتاح",doneOff:"تم إيقاف المفتاح",installGroup:"التثبيت التلقائي",installTitle:"التثبيت التلقائي لمكوّن التحكم في الدخول",installText:"عند التشغيل، يثبّت النظام مكوّن التحكم في الدخول ويحدّثه بنفسه، فقط بعد نجاح كل الفحوص. لا يُستبدل أبدا تثبيت يدوي أو غريب.",installPermitMissing:"لا يمكن التشغيل بعد: فحص توافق بيئة التثبيت لا يمكنه النجاح بعد، واختبار المختبر المعزول لم يكتمل.",installPermitRefused:"رُفض التشغيل: فحص توافق بيئة التثبيت لا يمكنه النجاح بعد، واختبار المختبر المعزول لم يكتمل. يبقى المفتاح متوقفا.",installConfirmOnText:"سيثبّت النظام مكوّن التحكم في الدخول ويحدّثه بنفسه، فقط عند نجاح كل الفحوص. لن يُستبدل تثبيت يدوي أو غريب. يمكن الإيقاف في أي وقت.",installConfirmOffText:"سيتوقف النظام عن تثبيت مكوّن التحكم في الدخول وتحديثه. ما هو مثبت يبقى كما هو."},vn={tab:"Запросы к контролю доступа",title:"Запросы к контролю доступа",lead:"Переключатели, позволяющие системе запрашивать данные у системы контроля доступа. По умолчанию все выключены.",on:"Включён",off:"Выключен",detailsKey:"Внутреннее имя",accessTitle:"Состояние доступа человека",accessText:"Проверка у контроля доступа, что отозванное разрешение действительно снято.",scheduleTitle:"Сравнение расписания",scheduleText:"Проверка, что расписание в контроле доступа совпадает с утверждённым.",presenceTitle:"Присутствие",presenceText:"Только справочные данные; не служат доказательством снятия.",plansTitle:"Планы возможностей",plansText:"Только чтение планов; ни один план не выполняется.",permitMissing:"Пока включить нельзя: в этой версии нет разрешения на запуск этого запроса.",permitRefused:"Включение отклонено: в этой версии нет разрешения на запуск этого запроса. Переключатель остаётся выключенным.",forbidden:"Изменить эту настройку может только администратор системы.",invalid:"Некорректный запрос.",failed:"Не удалось сохранить",loadFailed:"Не удалось загрузить",retry:"Повторить",turnOn:"Включить",turnOff:"Выключить",cancel:"Отмена",confirmOnQ:"Включить «{name}»?",confirmOnText:"Система начнёт запрашивать эти данные у контроля доступа. Выключить можно в любой момент.",confirmOffQ:"Выключить «{name}»?",confirmOffText:"Система перестанет запрашивать эти данные. То, что нельзя проверить, считается неизвестным.",doneOn:"Переключатель включён",doneOff:"Переключатель выключен",installGroup:"Автоматическая установка",installTitle:"Автоматическая установка компонента контроля доступа",installText:"Если включено, система сама устанавливает и обновляет компонент контроля доступа, только после прохождения всех проверок. Ручная или чужая установка никогда не перезаписывается.",installPermitMissing:"Пока включить нельзя: проверка совместимости среды установки пока не может пройти, а тест в изолированной лаборатории не завершён.",installPermitRefused:"Включение отклонено: проверка совместимости среды установки пока не может пройти, а тест в изолированной лаборатории не завершён. Переключатель остаётся выключенным.",installConfirmOnText:"Система будет сама устанавливать и обновлять компонент контроля доступа, только когда все проверки пройдены. Ручная или чужая установка не перезаписывается. Выключить можно в любой момент.",installConfirmOffText:"Система перестанет устанавливать и обновлять компонент контроля доступа. Уже установленное остаётся как есть."};function _n(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}const yn={he:Js,en:gn,ar:bn,ru:vn};function x(e,t,s=_n()){const a=yn[s][e]??Js[e]??e;return t?a.replace(/\{(\w+)\}/g,(r,i)=>i in t?String(t[i]):r):a}var xn=Object.defineProperty,kn=Object.getOwnPropertyDescriptor,ne=(e,t,s,a)=>{for(var r=a>1?void 0:a?kn(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&xn(t,s,r),r};let X=class extends K{constructor(){super(...arguments),this.loading=!0,this.failed="",this.forbidden=!1,this.view=null,this.pending=null,this.busy=!1,this.dlgError="",this.error="",this.done=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.loading=!0,this.failed="",this.forbidden=!1;try{this.view=await hn()}catch(e){Es(e)==="forbidden"?this.forbidden=!0:this.failed=fe(e)}finally{this.loading=!1}}get canEdit(){return!de()||Ye("system.configure")}ask(e,t){this.busy||!this.canEdit||(this.error="",this.done=null,this.dlgError="",this.pending={key:e,next:t})}refusalText(e,t){return e==="installPermit"?x("installPermitRefused"):e==="permit"?x("permitRefused"):e==="forbidden"?x("forbidden"):e==="invalid"?x("invalid"):`${x("failed")} · ${fe(t)}`}async confirm(){const e=this.pending;if(!(!e||this.busy)){this.busy=!0,this.dlgError="";try{this.view=await un(e.key,e.next),this.done=e.next,this.pending=null}catch(t){const s=Es(t);(s==="permit"||s==="installPermit")&&this.view?(this.view=s==="installPermit"?{...this.view,auto_install_permitted:!1}:{...this.view,go_live_permitted:!1},this.pending=null,this.error=this.refusalText(s,t)):this.dlgError=this.refusalText(s,t)}finally{this.busy=!1}}}stem(e){return e===De?"install":pn[e]}name(e){return x(`${this.stem(e)}Title`)}row(e,t){const s=wn(e,t)==="on",a=t===De,r=!s&&!(a?mn(e):fn(e)),i=this.stem(t);return o`<div class="sw-row" data-wiskey-switch=${i} data-state=${s?"on":"off"}>
      <div>
        <h4 class="t">${this.name(t)}<span class="pill" data-state=${s?"on":"off"} data-wiskey-state>${x(s?"on":"off")}</span></h4>
        <p class="x">${x(`${i}Text`)}</p>
        <p class="k" data-wiskey-details>${x("detailsKey")}: <code>${t}</code></p>
      </div>
      <sw-button variant=${s?"secondary":"primary"} data-wiskey-toggle ?disabled=${!this.canEdit||this.busy||r} @click=${()=>this.ask(t,s?"off":"on")}>${x(s?"turnOff":"turnOn")}</sw-button>
      ${r?o`<p class="why" data-wiskey-permit><sw-icon name="info" size="14"></sw-icon>${x(a?"installPermitMissing":"permitMissing")}</p>`:c}
    </div>`}dialog(){const e=this.pending;if(!e)return c;const t=e.next==="on",s=e.key===De,a=this.name(e.key);return o`<sw-dialog open heading=${x(t?"confirmOnQ":"confirmOffQ",{name:a})} data-wiskey-dialog=${e.next} @close=${()=>{this.busy||(this.pending=null)}}>
      <p style="margin:0">${x(s?t?"installConfirmOnText":"installConfirmOffText":t?"confirmOnText":"confirmOffText")}</p>
      ${this.dlgError?o`<p class="err-line" role="alert" data-wiskey-dialog-error>${this.dlgError}</p>`:c}
      <div class="foot"><sw-button variant="ghost" data-wiskey-cancel ?disabled=${this.busy} @click=${()=>this.pending=null}>${x("cancel")}</sw-button>
        <sw-button variant=${t?"primary":"danger"} data-wiskey-confirm ?disabled=${this.busy} @click=${()=>void this.confirm()}>${x(t?"turnOn":"turnOff")}</sw-button></div>
    </sw-dialog>`}body(){if(this.loading)return o`<sw-state-panel state="loading"></sw-state-panel>`;if(this.forbidden)return o`<sw-state-panel state="forbidden" data-wiskey-forbidden></sw-state-panel>`;if(this.failed||!this.view)return o`<sw-state-panel state="error" heading=${x("loadFailed")} hint=${this.failed} actionLabel=${x("retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=this.view;return o`<sw-card flush data-wiskey-switches>
      <p class="lead">${x("lead")}</p>
      ${dn.map(t=>this.row(e,t))}
      <h3 class="grp-h" data-wiskey-install-group>${x("installGroup")}</h3>
      ${this.row(e,De)}
      ${this.error?o`<div class="note err" role="alert" data-wiskey-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:c}
      ${this.done&&!this.error?o`<div class="grp"><span class="ok" role="status" data-wiskey-saved><sw-icon name="check" size=${16}></sw-icon>${x(this.done==="on"?"doneOn":"doneOff")}</span></div>`:c}
    </sw-card>
    <system-security-wiskey-managed></system-security-wiskey-managed>
    ${this.dialog()}`}render(){return o`<sw-page crumbs="הגדרות | אבטחה" heading=${x("title")}>${this.body()}</sw-page>`}};X.styles=[zt,Z`
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
    `,Ne];ne([d()],X.prototype,"loading",2);ne([d()],X.prototype,"failed",2);ne([d()],X.prototype,"forbidden",2);ne([d()],X.prototype,"view",2);ne([d()],X.prototype,"pending",2);ne([d()],X.prototype,"busy",2);ne([d()],X.prototype,"dlgError",2);ne([d()],X.prototype,"error",2);ne([d()],X.prototype,"done",2);X=ne([U("system-security-wiskey")],X);var $n=Object.defineProperty,zn=Object.getOwnPropertyDescriptor,ye=(e,t,s,a)=>{for(var r=a>1?void 0:a?zn(t,s):t,i=e.length-1,n;i>=0;i--)(n=e[i])&&(r=(a?n(t,s,r):n(r))||r);return a&&r&&$n(t,s,r),r};function Sn(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?String(e):Cs(t)}let be=class extends K{constructor(){super(...arguments),this.bubbleSkin=new $t(this),this.sub="",this.panelId="",this.presenceKnown=la()!==null,this.tabsMode=new ca(this,"settings"),this.giveUp=0}connectedCallback(){super.connectedCallback(),this.stopPresence=da(e=>{ma(e),this.presenceKnown=e!==null,this.requestUpdate()}),pa(),this.giveUp=window.setTimeout(()=>this.presenceKnown=!0,2500)}disconnectedCallback(){super.disconnectedCallback(),this.stopPresence?.(),window.clearTimeout(this.giveUp)}get api(){return de()}permitted(e){const t=Ie.find(s=>s.id===e);return!!t&&(!this.api||He(t.href??"",ke))}offered(){return ha(Ie,this.api,ke)}redirectTo(e){const t=e==="alarm"&&this.panelId?`?panel=${encodeURIComponent(this.panelId)}`:"";window.location.replace(`#/system/security/${e}${t}`)}render(){const e=this.offered();if(!Ie.some(r=>r.id===this.sub)||!this.permitted(this.sub)){if(this.api&&!this.presenceKnown)return o`<sw-state-panel state="loading"></sw-state-panel>`;const r=e[0]?.href?.split("/").pop();return r?(queueMicrotask(()=>this.redirectTo(r)),o`<sw-state-panel state="loading"></sw-state-panel>`):o`<sw-page crumbs="הגדרות" heading="אבטחה"><sw-state-panel state="forbidden" data-security-settings-forbidden></sw-state-panel></sw-page>`}const s=Ie.find(r=>r.id===this.sub),a=s&&!e.some(r=>r.id===s.id)?[...e,s]:e;return o`${a.length>1?o`<div class="tabs" data-security-settings-tabs><sw-tabs .variant=${this.tabsMode.props(qt("system.security")).variant} ?adaptive=${this.tabsMode.props(qt("system.security")).adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} .items=${a} .active=${this.sub}></sw-tabs></div>`:c}
      ${this.sub==="alarm"?o`<security-alarm .panelId=${this.panelId}></security-alarm>`:this.sub==="manage"?o`<sw-page crumbs="הגדרות | אבטחה" heading="ניהול אזעקה" subheading="לוחות, קוד הלוח, שיוך חיישנים לעקיפה ומדיניות מרחוק"><system-alarm-settings ?canEdit=${this.api&&ke("system.configure",!0)}></system-alarm-settings></sw-page>`:this.sub==="cameras"?o`<system-security-cameras></system-security-cameras>`:this.sub==="privacy-masks"?o`<system-security-privacy-masks></system-security-privacy-masks>`:this.sub==="public"?o`<system-security-public></system-security-public>`:this.sub==="wiskey"?o`<system-security-wiskey></system-security-wiskey>`:this.sub==="incidents"?o`<sw-page crumbs="הגדרות | אבטחה" heading="מצב אירוע חי" subheading="עמוד אחד לאירוע בזמן אמת: צפייה בלבד, ללא פעולה פיזית"><incident-settings-form data-incident-settings-page></incident-settings-form></sw-page>`:o`<system-security-nvr></system-security-nvr>`}`}};be.styles=[fa,Z`
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
  `,Ne];ye([R()],be.prototype,"sub",2);ye([R()],be.prototype,"panelId",2);ye([d()],be.prototype,"presenceKnown",2);be=ye([U("system-security")],be);let Ce=class extends K{constructor(){super(...arguments),this.bubbleSkin=new $t(this),this.h=null,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(de())try{this.h=await D("health"),this.error=""}catch(e){this.error=fe(e)}}render(){if(!de())return o`<sw-page crumbs="הגדרות | אבטחה" heading="NVR"><sw-state-panel icon="shield" state="empty" heading="המצב מוצג מול שרת אמיתי" hint="במצב הדגמה אין NVR לקרוא."></sw-state-panel></sw-page>`;if(this.error&&!this.h)return o`<sw-page crumbs="הגדרות | אבטחה" heading="NVR"><sw-state-panel state="error" heading="מצב ה־NVR לא נטען" hint=${this.error} actionLabel="נסו שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`;if(!this.h)return o`<sw-page crumbs="הגדרות | אבטחה" heading="NVR"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.h,t=ua()||e.mode==="ha_only",s=[{href:"#/system/setup",label:"חיבורים והגדרות ה־NVR",show:He("#/system/setup",ke)},{href:Bt,label:"הגדרות מצלמות",show:!t&&He(Bt,ke)},{href:"#/investigate/health",label:"בריאות מצלמות",show:!t&&He("#/investigate/health",ke)}].filter(a=>a.show);return o`<sw-page crumbs="הגדרות | אבטחה" heading="NVR" subheading=${t?"ללא NVR":e.nvr_configured?"מוגדר":"לא מוגדר"}>
      <sw-card heading="מצב" data-security-nvr>
        <div class="rows">
          <div class="row"><span>NVR</span><span class=${t?"":e.nvr_configured?"msg ok":"msg err"}>${t?"מצב ללא NVR":e.nvr_configured?"מוגדר":"לא מוגדר"}</span></div>
          ${t?c:o`<div class="row"><span>זרם התראות</span><span class=${e.events.ingest.connected?"msg ok":"msg err"}>${e.events.ingest.connected?"מחובר":"מנותק"}</span></div>
                <div class="row"><span>ערוצים שגולו</span><span>${e.discovery.cameras}</span></div>
                <div class="row"><span>גילוי אחרון תקין</span><span class=${e.discovery.cameras_last_error?"warn":""}>${Sn(e.discovery.cameras_last_ok)}</span></div>`}
        </div>
        ${s.length?o`<div class="actions">${s.map(a=>o`<sw-button size="sm" variant="ghost" @click=${()=>window.location.hash=a.href}>${a.label}</sw-button>`)}</div>`:c}
      </sw-card>
    </sw-page>`}};Ce.styles=[be.styles,Ne];ye([d()],Ce.prototype,"h",2);ye([d()],Ce.prototype,"error",2);Ce=ye([U("system-security-nvr")],Ce);export{be as SystemSecurity,Ce as SystemSecurityNvr};
//# sourceMappingURL=system-security-4BMKUrbh.js.map
