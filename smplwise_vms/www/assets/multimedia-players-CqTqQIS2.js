import{fS as X,i as Y,n as V,r as p,a as J,gE as Z,fT as W,gG as E,p as l,gW as ee,gH as te,gJ as se,q as r,kz as H,ey as A,x as Q,km as ie,eo as ae,S as re,et as oe,fq as ne,cU as le,bI as L,K as F,aS as de,kn as M,kA as S,ko as ce,cA as he,eq as q,kp as pe,h1 as ue,R as D,ak as R,cX as me,V as O,dl as fe,ep as ve,kB as ge,X as B,cP as be,kr as ye,ks as we,kt as $e,ku as ke,kv as xe,g$ as I,dH as Ee,e as Pe}from"./index-C5kZ9jiu.js";import"./media-player-card-DhYAJPbA.js";import{r as ze,p as _e}from"./media-group-dialog-CWC3lVHH.js";import{g as Te,m as h,n as k}from"./media-now-DDqP14hw.js";import{l as j,D as Le,a as U,i as Fe,m as K,t as Se,k as De,o as Re}from"./media-personal-DUZuFXgN.js";import"./sw-pager-2h-bsNFx.js";import{P as Oe}from"./multimedia-page-fit-aNuqF9pe.js";import{m as Ce,a as Ae}from"./media-page-BF4b5gDG.js";import{P as v,p as N,f as P,i as He,t as Me,a as G,w as qe,e as Be,r as Ie,b as z,c as C,d as je,U as $,g as Ue,h as Ke,j as Ne}from"./multimedia-players-layout-DvFtMxgs.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-BLWZG4KN.js";var Ge=Object.defineProperty,Xe=Object.getOwnPropertyDescriptor,T=(e,t,s,i)=>{for(var a=i>1?void 0:i?Xe(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ge(t,s,a),a};let y=class extends J{constructor(){super(...arguments),this.device=null,this.pending=new Set,this.note="",this.throttle=new Z,this.ticker=0,this.timers=[]}connectedCallback(){super.connectedCallback(),W(this)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.ticker),this.ticker=0;for(const e of this.timers)window.clearTimeout(e);this.timers=[]}updated(){const e=this.device,t=!!e&&e.live.play==="playing"&&!!e.live.now.duration_s&&e.live.now.kind!=="station";t&&!this.ticker?this.ticker=window.setInterval(()=>this.requestUpdate(),1e3):!t&&this.ticker&&(window.clearInterval(this.ticker),this.ticker=0)}async send(e,t){const s=this.device;if(!s||!E(s,t)||this.pending.has(e)||!this.throttle.take())return;this.note="";const i=new Set(this.pending);i.add(e),this.pending=i;const a=await ze(s.key,t),n=new Set(this.pending);n.delete(e),this.pending=n,(a.outcome==="not_confirmed"||a.outcome==="refused")&&(this.note=a.message,this.timers.push(window.setTimeout(()=>this.note="",6e3))),this.dispatchEvent(new CustomEvent("media-changed",{detail:{key:s.key,outcome:a.outcome},bubbles:!0,composed:!0}))}render(){const e=this.device;if(!e)return l;const t=_e(e),s=e.live.now,i=t.playing,a=t.kind==="station"?null:ee(s,i,Date.now()),n=s.duration_s??null,o=a!==null&&n?Math.max(0,Math.min(100,a/n*100)):0,u=e.live.volume.level??0,g=te(e),b=e.can.control,w=x=>()=>void this.send(x,{command:"transport",action:x}),m=e.live.group.role==="leader"?e.live.group.member_keys.length+1:0,f=t.artwork?se(t.artwork):"";return r`<section class="hero" style=${`--a1:${t.a1};--a2:${t.a2}`} aria-label=${`מתנגן עכשיו · ${e.name}`} data-now-hero=${e.key} data-playing=${String(i)}>
      <div class="bg" style=${f?`background-image:url("${f}")`:l}></div>
      <div class="veil"></div>
      <div class="in">
        <div class="art">${f?r`<img src=${f} alt="" />`:Te(t.glyph)}</div>
        <div class="meta">
          <div class="chips">
            <span class="chip">${h(e.kind==="player"?"media":"speaker")}${k(e.area_name||e.name)}</span>
            ${m?r`<span class="chip">${h("group")}${m} חדרים</span>`:l}
          </div>
          <div class="ttl" data-now-title>${k(s.title||t.line||e.name)}</div>
          ${s.artist||s.album?r`<div class="sub">${k([s.artist,s.album].filter(Boolean).join(" · "))}</div>`:l}
          ${this.note?r`<div class="bad" role="status">${this.note}</div>`:l}
        </div>
        <div class="bar">
          ${t.kind==="station"?r`<span class="live"><i></i>שידור חי</span><span class="tr"></span><span></span>`:r`<span>${a!==null?H(a):"–:––"}</span><span class="tr" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(o)} style=${`--p:${o}%`}><i></i></span><span>${n?H(n):"–:––"}</span>`}
        </div>
        <div class="keys">
          ${b?r`<span class="tp" role="group" aria-label="ניגון">
                <button type="button" class="k" aria-label="הקודם" ?disabled=${!E(e,{command:"transport",action:"previous"})} @click=${w("previous")}>${h("prev")}</button>
                <button type="button" class=${A({k:!0,main:!0})} aria-label=${i?"השהה":"נגן"} ?disabled=${!E(e,{command:"transport",action:"play_pause"})||this.pending.has("play_pause")} @click=${w("play_pause")}>${h(i?"pause":"play")}</button>
                <button type="button" class="k" aria-label="הבא" ?disabled=${!E(e,{command:"transport",action:"next"})} @click=${w("next")}>${h("next")}</button>
              </span>`:l}
          ${b&&e.caps.volume_set?r`<sw-pill class="vol" variant="slider" icon="volume" label="עוצמה" .state=${`${u}%${e.live.volume.muted?" · מושתק":""}`} .value=${u/100} on keep-text fill-color="var(--sw-accent-soft)" ?unavailable=${this.pending.has("volume")}
                @toggle=${()=>void this.send("mute",{command:"mute",muted:!e.live.volume.muted})} @change=${x=>void this.send("volume",{command:"volume_set",level:Math.max(0,Math.min(g??100,Math.round(x.detail.value*100)))})}></sw-pill>`:l}
        </div>
      </div>
    </section>`}};y.styles=[X,Y`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      border-radius: var(--sw-r-xl);
      background: linear-gradient(135deg, var(--a1, #111827), var(--a2, #3f4a5c));
      color: var(--sw-text);
      container-type: inline-size;
    }
    .bg {
      position: absolute;
      inset: -12%;
      z-index: 0;
      background-size: cover;
      background-position: center;
      filter: blur(28px) saturate(1.4);
      opacity: 0.9;
    }
    .veil {
      position: absolute;
      inset: 0;
      z-index: 1;
      background: rgba(var(--sw-sheet-rgb), 0.62);
    }
    .in {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-areas: 'art meta' 'art bar' 'art keys';
      gap: 10px 20px;
      align-items: center;
      padding: 18px 20px;
    }
    .art {
      grid-area: art;
      inline-size: 180px;
      block-size: 180px;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      position: relative;
      background: linear-gradient(135deg, var(--a1, #111827), var(--a2, #3f4a5c));
      display: grid;
      place-items: center;
      color: var(--sw-on-video);
      font-size: 56px;
      box-shadow: var(--sw-shadow-2);
    }
    .art img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .meta {
      grid-area: meta;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-layer);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
    }
    .ttl {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      unicode-bidi: plaintext;
      text-align: start;
    }
    .sub {
      color: var(--sw-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      unicode-bidi: plaintext;
      text-align: start;
    }
    .bad {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    /* the progress: LTR like every timeline */
    .bar {
      grid-area: bar;
      direction: ltr;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-2);
    }
    .bar .tr {
      block-size: 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-layer);
      overflow: hidden;
    }
    .bar .tr i {
      display: block;
      block-size: 100%;
      inline-size: var(--p, 0%);
      background: var(--sw-text);
      border-radius: var(--sw-r-pill);
    }
    .bar .live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-bold);
    }
    .bar .live i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-danger);
    }
    .keys {
      grid-area: keys;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .tp {
      direction: ltr;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: none;
    }
    .k {
      inline-size: 52px;
      block-size: 52px;
      min-inline-size: 44px;
      min-block-size: 44px;
      border: 0;
      border-radius: 50%;
      background: var(--sw-layer);
      color: var(--sw-text);
      display: grid;
      place-items: center;
      cursor: pointer;
      font-size: var(--sw-fs-2xl);
      padding: 0;
      transition: transform var(--sw-t-press) var(--sw-ease);
    }
    .k.main {
      inline-size: 60px;
      block-size: 60px;
      background: var(--sw-text);
      color: var(--sw-bg);
      font-size: var(--sw-fs-3xl);
    }
    .k:active {
      transform: scale(0.94);
    }
    .k[disabled] {
      opacity: 0.4;
      cursor: default;
    }
    .k:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    sw-pill.vol {
      flex: 1 1 200px;
      min-inline-size: 0;
      --pill-base: var(--sw-layer);
    }
    /* a narrow panel stacks: the art on top, centred */
    @container (max-width: 560px) {
      .in {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: 'art' 'meta' 'bar' 'keys';
        justify-items: center;
        text-align: center;
        padding: 16px;
      }
      .art {
        inline-size: min(180px, 48cqw);
        block-size: min(180px, 48cqw);
      }
      .meta {
        inline-size: 100%;
        align-items: center;
      }
      .chips {
        justify-content: center;
      }
      .bar,
      .keys {
        inline-size: 100%;
      }
      .keys {
        justify-content: center;
      }
    }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      .veil {
        background: rgba(var(--sw-sheet-rgb), 0.78);
      }
    }
    @media (prefers-reduced-transparency: reduce) {
      .bg {
        display: none;
      }
      .veil {
        background: var(--sw-surface-solid);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .k {
        transition: none;
      }
    }
  `];T([V({attribute:!1})],y.prototype,"device",2);T([p()],y.prototype,"pending",2);T([p()],y.prototype,"note",2);y=T([Q("media-now-hero")],y);var Ye=Object.defineProperty,Ve=Object.getOwnPropertyDescriptor,c=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ve(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ye(t,s,a),a};const _="/multimedia/players",Je={installation:ie,personal:null,revision:0,can_edit:!1,can_personalize:!1},We=e=>e,Qe=(e,t)=>JSON.stringify(e)===JSON.stringify(t);let d=class extends J{constructor(){super(...arguments),this.playerKey="",this.phase="loading",this.devices=[],this.status=null,this.res=Je,this.homeFloors=[],this.filters=v,this.compactHeader=!1,this.staleError="",this.toast="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.editing=!1,this.draft=null,this.base=null,this.busy=!1,this.saveError="",this.conflict=!1,this.confirm=null,this.tabsMode=new ae(this,"multimedia"),this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offEdit=null,this.offPush=null,this.refreshTimer=0,this.pollTimer=0,this.toastTimer=0,this.qTimer=0,this.typing=0,this.wantsEdit=!1,this.editHandled=!1,this.pushedPlayer=!1,this.loading=!1,this.homeFloorsLoaded=!1,this.skin=new re(this),this.fit=new Oe(this,()=>this.renderRoot.querySelector(".scr"),()=>!this.editing),this.onScroll=()=>{const e=this.scrollTop;!this.compactHeader&&e>60?this.compactHeader=!0:this.compactHeader&&e<12&&(this.compactHeader=!1)},this.onRegionScroll=e=>{const t=e.currentTarget;t.classList.toggle("scrolled",t.scrollTop>2)},this.roomsDrag=e=>{if(e.pointerType!=="mouse"||e.button!==0)return;const t=e.currentTarget,s=e.clientX,i=t.scrollLeft;let a=!1;const n=u=>{Math.abs(u.clientX-s)>4&&(a=!0),a&&(t.classList.add("dragging"),t.scrollLeft=i-(u.clientX-s)*(getComputedStyle(t).direction==="rtl"?-1:1))},o=u=>{if(window.removeEventListener("pointermove",n),window.removeEventListener("pointerup",o),t.classList.remove("dragging"),a){u.preventDefault();const g=b=>b.stopImmediatePropagation();t.addEventListener("click",g,{capture:!0,once:!0}),window.setTimeout(()=>t.removeEventListener("click",g,{capture:!0}),0)}};window.addEventListener("pointermove",n),window.addEventListener("pointerup",o)}}nowPlaying(){const e=this.devices.filter(t=>t.live.group.role!=="member");return e.find(t=>oe(t))??e.find(t=>t.live.power==="on"&&t.live.play==="paused")??null}connectedCallback(){super.connectedCallback(),W(this),this.phoneMq.addEventListener("change",this.onPhone),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offEdit=ne({id:"multimedia-players-layout",label:"עריכת מסך הנגנים",icon:"edit",can:()=>this.canEdit&&!this.editing,run:()=>this.enterEdit()}),this.offRoute=le(e=>{if(e.mode!=="multimedia"||e.segments[1]!=="players")return;const t=N(e.params);this.filters=this.typing?{...t,q:this.filters.q}:t,this.wantsEdit=e.params.get("edit")==="1",this.wantsEdit||(this.editHandled=!1,this.editing&&this.leaveEdit(!1)),this.requestUpdate()}),this.filters=N(L().params),this.wantsEdit=L().params.get("edit")==="1",this.load(),F()&&(this.offPush=de(e=>{if(e.type==="media_state"){const t=this.devices.find(s=>s.key===e.device_key)?.live.power;this.devices=this.devices.map(s=>s.key===e.device_key?{...s,live:We(e.live)}:s),t&&t!==e.live.power&&this.scheduleRefresh(800)}else e.type==="media_devices_changed"&&this.scheduleRefresh(200)},e=>{e&&this.scheduleRefresh(200)})),this.pollTimer=window.setInterval(()=>void this.load(),3e4)}disconnectedCallback(){super.disconnectedCallback(),M(this),this.phoneMq.removeEventListener("change",this.onPhone),this.removeEventListener("scroll",this.onScroll),this.offEdit?.(),this.offRoute?.(),this.offPush?.(),this.offEdit=this.offRoute=this.offPush=null;for(const e of[this.refreshTimer,this.toastTimer,this.qTimer])window.clearTimeout(e);window.clearInterval(this.pollTimer)}syncPair(){const e=this.filters,t=this.devices.filter(a=>P([a],{...v,floor:e.floor}).length),s=S(t);!this.editing&&this.phase==="ready"&&this.devices.length>0&&this.roomsAsDropdown(s.length+1)?ce(this,{group:"multimedia",label:"חדרים",value:e.area,items:[{id:"",label:"הכל",count:t.length,icon:"home"},{id:"--sep",label:"",divider:!0},...s.map(a=>({id:a.id,label:a.name,count:a.count,icon:"door"}))],onPick:a=>this.setFilters({area:a})}):M(this)}updated(){this.syncPair(),Ce(this.renderRoot,this.phone),this.wantsEdit&&!this.editHandled&&this.phase==="ready"&&(this.editHandled=!0,this.editing||(this.canEdit?this.enterEdit(!0):this.dropParam("edit")))}get canEdit(){return this.phase==="ready"&&this.res.can_edit&&!he("layout_editor")}async load(){if(!this.loading){this.loading=!0;try{const e=await q().status();if(this.status=e,pe(e.counts),!e.enabled){this.phase="disabled";return}if(!e.can.read){this.phase="forbidden";return}const[t,s]=await Promise.allSettled([q().list({kind:ue}),j()]);if(t.status==="rejected")throw t.reason;this.devices=t.value.devices,s.status==="fulfilled"&&!this.editing&&(this.res=s.value),!this.homeFloorsLoaded&&!this.res.installation.floor_order.length&&await this.loadHomeFloors(),this.phase="ready",this.staleError=""}catch(e){e instanceof D&&e.status===403?this.phase="forbidden":e instanceof D&&e.code==="feature_disabled"?this.phase="disabled":this.phase==="ready"?this.staleError=R(e):(this.phase="error",this.staleError=R(e))}finally{this.loading=!1}}}async loadHomeFloors(){if(this.homeFloorsLoaded=!0,!F()){this.homeFloors=Le;return}try{this.homeFloors=(await me()).floors.map(e=>e.floor_id).filter(e=>e!==U)}catch{this.homeFloors=[]}}get doc(){return this.res.installation}floorOrder(){return this.doc.floor_order.length?this.doc.floor_order:this.homeFloors}get hasFloors(){return He(this.status,this.devices)}view(){return Me(this.doc,"players",this.floorOrder())}scheduleRefresh(e){window.clearTimeout(this.refreshTimer),this.refreshTimer=window.setTimeout(()=>void this.load(),e)}say(e){this.toast=e,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",3200)}params(){return new URLSearchParams(L().params)}dropParam(e){const t=this.params();t.delete(e),O(_,t)}setFilters(e,t=!0){this.filters={...this.filters,...e},e.floor!==void 0&&e.area===void 0&&this.filters.area&&(S(this.devices.filter(a=>!this.filters.floor||P([a],{...v,floor:this.filters.floor}).length)).some(a=>a.id===this.filters.area)||(this.filters={...this.filters,area:""}));const s=()=>O(_,G(this.filters,this.params()));window.clearTimeout(this.qTimer),t?s():this.qTimer=window.setTimeout(s,300)}onSearch(e){this.typing=Date.now(),this.setFilters({q:e},!1),window.setTimeout(()=>{Date.now()-this.typing>=900&&(this.typing=0)},950)}scrollHome(){this.scrollTo({top:0}),this.renderRoot.querySelector(".scr")?.scrollTo({top:0})}openPlayer(e){const t=this.params();t.set("player",e),this.pushedPlayer=!0,fe(_,t)}closePlayer(){this.pushedPlayer?(this.pushedPlayer=!1,window.history.back()):this.dropParam("player"),this.scheduleRefresh(250)}enterEdit(e=!1){if(!(!this.canEdit||this.editing)){if(this.beginDraft(),this.editing=!0,this.editHandled=!0,this.filters=v,!e){const t=this.params();G(v,t),t.set("edit","1"),O(_,t)}this.scrollHome()}}beginDraft(){const e=this.view();this.draft=e,this.base=e,this.saveError="",this.conflict=!1}leaveEdit(e=!0){this.editing=!1,this.draft=this.base=null,this.confirm=null,this.busy=!1,this.editHandled=e?!1:this.editHandled,e&&this.dropParam("edit")}get dirty(){return!!this.draft&&!!this.base&&Fe(this.base,this.draft)}askCancel(){this.dirty?this.confirm="cancel":this.leaveEdit()}payload(e){const t=this.doc;if(!e){const i={...t.tabs};return delete i.players,{...t,tabs:i}}return{...qe(t,"players",e),floor_order:!t.floor_order.length&&Qe(e.floor_order,this.homeFloors)?[]:e.floor_order}}async save(e=!1){if(!(!this.draft||this.busy)){this.busy=!0,this.saveError="";try{this.res=await ve().saveLayout(this.payload(e?null:this.draft),this.res.revision),this.leaveEdit(),this.say(e?"חזר לברירת המחדל":"נשמר")}catch(t){t instanceof D&&t.code==="revision_conflict"?this.conflict=!0:this.saveError=R(t),this.busy=!1}}}async reloadAfterConflict(){this.res=await j(),await this.load(),this.beginDraft(),this.conflict=!1}patchDraft(e){this.draft=e}sections(){const e={floors:this.hasFloors,floorOrder:this.floorOrder()};return this.editing&&this.draft?Be(this.devices,this.draft,e):Ie(P(this.devices,this.filters),this.view(),e)}chips(e,t,s){const i=this.draft,a=i.pinned.includes(e.key),n=i.cards[e.key]?.on??!0;return r`<span class="ecard" slot="edit">
      <button type="button" aria-label=${`הקדם · ${e.name}`} title="הקדם" ?disabled=${t===0} @click=${()=>this.patchDraft(K(i,z(this.devices),e.key,-1))}>${h("arrowUp")}</button>
      <button type="button" aria-label=${`אחר · ${e.name}`} title="אחר" ?disabled=${t===s-1} @click=${()=>this.patchDraft(K(i,z(this.devices),e.key,1))}>${h("arrowDown")}</button>
      <button type="button" aria-pressed=${String(a)} aria-label=${`מועדף · ${e.name}`} title="מועדף" @click=${()=>this.patchDraft(Se(i,e.key))}>${h("star")}</button>
      <button type="button" aria-label=${`${n?"הסתר":"הצג"} · ${e.name}`} title=${n?"הסתר":"הצג"} @click=${()=>this.patchDraft(De(i,e.key,{on:!n}))}>${h(n?"eye":"eyeOff")}</button>
    </span>`}card(e,t,s,i=!1){const a=this.editing&&!!this.draft,n=a&&!(this.draft.cards[e.key]?.on??!0),o=e.live.group.role==="member"?ge(e,this.devices):null;return r`<media-player-card data-fit-item ?data-off=${i} data-player-card=${e.key} .device=${e} .leader=${o&&o.key!==e.key?o:null} ?compact=${this.phone} ?editing=${a} ?data-dimmed=${n}
      @open-player=${u=>this.openPlayer(u.detail.key)} @media-changed=${()=>this.scheduleRefresh(F()?700:30)}>${a?this.chips(e,t,s):l}</media-player-card>`}section(e,t=0){const s=C(e.devices),i=m=>!this.fit.shows(t+m),a=e.devices.every((m,f)=>i(f)),n=(this.editing&&this.draft?this.draft:this.view()).group_by,o=!this.editing&&je(e,n,this.hasFloors),u=o&&!!this.status?.can.bulk&&s.playing>0,g=e.id==="pinned"||e.id==="all"||this.editing||!o&&e.id!==$?r`<h2>${k(B(e.label))}</h2>`:r`<h2><button type="button" class="shlink" data-group-open=${e.id} @click=${()=>this.setFilters(e.id===$?{floor:$,area:""}:{floor:e.id,area:""})}>${B(e.label)}${h("chevronBack")}</button></h2>`,b=e.id===$?r`<span class="n">${s.total}</span> ללא חדר`:r`<span class="n">${s.total}</span> התקנים${s.playing?r` · <em><span class="n">${s.playing}</span></em> מנגנים`:l}`,w=u?r`<button type="button" class="btn sm quiet" data-floor-pause=${e.id} @click=${()=>void this.dialog?.pause({scope:"floor",id:e.id,name:e.label})}>${h("pause")}עצור מוזיקה</button>`:l;return r`<section class="fsec" ?data-off=${a} aria-label=${e.label} data-group=${e.id}>
      <header class="sh"><div>${g}<small>${b}</small></div><span class="grow"></span>${w}</header>
      <div class="pgrid">${be(e.devices,m=>m.key,(m,f)=>this.card(m,f,e.devices.length,i(f)))}</div>
    </section>`}roomsAsDropdown(e){const t=this.tabsMode.value;return t==="dropdown"||t==="hybrid"&&e>ye}summary(){if(this.phone||this.editing||this.phase!=="ready"||!this.devices.length)return"";const e=C(this.devices);return`${e.playing?`${e.playing} מנגנים מתוך ${e.total}`:`אין ניגון כרגע · ${e.total} התקנים`}${e.unavailable?` · ${e.unavailable} לא זמין`:""}`}floorAction(){const{floors:e,unplaced:t}=Ue(this.devices,this.floorOrder()),s=this.hasFloors&&(e.length>1||t>0||!!this.filters.floor);return!this.editing&&this.phase==="ready"&&this.devices.length>0&&s?this.floorChip(e,t):l}header(){const e=this.filters,t=this.devices.filter(o=>P([o],{...v,floor:e.floor}).length),s=S(t),i=C(this.devices),a=!this.editing&&this.phase==="ready"&&this.devices.length>0,n=this.status?.library.state;return a?r`<div class=${A({dh:!0,compact:this.compactHeader})} data-mm-header>
      <div class="dh-row">
        ${this.roomsAsDropdown(s.length+1)?r`<span class="grow" data-rooms-in-shell></span>`:r`<div class="rooms" role="group" aria-label="חדרים" @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!e.area)} data-room="" @click=${()=>this.setFilters({area:""})}>הכל</button>
          ${s.map(o=>r`<button type="button" class="rc" aria-pressed=${String(e.area===o.id)} data-room=${o.id} @click=${()=>this.setFilters({area:o.id})}>${k(o.name)}</button>`)}
        </div>`}
      </div>
      <div class="dh-det">
        ${n&&n!=="ready"?r`<span class="chipx libchip" data-lib-state=${n}>${h("music")}ספרייה לא זמינה</span>`:l}
        ${this.fit.pages>1?r`<sw-pager data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${o=>this.fit.go(o.detail.page)}></sw-pager>`:l}
        <div class="seg sm" role="radiogroup" aria-label="סינון לפי מצב">${Ke.map(o=>r`<button type="button" role="radio" aria-checked=${String(e.state===o.id)} data-state-filter=${o.id||"all"} @click=${()=>this.setFilters({state:o.id})}>${o.label}${o.id==="playing"?r` <small>${i.playing}</small>`:o.id==="unavailable"&&i.unavailable?r` <small>${i.unavailable}</small>`:l}</button>`)}</div>
        <label class="search">${h("search")}<span class="vh">חיפוש נגן</span><input type="search" data-search placeholder="חיפוש נגן או חדר" .value=${e.q} @input=${o=>this.onSearch(o.target.value)} /></label>
      </div>
    </div>`:l}floorChip(e,t){const s=[{id:"",label:"כל הקומות",count:this.devices.length,icon:"home"},{id:"--sep",label:"",divider:!0},...e.map(i=>({id:i.id,label:i.name,count:i.count,icon:"layers"}))];return t&&s.push({id:"--sep2",label:"",divider:!0},{id:$,label:I,count:t,icon:"layers"}),r`<div class="flwrap"><sw-dropdown data-floor-menu label="קומות" icon="layers" dd-style=${we("multimedia")} dd-size=${$e("multimedia")} dd-ring=${ke("multimedia")} dd-panel=${xe("multimedia")} .items=${s} .value=${this.filters.floor} @change=${i=>this.setFilters({floor:i.detail.id,area:""})}></sw-dropdown></div>`}skeleton(){const e=r`<div class="glass skc" aria-hidden="true"><span class="skl cv"></span><div class="tx"><span class="skl l1"></span><span class="skl l2"></span></div><span class="skl kn"></span><span class="skl bar"></span></div>`;return r`<div data-mm-state="loading" aria-busy="true"><div class="pgrid">${Array.from({length:this.phone?3:6},()=>e)}</div></div>`}stateBox(e,t,s){return r`<div class="statebox glass" role="status"><span class="ring">${h(e)}</span><b>${t}</b>${s??l}</div>`}editBar(){return r`<div class="editbar" data-mm-editbar>
      <span class="t">${h("edit")}עריכת מסך הנגנים</span>
      <span class="grow"></span>
      ${this.conflict?r`<span class="note-bad" role="alert">המסך נערך במקום אחר</span><button type="button" class="btn sm" @click=${()=>void this.reloadAfterConflict()}>טען מחדש</button>`:l}
      ${this.saveError?r`<span class="note-bad" role="alert">${this.saveError}</span>`:l}
      <button type="button" class="btn sm quiet" data-mm-cancel ?disabled=${this.busy} @click=${()=>this.askCancel()}>ביטול</button>
      <button type="button" class="btn sm quiet dz" data-mm-reset ?disabled=${this.busy} @click=${()=>this.confirm="reset"}>ברירת מחדל</button>
      <button type="button" class="btn sm primary" data-mm-save ?disabled=${this.busy||!this.dirty||this.conflict} @click=${()=>void this.save()}>${h("check")}שמור</button>
    </div>`}confirmDialog(){const e=this.confirm;if(!e)return r`<sw-dialog data-mm-confirm="closed"></sw-dialog>`;const t=e==="reset";return r`<sw-dialog open heading=${t?"להחזיר את מסך הנגנים לברירת המחדל לכולם?":"לבטל את השינויים?"} data-mm-confirm=${e} @close=${()=>this.confirm=null}>
      <div class="dlg-acts">
        <sw-button data-mm-confirm-no autofocus @click=${()=>this.confirm=null}>${t?"ביטול":"המשך עריכה"}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${()=>{t?(this.confirm=null,this.save(!0)):this.leaveEdit()}}>${t?"החזר":"בטל שינויים"}</sw-button>
      </div></sw-dialog>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return r`<div data-mm-state="error">${this.stateBox("warning","לא ניתן לטעון את הנגנים",r`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${h("refresh")}נסה שוב</button>`)}</div>`;if(this.phase==="forbidden")return r`<div data-mm-state="forbidden">${this.stateBox("speaker","אין הרשאת צפייה בנגנים")}</div>`;if(this.phase==="disabled")return r`<div data-mm-state="disabled">${this.stateBox("power","המולטימדיה כבויה")}</div>`;if(!this.devices.length){const n=this.status?.can.configure;return r`<div data-mm-state="empty">${this.stateBox("speaker","אין נגנים",n?r`<a class="btn sm" href="#/system/multimedia">להגדרות</a>`:void 0)}</div>`}const e=this.sections(),t=this.staleError?r`<div class="errbar" role="alert" data-mm-stale>${h("warning")}הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.<button type="button" class="btn sm" @click=${()=>void this.load()}>נסה שוב</button></div>`:l;if(!e.length)return r`${t}<div data-mm-state="filtered">${this.stateBox("search","לא נמצאו נגנים",Ne(this.filters)?r`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.setFilters(v)}>נקה סינון</button>`:void 0)}</div>`;let s=0;const i=e.map(n=>(s+=n.devices.length,s-n.devices.length));this.fit.sync(s,`${e.map(n=>`${n.id}:${n.devices.map(o=>o.key).join(",")}`).join("|")}|${this.phone}`);const a=this.skin.bubble&&!this.editing?this.nowPlaying():null;return r`${t}${a?r`<media-now-hero .device=${a} @media-changed=${()=>this.scheduleRefresh(300)}></media-now-hero>`:l}<div class="groups" data-mm-state="ready">${e.map((n,o)=>this.section(n,i[o]))}</div>`}willUpdate(){this.toggleAttribute("data-fit",this.fit.on)}render(){const e=this.editing&&!!this.draft,t=this.body(),s=this.floorAction();return r`<sw-page class="page" wide heading="נגנים ורמקולים" subheading=${this.summary()} data-screen="multimedia-players">
      ${s===l?l:r`<div slot="actions" class="pacts">${s}</div>`}
      ${this.header()}
      ${e?r`<div class="editing-stack">${this.editBar()}</div>`:l}
      <div class=${A({scr:!0,editing:e})} data-mm-region @scroll=${this.onRegionScroll}>
        ${e?r`<div class="edit-layout"><multimedia-edit-panel class="edit-side" simple heading="נגנים ורמקולים" .draft=${this.draft} .devices=${z(this.devices)} scope="all" .floors=${Re(z(this.devices),this.draft).map(i=>i.id===U?{...i,name:I}:i)} @layout-draft=${i=>this.patchDraft(i.detail)}></multimedia-edit-panel><div class="edit-cards">${t}</div></div>`:t}
      </div>
    </sw-page>
    <media-group-dialog @group-done=${()=>void this.load()}></media-group-dialog>
    ${this.confirmDialog()}
    ${this.playerKey?r`<media-player-panel .deviceKey=${this.playerKey} .open=${!0} @close=${()=>this.closePlayer()}></media-player-panel>`:l}
    ${this.toast?r`<div class="toast" role="status" ${Ee()}>${h("check")}${this.toast}</div>`:l}`}};d.styles=[X,Ae,Y`
    .shlink[disabled] {
      cursor: default;
    }
    .libchip {
      color: var(--dv-warning-text);
      background: var(--dv-warning-soft);
      border-color: transparent;
    }
    .pgrid > media-player-card {
      min-inline-size: 0;
    }
    /* the bubble skin: the pill rows in --sw-grid-min columns (row density = one column), the hero on top */
    :host([data-skin='bubble']) .pgrid {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, max(var(--sw-grid-min), 280px)), 1fr));
      gap: var(--sw-gap-grid);
    }
    :host([data-skin='bubble']) media-now-hero {
      margin-block-end: 4px;
    }
    :host([data-skin='bubble']) .dh.compact {
      background: var(--sw-nav-glass);
      -webkit-backdrop-filter: var(--sw-glass-blur-nav);
      backdrop-filter: var(--sw-glass-blur-nav);
      box-shadow: none;
      border: 0;
    }
    .pacts {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    /* the loading skeleton: one placeholder card per slot, in the card's own geometry */
    .skc {
      display: grid;
      grid-template-columns: var(--mm-cover-size) minmax(0, 1fr) auto;
      gap: var(--sw-s-3) var(--sw-s-4);
      align-items: center;
      padding: var(--sw-s-3) var(--sw-s-4) var(--sw-s-3) var(--sw-s-3);
    }
    .skc .cv {
      inline-size: var(--mm-cover-size);
      block-size: var(--mm-cover-size);
      border-radius: var(--mm-cover-radius);
    }
    .skc .tx {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
    }
    .skc .l1 {
      block-size: 16px;
      inline-size: 55%;
    }
    .skc .l2 {
      block-size: 12px;
      inline-size: 40%;
    }
    .skc .kn {
      inline-size: 50px;
      block-size: 50px;
      border-radius: 50%;
    }
    .skc .bar {
      grid-column: 1 / -1;
      block-size: 40px;
      border-radius: var(--sw-r-pill);
    }
    .dlg-acts {
      display: flex;
      justify-content: flex-end;
      gap: var(--sw-s-2);
      padding-block-start: var(--sw-s-2);
    }
    /* MEDIA-POLISH-2331 (owner rule: a control screen never scrolls on a desktop). Below 1024 px wide - or on a window too short to
       hold the header and a row of cards - the region is transparent (display: contents) and the page scrolls exactly as before, with
       the compacting header. From 1024 x 560 the page takes the screen's height: the header (title, rooms, floors, state filter,
       search) and the edit bar stay in place and only the cards region scrolls, inside its own box. */
    .scr {
      display: contents;
    }
    @media (min-width: 1024px) and (min-height: 560px) {
      :host {
        overflow: hidden;
      }
      /* the shared frame (sw-page) takes the screen's height; its body is a flex column, the region its growing child */
      .page {
        block-size: 100%;
        min-block-size: 0;
        padding-block-end: 0;
      }
      .scr {
        display: block;
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-gutter: stable;
        /* the region spans the page's side padding, so its scrollbar sits at the screen's edge and a focus ring is never clipped */
        margin-inline: calc(-1 * var(--mm-pad));
        padding: var(--sw-s-1) var(--mm-pad) var(--sw-s-8);
      }
      /* NOSCROLL-1366-2437 (audit round 30 #5: this region scrolled 1,537 px at 1366x768, all the cards in one panel): outside the
         editor the region never scrolls; the cards that fit are page 1, the rest are on the next pages (the pager in the filter row) */
      :host([data-fit]) .scr:not(.editing) {
        overflow: hidden;
        scrollbar-gutter: auto;
        padding-block-end: var(--sw-s-5);
      }
      /* the cards of the other pages (and a section with none on this page) stay in the document, out of the layout */
      :host([data-fit]) [data-off] {
        display: none !important;
      }
      /* scrolled: the cards slide out under a soft fade instead of a hard cut against the filters */
      .scr.scrolled {
        -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 var(--sw-s-5));
        mask-image: linear-gradient(180deg, transparent 0, #000 var(--sw-s-5));
      }
    }
    @media (min-width: 1100px) and (min-height: 560px) {
      /* the editor: two panes that scroll on their own; the settings pane and the edit bar never leave the screen */
      .scr.editing {
        overflow: hidden;
        padding-block-end: var(--sw-s-4);
      }
      .scr.editing .edit-layout {
        block-size: 100%;
        align-items: stretch;
      }
      .scr.editing .edit-side {
        position: static;
        max-block-size: none;
        min-block-size: 0;
      }
      .scr.editing .edit-cards {
        min-block-size: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        padding: var(--sw-s-1);
      }
    }
  `];c([V()],d.prototype,"playerKey",2);c([p()],d.prototype,"phase",2);c([p()],d.prototype,"devices",2);c([p()],d.prototype,"status",2);c([p()],d.prototype,"res",2);c([p()],d.prototype,"homeFloors",2);c([p()],d.prototype,"filters",2);c([p()],d.prototype,"compactHeader",2);c([p()],d.prototype,"staleError",2);c([p()],d.prototype,"toast",2);c([p()],d.prototype,"phone",2);c([p()],d.prototype,"editing",2);c([p()],d.prototype,"draft",2);c([p()],d.prototype,"base",2);c([p()],d.prototype,"busy",2);c([p()],d.prototype,"saveError",2);c([p()],d.prototype,"conflict",2);c([p()],d.prototype,"confirm",2);c([Pe("media-group-dialog")],d.prototype,"dialog",2);d=c([Q("multimedia-players")],d);export{d as MultimediaPlayers};
//# sourceMappingURL=multimedia-players-CqTqQIS2.js.map
