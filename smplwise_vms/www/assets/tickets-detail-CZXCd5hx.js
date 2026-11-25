import{i as m,aW as h,ev as f,a as k,o as u,n as w,b as r,F as c,A as g,ew as b,cz as v,g as y,y as $,j as p,k as x}from"./index-BMsqo0rz.js";import"./ticket-detail-CsBl751P.js";import"./sw-skeleton-DB2iaNdX.js";import{a as P}from"./automations-glass-BgLCjhWe.js";import{m as S}from"./media-page-C65_kzGa.js";import{a as _}from"./glass-DM_gu6XR.js";import{b as C}from"./bubble-chrome-CmexCsTg.js";import{t as A}from"./tickets-0SH0-67T.js";import{g as I}from"./map-text-BFOSmKbd.js";import{t as O}from"./chip-selected-Clb1F15y.js";import"./sw-logo-art-PLtEZJxU.js";import"./lead-reserve-D7SP1eio.js";import"./tickets-costs-D9eVuKUF.js";import"./tickets-costs-mock-N9TL2r_C.js";import"./cost-model-Bp5BWkqK.js";import"./bytes-QYSxC3WX.js";import"./pad-CImDeuHV.js";import"./drawer-model-B3GJhq4g.js";import"./drawer-text-CirSe9t8.js";import"./icons-DXwZE_AT.js";import"./tickets-s4-D21FsEz-.js";import"./org-locations-text-X_p7Pf6A.js";import"./readiness-model-DGhavIGL.js";import"./model-DVq4yCP1.js";import"./maintenance-ByJIbLtP.js";import"./geometry-NthfSGbB.js";import"./board-model-LdJJfvhG.js";import"./location-picker-BJE2QZ3O.js";import"./device-activity-logic-OF71nI4m.js";var M=Object.defineProperty,T=Object.getOwnPropertyDescriptor,a=(t,s,l,o)=>{for(var e=o>1?void 0:o?T(s,l):s,n=t.length-1,d;n>=0;n--)(d=t[n])&&(e=(o?d(s,l,e):d(e))||e);return o&&e&&M(s,l,e),e};let i=class extends m{constructor(){super(...arguments),this.bubbleSkin=new h(this),this.ticketId="",this.module=null,this.failed="",this.off=!1,this.retry=()=>{this.failed="",this.module=null,this.loadModule()}}connectedCallback(){super.connectedCallback(),_(this),this.loadModule()}async loadModule(){this.failed="";try{const t=await A().module();this.module=t,f(t.name),this.off=!t.enabled}catch(t){t instanceof k&&t.status===404?this.off=!0:this.failed=u(t)}}skeleton(){return r`<div class="page" data-tickets-state="loading" role="status" aria-busy="true" aria-label=${w("states.loading")}>
      <div class="sk" aria-hidden="true">
        <sw-skeleton variant="block" height="36px" width="120px"></sw-skeleton>
        <sw-skeleton variant="block" height="96px"></sw-skeleton>
        <sw-skeleton variant="block" height="44px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
      </div>
    </div>`}render(){if(this.off)return r`<div class="page"><sw-state-panel icon="ticket" state="empty" quiet heading=${c("moduleOff")} data-tickets-state="off"></sw-state-panel></div>`;if(this.failed)return r`<div class="page"><sw-state-panel state="error" hint=${this.failed} actionLabel=${c("retry")} data-tickets-state="error" @action=${this.retry}></sw-state-panel></div>`;if(!this.module)return this.skeleton();const t=new URLSearchParams(window.location.hash.split("?")[1]??""),s=t.get("tab")??(t.get("view")==="timeline"?"history":"");return r`<ticket-detail mode="page" .ticketId=${this.ticketId} .detailMode=${this.module.ui.detail} .scope=${b()} .initialTab=${s}
      .defaultTab=${this.module.ui.detail_tab??""} .cameraViewfinder=${this.module.ui.camera_viewfinder===!0} .assignContact=${I(t.get("assign"))}
      @assign-consumed=${()=>history.replaceState(history.state,"",`${window.location.pathname}${window.location.search}${v(this.ticketId)}`)}
      data-screen="tickets-detail"></ticket-detail>${g}`}};i.styles=[C,...P,S,y`
    .page {
      padding: 0;
    }
    .sk {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      /* the full ticket's own frame (ticket-detail .page: 18 / 36 / 44) so the skeleton and the ticket start at the same place */
      padding: var(--sw-s-4) var(--sw-s-8) var(--sw-s-8);
      box-sizing: border-box;
    }
    @media (max-width: 767px) {
      .sk {
        padding-inline: var(--sw-s-4);
      }
    }
  `,O];a([$()],i.prototype,"ticketId",2);a([p()],i.prototype,"module",2);a([p()],i.prototype,"failed",2);a([p()],i.prototype,"off",2);i=a([x("tickets-detail")],i);export{i as TicketsDetailPage};
