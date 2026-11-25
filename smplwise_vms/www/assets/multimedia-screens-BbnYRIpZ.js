import{cC as l,g as j,j as g,i as U,hI as w,a as P,n as y,dd as K,a7 as L,dB as H,im as W,b as i,ab as m,io as X,A as p,cM as O,k as M,ej as V,ef as Y,aX as Z,ip as J,iq as Q,d2 as ee,bg as C,ir as te,is as se,it as ae,iu as ie,dW as re,bm as oe,bn as ne,bo as le,bp as de,v as ce,dX as he}from"./index-c_ii2C2N.js";import{l as pe}from"./lead-reserve-Db0jNmH6.js";import"./media-screen-card-DKDY_nev.js";import"./media-remote-Digaa1GT.js";import"./sw-pager-yILvgW0Q.js";import{P as ue}from"./page-fit-CNW9RZGs.js";import{f as me,N as k,r as z,g as fe,h as ve,w as be,i as ge,j as we,k as $e,l as A,p as xe,e as ye,n as ke,o as D,c as F,m as R,s as B,t as ze,q as S,u as T,v as De,x as Se}from"./multimedia-base-BLHFTgh4.js";import"./multimedia-edit-panel-D71P86HJ.js";import{m as u,n as q}from"./media-now-BgpIyFyJ.js";import{t as a}from"./media-ChiRjfra.js";import"./sw-logo-art-PLtEZJxU.js";import"./media-player-panel-BdbaMgQi.js";import"./media-integration-names-Bvaj4WHf.js";import"./live-DMqV6qVh.js";import"./long-lists-KFWLR6_3.js";var Pe=Object.defineProperty,Oe=Object.getOwnPropertyDescriptor,$=(e,t,r,o)=>{for(var s=o>1?void 0:o?Oe(t,r):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(s=(o?c(t,r,s):c(s))||s);return o&&s&&Pe(t,r,s),s};const _e={already_off:l("כבוי כבר"),not_confirmed:l("לא אושר שהוא דולק"),unavailable:l("לא זמין"),not_allowed:l("אין הרשאה")};let f=class extends U{constructor(){super(...arguments),this.phase="closed",this.req=null,this.preview=null,this.record=null,this.error="",this.follow=null,this.close=()=>{this.phase!=="sending"&&(this.phase="closed")}}async show(e){if(!(this.phase==="sending"||this.phase==="running")){this.req=e,this.preview=null,this.record=null,this.error="",this.phase="loading";try{const t=await w().bulkPreview(e.scope,e.id);if(this.req!==e)return;this.preview=t,this.phase=t.counts.send?"confirm":"nothing"}catch(t){if(this.req!==e)return;this.error=t instanceof P&&t.status===403?l("אין לך הרשאה לכיבוי מרוכז כאן."):y(t),this.phase="error"}}}async confirm(){const e=this.req,t=this.preview;if(!(!e||!t||this.phase!=="confirm")){this.phase="sending";try{const r=await w().bulkRun(e.scope,e.id,K(),new Date(Date.now()+15e3).toISOString());this.phase="running",L()&&(this.follow={stopped:!1},this.record=await H(await W(r.bulk_id),o=>this.record=o,this.follow)),this.phase="result",this.dispatchEvent(new CustomEvent("bulk-done",{detail:this.record,bubbles:!0,composed:!0}))}catch(r){this.error=r instanceof P&&r.code==="target_changed"?l("רשימת המסכים השתנתה; לא נשלח דבר. פתחו מחדש."):y(r),this.phase="error",this.dispatchEvent(new CustomEvent("bulk-done",{detail:null,bubbles:!0,composed:!0}))}}}disconnectedCallback(){super.disconnectedCallback(),this.follow&&(this.follow.stopped=!0)}updated(e){!e.has("phase")||this.phase==="closed"||this.phase==="sending"||this.phase==="running"||requestAnimationFrame(()=>{const t=this.renderRoot.querySelector("sw-button[data-bulk-cancel]");(t?.shadowRoot?.querySelector("button")??t)?.focus({preventScroll:!0})})}render(){const e=this.req;if(this.phase==="closed"||!e)return i`<sw-dialog data-media-bulk="closed"></sw-dialog>`;const t=this.preview,r=this.phase==="confirm"&&t?t.counts.send===1?l("לכבות מסך אחד ב{place}?",{place:m(e.name)}):l("לכבות {n} מסכים ב{place}?",{n:t.counts.send,place:m(e.name)}):`${l("כיבוי מסכים")} · ${m(e.name)}`;return i`<sw-dialog open ?locked=${this.phase==="sending"} data-media-bulk=${this.phase} heading=${r} @close=${this.close}>${this.body()}</sw-dialog>`}cancel(e=l("ביטול")){return i`<sw-button data-bulk-cancel autofocus @click=${this.close}>${e}</sw-button>`}body(){const e=this.preview;if(this.phase==="loading")return i`<div class="muted">${l("בודק…")}</div><div class="actions">${this.cancel()}</div>`;if(this.phase==="error")return i`<div class="err" data-bulk-error>${this.error}</div><div class="actions">${this.cancel(l("סגור"))}</div>`;if(this.phase==="nothing"&&e)return i`<div class="what" data-bulk-nothing><div>${l("אין מסך דולק שאושר לכיבוי.")}</div>${this.details(e)}</div><div class="actions">${this.cancel(l("סגור"))}</div>`;if(this.phase==="confirm"&&e)return i`<div class="what" data-bulk-what>${this.details(e)}</div>
        <div class="actions">${this.cancel()}<sw-button data-bulk-confirm variant="danger" @click=${()=>void this.confirm()}>${l("כבה")} (${e.counts.send})</sw-button></div>`;const t=this.record;if(this.phase==="sending"||!t&&this.phase==="running")return i`<div class="muted" data-bulk-progress>${l("שולח…")}</div>`;if(!t)return i`<div class="what" data-bulk-result="ok"><div class="headline ok"><sw-icon name="check" size="16"></sw-icon>${l("בוצע")}</div></div><div class="actions">${this.cancel(l("סגור"))}</div>`;const r=X(t),o=t.counts,s=o.total?Math.round(o.confirmed/o.total*100):0,n=t.items.filter(c=>c.outcome!=="confirmed");return i`<div class="what" data-bulk-progress data-confirmed=${o.confirmed} data-total=${o.total}>
        <div class=${O({headline:!0,[r.tone]:!0})} data-bulk-result=${t.done?r.tone:"running"}>${t.done?i`<sw-icon .name=${r.tone==="ok"?"check":"warning"} size="16"></sw-icon>`:p}${r.text}</div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax=${o.total} aria-valuenow=${o.confirmed} aria-label=${l("אושרו")}><div style=${`inline-size:${s}%`}></div></div>
        ${t.done&&n.length?i`<ul>${n.map(c=>i`<li>${m(c.name)}<span class="tag">${l("לא אושר")}</span></li>`)}</ul>`:p}
      </div>
      <div class="actions">${this.cancel(l("סגור"))}</div>`}details(e){const t=e.devices.filter(o=>o.will==="off"),r=e.devices.filter(o=>o.will==="skip");return i`<details data-bulk-details><summary>${l("פרטים")}</summary>
      ${t.length?i`<ul>${t.map(o=>i`<li>${m(o.name)}</li>`)}</ul>`:p}
      ${r.length?i`<div class="muted">${l("לא נכללו:")}</div><ul>${r.map(o=>i`<li>${m(o.name)}<span class="tag">${o.reason?_e[o.reason]??o.reason:""}</span></li>`)}</ul>`:p}
    </details>`}};f.styles=j`
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
  `;$([g()],f.prototype,"phase",2);$([g()],f.prototype,"req",2);$([g()],f.prototype,"preview",2);$([g()],f.prototype,"record",2);$([g()],f.prototype,"error",2);f=$([M("media-bulk-dialog")],f);var Ee=Object.defineProperty,Ce=Object.getOwnPropertyDescriptor,x=(e,t,r,o)=>{for(var s=o>1?void 0:o?Ce(t,r):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(s=(o?c(t,r,s):c(s))||s);return o&&s&&Ee(t,r,s),s};const Ae="/multimedia/screens",I=["s","m","l"];let b=class extends me{constructor(){super(...arguments),this.remoteKey="",this.filters=k,this.scope="all",this.path=Ae,this.tab="screens",this.editEntry={id:"multimedia-layout",label:a("עריכת מסך המולטימדיה")},this.noFilter=k,this.panelParam="remote",this.fit=new ue(this,()=>this.renderRoot.querySelector(".scr"),()=>!this.editing)}ownsRoute(e){return(e.segments[1]??"screens")==="screens"}syncPair(){const e=this.filters,t=z(this.devices,e.floor);!this.editing&&this.phase==="ready"&&this.devices.length>0&&this.roomsAsDropdown(t.length+1)?V(this,{group:"multimedia",label:a("חדרים"),value:e.area,items:[{id:"",label:a("הכל"),icon:"home"},{id:"--sep",label:"",divider:!0},...t.map(o=>({id:o.id,label:o.name,icon:"door"}))],onPick:o=>this.setFilters({area:o})}):Y(this)}updated(){this.syncPair(),this.measureBar(),super.updated()}measureBar(){const e=this.renderRoot.querySelector(".dh");if(!e)return;const t=e.getBoundingClientRect().top;let r=0;for(const s of e.querySelectorAll(":scope > .dh-row > *"))r=Math.max(r,s.getBoundingClientRect().bottom-t);const o=`${Math.ceil(r+(this.phone?8:10))}px`;r&&e.style.getPropertyValue("--mm-bar-h")!==o&&e.style.setProperty("--mm-bar-h",o)}get canEdit(){return this.phase==="ready"&&(this.res.can_edit||this.res.can_personalize)&&!Z("layout_editor")}readStatus(){return w().status()}async listDevices(){return(await w().list()).devices}filtersFromParams(e){return fe(e)}filtersToParams(e,t){return ve(e,t)}roomsInFloor(){return z(this.devices,this.filters.floor)}display(){return be(ge(this.res.installation,this.res.personal),this.homeFloors)}beforeEdit(){this.scope=this.res.can_edit?"all":"me"}startDraft(){return we(this.scope,this.res.installation,this.res.personal,this.devices,this.homeFloors)}setScope(e){e!==this.scope&&(this.scope=e,this.beginDraft())}async save(){if(!(!this.draft||this.busy)){this.busy=!0,this.saveError="";try{this.res=this.scope==="all"?await w().saveLayout($e(this.draft,this.devices,this.res.installation,this.homeFloors),this.res.revision):await A(xe(this.res.installation,this.draft,this.devices)),this.leaveEdit(),this.say(a("נשמר"))}catch(e){e instanceof P&&e.code==="revision_conflict"?this.conflict=!0:this.saveError=y(e),this.busy=!1}}}async resetLayout(){this.confirm=null,this.busy=!0;try{this.res=this.scope==="all"?await w().resetLayout():await A(null),this.leaveEdit(),this.say(a("חזר לברירת המחדל"))}catch(e){this.saveError=y(e),this.busy=!1}}groupsToShow(){return this.editing&&this.draft?ye(this.devices,this.draft):J(ke(this.devices,this.filters),this.display(),this.phone)}floorOfGroup(e){const t=(this.editing&&this.draft?this.draft:this.display()).group_by;return e.id==="pinned"||e.id==="all"||e.id===D||e.id==="none"?null:{scope:t==="area"?"area":"floor",id:e.id}}chips(e,t,r,o){const s=this.draft,n=F(s,e.key),c=s.pinned.includes(e.key),h=e.name;return i`<span class="ecard" slot="edit">
      <button type="button" aria-label=${a("הקדם · {name}",{name:h})} title=${a("הקדם")} ?disabled=${t===0} @click=${()=>this.patchDraft(R(s,this.devices,e.key,-1))}>${u("arrowUp")}</button>
      <button type="button" aria-label=${a("אחר · {name}",{name:h})} title=${a("אחר")} ?disabled=${t===r-1} @click=${()=>this.patchDraft(R(s,this.devices,e.key,1))}>${u("arrowDown")}</button>
      <button type="button" aria-label=${a("גודל · {name}",{name:h})} title=${a("גודל")} @click=${()=>this.patchDraft(B(s,e.key,{size:I[(I.indexOf(o)+1)%3]}))}>${o.toUpperCase()}</button>
      ${this.scope==="all"?i`<button type="button" aria-pressed=${String(c)} aria-label=${a("מועדף · {name}",{name:h})} title=${a("מועדף")} @click=${()=>this.patchDraft(ze(s,e.key))}>${u("star")}</button>`:p}
      <button type="button" aria-label=${`${n.on?a("הסתר"):a("הצג")} · ${h}`} title=${n.on?a("הסתר"):a("הצג")} @click=${()=>this.patchDraft(B(s,e.key,{on:!n.on}))}>${u(n.on?"eye":"eyeOff")}</button>
    </span>`}card(e,t,r,o,s=!1){const n=this.editing&&!!this.draft,c=n&&!F(this.draft,e.key).on;return i`<media-screen-card class=${O({l:t==="l"})} data-fit-item ?data-off=${s} data-screen-card=${e.key} .device=${e} .size=${t} ?compact=${this.phone} ?editing=${n} ?data-dimmed=${c}
      @open-remote=${h=>this.openPanel(h.detail.key)} @media-changed=${()=>this.scheduleRefresh(L()?700:30)}>${n?this.chips(e,r,o,t):p}</media-screen-card>`}group(e,t=!1,r=0){const o=e.items.map(d=>d.device),s=d=>!this.fit.shows(r+d),n=e.items.every((d,v)=>s(v)),c=S(o),h=this.editing?null:this.floorOfGroup(e),G=this.devices.filter(d=>h?.scope==="area"?(d.area_id??"")===h.id:h?(d.floor_id??D)===h.id:!1),_=h&&!this.editing&&Q(G).length?i`<button type="button" class="btn sm quiet dz" data-bulk-off=${h.id} @click=${()=>this.bulk?.show({scope:h.scope,id:h.id,name:e.label})}>${u("power")}${a("כבה מסכים")}</button>`:p,N=e.id==="pinned"||e.id==="all"||!h||this.editing?i`<h2>${q(m(e.label))}</h2>`:i`<h2><button type="button" class="shlink" data-group-open=${e.id} @click=${()=>this.setFilters(h.scope==="area"?{area:e.id}:{floor:e.id,area:""})}>${m(e.label)}${u("chevronBack")}</button></h2>`,E=o.filter(d=>ee(d.live)).length;return t&&!this.editing&&(e.id==="none"||e.id===D)&&!_?i`<section class="fsec" ?data-off=${n} aria-label=${e.label} data-group=${e.id}><div class="sgrid">${C(e.items,d=>d.device.key,(d,v)=>this.card(d.device,d.size,v,e.items.length,s(v)))}</div></section>`:i`<section class="fsec" ?data-off=${n} aria-label=${e.label} data-group=${e.id}>
      <header class="sh"><div>${N}<small><span class="n">${c.total}</span> ${c.total===1?a("מסך"):a("מסכים")}${E?i` · <em><span class="n">${E}</span></em> ${a("פועלים")}`:p}</small></div><span class="grow"></span>${_}</header>
      <div class="sgrid">${C(e.items,d=>d.device.key,(d,v)=>this.card(d.device,d.size,v,e.items.length,s(v)))}</div>
    </section>`}summary(){if(this.phone||this.editing||this.phase!=="ready"||!this.devices.length)return"";const e=S(this.devices);return`${a("{on} פועלים מתוך {total}",{on:e.on,total:e.total})}${e.un?a(" · {n} לא זמין",{n:e.un}):""}`}floorAction(){const e=T(this.devices,this.display()),t=e.length>1||!!this.filters.floor;return!this.editing&&this.phase==="ready"&&this.devices.length>0&&t?i`<div slot="actions" class="pacts">${this.floorChip(e)}</div>`:p}header(){const e=this.filters,t=z(this.devices,e.floor),r=S(this.devices);return!this.editing&&this.phase==="ready"&&this.devices.length>0?i`<div class=${O({dh:!0,compact:this.compactHeader})} data-mm-header>
      <div class="dh-row">
        ${this.roomsAsDropdown(t.length+1)?i`<span class="grow" data-rooms-in-shell></span>`:i`<div class="rooms" role="group" aria-label=${a("חדרים")} @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!e.area)} data-room="" @click=${()=>this.setFilters({area:""})}>${a("הכל")}</button>
          ${t.map(s=>i`<button type="button" class="rc" aria-pressed=${String(e.area===s.id)} data-room=${s.id} @click=${()=>this.setFilters({area:s.id})}>${q(s.name)}</button>`)}
        </div>`}
      </div>
      <div class="dh-det">
        ${this.fit.pages>1?i`<sw-pager data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${s=>this.fit.go(s.detail.page)}></sw-pager>`:p}
        <sw-segmented radio size="sm" label=${a("סינון לפי מצב")} value=${e.state} @change=${s=>this.setFilters({state:s.detail.value})}
          .options=${De.map(s=>({value:s.id,label:s.label,count:s.id==="on"?String(r.on):s.id==="un"&&r.un?String(r.un):void 0,attrs:{"data-state-filter":s.id}}))}></sw-segmented>
        <label class="search">${u("search")}<span class="vh">${a("חיפוש מסך")}</span><input type="search" data-search placeholder=${a("חיפוש מסך או חדר")} .value=${e.q} @input=${s=>this.onSearch(s.target.value)} /></label>
      </div>
    </div>`:p}floorChip(e){const t=[{id:"",label:a("כל הקומות"),count:this.devices.length,icon:"home"},{id:"--sep",label:"",divider:!0},...e.map(r=>({id:r.id,label:r.name,count:r.count,icon:"layers"}))];return i`<div class="flwrap"><sw-dropdown data-floor-menu label=${a("קומות")} icon="layers" dd-style=${te("multimedia")} dd-size=${se("multimedia")} dd-ring=${ae("multimedia")} dd-panel=${ie("multimedia")} .items=${t} .value=${this.filters.floor} @change=${r=>this.setFilters({floor:r.detail.id,area:""})}></sw-dropdown></div>`}skeleton(){const e=i`<div class="glass" style="padding:10px 10px 14px;display:flex;flex-direction:column;gap:12px"><span class="skl" style="aspect-ratio:16/6.3;border-radius:var(--sw-r-lg)"></span><div style="display:flex;align-items:center;gap:12px;padding-inline:6px"><div style="flex:1;display:flex;flex-direction:column;gap:8px"><span class="skl" style="block-size:16px;inline-size:55%"></span><span class="skl" style="block-size:12px;inline-size:35%"></span></div><span class="skl" style="inline-size:44px;block-size:44px;border-radius:50%"></span></div><span class="skl" style="block-size:40px;border-radius:var(--sw-r-pill);margin-inline:6px"></span></div>`;return i`<div data-mm-state="loading" aria-busy="true"><div class="sgrid">${Array.from({length:this.phone?3:6},()=>e)}</div></div>`}editBar(){const e=this.res.can_edit&&this.res.can_personalize;return i`<div class="editbar" data-mm-editbar>
      <span class="t">${u("edit")}${a("עריכת מסך המולטימדיה")}</span>
      ${e?i`<sw-segmented radio size="sm" label=${a("עבור מי")} value=${this.scope} @change=${t=>this.setScope(t.detail.value==="me"?"me":"all")}
        .options=${[{value:"all",label:a("לכולם"),attrs:{"data-scope":"all"}},{value:"me",label:a("רק אני"),attrs:{"data-scope":"me"}}]}></sw-segmented>`:p}
      <span class="grow"></span>
      ${this.conflict?i`<span class="note-bad" role="alert">${a("המסך נערך במקום אחר")}</span><button type="button" class="btn sm" @click=${()=>void this.reloadAfterConflict()}>${a("טען מחדש")}</button>`:p}
      ${this.saveError?i`<span class="note-bad" role="alert">${this.saveError}</span>`:p}
      <button type="button" class="btn sm quiet" data-mm-cancel ?disabled=${this.busy} @click=${()=>this.askCancel()}>${a("ביטול")}</button>
      <button type="button" class="btn sm quiet dz" data-mm-reset ?disabled=${this.busy} @click=${()=>this.confirm="reset"}>${a("ברירת מחדל")}</button>
      <button type="button" class="btn sm primary" data-mm-save ?disabled=${this.busy||!this.dirty||this.conflict} @click=${()=>void this.save()}>${u("check")}${a("שמור")}</button>
    </div>`}confirmDialog(){const e=this.confirm;if(!e)return i`<sw-dialog data-mm-confirm="closed"></sw-dialog>`;const t=e==="reset",r=t?this.scope==="all"?a("להחזיר את המסך לברירת המחדל לכולם?"):a("להחזיר את המסך שלי לברירת המחדל?"):a("לבטל את השינויים?");return i`<sw-dialog open heading=${r} data-mm-confirm=${e} @close=${()=>this.confirm=null}>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-block-start:6px">
        <sw-button data-mm-confirm-no autofocus @click=${()=>this.confirm=null}>${t?a("ביטול"):a("המשך עריכה")}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${()=>t?void this.resetLayout():this.leaveEdit()}>${t?a("החזר"):a("בטל שינויים")}</sw-button>
      </div></sw-dialog>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return i`<div data-mm-state="error">${this.stateBox("warning",a("לא ניתן לטעון את המסכים"),i`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${u("refresh")}${a("נסה שוב")}</button>`)}</div>`;if(this.phase==="forbidden")return i`<div data-mm-state="forbidden">${this.stateBox("tv",a("אין הרשאת צפייה במסכים"))}</div>`;if(this.phase==="disabled")return i`<div data-mm-state="disabled">${this.stateBox("power",a("המולטימדיה כבויה"))}</div>`;if(!this.devices.length){const s=this.status?.can.configure;return i`<div data-mm-state="empty">${this.stateBox("tv",a("אין מסכים"),s?i`<a class="btn sm" href="#/system/multimedia">${a("להגדרות")}</a>`:void 0)}</div>`}const e=this.groupsToShow(),t=this.staleError?i`<div class="errbar" role="alert" data-mm-stale>${u("warning")}${a("הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.")}<button type="button" class="btn sm" @click=${()=>void this.load()}>${a("נסה שוב")}</button></div>`:p;if(!e.length)return i`${t}<div data-mm-state="filtered">${this.stateBox("search",a("לא נמצאו מסכים"),Se(this.filters)?i`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.setFilters(k)}>${a("נקה סינון")}</button>`:void 0)}</div>`;let r=0;const o=e.map(s=>(r+=s.items.length,r-s.items.length));return this.fit.sync(r,`${e.map(s=>`${s.id}:${s.items.map(n=>`${n.device.key}/${n.size}`).join(",")}`).join("|")}|${this.phone}`),i`${t}<div class="groups" data-mm-state="ready">${e.map((s,n)=>this.group(s,e.length===1,o[n]))}</div>`}willUpdate(){this.toggleAttribute("data-fit",this.fit.fits)}render(){const e=this.body();return i`<sw-page class="page" wide heading=${a("מסכים")} subheading=${this.summary()} data-screen="multimedia">
      ${this.floorAction()}
      ${this.header()}
      ${this.editing&&this.draft?i`<div class="editing-stack">${this.editBar()}</div>
          <div class="edit-layout"><multimedia-edit-panel class="edit-side" .draft=${this.draft} .devices=${this.devices} .scope=${this.scope} .floors=${T(this.devices,this.draft)} @layout-draft=${t=>this.patchDraft(t.detail)}></multimedia-edit-panel><div class="edit-cards">${e}</div></div>`:i`<div class="scr" data-mm-region>${e}</div>`}
    </sw-page>
    <media-bulk-dialog @bulk-done=${()=>void this.load()}></media-bulk-dialog>
    ${this.confirmDialog()}
    ${this.remoteKey?i`<media-remote .deviceKey=${this.remoteKey} .open=${!0} @close=${()=>this.closePanel()}></media-remote>`:p}
    ${this.toast?i`<div class="toast" role="status" ${re()}>${u("check")}${this.toast}</div>`:p}`}};b.styles=[oe,pe,ne,j`
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
    /* AUDIT30-D3 (audit round 30 #6): the page frame is the shared <sw-page class="page" wide> - the title, the one-line summary under
       it and the floor menu at the end of the title row come from it (its padding is --sw-page-pad; --mm-pad mirrors it for the
       edge-to-edge bars below). Below it, the filter bar (.dh) and the cards. */
    .page {
      --mm-pad: var(--sw-page-pad);
    }
    /* the filter bar: the room chips, the pager, the state filter, the search; it sticks and compacts while the page scrolls */
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
      gap: var(--sw-s-3);
      flex: 1 1 320px;
      min-inline-size: 0;
    }
    /* the bar is not the page's first row any more (sw-page's title row is, and it keeps the shell's lead reserve itself) */
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
      /* the first chip lines up with the title above: the fade's room hangs outside the text edge */
      margin-inline-start: -18px;
      -webkit-mask-image: var(--mm-fade-row);
      mask-image: var(--mm-fade-row);
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
      /* AUDIT30-D1: the chip is a control of the shared height (34 in the classic skin; 44 on touch below) */
      block-size: var(--sw-ctl-h-md);
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      color: var(--dv-text-2);
      white-space: nowrap;
      transition: background var(--mm-motion), color var(--mm-motion), transform var(--sw-t-press) var(--sw-ease-out);
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
    /* AUDIT30-D1 (audit round 30 #4, owner question 3 answer a): the chosen room is the product's one selected look - the soft accent
       fill with the accent ink (Blue Wash), no border, no shadow; it was a black pill (--dv-text fill) */
    .rc[aria-pressed='true'] {
      ${le}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .rc[aria-pressed='true']::before {
      ${de}
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
    /* AUDIT30-D2 (audit round 30 #17): the floor heading sits one tier under the page title (the 26-30 px / 800 heading competed
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
      font-weight: var(--sw-fw-semibold);
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
      font-weight: var(--sw-fw-bold);
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
      font-weight: var(--sw-fw-semibold);
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
      font-weight: var(--sw-fw-medium);
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
      .shlink .ic,
      .dh-det {
        transition: none;
      }
    }
    @media (max-width: 767px) {
      /* sw-page's phone padding */
      .page {
        --mm-pad: var(--sw-s-3);
      }
      .dh {
        flex-direction: column;
        align-items: stretch;
        flex-wrap: nowrap;
      }
      /* stuck at the top, the room row is what stays: it keeps clear of the shell's floating search / status corner */
      .dh-row {
        flex: none;
        padding-inline-end: var(--sw-float-reserve, 0px);
      }
      .dh-row .rooms {
        margin-inline: calc(-1 * var(--mm-pad));
        padding-inline: var(--mm-pad);
      }
      /* CR-CMP2-SEGMENTED-C-2450: the state filter stays one line and scrolls sideways */
      .dh-det sw-segmented {
        --sw-seg-wrap: nowrap;
      }
      .dh-det sw-segmented::part(track) {
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
      }
      :host([data-fit]) .scr {
        display: block;
        flex: 1 1 auto;
        min-block-size: 0;
        overflow: hidden;
        /* the region spans the page's side padding, so a card's shadow and focus ring are never cut at the sides */
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
    }
  `];x([ce()],b.prototype,"remoteKey",2);x([g()],b.prototype,"filters",2);x([g()],b.prototype,"scope",2);x([he("media-bulk-dialog")],b.prototype,"bulk",2);b=x([M("multimedia-screens")],b);export{b as MultimediaScreens};
