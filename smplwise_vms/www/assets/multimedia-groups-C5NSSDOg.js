import{dU as T,an as A,b3 as V,dd as E,dV as Y,d7 as K,dW as U,dX as F,dY as W,dZ as M,d_ as N,af as D,d$ as X,ds as O,dc as Z,e0 as J,e1 as Q,A as d,de as B,b as r,db as ee,aj as k,cV as S,e2 as te,bx as se,j as ae,z as ie,k as $,e3 as q,m as re}from"./index-DlIoBDHe.js";import{r as L,p as I}from"./media-group-dialog-urMzLVhp.js";import{d as G}from"./media-preset-editor-I334fuVe.js";import"./sw-pager-CRaHLwBI.js";import{P as oe}from"./page-fit-C-PdjtV0.js";import{M as ne}from"./multimedia-base-9YBAeEPB.js";import{m as le}from"./media-page-yQRXmvQ1.js";import{g as de,m as p,n as z}from"./media-now-BGPPAckq.js";import{s as ce,c as pe,p as he,a as me,b as ge,d as j}from"./multimedia-players-layout-B6H1saw6.js";import{t as s}from"./media-BC_Yw4Md.js";import"./sw-logo-art-PLtEZJxU.js";import"./long-lists-Dy6lkUY8.js";import"./lead-reserve-C8P_lhrn.js";var ue=Object.defineProperty,ve=Object.getOwnPropertyDescriptor,v=(e,t,i,o)=>{for(var a=o>1?void 0:o?ve(t,i):t,n=e.length-1,l;n>=0;n--)(l=e[n])&&(a=(o?l(t,i,a):l(a))||a);return o&&a&&ue(t,i,a),a};const H="/multimedia/groups",fe=e=>e,C=(e,t,i)=>e===1?t:`${e} ${i}`;let g=class extends ne{constructor(){super(...arguments),this.playerKey="",this.groups=[],this.presets=[],this.byRoom="",this.runs=new Map,this.notes=new Map,this.deleting=null,this.actionError="",this.local=new Map,this.fit=new oe(this,()=>this.renderRoot.querySelector(".scr"),()=>!this.editing),this.sliderTimers=new Map,this.stopped=!1,this.path=H,this.tab="groups",this.editEntry={id:"multimedia-groups-edit",label:s("עריכת הקבוצות השמורות")},this.askParty=e=>new Promise(t=>{const i=this.dialog;if(!i)return t(!1);i.confirm({heading:s("לשלוט ב־{devices} חדרים יחד?",{devices:e.devices}),sub:e.floors>1?s("הקבוצה משמיעה ב־{floors} קומות.",{floors:e.floors}):void 0,names:T(e),ok:s("בצע"),run:async()=>t(!0),cancel:()=>t(!1)})})}connectedCallback(){this.stopped=!1,super.connectedCallback()}disconnectedCallback(){super.disconnectedCallback(),this.stopped=!0;for(const e of this.sliderTimers.values())window.clearTimeout(e)}atConnect(){this.wantsEdit=A().params.get("edit")==="1"}routeLeftEdit(){this.editing=!1}pushed(e){e.type==="media_state"?this.devices=this.devices.map(t=>t.key===e.device_key?{...t,live:fe(e.live)}:t):(e.type==="media_devices_changed"||e.type==="media_groups_changed")&&this.scheduleRefresh(200)}get canEdit(){return this.phase==="ready"&&!!this.status?.can.layout&&!V("layout_editor")}get canGroup(){return!!this.status?.can.group}get canControl(){return!!this.status?.can.control}readStatus(){return E().status()}async readContent(){const[e,t,i]=await Promise.all([E().list({kind:Y}),E().groups(),E().presets()]);this.devices=e.devices,this.groups=t,this.presets=i,this.local=new Map}loaded(){for(const e of this.presets)e.running&&!this.runs.has(e.id)&&this.followPreset(e.id,e.running.bulk_id)}enterEdit(e=!1){if(!(!this.canEdit||this.editing)){if(this.editing=!0,this.editHandled=!0,!e){const t=new URLSearchParams(A().params);t.set("edit","1"),K(H,t)}this.scrollTo({top:0})}}leaveEdit(){this.editing=!1,this.editHandled=!1,this.dropParam("edit")}dev(e){return this.devices.find(t=>t.key===e)}async record(e){const t=Date.now()+6e3;let i=null;for(;Date.now()<t&&!this.stopped;){try{if(i=await E().groupRecord(e),i.status==="done")return i}catch{return i}await new Promise(o=>setTimeout(o,500))}return i}setRun(e,t){const i=new Map(this.runs);t?i.set(e,t):i.delete(e),this.runs=i}async followPreset(e,t){this.setRun(e,{pending:!0,failed:[],ok:!1,at:Date.now()});const i=await this.record(t);this.finishRun(e,i)}finishRun(e,t){const i=ce(t),o=new Map((t?.members??[]).map(a=>[a.device_key,a]));this.setRun(e,{pending:!1,ok:i.failed.length===0,at:Date.now(),failed:i.failed.map(a=>({key:a.key,room:a.room,text:U(a.room,o.get(a.key)?.outcome??a.outcome)}))}),this.scheduleRefresh(150)}async apply(e,t=!1){if(!this.runs.get(e.id)?.pending){this.actionError="",this.setRun(e.id,{pending:!0,failed:[],ok:!1,at:Date.now()});try{const i=await F(e.id,t),o=await this.record(i.bulk_id);this.finishRun(e.id,o)}catch(i){this.setRun(e.id,null);const o=W(i);if(o){const a=o.floors;this.dialog?.confirm({heading:s("לצרף {devices} חדרים לקבוצה אחת?",{devices:o.devices}),sub:a>1?s("הקבוצה תשמיע ב־{floors} קומות.",{floors:a}):void 0,names:T(o),ok:s("צרף"),run:async()=>{await this.apply(e,!0)}})}else this.say(M(i))}}}async ungroup(e){try{const t=await N([e.leader_key]);await this.record(t.bulk_id),this.scheduleRefresh(100)}catch(t){this.say(M(t))}}async leaveRoom(e){try{const t=await N([e]);await this.record(t.bulk_id),this.scheduleRefresh(100)}catch(t){this.say(M(t))}}async togglePlay(e){const t=await L(e,{command:"transport",action:"play_pause"},void 0,this.askParty);(t.outcome==="refused"||t.outcome==="not_confirmed")&&t.message&&this.say(t.message),this.scheduleRefresh(D()?600:30)}helperLeaders(e){const t=new Map;for(const i of e.members){const o=this.dev(i.key);if(o&&o.can.control&&o.live.caps_known&&o.live.power==="on"){const a=X(o,this.devices);t.set(a.key,a)}}return[...t.values()]}async toggleHelper(e){const t=this.helperLeaders(e),i=t.filter(O),o=i.length?i:t.filter(l=>l.live.play==="paused"),a=i.length?"pause":"play";let n="";for(const l of o){const m=await L(l.key,{command:"transport",action:a});!n&&(m.outcome==="refused"||m.outcome==="not_confirmed")&&(n=m.message)}n&&this.say(n),this.scheduleRefresh(D()?600:30)}async mute(e,t){const i=this.dev(e),o=t&&i?Z(i):null;o!==null&&await L(e,{command:"volume_set",level:o});const a=await L(e,{command:"mute",muted:!t});(a.outcome==="refused"||a.outcome==="not_confirmed")&&this.say(a.message),this.scheduleRefresh(D()?600:30)}slide(e,t,i){const o=new Map(this.local);o.set(e,t),this.local=o,window.clearTimeout(this.sliderTimers.get(e)),this.sliderTimers.set(e,window.setTimeout(()=>void i(),350))}groupSlide(e,t){this.slide(`g:${e.leader_key}`,t,async()=>{try{const i=await J(e.leader_key,t,"relative"),o=await this.record(i.bulk_id),a=new Map;for(const l of o?.members??[])l.outcome==="clamped"?a.set(l.device_key,{text:s("הוגבל לתקרה"),bad:!1}):l.outcome==="skipped_muted"?a.set(l.device_key,{text:s("מושתק"),bad:!1}):l.outcome==="skipped_unavailable"||l.outcome==="skipped_off"?a.set(l.device_key,{text:l.outcome==="skipped_off"?s("כבוי"):s("לא זמין"),bad:!1}):(l.outcome==="not_allowed"||l.outcome==="unknown")&&a.set(l.device_key,{text:l.outcome==="not_allowed"?s("אין הרשאה"):s("לא ידוע"),bad:!0});const n=new Map(this.notes);n.set(e.leader_key,a),this.notes=n}catch(i){Q(i)!=="rate_limited"&&this.say(M(i))}this.scheduleRefresh(100)})}roomSlide(e,t){this.slide(`m:${e}`,t,async()=>{const i=await L(e,{command:"volume_set",level:t});(i.outcome==="refused"||i.outcome==="not_confirmed")&&this.say(i.message),this.scheduleRefresh(100)})}async deletePreset(){const e=this.deleting;if(!(!e||this.busy)){this.busy=!0,this.actionError="";try{await E().deletePreset(e.id,e.revision),this.deleting=null,this.say(s("נמחק")),await this.load()}catch(t){this.actionError=M(t)}finally{this.busy=!1}}}rangeStyle(e){return`--v:${e}%`}thumb(e){if(!e)return d;const t=I(e);return t.playing||t.paused?r`<div class="thumb" style=${`--art:${t.rgb}`}><div class="art" style=${`--a1:${t.a1};--a2:${t.a2}`}>${de(t.glyph,void 0,"gl")}${t.artwork?r`<img src=${B(t.artwork)} alt="" loading="lazy" />`:d}</div></div>`:d}memberRow(e,t,i){const o=this.dev(t.key),a=t.key===e.leader_key&&!e.static,n=this.notes.get(e.leader_key)?.get(t.key),l=this.local.get(`m:${t.key}`)??t.volume??0,m=this.canControl&&!!o?.can.control&&!!o?.caps.volume_set&&t.available,w=o?pe(ee(o)):null,h=n?r`<small class=${n.bad?"bad":"ok"}>${n.text}</small>`:r`<small>${a?r`${k(t.area_name??"")}${t.area_name?" · ":""}${s("מוביל")}`:k(t.area_name??"")}</small>`,b=i.leave&&!a&&this.canGroup?r`<button type="button" class="rb" data-leave=${t.key} aria-label=${s("נתק · {name}",{name:t.name})} title=${s("נתק")} @click=${()=>void this.leaveRoom(t.key)}>${p("unlink")}</button>`:r`<button type="button" class=${S({rb:!0,muted:!!t.muted})} aria-pressed=${String(!!t.muted)} aria-label=${`${t.muted?s("בטל השתקה"):s("השתק")} · ${t.name}`} ?disabled=${!m} @click=${()=>void this.mute(t.key,!!t.muted)}>${p(t.muted?"volOff":"vol")}</button>`;return r`<div class=${S({mrow:!0,lead:a,dim:!t.available})} data-member=${t.key}>
      <div class="nm"><b>${z(k(t.name))}</b>${h}</div>
      <span class="rngwrap">${w!==null?r`<span class="cap" style=${`--cap:${w}%`}></span>`:d}<input class="rng sm" type="range" min="0" max="100" .value=${String(l)} style=${this.rangeStyle(l)} aria-label=${s("עוצמה · {name}",{name:t.name})} ?disabled=${!m} @input=${x=>this.roomSlide(t.key,Number(x.target.value))} /></span>
      <span class="vv"><span class="n">${m||t.volume!==null?l:"—"}</span></span>${b}
    </div>`}groupVolume(e){if(!this.canControl||!e.can.volume)return d;const t=this.local.get(`g:${e.leader_key}`)??e.volume??0;return r`<div class="vrow"><span class="lbl">${s("קבוצה")}</span><input class="rng" type="range" min="0" max="100" .value=${String(t)} style=${this.rangeStyle(t)} data-group-volume=${e.leader_key} aria-label=${s("עוצמת הקבוצה")} @input=${i=>this.groupSlide(e,Number(i.target.value))} /><span class="vv"><span class="n">${t}</span></span></div>`}groupCard(e,t,i=!1){const o=this.dev(e.leader_key),a=o?I(o):null,n=!!a?.rgb&&(a.playing||a.paused),l=e.members.map(y=>y.area_name||y.name),m=!o||t==="helper"?"":a?.playing?s(" · מנגן"):a?.paused?s(" · מושהה"):s(" · לא מנגן"),w=t==="helper"?`${s("קבוצה וירטואלית")} · ${C(e.members.length,s("חדר אחד"),s("חדרים"))}`:`${C(e.members.length,s("חדר אחד"),s("חדרים"))}${e.floor_ids.length>1?s(" · {length} קומות",{length:e.floor_ids.length}):""}${m}`,h=t==="live"?l.join(" + "):e.name,b=t==="helper"&&this.canControl?this.helperLeaders(e):[],x=b.some(O),u=b.length&&(x||b.some(y=>y.live.play==="paused"))?r`<button type="button" class="rb" data-helper-toggle=${e.leader_key} aria-label=${`${x?s("השהה"):s("המשך")} · ${e.name}`} @click=${()=>void this.toggleHelper(e)}>${p(x?"pause":"play")}</button>`:d,_=o&&(a?.playing||a?.paused)&&a?r`<div class="gnp">${this.thumb(o)}<div class="t"><b>${z(a.title||o.live.now.title||"")}</b><small>${z(a.sub)}</small></div>${this.canControl&&o.can.control?r`<button type="button" class="pk" aria-label=${`${a.playing?s("השהה"):s("המשך")} · ${h}`} @click=${()=>void this.togglePlay(e.leader_key)}>${p(a.playing?"pause":"play")}</button>`:d}</div>`:d,R=!this.phone||this.byRoom===e.leader_key,P=this.phone?r`<button type="button" class="lnk" data-by-room=${e.leader_key} aria-expanded=${String(this.byRoom===e.leader_key)} @click=${()=>this.byRoom=this.byRoom===e.leader_key?"":e.leader_key}>${s("לפי חדר")}${p("chevronDown")}</button>`:d;return r`<article data-fit-item ?data-off=${i} class=${S({gcard:!0,glass:!0,lit:n})} style=${n?`--art:${a.rgb}`:""} aria-label=${s("קבוצה · {title}",{title:h})} data-group-card=${e.leader_key} data-group-type=${t}>
      <span class="gbox" aria-hidden="true">${n&&a?r`<div class="art" style=${`--a1:${a.a1};--a2:${a.a2}`}>${a.artwork?r`<img src=${B(a.artwork)} alt="" />`:d}</div>`:d}</span>
      <header class="gh"><span class="gi">${p("group")}</span><div class="tx"><b>${z(k(h))}</b><small>${w}</small></div>
        ${u}${t==="live"&&this.canGroup?r`<button type="button" class="btn sm quiet" data-ungroup=${e.leader_key} @click=${()=>void this.ungroup(e)}>${p("unlink")}${s("פרק")}</button>`:d}</header>
      ${_}${this.groupVolume(e)}
      <div class="psh"><h4>${s("לפי חדר")}</h4>${P}</div>
      ${R?r`<div class="members">${e.members.map(y=>this.memberRow(e,y,{leave:t==="live"}))}</div>`:d}
    </article>`}presetCard(e,t=!1){const i=he(e,this.devices),o=me(e,this.devices),a=this.runs.get(e.id),n=ge(e,this.devices),l=new Set((a&&!a.pending?a.failed:[]).map(u=>u.key)),m=i[0],w=i.map(u=>{const _=l.has(u.key)||u.missing,R=!!a&&!a.pending&&a.ok&&!u.missing,P=e.volumes?.[u.key];return r`<span class=${S({chipx:!0,bad:_,ok:R})}>${p(_?"warning":R?"check":"speaker")}${z(k(u.room))}${P!==void 0?r` <span class="n">${P}</span>`:d}</span>`});let h;a?.pending?h=r`<span class="st" data-preset-state="running">${p("group")}${s("מצרף…")}</span>`:a&&a.failed.length?h=r`<span class="st bad" data-preset-state="partial">${p("warning")}${a.failed.map(u=>u.text).join(", ")}</span>`:n?h=r`<span class="st ok" data-preset-state="live">${p("check")}${s("פועל")}</span>`:e.missing.length?h=r`<span class="st bad" data-preset-state="missing">${p("warning")}${C(e.missing.length,s("חדר אחד לא מוגדר"),s("חדרים לא מוגדרים"))}</span>`:h=r`<span class="st" data-preset-state="idle">${C(i.length,s("חדר אחד"),s("חדרים"))}${o>1?s(" · {floors} קומות",{floors:o}):""}${e.volumes?s(" · עם עוצמות"):""}</span>`;const b=this.canGroup?r`<button type="button" class=${S({btn:!0,primary:!n,quiet:n,pend:!!a?.pending})} data-apply=${e.id} ?disabled=${n||!!a?.pending||e.missing.length>0} @click=${()=>void this.apply(e)}>${p("play")}${s("הפעל")}</button>`:d,x=this.editing?r`<span class="ecard"><button type="button" data-preset-edit=${e.id} aria-label=${s("ערוך · {name}",{name:e.name})} @click=${()=>this.editor?.show(G(e))}>${p("edit")}</button><button type="button" data-preset-delete=${e.id} aria-label=${s("מחק · {name}",{name:e.name})} @click=${()=>{this.actionError="",this.deleting=e}}>${p("trash")}</button></span>`:d;return r`<article data-fit-item ?data-off=${t} class=${S({gcard:!0,glass:!0,editing:this.editing})} aria-label=${s("קבוצה שמורה · {name}",{name:e.name})} data-preset=${e.id}>${x}
      <header class="gh"><span class="gi src">${p("star")}</span><div class="tx"><b>${z(k(e.name))}</b><small>${m?r`${s("מוביל:")} ${z(k(m.room))}`:d}</small></div></header>
      <div class="roomchips">${w}</div>
      <div class="gfoot">${h}<span class="grow"></span>${b}</div>
    </article>`}summary(){if(this.phase!=="ready"||this.editing)return"";const{live:e}=j(this.groups,this.devices),t=this.presets.length;return[e.length?e.length===1?s("קבוצה אחת פועלת"):s("{length} קבוצות פועלות",{length:e.length}):"",t?s("{n} שמורות",{n:t}):""].filter(Boolean).join(" · ")}pagerAction(){return this.fit.pages>1?r`<sw-pager slot="actions" data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${e=>this.fit.go(e.detail.page)}></sw-pager>`:d}skeleton(){const e=r`<div class="glass gcard" style="padding:16px 18px"><div style="display:flex;gap:12px;align-items:center"><span class="skl" style="inline-size:44px;block-size:44px;border-radius:var(--sw-r-lg)"></span><div style="flex:1;display:flex;flex-direction:column;gap:8px"><span class="skl" style="block-size:16px;inline-size:55%"></span><span class="skl" style="block-size:12px;inline-size:35%"></span></div></div><span class="skl" style="block-size:44px;border-radius:var(--sw-r-pill)"></span><span class="skl" style="block-size:36px;border-radius:var(--sw-r-md)"></span></div>`;return r`<div data-mm-state="loading" aria-busy="true"><div class="ggrid">${Array.from({length:this.phone?2:3},()=>e)}</div></div>`}stateBox(e,t,i,o=!1){return r`<div class="statebox glass" role="status" style=${o?"padding:36px 24px":""}><span class="ring">${p(e)}</span><b>${t}</b>${i??d}</div>`}editBar(){return r`<div class="editbar" data-mm-editbar><span class="t">${p("edit")}${s("עריכת הקבוצות השמורות")}</span><span class="grow"></span>
      <button type="button" class="btn sm quiet" data-preset-new @click=${()=>this.editor?.show(G(null))}>${p("plus")}${s("קבוצה חדשה")}</button>
      <button type="button" class="btn sm primary" data-mm-done @click=${()=>this.leaveEdit()}>${p("check")}${s("סיום")}</button></div>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return r`<div data-mm-state="error">${this.stateBox("warning",s("לא ניתן לטעון את הקבוצות"),r`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${p("refresh")}${s("נסה שוב")}</button>`)}</div>`;if(this.phase==="forbidden")return r`<div data-mm-state="forbidden">${this.stateBox("group",s("אין הרשאת צפייה בקבוצות"))}</div>`;if(this.phase==="disabled")return r`<div data-mm-state="disabled">${this.stateBox("power",s("המולטימדיה כבויה"))}</div>`;const{live:e,static:t,helpers:i}=j(this.groups,this.devices),o=this.staleError?r`<div class="errbar" role="alert" data-mm-stale>${p("warning")}${s("הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.")}<button type="button" class="btn sm" @click=${()=>void this.load()}>${s("נסה שוב")}</button></div>`:d,a=this.canEdit&&!this.editing?r`<button type="button" class="btn sm quiet" data-preset-new @click=${()=>this.editor?.show(G(null))}>${p("plus")}${s("קבוצה חדשה")}</button>`:d,n=[...t.map(c=>({g:c,t:"static"})),...i.map(c=>({g:c,t:"helper"}))];this.fit.sync(e.length+n.length+this.presets.length,`${e.map(c=>c.leader_key).join(",")}|${n.map(c=>c.g.leader_key).join(",")}|${this.presets.map(c=>c.id).join(",")}|${this.phone}`);const l=this.fit.page===1,m=this.fit.page===this.fit.pages,w=c=>!this.fit.shows(c),h=c=>!this.fit.shows(e.length+c),b=c=>!this.fit.shows(e.length+n.length+c),x=e.length?e.every((c,f)=>w(f)):!l,u=n.every((c,f)=>h(f)),_=this.presets.length?this.presets.every((c,f)=>b(f)):!m,R=r`<section class="fsec" ?data-off=${x} data-section="live"><header class="sh"><div><h2>${s("פועלות עכשיו")}</h2>${e.length?r`<small>${C(e.length,s("קבוצה אחת"),s("קבוצות"))}</small>`:d}</div></header>
      ${e.length?r`<div class="ggrid">${e.map((c,f)=>this.groupCard(c,"live",w(f)))}</div>`:this.stateBox("group",s("אין קבוצה פעילה"),void 0,!0)}</section>`,P=n.length?r`<section class="fsec" ?data-off=${u} data-section="static"><header class="sh"><div><h2>${s("קבוצות קבועות")}</h2><small>${C(n.length,s("קבוצה אחת"),s("קבוצות"))}</small></div></header><div class="ggrid">${n.map((c,f)=>this.groupCard(c.g,c.t,h(f)))}</div></section>`:d,y=r`<section class="fsec" ?data-off=${_} data-section="saved"><header class="sh"><div><h2>${s("קבוצות שמורות")}</h2><small><span class="n">${this.presets.length}</span> ${s("שמורות")}</small></div><span class="grow"></span>${a}</header>
      ${this.presets.length?r`<div class="ggrid">${this.presets.map((c,f)=>this.presetCard(c,b(f)))}</div>`:this.stateBox("group",s("אין קבוצות שמורות"),void 0,!0)}</section>`;return r`${o}${this.editing?this.editBar():d}<div class="groups" data-mm-state="ready">${R}${P}${y}</div>`}deleteDialog(){const e=this.deleting;return e?r`<sw-dialog open ?locked=${this.busy} heading=${s('למחוק את "{name}"?',{name:e.name})} data-preset-delete-dialog="open" @close=${()=>this.deleting=null}>
      ${this.actionError?r`<div style="color:var(--sw-danger);font-size:var(--sw-fs-sm)" role="alert">${this.actionError}</div>`:d}
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-pd-no autofocus ?disabled=${this.busy} @click=${()=>this.deleting=null}>${s("ביטול")}</sw-button>
        <sw-button variant="danger" data-pd-yes ?disabled=${this.busy} @click=${()=>void this.deletePreset()}>${s("מחק")}</sw-button>
      </div></sw-dialog>`:r`<sw-dialog data-preset-delete-dialog="closed"></sw-dialog>`}willUpdate(){this.toggleAttribute("data-fit",this.fit.fits)}render(){const e=this.body();return r`<sw-page class="page" wide heading=${s("קבוצות")} subheading=${this.summary()} data-screen="multimedia-groups">${this.pagerAction()}${this.editing?e:r`<div class="scr" data-mm-region>${e}</div>`}</sw-page>
    <media-group-dialog @group-done=${()=>void this.load()}></media-group-dialog>
    <media-preset-editor .devices=${this.devices} @preset-saved=${()=>{this.say(s("נשמר")),this.load()}} @preset-stale=${()=>void this.load()}></media-preset-editor>
    ${this.deleteDialog()}
    ${this.toast?r`<div class="toast" role="status" ${te()}>${p("check")}${this.toast}</div>`:d}`}};g.styles=[se,le,ae`
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
      -webkit-mask-image: var(--mm-fade-art);
      mask-image: var(--mm-fade-art);
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
      font-weight: var(--sw-fw-semibold);
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
      font-weight: var(--sw-fw-semibold);
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
      font-weight: var(--sw-fw-bold);
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
      font-weight: var(--sw-fw-semibold);
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
      font-weight: var(--sw-fw-bold);
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
      font-weight: var(--sw-fw-semibold);
    }
    .mrow .nm small.ok {
      color: var(--dv-success);
      font-weight: var(--sw-fw-semibold);
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
      font-weight: var(--sw-fw-semibold);
    }
    .gfoot .st.bad {
      color: var(--dv-danger);
      font-weight: var(--sw-fw-semibold);
    }
    .gfoot .btn.pend .ic {
      animation: mm-spin calc(var(--sw-t-med) * 4) linear infinite;
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
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30 #5, 960 px at 1366x768). Below 1024 px wide - or
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
      /* PAGING-SETTING-2439: the long lists scroll (הגדרות › כללי): every card is drawn and the region scrolls inside itself */
      :host([data-fit][data-long-lists='scroll']) .scr {
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
      }
      :host([data-fit]) .groups {
        gap: var(--sw-s-5);
      }
      /* the cards of the other pages (and a section with none on this page) stay in the document, out of the layout */
      :host([data-fit]) [data-off] {
        display: none !important;
      }
      /* a group of many rooms keeps one card's height on a page: its room rows (the long part) scroll inside the card, the half row at
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
  `];v([ie()],g.prototype,"playerKey",2);v([$()],g.prototype,"groups",2);v([$()],g.prototype,"presets",2);v([$()],g.prototype,"byRoom",2);v([$()],g.prototype,"runs",2);v([$()],g.prototype,"notes",2);v([$()],g.prototype,"deleting",2);v([$()],g.prototype,"actionError",2);v([$()],g.prototype,"local",2);v([q("media-group-dialog")],g.prototype,"dialog",2);v([q("media-preset-editor")],g.prototype,"editor",2);g=v([re("multimedia-groups")],g);export{g as MultimediaGroups};
