const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{s as ge,b as ae,S as ve,d as be,e as xe,w as ye,o as ke,m as $e}from"./ticket-detail-DMuYpWes.js";import{j as L,z as k,k as m,a as K,iJ as _e,A as w,b as c,m as ie,bN as ze,v_ as Ce,cK as re,G as z,aX as oe,v$ as Oe,aj as S,af as Se,bw as Me,bg as F,bv as Pe,bE as Ee,F as X,c as q,bJ as Te,cA as I,cI as Le,ew as He,q as qe,d7 as De}from"./index-CVsAtsN7.js";import{a as Fe}from"./automations-glass-B2HDAEjC.js";import{a as le}from"./glass-D86AXCLx.js";import{b as Ie}from"./bubble-chrome-CFvMZX-M.js";import{t as y,l as P}from"./icons-VglzNM_I.js";import{i as Ne,j as Re,k as Q}from"./map-text-BdYq7drw.js";import{l as o}from"./list-text-CR9gw_LN.js";import{i as Ae,w as Ve}from"./board-model-BZD7XmrD.js";import{_ as Be}from"./sw-logo-art-PLtEZJxU.js";import{p as N,F as Ge}from"./list-toolbar-RdMtyvGg.js";import{t as Ke}from"./tickets-CJXeSTIx.js";import{a as je}from"./media-page-Cxc0M3UO.js";const Ue=L`
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
`,Lt=L`
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
  .vsw::part(label) {
    font-weight: 600;
  }
  .vsw::part(icon-on) {
    color: var(--dv-accent-text);
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
    .vsw::part(label) {
      display: none;
    }
    /* CR-CMP2-SEGMENTED-C-2450: the scope keys (sw-segmented) share the full-width row equally, 44 px tall */
    .dh-det sw-segmented.scope {
      order: 0;
      display: flex;
      inline-size: 100%;
      --sw-seg-radius: var(--sw-r-xl);
      --sw-seg-h: 44px;
      --sw-seg-key-pad: 6px;
      --sw-seg-key-flex: 1 1 0;
    }
    .dh-det .filterbtn {
      order: 2;
      min-block-size: 44px;
    }
  }
`,Ht=L`
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
`,H=6e4,M=60*H,R=24*M,j=["closed","cancelled"];function ce(e,t=new Date){const s=Date.parse(e.created_at);if(Number.isNaN(s))return null;let n=t.getTime();if(j.includes(e.status)){const a=Date.parse(e.closed_at??e.last_activity_at??"");n=Number.isNaN(a)?t.getTime():a}return Math.max(0,n-s)}function de(e){const t=Math.max(0,e);if(t<H)return o("elLessMinute");if(t<M)return o("elMin",{m:Math.floor(t/H)});if(t<R){const i=Math.floor(t/M),r=Math.floor(t%M/H);return r?o("elHourMin",{h:i,m:r}):o("elHour",{h:i})}const s=Math.floor(t/R),n=Math.floor(t%R/M),a=o(s===1?"elDayOne":"elDays",{d:s});return n?`${a} ${o("elHour",{h:n})}`:a}function We(e,t=new Date){const s=ce(e,t);if(s===null)return null;const n=de(s),a=j.includes(e.status),i=a?o(e.status==="cancelled"?"elCancelled":"elHandled",{dur:n}):o("elOpen",{dur:n}),r=a?null:ge({status:e.status,sla:e.sla},t).badge;return{text:i,dur:n,frozen:a,tone:r?.tone??""}}function qt(e,t=new Date){let s=-1;for(const n of e){if(j.includes(n.status))continue;const a=ce(n,t);a!==null&&a>s&&(s=a)}return s<0?"":o("elOldest",{dur:de(s)})}var Xe=Object.defineProperty,Qe=Object.getOwnPropertyDescriptor,U=(e,t,s,n)=>{for(var a=n>1?void 0:n?Qe(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(n?r(t,s,a):r(a))||a);return n&&a&&Xe(t,s,a),a};let E=class extends K{constructor(){super(...arguments),this.now=new Date,this.off=null}connectedCallback(){super.connectedCallback(),this.now=new Date;const e=_e(t=>this.now=t);this.off=()=>{e()}}disconnectedCallback(){super.disconnectedCallback(),this.off?.(),this.off=null}render(){const e=this.item?We(this.item,this.now):null;return e?c`<span class=${e.tone} data-elapsed=${e.frozen?"frozen":"open"} title=${o("elTitle")}>${e.text}</span>`:w}};E.styles=L`
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
  `;U([k({attribute:!1})],E.prototype,"item",2);U([m()],E.prototype,"now",2);E=U([ie("ticket-elapsed")],E);const Ye=3,Je=["closed","cancelled"],T=e=>!Je.includes(e.status);function Dt(e,t){if(e.view==="limited")return"requester";if(e.manager||e.can?.manage)return"manager";const s=e.department?t?.departments.find(n=>n.id===e.department?.id):void 0;return s?.my_role==="manager"||t?.can.all_departments&&t.can.manage?"manager":s?.my_role==="member"?"handler":t?.can.manage?"manager":"requester"}function Ze(e,t){const s=[];e.priority&&s.push({key:"priority",text:e.priority.name,tone:re(e.priority)}),e.department&&s.push({key:"department",text:e.department.name,tone:""});const n=t==="manager"||t==="approver";return n&&e.cost?.status==="submitted"&&e.cost.can_decide!==!1&&T(e)?s.push({key:"cost",text:o("lcCostMine"),tone:"warn",icon:"coin"}):n&&e.stuck&&T(e)?s.push({key:"stuck",text:o("lcStuck"),tone:"bad",icon:"warning"}):e.reopen_count>0&&s.push({key:"reopened",text:z("reopenedChip"),tone:"warn",icon:"refresh"}),s.slice(0,Ye)}function Y(e){return ze(e)}function et(e){const t=[];if(e.assignee?.name){const s=e.assignee.kind==="contact";t.push({ini:Y(e.assignee.name),name:e.assignee.name,kind:s?"ext":"int",label:o(s?"lcWhoVendor":"lcWhoStaff",{name:e.assignee.name})})}return e.owner?.name&&t.push({ini:Y(e.owner.name),name:e.owner.name,kind:"int",label:o("lcWhoOwner",{name:e.owner.name})}),t.filter(s=>s.ini).slice(0,2)}function tt(e,t){if(!T(e))return null;const s=ye(e,t);if(s){const n=s.key==="stuck"&&(e.stuck?.level??0)>=2;return{key:s.key,text:s.text,tone:n?"bad":s.tone,icon:"warning"}}if(e.group==="waiting"){const n=Ve(e.waiting_reason);if(n)return{key:"wait",text:n,tone:"warn",icon:"user"}}return null}function st(e,t){const s=t.now??new Date;let n=ae(e,t.role,s);if(t.board&&e.status==="done"&&e.auto_close_at){const r=Ae(e.auto_close_at);r&&n.length+3+r.length<=ve&&(n=`${n} · ${r}`)}const a=t.board?tt(e,t.role):null,i=Ce(e,s,{omitUnassigned:!e.assignee&&(e.status==="new"||be(e.status))});return{sentence:n,chip:xe(e),chips:a?[]:Ze(e,t.role),warning:a,avatars:et(e),run:{text:i.text,tone:i.tone},urgent:re(e.priority)==="bad"&&T(e),stuck:!!e.stuck&&T(e)}}function Ft(e,t,s,n){const{sla:a,cost:i,...r}=e;return ae({...r,cost:e.cost_status&&e.cost_status!=="not_required"?{status:e.cost_status,can_decide:n}:null},t,s)}var nt=Object.defineProperty,at=Object.getOwnPropertyDescriptor,$=(e,t,s,n)=>{for(var a=n>1?void 0:n?at(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(n?r(t,s,a):r(a))||a);return n&&a&&nt(t,s,a),a};let b=class extends K{constructor(){super(...arguments),this.bubbleSkin=new oe(this),this.href="",this.timelineHref="",this.fullScreen=!0,this.now=new Date,this.role="manager",this.board=!1,this.picked=!1,this.skeleton=!1,this.menu=!1,this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&this.setMenu(!1)},this.onKey=e=>{this.menu&&e.key==="Escape"&&this.setMenu(!1)},this.placeMenu=()=>{if(!this.menu)return;const e=this.renderRoot.querySelector(".pop.ov"),t=this.renderRoot.querySelector("[data-card-menu]");e&&t&&ke(e,t)},this.onMenuKey=e=>{e.key==="Escape"?(e.stopPropagation(),this.setMenu(!1),this.renderRoot.querySelector("[data-card-menu]")?.focus()):$e(e,e.currentTarget)}}connectedCallback(){super.connectedCallback(),le(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey),window.addEventListener("resize",this.placeMenu),window.addEventListener("scroll",this.placeMenu,!0)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey),window.removeEventListener("resize",this.placeMenu),window.removeEventListener("scroll",this.placeMenu,!0)}setMenu(e){this.menu=e,this.toggleAttribute("data-menu",e),e&&this.updateComplete.then(()=>this.renderRoot.querySelector(".pop button")?.focus())}updated(){this.placeMenu()}act(e){this.setMenu(!1),this.dispatchEvent(new CustomEvent("card-action",{detail:{item:this.item,action:e},bubbles:!0,composed:!0}))}menuItems(){const e=(t,s,n)=>c`<button type="button" role="menuitem" data-card-action=${t} @click=${()=>this.act(t)}>${y(s)}${n}</button>`;return c`<div class="pop ov" popover="manual" role="menu" aria-label=${z("actions")} @keydown=${this.onMenuKey}>
      ${e("open","eye",z("open"))}
      ${this.fullScreen?e("full","expand",z("fullScreen")):w}
      ${e("copy","link",z("copyLink"))}
    </div>`}renderSkeleton(){const e=t=>c`<span class="skl ln" style=${`inline-size:${t}`}></span>`;return c`<article class="tcard sk" aria-hidden="true" data-card-skeleton>
      <header>
        <div class="ttl">
          <h3>${e("68%")}</h3>
          <div class="where">${y("layers")}${e("42%")}</div>
        </div>
        <div class="ctl"><span class="chip">${e("52px")}</span><span class="more"></span></div>
      </header>
      <p class="stat">${e("92%")}<br />${e("58%")}</p>
      ${this.board?c`<div class="cwarn">${e("64%")}</div>`:c`<div class="chips"><span class="chip">${e("44px")}</span><span class="chip">${e("58px")}</span></div>`}
      <footer>
        <span class="num">${e("32px")}</span>
        <span class="run">${e("72px")}</span>
        <a class="tl" tabindex="-1">${e("56px")}</a>
        <span class="pair"><span class="av"></span><span class="av"></span></span>
      </footer>
    </article>`}render(){if(this.skeleton)return this.renderSkeleton();const e=this.item;if(!e)return w;const t=Oe(e),s=st(e,{role:this.role,now:this.now,board:this.board}),n=s.chip.tone,a=["closed","cancelled"].includes(e.status);return c`<article class=${`tcard${s.urgent?" urgent":""}${s.stuck?" stuck":""}${a?" closed":""}`} data-ticket=${e.id} data-status=${e.status} aria-label=${e.title}>
      <header>
        <div class="ttl">
          <h3 dir="auto" data-card-title><a class="name" href=${this.href||"#"} title=${e.title} data-card-open>${S(e.title)}</a></h3>
          ${t.strong||t.rest?c`<div class="where">${y("layers")}${t.strong?c`<b>${S(t.strong)}</b>`:w}${t.rest?c`<span>${S(t.rest)}</span>`:w}</div>`:w}
        </div>
        <div class="ctl">
          <span class=${`chip ${n}`} data-card-status aria-label=${s.chip.text}><i class=${`dot ${n==="ok"?"ok":n==="info"?"run":""}`}></i>${s.chip.label}${s.chip.sub?c`<span class="subst"> · ${s.chip.sub}</span>`:w}</span>
          <button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${z("moreOf",{title:e.title})} data-card-menu @click=${()=>this.setMenu(!this.menu)}>${y("dots")}</button>
        </div>
        ${this.menu?this.menuItems():w}
      </header>
      <p class="stat" data-card-sentence title=${s.sentence}>${s.sentence}</p>
      ${s.warning?c`<div class=${`cwarn ${s.warning.tone}`} data-card-warning=${s.warning.key} role="note">${s.warning.icon==="user"?P("hand"):y("warning")}<span>${s.warning.text}</span></div>`:c`<div class="chips" data-card-chips>
            ${s.chips.map(i=>c`<span class=${`chip ${i.tone}`} data-chip=${i.key}>${i.key==="priority"?c`<i class=${`dot ${i.tone==="bad"?"bad":i.tone==="info"?"run":""}`}></i>`:i.icon==="coin"?P("coin"):i.icon==="warning"?y("warning"):i.icon==="refresh"?y("refresh"):w}${i.key==="department"?S(i.text):i.text}</span>`)}
          </div>`}
      <footer>
        <span class="num">#${e.number}</span>
        <span class="run" data-card-run><i class=${`dot ${s.run.tone}`}></i><span>${s.run.text}</span></span>
        <ticket-elapsed .item=${e} data-card-elapsed></ticket-elapsed>
        ${this.timelineHref?c`<a class="tl" href=${this.timelineHref} data-card-timeline>${y("clock")}${z("timelineLink")}</a>`:w}
        ${s.avatars.length?c`<span class="pair" data-card-pair>${s.avatars.map(i=>c`<span class=${`av ${i.kind}`} title=${i.label} role="img" aria-label=${i.label}>${i.ini}</span>`)}</span>`:w}
      </footer>
    </article>`}};b.styles=[Ie,...Fe,Ne,Ue];$([k({attribute:!1})],b.prototype,"item",2);$([k()],b.prototype,"href",2);$([k()],b.prototype,"timelineHref",2);$([k({type:Boolean})],b.prototype,"fullScreen",2);$([k({attribute:!1})],b.prototype,"now",2);$([k()],b.prototype,"role",2);$([k({type:Boolean})],b.prototype,"board",2);$([k({type:Boolean,reflect:!0,attribute:"data-picked"})],b.prototype,"picked",2);$([k({type:Boolean,reflect:!0})],b.prototype,"skeleton",2);$([m()],b.prototype,"menu",2);b=$([ie("ticket-card")],b);const _="tickets",J=encodeURIComponent,A=e=>{const t=new URLSearchParams;for(const[n,a]of Object.entries(e))a!==""&&t.set(n,a);const s=t.toString();return s?`?${s}`:""},Z=e=>Te(e),it={page:e=>F(`${_}/table${A(e)}`),bulk:e=>X(`${_}/bulk`,e),exportCsv:async e=>{const{blob:t,headers:s}=await Z(`${_}/export.csv${A(e)}`),n=s.get("X-Export-Rows"),a=/filename="?([^";]+)"?/.exec(s.get("Content-Disposition")??"")?.[1];return{blob:t,rows:n===null?null:Number(n),filename:a||"export.csv"}},monthlyReport:async e=>{const{blob:t,headers:s}=await Z(`${_}/reports/monthly.csv${A(e)}`),n=s.get("X-Export-Rows"),a=/filename="?([^";]+)"?/.exec(s.get("Content-Disposition")??"")?.[1];return{blob:t,rows:n===null?null:Number(n),filename:a||"monthly.csv"}},views:()=>F(`${_}/views`),createView:(e,t)=>X(`${_}/views`,{name:e,view:t}),patchView:(e,t)=>Ee(`${_}/views/${J(e)}`,t),deleteView:e=>Pe(`${_}/views/${J(e)}`,{method:"DELETE"}),prefs:async()=>(await F("me/prefs")).prefs["tickets.board"]??{},savePrefs:async e=>(await Me("me/prefs",{"tickets.board":e})).prefs["tickets.board"]??{}},rt=["new","assigned","acknowledged","in_progress","waiting_part","done","returned","closed","cancelled"],ot={open:["new","assigned","acknowledged","in_progress","waiting_part","done","returned"],unassigned:["new","returned"],handling:["assigned","acknowledged","in_progress","waiting_part"],done:["done"],closed:["closed","cancelled"]},O=[];let V={},lt=0;function ee(e,t){switch(t){case"number":return e.number;case"title":return e.title;case"department":return e.department?.name??"";case"priority":return e.priority?.rank??99;case"status":return rt.indexOf(e.status);case"assignee":return e.assignee?.name??"";case"place":return e.place_text;case"device":return e.device_name;case"created":return e.created_at;case"activity":return e.last_activity_at;case"stuck":return e.stuck?1+e.stuck.level:0;case"sla":return e.sla?.due_at??"9999";case"cost":return e.cost?.total_minor??-1;case"cost_status":return e.cost_status??""}}const te=()=>Be(()=>import("./tickets-mock-CpPUgf2K.js"),__vite__mapDeps([0]),import.meta.url).then(e=>e.mockBackend),ct={async page(e){const t=await te(),s=await t.list({scope:e.scope||"visible",status:"all",limit:200}),n=!e.status||e.status==="all"?null:ot[e.status]??e.status.split(","),a=e.department?e.department.split(","):[],i=e.priority?e.priority.split(","):[],r=(e.q??"").trim(),h=[];for(const d of s.items){if(n&&!n.includes(d.status)||a.length&&!a.includes(d.department?.id??"")||i.length&&!i.includes(d.priority?.key??"")||e.assignee==="none"&&d.assignee||e.assignee==="me"&&d.assignee?.id!=="demo"||e.assignee?.includes(":")&&e.assignee!==`${d.assignee?.kind}:${d.assignee?.id}`||e.waiting==="manager"&&d.waiting_on!=="manager"||r&&!d.title.includes(r)&&String(d.number)!==r.replace(/^#/,""))continue;const p=await t.get(d.id),{excerpt:u,...l}=d;if(e.cost_status&&!e.cost_status.split(",").includes(p.cost?.status??""))continue;const x=p.cost?.total_minor!=null&&p.cost.currency?{total_minor:p.cost.total_minor,currency:p.cost.currency,approved:p.cost.status==="approved"||p.cost.status==="paid"}:null;h.push({...l,stuck:null,sla:null,transitions:p.transitions,can:{manage:p.can.manage,assign:p.can.assign,assign_external:!1},cost:x,cost_status:p.cost?.status??null})}const C=(e.sort||"activity:desc").split(",").map(d=>d.split(":"));return h.sort((d,p)=>{for(const[u,l]of C){const x=ee(d,u),f=ee(p,u);if(x!==f)return(x<f?-1:1)*(l==="desc"?-1:1)}return d.id<p.id?-1:1}),{items:h,next_cursor:null,sort:e.sort||"activity:desc",limit:Number(e.limit||50)}},async bulk(e){const t=await te(),s=[];for(const a of e.items){let i="ok",r;try{const h=await t.get(a.id);if(r=h.number,h.revision!==a.revision)i="stale";else if(e.action==="close")await t.status(a.id,{to:"closed",note:e.params.note,revision:a.revision});else if(e.action==="assign"&&e.params.assignee)await t.assign(a.id,{assignee:e.params.assignee,revision:a.revision});else if(e.action==="priority"){const d=(await t.meta()).departments.find(p=>p.id===h.department?.id)?.priorities.find(p=>p.key===e.params.priority_key);!d||d.id===h.priority?.id?i="unchanged":await t.patch(a.id,{priority_id:d.id,revision:a.revision})}else e.action==="remind"&&!h.assignee&&(i="invalid_transition")}catch(h){i=h instanceof q&&h.status===409?"invalid_transition":"not_found"}s.push({id:a.id,number:r,result:i})}const n={};for(const a of s)n[a.result]=(n[a.result]??0)+1;return{action:e.action,total:e.items.length,done:n.ok??0,counts:n,results:s}},async exportCsv(){return{blob:new Blob(["\uFEFF"],{type:"text/csv"}),rows:0,filename:"export.csv"}},async monthlyReport(){return{blob:new Blob(["\uFEFF"],{type:"text/csv"}),rows:0,filename:"monthly.csv"}},async views(){return{items:O.map(e=>({...e})),max:20}},async createView(e,t){const s=new Date().toISOString(),n={id:`v${++lt}`,name:e,view:t,created_at:s,updated_at:s};return O.push(n),{...n}},async patchView(e,t){const s=O.find(n=>n.id===e);if(!s)throw new q(404,{code:"view_not_found",user_message:"",retryable:!1,correlation_id:"",details:{}});return Object.assign(s,t.name?{name:t.name}:{},t.view?{view:t.view}:{}),{...s}},async deleteView(e){const t=O.findIndex(s=>s.id===e);t>=0&&O.splice(t,1)},async prefs(){return{...V}},async savePrefs(e){return V={...e},{...V}}};function pe(){return Se()?it:ct}let D=null;function dt(){return D??=pe().prefs().catch(()=>({})),D}async function It(e){const s={...await dt(),...e};for(const n of Object.keys(s))(s[n]===void 0||s[n]===null)&&delete s[n];D=Promise.resolve(s);try{const n=await pe().savePrefs(s);return D=Promise.resolve(n),n}catch{return s}}function Nt(e,t){const s=[];let n=[],a=0,i=null,r=null;const h=new Set,C=()=>{n.length&&s.push(n),n=[],a=0,i=null,r=null},d=(u,l,x)=>{let f=0;return!i||i.id!==u.id?(f+=(n.length?t.secGap:0)+(u.head?t.headH+(l?t.inGap:0):0),l&&(f+=(l.sub?t.subH+t.blkGap:0)+(l.pad??0))):l&&(!r||r.key!==l.key)?f+=t.inGap+(l.sub?t.subH+t.blkGap:0)+(l.pad??0):l&&(f+=l.gap),f+x},p=(u,l,x,f)=>{n.length&&a+d(u,l,f)>t.room+.5&&C(),a+=d(u,l,f),(!i||i.id!==u.id)&&(i={id:u.id,groups:[],cont:h.has(u.id)},h.add(u.id),n.push(i),r=null),l&&((!r||r.key!==l.key)&&(r={key:l.key,items:[]},i.groups.push(r)),r.items.push(...x))};for(const u of e){if(!u.groups.length){p(u,null,[],0);continue}for(const l of u.groups){const x=Math.max(1,l.cols);for(let f=0;f<l.items.length;f+=x){const W=l.items.slice(f,f+x),we=l.heightOf?Math.max(0,...W.map(me=>l.heightOf(me)??l.rowH)):l.rowH;p(u,l,W,we)}}}return C(),s}function Rt(e){if(!e)return 1;const t=getComputedStyle(e).gridTemplateColumns;return Math.max(1,t&&t!=="none"?t.split(" ").filter(Boolean).length:1)}function At(e){return e&&parseFloat(getComputedStyle(e).rowGap)||0}const se="(min-width: 1024px)",pt=[{id:"cards",icon:"cardsView",label:"lsView_cards",managerOnly:!1},{id:"table",icon:"tableView",label:"lsView_table",managerOnly:!1},{id:"board",icon:"boardView",label:"lsView_board",managerOnly:!0},{id:"calendar",icon:"calendar",label:"lsView_calendar",managerOnly:!1}];function ut(e){return pt.filter(t=>!t.managerOnly||e)}function Vt(e,t,s){return c`<sw-segmented class="vsw" radio size="sm" labels="chosen" label=${o("lsViewsGroup")} data-view-switch value=${e}
    @change=${n=>s(n.detail.value)}
    .options=${ut(t).map(n=>({value:n.id,label:o(n.label),title:o(n.label),icon:P(n.icon),attrs:{"data-view":n.id}}))}></sw-segmented>`}const G="sw.tickets.list.calendar";function Bt(){try{return sessionStorage.getItem(G)==="1"}catch{return!1}}function Gt(e){try{e?sessionStorage.setItem(G,"1"):sessionStorage.removeItem(G)}catch{}}const ft=["stuck","waiting","cost"],ht={priority:[],handler:"",flags:[]};function wt(e){return e.priority.length+(e.handler?1:0)+e.flags.length}function mt(e,t){switch(t){case"stuck":return!!e.stuck;case"waiting":return e.waiting_on==="manager"&&!["closed","cancelled"].includes(e.status);case"cost":return e.cost?.status==="submitted"}}function gt(e,t){return t.priority.length&&!(e.priority&&t.priority.includes(e.priority.key))||(t.handler==="none"?Q(e.assignee):t.handler&&Q(e.assignee)!==t.handler)?!1:t.flags.every(s=>mt(e,s))}function Kt(e,t){return wt(t)?e.filter(s=>gt(s,t)):[...e]}function vt(e){const t=s=>s==="waiting"?!0:s==="stuck"?e.some(n=>"stuck"in n):e.some(n=>!!n.cost);return ft.filter(t)}function ue(e){const t=new Map;for(const s of e)s.priority&&!t.has(s.priority.key)&&t.set(s.priority.key,{key:s.priority.key,name:s.priority.name,rank:s.priority.rank});return[...t.values()].sort((s,n)=>s.rank-n.rank).map(({key:s,name:n})=>({key:s,name:n}))}function fe(e){return Re(e).map(({key:t,name:s})=>({key:t,name:s}))}function ne(e,t){return e.includes(t)?e.filter(s=>s!==t):[...e,t]}const he={stuck:"lfStuck",waiting:"lfWaiting",cost:"lfCost"};function jt(e,t,s){const n=ue(e),a=fe(e),i=vt(e);return c`<div class="frow" id="filter-row" role="group" aria-label=${o("lfGroup")} data-filter-row>
    ${n.length?N(o("lfPriority"),c`<div class="fchips">
      ${n.map(r=>c`<button type="button" class="rc sm" aria-pressed=${String(t.priority.includes(r.key))} data-f-priority=${r.key} @click=${()=>s({...t,priority:ne(t.priority,r.key)})}>${S(r.name)}</button>`)}
    </div>`,"priority"):w}
    ${N(o("lfHandler"),c`<label class="vh" for="f-handler">${o("lfHandler")}</label>
      <select id="f-handler" data-f-handler .value=${t.handler} @change=${r=>s({...t,handler:r.target.value})}>
        <option value="" ?selected=${t.handler===""}>${o("lfAnyHandler")}</option>
        <option value="none" ?selected=${t.handler==="none"}>${o("lfNoHandler")}</option>
        ${a.map(r=>c`<option value=${r.key} ?selected=${t.handler===r.key}>${r.name}</option>`)}
      </select>`,"handler")}
    ${i.length?N(o("tbFlags"),c`<div class="fchips">
      ${i.map(r=>c`<button type="button" class="rc sm" aria-pressed=${String(t.flags.includes(r))} data-f-flag=${r} @click=${()=>s({...t,flags:ne(t.flags,r)})}>${r==="stuck"?y("warning"):r==="cost"?P("coin"):P("hand")}${o(he[r])}</button>`)}
    </div>`,"flags"):w}
  </div>`}function Ut(e,t,s){const n=[],a=ue(e);for(const i of t.priority)n.push({key:`priority:${i}`,label:`${o("lfPriority")}: ${a.find(r=>r.key===i)?.name??i}`,remove:()=>s({...t,priority:t.priority.filter(r=>r!==i)})});if(t.handler){const i=t.handler==="none"?o("lfNoHandler"):fe(e).find(r=>r.key===t.handler)?.name??o("lfHandler");n.push({key:"handler",label:t.handler==="none"?i:`${o("lfHandler")}: ${i}`,remove:()=>s({...t,handler:""})})}for(const i of t.flags)n.push({key:`flag:${i}`,label:o(he[i]),remove:()=>s({...t,flags:t.flags.filter(r=>r!==i)})});return n}var bt=Object.defineProperty,g=(e,t,s,n)=>{for(var a=void 0,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=r(t,s,a)||a);return a&&bt(t,s,a),a};function B(e,t){if(!t){window.location.hash=e;return}const s=e.replace(/^#/,""),[n,a=""]=s.split("?");De(n,new URLSearchParams(a))}const Wt=L`
  .cgrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: var(--dv-gap-lg, 16px);
    align-items: stretch;
  }
  .flt {
    position: fixed;
    inset-block-end: 24px;
    inset-inline: 0;
    margin-inline: auto;
    inline-size: fit-content;
    max-inline-size: calc(100% - 32px);
    box-sizing: border-box;
    z-index: 40;
    box-shadow: var(--dv-shadow-2);
  }
  /* NOSCROLL-297 + TICKETS-POLISH-2331 (owner rule: a control screen fits the viewport): from a tablet up, below the header the screen's
     content scrolls in its own region - the page itself never scrolls and the controls stay in place. On a phone the region is transparent
     (display: contents) and the page scrolls. */
  .scr {
    display: contents;
  }
  /* AUDIT30-C-TICKETS (#6): sw-page is the frame (its header row: the title, the actions slot); the toolbar under it no longer sticks or
     compacts - the title it compacted moved into the frame (on a phone the page scrolls, the toolbar with it) */
  .pact {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .dh {
    position: static;
    padding-block-start: 0;
  }
  @media (min-width: 768px) {
    :host {
      overflow: hidden;
    }
    .page {
      block-size: 100%;
      min-block-size: 0;
      box-sizing: border-box;
      padding-block-end: 0;
      gap: 18px;
    }
    .scr {
      display: flex;
      flex-direction: column;
      gap: 18px;
      flex: 1 1 auto;
      min-block-size: 0;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--dv-border-strong) transparent;
      margin-inline: -36px;
      padding: 2px 36px 28px;
    }
  }
  @media (min-width: 768px) and (max-width: 1023px) {
    .scr {
      margin-inline: -24px;
      padding-inline: 24px;
    }
  }
  @media (max-width: 767px) {
    .flt {
      inset-block-end: calc(84px + env(safe-area-inset-bottom, 0px));
    }
  }
`;class v extends K{constructor(){super(...arguments),this.bubbleSkin=new oe(this),this.route=null,this.module=null,this.meta=null,this.screen="loading",this.failed="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.drawerUsed=!1,this.toast=null,this.now=new Date,this.q="",this.filterOpen=!1,this.filters={...ht},this.panelCtl=new Ge(this,()=>this.filterOpen,t=>this.filterOpen=t),this.paged=window.matchMedia(se).matches,this.cardPage=1,this.pagedMq=window.matchMedia(se),this.onPaged=()=>{this.paged=this.pagedMq.matches,this.resetFit()},this.cardH=new Map,this.fitObserver=null,this.fitBox=null,this.pageCount=1,this.pageKey="",this.pendingQ=null,this.seq=0,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.qTimer=0,this.toastTimer=0,this.offNames=null,this.onCardAction=t=>{const{item:s,action:n}=t.detail;if(n==="open")B(this.hrefOf(s.id),!1);else if(n==="full")B(I(s.id),!1);else if(n==="copy"){const a=`${location.origin}${location.pathname}${location.search}${I(s.id)}`;navigator.clipboard?.writeText(a).then(()=>this.say(z("linkCopied"))).catch(()=>this.say(a))}},this.closeDrawer=()=>this.isConnected&&B(this.plainHref(),!1)}connectedCallback(){super.connectedCallback(),le(this),this.phoneMq.addEventListener("change",this.onPhone),this.pagedMq.addEventListener("change",this.onPaged),this.offNames=Le(()=>this.requestUpdate()),this.live.start(),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),this.pagedMq.removeEventListener("change",this.onPaged),this.fitObserver?.disconnect(),this.fitObserver=null,this.fitBox=null,this.offNames?.(),this.live.stop(),window.clearTimeout(this.qTimer),window.clearTimeout(this.toastTimer)}updated(){je(this.renderRoot,this.phone),this.watchFit()}watchFit(){const t=this.fitTarget();t!==this.fitBox&&(this.fitObserver?.disconnect(),this.fitObserver=null,this.fitBox=t,t&&typeof ResizeObserver<"u"&&(this.fitObserver=new ResizeObserver(()=>this.measureFit()),this.fitObserver.observe(t))),t&&this.measureFit()}noteCardHeights(t){let s=!1;for(const n of t){const a=n.item?.id;a&&n.offsetHeight>(this.cardH.get(a)??0)&&(this.cardH.set(a,n.offsetHeight),s=!0)}return s}pageAt(){return Math.min(Math.max(1,this.cardPage),this.pageCount)}syncSearch(t){(this.pendingQ===null||t!==this.pendingQ.trim())&&(this.q=t,this.pendingQ=null)}firstPageOn(t){t!==this.pageKey&&(this.pageKey=t,this.cardPage=1)}async boot(){try{const t=await Ke().module();if(this.module=t,He(t.name),!t.enabled){this.screen="off";return}await this.loadMeta(),this.reloadIfNeeded(!0)}catch(t){this.fail(t)}}fail(t){t instanceof q&&t.status===403?this.screen="forbidden":t instanceof q&&t.status===404&&t.body.code==="feature_disabled"?this.screen="off":(this.failed=qe(t),this.screen="error")}say(t,s="ok"){this.toast={text:t,tone:s},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,s==="bad"?7e3:3500)}onSearch(t){this.q=t,this.pendingQ=t,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>this.searchTo(t),300)}detailMode(){return this.module?.ui.detail??"drawer_fullscreen"}hrefOf(t,s=!1){if(this.detailMode()==="fullscreen")return I(t);const n=this.openHref(t);return s?`${n}${n.includes("?")?"&":"?"}view=timeline`:n}stateBox(t,s,n,a){return c`<div class="statebox glass" role="status" data-tickets-state=${n}><span class="ring">${y(t)}</span><b>${s}</b>${a??w}</div>`}toastView(){return this.toast?c`<div class=${`banner flt ${this.toast.tone==="bad"?"bad":"info"}`} role="status" data-tickets-toast>${y(this.toast.tone==="bad"?"warning":"check")}<div>${this.toast.text}</div></div>`:w}}g([k({attribute:!1})],v.prototype,"route");g([m()],v.prototype,"module");g([m()],v.prototype,"meta");g([m()],v.prototype,"screen");g([m()],v.prototype,"failed");g([m()],v.prototype,"phone");g([m()],v.prototype,"drawerUsed");g([m()],v.prototype,"toast");g([m()],v.prototype,"now");g([m()],v.prototype,"q");g([m()],v.prototype,"filterOpen");g([m()],v.prototype,"filters");g([m()],v.prototype,"paged");g([m()],v.prototype,"cardPage");export{ht as N,v as T,It as a,Dt as b,Ut as c,et as d,Kt as e,jt as f,Rt as g,Ht as h,Wt as i,pe as j,dt as k,Vt as l,Ft as m,Bt as n,qt as o,Nt as p,At as r,Gt as s,Lt as t,B as w};
