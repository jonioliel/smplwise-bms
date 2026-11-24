import{g as ie,v as $,i as U,A as d,kG as D,b as o,cC as r,k as F,j as v,gn as j,hI as k,a7 as ae,b8 as le,n as N,a6 as ce,fa as H,bg as I,eE as de,kH as pe,br as q,kI as he,iU as ue,d6 as ve,hE as me,hF as _,hG as fe,bZ as be,a as ge,ab as C,d7 as we,cM as O,gm as Y}from"./index-c_ii2C2N.js";import{K as oe,a as g,I as z,r as re,b as ye,S as P,s as $e,t as ke,c as E,g as ne,C as G,d as R,k as X,i as xe,v as K,e as _e,f as M,h as A,p as Ee,j as ze,l as De,n as Te,m as V,u as Ce,o as W,q as Z,w as Oe,x as Pe,y as J,z as Q,A as Ke,X as Se,B as Le,D as Be,N as ee,E as Re}from"./media-player-panel-BdbaMgQi.js";import{i as Me,a as Ae}from"./media-integration-names-Bvaj4WHf.js";import{t as c}from"./media-ChiRjfra.js";import{l as te}from"./live-DMqV6qVh.js";import"./sw-logo-art-PLtEZJxU.js";var Ie=Object.defineProperty,Ue=Object.getOwnPropertyDescriptor,B=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ue(t,s):t,n=e.length-1,l;n>=0;n--)(l=e[n])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Ie(t,s,a),a};let T=class extends U{constructor(){super(...arguments),this.keys=[],this.mode="dpad",this.disabled=!1,this.press=new oe(e=>this.send(e)),this.touchStart=null,this.has=e=>this.keys.includes(e),this.onTouchDown=e=>{this.touchStart={x:e.clientX,y:e.clientY};try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}},this.onTouchUp=e=>{const t=this.touchStart;if(this.touchStart=null,!t)return;const s=e.clientX-t.x,i=e.clientY-t.y,a=this.swipeKey(s,i);a&&this.has(a)&&this.touchFx(a)},this.onTouchKey=e=>{const s={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",Enter:"ok"," ":"ok"}[e.key];!s||!this.has(s)||(e.preventDefault(),e.stopPropagation(),e.repeat||this.touchFx(s))}}disconnectedCallback(){super.disconnectedCallback(),this.press.stopAll()}stop(){this.press.stopAll()}send(e){if(!this.disabled){this.dispatchEvent(new CustomEvent("mr-key",{detail:{key:e},bubbles:!0,composed:!0})),this.flashKey(e);try{navigator.vibrate?.(8)}catch{}}}flashKey(e){const t=this.renderRoot.querySelector(`[data-k="${e}"]`);t&&(t.classList.remove("hit"),t.offsetWidth,t.classList.add("hit"),window.setTimeout(()=>t.classList.remove("hit"),180))}arrow(e){return this.has(e)?o`<button type="button" class="dk ${e}" data-k=${e} aria-label=${g[e]}
      @pointerdown=${t=>this.press.down(t,e)} @pointerup=${()=>this.press.up()} @pointercancel=${()=>this.press.up()} @pointerleave=${()=>this.press.up()} @blur=${()=>this.press.up()}
      @keydown=${t=>this.press.keyDown(t,e)} @keyup=${t=>this.press.keyUp(t,e)} @click=${t=>this.press.click(t,e)}
      @contextmenu=${t=>t.preventDefault()}><svg viewBox="0 0 24 24" aria-hidden="true">${D(z[e])}</svg></button>`:d}swipeKey(e,t){return Math.hypot(e,t)<14?"ok":Math.abs(e)>Math.abs(t)?e>0?"right":"left":t>0?"down":"up"}touchFx(e){this.send(e);const t=this.renderRoot.querySelector(".fx");t&&(t.innerHTML=e==="ok"?"OK":`<svg viewBox="0 0 24 24" aria-hidden="true">${z[e]}</svg>`,t.classList.add("show"),window.setTimeout(()=>t.classList.remove("show"),60))}render(){return this.mode==="touch"?o`<div class="tpad" tabindex="0" role="application" aria-label=${r("משטח מגע: החלקה לכיוון, הקשה לאישור")}
        @pointerdown=${this.onTouchDown} @pointerup=${this.onTouchUp} @pointercancel=${()=>this.touchStart=null} @keydown=${this.onTouchKey}>
        <span class="hint"><svg viewBox="0 0 24 24" aria-hidden="true">${D(z.touch)}</svg><span>${r("החלקה · הקשה")}</span></span><span class="fx" aria-hidden="true"></span></div>`:o`<div class="dpad" role="group" aria-label=${r("חצים")}>
      ${this.arrow("up")}${this.arrow("left")}
      ${this.has("ok")?o`<button type="button" class="ok" data-k="ok" aria-label=${g.ok}
            @pointerdown=${e=>this.press.down(e,"ok")} @pointerup=${()=>this.press.up()} @pointercancel=${()=>this.press.up()} @pointerleave=${()=>this.press.up()} @blur=${()=>this.press.up()}
            @keydown=${e=>this.press.keyDown(e,"ok")} @keyup=${e=>this.press.keyUp(e,"ok")} @click=${e=>this.press.click(e,"ok")}
            @contextmenu=${e=>e.preventDefault()}>OK</button>`:d}
      ${this.arrow("right")}${this.arrow("down")}</div>`}};T.styles=ie`
      :host {
        display: block;
        direction: ltr; /* the pad is geometry: never mirrored */
        inline-size: var(--mr-dpad-size);
        block-size: var(--mr-dpad-size);
        -webkit-touch-callout: none;
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
      }
      :host([disabled]) {
        pointer-events: none;
      }
      .dpad {
        position: relative;
        inline-size: var(--mr-dpad-size);
        block-size: var(--mr-dpad-size);
        border-radius: 50%;
        background: var(--mr-dpad-ring);
        box-shadow: var(--mr-dpad-shadow);
      }
      .dpad::before {
        content: '';
        position: absolute;
        inset: 9px;
        border-radius: 50%;
        border: 1px solid var(--mr-border);
        pointer-events: none;
      }
      .dpad::after {
        content: '';
        position: absolute;
        inset: calc(50% - var(--mr-ok-size) * 0.625);
        border-radius: 50%;
        box-shadow: var(--mr-dpad-groove);
        pointer-events: none;
      }
      .dk {
        position: absolute;
        inline-size: 64px;
        block-size: 64px;
        border-radius: 50%;
        border: 0;
        padding: 0;
        background: transparent;
        display: grid;
        place-items: center;
        color: var(--mr-text-2);
        transition: color var(--sw-t-hover), background var(--mr-motion) var(--mr-ease);
        z-index: 1;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .dk svg {
        inline-size: 24px;
        block-size: 24px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .dk.up { inset-block-start: 6px; inset-inline-start: calc(50% - 32px); }
      .dk.down { inset-block-end: 6px; inset-inline-start: calc(50% - 32px); }
      .dk.left { inset-inline-start: 6px; inset-block-start: calc(50% - 32px); }
      .dk.right { inset-inline-end: 6px; inset-block-start: calc(50% - 32px); }
      .dk:hover {
        color: var(--mr-text);
      }
      .dk:active,
      .dk.hit {
        color: var(--mr-accent);
        background: radial-gradient(circle, var(--mr-accent-soft) 0, transparent 70%);
      }
      .ok {
        position: absolute;
        inset: 0;
        margin: auto;
        inline-size: var(--mr-ok-size);
        block-size: var(--mr-ok-size);
        border-radius: 50%;
        border: 0;
        padding: 0;
        background: var(--mr-ok-bg);
        color: var(--mr-text);
        font: inherit;
        font-weight: 700;
        font-size: var(--sw-fs-xl);
        letter-spacing: 0.06em;
        box-shadow: var(--mr-key-shadow), 0 10px 22px rgba(0, 0, 0, 0.1);
        z-index: 2;
        cursor: pointer;
        transition: transform var(--sw-t-press) var(--mr-ease), box-shadow var(--mr-motion) var(--mr-ease), color var(--sw-t-med);
        -webkit-tap-highlight-color: transparent;
      }
      .ok:active,
      .ok.hit {
        transform: scale(0.95);
        color: var(--mr-accent);
        box-shadow: var(--mr-key-shadow), 0 0 0 6px var(--mr-accent-soft), 0 0 30px var(--mr-accent-glow);
      }
      .dk:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: -6px;
      }
      .ok:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 3px;
      }
      .tpad {
        position: relative;
        inline-size: var(--mr-dpad-size);
        block-size: var(--mr-dpad-size);
        border-radius: var(--sw-r-2xl);
        background: var(--mr-dpad-ring);
        box-shadow: var(--mr-dpad-groove), 0 0 0 1px var(--mr-border);
        display: grid;
        place-items: center;
        color: var(--mr-text-2);
        font-size: var(--sw-fs-sm);
        touch-action: none;
        cursor: grab;
      }
      .tpad:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 3px;
      }
      .tpad .hint {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        pointer-events: none;
      }
      .tpad .hint svg {
        inline-size: 26px;
        block-size: 26px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .tpad .fx {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--mr-accent);
        opacity: 0;
        transition: opacity var(--sw-t-med);
        font-weight: 700;
        font-size: var(--sw-fs-3xl);
        pointer-events: none;
      }
      .tpad .fx svg {
        inline-size: 44px;
        block-size: 44px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .tpad .fx.show {
        opacity: 1;
        transition: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .dk,
        .ok,
        .tpad .fx {
          transition: none;
        }
      }
  `;B([$({attribute:!1})],T.prototype,"keys",2);B([$({reflect:!0})],T.prototype,"mode",2);B([$({type:Boolean,reflect:!0})],T.prototype,"disabled",2);T=B([F("media-remote-pad")],T);var Fe=Object.defineProperty,je=Object.getOwnPropertyDescriptor,w=(e,t,s,i)=>{for(var a=i>1?void 0:i?je(t,s):t,n=e.length-1,l;n>=0;n--)(l=e[n])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Fe(t,s,a),a};const L=e=>({id:e.id,orig:e.default_label??e.label,label:e.label,hidden:e.hidden===!0,kind:e.kind,glyph:e.glyph,hue:e.hue}),se={antenna:c("טלוויזיה"),hdmi:c("כניסה"),gamepad:c("משחקים"),speaker:c("שמע"),image:c("תמונות"),film:c("סרטים"),playRect:c("וידאו"),sparkle:c("כוכב"),music:c("מוזיקה"),ball:c("ספורט"),news:c("חדשות"),smile:c("ילדים"),globe:c("רשת"),app:c("כללי")},Ne={power:c("הפעלה"),volume:c("עוצמה"),mute:c("השתקה"),sources:c("מקורות"),apps:c("אפליקציות"),keys:c("מקשים"),now_playing:c("מה מתנגן")},He={vendor:c("חיבור ראשי"),remote:c("שלט"),cast:c("הקרנה"),dlna:c("רשת ביתית"),smartthings:c("ענן"),ma_export:c("נגן מוזיקה"),ma_import:c("נגן מוזיקה"),ma_native:c("נגן מוזיקה"),ma_universal:c("נגן מוזיקה"),other:c("אחר")},y=(e,t)=>o`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${D(t??z[e]??"")}</svg>`;let b=class extends U{constructor(){super(...arguments),this.canConfigure=!1,this.scope="device",this.cfg=j,this.sources=[],this.apps=[],this.busy=!1,this.error="",this.conns=null,this.dragFrom=null,this.defaultCfg=null,this.listsTouched=!1}willUpdate(e){e.has("device")&&this.device&&(this.fromDevice(),this.loadCuration(this.device.key))}connectedCallback(){super.connectedCallback(),this.canConfigure&&this.loadConns()}updated(e){e.has("canConfigure")&&this.canConfigure&&!this.conns&&this.loadConns()}fromDevice(){const e=this.device;this.cfg={sections:e.remote.sections.map(t=>({...t})),more:[...e.remote.more],scope:e.remote.scope},this.scope="device",this.listsTouched=!1,this.sources=e.sources.map(L),this.apps=e.apps.map(L)}async loadCuration(e){try{const t=await k().get(e,{curation:!0});if(e!==this.device?.key||this.listsTouched)return;this.sources=t.sources.map(L),this.apps=t.apps.map(L)}catch{}}async loadConns(){if(!ae()){const e=this.device?.profile??"generic";this.conns=e==="generic"?[{platform:"media_player",role:"vendor",hidden:!1,primary_for:["power","volume","mute","sources","now_playing"]}]:[{platform:e==="android_tv"?"androidtv_remote":e==="lg_webos"?"webostv":"samsungtv_smart",role:"vendor",hidden:!1,primary_for:["power","keys","sources","apps"]},{platform:"cast",role:"cast",hidden:!0,primary_for:["now_playing"]}];return}try{const e=await le("multimedia/admin/devices");this.conns=e.devices.find(t=>t.key===this.device.key)?.endpoints??[]}catch{this.conns=[]}}async setScope(e){if(e!==this.scope)if(this.scope=e,e==="default"){try{this.defaultCfg??=await k().remoteDefault()}catch{this.defaultCfg={...j,scope:"default"}}this.cfg={sections:this.defaultCfg.sections.map(t=>({...t})),more:[...this.defaultCfg.more],scope:"default"}}else this.fromDevice()}available(e){if(this.scope==="default")return!0;const t=this.device.caps,s=(...i)=>i.some(a=>t.keys.includes(a));switch(e){case"recent":return t.sources||t.apps;case"vol":return t.volume_set||t.volume_step||t.mute;case"pbk":return t.transport.play||t.transport.pause;case"text":return t.text;case"touch":return t.touchpad;case"nav":return s("back","home","menu");case"dpad":return s("up","down","left","right","ok");case"ch":return s("chup","chdown");case"nums":return s("n0","n1","n2","n3","n4","n5","n6","n7","n8","n9");case"colors":return s("red","green","yellow","blue");case"xtra":return s("exit","info","guide","source","tools","settings","chlist","prech")}}move(e,t,s){const i=[...e],[a]=i.splice(t,1);return i.splice(Math.max(0,Math.min(i.length,s)),0,a),i}moveIn(e,t,s){t===s||s<0||(e==="sections"?this.cfg=ye(this.cfg,this.cfg.sections[t].id,s):(this.listsTouched=!0,e==="sources"?this.sources=this.move(this.sources,t,s):this.apps=this.move(this.apps,t,s)))}drag(e,t){return{start:s=>{this.dragFrom={list:e,index:t},s.dataTransfer?.setData("text/plain",`${e}:${t}`),s.dataTransfer&&(s.dataTransfer.effectAllowed="move")},over:s=>this.dragFrom?.list===e&&s.preventDefault(),drop:s=>{s.preventDefault();const i=this.dragFrom;this.dragFrom=null,i&&i.list===e&&this.moveIn(e,i.index,t)}}}body(){const e=t=>t.map(s=>({id:s.id,label:s.label.trim()&&s.label.trim()!==s.orig?s.label.trim().slice(0,40):null,hidden:s.hidden,kind:s.kind,glyph:s.glyph}));return{remote:{sections:this.cfg.sections,more:this.cfg.more},sources:e(this.sources),apps:e(this.apps).map(({kind:t,...s})=>s)}}async save(){this.busy=!0,this.error="";try{if(this.scope==="default")await k().saveRemoteDefault({...this.cfg,scope:"default"}),this.dispatchEvent(new CustomEvent("editor-done",{detail:{},bubbles:!0,composed:!0}));else{const e=await k().saveDeviceRemote(this.device.key,this.body());this.dispatchEvent(new CustomEvent("editor-done",{detail:{detail:e},bubbles:!0,composed:!0}))}}catch(e){this.error=N(e)}finally{this.busy=!1}}async resetDevice(){this.busy=!0,this.error="";try{const e=await k().saveDeviceRemote(this.device.key,{remote:null});this.dispatchEvent(new CustomEvent("editor-done",{detail:{detail:e},bubbles:!0,composed:!0}))}catch(e){this.error=N(e)}finally{this.busy=!1}}cancel(){this.dispatchEvent(new CustomEvent("editor-done",{detail:{},bubbles:!0,composed:!0}))}sectionRows(){const e=this.cfg.sections.map((t,s)=>({s:t,index:s})).filter(({s:t})=>this.available(t.id));return e.map(({s:t,index:s},i)=>{const a=this.drag("sections",s),n=this.cfg.more.includes(t.id);return o`<div class="row ${t.on?"":"off"}" data-ed-section=${t.id} draggable="true" @dragstart=${a.start} @dragover=${a.over} @drop=${a.drop}>
        <span class="grip" aria-hidden="true">${y("grip")}</span><span class="nm">${P[t.id]}</span>
        <label class="fold"><sw-toggle size="sm" labelHidden in-label data-ed-fold .checked=${n} ?disabled=${!t.on} label=${c('מאחורי "עוד מקשים": {name}',{name:P[t.id]})} @change=${l=>this.cfg=$e(this.cfg,t.id,ce(l))}></sw-toggle>${c("מקופל")}</label>
        <button type="button" class="ib" aria-label=${c("הקדם: {name}",{name:P[t.id]})} ?disabled=${i===0} @click=${()=>this.moveIn("sections",s,e[i-1].index)}>${y("up")}</button>
        <button type="button" class="ib" aria-label=${c("אחר: {name}",{name:P[t.id]})} ?disabled=${i===e.length-1} @click=${()=>this.moveIn("sections",s,e[i+1].index)}>${y("down")}</button>
        <sw-toggle .checked=${te(t.on)} label=${c("הצג: {name}",{name:P[t.id]})} labelHidden @change=${H(t.on,()=>this.cfg=ke(this.cfg,t.id,!t.on))}></sw-toggle>
      </div>`})}itemRows(e){const t=e==="sources"?this.sources:this.apps,s=a=>(this.listsTouched=!0,e==="sources"?this.sources=a:this.apps=a),i=(a,n)=>s(t.map((l,h)=>h===a?{...l,...n}:l));return I(t,a=>a.id,(a,n)=>{const l=this.drag(e,n),h=E(a.hue);return o`<div class="row ${a.hidden?"off":""}" data-ed-item=${a.id} draggable="true" @dragstart=${l.start} @dragover=${l.over} @drop=${l.drop}>
        <span class="grip" aria-hidden="true">${y("grip")}</span>
        <span class=${a.kind==="app"?"gi":"gi src"} style=${a.kind==="app"?`--a1:${h.a1};--a2:${h.a2}`:""}>${y("",ne(a.glyph))}</span>
        <input type="text" .value=${a.label} maxlength="40" placeholder=${a.orig} aria-label=${c("שם: {orig}",{orig:a.orig})} @input=${f=>i(n,{label:f.target.value})} />
        <select aria-label=${c("סמל: {orig}",{orig:a.orig})} @change=${f=>i(n,{glyph:f.target.value})}>${Object.keys(se).map(f=>o`<option value=${f} ?selected=${a.glyph===f}>${se[f]}</option>`)}</select>
        <button type="button" class="ib" aria-label=${c("הקדם: {orig}",{orig:a.orig})} ?disabled=${n===0} @click=${()=>this.moveIn(e,n,n-1)}>${y("up")}</button>
        <button type="button" class="ib" aria-label=${c("אחר: {orig}",{orig:a.orig})} ?disabled=${n===t.length-1} @click=${()=>this.moveIn(e,n,n+1)}>${y("down")}</button>
        <sw-toggle .checked=${te(!a.hidden)} label=${c("הצג: {orig}",{orig:a.orig})} labelHidden @change=${H(!a.hidden,()=>i(n,{hidden:!a.hidden}))}></sw-toggle>
      </div>`})}render(){if(!this.device)return d;const e=this.scope==="device";return o`<div class="ed" data-mr-editor>
      <div class="bar"><span class="t">${y("edit")}${c("עריכת השלט")}</span>
        <button type="button" class="btn quiet" data-ed-cancel ?disabled=${this.busy} @click=${()=>this.cancel()}>${c("ביטול")}</button>
        <button type="button" class="btn primary" data-ed-save ?disabled=${this.busy} @click=${()=>void this.save()}>${y("check")}${c("שמירה")}</button></div>
      ${this.error?o`<div class="err" role="alert">${this.error}</div>`:d}
      <sw-segmented radio block size="sm" label=${c("היקף השינוי")} value=${e?"device":"default"}
        @change=${t=>void this.setScope(t.detail.value==="default"?"default":"device")}
        .options=${[{value:"device",label:c("למסך הזה"),attrs:{"data-ed-scope":"device"}},{value:"default",label:c("ברירת מחדל לכל המסכים"),attrs:{"data-ed-scope":"default"}}]}></sw-segmented>
      <div class="grp"><h4>${c("חלקי השלט")}</h4>${this.sectionRows()}</div>
      ${e&&this.sources.length?o`<div class="grp"><h4>${c("מקורות · סדר, שם והצגה")}</h4>${this.itemRows("sources")}</div>`:d}
      ${e&&this.apps.length?o`<div class="grp"><h4>${c("אפליקציות · סדר, שם והצגה")}</h4>${this.itemRows("apps")}</div>`:d}
      ${e&&this.canConfigure&&this.conns?.length?o`<div class="grp"><h4>${c("חיבורים")}</h4><div class="conn" data-ed-conns>${this.conns.map(t=>o`<span>${t.primary_for.map(s=>Ne[s]??s).join(", ")||(t.hidden?c("מוסתר"):"—")}</span><span>${He[t.role]??t.role} · <bdi title=${Me(t.platform)}>${Ae(t.platform)}</bdi></span>`)}</div></div>`:d}
      ${e&&this.device.remote.scope==="device"?o`<button type="button" class="btn quiet" data-ed-reset ?disabled=${this.busy} @click=${()=>void this.resetDevice()}>${c("חזרה לברירת המחדל")}</button>`:d}
    </div>`}};b.styles=[re,ie`
      :host {
        display: block;
      }
      svg.ic {
        inline-size: 1em;
        block-size: 1em;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
        flex: none;
        vertical-align: middle;
      }
      .ed {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      /* MEDIA-POLISH-2331: the bar with "ביטול" / "שמירה" sticks to the top of the remote while a long list of sources and apps
         scrolls under it (save was out of sight after the first screen of rows); it is opaque, so the rows never show through */
      .bar {
        position: sticky;
        inset-block-start: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 10px 10px 10px 14px;
        border-radius: var(--sw-r-2xl);
        background: var(--mr-sheen), var(--mr-surface-solid);
        border: 1px solid color-mix(in srgb, var(--mr-accent) 45%, transparent);
        box-shadow: 0 0 0 4px var(--mr-accent-soft);
      }
      .bar .t {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: var(--sw-fw-bold);
        font-size: var(--sw-fs-lg);
      }
      .bar .t .ic {
        color: var(--mr-accent-text);
        font-size: var(--sw-fs-xl);
      }
      .grp {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .grp h4 {
        margin: 6px 4px 0;
        font-size: var(--sw-fs-sm);
        color: var(--mr-text-2);
        font-weight: var(--sw-fw-semibold);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        min-block-size: 52px;
        border-radius: var(--sw-r-lg);
        background: var(--mr-surface-2);
        border: 1px solid var(--mr-border);
        font-size: var(--sw-fs-md);
      }
      .row.off .nm,
      .row.off .gi {
        opacity: 0.5;
      }
      .row.drag {
        opacity: 0.5;
      }
      .grip {
        color: var(--mr-text-2);
        cursor: grab;
        font-size: var(--sw-fs-lg);
        display: grid;
        place-items: center;
        inline-size: 24px;
        flex: none;
      }
      .nm {
        flex: 1;
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ib {
        flex: none;
        inline-size: 36px;
        block-size: 36px;
        border-radius: 50%;
        border: 0;
        background: var(--mr-surface-3);
        color: var(--mr-text);
        display: grid;
        place-items: center;
      }
      .ib .ic {
        font-size: var(--sw-fs-lg);
      }
      .ib[disabled] {
        opacity: 0.35;
      }
      .fold {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--sw-fs-sm);
        color: var(--mr-text-2);
        min-block-size: 36px;
      }
      .fold input {
        inline-size: 18px;
        block-size: 18px;
        accent-color: var(--mr-accent);
      }
      .row .gi {
        inline-size: 34px;
        block-size: 34px;
        border-radius: var(--sw-r-md);
      }
      .row .gi .ic {
        font-size: var(--sw-fs-lg);
      }
      .row input[type='text'],
      .row select {
        flex: 1;
        min-inline-size: 0;
        block-size: 38px;
        border-radius: var(--sw-r-md);
        border: 1px solid var(--mr-border);
        background: var(--mr-surface);
        color: var(--mr-text);
        padding: 0 10px;
        font: inherit;
        font-size: var(--sw-fs-base);
      }
      .row select {
        flex: none;
        inline-size: 92px;
      }
      .conn {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 6px 14px;
        font-size: var(--sw-fs-base);
        padding: 12px 14px;
        border-radius: var(--sw-r-lg);
        background: var(--mr-surface-3);
      }
      .conn span:nth-child(odd) {
        color: var(--mr-text-2);
      }
      .conn bdi {
        direction: ltr;
        unicode-bidi: isolate;
        font-family: var(--sw-font-mono);
        font-size: var(--sw-fs-sm);
      }
      /* keyboard: the order buttons, the switches, the fold box and the fields show where the focus is */
      .ib:focus-visible,
      .fold input:focus-visible,
      .row input[type='text']:focus-visible,
      .row select:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 2px;
      }
      .ib {
        cursor: pointer;
        transition: transform var(--sw-t-press) var(--sw-ease-out), background var(--mr-motion);
      }
      .ib:active:not([disabled]) {
        transform: scale(var(--sw-press-scale, 0.97));
      }
      .ib[disabled] {
        cursor: default;
      }
      /* touch: 44 px targets; on a narrow remote a source / app row puts its name field on a line of its own */
      @media (pointer: coarse) {
        .ib {
          inline-size: 44px;
          block-size: 44px;
        }
        .fold {
          min-block-size: 44px;
        }
        .row input[type='text'],
        .row select {
          block-size: 44px;
        }
      }
      @media (max-width: 480px) {
        .row[data-ed-item] {
          flex-wrap: wrap;
        }
        .row[data-ed-item] input[type='text'] {
          order: 10;
          flex: 1 1 100%;
        }
      }
      .err {
        color: var(--mr-danger);
        font-size: var(--sw-fs-base);
        font-weight: var(--sw-fw-semibold);
        padding: 0 4px;
      }
    `];w([$({attribute:!1})],b.prototype,"device",2);w([$({type:Boolean})],b.prototype,"canConfigure",2);w([v()],b.prototype,"scope",2);w([v()],b.prototype,"cfg",2);w([v()],b.prototype,"sources",2);w([v()],b.prototype,"apps",2);w([v()],b.prototype,"busy",2);w([v()],b.prototype,"error",2);w([v()],b.prototype,"conns",2);b=w([F("media-remote-editor")],b);var qe=Object.defineProperty,Ye=Object.getOwnPropertyDescriptor,m=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ye(t,s):t,n=e.length-1,l;n>=0;n--)(l=e[n])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&qe(t,s,a),a};const p=e=>o`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${D(z[e]??"")}</svg>`,Ge=4e3,Xe=600,Ve=250;let u=class extends U{constructor(){super(...arguments),this.deviceKey="",this.open=!1,this.scheme="",this.kind="",this.detail=null,this.phase="loading",this.tab="pad",this.more=!1,this.pad="dpad",this.audio=null,this.pend=new Set,this.notice="",this.shaking=!1,this.volDraft=null,this.typed="",this.chbuf="",this.editing=!1,this.nowMs=Date.now(),this.status=null,this.gate=new G,this.press=new oe(e=>this.onKey(e)),this.token=0,this.poll=new de(this),this.tickTimer=0,this.noticeTimer=0,this.volTimer=0,this.chTimer=0,this.refreshTimer=0,this.offEdit=null,this.openedOnce=!1,this.onBlur=()=>{(document.visibilityState==="hidden"||!document.hasFocus())&&(this.press.stopAll(),this.pad_()?.stop())},this.onClose=()=>{this.isPlayer||(this.open=!1)},this.onPanelClose=()=>{this.open=!1},this.onDown=e=>{const t=this.keyOf(e);if(!t)return;this.press.down(e,t.key),this.flashEl(t.el);try{navigator.vibrate?.(8)}catch{}const s=()=>{this.press.up(),window.removeEventListener("pointerup",s),window.removeEventListener("pointercancel",s)};window.addEventListener("pointerup",s),window.addEventListener("pointercancel",s)},this.onClick=e=>{const t=this.keyOf(e);t&&this.press.click(e,t.key)},this.onKeyDown=e=>{const t=this.keyOf(e);t&&this.press.keyDown(e,t.key)},this.onKeyUp=e=>{const t=this.keyOf(e);t&&this.press.keyUp(e,t.key)},this.onDocKeyDown=e=>{if(!this.open||this.editing||!this.detail||R(this.detail)!=="on")return;const t=e.composedPath()[0],s=X({key:e.key,ctrlKey:e.ctrlKey,altKey:e.altKey,metaKey:e.metaKey,repeat:e.repeat,target:t?{tagName:t.tagName,isContentEditable:t.isContentEditable}:null});if(!s||!this.detail.caps.keys.includes(s)&&!["volup","voldown","mute"].includes(s)||!this.detail.can.control)return;e.preventDefault(),this.press.global(s,!0,e.repeat);const i=this.renderRoot.querySelector(`[data-key="${s}"]`);i&&!e.repeat&&this.flashEl(i)},this.onDocKeyUp=e=>{const t=X({key:e.key});t&&xe(t)?this.press.global(t,!1):t&&this.press.global(t,!1)},this.onPadKey=e=>{e.stopPropagation(),this.onKey(e.detail.key)},this.onVolume=e=>{const t=Number(e.target.value);this.volDraft=t,window.clearTimeout(this.volTimer),this.volTimer=window.setTimeout(()=>{const s=this.detail,i=s?.audio_link?K(s,this.audio):void 0;this.exec({command:"volume_set",level:t,target:i})},Ve)},this.onText=e=>{const t=e.target,s=_e(t.value);s!==t.value&&(t.value=s),this.typed=s},this.onEditorDone=e=>{this.editing=!1,e.detail?.detail?this.applyDetail(e.detail.detail):this.load(!1)}}connectedCallback(){super.connectedCallback(),this.hasAttribute("data-devices-scheme")||this.setAttribute("data-devices-scheme","light"),pe(this)}disconnectedCallback(){super.disconnectedCallback(),this.end(),this.offEdit?.(),this.offEdit=null}willUpdate(e){e.has("deviceKey")&&e.get("deviceKey")!==void 0&&(e.has("kind")||(this.kind=""),this.resetForDevice())}get isPlayer(){return this.kind!==""&&this.kind!=="screen"}updated(e){e.has("kind")&&this.isPlayer&&this.end(),!this.isPlayer&&((e.has("open")||e.has("deviceKey"))&&(this.open&&this.deviceKey?this.begin():this.open||this.end()),this.syncGlow())}resetForDevice(){this.detail=null,this.phase="loading",this.tab="pad",this.more=!1,this.audio=null,this.pend=new Set,this.notice="",this.volDraft=null,this.typed="",this.chbuf="",this.gate=new G,this.press.stopAll()}begin(){this.openedOnce||(this.openedOnce=!0,this.registerEdit()),this.scheme?q(this,this.scheme):he().then(e=>q(this,e.scheme)),k().status().then(e=>this.status=e).catch(()=>{}),this.load(!0),this.poll.every("state",Ge,()=>this.load(!1),{when:()=>this.pend.size===0&&!this.editing}),window.clearInterval(this.tickTimer),this.tickTimer=window.setInterval(()=>{this.detail?.live.play==="playing"&&(this.nowMs=Date.now())},1e3),document.addEventListener("keydown",this.onDocKeyDown,!0),document.addEventListener("keyup",this.onDocKeyUp,!0),window.addEventListener("blur",this.onBlur),document.addEventListener("visibilitychange",this.onBlur)}end(){this.poll.cancel("state"),window.clearInterval(this.tickTimer),window.clearTimeout(this.noticeTimer),window.clearTimeout(this.volTimer),window.clearTimeout(this.chTimer),window.clearTimeout(this.refreshTimer),this.token++,this.press.stopAll(),this.pad_()?.stop(),document.removeEventListener("keydown",this.onDocKeyDown,!0),document.removeEventListener("keyup",this.onDocKeyUp,!0),window.removeEventListener("blur",this.onBlur),document.removeEventListener("visibilitychange",this.onBlur),this.pend=new Set,this.gate.powerDone(),this.editing=!1}pad_(){return this.renderRoot.querySelector("media-remote-pad")}registerEdit(){this.offEdit?.(),this.offEdit=ue({id:"multimedia-remote",label:r("עריכת השלט"),icon:"edit",can:()=>!!this.deviceKey&&this.status?.can.layout===!0&&!this.editing,run:()=>{this.editing=!0,this.open||(this.open=!0,this.dispatchEvent(new CustomEvent("media-remote-open",{detail:{key:this.deviceKey},bubbles:!0,composed:!0})))}})}syncGlow(){const e=this.detail;let t="107 119 136";if(e&&(e.live.power==="on"||e.live.power==="art")){const s=e.live.now;t=s.kind==="art"?"214 160 104":s.kind==="saver"?"70 92 170":s.kind==="channel"||s.kind==="source"?"64 118 214":E(s.hue).rgb}this.style.setProperty("--mr-art",t)}async load(e){const t=this.deviceKey;if(!t)return;const s=++this.token;e&&(this.phase=this.detail&&this.detail.key===t?this.phase:"loading");try{const i=await k().get(t);if(s!==this.token||t!==this.deviceKey)return;this.applyDetail(i)}catch{if(s!==this.token||!this.detail&&await this.learnPlayer(t,s))return;this.detail||(this.phase="error")}}async learnPlayer(e,t){try{const s=await ve().get(e);return t!==this.token||e!==this.deviceKey||s.kind==="screen"?!1:(this.kind=s.kind,!0)}catch{return!1}}applyDetail(e){if(e.kind!=="screen"){this.kind=e.kind;return}this.detail=e,this.phase="ready",this.audio===null&&e.audio_link&&(this.audio=e.live.volume.target??e.audio_link.default),M(e).includes(this.tab)||(this.tab="pad"),this.dispatchEvent(new CustomEvent("media-changed",{detail:{key:e.key},bubbles:!0,composed:!0}))}refreshSoon(e=500){window.clearTimeout(this.refreshTimer),this.refreshTimer=window.setTimeout(()=>void this.load(!1),e)}onKey(e){const t=this.detail;if(!t||this.editing)return;const s=t.audio_link?K(t,this.audio):void 0;let i;switch(e){case"volup":i={command:"volume_step",direction:"up",target:s};break;case"voldown":i={command:"volume_step",direction:"down",target:s};break;case"mute":i={command:"mute",muted:!(t.live.volume.muted??!1),target:s};break;default:i={command:"key",key:e}}e.startsWith("n")&&A(e)&&this.noteDigit(A(e)),this.exec(i)}transport(e){this.exec({command:"transport",action:e})}noteDigit(e){this.chbuf=Ee(this.chbuf,e),window.clearTimeout(this.chTimer),this.chTimer=window.setTimeout(()=>{this.chbuf="",this.refreshSoon(300)},1300)}shake(){this.shaking=!0,window.setTimeout(()=>this.shaking=!1,260)}say(e,t=3200){this.notice=e,window.clearTimeout(this.noticeTimer),this.noticeTimer=window.setTimeout(()=>this.notice="",t)}setPend(e,t){const s=new Set(this.pend);t?s.add(e):s.delete(e),this.pend=s}async exec(e){const t=this.detail;if(!t)return;const s=this.gate.check(t,e);if(s==="dropped"){this.shake();return}if(s!=="send")return;const i=this.ctrlOf(e),a=ze(e,t.live),n=a===null;n||this.setPend(i,!0);let l;try{l=await me(t.key,e)}catch(h){this.setPend(i,!1),(e.command==="power_on"||e.command==="power_off")&&this.gate.powerDone(),this.onError(h);return}if(l.status==="refused"){this.setPend(i,!1),(e.command==="power_on"||e.command==="power_off")&&this.gate.powerDone(),this.say(_[l.error??""]??_.not_confirmed),this.refreshSoon(0);return}if(n||l.status==="sent"){this.setPend(i,!1),(e.command==="volume_step"||e.command==="mute")&&this.refreshSoon(600);return}await this.confirm(e,i,a,l.action_id)}ctrlOf(e){switch(e.command){case"power_on":case"power_off":return"power";case"source":return`src:${e.source_id}`;case"app":return`app:${e.app_id}`;case"volume_set":return"vol";case"volume_step":return"step";default:return e.command}}async confirm(e,t,s,i){const a=this.deviceKey,n=this.token,l=Date.now();for(;Date.now()-l<fe;){if(n!==this.token||a!==this.deviceKey)return;try{const h=await k().get(a);if(n!==this.token)return;if(this.applyDetail(h),s(h.live)){this.setPend(t,!1),(e.command==="power_on"||e.command==="power_off")&&this.gate.powerDone(),this.volDraft=null;return}}catch{}if(i&&ae())try{const h=await be(i);if(h.status==="failed"||h.status==="denied")break}catch{}await new Promise(h=>window.setTimeout(h,Xe))}n===this.token&&(this.setPend(t,!1),(e.command==="power_on"||e.command==="power_off")&&this.gate.powerDone(),this.volDraft=null,this.say(_.not_confirmed),this.load(!1))}onError(e){if(e instanceof ge){if(e.code==="rate_limited"||e.status===429){this.shake();return}this.say(_[e.code]??e.body.user_message??_.not_confirmed),["screen_off","unavailable","not_found"].includes(e.code)&&this.refreshSoon(0);return}this.say(_.not_confirmed)}keyOf(e){const t=e.composedPath()[0]?.closest?.("[data-key]");return!t||t.hasAttribute("disabled")||t.getAttribute("aria-disabled")==="true"?null:{el:t,key:t.dataset.key}}flashEl(e){e.classList.remove("hit"),e.offsetWidth,e.classList.add("hit"),window.setTimeout(()=>e.classList.remove("hit"),180)}sendText(){const e=this.typed.trim();e&&this.exec({command:"text",text:e}).then(()=>{this.typed=""})}render(){if(this.isPlayer)return o`<media-player-panel .deviceKey=${this.deviceKey} .open=${this.open} .scheme=${this.scheme} @close=${this.onPanelClose}></media-player-panel>`;const e=this.detail,t=e?[e.area_name,e.floor_name].filter(Boolean).map(s=>C(s)).join(" · "):"";return o`<sw-drawer modal ?data-editing=${this.editing} .open=${this.open} heading=${e?C(e.name):""} subheading=${t} @close=${this.onClose}>${this.body()}</sw-drawer>`}body(){const e=this.detail;if(!e)return this.phase==="error"?o`<div class="r" data-mr-state="error"><div class="errbox">${p("warning")}<b>${r("לא ניתן לטעון את המסך")}</b><button type="button" class="btn" @click=${()=>void this.load(!0)}>${r("נסו שוב")}</button></div></div>`:o`<div class="r" data-mr-state="loading" aria-busy="true"><span class="skl" style="block-size:92px;border-radius:var(--sw-r-2xl)"></span><span class="skl" style="block-size:48px"></span><span class="skl" style="block-size:340px;border-radius:var(--sw-r-pill)"></span></div>`;if(this.editing)return o`<div class="r" data-mr-state="editing"><media-remote-editor .device=${e} .canConfigure=${this.status?.can.configure===!0}
        @editor-done=${this.onEditorDone}></media-remote-editor></div>`;const t=R(e),s=De(e);return o`<div class="r" data-mr data-mr-state=${t} data-mr-profile=${e.profile} ?data-view-only=${s} ?data-not-confirmed=${!e.live.confirmed}
      @pointerdown=${this.onDown} @click=${this.onClick} @keydown=${this.onKeyDown} @keyup=${this.onKeyUp}>
      <div class="notice" role="status" aria-live="polite" ?hidden=${!this.notice}>${this.notice?o`${p("warning")}<span data-mr-notice>${this.notice}</span>`:d}</div>
      ${t==="unavailable"?this.unavailableBody(e):t==="on"?o`${this.nowPlaying(e)}${s?d:this.onBody(e)}`:s?this.viewOnlyBody(t):t==="art"?this.artBody(e):this.offBody(e)}
    </div>`}thumb(e){const t=e.live.now;if(R(e)!=="on"&&e.live.power!=="art")return o`<div class="thumb plain" aria-hidden="true">${p(e.live.power==="unavailable"?"wifiOff":"power")}</div>`;if(t.artwork){const n=we(t.artwork);return o`<div class="thumb" style="--art:${E(t.hue).rgb}" aria-hidden="true"><img src=${n} alt="" loading="lazy" /></div>`}if(t.kind==="art")return o`<div class="thumb" style="--art:214 160 104" aria-hidden="true"><span class="tile frameart"></span><svg viewBox="0 0 100 70" style="position:absolute;inset:10% 14%;inline-size:72%;block-size:80%"><rect x="0" y="0" width="100" height="70" fill="#f7f1e6" stroke="#b9a37e" stroke-width="3"/><circle cx="32" cy="32" r="16" fill="#e0794a" opacity=".85"/><rect x="48" y="18" width="30" height="36" fill="#27496d" opacity=".85"/><path d="M8 58 C30 44 52 60 92 46" stroke="#2f3a2f" stroke-width="2.5" fill="none"/></svg></div>`;if(t.kind==="saver")return o`<div class="thumb" style="--art:70 92 170" aria-hidden="true"><span class="tile saver"></span><svg class="ic gl" viewBox="0 0 24 24">${D(z.moon)}</svg></div>`;const i=t.kind==="channel"||t.kind==="source"&&t.glyph==="antenna"?{a1:"#0f172a",a2:"#3b4a66",rgb:"64 118 214"}:t.kind==="home"?{a1:"#1e1b4b",a2:"#4f46e5",rgb:"79 70 229"}:t.kind==="source"?{a1:"#111827",a2:"#3f4a5c",rgb:"110 124 150"}:E(t.hue),a=t.channel&&t.glyph==="antenna"?t.channel:"";return o`<div class="thumb" style="--a1:${i.a1};--a2:${i.a2};--art:${i.rgb}" aria-hidden="true"><span class="tile"></span>${a?o`<span class="num">${a}</span>`:o`<svg class="ic gl" viewBox="0 0 24 24">${D(ne(t.glyph))}</svg>`}</div>`}nowPlaying(e){const t=e.live,s=t.now;let i="",a;s.kind==="saver"?(i=r("שומר מסך"),a=e.name):s.kind==="home"?(i=r("מסך הבית"),a=e.name):s.glyph==="antenna"&&s.channel?(i=s.label||r("טלוויזיה"),a=r("ערוץ {ch}",{ch:s.channel})):(i=s.title?s.label:"",a=s.title||s.label||e.name);const n=Te(t,this.nowMs),l=s.duration_s&&s.duration_s>0?s.duration_s:null,h=n!==null&&l?o`<div class="prog"><span class="n">${V(n)}</span><span class="bar" style="--p:${Math.round(n/l*100)}%"><i></i></span><span class="n">${V(l)}</span></div>`:d;return o`<div class="np" data-mr-now>${this.thumb(e)}<div class="t">${i?o`<small>${C(i)}</small>`:d}<b>${C(a)}</b>${h}</div></div>`}unavailableBody(e){const t=Ce(e.live);return o`<div class="roff" data-mr-unavailable>${p("wifiOff")}<b>${t.title}</b>${t.since?o`<small>${r("מאז")} <span class="n">${t.since}</span></small>`:d}</div>`}viewOnlyBody(e){return o`<div class="roff" data-mr-viewonly>${p(e==="art"?"frame":"power")}<b>${e==="art"?r("מצב אמנות"):r("כבוי")}</b></div>`}bigPower(e,t,s,i){const a=this.pend.has("power"),n=!s&&i==="no_remote_wake"?r("אין הפעלה מרחוק"):!s&&i==="unavailable"?r("המסך לא זמין"):t;return o`<button type="button" class=${O({bigpw:!0,pend:a})} data-mr-power=${e} aria-label=${t} title=${n} ?disabled=${!s||a} aria-busy=${String(a)}
      @click=${()=>void this.exec({command:e==="on"?"power_on":"power_off"})}>${p("power")}${a?o`<span class="pendring"></span>`:d}</button>`}offBody(e){const t=W(e),s=Z(e),i=s.main.length+s.more.length>0&&e.caps.keys.length>0;return o`<div class="roff" data-mr-off>
        ${t.action==="on"?this.bigPower("on",r("הפעל"),t.enabled,t.reason):o`${p("power")}`}
        <b>${t.action==="on"&&t.enabled?r("הפעל"):r("כבוי")}</b>
      </div>
      ${i?o`<div class="rpad dim" aria-hidden="true" inert>${this.padContent(e,s,!0)}</div>`:d}`}artBody(e){const t=W(e);return o`<div class="roff" data-mr-art>
      ${this.bigPower("off",r("כבה"),t.enabled,t.reason)}<b>${r("מצב אמנות")}</b>
      ${Oe(e)?o`<button type="button" class="btn" data-mr-art-watch ?disabled=${this.pend.has("power")} @click=${()=>void this.exec({command:"power_on"})}>${p("tv")}${r("מעבר לצפייה")}</button>`:d}
    </div>`}onBody(e){const t=Z(e),s=M(e),i=s.includes(this.tab)?this.tab:"pad";return o`${this.audioSwitch(e,t.main)}${this.volumeRow(e,t.main)}${t.main.includes("recent")?this.recent(e):d}
      ${s.length>1?o`<sw-tabs controlled variant="pill" fill="always" group-label=${r("שלט")} .active=${i}
            .items=${s.map(a=>({id:a,label:a==="pad"?r("שלט"):a==="sources"?r("מקורות"):r("אפליקציות"),attrs:{"data-mr-tab":a}}))}
            @change=${a=>{a.stopPropagation(),this.tab=a.detail.id}}></sw-tabs>`:d}
      ${i==="sources"?this.sources(e):i==="apps"?this.apps(e):o`<div class=${O({rpad:!0,shake:this.shaking})} data-mr-pad>${this.padContent(e,t,!1)}</div>`}`}audioSwitch(e,t){if(!e.audio_link||!e.can.control||!t.includes("vol"))return d;const s=K(e,this.audio);return o`<sw-segmented radio block size="sm" label=${r("יציאת שמע")} data-mr-audio value=${s}
      @change=${i=>this.audio=i.detail.value==="linked"?"linked":"screen"}
      .options=${[{value:"screen",label:r("רמקולי המסך"),icon:p("tv")},{value:"linked",label:C(e.audio_link.name),icon:p("speaker")}]}></sw-segmented>`}volumeRow(e,t){if(!t.includes("vol")||!e.can.control||!e.caps.volume_set)return d;const i=(e.audio_link?K(e,this.audio):e.live.volume.target)!==e.live.volume.target?null:e.live.volume.level,a=this.volDraft??i??0,n=e.live.volume.muted===!0;return o`<div class="vrow" data-mr-vrow>
      ${e.caps.mute?o`<button type="button" class=${O({rb:!0,on:n})} data-key="mute" aria-pressed=${String(n)} aria-label=${n?r("בטל השתקה"):r("השתק")}>${p(n?"volOff":"vol")}</button>`:d}
      <input class="rng" type="range" min="0" max="100" step="1" .value=${String(a)} style="--v:${a}%" aria-label=${e.audio_link?`${r("עוצמה")} · ${e.audio_link.name}`:r("עוצמה")} @input=${this.onVolume} />
      <span class="vv n" data-mr-volval>${this.volDraft!==null||i!==null?a:"–"}</span>
    </div>`}glyph(e,t=!1){if(t)return o`<span class="gi src">${p(e.glyph)}</span>`;const s=E(e.hue??null);return o`<span class="gi" style="--a1:${s.a1};--a2:${s.a2};--art:${s.rgb}">${p(e.glyph)}</span>`}recent(e){const t=Pe(e);if(!t.length)return d;const s=[...e.sources,...e.apps];return o`<div class="recent" role="group" aria-label=${r("אחרונים")} data-mr-recent><span class="lbl">${r("אחרונים")}</span>${t.map(i=>{const a=s.find(h=>h.id===i.id&&h.kind===(i.kind==="app"?"app":"source")),n=i.kind==="app"?e.live.now.app_id===i.id:e.live.now.source_id===i.id,l=i.kind==="source";return o`<button type="button" class="rchip" aria-current=${String(n)} data-mr-recent-item=${i.id} @click=${()=>void this.exec(i.kind==="app"?{command:"app",app_id:i.id}:{command:"source",source_id:i.id})}>${this.glyph({glyph:i.glyph,hue:a?.hue??null},l)}<bdi>${i.label}</bdi></button>`})}</div>`}sources(e){return e.sources.length?o`<div class="srcg" role="radiogroup" aria-label=${r("מקורות")} data-mr-sources>${I(e.sources,t=>t.id,t=>this.sourceTile(e,t))}</div>`:o`<div class="empty">${p("input")}${r("אין מקורות")}</div>`}sourceTile(e,t){const s=J(e.live,t),i=this.pend.has(`src:${t.id}`),a=s&&e.live.now.channel&&t.glyph==="antenna"?r("ערוץ {ch}",{ch:e.live.now.channel}):"";return o`<button type="button" class="srci" role="radio" aria-checked=${String(s)} data-mr-source=${t.id} ?disabled=${i} @click=${()=>void this.exec({command:"source",source_id:t.id})}>
      <span class="gi src">${p(t.glyph)}</span><span><bdi>${t.label}</bdi>${a?o`<small>${a}</small>`:d}</span>${s&&!i?o`<span class="ck">${p("check")}</span>`:d}${i?o`<span class="pendring"></span>`:d}</button>`}apps(e){return e.apps.length?o`<div class="appg" data-mr-apps>${I(e.apps,t=>t.id,t=>{const s=J(e.live,t),i=this.pend.has(`app:${t.id}`),a=E(t.hue);return o`<button type="button" class="appt" data-mr-app=${t.id} aria-current=${String(s)} ?disabled=${i} @click=${()=>void this.exec({command:"app",app_id:t.id})}>
        <span class="gi" style="--a1:${a.a1};--a2:${a.a2};--art:${a.rgb}">${p(t.glyph)}${i?o`<span class="pendring" style="inset:-5px;border-radius:var(--sw-r-2xl)"></span>`:d}</span><span><bdi>${t.label}</bdi></span></button>`})}</div>`:o`<div class="empty">${p("apps")}${r("אין אפליקציות")}</div>`}kb(e,t,s={}){if(!e.caps.keys.includes(t))return d;const i=s.label??g[t];return o`<button type="button" class="kb ${s.cls??""}" data-key=${t} aria-label=${g[t]}><span class="kc">${p(s.glyph??Q[t]??"app")}</span><span>${i}</span></button>`}topCluster(e,t){const s=M(e),i=e.can.power&&e.caps.power_off&&!t,a=this.pend.has("power"),l=(f=>e.remote.sections.some(x=>x.id===f&&x.on))("xtra")?this.kb(e,"guide"):d,h=t&&e.can.power;return o`<div class="tcl">
      ${i?o`<button type="button" class=${O({kb:!0,pwk:!0,pend:a})} data-mr-power="off" aria-label=${r("כבה")} ?disabled=${a} @click=${()=>void this.exec({command:"power_off"})}><span class="kc">${p("power")}${a?o`<span class="pendring"></span>`:d}</span><span>${r("כבה")}</span></button>`:h?o`<button type="button" class="kb pwk off" aria-label=${r("הפעל")} disabled><span class="kc">${p("power")}</span><span>${r("הפעל")}</span></button>`:d}
      <span class="grow"></span>${l}
      ${s.includes("sources")?o`<button type="button" class="kb" data-mr-goto="sources" aria-label=${r("מקורות")} @click=${()=>this.tab="sources"}><span class="kc">${p("input")}</span><span>${r("מקור")}</span></button>`:d}
      ${s.includes("apps")?o`<button type="button" class="kb" data-mr-goto="apps" aria-label=${r("אפליקציות")} @click=${()=>this.tab="apps"}><span class="kc">${p("apps")}</span><span>${r("אפליקציות")}</span></button>`:d}
    </div>`}rocker(e,t){const s=t==="vol",i=s?"volup":"chup",a=s?"voldown":"chdown",n=s?Y(e,{command:"volume_step",direction:"up"}):e.caps.keys.includes(i),l=s?Y(e,{command:"volume_step",direction:"down"}):e.caps.keys.includes(a),h=s?e.audio_link&&K(e,this.audio)!==e.live.volume.target?"–":e.live.volume.level??"–":e.live.now.channel??"–",f=e.live.volume.muted===!0;return o`<div class="col" data-mr-rocker=${t}>
      <div class="rock" role="group" aria-label=${s?r("עוצמה"):r("ערוצים")}>
        <button type="button" data-key=${i} aria-label=${g[i]} ?disabled=${!n}>${p(s?"plus":"up")}</button>
        <span class="rv"><small>${s?r("עוצמה"):r("ערוץ")}</small><b class="n" data-mr-value=${t}>${h}</b></span>
        <button type="button" data-key=${a} aria-label=${g[a]} ?disabled=${!l}>${p(s?"minus":"down")}</button>
      </div>
      ${s&&e.caps.mute?o`<button type="button" class=${O({rb:!0,on:f})} data-key="mute" aria-pressed=${String(f)} aria-label=${f?r("בטל השתקה"):r("השתק")}>${p(f?"volOff":"vol")}</button>`:d}
      ${!s&&e.caps.keys.includes("chlist")?o`<button type="button" class="rb" data-key="chlist" aria-label=${g.chlist}>${p("list")}</button>`:d}
    </div>`}padContent(e,t,s){const i=[],a=Ke(e);i.push(this.topCluster(e,s));let n=!1;for(const l of t.main)if(l==="vol"||l==="ch"||l==="dpad"||l==="touch"){if(n)continue;n=!0,i.push(this.grid(e,t.main,a))}else if(l!=="recent"){const h=this.section(e,l);h&&i.push(h)}return t.more.length&&(i.push(o`<button type="button" class="morebtn" data-mr-more aria-expanded=${String(this.more)} @click=${()=>this.more=!this.more}>${this.more?r("פחות מקשים"):r("עוד מקשים")}${p("chevronDown")}</button>`),this.more&&i.push(o`<div class="more" data-mr-morebody>${t.more.map(l=>l==="vol"||l==="ch"||l==="dpad"||l==="touch"?this.grid(e,[l],a,!0):this.section(e,l))}</div>`)),o`${i}`}grid(e,t,s,i=!1){const a=t.includes("vol")&&(e.caps.volume_step||e.caps.keys.includes("volup")||e.caps.keys.includes("voldown")),n=t.includes("ch")&&e.caps.keys.some(S=>S==="chup"||S==="chdown"),l=t.includes("dpad")||t.includes("touch")?t.includes("touch")&&!t.includes("dpad")?"touch":this.pad:null,h=!i&&s.dpad&&s.touch,f=l==="touch"&&s.touch?"touch":"dpad";if(!l&&!a&&!n)return o``;const x=l?"pgrid":a&&n?"pgrid duo":"pgrid solo";return o`${h?o`<sw-segmented radio size="sm" label=${r("סוג משטח")} value=${this.pad} @change=${S=>this.pad=S.detail.value==="touch"?"touch":"dpad"}
            .options=${[{value:"dpad",label:r("חצים")},{value:"touch",label:r("משטח"),icon:p("touch")}]}></sw-segmented>`:d}
      <div class=${x}>
        ${l?a?this.rocker(e,"vol"):o`<div class="col"></div>`:a?this.rocker(e,"vol"):d}
        ${l?o`<media-remote-pad .keys=${e.caps.keys} .mode=${f} @mr-key=${this.onPadKey}></media-remote-pad>`:d}
        ${l?n?this.rocker(e,"ch"):o`<div class="col"></div>`:n?this.rocker(e,"ch"):d}
      </div>`}section(e,t){switch(t){case"nav":{const s=["back","home","menu"].filter(i=>e.caps.keys.includes(i));return s.length?o`<div class="navk" data-mr-nav>${s.map(i=>this.kb(e,i))}</div>`:null}case"pbk":{const s=e.caps.transport,i=e.live;if(i.play===null&&i.now.kind!=="app")return null;const a=i.play==="playing",n=(l,h,f,x="")=>o`<button type="button" class="kb ${x}" aria-label=${f} data-mr-transport=${l} @click=${()=>this.transport(l)}><span class="kc">${p(h)}</span></button>`;return o`<div class="pbk" role="group" aria-label=${r("ניגון")} data-mr-pbk>
          ${s.previous?n("previous","prev",r("הקודם")):d}${e.caps.keys.includes("rew")?this.kb(e,"rew",{label:"",glyph:"rew"}):d}
          ${n("play_pause",a?"pause":"play",a?r("השהה"):r("נגן"),"main")}
          ${e.caps.keys.includes("ff")?this.kb(e,"ff",{label:"",glyph:"ff"}):d}${s.next?n("next","next",r("הבא")):d}</div>`}case"nums":return ee.some(s=>e.caps.keys.includes(s))?o`<div data-mr-nums><h4>${r("מספרים")}</h4><div class="chentry" aria-live="polite">${this.chbuf?o`${r("ערוץ")} <b>${this.chbuf}</b>`:d}</div>
          <div class="npad">${ee.map(s=>e.caps.keys.includes(s)?o`<button type="button" data-key=${s} aria-label=${g[s]}>${A(s)||p(s==="prech"?"history":"info")}</button>`:o`<span></span>`)}</div></div>`:null;case"colors":{const s=Be.filter(i=>e.caps.keys.includes(i));return s.length?o`<div data-mr-colors><h4>${r("מקשי צבע")}</h4><div class="ckeys">${s.map(i=>o`<button type="button" class=${i} data-key=${i} aria-label=${g[i]}></button>`)}</div></div>`:null}case"text":return e.caps.text?o`<div data-mr-text><h4>${r("הקלדה במסך")}</h4><div class="kbd"><label class="fld">${p("keyboard")}<span style="position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip:rect(0 0 0 0)">${r("טקסט לשליחה")}</span>
          <input type="text" maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder=${r("הקלדה")} .value=${this.typed} @input=${this.onText} @keydown=${s=>{s.key==="Enter"&&(s.preventDefault(),this.sendText())}} /></label>
          <button type="button" class="btn primary" data-mr-send ?disabled=${!this.typed.trim()} @click=${()=>this.sendText()}>${p("send")}${r("שלח")}</button></div></div>`:null;case"xtra":{const s=this.detail?this.detail.remote.sections.some(a=>a.id==="nums"&&a.on):!1,i=Se.filter(a=>e.caps.keys.includes(a)&&!Le.includes(a)&&!(s&&(a==="prech"||a==="info")));return i.length?o`<div data-mr-xtra><h4>${r("מקשים נוספים")}</h4><div class="xkeys">${i.map(a=>o`<button type="button" class="btn quiet" data-key=${a}>${p(Q[a]??"app")}${g[a]}</button>`)}</div></div>`:null}default:return null}}};u.styles=[Re,re];m([$({attribute:"device-key"})],u.prototype,"deviceKey",2);m([$({type:Boolean,reflect:!0})],u.prototype,"open",2);m([$()],u.prototype,"scheme",2);m([$()],u.prototype,"kind",2);m([v()],u.prototype,"detail",2);m([v()],u.prototype,"phase",2);m([v()],u.prototype,"tab",2);m([v()],u.prototype,"more",2);m([v()],u.prototype,"pad",2);m([v()],u.prototype,"audio",2);m([v()],u.prototype,"pend",2);m([v()],u.prototype,"notice",2);m([v()],u.prototype,"shaking",2);m([v()],u.prototype,"volDraft",2);m([v()],u.prototype,"typed",2);m([v()],u.prototype,"chbuf",2);m([v()],u.prototype,"editing",2);m([v()],u.prototype,"nowMs",2);m([v()],u.prototype,"status",2);u=m([F("media-remote")],u);export{u as MediaRemote};
