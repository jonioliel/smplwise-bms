import{j as f,z as y,k as h,a as $,dN as m,af as p,dO as z,bE as S,dl as E,cM as o,q as k,dP as _,A as u,dQ as P,dR as x,b as l,dS as v,dT as g,cL as w,m as O}from"./index-DMqYQw_5.js";var T=Object.defineProperty,A=Object.getOwnPropertyDescriptor,d=(e,s,t,r)=>{for(var i=r>1?void 0:r?A(s,t):s,a=e.length-1,c;a>=0;a--)(c=e[a])&&(i=(r?c(s,t,i):c(i))||i);return r&&i&&T(s,t,i),i};const M={rows:()=>o("rows"),cards:()=>w("כרטיסים"),table:()=>w("טבלה"),week:()=>w("שבוע")};let n=class extends ${constructor(){super(...arguments),this.list="schedules",this.sizes={},this.view="rows",this.canEdit=!1,this.busy=!1,this.note="",this.error="",this.noteTimer=0}connectedCallback(){super.connectedCallback(),this.sizes=this.pick(m(null).pageSize),p()&&z().then(e=>{this.canEdit=e.can_edit;const s=m(e.settings);this.sizes=this.pick(s.pageSize),this.view=this.list==="automations"?s.automationsView:s.schedulesView}).catch(()=>{})}lists(){return this.list==="automations"?["automations","automations_cards"]:["schedules"]}pick(e){return Object.fromEntries(this.lists().map(s=>[s,{...e[s]}]))}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.noteTimer)}async save(e,s){this.busy=!0,this.error="";try{await S("settings",e),E(),this.note=o("saved"),window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",2500)}catch(t){s(),this.error=k(t)}finally{this.busy=!1}}setSize(e,s,t){const r=Math.round(Number(t)),i=this.sizes[e];if(!Number.isFinite(r)||!i)return;const a=Math.min(v,Math.max(g(e),r)),c={...i};if(a===(s?i.phone:i.wide)){this.requestUpdate();return}this.sizes={...this.sizes,[e]:s?{...i,phone:a}:{...i,wide:a}},this.save({[_(e,s)]:a},()=>this.sizes={...this.sizes,[e]:c})}setView(e){if(e===this.view)return;const s=this.view;this.view=e,this.save({[this.list==="automations"?"ui.automations_view":"ui.schedules_view"]:e},()=>this.view=s)}render(){const e=!this.canEdit||!p()||this.busy,s=(t,r,i)=>{const a=this.sizes[t],c=`${t==="automations_cards"?"cards-":""}${r?"phone":"wide"}`;return l`<div class="row"><span>${i}</span><input type="number" inputmode="numeric" min=${g(t)} max=${v} step="1" .value=${String(a?r?a.phone:a.wide:"")} ?disabled=${e}
        aria-label=${i} data-page-size=${c} @change=${b=>this.setSize(t,r,b.target.value)} /></div>`};return l`<sw-card heading=${o("listsHeading")} data-list-display=${this.list}>
      <div class="row"><span>${o("defaultView")}</span><sw-segmented label=${o("defaultView")} value=${this.view} ?disabled=${e} @change=${t=>this.setView(t.detail.value)}
        .options=${(this.list==="automations"?P:x).map(t=>({value:t,label:M[t](),attrs:{"data-default-view":t}}))}></sw-segmented></div>
      ${s(this.list,!1,o("perPageWide"))}
      ${s(this.list,!0,o("perPagePhone"))}
      ${this.list==="automations"?l`${s("automations_cards",!1,o("cardsPerPageWide"))}${s("automations_cards",!0,o("cardsPerPagePhone"))}`:u}
      <div class="foot">
        ${this.note?l`<span class="ok" role="status">${this.note}</span>`:u}
        ${this.error?l`<span class="err" role="alert">${this.error}</span>`:u}
        ${!this.canEdit&&p()?l`<span class="muted">${o("readOnly")}</span>`:u}
      </div>
    </sw-card>`}};n.styles=[f`
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
    /* POLISH2-295: the segmented control is the settings pages' own (the settings key, AA in both schemes); its own look (the chosen
       segment darker than the track in the dark scheme, 1.2:1) is gone. A read-only viewer sees the same contrast: no dimming.
       CR-CMP2-SEGMENTED-C-2450: it is sw-segmented (the settings key by default); the no-dimming stays through the disabled opacity */
    sw-segmented {
      --sw-disabled-opacity: 1;
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
  `];d([y()],n.prototype,"list",2);d([h()],n.prototype,"sizes",2);d([h()],n.prototype,"view",2);d([h()],n.prototype,"canEdit",2);d([h()],n.prototype,"busy",2);d([h()],n.prototype,"note",2);d([h()],n.prototype,"error",2);n=d([O("sw-list-display-settings")],n);
