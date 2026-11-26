const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{bg as O,F as E,bw as j,cL as a,b4 as C,j as T,z as R,k as d,a as M,aX as P,q as y,mh as H,A as c,b as o,eF as D,mi as S,mj as N,mk as U,ml as A,m as I,mm as B}from"./index-CoJbESCx.js";import{_ as K}from"./sw-logo-art-PLtEZJxU.js";import{d as X,e as q,a as h}from"./camera-image-health-CaHeRV5S.js";import"./system-diagnostics-support-C_W3mg71.js";import"./confirm-dialog-Kd4DkskJ.js";import"./toast-controller-BPX0Tkjm.js";const V=()=>O("recorder-health"),G=()=>E("recorder-health/check"),J=()=>O("recorder-health/settings"),Q=e=>j("recorder-health/settings",e);var W=Object.defineProperty,Y=Object.getOwnPropertyDescriptor,k=(e,t,n,s)=>{for(var r=s>1?void 0:s?Y(t,n):t,i=e.length-1,l;i>=0;i--)(l=e[i])&&(r=(s?l(t,n,r):l(r))||r);return s&&r&&W(t,n,r),r};const Z={ok:"live",warn:"stale",error:"offline",unknown:"unknown",off:"neutral"},ee={ok:a("תקין"),warn:a("לתשומת לב"),error:a("תקלה"),unknown:a("לא ידוע"),off:""},se=[{key:"recording_gap_min",label:a("מצלמה לא מקליטה"),unit:a("דקות")},{key:"clock_drift_s",label:a("סטיית שעון"),unit:a("שניות")},{key:"latency_ms",label:a("תגובה איטית"),unit:a("מ״ש")},{key:"disk_fill_days",label:a("דיסק יתמלא בתוך"),unit:a("ימים")},{key:"cert_days",label:a("תעודה פגה בתוך"),unit:a("ימים")},{key:"recover_s",label:a("זמן עד סגירת התראה"),unit:a("שניות")},{key:"interval_s",label:a("בדיקה כל"),unit:a("שניות")}],_=e=>(e??[]).slice(0,2).map(t=>t.name).join(", ")+((e?.length??0)>2?` +${(e?.length??0)-2}`:"");let b=class extends M{constructor(){super(...arguments),this.skin=new P(this),this.manage=!1,this.cards=null,this.frigate={},this.error="",this.busy=!1,this.th=null,this.draft={},this.saveMsg=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=await V();this.cards=e.recorders,this.loadFrigate(e.recorders),this.error="",this.manage&&e.can_manage&&!this.th&&(this.th=await J())}catch(e){this.error=y(e)}}async loadFrigate(e){const t={};await Promise.all(e.filter(n=>n.vendor==="frigate"&&n.vendor_details).map(async n=>{const s=n.disks?.free_pct??null;t[n.id]=await H(n.id,n.vendor_details,s).catch(()=>null)})),this.frigate=t}async check(){this.busy=!0;try{this.cards=(await G()).recorders,this.loadFrigate(this.cards)}catch(e){this.error=y(e)}finally{this.busy=!1}}async save(){if(Object.keys(this.draft).length){this.busy=!0,this.saveMsg=null;try{this.th=await Q(this.draft),this.draft={},this.saveMsg={tone:"ok",text:a("נשמר")}}catch(e){this.saveMsg={tone:"err",text:y(e)}}finally{this.busy=!1}}}row(e,t,n,s){return!n||n.state==="off"?c:o`<div class="r" data-rh-row=${e}><span class="k">${t}</span><span class="v"><span>${s}</span><i class="dot" data-s=${n.state}></i></span></div>`}card(e){const t=e.api,n=t.state==="unknown"?a("טרם נבדק"):t.state==="error"?String(t.text??a("אין תשובה")):a("{n} מ״ש",{n:t.latency_ms??"—"}),s=e.disks,r=s?.items?.find(L=>!["ok","formatting","unknown"].includes(L.state)),i=!s||s.state==="unknown"?a("לא ידוע"):r?r.state==="missing"?a("אין דיסק"):a("דיסק {ref}: {text}",{ref:r.ref,text:r.text}):s.alarms?.length?a("תקלת דיסק"):s.fill_days!=null&&s.state==="warn"?a("יתמלא בעוד {n} ימים",{n:s.fill_days}):s.full?a("מלא"):s.free_pct!=null?a("{n}% פנוי",{n:s.free_pct}):a("תקין"),l=e.recording,m=!l||l.state==="unknown"?a("לא ידוע"):l.exception?.length?a("תקלה: {names}",{names:_(l.exception)}):l.stopped?.length?a("לא מקליטות: {names}",{names:_(l.stopped)}):`${l.recording??0}/${l.watched??0}`,x=e.channels,p=!x||x.state==="unknown"?a("לא ידוע"):x.disconnected?.length?a("מנותקות: {names}",{names:_(x.disconnected)}):`${x.connected??0}/${x.total??0}`,v=e.clock,w=v?.drift_s==null?null:Math.round(v.drift_s),u=w==null?a("לא ידוע"):w===0?a("מדויק"):w>0?a("מקדים {n} שנ׳",{n:Math.abs(w)}):a("מאחר {n} שנ׳",{n:Math.abs(w)}),$=e.certificate,F=!$||$.days_left==null?"":$.days_left<=0?a("פגה"):a("עוד {n} ימים",{n:$.days_left});return o`<div class="card" data-rh-card=${e.id} data-status=${e.status}>
      <div class="hh"><span class="nm">${e.name}</span><sw-badge kind=${Z[e.status]} label=${ee[e.status]}></sw-badge></div>
      ${this.row("api",a("חיבור"),t,n)}
      ${t.state==="error"&&t.action?o`<div class="fix" data-rh-fix role="note">${t.action}</div>`:c}
      ${this.row("disks",a("דיסקים"),s,i)}
      ${this.row("recording",a("הקלטה"),l,m)}
      ${this.row("channels",a("מצלמות"),x,p)}
      ${this.row("clock",a("שעון"),v,u)}
      ${$?this.row("certificate",a("תעודה"),$,F):c}
      ${this.frigate[e.id]?this.frigateRows(this.frigate[e.id]):c}
    </div>`}frigateRows(e){const t=D.frigate.health,n=e.detectors.length?e.detectors.map(i=>`${i.name}${i.inference_ms!=null?` · ${Math.round(i.inference_ms)} ${t.inference}`:""}${S(i)?` · ${t.overloaded}`:""}`).join(", "):D.frigate.summary.noDetectors,s=e.detectors.some(S)?"warn":e.detectors.length?"ok":"unknown",r=N(e.storage);return o`${this.row("frigate-detectors",t.detectors,{state:s},n)}
      ${r?this.row("frigate-hours-left",t.storageLeft,{state:U(e.storage)},r):c}
      ${e.partial_coverage?o`<div class="r wrap" data-rh-row="frigate-partial"><span class="k">${t.partial}</span><span class="v"><i class="dot" data-s="warn"></i></span></div>`:c}
      ${e.cameras.length?o`<details class="fcams" data-rh-frigate-cameras open>
        <summary>${t.cameras} (${e.cameras.filter(i=>i.state==="ok").length}/${e.cameras.length})</summary>
        ${e.cameras.map(i=>o`<div class="r" data-rh-frigate-camera=${i.id} data-camera-state=${i.state}><span class="k nm2">${i.name}</span><span class="v"><span>${A(i)}${i.state==="ok"&&(i.reconnects_last_hour??0)>0?` · ${i.reconnects_last_hour} ${t.reconnects}`:""}</span><i class="dot" data-s=${i.state==="ok"?(i.stalls_last_hour??0)>0?"warn":"ok":i.state==="off"?"unknown":"error"}></i></span></div>`)}
      </details>`:c}`}thresholds(){if(!this.manage||!this.th)return c;const e={...this.th.values,...this.draft},t=e.continuous_recorders??[],n=(this.cards??[]).filter(r=>r.detail_supported),s=(r,i)=>{this.draft={...this.draft,[r]:i},this.saveMsg=null};return o`<sw-card heading=${a("ספי התראה למקליטים")} data-rh-settings>
      ${n.length?o`<div class="cont" data-rh-continuous>
        <span class="cont-h">${a("הקלטה רציפה")}</span>
        ${n.map(r=>{const i=t.includes(r.id);return o`<button type="button" class="chk" data-rh-continuous-id=${r.id} aria-pressed=${i?"true":"false"}
            @click=${()=>s("continuous_recorders",i?t.filter(l=>l!==r.id):[...t,r.id])}><i class="box" aria-hidden="true">${i?"✓":""}</i><span>${r.name}</span></button>`})}
      </div>`:c}
      ${this.perCamera(n,e,s)}
      <div class="ths">
        ${se.map(r=>{const i=this.th.ranges[r.key];return o`<sw-field label=${`${r.label} (${r.unit})`}><input class="ltr" data-rh-field=${r.key} type="number" inputmode="numeric" min=${i?.min??0} max=${i?.max??99999} .value=${String(e[r.key])}
            @input=${l=>{const m=Number(l.target.value);Number.isInteger(m)&&s(r.key,m)}} /></sw-field>`})}
      </div>
      <div class="actions">
        <sw-button size="sm" variant="primary" data-rh-save ?disabled=${this.busy||!Object.keys(this.draft).length} @click=${()=>this.save()}>${a("שמירה")}</sw-button>
        ${this.saveMsg?o`<span class=${this.saveMsg.tone} data-rh-save-msg role="status">${this.saveMsg.text}</span>`:c}
      </div>
    </sw-card>`}perCamera(e,t,n){const s=new Set(e.map(p=>p.id)),r=(this.th?.cameras??[]).filter(p=>s.has(p.recorder_id));if(!r.length)return c;const i=t.camera_recording??{},l=t.continuous_recorders??[],m=r.filter(p=>i[p.id]).length,x=(p,v)=>{const w={...i};v==="continuous"||v==="events"?w[p]=v:delete w[p],n("camera_recording",w)};return o`<details class="percam" data-rh-cameras>
      <summary>${a("לפי מצלמה")}${m?o` <span class="n" data-rh-cameras-changed>(${m})</span>`:c}</summary>
      ${e.map(p=>{const v=r.filter(u=>u.recorder_id===p.id);if(!v.length)return c;const w=l.includes(p.id)?a("כמו המקליט (רציפה)"):a("כמו המקליט (לא רציפה)");return o`<div class="pc-h">${p.name}</div>
          <div class="pc-list">${v.map(u=>o`<label class="pc-row"><span>${u.name}</span>
            <select data-rh-camera-id=${u.id} aria-label=${u.name} .value=${i[u.id]??""} @change=${$=>x(u.id,$.target.value)}>
              <option value="" ?selected=${!i[u.id]}>${w}</option>
              <option value="continuous" ?selected=${i[u.id]==="continuous"}>${a("רציפה")}</option>
              <option value="events" ?selected=${i[u.id]==="events"}>${a("לא רציפה")}</option>
            </select></label>`)}</div>`})}
    </details>`}render(){return this.error&&!this.cards?o`<sw-card heading=${a("מקליטים")}><sw-state-panel compact state="error" heading=${a("המקליטים לא נבדקו")} hint=${this.error} actionLabel=${a("נסה שוב")} data-rh-error @action=${()=>this.load()}></sw-state-panel></sw-card>`:this.cards?this.cards.length?o`<sw-card heading=${a("מקליטים")} data-rh-panel data-state="ready">
        ${this.manage?o`<div class="bar"><sw-button size="sm" icon="refresh" data-rh-check ?disabled=${this.busy} @click=${()=>this.check()}>${a("בדוק עכשיו")}</sw-button></div>`:c}
        <div class="grid">${this.cards.map(e=>this.card(e))}</div>
        ${this.error?o`<div class="err" role="alert">${this.error}</div>`:c}
      </sw-card>
      ${this.thresholds()}`:c:o`<sw-card heading=${a("מקליטים")}><sw-state-panel compact state="loading" heading=${a("קורא…")} data-rh-loading></sw-state-panel></sw-card>`}};b.styles=T`
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
    ${C}
  `;k([R({type:Boolean})],b.prototype,"manage",2);k([d()],b.prototype,"cards",2);k([d()],b.prototype,"frigate",2);k([d()],b.prototype,"error",2);k([d()],b.prototype,"busy",2);k([d()],b.prototype,"th",2);k([d()],b.prototype,"draft",2);k([d()],b.prototype,"saveMsg",2);b=k([I("recorder-health-panel")],b);var te=Object.defineProperty,ae=Object.getOwnPropertyDescriptor,g=(e,t,n,s)=>{for(var r=s>1?void 0:s?ae(t,n):t,i=e.length-1,l;i>=0;i--)(l=e[i])&&(r=(s?l(t,n,r):l(r))||r);return s&&r&&te(t,n,r),r};const re=["interval_s","per_pass_max","dark_level","blur_min","freeze_diff","freeze_samples","shift_pct","shift_corr_min","confirm_samples","recover_s"],ie=new Set(["blur_min","freeze_diff","shift_corr_min"]),ne=[{key:"check_dark",label:"checkDark"},{key:"check_blur",label:"checkBlur"},{key:"check_freeze",label:"checkFreeze"},{key:"check_shift",label:"checkShift"}],z=["managers","scope","users"];let f=class extends M{constructor(){super(...arguments),this.skin=new P(this),this.th=null,this.draft={},this.error="",this.busy=!1,this.msg=null,this.policy=null,this.users=[],this.ruleDraft=null,this.excOpen=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.th=await X(),this.error=""}catch(e){this.error=y(e);return}try{this.policy=await O(`notify/policies/${encodeURIComponent(this.th.source)}`);const{listUsers:e}=await K(async()=>{const{listUsers:t}=await import("./access-CF5Pg1Wk.js");return{listUsers:t}},__vite__mapDeps([0]),import.meta.url);this.users=(await e()).users.filter(t=>t.active).map(t=>({id:t.id,name:t.name||t.username}))}catch{this.policy=null}}set(e,t){this.draft={...this.draft,[e]:t},this.msg=null}get dirty(){return Object.keys(this.draft).length>0||this.ruleDraft!==null}async save(){if(!(!this.dirty||!this.th)){this.busy=!0,this.msg=null;try{Object.keys(this.draft).length&&(this.th=await q(this.draft),this.draft={}),this.ruleDraft&&this.policy&&(this.policy=await j(`notify/policies/${encodeURIComponent(this.th.source)}`,{recipients:this.ruleDraft,base_revision:this.policy.revision}),this.ruleDraft=null),this.msg={tone:"ok",text:h("saved")}}catch(e){this.msg={tone:"err",text:y(e)}}finally{this.busy=!1}}}chip(e,t,n,s){return o`<button type="button" class="chk" data-cih-chip=${n} aria-pressed=${e?"true":"false"} @click=${s}><span>${t}</span></button>`}switch(e,t,n,s){return o`<button type="button" class="chk sw" role="switch" data-cih-switch=${n} aria-checked=${e?"true":"false"} aria-pressed=${e?"true":"false"} @click=${s}><i class="box" aria-hidden="true">${e?"✓":""}</i><span>${t}</span></button>`}recipients(){const e=this.policy;if(!e)return c;const t=this.ruleDraft??e.recipients,n=t.user_ids??[];return o`<div class="row" data-cih-recipients>
      <span class="k">${h("recipients")}</span>
      <select aria-label=${h("recipients")} data-cih-rule @change=${s=>{const r=s.target.value;this.ruleDraft=r==="users"?{rule:r,user_ids:n}:{rule:r},this.msg=null}}>${(z.includes(t.rule)?z:[...z,t.rule]).map(s=>o`<option value=${s} .selected=${t.rule===s}>${B[s]}</option>`)}</select>
      ${t.rule==="users"?this.users.map(s=>this.chip(n.includes(s.id),s.name,`user:${s.id}`,()=>{this.ruleDraft={rule:"users",user_ids:n.includes(s.id)?n.filter(r=>r!==s.id):[...n,s.id]},this.msg=null})):c}
    </div>`}render(){if(this.error&&!this.th)return o`<sw-card heading=${h("settingsTitle")}><sw-state-panel compact state="error" heading=${h("settingsTitle")} hint=${this.error} data-cih-error></sw-state-panel></sw-card>`;if(!this.th)return o`<sw-card heading=${h("settingsTitle")}><sw-state-panel compact state="loading" heading=${h("loading")}></sw-state-panel></sw-card>`;const e={...this.th.values,...this.draft},t=e.excluded??[],n=this.ruleDraft?.rule==="users"&&!(this.ruleDraft.user_ids??[]).length;return o`<sw-card heading=${h("settingsTitle")} data-cih-settings>
      <div class="top">
        ${this.switch(e.enabled,h("enabled"),"enabled",()=>this.set("enabled",!e.enabled))}
        ${this.switch(e.passive_only,h("passiveOnly"),"passive",()=>this.set("passive_only",!e.passive_only))}
      </div>
      <div class="ths">
        ${re.map(s=>{const r=this.th.ranges[s],i=ie.has(s);return o`<sw-field label=${h(s)}><input class="ltr" data-cih-field=${s} type="number" inputmode=${i?"decimal":"numeric"} step=${i?"any":"1"}
            min=${r?.min??0} max=${r?.max??99999} .value=${String(e[s])}
            @input=${l=>{const m=Number(l.target.value);Number.isFinite(m)&&(i||Number.isInteger(m))&&this.set(s,m)}} /></sw-field>`})}
      </div>
      <div class="row" data-cih-checks>
        <span class="k">${h("checks")}</span>
        ${ne.map(s=>this.chip(e[s.key],h(s.label),s.key,()=>this.set(s.key,!e[s.key])))}
      </div>
      ${this.th.cameras.length?o`<details class="exc" data-cih-excluded ?open=${this.excOpen} @toggle=${s=>this.excOpen=s.target.open}>
        <summary>${h("excludedCams")}${t.length?o` <span class="n">(${t.length})</span>`:c}</summary>
        ${this.excOpen?o`<div class="list">${this.th.cameras.map(s=>this.chip(t.includes(s.id),s.name,`exclude:${s.id}`,()=>this.set("excluded",t.includes(s.id)?t.filter(r=>r!==s.id):[...t,s.id])))}</div>`:c}
      </details>`:c}
      ${this.recipients()}
      <div class="actions">
        <sw-button size="sm" variant="primary" data-cih-save ?disabled=${this.busy||!this.dirty||n} @click=${()=>this.save()}>${h("save")}</sw-button>
        ${this.msg?o`<span class=${this.msg.tone} role="status" data-cih-msg>${this.msg.text}</span>`:c}
      </div>
    </sw-card>`}};f.styles=T`
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
    ${C}
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

  `;g([d()],f.prototype,"th",2);g([d()],f.prototype,"draft",2);g([d()],f.prototype,"error",2);g([d()],f.prototype,"busy",2);g([d()],f.prototype,"msg",2);g([d()],f.prototype,"policy",2);g([d()],f.prototype,"users",2);g([d()],f.prototype,"ruleDraft",2);g([d()],f.prototype,"excOpen",2);f=g([I("camera-image-health-settings")],f);
