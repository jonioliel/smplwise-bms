import"./settings-retention-B_sHVWkH.js";import{i as g,aL as u,er as y,es as w,et as C,eu as b,ev as $,a2 as v,b as o,de as p,A as d,ew as x,ex as A,ey as P,Y as _,ez as E,eA as k,aU as O,g as S,ax as z,j as I,k as T}from"./index-I3FcVZcW.js";import{s as R,u as L}from"./static-BOQjuF9l.js";import{i as N,a as M}from"./infra-pages-DlE9czcW.js";import"./meters-page-base-FLs2-FDV.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";import"./styles-CCvOa-2r.js";import"./sw-place-tree-y6hZLiu8.js";import"./fixtures-Db2whdpa.js";import"./sw-logo-art-PLtEZJxU.js";var Y=Object.defineProperty,j=Object.getOwnPropertyDescriptor,m=(e,s,i,r)=>{for(var t=r>1?void 0:r?j(s,i):s,l=e.length-1,n;l>=0;l--)(n=e[l])&&(t=(r?n(s,i,t):n(t))||t);return r&&t&&Y(s,i,t),t};const h=E.map(e=>({id:e.id,label:e.label,tag:`elec-${e.id}-page`,money:k.includes(e.id)}));function F(e){const s=e[1]==="electricity"?e[2]:void 0;return h.find(i=>i.id===s)?.id??"meters"}let c=class extends g{constructor(){super(...arguments),this.bubbleSkin=new u(this),this.route=null,this.access=y(),this.tabsMode=new w(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=C(e=>this.access=e)}disconnectedCallback(){this.stop?.(),b(this),this.pagesChip=null,super.disconnectedCallback()}pages(){return h.filter(e=>!e.money||this.access.bills)}render(){const e=this.route,s=F(e?.segments??[]),i=h.find(a=>a.id===s),r=$("infra.electricity",this.pages().map(a=>({id:a.id,label:a.label,href:`#/infra/electricity/${a.id}`})),v());let t;if(!this.access.view||i.money&&!this.access.bills)t=o`<sw-state-panel state="forbidden" data-elec=${s} data-state="forbidden"></sw-state-panel>`;else if(!customElements.get(i.tag))t=o`<sw-state-panel icon="bolt" state="empty" heading=${p("אין מסך")} data-elec=${s} data-state="empty"></sw-state-panel>`;else{const a=R(i.tag);t=L`<${a} .segments=${(e?.segments??[]).slice(3)} .params=${e?.params??new URLSearchParams}></${a}>`}const l=N(this.tabsMode.value,r.length);this.pagesChip=l?M(p("עמודים"),r,s,a=>_(`/infra/electricity/${a}`)):null;const n=l?d:o`<sw-tabs .items=${r} .active=${s} .variant=${x("infra.electricity")} data-infra-pages></sw-tabs>`,f=A.find(a=>a.id==="electricity")?.label??p("מוני חשמל");return o`<sw-page heading=${f} data-infra-page="electricity">${n===d?d:o`<div class="rows" data-elec-shell>${n}</div>`}<div class="body" data-page=${s}>${t}</div></sw-page>`}updated(){this.pagesChip?P(this,this.pagesChip):b(this)}};c.styles=[S`
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
  `,O];m([z({attribute:!1})],c.prototype,"route",2);m([I()],c.prototype,"access",2);c=m([T("infra-electricity")],c);export{c as InfraElectricity,F as pageOf};
