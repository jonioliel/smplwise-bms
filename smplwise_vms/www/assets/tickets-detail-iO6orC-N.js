import{i as c,aK as h,eo as f,a as k,m as u,cO as w,b as r,n as m,A as g,ep as b,cm as v,g as y,aw as $,j as p,k as x}from"./index-eHtAZ44A.js";import"./ticket-detail-CUE4diFn.js";import"./sw-skeleton-BxOGX37X.js";import{a as P}from"./automations-glass-DLYdljCh.js";import{m as S}from"./media-page-Zm3L9jbY.js";import{a as _}from"./glass-DPaC1cdZ.js";import{b as C}from"./bubble-chrome-DOL7l61i.js";import{t as O}from"./tickets-DDZQK1BN.js";import{g as A}from"./map-text-DIyz28TN.js";import{t as I}from"./chip-selected-DUnPnljl.js";import"./sw-logo-art-PLtEZJxU.js";import"./lead-reserve-CHwtOPqC.js";import"./tickets-costs-DmBWXaVP.js";import"./tickets-costs-mock-Cq1JwjxP.js";import"./cost-model-B59q-d5l.js";import"./bytes-QYSxC3WX.js";import"./pad-CImDeuHV.js";import"./drawer-model-CukwrJsa.js";import"./drawer-text-C7P45eW3.js";import"./icons-WoM0xGTL.js";import"./tickets-s4-CvsWvZPM.js";import"./org-locations-text-BoD2rUCa.js";import"./readiness-model-DGhavIGL.js";import"./model-BGBhXdF0.js";import"./maintenance-CNWbOvUU.js";import"./geometry-CargtvfA.js";import"./board-model-IyapGYIf.js";import"./location-picker-DR-SViya.js";import"./device-activity-logic-ag1iWTCn.js";var M=Object.defineProperty,T=Object.getOwnPropertyDescriptor,a=(t,s,l,o)=>{for(var e=o>1?void 0:o?T(s,l):s,n=t.length-1,d;n>=0;n--)(d=t[n])&&(e=(o?d(s,l,e):d(e))||e);return o&&e&&M(s,l,e),e};let i=class extends c{constructor(){super(...arguments),this.bubbleSkin=new h(this),this.ticketId="",this.module=null,this.failed="",this.off=!1,this.retry=()=>{this.failed="",this.module=null,this.loadModule()}}connectedCallback(){super.connectedCallback(),_(this),this.loadModule()}async loadModule(){this.failed="";try{const t=await O().module();this.module=t,f(t.name),this.off=!t.enabled}catch(t){t instanceof k&&t.status===404?this.off=!0:this.failed=u(t)}}skeleton(){return r`<div class="page" data-tickets-state="loading" role="status" aria-busy="true" aria-label=${w("states.loading")}>
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
