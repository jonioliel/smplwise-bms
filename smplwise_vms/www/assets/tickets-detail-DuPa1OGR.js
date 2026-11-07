import{a as h,S as u,b as m,f,s as k,j as w,T as b,eF as g,e as l,p,A as v,oo as y,nA as $,hJ as x,C as P,D as S,E as _,F as C,G as c,H as A}from"./index-Cke5lP-r.js";import"./ticket-detail-CiSVUV3d.js";import"./sw-skeleton-CM4TZDBB.js";import{a as I}from"./media-page-CzJuqDHm.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-DxMhFGc7.js";import"./drawer-model-Dx1Q6w_Q.js";import"./geometry-BGPrGIcA.js";import"./board-model-D4eixn5P.js";var O=Object.defineProperty,T=Object.getOwnPropertyDescriptor,i=(t,a,r,o)=>{for(var e=o>1?void 0:o?T(a,r):a,n=t.length-1,d;n>=0;n--)(d=t[n])&&(e=(o?d(a,r,e):d(e))||e);return o&&e&&O(a,r,e),e};let s=class extends h{constructor(){super(...arguments),this.bubbleSkin=new u(this),this.ticketId="",this.module=null,this.failed="",this.off=!1,this.retry=()=>{this.failed="",this.module=null,this.loadModule()}}connectedCallback(){super.connectedCallback(),m(this),this.loadModule()}async loadModule(){this.failed="";try{const t=await f().module();this.module=t,k(t.name),this.off=!t.enabled}catch(t){t instanceof w&&t.status===404?this.off=!0:this.failed=b(t)}}skeleton(){return l`<div class="page" data-tickets-state="loading" role="status" aria-busy="true" aria-label=${g("states.loading")}>
      <div class="sk" aria-hidden="true">
        <sw-skeleton variant="block" height="36px" width="120px"></sw-skeleton>
        <sw-skeleton variant="block" height="96px"></sw-skeleton>
        <sw-skeleton variant="block" height="44px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
        <sw-skeleton variant="block" height="64px"></sw-skeleton>
      </div>
    </div>`}render(){if(this.off)return l`<div class="page"><sw-state-panel icon="ticket" state="empty" quiet heading=${p("moduleOff")} data-tickets-state="off"></sw-state-panel></div>`;if(this.failed)return l`<div class="page"><sw-state-panel state="error" hint=${this.failed} actionLabel=${p("retry")} data-tickets-state="error" @action=${this.retry}></sw-state-panel></div>`;if(!this.module)return this.skeleton();const t=new URLSearchParams(window.location.hash.split("?")[1]??""),a=t.get("tab")??(t.get("view")==="timeline"?"history":"");return l`<ticket-detail mode="page" .ticketId=${this.ticketId} .detailMode=${this.module.ui.detail} .scope=${y()} .initialTab=${a}
      .defaultTab=${this.module.ui.detail_tab??""} .cameraViewfinder=${this.module.ui.camera_viewfinder===!0} .assignContact=${$(t.get("assign"))}
      @assign-consumed=${()=>history.replaceState(history.state,"",`${window.location.pathname}${window.location.search}${x(this.ticketId)}`)}
      data-screen="tickets-detail"></ticket-detail>${v}`}};s.styles=[P,...S,I,_`
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
  `];i([C()],s.prototype,"ticketId",2);i([c()],s.prototype,"module",2);i([c()],s.prototype,"failed",2);i([c()],s.prototype,"off",2);s=i([A("tickets-detail")],s);export{s as TicketsDetailPage};
//# sourceMappingURL=tickets-detail-DuPa1OGR.js.map
