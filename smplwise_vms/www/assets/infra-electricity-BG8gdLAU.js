import"./settings-retention-DxGdES-E.js";import{i as g,aW as u,ej as y,ek as C,el as w,em as b,en as $,ae as v,b as o,dC as p,A as d,eo as x,ep as P,eq as A,a7 as _,er as k,es as E,g as O,y as S,j as I,k as T}from"./index-CqeTnh_F.js";import{s as z,u as R}from"./static-B3w9Z1Wx.js";import{i as L,a as N}from"./infra-pages-Cky_V4Pl.js";import{b as j}from"./bubble-chrome-DtLCPG9P.js";import"./meters-page-base-zgMqN0p7.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";import"./styles-tYSl1yr7.js";import"./if-defined-BHBFWi8J.js";import"./sw-place-tree-0IO6DNpX.js";import"./toast-controller-BPX0Tkjm.js";import"./sw-table-DkDc_4e_.js";import"./fixtures-Db2whdpa.js";import"./sw-logo-art-PLtEZJxU.js";var M=Object.defineProperty,F=Object.getOwnPropertyDescriptor,h=(e,s,i,r)=>{for(var t=r>1?void 0:r?F(s,i):s,l=e.length-1,n;l>=0;l--)(n=e[l])&&(t=(r?n(s,i,t):n(t))||t);return r&&t&&M(s,i,t),t};const m=k.map(e=>({id:e.id,label:e.label,tag:`elec-${e.id}-page`,money:E.includes(e.id)}));function G(e){const s=e[1]==="electricity"?e[2]:void 0;return m.find(i=>i.id===s)?.id??"meters"}let c=class extends g{constructor(){super(...arguments),this.bubbleSkin=new u(this),this.route=null,this.access=y(),this.tabsMode=new C(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=w(e=>this.access=e)}disconnectedCallback(){this.stop?.(),b(this),this.pagesChip=null,super.disconnectedCallback()}pages(){return m.filter(e=>!e.money||this.access.bills)}render(){const e=this.route,s=G(e?.segments??[]),i=m.find(a=>a.id===s),r=$("infra.electricity",this.pages().map(a=>({id:a.id,label:a.label,href:`#/infra/electricity/${a.id}`})),v());let t;if(!this.access.view||i.money&&!this.access.bills)t=o`<sw-state-panel state="forbidden" data-elec=${s} data-state="forbidden"></sw-state-panel>`;else if(!customElements.get(i.tag))t=o`<sw-state-panel icon="bolt" state="empty" heading=${p("אין מסך")} data-elec=${s} data-state="empty"></sw-state-panel>`;else{const a=z(i.tag);t=R`<${a} .segments=${(e?.segments??[]).slice(3)} .params=${e?.params??new URLSearchParams}></${a}>`}const l=L(this.tabsMode.value,r.length);this.pagesChip=l?N(p("עמודים"),r,s,a=>_(`/infra/electricity/${a}`)):null;const n=l?d:o`<sw-tabs .items=${r} .active=${s} .variant=${x("infra.electricity")} data-infra-pages></sw-tabs>`,f=P.find(a=>a.id==="electricity")?.label??p("מוני חשמל");return o`<sw-page heading=${f} data-infra-page="electricity">${n===d?d:o`<div class="rows" data-elec-shell>${n}</div>`}<div class="body" data-page=${s}>${t}</div></sw-page>`}updated(){this.pagesChip?A(this,this.pagesChip):b(this)}};c.styles=[O`
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
  `,j];h([S({attribute:!1})],c.prototype,"route",2);h([I()],c.prototype,"access",2);c=h([T("infra-electricity")],c);export{c as InfraElectricity,G as pageOf};
