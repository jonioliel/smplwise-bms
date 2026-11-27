import{a as u,af as w,b as o,d7 as d,ag as b,j as f,z as m,m as h}from"./index-DMqYQw_5.js";import{m as c,t}from"./wk-triage-panel-BtkV_Y-t.js";import"./sw-logo-art-PLtEZJxU.js";import"./access-status-CETivGte.js";import"./wiskey-format-DWUh8OUF.js";import"./wiskey-2fGWzHXe.js";var y=Object.defineProperty,$=Object.getOwnPropertyDescriptor,g=(a,r,n,s)=>{for(var e=s>1?void 0:s?$(r,n):r,l=a.length-1,p;l>=0;l--)(p=a[l])&&(e=(s?p(r,n,e):p(e))||e);return s&&e&&y(r,n,e),e};let i=class extends u{constructor(){super(...arguments),this.route=null}get tab(){return this.route?.segments[1]==="alerts"?"alerts":"conflicts"}render(){return w()&&!c(b)?o`<sw-page heading=${t.title}><sw-state-panel state="forbidden" heading=${t.title} hint=${t.readOnly} data-wkt-forbidden></sw-state-panel></sw-page>`:o`<sw-page heading=${t.title} subheading=${t.subtitle} wide>
      <wk-triage-panel mode="full" .tab=${this.tab} @wkt-tab=${a=>d(`/wiskey/${a.detail.tab}`)}></wk-triage-panel>
    </sw-page>`}};i.styles=f`
    :host {
      display: block;
    }
  `;g([m({attribute:!1})],i.prototype,"route",2);i=g([h("wiskey-triage")],i);export{i as WiskeyTriage};
