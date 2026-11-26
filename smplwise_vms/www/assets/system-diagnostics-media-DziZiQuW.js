import{j as D,z as w,k as h,a as I,A as b,b as r,m as L,aX as O,k4 as y,k5 as p,k6 as T,eN as C,af as v,dO as S,k7 as $,k8 as x,k9 as g,ka as k,kb as z,dl as P,kc as A,dL as d,q as j,kd as B,ke as M,kf as f,kg as N,kh as _,ki as R,kj as U}from"./index-D3xHkfje.js";import{listRoles as V}from"./access-CVGF2oq1.js";import{s as Y,p as H,S as q,a as E,t as F}from"./system-diagnostics-CDp1veMc.js";import{b as K}from"./bubble-chrome-DW_f3pbN.js";import"./sw-logo-art-PLtEZJxU.js";import"./static-B845d-94.js";import"./settings-CBX0_39g.js";import"./long-lists-Oi_dEjsQ.js";import"./skins-BvRmGhxy.js";import"./plan-view-Dm4VXqyt.js";import"./system-a-CDuaOwuI.js";import"./toast-controller-BPX0Tkjm.js";import"./live-Btf27nYW.js";import"./ha-sync-status-BfP-r3qC.js";import"./quality-mode-CAoNRPkM.js";import"./map-D3bqut0m.js";import"./quality-ladder-BIYtMgBU.js";import"./plan-quality-Dmj2fdFZ.js";import"./wall-phone-bar-C39Ne3tt.js";import"./media-CSqgsuwf.js";import"./safe-storage-BOOiiGOc.js";var X=Object.defineProperty,G=Object.getOwnPropertyDescriptor,u=(e,s,t,a)=>{for(var i=a>1?void 0:a?G(s,t):s,l=e.length-1,n;l>=0;l--)(n=e[l])&&(i=(a?n(s,t,i):n(i))||i);return a&&i&&X(s,t,i),i};let c=class extends I{constructor(){super(...arguments),this.mode="off",this.roles="",this.disabled=!1,this.options=[],this.loaded=!1}willUpdate(){this.mode==="roles"&&!this.disabled&&!this.loaded&&(this.loaded=!0,V().then(e=>this.options=e.roles.filter(s=>s.id!=="system_admin")).catch(()=>this.loaded=!1))}emit(e,s){this.dispatchEvent(new CustomEvent("sw-search-access-change",{detail:{mode:e,roles:s.join(",")},bubbles:!0,composed:!0}))}render(){const e=Y(this.mode),s=H(this.roles);return r`
      <sw-field class="ctl"><select data-set-global-search ?disabled=${this.disabled} @change=${t=>this.emit(t.target.value,s)}>
        ${q.map(t=>r`<option value=${t} ?selected=${t===e}>${E(t)}</option>`)}
      </select></sw-field>
      ${e==="roles"?r`<div class="roles" data-search-roles role="group" aria-label=${E("rolesTitle")}>
            ${this.options.map(t=>r`<label class="role"><input type="checkbox" data-search-role=${t.id} .checked=${s.includes(t.id)} ?disabled=${this.disabled}
              @change=${a=>this.emit(e,F(s,t.id,a.target.checked))} />${t.name}</label>`)}
          </div>`:b}
    `}};c.styles=D`
    :host { display: grid; gap: var(--sw-s-2); }
    .roles { display: flex; flex-wrap: wrap; gap: var(--sw-s-2) var(--sw-s-4); }
    label.role { display: inline-flex; align-items: center; gap: var(--sw-s-2); font-size: var(--sw-fs-sm, 0.875rem); }
    .hint { color: var(--sw-text-3); font-size: var(--sw-fs-sm, 0.875rem); }
  `;u([w()],c.prototype,"mode",2);u([w()],c.prototype,"roles",2);u([w({type:Boolean})],c.prototype,"disabled",2);u([h()],c.prototype,"options",2);c=u([L("sw-search-access")],c);var J=Object.defineProperty,Q=Object.getOwnPropertyDescriptor,m=(e,s,t,a)=>{for(var i=a>1?void 0:a?Q(s,t):s,l=e.length-1,n;l>=0;l--)(n=e[l])&&(i=(a?n(s,t,i):n(i))||i);return a&&i&&J(s,t,i),i};let o=class extends I{constructor(){super(...arguments),this.bubbleSkin=new O(this),this.draft={...y()},this.display={...p()},this.canEdit=!1,this.busy=!1,this.message="",this.error=""}connectedCallback(){super.connectedCallback(),this.stop=T(()=>{this.dirty||(this.draft={...y()})}),this.stopDisplay=C(()=>{this.displayDirty||(this.display={...p()})}),v()&&S().then(e=>{this.canEdit=e.can_edit,$(e.settings["timeline.colors"]),x(e.settings),this.draft={...y()},this.display={...p()}}).catch(()=>{})}disconnectedCallback(){this.stop?.(),this.stopDisplay?.(),super.disconnectedCallback()}get colorsDirty(){const e=y();return g.some(s=>this.draft[s]!==e[s])}get displayDirty(){const e=p();return this.display.helper_line!==e.helper_line||this.display.diagnostics!==e.diagnostics}get dirty(){return this.colorsDirty||this.displayDirty}get atDefaults(){return g.every(e=>this.draft[e]===k[e])}pick(e,s){this.draft={...this.draft,[e]:s},this.message=""}setDisplay(e,s){this.display={...this.display,[e]:s},this.message=""}reset(){this.draft={...k},this.message=""}async save(){this.busy=!0,this.error="";try{const e={};this.colorsDirty&&(e["timeline.colors"]=this.draft),this.display.helper_line!==p().helper_line&&(e["playback.helper_line"]=this.display.helper_line),this.display.diagnostics!==p().diagnostics&&(e["playback.diagnostics"]=this.display.diagnostics);const s=await z(e);P(),$(s.settings["timeline.colors"]),x(s.settings),this.draft=A(s.settings["timeline.colors"]),this.display={...p()},this.message=d("הצבעים נשמרו"),setTimeout(()=>this.message="",2500)}catch(e){this.error=j(e)}finally{this.busy=!1}}render(){const e=this.canEdit&&v();return r`<sw-card heading=${d("צבעי ציר הזמן")} data-timeline-colors>
      ${g.map(s=>{const t=B(this.draft[s])??"#000000",a=M(this.draft,s).map(i=>f[i]);return r`<div class="row" data-timeline-option=${s}>
          <span class="name"><i class="dot" style="--c:${t}" data-timeline-dot></i><span class="lbl">${f[s]}</span></span>
          <span class="sw" role="group" aria-label=${f[s]}>
            ${Object.entries(N).map(([i,l])=>r`<button type="button" style="--c:${l.hex}" title=${l.label} aria-label=${l.label} aria-pressed=${this.draft[s]===i?"true":"false"} data-timeline-swatch=${i} ?disabled=${!e||this.busy} @click=${()=>this.pick(s,i)}></button>`)}
            <input type="color" .value=${t} aria-label=${`${f[s]}: ${d("צבע מותאם")}`} data-timeline-custom ?disabled=${!e||this.busy} @change=${i=>this.pick(s,i.target.value.toLowerCase())} />
          </span>
          ${a.length?r`<span class="warn" role="note" data-timeline-warning>${d("דומה ל{names}",{names:a.join(", ")})}</span>`:b}
        </div>`})}
      <h4>${d("תצוגה")}</h4>
      ${["helper_line","diagnostics"].map(s=>r`<div class="row" data-playback-display=${s}>
          <span class="name"><span class="lbl">${_[s]}</span></span>
          <sw-segmented radio size="sm" label=${_[s]} value=${this.display[s]} ?disabled=${!e||this.busy}
            @change=${t=>this.setDisplay(s,t.detail.value)}
            .options=${R.map(t=>({value:t,label:U[t],attrs:{"data-visibility":t}}))}></sw-segmented>
        </div>`)}
      ${e?r`<div class="foot">
            <sw-button variant="primary" size="sm" icon="check" data-timeline-save ?disabled=${!this.dirty||this.busy} @click=${()=>void this.save()}>${d("שמור")}</sw-button>
            <sw-button variant="ghost" size="sm" data-timeline-reset ?disabled=${this.atDefaults||this.busy} @click=${()=>this.reset()}>${d("איפוס לברירת מחדל")}</sw-button>
            ${this.message?r`<span class="ok" role="status" data-timeline-message>${this.message}</span>`:b}
            ${this.error?r`<span class="err" role="alert">${this.error}</span>`:b}
          </div>`:b}
    </sw-card>`}};o.styles=[D`
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
  `,K];m([h()],o.prototype,"draft",2);m([h()],o.prototype,"display",2);m([h()],o.prototype,"canEdit",2);m([h()],o.prototype,"busy",2);m([h()],o.prototype,"message",2);m([h()],o.prototype,"error",2);o=m([L("system-timeline-colors")],o);
