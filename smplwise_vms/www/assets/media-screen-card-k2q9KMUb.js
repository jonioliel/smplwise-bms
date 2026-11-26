import{h$ as z,i0 as w,cL as i,af as _,c6 as B,c as E,i1 as O,bx as M,j as C,z as f,k as m,a as L,d8 as R,bB as S,i2 as y,gG as v,d9 as g,i3 as P,b as s,A as l,de as A,i4 as I,cV as b,m as T}from"./index-D3xHkfje.js";import{m as d,g as k,n as x,h as K,a as D,s as G}from"./media-now-DzLIKzlM.js";const U=600,j=e=>new Promise(t=>setTimeout(t,e));function F(e){return e instanceof E?{code:e.code,message:w[e.code]??e.body.user_message??i("הפעולה נכשלה")}:{code:null,message:i("אין חיבור לשרת")}}async function N(e,t,o){let a;try{a=await z(e,t)}catch(r){const{code:p,message:u}=F(r);return{outcome:p==="rate_limited"?"rate_limited":"refused",message:u,code:p}}if(a.status==="refused")return{outcome:"refused",message:a.error&&w[a.error]||i("המסך דחה את הפקודה"),code:a.error};if(a.status==="sent"||a.confirm==="none")return{outcome:"sent",message:"",code:null};if(!a.action_id||!_())return{outcome:"confirmed",message:"",code:null};const n=Date.now()+O;for(;Date.now()<n;){await j(U);try{const r=await B(a.action_id);if(r.status==="confirmed")return{outcome:"confirmed",message:"",code:null};if(r.status==="failed"||r.status==="denied")return{outcome:"refused",message:r.status==="denied"?w.forbidden:i("המסך דחה את הפקודה"),code:r.error};if(r.status==="unknown")break}catch{}}return{outcome:"not_confirmed",message:w.not_confirmed,code:"not_confirmed"}}var V=Object.defineProperty,Y=Object.getOwnPropertyDescriptor,h=(e,t,o,a)=>{for(var n=a>1?void 0:a?Y(t,o):t,r=e.length-1,p;r>=0;r--)(p=e[r])&&(n=(a?p(t,o,n):p(n))||n);return a&&n&&V(t,o,n),n};let c=class extends L{constructor(){super(...arguments),this.size="m",this.compact=!1,this.editing=!1,this.dimmed=!1,this.pending=new Set,this.nack="",this.note="",this.shaking="",this.menu=!1,this.detail=null,this.detailBusy=!1,this.throttle=new R,this.timers=[],this.ticker=0,this.detailKey="",this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&(this.menu=!1)},this.onKey=e=>{e.key==="Escape"&&this.menu&&(this.menu=!1)}}connectedCallback(){super.connectedCallback(),S(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey);for(const e of this.timers)window.clearTimeout(e);this.timers=[],window.clearInterval(this.ticker),this.ticker=0}willUpdate(e){e.has("device")&&this.device&&(this.detailKey!==this.device.key&&(this.detail=null,this.detailKey=this.device.key),this.menu&&!y(this.device.live)&&(this.menu=!1)),this.toggleAttribute("data-menu",this.menu)}updated(){const e=!!this.device&&this.device.live.play==="playing"&&this.device.live.power==="on"&&!!this.device.live.now.duration_s;e&&!this.ticker?this.ticker=window.setInterval(()=>this.requestUpdate(),1e3):!e&&this.ticker&&(window.clearInterval(this.ticker),this.ticker=0)}later(e,t){this.timers.push(window.setTimeout(e,t))}setPending(e,t){const o=new Set(this.pending);t?o.add(e):o.delete(e),this.pending=o}settle(e,t){this.setPending(e,!1),t.outcome==="rate_limited"?this.shake(e):(t.outcome==="not_confirmed"||t.outcome==="refused")&&(this.nack=e,this.note=t.message,this.later(()=>{this.nack="",this.note=""},6e3)),this.dispatchEvent(new CustomEvent("media-changed",{detail:{key:this.device.key,outcome:t.outcome},bubbles:!0,composed:!0}))}shake(e){this.shaking=e,this.later(()=>this.shaking="",300)}async send(e,t){if(!(!v(this.device,t)||this.pending.has(e))){if(e!=="power"&&e!=="source"&&!this.throttle.take())return this.shake(e);this.nack="",this.note="",this.setPending(e,!0),this.settle(e,await N(this.device.key,t))}}power(){this.send("power",{command:g(this.device.live)?"power_off":"power_on"})}volume(e){const t=this.device,o=t.caps.volume_step||t.caps.keys.includes(e>0?"volup":"voldown"),a=Math.max(0,Math.min(100,(t.live.volume.level??0)+e*2));this.send("volume",o?{command:"volume_step",direction:e>0?"up":"down"}:{command:"volume_set",level:a})}mute(){this.send("mute",{command:"mute",muted:!this.device.live.volume.muted})}openRemote(e){this.menu=!1,this.dispatchEvent(new CustomEvent("open-remote",{detail:{key:this.device.key,tab:e??null},bubbles:!0,composed:!0}))}async toggleMenu(){if(this.menu=!this.menu,!(!this.menu||this.detail||this.detailBusy)){this.detailBusy=!0;try{const e=this.device.key,t=await P().get(e);this.device?.key===e&&(this.detail=t)}catch{this.menu=!1}finally{this.detailBusy=!1}}}pick(e,t){this.menu=!1,this.send("source",e==="source"?{command:"source",source_id:t}:{command:"app",app_id:t})}poster(e){if(e.kind==="art")return s`<div class="art frameart"><svg viewBox="0 0 100 70" aria-hidden="true"><rect x="0" y="0" width="100" height="70" fill="#f7f1e6" stroke="#b9a37e" stroke-width="2"/><circle cx="32" cy="32" r="16" fill="#e0794a" opacity=".85"/><rect x="48" y="18" width="30" height="36" fill="#27496d" opacity=".85"/><path d="M8 58 C30 44 52 60 92 46" stroke="#2f3a2f" stroke-width="2.5" fill="none"/></svg></div>`;if(e.kind==="saver")return s`<div class="art saver">${d("moon",void 0,"gl")}</div>`;if(e.kind==="un"||e.kind==="off")return l;const t=e.artwork?s`<img src=${A(e.artwork)} alt="" loading="lazy" />`:l;return s`<div class="art" style=${`--a1:${e.a1};--a2:${e.a2}`}>${e.channel?s`<span class="ch">${e.channel}</span>`:k(e.glyph,void 0,"gl")}${t}</div>`}shotButton(e,t){const o=`${i("פתח שלט")} · ${e.name}`,a=this.pending.has("power")?s`<span class="spin"><i></i></span>`:l;if(t.kind==="un")return s`<button class="shot un" type="button" ?disabled=${this.editing} @click=${()=>this.openRemote()} aria-label=${o}><span class="ctr">${d("wifiOff")}<span>${t.label}</span></span></button>`;if(t.kind==="off")return s`<button class="shot off" type="button" ?disabled=${this.editing} @click=${()=>this.openRemote()} aria-label=${o}><span class="ctr">${d("power")}<span>${i("כבוי")}</span></span>${a}</button>`;const n=e.live,r=t.kind==="art"?s`<span class="pilld">${d("frame")}${i("אמנות")}</span>`:n.play==="playing"?s`<span class="pilld"><i></i>${i("מנגן")}</span>`:n.play==="paused"?s`<span class="pilld">${d("pause")}${i("מושהה")}</span>`:l;return s`<button class="shot" type="button" ?disabled=${this.editing} @click=${()=>this.openRemote()} aria-label=${o}>
      ${this.poster(t)}<span class="tl">${r}</span>
      ${t.kind==="art"?l:s`<span class="ov"><b>${x(t.kind==="tv"?i("טלוויזיה"):t.label)}</b>${t.sub?s`<small>${t.sub}</small>`:l}</span>`}
      ${t.prog!==null?s`<span class="pb" style=${`--p:${Math.round(t.prog*100)}%`}><i></i></span>`:l}${a}
    </button>`}powerButton(e){const t=g(e.live),n=!v(e,t?{command:"power_off"}:{command:"power_on"})||this.pending.has("power"),r=I(e.live)?i("לא זמין"):!t&&!e.caps.power_on?e.caps.power_on_reason==="no_remote_wake"?i("אין הפעלה מרחוק"):i("אין הפעלה"):t?i("כבה"):i("הפעל");return s`<button type="button" class=${b({pw:!0,on:t,pend:this.pending.has("power"),nack:this.nack==="power",shake:this.shaking==="power"})} aria-pressed=${String(t)}
      aria-label=${`${r} · ${e.name}`} title=${r} ?disabled=${n} @click=${()=>this.power()}>${d("power")}</button>`}volumeControls(e){if(!(e.can.control&&(e.caps.volume_set||e.caps.volume_step||e.caps.keys.includes("volup"))))return l;const o=e.live.volume.level,a=v(e,{command:"volume_step",direction:"up"})||e.caps.volume_set&&v(e,{command:"volume_set",level:(o??0)+2}),n=v(e,{command:"volume_step",direction:"down"})||e.caps.volume_set&&v(e,{command:"volume_set",level:(o??0)-2});return s`<span class=${b({vrock:!0,muted:!!e.live.volume.muted,shake:this.shaking==="volume"})} role="group" aria-label=${`${i("עוצמה")} · ${e.name}`}>
      <button type="button" aria-label=${i("הנמך")} ?disabled=${!n} @click=${()=>this.volume(-1)}>${d("minus")}</button>
      <span class="vv"><span class="n">${o??"—"}</span></span>
      <button type="button" aria-label=${i("הגבר")} ?disabled=${!a} @click=${()=>this.volume(1)}>${d("plus")}</button>
    </span>`}muteButton(e){if(!e.can.control||!e.caps.mute)return l;const t=!!e.live.volume.muted,o=t?i("בטל השתקה"):i("השתק");return s`<button type="button" class=${b({rb:!0,muted:t,shake:this.shaking==="mute"})} aria-pressed=${String(t)} aria-label=${o} title=${o} @click=${()=>this.mute()}>${d(t?"volOff":"vol")}</button>`}sourceMenu(e){if(!this.menu)return l;const t=this.detail;if(!t)return s`<div class="pop" role="menu" aria-label=${i("בחירת מקור")}><div class="wait">${i("טוען…")}</div></div>`;const o=e.live.now,a=t.sources,n=t.apps.slice(0,4),r=(p,u)=>{const $=p==="source"?o.source_id===u.id:o.app_id===u.id;return s`<button type="button" role="menuitemradio" aria-checked=${String($)} @click=${()=>this.pick(p,u.id)}>${k(u.glyph)}${x(u.label)}${$?s`<span class="ck">${d("check")}</span>`:l}</button>`};return s`<div class="pop" role="menu" aria-label=${i("בחירת מקור")}>
      ${a.map(p=>r("source",p))}${a.length&&n.length?s`<hr />`:l}${n.map(p=>r("app",p))}
      ${t.apps.length?s`<hr /><button type="button" role="menuitem" @click=${()=>this.openRemote("apps")}>${d("apps")}${i("כל האפליקציות")}</button>`:l}
    </div>`}controls(e,t){if(t.kind==="un")return s`<span class="unl">${d("wifiOff")}${e.live.power==="unknown"?i("מצב לא ידוע"):e.live.since?s`${i("לא זמין מאז")} <span class="n">${K(e.live.since)}</span>`:i("לא זמין")}</span>`;if(!e.can.control&&!e.can.power)return l;const a=s`<button type="button" class="rbtn" aria-label=${`${i("שלט")} · ${e.name}`} @click=${()=>this.openRemote()}>${d("remote")}${i("שלט")}</button>`;if(!y(e.live))return s`<span class="grow"></span>${a}`;const n=e.can.power&&e.can.public_ok&&(e.caps.sources||e.caps.apps)?s`<button type="button" class=${b({rb:!0,shake:this.shaking==="source"})} aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${i("מקור: {name}",{name:t.kind==="tv"?i("טלוויזיה"):t.label})} title=${i("מקור")} @click=${()=>void this.toggleMenu()}>${d("input")}</button>`:l;return s`${this.volumeControls(e)}${this.muteButton(e)}${n}<span class="grow"></span>${a}`}render(){const e=this.device;if(!e)return l;const t=D(e),o=g(e.live)&&!!t.rgb,a=!e.can.control&&!e.can.power,n=this.controls(e,t),r=this.note?s`<small class="bad" role="status">${this.note}</small>`:s`<small>${G(e,t)}</small>`;return s`<article class=${b({scard:!0,glass:!0,lit:o,paused:e.live.play==="paused",un:t.kind==="un"})} style=${o?`--art:${t.rgb}`:""} aria-label=${e.name} data-device=${e.key}>
      <span class="gbox" aria-hidden="true">${o?this.poster(t):l}</span>
      <div class="edit-slot"><slot name="edit"></slot></div>
      ${this.shotButton(e,t)}
      <div class="sbody" ?inert=${this.editing}>
        <div class="srow"><div class="tx"><b>${x(e.name)}</b>${r}</div>${a?l:this.powerButton(e)}</div>
        ${n===l?l:s`<div class="sctl">${n}</div>`}
      </div>
      ${this.sourceMenu(e)}
    </article>`}};c.styles=[M,C`
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
      -webkit-mask-image: var(--mm-fade-art);
      mask-image: var(--mm-fade-art);
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
      text-shadow: 0 1px 8px color-mix(in srgb, var(--sw-video-shadow-ink) 30%, transparent);
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
      border-radius: var(--sw-r-pill);
      background: var(--mm-on-art-track);
      z-index: 3;
      overflow: hidden;
    }
    .shot .pb i {
      display: block;
      block-size: 100%;
      inline-size: var(--p, 0%);
      background: var(--sw-on-video);
      border-radius: var(--sw-r-pill);
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
      background: var(--mm-on-art-pending);
      z-index: 4;
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(3px));
      backdrop-filter: var(--sw-perf-blur, blur(3px));
    }
    .shot .spin i {
      inline-size: 30px;
      block-size: 30px;
      border-radius: 50%;
      border: 3px solid var(--mm-on-art-spinner);
      border-top-color: var(--sw-on-video);
      animation: mm-spin calc(var(--sw-t-med) * 4) linear infinite;
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
  `];h([f({attribute:!1})],c.prototype,"device",2);h([f({reflect:!0,attribute:"data-size"})],c.prototype,"size",2);h([f({type:Boolean,reflect:!0})],c.prototype,"compact",2);h([f({type:Boolean,reflect:!0})],c.prototype,"editing",2);h([f({type:Boolean,reflect:!0,attribute:"data-dimmed"})],c.prototype,"dimmed",2);h([m()],c.prototype,"pending",2);h([m()],c.prototype,"nack",2);h([m()],c.prototype,"note",2);h([m()],c.prototype,"shaking",2);h([m()],c.prototype,"menu",2);h([m()],c.prototype,"detail",2);h([m()],c.prototype,"detailBusy",2);c=h([T("media-screen-card")],c);
