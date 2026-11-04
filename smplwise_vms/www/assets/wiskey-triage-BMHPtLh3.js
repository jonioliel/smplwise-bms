import{a as g,i as w,e as o,r as b,l as d,E as f,F as m,H as h}from"./index-xLRE7Qht.js";import{m as c,t}from"./wk-triage-panel-B4q_gcMG.js";import"./sw-logo-art-Va6y_cIM.js";import"./access-status-ClC6_fu_.js";import"./wiskey-format-DJ4vUeXA.js";var y=Object.defineProperty,$=Object.getOwnPropertyDescriptor,u=(a,s,l,r)=>{for(var e=r>1?void 0:r?$(s,l):s,n=a.length-1,p;n>=0;n--)(p=a[n])&&(e=(r?p(s,l,e):p(e))||e);return r&&e&&y(s,l,e),e};let i=class extends g{constructor(){super(...arguments),this.route=null}get tab(){return this.route?.segments[1]==="alerts"?"alerts":"conflicts"}render(){return w()&&!c(d)?o`<sw-page heading=${t.title}><sw-state-panel state="forbidden" heading=${t.title} hint=${t.readOnly} data-wkt-forbidden></sw-state-panel></sw-page>`:o`<sw-page heading=${t.title} subheading=${t.subtitle} wide>
      <wk-triage-panel mode="full" .tab=${this.tab} @wkt-tab=${a=>b(`/wiskey/${a.detail.tab}`)}></wk-triage-panel>
    </sw-page>`}};i.styles=f`
    :host {
      display: block;
    }
  `;u([m({attribute:!1})],i.prototype,"route",2);i=u([h("wiskey-triage")],i);export{i as WiskeyTriage};
//# sourceMappingURL=wiskey-triage-BMHPtLh3.js.map
