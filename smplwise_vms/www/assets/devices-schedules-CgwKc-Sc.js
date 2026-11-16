import{i as H,r as p,n as T,a as K,h2 as J,R as S,h3 as Q,h4 as fe,h5 as we,p as r,q as a,h6 as U,h7 as ve,K as E,h8 as B,h9 as $e,ha as xe,x as N,S as ye,hb as ke,fq as Z,bI as ee,hc as ze,gC as R,cU as Se,hd as _e,he as Ee,hf as Re,dl as Ce,V as Fe,hg as q,hh as Te,hi as Le,hj as Oe,hk as te,br as k,hl as se,hm as Ie,hn as Pe,X as g,ho as De,hp as Be,hq as ae,hr as V,cP as A,hs as qe,ht as Ve,hu as Ae,hv as ie,hw as je,hx as Me,a4 as Ue}from"./index-C5kZ9jiu.js";import{l as me}from"./live-DCquBbwC.js";import{t as W}from"./sw-schedule-bar-DqQa0a05.js";import"./sw-pager-2h-bsNFx.js";import{a as d,S as We,i as He}from"./automations-logic-BBb-7wMP.js";import{a as X}from"./automations-glass-B-MfZHsT.js";import{a as G,b as Ke,c as Ne}from"./automations-demo-CVgZlSKD.js";import{DEMO_SUN as O}from"./schedules-mock-8mklnmOo.js";import{l as ne,s as f,r as Xe,w as P,a as F,b as Ge,p as ge,n as I,d as C,c as Ye,N as L,e as z,f as _,g as j,h as re,i as le,t as Je,j as oe,k as Qe,S as Ze,m as et,o as tt,q as st,u as at,v as it,x as nt,y as rt,z as lt,A as ot,B as dt}from"./schedules-logic-DVgW4Q3C.js";import{m as ct,a as ht}from"./media-page-BF4b5gDG.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-BLWZG4KN.js";var pt=Object.defineProperty,ut=Object.getOwnPropertyDescriptor,$=(e,t,s,i)=>{for(var n=i>1?void 0:i?ut(t,s):t,l=e.length-1,o;l>=0;l--)(o=e[l])&&(n=(i?o(t,s,n):o(n))||n);return i&&n&&pt(t,s,n),n};let D=class extends K{constructor(){super(...arguments),this.dialog=null,this.close=e=>{e?.stopPropagation(),!this.dialog?.busy&&(this.dialog=null)}}connectedCallback(){super.connectedCallback(),G(this)}async enable(e,t){if(t&&e.lowering){this.dialog={kind:"lowering",s:e,op:"enable",slot:null,summary:ne(e),needsCode:!1,error:"",busy:!1};return}await this.doEnable(e,t,{})}run(e){const t=e.slots.length===1?0:null;this.dialog={kind:"run",s:e,slot:t,skip:!1,error:"",busy:!1}}askDelete(e){this.dialog={kind:"delete",s:e,error:"",busy:!1}}copy(e){this.dialog={kind:"copy",s:e,name:`העתק של ${e.display_name}`,error:"",busy:!1}}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}result(e,t="ok"){this.emit("result",{text:e,tone:t})}async doEnable(e,t,s){try{const i=await J(e.id,t,s);return this.emit("changed",{schedule:i.schedule}),this.result(t?`"${e.display_name}" הופעל`:`"${e.display_name}" הושבת`),!0}catch(i){return this.emit("changed",{schedule:null}),i instanceof S&&i.code==="schedule_changed"?this.result("התזמון שונה במקום אחר. הרשימה עודכנה.","error"):this.result(f(i),"error"),!1}}async submit(){const e=this.dialog;if(!(!e||e.busy)){this.dialog={...e,busy:!0,error:""};try{if(e.kind==="run"){const t=await Q(e.s.id,e.slot,{confirm:!0,skip_conditions:e.skip});this.dialog=null,this.result(t.note),this.emit("changed",{schedule:null})}else if(e.kind==="delete"){const t=await fe(e.s.id,e.s.revision);this.dialog=null,this.emit("deleted",{trashId:t.trash_id,name:e.s.display_name,scheduleId:e.s.id})}else if(e.kind==="copy"){const t=await we(e.s.id,e.name.trim()||`העתק של ${e.s.display_name}`);this.dialog=null,this.emit("copied",{schedule:t.schedule}),this.result("שוכפל")}}catch(t){const s=t instanceof S&&t.code==="schedule_changed";s&&this.emit("changed",{schedule:null});const i=this.dialog;i&&(this.dialog={...i,busy:!1,error:s?"התזמון שונה במקום אחר. הגרסה העדכנית נטענה; בדקו ונסו שוב.":f(t)})}}}async confirmLowering(e){const t=this.dialog;if(!t||t.kind!=="lowering")return;e.stopPropagation();const s=e.detail?.alarm_code??null;this.dialog={...t,busy:!0};try{if(t.op==="enable"){const i=await J(t.s.id,!0,{confirm_lowering:!0,alarm_code:s});this.dialog=null,this.emit("changed",{schedule:i.schedule}),this.result(`"${t.s.display_name}" הופעל`)}else{const i=await Q(t.s.id,t.slot,{confirm:!0,alarm_code:s});this.dialog=null,this.result(i.note),this.emit("changed",{schedule:null})}}catch(i){if(i instanceof S&&(i.code==="code_required"||i.code==="wrong_code")){this.dialog={...t,busy:!1,needsCode:!0},this.result(f(i),"error");return}this.dialog=null,this.emit("changed",{schedule:null}),this.result(f(i),"error")}}buttons(e,t,s,i,n,l={}){return a`<div class="dlgrow"><button type="button" class="btn" data-dialog-cancel @click=${this.close}>ביטול</button><button type="button" class=${`btn ${l.danger?"danger":"primary"}`} data-dialog-ok data-run-confirm=${e==="run"?"":r} data-delete-confirm=${e==="delete"?"":r} data-copy-confirm=${e==="copy"?"":r} ?disabled=${!!l.disabled||i.busy} @click=${n}>${i.busy?s:t}</button></div>`}renderRun(e){const t=e.s,s=Xe(e.slot===null?void 0:t.slots[e.slot]),i=e.slot!==null;return a`<sw-dialog open heading=${`להריץ עכשיו את "${t.display_name}"?`} data-dialog="run" @close=${this.close}><div class="dlgform">
      ${t.slots.length>1?a`<div class="slots" role="radiogroup" aria-label="משבצת להרצה">${t.slots.map(n=>a`<label class="opt"><input type="radio" name="slot" .checked=${e.slot===n.index} @change=${()=>this.dialog={...e,slot:n.index}} data-run-slot=${n.index} /><span><span class="n">${P(n)}</span><small>${F(n,t).map(l=>`${l.label} · ${l.devices.join(", ")}`).join(" | ")}</small></span></label>`)}</div>`:a`<p>${t.slots[0]?`${P(t.slots[0])} · ${F(t.slots[0],t).map(n=>`${n.label} · ${n.devices.join(", ")}`).join(" | ")}`:""}</p>`}
      ${Ge(e.slot===null?void 0:t.slots[e.slot])?a`<p>הפעולה תפעיל התקנים פיזיים מיד.</p>`:r}
      ${t.conditions.items.length?a`<label class="check"><input type="checkbox" .checked=${e.skip} @change=${n=>this.dialog={...e,skip:n.target.checked}} data-run-skip />להריץ גם אם התנאים אינם מתקיימים</label>`:r}
      ${e.error?a`<div class="err" role="alert" data-actions-error>${e.error}</div>`:r}
      ${this.buttons("run","הרץ","מריץ…",e,()=>s?this.askLoweringForRun(e):void this.submit(),{disabled:!i})}
    </div></sw-dialog>`}askLoweringForRun(e){this.dialog={kind:"lowering",s:e.s,op:"run",slot:e.slot,summary:ne(e.s),needsCode:!1,error:"",busy:!1}}render(){const e=this.dialog;return e?e.kind==="run"?this.renderRun(e):e.kind==="delete"?a`<sw-dialog open heading=${`למחוק את "${e.s.display_name}"?`} data-dialog="delete" @close=${this.close}><div class="dlgform">
        <p>התזמון יישמר בסל המחזור 30 יום וניתן לשחזר אותו.</p>
        ${e.error?a`<div class="err" role="alert" data-actions-error>${e.error}</div>`:r}
        ${this.buttons("delete","מחיקה","מוחק…",e,()=>void this.submit(),{danger:!0})}
      </div></sw-dialog>`:e.kind==="copy"?a`<sw-dialog open heading="שכפול" data-dialog="copy" @close=${this.close}><div class="dlgform">
        <label class="fld">שם העותק<input class="inp" type="text" maxlength="80" .value=${me(e.name)} data-copy-name @input=${t=>this.dialog={...e,name:t.target.value}} /></label>
        ${e.error?a`<div class="err" role="alert" data-actions-error>${e.error}</div>`:r}
        ${this.buttons("copy","שכפול","משכפל…",e,()=>void this.submit(),{disabled:!e.name.trim()})}
      </div></sw-dialog>`:a`<schedule-lowering-dialog .open=${!0} .summary=${e.summary} .needsCode=${e.needsCode} @confirm=${t=>void this.confirmLowering(t)} @close=${this.close}></schedule-lowering-dialog>`:r}};D.styles=[...X,H`
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
      font-weight: 600;
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
    input[type='radio'],
    input[type='checkbox'] {
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
      font-weight: 600;
    }
  `];$([p()],D.prototype,"dialog",2);D=$([N("schedule-actions")],D);function bt(e){const t=e.attribute==="state"&&(e.value==="on"||e.value==="off")?`${e.match_type==="is"?"":"לא "}${e.value==="on"?"פעיל":"כבוי"}`:`${xe[e.match_type]} ${e.value}`;if(!e.readable)return a`<div class="blk locked cond" data-condition-locked><span class="bi">${d("lock")}</span><span class="bt">${e.name}<small>${t}</small></span><span class="chip">${d("lock")}מחוץ להרשאתך</span></div>`;const s=Ye(e),i=s===null?"לא זמין כרגע":s?"כרגע: מתקיים":"כרגע: לא מתקיים";return a`<div class="blk cond"><span class="bi">${d("help")}</span><span class="bt">${e.name}<small>${t}</small></span><span class=${s===!0?"chip ok":"chip"}>${i}</span></div>`}let v=class extends K{constructor(){super(...arguments),this.open=!1,this.schedule=null,this.status=null,this.missing=!1,this.runs=null,this.note=null,this.conflict=!1,this.runsFor="",this.onResult=e=>{e.stopPropagation(),this.note=e.detail},this.onChanged=async e=>{e.stopPropagation();const t=this.schedule?.id;if(e.detail.schedule)this.emit("changed",{schedule:e.detail.schedule});else if(t)try{const s=await U(t);this.schedule&&s.revision!==this.schedule.revision&&(this.conflict=!0),this.emit("changed",{schedule:s})}catch{this.emit("changed",{schedule:null})}t&&this.loadRuns(t)},this.onDeleted=e=>{e.stopPropagation(),this.emit("deleted",e.detail)},this.onCopied=e=>{e.stopPropagation(),this.emit("copied",e.detail)}}connectedCallback(){super.connectedCallback(),G(this)}willUpdate(e){e.has("schedule")&&this.schedule?.id!==this.runsFor&&(this.runsFor=this.schedule?.id??"",this.runs=null,this.note=null,this.conflict=!1,this.runsFor&&this.loadRuns(this.runsFor)),e.has("open")&&!this.open&&(this.note=null,this.conflict=!1)}async loadRuns(e){try{const t=await ve({schedule_id:e,limit:10});this.runsFor===e&&(this.runs=t.items)}catch{this.runsFor===e&&(this.runs=[])}}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}get actions(){return this.renderRoot.querySelector("schedule-actions")}disabledWhy(e,t){return e.can[t]?"":e.read_only?.reasons[0]?.message??"אין הרשאה לפעולה זו."}renderBody(e){const t=e.upcoming.slice(0,5),s=e.read_only?.reasons??[],i=ge(e);return a`<div class="stack" data-drawer-detail>
      ${s.length?a`<div class="banner info" data-drawer-readonly>${d(e.sensitive?"lock":"eye")}<div>${s[0].message}</div></div>`:r}
      ${this.conflict?a`<div class="banner bad" role="alert" data-drawer-conflict>${d("warning")}<div><b>התזמון שונה במקום אחר</b><small>מוצגת הגרסה העדכנית</small></div></div>`:r}
      ${e.warnings.map(n=>a`<div class="banner warn" data-drawer-warning>${d("warning")}<div>${n.message}</div></div>`)}
      ${this.note?a`<div class=${`banner ${this.note.tone==="error"?"bad":"info"}`} role="status" data-drawer-status>${d(this.note.tone==="error"?"warning":"check")}<div>${this.note.text}</div></div>`:r}
      <div class="swrow"><span>פעיל</span>${e.can.toggle?a`<button type="button" class="tog" role="switch" aria-checked=${String(e.enabled)} aria-label="פעיל" data-drawer-toggle @click=${()=>void this.actions?.enable(e,!e.enabled)}></button>`:a`<span class=${`chip ${e.enabled?"ok":""}`} data-drawer-toggle-state title=${this.disabledWhy(e,"toggle")}>${e.enabled?"פעיל":"מושבת"}</span>`}</div>
      <section class="sect" data-section="when">
        <h4>${d("clock")}מתי</h4>
        <sw-schedule-bar .slots=${e.slots} .sun=${E()?null:O}></sw-schedule-bar>
        <div class="chips">
          <sw-day-chips .days=${e.days}></sw-day-chips>
          ${i?a`<span class="chip info" data-period>${d("calendar")}${i}</span>`:r}
          <schedule-condition-chip .conditions=${e.conditions}></schedule-condition-chip>
          <sw-schedule-markers .sensitive=${e.sensitive} .lowering=${e.lowering}></sw-schedule-markers>
        </div>
      </section>
      <section class="sect" data-section="slots">
        <h4>${d("play")}משבצות <span class="num">${e.slots.length}</span></h4>
        <div class="stack" style="gap:8px" data-drawer-slots>
          ${e.slots.map(n=>a`<div class=${n.supported?"blk slot":"blk slot bad"} data-slot-row=${n.index}>
              <span class="w">${P(n)}</span>
              <span class="acts">${F(n,e).map(l=>a`<span class="act"><i style=${`--c:${W(l.tone)}`}></i><span>${l.label}<small>${l.devices.join(", ")}</small></span></span>`)}${n.unsupported.map(l=>a`<small class="bad-note">${l.message}</small>`)}</span>
            </div>`)}
        </div>
      </section>
      ${e.conditions.items.length?a`<section class="sect" data-section="conditions"><h4>${d("help")}תנאים${e.conditions.items.length>1?e.conditions.type==="and"?" · כולם":" · אחד מהם":""}</h4>
            <div class="stack" style="gap:8px" data-drawer-conditions>${e.conditions.items.map(n=>bt(n))}${e.conditions.track?a`<small class="muted">ממשיך לבדוק עד סוף החלון</small>`:r}</div></section>`:r}
      <section class="sect" data-section="upcoming">
        <h4>${d("calendar")}ההרצות הבאות</h4>
        <div class="stack" style="gap:6px" data-drawer-upcoming>
          ${t.length?t.map(n=>a`<div class="li"><span>${e.slots[n.slot_index]?F(e.slots[n.slot_index],e).map(l=>`${l.label} · ${l.devices.join(", ")}`).join(" | "):""}</span><span>${B(n.at)}${e.conditions.items.length?" · בתנאי":""}</span></div>`):a`<div class="li"><span class="muted">${I(e)}</span></div>`}
        </div>
      </section>
      <section class="sect" data-section="runs">
        <h4>${d("history")}הרצות אחרונות</h4>
        <div class="stack" style="gap:6px" data-drawer-runs>
          ${this.runs===null?a`<div class="li"><span class="muted">טוען…</span></div>`:this.runs.length?this.runs.map(n=>a`<div class="li"><span>${B(n.started_at)}${n.via==="run_now"?" · הרצה ידנית":""}</span><span>${$e[n.result]}</span></div>`):a`<div class="li"><span class="muted">אין הרצות</span></div>`}
        </div>
      </section>
      ${e.tags.length?a`<div class="chips">${e.tags.map(n=>a`<span class="chip">${d("list")}${n}</span>`)}</div>`:r}
      ${e.owner||e.updated_at?a`<div class="by">${e.owner?`עודכן על ידי ${e.owner.display_name}`:"נוצר מחוץ למערכת"}${e.updated_at?` · ${B(e.updated_at)}`:""}</div>`:r}
    </div>`}footer(e){return a`<div class="foot2" slot="footer">
      <button type="button" class="btn primary" data-drawer-edit ?disabled=${!e.can.edit} title=${this.disabledWhy(e,"edit")} @click=${()=>this.emit("edit",{id:e.id})}>${d("edit")}עריכה</button>
      <button type="button" class="btn" data-drawer-run ?disabled=${!e.can.run} title=${this.disabledWhy(e,"run")} @click=${()=>this.actions?.run(e)}>${d("play")}הרץ עכשיו</button>
      <button type="button" class="btn quiet" data-drawer-copy ?disabled=${!e.can.copy} title=${this.disabledWhy(e,"copy")} @click=${()=>this.actions?.copy(e)}>${d("copy")}שכפול</button>
      <button type="button" class="btn quiet dz" data-drawer-delete ?disabled=${!e.can.delete} title=${this.disabledWhy(e,"delete")} @click=${()=>this.actions?.askDelete(e)}>${d("trash")}מחיקה</button>
    </div>`}render(){const e=this.schedule;return a`<sw-drawer modal ?open=${this.open} heading=${e?.display_name??"תזמון"} subheading=${e?C(e):""} @close=${t=>{t.target===t.currentTarget&&(t.stopPropagation(),this.emit("drawer-close"))}}>
      ${e?a`${this.renderBody(e)}
            <schedule-actions .status=${this.status} @result=${this.onResult} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied}></schedule-actions>
            ${this.footer(e)}`:this.missing?a`<div class="statebox" data-drawer-missing>${d("search",30)}<b>התזמון לא נמצא</b></div>`:a`<div class="stack" data-drawer-state="loading" aria-busy="true"><span class="skl" style="block-size:52px"></span><span class="skl" style="block-size:96px"></span><span class="skl" style="block-size:52px"></span></div>`}
    </sw-drawer>`}};v.styles=[...X,H`
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
      font-weight: 700;
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
      font-weight: 500;
    }
    .li span:last-child {
      color: var(--dv-text);
      font-weight: 700;
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
  `];$([T({type:Boolean})],v.prototype,"open",2);$([T({attribute:!1})],v.prototype,"schedule",2);$([T({attribute:!1})],v.prototype,"status",2);$([T({type:Boolean})],v.prototype,"missing",2);$([p()],v.prototype,"runs",2);$([p()],v.prototype,"note",2);$([p()],v.prototype,"conflict",2);v=$([N("schedule-drawer")],v);var mt=Object.defineProperty,gt=Object.getOwnPropertyDescriptor,u=(e,t,s,i)=>{for(var n=i>1?void 0:i?gt(t,s):t,l=e.length-1,o;l>=0;l--)(o=e[l])&&(n=(i?o(t,s,n):o(n))||n);return i&&n&&mt(t,s,n),n};const M="sw.schedules.view",de="sw.schedules.filters",y="/devices/schedules",ft={rows:"rows",cards:"grid",table:"list",week:"calendar"},ce={rows:()=>R("rows"),cards:()=>"כרטיסים",table:()=>"טבלה",week:()=>"שבוע"},wt=["rows","cards","table","week"];function he(e){return Math.min(1,Math.max(0,(e.getHours()*60+e.getMinutes())/1440))}function Y(){try{return window.localStorage}catch{return null}}function pe(e){try{const t=Y()?.getItem(e);return t?JSON.parse(t):null}catch{return null}}function ue(e,t){try{Y()?.setItem(e,JSON.stringify(t))}catch{}}function be(e){const t=[...new Set(e.entities.map(s=>s.floor_name).filter(s=>!!s))];return t.length===1?t[0]:""}let h=class extends K{constructor(){super(...arguments),this.bubbleSkin=new ye(this),this.kavarnit={schedules:!0,automations:!0},this.autoKinds=null,this.autoCounts=null,this.status=null,this.items=null,this.failed="",this.noView=!1,this.filters={...L},this.view="rows",this.defaultView="rows",this.perPage=ke.schedules,this.page=1,this.fitRows=null,this.selecting=!1,this.filtersOpen=!1,this.selected=new Set,this.sub="",this.detail=null,this.detailMissing=!1,this.drawerUsed=!1,this.trash=null,this.review=null,this.subError="",this.note=null,this.createOpen=!1,this.busy=!1,this.reviewSel=new Set,this.menuFor="",this.compactHeader=!1,this.phone=window.matchMedia("(max-width: 767px)").matches,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offEdit=null,this.offSelect=null,this.stopWs=null,this.lastWritten="",this.urlTimer=0,this.noteTimer=0,this.onResize=()=>{this.fitRows=null,this.requestUpdate()},this.onScroll=()=>{const e=this.scrollTop>40;e!==this.compactHeader&&(this.compactHeader=e)},this.onOutside=e=>{if(!this.menuFor)return;const t=this.renderRoot.querySelector(`[data-schedule="${CSS.escape(this.menuFor)}"]`);(!t||!e.composedPath().includes(t))&&(this.menuFor="")},this.onKey=e=>{this.menuFor&&e.key==="Escape"&&(this.menuFor="")},this.onChanged=e=>{const t=e.detail?.schedule;t?(this.items=(this.items??[]).map(s=>s.id===t.id?{...t,raw:void 0}:s),this.detail?.id===t.id&&(this.detail=t),this.refreshStatusOnly()):this.refresh()},this.onDeleted=e=>{const{trashId:t,name:s,scheduleId:i}=e.detail;this.items=(this.items??[]).filter(n=>n.id!==i),this.sub===i&&this.go(""),this.refreshStatusOnly(),this.say(`"${s}" נמחק`,"ok",{label:"שחזור",run:()=>void this.restore(t)})},this.onCopied=e=>{this.refresh(),this.go(e.detail.schedule.id)},this.onResult=e=>{this.say(e.detail.text,e.detail.tone)},this.trashLowering=null,this.purging=null}connectedCallback(){super.connectedCallback(),G(this),this.phoneMq.addEventListener("change",this.onPhone),window.addEventListener("resize",this.onResize),this.addEventListener("scroll",this.onScroll,{passive:!0}),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey),this.offEdit=Z({id:"schedules-trash",label:"סל מחזור",icon:"trash",can:()=>z(this.status).kind==="ready"&&this.sub!=="trash",run:()=>this.go("trash")});const e=pe(de),t=_(pe(M))??_(Y()?.getItem(M)??null),s=ee().params;this.filters=s.toString()?j(s):e?j(re({...L,...e})):{...L},this.view=_(s.get("view"))??t??this.defaultView;const i=!!_(s.get("view"));ze().then(n=>{this.defaultView=n.schedulesView,this.perPage=n.pageSize.schedules,!i&&!t&&(this.view=n.schedulesView)}),this.offSelect=Z({id:"schedules-select",label:R("select"),icon:"check",can:()=>z(this.status).kind==="ready"&&!this.sub&&this.view!=="week"&&!this.selecting,run:()=>this.selecting=!0}),this.filtersOpen=le(this.filters)>0,this.offRoute=Se(n=>this.onRoute(n)),this.load(),this.loadSegments(),this.stopWs=_e(()=>void this.refresh())}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),window.removeEventListener("resize",this.onResize),this.removeEventListener("scroll",this.onScroll),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey),this.offRoute?.(),this.offEdit?.(),this.offSelect?.(),this.stopWs?.(),window.clearTimeout(this.urlTimer),window.clearTimeout(this.noteTimer)}updated(e){ct(this.renderRoot,this.phone),this.measureFit();const t=this.renderRoot.querySelector(".toast[popover]");if(t)try{t.matches(":popover-open")||t.showPopover()}catch{}}measureFit(){const e=this.view==="rows"?"[data-sched-rows]":this.view==="table"?"[data-sched-table]":this.view==="cards"?"[data-sched-grid]":"",t=e&&!this.filters.group&&!this.sub?this.renderRoot.querySelector(e):null,s=Ee({host:this,list:t,itemSelector:"[data-schedule]",pager:this.renderRoot.querySelector("[data-sched-pager]"),padded:[this.renderRoot.querySelector(".page")]});s!==null&&(this.fitRows===null||s<this.fitRows)&&(this.fitRows=s)}async loadSegments(){if(this.kavarnit.automations)try{await Ke();const e=await Ne().status();if(e.available==="feature_disabled")return;this.autoKinds=Re(e),this.autoCounts={automation:e.counts.automations,script:e.counts.scripts,scene:e.counts.scenes}}catch{this.autoKinds=null}}onRoute(e){if(e.segments[0]!=="devices"||e.segments[1]!=="schedules")return;const t=e.segments[2]??"",s=t==="new"?"":decodeURIComponent(t),i=e.params.toString();i!==this.lastWritten&&(i||this.lastWritten)&&(this.filters=j(e.params),this.view=_(e.params.get("view"))??this.view,this.lastWritten=i),s!==this.sub&&(this.sub=s,this.menuFor="",this.onSub())}path(e){return e?`${y}/${encodeURIComponent(e)}`:y}params(){return re(this.filters,this.view,this.defaultView)}go(e){const t=this.params();this.lastWritten=t.toString(),Ce(this.path(e),t)}syncUrl(e=0){window.clearTimeout(this.urlTimer),this.urlTimer=window.setTimeout(()=>{const t=this.params();this.lastWritten=t.toString(),Fe(this.path(this.sub),t),ue(de,this.filters)},e)}href(e){const t=this.params().toString();return`#${this.path(e)}${t?`?${t}`:""}`}async onSub(){const e=this.sub;if(this.subError="",e==="trash")return void this.loadTrash();if(e==="review")return void this.loadReview();if(!e){this.detail=null,this.detailMissing=!1;return}this.drawerUsed=!0,this.detailMissing=!1,this.detail=this.items?.find(t=>t.id===e)??null;try{const t=await U(e);this.sub===e&&(this.detail=t)}catch(t){this.sub===e&&t instanceof S&&t.status===404&&(this.detail=null,this.detailMissing=!0)}}demoLoading(){return!E()&&ee().params.get("state")==="loading"}async load(){if(!this.demoLoading()){try{this.status=await q()}catch(e){e instanceof S&&e.status===403?this.noView=!0:this.failed=f(e);return}if(z(this.status).kind!=="ready"){this.items=[];return}await this.loadList(),this.sub&&this.onSub()}}async loadList(){try{const e=await Te({limit:500});this.items=e.items,this.failed="",this.selected=new Set([...this.selected].filter(t=>e.items.some(s=>s.id===t)))}catch(e){this.items===null&&(this.failed=f(e))}}async refresh(e=!1){try{this.status=await q(e)}catch{}if(z(this.status).kind==="ready"&&await this.loadList(),this.sub==="trash")await this.loadTrash();else if(this.sub==="review")await this.loadReview();else if(this.sub)try{this.detail=await U(this.sub)}catch{}}async loadTrash(){try{this.trash=(await Le()).items,this.subError=""}catch(e){this.subError=f(e)}}async loadReview(){try{this.review=(await Oe()).items,this.subError=""}catch(e){this.subError=f(e)}}say(e,t="ok",s){window.clearTimeout(this.noteTimer),this.note={text:e,tone:t,action:s},this.noteTimer=window.setTimeout(()=>this.note=null,s?1e4:4e3)}get actionsHost(){return this.renderRoot.querySelector("schedule-actions")}async refreshStatusOnly(){try{this.status=await q()}catch{}}async restore(e,t){try{const s=await te(e);this.say(`"${s.schedule.display_name}" שוחזר`,"ok",{label:"פתיחה",run:()=>this.go(s.schedule.id)}),await this.refresh()}catch(s){if(s instanceof S&&s.code==="lowering_confirmation_required"&&t){this.trashLowering=t;return}this.say(f(s),"error"),await this.refresh()}}async confirmTrashLowering(e){const t=this.trashLowering;if(t){e.stopPropagation();try{const s=await te(t.trash_id,{confirm_lowering:!0,alarm_code:e.detail?.alarm_code??null});this.trashLowering=null,this.say(`"${s.schedule.display_name}" שוחזר`,"ok",{label:"פתיחה",run:()=>this.go(s.schedule.id)}),await this.refresh()}catch(s){this.trashLowering=null,this.say(f(s),"error")}}}setFilter(e,t=0){this.filters={...this.filters,...e},this.page=1,this.syncUrl(t)}clearFilters(){this.filters={...L,sort:this.filters.sort,group:this.filters.group},this.page=1,this.syncUrl()}setView(e){this.view=e,this.page=1,this.fitRows=null,ue(M,e),this.syncUrl()}newSchedule(){customElements.get("schedule-create-dialog")?this.createOpen=!0:k(`${y}/new/edit`)}toggleSel(e,t){const s=new Set(this.selected);t?s.add(e):s.delete(e),this.selected=s}async bulk(e){const t=(this.items??[]).filter(n=>this.selected.has(n.id)),s=Je(t).filter(n=>e==="disable"?n.enabled:!n.enabled).filter(n=>e==="disable"||!n.lowering),i=e==="enable"?t.filter(n=>n.lowering&&!n.enabled).length:0;if(!s.length){this.say(i?"תזמונים שפותחים או מנטרלים מופעלים אחד־אחד":"אין בבחירה תזמונים לשינוי","error");return}this.busy=!0;try{const n=await se(e,s.map(w=>w.id)),l=n.results.filter(w=>w.ok).length,o=n.results.length-l,b=e==="enable"?"הופעלו":"הושבתו";this.say(o?`${b} ${l}; ${o} לא שונו`:`${b} ${l}${i?`; ${i} מופעלים אחד־אחד`:""}`,o?"error":"ok"),this.selected=new Set}catch(n){this.say(f(n),"error")}finally{this.busy=!1,await this.refresh()}}async ack(e,t,s){this.busy=!0;try{await Ie(e,t,s),this.say(s?"האזהרה הוחזרה":"סומן כתקין")}catch(i){this.say(f(i),"error")}finally{this.busy=!1,await this.loadReview(),await this.refresh()}}async bulkReview(){const e=(this.review??[]).map(t=>t.schedule).filter(t=>this.reviewSel.has(t.id)&&t.enabled&&t.can.toggle);if(e.length){this.busy=!0;try{const t=await se("disable",e.map(i=>i.id)),s=t.results.filter(i=>i.ok).length;this.say(`הושבתו ${s}`,s===t.results.length?"ok":"error"),this.reviewSel=new Set}catch(t){this.say(f(t),"error")}finally{this.busy=!1,await this.refresh()}}}async doPurge(){const e=this.purging;if(e){try{await Pe(e.trash_id),this.purging=null,this.say(`"${e.name||"תזמון ללא שם"}" נמחק לצמיתות`)}catch(t){this.purging=null,this.say(f(t),"error")}await this.loadTrash()}}toggle(e,t){this.actionsHost?.enable(e,t)}menuAct(e,t){this.menuFor="",t==="run"?this.actionsHost?.run(e):t==="edit"?k(`${y}/${e.id}/edit`):t==="copy"?this.actionsHost?.copy(e):this.actionsHost?.askDelete(e)}header(e){const t=this.sub;if(t==="trash"||t==="review")return r;const s=this.items??[],i=oe(s,"floor"),n=this.filters,l=e.kind==="ready"&&this.items!==null,o=!!this.status?.can.manage,b=le(n),w=Qe(s),c=e.admin?this.status?.counts.attention??0:0,x=l&&i.length?a`<div class="rooms" role="group" aria-label="קומות">
          <button type="button" class="rc" aria-pressed=${String(!n.floor)} data-floor="" @click=${()=>this.setFilter({floor:""})}>הכל</button>
          ${i.map(m=>a`<button type="button" class="rc" aria-pressed=${String(n.floor===m.value)} data-floor=${m.value} @click=${()=>this.setFilter({floor:m.value})}>${g(m.label)}</button>`)}
        </div>`:r;return a`${this.phone?r:a`<div class="dh-row hdact" slot="actions">${x}${l&&s.length?a`<div class="vwrap">${this.viewSwitch()}</div>`:r}</div>`}
    <header class="dh" data-sched-header>
      ${this.phone&&x!==r?a`<div class="dh-row fl">${x}</div>`:r}
      ${l?a`<div class="dh-det" data-sched-toolbar>
        ${this.renderSegments()}
        ${s.length?a`<div class="seg sm stf" role="radiogroup" aria-label="סינון לפי מצב" ?data-open=${this.filtersOpen}>${Ze.map(m=>a`<button type="button" role="radio" aria-checked=${String(n.state===m.id)} data-state-filter=${m.id||"all"} @click=${()=>this.setFilter({state:m.id})}>${m.label}<small>${w[m.id]}</small></button>`)}</div>`:r}
        ${c?a`<button type="button" class="rc attn" data-open-review data-sched-attention @click=${()=>this.go("review")}><i class="wdot" aria-hidden="true"></i>${R("review")}<small>${c}</small></button>`:r}
        ${s.length?a`<button type="button" class="btn foldbtn" data-filters-toggle aria-label="סינון" title="סינון" aria-expanded=${String(this.filtersOpen)} @click=${()=>this.filtersOpen=!this.filtersOpen}>${d("filter")}<span class="lbl">סינון</span>${b?a`<small>${b}</small>`:r}</button>`:r}
        <span class="grow"></span>
        ${s.length&&this.phone?a`<div class="vwrap">${this.viewSwitch()}</div>`:r}
        ${s.length?a`<label class="search">${d("search")}<span class="sr-only">חיפוש</span><input type="search" data-filter="q" placeholder=${this.phone?"חיפוש":"חיפוש תזמון, התקן או תג"} .value=${me(n.q)} @input=${m=>this.setFilter({q:m.target.value},250)} /></label>`:r}
        ${o?a`<button type="button" class="btn primary newbtn" data-new-schedule ?disabled=${e.readOnly} title=${e.readOnly?e.readOnlyText:""} @click=${()=>this.newSchedule()}>${d("plus")}<span class="lbl">חדש</span></button>`:r}
        ${s.length&&this.filtersOpen?this.renderMoreFilters(s):r}
      </div>`:r}
    </header>`}viewSwitch(){return a`<div class="seg sm views" role="group" aria-label="תצוגה">${wt.map(e=>a`<button type="button" data-view-btn=${e} aria-pressed=${String(this.view===e)} aria-label=${ce[e]()} title=${ce[e]()} @click=${()=>this.setView(e)}>${d(ft[e])}</button>`)}</div>`}renderSegments(){const e=this.kavarnit.automations?We.filter(s=>this.autoKinds?this.autoKinds.includes(s.kind):s.id==="automations"):[];if(!e.length)return r;const t=this.status?.counts.visible;return a`<div class="seg kinds" role="tablist" aria-label="קברניט" data-kavarnit-segments @keydown=${De}>
      <button type="button" role="tab" aria-selected="true" data-segment="schedules">תזמונים${t===void 0?r:a` <small>${t}</small>`}</button>
      ${e.map(s=>a`<button type="button" role="tab" aria-selected="false" data-segment=${s.id} @click=${()=>k(He(s.id))}>${s.label}${this.autoCounts?a` <small>${this.autoCounts[s.kind]}</small>`:r}</button>`)}
    </div>`}dd(e,t,s,i,n){return a`<sw-dropdown data-filter=${e} .label=${t} .placeholder=${t} .value=${s} .items=${i} @change=${l=>n(l.detail.id)}></sw-dropdown>`}renderMoreFilters(e){const t=this.filters,s=oe(e,"area"),i=et(e),n=tt(e),l=this.status?.settings.shabbat_sensor??null,o=e.some(c=>c.conditions.preset),b=e.some(c=>c.conditions.items.length),w=(c,x)=>[{id:"",label:c},...x.map(m=>({id:m.value,label:m.label}))];return a`<div class="more" data-sched-filters>
      ${s.length>1?this.dd("area","כל האזורים",t.area,w("כל האזורים",s),c=>this.setFilter({area:c})):r}
      <span class="days" role="group" aria-label="ימים">${Be.map(c=>a`<button type="button" class="rc day" data-day-filter=${c} aria-pressed=${String(t.day===c)} aria-label=${`יום ${ae[c]}`} @click=${()=>this.setFilter({day:t.day===c?"":c})}>${ae[c]}</button>`)}</span>
      ${l||o?a`<button type="button" class="rc" data-chip-preset="only_holy_days" aria-pressed=${String(t.preset==="only_holy_days")} @click=${()=>this.setFilter({preset:t.preset==="only_holy_days"?"":"only_holy_days"})}>רק בשבת ובחג</button><button type="button" class="rc" data-chip-preset="not_holy_days" aria-pressed=${String(t.preset==="not_holy_days")} @click=${()=>this.setFilter({preset:t.preset==="not_holy_days"?"":"not_holy_days"})}>לא בשבת ובחג</button>`:r}
      ${b?a`<button type="button" class="rc" data-chip-has-cond aria-pressed=${String(t.hasConditions)} @click=${()=>this.setFilter({hasConditions:!t.hasConditions})}>עם תנאי</button>`:r}
      ${n.length>1?this.dd("condition","כל התנאים",t.condition,w("כל התנאים",n),c=>this.setFilter({condition:c})):r}
      ${i.length?a`<span class="sep" aria-hidden="true"></span>${i.map(c=>a`<button type="button" class="rc" data-chip-tag=${c.value} aria-pressed=${String(t.tag===c.value)} @click=${()=>this.setFilter({tag:t.tag===c.value?"":c.value})}>${g(c.label)}</button>`)}`:r}
      <span class="sep" aria-hidden="true"></span>
      ${this.dd("group","ללא קיבוץ",t.group,[{id:"",label:"ללא קיבוץ"},{id:"area",label:"לפי אזור"},{id:"floor",label:"לפי קומה"},{id:"tag",label:"לפי תג"},{id:"state",label:"לפי מצב"}],c=>this.setFilter({group:c}))}
      ${this.dd("sort","מיון: הרצה הבאה",t.sort,[{id:"next_run",label:"מיון: הרצה הבאה"},{id:"name",label:"מיון: שם"},{id:"order",label:"מיון: סדר ידני"},{id:"updated",label:"מיון: עודכן לאחרונה"}],c=>this.setFilter({sort:c||"next_run"}))}
      ${st(t)?a`<button type="button" class="btn sm quiet" data-clear-filters @click=${()=>this.clearFilters()}>נקה סינון</button>`:r}
    </div>`}skeleton(){const e=a`<div class="glass" style="padding:18px;display:flex;flex-direction:column;gap:12px;border-radius:24px"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:13px;inline-size:35%"></span><span class="skl" style="block-size:28px"></span><span class="skl" style="block-size:14px;inline-size:60%"></span></div>`;return a`<div data-sched-state="loading" aria-busy="true"><div class="cgrid">${Array.from({length:this.phone?3:6},()=>e)}</div></div>`}stateBox(e,t,s,i){return a`<div class="statebox glass" role="status" data-sched-state=${s}><span class="ring">${d(e)}</span><b>${t}</b>${i??r}</div>`}bannerRow(e){const t=e.readOnly&&!!this.status?.can.manage;return!e.stale&&!t?r:a`<div class="stack">
      ${e.stale?a`<div class="banner warn" role="status" data-sched-stale>${d("wifiOff")}<div>${at}</div><button type="button" class="btn sm" data-banner-retry @click=${()=>void this.refresh(!0)}>${d("refresh")}נסו שוב</button></div>`:r}
      ${t?a`<div class="banner info" role="status" data-sched-readonly>${d("lock")}<div>${e.readOnlyText}</div></div>`:r}
    </div>`}renderUpcoming(e){const t=it(e,new Date,48);if(!t.length)return r;const s=he(new Date),i=t[0],n=[0,6,12,18,24];return a`<div class="upnext glass" data-sched-upnext role="group" aria-label="ההרצות הבאות היום">
      <b>היום</b>
      <div class="tl">
        <span class="track" aria-hidden="true"><span class="past" style=${`inline-size:${(s*100).toFixed(2)}%`}></span></span>
        <span class="now" aria-hidden="true" style=${`left:${(s*100).toFixed(2)}%`}></span>
        ${n.map(l=>a`<span class=${`hr${l===0?" h0":l===24?" h24":""}`} aria-hidden="true" style=${`left:${l/24*100}%`}>${String(l).padStart(2,"0")}</span>`)}
        ${t.map(l=>a`<span class=${`tdot${l===i?" nx":""}`} aria-hidden="true" data-upcoming=${l.scheduleId} style=${`left:${(he(new Date(l.at))*100).toFixed(2)}%;--c:${W(l.tone)}`} title=${`${l.time} · ${l.name}${l.conditional?" · בתנאי":""}`}></span>`)}
      </div>
      <a class="up" href=${this.href(i.scheduleId)} data-upcoming-next=${i.scheduleId}><time class="n">${i.time}</time><span class="nm">${g(i.name)}</span>${i.conditional?a`<span class="what">· בתנאי</span>`:r}</a>
    </div>`}stateChip(e){return e.state==="triggered"?a`<span class="chip ok" data-state-chip="triggered">${V.triggered}</span>`:e.state==="completed"?a`<span class="chip" data-state-chip="completed">הסתיים</span>`:e.enabled&&e.state==="unavailable"?a`<span class="chip" data-state-chip="unavailable">${V.unavailable}</span>`:r}switchOf(e){return e.can.toggle?a`<button type="button" class="tog" role="switch" aria-checked=${String(e.enabled)} aria-label=${`${e.enabled?"השבתה":"הפעלה"} · ${e.display_name}`} data-toggle=${e.id} ?disabled=${this.busy} @click=${()=>this.toggle(e,!e.enabled)}></button>`:a`<span class=${`chip ${e.enabled?"ok":""}`} data-card-state>${e.enabled?"פעיל":"מושבת"}</span>`}menu(e){const t=(s,i,n,l,o="")=>l?a`<button type="button" role="menuitem" class=${o} data-card-action=${s} @click=${()=>this.menuAct(e,s)}>${d(i)}${n}</button>`:r;return a`<div class="pop" role="menu" aria-label=${`פעולות · ${e.display_name}`}>
      ${t("edit","edit","עריכה",e.can.edit)}
      ${t("run","play","הרץ עכשיו",e.can.run)}
      ${t("copy","copy","שכפול",e.can.copy)}
      ${e.can.delete?a`<hr />`:r}
      ${t("delete","trash","מחיקה",e.can.delete,"dz")}
    </div>`}renderCard(e){const t=ge(e),s=E()?null:O,i=be(e),n=e.can.edit||e.can.run||e.can.copy||e.can.delete,l=this.menuFor===e.id;return a`<article class=${`acard ${e.enabled?"on":"off"}`} data-schedule=${e.id} data-enabled=${e.enabled} ?data-picked=${this.selected.has(e.id)} ?data-menu=${l} aria-label=${e.display_name}>
      <header>
        <label class="pick" title="בחירה"><input type="checkbox" data-select=${e.id} aria-label=${`בחירת ${e.display_name}`} .checked=${this.selected.has(e.id)} @change=${o=>this.toggleSel(e.id,o.target.checked)} /></label>
        <div class="ttl">
          <h3><a class="name" href=${this.href(e.id)} data-card-open>${g(e.display_name)}</a></h3>
          <div class="where">${d("layers")}${i?a`<b>${g(i)}</b>`:r}<span class="ar">${g(C(e))}</span></div>
        </div>
        <div class="ctl">
          ${this.switchOf(e)}
          ${n?a`<button type="button" class="more-btn" aria-haspopup="menu" aria-expanded=${String(l)} aria-label=${`עוד · ${e.display_name}`} data-card-menu @click=${()=>this.menuFor=l?"":e.id}>${d("dots")}</button>`:r}
        </div>
        ${l?this.menu(e):r}
      </header>
      <div class="bar"><sw-schedule-bar .slots=${e.slots} .sun=${s}></sw-schedule-bar></div>
      <div class="meta">
        <sw-day-chips .days=${e.days} compact></sw-day-chips>
        ${t?a`<span class="chip info" data-period>${d("calendar")}${t}</span>`:r}
        <schedule-condition-chip .conditions=${e.conditions}></schedule-condition-chip>
        <sw-schedule-markers .sensitive=${e.sensitive} .lowering=${e.lowering}></sw-schedule-markers>
        ${e.slots.some(o=>o.actions.some(b=>b.invalid))?a`<span class="chip warn" data-invalid title=${e.slots.flatMap(o=>o.actions).find(o=>o.invalid)?.invalid?.message??""}>${d("warning")}פעולה לא תקפה</span>`:r}
        ${e.slots.some(o=>o.actions.some(b=>b.blocked))?a`<span class="chip warn" data-script-blocked title=${e.slots.flatMap(o=>o.actions).find(o=>o.blocked)?.blocked?.message??""}>${d("lock")}סקריפט לא מאושר</span>`:r}
        ${this.stateChip(e)}
      </div>
      <footer>
        <span class="run" data-card-run><i class=${`dot ${e.enabled&&e.next_run?"ok":""}`}></i>הרצה הבאה <b data-next-run>${I(e)}</b></span>
      </footer>
    </article>`}renderRow(e){const t=e.slots.slice(0,3);return a`<div class=${`tr${e.enabled?"":" off"}`} data-schedule=${e.id} data-enabled=${e.enabled} ?data-picked=${this.selected.has(e.id)}>
      <span class="csel"><label class="pick"><input type="checkbox" data-select=${e.id} aria-label=${`בחירת ${e.display_name}`} .checked=${this.selected.has(e.id)} @change=${s=>this.toggleSel(e.id,s.target.checked)} /></label></span>
      <span class="cname" style="min-inline-size:0"><a class="name" href=${this.href(e.id)}>${g(e.display_name)}</a><div class="sub">${g(C(e))}</div>${e.sensitive||e.lowering?a`<sw-schedule-markers .sensitive=${e.sensitive} .lowering=${e.lowering}></sw-schedule-markers>`:r}</span>
      <span class="cdays"><sw-day-chips .days=${e.days} compact></sw-day-chips></span>
      <span class="cslots slotrows">${t.map(s=>a`<span class="sr"><span class="w">${P(s)}</span><span class="a">${F(s,e).map(i=>a`<span class="ac" style=${`--c:${W(i.tone)}`} title=${i.devices.join(", ")}>${i.label}${i.devices.length>1?` · ${i.devices.length}`:""}</span>`)}</span></span>`)}${e.slots.length>t.length?a`<button type="button" class="linkbtn" @click=${()=>this.go(e.id)}>ועוד ${e.slots.length-t.length} משבצות</button>`:r}</span>
      <span class="ccond"><schedule-condition-chip .conditions=${e.conditions} compact></schedule-condition-chip></span>
      <span class="cnext"><b data-next-run>${I(e)}</b></span>
      <span class="ctog">${this.switchOf(e)}</span>
      <span class="cops ops">${e.can.run?a`<button type="button" class="rb sm" aria-label=${`הרץ עכשיו · ${e.display_name}`} title="הרץ עכשיו" data-run=${e.id} @click=${()=>this.actionsHost?.run(e)}>${d("play")}</button>`:r}${e.can.edit?a`<button type="button" class="rb sm" aria-label=${`עריכה · ${e.display_name}`} title="עריכה" data-edit=${e.id} @click=${()=>k(`${y}/${e.id}/edit`)}>${d("edit")}</button>`:r}</span>
    </div>`}renderTable(e){const t=e.length>0&&e.every(s=>this.selected.has(s.id));return a`<div class="tbl glass" data-sched-table>
      <div class="tr h"><span><label class="pick"><input type="checkbox" aria-label="בחירת הכול" data-select-all .checked=${t} @change=${s=>this.selected=s.target.checked?new Set([...this.selected,...e.map(i=>i.id)]):new Set([...this.selected].filter(i=>!e.some(n=>n.id===i)))} /></label></span><span>שם</span><span class="cdays">ימים</span><span>משעה · פעולה</span><span>תנאי</span><span>הרצה הבאה</span><span>פעיל</span><span></span></div>
      ${A(e,s=>s.id,s=>this.renderRow(s))}
    </div>`}rowIssue(e){return e.enabled&&e.state==="unavailable"?V.unavailable:e.slots.some(t=>t.actions.some(s=>s.invalid))?"פעולה לא תקפה":e.slots.some(t=>t.actions.some(s=>s.blocked))?"סקריפט לא מאושר":""}renderSchedRow(e,t){const s=be(e),i=e.can.edit||e.can.run||e.can.copy||e.can.delete,n=this.menuFor===e.id,l=this.rowIssue(e),o=E()?null:O;return a`<div class=${`lr${e.enabled?"":" off"}`} role="row" data-schedule=${e.id} data-enabled=${e.enabled} ?data-picked=${this.selected.has(e.id)} ?data-menu=${n}>
      ${t?a`<span class="lsel" role="cell"><label class="pick" title="בחירה"><input type="checkbox" data-select=${e.id} aria-label=${`בחירת ${e.display_name}`} .checked=${this.selected.has(e.id)} @change=${b=>this.toggleSel(e.id,b.target.checked)} /></label></span>`:r}
      <span class="ltog" role="cell">${this.switchOf(e)}</span>
      <span class="lname" role="cell"><a class="name" href=${this.href(e.id)} data-row-open>${g(e.display_name)}</a><span class="sub">${s?a`<b>${g(s)}</b> · `:r}${g(C(e))}</span></span>
      <span class="ldays" role="cell"><sw-day-chips .days=${e.days} compact></sw-day-chips></span>
      <span class="lbar" role="cell"><sw-schedule-bar compact .slots=${e.slots} .sun=${o}></sw-schedule-bar></span>
      <span class=${`lnext${l?" warn":""}`} role="cell" data-row-next title=${l}>${l?a`${d("warning")}${l}`:a`<i class=${`dot ${e.enabled&&e.next_run?"ok":""}`}></i><b data-next-run>${I(e)}</b>`}</span>
      <span class="lops" role="cell">${i?a`<button type="button" class="more-btn" aria-haspopup="menu" aria-expanded=${String(n)} aria-label=${`עוד · ${e.display_name}`} data-card-menu @click=${()=>this.menuFor=n?"":e.id}>${d("dots")}</button>`:r}${n?this.menu(e):r}</span>
    </div>`}renderRows(e){const t=this.selecting||this.selected.size>0;return a`<div class=${`rlist glass${t?" picking":""}`} role="table" aria-label="תזמונים" data-sched-rows>${A(e,s=>s.id,s=>this.renderSchedRow(s,t))}</div>`}renderList(e){if(this.view==="week")return a`<schedules-week-view .schedules=${e} .sun=${E()?null:O} .snap=${this.status?.settings.snap_minutes??15} @open-schedule=${c=>this.go(c.detail.id)}></schedules-week-view>`;const t=nt(e,this.filters.sort),s=this.phone?this.perPage.phone:this.perPage.wide,i=this.filters.group?s:qe(s,this.fitRows),n=Me(t.length,i),l=Ve(this.page,t.length,i),o=rt(Ae(t,l,i),this.filters.group),b=c=>this.view==="table"?this.renderTable(c):this.view==="rows"?this.renderRows(c):a`<div class="cgrid" data-sched-grid>${A(c,x=>x.id,x=>this.renderCard(x))}</div>`,w=n>1?a`<div class="lfoot" data-sched-pager><sw-pager .page=${l} .pages=${n} @page-change=${c=>{this.page=c.detail.page,this.menuFor=""}}></sw-pager></div>`:r;return this.filters.group?a`<div class="groups">${o.map(c=>a`<section class="fsec group" data-group=${c.key}><header class="sh"><h2>${g(c.label)}</h2></header>${b(c.items)}</section>`)}${w}</div>`:a`<div class="groups"><section class="fsec group" data-group="">${b(o[0]?.items??[])}</section>${w}</div>`}renderBulk(){const e=this.selected.size;if(this.selecting&&!e&&this.view!=="week")return a`<div class="editbar bulk" role="region" aria-label=${R("select")} data-bulk-bar="empty"><span class="t">${d("check")}0 נבחרו</span><span class="grow"></span><button type="button" class="btn sm quiet" data-select-done @click=${()=>this.selecting=!1}>${R("selectDone")}</button></div>`;if(!e||this.view==="week")return r;const t=!!this.status?.can.manage&&!!this.status?.writable;return a`<div class="editbar bulk" role="region" aria-label="פעולות על הבחירה" data-bulk-bar>
      <span class="t">${d("check")}${e} נבחרו</span>
      <span class="grow"></span>
      ${t?a`<button type="button" class="btn sm" data-bulk-enable ?disabled=${this.busy} @click=${()=>void this.bulk("enable")}>${d("play")}הפעלה</button><button type="button" class="btn sm" data-bulk-disable ?disabled=${this.busy} @click=${()=>void this.bulk("disable")}>${d("stop")}השבתה</button>`:r}
      <button type="button" class="btn sm quiet" data-bulk-clear @click=${()=>{this.selected=new Set,this.selecting=!1}}>ביטול בחירה</button>
    </div>`}renderTrash(){if(this.subError)return this.stateBox("warning",this.subError,"error",a`<button type="button" class="btn sm" data-sched-retry @click=${()=>void this.loadTrash()}>${d("refresh")}נסו שוב</button>`);if(this.trash===null)return this.skeleton();if(!this.trash.length)return this.stateBox("trash","סל המחזור ריק","trash-empty");const e=!!this.status?.can.configure&&!!this.status?.can.manage;return a`<div class="rows" data-sched-trash>${this.trash.map(t=>a`<div class="li glass" data-trash-item=${t.trash_id}>
        <div><div class="t">${g(t.name||"תזמון ללא שם")}</div><div class="d">${t.entities.map(s=>s.name).join(" · ")}</div><div class="d">${lt(t.deleted_at)}${t.deleted_by?` · ${t.deleted_by.display_name}`:""} · ${ot(t.expires_at)}</div></div>
        <div class="lops">${t.sensitive?a`<sw-schedule-markers .sensitive=${!0}></sw-schedule-markers>`:r}
          <button type="button" class="btn sm primary" data-restore=${t.trash_id} ?disabled=${!t.can_restore} title=${t.can_restore?"":"אין הרשאה לשחזר תזמון זה"} @click=${()=>void this.restore(t.trash_id,t)}>${d("restore")}שחזור</button>
          ${e?a`<button type="button" class="rb sm" aria-label="מחיקה לצמיתות" title="מחיקה לצמיתות" data-purge=${t.trash_id} @click=${()=>this.purging=t}>${d("trash")}</button>`:r}</div>
      </div>`)}</div>`}renderReview(){if(this.subError)return this.stateBox("warning",this.subError,"error",a`<button type="button" class="btn sm" data-sched-retry @click=${()=>void this.loadReview()}>${d("refresh")}נסו שוב</button>`);if(this.review===null)return this.skeleton();if(!this.review.length)return this.stateBox("check","אין תזמונים הדורשים בדיקה","review-empty");const e=this.reviewSel.size,t=!!this.status?.can.acknowledge;return a`<div class="rows" data-sched-review>${this.review.map(s=>a`<div class="li glass" data-review-item=${s.schedule.id}>
        <div style="display:flex;gap:10px;align-items:flex-start;min-inline-size:0">
          <label class="pick"><input type="checkbox" data-review-select=${s.schedule.id} aria-label=${`בחירת ${s.schedule.display_name}`} ?disabled=${!s.schedule.enabled||!s.schedule.can.toggle} .checked=${this.reviewSel.has(s.schedule.id)} @change=${i=>{const n=new Set(this.reviewSel);i.target.checked?n.add(s.schedule.id):n.delete(s.schedule.id),this.reviewSel=n}} /></label>
          <div style="min-inline-size:0"><div class="t"><a class="name" href=${this.href(s.schedule.id)}>${g(s.schedule.display_name)}</a></div><div class="d">${C(s.schedule)}${s.schedule.owner?` · ${s.schedule.owner.display_name}`:""}</div>
          <div class="issues">${s.issues.map(i=>{const n=t&&je.includes(i);return a`<span class="iss"><span class="chip warn" data-issue=${i}>${ie[i]}</span>${n?a`<button type="button" class="linkbtn" data-ack=${i} ?disabled=${this.busy} @click=${()=>void this.ack(s.schedule.id,i,!1)}>אשר כתקין</button>`:r}</span>`})}${(s.acknowledged??[]).map(i=>a`<span class="iss"><span class="chip acked" data-acked=${i.issue} title=${`${ie[i.issue]} · אושר${i.by?.display_name?` על ידי ${i.by.display_name}`:""}`}>${d("check")}אושר</span>${t?a`<button type="button" class="linkbtn" data-unack=${i.issue} ?disabled=${this.busy} @click=${()=>void this.ack(s.schedule.id,i.issue,!0)}>בטל אישור</button>`:r}</span>`)}</div></div>
        </div>
        <div class="lops"><span class=${s.schedule.enabled?"chip ok":"chip"}>${s.schedule.enabled?"פעיל":"מושבת"}</span></div>
      </div>`)}</div>
    ${e?a`<div class="editbar bulk" data-bulk-bar="review"><span class="t">${d("check")}${e} נבחרו</span><span class="grow"></span><button type="button" class="btn sm" data-review-disable ?disabled=${this.busy} @click=${()=>void this.bulkReview()}>${d("stop")}השבתת הנבחרים</button></div>`:r}`}renderReady(e){const t=this.items??[],s=dt(t,this.filters),i=!!this.status?.can.manage;let n;return t.length?s.length?n=a`${this.view!=="week"?this.renderUpcoming(t):r}${this.renderList(s)}`:n=this.stateBox("search","לא נמצאו תזמונים","no-match",a`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.clearFilters()}>נקה סינון</button>`):n=this.stateBox("calendar","אין עדיין תזמונים","empty",i&&!e.readOnly?a`<button type="button" class="btn primary" data-new-schedule @click=${()=>this.newSchedule()}>${d("plus")}תזמון חדש</button>`:void 0),a`${this.bannerRow(e)}${n}${this.renderBulk()}`}renderBody(e){const t=e.admin?a`<button type="button" class="btn sm" data-open-settings @click=${()=>k("/system/schedules")}>${d("settings")}הגדרות התזמונים</button>`:void 0;switch(e.kind){case"loading":return this.skeleton();case"error":return this.stateBox("warning","לא ניתן לטעון את הרשימה","error",a`<button type="button" class="btn sm" data-sched-retry @click=${()=>{this.failed="",this.items=null,this.load()}}>${d("refresh")}נסו שוב</button>`);case"no_view":return this.stateBox("lock","אין הרשאה לצפות בתזמונים","no_permission");case"feature_disabled":return this.stateBox("settings","התזמונים כבויים","feature_disabled",t);case"missing":return e.admin?this.stateBox("settings","רכיב התזמונים אינו מחובר","missing_admin",t):this.stateBox("calendar","אין תזמונים להצגה","missing");default:return this.sub==="trash"?this.renderTrash():this.sub==="review"?this.renderReview():this.renderReady(e)}}render(){const e=this.noView&&!this.status?{...z(null),kind:"no_view"}:z(this.status,!!this.failed&&!this.status),s=e.kind==="ready"&&this.items===null&&!!this.failed?{...e,kind:"error"}:e.kind==="ready"&&this.items===null?{...e,kind:"loading"}:e,i=this.sub,n=i&&i!=="trash"&&i!=="review"?i:"";return a`<sw-page class="page" heading=${i==="trash"?"סל מחזור":i==="review"?"תזמונים לבדיקה":"תזמונים"} backHref=${i==="trash"||i==="review"?y:""} data-sched-title data-screen="devices-schedules" data-sched-screen=${s.kind}>
        ${this.header(s)}
        ${this.renderBody(s)}
      </sw-page>
      ${s.kind==="ready"&&this.drawerUsed?a`<schedule-drawer ?open=${!!n} .schedule=${this.detail} .status=${this.status} ?missing=${this.detailMissing} @drawer-close=${()=>this.go("")} @edit=${o=>k(`${y}/${o.detail.id}/edit`)} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied}></schedule-drawer>`:r}
      ${s.kind==="ready"&&this.createOpen?a`<schedule-create-dialog .open=${!0} @close=${()=>this.createOpen=!1} @created=${o=>{this.createOpen=!1,this.refresh(),this.go(o.detail.id)}}></schedule-create-dialog>`:r}
      ${this.trashLowering?a`<schedule-lowering-dialog .open=${!0} .summary=${{entities:this.trashLowering.entities.filter(o=>o.sensitive).map(o=>o.name),times:[],text:`השחזור יחזיר תזמון שפותח או מנטרל ${this.trashLowering.entities.filter(o=>o.sensitive).map(o=>o.name).join(", ")} גם כשאיש אינו נמצא במקום.`}} .needsCode=${!1} @confirm=${o=>void this.confirmTrashLowering(o)} @close=${()=>this.trashLowering=null}></schedule-lowering-dialog>`:r}
      ${this.purging?a`<sw-dialog open heading=${`למחוק לצמיתות את "${this.purging.name||"תזמון ללא שם"}"?`} data-dialog="purge" @close=${()=>this.purging=null}><div class="dlgform"><p>אי אפשר יהיה לשחזר אותו.</p><div class="dlgrow"><button type="button" class="btn" @click=${()=>this.purging=null}>ביטול</button><button type="button" class="btn danger" data-purge-confirm @click=${()=>void this.doPurge()}>מחיקה</button></div></div></sw-dialog>`:r}
      <schedule-actions .status=${this.status} @changed=${this.onChanged} @deleted=${this.onDeleted} @copied=${this.onCopied} @result=${this.onResult}></schedule-actions>
      ${this.note?a`<div class=${`toast${this.note.tone==="error"?" bad":""}`} popover="manual" role="status" data-sched-note>${d(this.note.tone==="error"?"warning":"check")}${this.note.text}${this.note.action?a`<button type="button" class="btn sm" data-note-action @click=${()=>{const o=this.note?.action;this.note=null,o?.run()}}>${this.note.action.label}</button>`:r}</div>`:r}`}};h.styles=[Ue,...X,ht,H`
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
      background: var(--sw-accent-soft);
      border-color: transparent;
      color: var(--sw-accent-text);
      box-shadow: none;
    }
    .dh-det .seg.kinds button {
      padding-inline: 14px;
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
      font-weight: 700;
      color: var(--dv-accent-text);
    }
    .vwrap {
      flex: none;
    }
    .views button {
      padding-inline: 12px;
      min-inline-size: 40px;
    }
    .views .ic {
      font-size: var(--sw-fs-lg);
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
      font-weight: 700;
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
      font-weight: 700;
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
      font-weight: 600;
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
      font-weight: 600;
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
      font-weight: 600;
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
      font-weight: 700;
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
      font-weight: 700;
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
      font-weight: 700;
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
      font-weight: 700;
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
      font-weight: 600;
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
      font-weight: 700;
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
      font-weight: 500;
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
      .views button {
        min-inline-size: 44px;
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
      .dh-det .seg.kinds {
        order: 1;
        inline-size: 100%;
      }
      .dh-det .seg.kinds button {
        flex: 1;
        padding-inline: 8px;
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
  `];u([T({attribute:!1})],h.prototype,"kavarnit",2);u([p()],h.prototype,"autoKinds",2);u([p()],h.prototype,"autoCounts",2);u([p()],h.prototype,"status",2);u([p()],h.prototype,"items",2);u([p()],h.prototype,"failed",2);u([p()],h.prototype,"noView",2);u([p()],h.prototype,"filters",2);u([p()],h.prototype,"view",2);u([p()],h.prototype,"defaultView",2);u([p()],h.prototype,"perPage",2);u([p()],h.prototype,"page",2);u([p()],h.prototype,"fitRows",2);u([p()],h.prototype,"selecting",2);u([p()],h.prototype,"filtersOpen",2);u([p()],h.prototype,"selected",2);u([p()],h.prototype,"sub",2);u([p()],h.prototype,"detail",2);u([p()],h.prototype,"detailMissing",2);u([p()],h.prototype,"drawerUsed",2);u([p()],h.prototype,"trash",2);u([p()],h.prototype,"review",2);u([p()],h.prototype,"subError",2);u([p()],h.prototype,"note",2);u([p()],h.prototype,"createOpen",2);u([p()],h.prototype,"busy",2);u([p()],h.prototype,"reviewSel",2);u([p()],h.prototype,"menuFor",2);u([p()],h.prototype,"compactHeader",2);u([p()],h.prototype,"phone",2);u([p()],h.prototype,"trashLowering",2);u([p()],h.prototype,"purging",2);h=u([N("devices-schedules")],h);export{h as DevicesSchedules};
//# sourceMappingURL=devices-schedules-CgwKc-Sc.js.map
