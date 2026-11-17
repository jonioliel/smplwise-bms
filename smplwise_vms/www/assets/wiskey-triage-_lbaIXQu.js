import{a as g,K as w,q as o,V as b,U as d,i as f,n as m,x as h}from"./index-C5kZ9jiu.js";import{m as c,t}from"./wk-triage-panel-8eOdcrmD.js";import"./sw-logo-art-Va6y_cIM.js";import"./access-status-cd2fZWka.js";import"./wiskey-format-BJBSoZNO.js";var y=Object.defineProperty,$=Object.getOwnPropertyDescriptor,u=(a,s,n,r)=>{for(var e=r>1?void 0:r?$(s,n):s,l=a.length-1,p;l>=0;l--)(p=a[l])&&(e=(r?p(s,n,e):p(e))||e);return r&&e&&y(s,n,e),e};let i=class extends g{constructor(){super(...arguments),this.route=null}get tab(){return this.route?.segments[1]==="alerts"?"alerts":"conflicts"}render(){return w()&&!c(d)?o`<sw-page heading=${t.title}><sw-state-panel state="forbidden" heading=${t.title} hint=${t.readOnly} data-wkt-forbidden></sw-state-panel></sw-page>`:o`<sw-page heading=${t.title} subheading=${t.subtitle} wide>
      <wk-triage-panel mode="full" .tab=${this.tab} @wkt-tab=${a=>b(`/wiskey/${a.detail.tab}`)}></wk-triage-panel>
    </sw-page>`}};i.styles=f`
    :host {
      display: block;
    }
  `;u([m({attribute:!1})],i.prototype,"route",2);i=u([h("wiskey-triage")],i);export{i as WiskeyTriage};
