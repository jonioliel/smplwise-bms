import{E as K,G as c,a as N,e4 as g,j as x,Y as w,$ as X,i as _,X as V,e9 as W,e as i,q as b,eb as Z,A as p,ed as P,H as U,j1 as J,e3 as Q,hd as ee,f5 as te,cy as se,av as ie,j2 as O,j3 as ae,ce as re,j4 as oe,cB as ne,bj as le,r as T,c$ as de,j5 as ce,e7 as he,he as pe,ct as F,j6 as ue,j7 as fe,j8 as me,j9 as ve,ja as be,dl as ge,hb as we,dm as ye,F as xe,ca as $e}from"./index-k1cto_iv.js";import{l as ke}from"./lead-reserve-B7tEZi0k.js";import"./media-screen-card-DfJt6Q8e.js";import"./sw-pager-syP9MpoI.js";import{P as Ee}from"./multimedia-page-fit-aNuqF9pe.js";import{N as E,f as ze,r as S,l as L,D as Re,a as z,w as _e,e as Te,b as C,s as Se,i as Pe,c as De,d as q,p as Oe,g as Fe,h as Le,j as A,m as j,k as M,t as Ce,n as H,o as B,S as qe,q as Ae}from"./media-personal-C6GLgYYW.js";import{m as f,n as I}from"./media-now-C0pZ-8dG.js";import"./sw-logo-art-Va6y_cIM.js";var je=Object.defineProperty,Me=Object.getOwnPropertyDescriptor,y=(e,t,s,a)=>{for(var r=a>1?void 0:a?Me(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&je(t,s,r),r};const He={already_off:"כבוי כבר",not_confirmed:"לא אושר שהוא דולק",unavailable:"לא זמין",not_allowed:"אין הרשאה"};let m=class extends N{constructor(){super(...arguments),this.phase="closed",this.req=null,this.preview=null,this.record=null,this.error="",this.follow=null,this.close=()=>{this.phase!=="sending"&&(this.phase="closed")}}async show(e){if(!(this.phase==="sending"||this.phase==="running")){this.req=e,this.preview=null,this.record=null,this.error="",this.phase="loading";try{const t=await g().bulkPreview(e.scope,e.id);if(this.req!==e)return;this.preview=t,this.phase=t.counts.send?"confirm":"nothing"}catch(t){if(this.req!==e)return;this.error=t instanceof x&&t.status===403?"אין לך הרשאה לכיבוי מרוכז כאן.":w(t),this.phase="error"}}}async confirm(){const e=this.req,t=this.preview;if(!(!e||!t||this.phase!=="confirm")){this.phase="sending";try{const s=await g().bulkRun(e.scope,e.id,X(),new Date(Date.now()+15e3).toISOString());this.phase="running",_()&&(this.follow={stopped:!1},this.record=await V(await W(s.bulk_id),a=>this.record=a,this.follow)),this.phase="result",this.dispatchEvent(new CustomEvent("bulk-done",{detail:this.record,bubbles:!0,composed:!0}))}catch(s){this.error=s instanceof x&&s.code==="target_changed"?"רשימת המסכים השתנתה; לא נשלח דבר. פתחו מחדש.":w(s),this.phase="error",this.dispatchEvent(new CustomEvent("bulk-done",{detail:null,bubbles:!0,composed:!0}))}}}disconnectedCallback(){super.disconnectedCallback(),this.follow&&(this.follow.stopped=!0)}updated(e){!e.has("phase")||this.phase==="closed"||this.phase==="sending"||this.phase==="running"||requestAnimationFrame(()=>{const t=this.renderRoot.querySelector("sw-button[data-bulk-cancel]");(t?.shadowRoot?.querySelector("button")??t)?.focus({preventScroll:!0})})}render(){const e=this.req;if(this.phase==="closed"||!e)return i`<sw-dialog data-media-bulk="closed"></sw-dialog>`;const t=this.preview,s=this.phase==="confirm"&&t?`לכבות ${t.counts.send===1?"מסך אחד":`${t.counts.send} מסכים`} ב${b(e.name)}?`:`כיבוי מסכים · ${b(e.name)}`;return i`<sw-dialog open ?locked=${this.phase==="sending"} data-media-bulk=${this.phase} heading=${s} @close=${this.close}>${this.body()}</sw-dialog>`}cancel(e="ביטול"){return i`<sw-button data-bulk-cancel autofocus @click=${this.close}>${e}</sw-button>`}body(){const e=this.preview;if(this.phase==="loading")return i`<div class="muted">בודק…</div><div class="actions">${this.cancel()}</div>`;if(this.phase==="error")return i`<div class="err" data-bulk-error>${this.error}</div><div class="actions">${this.cancel("סגור")}</div>`;if(this.phase==="nothing"&&e)return i`<div class="what" data-bulk-nothing><div>אין מסך דולק שאושר לכיבוי.</div>${this.details(e)}</div><div class="actions">${this.cancel("סגור")}</div>`;if(this.phase==="confirm"&&e)return i`<div class="what" data-bulk-what>${this.details(e)}</div>
        <div class="actions">${this.cancel()}<sw-button data-bulk-confirm variant="danger" @click=${()=>void this.confirm()}>כבה (${e.counts.send})</sw-button></div>`;const t=this.record;if(this.phase==="sending"||!t&&this.phase==="running")return i`<div class="muted" data-bulk-progress>שולח…</div>`;if(!t)return i`<div class="what" data-bulk-result="ok"><div class="headline ok"><sw-icon name="check" size="16"></sw-icon>בוצע</div></div><div class="actions">${this.cancel("סגור")}</div>`;const s=Z(t),a=t.counts,r=a.total?Math.round(a.confirmed/a.total*100):0,n=t.items.filter(o=>o.outcome!=="confirmed");return i`<div class="what" data-bulk-progress data-confirmed=${a.confirmed} data-total=${a.total}>
        <div class=${P({headline:!0,[s.tone]:!0})} data-bulk-result=${t.done?s.tone:"running"}>${t.done?i`<sw-icon .name=${s.tone==="ok"?"check":"warning"} size="16"></sw-icon>`:p}${s.text}</div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax=${a.total} aria-valuenow=${a.confirmed} aria-label="אושרו"><div style=${`inline-size:${r}%`}></div></div>
        ${t.done&&n.length?i`<ul>${n.map(o=>i`<li>${b(o.name)}<span class="tag">לא אושר</span></li>`)}</ul>`:p}
      </div>
      <div class="actions">${this.cancel("סגור")}</div>`}details(e){const t=e.devices.filter(a=>a.will==="off"),s=e.devices.filter(a=>a.will==="skip");return i`<details data-bulk-details><summary>פרטים</summary>
      ${t.length?i`<ul>${t.map(a=>i`<li>${b(a.name)}</li>`)}</ul>`:p}
      ${s.length?i`<div class="muted">לא נכללו:</div><ul>${s.map(a=>i`<li>${b(a.name)}<span class="tag">${a.reason?He[a.reason]??a.reason:""}</span></li>`)}</ul>`:p}
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
      border-radius: 999px;
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
  `;y([c()],m.prototype,"phase",2);y([c()],m.prototype,"req",2);y([c()],m.prototype,"preview",2);y([c()],m.prototype,"record",2);y([c()],m.prototype,"error",2);m=y([U("media-bulk-dialog")],m);var Be=Object.defineProperty,Ie=Object.getOwnPropertyDescriptor,h=(e,t,s,a)=>{for(var r=a>1?void 0:a?Ie(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(r=(a?o(t,s,r):o(r))||r);return a&&r&&Be(t,s,r),r};const R="/multimedia/screens",Ge={installation:J,personal:null,revision:0,can_edit:!1,can_personalize:!1},G=["s","m","l"];let d=class extends N{constructor(){super(...arguments),this.remoteKey="",this.phase="loading",this.devices=[],this.status=null,this.res=Ge,this.homeFloors=[],this.filters=E,this.compactHeader=!1,this.staleError="",this.toast="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.editing=!1,this.scope="all",this.draft=null,this.base=null,this.busy=!1,this.saveError="",this.conflict=!1,this.confirm=null,this.tabsMode=new Q(this,"multimedia"),this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offEdit=null,this.offPush=null,this.refreshTimer=0,this.pollTimer=0,this.toastTimer=0,this.qTimer=0,this.typing=0,this.wantsEdit=!1,this.editHandled=!1,this.pushedRemote=!1,this.loading=!1,this.homeFloorsLoaded=!1,this.fit=new Ee(this,()=>this.renderRoot.querySelector(".scr"),()=>!this.editing),this.onScroll=()=>{const e=this.scrollTop;!this.compactHeader&&e>60?this.compactHeader=!0:this.compactHeader&&e<12&&(this.compactHeader=!1)},this.roomsDrag=e=>{if(e.pointerType!=="mouse"||e.button!==0)return;const t=e.currentTarget,s=e.clientX,a=t.scrollLeft;let r=!1;const n=l=>{Math.abs(l.clientX-s)>4&&(r=!0),r&&(t.classList.add("dragging"),t.scrollLeft=a-(l.clientX-s)*(getComputedStyle(t).direction==="rtl"?-1:1))},o=l=>{if(window.removeEventListener("pointermove",n),window.removeEventListener("pointerup",o),t.classList.remove("dragging"),r){l.preventDefault();const $=k=>k.stopImmediatePropagation();t.addEventListener("click",$,{capture:!0,once:!0}),window.setTimeout(()=>t.removeEventListener("click",$,{capture:!0}),0)}};window.addEventListener("pointermove",n),window.addEventListener("pointerup",o)}}connectedCallback(){super.connectedCallback(),ee(this),this.phoneMq.addEventListener("change",this.onPhone),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offEdit=te({id:"multimedia-layout",label:"עריכת מסך המולטימדיה",icon:"edit",can:()=>this.canEdit&&!this.editing,run:()=>this.enterEdit()}),this.offRoute=se(e=>{if(e.mode!=="multimedia"||(e.segments[1]??"screens")!=="screens")return;const t=ze(e.params);this.filters=this.typing?{...t,q:this.filters.q}:t,this.wantsEdit=e.params.get("edit")==="1",this.wantsEdit||(this.editHandled=!1,this.editing&&this.leaveEdit(!1)),this.requestUpdate()}),this.load(),_()&&(this.offPush=ie(e=>{if(e.type==="media_state"){const t=this.devices.find(s=>s.key===e.device_key)?.live.power;this.devices=this.devices.map(s=>s.key===e.device_key?{...s,live:e.live}:s),t&&t!==e.live.power&&this.scheduleRefresh(800)}else e.type==="media_devices_changed"&&this.scheduleRefresh(200)},e=>{e&&this.scheduleRefresh(200)})),this.pollTimer=window.setInterval(()=>void this.load(),3e4)}disconnectedCallback(){super.disconnectedCallback(),O(this),this.phoneMq.removeEventListener("change",this.onPhone),this.removeEventListener("scroll",this.onScroll),this.offEdit?.(),this.offRoute?.(),this.offPush?.(),this.offEdit=this.offRoute=this.offPush=null;for(const e of[this.refreshTimer,this.pollTimer,this.toastTimer,this.qTimer])window.clearTimeout(e);window.clearInterval(this.pollTimer)}syncPair(){const e=this.filters,t=S(this.devices,e.floor);!this.editing&&this.phase==="ready"&&this.devices.length>0&&this.roomsAsDropdown(t.length+1)?ae(this,{group:"multimedia",label:"חדרים",value:e.area,items:[{id:"",label:"הכל",icon:"home"},{id:"--sep",label:"",divider:!0},...t.map(a=>({id:a.id,label:a.name,icon:"door"}))],onPick:a=>this.setFilters({area:a})}):O(this)}updated(){this.syncPair(),this.measureBar(),this.wantsEdit&&!this.editHandled&&this.phase==="ready"&&(this.editHandled=!0,this.editing||(this.canEdit?this.enterEdit(!0):this.dropParam("edit")))}measureBar(){const e=this.renderRoot.querySelector(".dh");if(!e)return;const t=e.getBoundingClientRect().top;let s=0;for(const r of e.querySelectorAll(this.phone?":scope > .dh-row > h1, :scope > .dh-row > .flwrap":":scope > .dh-row > *"))s=Math.max(s,r.getBoundingClientRect().bottom-t);const a=`${Math.ceil(s+(this.phone?8:10))}px`;s&&e.style.getPropertyValue("--mm-bar-h")!==a&&e.style.setProperty("--mm-bar-h",a)}get canEdit(){return this.phase==="ready"&&(this.res.can_edit||this.res.can_personalize)&&!re("layout_editor")}async load(){if(!this.loading){this.loading=!0;try{const e=await g().status();if(this.status=e,oe(e.counts),!e.enabled){this.phase="disabled";return}if(!e.can.read){this.phase="forbidden";return}const[t,s]=await Promise.allSettled([g().list(),L()]);if(t.status==="rejected")throw t.reason;this.devices=t.value.devices,s.status==="fulfilled"&&!this.editing&&(this.res=s.value),!this.homeFloorsLoaded&&!this.res.installation.floor_order.length&&await this.loadHomeFloors(),this.phase="ready",this.staleError=""}catch(e){e instanceof x&&e.status===403?this.phase="forbidden":e instanceof x&&e.code==="feature_disabled"?this.phase="disabled":this.phase==="ready"?this.staleError=w(e):(this.phase="error",this.staleError=w(e))}finally{this.loading=!1}}}async loadHomeFloors(){if(this.homeFloorsLoaded=!0,!_()){this.homeFloors=Re;return}try{this.homeFloors=(await ne()).floors.map(e=>e.floor_id).filter(e=>e!==z)}catch{this.homeFloors=[]}}display(){return _e(Te(this.res.installation,this.res.personal),this.homeFloors)}scheduleRefresh(e){window.clearTimeout(this.refreshTimer),this.refreshTimer=window.setTimeout(()=>void this.load(),e)}say(e){this.toast=e,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",3200)}params(){return new URLSearchParams(le().params)}dropParam(e){const t=this.params();t.delete(e),T(R,t)}setFilters(e,t=!0){this.filters={...this.filters,...e},e.floor!==void 0&&e.area===void 0&&this.filters.area&&!S(this.devices,this.filters.floor).some(a=>a.id===this.filters.area)&&(this.filters={...this.filters,area:""});const s=()=>T(R,C(this.filters,this.params()));window.clearTimeout(this.qTimer),t?s():this.qTimer=window.setTimeout(s,300)}onSearch(e){this.typing=Date.now(),this.setFilters({q:e},!1),window.setTimeout(()=>{Date.now()-this.typing>=900&&(this.typing=0)},950)}openRemote(e){const t=this.params();t.set("remote",e),this.pushedRemote=!0,de(R,t)}closeRemote(){this.pushedRemote?(this.pushedRemote=!1,window.history.back()):this.dropParam("remote"),this.scheduleRefresh(250)}enterEdit(e=!1){if(!(!this.canEdit||this.editing)){if(this.scope=this.res.can_edit?"all":"me",this.beginDraft(),this.editing=!0,this.editHandled=!0,this.filters=E,!e){const t=this.params();C(E,t),t.set("edit","1"),T(R,t)}this.scrollTo({top:0})}}beginDraft(){const e=Se(this.scope,this.res.installation,this.res.personal,this.devices,this.homeFloors);this.draft=e,this.base=e,this.saveError="",this.conflict=!1}leaveEdit(e=!0){this.editing=!1,this.draft=this.base=null,this.confirm=null,this.busy=!1,this.editHandled=e?!1:this.editHandled,e&&this.dropParam("edit")}setScope(e){e!==this.scope&&(this.scope=e,this.beginDraft())}get dirty(){return!!this.draft&&!!this.base&&Pe(this.base,this.draft)}askCancel(){this.dirty?this.confirm="cancel":this.leaveEdit()}async save(){if(!(!this.draft||this.busy)){this.busy=!0,this.saveError="";try{this.res=this.scope==="all"?await g().saveLayout(De(this.draft,this.devices,this.res.installation,this.homeFloors),this.res.revision):await q(Oe(this.res.installation,this.draft,this.devices)),this.leaveEdit(),this.say("נשמר")}catch(e){e instanceof x&&e.code==="revision_conflict"?this.conflict=!0:this.saveError=w(e),this.busy=!1}}}async resetLayout(){this.confirm=null,this.busy=!0;try{this.res=this.scope==="all"?await g().resetLayout():await q(null),this.leaveEdit(),this.say("חזר לברירת המחדל")}catch(e){this.saveError=w(e),this.busy=!1}}async reloadAfterConflict(){this.res=await L(),await this.load(),this.beginDraft()}patchDraft(e){this.draft=e}groupsToShow(){return this.editing&&this.draft?Fe(this.devices,this.draft):ce(Le(this.devices,this.filters),this.display(),this.phone)}floorOfGroup(e){const t=(this.editing&&this.draft?this.draft:this.display()).group_by;return e.id==="pinned"||e.id==="all"||e.id===z||e.id==="none"?null:{scope:t==="area"?"area":"floor",id:e.id}}chips(e,t,s,a){const r=this.draft,n=A(r,e.key),o=r.pinned.includes(e.key),l=e.name;return i`<span class="ecard" slot="edit">
      <button type="button" aria-label=${`הקדם · ${l}`} title="הקדם" ?disabled=${t===0} @click=${()=>this.patchDraft(j(r,this.devices,e.key,-1))}>${f("arrowUp")}</button>
      <button type="button" aria-label=${`אחר · ${l}`} title="אחר" ?disabled=${t===s-1} @click=${()=>this.patchDraft(j(r,this.devices,e.key,1))}>${f("arrowDown")}</button>
      <button type="button" aria-label=${`גודל · ${l}`} title="גודל" @click=${()=>this.patchDraft(M(r,e.key,{size:G[(G.indexOf(a)+1)%3]}))}>${a.toUpperCase()}</button>
      ${this.scope==="all"?i`<button type="button" aria-pressed=${String(o)} aria-label=${`מועדף · ${l}`} title="מועדף" @click=${()=>this.patchDraft(Ce(r,e.key))}>${f("star")}</button>`:p}
      <button type="button" aria-label=${`${n.on?"הסתר":"הצג"} · ${l}`} title=${n.on?"הסתר":"הצג"} @click=${()=>this.patchDraft(M(r,e.key,{on:!n.on}))}>${f(n.on?"eye":"eyeOff")}</button>
    </span>`}card(e,t,s,a,r=!1){const n=this.editing&&!!this.draft,o=n&&!A(this.draft,e.key).on;return i`<media-screen-card class=${P({l:t==="l"})} data-fit-item ?data-off=${r} data-screen-card=${e.key} .device=${e} .size=${t} ?compact=${this.phone} ?editing=${n} ?data-dimmed=${o}
      @open-remote=${l=>this.openRemote(l.detail.key)} @media-changed=${()=>this.scheduleRefresh(_()?700:30)}>${n?this.chips(e,s,a,t):p}</media-screen-card>`}group(e,t=!1,s=0){const a=e.items.map(u=>u.device),r=u=>!this.fit.shows(s+u),n=e.items.every((u,v)=>r(v)),o=H(a),l=this.editing?null:this.floorOfGroup(e),$=this.devices.filter(u=>l?.scope==="area"?(u.area_id??"")===l.id:l?(u.floor_id??z)===l.id:!1),k=l&&!this.editing&&he($).length?i`<button type="button" class="btn sm quiet dz" data-bulk-off=${l.id} @click=${()=>this.bulk?.show({scope:l.scope,id:l.id,name:e.label})}>${f("power")}כבה מסכים</button>`:p,Y=e.id==="pinned"||e.id==="all"||!l||this.editing?i`<h2>${I(b(e.label))}</h2>`:i`<h2><button type="button" class="shlink" data-group-open=${e.id} @click=${()=>this.setFilters(l.scope==="area"?{area:e.id}:{floor:e.id,area:""})}>${b(e.label)}${f("chevronBack")}</button></h2>`,D=a.filter(u=>pe(u.live)).length;return t&&!this.editing&&(e.id==="none"||e.id===z)&&!k?i`<section class="fsec" ?data-off=${n} aria-label=${e.label} data-group=${e.id}><div class="sgrid">${F(e.items,u=>u.device.key,(u,v)=>this.card(u.device,u.size,v,e.items.length,r(v)))}</div></section>`:i`<section class="fsec" ?data-off=${n} aria-label=${e.label} data-group=${e.id}>
      <header class="sh"><div>${Y}<small><span class="n">${o.total}</span> ${o.total===1?"מסך":"מסכים"}${D?i` · <em><span class="n">${D}</span></em> פועלים`:p}</small></div><span class="grow"></span>${k}</header>
      <div class="sgrid">${F(e.items,u=>u.device.key,(u,v)=>this.card(u.device,u.size,v,e.items.length,r(v)))}</div>
    </section>`}roomsAsDropdown(e){const t=this.tabsMode.value;return t==="dropdown"||t==="hybrid"&&e>ue}header(){const e=this.filters,t=B(this.devices,this.display()),s=S(this.devices,e.floor),a=H(this.devices),r=t.length>1||!!e.floor,n=!this.editing&&this.phase==="ready"&&this.devices.length>0;return i`<header class=${P({dh:!0,compact:this.compactHeader})} data-mm-header>
      <div class="dh-row">
        <h1>מסכים</h1>
        ${n&&this.roomsAsDropdown(s.length+1)?i`<span class="grow" data-rooms-in-shell></span>`:n?i`<div class="rooms" role="group" aria-label="חדרים" @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!e.area)} data-room="" @click=${()=>this.setFilters({area:""})}>הכל</button>
          ${s.map(o=>i`<button type="button" class="rc" aria-pressed=${String(e.area===o.id)} data-room=${o.id} @click=${()=>this.setFilters({area:o.id})}>${I(o.name)}</button>`)}
        </div>`:i`<span class="grow"></span>`}
        ${n&&r?this.floorChip(t):p}
      </div>
      ${n?i`<div class="dh-det">
        <span class="amb"><em><span class="n">${a.on}</span></em> פועלים מתוך <span class="n">${a.total}</span>${a.un?i` · <span class="n">${a.un}</span> לא זמין`:p}</span>
        <span class="grow"></span>
        ${this.fit.pages>1?i`<sw-pager data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${o=>this.fit.go(o.detail.page)}></sw-pager>`:p}
        <div class="seg sm" role="radiogroup" aria-label="סינון לפי מצב">${qe.map(o=>i`<button type="button" role="radio" aria-checked=${String(e.state===o.id)} data-state-filter=${o.id} @click=${()=>this.setFilters({state:o.id})}>${o.label}${o.id==="on"?i` <small>${a.on}</small>`:o.id==="un"&&a.un?i` <small>${a.un}</small>`:p}</button>`)}</div>
        <label class="search">${f("search")}<span class="vh">חיפוש מסך</span><input type="search" data-search placeholder="חיפוש מסך או חדר" .value=${e.q} @input=${o=>this.onSearch(o.target.value)} /></label>
      </div>`:p}
    </header>`}floorChip(e){const t=[{id:"",label:"כל הקומות",count:this.devices.length,icon:"home"},{id:"--sep",label:"",divider:!0},...e.map(s=>({id:s.id,label:s.name,count:s.count,icon:"layers"}))];return i`<div class="flwrap"><sw-dropdown data-floor-menu label="קומות" icon="layers" dd-style=${fe("multimedia")} dd-size=${me("multimedia")} dd-ring=${ve("multimedia")} dd-panel=${be("multimedia")} .items=${t} .value=${this.filters.floor} @change=${s=>this.setFilters({floor:s.detail.id,area:""})}></sw-dropdown></div>`}skeleton(){const e=i`<div class="glass" style="padding:10px 10px 14px;display:flex;flex-direction:column;gap:12px"><span class="skl" style="aspect-ratio:16/6.3;border-radius:var(--sw-r-lg)"></span><div style="display:flex;align-items:center;gap:12px;padding-inline:6px"><div style="flex:1;display:flex;flex-direction:column;gap:8px"><span class="skl" style="block-size:16px;inline-size:55%"></span><span class="skl" style="block-size:12px;inline-size:35%"></span></div><span class="skl" style="inline-size:44px;block-size:44px;border-radius:50%"></span></div><span class="skl" style="block-size:40px;border-radius:var(--sw-r-pill);margin-inline:6px"></span></div>`;return i`<div data-mm-state="loading" aria-busy="true"><div class="sgrid">${Array.from({length:this.phone?3:6},()=>e)}</div></div>`}stateBox(e,t,s){return i`<div class="statebox glass" role="status"><span class="ring">${f(e)}</span><b>${t}</b>${s??p}</div>`}editBar(){const e=this.res.can_edit&&this.res.can_personalize;return i`<div class="editbar" data-mm-editbar>
      <span class="t">${f("edit")}עריכת מסך המולטימדיה</span>
      ${e?i`<div class="seg sm" role="radiogroup" aria-label="עבור מי">
        <button type="button" role="radio" aria-checked=${String(this.scope==="all")} data-scope="all" @click=${()=>this.setScope("all")}>לכולם</button>
        <button type="button" role="radio" aria-checked=${String(this.scope==="me")} data-scope="me" @click=${()=>this.setScope("me")}>רק אני</button></div>`:p}
      <span class="grow"></span>
      ${this.conflict?i`<span class="note-bad" role="alert">המסך נערך במקום אחר</span><button type="button" class="btn sm" @click=${()=>void this.reloadAfterConflict()}>טען מחדש</button>`:p}
      ${this.saveError?i`<span class="note-bad" role="alert">${this.saveError}</span>`:p}
      <button type="button" class="btn sm quiet" data-mm-cancel ?disabled=${this.busy} @click=${()=>this.askCancel()}>ביטול</button>
      <button type="button" class="btn sm quiet dz" data-mm-reset ?disabled=${this.busy} @click=${()=>this.confirm="reset"}>ברירת מחדל</button>
      <button type="button" class="btn sm primary" data-mm-save ?disabled=${this.busy||!this.dirty||this.conflict} @click=${()=>void this.save()}>${f("check")}שמור</button>
    </div>`}confirmDialog(){const e=this.confirm;if(!e)return i`<sw-dialog data-mm-confirm="closed"></sw-dialog>`;const t=e==="reset",s=t?this.scope==="all"?"להחזיר את המסך לברירת המחדל לכולם?":"להחזיר את המסך שלי לברירת המחדל?":"לבטל את השינויים?";return i`<sw-dialog open heading=${s} data-mm-confirm=${e} @close=${()=>this.confirm=null}>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-mm-confirm-no autofocus @click=${()=>this.confirm=null}>${t?"ביטול":"המשך עריכה"}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${()=>t?void this.resetLayout():this.leaveEdit()}>${t?"החזר":"בטל שינויים"}</sw-button>
      </div></sw-dialog>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return i`<div data-mm-state="error">${this.stateBox("warning","לא ניתן לטעון את המסכים",i`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${f("refresh")}נסה שוב</button>`)}</div>`;if(this.phase==="forbidden")return i`<div data-mm-state="forbidden">${this.stateBox("tv","אין הרשאת צפייה במסכים")}</div>`;if(this.phase==="disabled")return i`<div data-mm-state="disabled">${this.stateBox("power","המולטימדיה כבויה")}</div>`;if(!this.devices.length){const r=this.status?.can.configure;return i`<div data-mm-state="empty">${this.stateBox("tv","אין מסכים",r?i`<a class="btn sm" href="#/system/multimedia">להגדרות</a>`:void 0)}</div>`}const e=this.groupsToShow(),t=this.staleError?i`<div class="errbar" role="alert" data-mm-stale>${f("warning")}הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.<button type="button" class="btn sm" @click=${()=>void this.load()}>נסה שוב</button></div>`:p;if(!e.length)return i`${t}<div data-mm-state="filtered">${this.stateBox("search","לא נמצאו מסכים",Ae(this.filters)?i`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.setFilters(E)}>נקה סינון</button>`:void 0)}</div>`;let s=0;const a=e.map(r=>(s+=r.items.length,s-r.items.length));return this.fit.sync(s,`${e.map(r=>`${r.id}:${r.items.map(n=>`${n.device.key}/${n.size}`).join(",")}`).join("|")}|${this.phone}`),i`${t}<div class="groups" data-mm-state="ready">${e.map((r,n)=>this.group(r,e.length===1,a[n]))}</div>`}willUpdate(){this.toggleAttribute("data-fit",this.fit.on)}render(){const e=this.body();return i`<div class="page" data-screen="multimedia">
      ${this.header()}
      ${this.editing&&this.draft?i`<div class="editing-stack">${this.editBar()}</div>
          <div class="edit-layout"><multimedia-edit-panel class="edit-side" .draft=${this.draft} .devices=${this.devices} .scope=${this.scope} .floors=${B(this.devices,this.draft)} @layout-draft=${t=>this.patchDraft(t.detail)}></multimedia-edit-panel><div class="edit-cards">${e}</div></div>`:i`<div class="scr" data-mm-region>${e}</div>`}
    </div>
    <media-bulk-dialog @bulk-done=${()=>void this.load()}></media-bulk-dialog>
    ${this.confirmDialog()}
    ${this.remoteKey?i`<media-remote .deviceKey=${this.remoteKey} .open=${!0} @close=${()=>this.closeRemote()}></media-remote>`:p}
    ${this.toast?i`<div class="toast" role="status" ${ge()}>${f("check")}${this.toast}</div>`:p}`}};d.styles=[we,ke,ye,K`
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
    .page {
      padding: 0 36px 44px;
      display: flex;
      flex-direction: column;
      gap: 26px;
      min-block-size: 100%;
    }
    /* the header: a large title, rooms, the floor menu; it sticks and compacts while scrolling */
    .dh {
      position: sticky;
      inset-block-start: 0;
      z-index: 15;
      margin-inline: -36px;
      padding: 16px 36px 4px;
      padding-inline-end: calc(36px + var(--sw-float-reserve, 0px));
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    /* Compacting is purely visual: it never changes the header's height in the flow. A header that shrank at scrollTop ~60
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
      gap: 12px 18px;
      min-inline-size: 0;
    }
    h1 {
      margin: 0;
      font-family: var(--sw-font-heading);
      font-size: var(--mm-fs-page-title);
      font-weight: var(--sw-h1-weight, 700);
      letter-spacing: var(--sw-h1-tracking, -0.6px);
      line-height: 1.2;
      color: var(--sw-heading, var(--sw-text));
      flex: none;
      transition: font-size var(--mm-motion) var(--mm-ease);
    }
    .dh.compact h1 {
      font-size: var(--mm-fs-page-title-compact);
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
      block-size: 38px;
      padding-inline: 17px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      font-size: var(--sw-fs-md);
      font-weight: 500;
      color: var(--dv-text-2);
      white-space: nowrap;
      transition: background var(--mm-motion), color var(--mm-motion), transform var(--sw-t-press, 120ms) var(--sw-ease-out, ease-out);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    /* R5-MEDIA-ENERGY-297 (mobile-native): hover only under a pointer that hovers; the chip sinks on pointer-down */
    @media (hover: hover) and (pointer: fine) {
      .rc:hover {
        color: var(--dv-text);
        background: var(--dv-surface);
      }
    }
    .rc:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    .rc[aria-pressed='true'] {
      background: var(--dv-text);
      border-color: transparent;
      color: var(--mm-text-inverse);
      font-weight: 600;
      box-shadow: var(--dv-shadow-control);
    }
    .flwrap {
      position: relative;
      flex: none;
    }
    .dh-det {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      transition: opacity var(--mm-motion), visibility var(--mm-motion);
    }
    .dh.compact .dh-det {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .amb {
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
    }
    .amb em {
      font-style: normal;
      color: var(--dv-text);
      font-weight: 600;
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
    /* groups and the grid */
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
    /* R5-MEDIA-ENERGY-297 (HOMEFABLE type scale): the floor heading is 20 px / 800 in the heading ink */
    /* loop 2 (visible-difference test): the floor is the page's section object - its heading steps up to 26 px / 800 */
    .sh h2 {
      margin: 0;
      font-size: var(--sw-fs-3xl);
      font-weight: 800;
      letter-spacing: -0.03em;
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
      transition: transform var(--sw-t-press, 120ms) var(--sw-ease-out, ease-out);
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
    /* POLISH4-WP5: the floor link sinks on pointer-down like the chips and keys do */
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
    /* edit chips on a card */
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
      transition: background var(--mm-motion), transform var(--sw-t-press, 120ms) var(--sw-ease-out, ease-out);
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
    /* the confirmation dialogs carry the sheet material (a translucent glass panel over a dimmed page reads as washed out) */
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
        margin-block: -8px; /* the hit area grows, the heading row does not */
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .dh::before,
      h1,
      .shlink .ic,
      .dh-det {
        transition: none;
      }
    }
    @media (max-width: 767px) {
      .page {
        padding: 0 14px 26px;
        gap: 18px;
      }
      .dh {
        margin-inline: -14px;
        padding: 12px 14px 2px;
        padding-inline-end: 14px;
        gap: 10px;
      }
      .dh-row {
        display: grid;
        /* the third column keeps the row clear of the shell's floating search / status corner */
        grid-template-columns: minmax(0, 1fr) auto var(--sw-float-reserve, 0px);
        grid-template-areas: 't f .' 'r r r';
        gap: 10px;
      }
      .dh-row h1 {
        grid-area: t;
      }
      .dh-row .flwrap {
        grid-area: f;
      }
      .dh-row .rooms {
        grid-area: r;
        margin-inline: -14px;
        padding-inline: 14px;
      }
      .dh.compact .rooms {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
      .amb {
        display: none;
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
      .page {
        padding-inline: 24px;
      }
      .dh {
        margin-inline: -24px;
        padding-inline: 24px;
        padding-inline-end: calc(24px + var(--sw-float-reserve, 0px));
      }
      .sgrid > .l {
        grid-column: auto;
      }
    }
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30 #5, 549 px at 1366x768). Below 1024 px wide - or on a
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
        gap: var(--sw-s-4);
      }
      :host([data-fit]) .scr {
        display: block;
        flex: 1 1 auto;
        min-block-size: 0;
        overflow: hidden;
        /* the region spans the page's side padding, so a card's shadow and focus ring are never cut at the sides */
        margin-inline: -36px;
        padding: var(--sw-s-1) 36px var(--sw-s-5);
      }
      :host([data-fit]) .groups {
        gap: var(--sw-s-5);
      }
      /* the cards of the other pages (and a section with none on this page) stay in the document, out of the layout */
      :host([data-fit]) [data-off] {
        display: none !important;
      }
    }
  `];h([xe()],d.prototype,"remoteKey",2);h([c()],d.prototype,"phase",2);h([c()],d.prototype,"devices",2);h([c()],d.prototype,"status",2);h([c()],d.prototype,"res",2);h([c()],d.prototype,"homeFloors",2);h([c()],d.prototype,"filters",2);h([c()],d.prototype,"compactHeader",2);h([c()],d.prototype,"staleError",2);h([c()],d.prototype,"toast",2);h([c()],d.prototype,"phone",2);h([c()],d.prototype,"editing",2);h([c()],d.prototype,"scope",2);h([c()],d.prototype,"draft",2);h([c()],d.prototype,"base",2);h([c()],d.prototype,"busy",2);h([c()],d.prototype,"saveError",2);h([c()],d.prototype,"conflict",2);h([c()],d.prototype,"confirm",2);h([$e("media-bulk-dialog")],d.prototype,"bulk",2);d=h([U("multimedia-screens")],d);export{d as MultimediaScreens};
