import{i as u,a2 as w,b as o,cI as b,a3 as d,g as f,ax as m,k as c}from"./index-HShv8nD9.js";import{m as h,t}from"./wk-triage-panel-CZHBCTBI.js";import"./sw-logo-art-PLtEZJxU.js";import"./access-status-CQjSQsUw.js";import"./wiskey-format-C5Kr2XG4.js";import"./wiskey-BdkQpdGV.js";var y=Object.defineProperty,$=Object.getOwnPropertyDescriptor,g=(a,r,n,s)=>{for(var e=s>1?void 0:s?$(r,n):r,l=a.length-1,p;l>=0;l--)(p=a[l])&&(e=(s?p(r,n,e):p(e))||e);return s&&e&&y(r,n,e),e};let i=class extends u{constructor(){super(...arguments),this.route=null}get tab(){return this.route?.segments[1]==="alerts"?"alerts":"conflicts"}render(){return w()&&!h(d)?o`<sw-page heading=${t.title}><sw-state-panel state="forbidden" heading=${t.title} hint=${t.readOnly} data-wkt-forbidden></sw-state-panel></sw-page>`:o`<sw-page heading=${t.title} subheading=${t.subtitle} wide>
      <wk-triage-panel mode="full" .tab=${this.tab} @wkt-tab=${a=>b(`/wiskey/${a.detail.tab}`)}></wk-triage-panel>
    </sw-page>`}};i.styles=f`
    :host {
      display: block;
    }
  `;g([m({attribute:!1})],i.prototype,"route",2);i=g([c("wiskey-triage")],i);export{i as WiskeyTriage};
