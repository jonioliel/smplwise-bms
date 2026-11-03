import"./settings-retention-DFry4OVh.js";import{l2 as y,l3 as C,a as v,S as w,l4 as x,cK as $,l5 as P,gR as b,i$ as _,i as m,iY as A,iZ as d,i_ as f,e as c,A as g,gS as E,aj as S,j0 as O,C as R,E as T,F as k,G as z,H as I}from"./index-CcnB1Mea.js";import{s as N,u as L}from"./static-DOW2deYq.js";import{i as j,a as F}from"./infra-pages-LM0fXBP9.js";import{l as G}from"./lead-reserve-CP9nJXFS.js";import{s as M,a as Y}from"./sr-heading-DDHdhfcc.js";import"./format-DPZiIGE_.js";import"./styles-Dy60rysZ.js";import"./sw-logo-art-Va6y_cIM.js";var H=Object.defineProperty,D=Object.getOwnPropertyDescriptor,h=(e,a,t,l)=>{for(var i=l>1?void 0:l?D(a,t):a,r=e.length-1,n;r>=0;r--)(n=e[r])&&(i=(l?n(a,t,i):n(i))||i);return l&&i&&H(a,t,i),i};const p=y.map(e=>({id:e.id,label:e.label,tag:`elec-${e.id}-page`,money:C.includes(e.id)}));function B(e){const a=e[1]==="electricity"?e[2]:void 0;return p.find(t=>t.id===a)?.id??"meters"}let o=class extends v{constructor(){super(...arguments),this.bubbleSkin=new w(this),this.route=null,this.access=x(),this.tabsMode=new $(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=P(e=>this.access=e)}disconnectedCallback(){this.stop?.(),b(this),this.pagesChip=null,super.disconnectedCallback()}pages(){return p.filter(e=>!e.money||this.access.bills)}render(){const e=this.route,a=B(e?.segments??[]),t=p.find(s=>s.id===a),l=_("infra.electricity",this.pages().map(s=>({id:s.id,label:s.label,href:`#/infra/electricity/${s.id}`})),m()),i=A(d,m(),O).length<2?c`<sw-tabs .items=${d.filter(s=>s.id==="electricity")} active="electricity" .variant=${f("infra")} data-infra-l1></sw-tabs>`:g;let r;if(!this.access.view||t.money&&!this.access.bills)r=c`<sw-state-panel state="forbidden" data-elec=${a} data-state="forbidden"></sw-state-panel>`;else if(!customElements.get(t.tag))r=c`<sw-state-panel icon="bolt" state="empty" heading="אין מסך" data-elec=${a} data-state="empty"></sw-state-panel>`;else{const s=N(t.tag);r=L`<${s} .segments=${(e?.segments??[]).slice(3)} .params=${e?.params??new URLSearchParams}></${s}>`}const n=j(this.tabsMode.value,l.length);this.pagesChip=n?F("עמודים",l,a,s=>S(`/infra/electricity/${s}`)):null;const u=n?g:c`<sw-tabs .items=${l} .active=${a} .variant=${f("infra.electricity")} data-infra-pages></sw-tabs>`;return c`${M(d.find(s=>s.id==="electricity")?.label??"מוני חשמל",!0)}<div class="rows lead-head" data-elec-shell>${i}${u}</div><div class="body" data-page=${a}>${r}</div>`}updated(){this.pagesChip?E(this,this.pagesChip):b(this)}};o.styles=[Y,G,T`
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
  `,R];h([k({attribute:!1})],o.prototype,"route",2);h([z()],o.prototype,"access",2);o=h([I("infra-electricity")],o);export{p as ELECTRICITY_PAGES,o as InfraElectricity,B as pageOf};
//# sourceMappingURL=infra-electricity-BKB5yb_0.js.map
