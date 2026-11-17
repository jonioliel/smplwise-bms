import{a as h,S as m,O as f,Q as u,R as k,ak as w,u as g,q as r,a0 as c,p as b,pi as v,ge as y,a4 as $,i as x,n as S,r as p,x as P}from"./index-C5kZ9jiu.js";import"./ticket-detail-CNdFNj50.js";import"./sw-skeleton-BZrl5ozo.js";import{a as _}from"./automations-glass-B-MfZHsT.js";import{a as C}from"./media-page-BF4b5gDG.js";import{a as O}from"./automations-demo-CVgZlSKD.js";import{j as A}from"./map-text-Brg0AnNJ.js";import{t as I}from"./chip-selected-HVnpKhPo.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-BLWZG4KN.js";import"./tickets-costs-Pd4vi3A4.js";import"./tickets-costs-mock-CxjE8wVv.js";import"./cost-model-DzWhsEJZ.js";import"./drawer-model-B-q6j3tS.js";import"./drawer-text-BhoJR86g.js";import"./icons-Cmf7CqDT.js";import"./tickets-s4-CBaTYz_V.js";import"./org-locations-text-BQNxbGxD.js";import"./readiness-model-DGhavIGL.js";import"./geometry-BRPhtaBC.js";import"./board-model-mWgRm0aP.js";import"./location-picker-FXrg4h6C.js";var M=Object.defineProperty,T=Object.getOwnPropertyDescriptor,s=(t,i,l,o)=>{for(var e=o>1?void 0:o?T(i,l):i,n=t.length-1,d;n>=0;n--)(d=t[n])&&(e=(o?d(i,l,e):d(e))||e);return o&&e&&M(i,l,e),e};let a=class extends h{constructor(){super(...arguments),this.bubbleSkin=new m(this),this.ticketId="",this.module=null,this.failed="",this.off=!1,this.retry=()=>{this.failed="",this.module=null,this.loadModule()}}connectedCallback(){super.connectedCallback(),O(this),this.loadModule()}async loadModule(){this.failed="";try{const t=await f().module();this.module=t,u(t.name),this.off=!t.enabled}catch(t){t instanceof k&&t.status===404?this.off=!0:this.failed=w(t)}}skeleton(){return r`<div class="page" data-tickets-state="loading" role="status" aria-busy="true" aria-label=${g("states.loading")}>
      <div class="sk" aria-hidden="true">
        <sw-skeleton variant="block" height="36px" width="120px"></sw-skeleton>
        <sw-skeleton variant="block" height="96px"></sw-skeleton>
        <sw-skeleton variant="block" height="44px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
      </div>
    </div>`}render(){if(this.off)return r`<div class="page"><sw-state-panel icon="ticket" state="empty" quiet heading=${c("moduleOff")} data-tickets-state="off"></sw-state-panel></div>`;if(this.failed)return r`<div class="page"><sw-state-panel state="error" hint=${this.failed} actionLabel=${c("retry")} data-tickets-state="error" @action=${this.retry}></sw-state-panel></div>`;if(!this.module)return this.skeleton();const t=new URLSearchParams(window.location.hash.split("?")[1]??""),i=t.get("tab")??(t.get("view")==="timeline"?"history":"");return r`<ticket-detail mode="page" .ticketId=${this.ticketId} .detailMode=${this.module.ui.detail} .scope=${v()} .initialTab=${i}
      .defaultTab=${this.module.ui.detail_tab??""} .cameraViewfinder=${this.module.ui.camera_viewfinder===!0} .assignContact=${A(t.get("assign"))}
      @assign-consumed=${()=>history.replaceState(history.state,"",`${window.location.pathname}${window.location.search}${y(this.ticketId)}`)}
      data-screen="tickets-detail"></ticket-detail>${b}`}};a.styles=[$,..._,C,x`
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
  `,I];s([S()],a.prototype,"ticketId",2);s([p()],a.prototype,"module",2);s([p()],a.prototype,"failed",2);s([p()],a.prototype,"off",2);a=s([P("tickets-detail")],a);export{a as TicketsDetailPage};
//# sourceMappingURL=tickets-detail-BzyLUTg1.js.map
