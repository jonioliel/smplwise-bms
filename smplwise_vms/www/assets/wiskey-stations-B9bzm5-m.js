import{E as H,F as u,G as d,a as D,bw as je,R as ie,A as r,e as n,H as R,bx as qe,by as Be,bz as j,bA as U,bB as te,bC as _e,bD as He,bE as Ue,bF as We,bG as Ke,bH as Ye,bI as Ve,j as Z,bq as Ge,bJ as Je,bK as Xe,bL as Ze,i as G,l as T,bM as Qe,bN as et,bO as tt,bP as st,bQ as at,bR as it,bS as ze,bT as Se,bU as de,n as nt,bV as ot,bW as rt,bX as lt,bY as ct,av as he,J as dt,bZ as ht,b_ as pt,b$ as ut,c0 as wt,be as pe,c1 as ue,aA as ft,r as gt}from"./index-Dspqd-4d.js";import"./sw-table-BnKJWr2h.js";import"./sw-place-tree-_eV0qyRn.js";import{a as mt,g as bt,b as vt,c as kt,d as $t}from"./access-stations-D80wxSoF.js";import{a as yt,w as $,t as we,T as Y,c as fe,f as b,b as Te,s as xt,n as _t,l as zt,d as St,e as Tt,g as Ot,h as Ct,A as It,i as Lt,U as At,j as B,k as P,p as Q,m as W,o as ne,q as oe,r as ee,u as Oe,v as E,x as se,y as Et,z as Ce,B as Mt,C as Dt,D as Rt,E as Pt,F as Nt,G as Ft,H as Ie,P as jt,I as ge,J as qt,K as Bt,L as Ht,M as Ut,N as Wt,O as Kt,Q as Yt,R as Vt,S as Gt,V as Jt,W as Xt,X as Zt,Y as Qt,Z as es,_ as ts,$ as ss,a0 as as,a1 as is,a2 as ns}from"./access-parity-846bjS6X.js";import"./wk-deep-links-DTIJwsCu.js";import"./sw-logo-art-Va6y_cIM.js";import"./schedules-logic-B152Swc1.js";import"./wiskey-format-B1C9aa4N.js";import"./deep-links-DAnFdicP.js";var os=Object.defineProperty,rs=Object.getOwnPropertyDescriptor,v=(e,t,s,a)=>{for(var i=a>1?void 0:a?rs(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&os(t,s,i),i};const ls={he:"עברית",iw:"עברית",en:"English",ar:"العربية",ru:"Русский"},me=e=>ls[e.toLowerCase().split("-")[0]]??e.toUpperCase();let m=class extends D{constructor(){super(...arguments),this.open=!1,this.stations=[],this.places=null,this.scope="scope",this.phrases=[],this.preselect="",this.tts={},this.engines=null,this.enginesNote="",this.engine="",this.language="",this.message="",this.choice="",this.sending=!1,this.result=null,this.locked=!1,this.retryAt=0,this.more=!1,this.sent=[],this.loadedEngines=!1,this.timer=0}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("open")&&this.open&&this.reset()}updated(e){e.has("open")&&this.open&&!this.loadedEngines&&this.loadEngines()}reset(){this.message="",this.result=null,this.locked=!1,this.retryAt=0,this.sending=!1,this.more=!1,this.sent=[],this.choice=this.choices()[0]?.key??""}online(){return this.stations.filter(e=>e.online)}choices(){return yt(this.online(),this.places,this.scope,this.preselect||void 0)}current(){const e=this.choices();return e.find(t=>t.key===this.choice)??e[0]}async loadEngines(){this.loadedEngines=!0,this.enginesNote="";try{const e=await je();e.tts&&e.tts.engines.length?(this.engines=e.tts,this.pickEngine(e.tts.default&&e.tts.engines.some(t=>t.engine_id===e.tts.default)?e.tts.default:e.tts.engines[0].engine_id)):e.tts?this.enginesNote=$().announceDlg.noEngine:this.enginesNote=e.state==="unsupported"?$().announceDlg.enginesUnsupported:$().announceDlg.noEngine}catch(e){this.enginesNote=ie(e),this.loadedEngines=!1}}pickEngine(e){this.engine=e;const t=this.engines?.engines.find(a=>a.engine_id===e),s=t?.supported_languages??[];this.language=s.includes("he")?"he":s.includes("iw")?"iw":t?.default_language??s[0]??""}busySeconds(){return Math.max(0,Math.ceil((this.retryAt-Date.now())/1e3))}startRetryClock(){window.clearInterval(this.timer),this.timer=window.setInterval(()=>{this.busySeconds()<=0?(window.clearInterval(this.timer),this.retryAt=0):this.requestUpdate()},1e3)}ready(){const e=we(this.message);return!!this.engine&&e>0&&e<=Y&&!this.sending&&!this.locked&&this.busySeconds()===0&&!!this.current()?.stationIds.length}async send(){const e=this.current(),t=fe(this.message);if(!this.ready()||!e)return;const s=$().announceDlg,a=e.stationIds.filter(l=>this.online().some(h=>h.id===l));if(!a.length){this.result={tone:"warn",text:s.noTargets};return}this.sending=!0,this.result=null;let i=[];try{i=await mt({stationIds:a,engine_id:this.engine,language:this.language||null,message:t})}finally{this.sending=!1}for(const l of i)l.status&&this.dispatchEvent(new CustomEvent("tts-status",{detail:l.status,bubbles:!0,composed:!0}));this.sent=i.filter(l=>l.outcome==="sent").map(l=>l.station_id),this.result=this.summarize(i),i.some(l=>l.outcome==="unknown")&&(this.locked=!0);const o=i.filter(l=>l.code==="audio_busy").map(l=>l.retry_after_s??10);o.length&&!this.locked&&(this.retryAt=Date.now()+Math.min(...o)*1e3,this.startRetryClock())}summarize(e){const t=$().announceDlg,s=e.filter(o=>o.outcome==="sent"),a=e.filter(o=>o.outcome!=="sent"),i=o=>this.stations.find(l=>l.id===o)?.name??o;return a.length?e.some(o=>o.outcome==="unknown")?{tone:"warn",text:s.length?b(t.partial,{ok:s.length,bad:a.length,names:a.map(o=>i(o.station_id)).join(", ")})+" · "+t.unknown:t.unknown}:s.length?{tone:"warn",text:b(t.partial,{ok:s.length,bad:a.length,names:a.map(o=>i(o.station_id)).join(", ")})}:a.every(o=>o.code==="audio_busy")?{tone:"warn",text:t.busy}:{tone:"err",text:a[0].error??t.failed}:{tone:"ok",text:s.length===1?t.sentOne:b(t.sentMany,{n:s.length})}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}progress(){if(this.sent.length!==1)return"";const e=this.tts[this.sent[0]];return e?Te(e):""}renderResult(){if(!this.result)return r;const e=$().announceDlg,t=this.busySeconds(),s=this.progress()&&this.result.tone==="ok"?this.progress():this.result.text;return n`<div class="result ${this.result.tone}" role="status" data-wk-announce-result data-tone=${this.result.tone}>${s}${t>0?n` · ${b(e.busyIn,{n:t})}`:r}</div>`}render(){const e=$().announceDlg,t=this.choices(),s=this.current(),a=we(this.message),o=this.engines?.engines.find(c=>c.engine_id===this.engine)?.supported_languages??[],l=this.phrases.length?this.phrases:e.phraseList,h=this.result?.tone==="ok"&&this.sent.length>0;return n`<sw-dialog ?open=${this.open} wide ?locked=${this.sending} heading=${e.title} data-wk-announce-dialog @close=${()=>this.close()}>
      <div class="body">
        <div class="fld">
          <label>${e.to}</label>
          <div class="chips" role="group" aria-label=${e.to}>
            ${t.length?t.map(c=>n`<button type="button" class="chip" data-wk-target=${c.key} aria-pressed=${String(c.key===s?.key)} ?disabled=${this.sending} @click=${()=>this.choice=c.key}>
                    ${c.kind==="station"?n`<sw-icon name="door" size=${14}></sw-icon>`:c.kind==="place"?n`<sw-icon name="pin" size=${14}></sw-icon>`:r}<span>${c.label}</span>
                  </button>`):n`<span class="note" data-wk-announce-notargets>${e.noTargets}</span>`}
          </div>
        </div>
        <div class="fld">
          <label for="msg">${e.message}</label>
          <textarea id="msg" data-wk-announce-message rows="3" maxlength=${Y*2} ?disabled=${this.sending||this.locked} .value=${this.message} @input=${c=>this.message=c.target.value}></textarea>
          <span class="cnt ${a>Y?"over":""}" aria-live="polite">${b(e.counter,{n:a,max:Y})}</span>
        </div>
        <div class="fld">
          <label>${e.phrases}</label>
          <div class="chips" role="group" aria-label=${e.phrases}>
            ${l.map(c=>n`<button type="button" class="chip" data-wk-phrase aria-pressed=${String(fe(this.message)===c)} ?disabled=${this.sending||this.locked} @click=${()=>this.message=c}><span>${c}</span></button>`)}
          </div>
        </div>
        <div class="prev" data-wk-announce-preview>
          <sw-icon name="volume" size=${15}></sw-icon>
          <span>${b(e.preview,{lang:me(this.language||"he"),voice:e.voiceDefault,n:xt(this.message)})}</span>
          <span class="sp"></span>
          <wk-action-button tone="quiet" data-wk-announce-more aria-expanded=${String(this.more)} @click=${()=>this.more=!this.more}>${e.more}</wk-action-button>
        </div>
        ${this.more?n`<div class="engine" data-wk-announce-engine>
                ${this.engines?.engines.length?n`<sw-field label=${e.engine}>
                        <select data-wk-engine .value=${this.engine} @change=${c=>this.pickEngine(c.target.value)}>
                          ${this.engines.engines.map(c=>n`<option value=${c.engine_id} ?selected=${c.engine_id===this.engine}>${c.name}</option>`)}
                        </select>
                      </sw-field>
                      ${o.length?n`<sw-field label=${e.language}>
                            <select data-wk-language .value=${this.language} @change=${c=>this.language=c.target.value}>
                              ${o.map(c=>n`<option value=${c} ?selected=${c===this.language}>${me(c)}</option>`)}
                            </select>
                          </sw-field>`:r}`:n`<span class="note">${this.enginesNote||e.enginesLoading}</span>`}
                <span class="note" style="grid-column:1/-1">${e.external}</span>
              </div>`:!this.engines&&this.enginesNote?n`<div class="result warn" role="status" data-wk-announce-engines-state>${this.enginesNote}</div>`:r}
        ${this.renderResult()}
      </div>
      <div slot="footer">
        <wk-action-button tone="primary" icon="volume" data-wk-announce-send ?disabled=${!this.ready()} ?busy=${this.sending} @click=${()=>void this.send()}>${this.sending?e.sending:h?e.sendAgain:e.send}</wk-action-button>
        <wk-action-button data-wk-announce-close ?disabled=${this.sending} @click=${()=>this.close()}>${h?e.close:e.cancel}</wk-action-button>
      </div>
    </sw-dialog>`}};m.styles=H`
    .body {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .fld {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      position: relative;
    }
    .fld > label {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    .chip {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-touch-desktop, 44px);
      max-inline-size: 100%;
      padding-inline: var(--sw-s-3h);
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      text-align: start;
    }
    .chip:hover {
      background: var(--sw-surface-2);
    }
    .chip[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-medium);
    }
    .chip span {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chip:focus-visible,
    textarea:focus-visible,
    select:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    textarea {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: 88px;
      padding: var(--sw-s-3) var(--sw-s-3) var(--sw-s-5);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-base);
      line-height: 1.5;
      resize: vertical;
    }
    textarea:disabled {
      opacity: var(--sw-disabled-opacity);
    }
    .cnt {
      position: absolute;
      inset-block-end: var(--sw-s-2);
      inset-inline-end: var(--sw-s-3);
      font-size: var(--sw-fs-2xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
      direction: ltr;
      pointer-events: none;
    }
    .cnt.over {
      color: var(--sw-danger-text);
      font-weight: var(--sw-fw-semibold);
    }
    .prev {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .prev .sp {
      flex: 1;
    }
    .engine {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--sw-s-3);
    }
    .engine select {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-3);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .result {
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
      line-height: 1.4;
    }
    .result.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .result.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .result.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    @media (max-width: 1100px) {
      .chip,
      .engine select {
        min-block-size: 44px;
      }
    }
  `;v([u({type:Boolean,reflect:!0})],m.prototype,"open",2);v([u({attribute:!1})],m.prototype,"stations",2);v([u({attribute:!1})],m.prototype,"places",2);v([u()],m.prototype,"scope",2);v([u({attribute:!1})],m.prototype,"phrases",2);v([u()],m.prototype,"preselect",2);v([u({attribute:!1})],m.prototype,"tts",2);v([d()],m.prototype,"engines",2);v([d()],m.prototype,"enginesNote",2);v([d()],m.prototype,"engine",2);v([d()],m.prototype,"language",2);v([d()],m.prototype,"message",2);v([d()],m.prototype,"choice",2);v([d()],m.prototype,"sending",2);v([d()],m.prototype,"result",2);v([d()],m.prototype,"locked",2);v([d()],m.prototype,"retryAt",2);v([d()],m.prototype,"more",2);v([d()],m.prototype,"sent",2);m=v([R("wk-announce-dialog")],m);var cs=Object.defineProperty,ds=Object.getOwnPropertyDescriptor,O=(e,t,s,a)=>{for(var i=a>1?void 0:a?ds(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&cs(t,s,i),i};let _=class extends D{constructor(){super(...arguments),this.stationId="",this.talk=null,this.live=!0,this.dial=!1,this.idleLabel="",this.deps=null,this.tick=0,this.mic="unknown",this.session=null,this.timer=0,this.activate=()=>{const e=this.ensure();e.phase==="idle"?e.start():(e.phase==="open"||e.phase==="talking")&&e.toggleMute()}}connectedCallback(){super.connectedCallback(),qe().then(e=>this.mic=e)}disconnectedCallback(){super.disconnectedCallback(),this.session?.dispose(),this.session=null,window.clearInterval(this.timer)}updated(e){e.has("stationId")&&e.get("stationId")!==void 0&&(this.session?.dispose(),this.session=null)}ensure(){if(this.session&&this.session.stationId===this.stationId)return this.session;const e=this.talk,t=Math.max(80,Math.round((e?.sample_rate??8e3)*(e?.frame_ms??20)/1e3)),s={start:(a,i)=>Ye(a,i),stop:a=>Ke(a),socket:a=>new WebSocket(We(a)),mic:(a,i,o)=>Ue(a,i,o),requestId:()=>He(),now:()=>Date.now(),after:(a,i)=>window.setTimeout(a,i),cancel:a=>window.clearTimeout(a),changed:()=>this.onChange(),floor:a=>this.dispatchEvent(new CustomEvent("talk-floor",{detail:{held:a,stationId:this.stationId},bubbles:!0,composed:!0}))};return this.session=new Be(this.stationId,e?.codec==="pcma"?"pcma":"pcmu",t,{...s,...this.deps??{}}),this.session}onChange(){this.tick+=1;const e=this.session;window.clearInterval(this.timer),e&&(e.phase==="open"||e.phase==="talking")&&(this.timer=window.setInterval(()=>this.tick+=1,1e3)),this.dispatchEvent(new CustomEvent("talk-state",{detail:{phase:e?.phase??"idle",problem:e?.problem??null,outcome:e?.outcome??null},bubbles:!0,composed:!0}))}blocked(){return this.mic==="insecure"?"insecure":this.mic==="denied"?"denied":null}end(){this.session?.end()}render(){const e=j(),t=e.talk,s=this.session,a=s?.phase??"idle",i=!!this.talk?.busy&&a==="idle",o=this.blocked(),l=!this.live||a==="idle"&&(i||!!o),h=s?.secondsLeft()??null,c=s?.secondsOpen()??null;this.tick;const p=a==="open"||a==="talking",x=this.idleLabel||(this.dial?e.dial.dial:t.start),S=a==="talking"?t.talking:a==="starting"?t.starting:a==="open"?t.muted:x,k=a==="talking"?t.mute:a==="open"?t.unmute:x,f=a==="idle"&&this.dial?U("phone",18):null,I=s?.problem??(a==="idle"?o:null),A=I?{tone:I==="busy"||I==="expired"?"warn":"error",text:t.problems[I]}:i?{tone:"warn",text:t.busy}:a==="idle"&&s?.outcome?{tone:"",text:t.ended}:p&&s?.echoCancelled===!1?{tone:"warn",text:t.headset}:null;return n`<button
        type="button"
        class="ptt"
        data-wk-ptt
        data-phase=${a}
        data-muted=${p?String(a==="open"):r}
        aria-pressed=${p?String(a==="open"):r}
        aria-label=${k}
        ?disabled=${l}
        @click=${this.activate}
      >
        ${a==="talking"?n`<i class="dot" aria-hidden="true"></i>`:f??n`<sw-icon name=${a==="open"?"micOff":"mic"} size=${18}></sw-icon>`}<span>${S}</span>
      </button>
      ${A||a==="open"||a==="talking"?n`<div class="row">
            <span class="line" role="status" aria-live="polite" data-wk-talk-line data-tone=${A?.tone??""} data-problem=${I??""}
              >${A?A.text:n`${c!==null?n`<span class="elapsed" data-wk-talk-elapsed>${e.dial.inCall} <bdi>${te(c)}</bdi></span> · `:r}${h!==null?n`<span class="left" data-wk-talk-left>${_e(t.left,{t:te(h)})}</span>`:r}`}</span
            >
            ${a==="open"||a==="talking"?n`<wk-action-button tone="danger" icon="hangup" data-wk-talk-end @click=${()=>this.end()}>${this.dial?e.dial.hangUp:t.end}</wk-action-button>`:r}
          </div>`:r}`}};_.styles=H`
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
  `;O([u()],_.prototype,"stationId",2);O([u({attribute:!1})],_.prototype,"talk",2);O([u({type:Boolean})],_.prototype,"live",2);O([u({type:Boolean})],_.prototype,"dial",2);O([u()],_.prototype,"idleLabel",2);O([u({attribute:!1})],_.prototype,"deps",2);O([d()],_.prototype,"tick",2);O([d()],_.prototype,"mic",2);_=O([R("wk-talk-button")],_);function hs(e){const t=~e&255,s=t&128,a=t>>4&7,o=((t&15)<<3)+132<<a;return s?132-o:o-132}function ps(e){const t=e^85,s=(t&112)>>4;let a=(t&15)<<4;return s===0?a+=8:s===1?a+=264:a=a+264<<s-1,(t&128)!==0?a:-a}function us(e,t="pcmu"){const s=new Float32Array(e.length),a=t==="pcma"?ps:hs;for(let i=0;i<e.length;i+=1)s[i]=a(e[i]&255)/32768;return s}function ws(e){if(!e.length)return 0;let t=0;for(let s=0;s<e.length;s+=1)t+=e[s]*e[s];return Math.min(1,Math.sqrt(t/e.length)*4)}function fs(e,t){if(t<=0)return e;const s=e*.5**(t/150);return s<.01?0:s}const be={intercom_listen_busy:"busy",intercom_listen_user_busy:"user_busy",intercom_listen_unsupported:"unsupported",intercom_listen_no_listen:"no_listen",intercom_listen_off:"off",intercom_station_offline:"offline",intercom_listen_unavailable:"unavailable",intercom_unavailable:"unavailable",intercom_station_not_found:"unavailable",forbidden:"forbidden"};function gs(e){if(e instanceof Z){if(be[e.code])return be[e.code];if(e.status===403)return"forbidden";if(e.status===0)return"network"}return e instanceof TypeError?"network":"failed"}function ms(e){switch(e){case"ended":case"stopped":return null;case"expired":return"expired";case"access_lost":return"access_lost";case"upstream_closed":case"upstream_unavailable":return"upstream";case"network":return"network";default:return"failed"}}class bs{constructor(t,s){this.stationId=t,this.deps=s,this.phase="idle",this.problem=null,this.outcome=null,this.muted=!1,this.endsAt=0,this.starts=0,this.frames=0,this.level=0,this.levelAt=0,this.gen=0,this.reply=null,this.ws=null,this.sink=null,this.codec="pcmu",this.rate=8e3}secondsLeft(){return this.phase==="listening"?Math.max(0,Math.ceil((this.endsAt-this.deps.now())/1e3)):null}levelNow(){return this.phase==="listening"?fs(this.level,this.deps.now()-this.levelAt):0}async start(){if(this.phase!=="idle")return;this.problem=null;const t=this.deps.sink();if(!t){this.problem="no_audio",this.deps.changed();return}this.sink=t,t.setMuted(this.muted),this.phase="starting";const s=++this.gen;this.deps.changed();let a;try{this.starts+=1,a=await this.deps.start(this.stationId,this.deps.requestId())}catch(o){s===this.gen&&this.fail(gs(o));return}if(s!==this.gen){this.deps.stop(a.session).catch(()=>{});return}this.reply=a,this.codec=a.codec,this.rate=a.sample_rate,this.endsAt=this.deps.now()+a.max_seconds*1e3;let i;try{i=this.deps.socket(a.ws_path)}catch{this.deps.stop(a.session).catch(()=>{}),this.fail("network");return}i.binaryType="arraybuffer",this.ws=i,i.onmessage=o=>{if(s!==this.gen)return;if(typeof o.data!="string"){this.phase==="listening"&&this.onFrame(o.data);return}let l;try{l=JSON.parse(o.data)}catch{return}l.type==="listen/state"&&l.value==="open"&&this.phase==="starting"?(this.phase="listening",this.levelAt=this.deps.now(),this.deps.changed()):l.type==="listen/closed"&&this.finish(String(l.value??"ended"))},i.onclose=o=>{s===this.gen&&this.finish(Ve(o.code))},i.onerror=()=>{}}setMuted(t){this.muted=t,this.sink?.setMuted(t),this.deps.changed()}stop(){if(this.phase==="idle")return;const t=this.ws,s=this.reply;t&&t.readyState===1?t.send(JSON.stringify({type:"listen/stop"})):s&&this.deps.stop(s.session).catch(()=>{}),this.finish("ended")}dispose(){this.stop()}onFrame(t){const s=us(new Uint8Array(t),this.codec);this.frames+=1,this.level=ws(s),this.levelAt=this.deps.now(),this.sink?.play(s,this.rate)}teardown(){this.gen+=1;const t=this.ws;if(this.ws=null,t){t.onmessage=null,t.onclose=null,t.onerror=null;try{t.close()}catch{}}this.sink?.close(),this.sink=null,this.reply=null,this.endsAt=0,this.level=0}fail(t){this.teardown(),this.phase="idle",this.problem=t,this.outcome=null,this.deps.changed()}finish(t){this.teardown(),this.phase="idle",this.outcome=t,this.problem=ms(t),this.deps.changed()}}const vs=.06,ks=.3;function $s(e,t){const s=Math.max(t,e+vs);return s-e>ks?null:s}function ys(){const e=globalThis.AudioContext??globalThis.webkitAudioContext;if(!e)return null;let t;try{t=new e}catch{return null}t.resume().catch(()=>{});const s=t.createGain();s.connect(t.destination);let a=0;return{play(i,o){const l=$s(t.currentTime,a);if(l===null)return;const h=t.createBuffer(1,i.length,o);h.copyToChannel(i,0);const c=t.createBufferSource();c.buffer=h,c.connect(s),c.start(l),a=l+h.duration},setMuted(i){s.gain.value=i?0:1},close(){t.close().catch(()=>{})}}}var xs=Object.defineProperty,_s=Object.getOwnPropertyDescriptor,N=(e,t,s,a)=>{for(var i=a>1?void 0:a?_s(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&xs(t,s,i),i};let C=class extends D{constructor(){super(...arguments),this.stationId="",this.live=!0,this.deps=null,this.capability=null,this.tick=0,this.session=null,this.timer=0,this.loadedFor=""}realDeps(){const e=this.deps??{};return{start:e.start??((t,s)=>Tt(t,s)),stop:e.stop??(t=>St(t)),socket:e.socket??(t=>new WebSocket(zt(t))),sink:e.sink??(()=>ys()),requestId:e.requestId??(()=>_t()),now:e.now??(()=>Date.now()),changed:()=>{this.tick+=1,this.syncTimer()}}}ensureSession(){return(!this.session||this.session.stationId!==this.stationId)&&(this.session?.dispose(),this.session=new bs(this.stationId,this.realDeps())),this.session}syncTimer(){const e=this.session?.phase==="listening";e&&!this.timer?this.timer=window.setInterval(()=>this.tick+=1,150):!e&&this.timer&&(window.clearInterval(this.timer),this.timer=0)}willUpdate(e){(e.has("stationId")||e.has("live"))&&this.stationId&&this.live&&!this.deps?.start&&this.loadedFor!==this.stationId&&!this.capability&&(this.loadedFor=this.stationId,Ot(this.stationId).then(t=>{this.loadedFor===this.stationId&&(this.capability=t)}).catch(()=>{}))}disconnectedCallback(){super.disconnectedCallback(),this.session?.dispose(),this.session=null,this.timer&&window.clearInterval(this.timer),this.timer=0}get offered(){const e=this.session,t=e!==null&&e.phase!=="idle";return this.live&&(t||!!e?.problem||!!this.capability?.available)}updated(e){super.updated(e),this.toggleAttribute("hidden",!this.offered)}toggle(){const e=this.ensureSession();e.phase==="idle"?e.start():e.stop()}render(){const e=this.session;if(!this.offered)return r;const t=Ct(),s=e?.phase??"idle",a=e?.secondsLeft(),i=Math.round((e?.levelNow()??0)*100),o=s==="starting"?t.starting:s==="listening"?`${t.listening}${a!=null?` · ${_e(t.left,{t:te(a)})}`:""}`:"";return n`
      <div class="row" data-wk-listen>
        <button class="main" type="button" data-wk-listen-toggle aria-pressed=${String(s!=="idle")} @click=${()=>this.toggle()}>
          <sw-icon name=${s==="idle"?"volume":"hangup"} size=${18}></sw-icon>
          ${s==="idle"?t.start:t.stop}
        </button>
        ${s==="listening"?n`<button type="button" data-wk-listen-mute aria-pressed=${String(e.muted)} aria-label=${e.muted?t.unmute:t.mute} @click=${()=>e.setMuted(!e.muted)}>
              ${e.muted?t.unmute:t.mute}
            </button>`:r}
      </div>
      ${s==="listening"?n`<div class="meter ${e.muted?"muted":""}" role="meter" aria-label=${t.level} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${i} data-wk-listen-level>
            <i style=${`inline-size:${i}%`}></i>
          </div>`:r}
      ${o?n`<div class="msg" data-wk-listen-state>${o}${e?.muted?` · ${t.muted}`:""}</div>`:r}
      ${s==="idle"&&e?.problem?n`<div class="msg problem" data-wk-listen-problem role="status">${t.problems[e.problem]}</div>`:r}
      ${s==="idle"&&!e?.problem&&e?.outcome?n`<div class="msg" data-wk-listen-ended>${t.ended}</div>`:r}
    `}};C.styles=H`
    :host {
      display: grid;
      gap: var(--sw-s-2);
      min-inline-size: 0;
    }
    /* nothing offered: no box at all, so the drawer's grid keeps no empty row and no gap for it */
    :host([hidden]) {
      display: none;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    button {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      min-block-size: max(44px, var(--sw-ctl-h, 0px));
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
    }
    button.main {
      flex: 1;
    }
    button[aria-pressed='true'] {
      border-color: var(--sw-accent);
    }
    button:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .meter {
      block-size: 8px;
      border-radius: 4px;
      background: var(--sw-surface-sunken, var(--sw-border));
      overflow: hidden;
      direction: ltr;
    }
    .meter > i {
      display: block;
      block-size: 100%;
      inline-size: 0;
      background: var(--sw-accent);
    }
    .meter.muted > i {
      opacity: 0.35;
    }
    .msg {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-muted);
    }
    .msg.problem {
      color: var(--sw-warn, var(--sw-text));
    }
  `;N([u()],C.prototype,"stationId",2);N([u({type:Boolean})],C.prototype,"live",2);N([u({attribute:!1})],C.prototype,"deps",2);N([u({attribute:!1})],C.prototype,"capability",2);N([d()],C.prototype,"tick",2);C=N([R("wk-listen-button")],C);var zs=Object.defineProperty,Ss=Object.getOwnPropertyDescriptor,z=(e,t,s,a)=>{for(var i=a>1?void 0:a?Ss(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&zs(t,s,i),i};let y=class extends D{constructor(){super(...arguments),this.stationId="",this.stationName="",this.media=null,this.poster="",this.live=!0,this.classicHref="",this.classicLabel="",this.talkHere=!0,this.profile=null,this.mutedBefore=null,this.onOuterFloor=e=>{if(this.talkHere)return;e.detail?.stationId===this.stationId&&this.onFloor(e)},this.onFloor=e=>{const t=e.detail.held,s=this.player;!s||this.media?.talk?.duplex==="full"||(t?(this.mutedBefore=s.muted,s.muted=!0):this.mutedBefore!==null&&(s.muted=this.mutedBefore,this.mutedBefore=null))}}connectedCallback(){super.connectedCallback(),window.addEventListener("talk-floor",this.onOuterFloor)}disconnectedCallback(){window.removeEventListener("talk-floor",this.onOuterFloor),super.disconnectedCallback()}willUpdate(e){if(e.has("media")||e.has("stationId")){const t=this.media?.video?.profiles.map(s=>s.id)??[];(!this.profile||!t.includes(this.profile)||e.has("stationId"))&&(this.profile=Je(this.media?.video??null))}}render(){const e=this.media,t=e?.video,s=j(),a=t?.profiles.find(l=>l.id===this.profile),i=a?t?.paths[a.id]:void 0,o=e?.talk;return n`
      ${i?n`<div class="frame" data-wk-live-frame data-profile=${a.id}>
            <sw-live-player .livePath=${i} .profile=${a.id} .mode=${Xe(a)} .poster=${this.poster} data-wk-live-player aria-label=${`${s.live.label} · ${this.stationName}`}></sw-live-player>
          </div>`:this.poster?n`<div class="frame" data-wk-live-frame data-profile=""><img src=${this.poster} alt=${`${s.live.poster} · ${this.stationName}`} decoding="async" /></div>`:r}
      ${t&&t.profiles.length>1&&i?n`<div class="bar">
            <span class="lbl" id="q">${s.live.quality}</span>
            <div class="seg" role="group" aria-labelledby="q" data-wk-quality>
              ${t.profiles.map(l=>n`<button type="button" data-profile=${l.id} aria-pressed=${String(l.id===this.profile)} @click=${()=>this.profile=l.id}>${l.id==="main"?s.live.main:s.live.sub}</button>`)}
            </div>
          </div>`:r}
      ${this.talkHere?o?.available?n`<wk-talk-button .stationId=${this.stationId} .talk=${o} .live=${this.live} data-wk-talk="native" @talk-floor=${this.onFloor}></wk-talk-button>`:this.classicHref?n`<wk-action-button tone="dashed" icon="window" block size="lg" href=${this.classicHref} data-wk-talk="classic">${this.classicLabel}</wk-action-button>`:r:r}
      ${e?.state==="ready"?n`<wk-listen-button .stationId=${this.stationId} .live=${this.live}></wk-listen-button>`:r}
    `}};y.styles=H`
    :host {
      display: grid;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .frame {
      position: relative;
      direction: ltr;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-media, var(--sw-r-md));
      overflow: hidden;
      background: var(--sw-video-bg);
    }
    sw-live-player,
    .frame img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }
    .frame img {
      object-fit: cover;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .seg {
      display: inline-flex;
      align-items: stretch;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      background: var(--sw-surface);
    }
    .seg button {
      min-block-size: var(--sw-touch-desktop, 44px);
      min-inline-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-3);
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .seg button + button {
      border-inline-start: 1px solid var(--sw-border);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: calc(-1 * var(--sw-focus-w));
    }
    .lbl {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    @media (max-width: 1100px) {
      .seg button {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
  `;z([u()],y.prototype,"stationId",2);z([u()],y.prototype,"stationName",2);z([u({attribute:!1})],y.prototype,"media",2);z([u()],y.prototype,"poster",2);z([u({type:Boolean})],y.prototype,"live",2);z([u()],y.prototype,"classicHref",2);z([u()],y.prototype,"classicLabel",2);z([u({type:Boolean})],y.prototype,"talkHere",2);z([d()],y.prototype,"profile",2);z([Ge("sw-live-player")],y.prototype,"player",2);y=z([R("wk-station-live")],y);const Ts=45e3,Os=12e4;function Cs(e){const t=e instanceof Z?Number(e.body?.details?.retry_after_s):NaN;return Number.isFinite(t)&&t>=0?Math.ceil(t*1e3):At}function ve(e,t=$()){return Ze(e)!=="unknown"?{tone:"err",text:ie(e),unknown:!1}:{tone:"warn",text:t.call.unknown,unknown:!0}}function Is(e,t=$()){const s={answer:t.call.answer,reject:t.call.reject,hangUp:t.call.hangUp},a=b(t.call.sent,{label:s[e.command]??e.command,ack:e.acknowledged===!0?t.call.ack:t.call.noAck});if(e.observation==="unavailable"||!e.observed_state)return`${a} · ${t.call.stateUnread}`;const i=B(e.observed_state,t);return`${a} · ${b(e.observation==="unchanged"?t.call.stateUnchanged:t.call.state,{state:i})}`}const Ls=["started","generating","speaking","completed","closed"],ke=e=>Ls.indexOf(e.state);class J{constructor(t){this.deps=t,this.confirm=null,this.releasing=new Set,this.held={},this.results={},this.callBusy=new Set,this.armed=null,this.tts={},this.armTimer=0,this.holdTimer=0}dispose(){this.deps.cancel(this.armTimer),this.deps.cancel(this.holdTimer)}static key(t,s){return`${t}/${s}`}isHeld(t){return(this.held[t]??0)>this.deps.now()}setResult(t,s,a){this.results={...this.results,[t]:{tone:s,text:a,at:this.deps.now()}},this.deps.changed()}prune(){const t=this.deps.now(),s=Object.entries(this.results).filter(([,a])=>t-a.at<(a.tone==="warn"?Os:Ts));s.length!==Object.keys(this.results).length&&(this.results=Object.fromEntries(s),this.deps.changed())}clearResult(t){if(!(t in this.results))return;const s={...this.results};delete s[t],this.results=s,this.deps.changed()}askRelease(t,s){const a=J.key(t,s);return!this.deps.live()||this.releasing.has(a)||this.isHeld(a)?!1:(this.confirm={stationId:t,lock:s},this.deps.changed(),!0)}cancelRelease(){this.confirm&&(this.confirm=null,this.deps.changed())}async confirmRelease(){const t=this.confirm;if(!t)return;const s=J.key(t.stationId,t.lock);if(!(!this.deps.live()||this.releasing.has(s)||this.isHeld(s))){this.releasing=new Set([...this.releasing,s]),this.deps.changed();try{await this.deps.release(t.stationId,t.lock),this.setResult(t.stationId,"ok",b($().door.sentAt,{at:this.deps.stamp()}))}catch(a){const i=ve(a);this.setResult(t.stationId,i.tone,i.unknown?$().door.unknown:i.text),(i.unknown||a instanceof Z&&a.code==="intercom_release_in_progress")&&this.hold(s,Cs(a))}finally{const a=new Set(this.releasing);a.delete(s),this.releasing=a,this.confirm===t&&(this.confirm=null),this.deps.changed()}}}hold(t,s){const a=this.deps.now()+s;this.held={...this.held,[t]:Math.max(this.held[t]??0,a)},this.deps.cancel(this.holdTimer);const i=Object.values(this.held).filter(o=>o>this.deps.now());i.length&&(this.holdTimer=this.deps.after(()=>{this.held={...this.held},this.deps.changed()},Math.min(...i)-this.deps.now()+50)),this.deps.changed()}tapCall(t,s,a=1){const i=this.deps.station(t);if(!i||this.callBusy.has(t)||!this.deps.live()||a>1)return;const o=this.armed;if(o&&o.id===t&&o.command===s&&o.callState===i.call_state){if(this.deps.tick()-o.at<It)return;this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed(),this.sendCall(t,s);return}this.deps.cancel(this.armTimer),this.armed={id:t,command:s,at:this.deps.tick(),callState:i.call_state},this.armTimer=this.deps.after(()=>{this.armed=null,this.deps.changed()},Lt),this.deps.changed()}dropStaleArm(){const t=this.armed;if(!t)return;const s=this.deps.station(t.id);(!this.deps.live()||!s||!s.online||s.call_state!==t.callState)&&(this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed())}async sendCall(t,s){this.callBusy=new Set([...this.callBusy,t]),this.deps.changed();try{const a=await this.deps.signal(t,s);a.call&&this.setResult(t,a.call.acknowledged===!0?"ok":"warn",Is(a.call))}catch(a){const i=ve(a);this.setResult(t,i.tone,i.text)}finally{const a=new Set(this.callBusy);a.delete(t),this.callBusy=a,this.deps.changed(),this.deps.refetch()}}noteTts(t){const s=this.tts[t.station_id];s&&s.at>=t.at&&ke(s)>ke(t)||(this.tts={...this.tts,[t.station_id]:t},this.deps.changed())}}const As=H`
  :host {
    display: block;
    --wk-hit: var(--sw-touch-desktop, 44px);
  }
  @media (max-width: 1100px) {
    :host {
      --wk-hit: 44px;
    }
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .search {
    flex: 1 1 220px;
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-inline-size: 0;
    max-inline-size: 420px;
    padding-inline: var(--sw-s-3);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text-3);
  }
  .search:focus-within {
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 3px var(--sw-accent-soft);
  }
  .search input {
    flex: 1;
    min-inline-size: 0;
    min-block-size: var(--wk-hit);
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-base);
  }
  .lbl {
    min-inline-size: 0;
  }
  .layout {
    display: grid;
    grid-template-columns: var(--wk-tree, 236px) minmax(0, 1fr);
    gap: var(--sw-s-4);
    align-items: start;
  }
  .layout.no-tree {
    grid-template-columns: minmax(0, 1fr);
  }
  .treecol {
    position: sticky;
    inset-block-start: var(--sw-s-3);
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    min-inline-size: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2);
  }
  .chip {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-block-size: var(--wk-hit);
    padding-inline: var(--sw-s-4);
    border: 1px solid transparent;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    white-space: nowrap;
    cursor: pointer;
    /* R5-SECURITY: a raised key (shadow 1), sinks on pointer-down; the active one a filled accent field */
    box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  @media (hover: hover) and (pointer: fine) {
    .chip:hover {
      background: var(--sw-surface-2);
    }
  }
  .chip:active,
  .rowmain:active,
  .open:active ~ .scrim {
    transform: scale(var(--sw-press-scale));
  }
  .chip[aria-pressed='true'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
    font-weight: var(--sw-fw-bold);
  }
  .chip.places {
    display: none;
  }
  .chip:focus-visible,
  .rowmain:focus-visible,
  .open:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  .strip {
    display: flex;
    align-items: center;
    gap: var(--sw-s-3);
    padding: var(--sw-s-1) var(--sw-s-3);
    border-radius: var(--sw-r-md);
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-warning) 40%, transparent);
  }
  /* R5-SECURITY: the badges of the cards, rows and the drawer are fields - 12.5/700 on 22 px */
  sw-badge {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-bold);
    line-height: 18px;
    padding-block: 2px;
  }
  .strip .dot {
    flex: none;
    inline-size: 9px;
    block-size: 9px;
    border-radius: 50%;
    background: var(--sw-warning);
    animation: wk-blink 1.2s ease-in-out infinite;
  }
  .strip .sp {
    flex: 1;
  }

  /* ---- cards ---- */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
    gap: var(--sw-s-4);
  }
  .card {
    min-inline-size: 0;
  }
  /* the ring is the ONLY layer of the shadow: a skin may set --sw-shadow-N to "none" (Tesla does), and "none" inside a shadow list
     makes the whole declaration invalid - the ring would vanish exactly where the screen needs it */
  .card.ringing {
    box-shadow: 0 0 0 2px var(--sw-warning);
    animation: wk-ring 1.6s ease-in-out infinite;
  }
  .media {
    position: relative;
    aspect-ratio: 16 / 8;
    overflow: hidden;
    background: var(--sw-surface-3);
  }
  .media img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  .media.off img {
    filter: grayscale(1) brightness(0.7);
  }
  .none {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--sw-s-1);
    padding-block-end: 36px;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .open {
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .scrim {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: 2;
    display: flex;
    align-items: baseline;
    gap: var(--sw-s-3);
    padding: 26px 14px 10px;
    background: linear-gradient(180deg, transparent, var(--sw-video-scrim-strong));
    color: var(--sw-on-video);
    pointer-events: none;
  }
  .scrim .name {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* R5-SECURITY: the station's name is the card's display line - 20/800 */
    font-size: var(--sw-fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .scrim .place {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--sw-fs-xs);
    color: var(--sw-on-video-2);
  }
  .stamp {
    position: absolute;
    z-index: 2;
    inset-block-start: 10px;
    inset-inline-start: 10px;
    padding: 2px 7px;
    border-radius: var(--sw-r-2xs);
    background: var(--sw-video-scrim);
    color: var(--sw-on-video);
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-2xs);
    pointer-events: none;
  }
  .stamp bdi {
    direction: ltr;
    unicode-bidi: isolate;
  }
  .callbadge {
    position: absolute;
    z-index: 2;
    inset-block-start: 10px;
    inset-inline-end: 10px;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    padding: var(--sw-s-1) var(--sw-s-3);
    border: 2px solid var(--sw-warning);
    border-radius: var(--sw-r-pill);
    background: var(--sw-on-image-bg);
    color: var(--sw-text);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    box-shadow: var(--sw-shadow-2);
    pointer-events: none;
  }
  .callbadge.in_call,
  .callbadge.ending {
    border-color: var(--sw-accent);
  }
  .callbadge sw-icon,
  .callbadge .ic {
    display: inline-flex;
    color: var(--sw-warning);
  }
  .callbadge.in_call sw-icon,
  .callbadge.in_call .ic,
  .callbadge.ending sw-icon,
  .callbadge.ending .ic {
    color: var(--sw-accent);
  }
  .cb {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    padding: var(--sw-s-3) var(--sw-s-4);
  }
  .hd {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-3);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .callrow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
    min-block-size: var(--wk-hit);
    padding: var(--sw-s-1) var(--sw-s-3);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface-2);
  }
  .callrow.ringing {
    background: var(--sw-warning-soft);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-warning) 40%, transparent);
  }
  .callrow.in_call,
  .callrow.ending {
    background: var(--sw-accent-soft);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-accent) 35%, transparent);
  }
  .callrow.big {
    padding-block: var(--sw-s-3);
  }
  .cs {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-inline-size: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    white-space: nowrap;
  }
  .callrow.big .cs {
    font-size: var(--sw-fs-xl);
    font-weight: 800;
  }
  /* the controls of a call row move together: when the row is narrow they take their own line, side by side */
  .ctl {
    flex: 1 1 auto;
    display: flex;
    justify-content: flex-end;
    gap: var(--sw-s-2);
  }
  .ctl > * {
    flex: 1 1 0;
  }
  .callrow.ringing .cs {
    color: var(--sw-warning-text);
  }
  .callrow.in_call .cs,
  .callrow.ending .cs {
    color: var(--sw-accent-text);
  }
  .cs.muted {
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-regular);
  }
  /* WISKEY-TALK-DIAL-2382 (owner 03.11, Q2): the dial is Arx's talk; the classic panel is a small secondary link under it, at the end */
  .dialnative {
    display: grid;
    gap: var(--sw-s-1);
    min-inline-size: 0;
  }
  .dialnative > wk-action-button {
    justify-self: end;
  }
  /* WISKEY-TALK-DIAL-2382: why the drawer cannot dial from this screen - one sentence that wraps (never cut), the classic panel beside it */
  .cs.dialwhy {
    flex: 1 1 14em;
    white-space: normal;
    font-size: var(--sw-fs-sm);
    line-height: 1.4;
  }
  .dur {
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-3);
    direction: ltr;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
  }
  .acts .grow {
    flex: 1 1 auto;
  }
  .result {
    padding: var(--sw-s-2) var(--sw-s-3);
    border-radius: var(--sw-r-sm);
    font-size: var(--sw-fs-sm);
    line-height: 1.4;
  }
  .result.ok {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .result.warn {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .result.err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  /* in the drawer the outcome sticks to the top of the scrolling body, over a solid backing (the soft tones are translucent) */
  .result.sticky {
    position: sticky;
    inset-block-start: 0;
    z-index: 3;
    background-color: var(--sw-surface-solid);
    box-shadow: var(--sw-shadow-1);
  }
  .result.sticky.ok {
    background-image: linear-gradient(var(--sw-success-soft), var(--sw-success-soft));
  }
  .result.sticky.warn {
    background-image: linear-gradient(var(--sw-warning-soft), var(--sw-warning-soft));
  }
  .result.sticky.err {
    background-image: linear-gradient(var(--sw-danger-soft), var(--sw-danger-soft));
  }
  .tech {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-3);
    padding-block-start: var(--sw-s-3);
    border-block-start: 1px solid var(--sw-border);
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .tech .sp {
    flex: 1;
  }
  code,
  .ltr {
    font-family: var(--sw-font-mono);
    direction: ltr;
    unicode-bidi: isolate;
  }

  /* ---- list rows ---- */
  .rows {
    display: flex;
    flex-direction: column;
  }
  /* a row is two groups: the station (opens the drawer) and its side - call pill, "seen", actions, chevron. When the row is
     narrow the side takes its own line below the station, whole, instead of squeezing the station's name away. */
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
    padding: var(--sw-s-2) var(--sw-s-3);
    border-block-start: 1px solid var(--sw-border);
  }
  .row:first-child {
    border-block-start: 0;
  }
  .rowside {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2) var(--sw-s-3);
    margin-inline-start: auto;
  }
  .rowmain {
    flex: 1 1 220px;
    display: flex;
    align-items: center;
    gap: var(--sw-s-3);
    min-inline-size: min(220px, 100%);
    min-block-size: var(--wk-hit);
    padding: 0;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .thumb {
    flex: none;
    inline-size: 64px;
    block-size: 40px;
    border-radius: var(--sw-r-xs);
    overflow: hidden;
    background: var(--sw-surface-3);
    display: grid;
    place-items: center;
    color: var(--sw-text-3);
  }
  .thumb img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  .thumb.off img {
    filter: grayscale(1) brightness(0.7);
  }
  .rowtext {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }
  .rowtext .t {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-md);
    color: var(--sw-heading, var(--sw-text));
  }
  .row[data-status='ringing'] {
    background: var(--sw-warning-soft);
  }
  .rowtext .t b {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rowtext .s {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sdot {
    flex: none;
    inline-size: 9px;
    block-size: 9px;
    border-radius: 50%;
    background: var(--sw-live);
  }
  .sdot.off {
    background: var(--sw-offline);
  }
  .seen {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    white-space: nowrap;
  }
  .rowacts {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
  }
  .pillcall {
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    padding: 2px var(--sw-s-3);
    border-radius: var(--sw-r-pill);
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    white-space: nowrap;
  }
  .pillcall.in_call,
  .pillcall.ending {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }

  /* ---- the drawer ---- */
  .live {
    position: relative;
    flex: none;
    aspect-ratio: 16 / 9;
    border-radius: var(--sw-r-md);
    overflow: hidden;
    background: var(--sw-surface-3);
  }
  .live img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    filter: saturate(0.7) brightness(0.85);
  }
  .live.off img {
    filter: grayscale(1) brightness(0.6);
  }
  .live .ov {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--sw-s-3);
    background: linear-gradient(180deg, transparent, var(--sw-video-scrim));
    color: var(--sw-on-video);
    text-align: center;
  }
  .live .ov .t {
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    font-size: var(--sw-fs-base);
    font-weight: var(--sw-fw-semibold);
  }
  .live .none {
    padding-block-end: 0;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sw-s-3);
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  /* CR-036 S12 / WXSCH: the quiet ways on from a station - its entry log, the schedules of its doors */
  .evlink {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: var(--sw-s-2);
  }
  .dsec {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    flex: none;
    padding: var(--sw-s-4);
    border: 1px solid transparent;
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface-2);
  }
  /* R5-SECURITY: the drawer's sections are wells; their headings 14.5/700 in the heading ink; the door name 15/700 */
  .dsec h4 {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    margin: 0;
    color: var(--sw-heading, var(--sw-text));
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
  }
  .doorrow {
    display: flex;
    align-items: center;
    gap: var(--sw-s-3);
    min-block-size: var(--wk-hit);
  }
  .doorrow .dn {
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-lg);
    color: var(--sw-heading, var(--sw-text));
  }
  .doorrow .ds {
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-1);
    min-inline-size: 0;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .kv {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sw-s-2) var(--sw-s-4);
    margin: 0;
    font-size: var(--sw-fs-sm);
  }
  .kv dt {
    color: var(--sw-text-3);
  }
  .kv dd {
    margin: 0;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-block-size: var(--wk-hit);
    padding-inline: var(--sw-s-1);
    border: 0;
    border-radius: var(--sw-r-sm);
    background: none;
    color: var(--sw-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    text-align: start;
    cursor: pointer;
  }
  .toggle sw-icon {
    transition: transform var(--sw-t-fast) var(--sw-ease);
  }
  .toggle[aria-expanded='true'] sw-icon {
    transform: rotate(180deg);
  }
  .toggle:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  .prog {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-1);
    padding-block: var(--sw-s-2);
    border-block-start: 1px solid var(--sw-border);
    font-size: var(--sw-fs-sm);
  }
  .prog:first-of-type {
    border-block-start: 0;
  }
  .prog .ph {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
    font-weight: var(--sw-fw-semibold);
  }
  .prog .line {
    color: var(--sw-text-2);
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--sw-text-3);
  }
  .tbl {
    min-inline-size: 0;
  }
  .sentence {
    margin: 0;
    font-size: var(--sw-fs-md);
    line-height: 1.5;
  }

  /* WKWATER-POLISH-2331: one rhythm between the toolbar and the columns (they touched before) */
  [data-wk-stations] {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    min-inline-size: 0;
  }
  /* a list row answers the pointer like the cards: a tone step under a fine pointer, the press scale on the station part */
  .rowmain {
    transition: transform var(--sw-t-press) var(--sw-ease-out);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .row {
    transition: background-color var(--sw-t-fast) var(--sw-ease);
  }
  @media (hover: hover) and (pointer: fine) {
    .row:not([data-status='ringing']):hover {
      background: var(--sw-surface-2);
    }
  }
  .card .tech {
    margin-block-start: auto;
  }

  @media (max-width: 1100px) {
    .layout {
      --wk-tree: 208px;
    }
  }
  /* WKWATER-POLISH-2331 (NOSCROLL-297, owner rule: a control screen fits the viewport on a desktop): above 1100 px the screen takes the
     shell's height; the title, the toolbar and the filter chips stay in place and the stations (cards, list or table) scroll inside their
     own box, the places tree inside its column. A short window keeps 240 px for the stations and lets the page scroll below that. On a
     tablet and a phone the page scrolls as before. */
  @media (min-width: 1101px) {
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
    }
    sw-page {
      flex: 1 1 auto;
      min-block-size: 0;
    }
    [data-wk-stations][data-wk-state='ready'] {
      flex: 1 1 auto;
      min-block-size: 0;
    }
    [data-wk-stations][data-wk-state='ready'] > .layout {
      flex: 1 1 auto;
      min-block-size: 240px;
      grid-template-rows: minmax(0, 1fr);
      align-items: stretch;
    }
    .treecol {
      position: static;
      max-block-size: 100%;
      min-block-size: 0;
      overflow-y: auto;
      scrollbar-width: thin;
      align-self: start;
    }
    .main {
      min-block-size: 0;
    }
    .main > .grid,
    .main > .rows-card,
    .main > sw-table {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow-y: auto;
      scrollbar-width: thin;
    }
    /* the ringing card's pulse (5 px) and the cards' shadows stay inside the scrolling box: the box keeps that much room around them */
    .main > .grid {
      grid-auto-rows: max-content;
      align-content: start;
      margin: -6px;
      padding: 6px;
    }
  }
  @media (max-width: 767px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .treecol {
      display: none;
    }
    .chip.places {
      display: inline-flex;
    }
    .chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      padding-block-end: 2px;
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .toolbar .lbl {
      display: none;
    }
    .search {
      flex-basis: 160px;
    }
    .seen {
      display: none;
    }
    /* WKWATER-POLISH-2331: on a phone the whole row opens the drawer; its chevron took a line of its own under a row's buttons */
    .rowside > sw-icon {
      display: none;
    }
  }
  @keyframes wk-ring {
    0%,
    100% {
      box-shadow: 0 0 0 2px var(--sw-warning);
    }
    50% {
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--sw-warning) 35%, transparent);
    }
  }
  @keyframes wk-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .card.ringing,
    .strip .dot {
      animation: none;
    }
  }
`;var Es=Object.defineProperty,Ms=Object.getOwnPropertyDescriptor,K=(e,t,s,a)=>{for(var i=a>1?void 0:a?Ms(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&Es(t,s,i),i};const Ds=8,Rs=3e4,Ps=`
  wk-call-history { display: contents; }
  wk-call-history ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  wk-call-history li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--sw-s-2, 8px); padding-block: 6px;
    border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm, 13px); }
  wk-call-history li:last-child { border-block-end: 0; }
  wk-call-history .cw { color: var(--sw-text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  wk-call-history .cx { min-inline-size: 0; display: grid; }
  wk-call-history .cx span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  wk-call-history .cx small, wk-call-history .cd { color: var(--sw-text-3); }
  wk-call-history .cd { font-variant-numeric: tabular-nums; }
  wk-call-history li[data-tone='warn'] .cx span { color: var(--sw-warning-text); }
  wk-call-history li[data-tone='live'] .cx span { color: var(--sw-success-text); font-weight: var(--sw-fw-semibold, 600); }
  wk-call-history .cm { background: none; border: 0; padding: 6px 0; font: inherit; font-size: var(--sw-fs-sm, 13px); color: var(--sw-accent-text); cursor: pointer; min-block-size: 32px; }
  wk-call-history .cm:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 2px; }
`;let F;function Ns(){if(F===void 0)try{F=new CSSStyleSheet,F.replaceSync(Ps)}catch{F=null}return F}function Fs(e){const t=Ns(),s=e;if(!(!t||!("adoptedStyleSheets"in s)||s.adoptedStyleSheets.includes(t)))try{s.adoptedStyleSheets=[...s.adoptedStyleSheets,t]}catch{}}let M=class extends D{constructor(){super(...arguments),this.stationId="",this.zone="",this.rows=null,this.next=null,this.timer=0}createRenderRoot(){return this}allowed(){return G()&&T("access.read")&&(T("access.events.read")||T("access.call"))}connectedCallback(){super.connectedCallback(),Fs(this.getRootNode()),this.style.display="contents",this.timer=window.setInterval(()=>{document.hidden||this.load(!1)},Rs)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("stationId")&&(this.rows=null,this.next=null,this.load(!1))}async load(e){if(!this.stationId||!this.allowed())return;const t=this.stationId;try{const s=await Qe(t,Ds,e?this.next:null);if(t!==this.stationId)return;this.rows=e?[...this.rows??[],...s.calls]:s.calls,this.next=s.next}catch{}}when(e){const t=new Date(e),s={day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:!1},a=document.documentElement.lang||"he";try{return new Intl.DateTimeFormat(a,this.zone?{...s,timeZone:this.zone}:s).format(t)}catch{return new Intl.DateTimeFormat(a,s).format(t)}}render(){if(!this.allowed()||!this.rows?.length)return r;const e=et(),t=e.log;return n`<section class="dsec" data-wk-dsec="calls" data-call-log="ready">
      <h4><sw-icon name="history" size=${14}></sw-icon>${t.title}</h4>
      <ul>
        ${this.rows.map(s=>{const a=tt(s,e),i=st(s);return n`<li data-call-row=${s.id} data-outcome=${s.outcome??s.state} data-tone=${a.tone}>
            <span class="cw" dir="ltr">${this.when(s.rang_at)}</span>
            <span class="cx"><span>${a.text}</span>${s.door_opened_at?n`<small data-call-row-door>${at(t.door,{name:s.door_opened_by_name||""})}</small>`:r}</span>
            <span class="cd" dir="ltr">${i!==null?it(i):""}</span>
          </li>`})}
      </ul>
      ${this.next?n`<button class="cm" data-call-log-more @click=${()=>void this.load(!0)}>${t.more}</button>`:r}
    </section>`}};K([u({attribute:"station-id"})],M.prototype,"stationId",2);K([u()],M.prototype,"zone",2);K([d()],M.prototype,"rows",2);K([d()],M.prototype,"next",2);M=K([R("wk-call-history")],M);function js(e,t){return n`<wk-call-history station-id=${e} zone=${t?.kind==="iana"?t.name:""}></wk-call-history>`}const Le=(e,t)=>t.zone??e.defaultZone,L=(e,t)=>Et(t.last_seen,e.now,Le(e,t),e.text),X=e=>t=>{t.stopPropagation(),e()};function re(e,t){return t.camera_entity?e.media?e.failed[t.id]===e.poster?"failed":"image":"none":t.has_camera?"none":"nocam"}const le=(e,t)=>Se(t.id,e.poster);function Ae(e,t,s){const a=e.text.still,i=s==="nocam"?a.none:s==="failed"?a.failed:a.offline;return n`<div class="none" role="status"><sw-icon name=${s==="nocam"?"camera":"offline"} size=${20}></sw-icon><span>${t.online||s==="nocam"?i:a.offline}</span></div>`}function qs(e,t){if(!Ie(t)&&!(t.online&&t.call_state==="ending"))return r;if(!P(e.policy,e.rights))return r;const s=t.call_state==="ringing";return n`<span class="callbadge ${t.call_state}" data-wk-call-badge=${t.call_state}>${s?n`<sw-icon name="bell" size=${14}></sw-icon>`:n`<span class="ic">${U("phone",14)}</span>`}${B(t.call_state,e.text)}</span>`}function Bs(e,t){const s=e.text,a=re(e,t),i=Q(t.id,e.places),o=t.online?`${s.still.tag} · ${Oe(e.poster)}`:L(e,t);return n`<div class="media ${t.online?"":"off"}" data-wk-still=${t.id} data-still-state=${a}>
    ${a==="image"?n`<img src=${le(e,t)} alt=${b(s.still.alt,{name:t.name})} decoding="async" @error=${()=>e.stillError(t.id,e.poster)} /><span class="stamp"><bdi>${o}</bdi></span>`:Ae(e,t,a)}
    ${qs(e,t)}
    <button type="button" class="open" data-wk-open=${t.id} aria-label=${t.name} @click=${()=>e.open(t.id)}></button>
    <div class="scrim"><span class="name">${t.name}</span>${i?n`<span class="place">${i}</span>`:r}</div>
  </div>`}function Hs(e,t){const s=re(e,t);return n`<span class="thumb ${t.online?"":"off"}" data-wk-thumb=${t.id}>${s==="image"?n`<img src=${le(e,t)} alt="" decoding="async" @error=${()=>e.stillError(t.id,e.poster)} />`:n`<sw-icon name="camera" size=${18}></sw-icon>`}</span>`}function q(e,t,s,a,i,o){const l=e.actions.armed,h=!!l&&l.id===t.id&&l.command===s&&l.callState===t.call_state;return n`<wk-action-button
    tone=${a}
    icon=${i}
    data-wk-call=${s}
    ?armed=${h}
    ?disabled=${!e.live||e.actions.callBusy.has(t.id)}
    label=${h?b(e.text.call.armedAria,{label:o}):o}
    @click=${c=>{c.stopPropagation(),e.call(t,s,c)}}
    >${h?e.text.call.armed:o}</wk-action-button
  >`}function Us(e,t=!1){const s=e.text.talk;return n`<wk-action-button tone="dashed" icon="window" href=${E()} data-wk-talk="classic" label=${s.hint} ?block=${t} size=${t?"lg":"md"} @click=${a=>a.stopPropagation()}
    >${t?s.classic:s.classicShort}</wk-action-button
  >`}function Ee(e,t,s){const a=e.talkControl?.(t,s);return a!==void 0?a:e.rights.talk?Us(e,s):r}function Me(e,t,s=!1){const a=e.text,i=t.online?t.call_state:"unavailable";if(i!=="ringing"&&i!=="in_call"&&i!=="ending")return r;if(!P(e.policy,e.rights))return r;const o=e.clock.seconds(t.id,e.now),l=i==="ringing"?n`<sw-icon name="bell" size=${15}></sw-icon>`:U("phone",15),h=e.rights.call&&i!=="ending";return n`<div class="callrow ${i} ${s?"big":""}" data-wk-call-row=${t.id} data-call=${i} role="group" aria-label=${a.call.group}>
    <span class="cs">${l}<span>${B(i,a)}</span>${o!==null?n`<span class="dur" data-wk-call-clock>${se(o)}</span>`:r}</span>
    ${h?n`<span class="ctl">${i==="ringing"?n`${q(e,t,"answer","ok","phone",a.call.answer)}${q(e,t,"reject","danger","close",a.call.reject)}`:n`${s?r:Ee(e,t,!1)}${q(e,t,"hangUp","danger","hangup",a.call.hangUp)}`}</span>`:r}
  </div>`}function ce(e,t){if(!e.rights.door)return r;const s=e.text.door;return n`${W(t).map(a=>{const i=`${t.id}/${a.physical_index}`,o=e.actions.isHeld(i),l=e.actions.releasing.has(i),h=o?"held":l?"sending":"idle",c=o?s.held:l?s.sending:t.locks.length>1?b(s.openNamed,{name:ne(a,e.text)}):s.open;return n`<wk-action-button
      class="grow"
      icon="unlock"
      data-wk-door=${i}
      data-state=${h}
      ?busy=${l}
      ?disabled=${!e.live||!t.online||l||o}
      @click=${X(()=>e.door(t,a.physical_index))}
      >${c}</wk-action-button
    >`})}`}function Ws(e,t){return!e.rights.announce||!t.online?r:n`<wk-action-button icon="volume" icon-only data-wk-announce-at=${t.id} label=${e.text.announce} ?disabled=${!e.live} @click=${X(()=>e.announce(t.id))}></wk-action-button>`}function De(e,t,s=!1){const a=e.actions.results[t.id];return a?n`<div class="result ${a.tone} ${s?"sticky":""}" role="status" data-wk-result=${t.id} data-tone=${a.tone}>${a.text}</div>`:r}function Ks(e,t,s){t.composedPath().some(i=>i instanceof HTMLElement&&i.matches("button, a, wk-action-button, select, input, textarea, summary"))||e.open(s)}function Ys(e,t){const s=t.technical;return s?n`<div class="tech" data-wk-tech-row>
    <sw-badge kind=${oe(t.sync_state)} label=${ee(t.sync_state,e.text)} data-wk-sync=${t.sync_state}></sw-badge>
    <span class="sp"></span>
    ${s.model?n`<code>${s.model}</code>`:r}
  </div>`:r}function Vs(e,t){const s=e.text,a=Ce(t),i=e.rights.door&&W(t).length>0||e.rights.announce&&t.online;return n`<sw-card flush interactive class="card ${a==="ringing"?"ringing":""}" data-wk-station=${t.id} data-status=${a} @click=${o=>Ks(e,o,t.id)}>
    ${Bs(e,t)}
    <div class="cb">
      <div class="hd">
        <sw-badge kind=${t.online?"live":"offline"} label=${t.online?s.status.online:s.status.offline}></sw-badge>
        <span>${s.seen.prefix} <b><bdi>${L(e,t)}</bdi></b></span>
      </div>
      ${Me(e,t)}
      ${i?n`<div class="acts">${ce(e,t)}${Ws(e,t)}</div>`:r}
      ${De(e,t)} ${Ys(e,t)}
    </div>
  </sw-card>`}function ae(e,t,s=!1){const a=t.online?t.call_state:"";if(a!=="ringing"&&a!=="in_call"&&a!=="ending")return r;if(!P(e.policy,e.rights))return r;const i=e.clock.seconds(t.id,e.now),o=`${B(a,e.text)}${i!==null?` · ${se(i)}`:""}`;return s?n`<sw-badge kind=${a==="ringing"?"stale":"recorded"} label=${o} data-wk-call-pill=${a}></sw-badge>`:n`<span class="pillcall ${a}" data-wk-call-pill=${a}>${B(a,e.text)}${i!==null?n` · <span class="dur">${se(i)}</span>`:r}</span>`}function Gs(e,t){const s=e.text,i=[Q(t.id,e.places),t.technical?ee(t.sync_state,s):""].filter(Boolean).join(" · "),o=e.rights.call&&t.online&&t.call_state==="ringing"&&P(e.policy,e.rights);return n`<div class="row" data-wk-station=${t.id} data-status=${Ce(t)}>
    <button type="button" class="rowmain" data-wk-open=${t.id} @click=${()=>e.open(t.id)}>
      ${Hs(e,t)}
      <span class="rowtext"><span class="t"><span class="sdot ${t.online?"":"off"}" aria-hidden="true"></span><b>${t.name}</b></span>${i?n`<span class="s">${i}</span>`:r}</span>
    </button>
    <div class="rowside">
      ${ae(e,t)}
      <span class="seen">${s.seen.prefix} <bdi>${L(e,t)}</bdi></span>
      <div class="rowacts">
        ${o?q(e,t,"answer","ok","phone",s.call.answer):r}${ce(e,t)}
      </div>
      <sw-icon name="chevron" size=${16} aria-hidden="true"></sw-icon>
    </div>
  </div>`}function Js(e,t){return n`<sw-card flush class="rows-card"><div class="rows" data-wk-rows>${ze(t,s=>s.id,s=>Gs(e,s))}</div></sw-card>`}function Xs(e,t){return n`<div class="grid" data-wk-grid>${ze(t,s=>s.id,s=>Vs(e,s))}</div>`}function Zs(e,t){const s=e.text,a=c=>c,i=t.some(c=>c.technical),o=n`<span style="color:var(--sw-text-3)">—</span>`,l=e.table==="compact"||e.table==="none",h=[{key:"name",label:s.table.station,render:c=>n`<wk-action-button tone="quiet" data-wk-open=${a(c).id} @click=${()=>e.open(a(c).id)}>${a(c).name}</wk-action-button>`},{key:"status",label:s.table.status,render:c=>{const p=a(c),x=n`<sw-badge kind=${p.online?"live":"offline"} label=${p.online?s.status.online:s.status.offline}></sw-badge>`;if(!l)return x;const S=ae(e,p,!0),k=p.online?r:n`<small style="color:var(--sw-text-3);font-size:var(--sw-fs-xs)"><bdi>${L(e,p)}</bdi></small>`;return S===r&&k===r?x:n`<span style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:var(--sw-s-1)">${x}${S}${k}</span>`}}];return l||h.push({key:"call",label:s.table.call,render:c=>ae(e,a(c),!0)}),h.push({key:"actions",label:s.table.actions,render:c=>{const p=a(c),x=e.rights.call&&p.online&&p.call_state==="ringing"&&P(e.policy,e.rights);return n`<span style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:var(--sw-s-2);max-inline-size:190px">${x?q(e,p,"answer","ok","phone",s.call.answer):r}${ce(e,p)}</span>`}}),l||h.push({key:"place",label:s.table.place,render:c=>n`<span style="display:inline-block;white-space:normal;max-inline-size:130px;vertical-align:middle">${Q(a(c).id,e.places)||"—"}</span>`},{key:"seen",label:s.table.seen,render:c=>n`<bdi>${L(e,a(c))}</bdi>`}),e.table==="full"&&h.push({key:"doors",label:s.table.doors,render:c=>n`<span style="display:inline-block;white-space:normal;max-inline-size:120px;vertical-align:middle">${W(a(c)).map(p=>ne(p,s)).join(", ")||"—"}</span>`}),i&&(h.push({key:"sync",label:s.table.sync,render:c=>a(c).technical?n`<sw-badge kind=${oe(a(c).sync_state)} label=${ee(a(c).sync_state,s)}></sw-badge>`:o}),e.table==="full"&&h.push({key:"model",label:s.table.model,ltr:!0,render:c=>{const p=a(c).technical;return p?.model||p?.firmware?n`<span style="display:inline-block;vertical-align:middle">${p.model?n`<span style="display:block">${p.model}</span>`:r}${p.firmware?n`<span style="display:block;color:var(--sw-text-3)">${p.firmware}</span>`:r}</span>`:o}})),h}function Qs(e,t){const s=t.technical;if(!s)return r;const a=e.text,i=s.reconciled_at&&/(Z|[+-]\d\d:\d\d)$/.test(s.reconciled_at)?Pt(Date.parse(s.reconciled_at),e.now,Le(e,t)??void 0,a):"",o=s.clock?.skew_seconds,l=o==null?"":Math.abs(o)<=2?a.tech.clockOk:b(a.tech.clockDrift,{n:Math.round(o)}),h=s.event_status?.stream,c=h?h==="connected"?a.tech.streamOk:["disconnected","unavailable","stopped","authentication_failed"].includes(h)?a.tech.streamDown:a.tech.streamUnknown:"";return n`<section class="dsec" data-wk-dsec="technical">
    <h4><sw-icon name="cpu" size=${14}></sw-icon>${a.drawer.technical}</h4>
    <dl class="kv">
      <dt>${a.tech.sync}</dt>
      <dd><sw-badge kind=${oe(t.sync_state)} label=${ee(t.sync_state,a)}></sw-badge>${i?n` · <bdi>${i}</bdi>`:r}</dd>
      ${s.model?n`<dt>${a.tech.model}</dt><dd><code>${s.model}</code></dd>`:r}
      ${s.firmware?n`<dt>${a.tech.firmware}</dt><dd><code>${s.firmware}</code></dd>`:r}
      <dt>${a.tech.relays}</dt>
      <dd>${b(a.tech.relaysValue,{n:t.locks.length,mode:t.lock_enabled?a.tech.relayOn:a.tech.relayOff})}</dd>
      ${l?n`<dt>${a.tech.clock}</dt><dd>${l}</dd>`:r} ${c?n`<dt>${a.tech.stream}</dt><dd>${c}</dd>`:r}
      ${t.errors?n`<dt>${a.tech.lastError}</dt><dd>${t.errors.last_error?n`<code data-wk-last-error>${t.errors.last_error}</code>`:n`<span class="muted">${a.tech.none}</span>`}</dd>`:r}
      ${t.errors?.scan_error?n`<dt>${a.tech.scanError}</dt><dd><code>${t.errors.scan_error}</code></dd>`:r}
    </dl>
    <wk-deep-links place="station"></wk-deep-links>
  </section>`}function Re(e,t){const s=e.text.prog;if(t.state==="ready")return r;const a=t.state==="unsupported"?s.unsupported:t.state==="busy"?s.busy:t.state==="error"?s.unavailable:s.loading;return n`<div class="muted" role="status" data-wk-fetch=${t.state}>${a}${t.state==="error"||t.state==="busy"?n` · <wk-action-button tone="quiet" @click=${()=>e.retryDetail()}>${e.text.retry}</wk-action-button>`:r}</div>`}function ea(e,t,s){const a=e.text;if(!s||s.programs.state!=="ready")return s?Re(e,s.programs):n`<div class="muted" role="status" data-wk-fetch="loading">${a.prog.loading}</div>`;const i=Nt(s.programs.data,t,a);return i.length?n`${i.map(o=>n`<div class="prog" data-wk-program=${o.door}>
      <div class="ph">
        <span>${o.name}</span>
        ${o.none?n`<sw-badge kind="neutral" label=${a.prog.none}></sw-badge>`:n`<sw-badge kind=${o.removing?"stale":o.enabled?"live":"offline"} label=${o.removing?a.prog.removing:o.enabled?a.prog.on:a.prog.off}></sw-badge>${o.status&&o.enabled&&!o.removing?n`<sw-badge kind="recorded" label=${o.status}></sw-badge>`:r}`}
      </div>
      ${o.hours.map(l=>n`<div class="line">${a.prog.hours}: <bdi>${l}</bdi></div>`)}
      ${o.holidays?n`<div class="line muted">${b(a.prog.holidays,{n:o.holidays})}</div>`:r}
      ${o.error?n`<div class="line"><sw-badge kind="error" label=${a.prog.error}></sw-badge></div>`:r}
      ${!o.none&&o.unreadable?n`<div class="line muted">${a.prog.unknownShape}</div>`:r}
    </div>`)}`:r}function ta(e,t){const s=e.text;if(!t)return r;if(t.codes.state!=="ready")return n`<div class="prog">${Re(e,t.codes)}</div>`;const a=Ft(t.codes.data,s);return n`<div class="prog" data-wk-codes=${a.state}>
    <div class="ph"><span>${s.prog.codes}</span><sw-badge kind=${a.state==="set"?"live":a.state==="unset"?"offline":"unknown"} label=${a.label}></sw-badge></div>
    ${a.slots.length>1?a.slots.map(i=>n`<div class="line">${i.label}: ${i.state==="set"?s.prog.codeConfigured:i.state==="unset"?s.prog.codeNotConfigured:s.prog.codeUnknown}</div>`):r}
  </div>`}function sa(e,t){if(!t.technical)return r;const s=e.features.door_programs!==!1,a=e.features.public_codes!==!1;if(!s&&!a)return r;const i=e.text,o=e.detail[t.id];return n`<section class="dsec" data-wk-dsec="settings">
    <button type="button" class="toggle" aria-expanded=${String(e.detailOpen)} data-wk-settings-toggle @click=${()=>e.toggleDetail()}>
      <sw-icon name="chevronDown" size=${14}></sw-icon><span>${i.drawer.doorSettings}</span>
    </button>
    ${e.detailOpen?n`${s&&W(t).length?ea(e,t,o):r}${a?ta(e,o):r}`:r}
  </section>`}function aa(e,t){const s=Mt(t.id,de.events==="smplwise",T("access.events.read")),a=Dt(t,de.schedules==="smplwise",T("access.stations.read"));return!s&&!a?r:n`<div class="evlink">
    ${s?n`<wk-action-button tone="quiet" icon="history" href=${s} data-wk-station-events=${t.id}>${Rt("stationEvents")}</wk-action-button>`:r}
    ${a?n`<wk-action-button tone="quiet" icon="calendar" href=${a} data-wk-station-schedules=${t.id}>${e.text.drawer.schedules}</wk-action-button>`:r}
  </div>`}function ia(e,t){const s=e.text,a=re(e,t),i=Q(t.id,e.places),o=W(t),l=e.rights.call||P(e.policy,e.rights)&&(t.online?["ringing","in_call","ending"].includes(t.call_state):!1),h=t.online&&["ringing","in_call","ending"].includes(t.call_state),c=e.actions.tts[t.id],p=c?Te(c,s):"",x=e.liveArea?.(t)??null,S=e.rights.call&&t.online?e.dialControl?.(t,h):void 0;return n`
    ${x??n`<div class="live ${t.online?"":"off"}" data-wk-live data-still-state=${a}>
      ${a==="image"?n`<img src=${le(e,t)} alt=${b(s.still.alt,{name:t.name})} decoding="async" @error=${()=>e.stillError(t.id,e.poster)} />`:Ae(e,t,a)}
      ${a==="image"?n`<span class="stamp"><bdi>${s.drawer.lastStill} · ${t.online?Oe(e.poster):L(e,t)}</bdi></span>`:r}
      <div class="ov"><span class="t"><sw-icon name="play" size=${16}></sw-icon>${s.drawer.liveClassic}</span><wk-action-button icon="window" href=${E()} data-wk-classic-link>${s.drawer.openClassic}</wk-action-button></div>
    </div>`}
    <div class="meta">${i?n`<span>${i}</span>`:r}<span>${s.seen.prefix} <bdi>${L(e,t)}</bdi></span></div>
    ${aa(e,t)}
    ${De(e,t,!0)}
    ${l?n`<section class="dsec" data-wk-dsec="call">
          <h4>${U("phone",14)}${s.drawer.call}</h4>
          ${h?n`${Me(e,t,!0)}${t.call_state==="in_call"?Ee(e,t,!0):r}`:n`<div class="callrow"><span class="cs muted">${s.call.none}</span>${e.rights.call&&t.online&&S===void 0?n`<wk-action-button tone="dashed" icon="phone" href=${E()} data-wk-dial>${s.call.dial}</wk-action-button>`:r}</div>`}
          ${S??r}
        </section>`:r}
    ${o.length||e.rights.door?n`<section class="dsec" data-wk-dsec="doors">
          <h4><sw-icon name="door" size=${14}></sw-icon>${s.drawer.doors}</h4>
          ${o.length?o.map(k=>{const I=e.detail[t.id]?.programs.data?.programs.find(A=>A.door===k.physical_index)?.execution?.status==="held_acknowledged";return n`<div class="doorrow" data-wk-doorrow=${k.physical_index}>
                  <span class="dn">${ne(k,s)}</span>
                  <span class="ds">${I?n`<sw-icon name="clock" size=${12}></sw-icon>${s.prog.state.held_acknowledged}`:r}</span>
                  ${e.rights.door?n`<wk-action-button
                        icon="unlock"
                        data-wk-door=${`${t.id}/${k.physical_index}`}
                        data-state=${e.actions.isHeld(`${t.id}/${k.physical_index}`)?"held":e.actions.releasing.has(`${t.id}/${k.physical_index}`)?"sending":"idle"}
                        ?busy=${e.actions.releasing.has(`${t.id}/${k.physical_index}`)}
                        ?disabled=${!e.live||!t.online||e.actions.releasing.has(`${t.id}/${k.physical_index}`)||e.actions.isHeld(`${t.id}/${k.physical_index}`)}
                        @click=${X(()=>e.door(t,k.physical_index))}
                        >${e.actions.isHeld(`${t.id}/${k.physical_index}`)?s.door.held:e.actions.releasing.has(`${t.id}/${k.physical_index}`)?s.door.sending:s.door.open}</wk-action-button
                      >`:r}
                </div>`}):n`<span class="muted">${s.door.none}</span>`}
        </section>`:r}
    ${e.rights.announce?n`<section class="dsec" data-wk-dsec="announce">
          <h4><sw-icon name="volume" size=${14}></sw-icon>${s.drawer.announce}</h4>
          <div class="callrow"><span class="cs muted" data-wk-announce-state>${p||s.drawer.announceHint}</span><wk-action-button icon="volume" data-wk-announce-at=${t.id} ?disabled=${!e.live||!t.online} @click=${X(()=>e.announce(t.id))}>${s.announce}</wk-action-button></div>
        </section>`:r}
    ${js(t.id,t.zone)}
    ${Qs(e,t)} ${sa(e,t)}
  `}var na=Object.defineProperty,oa=Object.getOwnPropertyDescriptor,g=(e,t,s,a)=>{for(var i=a>1?void 0:a?oa(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&na(t,s,i),i};const Pe="sw.wiskey.stations.view",Ne="sw.wiskey.stations.treeCollapsed",$e=3e4;function Fe(e){try{return localStorage.getItem(e)}catch{return null}}function ye(e,t){try{localStorage.setItem(e,t)}catch{}}const ra=()=>{const e=Fe(Pe);return e==="list"||e==="table"?e:"cards"},la=()=>{try{const e=JSON.parse(Fe(Ne)??"[]");return new Set(Array.isArray(e)?e.filter(t=>typeof t=="string"):[])}catch{return new Set}},V={kind:"iana",name:"Asia/Jerusalem"},xe=[{id:"d1",name:"שער ראשי",online:!0,call_state:"ringing",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:V,technical:null,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:V,technical:null,errors:null},{id:"d3",name:"חניון",online:!0,call_state:"idle",sync_state:"pending",lock_enabled:!1,locks:[],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:V,technical:null,errors:null},{id:"d4",name:"מחסן",online:!1,call_state:"unavailable",sync_state:"offline",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!1,camera_entity:null,last_seen:"2026-09-26T19:02:00+03:00",zone:V,technical:null,errors:null}];let w=class extends D{constructor(){super(...arguments),this.feed=null,this.error="",this.forbidden=!1,this.filter="all",this.query="",this.view=ra(),this.place="all",this.places=null,this.collapsed=la(),this.selected=null,this.sheet=!1,this.announceOpen=!1,this.announceFor="",this.policy=jt,this.features={},this.detail={},this.detailOpen=!1,this.now=Date.now(),this.poster=Date.now(),this.failed={},this.table=ge(typeof window>"u"?1440:window.innerWidth),this.mediaMode="off",this.media={},this.mediaAt={},this.clock=new qt,this.actions=new J({release:(e,t)=>rt(e,t),signal:(e,t)=>ot(e,t),station:e=>this.list().find(t=>t.id===e),live:()=>this.isLive(),now:()=>Date.now(),tick:()=>performance.now(),after:(e,t)=>window.setTimeout(e,t),cancel:e=>window.clearTimeout(e),changed:()=>this.requestUpdate(),refetch:()=>void this.load(),stamp:()=>nt(new Date)}),this.stop=null,this.stopRoute=null,this.poll=0,this.tickTimer=0,this.posterTimer=0,this.loading=!1,this.loadAgain=!1,this.placesKey="",this.detailAt={},this.mqc=typeof matchMedia=="function"?matchMedia(`(max-width: ${Bt}px)`):null,this.mqm=typeof matchMedia=="function"?matchMedia(`(max-width: ${Ht}px)`):null,this.mqn=typeof matchMedia=="function"?matchMedia(`(max-width: ${Ut-1}px)`):null,this.onMedia=()=>{this.table=ge(window.innerWidth)}}connectedCallback(){if(super.connectedCallback(),this.mqc?.addEventListener("change",this.onMedia),this.mqm?.addEventListener("change",this.onMedia),this.mqn?.addEventListener("change",this.onMedia),this.stopRoute=lt(e=>this.onRoute(e)),!!G()){if(!T("access.read")){this.forbidden=!0;return}this.load(),this.readFeatures(),this.posterTimer=window.setInterval(()=>{document.hidden||(this.poster=Date.now())},Wt),this.stop=ct(e=>{e.type==="intercom_tts"?this.actions.noteTts(e.status):e.type!=="heartbeat"&&this.load()},e=>{this.setPolling(!e),e&&this.load()}),this.schedule()}}disconnectedCallback(){super.disconnectedCallback(),this.mqc?.removeEventListener("change",this.onMedia),this.mqm?.removeEventListener("change",this.onMedia),this.mqn?.removeEventListener("change",this.onMedia),this.stop?.(),this.stop=null,this.stopRoute?.(),this.stopRoute=null,this.setPolling(!1),window.clearInterval(this.posterTimer),window.clearTimeout(this.tickTimer),this.actions.dispose()}updated(e){(e.has("selected")||e.has("detailOpen"))&&this.maybeLoadDetail(),(e.has("selected")||e.has("mediaMode"))&&this.maybeLoadMedia()}setPolling(e){window.clearInterval(this.poll),this.poll=e?window.setInterval(()=>void this.load(),Kt):0}schedule(){window.clearTimeout(this.tickTimer),this.tickTimer=window.setTimeout(()=>{this.now=Date.now(),this.clock.observe(this.list(),this.now),this.actions.prune(),this.schedule()},this.clock.active?1e3:2e4)}onRoute(e){if(e.mode!=="wiskey")return;const t=e.params.get("station");t&&t!==this.selected?(this.selected=t,this.detailOpen=!1):!t&&this.selected&&(this.selected=null,this.detailOpen=!1)}demo(){return!G()}list(){return this.demo()?xe:this.feed?.stations??[]}isLive(){return!this.demo()&&this.feed?.state==="ready"&&this.feed.fresh!==!1}rights(){return this.demo()?Yt:Vt(he,this.policy,T)}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{const e=await bt();this.feed=e,this.error="",this.forbidden=!1,this.afterLoad(e)}catch(e){e instanceof Z&&e.status===403?this.forbidden=!0:this.error=ie(e)}}while(this.loadAgain)}finally{this.loading=!1}}afterLoad(e){this.now=Date.now(),this.clock.observe(e.stations??[],this.now),this.actions.dropStaleArm(),this.readPolicy(),this.ensurePlaces(e.stations??[]),this.maybeLoadMedia(),this.schedule()}async readPolicy(){try{const e=await dt();this.policy=Gt(e),this.mediaMode=ht(e)}catch{}}async readFeatures(){try{const e=await vt();this.features=Object.fromEntries(Object.entries(e.features??{}).map(([t,s])=>[t,s.available]))}catch{}}async ensurePlaces(e){const t=e.filter(a=>a.camera_entity),s=t.map(a=>`${a.id}:${a.camera_entity}`).sort().join("|");if(s!==this.placesKey){if(this.placesKey=s,!t.length||!T("devices.read")){this.places=null;return}try{const[a,i]=await Promise.all([pt(),ut(t.map(o=>o.camera_entity))]);if(s!==this.placesKey)return;this.places=Jt(e,a,i.entities)}catch{this.places=null}}}maybeLoadDetail(){const e=this.selected;if(!e||!this.detailOpen||this.demo()||!this.list().find(a=>a.id===e)?.technical)return;const s=this.detailAt[e]??0;this.detail[e]&&Date.now()-s<$e||this.loadDetail(e)}async loadDetail(e){this.detailAt={...this.detailAt,[e]:Date.now()};const t={state:"loading",data:null};this.detail={...this.detail,[e]:{programs:t,codes:t}};const s=i=>this.detail={...this.detail,[e]:{...this.detail[e],...i}},a=(i,o)=>i.state==="ready"&&o?{state:"ready",data:o}:i.state==="unsupported"?{state:"unsupported",data:null}:i.last_error==="busy"||i.last_error==="rate_limited"||i.last_error==="timeout"?{state:"busy",data:null}:{state:"error",data:null};if(this.features.door_programs!==!1)try{const i=await kt(e);s({programs:a(i,i.programs)})}catch{s({programs:{state:"error",data:null}})}else s({programs:{state:"unsupported",data:null}});if(this.features.public_codes!==!1)try{const i=await $t(e);s({codes:a(i,i.codes)})}catch{s({codes:{state:"error",data:null}})}else s({codes:{state:"unsupported",data:null}})}maybeLoadMedia(){const e=this.selected;!e||this.mediaMode==="off"||this.demo()||this.media[e]!==void 0&&Date.now()-(this.mediaAt[e]??0)<$e||(this.mediaAt={...this.mediaAt,[e]:Date.now()},wt(e).then(t=>this.media={...this.media,[e]:t}).catch(()=>this.media={...this.media,[e]:null}))}posterOf(e){return!e.camera_entity||this.demo()||!pe("go2rtc")||this.failed[e.id]===this.poster?"":Se(e.id,this.poster)}liveArea(e,t){if(this.mediaMode==="off")return null;const s=this.media[e.id];if(!s||s.state!=="ready")return null;const a=!!s.video?.allowed&&Object.keys(s.video.paths).length>0;if(!a&&!s.talk?.available)return null;const i=!t.rights.call,o=i&&t.rights.talk&&!s.talk?.available;return n`<wk-station-live
      data-wk-live-native
      .stationId=${e.id}
      .stationName=${e.name}
      .media=${a?s:{...s,video:null}}
      .poster=${this.posterOf(e)}
      .live=${t.live&&e.online}
      .talkHere=${i}
      .classicHref=${o?E():""}
      .classicLabel=${t.text.talk.classic}
    ></wk-station-live>`}dialControl(e,t,s){const a=ue(this.mediaMode,this.media[e.id]);if(a.kind==="legacy")return;const i=j().dial;return a.kind==="native"?n`<div class="dialnative">
        <wk-talk-button
          dial
          data-wk-dial="native"
          .stationId=${e.id}
          .talk=${this.media[e.id]?.talk??null}
          .live=${s.live&&e.online}
          .idleLabel=${t?i.talk:i.dial}
        ></wk-talk-button>
        <wk-action-button tone="quiet" icon="window" href=${E()} data-wk-dial-classic="secondary">${i.classic}</wk-action-button>
      </div>`:n`<div class="callrow" data-wk-dial="reason" data-reason=${a.reason}>
      <span class="cs muted dialwhy" data-wk-dial-reason role="status">${i.reasons[a.reason]}</span>
      <wk-action-button tone="dashed" icon="window" href=${E()} data-wk-dial-classic>${i.classic}</wk-action-button>
    </div>`}talkControl(e,t,s){if(this.mediaMode==="video_talk")return t?ue(this.mediaMode,this.media[e.id]).kind!=="legacy"&&s.rights.call?r:this.liveArea(e,s)?r:void 0:!T("access.call")||!e.online?void 0:n`<wk-action-button icon="mic" data-wk-talk="drawer" label=${j().talk.openDrawer} @click=${a=>{a.stopPropagation(),this.open(e.id)}}>${j().talk.openDrawer}</wk-action-button>`}open(e){this.selected!==e&&(this.selected=e,this.detailOpen=!1,this.syncRoute(e))}closeDrawer(){this.selected=null,this.detailOpen=!1,this.syncRoute(null)}syncRoute(e){const t=ft();if(t.mode!=="wiskey")return;const s=new URLSearchParams(t.params);e?s.set("station",e):s.delete("station"),gt(t.path,s)}setView(e){this.view=e,ye(Pe,e)}toggleFloor(e){const t=new Set(this.collapsed);t.has(e)?t.delete(e):t.add(e),this.collapsed=t,ye(Ne,JSON.stringify([...t]))}pickPlace(e){this.place=e,this.sheet=!1}ctx(){const e=this.features,t={text:$(),now:this.now,defaultZone:this.feed?.default_zone??null,live:this.isLive(),rights:this.rights(),policy:this.policy,places:this.places,actions:this.actions,clock:this.clock,table:this.table,media:this.demo()?!1:pe("go2rtc"),poster:this.poster,failed:this.failed,selected:this.selected,detail:this.detail,detailOpen:this.detailOpen,features:e,open:s=>this.open(s),door:(s,a)=>void this.actions.askRelease(s.id,a),call:(s,a,i)=>this.actions.tapCall(s.id,a,i.detail),announce:s=>{this.announceFor=s,this.announceOpen=!0},stillError:(s,a)=>this.failed={...this.failed,[s]:a},toggleDetail:()=>this.detailOpen=!this.detailOpen,retryDetail:()=>{this.selected&&this.loadDetail(this.selected)}};return this.mediaMode!=="off"&&(t.liveArea=s=>this.liveArea(s,t),t.talkControl=(s,a)=>this.talkControl(s,a,t),t.dialControl=(s,a)=>this.dialControl(s,a,t)),t}render(){const e=$();if(this.forbidden&&G())return n`<sw-page heading=${e.title}><div data-wk-stations data-wk-state="forbidden"><sw-state-panel state="forbidden" heading=${e.states.forbidden} data-wk-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return n`<sw-page heading=${e.title}><div data-wk-stations data-wk-state=${this.error?"error":"loading"}>${this.error?n`<sw-state-panel state="error" heading=${e.states.error} hint=${this.error} actionLabel=${e.retry} data-wk-panel="error" @action=${()=>void this.load()}></sw-state-panel>`:n`<sw-state-panel state="loading" heading=${e.states.loading} data-wk-panel="loading"></sw-state-panel>`}</div></sw-page>`;const t=this.demo()?xe:this.feed.stations;if(t===null){const s=this.feed.state==="ready"?"error":this.feed.state,a=Xt(s,e);return n`<sw-page heading=${e.title}>
        ${this.renderFeedBadge()}
        <div data-wk-stations data-wk-state=${`feed:${this.feed.state}`}>
          <sw-state-panel icon="door" state=${a.panel} heading=${a.heading} actionLabel=${a.settings&&he("system.configure")?e.states.toSettings:""} data-wk-panel=${`feed:${this.feed.state}`} @action=${()=>window.location.hash="#/system/diagnostics?tab=access-control"}></sw-state-panel>
        </div>
      </sw-page>`}return this.renderReady(t)}renderFeedBadge(){const e=$();if(this.demo())return n`<sw-badge slot="actions" kind="neutral" label=${e.demo} data-wk-feed="demo"></sw-badge>`;const t=this.feed;if(!t)return r;const s=t.state==="ready"&&t.fresh!==!1,a=s?"live":t.state==="connecting"?"unknown":t.state==="forbidden"?"forbidden":t.state==="error"?"error":t.stations?"stale":"offline",i=s?e.feed.live:t.state==="connecting"?e.feed.connecting:t.stations&&t.fetched_at?b(e.feed.stale,{ago:Zt(t.fetched_at,this.now,e)||"…"}):e.feed.off;return n`<sw-badge slot="actions" kind=${a} label=${i} data-wk-feed=${s?"live":t.state}></sw-badge>`}effectiveView(){return this.table==="none"&&this.view==="table"?"list":this.view}renderReady(e){const t=$(),s=this.ctx(),a=Qt(e,this.places,this.collapsed,t),i=a.length>0,o=i&&a.some(f=>f.id===this.place)?this.place:"all",l=es(e,this.filter,this.query,o,this.places),h=ts(e),c=this.effectiveView(),p=e.filter(Ie).length,x=e.some(f=>f.online),S=e.length?"ready":"empty",k=a.find(f=>f.id===o)?.name??t.places.all;return n`<sw-page wide heading=${t.title} subheading=${ss(h,t)}>
      ${this.renderFeedBadge()}<wk-deep-links slot="actions" place="stations" mode="menu"></wk-deep-links>
      <div data-wk-stations data-wk-state=${S} data-view=${c} data-live=${String(s.live)}>
        ${e.length?n`<div class="toolbar">
              <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wk-search aria-label=${t.searchLabel} placeholder=${t.searchLabel} .value=${this.query} @input=${f=>this.query=f.target.value} /></label>
              ${s.rights.announce&&x?n`<wk-action-button icon="volume" data-wk-announce ?disabled=${!s.live} label=${t.announce} @click=${()=>s.announce("")}><span class="lbl">${t.announce}</span></wk-action-button>`:r}
              <sw-view-switch data-wk-views label=${t.views.label} .value=${c} .options=${[{id:"cards",label:t.views.cards,icon:"grid"},{id:"list",label:t.views.list,icon:"list"},...this.table==="none"?[]:[{id:"table",label:t.views.table,icon:"table"}]]} @change=${f=>this.setView(f.detail)}></sw-view-switch>
            </div>`:r}
        <div class="layout ${i?"":"no-tree"}">
          ${i?n`<aside class="treecol"><sw-card flush><sw-place-tree data-wk-tree .rows=${a} .selected=${o} heading=${t.places.title} foldLabel=${t.places.fold} unfoldLabel=${t.places.unfold} @place-select=${f=>this.pickPlace(f.detail)} @place-toggle=${f=>this.toggleFloor(f.detail)}></sw-place-tree></sw-card></aside>`:r}
          <section class="main">
            ${e.length?n`<div class="chips" role="group" aria-label=${t.filters.label}>
                  ${i?n`<button type="button" class="chip places" data-wk-places-chip @click=${()=>this.sheet=!0}><sw-icon name="pin" size=${14}></sw-icon>${t.places.chip}: ${k}<sw-icon name="chevronDown" size=${12}></sw-icon></button>`:r}
                  ${as.map(f=>n`<button type="button" class="chip" data-wk-filter=${f} aria-pressed=${String(this.filter===f)} @click=${()=>this.filter=f}>
                      ${f==="in_call"?U("phone",14):r}${f==="all"?t.filters.all:f==="online"?t.filters.online:f==="attention"?t.filters.attention:t.filters.inCall}
                    </button>`)}
                </div>`:r}
            ${p&&c==="cards"&&s.rights.call?n`<div class="strip" role="status" data-wk-strip>
                  <span class="dot" aria-hidden="true"></span><span>${p===1?t.strip.one:b(t.strip.many,{n:p})}</span><span class="sp"></span>
                  <wk-action-button tone="quiet" icon="list" data-wk-strip-list @click=${()=>this.setView("list")}>${t.strip.toList}</wk-action-button>
                </div>`:r}
            ${this.renderContent(s,e,l,c)}
          </section>
        </div>
      </div>
      ${this.renderSheet(a,o)} ${this.renderDrawer(s,e)} ${this.selected?r:this.renderDialogs(s,e)}
    </sw-page>`}renderContent(e,t,s,a){const i=e.text;return t.length?s.length?a==="table"?n`<sw-table class="tbl" dense data-wk-table .columns=${Zs(e,t)} .rows=${s} .selected=${this.selected} @row-select=${o=>this.open(o.detail.id)}></sw-table>`:a==="list"?Js(e,s):Xs(e,s):n`<sw-state-panel icon="door" compact state="empty" heading=${i.states.emptyFilter} data-wk-panel="empty-filter"></sw-state-panel>`:n`<sw-state-panel icon="door" state="empty" heading=${i.states.empty} data-wk-panel="empty"></sw-state-panel>`}renderSheet(e,t){const s=$();return e.length?n`<sw-drawer modal ?open=${this.sheet} heading=${s.places.sheet} data-wk-places-sheet @close=${a=>a.target===a.currentTarget&&(this.sheet=!1)}>
      <sw-place-tree .rows=${e} .selected=${t} heading=${s.places.title} foldLabel=${s.places.fold} unfoldLabel=${s.places.unfold} @place-select=${a=>this.pickPlace(a.detail)} @place-toggle=${a=>this.toggleFloor(a.detail)}></sw-place-tree>
    </sw-drawer>`:r}renderDrawer(e,t){const s=e.text,a=this.selected,i=a?t.find(l=>l.id===a):void 0,o=i?i.online?"live":"offline":"neutral";return n`<sw-drawer modal ?open=${!!a} heading=${i?.name??s.drawer.notFound} data-wk-drawer data-wk-drawer-station=${a??""} @close=${l=>l.target===l.currentTarget&&this.closeDrawer()}>
      ${a&&i?n`<sw-badge slot="action" kind=${o} label=${i.online?s.status.online:s.status.offline}></sw-badge>`:r}
      ${a?i?ia(e,i):n`<sw-state-panel compact state="forbidden" heading=${s.drawer.notFoundHint} data-wk-panel="scoped"></sw-state-panel>`:r}
      ${a?this.renderDialogs(e,t):r}
    </sw-drawer>`}renderDialogs(e,t){return n`${this.renderConfirm(e,t)}
    <wk-announce-dialog
      ?open=${this.announceOpen}
      .stations=${t}
      .places=${this.places}
      .scope=${this.policy.announceScope}
      .phrases=${is(this.policy,e.text)}
      .preselect=${this.announceFor}
      .tts=${this.actions.tts}
      @tts-status=${s=>this.actions.noteTts(s.detail)}
      @close=${s=>{s.target===s.currentTarget&&(this.announceOpen=!1)}}
    ></wk-announce-dialog>`}renderConfirm(e,t){const s=this.actions.confirm;if(!s)return r;const a=t.find(p=>p.id===s.stationId);if(!a)return r;const i=e.text,o=a.locks.find(p=>p.physical_index===s.lock)?.name?.trim(),l=ns(a.name),h=o?b(i.door.confirmNamed,{door:o,inPlace:l}):b(i.door.confirmPlain,{inPlace:l}),c=this.actions.releasing.has(`${a.id}/${s.lock}`);return n`<sw-dialog open ?locked=${c} heading=${i.door.confirmTitle} data-wk-release-dialog @close=${p=>p.target===p.currentTarget&&this.actions.cancelRelease()}>
      <p class="sentence" data-wk-release-sentence>${h}</p>
      <div slot="footer">
        <wk-action-button data-wk-release-cancel ?disabled=${c} @click=${()=>this.actions.cancelRelease()}>${i.door.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon="unlock" data-wk-release-confirm ?busy=${c} ?disabled=${c||!e.live} @click=${()=>void this.actions.confirmRelease()}>${c?i.door.sending:i.door.send}</wk-action-button>
      </div>
    </sw-dialog>`}};w.styles=As;g([d()],w.prototype,"feed",2);g([d()],w.prototype,"error",2);g([d()],w.prototype,"forbidden",2);g([d()],w.prototype,"filter",2);g([d()],w.prototype,"query",2);g([d()],w.prototype,"view",2);g([d()],w.prototype,"place",2);g([d()],w.prototype,"places",2);g([d()],w.prototype,"collapsed",2);g([d()],w.prototype,"selected",2);g([d()],w.prototype,"sheet",2);g([d()],w.prototype,"announceOpen",2);g([d()],w.prototype,"announceFor",2);g([d()],w.prototype,"policy",2);g([d()],w.prototype,"features",2);g([d()],w.prototype,"detail",2);g([d()],w.prototype,"detailOpen",2);g([d()],w.prototype,"now",2);g([d()],w.prototype,"poster",2);g([d()],w.prototype,"failed",2);g([d()],w.prototype,"table",2);g([d()],w.prototype,"mediaMode",2);g([d()],w.prototype,"media",2);w=g([R("wiskey-stations")],w);export{w as WiskeyStations};
//# sourceMappingURL=wiskey-stations-B9bzm5-m.js.map
