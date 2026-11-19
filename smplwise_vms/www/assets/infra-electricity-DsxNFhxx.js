import"./settings-retention-BbC04ffv.js";import{ek as g,el as u,i as y,aL as w,em as C,en as $,eo as v,ep as b,eq as x,a3 as P,b as o,d7 as p,A as d,er as A,es as _,et as k,Y as E,aU as O,g as S,ay as I,j as T,k as z}from"./index-DJHEuoub.js";import{s as R,u as L}from"./static-9FiHdMDR.js";import{i as N,a as M}from"./infra-pages-DBpUR-2b.js";import"./meters-page-base-CaqvtMdI.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";import"./styles-D9KsUISW.js";import"./sw-place-tree-BVPCcpow.js";import"./fixtures-Db2whdpa.js";import"./sw-logo-art-MaHPMZFI.js";var Y=Object.defineProperty,j=Object.getOwnPropertyDescriptor,m=(e,s,i,r)=>{for(var t=r>1?void 0:r?j(s,i):s,l=e.length-1,n;l>=0;l--)(n=e[l])&&(t=(r?n(s,i,t):n(t))||t);return r&&t&&Y(s,i,t),t};const h=g.map(e=>({id:e.id,label:e.label,tag:`elec-${e.id}-page`,money:u.includes(e.id)}));function F(e){const s=e[1]==="electricity"?e[2]:void 0;return h.find(i=>i.id===s)?.id??"meters"}let c=class extends y{constructor(){super(...arguments),this.bubbleSkin=new w(this),this.route=null,this.access=C(),this.tabsMode=new $(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=v(e=>this.access=e)}disconnectedCallback(){this.stop?.(),b(this),this.pagesChip=null,super.disconnectedCallback()}pages(){return h.filter(e=>!e.money||this.access.bills)}render(){const e=this.route,s=F(e?.segments??[]),i=h.find(a=>a.id===s),r=x("infra.electricity",this.pages().map(a=>({id:a.id,label:a.label,href:`#/infra/electricity/${a.id}`})),P());let t;if(!this.access.view||i.money&&!this.access.bills)t=o`<sw-state-panel state="forbidden" data-elec=${s} data-state="forbidden"></sw-state-panel>`;else if(!customElements.get(i.tag))t=o`<sw-state-panel icon="bolt" state="empty" heading=${p("אין מסך")} data-elec=${s} data-state="empty"></sw-state-panel>`;else{const a=R(i.tag);t=L`<${a} .segments=${(e?.segments??[]).slice(3)} .params=${e?.params??new URLSearchParams}></${a}>`}const l=N(this.tabsMode.value,r.length);this.pagesChip=l?M(p("עמודים"),r,s,a=>E(`/infra/electricity/${a}`)):null;const n=l?d:o`<sw-tabs .items=${r} .active=${s} .variant=${A("infra.electricity")} data-infra-pages></sw-tabs>`,f=_.find(a=>a.id==="electricity")?.label??p("מוני חשמל");return o`<sw-page heading=${f} data-infra-page="electricity">${n===d?d:o`<div class="rows" data-elec-shell>${n}</div>`}<div class="body" data-page=${s}>${t}</div></sw-page>`}updated(){this.pagesChip?k(this,this.pagesChip):b(this)}};c.styles=[S`
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
  `,O];m([I({attribute:!1})],c.prototype,"route",2);m([T()],c.prototype,"access",2);c=m([z("infra-electricity")],c);export{h as ELECTRICITY_PAGES,c as InfraElectricity,F as pageOf};
