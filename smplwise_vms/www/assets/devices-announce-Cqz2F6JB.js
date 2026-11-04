import{a as S,i as z,aw as _,iU as f,T as m,iT as g,e as i,A as h,E as T,G as o,H as N}from"./index-CNy_qMuw.js";import{c as O,k as L,j as A,l as b,A as w}from"./announcements-BvR8onR_.js";import{A as u,h as P,i as x,j as C,k as D,l as E,m as j,n as $,o as U,q as B,u as v,v as H,w as W,a as y}from"./model-D-8_5Kkz.js";import"./sw-logo-art-Va6y_cIM.js";var q=Object.defineProperty,I=Object.getOwnPropertyDescriptor,r=(e,t,a,c)=>{for(var l=c>1?void 0:c?I(t,a):t,p=e.length-1,d;p>=0;p--)(d=e[p])&&(l=(c?d(t,a,l):d(l))||l);return c&&l&&q(t,a,l),l};const M=(e=3500)=>new Promise(t=>setTimeout(t,e));let n=class extends S{constructor(){super(...arguments),this.phase="loading",this.err="",this.form=null,this.room=u,this.langs=["he"],this.texts={},this.tpl="",this.viaSpeakers=!0,this.viaScreens=!0,this.busy="",this.note="",this.machine=new Set}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(!z()){this.phase="ready";return}if(!_("media.announce")){this.phase="forbidden";return}this.phase="loading",this.err="";try{const e=await O();if(this.form=e,!e.enabled){this.phase="off";return}const t=P(f());this.langs=e.languages.includes(t)?[t]:["he"],this.viaScreens=e.screens_default_on!==!1,this.phase="ready"}catch(e){this.err=m(e),this.phase="error"}}say(e){this.note=e,M().then(()=>{this.note===e&&(this.note="")})}pickTemplate(e){this.tpl=e;const t=this.form?.templates.find(a=>a.id===e);t&&(this.texts=x(this.texts,t,this.langs))}setLang(e){const t=!this.langs.includes(e);this.langs=C(this.langs,e,t);const a=this.form?.templates.find(c=>c.id===this.tpl);a&&(this.texts=x(this.texts,a,this.langs))}async runTranslate(){this.busy="translate",this.err="";try{const e=await L((this.texts.he??"").trim(),this.form?.translate_targets),t=D(this.texts,this.langs,this.machine,e.items);this.texts=t.texts,this.langs=t.selected,this.machine=t.machine}catch(e){this.err=m(e)}finally{this.busy=""}}typed(e,t){this.texts={...this.texts,[e]:t},this.machine=E(this.machine,e,t)}clearDraft(){this.texts={},this.machine=new Set}async send(){const e=g();this.busy="send",this.err="";try{const t=this.room===u,a=await A({scope:t?"all":"area",ref:this.room,texts:$(this.texts,this.langs,this.machine),...this.tpl?{template_id:this.tpl}:{},...j(this.viaSpeakers,this.viaScreens,!!this.form?.screens_enabled)});this.say(a.status==="queued"?e.sentQueued:e.sent),this.clearDraft(),this.tpl=""}catch(t){this.err=m(t)}finally{this.busy=""}}async emergency(e,t=!1){this.busy=`e:${e}`,this.err="";try{t?(await b({texts:$(this.texts,this.langs,this.machine)}),this.clearDraft()):await b({template_id:e}),this.say(g().emergencySent)}catch(a){this.err=m(a)}finally{this.busy=""}}render(){const e=g(),t=f();if(this.phase==="forbidden")return i`<sw-page heading=${e.title}><sw-state-panel state="forbidden" heading=${e.forbidden}></sw-state-panel></sw-page>`;if(this.phase==="loading")return i`<sw-page heading=${e.title}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.phase==="error")return i`<sw-page heading=${e.title}><sw-state-panel state="error" heading=${this.err} actionLabel="↻" @action=${()=>void this.load()}></sw-state-panel></sw-page>`;if(this.phase==="off")return i`<sw-page heading=${e.title}><sw-state-panel icon="bell" state="empty" heading=${e.off}></sw-state-panel></sw-page>`;const a=this.form;if(!a)return i`<sw-page heading=${e.title}><sw-state-panel icon="bell" state="empty" heading=${e.noTargets}></sw-state-panel></sw-page>`;const c=U(a.templates),l=B(a.templates),p=!!a.screens_enabled,d=v(this.room,this.texts,this.langs)&&H(this.viaSpeakers,this.viaScreens,p)&&this.busy==="";return i`<sw-page heading=${e.title} data-announce-screen>
      <div class="grid">
        <div class="panel" data-announce-form>
          <div class="row"><span class="lbl">${e.where}</span>
            <select data-announce-where aria-label=${e.where} @change=${s=>this.room=s.target.value}>
              <option value=${u} ?selected=${this.room===u}>${e.wholeBuilding}</option>
              ${a.areas.map(s=>i`<option value=${s.area_id} ?selected=${s.area_id===this.room}>${[s.floor_name,s.name].filter(Boolean).join(" · ")}</option>`)}
            </select></div>
          ${p?i`<div class="row"><span class="lbl">${e.channels}</span>
            <button class="chip" type="button" data-announce-via="speakers" aria-pressed=${String(this.viaSpeakers)} @click=${()=>this.viaSpeakers=!this.viaSpeakers}>${e.channelSpeakers}</button>
            <button class="chip" type="button" data-announce-via="screens" aria-pressed=${String(this.viaScreens)} @click=${()=>this.viaScreens=!this.viaScreens}>${e.channelScreens}</button></div>`:h}
          <div class="row"><span class="lbl">${e.languages}</span>
            ${w.map(s=>i`<button class="chip" type="button" data-announce-lang=${s} aria-pressed=${String(this.langs.includes(s))} @click=${()=>this.setLang(s)}>${e.langName[s]}</button>`)}
            ${a.translate_enabled?i`<button class="chip" type="button" data-announce-translate aria-busy=${this.busy==="translate"?"true":"false"} ?disabled=${!W(!0,this.texts)||this.busy!==""} @click=${()=>void this.runTranslate()}>${this.busy==="translate"?e.translating:e.translate}</button>`:h}</div>
          <div class="row"><span class="lbl">${e.template}</span>
            <select data-announce-template aria-label=${e.template} @change=${s=>this.pickTemplate(s.target.value)}>
              <option value="" ?selected=${this.tpl===""}>${e.noTemplate}</option>
              ${c.map(s=>i`<option value=${s.id} ?selected=${s.id===this.tpl}>${y(s,t)}</option>`)}
            </select></div>
          ${w.filter(s=>this.langs.includes(s)).map(s=>i`<div class="part"><span class="part-h"><span class="lbl">${e.langName[s]}</span>
            ${this.machine.has(s)&&(this.texts[s]??"").trim()?i`<span class="mt" data-announce-machine=${s}>${e.machineBadge}</span>`:h}</span>
            <textarea data-announce-text=${s} dir=${s==="he"||s==="ar"?"rtl":"ltr"} lang=${s} maxlength=${a.max_text} aria-label=${this.machine.has(s)?`${e.langName[s]} · ${e.machineBadge}`:e.langName[s]} .value=${this.texts[s]??""}
              @input=${k=>this.typed(s,k.target.value)}></textarea></div>`)}
          <div class="row"><sw-button variant="primary" icon="check" data-announce-send ?disabled=${!d} @click=${()=>void this.send()}>${e.send}</sw-button>
            ${this.note?i`<span class="ok" role="status">${this.note}</span>`:h}</div>
          ${this.err?i`<div class="err" role="alert">${this.err}</div>`:h}
        </div>
        ${l.length||v(this.room,this.texts,this.langs)?i`<div class="panel em" data-announce-emergency>
          ${v(u,this.texts,this.langs)?i`<sw-button variant="danger" data-announce-emergency-free ?disabled=${this.busy!==""} @click=${()=>void this.emergency("free",!0)}>${e.emergencyFree}</sw-button>`:h}
          ${l.map(s=>i`<sw-button variant="danger" data-announce-emergency-button=${s.id} ?disabled=${this.busy!==""} @click=${()=>void this.emergency(s.id)}>${y(s,t)}</sw-button>`)}
        </div>`:h}
      </div>
    </sw-page>`}};n.styles=T`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 280px); gap: 14px; align-items: start; }
    @media (max-width: 760px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .panel { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-1); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
    .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 64px; }
    select, textarea { box-sizing: border-box; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); max-inline-size: 100%; }
    select { min-block-size: 36px; padding-inline: 10px; cursor: pointer; }
    textarea { inline-size: 100%; padding: 8px 10px; resize: none; block-size: 56px; }
    /* POLISH4-WP4 (D24): every radius from the tokens (the chip and the machine mark were literal pills) */
    .chip { min-block-size: 34px; padding-inline: 12px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border-strong); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; }
    .chip[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
    .part { display: flex; flex-direction: column; gap: 4px; }
    .em { display: flex; flex-direction: column; gap: 8px; }
    .em sw-button { inline-size: 100%; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    /* ANNOUNCE-297 design pass: press feedback on the chips (the translate chip too), no double-tap delay; POLISH4-WP4: the motion tokens,
       a pressed wash on pointer-down, the hover only under a pointer that hovers, a visible keyboard focus */
    .chip { touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
      transition: transform var(--sw-t-press) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease); }
    .chip:active:not([disabled]) { transform: scale(0.97); }
    .chip:not([aria-pressed='true']):active:not([disabled]) { background: var(--sw-pressed-wash); }
    @media (hover: hover) and (pointer: fine) {
      .chip:not([aria-pressed='true']):hover:not([disabled]) { background: var(--sw-hover-wash); border-color: var(--sw-text-3); }
      select:hover, textarea:hover { border-color: var(--sw-text-3); }
    }
    .chip:focus-visible, select:focus-visible, textarea:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .chip[disabled] { opacity: var(--sw-disabled-opacity, 0.45); cursor: default; }
    .chip[aria-busy='true'] { cursor: progress; }
    /* a long translation grows its field instead of hiding lines (a 200-character Russian text at phone width); one line keeps the old height */
    textarea { field-sizing: content; min-block-size: 56px; max-block-size: 160px; block-size: auto; }
    .part-h { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    /* ANNOUNCE2-297: the machine mark is quiet (neutral, small): the translation is an aid, not a warning */
    .mt { padding: 1px 8px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-xs); white-space: nowrap; background: color-mix(in srgb, var(--sw-text-2) 10%, var(--sw-surface)); color: var(--sw-text-2); }
    @media (pointer: coarse) {
      textarea, select { font-size: var(--sw-fs-xl); } /* no zoom-in on focus on a phone (needs >= 16px; the xl tier is 17px) */
      /* POLISH4-WP4: a 44 px target on touch for the chips and the pickers */
      .chip, select { min-block-size: 44px; }
    }
    @media (prefers-reduced-motion: reduce) { .chip { transition: none; } .chip:active:not([disabled]) { transform: none; } }
    .err { padding: 8px 12px; border-radius: var(--sw-r-md); background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface)); color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
  `;r([o()],n.prototype,"phase",2);r([o()],n.prototype,"err",2);r([o()],n.prototype,"form",2);r([o()],n.prototype,"room",2);r([o()],n.prototype,"langs",2);r([o()],n.prototype,"texts",2);r([o()],n.prototype,"tpl",2);r([o()],n.prototype,"viaSpeakers",2);r([o()],n.prototype,"viaScreens",2);r([o()],n.prototype,"busy",2);r([o()],n.prototype,"note",2);r([o()],n.prototype,"machine",2);n=r([N("devices-announce")],n);export{n as DevicesAnnounce};
//# sourceMappingURL=devices-announce-Cqz2F6JB.js.map
