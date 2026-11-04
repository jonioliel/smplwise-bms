import"./settings-retention-HOYTB7T4.js";import{lP as y,lQ as C,a as v,S as w,lR as x,dt as $,lS as P,hz as b,jM as A,i as m,jJ as E,jK as d,jL as f,e as o,A as g,hA as S,aj as _,jN as z,C as O,E as R,F as T,G as j,H as k}from"./index-Dspqd-4d.js";import{s as I,u as N}from"./static-CqreA2wR.js";import{i as L,a as M}from"./infra-pages-BKBVkVGM.js";import{l as F}from"./lead-reserve-DZMSEB5q.js";import{s as G,a as H}from"./sr-heading-BmVvwKEK.js";import"./format-oBIIrTT5.js";import"./styles-sxX8qr3z.js";import"./sw-logo-art-Va6y_cIM.js";var Y=Object.defineProperty,D=Object.getOwnPropertyDescriptor,h=(e,a,t,l)=>{for(var i=l>1?void 0:l?D(a,t):a,r=e.length-1,n;r>=0;r--)(n=e[r])&&(i=(l?n(a,t,i):n(i))||i);return l&&i&&Y(a,t,i),i};const p=y.map(e=>({id:e.id,label:e.label,tag:`elec-${e.id}-page`,money:C.includes(e.id)}));function B(e){const a=e[1]==="electricity"?e[2]:void 0;return p.find(t=>t.id===a)?.id??"meters"}let c=class extends v{constructor(){super(...arguments),this.bubbleSkin=new w(this),this.route=null,this.access=x(),this.tabsMode=new $(this,"area"),this.pagesChip=null}connectedCallback(){super.connectedCallback(),this.stop=P(e=>this.access=e)}disconnectedCallback(){this.stop?.(),b(this),this.pagesChip=null,super.disconnectedCallback()}pages(){return p.filter(e=>!e.money||this.access.bills)}render(){const e=this.route,a=B(e?.segments??[]),t=p.find(s=>s.id===a),l=A("infra.electricity",this.pages().map(s=>({id:s.id,label:s.label,href:`#/infra/electricity/${s.id}`})),m()),i=E(d,m(),z).length<2?o`<sw-tabs .items=${d.filter(s=>s.id==="electricity")} active="electricity" .variant=${f("infra")} data-infra-l1></sw-tabs>`:g;let r;if(!this.access.view||t.money&&!this.access.bills)r=o`<sw-state-panel state="forbidden" data-elec=${a} data-state="forbidden"></sw-state-panel>`;else if(!customElements.get(t.tag))r=o`<sw-state-panel icon="bolt" state="empty" heading="אין מסך" data-elec=${a} data-state="empty"></sw-state-panel>`;else{const s=I(t.tag);r=N`<${s} .segments=${(e?.segments??[]).slice(3)} .params=${e?.params??new URLSearchParams}></${s}>`}const n=L(this.tabsMode.value,l.length);this.pagesChip=n?M("עמודים",l,a,s=>_(`/infra/electricity/${s}`)):null;const u=n?g:o`<sw-tabs .items=${l} .active=${a} .variant=${f("infra.electricity")} data-infra-pages></sw-tabs>`;return o`${G(d.find(s=>s.id==="electricity")?.label??"מוני חשמל",!0)}<div class="rows lead-head" data-elec-shell>${i}${u}</div><div class="body" data-page=${a}>${r}</div>`}updated(){this.pagesChip?S(this,this.pagesChip):b(this)}};c.styles=[H,F,R`
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
  `,O];h([T({attribute:!1})],c.prototype,"route",2);h([j()],c.prototype,"access",2);c=h([k("infra-electricity")],c);export{p as ELECTRICITY_PAGES,c as InfraElectricity,B as pageOf};
//# sourceMappingURL=infra-electricity-D2I5D0ov.js.map
