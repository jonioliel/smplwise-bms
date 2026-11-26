const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{bf as R,E as B,bv as N,cK as r,b3 as M,g as S,y as G,j as p,i as E,aW as L,o as z,p9 as K,A as c,b as o,eE as C,pa as P,pb as W,pc as X,pd as q,k as j,pe as V,br as J,bt as Q,bq as Y,bs as Z,bx as ee,pf as se,a as I,pg as te,ph as ae,e1 as re}from"./index-CqeTnh_F.js";import{_ as ie}from"./sw-logo-art-PLtEZJxU.js";import{d as ne,e as oe,a as h}from"./camera-image-health-4Jk6XZnM.js";import{c as le}from"./confirm-dialog-7b3F9Uvs.js";import{T as ce}from"./toast-controller-BPX0Tkjm.js";const de=()=>R("recorder-health"),pe=()=>B("recorder-health/check"),he=()=>R("recorder-health/settings"),ue=e=>N("recorder-health/settings",e);var fe=Object.defineProperty,we=Object.getOwnPropertyDescriptor,k=(e,s,n,t)=>{for(var a=t>1?void 0:t?we(s,n):s,i=e.length-1,l;i>=0;i--)(l=e[i])&&(a=(t?l(s,n,a):l(a))||a);return t&&a&&fe(s,n,a),a};const me={ok:"live",warn:"stale",error:"offline",unknown:"unknown",off:"neutral"},be={ok:r("תקין"),warn:r("לתשומת לב"),error:r("תקלה"),unknown:r("לא ידוע"),off:""},ve=[{key:"recording_gap_min",label:r("מצלמה לא מקליטה"),unit:r("דקות")},{key:"clock_drift_s",label:r("סטיית שעון"),unit:r("שניות")},{key:"latency_ms",label:r("תגובה איטית"),unit:r("מ״ש")},{key:"disk_fill_days",label:r("דיסק יתמלא בתוך"),unit:r("ימים")},{key:"cert_days",label:r("תעודה פגה בתוך"),unit:r("ימים")},{key:"recover_s",label:r("זמן עד סגירת התראה"),unit:r("שניות")},{key:"interval_s",label:r("בדיקה כל"),unit:r("שניות")}],T=e=>(e??[]).slice(0,2).map(s=>s.name).join(", ")+((e?.length??0)>2?` +${(e?.length??0)-2}`:"");let v=class extends E{constructor(){super(...arguments),this.skin=new L(this),this.manage=!1,this.cards=null,this.frigate={},this.error="",this.busy=!1,this.th=null,this.draft={},this.saveMsg=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=await de();this.cards=e.recorders,this.loadFrigate(e.recorders),this.error="",this.manage&&e.can_manage&&!this.th&&(this.th=await he())}catch(e){this.error=z(e)}}async loadFrigate(e){const s={};await Promise.all(e.filter(n=>n.vendor==="frigate"&&n.vendor_details).map(async n=>{const t=n.disks?.free_pct??null;s[n.id]=await K(n.id,n.vendor_details,t).catch(()=>null)})),this.frigate=s}async check(){this.busy=!0;try{this.cards=(await pe()).recorders,this.loadFrigate(this.cards)}catch(e){this.error=z(e)}finally{this.busy=!1}}async save(){if(Object.keys(this.draft).length){this.busy=!0,this.saveMsg=null;try{this.th=await ue(this.draft),this.draft={},this.saveMsg={tone:"ok",text:r("נשמר")}}catch(e){this.saveMsg={tone:"err",text:z(e)}}finally{this.busy=!1}}}row(e,s,n,t){return!n||n.state==="off"?c:o`<div class="r" data-rh-row=${e}><span class="k">${s}</span><span class="v"><span>${t}</span><i class="dot" data-s=${n.state}></i></span></div>`}card(e){const s=e.api,n=s.state==="unknown"?r("טרם נבדק"):s.state==="error"?String(s.text??r("אין תשובה")):r("{n} מ״ש",{n:s.latency_ms??"—"}),t=e.disks,a=t?.items?.find(A=>!["ok","formatting","unknown"].includes(A.state)),i=!t||t.state==="unknown"?r("לא ידוע"):a?a.state==="missing"?r("אין דיסק"):r("דיסק {ref}: {text}",{ref:a.ref,text:a.text}):t.alarms?.length?r("תקלת דיסק"):t.fill_days!=null&&t.state==="warn"?r("יתמלא בעוד {n} ימים",{n:t.fill_days}):t.full?r("מלא"):t.free_pct!=null?r("{n}% פנוי",{n:t.free_pct}):r("תקין"),l=e.recording,m=!l||l.state==="unknown"?r("לא ידוע"):l.exception?.length?r("תקלה: {names}",{names:T(l.exception)}):l.stopped?.length?r("לא מקליטות: {names}",{names:T(l.stopped)}):`${l.recording??0}/${l.watched??0}`,$=e.channels,u=!$||$.state==="unknown"?r("לא ידוע"):$.disconnected?.length?r("מנותקות: {names}",{names:T($.disconnected)}):`${$.connected??0}/${$.total??0}`,g=e.clock,b=g?.drift_s==null?null:Math.round(g.drift_s),f=b==null?r("לא ידוע"):b===0?r("מדויק"):b>0?r("מקדים {n} שנ׳",{n:Math.abs(b)}):r("מאחר {n} שנ׳",{n:Math.abs(b)}),y=e.certificate,U=!y||y.days_left==null?"":y.days_left<=0?r("פגה"):r("עוד {n} ימים",{n:y.days_left});return o`<div class="card" data-rh-card=${e.id} data-status=${e.status}>
      <div class="hh"><span class="nm">${e.name}</span><sw-badge kind=${me[e.status]} label=${be[e.status]}></sw-badge></div>
      ${this.row("api",r("חיבור"),s,n)}
      ${s.state==="error"&&s.action?o`<div class="fix" data-rh-fix role="note">${s.action}</div>`:c}
      ${this.row("disks",r("דיסקים"),t,i)}
      ${this.row("recording",r("הקלטה"),l,m)}
      ${this.row("channels",r("מצלמות"),$,u)}
      ${this.row("clock",r("שעון"),g,f)}
      ${y?this.row("certificate",r("תעודה"),y,U):c}
      ${this.frigate[e.id]?this.frigateRows(this.frigate[e.id]):c}
    </div>`}frigateRows(e){const s=C.frigate.health,n=e.detectors.length?e.detectors.map(i=>`${i.name}${i.inference_ms!=null?` · ${Math.round(i.inference_ms)} ${s.inference}`:""}${P(i)?` · ${s.overloaded}`:""}`).join(", "):C.frigate.summary.noDetectors,t=e.detectors.some(P)?"warn":e.detectors.length?"ok":"unknown",a=W(e.storage);return o`${this.row("frigate-detectors",s.detectors,{state:t},n)}
      ${a?this.row("frigate-hours-left",s.storageLeft,{state:X(e.storage)},a):c}
      ${e.partial_coverage?o`<div class="r wrap" data-rh-row="frigate-partial"><span class="k">${s.partial}</span><span class="v"><i class="dot" data-s="warn"></i></span></div>`:c}
      ${e.cameras.length?o`<details class="fcams" data-rh-frigate-cameras open>
        <summary>${s.cameras} (${e.cameras.filter(i=>i.state==="ok").length}/${e.cameras.length})</summary>
        ${e.cameras.map(i=>o`<div class="r" data-rh-frigate-camera=${i.id} data-camera-state=${i.state}><span class="k nm2">${i.name}</span><span class="v"><span>${q(i)}${i.state==="ok"&&(i.reconnects_last_hour??0)>0?` · ${i.reconnects_last_hour} ${s.reconnects}`:""}</span><i class="dot" data-s=${i.state==="ok"?(i.stalls_last_hour??0)>0?"warn":"ok":i.state==="off"?"unknown":"error"}></i></span></div>`)}
      </details>`:c}`}thresholds(){if(!this.manage||!this.th)return c;const e={...this.th.values,...this.draft},s=e.continuous_recorders??[],n=(this.cards??[]).filter(a=>a.detail_supported),t=(a,i)=>{this.draft={...this.draft,[a]:i},this.saveMsg=null};return o`<sw-card heading=${r("ספי התראה למקליטים")} data-rh-settings>
      ${n.length?o`<div class="cont" data-rh-continuous>
        <span class="cont-h">${r("הקלטה רציפה")}</span>
        ${n.map(a=>{const i=s.includes(a.id);return o`<button type="button" class="chk" data-rh-continuous-id=${a.id} aria-pressed=${i?"true":"false"}
            @click=${()=>t("continuous_recorders",i?s.filter(l=>l!==a.id):[...s,a.id])}><i class="box" aria-hidden="true">${i?"✓":""}</i><span>${a.name}</span></button>`})}
      </div>`:c}
      ${this.perCamera(n,e,t)}
      <div class="ths">
        ${ve.map(a=>{const i=this.th.ranges[a.key];return o`<sw-field label=${`${a.label} (${a.unit})`}><input class="ltr" data-rh-field=${a.key} type="number" inputmode="numeric" min=${i?.min??0} max=${i?.max??99999} .value=${String(e[a.key])}
            @input=${l=>{const m=Number(l.target.value);Number.isInteger(m)&&t(a.key,m)}} /></sw-field>`})}
      </div>
      <div class="actions">
        <sw-button size="sm" variant="primary" data-rh-save ?disabled=${this.busy||!Object.keys(this.draft).length} @click=${()=>this.save()}>${r("שמירה")}</sw-button>
        ${this.saveMsg?o`<span class=${this.saveMsg.tone} data-rh-save-msg role="status">${this.saveMsg.text}</span>`:c}
      </div>
    </sw-card>`}perCamera(e,s,n){const t=new Set(e.map(u=>u.id)),a=(this.th?.cameras??[]).filter(u=>t.has(u.recorder_id));if(!a.length)return c;const i=s.camera_recording??{},l=s.continuous_recorders??[],m=a.filter(u=>i[u.id]).length,$=(u,g)=>{const b={...i};g==="continuous"||g==="events"?b[u]=g:delete b[u],n("camera_recording",b)};return o`<details class="percam" data-rh-cameras>
      <summary>${r("לפי מצלמה")}${m?o` <span class="n" data-rh-cameras-changed>(${m})</span>`:c}</summary>
      ${e.map(u=>{const g=a.filter(f=>f.recorder_id===u.id);if(!g.length)return c;const b=l.includes(u.id)?r("כמו המקליט (רציפה)"):r("כמו המקליט (לא רציפה)");return o`<div class="pc-h">${u.name}</div>
          <div class="pc-list">${g.map(f=>o`<label class="pc-row"><span>${f.name}</span>
            <select data-rh-camera-id=${f.id} aria-label=${f.name} .value=${i[f.id]??""} @change=${y=>$(f.id,y.target.value)}>
              <option value="" ?selected=${!i[f.id]}>${b}</option>
              <option value="continuous" ?selected=${i[f.id]==="continuous"}>${r("רציפה")}</option>
              <option value="events" ?selected=${i[f.id]==="events"}>${r("לא רציפה")}</option>
            </select></label>`)}</div>`})}
    </details>`}render(){return this.error&&!this.cards?o`<sw-card heading=${r("מקליטים")}><sw-state-panel compact state="error" heading=${r("המקליטים לא נבדקו")} hint=${this.error} actionLabel=${r("נסה שוב")} data-rh-error @action=${()=>this.load()}></sw-state-panel></sw-card>`:this.cards?this.cards.length?o`<sw-card heading=${r("מקליטים")} data-rh-panel data-state="ready">
        ${this.manage?o`<div class="bar"><sw-button size="sm" icon="refresh" data-rh-check ?disabled=${this.busy} @click=${()=>this.check()}>${r("בדוק עכשיו")}</sw-button></div>`:c}
        <div class="grid">${this.cards.map(e=>this.card(e))}</div>
        ${this.error?o`<div class="err" role="alert">${this.error}</div>`:c}
      </sw-card>
      ${this.thresholds()}`:c:o`<sw-card heading=${r("מקליטים")}><sw-state-panel compact state="loading" heading=${r("קורא…")} data-rh-loading></sw-state-panel></sw-card>`}};v.styles=S`
    :host {
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
      gap: 10px;
    }
    /* one recorder per card: the status badge in the head, a tone bar at the start edge and a faint wash when something needs attention */
    .card {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      background: var(--sw-glass-sheen), var(--sw-surface);
      -webkit-backdrop-filter: var(--sw-glass-blur);
      backdrop-filter: var(--sw-glass-blur);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
      position: relative;
      overflow: hidden;
      transition: border-color var(--sw-t-state) var(--sw-ease), background var(--sw-t-state) var(--sw-ease);
    }
    .card::before {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: 4px;
      background: var(--sw-live);
    }
    .card[data-status='unknown']::before,
    .card[data-status='off']::before {
      background: var(--sw-unknown);
    }
    .card[data-status='error'] {
      border-color: color-mix(in srgb, var(--sw-danger) 55%, var(--sw-border));
      background: var(--sw-glass-sheen), color-mix(in srgb, var(--sw-danger) 5%, var(--sw-surface));
    }
    .card[data-status='error']::before {
      background: var(--sw-danger);
    }
    .card[data-status='warn'] {
      border-color: color-mix(in srgb, var(--sw-stale) 55%, var(--sw-border));
      background: var(--sw-glass-sheen), color-mix(in srgb, var(--sw-stale) 5%, var(--sw-surface));
    }
    .card[data-status='warn']::before {
      background: var(--sw-stale);
    }
    .hh {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .hh .nm {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .r {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 5px 0;
      border-block-start: 1px solid var(--sw-border);
      font-size: var(--sw-fs-xs);
      min-inline-size: 0;
    }
    .r .k {
      color: var(--sw-text-2);
      flex-shrink: 0;
    }
    .r .v span {
      font-variant-numeric: tabular-nums;
    }
    .r:has(.dot[data-s='error']) .v span {
      color: var(--sw-danger-text);
      font-weight: var(--sw-fw-medium);
    }
    .r:has(.dot[data-s='warn']) .v span {
      color: var(--sw-warning-text);
      font-weight: var(--sw-fw-medium);
    }
    .r .k.nm2 {
      flex-shrink: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .r.wrap .k {
      flex-shrink: 1;
    }
    .fcams > summary {
      cursor: pointer;
      padding-block: 6px 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-block-size: 24px;
    }
    .r .v {
      display: flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
      text-align: end;
    }
    .r .v span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--sw-text-3);
    }
    .dot[data-s='ok'] {
      background: var(--sw-live);
    }
    .dot[data-s='warn'] {
      background: var(--sw-stale);
    }
    .dot[data-s='error'] {
      background: var(--sw-danger);
    }
    .dot[data-s='unknown'] {
      background: transparent;
      border: 1px dashed var(--sw-unknown);
      box-sizing: border-box;
    }
    .chk:focus-visible,
    .fcams > summary:focus-visible,
    .percam summary:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .bar {
      display: flex;
      justify-content: flex-end;
      margin-block-end: 8px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .fix {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      line-height: 1.45;
      margin: 2px 0 4px;
    }
    .ok {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .ths {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
      gap: 10px;
    }
    .ths input,
    .ths select {
      inline-size: 100%;
      box-sizing: border-box;
    }
    :host([data-skin='bubble']) .ths input,
    :host([data-skin='bubble']) .ths select,
    :host([data-skin='bubble']) .chk {
      min-block-size: 44px; /* the bubble skin's touch target */
    }
    .cont {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 16px;
      margin-block-end: 12px;
      font-size: var(--sw-fs-sm);
    }
    .cont-h {
      color: var(--sw-text-2);
      inline-size: 100%;
    }
    .chk {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 32px;
      max-inline-size: 100%;
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      cursor: pointer;
    }
    .chk[aria-pressed='true'] {
      border-color: var(--sw-accent);
    }
    .chk span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chk .box {
      inline-size: 16px;
      block-size: 16px;
      border-radius: var(--sw-r-2xs);
      border: 1px solid var(--sw-border-strong, var(--sw-border));
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--sw-fs-sm);
      font-style: normal;
      flex-shrink: 0;
    }
    .chk[aria-pressed='true'] .box {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    :host([data-skin='bubble']) .chk {
      min-inline-size: 44px;
    }
    :host([data-skin='bubble']) .card {
      border-color: transparent;
      background: var(--sw-surface-2, var(--sw-surface));
    }
    :host([data-skin='bubble']) .r {
      border-block-start-color: transparent;
    }
    .percam {
      margin-block-end: 12px;
      font-size: var(--sw-fs-sm);
    }
    .percam summary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 32px;
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .percam .n {
      color: var(--sw-accent);
    }
    .pc-h {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      margin-block: 8px 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pc-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
      gap: 6px 16px;
    }
    .pc-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-inline-size: 0;
    }
    .pc-row span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-inline-size: 0;
    }
    .pc-row select {
      flex: 0 0 auto;
      inline-size: 190px;
      max-inline-size: 60%;
      min-block-size: 32px;
      padding: 0 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
    }
    :host([data-skin='bubble']) .pc-row select,
    :host([data-skin='bubble']) .percam summary {
      min-block-size: 44px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-block-start: 10px;
      flex-wrap: wrap;
    }
    ${M}
  `;k([G({type:Boolean})],v.prototype,"manage",2);k([p()],v.prototype,"cards",2);k([p()],v.prototype,"frigate",2);k([p()],v.prototype,"error",2);k([p()],v.prototype,"busy",2);k([p()],v.prototype,"th",2);k([p()],v.prototype,"draft",2);k([p()],v.prototype,"saveMsg",2);v=k([j("recorder-health-panel")],v);var ge=Object.defineProperty,xe=Object.getOwnPropertyDescriptor,x=(e,s,n,t)=>{for(var a=t>1?void 0:t?xe(s,n):s,i=e.length-1,l;i>=0;i--)(l=e[i])&&(a=(t?l(s,n,a):l(a))||a);return t&&a&&ge(s,n,a),a};const $e=["interval_s","per_pass_max","dark_level","blur_min","freeze_diff","freeze_samples","shift_pct","shift_corr_min","confirm_samples","recover_s"],ke=new Set(["blur_min","freeze_diff","shift_corr_min"]),ye=[{key:"check_dark",label:"checkDark"},{key:"check_blur",label:"checkBlur"},{key:"check_freeze",label:"checkFreeze"},{key:"check_shift",label:"checkShift"}],D=["managers","scope","users"];let w=class extends E{constructor(){super(...arguments),this.skin=new L(this),this.th=null,this.draft={},this.error="",this.busy=!1,this.msg=null,this.policy=null,this.users=[],this.ruleDraft=null,this.excOpen=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.th=await ne(),this.error=""}catch(e){this.error=z(e);return}try{this.policy=await R(`notify/policies/${encodeURIComponent(this.th.source)}`);const{listUsers:e}=await ie(async()=>{const{listUsers:s}=await import("./access-CJ1kgHaF.js");return{listUsers:s}},__vite__mapDeps([0]),import.meta.url);this.users=(await e()).users.filter(s=>s.active).map(s=>({id:s.id,name:s.name||s.username}))}catch{this.policy=null}}set(e,s){this.draft={...this.draft,[e]:s},this.msg=null}get dirty(){return Object.keys(this.draft).length>0||this.ruleDraft!==null}async save(){if(!(!this.dirty||!this.th)){this.busy=!0,this.msg=null;try{Object.keys(this.draft).length&&(this.th=await oe(this.draft),this.draft={}),this.ruleDraft&&this.policy&&(this.policy=await N(`notify/policies/${encodeURIComponent(this.th.source)}`,{recipients:this.ruleDraft,base_revision:this.policy.revision}),this.ruleDraft=null),this.msg={tone:"ok",text:h("saved")}}catch(e){this.msg={tone:"err",text:z(e)}}finally{this.busy=!1}}}chip(e,s,n,t){return o`<button type="button" class="chk" data-cih-chip=${n} aria-pressed=${e?"true":"false"} @click=${t}><span>${s}</span></button>`}switch(e,s,n,t){return o`<button type="button" class="chk sw" role="switch" data-cih-switch=${n} aria-checked=${e?"true":"false"} aria-pressed=${e?"true":"false"} @click=${t}><i class="box" aria-hidden="true">${e?"✓":""}</i><span>${s}</span></button>`}recipients(){const e=this.policy;if(!e)return c;const s=this.ruleDraft??e.recipients,n=s.user_ids??[];return o`<div class="row" data-cih-recipients>
      <span class="k">${h("recipients")}</span>
      <select aria-label=${h("recipients")} data-cih-rule @change=${t=>{const a=t.target.value;this.ruleDraft=a==="users"?{rule:a,user_ids:n}:{rule:a},this.msg=null}}>${(D.includes(s.rule)?D:[...D,s.rule]).map(t=>o`<option value=${t} .selected=${s.rule===t}>${V[t]}</option>`)}</select>
      ${s.rule==="users"?this.users.map(t=>this.chip(n.includes(t.id),t.name,`user:${t.id}`,()=>{this.ruleDraft={rule:"users",user_ids:n.includes(t.id)?n.filter(a=>a!==t.id):[...n,t.id]},this.msg=null})):c}
    </div>`}render(){if(this.error&&!this.th)return o`<sw-card heading=${h("settingsTitle")}><sw-state-panel compact state="error" heading=${h("settingsTitle")} hint=${this.error} data-cih-error></sw-state-panel></sw-card>`;if(!this.th)return o`<sw-card heading=${h("settingsTitle")}><sw-state-panel compact state="loading" heading=${h("loading")}></sw-state-panel></sw-card>`;const e={...this.th.values,...this.draft},s=e.excluded??[],n=this.ruleDraft?.rule==="users"&&!(this.ruleDraft.user_ids??[]).length;return o`<sw-card heading=${h("settingsTitle")} data-cih-settings>
      <div class="top">
        ${this.switch(e.enabled,h("enabled"),"enabled",()=>this.set("enabled",!e.enabled))}
        ${this.switch(e.passive_only,h("passiveOnly"),"passive",()=>this.set("passive_only",!e.passive_only))}
      </div>
      <div class="ths">
        ${$e.map(t=>{const a=this.th.ranges[t],i=ke.has(t);return o`<sw-field label=${h(t)}><input class="ltr" data-cih-field=${t} type="number" inputmode=${i?"decimal":"numeric"} step=${i?"any":"1"}
            min=${a?.min??0} max=${a?.max??99999} .value=${String(e[t])}
            @input=${l=>{const m=Number(l.target.value);Number.isFinite(m)&&(i||Number.isInteger(m))&&this.set(t,m)}} /></sw-field>`})}
      </div>
      <div class="row" data-cih-checks>
        <span class="k">${h("checks")}</span>
        ${ye.map(t=>this.chip(e[t.key],h(t.label),t.key,()=>this.set(t.key,!e[t.key])))}
      </div>
      ${this.th.cameras.length?o`<details class="exc" data-cih-excluded ?open=${this.excOpen} @toggle=${t=>this.excOpen=t.target.open}>
        <summary>${h("excludedCams")}${s.length?o` <span class="n">(${s.length})</span>`:c}</summary>
        ${this.excOpen?o`<div class="list">${this.th.cameras.map(t=>this.chip(s.includes(t.id),t.name,`exclude:${t.id}`,()=>this.set("excluded",s.includes(t.id)?s.filter(a=>a!==t.id):[...s,t.id])))}</div>`:c}
      </details>`:c}
      ${this.recipients()}
      <div class="actions">
        <sw-button size="sm" variant="primary" data-cih-save ?disabled=${this.busy||!this.dirty||n} @click=${()=>this.save()}>${h("save")}</sw-button>
        ${this.msg?o`<span class=${this.msg.tone} role="status" data-cih-msg>${this.msg.text}</span>`:c}
      </div>
    </sw-card>`}};w.styles=S`
    :host {
      display: block;
    }
    .top {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 20px;
      margin-block-end: 10px;
    }
    .ths {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
      gap: 8px 10px;
    }
    .ths input,
    .row select {
      inline-size: 100%;
      box-sizing: border-box;
    }
    .row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 10px;
      margin-block-start: 10px;
      font-size: var(--sw-fs-sm);
    }
    .row > .k {
      color: var(--sw-text-2);
      min-inline-size: 110px;
    }
    .chk {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 30px;
      max-inline-size: 100%;
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .chk[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: color-mix(in srgb, var(--sw-accent) 10%, var(--sw-surface));
    }
    .chk.sw {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .chk .box {
      inline-size: 16px;
      block-size: 16px;
      border-radius: var(--sw-r-2xs);
      border: 1px solid var(--sw-border-strong, var(--sw-border));
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-style: normal;
      flex-shrink: 0;
    }
    .chk[aria-pressed='true'] .box {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .chk span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chk:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .row select {
      inline-size: auto;
      min-block-size: 30px;
      padding: 0 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
    }
    details.exc {
      display: block;
      min-inline-size: 0;
      max-inline-size: 100%;
      margin-block-start: 10px;
    }
    details summary {
      cursor: pointer;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      min-block-size: 30px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    details summary:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    details .list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 6px;
    }
    .n {
      color: var(--sw-accent);
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-block-start: 12px;
    }
    .ok {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    ${M}
    :host([data-skin='bubble']) .chk,
    :host([data-skin='bubble']) .ths input,
    :host([data-skin='bubble']) .row select,
    :host([data-skin='bubble']) details summary {
      min-block-size: 44px;
    }
    :host([data-skin='bubble']) .chk {
      min-inline-size: 44px;
      justify-content: center;
    }

  `;x([p()],w.prototype,"th",2);x([p()],w.prototype,"draft",2);x([p()],w.prototype,"error",2);x([p()],w.prototype,"busy",2);x([p()],w.prototype,"msg",2);x([p()],w.prototype,"policy",2);x([p()],w.prototype,"users",2);x([p()],w.prototype,"ruleDraft",2);x([p()],w.prototype,"excOpen",2);w=x([j("camera-image-health-settings")],w);const F={title:"ייצוא יומן מצונזר",subtitle:"קובץ לבדיקת תקלות: שורות היומן האחרונות עם מזהה הבקשה של כל שורה, בדיקות המערכת והמלצה לכל בעיה.",window:"טווח זמן",level:"רמת פירוט",o15:"15 דקות",o60:"שעה (ברירת מחדל)",o180:"3 שעות",o360:"6 שעות",o720:"12 שעות",o1440:"24 שעות",w15:"ב־15 הדקות האחרונות",w60:"בשעה האחרונה",w180:"ב־3 השעות האחרונות",w360:"ב־6 השעות האחרונות",w720:"ב־12 השעות האחרונות",w1440:"ב־24 השעות האחרונות",oINFO:"מידע ומעלה (ברירת מחדל)",oWARNING:"אזהרות ושגיאות",oERROR:"שגיאות בלבד",pINFO:"מידע, אזהרות ושגיאות",pWARNING:"אזהרות ושגיאות",pERROR:"שגיאות בלבד",hidden:"מוסתרים: סיסמאות, אסימונים, פרטי כניסה בכתובות, כתובות רשת, מספרים סידוריים, טלפונים ודוא״ל. לא נכללים וידאו, תמונות או תוכניות.",export:"ייצוא היומן",exporting:"מייצא…",confirmTitle:"לייצא את היומן?",confirmBody:"הקובץ יכלול את שורות היומן שנכתבו {window} ({level}) ואת בדיקות המערכת, אחרי הסתרת סיסמאות, אסימונים, כתובות, מספרים סידוריים ופרטים אישיים. אין בו וידאו, תמונות או תוכניות. הייצוא נרשם ביומן הביקורת.",confirm:"אישור והורדה",cancel:"ביטול",done:"הקובץ {name} הורד",cancelled:"הייצוא בוטל; לא נוצר קובץ",forbidden:"רק מי שמורשה לנהל את הגדרות המערכת יכול לייצא את היומן.",consent:"השרת לא קיבל את האישור. נסו שוב ואשרו את הייצוא.",failed:"הייצוא נכשל: {error}",retry:"נסו שוב"},H=J("en","i18n/log-export","en");Q("i18n/log-export",{he:F,en:H});const d=(e,s)=>Y((Z(["en"])==="en"?H[e]:void 0)??F[e],s);var _e=Object.defineProperty,ze=Object.getOwnPropertyDescriptor,O=(e,s,n,t)=>{for(var a=t>1?void 0:t?ze(s,n):s,i=e.length-1,l;i>=0;i--)(l=e[i])&&(a=(t?l(s,n,a):l(a))||a);return t&&a&&_e(s,n,a),a};let _=class extends E{constructor(){super(...arguments),this.skin=new L(this),this.minutes=60,this.level="INFO",this.busy=!1,this.error="",this.toast=new ce(this,{ms:3200})}async run(){if(this.busy)return;if(!await le({heading:d("confirmTitle"),body:d("confirmBody",{window:d(`w${this.minutes}`),level:d(`p${this.level}`)}),confirmLabel:d("confirm"),cancelLabel:d("cancel")})){this.toast.show(d("cancelled"));return}this.busy=!0,this.error="";try{const s=await se(this.minutes,this.level);this.toast.show(d("done",{name:s}))}catch(s){this.error=s instanceof I&&s.status===403?d("forbidden"):s instanceof I&&s.body.code==="consent_required"?d("consent"):d("failed",{error:z(s)})}finally{this.busy=!1}}render(){return o`<sw-card heading=${d("title")} subheading=${d("subtitle")} data-log-export>
      <div class="opts">
        <sw-field label=${d("window")}><select data-log-window ?disabled=${this.busy} @change=${e=>{this.minutes=Number(e.target.value),this.error=""}}>
          ${te.map(e=>o`<option value=${e} .selected=${e===this.minutes}>${d(`o${e}`)}</option>`)}</select></sw-field>
        <sw-field label=${d("level")}><select data-log-level ?disabled=${this.busy} @change=${e=>{this.level=e.target.value,this.error=""}}>
          ${ae.map(e=>o`<option value=${e} .selected=${e===this.level}>${d(`o${e}`)}</option>`)}</select></sw-field>
      </div>
      <div class="hidden">${d("hidden")}</div>
      <div class="actions">
        <sw-button size="sm" icon="download" data-log-export-go ?disabled=${this.busy} @click=${()=>void this.run()}>${this.busy?d("exporting"):d("export")}</sw-button>
        ${this.error?o`<span class="err" role="alert" data-log-export-error>${this.error}</span><sw-button size="sm" variant="ghost" data-log-export-retry @click=${()=>void this.run()}>${d("retry")}</sw-button>`:c}
      </div>
      ${this.toast.text?o`<div class="toast" role="status" data-log-export-toast ${re()}>${this.toast.text}</div>`:c}
    </sw-card>`}};_.styles=[ee,S`
    :host {
      display: block;
    }
    .opts {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
      gap: 8px 12px;
    }
    .opts select {
      inline-size: 100%;
      box-sizing: border-box;
    }
    .hidden {
      margin-block: 10px 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin-block-start: 12px;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    /* centred by auto margins (not a transform), so the same rule holds in the RTL and the LTR interface */
    .toast {
      position: fixed;
      inset-block-end: 24px;
      inset-inline: 16px;
      margin-inline: auto;
      inline-size: fit-content;
      box-sizing: border-box;
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      padding: 10px 16px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-md);
      z-index: var(--sw-z-toast);
      box-shadow: var(--sw-shadow-3);
      max-inline-size: calc(100vw - 32px);
      overflow-wrap: anywhere;
    }
    @media (max-width: 767px) {
      .toast {
        inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom));
      }
    }
    :host([data-skin='bubble']) .opts select {
      min-block-size: 44px;
    }
  `];O([p()],_.prototype,"minutes",2);O([p()],_.prototype,"level",2);O([p()],_.prototype,"busy",2);O([p()],_.prototype,"error",2);_=O([j("health-log-export")],_);
