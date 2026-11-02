import{a as S,i as z,av as _,h_ as b,R as m,hZ as g,e as i,A as p,E as N,G as o,H as T}from"./index-DqJBc8eX.js";import{c as A,k as O,j as L,l as v,A as x}from"./announcements-B0UyGKT4.js";import{A as u,h as C,i as w,j as D,k as E,l as j,m as P,n as $,o as B,q as U,u as f,v as q,w as M,a as y}from"./model-gIx1YPP0.js";import"./sw-logo-art-Va6y_cIM.js";var R=Object.defineProperty,F=Object.getOwnPropertyDescriptor,r=(e,s,a,c)=>{for(var l=c>1?void 0:c?F(s,a):s,h=e.length-1,d;h>=0;h--)(d=e[h])&&(l=(c?d(s,a,l):d(l))||l);return c&&l&&R(s,a,l),l};const G=(e=3500)=>new Promise(s=>setTimeout(s,e));let n=class extends S{constructor(){super(...arguments),this.phase="loading",this.err="",this.form=null,this.room=u,this.langs=["he"],this.texts={},this.tpl="",this.viaSpeakers=!0,this.viaScreens=!0,this.busy="",this.note="",this.machine=new Set}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(!z()){this.phase="ready";return}if(!_("media.announce")){this.phase="forbidden";return}this.phase="loading",this.err="";try{const e=await A();if(this.form=e,!e.enabled){this.phase="off";return}const s=C(b());this.langs=e.languages.includes(s)?[s]:["he"],this.viaScreens=e.screens_default_on!==!1,this.phase="ready"}catch(e){this.err=m(e),this.phase="error"}}say(e){this.note=e,G().then(()=>{this.note===e&&(this.note="")})}pickTemplate(e){this.tpl=e;const s=this.form?.templates.find(a=>a.id===e);s&&(this.texts=w(this.texts,s,this.langs))}setLang(e){const s=!this.langs.includes(e);this.langs=D(this.langs,e,s);const a=this.form?.templates.find(c=>c.id===this.tpl);a&&(this.texts=w(this.texts,a,this.langs))}async runTranslate(){this.busy="translate",this.err="";try{const e=await O((this.texts.he??"").trim(),this.form?.translate_targets),s=E(this.texts,this.langs,this.machine,e.items);this.texts=s.texts,this.langs=s.selected,this.machine=s.machine}catch(e){this.err=m(e)}finally{this.busy=""}}typed(e,s){this.texts={...this.texts,[e]:s},this.machine=j(this.machine,e,s)}clearDraft(){this.texts={},this.machine=new Set}async send(){const e=g();this.busy="send",this.err="";try{const s=this.room===u,a=await L({scope:s?"all":"area",ref:this.room,texts:$(this.texts,this.langs,this.machine),...this.tpl?{template_id:this.tpl}:{},...P(this.viaSpeakers,this.viaScreens,!!this.form?.screens_enabled)});this.say(a.status==="queued"?e.sentQueued:e.sent),this.clearDraft(),this.tpl=""}catch(s){this.err=m(s)}finally{this.busy=""}}async emergency(e,s=!1){this.busy=`e:${e}`,this.err="";try{s?(await v({texts:$(this.texts,this.langs,this.machine)}),this.clearDraft()):await v({template_id:e}),this.say(g().emergencySent)}catch(a){this.err=m(a)}finally{this.busy=""}}render(){const e=g(),s=b();if(this.phase==="forbidden")return i`<sw-page heading=${e.title}><sw-state-panel state="forbidden" heading=${e.forbidden}></sw-state-panel></sw-page>`;if(this.phase==="loading")return i`<sw-page heading=${e.title}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.phase==="error")return i`<sw-page heading=${e.title}><sw-state-panel state="error" heading=${this.err} actionLabel="↻" @action=${()=>void this.load()}></sw-state-panel></sw-page>`;if(this.phase==="off")return i`<sw-page heading=${e.title}><sw-state-panel icon="bell" state="empty" heading=${e.off}></sw-state-panel></sw-page>`;const a=this.form;if(!a)return i`<sw-page heading=${e.title}><sw-state-panel icon="bell" state="empty" heading=${e.noTargets}></sw-state-panel></sw-page>`;const c=B(a.templates),l=U(a.templates),h=!!a.screens_enabled,d=f(this.room,this.texts,this.langs)&&q(this.viaSpeakers,this.viaScreens,h)&&this.busy==="";return i`<sw-page heading=${e.title} data-announce-screen>
      <div class="grid">
        <div class="panel" data-announce-form>
          <div class="row"><span class="lbl">${e.where}</span>
            <select data-announce-where aria-label=${e.where} @change=${t=>this.room=t.target.value}>
              <option value=${u} ?selected=${this.room===u}>${e.wholeBuilding}</option>
              ${a.areas.map(t=>i`<option value=${t.area_id} ?selected=${t.area_id===this.room}>${[t.floor_name,t.name].filter(Boolean).join(" · ")}</option>`)}
            </select></div>
          ${h?i`<div class="row"><span class="lbl">${e.channels}</span>
            <button class="chip" type="button" data-announce-via="speakers" aria-pressed=${String(this.viaSpeakers)} @click=${()=>this.viaSpeakers=!this.viaSpeakers}>${e.channelSpeakers}</button>
            <button class="chip" type="button" data-announce-via="screens" aria-pressed=${String(this.viaScreens)} @click=${()=>this.viaScreens=!this.viaScreens}>${e.channelScreens}</button></div>`:p}
          <div class="row"><span class="lbl">${e.languages}</span>
            ${x.map(t=>i`<button class="chip" type="button" data-announce-lang=${t} aria-pressed=${String(this.langs.includes(t))} @click=${()=>this.setLang(t)}>${e.langName[t]}</button>`)}
            ${a.translate_enabled?i`<button class="chip" type="button" data-announce-translate aria-busy=${this.busy==="translate"?"true":"false"} ?disabled=${!M(!0,this.texts)||this.busy!==""} @click=${()=>void this.runTranslate()}>${this.busy==="translate"?e.translating:e.translate}</button>`:p}</div>
          <div class="row"><span class="lbl">${e.template}</span>
            <select data-announce-template aria-label=${e.template} @change=${t=>this.pickTemplate(t.target.value)}>
              <option value="" ?selected=${this.tpl===""}>${e.noTemplate}</option>
              ${c.map(t=>i`<option value=${t.id} ?selected=${t.id===this.tpl}>${y(t,s)}</option>`)}
            </select></div>
          ${x.filter(t=>this.langs.includes(t)).map(t=>i`<div class="part"><span class="part-h"><span class="lbl">${e.langName[t]}</span>
            ${this.machine.has(t)&&(this.texts[t]??"").trim()?i`<span class="mt" data-announce-machine=${t}>${e.machineBadge}</span>`:p}</span>
            <textarea data-announce-text=${t} dir=${t==="he"||t==="ar"?"rtl":"ltr"} lang=${t} maxlength=${a.max_text} aria-label=${this.machine.has(t)?`${e.langName[t]} · ${e.machineBadge}`:e.langName[t]} .value=${this.texts[t]??""}
              @input=${k=>this.typed(t,k.target.value)}></textarea></div>`)}
          <div class="row"><sw-button variant="primary" icon="check" data-announce-send ?disabled=${!d} @click=${()=>void this.send()}>${e.send}</sw-button>
            ${this.note?i`<span class="ok" role="status">${this.note}</span>`:p}</div>
          ${this.err?i`<div class="err" role="alert">${this.err}</div>`:p}
        </div>
        ${l.length||f(this.room,this.texts,this.langs)?i`<div class="panel em" data-announce-emergency>
          ${f(u,this.texts,this.langs)?i`<sw-button variant="danger" data-announce-emergency-free ?disabled=${this.busy!==""} @click=${()=>void this.emergency("free",!0)}>${e.emergencyFree}</sw-button>`:p}
          ${l.map(t=>i`<sw-button variant="danger" data-announce-emergency-button=${t.id} ?disabled=${this.busy!==""} @click=${()=>void this.emergency(t.id)}>${y(t,s)}</sw-button>`)}
        </div>`:p}
      </div>
    </sw-page>`}};n.styles=N`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 280px); gap: 14px; align-items: start; }
    @media (max-width: 760px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .panel { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg, 12px); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
    .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 64px; }
    select, textarea { box-sizing: border-box; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); max-inline-size: 100%; }
    select { min-block-size: 36px; padding-inline: 10px; }
    textarea { inline-size: 100%; padding: 8px 10px; resize: none; block-size: 56px; }
    .chip { min-block-size: 34px; padding-inline: 12px; border-radius: 999px; border: 1px solid var(--sw-border-strong); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; }
    .chip[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
    .part { display: flex; flex-direction: column; gap: 4px; }
    .em { display: flex; flex-direction: column; gap: 8px; }
    .em sw-button { inline-size: 100%; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    /* ANNOUNCE-297 design pass: press feedback on the chips (the translate chip too), no double-tap delay */
    .chip { touch-action: manipulation; user-select: none; -webkit-user-select: none; transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1); }
    .chip:active:not([disabled]) { transform: scale(0.97); }
    .chip[disabled] { opacity: var(--sw-disabled-opacity, 0.45); cursor: default; }
    /* a long translation grows its field instead of hiding lines (a 200-character Russian text at phone width); one line keeps the old height */
    textarea { field-sizing: content; min-block-size: 56px; max-block-size: 160px; block-size: auto; }
    .part-h { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    /* ANNOUNCE2-297: the machine mark is quiet (neutral, small): the translation is an aid, not a warning */
    .mt { padding: 1px 8px; border-radius: 999px; font-size: var(--sw-fs-xs); white-space: nowrap; background: color-mix(in srgb, var(--sw-text-2) 10%, var(--sw-surface)); color: var(--sw-text-2); }
    @media (pointer: coarse) {
      textarea, select { font-size: var(--sw-fs-xl); } /* no zoom-in on focus on a phone (needs >= 16px; the xl tier is 17px) */
    }
    @media (prefers-reduced-motion: reduce) { .chip { transition: none; } }
    .err { padding: 8px 12px; border-radius: var(--sw-r-md); background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface)); color: var(--sw-danger); font-size: var(--sw-fs-sm); }
  `;r([o()],n.prototype,"phase",2);r([o()],n.prototype,"err",2);r([o()],n.prototype,"form",2);r([o()],n.prototype,"room",2);r([o()],n.prototype,"langs",2);r([o()],n.prototype,"texts",2);r([o()],n.prototype,"tpl",2);r([o()],n.prototype,"viaSpeakers",2);r([o()],n.prototype,"viaScreens",2);r([o()],n.prototype,"busy",2);r([o()],n.prototype,"note",2);r([o()],n.prototype,"machine",2);n=r([T("devices-announce")],n);export{n as DevicesAnnounce};
//# sourceMappingURL=devices-announce-VcEYiTDQ.js.map
