import{D as F,E as R,F as h,a as T,b as I,e as i,A as l,q as f,ht as j,H as N,G as u,fo as b,gK as m,gR as X,gS as Y,gT as J,h9 as Q,gV as ee,hu as se,bz as te,gr as ae,gk as ie,gC as re,gi as ne,g as x,b8 as _,bc as V,bb as oe}from"./index-xLRE7Qht.js";import{a as n,M as U,V as L,W as D,X as le,Y as de,c as ce,d as pe,Z as E,_ as ue,$ as he,l as ve,f as fe,b as be}from"./automations-logic-DRVAdVwl.js";var me=Object.defineProperty,ge=Object.getOwnPropertyDescriptor,z=(e,s,t,a)=>{for(var r=a>1?void 0:a?ge(s,t):s,d=e.length-1,o;d>=0;d--)(o=e[d])&&(r=(a?o(s,t,r):o(r))||r);return a&&r&&me(s,t,r),r};const ye={single:"ריצה אחת בכל פעם",restart:"התחלה מחדש",queued:"בתור",parallel:"במקביל"};let y=class extends T{constructor(){super(...arguments),this.trace=null,this.mode=null,this.now=new Date,this.timeZone=void 0}connectedCallback(){super.connectedCallback(),I(this)}resultChip(e,s){return i`<span class=${`chip ${e==="ok"?"ok":e==="error"?"bad":e==="running"?"info":""}`} data-trace-result=${e}>${s}</span>`}statusIcon(e){return e.status==="ok"?n("check"):e.status==="bad"?n("close"):e.status==="run"?n("play"):e.status==="info"?n("bolt"):n("minus")}vars(e){return e.length?i`<div class="vars">${e.map(([s,t])=>i`<span><bdi>${s}</bdi>: <b>${t}</b></span>`)}</div>`:l}row(e,s="",t){const a=e.depth>0?`margin-inline-start:${Math.min(e.depth,4)*14}px`:"";return i`<div class=${`row ${e.status} ${e.depth>0?"nest":""} ${s}`} style=${a} data-trace-row=${e.path}>
      <span class="st">${this.statusIcon(e)}</span>
      <div class="tx">${f(e.sentence)}${e.error?i`<div class="err">${e.error}</div>`:l}</div>
      <div class="meta">${e.time?i`<span>${e.time}</span>`:l}${e.duration?i`<span>${e.duration}</span>`:l}</div>
      <code class="path">${e.path}</code>
      ${this.vars(t??e.vars)}
    </div>`}render(){const e=this.trace;if(!e)return l;const s=j(e,{timeZone:this.timeZone}),t=U(e.at,this.now,this.timeZone).replace(/\s\d\d:\d\d$/,"");return i`
      <div class="sentence" data-trace-sentence>${n("help")}<div>${s.sentence}</div></div>
      <dl class="sum" data-trace-summary>
        <dt>תוצאה</dt><dd>${this.resultChip(s.result.id,s.result.label)}</dd>
        <dt>התחלה</dt><dd>${t} ${s.trigger.time??s.at}</dd>
        ${s.duration?i`<dt>משך</dt><dd>${s.duration}</dd>`:l}
        <dt>הופעלה על ידי</dt><dd>${s.who}</dd>
        ${this.mode?i`<dt>מצב</dt><dd>${ye[this.mode]??this.mode}</dd>`:l}
      </dl>
      <div class="sec" data-trace-trigger>
        <h5>${n("bolt")}טריגר</h5>
        ${this.row({...s.trigger,status:"info"},"",$e(e))}
      </div>
      <div class="sec" data-trace-conditions>
        <h5>${n("help")}תנאים${s.counts.conditions?i`<span class="cnt">עברו ${s.counts.conditions_passed}/${s.counts.conditions}</span>`:l}</h5>
        ${s.conditions.length?s.conditions.map(a=>this.row(a)):i`<div class="skip-note">אין תנאים</div>`}
      </div>
      <div class="sec" data-trace-steps>
        <h5>${n("play")}פעולות${s.counts.steps?i`<span class="cnt">בוצעו ${s.counts.steps_done}/${s.counts.steps}</span>`:l}</h5>
        ${s.steps.length?s.steps.map(a=>this.row(a)):i`<div class="skip-note">לא בוצעו פעולות</div>`}
      </div>`}};y.styles=[...F,R`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .sum {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px 16px;
      padding: 12px 16px;
      border-radius: var(--dv-radius-md);
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      font-size: var(--sw-fs-base);
    }
    .sum dt {
      color: var(--dv-text-2);
    }
    .sum dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
      min-inline-size: 0;
    }
    .sec {
      border-radius: var(--dv-radius-md);
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      overflow: hidden;
    }
    .sec > h5 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      color: var(--dv-text-2);
      background: var(--dv-surface-3);
    }
    .sec > h5 .ic {
      font-size: var(--sw-fs-md);
    }
    .sec > h5 .cnt {
      margin-inline-start: auto;
      font-variant-numeric: tabular-nums;
    }
    .row {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr) auto;
      gap: 4px 12px;
      align-items: start;
      padding: 10px 14px;
      border-block-start: 1px solid var(--dv-border);
    }
    .sec > h5 + .row {
      border-block-start: 0;
    }
    .row .st {
      grid-row: 1 / span 2;
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
    }
    .row .st .ic {
      font-size: var(--sw-fs-lg);
    }
    .row.ok .st {
      background: var(--dv-success-soft);
      color: var(--au-ok-text);
    }
    .row.bad .st {
      background: var(--dv-danger-soft);
      color: var(--dv-danger);
    }
    .row.run .st {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
    }
    .row.info .st {
      background: var(--dv-warning-soft);
      color: var(--au-warn-text);
    }
    .row .tx {
      font-size: var(--sw-fs-md);
      line-height: 1.45;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .row.skip .tx {
      color: var(--dv-text-2);
    }
    .row .err {
      color: var(--dv-danger);
      font-size: var(--sw-fs-base);
      margin-block-start: 2px;
    }
    .row .meta {
      grid-row: 1 / span 2;
      grid-column: 3;
      text-align: end;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      font-variant-numeric: tabular-nums;
      display: flex;
      flex-direction: column;
      gap: 2px;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .row .meta code,
    .row .path {
      font-family: var(--sw-font-mono, ui-monospace, 'SF Mono', Menlo, monospace);
      font-size: var(--sw-fs-xs);
      color: var(--dv-text-2);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .row .path {
      grid-column: 2;
      text-align: start;
    }
    .vars {
      grid-column: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-block-start: 4px;
    }
    .vars span {
      font-family: var(--sw-font-mono, ui-monospace, 'SF Mono', Menlo, monospace);
      font-size: var(--sw-fs-xs);
      padding: 2px 8px;
      border-radius: var(--sw-r-xs);
      background: var(--dv-surface-3);
      color: var(--dv-text);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .vars span b {
      font-weight: 700;
    }
    .row.nest {
      border-inline-start: 2px solid var(--dv-border);
    }
    .skip-note {
      padding: 10px 14px;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
    }
    .vlist {
      padding: 10px 14px;
    }
    .vlist .vars {
      grid-column: auto;
      margin: 0;
    }
  `];z([h({attribute:!1})],y.prototype,"trace",2);z([h()],y.prototype,"mode",2);z([h({attribute:!1})],y.prototype,"now",2);z([h()],y.prototype,"timeZone",2);y=z([N("run-trace")],y);function $e(e){return j(e).variables}var we=Object.defineProperty,xe=Object.getOwnPropertyDescriptor,S=(e,s,t,a)=>{for(var r=a>1?void 0:a?xe(s,t):s,d=e.length-1,o;d>=0;d--)(o=e[d])&&(r=(a?o(s,t,r):o(r))||r);return a&&r&&we(s,t,r),r};const A=(e,s,t)=>Math.min(t,Math.max(s,e));let $=class extends T{constructor(){super(...arguments),this.fields=[],this.values=null,this.entityChoices={},this.current={}}willUpdate(e){(e.has("fields")||e.has("values"))&&(this.current={...L(this.fields),...this.values??{}})}connectedCallback(){super.connectedCallback(),I(this)}set(e,s){this.current={...this.current,[e]:s},this.dispatchEvent(new CustomEvent("change",{detail:{values:{...this.current},valid:D(this.fields,this.current).length===0},bubbles:!0,composed:!0}))}num(e){const s=e.selector,t=s.step??1,a=typeof this.current[e.key]=="number"?this.current[e.key]:Number(s.min);return i`<div class="stepper" role="group" aria-label=${e.name}>
      <button type="button" aria-label="פחות" data-field-minus=${e.key} ?disabled=${a<=s.min} @click=${()=>this.set(e.key,A(Math.round((a-t)*1e3)/1e3,s.min,s.max))}>${n("minus")}</button>
      <input type="number" inputmode="decimal" min=${s.min} max=${s.max} step=${t} .value=${String(a)} aria-label=${e.name} data-field=${e.key} @change=${r=>{const d=Number(r.target.value);Number.isFinite(d)&&this.set(e.key,A(d,s.min,s.max))}} />
      ${s.unit?i`<small>${s.unit}</small>`:l}
      <button type="button" aria-label="יותר" data-field-plus=${e.key} ?disabled=${a>=s.max} @click=${()=>this.set(e.key,A(Math.round((a+t)*1e3)/1e3,s.min,s.max))}>${n("plus")}</button>
    </div>`}control(e){const s=e.selector,t=this.current[e.key];switch(s.kind){case"number":return this.num(e);case"boolean":return i`<button type="button" class="tog" role="switch" aria-checked=${String(t===!0)} aria-label=${e.name} data-field=${e.key} @click=${()=>this.set(e.key,t!==!0)}></button>`;case"select":return i`<select class="inp" aria-label=${e.name} data-field=${e.key} @change=${a=>this.set(e.key,a.target.value)}>${s.options.map(a=>i`<option value=${a} ?selected=${t===a}>${a}</option>`)}</select>`;case"text":return i`<input class="inp" type="text" maxlength=${s.max??200} .value=${typeof t=="string"?t:""} aria-label=${e.name} data-field=${e.key} @input=${a=>this.set(e.key,a.target.value)} />`;case"entity":{const a=this.entityChoices[e.key]??[],r=(Array.isArray(e.default)?e.default:e.default?[e.default]:[]).map(String),d=[...a,...r.filter(v=>!a.some(k=>k.value===v)).map(v=>({value:v,label:v.split(".").slice(1).join(".").replace(/_/g," ")}))],o=Array.isArray(t)?String(t[0]??""):String(t??"");return i`<select class="inp" aria-label=${e.name} data-field=${e.key} @change=${v=>{const k=v.target.value;this.set(e.key,Array.isArray(e.default)?[k]:k)}}>${d.map(v=>i`<option value=${v.value} ?selected=${o===v.value}>${v.label}</option>`)}</select>`}default:return l}}render(){const e=new Set(D(this.fields,this.current)),s=this.fields.filter(t=>t.selector.kind!=="locked");return s.length?i`<div class="form" data-script-form>${s.map(t=>i`<div class=${`f ${e.has(t.key)?"bad":""}`} data-field-row=${t.key}><span class="nm">${t.name}${t.required?" *":""}</span>${this.control(t)}</div>`)}</div>`:l}};$.styles=[...F,R`
    :host {
      display: block;
    }
    .form {
      display: flex;
      flex-direction: column;
      border-radius: var(--dv-radius-md);
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      padding: 4px 16px;
    }
    .f {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      min-block-size: 64px;
      border-block-end: 1px solid var(--dv-border);
      flex-wrap: wrap;
      padding-block: 8px;
    }
    .f:last-child {
      border-block-end: 0;
    }
    .f > .nm {
      font-size: var(--sw-fs-md);
      font-weight: 600;
    }
    .f > .nm small {
      display: block;
      font-size: var(--sw-fs-sm);
      font-weight: 500;
      color: var(--dv-text-2);
    }
    .f.bad .nm {
      color: var(--dv-danger);
    }
    .stepper {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      block-size: 44px;
      padding: 3px;
      border-radius: var(--dv-radius-control);
      background: var(--dv-surface-3);
    }
    .stepper button {
      inline-size: 38px;
      block-size: 38px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      display: grid;
      place-items: center;
      color: var(--dv-text);
    }
    .stepper button:hover {
      background: var(--mm-seg-thumb);
      box-shadow: var(--dv-shadow-control);
    }
    .stepper button[disabled] {
      opacity: 0.35;
      pointer-events: none;
    }
    .stepper input {
      inline-size: 54px;
      text-align: center;
      border: 0;
      background: transparent;
      font: inherit;
      font-weight: 700;
      font-size: var(--sw-fs-lg);
      color: var(--dv-text);
      font-variant-numeric: tabular-nums;
      -moz-appearance: textfield;
      appearance: textfield;
    }
    .stepper input:focus-visible {
      outline: 2px solid var(--dv-focus);
      border-radius: var(--sw-r-sm);
    }
    .stepper small {
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
      margin-inline-end: 4px;
    }
    .inp {
      min-inline-size: 150px;
      max-inline-size: 100%;
    }
  `];S([h({attribute:!1})],$.prototype,"fields",2);S([h({attribute:!1})],$.prototype,"values",2);S([h({attribute:!1})],$.prototype,"entityChoices",2);S([u()],$.prototype,"current",2);$=S([N("script-fields-form")],$);var M=Object.freeze,W=Object.defineProperty,ke=Object.getOwnPropertyDescriptor,p=(e,s,t,a)=>{for(var r=a>1?void 0:a?ke(s,t):s,d=e.length-1,o;d>=0;d--)(o=e[d])&&(r=(a?o(s,t,r):o(r))||r);return a&&r&&W(s,t,r),r},_e=(e,s)=>M(W(e,"raw",{value:M(e.slice())})),P;const ze={single:"התעלם",restart:"התחל מחדש",queued:"המתן בתור",parallel:"הרץ במקביל"},Se={conditions:"אם",if:"אם",then:"אז",else:"אחרת",default:"אחרת",sequence:"אז"};let c=class extends T{constructor(){super(...arguments),this.kind="automation",this.itemId="",this.open=!1,this.view="detail",this.runId="",this.trash=!1,this.status=null,this.now=new Date,this.phase="loading",this.item=null,this.errorText="",this.runs=null,this.trace=null,this.traceBusy=!1,this.traceError="",this.versions=null,this.action="",this.dry=null,this.dryBusy=!1,this.busy=!1,this.confirm=null,this.copyName="",this.restoring=null,this.conflict=null,this.values={},this.valid=!0,this.trashRows=null,this.choices={},this.loadedKey="",this.close=()=>this.fire("drawer-close")}connectedCallback(){super.connectedCallback(),I(this)}willUpdate(e){const s=`${this.open}|${this.trash}|${this.kind}|${this.itemId}`;this.open&&s!==this.loadedKey?(this.loadedKey=s,this.dry=null,this.conflict=null,this.confirm=null,this.runs=null,this.versions=null,this.trace=null,this.trash?this.loadTrash():this.itemId&&this.load()):!this.open&&this.loadedKey&&(this.loadedKey=""),this.open&&!this.trash&&(e.has("view")||e.has("runId"))&&this.item&&this.loadView()}async refresh(){if(this.trash)return this.loadTrash();this.itemId&&await this.load(!0)}async load(e=!1){e||(this.phase="loading",this.item=null);try{const s=await b().get(this.kind,this.itemId);if(this.item=s,this.phase="ready",this.errorText="",s.kind==="script"){const t=s.draft.fields;(!e||!Object.keys(this.values).length)&&(this.values=L(t)),this.valid=D(t,this.values).length===0,this.loadChoices(t.filter(a=>a.selector.kind==="entity").length>0)}this.loadRuns(),this.applyAction(),await this.loadView()}catch(s){const t=m(s);t.status===404?this.phase="missing":t.status===403?this.phase="forbidden":(this.phase="error",this.errorText=t.message)}}async loadChoices(e){if(e)try{const s=await b().catalog(),t={};for(const a of(this.item?.draft).fields){if(a.selector.kind!=="entity")continue;const r=a.selector.domains;t[a.key]=s.entities.filter(d=>!r.length||r.includes(d.domain)).map(d=>({value:d.entity_id,label:d.name}))}this.choices=t}catch{this.choices={}}}async loadRuns(){if(!(!this.item||this.item.kind==="scene"))try{this.runs=await b().runs(this.item.kind,this.item.id)}catch{this.runs=[]}}async loadView(){if(this.item){if(this.view==="dryrun"&&!this.dry&&!this.dryBusy&&this.dryRun(),this.view==="versions"&&!this.versions)try{this.versions=await b().versions(this.item.kind,this.item.id)}catch{this.versions=[]}if(this.view==="trace"){this.runs||await this.loadRuns();const e=this.runId||this.runs?.[0]?.run_id||"";if(!e){this.trace=null;return}if(this.trace?.run_id===e)return;this.traceBusy=!0,this.traceError="";try{this.trace=await b().runTrace(this.item.kind,this.item.id,e)}catch(s){this.traceError=m(s).message,this.trace=null}finally{this.traceBusy=!1}}}}async loadTrash(){this.phase="loading";try{this.trashRows=await b().trash(),this.phase="ready"}catch(e){this.errorText=m(e).message,this.phase="error"}}fire(e,s){this.isConnected&&this.dispatchEvent(new CustomEvent(e,{detail:s,bubbles:!0,composed:!0}))}say(e,s="ok",t){this.fire("result",{text:e,tone:s,action:t})}go(e,s=""){this.fire("view-change",{view:e,run:s})}failed(e){const s=m(e);return s.kind==="conflict"&&s.current&&(this.conflict=s.current),this.say(s.message,"error"),s}async run(e=!1){const s=this.item;if(!(!s||this.busy)){if(!e&&X(s)){this.confirm="run";return}this.confirm=null,this.busy=!0;try{s.kind==="script"?await Y(s.id,this.values,{confirm:e||void 0}):await J(s.id,{skip_condition:!0,confirm:e||void 0}),this.say(s.kind==="script"?"הסקריפט הופעל":"האוטומציה הורצה"),this.fire("changed",{id:s.id}),window.setTimeout(()=>void this.load(!0),250)}catch(t){m(t).kind==="confirm"&&!e?this.confirm="run":this.failed(t)}finally{this.busy=!1}}}async stop(){const e=this.item;if(!(!e||this.busy)){this.busy=!0;try{await Q(e.id),this.say("הסקריפט נעצר"),this.fire("changed",{id:e.id}),await this.load(!0)}catch(s){this.failed(s)}finally{this.busy=!1}}}async dryRun(){const e=this.item;if(!(!e||this.dryBusy)){this.dry=null,this.dryBusy=!0;try{this.dry=await b().dryRun(e.kind,e.id)}catch(s){this.say(m(s).message,"error"),this.go("detail")}finally{this.dryBusy=!1}}}applyAction(){const e=this.item,s=this.action;if(!e||!s)return;const t=le(s,e.can);t==="copy"&&(this.copyName=`${e.name} (עותק)`),t&&(this.confirm=t),this.fire("action-done")}async doDelete(){const e=this.item;if(!(!e||this.busy)){this.busy=!0;try{const s=await ee(e.kind,e.id,e.revision,{confirm:!0});this.confirm=null,this.fire("deleted",{trash_id:s.trash_id,name:e.name,kind:e.kind,id:e.id})}catch(s){this.confirm=null,this.failed(s)}finally{this.busy=!1}}}async doCopy(){const e=this.item,s=this.copyName.trim();if(!(!e||!s||this.busy)){this.busy=!0;try{const t=await se(e.kind,e.id,s);this.confirm=null,t.item?this.fire("copied",{item:t.item}):this.say("נשמר","ok")}catch(t){this.confirm=null,this.failed(t)}finally{this.busy=!1}}}async doRestore(){const e=this.item,s=this.restoring;if(!(!e||!s||this.busy)){this.busy=!0;try{await b().restoreVersion(e.kind,e.id,s.version_id,{base_revision:e.revision,client_request_id:te()}),this.confirm=null,this.restoring=null,this.versions=null,this.say("הגרסה שוחזרה"),this.fire("changed",{id:e.id}),await this.load(!0),await this.loadView()}catch(t){this.confirm=null,this.failed(t)}finally{this.busy=!1}}}async restoreFromTrash(e){if(!this.busy){this.busy=!0;try{const s=await b().restoreTrash(e.trash_id,{client_request_id:`restore-${e.trash_id}-${Date.now()}`});this.say(`"${e.name}" שוחזר`),this.fire("changed",{id:s.item?.id??e.config_id}),this.trashRows=(this.trashRows??[]).filter(t=>t.trash_id!==e.trash_id)}catch(s){this.say(m(s).message,"error")}finally{this.busy=!1}}}async purge(e){if(!this.busy){this.busy=!0;try{await b().purgeTrash(e.trash_id),this.trashRows=(this.trashRows??[]).filter(s=>s.trash_id!==e.trash_id),this.say(`"${e.name}" נמחק לצמיתות`)}catch(s){this.say(m(s).message,"error")}finally{this.busy=!1}}}blockRow(e,s=!1,t=""){const a=e.kind==="locked",r=a&&ae(e);return i`<div class=${`blk${a?" locked":""}${s?" nested":""}`} data-block=${e.uid} data-block-kind=${e.kind}>
      <span class="bi">${n(de(e))}</span>
      <span class="bt">${t?i`<small>${t}</small>`:l}${f(a?`${e.label}${e.sentence&&e.sentence!==e.label?` · ${e.sentence}`:""}`:e.sentence)}</span>
      ${r?i`<span class="chip warn" data-chip="schedules">${n("calendar")}שולט בתזמונים</span>`:l}
      ${a&&e.sensitive?i`<span class="chip sens">${n("shield")}רגישה</span>`:l}
    </div>`}nestedRows(e,s=0){if(s>=2)return[];const t=[];for(const a of ie(e)){const r=a.name.split(".").pop()??a.name;a.blocks.forEach((d,o)=>{t.push(this.blockRow(d,!0,o===0?Se[r]??"":"")),t.push(...this.nestedRows(d,s+1))})}return t}section(e,s,t,a){return a.length?i`<section class="sect" data-section=${e}>
      <h4><span class=${`tag t${e}`}>${n(t)}</span>${s} <span class="num">${a.length}</span></h4>
      ${a.map(r=>i`${this.blockRow(r)}${this.nestedRows(r)}`)}
    </section>`:l}banners(e){const s=[],t=re(e);if(this.conflict&&s.push(i`<div class="banner warn" role="alert" data-drawer-conflict>${n("warning")}<div><b>הפריט שונה במקום אחר</b><small>טענו את הגרסה העדכנית והחליטו מה לשמור.</small></div><button type="button" class="btn sm" data-conflict-reload @click=${()=>{this.conflict=null,this.load(!0)}}>טען מחדש</button></div>`),t){const a=t.code==="yaml_managed"||t.code==="no_config_id";s.push(i`<div class=${`banner ${a?"warn":"info"}`} data-drawer-readonly=${t.code}>${n(a?"eye":t.code==="delegation_off"?"lock":"eye")}<div><b>${a?"מוגדרת בקובץ תצורה":t.text}</b>${a?i`<small>לצפייה בלבד. עריכה: בתשתית המערכת.</small>`:l}</div></div>`)}return e.state==="invalid"&&s.push(i`<div class="banner bad" data-drawer-invalid>${n("warning")}<div><b>לא פעילה – שגיאה בהגדרה</b>${e.warnings.find(a=>a.code==="invalid_config")?.message?i`<small>${e.warnings.find(a=>a.code==="invalid_config").message}</small>`:l}</div></div>`),e.warnings.some(a=>a.code==="changed_outside")&&s.push(i`<div class="banner info" data-drawer-outside>${n("history")}<div><b>שונתה מחוץ למערכת</b></div><button type="button" class="btn sm" @click=${()=>this.go("versions")}>גרסאות</button></div>`),i`${s}`}detail(e){const s=e.kind==="script",t=e.draft,a=ne(e.draft).length,r=ce(e,{sensitiveWarning:this.status?.ui.sensitive_warning!==!1}),d=e.targets.filter((o,v,k)=>k.findIndex(Z=>Z.entity_id===o.entity_id)===v);return i`<div class="stack" data-drawer-detail>
      ${this.banners(e)}
      ${e.sentence?i`<div class="sentence" data-drawer-sentence>${n("bolt")}<div>${e.sentence}${e.description?i`<small>${e.description}</small>`:l}</div></div>`:l}
      ${r.length||e.mode?i`<div class="chips">${e.mode?i`<span class="chip" data-chip="mode">${ze[e.mode]}</span>`:l}${r.filter(o=>o.id!=="read_only").map(o=>i`<span class=${`chip ${o.id==="sensitive"?"sens":o.tone==="bad"?"bad":o.tone==="warn"?"warn":""}`} data-chip=${o.id}>${n(o.id==="sensitive"?"shield":o.id==="locked"?"lock":"warning")}${o.label}</span>`)}</div>`:l}
      ${s&&t.fields?.some(o=>o.selector.kind!=="locked")?i(P||(P=_e(["<script-fields-form .fields="," .values="," .entityChoices="," @change=","><\/script-fields-form>"])),t.fields,this.values,this.choices,o=>{this.values=o.detail.values,this.valid=o.detail.valid}):l}
      ${s?this.section(3,"אז","play",t.sequence??[]):i`${this.section(1,"כאשר","bolt",t.triggers??[])}${this.section(2,"אם","help",t.conditions??[])}${this.section(3,"אז","play",t.actions??[])}`}
      ${a?l:i`<div class="empty-note">אין פירוט להצגה</div>`}
      ${d.length?i`<section class="sect" data-section="devices"><h4>${n("layers")}מכשירים מושפעים <span class="num">${d.length}</span></h4>${d.map(o=>i`<div class="dev" data-target=${o.entity_id}><span class="bi">${n(pe(o.entity_id))}</span><span class="bt">${f(o.name)}<small>${f([o.floor,o.area].filter(Boolean).join(" · "))}</small></span>${o.missing?i`<span class="chip bad">${n("warning")}חסר</span>`:o.sensitive?i`<span class="chip sens">${n("shield")}רגישה</span>`:l}</div>`)}</section>`:l}
      ${this.runs&&this.runs.length?i`<section class="sect" data-section="runs"><h4>${n("history")}ריצות אחרונות <span class="num">${e.runs_7d??this.runs.length}</span></h4>
        ${E(this.runs.slice(0,3),this.now).map(o=>i`<button type="button" class="run" data-run-row=${o.run_id} @click=${()=>this.go("trace",o.run_id)}><i class=${`dot ${o.tone==="none"?"":o.tone}`}></i><span class="t">${o.label}</span><span class="s">${o.sentence}</span>${n("chevronBack")}</button>`)}</section>`:l}
    </div>`}traceView(e){const s=E(this.runs??[],this.now),t=this.runId||s[0]?.run_id||"";return i`<div class="stack" data-drawer-trace>
      ${s.length?i`<div class="runchips" role="group" aria-label="ריצות">${s.map(a=>i`<button type="button" class="rc" aria-pressed=${String(a.run_id===t)} data-run-chip=${a.run_id} @click=${()=>this.go("trace",a.run_id)}>${a.label}<i class=${`dot ${a.tone==="none"?"":a.tone}`}></i></button>`)}</div>`:i`<div class="empty-note" data-trace-empty>אין ריצות להצגה</div>`}
      ${this.traceBusy?i`<div class="skl-stack"><span class="skl" style="block-size:70px"></span><span class="skl" style="block-size:120px"></span><span class="skl" style="block-size:200px"></span></div>`:l}
      ${this.traceError?i`<div class="banner bad" role="alert">${n("warning")}${this.traceError}</div>`:l}
      ${this.trace&&!this.traceBusy?i`<run-trace .trace=${this.trace} .mode=${e.mode} .now=${this.now}></run-trace>`:l}
    </div>`}versionsView(e){if(!this.versions)return i`<div class="skl-stack"><span class="skl" style="block-size:84px"></span><span class="skl" style="block-size:84px"></span></div>`;const s=e.can.edit;return i`<div class="stack" data-drawer-versions>${this.versions.map(t=>i`<div class=${`ver${t.current?" cur":""}`} data-version=${t.version_id}>
      <div class="vh"><span>${t.version_id}${t.current?" · נוכחית":""}</span>${t.via==="external"?i`<span class="chip warn">${n("history")}מחוץ למערכת</span>`:l}</div>
      <div class="vs">${t.summary}</div>
      <div class="vm">${U(t.at,this.now)}${t.actor?` · ${t.actor}`:""}</div>
      ${!t.current&&s?i`<button type="button" class="btn sm" data-version-restore=${t.version_id} @click=${()=>{this.restoring=t,this.confirm="restore"}}>${n("restore")}שחזר</button>`:l}
    </div>`)}</div>`}dryView(){if(this.dryBusy||!this.dry)return i`<div class="skl-stack"><span class="skl" style="block-size:60px"></span><span class="skl" style="block-size:60px"></span></div>`;const e=this.dry;return i`<div class="stack" data-drawer-dryrun>
      <section class="sect"><h4>${n("help")}תנאים <span class="num">${e.conditions.length}</span></h4>
        ${e.conditions.length?e.conditions.map(s=>i`<div class="dry-row"><span class=${`st ${s.passed===!0?"ok":s.passed===!1?"bad":""}`}>${n(s.passed===!0?"check":s.passed===!1?"close":"minus")}</span><span>${f(s.sentence)}</span>${s.passed===null?i`<span class="arrow">לא ניתן לבדוק</span>`:l}</div>`):i`<div class="empty-note">אין תנאים</div>`}</section>
      <section class="sect"><h4>${n("layers")}מה ישתנה <span class="num">${e.effects.entities.length}</span></h4>
        ${e.effects.entities.length?e.effects.entities.map(s=>i`<div class="dry-row"><span class="bt">${f(s.name)}</span><span class="arrow">${s.from??"—"} ← ${s.to??"—"}</span></div>`):i`<div class="empty-note">אין שינוי במכשירים</div>`}
        ${e.effects.unknown?i`<div class="banner info">${n("info")}יש פעולה מתקדמת שהשפעתה אינה ידועה</div>`:l}</section>
    </div>`}trashView(){return this.phase==="error"?i`<div class="center" data-drawer-state="error">${n("warning",30)}<b>${this.errorText}</b><button type="button" class="btn sm" @click=${()=>void this.loadTrash()}>${n("refresh")}נסו שוב</button></div>`:this.trashRows===null||this.phase==="loading"?i`<div class="skl-stack"><span class="skl" style="block-size:84px"></span><span class="skl" style="block-size:84px"></span></div>`:this.trashRows.length?i`<div class="stack" data-drawer-trash>${this.trashRows.map(e=>{const s=ue(e.expires_at,this.now);return i`<div class="tr" data-trash=${e.trash_id}>
        <span class="bi">${n(e.kind==="script"?"script":e.kind==="scene"?"sparkle":"bolt")}</span>
        <b>${f(e.name)} ${e.sensitive?i`<span class="chip sens">${n("shield")}רגישה</span>`:l}</b>
        <small>${e.sentence}</small>
        <small>${he(e.deleted_at,this.now)}${e.deleted_by?` · ${e.deleted_by}`:""} · <span class=${s.urgent?"urgent":""}>${s.text}</span></small>
        <span class="trbtns">${e.can_restore?i`<button type="button" class="btn sm" data-trash-restore=${e.trash_id} ?disabled=${this.busy} @click=${()=>void this.restoreFromTrash(e)}>${n("restore")}שחזר</button>`:l}${this.status?.can.manage&&this.status?.can.configure?i`<button type="button" class="btn sm quiet dz" data-trash-purge=${e.trash_id} aria-label=${`מחיקה לצמיתות · ${e.name}`} ?disabled=${this.busy} @click=${()=>void this.purge(e)}>${n("trash")}</button>`:l}</span>
      </div>`})}</div>`:i`<div class="center" data-drawer-state="trash-empty">${n("trash",30)}<b>סל המחזור ריק</b></div>`}stateBox(){return this.phase==="loading"?i`<div class="skl-stack" data-drawer-state="loading" aria-busy="true"><span class="skl" style="block-size:96px"></span><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:52px"></span></div>`:this.phase==="missing"?i`<div class="center" data-drawer-state="missing">${n("search",30)}<b>הפריט לא נמצא</b></div>`:this.phase==="forbidden"?i`<div class="center" data-drawer-state="forbidden">${n("lock",30)}<b>אין הרשאה</b></div>`:this.phase==="error"?i`<div class="center" data-drawer-state="error">${n("warning",30)}<b>${this.errorText||"לא ניתן לטעון"}</b><button type="button" class="btn sm" @click=${()=>void this.load()}>${n("refresh")}נסו שוב</button></div>`:null}footer(e){const s=this.view;if(s==="trace")return i`<div class="foot2" slot="footer"><button type="button" class="btn" @click=${this.close}>סגירה</button>${e.can.run?i`<button type="button" class="btn" data-drawer-run ?disabled=${this.busy} @click=${()=>void this.run()}>${n("play")}הרץ שוב</button>`:l}<button type="button" class="btn" data-drawer-back-detail @click=${()=>this.go("detail")}>${n("eye")}לאוטומציה</button></div>`;if(s==="versions"||s==="dryrun")return i`<div class="foot2" slot="footer"><button type="button" class="btn" @click=${()=>this.go("detail")}>סגירה</button></div>`;const t=e.state==="running",a=e.kind==="script",r=e.can.edit?i`<button type="button" class=${`btn${a?"":" primary"}`} data-drawer-edit @click=${()=>this.fire("edit",{kind:e.kind,id:e.id})}>${n("edit")}עריכה</button>`:l,d=t&&a?i`<button type="button" class="btn danger" data-drawer-stop ?disabled=${this.busy} @click=${()=>void this.stop()}>${n("stop")}עצור</button>`:e.can.run?i`<button type="button" class=${`btn${a?" primary":""}`} data-drawer-run ?disabled=${this.busy||a&&!this.valid} @click=${()=>void this.run()}>${n("play")}${a?"הפעל":"הרץ עכשיו"}</button>`:l;return i`<div class="foot2" slot="footer">
      ${a?i`${d}${r}`:i`${r}${d}`}
      ${a?l:i`<button type="button" class="btn" data-drawer-dry @click=${()=>this.go("dryrun")}>${n("flask")}בדיקה</button>`}
      ${e.last_run&&!a?i`<button type="button" class="btn" data-drawer-why @click=${()=>this.go("trace")}>${n("help")}למה זה רץ</button>`:l}
      ${e.source==="ui"?i`<button type="button" class="btn quiet" data-drawer-versions @click=${()=>this.go("versions")}>${n("history")}גרסאות</button>`:l}
      ${e.can.copy?i`<button type="button" class="btn quiet" data-drawer-copy @click=${()=>{this.copyName=`${e.name} (עותק)`,this.confirm="copy"}}>${n("copy")}שכפול</button>`:l}
      ${e.can.delete?i`<button type="button" class="btn quiet dz" data-drawer-delete @click=${()=>this.confirm="delete"}>${n("trash")}מחיקה</button>`:l}
    </div>`}dialogs(e){const s=this.confirm;if(!s||!e)return l;if(s==="run"){const t=ve(e);return i`<sw-dialog open heading=${e.kind==="script"?"להפעיל עכשיו?":"להריץ עכשיו?"} data-dialog="run" @close=${()=>this.confirm=null}>
        <div class="dlgform">${t?i`<p>${t}</p>`:l}<div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>ביטול</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.run(!0)}>${e.kind==="script"?"הפעל":"הרץ"}</button></div></div></sw-dialog>`}return s==="delete"?i`<sw-dialog open heading=${`למחוק את "${e.name}"?`} data-dialog="delete" @close=${()=>this.confirm=null}>
        <div class="dlgform"><p>הפריט יישמר בסל המחזור וניתן לשחזר אותו.</p><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>ביטול</button><button type="button" class="btn danger" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.doDelete()}>מחיקה</button></div></div></sw-dialog>`:s==="copy"?i`<sw-dialog open heading="שכפול" data-dialog="copy" @close=${()=>this.confirm=null}>
        <div class="dlgform"><label class="fld">שם<input class="inp" type="text" maxlength="120" .value=${this.copyName} data-copy-name @input=${t=>this.copyName=t.target.value} /></label><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>ביטול</button><button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy||!this.copyName.trim()} @click=${()=>void this.doCopy()}>שכפול</button></div></div></sw-dialog>`:i`<sw-dialog open heading=${`לשחזר את ${this.restoring?.version_id??""}?`} data-dialog="restore" @close=${()=>this.confirm=null}>
      <div class="dlgform"><p>${this.restoring?.summary??""}</p><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>ביטול</button><button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.doRestore()}>שחזר</button></div></div></sw-dialog>`}render(){if(this.trash)return i`<sw-drawer modal .open=${this.open} heading="סל המחזור" @close=${this.close}>${this.trashView()}<div class="foot2" slot="footer"><button type="button" class="btn" @click=${this.close}>סגירה</button></div></sw-drawer>`;const e=this.item,s=this.view,t=e?s==="trace"?"למה זה רץ":s==="versions"?"גרסאות":s==="dryrun"?"בדיקה":f(e.name):"",a=e?s==="detail"?[fe(e),be(e)].filter(Boolean).join(" · "):f(e.name):"",r=this.stateBox();return i`<sw-drawer modal .open=${this.open} heading=${t} subheading=${a} @close=${this.close}>
      ${s!=="detail"&&e?i`<button slot="action" type="button" class="rb sm" aria-label="חזרה" data-drawer-back @click=${()=>this.go("detail")}>${n("chevron")}</button>`:l}
      ${r??(e?s==="trace"?this.traceView(e):s==="versions"?this.versionsView(e):s==="dryrun"?this.dryView():this.detail(e):l)}
      ${e&&!r?this.footer(e):l}
      ${this.dialogs(e)}
    </sw-drawer>`}};c.styles=[...F,R`
    :host {
      display: contents;
    }
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .desc {
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
    }
    .blk .chip.warn {
      flex: none;
    }
    /* R5-DEVICES-297: device rows and run rows are wells (no outline); the run's time is bold; a run row sinks on pointer-down */
    .dev {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 54px;
      padding: 8px 14px;
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      border: 1px solid transparent;
    }
    .dev .bi {
      display: grid;
      place-items: center;
      inline-size: 34px;
      block-size: 34px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      flex: none;
    }
    .dev .bi .ic {
      font-size: var(--sw-fs-lg);
    }
    .dev .bt {
      flex: 1;
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      font-weight: 600;
    }
    .dev .bt small {
      display: block;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: 500;
    }
    .run {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 48px;
      padding: 8px 14px;
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      border: 1px solid transparent;
      color: inherit;
      text-align: start;
      inline-size: 100%;
      box-sizing: border-box;
      font-size: var(--sw-fs-base);
      transition: background-color var(--sw-t-fast, 120ms) var(--sw-ease, ease-out), transform var(--sw-t-fast, 120ms) var(--sw-ease, ease-out);
    }
    a.run,
    button.run {
      cursor: pointer;
      text-decoration: none;
    }
    @media (hover: hover) and (pointer: fine) {
      a.run:hover,
      button.run:hover {
        background: var(--dv-surface-3);
      }
    }
    a.run:active,
    button.run:active {
      transform: scale(var(--sw-press-scale, 1));
      background: var(--sw-pressed-wash, var(--dv-surface-3));
    }
    .run .t {
      font-weight: 800;
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--dv-text));
      font-variant-numeric: tabular-nums;
      flex: none;
    }
    .run .s {
      flex: 1;
      min-inline-size: 0;
      color: var(--dv-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .runchips {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
      padding-block-end: 2px;
    }
    .runchips::-webkit-scrollbar {
      display: none;
    }
    .rc {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      block-size: 38px;
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      font-size: var(--sw-fs-base);
      font-weight: 600;
      color: var(--dv-text);
    }
    .rc[aria-pressed='true'] {
      background: var(--dv-text);
      color: var(--mm-text-inverse);
      border-color: transparent;
    }
    .ver {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 10px;
      align-items: center;
      padding: 12px 14px;
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      border: 1px solid transparent;
    }
    .ver.cur {
      background: var(--dv-accent-soft);
      border-color: color-mix(in srgb, var(--dv-accent) 45%, transparent);
    }
    .ver .vh {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: var(--sw-fs-md);
      flex-wrap: wrap;
    }
    .ver .vs {
      grid-column: 1;
      font-size: var(--sw-fs-base);
    }
    .ver .vm {
      grid-column: 1;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .ver .btn {
      grid-column: 2;
      grid-row: 1 / span 3;
    }
    .tr {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      gap: 4px 12px;
      align-items: center;
      padding: 12px 14px;
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      border: 1px solid transparent;
    }
    .tr .bi {
      grid-row: 1 / span 3;
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
    }
    .tr .bi .ic {
      font-size: var(--sw-fs-xl);
    }
    .tr b {
      font-size: var(--sw-fs-md);
    }
    .tr small {
      grid-column: 2;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .tr .urgent {
      color: var(--dv-danger);
    }
    .tr .trbtns {
      grid-column: 3;
      grid-row: 1 / span 3;
      display: flex;
      gap: 6px;
    }
    .dry-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      border: 1px solid transparent;
      font-size: var(--sw-fs-md);
      font-weight: 600;
    }
    .dry-row .st {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      flex: none;
    }
    .dry-row .st.ok {
      background: var(--dv-success-soft);
      color: var(--au-ok-text);
    }
    .dry-row .st.bad {
      background: var(--dv-danger-soft);
      color: var(--dv-danger);
    }
    .dry-row .st .ic {
      font-size: var(--sw-fs-lg);
    }
    .dry-row .arrow {
      margin-inline-start: auto;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-base);
    }
    .skl-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .center {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 10px;
      padding: 30px 10px;
    }
    .center b {
      font-size: var(--sw-fs-lg);
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgform p {
      margin: 0;
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
    }
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .foot2 {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `];p([h()],c.prototype,"kind",2);p([h()],c.prototype,"itemId",2);p([h({type:Boolean})],c.prototype,"open",2);p([h()],c.prototype,"view",2);p([h()],c.prototype,"runId",2);p([h({type:Boolean})],c.prototype,"trash",2);p([h({attribute:!1})],c.prototype,"status",2);p([h({attribute:!1})],c.prototype,"now",2);p([u()],c.prototype,"phase",2);p([u()],c.prototype,"item",2);p([u()],c.prototype,"errorText",2);p([u()],c.prototype,"runs",2);p([u()],c.prototype,"trace",2);p([u()],c.prototype,"traceBusy",2);p([u()],c.prototype,"traceError",2);p([u()],c.prototype,"versions",2);p([h()],c.prototype,"action",2);p([u()],c.prototype,"dry",2);p([u()],c.prototype,"dryBusy",2);p([u()],c.prototype,"busy",2);p([u()],c.prototype,"confirm",2);p([u()],c.prototype,"copyName",2);p([u()],c.prototype,"restoring",2);p([u()],c.prototype,"conflict",2);p([u()],c.prototype,"values",2);p([u()],c.prototype,"valid",2);p([u()],c.prototype,"trashRows",2);p([u()],c.prototype,"choices",2);c=p([N("automation-drawer")],c);const H={tab:"תרחישים",title:"תרחישים חוצי מודולים",new:"תרחיש חדש",empty:"אין עדיין תרחישים",disabled:"התרחישים כבויים",noPermission:"אין הרשאה לצפות בתרחישים",loadError:"לא ניתן לטעון את התרחישים",retry:"נסו שוב",settingsLink:"הגדרות התרחישים",killOn:"עצירת חירום פעילה: אף פעולה לא מתבצעת",stateOff:"כבוי",stateOk:"פעיל",stateActive:"הופעל",stateDegraded:"פגום",stateSuppressed:"נעצר",firesToday:"{n} הפעלות היום",lastFire:"הופעל לאחרונה {t}",never:"עוד לא הופעל",owner:"כותב: {n}",page:"עמוד {a} מתוך {b}",prev:"הקודם",next:"הבא",name:"שם",description:"תיאור",when:"כאשר",then:"אז",and:"וגם",or:"או",not:"לא",addCondition:"תנאי",addGroup:"קבוצה",remove:"הסרה",signal:"אות",subject:"נושא",value:"ערך",holdFor:"רציף (שנ׳)",debounce:"יציבות (שנ׳)",margin:"שוליים לשחרור",days:"ימים",from:"מ",to:"עד",dayNames:"ב,ג,ד,ה,ו,ש,א",actNotify:"הודעה",actTicket:"בקשת שירות",actFlag:"סימון",recipientsRoles:"תפקידים",recipientsUsers:"משתמשים",recipientsDefault:"ריק = הנמענים שבהגדרות",recipientsPick:"בחירת נמענים",search:"חיפוש",departmentPick:"בחירת מחלקה",department:"מחלקה",ticketTitle:"כותרת הבקשה",flagName:"שם הסימון",flagValue:"ערך",options:"אפשרויות",cooldown:"המתנה בין הפעלות (שנ׳)",clearAfter:"סיום אחרי (שנ׳)",forS:"משך מינימלי של כל התנאים (שנ׳)",onUnknown:"כשחיישן לא מדווח",onUnknownHold:"להמתין ואז לסמן פגום",onUnknownFalse:"להתייחס כ״לא מתקיים״",grace:"זמן המתנה (שנ׳)",maxFires:"מקסימום הפעלות ביום (ריק = ברירת המחדל)",maxTickets:"מקסימום בקשות ביום (ריק = ברירת המחדל)",test:"הרצה יבשה",simulate:"הדמיה",simulateHint:"ערך לבדיקה",save:"שמירה",cancel:"ביטול",enable:"הפעלה",disable:"כיבוי",delete:"מחיקה",confirmDelete:"למחוק את התרחיש?",enableConfirm:"התרחיש פותח בקשות שירות. לאשר את המחלקה ואת מגבלת {n} בקשות ביום?",confirm:"אישור",testFirst:"יש להריץ הרצה יבשה לפני ההפעלה",wouldFire:"היה מופעל עכשיו",wouldNot:"לא היה מופעל עכשיו",unknownResult:"לא ניתן להעריך עכשיו (חיישן לא מדווח)",actionOff:"הפעולה כבויה בהגדרות",ticketsOff:"מודול בקשות השירות כבוי",runs:"היסטוריה",noRuns:"אין עדיין הרצות",redacted:"אין הרשאה להצגת הנתון",saved:"נשמר",enabled:"התרחיש הופעל",disabledNote:"התרחיש כובה",deleted:"התרחיש נמחק",conflict:"התרחיש השתנה בינתיים. רעננו ונסו שוב.",hintHaOnly:"כלל שמבוסס רק על התקנים מתאים לאוטומציה רגילה או לתבנית.",doorWall:"תרחיש אינו מפעיל דלתות, מנעולים, אזעקות או התקנים.",tru:"מתקיים",fls:"לא מתקיים",unk:"לא ידוע",setTitle:"תרחישים חוצי מודולים",setEnabled:"הפעלת התרחישים",setKill:"עצירת חירום של כל הפעולות",setActNotify:"פעולת הודעה",setActTicket:"פעולת בקשת שירות",setActFlag:"פעולת סימון",setMaxFires:"הפעלות ביום לכל תרחיש (ברירת מחדל)",setMaxTickets:"בקשות שירות ביום לכל תרחיש (ברירת מחדל)",setMaxHour:"פעולות לשעה בכל המערכת",setMaxRules:"מספר תרחישים מרבי",setTick:"בדיקה כל (שנ׳)",setTestPerMin:"הרצות יבשות לדקה",setKeep:"שמירת היסטוריה (ימים)",setDegraded:"הודעה כשתרחיש לא ניתן להעריך",setAfterSource:"מקור שעות הפעילות",setAfterWindow:"חלון קבוע",setAfterCalendar:"לוח העבודה של בקשות השירות",setWindow:"שעות פעילות",setRecipients:"נמענים כברירת מחדל",setSave:"שמירת ההגדרות",setSaved:"ההגדרות נשמרו",setInvalid:"ערך לא תקין"},Ce={tab:"Scenarios",title:"Cross-module scenarios",new:"New scenario",empty:"No scenarios yet",disabled:"Scenarios are off",noPermission:"No permission to view scenarios",loadError:"Could not load the scenarios",retry:"Try again",settingsLink:"Scenario settings",killOn:"Emergency stop is on: no action runs",stateOff:"Off",stateOk:"On",stateActive:"Fired",stateDegraded:"Defective",stateSuppressed:"Stopped",firesToday:"{n} fires today",lastFire:"Last fired {t}",never:"Never fired",owner:"Author: {n}",page:"Page {a} of {b}",prev:"Previous",next:"Next",name:"Name",description:"Description",when:"When",then:"Then",and:"and",or:"or",not:"not",addCondition:"Condition",addGroup:"Group",remove:"Remove",signal:"Signal",subject:"Subject",value:"Value",holdFor:"Continuous (s)",debounce:"Stable for (s)",margin:"Release margin",days:"Days",from:"From",to:"To",dayNames:"Mon,Tue,Wed,Thu,Fri,Sat,Sun",actNotify:"Notification",actTicket:"Service request",actFlag:"Flag",recipientsRoles:"Roles",recipientsUsers:"Users",recipientsDefault:"Empty = the recipients in Settings",recipientsPick:"Choose recipients",search:"Search",departmentPick:"Choose a department",department:"Department",ticketTitle:"Request title",flagName:"Flag name",flagValue:"Value",options:"Options",cooldown:"Wait between fires (s)",clearAfter:"Clear after (s)",forS:"All conditions for at least (s)",onUnknown:"When a sensor does not report",onUnknownHold:"Wait, then mark defective",onUnknownFalse:"Treat as not met",grace:"Wait (s)",maxFires:"Max fires per day (empty = default)",maxTickets:"Max requests per day (empty = default)",test:"Dry run",simulate:"Simulate",simulateHint:"Test value",save:"Save",cancel:"Cancel",enable:"Enable",disable:"Disable",delete:"Delete",confirmDelete:"Delete the scenario?",enableConfirm:"This scenario opens service requests. Confirm the department and the cap of {n} requests per day?",confirm:"Confirm",testFirst:"Run a dry run before enabling",wouldFire:"Would fire now",wouldNot:"Would not fire now",unknownResult:"Cannot be evaluated now (a sensor is not reporting)",actionOff:"This action is off in Settings",ticketsOff:"The service module is off",runs:"History",noRuns:"No runs yet",redacted:"No permission to show this value",saved:"Saved",enabled:"Scenario enabled",disabledNote:"Scenario disabled",deleted:"Scenario deleted",conflict:"The scenario changed meanwhile. Refresh and try again.",hintHaOnly:"A rule on devices only fits an ordinary automation or a template.",doorWall:"A scenario never operates doors, locks, alarms or devices.",tru:"Met",fls:"Not met",unk:"Unknown",setTitle:"Cross-module scenarios",setEnabled:"Scenarios on",setKill:"Emergency stop of every action",setActNotify:"Notification action",setActTicket:"Service request action",setActFlag:"Flag action",setMaxFires:"Fires per day per scenario (default)",setMaxTickets:"Service requests per day per scenario (default)",setMaxHour:"Actions per hour, whole system",setMaxRules:"Maximum scenarios",setTick:"Check every (s)",setTestPerMin:"Dry runs per minute",setKeep:"Keep history (days)",setDegraded:"Notice when a scenario cannot be evaluated",setAfterSource:"Working hours source",setAfterWindow:"Fixed window",setAfterCalendar:"The service module work calendar",setWindow:"Working hours",setRecipients:"Default recipients",setSave:"Save settings",setSaved:"Settings saved",setInvalid:"Invalid value"};function Re(){return(typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"").startsWith("en")?"en":"he"}const Te={he:H,en:Ce};function g(e,s,t=Re()){const a=Te[t][e]??H[e]??e;return s?a.replace(/\{(\w+)\}/g,(r,d)=>d in s?String(s[d]):r):a}const Ee=()=>x("scenarios/status"),Me=()=>x("scenarios/signals"),Pe=()=>x("scenarios"),qe=e=>x(`scenarios/${encodeURIComponent(e)}`),Be=(e,s,t)=>_("scenarios",{name:e,description:s,definition:t}),je=(e,s,t,a,r)=>V(`scenarios/${encodeURIComponent(e)}`,{version:s,name:t,description:a,definition:r}),Ve=e=>oe(`scenarios/${encodeURIComponent(e)}`),Ue=(e,s,t=!1)=>_(`scenarios/${encodeURIComponent(e)}/enable`,{version:s,confirm:t}),Le=(e,s)=>_(`scenarios/${encodeURIComponent(e)}/disable`,{version:s}),We=(e,s)=>_(`scenarios/${encodeURIComponent(e)}/test`,{overrides:s??null}),He=(e,s)=>_("scenarios/simulate",{definition:e,overrides:s??null}),Ke=e=>x(`scenarios/${encodeURIComponent(e)}/runs`),Ge=()=>x("scenarios/choices"),Ze=()=>x("scenarios/settings"),Xe=e=>V("scenarios/settings",{changes:e,confirmed:!0}),K=e=>"op"in e&&(e.op==="and"||e.op==="or"),G=e=>"op"in e&&e.op==="not",Ye=e=>"redacted"in e,Ne=e=>"signal"in e;function O(e,s="when"){return K(e)?e.items.flatMap((t,a)=>O(t,`${s}.items[${a}]`)):G(e)?O(e.item,`${s}.item`):Ne(e)?[{path:s,leaf:e}]:[]}function Ae(e){return e==="bool"?["is_true","is_false"]:e==="enum"?["eq","ne","in_set"]:e==="count"?["gt","ge","lt","le","eq","ne"]:["gt","ge","lt","le","between","outside"]}function Je(e){const s={signal:e.id,cmp:Ae(e.kind)[0]};return e.subject==="window"?s.window={days:[0,1,2,3,4,5,6],from:"18:00",to:"07:00"}:e.subject!=="none"&&(s.subject=e.subjects[0]?.id??""),e.kind==="number"&&(s.value=e.range?Math.min(Math.max(8,e.range[0]),e.range[1]):0),e.kind==="count"&&(s.value=1),s}function Qe(e,s){const t=[];let a=0;const r=(d,o)=>{a=Math.max(a,o),K(d)?(d.items.length||t.push("empty_group"),d.items.forEach(v=>r(v,o+1))):G(d)&&r(d.item,o+1)};return r(e.when,0),a>s.depth&&t.push("too_deep"),O(e.when).length>s.leaves&&t.push("too_many_leaves"),e.actions.length||t.push("no_actions"),e.actions.length>s.actions&&t.push("too_many_actions"),t}const es=e=>e==="active"?"warn":e==="degraded"||e==="suppressed"?"bad":e==="ok"?"ok":"off";function q(e,s,t){return t?e.includes(s)?[...e]:[...e,s]:e.filter(a=>a!==s)}function B(e,s,t=40){const a=s.trim().toLowerCase();return(a?e.filter(r=>r.name.toLowerCase().includes(a)):[...e]).slice(0,t)}var De=Object.defineProperty,Oe=Object.getOwnPropertyDescriptor,C=(e,s,t,a)=>{for(var r=a>1?void 0:a?Oe(s,t):s,d=e.length-1,o;d>=0;d--)(o=e[d])&&(r=(a?o(s,t,r):o(r))||r);return a&&r&&De(s,t,r),r};let w=class extends T{constructor(){super(...arguments),this.choices=null,this.value={users:[],roles:[]},this.open=!1,this.q=""}emit(e){this.value=e,this.dispatchEvent(new CustomEvent("change",{detail:{value:e},bubbles:!0,composed:!0}))}nameOf(e,s){return this.choices?.[e].find(t=>t.id===s)?.name??s}render(){const e={users:this.value.users??[],roles:this.value.roles??[]},s=[...e.roles.map(t=>["roles",t]),...e.users.map(t=>["users",t])];return i`<div class="box" data-recipients>
      ${s.length?s.map(([t,a])=>i`<span class="chip" data-chip=${`${t}:${a}`}>${f(this.nameOf(t,a))}<button type="button" aria-label=${g("remove")} @click=${()=>this.emit({...e,[t]:e[t].filter(r=>r!==a)})}>×</button></span>`):i`<span class="hint">${g("recipientsDefault")}</span>`}
      <button type="button" class="add" data-recipients-open aria-expanded=${String(this.open)} @click=${()=>this.open=!this.open}>+ ${g("recipientsPick")}</button>
    </div>
    ${this.open&&this.choices?i`<div class="pop" role="dialog" aria-label=${g("recipientsPick")} @keydown=${t=>{t.key==="Escape"&&(this.open=!1)}}>
      <input type="search" placeholder=${g("search")} .value=${this.q} @input=${t=>this.q=t.target.value} />
      <div class="sect">${g("recipientsRoles")}</div>
      ${B(this.choices.roles,this.q).map(t=>i`<label><input type="checkbox" data-pick-role=${t.id} .checked=${e.roles.includes(t.id)} @change=${a=>this.emit({...e,roles:q(e.roles,t.id,a.target.checked)})} />${f(t.name)}</label>`)}
      <div class="sect">${g("recipientsUsers")}</div>
      ${B(this.choices.users,this.q).map(t=>i`<label><input type="checkbox" data-pick-user=${t.id} .checked=${e.users.includes(t.id)} @change=${a=>this.emit({...e,users:q(e.users,t.id,a.target.checked)})} />${f(t.name)}</label>`)}
    </div>`:l}`}};w.styles=R`
    :host { display: inline-block; position: relative; min-inline-size: 220px; max-inline-size: 100%; }
    .box { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 3px 6px; border: 1px solid var(--dv-border, var(--sw-border)); border-radius: var(--dv-radius-control, 10px); background: var(--dv-surface, var(--sw-surface)); min-block-size: 30px; }
    .chip { display: inline-flex; gap: 4px; align-items: center; padding: 1px 8px; border-radius: 999px; background: var(--dv-accent-soft, var(--sw-accent-soft)); color: var(--dv-accent-text, var(--sw-accent-text)); font-size: var(--sw-fs-sm); }
    .chip button, .add { border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; padding: 0 2px; }
    .add { color: var(--dv-text-2, var(--sw-text-2)); font-size: var(--sw-fs-base); }
    .hint { color: var(--dv-text-3, var(--sw-text-3)); font-size: var(--sw-fs-sm); }
    .pop { position: absolute; inset-inline-start: 0; inset-block-start: calc(100% + 4px); z-index: 5; inline-size: max(260px, 100%); max-block-size: 260px; overflow: auto;
      background: var(--sw-menu-surface); color: var(--dv-text, var(--sw-text)); border: 1px solid var(--sw-menu-border); border-radius: var(--sw-r-md); box-shadow: 0 8px 24px rgb(0 0 0 / 18%); padding: 6px; }
    .pop input[type='search'] { inline-size: 100%; box-sizing: border-box; font: inherit; padding: 4px 8px; border: 1px solid var(--dv-border, var(--sw-border)); border-radius: var(--sw-r-sm); background: transparent; color: inherit; }
    .sect { font-size: var(--sw-fs-xs); color: var(--dv-text-3, var(--sw-text-3)); margin: 6px 4px 2px; }
    label { display: flex; gap: 6px; align-items: center; padding: 3px 4px; border-radius: var(--sw-r-xs); cursor: pointer; font-size: var(--sw-fs-base); }
    label:hover { background: var(--dv-surface-2, var(--sw-surface-2)); }
  `;C([h({attribute:!1})],w.prototype,"choices",2);C([h({attribute:!1})],w.prototype,"value",2);C([u()],w.prototype,"open",2);C([u()],w.prototype,"q",2);w=C([N("scenario-recipients")],w);export{Ge as a,g as b,Ae as c,Ye as d,Ne as e,G as f,qe as g,He as h,K as i,Qe as j,Be as k,Pe as l,Ue as m,Je as n,Le as o,Ve as p,Ke as q,es as r,Me as s,We as t,je as u,O as v,Ee as w,Ze as x,Xe as y};
//# sourceMappingURL=scenario-recipients-CJt7CLEa.js.map
