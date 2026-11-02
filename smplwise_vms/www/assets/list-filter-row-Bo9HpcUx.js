import{b as ie,s as X,S as oe,a as le,w as ce,o as de,m as pe}from"./ticket-detail-DowZOZPF.js";import{E as C,gK as ue,w as fe,F as b,G as Y,a as Z,b$ as he,A as p,e as l,H as J,mL as be,mz as Q,p as m,C as ve,D as we,mM as ge,S as me,b as xe,t as f,mN as ye,q as y,i as ke,bb as $e,g as P,bY as ze,b8 as _e,b7 as T,j as I,mO as g,bZ as Ce,mu as Se,mP as B}from"./index-BJCfUqyq.js";import{l as o}from"./list-text-BfFdiLtZ.js";import{a as Oe,w as Me}from"./board-model-DtIt6czW.js";const Le=C`
  .tcard.stuck {
    border-color: color-mix(in srgb, var(--dv-danger) 45%, transparent);
  }
  .tcard.closed {
    opacity: 0.86;
  }
  .chip .subst {
    font-weight: 600;
    opacity: 0.85;
  }
  /* the sentence IS the status: the largest line of the card after the title, two lines at most (the full text is the title attribute) */
  p.stat {
    margin: 0;
    font-size: var(--sw-fs-md);
    line-height: 1.5;
    color: var(--dv-text);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  /* the board card's one ranked warning line, instead of its chips row */
  .cwarn {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 7px;
    min-inline-size: 0;
    font-size: var(--sw-fs-base);
    font-weight: 600;
    color: var(--au-warn-text);
  }
  .cwarn.bad {
    color: var(--dv-danger);
  }
  .cwarn .ic {
    flex: none;
    font-size: var(--sw-fs-lg);
  }
  .cwarn span {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .pair {
    display: inline-flex;
    flex: none;
    margin-inline-start: auto;
  }
  .av {
    display: inline-grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 2px solid var(--dv-surface-solid);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    letter-spacing: 0;
    color: var(--dv-accent-text);
    background: var(--dv-accent-soft);
  }
  .av + .av {
    margin-inline-start: -8px;
  }
  .av.ext {
    color: var(--au-warn-text);
    background: var(--dv-warning-soft);
  }
  footer span.run {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  footer span.run > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 767px) {
    p.stat {
      font-size: var(--sw-fs-base);
    }
  }
  /* UXFIX-A11Y-295: the skeleton card - shimmer bars sit IN the text lines, so every line keeps the height of the text it stands for */
  .tcard.sk .skl.ln {
    display: inline-block;
    vertical-align: middle;
    block-size: 0.8em;
    max-inline-size: 100%;
    border-radius: var(--sw-r-xs);
  }
  .tcard.sk .chip,
  .tcard.sk .av {
    background: var(--dv-surface-3);
  }
  .tcard.sk .chip .skl.ln {
    background: none;
    animation: none;
  }
  :host([data-skin='bubble']) .av {
    border-radius: 50%;
  }
`,it=C`
  .frow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    padding: 10px 14px;
    box-sizing: border-box;
    border-radius: var(--sw-r-2xl);
  }
  .frow .lbl {
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .frow .sep {
    inline-size: 1px;
    block-size: 22px;
    background: var(--dv-border);
  }
  .frow .rc {
    min-block-size: 32px;
    padding-block: 4px;
  }
  .frow .rc .ic {
    font-size: var(--sw-fs-base);
  }
  .frow .grow {
    flex: 1;
  }
  .frow select {
    min-block-size: 32px;
    max-inline-size: 200px;
    padding-inline: 12px;
    border-radius: var(--dv-radius-control);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
  }
  .fnote {
    padding-inline: 4px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .vsw button .lbl {
    font-weight: 600;
  }
  .vsw button[aria-checked='true'] .ic,
  .vsw button[aria-checked='true'] svg {
    color: var(--dv-accent-text);
  }
  .seg.scope button small,
  .seg.stf button small {
    margin-inline-start: 6px;
  }
  /* a count on a department chip is a small badge, never read as part of the name */
  .rooms .rc small {
    display: inline-grid;
    place-items: center;
    min-inline-size: 18px;
    block-size: 18px;
    padding-inline: 5px;
    box-sizing: border-box;
    margin-inline-start: 8px;
    border-radius: var(--sw-r-pill);
    background: color-mix(in srgb, var(--dv-text) 8%, transparent);
    color: var(--dv-text-2);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .rooms .rc[aria-pressed='true'] small {
    background: color-mix(in srgb, currentColor 18%, transparent);
    color: inherit;
  }
  @media (max-width: 767px) {
    .frow {
      padding: 10px 12px;
    }
    .frow .rc,
    .frow select {
      min-block-size: 44px;
    }
    .frow .sep {
      display: none;
    }
    .vsw button .lbl {
      display: none;
    }
    .dh-det .seg.scope {
      order: 0;
      inline-size: 100%;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border-radius: var(--sw-r-xl);
    }
    .dh-det .seg.scope button {
      padding-inline: 6px;
      min-block-size: 44px;
    }
    .dh-det .filterbtn {
      order: 2;
      min-block-size: 44px;
    }
  }
`,ot=C`
  .today {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 10px 16px;
    box-sizing: border-box;
    border-radius: var(--sw-r-2xl);
  }
  .today > b {
    flex: none;
    font-size: var(--sw-fs-base);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .today .up {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-block-size: 32px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-base);
    text-align: start;
  }
  /* POLISH-CONTROL-297: the "today" entry answers the press (transform only, token durations - zero under reduced motion); hover is for
     fine pointers only */
  .today button.up {
    cursor: pointer;
    border-radius: var(--sw-r-md);
    transition: transform var(--sw-t-fast) var(--sw-ease);
  }
  .today button.up:active {
    transform: scale(0.98);
  }
  @media (hover: hover) and (pointer: fine) {
    .today button.up:hover {
      text-decoration: underline;
    }
  }
  .today button.up:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  .today .up time {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .today .up .what {
    color: var(--dv-text-2);
  }
  .today .up i {
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    flex: none;
    background: var(--dv-accent);
  }
  .today .up.warn i {
    background: var(--dv-warning);
  }
  .today .up.ok i {
    background: var(--dv-success);
  }
  .hgroup {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    padding-inline: 4px;
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
  }
  .hgroup b {
    font-size: var(--sw-fs-md);
    color: var(--dv-text);
  }
  .hgroup .av {
    inline-size: 26px;
    block-size: 26px;
  }
  .load {
    display: inline-flex;
    gap: 3px;
    align-items: center;
  }
  .load i {
    inline-size: 14px;
    block-size: 6px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-3);
  }
  .load i.on {
    background: var(--dv-accent);
  }
  .load i.hot {
    background: var(--dv-danger);
  }
  .closedrows {
    display: flex;
    flex-direction: column;
    padding: 4px 6px;
    box-sizing: border-box;
    border-radius: var(--sw-r-2xl);
  }
  .closedrows .cr {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 6px 14px;
    min-block-size: 44px;
    padding: 6px 12px;
    border: 0;
    background: transparent;
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-base);
    text-align: start;
    text-decoration: none;
    border-radius: var(--sw-r-lg);
    cursor: pointer;
  }
  .closedrows .cr + .cr {
    border-block-start: 1px solid var(--dv-border);
  }
  .closedrows .cr {
    transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
  }
  .closedrows .cr:active {
    transform: scale(0.99);
  }
  .closedrows .cr:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: -2px;
  }
  @media (hover: hover) and (pointer: fine) {
    .closedrows .cr:hover {
      background: var(--dv-surface-3);
    }
  }
  .closedrows .cr .num {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    unicode-bidi: isolate;
    color: var(--dv-text-3);
    font-weight: 600;
  }
  .closedrows .cr b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .closedrows .cr span:not(.num) {
    color: var(--dv-text-2);
    white-space: nowrap;
  }
  @media (max-width: 767px) {
    .today {
      padding: 10px 12px;
    }
    .today .up {
      min-block-size: 44px;
    }
    .closedrows .cr {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }
    .closedrows .cr .hide-p {
      display: none;
    }
  }
`,Ee={coin:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2M12 6.5V8m0 8v1.5"/>',hand:'<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-.5V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.6-2.2L4 14.5a1.6 1.6 0 0 1 2.4-2L8 14"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',sliders:'<path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1"/><circle cx="16" cy="6" r="1.8"/><circle cx="10" cy="12" r="1.8"/><circle cx="18" cy="18" r="1.8"/>',cardsView:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',tableView:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M10 5v14"/>',boardView:'<rect x="3.5" y="4" width="4.5" height="14" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="9" rx="1.5"/><rect x="16" y="4" width="4.5" height="11" rx="1.5"/>'};function $(e,t=""){return fe`<svg class=${t?`ic ${t}`:"ic"} viewBox="0 0 24 24" aria-hidden="true">${ue(Ee[e])}</svg>`}const O=6e4,k=60*O,V=24*k,H=["closed","cancelled"];function ee(e,t=new Date){const n=Date.parse(e.created_at);if(Number.isNaN(n))return null;let s=t.getTime();if(H.includes(e.status)){const a=Date.parse(e.closed_at??e.last_activity_at??"");s=Number.isNaN(a)?t.getTime():a}return Math.max(0,s-n)}function te(e){const t=Math.max(0,e);if(t<O)return o("elLessMinute");if(t<k)return o("elMin",{m:Math.floor(t/O)});if(t<V){const i=Math.floor(t/k),r=Math.floor(t%k/O);return r?o("elHourMin",{h:i,m:r}):o("elHour",{h:i})}const n=Math.floor(t/V),s=Math.floor(t%V/k),a=o(n===1?"elDayOne":"elDays",{d:n});return s?`${a} ${o("elHour",{h:s})}`:a}function Pe(e,t=new Date){const n=ee(e,t);if(n===null)return null;const s=te(n),a=H.includes(e.status),i=a?o(e.status==="cancelled"?"elCancelled":"elHandled",{dur:s}):o("elOpen",{dur:s}),r=a?null:ie({status:e.status,sla:e.sla},t).badge;return{text:i,dur:s,frozen:a,tone:r?.tone??""}}function lt(e,t=new Date){let n=-1;for(const s of e){if(H.includes(s.status))continue;const a=ee(s,t);a!==null&&a>n&&(n=a)}return n<0?"":o("elOldest",{dur:te(n)})}var Ve=Object.defineProperty,De=Object.getOwnPropertyDescriptor,A=(e,t,n,s)=>{for(var a=s>1?void 0:s?De(t,n):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(s?r(t,n,a):r(a))||a);return s&&a&&Ve(t,n,a),a};let z=class extends Z{constructor(){super(...arguments),this.now=new Date,this.off=null}connectedCallback(){super.connectedCallback(),this.now=new Date;const e=he(t=>this.now=t);this.off=()=>{e()}}disconnectedCallback(){super.disconnectedCallback(),this.off?.(),this.off=null}render(){const e=this.item?Pe(this.item,this.now):null;return e?l`<span class=${e.tone} data-elapsed=${e.frozen?"frozen":"open"} title=${o("elTitle")}>${e.text}</span>`:p}};z.styles=C`
    :host {
      display: inline-flex;
      align-items: center;
      min-inline-size: 0;
    }
    /* a narrow host (the calendar's week columns) sets --sw-elapsed-wrap: normal and its own --sw-elapsed-fs */
    span {
      font-size: var(--sw-elapsed-fs, var(--sw-fs-base));
      font-variant-numeric: tabular-nums;
      color: var(--dv-text-2);
      white-space: var(--sw-elapsed-wrap, nowrap);
      overflow-wrap: anywhere;
      min-inline-size: 0;
    }
    span.warn {
      color: var(--au-warn-text);
      font-weight: 600;
    }
    span.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
  `;A([b({attribute:!1})],z.prototype,"item",2);A([Y()],z.prototype,"now",2);z=A([J("ticket-elapsed")],z);const Fe=3,Re=["closed","cancelled"],_=e=>!Re.includes(e.status);function ct(e,t){if(e.view==="limited")return"requester";if(e.manager||e.can?.manage)return"manager";const n=e.department?t?.departments.find(s=>s.id===e.department?.id):void 0;return n?.my_role==="manager"||t?.can.all_departments&&t.can.manage?"manager":n?.my_role==="member"?"handler":t?.can.manage?"manager":"requester"}function Ie(e,t){const n=[];e.priority&&n.push({key:"priority",text:e.priority.name,tone:Q(e.priority)}),e.department&&n.push({key:"department",text:e.department.name,tone:""});const s=t==="manager"||t==="approver";return s&&e.cost?.status==="submitted"&&e.cost.can_decide!==!1&&_(e)?n.push({key:"cost",text:o("lcCostMine"),tone:"warn",icon:"coin"}):s&&e.stuck&&_(e)?n.push({key:"stuck",text:o("lcStuck"),tone:"bad",icon:"warning"}):e.reopen_count>0&&n.push({key:"reopened",text:m("reopenedChip"),tone:"warn",icon:"refresh"}),n.slice(0,Fe)}function j(e){const t=e.replace(/["'׳״.,()\-]/g," ").split(/\s+/).filter(Boolean),n=s=>[...s].filter(a=>/\p{L}/u.test(a));if(t.length>=2){const s=n(t[0])[0]??"",a=n(t[1])[0]??"";return`${s}${a}`.toUpperCase()}return n(t[0]??"").slice(0,2).join("").toUpperCase()}function Ne(e){const t=[];if(e.assignee?.name){const n=e.assignee.kind==="contact";t.push({ini:j(e.assignee.name),name:e.assignee.name,kind:n?"ext":"int",label:o(n?"lcWhoVendor":"lcWhoStaff",{name:e.assignee.name})})}return e.owner?.name&&t.push({ini:j(e.owner.name),name:e.owner.name,kind:"int",label:o("lcWhoOwner",{name:e.owner.name})}),t.filter(n=>n.ini).slice(0,2)}function He(e,t){if(!_(e))return null;const n=ce(e,t);if(n){const s=n.key==="stuck"&&(e.stuck?.level??0)>=2;return{key:n.key,text:n.text,tone:s?"bad":n.tone,icon:"warning"}}if(e.group==="waiting"){const s=Me(e.waiting_reason);if(s)return{key:"wait",text:s,tone:"warn",icon:"user"}}return null}function Ae(e,t){const n=t.now??new Date;let s=X(e,t.role,n);if(t.board&&e.status==="done"&&e.auto_close_at){const r=Oe(e.auto_close_at);r&&s.length+3+r.length<=oe&&(s=`${s} · ${r}`)}const a=t.board?He(e,t.role):null,i=be(e,n,{omitUnassigned:!e.assignee&&(e.status==="new"||/שיוך|assign/i.test(s))});return{sentence:s,chip:le(e),chips:a?[]:Ie(e,t.role),warning:a,avatars:Ne(e),run:{text:i.text,tone:i.tone},urgent:Q(e.priority)==="bad"&&_(e),stuck:!!e.stuck&&_(e)}}function dt(e,t,n,s){const{sla:a,cost:i,...r}=e;return X({...r,cost:e.cost_status&&e.cost_status!=="not_required"?{status:e.cost_status,can_decide:s}:null},t,n)}var qe=Object.defineProperty,Te=Object.getOwnPropertyDescriptor,h=(e,t,n,s)=>{for(var a=s>1?void 0:s?Te(t,n):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(s?r(t,n,a):r(a))||a);return s&&a&&qe(t,n,a),a};let u=class extends Z{constructor(){super(...arguments),this.bubbleSkin=new me(this),this.href="",this.timelineHref="",this.fullScreen=!0,this.now=new Date,this.role="manager",this.board=!1,this.picked=!1,this.skeleton=!1,this.menu=!1,this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&this.setMenu(!1)},this.onKey=e=>{this.menu&&e.key==="Escape"&&this.setMenu(!1)},this.placeMenu=()=>{if(!this.menu)return;const e=this.renderRoot.querySelector(".pop.ov"),t=this.renderRoot.querySelector("[data-card-menu]");e&&t&&de(e,t)},this.onMenuKey=e=>{e.key==="Escape"?(e.stopPropagation(),this.setMenu(!1),this.renderRoot.querySelector("[data-card-menu]")?.focus()):pe(e,e.currentTarget)}}connectedCallback(){super.connectedCallback(),xe(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey),window.addEventListener("resize",this.placeMenu),window.addEventListener("scroll",this.placeMenu,!0)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey),window.removeEventListener("resize",this.placeMenu),window.removeEventListener("scroll",this.placeMenu,!0)}setMenu(e){this.menu=e,this.toggleAttribute("data-menu",e),e&&this.updateComplete.then(()=>this.renderRoot.querySelector(".pop button")?.focus())}updated(){this.placeMenu()}act(e){this.setMenu(!1),this.dispatchEvent(new CustomEvent("card-action",{detail:{item:this.item,action:e},bubbles:!0,composed:!0}))}menuItems(){const e=(t,n,s)=>l`<button type="button" role="menuitem" data-card-action=${t} @click=${()=>this.act(t)}>${f(n)}${s}</button>`;return l`<div class="pop ov" popover="manual" role="menu" aria-label=${m("actions")} @keydown=${this.onMenuKey}>
      ${e("open","eye",m("open"))}
      ${this.fullScreen?e("full","expand",m("fullScreen")):p}
      ${e("copy","link",m("copyLink"))}
    </div>`}renderSkeleton(){const e=t=>l`<span class="skl ln" style=${`inline-size:${t}`}></span>`;return l`<article class="tcard sk" aria-hidden="true" data-card-skeleton>
      <header>
        <div class="ttl">
          <h3>${e("68%")}</h3>
          <div class="where">${f("layers")}${e("42%")}</div>
        </div>
        <div class="ctl"><span class="chip">${e("52px")}</span><span class="more"></span></div>
      </header>
      <p class="stat">${e("92%")}<br />${e("58%")}</p>
      ${this.board?l`<div class="cwarn">${e("64%")}</div>`:l`<div class="chips"><span class="chip">${e("44px")}</span><span class="chip">${e("58px")}</span></div>`}
      <footer>
        <span class="num">${e("32px")}</span>
        <span class="run">${e("72px")}</span>
        <a class="tl" tabindex="-1">${e("56px")}</a>
        <span class="pair"><span class="av"></span><span class="av"></span></span>
      </footer>
    </article>`}render(){if(this.skeleton)return this.renderSkeleton();const e=this.item;if(!e)return p;const t=ye(e),n=Ae(e,{role:this.role,now:this.now,board:this.board}),s=n.chip.tone,a=["closed","cancelled"].includes(e.status);return l`<article class=${`tcard${n.urgent?" urgent":""}${n.stuck?" stuck":""}${a?" closed":""}`} data-ticket=${e.id} data-status=${e.status} aria-label=${e.title}>
      <header>
        <div class="ttl">
          <h3 dir="auto" data-card-title><a class="name" href=${this.href||"#"} title=${e.title} data-card-open>${y(e.title)}</a></h3>
          ${t.strong||t.rest?l`<div class="where">${f("layers")}${t.strong?l`<b>${y(t.strong)}</b>`:p}${t.rest?l`<span>${y(t.rest)}</span>`:p}</div>`:p}
        </div>
        <div class="ctl">
          <span class=${`chip ${s}`} data-card-status aria-label=${n.chip.text}><i class=${`dot ${s==="ok"?"ok":s==="info"?"run":""}`}></i>${n.chip.label}${n.chip.sub?l`<span class="subst"> · ${n.chip.sub}</span>`:p}</span>
          <button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${m("moreOf",{title:e.title})} data-card-menu @click=${()=>this.setMenu(!this.menu)}>${f("dots")}</button>
        </div>
        ${this.menu?this.menuItems():p}
      </header>
      <p class="stat" data-card-sentence title=${n.sentence}>${n.sentence}</p>
      ${n.warning?l`<div class=${`cwarn ${n.warning.tone}`} data-card-warning=${n.warning.key} role="note">${n.warning.icon==="user"?$("hand"):f("warning")}<span>${n.warning.text}</span></div>`:l`<div class="chips" data-card-chips>
            ${n.chips.map(i=>l`<span class=${`chip ${i.tone}`} data-chip=${i.key}>${i.key==="priority"?l`<i class=${`dot ${i.tone==="bad"?"bad":i.tone==="info"?"run":""}`}></i>`:i.icon==="coin"?$("coin"):i.icon==="warning"?f("warning"):i.icon==="refresh"?f("refresh"):p}${i.key==="department"?y(i.text):i.text}</span>`)}
          </div>`}
      <footer>
        <span class="num">#${e.number}</span>
        <span class="run" data-card-run><i class=${`dot ${n.run.tone}`}></i><span>${n.run.text}</span></span>
        <ticket-elapsed .item=${e} data-card-elapsed></ticket-elapsed>
        ${this.timelineHref?l`<a class="tl" href=${this.timelineHref} data-card-timeline>${f("clock")}${m("timelineLink")}</a>`:p}
        ${n.avatars.length?l`<span class="pair" data-card-pair>${n.avatars.map(i=>l`<span class=${`av ${i.kind}`} title=${i.label} role="img" aria-label=${i.label}>${i.ini}</span>`)}</span>`:p}
      </footer>
    </article>`}};u.styles=[ve,...we,ge,Le];h([b({attribute:!1})],u.prototype,"item",2);h([b()],u.prototype,"href",2);h([b()],u.prototype,"timelineHref",2);h([b({type:Boolean})],u.prototype,"fullScreen",2);h([b({attribute:!1})],u.prototype,"now",2);h([b()],u.prototype,"role",2);h([b({type:Boolean})],u.prototype,"board",2);h([b({type:Boolean,reflect:!0,attribute:"data-picked"})],u.prototype,"picked",2);h([b({type:Boolean,reflect:!0})],u.prototype,"skeleton",2);h([Y()],u.prototype,"menu",2);u=h([J("ticket-card")],u);const w="tickets",K=encodeURIComponent,D=e=>{const t=new URLSearchParams;for(const[s,a]of Object.entries(e))a!==""&&t.set(s,a);const n=t.toString();return n?`?${n}`:""};async function U(e){const t=await fetch(Ce(e),{credentials:"same-origin"});if(!t.ok){let n={};try{n=await t.json()}catch{n={}}throw new I(t.status,{code:n.code??`http_${t.status}`,user_message:n.user_message??"",retryable:n.retryable??!1,correlation_id:n.correlation_id??"",details:n.details??{}})}return{blob:await t.blob(),headers:t.headers}}const Be={page:e=>P(`${w}/table${D(e)}`),bulk:e=>T(`${w}/bulk`,e),exportCsv:async e=>{const{blob:t,headers:n}=await U(`${w}/export.csv${D(e)}`),s=n.get("X-Export-Rows"),a=/filename="?([^";]+)"?/.exec(n.get("Content-Disposition")??"")?.[1];return{blob:t,rows:s===null?null:Number(s),filename:a||"export.csv"}},monthlyReport:async e=>{const{blob:t,headers:n}=await U(`${w}/reports/monthly.csv${D(e)}`),s=n.get("X-Export-Rows"),a=/filename="?([^";]+)"?/.exec(n.get("Content-Disposition")??"")?.[1];return{blob:t,rows:s===null?null:Number(s),filename:a||"monthly.csv"}},views:()=>P(`${w}/views`),createView:(e,t)=>T(`${w}/views`,{name:e,view:t}),patchView:(e,t)=>_e(`${w}/views/${K(e)}`,t),deleteView:e=>ze(`${w}/views/${K(e)}`,{method:"DELETE"}),prefs:async()=>(await P("me/prefs")).prefs["tickets.board"]??{},savePrefs:async e=>(await $e("me/prefs",{"tickets.board":e})).prefs["tickets.board"]??{}},je=["new","assigned","acknowledged","in_progress","waiting_part","done","returned","closed","cancelled"],Ke={open:["new","assigned","acknowledged","in_progress","waiting_part","done","returned"],unassigned:["new","returned"],handling:["assigned","acknowledged","in_progress","waiting_part"],done:["done"],closed:["closed","cancelled"]},x=[];let F={},Ue=0;function G(e,t){switch(t){case"number":return e.number;case"title":return e.title;case"department":return e.department?.name??"";case"priority":return e.priority?.rank??99;case"status":return je.indexOf(e.status);case"assignee":return e.assignee?.name??"";case"place":return e.place_text;case"device":return e.device_name;case"created":return e.created_at;case"activity":return e.last_activity_at;case"stuck":return e.stuck?1+e.stuck.level:0;case"sla":return e.sla?.due_at??"9999";case"cost":return e.cost?.total_minor??-1;case"cost_status":return e.cost_status??""}}const Ge={async page(e){const t=await g.list({scope:e.scope||"visible",status:"all",limit:200}),n=!e.status||e.status==="all"?null:Ke[e.status]??e.status.split(","),s=e.department?e.department.split(","):[],a=e.priority?e.priority.split(","):[],i=(e.q??"").trim(),r=[];for(const c of t.items){if(n&&!n.includes(c.status)||s.length&&!s.includes(c.department?.id??"")||a.length&&!a.includes(c.priority?.key??"")||e.assignee==="none"&&c.assignee||e.assignee==="me"&&c.assignee?.id!=="demo"||e.assignee?.includes(":")&&e.assignee!==`${c.assignee?.kind}:${c.assignee?.id}`||e.waiting==="manager"&&c.waiting_on!=="manager"||i&&!c.title.includes(i)&&String(c.number)!==i.replace(/^#/,""))continue;const d=await g.get(c.id),{excerpt:L,...E}=c;if(e.cost_status&&!e.cost_status.split(",").includes(d.cost?.status??""))continue;const S=d.cost?.total_minor!=null&&d.cost.currency?{total_minor:d.cost.total_minor,currency:d.cost.currency,approved:d.cost.status==="approved"||d.cost.status==="paid"}:null;r.push({...E,stuck:null,sla:null,transitions:d.transitions,can:{manage:d.can.manage,assign:d.can.assign,assign_external:!1},cost:S,cost_status:d.cost?.status??null})}const v=(e.sort||"activity:desc").split(",").map(c=>c.split(":"));return r.sort((c,d)=>{for(const[L,E]of v){const S=G(c,L),q=G(d,L);if(S!==q)return(S<q?-1:1)*(E==="desc"?-1:1)}return c.id<d.id?-1:1}),{items:r,next_cursor:null,sort:e.sort||"activity:desc",limit:Number(e.limit||50)}},async bulk(e){const t=[];for(const s of e.items){let a="ok",i;try{const r=await g.get(s.id);if(i=r.number,r.revision!==s.revision)a="stale";else if(e.action==="close")await g.status(s.id,{to:"closed",note:e.params.note,revision:s.revision});else if(e.action==="assign"&&e.params.assignee)await g.assign(s.id,{assignee:e.params.assignee,revision:s.revision});else if(e.action==="priority"){const c=(await g.meta()).departments.find(d=>d.id===r.department?.id)?.priorities.find(d=>d.key===e.params.priority_key);!c||c.id===r.priority?.id?a="unchanged":await g.patch(s.id,{priority_id:c.id,revision:s.revision})}else e.action==="remind"&&!r.assignee&&(a="invalid_transition")}catch(r){a=r instanceof I&&r.status===409?"invalid_transition":"not_found"}t.push({id:s.id,number:i,result:a})}const n={};for(const s of t)n[s.result]=(n[s.result]??0)+1;return{action:e.action,total:e.items.length,done:n.ok??0,counts:n,results:t}},async exportCsv(){return{blob:new Blob(["\uFEFF"],{type:"text/csv"}),rows:0,filename:"export.csv"}},async monthlyReport(){return{blob:new Blob(["\uFEFF"],{type:"text/csv"}),rows:0,filename:"monthly.csv"}},async views(){return{items:x.map(e=>({...e})),max:20}},async createView(e,t){const n=new Date().toISOString(),s={id:`v${++Ue}`,name:e,view:t,created_at:n,updated_at:n};return x.push(s),{...s}},async patchView(e,t){const n=x.find(s=>s.id===e);if(!n)throw new I(404,{code:"view_not_found",user_message:"",retryable:!1,correlation_id:"",details:{}});return Object.assign(n,t.name?{name:t.name}:{},t.view?{view:t.view}:{}),{...n}},async deleteView(e){const t=x.findIndex(n=>n.id===e);t>=0&&x.splice(t,1)},async prefs(){return{...F}},async savePrefs(e){return F={...e},{...F}}};function ne(){return ke()?Be:Ge}let M=null;function We(){return M??=ne().prefs().catch(()=>({})),M}async function pt(e){const n={...await We(),...e};for(const s of Object.keys(n))(n[s]===void 0||n[s]===null)&&delete n[s];M=Promise.resolve(n);try{const s=await ne().savePrefs(n);return M=Promise.resolve(s),s}catch{return n}}const Xe=[{id:"cards",icon:"cardsView",label:"lsView_cards",managerOnly:!1},{id:"table",icon:"tableView",label:"lsView_table",managerOnly:!1},{id:"board",icon:"boardView",label:"lsView_board",managerOnly:!0},{id:"calendar",icon:"calendar",label:"lsView_calendar",managerOnly:!1}];function Ye(e){return Xe.filter(t=>!t.managerOnly||e)}function ut(e,t,n){return l`<div class="seg sm vsw" role="radiogroup" aria-label=${o("lsViewsGroup")} data-view-switch>
    ${Ye(t).map(s=>l`<button type="button" role="radio" aria-checked=${String(e===s.id)} aria-label=${o(s.label)} title=${o(s.label)} data-view=${s.id}
      @click=${()=>n(s.id)}>${$(s.icon)}${e===s.id?l`<span class="lbl">${o(s.label)}</span>`:""}</button>`)}
  </div>`}const N="sw.tickets.list.calendar";function ft(){try{return sessionStorage.getItem(N)==="1"}catch{return!1}}function ht(e){try{e?sessionStorage.setItem(N,"1"):sessionStorage.removeItem(N)}catch{}}const Ze=["stuck","waiting","cost"],bt={priority:[],handler:"",flags:[]};function Je(e){return e.priority.length+(e.handler?1:0)+e.flags.length}function Qe(e,t){switch(t){case"stuck":return!!e.stuck;case"waiting":return e.waiting_on==="manager"&&!["closed","cancelled"].includes(e.status);case"cost":return e.cost?.status==="submitted"}}function et(e,t){return t.priority.length&&!(e.priority&&t.priority.includes(e.priority.key))||(t.handler==="none"?B(e.assignee):t.handler&&B(e.assignee)!==t.handler)?!1:t.flags.every(n=>Qe(e,n))}function vt(e,t){return Je(t)?e.filter(n=>et(n,t)):[...e]}function tt(e){const t=n=>n==="waiting"?!0:n==="stuck"?e.some(s=>"stuck"in s):e.some(s=>!!s.cost);return Ze.filter(t)}function se(e){const t=new Map;for(const n of e)n.priority&&!t.has(n.priority.key)&&t.set(n.priority.key,{key:n.priority.key,name:n.priority.name,rank:n.priority.rank});return[...t.values()].sort((n,s)=>n.rank-s.rank).map(({key:n,name:s})=>({key:n,name:s}))}function ae(e){return Se(e).map(({key:t,name:n})=>({key:t,name:n}))}function W(e,t){return e.includes(t)?e.filter(n=>n!==t):[...e,t]}function wt(e,t,n,s=""){return l`<button type="button" class=${`btn sm filterbtn${e?" on":""}`} aria-expanded=${String(e)} aria-controls="filter-panel" aria-haspopup="dialog"
    aria-label=${t?o("lfBtnCount",{n:t}):o("lfBtn")} data-filter-toggle ?data-filter-btn=${s==="board"} @click=${n}>${f("filter")}<span class="lbl">${o("lfBtn")}</span>${t?l`<span class="n" aria-hidden="true">${t}</span>`:p}</button>`}function gt(e,t){return e.length?l`<div class="achips" role="group" aria-label=${o("tbChips")} data-active-chips>
    ${e.map(n=>l`<button type="button" class="achip" data-active-chip=${n.key} data-assignee-filter=${n.attrs?.["data-assignee-filter"]??p}
      aria-label=${n.attrs?.["aria-label"]??o("tbRemove",{name:n.label})} @click=${n.remove}><span class="t">${n.label}</span>${f("x")}</button>`)}
    ${e.length>1?l`<button type="button" class="areset" data-chips-reset aria-label=${o("tbResetLabel")} @click=${t}>${o("tbReset")}</button>`:p}
  </div>`:p}function R(e,t,n=""){return l`<section class="fsect" data-panel-section=${n||p}><h2 class="fl">${e}</h2>${t}</section>`}function mt(e,t,n,s){return l`<div class="fpop" id="filter-panel" role="dialog" aria-label=${o("tbPanel")} data-filter-panel>
    ${e}
    <div class="ffoot">
      <button type="button" class="btn sm" data-f-reset data-f-clear ?disabled=${!t} @click=${n}>${f("x")}${o("tbResetLabel")}</button>
      <span class="grow"></span>
      <button type="button" class="btn sm" data-f-close @click=${s}>${o("tbClose")}</button>
    </div>
  </div>`}class xt{constructor(t,n,s){this.host=t,this.isOpen=n,this.setOpen=s,this.wasOpen=!1,this.onKey=a=>{if(a.key!=="Escape"||!this.isOpen())return;const i=a.composedPath(),r=this.panel(),v=this.toggle();(r&&i.includes(r)||v&&i.includes(v))&&(a.stopPropagation(),this.setOpen(!1),v?.focus())},this.onOutside=a=>{if(!this.isOpen())return;const i=a.composedPath(),r=this.panel(),v=this.toggle();r&&i.includes(r)||v&&i.includes(v)||i.some(c=>c instanceof HTMLOptionElement)||this.setOpen(!1)},t.addController(this)}hostConnected(){window.addEventListener("pointerdown",this.onOutside,!0),this.host.addEventListener("keydown",this.onKey)}hostDisconnected(){window.removeEventListener("pointerdown",this.onOutside,!0),this.host.removeEventListener("keydown",this.onKey)}hostUpdated(){const t=this.isOpen();t&&this.placeSheet(),t&&!this.wasOpen&&this.panel()?.querySelector("button:not([disabled]), select, input")?.focus({preventScroll:!0}),this.wasOpen=t}placeSheet(){const t=this.panel(),n=this.toggle();if(!t||!n||getComputedStyle(t).position!=="fixed")return;const s=n.closest("[data-toolbar], .tb")??n;t.style.setProperty("--fpop-top",`${Math.ceil(s.getBoundingClientRect().bottom+8)}px`)}root(){return this.host.shadowRoot}panel(){return this.root()?.querySelector("[data-filter-panel]")??null}toggle(){return this.root()?.querySelector("[data-filter-toggle]")??null}}const yt=C`
  .dh-det.tb {
    flex-wrap: nowrap;
    gap: 10px;
    min-inline-size: 0;
    position: relative;
  }
  .tb .search {
    flex: 1 1 220px;
    min-inline-size: 160px;
    max-inline-size: 340px;
  }
  .tb > .seg {
    flex: none;
  }
  .dh-row .pact {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex: none;
    margin-inline-start: auto;
  }
  .fanchor {
    position: relative;
    flex: none;
  }
  /* "סינון": a neutral button whose active count is a small accent badge; pressed (open) = the control's pressed look */
  .filterbtn .n {
    display: inline-grid;
    place-items: center;
    min-inline-size: 20px;
    block-size: 20px;
    padding-inline: 6px;
    box-sizing: border-box;
    border-radius: var(--sw-r-pill);
    background: var(--dv-accent);
    color: var(--sw-text-inverse);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .filterbtn.on {
    background: var(--dv-surface-3);
    border-color: var(--dv-border-strong);
  }
  /* the active-filter chips: soft accent, the remove mark inside the chip, one quiet reset */
  .achips {
    display: flex;
    align-items: center;
    gap: 6px;
    min-inline-size: 0;
    flex: 0 1 auto;
    overflow: hidden;
  }
  .achip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    max-inline-size: 220px;
    min-block-size: 32px;
    padding-inline: 12px 8px;
    border: 1px solid transparent;
    border-radius: var(--sw-r-pill);
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
    transition: transform var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease);
    -webkit-tap-highlight-color: transparent;
  }
  .achip .t {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .achip .ic {
    flex: none;
    inline-size: 14px;
    block-size: 14px;
    opacity: 0.75;
  }
  .achip:active {
    transform: scale(0.97);
  }
  .areset {
    flex: none;
    min-block-size: 32px;
    padding-inline: 8px;
    border: 0;
    background: transparent;
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
    border-radius: var(--sw-r-md);
  }
  @media (hover: hover) and (pointer: fine) {
    .achip:hover {
      border-color: color-mix(in srgb, var(--dv-accent) 40%, transparent);
    }
    .areset:hover {
      color: var(--dv-text);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }
  .achip:focus-visible,
  .areset:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  /* the panel: opaque, anchored under its button, enters from just above (transform + opacity; zero under reduced motion) */
  .fpop {
    position: absolute;
    inset-block-start: calc(100% + 8px);
    inset-inline-start: 0;
    z-index: 30;
    inline-size: min(560px, calc(100vw - 48px));
    max-block-size: min(70dvh, 560px);
    overflow-y: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    border-radius: var(--sw-r-2xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
    box-shadow: var(--dv-shadow-2);
    color: var(--dv-text);
    transform-origin: top;
    transition: opacity var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
  }
  @starting-style {
    .fpop {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }
  .fsect {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-inline-size: 0;
  }
  .fsect .fl {
    margin: 0;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .fchips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .fchips .rc {
    block-size: auto;
    min-block-size: 36px;
    padding-inline: 14px;
    font-size: var(--sw-fs-base);
  }
  .fchips .rc small {
    display: inline-grid;
    place-items: center;
    min-inline-size: 18px;
    block-size: 18px;
    padding-inline: 5px;
    box-sizing: border-box;
    margin-inline-start: 8px;
    border-radius: var(--sw-r-pill);
    background: color-mix(in srgb, var(--dv-text) 8%, transparent);
    color: var(--dv-text-2);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  /* a single-choice group (the state) reads as the same chips; the chosen one takes the pressed look */
  .fchips .rc[aria-checked='true'] {
    background: var(--dv-text);
    border-color: transparent;
    color: var(--mm-text-inverse);
    font-weight: 600;
    box-shadow: var(--dv-shadow-control);
  }
  .fchips .rc[aria-pressed='true'] small,
  .fchips .rc[aria-checked='true'] small {
    background: color-mix(in srgb, currentColor 18%, transparent);
    color: inherit;
  }
  .fpop .frow {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 0;
    background: none;
    border: 0;
    box-shadow: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  /* inside the panel the old filter row is a plain stack, not a bubble: no rounded corner for the guard to find text in */
  .fpop .frow {
    border-radius: 0;
  }
  .fpop .frow select {
    inline-size: min(100%, 280px);
    max-inline-size: none;
    min-block-size: 36px;
  }
  .fpop ticket-board-tree {
    max-block-size: 280px;
    overflow-y: auto;
  }
  .ffoot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-block-start: 12px;
    border-block-start: 1px solid var(--dv-border);
  }
  .ffoot .grow {
    flex: 1;
  }
  @media (max-width: 1279px) {
    /* the label of the active view hides first: the icons keep their names in aria-label and title */
    .dh-row .vsw button .lbl {
      display: none;
    }
  }
  @media (max-width: 767px) {
    .dh-det.tb {
      flex-wrap: wrap;
      gap: 8px;
    }
    .tb > .seg {
      order: 0;
      inline-size: 100%;
      box-sizing: border-box;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      border-radius: var(--sw-r-xl);
    }
    .tb > .seg button {
      min-block-size: 44px;
      padding-inline: 6px;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tb .search {
      order: 1;
      flex: 1 1 0;
      min-inline-size: 0;
      max-inline-size: none;
    }
    .tb .fanchor {
      order: 1;
      position: static;
    }
    .tb .filterbtn {
      min-block-size: 44px;
    }
    .tb .filterbtn .lbl {
      display: none;
    }
    .tb .achips {
      order: 2;
      inline-size: 100%;
      flex-wrap: wrap;
      overflow: visible;
    }
    .achip,
    .areset {
      min-block-size: 44px;
    }
    /* on a phone the panel is a bottom sheet over the page, just above the dock (a panel in the sticky header could not scroll and folded
       away with the compacting header); it rises 8 px into place */
    .fpop {
      position: fixed;
      inset-block: auto var(--sw-bottomnav-h);
      inset-inline: 0;
      inline-size: auto;
      /* the sheet stops under the toolbar (--fpop-top, measured by FilterPanelController): the scope, "סינון" and the active chips stay
         reachable while it is open (a sheet over the toolbar swallowed their taps) */
      max-block-size: max(160px, calc(100dvh - var(--sw-bottomnav-h) - var(--fpop-top, 96px)));
      padding: 18px 16px 14px;
      border-radius: var(--sw-r-2xl) var(--sw-r-2xl) 0 0;
      border-block-end: 0;
      z-index: 60;
      transform-origin: bottom;
    }
    @starting-style {
      .fpop {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    .fchips .rc,
    .fpop .frow select {
      min-block-size: 44px;
    }
    .dh-row .pact .newbtn .lbl {
      display: none;
    }
    .dh-row .pact .newbtn {
      min-inline-size: 44px;
      min-block-size: 44px;
      justify-content: center;
    }
  }
`,re={stuck:"lfStuck",waiting:"lfWaiting",cost:"lfCost"};function kt(e,t,n){const s=se(e),a=ae(e),i=tt(e);return l`<div class="frow" id="filter-row" role="group" aria-label=${o("lfGroup")} data-filter-row>
    ${s.length?R(o("lfPriority"),l`<div class="fchips">
      ${s.map(r=>l`<button type="button" class="rc sm" aria-pressed=${String(t.priority.includes(r.key))} data-f-priority=${r.key} @click=${()=>n({...t,priority:W(t.priority,r.key)})}>${y(r.name)}</button>`)}
    </div>`,"priority"):p}
    ${R(o("lfHandler"),l`<label class="vh" for="f-handler">${o("lfHandler")}</label>
      <select id="f-handler" data-f-handler .value=${t.handler} @change=${r=>n({...t,handler:r.target.value})}>
        <option value="" ?selected=${t.handler===""}>${o("lfAnyHandler")}</option>
        <option value="none" ?selected=${t.handler==="none"}>${o("lfNoHandler")}</option>
        ${a.map(r=>l`<option value=${r.key} ?selected=${t.handler===r.key}>${r.name}</option>`)}
      </select>`,"handler")}
    ${i.length?R(o("tbFlags"),l`<div class="fchips">
      ${i.map(r=>l`<button type="button" class="rc sm" aria-pressed=${String(t.flags.includes(r))} data-f-flag=${r} @click=${()=>n({...t,flags:W(t.flags,r)})}>${r==="stuck"?f("warning"):$(r==="cost"?"coin":"hand")}${o(re[r])}</button>`)}
    </div>`,"flags"):p}
  </div>`}function $t(e,t,n){const s=[],a=se(e);for(const i of t.priority)s.push({key:`priority:${i}`,label:`${o("lfPriority")}: ${a.find(r=>r.key===i)?.name??i}`,remove:()=>n({...t,priority:t.priority.filter(r=>r!==i)})});if(t.handler){const i=t.handler==="none"?o("lfNoHandler"):ae(e).find(r=>r.key===t.handler)?.name??o("lfHandler");s.push({key:"handler",label:t.handler==="none"?i:`${o("lfHandler")}: ${i}`,remove:()=>n({...t,handler:""})})}for(const i of t.flags)s.push({key:`flag:${i}`,label:o(re[i]),remove:()=>n({...t,flags:t.flags.filter(r=>r!==i)})});return s}export{xt as F,bt as N,ct as a,We as b,ft as c,ht as d,$t as e,kt as f,mt as g,wt as h,gt as i,vt as j,it as k,ut as l,yt as m,Ne as n,lt as o,R as p,ot as q,dt as r,pt as s,ne as t};
//# sourceMappingURL=list-filter-row-Bo9HpcUx.js.map
