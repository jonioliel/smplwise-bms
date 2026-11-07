import{hn as g,E as f,F as y,G as d,a as $,ho as w,i as p,hp as S,b9 as z,ga as _,fl as o,T as k,hq as E,A as u,hr as x,hs as P,e as h,ht as m,hu as v,H as A}from"./index-DTag9Y3p.js";var O=Object.defineProperty,T=Object.getOwnPropertyDescriptor,c=(e,s,t,r)=>{for(var i=r>1?void 0:r?T(s,t):s,a=e.length-1,l;a>=0;a--)(l=e[a])&&(i=(r?l(s,t,i):l(i))||i);return r&&i&&O(s,t,i),i};const V={rows:()=>o("rows"),cards:()=>"כרטיסים",table:()=>"טבלה",week:()=>"שבוע"};let n=class extends ${constructor(){super(...arguments),this.list="schedules",this.sizes={},this.view="rows",this.canEdit=!1,this.busy=!1,this.note="",this.error="",this.noteTimer=0}connectedCallback(){super.connectedCallback(),this.sizes=this.pick(w(null).pageSize),p()&&S().then(e=>{this.canEdit=e.can_edit;const s=w(e.settings);this.sizes=this.pick(s.pageSize),this.view=this.list==="automations"?s.automationsView:s.schedulesView}).catch(()=>{})}lists(){return this.list==="automations"?["automations","automations_cards"]:["schedules"]}pick(e){return Object.fromEntries(this.lists().map(s=>[s,{...e[s]}]))}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.noteTimer)}async save(e,s){this.busy=!0,this.error="";try{await z("settings",e),_(),this.note=o("saved"),window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",2500)}catch(t){s(),this.error=k(t)}finally{this.busy=!1}}setSize(e,s,t){const r=Math.round(Number(t)),i=this.sizes[e];if(!Number.isFinite(r)||!i)return;const a=Math.min(m,Math.max(v(e),r)),l={...i};if(a===(s?i.phone:i.wide)){this.requestUpdate();return}this.sizes={...this.sizes,[e]:s?{...i,phone:a}:{...i,wide:a}},this.save({[E(e,s)]:a},()=>this.sizes={...this.sizes,[e]:l})}setView(e){if(e===this.view)return;const s=this.view;this.view=e,this.save({[this.list==="automations"?"ui.automations_view":"ui.schedules_view"]:e},()=>this.view=s)}render(){const e=!this.canEdit||!p()||this.busy,s=(t,r,i)=>{const a=this.sizes[t],l=`${t==="automations_cards"?"cards-":""}${r?"phone":"wide"}`;return h`<div class="row"><span>${i}</span><input type="number" inputmode="numeric" min=${v(t)} max=${m} step="1" .value=${String(a?r?a.phone:a.wide:"")} ?disabled=${e}
        aria-label=${i} data-page-size=${l} @change=${b=>this.setSize(t,r,b.target.value)} /></div>`};return h`<sw-card heading=${o("listsHeading")} data-list-display=${this.list}>
      <div class="row"><span>${o("defaultView")}</span><span class="seg" role="group" aria-label=${o("defaultView")}>${(this.list==="automations"?x:P).map(t=>h`<button type="button" data-default-view=${t} aria-pressed=${String(this.view===t)} ?disabled=${e} @click=${()=>this.setView(t)}>${V[t]()}</button>`)}</span></div>
      ${s(this.list,!1,o("perPageWide"))}
      ${s(this.list,!0,o("perPagePhone"))}
      ${this.list==="automations"?h`${s("automations_cards",!1,o("cardsPerPageWide"))}${s("automations_cards",!0,o("cardsPerPagePhone"))}`:u}
      <div class="foot">
        ${this.note?h`<span class="ok" role="status">${this.note}</span>`:u}
        ${this.error?h`<span class="err" role="alert">${this.error}</span>`:u}
        ${!this.canEdit&&p()?h`<span class="muted">${o("readOnly")}</span>`:u}
      </div>
    </sw-card>`}};n.styles=[g,f`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
      flex-wrap: wrap;
      padding-block: var(--sw-s-2);
    }
    .row + .row {
      border-block-start: 1px solid var(--sw-border);
    }
    /* POLISH2-295: the segmented control is the settings pages' own (settingsSegStyles: the accent with the inverse label when chosen,
       AA in both schemes); its own look (the chosen segment darker than the track in the dark scheme, 1.2:1) is gone. A read-only
       viewer sees the same contrast: no dimming. */
    .seg button:disabled {
      cursor: default;
    }
    input[type='number'] {
      inline-size: 5.5em;
      min-block-size: var(--sw-ctl-h-md);
      padding-inline: var(--sw-s-2);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-variant-numeric: tabular-nums;
    }
    .seg button:focus-visible,
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .foot {
      display: flex;
      gap: var(--sw-s-3);
      align-items: center;
      min-block-size: 20px;
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: var(--sw-success-text);
    }
    .err {
      color: var(--sw-danger-text);
    }
    .muted {
      color: var(--sw-text-3);
    }
  `];c([y()],n.prototype,"list",2);c([d()],n.prototype,"sizes",2);c([d()],n.prototype,"view",2);c([d()],n.prototype,"canEdit",2);c([d()],n.prototype,"busy",2);c([d()],n.prototype,"note",2);c([d()],n.prototype,"error",2);n=c([A("sw-list-display-settings")],n);
//# sourceMappingURL=sw-list-display-settings-DYzYekr2.js.map
