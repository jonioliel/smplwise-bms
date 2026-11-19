import{cy as v,g as A,ay as f,i as D,b as i,A as d,a7 as b,rM as L,k as N,j as h,dt as r,bi as Y,bj as ee,jV as g,rN as se,rO as te,rP as ae,rQ as ie,rR as re,rS as ne,i0 as oe,rT as le,rU as de,rV as ce,h2 as pe,ex as ue,cG as he,cE as ve,bE as fe,b4 as _,bn as S,bs as W,bT as me}from"./index-DJHEuoub.js";import{a as o,w as H,f as K,e as F,g as be,h as $e,j as ge,k as ye,r as j,l as we,n as xe,o as ke,p as _e,q as ze}from"./automations-logic-CT1EHtyZ.js";import{a as E}from"./automations-glass-CuVLY0Pj.js";import{a as M,c as $}from"./automations-demo-DZ_Ot_mu.js";var Se=Object.defineProperty,Ce=Object.getOwnPropertyDescriptor,C=(e,s,t,a)=>{for(var n=a>1?void 0:a?Ce(s,t):s,c=e.length-1,l;c>=0;c--)(l=e[c])&&(n=(a?l(s,t,n):l(n))||n);return a&&n&&Se(s,t,n),n};const Te={single:v("ריצה אחת בכל פעם"),restart:v("התחלה מחדש"),queued:v("בתור"),parallel:v("במקביל")};let w=class extends D{constructor(){super(...arguments),this.trace=null,this.mode=null,this.now=new Date,this.timeZone=void 0}connectedCallback(){super.connectedCallback(),M(this)}resultChip(e,s){return i`<span class=${`chip ${e==="ok"?"ok":e==="error"?"bad":e==="running"?"info":""}`} data-trace-result=${e}>${s}</span>`}statusIcon(e){return e.status==="ok"?o("check"):e.status==="bad"?o("close"):e.status==="run"?o("play"):e.status==="info"?o("bolt"):o("minus")}vars(e){return e.length?i`<div class="vars">${e.map(([s,t])=>i`<span><bdi>${s}</bdi>: <b>${t}</b></span>`)}</div>`:d}row(e,s="",t){const a=e.depth>0?`margin-inline-start:${Math.min(e.depth,4)*14}px`:"";return i`<div class=${`row ${e.status} ${e.depth>0?"nest":""} ${s}`} style=${a} data-trace-row=${e.path}>
      <span class="st">${this.statusIcon(e)}</span>
      <div class="tx">${b(e.sentence)}${e.error?i`<div class="err">${e.error}</div>`:d}</div>
      <div class="meta">${e.time?i`<span>${e.time}</span>`:d}${e.duration?i`<span>${e.duration}</span>`:d}</div>
      <code class="path">${e.path}</code>
      ${this.vars(t??e.vars)}
    </div>`}render(){const e=this.trace;if(!e)return d;const s=L(e,{timeZone:this.timeZone}),t=H(e.at,this.now,this.timeZone).replace(/\s\d\d:\d\d$/,"");return i`
      <div class="sentence" data-trace-sentence>${o("help")}<div>${s.sentence}</div></div>
      <dl class="sum" data-trace-summary>
        <dt>${v("תוצאה")}</dt><dd>${this.resultChip(s.result.id,s.result.label)}</dd>
        <dt>${v("התחלה")}</dt><dd>${t} ${s.trigger.time??s.at}</dd>
        ${s.duration?i`<dt>${v("משך")}</dt><dd>${s.duration}</dd>`:d}
        <dt>${v("הופעלה על ידי")}</dt><dd>${s.who}</dd>
        ${this.mode?i`<dt>${v("מצב")}</dt><dd>${Te[this.mode]??this.mode}</dd>`:d}
      </dl>
      <div class="sec" data-trace-trigger>
        <h5>${o("bolt")}${v("טריגר")}</h5>
        ${this.row({...s.trigger,status:"info"},"",Re(e))}
      </div>
      <div class="sec" data-trace-conditions>
        <h5>${o("help")}${v("תנאים")}${s.counts.conditions?i`<span class="cnt">${v("עברו {done}/{total}",{done:s.counts.conditions_passed,total:s.counts.conditions})}</span>`:d}</h5>
        ${s.conditions.length?s.conditions.map(a=>this.row(a)):i`<div class="skip-note">${v("אין תנאים")}</div>`}
      </div>
      <div class="sec" data-trace-steps>
        <h5>${o("play")}${v("פעולות")}${s.counts.steps?i`<span class="cnt">${v("בוצעו {done}/{total}",{done:s.counts.steps_done,total:s.counts.steps})}</span>`:d}</h5>
        ${s.steps.length?s.steps.map(a=>this.row(a)):i`<div class="skip-note">${v("לא בוצעו פעולות")}</div>`}
      </div>`}};w.styles=[...E,A`
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
  `];C([f({attribute:!1})],w.prototype,"trace",2);C([f()],w.prototype,"mode",2);C([f({attribute:!1})],w.prototype,"now",2);C([f()],w.prototype,"timeZone",2);w=C([N("run-trace")],w);function Re(e){return L(e).variables}var Ae=Object.defineProperty,De=Object.getOwnPropertyDescriptor,T=(e,s,t,a)=>{for(var n=a>1?void 0:a?De(s,t):s,c=e.length-1,l;c>=0;c--)(l=e[c])&&(n=(a?l(s,t,n):l(n))||n);return a&&n&&Ae(s,t,n),n};const O=(e,s,t)=>Math.min(t,Math.max(s,e));let x=class extends D{constructor(){super(...arguments),this.fields=[],this.values=null,this.entityChoices={},this.current={}}willUpdate(e){(e.has("fields")||e.has("values"))&&(this.current={...K(this.fields),...this.values??{}})}connectedCallback(){super.connectedCallback(),M(this)}set(e,s){this.current={...this.current,[e]:s},this.dispatchEvent(new CustomEvent("change",{detail:{values:{...this.current},valid:F(this.fields,this.current).length===0},bubbles:!0,composed:!0}))}num(e){const s=e.selector,t=s.step??1,a=typeof this.current[e.key]=="number"?this.current[e.key]:Number(s.min);return i`<div class="stepper" role="group" aria-label=${e.name}>
      <button type="button" aria-label=${v("פחות")} data-field-minus=${e.key} ?disabled=${a<=s.min} @click=${()=>this.set(e.key,O(Math.round((a-t)*1e3)/1e3,s.min,s.max))}>${o("minus")}</button>
      <input type="number" inputmode="decimal" min=${s.min} max=${s.max} step=${t} .value=${String(a)} aria-label=${e.name} data-field=${e.key} @change=${n=>{const c=Number(n.target.value);Number.isFinite(c)&&this.set(e.key,O(c,s.min,s.max))}} />
      ${s.unit?i`<small>${s.unit}</small>`:d}
      <button type="button" aria-label=${v("יותר")} data-field-plus=${e.key} ?disabled=${a>=s.max} @click=${()=>this.set(e.key,O(Math.round((a+t)*1e3)/1e3,s.min,s.max))}>${o("plus")}</button>
    </div>`}control(e){const s=e.selector,t=this.current[e.key];switch(s.kind){case"number":return this.num(e);case"boolean":return i`<button type="button" class="tog" role="switch" aria-checked=${String(t===!0)} aria-label=${e.name} data-field=${e.key} @click=${()=>this.set(e.key,t!==!0)}></button>`;case"select":return i`<select class="inp" aria-label=${e.name} data-field=${e.key} @change=${a=>this.set(e.key,a.target.value)}>${s.options.map(a=>i`<option value=${a} ?selected=${t===a}>${a}</option>`)}</select>`;case"text":return i`<input class="inp" type="text" maxlength=${s.max??200} .value=${typeof t=="string"?t:""} aria-label=${e.name} data-field=${e.key} @input=${a=>this.set(e.key,a.target.value)} />`;case"entity":{const a=this.entityChoices[e.key]??[],n=(Array.isArray(e.default)?e.default:e.default?[e.default]:[]).map(String),c=[...a,...n.filter(m=>!a.some(z=>z.value===m)).map(m=>({value:m,label:m.split(".").slice(1).join(".").replace(/_/g," ")}))],l=Array.isArray(t)?String(t[0]??""):String(t??"");return i`<select class="inp" aria-label=${e.name} data-field=${e.key} @change=${m=>{const z=m.target.value;this.set(e.key,Array.isArray(e.default)?[z]:z)}}>${c.map(m=>i`<option value=${m.value} ?selected=${l===m.value}>${m.label}</option>`)}</select>`}default:return d}}render(){const e=new Set(F(this.fields,this.current)),s=this.fields.filter(t=>t.selector.kind!=="locked");return s.length?i`<div class="form" data-script-form>${s.map(t=>i`<div class=${`f ${e.has(t.key)?"bad":""}`} data-field-row=${t.key}><span class="nm">${t.name}${t.required?" *":""}</span>${this.control(t)}</div>`)}</div>`:d}};x.styles=[...E,A`
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
  `];T([f({attribute:!1})],x.prototype,"fields",2);T([f({attribute:!1})],x.prototype,"values",2);T([f({attribute:!1})],x.prototype,"entityChoices",2);T([h()],x.prototype,"current",2);x=T([N("script-fields-form")],x);var q=Object.freeze,G=Object.defineProperty,Ne=Object.getOwnPropertyDescriptor,u=(e,s,t,a)=>{for(var n=a>1?void 0:a?Ne(s,t):s,c=e.length-1,l;c>=0;c--)(l=e[c])&&(n=(a?l(s,t,n):l(n))||n);return a&&n&&G(s,t,n),n},Oe=(e,s)=>q(G(e,"raw",{value:q(e.slice())})),B;const Fe={single:r("התעלם"),restart:r("התחל מחדש"),queued:r("המתן בתור"),parallel:r("הרץ במקביל")},Ie={conditions:r("אם"),if:r("אם"),then:r("אז"),else:r("אחרת"),default:r("אחרת"),sequence:r("אז")};let p=class extends D{constructor(){super(...arguments),this.kind="automation",this.itemId="",this.open=!1,this.view="detail",this.runId="",this.trash=!1,this.status=null,this.now=new Date,this.phase="loading",this.item=null,this.errorText="",this.runs=null,this.trace=null,this.traceBusy=!1,this.traceError="",this.versions=null,this.action="",this.dry=null,this.dryBusy=!1,this.busy=!1,this.confirm=null,this.copyName="",this.restoring=null,this.conflict=null,this.values={},this.valid=!0,this.trashRows=null,this.choices={},this.loadedKey="",this.close=()=>this.fire("drawer-close")}connectedCallback(){super.connectedCallback(),M(this)}willUpdate(e){const s=`${this.open}|${this.trash}|${this.kind}|${this.itemId}`;this.open&&s!==this.loadedKey?(this.loadedKey=s,this.dry=null,this.conflict=null,this.confirm=null,this.runs=null,this.versions=null,this.trace=null,this.trash?this.loadTrash():this.itemId&&this.load()):!this.open&&this.loadedKey&&(this.loadedKey=""),this.open&&!this.trash&&(e.has("view")||e.has("runId"))&&this.item&&this.loadView()}async refresh(){if(this.trash)return this.loadTrash();this.itemId&&await this.load(!0)}async load(e=!1){e||(this.phase="loading",this.item=null);try{const s=await $().get(this.kind,this.itemId);if(this.item=s,this.phase="ready",this.errorText="",s.kind==="script"){const t=s.draft.fields;(!e||!Object.keys(this.values).length)&&(this.values=K(t)),this.valid=F(t,this.values).length===0,this.loadChoices(t.filter(a=>a.selector.kind==="entity").length>0)}this.loadRuns(),this.applyAction(),await this.loadView()}catch(s){const t=g(s);t.status===404?this.phase="missing":t.status===403?this.phase="forbidden":(this.phase="error",this.errorText=t.message)}}async loadChoices(e){if(e)try{const s=await $().catalog(),t={};for(const a of(this.item?.draft).fields){if(a.selector.kind!=="entity")continue;const n=a.selector.domains;t[a.key]=s.entities.filter(c=>!n.length||n.includes(c.domain)).map(c=>({value:c.entity_id,label:c.name}))}this.choices=t}catch{this.choices={}}}async loadRuns(){if(!(!this.item||this.item.kind==="scene"))try{this.runs=await $().runs(this.item.kind,this.item.id)}catch{this.runs=[]}}async loadView(){if(this.item){if(this.view==="dryrun"&&!this.dry&&!this.dryBusy&&this.dryRun(),this.view==="versions"&&!this.versions)try{this.versions=await $().versions(this.item.kind,this.item.id)}catch{this.versions=[]}if(this.view==="trace"){this.runs||await this.loadRuns();const e=this.runId||this.runs?.[0]?.run_id||"";if(!e){this.trace=null;return}if(this.trace?.run_id===e)return;this.traceBusy=!0,this.traceError="";try{this.trace=await $().runTrace(this.item.kind,this.item.id,e)}catch(s){this.traceError=g(s).message,this.trace=null}finally{this.traceBusy=!1}}}}async loadTrash(){this.phase="loading";try{this.trashRows=await $().trash(),this.phase="ready"}catch(e){this.errorText=g(e).message,this.phase="error"}}fire(e,s){this.isConnected&&this.dispatchEvent(new CustomEvent(e,{detail:s,bubbles:!0,composed:!0}))}say(e,s="ok",t){this.fire("result",{text:e,tone:s,action:t})}go(e,s=""){this.fire("view-change",{view:e,run:s})}failed(e){const s=g(e);return s.kind==="conflict"&&s.current&&(this.conflict=s.current),this.say(s.message,"error"),s}async run(e=!1){const s=this.item;if(!(!s||this.busy)){if(!e&&se(s)){this.confirm="run";return}this.confirm=null,this.busy=!0;try{s.kind==="script"?await te(s.id,this.values,{confirm:e||void 0}):await ae(s.id,{skip_condition:!0,confirm:e||void 0}),this.say(s.kind==="script"?r("הסקריפט הופעל"):r("האוטומציה הורצה")),this.fire("changed",{id:s.id}),window.setTimeout(()=>void this.load(!0),250)}catch(t){g(t).kind==="confirm"&&!e?this.confirm="run":this.failed(t)}finally{this.busy=!1}}}async stop(){const e=this.item;if(!(!e||this.busy)){this.busy=!0;try{await ie(e.id),this.say(r("הסקריפט נעצר")),this.fire("changed",{id:e.id}),await this.load(!0)}catch(s){this.failed(s)}finally{this.busy=!1}}}async dryRun(){const e=this.item;if(!(!e||this.dryBusy)){this.dry=null,this.dryBusy=!0;try{this.dry=await $().dryRun(e.kind,e.id)}catch(s){this.say(g(s).message,"error"),this.go("detail")}finally{this.dryBusy=!1}}}applyAction(){const e=this.item,s=this.action;if(!e||!s)return;const t=be(s,e.can);t==="copy"&&(this.copyName=r("{name} (עותק)",{name:e.name})),t&&(this.confirm=t),this.fire("action-done")}async doDelete(){const e=this.item;if(!(!e||this.busy)){this.busy=!0;try{const s=await re(e.kind,e.id,e.revision,{confirm:!0});this.confirm=null,this.fire("deleted",{trash_id:s.trash_id,name:e.name,kind:e.kind,id:e.id})}catch(s){this.confirm=null,this.failed(s)}finally{this.busy=!1}}}async doCopy(){const e=this.item,s=this.copyName.trim();if(!(!e||!s||this.busy)){this.busy=!0;try{const t=await ne(e.kind,e.id,s);this.confirm=null,t.item?this.fire("copied",{item:t.item}):this.say(r("נשמר"),"ok")}catch(t){this.confirm=null,this.failed(t)}finally{this.busy=!1}}}async doRestore(){const e=this.item,s=this.restoring;if(!(!e||!s||this.busy)){this.busy=!0;try{await $().restoreVersion(e.kind,e.id,s.version_id,{base_revision:e.revision,client_request_id:oe()}),this.confirm=null,this.restoring=null,this.versions=null,this.say(r("הגרסה שוחזרה")),this.fire("changed",{id:e.id}),await this.load(!0),await this.loadView()}catch(t){this.confirm=null,this.failed(t)}finally{this.busy=!1}}}async restoreFromTrash(e){if(!this.busy){this.busy=!0;try{const s=await $().restoreTrash(e.trash_id,{client_request_id:`restore-${e.trash_id}-${Date.now()}`});this.say(r('"{name}" שוחזר',{name:e.name})),this.fire("changed",{id:s.item?.id??e.config_id}),this.trashRows=(this.trashRows??[]).filter(t=>t.trash_id!==e.trash_id)}catch(s){this.say(g(s).message,"error")}finally{this.busy=!1}}}async purge(e){if(!this.busy){this.busy=!0;try{await $().purgeTrash(e.trash_id),this.trashRows=(this.trashRows??[]).filter(s=>s.trash_id!==e.trash_id),this.say(r('"{name}" נמחק לצמיתות',{name:e.name}))}catch(s){this.say(g(s).message,"error")}finally{this.busy=!1}}}blockRow(e,s=!1,t=""){const a=e.kind==="locked",n=a&&le(e);return i`<div class=${`blk${a?" locked":""}${s?" nested":""}`} data-block=${e.uid} data-block-kind=${e.kind}>
      <span class="bi">${o($e(e))}</span>
      <span class="bt">${t?i`<small>${t}</small>`:d}${b(a?`${e.label}${e.sentence&&e.sentence!==e.label?` · ${e.sentence}`:""}`:e.sentence)}</span>
      ${n?i`<span class="chip warn" data-chip="schedules">${o("calendar")}${r("שולט בתזמונים")}</span>`:d}
      ${a&&e.sensitive?i`<span class="chip sens">${o("shield")}${r("רגישה")}</span>`:d}
    </div>`}nestedRows(e,s=0){if(s>=2)return[];const t=[];for(const a of de(e)){const n=a.name.split(".").pop()??a.name;a.blocks.forEach((c,l)=>{t.push(this.blockRow(c,!0,l===0?Ie[n]??"":"")),t.push(...this.nestedRows(c,s+1))})}return t}section(e,s,t,a){return a.length?i`<section class="sect" data-section=${e}>
      <h4><span class=${`tag t${e}`}>${o(t)}</span>${s} <span class="num">${a.length}</span></h4>
      ${a.map(n=>i`${this.blockRow(n)}${this.nestedRows(n)}`)}
    </section>`:d}banners(e){const s=[],t=ce(e);if(this.conflict&&s.push(i`<div class="banner warn" role="alert" data-drawer-conflict>${o("warning")}<div><b>${r("הפריט שונה במקום אחר")}</b><small>${r("טענו את הגרסה העדכנית והחליטו מה לשמור.")}</small></div><button type="button" class="btn sm" data-conflict-reload @click=${()=>{this.conflict=null,this.load(!0)}}>${r("טען מחדש")}</button></div>`),t){const a=t.code==="yaml_managed"||t.code==="no_config_id";s.push(i`<div class=${`banner ${a?"warn":"info"}`} data-drawer-readonly=${t.code}>${o(a?"eye":t.code==="delegation_off"?"lock":"eye")}<div><b>${a?r("מוגדרת בקובץ תצורה"):t.text}</b>${a?i`<small>${r("לצפייה בלבד. עריכה: בתשתית המערכת.")}</small>`:d}</div></div>`)}return e.state==="invalid"&&s.push(i`<div class="banner bad" data-drawer-invalid>${o("warning")}<div><b>${r("לא פעילה – שגיאה בהגדרה")}</b>${e.warnings.find(a=>a.code==="invalid_config")?.message?i`<small>${e.warnings.find(a=>a.code==="invalid_config").message}</small>`:d}</div></div>`),e.warnings.some(a=>a.code==="changed_outside")&&s.push(i`<div class="banner info" data-drawer-outside>${o("history")}<div><b>${r("שונתה מחוץ למערכת")}</b></div><button type="button" class="btn sm" @click=${()=>this.go("versions")}>${r("גרסאות")}</button></div>`),i`${s}`}detail(e){const s=e.kind==="script",t=e.draft,a=pe(e.draft).length,n=ge(e,{sensitiveWarning:this.status?.ui.sensitive_warning!==!1}),c=e.targets.filter((l,m,z)=>z.findIndex(X=>X.entity_id===l.entity_id)===m);return i`<div class="stack" data-drawer-detail>
      ${this.banners(e)}
      ${e.sentence?i`<div class="sentence" data-drawer-sentence>${o("bolt")}<div>${e.sentence}${e.description?i`<small>${e.description}</small>`:d}</div></div>`:d}
      ${n.length||e.mode?i`<div class="chips">${e.mode?i`<span class="chip" data-chip="mode">${Fe[e.mode]}</span>`:d}${n.filter(l=>l.id!=="read_only").map(l=>i`<span class=${`chip ${l.id==="sensitive"?"sens":l.tone==="bad"?"bad":l.tone==="warn"?"warn":""}`} data-chip=${l.id}>${o(l.id==="sensitive"?"shield":l.id==="locked"?"lock":"warning")}${l.label}</span>`)}</div>`:d}
      ${s&&t.fields?.some(l=>l.selector.kind!=="locked")?i(B||(B=Oe(["<script-fields-form .fields="," .values="," .entityChoices="," @change=","><\/script-fields-form>"])),t.fields,this.values,this.choices,l=>{this.values=l.detail.values,this.valid=l.detail.valid}):d}
      ${s?this.section(3,r("אז"),"play",t.sequence??[]):i`${this.section(1,r("כאשר"),"bolt",t.triggers??[])}${this.section(2,r("אם"),"help",t.conditions??[])}${this.section(3,r("אז"),"play",t.actions??[])}`}
      ${a?d:i`<div class="empty-note">${r("אין פירוט להצגה")}</div>`}
      ${c.length?i`<section class="sect" data-section="devices"><h4>${o("layers")}${r("מכשירים מושפעים")} <span class="num">${c.length}</span></h4>${c.map(l=>i`<div class="dev" data-target=${l.entity_id}><span class="bi">${o(ye(l.entity_id))}</span><span class="bt">${b(l.name)}<small>${b([l.floor,l.area].filter(Boolean).join(" · "))}</small></span>${l.missing?i`<span class="chip bad">${o("warning")}${r("חסר")}</span>`:l.sensitive?i`<span class="chip sens">${o("shield")}${r("רגישה")}</span>`:d}</div>`)}</section>`:d}
      ${this.runs&&this.runs.length?i`<section class="sect" data-section="runs"><h4>${o("history")}${r("ריצות אחרונות")} <span class="num">${e.runs_7d??this.runs.length}</span></h4>
        ${j(this.runs.slice(0,3),this.now).map(l=>i`<button type="button" class="run" data-run-row=${l.run_id} @click=${()=>this.go("trace",l.run_id)}><i class=${`dot ${l.tone==="none"?"":l.tone}`}></i><span class="t">${l.label}</span><span class="s">${l.sentence}</span>${o("chevronBack")}</button>`)}</section>`:d}
    </div>`}traceView(e){const s=j(this.runs??[],this.now),t=this.runId||s[0]?.run_id||"";return i`<div class="stack" data-drawer-trace>
      ${s.length?i`<div class="runchips" role="group" aria-label=${r("ריצות")}>${s.map(a=>i`<button type="button" class="rc" aria-pressed=${String(a.run_id===t)} data-run-chip=${a.run_id} @click=${()=>this.go("trace",a.run_id)}>${a.label}<i class=${`dot ${a.tone==="none"?"":a.tone}`}></i></button>`)}</div>`:i`<div class="empty-note" data-trace-empty>${r("אין ריצות להצגה")}</div>`}
      ${this.traceBusy?i`<div class="skl-stack"><span class="skl" style="block-size:70px"></span><span class="skl" style="block-size:120px"></span><span class="skl" style="block-size:200px"></span></div>`:d}
      ${this.traceError?i`<div class="banner bad" role="alert">${o("warning")}${this.traceError}</div>`:d}
      ${this.trace&&!this.traceBusy?i`<run-trace .trace=${this.trace} .mode=${e.mode} .now=${this.now}></run-trace>`:d}
    </div>`}versionsView(e){if(!this.versions)return i`<div class="skl-stack"><span class="skl" style="block-size:84px"></span><span class="skl" style="block-size:84px"></span></div>`;const s=e.can.edit;return i`<div class="stack" data-drawer-versions>${this.versions.map(t=>i`<div class=${`ver${t.current?" cur":""}`} data-version=${t.version_id}>
      <div class="vh"><span>${t.version_id}${t.current?` · ${r("נוכחית")}`:""}</span>${t.via==="external"?i`<span class="chip warn">${o("history")}${r("מחוץ למערכת")}</span>`:d}</div>
      <div class="vs">${t.summary}</div>
      <div class="vm">${H(t.at,this.now)}${t.actor?` · ${t.actor}`:""}</div>
      ${!t.current&&s?i`<button type="button" class="btn sm" data-version-restore=${t.version_id} @click=${()=>{this.restoring=t,this.confirm="restore"}}>${o("restore")}${r("שחזר")}</button>`:d}
    </div>`)}</div>`}dryView(){if(this.dryBusy||!this.dry)return i`<div class="skl-stack"><span class="skl" style="block-size:60px"></span><span class="skl" style="block-size:60px"></span></div>`;const e=this.dry;return i`<div class="stack" data-drawer-dryrun>
      <section class="sect"><h4>${o("help")}${r("תנאים")} <span class="num">${e.conditions.length}</span></h4>
        ${e.conditions.length?e.conditions.map(s=>i`<div class="dry-row"><span class=${`st ${s.passed===!0?"ok":s.passed===!1?"bad":""}`}>${o(s.passed===!0?"check":s.passed===!1?"close":"minus")}</span><span>${b(s.sentence)}</span>${s.passed===null?i`<span class="arrow">${r("לא ניתן לבדוק")}</span>`:d}</div>`):i`<div class="empty-note">${r("אין תנאים")}</div>`}</section>
      <section class="sect"><h4>${o("layers")}${r("מה ישתנה")} <span class="num">${e.effects.entities.length}</span></h4>
        ${e.effects.entities.length?e.effects.entities.map(s=>i`<div class="dry-row"><span class="bt">${b(s.name)}</span><span class="arrow">${r("{from} ← {to}",{from:s.from??"—",to:s.to??"—"})}</span></div>`):i`<div class="empty-note">${r("אין שינוי במכשירים")}</div>`}
        ${e.effects.unknown?i`<div class="banner info">${o("info")}${r("יש פעולה מתקדמת שהשפעתה אינה ידועה")}</div>`:d}</section>
    </div>`}trashView(){return this.phase==="error"?i`<div class="center" data-drawer-state="error">${o("warning",30)}<b>${this.errorText}</b><button type="button" class="btn sm" @click=${()=>void this.loadTrash()}>${o("refresh")}${r("נסו שוב")}</button></div>`:this.trashRows===null||this.phase==="loading"?i`<div class="skl-stack"><span class="skl" style="block-size:84px"></span><span class="skl" style="block-size:84px"></span></div>`:this.trashRows.length?i`<div class="stack" data-drawer-trash>${this.trashRows.map(e=>{const s=we(e.expires_at,this.now);return i`<div class="tr" data-trash=${e.trash_id}>
        <span class="bi">${o(e.kind==="script"?"script":e.kind==="scene"?"sparkle":"bolt")}</span>
        <b>${b(e.name)} ${e.sensitive?i`<span class="chip sens">${o("shield")}${r("רגישה")}</span>`:d}</b>
        <small>${e.sentence}</small>
        <small>${xe(e.deleted_at,this.now)}${e.deleted_by?` · ${e.deleted_by}`:""} · <span class=${s.urgent?"urgent":""}>${s.text}</span></small>
        <span class="trbtns">${e.can_restore?i`<button type="button" class="btn sm" data-trash-restore=${e.trash_id} ?disabled=${this.busy} @click=${()=>void this.restoreFromTrash(e)}>${o("restore")}${r("שחזר")}</button>`:d}${this.status?.can.manage&&this.status?.can.configure?i`<button type="button" class="btn sm quiet dz" data-trash-purge=${e.trash_id} aria-label=${`${r("מחיקה לצמיתות")} · ${e.name}`} ?disabled=${this.busy} @click=${()=>void this.purge(e)}>${o("trash")}</button>`:d}</span>
      </div>`})}</div>`:i`<div class="center" data-drawer-state="trash-empty">${o("trash",30)}<b>${r("סל המחזור ריק")}</b></div>`}stateBox(){return this.phase==="loading"?i`<div class="skl-stack" data-drawer-state="loading" aria-busy="true"><span class="skl" style="block-size:96px"></span><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:52px"></span></div>`:this.phase==="missing"?i`<div class="center" data-drawer-state="missing">${o("search",30)}<b>${r("הפריט לא נמצא")}</b></div>`:this.phase==="forbidden"?i`<div class="center" data-drawer-state="forbidden">${o("lock",30)}<b>${r("אין הרשאה")}</b></div>`:this.phase==="error"?i`<div class="center" data-drawer-state="error">${o("warning",30)}<b>${this.errorText||r("לא ניתן לטעון")}</b><button type="button" class="btn sm" @click=${()=>void this.load()}>${o("refresh")}${r("נסו שוב")}</button></div>`:null}footer(e){const s=this.view;if(s==="trace")return i`<div class="foot2" slot="footer"><button type="button" class="btn" @click=${this.close}>${r("סגירה")}</button>${e.can.run?i`<button type="button" class="btn" data-drawer-run ?disabled=${this.busy} @click=${()=>void this.run()}>${o("play")}${r("הרץ שוב")}</button>`:d}<button type="button" class="btn" data-drawer-back-detail @click=${()=>this.go("detail")}>${o("eye")}${r("לאוטומציה")}</button></div>`;if(s==="versions"||s==="dryrun")return i`<div class="foot2" slot="footer"><button type="button" class="btn" @click=${()=>this.go("detail")}>${r("סגירה")}</button></div>`;const t=e.state==="running",a=e.kind==="script",n=e.can.edit?i`<button type="button" class=${`btn${a?"":" primary"}`} data-drawer-edit @click=${()=>this.fire("edit",{kind:e.kind,id:e.id})}>${o("edit")}${r("עריכה")}</button>`:d,c=t&&a?i`<button type="button" class="btn danger" data-drawer-stop ?disabled=${this.busy} @click=${()=>void this.stop()}>${o("stop")}${r("עצור")}</button>`:e.can.run?i`<button type="button" class=${`btn${a?" primary":""}`} data-drawer-run ?disabled=${this.busy||a&&!this.valid} @click=${()=>void this.run()}>${o("play")}${a?r("הפעל"):r("הרץ עכשיו")}</button>`:d;return i`<div class="foot2" slot="footer">
      ${a?i`${c}${n}`:i`${n}${c}`}
      ${a?d:i`<button type="button" class="btn" data-drawer-dry @click=${()=>this.go("dryrun")}>${o("flask")}${r("בדיקה")}</button>`}
      ${e.last_run&&!a?i`<button type="button" class="btn" data-drawer-why @click=${()=>this.go("trace")}>${o("help")}${r("למה זה רץ")}</button>`:d}
      ${e.source==="ui"?i`<button type="button" class="btn quiet" data-drawer-versions @click=${()=>this.go("versions")}>${o("history")}${r("גרסאות")}</button>`:d}
      ${e.can.copy?i`<button type="button" class="btn quiet" data-drawer-copy @click=${()=>{this.copyName=r("{name} (עותק)",{name:e.name}),this.confirm="copy"}}>${o("copy")}${r("שכפול")}</button>`:d}
      ${e.can.delete?i`<button type="button" class="btn quiet dz" data-drawer-delete @click=${()=>this.confirm="delete"}>${o("trash")}${r("מחיקה")}</button>`:d}
    </div>`}dialogs(e){const s=this.confirm;if(!s||!e)return d;if(s==="run"){const t=ke(e);return i`<sw-dialog open heading=${e.kind==="script"?r("להפעיל עכשיו?"):r("להריץ עכשיו?")} data-dialog="run" @close=${()=>this.confirm=null}>
        <div class="dlgform">${t?i`<p>${t}</p>`:d}<div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>${r("ביטול")}</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.run(!0)}>${e.kind==="script"?r("הפעל"):r("הרץ")}</button></div></div></sw-dialog>`}return s==="delete"?i`<sw-dialog open heading=${r('למחוק את "{name}"?',{name:e.name})} data-dialog="delete" @close=${()=>this.confirm=null}>
        <div class="dlgform"><p>${r("הפריט יישמר בסל המחזור וניתן לשחזר אותו.")}</p><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>${r("ביטול")}</button><button type="button" class="btn danger" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.doDelete()}>${r("מחיקה")}</button></div></div></sw-dialog>`:s==="copy"?i`<sw-dialog open heading=${r("שכפול")} data-dialog="copy" @close=${()=>this.confirm=null}>
        <div class="dlgform"><label class="fld">${r("שם")}<input class="inp" type="text" maxlength="120" .value=${this.copyName} data-copy-name @input=${t=>this.copyName=t.target.value} /></label><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>${r("ביטול")}</button><button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy||!this.copyName.trim()} @click=${()=>void this.doCopy()}>${r("שכפול")}</button></div></div></sw-dialog>`:i`<sw-dialog open heading=${r("לשחזר את {version}?",{version:this.restoring?.version_id??""})} data-dialog="restore" @close=${()=>this.confirm=null}>
      <div class="dlgform"><p>${this.restoring?.summary??""}</p><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>${r("ביטול")}</button><button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.doRestore()}>${r("שחזר")}</button></div></div></sw-dialog>`}render(){if(this.trash)return i`<sw-drawer modal .open=${this.open} heading=${r("סל המחזור")} @close=${this.close}>${this.trashView()}<div class="foot2" slot="footer"><button type="button" class="btn" @click=${this.close}>${r("סגירה")}</button></div></sw-drawer>`;const e=this.item,s=this.view,t=e?s==="trace"?r("למה זה רץ"):s==="versions"?r("גרסאות"):s==="dryrun"?r("בדיקה"):b(e.name):"",a=e?s==="detail"?[_e(e),ze(e)].filter(Boolean).join(" · "):b(e.name):"",n=this.stateBox();return i`<sw-drawer modal .open=${this.open} heading=${t} subheading=${a} @close=${this.close}>
      ${s!=="detail"&&e?i`<button slot="action" type="button" class="rb sm" aria-label=${ue("actions.back")} data-drawer-back @click=${()=>this.go("detail")}>${o("chevron")}</button>`:d}
      ${n??(e?s==="trace"?this.traceView(e):s==="versions"?this.versionsView(e):s==="dryrun"?this.dryView():this.detail(e):d)}
      ${e&&!n?this.footer(e):d}
      ${this.dialogs(e)}
    </sw-drawer>`}};p.styles=[...E,A`
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
    /* AUDIT30-I2 (#4, owner Q3 option a): the chosen chip is the product's Blue Wash pair, never a solid text-colour block */
    .rc[aria-pressed='true'] {
      ${Y}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .rc[aria-pressed='true']::before {
      ${ee}
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
  `];u([f()],p.prototype,"kind",2);u([f()],p.prototype,"itemId",2);u([f({type:Boolean})],p.prototype,"open",2);u([f()],p.prototype,"view",2);u([f()],p.prototype,"runId",2);u([f({type:Boolean})],p.prototype,"trash",2);u([f({attribute:!1})],p.prototype,"status",2);u([f({attribute:!1})],p.prototype,"now",2);u([h()],p.prototype,"phase",2);u([h()],p.prototype,"item",2);u([h()],p.prototype,"errorText",2);u([h()],p.prototype,"runs",2);u([h()],p.prototype,"trace",2);u([h()],p.prototype,"traceBusy",2);u([h()],p.prototype,"traceError",2);u([h()],p.prototype,"versions",2);u([f()],p.prototype,"action",2);u([h()],p.prototype,"dry",2);u([h()],p.prototype,"dryBusy",2);u([h()],p.prototype,"busy",2);u([h()],p.prototype,"confirm",2);u([h()],p.prototype,"copyName",2);u([h()],p.prototype,"restoring",2);u([h()],p.prototype,"conflict",2);u([h()],p.prototype,"values",2);u([h()],p.prototype,"valid",2);u([h()],p.prototype,"trashRows",2);u([h()],p.prototype,"choices",2);p=u([N("automation-drawer")],p);const P={tab:"תרחישים",title:"תרחישים חוצי מודולים",new:"תרחיש חדש",empty:"אין עדיין תרחישים",disabled:"התרחישים כבויים",noPermission:"אין הרשאה לצפות בתרחישים",loadError:"לא ניתן לטעון את התרחישים",retry:"נסו שוב",settingsLink:"הגדרות התרחישים",killOn:"עצירת חירום פעילה: אף פעולה לא מתבצעת",stateOff:"כבוי",stateOk:"פעיל",stateActive:"הופעל",stateDegraded:"פגום",stateSuppressed:"נעצר",firesToday:"{n} הפעלות היום",lastFire:"הופעל לאחרונה {t}",never:"עוד לא הופעל",owner:"כותב: {n}",page:"עמוד {a} מתוך {b}",prev:"הקודם",next:"הבא",name:"שם",description:"תיאור",when:"כאשר",then:"אז",and:"וגם",or:"או",not:"לא",addCondition:"תנאי",addGroup:"קבוצה",remove:"הסרה",signal:"אות",subject:"נושא",value:"ערך",holdFor:"רציף (שנ׳)",debounce:"יציבות (שנ׳)",margin:"שוליים לשחרור",days:"ימים",from:"מ",to:"עד",dayNames:"ב,ג,ד,ה,ו,ש,א",actNotify:"הודעה",actTicket:"בקשת שירות",actFlag:"סימון",recipientsRoles:"תפקידים",recipientsUsers:"משתמשים",recipientsDefault:"ריק = הנמענים שבהגדרות",recipientsPick:"בחירת נמענים",search:"חיפוש",departmentPick:"בחירת מחלקה",department:"מחלקה",ticketTitle:"כותרת הבקשה",flagName:"שם הסימון",flagValue:"ערך",options:"אפשרויות",cooldown:"המתנה בין הפעלות (שנ׳)",clearAfter:"סיום אחרי (שנ׳)",forS:"משך מינימלי של כל התנאים (שנ׳)",onUnknown:"כשחיישן לא מדווח",onUnknownHold:"להמתין ואז לסמן פגום",onUnknownFalse:"להתייחס כ״לא מתקיים״",grace:"זמן המתנה (שנ׳)",maxFires:"מקסימום הפעלות ביום (ריק = ברירת המחדל)",maxTickets:"מקסימום בקשות ביום (ריק = ברירת המחדל)",test:"הרצה יבשה",simulate:"הדמיה",simulateHint:"ערך לבדיקה",save:"שמירה",cancel:"ביטול",enable:"הפעלה",disable:"כיבוי",delete:"מחיקה",confirmDelete:"למחוק את התרחיש?",enableConfirm:"התרחיש פותח בקשות שירות. לאשר את המחלקה ואת מגבלת {n} בקשות ביום?",confirm:"אישור",testFirst:"יש להריץ הרצה יבשה לפני ההפעלה",wouldFire:"היה מופעל עכשיו",wouldNot:"לא היה מופעל עכשיו",unknownResult:"לא ניתן להעריך עכשיו (חיישן לא מדווח)",actionOff:"הפעולה כבויה בהגדרות",ticketsOff:"מודול בקשות השירות כבוי",runs:"היסטוריה",noRuns:"אין עדיין הרצות",redacted:"אין הרשאה להצגת הנתון",saved:"נשמר",enabled:"התרחיש הופעל",disabledNote:"התרחיש כובה",deleted:"התרחיש נמחק",conflict:"התרחיש השתנה בינתיים. רעננו ונסו שוב.",hintHaOnly:"כלל שמבוסס רק על התקנים מתאים לאוטומציה רגילה או לתבנית.",doorWall:"תרחיש אינו מפעיל דלתות, מנעולים, אזעקות או התקנים.",tru:"מתקיים",fls:"לא מתקיים",unk:"לא ידוע",setTitle:"תרחישים חוצי מודולים",setEnabled:"הפעלת התרחישים",setKill:"עצירת חירום של כל הפעולות",setActNotify:"פעולת הודעה",setActTicket:"פעולת בקשת שירות",setActFlag:"פעולת סימון",setMaxFires:"הפעלות ביום לכל תרחיש (ברירת מחדל)",setMaxTickets:"בקשות שירות ביום לכל תרחיש (ברירת מחדל)",setMaxHour:"פעולות לשעה בכל המערכת",setMaxRules:"מספר תרחישים מרבי",setTick:"בדיקה כל (שנ׳)",setTestPerMin:"הרצות יבשות לדקה",setKeep:"שמירת היסטוריה (ימים)",setDegraded:"הודעה כשתרחיש לא ניתן להעריך",setAfterSource:"מקור שעות הפעילות",setAfterWindow:"חלון קבוע",setAfterCalendar:"לוח העבודה של בקשות השירות",setWindow:"שעות פעילות",setRecipients:"נמענים כברירת מחדל",setSave:"שמירת ההגדרות",setSaved:"ההגדרות נשמרו",setInvalid:"ערך לא תקין"},Z={tab:"Scenarios",title:"Cross-module scenarios",new:"New scenario",empty:"No scenarios yet",disabled:"Scenarios are off",noPermission:"No permission to view scenarios",loadError:"Could not load the scenarios",retry:"Try again",settingsLink:"Scenario settings",killOn:"Emergency stop is on: no action runs",stateOff:"Off",stateOk:"On",stateActive:"Fired",stateDegraded:"Defective",stateSuppressed:"Stopped",firesToday:"{n} fires today",lastFire:"Last fired {t}",never:"Never fired",owner:"Author: {n}",page:"Page {a} of {b}",prev:"Previous",next:"Next",name:"Name",description:"Description",when:"When",then:"Then",and:"and",or:"or",not:"not",addCondition:"Condition",addGroup:"Group",remove:"Remove",signal:"Signal",subject:"Subject",value:"Value",holdFor:"Continuous (s)",debounce:"Stable for (s)",margin:"Release margin",days:"Days",from:"From",to:"To",dayNames:"Mon,Tue,Wed,Thu,Fri,Sat,Sun",actNotify:"Notification",actTicket:"Service request",actFlag:"Flag",recipientsRoles:"Roles",recipientsUsers:"Users",recipientsDefault:"Empty = the recipients in Settings",recipientsPick:"Choose recipients",search:"Search",departmentPick:"Choose a department",department:"Department",ticketTitle:"Request title",flagName:"Flag name",flagValue:"Value",options:"Options",cooldown:"Wait between fires (s)",clearAfter:"Clear after (s)",forS:"All conditions for at least (s)",onUnknown:"When a sensor does not report",onUnknownHold:"Wait, then mark defective",onUnknownFalse:"Treat as not met",grace:"Wait (s)",maxFires:"Max fires per day (empty = default)",maxTickets:"Max requests per day (empty = default)",test:"Dry run",simulate:"Simulate",simulateHint:"Test value",save:"Save",cancel:"Cancel",enable:"Enable",disable:"Disable",delete:"Delete",confirmDelete:"Delete the scenario?",enableConfirm:"This scenario opens service requests. Confirm the department and the cap of {n} requests per day?",confirm:"Confirm",testFirst:"Run a dry run before enabling",wouldFire:"Would fire now",wouldNot:"Would not fire now",unknownResult:"Cannot be evaluated now (a sensor is not reporting)",actionOff:"This action is off in Settings",ticketsOff:"The service module is off",runs:"History",noRuns:"No runs yet",redacted:"No permission to show this value",saved:"Saved",enabled:"Scenario enabled",disabledNote:"Scenario disabled",deleted:"Scenario deleted",conflict:"The scenario changed meanwhile. Refresh and try again.",hintHaOnly:"A rule on devices only fits an ordinary automation or a template.",doorWall:"A scenario never operates doors, locks, alarms or devices.",tru:"Met",fls:"Not met",unk:"Unknown",setTitle:"Cross-module scenarios",setEnabled:"Scenarios on",setKill:"Emergency stop of every action",setActNotify:"Notification action",setActTicket:"Service request action",setActFlag:"Flag action",setMaxFires:"Fires per day per scenario (default)",setMaxTickets:"Service requests per day per scenario (default)",setMaxHour:"Actions per hour, whole system",setMaxRules:"Maximum scenarios",setTick:"Check every (s)",setTestPerMin:"Dry runs per minute",setKeep:"Keep history (days)",setDegraded:"Notice when a scenario cannot be evaluated",setAfterSource:"Working hours source",setAfterWindow:"Fixed window",setAfterCalendar:"The service module work calendar",setWindow:"Working hours",setRecipients:"Default recipients",setSave:"Save settings",setSaved:"Settings saved",setInvalid:"Invalid value"};function Ee(){return ve(["en"])}const Me={he:P,en:Z};function y(e,s,t=Ee()){const a=Me[t][e]??P[e]??e;return he(a,s)}fe("i18n/scenarios",{he:P,en:Z});const He=()=>_("scenarios/status"),Ke=()=>_("scenarios/signals"),Ge=()=>_("scenarios"),Ze=e=>_(`scenarios/${encodeURIComponent(e)}`),Qe=(e,s,t)=>S("scenarios",{name:e,description:s,definition:t}),Je=(e,s,t,a,n)=>W(`scenarios/${encodeURIComponent(e)}`,{version:s,name:t,description:a,definition:n}),Xe=e=>me(`scenarios/${encodeURIComponent(e)}`),Ye=(e,s,t=!1)=>S(`scenarios/${encodeURIComponent(e)}/enable`,{version:s,confirm:t}),es=(e,s)=>S(`scenarios/${encodeURIComponent(e)}/disable`,{version:s}),ss=(e,s)=>S(`scenarios/${encodeURIComponent(e)}/test`,{overrides:s??null}),ts=(e,s)=>S("scenarios/simulate",{definition:e,overrides:s??null}),as=e=>_(`scenarios/${encodeURIComponent(e)}/runs`),is=()=>_("scenarios/choices"),rs=()=>_("scenarios/settings"),ns=e=>W("scenarios/settings",{changes:e,confirmed:!0}),Q=e=>"op"in e&&(e.op==="and"||e.op==="or"),J=e=>"op"in e&&e.op==="not",os=e=>"redacted"in e,Pe=e=>"signal"in e;function I(e,s="when"){return Q(e)?e.items.flatMap((t,a)=>I(t,`${s}.items[${a}]`)):J(e)?I(e.item,`${s}.item`):Pe(e)?[{path:s,leaf:e}]:[]}function je(e){return e==="bool"?["is_true","is_false"]:e==="enum"?["eq","ne","in_set"]:e==="count"?["gt","ge","lt","le","eq","ne"]:["gt","ge","lt","le","between","outside"]}function ls(e){const s={signal:e.id,cmp:je(e.kind)[0]};return e.subject==="window"?s.window={days:[0,1,2,3,4,5,6],from:"18:00",to:"07:00"}:e.subject!=="none"&&(s.subject=e.subjects[0]?.id??""),e.kind==="number"&&(s.value=e.range?Math.min(Math.max(8,e.range[0]),e.range[1]):0),e.kind==="count"&&(s.value=1),s}function ds(e,s){const t=[];let a=0;const n=(c,l)=>{a=Math.max(a,l),Q(c)?(c.items.length||t.push("empty_group"),c.items.forEach(m=>n(m,l+1))):J(c)&&n(c.item,l+1)};return n(e.when,0),a>s.depth&&t.push("too_deep"),I(e.when).length>s.leaves&&t.push("too_many_leaves"),e.actions.length||t.push("no_actions"),e.actions.length>s.actions&&t.push("too_many_actions"),t}const cs=e=>e==="active"?"warn":e==="degraded"||e==="suppressed"?"bad":e==="ok"?"ok":"off";function U(e,s,t){return t?e.includes(s)?[...e]:[...e,s]:e.filter(a=>a!==s)}function V(e,s,t=40){const a=s.trim().toLowerCase();return(a?e.filter(n=>n.name.toLowerCase().includes(a)):[...e]).slice(0,t)}var qe=Object.defineProperty,Be=Object.getOwnPropertyDescriptor,R=(e,s,t,a)=>{for(var n=a>1?void 0:a?Be(s,t):s,c=e.length-1,l;c>=0;c--)(l=e[c])&&(n=(a?l(s,t,n):l(n))||n);return a&&n&&qe(s,t,n),n};let k=class extends D{constructor(){super(...arguments),this.choices=null,this.value={users:[],roles:[]},this.open=!1,this.q=""}emit(e){this.value=e,this.dispatchEvent(new CustomEvent("change",{detail:{value:e},bubbles:!0,composed:!0}))}nameOf(e,s){return this.choices?.[e].find(t=>t.id===s)?.name??s}render(){const e={users:this.value.users??[],roles:this.value.roles??[]},s=[...e.roles.map(t=>["roles",t]),...e.users.map(t=>["users",t])];return i`<div class="box" data-recipients>
      ${s.length?s.map(([t,a])=>i`<span class="chip" data-chip=${`${t}:${a}`}>${b(this.nameOf(t,a))}<button type="button" aria-label=${y("remove")} @click=${()=>this.emit({...e,[t]:e[t].filter(n=>n!==a)})}>×</button></span>`):i`<span class="hint">${y("recipientsDefault")}</span>`}
      <button type="button" class="add" data-recipients-open aria-expanded=${String(this.open)} @click=${()=>this.open=!this.open}>+ ${y("recipientsPick")}</button>
    </div>
    ${this.open&&this.choices?i`<div class="pop" role="dialog" aria-label=${y("recipientsPick")} @keydown=${t=>{t.key==="Escape"&&(this.open=!1)}}>
      <input type="search" placeholder=${y("search")} .value=${this.q} @input=${t=>this.q=t.target.value} />
      <div class="sect">${y("recipientsRoles")}</div>
      ${V(this.choices.roles,this.q).map(t=>i`<label><input type="checkbox" data-pick-role=${t.id} .checked=${e.roles.includes(t.id)} @change=${a=>this.emit({...e,roles:U(e.roles,t.id,a.target.checked)})} />${b(t.name)}</label>`)}
      <div class="sect">${y("recipientsUsers")}</div>
      ${V(this.choices.users,this.q).map(t=>i`<label><input type="checkbox" data-pick-user=${t.id} .checked=${e.users.includes(t.id)} @change=${a=>this.emit({...e,users:U(e.users,t.id,a.target.checked)})} />${b(t.name)}</label>`)}
    </div>`:d}`}};k.styles=A`
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
  `;R([f({attribute:!1})],k.prototype,"choices",2);R([f({attribute:!1})],k.prototype,"value",2);R([h()],k.prototype,"open",2);R([h()],k.prototype,"q",2);k=R([N("scenario-recipients")],k);export{ns as a,y as b,Ke as c,Ze as d,je as e,os as f,rs as g,Pe as h,Q as i,J as j,ts as k,Ge as l,ds as m,ls as n,Qe as o,Ye as p,es as q,Xe as r,is as s,ss as t,Je as u,as as v,cs as w,I as x,He as y};
