import{b as de,s as Q,S as ue,a as pe,w as fe,o as he,m as we}from"./ticket-detail-D-f_NIpK.js";import{E as V,U as ve,w as ge,F as g,G as Z,a as J,dh as be,A as h,e as c,H as ee,o9 as me,nZ as te,p as k,C as ye,D as xe,oa as ke,S as $e,b as _e,t as m,ob as ze,q as C,i as Ce,a8 as Se,g as D,aC as Me,bW as Oe,a7 as q,j as A,oc as x,al as Le,nU as Ee,od as j}from"./index-Cx0qJkOE.js";import{l as o}from"./list-text-DcuV1CFx.js";import{a as Pe,w as Ve}from"./board-model-1MGxcq9R.js";import{p as F}from"./list-toolbar-DBWBll8_.js";const De=V`
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
`,ut=V`
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
`,pt=V`
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
`,Fe={coin:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2M12 6.5V8m0 8v1.5"/>',hand:'<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-.5V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.6-2.2L4 14.5a1.6 1.6 0 0 1 2.4-2L8 14"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',sliders:'<path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1"/><circle cx="16" cy="6" r="1.8"/><circle cx="10" cy="12" r="1.8"/><circle cx="18" cy="18" r="1.8"/>',cardsView:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',tableView:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M10 5v14"/>',boardView:'<rect x="3.5" y="4" width="4.5" height="14" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="9" rx="1.5"/><rect x="16" y="4" width="4.5" height="11" rx="1.5"/>'};function M(e,t=""){return ge`<svg class=${t?`ic ${t}`:"ic"} viewBox="0 0 24 24" aria-hidden="true">${ve(Fe[e])}</svg>`}const E=6e4,S=60*E,H=24*S,G=["closed","cancelled"];function ne(e,t=new Date){const n=Date.parse(e.created_at);if(Number.isNaN(n))return null;let s=t.getTime();if(G.includes(e.status)){const i=Date.parse(e.closed_at??e.last_activity_at??"");s=Number.isNaN(i)?t.getTime():i}return Math.max(0,s-n)}function se(e){const t=Math.max(0,e);if(t<E)return o("elLessMinute");if(t<S)return o("elMin",{m:Math.floor(t/E)});if(t<H){const r=Math.floor(t/S),a=Math.floor(t%S/E);return a?o("elHourMin",{h:r,m:a}):o("elHour",{h:r})}const n=Math.floor(t/H),s=Math.floor(t%H/S),i=o(n===1?"elDayOne":"elDays",{d:n});return s?`${i} ${o("elHour",{h:s})}`:i}function He(e,t=new Date){const n=ne(e,t);if(n===null)return null;const s=se(n),i=G.includes(e.status),r=i?o(e.status==="cancelled"?"elCancelled":"elHandled",{dur:s}):o("elOpen",{dur:s}),a=i?null:de({status:e.status,sla:e.sla},t).badge;return{text:r,dur:s,frozen:i,tone:a?.tone??""}}function ft(e,t=new Date){let n=-1;for(const s of e){if(G.includes(s.status))continue;const i=ne(s,t);i!==null&&i>n&&(n=i)}return n<0?"":o("elOldest",{dur:se(n)})}var Ie=Object.defineProperty,Ne=Object.getOwnPropertyDescriptor,T=(e,t,n,s)=>{for(var i=s>1?void 0:s?Ne(t,n):t,r=e.length-1,a;r>=0;r--)(a=e[r])&&(i=(s?a(t,n,i):a(i))||i);return s&&i&&Ie(t,n,i),i};let O=class extends J{constructor(){super(...arguments),this.now=new Date,this.off=null}connectedCallback(){super.connectedCallback(),this.now=new Date;const e=be(t=>this.now=t);this.off=()=>{e()}}disconnectedCallback(){super.disconnectedCallback(),this.off?.(),this.off=null}render(){const e=this.item?He(this.item,this.now):null;return e?c`<span class=${e.tone} data-elapsed=${e.frozen?"frozen":"open"} title=${o("elTitle")}>${e.text}</span>`:h}};O.styles=V`
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
  `;T([g({attribute:!1})],O.prototype,"item",2);T([Z()],O.prototype,"now",2);O=T([ee("ticket-elapsed")],O);const Ae=3,Re=["closed","cancelled"],L=e=>!Re.includes(e.status);function ht(e,t){if(e.view==="limited")return"requester";if(e.manager||e.can?.manage)return"manager";const n=e.department?t?.departments.find(s=>s.id===e.department?.id):void 0;return n?.my_role==="manager"||t?.can.all_departments&&t.can.manage?"manager":n?.my_role==="member"?"handler":t?.can.manage?"manager":"requester"}function Ge(e,t){const n=[];e.priority&&n.push({key:"priority",text:e.priority.name,tone:te(e.priority)}),e.department&&n.push({key:"department",text:e.department.name,tone:""});const s=t==="manager"||t==="approver";return s&&e.cost?.status==="submitted"&&e.cost.can_decide!==!1&&L(e)?n.push({key:"cost",text:o("lcCostMine"),tone:"warn",icon:"coin"}):s&&e.stuck&&L(e)?n.push({key:"stuck",text:o("lcStuck"),tone:"bad",icon:"warning"}):e.reopen_count>0&&n.push({key:"reopened",text:k("reopenedChip"),tone:"warn",icon:"refresh"}),n.slice(0,Ae)}function U(e){const t=e.replace(/["'׳״.,()\-]/g," ").split(/\s+/).filter(Boolean),n=s=>[...s].filter(i=>/\p{L}/u.test(i));if(t.length>=2){const s=n(t[0])[0]??"",i=n(t[1])[0]??"";return`${s}${i}`.toUpperCase()}return n(t[0]??"").slice(0,2).join("").toUpperCase()}function Te(e){const t=[];if(e.assignee?.name){const n=e.assignee.kind==="contact";t.push({ini:U(e.assignee.name),name:e.assignee.name,kind:n?"ext":"int",label:o(n?"lcWhoVendor":"lcWhoStaff",{name:e.assignee.name})})}return e.owner?.name&&t.push({ini:U(e.owner.name),name:e.owner.name,kind:"int",label:o("lcWhoOwner",{name:e.owner.name})}),t.filter(n=>n.ini).slice(0,2)}function Be(e,t){if(!L(e))return null;const n=fe(e,t);if(n){const s=n.key==="stuck"&&(e.stuck?.level??0)>=2;return{key:n.key,text:n.text,tone:s?"bad":n.tone,icon:"warning"}}if(e.group==="waiting"){const s=Ve(e.waiting_reason);if(s)return{key:"wait",text:s,tone:"warn",icon:"user"}}return null}function qe(e,t){const n=t.now??new Date;let s=Q(e,t.role,n);if(t.board&&e.status==="done"&&e.auto_close_at){const a=Pe(e.auto_close_at);a&&s.length+3+a.length<=ue&&(s=`${s} · ${a}`)}const i=t.board?Be(e,t.role):null,r=me(e,n,{omitUnassigned:!e.assignee&&(e.status==="new"||/שיוך|assign/i.test(s))});return{sentence:s,chip:pe(e),chips:i?[]:Ge(e,t.role),warning:i,avatars:Te(e),run:{text:r.text,tone:r.tone},urgent:te(e.priority)==="bad"&&L(e),stuck:!!e.stuck&&L(e)}}function wt(e,t,n,s){const{sla:i,cost:r,...a}=e;return Q({...a,cost:e.cost_status&&e.cost_status!=="not_required"?{status:e.cost_status,can_decide:s}:null},t,n)}var je=Object.defineProperty,Ue=Object.getOwnPropertyDescriptor,v=(e,t,n,s)=>{for(var i=s>1?void 0:s?Ue(t,n):t,r=e.length-1,a;r>=0;r--)(a=e[r])&&(i=(s?a(t,n,i):a(i))||i);return s&&i&&je(t,n,i),i};let w=class extends J{constructor(){super(...arguments),this.bubbleSkin=new $e(this),this.href="",this.timelineHref="",this.fullScreen=!0,this.now=new Date,this.role="manager",this.board=!1,this.picked=!1,this.skeleton=!1,this.menu=!1,this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&this.setMenu(!1)},this.onKey=e=>{this.menu&&e.key==="Escape"&&this.setMenu(!1)},this.placeMenu=()=>{if(!this.menu)return;const e=this.renderRoot.querySelector(".pop.ov"),t=this.renderRoot.querySelector("[data-card-menu]");e&&t&&he(e,t)},this.onMenuKey=e=>{e.key==="Escape"?(e.stopPropagation(),this.setMenu(!1),this.renderRoot.querySelector("[data-card-menu]")?.focus()):we(e,e.currentTarget)}}connectedCallback(){super.connectedCallback(),_e(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey),window.addEventListener("resize",this.placeMenu),window.addEventListener("scroll",this.placeMenu,!0)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey),window.removeEventListener("resize",this.placeMenu),window.removeEventListener("scroll",this.placeMenu,!0)}setMenu(e){this.menu=e,this.toggleAttribute("data-menu",e),e&&this.updateComplete.then(()=>this.renderRoot.querySelector(".pop button")?.focus())}updated(){this.placeMenu()}act(e){this.setMenu(!1),this.dispatchEvent(new CustomEvent("card-action",{detail:{item:this.item,action:e},bubbles:!0,composed:!0}))}menuItems(){const e=(t,n,s)=>c`<button type="button" role="menuitem" data-card-action=${t} @click=${()=>this.act(t)}>${m(n)}${s}</button>`;return c`<div class="pop ov" popover="manual" role="menu" aria-label=${k("actions")} @keydown=${this.onMenuKey}>
      ${e("open","eye",k("open"))}
      ${this.fullScreen?e("full","expand",k("fullScreen")):h}
      ${e("copy","link",k("copyLink"))}
    </div>`}renderSkeleton(){const e=t=>c`<span class="skl ln" style=${`inline-size:${t}`}></span>`;return c`<article class="tcard sk" aria-hidden="true" data-card-skeleton>
      <header>
        <div class="ttl">
          <h3>${e("68%")}</h3>
          <div class="where">${m("layers")}${e("42%")}</div>
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
    </article>`}render(){if(this.skeleton)return this.renderSkeleton();const e=this.item;if(!e)return h;const t=ze(e),n=qe(e,{role:this.role,now:this.now,board:this.board}),s=n.chip.tone,i=["closed","cancelled"].includes(e.status);return c`<article class=${`tcard${n.urgent?" urgent":""}${n.stuck?" stuck":""}${i?" closed":""}`} data-ticket=${e.id} data-status=${e.status} aria-label=${e.title}>
      <header>
        <div class="ttl">
          <h3 dir="auto" data-card-title><a class="name" href=${this.href||"#"} title=${e.title} data-card-open>${C(e.title)}</a></h3>
          ${t.strong||t.rest?c`<div class="where">${m("layers")}${t.strong?c`<b>${C(t.strong)}</b>`:h}${t.rest?c`<span>${C(t.rest)}</span>`:h}</div>`:h}
        </div>
        <div class="ctl">
          <span class=${`chip ${s}`} data-card-status aria-label=${n.chip.text}><i class=${`dot ${s==="ok"?"ok":s==="info"?"run":""}`}></i>${n.chip.label}${n.chip.sub?c`<span class="subst"> · ${n.chip.sub}</span>`:h}</span>
          <button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${k("moreOf",{title:e.title})} data-card-menu @click=${()=>this.setMenu(!this.menu)}>${m("dots")}</button>
        </div>
        ${this.menu?this.menuItems():h}
      </header>
      <p class="stat" data-card-sentence title=${n.sentence}>${n.sentence}</p>
      ${n.warning?c`<div class=${`cwarn ${n.warning.tone}`} data-card-warning=${n.warning.key} role="note">${n.warning.icon==="user"?M("hand"):m("warning")}<span>${n.warning.text}</span></div>`:c`<div class="chips" data-card-chips>
            ${n.chips.map(r=>c`<span class=${`chip ${r.tone}`} data-chip=${r.key}>${r.key==="priority"?c`<i class=${`dot ${r.tone==="bad"?"bad":r.tone==="info"?"run":""}`}></i>`:r.icon==="coin"?M("coin"):r.icon==="warning"?m("warning"):r.icon==="refresh"?m("refresh"):h}${r.key==="department"?C(r.text):r.text}</span>`)}
          </div>`}
      <footer>
        <span class="num">#${e.number}</span>
        <span class="run" data-card-run><i class=${`dot ${n.run.tone}`}></i><span>${n.run.text}</span></span>
        <ticket-elapsed .item=${e} data-card-elapsed></ticket-elapsed>
        ${this.timelineHref?c`<a class="tl" href=${this.timelineHref} data-card-timeline>${m("clock")}${k("timelineLink")}</a>`:h}
        ${n.avatars.length?c`<span class="pair" data-card-pair>${n.avatars.map(r=>c`<span class=${`av ${r.kind}`} title=${r.label} role="img" aria-label=${r.label}>${r.ini}</span>`)}</span>`:h}
      </footer>
    </article>`}};w.styles=[ye,...xe,ke,De];v([g({attribute:!1})],w.prototype,"item",2);v([g()],w.prototype,"href",2);v([g()],w.prototype,"timelineHref",2);v([g({type:Boolean})],w.prototype,"fullScreen",2);v([g({attribute:!1})],w.prototype,"now",2);v([g()],w.prototype,"role",2);v([g({type:Boolean})],w.prototype,"board",2);v([g({type:Boolean,reflect:!0,attribute:"data-picked"})],w.prototype,"picked",2);v([g({type:Boolean,reflect:!0})],w.prototype,"skeleton",2);v([Z()],w.prototype,"menu",2);w=v([ee("ticket-card")],w);const y="tickets",K=encodeURIComponent,I=e=>{const t=new URLSearchParams;for(const[s,i]of Object.entries(e))i!==""&&t.set(s,i);const n=t.toString();return n?`?${n}`:""};async function W(e){const t=await fetch(Le(e),{credentials:"same-origin"});if(!t.ok){let n={};try{n=await t.json()}catch{n={}}throw new A(t.status,{code:n.code??`http_${t.status}`,user_message:n.user_message??"",retryable:n.retryable??!1,correlation_id:n.correlation_id??"",details:n.details??{}})}return{blob:await t.blob(),headers:t.headers}}const Ke={page:e=>D(`${y}/table${I(e)}`),bulk:e=>q(`${y}/bulk`,e),exportCsv:async e=>{const{blob:t,headers:n}=await W(`${y}/export.csv${I(e)}`),s=n.get("X-Export-Rows"),i=/filename="?([^";]+)"?/.exec(n.get("Content-Disposition")??"")?.[1];return{blob:t,rows:s===null?null:Number(s),filename:i||"export.csv"}},monthlyReport:async e=>{const{blob:t,headers:n}=await W(`${y}/reports/monthly.csv${I(e)}`),s=n.get("X-Export-Rows"),i=/filename="?([^";]+)"?/.exec(n.get("Content-Disposition")??"")?.[1];return{blob:t,rows:s===null?null:Number(s),filename:i||"monthly.csv"}},views:()=>D(`${y}/views`),createView:(e,t)=>q(`${y}/views`,{name:e,view:t}),patchView:(e,t)=>Oe(`${y}/views/${K(e)}`,t),deleteView:e=>Me(`${y}/views/${K(e)}`,{method:"DELETE"}),prefs:async()=>(await D("me/prefs")).prefs["tickets.board"]??{},savePrefs:async e=>(await Se("me/prefs",{"tickets.board":e})).prefs["tickets.board"]??{}},We=["new","assigned","acknowledged","in_progress","waiting_part","done","returned","closed","cancelled"],Xe={open:["new","assigned","acknowledged","in_progress","waiting_part","done","returned"],unassigned:["new","returned"],handling:["assigned","acknowledged","in_progress","waiting_part"],done:["done"],closed:["closed","cancelled"]},z=[];let N={},Ye=0;function X(e,t){switch(t){case"number":return e.number;case"title":return e.title;case"department":return e.department?.name??"";case"priority":return e.priority?.rank??99;case"status":return We.indexOf(e.status);case"assignee":return e.assignee?.name??"";case"place":return e.place_text;case"device":return e.device_name;case"created":return e.created_at;case"activity":return e.last_activity_at;case"stuck":return e.stuck?1+e.stuck.level:0;case"sla":return e.sla?.due_at??"9999";case"cost":return e.cost?.total_minor??-1;case"cost_status":return e.cost_status??""}}const Qe={async page(e){const t=await x.list({scope:e.scope||"visible",status:"all",limit:200}),n=!e.status||e.status==="all"?null:Xe[e.status]??e.status.split(","),s=e.department?e.department.split(","):[],i=e.priority?e.priority.split(","):[],r=(e.q??"").trim(),a=[];for(const d of t.items){if(n&&!n.includes(d.status)||s.length&&!s.includes(d.department?.id??"")||i.length&&!i.includes(d.priority?.key??"")||e.assignee==="none"&&d.assignee||e.assignee==="me"&&d.assignee?.id!=="demo"||e.assignee?.includes(":")&&e.assignee!==`${d.assignee?.kind}:${d.assignee?.id}`||e.waiting==="manager"&&d.waiting_on!=="manager"||r&&!d.title.includes(r)&&String(d.number)!==r.replace(/^#/,""))continue;const u=await x.get(d.id),{excerpt:$,...p}=d;if(e.cost_status&&!e.cost_status.split(",").includes(u.cost?.status??""))continue;const l=u.cost?.total_minor!=null&&u.cost.currency?{total_minor:u.cost.total_minor,currency:u.cost.currency,approved:u.cost.status==="approved"||u.cost.status==="paid"}:null;a.push({...p,stuck:null,sla:null,transitions:u.transitions,can:{manage:u.can.manage,assign:u.can.assign,assign_external:!1},cost:l,cost_status:u.cost?.status??null})}const _=(e.sort||"activity:desc").split(",").map(d=>d.split(":"));return a.sort((d,u)=>{for(const[$,p]of _){const l=X(d,$),b=X(u,$);if(l!==b)return(l<b?-1:1)*(p==="desc"?-1:1)}return d.id<u.id?-1:1}),{items:a,next_cursor:null,sort:e.sort||"activity:desc",limit:Number(e.limit||50)}},async bulk(e){const t=[];for(const s of e.items){let i="ok",r;try{const a=await x.get(s.id);if(r=a.number,a.revision!==s.revision)i="stale";else if(e.action==="close")await x.status(s.id,{to:"closed",note:e.params.note,revision:s.revision});else if(e.action==="assign"&&e.params.assignee)await x.assign(s.id,{assignee:e.params.assignee,revision:s.revision});else if(e.action==="priority"){const d=(await x.meta()).departments.find(u=>u.id===a.department?.id)?.priorities.find(u=>u.key===e.params.priority_key);!d||d.id===a.priority?.id?i="unchanged":await x.patch(s.id,{priority_id:d.id,revision:s.revision})}else e.action==="remind"&&!a.assignee&&(i="invalid_transition")}catch(a){i=a instanceof A&&a.status===409?"invalid_transition":"not_found"}t.push({id:s.id,number:r,result:i})}const n={};for(const s of t)n[s.result]=(n[s.result]??0)+1;return{action:e.action,total:e.items.length,done:n.ok??0,counts:n,results:t}},async exportCsv(){return{blob:new Blob(["\uFEFF"],{type:"text/csv"}),rows:0,filename:"export.csv"}},async monthlyReport(){return{blob:new Blob(["\uFEFF"],{type:"text/csv"}),rows:0,filename:"monthly.csv"}},async views(){return{items:z.map(e=>({...e})),max:20}},async createView(e,t){const n=new Date().toISOString(),s={id:`v${++Ye}`,name:e,view:t,created_at:n,updated_at:n};return z.push(s),{...s}},async patchView(e,t){const n=z.find(s=>s.id===e);if(!n)throw new A(404,{code:"view_not_found",user_message:"",retryable:!1,correlation_id:"",details:{}});return Object.assign(n,t.name?{name:t.name}:{},t.view?{view:t.view}:{}),{...n}},async deleteView(e){const t=z.findIndex(n=>n.id===e);t>=0&&z.splice(t,1)},async prefs(){return{...N}},async savePrefs(e){return N={...e},{...N}}};function ae(){return Ce()?Ke:Qe}let P=null;function Ze(){return P??=ae().prefs().catch(()=>({})),P}async function vt(e){const n={...await Ze(),...e};for(const s of Object.keys(n))(n[s]===void 0||n[s]===null)&&delete n[s];P=Promise.resolve(n);try{const s=await ae().savePrefs(n);return P=Promise.resolve(s),s}catch{return n}}function gt(e,t){const n=[];let s=[],i=0,r=null,a=null;const _=new Set,d=()=>{s.length&&n.push(s),s=[],i=0,r=null,a=null},u=(p,l,b)=>{let f=0;return!r||r.id!==p.id?(f+=(s.length?t.secGap:0)+(p.head?t.headH+(l?t.inGap:0):0),l&&(f+=(l.sub?t.subH+t.blkGap:0)+(l.pad??0))):l&&(!a||a.key!==l.key)?f+=t.inGap+(l.sub?t.subH+t.blkGap:0)+(l.pad??0):l&&(f+=l.gap),f+b},$=(p,l,b,f)=>{s.length&&i+u(p,l,f)>t.room+.5&&d(),i+=u(p,l,f),(!r||r.id!==p.id)&&(r={id:p.id,groups:[],cont:_.has(p.id)},_.add(p.id),s.push(r),a=null),l&&((!a||a.key!==l.key)&&(a={key:l.key,items:[]},r.groups.push(a)),a.items.push(...b))};for(const p of e){if(!p.groups.length){$(p,null,[],0);continue}for(const l of p.groups){const b=Math.max(1,l.cols);for(let f=0;f<l.items.length;f+=b){const B=l.items.slice(f,f+b),le=l.heightOf?Math.max(0,...B.map(ce=>l.heightOf(ce)??l.rowH)):l.rowH;$(p,l,B,le)}}}return d(),n}function bt(e){if(!e)return 1;const t=getComputedStyle(e).gridTemplateColumns;return Math.max(1,t&&t!=="none"?t.split(" ").filter(Boolean).length:1)}function mt(e){return e&&parseFloat(getComputedStyle(e).rowGap)||0}const yt="(min-width: 1024px)",Je=[{id:"cards",icon:"cardsView",label:"lsView_cards",managerOnly:!1},{id:"table",icon:"tableView",label:"lsView_table",managerOnly:!1},{id:"board",icon:"boardView",label:"lsView_board",managerOnly:!0},{id:"calendar",icon:"calendar",label:"lsView_calendar",managerOnly:!1}];function et(e){return Je.filter(t=>!t.managerOnly||e)}function xt(e,t,n){return c`<div class="seg sm vsw" role="radiogroup" aria-label=${o("lsViewsGroup")} data-view-switch>
    ${et(t).map(s=>c`<button type="button" role="radio" aria-checked=${String(e===s.id)} aria-label=${o(s.label)} title=${o(s.label)} data-view=${s.id}
      @click=${()=>n(s.id)}>${M(s.icon)}${e===s.id?c`<span class="lbl">${o(s.label)}</span>`:""}</button>`)}
  </div>`}const R="sw.tickets.list.calendar";function kt(){try{return sessionStorage.getItem(R)==="1"}catch{return!1}}function $t(e){try{e?sessionStorage.setItem(R,"1"):sessionStorage.removeItem(R)}catch{}}const tt=["stuck","waiting","cost"],_t={priority:[],handler:"",flags:[]};function nt(e){return e.priority.length+(e.handler?1:0)+e.flags.length}function st(e,t){switch(t){case"stuck":return!!e.stuck;case"waiting":return e.waiting_on==="manager"&&!["closed","cancelled"].includes(e.status);case"cost":return e.cost?.status==="submitted"}}function at(e,t){return t.priority.length&&!(e.priority&&t.priority.includes(e.priority.key))||(t.handler==="none"?j(e.assignee):t.handler&&j(e.assignee)!==t.handler)?!1:t.flags.every(n=>st(e,n))}function zt(e,t){return nt(t)?e.filter(n=>at(n,t)):[...e]}function rt(e){const t=n=>n==="waiting"?!0:n==="stuck"?e.some(s=>"stuck"in s):e.some(s=>!!s.cost);return tt.filter(t)}function re(e){const t=new Map;for(const n of e)n.priority&&!t.has(n.priority.key)&&t.set(n.priority.key,{key:n.priority.key,name:n.priority.name,rank:n.priority.rank});return[...t.values()].sort((n,s)=>n.rank-s.rank).map(({key:n,name:s})=>({key:n,name:s}))}function ie(e){return Ee(e).map(({key:t,name:n})=>({key:t,name:n}))}function Y(e,t){return e.includes(t)?e.filter(n=>n!==t):[...e,t]}const oe={stuck:"lfStuck",waiting:"lfWaiting",cost:"lfCost"};function Ct(e,t,n){const s=re(e),i=ie(e),r=rt(e);return c`<div class="frow" id="filter-row" role="group" aria-label=${o("lfGroup")} data-filter-row>
    ${s.length?F(o("lfPriority"),c`<div class="fchips">
      ${s.map(a=>c`<button type="button" class="rc sm" aria-pressed=${String(t.priority.includes(a.key))} data-f-priority=${a.key} @click=${()=>n({...t,priority:Y(t.priority,a.key)})}>${C(a.name)}</button>`)}
    </div>`,"priority"):h}
    ${F(o("lfHandler"),c`<label class="vh" for="f-handler">${o("lfHandler")}</label>
      <select id="f-handler" data-f-handler .value=${t.handler} @change=${a=>n({...t,handler:a.target.value})}>
        <option value="" ?selected=${t.handler===""}>${o("lfAnyHandler")}</option>
        <option value="none" ?selected=${t.handler==="none"}>${o("lfNoHandler")}</option>
        ${i.map(a=>c`<option value=${a.key} ?selected=${t.handler===a.key}>${a.name}</option>`)}
      </select>`,"handler")}
    ${r.length?F(o("tbFlags"),c`<div class="fchips">
      ${r.map(a=>c`<button type="button" class="rc sm" aria-pressed=${String(t.flags.includes(a))} data-f-flag=${a} @click=${()=>n({...t,flags:Y(t.flags,a)})}>${a==="stuck"?m("warning"):M(a==="cost"?"coin":"hand")}${o(oe[a])}</button>`)}
    </div>`,"flags"):h}
  </div>`}function St(e,t,n){const s=[],i=re(e);for(const r of t.priority)s.push({key:`priority:${r}`,label:`${o("lfPriority")}: ${i.find(a=>a.key===r)?.name??r}`,remove:()=>n({...t,priority:t.priority.filter(a=>a!==r)})});if(t.handler){const r=t.handler==="none"?o("lfNoHandler"):ie(e).find(a=>a.key===t.handler)?.name??o("lfHandler");s.push({key:"handler",label:t.handler==="none"?r:`${o("lfHandler")}: ${r}`,remove:()=>n({...t,handler:""})})}for(const r of t.flags)s.push({key:`flag:${r}`,label:o(oe[r]),remove:()=>n({...t,flags:t.flags.filter(a=>a!==r)})});return s}export{_t as N,yt as P,ht as a,Ze as b,kt as c,$t as d,mt as e,St as f,bt as g,Ct as h,zt as i,ut as j,Te as k,xt as l,pt as m,ft as o,gt as p,wt as r,vt as s,ae as t};
//# sourceMappingURL=list-filter-row-CQk3CZHQ.js.map
