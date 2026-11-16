import{i as K,r as d,a as G,ep as g,R as x,ak as w,am as Y,K as R,aj as V,eu as W,q as a,X as b,ew as Z,p as u,ey as P,x as X,km as J,eo as Q,fT as ee,fq as te,cU as se,aS as ie,kn as F,ko as ae,cA as re,kp as oe,cX as ne,bI as le,V as _,dl as de,kq as ce,es as he,gF as pe,cP as L,kr as ue,ks as fe,kt as me,ku as ve,kv as be,dH as ge,fS as we,dI as ye,n as xe,e as $e}from"./index-C5kZ9jiu.js";import{l as ke}from"./lead-reserve-BLWZG4KN.js";import"./media-screen-card-ByS7dTK8.js";import"./sw-pager-2h-bsNFx.js";import{P as ze}from"./multimedia-page-fit-aNuqF9pe.js";import{N as z,f as Ee,r as D,l as q,D as Te,a as E,w as Re,e as _e,b as A,s as De,i as Se,c as Pe,d as C,p as Oe,g as Fe,h as Le,j as B,m as H,k as M,t as qe,n as S,o as I,S as Ae,q as Ce}from"./media-personal-DUZuFXgN.js";import{m as f,n as j}from"./media-now-DDqP14hw.js";import"./sw-logo-art-Va6y_cIM.js";var Be=Object.defineProperty,He=Object.getOwnPropertyDescriptor,y=(e,t,s,r)=>{for(var i=r>1?void 0:r?He(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(i=(r?c(t,s,i):c(i))||i);return r&&i&&Be(t,s,i),i};const Me={already_off:"כבוי כבר",not_confirmed:"לא אושר שהוא דולק",unavailable:"לא זמין",not_allowed:"אין הרשאה"};let m=class extends G{constructor(){super(...arguments),this.phase="closed",this.req=null,this.preview=null,this.record=null,this.error="",this.follow=null,this.close=()=>{this.phase!=="sending"&&(this.phase="closed")}}async show(e){if(!(this.phase==="sending"||this.phase==="running")){this.req=e,this.preview=null,this.record=null,this.error="",this.phase="loading";try{const t=await g().bulkPreview(e.scope,e.id);if(this.req!==e)return;this.preview=t,this.phase=t.counts.send?"confirm":"nothing"}catch(t){if(this.req!==e)return;this.error=t instanceof x&&t.status===403?"אין לך הרשאה לכיבוי מרוכז כאן.":w(t),this.phase="error"}}}async confirm(){const e=this.req,t=this.preview;if(!(!e||!t||this.phase!=="confirm")){this.phase="sending";try{const s=await g().bulkRun(e.scope,e.id,Y(),new Date(Date.now()+15e3).toISOString());this.phase="running",R()&&(this.follow={stopped:!1},this.record=await V(await W(s.bulk_id),r=>this.record=r,this.follow)),this.phase="result",this.dispatchEvent(new CustomEvent("bulk-done",{detail:this.record,bubbles:!0,composed:!0}))}catch(s){this.error=s instanceof x&&s.code==="target_changed"?"רשימת המסכים השתנתה; לא נשלח דבר. פתחו מחדש.":w(s),this.phase="error",this.dispatchEvent(new CustomEvent("bulk-done",{detail:null,bubbles:!0,composed:!0}))}}}disconnectedCallback(){super.disconnectedCallback(),this.follow&&(this.follow.stopped=!0)}updated(e){!e.has("phase")||this.phase==="closed"||this.phase==="sending"||this.phase==="running"||requestAnimationFrame(()=>{const t=this.renderRoot.querySelector("sw-button[data-bulk-cancel]");(t?.shadowRoot?.querySelector("button")??t)?.focus({preventScroll:!0})})}render(){const e=this.req;if(this.phase==="closed"||!e)return a`<sw-dialog data-media-bulk="closed"></sw-dialog>`;const t=this.preview,s=this.phase==="confirm"&&t?`לכבות ${t.counts.send===1?"מסך אחד":`${t.counts.send} מסכים`} ב${b(e.name)}?`:`כיבוי מסכים · ${b(e.name)}`;return a`<sw-dialog open ?locked=${this.phase==="sending"} data-media-bulk=${this.phase} heading=${s} @close=${this.close}>${this.body()}</sw-dialog>`}cancel(e="ביטול"){return a`<sw-button data-bulk-cancel autofocus @click=${this.close}>${e}</sw-button>`}body(){const e=this.preview;if(this.phase==="loading")return a`<div class="muted">בודק…</div><div class="actions">${this.cancel()}</div>`;if(this.phase==="error")return a`<div class="err" data-bulk-error>${this.error}</div><div class="actions">${this.cancel("סגור")}</div>`;if(this.phase==="nothing"&&e)return a`<div class="what" data-bulk-nothing><div>אין מסך דולק שאושר לכיבוי.</div>${this.details(e)}</div><div class="actions">${this.cancel("סגור")}</div>`;if(this.phase==="confirm"&&e)return a`<div class="what" data-bulk-what>${this.details(e)}</div>
        <div class="actions">${this.cancel()}<sw-button data-bulk-confirm variant="danger" @click=${()=>void this.confirm()}>כבה (${e.counts.send})</sw-button></div>`;const t=this.record;if(this.phase==="sending"||!t&&this.phase==="running")return a`<div class="muted" data-bulk-progress>שולח…</div>`;if(!t)return a`<div class="what" data-bulk-result="ok"><div class="headline ok"><sw-icon name="check" size="16"></sw-icon>בוצע</div></div><div class="actions">${this.cancel("סגור")}</div>`;const s=Z(t),r=t.counts,i=r.total?Math.round(r.confirmed/r.total*100):0,o=t.items.filter(c=>c.outcome!=="confirmed");return a`<div class="what" data-bulk-progress data-confirmed=${r.confirmed} data-total=${r.total}>
        <div class=${P({headline:!0,[s.tone]:!0})} data-bulk-result=${t.done?s.tone:"running"}>${t.done?a`<sw-icon .name=${s.tone==="ok"?"check":"warning"} size="16"></sw-icon>`:u}${s.text}</div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax=${r.total} aria-valuenow=${r.confirmed} aria-label="אושרו"><div style=${`inline-size:${i}%`}></div></div>
        ${t.done&&o.length?a`<ul>${o.map(c=>a`<li>${b(c.name)}<span class="tag">לא אושר</span></li>`)}</ul>`:u}
      </div>
      <div class="actions">${this.cancel("סגור")}</div>`}details(e){const t=e.devices.filter(r=>r.will==="off"),s=e.devices.filter(r=>r.will==="skip");return a`<details data-bulk-details><summary>פרטים</summary>
      ${t.length?a`<ul>${t.map(r=>a`<li>${b(r.name)}</li>`)}</ul>`:u}
      ${s.length?a`<div class="muted">לא נכללו:</div><ul>${s.map(r=>a`<li>${b(r.name)}<span class="tag">${r.reason?Me[r.reason]??r.reason:""}</span></li>`)}</ul>`:u}
    </details>`}};m.styles=K`
    .what {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    details {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    summary {
      cursor: pointer;
      min-block-size: 32px;
      display: inline-flex;
      align-items: center;
    }
    ul {
      margin: 4px 0 0;
      padding-inline-start: 18px;
      max-block-size: 160px;
      overflow: auto;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-block-start: 6px;
    }
    .bar {
      block-size: 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar > div {
      block-size: 100%;
      background: var(--sw-success);
      transition: inline-size var(--sw-t-med) var(--sw-ease);
    }
    .headline {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .headline.ok {
      color: var(--sw-success);
    }
    .headline.partial,
    .headline.none {
      color: var(--sw-warning);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .tag {
      color: var(--sw-text-3);
      margin-inline-start: 6px;
    }
  `;y([d()],m.prototype,"phase",2);y([d()],m.prototype,"req",2);y([d()],m.prototype,"preview",2);y([d()],m.prototype,"record",2);y([d()],m.prototype,"error",2);m=y([X("media-bulk-dialog")],m);var Ie=Object.defineProperty,je=Object.getOwnPropertyDescriptor,h=(e,t,s,r)=>{for(var i=r>1?void 0:r?je(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(i=(r?c(t,s,i):c(i))||i);return r&&i&&Ie(t,s,i),i};const T="/multimedia/screens",Ue={installation:J,personal:null,revision:0,can_edit:!1,can_personalize:!1},U=["s","m","l"];let l=class extends G{constructor(){super(...arguments),this.remoteKey="",this.phase="loading",this.devices=[],this.status=null,this.res=Ue,this.homeFloors=[],this.filters=z,this.compactHeader=!1,this.staleError="",this.toast="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.editing=!1,this.scope="all",this.draft=null,this.base=null,this.busy=!1,this.saveError="",this.conflict=!1,this.confirm=null,this.tabsMode=new Q(this,"multimedia"),this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offEdit=null,this.offPush=null,this.refreshTimer=0,this.pollTimer=0,this.toastTimer=0,this.qTimer=0,this.typing=0,this.wantsEdit=!1,this.editHandled=!1,this.pushedRemote=!1,this.loading=!1,this.homeFloorsLoaded=!1,this.fit=new ze(this,()=>this.renderRoot.querySelector(".scr"),()=>!this.editing),this.onScroll=()=>{const e=this.scrollTop;!this.compactHeader&&e>60?this.compactHeader=!0:this.compactHeader&&e<12&&(this.compactHeader=!1)},this.roomsDrag=e=>{if(e.pointerType!=="mouse"||e.button!==0)return;const t=e.currentTarget,s=e.clientX,r=t.scrollLeft;let i=!1;const o=n=>{Math.abs(n.clientX-s)>4&&(i=!0),i&&(t.classList.add("dragging"),t.scrollLeft=r-(n.clientX-s)*(getComputedStyle(t).direction==="rtl"?-1:1))},c=n=>{if(window.removeEventListener("pointermove",o),window.removeEventListener("pointerup",c),t.classList.remove("dragging"),i){n.preventDefault();const $=k=>k.stopImmediatePropagation();t.addEventListener("click",$,{capture:!0,once:!0}),window.setTimeout(()=>t.removeEventListener("click",$,{capture:!0}),0)}};window.addEventListener("pointermove",o),window.addEventListener("pointerup",c)}}connectedCallback(){super.connectedCallback(),ee(this),this.phoneMq.addEventListener("change",this.onPhone),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offEdit=te({id:"multimedia-layout",label:"עריכת מסך המולטימדיה",icon:"edit",can:()=>this.canEdit&&!this.editing,run:()=>this.enterEdit()}),this.offRoute=se(e=>{if(e.mode!=="multimedia"||(e.segments[1]??"screens")!=="screens")return;const t=Ee(e.params);this.filters=this.typing?{...t,q:this.filters.q}:t,this.wantsEdit=e.params.get("edit")==="1",this.wantsEdit||(this.editHandled=!1,this.editing&&this.leaveEdit(!1)),this.requestUpdate()}),this.load(),R()&&(this.offPush=ie(e=>{if(e.type==="media_state"){const t=this.devices.find(s=>s.key===e.device_key)?.live.power;this.devices=this.devices.map(s=>s.key===e.device_key?{...s,live:e.live}:s),t&&t!==e.live.power&&this.scheduleRefresh(800)}else e.type==="media_devices_changed"&&this.scheduleRefresh(200)},e=>{e&&this.scheduleRefresh(200)})),this.pollTimer=window.setInterval(()=>void this.load(),3e4)}disconnectedCallback(){super.disconnectedCallback(),F(this),this.phoneMq.removeEventListener("change",this.onPhone),this.removeEventListener("scroll",this.onScroll),this.offEdit?.(),this.offRoute?.(),this.offPush?.(),this.offEdit=this.offRoute=this.offPush=null;for(const e of[this.refreshTimer,this.pollTimer,this.toastTimer,this.qTimer])window.clearTimeout(e);window.clearInterval(this.pollTimer)}syncPair(){const e=this.filters,t=D(this.devices,e.floor);!this.editing&&this.phase==="ready"&&this.devices.length>0&&this.roomsAsDropdown(t.length+1)?ae(this,{group:"multimedia",label:"חדרים",value:e.area,items:[{id:"",label:"הכל",icon:"home"},{id:"--sep",label:"",divider:!0},...t.map(r=>({id:r.id,label:r.name,icon:"door"}))],onPick:r=>this.setFilters({area:r})}):F(this)}updated(){this.syncPair(),this.measureBar(),this.wantsEdit&&!this.editHandled&&this.phase==="ready"&&(this.editHandled=!0,this.editing||(this.canEdit?this.enterEdit(!0):this.dropParam("edit")))}measureBar(){const e=this.renderRoot.querySelector(".dh");if(!e)return;const t=e.getBoundingClientRect().top;let s=0;for(const i of e.querySelectorAll(":scope > .dh-row > *"))s=Math.max(s,i.getBoundingClientRect().bottom-t);const r=`${Math.ceil(s+(this.phone?8:10))}px`;s&&e.style.getPropertyValue("--mm-bar-h")!==r&&e.style.setProperty("--mm-bar-h",r)}get canEdit(){return this.phase==="ready"&&(this.res.can_edit||this.res.can_personalize)&&!re("layout_editor")}async load(){if(!this.loading){this.loading=!0;try{const e=await g().status();if(this.status=e,oe(e.counts),!e.enabled){this.phase="disabled";return}if(!e.can.read){this.phase="forbidden";return}const[t,s]=await Promise.allSettled([g().list(),q()]);if(t.status==="rejected")throw t.reason;this.devices=t.value.devices,s.status==="fulfilled"&&!this.editing&&(this.res=s.value),!this.homeFloorsLoaded&&!this.res.installation.floor_order.length&&await this.loadHomeFloors(),this.phase="ready",this.staleError=""}catch(e){e instanceof x&&e.status===403?this.phase="forbidden":e instanceof x&&e.code==="feature_disabled"?this.phase="disabled":this.phase==="ready"?this.staleError=w(e):(this.phase="error",this.staleError=w(e))}finally{this.loading=!1}}}async loadHomeFloors(){if(this.homeFloorsLoaded=!0,!R()){this.homeFloors=Te;return}try{this.homeFloors=(await ne()).floors.map(e=>e.floor_id).filter(e=>e!==E)}catch{this.homeFloors=[]}}display(){return Re(_e(this.res.installation,this.res.personal),this.homeFloors)}scheduleRefresh(e){window.clearTimeout(this.refreshTimer),this.refreshTimer=window.setTimeout(()=>void this.load(),e)}say(e){this.toast=e,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",3200)}params(){return new URLSearchParams(le().params)}dropParam(e){const t=this.params();t.delete(e),_(T,t)}setFilters(e,t=!0){this.filters={...this.filters,...e},e.floor!==void 0&&e.area===void 0&&this.filters.area&&!D(this.devices,this.filters.floor).some(r=>r.id===this.filters.area)&&(this.filters={...this.filters,area:""});const s=()=>_(T,A(this.filters,this.params()));window.clearTimeout(this.qTimer),t?s():this.qTimer=window.setTimeout(s,300)}onSearch(e){this.typing=Date.now(),this.setFilters({q:e},!1),window.setTimeout(()=>{Date.now()-this.typing>=900&&(this.typing=0)},950)}openRemote(e){const t=this.params();t.set("remote",e),this.pushedRemote=!0,de(T,t)}closeRemote(){this.pushedRemote?(this.pushedRemote=!1,window.history.back()):this.dropParam("remote"),this.scheduleRefresh(250)}enterEdit(e=!1){if(!(!this.canEdit||this.editing)){if(this.scope=this.res.can_edit?"all":"me",this.beginDraft(),this.editing=!0,this.editHandled=!0,this.filters=z,!e){const t=this.params();A(z,t),t.set("edit","1"),_(T,t)}this.scrollTo({top:0})}}beginDraft(){const e=De(this.scope,this.res.installation,this.res.personal,this.devices,this.homeFloors);this.draft=e,this.base=e,this.saveError="",this.conflict=!1}leaveEdit(e=!0){this.editing=!1,this.draft=this.base=null,this.confirm=null,this.busy=!1,this.editHandled=e?!1:this.editHandled,e&&this.dropParam("edit")}setScope(e){e!==this.scope&&(this.scope=e,this.beginDraft())}get dirty(){return!!this.draft&&!!this.base&&Se(this.base,this.draft)}askCancel(){this.dirty?this.confirm="cancel":this.leaveEdit()}async save(){if(!(!this.draft||this.busy)){this.busy=!0,this.saveError="";try{this.res=this.scope==="all"?await g().saveLayout(Pe(this.draft,this.devices,this.res.installation,this.homeFloors),this.res.revision):await C(Oe(this.res.installation,this.draft,this.devices)),this.leaveEdit(),this.say("נשמר")}catch(e){e instanceof x&&e.code==="revision_conflict"?this.conflict=!0:this.saveError=w(e),this.busy=!1}}}async resetLayout(){this.confirm=null,this.busy=!0;try{this.res=this.scope==="all"?await g().resetLayout():await C(null),this.leaveEdit(),this.say("חזר לברירת המחדל")}catch(e){this.saveError=w(e),this.busy=!1}}async reloadAfterConflict(){this.res=await q(),await this.load(),this.beginDraft()}patchDraft(e){this.draft=e}groupsToShow(){return this.editing&&this.draft?Fe(this.devices,this.draft):ce(Le(this.devices,this.filters),this.display(),this.phone)}floorOfGroup(e){const t=(this.editing&&this.draft?this.draft:this.display()).group_by;return e.id==="pinned"||e.id==="all"||e.id===E||e.id==="none"?null:{scope:t==="area"?"area":"floor",id:e.id}}chips(e,t,s,r){const i=this.draft,o=B(i,e.key),c=i.pinned.includes(e.key),n=e.name;return a`<span class="ecard" slot="edit">
      <button type="button" aria-label=${`הקדם · ${n}`} title="הקדם" ?disabled=${t===0} @click=${()=>this.patchDraft(H(i,this.devices,e.key,-1))}>${f("arrowUp")}</button>
      <button type="button" aria-label=${`אחר · ${n}`} title="אחר" ?disabled=${t===s-1} @click=${()=>this.patchDraft(H(i,this.devices,e.key,1))}>${f("arrowDown")}</button>
      <button type="button" aria-label=${`גודל · ${n}`} title="גודל" @click=${()=>this.patchDraft(M(i,e.key,{size:U[(U.indexOf(r)+1)%3]}))}>${r.toUpperCase()}</button>
      ${this.scope==="all"?a`<button type="button" aria-pressed=${String(c)} aria-label=${`מועדף · ${n}`} title="מועדף" @click=${()=>this.patchDraft(qe(i,e.key))}>${f("star")}</button>`:u}
      <button type="button" aria-label=${`${o.on?"הסתר":"הצג"} · ${n}`} title=${o.on?"הסתר":"הצג"} @click=${()=>this.patchDraft(M(i,e.key,{on:!o.on}))}>${f(o.on?"eye":"eyeOff")}</button>
    </span>`}card(e,t,s,r,i=!1){const o=this.editing&&!!this.draft,c=o&&!B(this.draft,e.key).on;return a`<media-screen-card class=${P({l:t==="l"})} data-fit-item ?data-off=${i} data-screen-card=${e.key} .device=${e} .size=${t} ?compact=${this.phone} ?editing=${o} ?data-dimmed=${c}
      @open-remote=${n=>this.openRemote(n.detail.key)} @media-changed=${()=>this.scheduleRefresh(R()?700:30)}>${o?this.chips(e,s,r,t):u}</media-screen-card>`}group(e,t=!1,s=0){const r=e.items.map(p=>p.device),i=p=>!this.fit.shows(s+p),o=e.items.every((p,v)=>i(v)),c=S(r),n=this.editing?null:this.floorOfGroup(e),$=this.devices.filter(p=>n?.scope==="area"?(p.area_id??"")===n.id:n?(p.floor_id??E)===n.id:!1),k=n&&!this.editing&&he($).length?a`<button type="button" class="btn sm quiet dz" data-bulk-off=${n.id} @click=${()=>this.bulk?.show({scope:n.scope,id:n.id,name:e.label})}>${f("power")}כבה מסכים</button>`:u,N=e.id==="pinned"||e.id==="all"||!n||this.editing?a`<h2>${j(b(e.label))}</h2>`:a`<h2><button type="button" class="shlink" data-group-open=${e.id} @click=${()=>this.setFilters(n.scope==="area"?{area:e.id}:{floor:e.id,area:""})}>${b(e.label)}${f("chevronBack")}</button></h2>`,O=r.filter(p=>pe(p.live)).length;return t&&!this.editing&&(e.id==="none"||e.id===E)&&!k?a`<section class="fsec" ?data-off=${o} aria-label=${e.label} data-group=${e.id}><div class="sgrid">${L(e.items,p=>p.device.key,(p,v)=>this.card(p.device,p.size,v,e.items.length,i(v)))}</div></section>`:a`<section class="fsec" ?data-off=${o} aria-label=${e.label} data-group=${e.id}>
      <header class="sh"><div>${N}<small><span class="n">${c.total}</span> ${c.total===1?"מסך":"מסכים"}${O?a` · <em><span class="n">${O}</span></em> פועלים`:u}</small></div><span class="grow"></span>${k}</header>
      <div class="sgrid">${L(e.items,p=>p.device.key,(p,v)=>this.card(p.device,p.size,v,e.items.length,i(v)))}</div>
    </section>`}roomsAsDropdown(e){const t=this.tabsMode.value;return t==="dropdown"||t==="hybrid"&&e>ue}summary(){if(this.phone||this.editing||this.phase!=="ready"||!this.devices.length)return"";const e=S(this.devices);return`${e.on} פועלים מתוך ${e.total}${e.un?` · ${e.un} לא זמין`:""}`}floorAction(){const e=I(this.devices,this.display()),t=e.length>1||!!this.filters.floor;return!this.editing&&this.phase==="ready"&&this.devices.length>0&&t?a`<div slot="actions" class="pacts">${this.floorChip(e)}</div>`:u}header(){const e=this.filters,t=D(this.devices,e.floor),s=S(this.devices);return!this.editing&&this.phase==="ready"&&this.devices.length>0?a`<div class=${P({dh:!0,compact:this.compactHeader})} data-mm-header>
      <div class="dh-row">
        ${this.roomsAsDropdown(t.length+1)?a`<span class="grow" data-rooms-in-shell></span>`:a`<div class="rooms" role="group" aria-label="חדרים" @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!e.area)} data-room="" @click=${()=>this.setFilters({area:""})}>הכל</button>
          ${t.map(i=>a`<button type="button" class="rc" aria-pressed=${String(e.area===i.id)} data-room=${i.id} @click=${()=>this.setFilters({area:i.id})}>${j(i.name)}</button>`)}
        </div>`}
      </div>
      <div class="dh-det">
        ${this.fit.pages>1?a`<sw-pager data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${i=>this.fit.go(i.detail.page)}></sw-pager>`:u}
        <div class="seg sm" role="radiogroup" aria-label="סינון לפי מצב">${Ae.map(i=>a`<button type="button" role="radio" aria-checked=${String(e.state===i.id)} data-state-filter=${i.id} @click=${()=>this.setFilters({state:i.id})}>${i.label}${i.id==="on"?a` <small>${s.on}</small>`:i.id==="un"&&s.un?a` <small>${s.un}</small>`:u}</button>`)}</div>
        <label class="search">${f("search")}<span class="vh">חיפוש מסך</span><input type="search" data-search placeholder="חיפוש מסך או חדר" .value=${e.q} @input=${i=>this.onSearch(i.target.value)} /></label>
      </div>
    </div>`:u}floorChip(e){const t=[{id:"",label:"כל הקומות",count:this.devices.length,icon:"home"},{id:"--sep",label:"",divider:!0},...e.map(s=>({id:s.id,label:s.name,count:s.count,icon:"layers"}))];return a`<div class="flwrap"><sw-dropdown data-floor-menu label="קומות" icon="layers" dd-style=${fe("multimedia")} dd-size=${me("multimedia")} dd-ring=${ve("multimedia")} dd-panel=${be("multimedia")} .items=${t} .value=${this.filters.floor} @change=${s=>this.setFilters({floor:s.detail.id,area:""})}></sw-dropdown></div>`}skeleton(){const e=a`<div class="glass" style="padding:10px 10px 14px;display:flex;flex-direction:column;gap:12px"><span class="skl" style="aspect-ratio:16/6.3;border-radius:var(--sw-r-lg)"></span><div style="display:flex;align-items:center;gap:12px;padding-inline:6px"><div style="flex:1;display:flex;flex-direction:column;gap:8px"><span class="skl" style="block-size:16px;inline-size:55%"></span><span class="skl" style="block-size:12px;inline-size:35%"></span></div><span class="skl" style="inline-size:44px;block-size:44px;border-radius:50%"></span></div><span class="skl" style="block-size:40px;border-radius:var(--sw-r-pill);margin-inline:6px"></span></div>`;return a`<div data-mm-state="loading" aria-busy="true"><div class="sgrid">${Array.from({length:this.phone?3:6},()=>e)}</div></div>`}stateBox(e,t,s){return a`<div class="statebox glass" role="status"><span class="ring">${f(e)}</span><b>${t}</b>${s??u}</div>`}editBar(){const e=this.res.can_edit&&this.res.can_personalize;return a`<div class="editbar" data-mm-editbar>
      <span class="t">${f("edit")}עריכת מסך המולטימדיה</span>
      ${e?a`<div class="seg sm" role="radiogroup" aria-label="עבור מי">
        <button type="button" role="radio" aria-checked=${String(this.scope==="all")} data-scope="all" @click=${()=>this.setScope("all")}>לכולם</button>
        <button type="button" role="radio" aria-checked=${String(this.scope==="me")} data-scope="me" @click=${()=>this.setScope("me")}>רק אני</button></div>`:u}
      <span class="grow"></span>
      ${this.conflict?a`<span class="note-bad" role="alert">המסך נערך במקום אחר</span><button type="button" class="btn sm" @click=${()=>void this.reloadAfterConflict()}>טען מחדש</button>`:u}
      ${this.saveError?a`<span class="note-bad" role="alert">${this.saveError}</span>`:u}
      <button type="button" class="btn sm quiet" data-mm-cancel ?disabled=${this.busy} @click=${()=>this.askCancel()}>ביטול</button>
      <button type="button" class="btn sm quiet dz" data-mm-reset ?disabled=${this.busy} @click=${()=>this.confirm="reset"}>ברירת מחדל</button>
      <button type="button" class="btn sm primary" data-mm-save ?disabled=${this.busy||!this.dirty||this.conflict} @click=${()=>void this.save()}>${f("check")}שמור</button>
    </div>`}confirmDialog(){const e=this.confirm;if(!e)return a`<sw-dialog data-mm-confirm="closed"></sw-dialog>`;const t=e==="reset",s=t?this.scope==="all"?"להחזיר את המסך לברירת המחדל לכולם?":"להחזיר את המסך שלי לברירת המחדל?":"לבטל את השינויים?";return a`<sw-dialog open heading=${s} data-mm-confirm=${e} @close=${()=>this.confirm=null}>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-mm-confirm-no autofocus @click=${()=>this.confirm=null}>${t?"ביטול":"המשך עריכה"}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${()=>t?void this.resetLayout():this.leaveEdit()}>${t?"החזר":"בטל שינויים"}</sw-button>
      </div></sw-dialog>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return a`<div data-mm-state="error">${this.stateBox("warning","לא ניתן לטעון את המסכים",a`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${f("refresh")}נסה שוב</button>`)}</div>`;if(this.phase==="forbidden")return a`<div data-mm-state="forbidden">${this.stateBox("tv","אין הרשאת צפייה במסכים")}</div>`;if(this.phase==="disabled")return a`<div data-mm-state="disabled">${this.stateBox("power","המולטימדיה כבויה")}</div>`;if(!this.devices.length){const i=this.status?.can.configure;return a`<div data-mm-state="empty">${this.stateBox("tv","אין מסכים",i?a`<a class="btn sm" href="#/system/multimedia">להגדרות</a>`:void 0)}</div>`}const e=this.groupsToShow(),t=this.staleError?a`<div class="errbar" role="alert" data-mm-stale>${f("warning")}הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.<button type="button" class="btn sm" @click=${()=>void this.load()}>נסה שוב</button></div>`:u;if(!e.length)return a`${t}<div data-mm-state="filtered">${this.stateBox("search","לא נמצאו מסכים",Ce(this.filters)?a`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.setFilters(z)}>נקה סינון</button>`:void 0)}</div>`;let s=0;const r=e.map(i=>(s+=i.items.length,s-i.items.length));return this.fit.sync(s,`${e.map(i=>`${i.id}:${i.items.map(o=>`${o.device.key}/${o.size}`).join(",")}`).join("|")}|${this.phone}`),a`${t}<div class="groups" data-mm-state="ready">${e.map((i,o)=>this.group(i,e.length===1,r[o]))}</div>`}willUpdate(){this.toggleAttribute("data-fit",this.fit.on)}render(){const e=this.body();return a`<sw-page class="page" wide heading="מסכים" subheading=${this.summary()} data-screen="multimedia">
      ${this.floorAction()}
      ${this.header()}
      ${this.editing&&this.draft?a`<div class="editing-stack">${this.editBar()}</div>
          <div class="edit-layout"><multimedia-edit-panel class="edit-side" .draft=${this.draft} .devices=${this.devices} .scope=${this.scope} .floors=${I(this.devices,this.draft)} @layout-draft=${t=>this.patchDraft(t.detail)}></multimedia-edit-panel><div class="edit-cards">${e}</div></div>`:a`<div class="scr" data-mm-region>${e}</div>`}
    </sw-page>
    <media-bulk-dialog @bulk-done=${()=>void this.load()}></media-bulk-dialog>
    ${this.confirmDialog()}
    ${this.remoteKey?a`<media-remote .deviceKey=${this.remoteKey} .open=${!0} @close=${()=>this.closeRemote()}></media-remote>`:u}
    ${this.toast?a`<div class="toast" role="status" ${ge()}>${f("check")}${this.toast}</div>`:u}`}};l.styles=[we,ke,ye,K`
    :host {
      display: block;
      position: relative;
      overflow: auto;
      scrollbar-width: thin;
      background: var(--dv-page-backdrop);
      color: var(--dv-text);
      font-family: var(--dv-font);
      font-size: var(--sw-fs-md);
      line-height: 1.5;
    }
     sourceMappingURL=[^*]**/ AUDIT30-D3 (audit round 30 #6): the page frame is the shared <sw-page class="page" wide> - the title, the one-line summary under
       it and the floor menu at the end of the title row come from it (its padding is --sw-page-pad; --mm-pad mirrors it for the
       edge-to-edge bars below). Below it, the filter bar (.dh) and the cards. */
    .page {
      --mm-pad: var(--sw-page-pad);
    }
     sourceMappingURL=[^*]**/ the filter bar: the room chips, the pager, the state filter, the search; it sticks and compacts while the page scrolls */
    .dh {
      position: sticky;
      inset-block-start: 0;
      z-index: 15;
      margin-inline: calc(-1 * var(--mm-pad));
      padding: var(--sw-s-1) var(--mm-pad);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2) var(--sw-s-3);
    }
     sourceMappingURL=[^*]**/ Compacting is purely visual: it never changes the header's height in the flow. A header that shrank at scrollTop ~60
       moved every card under the finger (and, with the scroll clamped, fell back under the threshold and expanded again: the
       list jumped back and forth on a phone). The bar is a layer of the measured height of the title row; what folds away
       fades out in place and stops taking taps, and the cards slide under the transparent rest. */
    .dh::before {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      block-size: var(--mm-bar-h, 64px);
      z-index: -1;
      opacity: 0;
      pointer-events: none;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border-block-end: 1px solid var(--dv-border);
      box-shadow: var(--dv-shadow-1);
      transition: opacity var(--mm-motion) var(--mm-ease);
    }
    .dh.compact {
      pointer-events: none;
    }
    .dh.compact::before {
      opacity: 1;
      pointer-events: auto;
    }
    .dh.compact .dh-row > * {
      pointer-events: auto;
    }
    .dh-row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      flex: 1 1 320px;
      min-inline-size: 0;
    }
     sourceMappingURL=[^*]**/ the bar is not the page's first row any more (sw-page's title row is, and it keeps the shell's lead reserve itself) */
    :host .page .dh .dh-row {
      padding-inline-start: 0;
    }
    .rooms {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
      padding: 6px 18px;
       sourceMappingURL=[^*]**/ the first chip lines up with the title above: the fade's room hangs outside the text edge */
      margin-inline-start: -18px;
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 18px, #000 calc(100% - 18px), transparent);
      mask-image: linear-gradient(90deg, transparent, #000 18px, #000 calc(100% - 18px), transparent);
      user-select: none;
      touch-action: pan-x;
    }
    .rooms::-webkit-scrollbar {
      display: none;
    }
    .rooms.dragging {
      cursor: grabbing;
    }
    .rc {
      flex: none;
       sourceMappingURL=[^*]**/ AUDIT30-D1: the chip is a control of the shared height (34 in the classic skin; 44 on touch below) */
      block-size: var(--sw-ctl-h-md);
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      font-size: var(--sw-fs-md);
      font-weight: 500;
      color: var(--dv-text-2);
      white-space: nowrap;
      transition: background var(--mm-motion), color var(--mm-motion), transform var(--sw-t-press) var(--sw-ease-out);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
     sourceMappingURL=[^*]**/ R5-MEDIA-ENERGY-297 (mobile-native): hover only under a pointer that hovers; the chip sinks on pointer-down */
    @media (hover: hover) and (pointer: fine) {
      .rc:hover {
        color: var(--dv-text);
        background: var(--dv-surface);
      }
    }
    .rc:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
     sourceMappingURL=[^*]**/ AUDIT30-D1 (audit round 30 #4, owner question 3 answer a): the chosen room is the product's one selected look - the soft accent
       fill with the accent ink (Blue Wash), no border, no shadow; it was a black pill (--dv-text fill) */
    .rc[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: transparent;
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: none;
    }
    .rc:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .flwrap {
      position: relative;
      flex: none;
    }
    .pacts {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    .dh-det {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      transition: opacity var(--mm-motion), visibility var(--mm-motion);
    }
    .dh-det {
      flex: 0 1 auto;
      min-inline-size: 0;
    }
    .dh.compact .dh-det {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      block-size: 38px;
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      min-inline-size: 240px;
      color: var(--dv-text-2);
    }
    .search:focus-within {
      outline: 2px solid var(--dv-focus);
      outline-offset: 1px;
    }
    .search input {
      border: 0;
      background: transparent;
      outline: none;
      flex: 1;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      color: var(--dv-text);
    }
    .search input::placeholder {
      color: var(--dv-text-2);
    }
    .search .ic {
      font-size: var(--sw-fs-lg);
    }
     sourceMappingURL=[^*]**/ groups and the grid */
    .groups {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    .fsec {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .sh {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      padding-inline: 4px;
    }
     sourceMappingURL=[^*]**/ AUDIT30-D2 (audit round 30 #17): the floor heading sits one tier under the page title (the 26-30 px / 800 heading competed
       with the title, so the screen read as having several); it is the section step of the scale, semibold */
    .sh h2 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
      letter-spacing: -0.01em;
      line-height: 1.2;
      color: var(--sw-heading, var(--dv-text));
    }
    .shlink {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border-radius: var(--sw-r-sm);
      min-block-size: 28px;
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    .shlink .ic {
      font-size: var(--sw-fs-2xl);
      color: var(--dv-text-3);
      transition: transform var(--mm-motion) var(--mm-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      .shlink:hover .ic {
        transform: translateX(-3px);
        color: var(--dv-text-2);
      }
    }
    .shlink:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
     sourceMappingURL=[^*]**/ POLISH4-WP5: the floor link sinks on pointer-down like the chips and keys do */
    .shlink:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    .sh small {
      display: block;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      margin-block-start: 1px;
    }
    .sh small em {
      font-style: normal;
      color: var(--dv-text);
      font-weight: 600;
    }
    .sgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
      gap: var(--dv-gap-lg);
      align-items: start;
    }
    .sgrid > .l {
      grid-column: span 2;
    }
     sourceMappingURL=[^*]**/ edit chips on a card */
    .ecard {
      position: absolute;
      inset-block-start: 18px;
      inset-inline-end: 18px;
      display: flex;
      gap: 2px;
      padding: 3px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-perf-glass-bg, var(--mm-sheet-surface));
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(16px));
      backdrop-filter: var(--sw-perf-blur, blur(16px));
      box-shadow: var(--dv-shadow-control);
      border: 1px solid var(--dv-border);
    }
    .ecard button {
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      display: grid;
      place-items: center;
      color: var(--dv-text);
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      transition: background var(--mm-motion), transform var(--sw-t-press) var(--sw-ease-out);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .ecard button:hover {
        background: var(--dv-surface-3);
      }
    }
    .ecard button:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    .ecard button[aria-pressed='true'] {
      color: var(--dv-accent-text);
      background: var(--dv-accent-soft);
    }
    .ecard button[disabled] {
      opacity: 0.35;
    }
    .ecard .ic {
      font-size: var(--sw-fs-lg);
    }
     sourceMappingURL=[^*]**/ the confirmation dialogs carry the sheet material (a translucent glass panel over a dimmed page reads as washed out) */
    media-bulk-dialog,
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .editing-stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .edit-layout {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    @media (min-width: 1100px) {
      .edit-layout {
        display: grid;
        grid-template-columns: minmax(340px, 400px) minmax(0, 1fr);
        gap: 24px;
        align-items: start;
      }
      .edit-side {
        position: sticky;
        inset-block-start: 76px;
        max-block-size: calc(100dvh - 96px);
        overflow: auto;
        scrollbar-width: thin;
      }
    }
    .note-bad {
      color: var(--dv-danger);
      font-size: var(--sw-fs-base);
      font-weight: 600;
    }
    .toast {
      position: fixed;
      z-index: 90;
      inset-inline: 0;
      margin-inline: auto;
      inline-size: max-content;
      max-inline-size: calc(100% - 24px);
      inset-block-end: 26px;
      background: var(--sw-toast-bg);
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(20px));
      backdrop-filter: var(--sw-perf-blur, blur(20px));
      color: var(--sw-toast-text);
      padding: 11px 20px 11px 16px;
      border-radius: var(--sw-r-pill);
      border: 1px solid color-mix(in srgb, var(--sw-toast-text) 12%, transparent);
      font-size: var(--sw-fs-base);
      font-weight: 500;
      box-shadow: var(--sw-shadow-3);
      display: flex;
      gap: 9px;
      align-items: center;
      animation: mm-pop var(--mm-motion) var(--mm-ease);
    }
    .toast .ic {
      color: var(--sw-success);
      font-size: var(--sw-fs-lg);
    }
    @media (pointer: coarse), (max-width: 767px) {
      .rc,
      .search {
        block-size: 44px;
      }
      .ecard button {
        inline-size: 44px;
        block-size: 44px;
      }
      .shlink {
        min-block-size: 44px;
        margin-block: -8px;  sourceMappingURL=[^*]**/ the hit area grows, the heading row does not */
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .dh::before,
      .shlink .ic,
      .dh-det {
        transition: none;
      }
    }
    @media (max-width: 767px) {
       sourceMappingURL=[^*]**/ sw-page's phone padding */
      .page {
        --mm-pad: var(--sw-s-3);
      }
      .dh {
        flex-direction: column;
        align-items: stretch;
        flex-wrap: nowrap;
      }
       sourceMappingURL=[^*]**/ stuck at the top, the room row is what stays: it keeps clear of the shell's floating search / status corner */
      .dh-row {
        flex: none;
        padding-inline-end: var(--sw-float-reserve, 0px);
      }
      .dh-row .rooms {
        margin-inline: calc(-1 * var(--mm-pad));
        padding-inline: var(--mm-pad);
      }
      .dh-det .seg {
        overflow-x: auto;
        scrollbar-width: none;
      }
      .search {
        min-inline-size: 0;
        flex: 1 1 100%;
      }
      .sgrid {
        grid-template-columns: minmax(0, 1fr);
      }
      .sgrid > .l {
        grid-column: auto;
      }
      .toast {
        inset-block-end: calc(var(--sw-bottomnav-h) + 14px);
      }
      .groups {
        gap: 22px;
      }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .sgrid > .l {
        grid-column: auto;
      }
    }
     sourceMappingURL=[^*]**/ NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30 #5, 549 px at 1366x768). Below 1024 px wide - or on a
       window too short for the header and a row of cards - the region is transparent and the page scrolls as before. From 1024 x 560
       (outside the layout editor) the page takes the screen's height, the header stays and the cards region never scrolls: the cards
       that fit are page 1, the rest are on the next pages (the pager in the filter row). */
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
         sourceMappingURL=[^*]**/ the region spans the page's side padding, so a card's shadow and focus ring are never cut at the sides */
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
    }
  `];h([xe()],l.prototype,"remoteKey",2);h([d()],l.prototype,"phase",2);h([d()],l.prototype,"devices",2);h([d()],l.prototype,"status",2);h([d()],l.prototype,"res",2);h([d()],l.prototype,"homeFloors",2);h([d()],l.prototype,"filters",2);h([d()],l.prototype,"compactHeader",2);h([d()],l.prototype,"staleError",2);h([d()],l.prototype,"toast",2);h([d()],l.prototype,"phone",2);h([d()],l.prototype,"editing",2);h([d()],l.prototype,"scope",2);h([d()],l.prototype,"draft",2);h([d()],l.prototype,"base",2);h([d()],l.prototype,"busy",2);h([d()],l.prototype,"saveError",2);h([d()],l.prototype,"conflict",2);h([d()],l.prototype,"confirm",2);h([$e("media-bulk-dialog")],l.prototype,"bulk",2);l=h([X("multimedia-screens")],l);export{l as MultimediaScreens};
