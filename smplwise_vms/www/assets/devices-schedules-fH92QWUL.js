import{j as X,k as u,z as O,a as Y,c as E,A as l,b as i,ae as ve,fi as we,af as C,m as Q,bz as $e,bA as xe,aX as ye,l6 as ke,kx as ze,cj as a,jf as ee,an as te,bW as Se,cM as T,l7 as _e,l8 as Ee,l9 as Re,d7 as Ce,la as Te,lb as Fe,a8 as S,aj as v,bo as j,lc as Le,ld as Oe,le as Ie,lf as Pe,lg as Me,lh as De}from"./index-kIGDECLR.js";import{l as D}from"./live-B3jZ8jxl.js";import{t as K}from"./schedules-week-view-BkLFGRV3.js";import"./sw-pager-BqjW4BhG.js";import{L as Ae,p as Be}from"./long-lists-Cti-ce2p.js";import{g as h,b as je,c as qe,S as Ve,i as Ue}from"./automations-logic-Di7RkDip.js";import{a as J}from"./automations-glass-C1j94hdu.js";import{a as Z}from"./glass-BCKpVUj3.js";import{DEMO_SUN as P}from"./schedules-mock-CFh-iSfL.js";import{x as se,y as ae,z as He,B as We,E as G,F as Ne,w as q,R as Ke,M as Ge,G as Xe,l as V,v as Ye,H as Qe,I as Je,J as ie,K as ne,L as Ze,N as et,D as tt,j as re,O as U,P as le,Q as st}from"./schedules-DuYwjcuO.js";import{l as oe,s as $,r as at,w as A,a as L,b as it,p as fe,n as M,d as F,c as nt,N as I,e as _,f as R,g as H,h as de,i as ce,t as rt,j as he,k as lt,S as ot,m as dt,o as ct,q as ht,u as pt,v as ut,x as mt,y as bt,z as gt,A as wt,B as ft}from"./schedules-logic-zx88ikAk.js";import{t as d}from"./automation-B8g_x68m.js";import"./schedule-create-dialog-Cr_hPFEm.js";import{m as vt,a as $t}from"./media-page-CxiZ9I9q.js";import{S as xt,N as yt,K as W}from"./editor-guards-CEHbVbIV.js";import{U as kt}from"./automations-DwQp2suk.js";import{r as pe,s as zt,w as ue}from"./safe-storage-BOOiiGOc.js";import{b as St}from"./bubble-chrome-CAs08QP2.js";import"./sw-logo-art-PLtEZJxU.js";import"./confirm-words-D_C-IRIu.js";import"./lead-reserve-BNJlC7Y8.js";import"./memo-CyxK7byc.js";var _t=Object.defineProperty,Et=Object.getOwnPropertyDescriptor,k=(e,t,s,n)=>{for(var r=n>1?void 0:n?Et(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(r=(n?c(t,s,r):c(r))||r);return n&&r&&_t(t,s,r),r};let B=class extends Y{constructor(){super(...arguments),this.dialog=null,this.close=e=>{e?.stopPropagation(),!this.dialog?.busy&&(this.dialog=null)}}connectedCallback(){super.connectedCallback(),Z(this)}async enable(e,t){if(t&&e.lowering){this.dialog={kind:"lowering",s:e,op:"enable",slot:null,summary:oe(e),needsCode:!1,error:"",busy:!1};return}await this.doEnable(e,t,{})}run(e){const t=e.slots.length===1?0:null;this.dialog={kind:"run",s:e,slot:t,skip:!1,error:"",busy:!1}}askDelete(e){this.dialog={kind:"delete",s:e,error:"",busy:!1}}copy(e){this.dialog={kind:"copy",s:e,name:d("העתק של {name}",{name:e.display_name}),error:"",busy:!1}}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}result(e,t="ok"){this.emit("result",{text:e,tone:t})}async doEnable(e,t,s){try{const n=await se(e.id,t,s);return this.emit("changed",{schedule:n.schedule}),this.result(t?d('"{name}" הופעל',{name:e.display_name}):d('"{name}" הושבת',{name:e.display_name})),!0}catch(n){return this.emit("changed",{schedule:null}),n instanceof E&&n.code==="schedule_changed"?this.result(d("התזמון שונה במקום אחר. הרשימה עודכנה."),"error"):this.result($(n),"error"),!1}}async submit(){const e=this.dialog;if(!(!e||e.busy)){this.dialog={...e,busy:!0,error:""};try{if(e.kind==="run"){const t=await ae(e.s.id,e.slot,{confirm:!0,skip_conditions:e.skip});this.dialog=null,this.result(t.note),this.emit("changed",{schedule:null})}else if(e.kind==="delete"){const t=await He(e.s.id,e.s.revision);this.dialog=null,this.emit("deleted",{trashId:t.trash_id,name:e.s.display_name,scheduleId:e.s.id})}else if(e.kind==="copy"){const t=await We(e.s.id,e.name.trim()||d("העתק של {name}",{name:e.s.display_name}));this.dialog=null,this.emit("copied",{schedule:t.schedule}),this.result(d("שוכפל"))}}catch(t){const s=t instanceof E&&t.code==="schedule_changed";s&&this.emit("changed",{schedule:null});const n=this.dialog;n&&(this.dialog={...n,busy:!1,error:s?d("התזמון שונה במקום אחר. הגרסה העדכנית נטענה; בדקו ונסו שוב."):$(t)})}}}async confirmLowering(e){const t=this.dialog;if(!t||t.kind!=="lowering")return;e.stopPropagation();const s=e.detail?.alarm_code??null;this.dialog={...t,busy:!0};try{if(t.op==="enable"){const n=await se(t.s.id,!0,{confirm_lowering:!0,alarm_code:s});this.dialog=null,this.emit("changed",{schedule:n.schedule}),this.result(d('"{name}" הופעל',{name:t.s.display_name}))}else{const n=await ae(t.s.id,t.slot,{confirm:!0,alarm_code:s});this.dialog=null,this.result(n.note),this.emit("changed",{schedule:null})}}catch(n){if(n instanceof E&&(n.code==="code_required"||n.code==="wrong_code")){this.dialog={...t,busy:!1,needsCode:!0},this.result($(n),"error");return}this.dialog=null,this.emit("changed",{schedule:null}),this.result($(n),"error")}}buttons(e,t,s,n,r,o={}){return i`<div class="dlgrow"><button type="button" class="btn" data-dialog-cancel @click=${this.close}>${d("ביטול")}</button><button type="button" class=${`btn ${o.danger?"danger":"primary"}`} data-dialog-ok data-run-confirm=${e==="run"?"":l} data-delete-confirm=${e==="delete"?"":l} data-copy-confirm=${e==="copy"?"":l} ?disabled=${!!o.disabled||n.busy} @click=${r}>${n.busy?s:t}</button></div>`}renderRun(e){const t=e.s,s=at(e.slot===null?void 0:t.slots[e.slot]),n=e.slot!==null;return i`<sw-dialog open heading=${d('להריץ עכשיו את "{name}"?',{name:t.display_name})} data-dialog="run" @close=${this.close}><div class="dlgform">
      ${t.slots.length>1?i`<div class="slots" role="radiogroup" aria-label=${d("משבצת להרצה")}>${t.slots.map(r=>i`<label class="opt"><input type="radio" name="slot" .checked=${e.slot===r.index} @change=${()=>this.dialog={...e,slot:r.index}} data-run-slot=${r.index} /><span><span class="n">${A(r)}</span><small>${L(r,t).map(o=>`${o.label} · ${o.devices.join(", ")}`).join(" | ")}</small></span></label>`)}</div>`:i`<p>${t.slots[0]?`${A(t.slots[0])} · ${L(t.slots[0],t).map(r=>`${r.label} · ${r.devices.join(", ")}`).join(" | ")}`:""}</p>`}
      ${it(e.slot===null?void 0:t.slots[e.slot])?i`<p>${d("הפעולה תפעיל התקנים פיזיים מיד.")}</p>`:l}
      ${t.conditions.items.length?i`<label class="check"><sw-toggle size="sm" labelHidden in-label label=${d("להריץ גם אם התנאים אינם מתקיימים")} .checked=${e.skip} @change=${r=>this.dialog={...e,skip:ve(r)}} data-run-skip></sw-toggle>${d("להריץ גם אם התנאים אינם מתקיימים")}</label>`:l}
      ${e.error?i`<div class="err" role="alert" data-actions-error>${e.error}</div>`:l}
      ${this.buttons("run",d("הרץ"),d("מריץ…"),e,()=>s?this.askLoweringForRun(e):void this.submit(),{disabled:!n})}
    </div></sw-dialog>`}askLoweringForRun(e){this.dialog={kind:"lowering",s:e.s,op:"run",slot:e.slot,summary:oe(e.s),needsCode:!1,error:"",busy:!1}}render(){const e=this.dialog;return e?e.kind==="run"?this.renderRun(e):e.kind==="delete"?i`<sw-dialog open heading=${d('למחוק את "{name}"?',{name:e.s.display_name})} data-dialog="delete" @close=${this.close}><div class="dlgform">
        <p>${d("התזמון יישמר בסל המחזור 30 יום וניתן לשחזר אותו.")}</p>
        ${e.error?i`<div class="err" role="alert" data-actions-error>${e.error}</div>`:l}
        ${this.buttons("delete",d("מחיקה"),d("מוחק…"),e,()=>void this.submit(),{danger:!0})}
      </div></sw-dialog>`:e.kind==="copy"?i`<sw-dialog open heading=${d("שכפול")} data-dialog="copy" @close=${this.close}><div class="dlgform">
        <label class="fld">${d("שם העותק")}<input class="inp" type="text" maxlength="80" .value=${D(e.name)} data-copy-name @input=${t=>this.dialog={...e,name:t.target.value}} /></label>
        ${e.error?i`<div class="err" role="alert" data-actions-error>${e.error}</div>`:l}
        ${this.buttons("copy",d("שכפול"),d("משכפל…"),e,()=>void this.submit(),{disabled:!e.name.trim()})}
      </div></sw-dialog>`:i`<schedule-lowering-dialog .open=${!0} .summary=${e.summary} .needsCode=${e.needsCode} @confirm=${t=>void this.confirmLowering(t)} @close=${this.close}></schedule-lowering-dialog>`:l}};B.styles=[...J,X`
    :host {
      display: contents;
    }
    /* the confirmations carry the sheet material, as on the automations screen */
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .slots {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    label.opt {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      min-block-size: 48px;
      padding: 10px 14px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
    }
    label.opt:has(input:checked) {
      border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
      background: var(--dv-accent-soft);
    }
    label.opt small {
      display: block;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    label.check {
      display: flex;
      gap: 10px;
      align-items: center;
      min-block-size: 44px;
      font-size: var(--sw-fs-md);
    }
    input[type='radio'] {
      inline-size: 17px;
      block-size: 17px;
      accent-color: var(--dv-accent);
      margin: 2px 0 0;
    }
    p {
      margin: 0;
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
    }
    .err {
      color: var(--dv-danger);
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
    }
  `];k([u()],B.prototype,"dialog",2);B=k([Q("schedule-actions")],B);function Rt(e){const t=e.attribute==="state"&&(e.value==="on"||e.value==="off")?e.match_type==="is"?e.value==="on"?d("פעיל"):d("כבוי"):e.value==="on"?d("לא פעיל"):d("לא כבוי"):`${Ge[e.match_type]} ${e.value}`;if(!e.readable)return i`<div class="blk locked cond" data-condition-locked><span class="bi">${h("lock")}</span><span class="bt">${e.name}<small>${t}</small></span><span class="chip">${h("lock")}${d("מחוץ להרשאתך")}</span></div>`;const s=nt(e),n=s===null?d("לא זמין כרגע"):s?d("כרגע: מתקיים"):d("כרגע: לא מתקיים");return i`<div class="blk cond"><span class="bi">${h("help")}</span><span class="bt">${e.name}<small>${t}</small></span><span class=${s===!0?"chip ok":"chip"}>${n}</span></div>`}let y=class extends Y{constructor(){super(...arguments),this.open=!1,this.schedule=null,this.status=null,this.missing=!1,this.runs=null,this.note=null,this.conflict=!1,this.runsFor="",this.onResult=e=>{e.stopPropagation(),this.note=e.detail},this.onChanged=async e=>{e.stopPropagation();const t=this.schedule?.id;if(e.detail.schedule)this.emit("changed",{schedule:e.detail.schedule});else if(t)try{const s=await G(t);this.schedule&&s.revision!==this.schedule.revision&&(this.conflict=!0),this.emit("changed",{schedule:s})}catch{this.emit("changed",{schedule:null})}t&&this.loadRuns(t)},this.onDeleted=e=>{e.stopPropagation(),this.emit("deleted",e.detail)},this.onCopied=e=>{e.stopPropagation(),this.emit("copied",e.detail)}}connectedCallback(){super.connectedCallback(),Z(this)}willUpdate(e){e.has("schedule")&&this.schedule?.id!==this.runsFor&&(this.runsFor=this.schedule?.id??"",this.runs=null,this.note=null,this.conflict=!1,this.runsFor&&this.loadRuns(this.runsFor)),e.has("open")&&!this.open&&(this.note=null,this.conflict=!1)}async loadRuns(e){try{const t=await Ne({schedule_id:e,limit:10});this.runsFor===e&&(this.runs=t.items)}catch{this.runsFor===e&&(this.runs=[])}}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}get actions(){return this.renderRoot.querySelector("schedule-actions")}disabledWhy(e,t){return e.can[t]?"":e.read_only?.reasons[0]?.message??d("אין הרשאה לפעולה זו.")}renderBody(e){const t=e.upcoming.slice(0,5),s=e.read_only?.reasons??[],n=fe(e);return i`<div class="stack" data-drawer-detail>
      ${s.length?i`<div class="banner info" data-drawer-readonly>${h(e.sensitive?"lock":"eye")}<div>${s[0].message}</div></div>`:l}
      ${this.conflict?i`<div class="banner bad" role="alert" data-drawer-conflict>${h("warning")}<div><b>${d("התזמון שונה במקום אחר")}</b><small>${d("מוצגת הגרסה העדכנית")}</small></div></div>`:l}
      ${e.warnings.map(r=>i`<div class="banner warn" data-drawer-warning>${h("warning")}<div>${r.message}</div></div>`)}
      ${this.note?i`<div class=${`banner ${this.note.tone==="error"?"bad":"info"}`} role="status" data-drawer-status>${h(this.note.tone==="error"?"warning":"check")}<div>${this.note.text}</div></div>`:l}
      <div class="swrow"><span>${d("פעיל")}</span>${e.can.toggle?i`<sw-toggle .checked=${D(e.enabled)} label=${d("פעיל")} labelHidden data-drawer-toggle @change=${we(e.enabled,()=>void this.actions?.enable(e,!e.enabled))}></sw-toggle>`:i`<span class=${`chip ${e.enabled?"ok":""}`} data-drawer-toggle-state title=${this.disabledWhy(e,"toggle")}>${e.enabled?d("פעיל"):d("מושבת")}</span>`}</div>
      <section class="sect" data-section="when">
        <h4>${h("clock")}${d("מתי")}</h4>
        <sw-schedule-bar .slots=${e.slots} .sun=${C()?null:P}></sw-schedule-bar>
        <div class="chips">
          <sw-day-chips .days=${e.days}></sw-day-chips>
          ${n?i`<span class="chip info" data-period>${h("calendar")}${n}</span>`:l}
          <schedule-condition-chip .conditions=${e.conditions}></schedule-condition-chip>
          <sw-schedule-markers .sensitive=${e.sensitive} .lowering=${e.lowering}></sw-schedule-markers>
        </div>
      </section>
      <section class="sect" data-section="slots">
        <h4>${h("play")}${d("משבצות")} <span class="num">${e.slots.length}</span></h4>
        <div class="stack" style="gap:8px" data-drawer-slots>
          ${e.slots.map(r=>i`<div class=${r.supported?"blk slot":"blk slot bad"} data-slot-row=${r.index}>
              <span class="w">${A(r)}</span>
              <span class="acts">${L(r,e).map(o=>i`<span class="act"><i style=${`--c:${K(o.tone)}`}></i><span>${o.label}<small>${o.devices.join(", ")}</small></span></span>`)}${r.unsupported.map(o=>i`<small class="bad-note">${o.message}</small>`)}</span>
            </div>`)}
        </div>
      </section>
      ${e.conditions.items.length?i`<section class="sect" data-section="conditions"><h4>${h("help")}${d("תנאים")}${e.conditions.items.length>1?e.conditions.type==="and"?` · ${d("כולם")}`:` · ${d("אחד מהם")}`:""}</h4>
            <div class="stack" style="gap:8px" data-drawer-conditions>${e.conditions.items.map(r=>Rt(r))}${e.conditions.track?i`<small class="muted">${d("ממשיך לבדוק עד סוף החלון")}</small>`:l}</div></section>`:l}
      <section class="sect" data-section="upcoming">
        <h4>${h("calendar")}${d("ההרצות הבאות")}</h4>
        <div class="stack" style="gap:6px" data-drawer-upcoming>
          ${t.length?t.map(r=>i`<div class="li"><span>${e.slots[r.slot_index]?L(e.slots[r.slot_index],e).map(o=>`${o.label} · ${o.devices.join(", ")}`).join(" | "):""}</span><span>${q(r.at)}${e.conditions.items.length?` · ${d("בתנאי")}`:""}</span></div>`):i`<div class="li"><span class="muted">${M(e)}</span></div>`}
        </div>
      </section>
      <section class="sect" data-section="runs">
        <h4>${h("history")}${d("הרצות אחרונות")}</h4>
        <div class="stack" style="gap:6px" data-drawer-runs>
          ${this.runs===null?i`<div class="li"><span class="muted">${d("טוען…")}</span></div>`:this.runs.length?this.runs.map(r=>i`<div class="li"><span>${q(r.started_at)}${r.via==="run_now"?` · ${d("הרצה ידנית")}`:""}</span><span>${Ke[r.result]}</span></div>`):i`<div class="li"><span class="muted">${d("אין הרצות")}</span></div>`}
        </div>
      </section>
      ${e.tags.length?i`<div class="chips">${e.tags.map(r=>i`<span class="chip">${h("list")}${r}</span>`)}</div>`:l}
      ${e.owner||e.updated_at?i`<div class="by">${e.owner?d("עודכן על ידי {name}",{name:e.owner.display_name}):d("נוצר מחוץ למערכת")}${e.updated_at?` · ${q(e.updated_at)}`:""}</div>`:l}
    </div>`}footer(e){return i`<div class="foot2" slot="footer">
      <button type="button" class="btn primary" data-drawer-edit ?disabled=${!e.can.edit} title=${this.disabledWhy(e,"edit")} @click=${()=>this.emit("edit",{id:e.id})}>${h("edit")}${d("עריכה")}</button>
      <button type="button" class="btn" data-drawer-run ?disabled=${!e.can.run} title=${this.disabledWhy(e,"run")} @click=${()=>this.actions?.run(e)}>${h("play")}${d("הרץ עכשיו")}</button>
      <button type="button" class="btn quiet" data-drawer-copy ?disabled=${!e.can.copy} title=${this.disabledWhy(e,"copy")} @click=${()=>this.actions?.copy(e)}>${h("copy")}${d("שכפול")}</button>
      <button type="button" class="btn quiet dz" data-drawer-delete ?disabled=${!e.can.delete} title=${this.disabledWhy(e,"delete")} @click=${()=>this.actions?.askDelete(e)}>${h("trash")}${d("מחיקה")}</button>
    </div>`}render(){const e=this.schedule;return i`<sw-drawer modal ?open=${this.open} heading=${e?.display_name??d("תזמון")} subheading=${e?F(e):""} @close=${t=>{t.target===t.currentTarget&&(t.stopPropagation(),this.emit("drawer-close"))}}>
      ${e?i`${this.renderBody(e)}
            <schedule-actions .status=${this.status} @result=${this.onResult} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied}></schedule-actions>
            ${this.footer(e)}`:this.missing?i`<div class="statebox" data-drawer-missing>${h("search",30)}<b>${d("התזמון לא נמצא")}</b></div>`:i`<div class="stack" data-drawer-state="loading" aria-busy="true"><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:96px"></span><span class="skl" style="block-size:52px"></span></div>`}
    </sw-drawer>`}};y.styles=[...J,X`
    :host {
      display: contents;
    }
    sw-dialog {
      --sw-surface: var(--mm-sheet-surface);
      --sw-glass-blur: var(--mm-sheet-blur);
    }
    /* the drawer's body is a flex column with a limit (the phone's bottom sheet): nothing in it may shrink to nothing */
    .stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: none;
    }
    .stack > * {
      flex: none;
    }
    /* R5-DEVICES-297: the enable row is the drawer's lead control - a raised key (shadow 1) with a heading-size label */
    .swrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-block-size: 56px;
      padding: 8px 16px;
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      border: 1px solid transparent;
      box-shadow: var(--dv-shadow-1);
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.01em;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    /* R5-DEVICES-297: the slot's time is a display figure */
    .slot .w {
      font-weight: 800;
      font-size: var(--sw-fs-xl);
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
      flex: none;
      min-inline-size: 96px;
      text-align: end;
    }
    .slot .acts {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
      flex: 1;
    }
    .slot .act {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-inline-size: 0;
    }
    .slot .act i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--c);
      flex: none;
    }
    .slot .act small,
    .slot .bad-note {
      display: block;
      color: var(--dv-text-3);
      font-size: var(--sw-fs-sm);
    }
    .blk.slot.bad {
      border-color: color-mix(in srgb, var(--dv-warning) 40%, transparent);
      background: linear-gradient(var(--dv-warning-soft), var(--dv-warning-soft)), var(--dv-surface);
    }
    /* R5-DEVICES-297: the next-run and last-run rows are wells; the time on them is bold */
    .li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-block-size: 46px;
      padding: 8px 14px;
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      border: 1px solid transparent;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .li span:last-child {
      color: var(--dv-text);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      flex: none;
    }
    .muted {
      color: var(--dv-text-3);
    }
    .by {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-3);
    }
    .foot2 {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `];k([O({type:Boolean})],y.prototype,"open",2);k([O({attribute:!1})],y.prototype,"schedule",2);k([O({attribute:!1})],y.prototype,"status",2);k([O({type:Boolean})],y.prototype,"missing",2);k([u()],y.prototype,"runs",2);k([u()],y.prototype,"note",2);k([u()],y.prototype,"conflict",2);y=k([Q("schedule-drawer")],y);const Ct=[St,...J,vt,X`
    /* PAGING-SETTING-2439 (owner round 32, Q-SYS-4 a: the page itself never moves): with the long lists set to scroll (הגדרות › כללי) the
       screen keeps its box on a desktop - the title, the chips, the toolbar and the upcoming strip stay - and only the list panel (.groups) scrolls */
    @media (min-width: 1024px) {
      :host([data-list-panel]) {
        overflow: hidden;
      }
      :host([data-list-panel]) sw-page.page {
        block-size: 100%;
        min-block-size: 0;
      }
      :host([data-list-panel]) .groups {
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
      }
    }
    /* AUDIT30-I3 (owner Q9 option a): dialogs are opaque (was the media sheet surface and its blur) */
    sw-dialog {
      --sw-surface: var(--sw-surface-solid);
      --sw-glass-blur: none;
    }
    /* AUDIT30-I4 (#6, #8): the page frame is the product's <sw-page> (its title, its actions at the end of the title row); the media
       page keeps its padding (.page) and the toolbar below the title. The title row no longer sticks: the floor chips and the toolbar
       are the first rows of the page body. */
    sw-page.page {
      padding-block-start: var(--sw-s-4);
      gap: var(--sw-s-3);
    }
    .dh {
      position: static;
      padding-block-start: 0;
    }
    .dh-row.fl {
      display: flex;
    }
    /* on a desktop the floor chips stay in the title row (sw-page's actions, as before the frame change: the list keeps its rows);
       a long floor list scrolls sideways inside its own strip */
    .dh-row.hdact {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .dh-row.hdact .rooms {
      max-inline-size: 50vw;
    }
    /* AUDIT30-I2 (#4, owner Q3 option a): the chosen floor chip is the Blue Wash pair (the shared media rule paints it --dv-text) */
    .rc[aria-pressed='true'] {
      ${$e}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .rc[aria-pressed='true']::before {
      ${xe}
    }
    .dh-det .grow {
      min-inline-size: 0;
    }
    /* POLISH-295: narrow enough that the review chip, the filter, the search and "חדש" stay on the toolbar row at 1440 */
    .search {
      min-inline-size: 150px;
      flex: 1 1 150px;
      max-inline-size: 260px;
    }
    /* POLISH-295: below a wide desktop the filter button is its icon (and its count), so the toolbar stays one row */
    @media (min-width: 768px) and (max-width: 1600px) {
      .foldbtn .lbl {
        display: none;
      }
    }
    .newbtn[disabled] {
      opacity: 0.5;
    }
    .foldbtn small {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-bold);
      color: var(--dv-accent-text);
    }
    .vwrap {
      flex: none;
    }
    /* CR-CMP2-SEGMENTED-C-2450: the view switch is sw-segmented (icon-only keys); its 40 / 44 px keys and the larger icon through the knobs */
    sw-segmented.views {
      --sw-seg-ico-pad: 12px;
      --sw-seg-key-min-w: 40px;
      --sw-seg-icon-size: var(--sw-fs-lg);
    }
    /* the filters behind "סינון": the same chips and dropdown chips as the header */
    .more {
      flex: 1 1 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 10px;
    }
    .more .days {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
      max-inline-size: 100%;
    }
    /* the bubble skin: the card's selection box and "..." key meet the touch dial on every width (the skin's rule) */
    @media (min-width: 1101px) and (pointer: fine) {
      :host([data-skin='bubble']) .pick,
      :host([data-skin='bubble']) .more-btn {
        inline-size: var(--sw-touch-desktop);
        block-size: var(--sw-touch-desktop);
      }
    }
    .rc.day {
      inline-size: 38px;
      padding-inline: 0;
    }
    .more .sep {
      inline-size: 1px;
      block-size: 22px;
      background: var(--dv-border);
    }
    .dh.compact .more {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
    }
    /* ---- "today" (the runs still to come today): one quiet glass row ---- */
    .upnext {
      display: flex;
      align-items: center;
      gap: 10px 14px;
      padding: 8px 16px;
      flex-wrap: wrap;
    }
    .upnext::-webkit-scrollbar {
      display: none;
    }
    /* R5-DEVICES-297: "today" is the live object of the list - its word is a heading and the next time a display figure */
    .upnext > b {
      flex: none;
      font-size: var(--sw-fs-lg);
      font-weight: 800;
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.01em;
    }
    .up {
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-md);
      color: var(--dv-text);
      white-space: nowrap;
    }
    .up time {
      font-weight: 800;
      font-size: var(--sw-fs-xl);
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.02em;
    }
    .up .what {
      color: var(--dv-text-2);
    }
    .up i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--c);
      flex: none;
    }
    /* ---- the card: the automation card's shape (sw-automation-card.ts), a schedule's content ---- */
    .acard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px 14px;
      block-size: 100%;
      background: var(--mm-sheen), var(--dv-surface);
      -webkit-backdrop-filter: var(--dv-surface-blur);
      backdrop-filter: var(--dv-surface-blur);
      border: 1px solid var(--dv-border);
      border-radius: var(--sw-r-2xl);
      box-shadow: var(--dv-shadow-2);
      transition: box-shadow var(--mm-motion) var(--mm-ease), border-color var(--mm-motion);
    }
    /* R5-DEVICES-297: the card is the top step (shadow 2 at rest); hover is for a fine pointer only */
    @media (hover: hover) and (pointer: fine) {
      .acard:hover {
        box-shadow: var(--dv-shadow-3, var(--dv-shadow-2));
      }
    }
    .acard:focus-within {
      border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    .acard[data-picked] {
      border-color: var(--dv-accent);
      box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
    }
    .acard[data-menu] {
      z-index: 20;
    }
    .acard.off .bar,
    .acard.off .meta {
      opacity: 0.55;
    }
    .acard header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-inline-size: 0;
    }
    .ttl {
      flex: 1;
      min-inline-size: 0;
    }
    .acard h3 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.02em;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    a.name {
      color: inherit;
      text-decoration: none;
    }
    .acard a.name::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    a.name:focus-visible {
      outline: none;
    }
    .where {
      display: flex;
      align-items: center;
      gap: 0 8px;
      margin-block-start: 3px;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      min-inline-size: 0;
    }
    .where b {
      color: var(--dv-text);
      font-weight: var(--sw-fw-bold);
      white-space: nowrap;
    }
    .where .ic {
      font-size: var(--sw-fs-md);
      color: var(--dv-text-3);
    }
    .where .ar {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ctl,
    .pick,
    .bar,
    .meta,
    .acard footer {
      position: relative;
      z-index: 2;
    }
    .ctl {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: none;
    }
    .pick {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      margin-block-start: -2px;
      margin-inline-start: -6px;
      border-radius: 50%;
      flex: none;
      cursor: pointer;
    }
    .pick:hover {
      background: var(--dv-surface-3);
    }
    input[type='checkbox'] {
      inline-size: 17px;
      block-size: 17px;
      accent-color: var(--dv-accent);
      margin: 0;
      cursor: pointer;
    }
    .more-btn {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--dv-text-2);
    }
    .more-btn:hover,
    .more-btn[aria-expanded='true'] {
      background: var(--dv-surface-3);
      color: var(--dv-text);
    }
    .more-btn .ic {
      font-size: var(--sw-fs-2xl);
    }
    .acard .pop {
      background: var(--sw-menu-surface);
      inset-block-start: 52px;
      inset-inline-end: 12px;
      min-inline-size: 190px;
    }
    .acard .pop button {
      flex: none;
    }
    .pop button.dz,
    .pop button.dz .ic {
      color: var(--dv-danger);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
      min-block-size: 26px;
    }
    .acard footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin-block-start: auto;
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
    }
    .run {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-variant-numeric: tabular-nums;
      min-inline-size: 0;
    }
    .run b {
      color: var(--sw-heading, var(--dv-text));
      font-weight: 800;
      font-size: var(--sw-fs-lg);
    }
    /* ---- POLISH-295: the rows view (the approved preview): one row per schedule, the whole row opens the drawer ----
       R5-DEVICES-297: the rows are wells (one tone step down, rounded, no hairlines) inside the glass panel; the name is a heading,
       the next-run time a bold figure; a disabled schedule sits a step deeper with quiet ink; the row sinks on pointer-down */
    .rlist {
      padding: 4px;
      overflow: visible;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .lr {
      position: relative;
      display: grid;
      grid-template-columns: 44px minmax(0, 1.6fr) auto minmax(140px, 1.3fr) minmax(130px, 1fr) 44px;
      align-items: center;
      gap: var(--sw-s-3);
      /* loop 2: 56 px rows + 4 px gaps pushed the pager under the fold at 1440x900 (no scrolling in control screens): 52 + 3 keeps
         ten rows and the pager on one screen */
      min-block-size: 52px;
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-2);
      font-size: var(--sw-fs-base);
      transition: background-color var(--mm-motion) var(--mm-ease), transform var(--sw-t-fast, 120ms) var(--sw-ease, ease-out);
    }
    .rlist.picking .lr {
      grid-template-columns: 32px 44px minmax(0, 1.6fr) auto minmax(140px, 1.3fr) minmax(130px, 1fr) 44px;
    }
    .lr[data-picked] {
      background: var(--dv-accent-soft);
    }
    .lr[data-menu] {
      z-index: 20;
    }
    .lr.off {
      background: var(--dv-surface-3);
    }
    .lr:active {
      transform: scale(var(--sw-press-scale, 1));
      background: var(--sw-pressed-wash, var(--dv-surface-3));
    }
    @media (hover: hover) and (pointer: fine) {
      .lr:hover {
        background: var(--dv-surface-3);
      }
      .lr[data-picked]:hover {
        background: var(--dv-accent-soft);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .lr {
        transition-duration: 0.01ms;
      }
    }
    .lr .name {
      display: block;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lr .name::after {
      content: '';
      position: absolute;
      inset: 0;
    }
    .lr .name:focus-visible::after {
      outline: var(--sw-focus-w) solid var(--dv-focus);
      outline-offset: -2px;
    }
    .lname {
      min-inline-size: 0;
    }
    .lname .sub {
      display: block;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .lname .sub b {
      color: var(--dv-text);
      font-weight: var(--sw-fw-semibold);
    }
    .lsel,
    .ltog,
    .lops {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
    }
    .lops {
      justify-content: flex-end;
    }
    /* FIX2200: the menu key keeps its touch size (the column is 44 px; a flex item shrank it to 36-40 px, the 2.20.0 bubble guard) */
    .lops .more-btn {
      flex: none;
    }
    .lops .pop {
      background: var(--sw-menu-surface);
      inset-block-start: 42px;
      inset-inline-end: 0;
      min-inline-size: 190px;
    }
    .lsel .pick {
      margin: 0;
    }
    .lr.off .ldays,
    .lr.off .lbar {
      opacity: 0.55;
    }
    .lr.off .name {
      color: var(--dv-text-2);
      font-weight: var(--sw-fw-semibold);
    }
    .lbar {
      min-inline-size: 0;
    }
    .lnext {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .lnext b {
      color: var(--sw-heading, var(--dv-text));
      font-weight: 800;
      font-size: var(--sw-fs-lg);
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .lnext.warn {
      color: var(--sw-warning-text);
      font-weight: var(--sw-fw-semibold);
    }
    /* the pager sits close under its page (the groups' 30 px gap is for groups), so a page of rows fits 1440x900 */
    .lfoot {
      display: flex;
      justify-content: flex-end;
      margin-block-start: calc(var(--sw-s-6) * -1);
    }
    /* the review chip beside the state filter (an administrator's; it replaced the banner) */
    .rc.attn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .rc.attn small {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-warning-text);
    }
    .wdot {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--dv-warning);
      flex: none;
    }
    /* "today" as a 24-hour timeline (LTR like every time bar of the product) */
    .upnext .tl {
      position: relative;
      flex: 1 1 260px;
      min-inline-size: 160px;
      block-size: 30px;
      direction: ltr;
    }
    .upnext .track {
      position: absolute;
      inset-inline: 0;
      inset-block-start: 6px;
      block-size: 6px;
      border-radius: var(--sw-r-2xs);
      background: var(--dv-surface-3);
      overflow: hidden;
    }
    .upnext .past {
      position: absolute;
      inset-block: 0;
      left: 0;
      background: var(--dv-border-strong);
    }
    .upnext .now {
      position: absolute;
      inset-block-start: 1px;
      block-size: 16px;
      inline-size: 2px;
      margin-inline-start: -1px;
      background: var(--dv-accent);
      border-radius: 1px;
    }
    .upnext .hr {
      position: absolute;
      inset-block-start: 15px;
      transform: translateX(-50%);
      font-size: var(--sw-fs-2xs);
      color: var(--dv-text-3);
      font-variant-numeric: tabular-nums;
    }
    .upnext .hr.h0 {
      transform: none;
    }
    .upnext .hr.h24 {
      transform: translateX(-100%);
    }
    .upnext .tdot {
      position: absolute;
      inset-block-start: 9px;
      inline-size: 10px;
      block-size: 10px;
      margin: -5px 0 0 -5px;
      border-radius: 50%;
      background: var(--c);
      box-shadow: 0 0 0 2px var(--dv-surface);
      transition: transform var(--mm-motion) var(--mm-ease);
    }
    .upnext .tdot.nx {
      inline-size: 12px;
      block-size: 12px;
      margin: -6px 0 0 -6px;
    }
    a.up {
      color: inherit;
      text-decoration: none;
      min-block-size: 32px;
    }
    /* FIX2200: the bubble skin's touch dial is the floor of every hit target, the next-run link included (195x32 in the 2.20.0 guard) */
    :host([data-skin='bubble']) a.up {
      min-block-size: var(--sw-touch-desktop);
    }
    /* FIX2200: the pager's keys meet the touch dial in the bubble skin (30x30 in the 2.20.0 guard) */
    :host([data-skin='bubble']) sw-pager {
      --sw-ctl-h-md: var(--sw-touch-desktop);
    }
    @media (pointer: coarse), (max-width: 767px) {
      a.up {
        min-block-size: 44px;
      }
      /* FIX2232B: the pager's keys are 44 px touch targets at a phone width too (30x30 in the 2.23.2 guard since the cards view pages) */
      sw-pager {
        --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px));
        --sw-ctl-h-lg: max(44px, var(--sw-touch-desktop, 44px));
      }
      /* the shared back key of the trash and the review pages (sw-page backHref) is a 44 px target at a phone width too (28x28 in
         the I18N-EN-SWITCH-2438 entry check, layout-schedules-parity) */
      sw-page::part(back) {
        --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px));
      }
    }
    a.up:focus-visible {
      outline: var(--sw-focus-w) solid var(--dv-focus);
      outline-offset: 2px;
      border-radius: var(--sw-r-xs);
    }
    .upnext .up .nm {
      max-inline-size: 22ch;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media (max-width: 1100px) and (min-width: 768px) {
      .lr {
        grid-template-columns: 44px minmax(0, 1.6fr) auto minmax(130px, 1fr) 44px;
      }
      .rlist.picking .lr {
        grid-template-columns: 32px 44px minmax(0, 1.6fr) auto minmax(130px, 1fr) 44px;
      }
      .lr > .lbar {
        display: none;
      }
    }
    @media (max-width: 767px) {
      .lr {
        grid-template-columns: 44px minmax(0, 1fr) auto 44px;
        gap: var(--sw-s-2);
        padding-inline: var(--sw-s-3);
      }
      .rlist.picking .lr {
        grid-template-columns: 28px 44px minmax(0, 1fr) auto 44px;
      }
      .lr > .ldays,
      .lr > .lbar {
        display: none;
      }
      /* loop 2 (break-ui at 390 px): the next-run column was 38vw and the name was cut to one word ("מאוור..."): the time keeps
         its weight at the base size and the name gets the room */
      .lnext {
        /* R5 fix: 30vw cut the next-run line ("היום 17:00 · ב..."); the earlier 38vw shows it whole again */
        max-inline-size: 38vw;
        font-size: var(--sw-fs-sm);
      }
      .lnext b {
        font-size: var(--sw-fs-base);
      }
      .lr .name {
        font-size: var(--sw-fs-md);
      }
      .upnext .tl {
        flex-basis: 100%;
        order: 2;
      }
    }
    /* ---- the table ---- */
    .tbl {
      overflow: hidden;
      padding: 0;
    }
    .tr {
      display: grid;
      grid-template-columns: 34px minmax(160px, 1.4fr) auto minmax(230px, 1.9fr) minmax(120px, 1fr) 118px 60px 92px;
      gap: 12px;
      align-items: center;
      padding: 10px 16px;
      border-block-end: 1px solid var(--dv-border);
      font-size: var(--sw-fs-base);
    }
    .tr:last-child {
      border-block-end: 0;
    }
    /* R5-DEVICES-297: the table's header is a heading row (bold, heading ink); a name is a heading, a disabled row a deeper well */
    .tr.h {
      background: var(--dv-surface-2);
      color: var(--sw-heading, var(--dv-text));
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-bold);
      padding-block: 10px;
    }
    .tr[data-picked] {
      background: var(--dv-accent-soft);
    }
    .tr.off {
      background: var(--dv-surface-3);
    }
    .tr.off .name,
    .tr.off .slotrows {
      opacity: 0.6;
    }
    .tr .name {
      display: block;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading, var(--dv-text));
      letter-spacing: -0.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @media (hover: hover) and (pointer: fine) {
      .tr .name:hover {
        color: var(--dv-accent-text);
      }
    }
    .tr .sub {
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .slotrows {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
    }
    .sr {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
    }
    .sr .w {
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--dv-text));
      direction: ltr;
      text-align: end;
      unicode-bidi: isolate;
    }
    .sr .a {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .ac {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 1px 8px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
      background: color-mix(in srgb, var(--c) 16%, transparent);
      color: var(--dv-text);
      max-inline-size: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .linkbtn {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--dv-accent-text);
      background: none;
      border: 0;
      padding: 0;
      text-align: start;
      min-block-size: 28px;
    }
    .ops {
      display: inline-flex;
      gap: 2px;
      justify-content: flex-end;
    }
    /* ---- trash, review: rows of the drawer's block style ---- */
    .rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      border-radius: var(--sw-r-2xl);
    }
    .li .t {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
    }
    .li .d {
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .li .issues {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 6px;
    }
    /* an issue is a sentence-long chip: it wraps inside the row on a narrow phone */
    .li .issues .chip {
      white-space: normal;
      block-size: auto;
      min-block-size: 26px;
      padding-block: 3px;
      max-inline-size: 100%;
    }
    .li .lops {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    /* 2026-10-04: an administrator's "fine from our side" - the warning chip gives way to a small muted state */
    .li .issues .iss {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: 100%;
    }
    .li .issues .chip.acked {
      background: transparent;
      color: var(--dv-text-2);
      border: 1px solid var(--dv-line, var(--sw-border));
      font-weight: var(--sw-fw-medium);
    }
    /* ---- the bulk bar: the edit bar of the glass style, kept at the bottom while scrolling ---- */
    .bulk {
      position: sticky;
      inset-block-end: 14px;
      z-index: 6;
      align-self: center;
      max-inline-size: 100%;
    }
    /* the note is a popover (top layer): a modal drawer or dialog is open while most notes appear, and must not dim them */
    .toast[popover] {
      inset-block-start: auto;
      margin-block: 0;
      padding: 11px 20px 11px 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: visible;
    }
    .toast .btn {
      min-block-size: 28px;
      padding-inline: 12px;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      border-color: transparent;
      box-shadow: none;
      margin-inline-start: 6px;
    }
    .dlgform {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-block-start: 4px;
    }
    .dlgform p {
      margin: 0;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-md);
    }
    .dlgrow {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    @media (pointer: coarse), (max-width: 1100px) {
      .pick,
      .more-btn {
        inline-size: 44px;
        block-size: 44px;
      }
      sw-segmented.views {
        --sw-seg-key-min-w: 44px;
      }
      .rc.day {
        inline-size: 44px;
      }
      .linkbtn {
        min-block-size: 44px;
      }
    }
    @media (max-width: 1100px) {
      .tr {
        grid-template-columns: 34px minmax(120px, 1.4fr) minmax(160px, 2fr) minmax(80px, 1fr) 104px 56px 92px;
      }
      .tr > .cdays {
        display: none;
      }
    }
    @media (max-width: 767px) {
      /* the phone: the view switch moves under the search row (the title row keeps the automations screen's height, so the
         segment strip stays in place when switching between the two screens) */
      .dh-row {
        grid-template-areas: 't .' 'r r';
        grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px);
      }
      .dh-det .vwrap {
        order: 4;
      }
      .dh-det {
        gap: 10px;
      }
      /* CR-CMP2-TABS-2460: the kind strip takes the first line of the phone toolbar (sw-tabs fill="phone" shares it equally) */
      .dh-det sw-tabs.kinds {
        order: 1;
      }
      .dh-det .stf {
        order: 2;
        inline-size: 100%;
        display: none;
        flex-wrap: wrap;
        justify-content: flex-start;
      }
      .dh-det .stf::-webkit-scrollbar {
        display: none;
      }
      .dh-det .stf[data-open] {
        display: inline-flex;
      }
      .dh-det .grow {
        display: none;
      }
      .dh-det .search {
        order: 3;
        flex: 1 1 120px;
        min-inline-size: 0;
      }
      .dh-det .foldbtn,
      .dh-det .newbtn,
      .dh-det .rc.attn {
        order: 3;
      }
      .more {
        order: 5;
      }
      .tr.h {
        display: none;
      }
      .tr {
        grid-template-columns: 34px minmax(0, 1fr) auto;
        grid-template-areas: 'sel name tog' '. slots slots' '. days days' '. cond next';
        row-gap: 8px;
        padding: 12px 14px;
      }
      .tr > .csel {
        grid-area: sel;
      }
      .tr > .cname {
        grid-area: name;
      }
      .tr > .cslots {
        grid-area: slots;
      }
      .tr > .cdays {
        grid-area: days;
        display: block;
      }
      .tr > .ccond {
        grid-area: cond;
      }
      .tr > .cnext {
        grid-area: next;
        text-align: end;
      }
      .tr > .ctog {
        grid-area: tog;
      }
      .tr > .cops {
        display: none;
      }
      .acard {
        padding: 14px 16px 12px;
        border-radius: var(--sw-r-2xl);
      }
      .bulk {
        inset-block-end: calc(var(--sw-bottomnav-h) + 10px);
      }
    }
  `];var Tt=Object.defineProperty,Ft=Object.getOwnPropertyDescriptor,m=(e,t,s,n)=>{for(var r=n>1?void 0:n?Ft(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(r=(n?c(t,s,r):c(r))||r);return n&&r&&Tt(t,s,r),r};const N="sw.schedules.view",me="sw.schedules.filters",z="/devices/schedules",Lt={rows:"rows",cards:"grid",table:"list",week:"calendar"},Ot={rows:()=>T("rows"),cards:()=>a("כרטיסים"),table:()=>a("טבלה"),week:()=>a("שבוע")},It=["rows","cards","table","week"];function be(e){return Math.min(1,Math.max(0,(e.getHours()*60+e.getMinutes())/1440))}const Pt=new Set(["menuFor","note","busy"]);function ge(e){const t=[...new Set(e.entities.map(s=>s.floor_name).filter(s=>!!s))];return t.length===1?t[0]:""}let p=class extends Y{constructor(){super(...arguments),this.bubbleSkin=new ye(this),this.kavarnit={schedules:!0,automations:!0},this.autoKinds=null,this.autoCounts=null,this.status=null,this.items=null,this.buildingMeta=null,this.building="",this.failed="",this.noView=!1,this.filters={...I},this.view="rows",this.defaultView="rows",this.perPage=ke.schedules,this.page=1,this.fitRows=null,this.lists=new Ae(this,()=>{this.page=1,this.fitRows=null}),this.selecting=!1,this.filtersOpen=!1,this.selected=new Set,this.sub="",this.detail=null,this.detailMissing=!1,this.drawerUsed=!1,this.trash=null,this.review=null,this.subError="",this.note=null,this.createOpen=!1,this.busy=!1,this.reviewSel=new Set,this.menuFor="",this.compactHeader=!1,this.phone=window.matchMedia("(max-width: 767px)").matches,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offEdit=null,this.offSelect=null,this.stopWs=null,this.lastWritten="",this.rounds=new xt(e=>this.refreshRound(e),(e,t)=>e||t),this.detailReads=new yt,this.filteredMemo=new W,this.buildingMemo=new W,this.sortedMemo=new W,this.urlTimer=0,this.noteTimer=0,this.resizeFrame=new ze(()=>{this.fitRows=null,this.requestUpdate()}),this.onResize=this.resizeFrame.schedule,this.onScroll=()=>{const e=this.scrollTop>40;e!==this.compactHeader&&(this.compactHeader=e)},this.onOutside=e=>{if(!this.menuFor)return;const t=this.renderRoot.querySelector(`[data-schedule="${CSS.escape(this.menuFor)}"]`);(!t||!e.composedPath().includes(t))&&(this.menuFor="")},this.onKey=e=>{this.menuFor&&e.key==="Escape"&&(this.menuFor="")},this.onChanged=e=>{const t=e.detail?.schedule;t?(this.items=(this.items??[]).map(s=>s.id===t.id?{...t,raw:void 0,...s.buildings?{buildings:s.buildings}:{}}:s),this.detail?.id===t.id&&(this.detail=t),this.refreshStatusOnly()):this.refresh()},this.onDeleted=e=>{const{trashId:t,name:s,scheduleId:n}=e.detail;this.items=(this.items??[]).filter(r=>r.id!==n),this.sub===n&&this.go(""),this.refreshStatusOnly(),this.say(a('"{name}" נמחק',{name:s}),"ok",{label:a("שחזור"),run:()=>void this.restore(t)})},this.onCopied=e=>{this.refresh(),this.go(e.detail.schedule.id)},this.onResult=e=>{this.say(e.detail.text,e.detail.tone)},this.trashLowering=null,this.purging=null}connectedCallback(){super.connectedCallback(),Z(this),this.phoneMq.addEventListener("change",this.onPhone),window.addEventListener("resize",this.onResize),this.addEventListener("scroll",this.onScroll,{passive:!0}),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey),this.offEdit=ee({id:"schedules-trash",label:a("סל מחזור"),icon:"trash",can:()=>_(this.status).kind==="ready"&&this.sub!=="trash",run:()=>this.go("trash")});const e=pe(me),t=R(pe(N))??R(zt(N)),s=te().params;this.filters=s.toString()?H(s):e?H(de({...I,...e})):{...I},this.view=R(s.get("view"))??t??this.defaultView;const n=!!R(s.get("view"));Se().then(r=>{this.defaultView=r.schedulesView,this.perPage=r.pageSize.schedules,!n&&!t&&(this.view=r.schedulesView)}),this.offSelect=ee({id:"schedules-select",label:T("select"),icon:"check",can:()=>_(this.status).kind==="ready"&&!this.sub&&this.view!=="week"&&!this.selecting,run:()=>this.selecting=!0}),this.filtersOpen=ce(this.filters)>0,this.offRoute=_e(r=>this.onRoute(r)),this.load(),this.loadSegments(),this.stopWs=Xe(()=>void this.refresh())}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),window.removeEventListener("resize",this.onResize),this.resizeFrame.cancel(),this.removeEventListener("scroll",this.onScroll),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey),this.offRoute?.(),this.offEdit?.(),this.offSelect?.(),this.stopWs?.(),window.clearTimeout(this.urlTimer),window.clearTimeout(this.noteTimer)}willUpdate(){this.toggleAttribute("data-list-panel",!this.lists.paged&&this.view!=="week"&&this.sub!=="trash"&&this.sub!=="review"&&!!this.items?.length)}updated(e){(!e.size||[...e.keys()].some(s=>!Pt.has(s)))&&($t(this.renderRoot,this.phone),this.measureFit());const t=this.renderRoot.querySelector(".toast[popover]");if(t)try{t.matches(":popover-open")||t.showPopover()}catch{}}measureFit(){const e=this.view==="rows"?"[data-sched-rows]":this.view==="table"?"[data-sched-table]":this.view==="cards"?"[data-sched-grid]":"",t=e&&!this.filters.group&&!this.sub&&this.lists.paged?this.renderRoot.querySelector(e):null,s=Ee({host:this,list:t,itemSelector:"[data-schedule]",pager:this.renderRoot.querySelector("[data-sched-pager]"),padded:[this.renderRoot.querySelector(".page")]});s!==null&&(this.fitRows===null||s<this.fitRows)&&(this.fitRows=s)}async loadSegments(){if(this.kavarnit.automations)try{await je();const e=await qe().status();if(e.available==="feature_disabled")return;this.autoKinds=kt(e),this.autoCounts={automation:e.counts.automations,script:e.counts.scripts,scene:e.counts.scenes}}catch{this.autoKinds=null}}onRoute(e){if(e.segments[0]!=="devices"||e.segments[1]!=="schedules")return;const t=e.segments[2]??"",s=t==="new"?"":decodeURIComponent(t),n=e.params.toString();n!==this.lastWritten&&(n||this.lastWritten)&&(this.filters=H(e.params),this.view=R(e.params.get("view"))??this.view,this.lastWritten=n),s!==this.sub&&(this.sub=s,this.menuFor="",this.onSub())}path(e){return e?`${z}/${encodeURIComponent(e)}`:z}params(){return de(this.filters,this.view,this.defaultView)}go(e){const t=this.params();this.lastWritten=t.toString(),Re(this.path(e),t)}syncUrl(e=0){window.clearTimeout(this.urlTimer),this.urlTimer=window.setTimeout(()=>{const t=this.params();this.lastWritten=t.toString(),Ce(this.path(this.sub),t),ue(me,this.filters)},e)}href(e){const t=this.params().toString();return`#${this.path(e)}${t?`?${t}`:""}`}async onSub(){const e=this.sub;if(this.subError="",e==="trash")return void this.loadTrash();if(e==="review")return void this.loadReview();if(!e){this.detail=null,this.detailMissing=!1;return}this.drawerUsed=!0,this.detailMissing=!1,this.detail=this.items?.find(s=>s.id===e)??null;const t=this.detailReads.begin();try{const s=await G(e);this.sub===e&&t()&&(this.detail=s)}catch(s){this.sub===e&&s instanceof E&&s.status===404&&(this.detail=null,this.detailMissing=!0)}}demoLoading(){return!C()&&te().params.get("state")==="loading"}async load(){if(!this.demoLoading()){try{this.status=await V()}catch(e){e instanceof E&&e.status===403?this.noView=!0:this.failed=$(e);return}if(_(this.status).kind!=="ready"){this.items=[];return}await this.loadList(),this.sub&&this.onSub()}}async loadList(){try{const e=await Ye({limit:500});this.items=e.items,this.buildingMeta=e.building_filter??null,this.building=Te(this.buildingMeta,this.building||Fe()),this.failed="",this.selected=new Set([...this.selected].filter(t=>e.items.some(s=>s.id===t)))}catch(e){this.items===null&&(this.failed=$(e))}}refresh(e=!1){return this.rounds.run(e)}async refreshRound(e){try{this.status=await V(e)}catch{}if(_(this.status).kind==="ready"&&await this.loadList(),this.sub==="trash")await this.loadTrash();else if(this.sub==="review")await this.loadReview();else if(this.sub){const t=this.sub,s=this.detailReads.begin();try{const n=await G(t);this.sub===t&&s()&&(this.detail=n)}catch{}}}async loadTrash(){try{this.trash=(await Qe()).items,this.subError=""}catch(e){this.subError=$(e)}}async loadReview(){try{this.review=(await Je()).items,this.subError=""}catch(e){this.subError=$(e)}}say(e,t="ok",s){window.clearTimeout(this.noteTimer),this.note={text:e,tone:t,action:s},this.noteTimer=window.setTimeout(()=>this.note=null,s?1e4:4e3)}get actionsHost(){return this.renderRoot.querySelector("schedule-actions")}async refreshStatusOnly(){try{this.status=await V()}catch{}}async restore(e,t){try{const s=await ie(e);this.say(a('"{name}" שוחזר',{name:s.schedule.display_name}),"ok",{label:a("פתיחה"),run:()=>this.go(s.schedule.id)}),await this.refresh()}catch(s){if(s instanceof E&&s.code==="lowering_confirmation_required"&&t){this.trashLowering=t;return}this.say($(s),"error"),await this.refresh()}}async confirmTrashLowering(e){const t=this.trashLowering;if(t){e.stopPropagation();try{const s=await ie(t.trash_id,{confirm_lowering:!0,alarm_code:e.detail?.alarm_code??null});this.trashLowering=null,this.say(a('"{name}" שוחזר',{name:s.schedule.display_name}),"ok",{label:a("פתיחה"),run:()=>this.go(s.schedule.id)}),await this.refresh()}catch(s){this.trashLowering=null,this.say($(s),"error")}}}setFilter(e,t=0){this.filters={...this.filters,...e},this.page=1,this.syncUrl(t)}clearFilters(){this.filters={...I,sort:this.filters.sort,group:this.filters.group},this.page=1,this.syncUrl()}setView(e){this.view=e,this.page=1,this.fitRows=null,ue(N,e),this.syncUrl()}newSchedule(){customElements.get("schedule-create-dialog")?this.createOpen=!0:S(`${z}/new/edit`)}toggleSel(e,t){const s=new Set(this.selected);t?s.add(e):s.delete(e),this.selected=s}async bulk(e){const t=(this.items??[]).filter(r=>this.selected.has(r.id)),s=rt(t).filter(r=>e==="disable"?r.enabled:!r.enabled).filter(r=>e==="disable"||!r.lowering),n=e==="enable"?t.filter(r=>r.lowering&&!r.enabled).length:0;if(!s.length){this.say(n?a("תזמונים שפותחים או מנטרלים מופעלים אחד־אחד"):a("אין בבחירה תזמונים לשינוי"),"error");return}this.busy=!0;try{const r=await ne(e,s.map(x=>x.id)),o=r.results.filter(x=>x.ok).length,c=r.results.length-o,f=e==="enable"?a("הופעלו {n}",{n:o}):a("הושבתו {n}",{n:o});this.say(c?`${f}; ${a("{n} לא שונו",{n:c})}`:`${f}${n?`; ${a("{n} מופעלים אחד־אחד",{n})}`:""}`,c?"error":"ok"),this.selected=new Set}catch(r){this.say($(r),"error")}finally{this.busy=!1,await this.refresh()}}async ack(e,t,s){this.busy=!0;try{await Ze(e,t,s),this.say(s?a("האזהרה הוחזרה"):a("סומן כתקין"))}catch(n){this.say($(n),"error")}finally{this.busy=!1,this.sub!=="review"&&await this.loadReview(),await this.refresh()}}async bulkReview(){const e=(this.review??[]).map(t=>t.schedule).filter(t=>this.reviewSel.has(t.id)&&t.enabled&&t.can.toggle);if(e.length){this.busy=!0;try{const t=await ne("disable",e.map(n=>n.id)),s=t.results.filter(n=>n.ok).length;this.say(a("הושבתו {n}",{n:s}),s===t.results.length?"ok":"error"),this.reviewSel=new Set}catch(t){this.say($(t),"error")}finally{this.busy=!1,await this.refresh()}}}async doPurge(){const e=this.purging;if(e){try{await et(e.trash_id),this.purging=null,this.say(a('"{name}" נמחק לצמיתות',{name:e.name||a("תזמון ללא שם")}))}catch(t){this.purging=null,this.say($(t),"error")}await this.loadTrash()}}toggle(e,t){this.actionsHost?.enable(e,t)}menuAct(e,t){this.menuFor="",t==="run"?this.actionsHost?.run(e):t==="edit"?S(`${z}/${e.id}/edit`):t==="copy"?this.actionsHost?.copy(e):this.actionsHost?.askDelete(e)}header(e){const t=this.sub;if(t==="trash"||t==="review")return l;const s=this.scopedItems(),n=he(s,"floor"),r=this.filters,o=e.kind==="ready"&&this.items!==null,c=!!this.status?.can.manage,f=ce(r),x=lt(s),b=e.admin?this.status?.counts.attention??0:0,w=o&&n.length?i`<div class="rooms" role="group" aria-label=${a("קומות")}>
          <button type="button" class="rc" aria-pressed=${String(!r.floor)} data-floor="" @click=${()=>this.setFilter({floor:""})}>${a("הכל")}</button>
          ${n.map(g=>i`<button type="button" class="rc" aria-pressed=${String(r.floor===g.value)} data-floor=${g.value} @click=${()=>this.setFilter({floor:g.value})}>${v(g.label)}</button>`)}
        </div>`:l;return i`${this.phone?l:i`<div class="dh-row hdact" slot="actions">${w}${o&&s.length?i`<div class="vwrap">${this.viewSwitch()}</div>`:l}</div>`}
    <header class="dh" data-sched-header>
      ${this.phone&&w!==l?i`<div class="dh-row fl">${w}</div>`:l}
      ${o?i`<div class="dh-det" data-sched-toolbar>
        ${this.renderSegments()}
        ${this.buildingMeta?i`<sw-building-filter .filter=${this.buildingMeta} value=${this.building}
          @building-change=${g=>{this.building=g.detail.value,this.page=1}}></sw-building-filter>`:l}
        ${s.length?i`<sw-segmented class="stf" radio size="sm" label=${a("סינון לפי מצב")} ?data-open=${this.filtersOpen} value=${r.state} @change=${g=>this.setFilter({state:g.detail.value})}
          .options=${ot.map(g=>({value:g.id,label:g.label,count:String(x[g.id]),attrs:{"data-state-filter":g.id||"all"}}))}></sw-segmented>`:l}
        ${b?i`<button type="button" class="rc attn" data-open-review data-sched-attention @click=${()=>this.go("review")}><i class="wdot" aria-hidden="true"></i>${T("review")}<small>${b}</small></button>`:l}
        ${s.length?i`<button type="button" class="btn foldbtn" data-filters-toggle aria-label=${a("סינון")} title=${a("סינון")} aria-expanded=${String(this.filtersOpen)} @click=${()=>this.filtersOpen=!this.filtersOpen}>${h("filter")}<span class="lbl">${a("סינון")}</span>${f?i`<small>${f}</small>`:l}</button>`:l}
        <span class="grow"></span>
        ${s.length&&this.phone?i`<div class="vwrap">${this.viewSwitch()}</div>`:l}
        ${s.length?i`<label class="search">${h("search")}<span class="sr-only">${a("חיפוש")}</span><input type="search" data-filter="q" placeholder=${this.phone?a("חיפוש"):a("חיפוש תזמון, התקן או תג")} .value=${D(r.q)} @input=${g=>this.setFilter({q:g.target.value},250)} /></label>`:l}
        ${c?i`<button type="button" class="btn primary newbtn" data-new-schedule ?disabled=${e.readOnly} title=${e.readOnly?e.readOnlyText:""} @click=${()=>this.newSchedule()}>${h("plus")}<span class="lbl">${a("חדש")}</span></button>`:l}
        ${s.length&&this.filtersOpen?this.renderMoreFilters(s):l}
      </div>`:l}
    </header>`}viewSwitch(){return i`<sw-segmented class="views" size="sm" labels="none" label=${a("תצוגה")} value=${this.view} @change=${e=>this.setView(e.detail.value)}
      .options=${It.map(e=>({value:e,label:Ot[e](),icon:h(Lt[e]),attrs:{"data-view-btn":e}}))}></sw-segmented>`}renderSegments(){const e=this.kavarnit.automations?Ve.filter(n=>this.autoKinds?this.autoKinds.includes(n.kind):n.id==="automations"):[];if(!e.length)return l;const t=this.status?.counts.visible,s=[{id:"schedules",label:a("תזמונים"),pill:t,attrs:{"data-segment":"schedules"}},...e.map(n=>({id:n.id,label:n.label,pill:this.autoCounts?this.autoCounts[n.kind]:void 0,attrs:{"data-segment":n.id}}))];return i`<sw-tabs controlled variant="pill" fill="phone" class="kinds" group-label=${a("קברניט")} data-kavarnit-segments .items=${s} active="schedules"
      @change=${n=>{n.stopPropagation();const r=e.find(o=>o.id===n.detail.id);r&&S(Ue(r.id))}}></sw-tabs>`}dd(e,t,s,n,r){return i`<sw-dropdown data-filter=${e} .label=${t} .placeholder=${t} .value=${s} .items=${n} @change=${o=>r(o.detail.id)}></sw-dropdown>`}renderMoreFilters(e){const t=this.filters,s=he(e,"area"),n=dt(e),r=ct(e),o=this.status?.settings.shabbat_sensor??null,c=e.some(b=>b.conditions.preset),f=e.some(b=>b.conditions.items.length),x=(b,w)=>[{id:"",label:b},...w.map(g=>({id:g.value,label:g.label}))];return i`<div class="more" data-sched-filters>
      ${s.length>1?this.dd("area",a("כל האזורים"),t.area,x(a("כל האזורים"),s),b=>this.setFilter({area:b})):l}
      <span class="days" role="group" aria-label=${a("ימים")}>${tt.map(b=>i`<button type="button" class="rc day" data-day-filter=${b} aria-pressed=${String(t.day===b)} aria-label=${a("יום {day}",{day:re[b]})} @click=${()=>this.setFilter({day:t.day===b?"":b})}>${re[b]}</button>`)}</span>
      ${o||c?i`<button type="button" class="rc" data-chip-preset="only_holy_days" aria-pressed=${String(t.preset==="only_holy_days")} @click=${()=>this.setFilter({preset:t.preset==="only_holy_days"?"":"only_holy_days"})}>${a("רק בשבת ובחג")}</button><button type="button" class="rc" data-chip-preset="not_holy_days" aria-pressed=${String(t.preset==="not_holy_days")} @click=${()=>this.setFilter({preset:t.preset==="not_holy_days"?"":"not_holy_days"})}>${a("לא בשבת ובחג")}</button>`:l}
      ${f?i`<button type="button" class="rc" data-chip-has-cond aria-pressed=${String(t.hasConditions)} @click=${()=>this.setFilter({hasConditions:!t.hasConditions})}>${a("עם תנאי")}</button>`:l}
      ${r.length>1?this.dd("condition",a("כל התנאים"),t.condition,x(a("כל התנאים"),r),b=>this.setFilter({condition:b})):l}
      ${n.length?i`<span class="sep" aria-hidden="true"></span>${n.map(b=>i`<button type="button" class="rc" data-chip-tag=${b.value} aria-pressed=${String(t.tag===b.value)} @click=${()=>this.setFilter({tag:t.tag===b.value?"":b.value})}>${v(b.label)}</button>`)}`:l}
      <span class="sep" aria-hidden="true"></span>
      ${this.dd("group",a("ללא קיבוץ"),t.group,[{id:"",label:a("ללא קיבוץ")},{id:"area",label:a("לפי אזור")},{id:"floor",label:a("לפי קומה")},{id:"tag",label:a("לפי תג")},{id:"state",label:a("לפי מצב")}],b=>this.setFilter({group:b}))}
      ${this.dd("sort",a("מיון: הרצה הבאה"),t.sort,[{id:"next_run",label:a("מיון: הרצה הבאה")},{id:"name",label:a("מיון: שם")},{id:"order",label:a("מיון: סדר ידני")},{id:"updated",label:a("מיון: עודכן לאחרונה")}],b=>this.setFilter({sort:b||"next_run"}))}
      ${ht(t)?i`<button type="button" class="btn sm quiet" data-clear-filters @click=${()=>this.clearFilters()}>${a("נקה סינון")}</button>`:l}
    </div>`}skeleton(){const e=i`<div class="glass" style="padding:18px;display:flex;flex-direction:column;gap:12px;border-radius:24px"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:13px;inline-size:35%"></span><span class="skl" style="block-size:28px"></span><span class="skl" style="block-size:14px;inline-size:60%"></span></div>`;return i`<div data-sched-state="loading" aria-busy="true"><div class="cgrid">${Array.from({length:this.phone?3:6},()=>e)}</div></div>`}stateBox(e,t,s,n){return i`<div class="statebox glass" role="status" data-sched-state=${s}><span class="ring">${h(e)}</span><b>${t}</b>${n??l}</div>`}bannerRow(e){const t=e.readOnly&&!!this.status?.can.manage;return!e.stale&&!t?l:i`<div class="stack">
      ${e.stale?i`<div class="banner warn" role="status" data-sched-stale>${h("wifiOff")}<div>${pt}</div><button type="button" class="btn sm" data-banner-retry @click=${()=>void this.refresh(!0)}>${h("refresh")}${a("נסו שוב")}</button></div>`:l}
      ${t?i`<div class="banner info" role="status" data-sched-readonly>${h("lock")}<div>${e.readOnlyText}</div></div>`:l}
    </div>`}renderUpcoming(e){const t=ut(e,new Date,48);if(!t.length)return l;const s=be(new Date),n=t[0],r=[0,6,12,18,24];return i`<div class="upnext glass" data-sched-upnext role="group" aria-label=${a("ההרצות הבאות היום")}>
      <b>${a("היום")}</b>
      <div class="tl">
        <span class="track" aria-hidden="true"><span class="past" style=${`inline-size:${(s*100).toFixed(2)}%`}></span></span>
        <span class="now" aria-hidden="true" style=${`left:${(s*100).toFixed(2)}%`}></span>
        ${r.map(o=>i`<span class=${`hr${o===0?" h0":o===24?" h24":""}`} aria-hidden="true" style=${`left:${o/24*100}%`}>${String(o).padStart(2,"0")}</span>`)}
        ${t.map(o=>i`<span class=${`tdot${o===n?" nx":""}`} aria-hidden="true" data-upcoming=${o.scheduleId} style=${`left:${(be(new Date(o.at))*100).toFixed(2)}%;--c:${K(o.tone)}`} title=${`${o.time} · ${o.name}${o.conditional?` · ${a("בתנאי")}`:""}`}></span>`)}
      </div>
      <a class="up" href=${this.href(n.scheduleId)} data-upcoming-next=${n.scheduleId}><time class="n">${n.time}</time><span class="nm">${v(n.name)}</span>${n.conditional?i`<span class="what">· ${a("בתנאי")}</span>`:l}</a>
    </div>`}stateChip(e){return e.state==="triggered"?i`<span class="chip ok" data-state-chip="triggered">${U.triggered}</span>`:e.state==="completed"?i`<span class="chip" data-state-chip="completed">${a("הסתיים")}</span>`:e.enabled&&e.state==="unavailable"?i`<span class="chip" data-state-chip="unavailable">${U.unavailable}</span>`:l}switchOf(e){return e.can.toggle?i`<sw-toggle .checked=${D(e.enabled)} label=${`${e.enabled?a("השבתה"):a("הפעלה")} · ${e.display_name}`} labelHidden data-toggle=${e.id} ?disabled=${this.busy} @change=${we(e.enabled,()=>void this.toggle(e,!e.enabled))}></sw-toggle>`:i`<span class=${`chip ${e.enabled?"ok":""}`} data-card-state>${e.enabled?a("פעיל"):a("מושבת")}</span>`}menu(e){const t=(s,n,r,o,c="")=>o?i`<button type="button" role="menuitem" class=${c} data-card-action=${s} @click=${()=>this.menuAct(e,s)}>${h(n)}${r}</button>`:l;return i`<div class="pop" role="menu" aria-label=${`${a("פעולות")} · ${e.display_name}`}>
      ${t("edit","edit",a("עריכה"),e.can.edit)}
      ${t("run","play",a("הרץ עכשיו"),e.can.run)}
      ${t("copy","copy",a("שכפול"),e.can.copy)}
      ${e.can.delete?i`<hr />`:l}
      ${t("delete","trash",a("מחיקה"),e.can.delete,"dz")}
    </div>`}renderCard(e){const t=fe(e),s=C()?null:P,n=ge(e),r=e.can.edit||e.can.run||e.can.copy||e.can.delete,o=this.menuFor===e.id;return i`<article class=${`acard ${e.enabled?"on":"off"}`} data-schedule=${e.id} data-enabled=${e.enabled} ?data-picked=${this.selected.has(e.id)} ?data-menu=${o} aria-label=${e.display_name}>
      <header>
        <label class="pick" title=${a("בחירה")}><input type="checkbox" data-select=${e.id} aria-label=${a("בחירת {name}",{name:e.display_name})} .checked=${this.selected.has(e.id)} @change=${c=>this.toggleSel(e.id,c.target.checked)} /></label>
        <div class="ttl">
          <h3><a class="name" href=${this.href(e.id)} data-card-open>${v(e.display_name)}</a></h3>
          <div class="where">${h("layers")}${n?i`<b>${v(n)}</b>`:l}<span class="ar">${v(F(e))}</span></div>
        </div>
        <div class="ctl">
          ${this.switchOf(e)}
          ${r?i`<button type="button" class="more-btn" aria-haspopup="menu" aria-expanded=${String(o)} aria-label=${`${a("עוד")} · ${e.display_name}`} data-card-menu @click=${()=>this.menuFor=o?"":e.id}>${h("dots")}</button>`:l}
        </div>
        ${o?this.menu(e):l}
      </header>
      <div class="bar"><sw-schedule-bar .slots=${e.slots} .sun=${s}></sw-schedule-bar></div>
      <div class="meta">
        <sw-day-chips .days=${e.days} compact></sw-day-chips>
        ${t?i`<span class="chip info" data-period>${h("calendar")}${t}</span>`:l}
        <schedule-condition-chip .conditions=${e.conditions}></schedule-condition-chip>
        <sw-schedule-markers .sensitive=${e.sensitive} .lowering=${e.lowering}></sw-schedule-markers>
        ${e.slots.some(c=>c.actions.some(f=>f.invalid))?i`<span class="chip warn" data-invalid title=${e.slots.flatMap(c=>c.actions).find(c=>c.invalid)?.invalid?.message??""}>${h("warning")}${a("פעולה לא תקפה")}</span>`:l}
        ${e.slots.some(c=>c.actions.some(f=>f.blocked))?i`<span class="chip warn" data-script-blocked title=${e.slots.flatMap(c=>c.actions).find(c=>c.blocked)?.blocked?.message??""}>${h("lock")}${a("סקריפט לא מאושר")}</span>`:l}
        ${this.stateChip(e)}
      </div>
      <footer>
        <span class="run" data-card-run><i class=${`dot ${e.enabled&&e.next_run?"ok":""}`}></i>${a("הרצה הבאה")} <b data-next-run>${M(e)}</b></span>
      </footer>
    </article>`}renderRow(e){const t=e.slots.slice(0,3);return i`<div class=${`tr${e.enabled?"":" off"}`} data-schedule=${e.id} data-enabled=${e.enabled} ?data-picked=${this.selected.has(e.id)}>
      <span class="csel"><label class="pick"><input type="checkbox" data-select=${e.id} aria-label=${a("בחירת {name}",{name:e.display_name})} .checked=${this.selected.has(e.id)} @change=${s=>this.toggleSel(e.id,s.target.checked)} /></label></span>
      <span class="cname" style="min-inline-size:0"><a class="name" href=${this.href(e.id)}>${v(e.display_name)}</a><div class="sub">${v(F(e))}${this.alsoTag(e)}</div>${e.sensitive||e.lowering?i`<sw-schedule-markers .sensitive=${e.sensitive} .lowering=${e.lowering}></sw-schedule-markers>`:l}</span>
      <span class="cdays"><sw-day-chips .days=${e.days} compact></sw-day-chips></span>
      <span class="cslots slotrows">${t.map(s=>i`<span class="sr"><span class="w">${A(s)}</span><span class="a">${L(s,e).map(n=>i`<span class="ac" style=${`--c:${K(n.tone)}`} title=${n.devices.join(", ")}>${n.label}${n.devices.length>1?` · ${n.devices.length}`:""}</span>`)}</span></span>`)}${e.slots.length>t.length?i`<button type="button" class="linkbtn" @click=${()=>this.go(e.id)}>${a("ועוד {n} משבצות",{n:e.slots.length-t.length})}</button>`:l}</span>
      <span class="ccond"><schedule-condition-chip .conditions=${e.conditions} compact></schedule-condition-chip></span>
      <span class="cnext"><b data-next-run>${M(e)}</b></span>
      <span class="ctog">${this.switchOf(e)}</span>
      <span class="cops ops">${e.can.run?i`<button type="button" class="rb sm" aria-label=${`${a("הרץ עכשיו")} · ${e.display_name}`} title=${a("הרץ עכשיו")} data-run=${e.id} @click=${()=>this.actionsHost?.run(e)}>${h("play")}</button>`:l}${e.can.edit?i`<button type="button" class="rb sm" aria-label=${`${a("עריכה")} · ${e.display_name}`} title=${a("עריכה")} data-edit=${e.id} @click=${()=>S(`${z}/${e.id}/edit`)}>${h("edit")}</button>`:l}</span>
    </div>`}renderTable(e){const t=e.length>0&&e.every(s=>this.selected.has(s.id));return i`<div class="tbl glass" data-sched-table>
      <div class="tr h"><span><label class="pick"><input type="checkbox" aria-label=${a("בחירת הכול")} data-select-all .checked=${t} @change=${s=>this.selected=s.target.checked?new Set([...this.selected,...e.map(n=>n.id)]):new Set([...this.selected].filter(n=>!e.some(r=>r.id===n)))} /></label></span><span>${a("שם")}</span><span class="cdays">${a("ימים")}</span><span>${a("משעה")} · ${a("פעולה")}</span><span>${a("תנאי")}</span><span>${a("הרצה הבאה")}</span><span>${a("פעיל")}</span><span></span></div>
      ${j(e,s=>s.id,s=>this.renderRow(s))}
    </div>`}rowIssue(e){return e.enabled&&e.state==="unavailable"?U.unavailable:e.slots.some(t=>t.actions.some(s=>s.invalid))?a("פעולה לא תקפה"):e.slots.some(t=>t.actions.some(s=>s.blocked))?a("סקריפט לא מאושר"):""}renderSchedRow(e,t){const s=ge(e),n=e.can.edit||e.can.run||e.can.copy||e.can.delete,r=this.menuFor===e.id,o=this.rowIssue(e),c=C()?null:P;return i`<div class=${`lr${e.enabled?"":" off"}`} role="row" data-schedule=${e.id} data-enabled=${e.enabled} ?data-picked=${this.selected.has(e.id)} ?data-menu=${r}>
      ${t?i`<span class="lsel" role="cell"><label class="pick" title=${a("בחירה")}><input type="checkbox" data-select=${e.id} aria-label=${a("בחירת {name}",{name:e.display_name})} .checked=${this.selected.has(e.id)} @change=${f=>this.toggleSel(e.id,f.target.checked)} /></label></span>`:l}
      <span class="ltog" role="cell">${this.switchOf(e)}</span>
      <span class="lname" role="cell"><a class="name" href=${this.href(e.id)} data-row-open>${v(e.display_name)}</a><span class="sub">${s?i`<b>${v(s)}</b> · `:l}${v(F(e))}${this.alsoTag(e)}</span></span>
      <span class="ldays" role="cell"><sw-day-chips .days=${e.days} compact></sw-day-chips></span>
      <span class="lbar" role="cell"><sw-schedule-bar compact .slots=${e.slots} .sun=${c}></sw-schedule-bar></span>
      <span class=${`lnext${o?" warn":""}`} role="cell" data-row-next title=${o}>${o?i`${h("warning")}${o}`:i`<i class=${`dot ${e.enabled&&e.next_run?"ok":""}`}></i><b data-next-run>${M(e)}</b>`}</span>
      <span class="lops" role="cell">${n?i`<button type="button" class="more-btn" aria-haspopup="menu" aria-expanded=${String(r)} aria-label=${`${a("עוד")} · ${e.display_name}`} data-card-menu @click=${()=>this.menuFor=r?"":e.id}>${h("dots")}</button>`:l}${r?this.menu(e):l}</span>
    </div>`}renderRows(e){const t=this.selecting||this.selected.size>0;return i`<div class=${`rlist glass${t?" picking":""}`} role="table" aria-label=${a("תזמונים")} data-sched-rows>${j(e,s=>s.id,s=>this.renderSchedRow(s,t))}</div>`}renderList(e){if(this.view==="week")return i`<schedules-week-view .schedules=${e} .sun=${C()?null:P} .snap=${this.status?.settings.snap_minutes??15} @open-schedule=${w=>this.go(w.detail.id)}></schedules-week-view>`;const t=this.filters.sort,s=this.sortedMemo.get([e,t],()=>mt(e,t)),n=this.phone?this.perPage.phone:this.perPage.wide,r=Be(this.lists.paged,this.filters.group?n:Le(n,this.fitRows),s.length),o=Oe(s.length,r),c=Ie(this.page,s.length,r),f=bt(Pe(s,c,r),this.filters.group),x=w=>this.view==="table"?this.renderTable(w):this.view==="rows"?this.renderRows(w):i`<div class="cgrid" data-sched-grid>${j(w,g=>g.id,g=>this.renderCard(g))}</div>`,b=o>1?i`<div class="lfoot" data-sched-pager><sw-pager .page=${c} .pages=${o} @page-change=${w=>{this.page=w.detail.page,this.menuFor=""}}></sw-pager></div>`:l;return this.filters.group?i`<div class="groups">${f.map(w=>i`<section class="fsec group" data-group=${w.key}><header class="sh"><h2>${v(w.label)}</h2></header>${x(w.items)}</section>`)}${b}</div>`:i`<div class="groups"><section class="fsec group" data-group="">${x(f[0]?.items??[])}</section>${b}</div>`}renderBulk(){const e=this.selected.size;if(this.selecting&&!e&&this.view!=="week")return i`<div class="editbar bulk" role="region" aria-label=${T("select")} data-bulk-bar="empty"><span class="t">${h("check")}${a("{n} נבחרו",{n:0})}</span><span class="grow"></span><button type="button" class="btn sm quiet" data-select-done @click=${()=>this.selecting=!1}>${T("selectDone")}</button></div>`;if(!e||this.view==="week")return l;const t=!!this.status?.can.manage&&!!this.status?.writable;return i`<div class="editbar bulk" role="region" aria-label=${a("פעולות על הבחירה")} data-bulk-bar>
      <span class="t">${h("check")}${a("{n} נבחרו",{n:e})}</span>
      <span class="grow"></span>
      ${t?i`<button type="button" class="btn sm" data-bulk-enable ?disabled=${this.busy} @click=${()=>void this.bulk("enable")}>${h("play")}${a("הפעלה")}</button><button type="button" class="btn sm" data-bulk-disable ?disabled=${this.busy} @click=${()=>void this.bulk("disable")}>${h("stop")}${a("השבתה")}</button>`:l}
      <button type="button" class="btn sm quiet" data-bulk-clear @click=${()=>{this.selected=new Set,this.selecting=!1}}>${a("ביטול בחירה")}</button>
    </div>`}renderTrash(){if(this.subError)return this.stateBox("warning",this.subError,"error",i`<button type="button" class="btn sm" data-sched-retry @click=${()=>void this.loadTrash()}>${h("refresh")}${a("נסו שוב")}</button>`);if(this.trash===null)return this.skeleton();if(!this.trash.length)return this.stateBox("trash",a("סל המחזור ריק"),"trash-empty");const e=!!this.status?.can.configure&&!!this.status?.can.manage;return i`<div class="rows" data-sched-trash>${this.trash.map(t=>i`<div class="li glass" data-trash-item=${t.trash_id}>
        <div><div class="t">${v(t.name||a("תזמון ללא שם"))}</div><div class="d">${t.entities.map(s=>s.name).join(" · ")}</div><div class="d">${gt(t.deleted_at)}${t.deleted_by?` · ${t.deleted_by.display_name}`:""} · ${wt(t.expires_at)}</div></div>
        <div class="lops">${t.sensitive?i`<sw-schedule-markers .sensitive=${!0}></sw-schedule-markers>`:l}
          <button type="button" class="btn sm primary" data-restore=${t.trash_id} ?disabled=${!t.can_restore} title=${t.can_restore?"":a("אין הרשאה לשחזר תזמון זה")} @click=${()=>void this.restore(t.trash_id,t)}>${h("restore")}${a("שחזור")}</button>
          ${e?i`<button type="button" class="rb sm" aria-label=${a("מחיקה לצמיתות")} title=${a("מחיקה לצמיתות")} data-purge=${t.trash_id} @click=${()=>this.purging=t}>${h("trash")}</button>`:l}</div>
      </div>`)}</div>`}renderReview(){if(this.subError)return this.stateBox("warning",this.subError,"error",i`<button type="button" class="btn sm" data-sched-retry @click=${()=>void this.loadReview()}>${h("refresh")}${a("נסו שוב")}</button>`);if(this.review===null)return this.skeleton();if(!this.review.length)return this.stateBox("check",a("אין תזמונים הדורשים בדיקה"),"review-empty");const e=this.reviewSel.size,t=!!this.status?.can.acknowledge;return i`<div class="rows" data-sched-review>${this.review.map(s=>i`<div class="li glass" data-review-item=${s.schedule.id}>
        <div style="display:flex;gap:10px;align-items:flex-start;min-inline-size:0">
          <label class="pick"><input type="checkbox" data-review-select=${s.schedule.id} aria-label=${a("בחירת {name}",{name:s.schedule.display_name})} ?disabled=${!s.schedule.enabled||!s.schedule.can.toggle} .checked=${this.reviewSel.has(s.schedule.id)} @change=${n=>{const r=new Set(this.reviewSel);n.target.checked?r.add(s.schedule.id):r.delete(s.schedule.id),this.reviewSel=r}} /></label>
          <div style="min-inline-size:0"><div class="t"><a class="name" href=${this.href(s.schedule.id)}>${v(s.schedule.display_name)}</a></div><div class="d">${F(s.schedule)}${s.schedule.owner?` · ${s.schedule.owner.display_name}`:""}</div>
          <div class="issues">${s.issues.map(n=>{const r=t&&st.includes(n);return i`<span class="iss"><span class="chip warn" data-issue=${n}>${le[n]}</span>${r?i`<button type="button" class="linkbtn" data-ack=${n} ?disabled=${this.busy} @click=${()=>void this.ack(s.schedule.id,n,!1)}>${a("אשר כתקין")}</button>`:l}</span>`})}${(s.acknowledged??[]).map(n=>i`<span class="iss"><span class="chip acked" data-acked=${n.issue} title=${`${le[n.issue]} · ${n.by?.display_name?a("אושר על ידי {name}",{name:n.by.display_name}):a("אושר")}`}>${h("check")}${a("אושר")}</span>${t?i`<button type="button" class="linkbtn" data-unack=${n.issue} ?disabled=${this.busy} @click=${()=>void this.ack(s.schedule.id,n.issue,!0)}>${a("בטל אישור")}</button>`:l}</span>`)}</div></div>
        </div>
        <div class="lops"><span class=${s.schedule.enabled?"chip ok":"chip"}>${s.schedule.enabled?a("פעיל"):a("מושבת")}</span></div>
      </div>`)}</div>
    ${e?i`<div class="editbar bulk" data-bulk-bar="review"><span class="t">${h("check")}${a("{n} נבחרו",{n:e})}</span><span class="grow"></span><button type="button" class="btn sm" data-review-disable ?disabled=${this.busy} @click=${()=>void this.bulkReview()}>${h("stop")}${a("השבתת הנבחרים")}</button></div>`:l}`}scopedItems(){const e=this.items??[];return this.building?this.buildingMemo.get([e,this.building],()=>Me(e,this.building)):e}alsoTag(e){const t=De(e.buildings,this.building,this.buildingMeta);return t?i` · <span data-also>${t}</span>`:l}renderReady(e){const t=this.scopedItems(),s=this.filters,n=this.filteredMemo.get([t,s],()=>ft(t,s)),r=!!this.status?.can.manage;let o;return(this.items??[]).length?n.length?o=i`${this.view!=="week"?this.renderUpcoming(t):l}${this.renderList(n)}`:o=this.stateBox("search",a("לא נמצאו תזמונים"),"no-match",i`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.clearFilters()}>${a("נקה סינון")}</button>`):o=this.stateBox("calendar",a("אין עדיין תזמונים"),"empty",r&&!e.readOnly?i`<button type="button" class="btn primary" data-new-schedule @click=${()=>this.newSchedule()}>${h("plus")}${a("תזמון חדש")}</button>`:void 0),i`${this.bannerRow(e)}${o}${this.renderBulk()}`}renderBody(e){const t=e.admin?i`<button type="button" class="btn sm" data-open-settings @click=${()=>S("/system/schedules")}>${h("settings")}${a("הגדרות התזמונים")}</button>`:void 0;switch(e.kind){case"loading":return this.skeleton();case"error":return this.stateBox("warning",a("לא ניתן לטעון את הרשימה"),"error",i`<button type="button" class="btn sm" data-sched-retry @click=${()=>{this.failed="",this.items=null,this.load()}}>${h("refresh")}${a("נסו שוב")}</button>`);case"no_view":return this.stateBox("lock",a("אין הרשאה לצפות בתזמונים"),"no_permission");case"feature_disabled":return this.stateBox("settings",a("התזמונים כבויים"),"feature_disabled",t);case"missing":return e.admin?this.stateBox("settings",a("רכיב התזמונים אינו מחובר"),"missing_admin",t):this.stateBox("calendar",a("אין תזמונים להצגה"),"missing");default:return this.sub==="trash"?this.renderTrash():this.sub==="review"?this.renderReview():this.renderReady(e)}}render(){const e=this.noView&&!this.status?{..._(null),kind:"no_view"}:_(this.status,!!this.failed&&!this.status),s=e.kind==="ready"&&this.items===null&&!!this.failed?{...e,kind:"error"}:e.kind==="ready"&&this.items===null?{...e,kind:"loading"}:e,n=this.sub,r=n&&n!=="trash"&&n!=="review"?n:"",o=n==="trash"?a("סל מחזור"):n==="review"?a("תזמונים לבדיקה"):a("תזמונים");return i`<sw-page class="page" heading=${o} backHref=${n==="trash"||n==="review"?z:""} data-sched-title data-screen="devices-schedules" data-sched-screen=${s.kind}>
        ${this.header(s)}
        ${this.renderBody(s)}
      </sw-page>
      ${s.kind==="ready"&&this.drawerUsed?i`<schedule-drawer ?open=${!!r} .schedule=${this.detail} .status=${this.status} ?missing=${this.detailMissing} @drawer-close=${()=>this.go("")} @edit=${c=>S(`${z}/${c.detail.id}/edit`)} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied}></schedule-drawer>`:l}
      ${s.kind==="ready"&&this.createOpen?i`<schedule-create-dialog .open=${!0} @close=${()=>this.createOpen=!1} @created=${c=>{this.createOpen=!1,this.refresh(),this.go(c.detail.id)}}></schedule-create-dialog>`:l}
      ${this.trashLowering?i`<schedule-lowering-dialog .open=${!0} .summary=${{entities:this.trashLowering.entities.filter(c=>c.sensitive).map(c=>c.name),times:[],text:a("השחזור יחזיר תזמון שפותח או מנטרל {names} גם כשאיש אינו נמצא במקום.",{names:this.trashLowering.entities.filter(c=>c.sensitive).map(c=>c.name).join(", ")})}} .needsCode=${!1} @confirm=${c=>void this.confirmTrashLowering(c)} @close=${()=>this.trashLowering=null}></schedule-lowering-dialog>`:l}
      ${this.purging?i`<sw-dialog open heading=${a('למחוק לצמיתות את "{name}"?',{name:this.purging.name||a("תזמון ללא שם")})} data-dialog="purge" @close=${()=>this.purging=null}><div class="dlgform"><p>${a("אי אפשר יהיה לשחזר אותו.")}</p><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.purging=null}>${a("ביטול")}</button><button type="button" class="btn danger" data-purge-confirm @click=${()=>void this.doPurge()}>${a("מחיקה")}</button></div></div></sw-dialog>`:l}
      <schedule-actions .status=${this.status} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied} @result=${this.onResult}></schedule-actions>
      ${this.note?i`<div class=${`toast${this.note.tone==="error"?" bad":""}`} popover="manual" role="status" data-sched-note>${h(this.note.tone==="error"?"warning":"check")}${this.note.text}${this.note.action?i`<button type="button" class="btn sm" data-note-action @click=${()=>{const c=this.note?.action;this.note=null,c?.run()}}>${this.note.action.label}</button>`:l}</div>`:l}`}};p.styles=Ct;m([O({attribute:!1})],p.prototype,"kavarnit",2);m([u()],p.prototype,"autoKinds",2);m([u()],p.prototype,"autoCounts",2);m([u()],p.prototype,"status",2);m([u()],p.prototype,"items",2);m([u()],p.prototype,"buildingMeta",2);m([u()],p.prototype,"building",2);m([u()],p.prototype,"failed",2);m([u()],p.prototype,"noView",2);m([u()],p.prototype,"filters",2);m([u()],p.prototype,"view",2);m([u()],p.prototype,"defaultView",2);m([u()],p.prototype,"perPage",2);m([u()],p.prototype,"page",2);m([u()],p.prototype,"fitRows",2);m([u()],p.prototype,"selecting",2);m([u()],p.prototype,"filtersOpen",2);m([u()],p.prototype,"selected",2);m([u()],p.prototype,"sub",2);m([u()],p.prototype,"detail",2);m([u()],p.prototype,"detailMissing",2);m([u()],p.prototype,"drawerUsed",2);m([u()],p.prototype,"trash",2);m([u()],p.prototype,"review",2);m([u()],p.prototype,"subError",2);m([u()],p.prototype,"note",2);m([u()],p.prototype,"createOpen",2);m([u()],p.prototype,"busy",2);m([u()],p.prototype,"reviewSel",2);m([u()],p.prototype,"menuFor",2);m([u()],p.prototype,"compactHeader",2);m([u()],p.prototype,"phone",2);m([u()],p.prototype,"trashLowering",2);m([u()],p.prototype,"purging",2);p=m([Q("devices-schedules")],p);export{p as DevicesSchedules};
