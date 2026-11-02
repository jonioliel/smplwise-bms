import"./settings-retention-DkPnk_wG.js";import{kY as y,kZ as C,a as v,S as w,k_ as x,cJ as $,k$ as P,gL as b,iV as _,i as m,iS as k,iT as d,iU as f,e as c,A as g,gM as A,aj as E,iW as S,C as T,E as O,F as z,G as I,H as R}from"./index-DzjkD5gF.js";import{s as L,u as N}from"./static-jvBCzR7V.js";import{i as M,a as F}from"./infra-pages-BJHLG47G.js";import{l as G}from"./lead-reserve-fanWbGht.js";import{s as Y,a as j}from"./sr-heading-BLTfLhuv.js";import"./styles-KM9JVzKv.js";import"./sw-logo-art-Va6y_cIM.js";var H=Object.defineProperty,D=Object.getOwnPropertyDescriptor,h=(e,a,t,r)=>{for(var i=r>1?void 0:r?D(a,t):a,l=e.length-1,n;l>=0;l--)(n=e[l])&&(i=(r?n(a,t,i):n(i))||i);return r&&i&&H(a,t,i),i};const p=y.map(e=>({id:e.id,label:e.label,tag:`elec-${e.id}-page`,money:C.includes(e.id)}));function U(e){const a=e[1]==="electricity"?e[2]:void 0;return p.find(t=>t.id===a)?.id??"meters"}let o=class extends v{constructor(){super(...arguments),this.bubbleSkin=new w(this),this.route=null,this.access=x(),this.tabsMode=new $(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=P(e=>this.access=e)}disconnectedCallback(){this.stop?.(),b(this),this.pagesChip=null,super.disconnectedCallback()}pages(){return p.filter(e=>!e.money||this.access.bills)}render(){const e=this.route,a=U(e?.segments??[]),t=p.find(s=>s.id===a),r=_("infra.electricity",this.pages().map(s=>({id:s.id,label:s.label,href:`#/infra/electricity/${s.id}`})),m()),i=k(d,m(),S).length<2?c`<sw-tabs .items=${d.filter(s=>s.id==="electricity")} active="electricity" .variant=${f("infra")} data-infra-l1></sw-tabs>`:g;let l;if(!this.access.view||t.money&&!this.access.bills)l=c`<sw-state-panel state="forbidden" data-elec=${a} data-state="forbidden"></sw-state-panel>`;else if(!customElements.get(t.tag))l=c`<sw-state-panel icon="bolt" state="empty" heading="אין מסך" data-elec=${a} data-state="empty"></sw-state-panel>`;else{const s=L(t.tag);l=N`<${s} .segments=${(e?.segments??[]).slice(3)} .params=${e?.params??new URLSearchParams}></${s}>`}const n=M(this.tabsMode.value,r.length);this.pagesChip=n?F("עמודים",r,a,s=>E(`/infra/electricity/${s}`)):null;const u=n?g:c`<sw-tabs .items=${r} .active=${a} .variant=${f("infra.electricity")} data-infra-pages></sw-tabs>`;return c`${Y(d.find(s=>s.id==="electricity")?.label??"מוני חשמל",!0)}<div class="rows lead-head" data-elec-shell>${i}${u}</div><div class="body" data-page=${a}>${l}</div>`}updated(){this.pagesChip?A(this,this.pagesChip):b(this)}};o.styles=[j,G,O`
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
  `,T];h([z({attribute:!1})],o.prototype,"route",2);h([I()],o.prototype,"access",2);o=h([R("infra-electricity")],o);export{p as ELECTRICITY_PAGES,o as InfraElectricity,U as pageOf};
//# sourceMappingURL=infra-electricity-CVQwjecg.js.map
