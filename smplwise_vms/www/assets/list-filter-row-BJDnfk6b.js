const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{b as de,s as Q,S as ue,c as pe,a as fe,w as he,o as we,m as ve}from"./ticket-detail-CNdFNj50.js";import{i as P,ag as ge,_ as me,n as b,r as J,a as Z,dF as be,p as w,q as c,x as ee,p7 as ye,gm as te,a0 as k,a4 as xe,S as ke,p8 as $e,X as z,K as _e,av as ze,L as V,a$ as Se,ch as Ce,au as B,R as G,dD as Me,ac as Oe}from"./index-C5kZ9jiu.js";import{a as Le}from"./automations-glass-B-MfZHsT.js";import{a as Ee}from"./automations-demo-CVgZlSKD.js";import{t as y}from"./icons-Cmf7CqDT.js";import{k as Pe,g as Ve,l as q}from"./map-text-Brg0AnNJ.js";import{l as o}from"./list-text-CAHgZKWf.js";import{a as De,w as Fe}from"./board-model-mWgRm0aP.js";import{p as D}from"./list-toolbar-DshpdKih.js";const He=P`
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
   sourceMappingURL=[^*]**/ the sentence IS the status: the largest line of the card after the title, two lines at most (the full text is the title attribute) */
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
   sourceMappingURL=[^*]**/ the board card's one ranked warning line, instead of its chips row */
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
   sourceMappingURL=[^*]**/ UXFIX-A11Y-295: the skeleton card - shimmer bars sit IN the text lines, so every line keeps the height of the text it stands for */
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
`,gt=P`
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
   sourceMappingURL=[^*]**/ a count on a department chip is a small badge, never read as part of the name */
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
`,mt=P`
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
   sourceMappingURL=[^*]**/ POLISH-CONTROL-297: the "today" entry answers the press (transform only, token durations - zero under reduced motion); hover is for
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
`,Ie={coin:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2M12 6.5V8m0 8v1.5"/>',hand:'<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-.5V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.6-2.2L4 14.5a1.6 1.6 0 0 1 2.4-2L8 14"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',sliders:'<path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1"/><circle cx="16" cy="6" r="1.8"/><circle cx="10" cy="12" r="1.8"/><circle cx="18" cy="18" r="1.8"/>',cardsView:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',tableView:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M10 5v14"/>',boardView:'<rect x="3.5" y="4" width="4.5" height="14" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="9" rx="1.5"/><rect x="16" y="4" width="4.5" height="11" rx="1.5"/>'};function C(e,t=""){return me`<svg class=${t?`ic ${t}`:"ic"} viewBox="0 0 24 24" aria-hidden="true">${ge(Ie[e])}</svg>`}const L=6e4,S=60*L,F=24*S,R=["closed","cancelled"];function ne(e,t=new Date){const n=Date.parse(e.created_at);if(Number.isNaN(n))return null;let s=t.getTime();if(R.includes(e.status)){const a=Date.parse(e.closed_at??e.last_activity_at??"");s=Number.isNaN(a)?t.getTime():a}return Math.max(0,s-n)}function se(e){const t=Math.max(0,e);if(t<L)return o("elLessMinute");if(t<S)return o("elMin",{m:Math.floor(t/L)});if(t<F){const r=Math.floor(t/S),i=Math.floor(t%S/L);return i?o("elHourMin",{h:r,m:i}):o("elHour",{h:r})}const n=Math.floor(t/F),s=Math.floor(t%F/S),a=o(n===1?"elDayOne":"elDays",{d:n});return s?`${a} ${o("elHour",{h:s})}`:a}function Ae(e,t=new Date){const n=ne(e,t);if(n===null)return null;const s=se(n),a=R.includes(e.status),r=a?o(e.status==="cancelled"?"elCancelled":"elHandled",{dur:s}):o("elOpen",{dur:s}),i=a?null:de({status:e.status,sla:e.sla},t).badge;return{text:r,dur:s,frozen:a,tone:i?.tone??""}}function bt(e,t=new Date){let n=-1;for(const s of e){if(R.includes(s.status))continue;const a=ne(s,t);a!==null&&a>n&&(n=a)}return n<0?"":o("elOldest",{dur:se(n)})}var Re=Object.defineProperty,Ne=Object.getOwnPropertyDescriptor,N=(e,t,n,s)=>{for(var a=s>1?void 0:s?Ne(t,n):t,r=e.length-1,i;r>=0;r--)(i=e[r])&&(a=(s?i(t,n,a):i(a))||a);return s&&a&&Re(t,n,a),a};let M=class extends Z{constructor(){super(...arguments),this.now=new Date,this.off=null}connectedCallback(){super.connectedCallback(),this.now=new Date;const e=be(t=>this.now=t);this.off=()=>{e()}}disconnectedCallback(){super.disconnectedCallback(),this.off?.(),this.off=null}render(){const e=this.item?Ae(this.item,this.now):null;return e?c`<span class=${e.tone} data-elapsed=${e.frozen?"frozen":"open"} title=${o("elTitle")}>${e.text}</span>`:w}};M.styles=P`
    :host {
      display: inline-flex;
      align-items: center;
      min-inline-size: 0;
    }
     sourceMappingURL=[^*]**/ a narrow host (the calendar's week columns) sets --sw-elapsed-wrap: normal and its own --sw-elapsed-fs */
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
  `;N([b({attribute:!1})],M.prototype,"item",2);N([J()],M.prototype,"now",2);M=N([ee("ticket-elapsed")],M);const Te=3,Be=["closed","cancelled"],O=e=>!Be.includes(e.status);function yt(e,t){if(e.view==="limited")return"requester";if(e.manager||e.can?.manage)return"manager";const n=e.department?t?.departments.find(s=>s.id===e.department?.id):void 0;return n?.my_role==="manager"||t?.can.all_departments&&t.can.manage?"manager":n?.my_role==="member"?"handler":t?.can.manage?"manager":"requester"}function Ge(e,t){const n=[];e.priority&&n.push({key:"priority",text:e.priority.name,tone:te(e.priority)}),e.department&&n.push({key:"department",text:e.department.name,tone:""});const s=t==="manager"||t==="approver";return s&&e.cost?.status==="submitted"&&e.cost.can_decide!==!1&&O(e)?n.push({key:"cost",text:o("lcCostMine"),tone:"warn",icon:"coin"}):s&&e.stuck&&O(e)?n.push({key:"stuck",text:o("lcStuck"),tone:"bad",icon:"warning"}):e.reopen_count>0&&n.push({key:"reopened",text:k("reopenedChip"),tone:"warn",icon:"refresh"}),n.slice(0,Te)}function K(e){const t=e.replace(/["'׳״.,()\-]/g," ").split(/\s+/).filter(Boolean),n=s=>[...s].filter(a=>/\p{L}/u.test(a));if(t.length>=2){const s=n(t[0])[0]??"",a=n(t[1])[0]??"";return`${s}${a}`.toUpperCase()}return n(t[0]??"").slice(0,2).join("").toUpperCase()}function qe(e){const t=[];if(e.assignee?.name){const n=e.assignee.kind==="contact";t.push({ini:K(e.assignee.name),name:e.assignee.name,kind:n?"ext":"int",label:o(n?"lcWhoVendor":"lcWhoStaff",{name:e.assignee.name})})}return e.owner?.name&&t.push({ini:K(e.owner.name),name:e.owner.name,kind:"int",label:o("lcWhoOwner",{name:e.owner.name})}),t.filter(n=>n.ini).slice(0,2)}function Ke(e,t){if(!O(e))return null;const n=he(e,t);if(n){const s=n.key==="stuck"&&(e.stuck?.level??0)>=2;return{key:n.key,text:n.text,tone:s?"bad":n.tone,icon:"warning"}}if(e.group==="waiting"){const s=Fe(e.waiting_reason);if(s)return{key:"wait",text:s,tone:"warn",icon:"user"}}return null}function je(e,t){const n=t.now??new Date;let s=Q(e,t.role,n);if(t.board&&e.status==="done"&&e.auto_close_at){const i=De(e.auto_close_at);i&&s.length+3+i.length<=ue&&(s=`${s} · ${i}`)}const a=t.board?Ke(e,t.role):null,r=ye(e,n,{omitUnassigned:!e.assignee&&(e.status==="new"||pe(e.status))});return{sentence:s,chip:fe(e),chips:a?[]:Ge(e,t.role),warning:a,avatars:qe(e),run:{text:r.text,tone:r.tone},urgent:te(e.priority)==="bad"&&O(e),stuck:!!e.stuck&&O(e)}}function xt(e,t,n,s){const{sla:a,cost:r,...i}=e;return Q({...i,cost:e.cost_status&&e.cost_status!=="not_required"?{status:e.cost_status,can_decide:s}:null},t,n)}var Ue=Object.defineProperty,We=Object.getOwnPropertyDescriptor,m=(e,t,n,s)=>{for(var a=s>1?void 0:s?We(t,n):t,r=e.length-1,i;r>=0;r--)(i=e[r])&&(a=(s?i(t,n,a):i(a))||a);return s&&a&&Ue(t,n,a),a};let v=class extends Z{constructor(){super(...arguments),this.bubbleSkin=new ke(this),this.href="",this.timelineHref="",this.fullScreen=!0,this.now=new Date,this.role="manager",this.board=!1,this.picked=!1,this.skeleton=!1,this.menu=!1,this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&this.setMenu(!1)},this.onKey=e=>{this.menu&&e.key==="Escape"&&this.setMenu(!1)},this.placeMenu=()=>{if(!this.menu)return;const e=this.renderRoot.querySelector(".pop.ov"),t=this.renderRoot.querySelector("[data-card-menu]");e&&t&&we(e,t)},this.onMenuKey=e=>{e.key==="Escape"?(e.stopPropagation(),this.setMenu(!1),this.renderRoot.querySelector("[data-card-menu]")?.focus()):ve(e,e.currentTarget)}}connectedCallback(){super.connectedCallback(),Ee(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey),window.addEventListener("resize",this.placeMenu),window.addEventListener("scroll",this.placeMenu,!0)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey),window.removeEventListener("resize",this.placeMenu),window.removeEventListener("scroll",this.placeMenu,!0)}setMenu(e){this.menu=e,this.toggleAttribute("data-menu",e),e&&this.updateComplete.then(()=>this.renderRoot.querySelector(".pop button")?.focus())}updated(){this.placeMenu()}act(e){this.setMenu(!1),this.dispatchEvent(new CustomEvent("card-action",{detail:{item:this.item,action:e},bubbles:!0,composed:!0}))}menuItems(){const e=(t,n,s)=>c`<button type="button" role="menuitem" data-card-action=${t} @click=${()=>this.act(t)}>${y(n)}${s}</button>`;return c`<div class="pop ov" popover="manual" role="menu" aria-label=${k("actions")} @keydown=${this.onMenuKey}>
      ${e("open","eye",k("open"))}
      ${this.fullScreen?e("full","expand",k("fullScreen")):w}
      ${e("copy","link",k("copyLink"))}
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
    </article>`}render(){if(this.skeleton)return this.renderSkeleton();const e=this.item;if(!e)return w;const t=$e(e),n=je(e,{role:this.role,now:this.now,board:this.board}),s=n.chip.tone,a=["closed","cancelled"].includes(e.status);return c`<article class=${`tcard${n.urgent?" urgent":""}${n.stuck?" stuck":""}${a?" closed":""}`} data-ticket=${e.id} data-status=${e.status} aria-label=${e.title}>
      <header>
        <div class="ttl">
          <h3 dir="auto" data-card-title><a class="name" href=${this.href||"#"} title=${e.title} data-card-open>${z(e.title)}</a></h3>
          ${t.strong||t.rest?c`<div class="where">${y("layers")}${t.strong?c`<b>${z(t.strong)}</b>`:w}${t.rest?c`<span>${z(t.rest)}</span>`:w}</div>`:w}
        </div>
        <div class="ctl">
          <span class=${`chip ${s}`} data-card-status aria-label=${n.chip.text}><i class=${`dot ${s==="ok"?"ok":s==="info"?"run":""}`}></i>${n.chip.label}${n.chip.sub?c`<span class="subst"> · ${n.chip.sub}</span>`:w}</span>
          <button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${k("moreOf",{title:e.title})} data-card-menu @click=${()=>this.setMenu(!this.menu)}>${y("dots")}</button>
        </div>
        ${this.menu?this.menuItems():w}
      </header>
      <p class="stat" data-card-sentence title=${n.sentence}>${n.sentence}</p>
      ${n.warning?c`<div class=${`cwarn ${n.warning.tone}`} data-card-warning=${n.warning.key} role="note">${n.warning.icon==="user"?C("hand"):y("warning")}<span>${n.warning.text}</span></div>`:c`<div class="chips" data-card-chips>
            ${n.chips.map(r=>c`<span class=${`chip ${r.tone}`} data-chip=${r.key}>${r.key==="priority"?c`<i class=${`dot ${r.tone==="bad"?"bad":r.tone==="info"?"run":""}`}></i>`:r.icon==="coin"?C("coin"):r.icon==="warning"?y("warning"):r.icon==="refresh"?y("refresh"):w}${r.key==="department"?z(r.text):r.text}</span>`)}
          </div>`}
      <footer>
        <span class="num">#${e.number}</span>
        <span class="run" data-card-run><i class=${`dot ${n.run.tone}`}></i><span>${n.run.text}</span></span>
        <ticket-elapsed .item=${e} data-card-elapsed></ticket-elapsed>
        ${this.timelineHref?c`<a class="tl" href=${this.timelineHref} data-card-timeline>${y("clock")}${k("timelineLink")}</a>`:w}
        ${n.avatars.length?c`<span class="pair" data-card-pair>${n.avatars.map(r=>c`<span class=${`av ${r.kind}`} title=${r.label} role="img" aria-label=${r.label}>${r.ini}</span>`)}</span>`:w}
      </footer>
    </article>`}};v.styles=[xe,...Le,Pe,He];m([b({attribute:!1})],v.prototype,"item",2);m([b()],v.prototype,"href",2);m([b()],v.prototype,"timelineHref",2);m([b({type:Boolean})],v.prototype,"fullScreen",2);m([b({attribute:!1})],v.prototype,"now",2);m([b()],v.prototype,"role",2);m([b({type:Boolean})],v.prototype,"board",2);m([b({type:Boolean,reflect:!0,attribute:"data-picked"})],v.prototype,"picked",2);m([b({type:Boolean,reflect:!0})],v.prototype,"skeleton",2);m([J()],v.prototype,"menu",2);v=m([ee("ticket-card")],v);const x="tickets",j=encodeURIComponent,H=e=>{const t=new URLSearchParams;for(const[s,a]of Object.entries(e))a!==""&&t.set(s,a);const n=t.toString();return n?`?${n}`:""},U=e=>Me(e),Xe={page:e=>V(`${x}/table${H(e)}`),bulk:e=>B(`${x}/bulk`,e),exportCsv:async e=>{const{blob:t,headers:n}=await U(`${x}/export.csv${H(e)}`),s=n.get("X-Export-Rows"),a=/filename="?([^";]+)"?/.exec(n.get("Content-Disposition")??"")?.[1];return{blob:t,rows:s===null?null:Number(s),filename:a||"export.csv"}},monthlyReport:async e=>{const{blob:t,headers:n}=await U(`${x}/reports/monthly.csv${H(e)}`),s=n.get("X-Export-Rows"),a=/filename="?([^";]+)"?/.exec(n.get("Content-Disposition")??"")?.[1];return{blob:t,rows:s===null?null:Number(s),filename:a||"monthly.csv"}},views:()=>V(`${x}/views`),createView:(e,t)=>B(`${x}/views`,{name:e,view:t}),patchView:(e,t)=>Ce(`${x}/views/${j(e)}`,t),deleteView:e=>Se(`${x}/views/${j(e)}`,{method:"DELETE"}),prefs:async()=>(await V("me/prefs")).prefs["tickets.board"]??{},savePrefs:async e=>(await ze("me/prefs",{"tickets.board":e})).prefs["tickets.board"]??{}},Ye=["new","assigned","acknowledged","in_progress","waiting_part","done","returned","closed","cancelled"],Qe={open:["new","assigned","acknowledged","in_progress","waiting_part","done","returned"],unassigned:["new","returned"],handling:["assigned","acknowledged","in_progress","waiting_part"],done:["done"],closed:["closed","cancelled"]},_=[];let I={},Je=0;function W(e,t){switch(t){case"number":return e.number;case"title":return e.title;case"department":return e.department?.name??"";case"priority":return e.priority?.rank??99;case"status":return Ye.indexOf(e.status);case"assignee":return e.assignee?.name??"";case"place":return e.place_text;case"device":return e.device_name;case"created":return e.created_at;case"activity":return e.last_activity_at;case"stuck":return e.stuck?1+e.stuck.level:0;case"sla":return e.sla?.due_at??"9999";case"cost":return e.cost?.total_minor??-1;case"cost_status":return e.cost_status??""}}const X=()=>Oe(()=>import("./tickets-mock-1RmIRxdV.js"),__vite__mapDeps([0]),import.meta.url).then(e=>e.mockBackend),Ze={async page(e){const t=await X(),n=await t.list({scope:e.scope||"visible",status:"all",limit:200}),s=!e.status||e.status==="all"?null:Qe[e.status]??e.status.split(","),a=e.department?e.department.split(","):[],r=e.priority?e.priority.split(","):[],i=(e.q??"").trim(),h=[];for(const d of n.items){if(s&&!s.includes(d.status)||a.length&&!a.includes(d.department?.id??"")||r.length&&!r.includes(d.priority?.key??"")||e.assignee==="none"&&d.assignee||e.assignee==="me"&&d.assignee?.id!=="demo"||e.assignee?.includes(":")&&e.assignee!==`${d.assignee?.kind}:${d.assignee?.id}`||e.waiting==="manager"&&d.waiting_on!=="manager"||i&&!d.title.includes(i)&&String(d.number)!==i.replace(/^#/,""))continue;const u=await t.get(d.id),{excerpt:p,...l}=d;if(e.cost_status&&!e.cost_status.split(",").includes(u.cost?.status??""))continue;const g=u.cost?.total_minor!=null&&u.cost.currency?{total_minor:u.cost.total_minor,currency:u.cost.currency,approved:u.cost.status==="approved"||u.cost.status==="paid"}:null;h.push({...l,stuck:null,sla:null,transitions:u.transitions,can:{manage:u.can.manage,assign:u.can.assign,assign_external:!1},cost:g,cost_status:u.cost?.status??null})}const $=(e.sort||"activity:desc").split(",").map(d=>d.split(":"));return h.sort((d,u)=>{for(const[p,l]of $){const g=W(d,p),f=W(u,p);if(g!==f)return(g<f?-1:1)*(l==="desc"?-1:1)}return d.id<u.id?-1:1}),{items:h,next_cursor:null,sort:e.sort||"activity:desc",limit:Number(e.limit||50)}},async bulk(e){const t=await X(),n=[];for(const a of e.items){let r="ok",i;try{const h=await t.get(a.id);if(i=h.number,h.revision!==a.revision)r="stale";else if(e.action==="close")await t.status(a.id,{to:"closed",note:e.params.note,revision:a.revision});else if(e.action==="assign"&&e.params.assignee)await t.assign(a.id,{assignee:e.params.assignee,revision:a.revision});else if(e.action==="priority"){const d=(await t.meta()).departments.find(u=>u.id===h.department?.id)?.priorities.find(u=>u.key===e.params.priority_key);!d||d.id===h.priority?.id?r="unchanged":await t.patch(a.id,{priority_id:d.id,revision:a.revision})}else e.action==="remind"&&!h.assignee&&(r="invalid_transition")}catch(h){r=h instanceof G&&h.status===409?"invalid_transition":"not_found"}n.push({id:a.id,number:i,result:r})}const s={};for(const a of n)s[a.result]=(s[a.result]??0)+1;return{action:e.action,total:e.items.length,done:s.ok??0,counts:s,results:n}},async exportCsv(){return{blob:new Blob(["\uFEFF"],{type:"text/csv"}),rows:0,filename:"export.csv"}},async monthlyReport(){return{blob:new Blob(["\uFEFF"],{type:"text/csv"}),rows:0,filename:"monthly.csv"}},async views(){return{items:_.map(e=>({...e})),max:20}},async createView(e,t){const n=new Date().toISOString(),s={id:`v${++Je}`,name:e,view:t,created_at:n,updated_at:n};return _.push(s),{...s}},async patchView(e,t){const n=_.find(s=>s.id===e);if(!n)throw new G(404,{code:"view_not_found",user_message:"",retryable:!1,correlation_id:"",details:{}});return Object.assign(n,t.name?{name:t.name}:{},t.view?{view:t.view}:{}),{...n}},async deleteView(e){const t=_.findIndex(n=>n.id===e);t>=0&&_.splice(t,1)},async prefs(){return{...I}},async savePrefs(e){return I={...e},{...I}}};function ae(){return _e()?Xe:Ze}let E=null;function et(){return E??=ae().prefs().catch(()=>({})),E}async function kt(e){const n={...await et(),...e};for(const s of Object.keys(n))(n[s]===void 0||n[s]===null)&&delete n[s];E=Promise.resolve(n);try{const s=await ae().savePrefs(n);return E=Promise.resolve(s),s}catch{return n}}function $t(e,t){const n=[];let s=[],a=0,r=null,i=null;const h=new Set,$=()=>{s.length&&n.push(s),s=[],a=0,r=null,i=null},d=(p,l,g)=>{let f=0;return!r||r.id!==p.id?(f+=(s.length?t.secGap:0)+(p.head?t.headH+(l?t.inGap:0):0),l&&(f+=(l.sub?t.subH+t.blkGap:0)+(l.pad??0))):l&&(!i||i.key!==l.key)?f+=t.inGap+(l.sub?t.subH+t.blkGap:0)+(l.pad??0):l&&(f+=l.gap),f+g},u=(p,l,g,f)=>{s.length&&a+d(p,l,f)>t.room+.5&&$(),a+=d(p,l,f),(!r||r.id!==p.id)&&(r={id:p.id,groups:[],cont:h.has(p.id)},h.add(p.id),s.push(r),i=null),l&&((!i||i.key!==l.key)&&(i={key:l.key,items:[]},r.groups.push(i)),i.items.push(...g))};for(const p of e){if(!p.groups.length){u(p,null,[],0);continue}for(const l of p.groups){const g=Math.max(1,l.cols);for(let f=0;f<l.items.length;f+=g){const T=l.items.slice(f,f+g),le=l.heightOf?Math.max(0,...T.map(ce=>l.heightOf(ce)??l.rowH)):l.rowH;u(p,l,T,le)}}}return $(),n}function _t(e){if(!e)return 1;const t=getComputedStyle(e).gridTemplateColumns;return Math.max(1,t&&t!=="none"?t.split(" ").filter(Boolean).length:1)}function zt(e){return e&&parseFloat(getComputedStyle(e).rowGap)||0}const St="(min-width: 1024px)",tt=[{id:"cards",icon:"cardsView",label:"lsView_cards",managerOnly:!1},{id:"table",icon:"tableView",label:"lsView_table",managerOnly:!1},{id:"board",icon:"boardView",label:"lsView_board",managerOnly:!0},{id:"calendar",icon:"calendar",label:"lsView_calendar",managerOnly:!1}];function nt(e){return tt.filter(t=>!t.managerOnly||e)}function Ct(e,t,n){return c`<div class="seg sm vsw" role="radiogroup" aria-label=${o("lsViewsGroup")} data-view-switch>
    ${nt(t).map(s=>c`<button type="button" role="radio" aria-checked=${String(e===s.id)} aria-label=${o(s.label)} title=${o(s.label)} data-view=${s.id}
      @click=${()=>n(s.id)}>${C(s.icon)}${e===s.id?c`<span class="lbl">${o(s.label)}</span>`:""}</button>`)}
  </div>`}const A="sw.tickets.list.calendar";function Mt(){try{return sessionStorage.getItem(A)==="1"}catch{return!1}}function Ot(e){try{e?sessionStorage.setItem(A,"1"):sessionStorage.removeItem(A)}catch{}}const st=["stuck","waiting","cost"],Lt={priority:[],handler:"",flags:[]};function at(e){return e.priority.length+(e.handler?1:0)+e.flags.length}function rt(e,t){switch(t){case"stuck":return!!e.stuck;case"waiting":return e.waiting_on==="manager"&&!["closed","cancelled"].includes(e.status);case"cost":return e.cost?.status==="submitted"}}function it(e,t){return t.priority.length&&!(e.priority&&t.priority.includes(e.priority.key))||(t.handler==="none"?q(e.assignee):t.handler&&q(e.assignee)!==t.handler)?!1:t.flags.every(n=>rt(e,n))}function Et(e,t){return at(t)?e.filter(n=>it(n,t)):[...e]}function ot(e){const t=n=>n==="waiting"?!0:n==="stuck"?e.some(s=>"stuck"in s):e.some(s=>!!s.cost);return st.filter(t)}function re(e){const t=new Map;for(const n of e)n.priority&&!t.has(n.priority.key)&&t.set(n.priority.key,{key:n.priority.key,name:n.priority.name,rank:n.priority.rank});return[...t.values()].sort((n,s)=>n.rank-s.rank).map(({key:n,name:s})=>({key:n,name:s}))}function ie(e){return Ve(e).map(({key:t,name:n})=>({key:t,name:n}))}function Y(e,t){return e.includes(t)?e.filter(n=>n!==t):[...e,t]}const oe={stuck:"lfStuck",waiting:"lfWaiting",cost:"lfCost"};function Pt(e,t,n){const s=re(e),a=ie(e),r=ot(e);return c`<div class="frow" id="filter-row" role="group" aria-label=${o("lfGroup")} data-filter-row>
    ${s.length?D(o("lfPriority"),c`<div class="fchips">
      ${s.map(i=>c`<button type="button" class="rc sm" aria-pressed=${String(t.priority.includes(i.key))} data-f-priority=${i.key} @click=${()=>n({...t,priority:Y(t.priority,i.key)})}>${z(i.name)}</button>`)}
    </div>`,"priority"):w}
    ${D(o("lfHandler"),c`<label class="vh" for="f-handler">${o("lfHandler")}</label>
      <select id="f-handler" data-f-handler .value=${t.handler} @change=${i=>n({...t,handler:i.target.value})}>
        <option value="" ?selected=${t.handler===""}>${o("lfAnyHandler")}</option>
        <option value="none" ?selected=${t.handler==="none"}>${o("lfNoHandler")}</option>
        ${a.map(i=>c`<option value=${i.key} ?selected=${t.handler===i.key}>${i.name}</option>`)}
      </select>`,"handler")}
    ${r.length?D(o("tbFlags"),c`<div class="fchips">
      ${r.map(i=>c`<button type="button" class="rc sm" aria-pressed=${String(t.flags.includes(i))} data-f-flag=${i} @click=${()=>n({...t,flags:Y(t.flags,i)})}>${i==="stuck"?y("warning"):C(i==="cost"?"coin":"hand")}${o(oe[i])}</button>`)}
    </div>`,"flags"):w}
  </div>`}function Vt(e,t,n){const s=[],a=re(e);for(const r of t.priority)s.push({key:`priority:${r}`,label:`${o("lfPriority")}: ${a.find(i=>i.key===r)?.name??r}`,remove:()=>n({...t,priority:t.priority.filter(i=>i!==r)})});if(t.handler){const r=t.handler==="none"?o("lfNoHandler"):ie(e).find(i=>i.key===t.handler)?.name??o("lfHandler");s.push({key:"handler",label:t.handler==="none"?r:`${o("lfHandler")}: ${r}`,remove:()=>n({...t,handler:""})})}for(const r of t.flags)s.push({key:`flag:${r}`,label:o(oe[r]),remove:()=>n({...t,flags:t.flags.filter(i=>i!==r)})});return s}export{Lt as N,St as P,yt as a,et as b,Mt as c,Ot as d,zt as e,Vt as f,_t as g,Pt as h,Et as i,gt as j,qe as k,Ct as l,mt as m,bt as o,$t as p,xt as r,kt as s,ae as t};
