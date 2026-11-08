import{i8 as k,i9 as f,i as z,ia as _,j as E,ib as B,hZ as O,E as M,F as b,G as u,a as C,h_ as R,h$ as L,dB as y,ic as m,i0 as g,dx as S,e as s,A as r,i4 as P,id as I,dI as v,H as A}from"./index-CCDqf4A8.js";import{m as c,g as $,n as w,h as T,a as K,s as D}from"./media-now-DEsDXhB3.js";const G=600,U=e=>new Promise(t=>setTimeout(t,e));function j(e){return e instanceof E?{code:e.code,message:f[e.code]??e.body.user_message??"הפעולה נכשלה"}:{code:null,message:"אין חיבור לשרת"}}async function F(e,t,i){let o;try{o=await k(e,t)}catch(n){const{code:d,message:h}=j(n);return{outcome:d==="rate_limited"?"rate_limited":"refused",message:h,code:d}}if(o.status==="refused")return{outcome:"refused",message:o.error&&f[o.error]||"המסך דחה את הפקודה",code:o.error};if(o.status==="sent"||o.confirm==="none")return{outcome:"sent",message:"",code:null};if(!o.action_id||!z())return{outcome:"confirmed",message:"",code:null};const a=Date.now()+B;for(;Date.now()<a;){await U(G);try{const n=await _(o.action_id);if(n.status==="confirmed")return{outcome:"confirmed",message:"",code:null};if(n.status==="failed"||n.status==="denied")return{outcome:"refused",message:n.status==="denied"?f.forbidden:"המסך דחה את הפקודה",code:n.error};if(n.status==="unknown")break}catch{}}return{outcome:"not_confirmed",message:f.not_confirmed,code:"not_confirmed"}}var H=Object.defineProperty,N=Object.getOwnPropertyDescriptor,p=(e,t,i,o)=>{for(var a=o>1?void 0:o?N(t,i):t,n=e.length-1,d;n>=0;n--)(d=e[n])&&(a=(o?d(t,i,a):d(a))||a);return o&&a&&H(t,i,a),a};let l=class extends C{constructor(){super(...arguments),this.size="m",this.compact=!1,this.editing=!1,this.dimmed=!1,this.pending=new Set,this.nack="",this.note="",this.shaking="",this.menu=!1,this.detail=null,this.detailBusy=!1,this.throttle=new R,this.timers=[],this.ticker=0,this.detailKey="",this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&(this.menu=!1)},this.onKey=e=>{e.key==="Escape"&&this.menu&&(this.menu=!1)}}connectedCallback(){super.connectedCallback(),L(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey);for(const e of this.timers)window.clearTimeout(e);this.timers=[],window.clearInterval(this.ticker),this.ticker=0}willUpdate(e){e.has("device")&&this.device&&(this.detailKey!==this.device.key&&(this.detail=null,this.detailKey=this.device.key),this.menu&&!y(this.device.live)&&(this.menu=!1)),this.toggleAttribute("data-menu",this.menu)}updated(){const e=!!this.device&&this.device.live.play==="playing"&&this.device.live.power==="on"&&!!this.device.live.now.duration_s;e&&!this.ticker?this.ticker=window.setInterval(()=>this.requestUpdate(),1e3):!e&&this.ticker&&(window.clearInterval(this.ticker),this.ticker=0)}later(e,t){this.timers.push(window.setTimeout(e,t))}setPending(e,t){const i=new Set(this.pending);t?i.add(e):i.delete(e),this.pending=i}settle(e,t){this.setPending(e,!1),t.outcome==="rate_limited"?this.shake(e):(t.outcome==="not_confirmed"||t.outcome==="refused")&&(this.nack=e,this.note=t.message,this.later(()=>{this.nack="",this.note=""},6e3)),this.dispatchEvent(new CustomEvent("media-changed",{detail:{key:this.device.key,outcome:t.outcome},bubbles:!0,composed:!0}))}shake(e){this.shaking=e,this.later(()=>this.shaking="",300)}async send(e,t){if(!(!m(this.device,t)||this.pending.has(e))){if(e!=="power"&&e!=="source"&&!this.throttle.take())return this.shake(e);this.nack="",this.note="",this.setPending(e,!0),this.settle(e,await F(this.device.key,t))}}power(){this.send("power",{command:g(this.device.live)?"power_off":"power_on"})}volume(e){const t=this.device,i=t.caps.volume_step||t.caps.keys.includes(e>0?"volup":"voldown"),o=Math.max(0,Math.min(100,(t.live.volume.level??0)+e*2));this.send("volume",i?{command:"volume_step",direction:e>0?"up":"down"}:{command:"volume_set",level:o})}mute(){this.send("mute",{command:"mute",muted:!this.device.live.volume.muted})}openRemote(e){this.menu=!1,this.dispatchEvent(new CustomEvent("open-remote",{detail:{key:this.device.key,tab:e??null},bubbles:!0,composed:!0}))}async toggleMenu(){if(this.menu=!this.menu,!(!this.menu||this.detail||this.detailBusy)){this.detailBusy=!0;try{const e=this.device.key,t=await S().get(e);this.device?.key===e&&(this.detail=t)}catch{this.menu=!1}finally{this.detailBusy=!1}}}pick(e,t){this.menu=!1,this.send("source",e==="source"?{command:"source",source_id:t}:{command:"app",app_id:t})}poster(e){if(e.kind==="art")return s`<div class="art frameart"><svg viewBox="0 0 100 70" aria-hidden="true"><rect x="0" y="0" width="100" height="70" fill="#f7f1e6" stroke="#b9a37e" stroke-width="2"/><circle cx="32" cy="32" r="16" fill="#e0794a" opacity=".85"/><rect x="48" y="18" width="30" height="36" fill="#27496d" opacity=".85"/><path d="M8 58 C30 44 52 60 92 46" stroke="#2f3a2f" stroke-width="2.5" fill="none"/></svg></div>`;if(e.kind==="saver")return s`<div class="art saver">${c("moon",void 0,"gl")}</div>`;if(e.kind==="un"||e.kind==="off")return r;const t=e.artwork?s`<img src=${P(e.artwork)} alt="" loading="lazy" />`:r;return s`<div class="art" style=${`--a1:${e.a1};--a2:${e.a2}`}>${e.channel?s`<span class="ch">${e.channel}</span>`:$(e.glyph,void 0,"gl")}${t}</div>`}shotButton(e,t){const i=`פתח שלט · ${e.name}`,o=this.pending.has("power")?s`<span class="spin"><i></i></span>`:r;if(t.kind==="un")return s`<button class="shot un" type="button" ?disabled=${this.editing} @click=${()=>this.openRemote()} aria-label=${i}><span class="ctr">${c("wifiOff")}<span>${t.label}</span></span></button>`;if(t.kind==="off")return s`<button class="shot off" type="button" ?disabled=${this.editing} @click=${()=>this.openRemote()} aria-label=${i}><span class="ctr">${c("power")}<span>כבוי</span></span>${o}</button>`;const a=e.live,n=t.kind==="art"?s`<span class="pilld">${c("frame")}אמנות</span>`:a.play==="playing"?s`<span class="pilld"><i></i>מנגן</span>`:a.play==="paused"?s`<span class="pilld">${c("pause")}מושהה</span>`:r;return s`<button class="shot" type="button" ?disabled=${this.editing} @click=${()=>this.openRemote()} aria-label=${i}>
      ${this.poster(t)}<span class="tl">${n}</span>
      ${t.kind==="art"?r:s`<span class="ov"><b>${w(t.kind==="tv"?"טלוויזיה":t.label)}</b>${t.sub?s`<small>${t.sub}</small>`:r}</span>`}
      ${t.prog!==null?s`<span class="pb" style=${`--p:${Math.round(t.prog*100)}%`}><i></i></span>`:r}${o}
    </button>`}powerButton(e){const t=g(e.live),a=!m(e,t?{command:"power_off"}:{command:"power_on"})||this.pending.has("power"),n=I(e.live)?"לא זמין":!t&&!e.caps.power_on?e.caps.power_on_reason==="no_remote_wake"?"אין הפעלה מרחוק":"אין הפעלה":t?"כבה":"הפעל";return s`<button type="button" class=${v({pw:!0,on:t,pend:this.pending.has("power"),nack:this.nack==="power",shake:this.shaking==="power"})} aria-pressed=${String(t)}
      aria-label=${`${n} · ${e.name}`} title=${n} ?disabled=${a} @click=${()=>this.power()}>${c("power")}</button>`}volumeControls(e){if(!(e.can.control&&(e.caps.volume_set||e.caps.volume_step||e.caps.keys.includes("volup"))))return r;const i=e.live.volume.level,o=m(e,{command:"volume_step",direction:"up"})||e.caps.volume_set&&m(e,{command:"volume_set",level:(i??0)+2}),a=m(e,{command:"volume_step",direction:"down"})||e.caps.volume_set&&m(e,{command:"volume_set",level:(i??0)-2});return s`<span class=${v({vrock:!0,muted:!!e.live.volume.muted,shake:this.shaking==="volume"})} role="group" aria-label=${`עוצמה · ${e.name}`}>
      <button type="button" aria-label="הנמך" ?disabled=${!a} @click=${()=>this.volume(-1)}>${c("minus")}</button>
      <span class="vv"><span class="n">${i??"—"}</span></span>
      <button type="button" aria-label="הגבר" ?disabled=${!o} @click=${()=>this.volume(1)}>${c("plus")}</button>
    </span>`}muteButton(e){if(!e.can.control||!e.caps.mute)return r;const t=!!e.live.volume.muted,i=t?"בטל השתקה":"השתק";return s`<button type="button" class=${v({rb:!0,muted:t,shake:this.shaking==="mute"})} aria-pressed=${String(t)} aria-label=${i} title=${i} @click=${()=>this.mute()}>${c(t?"volOff":"vol")}</button>`}sourceMenu(e){if(!this.menu)return r;const t=this.detail;if(!t)return s`<div class="pop" role="menu" aria-label="בחירת מקור"><div class="wait">טוען…</div></div>`;const i=e.live.now,o=t.sources,a=t.apps.slice(0,4),n=(d,h)=>{const x=d==="source"?i.source_id===h.id:i.app_id===h.id;return s`<button type="button" role="menuitemradio" aria-checked=${String(x)} @click=${()=>this.pick(d,h.id)}>${$(h.glyph)}${w(h.label)}${x?s`<span class="ck">${c("check")}</span>`:r}</button>`};return s`<div class="pop" role="menu" aria-label="בחירת מקור">
      ${o.map(d=>n("source",d))}${o.length&&a.length?s`<hr />`:r}${a.map(d=>n("app",d))}
      ${t.apps.length?s`<hr /><button type="button" role="menuitem" @click=${()=>this.openRemote("apps")}>${c("apps")}כל האפליקציות</button>`:r}
    </div>`}controls(e,t){if(t.kind==="un")return s`<span class="unl">${c("wifiOff")}${e.live.power==="unknown"?"מצב לא ידוע":e.live.since?s`לא זמין מאז <span class="n">${T(e.live.since)}</span>`:"לא זמין"}</span>`;if(!e.can.control&&!e.can.power)return r;const o=s`<button type="button" class="rbtn" aria-label=${`שלט · ${e.name}`} @click=${()=>this.openRemote()}>${c("remote")}שלט</button>`;if(!y(e.live))return s`<span class="grow"></span>${o}`;const a=e.can.power&&e.can.public_ok&&(e.caps.sources||e.caps.apps)?s`<button type="button" class=${v({rb:!0,shake:this.shaking==="source"})} aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`מקור: ${t.kind==="tv"?"טלוויזיה":t.label}`} title="מקור" @click=${()=>void this.toggleMenu()}>${c("input")}</button>`:r;return s`${this.volumeControls(e)}${this.muteButton(e)}${a}<span class="grow"></span>${o}`}render(){const e=this.device;if(!e)return r;const t=K(e),i=g(e.live)&&!!t.rgb,o=!e.can.control&&!e.can.power,a=this.controls(e,t),n=this.note?s`<small class="bad" role="status">${this.note}</small>`:s`<small>${D(e,t)}</small>`;return s`<article class=${v({scard:!0,glass:!0,lit:i,paused:e.live.play==="paused",un:t.kind==="un"})} style=${i?`--art:${t.rgb}`:""} aria-label=${e.name} data-device=${e.key}>
      <span class="gbox" aria-hidden="true">${i?this.poster(t):r}</span>
      <div class="edit-slot"><slot name="edit"></slot></div>
      ${this.shotButton(e,t)}
      <div class="sbody" ?inert=${this.editing}>
        <div class="srow"><div class="tx"><b>${w(e.name)}</b>${n}</div>${o?r:this.powerButton(e)}</div>
        ${a===r?r:s`<div class="sctl">${a}</div>`}
      </div>
      ${this.sourceMenu(e)}
    </article>`}};l.styles=[O,M`
    :host {
      display: block;
      position: relative;
      min-inline-size: 0;
      color: var(--dv-text);
      font-family: var(--dv-font);
    }
    :host([data-menu]) {
      z-index: 20;
    }
    .scard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 10px 10px 14px;
      min-inline-size: 0;
      transition: box-shadow var(--mm-motion) var(--mm-ease), transform var(--mm-motion) var(--mm-ease), border-color var(--mm-motion);
    }
    .gbox {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      overflow: hidden;
      z-index: 0;
      pointer-events: none;
    }
    .gbox .art {
      inset: -35%;
      filter: blur(var(--mm-art-glow-blur)) saturate(1.5);
      opacity: var(--mm-art-glow-alpha);
      -webkit-mask-image: linear-gradient(180deg, #000 22%, transparent 88%);
      mask-image: linear-gradient(180deg, #000 22%, transparent 88%);
    }
    .gbox::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--mm-art-veil);
    }
    .scard > :not(.gbox):not(.pop):not(.edit-slot) {
      position: relative;
      z-index: 1;
    }
    .scard.lit {
      border-color: rgb(var(--art) / 0.34);
      box-shadow: 0 22px 56px rgb(var(--art) / var(--mm-art-halo-alpha)), var(--dv-shadow-1);
    }
    .scard.paused .gbox {
      opacity: 0.55;
    }
    @media (hover: hover) and (prefers-reduced-motion: no-preference) {
      :host(:not([editing])) .scard:not(.un):hover {
        transform: translateY(var(--dv-hover-lift));
        box-shadow: var(--dv-shadow-2);
      }
      :host(:not([editing])) .scard.lit:hover {
        box-shadow: 0 26px 60px rgb(var(--art) / calc(var(--mm-art-halo-alpha) + 0.08)), var(--dv-shadow-2);
      }
    }
    .scard.un {
      background: var(--dv-surface-2);
      box-shadow: none;
      border-style: dashed;
      border-color: var(--dv-border-strong);
    }
    .edit-slot {
      position: absolute;
      inset: 0;
      z-index: 6;
      pointer-events: none;
    }
    .edit-slot ::slotted(*) {
      pointer-events: auto;
    }
    :host([data-dimmed]) .scard {
      opacity: 0.45;
    }
    :host([editing]) .scard {
      outline: 2px dashed color-mix(in srgb, var(--dv-accent) 55%, transparent);
      outline-offset: 4px;
    }
    /* the poster */
    .shot {
      position: relative;
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 6.3;
      border-radius: calc(var(--dv-radius-md) - 8px);
      overflow: hidden;
      border: 0;
      padding: 0;
      color: var(--sw-on-video);
      text-align: start;
      background: var(--mm-screen-off);
      cursor: pointer;
      isolation: isolate;
      box-shadow: 0 10px 26px rgb(var(--art, 20 24 34) / 0.28);
    }
    :host([data-size='l']) .shot {
      aspect-ratio: 16 / 8.6;
    }
    .shot::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 5;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
      background: linear-gradient(118deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0) 36%);
      pointer-events: none;
    }
    .shot .ov {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 0;
      padding: 26px 16px 13px;
      background: linear-gradient(0deg, rgba(0, 0, 0, 0.66), rgba(0, 0, 0, 0));
      display: flex;
      flex-direction: column;
      gap: 1px;
      z-index: 2;
    }
    .shot .ov b {
      font-size: var(--sw-fs-lg);
      font-weight: 700;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow: 0 1px 8px rgba(0, 0, 0, 0.3);
    }
    .shot .ov small {
      font-size: var(--sw-fs-sm);
      opacity: 0.92;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .shot .tl {
      position: absolute;
      inset-block-start: 10px;
      inset-inline-start: 10px;
      z-index: 3;
      display: flex;
      gap: 6px;
    }
    .shot .pb {
      position: absolute;
      inset-inline: 14px;
      inset-block-end: 7px;
      block-size: 3px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.25);
      z-index: 3;
      overflow: hidden;
    }
    .shot .pb i {
      display: block;
      block-size: 100%;
      inline-size: var(--p, 0%);
      background: var(--sw-on-video);
      border-radius: 3px;
    }
    .shot .ctr {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 8px;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: 500;
    }
    .shot .ctr .ic {
      font-size: var(--sw-fs-3xl);
      stroke-width: 1.6;
    }
    .shot.off,
    .shot.un {
      box-shadow: none;
    }
    .shot.un {
      background: repeating-linear-gradient(135deg, var(--dv-surface-3) 0 10px, transparent 10px 20px), var(--dv-surface-2);
    }
    .shot .spin {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(0, 0, 0, 0.32);
      z-index: 4;
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(3px));
      backdrop-filter: var(--sw-perf-blur, blur(3px));
    }
    .shot .spin i {
      inline-size: 30px;
      block-size: 30px;
      border-radius: 50%;
      border: 3px solid rgba(255, 255, 255, 0.35);
      border-top-color: var(--sw-on-video);
      animation: mm-spin 0.8s linear infinite;
    }
    .shot[disabled] {
      cursor: default;
    }
    /* name, state, power, controls */
    .sbody {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-inline: 6px;
    }
    .srow {
      display: flex;
      align-items: center;
      gap: 12px;
      min-inline-size: 0;
    }
    .srow .tx {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
    /* R5-MEDIA-ENERGY-297 (HOMEFABLE type scale): the screen name is the card's title - 20 px / 800 in the heading ink */
    .srow .tx b {
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--dv-text));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .srow .tx small {
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .srow .tx small.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
    .sctl {
      display: flex;
      align-items: center;
      gap: 8px;
      min-inline-size: 0;
      flex-wrap: wrap;
    }
    .unl {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .unl .ic {
      color: var(--dv-danger);
    }
    .pop {
      inset-block-start: calc(100% - 10px);
      inset-inline-start: 10px;
    }
    .pop .wait {
      padding: 14px;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-base);
    }
    /* the phone's horizontal card (and size "s") */
    :host([compact]) .scard,
    :host([data-size='s']) .scard {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr) auto;
      grid-template-areas: 'shot tx pw' 'ctl ctl ctl';
      gap: 12px;
      padding: 8px 8px 10px;
    }
    :host([compact]) .sbody,
    :host([compact]) .srow,
    :host([data-size='s']) .sbody,
    :host([data-size='s']) .srow {
      display: contents;
    }
    :host([compact]) .srow .tx,
    :host([data-size='s']) .srow .tx {
      grid-area: tx;
      align-self: center;
    }
    :host([compact]) .srow .pw,
    :host([data-size='s']) .srow .pw {
      grid-area: pw;
      align-self: center;
    }
    :host([compact]) .shot,
    :host([data-size='s']) .shot {
      grid-area: shot;
      aspect-ratio: 16 / 10.5;
      border-radius: var(--sw-r-lg);
    }
    :host([compact]) .shot .ov,
    :host([data-size='s']) .shot .ov {
      padding: 14px 9px 7px;
    }
    :host([compact]) .shot .ov b,
    :host([data-size='s']) .shot .ov b {
      font-size: var(--sw-fs-sm);
    }
    :host([compact]) .shot .ov small,
    :host([compact]) .shot .tl,
    :host([compact]) .shot .ctr span,
    :host([data-size='s']) .shot .ov small,
    :host([data-size='s']) .shot .tl,
    :host([data-size='s']) .shot .ctr span {
      display: none;
    }
    :host([compact]) .shot .pb,
    :host([data-size='s']) .shot .pb {
      inset-inline: 8px;
      inset-block-end: 4px;
    }
    /* the wrappers are display:contents there: the grid items themselves must sit above the glow */
    :host([compact]) .srow .tx,
    :host([compact]) .srow .pw,
    :host([compact]) .sctl,
    :host([data-size='s']) .srow .tx,
    :host([data-size='s']) .srow .pw,
    :host([data-size='s']) .sctl {
      position: relative;
      z-index: 1;
    }
    :host([compact]) .sctl,
    :host([data-size='s']) .sctl {
      grid-area: ctl;
      padding-inline: 2px;
    }
    :host([compact]) .pop,
    :host([data-size='s']) .pop {
      inset-inline-start: 8px;
    }
  `];p([b({attribute:!1})],l.prototype,"device",2);p([b({reflect:!0,attribute:"data-size"})],l.prototype,"size",2);p([b({type:Boolean,reflect:!0})],l.prototype,"compact",2);p([b({type:Boolean,reflect:!0})],l.prototype,"editing",2);p([b({type:Boolean,reflect:!0,attribute:"data-dimmed"})],l.prototype,"dimmed",2);p([u()],l.prototype,"pending",2);p([u()],l.prototype,"nack",2);p([u()],l.prototype,"note",2);p([u()],l.prototype,"shaking",2);p([u()],l.prototype,"menu",2);p([u()],l.prototype,"detail",2);p([u()],l.prototype,"detailBusy",2);l=p([A("media-screen-card")],l);
//# sourceMappingURL=media-screen-card-BV6eferZ.js.map
