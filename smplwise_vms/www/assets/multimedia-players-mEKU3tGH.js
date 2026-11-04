import{hS as Y,E as X,F as V,G as u,a as J,hT as Q,hU as W,hW as k,A as n,ic as ee,hX as te,hZ as se,e as a,iz as A,dG as R,H as Z,il as ie,du as ae,S as re,dA as oe,ew as ne,b$ as le,aB as T,i as L,bt as de,im as H,iA as F,io as ce,bw as he,dw as M,ip as pe,ik as ue,j as D,T as S,c2 as me,r as O,cn as fe,dv as ve,iB as be,q,bW as ge,ir as ye,is as we,it as $e,iu as ke,iv as xe,ii as B,cM as Ee,br as ze}from"./index-xLRE7Qht.js";import"./media-player-card-BY_-cAe8.js";import{r as Pe,p as _e}from"./media-group-dialog-BQ95ap1h.js";import{g as Te,m as p,n as y}from"./media-now-BmBBtXZ4.js";import{l as I,D as Le,a as j,i as Fe,m as U,t as De,k as Se,o as Oe}from"./media-personal-DHCyujEp.js";import{m as Re,a as Ce}from"./media-page-BsTMJnex.js";import{P as v,p as K,f as x,i as Ae,t as He,a as G,w as Me,e as qe,r as Be,b as E,c as N,d as Ie,U as g,g as je,h as Ue,j as Ke}from"./multimedia-players-layout-CrupbA86.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-Drn5_bqn.js";var Ge=Object.defineProperty,Ne=Object.getOwnPropertyDescriptor,P=(e,t,i,s)=>{for(var r=s>1?void 0:s?Ne(t,i):t,o=e.length-1,h;o>=0;o--)(h=e[o])&&(r=(s?h(t,i,r):h(r))||r);return s&&r&&Ge(t,i,r),r};let b=class extends J{constructor(){super(...arguments),this.device=null,this.pending=new Set,this.note="",this.throttle=new Q,this.ticker=0,this.timers=[]}connectedCallback(){super.connectedCallback(),W(this)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.ticker),this.ticker=0;for(const e of this.timers)window.clearTimeout(e);this.timers=[]}updated(){const e=this.device,t=!!e&&e.live.play==="playing"&&!!e.live.now.duration_s&&e.live.now.kind!=="station";t&&!this.ticker?this.ticker=window.setInterval(()=>this.requestUpdate(),1e3):!t&&this.ticker&&(window.clearInterval(this.ticker),this.ticker=0)}async send(e,t){const i=this.device;if(!i||!k(i,t)||this.pending.has(e)||!this.throttle.take())return;this.note="";const s=new Set(this.pending);s.add(e),this.pending=s;const r=await Pe(i.key,t),o=new Set(this.pending);o.delete(e),this.pending=o,(r.outcome==="not_confirmed"||r.outcome==="refused")&&(this.note=r.message,this.timers.push(window.setTimeout(()=>this.note="",6e3))),this.dispatchEvent(new CustomEvent("media-changed",{detail:{key:i.key,outcome:r.outcome},bubbles:!0,composed:!0}))}render(){const e=this.device;if(!e)return n;const t=_e(e),i=e.live.now,s=t.playing,r=t.kind==="station"?null:ee(i,s,Date.now()),o=i.duration_s??null,h=r!==null&&o?Math.max(0,Math.min(100,r/o*100)):0,m=e.live.volume.level??0,f=te(e),l=e.can.control,_=$=>()=>void this.send($,{command:"transport",action:$}),C=e.live.group.role==="leader"?e.live.group.member_keys.length+1:0,w=t.artwork?se(t.artwork):"";return a`<section class="hero" style=${`--a1:${t.a1};--a2:${t.a2}`} aria-label=${`מתנגן עכשיו · ${e.name}`} data-now-hero=${e.key} data-playing=${String(s)}>
      <div class="bg" style=${w?`background-image:url("${w}")`:n}></div>
      <div class="veil"></div>
      <div class="in">
        <div class="art">${w?a`<img src=${w} alt="" />`:Te(t.glyph)}</div>
        <div class="meta">
          <div class="chips">
            <span class="chip">${p(e.kind==="player"?"media":"speaker")}${y(e.area_name||e.name)}</span>
            ${C?a`<span class="chip">${p("group")}${C} חדרים</span>`:n}
          </div>
          <div class="ttl" data-now-title>${y(i.title||t.line||e.name)}</div>
          ${i.artist||i.album?a`<div class="sub">${y([i.artist,i.album].filter(Boolean).join(" · "))}</div>`:n}
          ${this.note?a`<div class="bad" role="status">${this.note}</div>`:n}
        </div>
        <div class="bar">
          ${t.kind==="station"?a`<span class="live"><i></i>שידור חי</span><span class="tr"></span><span></span>`:a`<span>${r!==null?A(r):"–:––"}</span><span class="tr" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(h)} style=${`--p:${h}%`}><i></i></span><span>${o?A(o):"–:––"}</span>`}
        </div>
        <div class="keys">
          ${l?a`<span class="tp" role="group" aria-label="ניגון">
                <button type="button" class="k" aria-label="הקודם" ?disabled=${!k(e,{command:"transport",action:"previous"})} @click=${_("previous")}>${p("prev")}</button>
                <button type="button" class=${R({k:!0,main:!0})} aria-label=${s?"השהה":"נגן"} ?disabled=${!k(e,{command:"transport",action:"play_pause"})||this.pending.has("play_pause")} @click=${_("play_pause")}>${p(s?"pause":"play")}</button>
                <button type="button" class="k" aria-label="הבא" ?disabled=${!k(e,{command:"transport",action:"next"})} @click=${_("next")}>${p("next")}</button>
              </span>`:n}
          ${l&&e.caps.volume_set?a`<sw-pill class="vol" variant="slider" icon="volume" label="עוצמה" .state=${`${m}%${e.live.volume.muted?" · מושתק":""}`} .value=${m/100} on keep-text fill-color="var(--sw-accent-soft)" ?unavailable=${this.pending.has("volume")}
                @toggle=${()=>void this.send("mute",{command:"mute",muted:!e.live.volume.muted})} @change=${$=>void this.send("volume",{command:"volume_set",level:Math.max(0,Math.min(f??100,Math.round($.detail.value*100)))})}></sw-pill>`:n}
        </div>
      </div>
    </section>`}};b.styles=[Y,X`
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
  `];P([V({attribute:!1})],b.prototype,"device",2);P([u()],b.prototype,"pending",2);P([u()],b.prototype,"note",2);b=P([Z("media-now-hero")],b);var Ye=Object.defineProperty,Xe=Object.getOwnPropertyDescriptor,c=(e,t,i,s)=>{for(var r=s>1?void 0:s?Xe(t,i):t,o=e.length-1,h;o>=0;o--)(h=e[o])&&(r=(s?h(t,i,r):h(r))||r);return s&&r&&Ye(t,i,r),r};const z="/multimedia/players",Ve={installation:ie,personal:null,revision:0,can_edit:!1,can_personalize:!1},Je=e=>e,We=(e,t)=>JSON.stringify(e)===JSON.stringify(t);let d=class extends J{constructor(){super(...arguments),this.playerKey="",this.phase="loading",this.devices=[],this.status=null,this.res=Ve,this.homeFloors=[],this.filters=v,this.compactHeader=!1,this.staleError="",this.toast="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.editing=!1,this.draft=null,this.base=null,this.busy=!1,this.saveError="",this.conflict=!1,this.confirm=null,this.tabsMode=new ae(this,"multimedia"),this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offRoute=null,this.offEdit=null,this.offPush=null,this.refreshTimer=0,this.pollTimer=0,this.toastTimer=0,this.qTimer=0,this.typing=0,this.wantsEdit=!1,this.editHandled=!1,this.pushedPlayer=!1,this.loading=!1,this.homeFloorsLoaded=!1,this.skin=new re(this),this.onScroll=()=>{const e=this.scrollTop;!this.compactHeader&&e>60?this.compactHeader=!0:this.compactHeader&&e<12&&(this.compactHeader=!1)},this.onRegionScroll=e=>{const t=e.currentTarget;t.classList.toggle("scrolled",t.scrollTop>2)},this.roomsDrag=e=>{if(e.pointerType!=="mouse"||e.button!==0)return;const t=e.currentTarget,i=e.clientX,s=t.scrollLeft;let r=!1;const o=m=>{Math.abs(m.clientX-i)>4&&(r=!0),r&&(t.classList.add("dragging"),t.scrollLeft=s-(m.clientX-i)*(getComputedStyle(t).direction==="rtl"?-1:1))},h=m=>{if(window.removeEventListener("pointermove",o),window.removeEventListener("pointerup",h),t.classList.remove("dragging"),r){m.preventDefault();const f=l=>l.stopImmediatePropagation();t.addEventListener("click",f,{capture:!0,once:!0}),window.setTimeout(()=>t.removeEventListener("click",f,{capture:!0}),0)}};window.addEventListener("pointermove",o),window.addEventListener("pointerup",h)}}nowPlaying(){const e=this.devices.filter(t=>t.live.group.role!=="member");return e.find(t=>oe(t))??e.find(t=>t.live.power==="on"&&t.live.play==="paused")??null}connectedCallback(){super.connectedCallback(),W(this),this.phoneMq.addEventListener("change",this.onPhone),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offEdit=ne({id:"multimedia-players-layout",label:"עריכת מסך הנגנים",icon:"edit",can:()=>this.canEdit&&!this.editing,run:()=>this.enterEdit()}),this.offRoute=le(e=>{if(e.mode!=="multimedia"||e.segments[1]!=="players")return;const t=K(e.params);this.filters=this.typing?{...t,q:this.filters.q}:t,this.wantsEdit=e.params.get("edit")==="1",this.wantsEdit||(this.editHandled=!1,this.editing&&this.leaveEdit(!1)),this.requestUpdate()}),this.filters=K(T().params),this.wantsEdit=T().params.get("edit")==="1",this.load(),L()&&(this.offPush=de(e=>{if(e.type==="media_state"){const t=this.devices.find(i=>i.key===e.device_key)?.live.power;this.devices=this.devices.map(i=>i.key===e.device_key?{...i,live:Je(e.live)}:i),t&&t!==e.live.power&&this.scheduleRefresh(800)}else e.type==="media_devices_changed"&&this.scheduleRefresh(200)},e=>{e&&this.scheduleRefresh(200)})),this.pollTimer=window.setInterval(()=>void this.load(),3e4)}disconnectedCallback(){super.disconnectedCallback(),H(this),this.phoneMq.removeEventListener("change",this.onPhone),this.removeEventListener("scroll",this.onScroll),this.offEdit?.(),this.offRoute?.(),this.offPush?.(),this.offEdit=this.offRoute=this.offPush=null;for(const e of[this.refreshTimer,this.toastTimer,this.qTimer])window.clearTimeout(e);window.clearInterval(this.pollTimer)}syncPair(){const e=this.filters,t=this.devices.filter(r=>x([r],{...v,floor:e.floor}).length),i=F(t);!this.editing&&this.phase==="ready"&&this.devices.length>0&&this.roomsAsDropdown(i.length+1)?ce(this,{group:"multimedia",label:"חדרים",value:e.area,items:[{id:"",label:"הכל",count:t.length,icon:"home"},{id:"--sep",label:"",divider:!0},...i.map(r=>({id:r.id,label:r.name,count:r.count,icon:"door"}))],onPick:r=>this.setFilters({area:r})}):H(this)}updated(){this.syncPair(),Re(this.renderRoot,this.phone),this.wantsEdit&&!this.editHandled&&this.phase==="ready"&&(this.editHandled=!0,this.editing||(this.canEdit?this.enterEdit(!0):this.dropParam("edit")))}get canEdit(){return this.phase==="ready"&&this.res.can_edit&&!he("layout_editor")}async load(){if(!this.loading){this.loading=!0;try{const e=await M().status();if(this.status=e,pe(e.counts),!e.enabled){this.phase="disabled";return}if(!e.can.read){this.phase="forbidden";return}const[t,i]=await Promise.allSettled([M().list({kind:ue}),I()]);if(t.status==="rejected")throw t.reason;this.devices=t.value.devices,i.status==="fulfilled"&&!this.editing&&(this.res=i.value),!this.homeFloorsLoaded&&!this.res.installation.floor_order.length&&await this.loadHomeFloors(),this.phase="ready",this.staleError=""}catch(e){e instanceof D&&e.status===403?this.phase="forbidden":e instanceof D&&e.code==="feature_disabled"?this.phase="disabled":this.phase==="ready"?this.staleError=S(e):(this.phase="error",this.staleError=S(e))}finally{this.loading=!1}}}async loadHomeFloors(){if(this.homeFloorsLoaded=!0,!L()){this.homeFloors=Le;return}try{this.homeFloors=(await me()).floors.map(e=>e.floor_id).filter(e=>e!==j)}catch{this.homeFloors=[]}}get doc(){return this.res.installation}floorOrder(){return this.doc.floor_order.length?this.doc.floor_order:this.homeFloors}get hasFloors(){return Ae(this.status,this.devices)}view(){return He(this.doc,"players",this.floorOrder())}scheduleRefresh(e){window.clearTimeout(this.refreshTimer),this.refreshTimer=window.setTimeout(()=>void this.load(),e)}say(e){this.toast=e,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",3200)}params(){return new URLSearchParams(T().params)}dropParam(e){const t=this.params();t.delete(e),O(z,t)}setFilters(e,t=!0){this.filters={...this.filters,...e},e.floor!==void 0&&e.area===void 0&&this.filters.area&&(F(this.devices.filter(r=>!this.filters.floor||x([r],{...v,floor:this.filters.floor}).length)).some(r=>r.id===this.filters.area)||(this.filters={...this.filters,area:""}));const i=()=>O(z,G(this.filters,this.params()));window.clearTimeout(this.qTimer),t?i():this.qTimer=window.setTimeout(i,300)}onSearch(e){this.typing=Date.now(),this.setFilters({q:e},!1),window.setTimeout(()=>{Date.now()-this.typing>=900&&(this.typing=0)},950)}scrollHome(){this.scrollTo({top:0}),this.renderRoot.querySelector(".scr")?.scrollTo({top:0})}openPlayer(e){const t=this.params();t.set("player",e),this.pushedPlayer=!0,fe(z,t)}closePlayer(){this.pushedPlayer?(this.pushedPlayer=!1,window.history.back()):this.dropParam("player"),this.scheduleRefresh(250)}enterEdit(e=!1){if(!(!this.canEdit||this.editing)){if(this.beginDraft(),this.editing=!0,this.editHandled=!0,this.filters=v,!e){const t=this.params();G(v,t),t.set("edit","1"),O(z,t)}this.scrollHome()}}beginDraft(){const e=this.view();this.draft=e,this.base=e,this.saveError="",this.conflict=!1}leaveEdit(e=!0){this.editing=!1,this.draft=this.base=null,this.confirm=null,this.busy=!1,this.editHandled=e?!1:this.editHandled,e&&this.dropParam("edit")}get dirty(){return!!this.draft&&!!this.base&&Fe(this.base,this.draft)}askCancel(){this.dirty?this.confirm="cancel":this.leaveEdit()}payload(e){const t=this.doc;if(!e){const s={...t.tabs};return delete s.players,{...t,tabs:s}}return{...Me(t,"players",e),floor_order:!t.floor_order.length&&We(e.floor_order,this.homeFloors)?[]:e.floor_order}}async save(e=!1){if(!(!this.draft||this.busy)){this.busy=!0,this.saveError="";try{this.res=await ve().saveLayout(this.payload(e?null:this.draft),this.res.revision),this.leaveEdit(),this.say(e?"חזר לברירת המחדל":"נשמר")}catch(t){t instanceof D&&t.code==="revision_conflict"?this.conflict=!0:this.saveError=S(t),this.busy=!1}}}async reloadAfterConflict(){this.res=await I(),await this.load(),this.beginDraft(),this.conflict=!1}patchDraft(e){this.draft=e}sections(){const e={floors:this.hasFloors,floorOrder:this.floorOrder()};return this.editing&&this.draft?qe(this.devices,this.draft,e):Be(x(this.devices,this.filters),this.view(),e)}chips(e,t,i){const s=this.draft,r=s.pinned.includes(e.key),o=s.cards[e.key]?.on??!0;return a`<span class="ecard" slot="edit">
      <button type="button" aria-label=${`הקדם · ${e.name}`} title="הקדם" ?disabled=${t===0} @click=${()=>this.patchDraft(U(s,E(this.devices),e.key,-1))}>${p("arrowUp")}</button>
      <button type="button" aria-label=${`אחר · ${e.name}`} title="אחר" ?disabled=${t===i-1} @click=${()=>this.patchDraft(U(s,E(this.devices),e.key,1))}>${p("arrowDown")}</button>
      <button type="button" aria-pressed=${String(r)} aria-label=${`מועדף · ${e.name}`} title="מועדף" @click=${()=>this.patchDraft(De(s,e.key))}>${p("star")}</button>
      <button type="button" aria-label=${`${o?"הסתר":"הצג"} · ${e.name}`} title=${o?"הסתר":"הצג"} @click=${()=>this.patchDraft(Se(s,e.key,{on:!o}))}>${p(o?"eye":"eyeOff")}</button>
    </span>`}card(e,t,i){const s=this.editing&&!!this.draft,r=s&&!(this.draft.cards[e.key]?.on??!0),o=e.live.group.role==="member"?be(e,this.devices):null;return a`<media-player-card data-player-card=${e.key} .device=${e} .leader=${o&&o.key!==e.key?o:null} ?compact=${this.phone} ?editing=${s} ?data-dimmed=${r}
      @open-player=${h=>this.openPlayer(h.detail.key)} @media-changed=${()=>this.scheduleRefresh(L()?700:30)}>${s?this.chips(e,t,i):n}</media-player-card>`}section(e){const t=N(e.devices),i=(this.editing&&this.draft?this.draft:this.view()).group_by,s=!this.editing&&Ie(e,i,this.hasFloors),r=s&&!!this.status?.can.bulk&&t.playing>0,o=e.id==="pinned"||e.id==="all"||this.editing||!s&&e.id!==g?a`<h2>${y(q(e.label))}</h2>`:a`<h2><button type="button" class="shlink" data-group-open=${e.id} @click=${()=>this.setFilters(e.id===g?{floor:g,area:""}:{floor:e.id,area:""})}>${q(e.label)}${p("chevronBack")}</button></h2>`,h=e.id===g?a`<span class="n">${t.total}</span> ללא חדר`:a`<span class="n">${t.total}</span> התקנים${t.playing?a` · <em><span class="n">${t.playing}</span></em> מנגנים`:n}`,m=r?a`<button type="button" class="btn sm quiet" data-floor-pause=${e.id} @click=${()=>void this.dialog?.pause({scope:"floor",id:e.id,name:e.label})}>${p("pause")}עצור מוזיקה</button>`:n;return a`<section class="fsec" aria-label=${e.label} data-group=${e.id}>
      <header class="sh"><div>${o}<small>${h}</small></div><span class="grow"></span>${m}</header>
      <div class="pgrid">${ge(e.devices,f=>f.key,(f,l)=>this.card(f,l,e.devices.length))}</div>
    </section>`}roomsAsDropdown(e){const t=this.tabsMode.value;return t==="dropdown"||t==="hybrid"&&e>ye}header(){const e=this.filters,t=this.devices.filter(l=>x([l],{...v,floor:e.floor}).length),i=F(t),s=N(this.devices),{floors:r,unplaced:o}=je(this.devices,this.floorOrder()),h=this.hasFloors&&(r.length>1||o>0||!!e.floor),m=!this.editing&&this.phase==="ready"&&this.devices.length>0,f=this.status?.library.state;return a`<header class=${R({dh:!0,compact:this.compactHeader})} data-mm-header>
      <div class="dh-row">
        <h1>נגנים ורמקולים</h1>
        ${m&&this.roomsAsDropdown(i.length+1)?a`<span class="grow" data-rooms-in-shell></span>`:m?a`<div class="rooms" role="group" aria-label="חדרים" @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!e.area)} data-room="" @click=${()=>this.setFilters({area:""})}>הכל</button>
          ${i.map(l=>a`<button type="button" class="rc" aria-pressed=${String(e.area===l.id)} data-room=${l.id} @click=${()=>this.setFilters({area:l.id})}>${y(l.name)}</button>`)}
        </div>`:a`<span class="grow"></span>`}
        ${m&&h?this.floorChip(r,o):n}
      </div>
      ${m?a`<div class="dh-det">
        <span class="amb">${s.playing?a`<em><span class="n">${s.playing}</span></em> מנגנים מתוך <span class="n">${s.total}</span>`:a`אין ניגון כרגע · <span class="n">${s.total}</span> התקנים`}${s.unavailable?a` · <span class="n">${s.unavailable}</span> לא זמין`:n}</span>
        ${f&&f!=="ready"?a`<span class="chipx libchip" data-lib-state=${f}>${p("music")}ספרייה לא זמינה</span>`:n}
        <span class="grow"></span>
        <div class="seg sm" role="radiogroup" aria-label="סינון לפי מצב">${Ue.map(l=>a`<button type="button" role="radio" aria-checked=${String(e.state===l.id)} data-state-filter=${l.id||"all"} @click=${()=>this.setFilters({state:l.id})}>${l.label}${l.id==="playing"?a` <small>${s.playing}</small>`:l.id==="unavailable"&&s.unavailable?a` <small>${s.unavailable}</small>`:n}</button>`)}</div>
        <label class="search">${p("search")}<span class="vh">חיפוש נגן</span><input type="search" data-search placeholder="חיפוש נגן או חדר" .value=${e.q} @input=${l=>this.onSearch(l.target.value)} /></label>
      </div>`:n}
    </header>`}floorChip(e,t){const i=[{id:"",label:"כל הקומות",count:this.devices.length,icon:"home"},{id:"--sep",label:"",divider:!0},...e.map(s=>({id:s.id,label:s.name,count:s.count,icon:"layers"}))];return t&&i.push({id:"--sep2",label:"",divider:!0},{id:g,label:B,count:t,icon:"layers"}),a`<div class="flwrap"><sw-dropdown data-floor-menu label="קומות" icon="layers" dd-style=${we("multimedia")} dd-size=${$e("multimedia")} dd-ring=${ke("multimedia")} dd-panel=${xe("multimedia")} .items=${i} .value=${this.filters.floor} @change=${s=>this.setFilters({floor:s.detail.id,area:""})}></sw-dropdown></div>`}skeleton(){const e=a`<div class="glass skc" aria-hidden="true"><span class="skl cv"></span><div class="tx"><span class="skl l1"></span><span class="skl l2"></span></div><span class="skl kn"></span><span class="skl bar"></span></div>`;return a`<div data-mm-state="loading" aria-busy="true"><div class="pgrid">${Array.from({length:this.phone?3:6},()=>e)}</div></div>`}stateBox(e,t,i){return a`<div class="statebox glass" role="status"><span class="ring">${p(e)}</span><b>${t}</b>${i??n}</div>`}editBar(){return a`<div class="editbar" data-mm-editbar>
      <span class="t">${p("edit")}עריכת מסך הנגנים</span>
      <span class="grow"></span>
      ${this.conflict?a`<span class="note-bad" role="alert">המסך נערך במקום אחר</span><button type="button" class="btn sm" @click=${()=>void this.reloadAfterConflict()}>טען מחדש</button>`:n}
      ${this.saveError?a`<span class="note-bad" role="alert">${this.saveError}</span>`:n}
      <button type="button" class="btn sm quiet" data-mm-cancel ?disabled=${this.busy} @click=${()=>this.askCancel()}>ביטול</button>
      <button type="button" class="btn sm quiet dz" data-mm-reset ?disabled=${this.busy} @click=${()=>this.confirm="reset"}>ברירת מחדל</button>
      <button type="button" class="btn sm primary" data-mm-save ?disabled=${this.busy||!this.dirty||this.conflict} @click=${()=>void this.save()}>${p("check")}שמור</button>
    </div>`}confirmDialog(){const e=this.confirm;if(!e)return a`<sw-dialog data-mm-confirm="closed"></sw-dialog>`;const t=e==="reset";return a`<sw-dialog open heading=${t?"להחזיר את מסך הנגנים לברירת המחדל לכולם?":"לבטל את השינויים?"} data-mm-confirm=${e} @close=${()=>this.confirm=null}>
      <div class="dlg-acts">
        <sw-button data-mm-confirm-no autofocus @click=${()=>this.confirm=null}>${t?"ביטול":"המשך עריכה"}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${()=>{t?(this.confirm=null,this.save(!0)):this.leaveEdit()}}>${t?"החזר":"בטל שינויים"}</sw-button>
      </div></sw-dialog>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return a`<div data-mm-state="error">${this.stateBox("warning","לא ניתן לטעון את הנגנים",a`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${p("refresh")}נסה שוב</button>`)}</div>`;if(this.phase==="forbidden")return a`<div data-mm-state="forbidden">${this.stateBox("speaker","אין הרשאת צפייה בנגנים")}</div>`;if(this.phase==="disabled")return a`<div data-mm-state="disabled">${this.stateBox("power","המולטימדיה כבויה")}</div>`;if(!this.devices.length){const s=this.status?.can.configure;return a`<div data-mm-state="empty">${this.stateBox("speaker","אין נגנים",s?a`<a class="btn sm" href="#/system/multimedia">להגדרות</a>`:void 0)}</div>`}const e=this.sections(),t=this.staleError?a`<div class="errbar" role="alert" data-mm-stale>${p("warning")}הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.<button type="button" class="btn sm" @click=${()=>void this.load()}>נסה שוב</button></div>`:n;if(!e.length)return a`${t}<div data-mm-state="filtered">${this.stateBox("search","לא נמצאו נגנים",Ke(this.filters)?a`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.setFilters(v)}>נקה סינון</button>`:void 0)}</div>`;const i=this.skin.bubble&&!this.editing?this.nowPlaying():null;return a`${t}${i?a`<media-now-hero .device=${i} @media-changed=${()=>this.scheduleRefresh(300)}></media-now-hero>`:n}<div class="groups" data-mm-state="ready">${e.map(s=>this.section(s))}</div>`}render(){const e=this.editing&&!!this.draft;return a`<div class="page" data-screen="multimedia-players">
      ${this.header()}
      ${e?a`<div class="editing-stack">${this.editBar()}</div>`:n}
      <div class=${R({scr:!0,editing:e})} data-mm-region @scroll=${this.onRegionScroll}>
        ${e?a`<div class="edit-layout"><multimedia-edit-panel class="edit-side" simple heading="נגנים ורמקולים" .draft=${this.draft} .devices=${E(this.devices)} scope="all" .floors=${Oe(E(this.devices),this.draft).map(t=>t.id===j?{...t,name:B}:t)} @layout-draft=${t=>this.patchDraft(t.detail)}></multimedia-edit-panel><div class="edit-cards">${this.body()}</div></div>`:this.body()}
      </div>
    </div>
    <media-group-dialog @group-done=${()=>void this.load()}></media-group-dialog>
    ${this.confirmDialog()}
    ${this.playerKey?a`<media-player-panel .deviceKey=${this.playerKey} .open=${!0} @close=${()=>this.closePlayer()}></media-player-panel>`:n}
    ${this.toast?a`<div class="toast" role="status" ${Ee()}>${p("check")}${this.toast}</div>`:n}`}};d.styles=[Y,Ce,X`
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
  `];c([V()],d.prototype,"playerKey",2);c([u()],d.prototype,"phase",2);c([u()],d.prototype,"devices",2);c([u()],d.prototype,"status",2);c([u()],d.prototype,"res",2);c([u()],d.prototype,"homeFloors",2);c([u()],d.prototype,"filters",2);c([u()],d.prototype,"compactHeader",2);c([u()],d.prototype,"staleError",2);c([u()],d.prototype,"toast",2);c([u()],d.prototype,"phone",2);c([u()],d.prototype,"editing",2);c([u()],d.prototype,"draft",2);c([u()],d.prototype,"base",2);c([u()],d.prototype,"busy",2);c([u()],d.prototype,"saveError",2);c([u()],d.prototype,"conflict",2);c([u()],d.prototype,"confirm",2);c([ze("media-group-dialog")],d.prototype,"dialog",2);d=c([Z("multimedia-players")],d);export{d as MultimediaPlayers};
//# sourceMappingURL=multimedia-players-mEKU3tGH.js.map
