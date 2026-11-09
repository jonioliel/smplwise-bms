import"./settings-retention-CJBA2RSn.js";import{m0 as y,m1 as C,a as v,S as w,m2 as x,dy as $,m3 as A,iz as h,jZ as P,i as b,jW as _,jX as d,jY as f,e as o,A as g,iA as E,ak as S,j_ as k,C as z,E as O,F as T,G as I,H as R}from"./index-RQSOD4tp.js";import{s as j,u as N}from"./static-CBJul_XN.js";import{i as L,a as F}from"./infra-pages-BPFZIiRu.js";import{l as G}from"./lead-reserve-CRNvogkW.js";import{s as M,a as Y}from"./sr-heading-gomNTWD_.js";import"./format-DoeuxdYb.js";import"./styles-DTh-EezW.js";import"./sw-logo-art-Va6y_cIM.js";var H=Object.defineProperty,D=Object.getOwnPropertyDescriptor,m=(e,a,t,r)=>{for(var i=r>1?void 0:r?D(a,t):a,l=e.length-1,n;l>=0;l--)(n=e[l])&&(i=(r?n(a,t,i):n(i))||i);return r&&i&&H(a,t,i),i};const p=y.map(e=>({id:e.id,label:e.label,tag:`elec-${e.id}-page`,money:C.includes(e.id)}));function B(e){const a=e[1]==="electricity"?e[2]:void 0;return p.find(t=>t.id===a)?.id??"meters"}let c=class extends v{constructor(){super(...arguments),this.bubbleSkin=new w(this),this.route=null,this.access=x(),this.tabsMode=new $(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=A(e=>this.access=e)}disconnectedCallback(){this.stop?.(),h(this),this.pagesChip=null,super.disconnectedCallback()}pages(){return p.filter(e=>!e.money||this.access.bills)}render(){const e=this.route,a=B(e?.segments??[]),t=p.find(s=>s.id===a),r=P("infra.electricity",this.pages().map(s=>({id:s.id,label:s.label,href:`#/infra/electricity/${s.id}`})),b()),i=_(d,b(),k).length<2?o`<sw-tabs .items=${d.filter(s=>s.id==="electricity")} active="electricity" .variant=${f("infra")} data-infra-l1></sw-tabs>`:g;let l;if(!this.access.view||t.money&&!this.access.bills)l=o`<sw-state-panel state="forbidden" data-elec=${a} data-state="forbidden"></sw-state-panel>`;else if(!customElements.get(t.tag))l=o`<sw-state-panel icon="bolt" state="empty" heading="אין מסך" data-elec=${a} data-state="empty"></sw-state-panel>`;else{const s=j(t.tag);l=N`<${s} .segments=${(e?.segments??[]).slice(3)} .params=${e?.params??new URLSearchParams}></${s}>`}const n=L(this.tabsMode.value,r.length);this.pagesChip=n?F("עמודים",r,a,s=>S(`/infra/electricity/${s}`)):null;const u=n?g:o`<sw-tabs .items=${r} .active=${a} .variant=${f("infra.electricity")} data-infra-pages></sw-tabs>`;return o`${M(d.find(s=>s.id==="electricity")?.label??"מוני חשמל",!0)}<div class="rows lead-head" data-elec-shell>${i}${u}</div><div class="body" data-page=${a}>${l}</div>`}updated(){this.pagesChip?E(this,this.pagesChip):h(this)}};c.styles=[Y,G,O`
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
  `,z];m([T({attribute:!1})],c.prototype,"route",2);m([I()],c.prototype,"access",2);c=m([R("infra-electricity")],c);export{p as ELECTRICITY_PAGES,c as InfraElectricity,B as pageOf};
//# sourceMappingURL=infra-electricity-XsPAhuha.js.map
