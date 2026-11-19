import{bg as M,cx as U,g as q,ax as N,j as E,i as K,cJ as G,bk as V,cL as x,A as d,iZ as Y,cM as J,cP as X,cv as p,b as i,i_ as L,cp as D,k as H,U as s,aL as W,cY as Z,aa as A,i$ as S,et as Q,ep as ee,aT as te,cO as R,c_ as se,hX as ae,a as ie,n as re,d$ as oe,a2 as ne,a6 as T,bd as le,iV as de,iW as ce,iX as pe,iY as he,cX as B,e2 as ue,e3 as me}from"./index-rXjlW4bK.js";import"./media-player-card-BaaJrrXf.js";import{r as ve,p as be}from"./media-group-dialog-C8Gse93r.js";import{g as ge,m as c,n as y}from"./media-now-Cz_1WVFo.js";import"./multimedia-edit-panel-BZRdQC9e.js";import"./sw-pager-CUuaqLbV.js";import{P as fe}from"./page-fit-Gjq1UKHW.js";import{f as $e,m as j,t as ye,s as we,u as ke,o as xe}from"./multimedia-base-DE9FeZ5Q.js";import{a as ze,m as Pe}from"./media-page-BA8dHORZ.js";import{i as v,j as I,k as z,l as _e,m as Oe,t as Fe,w as Se,n as Ce,r as De,o as P,q as C,u as Ee,U as $,v as Le,x as Ae,y as Re}from"./multimedia-players-layout-BoH9SuDq.js";import"./sw-logo-art-PLtEZJxU.js";import"./long-lists-BILjXS3H.js";import"./lead-reserve-BXvvDmTW.js";var Te=Object.defineProperty,Be=Object.getOwnPropertyDescriptor,_=(e,t,r,a)=>{for(var o=a>1?void 0:a?Be(t,r):t,l=e.length-1,n;l>=0;l--)(n=e[l])&&(o=(a?n(t,r,o):n(o))||o);return a&&o&&Te(t,r,o),o};let b=class extends K{constructor(){super(...arguments),this.device=null,this.pending=new Set,this.note="",this.throttle=new G,this.ticker=0,this.timers=[]}connectedCallback(){super.connectedCallback(),V(this)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.ticker),this.ticker=0;for(const e of this.timers)window.clearTimeout(e);this.timers=[]}updated(){const e=this.device,t=!!e&&e.live.play==="playing"&&!!e.live.now.duration_s&&e.live.now.kind!=="station";t&&!this.ticker?this.ticker=window.setInterval(()=>this.requestUpdate(),1e3):!t&&this.ticker&&(window.clearInterval(this.ticker),this.ticker=0)}async send(e,t){const r=this.device;if(!r||!x(r,t)||this.pending.has(e)||!this.throttle.take())return;this.note="";const a=new Set(this.pending);a.add(e),this.pending=a;const o=await ve(r.key,t),l=new Set(this.pending);l.delete(e),this.pending=l,(o.outcome==="not_confirmed"||o.outcome==="refused")&&(this.note=o.message,this.timers.push(window.setTimeout(()=>this.note="",6e3))),this.dispatchEvent(new CustomEvent("media-changed",{detail:{key:r.key,outcome:o.outcome},bubbles:!0,composed:!0}))}render(){const e=this.device;if(!e)return d;const t=be(e),r=e.live.now,a=t.playing,o=t.kind==="station"?null:Y(r,a,Date.now()),l=r.duration_s??null,n=o!==null&&l?Math.max(0,Math.min(100,o/l*100)):0,m=e.live.volume.level??0,F=J(e),w=e.can.control,f=k=>()=>void this.send(k,{command:"transport",action:k}),h=e.live.group.role==="leader"?e.live.group.member_keys.length+1:0,u=t.artwork?X(t.artwork):"";return i`<section class="hero" style=${`--a1:${t.a1};--a2:${t.a2}`} aria-label=${`${p("מתנגן עכשיו")} · ${e.name}`} data-now-hero=${e.key} data-playing=${String(a)}>
      <div class="bg" style=${u?`background-image:url("${u}")`:d}></div>
      <div class="veil"></div>
      <div class="in">
        <div class="art">${u?i`<img src=${u} alt="" />`:ge(t.glyph)}</div>
        <div class="meta">
          <div class="chips">
            <span class="chip">${c(e.kind==="player"?"media":"speaker")}${y(e.area_name||e.name)}</span>
            ${h?i`<span class="chip">${c("group")}${p("{n} חדרים",{n:h})}</span>`:d}
          </div>
          <div class="ttl" data-now-title>${y(r.title||t.line||e.name)}</div>
          ${r.artist||r.album?i`<div class="sub">${y([r.artist,r.album].filter(Boolean).join(" · "))}</div>`:d}
          ${this.note?i`<div class="bad" role="status">${this.note}</div>`:d}
        </div>
        <div class="bar">
          ${t.kind==="station"?i`<span class="live"><i></i>${p("שידור חי")}</span><span class="tr"></span><span></span>`:i`<span>${o!==null?L(o):"–:––"}</span><span class="tr" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(n)} style=${`--p:${n}%`}><i></i></span><span>${l?L(l):"–:––"}</span>`}
        </div>
        <div class="keys">
          ${w?i`<span class="tp" role="group" aria-label=${p("ניגון")}>
                <button type="button" class="k" aria-label=${p("הקודם")} ?disabled=${!x(e,{command:"transport",action:"previous"})} @click=${f("previous")}>${c("prev")}</button>
                <button type="button" class=${D({k:!0,main:!0})} aria-label=${a?p("השהה"):p("נגן")} ?disabled=${!x(e,{command:"transport",action:"play_pause"})||this.pending.has("play_pause")} @click=${f("play_pause")}>${c(a?"pause":"play")}</button>
                <button type="button" class="k" aria-label=${p("הבא")} ?disabled=${!x(e,{command:"transport",action:"next"})} @click=${f("next")}>${c("next")}</button>
              </span>`:d}
          ${w&&e.caps.volume_set?i`<sw-pill class="vol" variant="slider" icon="volume" label=${p("עוצמה")} .state=${`${m}%${e.live.volume.muted?` · ${p("מושתק")}`:""}`} .value=${m/100} on keep-text fill-color="var(--sw-accent-soft)" ?unavailable=${this.pending.has("volume")}
                @toggle=${()=>void this.send("mute",{command:"mute",muted:!e.live.volume.muted})} @change=${k=>void this.send("volume",{command:"volume_set",level:Math.max(0,Math.min(F??100,Math.round(k.detail.value*100)))})}></sw-pill>`:d}
        </div>
      </div>
    </section>`}};b.styles=[M,q`
    ${U}
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
  `];_([N({attribute:!1})],b.prototype,"device",2);_([E()],b.prototype,"pending",2);_([E()],b.prototype,"note",2);b=_([H("media-now-hero")],b);var je=Object.defineProperty,Ie=Object.getOwnPropertyDescriptor,O=(e,t,r,a)=>{for(var o=a>1?void 0:a?Ie(t,r):t,l=e.length-1,n;l>=0;l--)(n=e[l])&&(o=(a?n(t,r,o):n(o))||o);return a&&o&&je(t,r,o),o};const Me="/multimedia/players",qe=(e,t)=>JSON.stringify(e)===JSON.stringify(t);let g=class extends $e{constructor(){super(...arguments),this.playerKey="",this.filters=v,this.path=Me,this.tab="players",this.editEntry={id:"multimedia-players-layout",label:s("עריכת מסך הנגנים")},this.noFilter=v,this.panelParam="player",this.skin=new W(this),this.fit=new fe(this,()=>this.renderRoot.querySelector(".scr"),()=>!this.editing),this.onRegionScroll=e=>{const t=e.currentTarget;t.classList.toggle("scrolled",t.scrollTop>2)}}nowPlaying(){const e=this.devices.filter(t=>t.live.group.role!=="member");return e.find(t=>Z(t))??e.find(t=>t.live.power==="on"&&t.live.play==="paused")??null}atConnect(){this.filters=I(A().params),this.wantsEdit=A().params.get("edit")==="1"}syncPair(){const e=this.filters,t=this.devices.filter(o=>z([o],{...v,floor:e.floor}).length),r=S(t);!this.editing&&this.phase==="ready"&&this.devices.length>0&&this.roomsAsDropdown(r.length+1)?Q(this,{group:"multimedia",label:s("חדרים"),value:e.area,items:[{id:"",label:s("הכל"),count:t.length,icon:"home"},{id:"--sep",label:"",divider:!0},...r.map(o=>({id:o.id,label:o.name,count:o.count,icon:"door"}))],onPick:o=>this.setFilters({area:o})}):ee(this)}updated(){this.syncPair(),ze(this.renderRoot,this.phone),super.updated()}get canEdit(){return this.phase==="ready"&&this.res.can_edit&&!te("layout_editor")}readStatus(){return R().status()}async listDevices(){return(await R().list({kind:se})).devices}filtersFromParams(e){return I(e)}filtersToParams(e,t){return _e(e,t)}roomsInFloor(){return S(this.devices.filter(e=>!this.filters.floor||z([e],{...v,floor:this.filters.floor}).length))}startDraft(){return this.view()}get doc(){return this.res.installation}floorOrder(){return this.doc.floor_order.length?this.doc.floor_order:this.homeFloors}get hasFloors(){return Oe(this.status,this.devices)}view(){return Fe(this.doc,"players",this.floorOrder())}scrollHome(){super.scrollHome(),this.renderRoot.querySelector(".scr")?.scrollTo({top:0})}payload(e){const t=this.doc;if(!e){const a={...t.tabs};return delete a.players,{...t,tabs:a}}return{...Se(t,"players",e),floor_order:!t.floor_order.length&&qe(e.floor_order,this.homeFloors)?[]:e.floor_order}}async save(e=!1){if(!(!this.draft||this.busy)){this.busy=!0,this.saveError="";try{this.res=await ae().saveLayout(this.payload(e?null:this.draft),this.res.revision),this.leaveEdit(),this.say(e?s("חזר לברירת המחדל"):s("נשמר"))}catch(t){t instanceof ie&&t.code==="revision_conflict"?this.conflict=!0:this.saveError=re(t),this.busy=!1}}}sections(){const e={floors:this.hasFloors,floorOrder:this.floorOrder()};return this.editing&&this.draft?Ce(this.devices,this.draft,e):De(z(this.devices,this.filters),this.view(),e)}chips(e,t,r){const a=this.draft,o=a.pinned.includes(e.key),l=a.cards[e.key]?.on??!0;return i`<span class="ecard" slot="edit">
      <button type="button" aria-label=${s("הקדם · {name}",{name:e.name})} title=${s("הקדם")} ?disabled=${t===0} @click=${()=>this.patchDraft(j(a,P(this.devices),e.key,-1))}>${c("arrowUp")}</button>
      <button type="button" aria-label=${s("אחר · {name}",{name:e.name})} title=${s("אחר")} ?disabled=${t===r-1} @click=${()=>this.patchDraft(j(a,P(this.devices),e.key,1))}>${c("arrowDown")}</button>
      <button type="button" aria-pressed=${String(o)} aria-label=${s("מועדף · {name}",{name:e.name})} title=${s("מועדף")} @click=${()=>this.patchDraft(ye(a,e.key))}>${c("star")}</button>
      <button type="button" aria-label=${`${l?s("הסתר"):s("הצג")} · ${e.name}`} title=${l?s("הסתר"):s("הצג")} @click=${()=>this.patchDraft(we(a,e.key,{on:!l}))}>${c(l?"eye":"eyeOff")}</button>
    </span>`}card(e,t,r,a=!1){const o=this.editing&&!!this.draft,l=o&&!(this.draft.cards[e.key]?.on??!0),n=e.live.group.role==="member"?oe(e,this.devices):null;return i`<media-player-card data-fit-item ?data-off=${a} data-player-card=${e.key} .device=${e} .leader=${n&&n.key!==e.key?n:null} ?compact=${this.phone} ?editing=${o} ?data-dimmed=${l}
      @open-player=${m=>this.openPanel(m.detail.key)} @media-changed=${()=>this.scheduleRefresh(ne()?700:30)}>${o?this.chips(e,t,r):d}</media-player-card>`}section(e,t=0){const r=C(e.devices),a=h=>!this.fit.shows(t+h),o=e.devices.every((h,u)=>a(u)),l=(this.editing&&this.draft?this.draft:this.view()).group_by,n=!this.editing&&Ee(e,l,this.hasFloors),m=n&&!!this.status?.can.bulk&&r.playing>0,F=e.id==="pinned"||e.id==="all"||this.editing||!n&&e.id!==$?i`<h2>${y(T(e.label))}</h2>`:i`<h2><button type="button" class="shlink" data-group-open=${e.id} @click=${()=>this.setFilters(e.id===$?{floor:$,area:""}:{floor:e.id,area:""})}>${T(e.label)}${c("chevronBack")}</button></h2>`,w=e.id===$?i`<span class="n">${r.total}</span> ${s("ללא חדר")}`:i`<span class="n">${r.total}</span> ${s("התקנים")}${r.playing?i` · <em><span class="n">${r.playing}</span></em> ${s("מנגנים")}`:d}`,f=m?i`<button type="button" class="btn sm quiet" data-floor-pause=${e.id} @click=${()=>void this.dialog?.pause({scope:"floor",id:e.id,name:e.label})}>${c("pause")}${s("עצור מוזיקה")}</button>`:d;return i`<section class="fsec" ?data-off=${o} aria-label=${e.label} data-group=${e.id}>
      <header class="sh"><div>${F}<small>${w}</small></div><span class="grow"></span>${f}</header>
      <div class="pgrid">${le(e.devices,h=>h.key,(h,u)=>this.card(h,u,e.devices.length,a(u)))}</div>
    </section>`}summary(){if(this.phone||this.editing||this.phase!=="ready"||!this.devices.length)return"";const e=C(this.devices);return`${e.playing?s("{playing} מנגנים מתוך {total}",{playing:e.playing,total:e.total}):s("אין ניגון כרגע · {total} התקנים",{total:e.total})}${e.unavailable?s(" · {unavailable} לא זמין",{unavailable:e.unavailable}):""}`}floorAction(){const{floors:e,unplaced:t}=Le(this.devices,this.floorOrder()),r=this.hasFloors&&(e.length>1||t>0||!!this.filters.floor);return!this.editing&&this.phase==="ready"&&this.devices.length>0&&r?this.floorChip(e,t):d}header(){const e=this.filters,t=this.devices.filter(n=>z([n],{...v,floor:e.floor}).length),r=S(t),a=C(this.devices),o=!this.editing&&this.phase==="ready"&&this.devices.length>0,l=this.status?.library.state;return o?i`<div class=${D({dh:!0,compact:this.compactHeader})} data-mm-header>
      <div class="dh-row">
        ${this.roomsAsDropdown(r.length+1)?i`<span class="grow" data-rooms-in-shell></span>`:i`<div class="rooms" role="group" aria-label=${s("חדרים")} @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!e.area)} data-room="" @click=${()=>this.setFilters({area:""})}>${s("הכל")}</button>
          ${r.map(n=>i`<button type="button" class="rc" aria-pressed=${String(e.area===n.id)} data-room=${n.id} @click=${()=>this.setFilters({area:n.id})}>${y(n.name)}</button>`)}
        </div>`}
      </div>
      <div class="dh-det">
        ${l&&l!=="ready"?i`<span class="chipx libchip" data-lib-state=${l}>${c("music")}${s("ספרייה לא זמינה")}</span>`:d}
        ${this.fit.pages>1?i`<sw-pager data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${n=>this.fit.go(n.detail.page)}></sw-pager>`:d}
        <div class="seg sm" role="radiogroup" aria-label=${s("סינון לפי מצב")}>${Ae.map(n=>i`<button type="button" role="radio" aria-checked=${String(e.state===n.id)} data-state-filter=${n.id||"all"} @click=${()=>this.setFilters({state:n.id})}>${n.label}${n.id==="playing"?i` <small>${a.playing}</small>`:n.id==="unavailable"&&a.unavailable?i` <small>${a.unavailable}</small>`:d}</button>`)}</div>
        <label class="search">${c("search")}<span class="vh">${s("חיפוש נגן")}</span><input type="search" data-search placeholder=${s("חיפוש נגן או חדר")} .value=${e.q} @input=${n=>this.onSearch(n.target.value)} /></label>
      </div>
    </div>`:d}floorChip(e,t){const r=[{id:"",label:s("כל הקומות"),count:this.devices.length,icon:"home"},{id:"--sep",label:"",divider:!0},...e.map(a=>({id:a.id,label:a.name,count:a.count,icon:"layers"}))];return t&&r.push({id:"--sep2",label:"",divider:!0},{id:$,label:B,count:t,icon:"layers"}),i`<div class="flwrap"><sw-dropdown data-floor-menu label=${s("קומות")} icon="layers" dd-style=${de("multimedia")} dd-size=${ce("multimedia")} dd-ring=${pe("multimedia")} dd-panel=${he("multimedia")} .items=${r} .value=${this.filters.floor} @change=${a=>this.setFilters({floor:a.detail.id,area:""})}></sw-dropdown></div>`}skeleton(){const e=i`<div class="glass skc" aria-hidden="true"><span class="skl cv"></span><div class="tx"><span class="skl l1"></span><span class="skl l2"></span></div><span class="skl kn"></span><span class="skl bar"></span></div>`;return i`<div data-mm-state="loading" aria-busy="true"><div class="pgrid">${Array.from({length:this.phone?3:6},()=>e)}</div></div>`}editBar(){return i`<div class="editbar" data-mm-editbar>
      <span class="t">${c("edit")}${s("עריכת מסך הנגנים")}</span>
      <span class="grow"></span>
      ${this.conflict?i`<span class="note-bad" role="alert">${s("המסך נערך במקום אחר")}</span><button type="button" class="btn sm" @click=${()=>void this.reloadAfterConflict()}>${s("טען מחדש")}</button>`:d}
      ${this.saveError?i`<span class="note-bad" role="alert">${this.saveError}</span>`:d}
      <button type="button" class="btn sm quiet" data-mm-cancel ?disabled=${this.busy} @click=${()=>this.askCancel()}>${s("ביטול")}</button>
      <button type="button" class="btn sm quiet dz" data-mm-reset ?disabled=${this.busy} @click=${()=>this.confirm="reset"}>${s("ברירת מחדל")}</button>
      <button type="button" class="btn sm primary" data-mm-save ?disabled=${this.busy||!this.dirty||this.conflict} @click=${()=>void this.save()}>${c("check")}${s("שמור")}</button>
    </div>`}confirmDialog(){const e=this.confirm;if(!e)return i`<sw-dialog data-mm-confirm="closed"></sw-dialog>`;const t=e==="reset";return i`<sw-dialog open heading=${t?s("להחזיר את מסך הנגנים לברירת המחדל לכולם?"):s("לבטל את השינויים?")} data-mm-confirm=${e} @close=${()=>this.confirm=null}>
      <div class="dlg-acts">
        <sw-button data-mm-confirm-no autofocus @click=${()=>this.confirm=null}>${t?s("ביטול"):s("המשך עריכה")}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${()=>{t?(this.confirm=null,this.save(!0)):this.leaveEdit()}}>${t?s("החזר"):s("בטל שינויים")}</sw-button>
      </div></sw-dialog>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return i`<div data-mm-state="error">${this.stateBox("warning",s("לא ניתן לטעון את הנגנים"),i`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${c("refresh")}${s("נסה שוב")}</button>`)}</div>`;if(this.phase==="forbidden")return i`<div data-mm-state="forbidden">${this.stateBox("speaker",s("אין הרשאת צפייה בנגנים"))}</div>`;if(this.phase==="disabled")return i`<div data-mm-state="disabled">${this.stateBox("power",s("המולטימדיה כבויה"))}</div>`;if(!this.devices.length){const l=this.status?.can.configure;return i`<div data-mm-state="empty">${this.stateBox("speaker",s("אין נגנים"),l?i`<a class="btn sm" href="#/system/multimedia">${s("להגדרות")}</a>`:void 0)}</div>`}const e=this.sections(),t=this.staleError?i`<div class="errbar" role="alert" data-mm-stale>${c("warning")}${s("הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.")}<button type="button" class="btn sm" @click=${()=>void this.load()}>${s("נסה שוב")}</button></div>`:d;if(!e.length)return i`${t}<div data-mm-state="filtered">${this.stateBox("search",s("לא נמצאו נגנים"),Re(this.filters)?i`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.setFilters(v)}>${s("נקה סינון")}</button>`:void 0)}</div>`;let r=0;const a=e.map(l=>(r+=l.devices.length,r-l.devices.length));this.fit.sync(r,`${e.map(l=>`${l.id}:${l.devices.map(n=>n.key).join(",")}`).join("|")}|${this.phone}`);const o=this.skin.bubble&&!this.editing?this.nowPlaying():null;return i`${t}${o?i`<media-now-hero .device=${o} @media-changed=${()=>this.scheduleRefresh(300)}></media-now-hero>`:d}<div class="groups" data-mm-state="ready">${e.map((l,n)=>this.section(l,a[n]))}</div>`}render(){const e=this.editing&&!!this.draft,t=this.body(),r=this.floorAction();return i`<sw-page class="page" wide heading=${s("נגנים ורמקולים")} subheading=${this.summary()} data-screen="multimedia-players">
      ${r===d?d:i`<div slot="actions" class="pacts">${r}</div>`}
      ${this.header()}
      ${e?i`<div class="editing-stack">${this.editBar()}</div>`:d}
      <div class=${D({scr:!0,editing:e})} data-mm-region @scroll=${this.onRegionScroll}>
        ${e?i`<div class="edit-layout"><multimedia-edit-panel class="edit-side" simple heading=${s("נגנים ורמקולים")} .draft=${this.draft} .devices=${P(this.devices)} scope="all" .floors=${ke(P(this.devices),this.draft).map(a=>a.id===xe?{...a,name:B}:a)} @layout-draft=${a=>this.patchDraft(a.detail)}></multimedia-edit-panel><div class="edit-cards">${t}</div></div>`:t}
      </div>
    </sw-page>
    <media-group-dialog @group-done=${()=>void this.load()}></media-group-dialog>
    ${this.confirmDialog()}
    ${this.playerKey?i`<media-player-panel .deviceKey=${this.playerKey} .open=${!0} @close=${()=>this.closePanel()}></media-player-panel>`:d}
    ${this.toast?i`<div class="toast" role="status" ${ue()}>${c("check")}${this.toast}</div>`:d}`}};g.styles=[M,Pe,q`
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
  `];O([N()],g.prototype,"playerKey",2);O([E()],g.prototype,"filters",2);O([me("media-group-dialog")],g.prototype,"dialog",2);g=O([H("multimedia-players")],g);export{g as MultimediaPlayers};
