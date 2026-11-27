import{a as L,aX as S,cI as j,af as x,q,cA as D,cJ as N,b as r,G as o,A as d,aj as w,cK as P,j as M,z as f,k as p,m as z}from"./index-bjkrEUAJ.js";import{a as I}from"./automations-glass-D5DfIUsJ.js";import{a as U}from"./glass-Bgvuz6j0.js";import{b as Q}from"./bubble-chrome-wRf-BHoZ.js";import{h as B,p as v,a as F,t as G,d as H,M as X,c as J,L as T,b as K,e as V,f as W}from"./map-text-jmnSJbO6.js";import{n as _,t as k}from"./tickets-B7yJHO6e.js";import{t as m}from"./icons-B78POm3b.js";import{t as Y}from"./tickets-s4-CNBVxNSJ.js";import{d as b}from"./drawer-text-BOGPpQJq.js";import{O,t as Z,d as A,o as C,l as tt,a as et}from"./org-locations-text-B3lKM76c.js";import{l as it}from"./location-picker-hRYi_XKR.js";import"./sw-logo-art-PLtEZJxU.js";import"./device-activity-logic-l2xRj6CM.js";import"./readiness-model-DGhavIGL.js";var st=Object.defineProperty,at=Object.getOwnPropertyDescriptor,n=(e,i,s,t)=>{for(var a=t>1?void 0:t?at(i,s):i,u=e.length-1,y;u>=0;u--)(y=e[u])&&(a=(t?y(i,s,a):y(a))||a);return t&&a&&st(i,s,a),a};let l=class extends L{constructor(){super(...arguments),this.bubbleSkin=new S(this),this.open=!1,this.meta=null,this.mode="sheet",this.scope="mine",this.detailMode="drawer_fullscreen",this.device=null,this.mapElement=null,this.dept="",this.category="",this.priority="",this.ttl="",this.description="",this.files=[],this.assignTo="",this.eligible=null,this.contacts=null,this.external=!1,this.publicReady=!1,this.readiness=null,this.asgQuery="",this.similar=[],this.busy=!1,this.error="",this.tried=!1,this.locs=null,this.locPick=O,this.locOther="",this.locTouched=!1,this.requestId=_(),this.similarTimer=0,this.offNames=null,this.previews=new Map}connectedCallback(){super.connectedCallback(),U(this),this.offNames=j(()=>this.requestUpdate())}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.similarTimer),this.offNames?.(),this.dropPreviews()}willUpdate(e){if(e.has("open")&&this.open&&this.reset(),(e.has("meta")||e.has("open"))&&this.open&&!this.dept){const i=this.creatable()[0];i&&this.pickDepartment(i.id)}}creatable(){return(this.meta?.departments??[]).filter(e=>e.can_create)}reset(){this.dept="",this.category="",this.priority="",this.ttl="",this.description="",this.dropPreviews(),this.files=[],this.assignTo="",this.eligible=null,this.contacts=null,this.asgQuery="",this.similar=[],this.error="",this.tried=!1,this.requestId=_(),this.locPick=O,this.locOther="",this.locTouched=!1,Z().list().then(e=>{this.locs=e}).catch(()=>{this.locs=null}).finally(()=>{this.locTouched||(this.locPick=A(this.locs,this.dept))})}dropPreviews(){for(const e of this.previews.values())URL.revokeObjectURL(e);this.previews.clear()}pickDepartment(e){this.dept=e,!this.locTouched&&this.locs&&(this.locPick=A(this.locs,e));const i=this.meta?.departments.find(a=>a.id===e);this.category="",this.priority=i?.priorities.find(a=>a.is_default)?.id??i?.priorities[0]?.id??"";const s=this.device?.id.split(".")[0],t=s?i?.categories.find(a=>a.domains?.includes(s)):void 0;t&&this.pickCategory(t.id),this.assignTo="",this.eligible=null,this.contacts=null,i?.can_manage&&k().assignees(e).then(a=>{this.dept===e&&(this.eligible=B(a),this.takeOutside(a,e))}).catch(()=>{this.eligible=[],this.contacts=[]})}pickCategory(e){this.category=e;const s=this.meta?.departments.find(t=>t.id===this.dept)?.categories.find(t=>t.id===e);s?.default_priority_id&&(this.priority=s.default_priority_id)}applyTemplate(e){const i=this.meta?.departments.find(a=>a.id===this.dept),s=i?.templates?.find(a=>a.id===e);if(!i||!s)return;s.category_id&&i.categories.some(a=>a.id===s.category_id)&&this.pickCategory(s.category_id);const t=s.priority_key?i.priorities.find(a=>a.key===s.priority_key):void 0;t&&(this.priority=t.id),s.body&&(this.description=s.body),s.title&&this.onTitle(s.title)}onTitle(e){this.ttl=e,this.error="",window.clearTimeout(this.similarTimer);const i=e.trim();if(i.length<4){this.similar=[];return}this.similarTimer=window.setTimeout(()=>{k().list({scope:"visible",status:"open",q:i,limit:3}).then(s=>{this.ttl.trim()===i&&(this.similar=s.items)}).catch(()=>{})},350)}onFiles(e){const i=e.target,s=[...i.files??[]].filter(t=>/^image\/(jpeg|png)$/.test(t.type)||/\.(jpe?g|png)$/i.test(t.name));i.value="",this.files=[...this.files,...s].slice(0,10)}removeFile(e){const i=this.previews.get(e);i&&URL.revokeObjectURL(i),this.previews.delete(e),this.files=this.files.filter(s=>s!==e)}previewOf(e){let i=this.previews.get(e);return i||(i=URL.createObjectURL(e),this.previews.set(e,i)),i}takeOutside(e,i){const s=t=>{this.dept===i&&(this.contacts=t.contacts??[],this.external=!!t.external,this.publicReady=!!t.public_ready,this.readiness=t.readiness??null)};e.contacts!==void 0||x()?s(e):Y().externalAssignees(i,"").then(s).catch(()=>this.contacts=[])}assignee(){const e=v(this.assignTo);if(e.kind!=="handler")return null;const i=(this.eligible??[]).find(s=>s.key===e.id);return i?F(i):null}async submit(){if(this.tried=!0,!(!this.ttl.trim()||!this.dept||this.busy||C(this.locPick,this.locOther))){this.busy=!0,this.error="";try{const e=await k().create({department_id:this.dept,category_id:this.category||null,priority_id:this.priority||null,title:this.ttl.trim(),description:this.description.trim(),assign:this.assignee(),client_request_id:this.requestId,...tt(this.locPick,this.locOther),...this.device?{entity_id:this.device.id}:this.mapElement?.entityId?{entity_id:this.mapElement.entityId}:{}});let i="events"in e?e:null,s=0;if(i&&e.result==="created"){if(this.mapElement)try{await G.attach(i.id,this.mapElement.pick,this.mapElement)}catch{}for(const u of this.files)try{i=await k().upload(i.id,u,!1)}catch{s+=1}}const t=v(this.assignTo),a=t.kind==="vendor"&&e.result==="created"?t.id:void 0;this.dispatchEvent(new CustomEvent("created",{detail:{ticket:i,id:e.id,number:e.number,result:e.result,failedPhotos:s,assignContact:a},bubbles:!0,composed:!0}))}catch(e){this.error=q(e)}finally{this.busy=!1}}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}hrefOf(e){return this.detailMode==="fullscreen"?D(e):N(this.scope,void 0,{t:e})}form(){const e=this.creatable(),i=this.meta?.departments.find(t=>t.id===this.dept);if(!this.meta)return r`<div class="form" aria-busy="true"><span class="skl" style="block-size:44px"></span><span class="skl" style="block-size:44px"></span><span class="skl" style="block-size:120px"></span></div>`;if(!e.length)return r`<div class="statebox glass" role="status" data-create-state="no-department"><span class="ring">${m("ticket")}</span><b>${o("createNoDepartment")}</b></div>`;const s=this.tried&&!this.ttl.trim();return r`<div class="form" data-create-form>
      ${this.device?H(this.device,t=>this.hrefOf(t)):d}
      ${this.mapElement&&!this.device?r`<div class="hint" data-create-map-element>${m("layers")}${X.createLine}: ${w([this.mapElement.name,this.mapElement.floorName].filter(Boolean).join(" · "))}</div>`:d}
      <div class="two">
        <label class="fld"><span>${o("fDepartment")}</span>
          <select class="inp" data-create-department @change=${t=>this.pickDepartment(t.target.value)}>${e.map(t=>r`<option value=${t.id} ?selected=${t.id===this.dept}>${t.name}</option>`)}</select></label>
        <label class="fld"><span>${o("fCategory")}</span>
          <select class="inp" data-create-category @change=${t=>this.pickCategory(t.target.value)}>
            <option value="" ?selected=${!this.category}>${o("fNoCategory")}</option>
            ${(i?.categories??[]).map(t=>r`<option value=${t.id} ?selected=${t.id===this.category}>${t.name}</option>`)}
          </select></label>
      </div>
      ${i?.templates?.length?r`<label class="fld"><span>${o("tplCard")}</span>
        <select class="inp" data-create-template @change=${t=>this.applyTemplate(t.target.value)}>
          <option value="">${o("tplAny")}</option>
          ${i.templates.map(t=>r`<option value=${t.id}>${t.name}</option>`)}
        </select></label>`:d}
      <label class="fld"><span>${o("fTitle")} <b class="req">*</b></span>
        <input class="inp" maxlength="120" autocomplete="off" data-create-title placeholder=${o("fTitlePh")} aria-invalid=${String(s)} .value=${this.ttl} @input=${t=>this.onTitle(t.target.value)} />
        ${s?r`<span class="err" role="alert">${o("createNeed")}</span>`:d}</label>
      ${this.similar.length?r`<div class="similar" data-similar><b>${o("similar")}</b>${this.similar.map(t=>r`<a href=${this.hrefOf(t.id)} data-similar-item=${t.id}>#${t.number} · ${t.title}</a>`)}</div>`:d}
      ${i?.priorities.length?r`<div class="fld"><span>${o("fPriority")}</span><div class="prio" role="radiogroup" aria-label=${o("fPriority")}>
        ${i.priorities.map(t=>r`<button type="button" class="rc" role="radio" aria-checked=${String(t.id===this.priority)} data-create-priority=${t.key} @click=${()=>this.priority=t.id}><i class=${`dot ${P(t)==="bad"?"bad":P(t)==="info"?"run":""}`}></i>${t.name}</button>`)}
      </div></div>`:d}
      <label class="fld"><span>${o("fDescription")}</span>
        <textarea class="inp" maxlength="4000" data-create-description placeholder=${o("fDescriptionPh")} .value=${this.description} @input=${t=>this.description=t.target.value}></textarea></label>
      ${it({ans:this.locs,pick:this.locPick,other:this.locOther,disabled:this.busy,error:this.tried&&C(this.locPick,this.locOther)?r`<span class="err" role="alert" data-create-location-err>${et("err_too_long")}</span>`:d,onPick:t=>{this.locTouched=!0,this.locPick=t},onOther:t=>{this.locTouched=!0,this.locOther=t}})}
      <div class="fld"><span>${o("fPhotos")}</span>
        <div class="thumbs">
          ${this.files.map((t,a)=>r`<figure class="ph" style="margin:0" data-create-photo><img src=${this.previewOf(t)} alt=${o("photoAlt",{n:a+1})} /><button type="button" class="rm" aria-label=${o("removePhoto")} @click=${()=>this.removeFile(t)}>${m("trash")}</button></figure>`)}
          <label class="ph add" data-create-photo-add>${m("plus")}<span>${o("addPhoto")}</span><input type="file" accept="image/jpeg,image/png" multiple aria-label=${o("addPhoto")} @change=${this.onFiles} /></label>
        </div>
      </div>
      ${i?.can_manage?this.assigneePicker():d}
      ${this.error?r`<div class="banner bad" role="alert" data-create-error>${m("warning")}<div>${this.error}</div></div>`:d}
    </div>`}assigneePicker(){if(this.eligible===null)return r`<div class="fld" data-create-assignee><span>${o("fAssignee")}</span><span class="skl" style="block-size:44px"></span></div>`;const{groups:e,searchable:i}=J({handlers:this.eligible,contacts:this.contacts,external:this.external,publicReady:this.publicReady||!x(),readiness:this.readiness,query:this.asgQuery}),s=this.assignTo||T,t=(c,g,h,$="")=>r`<label data-handler=${h.handler??d} data-eligible=${h.id??d} data-create-vendor=${h.vendor??d} data-create-option=${c}>
        <input type="radio" name="asg" .checked=${s===c} @change=${()=>this.assignTo=c===T?"":c} />${g}${$?r`<small>${w($)}</small>`:d}</label>`,a=e.filter(c=>c.key!=="later"&&(c.total>0||c.key==="vendor")),u=!!this.asgQuery.trim()&&a.every(c=>!c.options.length),y=v(s),E=c=>r`<div class="ghead" role="presentation" data-create-group=${c}>${b(`cg_${c}`)}</div>`;return r`<div class="fld" data-create-assignee><span>${o("fAssignee")}</span>
      ${i?r`<input class="inp" type="search" data-create-asg-search placeholder=${b("cgSearch")} aria-label=${b("cgSearch")} .value=${this.asgQuery}
        @input=${c=>this.asgQuery=c.target.value} />`:d}
      <div class="pick grouped" role="radiogroup" aria-label=${o("fAssignee")}>
        ${t(T,o("fAssignLater"),{})}
        ${a.map(c=>r`${E(c.key)}
          ${c.blocked?r`<div class="xreason" data-create-vendor-blocked=${c.blocked.key}>${m("lock")}<span>${o(c.blocked.text)}</span><a href=${c.blocked.href}>${o(c.blocked.link)}</a></div>`:d}
          ${c.options.map(g=>{const h=v(g.value),$=h.kind==="handler"?this.eligible?.find(R=>R.key===h.id):void 0;return t(g.value,w(g.label),h.kind==="vendor"?{vendor:h.id}:{handler:h.id,id:$?.id},h.kind==="vendor"?g.sub:"")})}`)}
        ${u?r`<div class="muted" data-create-asg-none>${b("cgNoMatch")}</div>`:d}
      </div>
      ${y.kind==="vendor"?r`<small class="hint" data-create-vendor-note>${m("send")}${b("cgVendorNext")}</small>`:d}
    </div>`}footer(){return r`<div slot="footer" class="sheetfoot">
      <button type="button" class="btn primary" data-create-submit ?disabled=${this.busy||!this.creatable().length} @click=${()=>void this.submit()}>${m("check")}${o("createSubmit")}</button>
      <button type="button" class="btn quiet" data-create-cancel @click=${()=>this.close()}>${o("cancel")}</button>
      ${this.ttl.trim()?this.files.length?r`<span class="hint">${o("photosAfter")}</span>`:d:r`<span class="hint">${o("createNeed")}</span>`}
    </div>`}render(){const e=this.meta?.departments.find(i=>i.id===this.dept);return this.mode==="dialog"?r`<sw-dialog .open=${this.open} wide heading=${o("newTitle")} subheading=${e?.name??""} data-create="dialog" @close=${()=>this.close()}>${this.open?this.form():d}${this.open?this.footer():d}</sw-dialog>`:r`<sw-drawer modal .open=${this.open} heading=${o("newTitle")} subheading=${e?.name??""} data-create="sheet" @close=${()=>this.close()}>${this.open?this.form():d}${this.open?this.footer():d}</sw-drawer>`}};l.styles=[Q,...I,K,V,W,M`
    sw-drawer {
      --sw-drawer-modal-w: 620px;
    }
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .pick.grouped .ghead {
      padding: 6px 4px 0;
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      color: var(--dv-text-3);
    }
    .xreason {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: var(--sw-r-lg);
      border: 1px dashed var(--dv-border);
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .xreason a {
      color: var(--dv-accent-text);
      font-weight: 600;
    }
    .hint {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
  `];n([f({type:Boolean})],l.prototype,"open",2);n([f({attribute:!1})],l.prototype,"meta",2);n([f()],l.prototype,"mode",2);n([f()],l.prototype,"scope",2);n([f()],l.prototype,"detailMode",2);n([f({attribute:!1})],l.prototype,"device",2);n([f({attribute:!1})],l.prototype,"mapElement",2);n([p()],l.prototype,"dept",2);n([p()],l.prototype,"category",2);n([p()],l.prototype,"priority",2);n([p()],l.prototype,"ttl",2);n([p()],l.prototype,"description",2);n([p()],l.prototype,"files",2);n([p()],l.prototype,"assignTo",2);n([p()],l.prototype,"eligible",2);n([p()],l.prototype,"contacts",2);n([p()],l.prototype,"external",2);n([p()],l.prototype,"publicReady",2);n([p()],l.prototype,"readiness",2);n([p()],l.prototype,"asgQuery",2);n([p()],l.prototype,"similar",2);n([p()],l.prototype,"busy",2);n([p()],l.prototype,"error",2);n([p()],l.prototype,"tried",2);n([p()],l.prototype,"locs",2);n([p()],l.prototype,"locPick",2);n([p()],l.prototype,"locOther",2);l=n([z("ticket-create")],l);export{l as TicketCreate};
