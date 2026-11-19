import{i as m,aL as h,m as f,eD as k,a as u,n as w,eE as g,b as r,o as c,A as b,eF as v,c3 as y,aU as $,g as x,ax as P,j as p,k as S}from"./index-I3FcVZcW.js";import"./ticket-detail-DHBkaGSr.js";import"./sw-skeleton-RnSKtyzU.js";import{a as _}from"./automations-glass-CJbQT5xX.js";import{m as C}from"./media-page-D7s0HmC1.js";import{a as A}from"./glass-D9p1NePu.js";import{g as I}from"./map-text-DIn0fMxv.js";import{t as O}from"./chip-selected-DOPw4H17.js";import"./sw-logo-art-PLtEZJxU.js";import"./lead-reserve-FJ8OhCp4.js";import"./tickets-costs-D2iUfn8o.js";import"./tickets-costs-mock-BjG0oLo5.js";import"./cost-model-DzVuSBtz.js";import"./bytes-QYSxC3WX.js";import"./pad-CImDeuHV.js";import"./drawer-model-jsjIsG9G.js";import"./drawer-text-BpoOw4ob.js";import"./icons-Ct2esSLZ.js";import"./tickets-s4-BcQkUfIa.js";import"./org-locations-text-bBatW56-.js";import"./readiness-model-DGhavIGL.js";import"./geometry-DfTQZlKq.js";import"./board-model-BxCIt7cs.js";import"./location-picker-DvCzyVCp.js";var D=Object.defineProperty,M=Object.getOwnPropertyDescriptor,s=(t,a,l,o)=>{for(var e=o>1?void 0:o?M(a,l):a,n=t.length-1,d;n>=0;n--)(d=t[n])&&(e=(o?d(a,l,e):d(e))||e);return o&&e&&D(a,l,e),e};let i=class extends m{constructor(){super(...arguments),this.bubbleSkin=new h(this),this.ticketId="",this.module=null,this.failed="",this.off=!1,this.retry=()=>{this.failed="",this.module=null,this.loadModule()}}connectedCallback(){super.connectedCallback(),A(this),this.loadModule()}async loadModule(){this.failed="";try{const t=await f().module();this.module=t,k(t.name),this.off=!t.enabled}catch(t){t instanceof u&&t.status===404?this.off=!0:this.failed=w(t)}}skeleton(){return r`<div class="page" data-tickets-state="loading" role="status" aria-busy="true" aria-label=${g("states.loading")}>
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
