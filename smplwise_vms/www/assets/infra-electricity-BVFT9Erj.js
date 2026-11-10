import"./settings-retention-Bt4Aag1F.js";import{mg as y,mh as C,a as v,S as w,mi as x,dO as $,mj as P,iP as m,kd as k,i as b,ka as A,kb as d,kc as f,e as c,A as g,iQ as E,aJ as _,ke as S,C as O,E as T,F as z,G as I,H as R}from"./index-CmpXuSwg.js";import{s as N,u as L}from"./static-DfsquAfj.js";import{i as F,a as G}from"./infra-pages-DoQFOJ9x.js";import{l as M}from"./lead-reserve-e8LNxfzX.js";import{s as j,a as H}from"./sr-heading-CpIgYzrP.js";import"./format-DNWhSj2-.js";import"./styles-D44L0kNs.js";import"./sw-logo-art-Va6y_cIM.js";var Y=Object.defineProperty,D=Object.getOwnPropertyDescriptor,h=(e,a,t,r)=>{for(var i=r>1?void 0:r?D(a,t):a,l=e.length-1,n;l>=0;l--)(n=e[l])&&(i=(r?n(a,t,i):n(i))||i);return r&&i&&Y(a,t,i),i};const p=y.map(e=>({id:e.id,label:e.label,tag:`elec-${e.id}-page`,money:C.includes(e.id)}));function B(e){const a=e[1]==="electricity"?e[2]:void 0;return p.find(t=>t.id===a)?.id??"meters"}let o=class extends v{constructor(){super(...arguments),this.bubbleSkin=new w(this),this.route=null,this.access=x(),this.tabsMode=new $(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=P(e=>this.access=e)}disconnectedCallback(){this.stop?.(),m(this),this.pagesChip=null,super.disconnectedCallback()}pages(){return p.filter(e=>!e.money||this.access.bills)}render(){const e=this.route,a=B(e?.segments??[]),t=p.find(s=>s.id===a),r=k("infra.electricity",this.pages().map(s=>({id:s.id,label:s.label,href:`#/infra/electricity/${s.id}`})),b()),i=A(d,b(),S).length<2?c`<sw-tabs .items=${d.filter(s=>s.id==="electricity")} active="electricity" .variant=${f("infra")} data-infra-l1></sw-tabs>`:g;let l;if(!this.access.view||t.money&&!this.access.bills)l=c`<sw-state-panel state="forbidden" data-elec=${a} data-state="forbidden"></sw-state-panel>`;else if(!customElements.get(t.tag))l=c`<sw-state-panel icon="bolt" state="empty" heading="אין מסך" data-elec=${a} data-state="empty"></sw-state-panel>`;else{const s=N(t.tag);l=L`<${s} .segments=${(e?.segments??[]).slice(3)} .params=${e?.params??new URLSearchParams}></${s}>`}const n=F(this.tabsMode.value,r.length);this.pagesChip=n?G("עמודים",r,a,s=>_(`/infra/electricity/${s}`)):null;const u=n?g:c`<sw-tabs .items=${r} .active=${a} .variant=${f("infra.electricity")} data-infra-pages></sw-tabs>`;return c`${j(d.find(s=>s.id==="electricity")?.label??"מוני חשמל",!0)}<div class="rows lead-head" data-elec-shell>${i}${u}</div><div class="body" data-page=${a}>${l}</div>`}updated(){this.pagesChip?E(this,this.pagesChip):m(this)}};o.styles=[H,M,T`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-block-size: 100%;
      padding: 14px var(--sw-page-pad) 24px;
      max-inline-size: var(--sw-content-max);
      inline-size: 100%;
      box-sizing: border-box;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .body {
      min-inline-size: 0;
    }
    .body > * {
      display: block;
    }
    /* NOSCROLL-297 (owner rule: a control screen fits the viewport on a desktop): the meters page takes the height left under the tab
       rows; its table (or cards) and the areas tree scroll inside their own boxes (screens/electricity/page-meters.ts). The other pages
       (accounts, bills, customers) are documents and keep the page scroll. */
    @media (min-width: 900px) {
      .body[data-page='meters'] {
        flex: 1 1 auto;
        min-block-size: 0;
        display: flex;
        flex-direction: column;
      }
      .body[data-page='meters'] > * {
        flex: 1 1 auto;
        min-block-size: 0;
        display: flex;
        flex-direction: column;
      }
    }
  `,O];h([z({attribute:!1})],o.prototype,"route",2);h([I()],o.prototype,"access",2);o=h([R("infra-electricity")],o);export{p as ELECTRICITY_PAGES,o as InfraElectricity,B as pageOf};
//# sourceMappingURL=infra-electricity-BVFT9Erj.js.map
