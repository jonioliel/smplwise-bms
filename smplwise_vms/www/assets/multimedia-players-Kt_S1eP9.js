import{hb as Y,E as X,F as V,G as u,a as J,hc as Z,hd as Q,hf as E,A as d,hv as ee,hg as te,hi as se,e as i,je as j,ed as C,H as W,j1 as ie,e3 as ae,S as re,e8 as oe,f5 as ne,cy as le,bj as L,i as F,av as de,j2 as A,jf as D,j3 as ce,ce as he,e5 as H,j4 as pe,hC as ue,j as O,Y as S,cB as me,r as R,c$ as fe,e4 as ve,jg as be,q as M,ct as ge,j6 as ye,j7 as we,j8 as $e,j9 as ke,ja as xe,hA as q,dl as Ee,ca as Pe}from"./index-Cx0qJkOE.js";import"./media-player-card-D_ce_5t7.js";import{r as ze,p as _e}from"./media-group-dialog-Duf-4UWx.js";import{g as Te,m as p,n as k}from"./media-now-XDjFYE7t.js";import{l as I,D as Le,a as B,i as Fe,m as U,t as De,k as Oe,o as Se}from"./media-personal-B7tPOL5U.js";import"./sw-pager-BafkMmYy.js";import{P as Re}from"./multimedia-page-fit-aNuqF9pe.js";import{m as Ce,a as je}from"./media-page-zRowab4i.js";import{P as g,p as K,f as P,i as Ae,t as He,a as N,w as Me,e as qe,r as Ie,b as z,c as G,d as Be,U as $,g as Ue,h as Ke,j as Ne}from"./multimedia-players-layout-CSyvdzzM.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-QbFkJ1fQ.js";var Ge=Object.defineProperty,Ye=Object.getOwnPropertyDescriptor,T=(e,t,s,r)=>{for(var a=r>1?void 0:r?Ye(t,s):t,o=e.length-1,n;o>=0;o--)(n=e[o])&&(a=(r?n(t,s,a):n(a))||a);return r&&a&&Ge(t,s,a),a};let y=class extends J{constructor(){super(...arguments),this.device=null,this.pending=new Set,this.note="",this.throttle=new Z,this.ticker=0,this.timers=[]}connectedCallback(){super.connectedCallback(),Q(this)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.ticker),this.ticker=0;for(const e of this.timers)window.clearTimeout(e);this.timers=[]}updated(){const e=this.device,t=!!e&&e.live.play==="playing"&&!!e.live.now.duration_s&&e.live.now.kind!=="station";t&&!this.ticker?this.ticker=window.setInterval(()=>this.requestUpdate(),1e3):!t&&this.ticker&&(window.clearInterval(this.ticker),this.ticker=0)}async send(e,t){const s=this.device;if(!s||!E(s,t)||this.pending.has(e)||!this.throttle.take())return;this.note="";const r=new Set(this.pending);r.add(e),this.pending=r;const a=await ze(s.key,t),o=new Set(this.pending);o.delete(e),this.pending=o,(a.outcome==="not_confirmed"||a.outcome==="refused")&&(this.note=a.message,this.timers.push(window.setTimeout(()=>this.note="",6e3))),this.dispatchEvent(new CustomEvent("media-changed",{detail:{key:s.key,outcome:a.outcome},bubbles:!0,composed:!0}))}render(){const e=this.device;if(!e)return d;const t=_e(e),s=e.live.now,r=t.playing,a=t.kind==="station"?null:ee(s,r,Date.now()),o=s.duration_s??null,n=a!==null&&o?Math.max(0,Math.min(100,a/o*100)):0,m=e.live.volume.level??0,f=te(e),l=e.can.control,w=x=>()=>void this.send(x,{command:"transport",action:x}),v=e.live.group.role==="leader"?e.live.group.member_keys.length+1:0,b=t.artwork?se(t.artwork):"";return i`<section class="hero" style=${`--a1:${t.a1};--a2:${t.a2}`} aria-label=${`מתנגן עכשיו · ${e.name}`} data-now-hero=${e.key} data-playing=${String(r)}>
      <div class="bg" style=${b?`background-image:url("${b}")`:d}></div>
      <div class="veil"></div>
      <div class="in">
        <div class="art">${b?i`<img src=${b} alt="" />`:Te(t.glyph)}</div>
        <div class="meta">
          <div class="chips">
            <span class="chip">${p(e.kind==="player"?"media":"speaker")}${k(e.area_name||e.name)}</span>
            ${v?i`<span class="chip">${p("group")}${v} חדרים</span>`:d}
          </div>
          <div class="ttl" data-now-title>${k(s.title||t.line||e.name)}</div>
          ${s.artist||s.album?i`<div class="sub">${k([s.artist,s.album].filter(Boolean).join(" · "))}</div>`:d}
          ${this.note?i`<div class="bad" role="status">${this.note}</div>`:d}
        </div>
        <div class="bar">
          ${t.kind==="station"?i`<span class="live"><i></i>שידור חי</span><span class="tr"></span><span></span>`:i`<span>${a!==null?j(a):"–:––"}</span><span class="tr" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(n)} style=${`--p:${n}%`}><i></i></span><span>${o?j(o):"–:––"}</span>`}
        </div>
        <div class="keys">
          ${l?i`<span class="tp" role="group" aria-label="ניגון">
                <button type="button" class="k" aria-label="הקודם" ?disabled=${!E(e,{command:"transport",action:"previous"})} @click=${w("previous")}>${p("prev")}</button>
                <button type="button" class=${C({k:!0,main:!0})} aria-label=${r?"השהה":"נגן"} ?disabled=${!E(e,{command:"transport",action:"play_pause"})||this.pending.has("play_pause")} @click=${w("play_pause")}>${p(r?"pause":"play")}</button>
                <button type="button" class="k" aria-label="הבא" ?disabled=${!E(e,{command:"transport",action:"next"})} @click=${w("next")}>${p("next")}</button>
              </span>`:d}
          ${l&&e.caps.volume_set?i`<sw-pill class="vol" variant="slider" icon="volume" label="עוצמה" .state=${`${m}%${e.live.volume.muted?" · מושתק":""}`} .value=${m/100} on keep-text fill-color="var(--sw-accent-soft)" ?unavailable=${this.pending.has("volume")}
                @toggle=${()=>void this.send("mute",{command:"mute",muted:!e.live.volume.muted})} @change=${x=>void this.send("volume",{command:"volume_set",level:Math.max(0,Math.min(f??100,Math.round(x.detail.value*100)))})}></sw-pill>`:d}
        </div>
      </div>
    </section>`}};y.styles=[Y,X`
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
      border-radius: 3px;
      background: var(--sw-layer);
      overflow: hidden;
    }
    .bar .tr i {
      display: block;
      block-size: 100%;
      inline-size: var(--p, 0%);
      background: var(--sw-text);
      border-radius: 3px;
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
      transition: transform 120ms var(--sw-ease);
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
  `];T([V({attribute:!1})],y.prototype,"device",2);T([u()],y.prototype,"pending",2);T([u()],y.prototype,"note",2);y=T([W("media-now-hero")],y);var Xe=Object.defineProperty,Ve=Object.getOwnPropertyDescriptor,h=(e,t,s,r)=>{for(var a=r>1?void 0:r?Ve(t,s):t,o=e.length-1,n;o>=0;o--)(n=e[o])&&(a=(r?n(t,s,a):n(a))||a);return r&&a&&Xe(t,s,a),a};const _="/multimedia/players",Je={installation:ie,personal:null,revision:0,can_edit:!1,can_personalize:!1},Qe=e=>e,We=(e,t)=>JSON.stringify(e)===JSON.stringify(t);let c=class extends J{constructor(){super(...arguments),this.playerKey="",this.phase="loading",this.devices=[],this.status=null,this.res=Je,this.homeFloors=[],this.filters=g,this.compactHeader=!1,this.staleError="",this.toast="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.editing=!1,this.draft=null,this.base=null,this.busy=!1,this.saveError="",this.conflict=!1,this.confirm=null,this.tabsMode=new ae(this,"multimedia"),this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offEdit=null,this.offPush=null,this.refreshTimer=0,this.pollTimer=0,this.toastTimer=0,this.qTimer=0,this.typing=0,this.wantsEdit=!1,this.editHandled=!1,this.pushedPlayer=!1,this.loading=!1,this.homeFloorsLoaded=!1,this.skin=new re(this),this.fit=new Re(this,()=>this.renderRoot.querySelector(".scr"),()=>!this.editing),this.onScroll=()=>{const e=this.scrollTop;!this.compactHeader&&e>60?this.compactHeader=!0:this.compactHeader&&e<12&&(this.compactHeader=!1)},this.onRegionScroll=e=>{const t=e.currentTarget;t.classList.toggle("scrolled",t.scrollTop>2)},this.roomsDrag=e=>{if(e.pointerType!=="mouse"||e.button!==0)return;const t=e.currentTarget,s=e.clientX,r=t.scrollLeft;let a=!1;const o=m=>{Math.abs(m.clientX-s)>4&&(a=!0),a&&(t.classList.add("dragging"),t.scrollLeft=r-(m.clientX-s)*(getComputedStyle(t).direction==="rtl"?-1:1))},n=m=>{if(window.removeEventListener("pointermove",o),window.removeEventListener("pointerup",n),t.classList.remove("dragging"),a){m.preventDefault();const f=l=>l.stopImmediatePropagation();t.addEventListener("click",f,{capture:!0,once:!0}),window.setTimeout(()=>t.removeEventListener("click",f,{capture:!0}),0)}};window.addEventListener("pointermove",o),window.addEventListener("pointerup",n)}}nowPlaying(){const e=this.devices.filter(t=>t.live.group.role!=="member");return e.find(t=>oe(t))??e.find(t=>t.live.power==="on"&&t.live.play==="paused")??null}connectedCallback(){super.connectedCallback(),Q(this),this.phoneMq.addEventListener("change",this.onPhone),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offEdit=ne({id:"multimedia-players-layout",label:"עריכת מסך הנגנים",icon:"edit",can:()=>this.canEdit&&!this.editing,run:()=>this.enterEdit()}),this.offRoute=le(e=>{if(e.mode!=="multimedia"||e.segments[1]!=="players")return;const t=K(e.params);this.filters=this.typing?{...t,q:this.filters.q}:t,this.wantsEdit=e.params.get("edit")==="1",this.wantsEdit||(this.editHandled=!1,this.editing&&this.leaveEdit(!1)),this.requestUpdate()}),this.filters=K(L().params),this.wantsEdit=L().params.get("edit")==="1",this.load(),F()&&(this.offPush=de(e=>{if(e.type==="media_state"){const t=this.devices.find(s=>s.key===e.device_key)?.live.power;this.devices=this.devices.map(s=>s.key===e.device_key?{...s,live:Qe(e.live)}:s),t&&t!==e.live.power&&this.scheduleRefresh(800)}else e.type==="media_devices_changed"&&this.scheduleRefresh(200)},e=>{e&&this.scheduleRefresh(200)})),this.pollTimer=window.setInterval(()=>void this.load(),3e4)}disconnectedCallback(){super.disconnectedCallback(),A(this),this.phoneMq.removeEventListener("change",this.onPhone),this.removeEventListener("scroll",this.onScroll),this.offEdit?.(),this.offRoute?.(),this.offPush?.(),this.offEdit=this.offRoute=this.offPush=null;for(const e of[this.refreshTimer,this.toastTimer,this.qTimer])window.clearTimeout(e);window.clearInterval(this.pollTimer)}syncPair(){const e=this.filters,t=this.devices.filter(a=>P([a],{...g,floor:e.floor}).length),s=D(t);!this.editing&&this.phase==="ready"&&this.devices.length>0&&this.roomsAsDropdown(s.length+1)?ce(this,{group:"multimedia",label:"חדרים",value:e.area,items:[{id:"",label:"הכל",count:t.length,icon:"home"},{id:"--sep",label:"",divider:!0},...s.map(a=>({id:a.id,label:a.name,count:a.count,icon:"door"}))],onPick:a=>this.setFilters({area:a})}):A(this)}updated(){this.syncPair(),Ce(this.renderRoot,this.phone),this.wantsEdit&&!this.editHandled&&this.phase==="ready"&&(this.editHandled=!0,this.editing||(this.canEdit?this.enterEdit(!0):this.dropParam("edit")))}get canEdit(){return this.phase==="ready"&&this.res.can_edit&&!he("layout_editor")}async load(){if(!this.loading){this.loading=!0;try{const e=await H().status();if(this.status=e,pe(e.counts),!e.enabled){this.phase="disabled";return}if(!e.can.read){this.phase="forbidden";return}const[t,s]=await Promise.allSettled([H().list({kind:ue}),I()]);if(t.status==="rejected")throw t.reason;this.devices=t.value.devices,s.status==="fulfilled"&&!this.editing&&(this.res=s.value),!this.homeFloorsLoaded&&!this.res.installation.floor_order.length&&await this.loadHomeFloors(),this.phase="ready",this.staleError=""}catch(e){e instanceof O&&e.status===403?this.phase="forbidden":e instanceof O&&e.code==="feature_disabled"?this.phase="disabled":this.phase==="ready"?this.staleError=S(e):(this.phase="error",this.staleError=S(e))}finally{this.loading=!1}}}async loadHomeFloors(){if(this.homeFloorsLoaded=!0,!F()){this.homeFloors=Le;return}try{this.homeFloors=(await me()).floors.map(e=>e.floor_id).filter(e=>e!==B)}catch{this.homeFloors=[]}}get doc(){return this.res.installation}floorOrder(){return this.doc.floor_order.length?this.doc.floor_order:this.homeFloors}get hasFloors(){return Ae(this.status,this.devices)}view(){return He(this.doc,"players",this.floorOrder())}scheduleRefresh(e){window.clearTimeout(this.refreshTimer),this.refreshTimer=window.setTimeout(()=>void this.load(),e)}say(e){this.toast=e,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",3200)}params(){return new URLSearchParams(L().params)}dropParam(e){const t=this.params();t.delete(e),R(_,t)}setFilters(e,t=!0){this.filters={...this.filters,...e},e.floor!==void 0&&e.area===void 0&&this.filters.area&&(D(this.devices.filter(a=>!this.filters.floor||P([a],{...g,floor:this.filters.floor}).length)).some(a=>a.id===this.filters.area)||(this.filters={...this.filters,area:""}));const s=()=>R(_,N(this.filters,this.params()));window.clearTimeout(this.qTimer),t?s():this.qTimer=window.setTimeout(s,300)}onSearch(e){this.typing=Date.now(),this.setFilters({q:e},!1),window.setTimeout(()=>{Date.now()-this.typing>=900&&(this.typing=0)},950)}scrollHome(){this.scrollTo({top:0}),this.renderRoot.querySelector(".scr")?.scrollTo({top:0})}openPlayer(e){const t=this.params();t.set("player",e),this.pushedPlayer=!0,fe(_,t)}closePlayer(){this.pushedPlayer?(this.pushedPlayer=!1,window.history.back()):this.dropParam("player"),this.scheduleRefresh(250)}enterEdit(e=!1){if(!(!this.canEdit||this.editing)){if(this.beginDraft(),this.editing=!0,this.editHandled=!0,this.filters=g,!e){const t=this.params();N(g,t),t.set("edit","1"),R(_,t)}this.scrollHome()}}beginDraft(){const e=this.view();this.draft=e,this.base=e,this.saveError="",this.conflict=!1}leaveEdit(e=!0){this.editing=!1,this.draft=this.base=null,this.confirm=null,this.busy=!1,this.editHandled=e?!1:this.editHandled,e&&this.dropParam("edit")}get dirty(){return!!this.draft&&!!this.base&&Fe(this.base,this.draft)}askCancel(){this.dirty?this.confirm="cancel":this.leaveEdit()}payload(e){const t=this.doc;if(!e){const r={...t.tabs};return delete r.players,{...t,tabs:r}}return{...Me(t,"players",e),floor_order:!t.floor_order.length&&We(e.floor_order,this.homeFloors)?[]:e.floor_order}}async save(e=!1){if(!(!this.draft||this.busy)){this.busy=!0,this.saveError="";try{this.res=await ve().saveLayout(this.payload(e?null:this.draft),this.res.revision),this.leaveEdit(),this.say(e?"חזר לברירת המחדל":"נשמר")}catch(t){t instanceof O&&t.code==="revision_conflict"?this.conflict=!0:this.saveError=S(t),this.busy=!1}}}async reloadAfterConflict(){this.res=await I(),await this.load(),this.beginDraft(),this.conflict=!1}patchDraft(e){this.draft=e}sections(){const e={floors:this.hasFloors,floorOrder:this.floorOrder()};return this.editing&&this.draft?qe(this.devices,this.draft,e):Ie(P(this.devices,this.filters),this.view(),e)}chips(e,t,s){const r=this.draft,a=r.pinned.includes(e.key),o=r.cards[e.key]?.on??!0;return i`<span class="ecard" slot="edit">
      <button type="button" aria-label=${`הקדם · ${e.name}`} title="הקדם" ?disabled=${t===0} @click=${()=>this.patchDraft(U(r,z(this.devices),e.key,-1))}>${p("arrowUp")}</button>
      <button type="button" aria-label=${`אחר · ${e.name}`} title="אחר" ?disabled=${t===s-1} @click=${()=>this.patchDraft(U(r,z(this.devices),e.key,1))}>${p("arrowDown")}</button>
      <button type="button" aria-pressed=${String(a)} aria-label=${`מועדף · ${e.name}`} title="מועדף" @click=${()=>this.patchDraft(De(r,e.key))}>${p("star")}</button>
      <button type="button" aria-label=${`${o?"הסתר":"הצג"} · ${e.name}`} title=${o?"הסתר":"הצג"} @click=${()=>this.patchDraft(Oe(r,e.key,{on:!o}))}>${p(o?"eye":"eyeOff")}</button>
    </span>`}card(e,t,s,r=!1){const a=this.editing&&!!this.draft,o=a&&!(this.draft.cards[e.key]?.on??!0),n=e.live.group.role==="member"?be(e,this.devices):null;return i`<media-player-card data-fit-item ?data-off=${r} data-player-card=${e.key} .device=${e} .leader=${n&&n.key!==e.key?n:null} ?compact=${this.phone} ?editing=${a} ?data-dimmed=${o}
      @open-player=${m=>this.openPlayer(m.detail.key)} @media-changed=${()=>this.scheduleRefresh(F()?700:30)}>${a?this.chips(e,t,s):d}</media-player-card>`}section(e,t=0){const s=G(e.devices),r=v=>!this.fit.shows(t+v),a=e.devices.every((v,b)=>r(b)),o=(this.editing&&this.draft?this.draft:this.view()).group_by,n=!this.editing&&Be(e,o,this.hasFloors),m=n&&!!this.status?.can.bulk&&s.playing>0,f=e.id==="pinned"||e.id==="all"||this.editing||!n&&e.id!==$?i`<h2>${k(M(e.label))}</h2>`:i`<h2><button type="button" class="shlink" data-group-open=${e.id} @click=${()=>this.setFilters(e.id===$?{floor:$,area:""}:{floor:e.id,area:""})}>${M(e.label)}${p("chevronBack")}</button></h2>`,l=e.id===$?i`<span class="n">${s.total}</span> ללא חדר`:i`<span class="n">${s.total}</span> התקנים${s.playing?i` · <em><span class="n">${s.playing}</span></em> מנגנים`:d}`,w=m?i`<button type="button" class="btn sm quiet" data-floor-pause=${e.id} @click=${()=>void this.dialog?.pause({scope:"floor",id:e.id,name:e.label})}>${p("pause")}עצור מוזיקה</button>`:d;return i`<section class="fsec" ?data-off=${a} aria-label=${e.label} data-group=${e.id}>
      <header class="sh"><div>${f}<small>${l}</small></div><span class="grow"></span>${w}</header>
      <div class="pgrid">${ge(e.devices,v=>v.key,(v,b)=>this.card(v,b,e.devices.length,r(b)))}</div>
    </section>`}roomsAsDropdown(e){const t=this.tabsMode.value;return t==="dropdown"||t==="hybrid"&&e>ye}header(){const e=this.filters,t=this.devices.filter(l=>P([l],{...g,floor:e.floor}).length),s=D(t),r=G(this.devices),{floors:a,unplaced:o}=Ue(this.devices,this.floorOrder()),n=this.hasFloors&&(a.length>1||o>0||!!e.floor),m=!this.editing&&this.phase==="ready"&&this.devices.length>0,f=this.status?.library.state;return i`<header class=${C({dh:!0,compact:this.compactHeader})} data-mm-header>
      <div class="dh-row">
        <h1>נגנים ורמקולים</h1>
        ${m&&this.roomsAsDropdown(s.length+1)?i`<span class="grow" data-rooms-in-shell></span>`:m?i`<div class="rooms" role="group" aria-label="חדרים" @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!e.area)} data-room="" @click=${()=>this.setFilters({area:""})}>הכל</button>
          ${s.map(l=>i`<button type="button" class="rc" aria-pressed=${String(e.area===l.id)} data-room=${l.id} @click=${()=>this.setFilters({area:l.id})}>${k(l.name)}</button>`)}
        </div>`:i`<span class="grow"></span>`}
        ${m&&n?this.floorChip(a,o):d}
      </div>
      ${m?i`<div class="dh-det">
        <span class="amb">${r.playing?i`<em><span class="n">${r.playing}</span></em> מנגנים מתוך <span class="n">${r.total}</span>`:i`אין ניגון כרגע · <span class="n">${r.total}</span> התקנים`}${r.unavailable?i` · <span class="n">${r.unavailable}</span> לא זמין`:d}</span>
        ${f&&f!=="ready"?i`<span class="chipx libchip" data-lib-state=${f}>${p("music")}ספרייה לא זמינה</span>`:d}
        <span class="grow"></span>
        ${this.fit.pages>1?i`<sw-pager data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${l=>this.fit.go(l.detail.page)}></sw-pager>`:d}
        <div class="seg sm" role="radiogroup" aria-label="סינון לפי מצב">${Ke.map(l=>i`<button type="button" role="radio" aria-checked=${String(e.state===l.id)} data-state-filter=${l.id||"all"} @click=${()=>this.setFilters({state:l.id})}>${l.label}${l.id==="playing"?i` <small>${r.playing}</small>`:l.id==="unavailable"&&r.unavailable?i` <small>${r.unavailable}</small>`:d}</button>`)}</div>
        <label class="search">${p("search")}<span class="vh">חיפוש נגן</span><input type="search" data-search placeholder="חיפוש נגן או חדר" .value=${e.q} @input=${l=>this.onSearch(l.target.value)} /></label>
      </div>`:d}
    </header>`}floorChip(e,t){const s=[{id:"",label:"כל הקומות",count:this.devices.length,icon:"home"},{id:"--sep",label:"",divider:!0},...e.map(r=>({id:r.id,label:r.name,count:r.count,icon:"layers"}))];return t&&s.push({id:"--sep2",label:"",divider:!0},{id:$,label:q,count:t,icon:"layers"}),i`<div class="flwrap"><sw-dropdown data-floor-menu label="קומות" icon="layers" dd-style=${we("multimedia")} dd-size=${$e("multimedia")} dd-ring=${ke("multimedia")} dd-panel=${xe("multimedia")} .items=${s} .value=${this.filters.floor} @change=${r=>this.setFilters({floor:r.detail.id,area:""})}></sw-dropdown></div>`}skeleton(){const e=i`<div class="glass skc" aria-hidden="true"><span class="skl cv"></span><div class="tx"><span class="skl l1"></span><span class="skl l2"></span></div><span class="skl kn"></span><span class="skl bar"></span></div>`;return i`<div data-mm-state="loading" aria-busy="true"><div class="pgrid">${Array.from({length:this.phone?3:6},()=>e)}</div></div>`}stateBox(e,t,s){return i`<div class="statebox glass" role="status"><span class="ring">${p(e)}</span><b>${t}</b>${s??d}</div>`}editBar(){return i`<div class="editbar" data-mm-editbar>
      <span class="t">${p("edit")}עריכת מסך הנגנים</span>
      <span class="grow"></span>
      ${this.conflict?i`<span class="note-bad" role="alert">המסך נערך במקום אחר</span><button type="button" class="btn sm" @click=${()=>void this.reloadAfterConflict()}>טען מחדש</button>`:d}
      ${this.saveError?i`<span class="note-bad" role="alert">${this.saveError}</span>`:d}
      <button type="button" class="btn sm quiet" data-mm-cancel ?disabled=${this.busy} @click=${()=>this.askCancel()}>ביטול</button>
      <button type="button" class="btn sm quiet dz" data-mm-reset ?disabled=${this.busy} @click=${()=>this.confirm="reset"}>ברירת מחדל</button>
      <button type="button" class="btn sm primary" data-mm-save ?disabled=${this.busy||!this.dirty||this.conflict} @click=${()=>void this.save()}>${p("check")}שמור</button>
    </div>`}confirmDialog(){const e=this.confirm;if(!e)return i`<sw-dialog data-mm-confirm="closed"></sw-dialog>`;const t=e==="reset";return i`<sw-dialog open heading=${t?"להחזיר את מסך הנגנים לברירת המחדל לכולם?":"לבטל את השינויים?"} data-mm-confirm=${e} @close=${()=>this.confirm=null}>
      <div class="dlg-acts">
        <sw-button data-mm-confirm-no autofocus @click=${()=>this.confirm=null}>${t?"ביטול":"המשך עריכה"}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${()=>{t?(this.confirm=null,this.save(!0)):this.leaveEdit()}}>${t?"החזר":"בטל שינויים"}</sw-button>
      </div></sw-dialog>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return i`<div data-mm-state="error">${this.stateBox("warning","לא ניתן לטעון את הנגנים",i`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${p("refresh")}נסה שוב</button>`)}</div>`;if(this.phase==="forbidden")return i`<div data-mm-state="forbidden">${this.stateBox("speaker","אין הרשאת צפייה בנגנים")}</div>`;if(this.phase==="disabled")return i`<div data-mm-state="disabled">${this.stateBox("power","המולטימדיה כבויה")}</div>`;if(!this.devices.length){const o=this.status?.can.configure;return i`<div data-mm-state="empty">${this.stateBox("speaker","אין נגנים",o?i`<a class="btn sm" href="#/system/multimedia">להגדרות</a>`:void 0)}</div>`}const e=this.sections(),t=this.staleError?i`<div class="errbar" role="alert" data-mm-stale>${p("warning")}הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.<button type="button" class="btn sm" @click=${()=>void this.load()}>נסה שוב</button></div>`:d;if(!e.length)return i`${t}<div data-mm-state="filtered">${this.stateBox("search","לא נמצאו נגנים",Ne(this.filters)?i`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.setFilters(g)}>נקה סינון</button>`:void 0)}</div>`;let s=0;const r=e.map(o=>(s+=o.devices.length,s-o.devices.length));this.fit.sync(s,`${e.map(o=>`${o.id}:${o.devices.map(n=>n.key).join(",")}`).join("|")}|${this.phone}`);const a=this.skin.bubble&&!this.editing?this.nowPlaying():null;return i`${t}${a?i`<media-now-hero .device=${a} @media-changed=${()=>this.scheduleRefresh(300)}></media-now-hero>`:d}<div class="groups" data-mm-state="ready">${e.map((o,n)=>this.section(o,r[n]))}</div>`}willUpdate(){this.toggleAttribute("data-fit",this.fit.on)}render(){const e=this.editing&&!!this.draft,t=this.body();return i`<div class="page" data-screen="multimedia-players">
      ${this.header()}
      ${e?i`<div class="editing-stack">${this.editBar()}</div>`:d}
      <div class=${C({scr:!0,editing:e})} data-mm-region @scroll=${this.onRegionScroll}>
        ${e?i`<div class="edit-layout"><multimedia-edit-panel class="edit-side" simple heading="נגנים ורמקולים" .draft=${this.draft} .devices=${z(this.devices)} scope="all" .floors=${Se(z(this.devices),this.draft).map(s=>s.id===B?{...s,name:q}:s)} @layout-draft=${s=>this.patchDraft(s.detail)}></multimedia-edit-panel><div class="edit-cards">${t}</div></div>`:t}
      </div>
    </div>
    <media-group-dialog @group-done=${()=>void this.load()}></media-group-dialog>
    ${this.confirmDialog()}
    ${this.playerKey?i`<media-player-panel .deviceKey=${this.playerKey} .open=${!0} @close=${()=>this.closePlayer()}></media-player-panel>`:d}
    ${this.toast?i`<div class="toast" role="status" ${Ee()}>${p("check")}${this.toast}</div>`:d}`}};c.styles=[Y,je,X`
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
    :host([data-skin='bubble']) .page {
      gap: 18px;
    }
    :host([data-skin='bubble']) .dh.compact {
      background: var(--sw-nav-glass);
      -webkit-backdrop-filter: var(--sw-glass-blur-nav);
      backdrop-filter: var(--sw-glass-blur-nav);
      box-shadow: none;
      border: 0;
    }
    /* MEDIA-POLISH-2331: the room chips show where the keyboard is (the shared chip has no focus ring) */
    .rc:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
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
      .page {
        block-size: 100%;
        min-block-size: 0;
        padding-block-end: 0;
        gap: var(--sw-s-4);
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
        margin-inline: -36px;
        padding: var(--sw-s-1) 36px var(--sw-s-8);
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
  `];h([V()],c.prototype,"playerKey",2);h([u()],c.prototype,"phase",2);h([u()],c.prototype,"devices",2);h([u()],c.prototype,"status",2);h([u()],c.prototype,"res",2);h([u()],c.prototype,"homeFloors",2);h([u()],c.prototype,"filters",2);h([u()],c.prototype,"compactHeader",2);h([u()],c.prototype,"staleError",2);h([u()],c.prototype,"toast",2);h([u()],c.prototype,"phone",2);h([u()],c.prototype,"editing",2);h([u()],c.prototype,"draft",2);h([u()],c.prototype,"base",2);h([u()],c.prototype,"busy",2);h([u()],c.prototype,"saveError",2);h([u()],c.prototype,"conflict",2);h([u()],c.prototype,"confirm",2);h([Pe("media-group-dialog")],c.prototype,"dialog",2);c=h([W("multimedia-players")],c);export{c as MultimediaPlayers};
//# sourceMappingURL=multimedia-players-Kt_S1eP9.js.map
