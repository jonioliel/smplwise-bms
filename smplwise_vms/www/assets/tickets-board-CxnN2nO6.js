import{a4 as Q,i as V,n as _,r as m,a as Y,S as X,p as l,Z as c,q as r,X as S,x as Z,a1 as it,ge as M,a0 as u,M as rt,O as D,Q as nt,R as N,ak as ot,cP as lt,Y as dt,pi as ct,V as ht}from"./index-C5kZ9jiu.js";import{N as z,P as A,d as pt,s as gt,e as P,g as ut,o as ft,f as mt,h as bt,l as wt,a as $t,k as vt,i as G,p as yt,j as xt,m as kt}from"./list-filter-row-BJDnfk6b.js";import{j as St,w as Ct}from"./map-text-Brg0AnNJ.js";import{d as Tt}from"./ticket-detail-CNdFNj50.js";import"./ticket-create-BRaz229J.js";import{a as J}from"./automations-glass-B-MfZHsT.js";import{a as tt}from"./automations-demo-CVgZlSKD.js";import{p as et,n as Ot,c as L,b as k,d as R,e as Ht,s as Mt,g as Pt,h as E,i as q}from"./board-model-mWgRm0aP.js";import{t as x}from"./icons-Cmf7CqDT.js";import"./tickets-handlers-B6_BmR6U.js";import"./sw-pager-2h-bsNFx.js";import{m as _t,a as zt}from"./media-page-BF4b5gDG.js";import{L as qt,b as B,a as Bt}from"./tickets-board-h2CfIncE.js";import{o as U}from"./overview-text-BgbbJhK6.js";import{d as Ft}from"./drawer-model-B-q6j3tS.js";import{F as It,p as F,f as Dt,a as Nt,b as At,t as Gt}from"./list-toolbar-DshpdKih.js";import{l as v}from"./list-text-CAHgZKWf.js";import{t as Lt}from"./chip-selected-HVnpKhPo.js";import"./sw-logo-art-Va6y_cIM.js";import"./readiness-model-DGhavIGL.js";import"./lead-reserve-BLWZG4KN.js";import"./tickets-costs-Pd4vi3A4.js";import"./tickets-costs-mock-CxjE8wVv.js";import"./cost-model-DzWhsEJZ.js";import"./tickets-s4-CBaTYz_V.js";import"./org-locations-text-BQNxbGxD.js";import"./geometry-BRPhtaBC.js";import"./drawer-text-BhoJR86g.js";import"./location-picker-FXrg4h6C.js";import"./tickets-phone-verify-B6GlDHVQ.js";import"./identity-card-Cxmhcyib.js";import"./access-grants-CIZbgBPt.js";import"./access-people-C36aN9Y-.js";import"./wiskey-format-BJBSoZNO.js";import"./recordings-BI20ocxt.js";import"./access-external-ANeplmrB.js";import"./settings-styles-BjrFcaYH.js";import"./handler-load-BXHEF_X6.js";import"./settings-tabs-CcQjb9O6.js";var Rt=Object.defineProperty,Et=Object.getOwnPropertyDescriptor,O=(t,e,s,i)=>{for(var a=i>1?void 0:i?Et(e,s):e,d=t.length-1,o;d>=0;d--)(o=t[d])&&(a=(i?o(e,s,a):o(a))||a);return i&&a&&Rt(e,s,a),a};let C=class extends Y{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.nodes=[],this.selected="",this.total=0,this.closed=new Set}connectedCallback(){super.connectedCallback(),tt(this)}pick(t){this.dispatchEvent(new CustomEvent("place-pick",{detail:{key:t},bubbles:!0,composed:!0}))}toggle(t){const e=new Set(this.closed);e.has(t)?e.delete(t):e.add(t),this.closed=e}branch(t,e){const s=t.node,i=!this.closed.has(s.key),a=t.children.length>0,d=et(s);return r`<div role="treeitem" aria-level=${e+1} aria-expanded=${a?String(i):l} aria-selected=${String(this.selected===s.key)}>
      <div class=${`row l${Math.min(e,2)}`} role="button" tabindex="0" aria-pressed=${String(this.selected===s.key)} data-place=${s.key}
        @click=${()=>this.pick(s.key)} @keydown=${o=>{(o.key==="Enter"||o.key===" ")&&(o.preventDefault(),this.pick(s.key))}}>
        ${a?r`<button type="button" class="tw" aria-expanded=${String(i)} aria-label=${c(i?"collapse":"expand",{name:d})} data-twist=${s.key}
          @click=${o=>{o.stopPropagation(),this.toggle(s.key)}}>${x("chevronDown")}</button>`:r`<span></span>`}
        <span class="nm">${e===0?r`<b>${S(d)}</b>`:S(d)}</span>
        <span class="n">${s.count}</span>
      </div>
      ${a&&i?r`<div role="group">${t.children.map(o=>this.branch(o,e+1))}</div>`:l}
    </div>`}render(){const t=Ot(this.nodes);return r`<nav class="tree glass" aria-label=${c("floors")} data-board-tree>
      <div role="tree" aria-label=${c("floors")}>
        <div class="row l0" role="button" tabindex="0" aria-pressed=${String(!this.selected)} data-place=""
          @click=${()=>this.pick("")} @keydown=${e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.pick(""))}}>
          <span></span><span class="nm"><b>${c("allFloors")}</b></span><span class="n">${this.total}</span>
        </div>
        ${t.map(e=>this.branch(e,0))}
      </div>
    </nav>`}};C.styles=[Q,...J,V`
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
  `];O([_({attribute:!1})],C.prototype,"nodes",2);O([_()],C.prototype,"selected",2);O([_({type:Number})],C.prototype,"total",2);O([m()],C.prototype,"closed",2);C=O([Z("ticket-board-tree")],C);const Ut=2,jt=["closed","cancelled"],j=t=>String(t).padStart(2,"0"),K=t=>`${j(t.getHours())}:${j(t.getMinutes())}`,W=(t,e)=>t.getFullYear()===e.getFullYear()&&t.getMonth()===e.getMonth()&&t.getDate()===e.getDate();function Kt(t,e,s){const i=t.filter(n=>!jt.includes(n.status)),a=[],d=i.filter(n=>n.eta_at&&n.assignee).map(n=>({x:n,at:new Date(n.eta_at)})).filter(({at:n})=>!Number.isNaN(n.getTime())&&W(n,s)&&n.getTime()>=s.getTime()).sort((n,p)=>n.at.getTime()-p.at.getTime()).slice(0,Ut);for(const{x:n,at:p}of d)a.push({kind:"visit",time:K(p),label:`${v("bdVisit")} · ${n.assignee?.name??""}`,what:n.place_text||n.device_name,tone:"info",id:n.id});const o=i.filter(n=>n.sla_cell&&!n.sla_cell.over).map(n=>({x:n,at:new Date(n.sla_cell.at)})).filter(({at:n})=>!Number.isNaN(n.getTime())&&W(n,s)&&n.getTime()>=s.getTime()).sort((n,p)=>n.at.getTime()-p.at.getTime());if(o.length){const{x:n,at:p}=o[0];a.push({kind:"sla",time:K(p),label:v("bdSla"),what:`#${n.number} ${Tt(n.title,28)}`,tone:"warn",id:n.id})}return e.waiting>0&&a.push({kind:"waiting",time:"",label:v(e.waiting===1?"bdWaitingMineOne":"bdWaitingMine",{n:e.waiting}),what:"",tone:"ok",id:""}),a}const I=4;function Wt(t){return{on:Math.max(0,Math.min(I,t)),total:I,hot:t>=I}}var Qt=Object.defineProperty,Vt=Object.getOwnPropertyDescriptor,f=(t,e,s,i)=>{for(var a=i>1?void 0:i?Vt(e,s):e,d=t.length-1,o;d>=0;d--)(o=t[d])&&(a=(i?o(e,s,a):o(a))||a);return i&&a&&Qt(e,s,a),a};function y(t,e){if(!e){window.location.hash=t;return}const s=t.replace(/^#/,""),[i,a=""]=s.split("?");ht(i,new URLSearchParams(a))}let g=class extends Y{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.route=null,this.r=L(new URLSearchParams),this.module=null,this.meta=null,this.data=null,this.screen="loading",this.failed="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.treeHidden=!1,this.filterOpen=!1,this.showClosed=!1,this.drawerUsed=!1,this.now=new Date,this.q="",this.toast=null,this.filters={...z},this.panelCtl=new It(this,()=>this.filterOpen,t=>this.filterOpen=t),this.pendingQ=null,this.key="",this.seq=0,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.paged=window.matchMedia(A).matches,this.cardPage=1,this.fit=null,this.pagedMq=window.matchMedia(A),this.onPaged=()=>{this.paged=this.pagedMq.matches,this.fit=null,this.maxH={row:0,head:0,sub:0,cr:0},this.cardH.clear()},this.maxH={row:0,head:0,sub:0,cr:0},this.cardH=new Map,this.fitObserver=null,this.fitBox=null,this.pageCount=1,this.pageKey="",this.qTimer=0,this.live=new qt(()=>{this.now=new Date,this.screen==="ready"&&this.load(!0)}),this.toastTimer=0,this.offNames=null,this.pickMode=t=>{t!=="board"&&(pt(t==="calendar"),t!=="calendar"&&gt({view:t}),window.location.hash=it(ct()))},this.onCardAction=t=>{const{item:e,action:s}=t.detail;if(s==="open")y(this.hrefOf(e.id),!1);else if(s==="full")y(M(e.id),!1);else if(s==="copy"){const i=`${location.origin}${location.pathname}${location.search}${M(e.id)}`;navigator.clipboard?.writeText(i).then(()=>this.say(u("linkCopied"))).catch(()=>this.say(i))}},this.closeDrawer=()=>this.isConnected&&y(k(this.r),!1),this.onGone=t=>{if(this.closeDrawer(),t.detail?.deleted){this.say(Ft("deletedOne"));const e=t.detail.id;this.data&&(this.data={...this.data,items:this.data.items.filter(s=>s.id!==e),closed:this.data.closed.filter(s=>s.id!==e)})}this.load(!0)},this.resetFilters=()=>{this.filters={...z},(this.r.dept||this.r.assignee)&&this.go({dept:"",assignee:void 0})}}connectedCallback(){super.connectedCallback(),tt(this),this.phoneMq.addEventListener("change",this.onPhone),this.pagedMq.addEventListener("change",this.onPaged),this.offNames=rt(()=>this.requestUpdate()),this.live.start(),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),this.pagedMq.removeEventListener("change",this.onPaged),this.fitObserver?.disconnect(),this.fitObserver=null,this.fitBox=null,this.offNames?.(),this.live.stop(),window.clearTimeout(this.qTimer),window.clearTimeout(this.toastTimer)}updated(){_t(this.renderRoot,this.phone),this.watchFit()}pagedBoard(){return this.paged&&this.screen==="ready"&&this.r.pane!=="handlers"&&!!this.data?.items.length}watchFit(){const t=this.pagedBoard()?this.renderRoot.querySelector("[data-board-pages]"):null;t!==this.fitBox&&(this.fitObserver?.disconnect(),this.fitObserver=null,this.fitBox=t,t&&typeof ResizeObserver<"u"&&(this.fitObserver=new ResizeObserver(()=>this.measureFit()),this.fitObserver.observe(t))),t&&this.measureFit()}measureFit(){const t=this.fitBox;if(!t||!t.isConnected)return;const e=t.querySelector(".cgrid"),s=[...t.querySelectorAll(".cgrid > ticket-card")];if(!e||!s.length)return;const i=h=>Math.max(0,...[...t.querySelectorAll(h)].map($=>$.offsetHeight)),a=this.maxH;a.row=Math.max(a.row,...s.map(h=>h.offsetHeight));let d=!1;for(const h of s){const $=h.item?.id;$&&h.offsetHeight>(this.cardH.get($)??0)&&(this.cardH.set($,h.offsetHeight),d=!0)}a.head=Math.max(a.head,i(".fsec > .sh")),a.sub=Math.max(a.sub,i(".assignee-block > .sub")),a.cr=Math.max(a.cr,i(".closedrows > .cr"));const o=t.querySelector(".closedrows"),n=o?(parseFloat(getComputedStyle(o).paddingBlockStart)||0)+(parseFloat(getComputedStyle(o).paddingBlockEnd)||0):8,p={room:t.clientHeight,cols:ut(e),rowH:a.row,gap:P(e),headH:a.head||40,subH:a.sub||36,secGap:P(t.querySelector(":scope > .groups")),inGap:P(t.querySelector(".fsec")),blkGap:P(t.querySelector(".assignee-block"))||10,crH:a.cr||44,crPad:n},w=this.fit;(!w||d||Object.keys(p).some(h=>w[h]!==p[h]))&&(this.fit=p)}stripTip(t){const e=this.data;if(!e||t==="closed")return"";const s=t==="waiting"?i=>i.group==="waiting":t==="stuck"?i=>!!i.stuck:t==="unassigned"?i=>["new","returned"].includes(i.status):()=>!0;return ft(e.items.filter(s),this.now)}willUpdate(t){if(t.has("route")&&this.route){this.r=L(this.route.params),this.r.ticketId&&(this.drawerUsed=!0),(this.pendingQ===null||this.r.q!==this.pendingQ.trim())&&(this.q=this.r.q,this.pendingQ=null),(this.screen==="ready"||this.screen==="error")&&this.reloadIfNeeded();const s=[this.r.q,this.r.dept,this.r.place,this.r.state,this.r.pane].join("|");s!==this.pageKey&&(this.pageKey=s,this.cardPage=1)}const e=t;(e.has("filters")||e.has("showClosed"))&&(this.cardPage=1)}async boot(){try{const t=await D().module();if(this.module=t,nt(t.name),!t.enabled){this.screen="off";return}const[e,s]=await Promise.all([D().meta(),B().treeHidden().catch(()=>!1)]);this.meta=e,this.treeHidden=s,this.reloadIfNeeded(!0)}catch(t){this.fail(t)}}fail(t){t instanceof N&&t.status===403?this.screen="forbidden":t instanceof N&&t.status===404&&t.body.code==="feature_disabled"?this.screen="off":(this.failed=ot(t),this.screen="error")}queryKey(){return`${this.r.state}|${this.r.dept}|${this.r.place}|${this.r.q.trim()}|${this.r.assignee??""}`}reloadIfNeeded(t=!1){const e=this.queryKey();!t&&e===this.key||(this.key=e,this.load(!1))}async load(t){const e=++this.seq;!t&&!this.data&&(this.screen="loading");try{const s=await B().board({state:this.r.state,department_id:this.r.dept||void 0,place:this.r.place||void 0,q:this.r.q,assignee:this.r.assignee||void 0});if(e!==this.seq)return;this.data=s,this.now=new Date,this.screen="ready"}catch(s){if(e!==this.seq||t)return;this.fail(s)}}say(t,e="ok"){this.toast={text:t,tone:e},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,e==="bad"?7e3:3500)}assigneeName(){const t=this.r.assignee??"";return t==="none"?c("noAssigneeGroup"):(this.data?.items.find(s=>s.assignee_key===t)??this.data?.closed.find(s=>s.assignee_key===t))?.assignee?.name??this.data?.handling.find(s=>s.key===t)?.name??U("ldTitle")}ui(){return Bt(this.data?{...this.module,ui:{...this.module?.ui??{},...this.data.ui}}:this.module)}go(t,e=!1){y(k({...this.r,...t},{t:this.r.ticketId||void 0}),e)}onSearch(t){this.q=t,this.pendingQ=t,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>this.go({q:t},!0),300)}detailMode(){return this.module?.ui.detail??"drawer_fullscreen"}hrefOf(t,e=!1){if(this.detailMode()==="fullscreen")return M(t);const s=k(this.r,{t});return e?`${s}${s.includes("?")?"&":"?"}view=timeline`:s}async setTreeHidden(t){this.treeHidden=t;try{await B().setTreeHidden(t)}catch{}}chips(){const t=this.data,e=[];if(this.r.dept){const s=t?.departments.find(i=>i.id===this.r.dept);e.push({key:"department",label:s?s.name:v("tbDept"),remove:()=>this.go({dept:""})})}return this.r.assignee&&e.push({key:"assignee",label:this.assigneeName(),remove:()=>this.go({assignee:void 0}),attrs:{"data-assignee-filter":this.r.assignee,"aria-label":U("clearHandler",{name:this.assigneeName()})}}),t&&e.push(...mt([...t.items,...t.closed],this.filters,s=>this.filters=s)),e}panelBody(t,e=l){const s=this.data,i=s?.departments??[];return r`
      ${e===l?l:F(c("stateStrip"),e,"state")}
      ${i.length>1?F(v("tbDept"),r`<div class="fchips" role="group" aria-label=${u("departmentsGroup")} data-dept-chips>
        <button type="button" class="rc" aria-pressed=${String(!this.r.dept)} data-dept="" @click=${()=>this.go({dept:""})}>${u("allDepartments")}<small>${i.reduce((a,d)=>a+d.count,0)}</small></button>
        ${i.map(a=>r`<button type="button" class="rc" aria-pressed=${String(this.r.dept===a.id)} data-dept=${a.id} @click=${()=>this.go({dept:a.id})}>${S(a.name)}<small>${a.count}</small></button>`)}
      </div>`,"department"):l}
      ${t.treeInFilter&&s?F(v("tbPlace"),this.tree(s),"place"):l}
      ${s?bt([...s.items,...s.closed],this.filters,a=>this.filters=a):l}`}tree(t){const e=t.tree.reduce((s,i)=>s+(i.parent?0:i.count),0);return r`<ticket-board-tree .nodes=${t.tree} .selected=${this.r.place} .total=${e} @place-pick=${s=>this.go({place:s.detail.key})}></ticket-board-tree>`}header(){const t=this.data,e=this.ui(),s=R(e.board_floors,this.treeHidden,this.phone),i=this.screen==="ready"||this.screen==="loading",a=!!this.meta?.can.create,d=t&&s.chips?Ht(t.tree):[],o=this.r.pane==="handlers",n=this.chips(),p=this.meta?.can.manage?r`<div class="seg sm" role="radiogroup" aria-label=${u("dmPaneGroup")} data-board-pane>
          <button type="button" role="radio" aria-checked=${String(!o)} data-pane="cards" @click=${()=>this.go({pane:"cards"})}>${u("area")}</button>
          <button type="button" role="radio" aria-checked=${String(o)} data-pane="handlers" @click=${()=>this.go({pane:"handlers"})}>${u("hdTitle")}</button>
        </div>`:l,w=r`<div class="pact" slot="actions">
      ${this.phone?l:p}
      ${i&&!o?r`${wt("board",!0,this.pickMode)}
        ${a?r`<button type="button" class="btn primary newbtn" data-new aria-label=${u("newTitle")} @click=${()=>y(k(this.r,{create:!0}),!1)}>${x("plus")}<span class="lbl">${u("newShort")}</span></button>`:l}`:l}
    </div>`,h=t?r`<div class="seg sm stf" role="radiogroup" aria-label=${c("stateStrip")} data-state-strip>
          ${Mt(e.closed_strip,t.counts).map(b=>r`<button type="button" role="radio" aria-checked=${String(this.r.state===b.id)} data-state=${b.id} title=${this.stripTip(b.id)} @click=${()=>this.go({state:b.id})}>${b.label}<small>${b.count}</small></button>`)}
        </div>`:l,$=this.filterOpen?Dt(this.panelBody(s,this.phone?h:l),n.length,this.resetFilters,()=>this.filterOpen=!1):l,H=d.length>0&&!o;return r`${w}<header class="dh" data-board-header>
      ${H||this.phone&&p!==l?r`<div class="dh-row">
        ${this.phone?p:l}
        ${H?r`<div class="rooms" role="group" aria-label=${c("floors")} data-floor-chips>
          <button type="button" class="rc" aria-pressed=${String(!this.r.place)} data-place="" @click=${()=>this.go({place:""})}>${c("allFloors")}</button>
          ${d.map(b=>r`<button type="button" class="rc" aria-pressed=${String(this.r.place===b.key)} data-place=${b.key} @click=${()=>this.go({place:b.key})}>${S(et(b))}<small>${b.count}</small></button>`)}
        </div>`:l}
      </div>`:l}
      ${i&&!o?r`<div class="dh-det tb" role="group" aria-label=${v("lfGroup")} data-toolbar>
        ${this.phone?l:h}
        <label class="search">${x("search")}<span class="vh">${u("searchShort")}</span><input type="search" data-search maxlength="80" placeholder=${this.phone?u("searchShort"):u("search")} .value=${this.q} @input=${b=>this.onSearch(b.target.value)} /></label>
        <span class="fanchor">
          ${Nt(this.filterOpen,n.length,()=>this.filterOpen=!this.filterOpen,s.treeInFilter?"board":"")}
          ${this.phone?l:$}
        </span>
        ${At(n,this.resetFilters)}
        ${s.toggle&&this.treeHidden?r`<button type="button" class="btn sm treeshow" aria-pressed="false" data-tree-toggle @click=${()=>void this.setTreeHidden(!1)}>${x("tree")}${c("treeShow")}</button>`:l}
        ${this.pagedBoard()?this.pagerRow():l}
        ${this.phone?$:l}
      </div>`:l}
    </header>`}stateBox(t,e,s,i){return r`<div class="statebox glass" role="status" data-tickets-state=${s}><span class="ring">${x(t)}</span><b>${e}</b>${i??l}</div>`}card(t){const e=this.detailMode()!=="drawer";return r`<ticket-card .item=${t} .board=${!0} .role=${$t(t,this.meta)} .now=${this.now} .href=${this.hrefOf(t.id)} .timelineHref=${this.hrefOf(t.id,!0)} .fullScreen=${e} ?data-picked=${this.r.ticketId===t.id} @card-action=${this.onCardAction}></ticket-card>`}grid(t,e){return r`<div class="cgrid" data-cards=${e}>${lt(t,s=>s.id,s=>this.card(s))}</div>`}section(t,e,s,i,a){return r`<section class="fsec" data-section=${t}>
      <div class="sh"><h2>${e}</h2><span class="cnt" data-section-count>${i}</span><small>${s}</small></div>
      ${a}
    </section>`}handling(t,e=!1){const i=this.data.handling.filter(a=>t.some(d=>a.ids.includes(d.id)));return i.length<=1&&!e?this.grid(t,"handling"):r`${i.map(a=>{const d=t.filter(p=>a.ids.includes(p.id)),o=Wt(d.length),n=vt(d[0])[0];return r`<div class="assignee-block" data-assignee=${a.key}>
        <div class="hgroup sub">${n&&a.name?r`<span class=${`av ${n.kind}`} aria-hidden="true">${n.ini}</span>`:l}<b>${a.name?S(a.name):c("noAssigneeGroup")}</b><span>${v("bdHandlingBy",{n:a.count,age:Pt(a.oldest_at,this.now)})}</span>
          <span class="load" role="img" aria-label=${v("bdLoadLabel",{n:d.length})} data-load=${o.on}>${Array.from({length:o.total},(p,w)=>r`<i class=${w<o.on?o.hot&&w===o.total-1?"hot":"on":""}></i>`)}</span></div>
        ${this.grid(d,"handling")}
      </div>`})}`}today(t){const e=Kt(t.items,t.counts,this.now);return e.length?r`<div class="today glass" role="list" aria-label=${v("bdTodayGroup")} data-board-today><b>${v("bdToday")}</b>
      ${e.map(s=>s.id?r`<button type="button" class=${`up ${s.tone}`} role="listitem" data-today=${s.kind} @click=${()=>y(this.hrefOf(s.id),!1)}><i></i><time>${s.time}</time><span>${S(s.label)}</span>${s.what?r`<span class="what">${S(s.what)}</span>`:l}</button>`:r`<span class=${`up ${s.tone}`} role="listitem" data-today=${s.kind}><i></i><span>${s.label}</span></span>`)}
    </div>`:l}closedRows(t){return r`<div class="closedrows glass" data-cards="closed">${t.map(e=>r`<a class="cr" href=${this.hrefOf(e.id)} data-closed-row=${e.id} aria-label=${v("bdOpenRow",{n:e.number})}>
      <span class="num">#${e.number}</span><b>${e.title}</b><span class="hide-p">${e.assignee?.name?S(e.assignee.name):""}</span><span>${dt(e.closed_at??e.last_activity_at,this.now)}</span></a>`)}</div>`}cards(){const t=this.data,e=this.ui(),s=G(t.items,this.filters),i=G(t.closed,this.filters);if(!t.items.length)return this.r.q.trim()||this.r.dept||this.r.place||this.r.state!=="all"?this.stateBox("search",this.r.state!=="all"&&!this.r.q.trim()?c("emptyState"):u("emptyFiltered"),"no-match",r`<button type="button" class="btn sm" data-clear-filters @click=${()=>y(k({}),!1)}>${u("clearFilters")}</button>`):this.stateBox("ticket",c("emptyBoard"),"empty");if(!s.length&&!i.length)return this.stateBox("search",v("lfNoMatch"),"no-match-filters",r`<button type="button" class="btn sm" data-clear-card-filters @click=${()=>this.filters={...z}}>${x("x")}${v("lfClear")}</button>`);if(this.pagedBoard()&&this.fit)return this.pagedCards(s,i);if(!E(e.grouping,this.r.state))return this.grid(s,"flat");const a=q(s);return r`<div class="groups">
      ${a.waiting.length?this.section("waiting",c("grpWaiting"),c("grpWaitingSub"),a.waiting.length,this.grid(a.waiting,"waiting")):l}
      ${a.stuck.length?this.section("stuck",c("grpStuck"),c("grpStuckSub"),a.stuck.length,this.grid(a.stuck,"stuck")):l}
      ${a.handling.length?this.section("handling",c("grpHandling"),c("grpHandlingSub"),a.handling.length,this.handling(a.handling)):l}
      ${this.r.state==="all"&&e.closed_strip!=="hidden"&&i.length?r`<section class="fsec" data-section="closed">
        <div class="sh"><h2>${c("grpClosed")}</h2><span class="cnt">${i.length}</span>
          <button type="button" class="btn sm" aria-expanded=${String(this.showClosed)} data-closed-toggle @click=${()=>this.showClosed=!this.showClosed}>${this.showClosed?c("hideClosed"):c("showClosed")}</button></div>
        ${this.showClosed?this.closedRows(i):l}
      </section>`:l}
    </div>`}packSections(t,e){const s=this.data,i=this.ui(),a=this.fit,d=(p,w,h=!1)=>({key:p,sub:h,items:w,cols:a.cols,rowH:a.rowH,gap:a.gap,heightOf:$=>this.cardH.get($.id)});if(!E(i.grouping,this.r.state))return[{id:"flat",head:!1,groups:[d("flat",t)]}];const o=q(t),n=[];if(o.waiting.length&&n.push({id:"waiting",head:!0,groups:[d("waiting",o.waiting)]}),o.stuck.length&&n.push({id:"stuck",head:!0,groups:[d("stuck",o.stuck)]}),o.handling.length){const p=s.handling.filter(w=>o.handling.some(h=>w.ids.includes(h.id)));n.push({id:"handling",head:!0,groups:p.length<=1?[d("handling",o.handling)]:p.map(w=>d(`h:${w.key}`,o.handling.filter(h=>w.ids.includes(h.id)),!0))})}return this.r.state==="all"&&i.closed_strip!=="hidden"&&e.length&&n.push({id:"closed",head:!0,groups:this.showClosed?[{key:"closed",sub:!1,items:e,cols:1,rowH:a.crH,gap:0,pad:a.crPad}]:[]}),n}pagedCards(t,e){const s=this.fit,i=this.packSections(t,e),a=yt(i,{room:s.room,headH:s.headH,subH:s.subH,secGap:s.secGap,inGap:s.inGap,blkGap:s.blkGap});this.pageCount=Math.max(1,a.length);const d=Math.min(Math.max(1,this.cardPage),this.pageCount),o=a[d-1]??[],n=q(t),p=h=>h==="waiting"?n.waiting.length:h==="stuck"?n.stuck.length:h==="handling"?n.handling.length:e.length;return o.length===1&&o[0].id==="flat"?this.grid(o[0].groups[0]?.items??[],"flat"):r`<div class="groups">${o.map(h=>{const $=h.groups.flatMap(T=>T.items);if(h.id==="closed")return r`<section class="fsec" data-section="closed">
          <div class="sh"><h2>${c("grpClosed")}</h2><span class="cnt">${e.length}</span>
            <button type="button" class="btn sm" aria-expanded=${String(this.showClosed)} data-closed-toggle @click=${()=>this.showClosed=!this.showClosed}>${this.showClosed?c("hideClosed"):c("showClosed")}</button></div>
          ${this.showClosed&&$.length?this.closedRows($):l}
        </section>`;const H=i.find(T=>T.id===h.id)?.groups.some(T=>T.sub)??!1,b=h.id==="handling"?this.handling($,H):this.grid($,h.id),st=h.id==="waiting"?c("grpWaiting"):h.id==="stuck"?c("grpStuck"):c("grpHandling"),at=h.id==="waiting"?c("grpWaitingSub"):h.id==="stuck"?c("grpStuckSub"):c("grpHandlingSub");return this.section(h.id,st,at,p(h.id),b)})}</div>`}pagerRow(){if(this.pageCount<=1)return l;const t=Math.min(Math.max(1,this.cardPage),this.pageCount);return r`<sw-pager class="bpager" data-board-pager .page=${t} .pages=${this.pageCount} @page-change=${e=>this.cardPage=e.detail.page}></sw-pager>`}body(){switch(this.screen){case"loading":{const a=r`<ticket-card skeleton .board=${!0}></ticket-card>`;return r`<div data-tickets-state="loading" aria-busy="true"><div class="cgrid">${Array.from({length:this.phone?3:6},()=>a)}</div></div>`}case"off":return this.stateBox("ticket",u("moduleOff"),"off");case"forbidden":return this.stateBox("lock",c("notManager"),"forbidden");case"error":return this.stateBox("warning",u("loadFailed"),"error",r`${this.failed?r`<span class="vh" data-error-detail>${this.failed}</span>`:l}<button type="button" class="btn sm" data-retry @click=${()=>{this.screen="loading",this.data=null,this.boot()}}>${x("refresh")}${u("retry")}</button>`)}if(this.r.pane==="handlers")return r`<tickets-handlers embedded data-board-handlers></tickets-handlers>`;const t=this.data,e=this.ui(),s=R(e.board_floors,this.treeHidden,this.phone),i=t.counts.stuck>0&&this.r.state!=="stuck"?r`<div class="banner warn" role="status" data-stuck-banner>${x("warning")}<div><b>${c("banner",{n:t.counts.stuck})}</b></div><button type="button" class="btn sm" data-stuck-go @click=${()=>this.go({state:"stuck"})}>${c("bannerGo")}</button></div>`:l;return r`
      ${this.today(t)}
      <div class=${`layout${s.tree?" with-tree":""}`}>
        ${s.tree?r`<aside class="side" aria-label=${v("tbTree")}>
          ${s.toggle?r`<div class="sidehead"><b>${c("floors")}</b><button type="button" class="btn sm" aria-pressed="true" data-tree-toggle @click=${()=>void this.setTreeHidden(!0)}>${x("tree")}${c("treeHide")}</button></div>`:l}
          ${this.tree(t)}
        </aside>`:l}
        <div class="groups" data-board-main>
          ${i}
          ${this.pagedBoard()?r`<div class="pgbox" data-board-pages data-page=${Math.min(Math.max(1,this.cardPage),this.pageCount)} data-pages=${this.pageCount}>${this.cards()}</div>`:this.cards()}
          ${t.truncated?r`<div class="note" data-truncated>${c("truncated")}</div>`:l}
        </div>
      </div>`}render(){const t=this.module?.ui,e=!!this.r.ticketId&&this.screen==="ready";this.pageCount=1;const s=this.body();return r`<sw-page class="page" wide data-screen="tickets-board" heading=${u("area")} data-tickets-title=${u("area")}>
      ${this.header()}
      <div class=${`scr${this.pagedBoard()?" paged":""}`} data-board-scroll>${s}</div>
    </sw-page>
    ${this.drawerUsed&&this.module?.enabled?r`<ticket-detail mode="drawer" .open=${e} .ticketId=${this.r.ticketId} .detailMode=${t?.detail??"drawer_fullscreen"} .scope=${"department"} .focusTimeline=${this.route?.params.get("view")==="timeline"} .initialTab=${this.route?.params.get("tab")??""}
      .defaultTab=${t?.detail_tab??""} .sizeSetting=${t?.drawer_size??""} .sheetSetting=${t?.phone_sheet??""} .cameraViewfinder=${t?.camera_viewfinder===!0} .assignContact=${St(this.route?.params.get("assign"))}
      @assign-consumed=${()=>y(k(this.r,{t:this.r.ticketId}),!0)}
      @drawer-close=${this.closeDrawer} @ticket-changed=${()=>void this.load(!0)} @ticket-gone=${this.onGone}></ticket-detail>`:l}
    ${this.module?.enabled&&this.meta?.can.create?r`<ticket-create .open=${this.r.creating&&this.screen==="ready"} .meta=${this.meta} .mode=${t?.new_ticket??"sheet"} .scope=${"department"} .detailMode=${t?.detail??"drawer_fullscreen"}
      @close=${()=>y(k(this.r),!1)} @created=${i=>{const a=i.detail;this.say(a.failedPhotos?u("photosFailed",{n:a.failedPhotos}):u(a.result==="absorbed"?"absorbed":"created",{n:a.number}),a.failedPhotos?"bad":"ok");const d=this.detailMode()==="fullscreen"?M(a.id):k(this.r,{t:a.id});y(a.assignContact&&a.result==="created"?Ct(d,a.assignContact):d,!0),this.load(!1)}}></ticket-create>`:l}
    ${this.toast?r`<div class=${`banner flt ${this.toast.tone==="bad"?"bad":"info"}`} role="status" data-tickets-toast>${x(this.toast.tone==="bad"?"warning":"check")}<div>${this.toast.text}</div></div>`:l}`}};g.styles=[Q,...J,zt,xt,kt,Gt,V`
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
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
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
    /* NOSCROLL-297 + TICKETS-POLISH-2331 (owner rule: a control screen fits the viewport): from a tablet up, below the header the board (the
       today row, the tree, the groups of cards) scrolls in its own region - the page itself never scrolls and the controls stay in place;
       the tree stays beside the cards (sticky inside the region). On a phone the region is transparent and the page scrolls. */
    .scr {
      display: contents;
    }
    /* AUDIT30-C-TICKETS (#6): the page is sw-page (its own header row: the title and the actions slot). The frame's own gap and
       padding give way to the glass page's (.page, styles/media-page.ts); the toolbar header under it no longer sticks or compacts - the
       title it compacted moved into the frame (on a phone the page scrolls, the toolbar with it). */
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
      .scr {
        margin-inline: -24px;
        padding-inline: 24px;
      }
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
      .flt {
        inset-block-end: calc(84px + env(safe-area-inset-bottom, 0px));
      }
    }
  `,Lt];f([_({attribute:!1})],g.prototype,"route",2);f([m()],g.prototype,"r",2);f([m()],g.prototype,"module",2);f([m()],g.prototype,"meta",2);f([m()],g.prototype,"data",2);f([m()],g.prototype,"screen",2);f([m()],g.prototype,"failed",2);f([m()],g.prototype,"phone",2);f([m()],g.prototype,"treeHidden",2);f([m()],g.prototype,"filterOpen",2);f([m()],g.prototype,"showClosed",2);f([m()],g.prototype,"drawerUsed",2);f([m()],g.prototype,"now",2);f([m()],g.prototype,"q",2);f([m()],g.prototype,"toast",2);f([m()],g.prototype,"filters",2);f([m()],g.prototype,"paged",2);f([m()],g.prototype,"cardPage",2);f([m()],g.prototype,"fit",2);g=f([Z("tickets-board")],g);export{g as TicketsBoard};
