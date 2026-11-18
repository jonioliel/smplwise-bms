import{aU as j,g as U,ay as B,j as S,i as J,aL as Q,A as l,by as c,b as r,a7 as v,k as V,ca as Z,m as tt,o as g,bc as et,hO as st,c0 as at,ey as it}from"./index-CkOaAZ0k.js";import{T as rt,s as nt,a as ot,N as D,r as O,g as lt,o as dt,w as k,c as ct,f as ht,l as pt,b as gt,d as ut,e as A,p as mt,t as bt,h as ft,i as wt}from"./list-view-base-B5rLEyEz.js";import{g as $t,w as vt}from"./map-text-ByqALmu3.js";import{a as yt}from"./ticket-detail-BjuVJZka.js";import"./ticket-create-DW43GBFL.js";import{a as W}from"./automations-glass-CW3uN8jT.js";import{a as kt}from"./automations-demo-BVEhgibF.js";import{p as K,n as xt,a as F,b as w,c as q,d as St,s as Ct,e as Tt,g as G,h as z}from"./board-model-C1BTHjAN.js";import{t as $}from"./icons-CtTSPkhK.js";import"./tickets-handlers-BJyV1hrr.js";import"./sw-pager-CAi5IOkw.js";import{L as Ht}from"./long-lists-CQF9cvzG.js";import{m as _t}from"./media-page-lp0LoQ9l.js";import{L as Ot,b as P,a as zt}from"./tickets-board-DUOrDMp2.js";import{o as L}from"./overview-text-DI98FG3e.js";import{d as Pt}from"./drawer-model-CwXIJ_3P.js";import{p as I,f as It,a as Mt,b as Bt,t as Dt}from"./list-toolbar-CH5gqY20.js";import{l as b}from"./list-text-B-0xj8Dk.js";import{t as At}from"./chip-selected-DOYAW8f3.js";import"./sw-logo-art-MaHPMZFI.js";import"./readiness-model-DGhavIGL.js";import"./lead-reserve-CDfcOug5.js";import"./tickets-costs-P6abPCBe.js";import"./tickets-costs-mock-Bs4kV4eD.js";import"./cost-model-BrcQ4Seg.js";import"./bytes-QYSxC3WX.js";import"./pad-CImDeuHV.js";import"./tickets-s4-BKyMASDJ.js";import"./org-locations-text-DaD5veA5.js";import"./geometry-BfS_XFKy.js";import"./drawer-text-dlEq4UdF.js";import"./location-picker-Dnn-kcxX.js";import"./tickets-phone-verify-C0bzYtMu.js";import"./identity-card-BXwkz2ST.js";import"./access-grants-DhiOKREz.js";import"./access-people-DSzXGy8k.js";import"./wiskey-format-D8sxb_B6.js";import"./wiskey-Du_2sjw3.js";import"./recordings-o4p628RV.js";import"./day-key-Bn1dxlC5.js";import"./access-external-Cfi3szbU.js";import"./settings-mBGpMa3Z.js";import"./settings-styles-BnGLHc7f.js";import"./handler-load-BXHEF_X6.js";import"./settings-tabs-CcQjb9O6.js";var Ft=Object.defineProperty,qt=Object.getOwnPropertyDescriptor,H=(t,e,s,i)=>{for(var a=i>1?void 0:i?qt(e,s):e,d=t.length-1,o;d>=0;d--)(o=t[d])&&(a=(i?o(e,s,a):o(a))||a);return i&&a&&Ft(e,s,a),a};let x=class extends J{constructor(){super(...arguments),this.bubbleSkin=new Q(this),this.nodes=[],this.selected="",this.total=0,this.closed=new Set}connectedCallback(){super.connectedCallback(),kt(this)}pick(t){this.dispatchEvent(new CustomEvent("place-pick",{detail:{key:t},bubbles:!0,composed:!0}))}toggle(t){const e=new Set(this.closed);e.has(t)?e.delete(t):e.add(t),this.closed=e}branch(t,e){const s=t.node,i=!this.closed.has(s.key),a=t.children.length>0,d=K(s);return r`<div role="treeitem" aria-level=${e+1} aria-expanded=${a?String(i):l} aria-selected=${String(this.selected===s.key)}>
      <div class=${`row l${Math.min(e,2)}`} role="button" tabindex="0" aria-pressed=${String(this.selected===s.key)} data-place=${s.key}
        @click=${()=>this.pick(s.key)} @keydown=${o=>{(o.key==="Enter"||o.key===" ")&&(o.preventDefault(),this.pick(s.key))}}>
        ${a?r`<button type="button" class="tw" aria-expanded=${String(i)} aria-label=${c(i?"collapse":"expand",{name:d})} data-twist=${s.key}
          @click=${o=>{o.stopPropagation(),this.toggle(s.key)}}>${$("chevronDown")}</button>`:r`<span></span>`}
        <span class="nm">${e===0?r`<b>${v(d)}</b>`:v(d)}</span>
        <span class="n">${s.count}</span>
      </div>
      ${a&&i?r`<div role="group">${t.children.map(o=>this.branch(o,e+1))}</div>`:l}
    </div>`}render(){const t=xt(this.nodes);return r`<nav class="tree glass" aria-label=${c("floors")} data-board-tree>
      <div role="tree" aria-label=${c("floors")}>
        <div class="row l0" role="button" tabindex="0" aria-pressed=${String(!this.selected)} data-place=""
          @click=${()=>this.pick("")} @keydown=${e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.pick(""))}}>
          <span></span><span class="nm"><b>${c("allFloors")}</b></span><span class="n">${this.total}</span>
        </div>
        ${t.map(e=>this.branch(e,0))}
      </div>
    </nav>`}};x.styles=[j,...W,U`
    :host { display: block; }
    .tree {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px;
      border-radius: var(--sw-r-2xl);
      box-sizing: border-box;
    }
    .row {
      all: unset;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto;
      align-items: center;
      gap: 6px;
      /* AUDIT30-C-TICKETS (#14): the tree row of every tree in the product - 36 px, the small radius (it was --sw-r-lg, 28 px on the
         glass host: a pill per row), the chosen row in the Blue Wash pair */
      min-block-size: 36px;
      padding-inline: 8px 12px;
      border-radius: var(--sw-r-sm);
      cursor: pointer;
      color: var(--dv-text);
      font-size: var(--sw-fs-base);
    }
    @media (hover: hover) and (pointer: fine) {
      .row:hover { background: var(--dv-hover, color-mix(in srgb, var(--dv-text) 6%, transparent)); }
    }
    .row[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); font-weight: 700; }
    .row[aria-pressed='true'] .n { color: var(--sw-accent-text); }
    @media (pointer: coarse) {
      .row { min-block-size: 44px; }
    }
    .row:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 1px; }
    .row.l0 b { font-weight: 700; }
    .row.l1 { padding-inline-start: 28px; color: var(--dv-text-2); }
    .row.l2 { padding-inline-start: 48px; color: var(--dv-text-2); }
    .row .n { font-variant-numeric: tabular-nums; color: var(--dv-accent-text); font-size: var(--sw-fs-sm); font-weight: 600; }
    .row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tw {
      all: unset;
      display: inline-grid;
      place-items: center;
      inline-size: 24px;
      block-size: 24px;
      border-radius: var(--sw-r-sm);
      color: var(--dv-text-3);
      cursor: pointer;
    }
    .tw:focus-visible { outline: 2px solid var(--dv-focus); }
    .tw .ic { font-size: var(--sw-fs-lg); transition: transform var(--mm-motion, 160ms) ease; }
    .tw[aria-expanded='false'] .ic { transform: rotate(90deg); }
    :host-context([dir='ltr']) .tw[aria-expanded='false'] .ic { transform: rotate(-90deg); }
  `];H([B({attribute:!1})],x.prototype,"nodes",2);H([B()],x.prototype,"selected",2);H([B({type:Number})],x.prototype,"total",2);H([S()],x.prototype,"closed",2);x=H([V("ticket-board-tree")],x);const Gt=2,Lt=["closed","cancelled"],N=t=>String(t).padStart(2,"0"),R=t=>`${N(t.getHours())}:${N(t.getMinutes())}`,E=(t,e)=>t.getFullYear()===e.getFullYear()&&t.getMonth()===e.getMonth()&&t.getDate()===e.getDate();function Nt(t,e,s){const i=t.filter(n=>!Lt.includes(n.status)),a=[],d=i.filter(n=>n.eta_at&&n.assignee).map(n=>({x:n,at:new Date(n.eta_at)})).filter(({at:n})=>!Number.isNaN(n.getTime())&&E(n,s)&&n.getTime()>=s.getTime()).sort((n,p)=>n.at.getTime()-p.at.getTime()).slice(0,Gt);for(const{x:n,at:p}of d)a.push({kind:"visit",time:R(p),label:`${b("bdVisit")} · ${n.assignee?.name??""}`,what:n.place_text||n.device_name,tone:"info",id:n.id});const o=i.filter(n=>n.sla_cell&&!n.sla_cell.over).map(n=>({x:n,at:new Date(n.sla_cell.at)})).filter(({at:n})=>!Number.isNaN(n.getTime())&&E(n,s)&&n.getTime()>=s.getTime()).sort((n,p)=>n.at.getTime()-p.at.getTime());if(o.length){const{x:n,at:p}=o[0];a.push({kind:"sla",time:R(p),label:b("bdSla"),what:`#${n.number} ${yt(n.title,28)}`,tone:"warn",id:n.id})}return e.waiting>0&&a.push({kind:"waiting",time:"",label:b(e.waiting===1?"bdWaitingMineOne":"bdWaitingMine",{n:e.waiting}),what:"",tone:"ok",id:""}),a}const M=4;function Rt(t){return{on:Math.max(0,Math.min(M,t)),total:M,hot:t>=M}}var Et=Object.defineProperty,jt=Object.getOwnPropertyDescriptor,C=(t,e,s,i)=>{for(var a=i>1?void 0:i?jt(e,s):e,d=t.length-1,o;d>=0;d--)(o=t[d])&&(a=(i?o(e,s,a):o(a))||a);return i&&a&&Et(e,s,a),a};let y=class extends rt{constructor(){super(...arguments),this.r=F(new URLSearchParams),this.data=null,this.treeHidden=!1,this.showClosed=!1,this.key="",this.fit=null,this.lists=new Ht(this,()=>{this.cardPage=1,this.onPaged()}),this.maxH={row:0,head:0,sub:0,cr:0},this.live=new Ot(()=>{this.now=new Date,this.screen==="ready"&&this.load(!0)}),this.pickMode=t=>{t!=="board"&&(nt(t==="calendar"),t!=="calendar"&&ot({view:t}),window.location.hash=Z(it()))},this.onGone=t=>{if(this.closeDrawer(),t.detail?.deleted){this.say(Pt("deletedOne"));const e=t.detail.id;this.data&&(this.data={...this.data,items:this.data.items.filter(s=>s.id!==e),closed:this.data.closed.filter(s=>s.id!==e)})}this.load(!0)},this.resetFilters=()=>{this.filters={...D},(this.r.dept||this.r.assignee)&&this.go({dept:"",assignee:void 0})}}resetFit(){this.fit=null,this.maxH={row:0,head:0,sub:0,cr:0},this.cardH.clear()}pagedBoard(){return this.paged&&this.lists.paged&&this.screen==="ready"&&this.r.pane!=="handlers"&&!!this.data?.items.length}fitTarget(){return this.pagedBoard()?this.renderRoot.querySelector("[data-board-pages]"):null}measureFit(){const t=this.fitBox;if(!t||!t.isConnected)return;const e=t.querySelector(".cgrid"),s=[...t.querySelectorAll(".cgrid > ticket-card")];if(!e||!s.length)return;const i=h=>Math.max(0,...[...t.querySelectorAll(h)].map(f=>f.offsetHeight)),a=this.maxH;a.row=Math.max(a.row,...s.map(h=>h.offsetHeight));const d=this.noteCardHeights(s);a.head=Math.max(a.head,i(".fsec > .sh")),a.sub=Math.max(a.sub,i(".assignee-block > .sub")),a.cr=Math.max(a.cr,i(".closedrows > .cr"));const o=t.querySelector(".closedrows"),n=o?(parseFloat(getComputedStyle(o).paddingBlockStart)||0)+(parseFloat(getComputedStyle(o).paddingBlockEnd)||0):8,p={room:t.clientHeight,cols:lt(e),rowH:a.row,gap:O(e),headH:a.head||40,subH:a.sub||36,secGap:O(t.querySelector(":scope > .groups")),inGap:O(t.querySelector(".fsec")),blkGap:O(t.querySelector(".assignee-block"))||10,crH:a.cr||44,crPad:n},m=this.fit;(!m||d||Object.keys(p).some(h=>m[h]!==p[h]))&&(this.fit=p)}stripTip(t){const e=this.data;if(!e||t==="closed")return"";const s=t==="waiting"?i=>i.group==="waiting":t==="stuck"?i=>!!i.stuck:t==="unassigned"?i=>["new","returned"].includes(i.status):()=>!0;return dt(e.items.filter(s),this.now)}willUpdate(t){t.has("route")&&this.route&&(this.r=F(this.route.params),this.r.ticketId&&(this.drawerUsed=!0),this.syncSearch(this.r.q),(this.screen==="ready"||this.screen==="error")&&this.reloadIfNeeded(),this.firstPageOn([this.r.q,this.r.dept,this.r.place,this.r.state,this.r.pane].join("|")));const e=t;(e.has("filters")||e.has("showClosed"))&&(this.cardPage=1)}async loadMeta(){const[t,e]=await Promise.all([tt().meta(),P().treeHidden().catch(()=>!1)]);this.meta=t,this.treeHidden=e}queryKey(){return`${this.r.state}|${this.r.dept}|${this.r.place}|${this.r.q.trim()}|${this.r.assignee??""}`}reloadIfNeeded(t=!1){const e=this.queryKey();!t&&e===this.key||(this.key=e,this.load(!1))}async load(t){const e=++this.seq;!t&&!this.data&&(this.screen="loading");try{const s=await P().board({state:this.r.state,department_id:this.r.dept||void 0,place:this.r.place||void 0,q:this.r.q,assignee:this.r.assignee||void 0});if(e!==this.seq)return;this.data=s,this.now=new Date,this.screen="ready"}catch(s){if(e!==this.seq||t)return;this.fail(s)}}assigneeName(){const t=this.r.assignee??"";return t==="none"?c("noAssigneeGroup"):(this.data?.items.find(s=>s.assignee_key===t)??this.data?.closed.find(s=>s.assignee_key===t))?.assignee?.name??this.data?.handling.find(s=>s.key===t)?.name??L("ldTitle")}ui(){return zt(this.data?{...this.module,ui:{...this.module?.ui??{},...this.data.ui}}:this.module)}go(t,e=!1){k(w({...this.r,...t},{t:this.r.ticketId||void 0}),e)}searchTo(t){this.go({q:t},!0)}openHref(t){return w(this.r,{t})}plainHref(){return w(this.r)}async setTreeHidden(t){this.treeHidden=t;try{await P().setTreeHidden(t)}catch{}}chips(){const t=this.data,e=[];if(this.r.dept){const s=t?.departments.find(i=>i.id===this.r.dept);e.push({key:"department",label:s?s.name:b("tbDept"),remove:()=>this.go({dept:""})})}return this.r.assignee&&e.push({key:"assignee",label:this.assigneeName(),remove:()=>this.go({assignee:void 0}),attrs:{"data-assignee-filter":this.r.assignee,"aria-label":L("clearHandler",{name:this.assigneeName()})}}),t&&e.push(...ct([...t.items,...t.closed],this.filters,s=>this.filters=s)),e}panelBody(t,e=l){const s=this.data,i=s?.departments??[];return r`
      ${e===l?l:I(c("stateStrip"),e,"state")}
      ${i.length>1?I(b("tbDept"),r`<div class="fchips" role="group" aria-label=${g("departmentsGroup")} data-dept-chips>
        <button type="button" class="rc" aria-pressed=${String(!this.r.dept)} data-dept="" @click=${()=>this.go({dept:""})}>${g("allDepartments")}<small>${i.reduce((a,d)=>a+d.count,0)}</small></button>
        ${i.map(a=>r`<button type="button" class="rc" aria-pressed=${String(this.r.dept===a.id)} data-dept=${a.id} @click=${()=>this.go({dept:a.id})}>${v(a.name)}<small>${a.count}</small></button>`)}
      </div>`,"department"):l}
      ${t.treeInFilter&&s?I(b("tbPlace"),this.tree(s),"place"):l}
      ${s?ht([...s.items,...s.closed],this.filters,a=>this.filters=a):l}`}tree(t){const e=t.tree.reduce((s,i)=>s+(i.parent?0:i.count),0);return r`<ticket-board-tree .nodes=${t.tree} .selected=${this.r.place} .total=${e} @place-pick=${s=>this.go({place:s.detail.key})}></ticket-board-tree>`}header(){const t=this.data,e=this.ui(),s=q(e.board_floors,this.treeHidden,this.phone),i=this.screen==="ready"||this.screen==="loading",a=!!this.meta?.can.create,d=t&&s.chips?St(t.tree):[],o=this.r.pane==="handlers",n=this.chips(),p=this.meta?.can.manage?r`<div class="seg sm" role="radiogroup" aria-label=${g("dmPaneGroup")} data-board-pane>
          <button type="button" role="radio" aria-checked=${String(!o)} data-pane="cards" @click=${()=>this.go({pane:"cards"})}>${g("area")}</button>
          <button type="button" role="radio" aria-checked=${String(o)} data-pane="handlers" @click=${()=>this.go({pane:"handlers"})}>${g("hdTitle")}</button>
        </div>`:l,m=r`<div class="pact" slot="actions">
      ${this.phone?l:p}
      ${i&&!o?r`${pt("board",!0,this.pickMode)}
        ${a?r`<button type="button" class="btn primary newbtn" data-new aria-label=${g("newTitle")} @click=${()=>k(w(this.r,{create:!0}),!1)}>${$("plus")}<span class="lbl">${g("newShort")}</span></button>`:l}`:l}
    </div>`,h=t?r`<div class="seg sm stf" role="radiogroup" aria-label=${c("stateStrip")} data-state-strip>
          ${Ct(e.closed_strip,t.counts).map(u=>r`<button type="button" role="radio" aria-checked=${String(this.r.state===u.id)} data-state=${u.id} title=${this.stripTip(u.id)} @click=${()=>this.go({state:u.id})}>${u.label}<small>${u.count}</small></button>`)}
        </div>`:l,f=this.filterOpen?It(this.panelBody(s,this.phone?h:l),n.length,this.resetFilters,()=>this.filterOpen=!1):l,_=d.length>0&&!o;return r`${m}<header class="dh" data-board-header>
      ${_||this.phone&&p!==l?r`<div class="dh-row">
        ${this.phone?p:l}
        ${_?r`<div class="rooms" role="group" aria-label=${c("floors")} data-floor-chips>
          <button type="button" class="rc" aria-pressed=${String(!this.r.place)} data-place="" @click=${()=>this.go({place:""})}>${c("allFloors")}</button>
          ${d.map(u=>r`<button type="button" class="rc" aria-pressed=${String(this.r.place===u.key)} data-place=${u.key} @click=${()=>this.go({place:u.key})}>${v(K(u))}<small>${u.count}</small></button>`)}
        </div>`:l}
      </div>`:l}
      ${i&&!o?r`<div class="dh-det tb" role="group" aria-label=${b("lfGroup")} data-toolbar>
        ${this.phone?l:h}
        <label class="search">${$("search")}<span class="vh">${g("searchShort")}</span><input type="search" data-search maxlength="80" placeholder=${this.phone?g("searchShort"):g("search")} .value=${this.q} @input=${u=>this.onSearch(u.target.value)} /></label>
        <span class="fanchor">
          ${Mt(this.filterOpen,n.length,()=>this.filterOpen=!this.filterOpen,s.treeInFilter?"board":"")}
          ${this.phone?l:f}
        </span>
        ${Bt(n,this.resetFilters)}
        ${s.toggle&&this.treeHidden?r`<button type="button" class="btn sm treeshow" aria-pressed="false" data-tree-toggle @click=${()=>void this.setTreeHidden(!1)}>${$("tree")}${c("treeShow")}</button>`:l}
        ${this.pagedBoard()?this.pagerRow():l}
        ${this.phone?f:l}
      </div>`:l}
    </header>`}card(t){const e=this.detailMode()!=="drawer";return r`<ticket-card .item=${t} .board=${!0} .role=${gt(t,this.meta)} .now=${this.now} .href=${this.hrefOf(t.id)} .timelineHref=${this.hrefOf(t.id,!0)} .fullScreen=${e} ?data-picked=${this.r.ticketId===t.id} @card-action=${this.onCardAction}></ticket-card>`}grid(t,e){return r`<div class="cgrid" data-cards=${e}>${et(t,s=>s.id,s=>this.card(s))}</div>`}section(t,e,s,i,a){return r`<section class="fsec" data-section=${t}>
      <div class="sh"><h2>${e}</h2><span class="cnt" data-section-count>${i}</span><small>${s}</small></div>
      ${a}
    </section>`}handling(t,e=!1){const i=this.data.handling.filter(a=>t.some(d=>a.ids.includes(d.id)));return i.length<=1&&!e?this.grid(t,"handling"):r`${i.map(a=>{const d=t.filter(p=>a.ids.includes(p.id)),o=Rt(d.length),n=ut(d[0])[0];return r`<div class="assignee-block" data-assignee=${a.key}>
        <div class="hgroup sub">${n&&a.name?r`<span class=${`av ${n.kind}`} aria-hidden="true">${n.ini}</span>`:l}<b>${a.name?v(a.name):c("noAssigneeGroup")}</b><span>${b("bdHandlingBy",{n:a.count,age:Tt(a.oldest_at,this.now)})}</span>
          <span class="load" role="img" aria-label=${b("bdLoadLabel",{n:d.length})} data-load=${o.on}>${Array.from({length:o.total},(p,m)=>r`<i class=${m<o.on?o.hot&&m===o.total-1?"hot":"on":""}></i>`)}</span></div>
        ${this.grid(d,"handling")}
      </div>`})}`}today(t){const e=Nt(t.items,t.counts,this.now);return e.length?r`<div class="today glass" role="list" aria-label=${b("bdTodayGroup")} data-board-today><b>${b("bdToday")}</b>
      ${e.map(s=>s.id?r`<button type="button" class=${`up ${s.tone}`} role="listitem" data-today=${s.kind} @click=${()=>k(this.hrefOf(s.id),!1)}><i></i><time>${s.time}</time><span>${v(s.label)}</span>${s.what?r`<span class="what">${v(s.what)}</span>`:l}</button>`:r`<span class=${`up ${s.tone}`} role="listitem" data-today=${s.kind}><i></i><span>${s.label}</span></span>`)}
    </div>`:l}closedRows(t){return r`<div class="closedrows glass" data-cards="closed">${t.map(e=>r`<a class="cr" href=${this.hrefOf(e.id)} data-closed-row=${e.id} aria-label=${b("bdOpenRow",{n:e.number})}>
      <span class="num">#${e.number}</span><b>${e.title}</b><span class="hide-p">${e.assignee?.name?v(e.assignee.name):""}</span><span>${st(e.closed_at??e.last_activity_at,this.now)}</span></a>`)}</div>`}cards(){const t=this.data,e=this.ui(),s=A(t.items,this.filters),i=A(t.closed,this.filters);if(!t.items.length)return this.r.q.trim()||this.r.dept||this.r.place||this.r.state!=="all"?this.stateBox("search",this.r.state!=="all"&&!this.r.q.trim()?c("emptyState"):g("emptyFiltered"),"no-match",r`<button type="button" class="btn sm" data-clear-filters @click=${()=>k(w({}),!1)}>${g("clearFilters")}</button>`):this.stateBox("ticket",c("emptyBoard"),"empty");if(!s.length&&!i.length)return this.stateBox("search",b("lfNoMatch"),"no-match-filters",r`<button type="button" class="btn sm" data-clear-card-filters @click=${()=>this.filters={...D}}>${$("x")}${b("lfClear")}</button>`);if(this.pagedBoard()&&this.fit)return this.pagedCards(s,i);if(!G(e.grouping,this.r.state))return this.grid(s,"flat");const a=z(s);return r`<div class="groups">
      ${a.waiting.length?this.section("waiting",c("grpWaiting"),c("grpWaitingSub"),a.waiting.length,this.grid(a.waiting,"waiting")):l}
      ${a.stuck.length?this.section("stuck",c("grpStuck"),c("grpStuckSub"),a.stuck.length,this.grid(a.stuck,"stuck")):l}
      ${a.handling.length?this.section("handling",c("grpHandling"),c("grpHandlingSub"),a.handling.length,this.handling(a.handling)):l}
      ${this.r.state==="all"&&e.closed_strip!=="hidden"&&i.length?r`<section class="fsec" data-section="closed">
        <div class="sh"><h2>${c("grpClosed")}</h2><span class="cnt">${i.length}</span>
          <button type="button" class="btn sm" aria-expanded=${String(this.showClosed)} data-closed-toggle @click=${()=>this.showClosed=!this.showClosed}>${this.showClosed?c("hideClosed"):c("showClosed")}</button></div>
        ${this.showClosed?this.closedRows(i):l}
      </section>`:l}
    </div>`}packSections(t,e){const s=this.data,i=this.ui(),a=this.fit,d=(p,m,h=!1)=>({key:p,sub:h,items:m,cols:a.cols,rowH:a.rowH,gap:a.gap,heightOf:f=>this.cardH.get(f.id)});if(!G(i.grouping,this.r.state))return[{id:"flat",head:!1,groups:[d("flat",t)]}];const o=z(t),n=[];if(o.waiting.length&&n.push({id:"waiting",head:!0,groups:[d("waiting",o.waiting)]}),o.stuck.length&&n.push({id:"stuck",head:!0,groups:[d("stuck",o.stuck)]}),o.handling.length){const p=s.handling.filter(m=>o.handling.some(h=>m.ids.includes(h.id)));n.push({id:"handling",head:!0,groups:p.length<=1?[d("handling",o.handling)]:p.map(m=>d(`h:${m.key}`,o.handling.filter(h=>m.ids.includes(h.id)),!0))})}return this.r.state==="all"&&i.closed_strip!=="hidden"&&e.length&&n.push({id:"closed",head:!0,groups:this.showClosed?[{key:"closed",sub:!1,items:e,cols:1,rowH:a.crH,gap:0,pad:a.crPad}]:[]}),n}pagedCards(t,e){const s=this.fit,i=this.packSections(t,e),a=mt(i,{room:s.room,headH:s.headH,subH:s.subH,secGap:s.secGap,inGap:s.inGap,blkGap:s.blkGap});this.pageCount=Math.max(1,a.length);const d=this.pageAt(),o=a[d-1]??[],n=z(t),p=h=>h==="waiting"?n.waiting.length:h==="stuck"?n.stuck.length:h==="handling"?n.handling.length:e.length;return o.length===1&&o[0].id==="flat"?this.grid(o[0].groups[0]?.items??[],"flat"):r`<div class="groups">${o.map(h=>{const f=h.groups.flatMap(T=>T.items);if(h.id==="closed")return r`<section class="fsec" data-section="closed">
          <div class="sh"><h2>${c("grpClosed")}</h2><span class="cnt">${e.length}</span>
            <button type="button" class="btn sm" aria-expanded=${String(this.showClosed)} data-closed-toggle @click=${()=>this.showClosed=!this.showClosed}>${this.showClosed?c("hideClosed"):c("showClosed")}</button></div>
          ${this.showClosed&&f.length?this.closedRows(f):l}
        </section>`;const _=i.find(T=>T.id===h.id)?.groups.some(T=>T.sub)??!1,u=h.id==="handling"?this.handling(f,_):this.grid(f,h.id),Y=h.id==="waiting"?c("grpWaiting"):h.id==="stuck"?c("grpStuck"):c("grpHandling"),X=h.id==="waiting"?c("grpWaitingSub"):h.id==="stuck"?c("grpStuckSub"):c("grpHandlingSub");return this.section(h.id,Y,X,p(h.id),u)})}</div>`}pagerRow(){if(this.pageCount<=1)return l;const t=this.pageAt();return r`<sw-pager class="bpager" data-board-pager .page=${t} .pages=${this.pageCount} @page-change=${e=>this.cardPage=e.detail.page}></sw-pager>`}body(){switch(this.screen){case"loading":{const a=r`<ticket-card skeleton .board=${!0}></ticket-card>`;return r`<div data-tickets-state="loading" aria-busy="true"><div class="cgrid">${Array.from({length:this.phone?3:6},()=>a)}</div></div>`}case"off":return this.stateBox("ticket",g("moduleOff"),"off");case"forbidden":return this.stateBox("lock",c("notManager"),"forbidden");case"error":return this.stateBox("warning",g("loadFailed"),"error",r`${this.failed?r`<span class="vh" data-error-detail>${this.failed}</span>`:l}<button type="button" class="btn sm" data-retry @click=${()=>{this.screen="loading",this.data=null,this.boot()}}>${$("refresh")}${g("retry")}</button>`)}if(this.r.pane==="handlers")return r`<tickets-handlers embedded data-board-handlers></tickets-handlers>`;const t=this.data,e=this.ui(),s=q(e.board_floors,this.treeHidden,this.phone),i=t.counts.stuck>0&&this.r.state!=="stuck"?r`<div class="banner warn" role="status" data-stuck-banner>${$("warning")}<div><b>${c("banner",{n:t.counts.stuck})}</b></div><button type="button" class="btn sm" data-stuck-go @click=${()=>this.go({state:"stuck"})}>${c("bannerGo")}</button></div>`:l;return r`
      ${this.today(t)}
      <div class=${`layout${s.tree?" with-tree":""}`}>
        ${s.tree?r`<aside class="side" aria-label=${b("tbTree")}>
          ${s.toggle?r`<div class="sidehead"><b>${c("floors")}</b><button type="button" class="btn sm" aria-pressed="true" data-tree-toggle @click=${()=>void this.setTreeHidden(!0)}>${$("tree")}${c("treeHide")}</button></div>`:l}
          ${this.tree(t)}
        </aside>`:l}
        <div class="groups" data-board-main>
          ${i}
          ${this.pagedBoard()?r`<div class="pgbox" data-board-pages data-page=${this.pageAt()} data-pages=${this.pageCount}>${this.cards()}</div>`:this.cards()}
          ${t.truncated?r`<div class="note" data-truncated>${c("truncated")}</div>`:l}
        </div>
      </div>`}render(){const t=this.module?.ui,e=!!this.r.ticketId&&this.screen==="ready";this.pageCount=1;const s=this.body();return r`<sw-page class="page" wide data-screen="tickets-board" heading=${g("area")} data-tickets-title=${g("area")}>
      ${this.header()}
      <div class=${`scr${this.pagedBoard()?" paged":""}`} data-board-scroll>${s}</div>
    </sw-page>
    ${this.drawerUsed&&this.module?.enabled?r`<ticket-detail mode="drawer" .open=${e} .ticketId=${this.r.ticketId} .detailMode=${t?.detail??"drawer_fullscreen"} .scope=${"department"} .focusTimeline=${this.route?.params.get("view")==="timeline"} .initialTab=${this.route?.params.get("tab")??""}
      .defaultTab=${t?.detail_tab??""} .sizeSetting=${t?.drawer_size??""} .sheetSetting=${t?.phone_sheet??""} .cameraViewfinder=${t?.camera_viewfinder===!0} .assignContact=${$t(this.route?.params.get("assign"))}
      @assign-consumed=${()=>k(w(this.r,{t:this.r.ticketId}),!0)}
      @drawer-close=${this.closeDrawer} @ticket-changed=${()=>void this.load(!0)} @ticket-gone=${this.onGone}></ticket-detail>`:l}
    ${this.module?.enabled&&this.meta?.can.create?r`<ticket-create .open=${this.r.creating&&this.screen==="ready"} .meta=${this.meta} .mode=${t?.new_ticket??"sheet"} .scope=${"department"} .detailMode=${t?.detail??"drawer_fullscreen"}
      @close=${()=>k(w(this.r),!1)} @created=${i=>{const a=i.detail;this.say(a.failedPhotos?g("photosFailed",{n:a.failedPhotos}):g(a.result==="absorbed"?"absorbed":"created",{n:a.number}),a.failedPhotos?"bad":"ok");const d=this.detailMode()==="fullscreen"?at(a.id):w(this.r,{t:a.id});k(a.assignContact&&a.result==="created"?vt(d,a.assignContact):d,!0),this.load(!1)}}></ticket-create>`:l}
    ${this.toastView()}`}};y.styles=[j,...W,_t,bt,ft,Dt,wt,U`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--dv-gap-lg, 16px);
      align-items: start;
    }
    .layout.with-tree {
      grid-template-columns: 280px minmax(0, 1fr);
    }
    .side {
      position: sticky;
      inset-block-start: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    /* TICKETS-POLISH-2331 (audit §7.5.9): the tree's own head carries its hide control (it was a third button on the title row) */
    .sidehead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-inline: 6px 2px;
      min-block-size: 32px;
    }
    .sidehead b {
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      color: var(--dv-text-2);
    }
    .sidehead .btn {
      box-shadow: none;
    }
    .treeshow {
      flex: none;
      margin-inline-start: auto;
    }
    .cnt {
      display: inline-grid;
      place-items: center;
      min-inline-size: 22px;
      block-size: 22px;
      padding-inline: 6px;
      box-sizing: border-box;
      border-radius: var(--sw-r-pill);
      background: var(--dv-warning-soft);
      color: var(--au-warn-text);
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .seg button small,
    .rc small {
      font-variant-numeric: tabular-nums;
      margin-inline-start: 6px;
    }
    /* a floor's count is a small badge, never read as part of the floor's own number ("קומה 1" + 2) */
    .rc small {
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
    }
    .rc[aria-pressed='true'] small {
      background: color-mix(in srgb, currentColor 18%, transparent);
      color: inherit;
    }
    .sub {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding-inline: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .sub b {
      color: var(--dv-text);
      font-size: var(--sw-fs-md);
    }
    .assignee-block {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      text-align: center;
    }
    /* NOSCROLL-297 + TICKETS-POLISH-2331 (owner rule: a control screen fits the viewport): from a tablet up, below the header the board (the
       today row, the tree, the groups of cards) scrolls in its own region - the page itself never scrolls and the controls stay in place;
       the tree stays beside the cards (sticky inside the region). On a phone the region is transparent and the page scrolls. */
    /* AUDIT30-C-TICKETS (#6): the page is sw-page (its own header row: the title and the actions slot). The frame's own gap and
       padding give way to the glass page's (.page, styles/media-page.ts); the toolbar header under it no longer sticks or compacts - the
       title it compacted moved into the frame (on a phone the page scrolls, the toolbar with it). */
    .dh:empty {
      display: none;
    }
    /* AUDIT30-C-TICKETS (#17): a group's heading is a section title (--sw-fs-xl), a clear step below the page title - it was
       --sw-fs-3xl / 800 (26 px) under a 30 px title */
    .fsec > .sh h2 {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.01em;
    }
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30 #5): on a desktop the board is paged - the "today"
       row and the banner stay, the groups take the room left (.pgbox: its height set by the layout, never by the cards) and show what fits;
       the tree scrolls inside its own column; the pager is at the end of the toolbar row. The region keeps overflow: auto only as the
       fallback of a window shorter than one group header and one row of cards. */
    .bpager {
      flex: none;
      margin-inline-start: auto;
    }
    @media (min-width: 1024px) {
      .scr.paged {
        padding-block-end: 20px;
      }
      .scr.paged > .layout {
        flex: 1 1 0;
        min-block-size: 0;
        grid-template-rows: minmax(0, 1fr);
        align-items: stretch;
      }
      .scr.paged .side {
        position: static;
        min-block-size: 0;
        max-block-size: 100%;
        overflow-y: auto;
        scrollbar-width: thin;
      }
      .scr.paged [data-board-main] {
        min-block-size: 0;
        gap: 14px;
      }
      .scr.paged .pgbox {
        flex: 1 1 0;
        min-block-size: 0;
      }
      .scr.paged .pgbox > .groups {
        gap: 18px;
      }
      .scr.paged .pgbox .cgrid {
        align-content: start;
      }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .layout.with-tree {
        grid-template-columns: 240px minmax(0, 1fr);
      }
      /* a portrait tablet: "סינון" and "+ חדשה" are icon buttons (their names stay in aria-label), and the toolbar may take a second line
         rather than run past the screen's edge (the layout guard found both labels cut by the board at 768) */
      .tb .filterbtn .lbl,
      .pact .newbtn .lbl {
        display: none;
      }
      .pact .newbtn {
        min-inline-size: 44px;
        justify-content: center;
      }
      .dh-det.tb {
        flex-wrap: wrap;
      }
    }
    @media (max-width: 767px) {
      .dh-row {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .dh-row > [data-board-pane] {
        align-self: flex-start;
      }
      /* the state strip (in the "סינון" sheet on a phone): three a row (nothing hidden behind a scroll, every count readable) */
      .fpop .seg.stf {
        inline-size: 100%;
        box-sizing: border-box;
        display: grid;
        grid-auto-flow: row;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        border-radius: var(--sw-r-xl);
      }
      /* a key keeps its count inside it (the guard: a "3" escaped its key by 3-12 px at 320-390); the label truncates first */
      .fpop .seg.stf button {
        min-block-size: 44px;
        min-inline-size: 0;
        padding-inline: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  `,At];C([S()],y.prototype,"r",2);C([S()],y.prototype,"data",2);C([S()],y.prototype,"treeHidden",2);C([S()],y.prototype,"showClosed",2);C([S()],y.prototype,"fit",2);y=C([V("tickets-board")],y);export{y as TicketsBoard};
