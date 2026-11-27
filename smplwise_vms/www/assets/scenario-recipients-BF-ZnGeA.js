import{cL as v,j as I,z as f,a as O,b as i,A as d,aj as m,m as A,k as h,fj as Y,bz as ss,bA as ts,q6 as es,dk as as,o as is,br as rs,bs as ns,bt as os,bu as ls,bg as _,F as C,bw as V,cd as ds}from"./index-CoJbESCx.js";import{g as o,w as K,h as H,j as E,c as $,k as cs,l as ps,n as us,o as hs,r as N,p as vs,q as fs,s as bs,u as ms,v as $s}from"./automations-logic-DwFyvAwP.js";import{a as B}from"./automations-glass-DIFqNkU4.js";import{a as j}from"./glass-zHu6HEwK.js";import{_ as W,M as g,$ as gs,a0 as ys,a1 as ws,a2 as xs,a3 as ks,a4 as _s,a5 as zs,a6 as Cs,a7 as Rs,w as Ss}from"./automations-CNnJHsH1.js";import{l as Ts}from"./live-Cd6o5F1x.js";import{t as r}from"./automation-BuXSzGVy.js";var Is=Object.defineProperty,Os=Object.getOwnPropertyDescriptor,R=(s,t,e,a)=>{for(var n=a>1?void 0:a?Os(t,e):t,c=s.length-1,l;c>=0;c--)(l=s[c])&&(n=(a?l(t,e,n):l(n))||n);return a&&n&&Is(t,e,n),n};const As={single:v("ריצה אחת בכל פעם"),restart:v("התחלה מחדש"),queued:v("בתור"),parallel:v("במקביל")};let w=class extends O{constructor(){super(...arguments),this.trace=null,this.mode=null,this.now=new Date,this.timeZone=void 0}connectedCallback(){super.connectedCallback(),j(this)}resultChip(s,t){return i`<span class=${`chip ${s==="ok"?"ok":s==="error"?"bad":s==="running"?"info":""}`} data-trace-result=${s}>${t}</span>`}statusIcon(s){return s.status==="ok"?o("check"):s.status==="bad"?o("close"):s.status==="run"?o("play"):s.status==="info"?o("bolt"):o("minus")}vars(s){return s.length?i`<div class="vars">${s.map(([t,e])=>i`<span><bdi>${t}</bdi>: <b>${e}</b></span>`)}</div>`:d}row(s,t="",e){const a=s.depth>0?`margin-inline-start:${Math.min(s.depth,4)*14}px`:"";return i`<div class=${`row ${s.status} ${s.depth>0?"nest":""} ${t}`} style=${a} data-trace-row=${s.path}>
      <span class="st">${this.statusIcon(s)}</span>
      <div class="tx">${m(s.sentence)}${s.error?i`<div class="err">${s.error}</div>`:d}</div>
      <div class="meta">${s.time?i`<span>${s.time}</span>`:d}${s.duration?i`<span>${s.duration}</span>`:d}</div>
      <code class="path">${s.path}</code>
      ${this.vars(e??s.vars)}
    </div>`}render(){const s=this.trace;if(!s)return d;const t=W(s,{timeZone:this.timeZone}),e=K(s.at,this.now,this.timeZone).replace(/\s\d\d:\d\d$/,"");return i`
      <div class="sentence" data-trace-sentence>${o("help")}<div>${t.sentence}</div></div>
      <dl class="sum" data-trace-summary>
        <dt>${v("תוצאה")}</dt><dd>${this.resultChip(t.result.id,t.result.label)}</dd>
        <dt>${v("התחלה")}</dt><dd>${e} ${t.trigger.time??t.at}</dd>
        ${t.duration?i`<dt>${v("משך")}</dt><dd>${t.duration}</dd>`:d}
        <dt>${v("הופעלה על ידי")}</dt><dd>${t.who}</dd>
        ${this.mode?i`<dt>${v("מצב")}</dt><dd>${As[this.mode]??this.mode}</dd>`:d}
      </dl>
      <div class="sec" data-trace-trigger>
        <h5>${o("bolt")}${v("טריגר")}</h5>
        ${this.row({...t.trigger,status:"info"},"",Ds(s))}
      </div>
      <div class="sec" data-trace-conditions>
        <h5>${o("help")}${v("תנאים")}${t.counts.conditions?i`<span class="cnt">${v("עברו {done}/{total}",{done:t.counts.conditions_passed,total:t.counts.conditions})}</span>`:d}</h5>
        ${t.conditions.length?t.conditions.map(a=>this.row(a)):i`<div class="skip-note">${v("אין תנאים")}</div>`}
      </div>
      <div class="sec" data-trace-steps>
        <h5>${o("play")}${v("פעולות")}${t.counts.steps?i`<span class="cnt">${v("בוצעו {done}/{total}",{done:t.counts.steps_done,total:t.counts.steps})}</span>`:d}</h5>
        ${t.steps.length?t.steps.map(a=>this.row(a)):i`<div class="skip-note">${v("לא בוצעו פעולות")}</div>`}
      </div>`}};w.styles=[...B,I`
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
  `];R([f({attribute:!1})],w.prototype,"trace",2);R([f()],w.prototype,"mode",2);R([f({attribute:!1})],w.prototype,"now",2);R([f()],w.prototype,"timeZone",2);w=R([A("run-trace")],w);function Ds(s){return W(s).variables}var Es=Object.defineProperty,Ps=Object.getOwnPropertyDescriptor,S=(s,t,e,a)=>{for(var n=a>1?void 0:a?Ps(t,e):t,c=s.length-1,l;c>=0;c--)(l=s[c])&&(n=(a?l(t,e,n):l(n))||n);return a&&n&&Es(t,e,n),n};const D=(s,t,e)=>Math.min(e,Math.max(t,s));let x=class extends O{constructor(){super(...arguments),this.fields=[],this.values=null,this.entityChoices={},this.current={}}willUpdate(s){(s.has("fields")||s.has("values"))&&(this.current={...H(this.fields),...this.values??{}})}connectedCallback(){super.connectedCallback(),j(this)}set(s,t){this.current={...this.current,[s]:t},this.dispatchEvent(new CustomEvent("change",{detail:{values:{...this.current},valid:E(this.fields,this.current).length===0},bubbles:!0,composed:!0}))}num(s){const t=s.selector,e=t.step??1,a=typeof this.current[s.key]=="number"?this.current[s.key]:Number(t.min);return i`<div class="stepper" role="group" aria-label=${s.name}>
      <button type="button" aria-label=${v("פחות")} data-field-minus=${s.key} ?disabled=${a<=t.min} @click=${()=>this.set(s.key,D(Math.round((a-e)*1e3)/1e3,t.min,t.max))}>${o("minus")}</button>
      <input type="number" inputmode="decimal" min=${t.min} max=${t.max} step=${e} .value=${String(a)} aria-label=${s.name} data-field=${s.key} @change=${n=>{const c=Number(n.target.value);Number.isFinite(c)&&this.set(s.key,D(c,t.min,t.max))}} />
      ${t.unit?i`<small>${t.unit}</small>`:d}
      <button type="button" aria-label=${v("יותר")} data-field-plus=${s.key} ?disabled=${a>=t.max} @click=${()=>this.set(s.key,D(Math.round((a+e)*1e3)/1e3,t.min,t.max))}>${o("plus")}</button>
    </div>`}control(s){const t=s.selector,e=this.current[s.key];switch(t.kind){case"number":return this.num(s);case"boolean":return i`<sw-toggle .checked=${Ts(e===!0)} label=${s.name} labelHidden data-field=${s.key} @change=${Y(e===!0,()=>this.set(s.key,e!==!0))}></sw-toggle>`;case"select":return i`<select class="inp" aria-label=${s.name} data-field=${s.key} @change=${a=>this.set(s.key,a.target.value)}>${t.options.map(a=>i`<option value=${a} ?selected=${e===a}>${a}</option>`)}</select>`;case"text":return i`<input class="inp" type="text" maxlength=${t.max??200} .value=${typeof e=="string"?e:""} aria-label=${s.name} data-field=${s.key} @input=${a=>this.set(s.key,a.target.value)} />`;case"entity":{const a=this.entityChoices[s.key]??[],n=(Array.isArray(s.default)?s.default:s.default?[s.default]:[]).map(String),c=[...a,...n.filter(b=>!a.some(z=>z.value===b)).map(b=>({value:b,label:b.split(".").slice(1).join(".").replace(/_/g," ")}))],l=Array.isArray(e)?String(e[0]??""):String(e??"");return i`<select class="inp" aria-label=${s.name} data-field=${s.key} @change=${b=>{const z=b.target.value;this.set(s.key,Array.isArray(s.default)?[z]:z)}}>${c.map(b=>i`<option value=${b.value} ?selected=${l===b.value}>${b.label}</option>`)}</select>`}default:return d}}render(){const s=new Set(E(this.fields,this.current)),t=this.fields.filter(e=>e.selector.kind!=="locked");return t.length?i`<div class="form" data-script-form>${t.map(e=>i`<div class=${`f ${s.has(e.key)?"bad":""}`} data-field-row=${e.key}><span class="nm">${e.name}${e.required?" *":""}</span>${this.control(e)}</div>`)}</div>`:d}};x.styles=[...B,I`
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
  `];S([f({attribute:!1})],x.prototype,"fields",2);S([f({attribute:!1})],x.prototype,"values",2);S([f({attribute:!1})],x.prototype,"entityChoices",2);S([h()],x.prototype,"current",2);x=S([A("script-fields-form")],x);var q=Object.freeze,Z=Object.defineProperty,Bs=Object.getOwnPropertyDescriptor,u=(s,t,e,a)=>{for(var n=a>1?void 0:a?Bs(t,e):t,c=s.length-1,l;c>=0;c--)(l=s[c])&&(n=(a?l(t,e,n):l(n))||n);return a&&n&&Z(t,e,n),n},js=(s,t)=>q(Z(s,"raw",{value:q(s.slice())})),F;const Ms={single:r("התעלם"),restart:r("התחל מחדש"),queued:r("המתן בתור"),parallel:r("הרץ במקביל")},Ns={conditions:r("אם"),if:r("אם"),then:r("אז"),else:r("אחרת"),default:r("אחרת"),sequence:r("אז")};let p=class extends O{constructor(){super(...arguments),this.kind="automation",this.itemId="",this.open=!1,this.view="detail",this.runId="",this.trash=!1,this.status=null,this.now=new Date,this.phase="loading",this.item=null,this.errorText="",this.runs=null,this.trace=null,this.traceBusy=!1,this.traceError="",this.versions=null,this.action="",this.dry=null,this.dryBusy=!1,this.busy=!1,this.confirm=null,this.copyName="",this.restoring=null,this.conflict=null,this.values={},this.valid=!0,this.trashRows=null,this.choices={},this.loadedKey="",this.close=()=>this.fire("drawer-close")}connectedCallback(){super.connectedCallback(),j(this)}willUpdate(s){const t=`${this.open}|${this.trash}|${this.kind}|${this.itemId}`;this.open&&t!==this.loadedKey?(this.loadedKey=t,this.dry=null,this.conflict=null,this.confirm=null,this.runs=null,this.versions=null,this.trace=null,this.trash?this.loadTrash():this.itemId&&this.load()):!this.open&&this.loadedKey&&(this.loadedKey=""),this.open&&!this.trash&&(s.has("view")||s.has("runId"))&&this.item&&this.loadView()}async refresh(){if(this.trash)return this.loadTrash();this.itemId&&await this.load(!0)}async load(s=!1){s||(this.phase="loading",this.item=null);try{const t=await $().get(this.kind,this.itemId);if(this.item=t,this.phase="ready",this.errorText="",t.kind==="script"){const e=t.draft.fields;(!s||!Object.keys(this.values).length)&&(this.values=H(e)),this.valid=E(e,this.values).length===0,this.loadChoices(e.filter(a=>a.selector.kind==="entity").length>0)}this.loadRuns(),this.applyAction(),await this.loadView()}catch(t){const e=g(t);e.status===404?this.phase="missing":e.status===403?this.phase="forbidden":(this.phase="error",this.errorText=e.message)}}async loadChoices(s){if(s)try{const t=await $().catalog(),e={};for(const a of(this.item?.draft).fields){if(a.selector.kind!=="entity")continue;const n=a.selector.domains;e[a.key]=t.entities.filter(c=>!n.length||n.includes(c.domain)).map(c=>({value:c.entity_id,label:c.name}))}this.choices=e}catch{this.choices={}}}async loadRuns(){if(!(!this.item||this.item.kind==="scene"))try{this.runs=await $().runs(this.item.kind,this.item.id)}catch{this.runs=[]}}async loadView(){if(this.item){if(this.view==="dryrun"&&!this.dry&&!this.dryBusy&&this.dryRun(),this.view==="versions"&&!this.versions)try{this.versions=await $().versions(this.item.kind,this.item.id)}catch{this.versions=[]}if(this.view==="trace"){this.runs||await this.loadRuns();const s=this.runId||this.runs?.[0]?.run_id||"";if(!s){this.trace=null;return}if(this.trace?.run_id===s)return;this.traceBusy=!0,this.traceError="";try{this.trace=await $().runTrace(this.item.kind,this.item.id,s)}catch(t){this.traceError=g(t).message,this.trace=null}finally{this.traceBusy=!1}}}}async loadTrash(){this.phase="loading";try{this.trashRows=await $().trash(),this.phase="ready"}catch(s){this.errorText=g(s).message,this.phase="error"}}fire(s,t){this.isConnected&&this.dispatchEvent(new CustomEvent(s,{detail:t,bubbles:!0,composed:!0}))}say(s,t="ok",e){this.fire("result",{text:s,tone:t,action:e})}go(s,t=""){this.fire("view-change",{view:s,run:t})}failed(s){const t=g(s);return t.kind==="conflict"&&t.current&&(this.conflict=t.current),this.say(t.message,"error"),t}async run(s=!1){const t=this.item;if(!(!t||this.busy)){if(!s&&gs(t)){this.confirm="run";return}this.confirm=null,this.busy=!0;try{t.kind==="script"?await ys(t.id,this.values,{confirm:s||void 0}):await ws(t.id,{skip_condition:!0,confirm:s||void 0}),this.say(t.kind==="script"?r("הסקריפט הופעל"):r("האוטומציה הורצה")),this.fire("changed",{id:t.id}),window.setTimeout(()=>void this.load(!0),250)}catch(e){g(e).kind==="confirm"&&!s?this.confirm="run":this.failed(e)}finally{this.busy=!1}}}async stop(){const s=this.item;if(!(!s||this.busy)){this.busy=!0;try{await xs(s.id),this.say(r("הסקריפט נעצר")),this.fire("changed",{id:s.id}),await this.load(!0)}catch(t){this.failed(t)}finally{this.busy=!1}}}async dryRun(){const s=this.item;if(!(!s||this.dryBusy)){this.dry=null,this.dryBusy=!0;try{this.dry=await $().dryRun(s.kind,s.id)}catch(t){this.say(g(t).message,"error"),this.go("detail")}finally{this.dryBusy=!1}}}applyAction(){const s=this.item,t=this.action;if(!s||!t)return;const e=cs(t,s.can);e==="copy"&&(this.copyName=r("{name} (עותק)",{name:s.name})),e&&(this.confirm=e),this.fire("action-done")}async doDelete(){const s=this.item;if(!(!s||this.busy)){this.busy=!0;try{const t=await ks(s.kind,s.id,s.revision,{confirm:!0});this.confirm=null,this.fire("deleted",{trash_id:t.trash_id,name:s.name,kind:s.kind,id:s.id})}catch(t){this.confirm=null,this.failed(t)}finally{this.busy=!1}}}async doCopy(){const s=this.item,t=this.copyName.trim();if(!(!s||!t||this.busy)){this.busy=!0;try{const e=await _s(s.kind,s.id,t);this.confirm=null,e.item?this.fire("copied",{item:e.item}):this.say(r("נשמר"),"ok")}catch(e){this.confirm=null,this.failed(e)}finally{this.busy=!1}}}async doRestore(){const s=this.item,t=this.restoring;if(!(!s||!t||this.busy)){this.busy=!0;try{await $().restoreVersion(s.kind,s.id,t.version_id,{base_revision:s.revision,client_request_id:as()}),this.confirm=null,this.restoring=null,this.versions=null,this.say(r("הגרסה שוחזרה")),this.fire("changed",{id:s.id}),await this.load(!0),await this.loadView()}catch(e){this.confirm=null,this.failed(e)}finally{this.busy=!1}}}async restoreFromTrash(s){if(!this.busy){this.busy=!0;try{const t=await $().restoreTrash(s.trash_id,{client_request_id:`restore-${s.trash_id}-${Date.now()}`});this.say(r('"{name}" שוחזר',{name:s.name})),this.fire("changed",{id:t.item?.id??s.config_id}),this.trashRows=(this.trashRows??[]).filter(e=>e.trash_id!==s.trash_id)}catch(t){this.say(g(t).message,"error")}finally{this.busy=!1}}}async purge(s){if(!this.busy){this.busy=!0;try{await $().purgeTrash(s.trash_id),this.trashRows=(this.trashRows??[]).filter(t=>t.trash_id!==s.trash_id),this.say(r('"{name}" נמחק לצמיתות',{name:s.name}))}catch(t){this.say(g(t).message,"error")}finally{this.busy=!1}}}blockRow(s,t=!1,e=""){const a=s.kind==="locked",n=a&&zs(s);return i`<div class=${`blk${a?" locked":""}${t?" nested":""}`} data-block=${s.uid} data-block-kind=${s.kind}>
      <span class="bi">${o(ps(s))}</span>
      <span class="bt">${e?i`<small>${e}</small>`:d}${m(a?`${s.label}${s.sentence&&s.sentence!==s.label?` · ${s.sentence}`:""}`:s.sentence)}</span>
      ${n?i`<span class="chip warn" data-chip="schedules">${o("calendar")}${r("שולט בתזמונים")}</span>`:d}
      ${a&&s.sensitive?i`<span class="chip sens">${o("shield")}${r("רגישה")}</span>`:d}
    </div>`}nestedRows(s,t=0){if(t>=2)return[];const e=[];for(const a of Cs(s)){const n=a.name.split(".").pop()??a.name;a.blocks.forEach((c,l)=>{e.push(this.blockRow(c,!0,l===0?Ns[n]??"":"")),e.push(...this.nestedRows(c,t+1))})}return e}section(s,t,e,a){return a.length?i`<section class="sect" data-section=${s}>
      <h4><span class=${`tag t${s}`}>${o(e)}</span>${t} <span class="num">${a.length}</span></h4>
      ${a.map(n=>i`${this.blockRow(n)}${this.nestedRows(n)}`)}
    </section>`:d}banners(s){const t=[],e=Rs(s);if(this.conflict&&t.push(i`<div class="banner warn" role="alert" data-drawer-conflict>${o("warning")}<div><b>${r("הפריט שונה במקום אחר")}</b><small>${r("טענו את הגרסה העדכנית והחליטו מה לשמור.")}</small></div><button type="button" class="btn sm" data-conflict-reload @click=${()=>{this.conflict=null,this.load(!0)}}>${r("טען מחדש")}</button></div>`),e){const a=e.code==="yaml_managed"||e.code==="no_config_id";t.push(i`<div class=${`banner ${a?"warn":"info"}`} data-drawer-readonly=${e.code}>${o(a?"eye":e.code==="delegation_off"?"lock":"eye")}<div><b>${a?r("מוגדרת בקובץ תצורה"):e.text}</b>${a?i`<small>${r("לצפייה בלבד. עריכה: בתשתית המערכת.")}</small>`:d}</div></div>`)}return s.state==="invalid"&&t.push(i`<div class="banner bad" data-drawer-invalid>${o("warning")}<div><b>${r("לא פעילה – שגיאה בהגדרה")}</b>${s.warnings.find(a=>a.code==="invalid_config")?.message?i`<small>${s.warnings.find(a=>a.code==="invalid_config").message}</small>`:d}</div></div>`),s.warnings.some(a=>a.code==="changed_outside")&&t.push(i`<div class="banner info" data-drawer-outside>${o("history")}<div><b>${r("שונתה מחוץ למערכת")}</b></div><button type="button" class="btn sm" @click=${()=>this.go("versions")}>${r("גרסאות")}</button></div>`),i`${t}`}detail(s){const t=s.kind==="script",e=s.draft,a=Ss(s.draft).length,n=us(s,{sensitiveWarning:this.status?.ui.sensitive_warning!==!1}),c=s.targets.filter((l,b,z)=>z.findIndex(X=>X.entity_id===l.entity_id)===b);return i`<div class="stack" data-drawer-detail>
      ${this.banners(s)}
      ${s.sentence?i`<div class="sentence" data-drawer-sentence>${o("bolt")}<div>${s.sentence}${s.description?i`<small>${s.description}</small>`:d}</div></div>`:d}
      ${n.length||s.mode?i`<div class="chips">${s.mode?i`<span class="chip" data-chip="mode">${Ms[s.mode]}</span>`:d}${n.filter(l=>l.id!=="read_only").map(l=>i`<span class=${`chip ${l.id==="sensitive"?"sens":l.tone==="bad"?"bad":l.tone==="warn"?"warn":""}`} data-chip=${l.id}>${o(l.id==="sensitive"?"shield":l.id==="locked"?"lock":"warning")}${l.label}</span>`)}</div>`:d}
      ${t&&e.fields?.some(l=>l.selector.kind!=="locked")?i(F||(F=js(["<script-fields-form .fields="," .values="," .entityChoices="," @change=","><\/script-fields-form>"])),e.fields,this.values,this.choices,l=>{this.values=l.detail.values,this.valid=l.detail.valid}):d}
      ${t?this.section(3,r("אז"),"play",e.sequence??[]):i`${this.section(1,r("כאשר"),"bolt",e.triggers??[])}${this.section(2,r("אם"),"help",e.conditions??[])}${this.section(3,r("אז"),"play",e.actions??[])}`}
      ${a?d:i`<div class="empty-note">${r("אין פירוט להצגה")}</div>`}
      ${c.length?i`<section class="sect" data-section="devices"><h4>${o("layers")}${r("מכשירים מושפעים")} <span class="num">${c.length}</span></h4>${c.map(l=>i`<div class="dev" data-target=${l.entity_id}><span class="bi">${o(hs(l.entity_id))}</span><span class="bt">${m(l.name)}<small>${m([l.floor,l.area].filter(Boolean).join(" · "))}</small></span>${l.missing?i`<span class="chip bad">${o("warning")}${r("חסר")}</span>`:l.sensitive?i`<span class="chip sens">${o("shield")}${r("רגישה")}</span>`:d}</div>`)}</section>`:d}
      ${this.runs&&this.runs.length?i`<section class="sect" data-section="runs"><h4>${o("history")}${r("ריצות אחרונות")} <span class="num">${s.runs_7d??this.runs.length}</span></h4>
        ${N(this.runs.slice(0,3),this.now).map(l=>i`<button type="button" class="run" data-run-row=${l.run_id} @click=${()=>this.go("trace",l.run_id)}><i class=${`dot ${l.tone==="none"?"":l.tone}`}></i><span class="t">${l.label}</span><span class="s">${l.sentence}</span>${o("chevronBack")}</button>`)}</section>`:d}
    </div>`}traceView(s){const t=N(this.runs??[],this.now),e=this.runId||t[0]?.run_id||"";return i`<div class="stack" data-drawer-trace>
      ${t.length?i`<div class="runchips" role="group" aria-label=${r("ריצות")}>${t.map(a=>i`<button type="button" class="rc" aria-pressed=${String(a.run_id===e)} data-run-chip=${a.run_id} @click=${()=>this.go("trace",a.run_id)}>${a.label}<i class=${`dot ${a.tone==="none"?"":a.tone}`}></i></button>`)}</div>`:i`<div class="empty-note" data-trace-empty>${r("אין ריצות להצגה")}</div>`}
      ${this.traceBusy?i`<div class="skl-stack"><span class="skl" style="block-size:70px"></span><span class="skl" style="block-size:120px"></span><span class="skl" style="block-size:200px"></span></div>`:d}
      ${this.traceError?i`<div class="banner bad" role="alert">${o("warning")}${this.traceError}</div>`:d}
      ${this.trace&&!this.traceBusy?i`<run-trace .trace=${this.trace} .mode=${s.mode} .now=${this.now}></run-trace>`:d}
    </div>`}versionsView(s){if(!this.versions)return i`<div class="skl-stack"><span class="skl" style="block-size:84px"></span><span class="skl" style="block-size:84px"></span></div>`;const t=s.can.edit;return i`<div class="stack" data-drawer-versions>${this.versions.map(e=>i`<div class=${`ver${e.current?" cur":""}`} data-version=${e.version_id}>
      <div class="vh"><span>${e.version_id}${e.current?` · ${r("נוכחית")}`:""}</span>${e.via==="external"?i`<span class="chip warn">${o("history")}${r("מחוץ למערכת")}</span>`:d}</div>
      <div class="vs">${e.summary}</div>
      <div class="vm">${K(e.at,this.now)}${e.actor?` · ${e.actor}`:""}</div>
      ${!e.current&&t?i`<button type="button" class="btn sm" data-version-restore=${e.version_id} @click=${()=>{this.restoring=e,this.confirm="restore"}}>${o("restore")}${r("שחזר")}</button>`:d}
    </div>`)}</div>`}dryView(){if(this.dryBusy||!this.dry)return i`<div class="skl-stack"><span class="skl" style="block-size:60px"></span><span class="skl" style="block-size:60px"></span></div>`;const s=this.dry;return i`<div class="stack" data-drawer-dryrun>
      <section class="sect"><h4>${o("help")}${r("תנאים")} <span class="num">${s.conditions.length}</span></h4>
        ${s.conditions.length?s.conditions.map(t=>i`<div class="dry-row"><span class=${`st ${t.passed===!0?"ok":t.passed===!1?"bad":""}`}>${o(t.passed===!0?"check":t.passed===!1?"close":"minus")}</span><span>${m(t.sentence)}</span>${t.passed===null?i`<span class="arrow">${r("לא ניתן לבדוק")}</span>`:d}</div>`):i`<div class="empty-note">${r("אין תנאים")}</div>`}</section>
      <section class="sect"><h4>${o("layers")}${r("מה ישתנה")} <span class="num">${s.effects.entities.length}</span></h4>
        ${s.effects.entities.length?s.effects.entities.map(t=>i`<div class="dry-row"><span class="bt">${m(t.name)}</span><span class="arrow">${r("{from} ← {to}",{from:t.from??"—",to:t.to??"—"})}</span></div>`):i`<div class="empty-note">${r("אין שינוי במכשירים")}</div>`}
        ${s.effects.unknown?i`<div class="banner info">${o("info")}${r("יש פעולה מתקדמת שהשפעתה אינה ידועה")}</div>`:d}</section>
    </div>`}trashView(){return this.phase==="error"?i`<div class="center" data-drawer-state="error">${o("warning",30)}<b>${this.errorText}</b><button type="button" class="btn sm" @click=${()=>void this.loadTrash()}>${o("refresh")}${r("נסו שוב")}</button></div>`:this.trashRows===null||this.phase==="loading"?i`<div class="skl-stack"><span class="skl" style="block-size:84px"></span><span class="skl" style="block-size:84px"></span></div>`:this.trashRows.length?i`<div class="stack" data-drawer-trash>${this.trashRows.map(s=>{const t=vs(s.expires_at,this.now);return i`<div class="tr" data-trash=${s.trash_id}>
        <span class="bi">${o(s.kind==="script"?"script":s.kind==="scene"?"sparkle":"bolt")}</span>
        <b>${m(s.name)} ${s.sensitive?i`<span class="chip sens">${o("shield")}${r("רגישה")}</span>`:d}</b>
        <small>${s.sentence}</small>
        <small>${fs(s.deleted_at,this.now)}${s.deleted_by?` · ${s.deleted_by}`:""} · <span class=${t.urgent?"urgent":""}>${t.text}</span></small>
        <span class="trbtns">${s.can_restore?i`<button type="button" class="btn sm" data-trash-restore=${s.trash_id} ?disabled=${this.busy} @click=${()=>void this.restoreFromTrash(s)}>${o("restore")}${r("שחזר")}</button>`:d}${this.status?.can.manage&&this.status?.can.configure?i`<button type="button" class="btn sm quiet dz" data-trash-purge=${s.trash_id} aria-label=${`${r("מחיקה לצמיתות")} · ${s.name}`} ?disabled=${this.busy} @click=${()=>void this.purge(s)}>${o("trash")}</button>`:d}</span>
      </div>`})}</div>`:i`<div class="center" data-drawer-state="trash-empty">${o("trash",30)}<b>${r("סל המחזור ריק")}</b></div>`}stateBox(){return this.phase==="loading"?i`<div class="skl-stack" data-drawer-state="loading" aria-busy="true"><span class="skl" style="block-size:96px"></span><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:52px"></span></div>`:this.phase==="missing"?i`<div class="center" data-drawer-state="missing">${o("search",30)}<b>${r("הפריט לא נמצא")}</b></div>`:this.phase==="forbidden"?i`<div class="center" data-drawer-state="forbidden">${o("lock",30)}<b>${r("אין הרשאה")}</b></div>`:this.phase==="error"?i`<div class="center" data-drawer-state="error">${o("warning",30)}<b>${this.errorText||r("לא ניתן לטעון")}</b><button type="button" class="btn sm" @click=${()=>void this.load()}>${o("refresh")}${r("נסו שוב")}</button></div>`:null}footer(s){const t=this.view;if(t==="trace")return i`<div class="foot2" slot="footer"><button type="button" class="btn" @click=${this.close}>${r("סגירה")}</button>${s.can.run?i`<button type="button" class="btn" data-drawer-run ?disabled=${this.busy} @click=${()=>void this.run()}>${o("play")}${r("הרץ שוב")}</button>`:d}<button type="button" class="btn" data-drawer-back-detail @click=${()=>this.go("detail")}>${o("eye")}${r("לאוטומציה")}</button></div>`;if(t==="versions"||t==="dryrun")return i`<div class="foot2" slot="footer"><button type="button" class="btn" @click=${()=>this.go("detail")}>${r("סגירה")}</button></div>`;const e=s.state==="running",a=s.kind==="script",n=s.can.edit?i`<button type="button" class=${`btn${a?"":" primary"}`} data-drawer-edit @click=${()=>this.fire("edit",{kind:s.kind,id:s.id})}>${o("edit")}${r("עריכה")}</button>`:d,c=e&&a?i`<button type="button" class="btn danger" data-drawer-stop ?disabled=${this.busy} @click=${()=>void this.stop()}>${o("stop")}${r("עצור")}</button>`:s.can.run?i`<button type="button" class=${`btn${a?" primary":""}`} data-drawer-run ?disabled=${this.busy||a&&!this.valid} @click=${()=>void this.run()}>${o("play")}${a?r("הפעל"):r("הרץ עכשיו")}</button>`:d;return i`<div class="foot2" slot="footer">
      ${a?i`${c}${n}`:i`${n}${c}`}
      ${a?d:i`<button type="button" class="btn" data-drawer-dry @click=${()=>this.go("dryrun")}>${o("flask")}${r("בדיקה")}</button>`}
      ${s.last_run&&!a?i`<button type="button" class="btn" data-drawer-why @click=${()=>this.go("trace")}>${o("help")}${r("למה זה רץ")}</button>`:d}
      ${s.source==="ui"?i`<button type="button" class="btn quiet" data-drawer-versions @click=${()=>this.go("versions")}>${o("history")}${r("גרסאות")}</button>`:d}
      ${s.can.copy?i`<button type="button" class="btn quiet" data-drawer-copy @click=${()=>{this.copyName=r("{name} (עותק)",{name:s.name}),this.confirm="copy"}}>${o("copy")}${r("שכפול")}</button>`:d}
      ${s.can.delete?i`<button type="button" class="btn quiet dz" data-drawer-delete @click=${()=>this.confirm="delete"}>${o("trash")}${r("מחיקה")}</button>`:d}
    </div>`}dialogs(s){const t=this.confirm;if(!t||!s)return d;if(t==="run"){const e=bs(s);return i`<sw-dialog open heading=${s.kind==="script"?r("להפעיל עכשיו?"):r("להריץ עכשיו?")} data-dialog="run" @close=${()=>this.confirm=null}>
        <div class="dlgform">${e?i`<p>${e}</p>`:d}<div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>${r("ביטול")}</button><button type="button" class="btn primary" data-dialog-ok @click=${()=>void this.run(!0)}>${s.kind==="script"?r("הפעל"):r("הרץ")}</button></div></div></sw-dialog>`}return t==="delete"?i`<sw-dialog open heading=${r('למחוק את "{name}"?',{name:s.name})} data-dialog="delete" @close=${()=>this.confirm=null}>
        <div class="dlgform"><p>${r("הפריט יישמר בסל המחזור וניתן לשחזר אותו.")}</p><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>${r("ביטול")}</button><button type="button" class="btn danger" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.doDelete()}>${r("מחיקה")}</button></div></div></sw-dialog>`:t==="copy"?i`<sw-dialog open heading=${r("שכפול")} data-dialog="copy" @close=${()=>this.confirm=null}>
        <div class="dlgform"><label class="fld">${r("שם")}<input class="inp" type="text" maxlength="120" .value=${this.copyName} data-copy-name @input=${e=>this.copyName=e.target.value} /></label><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>${r("ביטול")}</button><button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy||!this.copyName.trim()} @click=${()=>void this.doCopy()}>${r("שכפול")}</button></div></div></sw-dialog>`:i`<sw-dialog open heading=${r("לשחזר את {version}?",{version:this.restoring?.version_id??""})} data-dialog="restore" @close=${()=>this.confirm=null}>
      <div class="dlgform"><p>${this.restoring?.summary??""}</p><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.confirm=null}>${r("ביטול")}</button><button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.doRestore()}>${r("שחזר")}</button></div></div></sw-dialog>`}render(){if(this.trash)return i`<sw-drawer modal .open=${this.open} heading=${r("סל המחזור")} @close=${this.close}>${this.trashView()}<div class="foot2" slot="footer"><button type="button" class="btn" @click=${this.close}>${r("סגירה")}</button></div></sw-drawer>`;const s=this.item,t=this.view,e=s?t==="trace"?r("למה זה רץ"):t==="versions"?r("גרסאות"):t==="dryrun"?r("בדיקה"):m(s.name):"",a=s?t==="detail"?[ms(s),$s(s)].filter(Boolean).join(" · "):m(s.name):"",n=this.stateBox();return i`<sw-drawer modal .open=${this.open} heading=${e} subheading=${a} @close=${this.close}>
      ${t!=="detail"&&s?i`<button slot="action" type="button" class="rb sm" aria-label=${is("actions.back")} data-drawer-back @click=${()=>this.go("detail")}>${o("chevron")}</button>`:d}
      ${n??(s?t==="trace"?this.traceView(s):t==="versions"?this.versionsView(s):t==="dryrun"?this.dryView():this.detail(s):d)}
      ${s&&!n?this.footer(s):d}
      ${this.dialogs(s)}
    </sw-drawer>`}};p.styles=[...B,I`
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
      font-weight: var(--sw-fw-semibold);
    }
    .dev .bt small {
      display: block;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
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
      font-weight: var(--sw-fw-semibold);
      color: var(--dv-text);
    }
    /* AUDIT30-I2 (#4, owner Q3 option a): the chosen chip is the product's Blue Wash pair, never a solid text-colour block */
    .rc[aria-pressed='true'] {
      ${ss}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .rc[aria-pressed='true']::before {
      ${ts}
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
      font-weight: var(--sw-fw-bold);
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
      font-weight: var(--sw-fw-semibold);
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
    ${es}
    .foot2 {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `];u([f()],p.prototype,"kind",2);u([f()],p.prototype,"itemId",2);u([f({type:Boolean})],p.prototype,"open",2);u([f()],p.prototype,"view",2);u([f()],p.prototype,"runId",2);u([f({type:Boolean})],p.prototype,"trash",2);u([f({attribute:!1})],p.prototype,"status",2);u([f({attribute:!1})],p.prototype,"now",2);u([h()],p.prototype,"phase",2);u([h()],p.prototype,"item",2);u([h()],p.prototype,"errorText",2);u([h()],p.prototype,"runs",2);u([h()],p.prototype,"trace",2);u([h()],p.prototype,"traceBusy",2);u([h()],p.prototype,"traceError",2);u([h()],p.prototype,"versions",2);u([f()],p.prototype,"action",2);u([h()],p.prototype,"dry",2);u([h()],p.prototype,"dryBusy",2);u([h()],p.prototype,"busy",2);u([h()],p.prototype,"confirm",2);u([h()],p.prototype,"copyName",2);u([h()],p.prototype,"restoring",2);u([h()],p.prototype,"conflict",2);u([h()],p.prototype,"values",2);u([h()],p.prototype,"valid",2);u([h()],p.prototype,"trashRows",2);u([h()],p.prototype,"choices",2);p=u([A("automation-drawer")],p);const M={tab:"תרחישים",title:"תרחישים חוצי מודולים",new:"תרחיש חדש",empty:"אין עדיין תרחישים",disabled:"התרחישים כבויים",noPermission:"אין הרשאה לצפות בתרחישים",loadError:"לא ניתן לטעון את התרחישים",retry:"נסו שוב",settingsLink:"הגדרות התרחישים",killOn:"עצירת חירום פעילה: אף פעולה לא מתבצעת",stateOff:"כבוי",stateOk:"פעיל",stateActive:"הופעל",stateDegraded:"פגום",stateSuppressed:"נעצר",firesToday:"{n} הפעלות היום",lastFire:"הופעל לאחרונה {t}",never:"עוד לא הופעל",owner:"כותב: {n}",page:"עמוד {a} מתוך {b}",prev:"הקודם",next:"הבא",name:"שם",description:"תיאור",when:"כאשר",then:"אז",and:"וגם",or:"או",not:"לא",addCondition:"תנאי",addGroup:"קבוצה",remove:"הסרה",signal:"אות",subject:"נושא",value:"ערך",holdFor:"רציף (שנ׳)",debounce:"יציבות (שנ׳)",margin:"שוליים לשחרור",days:"ימים",from:"מ",to:"עד",dayNames:"ב,ג,ד,ה,ו,ש,א",actNotify:"הודעה",actTicket:"בקשת שירות",actFlag:"סימון",recipientsRoles:"תפקידים",recipientsUsers:"משתמשים",recipientsDefault:"ריק = הנמענים שבהגדרות",recipientsPick:"בחירת נמענים",search:"חיפוש",departmentPick:"בחירת מחלקה",department:"מחלקה",ticketTitle:"כותרת הבקשה",flagName:"שם הסימון",flagValue:"ערך",options:"אפשרויות",cooldown:"המתנה בין הפעלות (שנ׳)",clearAfter:"סיום אחרי (שנ׳)",forS:"משך מינימלי של כל התנאים (שנ׳)",onUnknown:"כשחיישן לא מדווח",onUnknownHold:"להמתין ואז לסמן פגום",onUnknownFalse:"להתייחס כ״לא מתקיים״",grace:"זמן המתנה (שנ׳)",maxFires:"מקסימום הפעלות ביום (ריק = ברירת המחדל)",maxTickets:"מקסימום בקשות ביום (ריק = ברירת המחדל)",test:"הרצה יבשה",simulate:"הדמיה",simulateHint:"ערך לבדיקה",save:"שמירה",cancel:"ביטול",enable:"הפעלה",disable:"כיבוי",delete:"מחיקה",confirmDelete:"למחוק את התרחיש?",enableConfirm:"התרחיש פותח בקשות שירות. לאשר את המחלקה ואת מגבלת {n} בקשות ביום?",confirm:"אישור",testFirst:"יש להריץ הרצה יבשה לפני ההפעלה",wouldFire:"היה מופעל עכשיו",wouldNot:"לא היה מופעל עכשיו",unknownResult:"לא ניתן להעריך עכשיו (חיישן לא מדווח)",actionOff:"הפעולה כבויה בהגדרות",ticketsOff:"מודול בקשות השירות כבוי",runs:"היסטוריה",noRuns:"אין עדיין הרצות",redacted:"אין הרשאה להצגת הנתון",saved:"נשמר",enabled:"התרחיש הופעל",disabledNote:"התרחיש כובה",deleted:"התרחיש נמחק",conflict:"התרחיש השתנה בינתיים. רעננו ונסו שוב.",hintHaOnly:"כלל שמבוסס רק על התקנים מתאים לאוטומציה רגילה או לתבנית.",doorWall:"תרחיש אינו מפעיל דלתות, מנעולים, אזעקות או התקנים.",tru:"מתקיים",fls:"לא מתקיים",unk:"לא ידוע",setTitle:"תרחישים חוצי מודולים",setEnabled:"הפעלת התרחישים",setKill:"עצירת חירום של כל הפעולות",setActNotify:"פעולת הודעה",setActTicket:"פעולת בקשת שירות",setActFlag:"פעולת סימון",setMaxFires:"הפעלות ביום לכל תרחיש (ברירת מחדל)",setMaxTickets:"בקשות שירות ביום לכל תרחיש (ברירת מחדל)",setMaxHour:"פעולות לשעה בכל המערכת",setMaxRules:"מספר תרחישים מרבי",setTick:"בדיקה כל (שנ׳)",setTestPerMin:"הרצות יבשות לדקה",setKeep:"שמירת היסטוריה (ימים)",setDegraded:"הודעה כשתרחיש לא ניתן להעריך",setAfterSource:"מקור שעות הפעילות",setAfterWindow:"חלון קבוע",setAfterCalendar:"לוח העבודה של בקשות השירות",setWindow:"שעות פעילות",setRecipients:"נמענים כברירת מחדל",setSave:"שמירת ההגדרות",setSaved:"ההגדרות נשמרו",setInvalid:"ערך לא תקין"},G=ns("en","i18n/scenarios","en");function qs(){return os(["en"])}const Fs={he:M,en:G};function y(s,t,e=qs()){const a=Fs[e][s]??M[s]??s;return rs(a,t)}ls("i18n/scenarios",{he:M,en:G});const Ys=()=>_("scenarios/status"),st=()=>_("scenarios/signals"),tt=()=>_("scenarios"),et=s=>_(`scenarios/${encodeURIComponent(s)}`),at=(s,t,e)=>C("scenarios",{name:s,description:t,definition:e}),it=(s,t,e,a,n)=>V(`scenarios/${encodeURIComponent(s)}`,{version:t,name:e,description:a,definition:n}),rt=s=>ds(`scenarios/${encodeURIComponent(s)}`),nt=(s,t,e=!1)=>C(`scenarios/${encodeURIComponent(s)}/enable`,{version:t,confirm:e}),ot=(s,t)=>C(`scenarios/${encodeURIComponent(s)}/disable`,{version:t}),lt=(s,t)=>C(`scenarios/${encodeURIComponent(s)}/test`,{overrides:t??null}),dt=(s,t)=>C("scenarios/simulate",{definition:s,overrides:t??null}),ct=s=>_(`scenarios/${encodeURIComponent(s)}/runs`),pt=()=>_("scenarios/choices"),ut=()=>_("scenarios/settings"),ht=s=>V("scenarios/settings",{changes:s,confirmed:!0}),Q=s=>"op"in s&&(s.op==="and"||s.op==="or"),J=s=>"op"in s&&s.op==="not",vt=s=>"redacted"in s,Ls=s=>"signal"in s;function P(s,t="when"){return Q(s)?s.items.flatMap((e,a)=>P(e,`${t}.items[${a}]`)):J(s)?P(s.item,`${t}.item`):Ls(s)?[{path:t,leaf:s}]:[]}function Us(s){return s==="bool"?["is_true","is_false"]:s==="enum"?["eq","ne","in_set"]:s==="count"?["gt","ge","lt","le","eq","ne"]:["gt","ge","lt","le","between","outside"]}function ft(s){const t={signal:s.id,cmp:Us(s.kind)[0]};return s.subject==="window"?t.window={days:[0,1,2,3,4,5,6],from:"18:00",to:"07:00"}:s.subject!=="none"&&(t.subject=s.subjects[0]?.id??""),s.kind==="number"&&(t.value=s.range?Math.min(Math.max(8,s.range[0]),s.range[1]):0),s.kind==="count"&&(t.value=1),t}function bt(s,t){const e=[];let a=0;const n=(c,l)=>{a=Math.max(a,l),Q(c)?(c.items.length||e.push("empty_group"),c.items.forEach(b=>n(b,l+1))):J(c)&&n(c.item,l+1)};return n(s.when,0),a>t.depth&&e.push("too_deep"),P(s.when).length>t.leaves&&e.push("too_many_leaves"),s.actions.length||e.push("no_actions"),s.actions.length>t.actions&&e.push("too_many_actions"),e}const mt=s=>s==="active"?"warn":s==="degraded"||s==="suppressed"?"bad":s==="ok"?"ok":"off";function L(s,t,e){return e?s.includes(t)?[...s]:[...s,t]:s.filter(a=>a!==t)}function U(s,t,e=40){const a=t.trim().toLowerCase();return(a?s.filter(n=>n.name.toLowerCase().includes(a)):[...s]).slice(0,e)}var Vs=Object.defineProperty,Ks=Object.getOwnPropertyDescriptor,T=(s,t,e,a)=>{for(var n=a>1?void 0:a?Ks(t,e):t,c=s.length-1,l;c>=0;c--)(l=s[c])&&(n=(a?l(t,e,n):l(n))||n);return a&&n&&Vs(t,e,n),n};let k=class extends O{constructor(){super(...arguments),this.choices=null,this.value={users:[],roles:[]},this.open=!1,this.q=""}emit(s){this.value=s,this.dispatchEvent(new CustomEvent("change",{detail:{value:s},bubbles:!0,composed:!0}))}nameOf(s,t){return this.choices?.[s].find(e=>e.id===t)?.name??t}render(){const s={users:this.value.users??[],roles:this.value.roles??[]},t=[...s.roles.map(e=>["roles",e]),...s.users.map(e=>["users",e])];return i`<div class="box" data-recipients>
      ${t.length?t.map(([e,a])=>i`<span class="chip" data-chip=${`${e}:${a}`}>${m(this.nameOf(e,a))}<button type="button" aria-label=${y("remove")} @click=${()=>this.emit({...s,[e]:s[e].filter(n=>n!==a)})}>×</button></span>`):i`<span class="hint">${y("recipientsDefault")}</span>`}
      <button type="button" class="add" data-recipients-open aria-expanded=${String(this.open)} @click=${()=>this.open=!this.open}>+ ${y("recipientsPick")}</button>
    </div>
    ${this.open&&this.choices?i`<div class="pop" role="dialog" aria-label=${y("recipientsPick")} @keydown=${e=>{e.key==="Escape"&&(this.open=!1)}}>
      <input type="search" placeholder=${y("search")} .value=${this.q} @input=${e=>this.q=e.target.value} />
      <div class="sect">${y("recipientsRoles")}</div>
      ${U(this.choices.roles,this.q).map(e=>i`<label><input type="checkbox" data-pick-role=${e.id} .checked=${s.roles.includes(e.id)} @change=${a=>this.emit({...s,roles:L(s.roles,e.id,a.target.checked)})} />${m(e.name)}</label>`)}
      <div class="sect">${y("recipientsUsers")}</div>
      ${U(this.choices.users,this.q).map(e=>i`<label><input type="checkbox" data-pick-user=${e.id} .checked=${s.users.includes(e.id)} @change=${a=>this.emit({...s,users:L(s.users,e.id,a.target.checked)})} />${m(e.name)}</label>`)}
    </div>`:d}`}};k.styles=I`
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
  `;T([f({attribute:!1})],k.prototype,"choices",2);T([f({attribute:!1})],k.prototype,"value",2);T([h()],k.prototype,"open",2);T([h()],k.prototype,"q",2);k=T([A("scenario-recipients")],k);export{ht as a,y as b,st as c,et as d,Us as e,vt as f,ut as g,Ls as h,Q as i,J as j,dt as k,tt as l,bt as m,ft as n,at as o,nt as p,ot as q,rt as r,pt as s,lt as t,it as u,ct as v,mt as w,P as x,Ys as y};
