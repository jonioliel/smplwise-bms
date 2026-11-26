import{a as m,aX as h,ew as f,c as k,q as u,o as w,b as r,G as c,A as b,ex as g,cA as v,j as y,z as $,k as p,m as x}from"./index-CoJbESCx.js";import"./ticket-detail-CHme8BQ8.js";import"./sw-skeleton-LFiDSZfl.js";import{a as P}from"./automations-glass-DIFqNkU4.js";import{m as S}from"./media-page-DNNz5uw_.js";import{a as _}from"./glass-zHu6HEwK.js";import{b as C}from"./bubble-chrome-Da7T662v.js";import{t as A}from"./tickets-B-IO2s2N.js";import{g as I}from"./map-text-CT1okudR.js";import{t as O}from"./chip-selected-QIxxwgv4.js";import"./sw-logo-art-PLtEZJxU.js";import"./lead-reserve-DAN8SNxO.js";import"./tickets-costs-DqdPQzHp.js";import"./tickets-costs-mock-DDt5Oejb.js";import"./cost-model-Aj9w45je.js";import"./bytes-QYSxC3WX.js";import"./pad-CImDeuHV.js";import"./drawer-model-DU3hUMWF.js";import"./drawer-text-Dg7OjpZ4.js";import"./icons-Crf07nCA.js";import"./tickets-s4-B8CF1RaK.js";import"./org-locations-text-BHFyvdgU.js";import"./readiness-model-DGhavIGL.js";import"./model-DGFg_0wZ.js";import"./maintenance-Mkwmb9FM.js";import"./geometry-BsRgN_aU.js";import"./board-model-AQiYoyJs.js";import"./location-picker-DtXS4OLD.js";import"./device-activity-logic-CHkFQV4J.js";var M=Object.defineProperty,T=Object.getOwnPropertyDescriptor,a=(t,s,l,o)=>{for(var e=o>1?void 0:o?T(s,l):s,n=t.length-1,d;n>=0;n--)(d=t[n])&&(e=(o?d(s,l,e):d(e))||e);return o&&e&&M(s,l,e),e};let i=class extends m{constructor(){super(...arguments),this.bubbleSkin=new h(this),this.ticketId="",this.module=null,this.failed="",this.off=!1,this.retry=()=>{this.failed="",this.module=null,this.loadModule()}}connectedCallback(){super.connectedCallback(),_(this),this.loadModule()}async loadModule(){this.failed="";try{const t=await A().module();this.module=t,f(t.name),this.off=!t.enabled}catch(t){t instanceof k&&t.status===404?this.off=!0:this.failed=u(t)}}skeleton(){return r`<div class="page" data-tickets-state="loading" role="status" aria-busy="true" aria-label=${w("states.loading")}>
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
