import{b as n,g as M,bf as Z,cc as Gt,E as xt,bD as Yt,bv as Jt,y as f,j as p,i as T,e6 as u,o as v,a as I,A as d,eh as ot,k as z,iv as Wt,xk as Xt,ad as _t,xl as Qt,xm as Zt,eL as yt,e1 as At,ah as te,ae as Bt,aL as jt,xn as ee,du as Ft,aV as se,aW as ae,e3 as ie,e4 as ne,e5 as re,eo as oe}from"./index-BMsqo0rz.js";import{b as le}from"./bubble-chrome-CmexCsTg.js";import{m as a}from"./maintenance-ByJIbLtP.js";import{m as S,e as c,a as lt,T as wt,E as de,b as Ct}from"./styles-qg4Dm6NR.js";import{a as ce,f as x,d as R,l as B,b as U,e as dt,g as Ut,k as V,i as tt,n as ht,h as pe,v as he,j as Et,m as ct,o as ue,p as ve,r as me,s as fe,q as Ot,t as $e,u as ge,w as ut,x as vt,y as Tt,z as be,P as we,A as zt,B as Rt,C as ye,D as St,E as ke,F as xe,G as Pt,H as _e,I as J,J as mt,K as Ce,S as Ee,L as Oe,M as Te}from"./model-DVq4yCP1.js";import"./sw-place-tree-B59FGYri.js";import"./sw-pager-CoML057L.js";import"./sw-table-BpDGNg_D.js";import{P as kt}from"./page-fit-D-9vN51K.js";import{T as Vt}from"./toast-controller-BPX0Tkjm.js";import{q as ze}from"./qrcode-CWKHzRGU.js";import{c as Re}from"./confirm-dialog-Dao9Z_Na.js";import"./sw-logo-art-PLtEZJxU.js";import"./styles-BY-44237.js";import"./long-lists-Dninnpkk.js";const Se=M`
  .sr-h1 {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  .pg-h1 {
    margin: 0;
    font-family: var(--sw-font-heading, var(--sw-font));
    font-size: var(--sw-h1, var(--sw-fs-2xl));
    font-weight: var(--sw-h1-weight, var(--sw-fw-semibold));
    line-height: 1.2;
    letter-spacing: var(--sw-h1-tracking, -0.01em);
    color: var(--sw-heading, var(--sw-text));
  }
  @media (max-width: 767px) {
    .pg-h1 {
      font-size: var(--sw-h1-phone, var(--sw-fs-xl));
    }
  }
`;function Pe(t,e=!1){return e?n`<h1 class="pg-h1 lead-head" data-page-heading>${t}</h1>`:n`<h1 class="sr-h1" data-page-heading>${t}</h1>`}const qe=["fire_certificate","extinguishers","hydrants_sprinklers","emergency_lighting","evacuation_round","elevator_inspection"],A="emergency-readiness",ft=encodeURIComponent,N={module:()=>Z("emergency-readiness/module"),page:()=>Z(A),config:()=>Z(`${A}/config`),putConfig:t=>Jt(`${A}/config`,t),contacts:()=>Z(`${A}/contacts`),createContact:t=>xt(`${A}/contacts`,t),updateContact:(t,e)=>Yt(`${A}/contacts/${ft(t)}`,e),verifyContact:t=>xt(`${A}/contacts/${ft(t)}/verify`,{}),deleteContact:t=>Gt(`${A}/contacts/${ft(t)}`),history:(t=90)=>Z(`${A}/history?days=${t}`)};var Ie=Object.defineProperty,De=Object.getOwnPropertyDescriptor,E=(t,e,i,r)=>{for(var s=r>1?void 0:r?De(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&Ie(e,i,s),s};const $t=()=>{const t=new Date,e=i=>String(i).padStart(2,"0");return`${t.getFullYear()}-${e(t.getMonth()+1)}-${e(t.getDate())}`};function Ne(t,e,i){const r=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t);if(!r)return"";const s=Number(r[1]),o=Number(r[2])-1,l=Number(r[3]),h=Q=>String(Q).padStart(2,"0");if(e==="day"||e==="week"){const Q=new Date(Date.UTC(s,o,l+i*(e==="week"?7:1)));return`${Q.getUTCFullYear()}-${h(Q.getUTCMonth()+1)}-${h(Q.getUTCDate())}`}const $=e==="year"?i*12:i,k=s+Math.floor((o+$)/12),nt=(o+$)%12,m=new Date(Date.UTC(k,nt+1,0)).getUTCDate();return`${k}-${h(nt+1)}-${h(Math.min(l,m))}`}let w=class extends T{constructor(){super(...arguments),this.taskId="",this.mode="view",this.task=null,this.records=[],this.error="",this.busy=!1,this.formError="",this.confirmDelete=!1,this.fileBusy=!1,this.fileError="",this.confirmFile=null,this.f={performed_on:"",valid_until:"",next_due:"",note:""}}willUpdate(t){t.has("taskId")&&this.taskId&&this.load()}async load(){try{const[t,e]=await Promise.all([u.task(this.taskId),u.records(this.taskId).catch(()=>({items:[]}))]);this.task=t,this.records=e.items,this.error="";const i=t.kind==="certificate"||t.kind==="vendor_document";this.f={performed_on:$t(),valid_until:i&&t.interval?Ne($t(),t.interval.unit,t.interval.count):"",next_due:"",note:""}}catch(t){this.error=v(t)}}close(){this.dispatchEvent(new CustomEvent("close"))}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e}))}async complete(){const t=this.task;if(!t)return;const e=t.kind==="certificate"||t.kind==="vendor_document";if(e&&!t.interval&&!this.f.valid_until){this.formError=a("fRequired");return}this.busy=!0,this.formError="";try{await u.complete(t.id,{performed_on:this.f.performed_on||void 0,...e&&this.f.valid_until?{valid_until:this.f.valid_until}:{},...!e&&this.f.next_due?{next_due:this.f.next_due}:{},...this.f.note.trim()?{note:this.f.note.trim()}:{},revision:t.revision}),this.emit("changed",a(e?"renewedToast":"doneToast")),this.close()}catch(i){i instanceof I&&i.code==="revision_conflict"?(this.formError=a("conflict"),await this.load()):this.formError=v(i)}finally{this.busy=!1}}async setActive(t){const e=this.task;if(e){this.busy=!0;try{await u.update(e.id,{active:t,revision:e.revision}),this.emit("changed",a(t?"resumedToast":"pausedToast")),await this.load()}catch(i){this.formError=v(i)}finally{this.busy=!1}}}async removeTask(){const t=this.task;if(t){this.busy=!0;try{await u.remove(t.id),this.emit("removed",a("removedToast"))}catch(e){this.formError=v(e),this.busy=!1}}}async uploadFile(t){const e=this.task,i=t.files?.[0];if(t.value="",!(!e||!i)){this.fileBusy=!0,this.fileError="";try{await u.uploadFile(e.id,i),this.emit("changed",a("fileAddedToast")),await this.load()}catch(r){this.fileError=v(r)}finally{this.fileBusy=!1}}}async downloadFile(t){if(this.task){this.fileError="";try{await u.downloadFile(this.task.id,t)}catch(e){this.fileError=v(e)}}}async removeFile(t){const e=this.task;if(e){this.fileBusy=!0,this.fileError="";try{await u.removeFile(e.id,t.id),this.confirmFile=null,this.emit("changed",a("fileRemovedToast")),await this.load()}catch(i){this.fileError=v(i)}finally{this.fileBusy=!1}}}filesPanel(t){if(t.kind!=="certificate"&&t.kind!=="vendor_document")return d;const e=t.files??[];return n`<div class="panel" data-maint-files><div class="hd"><h4>${a("filesTitle")}</h4><span class="sp"></span>
        ${t.can.edit?n`<label class="btn sm" aria-disabled=${String(this.fileBusy)}><sw-icon name="plus" size="14"></sw-icon>${this.fileBusy?a("fileUploading"):a("fileAdd")}
          <input type="file" hidden accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" ?disabled=${this.fileBusy} data-maint-file-input @change=${i=>void this.uploadFile(i.target)}></label>`:d}</div>
      ${e.length?n`<ul class="hist" data-maint-file-list>${e.map(i=>n`<li data-maint-file=${i.id}><span class="t"><b>${i.name}</b><span class="mut"> · ${ce(i.bytes)}</span></span>
          <button type="button" class="btn sm" data-maint-file-download @click=${()=>void this.downloadFile(i)}><sw-icon name="download" size="14"></sw-icon>${a("fileDownload")}</button>
          ${t.can.edit?n`<button type="button" class="btn sm ghost" aria-label=${`${a("fileRemove")} ${i.name}`} data-maint-file-remove @click=${()=>{this.confirmFile=i}}><sw-icon name="trash" size="14"></sw-icon></button>`:d}</li>`)}</ul>`:n`<div class="mut" data-maint-files-empty>${a("filesEmpty")}</div>`}
      ${t.can.edit?n`<div class="mut">${a("fileHint")}</div>`:d}
      ${this.fileError?n`<div class="alert err" role="alert" data-maint-file-error>${this.fileError}</div>`:d}
      ${this.confirmFile?n`<div class="alert err" role="alertdialog" data-maint-file-confirm><sw-icon name="warning" size="18"></sw-icon><div>${a("fileRemoveConfirm",{n:this.confirmFile.name})}
        <div class="acts"><button type="button" class="btn sm dng" ?disabled=${this.fileBusy} data-maint-file-remove-yes @click=${()=>void this.removeFile(this.confirmFile)}>${a("fileRemove")}</button>
        <button type="button" class="btn sm" @click=${()=>{this.confirmFile=null}}>${a("cancel")}</button></div></div></div>`:d}
    </div>`}async startRound(){const t=this.task;if(t){if(t.open_run_id){this.emit("start-run",t.open_run_id);return}this.busy=!0;try{this.emit("start-run",(await u.startRun(t.id)).id)}catch(e){const i=e instanceof I?e.body?.details?.run_id:void 0;i?this.emit("start-run",i):this.formError=v(e)}finally{this.busy=!1}}}histLine(t){let e,i="ok";if(t.kind==="run"){const o=Object.values(t.answers??{}).filter(l=>l?.ok===!1).length;t.status==="cancelled"?(e=a("histRunCancelled"),i="unk"):t.status==="open"?(e=a("histRunOpen"),i="acc"):o?(e=a("histRunIssues",{n:o}),i="alarm"):e=a("histRunOk")}else t.valid_until?e=a("histRenewed",{d:x(t.valid_until)}):e=t.due_after?a("histDone",{d:x(t.due_after)}):a("histDoneNoNext");const r=t.performed_on?x(t.performed_on):R(t.started_at),s=t.ticket_ids?.length&&t.kind==="completion"?a("histViaTicket"):t.note;return n`<li data-look=${i} data-maint-hist=${t.id}><span class="dot" aria-hidden="true"></span><span class="t">${e}${s?n`<span class="mut"> · ${s}</span>`:d}</span>
      <span class="w">${[r,t.started_by_name].filter(Boolean).join(" · ")}</span></li>`}completePanel(t){if(t.kind==="round")return!t.can.start_round&&!t.open_run_id?d:n`<div class="panel" data-maint-round-start><div class="hd"><h4>${a("kindRound")}</h4></div>
        <button type="button" class="btn pri big" ?disabled=${this.busy} data-maint-start @click=${()=>void this.startRound()}>${a(t.open_run_id?"continue":"scanStartRound")}</button></div>`;if(!t.can.complete||!t.active)return d;const e=t.kind==="certificate"||t.kind==="vendor_document";return n`<div class="panel" data-maint-complete><div class="hd"><h4>${a(e?"renewal":"doneTitle")}</h4></div>
      <div class="form">
        <div class="fld"><label for="po">${a(e?"performedOn":"performedOnPlan")}</label><input id="po" class="inp num" type="date" lang=${ot()} max=${$t()} .value=${this.f.performed_on}
          @input=${i=>{this.f={...this.f,performed_on:i.target.value}}}></div>
        ${e?n`<div class="fld"><label for="vu">${a("newValidUntil")}</label><input id="vu" class="inp num" type="date" lang=${ot()} .value=${this.f.valid_until} data-maint-valid-until
            @input=${i=>{this.f={...this.f,valid_until:i.target.value}}}></div>`:t.can.edit?n`<div class="fld"><label for="nd">${a("nextDueOverride")}</label><input id="nd" class="inp num" type="date" lang=${ot()} .value=${this.f.next_due}
            @input=${i=>{this.f={...this.f,next_due:i.target.value}}}></div>`:d}
        <div class="fld"><label for="nt">${a("note")}</label><input id="nt" class="inp" maxlength="300" .value=${this.f.note} @input=${i=>{this.f={...this.f,note:i.target.value}}}></div>
        ${this.formError?n`<div class="alert err" role="alert">${this.formError}</div>`:d}
        <button type="button" class="btn pri" ?disabled=${this.busy} data-maint-save-complete @click=${()=>void this.complete()}>${a(e?"saveRenewal":"saveDone")}</button>
      </div></div>`}body(t){const e=t.kind==="certificate"||t.kind==="vendor_document",i=B(t),r=t.elevator_name?["elevator",t.elevator_name]:t.generator_name?["generator",t.generator_name]:t.entity_name?["device",t.entity_name]:null,s=t.ticket_error?a(`ticketErr_${t.ticket_error}`):"";return n`<div class="two">
      <div>
        <div class="panel" data-look=${i} data-maint-due>
          <div class="hd"><div><div class="mut">${a(e?"validUntil":"dueBy")}</div><div class="bigdate">${t.due_date?x(t.due_date):a("dash")}</div></div><span class="sp"></span>
            <span class="badge">${U(t)}</span></div>
          <dl class="kv">
            ${r?n`<dt>${a(r[0])}</dt><dd>${r[1]}</dd>`:d}
            ${t.kind==="vendor_document"?n`<dt>${a("fDocType")}</dt><dd>${dt(t.doc_type)}</dd>`:n`<dt>${a("fCategory")}</dt><dd>${Ut(t.category)}</dd>`}
            ${t.owner_name?n`<dt>${a("owner")}</dt><dd>${t.owner_name}</dd>`:d}
            <dt>${a("reminder")}</dt><dd>${t.lead_days?a("reminderDays",{n:t.lead_days}):a("reminderSameDay")}</dd>
            ${this.access.ticketsOn&&(t.auto_ticket||t.ticket_id)?n`<dt>${a("requestRow")}</dt><dd data-maint-request-row>${t.auto_ticket?a("requestAuto"):""}
              ${t.ticket_id?n` · <a href=${`#/tickets/${encodeURIComponent(t.ticket_id)}`}>${a("requestLast")}</a>`:d}${s?n`<div class="mut">${s}</div>`:d}</dd>`:d}
          </dl>
        </div>
        ${t.notes?n`<div class="panel"><div class="hd"><h4>${a("notes")}</h4></div><div style="white-space:pre-line">${t.notes}</div></div>`:d}
        ${t.vendor_id&&t.vendor_name?n`<button type="button" class="btn ghost" data-maint-open-vendor @click=${()=>this.emit("open-vendor",t.vendor_id)}>${a("colVendor")}: ${t.vendor_name}</button>`:d}
      </div>
      <div>
        ${this.completePanel(t)}
        ${this.filesPanel(t)}
        <div class="panel"><div class="hd"><h4>${a("history")}</h4></div>
          ${this.records.length?n`<ol class="hist" data-maint-history>${this.records.map(o=>this.histLine(o))}</ol>`:n`<div class="mut">${a("historyEmpty")}</div>`}
        </div>
      </div>
    </div>
    ${this.confirmDelete?n`<div class="alert err" role="alertdialog" data-maint-confirm-delete><sw-icon name="warning" size="18"></sw-icon><div>${a("removeConfirm",{t:t.title})}
      <div class="acts"><button type="button" class="btn sm dng" ?disabled=${this.busy} data-maint-delete-yes @click=${()=>void this.removeTask()}>${a("removeYes")}</button>
      <button type="button" class="btn sm" @click=${()=>{this.confirmDelete=!1}}>${a("cancel")}</button></div></div></div>`:d}`}render(){const t=this.task,e=t?[V(t.kind),tt(t.interval),t.place?.name,t.vendor_name].filter(Boolean).join(" · "):"";return n`<sw-dialog open xl heading=${t?.title??""} subheading=${e} data-maint-sheet=${this.taskId} @close=${()=>this.close()}>
      ${this.error?n`<sw-state-panel state="error" heading=${this.error} compact></sw-state-panel>`:t?this.body(t):n`<div class="skl" aria-busy="true" aria-label=${a("loading")}></div>`}
      ${t?n`<div class="foot" slot="footer">
        ${t.can.edit?n`<button type="button" class="btn ghost" ?disabled=${this.busy} data-maint-pause @click=${()=>void this.setActive(!t.active)}>${a(t.active?"pause":"resume")}</button>
          <button type="button" class="btn ghost" data-maint-delete @click=${()=>{this.confirmDelete=!0}}>${a("remove")}</button>`:d}
        <span class="sp"></span>
        ${t.can.edit?n`<button type="button" class="btn" data-maint-edit @click=${()=>this.emit("edit",{kind:t.kind,id:t.id})}><sw-icon name="edit" size="14"></sw-icon>${a("edit")}</button>`:d}
        <button type="button" class="btn" @click=${()=>this.close()}>${a("close")}</button>
      </div>`:d}
    </sw-dialog>`}updated(t){if(t.has("task")&&this.task&&this.mode==="complete"){const e=this.renderRoot.querySelector("[data-maint-valid-until], #po");requestAnimationFrame(()=>e?.focus())}}};w.styles=S;E([f()],w.prototype,"taskId",2);E([f()],w.prototype,"mode",2);E([f({attribute:!1})],w.prototype,"access",2);E([p()],w.prototype,"task",2);E([p()],w.prototype,"records",2);E([p()],w.prototype,"error",2);E([p()],w.prototype,"busy",2);E([p()],w.prototype,"formError",2);E([p()],w.prototype,"confirmDelete",2);E([p()],w.prototype,"fileBusy",2);E([p()],w.prototype,"fileError",2);E([p()],w.prototype,"confirmFile",2);E([p()],w.prototype,"f",2);w=E([z("maint-task-sheet")],w);var Le=Object.defineProperty,Me=Object.getOwnPropertyDescriptor,P=(t,e,i,r)=>{for(var s=r>1?void 0:r?Me(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&Le(e,i,s),s};const Ae={certificate:"formNewCert",vendor_document:"formNewDoc",preventive:"formNewPlan",round:"formNewRound"};let _=class extends T{constructor(){super(...arguments),this.kind="certificate",this.taskId=null,this.ticketsOn=!1,this.presetVendor="",this.opts=null,this.prev=null,this.d=ht("certificate"),this.errors={},this.error="",this.busy=!1,this.loaded=!1}willUpdate(t){(t.has("kind")||t.has("taskId"))&&!this.loaded&&this.load(),t.has("presetVendor")&&this.presetVendor&&(this.d={...this.d,vendor_id:this.presetVendor})}async load(){this.loaded=!0;try{const[t,e]=await Promise.all([u.options(),this.taskId?u.task(this.taskId):Promise.resolve(null)]);this.opts=t,this.prev=e,this.d=e?pe(e):{...ht(this.kind),vendor_id:this.presetVendor||""}}catch(t){this.error=v(t)}}set(t,e){if(this.d={...this.d,[t]:e},this.errors[t]){const{[t]:i,...r}=this.errors;this.errors=r}}async save(){const t=he(this.d);if(this.errors=t,!Object.keys(t).length){this.busy=!0,this.error="";try{const e=this.prev?await u.update(this.prev.id,Et(this.d,this.prev)):await u.create(Et(this.d));this.dispatchEvent(new CustomEvent("saved",{detail:{id:e.id,text:a("saved")}}))}catch(e){if(e instanceof I&&e.status===422){const i=Wt(e)[0];i&&(this.errors={...this.errors,[i==="interval"?"every":i]:"fRequired"})}e instanceof I&&e.code==="revision_conflict"?(this.error=a("conflict"),this.loaded=!1,await this.load()):this.error=v(e)}finally{this.busy=!1}}}err(t){return this.errors[t]?n`<span class="err" id=${`e-${t}`}>${a(this.errors[t])}</span>`:d}text(t,e,i=!1){return n`<div class="fld"><label for=${`f-${t}`}>${a(e)}</label>
      ${i?n`<sw-field><textarea id=${`f-${t}`} maxlength="2000" .value=${this.d[t]} @input=${r=>this.set(t,r.target.value)}></textarea></sw-field>`:n`<sw-field><input id=${`f-${t}`} maxlength="120" .value=${this.d[t]} aria-invalid=${String(!!this.errors[t])} data-maint-field=${t}
            @input=${r=>this.set(t,r.target.value)}></sw-field>`}${this.err(t)}</div>`}date(t,e){return n`<div class="fld"><label for=${`f-${t}`}>${a(e)}</label><sw-field><input id=${`f-${t}`} class="num" type="date" lang=${ot()} .value=${this.d[t]} aria-invalid=${String(!!this.errors[t])}
      data-maint-field=${t} @input=${i=>this.set(t,i.target.value)}></sw-field>${this.err(t)}</div>`}vendorField(t){const e=t.vendors.find(s=>s.id===this.d.vendor_id),i=ct(e),r=this.d.kind==="vendor_document";return n`<div class="fld"><label for="f-vendor">${a("fVendor")}</label>
      <sw-field><select id="f-vendor" aria-invalid=${String(!!this.errors.vendor_id)} data-maint-field="vendor_id" @change=${s=>this.set("vendor_id",s.target.value)}>
        ${r?d:n`<option value="" ?selected=${!this.d.vendor_id}>${a("fVendorNone")}</option>`}
        ${r&&!this.d.vendor_id?n`<option value="" selected disabled>${a("fVendor")}</option>`:d}
        ${t.vendors.map(s=>{const o=ct(s);return n`<option value=${s.id} ?selected=${s.id===this.d.vendor_id}>${s.name}${o&&o.look!=="ok"?` · ${o.text}`:""}</option>`})}
      </select></sw-field>
      ${i&&i.look!=="ok"&&this.d.kind!=="vendor_document"?n`<span class="chip" data-look=${i.look} data-maint-vendor-mark>${i.text}</span>`:d}${this.err("vendor_id")}</div>`}assetField(t){const e=t.elevators??[],i=t.generators??[];return!e.length&&!i.length?d:n`<div class="fld"><label for="f-asset">${a("fAsset")}</label>
      <sw-field><select id="f-asset" data-maint-field="asset" @change=${r=>this.set("asset",r.target.value)}>
        <option value="" ?selected=${!this.d.asset}>${a("fAssetNone")}</option>
        ${e.length?n`<optgroup label=${a("elevator")}>${e.map(r=>n`<option value=${`elevator:${r.id}`} ?selected=${this.d.asset===`elevator:${r.id}`}>${r.name}</option>`)}</optgroup>`:d}
        ${i.length?n`<optgroup label=${a("generator")}>${i.map(r=>n`<option value=${`generator:${r.id}`} ?selected=${this.d.asset===`generator:${r.id}`}>${r.name}</option>`)}</optgroup>`:d}
      </select></sw-field></div>`}intervalField(){const t=this.d.kind==="certificate"||this.d.kind==="vendor_document";return n`<div class="row"><div class="fld"><label for="f-every">${a("fInterval")}</label>
        <sw-field><input id="f-every" class="num" inputmode="numeric" .value=${this.d.every} placeholder=${t?a("fIntervalNone"):""} aria-invalid=${String(!!this.errors.every)} data-maint-field="every"
          @input=${e=>this.set("every",e.target.value.replace(/[^0-9]/g,"").slice(0,3))}></sw-field>${this.err("every")}</div>
      <div class="fld"><label for="f-unit" class="lbl">&nbsp;</label><sw-field><select id="f-unit" aria-label=${a("fInterval")} @change=${e=>this.set("unit",e.target.value)}>
        ${Xt.map(e=>n`<option value=${e} ?selected=${this.d.unit===e}>${a(`fUnit_${e}`)}</option>`)}</select></sw-field></div></div>`}checklist(){const t=this.d.checklist,e=(r,s)=>this.set("checklist",t.map((o,l)=>l===r?{...o,...s}:o)),i=r=>r.trim()===""||Number.isNaN(Number(r))?null:Number(r);return n`<div class="fld"><span class="lbl">${a("fChecklist")}</span><div class="items" data-maint-checklist>
      ${t.map((r,s)=>n`<div class="item" data-maint-item=${s}>
        <div class="fld"><label for=${`it-${r._id}`}>${a("fItemLabel")} ${s+1}</label><sw-field><input id=${`it-${r._id}`} maxlength="120" .value=${r.label} @input=${o=>e(s,{label:o.target.value})}></sw-field></div>
        <div class="fld"><label for=${`ik-${r._id}`}>${a("fItemKind")}</label><sw-field><select id=${`ik-${r._id}`} @change=${o=>e(s,{kind:o.target.value})}>
          ${["check","number","text"].map(o=>n`<option value=${o} ?selected=${(r.kind??"check")===o}>${a(o==="check"?"fItemCheck":o==="number"?"fItemNumber":"fItemText")}</option>`)}</select></sw-field></div>
        <button type="button" class="btn sm ghost" aria-label=${`${a("fItemRemove")} ${s+1}`} @click=${()=>this.set("checklist",t.filter((o,l)=>l!==s))}><sw-icon name="trash" size="14"></sw-icon></button>
        <div class="range">
          ${r.kind==="number"?n`<label class="mut" for=${`mn-${r._id}`}>${a("fItemMin")}</label><sw-field><input id=${`mn-${r._id}`} class="num" inputmode="decimal" .value=${r.min??""} @input=${o=>e(s,{min:i(o.target.value)})}></sw-field>
            <label class="mut" for=${`mx-${r._id}`}>${a("fItemMax")}</label><sw-field><input id=${`mx-${r._id}`} class="num" inputmode="decimal" .value=${r.max??""} @input=${o=>e(s,{max:i(o.target.value)})}></sw-field>`:d}
          <label class="check"><sw-toggle size="sm" labelHidden in-label label=${a("fItemRequired")} .checked=${r.required!==!1} @change=${o=>e(s,{required:_t(o)})}></sw-toggle>${a("fItemRequired")}</label>
          ${this.err(`item${s}`)}
        </div></div>`)}
      <button type="button" class="btn sm" data-maint-add-item @click=${()=>this.set("checklist",[...t,ue()])}><sw-icon name="plus" size="14"></sw-icon>${a("fAddItem")}</button>
      ${this.err("checklist")}</div></div>`}fields(t){const e=this.d.kind,i=e==="preventive"||e==="round",r=ve(t),s=t.defaults.lead_days[e],o=["certificate","vendor_document"];return n`<div class="form" data-maint-form=${e}>
      ${!this.taskId&&o.includes(e)?n`<sw-segmented label=${a("fKind")} data-maint-form-kind value=${e}
        @change=${l=>{const h=l.detail.value;this.d={...ht(h),title:this.d.title,vendor_id:this.d.vendor_id},this.errors={}}}
        .options=${o.map(l=>({value:l,label:a(l==="certificate"?"kindCerts":"kindVendorDocs"),attrs:{"data-kind":l}}))}></sw-segmented>`:d}
      ${this.text("title","fTitle")}
      <div class="row">
        ${e==="vendor_document"?n`<div class="fld"><label for="f-doc">${a("fDocType")}</label><sw-field><select id="f-doc" data-maint-field="doc_type" @change=${l=>this.set("doc_type",l.target.value)}>
              ${Qt.map(l=>n`<option value=${l} ?selected=${this.d.doc_type===l}>${dt(l)}</option>`)}</select></sw-field></div>`:n`<div class="fld"><label for="f-cat">${a("fCategory")}</label><sw-field><select id="f-cat" @change=${l=>this.set("category",l.target.value)}>
              ${Zt.map(l=>n`<option value=${l} ?selected=${this.d.category===l}>${Ut(l)}</option>`)}</select></sw-field></div>`}
        ${e==="vendor_document"?d:n`<div class="fld"><label for="f-place">${a("fPlace")}</label><sw-field><select id="f-place" data-maint-field="place" @change=${l=>this.set("place",l.target.value)}>
          ${t.placeless||!r.length?n`<option value="" ?selected=${!this.d.place}>${a("fPlaceNone")}</option>`:d}
          ${r.map(l=>n`<option value=${l.value} ?selected=${this.d.place===l.value}>${l.label}</option>`)}</select></sw-field></div>`}
      </div>
      ${e==="vendor_document"?d:this.assetField(t)}
      ${this.vendorField(t)}
      <div class="row">${i?this.date("anchor_date","fFirstDate"):this.date("due_date","fValidUntil")}
        <div class="fld"><label for="f-lead">${a("fLead")}</label><sw-field><input id="f-lead" class="num" inputmode="numeric" .value=${this.d.lead} placeholder=${String(s)}
          aria-describedby="f-lead-h" aria-invalid=${String(!!this.errors.lead)} data-maint-field="lead" @input=${l=>this.set("lead",l.target.value.replace(/[^0-9]/g,"").slice(0,3))}></sw-field>
          <span class="mut" id="f-lead-h">${a("fLeadHint",{n:s})}</span>${this.err("lead")}</div></div>
      ${this.intervalField()}
      <div class="fld"><label for="f-owner">${a("fOwner")}</label><sw-field><select id="f-owner" @change=${l=>this.set("owner_user_id",l.target.value)}>
        <option value="" ?selected=${!this.d.owner_user_id}>${a("fOwnerNone")}</option>${t.people.map(l=>n`<option value=${l.id} ?selected=${l.id===this.d.owner_user_id}>${l.name}</option>`)}</select></sw-field></div>
      ${i?this.checklist():d}
      ${this.ticketsOn&&t.tickets_on&&e!=="vendor_document"?n`<div class="fld" data-maint-auto-ticket>
        <label class="check"><sw-toggle size="sm" labelHidden in-label label=${a("fAutoTicket")} .checked=${this.d.auto_ticket} @change=${l=>this.set("auto_ticket",_t(l))}></sw-toggle>${a("fAutoTicket")}</label>
        ${this.d.auto_ticket?n`<sw-field><select aria-label=${a("fDepartment")} aria-invalid=${String(!!this.errors.department_id)} data-maint-field="department_id" @change=${l=>this.set("department_id",l.target.value)}>
          <option value="" ?selected=${!this.d.department_id} disabled>${a("fDepartmentPick")}</option>${t.departments.map(l=>n`<option value=${l.id} ?selected=${l.id===this.d.department_id}>${l.name}</option>`)}</select></sw-field>${this.err("department_id")}`:d}</div>`:d}
      ${this.text("notes","fNotes",!0)}
      ${this.error?n`<div class="alert err" role="alert" data-maint-form-error>${this.error}</div>`:d}
    </div>`}render(){const t=this.opts;return n`<sw-dialog open wide heading=${this.taskId?`${a("formEdit")}: ${this.prev?.title??""}`:a(Ae[this.kind])} data-maint-task-form @close=${()=>this.dispatchEvent(new CustomEvent("close"))}>
      ${t?this.fields(t):this.error?n`<div class="alert err" role="alert">${this.error}</div>`:n`<div class="skl" aria-busy="true" aria-label=${a("loading")}></div>`}
      <div class="foot" slot="footer"><span class="sp"></span><button type="button" class="btn" @click=${()=>this.dispatchEvent(new CustomEvent("close"))}>${a("cancel")}</button>
        <button type="button" class="btn pri" ?disabled=${this.busy||!t} data-maint-save @click=${()=>void this.save()}>${a(this.taskId?"fSave":"fCreate")}</button></div>
    </sw-dialog>`}};_.styles=S;P([f()],_.prototype,"kind",2);P([f()],_.prototype,"taskId",2);P([f({type:Boolean})],_.prototype,"ticketsOn",2);P([f()],_.prototype,"presetVendor",2);P([p()],_.prototype,"opts",2);P([p()],_.prototype,"prev",2);P([p()],_.prototype,"d",2);P([p()],_.prototype,"errors",2);P([p()],_.prototype,"error",2);P([p()],_.prototype,"busy",2);P([p()],_.prototype,"loaded",2);_=P([z("maint-task-form")],_);var Be=Object.defineProperty,je=Object.getOwnPropertyDescriptor,X=(t,e,i,r)=>{for(var s=r>1?void 0:r?je(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&Be(e,i,s),s};let F=class extends T{constructor(){super(...arguments),this.vendorId="",this.card=null,this.vendors=[],this.error=""}willUpdate(t){t.has("vendorId")&&this.vendorId&&this.load()}async load(){try{const[t,e]=await Promise.all([u.vendor(this.vendorId),this.access?.ticketsOn?u.vendors().catch(()=>({items:[]})):Promise.resolve({items:[]})]);this.card=t,this.vendors=e.items}catch(t){this.error=v(t)}}open(t,e,i){i?.stopPropagation(),this.dispatchEvent(new CustomEvent("open-task",{detail:{id:t,mode:e}}))}render(){const t=this.card,e=this.vendors.find(r=>r.id===this.vendorId),i=ct(e);return n`<sw-dialog open xl heading=${t?.name??""} subheading=${t?a("vendorSub",{n:t.documents.length}):""} data-maint-vendor=${this.vendorId} @close=${()=>this.dispatchEvent(new CustomEvent("close"))}>
      ${this.error?n`<sw-state-panel state="error" heading=${this.error} compact></sw-state-panel>`:t?n`
        <div class="two">
          <div>
            <div class="panel"><div class="hd"><h4>${a("documents")}</h4><span class="sp"></span>
              ${this.access.manage?n`<button type="button" class="btn sm" data-maint-new-doc @click=${()=>this.dispatchEvent(new CustomEvent("new-document",{detail:this.vendorId}))}><sw-icon name="plus" size="14"></sw-icon>${a("newDocument")}</button>`:d}</div>
              ${t.documents.length?n`<div class="list" data-maint-docs>${t.documents.map(r=>n`<div class="li" data-look=${B(r)} data-maint-doc=${r.id}>
                  <div class="grow"><div class="t1">${dt(r.doc_type)}${r.title&&r.title!==dt(r.doc_type)?n` <span class="mut">· ${r.title}</span>`:d}</div>
                    <div class="t2">${a("validUntil")} <span class="num">${x(r.due_date)}</span></div></div>
                  <span class="badge">${U(r)}</span>
                  ${this.access.manage?n`<button type="button" class="btn sm" data-maint-doc-renew=${r.id} @click=${s=>this.open(r.id,"complete",s)}>${a("renew")}</button>`:n`<button type="button" class="btn sm ghost" @click=${s=>this.open(r.id,"view",s)}>${a("scanOpen")}</button>`}
                </div>`)}</div>`:n`<div class="mut">${a("noDocuments")}</div>`}
            </div>
            ${t.tasks.length?n`<div class="panel"><div class="hd"><h4>${a("vendorTasks")}</h4></div><div class="list">${t.tasks.map(r=>n`<div class="li" data-look=${B(r)}>
                <div class="grow"><div class="t1">${r.title}</div><div class="t2 num">${x(r.due_date)}</div></div><span class="badge">${U(r)}</span>
                <button type="button" class="btn sm ghost" @click=${s=>this.open(r.id,"view",s)}>${a("scanOpen")}</button></div>`)}</div></div>`:d}
          </div>
          ${this.access.ticketsOn&&this.vendors.length?n`<div><div class="panel" data-maint-picker><div class="hd"><h4>${a("vendorPicker")}</h4></div>
            <div class="list">${this.vendors.slice(0,8).map(r=>{const s=ct(r);return n`<div class="li" data-look=${s?.look??"unk"}><div class="grow"><div class="t1">${r.name}</div></div>
                <span class="chip" data-look=${s?.look??"unk"}>${s?.text??a("vendorNoDocs")}</span></div>`})}</div>
            ${i?.look==="alarm"?n`<div class="alert err" role="note" style="margin-block-start:12px" data-maint-expired-note><sw-icon name="warning" size="18"></sw-icon>
              <div><b>${e?.expired.some(r=>r.doc_type==="insurance")?a("noValidInsurance",{v:t.name}):a("noValidDoc",{v:t.name})}</b><div class="mut">${a("needsApproval")}</div></div></div>`:d}
          </div></div>`:d}
        </div>`:n`<div class="skl" aria-busy="true" aria-label=${a("loading")}></div>`}
      <div class="foot" slot="footer"><span class="sp"></span><button type="button" class="btn" @click=${()=>this.dispatchEvent(new CustomEvent("close"))}>${a("close")}</button></div>
    </sw-dialog>`}};F.styles=S;X([f()],F.prototype,"vendorId",2);X([f({attribute:!1})],F.prototype,"access",2);X([p()],F.prototype,"card",2);X([p()],F.prototype,"vendors",2);X([p()],F.prototype,"error",2);F=X([z("maint-vendor-card")],F);var Fe=Object.defineProperty,Ue=Object.getOwnPropertyDescriptor,q=(t,e,i,r)=>{for(var s=r>1?void 0:r?Ue(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&Fe(e,i,s),s};let C=class extends T{constructor(){super(...arguments),this.runId="",this.run=null,this.i=0,this.drafts={},this.error="",this.busy=!1,this.note="",this.dept="",this.flash="",this.view="step",this.viewChosen=!1,this.dirty=new Set}willUpdate(t){t.has("runId")&&this.runId&&this.load(),t.has("access")&&this.access&&!this.viewChosen&&(this.view=me(this.access.roundView),this.viewChosen=!0)}async setView(t){t!==this.view&&(this.view==="step"?await this.saveCurrent():await this.saveAll(),this.view=t,this.viewChosen=!0,fe(t))}async saveAll(){const t=this.run;if(!t||!t.can.write||!this.dirty.size)return!0;const e={};for(const i of t.checklist){if(!this.dirty.has(i.key))continue;const r=Ot(i,this.drafts[i.key]??{});r&&(e[i.key]=r)}if(!Object.keys(e).length)return this.dirty.clear(),!0;try{return this.apply(await u.answers(t.id,e),!1),this.dirty.clear(),!0}catch(i){return this.error=v(i),!1}}async load(){try{const t=await u.run(this.runId);this.apply(t,!0)}catch(t){this.error=v(t)}}apply(t,e){this.run=t;const i={};for(const r of t.checklist){const s=t.answers[r.key];s&&(i[r.key]={ok:s.ok??null,value:s.value??null,note:s.note??""})}this.drafts={...i,...Object.fromEntries(Object.entries(this.drafts).filter(([r])=>!(r in i)))},e&&(this.i=$e(t.checklist,t.answers)),this.dept=t.task.department_id||t.request_departments?.[0]?.id||""}item(){return this.run?.checklist[this.i]??null}setDraft(t,e){this.drafts={...this.drafts,[t]:{...this.drafts[t],...e}},this.dirty.add(t)}async saveCurrent(){const t=this.run,e=this.item();if(!t||!e||!t.can.write||!this.dirty.has(e.key))return!0;const i=Ot(e,this.drafts[e.key]??{});if(!i)return!0;try{return this.apply(await u.answers(t.id,{[e.key]:i}),!1),this.dirty.delete(e.key),!0}catch(r){return this.error=v(r),!1}}async go(t){if(!this.busy){this.busy=!0,this.error="";try{await this.saveCurrent()&&(this.i=Math.max(0,Math.min(this.run?.checklist.length??0,this.i+t)))}finally{this.busy=!1}}}async request(t){const e=this.run;if(e){this.busy=!0,this.error="";try{if(!await(this.view==="list"?this.saveAll():this.saveCurrent()))return;const i=await u.request(e.id,t,this.dept?{department_id:this.dept}:{});this.apply(i.run,!1),this.flash=a("requestOpened")}catch(i){this.error=i instanceof I&&i.code==="request_exists"?a("requestOpened"):v(i)}finally{this.busy=!1}}}async finish(){let t=this.run;if(!t||this.view==="list"&&!await this.saveAll())return;t=this.run;const e=ge(t.checklist,t.answers);if(e.length){this.error=a("missingRequired"),this.i=t.checklist.findIndex(i=>i.key===e[0]),this.view==="list"&&this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-maint-point="${e[0]}"]`)?.scrollIntoView({block:"center"}));return}this.busy=!0;try{await u.finish(t.id,this.note.trim()||void 0),this.dispatchEvent(new CustomEvent("done",{detail:a("runDone")}))}catch(i){this.error=v(i)}finally{this.busy=!1}}async cancelRun(){const t=this.run;if(t){this.busy=!0;try{await u.cancel(t.id),this.dispatchEvent(new CustomEvent("done",{detail:a("runCancelled")}))}catch(e){this.error=v(e)}finally{this.busy=!1}}}requestBox(t){const e=this.run;if(!this.access.request||!e.can.open_request||!e.can.write)return d;const i=this.drafts[t.key]??{};if(!(i.ok===!1||t.kind==="number"&&ut(t,typeof i.value=="number"?i.value:null)))return d;const s=e.answers[t.key]?.ticket_id,o=e.request_departments??[];return n`<div class="req" data-maint-request=${t.key}><span>${a("openRequest")}</span>
      ${s?n`<a class="chip" data-look="ok" href=${`#/tickets/${encodeURIComponent(s)}`}>${a("requestOpened")}</a>`:n`${!e.task.department_id&&o.length>1?n`<select class="inp" style="inline-size:auto" aria-label=${a("fDepartment")} @change=${l=>{this.dept=l.target.value}}>
              ${o.map(l=>n`<option value=${l.id} ?selected=${l.id===this.dept}>${l.name}</option>`)}</select>`:d}
            <button type="button" class="btn sm" ?disabled=${this.busy||!e.task.department_id&&!o.length} data-maint-request-open @click=${()=>void this.request(t.key)}>${a("openRequestBtn")}</button>`}
    </div>`}point(t){const e=this.drafts[t.key]??{},i=t.kind??"check",r=!this.run.can.write,s=typeof e.value=="number"?e.value:null,o=i==="number"&&ut(t,s),l=`q-${t.key}`;return n`<div class="q" id=${l}>${t.label}${t.required===!1?d:n` <span class="mut">· ${a("required")}</span>`}</div>
      ${i==="check"?n`<div class="yn" role="group" aria-labelledby=${l}>
          <button type="button" class="yes" aria-pressed=${String(e.ok===!0)} ?disabled=${r} data-maint-yes @click=${()=>this.setDraft(t.key,{ok:!0})}>${a("yes")}</button>
          <button type="button" class="no" aria-pressed=${String(e.ok===!1)} ?disabled=${r} data-maint-no @click=${()=>this.setDraft(t.key,{ok:!1})}>${a("no")}</button></div>`:i==="number"?n`<input class="numin" inputmode="decimal" dir="ltr" aria-labelledby=${l} aria-invalid=${String(o)} ?disabled=${r} .value=${s??""} data-maint-number
            @input=${h=>{const $=h.target.value.replace(",",".");this.setDraft(t.key,{value:$.trim()===""||Number.isNaN(Number($))?null:Number($),ok:null})}}>
          ${o?n`<div class="chip req-chip" data-look="alarm" data-maint-out>${a("outOfRange")} <span class="num">${vt(t)}</span></div>`:vt(t)?n`<div class="mut">${vt(t)}</div>`:d}
          ${!o&&s!==null?n`<label class="check"><input type="checkbox" .checked=${e.ok===!1} ?disabled=${r} @change=${h=>this.setDraft(t.key,{ok:h.target.checked?!1:null})}>${a("no")} - ${a("outOfRange")}</label>`:d}`:n`<textarea class="inp" aria-labelledby=${l} maxlength="300" ?disabled=${r} .value=${typeof e.value=="string"?e.value:""} data-maint-text
              @input=${h=>this.setDraft(t.key,{value:h.target.value})}></textarea>`}
      ${i!=="text"?n`<input class="inp" placeholder=${a("noteField")} aria-label=${a("noteField")} maxlength="300" ?disabled=${r} .value=${e.note??""} data-maint-note
          @input=${h=>this.setDraft(t.key,{note:h.target.value})}>`:d}
      ${this.requestBox(t)}`}list(t){const e=t.checklist.filter(i=>Tt(i,{...t.answers[i.key],...this.draftAnswer(i)})).length;return n`<div class="mut" data-maint-list-progress>${a("listProgress",{a:e,b:t.checklist.length})}</div>
      <ol class="plist" data-maint-list>${t.checklist.map((i,r)=>{const s=this.drafts[i.key]??{},o=s.ok===!1||i.kind==="number"&&ut(i,typeof s.value=="number"?s.value:null);return n`<li data-maint-point=${i.key} data-look=${o?"alarm":"unk"}><span class="mut num">${r+1} / ${t.checklist.length}</span>${this.point(i)}</li>`})}</ol>
      ${this.summary(t)}`}draftAnswer(t){const e=this.drafts[t.key];return e?{ok:e.ok??null,value:e.value??null}:{}}summary(t){const e=be(t.checklist,t.answers),i=t.checklist.map((r,s)=>({it:r,n:s,t:t.answers[r.key]?.ticket_id})).filter(r=>r.t);return n`<div class="q">${a("finishTitle")}</div>
      <div class="dots" role="list">${t.checklist.map((r,s)=>{const o=t.answers[r.key],l=Tt(r,o)?o?.ok===!1?"alarm":"ok":"unk";return n`<button type="button" role="listitem" data-look=${l} aria-label=${`${s+1}. ${r.label}`} @click=${()=>{this.i=s}}>${s+1}</button>`})}</div>
      <div class="mut" data-maint-issues>${e.length===0?a("issues0"):e.length===1?a("issues1"):a("issuesN",{n:e.length})}</div>
      ${this.access.request?i.map(r=>n`<div class="req"><span>${a("pointN",{i:r.n+1})}</span><a class="chip" data-look="ok" href=${`#/tickets/${encodeURIComponent(r.t)}`}>${a("requestOpened")}</a></div>`):d}
      ${t.can.write?n`<input class="inp" placeholder=${a("runNote")} aria-label=${a("runNote")} maxlength="300" .value=${this.note} @input=${r=>{this.note=r.target.value}}>`:d}`}render(){if(this.error&&!this.run)return n`<sw-state-panel state="error" heading=${this.error} actionLabel=${a("backToList")} @action=${()=>this.dispatchEvent(new CustomEvent("close"))}></sw-state-panel>`;const t=this.run;if(!t)return n`<div class="skl" style="inline-size:min(440px,100%)" aria-busy="true" aria-label=${a("loading")}></div>`;const e=t.checklist.length,i=this.i>=e,r=this.item(),s=Math.round(Math.min(this.i,e)/Math.max(1,e)*100),o=this.view==="list";return n`<section class="runner" aria-label=${t.task.title} data-maint-run=${t.id} data-view=${this.view}>
      <div class="ph"><div class="row"><b>${t.task.title}</b>${i||o?d:n`<span class="mut num" data-maint-step>${a("runOf",{a:this.i+1,b:e})}</span>`}
          <span class="vw" role="group" aria-label=${a("viewSwitchLabel")} data-maint-view-switch>
            <button type="button" aria-pressed=${String(!o)} data-view="step" title=${a("viewSwitchToStep")} @click=${()=>void this.setView("step")}>${a("viewStep")}</button>
            <button type="button" aria-pressed=${String(o)} data-view="list" title=${a("viewSwitchToList")} @click=${()=>void this.setView("list")}>${a("viewList")}</button></span></div>
        ${o?d:n`<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax=${e} aria-valuenow=${Math.min(this.i,e)}><i style=${`inline-size:${i?100:s}%`}></i></div>`}</div>
      <div class="pb">
        ${t.can.write?d:n`<div class="alert warn" role="note">${a("runReadOnly",{who:t.started_by_name||"-"})}</div>`}
        ${o?this.list(t):i||!r?this.summary(t):this.point(r)}
        ${this.error?n`<div class="alert err" role="alert">${this.error}</div>`:d}
        ${this.flash?n`<div class="chip" data-look="ok" role="status">${this.flash}</div>`:d}
      </div>
      <div class="pf">
        ${o?n`${t.can.write?n`<button type="button" class="btn pri big" ?disabled=${this.busy} data-maint-finish @click=${()=>void this.finish()}>${a("finish")}</button>
            <button type="button" class="btn" ?disabled=${this.busy} data-maint-cancel-run @click=${()=>void this.cancelRun()}>${a("cancelRun")}</button>`:d}`:i?n`${t.can.write?n`<button type="button" class="btn pri big" ?disabled=${this.busy} data-maint-finish @click=${()=>void this.finish()}>${a("finish")}</button>
            <button type="button" class="btn" ?disabled=${this.busy} data-maint-cancel-run @click=${()=>void this.cancelRun()}>${a("cancelRun")}</button>`:d}`:n`<div class="nav">${this.i>0?n`<button type="button" class="btn big" ?disabled=${this.busy} data-maint-prev @click=${()=>void this.go(-1)}>${a("prev")}</button>`:n`<span></span>`}
            <button type="button" class="btn pri big" ?disabled=${this.busy} data-maint-next @click=${()=>void this.go(1)}>${a("next")}</button></div>`}
        <button type="button" class="btn ghost" data-maint-run-close @click=${()=>{(this.view==="list"?this.saveAll():this.saveCurrent()).then(()=>this.dispatchEvent(new CustomEvent("close")))}}>${a("backToList")}</button>
      </div>
    </section>`}};C.styles=[S,M`
    :host { display: flex; justify-content: center; flex: 1; min-block-size: 0; }
    .runner { inline-size: min(440px, 100%); block-size: 100%; max-block-size: 780px; min-block-size: 0; border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1); display: flex; flex-direction: column; overflow: hidden; }
    .ph { padding: 14px 16px 10px; border-block-end: 1px solid var(--sw-border); }
    .ph .row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .ph b { color: var(--sw-heading); }
    .prog { block-size: 6px; background: var(--sw-surface-3); border-radius: var(--sw-r-2xs); overflow: hidden; margin-block-start: 8px; }
    .prog i { display: block; block-size: 100%; background: var(--sw-accent); transition: inline-size var(--sw-t-fast) var(--sw-ease-out); }
    .pb { flex: 1; min-block-size: 0; overflow: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; }
    .runner[data-view='list'] { inline-size: min(720px, 100%); max-block-size: none; }
    .plist { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .plist li { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); background: var(--sw-surface); }
    .plist li[data-look='alarm'] { border-color: var(--sw-danger); }
    .plist .q { font-size: var(--sw-fs-lg); }
    .plist .yn button { padding: 10px 0; min-block-size: 44px; font-size: var(--sw-fs-lg); }
    .plist .numin { font-size: var(--sw-fs-xl); padding: 8px; }
    .vw { display: inline-flex; padding: 2px; gap: 2px; background: var(--sw-surface-3); border-radius: var(--sw-r-sm); }
    .vw button { border: 0; background: transparent; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding: 4px 10px; border-radius: calc(var(--sw-r-sm) - 2px); cursor: pointer; min-block-size: 32px; }
    .vw button[aria-pressed='true'] { background: var(--sw-seg-key, var(--sw-surface-solid)); color: var(--sw-seg-key-ink, var(--sw-text)); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    .vw button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    .q { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); line-height: 1.3; }
    .yn { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .yn button { border-radius: var(--sw-r-lg); padding: 20px 0; font: inherit; font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-xl); border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface); color: var(--sw-text); cursor: pointer; min-block-size: 64px; }
    .yn .yes[aria-pressed='true'] { border-color: var(--sw-success); background: var(--sw-success-soft); color: var(--sw-success-text); }
    .yn .no[aria-pressed='true'] { border-color: var(--sw-danger); background: var(--sw-danger-soft); color: var(--sw-danger-text); }
    .yn button:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .numin { font: inherit; font-size: var(--sw-fs-3xl); text-align: center; inline-size: 100%; padding: 12px; border-radius: var(--sw-r-md); border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface); color: var(--sw-heading); font-variant-numeric: tabular-nums; box-sizing: border-box; }
    .numin[aria-invalid='true'] { border-color: var(--sw-danger); box-shadow: 0 0 0 3px var(--sw-danger-soft); }
    .req { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); padding: 10px 12px; background: var(--sw-surface); display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
    .pf { padding: 12px 16px 18px; display: grid; gap: 8px; border-block-start: 1px solid var(--sw-border); }
    .pf .nav { display: grid; grid-template-columns: auto 1fr; gap: 8px; }
    .dots { display: flex; gap: 6px; flex-wrap: wrap; }
    .dots button { inline-size: 32px; block-size: 32px; border-radius: 50%; display: grid; place-items: center; font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold);
      background: var(--c-soft, var(--sw-surface-3)); color: var(--c-text, var(--sw-text-2)); border: 0; cursor: pointer; }
    .req-chip { justify-self: start; }
    @media (max-width: 767px) {
      .runner { max-block-size: none; border-radius: var(--sw-r-lg); }
    }
  `];q([f()],C.prototype,"runId",2);q([f({attribute:!1})],C.prototype,"access",2);q([p()],C.prototype,"run",2);q([p()],C.prototype,"i",2);q([p()],C.prototype,"drafts",2);q([p()],C.prototype,"error",2);q([p()],C.prototype,"busy",2);q([p()],C.prototype,"note",2);q([p()],C.prototype,"dept",2);q([p()],C.prototype,"flash",2);q([p()],C.prototype,"view",2);C=q([z("maint-round-run")],C);var Ve=Object.defineProperty,He=Object.getOwnPropertyDescriptor,b=(t,e,i,r)=>{for(var s=r>1?void 0:r?He(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&Ve(e,i,s),s};const Ht="sw.maintenance.collapsed",Ke={ok:"ok",warn:"warn",alarm:"bad",acc:"info",unk:void 0},Ge=6e4;function Ye(){try{const t=JSON.parse(localStorage.getItem(Ht)??"[]");return new Set(Array.isArray(t)?t.filter(e=>typeof e=="string").slice(0,200):[])}catch{return new Set}}const qt={ledger:{err:"errLedger",empty:"emptyLedger",emptyBody:"emptyLedgerBody",emptyBodyTickets:"emptyLedgerBody",add:"newCert",first:"firstCert",icon:"inbox"},plans:{err:"errPlans",empty:"emptyPlans",emptyBody:"emptyPlansBody",emptyBodyTickets:"emptyPlansTickets",add:"newPlan",first:"firstPlan",icon:"wrench"},rounds:{err:"errRounds",empty:"emptyRounds",emptyBody:"emptyRoundsBody",emptyBodyTickets:"emptyRoundsTickets",add:"newRound",first:"firstRound",icon:"check"}};let g=class extends T{constructor(){super(...arguments),this.page="ledger",this.openTask="",this.openRun="",this.items=null,this.error="",this.kpi="all",this.place="all",this.seg="all",this.q="",this.collapsed=Ye(),this.sheet=null,this.sheetMode="view",this.form=null,this.vendor=null,this.run=null,this.toaster=new Vt(this,{ms:2600}),this.poll=new yt(this),this.loadedFor="",this.fit=new kt(this,()=>this.renderRoot.querySelector(".scrollx"),()=>!this.run&&!!this.items?.length),this.narrowMq=window.matchMedia("(max-width: 1100px)"),this.narrow=this.narrowMq.matches,this.onNarrow=()=>{this.narrow=this.narrowMq.matches},this.pendingVendor=""}get toast(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.narrowMq.addEventListener("change",this.onNarrow),this.narrow=this.narrowMq.matches,this.poll.every("tasks",Ge,()=>this.load(),{when:()=>!this.run&&!this.form})}disconnectedCallback(){this.narrowMq.removeEventListener("change",this.onNarrow),super.disconnectedCallback()}willUpdate(t){t.has("page")&&this.loadedFor!==this.page&&(this.loadedFor=this.page,this.items=null,this.error="",this.kpi="all",this.seg="all",this.place="all",this.run=null,this.load()),t.has("openTask")&&this.openTask&&this.items&&this.openById(this.openTask),t.has("openRun")&&this.openRun&&(this.run=this.openRun),this.toggleAttribute("data-fit",this.fit.fits)}async load(){try{const t=we[this.page],e=await Promise.all(t.map(r=>u.tasks({kind:r,include_inactive:!0}))),i=!this.items;this.items=e.flatMap(r=>r.items),this.error="",i&&this.openTask&&this.openById(this.openTask)}catch(t){this.items||(this.error=v(t))}}flash(t){this.toaster.show(t)}openById(t){const e=this.items?.find(i=>i.id===t);e?.kind==="vendor_document"&&e.vendor_id?this.vendor=e.vendor_id:this.sheet=t,this.sheetMode="view"}openRow(t){if(t.kind==="vendor_document"&&t.vendor_id){this.vendor=t.vendor_id;return}this.sheetMode="view",this.sheet=t.id}async act(t,e){e.stopPropagation();try{if(!t.active)await u.update(t.id,{active:!0,revision:t.revision}),this.flash(a("resumedToast"));else if(t.kind==="round"){t.open_run?this.run=t.open_run.id:this.run=(await u.startRun(t.id)).id;return}else if(t.kind==="preventive")await u.complete(t.id,{revision:t.revision}),this.flash(a("doneToast"));else{this.sheetMode="complete",this.sheet=t.id;return}await this.load()}catch(i){if(i instanceof I&&i.status===409){const r=i.body?.details?.run_id;if(r){this.run=r;return}this.flash(a("conflict")),await this.load();return}this.flash(v(i))}}action(t,e=!1){const i=this.access;let r=null,s=!1;return t.active?t.kind==="round"?(r=i.perform?t.open_run?"continue":"start":null,s=!!t.open_run):t.kind==="preventive"?r=i.perform?"markDone":null:r=i.manage?"renew":null:r=i.manage?"resume":null,r?e?n`<sw-button size="sm" variant=${s?"primary":"secondary"} data-maint-act=${r} data-task=${t.id} @click=${o=>void this.act(t,o)}>${a(r)}</sw-button>`:n`<button type="button" class="btn sm ${s?"pri":""}" data-maint-act=${r} data-task=${t.id} @click=${o=>void this.act(t,o)}>${a(r)}</button>`:d}requestCell(t){return t.ticket_id?n`<a class="chip" data-look="acc" href=${`#/tickets/${encodeURIComponent(t.ticket_id)}`} data-maint-ticket=${t.ticket_id} @click=${e=>e.stopPropagation()}>${a("requestOpen")}</a>`:t.auto_ticket?n`<span class="chip">${a("autoRequest")}</span>`:n`<span class="mut">${a("dash")}</span>`}placeName(t){return t.place?.name||""}kindCell(t){const e=tt(t.interval);return[V(t.kind),e].filter(Boolean).join(" · ")}requestTableCell(t){return t.ticket_id?n`<a class="chip" part="request" data-tone="info" data-nodot href=${`#/tickets/${encodeURIComponent(t.ticket_id)}`} data-maint-ticket=${t.ticket_id} @click=${e=>e.stopPropagation()}>${a("requestOpen")}</a>`:t.auto_ticket?n`<span class="chip" data-nodot>${a("autoRequest")}</span>`:n`<span class="mut">${a("dash")}</span>`}columns(){const t=this.page,e=n`<span class="mut">${a("dash")}</span>`,i={key:"state",label:a("colState"),kind:"status",render:m=>n`<span class="chip" data-tone=${Ke[B(m)]??d} data-maint-badge>${U(m)}</span>`},r={key:"title",label:a(t==="ledger"?"colName":t==="plans"?"colPlan":"colRound"),render:m=>n`<span class="t1">${m.title}</span>${Pt(m)?n`<span class="t2">${Pt(m)}</span>`:d}`},s={key:"place",label:a("colPlace"),render:m=>this.placeName(m)||e},o=!this.narrow,l=o?[{key:"vendor",label:a("colVendor"),render:m=>m.vendor_name||e}]:[],h={key:"due",label:a(t==="ledger"?"colValidUntil":"colNext"),render:m=>m.due_date&&m.active?n`<span class="num">${x(m.due_date)}</span>`:e},$={key:"act",label:"",kind:"actions",render:m=>this.action(m,!0)};if(t==="ledger")return[i,r,{key:"kind",label:a("colKind"),render:m=>this.kindCell(m)},s,...l,h,$];const k={key:"interval",label:a(t==="plans"?"colInterval":"colFreq"),render:m=>tt(m.interval)},nt=this.access.ticketsOn&&o?[{key:"request",label:a("colRequest"),render:m=>this.requestTableCell(m)}]:[];return t==="plans"?[i,r,k,s,...l,h,...nt,$]:[i,r,k,s,{key:"points",label:a("colPoints"),kind:"num",render:m=>String(m.checklist_count)},...o?[{key:"last",label:a("colLastRun"),render:m=>zt(m)||e}]:[],h,$]}card(t){const e=this.page==="rounds"?[tt(t.interval),this.placeName(t),zt(t),t.due_date?x(t.due_date):""]:[this.page==="ledger"?this.kindCell(t):tt(t.interval),this.placeName(t),t.vendor_name??"",t.due_date&&t.active?x(t.due_date):""],i=this.action(t);return n`<div class="c" role="button" tabindex="0" data-look=${B(t)} data-maint-card=${t.id} @click=${()=>this.openRow(t)}
        @keydown=${r=>{(r.key==="Enter"||r.key===" ")&&(r.preventDefault(),this.openRow(t))}}>
      <div class="r1"><span class="t1">${t.title}</span><span class="badge">${U(t)}</span></div>
      <div class="mut">${e.filter(Boolean).join(" · ")}</div>
      ${i!==d||this.page==="plans"&&this.access.ticketsOn&&t.ticket_id?n`<div class="r3">${i}${this.page==="plans"&&this.access.ticketsOn&&t.ticket_id?this.requestCell(t):d}</div>`:d}
    </div>`}toggleFold(t){const e=new Set(this.collapsed);e.has(t)?e.delete(t):e.add(t),this.collapsed=e;try{localStorage.setItem(Ht,JSON.stringify([...e]))}catch{}}top(t){const e=t.filter(r=>B(r)==="alarm").length,i=this.page==="ledger"?"certificate":this.page==="plans"?"preventive":"round";return n`<div class="top"><div><h1>${a(`page${this.page[0].toUpperCase()}${this.page.slice(1)}`)}</h1>
        <p class="sub" data-maint-sub>${a("section")} · ${t.length?a("subCount",{n:t.length,late:e}):a("subEmpty")}</p></div><span class="sp"></span>
      <div class="meta">
        ${this.access.manage?n`<button type="button" class="btn pri" data-maint-new=${i} @click=${()=>{this.form={kind:i,id:null}}}><sw-icon name="plus" size="16"></sw-icon>${a(qt[this.page].add)}</button>`:d}
      </div></div>`}overlays(){return n`
      ${this.sheet?n`<maint-task-sheet .taskId=${this.sheet} .mode=${this.sheetMode} .access=${this.access} @close=${()=>{this.sheet=null}}
          @changed=${t=>{this.flash(t.detail),this.load()}} @removed=${t=>{this.sheet=null,this.flash(t.detail),this.load()}}
          @edit=${t=>{this.sheet=null,this.form=t.detail}}
          @start-run=${t=>{this.sheet=null,this.run=t.detail}}
          @open-vendor=${t=>{this.sheet=null,this.vendor=t.detail}}></maint-task-sheet>`:d}
      ${this.form?n`<maint-task-form .kind=${this.form.kind} .taskId=${this.form.id} .ticketsOn=${this.access.ticketsOn} @close=${()=>{this.form=null}}
          @saved=${t=>{this.form=null,this.flash(t.detail.text),this.load()}}></maint-task-form>`:d}
      ${this.vendor?n`<maint-vendor-card .vendorId=${this.vendor} .access=${this.access} @close=${()=>{this.vendor=null}}
          @open-task=${t=>{this.vendor=null,this.sheetMode=t.detail.mode,this.sheet=t.detail.id}}
          @new-document=${t=>{this.vendor=null,this.form={kind:"vendor_document",id:null},this.pendingVendor=t.detail}}></maint-vendor-card>`:d}
      ${this.toast?n`<div class="toast" role="status" aria-live="polite" ${At()}>${this.toast}</div>`:d}`}updated(){if(this.pendingVendor){const t=this.renderRoot.querySelector("maint-task-form");t&&(t.presetVendor=this.pendingVendor,this.pendingVendor="")}}render(){const t=qt[this.page];if(this.run)return n`<maint-round-run .runId=${this.run} .access=${this.access} @close=${()=>{this.run=null,this.load()}}
        @done=${h=>{this.run=null,this.flash(h.detail),this.load()}}></maint-round-run>${this.overlays()}`;if(!this.items)return this.error?n`<sw-state-panel state="error" heading=${a(t.err)} hint=${a("errHint")} actionLabel=${a("retry")} data-state="error" @action=${()=>{this.error="",this.load()}}></sw-state-panel>`:n`<div class="top"><div><h1>${a(`page${this.page[0].toUpperCase()}${this.page.slice(1)}`)}</h1></div></div><div class="skl" aria-busy="true" aria-label=${a("loading")} data-state="loading"></div>`;const e=this.items;if(!e.length)return n`${this.top(e)}
        <sw-state-panel icon=${t.icon} state="empty" heading=${a(t.empty)} hint=${a(this.access.ticketsOn?t.emptyBodyTickets:t.emptyBody)} data-state="empty">
          ${this.access.manage?n`<button type="button" class="btn pri" data-maint-first @click=${()=>{this.form={kind:this.page==="ledger"?"certificate":this.page==="plans"?"preventive":"round",id:null}}}><sw-icon name="plus" size="16"></sw-icon>${a(t.first)}</button>`:d}
        </sw-state-panel>${this.overlays()}`;const{shown:i,base:r}=Rt(e,{kpi:this.kpi,place:this.place,seg:this.seg,q:this.q}),s=ye(r),o=St(e.filter(h=>Rt([h],{kpi:"all",place:"all",seg:this.seg,q:this.q}).shown.length),this.collapsed),l=ke(this.page,this.access.ticketsOn);return this.fit.sync(i.length,`${this.page}|${i.map(h=>h.id).join(",")}`),n`${this.top(e)}
      <div class="kpis" role="group" aria-label=${a("kpiStatus")} data-maint-kpis>
        ${xe[this.page].map(h=>n`<button type="button" class="kpi" data-k=${h.key} data-look=${h.key==="all"?d:h.key} aria-pressed=${String(this.kpi===h.key)} data-maint-kpi=${h.key}
            @click=${()=>{this.kpi=this.kpi===h.key||h.key==="all"?"all":h.key}}><span class="dot" aria-hidden="true"></span><div><b>${s[h.key]}</b><span class="l">${a(h.label)}</span></div></button>`)}
      </div>
      <div class="cols">
        <aside class="panel flush tree-w"><sw-place-tree .rows=${o} .selected=${this.place} heading=${a("places")} foldLabel=${a("fold")} unfoldLabel=${a("unfold")} data-maint-tree
          @place-select=${h=>{this.place=h.detail}} @place-toggle=${h=>this.toggleFold(h.detail)}></sw-place-tree></aside>
        <div class="panel flush">
          <div class="tree-m"><select aria-label=${a("place")} data-maint-place-select @change=${h=>{this.place=h.target.value}}>
            ${St(e).map(h=>n`<option value=${h.id} ?selected=${h.id===this.place}>${h.depth?"– ":""}${h.name} (${h.count})</option>`)}</select></div>
          <div class="toolbar">
            ${l.length?n`<sw-segmented label=${a(this.page==="ledger"?"kindFilter":this.page==="plans"?"requestFilter":"freqFilter")} data-maint-segs value=${this.seg} @change=${h=>{this.seg=h.detail.value}}
              .options=${l.map(h=>({value:h.key,label:a(h.label),attrs:{"data-seg":h.key}}))}></sw-segmented>`:d}
            <label class="search"><sw-icon name="search" size="14"></sw-icon><input type="search" placeholder=${a("search")} aria-label=${a("search")} .value=${this.q} data-maint-search
              @input=${h=>{this.q=h.target.value}}></label>
            ${this.fit.fits?n`<span class="pg">${this.fit.pages>1?n`<sw-pager data-maint-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${h=>this.fit.go(h.detail.page)}></sw-pager>`:d}</span>`:d}
          </div>
          ${i.length?n`
            <div class="scrollx"><section class="fitsec"><sw-table bare data-maint-table .columns=${this.columns()}
              .rows=${i.filter((h,$)=>this.fit.shows($))}
              .rowAttrs=${h=>({"data-fit-item":!0,"data-maint-row":String(h.id),"data-look":B(h)})}
              @row-select=${h=>this.openRow(h.detail.row)}></sw-table></section></div>
            <div class="cards-m" data-maint-cards>${i.map(h=>this.card(h))}</div>`:n`<div class="nomatch" data-maint-nomatch>${a("noMatch")}</div>`}
        </div>
      </div>
      ${this.overlays()}`}};g.styles=[S,M`
    :host { flex: 1; overflow: hidden; }
    /* the pager's place at the end of the toolbar is kept while the table fits the window (its height never moves the table) */
    .toolbar .pg { margin-inline-start: auto; min-inline-size: 150px; display: flex; justify-content: flex-end; }
    .fitsec { display: block; }
    /* CR-CMP2-TABLES-GENMAINT-2450 (owner N10): the list is the shared table inside the panel - the module's header band, reading size and
       row padding, never wider than the panel (a long name takes a second line; figures, chips and the row's key stay on one line) */
    sw-table[data-maint-table] { --sw-table-min: 0; --sw-table-head-bg: var(--sw-surface-2); --sw-table-fs: var(--sw-fs-md); --sw-table-cell-pad: 10px 12px; }
    sw-table[data-maint-table]::part(cell) { white-space: normal; }
    sw-table[data-maint-table]::part(cell-num), sw-table[data-maint-table]::part(cell-status), sw-table[data-maint-table]::part(cell-actions) { white-space: nowrap; }
    sw-table[data-maint-table]::part(request) { text-decoration: none; }
    sw-table[data-maint-table]::part(request):focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    @media (max-width: 1100px) { sw-table[data-maint-table] { --sw-table-cell-pad: 10px 8px; } }
    @media (min-width: 1024px) and (min-height: 560px) {
      :host([data-fit][data-long-lists='paged']) .cols > .panel.flush > .scrollx { overflow-y: hidden; }
    }
  `];b([f()],g.prototype,"page",2);b([f({attribute:!1})],g.prototype,"access",2);b([f()],g.prototype,"openTask",2);b([f()],g.prototype,"openRun",2);b([p()],g.prototype,"items",2);b([p()],g.prototype,"error",2);b([p()],g.prototype,"kpi",2);b([p()],g.prototype,"place",2);b([p()],g.prototype,"seg",2);b([p()],g.prototype,"q",2);b([p()],g.prototype,"collapsed",2);b([p()],g.prototype,"sheet",2);b([p()],g.prototype,"sheetMode",2);b([p()],g.prototype,"form",2);b([p()],g.prototype,"vendor",2);b([p()],g.prototype,"run",2);b([p()],g.prototype,"narrow",2);g=b([z("maint-list-page")],g);var Je=Object.defineProperty,We=Object.getOwnPropertyDescriptor,D=(t,e,i,r)=>{for(var s=r>1?void 0:r?We(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&Je(e,i,s),s};function Xe(t){const e=ze(0,"M");e.addData(t),e.make();const i=e.getModuleCount(),r=2;let s="";for(let o=0;o<i;o++)for(let l=0;l<i;l++)e.isDark(o,l)&&(s+=`M${l+r} ${o+r}h1v1h-1z`);return{d:s,size:i+r*2}}const It="maint-printing";let rt=null;function gt(t){try{rt||(rt=new CSSStyleSheet,rt.replaceSync(`@media print { html.${It} body { visibility: hidden; } }`),document.adoptedStyleSheets=[...document.adoptedStyleSheets,rt])}catch{}document.documentElement.classList.toggle(It,t)}let O=class extends T{constructor(){super(...arguments),this.tags=null,this.base="",this.error="",this.tasks=[],this.creating=!1,this.draft={target:"",label:"",medium:"qr"},this.revoke=null,this.busy=!1,this.toaster=new Vt(this,{ms:2600}),this.formError="",this.afterPrint=()=>gt(!1)}get toast(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.load(),window.addEventListener("afterprint",this.afterPrint)}disconnectedCallback(){window.removeEventListener("afterprint",this.afterPrint),gt(!1),super.disconnectedCallback()}async load(){try{const[t,e]=await Promise.all([u.tags(),u.tasks({include_inactive:!1}).catch(()=>({items:[]}))]);this.tags=t.items,this.base=t.base_url,this.tasks=e.items,this.error=""}catch(t){this.tags||(this.error=v(t))}}flash(t){this.toaster.show(t)}url(t){return _e(this.base,t.token,{origin:window.location.origin,pathname:window.location.pathname})}tagColumns(){return[{key:"label",label:a("colLabel"),render:t=>n`<span class="t1">${t.label||this.targetText(t)}</span>`},{key:"target",label:a("colTarget"),render:t=>this.targetText(t)},{key:"medium",label:a("colMedium"),kind:"status",render:t=>n`<span class="chip" data-tone="info" data-nodot>${t.medium.toUpperCase()}</span>`},{key:"created_at",label:a("colCreated"),hideBelow:"tablet",render:t=>n`<span class="num">${x(t.created_at.slice(0,10))}</span>`},{key:"last_scan_at",label:a("colLastScan"),render:t=>t.last_scan_at?n`<span class="num">${R(t.last_scan_at)}</span>`:n`<span class="mut">${a("neverScanned")}</span>`},{key:"act",label:"",kind:"actions",render:t=>n`<sw-button size="sm" variant="danger" data-maint-revoke=${t.id} @click=${()=>{this.revoke=t}}>${a("tagRevoke")}</sw-button>`}]}targetText(t){return t.target_kind==="entity"?a("deviceSuffix",{n:t.target_name||t.target_id}):t.target_name||""}sticker(t){const e=Xe(this.url(t)),i=this.tasks.find(s=>s.id===t.target_id),r=t.target_kind==="entity"?a("tagDevice"):[i?V(i.kind):"",i?.place?.name??""].filter(Boolean).join(" · ");return n`<div class="sticker" data-maint-sticker=${t.id}>
      ${te`<svg viewBox=${`0 0 ${e.size} ${e.size}`} role="img" aria-label=${t.label||this.targetText(t)} shape-rendering="crispEdges"><rect width=${e.size} height=${e.size} fill="#fff"></rect><path d=${e.d} fill="#000"></path></svg>`}
      <div class="l">${t.label||this.targetText(t)}</div><div class="s">${r||this.targetText(t)}</div><div class="path">#/m/${t.token.slice(0,4)}…</div></div>`}async create(){const[t,e]=this.draft.target.split(":");if(!t||!e){this.formError=a("fRequired");return}this.busy=!0,this.formError="";try{await u.createTag({target_kind:t==="entity"?"entity":"task",target_id:e,label:this.draft.label.trim()||void 0,medium:this.draft.medium}),this.creating=!1,this.flash(a("tagCreated")),await this.load()}catch(i){this.formError=v(i)}finally{this.busy=!1}}async doRevoke(t){this.busy=!0;try{await u.revokeTag(t.id),this.revoke=null,this.flash(a("tagRevoked")),await this.load()}catch(e){this.flash(v(e))}finally{this.busy=!1}}print(){gt(!0),requestAnimationFrame(()=>window.print())}createDialog(){const t=[...new Map(this.tasks.filter(e=>e.entity_id).map(e=>[e.entity_id,e.entity_name||e.entity_id])).entries()];return n`<sw-dialog open heading=${a("newTag")} data-maint-tag-form @close=${()=>{this.creating=!1}}>
      <div class="form">
        <div class="fld"><label for="tg-t">${a("tagFor")}</label><select id="tg-t" class="inp" data-maint-tag-target @change=${e=>{const i=e.target.value,r=this.tasks.find(s=>`task:${s.id}`===i);this.draft={...this.draft,target:i,label:this.draft.label||r?.title||""}}}>
          <option value="" ?selected=${!this.draft.target} disabled>${a("tagFor")}</option>
          <optgroup label=${a("tagTask")}>${this.tasks.map(e=>n`<option value=${`task:${e.id}`}>${e.title} · ${V(e.kind)}</option>`)}</optgroup>
          ${t.length?n`<optgroup label=${a("tagDevice")}>${t.map(([e,i])=>n`<option value=${`entity:${e}`}>${i}</option>`)}</optgroup>`:d}
        </select></div>
        <div class="fld"><label for="tg-l">${a("tagLabel")}</label><input id="tg-l" class="inp" maxlength="120" .value=${this.draft.label} @input=${e=>{this.draft={...this.draft,label:e.target.value}}}></div>
        <div class="fld"><span class="lbl">${a("tagMedium")}</span><sw-segmented label=${a("tagMedium")} value=${this.draft.medium} @change=${e=>{this.draft={...this.draft,medium:e.detail.value}}}
          .options=${["qr","nfc"].map(e=>({value:e,label:e.toUpperCase()}))}></sw-segmented></div>
        ${this.formError?n`<div class="alert err" role="alert">${this.formError}</div>`:d}
      </div>
      <div class="foot" slot="footer"><span class="sp"></span><button type="button" class="btn" @click=${()=>{this.creating=!1}}>${a("cancel")}</button>
        <button type="button" class="btn pri" ?disabled=${this.busy} data-maint-tag-save @click=${()=>void this.create()}>${a("tagCreate")}</button></div>
    </sw-dialog>`}render(){if(!this.access.manage)return n`<sw-state-panel state="forbidden" heading=${a("forbiddenTitle")} hint=${a("forbiddenTags")} data-state="forbidden"></sw-state-panel>`;if(!this.tags)return this.error?n`<sw-state-panel state="error" heading=${a("errTags")} hint=${a("errHint")} actionLabel=${a("retry")} data-state="error" @action=${()=>{this.error="",this.load()}}></sw-state-panel>`:n`<div class="skl" aria-busy="true" aria-label=${a("loading")} data-state="loading"></div>`;const t=this.tags.filter(s=>!s.revoked_at),e=()=>{this.draft={target:"",label:"",medium:"qr"},this.formError="",this.creating=!0},i=n`<div class="top noprint"><div><h1>${a("pageTags")}</h1><p class="sub">${a("section")} · ${a("subTags",{n:t.length})}</p></div><span class="sp"></span>
      <div class="meta">${t.length?n`<button type="button" class="btn" data-maint-print @click=${()=>this.print()}><sw-icon name="qr" size="16"></sw-icon>${a("printStickers")}</button>`:d}
        <button type="button" class="btn pri" data-maint-new-tag @click=${e}><sw-icon name="plus" size="16"></sw-icon>${a("newTag")}</button></div></div>`,r=n`${this.creating?this.createDialog():d}
      ${this.revoke?n`<sw-dialog open heading=${a("tagRevoke")} @close=${()=>{this.revoke=null}}><p>${a("tagRevokeConfirm",{l:this.revoke.label||this.targetText(this.revoke)})}</p>
        <div class="foot" slot="footer"><span class="sp"></span><button type="button" class="btn" @click=${()=>{this.revoke=null}}>${a("cancel")}</button>
          <button type="button" class="btn dng" ?disabled=${this.busy} data-maint-revoke-yes @click=${()=>void this.doRevoke(this.revoke)}>${a("tagRevoke")}</button></div></sw-dialog>`:d}
      ${this.toast?n`<div class="toast noprint" role="status" aria-live="polite" ${At()}>${this.toast}</div>`:d}`;return t.length?n`${i}<div class="tagscroll">
      <p class="note noprint" data-maint-tag-url>${this.base?a("tagUrlHint",{u:this.base}):a("tagNoRemote")}</p>
      <div class="grid" data-maint-stickers>${t.map(s=>this.sticker(s))}</div>
      <div class="panel flush noprint">
        <div class="scrollx"><sw-table bare static-rows data-maint-tags-table .columns=${this.tagColumns()} .rows=${t}
          .rowAttrs=${s=>({"data-maint-tag":String(s.id)})}></sw-table></div>
        <div class="cards-m">${t.map(s=>n`<div class="c"><div class="r1"><span class="t1">${s.label||this.targetText(s)}</span><span class="chip" data-look="acc">${s.medium.toUpperCase()}</span></div>
          <div class="mut">${this.targetText(s)} · ${s.last_scan_at?R(s.last_scan_at):a("neverScanned")}</div>
          <div class="r3"><button type="button" class="btn sm dng" @click=${()=>{this.revoke=s}}>${a("tagRevoke")}</button></div></div>`)}</div>
      </div></div>
      ${r}`:n`${i}<sw-state-panel icon="qr" state="empty" heading=${a("emptyTags")} hint=${a("emptyTagsBody")} data-state="empty">
        <button type="button" class="btn pri" @click=${e}><sw-icon name="plus" size="16"></sw-icon>${a("firstTag")}</button></sw-state-panel>${r}`}};O.styles=[S,M`
    /* CR-CMP2-TABLES-2450 (owner N10): the tags list is the shared table inside the panel - its header band, never wider than the panel */
    sw-table[data-maint-tags-table] { --sw-table-min: 0; --sw-table-head-bg: var(--sw-surface-2); --sw-table-fs: var(--sw-fs-md); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr)); gap: 12px; }
    /* stickers are always light (print) */
    .sticker { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); padding: 12px; background: #fff; color: #111; text-align: center; display: grid; justify-items: center; gap: 4px; break-inside: avoid; }
    .sticker svg { inline-size: 120px; block-size: 120px; }
    .sticker .l { font-weight: var(--sw-fw-bold); }
    .sticker .s { font-size: var(--sw-fs-xs); color: var(--tg-ink-2); }
    .sticker .path { font-family: var(--sw-font-mono); font-size: var(--sw-fs-2xs); color: var(--tg-ink-2); direction: ltr; unicode-bidi: isolate; }
    .note { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    :host { flex: 1; min-block-size: 0; --tg-ink-2: #555; /* COLOR-LITERAL-B-2480: the sticker's secondary ink */ }
    /* owner 24.10: no page scrolling - the stickers and the table scroll inside this area */
    .tagscroll { flex: 1; min-block-size: 0; overflow: auto; display: flex; flex-direction: column; gap: 14px; }
    @media print {
      .tagscroll { overflow: visible; display: block; }
      :host { visibility: visible; }
      .noprint { display: none !important; }
      .grid { visibility: visible; position: absolute; inset-block-start: 0; inset-inline-start: 0; inline-size: 100%; grid-template-columns: repeat(3, 1fr); }
      .sticker { border-color: #999; }
    }
  `];D([f({attribute:!1})],O.prototype,"access",2);D([p()],O.prototype,"tags",2);D([p()],O.prototype,"base",2);D([p()],O.prototype,"error",2);D([p()],O.prototype,"tasks",2);D([p()],O.prototype,"creating",2);D([p()],O.prototype,"draft",2);D([p()],O.prototype,"revoke",2);D([p()],O.prototype,"busy",2);D([p()],O.prototype,"formError",2);O=D([z("maint-tags-page")],O);var Qe=Object.defineProperty,Ze=Object.getOwnPropertyDescriptor,et=(t,e,i,r)=>{for(var s=r>1?void 0:r?Ze(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&Qe(e,i,s),s};const Dt={due_soon:"warn",overdue:"alarm",request:"acc",request_failed:"alarm"},ts={due_soon:"warn",overdue:"bad",request:"info",request_failed:"bad"};let H=class extends T{constructor(){super(...arguments),this.log=null,this.error="",this.event="",this.poll=new yt(this),this.fit=new kt(this,()=>this.renderRoot.querySelector(".scroller"),()=>!!this.log?.items.length)}connectedCallback(){super.connectedCallback(),this.load(),this.poll.every("log",6e4,()=>this.load())}willUpdate(){this.toggleAttribute("data-fit",this.fit.fits)}async load(){try{this.log=await u.reminderLog({event:this.event||void 0,limit:200}),this.error=""}catch(t){this.log||(this.error=v(t))}}pick(t){this.event=t,this.load()}columns(){const t=n`<span class="mut">${a("dash")}</span>`;return[{key:"at",label:a("colWhen"),render:e=>n`<span class="num">${R(e.at)}</span>`},{key:"event",label:a("colEvent"),kind:"status",render:e=>n`<span class="chip" data-tone=${ts[e.event]}>${a(`evt_${e.event}`)}</span>`},{key:"title",label:a("colTaskName"),render:e=>n`<a class="t1" part="task" href=${`#/tickets/maintenance?task=${encodeURIComponent(e.task_id)}`}>${e.title}</a><span class="t2">${V(e.task_kind)}</span>`},{key:"due",label:a("colDueDate"),render:e=>e.due_date?n`<span class="num">${x(e.due_date)}</span>`:t},{key:"detail",label:"",render:e=>this.detailCell(e)}]}detailCell(t){if(t.event==="request"&&t.detail&&this.access.ticketsOn)return n`<a class="chip" part="request" data-tone="info" data-nodot href=${`#/tickets/${encodeURIComponent(t.detail)}`}>${a("requestOpen")}</a>`;if(t.event==="request_failed"&&t.detail){const e=`ticketErr_${t.detail}`;return n`<span class="mut">${a(e)===e?t.detail:a(e)}</span>`}return d}card(t){return n`<div class="c" data-maint-log-card=${t.id} data-look=${Dt[t.event]}>
      <div class="r1"><a class="t1 task" href=${`#/tickets/maintenance?task=${encodeURIComponent(t.task_id)}`}>${t.title}</a><span class="mut num">${R(t.at)}</span></div>
      <div class="evt" data-look=${Dt[t.event]}><span class="dot" aria-hidden="true"></span>${a(`evt_${t.event}`)}${t.due_date?n`<span class="mut"> · ${x(t.due_date)}</span>`:d}</div>
    </div>`}render(){const t=s=>n`<div class="top"><div><h1>${a("pageLog")}</h1><p class="sub" data-maint-sub>${a("section")} · ${s}</p></div></div>`;if(!this.log)return this.error?n`<sw-state-panel state="error" heading=${a("errLog")} hint=${a("errHint")} actionLabel=${a("retry")} data-state="error" @action=${()=>{this.error="",this.load()}}></sw-state-panel>`:n`${t("")}<div class="skl" aria-busy="true" aria-label=${a("loading")} data-state="loading"></div>`;const e=this.log,i=!e.reminders_enabled,r=e.items.length?a("logSub",{n:e.items.length,k:e.keep_days}):a("logSubEmpty");return this.fit.sync(e.items.length,`${this.event}|${e.items.map(s=>s.id).join(",")}`),n`${t(r)}
      <div class="panel flush fill" data-maint-log>
        ${i?n`<div class="note" role="status" data-maint-log-off><sw-icon name="bell" size="16"></sw-icon><div><b>${a("logOffTitle")}</b> ${a("logOffBody")}</div><span class="sp"></span>
          ${!Bt()||jt("system.configure")?n`<a class="btn sm" href="#/system/infra/maintenance" data-maint-to-settings>${a("logToSettings")}</a>`:d}</div>`:d}
        <div class="toolbar"><sw-segmented label=${a("evtFilter")} data-maint-log-filter value=${this.event} @change=${s=>this.pick(s.detail.value)}
          .options=${[{value:"",label:a("colAll"),attrs:{"data-ev":"all"}},...ee.map(s=>({value:s,label:a(`evt_${s}`),attrs:{"data-ev":s}}))]}></sw-segmented>
          ${this.fit.fits?n`<span class="pg">${this.fit.pages>1?n`<sw-pager data-maint-log-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${s=>this.fit.go(s.detail.page)}></sw-pager>`:d}</span>`:d}</div>
        ${e.items.length?n`<div class="scroller">
            <div class="scrollx"><section class="fitsec"><sw-table bare static-rows data-maint-log-table .columns=${this.columns()}
              .rows=${e.items.filter((s,o)=>this.fit.shows(o))}
              .rowAttrs=${s=>({"data-fit-item":!0,"data-maint-log-row":String(s.id),"data-event":String(s.event)})}></sw-table></section></div>
            <div class="cards-m">${e.items.map(s=>this.card(s))}</div></div>`:n`<sw-state-panel icon="bell" state="empty" heading=${a("emptyLog")} hint=${a("emptyLogBody")} data-state="empty"></sw-state-panel>`}
      </div>`}};H.styles=[S,M`
    :host { flex: 1; min-block-size: 0; }
    .fill { display: flex; flex-direction: column; flex: 1; min-block-size: 0; }
    .panel.flush.fill { min-block-size: 0; }
    .scroller { flex: 1; min-block-size: 0; overflow: auto; }
    .fitsec { display: block; }
    /* the pager's place at the end of the toolbar (as on the maintenance lists) */
    .toolbar .pg { margin-inline-start: auto; min-inline-size: 150px; display: flex; justify-content: flex-end; }
    @media screen and (min-width: 1024px) and (min-height: 560px) {
      :host([data-fit][data-long-lists='paged']) .scroller { overflow: hidden; }
    }
    .evt { display: inline-flex; align-items: center; gap: 6px; }
    .evt .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c, var(--sw-accent)); flex: none; }
    [data-look='warn'] { --c: var(--sw-warning); }
    [data-look='alarm'] { --c: var(--sw-danger); }
    [data-look='acc'] { --c: var(--sw-accent); }
    a.task { color: var(--sw-accent-text); text-decoration: none; font-weight: var(--sw-fw-semibold); }
    @media (hover: hover) and (pointer: fine) { a.task:hover { text-decoration: underline; } }
    /* CR-CMP2-TABLES-GENMAINT-2450 (owner N10): the log is the shared table inside the panel - the module's header band and reading size,
       never wider than the panel; the links in its cells (drawn in the table's shadow root) reach their look through parts */
    sw-table[data-maint-log-table] { --sw-table-min: 0; --sw-table-head-bg: var(--sw-surface-2); --sw-table-fs: var(--sw-fs-md); --sw-table-cell-pad: 10px 12px; }
    sw-table[data-maint-log-table]::part(task) { color: var(--sw-accent-text); text-decoration: none; font-weight: var(--sw-fw-semibold); }
    sw-table[data-maint-log-table]::part(request) { text-decoration: none; }
    sw-table[data-maint-log-table]::part(task):focus-visible, sw-table[data-maint-log-table]::part(request):focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; border-radius: 4px; }
    @media (hover: hover) and (pointer: fine) { sw-table[data-maint-log-table]::part(task):hover { text-decoration: underline; } }
    .note { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-block-end: 1px solid var(--sw-border); background: var(--sw-warning-soft); }
  `];et([f({attribute:!1})],H.prototype,"access",2);et([p()],H.prototype,"log",2);et([p()],H.prototype,"error",2);et([p()],H.prototype,"event",2);H=et([z("maint-log-page")],H);var es=Object.defineProperty,ss=Object.getOwnPropertyDescriptor,st=(t,e,i,r)=>{for(var s=r>1?void 0:r?ss(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&es(e,i,s),s};let K=class extends T{constructor(){super(...arguments),this.token="",this.answer=null,this.error=""}willUpdate(t){t.has("token")&&this.token&&this.load()}async load(){try{const t=await u.scan(this.token);this.answer=t,t.kind==="task"&&t.task.kind!=="round"&&window.location.replace(`${J(mt(t.task.kind))}?task=${encodeURIComponent(t.task.id)}`)}catch(t){this.error=t instanceof I&&t.status===404?"gone":v(t)}}async startRound(){const t=this.answer;if(t?.kind==="task")try{const e=t.task.open_run_id??(await u.startRun(t.task.id)).id;window.location.replace(`${J("rounds")}?run=${encodeURIComponent(e)}`)}catch(e){const i=e instanceof I?e.body?.details?.run_id:void 0;i?window.location.replace(`${J("rounds")}?run=${encodeURIComponent(i)}`):this.error=v(e)}}render(){if(this.error==="gone")return n`<sw-state-panel icon="qr" state="empty" heading=${a("scanNotFound")} hint=${a("scanNotFoundHint")} data-state="not-found"></sw-state-panel>`;if(this.error)return n`<sw-state-panel state="error" heading=${this.error} data-state="error"></sw-state-panel>`;const t=this.answer;if(!t)return n`<div class="skl" aria-busy="true" aria-label=${a("loading")} data-state="loading"></div>`;if(t.kind==="task"){const e=t.task;return n`<div class="top"><div><h1>${t.label||e.title}</h1><p class="sub">${a("scanTitle")} · ${V(e.kind)}${e.place?` · ${e.place.name}`:""}</p></div></div>
        <div class="panel" data-look=${B(e)} data-maint-scan-task=${e.id}><div class="hd"><div><div class="t1">${e.title}</div><div class="mut num">${x(e.due_date)}</div></div><span class="sp"></span><span class="badge">${U(e)}</span></div>
          ${e.can.start_round||e.open_run_id?n`<button type="button" class="btn pri big" data-maint-scan-start @click=${()=>void this.startRound()}>${a(e.open_run_id?"continue":"scanStartRound")}</button>`:n`<a class="btn" href=${`${J(mt(e.kind))}?task=${encodeURIComponent(e.id)}`}>${a("scanOpen")}</a>`}</div>`}return n`<div class="top"><div><h1>${t.label||t.entity_id}</h1><p class="sub">${a("scanTitle")} · ${a("tagDevice")}</p></div><span class="sp"></span>
        <div class="meta"><a class="btn" href=${t.route} data-maint-scan-device>${a("scanOpen")}</a></div></div>
      ${this.access.ticketsOn&&t.open_requests!==null?n`<div class="chip" data-look="acc" data-maint-scan-requests>${a("scanOpenRequests",{n:t.open_requests})}</div>`:d}
      <div class="panel"><div class="hd"><h4>${a("scanDeviceTasks")}</h4></div>
        ${t.tasks.length?n`<div class="list">${t.tasks.map(e=>n`<a class="li" style="text-decoration:none;color:inherit" data-look=${B(e)} href=${`${J(mt(e.kind))}?task=${encodeURIComponent(e.id)}`}>
            <div class="grow"><div class="t1">${e.title}</div><div class="t2">${V(e.kind)} · <span class="num">${x(e.due_date)}</span></div></div><span class="badge">${U(e)}</span></a>`)}</div>`:n`<div class="mut">${a("noMatch")}</div>`}</div>`}};K.styles=S;st([f()],K.prototype,"token",2);st([f({attribute:!1})],K.prototype,"access",2);st([p()],K.prototype,"answer",2);st([p()],K.prototype,"error",2);K=st([z("maint-scan-page")],K);function as(t,e="he"){return t==null||t<0?"":t<3600?c("ageMin",{n:Math.max(1,Math.round(t/60))},e):t<172800?c("ageHour",{n:Math.round(t/3600)},e):c("ageDay",{n:Math.round(t/86400)},e)}function is(t,e){return t==="all"||e===t}function bt(t,e,i){const r=t.trim();if(!/^\d+(\.\d+)?$/.test(r))return null;const s=Number(r);return s>=e&&s<=i?s:null}const Nt={ready:0,ready_with_gaps:1,not_ready:2};function ns(t,e){const i=[...t].sort((o,l)=>o.at.localeCompare(l.at));if(!i.length||e<1)return[];const r=Math.ceil(i.length/e),s=[];for(let o=0;o<i.length;o+=r){const l=i.slice(o,o+r),h=l.reduce(($,k)=>Nt[k.verdict]>Nt[$]?k.verdict:$,l[0].verdict);s.push({at:l[l.length-1].at,verdict:h,n:l.length})}return s}var rs=Object.defineProperty,os=Object.getOwnPropertyDescriptor,y=(t,e,i,r)=>{for(var s=r>1?void 0:r?os(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&rs(e,i,s),s};const ls=["E01","E02","E03","E04","E05","E06","E07","E09","E10","E11","E12","E14","E17","E18","E19"],ds=Object.keys(wt),Kt=M`
  :host { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 14px; }
  .fill { display: flex; flex-direction: column; flex: 1; min-block-size: 0; }
  .scroller { flex: 1; min-block-size: 0; overflow: auto; padding: 12px 14px; display: grid; gap: 18px; align-content: start; }
  h3 { margin: 0 0 8px; font-size: var(--sw-fs-lg); color: var(--sw-heading); }
  .hint { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px 16px; }
  .fld { display: grid; gap: 4px; }
  .fld label { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 8px 0; border-block-end: 1px solid var(--sw-border); }
  .row .sp { flex: 1; }
  ${Ft}
  ${se}
  .btn.sm { padding: 4px 10px; min-block-size: 30px; }
`;let L=class extends T{constructor(){super(...arguments),this.manage=!1,this.items=[],this.count=0,this.error="",this.msg="",this.form=null,this.loaded=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const t=await N.contacts();this.items=t.items,this.count=t.count,this.error=""}catch(t){this.error=v(t)}this.loaded=!0}edit(t){this.msg="",this.form=t?{id:t.id,display_name:t.display_name,role_title:t.role_title,phone:t.phone??"",email:t.email??"",priority:String(t.priority),revision:t.revision}:{id:null,display_name:"",role_title:"",phone:"",email:"",priority:"100"}}async save(){const t=this.form;if(!t)return;if(!t.display_name.trim()||!t.phone.trim()&&!t.email.trim()){this.error=c("cRoute");return}const e={display_name:t.display_name.trim(),role_title:t.role_title.trim(),phone:t.phone.trim(),email:t.email.trim(),priority:Number(t.priority)||100};try{t.id?await N.updateContact(t.id,{...e,revision:t.revision}):await N.createContact(e),this.form=null,this.error="",this.msg=c("sSaved"),await this.load()}catch(i){this.error=i instanceof I&&i.status===409?c("sConflict"):v(i)}}async act(t){try{await t(),this.error="",await this.load()}catch(e){this.error=v(e)}}field(t,e,i){const r=this.form;return n`<div class="fld"><label for=${`ec-${t}`}>${c(e)}</label><input id=${`ec-${t}`} class="inp" dir=${i??"auto"} .value=${r[t]} data-emerg-contact-field=${t}
      @input=${s=>{this.form={...r,[t]:s.target.value}}}></div>`}render(){return this.loaded?this.manage?n`<div class="panel flush fill" data-emerg-contacts><div class="scroller">
      <div class="row"><h3>${c("viewContacts")}</h3><span class="sp"></span><button type="button" class="btn pri sm" data-emerg-contact-add @click=${()=>this.edit(null)}><sw-icon name="plus" size="14"></sw-icon>${c("cAdd")}</button></div>
      <p class="hint">${c("cPrivacy")}</p>
      ${this.form?n`<div class="panel card" data-emerg-contact-form><div class="grid">${this.field("display_name","cName")}${this.field("role_title","cRole")}${this.field("phone","cPhone","ltr")}${this.field("email","cEmail","ltr")}${this.field("priority","cPriority","ltr")}</div>
        <div class="row"><button type="button" class="btn pri sm" data-emerg-contact-save @click=${()=>void this.save()}>${c("cSave")}</button><button type="button" class="btn sm" @click=${()=>{this.form=null}}>${c("cCancel")}</button></div></div>`:d}
      ${this.error?n`<div class="err" role="alert">${this.error}</div>`:d}${this.msg?n`<div class="ok" role="status">${this.msg}</div>`:d}
      ${this.items.length?this.items.map(t=>n`<div class="row" data-emerg-contact=${t.id}>
          <div><b>${t.display_name}</b>${t.role_title?n` <span class="mut">${t.role_title}</span>`:d}${t.active?d:n` <span class="chip" data-look="unk">${c("cInactive")}</span>`}
            <div class="mut num">${t.phone??""} ${t.email??""}</div></div><span class="sp"></span>
          <span class="chip" data-look=${t.verified_ok?"ok":"warn"}>${t.last_verified_at?`${c("cVerified")} ${R(t.last_verified_at,!1)}`:c("cNever")}</span>
          <button type="button" class="btn sm" data-emerg-contact-verify @click=${()=>void this.act(()=>N.verifyContact(t.id))}>${c("cVerify")}</button>
          <button type="button" class="btn sm" aria-label=${c("cEdit")} title=${c("cEdit")} @click=${()=>this.edit(t)}><sw-icon name="edit" size="14"></sw-icon></button>
          <button type="button" class="btn sm dng" data-emerg-contact-delete @click=${async()=>{await Re({body:c("cDeleteConfirm"),danger:!0})&&this.act(()=>N.deleteContact(t.id))}}><sw-icon name="trash" size="14"></sw-icon>${c("cDelete")}</button>
        </div>`):n`<div class="nomatch">${c("cEmpty")}</div>`}
    </div></div>`:n`<div class="panel card" data-emerg-contacts-count><p>${c("cCountOnly",{n:this.count})}</p></div>`:n`<div class="skl" aria-busy="true" aria-label=${c("loading")}></div>`}};L.styles=[S,Kt];y([f({type:Boolean})],L.prototype,"manage",2);y([p()],L.prototype,"items",2);y([p()],L.prototype,"count",2);y([p()],L.prototype,"error",2);y([p()],L.prototype,"msg",2);y([p()],L.prototype,"form",2);y([p()],L.prototype,"loaded",2);L=y([z("emergency-contacts-panel")],L);let j=class extends T{constructor(){super(...arguments),this.cfg=null,this.error="",this.msg="",this.draft={},this.naNote={},this.busy=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.apply(await N.config()),this.error=""}catch(t){this.error=v(t)}}apply(t){this.cfg=t,this.draft=Object.fromEntries(Object.entries(t.thresholds.effective).map(([e,i])=>[e,String(i)]))}async put(t){if(!(!this.cfg||this.busy)){this.busy=!0;try{this.apply(await N.putConfig({revision:this.cfg.revision,...t})),this.error="",this.msg=c("sSaved")}catch(e){e instanceof I&&e.status===409?(this.msg="",this.error=c("sConflict"),await this.load()):this.error=v(e)}finally{this.busy=!1}}}slotName(t){return c(`slot_${t}`)}slots(t){return n`<section><h3>${c("sSlots")}</h3>${qe.map(e=>{const i=t.slots[e]??[],r=t.suggestions[e]??[];return n`<div class="row" data-emerg-slot=${e}><b>${this.slotName(e)}</b>
        ${i.length?i.map(s=>n`<span class="chip" data-look="ok">${s.title}${s.due_date?` · ${s.due_date}`:""}
          <button type="button" class="btn sm" data-emerg-unbind=${s.id} @click=${()=>void this.put({bindings:{[s.id]:null}})}>${c("sUnbind")}</button></span>`):n`<span class="mut">${c("sNoneBound")}</span>`}
        <span class="sp"></span>
        ${r.length?n`<select class="inp" data-emerg-bind=${e} aria-label=${c("sPick")} @change=${s=>{const o=s.target.value;o&&this.put({bindings:{[o]:e}})}}><option value="">${c("sPick")}</option>${r.map(s=>n`<option value=${s.id}>${s.title}${s.due_date?` · ${s.due_date}`:""}</option>`)}</select>`:n`<span class="mut">${c("sNoSuggest")}</span>`}
      </div>`})}</section>`}thresholds(t){const e=lt(),i=Object.keys(t.thresholds.effective).filter(s=>{const o=bt(this.draft[s]??"",t.thresholds.ranges[s][0],t.thresholds.ranges[s][1]);return o!==null&&o!==t.thresholds.effective[s]}),r=Object.keys(t.thresholds.effective).some(s=>bt(this.draft[s]??"",t.thresholds.ranges[s][0],t.thresholds.ranges[s][1])===null);return n`<section><h3>${c("sThresholds")}</h3><div class="grid">${ds.filter(s=>s in t.thresholds.effective).map(s=>{const[o,l]=t.thresholds.ranges[s],h=bt(this.draft[s]??"",o,l)===null,$=t.thresholds.effective[s]===t.thresholds.defaults[s];return n`<div class="fld"><label for=${`th-${s}`}>${wt[s]?.[e]??s} ${wt[s]?.unit??""}</label>
        <input id=${`th-${s}`} class="inp num" inputmode="decimal" .value=${this.draft[s]??""} aria-invalid=${String(h)} data-emerg-th=${s}
          @input=${k=>{this.draft={...this.draft,[s]:k.target.value}}}>
        <span class="hint">${c("sDefault",{v:t.thresholds.defaults[s]})} (${o}–${l})
          ${$?d:n`<button type="button" class="btn sm" data-emerg-th-reset=${s} @click=${()=>void this.put({thresholds:{[s]:null}})}>${c("sReset")}</button>`}</span></div>`})}</div>
      <div class="row"><button type="button" class="btn pri sm" ?disabled=${this.busy||r||!i.length} data-emerg-th-save
        @click=${()=>void this.put({thresholds:Object.fromEntries(i.map(s=>[s,Number(this.draft[s])]))})}>${c("cSave")}</button></div></section>`}cameras(t){const e=new Set(t.cameras.selected);return n`<section><h3>${c("sCameras")}</h3><p class="hint">${c("sCamerasHint")}</p><div class="grid">${t.cameras.choices.map(i=>n`<label class="row" data-emerg-cam=${i.id}>
      <input type="checkbox" .checked=${e.has(i.id)} @change=${r=>{const s=new Set(e);r.target.checked?s.add(i.id):s.delete(i.id),this.put({cameras:[...s]})}}> ${i.name} <span class="mut">${i.recorder}</span></label>`)}</div></section>`}notApplicable(t){return n`<section><h3>${c("sNa")}</h3>${ls.map(e=>{const i=t.not_applicable[e];return n`<div class="row" data-emerg-na=${e}><b>${e}</b>
        ${i?n`<span class="mut">${c("naBy",{by:i.by,at:R(i.at,!1)})}${i.note?` · ${i.note}`:""}</span><span class="sp"></span>
            <button type="button" class="btn sm" data-emerg-na-clear=${e} @click=${()=>void this.put({not_applicable:{[e]:null}})}>${c("sNaClear")}</button>`:n`<input class="inp" placeholder=${c("sNaNote")} maxlength="200" .value=${this.naNote[e]??""} @input=${r=>{this.naNote={...this.naNote,[e]:r.target.value}}}>
            <button type="button" class="btn sm" data-emerg-na-set=${e} @click=${()=>void this.put({not_applicable:{[e]:{note:(this.naNote[e]??"").trim()}}})}>${c("sNaSet")}</button>`}
      </div>`})}</section>`}render(){const t=this.cfg;return t?n`<div class="panel flush fill" data-emerg-settings><div class="scroller">
      ${this.slots(t)}${this.thresholds(t)}${this.cameras(t)}${this.notApplicable(t)}
      <p class="hint">${c("sHistory",{n:t.history_keep_days})}</p>
      ${this.error?n`<div class="err" role="alert">${this.error}</div>`:d}${this.msg?n`<div class="ok" role="status">${this.msg}</div>`:d}
    </div></div>`:this.error?n`<sw-state-panel state="error" heading=${c("errTitle")} hint=${this.error} data-state="error"></sw-state-panel>`:n`<div class="skl" aria-busy="true"></div>`}};j.styles=[S,Kt,M`select.inp { max-inline-size: 360px; }`];y([p()],j.prototype,"cfg",2);y([p()],j.prototype,"error",2);y([p()],j.prototype,"msg",2);y([p()],j.prototype,"draft",2);y([p()],j.prototype,"naNote",2);y([p()],j.prototype,"busy",2);j=y([z("emergency-settings-panel")],j);var cs=Object.defineProperty,ps=Object.getOwnPropertyDescriptor,at=(t,e,i,r)=>{for(var s=r>1?void 0:r?ps(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&cs(e,i,s),s};const hs=[30,90,365],Lt={ready:"ok",ready_with_gaps:"warn",not_ready:"alarm"},us=90;let G=class extends T{constructor(){super(...arguments),this.points=null,this.keep=365,this.days=90,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const t=await N.history(this.days);this.points=t.points,this.keep=t.keep_days,this.error=""}catch(t){this.error=v(t)}}render(){if(this.error&&!this.points)return n`<sw-state-panel state="error" heading=${c("errTitle")} hint=${this.error} data-state="error"></sw-state-panel>`;if(!this.points)return n`<div class="skl" aria-busy="true" aria-label=${c("loading")}></div>`;const t=ns(this.points,us),e=hs.filter(i=>i<=this.keep);return n`<div class="panel flush fill" data-emerg-history>
      <div class="ctl"><span class="hint mut">${c("hRange")}</span><sw-segmented value=${String(this.days)} @change=${i=>{this.days=Number(i.detail.value),this.load()}}
        .options=${e.map(i=>({value:String(i),label:c("hDays",{n:i}),attrs:{"data-emerg-range":String(i)}}))}></sw-segmented>
        <span class="mut">${t.length?c("hSummary",{n:this.points.length}):""}</span></div>
      ${t.length?n`<div class="strip" role="img" aria-label=${c("viewHistory")}>${t.map(i=>n`<span class="bar" data-look=${Lt[i.verdict]} data-verdict=${i.verdict}
          title=${`${R(i.at)} - ${c(`verdict_${i.verdict}`)}`}></span>`)}</div>
        <div class="axis"><span>${R(t[0].at,!1)}</span><span>${R(t[t.length-1].at,!1)}</span></div>`:n`<div class="nomatch" data-emerg-history-empty>${c("hEmpty")}</div>`}
      <div class="legend">${["ready","ready_with_gaps","not_ready"].map(i=>n`<span data-look=${Lt[i]}><i></i>${c(`verdict_${i}`)}</span>`)}</div>
      ${this.error?n`<div class="err" role="alert">${this.error}</div>`:d}
    </div>`}};G.styles=[S,M`
    :host { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 14px; }
    .fill { display: flex; flex-direction: column; flex: 1; min-block-size: 0; padding: 14px; gap: 12px; }
    .strip { flex: 1; min-block-size: 80px; display: flex; align-items: stretch; gap: 2px; }
    .bar { flex: 1 1 0; min-inline-size: 2px; border-radius: 2px; background: var(--c); }
    [data-look='ok'] { --c: var(--sw-success); }
    [data-look='warn'] { --c: var(--sw-warning); }
    [data-look='alarm'] { --c: var(--sw-danger); }
    .axis { display: flex; justify-content: space-between; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .legend { display: flex; gap: 16px; flex-wrap: wrap; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .legend i { display: inline-block; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c); margin-inline-end: 6px; }
    .ctl { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    ${Ft}
  `];at([p()],G.prototype,"points",2);at([p()],G.prototype,"keep",2);at([p()],G.prototype,"days",2);at([p()],G.prototype,"error",2);G=at([z("emergency-history-panel")],G);var vs=Object.defineProperty,ms=Object.getOwnPropertyDescriptor,it=(t,e,i,r)=>{for(var s=r>1?void 0:r?ms(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&vs(e,i,s),s};const fs=["all","red","amber","unknown","not_applicable"],$s={all:"kpiAll",red:"kpiRed",amber:"kpiAmber",unknown:"kpiUnknown",not_applicable:"kpiNa"},Mt={green:"ok",amber:"warn",red:"alarm",unknown:"unk",not_applicable:"unk",hidden:"unk"},gs={green:"check",amber:"warning",red:"warning",unknown:"info",not_applicable:"info",hidden:"lock"},bs={ready:"ok",ready_with_gaps:"warn",not_ready:"alarm"},ws={ready:"check",ready_with_gaps:"warning",not_ready:"warning"},ys=["power","fire","elevators","doors","people","records","cameras"];let Y=class extends T{constructor(){super(...arguments),this.data=null,this.error="",this.filter="all",this.view="list",this.fit=new kt(this,()=>this.renderRoot.querySelector("[data-emerg-list]"),()=>this.view==="list"&&!!this.data),this.poll=new yt(this)}connectedCallback(){super.connectedCallback(),this.load(),this.poll.every("readiness",6e4,()=>this.load())}willUpdate(){this.toggleAttribute("data-fit",this.fit.fits)}async load(){try{this.data=await N.page(),this.error=""}catch(t){this.data||(this.error=t instanceof I&&t.status===403?"forbidden":v(t))}}itemTitle(t){return lt()==="en"?de[t.id]??t.title:t.title}summary(t){return lt()==="en"&&t.code&&Ct[t.code]&&!t.redacted?Ct[t.code]:t.summary}row(t,e=!1){const i=Mt[t.status],r=as(t.age_s,lt());return n`<div class="item ${t.status}" data-fit-item ?data-off=${e} data-look=${i} data-emerg-item=${t.id} data-status=${t.status}>
      <span class="disc" aria-hidden="true"><sw-icon name=${gs[t.status]} size="16"></sw-icon></span>
      <div><div class="t1">${this.itemTitle(t)}${t.critical&&!t.redacted?n`<span class="chip" data-look="unk">${c("critical")}</span>`:d}</div>
        <div class="t2">${this.summary(t)}${t.na?n` · ${c("naBy",{by:t.na.by,at:R(t.na.at,!1)})}${t.na.note?` · ${t.na.note}`:""}`:d}${r?n` · ${c("age",{n:r})}`:d}</div>
        ${t.files?.length?n`<div class="t2 files" data-emerg-files>${c("files")}: ${t.files.map((s,o)=>n`${o?", ":""}<a class="fix" href=${s.href}>${s.name||s.kind}</a>`)}</div>`:d}</div>
      <div class="side"><span class="st">${c(`st_${t.status}`)}</span>${t.next?.href?n` <a class="fix noprint" href=${t.next.href}>${c("fix")}</a>`:d}</div>
    </div>`}render(){if(this.error==="forbidden")return n`<sw-state-panel state="forbidden" heading=${c("forbiddenTitle")} data-state="forbidden"></sw-state-panel>`;const t=this.data;if(!t)return this.error?n`<sw-state-panel state="error" heading=${c("errTitle")} hint=${c("errHint")} actionLabel=${c("retry")} data-state="error" @action=${()=>{this.error="",this.load()}}></sw-state-panel>`:n`<div class="top"><div><h1>${c("title")}</h1></div></div><div class="skl" aria-busy="true" aria-label=${c("loading")} data-state="loading"></div>`;const e={all:t.items.length,red:t.counts.red,amber:t.counts.amber,unknown:t.counts.unknown,not_applicable:t.counts.not_applicable},i=t.items.filter(s=>is(this.filter,s.status)),r=ys.filter(s=>i.some(o=>o.group===s));return n`
      <div class="top"><div><h1>${c("title")}</h1><p class="sub">${c("sub")}</p></div><span class="sp"></span>
        <div class="meta"><span class="vbadge" data-look=${bs[t.verdict]} data-emerg-verdict=${t.verdict}><sw-icon name=${ws[t.verdict]} size="18"></sw-icon>${c(`verdict_${t.verdict}`)}</span>
          <span class="mut num">${c("checkedAt",{t:R(t.checked_at)})}</span>
          <sw-segmented class="noprint" data-emerg-views value=${this.view} @change=${s=>{this.view=s.detail.value}}
            .options=${["list","contacts","history",...t.can.manage?["settings"]:[]].map(s=>({value:s,label:c({list:"viewList",contacts:"viewContacts",history:"viewHistory",settings:"viewSettings"}[s]),attrs:{"data-emerg-view":s}}))}></sw-segmented>
          <button type="button" class="btn noprint" data-emerg-print @click=${()=>window.print()}><sw-icon name="download" size="16"></sw-icon>${c("print")}</button></div></div>
      ${t.banners.length?n`<div class="banners" data-emerg-banners>${t.banners.map(s=>n`<div class="banner" data-banner=${s.code}><sw-icon name="warning" size="18"></sw-icon>${c(`banner_${s.code}`)===`banner_${s.code}`?s.text:c(`banner_${s.code}`)}</div>`)}</div>`:d}
      ${this.view==="list"?this.listBody(t,e,i,r):this.view==="contacts"?n`<emergency-contacts-panel .manage=${t.can.manage}></emergency-contacts-panel>`:this.view==="history"?n`<emergency-history-panel></emergency-history-panel>`:n`<emergency-settings-panel></emergency-settings-panel>`}
      <div class="foot">${c("printNote")}<span class="printonly"> ${c("signed")}</span></div>`}listBody(t,e,i,r){return n`
      <div class="kpis noprint" role="group" aria-label=${c("filterLabel")} data-emerg-kpis>
        ${fs.map(s=>n`<button type="button" class="kpi" data-k=${s} data-look=${s==="all"?d:Mt[s]} aria-pressed=${String(this.filter===s)} data-emerg-kpi=${s}
          @click=${()=>{this.filter=s}}><span class="dot" aria-hidden="true"></span><span><b>${e[s]}</b><span class="l">${c($s[s])}</span></span></button>`)}
      </div>
      <div class="panel flush fill"><div class="scroller" data-emerg-list>
        ${r.length?this.sections(i,r):n`<div class="nomatch">${c("empty")}</div>`}
      </div>${t.counts.hidden||this.fit.fits?n`<div class="pgfoot"><span data-emerg-hidden>${t.counts.hidden?c("hidden",{n:t.counts.hidden}):d}</span><span class="sp"></span>
        ${this.fit.pages>1?n`<sw-pager class="noprint" data-emerg-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${s=>this.fit.go(s.detail.page)}></sw-pager>`:d}</div>`:d}</div>`}sections(t,e){const i=e.map(s=>({g:s,items:t.filter(o=>o.group===s)}));this.fit.sync(i.reduce((s,o)=>s+o.items.length,0),`${this.filter}|${i.map(s=>s.items.map(o=>o.id).join(",")).join("|")}`);let r=0;return i.map(({g:s,items:o})=>{const l=r;r+=o.length;const h=o.map(($,k)=>!this.fit.shows(l+k));return n`<section class="gsec" ?data-off=${h.every(Boolean)} data-emerg-group=${s}><div class="grp">${c(`grp_${s}`)}</div><div class="gitems">${o.map(($,k)=>this.row($,h[k]))}</div></section>`})}};Y.styles=[S,M`
    :host { flex: 1; min-block-size: 0; }
    .fill { display: flex; flex-direction: column; flex: 1; min-block-size: 0; }
    .scroller { flex: 1; min-block-size: 0; overflow: auto; }
    .vbadge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: var(--sw-r-pill); font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-lg);
      background: var(--c); color: var(--sw-on-solid, #fff); }
    [data-look='ok'] { --c: var(--sw-success); --c-text: var(--sw-success-text); }
    [data-look='warn'] { --c: var(--sw-warning); --c-text: var(--sw-warning-text); }
    [data-look='alarm'] { --c: var(--sw-danger); --c-text: var(--sw-danger-text); }
    [data-look='unk'] { --c: var(--sw-unknown); --c-text: var(--sw-text-2); }
    .banners { display: grid; gap: 8px; }
    .banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-warning-soft); border: 1px solid var(--sw-warning); font-weight: var(--sw-fw-semibold); }
    .grp { padding: 10px 14px 4px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); background: var(--sw-surface-2); position: sticky; inset-block-start: 0; z-index: 1; }
    .item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 14px; border-block-end: 1px solid var(--sw-border); }
    .disc { inline-size: 28px; block-size: 28px; border-radius: 50%; display: inline-grid; place-items: center; background: var(--c-soft); color: var(--c-text); }
    .item .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .item .t2 { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .item .st { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--c-text); }
    .item.red { background: var(--sw-danger-soft); }
    a.fix { color: var(--sw-accent-text); text-decoration: none; font-weight: var(--sw-fw-semibold); white-space: nowrap; }
    @media (hover: hover) and (pointer: fine) { a.fix:hover { text-decoration: underline; } }
    .foot { padding: 8px 14px; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .gsec { display: block; }
    /* the panel's foot: the rows the caller may not see, and the pager (its band is kept while the checklist fits the window) */
    .pgfoot { display: flex; align-items: center; gap: 10px; padding: 6px 14px; border-block-start: 1px solid var(--sw-border); color: var(--sw-text-3); font-size: var(--sw-fs-sm); min-block-size: 44px; box-sizing: border-box; }
    .pgfoot .sp { flex: 1; }
    @media screen and (min-width: 1024px) and (min-height: 560px) {
      :host([data-fit][data-long-lists='paged']) .scroller { overflow: hidden; }
      :host([data-fit]) [data-off] { display: none !important; }
    }
    .printonly { display: none; }
    @media (max-width: 767px) { .item { grid-template-columns: auto minmax(0, 1fr); } .item .side { grid-column: 2; } }
    @media print {
      .noprint, .kpis, .banners .noprint { display: none !important; }
      .printonly { display: block; }
      .scroller { overflow: visible; }
      :host { overflow: visible; }
    }
  `];it([p()],Y.prototype,"data",2);it([p()],Y.prototype,"error",2);it([p()],Y.prototype,"filter",2);it([p()],Y.prototype,"view",2);Y=it([z("emergency-readiness-page")],Y);var ks=Object.defineProperty,xs=Object.getOwnPropertyDescriptor,pt=(t,e,i,r)=>{for(var s=r>1?void 0:r?xs(e,i):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(s=(r?l(e,i,s):l(s))||s);return r&&s&&ks(e,i,s),s};let W=class extends T{constructor(){super(...arguments),this.bubbleSkin=new ae(this),this.route=null,this.access=ie(),this.emergency=null}connectedCallback(){super.connectedCallback(),this.stop=ne(t=>this.access=t),re(),N.module().then(t=>this.emergency=t,()=>this.emergency=null)}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}pages(){const t=Ce(this.access).map(e=>({id:e,label:a(Te[e]),href:J(e)}));return this.emergency?.enabled&&this.emergency.can.view&&t.push({id:"emergency",label:c("tab"),href:`${Ee}/emergency`}),t}body(t){const e=this.route,i=e?.segments??[];return i[2]==="scan"&&i[3]?n`<maint-scan-page .token=${i[3]} .access=${this.access}></maint-scan-page>`:i[2]==="emergency"?this.emergency?.enabled&&this.emergency.can.view?n`<emergency-readiness-page></emergency-readiness-page>`:n`<sw-state-panel state="forbidden" heading=${c("forbiddenTitle")} data-state="forbidden"></sw-state-panel>`:t==="tags"?n`<maint-tags-page .access=${this.access}></maint-tags-page>`:t==="log"?n`<maint-log-page .access=${this.access}></maint-log-page>`:n`<maint-list-page .page=${t} .access=${this.access} .openTask=${e?.params.get("task")??""} .openRun=${e?.params.get("run")??""}></maint-list-page>`}render(){const t=this.access,e=Pe(a("section"));if(t.enabled===null)return n`${e}<div class="skl tabs" aria-hidden="true"></div><div class="skl page" aria-busy="true" aria-label=${a("loading")} data-state="loading"></div>`;if(!t.enabled){const l=!Bt()||jt("system.configure");return n`${e}<sw-state-panel icon="power" state="empty" heading=${a("offTitle")} hint=${a("offBody")} data-state="off">
        ${l?n`<a class="btn" href="#/system/infra/maintenance" data-maint-to-settings>${a("toSettings")}</a>`:d}</sw-state-panel>`}if(!t.view)return n`${e}<sw-state-panel state="forbidden" heading=${a("forbiddenTitle")} data-state="forbidden"></sw-state-panel>`;const r=this.route?.segments[2]==="emergency"?"emergency":Oe(this.route?.segments??[]),s=this.pages(),o=this.route?.segments[2]==="scan";return n`${o?d:n`<sw-tabs .items=${s} .active=${r} .variant=${oe(null,2)} group-label=${a("pagesLabel")} data-maint-pages></sw-tabs>`}
      <div class="body" data-maint-page=${o?"scan":r}>${this.body(r)}</div>`}};W.styles=[Se,M`
    /* owner 24.10: a control screen never scrolls as a PAGE - the section fills the height of the screen and each page scrolls inside its
       own panel (the list's table, the log, the tags). */
    :host {
      display: flex; flex-direction: column; gap: 14px; block-size: 100%; min-block-size: 0; padding: 14px var(--sw-page-pad) 16px; max-inline-size: var(--sw-content-max);
      inline-size: 100%; box-sizing: border-box; overflow: hidden;
    }
    sw-tabs { flex: none; } /* a scroll container in a flex column would shrink to nothing on a phone */
    .body { min-inline-size: 0; min-block-size: 0; flex: 1; display: flex; flex-direction: column; gap: 14px; }
    .body > * { flex: 1; min-block-size: 0; overflow: auto; }
    /* TKSET-POLISH-2331: the loading state has the section's shape (the page row, then the page), not one short block */
    .skl { border-radius: var(--sw-r-md); background: var(--sw-skeleton); }
    .skl.tabs { flex: none; block-size: 40px; inline-size: min(560px, 100%); border-radius: var(--sw-r-pill); }
    .skl.page { flex: 1; min-block-size: 160px; border-radius: var(--sw-r-xl); }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-block-size: 44px; box-sizing: border-box; border-radius: var(--sw-r-pill);
      padding: 0 18px; border: 1px solid var(--sw-border-strong); background: var(--sw-surface); color: var(--sw-text); font: inherit;
      font-weight: var(--sw-fw-semibold); text-decoration: none; transition: background-color 150ms ease, border-color 150ms ease, transform 160ms ease-out; }
    .btn:active { transform: scale(var(--sw-press-scale)); }
    .btn:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    @media (hover: hover) and (pointer: fine) { .btn:hover { background: var(--sw-surface-2); border-color: var(--sw-accent); } }
    @media (prefers-reduced-motion: reduce) { .btn { transition: none; } .btn:active { transform: none; } }
    @media (max-width: 767px) { :host { padding: 12px 14px 12px; gap: 12px; } }
    @media print { :host { overflow: visible; block-size: auto; } .body > * { overflow: visible; } }
  `,le];pt([f({attribute:!1})],W.prototype,"route",2);pt([p()],W.prototype,"access",2);pt([p()],W.prototype,"emergency",2);W=pt([z("tickets-maintenance")],W);export{W as TicketsMaintenance};
