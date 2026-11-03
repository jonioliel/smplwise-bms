import{g$ as R,E as I,F as k,G as h,a as L,S as j,h4 as V,gQ as A,gV as f,h8 as g,ha as x,hg as H,cM as D,h6 as G,e as a,A as n,hh as P,cW as u,hi as O,hj as E,H as T}from"./index-CHCc2mtA.js";import{g as $,m as r,n as m}from"./media-now-Did2oYf3.js";import{r as C,p as N,l as M}from"./media-group-dialog-CpLp1Pe9.js";var U=Object.defineProperty,q=Object.getOwnPropertyDescriptor,d=(e,t,i,s)=>{for(var o=s>1?void 0:s?q(t,i):t,c=e.length-1,p;c>=0;c--)(p=e[c])&&(o=(s?p(t,i,o):p(o))||o);return s&&o&&U(t,i,o),o};let l=class extends L{constructor(){super(...arguments),this.size="m",this.compact=!1,this.editing=!1,this.dimmed=!1,this.leader=null,this.pending=new Set,this.nack="",this.note="",this.shaking="",this.menu=!1,this.detail=null,this.detailBusy=!1,this.volOpen=!1,this.skin=new j(this),this.throttle=new V,this.timers=[],this.ticker=0,this.detailKey="",this.editRo=null,this.onEditSlot=e=>{const t=e.target.assignedElements({flatten:!0})[0];if(this.editRo?.disconnect(),this.editRo=null,!t||typeof ResizeObserver>"u"){this.style.removeProperty("--mm-edit-w");return}this.editRo=new ResizeObserver(()=>{const i=Math.ceil(t.getBoundingClientRect().width);i>0?this.style.setProperty("--mm-edit-w",`${i}px`):this.style.removeProperty("--mm-edit-w")}),this.editRo.observe(t)},this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&(this.menu=!1)},this.onKey=e=>{e.key==="Escape"&&this.menu&&(this.menu=!1)}}connectedCallback(){super.connectedCallback(),A(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey);for(const e of this.timers)window.clearTimeout(e);this.timers=[],window.clearInterval(this.ticker),this.ticker=0,this.editRo?.disconnect(),this.editRo=null}willUpdate(e){e.has("device")&&this.device&&(this.detailKey!==this.device.key&&(this.detail=null,this.detailKey=this.device.key),this.menu&&!f(this.device.live)&&(this.menu=!1)),this.toggleAttribute("data-menu",this.menu)}updated(){const e=this.device,t=!!e&&e.live.play==="playing"&&e.live.power==="on"&&!!e.live.now.duration_s&&e.live.now.kind!=="station";t&&!this.ticker?this.ticker=window.setInterval(()=>this.requestUpdate(),1e3):!t&&this.ticker&&(window.clearInterval(this.ticker),this.ticker=0)}later(e,t){this.timers.push(window.setTimeout(e,t))}setPending(e,t){const i=new Set(this.pending);t?i.add(e):i.delete(e),this.pending=i}settle(e,t){this.setPending(e,!1),t.outcome==="rate_limited"?this.shake(e):(t.outcome==="not_confirmed"||t.outcome==="refused")&&(this.nack=e,this.note=t.message,this.later(()=>{this.nack="",this.note=""},6e3)),this.dispatchEvent(new CustomEvent("media-changed",{detail:{key:this.device.key,outcome:t.outcome},bubbles:!0,composed:!0}))}shake(e){this.shaking=e,this.later(()=>this.shaking="",300)}async send(e,t){if(!(!g(this.device,t)||this.pending.has(e))){if(e!=="power"&&e!=="source"&&!this.throttle.take())return this.shake(e);this.nack="",this.note="",this.setPending(e,!0),this.settle(e,await C(this.device.key,t))}}power(){this.send("power",{command:f(this.device.live)?"power_off":"power_on"})}toggle(){this.send("pb",{command:"transport",action:"play_pause"})}volume(e){const t=this.device,i=Math.max(0,Math.min(100,(t.live.volume.level??0)+e*2));this.send("volume",t.caps.volume_set?{command:"volume_set",level:i}:{command:"volume_step",direction:e>0?"up":"down"})}setVolume(e){const t=this.device,i=x(t),s=Math.max(0,Math.min(i??100,Math.round(e)));this.send("volume",{command:"volume_set",level:s})}async mute(){const e=this.device,t=e.live.volume.muted?H(e):null;t!==null&&g(e,{command:"volume_set",level:t})&&await C(e.key,{command:"volume_set",level:t}),this.send("mute",{command:"mute",muted:!e.live.volume.muted})}openPlayer(){this.menu=!1,this.dispatchEvent(new CustomEvent("open-player",{detail:{key:this.device.key},bubbles:!0,composed:!0}))}async toggleMenu(){if(this.menu=!this.menu,!(!this.menu||this.detail||this.detailBusy)){this.detailBusy=!0;try{const e=this.device.key,t=await D().get(e);this.device?.key===e&&(this.detail=t)}catch{this.menu=!1}finally{this.detailBusy=!1}}}pick(e){this.menu=!1,this.send("source",{command:"source",source_id:e})}art(e){const t=e.artwork?a`<img src=${G(e.artwork)} alt="" loading="lazy" />`:n;return a`<div class="art" style=${`--a1:${e.a1};--a2:${e.a2}`}>${$(e.glyph,void 0,"gl")}${t}</div>`}cover(e,t){const i=`פתח נגן · ${e.name}`,s=this.pending.has("power")?a`<span class="pend"><i></i></span>`:n,o=this.editing;if(t.kind==="un")return a`<button class="cov un" type="button" ?disabled=${o} @click=${()=>this.openPlayer()} aria-label=${i}><span class="ctr">${r("wifiOff")}</span></button>`;if(t.kind==="off")return a`<button class="cov off" type="button" ?disabled=${o} @click=${()=>this.openPlayer()} aria-label=${i}><span class="ctr">${r(P(e)?"power":e.kind==="player"?"media":"speaker")}</span>${s}</button>`;if(t.kind==="rcv")return a`<button class="cov rcv" type="button" ?disabled=${o} @click=${()=>this.openPlayer()} aria-label=${i}><span class="ctr">${$(t.glyph)}<span>${m(t.tile)}</span></span>${s}</button>`;if(t.kind==="idle")return a`<button class="cov idle" type="button" ?disabled=${o} @click=${()=>this.openPlayer()} aria-label=${i}><span class="ctr">${r(e.kind==="player"?"media":"speaker")}</span>${s}</button>`;const c=t.playing?a`<span class="pilld"><i></i>מנגן</span>`:a`<span class="pilld">${r("pause")}מושהה</span>`,p=t.kind==="station"?a`<span class="live"><i></i>חי</span>`:t.prog!==null?a`<span class="pb" style=${`--p:${Math.round(t.prog*100)}%`}><i></i></span>`:n;return a`<button class="cov" type="button" ?disabled=${o} @click=${()=>this.openPlayer()} aria-label=${i}>${this.art(t)}${c}${p}${s}</button>`}mainKey(e,t){const i=!e.can.control&&!e.can.power;if(t.kind==="un"||i)return n;if((e.kind==="receiver"||t.kind==="off")&&!P(e))return n;if(e.kind==="receiver"||t.kind==="off"){const b=f(e.live),w=!g(e,b?{command:"power_off"}:{command:"power_on"})||this.pending.has("power"),v=e.live.caps_known?!b&&!e.caps.power_on?"אין הפעלה מרחוק":b?"כבה":"הפעל":"לא זמין";return a`<div class="main"><button type="button" class=${u({pw:!0,on:b,pend:this.pending.has("power"),nack:this.nack==="power",shake:this.shaking==="power"})} aria-pressed=${String(b)} aria-label=${`${v} · ${e.name}`} title=${v} ?disabled=${w} @click=${()=>this.power()}>${r("power")}</button></div>`}const s=t.playing,o=t.kind==="idle",c=s?"השהה":o?"נגן":"המשך",p=!g(e,{command:"transport",action:"play_pause"})||this.pending.has("pb");return a`<div class="main"><button type="button" class=${u({pk:!0,idle:o,pend:this.pending.has("pb"),nack:this.nack==="pb",shake:this.shaking==="pb"})} aria-label=${`${c} · ${e.name}`} title=${c} ?disabled=${p} @click=${()=>this.toggle()}>${r(s?"pause":"play")}</button></div>`}volumeControls(e){if(!e.can.control||!(e.caps.volume_set||e.caps.volume_step))return n;const t=e.live.volume.level,i=x(e),s=g(e,e.caps.volume_set?{command:"volume_set",level:(t??0)+2}:{command:"volume_step"})&&(i===null||(t??0)<i),o=g(e,e.caps.volume_set?{command:"volume_set",level:(t??0)-2}:{command:"volume_step"})&&(t??0)>0;return a`<span class=${u({vrock:!0,muted:!!e.live.volume.muted,shake:this.shaking==="volume"})} role="group" aria-label=${`עוצמה · ${e.name}`}>
      <button type="button" aria-label="הנמך" ?disabled=${!o} @click=${()=>this.volume(-1)}>${r("minus")}</button>
      <span class="vv"><span class="n">${t??"—"}</span></span>
      <button type="button" aria-label="הגבר" ?disabled=${!s} @click=${()=>this.volume(1)}>${r("plus")}</button>
    </span>`}muteButton(e){if(!e.can.control||!e.caps.mute)return n;const t=!!e.live.volume.muted,i=t?"בטל השתקה":"השתק";return a`<button type="button" class=${u({rb:!0,muted:t,shake:this.shaking==="mute"})} aria-pressed=${String(t)} aria-label=${i} title=${i} @click=${()=>this.mute()}>${r(t?"volOff":"vol")}</button>`}sourceMenu(e){if(!this.menu)return n;const t=this.detail;if(!t)return a`<div class="pop" role="menu" aria-label="בחירת מקור"><div class="wait">טוען…</div></div>`;const i=e.live.now.source_id;return a`<div class="pop" role="menu" aria-label="בחירת מקור">
      ${t.sources.map(s=>a`<button type="button" role="menuitemradio" aria-checked=${String(i===s.id)} @click=${()=>this.pick(s.id)}>${$(s.glyph)}${m(s.label)}${i===s.id?a`<span class="ck">${r("check")}</span>`:n}</button>`)}
    </div>`}controls(e,t){const i=e.kind==="receiver"?a`<button type="button" class="rbtn" aria-label=${`שלט · ${e.name}`} @click=${()=>this.openPlayer()}>${r("remote")}שלט</button>`:a`<button type="button" class="rbtn" aria-label=${`נגן · ${e.name}`} @click=${()=>this.openPlayer()}>נגן${r("music")}</button>`;if(t.kind==="un")return a`<span class="unl">${r("wifiOff")}${t.line}</span><span class="grow"></span>${i}`;if(!e.can.control&&!e.can.power)return n;if(t.kind==="off")return a`<span class="grow"></span>${i}`;const o=e.can.power&&e.caps.sources?a`<button type="button" class=${u({rb:!0,shake:this.shaking==="source"})} aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`מקור: ${e.live.now.label||e.name}`} title="מקור" @click=${()=>void this.toggleMenu()}>${r("input")}</button>`:n;return a`${this.volumeControls(e)}${this.muteButton(e)}${o}<span class="grow"></span>${i}`}bubbleKeys(e,t){const i=this.mainKey(e,t),s=!e.can.control&&!e.can.power,o=a`<button type="button" class="rbtn" aria-label=${`${e.kind==="receiver"?"שלט":"נגן"} · ${e.name}`} @click=${()=>this.openPlayer()}>${r(e.kind==="receiver"?"remote":"music")}</button>`;if(t.kind==="un")return a`<div class="main">${o}</div>`;if(s)return a`<div class="main">${i===n?n:i}</div>`;const p=e.can.control&&e.caps.volume_set&&t.kind!=="off"?a`<button type="button" class="vb" aria-label=${`עוצמה · ${e.name}`} aria-expanded=${String(this.volOpen)} aria-controls="vol" @click=${()=>this.volOpen=!this.volOpen}>${r(e.live.volume.muted?"volOff":"vol")}</button>`:t.kind==="off"?n:this.volumeControls(e),b=e.can.power&&e.caps.sources&&t.kind!=="off"?a`<button type="button" class=${u({rb:!0,shake:this.shaking==="source"})} aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`מקור: ${e.live.now.label||e.name}`} title="מקור" @click=${()=>void this.toggleMenu()}>${r("input")}</button>`:n;return a`<div class="main">${p}${b}${o}${i===n?n:i}</div>`}bubbleSlider(e,t){const i=e.live.volume.level??0,s=x(e),o=this.mainKey(e,t);return a`<div class="vmorph" id="vol" data-volume-morph>
      <sw-pill variant="slider" density="compact" .icon=${e.live.volume.muted,"volume"} label=${e.live.volume.muted?"מושתק":"עוצמה"} .state=${`${i}%${s!==null?` · עד ${s}%`:""}`} .value=${i/100} on keep-text fill-color="var(--sw-accent-soft)" ?unavailable=${this.pending.has("volume")} ?accent=${!!e.live.volume.muted}
        @toggle=${()=>void this.mute()} @icon-click=${()=>void this.mute()} @change=${c=>this.setVolume(c.detail.value*100)}></sw-pill>
      <button type="button" class="rb" aria-label="סגור את העוצמה" data-volume-close @click=${()=>this.volOpen=!1}>${r("close")}</button>
      ${o===n?n:o}
    </div>`}render(){const e=this.device;if(!e)return n;const t=this.leader,i=N(e,t),s=!!i.rgb&&(i.playing||i.paused);if(this.skin.bubble){const v=O(e)?null:E(e),S=[e.live.group.role==="member"||i.kind==="un"?"":e.area_name??"",i.kind==="un"?"לא זמין":i.line].filter(Boolean).join(" · "),B=this.note?a`<small class="bad" role="status">${this.note}</small>`:a`<small>${S}${!this.note&&i.title?a` · ${m(i.title)}`:n}</small>`,K=v?a`<span class=${u({gchip:!0,warn:v.kind==="conflict"})}>${r(v.kind==="conflict"?"warning":"group")}${v.text}</span>`:n,_=this.volOpen&&e.can.control&&e.caps.volume_set&&i.kind!=="off";return a`<article class=${u({pcard:!0,glass:!0,lit:s,paused:i.paused,un:i.kind==="un",morph:_})} aria-label=${e.name} data-device=${e.key} data-kind=${e.kind} data-state=${i.kind} data-group-role=${e.live.group.role} data-leader=${M(e,t)??""}>
        <div class="edit-slot"><slot name="edit" @slotchange=${this.onEditSlot}></slot></div>
        ${_?this.bubbleSlider(e,i):a`${this.cover(e,i)}<div class="tx"><b>${m(e.name)}</b><span class="st">${B}${K}</span></div>${this.editing?n:this.bubbleKeys(e,i)}`}
        ${this.sourceMenu(e)}
      </article>`}const o=this.controls(e,i),c=O(e)?null:E(e),p=[e.live.group.role==="member"||i.kind==="un"?"":e.area_name??"",i.kind==="un"?"לא זמין":i.line].filter(Boolean).join(" · "),b=this.note?a`<small class="bad" role="status">${this.note}</small>`:a`<small>${p}</small>`,y=c?a`<span class=${u({gchip:!0,warn:c.kind==="conflict"})}>${r(c.kind==="conflict"?"warning":"group")}${c.text}</span>`:n,z=!this.note&&i.title?a`<small class="now">${m(i.title)}${i.sub?a` · ${m(i.sub)}`:n}</small>`:n,w=M(e,t);return a`<article class=${u({pcard:!0,glass:!0,lit:s,paused:i.paused,un:i.kind==="un"})} style=${s?`--art:${i.rgb}`:""} aria-label=${e.name} data-device=${e.key} data-kind=${e.kind} data-state=${i.kind} data-group-role=${e.live.group.role} data-leader=${w??""}>
      <span class="gbox" aria-hidden="true">${s?this.art(i):n}</span>
      <div class="edit-slot"><slot name="edit" @slotchange=${this.onEditSlot}></slot></div>
      ${this.cover(e,i)}
      <div class="tx"><b>${m(e.name)}</b><span class="st">${b}${y}</span>${z}</div>
      ${this.editing?n:this.mainKey(e,i)}
      ${o===n?n:a`<div class="sctl" ?inert=${this.editing}>${o}</div>`}
      ${this.sourceMenu(e)}
    </article>`}};l.styles=[R,I`
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
    .pcard {
      position: relative;
      display: grid;
      grid-template-columns: var(--mm-cover-size) minmax(0, 1fr) auto;
      grid-template-areas: 'cov tx main' 'ctl ctl ctl';
      gap: 12px 14px;
      align-items: center;
      padding: 10px 14px 12px 10px;
      padding-inline: 10px 14px;
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
    .pcard > :not(.gbox):not(.pop):not(.edit-slot) {
      position: relative;
      z-index: 1;
    }
    .pcard.lit {
      border-color: rgb(var(--art) / 0.34);
      box-shadow: 0 22px 56px rgb(var(--art) / var(--mm-art-halo-alpha)), var(--dv-shadow-1);
    }
    .pcard.paused .gbox {
      opacity: 0.55;
    }
    @media (hover: hover) and (prefers-reduced-motion: no-preference) {
      :host(:not([editing])) .pcard:not(.un):hover {
        transform: translateY(var(--dv-hover-lift));
        box-shadow: var(--dv-shadow-2);
      }
      :host(:not([editing])) .pcard.lit:hover {
        box-shadow: 0 26px 60px rgb(var(--art) / calc(var(--mm-art-halo-alpha) + 0.08)), var(--dv-shadow-2);
      }
    }
    .pcard.un {
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
    /* POLISH4-WP1 (MEDIA-POLISH-2331 5.2): while editing, the text column keeps clear of the edit chips (measured into --mm-edit-w by
       the edit slot), so a long name ("רמקול חדר אורחים") ends in an ellipsis before the chips instead of running under them */
    :host([editing]) .tx {
      padding-inline-end: var(--mm-edit-w, 0px);
    }
    :host([data-dimmed]) .pcard {
      opacity: 0.45;
    }
    :host([editing]) .pcard {
      outline: 2px dashed color-mix(in srgb, var(--dv-accent) 55%, transparent);
      outline-offset: 4px;
    }
    /* the cover */
    .cov {
      grid-area: cov;
      position: relative;
      display: block;
      inline-size: var(--mm-cover-size);
      block-size: var(--mm-cover-size);
      border-radius: var(--mm-cover-radius);
      overflow: hidden;
      border: 0;
      padding: 0;
      background: var(--mm-screen-off);
      color: var(--sw-on-video);
      cursor: pointer;
      isolation: isolate;
      box-shadow: var(--mm-cover-shadow);
      transition: transform 140ms var(--mm-ease);
    }
    .cov:active {
      transform: scale(0.97);
    }
    .cov::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 5;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
      background: linear-gradient(118deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0) 40%);
      pointer-events: none;
    }
    .cov .ctr {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-3xl);
      z-index: 2;
    }
    .cov .ctr .ic {
      stroke-width: 1.5;
    }
    .cov.off,
    .cov.un,
    .cov.idle {
      box-shadow: none;
    }
    .cov.un {
      background: repeating-linear-gradient(135deg, var(--dv-surface-3) 0 10px, transparent 10px 20px), var(--dv-surface-2);
    }
    .cov .pilld {
      position: absolute;
      inset-block-start: 7px;
      inset-inline-start: 7px;
      z-index: 3;
      block-size: 22px;
      padding-inline: 8px;
      font-size: var(--sw-fs-xs);
    }
    .cov .pb {
      position: absolute;
      inset-inline: 8px;
      inset-block-end: 6px;
      block-size: 3px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.25);
      z-index: 3;
      overflow: hidden;
    }
    .cov .pb i {
      display: block;
      block-size: 100%;
      inline-size: var(--p, 0%);
      background: var(--sw-on-video);
      border-radius: 3px;
    }
    .cov .live {
      position: absolute;
      inset-block-end: 7px;
      inset-inline-start: 8px;
      z-index: 3;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: var(--sw-fs-2xs);
      font-weight: 700;
      color: var(--sw-on-video);
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    }
    .cov .live i {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: var(--sw-danger);
      box-shadow: 0 0 6px var(--sw-danger);
      animation: blink 1.6s ease-in-out infinite;
    }
    @keyframes blink {
      50% {
        opacity: 0.35;
      }
    }
    .cov .pend {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(0, 0, 0, 0.32);
      z-index: 4;
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(3px));
      backdrop-filter: var(--sw-perf-blur, blur(3px));
    }
    .cov .pend i {
      inline-size: 26px;
      block-size: 26px;
      border-radius: 50%;
      border: 3px solid rgba(255, 255, 255, 0.35);
      border-top-color: var(--sw-on-video);
      animation: mm-spin 0.8s linear infinite;
    }
    .cov.rcv {
      background: var(--mm-key-bg);
      color: var(--dv-text);
      box-shadow: var(--mm-key-shadow);
    }
    .cov.rcv .ctr {
      color: var(--dv-text);
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      padding: 8px;
      text-align: center;
      line-height: 1.2;
    }
    .cov.rcv .ctr .ic {
      font-size: var(--sw-fs-3xl);
      color: var(--dv-text-2);
    }
    .cov.rcv .ctr span {
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* name, state, title */
    .tx {
      grid-area: tx;
      align-self: center;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
      line-height: 1.3;
    }
    /* R5-MEDIA-ENERGY-297 (HOMEFABLE type scale): the player name is the card's title - 20 px / 800 in the heading ink */
    .tx b {
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--dv-text));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tx .st {
      display: flex;
      align-items: center;
      gap: 6px 8px;
      min-inline-size: 0;
      flex-wrap: wrap;
    }
    .tx small {
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 0 1 auto;
    }
    .tx small.now {
      color: var(--dv-text);
      font-weight: 500;
      unicode-bidi: plaintext;
      text-align: start;
    }
    .tx small.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
    .gchip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      block-size: 24px;
      padding-inline: 7px 9px;
      border-radius: 999px;
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      white-space: nowrap;
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gchip .ic {
      font-size: var(--sw-fs-base);
    }
    .gchip.warn {
      background: var(--dv-warning-soft);
      color: var(--dv-warning-text);
    }
    .main {
      grid-area: main;
      align-self: center;
    }
    /* play / pause: the dark key of the remote's playback row */
    .pk {
      position: relative;
      flex: none;
      inline-size: 50px;
      block-size: 50px;
      border-radius: 50%;
      border: 0;
      display: grid;
      place-items: center;
      background: var(--dv-text);
      color: var(--mm-text-inverse);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
      transition: transform 120ms var(--mm-ease), background var(--mm-motion), box-shadow var(--mm-motion);
    }
    .pk .ic {
      font-size: var(--sw-fs-3xl);
      stroke-width: 2;
    }
    .pk:active {
      transform: scale(0.92);
    }
    .pk.idle {
      background: var(--mm-key-bg);
      color: var(--dv-text);
      box-shadow: var(--mm-key-shadow);
    }
    .pk[disabled] {
      opacity: 0.38;
      pointer-events: none;
      box-shadow: none;
    }
    .pk.pend::after {
      content: '';
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: var(--dv-accent);
      animation: mm-spin 0.8s linear infinite;
    }
    .pk.nack {
      box-shadow: 0 0 0 3px var(--dv-danger-soft), 0 0 0 1.5px var(--dv-danger);
    }
    .sctl {
      grid-area: ctl;
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
    :host([compact]) .pcard,
    :host([data-size='s']) .pcard {
      gap: 10px 12px;
      padding: 8px 10px 10px 8px;
      padding-inline: 8px 10px;
    }
    :host([compact]) .tx b,
    :host([data-size='s']) .tx b {
      font-size: var(--sw-fs-lg);
    }
    :host([compact]) .pk,
    :host([data-size='s']) .pk {
      inline-size: 46px;
      block-size: 46px;
    }
    :host([compact]) .pop,
    :host([data-size='s']) .pop {
      inset-inline-start: 8px;
    }
    /* ---- the Bubble skin (phase C): the card is a pill row - a round cover ring, the name and the state, the play key and
       the volume button at the end; the volume button MORPHS the row into a slider (mute · slider · % · close · play), as in
       the Bubble Card video. No blur, no shadow: a scrolling list stays cheap on a phone. ---- */
    :host([data-skin='bubble']) .pcard {
      --mm-cover-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas: 'cov tx main';
      gap: 6px 10px;
      padding: 6px 8px;
      min-block-size: calc(var(--sw-pill-h) * var(--sw-look-scale));
      border-radius: var(--sw-r-pill);
      border: 0;
      background: var(--sw-surface);
      box-shadow: none;
      transition: background var(--sw-t-state) var(--sw-ease);
    }
    :host([data-skin='bubble']) .pcard.lit {
      background: var(--sw-lit);
      color: var(--sw-on-lit);
      box-shadow: none;
    }
    :host([data-skin='bubble']) .pcard.lit .tx small,
    :host([data-skin='bubble']) .pcard.lit .tx small.now {
      color: inherit;
      opacity: 0.86;
    }
    :host([data-skin='bubble']) .pcard.paused {
      background: var(--sw-lit-soft);
      color: var(--sw-text);
    }
    :host([data-skin='bubble']) .pcard.paused .gbox,
    :host([data-skin='bubble']) .pcard .gbox {
      display: none;
    }
    :host([data-skin='bubble']) .pcard.un {
      background: var(--sw-surface);
      opacity: 0.6;
      border: 0;
    }
    :host([data-skin='bubble']) .cov {
      min-inline-size: var(--sw-touch-desktop);
      min-block-size: var(--sw-touch-desktop);
      border-radius: 50%;
      box-shadow: none;
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    :host([data-skin='bubble']) .cov::after {
      display: none;
    }
    :host([data-skin='bubble']) .cov .pilld,
    :host([data-skin='bubble']) .cov .pb,
    :host([data-skin='bubble']) .cov .live {
      display: none;
    }
    :host([data-skin='bubble']) .cov .ctr {
      font-size: var(--sw-fs-2xl);
      color: inherit;
    }
    :host([data-skin='bubble']) .cov.rcv .ctr span {
      display: none;
    }
    :host([data-skin='bubble']) .cov.rcv .ctr .ic {
      font-size: var(--sw-fs-2xl);
      color: inherit;
    }
    :host([data-skin='bubble']) .tx b {
      font-size: calc(var(--sw-fs-name) * var(--sw-look-scale));
      font-weight: var(--sw-fw-semibold);
    }
    :host([data-skin='bubble']) .tx small {
      font-size: calc(var(--sw-fs-state) * var(--sw-look-scale));
    }
    :host([data-skin='bubble']) .tx .st {
      flex-wrap: nowrap;
    }
    :host([data-skin='bubble']) .gchip {
      block-size: 22px;
      padding-inline: 8px;
      background: rgba(0, 0, 0, 0.12);
      color: inherit;
    }
    /* the end of the row: play / power, the volume button (morph), mute, source and "נגן" as round sub-buttons */
    :host([data-skin='bubble']) .main {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    :host([data-skin='bubble']) .pk,
    :host([data-skin='bubble']) .pw,
    :host([data-skin='bubble']) .rb,
    :host([data-skin='bubble']) .vb {
      inline-size: calc(var(--sw-sub) * var(--sw-look-scale));
      block-size: calc(var(--sw-sub) * var(--sw-look-scale));
      min-inline-size: var(--sw-touch-desktop);
      min-block-size: var(--sw-touch-desktop);
      box-shadow: none;
      border: 0;
      border-radius: 50%;
      display: grid;
      place-items: center;
      padding: 0;
    }
    :host([data-skin='bubble']) .pk {
      background: var(--sw-text);
      color: var(--sw-bg);
    }
    :host([data-skin='bubble']) .pk .ic {
      font-size: var(--sw-fs-2xl);
    }
    :host([data-skin='bubble']) .pcard.lit .pk {
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
    }
    :host([data-skin='bubble']) .pk.idle,
    :host([data-skin='bubble']) .pw,
    :host([data-skin='bubble']) .rb,
    :host([data-skin='bubble']) .vb {
      background: rgba(0, 0, 0, 0.1);
      color: inherit;
    }
    :host([data-skin='bubble']) .pw.on {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: none;
    }
    :host([data-skin='bubble']) .rb.muted {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      box-shadow: none;
    }
    :host([data-skin='bubble']) .vb[aria-expanded='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    :host([data-skin='bubble']) .sctl {
      display: none;
    }
    :host([data-skin='bubble']) .main .rbtn {
      min-block-size: var(--sw-touch-desktop);
      border: 0;
      border-radius: var(--sw-r-pill);
      background: rgba(0, 0, 0, 0.1);
      color: inherit;
      box-shadow: none;
      padding-inline: 12px;
    }
    /* the morph: the whole row becomes mute · the slider pill · close · the main key */
    :host([data-skin='bubble']) .vmorph {
      grid-column: 1 / -1;
      grid-row: 1;
      min-inline-size: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    :host([data-skin='bubble']) .vmorph sw-pill {
      flex: 1 1 120px;
      min-inline-size: 0;
      --pill-base: rgba(0, 0, 0, 0.1);
      --sw-pill-h: 44px;
    }
    :host([data-skin='bubble']) .pcard.morph .cov {
      display: none;
    }
    :host([data-skin='bubble']) .pop {
      border: 0;
      border-radius: var(--sw-r-lg);
      /* the player's menu is never see-through (owner 2026-10-13): the skin's opaque menu surface, nothing blurred behind it */
      background: var(--sw-menu-surface);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      box-shadow: var(--sw-shadow-3);
    }
    @media (max-width: 1100px) {
      :host([data-skin='bubble']) .pk,
      :host([data-skin='bubble']) .pw,
      :host([data-skin='bubble']) .rb,
      :host([data-skin='bubble']) .vb {
        min-inline-size: 44px;
        min-block-size: 44px;
      }
      :host([data-skin='bubble']) .cov {
        min-inline-size: 44px;
        min-block-size: 44px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host([data-skin='bubble']) .pcard {
        transition: none;
      }
    }
  `];d([k({attribute:!1})],l.prototype,"device",2);d([k({reflect:!0,attribute:"data-size"})],l.prototype,"size",2);d([k({type:Boolean,reflect:!0})],l.prototype,"compact",2);d([k({type:Boolean,reflect:!0})],l.prototype,"editing",2);d([k({type:Boolean,reflect:!0,attribute:"data-dimmed"})],l.prototype,"dimmed",2);d([k({attribute:!1})],l.prototype,"leader",2);d([h()],l.prototype,"pending",2);d([h()],l.prototype,"nack",2);d([h()],l.prototype,"note",2);d([h()],l.prototype,"shaking",2);d([h()],l.prototype,"menu",2);d([h()],l.prototype,"detail",2);d([h()],l.prototype,"detailBusy",2);d([h()],l.prototype,"volOpen",2);l=d([T("media-player-card")],l);
//# sourceMappingURL=media-player-card-C9cWOeHi.js.map
