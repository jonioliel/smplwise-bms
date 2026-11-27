import{a as m,aX as h,ew as f,c as k,q as u,o as w,b as r,G as c,A as b,ex as g,cA as v,j as y,z as $,k as p,m as x}from"./index-B3MtI4W-.js";import"./ticket-detail-CBQ3CnTe.js";import"./sw-skeleton-78_GMMwV.js";import{a as P}from"./automations-glass-BP5krgoU.js";import{m as S}from"./media-page-DpGZwAVC.js";import{a as _}from"./glass-bL_AXho4.js";import{b as C}from"./bubble-chrome-DDhlu7Od.js";import{t as A}from"./tickets-CE4rMzgG.js";import{g as I}from"./map-text-cT-JyEtl.js";import{t as O}from"./chip-selected-CxSReOPV.js";import"./sw-logo-art-PLtEZJxU.js";import"./lead-reserve-BBsL3MFV.js";import"./tickets-costs-iWkooE7O.js";import"./tickets-costs-mock-suvEtiPG.js";import"./cost-model-Ct41sltc.js";import"./bytes-QYSxC3WX.js";import"./pad-CImDeuHV.js";import"./drawer-model-BxPwYfmM.js";import"./drawer-text-BGLxJxdg.js";import"./icons-BbMi22MC.js";import"./tickets-s4-xHG5XsX6.js";import"./org-locations-text-BUJLxQWF.js";import"./readiness-model-DGhavIGL.js";import"./model-DCo-IHFf.js";import"./maintenance-BEPwjytB.js";import"./geometry-BqTXxfVy.js";import"./board-model-BHHFlV6e.js";import"./location-picker-BcSwBSOn.js";import"./device-activity-logic-Co4Bx7ZI.js";var M=Object.defineProperty,T=Object.getOwnPropertyDescriptor,a=(t,s,l,o)=>{for(var e=o>1?void 0:o?T(s,l):s,n=t.length-1,d;n>=0;n--)(d=t[n])&&(e=(o?d(s,l,e):d(e))||e);return o&&e&&M(s,l,e),e};let i=class extends m{constructor(){super(...arguments),this.bubbleSkin=new h(this),this.ticketId="",this.module=null,this.failed="",this.off=!1,this.retry=()=>{this.failed="",this.module=null,this.loadModule()}}connectedCallback(){super.connectedCallback(),_(this),this.loadModule()}async loadModule(){this.failed="";try{const t=await A().module();this.module=t,f(t.name),this.off=!t.enabled}catch(t){t instanceof k&&t.status===404?this.off=!0:this.failed=u(t)}}skeleton(){return r`<div class="page" data-tickets-state="loading" role="status" aria-busy="true" aria-label=${w("states.loading")}>
      <div class="sk" aria-hidden="true">
        <sw-skeleton variant="block" height="36px" width="120px"></sw-skeleton>
        <sw-skeleton variant="block" height="96px"></sw-skeleton>
        <sw-skeleton variant="block" height="44px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
      </div>
    </div>`}render(){if(this.off)return r`<div class="page"><sw-state-panel icon="ticket" state="empty" quiet heading=${c("moduleOff")} data-tickets-state="off"></sw-state-panel></div>`;if(this.failed)return r`<div class="page"><sw-state-panel state="error" hint=${this.failed} actionLabel=${c("retry")} data-tickets-state="error" @action=${this.retry}></sw-state-panel></div>`;if(!this.module)return this.skeleton();const t=new URLSearchParams(window.location.hash.split("?")[1]??""),s=t.get("tab")??(t.get("view")==="timeline"?"history":"");return r`<ticket-detail mode="page" .ticketId=${this.ticketId} .detailMode=${this.module.ui.detail} .scope=${g()} .initialTab=${s}
      .defaultTab=${this.module.ui.detail_tab??""} .cameraViewfinder=${this.module.ui.camera_viewfinder===!0} .assignContact=${I(t.get("assign"))}
      @assign-consumed=${()=>history.replaceState(history.state,"",`${window.location.pathname}${window.location.search}${v(this.ticketId)}`)}
      data-screen="tickets-detail"></ticket-detail>${b}`}};i.styles=[C,...P,S,y`
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
