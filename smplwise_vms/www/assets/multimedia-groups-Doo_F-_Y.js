import{a as V,kC as A,fT as Y,fq as F,cU as W,bI as L,K as C,aS as J,cA as X,eq as E,kp as Q,er as Z,R as H,ak as q,V as G,kD as ee,kE as te,gT as se,aR as S,kF as I,kB as ae,et as O,gI as ie,kG as re,kH as oe,p as l,gJ as B,q as r,gH as ne,X as $,ey as P,dH as le,fS as de,i as ce,n as pe,r as m,e as U,x as he}from"./index-C5kZ9jiu.js";import{r as M,p as N}from"./media-group-dialog-CWC3lVHH.js";import{d as D}from"./media-preset-editor-BCVbs9k4.js";import"./sw-pager-2h-bsNFx.js";import{P as me}from"./multimedia-page-fit-aNuqF9pe.js";import{a as ue}from"./media-page-BF4b5gDG.js";import{g as ge,m as c,n as k}from"./media-now-DDqP14hw.js";import{s as ve,k as fe,l as be,m as we,n as ye,o as j}from"./multimedia-players-layout-DvFtMxgs.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-BLWZG4KN.js";var xe=Object.defineProperty,$e=Object.getOwnPropertyDescriptor,h=(e,t,a,i)=>{for(var s=i>1?void 0:i?$e(t,a):t,o=e.length-1,n;o>=0;o--)(n=e[o])&&(s=(i?n(t,a,s):n(s))||s);return i&&s&&xe(t,a,s),s};const K="/multimedia/groups",ke=e=>e,T=(e,t,a)=>e===1?t:`${e} ${a}`;let p=class extends V{constructor(){super(...arguments),this.playerKey="",this.phase="loading",this.devices=[],this.groups=[],this.presets=[],this.status=null,this.staleError="",this.toast="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.editing=!1,this.byRoom="",this.runs=new Map,this.notes=new Map,this.deleting=null,this.busy=!1,this.actionError="",this.local=new Map,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.fit=new me(this,()=>this.renderRoot.querySelector(".scr"),()=>!this.editing),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offEdit=null,this.offPush=null,this.refreshTimer=0,this.pollTimer=0,this.toastTimer=0,this.sliderTimers=new Map,this.wantsEdit=!1,this.editHandled=!1,this.loading=!1,this.stopped=!1,this.askParty=e=>new Promise(t=>{const a=this.dialog;if(!a)return t(!1);a.confirm({heading:`לשלוט ב־${e.devices} חדרים יחד?`,sub:e.floors>1?`הקבוצה משמיעה ב־${e.floors} קומות.`:void 0,names:A(e),ok:"בצע",run:async()=>t(!0),cancel:()=>t(!1)})})}connectedCallback(){super.connectedCallback(),Y(this),this.stopped=!1,this.phoneMq.addEventListener("change",this.onPhone),this.offEdit=F({id:"multimedia-groups-edit",label:"עריכת הקבוצות השמורות",icon:"edit",can:()=>this.canEdit&&!this.editing,run:()=>this.enterEdit()}),this.offRoute=W(e=>{e.mode!=="multimedia"||e.segments[1]!=="groups"||(this.wantsEdit=e.params.get("edit")==="1",this.wantsEdit||(this.editHandled=!1,this.editing=!1),this.requestUpdate())}),this.wantsEdit=L().params.get("edit")==="1",this.load(),C()&&(this.offPush=J(e=>{e.type==="media_state"?this.devices=this.devices.map(t=>t.key===e.device_key?{...t,live:ke(e.live)}:t):(e.type==="media_devices_changed"||e.type==="media_groups_changed")&&this.scheduleRefresh(200)},e=>{e&&this.scheduleRefresh(200)})),this.pollTimer=window.setInterval(()=>void this.load(),3e4)}disconnectedCallback(){super.disconnectedCallback(),this.stopped=!0,this.phoneMq.removeEventListener("change",this.onPhone),this.offEdit?.(),this.offRoute?.(),this.offPush?.(),this.offEdit=this.offRoute=this.offPush=null;for(const e of[this.refreshTimer,this.toastTimer,...this.sliderTimers.values()])window.clearTimeout(e);window.clearInterval(this.pollTimer)}updated(){this.wantsEdit&&!this.editHandled&&this.phase==="ready"&&(this.editHandled=!0,this.canEdit?this.enterEdit(!0):this.dropParam("edit"))}get canEdit(){return this.phase==="ready"&&!!this.status?.can.layout&&!X("layout_editor")}get canGroup(){return!!this.status?.can.group}get canControl(){return!!this.status?.can.control}async load(){if(!this.loading){this.loading=!0;try{const e=await E().status();if(this.status=e,Q(e.counts),!e.enabled){this.phase="disabled";return}if(!e.can.read){this.phase="forbidden";return}const[t,a,i]=await Promise.all([E().list({kind:Z}),E().groups(),E().presets()]);this.devices=t.devices,this.groups=a,this.presets=i,this.local=new Map,this.phase="ready",this.staleError="";for(const s of i)s.running&&!this.runs.has(s.id)&&this.followPreset(s.id,s.running.bulk_id)}catch(e){e instanceof H&&e.status===403?this.phase="forbidden":e instanceof H&&e.code==="feature_disabled"?this.phase="disabled":this.phase==="ready"?this.staleError=q(e):(this.phase="error",this.staleError=q(e))}finally{this.loading=!1}}}scheduleRefresh(e){window.clearTimeout(this.refreshTimer),this.refreshTimer=window.setTimeout(()=>void this.load(),e)}say(e){this.toast=e,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",3200)}dropParam(e){const t=new URLSearchParams(L().params);t.delete(e),G(K,t)}enterEdit(e=!1){if(!(!this.canEdit||this.editing)){if(this.editing=!0,this.editHandled=!0,!e){const t=new URLSearchParams(L().params);t.set("edit","1"),G(K,t)}this.scrollTo({top:0})}}leaveEdit(){this.editing=!1,this.editHandled=!1,this.dropParam("edit")}dev(e){return this.devices.find(t=>t.key===e)}async record(e){const t=Date.now()+6e3;let a=null;for(;Date.now()<t&&!this.stopped;){try{if(a=await E().groupRecord(e),a.status==="done")return a}catch{return a}await new Promise(i=>setTimeout(i,500))}return a}setRun(e,t){const a=new Map(this.runs);t?a.set(e,t):a.delete(e),this.runs=a}async followPreset(e,t){this.setRun(e,{pending:!0,failed:[],ok:!1,at:Date.now()});const a=await this.record(t);this.finishRun(e,a)}finishRun(e,t){const a=ve(t),i=new Map((t?.members??[]).map(s=>[s.device_key,s]));this.setRun(e,{pending:!1,ok:a.failed.length===0,at:Date.now(),failed:a.failed.map(s=>({key:s.key,room:s.room,text:ee(s.room,i.get(s.key)?.outcome??s.outcome)}))}),this.scheduleRefresh(150)}async apply(e,t=!1){if(!this.runs.get(e.id)?.pending){this.actionError="",this.setRun(e.id,{pending:!0,failed:[],ok:!1,at:Date.now()});try{const a=await te(e.id,t),i=await this.record(a.bulk_id);this.finishRun(e.id,i)}catch(a){this.setRun(e.id,null);const i=se(a);if(i){const s=i.floors;this.dialog?.confirm({heading:`לצרף ${i.devices} חדרים לקבוצה אחת?`,sub:s>1?`הקבוצה תשמיע ב־${s} קומות.`:void 0,names:A(i),ok:"צרף",run:async()=>{await this.apply(e,!0)}})}else this.say(S(a))}}}async ungroup(e){try{const t=await I([e.leader_key]);await this.record(t.bulk_id),this.scheduleRefresh(100)}catch(t){this.say(S(t))}}async leaveRoom(e){try{const t=await I([e]);await this.record(t.bulk_id),this.scheduleRefresh(100)}catch(t){this.say(S(t))}}async togglePlay(e){const t=await M(e,{command:"transport",action:"play_pause"},void 0,this.askParty);(t.outcome==="refused"||t.outcome==="not_confirmed")&&t.message&&this.say(t.message),this.scheduleRefresh(C()?600:30)}helperLeaders(e){const t=new Map;for(const a of e.members){const i=this.dev(a.key);if(i&&i.can.control&&i.live.caps_known&&i.live.power==="on"){const s=ae(i,this.devices);t.set(s.key,s)}}return[...t.values()]}async toggleHelper(e){const t=this.helperLeaders(e),a=t.filter(O),i=a.length?a:t.filter(n=>n.live.play==="paused"),s=a.length?"pause":"play";let o="";for(const n of i){const g=await M(n.key,{command:"transport",action:s});!o&&(g.outcome==="refused"||g.outcome==="not_confirmed")&&(o=g.message)}o&&this.say(o),this.scheduleRefresh(C()?600:30)}async mute(e,t){const a=this.dev(e),i=t&&a?ie(a):null;i!==null&&await M(e,{command:"volume_set",level:i});const s=await M(e,{command:"mute",muted:!t});(s.outcome==="refused"||s.outcome==="not_confirmed")&&this.say(s.message),this.scheduleRefresh(C()?600:30)}slide(e,t,a){const i=new Map(this.local);i.set(e,t),this.local=i,window.clearTimeout(this.sliderTimers.get(e)),this.sliderTimers.set(e,window.setTimeout(()=>void a(),350))}groupSlide(e,t){this.slide(`g:${e.leader_key}`,t,async()=>{try{const a=await re(e.leader_key,t,"relative"),i=await this.record(a.bulk_id),s=new Map;for(const n of i?.members??[])n.outcome==="clamped"?s.set(n.device_key,{text:"הוגבל לתקרה",bad:!1}):n.outcome==="skipped_muted"?s.set(n.device_key,{text:"מושתק",bad:!1}):n.outcome==="skipped_unavailable"||n.outcome==="skipped_off"?s.set(n.device_key,{text:n.outcome==="skipped_off"?"כבוי":"לא זמין",bad:!1}):(n.outcome==="not_allowed"||n.outcome==="unknown")&&s.set(n.device_key,{text:n.outcome==="not_allowed"?"אין הרשאה":"לא ידוע",bad:!0});const o=new Map(this.notes);o.set(e.leader_key,s),this.notes=o}catch(a){oe(a)!=="rate_limited"&&this.say(S(a))}this.scheduleRefresh(100)})}roomSlide(e,t){this.slide(`m:${e}`,t,async()=>{const a=await M(e,{command:"volume_set",level:t});(a.outcome==="refused"||a.outcome==="not_confirmed")&&this.say(a.message),this.scheduleRefresh(100)})}async deletePreset(){const e=this.deleting;if(!(!e||this.busy)){this.busy=!0,this.actionError="";try{await E().deletePreset(e.id,e.revision),this.deleting=null,this.say("נמחק"),await this.load()}catch(t){this.actionError=S(t)}finally{this.busy=!1}}}rangeStyle(e){return`--v:${e}%`}thumb(e){if(!e)return l;const t=N(e);return t.playing||t.paused?r`<div class="thumb" style=${`--art:${t.rgb}`}><div class="art" style=${`--a1:${t.a1};--a2:${t.a2}`}>${ge(t.glyph,void 0,"gl")}${t.artwork?r`<img src=${B(t.artwork)} alt="" loading="lazy" />`:l}</div></div>`:l}memberRow(e,t,a){const i=this.dev(t.key),s=t.key===e.leader_key&&!e.static,o=this.notes.get(e.leader_key)?.get(t.key),n=this.local.get(`m:${t.key}`)??t.volume??0,g=this.canControl&&!!i?.can.control&&!!i?.caps.volume_set&&t.available,w=i?fe(ne(i)):null,u=o?r`<small class=${o.bad?"bad":"ok"}>${o.text}</small>`:r`<small>${s?r`${$(t.area_name??"")}${t.area_name?" · ":""}מוביל`:$(t.area_name??"")}</small>`,b=a.leave&&!s&&this.canGroup?r`<button type="button" class="rb" data-leave=${t.key} aria-label=${`נתק · ${t.name}`} title="נתק" @click=${()=>void this.leaveRoom(t.key)}>${c("unlink")}</button>`:r`<button type="button" class=${P({rb:!0,muted:!!t.muted})} aria-pressed=${String(!!t.muted)} aria-label=${`${t.muted?"בטל השתקה":"השתק"} · ${t.name}`} ?disabled=${!g} @click=${()=>void this.mute(t.key,!!t.muted)}>${c(t.muted?"volOff":"vol")}</button>`;return r`<div class=${P({mrow:!0,lead:s,dim:!t.available})} data-member=${t.key}>
      <div class="nm"><b>${k($(t.name))}</b>${u}</div>
      <span class="rngwrap">${w!==null?r`<span class="cap" style=${`--cap:${w}%`}></span>`:l}<input class="rng sm" type="range" min="0" max="100" .value=${String(n)} style=${this.rangeStyle(n)} aria-label=${`עוצמה · ${t.name}`} ?disabled=${!g} @input=${y=>this.roomSlide(t.key,Number(y.target.value))} /></span>
      <span class="vv"><span class="n">${g||t.volume!==null?n:"—"}</span></span>${b}
    </div>`}groupVolume(e){if(!this.canControl||!e.can.volume)return l;const t=this.local.get(`g:${e.leader_key}`)??e.volume??0;return r`<div class="vrow"><span class="lbl">קבוצה</span><input class="rng" type="range" min="0" max="100" .value=${String(t)} style=${this.rangeStyle(t)} data-group-volume=${e.leader_key} aria-label="עוצמת הקבוצה" @input=${a=>this.groupSlide(e,Number(a.target.value))} /><span class="vv"><span class="n">${t}</span></span></div>`}groupCard(e,t,a=!1){const i=this.dev(e.leader_key),s=i?N(i):null,o=!!s?.rgb&&(s.playing||s.paused),n=e.members.map(x=>x.area_name||x.name),g=!i||t==="helper"?"":s?.playing?" · מנגן":s?.paused?" · מושהה":" · לא מנגן",w=t==="helper"?`קבוצה וירטואלית · ${T(e.members.length,"חדר אחד","חדרים")}`:`${T(e.members.length,"חדר אחד","חדרים")}${e.floor_ids.length>1?` · ${e.floor_ids.length} קומות`:""}${g}`,u=t==="live"?n.join(" + "):e.name,b=t==="helper"&&this.canControl?this.helperLeaders(e):[],y=b.some(O),v=b.length&&(y||b.some(x=>x.live.play==="paused"))?r`<button type="button" class="rb" data-helper-toggle=${e.leader_key} aria-label=${`${y?"השהה":"המשך"} · ${e.name}`} @click=${()=>void this.toggleHelper(e)}>${c(y?"pause":"play")}</button>`:l,z=i&&(s?.playing||s?.paused)&&s?r`<div class="gnp">${this.thumb(i)}<div class="t"><b>${k(s.title||i.live.now.title||"")}</b><small>${k(s.sub)}</small></div>${this.canControl&&i.can.control?r`<button type="button" class="pk" aria-label=${`${s.playing?"השהה":"המשך"} · ${u}`} @click=${()=>void this.togglePlay(e.leader_key)}>${c(s.playing?"pause":"play")}</button>`:l}</div>`:l,_=!this.phone||this.byRoom===e.leader_key,R=this.phone?r`<button type="button" class="lnk" data-by-room=${e.leader_key} aria-expanded=${String(this.byRoom===e.leader_key)} @click=${()=>this.byRoom=this.byRoom===e.leader_key?"":e.leader_key}>לפי חדר${c("chevronDown")}</button>`:l;return r`<article data-fit-item ?data-off=${a} class=${P({gcard:!0,glass:!0,lit:o})} style=${o?`--art:${s.rgb}`:""} aria-label=${`קבוצה · ${u}`} data-group-card=${e.leader_key} data-group-type=${t}>
      <span class="gbox" aria-hidden="true">${o&&s?r`<div class="art" style=${`--a1:${s.a1};--a2:${s.a2}`}>${s.artwork?r`<img src=${B(s.artwork)} alt="" />`:l}</div>`:l}</span>
      <header class="gh"><span class="gi">${c("group")}</span><div class="tx"><b>${k($(u))}</b><small>${w}</small></div>
        ${v}${t==="live"&&this.canGroup?r`<button type="button" class="btn sm quiet" data-ungroup=${e.leader_key} @click=${()=>void this.ungroup(e)}>${c("unlink")}פרק</button>`:l}</header>
      ${z}${this.groupVolume(e)}
      <div class="psh"><h4>לפי חדר</h4>${R}</div>
      ${_?r`<div class="members">${e.members.map(x=>this.memberRow(e,x,{leave:t==="live"}))}</div>`:l}
    </article>`}presetCard(e,t=!1){const a=be(e,this.devices),i=we(e,this.devices),s=this.runs.get(e.id),o=ye(e,this.devices),n=new Set((s&&!s.pending?s.failed:[]).map(v=>v.key)),g=a[0],w=a.map(v=>{const z=n.has(v.key)||v.missing,_=!!s&&!s.pending&&s.ok&&!v.missing,R=e.volumes?.[v.key];return r`<span class=${P({chipx:!0,bad:z,ok:_})}>${c(z?"warning":_?"check":"speaker")}${k($(v.room))}${R!==void 0?r` <span class="n">${R}</span>`:l}</span>`});let u;s?.pending?u=r`<span class="st" data-preset-state="running">${c("group")}מצרף…</span>`:s&&s.failed.length?u=r`<span class="st bad" data-preset-state="partial">${c("warning")}${s.failed.map(v=>v.text).join(", ")}</span>`:o?u=r`<span class="st ok" data-preset-state="live">${c("check")}פועל</span>`:e.missing.length?u=r`<span class="st bad" data-preset-state="missing">${c("warning")}${T(e.missing.length,"חדר אחד לא מוגדר","חדרים לא מוגדרים")}</span>`:u=r`<span class="st" data-preset-state="idle">${T(a.length,"חדר אחד","חדרים")}${i>1?` · ${i} קומות`:""}${e.volumes?" · עם עוצמות":""}</span>`;const b=this.canGroup?r`<button type="button" class=${P({btn:!0,primary:!o,quiet:o,pend:!!s?.pending})} data-apply=${e.id} ?disabled=${o||!!s?.pending||e.missing.length>0} @click=${()=>void this.apply(e)}>${c("play")}הפעל</button>`:l,y=this.editing?r`<span class="ecard"><button type="button" data-preset-edit=${e.id} aria-label=${`ערוך · ${e.name}`} @click=${()=>this.editor?.show(D(e))}>${c("edit")}</button><button type="button" data-preset-delete=${e.id} aria-label=${`מחק · ${e.name}`} @click=${()=>{this.actionError="",this.deleting=e}}>${c("trash")}</button></span>`:l;return r`<article data-fit-item ?data-off=${t} class=${P({gcard:!0,glass:!0,editing:this.editing})} aria-label=${`קבוצה שמורה · ${e.name}`} data-preset=${e.id}>${y}
      <header class="gh"><span class="gi src">${c("star")}</span><div class="tx"><b>${k($(e.name))}</b><small>${g?r`מוביל: ${k($(g.room))}`:l}</small></div></header>
      <div class="roomchips">${w}</div>
      <div class="gfoot">${u}<span class="grow"></span>${b}</div>
    </article>`}summary(){if(this.phase!=="ready"||this.editing)return"";const{live:e}=j(this.groups,this.devices),t=this.presets.length;return[e.length?e.length===1?"קבוצה אחת פועלת":`${e.length} קבוצות פועלות`:"",t?`${t} שמורות`:""].filter(Boolean).join(" · ")}pagerAction(){return this.fit.pages>1?r`<sw-pager slot="actions" data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${e=>this.fit.go(e.detail.page)}></sw-pager>`:l}skeleton(){const e=r`<div class="glass gcard" style="padding:16px 18px"><div style="display:flex;gap:12px;align-items:center"><span class="skl" style="inline-size:44px;block-size:44px;border-radius:var(--sw-r-lg)"></span><div style="flex:1;display:flex;flex-direction:column;gap:8px"><span class="skl" style="block-size:16px;inline-size:55%"></span><span class="skl" style="block-size:12px;inline-size:35%"></span></div></div><span class="skl" style="block-size:44px;border-radius:var(--sw-r-pill)"></span><span class="skl" style="block-size:36px;border-radius:var(--sw-r-md)"></span></div>`;return r`<div data-mm-state="loading" aria-busy="true"><div class="ggrid">${Array.from({length:this.phone?2:3},()=>e)}</div></div>`}stateBox(e,t,a,i=!1){return r`<div class="statebox glass" role="status" style=${i?"padding:36px 24px":""}><span class="ring">${c(e)}</span><b>${t}</b>${a??l}</div>`}editBar(){return r`<div class="editbar" data-mm-editbar><span class="t">${c("edit")}עריכת הקבוצות השמורות</span><span class="grow"></span>
      <button type="button" class="btn sm quiet" data-preset-new @click=${()=>this.editor?.show(D(null))}>${c("plus")}קבוצה חדשה</button>
      <button type="button" class="btn sm primary" data-mm-done @click=${()=>this.leaveEdit()}>${c("check")}סיום</button></div>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return r`<div data-mm-state="error">${this.stateBox("warning","לא ניתן לטעון את הקבוצות",r`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${c("refresh")}נסה שוב</button>`)}</div>`;if(this.phase==="forbidden")return r`<div data-mm-state="forbidden">${this.stateBox("group","אין הרשאת צפייה בקבוצות")}</div>`;if(this.phase==="disabled")return r`<div data-mm-state="disabled">${this.stateBox("power","המולטימדיה כבויה")}</div>`;const{live:e,static:t,helpers:a}=j(this.groups,this.devices),i=this.staleError?r`<div class="errbar" role="alert" data-mm-stale>${c("warning")}הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.<button type="button" class="btn sm" @click=${()=>void this.load()}>נסה שוב</button></div>`:l,s=this.canEdit&&!this.editing?r`<button type="button" class="btn sm quiet" data-preset-new @click=${()=>this.editor?.show(D(null))}>${c("plus")}קבוצה חדשה</button>`:l,o=[...t.map(d=>({g:d,t:"static"})),...a.map(d=>({g:d,t:"helper"}))];this.fit.sync(e.length+o.length+this.presets.length,`${e.map(d=>d.leader_key).join(",")}|${o.map(d=>d.g.leader_key).join(",")}|${this.presets.map(d=>d.id).join(",")}|${this.phone}`);const n=this.fit.page===1,g=this.fit.page===this.fit.pages,w=d=>!this.fit.shows(d),u=d=>!this.fit.shows(e.length+d),b=d=>!this.fit.shows(e.length+o.length+d),y=e.length?e.every((d,f)=>w(f)):!n,v=o.every((d,f)=>u(f)),z=this.presets.length?this.presets.every((d,f)=>b(f)):!g,_=r`<section class="fsec" ?data-off=${y} data-section="live"><header class="sh"><div><h2>פועלות עכשיו</h2>${e.length?r`<small>${T(e.length,"קבוצה אחת","קבוצות")}</small>`:l}</div></header>
      ${e.length?r`<div class="ggrid">${e.map((d,f)=>this.groupCard(d,"live",w(f)))}</div>`:this.stateBox("group","אין קבוצה פעילה",void 0,!0)}</section>`,R=o.length?r`<section class="fsec" ?data-off=${v} data-section="static"><header class="sh"><div><h2>קבוצות קבועות</h2><small>${T(o.length,"קבוצה אחת","קבוצות")}</small></div></header><div class="ggrid">${o.map((d,f)=>this.groupCard(d.g,d.t,u(f)))}</div></section>`:l,x=r`<section class="fsec" ?data-off=${z} data-section="saved"><header class="sh"><div><h2>קבוצות שמורות</h2><small><span class="n">${this.presets.length}</span> שמורות</small></div><span class="grow"></span>${s}</header>
      ${this.presets.length?r`<div class="ggrid">${this.presets.map((d,f)=>this.presetCard(d,b(f)))}</div>`:this.stateBox("group","אין קבוצות שמורות",void 0,!0)}</section>`;return r`${i}${this.editing?this.editBar():l}<div class="groups" data-mm-state="ready">${_}${R}${x}</div>`}deleteDialog(){const e=this.deleting;return e?r`<sw-dialog open ?locked=${this.busy} heading=${`למחוק את "${e.name}"?`} data-preset-delete-dialog="open" @close=${()=>this.deleting=null}>
      ${this.actionError?r`<div style="color:var(--sw-danger);font-size:var(--sw-fs-sm)" role="alert">${this.actionError}</div>`:l}
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-pd-no autofocus ?disabled=${this.busy} @click=${()=>this.deleting=null}>ביטול</sw-button>
        <sw-button variant="danger" data-pd-yes ?disabled=${this.busy} @click=${()=>void this.deletePreset()}>מחק</sw-button>
      </div></sw-dialog>`:r`<sw-dialog data-preset-delete-dialog="closed"></sw-dialog>`}willUpdate(){this.toggleAttribute("data-fit",this.fit.on)}render(){const e=this.body();return r`<sw-page class="page" wide heading="קבוצות" subheading=${this.summary()} data-screen="multimedia-groups">${this.pagerAction()}${this.editing?e:r`<div class="scr" data-mm-region>${e}</div>`}</sw-page>
    <media-group-dialog @group-done=${()=>void this.load()}></media-group-dialog>
    <media-preset-editor .devices=${this.devices} @preset-saved=${()=>{this.say("נשמר"),this.load()}} @preset-stale=${()=>void this.load()}></media-preset-editor>
    ${this.deleteDialog()}
    ${this.toast?r`<div class="toast" role="status" ${le()}>${c("check")}${this.toast}</div>`:l}`}};p.styles=[de,ue,ce`
    .ggrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: var(--dv-gap-lg);
      align-items: start;
    }
    .gcard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 16px 18px;
      min-inline-size: 0;
      transition: box-shadow var(--mm-motion) var(--mm-ease), transform var(--mm-motion) var(--mm-ease), border-color var(--mm-motion);
    }
    .gcard.lit {
      border-color: color-mix(in srgb, rgb(var(--art)) 34%, transparent);
      box-shadow: 0 22px 56px rgb(var(--art) / var(--mm-art-halo-alpha)), var(--dv-shadow-1);
    }
    .gcard > :not(.gbox):not(.ecard) {
      position: relative;
      z-index: 1;
    }
    .gbox {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      overflow: hidden;
      z-index: 0;
      pointer-events: none;
    }
    .gbox .art {
      inset: -35%;
      filter: blur(var(--mm-art-glow-blur)) saturate(1.5);
      opacity: var(--mm-art-glow-alpha);
      -webkit-mask-image: linear-gradient(180deg, #000 22%, transparent 88%);
      mask-image: linear-gradient(180deg, #000 22%, transparent 88%);
    }
    .gbox::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--mm-art-veil);
    }
    .gcard.editing {
      outline: 2px dashed color-mix(in srgb, var(--dv-accent) 55%, transparent);
      outline-offset: 4px;
    }
    .gh {
      display: flex;
      align-items: center;
      gap: 12px;
      min-inline-size: 0;
    }
    .gi {
      flex: none;
      inline-size: 44px;
      block-size: 44px;
      border-radius: var(--sw-r-lg);
      display: grid;
      place-items: center;
      color: var(--sw-on-video);
      background: linear-gradient(135deg, color-mix(in srgb, var(--dv-accent) 55%, var(--sw-video-bg)), var(--dv-accent));
      box-shadow: 0 8px 18px color-mix(in srgb, var(--dv-accent) 28%, transparent);
    }
    .gi.src {
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      box-shadow: none;
    }
    .gi .ic {
      font-size: var(--sw-fs-2xl);
    }
    .gh .tx {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
     sourceMappingURL=[^*]**/ R5-MEDIA-ENERGY-297: the group name is the card's title - 20 px / 800 in the heading ink */
    .gh .tx b {
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--dv-text));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gh .tx small {
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gnp {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 10px;
      border-radius: var(--sw-r-lg);
       sourceMappingURL=[^*]**/ R5-MEDIA-ENERGY-297: the now-playing strip is a well inside the glass card (no outlined box inside a card) */
      background: var(--dv-surface-2);
      border: 1px solid transparent;
    }
    .gnp .thumb {
      position: relative;
      inline-size: 52px;
      block-size: 52px;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      color: var(--sw-on-video);
      box-shadow: 0 8px 18px color-mix(in srgb, rgb(var(--art, 20 24 34)) 32%, transparent);
    }
    .gnp .t {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      line-height: 1.3;
    }
    .gnp .t b {
      font-size: var(--sw-fs-md);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gnp .t small {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pk {
      position: relative;
      flex: none;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 50%;
      border: 0;
      display: grid;
      place-items: center;
      background: var(--dv-text);
      color: var(--mm-text-inverse);
      box-shadow: var(--dv-shadow-control);
      transition: transform var(--sw-t-press) var(--mm-ease);
    }
    .pk .ic {
      font-size: var(--sw-fs-2xl);
      stroke-width: 2;
    }
    .pk:active {
      transform: scale(0.92);
    }
    .pk[disabled] {
      opacity: 0.38;
      pointer-events: none;
    }
    .vrow {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 2px;
      min-inline-size: 0;
    }
     sourceMappingURL=[^*]**/ R5-MEDIA-ENERGY-297: the group volume is a display numeral (20 px / 800) */
    .vrow .vv {
      min-inline-size: 36px;
      text-align: end;
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--dv-text));
      font-variant-numeric: tabular-nums;
    }
    .vrow .lbl {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      font-weight: 600;
      flex: none;
      min-inline-size: 52px;
    }
    .rng {
      -webkit-appearance: none;
      appearance: none;
      flex: 1;
      min-inline-size: 0;
      block-size: 44px;
      background: transparent;
      margin: 0;
    }
    .rng::-webkit-slider-runnable-track {
      block-size: 8px;
      border-radius: var(--sw-r-pill);
      background: linear-gradient(to left, var(--dv-accent) var(--v, 50%), var(--dv-surface-3) var(--v, 50%));
    }
    .rng::-moz-range-track {
      block-size: 8px;
      border-radius: var(--sw-r-pill);
      background: var(--dv-surface-3);
    }
    .rng::-moz-range-progress {
      block-size: 8px;
      border-radius: var(--sw-r-pill);
      background: var(--dv-accent);
    }
    .rng::-webkit-slider-thumb {
      -webkit-appearance: none;
      inline-size: 26px;
      block-size: 26px;
      border-radius: 50%;
      background: var(--sw-toggle-thumb);
      margin-block-start: -9px;
      box-shadow: var(--dv-shadow-control);
    }
    .rng::-moz-range-thumb {
      inline-size: 26px;
      block-size: 26px;
      border: 0;
      border-radius: 50%;
      background: var(--sw-toggle-thumb);
      box-shadow: var(--dv-shadow-control);
    }
    .rng[disabled] {
      opacity: 0.4;
    }
    .rng.sm::-webkit-slider-runnable-track {
      block-size: 6px;
    }
    .rng.sm::-webkit-slider-thumb {
      inline-size: 20px;
      block-size: 20px;
      margin-block-start: -7px;
    }
    .rng.sm::-moz-range-thumb {
      inline-size: 20px;
      block-size: 20px;
    }
    .rngwrap {
      position: relative;
      flex: 1;
      min-inline-size: 0;
      display: flex;
      align-items: center;
    }
    .rngwrap .cap {
      position: absolute;
      inset-block: 18px;
      inset-inline-end: calc(var(--cap) - 1px);
      inline-size: 2px;
      border-radius: var(--sw-r-pill);
      background: var(--dv-warning);
      pointer-events: none;
      opacity: 0.9;
    }
    .psh {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .psh h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: 700;
      color: var(--sw-heading, var(--dv-text));
    }
    .lnk {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-block-size: 44px;
      font-size: var(--sw-fs-base);
      font-weight: 600;
      color: var(--dv-accent-text);
    }
    .lnk:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .members {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .mrow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(90px, 150px) 34px auto;
      align-items: center;
      gap: 10px;
      min-block-size: var(--mm-member-row-h);
      padding: 6px 12px;
      border-radius: var(--sw-r-lg);
       sourceMappingURL=[^*]**/ R5-MEDIA-ENERGY-297: a member row is a well (a tone step, no outline); the leading room a filled accent field */
      background: var(--dv-surface-2);
      border: 1px solid transparent;
    }
    .mrow .nm {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      line-height: 1.25;
    }
    .mrow .nm b {
      font-size: var(--sw-fs-md);
      font-weight: 700;
      color: var(--sw-heading, var(--dv-text));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mrow .nm small {
      font-size: var(--sw-fs-xs);
      color: var(--dv-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mrow .nm small.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
    .mrow .nm small.ok {
      color: var(--dv-success);
      font-weight: 600;
    }
    .mrow .vv {
      font-size: var(--sw-fs-lg);
      font-weight: 800;
      text-align: end;
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--dv-text));
    }
    .mrow .rb {
      inline-size: 44px;
      block-size: 44px;
    }
    .mrow .rb .ic {
      font-size: var(--sw-fs-lg);
    }
    .mrow.lead {
      background: var(--dv-accent-soft);
    }
    .mrow.dim {
      opacity: 0.55;
    }
    .roomchips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .roomchips .chipx {
      block-size: 28px;
      padding-inline: 10px;
      font-size: var(--sw-fs-sm);
    }
    .roomchips .chipx .ic {
      color: var(--dv-text-3);
    }
    .roomchips .chipx.bad {
      border-color: color-mix(in srgb, var(--dv-danger) 40%, transparent);
      color: var(--dv-danger);
    }
    .roomchips .chipx.bad .ic {
      color: var(--dv-danger);
    }
    .roomchips .chipx.ok .ic {
      color: var(--dv-success);
    }
    .gfoot {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .gfoot .st {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
    }
    .gfoot .st.ok {
      color: var(--sw-success-text);
      font-weight: 600;
    }
    .gfoot .st.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
    .gfoot .btn.pend .ic {
      animation: mm-spin calc(var(--sw-t-med) * 4) linear infinite;
    }
     sourceMappingURL=[^*]**/ POLISH4-WP5: the edit chips sit at the card's end (the shared place) and the title row keeps clear of them while editing, so
       a long group name ends in an ellipsis before the chips instead of running under them (they covered the icon and the first
       words at the start edge) */
    .gcard > .ecard {
      z-index: 6;
    }
    .gcard.editing .gh {
      padding-inline-end: 84px;
    }
    .qbtn {
      color: var(--dv-text-2);
    }
     sourceMappingURL=[^*]**/ POLISH4-WP5 (emil-design-eng): a link answers the press like the keys do, the slider's thumb lifts while it is held, and hover
       is for a pointer that hovers (a touch never leaves it lit) */
    .lnk {
      transition: transform var(--sw-t-press) var(--mm-ease), color var(--mm-motion);
    }
    .lnk:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    .rng:active:not([disabled])::-webkit-slider-thumb {
      transform: scale(1.12);
    }
    .rng:active:not([disabled])::-moz-range-thumb {
      transform: scale(1.12);
    }
    .rng:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
      border-radius: var(--sw-r-pill);
    }
    @media (hover: hover) and (pointer: fine) {
      .lnk:hover {
        text-decoration: underline;
      }
    }
     sourceMappingURL=[^*]**/ NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30 #5, 960 px at 1366x768). Below 1024 px wide - or
       on a window too short for the header and a row of cards - the region is transparent and the page scrolls as before. From
       1024 x 560 (outside the editor) the page takes the screen's height and the cards region never scrolls: the cards that fit are
       page 1, the rest are on the next pages (the pager in the title row). */
    .scr {
      display: contents;
    }
    @media (min-width: 1024px) and (min-height: 560px) {
      :host([data-fit]) {
        overflow: hidden;
      }
      :host([data-fit]) .page {
        block-size: 100%;
        min-block-size: 0;
        padding-block-end: 0;
      }
      :host([data-fit]) .scr {
        display: block;
        flex: 1 1 auto;
        min-block-size: 0;
        overflow: hidden;
        margin-inline: calc(-1 * var(--mm-pad));
        padding: var(--sw-s-1) var(--mm-pad) var(--sw-s-5);
      }
      :host([data-fit]) .groups {
        gap: var(--sw-s-5);
      }
       sourceMappingURL=[^*]**/ the cards of the other pages (and a section with none on this page) stay in the document, out of the layout */
      :host([data-fit]) [data-off] {
        display: none !important;
      }
       sourceMappingURL=[^*]**/ a group of many rooms keeps one card's height on a page: its room rows (the long part) scroll inside the card, the half row at
         the edge says there is more */
      :host([data-fit]) .gcard .members {
        max-block-size: 160px;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
      }
    }
    @media (min-width: 768px) and (max-width: 1099px) {
      .ggrid {
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
      }
      .mrow {
        grid-template-columns: minmax(0, 1fr) minmax(80px, 120px) 32px auto;
        gap: 8px;
      }
    }
    @media (max-width: 767px) {
      .ggrid {
        grid-template-columns: minmax(0, 1fr);
      }
      .mrow {
        grid-template-columns: minmax(0, 1fr) minmax(70px, 110px) 30px auto;
        padding-inline: 10px;
        gap: 8px;
      }
    }
    @media (pointer: coarse), (max-width: 767px) {
      .gcard.editing .gh {
        padding-inline-end: 112px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .gfoot .btn.pend .ic {
        animation-duration: calc(var(--sw-t-med) * 8);
      }
      .gcard,
      .pk,
      .lnk {
        transition: none;
      }
    }
  `];h([pe()],p.prototype,"playerKey",2);h([m()],p.prototype,"phase",2);h([m()],p.prototype,"devices",2);h([m()],p.prototype,"groups",2);h([m()],p.prototype,"presets",2);h([m()],p.prototype,"status",2);h([m()],p.prototype,"staleError",2);h([m()],p.prototype,"toast",2);h([m()],p.prototype,"phone",2);h([m()],p.prototype,"editing",2);h([m()],p.prototype,"byRoom",2);h([m()],p.prototype,"runs",2);h([m()],p.prototype,"notes",2);h([m()],p.prototype,"deleting",2);h([m()],p.prototype,"busy",2);h([m()],p.prototype,"actionError",2);h([m()],p.prototype,"local",2);h([U("media-group-dialog")],p.prototype,"dialog",2);h([U("media-preset-editor")],p.prototype,"editor",2);p=h([he("multimedia-groups")],p);export{p as MultimediaGroups};
