import{j as y,a as N,i as j,Y as x,e as r,A as d,E as D,F as q,G as h,H as I}from"./index-D8-Lulvz.js";import{g as G,a as M,p as U,P as V,b as t,c as H,d as X,e as J,f as m,h as B,i as Q,j as W}from"./wiskey-profiles-8s8nupq2.js";import{q as Y}from"./access-people-DI0rrhlN.js";import"./sw-logo-art-Va6y_cIM.js";import"./wiskey-format-DJ4vUeXA.js";const L=12,A=64,K=64,Z=100,S=100,ee=100,se=3,C=["text","select","number","date"],E=/^[a-z][a-z0-9_]{0,47}$/,te=["label","enabled","type","required","unique","options","depends_on"],ae=["label","enabled","station_ids"],_=s=>JSON.parse(JSON.stringify(s));function T(s,e){const a=new Set(e);for(let o=1;o<1e4;o++){const l=`${s}_${o}`;if(!a.has(l))return l}return`${s}_${Date.now().toString(36)}`}function ie(s,e){return{id:T("field",s.fields.map(a=>a.id)),label:e,enabled:!0,type:"text",required:!1,unique:!1,options:[],depends_on:null}}function ne(s,e){return{id:T("group",s.groups.map(a=>a.id)),label:e,enabled:!0,station_ids:[]}}function re(s){return new Set([...(s?.fields??[]).map(e=>`fields.${e.id}`),...(s?.groups??[]).map(e=>`groups.${e.id}`)])}function O(s,e,a){return!re(s).has(`${e}.${a}`)}function z(s,e,a){const o=e+a;if(o<0||o>=s.length)return[...s];const l=[...s];return[l[e],l[o]]=[l[o],l[e]],l}function P(s,e){const a=new Set(s.station_ids??[]);return a.has(e)?a.delete(e):a.add(e),{...s,station_ids:[...a].sort()}}function oe(s){return s.split(/\r?\n/).map(e=>e.trim()).filter(Boolean)}function le(s,e){const a=new Map;for(const i of s)i.depends_on&&a.set(i.depends_on.field_id,[...a.get(i.depends_on.field_id)??[],i.id]);const o=new Set([e]),l=[e];for(;l.length;){const i=l.shift();for(const n of a.get(i)??[])o.has(n)||(o.add(n),l.push(n))}return s.filter(i=>!o.has(i.id))}function de(s,e){const a={},o=(p,g)=>{p in a||(a[p]=g)},l=p=>typeof p=="string"&&p.trim().length>0&&p.length<=K&&!/[\u0000-\u001f]/.test(p);s.fields.length>L&&o("fields","too_many"),s.groups.length>A&&o("groups","too_many");const i=s.fields.map(p=>p.id);s.fields.forEach((p,g)=>{const f=`fields.${g}`;E.test(p.id)?i.indexOf(p.id)!==g&&o(`${f}.id`,"duplicate"):o(`${f}.id`,"id"),l(p.label)||o(`${f}.label`,"label"),C.includes(p.type)||o(`${f}.type`,"type"),p.options.length>Z&&o(`${f}.options`,"too_many"),p.options.some($=>!$.trim()||$.length>S||/[\u0000-\u001f]/.test($))&&o(`${f}.options`,"option"),new Set(p.options).size!==p.options.length&&o(`${f}.options`,"duplicate"),p.type==="select"&&p.options.length===0&&o(`${f}.options`,"empty");const b=p.depends_on;if(b){const $=s.fields.find(w=>w.id===b.field_id);if(!$||b.field_id===p.id)o(`${f}.depends_on`,"parent");else{$.type==="select"&&b.value&&!$.options.includes(b.value)&&o(`${f}.depends_on`,"value");const w=new Set([p.id]);let v=b.field_id;for(;v;){if(w.has(v)){o(`${f}.depends_on`,"cycle");break}w.add(v),v=s.fields.find(k=>k.id===v)?.depends_on?.field_id}}b.value.length>S&&o(`${f}.depends_on`,"value")}});const n=s.groups.map(p=>p.id);return s.groups.forEach((p,g)=>{const f=`groups.${g}`;E.test(p.id)?n.indexOf(p.id)!==g&&o(`${f}.id`,"duplicate"):o(`${f}.id`,"id"),l(p.label)||o(`${f}.label`,"label");const b=p.station_ids??[];b.length>ee&&o(`${f}.station_ids`,"too_many"),new Set(b).size!==b.length&&o(`${f}.station_ids`,"duplicate"),b.some($=>!e.has($))&&o(`${f}.station_ids`,"unknown_station")}),a}const R=s=>Array.isArray(s)?[...s].sort():s,pe=(s,e)=>JSON.stringify(s??null)===JSON.stringify(e??null);function ce(s,e){const a=[];!!s.photo_enabled!=!!e.photo_enabled&&a.push({kind:"settings",id:"photo_enabled",label:"photo_enabled",state:"changed",changes:[{property:"photo_enabled",before:!!s.photo_enabled,after:!!e.photo_enabled}]});const o=[["fields",te],["groups",ae]];for(const[l,i]of o){const n=new Map(s[l].map(g=>[g.id,g])),p=new Map(e[l].map(g=>[g.id,g]));for(const g of[...new Set([...n.keys(),...p.keys()])].sort()){const f=n.get(g),b=p.get(g),$=[];for(const w of i){let v=f?f[w]:null,k=b?b[w]:null;w==="station_ids"&&(v=R(v),k=R(k)),pe(v,k)||$.push({property:w,before:v??null,after:k??null})}(!f||!b||$.length)&&a.push({kind:l,id:g,label:String((b??f)?.label??g),state:f?b?"changed":"removed":"added",changes:$})}}return a}const ue=s=>s.reduce((e,a)=>e+Math.max(1,a.changes.length),0);function he(s){const e=new Set(s.before),a=new Set(s.after);return{gains:s.after.filter(o=>!e.has(o)),loses:s.before.filter(o=>!a.has(o))}}function fe(s){return[...s].sort((e,a)=>Number(a.changed)-Number(e.changed)||e.display_name.localeCompare(a.display_name,"he"))}function ge(s){if(s instanceof y){const e=s.body?.details??{},a=String(e.outcome??"");return{outcome:a==="refused"?"refused":a==="not_sent"?"not_sent":a==="unknown"?"unknown":s.status>=400&&s.status<500?"not_sent":"unknown",code:String(s.code??e.wiskey_code??"")}}return{outcome:"unknown",code:"network"}}function be(s){if(!(s instanceof y))return{};const e=(s.body?.details??{}).problems??[];return Object.fromEntries(e.map(a=>[a.path,a.code]))}function $e(s){return s.readback?.matches?"ok":"warn"}function me(s,e){const a=Date.parse(s);return Number.isFinite(a)?Math.max(0,Math.round((a-e)/1e3)):0}function F(s,e,a,o,l){if(e==null)return l.none;if(typeof e=="boolean")return e?l.yes:l.no;if(s==="station_ids"&&Array.isArray(e))return e.length?e.map(i=>a[String(i)]??String(i)).join(", "):l.none;if(s==="options"&&Array.isArray(e))return e.length?e.join(", "):l.none;if(s==="type")return l.types[String(e)]??String(e);if(s==="depends_on"&&typeof e=="object"){const i=e;return`${o[i.field_id]??i.field_id} = ${i.value||"—"}`}return String(e)}var ve=Object.defineProperty,we=Object.getOwnPropertyDescriptor,u=(s,e,a,o)=>{for(var l=o>1?void 0:o?we(e,a):e,i=s.length-1,n;i>=0;i--)(n=s[i])&&(l=(o?n(e,a,l):n(l))||l);return o&&l&&ve(e,a,l),l};let c=class extends N{constructor(){super(...arguments),this.route=null,this.tab="draft",this.phase="edit",this.load="loading",this.loadError="",this.view=null,this.base=null,this.draft=null,this.baseRevision=0,this.rollback=null,this.serverProblems={},this.busy=!1,this.error="",this.previewReply=null,this.confirmOpen=!1,this.confirmChecked=!1,this.result=null,this.resultError=null,this.checkLine="",this.now=Date.now(),this.versions=null,this.versionsError="",this.compare=null,this.compareError="",this.peopleQuery="",this.people=[],this.person=null,this.suggest=null,this.suggestFields=[],this.suggestError="",this.timer=0}connectedCallback(){super.connectedCallback(),this.reload(),this.timer=window.setInterval(()=>this.now=Date.now(),1e3)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}async reload(){if(this.load="loading",this.error="",!j()){this.load="forbidden";return}try{if(!(await G()).can_edit){this.load="forbidden";return}const e=await M();if(this.view=e,e.state==="unsupported"||e.features.view.available===!1){this.load="unsupported";return}if(!e.policy){this.load="error",this.loadError=e.last_error||e.state;return}const a={photo_enabled:e.policy.photo_enabled,fields:e.policy.fields,groups:e.policy.groups};this.base=_(a),this.draft=_(a),this.baseRevision=e.policy.revision,this.rollback=null,this.serverProblems={},this.phase="edit",this.previewReply=null,this.load="ready"}catch(s){this.load=s instanceof y&&s.status===403?"forbidden":"error",this.loadError=x(s)}}get known(){const s=new Set((this.view?.stations??[]).map(e=>e.id));for(const e of this.base?.groups??[])for(const a of e.station_ids??[])s.add(a);return s}get names(){return Object.fromEntries((this.view?.stations??[]).map(s=>[s.id,s.name]))}get problems(){return this.draft?{...de(this.draft,this.known),...this.serverProblems}:{}}get rows(){return this.base&&this.draft?ce(this.base,this.draft):[]}edit(s){if(!this.draft)return;const e=_(this.draft);s(e),this.draft=e,this.serverProblems={},this.error=""}setField(s,e){this.edit(a=>a.fields[s]={...a.fields[s],...e})}setGroup(s,e){this.edit(a=>a.groups[s]={...a.groups[s],...e})}async preview(){if(!(!this.draft||this.busy||Object.keys(this.problems).length)){this.busy=!0,this.error="";try{this.previewReply=await U(this.baseRevision,this.draft),this.phase="preview",this.confirmChecked=!1}catch(s){this.serverProblems=be(s),this.error=this.errorText(s)}finally{this.busy=!1}}}errorText(s){return s instanceof y?`e_${s.code}`in V?t(`e_${s.code}`):s.message||s.code:t("e_network")}async apply(){const s=this.previewReply;if(!(!s||this.busy||!this.confirmChecked)){this.busy=!0,this.resultError=null,this.checkLine="";try{this.result=await H(s.review_id)}catch(e){const a=ge(e);this.result=null,this.resultError={outcome:a.outcome,code:a.code,message:e instanceof y?e.message:t("e_network")}}finally{this.busy=!1,this.confirmOpen=!1,this.phase="result"}}}async check(){const s=this.previewReply;if(!(!s||this.busy)){this.busy=!0;try{const e=await X(s.review_id);e.verdict==="applied"?(this.checkLine=t("checkApplied",{n:e.readback.revision??""}),this.resultError=null,this.result=e.result):e.verdict==="not_applied"?(this.checkLine=t("checkNotApplied"),this.resultError={outcome:"not_sent",code:"not_applied",message:t("checkNotApplied")}):this.checkLine=t("checkElsewhere")}catch(e){this.checkLine=x(e)}finally{this.busy=!1}}}closeResult(){this.result?this.reload():(this.phase="edit",this.previewReply=null),this.result=null,this.resultError=null,this.checkLine=""}async loadVersions(s=0){this.versionsError="";try{this.versions=(await J(s,20)).versions}catch(e){this.versionsError=e instanceof y?m(`e_${e.code}`,"e_network"):t("e_network")}}async compareWith(s){this.compareError="",this.compare=null;try{this.compare=(await B(s,this.baseRevision)).compare}catch(e){this.compareError=e instanceof y?m(`e_${e.code}`,"e_network"):t("e_network")}}async loadRollback(s){this.compareError="";try{const e=await Q(s);e.base_revision!==this.baseRevision&&await this.reload(),this.draft=_(e.values),this.rollback=e,this.tab="draft",this.phase="edit"}catch(e){this.compareError=e instanceof y?m(`e_${e.code}`,"e_network"):t("e_network")}}async searchPeople(){this.suggestError="";try{const s=await Y({query:this.peopleQuery.trim(),filters:{},offset:0,limit:20,snapshot:""});this.people=(s.people?.records??[]).map(e=>({id:e.id,display_name:e.display_name}))}catch(s){this.suggestError=x(s)}}async pickPerson(s){this.person=s,this.suggestFields=[],await this.runSuggest()}async runSuggest(){if(this.person){this.suggestError="";try{this.suggest=(await W(this.person.id,this.suggestFields)).suggestions}catch(s){this.suggest=null,this.suggestError=s instanceof y?s.message:t("e_network")}}}setTab(s){this.tab=s,s==="versions"&&!this.versions&&this.loadVersions()}render(){const s=t("title");return this.load==="loading"?r`<sw-page heading=${s}><sw-state-panel state="loading" heading=${t("loading")} data-pf-state="loading"></sw-state-panel></sw-page>`:this.load==="forbidden"?r`<sw-page heading=${s}><sw-state-panel quiet state="forbidden" heading=${t("noPermission")} hint=${t("noPermissionHint")} data-pf-state="forbidden"></sw-state-panel></sw-page>`:this.load==="unsupported"?r`<sw-page heading=${s}><sw-state-panel icon="users" quiet state="empty" heading=${t("unsupported")} data-pf-state="unsupported"></sw-state-panel></sw-page>`:this.load==="error"||!this.draft||!this.base?r`<sw-page heading=${s}><sw-state-panel state="error" heading=${t("loadError")} hint=${this.loadError} actionLabel=${t("retry")} @action=${()=>void this.reload()}
        data-pf-state="error"></sw-state-panel></sw-page>`:r`<sw-page wide heading=${s} subheading=${t("sub")} data-pf data-pf-state="ready" data-pf-phase=${this.phase}>
      <div class="tabs" role="tablist" aria-label=${s}>
        ${["draft","versions","suggest"].map(e=>r`<button role="tab" aria-selected=${String(this.tab===e)} class=${this.tab===e?"on":""} data-pf-tab=${e}
          @click=${()=>this.setTab(e)}>${t(e==="draft"?"tabDraft":e==="versions"?"tabVersions":"tabSuggest")}</button>`)}
      </div>
      ${this.tab==="draft"?this.phase==="edit"?this.renderEditor():this.phase==="preview"?this.renderPreview():this.renderResult():d}
      ${this.tab==="versions"?this.renderVersions():d}
      ${this.tab==="suggest"?this.renderSuggest():d}
      ${this.confirmOpen?this.renderConfirm():d}
    </sw-page>`}renderEditor(){const s=this.draft,e=this.problems,a=this.rows,o=ue(a),l=this.view?.features.edit.available!==!1;return r`<div class="stack">
      <div class="bar" data-pf-bar>
        <div class="bar-text">
          <b data-pf-base>${this.rollback?t("rollbackOf",{n:this.rollback.target_revision}):t("draftOf",{n:this.baseRevision})}</b>
          <span class="muted" data-pf-dirty=${o}>${o?t("dirty",{n:o}):t("clean")}</span>
        </div>
        <div class="bar-acts">
          <sw-button variant="ghost" icon="refresh" ?disabled=${this.busy} data-pf-discard @click=${()=>void this.reload()}>${o||this.rollback?t("discard"):t("reload")}</sw-button>
          <sw-button variant="primary" icon="eye" ?disabled=${!l||this.busy||!o||Object.keys(e).length>0} data-pf-preview @click=${()=>void this.preview()}>
            ${this.busy?t("previewing"):t("preview")}</sw-button>
        </div>
      </div>
      ${l?d:r`<p class="note warn" data-pf-edit-unsupported>${t("partUnsupported")}</p>`}
      ${this.rollback?r`<div class="note" data-pf-rollback-notes><b>${t("rollbackHint")}</b>
        <ul>${this.rollback.notes.map(i=>r`<li data-pf-note=${i.code}>${m(`note_${i.code}`,"none",{id:this.itemLabel(i.id)})}</li>`)}</ul></div>`:d}
      ${this.error?r`<p class="note err" role="alert" data-pf-error>${this.error}</p>`:d}
      ${Object.keys(e).length?r`<p class="note warn" data-pf-problems>${t("problemsTitle")} (${Object.keys(e).length})</p>`:d}

      <section class="card" data-pf-groups>
        <header><h2>${t("groupsTitle")}</h2><span class="muted">${t("groupsHint")}</span></header>
        ${s.groups.map((i,n)=>this.renderGroup(i,n,e))}
        <div><sw-button variant="secondary" icon="plus" ?disabled=${s.groups.length>=A} data-pf-add-group
          @click=${()=>this.edit(i=>i.groups.push(ne(i,t("newGroupLabel"))))}>${t("addGroup")}</sw-button></div>
      </section>

      <section class="card" data-pf-fields>
        <header><h2>${t("fieldsTitle")}</h2><span class="muted">${t("fieldsHint")}</span></header>
        ${s.fields.map((i,n)=>this.renderField(i,n,e))}
        <div><sw-button variant="secondary" icon="plus" ?disabled=${s.fields.length>=L} data-pf-add-field
          @click=${()=>this.edit(i=>i.fields.push(ie(i,t("newFieldLabel"))))}>${t("addField")}</sw-button></div>
      </section>

      <section class="card" data-pf-settings>
        <header><h2>${t("settingsTitle")}</h2></header>
        <label class="row-inline"><sw-toggle .checked=${s.photo_enabled} label=${t("photoEnabled")} data-pf-photo
          @change=${i=>this.edit(n=>n.photo_enabled=i.detail.checked)}></sw-toggle></label>
      </section>
    </div>`}itemLabel(s){const[e,a]=s.split(".");return((e==="fields"?this.draft?.fields:e==="groups"?this.draft?.groups:null)??[]).find(l=>l.id===a)?.label??a??s}mark(s,e){const a=(s==="fields"?this.base?.fields:this.base?.groups)?.find(l=>l.id===e);if(!a)return r`<sw-badge kind="live" label=${t("newItem")} data-pf-mark="new"></sw-badge>`;const o=(s==="fields"?this.draft?.fields:this.draft?.groups)?.find(l=>l.id===e);return JSON.stringify(a)!==JSON.stringify(o)?r`<sw-badge kind="partial" label=${t("edited")} data-pf-mark="edited"></sw-badge>`:d}problem(s,e){const a=s[e];return a?r`<span class="problem" role="alert" data-pf-problem=${e}>${m(`p_${a}`,"p_shape")}</span>`:d}renderGroup(s,e,a){const o=this.view?.stations??[],l=new Set(s.station_ids??[]),i=[...l].filter(n=>!o.some(p=>p.id===n));return r`<div class="item ${s.enabled?"":"off"}" data-pf-group=${s.id}>
      <div class="item-top">
        <label class="lbl"><span class="sr">${t("label")}</span>
          <input type="text" maxlength="64" .value=${s.label} aria-label=${t("label")} data-pf-group-label
            @input=${n=>this.setGroup(e,{label:n.target.value})} /></label>
        ${this.mark("groups",s.id)}
        <sw-toggle .checked=${s.enabled} label=${t("enabled")} data-pf-group-enabled @change=${n=>this.setGroup(e,{enabled:n.detail.checked})}></sw-toggle>
        ${O(this.base,"groups",s.id)?r`<sw-button variant="ghost" size="sm" icon="trash" iconOnly label=${t("remove")} data-pf-group-remove @click=${()=>this.edit(n=>n.groups.splice(e,1))}></sw-button>`:d}
      </div>
      ${this.problem(a,`groups.${e}.label`)}${this.problem(a,`groups.${e}.id`)}
      <div class="chips" role="group" aria-label=${t("stations")}>
        ${o.map(n=>{const p=l.has(n.id),g=!p&&!n.lock_enabled;return r`<button type="button" class="chip ${p?"on":""}" aria-pressed=${String(p)} ?disabled=${g} data-pf-station=${n.id}
            title=${g?t("stationNoLock"):n.online?n.name:t("stationOffline")} @click=${()=>this.setGroup(e,P(s,n.id))}>
            ${n.name}${n.online?d:r`<span class="dot" aria-label=${t("stationOffline")}></span>`}</button>`})}
        ${i.map(n=>r`<button type="button" class="chip on unknown" aria-pressed="true" data-pf-station=${n} title=${t("stationUnknown")}
          @click=${()=>this.setGroup(e,P(s,n))}>${n}</button>`)}
        ${l.size?d:r`<span class="muted" data-pf-no-stations>${t("stationsNone")}</span>`}
      </div>
      ${this.problem(a,`groups.${e}.station_ids`)}
    </div>`}renderField(s,e,a){const o=this.draft,l=le(o.fields,s.id),i=s.depends_on?o.fields.find(n=>n.id===s.depends_on?.field_id):void 0;return r`<div class="item ${s.enabled?"":"off"}" data-pf-field=${s.id}>
      <div class="item-top">
        <label class="lbl"><span class="sr">${t("label")}</span>
          <input type="text" maxlength="64" .value=${s.label} aria-label=${t("label")} data-pf-field-label
            @input=${n=>this.setField(e,{label:n.target.value})} /></label>
        ${this.mark("fields",s.id)}
        ${s.depends_on?r`<sw-badge kind="neutral" label=${t("conditional")} data-pf-conditional></sw-badge>`:d}
        <sw-toggle .checked=${s.enabled} label=${t("enabled")} data-pf-field-enabled @change=${n=>this.setField(e,{enabled:n.detail.checked})}></sw-toggle>
        <span class="moves">
          <button type="button" class="mv" aria-label=${t("moveUp")} title=${t("moveUp")} ?disabled=${e===0} data-pf-field-up @click=${()=>this.edit(n=>n.fields=z(n.fields,e,-1))}>↑</button>
          <button type="button" class="mv" aria-label=${t("moveDown")} title=${t("moveDown")} ?disabled=${e===o.fields.length-1} data-pf-field-down
            @click=${()=>this.edit(n=>n.fields=z(n.fields,e,1))}>↓</button>
          ${O(this.base,"fields",s.id)?r`<sw-button variant="ghost" size="sm" icon="trash" iconOnly label=${t("remove")} data-pf-field-remove @click=${()=>this.edit(n=>n.fields.splice(e,1))}></sw-button>`:d}
        </span>
      </div>
      ${this.problem(a,`fields.${e}.label`)}${this.problem(a,`fields.${e}.id`)}
      <div class="grid">
        <label class="f"><span>${t("type")}</span>
          <select data-pf-field-type .value=${s.type} @change=${n=>this.setField(e,{type:n.target.value})}>
            ${C.map(n=>r`<option value=${n} ?selected=${s.type===n}>${m(`type_${n}`,"type_text")}</option>`)}
          </select></label>
        <label class="ck"><input type="checkbox" .checked=${s.required} data-pf-field-required @change=${n=>this.setField(e,{required:n.target.checked})} />
          ${t("required")}</label>
        <label class="ck"><input type="checkbox" .checked=${s.unique} data-pf-field-unique @change=${n=>this.setField(e,{unique:n.target.checked})} />
          ${t("unique")}</label>
        <label class="f"><span>${t("dependsOn")}</span>
          <select data-pf-field-parent @change=${n=>{const p=n.target.value;this.setField(e,{depends_on:p?{field_id:p,value:""}:null})}}>
            <option value="" ?selected=${!s.depends_on}>${t("dependsNone")}</option>
            ${l.map(n=>r`<option value=${n.id} ?selected=${s.depends_on?.field_id===n.id}>${n.label}</option>`)}
          </select></label>
        ${s.depends_on?r`<label class="f"><span>${t("dependsValue")}</span>
              ${i?.type==="select"?r`<select data-pf-field-parent-value @change=${n=>this.setField(e,{depends_on:{field_id:s.depends_on.field_id,value:n.target.value}})}>
                    <option value="" ?selected=${!s.depends_on.value}>—</option>
                    ${i.options.map(n=>r`<option value=${n} ?selected=${s.depends_on?.value===n}>${n}</option>`)}</select>`:r`<input type="text" maxlength="100" .value=${s.depends_on.value} data-pf-field-parent-value
                    @input=${n=>this.setField(e,{depends_on:{field_id:s.depends_on.field_id,value:n.target.value}})} />`}</label>`:d}
      </div>
      ${this.problem(a,`fields.${e}.depends_on`)}
      ${s.type==="select"?r`<label class="f wide"><span>${t("options")} <span class="muted">(${t("optionsHint")})</span></span>
            <textarea rows="3" data-pf-field-options .value=${s.options.join(`
`)} @change=${n=>this.setField(e,{options:oe(n.target.value)})}></textarea></label>
            ${this.problem(a,`fields.${e}.options`)}`:d}
    </div>`}diffList(s){const e=this.names,a=Object.fromEntries((this.draft?.fields??[]).map(l=>[l.id,l.label])),o={yes:t("yes"),no:t("no"),none:t("none"),types:{text:t("type_text"),select:t("type_select"),number:t("type_number"),date:t("type_date")}};return r`<ul class="diff" data-pf-diff>${s.map(l=>r`<li data-pf-diff-row=${`${l.kind}.${l.id}`}>
      <div class="diff-head"><span class="muted">${m(`kind_${l.kind}`,"kind_fields")}</span> <b>${l.kind==="settings"?t("photoEnabled"):l.label}</b>
        <sw-badge kind=${l.state==="added"?"live":l.state==="removed"?"error":"partial"} label=${m(`state_${l.state}`,"state_changed")}></sw-badge></div>
      ${l.changes.length?r`<dl>${l.changes.map(i=>r`<dt>${m(`prop_${i.property}`,"prop_label")}</dt>
            <dd><span class="before" data-pf-before>${F(i.property,i.before,e,a,o)}</span> <span aria-hidden="true">←</span>
              <span class="after" data-pf-after>${F(i.property,i.after,e,a,o)}</span></dd>`)}</dl>`:d}
    </li>`)}</ul>`}renderPreview(){const s=this.previewReply,e=s.impact,a=me(s.expires_at,this.now),o=e.station_names,l=fe(e.people);return r`<div class="stack" data-pf-preview-panel>
      <div class="bar">
        <div class="bar-text"><b>${t("previewTitle")}</b><span class="muted">${t("previewSub")}</span></div>
        <div class="bar-acts">
          <sw-button variant="ghost" icon="chevronBack" data-pf-back @click=${()=>(this.phase="edit",this.previewReply=null)}>${t("back")}</sw-button>
          <sw-button variant="primary" icon="check" ?disabled=${!e.can_apply||a<=0||this.busy} data-pf-confirm-open
            @click=${()=>(this.confirmOpen=!0,this.confirmChecked=!1)}>${t("confirmApply")}</sw-button>
        </div>
      </div>
      ${e.can_apply?d:r`<p class="note err" role="alert" data-pf-blocked>${t("blocked")}</p>`}
      <p class="muted" data-pf-expiry>${a>0?t("expiresAt",{time:new Date(s.expires_at).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}):t("expired")}
        · ${t("deviceWrites")}</p>

      <section class="card"><header><h2>${t("changesTitle")}</h2></header>${this.diffList(s.diff)}</section>

      <section class="card" data-pf-impact>
        <header><h2>${t("impactPeople")}</h2>
          <span class="count" data-pf-impact-changed=${e.changed}>${t("impactPeopleCount",{n:e.changed})}</span></header>
        ${e.changed===0&&!l.some(i=>i.changed)?r`<p class="muted" data-pf-impact-none>${t("impactNone")}</p>`:d}
        ${l.length?r`<p class="muted">${t("impactListed",{n:l.length})}${e.people_truncated?` · ${t("impactTruncated")}`:""}</p>
            <ul class="people" data-pf-people>${l.map(i=>{const n=he(i);return r`<li data-pf-person=${i.user_id} class=${i.changed?"changed":""}>
                <b>${i.display_name}</b>${i.employee_no?r` <span class="muted">${i.employee_no}</span>`:d}
                ${n.gains.length?r`<span class="gain" data-pf-gains>${t("gains")}: ${n.gains.map(p=>o[p]??p).join(", ")}</span>`:d}
                ${n.loses.length?r`<span class="lose" data-pf-loses>${t("loses")}: ${n.loses.map(p=>o[p]??p).join(", ")}</span>`:d}
                ${!n.gains.length&&!n.loses.length?r`<span class="muted">${t("noChange")}</span>`:d}
                ${i.overrides?r`<span class="muted">${t("overrides",{n:i.overrides})}</span>`:d}
              </li>`})}</ul>`:d}
        <div class="kv">
          <div><span class="muted">${t("impactStations")}</span> <b data-pf-impact-stations=${e.stations.length}>${e.stations.length?e.stations.map(i=>o[i]??i).join(", "):t("none")}</b></div>
          ${e.offline.length?r`<div><span class="muted">${t("impactOffline")}</span> <b data-pf-impact-offline>${e.offline.map(i=>o[i]??i).join(", ")}</b></div>`:d}
        </div>
      </section>

      ${e.field_changes.length?r`<section class="card" data-pf-fields-impact><header><h2>${t("fieldsImpact")}</h2></header>
            ${e.field_changes.map(i=>r`<div class="fi ${i.duplicates?"bad":""}" data-pf-field-impact=${i.field_id}>
              <b>${i.label}</b> <span class="muted">${t("fieldChecked",{n:i.checked})}</span>
              ${i.missing?r`<span class="warn-t">${t("fieldMissing",{n:i.missing})}</span>`:d}
              ${i.invalid?r`<span class="warn-t">${t("fieldInvalid",{n:i.invalid})}</span>`:d}
              ${i.duplicates?r`<span class="err-t" data-pf-dups=${i.duplicates}>${t("fieldDuplicates",{n:i.duplicates})}</span>`:d}
              ${i.newly_applicable?r`<span class="muted">${t("fieldNewlyApplicable",{n:i.newly_applicable})}</span>`:d}
              ${i.template_issues?r`<span class="muted">${t("fieldTemplates",{n:i.template_issues})}</span>`:d}
              ${i.examples.length||i.duplicate_examples.length?r`<div class="muted ex">${[...i.duplicate_examples,...i.examples].map(n=>n.display_name).join(" · ")}</div>`:d}
            </div>`)}
          </section>`:d}
    </div>`}renderConfirm(){const s=this.previewReply,e=s.base_revision,a=s.impact.changed?t("confirmText",{from:e,to:e+1,people:s.impact.changed,stations:s.impact.stations.length}):t("confirmTextNoAccess",{from:e,to:e+1});return r`<sw-dialog open heading=${t("confirmTitle")} @close=${()=>this.confirmOpen=!1} data-pf-confirm>
      <p data-pf-confirm-sentence>${a}</p>
      <label class="ck"><input type="checkbox" .checked=${this.confirmChecked} data-pf-confirm-check
        @change=${o=>this.confirmChecked=o.target.checked} /> ${t("confirmCheck")}</label>
      <div slot="footer" class="dlg-acts">
        <sw-button variant="ghost" data-pf-confirm-cancel @click=${()=>this.confirmOpen=!1}>${t("cancel")}</sw-button>
        <sw-button variant="primary" icon="check" ?disabled=${!this.confirmChecked||this.busy} data-pf-confirm-send @click=${()=>void this.apply()}>
          ${this.busy?t("saving"):t("confirmApply")}</sw-button>
      </div>
    </sw-dialog>`}renderResult(){const s=this.result;if(s){const o=$e(s),l=s.readback;return r`<section class="card result ${o}" data-pf-result="saved" data-pf-tone=${o} role="status">
        <header><h2>${t("resultSaved")}</h2></header>
        ${s.repeated?r`<p data-pf-repeated>${t("resultRepeated")}</p>`:d}
        <p data-pf-readback>${l.matches?t("resultReadbackOk",{n:l.revision??""}):l.revision!==null?t("resultReadbackOther",{n:l.revision}):t("resultReadbackFail")}</p>
        ${s.receipt?r`<p data-pf-changed>${t("resultChanged",{n:s.receipt.changed})}</p>`:d}
        <p data-pf-sync>${s.receipt&&s.receipt.stations.length?t("resultSync",{n:s.receipt.stations.length}):t("resultNoSync")}</p>
        ${this.checkLine?r`<p class="muted" data-pf-check-line>${this.checkLine}</p>`:d}
        <div><sw-button variant="primary" data-pf-done @click=${()=>this.closeResult()}>${t("done")}</sw-button></div>
      </section>`}const e=this.resultError,a=e?.outcome==="unknown";return r`<section class="card result ${a?"warn":"err"}" data-pf-result=${a?"unknown":"not_saved"} data-pf-outcome=${e?.outcome??""} role="alert">
      <header><h2>${a?t("resultUnknown"):t("resultNotSaved")}</h2></header>
      <p data-pf-result-text>${a?t("resultUnknownText"):e?m(`e_${e.code}`,"outcome_refused"):""}</p>
      ${e&&!a?r`<p class="muted">${e.message}</p>`:d}
      ${this.checkLine?r`<p data-pf-check-line>${this.checkLine}</p>`:d}
      <div class="row-inline">
        ${a?r`<sw-button variant="primary" icon="search" ?disabled=${this.busy} data-pf-check @click=${()=>void this.check()}>${this.busy?t("checking"):t("check")}</sw-button>`:d}
        ${!a&&e?.code==="not_applied"?r`<sw-button variant="primary" data-pf-reapply @click=${()=>(this.phase="preview",this.resultError=null)}>${t("confirmApply")}</sw-button>`:d}
        <sw-button variant=${a?"ghost":"primary"} data-pf-new-preview @click=${()=>void this.reload()}>${t("reload")}</sw-button>
      </div>
    </section>`}renderVersions(){const s=this.versions;if(this.view?.features.versions.available===!1)return r`<p class="note warn" data-pf-versions-unsupported>${t("partUnsupported")}</p>`;if(this.versionsError)return r`<sw-state-panel state="error" heading=${this.versionsError} actionLabel=${t("retry")} @action=${()=>void this.loadVersions()} data-pf-versions-error></sw-state-panel>`;if(!s)return r`<sw-state-panel state="loading" heading=${t("loading")}></sw-state-panel>`;const e=this.view?.features.compare.available!==!1;return r`<div class="stack" data-pf-versions>
      <section class="card"><header><h2>${t("versionsTitle")}</h2><span class="muted">${t("versionsHint")}</span></header>
        ${s.records.length?d:r`<p class="muted">${t("versionsEmpty")}</p>`}
        <ul class="versions">${s.records.map(a=>{const o=a.revision===s.current_revision;return r`<li data-pf-version=${a.revision??""}>
            <b>${t("revision",{n:a.revision??"?"})}</b>
            ${o?r`<sw-badge kind="live" label=${t("versionCurrent")}></sw-badge>`:d}
            <span class="muted">${a.saved_at?new Date(a.saved_at).toLocaleString("he-IL",{dateStyle:"short",timeStyle:"short"}):t("versionBaseline")}</span>
            <span>${m(`versionAction_${a.action??""}`,"versionAction_system")}</span>
            <span class="muted">${t("versionChanges",{f:a.field_changes??0,g:a.group_changes??0})}</span>
            ${!o&&e&&a.revision!==null?r`<span class="acts"><sw-button size="sm" variant="secondary" data-pf-compare=${a.revision} @click=${()=>void this.compareWith(a.revision)}>${t("compareWith")}</sw-button>
                  <sw-button size="sm" variant="ghost" icon="history" data-pf-rollback=${a.revision} @click=${()=>void this.loadRollback(a.revision)}>${t("rollback")}</sw-button></span>`:d}
          </li>`})}</ul>
        <div class="row-inline">
          ${s.previous_offset!==null?r`<sw-button size="sm" variant="ghost" @click=${()=>void this.loadVersions(s.previous_offset)}>${t("newerVersions")}</sw-button>`:d}
          ${s.next_offset!==null?r`<sw-button size="sm" variant="ghost" @click=${()=>void this.loadVersions(s.next_offset)}>${t("olderVersions")}</sw-button>`:d}
        </div>
      </section>
      ${this.compareError?r`<p class="note err" role="alert" data-pf-compare-error>${this.compareError}</p>`:d}
      ${this.compare?r`<section class="card" data-pf-compare-panel><header><h2>${t("compareTitle",{a:this.compare.before_revision??"",b:this.compare.after_revision??""})}</h2></header>
            ${this.compare.rows.length?this.diffList(this.compare.rows):r`<p class="muted">${t("compareEmpty")}</p>`}</section>`:d}
    </div>`}renderSuggest(){if(this.view?.features.suggestions.available===!1)return r`<p class="note warn" data-pf-suggest-unsupported>${t("partUnsupported")}</p>`;const s=this.suggest;return r`<div class="stack" data-pf-suggest>
      <section class="card"><header><h2>${t("suggestTitle")}</h2><span class="muted">${t("suggestHint")}</span></header>
        <form class="row-inline" @submit=${e=>(e.preventDefault(),void this.searchPeople())}>
          <label class="f grow"><span>${t("suggestSearch")}</span><input type="search" .value=${this.peopleQuery} placeholder=${t("suggestSearchPh")} data-pf-people-q
            @input=${e=>this.peopleQuery=e.target.value} /></label>
          <sw-button type="submit" variant="secondary" icon="search" data-pf-people-search @click=${()=>void this.searchPeople()}>${t("suggestSearch")}</sw-button>
        </form>
        ${this.people.length?r`<div class="chips" role="listbox" aria-label=${t("suggestSearch")}>${this.people.map(e=>r`<button type="button" role="option" class="chip ${this.person?.id===e.id?"on":""}"
              aria-selected=${String(this.person?.id===e.id)} data-pf-pick=${e.id} @click=${()=>void this.pickPerson(e)}>${e.display_name}</button>`)}</div>`:d}
        ${this.suggestError?r`<p class="note err" role="alert" data-pf-suggest-error>${this.suggestError}</p>`:d}
      </section>
      ${s&&this.person?r`<section class="card" data-pf-suggest-result><header><h2>${this.person.display_name}</h2></header>
            ${s.fields.length?r`<fieldset class="chips"><legend class="muted">${t("suggestFields")}</legend>${s.fields.map(e=>{const a=this.suggestFields.includes(e.id);return r`<label class="ck chip ${a?"on":""}"><input type="checkbox" .checked=${a} data-pf-suggest-field=${e.id}
                    ?disabled=${!a&&this.suggestFields.length>=se}
                    @change=${o=>{const l=o.target.checked;this.suggestFields=l?[...this.suggestFields,e.id]:this.suggestFields.filter(i=>i!==e.id)}} /> ${e.label}: ${e.value??t("suggestValueHidden")}</label>`})}
                <sw-button variant="primary" ?disabled=${!this.suggestFields.length} data-pf-suggest-run @click=${()=>void this.runSuggest()}>${t("suggestRun")}</sw-button></fieldset>`:r`<p class="muted">${t("suggestNoFields")}</p>`}
            ${this.suggestFields.length&&!s.suggestions.length?r`<p class="muted" data-pf-suggest-none>${t("suggestNone")}</p>`:d}
            <ul class="people">${s.suggestions.map(e=>r`<li data-pf-suggestion=${e.group_id}><b>${e.label}</b>
              <span class="muted">${t("suggestMembers",{n:e.matching_members,m:e.matching_people})}</span>
              <span>${t("suggestDoors")}: ${e.doors.map(a=>`${a.station_name}${a.blocked?` (${t("suggestBlocked")})`:""}`).join(", ")}</span></li>`)}</ul>
            <a class="link" href=${`#/wiskey/people?person=${encodeURIComponent(this.person.id)}`} data-pf-open-person>${t("suggestOpenPerson")}</a>
          </section>`:d}
    </div>`}};c.styles=D`
    :host { display: block; }
    .stack { display: grid; gap: 14px; }
    .tabs { display: inline-flex; gap: 2px; padding: 3px; margin-block-end: 14px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); border: 1px solid var(--sw-border);
      max-inline-size: 100%; overflow-x: auto; }
    .tabs button { font: inherit; font-size: var(--sw-fs-sm); padding: 6px 14px; border: 0; border-radius: calc(var(--sw-r-md) - 2px); background: transparent; color: var(--sw-text-2); cursor: pointer;
      white-space: nowrap; min-block-size: 36px; }
    .tabs button.on { background: var(--sw-seg-key, var(--sw-surface)); color: var(--sw-seg-key-ink, var(--sw-text)); font-weight: 600; box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    .tabs button:focus-visible, .chip:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 2px; }
    .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface);
      border: 1px solid var(--sw-border); position: sticky; inset-block-start: 0; z-index: 2; }
    .bar-text { display: grid; gap: 2px; min-inline-size: 0; }
    .bar-acts { display: flex; flex-wrap: wrap; gap: 8px; }
    .card { display: grid; gap: 10px; padding: 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); min-inline-size: 0; }
    .card header { display: grid; gap: 2px; }
    h2 { margin: 0; font-size: var(--sw-fs-lg); font-weight: 700; color: var(--sw-text); }
    .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .note { margin: 0; padding: 10px 12px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); font-size: var(--sw-fs-sm); }
    .note ul { margin: 6px 0 0; padding-inline-start: 18px; }
    .note.warn { border-color: var(--sw-warning); background: var(--sw-warning-soft); }
    .note.err { border-color: var(--sw-danger); background: var(--sw-danger-soft); }
    .item { display: grid; gap: 8px; padding: 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface-2); min-inline-size: 0; }
    .item.off { opacity: 0.72; }
    .item-top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .item-top .lbl { flex: 1 1 14em; min-inline-size: 0; }
    .moves { display: inline-flex; gap: 2px; margin-inline-start: auto; align-items: center; }
    .mv { font: inherit; inline-size: 34px; block-size: 34px; border-radius: var(--sw-r-sm); border: 1px solid transparent; background: transparent; color: var(--sw-text-2); cursor: pointer; }
    .mv:hover:not([disabled]) { border-color: var(--sw-border); color: var(--sw-text); }
    .mv[disabled] { opacity: 0.35; cursor: default; }
    .mv:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 2px; }
    input[type='text'], input[type='search'], select, textarea { font: inherit; font-size: 1rem; color: var(--sw-text); background: var(--sw-surface); border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); padding: 7px 10px; min-block-size: 38px; inline-size: 100%; box-sizing: border-box; }
    textarea { min-block-size: 76px; resize: vertical; }
    .grid { display: grid; gap: 8px 12px; grid-template-columns: repeat(auto-fit, minmax(10em, 1fr)); align-items: end; }
    .f { display: grid; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
    .f.wide { grid-column: 1 / -1; }
    .f.grow { flex: 1 1 14em; }
    .ck { display: inline-flex; gap: 6px; align-items: center; font-size: var(--sw-fs-sm); min-block-size: 38px; }
    .row-inline { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; border: 0; padding: 0; margin: 0; min-inline-size: 0; }
    .chip { font: inherit; font-size: var(--sw-fs-sm); padding: 5px 12px; min-block-size: 32px; border-radius: 999px; border: 1px solid var(--sw-border); background: var(--sw-surface);
      color: var(--sw-text); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
    .chip.on { background: var(--sw-accent-soft); border-color: var(--sw-accent); color: var(--sw-accent-text); font-weight: 600; }
    .chip.unknown { border-style: dashed; }
    .chip[disabled] { opacity: 0.5; cursor: not-allowed; }
    .chip .dot { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--sw-text-3); }
    .problem { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
    .sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .diff, .people, .versions { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .diff li, .people li, .versions li { padding: 8px 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center;
      min-inline-size: 0; overflow-wrap: anywhere; }
    .diff li { display: grid; }
    .diff-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .diff dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 2px 10px; font-size: var(--sw-fs-sm); }
    .diff dt { color: var(--sw-text-2); }
    .diff dd { margin: 0; }
    .before { text-decoration: line-through; color: var(--sw-text-2); }
    .after { font-weight: 600; }
    .people li.changed { border-color: var(--sw-accent); }
    .gain { color: var(--sw-success); font-size: var(--sw-fs-sm); }
    .lose { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
    .warn-t { color: var(--sw-warning); font-size: var(--sw-fs-sm); }
    .err-t { color: var(--sw-danger); font-size: var(--sw-fs-sm); font-weight: 600; }
    .fi { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; padding-block: 4px; border-block-end: 1px solid var(--sw-border); }
    .fi .ex { flex-basis: 100%; }
    .kv { display: grid; gap: 4px; }
    .count { font-weight: 700; }
    .versions .acts { display: inline-flex; gap: 6px; margin-inline-start: auto; }
    .result.ok { border-color: var(--sw-success); }
    .result.warn { border-color: var(--sw-warning); }
    .result.err { border-color: var(--sw-danger); }
    .result p { margin: 0; }
    .dlg-acts { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .link { color: var(--sw-accent); font-size: var(--sw-fs-sm); }
    @media (max-width: 640px) {
      .bar { position: static; }
      .bar-acts { inline-size: 100%; }
      .bar-acts sw-button { flex: 1 1 auto; }
      .tabs { display: flex; }
      .tabs button { flex: 1 1 auto; }
    }
    @media (prefers-reduced-motion: no-preference) {
      .chip, .tabs button { transition: background-color 120ms ease-out, border-color 120ms ease-out; }
    }
  `;u([q({attribute:!1})],c.prototype,"route",2);u([h()],c.prototype,"tab",2);u([h()],c.prototype,"phase",2);u([h()],c.prototype,"load",2);u([h()],c.prototype,"loadError",2);u([h()],c.prototype,"view",2);u([h()],c.prototype,"base",2);u([h()],c.prototype,"draft",2);u([h()],c.prototype,"baseRevision",2);u([h()],c.prototype,"rollback",2);u([h()],c.prototype,"serverProblems",2);u([h()],c.prototype,"busy",2);u([h()],c.prototype,"error",2);u([h()],c.prototype,"previewReply",2);u([h()],c.prototype,"confirmOpen",2);u([h()],c.prototype,"confirmChecked",2);u([h()],c.prototype,"result",2);u([h()],c.prototype,"resultError",2);u([h()],c.prototype,"checkLine",2);u([h()],c.prototype,"now",2);u([h()],c.prototype,"versions",2);u([h()],c.prototype,"versionsError",2);u([h()],c.prototype,"compare",2);u([h()],c.prototype,"compareError",2);u([h()],c.prototype,"peopleQuery",2);u([h()],c.prototype,"people",2);u([h()],c.prototype,"person",2);u([h()],c.prototype,"suggest",2);u([h()],c.prototype,"suggestFields",2);u([h()],c.prototype,"suggestError",2);c=u([I("wiskey-profiles-screen")],c);export{c as WiskeyProfilesScreen};
//# sourceMappingURL=wiskey-profiles-B_hP78S0.js.map
