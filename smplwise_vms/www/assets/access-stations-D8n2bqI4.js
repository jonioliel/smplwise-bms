import{E as v,F as p,a as w,c8 as g,bF as h,e as d,H as f,g as c,c9 as m,bQ as y,j as _}from"./index-CCDqf4A8.js";var k=Object.defineProperty,$=Object.getOwnPropertyDescriptor,l=(s,r,o,a)=>{for(var e=a>1?void 0:a?$(r,o):r,i=s.length-1,t;i>=0;i--)(t=s[i])&&(e=(a?t(r,o,e):t(e))||e);return a&&e&&k(r,o,e),e};let n=class extends w{constructor(){super(...arguments),this.value="",this.options=[],this.label=""}pick(s){s!==this.value&&(this.value=s,this.dispatchEvent(new CustomEvent("change",{detail:s,bubbles:!0,composed:!0})))}render(){return d`<div class="group" role="group" aria-label=${this.label}>
      ${this.options.map(s=>d`<button type="button" data-view=${s.id} aria-pressed=${String(s.id===this.value)} aria-label=${s.label} title=${s.label} @click=${()=>this.pick(s.id)}>
          ${g(s.icon)?h(s.icon,18):d`<sw-icon .name=${s.icon} size=${18}></sw-icon>`}
        </button>`)}
    </div>`}};n.styles=v`
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
  `;l([p()],n.prototype,"value",2);l([p({attribute:!1})],n.prototype,"options",2);l([p()],n.prototype,"label",2);n=l([f("sw-view-switch")],n);const S=()=>c("access-control/features"),z=()=>c("access-control/stations"),b=s=>`access-control/stations/${encodeURIComponent(s)}`,I=s=>c(`${b(s)}/programs`),O=s=>c(`${b(s)}/codes`);async function P(s,r=m){const o=[];for(const a of s.stationIds)try{const e=await r(a,{engine_id:s.engine_id,language:s.language,message:s.message});o.push({station_id:a,outcome:"sent",status:e.tts??null,error:null,code:null,retry_after_s:null})}catch(e){const i=y(e),t=e instanceof _?e:null,u=Number(t?.body?.details?.retry_after_s);o.push({station_id:a,outcome:i,status:null,error:t?t.message:null,code:t?String(t.body?.details?.wiskey_code??t.code):null,retry_after_s:Number.isFinite(u)&&u>=0?u:null})}return o}export{P as a,O as b,z as c,S as d,I as g};
//# sourceMappingURL=access-stations-D8n2bqI4.js.map
