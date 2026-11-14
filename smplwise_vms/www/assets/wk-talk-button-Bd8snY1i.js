import{E as $,F as c,G as m,a as I,cE as z,cF as C,cl as _,cu as E,A as d,e as r,cj as k,ci as O,cG as T,cH as P,cI as S,cJ as j,cK as B,H as L}from"./index-Cx0qJkOE.js";var M=Object.defineProperty,D=Object.getOwnPropertyDescriptor,o=(e,s,i,t)=>{for(var a=t>1?void 0:t?D(s,i):s,l=e.length-1,p;l>=0;l--)(p=e[l])&&(a=(t?p(s,i,a):p(a))||a);return t&&a&&M(s,i,a),a};let n=class extends I{constructor(){super(...arguments),this.stationId="",this.talk=null,this.live=!0,this.dial=!1,this.idleLabel="",this.deps=null,this.tick=0,this.mic="unknown",this.session=null,this.timer=0,this.activate=()=>{const e=this.ensure();e.phase==="idle"?e.start():(e.phase==="open"||e.phase==="talking")&&e.toggleMute()}}connectedCallback(){super.connectedCallback(),z().then(e=>this.mic=e)}disconnectedCallback(){super.disconnectedCallback(),this.session?.dispose(),this.session=null,window.clearInterval(this.timer)}updated(e){e.has("stationId")&&e.get("stationId")!==void 0&&(this.session?.dispose(),this.session=null)}ensure(){if(this.session&&this.session.stationId===this.stationId)return this.session;const e=this.talk,s=Math.max(80,Math.round((e?.sample_rate??8e3)*(e?.frame_ms??20)/1e3)),i={start:(t,a)=>B(t,a),stop:t=>j(t),socket:t=>new WebSocket(S(t)),mic:(t,a,l)=>P(t,a,l),requestId:()=>T(),now:()=>Date.now(),after:(t,a)=>window.setTimeout(t,a),cancel:t=>window.clearTimeout(t),changed:()=>this.onChange(),floor:t=>this.dispatchEvent(new CustomEvent("talk-floor",{detail:{held:t,stationId:this.stationId},bubbles:!0,composed:!0}))};return this.session=new C(this.stationId,e?.codec==="pcma"?"pcma":"pcmu",s,{...i,...this.deps??{}}),this.session}onChange(){this.tick+=1;const e=this.session;window.clearInterval(this.timer),e&&(e.phase==="open"||e.phase==="talking")&&(this.timer=window.setInterval(()=>this.tick+=1,1e3)),this.dispatchEvent(new CustomEvent("talk-state",{detail:{phase:e?.phase??"idle",problem:e?.problem??null,outcome:e?.outcome??null},bubbles:!0,composed:!0}))}blocked(){return this.mic==="insecure"?"insecure":this.mic==="denied"?"denied":null}end(){this.session?.end()}render(){const e=_(),s=e.talk,i=this.session,t=i?.phase??"idle",a=!!this.talk?.busy&&t==="idle",l=this.blocked(),p=!this.live||t==="idle"&&(a||!!l),b=i?.secondsLeft()??null,v=i?.secondsOpen()??null;this.tick;const w=t==="open"||t==="talking",f=this.idleLabel||(this.dial?e.dial.dial:s.start),g=t==="talking"?s.talking:t==="starting"?s.starting:t==="open"?s.muted:f,x=t==="talking"?s.mute:t==="open"?s.unmute:f,y=t==="idle"&&this.dial?E("phone",18):null,u=i?.problem??(t==="idle"?l:null),h=u?{tone:u==="busy"||u==="expired"?"warn":"error",text:s.problems[u]}:a?{tone:"warn",text:s.busy}:t==="idle"&&i?.outcome?{tone:"",text:s.ended}:w&&i?.echoCancelled===!1?{tone:"warn",text:s.headset}:null;return r`<button
        type="button"
        class="ptt"
        data-wk-ptt
        data-phase=${t}
        data-muted=${w?String(t==="open"):d}
        aria-pressed=${w?String(t==="open"):d}
        aria-label=${x}
        ?disabled=${p}
        @click=${this.activate}
      >
        ${t==="talking"?r`<i class="dot" aria-hidden="true"></i>`:y??r`<sw-icon name=${t==="open"?"micOff":"mic"} size=${18}></sw-icon>`}<span>${g}</span>
      </button>
      ${h||t==="open"||t==="talking"?r`<div class="row">
            <span class="line" role="status" aria-live="polite" data-wk-talk-line data-tone=${h?.tone??""} data-problem=${u??""}
              >${h?h.text:r`${v!==null?r`<span class="elapsed" data-wk-talk-elapsed>${e.dial.inCall} <bdi>${k(v)}</bdi></span> · `:d}${b!==null?r`<span class="left" data-wk-talk-left>${O(s.left,{t:k(b)})}</span>`:d}`}</span
            >
            ${t==="open"||t==="talking"?r`<wk-action-button tone="danger" icon="hangup" data-wk-talk-end @click=${()=>this.end()}>${this.dial?e.dial.hangUp:s.end}</wk-action-button>`:d}
          </div>`:d}`}};n.styles=$`
    :host {
      display: grid;
      gap: var(--sw-s-2);
      min-inline-size: 0;
    }
    .ptt {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      inline-size: 100%;
      min-block-size: max(56px, var(--sw-ctl-h-lg, 0px)); /* a big press target on every skin and width */
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      touch-action: none;
      box-shadow: var(--sw-shadow-1);
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    .ptt[data-phase='idle']:hover:not(:disabled) {
      background: var(--sw-hover-wash, var(--sw-surface-2));
    }
    .ptt:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .ptt[data-phase='open'] {
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      background: var(--sw-accent-soft);
    }
    .ptt[data-phase='talking'] {
      border-color: var(--sw-danger);
      background: var(--sw-danger);
      color: var(--sw-text-inverse);
    }
    .ptt[data-phase='starting'] {
      opacity: 0.85;
      cursor: progress;
    }
    .ptt:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: not-allowed;
    }
    .ptt span {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dot {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: currentColor;
      flex: none;
    }
    .ptt[data-phase='talking'] .dot {
      animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.35;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ptt[data-phase='talking'] .dot {
        animation: none;
      }
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-inline-size: 0;
      min-block-size: var(--sw-touch-desktop, 44px);
    }
    .line {
      flex: 1;
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .line[data-tone='warn'] {
      color: var(--sw-warning-text);
    }
    .line[data-tone='error'] {
      color: var(--sw-danger-text);
    }
    .ptt svg {
      flex: none;
    }
    .elapsed {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .elapsed bdi,
    .left {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
  `;o([c()],n.prototype,"stationId",2);o([c({attribute:!1})],n.prototype,"talk",2);o([c({type:Boolean})],n.prototype,"live",2);o([c({type:Boolean})],n.prototype,"dial",2);o([c()],n.prototype,"idleLabel",2);o([c({attribute:!1})],n.prototype,"deps",2);o([m()],n.prototype,"tick",2);o([m()],n.prototype,"mic",2);n=o([L("wk-talk-button")],n);
//# sourceMappingURL=wk-talk-button-Bd8snY1i.js.map
