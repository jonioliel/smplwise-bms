import{g as D,ax as y,j as h,i as I,A as u,b as r,k as L,aU as O,aL as S,kg as f,kh as d,ki as T,eS as C,a2 as v,dO as z,kj as x,kk as $,kl as w,km as k,kn as P,dM as A,ko as j,dF as p,n as M,kp as B,kq as N,kr as g,ks as R,kt as _,ku as U,kv as V}from"./index-DkcUEx2W.js";import{listRoles as Y}from"./access-DdMAztAb.js";import{s as F,p as H,S as q,a as E,t as K}from"./system-diagnostics-BurXJUJ7.js";import"./sw-logo-art-PLtEZJxU.js";import"./static-uXwPZ7cF.js";import"./settings-Dsy9KBNg.js";import"./long-lists-CuzkbAQF.js";import"./skins-BD5YVADK.js";import"./plan-view-Bex3zCOq.js";import"./ha-sync-status-ZWp1dJzN.js";import"./quality-mode-qG3DSOOI.js";import"./map-CsCJvpdZ.js";import"./quality-ladder-BJdzM0n9.js";import"./plan-quality-aRqUSGwU.js";import"./wall-phone-bar-BH-79e8R.js";import"./safe-storage-BOOiiGOc.js";var G=Object.defineProperty,J=Object.getOwnPropertyDescriptor,m=(e,s,t,i)=>{for(var a=i>1?void 0:i?J(s,t):s,o=e.length-1,n;o>=0;o--)(n=e[o])&&(a=(i?n(s,t,a):n(a))||a);return i&&a&&G(s,t,a),a};let c=class extends I{constructor(){super(...arguments),this.mode="off",this.roles="",this.disabled=!1,this.options=[],this.loaded=!1}willUpdate(){this.mode==="roles"&&!this.disabled&&!this.loaded&&(this.loaded=!0,Y().then(e=>this.options=e.roles.filter(s=>s.id!=="system_admin")).catch(()=>this.loaded=!1))}emit(e,s){this.dispatchEvent(new CustomEvent("sw-search-access-change",{detail:{mode:e,roles:s.join(",")},bubbles:!0,composed:!0}))}render(){const e=F(this.mode),s=H(this.roles);return r`
      <sw-field class="ctl"><select data-set-global-search ?disabled=${this.disabled} @change=${t=>this.emit(t.target.value,s)}>
        ${q.map(t=>r`<option value=${t} ?selected=${t===e}>${E(t)}</option>`)}
      </select></sw-field>
      ${e==="roles"?r`<div class="roles" data-search-roles role="group" aria-label=${E("rolesTitle")}>
            ${this.options.map(t=>r`<label class="role"><input type="checkbox" data-search-role=${t.id} .checked=${s.includes(t.id)} ?disabled=${this.disabled}
              @change=${i=>this.emit(e,K(s,t.id,i.target.checked))} />${t.name}</label>`)}
          </div>`:u}
    `}};c.styles=D`
    :host { display: grid; gap: var(--sw-s-2); }
    .roles { display: flex; flex-wrap: wrap; gap: var(--sw-s-2) var(--sw-s-4); }
    label.role { display: inline-flex; align-items: center; gap: var(--sw-s-2); font-size: var(--sw-fs-sm, 0.875rem); }
    .hint { color: var(--sw-text-3); font-size: var(--sw-fs-sm, 0.875rem); }
  `;m([y()],c.prototype,"mode",2);m([y()],c.prototype,"roles",2);m([y({type:Boolean})],c.prototype,"disabled",2);m([h()],c.prototype,"options",2);c=m([L("sw-search-access")],c);var Q=Object.defineProperty,W=Object.getOwnPropertyDescriptor,b=(e,s,t,i)=>{for(var a=i>1?void 0:i?W(s,t):s,o=e.length-1,n;o>=0;o--)(n=e[o])&&(a=(i?n(s,t,a):n(a))||a);return i&&a&&Q(s,t,a),a};let l=class extends I{constructor(){super(...arguments),this.bubbleSkin=new S(this),this.draft={...f()},this.display={...d()},this.canEdit=!1,this.busy=!1,this.message="",this.error=""}connectedCallback(){super.connectedCallback(),this.stop=T(()=>{this.dirty||(this.draft={...f()})}),this.stopDisplay=C(()=>{this.displayDirty||(this.display={...d()})}),v()&&z().then(e=>{this.canEdit=e.can_edit,x(e.settings["timeline.colors"]),$(e.settings),this.draft={...f()},this.display={...d()}}).catch(()=>{})}disconnectedCallback(){this.stop?.(),this.stopDisplay?.(),super.disconnectedCallback()}get colorsDirty(){const e=f();return w.some(s=>this.draft[s]!==e[s])}get displayDirty(){const e=d();return this.display.helper_line!==e.helper_line||this.display.diagnostics!==e.diagnostics}get dirty(){return this.colorsDirty||this.displayDirty}get atDefaults(){return w.every(e=>this.draft[e]===k[e])}pick(e,s){this.draft={...this.draft,[e]:s},this.message=""}setDisplay(e,s){this.display={...this.display,[e]:s},this.message=""}reset(){this.draft={...k},this.message=""}async save(){this.busy=!0,this.error="";try{const e={};this.colorsDirty&&(e["timeline.colors"]=this.draft),this.display.helper_line!==d().helper_line&&(e["playback.helper_line"]=this.display.helper_line),this.display.diagnostics!==d().diagnostics&&(e["playback.diagnostics"]=this.display.diagnostics);const s=await P(e);A(),x(s.settings["timeline.colors"]),$(s.settings),this.draft=j(s.settings["timeline.colors"]),this.display={...d()},this.message=p("הצבעים נשמרו"),setTimeout(()=>this.message="",2500)}catch(e){this.error=M(e)}finally{this.busy=!1}}render(){const e=this.canEdit&&v();return r`<sw-card heading=${p("צבעי ציר הזמן")} data-timeline-colors>
      ${w.map(s=>{const t=B(this.draft[s])??"#000000",i=N(this.draft,s).map(a=>g[a]);return r`<div class="row" data-timeline-option=${s}>
          <span class="name"><i class="dot" style="--c:${t}" data-timeline-dot></i><span class="lbl">${g[s]}</span></span>
          <span class="sw" role="group" aria-label=${g[s]}>
            ${Object.entries(R).map(([a,o])=>r`<button type="button" style="--c:${o.hex}" title=${o.label} aria-label=${o.label} aria-pressed=${this.draft[s]===a?"true":"false"} data-timeline-swatch=${a} ?disabled=${!e||this.busy} @click=${()=>this.pick(s,a)}></button>`)}
            <input type="color" .value=${t} aria-label=${`${g[s]}: ${p("צבע מותאם")}`} data-timeline-custom ?disabled=${!e||this.busy} @change=${a=>this.pick(s,a.target.value.toLowerCase())} />
          </span>
          ${i.length?r`<span class="warn" role="note" data-timeline-warning>${p("דומה ל{names}",{names:i.join(", ")})}</span>`:u}
        </div>`})}
      <h4>${p("תצוגה")}</h4>
      ${["helper_line","diagnostics"].map(s=>r`<div class="row" data-playback-display=${s}>
          <span class="name"><span class="lbl">${_[s]}</span></span>
          <span class="seg" role="radiogroup" aria-label=${_[s]}>
            ${U.map(t=>r`<button type="button" role="radio" aria-checked=${this.display[s]===t?"true":"false"} data-visibility=${t} ?disabled=${!e||this.busy} @click=${()=>this.setDisplay(s,t)}>${V[t]}</button>`)}
          </span>
        </div>`)}
      ${e?r`<div class="foot">
            <sw-button variant="primary" size="sm" icon="check" data-timeline-save ?disabled=${!this.dirty||this.busy} @click=${()=>void this.save()}>${p("שמור")}</sw-button>
            <sw-button variant="ghost" size="sm" data-timeline-reset ?disabled=${this.atDefaults||this.busy} @click=${()=>this.reset()}>${p("איפוס לברירת מחדל")}</sw-button>
            ${this.message?r`<span class="ok" role="status" data-timeline-message>${this.message}</span>`:u}
            ${this.error?r`<span class="err" role="alert">${this.error}</span>`:u}
          </div>`:u}
    </sw-card>`}};l.styles=[D`
    :host {
      display: block;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(96px, 150px) 1fr;
      align-items: center;
      gap: 6px 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .row:last-of-type {
      border-block-end: 0;
    }
    .name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: var(--sw-fw-medium);
    }
    .dot {
      inline-size: 14px;
      block-size: 14px;
      border-radius: 50%;
      background: var(--c);
      box-shadow: 0 0 0 1px var(--sw-border-strong);
      flex: none;
    }
    .sw {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .sw button {
      inline-size: 24px;
      block-size: 24px;
      border-radius: 50%;
      border: 2px solid transparent;
      background: var(--c);
      padding: 0;
      cursor: pointer;
      box-shadow: 0 0 0 1px var(--sw-border-strong);
    }
    .sw button[aria-pressed='true'] {
      border-color: var(--sw-surface);
      box-shadow: 0 0 0 2px var(--sw-text);
    }
    .sw button:disabled,
    .sw input:disabled {
      cursor: default;
      opacity: 0.6;
    }
    .sw button:focus-visible,
    .sw input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .sw input[type='color'] {
      inline-size: 28px;
      block-size: 28px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: none;
      cursor: pointer;
    }
    h4 {
      margin: 14px 0 2px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 2px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
    }
    .seg button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 5px 10px;
      border-radius: var(--sw-r-xs);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .seg button[aria-checked='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    .seg button:disabled {
      cursor: default;
      opacity: 0.6;
    }
    .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .warn {
      grid-column: 1 / -1;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-block-start: 12px;
    }
    .ok {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 480px) {
      .row {
        grid-template-columns: 1fr;
      }
    }
  `,O];b([h()],l.prototype,"draft",2);b([h()],l.prototype,"display",2);b([h()],l.prototype,"canEdit",2);b([h()],l.prototype,"busy",2);b([h()],l.prototype,"message",2);b([h()],l.prototype,"error",2);l=b([L("system-timeline-colors")],l);
