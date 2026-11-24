import{i as c,aK as h,eo as f,a as k,m as u,cO as w,b as r,n as m,A as g,ep as b,cm as v,g as y,aw as $,j as p,k as x}from"./index-BYRaM0w7.js";import"./ticket-detail-Cj4gVRqf.js";import"./sw-skeleton-DYXTx-mw.js";import{a as P}from"./automations-glass-FYBCneut.js";import{m as S}from"./media-page-xJntw39i.js";import{a as _}from"./glass-bnFXhDA8.js";import{b as C}from"./bubble-chrome-BtjbJxHL.js";import{t as O}from"./tickets-D6e_Iy8U.js";import{g as A}from"./map-text-cdz1P3Nu.js";import{t as I}from"./chip-selected-ssWpaRGx.js";import"./sw-logo-art-PLtEZJxU.js";import"./lead-reserve-D_HTSLNo.js";import"./tickets-costs-Da7BBvOt.js";import"./tickets-costs-mock-DDgw3G2E.js";import"./cost-model-BFPuusVw.js";import"./bytes-QYSxC3WX.js";import"./pad-CImDeuHV.js";import"./drawer-model-DrRJpAVR.js";import"./drawer-text-BGYSIb8t.js";import"./icons-DNYkOf6T.js";import"./tickets-s4-DTTkiSie.js";import"./org-locations-text-C7NPbiyd.js";import"./readiness-model-DGhavIGL.js";import"./model-x7X0GErk.js";import"./maintenance-CCS1_VIe.js";import"./geometry-Cdz-oK98.js";import"./board-model-DEGNf_DV.js";import"./location-picker-LzkGx7dF.js";import"./device-activity-logic-CwmZbdyX.js";var M=Object.defineProperty,T=Object.getOwnPropertyDescriptor,a=(t,s,l,o)=>{for(var e=o>1?void 0:o?T(s,l):s,n=t.length-1,d;n>=0;n--)(d=t[n])&&(e=(o?d(s,l,e):d(e))||e);return o&&e&&M(s,l,e),e};let i=class extends c{constructor(){super(...arguments),this.bubbleSkin=new h(this),this.ticketId="",this.module=null,this.failed="",this.off=!1,this.retry=()=>{this.failed="",this.module=null,this.loadModule()}}connectedCallback(){super.connectedCallback(),_(this),this.loadModule()}async loadModule(){this.failed="";try{const t=await O().module();this.module=t,f(t.name),this.off=!t.enabled}catch(t){t instanceof k&&t.status===404?this.off=!0:this.failed=u(t)}}skeleton(){return r`<div class="page" data-tickets-state="loading" role="status" aria-busy="true" aria-label=${w("states.loading")}>
      <div class="sk" aria-hidden="true">
        <sw-skeleton variant="block" height="36px" width="120px"></sw-skeleton>
        <sw-skeleton variant="block" height="96px"></sw-skeleton>
        <sw-skeleton variant="block" height="44px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
      </div>
    </div>`}render(){if(this.off)return r`<div class="page"><sw-state-panel icon="ticket" state="empty" quiet heading=${m("moduleOff")} data-tickets-state="off"></sw-state-panel></div>`;if(this.failed)return r`<div class="page"><sw-state-panel state="error" hint=${this.failed} actionLabel=${m("retry")} data-tickets-state="error" @action=${this.retry}></sw-state-panel></div>`;if(!this.module)return this.skeleton();const t=new URLSearchParams(window.location.hash.split("?")[1]??""),s=t.get("tab")??(t.get("view")==="timeline"?"history":"");return r`<ticket-detail mode="page" .ticketId=${this.ticketId} .detailMode=${this.module.ui.detail} .scope=${b()} .initialTab=${s}
      .defaultTab=${this.module.ui.detail_tab??""} .cameraViewfinder=${this.module.ui.camera_viewfinder===!0} .assignContact=${A(t.get("assign"))}
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
  `,I];a([$()],i.prototype,"ticketId",2);a([p()],i.prototype,"module",2);a([p()],i.prototype,"failed",2);a([p()],i.prototype,"off",2);i=a([x("tickets-detail")],i);export{i as TicketsDetailPage};
