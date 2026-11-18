import{i as m,aL as h,m as f,ew as k,a as u,n as w,ex as g,b as r,o as c,A as b,ey as v,c0 as y,aU as $,g as x,ay as P,j as p,k as S}from"./index-BiEy1mLY.js";import"./ticket-detail-tcw_C9RE.js";import"./sw-skeleton-B0T2-tjV.js";import{a as _}from"./automations-glass-_wY1ETnM.js";import{m as C}from"./media-page-CPGboGx6.js";import{a as A}from"./automations-demo-E2y7OyTr.js";import{g as I}from"./map-text-ChSJ9XeQ.js";import{t as O}from"./chip-selected-DauJJV6F.js";import"./sw-logo-art-MaHPMZFI.js";import"./lead-reserve-D13nYoI5.js";import"./tickets-costs-COX8Ibju.js";import"./tickets-costs-mock-DD1h5IQ3.js";import"./cost-model-B0oaVmhC.js";import"./bytes-QYSxC3WX.js";import"./pad-CImDeuHV.js";import"./drawer-model-Ccb_v6sN.js";import"./drawer-text-krR6tlzw.js";import"./icons-Cq2xrRkE.js";import"./tickets-s4-DoLx7Phf.js";import"./org-locations-text-5b6FQFyH.js";import"./readiness-model-DGhavIGL.js";import"./geometry-DApTBo2s.js";import"./board-model-Bb8O82gk.js";import"./location-picker-DxUCZCqp.js";var M=Object.defineProperty,T=Object.getOwnPropertyDescriptor,s=(t,a,l,o)=>{for(var e=o>1?void 0:o?T(a,l):a,n=t.length-1,d;n>=0;n--)(d=t[n])&&(e=(o?d(a,l,e):d(e))||e);return o&&e&&M(a,l,e),e};let i=class extends m{constructor(){super(...arguments),this.bubbleSkin=new h(this),this.ticketId="",this.module=null,this.failed="",this.off=!1,this.retry=()=>{this.failed="",this.module=null,this.loadModule()}}connectedCallback(){super.connectedCallback(),A(this),this.loadModule()}async loadModule(){this.failed="";try{const t=await f().module();this.module=t,k(t.name),this.off=!t.enabled}catch(t){t instanceof u&&t.status===404?this.off=!0:this.failed=w(t)}}skeleton(){return r`<div class="page" data-tickets-state="loading" role="status" aria-busy="true" aria-label=${g("states.loading")}>
      <div class="sk" aria-hidden="true">
        <sw-skeleton variant="block" height="36px" width="120px"></sw-skeleton>
        <sw-skeleton variant="block" height="96px"></sw-skeleton>
        <sw-skeleton variant="block" height="44px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
      </div>
    </div>`}render(){if(this.off)return r`<div class="page"><sw-state-panel icon="ticket" state="empty" quiet heading=${c("moduleOff")} data-tickets-state="off"></sw-state-panel></div>`;if(this.failed)return r`<div class="page"><sw-state-panel state="error" hint=${this.failed} actionLabel=${c("retry")} data-tickets-state="error" @action=${this.retry}></sw-state-panel></div>`;if(!this.module)return this.skeleton();const t=new URLSearchParams(window.location.hash.split("?")[1]??""),a=t.get("tab")??(t.get("view")==="timeline"?"history":"");return r`<ticket-detail mode="page" .ticketId=${this.ticketId} .detailMode=${this.module.ui.detail} .scope=${v()} .initialTab=${a}
      .defaultTab=${this.module.ui.detail_tab??""} .cameraViewfinder=${this.module.ui.camera_viewfinder===!0} .assignContact=${I(t.get("assign"))}
      @assign-consumed=${()=>history.replaceState(history.state,"",`${window.location.pathname}${window.location.search}${y(this.ticketId)}`)}
      data-screen="tickets-detail"></ticket-detail>${b}`}};i.styles=[$,..._,C,x`
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
  `,O];s([P()],i.prototype,"ticketId",2);s([p()],i.prototype,"module",2);s([p()],i.prototype,"failed",2);s([p()],i.prototype,"off",2);i=s([S("tickets-detail")],i);export{i as TicketsDetailPage};
