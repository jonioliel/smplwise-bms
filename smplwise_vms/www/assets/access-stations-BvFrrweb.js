import{w as h,E as b,F as p,a as g,e as d,H as f,g as c,j as m}from"./index-DWrXlHoD.js";import{c as y,a as k}from"./intercom-CxlJNndd.js";const v={phone:"M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",hangup:"M3 14c5-5 13-5 18 0l-2 3-4-2v-3c-2-.7-4-.7-6 0v3l-4 2z",window:"M3 5h18v14H3zM3 9h18M7 7h.01M10 7h.01",table:"M3 5h18v14H3zM3 10h18M3 15h18M9 5v14"},_=s=>s in v;function $(s,a=16){return h`<svg viewBox="0 0 24 24" width=${a} height=${a} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d=${v[s]}></path></svg>`}var x=Object.defineProperty,M=Object.getOwnPropertyDescriptor,l=(s,a,r,o)=>{for(var e=o>1?void 0:o?M(a,r):a,i=s.length-1,t;i>=0;i--)(t=s[i])&&(e=(o?t(a,r,e):t(e))||e);return o&&e&&x(a,r,e),e};let n=class extends g{constructor(){super(...arguments),this.value="",this.options=[],this.label=""}pick(s){s!==this.value&&(this.value=s,this.dispatchEvent(new CustomEvent("change",{detail:s,bubbles:!0,composed:!0})))}render(){return d`<div class="group" role="group" aria-label=${this.label}>
      ${this.options.map(s=>d`<button type="button" data-view=${s.id} aria-pressed=${String(s.id===this.value)} aria-label=${s.label} title=${s.label} @click=${()=>this.pick(s.id)}>
          ${_(s.icon)?$(s.icon,18):d`<sw-icon .name=${s.icon} size=${18}></sw-icon>`}
        </button>`)}
    </div>`}};n.styles=b`
    :host {
      display: inline-flex;
    }
    .group {
      display: inline-flex;
      gap: var(--sw-s-1);
      padding: var(--sw-s-1);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    button {
      box-sizing: border-box;
      display: grid;
      place-items: center;
      min-block-size: var(--sw-touch-desktop);
      min-inline-size: var(--sw-touch-desktop);
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover {
        background: var(--sw-hover-wash);
      }
    }
    button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface-solid));
      color: var(--sw-seg-key-ink, var(--sw-heading));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (max-width: 1100px) {
      button {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
  `;l([p()],n.prototype,"value",2);l([p({attribute:!1})],n.prototype,"options",2);l([p()],n.prototype,"label",2);n=l([f("sw-view-switch")],n);const A=()=>c("access-control/features"),P=()=>c("access-control/stations"),w=s=>`access-control/stations/${encodeURIComponent(s)}`,C=s=>c(`${w(s)}/programs`),I=s=>c(`${w(s)}/codes`);async function O(s,a=y){const r=[];for(const o of s.stationIds)try{const e=await a(o,{engine_id:s.engine_id,language:s.language,message:s.message});r.push({station_id:o,outcome:"sent",status:e.tts??null,error:null,code:null,retry_after_s:null})}catch(e){const i=k(e),t=e instanceof m?e:null,u=Number(t?.body?.details?.retry_after_s);r.push({station_id:o,outcome:i,status:null,error:t?t.message:null,code:t?String(t.body?.details?.wiskey_code??t.code):null,retry_after_s:Number.isFinite(u)&&u>=0?u:null})}return r}export{O as a,A as b,C as c,I as d,P as g,_ as i,$ as w};
//# sourceMappingURL=access-stations-BvFrrweb.js.map
