const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as Y}from"./sw-logo-art-PLtEZJxU.js";import{e3 as w,i as H,c9 as W,A as l,b as r,jY as _,jZ as z,g as X,v as B,j as u,k as J}from"./index-c_ii2C2N.js";import"./sw-pager-yILvgW0Q.js";import"./sw-steps-p1Amfu0n.js";import{c as i,a as k,l as L,g as V,s as Z,i as Q,p as ee,b as te}from"./system-security-DjoWn2PG.js";import"./security-alarm-BThRwMBR.js";import"./long-lists-KFWLR6_3.js";import"./page-fit-CNW9RZGs.js";import"./latest-DjG5XH9h.js";import"./bubble-chrome-CEvaQs6M.js";import"./media-ChiRjfra.js";import"./live-DMqV6qVh.js";import"./toast-controller-BPX0Tkjm.js";import"./system-alarm-DQ0t8qJz.js";import"./confirm-dialog-CAb12P-Z.js";import"./system-a-BvttXb3p.js";import"./nvr-h264-preset-DPMmRHn8.js";import"./access-grants-1iNKDnWY.js";import"./status-css-Dr8nH5Ai.js";import"./pending-model-C6ok3TVH.js";import"./confirm-words-CfhZlgH0.js";import"./settings-form-c_ZBDVVJ.js";import"./camera-source-dialog-C9U_Y_Kn.js";import"./settings-ChpRrzuB.js";const se="192.0.2.0/24";function ie(e){const t=/^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})\s*$/.exec(e);if(!t)return null;const s=t.slice(1,5).map(Number),a=Number(t[5]);return s.some(n=>n>255)||a>32?null:2**(32-a)}function S(e,t){if(!e.trim())return{ok:!0,text:"",tone:"muted"};const s=ie(e);return s===null?{ok:!1,text:i("rangeBad",{example:w(se)}),tone:"bad"}:t>0&&s>t?{ok:!1,text:i("rangeTooLarge",{n:s.toLocaleString("en-US"),max:t.toLocaleString("en-US")}),tone:"bad"}:{ok:!0,text:i("rangeCount",{n:s.toLocaleString("en-US")}),tone:"muted"}}function ae(e){if(!e)return 0;if(e.state!=="running")return 100;const{checked:t,total:s}=e.progress;return s>0?Math.max(0,Math.min(100,Math.round(t/s*100))):0}function A(e){return e.kind==="nvr"||e.known==="recorder"?"recorder":e.kind==="camera"?"camera":"unknown"}const E={camera:"kindCamera",recorder:"kindRecorder",unknown:"kindUnknown"};function g(e){return e.addable&&e.known==="none"&&e.kind!=="nvr"&&e.has_service}function ne(e){return e.known==="behind_recorder"?{key:"markBehind",note:"markBehindNote",tone:"muted"}:e.known==="standalone"?{key:"markStandalone",note:null,tone:"accent"}:e.known==="recorder"?{key:"markOwnRecorder",note:null,tone:"muted"}:e.kind==="nvr"?{key:"markLooksRecorder",note:"recorderNote",tone:"muted"}:e.has_service?null:{key:"noService",note:"noStreamNote",tone:"warn"}}const F=e=>e.kind==="nvr"&&e.known!=="recorder"&&!!e.recorder_prefill,x=e=>e.profiles.filter(t=>t.stream==="ok"),G=e=>g(e)&&e.auth==="ok"&&x(e).length>0;function re(e){switch(e.auth){case"ok":{const t=x(e).length;return t?{text:i("authOk",{n:t}),tone:"ok",note:le(e)}:{text:i("noStream"),tone:"warn",note:i("noStreamNote")}}case"wrong_password":return{text:i("authWrong"),tone:"bad",note:i("authWrongNote")};case"locked_guard":return{text:i("authLocked"),tone:"bad",note:i("authLockedNote")};case"digest_required":return{text:i("authDigest"),tone:"warn",note:i("noStreamNote")};case"busy":return{text:i("authBusy"),tone:"warn",note:""};case"no_answer":return{text:i("authNoAnswer"),tone:"warn",note:""};case"not_onvif":return{text:i("authNotOnvif"),tone:"warn",note:i("noStreamNote")};case"skipped":return{text:i("authSkipped"),tone:"muted",note:""};default:return{text:i("authNotTried"),tone:"muted",note:""}}}const R=(e,t)=>`${e}${t}`,oe=new Set(["not_tried","no_answer","busy"]);function M(e,t,s,a){return e.filter(n=>t.has(n.id)&&g(n)).filter(n=>oe.has(n.auth)||n.auth==="wrong_password"&&s.get(n.id)!==a).map(n=>n.id)}function T(e,t,s,a){return e.length?!t.trim()||!s?"creds":e.length>1&&!a?"same":"":"none"}function D(e,t,s,a){return e.auth!=="wrong_password"||!g(e)||!t.trim()||!s?!1:a.get(e.id)!==R(t,s)}function $(e){const t=e.width&&e.height?w(`${e.width}×${e.height}`):"",s=e.codec?de[e.codec]:"";return[t,s].filter(Boolean).join(" · ")||w(e.name??e.token)}const de={h264:"H.264",h265:"H.265",mjpeg:"MJPEG",mpeg4:"MPEG-4",other:""};function K(e){const t=x(e),s=o=>!!o&&t.some(d=>d.token===o),a=s(e.suggested.main)?e.suggested.main:t[0]?.token??null,n=s(e.suggested.sub)&&e.suggested.sub!==a?e.suggested.sub:null;return{main:a,sub:n}}function le(e){const{main:t,sub:s}=K(e),a=d=>e.profiles.find(f=>f.token===d),n=a(t),o=a(s);return n?o?i("mainSub",{main:$(n),sub:$(o)}):i("mainOnly",{main:$(n)}):""}function ce(e){const t=e.address.split(".").pop()??e.address;return`${[e.manufacturer,e.model].filter(Boolean).join(" ").trim()||e.name?.trim()||i("kindCamera")} - ${t}`.slice(0,120)}function pe(e){return e===null||Math.abs(e)<120?"":i("clockOff",{min:Math.round(Math.abs(e)/60)})}const he=(e,t)=>e.profiles.find(s=>s.token===t)?.codec==="h265";function j(e,t,s){const a=Math.max(1,Math.ceil(e.length/Math.max(1,s))),n=Math.min(Math.max(1,t),a);return{items:e.slice((n-1)*s,n*s),page:n,pages:a}}function ue(e,t,s){return e==="add"?t?1:s>=860?4:s>=720?3:2:t?s>=800?3:2:s>=860?5:s>=820?4:3}function me(e,t){const s=e.filter(o=>t.has(o.id)&&g(o)),a=s.filter(G).length,n=s.filter(o=>o.auth==="not_tried").length;return{ok:a,waiting:n,bad:s.length-a-n}}const C={range_invalid:"errRangeInvalid",range_too_large:"errRangeTooLarge",range_refused:"errRangeRefused",site_network_unknown:"errSiteUnknown",scan_running:"errRunning",scan_not_found:"errGone",scan_not_active:"errGone",discovery_off:"errOff",webrtc_server_required:"errMedia",media_not_configured:"errMedia",credentials_invalid:"errCreds",same_for_all_required:"errSameForAll",device_unknown:"errDeviceUnknown",forbidden:"errForbidden"};function y(e){return typeof e=="object"&&e!==null&&"code"in e?String(e.code??""):""}function b(e,t=1024){const s=typeof e=="object"&&e!==null?e:{},a=Number(s.status??0),n=y(e);if(a===429||n==="rate_limited"){const o=Number(s.body?.details?.retry_after_s??0);return o>0?i("errRate",{s:o}):i("errRateSoon")}return C[n]?i(C[n],{max:t.toLocaleString("en-US")}):a===403?i("errForbidden"):i("errGeneric")}const O={behind_recorder:"failBehind",is_recorder:"failRecorder",already_added:"failAlready",not_identified:"failNotIdentified",no_stream:"failNoStream",profile_unknown:"failProfile",device_duplicate:"failDuplicate",device_unknown:"errDeviceUnknown",standalone_limit:"failLimit",source_not_allowed:"failNotAllowed",source_not_supported:"failNotAllowed",area_invalid:"failArea",name_required:"failName"};function fe(e){return O[e.code]?i(O[e.code]):e.message||i("errGeneric")}function ge(e){const t=e.added.length,s=t+e.failed.length;return t?e.failed.length?{tone:"warn",title:i("partialTitle",{added:t,total:s})}:{tone:"ok",title:i("doneTitle",{n:t})}:{tone:"bad",title:i("noneAdded")}}function we(e,t){const s=new Map(t.map(a=>[a.id,a]));return e.map(a=>s.get(a.id)??a)}function I(e){return e.filter(t=>t.state==="running").sort((t,s)=>s.started_at.localeCompare(t.started_at))[0]??null}var ve=Object.defineProperty,be=Object.getOwnPropertyDescriptor,h=(e,t,s,a)=>{for(var n=a>1?void 0:a?be(t,s):t,o=e.length-1,d;o>=0;o--)(d=e[o])&&(n=(a?d(t,s,n):d(n))||n);return a&&n&&ve(t,s,n),n};const q=1e3,U={camera:"camera",recorder:"storage",unknown:"help"};let p=class extends H{constructor(){super(...arguments),this.open=!1,this.caps=null,this.step="scan",this.phase="setup",this.range="",this.job=null,this.devices=[],this.selected=new Set,this.user="",this.password="",this.sameForAll=!0,this.rowPw={},this.pressing=new Set,this.page=1,this.drafts={},this.previews={},this.areas=[],this.busy=!1,this.result=null,this.msg=null,this.recorderFor=null,this.recorderReady=!1,this.tried=new Map,this.timer=0,this.generation=0,this.mq=window.matchMedia("(max-width: 767px)"),this.onResize=()=>this.requestUpdate()}connectedCallback(){super.connectedCallback(),this.mq.addEventListener("change",this.onResize),window.addEventListener("resize",this.onResize)}disconnectedCallback(){if(super.disconnectedCallback(),this.mq.removeEventListener("change",this.onResize),window.removeEventListener("resize",this.onResize),this.stopPolling(),this.open){this.user=this.password="",this.rowPw={},this.tried.clear();const e=this.job;e&&e.state!=="running"&&k(e.id).catch(()=>{})}}updated(e){e.has("open")&&this.open&&!e.get("open")&&this.reset()}async reset(){this.generation+=1,this.stopPolling(),this.step="scan",this.phase="setup",this.range=this.caps?.suggested_range??"",this.job=null,this.devices=[],this.selected=new Set,this.user="",this.password="",this.sameForAll=!0,this.rowPw={},this.pressing=new Set,this.page=1,this.drafts={},this.previews={},this.result=null,this.msg=null,this.busy=!1,this.recorderFor=null,this.tried.clear();const e=this.generation;try{const t=I((await L()).scans);t&&e===this.generation&&this.open&&(this.msg={tone:"muted",text:i("resumed")},await this.follow(t.id))}catch{}}async close(){const e=this.job;if(this.generation+=1,this.stopPolling(),this.open=!1,this.user=this.password="",this.rowPw={},this.tried.clear(),this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0})),e&&e.state!=="running")try{await k(e.id)}catch{}}stopPolling(){window.clearTimeout(this.timer),this.timer=0}async follow(e){const t=this.generation;try{const s=await V(e);if(t!==this.generation)return;this.apply(s),s.state==="running"&&(this.timer=window.setTimeout(()=>void this.follow(e),q))}catch(s){if(t!==this.generation)return;this.job=null,this.phase=y(s)==="scan_not_found"?"setup":"failed",this.msg={tone:"bad",text:b(s,this.max)}}}apply(e){if(this.job=e,this.devices=e.devices,e.state==="running"){this.phase="running";return}if(e.state==="done"){if(!e.devices.length){this.phase="none";return}this.selected=new Set(e.devices.filter(g).map(t=>t.id)),this.page=1,this.step="identify",this.msg=null;return}if(e.state==="cancelled"){this.phase="setup",this.job=null,this.msg={tone:"muted",text:i("stopped")};return}this.phase="failed",this.msg={tone:"bad",text:i("failed")}}get max(){return this.caps?.max_addresses??1024}get phone(){return this.mq.matches}get size(){return ue(this.step,this.phone,window.innerHeight)}async start(){if(!(this.busy||!S(this.range,this.max).ok)){this.busy=!0,this.msg=null;try{const e=await Z(this.range);this.apply(e),e.state==="running"&&(this.timer=window.setTimeout(()=>void this.follow(e.id),q))}catch(e){if(y(e)==="scan_running")try{const t=I((await L()).scans);if(t){this.msg={tone:"muted",text:i("resumed")},await this.follow(t.id);return}}catch{}this.msg={tone:"bad",text:b(e,this.max)}}finally{this.busy=!1}}}async stop(){const e=this.job;if(!(!e||this.busy)){this.busy=!0,this.generation+=1,this.stopPolling();try{await k(e.id)}catch{}finally{this.busy=!1,this.job=null,this.devices=[],this.phase="setup",this.msg={tone:"muted",text:i("stopped")}}}}async again(){const e=this.job;if(this.generation+=1,this.stopPolling(),this.step="scan",this.phase="setup",this.job=null,this.devices=[],this.selected=new Set,this.result=null,this.drafts={},this.previews={},this.tried.clear(),this.rowPw={},this.msg=null,e)try{await k(e.id)}catch{}}manual(e=""){this.dispatchEvent(new CustomEvent("manual-add",{detail:{url:e?`rtsp://${e}:554/`:""},bubbles:!0,composed:!0})),this.close()}toggle(e,t){const s=new Set(this.selected);t?s.add(e):s.delete(e),this.selected=s}selectAll(e){this.selected=new Set(e?this.devices.filter(g).map(t=>t.id):[])}get pair(){return R(this.user.trim(),this.password)}async press(e,t,s){const a=this.job;if(!a||!e.length)return;const n=this.user.trim();for(const o of e)this.tried.set(o,R(n,t));this.pressing=new Set([...this.pressing,...e]),this.msg=null;try{const o=await Q(a.id,{device_ids:e,username:n,password:t,same_for_all:s});this.devices=we(this.devices,o.devices)}catch(o){this.msg={tone:"bad",text:b(o,this.max)},(y(o)==="scan_not_found"||y(o)==="scan_not_active")&&(this.job=null)}finally{const o=new Set(this.pressing);for(const d of e)o.delete(d);this.pressing=o}}identifyAll(){const e=M(this.devices,this.selected,this.tried,this.pair);T(e,this.user,this.password,this.sameForAll)||this.press(e,this.password,this.sameForAll)}retry(e){const t=this.rowPw[e.id]??"";D(e,this.user,t,this.tried)&&this.press([e.id],t,!1)}openRecorder(e){this.recorderReady=!!customElements.get("nvr-connection-form"),this.recorderFor=e,this.recorderReady||Y(()=>import("./nvr-connection-form-BnYHC60n.js"),__vite__mapDeps([0]),import.meta.url).then(()=>this.recorderReady=!0)}toAdd(){const e=this.devices.filter(s=>this.selected.has(s.id)&&G(s));if(!e.length)return;const t={};for(const s of e){const a=K(s);t[s.id]=this.drafts[s.id]??{name:ce(s),area:"",main:a.main,sub:a.sub}}this.drafts=t,this.result=null,this.step="add",this.page=1,this.msg=null,this.loadAreas()}async loadAreas(){try{const e=await W();this.areas=e.floors.flatMap(t=>t.areas.map(s=>({id:s.area_id,name:t.floor_id==="none"?s.name:`${s.name} · ${t.name}`})))}catch{this.areas=[]}}get addList(){return this.devices.filter(e=>!!this.drafts[e.id])}setDraft(e,t){if(this.drafts={...this.drafts,[e]:{...this.drafts[e],...t}},"main"in t||"sub"in t){const{[e]:s,...a}=this.previews;this.previews=a}}async preview(e){const t=this.job,s=this.drafts[e.id];if(!t||!s||this.previews[e.id]?.state==="loading")return;this.previews={...this.previews,[e.id]:{state:"loading"}};const a=s.sub??s.main??void 0;try{const n=await ee({scan_id:t.id,device_id:e.id,profile:s.sub?"sub":"main",...a?{profile_token:a}:{}});this.previews={...this.previews,[e.id]:n.ok?{state:"ok",src:n.preview}:{state:"fail",text:n.message}}}catch(n){this.previews={...this.previews,[e.id]:{state:"fail",text:b(n,this.max)}}}}async add(){const e=this.job,t=this.addList;if(!(!e||!t.length||this.busy)){if(t.some(s=>!this.drafts[s.id].name.trim())){this.msg={tone:"bad",text:i("nameRequired")};return}this.busy=!0,this.msg=null;try{const s=await te(e.id,t.map(a=>{const n=this.drafts[a.id];return{device_id:a.id,name:n.name.trim(),area_id:n.area||null,...n.main?{main_profile:n.main}:{},...n.sub?{sub_profile:n.sub}:{}}}));this.result=s,this.page=1,s.added.length&&this.dispatchEvent(new CustomEvent("added",{detail:{added:s.added},bubbles:!0,composed:!0}))}catch(s){this.msg={tone:"bad",text:b(s,this.max)}}finally{this.busy=!1}}}chip(e,t="muted",s=""){return r`<span class="chip" data-tone=${t} data-chip=${s||l}>${e}</span>`}renderSetup(){const e=S(this.range,this.max),t=this.max.toLocaleString("en-US");return r`<div class="cols">
      <section class="panel" data-discovery-setup>
        <sw-field label=${i("rangeLabel")}>
          <input dir="ltr" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="43" data-discovery-range
            placeholder=${this.caps?.suggested_range??""} .value=${this.range} aria-invalid=${e.ok?"false":"true"}
            @input=${s=>this.range=s.target.value}
            @keydown=${s=>{s.key==="Enter"&&this.start()}} />
        </sw-field>
        <p class="help">${i("rangeHelp")}</p>
        <p class="help" data-discovery-cap>${i("rangeCap",{max:t})}</p>
        ${e.text?r`<p class=${`msg tone-${e.tone}`} data-discovery-range-check=${e.ok?"ok":"bad"}>${e.text}</p>`:l}
      </section>
      <section class="panel facts" aria-labelledby="cd-facts">
        <h4 id="cd-facts">${i("doesTitle")}</h4>
        <div class="row"><span>${i("doesRead")}</span>${this.chip(i("yes"),"ok")}</div>
        <div class="row"><span>${i("doesChange")}</span>${this.chip(i("never"))}</div>
        <div class="row"><span>${i("doesGuess")}<small>${i("doesGuessNote")}</small></span>${this.chip(i("never"))}</div>
        <div class="row"><span>${i("doesStore")}<small>${i("doesStoreNote")}</small></span>${this.chip(i("onlyOnAdd"),"accent")}</div>
      </section>
    </div>`}renderRunning(){const e=this.job;if(!e)return l;const t=ae(e),s=this.phone?3:5,a=e.devices.slice(-s),n=e.devices.length-a.length;return r`<section class="panel" data-discovery-running>
        <h4>${i("searching",{range:w(e.range)})}</h4>
        <div class="prog" role="progressbar" aria-label=${i("progressLabel")} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${t} data-discovery-progress=${t}>
          <i style=${`inline-size:${t}%`}></i>
        </div>
        <div class="stats">
          <span data-discovery-checked>${i("checked",{checked:e.progress.checked.toLocaleString("en-US"),total:e.progress.total.toLocaleString("en-US")})}</span>
          <span data-discovery-found>${i("foundCount",{n:e.devices.length})}</span>
        </div>
      </section>
      <section class="list" aria-live="polite" aria-labelledby="cd-sofar">
        <div class="list-head"><h4 id="cd-sofar">${i("foundSoFar")}</h4>${n>0?r`<span class="note">${i("moreFound",{n})}</span>`:l}</div>
        ${a.length?a.map(o=>r`<div class="dev" data-discovery-live=${o.id}><span></span><sw-icon name=${U[A(o)]}></sw-icon>
              <div class="who"><div class="t">${i(E[A(o)])}</div><div class="d"><span class="ip">${o.address}</span></div></div><span></span><span></span></div>`):r`<div class="dev"><span></span><span></span><div class="note">${i("noneYet")}</div><span></span><span></span></div>`}
      </section>`}renderNone(){const e=this.job?.range??this.range;return r`<section class="panel empty" data-discovery-none>
      <sw-icon name="search"></sw-icon>
      <h4>${i("noneTitle",{range:w(e)})}</h4>
      <ul>
        <li>${i("noneOther")}</li>
        <li>${i("nonePoe")}</li>
        <li>${i("noneOnvif")}</li>
      </ul>
      <div class="btns">
        <sw-button variant="primary" icon="search" data-discovery-other @click=${()=>void this.again()}>${i("otherRange")}</sw-button>
        <sw-button icon="plus" data-discovery-manual @click=${()=>this.manual()}>${i("addManual")}</sw-button>
      </div>
    </section>`}renderDevice(e){const t=A(e),s=g(e),a=ne(e),n=re(e),o=this.pressing.has(e.id),d=[e.manufacturer,e.model].filter(Boolean).join(" ")||e.name||i(E[t]),f=pe(e.clock_offset_s),c=this.rowPw[e.id]??"";let m;a?m=r`${this.chip(i(a.key),a.tone,"mark")}${a.note?r`<span>${i(a.note)}</span>`:l}`:o?m=r`<span data-discovery-identifying><span class="spin" aria-hidden="true"></span> ${i("identifying")}</span>`:m=r`${this.chip(n.text,n.tone,"auth")}${n.note?r`<span>${n.note}</span>`:l}`;const N=!a&&!o&&e.auth==="wrong_password"&&s?r`<span class="pw"><input type="password" autocomplete="new-password" maxlength="128" data-discovery-row-pw=${e.id}
            aria-label=${i("rowPassword",{addr:e.address})} placeholder=${i("rowPasswordPh")} .value=${c}
            @input=${v=>this.rowPw={...this.rowPw,[e.id]:v.target.value}}
            @keydown=${v=>{v.key==="Enter"&&this.retry(e)}} />
          <sw-button size="sm" ?disabled=${!D(e,this.user,c,this.tried)} data-discovery-row-try=${e.id} @click=${()=>this.retry(e)}>${i("rowTry")}</sw-button></span>`:l,P=s&&(e.auth==="not_onvif"||e.auth==="digest_required"||e.auth==="ok"&&!x(e).length);return r`<div class=${`dev${s?"":" dim"}`} data-discovery-device=${e.id} data-kind=${t} data-known=${e.known} data-auth=${e.auth}>
      <input type="checkbox" .checked=${s&&this.selected.has(e.id)} ?disabled=${!s} data-discovery-select=${e.id}
        aria-label=${s?i("selectRow",{addr:e.address}):i("cannotSelect",{addr:e.address})}
        @change=${v=>this.toggle(e.id,v.target.checked)} />
      <sw-icon name=${U[t]} aria-hidden="true"></sw-icon>
      <div class="who">
        <div class="t">${d}</div>
        <div class="d"><span class="ip">${e.address}</span>${e.firmware?r`<span>· ${w(e.firmware)}</span>`:l}${f?this.chip(f,"warn"):l}</div>
      </div>
      <div class="st" data-discovery-status>${m}</div>
      ${N!==l||F(e)||P?r`<div class="end">
            ${N}
            ${F(e)?r`<sw-button size="sm" icon="storage" data-discovery-as-recorder=${e.id} @click=${()=>this.openRecorder(e)}>${i("addAsRecorder")}</sw-button>`:l}
            ${P?r`<sw-button size="sm" variant="ghost" icon="plus" data-discovery-row-manual=${e.id} @click=${()=>this.manual(e.address)}>${i("addManual")}</sw-button>`:l}
          </div>`:l}
    </div>`}renderIdentify(){const e=this.job,t=this.devices,s=M(t,this.selected,this.tried,this.pair),a=T(s,this.user,this.password,this.sameForAll),n=this.pressing.size>0,o=j(t,this.page,this.size),d=t.some(g),f=d&&t.filter(g).every(m=>this.selected.has(m.id)),c=a==="same"?i("needSame"):"";return r`${e?r`<p class="lead hide-phone" data-discovery-found-line>${i("foundLine",{n:t.length,range:w(e.range)})}</p>`:l}
      <section class="panel" aria-labelledby="cd-cred" data-discovery-cred>
        <h4 id="cd-cred">${i("credTitle")}</h4>
        <p class="help">${i("credLead")}</p>
        <div class="cred">
          <sw-field label=${i("user")}><input dir="ltr" autocomplete="off" spellcheck="false" maxlength="64" data-discovery-user .value=${this.user}
            @input=${m=>this.user=m.target.value} /></sw-field>
          <sw-field label=${i("password")}><input type="password" autocomplete="new-password" maxlength="128" data-discovery-password .value=${this.password}
            @input=${m=>this.password=m.target.value}
            @keydown=${m=>{m.key==="Enter"&&this.identifyAll()}} /></sw-field>
          <sw-button variant="primary" icon="lock" ?disabled=${!!a||n} data-discovery-identify @click=${()=>this.identifyAll()}>
            ${n?i("identifying"):s.length>1?i("identify",{n:s.length}):s.length?i("identifyOne"):i("stepIdentify")}</sw-button>
          <label class="check"><input type="checkbox" .checked=${this.sameForAll} data-discovery-same
            @change=${m=>this.sameForAll=m.target.checked} />${i("sameForAll")}</label>
        </div>
        <p class="help hide-phone">${i("sameForAllNote")}</p>
        ${c?r`<p class="msg tone-warn" data-discovery-block=${a}>${c}</p>`:l}
      </section>
      <section class="list" aria-labelledby="cd-devs">
        <div class="list-head">
          <h4 id="cd-devs"><span class="hide-phone">${i("devicesTitle")}</span></h4>
          ${d?r`<sw-button size="sm" variant="ghost" data-discovery-select-all @click=${()=>this.selectAll(!f)}>${f?i("selectNone"):i("selectAll")}</sw-button>`:l}
          <sw-pager .page=${o.page} .pages=${o.pages} data-discovery-pager @page-change=${m=>this.page=m.detail.page}></sw-pager>
        </div>
        <div aria-live="polite">${o.items.map(m=>this.renderDevice(m))}</div>
      </section>`}renderAddRow(e){const t=this.drafts[e.id],s=this.previews[e.id],a=x(e),n=_(z(),{ready:!0,testing:s?.state==="loading"}),o=s?.state==="ok"?r`<img src=${s.src??""} alt=${i("previewAlt",{name:t.name})} />`:s?.state==="loading"?r`<span role="status"><span class="spin" aria-hidden="true"></span> ${i("previewing")}</span>`:r`<span>${s?.state==="fail"?r`<span class="tone-bad" data-discovery-preview-fail>${s.text||i("previewFailed")}</span><br />`:l}
            <sw-button size="sm" variant="ghost" icon="eye" ?disabled=${!n.canTest} data-discovery-preview=${e.id} @click=${()=>void this.preview(e)}>${i("preview")}</sw-button></span>`;return r`<div class="addrow" data-discovery-add-row=${e.id}>
      <div class="thumb" data-discovery-thumb=${s?.state??"none"}>${o}</div>
      <sw-field label=${i("name")}><input maxlength="120" data-discovery-name=${e.id} .value=${t.name}
        aria-invalid=${t.name.trim()?"false":"true"} @input=${d=>this.setDraft(e.id,{name:d.target.value})} /></sw-field>
      <sw-field label=${i("area")}><select data-discovery-area=${e.id} @change=${d=>this.setDraft(e.id,{area:d.target.value})}>
        <option value="" ?selected=${!t.area}>${i("noArea")}</option>
        ${this.areas.map(d=>r`<option value=${d.id} ?selected=${d.id===t.area}>${d.name}</option>`)}
      </select></sw-field>
      <div class="wide">
        <div class="streams">
          <sw-field label=${i("mainStream")}><select data-discovery-main=${e.id} @change=${d=>{const f=d.target.value;this.setDraft(e.id,{main:f,sub:t.sub===f?null:t.sub})}}>${a.map(d=>r`<option value=${d.token} ?selected=${d.token===t.main}>${$(d)}</option>`)}</select></sw-field>
          <sw-field label=${i("subStream")}><select data-discovery-sub=${e.id} @change=${d=>this.setDraft(e.id,{sub:d.target.value||null})}>
            <option value="" ?selected=${!t.sub}>${i("sameAsMain")}</option>
            ${a.filter(d=>d.token!==t.main).map(d=>r`<option value=${d.token} ?selected=${d.token===t.sub}>${$(d)}</option>`)}
          </select></sw-field>
        </div>
        ${he(e,t.main)?r`<p class="help" data-discovery-h265>${i("h265Note")}</p>`:l}
      </div>
    </div>`}renderAdd(){const e=this.result;if(e){const n=ge(e),o=new Map(this.addList.map(c=>[c.id,this.drafts[c.id]?.name??c.address])),d=[...e.failed.map(c=>({id:c.device_id,ok:!1,why:fe(c)})),...e.added.map(c=>({id:c.device_id,ok:!0,why:""}))],f=j(d,this.page,this.phone?5:8);return r`<div class="result" role="status" data-discovery-result=${n.tone}>
          <sw-icon class=${`tone-${n.tone}`} name=${n.tone==="ok"?"check":"warning"}></sw-icon>
          <div><div class="t">${n.title}</div>${e.added.length?r`<div class="note">${i("doneNote")}</div>`:l}</div>
        </div>
        <section class="list">
          ${f.pages>1?r`<div class="list-head"><span style="flex:1"></span><sw-pager .page=${f.page} .pages=${f.pages} @page-change=${c=>this.page=c.detail.page}></sw-pager></div>`:l}
          ${f.items.map(c=>r`<div class="resrow" data-discovery-result-row=${c.id} data-ok=${c.ok?"true":"false"}>
            <span class="t">${o.get(c.id)??c.id}</span>${this.chip(c.ok?i("rowAdded"):i("rowFailed"),c.ok?"ok":"bad")}
            ${c.why?r`<span class="why">${c.why}</span>`:l}</div>`)}
        </section>`}const t=this.addList,s=j(t,this.page,this.size),a=_(z(),{ready:!0,testing:!1});return r`<p class="lead">${i("addLead")}</p>
      ${a.note?r`<p class="msg tone-warn" data-webrtc-required>${a.note}</p>`:l}
      <section class="list" aria-label=${i("stepAdd")}>
        ${s.pages>1?r`<div class="list-head"><span style="flex:1"></span><sw-pager .page=${s.page} .pages=${s.pages} data-discovery-pager @page-change=${n=>this.page=n.detail.page}></sw-pager></div>`:l}
        ${s.items.map(n=>this.renderAddRow(n))}
      </section>
      <p class="note" data-discovery-add-foot>${i("addFoot",{n:t.length})}</p>`}footer(){if(this.step==="scan")return this.phase==="running"?r`<sw-button variant="danger" icon="close" ?disabled=${this.busy} data-discovery-stop @click=${()=>void this.stop()}>${this.busy?i("stopping"):i("stop")}</sw-button>
          <sw-button variant="ghost" @click=${()=>void this.close()}>${i("close")}</sw-button>`:this.phase==="setup"||this.phase==="failed"?r`<sw-button variant="primary" icon="search" ?disabled=${this.busy||!S(this.range,this.max).ok} data-discovery-start @click=${()=>void this.start()}>${i("start")}</sw-button>
          <sw-button variant="ghost" @click=${()=>void this.close()}>${i("close")}</sw-button>`:r`<sw-button variant="ghost" @click=${()=>void this.close()}>${i("close")}</sw-button>`;if(this.step==="identify"){const s=me(this.devices,this.selected);return r`<span class="foot-line hide-phone" data-discovery-summary>${s.ok||s.bad?i("summaryIdentify",s):i("pickHint")}</span>
        <sw-button variant="primary" icon="check" ?disabled=${!s.ok||this.pressing.size>0} data-discovery-next @click=${()=>this.toAdd()}>${s.ok?i("next",{n:s.ok}):i("nextNone")}</sw-button>
        <sw-button variant="ghost" icon="refresh" data-discovery-again @click=${()=>void this.again()}>${i("otherRange")}</sw-button>`}if(this.result)return r`<sw-button variant="primary" icon="check" data-discovery-finish @click=${()=>void this.close()}>${i("finish")}</sw-button>`;const e=this.addList.length,t=_(z(),{ready:!0,testing:!1}).canAdd;return r`<sw-button variant="primary" icon="plus" ?disabled=${this.busy||!e||!t} data-discovery-add @click=${()=>void this.add()}>${this.busy?i("adding"):i("addN",{n:e})}</sw-button>
      <sw-button variant="ghost" data-discovery-back @click=${()=>{this.step="identify",this.page=1,this.msg=null}}>${i("back")}</sw-button>`}render(){if(!this.open)return l;const e=this.step==="scan"?0:this.step==="identify"?1:2,t=this.step==="scan"?this.phase==="running"?this.renderRunning():this.phase==="none"?this.renderNone():this.renderSetup():this.step==="identify"?this.renderIdentify():this.renderAdd(),s=this.recorderFor;return r`<sw-dialog open xl heading=${i("title")} subheading=${this.step==="scan"||!this.phone?i("sub"):""} data-camera-discovery=${this.step} data-phase=${this.phase}
        @close=${a=>{a.stopPropagation(),this.close()}}>
        <div class="body">
          <sw-steps .steps=${[i("stepScan"),i("stepIdentify"),i("stepAdd")]} .current=${e}></sw-steps>
          ${t}
          ${this.msg?r`<p class=${`msg tone-${this.msg.tone}`} role=${this.msg.tone==="bad"?"alert":"status"} data-discovery-msg>${this.msg.text}</p>`:l}
        </div>
        <div slot="footer" class="foot">${this.footer()}</div>
      </sw-dialog>
      ${s?.recorder_prefill?r`<sw-dialog open wide heading=${i("addRecorderTitle")} data-discovery-recorder-dialog
            @close=${a=>{a.stopPropagation(),this.recorderFor=null}}>
            ${this.recorderReady?r`<nvr-connection-form context="add" .prefill=${s.recorder_prefill}
                  @nvr-recorder-added=${()=>{this.recorderFor=null,this.msg={tone:"ok",text:i("recorderAdded")}}}></nvr-connection-form>`:r`<span class="spin" aria-hidden="true"></span>`}
          </sw-dialog>`:l}`}};p.styles=X`
    :host {
      display: contents;
    }
    .body {
      display: grid;
      gap: 12px;
      min-inline-size: 0;
    }
    sw-steps {
      justify-content: center;
    }
    .lead,
    .note,
    .help {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .help {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .ip {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      unicode-bidi: isolate;
      color: var(--sw-text-2);
    }
    input[dir='ltr'] {
      text-align: left;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
    }
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px 16px;
      align-items: start;
    }
    .panel {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 12px 14px;
      display: grid;
      gap: 8px;
      background: var(--sw-surface);
    }
    .panel h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .facts .row {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: space-between;
      min-block-size: 32px;
      font-size: var(--sw-fs-sm);
    }
    .facts .row small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .chip[data-tone='ok'] {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .chip[data-tone='warn'] {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .chip[data-tone='bad'] {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .chip[data-tone='accent'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .tone-bad {
      color: var(--sw-danger-text);
    }
    .tone-ok {
      color: var(--sw-success-text);
    }
    .tone-warn {
      color: var(--sw-warning-text);
    }
    .prog {
      block-size: 8px;
      border-radius: 8px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .prog i {
      display: block;
      block-size: 100%;
      border-radius: 8px;
      background: var(--sw-accent);
    }
    @media (prefers-reduced-motion: no-preference) {
      .prog i {
        transition: inline-size 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      }
    }
    .stats {
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .list {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .list-head {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
    }
    .list-head h4 {
      margin: 0;
      flex: 1;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .dev {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1.2fr) minmax(0, 1.3fr) auto;
      gap: 10px;
      align-items: center;
      padding: 9px 12px;
      border-block-start: 1px solid var(--sw-border);
      min-block-size: 44px;
    }
    .dev:first-child {
      border-block-start: 0;
    }
    .dev.dim .t {
      color: var(--sw-text-2); /* not a fade: the address under it keeps its contrast */
      font-weight: var(--sw-fw-medium, 500);
    }
    .dev input[type='checkbox'] {
      inline-size: 18px;
      block-size: 18px;
      margin: 0;
      accent-color: var(--sw-accent);
    }
    .dev sw-icon {
      --sw-icon-size: 18px;
      color: var(--sw-text-3);
    }
    .who {
      min-inline-size: 0;
    }
    .t {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-base);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .d {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .st {
      display: grid;
      gap: 3px;
      justify-items: start;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    .end {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
    }
    .pw {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .pw input {
      inline-size: 160px;
      min-block-size: var(--sw-ctl-h-md, 36px);
      box-sizing: border-box;
      border: 1px solid var(--sw-border-strong, var(--sw-border));
      border-radius: var(--sw-r-sm);
      padding: 0 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
    }
    .spin {
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      border: 2px solid var(--sw-accent-soft);
      border-block-start-color: var(--sw-accent);
      display: inline-block;
    }
    @media (prefers-reduced-motion: no-preference) {
      .spin {
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    }
    .cred {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 10px;
      align-items: end;
    }
    .cred .check {
      grid-column: 1 / -1;
    }
    .check {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: var(--sw-fs-sm);
      min-block-size: 32px;
      cursor: pointer;
    }
    .check input {
      inline-size: 18px;
      block-size: 18px;
      margin: 0;
      accent-color: var(--sw-accent);
    }
    .foot-line {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: space-between;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .empty {
      display: grid;
      justify-items: center;
      text-align: center;
      gap: 10px;
      padding: 16px 8px;
    }
    .empty h4 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      color: var(--sw-heading);
    }
    .empty ul {
      margin: 0;
      padding-inline-start: 18px;
      text-align: start;
      display: grid;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      max-inline-size: 520px;
    }
    .btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .addrow {
      display: grid;
      grid-template-columns: 132px minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.6fr);
      gap: 12px;
      align-items: start;
      padding: 10px 12px;
      border-block-start: 1px solid var(--sw-border);
    }
    .addrow:first-child {
      border-block-start: 0;
    }
    .streams {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 8px;
    }
    .thumb {
      inline-size: 132px;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      overflow: hidden;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      text-align: center;
    }
    .thumb img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .thumb sw-button {
      --sw-icon-size: 16px;
    }
    .result {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 12px 14px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border);
    }
    .result sw-icon {
      --sw-icon-size: 22px;
    }
    .result .t {
      white-space: normal;
      font-size: var(--sw-fs-md);
    }
    .resrow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 10px;
      align-items: center;
      padding: 8px 12px;
      border-block-start: 1px solid var(--sw-border);
    }
    .resrow:first-child {
      border-block-start: 0;
    }
    .resrow .why {
      grid-column: 1 / -1;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .msg {
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .foot {
      flex: 1;
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .foot .foot-line {
      flex: 1 1 14em;
    }
    @media (max-width: 767px) {
      .hide-phone {
        display: none;
      }
      .cols,
      .cred {
        grid-template-columns: 1fr 1fr;
      }
      .cred .check {
        grid-column: auto;
        order: 3;
      }
      .cred sw-button {
        order: 4;
      }
      .cols {
        grid-template-columns: 1fr;
      }
      .dev {
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 4px 10px;
        padding: 8px 10px;
      }
      .dev > sw-icon {
        display: none;
      }
      .dev > .st {
        justify-items: end;
      }
      .dev > .st > span:not(.chip) {
        display: none; /* the phone keeps one line per device: the chip says it, the longer note is the desktop's */
      }
      .dev > .end {
        grid-column: 2 / -1;
        justify-self: start;
      }
      .dev > .end {
        inline-size: 100%;
        justify-content: flex-start;
      }
      .pw {
        flex: 1;
      }
      .pw input {
        flex: 1;
        inline-size: auto;
        min-inline-size: 0;
      }
      .addrow {
        grid-template-columns: 112px minmax(0, 1fr);
        gap: 8px 10px;
        padding: 8px 10px;
      }
      .addrow .thumb {
        inline-size: 112px;
      }
      .addrow .wide {
        grid-column: 1 / -1;
      }
      .streams {
        grid-template-columns: 1fr; /* a full-width select keeps the whole "2688×1520 · H.265" label */
      }
      .list-head {
        padding: 6px 10px;
      }
    }
  `;h([B({type:Boolean,reflect:!0})],p.prototype,"open",2);h([B({attribute:!1})],p.prototype,"caps",2);h([u()],p.prototype,"step",2);h([u()],p.prototype,"phase",2);h([u()],p.prototype,"range",2);h([u()],p.prototype,"job",2);h([u()],p.prototype,"devices",2);h([u()],p.prototype,"selected",2);h([u()],p.prototype,"user",2);h([u()],p.prototype,"password",2);h([u()],p.prototype,"sameForAll",2);h([u()],p.prototype,"rowPw",2);h([u()],p.prototype,"pressing",2);h([u()],p.prototype,"page",2);h([u()],p.prototype,"drafts",2);h([u()],p.prototype,"previews",2);h([u()],p.prototype,"areas",2);h([u()],p.prototype,"busy",2);h([u()],p.prototype,"result",2);h([u()],p.prototype,"msg",2);h([u()],p.prototype,"recorderFor",2);h([u()],p.prototype,"recorderReady",2);p=h([J("camera-discovery-dialog")],p);export{p as CameraDiscoveryDialog};
