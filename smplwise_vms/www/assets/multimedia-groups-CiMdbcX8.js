import{a as j,iE as H,hW as K,ey as U,b$ as Y,aB as S,i as T,bt as V,bw as F,dw as $,ir as W,dx as J,j as C,T as L,r as D,iF as Z,iG as Q,ia as X,ic as z,iH as G,iD as ee,dA as I,h_ as se,iI as te,iJ as ae,A as n,h$ as A,e as i,hZ as ie,q as b,dG as w,cM as re,hU as oe,E as ne,F as le,G as m,br as N,H as de}from"./index-JXdHVZ86.js";import{r as _,p as B}from"./media-group-dialog-DJMugo7Z.js";import{d as M}from"./media-preset-editor-G9twsUtS.js";import{m as ce,a as pe}from"./media-page-dh9FtG-o.js";import{g as he,m as l,n as x}from"./media-now-CDQodmzT.js";import{s as me,k as ue,l as ge,m as ve,n as fe,o as q}from"./multimedia-players-layout-CoLKrGiZ.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-CJLDXsMf.js";var be=Object.defineProperty,we=Object.getOwnPropertyDescriptor,p=(e,s,a,t)=>{for(var r=t>1?void 0:t?we(s,a):s,c=e.length-1,o;c>=0;c--)(o=e[c])&&(r=(t?o(s,a,r):o(r))||r);return t&&r&&be(s,a,r),r};const O="/multimedia/groups",xe=e=>e,k=(e,s,a)=>e===1?s:`${e} ${a}`;let d=class extends j{constructor(){super(...arguments),this.playerKey="",this.phase="loading",this.devices=[],this.groups=[],this.presets=[],this.status=null,this.compactHeader=!1,this.staleError="",this.toast="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.editing=!1,this.byRoom="",this.runs=new Map,this.notes=new Map,this.deleting=null,this.busy=!1,this.actionError="",this.local=new Map,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offEdit=null,this.offPush=null,this.refreshTimer=0,this.pollTimer=0,this.toastTimer=0,this.sliderTimers=new Map,this.wantsEdit=!1,this.editHandled=!1,this.loading=!1,this.stopped=!1,this.onScroll=()=>{const e=this.scrollTop;!this.compactHeader&&e>60?this.compactHeader=!0:this.compactHeader&&e<12&&(this.compactHeader=!1)},this.askParty=e=>new Promise(s=>{const a=this.dialog;if(!a)return s(!1);a.confirm({heading:`לשלוט ב־${e.devices} חדרים יחד?`,sub:e.floors>1?`הקבוצה משמיעה ב־${e.floors} קומות.`:void 0,names:H(e),ok:"בצע",run:async()=>s(!0),cancel:()=>s(!1)})})}connectedCallback(){super.connectedCallback(),K(this),this.stopped=!1,this.phoneMq.addEventListener("change",this.onPhone),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offEdit=U({id:"multimedia-groups-edit",label:"עריכת הקבוצות השמורות",icon:"edit",can:()=>this.canEdit&&!this.editing,run:()=>this.enterEdit()}),this.offRoute=Y(e=>{e.mode!=="multimedia"||e.segments[1]!=="groups"||(this.wantsEdit=e.params.get("edit")==="1",this.wantsEdit||(this.editHandled=!1,this.editing=!1),this.requestUpdate())}),this.wantsEdit=S().params.get("edit")==="1",this.load(),T()&&(this.offPush=V(e=>{e.type==="media_state"?this.devices=this.devices.map(s=>s.key===e.device_key?{...s,live:xe(e.live)}:s):(e.type==="media_devices_changed"||e.type==="media_groups_changed")&&this.scheduleRefresh(200)},e=>{e&&this.scheduleRefresh(200)})),this.pollTimer=window.setInterval(()=>void this.load(),3e4)}disconnectedCallback(){super.disconnectedCallback(),this.stopped=!0,this.phoneMq.removeEventListener("change",this.onPhone),this.removeEventListener("scroll",this.onScroll),this.offEdit?.(),this.offRoute?.(),this.offPush?.(),this.offEdit=this.offRoute=this.offPush=null;for(const e of[this.refreshTimer,this.toastTimer,...this.sliderTimers.values()])window.clearTimeout(e);window.clearInterval(this.pollTimer)}updated(){ce(this.renderRoot,this.phone),this.wantsEdit&&!this.editHandled&&this.phase==="ready"&&(this.editHandled=!0,this.canEdit?this.enterEdit(!0):this.dropParam("edit"))}get canEdit(){return this.phase==="ready"&&!!this.status?.can.layout&&!F("layout_editor")}get canGroup(){return!!this.status?.can.group}get canControl(){return!!this.status?.can.control}async load(){if(!this.loading){this.loading=!0;try{const e=await $().status();if(this.status=e,W(e.counts),!e.enabled){this.phase="disabled";return}if(!e.can.read){this.phase="forbidden";return}const[s,a,t]=await Promise.all([$().list({kind:J}),$().groups(),$().presets()]);this.devices=s.devices,this.groups=a,this.presets=t,this.local=new Map,this.phase="ready",this.staleError="";for(const r of t)r.running&&!this.runs.has(r.id)&&this.followPreset(r.id,r.running.bulk_id)}catch(e){e instanceof C&&e.status===403?this.phase="forbidden":e instanceof C&&e.code==="feature_disabled"?this.phase="disabled":this.phase==="ready"?this.staleError=L(e):(this.phase="error",this.staleError=L(e))}finally{this.loading=!1}}}scheduleRefresh(e){window.clearTimeout(this.refreshTimer),this.refreshTimer=window.setTimeout(()=>void this.load(),e)}say(e){this.toast=e,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",3200)}dropParam(e){const s=new URLSearchParams(S().params);s.delete(e),D(O,s)}enterEdit(e=!1){if(!(!this.canEdit||this.editing)){if(this.editing=!0,this.editHandled=!0,!e){const s=new URLSearchParams(S().params);s.set("edit","1"),D(O,s)}this.scrollTo({top:0})}}leaveEdit(){this.editing=!1,this.editHandled=!1,this.dropParam("edit")}dev(e){return this.devices.find(s=>s.key===e)}async record(e){const s=Date.now()+6e3;let a=null;for(;Date.now()<s&&!this.stopped;){try{if(a=await $().groupRecord(e),a.status==="done")return a}catch{return a}await new Promise(t=>setTimeout(t,500))}return a}setRun(e,s){const a=new Map(this.runs);s?a.set(e,s):a.delete(e),this.runs=a}async followPreset(e,s){this.setRun(e,{pending:!0,failed:[],ok:!1,at:Date.now()});const a=await this.record(s);this.finishRun(e,a)}finishRun(e,s){const a=me(s),t=new Map((s?.members??[]).map(r=>[r.device_key,r]));this.setRun(e,{pending:!1,ok:a.failed.length===0,at:Date.now(),failed:a.failed.map(r=>({key:r.key,room:r.room,text:Z(r.room,t.get(r.key)?.outcome??r.outcome)}))}),this.scheduleRefresh(150)}async apply(e,s=!1){if(!this.runs.get(e.id)?.pending){this.actionError="",this.setRun(e.id,{pending:!0,failed:[],ok:!1,at:Date.now()});try{const a=await Q(e.id,s),t=await this.record(a.bulk_id);this.finishRun(e.id,t)}catch(a){this.setRun(e.id,null);const t=X(a);if(t){const r=t.floors;this.dialog?.confirm({heading:`לצרף ${t.devices} חדרים לקבוצה אחת?`,sub:r>1?`הקבוצה תשמיע ב־${r} קומות.`:void 0,names:H(t),ok:"צרף",run:async()=>{await this.apply(e,!0)}})}else this.say(z(a))}}}async ungroup(e){try{const s=await G([e.leader_key]);await this.record(s.bulk_id),this.scheduleRefresh(100)}catch(s){this.say(z(s))}}async leaveRoom(e){try{const s=await G([e]);await this.record(s.bulk_id),this.scheduleRefresh(100)}catch(s){this.say(z(s))}}async togglePlay(e){const s=await _(e,{command:"transport",action:"play_pause"},void 0,this.askParty);(s.outcome==="refused"||s.outcome==="not_confirmed")&&s.message&&this.say(s.message),this.scheduleRefresh(T()?600:30)}helperLeaders(e){const s=new Map;for(const a of e.members){const t=this.dev(a.key);if(t&&t.can.control&&t.live.caps_known&&t.live.power==="on"){const r=ee(t,this.devices);s.set(r.key,r)}}return[...s.values()]}async toggleHelper(e){const s=this.helperLeaders(e),a=s.filter(I),t=a.length?a:s.filter(o=>o.live.play==="paused"),r=a.length?"pause":"play";let c="";for(const o of t){const g=await _(o.key,{command:"transport",action:r});!c&&(g.outcome==="refused"||g.outcome==="not_confirmed")&&(c=g.message)}c&&this.say(c),this.scheduleRefresh(T()?600:30)}async mute(e,s){const a=this.dev(e),t=s&&a?se(a):null;t!==null&&await _(e,{command:"volume_set",level:t});const r=await _(e,{command:"mute",muted:!s});(r.outcome==="refused"||r.outcome==="not_confirmed")&&this.say(r.message),this.scheduleRefresh(T()?600:30)}slide(e,s,a){const t=new Map(this.local);t.set(e,s),this.local=t,window.clearTimeout(this.sliderTimers.get(e)),this.sliderTimers.set(e,window.setTimeout(()=>void a(),350))}groupSlide(e,s){this.slide(`g:${e.leader_key}`,s,async()=>{try{const a=await te(e.leader_key,s,"relative"),t=await this.record(a.bulk_id),r=new Map;for(const o of t?.members??[])o.outcome==="clamped"?r.set(o.device_key,{text:"הוגבל לתקרה",bad:!1}):o.outcome==="skipped_muted"?r.set(o.device_key,{text:"מושתק",bad:!1}):o.outcome==="skipped_unavailable"||o.outcome==="skipped_off"?r.set(o.device_key,{text:o.outcome==="skipped_off"?"כבוי":"לא זמין",bad:!1}):(o.outcome==="not_allowed"||o.outcome==="unknown")&&r.set(o.device_key,{text:o.outcome==="not_allowed"?"אין הרשאה":"לא ידוע",bad:!0});const c=new Map(this.notes);c.set(e.leader_key,r),this.notes=c}catch(a){ae(a)!=="rate_limited"&&this.say(z(a))}this.scheduleRefresh(100)})}roomSlide(e,s){this.slide(`m:${e}`,s,async()=>{const a=await _(e,{command:"volume_set",level:s});(a.outcome==="refused"||a.outcome==="not_confirmed")&&this.say(a.message),this.scheduleRefresh(100)})}async deletePreset(){const e=this.deleting;if(!(!e||this.busy)){this.busy=!0,this.actionError="";try{await $().deletePreset(e.id,e.revision),this.deleting=null,this.say("נמחק"),await this.load()}catch(s){this.actionError=z(s)}finally{this.busy=!1}}}rangeStyle(e){return`--v:${e}%`}thumb(e){if(!e)return n;const s=B(e);return s.playing||s.paused?i`<div class="thumb" style=${`--art:${s.rgb}`}><div class="art" style=${`--a1:${s.a1};--a2:${s.a2}`}>${he(s.glyph,void 0,"gl")}${s.artwork?i`<img src=${A(s.artwork)} alt="" loading="lazy" />`:n}</div></div>`:n}memberRow(e,s,a){const t=this.dev(s.key),r=s.key===e.leader_key&&!e.static,c=this.notes.get(e.leader_key)?.get(s.key),o=this.local.get(`m:${s.key}`)??s.volume??0,g=this.canControl&&!!t?.can.control&&!!t?.caps.volume_set&&s.available,u=t?ue(ie(t)):null,h=c?i`<small class=${c.bad?"bad":"ok"}>${c.text}</small>`:i`<small>${r?i`${b(s.area_name??"")}${s.area_name?" · ":""}מוביל`:b(s.area_name??"")}</small>`,f=a.leave&&!r&&this.canGroup?i`<button type="button" class="rb" data-leave=${s.key} aria-label=${`נתק · ${s.name}`} title="נתק" @click=${()=>void this.leaveRoom(s.key)}>${l("unlink")}</button>`:i`<button type="button" class=${w({rb:!0,muted:!!s.muted})} aria-pressed=${String(!!s.muted)} aria-label=${`${s.muted?"בטל השתקה":"השתק"} · ${s.name}`} ?disabled=${!g} @click=${()=>void this.mute(s.key,!!s.muted)}>${l(s.muted?"volOff":"vol")}</button>`;return i`<div class=${w({mrow:!0,lead:r,dim:!s.available})} data-member=${s.key}>
      <div class="nm"><b>${x(b(s.name))}</b>${h}</div>
      <span class="rngwrap">${u!==null?i`<span class="cap" style=${`--cap:${u}%`}></span>`:n}<input class="rng sm" type="range" min="0" max="100" .value=${String(o)} style=${this.rangeStyle(o)} aria-label=${`עוצמה · ${s.name}`} ?disabled=${!g} @input=${v=>this.roomSlide(s.key,Number(v.target.value))} /></span>
      <span class="vv"><span class="n">${g||s.volume!==null?o:"—"}</span></span>${f}
    </div>`}groupVolume(e){if(!this.canControl||!e.can.volume)return n;const s=this.local.get(`g:${e.leader_key}`)??e.volume??0;return i`<div class="vrow"><span class="lbl">קבוצה</span><input class="rng" type="range" min="0" max="100" .value=${String(s)} style=${this.rangeStyle(s)} data-group-volume=${e.leader_key} aria-label="עוצמת הקבוצה" @input=${a=>this.groupSlide(e,Number(a.target.value))} /><span class="vv"><span class="n">${s}</span></span></div>`}groupCard(e,s){const a=this.dev(e.leader_key),t=a?B(a):null,r=!!t?.rgb&&(t.playing||t.paused),c=e.members.map(y=>y.area_name||y.name),o=!a||s==="helper"?"":t?.playing?" · מנגן":t?.paused?" · מושהה":" · לא מנגן",g=s==="helper"?`קבוצה וירטואלית · ${k(e.members.length,"חדר אחד","חדרים")}`:`${k(e.members.length,"חדר אחד","חדרים")}${e.floor_ids.length>1?` · ${e.floor_ids.length} קומות`:""}${o}`,u=s==="live"?c.join(" + "):e.name,h=s==="helper"&&this.canControl?this.helperLeaders(e):[],f=h.some(I),v=h.length&&(f||h.some(y=>y.live.play==="paused"))?i`<button type="button" class="rb" data-helper-toggle=${e.leader_key} aria-label=${`${f?"השהה":"המשך"} · ${e.name}`} @click=${()=>void this.toggleHelper(e)}>${l(f?"pause":"play")}</button>`:n,E=a&&(t?.playing||t?.paused)&&t?i`<div class="gnp">${this.thumb(a)}<div class="t"><b>${x(t.title||a.live.now.title||"")}</b><small>${x(t.sub)}</small></div>${this.canControl&&a.can.control?i`<button type="button" class="pk" aria-label=${`${t.playing?"השהה":"המשך"} · ${u}`} @click=${()=>void this.togglePlay(e.leader_key)}>${l(t.playing?"pause":"play")}</button>`:n}</div>`:n,R=!this.phone||this.byRoom===e.leader_key,P=this.phone?i`<button type="button" class="lnk" data-by-room=${e.leader_key} aria-expanded=${String(this.byRoom===e.leader_key)} @click=${()=>this.byRoom=this.byRoom===e.leader_key?"":e.leader_key}>לפי חדר${l("chevronDown")}</button>`:n;return i`<article class=${w({gcard:!0,glass:!0,lit:r})} style=${r?`--art:${t.rgb}`:""} aria-label=${`קבוצה · ${u}`} data-group-card=${e.leader_key} data-group-type=${s}>
      <span class="gbox" aria-hidden="true">${r&&t?i`<div class="art" style=${`--a1:${t.a1};--a2:${t.a2}`}>${t.artwork?i`<img src=${A(t.artwork)} alt="" />`:n}</div>`:n}</span>
      <header class="gh"><span class="gi">${l("group")}</span><div class="tx"><b>${x(b(u))}</b><small>${g}</small></div>
        ${v}${s==="live"&&this.canGroup?i`<button type="button" class="btn sm quiet" data-ungroup=${e.leader_key} @click=${()=>void this.ungroup(e)}>${l("unlink")}פרק</button>`:n}</header>
      ${E}${this.groupVolume(e)}
      <div class="psh"><h4>לפי חדר</h4>${P}</div>
      ${R?i`<div class="members">${e.members.map(y=>this.memberRow(e,y,{leave:s==="live"}))}</div>`:n}
    </article>`}presetCard(e){const s=ge(e,this.devices),a=ve(e,this.devices),t=this.runs.get(e.id),r=fe(e,this.devices),c=new Set((t&&!t.pending?t.failed:[]).map(v=>v.key)),o=s[0],g=s.map(v=>{const E=c.has(v.key)||v.missing,R=!!t&&!t.pending&&t.ok&&!v.missing,P=e.volumes?.[v.key];return i`<span class=${w({chipx:!0,bad:E,ok:R})}>${l(E?"warning":R?"check":"speaker")}${x(b(v.room))}${P!==void 0?i` <span class="n">${P}</span>`:n}</span>`});let u;t?.pending?u=i`<span class="st" data-preset-state="running">${l("group")}מצרף…</span>`:t&&t.failed.length?u=i`<span class="st bad" data-preset-state="partial">${l("warning")}${t.failed.map(v=>v.text).join(", ")}</span>`:r?u=i`<span class="st ok" data-preset-state="live">${l("check")}פועל</span>`:e.missing.length?u=i`<span class="st bad" data-preset-state="missing">${l("warning")}${k(e.missing.length,"חדר אחד לא מוגדר","חדרים לא מוגדרים")}</span>`:u=i`<span class="st" data-preset-state="idle">${k(s.length,"חדר אחד","חדרים")}${a>1?` · ${a} קומות`:""}${e.volumes?" · עם עוצמות":""}</span>`;const h=this.canGroup?i`<button type="button" class=${w({btn:!0,primary:!r,quiet:r,pend:!!t?.pending})} data-apply=${e.id} ?disabled=${r||!!t?.pending||e.missing.length>0} @click=${()=>void this.apply(e)}>${l("play")}הפעל</button>`:n,f=this.editing?i`<span class="ecard"><button type="button" data-preset-edit=${e.id} aria-label=${`ערוך · ${e.name}`} @click=${()=>this.editor?.show(M(e))}>${l("edit")}</button><button type="button" data-preset-delete=${e.id} aria-label=${`מחק · ${e.name}`} @click=${()=>{this.actionError="",this.deleting=e}}>${l("trash")}</button></span>`:n;return i`<article class=${w({gcard:!0,glass:!0,editing:this.editing})} aria-label=${`קבוצה שמורה · ${e.name}`} data-preset=${e.id}>${f}
      <header class="gh"><span class="gi src">${l("star")}</span><div class="tx"><b>${x(b(e.name))}</b><small>${o?i`מוביל: ${x(b(o.room))}`:n}</small></div></header>
      <div class="roomchips">${g}</div>
      <div class="gfoot">${u}<span class="grow"></span>${h}</div>
    </article>`}header(){const{live:e}=q(this.groups,this.devices),s=this.presets.length,a=[e.length?i`${e.length===1?i`<em>קבוצה אחת</em> פועלת`:i`<em><span class="n">${e.length}</span></em> קבוצות פועלות`}`:null,s?i`<span class="n">${s}</span> שמורות`:null].filter(Boolean);return i`<header class=${w({dh:!0,compact:this.compactHeader})} data-mm-header>
      <div class="dh-row"><h1>קבוצות</h1><span class="grow"></span></div>
      ${this.phase==="ready"&&!this.editing&&a.length?i`<div class="dh-det"><span class="amb">${a.map((t,r)=>i`${r?" · ":""}${t}`)}</span></div>`:n}
    </header>`}skeleton(){const e=i`<div class="glass gcard" style="padding:16px 18px"><div style="display:flex;gap:12px;align-items:center"><span class="skl" style="inline-size:44px;block-size:44px;border-radius:var(--sw-r-lg)"></span><div style="flex:1;display:flex;flex-direction:column;gap:8px"><span class="skl" style="block-size:16px;inline-size:55%"></span><span class="skl" style="block-size:12px;inline-size:35%"></span></div></div><span class="skl" style="block-size:44px;border-radius:var(--sw-r-pill)"></span><span class="skl" style="block-size:36px;border-radius:var(--sw-r-md)"></span></div>`;return i`<div data-mm-state="loading" aria-busy="true"><div class="ggrid">${Array.from({length:this.phone?2:3},()=>e)}</div></div>`}stateBox(e,s,a,t=!1){return i`<div class="statebox glass" role="status" style=${t?"padding:36px 24px":""}><span class="ring">${l(e)}</span><b>${s}</b>${a??n}</div>`}editBar(){return i`<div class="editbar" data-mm-editbar><span class="t">${l("edit")}עריכת הקבוצות השמורות</span><span class="grow"></span>
      <button type="button" class="btn sm quiet" data-preset-new @click=${()=>this.editor?.show(M(null))}>${l("plus")}קבוצה חדשה</button>
      <button type="button" class="btn sm primary" data-mm-done @click=${()=>this.leaveEdit()}>${l("check")}סיום</button></div>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return i`<div data-mm-state="error">${this.stateBox("warning","לא ניתן לטעון את הקבוצות",i`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${l("refresh")}נסה שוב</button>`)}</div>`;if(this.phase==="forbidden")return i`<div data-mm-state="forbidden">${this.stateBox("group","אין הרשאת צפייה בקבוצות")}</div>`;if(this.phase==="disabled")return i`<div data-mm-state="disabled">${this.stateBox("power","המולטימדיה כבויה")}</div>`;const{live:e,static:s,helpers:a}=q(this.groups,this.devices),t=this.staleError?i`<div class="errbar" role="alert" data-mm-stale>${l("warning")}הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.<button type="button" class="btn sm" @click=${()=>void this.load()}>נסה שוב</button></div>`:n,r=this.canEdit&&!this.editing?i`<button type="button" class="btn sm quiet" data-preset-new @click=${()=>this.editor?.show(M(null))}>${l("plus")}קבוצה חדשה</button>`:n,c=i`<section class="fsec" data-section="live"><header class="sh"><div><h2>פועלות עכשיו</h2>${e.length?i`<small>${k(e.length,"קבוצה אחת","קבוצות")}</small>`:n}</div></header>
      ${e.length?i`<div class="ggrid">${e.map(h=>this.groupCard(h,"live"))}</div>`:this.stateBox("group","אין קבוצה פעילה",void 0,!0)}</section>`,o=[...s.map(h=>({g:h,t:"static"})),...a.map(h=>({g:h,t:"helper"}))],g=o.length?i`<section class="fsec" data-section="static"><header class="sh"><div><h2>קבוצות קבועות</h2><small>${k(o.length,"קבוצה אחת","קבוצות")}</small></div></header><div class="ggrid">${o.map(h=>this.groupCard(h.g,h.t))}</div></section>`:n,u=i`<section class="fsec" data-section="saved"><header class="sh"><div><h2>קבוצות שמורות</h2><small><span class="n">${this.presets.length}</span> שמורות</small></div><span class="grow"></span>${r}</header>
      ${this.presets.length?i`<div class="ggrid">${this.presets.map(h=>this.presetCard(h))}</div>`:this.stateBox("group","אין קבוצות שמורות",void 0,!0)}</section>`;return i`${t}${this.editing?this.editBar():n}<div class="groups" data-mm-state="ready">${c}${g}${u}</div>`}deleteDialog(){const e=this.deleting;return e?i`<sw-dialog open ?locked=${this.busy} heading=${`למחוק את "${e.name}"?`} data-preset-delete-dialog="open" @close=${()=>this.deleting=null}>
      ${this.actionError?i`<div style="color:var(--sw-danger);font-size:var(--sw-fs-sm)" role="alert">${this.actionError}</div>`:n}
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-pd-no autofocus ?disabled=${this.busy} @click=${()=>this.deleting=null}>ביטול</sw-button>
        <sw-button variant="danger" data-pd-yes ?disabled=${this.busy} @click=${()=>void this.deletePreset()}>מחק</sw-button>
      </div></sw-dialog>`:i`<sw-dialog data-preset-delete-dialog="closed"></sw-dialog>`}render(){return i`<div class="page" data-screen="multimedia-groups">${this.header()}${this.body()}</div>
    <media-group-dialog @group-done=${()=>void this.load()}></media-group-dialog>
    <media-preset-editor .devices=${this.devices} @preset-saved=${()=>{this.say("נשמר"),this.load()}} @preset-stale=${()=>void this.load()}></media-preset-editor>
    ${this.deleteDialog()}
    ${this.toast?i`<div class="toast" role="status" ${re()}>${l("check")}${this.toast}</div>`:n}`}};d.styles=[oe,pe,ne`
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
    /* R5-MEDIA-ENERGY-297: the group name is the card's title - 20 px / 800 in the heading ink */
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
      /* R5-MEDIA-ENERGY-297: the now-playing strip is a well inside the glass card (no outlined box inside a card) */
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
      transition: transform var(--sw-t-press, 120ms) var(--mm-ease);
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
    /* R5-MEDIA-ENERGY-297: the group volume is a display numeral (20 px / 800) */
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
      border-radius: 1px;
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
      /* R5-MEDIA-ENERGY-297: a member row is a well (a tone step, no outline); the leading room a filled accent field */
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
      animation: mm-spin 0.8s linear infinite;
    }
    /* POLISH4-WP5: the edit chips sit at the card's end (the shared place) and the title row keeps clear of them while editing, so
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
    /* POLISH4-WP5 (emil-design-eng): a link answers the press like the keys do, the slider's thumb lifts while it is held, and hover
       is for a pointer that hovers (a touch never leaves it lit) */
    .lnk {
      transition: transform var(--sw-t-press, 120ms) var(--mm-ease), color var(--mm-motion);
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
        animation-duration: 3s;
      }
      .gcard,
      .pk,
      .lnk {
        transition: none;
      }
    }
  `];p([le()],d.prototype,"playerKey",2);p([m()],d.prototype,"phase",2);p([m()],d.prototype,"devices",2);p([m()],d.prototype,"groups",2);p([m()],d.prototype,"presets",2);p([m()],d.prototype,"status",2);p([m()],d.prototype,"compactHeader",2);p([m()],d.prototype,"staleError",2);p([m()],d.prototype,"toast",2);p([m()],d.prototype,"phone",2);p([m()],d.prototype,"editing",2);p([m()],d.prototype,"byRoom",2);p([m()],d.prototype,"runs",2);p([m()],d.prototype,"notes",2);p([m()],d.prototype,"deleting",2);p([m()],d.prototype,"busy",2);p([m()],d.prototype,"actionError",2);p([m()],d.prototype,"local",2);p([N("media-group-dialog")],d.prototype,"dialog",2);p([N("media-preset-editor")],d.prototype,"editor",2);d=p([de("multimedia-groups")],d);export{d as MultimediaGroups};
//# sourceMappingURL=multimedia-groups-CiMdbcX8.js.map
