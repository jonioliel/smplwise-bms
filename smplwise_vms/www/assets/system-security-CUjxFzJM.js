const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{j as K,z as R,a as J,A as d,b as l,Bv as Ht,m as W,ce as b,af as oe,bv as Ca,F as E,bg as C,bw as Be,c as k,iH as Ta,k as h,aU as La,Bw as Na,Bx as Ma,bo as et,iX as tt,dL as u,aX as jt,q as $e,g as Pa,By as ts,bs as pe,bu as it,br as nt,bt as ot,eV as Aa,aM as Le,dO as Ia,kb as qa,fj as ss,eH as Va,ai as as,fo as Xs,bE as Da,cd as Ba,cb as lt,eG as Fa,bp as Ha,l as ja,kk as ft,kl as mt,Bz as Ua,el as Ka,BA as Wa,BB as Ga,BC as Ue,BD as Je,BE as Ya,ep as rs,xt as Ce,gy as Qa,BF as is,BG as Ja}from"./index-HK12zoPD.js";import"./security-alarm-DVA7eSHo.js";import"./system-alarm-DCTUzgp4.js";import{t as n}from"./media-BcD4JgoJ.js";import{T as Xa}from"./toast-controller-BPX0Tkjm.js";import{u as Zs,p as ns,d as Za,P as os,e as ls,f as cs,S as er,R as tr,g as sr,h as ar,i as rr,j as ir,k as nr}from"./nvr-h264-preset-CfVfamRk.js";import{b as Fe}from"./bubble-chrome-5ObbvscE.js";import{l as ds}from"./live-C8F_CHHR.js";import{F as or,G as lr}from"./access-grants-C3adQZm0.js";import{s as Ut}from"./status-css-DOceH8T9.js";import{s as M,p as hs,c as ps}from"./pending-model-B-pL7PkI.js";import{s as cr,e as dr}from"./confirm-words-B3Rj8-Uo.js";import"./settings-form-0KAqlhnY.js";import{_ as hr}from"./sw-logo-art-PLtEZJxU.js";import{a as pr,c as H,b as ur}from"./camera-source-dialog-CI_WQmMN.js";import{s as fr}from"./settings-DYAYUgHz.js";var mr=Object.defineProperty,wr=Object.getOwnPropertyDescriptor,ea=(e,t,s,a)=>{for(var r=a>1?void 0:a?wr(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&mr(t,s,r),r};let st=class extends J{constructor(){super(...arguments),this.model=null,this.cancel=()=>this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=this.model;return l`<sw-dialog ?open=${!!e} heading=${e?.heading??""} data-nvr-confirm-dialog @close=${t=>{t.stopPropagation(),this.cancel()}}>
      ${e?l`<p data-nvr-confirm-lead>${e.lead}</p>
            <p class="count" data-nvr-confirm-count>${e.count}</p>
            <details data-nvr-confirm-details>
              <summary>${n("פרטים")}</summary>
              ${e.names?l`<ul class="names" data-nvr-confirm-names tabindex="0" aria-label=${n("המצלמות")}>${e.names.map(t=>l`<li>${t}</li>`)}</ul>`:l`<ul>${e.details.map(t=>l`<li data-field=${t.field}><span class="k">${t.label}</span><bdi>${t.from}</bdi><span class="arrow" aria-hidden="true">${Ht()}</span><bdi>${t.to}</bdi></li>`)}</ul>`}
            </details>
            ${e.extraLabel?l`<div class="extra"><sw-button variant="ghost" size="sm" data-nvr-extra @click=${()=>this.dispatchEvent(new CustomEvent("extra",{bubbles:!0,composed:!0}))}>${e.extraLabel}</sw-button></div>`:d}
            <sw-button slot="footer" variant="ghost" data-nvr-cancel @click=${this.cancel}>${n("ביטול")}</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-confirm @click=${()=>this.dispatchEvent(new CustomEvent("confirm",{bubbles:!0,composed:!0}))}>${e.confirmLabel}</sw-button>`:d}
    </sw-dialog>`}};st.styles=K`
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
  `;ea([R({attribute:!1})],st.prototype,"model",2);st=ea([W("nvr-confirm")],st);function gr(e){if(!e||typeof e!="object")return null;const t=e,s="options"in t&&!Array.isArray(t.codec)?t.options:t;if(!br(s))return null;const a=s;return a.locks?a:{...a,locks:{}}}const Ke=e=>Array.isArray(e),Pe=e=>!!e&&typeof e=="object"&&!Array.isArray(e),us=e=>e==null||Pe(e)&&typeof e.min=="number"&&typeof e.max=="number";function br(e){if(!Pe(e))return!1;const t=e;return Ke(t.codec)&&Pe(t.profile)&&Pe(t.resolution)&&Ke(t.fps)&&Ke(t.bitrate_mode)&&Ke(t.quality)&&us(t.bitrate_kbps)&&us(t.gop)&&(t.locks===void 0||Pe(t.locks))}const ne=encodeURIComponent,vr={recorders:()=>C("nvr/recorders"),cameras:e=>C(`nvr/cameras${e?`?recorder_id=${ne(e)}`:""}`),camera:e=>C(`nvr/cameras/${ne(e)}`),options:async(e,t,s)=>gr(await C(`nvr/cameras/${ne(e)}/streams/${ne(t)}/options${s?`?codec=${ne(s)}`:""}`)),writeStream:(e,t,s)=>Be(`nvr/cameras/${ne(e)}/streams/${ne(t)}`,s),changes:(e,t=30)=>C(`nvr/changes?camera_id=${ne(e)}&limit=${t}`),undo:e=>E(`nvr/changes/${ne(e)}/rollback`,{confirm:!0}),addChannel:(e,t)=>E(`nvr/recorders/${ne(e)}/channels`,t),removeChannel:(e,t)=>Ca(`nvr/cameras/${ne(e)}/channel`,{method:"DELETE",body:JSON.stringify({confirm_name:t})})};function ta(e){if(!e.codec)return["unknown","codec_unknown"];if(e.codec==="H.265")return["unknown","h265"];if(e.codec==="MJPEG")return["no","mjpeg"];if(e.codec!=="H.264")return["unknown","codec_other"];if(e.b_frames===!0)return["no","b_frames"];if(e.svc===!0)return["unknown","svc"];const t=(e.profile??"").toLowerCase();return e.b_frames===!1||t.startsWith("baseline")||t.startsWith("bp")||t.startsWith("constrained")?["ok","h264_no_b_frames"]:["ok","h264"]}const Z=e=>JSON.parse(JSON.stringify(e)),We={recorder_id:"nvr-1",name:"NVR ראשי",vendor:"hikvision",model:"DS-7616NI-DEMO",firmware:"V4.84 demo",enabled:!0,online:!0,checked_at:"2026-10-01T09:00:00Z",error:null,capabilities:{read_encodings:!0,write_encodings:!0,add_channel:!0,remove_channel:!0,max_channels:16,used_channels:4,encoding_fields:["codec","profile","resolution","fps","bitrate_mode","bitrate_kbps","quality","gop","svc","smart_codec"]}},sa={codec:["H.264","H.265"],profile:{"H.264":["Baseline","Main","High"],"H.265":["Main"]},resolution:{"H.264":["2560x1440","1920x1080","1280x720"],"H.265":["2560x1440","1920x1080"]},fps:[25,20,15,12,10,8,6,4,2,1],fps_full:!0,bitrate_mode:["CBR","VBR"],bitrate_kbps:{min:32,max:8192},quality:[10,30,45,60,75,90],gop:{min:1,max:400},svc:!0,smart_codec:!0,b_frames:!1,locks:{smart_codec:["gop","bitrate_mode","quality"]},source:"capabilities"},yr={...sa,resolution:{"H.264":["640x360","640x480","352x288"],"H.265":["640x360","640x480"]},bitrate_kbps:{min:32,max:2048},smart_codec:!1,locks:{}};function we(e,t,s){const a={stream_ref:e,role:t,enabled:!0,codec:"H.264",codec_raw:"H.264",codec_plus:!1,profile:null,resolution:"1920x1080",fps:25,fps_full:!1,bitrate_mode:"VBR",bitrate_kbps:2048,quality:60,gop:50,svc:null,smart_codec:!1,b_frames:null,webrtc:"unknown",webrtc_reason:"codec_unknown",fields:{b_frames:{supported:!1,editable:!1}},writable:!0,not_writable_reason:null,etag:`${e}-1`,...s};return a.svc===null&&(a.fields.svc={supported:!1,editable:!1}),[a.webrtc,a.webrtc_reason]=ta(a),a.codec_plus=a.smart_codec===!0||String(a.codec_raw??"").endsWith("+"),a}function $r(){const e=(s,a,r,i={})=>({camera_id:`demo-cam-${s}`,recorder_id:"nvr-1",source_ref:String(s),channel:s,name:a,online:!0,enabled_in_arx:!0,streams:r,error:null,...i}),t=s=>we(`${s}02`,"sub",{resolution:"640x360",fps:20,bitrate_kbps:1024});return[e(1,"כניסה",[we("101","main",{resolution:"2560x1440",fps:null,fps_full:!0,bitrate_kbps:3072,svc:!0}),t(1)]),e(2,"חניה",[we("201","main",{resolution:"2560x1440",fps:null,fps_full:!0,bitrate_kbps:3072,svc:!0}),t(2)]),e(3,"חצר אחורית",[we("301","main",{codec:"H.265",codec_raw:"H.265",profile:"Main",resolution:"2560x1440",bitrate_kbps:2048,svc:!1}),we("302","sub",{codec:"H.265",codec_raw:"H.265",profile:"Main",resolution:"640x360",fps:20,bitrate_kbps:512,svc:!0,smart_codec:!0}),we("303","third",{resolution:"1280x720",fps:12,bitrate_kbps:1024})]),e(4,"מחסן",[we("401","main",{resolution:"1920x1080",svc:!1,profile:"High"}),t(4)],{online:!1})]}function S(e,t,s,a={}){throw new k(e,{code:t,user_message:s,retryable:!1,correlation_id:"demo",details:a})}const fs={codec:b("קידוד"),profile:b("פרופיל"),resolution:b("רזולוציה"),fps:"FPS",bitrate_mode:b("סוג קצב"),bitrate_kbps:b("קצב"),quality:b("איכות"),gop:"GOP",svc:"SVC",smart_codec:"Smart codec",b_frames:"B-frames"};b("ראשי"),b("משני"),b("שלישי"),b("נוסף");class xr{constructor(){this.cameras_=$r(),this.changes_=[],this.seq=0}find(t){return this.cameras_.find(s=>s.camera_id===t)??S(404,"not_found",b("המצלמה לא נמצאה."))}optionsOf(t){return Z(t.role==="main"?sa:yr)}async recorders(){return{recorders:[{...Z(We),capabilities:{...We.capabilities,used_channels:this.cameras_.length}}],can_write:!0}}async cameras(t){return{cameras:Z(this.cameras_.filter(s=>!t||s.recorder_id===t)),recorders_failed:[],stale:!1,can_write:!0}}async camera(t){const s=this.find(t);return{camera:Z(s),can_write:!0,options:Object.fromEntries(s.streams.map(a=>[a.stream_ref,this.optionsOf(a)]))}}async options(t,s,a){const r=this.find(t).streams.find(o=>o.stream_ref===s)??S(404,"not_found",b("הזרם לא נמצא.")),i=this.optionsOf(r);return a&&!i.codec.includes(a)&&S(422,"value_not_allowed",b("הערך אינו נתמך במצלמה."),{fields:["codec"],field:"codec",allowed:i.codec}),i}async writeStream(t,s,a){const r=this.find(t),i=r.streams.find(x=>x.stream_ref===s)??S(404,"not_found",b("הזרם לא נמצא."));a.confirm!==!0&&S(422,"confirm_required",b("נדרש אישור.")),a.if_match!==i.etag&&S(409,"stale",b("הערכים השתנו ב־NVR. נטען מחדש."),{stream:Z(i)}),r.online===!1&&S(503,"source_unavailable",b("המצלמה אינה זמינה כרגע."));const o=this.optionsOf(i),c=a.changes,f=Object.keys(c);f.length||S(422,"validation",b("אין מה לשנות."));const p=c.codec??i.codec??"H.264",v=(x,He,je)=>{He||S(422,"value_not_allowed",b("הערך אינו נתמך במצלמה."),{field:x,allowed:je??[]})};for(const x of f)i.fields[x]?.supported===!1&&S(422,"field_not_supported",b("{field} אינו נתמך בזרם הזה.",{field:fs[x]}),{fields:[x],field:x});c.codec!==void 0&&v("codec",o.codec.includes(c.codec),o.codec),c.profile!==void 0&&v("profile",(o.profile[p]??[]).includes(c.profile),o.profile[p]),c.resolution!==void 0&&v("resolution",(o.resolution[p]??[]).includes(c.resolution),o.resolution[p]),c.fps!==void 0&&v("fps",c.fps==="full"?o.fps_full:o.fps.includes(c.fps),o.fps),c.bitrate_mode!==void 0&&v("bitrate_mode",o.bitrate_mode.includes(c.bitrate_mode),o.bitrate_mode),c.bitrate_kbps!==void 0&&v("bitrate_kbps",c.bitrate_kbps>=o.bitrate_kbps.min&&c.bitrate_kbps<=o.bitrate_kbps.max,[o.bitrate_kbps.min,o.bitrate_kbps.max]),c.quality!==void 0&&v("quality",(c.bitrate_mode??i.bitrate_mode)==="VBR"&&o.quality.includes(c.quality),o.quality),c.gop!==void 0&&v("gop",c.gop>=o.gop.min&&c.gop<=o.gop.max,[o.gop.min,o.gop.max]),c.svc!==void 0&&v("svc",o.svc),c.smart_codec!==void 0&&v("smart_codec",o.smart_codec),c.b_frames!==void 0&&S(422,"field_not_supported",b("{field} אינו נתמך בזרם הזה.",{field:"B-frames"}),{fields:["b_frames"],field:"b_frames"});const y=c.smart_codec??i.smart_codec;for(const x of y?o.locks.smart_codec??[]:[])x in c&&x!=="smart_codec"&&S(422,"field_locked",b("{field} נעול כש־Smart codec פעיל.",{field:fs[x]}),{fields:[x],field:x,locked_by:"smart_codec"});const N=Z(i),B=[],ce=[],fe=(x,He,je)=>{i[He]===je?ce.push(x):(i[He]=je,B.push(x))};if(c.codec!==void 0&&(fe("codec","codec",c.codec),i.codec_raw=c.codec,c.profile===void 0&&(i.profile=null)),c.profile!==void 0&&fe("profile","profile",c.profile),c.resolution!==void 0&&fe("resolution","resolution",c.resolution),c.fps!==void 0){const x=c.fps==="full";i.fps_full===x&&(x||i.fps===c.fps)?ce.push("fps"):([i.fps_full,i.fps]=[x,x?null:c.fps],B.push("fps"))}c.bitrate_mode!==void 0&&fe("bitrate_mode","bitrate_mode",c.bitrate_mode),c.bitrate_kbps!==void 0&&fe("bitrate_kbps","bitrate_kbps",c.bitrate_kbps),c.quality!==void 0&&fe("quality","quality",c.quality),c.gop!==void 0&&fe("gop","gop",c.gop),c.svc!==void 0&&fe("svc","svc",c.svc),c.smart_codec!==void 0&&fe("smart_codec","smart_codec",c.smart_codec),[i.webrtc,i.webrtc_reason]=ta(i),B.length&&(i.etag=`${i.stream_ref}-${++this.seq+1}`);const Zt=`demo-change-${++this.seq}`;if(!B.length)return{change:null,stream:Z(i),applied_fields:[],unchanged_fields:ce,reboot_required:!1};const Oa=Object.fromEntries(B.map(x=>[x,[N[x],i[x]]])),es=new Date().toISOString();return this.changes_.push({id:Zt,camera_id:t,stream_ref:s,before:N,after:Z(i),status:"applied",fields:Oa,created_at:es}),{change:{id:Zt,status:"applied",kind:"stream_encoding",created_at:es},stream:Z(i),applied_fields:B,unchanged_fields:ce,reboot_required:!1}}async changes(t,s=30){return{changes:this.changes_.filter(r=>r.camera_id===t).reverse().slice(0,s).map(r=>({id:r.id,status:r.status,kind:"stream_encoding",created_at:r.created_at,camera_id:r.camera_id,stream_ref:r.stream_ref,fields:r.fields}))}}async undo(t){const s=this.changes_.find(f=>f.id===t)??S(404,"not_found",b("השינוי לא נמצא."));s.status!=="applied"&&S(409,"not_rollbackable",b("אין לשינוי הזה מסמך קודם להחזיר."),{status:s.status});const a=this.find(s.camera_id),r=a.streams.findIndex(f=>f.stream_ref===s.stream_ref);(r<0||a.streams[r].etag!==s.after.etag)&&S(409,"stale",b("הערכים השתנו ב־NVR. נטען מחדש.")),a.streams[r]={...Z(s.before),etag:`${s.stream_ref}-${++this.seq+1}`},s.status="rolled_back";const i=`demo-change-${++this.seq}`,o=new Date().toISOString(),c=Object.fromEntries(Object.entries(s.fields).map(([f,p])=>[f,[p[1],p[0]]]));return this.changes_.push({id:i,camera_id:s.camera_id,stream_ref:s.stream_ref,before:s.after,after:Z(a.streams[r]),status:"applied",fields:c,created_at:o}),{change:{id:i,status:"applied",kind:"stream_encoding",created_at:o},stream:Z(a.streams[r]),rollback_of:t,reboot_required:!1}}async addChannel(t,s){t!==We.recorder_id&&S(404,"not_found",b("ה־NVR לא נמצא.")),s.confirm!==!0&&S(422,"confirm_required",b("נדרש אישור.")),(!s.name.trim()||!s.address.trim()||!s.username.trim()||!s.password)&&S(422,"validation",b("חסרים פרטים."));const a=new Set(this.cameras_.map(c=>c.channel)),r=We.capabilities.max_channels??0;let i=1;for(;a.has(i);)i++;return i>r&&S(409,"channel_slots_full",b("אין ערוץ פנוי ב־NVR.")),this.cameras_.push({camera_id:`demo-cam-${i}`,recorder_id:t,source_ref:String(i),channel:i,name:s.name.trim(),online:!0,enabled_in_arx:!0,error:null,streams:[we(`${i}01`,"main",{svc:!1}),we(`${i}02`,"sub",{resolution:"640x360",fps:20,bitrate_kbps:1024})]}),{change:{id:`demo-change-${++this.seq}`,status:"applied",kind:"channel_add",created_at:new Date().toISOString()},channel:{source_ref:String(i),name:s.name.trim(),online:!0},discovery:"queued"}}async removeChannel(t,s){const a=this.find(t);s.trim()!==a.name&&S(422,"confirm_required",b("השם אינו תואם.")),this.cameras_=this.cameras_.filter(r=>r.camera_id!==t)}}let _r=null;const ze=()=>oe()?vr:_r??=new xr,se="—",te={main:n("ראשי"),sub:n("משני"),third:n("שלישי"),other:n("נוסף")},Ot={main:0,sub:1,third:2,other:3};function kr(e){const t=[];for(const s of e){const a={cameraKey:`${s.recorder_id}:${s.source_ref}`,recorderId:s.recorder_id,cameraId:s.camera_id,channel:s.channel,cameraName:s.name,online:s.online,enabledInArx:s.enabled_in_arx,error:s.error};s.streams.length||t.push({...a,key:`${a.cameraKey}:none`,stream:null});for(const r of s.streams)t.push({...a,key:`${a.cameraKey}:${r.stream_ref}`,stream:r})}return t}function Ae(e){return!e||!e.codec?se:e.codec_plus&&(e.codec==="H.264"||e.codec==="H.265")?`${e.codec}+`:e.codec}const zr=e=>e?.codec==="H.265";function Ct(e){return e?.resolution?e.resolution.replace(/x/i,"×"):se}function ms(e){return e?e.fps_full?n("מלא"):e.fps===null||e.fps===void 0?se:String(Number.isInteger(e.fps)?e.fps:Number(e.fps.toFixed(2))):se}function ws(e){return e?.bitrate_kbps?`${e.bitrate_kbps} kbps`:se}function Sr(e){return e?.svc===!0?n("פעיל"):e?.svc===!1?n("כבוי"):se}const gs={ok:n("מתנגן בדפדפן"),no:n("לא מתנגן בדפדפן"),unknown:n("לא ידוע")};function bs(e){return e==null?se:String(e)}const wt={q:"",codec:"",role:"",svc:"",webrtc:""},vs=e=>!!(e.q.trim()||e.codec||e.role||e.svc||e.webrtc);function Rr(e){const t=e.stream;return[e.cameraName,n("ערוץ {channel}",{channel:e.channel}),String(e.channel),t?te[t.role]:"",t?t.role:"",Ae(t),t?.codec_raw??"",t?.profile??"",Ct(t),t?.resolution??"",t?.bitrate_mode??"",t?.stream_ref??"",t?.svc===!0?"svc":""].join(" ").toLowerCase()}function Er(e,t){let s=t.toLowerCase();const a=[...s.matchAll(/ערוץ\s*(\d+)/g)].map(o=>Number(o[1]));if(s=s.replace(/ערוץ\s*\d+/g," "),a.length&&!a.includes(e.channel))return!1;const r=s.split(/\s+/).filter(Boolean);if(!r.length)return!0;const i=Rr(e);return r.every(o=>i.includes(o))}function Or(e,t){return e.filter(s=>{const a=s.stream;if(!Er(s,t.q))return!1;if(t.codec){const r=a?.codec==="H.264"?"h264":a?.codec==="H.265"?"h265":"other";if(!a||r!==t.codec)return!1}if(t.role){const r=a?.role==="main"||a?.role==="sub"?a.role:"other";if(!a||r!==t.role)return!1}if(t.svc){const r=a?.svc===!0?"on":a?.svc===!1?"off":"none";if(!a||r!==t.svc)return!1}return!(t.webrtc&&(!a||a.webrtc!==t.webrtc))})}const aa={key:"channel",dir:"asc"},Cr={no:0,unknown:1,ok:2};function ys(e,t){const s=e.stream;switch(t){case"channel":return e.channel;case"camera":return e.cameraName;case"role":return s?Ot[s.role]:null;case"codec":return s?.codec?Ae(s):null;case"svc":return s?.svc===!0?1:s?.svc===!1?0:null;case"resolution":{const a=/^(\d+)x(\d+)$/i.exec(s?.resolution??"");return a?Number(a[1])*Number(a[2]):null}case"fps":return s?s.fps_full?Number.MAX_SAFE_INTEGER:s.fps??null:null;case"bitrate":return s?.bitrate_kbps??null;case"gop":return s?.gop??null;case"webrtc":return s?Cr[s.webrtc]??1:null}}function Tr(e,t=aa){const s=t.dir==="desc"?-1:1,a=new Intl.Collator("he",{numeric:!0,sensitivity:"base"}),r=(i,o)=>i.channel-o.channel||(i.stream?Ot[i.stream.role]:9)-(o.stream?Ot[o.stream.role]:9)||(i.stream?.stream_ref??"").localeCompare(o.stream?.stream_ref??"");return[...e].sort((i,o)=>{const c=ys(i,t.key),f=ys(o,t.key);if(c===null&&f===null)return r(i,o);if(c===null)return 1;if(f===null)return-1;const p=typeof c=="number"&&typeof f=="number"?c-f:a.compare(String(c),String(f));return p?p*s:r(i,o)})}function Lr(e,t){return e.key===t?{key:t,dir:e.dir==="asc"?"desc":"asc"}:{key:t,dir:"asc"}}function Nr(e){const t=new Set;let s=0,a=0;for(const r of e)t.add(r.cameraKey),r.stream&&(s++,r.stream.webrtc==="no"&&a++);return{cameras:t.size,streams:s,notWebrtc:a}}function Mr(e,t){return t===0||e[t-1].cameraKey!==e[t].cameraKey}const g={codec:n("קידוד"),profile:n("פרופיל"),resolution:n("רזולוציה"),fps:"FPS",bitrate_mode:n("סוג קצב"),bitrate_kbps:n("קצב"),quality:n("איכות"),gop:"GOP",svc:"SVC",smart_codec:"Smart codec",b_frames:"B-frames"},Ne={show:!1,enabled:!1,reason:""},I={read_only:n("השינוי אינו זמין"),not_supported:n("ה־NVR אינו תומך בשינוי הזרם הזה"),capabilities_unreadable:n("יכולות הזרם אינן ידועות"),proxied:n("ה־NVR אינו מאפשר לשנות את הזרם הזה"),offline:n("המצלמה אינה מקוונת"),stale:n("ה־NVR אינו זמין"),detail_error:n("ה־NVR אינו זמין"),no_options:n("יכולות הזרם אינן ידועות"),device_refused:n("ה־NVR אינו מעביר שינויים למצלמה הזו"),write_api_missing:n("ה־NVR אינו תומך בשינוי הגדרות זרם"),no_caps:n("יכולות הזרם אינן ידועות"),writes_disabled:n("כתיבה ל־NVR הזה כבויה")},ra=e=>e?I[e]??I.no_options:I.read_only;function Pr(e,t,s,a){if(!s||!a.canWrite||!t.camera_id||e==="svc"&&s.svc===null||a.detail===null)return Ne;if(a.stale)return{show:!0,enabled:!1,reason:I.stale};if(a.detail==="error")return{show:!0,enabled:!1,reason:I.detail_error};if(a.detail.stale)return{show:!0,enabled:!1,reason:I.stale};if(a.detail.can_write===!1)return Ne;const r=a.detail.camera.streams.find(o=>o.stream_ref===s.stream_ref)??s;if(r.writable===!1)return{show:!0,enabled:!1,reason:ra(r.not_writable_reason)};if(r.writable!==!0)return Ne;if(t.online===!1)return{show:!0,enabled:!1,reason:I.offline};const i=a.detail.options?.[s.stream_ref];return i?e==="svc"&&!i.svc?{show:!0,enabled:!1,reason:I.not_supported}:s.etag===null?{show:!0,enabled:!1,reason:I.stale}:{show:!0,enabled:!0,reason:""}:{show:!0,enabled:!1,reason:I.no_options}}function ge(e,t){return t==null||t===""?se:typeof t=="boolean"?t?n("פעיל"):n("כבוי"):e==="fps"?t==="full"||t===0?n("מלא"):String(t):e==="resolution"?String(t).replace(/x/i,"×"):e==="bitrate_kbps"?`${t} kbps`:String(t)}const Tt=e=>e===1?n("שינוי אחד"):n("{n} שינויים",{n:e});function Ar(e,t){return t==="fps"?e.fps_full?"full":e.fps:e[t]}function ia(e,t,s){const a=Object.keys(s).filter(c=>s[c]!==void 0),r=a.length===1?a[0]:null,i=n("{camera} · {role}. השידור ייקטע לכמה שניות.",{camera:e,role:te[t.role]}),o=a.map(c=>({field:c,label:g[c],from:ge(c,Ar(t,c)),to:ge(c,s[c])}));if(r==="svc"){const c=s.svc===!0;return{heading:c?n("להפעיל SVC?"):n("לכבות SVC?"),lead:i,count:Tt(1),confirmLabel:c?n("הפעל"):n("כבה"),details:o}}return{heading:n("לשמור את השינויים?"),lead:i,count:Tt(a.length),confirmLabel:n("שמור"),details:o}}const Ir=e=>e.code==="source_unavailable"&&e.details?.outcome==="unknown",$s={stale:n("הערכים השתנו ב־NVR. נטען מחדש."),write_in_progress:n("שינוי אחר של הזרם הזה מתבצע. נסו שוב בעוד רגע."),batch_in_progress:n("מתבצע שינוי מרובה"),nvr_busy:n("ה־NVR עסוק. נסו שוב בעוד רגע."),nvr_no_effect:n("ה־NVR אישר את השינוי אבל לא שינה את ההגדרה."),nvr_diverged:n("ה־NVR שינה רק חלק מההגדרות. נטען מחדש."),nvr_not_supported:n("ה־NVR אינו תומך בשינוי הזה."),nvr_rejected:n("ה־NVR דחה את השינוי."),capabilities_unreadable:n("יכולות הזרם אינן ידועות, ולכן השינוי בוטל."),confirm_required:n("נדרש אישור."),value_not_allowed:n("הערך אינו נתמך במצלמה."),field_locked:n("השדה נעול כרגע."),field_not_supported:n("השדה אינו נתמך בזרם הזה."),not_rollbackable:n("אי אפשר לבטל את השינוי הזה."),forbidden:n("אין הרשאה לפעולה הזו."),source_unavailable:n("ה־NVR אינו זמין."),source_forbidden:n("ל־NVR אין הרשאה לשינוי הזה.")};function qr(e){return Ta(new k(e.status,{code:e.code,user_message:e.user_message??"",retryable:!1,correlation_id:"",details:e.details??{}}))[0]}function at(e){if(Ir(e))return{text:n("הסטטוס נבדק"),reload:!0};const t=e.code==="stale"||e.code==="nvr_diverged";if(e.code==="value_not_allowed"&&typeof e.details?.codec=="string"&&e.user_message)return{text:e.user_message,reload:t};const s=e.code==="value_not_allowed"?qr(e):void 0;return s&&s in g?{text:`${g[s]}: ${$s.value_not_allowed}`,reload:t}:{text:$s[e.code]??(e.user_message||n("השינוי לא נשמר.")),reload:t}}const ve=e=>e==null?"":String(e);function Kt(e){return{codec:ve(e.codec),profile:ve(e.profile),resolution:ve(e.resolution),fps:e.fps_full?"full":ve(e.fps),bitrate_mode:ve(e.bitrate_mode),bitrate_kbps:ve(e.bitrate_kbps),quality:ve(e.quality),gop:ve(e.gop),svc:e.svc,smart_codec:e.smart_codec}}const Lt=e=>/^\d{1,7}$/.test(e.trim())?Number(e):null;function Wt(e,t,s){const a=s.codec||e.codec||"",r=o=>e.fields[o]?.supported!==!1,i=[];return r("codec")&&t.codec.length&&i.push("codec"),r("profile")&&(t.profile[a]??[]).length&&i.push("profile"),r("resolution")&&(t.resolution[a]??[]).length&&i.push("resolution"),r("fps")&&(t.fps.length||t.fps_full)&&i.push("fps"),r("bitrate_mode")&&t.bitrate_mode.length&&i.push("bitrate_mode"),r("bitrate_kbps")&&t.bitrate_kbps&&i.push("bitrate_kbps"),r("quality")&&t.quality.length&&i.push("quality"),r("gop")&&t.gop&&i.push("gop"),r("svc")&&t.svc&&e.svc!==null&&i.push("svc"),r("smart_codec")&&t.smart_codec&&e.smart_codec!==null&&i.push("smart_codec"),i}function Gt(e,t,s,a){if(t.fields[e]?.editable===!1)return t.fields[e]?.locked_by??e;for(const[r,i]of Object.entries(s.locks))if(i?.includes(e)&&e!==r&&a[r]===!0)return r;return e==="quality"&&a.bitrate_mode!=="VBR"?"bitrate_mode":null}function gt(e,t,s){const a=[],r=s.codec||e.codec||"",i=Kt(e);for(const o of Wt(e,t,s))if(!Gt(o,e,t,s)&&!(s.codec===i.codec&&o in i&&s[o]===i[o]))switch(o){case"codec":t.codec.includes(s.codec)||a.push(o);break;case"profile":(t.profile[r]??[]).includes(s.profile)||a.push(o);break;case"resolution":(t.resolution[r]??[]).includes(s.resolution)||a.push(o);break;case"fps":(s.fps==="full"?!t.fps_full:!t.fps.includes(Number(s.fps)))&&a.push(o);break;case"bitrate_mode":t.bitrate_mode.includes(s.bitrate_mode)||a.push(o);break;case"bitrate_kbps":{const c=Lt(s.bitrate_kbps);(c===null||c<t.bitrate_kbps.min||c>t.bitrate_kbps.max)&&a.push(o);break}case"quality":t.quality.includes(Number(s.quality))||a.push(o);break;case"gop":{const c=Lt(s.gop);(c===null||c<t.gop.min||c>t.gop.max)&&a.push(o);break}}return a}function xs(e,t,s){const a={},r=Kt(e);for(const i of Wt(e,t,s))if(!Gt(i,e,t,s))switch(i){case"codec":case"profile":case"resolution":case"bitrate_mode":s[i]&&s[i]!==r[i]&&(a[i]=s[i]);break;case"fps":s.fps&&s.fps!==r.fps&&(a.fps=s.fps==="full"?"full":Number(s.fps));break;case"bitrate_kbps":case"quality":case"gop":{const o=Lt(s[i]);o!==null&&s[i]!==r[i]&&(a[i]=o);break}case"svc":case"smart_codec":s[i]!==null&&s[i]!==r[i]&&(a[i]=s[i]);break}return a}function Vr(e,t){const s=e.codec,a={...e};return(t.profile[s]??[]).includes(a.profile)||(a.profile=""),(t.resolution[s]??[]).includes(a.resolution)||(a.resolution=""),a}function Dr(e){let t=e.fields;if(t==null)try{t=e.fields_json?JSON.parse(e.fields_json):null}catch{t=null}if(!t||typeof t!="object"||Array.isArray(t))return[];const s=[];for(const[a,r]of Object.entries(t))Array.isArray(r)&&r.length===2?s.push({field:a,from:ge(a,r[0]),to:ge(a,r[1])}):r&&typeof r=="object"&&"to"in r&&s.push({field:a,from:ge(a,r.from),to:ge(a,r.to)});return s}const Br=e=>g[e]??e,Fr={pending:n("בתהליך"),applied:n("נשמר"),unchanged:n("ללא שינוי"),no_effect:n("לא נקלט"),refused:n("נדחה"),failed:n("נכשל"),diverged:n("נשמר חלקית"),rolled_back:n("בוטל")};function Hr(e,t,s=5){return e.filter(a=>a.kind==="stream_encoding"&&a.stream_ref===t).sort((a,r)=>a.created_at<r.created_at?1:a.created_at>r.created_at?-1:0).slice(0,s)}function jr(e){const t=e[0];return t&&(t.status==="applied"||t.status==="diverged")?t:null}function Ur(e,t){return e instanceof k?{status:e.status,code:e.code,user_message:e.body.user_message,details:e.body.details??{}}:t?{status:0,code:"source_unavailable",details:{outcome:"unknown"}}:{status:0,code:"network",user_message:n("אין חיבור לשרת.")}}function Nt(e,t){const s=Ur(e,t),a=s.code==="stale"&&s.details?.stream&&typeof s.details.stream=="object"?s.details.stream:null;return{ok:!1,line:at(s),code:s.code,stream:a}}async function na(e,t,s){if(t.etag===null)return Nt(new k(409,{code:"stale",user_message:"",retryable:!1,correlation_id:"",details:{}}),!1);try{const a=await ze().writeStream(e,t.stream_ref,{if_match:t.etag,confirm:!0,changes:s});return{ok:!0,stream:a.stream,change:a.change,rebootRequired:a.reboot_required,kind:"write",unchanged:a.change===null}}catch(a){return Nt(a,!0)}}async function oa(e){try{const t=await ze().undo(e);return{ok:!0,stream:t.stream,change:t.change,rebootRequired:t.reboot_required,kind:"undo",unchanged:!1}}catch(t){return Nt(t,!0)}}var Kr=Object.defineProperty,Wr=Object.getOwnPropertyDescriptor,X=(e,t,s,a)=>{for(var r=a>1?void 0:a?Wr(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&Kr(t,s,r),r};const me={gone:n("הזרם אינו זמין כרגע. סגרו את החלונית ופתחו שוב."),loading:n("טוען את האפשרויות של הקידוד. נסו שוב בעוד רגע."),no_options:n("יכולות הזרם אינן ידועות, ולכן אי אפשר לשמור."),invalid:n("יש לבחור ערך תקין"),nothing:n("אין שינויים לשמירה."),failed:n("השינוי לא נשמר. נסו שוב.")};let F=class extends J{constructor(){super(...arguments),this.open=!1,this.camera=null,this.stream=null,this.options=null,this.draft=null,this.opts=null,this.optsCodec="",this.loading=!1,this.confirm=null,this.busy=!1,this.line="",this.history=null,this.pending=null,this.hseq=0,this.oseq=0,this.key="",this.save=()=>{try{const e=this.stream,t=this.opts;if(!e||!this.draft||!this.camera?.camera_id)return void(this.line=me.gone);if(this.loading)return void(this.line=me.loading);if(!t||!this.optsFit)return void(this.line=me.no_options);const s=gt(e,t,this.draft);if(s.length)return void(this.line=`${me.invalid}: ${s.map(r=>g[r]).join(", ")}`);const a=xs(e,t,this.draft);if(!Object.keys(a).length)return void(this.line=me.nothing);this.line="",this.pending=a,this.confirm=ia(this.camera.name,e,a)}catch(e){console.error("nvr editor: save failed",e),this.pending=null,this.confirm=null,this.line=me.failed}},this.close=()=>this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}willUpdate(e){const t=this.stream,s=this.open&&t&&this.camera?`${this.camera.camera_id}:${t.stream_ref}:${t.etag}`:"";if(s!==this.key){const a=!this.key&&!!s;this.key=s,s&&t&&(this.draft=Kt(t),this.opts=this.options,this.optsCodec=t.codec??"",this.oseq++,this.loading=!1,a&&(this.line="",this.history=null),this.loadHistory())}else e.has("options")&&this.draft&&t&&this.draft.codec===(t.codec??"")&&(this.opts=this.options,this.optsCodec=t.codec??"")}get optsFit(){return!!this.opts&&!!this.draft&&!this.loading&&this.optsCodec===this.draft.codec}updated(){const e=this.draft;if(e)for(const t of this.renderRoot.querySelectorAll("select[data-f]")){const s=String(e[t.dataset.f]??"");t.value!==s&&(t.value=s)}}async loadHistory(){const e=this.camera,t=this.stream;if(!e?.camera_id||!t)return;const s=++this.hseq;try{const a=await ze().changes(e.camera_id,30);if(s!==this.hseq)return;this.history=Hr(a.changes,t.stream_ref,5)}catch{s===this.hseq&&(this.history=[])}}set(e,t){this.draft&&(this.draft={...this.draft,[e]:t},this.line="")}async onCodec(e){const t=this.camera,s=this.stream;if(!this.draft||!t?.camera_id||!s){this.line=me.gone;return}this.set("codec",e);const a=++this.oseq;this.loading=!0;try{const r=await ze().options(t.camera_id,s.stream_ref,e);if(a!==this.oseq||!this.draft)return;if(!r){this.line=at({status:503,code:"capabilities_unreadable"}).text;return}this.opts=r,this.optsCodec=e,this.draft=Vr(this.draft,r)}catch(r){if(a!==this.oseq)return;this.line=at({status:r.status??0,code:r.code??"network",user_message:r.message}).text}finally{a===this.oseq&&(this.loading=!1)}}async confirmed(){const e=this.camera,t=this.stream,s=this.pending;if(this.confirm=null,this.pending=null,!e?.camera_id||!t||!s){this.line=me.gone;return}this.busy=!0,this.line="";try{const a=await na(e.camera_id,t,s);this.result(a)}catch(a){console.error("nvr editor: write failed",a),this.line=me.failed}finally{this.busy=!1}}async undo(e){this.busy=!0,this.line="";const t=await oa(e);this.busy=!1,this.result(t)}result(e){e.ok||(this.line=e.line.text),this.dispatchEvent(new CustomEvent("written",{detail:{result:e},bubbles:!0,composed:!0}))}select(e,t,s,a,r,i){const o=this.draft,c=String(o[e]??"");return l`<label class="f ${r?"bad":""}" data-field=${e}>
      <span class="l">${t}</span>
      <select data-f=${e} aria-label=${t} title=${a??""} ?disabled=${!!a||this.busy} @change=${f=>e==="codec"?void this.onCodec(f.target.value):this.set(e,f.target.value)}>
        ${c===""||!s.includes(c)?l`<option value="" selected disabled>—</option>`:d}
        ${s.map(f=>l`<option value=${f} ?selected=${f===c}>${i?i(f):f}</option>`)}
      </select>
    </label>`}number(e,t,s,a,r,i){const o=this.draft;return l`<label class="f ${i?"bad":""}" data-field=${e}>
      <span class="l">${t}</span>
      <input type="number" inputmode="numeric" min=${s} max=${a} step="1" aria-label=${t} title=${r??""} .value=${o[e]} ?disabled=${!!r||this.busy} @input=${c=>this.set(e,c.target.value)} />
    </label>`}toggle(e,t,s){const a=this.draft;return l`<div class="f sw" data-field=${e}>
      <span class="l">${t}</span>
      <sw-toggle label=${t} labelHidden .checked=${a[e]===!0} ?disabled=${!!s||this.busy} title=${s??""} data-editor-toggle=${e}
        @change=${r=>this.set(e,r.detail.checked)}></sw-toggle>
    </div>`}fields(){const e=this.stream,t=this.opts,s=this.draft,a=new Set(gt(e,t,s)),r=s.codec||e.codec||"",i=o=>Gt(o,e,t,s)?n("{field} נעול",{field:g[o]}):null;return Wt(e,t,s).map(o=>{switch(o){case"codec":return this.select(o,g[o],t.codec,i(o),a.has(o));case"profile":return this.select(o,g[o],t.profile[r]??[],i(o),a.has(o));case"resolution":return this.select(o,g[o],t.resolution[r]??[],i(o),a.has(o),c=>c.replace(/x/i,"×"));case"fps":return this.select(o,g[o],[...t.fps_full?["full"]:[],...t.fps.map(String)],i(o),a.has(o),c=>c==="full"?n("מלא"):c);case"bitrate_mode":return this.select(o,g[o],t.bitrate_mode,i(o),a.has(o));case"quality":return this.select(o,g[o],t.quality.map(String),i(o),a.has(o));case"bitrate_kbps":return this.number(o,g[o],t.bitrate_kbps.min,t.bitrate_kbps.max,i(o),a.has(o));case"gop":return this.number(o,g[o],t.gop.min,t.gop.max,i(o),a.has(o));case"svc":case"smart_codec":return this.toggle(o,g[o],i(o));default:return d}})}when(e){const t=new Date(e);return Number.isNaN(t.getTime())?"":La(t)}renderHistory(){const e=this.history;if(!e||!e.length)return d;const t=jr(e);return l`<details class="history" data-nvr-history>
      <summary>${n("שינויים אחרונים")}</summary>
      <ol>${e.map(s=>l`<li data-change=${s.id} data-status=${s.status}>
          <span class="when">${this.when(s.created_at)} · ${Fr[s.status]??s.status}</span>
          <span class="what">${Dr(s).map(a=>l`<span>${Br(a.field)} <bdi>${a.from}</bdi> ${Ht()} <bdi>${a.to}</bdi></span>`)}</span>
          ${t&&t.id===s.id?l`<sw-button size="sm" data-nvr-undo-change ?disabled=${this.busy} @click=${()=>void this.undo(s.id)}>${n("בטל")}</sw-button>`:d}
        </li>`)}</ol>
    </details>`}render(){const e=this.stream,t=this.camera,s=this.open&&!!e&&!!t&&!!this.draft&&!!this.opts,a=s?xs(e,this.opts,this.draft):{},r=Object.keys(a).length>0,i=s?gt(e,this.opts,this.draft).length===0:!1;return l`<sw-drawer modal ?open=${this.open} heading=${t?.name??""} subheading=${e?`${te[e.role]}`:""} data-nvr-editor @close=${o=>{o.stopPropagation(),this.close()}}>
      ${s?l`<form @submit=${o=>o.preventDefault()} data-nvr-editor-form aria-busy=${this.busy}>${this.fields()}</form>
            ${this.line?l`<p class="line" role="status" data-nvr-editor-line>${this.line}</p>`:d}
            ${this.renderHistory()}
            <sw-button slot="footer" variant="ghost" data-nvr-editor-cancel @click=${this.close}>${n("ביטול")}</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-editor-save ?disabled=${!r||!i||this.busy||!this.optsFit} @click=${this.save}>${n("שמור")}</sw-button>`:d}
      <nvr-confirm .model=${this.confirm} @confirm=${()=>void this.confirmed()} @cancel=${()=>(this.confirm=null,this.pending=null)}></nvr-confirm>
    </sw-drawer>`}};F.styles=K`
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
  `;X([R({type:Boolean})],F.prototype,"open",2);X([R({attribute:!1})],F.prototype,"camera",2);X([R({attribute:!1})],F.prototype,"stream",2);X([R({attribute:!1})],F.prototype,"options",2);X([h()],F.prototype,"draft",2);X([h()],F.prototype,"opts",2);X([h()],F.prototype,"optsCodec",2);X([h()],F.prototype,"loading",2);X([h()],F.prototype,"confirm",2);X([h()],F.prototype,"busy",2);X([h()],F.prototype,"line",2);X([h()],F.prototype,"history",2);F=X([W("nvr-camera-editor")],F);var Gr=Object.defineProperty,Yr=Object.getOwnPropertyDescriptor,Se=(e,t,s,a)=>{for(var r=a>1?void 0:a?Yr(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&Gr(t,s,r),r};let be=class extends J{constructor(){super(...arguments),this.message="",this.actionLabel="",this.linkLabel="",this.linkHref="",this.duration=1e4,this.busy=!1,this.clock=new Xa(this,{onExpire:()=>this.dispatchEvent(new CustomEvent("dismiss",{bubbles:!0,composed:!0}))})}arm(){this.clock.clear(),this.message&&this.clock.show(this.message,{ms:this.duration>0?this.duration:0})}updated(e){(e.has("message")||e.has("duration"))&&this.arm(),this.message&&Ma(this)}render(){return this.message?l`<div class="toast" role="status" aria-live="polite" data-nvr-toast>
      <span data-nvr-toast-text>${this.message}</span>
      ${this.actionLabel?l`<button type="button" data-nvr-undo ?disabled=${this.busy} @click=${()=>this.dispatchEvent(new CustomEvent("undo",{bubbles:!0,composed:!0}))}>${this.actionLabel}</button>`:d}
      ${this.linkLabel&&this.linkHref?l`<a href=${this.linkHref} data-nvr-toast-link>${this.linkLabel}</a>`:d}
      <button type="button" class="x" aria-label=${n("סגור")} data-nvr-toast-close @click=${()=>this.dispatchEvent(new CustomEvent("dismiss",{bubbles:!0,composed:!0}))}>✕</button>
    </div>`:d}};be.styles=[Na,K`
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
  `];Se([R()],be.prototype,"message",2);Se([R()],be.prototype,"actionLabel",2);Se([R()],be.prototype,"linkLabel",2);Se([R()],be.prototype,"linkHref",2);Se([R({type:Number})],be.prototype,"duration",2);Se([R({type:Boolean})],be.prototype,"busy",2);be=Se([W("nvr-undo-toast")],be);const Xe=encodeURIComponent;function Mt(e){if(!e||typeof e!="object")return null;const t=e;if(typeof t.batch_id=="string")return t;if(t.batch&&typeof t.batch=="object")return Mt(t.batch);if(Array.isArray(t.batches)){const s=t.batches.filter(a=>!!a&&typeof a=="object"&&typeof a.batch_id=="string");return s.find(a=>a.state==="running")??s[0]??null}return null}const Qr=500;function ye(e){return{...e,rollback_of:e.rollback_of??e.source_batch_id??null}}async function Jr(e){let t=null;const s=[];let a=0;for(let r=0;r<400;r++){const i=await C(`nvr/stream-batches/${Xe(e)}?offset=${a}&limit=${Qr}`);if(t??=i,s.push(...i.items??[]),i.next_offset===null||i.next_offset===void 0||i.next_offset<=a)break;a=i.next_offset}return ye({...t,items:s})}const Xr={start:async e=>ye(await E("nvr/stream-batches",e)),get:e=>Jr(e),active:async()=>{const e=Mt(await C("nvr/stream-batches?active=1"));return e?ye(e):null},stop:async e=>{const t=Mt(await E(`nvr/stream-batches/${Xe(e)}/stop`,{}));return t?ye(t):null},undo:async e=>ye(await E(`nvr/stream-batches/${Xe(e)}/rollback`,{confirm:!0})),previewEncoding:e=>E("nvr/encoding-batches/preview",e),startEncoding:async e=>ye(await E("nvr/encoding-batches",e)),recheck:async e=>ye(await E(`nvr/stream-batches/${Xe(e)}/verify`,{})),recent:async()=>((await C("nvr/stream-batches"))?.batches??[]).filter(t=>!!t&&typeof t.batch_id=="string").map(ye)},Y=()=>Xr,Ze={confirmed:n("המצלמה אישרה"),nvr_accepted:n("המקליט קיבל"),still_old:n("עדיין בקידוד הקודם"),restart_needed:n("צריך אתחול"),failed:n("נכשל"),unchanged:n("כבר מוגדר")},Zr={confirmed:"ok",nvr_accepted:"info",still_old:"warn",restart_needed:"warn",failed:"bad",unchanged:"muted"},ei=["still_old","restart_needed","failed"],la=e=>typeof e=="string"&&e in Ze;function ti(e){if(!e||!la(e.outcome))return"";if(e.label)return e.label;switch(e.outcome){case"confirmed":return e.expected?n("המצלמה אישרה ({expected})",{expected:e.expected}):Ze.confirmed;case"still_old":return e.media_codec?n("עדיין {media_codec}",{media_codec:e.media_codec}):Ze.still_old;case"failed":return n("נכשל: {reason}",{reason:e.reason??n("השינוי לא בוצע")});default:return Ze[e.outcome]}}const si=e=>e&&la(e.outcome)?Zr[e.outcome]:"muted",ai=n("אם ה־NVR מסרב לשנות מצלמה"),ri=[{id:"skip",label:n("לדלג ולהמשיך")},{id:"stop",label:n("לעצור את כל ההמרה")}],ii={skip:n("המצלמה נשארת כמו שהיא ונרשמת בדוח, וההמרה ממשיכה לשאר המצלמות."),stop:n("ההמרה נעצרת במצלמה הראשונה שה־NVR מסרב לשנות; מה שכבר השתנה נשאר, ואפשר להחזיר אותו.")},_s=(e,t="skip")=>e==="skip"||e==="stop"?e:t,ks=n("בסוף תוצג בדיקה של מה שכל מצלמה שולחת בפועל.");function ni(e){return e==="skip"?n("השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה; מצלמה שה־NVR מסרב לשנות תדולג וההמרה תמשיך. {VERIFY_NOTE}",{VERIFY_NOTE:ks}):n("השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה. {VERIFY_NOTE}",{VERIFY_NOTE:ks})}function oi(e){return e==="skip"?n("השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה; מצלמה שה־NVR מסרב להחזיר תדולג, ואפשר לנסות אותה שוב."):n("השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה ותעצור בשגיאה הראשונה.")}const zs=e=>e?.state==="running"||e?.state==="pending",ee=e=>typeof e=="number"&&e>0?e:0,Pt=e=>e.filter(Boolean).join(" · "),_e=e=>e===1?n("זרם אחד"):n("{k} זרמים",{k:e});function li(e){if(!e||e.state==="none")return"";if(e.state==="pending")return n("הבדיקה תתחיל בסיום השינוי.");if(e.state==="running")return n("בודק מה כל מצלמה שולחת בפועל…");const t=e.counts??{},s=Pt([ee(t.confirmed)>0&&n("המצלמה אישרה: {streams}",{streams:_e(ee(t.confirmed))}),ee(t.nvr_accepted)>0&&n("המקליט קיבל (לא נבדק במצלמה): {streams}",{streams:_e(ee(t.nvr_accepted))}),ee(t.still_old)>0&&n("עדיין בקידוד הקודם: {streams}",{streams:_e(ee(t.still_old))}),ee(t.restart_needed)>0&&n("צריך אתחול: {streams}",{streams:_e(ee(t.restart_needed))}),ee(t.failed)>0&&n("נכשל: {streams}",{streams:_e(ee(t.failed))}),(e.skipped?.length??0)>0&&n("דולגו: {streams}",{streams:_e(e.skipped.length)}),ee(t.unchanged)>0&&n("כבר מוגדר: {streams}",{streams:_e(ee(t.unchanged))})]);return e.state==="interrupted"?Pt([n("הבדיקה נקטעה; אפשר לבדוק שוב"),s]):s||n("אין זרמים בדוח.")}function Ie(e,t){const s=e.items??[];return t==="worklist"?s.filter(a=>!!a.verify&&ei.includes(a.verify.outcome)):t==="skipped"?s.filter(a=>a.skipped===!0):s}function ci(e){const t=Ie(e,"all").length,s=Ie(e,"worklist").length,a=Ie(e,"skipped").length;return[{id:"all",label:n("כל הזרמים"),count:t},{id:"worklist",label:n("מצלמות שלא השתנו"),count:s},{id:"skipped",label:n("דולגו"),count:a}].filter(r=>r.id!=="skipped"||r.count>0)}function di(e){return e.kind==="rollback"?n("דוח בדיקה · החזרה לערכים הקודמים"):n("דוח בדיקה · שינוי קידוד")}function hi(e){switch(e.code){case"verify_too_soon":return n("בדיקה חוזרת אפשרית בעוד כמה שניות.");case"verify_in_progress":return n("הבדיקה עדיין מתבצעת.");case"nothing_to_verify":return n("אין מצלמות לבדיקה חוזרת.");case"verify_not_available":return n("בדיקה חוזרת קיימת רק לשינוי קידוד.");case"network":return n("אין חיבור לשרת.");default:return e.status===403?n("אין הרשאה לפעולה הזו."):e.user_message||n("הבדיקה לא התחילה.")}}const Ss=n("בדיקה חוזרת קוראת בלבד: רשימת הזרמים מה־NVR ומה שהמצלמות שולחות. שום הגדרה לא משתנה.");function pi(e){return e.filter(t=>t.mode==="encoding").sort((t,s)=>String(s.created_at??"").localeCompare(String(t.created_at??"")))}function ca(e){if(!e)return"";const t=new Date(e);if(Number.isNaN(t.getTime()))return"";const s=a=>String(a).padStart(2,"0");return`${s(t.getDate())}.${s(t.getMonth()+1)} ${s(t.getHours())}:${s(t.getMinutes())}`}function ui(e){const t=e.kind==="rollback"?n("החזרה לערכים הקודמים"):e.settings?.codec?n("המרה ל־{codec}",{codec:e.settings.codec}):n("שינוי קידוד");return Pt([t,ca(e.created_at)])}function fi(e,t){const s=r=>r.find(i=>i.role==="main")??null;return(t&&t!=="error"?s(t.camera.streams):null)??s(e.streams)}function mi(e,t,s){if(s)return[];const a=[];for(const r of e){if(!r.camera_id||r.online===!1)continue;const i=t.get(r.camera_id);if(i==="error"||i&&i.can_write===!1)continue;const o=fi(r,i);!o||o.codec!=="H.264"||o.svc!==!0||o.writable===!1||!o.etag||i&&i.options&&i.options[o.stream_ref]===null||a.push({cameraId:r.camera_id,recorderId:r.recorder_id,name:r.name,channel:r.channel,streamRef:o.stream_ref,etag:o.etag})}return a.sort((r,i)=>r.channel-i.channel||r.name.localeCompare(i.name,"he"))}function wi(e,t){let s=t.trim().toLowerCase();if(!s)return e;const a=[...s.matchAll(/ערוץ\s*(\d+)/g)].map(i=>Number(i[1]));s=s.replace(/ערוץ\s*\d+/g," ");const r=s.split(/\s+/).filter(Boolean);return e.filter(i=>{if(a.length&&!a.includes(i.channel))return!1;const o=`${i.name} ${i.channel}`.toLowerCase();return r.every(c=>o.includes(c))})}function gi(e,t){const s=new Set(e);for(const a of t)s.add(a.cameraId);return s}function bi(e){return new Set(e?[e]:[])}function vi(e,t,s){if(t===s)return new Set(e);const a=new Set(e);return a.has(t)?a.delete(t):a.add(t),a}const bt=2,Ge=(e,t)=>e.filter(s=>t.has(s.cameraId));function yi(e,t,s,a,r=5){const i=s*a;if(s<=0)return{start:0,end:0,top:0,total:0};const o=Math.max(0,Math.floor(e/a)),c=Math.min(s,Math.max(0,o-r)),f=Math.min(s,Math.ceil((e+Math.max(t,a))/a)+r);return{start:c,end:f,top:c*a,total:i}}const $i=(e,t,s)=>Math.max(0,e*s-Math.max(0,t-s)/2),da=["applied","unchanged","rolled_back"],Yt=["failed","refused","no_effect","diverged"],ct=["running","pending"],ke=e=>e!=="running",At=e=>(e.items??[]).some(t=>t.status==="unknown"||ct.includes(t.status));function dt(e){const t={};if(e.items)for(const o of e.items)t[o.status]=(t[o.status]??0)+1;else Object.assign(t,e.counts??{});const s=(...o)=>o.reduce((c,f)=>c+(t[f]??0),0),a=e.total??(e.items?e.items.length:Object.values(t).reduce((o,c)=>o+(c??0),0)),r=s(...da),i=s(...Yt);return{total:a,ok:r,bad:i,unknown:s("unknown"),inFlight:s(...ct),queued:s("queued"),notAttempted:s("not_attempted"),processed:r+i,applied:e.kind==="rollback"?s("applied")+s("rolled_back"):s("applied"),restored:e.kind==="rollback"?s("applied","rolled_back"):s("applied")}}const ha=e=>e===1?n("מצלמה אחת"):n("{n} מצלמות",{n:e}),De=e=>e===1?n("במצלמה אחת"):n("ב־{n} מצלמות",{n:e}),pa=e=>e===1?n("בזרם אחד"):n("ב־{n} זרמים",{n:e}),rt=e=>e.mode==="encoding",qe=(e,t)=>rt(e)?pa(t):De(t);function Rs(e){return da.includes(e.status)?"ok":Yt.includes(e.status)?"bad":e.status==="unknown"?"unk":ct.includes(e.status)?"spin":e.status==="not_attempted"?"skip":"wait"}function xi(e,t){switch(e.status){case"queued":return"";case"running":case"pending":return t==="rollback"?n("מחזיר"):n("מתבצע");case"applied":return t==="rollback"?n("הוחזר"):n("נשמר");case"rolled_back":return n("הוחזר");case"unchanged":return n("ללא שינוי");case"unknown":return n("לא ברור אם בוצע. נבדק מול ה־NVR.");case"not_attempted":return n("לא בוצע");default:return at({status:0,code:e.error_code??e.status,user_message:e.user_message??void 0}).text}}function ua(e){return(e.items??[]).find(t=>Yt.includes(t.status))??(e.items??[]).find(t=>t.status==="unknown")??null}function Es(e){const t=e.items??[],s=i=>t.findIndex(i),a=s(i=>ct.includes(i.status));if(a>=0)return a;if(ke(e.state)){const i=ua(e);return i?t.indexOf(i):0}const r=s(i=>i.status==="queued");return r>=0?r:0}const It=e=>e.filter(Boolean).join(" · ");function _i(e,t,s,a){const r=i=>qe(e,i);return It(s?[t.restored>0&&n("הוחזר {where}",{where:r(t.restored)}),a>0&&n("לא הוחזר {where}",{where:r(a)})]:[t.applied>0&&n("נשמר {where}",{where:r(t.applied)}),t.bad>0&&n("נכשל {where}",{where:r(t.bad)}),t.unknown>0&&n("לא ברור אם בוצע {where}",{where:r(t.unknown)}),t.notAttempted>0&&n("לא בוצע {where}",{where:r(t.notAttempted)})])}function ki(e,t,s,a){const r=i=>qe(e,i);return{...a,tone:(e.skipped??0)>0?"warn":"done",title:rt(e)?s?n("הקידוד הוחזר {where}",{where:r(t.restored)}):t.applied>0?n("הקידוד עודכן {where}",{where:r(t.applied)}):n("ללא שינוי"):s?n("SVC הוחזר {where}",{where:De(t.restored)}):t.applied>0?n("SVC כבוי {where}",{where:De(t.applied)}):n("ללא שינוי"),sub:It([!s&&t.applied>0&&t.ok>t.applied&&n("ללא שינוי {where}",{where:r(t.ok-t.applied)}),(e.skipped??0)>0&&n("דולג {where}",{where:r(e.skipped??0)})])}}function zi(e,t,s,a,r,i,o){if(e.state==="interrupted"&&e.stopped_reason==="unknown_not_applied"&&s)return{...i,tone:"error",title:t?n("ההחזרה נעצרה במצלמה {pname}",{pname:a}):n("נעצר במצלמה {pname}",{pname:a}),sub:o};if(r)return{...i,tone:"error",title:t?n("ההחזרה נעצרה: לא ברור אם בוצע במצלמה {pname}",{pname:a}):n("נעצר: לא ברור אם בוצע במצלמה {pname}",{pname:a}),sub:o};switch(e.state){case"stopped":return{...i,tone:"warn",title:t?n("ההחזרה נעצרה בבקשתך"):n("נעצר בבקשתך"),sub:o};case"failed":return{...i,tone:"error",title:t?n("ההחזרה נעצרה במצלמה {pname}",{pname:a}):n("נעצר במצלמה {pname}",{pname:a}),sub:o};default:return{...i,tone:"error",title:t?n("ההחזרה נקטעה באמצע"):n("השינוי נקטע באמצע"),sub:o}}}function Si(e,t,s=!1){const a=dt(e),r=e.kind==="rollback",i=ua(e),o=i?t(i):"",c=a.total-a.restored,f=At(e)||e.state==="running"||e.can_rollback===!1,p=!!i&&(e.state==="stopped_unknown"||e.state!=="running"&&e.stopped_reason==="unknown_unverified"),v={canStop:!1,showUndo:!1,canUndo:!1,showRetry:!1};if(e.state==="running")return{...v,tone:"running",title:n("{processed} מתוך {total}",{processed:a.processed,total:a.total}),sub:s?n("עוצר אחרי המצלמה הנוכחית"):a.unknown?n("נבדק מול ה־NVR"):"",canStop:!s};const y=_i(e,a,r,c),N=!r&&a.applied>0?{showUndo:!0,canUndo:!f}:{},B=r&&c>0&&e.rollback_of&&e.state!=="completed"?{showRetry:!0}:{};return e.state==="completed"&&!p?ki(e,a,r,{...v,...N}):zi(e,r,i,o,p,{...v,...N,...B},y)}function Ri(e){const t=dt(e),s=(e.skipped??0)>0?` · ${n("דולג {where}",{where:qe(e,e.skipped??0)})}`:"";return e.kind==="rollback"?{message:`${n("בוטל {where}",{where:qe(e,t.restored)})}${s}`,undo:!1}:t.applied===0?{message:`${n("ללא שינוי")}${s}`,undo:!1}:{message:`${n("נשמר {where}",{where:qe(e,t.applied)})}${s}`,undo:!0}}function vt(e,t){switch(e.code){case"batch_in_progress":return{text:n("מתבצע שינוי מרובה"),reload:!1};case"batch_not_enabled":return{text:n("השינוי המרובה אינו זמין."),reload:!1};case"forbidden":return{text:n("אין הרשאה לפעולה הזו."),reload:!1};case"stale":{const s=typeof e.details?.index=="number"?e.details.index:typeof e.details?.target=="number"?e.details.target:null,a=s!==null&&t?t(s):null;return{text:a?n("הערכים של {name} השתנו ב־NVR. נטען מחדש.",{name:a}):n("הערכים השתנו ב־NVR. נטען מחדש."),reload:!0}}case"batch_target_not_allowed":return{text:n("אחת המצלמות אינה מתאימה לשינוי. נטען מחדש."),reload:!0};case"write_in_progress":return{text:n("שינוי אחר של אחד הזרמים מתבצע. נסו שוב בעוד רגע."),reload:!1};case"capabilities_unreadable":return{text:n("יכולות הזרם אינן ידועות, ולכן השינוי בוטל."),reload:!1};case"confirm_required":return{text:n("נדרש אישור."),reload:!1};case"not_rollbackable":return{text:n("אי אפשר לבטל את השינוי הזה."),reload:!1};case"source_unavailable":return{text:n("ה־NVR אינו זמין."),reload:!1};case"network":return{text:n("אין חיבור לשרת."),reload:!1};default:return{text:e.status===422?e.user_message||n("הבחירה אינה תקינה."):e.user_message||n("הפעולה לא בוצעה."),reload:!1}}}const Ei=n("השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה."),Os=n("השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה ותעצור בשגיאה הראשונה.");function Oi(e){return{heading:n("לכבות SVC {where}?",{where:De(e.length)}),lead:Ei,count:ha(e.length),confirmLabel:n("כבה"),details:[],names:e}}function Ci(e,t="svc",s){return t==="encoding"?{heading:n("להחזיר את הקידוד {where}?",{where:pa(e.length)}),lead:s?oi(s):Os,count:e.length===1?n("זרם אחד"):n("{length} זרמים",{length:e.length}),confirmLabel:n("החזר"),details:[],names:e}:{heading:n("להחזיר SVC {where}?",{where:De(e.length)}),lead:Os,count:ha(e.length),confirmLabel:n("החזר"),details:[],names:e}}const qt="sw.nvr.batch.last";var Ti=Object.defineProperty,fa=(e,t,s,a)=>{for(var r=void 0,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=o(t,s,r)||r);return r&&Ti(t,s,r),r};const Vt=l`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>`,ma=K`
  :host {
    display: contents;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .count {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
    font-variant-numeric: tabular-nums;
  }
  /* the list's block-size is the dialog's own (the two differ) */
  .vl {
    contain: inline-size;
    inline-size: 100%;
    box-sizing: border-box;
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
  .msg {
    margin: 0;
    padding: 6px 8px;
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface-2);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  /* R5-LIVE-297 (the HOMEFABLE tiers in the multi-camera encoding dialog) and CAMADMIN-POLISH-2331 (the same language carried to the SVC
     checklist): the list is a WELL (surface-2, no outline, no hairlines between rows; the windowed row heights are untouched); a chosen
     row is a 26 % accent field with a 4 px accent bar at its start edge and a 22 px box, its name bold; rows tint on hover only under a
     fine pointer and darken on press; the count is a bold numeral; messages are wells */
  .vl {
    border-color: transparent;
    background: var(--sw-surface-2);
  }
  .count {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
  }
  .sel {
    border-block-end: 0;
    padding-inline: 14px;
    gap: 12px;
    font-size: var(--sw-fs-md);
    color: var(--sw-heading);
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
    background: color-mix(in srgb, var(--sw-accent) 26%, var(--sw-surface));
    /* the bar sits at the row's START edge: box-shadow offsets are physical, so RTL (the default) is the right edge */
    box-shadow: inset -4px 0 0 var(--sw-accent);
  }
  :host-context([dir='ltr']) .sel[aria-checked='true'] {
    box-shadow: inset 4px 0 0 var(--sw-accent);
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
  .sel .meta {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  .msg {
    padding: 8px 12px;
    border-radius: var(--sw-r-md);
  }
`;function Ve(e,t=!1){if(!(e instanceof k))return{status:0,code:"network"};const s={status:e.status,code:e.code,user_message:e.body.user_message};return t?{...s,details:e.body.details??{}}:s}async function Dt(e,t){if(!(!(e instanceof k)||e.status>=500))return!1;try{const a=await Y().active();if(a)return await t(a),!0}catch{}return!1}class ht extends J{constructor(){super(...arguments),this.listTop=0,this.viewH=360,this.onListScroll=t=>{this.listTop=t.target.scrollTop}}emit(t,s){this.dispatchEvent(new CustomEvent(t,{detail:s,bubbles:!0,composed:!0}))}measureList(){const t=this.renderRoot.querySelector(".vl");return t&&t.clientHeight>0&&Math.abs(t.clientHeight-this.viewH)>1&&(this.viewH=t.clientHeight),t}resetScroll(){this.listTop=0;const t=this.renderRoot.querySelector(".vl");t&&(t.scrollTop=0)}windowRows(t,s,a){const r=yi(this.listTop,this.viewH,t,s),i=[];for(let o=r.start;o<r.end;o++)i.push(o);return l`<div class="space" style="padding-block:${r.top}px ${Math.max(0,r.total-r.top-(r.end-r.start)*s)}px">${et(i,o=>o,o=>a(o))}</div>`}}fa([h()],ht.prototype,"listTop");fa([h()],ht.prototype,"viewH");var Li=Object.defineProperty,Ni=Object.getOwnPropertyDescriptor,G=(e,t,s,a)=>{for(var r=a>1?void 0:a?Ni(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&Li(t,s,r),r};const Mi=44,Cs=52,Pi=l`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg>`,Ye=e=>{try{e?window.localStorage.setItem(qt,e):window.localStorage.removeItem(qt)}catch{}},Ai=()=>{try{return window.localStorage.getItem(qt)}catch{return null}};let q=class extends ht{constructor(){super(...arguments),this.candidates=[],this.info={},this.streams={},this.phase="closed",this.selected=new Set,this.fixedId=null,this.q="",this.line="",this.starting=!1,this.batch=null,this.stopping=!1,this.offline=!1,this.confirmFor=null,this.pollSeq=0,this.timer=null,this.follow=!0,this.focusedKey="",this.nameOf=e=>{const t=e.camera_id?this.info[e.camera_id]?.name??e.camera_id:"—",s=this.batch?.mode==="encoding"&&e.camera_id?this.streams[`${e.camera_id}:${e.stream_ref}`]:"";return s?`${t} · ${s}`:t},this.takeControl=()=>{this.follow=!1}}openSelect(e){this.fixedId=e,this.selected=new Set([e]),this.q="",this.line="",this.listTop=0,this.phase="select"}async resume(){if(!this.batch)try{const e=await Y().active();if(e){this.adopt(await this.full(e),!0);return}const t=Ai();t&&this.adopt(await Y().get(t),!0)}catch(e){e instanceof k&&e.status===404&&Ye(null)}}show(){this.batch&&(this.follow=!0,this.phase="progress")}async undoAll(e){await this.runUndo(e)}async followBatch(e){this.line="",this.phase="progress";try{this.adopt(await this.full(e),!1,!0)}catch{this.adopt(e,!1,!0)}}async full(e){return Y().get(e.batch_id)}adopt(e,t=!1,s=!1){this.pollSeq++,this.stopping=!1,this.offline=!1,this.focusedKey="",this.follow=!0,this.batch=e,Ye(e.batch_id),this.emit("batch-change",{batch:e}),t&&(this.phase="progress"),this.timer&&clearTimeout(this.timer);const a=this.nextDelay(e);a!==null&&this.armPoll(e.batch_id,a),s&&ke(e.state)&&this.finished(e)}nextDelay(e){return e.state==="running"?1500:At(e)?5e3:null}armPoll(e,t){this.timer&&clearTimeout(this.timer);const s=this.pollSeq;this.timer=setTimeout(()=>void this.poll(e,s),t)}async poll(e,t){if(t!==this.pollSeq)return;let s=null;try{s=await Y().get(e),this.offline=!1}catch(r){if(t!==this.pollSeq)return;if(r instanceof k&&r.status===404){this.forget();return}this.offline=!0}if(t!==this.pollSeq)return;s&&this.apply(s);const a=this.batch;if(a&&a.batch_id===e){const r=s?this.nextDelay(s):3e3;r!==null&&this.armPoll(e,r)}}apply(e){const t=this.batch;this.batch=e,(e.state!=="running"||t&&t.batch_id!==e.batch_id)&&(this.stopping=!1),this.emit("batch-change",{batch:e}),t&&t.batch_id===e.batch_id&&t.state==="running"&&ke(e.state)&&this.finished(e)}finished(e){this.emit("batch-refresh"),rt(e)&&e.state==="completed"&&this.emit("verify-report",{batchId:e.batch_id}),e.state==="completed"?(this.phase="closed",Ye(null),this.emit("batch-finished",{batch:e})):(this.phase="progress",this.follow=!0)}forget(){this.pollSeq++,this.timer&&clearTimeout(this.timer),this.timer=null,this.batch=null,this.phase="closed",Ye(null),this.emit("batch-change",{batch:null})}closeDialog(){if(this.phase==="progress"&&this.batch&&ke(this.batch.state)&&!At(this.batch)){this.forget();return}this.phase="closed"}disconnectedCallback(){super.disconnectedCallback(),this.pollSeq++,this.timer&&clearTimeout(this.timer),this.timer=null}pickedNames(){return Ge(this.candidates,this.selected).map(e=>e.name)}askStart(){Ge(this.candidates,this.selected).length<bt||(this.line="",this.confirmFor={model:Oi(this.pickedNames()),run:()=>void this.start()},this.phase="confirm")}async start(){this.confirmFor=null;const e=Ge(this.candidates,this.selected);if(e.length<bt){this.phase="select";return}const t=e.map(a=>({camera_id:a.cameraId,stream_ref:a.streamRef,if_match:a.etag})),s=new Set(e.map(a=>a.recorderId));this.starting=!0,this.batch=null,this.line="",this.phase="progress";try{const a=await Y().start({confirm:!0,changes:{svc:!1},targets:t,...s.size===1?{recorder_id:e[0].recorderId}:{}});this.adopt(await this.full(a),!1,!0),this.starting=!1}catch(a){if(this.starting=!1,await Dt(a,async i=>this.adopt(await this.full(i))))return;const r=vt(Ve(a,!0),i=>{const o=e[i];return o?o.name:null});this.line=r.text,this.phase="select",r.reload&&this.emit("batch-refresh")}}async stop(){const e=this.batch;if(!(!e||this.stopping)){this.stopping=!0,this.line="";try{const t=await Y().stop(e.batch_id);t&&this.apply(t)}catch(t){t instanceof k?this.line=vt(Ve(t)).text:this.offline=!0,this.stopping=!1}this.batch&&this.batch.batch_id===e.batch_id&&!ke(this.batch.state)&&this.armPoll(e.batch_id,400)}}askUndo(){const e=this.batch;if(!e)return;const t=e.kind==="rollback"?e.rollback_of:e.batch_id;if(!t)return;const s=(e.items??[]).filter(a=>e.kind==="rollback"?Rs(a)!=="ok":a.status==="applied").map(this.nameOf);this.line="",this.confirmFor={model:Ci(s,e.mode,e.on_refusal),run:()=>void this.runUndo(t)},this.phase="undo-confirm"}async runUndo(e){this.confirmFor=null;const t=this.batch;this.starting=!0,this.line="",this.phase="progress";try{const s=await Y().undo(e);this.adopt(await this.full(s),!1,!0),this.starting=!1}catch(s){if(this.starting=!1,await Dt(s,async a=>this.adopt(await this.full(a))))return;this.line=vt(Ve(s,!0)).text,t?(this.batch=t,this.phase="progress"):this.phase="closed"}}willUpdate(e){if(e.has("candidates")&&this.selected.size){const t=new Set(this.candidates.map(a=>a.cameraId)),s=[...this.selected].filter(a=>t.has(a));s.length!==this.selected.size&&(this.selected=new Set(s)),this.fixedId&&!t.has(this.fixedId)&&(this.fixedId=null)}}updated(){const e=this.measureList();if(e&&this.phase==="progress"&&this.batch?.items?.length&&this.follow){const t=this.batch,s=`${t.batch_id}:${t.state}:${Es(t)}`;s!==this.focusedKey&&(this.focusedKey=s,e.scrollTop=$i(Es(t),e.clientHeight||this.viewH,Cs))}}vlist(e,t,s,a,r,i=e){const o=Math.max(i,3)*t;return l`<div class="vl" role="list" aria-label=${r} tabindex="0" data-nvr-batch-list=${s} data-rows=${e} style=${`--vl-fit:${o}px`} @scroll=${this.onListScroll} @wheel=${this.takeControl} @touchstart=${this.takeControl} @pointerdown=${this.takeControl}>
      ${this.windowRows(e,t,a)}
    </div>`}selectRow(e){const t=this.selected.has(e.cameraId),s=e.cameraId===this.fixedId;return l`<button type="button" class="sel" role="checkbox" aria-checked=${t?"true":"false"} aria-disabled=${s?"true":"false"} data-nvr-batch-cam=${e.cameraId}
      @click=${()=>this.selected=vi(this.selected,e.cameraId,this.fixedId)}>
      <span class="box" aria-hidden="true">${t?Vt:d}</span><span class="nm">${e.name}</span><span class="meta">${n("ערוץ")} <span class="ltr">${e.channel}</span> · <bdi class="ltr">H.264</bdi></span>
    </button>`}renderSelect(){const e=wi(this.candidates,this.q),t=Ge(this.candidates,this.selected).length,s=this.q.trim().length>0;return l`<sw-dialog wide ?open=${this.phase==="select"} heading=${n("כיבוי SVC בכמה מצלמות")} data-nvr-batch-select @close=${a=>{a.stopPropagation(),this.phase="closed"}}>
      ${this.phase==="select"?l`<div class="tools">
              <sw-field><input type="search" placeholder=${n("חיפוש מצלמה")} aria-label=${n("חיפוש מצלמה")} data-nvr-batch-search .value=${this.q} @input=${a=>{this.q=a.target.value,this.resetScroll()}} /></sw-field>
              <sw-button size="sm" data-nvr-batch-all ?disabled=${!e.length} @click=${()=>this.selected=gi(this.selected,e)}>${s?n("בחר הכל ({length})",{length:e.length}):n("בחר הכל")}</sw-button>
              <sw-button size="sm" variant="ghost" data-nvr-batch-clear @click=${()=>this.selected=bi(this.fixedId)}>${n("נקה")}</sw-button>
            </div>
            <div class="count" data-nvr-batch-count role="status">${n("נבחרו {ticked} מתוך {length}",{ticked:t,length:this.candidates.length})}${s?n(" · {length} תוצאות",{length:e.length}):""}</div>
            ${e.length?this.vlist(e.length,Mi,"select",a=>this.selectRow(e[a]),n("מצלמות"),this.candidates.length):l`<p class="msg" data-nvr-batch-none role="status">${n("אין מצלמות שמתאימות לחיפוש.")}</p>`}
            ${this.line?l`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>`:d}
            ${tt()?d:l`<div class="more"><sw-button size="sm" variant="ghost" data-nvr-batch-to-encoding @click=${()=>{this.phase="closed",this.emit("encoding-open")}}>${n("שינוי קידוד לכמה מצלמות")}</sw-button></div>`}
            <sw-button slot="footer" variant="ghost" data-nvr-batch-cancel @click=${()=>this.phase="closed"}>${n("ביטול")}</sw-button>
            <sw-button slot="footer" variant="primary" data-nvr-batch-next ?disabled=${t<bt} @click=${()=>this.askStart()}>${n("המשך")}</sw-button>`:d}
    </sw-dialog>`}icon(e){return l`<span class="ic ${e}" aria-hidden="true">${e==="ok"?Vt:e==="bad"?Pi:e==="unk"?"?":d}</span>`}progressRow(e,t){const s=Rs(t),a=xi(t,e.kind),r=t.camera_id?this.info[t.camera_id]:null;return l`<div class="row ${s}" role="listitem" data-nvr-batch-item=${t.index} data-status=${t.status}>
      ${this.icon(s)}
      <div class="txt"><span class="nm">${this.nameOf(t)}${r?l` <span class="meta">${n("ערוץ")} <span class="ltr">${r.channel}</span></span>`:d}</span>${a?l`<span class="ln" data-nvr-batch-item-line title=${a}>${a}</span>`:d}</div>
    </div>`}renderProgress(){const e=this.batch;if(!(this.phase==="progress"))return l`<sw-dialog wide data-nvr-batch-progress></sw-dialog>`;if(!e)return l`<sw-dialog wide open heading=${this.starting?n("מתחיל"):n("שינוי מרובה")} data-nvr-batch-progress @close=${o=>{o.stopPropagation(),this.phase="closed"}}>
        ${this.starting?l`<div class="bar" role="progressbar" aria-label=${n("מתחיל")}><i style="inline-size:8%"></i></div>`:d}
        ${this.line?l`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>`:d}
        ${this.starting?d:l`<sw-button slot="footer" variant="primary" data-nvr-batch-close @click=${()=>this.phase="closed"}>${n("סגור")}</sw-button>`}
      </sw-dialog>`;const s=Si(e,this.nameOf,this.stopping),a=dt(e),r=a.total?Math.round(a.processed/a.total*100):0,i=e.items??[];return l`<sw-dialog wide open heading=${s.title} subheading=${s.sub} data-nvr-batch-progress data-state=${e.state} data-kind=${e.kind} @close=${o=>{o.stopPropagation(),this.closeDialog()}}>
      <div class="bar ${s.tone==="error"||s.tone==="warn"?"error":s.tone==="done"?"done":""}" role="progressbar" aria-valuemin="0" aria-valuemax=${a.total} aria-valuenow=${a.processed} aria-label=${n("התקדמות")}><i style="inline-size:${r}%"></i></div>
      ${this.vlist(i.length,Cs,"progress",o=>this.progressRow(e,i[o]),n("מצלמות"))}
      ${this.offline?l`<p class="msg" data-nvr-batch-offline role="status">${n("אין חיבור לשרת. ממשיך לנסות.")}</p>`:d}
      ${this.line?l`<p class="msg" data-nvr-batch-line role="alert">${this.line}</p>`:d}
      ${s.canStop?l`<sw-button slot="footer" variant="danger" data-nvr-batch-stop @click=${()=>void this.stop()}>${n("עצור")}</sw-button>`:d}
      ${s.showUndo?l`<sw-button slot="footer" data-nvr-batch-undo ?disabled=${!s.canUndo} title=${s.canUndo?"":n("לא ברור אם בוצע. נבדק מול ה־NVR.")} @click=${()=>this.askUndo()}>${Zs(e.mode)}</sw-button>`:d}
      ${s.showRetry?l`<sw-button slot="footer" data-nvr-batch-retry @click=${()=>this.askUndo()}>${n("נסה שוב")}</sw-button>`:d}
      ${rt(e)&&ke(e.state)?l`<sw-button slot="footer" data-nvr-batch-report @click=${()=>this.emit("verify-report",{batchId:e.batch_id})}>${n("דוח בדיקה")}</sw-button>`:d}
      ${ke(e.state)?l`<sw-button slot="footer" variant="primary" data-nvr-batch-close @click=${()=>this.closeDialog()}>${n("סגור")}</sw-button>`:d}
    </sw-dialog>`}render(){return l`${this.renderSelect()}
      <nvr-confirm .model=${this.phase==="confirm"||this.phase==="undo-confirm"?this.confirmFor?.model??null:null}
        @confirm=${e=>{e.stopPropagation();const t=this.confirmFor;t&&t.run()}}
        @cancel=${e=>{e.stopPropagation();const t=this.phase==="confirm"?"select":"progress";this.confirmFor=null,this.phase=t}}></nvr-confirm>
      ${this.renderProgress()}`}};q.styles=[ma,K`
      .tools sw-field {
        flex: 1 1 180px;
        min-inline-size: 0;
      }
      .vl {
        block-size: clamp(180px, 46dvh, 440px);
      }
      @media (max-width: 1100px) {
        .tools sw-field input {
          min-block-size: 44px;
        }
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
      }
      .tools {
        gap: 8px 10px;
      }
      .row {
        border-block-end: 0;
        padding-inline: 14px;
      }
      .sel {
        user-select: none;
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
      .sel[aria-disabled='true'] .box {
        opacity: 0.7;
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
    `];G([R({attribute:!1})],q.prototype,"candidates",2);G([R({attribute:!1})],q.prototype,"info",2);G([R({attribute:!1})],q.prototype,"streams",2);G([h()],q.prototype,"phase",2);G([h()],q.prototype,"selected",2);G([h()],q.prototype,"fixedId",2);G([h()],q.prototype,"q",2);G([h()],q.prototype,"line",2);G([h()],q.prototype,"starting",2);G([h()],q.prototype,"batch",2);G([h()],q.prototype,"stopping",2);G([h()],q.prototype,"offline",2);G([h()],q.prototype,"confirmFor",2);q=G([W("nvr-camera-batch")],q);const Ii=(e,t)=>`${e}:${t}`,Ts={main:0,sub:1,third:2,other:3};function qi(e,t){return t&&t!=="error"?t.camera.streams.find(s=>s.stream_ref===e.stream_ref)??e:e}function Vi(e,t,s){const a=[];for(const r of e){if(!r.camera_id)continue;const i=t.get(r.camera_id);if(!(i&&i!=="error"&&i.can_write===!1))for(const o of r.streams){const c=qi(o,i);let f="";s?f=I.stale:i===void 0?f=n("נטען"):i==="error"||i&&i.stale?f=I.detail_error:r.online===!1?f=I.offline:c.writable===!1?f=ra(c.not_writable_reason):i.options?.[c.stream_ref]?c.etag||(f=I.stale):f=I.no_options,a.push({key:Ii(r.camera_id,c.stream_ref),cameraId:r.camera_id,recorderId:r.recorder_id,cameraName:r.name,channel:r.channel,streamRef:c.stream_ref,role:c.role,codec:c.codec,resolution:c.resolution,svc:c.svc,webrtc:c.webrtc??"unknown",selectable:!f,reason:f})}}return a.sort((r,i)=>r.channel-i.channel||r.cameraName.localeCompare(i.cameraName,"he")||Ts[r.role]-Ts[i.role]||r.streamRef.localeCompare(i.streamRef))}const yt={q:"",codec:"",role:"",svc:"",webrtc:""},Di=e=>!!(e.q.trim()||e.codec||e.role||e.svc||e.webrtc);function Bi(e,t){let s=t.q.trim().toLowerCase();const a=[...s.matchAll(/ערוץ\s*(\d+)/g)].map(i=>Number(i[1]));s=s.replace(/ערוץ\s*\d+/g," ");const r=s.split(/\s+/).filter(Boolean);return e.filter(i=>{if(t.role&&i.role!==t.role||t.codec==="h264"&&i.codec!=="H.264"||t.codec==="h265"&&i.codec!=="H.265"||t.codec==="other"&&(i.codec==="H.264"||i.codec==="H.265")||t.svc==="on"&&i.svc!==!0||t.svc==="off"&&i.svc!==!1||t.svc==="none"&&i.svc!==null||t.webrtc&&i.webrtc!==t.webrtc||a.length&&!a.includes(i.channel))return!1;const o=`${i.cameraName} ${i.channel} ${te[i.role]} ${i.codec??""}`.toLowerCase();return r.every(c=>o.includes(c))})}function Fi(e,t){const s=new Set(e);for(const a of t)a.selectable&&s.add(a.key);return s}function Hi(e,t){const s=new Set(e);return s.has(t.key)?s.delete(t.key):t.selectable&&s.add(t.key),s}const $t=(e,t)=>e.filter(s=>s.selectable&&t.has(s.key)),xt={codec:"",resolution:"",fps:"",bitrate_mode:"",bitrate_kbps:"",quality:"",gop:"",svc:"",smart_codec:""},Ls=n("ללא שינוי"),Ns=e=>{const t=/^(\d+)x(\d+)$/.exec(e);return t?Number(t[1])*Number(t[2]):0};function _t(e,t,s){const a={codec:[],resolution:[],fps:[],fpsFull:!1,bitrateMode:[],bitrate:null,quality:[],gop:null,svc:!1,smart:!1},r=(i,o)=>{i.includes(o)||i.push(o)};for(const i of e){const o=t.get(i.cameraId),c=o&&o!=="error"?o.options?.[i.streamRef]:null;if(c){for(const f of c.codec)(f==="H.264"||f==="H.265")&&r(a.codec,f);for(const f of c.resolution[s||i.codec||""]??[])r(a.resolution,f);for(const f of c.fps)r(a.fps,f);a.fpsFull||=c.fps_full;for(const f of c.bitrate_mode)r(a.bitrateMode,f);c.bitrate_kbps&&(a.bitrate=a.bitrate?{min:Math.min(a.bitrate.min,c.bitrate_kbps.min),max:Math.max(a.bitrate.max,c.bitrate_kbps.max)}:{...c.bitrate_kbps});for(const f of c.quality)r(a.quality,f);c.gop&&(a.gop=a.gop?{min:Math.min(a.gop.min,c.gop.min),max:Math.max(a.gop.max,c.gop.max)}:{...c.gop}),a.svc||=c.svc,a.smart||=c.smart_codec}}return a.codec.sort(),a.resolution.sort((i,o)=>Ns(o)-Ns(i)),a.fps.sort((i,o)=>o-i),a.bitrateMode.sort(),a.quality.sort((i,o)=>o-i),a}const Ms=e=>/^\d{1,7}$/.test(e.trim())?Number(e.trim()):null;function Ps(e,t){const s={},a=[];if(e.codec&&(s.codec=e.codec),e.resolution&&(s.resolution=e.resolution),e.fps&&(s.fps=e.fps==="full"?"full":Number(e.fps)),e.bitrate_mode&&(s.bitrate_mode=e.bitrate_mode),e.bitrate_kbps.trim()){const r=Ms(e.bitrate_kbps);r===null||r<1||t.bitrate&&(r<t.bitrate.min||r>t.bitrate.max)?a.push("bitrate_kbps"):s.bitrate_kbps=r}if(e.quality&&(s.quality=Number(e.quality)),e.gop.trim()){const r=Ms(e.gop);r===null||r<1||t.gop&&(r<t.gop.min||r>t.gop.max)?a.push("gop"):s.gop=r}return e.svc&&(s.svc=e.svc==="on"),e.smart_codec&&(s.smart_codec=e.smart_codec==="on"),{settings:s,invalid:a}}const As=e=>Object.keys(e).length>0;function ji(e,t,s){const a={...e,codec:t};return a.resolution&&!s.resolution.includes(a.resolution)&&(a.resolution=""),a}function Ui(e,t){return{...e,bitrate_mode:t,quality:t==="CBR"?"":e.quality}}const Is=n("הצפייה החיה מנגנת ב־WebRTC רק H.264.");function Ki(e){const t=["codec","profile","resolution","fps","bitrate_mode","bitrate_kbps","quality","gop","svc","smart_codec"],s=new Map(e.notes.filter(a=>a.kind==="adjusted").map(a=>[a.field,a.message]));return Object.entries(e.fields??{}).sort(([a],[r])=>t.indexOf(a)-t.indexOf(r)).map(([a,[r,i]])=>({field:a,label:g[a]??a,from:ge(a,r),to:ge(a,i),adjusted:s.has(a),why:s.get(a)??""}))}const Wi=e=>e.notes.filter(t=>t.kind==="kept").map(t=>({label:g[t.field]??t.field,why:t.message}));function Gi(e){const t=e.counts,s=a=>a===1?n("זרם אחד"):n("{k} זרמים",{k:a});return[t.change?n("ישתנו {streams}",{streams:s(t.change)}):n("אין מה לשנות"),t.skip?n("לא ניתן: {streams}",{streams:s(t.skip)}):"",t.unchanged?n("כבר מוגדרים: {streams}",{streams:s(t.unchanged)}):""].filter(Boolean).join(" · ")}function Yi(e,t){return{confirm:!0,settings:e.settings,recorder_id:e.recorder_id,targets:e.items.filter(s=>s.status==="change"&&s.if_match).map(s=>({camera_id:s.camera_id,stream_ref:s.stream_ref,if_match:s.if_match,changes:s.changes})),...t?{on_refusal:t}:{}}}const Qi=e=>e===1?n("בזרם אחד"):n("ב־{n} זרמים",{n:e}),Ji=n("השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה.");function Xi(e,t,s){const a=e.items.filter(r=>r.status==="change");return{heading:n("לשנות את הקידוד {where}?",{where:Qi(a.length)}),lead:s?ni(s):Ji,count:Tt(e.changes_total),confirmLabel:n("החל"),details:[],names:a.map(t)}}const Zi=(e,t)=>t&&t in te?`${e} · ${te[t]}`:e;function qs(e){switch(e.code){case"stale":case"plan_changed":return{text:n("ההגדרות במצלמות השתנו. התצוגה המקדימה נטענה מחדש."),reload:!0};case"batch_in_progress":return{text:n("מתבצע שינוי מרובה"),reload:!1};case"batch_target_not_allowed":return{text:n("אחד הזרמים כבר אינו מתאים. התצוגה המקדימה נטענה מחדש."),reload:!0};case"write_in_progress":return{text:n("שינוי אחר של אחד הזרמים מתבצע. נסו שוב בעוד רגע."),reload:!1};case"forbidden":return{text:n("אין הרשאה לפעולה הזו."),reload:!1};case"source_unavailable":case"source_timeout":return{text:n("ה־NVR אינו זמין."),reload:!1};case"network":return{text:n("אין חיבור לשרת."),reload:!1};default:return{text:e.user_message||n("הפעולה לא בוצעה."),reload:!1}}}const en=e=>e?`${e.min}–${e.max}`:se;var tn=Object.defineProperty,sn=Object.getOwnPropertyDescriptor,P=(e,t,s,a)=>{for(var r=a>1?void 0:a?sn(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&tn(t,s,r),r};const an=44,rn=60;let O=class extends ht{constructor(){super(...arguments),this.rows=[],this.details=new Map,this.phase="closed",this.selected=new Set,this.filters={...yt},this.draft={...xt},this.plan=null,this.tab="change",this.busy=!1,this.line="",this.confirmModel=null,this.presetScope="all",this.presetRole="both",this.presetMode=!1,this.onRefusal="skip",this.refusalKnown=!1,this.nameOf=e=>{const t=this.rows.find(s=>s.cameraId===e.camera_id&&s.streamRef===e.stream_ref);return Zi(t?.cameraName??e.camera_id,e.role??t?.role)}}open(){this.selected=new Set,this.filters={...yt},this.draft={...xt},this.plan=null,this.line="",this.listTop=0,this.presetMode=!1,this.phase="select"}willUpdate(e){if(e.has("rows")&&this.selected.size){const t=new Set(this.rows.filter(a=>a.selectable).map(a=>a.key)),s=[...this.selected].filter(a=>t.has(a));s.length!==this.selected.size&&(this.selected=new Set(s))}}updated(){this.measureList()}vlist(e,t,s,a,r){return l`<div class="vl" role="list" aria-label=${r} tabindex="0" data-nvr-enc-list=${s} data-rows=${e} @scroll=${this.onListScroll}>
      ${this.windowRows(e,t,a)}
    </div>`}dd(e,t,s,a,r){return l`<sw-dropdown data-nvr-enc-dd=${t} .label=${e} .placeholder=${e} .value=${s} .items=${a} @change=${i=>r(i.detail.id)}></sw-dropdown>`}selectRow(e){const t=this.selected.has(e.key),s=e.selectable?`${e.codec??""}${e.resolution?` · ${e.resolution.replace(/x/i,"×")}`:""}`:e.reason;return l`<button type="button" class="sel" role="checkbox" aria-checked=${t?"true":"false"} aria-disabled=${e.selectable?"false":"true"} data-nvr-enc-stream=${e.key}
      title=${e.selectable?"":e.reason} @click=${()=>this.selected=Hi(this.selected,e)}>
      <span class="box" aria-hidden="true">${t?Vt:d}</span>
      <span class="nm">${e.cameraName} · ${te[e.role]}</span>
      <span class="meta">${e.selectable?l`<bdi class="ltr">${s}</bdi>`:s}</span>
    </button>`}patchFilters(e){this.filters={...this.filters,...e},this.resetScroll()}renderSelect(){const e=this.filters,t=Bi(this.rows,e),s=$t(this.rows,this.selected).length,a=this.rows.filter(i=>i.selectable).length,r=Di(e);return l`${this.renderPreset()}<div class="tools" data-nvr-enc-filters>
        <sw-field class="q"><input type="search" placeholder=${n("חיפוש מצלמה")} aria-label=${n("חיפוש מצלמה")} data-nvr-enc-search .value=${e.q} @input=${i=>this.patchFilters({q:i.target.value})} /></sw-field>
        ${this.dd(n("זרם"),"role",e.role,[{id:"",label:n("כל הזרמים")},{id:"main",label:n("ראשי")},{id:"sub",label:n("משני")}],i=>this.patchFilters({role:i}))}
        ${this.dd(n("קידוד"),"codec",e.codec,[{id:"",label:n("כל הקידודים")},{id:"h264",label:"H.264"},{id:"h265",label:"H.265"},{id:"other",label:n("אחר")}],i=>this.patchFilters({codec:i}))}
        ${this.dd("SVC","svc",e.svc,[{id:"",label:n("כל ה־SVC")},{id:"on",label:n("SVC פעיל")},{id:"off",label:n("SVC כבוי")},{id:"none",label:n("ללא SVC")}],i=>this.patchFilters({svc:i}))}
        ${this.dd("WebRTC","webrtc",e.webrtc,[{id:"",label:n("כל ה־WebRTC")},{id:"ok",label:n("מתנגן")},{id:"no",label:n("לא מתנגן")},{id:"unknown",label:n("לא ידוע")}],i=>this.patchFilters({webrtc:i}))}
      </div>
      <div class="tools">
        <sw-button size="sm" data-nvr-enc-all ?disabled=${!t.some(i=>i.selectable)} @click=${()=>this.selected=Fi(this.selected,t)}>${r?n("בחר הכל ({length})",{length:t.filter(i=>i.selectable).length}):n("בחר הכל")}</sw-button>
        <sw-button size="sm" variant="ghost" data-nvr-enc-clear @click=${()=>this.selected=new Set}>${n("נקה")}</sw-button>
        ${r?l`<sw-button size="sm" variant="ghost" data-nvr-enc-unfilter @click=${()=>this.patchFilters({...yt})}>${n("נקה סינון")}</sw-button>`:d}
      </div>
      <div class="count" data-nvr-enc-count role="status">${n("נבחרו {picked} מתוך {selectable}",{picked:s,selectable:a})}${r?n(" · {length} תוצאות",{length:t.length}):""}</div>
      ${t.length?this.vlist(t.length,an,"select",i=>this.selectRow(t[i]),n("זרמים")):l`<p class="msg" data-nvr-enc-none role="status">${n("אין זרמים שמתאימים לסינון.")}</p>`}
      ${this.line?l`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>`:d}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-cancel @click=${()=>this.phase="closed"}>${n("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-next ?disabled=${s<1} @click=${()=>this.toSettings()}>${n("המשך")}</sw-button>`}toSettings(){this.line="",this.presetMode=!1,this.phase="settings"}renderPreset(){const e=ns(this.rows,this.selected,this.presetScope,this.presetRole),t=Za(this.rows,this.selected,this.presetScope,this.presetRole,I.writes_disabled),s=e.length===0;return l`<section class="preset" data-nvr-h264-preset aria-label=${os}>
      <div class="preset-head">
        <span class="preset-title">${os}</span>
        <p class="note" data-nvr-h264-why>${ls} ${cs}</p>
      </div>
      <div class="tools">
        ${this.dd(n("מצלמות"),"h264-scope",this.presetScope,er,a=>(this.presetScope=a,this.line=""))}
        ${this.dd(n("זרמים"),"h264-role",this.presetRole,tr,a=>(this.presetRole=a,this.line=""))}
        <sw-button size="sm" variant="primary" data-nvr-h264-run ?disabled=${s||this.busy} @click=${()=>this.runPreset()}>${this.busy&&this.presetMode?n("בודק…"):sr(e.length)}</sw-button>
        <sw-button size="sm" variant="ghost" data-nvr-verify-reports @click=${()=>this.emit("verify-reports")}>${n("דוחות בדיקה קודמים")}</sw-button>
      </div>
      ${s||t.writesOff?l`<p class="msg" data-nvr-h264-empty role="status">${s?ar(this.presetScope,t,this.selected.size):n("{writesOff} זרמים לא ישתנו: שינויי הגדרות ב־NVR כבויים (הגדרות החיבור).",{writesOff:t.writesOff})}</p>`:d}
    </section>`}runPreset(){const e=ns(this.rows,this.selected,this.presetScope,this.presetRole);e.length&&(this.selected=rr(e),this.draft={...xt,codec:"H.264"},this.presetMode=!0,this.runPreview())}renderSettings(){const e=this.draft,t=$t(this.rows,this.selected),s=_t(t,this.details,e.codec),{settings:a,invalid:r}=Ps(e,s),i={id:"",label:Ls},o=[i,{id:"on",label:n("פעיל")},{id:"off",label:n("כבוי")}],c=p=>this.draft={...this.draft,...p},f=(p,v)=>l`<sw-field label=${g[p]+(p==="bitrate_kbps"?" (kbps)":"")} hint=${r.includes(p)?n("טווח {range}",{range:en(v)}):""}>
        <input inputmode="numeric" placeholder=${Ls} aria-label=${g[p]} data-nvr-enc-input=${p} aria-invalid=${r.includes(p)?"true":"false"} .value=${e[p]} @input=${y=>c({[p]:y.target.value})} />
      </sw-field>`;return l`<p class="count" data-nvr-enc-picked>${t.length===1?n("נבחרו זרם אחד"):n("נבחרו {n} זרמים",{n:t.length})}</p>
      <div class="form" data-nvr-enc-form>
        <sw-field label=${g.codec}>${this.dd(g.codec,"codec-target",e.codec,[i,...s.codec.map(p=>({id:p,label:p}))],p=>this.draft=ji(this.draft,p,_t(t,this.details,p)))}</sw-field>
        <sw-field label=${g.resolution}>${this.dd(g.resolution,"resolution",e.resolution,[i,...s.resolution.map(p=>({id:p,label:ge("resolution",p)}))],p=>c({resolution:p}))}</sw-field>
        <sw-field label=${g.fps}>${this.dd(g.fps,"fps",e.fps,[i,...s.fpsFull?[{id:"full",label:n("מלא")}]:[],...s.fps.map(p=>({id:String(p),label:String(p)}))],p=>c({fps:p}))}</sw-field>
        <sw-field label=${g.bitrate_mode}>${this.dd(g.bitrate_mode,"bitrate_mode",e.bitrate_mode,[i,...s.bitrateMode.map(p=>({id:p,label:p}))],p=>this.draft=Ui(this.draft,p))}</sw-field>
        ${f("bitrate_kbps",s.bitrate)}
        <sw-field label=${g.quality}>${this.dd(g.quality,"quality",e.quality,[i,...e.bitrate_mode==="CBR"?[]:s.quality.map(p=>({id:String(p),label:String(p)}))],p=>c({quality:p}))}</sw-field>
        ${f("gop",s.gop)}
        ${s.svc?l`<sw-field label="SVC">${this.dd("SVC","svc-target",e.svc,o,p=>c({svc:p}))}</sw-field>`:d}
        ${s.smart?l`<sw-field label=${g.smart_codec}>${this.dd(g.smart_codec,"smart_codec",e.smart_codec,o,p=>c({smart_codec:p}))}</sw-field>`:d}
      </div>
      ${e.codec?l`<p class="note" data-nvr-enc-webrtc>${Is}</p>`:d}
      ${this.line?l`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>`:d}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-back @click=${()=>(this.phase="select",this.line="")}>${n("חזרה")}</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-preview ?disabled=${!As(a)||r.length>0||this.busy} @click=${()=>void this.runPreview()}>${this.busy?n("בודק…"):n("תצוגה מקדימה")}</sw-button>`}async runPreview(e=!1){const t=$t(this.rows,this.selected),{settings:s,invalid:a}=this.presetMode?{settings:{...ir},invalid:[]}:Ps(this.draft,_t(t,this.details,this.draft.codec));if(!t.length||!As(s)||a.length)return;this.busy=!0,e||(this.line="");const r=new Set(t.map(i=>i.recorderId));try{const i=await Y().previewEncoding({settings:s,targets:t.map(o=>({camera_id:o.cameraId,stream_ref:o.streamRef})),...r.size===1?{recorder_id:t[0].recorderId}:{}});this.plan=i,this.refusalKnown=i.on_refusal==="skip"||i.on_refusal==="stop",this.onRefusal=_s(i.on_refusal),this.tab=i.counts.change?"change":i.counts.skip?"skip":"unchanged",this.phase="preview",this.resetScroll()}catch(i){this.line=qs(Ve(i)).text}finally{this.busy=!1}}previewRow(e){let t;if(e.status==="skip")t=l`<span class="ln" data-nvr-enc-reason title=${e.message??""}>${e.message??""}</span>`;else if(e.status==="unchanged")t=l`<span class="ln muted">${n("כבר מוגדר כך")}</span>`;else{const s=Ki(e),a=Wi(e),r=[...s.filter(i=>i.adjusted).map(i=>`${i.label}: ${i.why}`),...a.map(i=>`${i.label}: ${i.why}`)].join(`
`);t=l`<span class="ln" data-nvr-enc-delta title=${r}>${s.map((i,o)=>l`${o?" · ":""}${i.label} <bdi class="ltr">${i.from}</bdi> <span class="arrow" aria-hidden="true">${Ht()}</span> <bdi class="ltr ${i.adjusted?"adj":""}" data-adjusted=${i.adjusted?"true":"false"}>${i.to}${i.adjusted?"*":""}</bdi>`)}${a.length?l` · <span class="muted" data-nvr-enc-kept>${a.map(i=>i.label).join(", ")} ${n("ללא שינוי")}</span>`:d}</span>`}return l`<div class="row" role="listitem" data-nvr-enc-item=${e.index} data-status=${e.status}><span class="nm">${this.nameOf(e)}</span>${t}</div>`}renderPreview(){const e=this.plan;if(!e)return d;const t=e.items.filter(r=>r.status===this.tab),s=[{id:"change",label:n("ישתנו"),count:e.counts.change},{id:"skip",label:n("לא ניתן"),count:e.counts.skip},{id:"unchanged",label:n("כבר מוגדרים"),count:e.counts.unchanged}].filter(r=>r.count>0||r.id==="change"),a=e.adjusted>0;return l`<p class="sum" data-nvr-enc-summary role="status">${Gi(e)}</p>
      ${this.presetMode?l`<p class="note" data-nvr-h264-preview-note>${n("{PRESET_WHY} {PRESET_STORAGE} רזולוציה, קצב פריימים וקצב סיביות נשארים כמו שהם, אלא אם המצלמה דורשת התאמה. {PRESET_FLOW}",{PRESET_WHY:ls,PRESET_STORAGE:cs,PRESET_FLOW:nr})}</p>`:e.settings.codec?l`<p class="note" data-nvr-enc-webrtc>${Is}</p>`:d}
      ${a?l`<p class="note" data-nvr-enc-adjusted>${n("* הותאם למה שהמצלמה מאפשרת")}</p>`:d}
      <sw-tabs data-nvr-enc-tabs .items=${s} .active=${this.tab} group-label=${n("תצוגה מקדימה")} @change=${r=>(this.tab=r.detail.id,this.resetScroll())}></sw-tabs>
      ${t.length?this.vlist(t.length,rn,"preview",r=>this.previewRow(t[r]),n("תצוגה מקדימה")):l`<p class="msg" data-nvr-enc-empty role="status">${n("אין זרמים ברשימה הזו.")}</p>`}
      ${this.refusalKnown&&e.counts.change>1?l`<div class="tools" data-nvr-enc-refusal>${this.dd(ai,"on-refusal",this.onRefusal,[...ri],r=>this.onRefusal=_s(r))}<span class="note" data-nvr-enc-refusal-hint>${ii[this.onRefusal]}</span></div>`:d}
      ${e.batch_in_progress?l`<p class="msg" data-nvr-enc-busy role="status">${n("מתבצע שינוי מרובה")}</p>`:d}
      ${this.line?l`<p class="msg" data-nvr-enc-line role="alert">${this.line}</p>`:d}
      <sw-button slot="footer" variant="ghost" data-nvr-enc-back @click=${()=>(this.phase=this.presetMode?"select":"settings",this.line="")}>${n("חזרה")}</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-enc-apply ?disabled=${!e.counts.change||e.batch_in_progress||this.busy} @click=${()=>this.askConfirm()}>${e.counts.change?e.counts.change===1?n("החל על זרם אחד"):n("החל על {n} זרמים",{n:e.counts.change}):n("החל")}</sw-button>`}askConfirm(){const e=this.plan;!e||!e.counts.change||(this.line="",this.confirmModel=Xi(e,this.nameOf,this.refusalKnown?this.onRefusal:void 0),this.phase="confirm")}async start(){const e=this.plan;if(this.confirmModel=null,!!e){this.busy=!0,this.phase="preview";try{const t=await Y().startEncoding(Yi(e,this.refusalKnown?this.onRefusal:void 0));this.handOff(t)}catch(t){if(await Dt(t,a=>this.handOff(a)))return;const s=qs(Ve(t));s.reload&&(this.busy=!1,await this.runPreview(!0)),this.line=s.text}finally{this.busy=!1}}}handOff(e){this.phase="closed",this.plan=null,this.emit("encoding-started",{batch:e})}render(){const e=this.phase==="select"||this.phase==="settings"||this.phase==="preview",t=this.phase==="settings"?n("ההגדרות החדשות"):this.phase==="preview"?n("תצוגה מקדימה"):n("שינוי קידוד לכמה מצלמות");return l`<sw-dialog wide ?open=${e} heading=${t} data-nvr-enc data-phase=${this.phase} ?locked=${this.busy} @close=${s=>{s.stopPropagation(),this.phase="closed"}}>
        ${this.phase==="select"?this.renderSelect():this.phase==="settings"?this.renderSettings():this.phase==="preview"?this.renderPreview():d}
      </sw-dialog>
      <nvr-confirm .model=${this.phase==="confirm"?this.confirmModel:null}
        @confirm=${s=>{s.stopPropagation(),this.start()}}
        @cancel=${s=>{s.stopPropagation(),this.confirmModel=null,this.phase="preview"}}></nvr-confirm>`}};O.styles=[ma,K`
      .tools sw-field.q {
        flex: 1 1 180px;
        min-inline-size: 0;
      }
      .vl {
        block-size: clamp(180px, 42dvh, 420px);
      }
      .sel[aria-disabled='true'] {
        color: var(--sw-text-3);
      }
      .sel[aria-disabled='true'] .box {
        opacity: 0.4;
      }
      .meta {
        overflow: hidden;
        text-overflow: ellipsis;
        max-inline-size: 50%;
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
      /* R5-LIVE-297: the well's corners, the chosen stream's name in the heading ink, the plan rows and the summary */
      .vl {
        border-radius: var(--sw-r-lg);
      }
      .sel[aria-checked='true'] .nm {
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
      /* R5-LIVE-297 Fable pass: no lines between the plan rows; the count is a 20 px / 800 display line; the plan rows are bold in the heading ink */
      .row {
        border-block-end: 0;
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
    `];P([R({attribute:!1})],O.prototype,"rows",2);P([R({attribute:!1})],O.prototype,"details",2);P([h()],O.prototype,"phase",2);P([h()],O.prototype,"selected",2);P([h()],O.prototype,"filters",2);P([h()],O.prototype,"draft",2);P([h()],O.prototype,"plan",2);P([h()],O.prototype,"tab",2);P([h()],O.prototype,"busy",2);P([h()],O.prototype,"line",2);P([h()],O.prototype,"confirmModel",2);P([h()],O.prototype,"presetScope",2);P([h()],O.prototype,"presetRole",2);P([h()],O.prototype,"presetMode",2);P([h()],O.prototype,"onRefusal",2);P([h()],O.prototype,"refusalKnown",2);O=P([W("nvr-encoding-batch")],O);var nn=Object.defineProperty,on=Object.getOwnPropertyDescriptor,le=(e,t,s,a)=>{for(var r=a>1?void 0:a?on(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&nn(t,s,r),r};const ln=2e3;let Q=class extends J{constructor(){super(...arguments),this.info={},this.streams={},this.open=!1,this.view="report",this.fromList=!1,this.batch=null,this.recent=null,this.tab="all",this.line="",this.busy=!1,this.seq=0,this.timer=null}async show(e,t=!1){this.open=!0,this.view="report",this.fromList=t,this.tab="all",this.line="",this.batch=this.batch?.batch_id===e?this.batch:null,await this.read(e,++this.seq)}async showList(){this.stopPolling(),this.open=!0,this.view="list",this.line="",this.recent=null;try{this.recent=pi(await Y().recent())}catch{this.recent=[],this.line=n("לא ניתן לקרוא את הדוחות.")}}async read(e,t){try{const s=await Y().get(e);if(t!==this.seq||!this.open)return;this.batch=s,this.tab!=="all"&&!Ie(s,this.tab).length&&(this.tab="all"),(s.state==="running"||zs(s.verify))&&this.arm(e,t)}catch(s){if(t!==this.seq)return;this.line=s instanceof k&&s.status===404?n("הדוח לא נמצא."):n("אין חיבור לשרת. ממשיך לנסות."),s instanceof k&&s.status===404||this.arm(e,t)}}arm(e,t){this.stopPolling(),this.timer=setTimeout(()=>void this.read(e,t),ln)}stopPolling(){this.timer&&clearTimeout(this.timer),this.timer=null}close(){this.seq++,this.stopPolling(),this.open=!1}disconnectedCallback(){super.disconnectedCallback(),this.seq++,this.stopPolling()}async recheck(){const e=this.batch;if(!(!e||this.busy)){this.busy=!0,this.line="";try{this.batch=await Y().recheck(e.batch_id),this.arm(e.batch_id,this.seq)}catch(t){const s=t instanceof k?{status:t.status,code:t.code,user_message:t.body.user_message}:{status:0,code:"network"};this.line=hi(s)}finally{this.busy=!1}}}nameOf(e){const t=e.camera_id?this.info[e.camera_id]?.name??e.camera_id:"—",s=e.camera_id?this.streams[`${e.camera_id}:${e.stream_ref}`]:"";return s?`${t} · ${s}`:t}row(e){const t=e.verify??null,s=t?ti(t):zs(this.batch?.verify)?n("בבדיקה"):n("לא נבדק"),a=e.camera_id?this.info[e.camera_id]?.channel:void 0;return l`<div class="row" role="listitem" data-nvr-verify-item=${e.index} data-outcome=${t?.outcome??""}>
      <span class="nm">${this.nameOf(e)}${a!==void 0?l` <span class="meta">${n("ערוץ")} <span class="ltr">${a}</span></span>`:d}</span>
      <span class="chip ${si(t)}" data-nvr-verify-chip title=${s}>${s}</span>
      ${t?.detail?l`<span class="ln" data-nvr-verify-detail>${t.detail}</span>`:d}
    </div>`}renderReport(){const e=this.batch;if(!e)return l`<p class="msg" role="status">${n("טוען…")}</p>${this.line?l`<p class="msg" role="alert">${this.line}</p>`:d}`;const t=Ie(e,this.tab),s=ci(e),a=!!e.verify?.can_recheck&&!this.busy;return l`<p class="sum" data-nvr-verify-summary role="status">${li(e.verify)||n("אין בדיקה לשינוי הזה.")}</p>
      <sw-tabs data-nvr-verify-tabs .items=${s} .active=${this.tab} group-label=${n("דוח בדיקה")} @change=${r=>this.tab=r.detail.id}></sw-tabs>
      ${t.length?l`<div class="list" role="list" aria-label=${n("זרמים")} data-nvr-verify-list=${this.tab}>${et(t,r=>r.index,r=>this.row(r))}</div>`:l`<p class="msg" data-nvr-verify-empty role="status">${this.tab==="worklist"?n("כל המצלמות השתנו."):n("אין זרמים ברשימה הזו.")}</p>`}
      <p class="hint" data-nvr-verify-hint>${Ss}</p>
      ${this.line?l`<p class="msg" data-nvr-verify-line role="alert">${this.line}</p>`:d}
      ${this.fromList?l`<sw-button slot="footer" variant="ghost" data-nvr-verify-back @click=${()=>void this.showList()}>${n("לכל הדוחות")}</sw-button>`:d}
      <sw-button slot="footer" data-nvr-verify-recheck ?disabled=${!a} title=${Ss} @click=${()=>void this.recheck()}>${this.busy?n("שולח…"):n("בדוק שוב")}</sw-button>
      <sw-button slot="footer" variant="primary" data-nvr-verify-close @click=${()=>this.close()}>${n("סגור")}</sw-button>`}renderList(){const e=this.recent;return l`${e===null?l`<p class="msg" role="status">${n("טוען…")}</p>`:e.length?l`<div class="list" role="list" aria-label=${n("דוחות")} data-nvr-verify-reports>${et(e,t=>t.batch_id,t=>l`<button type="button" class="pick" role="listitem" data-nvr-verify-open=${t.batch_id} @click=${()=>void this.show(t.batch_id,!0)}>${ui(t)}</button>`)}</div>`:l`<p class="msg" data-nvr-verify-none role="status">${n("אין עדיין דוחות של שינוי קידוד.")}</p>`}
      ${this.line?l`<p class="msg" role="alert">${this.line}</p>`:d}
      <sw-button slot="footer" variant="primary" data-nvr-verify-close @click=${()=>this.close()}>${n("סגור")}</sw-button>`}render(){const e=this.batch,t=this.view==="list"?n("דוחות בדיקה"):e?di(e):n("דוח בדיקה"),s=this.view==="report"&&e?ca(e.verify?.checked_at??e.created_at??null):"";return l`<sw-dialog wide ?open=${this.open} heading=${t} subheading=${s} data-nvr-verify data-view=${this.view} @close=${a=>{a.stopPropagation(),this.close()}}>${this.open?this.view==="list"?this.renderList():this.renderReport():d}</sw-dialog>`}};Q.styles=K`
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
  `;le([R({attribute:!1})],Q.prototype,"info",2);le([R({attribute:!1})],Q.prototype,"streams",2);le([h()],Q.prototype,"open",2);le([h()],Q.prototype,"view",2);le([h()],Q.prototype,"fromList",2);le([h()],Q.prototype,"batch",2);le([h()],Q.prototype,"recent",2);le([h()],Q.prototype,"tab",2);le([h()],Q.prototype,"line",2);le([h()],Q.prototype,"busy",2);Q=le([W("nvr-verify-report")],Q);var cn=Object.defineProperty,dn=Object.getOwnPropertyDescriptor,V=(e,t,s,a)=>{for(var r=a>1?void 0:a?dn(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&cn(t,s,r),r};const Vs=u("ה־NVR אינו זמין. מוצגים הערכים האחרונים."),kt=u("מתבצע שינוי מרובה"),Ds=[{id:"channel",label:u("ערוץ"),sort:"channel"},{id:"camera",label:u("מצלמה"),sort:"camera"},{id:"role",label:u("זרם"),sort:"role"},{id:"codec",label:u("קידוד"),sort:"codec"},{id:"svc",label:"SVC",sort:"svc"},{id:"resolution",label:u("רזולוציה"),sort:"resolution"},{id:"fps",label:"FPS",sort:"fps"},{id:"bitrate",label:u("קצב"),sort:"bitrate"},{id:"gop",label:"GOP",sort:"gop"},{id:"webrtc",label:"WebRTC",sort:"webrtc"}],hn=l`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>`,pn=l`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>`;let T=class extends J{constructor(){super(...arguments),this.bubbleSkin=new jt(this),this.data=null,this.recorder=null,this.recorders=[],this.recorderFilter="",this.loading=!0,this.failure=null,this.filters={...wt},this.sort={...aa},this.details=new Map,this.busy=new Set,this.lines=new Map,this.confirm=null,this.editing=null,this.toast=null,this.batch=null,this.seq=0,this.toasts=0}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(){this.toggleAttribute("data-rw",!!this.data?.can_write)}async load(){const e=++this.seq;this.loading=!0;try{const t=ze(),[s,a]=await Promise.all([t.cameras(),t.recorders().catch(()=>null)]);if(e!==this.seq)return;this.data=s,this.recorder=a?.recorders[0]??null,this.recorders=a?.recorders??[],this.failure=null,this.details=new Map,this.lines=new Map,s.stale&&!s.cameras.length?(this.data=null,this.failure={status:503,code:s.error??"source_unavailable",message:Vs}):(this.prefetch(s,e),s.can_write&&!s.stale&&this.updateComplete.then(()=>this.batchEl()?.resume()))}catch(t){if(e!==this.seq)return;this.data=null,this.failure={status:t instanceof k?t.status:0,code:t instanceof k?t.code:"network",message:$e(t)}}finally{e===this.seq&&(this.loading=!1)}}async prefetch(e,t){if(!e.can_write||e.stale)return;const s=e.cameras.filter(f=>f.camera_id&&f.streams.length).map(f=>f.camera_id);let a=0;const r=new Map;let i=null;const o=()=>{i&&clearTimeout(i),i=null,!(t!==this.seq||!r.size)&&(this.commitDetails(new Map(r)),r.clear())},c=async()=>{for(;a<s.length&&t===this.seq;)await this.readCamera(s[a++],t,r),r.size>=25?o():i||(i=setTimeout(o,150))};await Promise.all([c(),c(),c()]),o()}commitDetails(e){if(this.details=new Map([...this.details,...e]),!this.data)return;const t=new Map;for(const[s,a]of e)a!=="error"&&a.camera.streams.length&&t.set(s,a.camera.streams);t.size&&(this.data={...this.data,cameras:this.data.cameras.map(s=>s.camera_id&&t.has(s.camera_id)?{...s,streams:t.get(s.camera_id)}:s)})}async readCamera(e,t=this.seq,s){let a;try{a=await ze().camera(e)}catch{a="error"}t===this.seq&&(s?s.set(e,a):this.commitDetails(new Map([[e,a]])))}cameraById(e){return this.data?.cameras.find(t=>t.camera_id===e)??null}streamOf(e,t){return this.cameraById(e)?.streams.find(s=>s.stream_ref===t)??null}ctrl(e,t){const s=this.data;if(!s||!t.cameraId)return{show:!1,enabled:!1,reason:""};const a=Pr(e,{camera_id:t.cameraId,online:t.online},t.stream,{canWrite:s.can_write,stale:s.stale,detail:this.details.get(t.cameraId)??null});return a.show&&this.batchRunning?{show:!0,enabled:!1,reason:kt}:a}get batchRunning(){return this.batch?.state==="running"}batchEl(){return this.renderRoot.querySelector("nvr-camera-batch")}cameraInfo(){const e={},t=this.multiRecorder;for(const s of this.data?.cameras??[])s.camera_id&&(e[s.camera_id]={name:t?`${s.name} · ${this.recorderName(s.recorder_id)}`:s.name,channel:s.channel});return e}streamRoles(){const e={};for(const t of this.data?.cameras??[])if(t.camera_id)for(const s of t.streams)e[`${t.camera_id}:${s.stream_ref}`]=te[s.role];return e}encEl(){return this.renderRoot.querySelector("nvr-encoding-batch")}openReport(e){const t=this.renderRoot.querySelector("nvr-verify-report");t&&(e?t.show(e):t.showList())}openEncoding(){this.batchRunning||(this.toast=null,this.encEl()?.open())}isBusy(e){return!!e.cameraId&&!!e.stream&&this.busy.has(`${e.cameraId}:${e.stream.stream_ref}`)}setBusy(e,t){const s=new Set(this.busy);t?s.add(e):s.delete(e),this.busy=s}setLine(e,t){const s=new Map(this.lines);t?s.set(e,t):s.delete(e),this.lines=s}replaceStream(e,t){const s=i=>({...t,writable:t.writable??i?.writable??null,not_writable_reason:t.not_writable_reason??i?.not_writable_reason??null}),a=i=>({...i,streams:i.streams.map(o=>o.stream_ref===t.stream_ref?s(o):o)});this.data&&(this.data={...this.data,cameras:this.data.cameras.map(i=>i.camera_id===e?a(i):i)});const r=this.details.get(e);r&&r!=="error"&&(this.details=new Map(this.details).set(e,{...r,camera:a(r.camera)}))}showToast(e,t={}){this.toast={n:++this.toasts,message:e,...t}}applyResult(e,t,s,a){const r=`${this.cameraById(e)?.recorder_id??"nvr-1"}:${this.cameraById(e)?.source_ref??""}:${t}`;if(s.ok){this.replaceStream(e,s.stream),a==="editor"&&(this.editing=null),this.setLine(r,null),s.kind==="undo"?this.showToast(s.rebootRequired?u("השינוי בוטל. ה־NVR מבקש הפעלה מחדש."):u("השינוי בוטל"),s.rebootRequired?{reboot:!0}:{}):s.unchanged||!s.change?this.showToast(u("ללא שינוי")):this.showToast(s.rebootRequired?u("נשמר. ה־NVR מבקש הפעלה מחדש."):u("נשמר"),{undo:{changeId:s.change.id,cameraId:e,ref:t},...s.rebootRequired?{reboot:!0}:{}});return}s.stream&&this.replaceStream(e,s.stream),a==="row"&&this.setLine(r,s.line.text),s.line.reload&&this.readCamera(e),s.code==="batch_in_progress"&&this.batchEl()?.resume()}onSvc(e,t){const s=t.stream;if(e.target.checked=s?.svc===!0,!s||!t.cameraId||this.isBusy(t)||!this.ctrl("svc",t).enabled)return;const a={svc:s.svc!==!0};this.setLine(t.key,null);const r=ia(t.cameraName,s,a),i=this.batchCandidates();a.svc===!1&&this.data?.can_batch===!0&&i.length>=2&&i.some(o=>o.cameraId===t.cameraId)&&(r.extraLabel=u("החל גם על מצלמות נוספות")),this.confirm={model:r,cameraId:t.cameraId,ref:s.stream_ref,changes:a}}recorderIds(){return[...new Set((this.data?.cameras??[]).map(e=>e.recorder_id))]}get multiRecorder(){return this.recorderIds().length>1}recorderName(e){return this.recorders.find(t=>t.recorder_id===e)?.name??e}batchRecorder(){return this.multiRecorder&&(this.recorderFilter||this.recorderIds()[0])||null}batchCandidates(){const e=this.data,t=this.batchRecorder();return e?mi(e.cameras,this.details,e.stale).filter(s=>!t||s.recorderId===t):[]}openBatch(){const e=this.confirm;this.confirm=null,e&&this.batchEl()?.openSelect(e.cameraId)}onBatchFinished(e){const t=Ri(e);this.showToast(t.message,t.undo?{batchUndo:e.batch_id,batchMode:e.mode}:{})}async confirmed(){const e=this.confirm;this.confirm=null;const t=e&&this.streamOf(e.cameraId,e.ref);if(!e||!t)return;const s=`${e.cameraId}:${e.ref}`;this.toast=null,this.setBusy(s,!0);const a=await na(e.cameraId,t,e.changes);this.setBusy(s,!1),this.applyResult(e.cameraId,e.ref,a,"row")}async undoToast(){const e=this.toast;if(e?.batchUndo&&!e.busy){const i=e.batchUndo;this.toast=null,await this.batchEl()?.undoAll(i);return}if(!e?.undo||e.busy)return;const{changeId:t,cameraId:s,ref:a}=e.undo;this.toast={...e,busy:!0},this.setBusy(`${s}:${a}`,!0);const r=await oa(t);this.setBusy(`${s}:${a}`,!1),this.toast=null,this.applyResult(s,a,r,"row")}openEditor(e){!e.cameraId||!e.stream||!this.ctrl("edit",e).enabled||this.isBusy(e)||(this.toast=null,this.setLine(e.key,null),this.editing={cameraId:e.cameraId,ref:e.stream.stream_ref})}renderSvc(e){const t=this.ctrl("svc",e),s=e.stream;if(!t.show||!s)return Sr(s);const a=this.isBusy(e),r=`SVC · ${e.cameraName} · ${te[s.role]}`;return l`<span class="swc ${a?"pending":""}"><sw-toggle data-svc-toggle .checked=${s.svc===!0} ?disabled=${!t.enabled||a} label=${r} labelHidden title=${t.reason||d}
      aria-busy=${a?"true":"false"} @change=${i=>this.onSvc(i,e)}></sw-toggle>${a?l`<span class="spin" role="status" aria-label=${u("שומר")} data-pending></span>`:d}</span>`}renderPen(e){const t=this.ctrl("edit",e);return!t.show||!e.stream?d:l`<button type="button" class="pen" data-edit-stream aria-label=${`${u("עריכה")} · ${e.cameraName} · ${te[e.stream.role]}`} title=${t.reason||u("עריכה")} ?disabled=${!t.enabled||this.isBusy(e)} @click=${()=>this.openEditor(e)}><sw-icon name="edit" size="16"></sw-icon></button>`}renderEditor(){const e=this.editing,t=e?this.cameraById(e.cameraId):null,s=e?this.streamOf(e.cameraId,e.ref):null,a=e?this.details.get(e.cameraId):null,r=s&&a&&a!=="error"?a.options?.[s.stream_ref]??null:null;return l`<nvr-camera-editor ?open=${!!(e&&t&&s&&r)} .camera=${t} .stream=${s} .options=${r}
      @close=${()=>this.editing=null} @written=${i=>e&&this.applyResult(e.cameraId,e.ref,i.detail.result,"editor")}></nvr-camera-editor>`}renderToast(){const e=this.toast;return e?Pa(e.n,l`<nvr-undo-toast message=${e.message} actionLabel=${e.batchUndo?e.batchMode==="encoding"?Zs("encoding"):u("בטל"):e.undo?u("בטל"):""} linkLabel=${e.reboot?u("ל־NVR"):""} linkHref=${e.reboot?"#/system/security/nvr":""} ?busy=${!!e.busy}
      @undo=${()=>void this.undoToast()} @dismiss=${()=>!e.busy&&(this.toast=null)}></nvr-undo-toast>`):d}patch(e){this.filters={...this.filters,...e}}select(e,t,s,a){return l`<sw-field><select aria-label=${e} data-nvr-filter=${a} .value=${this.filters[t]} @change=${r=>this.patch({[t]:r.target.value})}>
      ${s.map(([r,i])=>l`<option value=${r} ?selected=${r===this.filters[t]}>${i}</option>`)}
    </select></sw-field>`}renderToolbar(e,t){const s=this.filters;return l`<div class="toolbar" data-nvr-toolbar>
      <sw-field class="search"><input type="search" placeholder=${u("חיפוש מצלמה, קידוד, רזולוציה")} aria-label=${u("חיפוש")} data-nvr-search .value=${s.q} @input=${a=>this.patch({q:a.target.value})} /></sw-field>
      ${this.multiRecorder?l`<sw-field><select aria-label="NVR" data-nvr-filter="recorder" .value=${this.recorderFilter} @change=${a=>this.recorderFilter=a.target.value}>
            <option value="" ?selected=${!this.recorderFilter}>${u("כל ה־NVR")}</option>
            ${this.recorderIds().map(a=>l`<option value=${a} ?selected=${a===this.recorderFilter}>${this.recorderName(a)}</option>`)}
          </select></sw-field>`:d}
      ${this.select(u("קידוד"),"codec",[["",u("כל הקידודים")],["h264","H.264"],["h265","H.265"],["other",u("אחר")]],"codec")}
      ${this.select(u("סוג זרם"),"role",[["",u("כל הזרמים")],["main",u("ראשי")],["sub",u("משני")],["other",u("נוסף")]],"role")}
      ${this.select("SVC","svc",[["",u("כל ה־SVC")],["on",u("SVC פעיל")],["off",u("SVC כבוי")],["none",u("ללא SVC")]],"svc")}
      ${this.select("WebRTC","webrtc",[["",u("כל ה־WebRTC")],["ok",u("מתנגן")],["no",u("לא מתנגן")],["unknown",u("לא ידוע")]],"webrtc")}
      ${vs(s)||this.recorderFilter?l`<sw-button size="sm" variant="ghost" data-nvr-clear @click=${()=>{this.filters={...wt},this.recorderFilter=""}}>${u("נקה")}</sw-button>`:d}
      ${this.data?.can_write&&this.data.can_batch===!0&&!this.data.stale&&!tt()?l`<sw-button size="sm" data-nvr-encoding-open ?disabled=${this.batchRunning} title=${this.batchRunning?kt:""} @click=${()=>this.openEncoding()}>${u("שינוי קידוד לכמה מצלמות")}</sw-button>`:d}
      <sw-button size="sm" icon="refresh" data-nvr-refresh ?disabled=${this.loading} @click=${()=>void this.load()}>${u("רענון")}</sw-button>
      <span class="count" data-nvr-count>${vs(s)||this.recorderFilter?u("{shown} מתוך {total} זרמים",{shown:e,total:t}):u("{n} זרמים",{n:t})}</span>
    </div>`}headerCell(e){const t=this.sort.key===e.sort,s=t?this.sort.dir==="asc"?"ascending":"descending":"none";return l`<th scope="col" class=${e.id==="channel"?"c-chan":""} aria-sort=${s} data-col=${e.id}>
      ${e.sort?l`<button type="button" data-nvr-sort=${e.sort} @click=${()=>this.sort=Lr(this.sort,e.sort)}>${e.label}<span class="arrow" aria-hidden="true">${t?this.sort.dir==="asc"?"▲":"▼":""}</span></button>`:l`<span style="padding:9px 10px;display:inline-block">${e.label}</span>`}
    </th>`}verdict(e){const t=e.stream?.webrtc??"unknown",s=e.stream!==null;return l`<span class="v ${s?t:"unknown"}" role="img" aria-label=${s?gs[t]:se} title=${s?gs[t]:""} data-verdict=${s?t:"none"}>${s?t==="ok"?hn:t==="no"?pn:se:se}</span>`}renderRow(e,t){const s=e[t],a=s.stream,r=Mr(e,t),i=this.lines.get(s.key);return l`<tr class="${r?"first":"repeat"} ${s.enabledInArx?"":"off"} ${s.online===!1?"down":""}" data-stream-row data-camera=${s.cameraKey} data-stream=${a?.stream_ref??""}>
      <td class="muted c-chan" data-col="channel"><span class="ltr">${s.channel}</span></td>
      <td data-col="camera"><span class="cam">${s.online===!1?l`<span class="dot" title=${u("לא מקוונת")} data-offline></span>`:d}${s.cameraName}</span>${this.multiRecorder?l`<span class="muted" data-nvr-recorder> · ${this.recorderName(s.recorderId)}</span>`:d}<span class="chan muted"> ${u("ערוץ")} <span class="ltr">${s.channel}</span></span></td>
      <td data-col="role">${a?te[a.role]:l`<span class="muted" data-unread>${u("לא נקרא")}</span>`}</td>
      <td data-col="codec"><span class="ltr">${this.codecCell(a)}${a?.profile?l` <bdi class="muted">${a.profile}</bdi>`:d}</span></td>
      <td data-col="svc">${this.renderSvc(s)}</td>
      <td data-col="resolution"><bdi class="ltr">${Ct(a)}</bdi></td>
      <td data-col="fps"><span class="ltr">${ms(a)}</span></td>
      <td data-col="bitrate"><span class="ltr"><bdi>${ws(a)}</bdi>${a?.bitrate_mode&&a.bitrate_kbps?l` <span class="muted">${a.bitrate_mode}</span>`:d}</span></td>
      <td data-col="gop"><span class="ltr">${bs(a?.gop)}</span></td>
      <td data-col="webrtc">${this.verdict(s)}</td>
      ${this.data?.can_write?l`<td data-col="edit" class="act">${this.renderPen(s)}</td>`:d}
    </tr>${i?l`<tr class="msg" data-row-line-row><td colspan=${Ds.length+1} data-nvr-line role="status">${i}</td></tr>`:d}`}codecCell(e){return zr(e)?l`<bdi class="h265" data-h265-badge title=${ts} aria-label=${`${Ae(e)} · ${ts}`}>${Ae(e)}</bdi>`:l`<bdi>${Ae(e)}</bdi>`}renderCard(e){const t=e.stream;return l`<div class="card ${e.enabledInArx?"":"off"} ${e.online===!1?"down":""}" data-stream-card data-camera=${e.cameraKey} data-stream=${t?.stream_ref??""}>
      <div class="head"><span class="cam">${e.online===!1?l`<span class="dot" title=${u("לא מקוונת")}></span>`:d}${e.cameraName}</span>${this.multiRecorder?l`<span class="muted" data-nvr-recorder>${this.recorderName(e.recorderId)}</span>`:d}<span class="muted">${u("ערוץ")} <span class="ltr">${e.channel}</span></span><span style="margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px">${this.verdict(e)}${this.renderPen(e)}</span></div>
      ${t?l`<div class="line"><span>${te[t.role]}</span><span class="ltr">${this.codecCell(t)}</span><bdi class="ltr">${Ct(t)}</bdi><span class="ltr">${ms(t)}</span></div>
          <div class="line facts"><span class="svcline">SVC ${this.renderSvc(e)}</span><bdi class="ltr">${ws(t)}${t.bitrate_mode&&t.bitrate_kbps?` ${t.bitrate_mode}`:""}</bdi><span>GOP <span class="ltr">${bs(t.gop)}</span></span>${t.profile?l`<bdi class="ltr muted">${t.profile}</bdi>`:d}</div>`:l`<div class="line muted" data-unread>${u("לא נקרא")}</div>`}
      ${this.lines.get(e.key)?l`<div class="msgline" data-nvr-line role="status">${this.lines.get(e.key)}</div>`:d}
    </div>`}renderBody(){const e=this.data;if(!e)return d;const t=kr(e.cameras),s=this.multiRecorder?this.recorderFilter:"",a=Tr(Or(s?t.filter(o=>o.recorderId===s):t,this.filters),this.sort),r=Nr(t),i=t.length?a.length?l`<div class="wrap" data-nvr-table>
              <table>
                <thead><tr>${Ds.map(o=>this.headerCell(o))}${e.can_write?l`<th scope="col" data-col="edit"><span class="vh">${u("עריכה")}</span></th>`:d}</tr></thead>
                <tbody>${a.map((o,c)=>this.renderRow(a,c))}</tbody>
              </table>
            </div>
            <div class="cards" data-nvr-cards>${a.map(o=>this.renderCard(o))}</div>`:l`<sw-state-panel icon="filter" state="empty" heading=${u("אין זרמים שמתאימים לסינון.")} actionLabel=${u("נקה סינון")} data-nvr-no-match @action=${()=>this.filters={...wt}}></sw-state-panel>`:l`<sw-state-panel icon="camera" state="empty" heading=${u("לא נמצאו מצלמות ב־NVR.")} actionLabel=${u("רענן")} data-nvr-empty @action=${()=>void this.load()}></sw-state-panel>`;return l`
      ${this.batchRunning&&this.batch?this.renderStrip(this.batch):d}
      ${e.stale?l`<div class="note" data-nvr-stale role="status"><span>${Vs}</span><sw-button size="sm" data-nvr-retry ?disabled=${this.loading} @click=${()=>void this.load()}>${u("נסה שוב")}</sw-button></div>`:d}
      ${t.length?this.renderToolbar(a.length,r.streams):d}
      ${i}`}renderStrip(e){const t=dt(e);return l`<div class="note" data-nvr-batch-strip role="status"><span data-nvr-batch-strip-text>${kt} · <span class="ltr">${t.processed}</span> ${u("מתוך")} <span class="ltr">${t.total}</span></span><sw-button size="sm" data-nvr-batch-show @click=${()=>this.batchEl()?.show()}>${u("הצג")}</sw-button></div>`}renderBatch(){const e=this.data;return e?.can_write?l`<nvr-camera-batch .candidates=${this.batchCandidates()} .info=${this.cameraInfo()} .streams=${this.streamRoles()}
      @batch-change=${t=>this.batch=t.detail.batch}
      @batch-finished=${t=>this.onBatchFinished(t.detail.batch)}
      @batch-refresh=${()=>void this.load()}
      @verify-report=${t=>this.openReport(t.detail.batchId)}
      @encoding-open=${()=>this.openEncoding()}></nvr-camera-batch>
      ${e.can_batch===!0?l`<nvr-encoding-batch .rows=${Vi(e.cameras,this.details,e.stale)} .details=${this.details}
            @verify-reports=${()=>this.openReport(null)}
            @encoding-started=${t=>void this.batchEl()?.followBatch(t.detail.batch)}></nvr-encoding-batch>
          <nvr-verify-report .info=${this.cameraInfo()} .streams=${this.streamRoles()}></nvr-verify-report>`:d}`:d}subheading(){if(this.multiRecorder)return this.recorderFilter?this.recorderName(this.recorderFilter):u("{n} מקליטים",{n:this.recorderIds().length});const e=this.recorder;return e?[e.name,e.model].filter(Boolean).join(" · "):""}render(){const e=this.failure;let t;return this.loading&&!this.data?t=l`<sw-state-panel state="loading" data-nvr-loading></sw-state-panel>`:e?.status===403?t=l`<sw-state-panel state="forbidden" data-nvr-forbidden></sw-state-panel>`:e?.code==="nvr_not_configured"?t=l`<sw-state-panel icon="camera" state="empty" heading=${u("אין NVR מחובר")} actionLabel=${u("לחיבורים")} data-nvr-none @action=${()=>window.location.hash="#/system/setup"}></sw-state-panel>`:e?t=l`<sw-state-panel state="error" heading=${u("ה־NVR אינו זמין.")} hint=${e.status===503?"":e.message} actionLabel=${u("נסה שוב")} data-nvr-error @action=${()=>void this.load()}></sw-state-panel>`:t=this.renderBody(),l`<sw-page crumbs=${u("הגדרות | אבטחה")} heading=${u("הגדרות מצלמות")} subheading=${this.subheading()}><div data-nvr-cameras data-state=${this.loading&&!this.data?"loading":e?"error":this.data?.stale?"stale":"ready"} style="display:contents">${t}</div></sw-page>
      ${this.data?.can_write?this.renderEditor():d}
      ${this.renderBatch()}
      <nvr-confirm .model=${this.confirm?.model??null} @confirm=${()=>void this.confirmed()} @cancel=${()=>this.confirm=null} @extra=${()=>this.openBatch()}></nvr-confirm>
      ${this.renderToast()}`}};T.styles=[K`
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
      font-weight: var(--sw-fw-semibold);
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
  `,Fe];V([h()],T.prototype,"data",2);V([h()],T.prototype,"recorder",2);V([h()],T.prototype,"recorders",2);V([h()],T.prototype,"recorderFilter",2);V([h()],T.prototype,"loading",2);V([h()],T.prototype,"failure",2);V([h()],T.prototype,"filters",2);V([h()],T.prototype,"sort",2);V([h()],T.prototype,"details",2);V([h()],T.prototype,"busy",2);V([h()],T.prototype,"lines",2);V([h()],T.prototype,"confirm",2);V([h()],T.prototype,"editing",2);V([h()],T.prototype,"toast",2);V([h()],T.prototype,"batch",2);T=V([W("system-security-cameras")],T);const zt=encodeURIComponent,Me={readMask:e=>C(`cameras/${zt(e)}/privacy-mask`),previewMasks:e=>E("nvr/privacy-masks/preview",{items:e}),applyMasks:e=>E("nvr/privacy-masks/apply",{items:e,confirm:!0}),changes:(e,t=20)=>C(`nvr/changes?camera_id=${zt(e)}&limit=${t}`),undoChange:e=>E(`nvr/changes/${zt(e)}/rollback`,{confirm:!0})},pt={tab:"מסכות פרטיות",crumbs:"הגדרות | אבטחה",heading:"מסכות פרטיות",cameras:"מצלמות",camera_edited:"נערכה",snapshot_alt:"תמונה מהמצלמה {name}",no_picture:"אין תמונה מהמצלמה",mask_on:"מסכה פעילה",add_region:"הוספת אזור",delete_region:"מחיקת אזור",discard:"ביטול השינויים",region_n:"אזור {n}",region_poly:"אזור {n} (צורה חופשית)",regions_count:"{n} מתוך {max} אזורים",region_keys:"חצים מזיזים. Shift וחצים משנים גודל. Delete מוחק.",corner:"פינה {name}",corner_tl:"שמאלית עליונה",corner_tr:"ימנית עליונה",corner_bl:"שמאלית תחתונה",corner_br:"ימנית תחתונה",review:"בדיקת השינויים ({n})",reviewing:"קורא את המצלמות…",back:"חזרה לעריכה",next:"המשך לאישור",write:"כתיבה ל־NVR",cancel:"ביטול",preview_title:"לפני ואחרי",before:"לפני",after:"אחרי",st_ready:"ייכתב",st_unchanged:"ללא שינוי",st_invalid:"לא תקין",st_skipped:"לא ייכתב",confirm_title:"כתיבת מסכות פרטיות",confirm_lead:"המסכה מכסה את התמונה בצפייה החיה ובהקלטה. הכתיבה נשלחת רק עכשיו, פעם אחת.",confirm_count:"{n} מצלמות ייכתבו",confirm_count_one:"מצלמה אחת תיכתב",applying:"כותב…",result_title:"תוצאות הכתיבה",res_applied:"נכתב ואומת",res_unchanged:"ללא שינוי",res_skipped:"לא נכתב",res_failed:"הכתיבה נכשלה",res_not_attempted:"לא נוסה",restored:"המקור הוחזר",not_restored:"המקור לא אומת, יש לבדוק במצלמה",undo:"ביטול הכתיבה",undoing:"מחזיר…",undone:"הוחזר למצב הקודם",done:"סיום",log_title:"היסטוריית שינויים",log_empty:"עדיין לא נכתבו מסכות במצלמה הזו",log_applied:"נכתב",log_rolled_back:"בוטל",log_failed:"נכשל",log_diverged:"לא אומת",log_other:"אחר",off_switch:"כתיבת מסכות פרטיות כבויה בהגדרות המערכת, ולכן אפשר רק לצפות. מנהל מערכת יכול להפעיל אותה.",off_perm:"אין לך הרשאה לשנות מסכות פרטיות, ולכן אפשר רק לצפות.",off_nvr_writes:"שינויי הגדרות ב־NVR של המצלמה הזו כבויים, ולכן אפשר רק לצפות. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.",off_remote:"מסכות פרטיות משתנות רק ברשת המקומית, ולכן אפשר רק לצפות.",loading:"טוען",retry:"נסו שוב",err_cameras:"רשימת המצלמות לא נטענה",err_mask:"המסכה של המצלמה לא נקראה",forbidden:"אין הרשאה לצפות במסכות פרטיות",empty_cameras:"אין מצלמות לעריכה",inv_need_region:"מסכה פעילה צריכה לפחות אזור אחד",inv_too_many:"מותרים עד {max} אזורים",inv_too_small:"אזור קטן מדי",e_feature_disabled:"כתיבת מסכות פרטיות כבויה בהגדרות המערכת.",e_forbidden:"אין הרשאה לפעולה הזו.",e_stale:"המסכה במצלמה השתנתה מאז הבדיקה. יש לבדוק שוב.",e_validation:"המסכה אינה תקינה למצלמה הזו.",e_nvr_not_supported:"המצלמה אינה תומכת במסכות פרטיות.",e_source_forbidden:"המצלמה אינה זמינה לכתיבה.",e_changed_since:"המסכה במצלמה שונתה מאז, ולכן אין החזרה אוטומטית.",e_not_rollbackable:"אי אפשר להחזיר את השינוי הזה.",e_nvr_verify_mismatch:"ההחזרה לא אומתה. יש לבדוק את המצלמה.",e_nvr_writes_off:"שינויי הגדרות ב־NVR של המצלמה הזו כבויים. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.",e_generic:"הפעולה נכשלה. לא נשלח דבר נוסף.",sw_label:"כתיבת מסכות פרטיות ל-NVR",sw_confirm:"שום דבר לא נכתב לפני לחיצה על כפתור הכתיבה בכל פעם.",sw_turn_on:"הפעלה",sw_saving:"שומר…",sw_err:"השינוי לא נשמר. נסו שוב."},wa=pe("en","i18n/privacy-mask","en"),ga=pe("ar","i18n/privacy-mask","ar"),ba=pe("ru","i18n/privacy-mask","ru"),un={he:pt,en:wa,ar:ga,ru:ba},fn=["ar","ru"];function va(){return ot(["en","ar","ru"])}function m(e,t,s=va()){const a=un[s][e]??pt[e]??e;return nt(a,t)}function Oe(e,t=va()){const s=`e_${e}`;return s in pt?m(s,void 0,t):m("e_generic",void 0,t)}it("i18n/privacy-mask",{he:pt,en:wa,ar:ga,ru:ba},fn);const A=4,St={width:704,height:576},ya=e=>[[e.x,e.y],[e.x+e.w,e.y],[e.x+e.w,e.y+e.h],[e.x,e.y+e.h]];function mn(e){if(e.length!==4)return null;const t=[...new Set(e.map(o=>o[0]))],s=[...new Set(e.map(o=>o[1]))];if(t.length!==2||s.length!==2||new Set(e.map(o=>`${o[0]},${o[1]}`)).size!==4)return null;const r=Math.min(...t),i=Math.min(...s);return{x:r,y:i,w:Math.max(...t)-r,h:Math.max(...s)-i}}let wn=0;const Bt=()=>`r${++wn}`;function gn(e,t){return{enabled:e,regions:t.map(s=>({key:Bt(),rect:mn(s.points),points:s.points.map(a=>[a[0],a[1]])}))}}const bn=e=>({enabled:e.enabled,regions:e.regions.map(t=>({key:t.key,rect:t.rect?{...t.rect}:null,points:t.points.map(s=>[...s])}))}),he=(e,t,s)=>Math.min(s,Math.max(t,e));function Qt(e,t){const s=he(Math.round(e.w),A,t.width),a=he(Math.round(e.h),A,t.height);return{x:he(Math.round(e.x),0,t.width-s),y:he(Math.round(e.y),0,t.height-a),w:s,h:a}}const vn=(e,t=!1)=>({x:Math.max(1,Math.round(e.width/(t?10:100))),y:Math.max(1,Math.round(e.height/(t?10:100)))}),yn=e=>e==="ArrowLeft"||e==="ArrowRight"||e==="ArrowUp"||e==="ArrowDown";function $n(e,t,s,a,r=!1){const i=vn(a,r),o=t==="ArrowLeft"?-i.x:t==="ArrowRight"?i.x:0,c=t==="ArrowUp"?-i.y:t==="ArrowDown"?i.y:0;return Qt(s?{...e,w:e.w+o,h:e.h+c}:{...e,x:e.x+o,y:e.y+c},a)}function xn(e,t,s,a,r){const i=t==="tl"||t==="bl",o=t==="tl"||t==="tr",c=i?e.x+e.w:e.x,f=o?e.y+e.h:e.y,p=he(Math.round(s),0,r.width),v=he(Math.round(a),0,r.height);let y=Math.min(c,p),N=Math.max(c,p),B=Math.min(f,v),ce=Math.max(f,v);return N-y<A&&(p<c?(y=Math.max(0,c-A),N=y+A):(N=Math.min(r.width,c+A),y=N-A)),ce-B<A&&(v<f?(B=Math.max(0,f-A),ce=B+A):(ce=Math.min(r.height,f+A),B=ce-A)),{x:y,y:B,w:N-y,h:ce-B}}function Bs(e,t,s,a,r){const i=he(Math.round(Math.min(e,s)),0,r.width),o=he(Math.round(Math.max(e,s)),0,r.width),c=he(Math.round(Math.min(t,a)),0,r.height),f=he(Math.round(Math.max(t,a)),0,r.height);return o-i>=A&&f-c>=A?{x:i,y:c,w:o-i,h:f-c}:null}function _n(e,t){const s=Math.round(e.width/5),a=Math.round(e.height/5),r=t%5*Math.round(e.width/25);return Qt({x:Math.round((e.width-s)/2)+r,y:Math.round((e.height-a)/2)+r,w:s,h:a},e)}const kn=e=>JSON.stringify(e.map(t=>[t[0],t[1]]).sort((t,s)=>t[0]-s[0]||t[1]-s[1])),Fs=e=>e.map(t=>kn(t.points)).sort();function zn(e,t){return e.enabled===t.enabled&&JSON.stringify(Fs(e.regions))===JSON.stringify(Fs(t.regions))}const Sn=e=>e.rect?ya(e.rect):e.points,Hs=e=>({enabled:e.enabled,regions:e.regions.map(t=>({points:Sn(t)}))}),Rn=(e,t)=>!zn(Hs(e),Hs(t));function En(e,t,s){if(e.regions.length>t)return"too_many";if(e.enabled&&e.regions.length===0)return"need_region";for(const a of e.regions)if(a.rect&&(a.rect.w<A||a.rect.h<A||a.rect.x<0||a.rect.y<0||a.rect.x+a.rect.w>s.width||a.rect.y+a.rect.h>s.height))return"too_small";return null}function js(e,t,s){return{camera_id:e,enabled:t.enabled,regions:t.regions.map(a=>({points:a.rect?ya(a.rect):a.points})),...s?{etag:s}:{}}}function Us(e,t){const s=(a,r)=>`${(a/r*100).toFixed(3)}%`;return{left:s(e.x,t.width),top:s(e.y,t.height),width:s(e.w,t.width),height:s(e.h,t.height)}}const Ks=e=>e.map(t=>`${t[0]},${t[1]}`).join(" "),Ws=e=>(e?.regions??[]).map(t=>t.points);function On(e){const t=e.find(s=>s.kind==="privacy_mask");return t&&t.status==="applied"&&!t.rollback_of?t:null}var Cn=Object.defineProperty,Tn=Object.getOwnPropertyDescriptor,_=(e,t,s,a)=>{for(var r=a>1?void 0:a?Tn(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&Cn(t,s,r),r};const Ln=["tl","tr","bl","br"],Nn=new Set(["drafts","ghost","regionKey"]);let $=class extends J{constructor(){super(...arguments),this.cameras=null,this.failure=null,this.loading=!0,this.selected="",this.loaded=new Map,this.drafts=new Map,this.regionKey="",this.step="edit",this.preview=null,this.previewing=!1,this.confirmOpen=!1,this.applying=!1,this.applied=null,this.line="",this.ghost=null,this.history=null,this.undoing="",this.undone=new Set,this.brokenShot=new Set,this.switchOn=null,this.switchAsk=!1,this.switchBusy=!1,this.switchErr=!1,this.avail=0,this.drag=null,this.onResize=()=>{this.scroller=null,this.measure()},this.scroller=null,this.historyReads=new Aa,this.addRegion=()=>{this.edit((e,t)=>{const s=this.cur;if(!s||e.regions.length>=s.view.max_regions)return;const a=Bt();e.regions.push({key:a,rect:_n(t,e.regions.length),points:[]}),e.enabled||(e.enabled=!0),this.regionKey=a}),this.updateComplete.then(()=>this.shadowRoot?.querySelector(`[data-pm-region="${this.regionKey}"]`)?.focus())},this.discard=()=>{const e=new Map(this.drafts);e.delete(this.selected),this.drafts=e,this.regionKey=""},this.toggleMask=()=>{this.edit(e=>{e.enabled=!e.enabled})},this.review=async()=>{if(this.canReview){this.previewing=!0,this.line="";try{const e=[...this.drafts.entries()].map(([t,s])=>js(t,s));this.preview=await Me.previewMasks(e),this.step="review"}catch(e){this.line=Oe(e instanceof k?e.code:"generic")}finally{this.previewing=!1}}},this.backToEdit=()=>{this.preview=null,this.confirmOpen=!1,this.step="edit"},this.write=async()=>{if(this.applying||!this.preview)return;const e=this.readyRows;if(e.length){this.applying=!0,this.line="";try{const t=e.map(a=>{const r=this.drafts.get(a.camera_id);return js(a.camera_id,r,a.etag)});this.applied=await Me.applyMasks(t),this.confirmOpen=!1,this.step="done";const s=new Map(this.drafts);for(const a of this.applied.results)(a.status==="applied"||a.status==="unchanged")&&s.delete(a.camera_id);this.drafts=s;for(const a of this.applied.results)a.status==="applied"&&this.loadMask(a.camera_id,!0);this.loadHistory(this.selected)}catch(t){this.confirmOpen=!1,this.line=Oe(t instanceof k?t.code:"generic"),this.step="edit",this.preview=null}finally{this.applying=!1}}},this.undo=async(e,t)=>{if(!this.undoing){this.undoing=e,this.line="";try{await Me.undoChange(e);const s=new Set(this.undone);s.add(e),this.undone=s;const a=new Map(this.drafts);a.delete(t),this.drafts=a,await this.loadMask(t,!0),this.selected===t&&this.loadHistory(t)}catch(s){this.line=Oe(s instanceof k?s.code:"generic")}finally{this.undoing=""}}},this.finish=()=>{this.applied=null,this.preview=null,this.step="edit",this.loadHistory(this.selected)}}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),this.loadCameras(),this.loadSwitch()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize)}updated(e){this.drag||e.size&&[...e.keys()].every(t=>Nn.has(t))||this.measure()}measure(){const e=this.shadowRoot?.querySelector("[data-pm-layout]");if(!e)return;let t=this.scroller&&this.scroller.isConnected&&this.scroller.scrollHeight>this.scroller.clientHeight?this.scroller:null;if(!t){for(let r=e.parentNode;r;r=r instanceof ShadowRoot?r.host:r.parentNode)if(r instanceof Element){const i=getComputedStyle(r).overflowY;if((i==="auto"||i==="scroll")&&r.scrollHeight>r.clientHeight){t=r;break}}this.scroller=t}const s=e.getBoundingClientRect().top+(t?t.scrollTop:window.scrollY),a=Math.round(window.innerHeight-s-24);Math.abs(a-this.avail)>2&&(this.avail=a)}async loadSwitch(){if(!(!oe()||tt()||!Le("system.configure")))try{const e=await Ia();this.switchOn=e.can_edit===!1?null:e.settings["nvr.privacy_mask_write"]==="true"}catch{this.switchOn=null}}async saveSwitch(e){if(!this.switchBusy){this.switchBusy=!0,this.switchErr=!1;try{const t=await qa({"nvr.privacy_mask_write":e?"true":"false"});this.switchOn=(t.settings?.["nvr.privacy_mask_write"]??(e?"true":"false"))==="true",this.switchAsk=!1}catch{this.switchErr=!0}finally{this.switchBusy=!1}}}onSwitch(){this.switchBusy||this.switchOn===null||(this.switchOn?this.saveSwitch(!1):(this.switchErr=!1,this.switchAsk=!this.switchAsk))}renderSwitch(){return this.switchOn===null||this.step!=="edit"?d:l`<div class="swrow" data-pm-switch-row>
      <sw-toggle class="sw-switch" .checked=${ds(!!this.switchOn)} label=${m("sw_label")} data-pm-switch ?disabled=${this.switchBusy||this.applying} @change=${ss(!!this.switchOn,()=>this.onSwitch())}></sw-toggle>
      ${this.switchAsk&&!this.switchOn?l`<div class="ask" data-pm-switch-ask role="group"><span>${m("sw_confirm")}</span>
            <sw-button size="lg" variant="ghost" data-pm-switch-cancel ?disabled=${this.switchBusy} @click=${()=>this.switchAsk=!1}>${m("cancel")}</sw-button>
            <sw-button size="lg" variant="primary" data-pm-switch-confirm ?disabled=${this.switchBusy} @click=${()=>void this.saveSwitch(!0)}>${this.switchBusy?m("sw_saving"):m("sw_turn_on")}</sw-button></div>`:d}
      ${this.switchErr?l`<span class="err" data-pm-switch-err role="alert">${m("sw_err")}</span>`:d}
    </div>`}async loadCameras(){this.loading=!0;try{if(!oe()){this.cameras=[],this.failure=null;return}const e=await ze().cameras();this.cameras=e.cameras.filter(t=>!!t.camera_id),this.failure=null,this.cameras.length&&!this.selected&&this.select(this.cameras[0].camera_id)}catch(e){this.cameras=null,this.failure={status:e instanceof k?e.status:0,code:e instanceof k?e.code:"network"}}finally{this.loading=!1}}async loadMask(e,t=!1){if(!t&&this.loaded.get(e)&&this.loaded.get(e)!=="error")return;const s=new Map(this.loaded);s.set(e,"loading"),this.loaded=s;try{const a=await Me.readMask(e),r=a.normalized?.width&&a.normalized?.height?{width:a.normalized.width,height:a.normalized.height}:St,i=new Map(this.loaded);i.set(e,{view:a,original:gn(a.enabled,a.regions),frame:r,shot:Date.now()}),this.loaded=i}catch{const a=new Map(this.loaded);a.set(e,"error"),this.loaded=a}}async loadHistory(e){if(this.selected!==e)return;const t=this.historyReads.begin();this.history=null;try{const s=await Me.changes(e,20);this.selected===e&&t()&&(this.history=s.changes.filter(a=>a.kind==="privacy_mask"))}catch{this.selected===e&&t()&&(this.history=[])}}async select(e){this.selected=e,this.regionKey="",this.line="",this.history=null,this.historyReads.cancel(),await this.loadMask(e),this.selected===e&&this.loadHistory(e)}get cur(){const e=this.loaded.get(this.selected);return e&&e!=="error"&&e!=="loading"?e:null}draftFor(e){const t=this.loaded.get(e);return!t||t==="error"||t==="loading"?null:this.drafts.get(e)??t.original}get lock(){const e=this.cur;return e?tt()?"off_remote":e.view.can_write?e.view.nvr_writes_enabled===!1?"off_nvr_writes":this.switchOn??e.view.write_enabled?"":"off_switch":"off_perm":""}edit(e){const t=this.cur;if(!t||this.lock)return;const s=bn(this.drafts.get(this.selected)??t.original);e(s,t.frame);const a=new Map(this.drafts);Rn(t.original,s)?a.set(this.selected,s):a.delete(this.selected),this.drafts=a}invalidFor(e){const t=this.loaded.get(e),s=this.drafts.get(e);return!t||t==="error"||t==="loading"||!s?null:En(s,t.view.max_regions,t.frame)}nameOf(e){return this.cameras?.find(t=>t.camera_id===e)?.name??e}deleteRegion(e){const t=this.draftFor(this.selected),s=t?t.regions.findIndex(r=>r.key===e):-1;this.edit(r=>{r.regions=r.regions.filter(i=>i.key!==e)});const a=this.draftFor(this.selected);this.regionKey=a&&a.regions.length?a.regions[Math.min(s,a.regions.length-1)].key:"",this.updateComplete.then(()=>{(this.regionKey?this.shadowRoot?.querySelector(`[data-pm-region="${this.regionKey}"]`):this.shadowRoot?.querySelector("[data-pm-add]")?.shadowRoot?.querySelector("button"))?.focus()})}setRect(e,t){this.edit(s=>{const a=s.regions.find(r=>r.key===e);a&&(a.rect=t)})}framePoint(e){const t=this.cur,s=this.shadowRoot?.querySelector("[data-pm-frame]");if(!t||!s)return null;const a=s.getBoundingClientRect();return!a.width||!a.height?null:{x:(e.clientX-a.left)/a.width*t.frame.width,y:(e.clientY-a.top)/a.height*t.frame.height}}onFrameDown(e){const t=this.cur;if(!t||this.lock||e.button!==0||e.pointerType==="touch"||e.target.closest("[data-pm-region],[data-pm-handle]"))return;const s=this.draftFor(this.selected);if(!s||s.regions.length>=t.view.max_regions)return;const a=this.framePoint(e);a&&(e.currentTarget.setPointerCapture(e.pointerId),this.drag={kind:"draw",key:"",px:a.x,py:a.y,rect:null},this.regionKey="")}onRegionDown(e,t,s){if(this.lock||e.button!==0)return;const a=this.framePoint(e);a&&(e.stopPropagation(),e.currentTarget.setPointerCapture(e.pointerId),this.regionKey=t,this.drag={kind:"move",key:t,px:a.x,py:a.y,rect:s})}onHandleDown(e,t,s,a){if(this.lock||e.button!==0)return;const r=this.framePoint(e);r&&(e.stopPropagation(),e.currentTarget.setPointerCapture(e.pointerId),this.drag={kind:"corner",key:t,px:r.x,py:r.y,rect:s,corner:a})}onPointerMove(e){const t=this.drag,s=this.cur;if(!t||!s)return;const a=this.framePoint(e);a&&(t.kind==="draw"?this.ghost=Bs(t.px,t.py,a.x,a.y,s.frame):t.kind==="move"&&t.rect?this.setRect(t.key,Qt({...t.rect,x:t.rect.x+(a.x-t.px),y:t.rect.y+(a.y-t.py)},s.frame)):t.kind==="corner"&&t.rect&&t.corner&&this.setRect(t.key,xn(t.rect,t.corner,a.x,a.y,s.frame)))}onPointerUp(e){const t=this.drag,s=this.cur;if(this.drag=null,!(!t||!s)&&t.kind==="draw"){const a=this.framePoint(e),r=a?Bs(t.px,t.py,a.x,a.y,s.frame):null;if(this.ghost=null,r){const i=Bt();this.edit(o=>{o.regions.length>=s.view.max_regions||(o.regions.push({key:i,rect:r,points:[]}),o.enabled=!0)}),this.regionKey=i}}}onRegionKey(e,t){const s=this.cur;if(!s||this.lock)return;const r=this.draftFor(this.selected)?.regions.find(i=>i.key===t);r&&(e.key==="Delete"||e.key==="Backspace"?(e.preventDefault(),this.deleteRegion(t)):yn(e.key)&&r.rect&&(e.preventDefault(),this.setRect(t,$n(r.rect,e.key,e.shiftKey,s.frame,e.ctrlKey||e.metaKey))))}get invalidCameras(){return[...this.drafts.keys()].filter(e=>this.invalidFor(e))}get canReview(){return!this.lock&&!!this.cur&&this.drafts.size>0&&this.invalidCameras.length===0&&!this.previewing}get readyRows(){return(this.preview?.items??[]).filter(e=>e.status==="ready")}regionLabel(e,t){return m(t?"region_n":"region_poly",{n:e+1})}invalidText(e,t){return e==="need_region"?m("inv_need_region"):e==="too_many"?m("inv_too_many",{max:t}):e==="too_small"?m("inv_too_small"):""}renderPicture(e,t){return this.brokenShot.has(e)?l`<div class="nopic">${m("no_picture")}</div>`:l`<img alt="" src=${Va(e,t)} @error=${()=>this.brokenShot=new Set(this.brokenShot).add(e)} />`}thumb(e,t,s,a){return l`<div class="thumb" style=${`aspect-ratio:${t.width} / ${t.height}`}>
      ${this.renderPicture(e,a)}
      <svg viewBox=${`0 0 ${t.width} ${t.height}`} preserveAspectRatio="none" aria-hidden="true">${s.map(r=>as`<polygon points=${Ks(r)}></polygon>`)}</svg>
    </div>`}renderCameras(){return l`<ul class="cams" data-pm-cameras aria-label=${m("cameras")}>
      ${this.cameras.map(e=>{const t=e.camera_id;return l`<li>
          <button type="button" class="cam" data-pm-camera=${t} aria-current=${t===this.selected?"true":"false"} ?disabled=${this.step!=="edit"} @click=${()=>void this.select(t)}>
            ${this.drafts.has(t)?l`<span class="dot" data-pm-edited aria-hidden="true"></span><span class="vh">${m("camera_edited")}</span>`:d}
            <span>${e.name}</span><bdi>${e.channel}</bdi>
          </button>
        </li>`})}
    </ul>`}renderEditor(){const e=this.cur;if(this.loaded.get(this.selected)==="error")return{main:l`<sw-state-panel state="error" heading=${m("err_mask")} actionLabel=${m("retry")} data-pm-mask-error @action=${()=>void this.loadMask(this.selected,!0)}></sw-state-panel>`,insp:d,foot:d};if(!e)return{main:l`<sw-state-panel state="loading" heading=${m("loading")} data-pm-mask-loading></sw-state-panel>`,insp:d,foot:d};const s=this.draftFor(this.selected),a=this.lock,r=this.invalidFor(this.selected),i=s.regions.find(p=>p.key===this.regionKey)??null,o=l`
      <div class="bar">
        <sw-toggle class="sw-switch" .checked=${ds(s.enabled)} label=${m("mask_on")} data-pm-enabled ?disabled=${!!a} @change=${ss(s.enabled,()=>this.toggleMask())}></sw-toggle>
        <sw-button size="lg" data-pm-add ?disabled=${!!a||s.regions.length>=e.view.max_regions} @click=${this.addRegion}>${m("add_region")}</sw-button>
        <sw-button size="lg" variant="ghost" data-pm-delete ?disabled=${!!a||!i} @click=${()=>i&&this.deleteRegion(i.key)}>${m("delete_region")}</sw-button>
        <sw-button size="lg" variant="ghost" data-pm-discard ?disabled=${!this.drafts.has(this.selected)} @click=${this.discard}>${m("discard")}</sw-button>
        <span class="count" data-pm-count>${m("regions_count",{n:s.regions.length,max:e.view.max_regions})}</span>
      </div>
      <div class="stage" style=${`--pm-w:${e.frame.width};--pm-h:${e.frame.height}`}>
      <div class="frame ${a?"ro":""}" data-pm-frame style=${`aspect-ratio:${e.frame.width} / ${e.frame.height}`}
        @pointerdown=${p=>this.onFrameDown(p)} @pointermove=${p=>this.onPointerMove(p)} @pointerup=${p=>this.onPointerUp(p)} @pointercancel=${()=>(this.drag=null,this.ghost=null)}>
        ${this.renderPicture(this.selected,e.shot)}
        <svg viewBox=${`0 0 ${e.frame.width} ${e.frame.height}`} preserveAspectRatio="none" aria-hidden="true">
          ${s.regions.map(p=>as`<polygon class=${[p.key===this.regionKey?"sel":"",s.enabled?"":"off"].join(" ")} points=${Ks(p.rect?[[p.rect.x,p.rect.y],[p.rect.x+p.rect.w,p.rect.y],[p.rect.x+p.rect.w,p.rect.y+p.rect.h],[p.rect.x,p.rect.y+p.rect.h]]:p.points)}></polygon>`)}
        </svg>
        ${et(s.regions,p=>p.key,(p,v)=>this.renderRegion(p.key,v,p.rect,p.points,e.frame,!!a))}
        ${this.ghost?l`<div class="ghost" style=${this.styleOf(Us(this.ghost,e.frame))}></div>`:d}
      </div>
      </div>
      <span id="pm-keys" class="vh">${m("region_keys")}</span>
      ${r||this.invalidCameras.length?l`<p class="err" data-pm-invalid role="alert">${this.invalidCameras.map(p=>`${this.nameOf(p)}: ${this.invalidText(this.invalidFor(p),this.loaded.get(p).view.max_regions)}`).join(" · ")}</p>`:d}`,c=l`<div class="insp" data-pm-inspector>
      ${s.regions.length?l`<ul class="regions" data-pm-regions aria-label=${m("regions_count",{n:s.regions.length,max:e.view.max_regions})}>
            ${s.regions.map((p,v)=>l`<li>
                <button type="button" class="pick" data-pm-pick=${p.key} aria-pressed=${p.key===this.regionKey?"true":"false"} @click=${()=>this.regionKey=p.key}>${this.regionLabel(v,p.rect)}</button>
                <sw-button size="lg" variant="ghost" iconOnly icon="close" label=${`${m("delete_region")}: ${this.regionLabel(v,p.rect)}`} data-pm-remove=${p.key} ?disabled=${!!a} @click=${()=>this.deleteRegion(p.key)}></sw-button>
              </li>`)}
          </ul>`:l`<ul class="regions" data-pm-regions></ul>`}
      ${this.renderHistory()}
    </div>`,f=l`<div class="foot edit-foot">
      ${this.line?l`<p class="err" data-pm-line role="alert">${this.line}</p>`:d}
      <sw-button size="lg" variant="primary" data-pm-review ?disabled=${!this.canReview} @click=${()=>void this.review()}>${this.previewing?m("reviewing"):m("review",{n:this.drafts.size})}</sw-button>
    </div>`;return{main:o,insp:c,foot:f}}styleOf(e){return`left:${e.left};top:${e.top};width:${e.width};height:${e.height}`}renderRegion(e,t,s,a,r,i){const o=a.map(y=>y[0]),c=a.map(y=>y[1]),f=s??{x:Math.min(...o),y:Math.min(...c),w:Math.max(...o)-Math.min(...o),h:Math.max(...c)-Math.min(...c)},p=e===this.regionKey,v=this.regionLabel(t,s);return l`<div class="reg ${i?"ro":""}" data-pm-region=${e} data-pm-index=${t+1} data-pm-rect=${s?`${s.x},${s.y},${s.w},${s.h}`:"free"} style=${this.styleOf(Us(f,r))}
      role="group" tabindex=${i?-1:0} aria-label=${v} aria-describedby="pm-keys" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Delete"
      @focus=${()=>this.regionKey=e}
      @pointerdown=${y=>s&&this.onRegionDown(y,e,s)} @pointermove=${y=>this.onPointerMove(y)} @pointerup=${y=>this.onPointerUp(y)}
      @keydown=${y=>this.onRegionKey(y,e)}>
      ${p&&s&&!i?Ln.map(y=>l`<div class="handle ${y}" data-pm-handle=${y} aria-hidden="true" @pointerdown=${N=>this.onHandleDown(N,e,s,y)} @pointermove=${N=>this.onPointerMove(N)} @pointerup=${N=>this.onPointerUp(N)}></div>`):d}
    </div>`}changeStatus(e){if(e.rollback_of)return m("log_applied");const t=e.status;return m(t==="applied"?"log_applied":t==="rolled_back"?"log_rolled_back":t==="failed"?"log_failed":t==="diverged"?"log_diverged":"log_other")}renderHistory(){if(this.history===null)return d;const e=On(this.history),t=this.lock;return l`<section class="history" data-pm-history aria-label=${m("log_title")}>
      <h3>${m("log_title")}</h3>
      ${this.history.length?l`<ul>
            ${this.history.slice(0,5).map(s=>l`<li data-pm-change=${s.id} data-status=${s.status}>
                <span class="when">${this.when(s.created_at)}</span><span>${this.changeStatus(s)}</span>
                ${e&&e.id===s.id&&!this.undone.has(s.id)?l`<sw-button size="lg" variant="ghost" data-pm-undo=${s.id} ?disabled=${!!this.undoing||!!t} @click=${()=>void this.undo(s.id,this.selected)}>${this.undoing===s.id?m("undoing"):m("undo")}</sw-button>`:d}
              </li>`)}
          </ul>`:l`<p class="muted" data-pm-history-empty>${m("log_empty")}</p>`}
    </section>`}when(e){const t=new Date(e);return Number.isNaN(t.getTime())?"":Xs(t)}statusText(e){return m(e==="ready"?"st_ready":e==="unchanged"?"st_unchanged":e==="invalid"?"st_invalid":"st_skipped")}renderReview(){const e=this.preview;if(!e)return d;const t=this.readyRows.length;return l`<div class="review" data-pm-review-step>
      <h3>${m("preview_title")}</h3>
      ${e.items.map(s=>{const a=this.loaded.get(s.camera_id),r=s.before?.normalized?.width?{width:s.before.normalized.width,height:s.before.normalized.height??St.height}:a&&a!=="error"&&a!=="loading"?a.frame:St,i=a&&a!=="error"&&a!=="loading"?a.shot:0;return l`<article class="rv-card" data-pm-preview=${s.camera_id} data-status=${s.status}>
          <header><span class="name">${s.name||this.nameOf(s.camera_id)}</span><span class="st-chip ${s.status}" data-pm-status>${this.statusText(s.status)}</span>${s.status==="invalid"||s.status==="skipped"?l`<span class="err">${Oe(s.reason??"generic")}</span>`:d}</header>
          ${s.before&&s.after?l`<div class="pair">
                <figure><figcaption>${m("before")}</figcaption>${this.thumb(s.camera_id,r,Ws(s.before.enabled?s.before:{...s.before,regions:[]}),i)}</figure>
                <figure><figcaption>${m("after")}</figcaption>${this.thumb(s.camera_id,r,Ws(s.after.enabled?s.after:{...s.after,regions:[]}),i)}</figure>
              </div>`:d}
        </article>`})}
      <div class="foot">
        <sw-button size="lg" variant="ghost" data-pm-back @click=${this.backToEdit}>${m("back")}</sw-button>
        <sw-button size="lg" variant="primary" data-pm-next ?disabled=${!t} @click=${()=>this.confirmOpen=!0}>${m("next")}</sw-button>
      </div>
    </div>`}renderConfirm(){const e=this.readyRows;return l`<sw-dialog ?open=${this.confirmOpen} heading=${m("confirm_title")} data-pm-confirm-dialog @close=${t=>{t.stopPropagation(),this.applying||(this.confirmOpen=!1)}}>
      ${this.confirmOpen?l`<p>${m("confirm_lead")}</p>
            <p class="count" data-pm-confirm-count>${e.length===1?m("confirm_count_one"):m("confirm_count",{n:e.length})}</p>
            <ul data-pm-confirm-cameras>${e.map(t=>l`<li data-pm-confirm-camera=${t.camera_id}>${t.name||this.nameOf(t.camera_id)}</li>`)}</ul>
            <sw-button size="lg" slot="footer" variant="ghost" data-pm-cancel ?disabled=${this.applying} @click=${()=>this.confirmOpen=!1}>${m("cancel")}</sw-button>
            <sw-button size="lg" slot="footer" variant="primary" data-pm-confirm ?disabled=${this.applying||!e.length} @click=${()=>void this.write()}>${this.applying?m("applying"):m("write")}</sw-button>`:d}
    </sw-dialog>`}resultText(e){switch(e.status){case"applied":return{text:m("res_applied"),bad:!1};case"unchanged":return{text:m("res_unchanged"),bad:!1};case"skipped":return{text:`${m("res_skipped")}: ${Oe(e.reason??"generic")}`,bad:!0};case"not_attempted":return{text:m("res_not_attempted"),bad:!1};default:return{text:`${m("res_failed")}: ${Oe(e.reason??"generic")}${e.restored===!0?`. ${m("restored")}`:e.restored===!1?`. ${m("not_restored")}`:""}`,bad:!0}}}renderDone(){const e=this.applied;return e?l`<div class="review" data-pm-done-step>
      <h3>${m("result_title")}</h3>
      <ul class="results" data-pm-results>
        ${e.results.map(t=>{const s=this.resultText(t),a=!!t.change_id&&this.undone.has(t.change_id);return l`<li data-pm-result=${t.camera_id} data-status=${t.status}>
            <span class="name">${this.nameOf(t.camera_id)}</span><span class="st ${s.bad?"bad":""}">${a?m("undone"):s.text}</span>
            ${t.status==="applied"&&t.change_id&&!a?l`<sw-button size="lg" variant="ghost" data-pm-undo=${t.change_id} ?disabled=${!!this.undoing} @click=${()=>void this.undo(t.change_id,t.camera_id)}>${this.undoing===t.change_id?m("undoing"):m("undo")}</sw-button>`:d}
          </li>`})}
      </ul>
      ${this.line?l`<p class="err" data-pm-line role="alert">${this.line}</p>`:d}
      <div class="foot"><sw-button size="lg" variant="primary" data-pm-finish @click=${this.finish}>${m("done")}</sw-button></div>
    </div>`:d}render(){let e;if(this.loading&&!this.cameras)e=l`<sw-state-panel state="loading" heading=${m("loading")} data-pm-loading></sw-state-panel>`;else if(this.failure?.status===403)e=l`<sw-state-panel state="forbidden" heading=${m("forbidden")} quiet data-pm-forbidden></sw-state-panel>`;else if(this.failure)e=l`<sw-state-panel state="error" heading=${m("err_cameras")} actionLabel=${m("retry")} data-pm-error @action=${()=>void this.loadCameras()}></sw-state-panel>`;else if(!this.cameras?.length)e=l`<sw-state-panel icon="camera" state="empty" heading=${m("empty_cameras")} quiet data-pm-empty></sw-state-panel>`;else{const t=this.step==="edit"?this.lock:"",s=this.step==="edit"?this.renderEditor():null;e=l`${this.renderSwitch()}${t?l`<p class="banner" data-pm-lock=${t} role="status">${m(t)}</p>`:d}
        <div class="pm">
          <div class="layout" data-pm-layout style=${this.avail?`--pm-avail:${this.avail}px`:""}>
            ${this.renderCameras()}
            <div class="main" data-pm-step=${this.step}>${s?s.main:this.step==="review"?this.renderReview():this.renderDone()}</div>
            ${s?l`${s.insp}${s.foot}`:d}
          </div>
        </div>`}return l`<sw-page crumbs=${m("crumbs")} heading=${m("heading")}><div data-pm-screen data-state=${this.loading&&!this.cameras?"loading":this.failure?"error":"ready"} style="display:contents">${e}</div></sw-page>${this.renderConfirm()}`}};$.styles=K`
    :host {
      display: contents;
      /* COLOR-LITERAL-A-2480: the fill of an active mask region (editor frame and list thumbnail), written once (the same literal) */
      --pm-fill: rgba(0, 0, 0, 0.78);
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
      fill: var(--pm-fill);
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
      fill: var(--pm-fill);
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
  `;_([h()],$.prototype,"cameras",2);_([h()],$.prototype,"failure",2);_([h()],$.prototype,"loading",2);_([h()],$.prototype,"selected",2);_([h()],$.prototype,"loaded",2);_([h()],$.prototype,"drafts",2);_([h()],$.prototype,"regionKey",2);_([h()],$.prototype,"step",2);_([h()],$.prototype,"preview",2);_([h()],$.prototype,"previewing",2);_([h()],$.prototype,"confirmOpen",2);_([h()],$.prototype,"applying",2);_([h()],$.prototype,"applied",2);_([h()],$.prototype,"line",2);_([h()],$.prototype,"ghost",2);_([h()],$.prototype,"history",2);_([h()],$.prototype,"undoing",2);_([h()],$.prototype,"undone",2);_([h()],$.prototype,"brokenShot",2);_([h()],$.prototype,"switchOn",2);_([h()],$.prototype,"switchAsk",2);_([h()],$.prototype,"switchBusy",2);_([h()],$.prototype,"switchErr",2);_([h()],$.prototype,"avail",2);$=_([W("system-security-privacy-masks")],$);var Mn=Object.defineProperty,Pn=Object.getOwnPropertyDescriptor,re=(e,t,s,a)=>{for(var r=a>1?void 0:a?Pn(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&Mn(t,s,r),r};const Rt="access.unknown_person_uniform_404";let j=class extends J{constructor(){super(...arguments),this.loading=!0,this.failed="",this.policy=null,this.retention="",this.cap="",this.worker=null,this.uniform=null,this.canEdit=!1,this.busy="",this.error="",this.saved=!1,this.ticketsRev=0}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.loading=!0,this.failed="";try{const e=await C("settings");this.canEdit=!!e.can_edit&&(!oe()||Le("system.configure")),this.uniform=String(e.settings[Rt]??"true")==="true";const t=String(e.settings["tickets.enabled"]??"false")==="true",[s,a]=await Promise.all([or().catch(()=>null),t?C("tickets/settings").catch(()=>null):Promise.resolve(null)]);this.policy=s?{pending_retention_days:s.pending_retention_days,pending_max_per_vendor:s.pending_max_per_vendor}:null,this.retention=s?String(s.pending_retention_days):"",this.cap=s?String(s.pending_max_per_vendor):"",this.worker=a?!!a.vendor_portal?.start_worker:null,this.ticketsRev=a?.revision??0}catch(e){this.failed=$e(e)}finally{this.loading=!1}}async run(e,t){if(!this.busy){this.busy=e,this.error="",this.saved=!1;try{await t(),this.saved=!0}catch(s){this.error=`${M("saveFailed")} · ${$e(s)}`}finally{this.busy=""}}}savePolicy(){const e=hs(this.retention),t=ps(this.cap);e===null||t===null||this.run("policy",async()=>{const s=await lr({pending_retention_days:e,pending_max_per_vendor:t});this.policy={pending_retention_days:s.pending_retention_days,pending_max_per_vendor:s.pending_max_per_vendor},this.retention=String(s.pending_retention_days),this.cap=String(s.pending_max_per_vendor)})}flipWorker(){if(this.worker===null)return;const e=!this.worker;this.run("worker",async()=>{const t=await Be("tickets/settings",{revision:this.ticketsRev,vendor_portal:{start_worker:e}});this.worker=!!t.vendor_portal?.start_worker,this.ticketsRev=t.revision})}flipUniform(){if(this.uniform===null)return;const e=!this.uniform;this.run("uniform",async()=>{const t=await Da("settings",{[Rt]:String(e)});this.uniform=String(t.settings[Rt]??"true")==="true"})}toggle(e,t,s,a){return l`<button type="button" class="sw" role="switch" aria-checked=${String(s)} data-public-switch=${e} ?disabled=${!this.canEdit||!!this.busy} @click=${a}>
      <span class="t">${t}</span><span class="track" aria-hidden="true"></span>
    </button>`}body(){if(this.loading)return l`<sw-state-panel state="loading"></sw-state-panel>`;if(this.failed)return l`<sw-state-panel state="error" heading=${M("loadFailed")} hint=${this.failed} actionLabel=${M("retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=hs(this.retention),t=ps(this.cap),s=!!this.policy&&(e!==this.policy.pending_retention_days||t!==this.policy.pending_max_per_vendor);return l`<sw-card flush data-public-settings>
      ${this.policy?l`<section class="grp" data-public-group="pending">
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
          </section>`:d}
      ${this.worker!==null?l`<section class="grp" data-public-group="portal"><h4>${M("secPortal")}</h4>${this.toggle("start_worker",M("startWorker"),this.worker,()=>this.flipWorker())}</section>`:d}
      ${this.uniform!==null?l`<section class="grp" data-public-group="access"><h4>${M("secAccess")}</h4>${this.toggle("uniform_404",M("uniform404"),this.uniform,()=>this.flipUniform())}</section>`:d}
      ${this.error?l`<div class="note err" role="alert" data-public-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:d}
      ${this.saved&&!this.error?l`<div class="grp"><span class="ok" role="status" data-public-saved><sw-icon name="check" size=${16}></sw-icon>${M("saved")}</span></div>`:d}
    </sw-card>`}render(){return l`<sw-page crumbs=${u("הגדרות | אבטחה")} heading=${M("title")}>${this.body()}</sw-page>`}};j.styles=[Ut,K`
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
    `,Fe];re([h()],j.prototype,"loading",2);re([h()],j.prototype,"failed",2);re([h()],j.prototype,"policy",2);re([h()],j.prototype,"retention",2);re([h()],j.prototype,"cap",2);re([h()],j.prototype,"worker",2);re([h()],j.prototype,"uniform",2);re([h()],j.prototype,"canEdit",2);re([h()],j.prototype,"busy",2);re([h()],j.prototype,"error",2);re([h()],j.prototype,"saved",2);j=re([W("system-security-public")],j);const Re="wiskey/managed",Et=()=>C(Re),An=(e,t,s)=>Be(`${Re}/switch`,t==="on"?{switch:e,value:t,confirm:s??""}:{switch:e,value:t}),In=e=>Be(`${Re}/keep-runs`,{value:e}),qn=()=>E(`${Re}/check`),Vn=e=>E(`${Re}/adopt`,{confirm:e}),Dn=()=>E(`${Re}/upgrade`),Bn=()=>E(`${Re}/rollback`),Fn=e=>e.trim().normalize("NFC");function Gs(e,t){return t.length>0&&cr(t,e,null,Fn)}const Hn=5,Ft=[1,10];function jn(e){const t=e?.keep_runs;return typeof t=="number"&&Number.isInteger(t)&&t>=Ft[0]&&t<=Ft[1]?t:Hn}function Un(e,t){return(e?.switches??{})[t]==="on"?"on":"off"}const Kn=["install","upgrade","convert"];function Wn(e){return!e||e.switches.enabled!=="on"||e.running?{adopt:!1,upgrade:!1,rollback:!1}:{adopt:e.adoptable,upgrade:e.runnable&&Kn.includes(e.plan),rollback:e.rollback_available}}const Gn=["preflight","core_gate","backup_check","snapshot_before","stop_core","backup_local","swap","start_core","verify","rollback","start_core_after_rollback","verify_after_rollback"],Yn=e=>!!e&&e.state!=="running";function Qn(e){return!e||e.state==="running"?"info":e.state==="succeeded"?"ok":e.state==="rolled_back"||e.state==="aborted"||e.state==="interrupted"?"warn":"danger"}function Ys(e){return e instanceof k?e.status===403?"forbidden":e.code==="confirmation_required"?"confirm":e.status===409?"conflict":e.status===422?"invalid":"other":"other"}const Jn=e=>e instanceof k?e.code:null,ut={title:"התקנה ועדכון של רכיב בקרת הכניסה",lead:"מנהל מערכת מתקין ומעדכן את הרכיב מכאן, אחרי בדיקת גיבוי מלא. התקנה בעליית התוסף רק אם הופעלה כאן, ואין שדרוג לאחור.",installed:"מותקן",shipped:"זמין בגרסה זו",status:"מצב",none:"לא מותקן",details:"פרטים",on:"פועל",off:"כבוי",turnOn:"הפעלה",turnOff:"כיבוי",cancel:"ביטול",close:"סגירה",retry:"נסו שוב",loadFailed:"הטעינה נכשלה",failed:"הפעולה נכשלה",forbidden:"רק מנהל מערכת יכול לבצע פעולה זו.",own_manual:"הותקן ידנית",own_adopted:"הועבר לניהול המערכת",own_arx_managed:"מנוהל על ידי המערכת",own_legacy:"התקנה קודמת מזוהה",own_unknown:"לא מזוהה",own_missing:"לא מותקן",own_marker_invalid:"סימון ההתקנה הידנית אינו תקין",own_link:"קישור במקום תיקייה",own_unreadable:"לא ניתן לקריאה",own_not_mapped:"תיקיית ההגדרות אינה זמינה",plan_install:"אפשר להתקין",plan_upgrade:"עדכון זמין",plan_convert:"אפשר להעביר לניהול (אותה גרסה)",plan_up_to_date:"מעודכן",plan_downgrade_refused:"המותקן חדש יותר: אין שדרוג לאחור",plan_same_version_different_content:"אותו מספר גרסה עם תוכן אחר: נדרשת בדיקה",plan_version_unknown:"מספר הגרסה אינו מזוהה",plan_bundle_missing:"אין חבילה תקינה בגרסה זו",plan_not_mapped:"תיקיית ההגדרות אינה זמינה",enabledTitle:"התקנה ועדכון דרך המערכת",enabledText:"כשמופעל, מנהל מערכת יכול להתקין, לעדכן ולהחזיר גרסה מכאן. ההפעלה עצמה לא מתקינה דבר.",riskTitle:"קבלת סיכון בבדיקת סביבת ההתקנה",riskText:"מאפשר עדכון כשסביבת ההתקנה נצפתה אך לא ניתן לאמת את מקורה. לא חל על אף תוצאה אחרת, ולא על התקנה בעליית התוסף.",startupTitle:"התקנה ועדכון בעליית התוסף",startupText:"כשמופעל, עדכון זמין מתבצע מעצמו כשהתוסף עולה, עם אותן בדיקות: גיבוי מלא עדכני, בדיקת סביבת ההתקנה, השוואה והחזרה בכשל. התקנה ידנית שלא הועברה לניהול לא תוחלף. ניסיון אחד לכל גרסה.",keepTitle:"כמה עדכונים אחרונים לשמור",keepText:"לכל עדכון נשמרים הגרסה הקודמת והגיבוי הפרטי שלו. הישנים יותר נמחקים אחרי העדכון המוצלח הבא.",keepLabel:"מספר העדכונים",keepSave:"שמירה",keepSaved:"נשמר",originStartup:"בעליית התוסף",typeQ:'להפעיל את "{name}"?',typeText:"כדי לאשר, יש להקליד את המשפט: {phrase}",typeLabel:"משפט האישור",typeWrong:"המשפט אינו תואם. יש להקליד אותו בדיוק.",offQ:'לכבות את "{name}"?',offText:"אי אפשר יהיה להתקין או לעדכן מכאן עד שיופעל שוב. מה שמותקן נשאר כפי שהוא.",adoptButton:"העברה לניהול המערכת",adoptQ:"להעביר את ההתקנה הידנית לניהול המערכת?",adoptText:"המערכת תשמור גיבוי פרטי של הרכיב ושל הרישום. בהתקנה עצמה לא ישתנה דבר עד העדכון הבא.",adoptDone:"ההתקנה עברה לניהול המערכת",checkButton:"בדיקה לפני עדכון",checking:"בודק…",checkTitle:"תוצאת הבדיקה",chk_preflight:"גרסאות, חבילה ובעלות",chk_supervisor:"שירות הניהול של תשתית המערכת",chk_core_gate:"בדיקת סביבת ההתקנה",chk_backup_check:"גיבוי מלא מ-24 השעות האחרונות",chk_pass:"עבר",chk_warn:"עבר בקבלת סיכון",chk_fail:"לא עבר",upgradeButton:"עדכון עכשיו",installButton:"התקנה עכשיו",convertButton:"העברה לניהול עכשיו",upgradeQ:"להתחיל עכשיו?",upgradeText:"תשתית המערכת תיעצר לזמן קצר, הרכיב יוחלף ויאומת, ותשתית המערכת תופעל שוב. בכל כשל הגרסה הקודמת תוחזר.",rollbackButton:"חזרה לגרסה הקודמת",rollbackQ:"לחזור לגרסה הקודמת?",rollbackText:"תשתית המערכת תיעצר לזמן קצר והגרסה הקודמת תוחזר בדיוק כפי שהייתה.",start:"התחלה",progress:"התקדמות",step_preflight:"בדיקות מקדימות",step_core_gate:"בדיקת סביבת ההתקנה",step_backup_check:"בדיקת גיבוי מלא",step_snapshot_before:"רישום המצב לפני",step_stop_core:"עצירת תשתית המערכת",step_backup_local:"גיבוי פרטי",step_swap:"החלפה מאומתת של הרכיב",step_start_core:"הפעלת תשתית המערכת",step_verify:"השוואת לפני ואחרי",step_rollback:"החזרת הגרסה הקודמת",step_start_core_after_rollback:"הפעלה אחרי ההחזרה",step_verify_after_rollback:"השוואה אחרי ההחזרה",job_running:"בביצוע",job_succeeded:"הושלם בהצלחה",job_aborted:"הופסק לפני כל שינוי",job_rolled_back:"נכשל, והגרסה הקודמת הוחזרה",job_rollback_failed:"נכשל וגם ההחזרה נכשלה: יש לשחזר את הגיבוי המלא",job_interrupted:"נקטע בהפעלה מחדש של המערכת: יש לבדוק את המצב",job_failed:"נכשל",lastRun:"הפעולה האחרונה",riskAccepted:"בוצע בקבלת סיכון בבדיקת סביבת ההתקנה",unattended:"ההתקנה האוטומטית הישנה, בלי בדיקת גיבוי והשוואה, נשארת כבויה.",code_core_not_running:"תשתית המערכת לא פועלת",code_validation:"הערך אינו תקין",code_full_backup_missing:"לא נמצא גיבוי מלא",code_full_backup_stale:"הגיבוי המלא האחרון ישן מ-24 שעות",code_backups_unreadable:"אי אפשר לקרוא את רשימת הגיבויים",code_core_gate_unverified:"מקור סביבת ההתקנה אינו מאומת",code_core_did_not_stop:"תשתית המערכת לא נעצרה",code_core_stop_refused:"עצירת תשתית המערכת נדחתה",code_core_did_not_start:"תשתית המערכת לא עלתה בזמן",code_core_start_refused:"הפעלת תשתית המערכת נדחתה",code_entry_not_loaded:"תחנה לא נטענה אחרי ההחלפה",code_entries_changed:"רשימת התחנות השתנתה",code_devices_changed:"רשימת ההתקנים השתנתה",code_entities_changed:"רשימת הישויות השתנתה",code_snapshot_unavailable:"אי אפשר לקרוא את הרישום",code_supervisor_unreachable:"שירות הניהול אינו זמין",code_adoption_required:"יש להעביר את ההתקנה לניהול המערכת קודם",code_plan_refused:"אין עדכון שאפשר לבצע",code_other:"הפעולה נדחתה"},$a=pe("en","i18n/wiskey-managed","en"),xa=pe("ar","i18n/wiskey-managed","ar"),_a=pe("ru","i18n/wiskey-managed","ru"),Xn={he:ut,en:$a,ar:xa,ru:_a};function ka(){return ot(["en","ar","ru"])}const Zn=["ar","ru"];function w(e,t,s=ka()){const a=Xn[s][e]??ut[e]??e;return nt(a,t)}function de(e,t,s=ka()){if(!t)return null;const a=`${e}${t}`;return a in ut?w(a,void 0,s):null}it("i18n/wiskey-managed",{he:ut,en:$a,ar:xa,ru:_a},Zn);var eo=Object.defineProperty,to=Object.getOwnPropertyDescriptor,D=(e,t,s,a)=>{for(var r=a>1?void 0:a?to(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&eo(t,s,r),r};const so=2e3;let L=class extends J{constructor(){super(...arguments),this.loading=!0,this.failed="",this.concealed=!1,this.view=null,this.pending=null,this.typed="",this.busy=!1,this.dlgError="",this.error="",this.notice="",this.check=null,this.checking=!1,this.keepDraft=null,this.keepSaving=!1,this.keepNote="",this.timer=null}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.stopPolling()}stopPolling(){this.timer&&clearTimeout(this.timer),this.timer=null}schedulePoll(){this.stopPolling(),this.view?.running&&(this.timer=setTimeout(()=>void this.refresh(),so))}async refresh(){try{this.view=await Et()}catch{}this.schedulePoll()}async load(){this.loading=!0,this.failed="";try{this.view=await Et()}catch(e){Ys(e)==="forbidden"?this.concealed=!0:this.failed=$e(e)}finally{this.loading=!1}this.schedulePoll()}get canEdit(){return!oe()||Le("system.configure")}ask(e){this.busy||!this.canEdit||(this.error="",this.notice="",this.dlgError="",this.typed="",this.pending=e)}phraseFor(e){const t=this.view;return t?e.kind==="adopt"?t.phrases.adopt:e.kind==="switch"&&e.next==="on"?e.name==="core_risk"?t.phrases.core_risk:e.name==="startup"?t.phrases.startup??t.phrases.enabled:t.phrases.enabled:null:null}async saveKeep(){const e=this.keepDraft;if(!(e===null||this.keepSaving||!this.canEdit)){this.keepSaving=!0,this.keepNote="",this.error="";try{this.view=await In(e),this.keepDraft=null,this.keepNote=w("keepSaved")}catch(t){this.error=this.refusalText(t)}finally{this.keepSaving=!1}}}keepRow(e){const t=jn(e),s=this.keepDraft??t,[a,r]=e.keep_runs_range??Ft,i=Array.from({length:r-a+1},(c,f)=>a+f),o=this.keepDraft!==null&&this.keepDraft!==t;return l`<div class="row" data-wm-keep data-value=${String(t)}>
      <div>
        <h4 class="t">${w("keepTitle")}${this.keepNote?l`<span class="pill" data-tone="ok" data-wm-keep-saved>${this.keepNote}</span>`:d}</h4>
        <p class="x">${w("keepText")}</p>
      </div>
      <div class="keep">
        <sw-field><select aria-label=${w("keepLabel")} data-wm-keep-select ?disabled=${!this.canEdit||this.keepSaving||e.running}
          @change=${c=>{this.keepDraft=Number(c.target.value),this.keepNote=""}}>
          ${i.map(c=>l`<option value=${String(c)} ?selected=${c===s}>${c}</option>`)}
        </select></sw-field>
        <sw-button variant="secondary" data-wm-keep-save ?disabled=${!o||!this.canEdit||this.keepSaving}
          @click=${()=>void this.saveKeep()}>${w("keepSave")}</sw-button>
      </div>
    </div>`}refusalText(e){const t=Ys(e);if(t==="forbidden")return w("forbidden");if(t==="confirm")return w("typeWrong");const s=Jn(e);return de("code_",s)??`${w("failed")} · ${$e(e)}`}async confirm(){const e=this.pending;if(!e||this.busy)return;const t=this.phraseFor(e);if(t!==null&&!Gs(this.typed,t)){this.dlgError=w("typeWrong");return}this.busy=!0,this.dlgError="";try{e.kind==="switch"?this.view=await An(e.name,e.next,t!==null?this.typed.trim():void 0):e.kind==="adopt"?(this.view=await Vn(this.typed.trim()),this.notice=w("adoptDone")):(await(e.kind==="upgrade"?Dn():Bn()),this.check=null,this.view=await Et()),this.pending=null}catch(s){this.dlgError=this.refusalText(s)}finally{this.busy=!1}this.schedulePoll()}async runCheck(){if(!this.checking){this.checking=!0,this.error="";try{this.check=await qn()}catch(e){this.error=this.refusalText(e)}finally{this.checking=!1}}}fact(e,t,s,a){return l`<div class="fact" data-wm-fact=${a}><p class="l">${w(e)}</p><p class="v">${t}</p>${s?l`<p class="s">${s}</p>`:d}</div>`}facts(e){const t=e.installed.ownership,s=e.installed.state==="present"?e.installed.version??"—":w("none"),a=de("plan_",e.plan)??e.plan,r=e.plan==="up_to_date"?"ok":["install","upgrade","convert"].includes(e.plan)?"info":"warn";return l`<div class="facts" data-wm-facts>
      ${this.fact("installed",s,l`<span data-wm-ownership=${t}>${de("own_",t)??t}</span>`,"installed")}
      ${this.fact("shipped",e.bundle.version??"—",e.bundle.state!=="ok"?de("plan_","bundle_missing"):null,"shipped")}
      <div class="fact" data-wm-fact="status"><p class="l">${w("status")}</p><p class="s"><span class="pill" data-tone=${r} data-wm-plan=${e.plan}>${a}</span></p></div>
    </div>`}switchRow(e,t){const s=Un(e,t)==="on",a=t==="enabled"?"enabled":t==="startup"?"startup":"risk";return l`<div class="row" data-wm-switch=${t} data-state=${s?"on":"off"}>
      <div>
        <h4 class="t">${w(`${a}Title`)}<span class="pill" data-state=${s?"on":"off"}>${w(s?"on":"off")}</span></h4>
        <p class="x">${w(`${a}Text`)}</p>
      </div>
      <sw-button variant=${s?"secondary":"primary"} data-wm-toggle ?disabled=${!this.canEdit||this.busy||e.running}
        @click=${()=>this.ask({kind:"switch",name:t,next:s?"off":"on"})}>${w(s?"turnOff":"turnOn")}</sw-button>
    </div>`}actions(e){const t=Wn(e);if(e.switches.enabled!=="on")return d;const s=e.plan==="install"?"installButton":e.plan==="convert"?"convertButton":"upgradeButton",a=!this.canEdit||this.busy;return l`<div class="actions" data-wm-actions>
      ${t.adopt?l`<sw-button variant="primary" data-wm-adopt ?disabled=${a} @click=${()=>this.ask({kind:"adopt"})}>${w("adoptButton")}</sw-button>`:d}
      ${t.upgrade?l`<sw-button variant="secondary" data-wm-check ?disabled=${a||this.checking} @click=${()=>void this.runCheck()}>${w(this.checking?"checking":"checkButton")}</sw-button>
        <sw-button variant="primary" data-wm-upgrade ?disabled=${a} @click=${()=>this.ask({kind:"upgrade"})}>${w(s)}</sw-button>`:d}
      ${t.rollback?l`<sw-button variant="secondary" data-wm-rollback ?disabled=${a} @click=${()=>this.ask({kind:"rollback"})}>${w("rollbackButton")}</sw-button>`:d}
    </div>`}checkList(){const e=this.check;if(!e)return d;const t=s=>s==="pass"?"check":s==="warn"?"warning":"close";return l`<div class="sec" data-wm-checks data-ready=${e.ready?"yes":"no"}>
      <h4>${w("checkTitle")}</h4>
      <ul class="list">${e.items.map(s=>l`<li data-wm-check-item=${s.name} data-state=${s.state}>
        <sw-icon name=${t(s.state)} size="16"></sw-icon><span>${de("chk_",s.name)??s.name}</span><span>${w(`chk_${s.state}`)}</span>
        ${s.code?l`<span class="c">${de("code_",s.code)??de("plan_",s.plan)??""} <span class="code">${s.code}</span></span>`:d}
      </li>`)}</ul>
    </div>`}jobView(e){if(!e)return d;const t=new Set,s=[...e.steps.map(f=>f.name)],a=Yn(e);if(!a)for(const f of Gn.slice(0,9))!s.includes(f)&&!(e.kind==="rollback"&&(f==="core_gate"||f==="backup_check"))&&s.push(f);const r=s.filter(f=>t.has(f)?!1:(t.add(f),!0)),i=f=>[...e.steps].reverse().find(p=>p.name===f),o=f=>f==="done"?"check":f==="failed"?"close":f==="running"?"refresh":"clock",c=Qn(e);return l`<div class="sec" data-wm-job data-state=${e.state} data-kind=${e.kind}>
      <h4>${w(a?"lastRun":"progress")}<span class="pill" data-tone=${c}>${de("job_",e.state)??e.state}</span>
        ${e.origin==="startup"?l`<span class="pill" data-wm-origin="startup">${w("originStartup")}</span>`:d}
        <span class="code">${e.from_version??"—"} → ${e.to_version??"—"}</span></h4>
      <ul class="list" aria-live="polite">${r.map(f=>{const p=i(f),v=p?.state??"pending";return l`<li data-wm-step=${f} data-state=${v}><sw-icon name=${o(p?.state)} size="16"></sw-icon><span>${de("step_",f)??f}</span><span></span>
          ${p?.code?l`<span class="c">${de("code_",p.code)??""} <span class="code">${p.code}</span></span>`:d}</li>`})}</ul>
      ${e.risk_accepted?l`<div class="msg"><div class="note stale"><sw-icon name="warning" size="16"></sw-icon><span>${w("riskAccepted")}</span></div></div>`:d}
      ${a&&e.state==="rollback_failed"?l`<div class="msg"><div class="note err" role="alert" data-wm-job-alert><sw-icon name="warning" size="16"></sw-icon><span>${w("job_rollback_failed")}</span></div></div>`:d}
    </div>`}dialog(){const e=this.pending;if(!e)return d;const t=this.phraseFor(e);let s="",a="";if(e.kind==="switch"){const c=e.name==="enabled"?"enabled":e.name==="startup"?"startup":"risk",f=w(`${c}Title`);s=w(e.next==="on"?"typeQ":"offQ",{name:f}),a=e.next==="on"?w(`${c}Text`):w("offText")}else e.kind==="adopt"?(s=w("adoptQ"),a=w("adoptText")):e.kind==="upgrade"?(s=w("upgradeQ"),a=w("upgradeText")):(s=w("rollbackQ"),a=w("rollbackText"));const r=t===null||Gs(this.typed,t),i=e.kind==="switch"&&e.next==="off",o=e.kind==="switch"?w(e.next==="on"?"turnOn":"turnOff"):e.kind==="adopt"?w("adoptButton"):w("start");return l`<sw-dialog open heading=${s} data-wm-dialog=${e.kind==="switch"?`${e.name}-${e.next}`:e.kind} @close=${()=>{this.busy||(this.pending=null)}}>
      <p style="margin:0">${a}</p>
      ${t!==null?l`<label class="typed"><span class="lbl">${w("typeText",{phrase:""})}<span class="phrase" data-wm-phrase>${dr(t)}</span></span>
        <input data-wm-phrase-input autocomplete="off" spellcheck="false" aria-label=${w("typeLabel")} .value=${this.typed}
          @input=${c=>{this.typed=c.target.value,this.dlgError=""}}
          @keydown=${c=>{c.key==="Enter"&&r&&this.confirm()}}></label>`:d}
      ${this.dlgError?l`<p class="err-line" role="alert" data-wm-dialog-error>${this.dlgError}</p>`:d}
      <div class="foot"><sw-button variant="ghost" data-wm-cancel ?disabled=${this.busy} @click=${()=>this.pending=null}>${w("cancel")}</sw-button>
        <sw-button variant=${i?"danger":"primary"} data-wm-confirm ?disabled=${this.busy||!r} @click=${()=>void this.confirm()}>${o}</sw-button></div>
    </sw-dialog>`}render(){if(this.concealed)return d;if(this.loading)return l`<sw-card flush data-wm-card><sw-state-panel state="loading"></sw-state-panel></sw-card>`;if(this.failed||!this.view)return l`<sw-card flush data-wm-card><sw-state-panel state="error" data-wm-load-error heading=${w("loadFailed")} hint=${this.failed}
        actionLabel=${w("retry")} @action=${()=>void this.load()}></sw-state-panel></sw-card>`;const e=this.view;return l`<sw-card flush data-wm-card data-running=${e.running?"yes":"no"}>
      <h3 class="hd">${w("title")}</h3>
      <p class="lead">${w("lead")}</p>
      ${this.facts(e)}
      ${this.switchRow(e,"enabled")}
      ${e.switches.enabled==="on"?this.switchRow(e,"core_risk"):d}
      ${e.switches.enabled==="on"&&e.phrases.startup?this.switchRow(e,"startup"):d}
      ${e.keep_runs!==void 0?this.keepRow(e):d}
      ${this.actions(e)}
      ${this.checkList()}
      ${this.jobView(e.job)}
      ${this.error?l`<div class="msg" style="padding-block-start:14px"><div class="note err" role="alert" data-wm-error><sw-icon name="warning" size="16"></sw-icon><span>${this.error}</span></div></div>`:d}
      ${this.notice&&!this.error?l`<div class="msg" style="padding-block-start:14px"><div class="note info" role="status" data-wm-notice><sw-icon name="check" size="16"></sw-icon><span>${this.notice}</span></div></div>`:d}
      ${e.unattended_permitted?d:l`<p class="foot-note" data-wm-unattended>${w("unattended")}</p>`}
    </sw-card>
    ${this.dialog()}`}};L.styles=[Ut,K`
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
    `];D([h()],L.prototype,"loading",2);D([h()],L.prototype,"failed",2);D([h()],L.prototype,"concealed",2);D([h()],L.prototype,"view",2);D([h()],L.prototype,"pending",2);D([h()],L.prototype,"typed",2);D([h()],L.prototype,"busy",2);D([h()],L.prototype,"dlgError",2);D([h()],L.prototype,"error",2);D([h()],L.prototype,"notice",2);D([h()],L.prototype,"check",2);D([h()],L.prototype,"checking",2);D([h()],L.prototype,"keepDraft",2);D([h()],L.prototype,"keepSaving",2);D([h()],L.prototype,"keepNote",2);L=D([W("system-security-wiskey-managed")],L);const ao=["wiskey.acr5_access_state","wiskey.acr5_normalize_user","wiskey.acr5_presence","wiskey.acr5_feature_plans"],ro={"wiskey.acr5_access_state":"access","wiskey.acr5_normalize_user":"schedule","wiskey.acr5_presence":"presence","wiskey.acr5_feature_plans":"plans"},Qe="wiskey.auto_install",io=()=>C("wiskey/switches"),no=(e,t)=>Be("wiskey/switches",{switches:{[e]:t}});function oo(e){return e.go_live_permitted===!0}function lo(e){return e.auto_install_permitted===!0}function Qs(e){return e instanceof k?e.code==="auto_install_not_permitted"?"installPermit":e.code==="wiskey_not_permitted"||e.status===409?"permit":e.status===403?"forbidden":e.status===422?"invalid":"other":"other"}const co=(e,t)=>e?.switches?.[t]==="on"?"on":"off",Jt={tab:"קריאות בקרת כניסה",title:"קריאות בקרת כניסה",lead:"מתגים שמאפשרים למערכת לבקש מידע ממערכת בקרת הכניסה. כל מתג כבוי כברירת מחדל.",on:"פועל",off:"כבוי",detailsKey:"שם פנימי",accessTitle:"מצב הגישה של אדם",accessText:"בדיקה מול בקרת הכניסה אם הרשאה שבוטלה אכן הוסרה.",scheduleTitle:"השוואת לוח זמנים",scheduleText:"בדיקה אם לוח הזמנים אצל בקרת הכניסה זהה למה שאושר.",presenceTitle:"נוכחות",presenceText:"מידע לבירור בלבד; אינו משמש להוכחת הסרה.",plansTitle:"תוכניות יכולות",plansText:"קריאה של תוכניות בלבד; שום תוכנית אינה מבוצעת.",permitMissing:"אי אפשר להפעיל עדיין: הגרסה הזו אינה כוללת אישור הפעלה לקריאה הזו.",permitRefused:"ההפעלה נדחתה: הגרסה הזו אינה כוללת אישור הפעלה לקריאה הזו. המתג נשאר כבוי.",forbidden:"רק מנהל מערכת יכול לשנות הגדרה זו.",invalid:"הבקשה אינה תקינה.",failed:"השמירה נכשלה",loadFailed:"הטעינה נכשלה",retry:"נסו שוב",turnOn:"הפעלה",turnOff:"כיבוי",cancel:"ביטול",confirmOnQ:'להפעיל את "{name}"?',confirmOnText:"המערכת תתחיל לבקש מידע זה ממערכת בקרת הכניסה. אפשר לכבות שוב בכל רגע.",confirmOffQ:'לכבות את "{name}"?',confirmOffText:"המערכת תפסיק לבקש מידע זה. מה שאי אפשר לוודא ייחשב כלא ידוע.",doneOn:"המתג הופעל",doneOff:"המתג כובה",installGroup:"התקנה אוטומטית",installTitle:"התקנה אוטומטית של רכיב בקרת הכניסה",installText:"כשמופעל, המערכת מתקינה ומעדכנת את רכיב בקרת הכניסה בעצמה, רק אחרי שכל הבדיקות עוברות. התקנה ידנית או זרה לעולם אינה נדרסת.",installPermitMissing:"אי אפשר להפעיל עדיין: בדיקת התאימות של סביבת ההתקנה עדיין אינה יכולה לעבור, ובדיקת המעבדה המבודדת טרם הושלמה.",installPermitRefused:"ההפעלה נדחתה: בדיקת התאימות של סביבת ההתקנה עדיין אינה יכולה לעבור, ובדיקת המעבדה המבודדת טרם הושלמה. המתג נשאר כבוי.",installConfirmOnText:"המערכת תתקין ותעדכן את רכיב בקרת הכניסה בעצמה, רק כשכל הבדיקות עוברות. התקנה ידנית או זרה לא תידרס. אפשר לכבות בכל רגע.",installConfirmOffText:"המערכת תפסיק להתקין ולעדכן את רכיב בקרת הכניסה. מה שכבר מותקן נשאר כפי שהוא."},za=pe("en","i18n/wiskey-switches","en"),Sa=pe("ar","i18n/wiskey-switches","ar"),Ra=pe("ru","i18n/wiskey-switches","ru");function ho(){return ot(["en","ar","ru"])}const po={he:Jt,en:za,ar:Sa,ru:Ra},uo=["ar","ru"];function z(e,t,s=ho()){const a=po[s][e]??Jt[e]??e;return nt(a,t)}it("i18n/wiskey-switches",{he:Jt,en:za,ar:Sa,ru:Ra},uo);var fo=Object.defineProperty,mo=Object.getOwnPropertyDescriptor,ue=(e,t,s,a)=>{for(var r=a>1?void 0:a?mo(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&fo(t,s,r),r};let ae=class extends J{constructor(){super(...arguments),this.loading=!0,this.failed="",this.forbidden=!1,this.view=null,this.pending=null,this.busy=!1,this.dlgError="",this.error="",this.done=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.loading=!0,this.failed="",this.forbidden=!1;try{this.view=await io()}catch(e){Qs(e)==="forbidden"?this.forbidden=!0:this.failed=$e(e)}finally{this.loading=!1}}get canEdit(){return!oe()||Le("system.configure")}ask(e,t){this.busy||!this.canEdit||(this.error="",this.done=null,this.dlgError="",this.pending={key:e,next:t})}refusalText(e,t){return e==="installPermit"?z("installPermitRefused"):e==="permit"?z("permitRefused"):e==="forbidden"?z("forbidden"):e==="invalid"?z("invalid"):`${z("failed")} · ${$e(t)}`}async confirm(){const e=this.pending;if(!(!e||this.busy)){this.busy=!0,this.dlgError="";try{this.view=await no(e.key,e.next),this.done=e.next,this.pending=null}catch(t){const s=Qs(t);(s==="permit"||s==="installPermit")&&this.view?(this.view=s==="installPermit"?{...this.view,auto_install_permitted:!1}:{...this.view,go_live_permitted:!1},this.pending=null,this.error=this.refusalText(s,t)):this.dlgError=this.refusalText(s,t)}finally{this.busy=!1}}}stem(e){return e===Qe?"install":ro[e]}name(e){return z(`${this.stem(e)}Title`)}row(e,t){const s=co(e,t)==="on",a=t===Qe,r=!s&&!(a?lo(e):oo(e)),i=this.stem(t);return l`<div class="sw-row" data-wiskey-switch=${i} data-state=${s?"on":"off"}>
      <div>
        <h4 class="t">${this.name(t)}<span class="pill" data-state=${s?"on":"off"} data-wiskey-state>${z(s?"on":"off")}</span></h4>
        <p class="x">${z(`${i}Text`)}</p>
        <p class="k" data-wiskey-details>${z("detailsKey")}: <code>${t}</code></p>
      </div>
      <sw-button variant=${s?"secondary":"primary"} data-wiskey-toggle ?disabled=${!this.canEdit||this.busy||r} @click=${()=>this.ask(t,s?"off":"on")}>${z(s?"turnOff":"turnOn")}</sw-button>
      ${r?l`<p class="why" data-wiskey-permit><sw-icon name="info" size="14"></sw-icon>${z(a?"installPermitMissing":"permitMissing")}</p>`:d}
    </div>`}dialog(){const e=this.pending;if(!e)return d;const t=e.next==="on",s=e.key===Qe,a=this.name(e.key);return l`<sw-dialog open heading=${z(t?"confirmOnQ":"confirmOffQ",{name:a})} data-wiskey-dialog=${e.next} @close=${()=>{this.busy||(this.pending=null)}}>
      <p style="margin:0">${z(s?t?"installConfirmOnText":"installConfirmOffText":t?"confirmOnText":"confirmOffText")}</p>
      ${this.dlgError?l`<p class="err-line" role="alert" data-wiskey-dialog-error>${this.dlgError}</p>`:d}
      <div class="foot"><sw-button variant="ghost" data-wiskey-cancel ?disabled=${this.busy} @click=${()=>this.pending=null}>${z("cancel")}</sw-button>
        <sw-button variant=${t?"primary":"danger"} data-wiskey-confirm ?disabled=${this.busy} @click=${()=>void this.confirm()}>${z(t?"turnOn":"turnOff")}</sw-button></div>
    </sw-dialog>`}body(){if(this.loading)return l`<sw-state-panel state="loading"></sw-state-panel>`;if(this.forbidden)return l`<sw-state-panel state="forbidden" data-wiskey-forbidden></sw-state-panel>`;if(this.failed||!this.view)return l`<sw-state-panel state="error" heading=${z("loadFailed")} hint=${this.failed} actionLabel=${z("retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=this.view;return l`<sw-card flush data-wiskey-switches>
      <p class="lead">${z("lead")}</p>
      ${ao.map(t=>this.row(e,t))}
      <h3 class="grp-h" data-wiskey-install-group>${z("installGroup")}</h3>
      ${this.row(e,Qe)}
      ${this.error?l`<div class="note err" role="alert" data-wiskey-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:d}
      ${this.done&&!this.error?l`<div class="grp"><span class="ok" role="status" data-wiskey-saved><sw-icon name="check" size=${16}></sw-icon>${z(this.done==="on"?"doneOn":"doneOff")}</span></div>`:d}
    </sw-card>
    <system-security-wiskey-managed></system-security-wiskey-managed>
    ${this.dialog()}`}render(){return l`<sw-page crumbs=${u("הגדרות | אבטחה")} heading=${z("title")}>${this.body()}</sw-page>`}};ae.styles=[Ut,K`
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
    `,Fe];ue([h()],ae.prototype,"loading",2);ue([h()],ae.prototype,"failed",2);ue([h()],ae.prototype,"forbidden",2);ue([h()],ae.prototype,"view",2);ue([h()],ae.prototype,"pending",2);ue([h()],ae.prototype,"busy",2);ue([h()],ae.prototype,"dlgError",2);ue([h()],ae.prototype,"error",2);ue([h()],ae.prototype,"done",2);ae=ue([W("system-security-wiskey")],ae);const wo=()=>C("cameras/discovery/capabilities"),Do=()=>C("cameras/discovery/scans"),Bo=e=>E("cameras/discovery/scans",e.trim()?{range:e.trim()}:{}),Fo=e=>C(lt`cameras/discovery/scans/${e}`),Ho=e=>Ba(lt`cameras/discovery/scans/${e}`),jo=(e,t)=>E(lt`cameras/discovery/scans/${e}/identify`,t),Uo=(e,t)=>E(lt`cameras/discovery/scans/${e}/add`,{cameras:t}),Ko=e=>E("cameras/source/test",e),Xt={findButton:"חיפוש מצלמות ברשת",findOff:"חיפוש מצלמות ברשת כבוי בהגדרות. הוספה ידנית עדיין זמינה.",title:"חיפוש מצלמות ברשת",sub:'רק קריאה: שום דבר לא נשמר ולא נשלח למצלמה עד שלוחצים "הוספה".',stepScan:"חיפוש",stepIdentify:"זיהוי",stepAdd:"בחירה והוספה",close:"סגירה",back:"חזרה",rangeLabel:"טווח כתובות",rangeHelp:"הוצע לפי הרשת של השרת. אפשר לחפש רק ברשת של האתר עצמו.",rangeCap:"עד {max} כתובות בכל חיפוש, כדי שהחיפוש יהיה קצר ולא יעמיס על הרשת.",rangeCount:"בטווח הזה {n} כתובות.",rangeTooLarge:"הטווח כולל {n} כתובות - יותר מ־{max}. צמצמו אותו.",rangeBad:"כתבו טווח בצורה כתובת/אורך, למשל {example}.",start:"התחלת חיפוש",doesTitle:"מה החיפוש עושה ומה לא",doesRead:"קורא שם יצרן, דגם וכתובות וידאו",doesChange:"משנה הגדרות במצלמה או במקליט",doesGuess:"מנחש סיסמאות",doesGuessNote:"רק הסיסמה שתקלידו, ניסיון אחד לכל מצלמה, כדי לא לנעול אותה",doesStore:"שומר סיסמה",doesStoreNote:'רק אחרי "הוספה", מוצפנת כמו סיסמת המקליט',yes:"כן",never:"לעולם לא",onlyOnAdd:"רק בהוספה",searching:"מחפש ב־{range}",stop:"עצירה",stopping:"עוצר…",progressLabel:"התקדמות החיפוש",checked:"נבדקו {checked} מתוך {total}",foundCount:"נמצאו {n}",foundSoFar:"נמצאו עד עכשיו",moreFound:"ועוד {n}",noneYet:"עוד לא נמצא דבר.",stopped:"החיפוש נעצר. אפשר להתחיל חיפוש חדש.",resumed:"חיפוש שהתחלתם קודם עדיין פועל - מוצגות התוצאות שלו.",noneTitle:"לא נמצאו מצלמות ב־{range}",noneOther:"המצלמות ברשת אחרת - נסו טווח אחר.",nonePoe:"המצלמות מחוברות ליציאות PoE של המקליט, ברשת פנימית שהשרת לא רואה. הן כבר מגיעות דרך המקליט.",noneOnvif:"ONVIF כבוי במצלמות - מפעילים אותו בהגדרות הרשת של המצלמה.",otherRange:"חיפוש בטווח אחר",addManual:"הוספה ידנית",failed:"החיפוש נכשל. נסו שוב.",foundLine:"נמצאו {n} התקנים ב־{range}",credTitle:"משתמש וסיסמה של המצלמות",credLead:"ניסיון אחד לכל מצלמה מסומנת. אם הסיסמה שגויה במצלמה מסוימת, לא ננסה שוב אוטומטית.",user:"משתמש",password:"סיסמה",sameForAll:"אותו משתמש וסיסמה לכל המסומנות",sameForAllNote:"הסיסמה נשלחת לכל מצלמה מסומנת כתמצית, לא כטקסט גלוי. מומלץ משתמש צפייה בלבד.",identify:"זיהוי {n} מסומנות",identifyOne:"זיהוי המצלמה המסומנת",identifying:"מזהה…",needSame:'כדי לזהות כמה מצלמות בבת אחת סמנו "אותו משתמש וסיסמה".',nothingToIdentify:"אין מצלמה מסומנת שממתינה לזיהוי.",devicesTitle:"התקנים שנמצאו",selectAll:"סימון הכול",selectNone:"ניקוי הסימון",selectRow:"בחירת {addr}",cannotSelect:"לא ניתן לבחור {addr}",kindCamera:"מצלמה",kindRecorder:"מקליט",kindUnknown:"התקן לא מזוהה",markBehind:"כבר דרך המקליט",markBehindNote:"המצלמה כבר מגיעה דרך המקליט, ולכן אי אפשר להוסיף אותה.",markStandalone:"כבר במערכת",markOwnRecorder:"המקליט של המערכת",markLooksRecorder:"נראה כמו מקליט",recorderNote:"מקליט מוסיפים באשף המקליטים.",addAsRecorder:"הוספה כמקליט",addRecorderTitle:"הוספת מקליט",recorderAdded:"המקליט נוסף. הוא יפעל אחרי הפעלה מחדש של השרת.",noService:"נמצא, אין גישה לשירות ONVIF",authNotTried:"ממתין לזיהוי",authOk:"זוהה · {n} זרמים",authWrong:"סיסמה שגויה",authWrongNote:"לא ננסה שוב עד שתשנו את הסיסמה למצלמה הזו.",authLocked:"נעצר כדי לא לנעול את המצלמה",authLockedNote:"היו כמה ניסיונות שגויים. אפשר לנסות שוב בעוד 15 דקות.",authDigest:"המצלמה מבקשת שיטת כניסה שאינה נתמכת",authBusy:"המצלמה עסוקה בבדיקה אחרת. נסו שוב בעוד רגע.",authNoAnswer:"המצלמה לא ענתה",authNotOnvif:"נמצא, אבל לא מוסר כתובת וידאו",authSkipped:"לא נשלחה סיסמה",noStream:"זוהה, בלי כתובת וידאו",noStreamNote:"המצלמה לא מוסרת זרם שאפשר להשתמש בו. אפשר להוסיף אותה ידנית.",rowPassword:"סיסמה למצלמה {addr}",rowPasswordPh:"סיסמה למצלמה הזו",rowTry:"ניסיון",clockOff:"שעון המצלמה שונה ב־{min} דק׳",mainSub:"ראשי {main} · משני {sub}",mainOnly:"זרם אחד {main}",summaryIdentify:"{ok} זוהו ומוכנות · {waiting} ממתינות · {bad} לא זוהו",pickHint:"סמנו מצלמות והקלידו סיסמה כדי לזהות אותן.",next:"המשך עם {n} מצלמות",nextNone:"המשך",addLead:"בדקו תמונה, שם ואזור. הזרמים נבחרו אוטומטית - אפשר לשנות.",name:"שם",area:"אזור",noArea:"בלי אזור",mainStream:"זרם ראשי",subStream:"זרם משני",sameAsMain:"כמו הראשי",preview:"תצוגה מקדימה",previewing:"טוען…",previewAlt:"תצוגה מקדימה של {name}",previewFailed:"אין תמונה",h265Note:"H.265 לא מוצג בכל דפדפן - הלייב יוצג דרך הזרם המשני.",addFoot:"יתווספו {n} מצלמות ללא מקליט. הסיסמה תישמר מוצפנת.",addN:"הוספת {n} מצלמות",adding:"מוסיף…",nameRequired:"יש להזין שם לכל מצלמה.",doneTitle:"נוספו {n} מצלמות",doneNote:"הן מופיעות ברשימת המצלמות ובלייב. בדיקת תקינות ראשונה בעוד כמה דקות.",partialTitle:"נוספו {added} מתוך {total}",noneAdded:"לא נוספה אף מצלמה",rowAdded:"נוספה",rowFailed:"לא נוספה",finish:"סיום",errRangeInvalid:"טווח הכתובות אינו תקין.",errRangeTooLarge:"הטווח גדול מדי: אפשר לחפש עד {max} כתובות בכל פעם.",errRangeRefused:"אפשר לחפש רק ברשת של האתר עצמו.",errSiteUnknown:"לא ניתן לזהות את רשת האתר, ולכן אי אפשר לחפש מצלמות.",errRunning:"חיפוש מצלמות כבר פועל. המתינו לסיומו או עצרו אותו.",errRate:"יותר מדי ניסיונות ברצף. נסו שוב בעוד {s} שניות.",errRateSoon:"יותר מדי ניסיונות ברצף. נסו שוב מאוחר יותר.",errGone:"החיפוש הסתיים או אינו קיים. התחילו חיפוש חדש.",errOff:"חיפוש מצלמות ברשת כבוי בהגדרות.",errForbidden:"אין לך הרשאה לחפש מצלמות.",errMedia:"שירות הווידאו לא הוגדר, ולכן אי אפשר להציג תמונה או להוסיף מצלמות.",errCreds:"יש להזין שם משתמש וסיסמה.",errSameForAll:'כדי לנסות כמה מצלמות בבת אחת יש לסמן "אותו משתמש וסיסמה".',errDeviceUnknown:"אחד המכשירים שנבחרו אינו ברשימת החיפוש.",errGeneric:"הפעולה נכשלה. נסו שוב.",failBehind:"המצלמה כבר מגיעה דרך המקליט.",failRecorder:"המכשיר הזה הוא מקליט: אפשר להוסיף אותו כמקליט.",failAlready:"המצלמה כבר במערכת.",failNotIdentified:"יש לזהות את המצלמה לפני ההוספה.",failNoStream:"המצלמה לא מסרה כתובת וידאו; אפשר להוסיף אותה ידנית.",failProfile:"הזרם שנבחר אינו של המצלמה הזו.",failDuplicate:"המצלמה נבחרה פעמיים.",failLimit:"הגעתם למספר המרבי של מצלמות ללא מקליט.",failNotAllowed:"כתובת הווידאו של המצלמה אינה מותרת.",failArea:"האזור שנבחר אינו קיים.",failName:"יש להזין שם למצלמה."},Ea=pe("en","i18n/camera-discovery","en");function go(){return ot(["en"])}const bo={he:Xt,en:Ea};function Js(e,t,s=go()){const a=bo[s][e]??Xt[e]??e;return nt(a,t)}it("i18n/camera-discovery",{he:Xt,en:Ea});var vo=Object.defineProperty,yo=Object.getOwnPropertyDescriptor,ie=(e,t,s,a)=>{for(var r=a>1?void 0:a?yo(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&vo(t,s,r),r};let U=class extends J{constructor(){super(...arguments),this.cams=[],this.loaded=!1,this.adding=!1,this.editing=null,this.removing=null,this.busy=!1,this.msg="",this.caps=null,this.finding=!1,this.findReady=!1,this.manualUrl=""}connectedCallback(){super.connectedCallback(),this.load(),this.loadCaps()}async loadCaps(){if(!(!oe()||!Le("system.configure")))try{this.caps=await wo()}catch{this.caps=null}}async openFinder(){this.msg="",this.findReady||(await hr(()=>import("./camera-discovery-dialog-S2ewfh2G.js"),__vite__mapDeps([0]),import.meta.url),this.findReady=!0),this.loadCaps(),this.finding=!0}async load(){try{const e=await Fa();this.cams=e.cameras.filter(t=>t.standalone)}catch{this.cams=[]}finally{this.loaded=!0}}async changed(){await this.load(),oe()&&!Ha("nvr")&&ja()}async runRemove(){const e=this.removing;if(!(!e||this.busy)){this.busy=!0;try{await pr(e.id),this.msg=H("removed"),this.removing=null,await this.changed()}catch(t){this.msg=ur(t)}finally{this.busy=!1}}}render(){return l`<sw-card heading=${H("listTitle")} data-standalone-cameras>
      <p class="note">${H("addLead")}</p>
      ${this.loaded?this.cams.length?l`<ul>${this.cams.map(e=>l`<li data-standalone-camera=${e.id}>
              <sw-badge kind=${e.status==="online"?"live":e.status==="offline"?"offline":"unknown"}></sw-badge>
              <span class="name">${e.name}</span>
              <span class="acts"><sw-button size="sm" variant="ghost" icon="live" @click=${()=>window.location.hash=`#/live/cameras/${e.id}`}>${H("view")}</sw-button>
              <sw-button size="sm" variant="ghost" icon="edit" data-standalone-edit @click=${()=>this.editing=e}>${H("edit")}</sw-button>
              <sw-button size="sm" variant="ghost" icon="close" data-standalone-remove @click=${()=>{this.msg="",this.removing=e}}>${H("remove")}</sw-button></span>
            </li>`)}</ul>`:l`<p class="note" data-standalone-empty>${H("listEmpty")}</p>`:d}
      <div class="actions">
        ${this.caps?.enabled?l`<sw-button size="sm" variant="primary" icon="search" data-discovery-open @click=${()=>void this.openFinder()}>${Js("findButton")}</sw-button>`:d}
        <sw-button size="sm" variant=${this.caps?.enabled?"secondary":"primary"} icon="plus" ?disabled=${!ft(mt(),{ready:!0,testing:!1}).canAdd} data-standalone-add @click=${()=>{this.msg="",this.manualUrl="",this.adding=!0}}>${H("addButton")}</sw-button>
        ${this.caps&&!this.caps.enabled?l`<span class="note" data-discovery-off>${Js("findOff")}</span>`:d}
        ${this.msg?l`<span role="status" class="note" data-standalone-msg>${this.msg}</span>`:d}
        ${ft(mt(),{ready:!0,testing:!1}).note?l`<span class="note" data-webrtc-required>${ft(mt(),{ready:!0,testing:!1}).note}</span>`:d}
      </div>
    </sw-card>
    ${this.findReady?l`<camera-discovery-dialog .open=${this.finding} .caps=${this.caps} @close=${()=>this.finding=!1}
          @added=${()=>void this.changed()}
          @manual-add=${e=>{this.finding=!1,this.manualUrl=e.detail.url,this.adding=!0}}></camera-discovery-dialog>`:d}
    <camera-source-dialog mode="add" prefill-url=${this.manualUrl} .open=${this.adding} @close=${()=>this.adding=!1}
      @saved=${()=>{this.msg=H("added"),this.changed()}}></camera-source-dialog>
    <camera-source-dialog mode="edit" .open=${!!this.editing} camera-id=${this.editing?.id??""} camera-name=${this.editing?.name??""}
      @close=${()=>this.editing=null} @saved=${()=>{this.msg=H("saved"),this.load()}}></camera-source-dialog>
    ${this.removing?l`<sw-dialog open heading=${H("remove")} data-standalone-remove-dialog @close=${()=>this.removing=null}>
          <p>${H("removeConfirm",{name:this.removing.name})}</p>
          <div slot="footer"><sw-button variant="danger" ?disabled=${this.busy} data-standalone-remove-run @click=${()=>void this.runRemove()}>${H("remove")}</sw-button>
            <sw-button variant="ghost" @click=${()=>this.removing=null}>${H("cancel")}</sw-button></div>
        </sw-dialog>`:d}`}};U.styles=K`
    :host {
      display: block;
      margin-block-start: 16px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    li {
      display: flex;
      flex-wrap: wrap; /* EVIDENCE-CAMERAS-2412: at 390 px the three actions ran 46 px past the screen edge; they wrap under the name */
      align-items: center;
      gap: 4px 10px;
      min-block-size: 40px;
    }
    li .acts {
      display: flex;
      gap: 4px;
      margin-inline-start: auto;
    }
    li .name {
      flex: 1 1 8em;
      min-inline-size: 7em; /* EVIDENCE-CAMERAS-2412: the actions wrap before the name shrinks to one letter */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    .note {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 12px;
      align-items: center;
    }
  `;ie([h()],U.prototype,"cams",2);ie([h()],U.prototype,"loaded",2);ie([h()],U.prototype,"adding",2);ie([h()],U.prototype,"editing",2);ie([h()],U.prototype,"removing",2);ie([h()],U.prototype,"busy",2);ie([h()],U.prototype,"msg",2);ie([h()],U.prototype,"caps",2);ie([h()],U.prototype,"finding",2);ie([h()],U.prototype,"findReady",2);ie([h()],U.prototype,"manualUrl",2);U=ie([W("standalone-cameras-card")],U);var $o=Object.defineProperty,xo=Object.getOwnPropertyDescriptor,Ee=(e,t,s,a)=>{for(var r=a>1?void 0:a?xo(t,s):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&$o(t,s,r),r};function _o(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?String(e):Xs(t)}let xe=class extends J{constructor(){super(...arguments),this.bubbleSkin=new jt(this),this.sub="",this.panelId="",this.presenceKnown=Ua()!==null,this.tabsMode=new Ka(this,"settings"),this.giveUp=0}connectedCallback(){super.connectedCallback(),this.stopPresence=Wa(e=>{Ja(e),this.presenceKnown=e!==null,this.requestUpdate()}),Ga(),this.giveUp=window.setTimeout(()=>this.presenceKnown=!0,2500)}disconnectedCallback(){super.disconnectedCallback(),this.stopPresence?.(),window.clearTimeout(this.giveUp)}get api(){return oe()}permitted(e){const t=Ue.find(s=>s.id===e);return!!t&&(!this.api||Je(t.href??"",Ce))}offered(){return Ya(Ue,this.api,Ce)}redirectTo(e){const t=e==="alarm"&&this.panelId?`?panel=${encodeURIComponent(this.panelId)}`:"";window.location.replace(`#/system/security/${e}${t}`)}render(){const e=this.offered();if(!Ue.some(r=>r.id===this.sub)||!this.permitted(this.sub)){if(this.api&&!this.presenceKnown)return l`<sw-state-panel state="loading"></sw-state-panel>`;const r=e[0]?.href?.split("/").pop();return r?(queueMicrotask(()=>this.redirectTo(r)),l`<sw-state-panel state="loading"></sw-state-panel>`):l`<sw-page crumbs=${u("הגדרות")} heading=${u("אבטחה")}><sw-state-panel state="forbidden" data-security-settings-forbidden></sw-state-panel></sw-page>`}const s=Ue.find(r=>r.id===this.sub),a=s&&!e.some(r=>r.id===s.id)?[...e,s]:e;return l`${a.length>1?l`<div class="tabs" data-security-settings-tabs><sw-tabs .variant=${this.tabsMode.props(rs("system.security")).variant} ?adaptive=${this.tabsMode.props(rs("system.security")).adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} .items=${a} .active=${this.sub}></sw-tabs></div>`:d}
      ${this.sub==="alarm"?l`<security-alarm .panelId=${this.panelId}></security-alarm>`:this.sub==="manage"?l`<sw-page crumbs=${u("הגדרות | אבטחה")} heading=${u("ניהול אזעקה")} subheading=${u("לוחות, קוד הלוח, שיוך חיישנים לעקיפה ומדיניות מרחוק")}><system-alarm-settings ?canEdit=${this.api&&Ce("system.configure",!0)}></system-alarm-settings></sw-page>`:this.sub==="cameras"?l`<system-security-cameras></system-security-cameras>`:this.sub==="privacy-masks"?l`<system-security-privacy-masks></system-security-privacy-masks>`:this.sub==="public"?l`<system-security-public></system-security-public>`:this.sub==="wiskey"?l`<system-security-wiskey></system-security-wiskey>`:this.sub==="incidents"?l`<sw-page crumbs=${u("הגדרות | אבטחה")} heading=${u("מצב אירוע חי")} subheading=${u("עמוד אחד לאירוע בזמן אמת: צפייה בלבד, ללא פעולה פיזית")}><incident-settings-form data-incident-settings-page></incident-settings-form></sw-page>`:l`<system-security-nvr></system-security-nvr>`}`}};xe.styles=[fr,K`
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
  `,Fe];Ee([R()],xe.prototype,"sub",2);Ee([R()],xe.prototype,"panelId",2);Ee([h()],xe.prototype,"presenceKnown",2);xe=Ee([W("system-security")],xe);let Te=class extends J{constructor(){super(...arguments),this.bubbleSkin=new jt(this),this.h=null,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(oe())try{this.h=await C("health"),this.error=""}catch(e){this.error=$e(e)}}render(){if(!oe())return l`<sw-page crumbs=${u("הגדרות | אבטחה")} heading="NVR"><sw-state-panel icon="shield" state="empty" heading=${u("המצב מוצג מול שרת אמיתי")} hint=${u("במצב הדגמה אין NVR לקרוא.")}></sw-state-panel></sw-page>`;if(this.error&&!this.h)return l`<sw-page crumbs=${u("הגדרות | אבטחה")} heading="NVR"><sw-state-panel state="error" heading=${u("מצב ה־NVR לא נטען")} hint=${this.error} actionLabel=${u("נסו שוב")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`;if(!this.h)return l`<sw-page crumbs=${u("הגדרות | אבטחה")} heading="NVR"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.h,t=Qa()||e.mode==="ha_only",s=[{href:"#/system/setup",label:u("חיבורים והגדרות ה־NVR"),show:Je("#/system/setup",Ce)},{href:is,label:u("הגדרות מצלמות"),show:!t&&Je(is,Ce)},{href:"#/investigate/health",label:u("בריאות מצלמות"),show:!t&&Je("#/investigate/health",Ce)}].filter(a=>a.show);return l`<sw-page crumbs=${u("הגדרות | אבטחה")} heading="NVR" subheading=${t?u("ללא NVR"):e.nvr_configured?u("מוגדר"):u("לא מוגדר")}>
      <sw-card heading=${u("מצב")} data-security-nvr>
        <div class="rows">
          <div class="row"><span>NVR</span><span class=${t?"":e.nvr_configured?"msg ok":"msg err"}>${t?u("מצב ללא NVR"):e.nvr_configured?u("מוגדר"):u("לא מוגדר")}</span></div>
          ${t?d:l`<div class="row"><span>${u("זרם התראות")}</span><span class=${e.events.ingest.connected?"msg ok":"msg err"}>${e.events.ingest.connected?u("מחובר"):u("מנותק")}</span></div>
                <div class="row"><span>${u("ערוצים שגולו")}</span><span>${e.discovery.cameras}</span></div>
                <div class="row"><span>${u("גילוי אחרון תקין")}</span><span class=${e.discovery.cameras_last_error?"warn":""}>${_o(e.discovery.cameras_last_ok)}</span></div>`}
        </div>
        ${s.length?l`<div class="actions">${s.map(a=>l`<sw-button size="sm" variant="ghost" @click=${()=>window.location.hash=a.href}>${a.label}</sw-button>`)}</div>`:d}
      </sw-card>
      ${Le("system.configure")?l`<standalone-cameras-card></standalone-cameras-card>`:d}
    </sw-page>`}};Te.styles=[xe.styles,Fe];Ee([h()],Te.prototype,"h",2);Ee([h()],Te.prototype,"error",2);Te=Ee([W("system-security-nvr")],Te);const Wo=Object.freeze(Object.defineProperty({__proto__:null,get SystemSecurity(){return xe},get SystemSecurityNvr(){return Te}},Symbol.toStringTag,{value:"Module"}));export{Ho as a,Uo as b,Js as c,Wo as d,Fo as g,jo as i,Do as l,Ko as p,Bo as s};
