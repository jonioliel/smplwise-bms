import"./settings-retention-Dsddp9E4.js";import{a as g,aX as u,ek as y,el as w,em as C,en as f,eo as $,af as v,b as o,dD as p,A as d,ep as x,eq as P,er as A,a8 as _,es as k,et as E,j as O,z as S,k as z,m as I}from"./index-DlIoBDHe.js";import{s as T,u as R}from"./static-BBEvZdSP.js";import{i as L,a as N}from"./infra-pages-ZBEWaeIW.js";import{b as M}from"./bubble-chrome-BBeQfjBL.js";import"./meters-page-base-uz3jYmCa.js";import"./day-key-CpLUamnv.js";import"./pad-CImDeuHV.js";import"./styles-DllUAnS1.js";import"./if-defined-Dt7DRohO.js";import"./sw-place-tree-Cfg5QnmX.js";import"./toast-controller-BPX0Tkjm.js";import"./sw-table-DYkMWTOG.js";import"./fixtures-Db2whdpa.js";import"./sw-logo-art-PLtEZJxU.js";var j=Object.defineProperty,D=Object.getOwnPropertyDescriptor,h=(e,s,i,r)=>{for(var t=r>1?void 0:r?D(s,i):s,l=e.length-1,n;l>=0;l--)(n=e[l])&&(t=(r?n(s,i,t):n(t))||t);return r&&t&&j(s,i,t),t};const m=k.map(e=>({id:e.id,label:e.label,tag:`elec-${e.id}-page`,money:E.includes(e.id)}));function F(e){const s=e[1]==="electricity"?e[2]:void 0;return m.find(i=>i.id===s)?.id??"meters"}let c=class extends g{constructor(){super(...arguments),this.bubbleSkin=new u(this),this.route=null,this.access=y(),this.tabsMode=new w(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=C(e=>this.access=e)}disconnectedCallback(){this.stop?.(),f(this),this.pagesChip=null,super.disconnectedCallback()}pages(){return m.filter(e=>!e.money||this.access.bills)}render(){const e=this.route,s=F(e?.segments??[]),i=m.find(a=>a.id===s),r=$("infra.electricity",this.pages().map(a=>({id:a.id,label:a.label,href:`#/infra/electricity/${a.id}`})),v());let t;if(!this.access.view||i.money&&!this.access.bills)t=o`<sw-state-panel state="forbidden" data-elec=${s} data-state="forbidden"></sw-state-panel>`;else if(!customElements.get(i.tag))t=o`<sw-state-panel icon="bolt" state="empty" heading=${p("אין מסך")} data-elec=${s} data-state="empty"></sw-state-panel>`;else{const a=T(i.tag);t=R`<${a} .segments=${(e?.segments??[]).slice(3)} .params=${e?.params??new URLSearchParams}></${a}>`}const l=L(this.tabsMode.value,r.length);this.pagesChip=l?N(p("עמודים"),r,s,a=>_(`/infra/electricity/${a}`)):null;const n=l?d:o`<sw-tabs .items=${r} .active=${s} .variant=${x("infra.electricity")} data-infra-pages></sw-tabs>`,b=P.find(a=>a.id==="electricity")?.label??p("מוני חשמל");return o`<sw-page heading=${b} data-infra-page="electricity">${n===d?d:o`<div class="rows" data-elec-shell>${n}</div>`}<div class="body" data-page=${s}>${t}</div></sw-page>`}updated(){this.pagesChip?A(this,this.pagesChip):f(this)}};c.styles=[O`
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
  `,M];h([S({attribute:!1})],c.prototype,"route",2);h([z()],c.prototype,"access",2);c=h([I("infra-electricity")],c);export{c as InfraElectricity,F as pageOf};
