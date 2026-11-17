import"./settings-retention-DQjGw1P8.js";import{nF as f,nG as g,a as u,S as y,nH as w,eo as C,nI as $,kn as m,lF as v,K as x,q as o,p,lG as P,nJ as A,ko as _,br as k,a4 as E,i as S,n as I,r as O,x as T}from"./index-C5kZ9jiu.js";import{s as z,u as R}from"./static-BEhe_ni1.js";import{i as F,a as G}from"./infra-pages-C_lx4FkL.js";import"./format-DfrIhqDO.js";import"./styles-BbW_S10i.js";import"./sw-place-tree-DZU5XNR8.js";import"./fixtures-Db2whdpa.js";import"./sw-logo-art-Va6y_cIM.js";var L=Object.defineProperty,N=Object.getOwnPropertyDescriptor,h=(e,s,i,l)=>{for(var t=l>1?void 0:l?N(s,i):s,n=e.length-1,r;n>=0;n--)(r=e[n])&&(t=(l?r(s,i,t):r(t))||t);return l&&t&&L(s,i,t),t};const d=f.map(e=>({id:e.id,label:e.label,tag:`elec-${e.id}-page`,money:g.includes(e.id)}));function M(e){const s=e[1]==="electricity"?e[2]:void 0;return d.find(i=>i.id===s)?.id??"meters"}let c=class extends u{constructor(){super(...arguments),this.bubbleSkin=new y(this),this.route=null,this.access=w(),this.tabsMode=new C(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=$(e=>this.access=e)}disconnectedCallback(){this.stop?.(),m(this),this.pagesChip=null,super.disconnectedCallback()}pages(){return d.filter(e=>!e.money||this.access.bills)}render(){const e=this.route,s=M(e?.segments??[]),i=d.find(a=>a.id===s),l=v("infra.electricity",this.pages().map(a=>({id:a.id,label:a.label,href:`#/infra/electricity/${a.id}`})),x());let t;if(!this.access.view||i.money&&!this.access.bills)t=o`<sw-state-panel state="forbidden" data-elec=${s} data-state="forbidden"></sw-state-panel>`;else if(!customElements.get(i.tag))t=o`<sw-state-panel icon="bolt" state="empty" heading="אין מסך" data-elec=${s} data-state="empty"></sw-state-panel>`;else{const a=z(i.tag);t=R`<${a} .segments=${(e?.segments??[]).slice(3)} .params=${e?.params??new URLSearchParams}></${a}>`}const n=F(this.tabsMode.value,l.length);this.pagesChip=n?G("עמודים",l,s,a=>k(`/infra/electricity/${a}`)):null;const r=n?p:o`<sw-tabs .items=${l} .active=${s} .variant=${P("infra.electricity")} data-infra-pages></sw-tabs>`,b=A.find(a=>a.id==="electricity")?.label??"מוני חשמל";return o`<sw-page heading=${b} data-infra-page="electricity">${r===p?p:o`<div class="rows" data-elec-shell>${r}</div>`}<div class="body" data-page=${s}>${t}</div></sw-page>`}updated(){this.pagesChip?_(this,this.pagesChip):m(this)}};c.styles=[S`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      inline-size: 100%;
    }
    sw-page {
      flex: 1 1 auto;
      min-block-size: 0;
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
  `,E];h([I({attribute:!1})],c.prototype,"route",2);h([O()],c.prototype,"access",2);c=h([T("infra-electricity")],c);export{d as ELECTRICITY_PAGES,c as InfraElectricity,M as pageOf};
