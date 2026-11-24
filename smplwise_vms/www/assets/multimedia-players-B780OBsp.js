import{bm as q,cT as K,g as N,v as H,j as D,i as U,d1 as V,bq as J,d3 as x,A as d,iv as X,d4 as Y,d7 as W,cC as p,b as r,cM as E,k as G,aP as Q,dk as Z,af as R,iw as C,ej as ee,ef as te,aX as se,d6 as A,dm as ae,hI as ie,a as re,n as oe,dT as ne,a7 as le,ab as T,bg as de,ir as ce,is as pe,it as he,iu as ue,dj as L,dW as me,dX as ve}from"./index-c_ii2C2N.js";import"./media-player-card-CwZEHmWv.js";import{r as be,p as ge}from"./media-group-dialog-DC1eLHEi.js";import{m as j}from"./media-player-panel-BdbaMgQi.js";import{g as fe,m as c,n as y}from"./media-now-BgpIyFyJ.js";import"./multimedia-edit-panel-D71P86HJ.js";import"./sw-pager-yILvgW0Q.js";import{P as $e}from"./page-fit-CNW9RZGs.js";import{f as ye,m as B,t as we,s as ke,u as xe,o as ze}from"./multimedia-base-BLHFTgh4.js";import{a as Pe,m as _e}from"./media-page-SjKcLyt3.js";import{i as v,j as I,k as z,l as Se,m as Oe,t as Ce,w as Fe,n as Ee,r as De,o as P,q as F,u as Re,U as $,v as Ae,x as M,y as Te}from"./multimedia-players-layout-B7W8lskP.js";import{t as s}from"./media-ChiRjfra.js";import"./sw-logo-art-PLtEZJxU.js";import"./long-lists-KFWLR6_3.js";import"./lead-reserve-Db0jNmH6.js";var Le=Object.defineProperty,je=Object.getOwnPropertyDescriptor,_=(e,t,i,a)=>{for(var o=a>1?void 0:a?je(t,i):t,l=e.length-1,n;l>=0;l--)(n=e[l])&&(o=(a?n(t,i,o):n(o))||o);return a&&o&&Le(t,i,o),o};let b=class extends U{constructor(){super(...arguments),this.device=null,this.pending=new Set,this.note="",this.throttle=new V,this.ticker=0,this.timers=[]}connectedCallback(){super.connectedCallback(),J(this)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.ticker),this.ticker=0;for(const e of this.timers)window.clearTimeout(e);this.timers=[]}updated(){const e=this.device,t=!!e&&e.live.play==="playing"&&!!e.live.now.duration_s&&e.live.now.kind!=="station";t&&!this.ticker?this.ticker=window.setInterval(()=>this.requestUpdate(),1e3):!t&&this.ticker&&(window.clearInterval(this.ticker),this.ticker=0)}async send(e,t){const i=this.device;if(!i||!x(i,t)||this.pending.has(e)||!this.throttle.take())return;this.note="";const a=new Set(this.pending);a.add(e),this.pending=a;const o=await be(i.key,t),l=new Set(this.pending);l.delete(e),this.pending=l,(o.outcome==="not_confirmed"||o.outcome==="refused")&&(this.note=o.message,this.timers.push(window.setTimeout(()=>this.note="",6e3))),this.dispatchEvent(new CustomEvent("media-changed",{detail:{key:i.key,outcome:o.outcome},bubbles:!0,composed:!0}))}render(){const e=this.device;if(!e)return d;const t=ge(e),i=e.live.now,a=t.playing,o=t.kind==="station"?null:X(i,a,Date.now()),l=i.duration_s??null,n=o!==null&&l?Math.max(0,Math.min(100,o/l*100)):0,m=e.live.volume.level??0,O=Y(e),w=e.can.control,f=k=>()=>void this.send(k,{command:"transport",action:k}),h=e.live.group.role==="leader"?e.live.group.member_keys.length+1:0,u=t.artwork?W(t.artwork):"";return r`<section class="hero" style=${`--a1:${t.a1};--a2:${t.a2}`} aria-label=${`${p("מתנגן עכשיו")} · ${e.name}`} data-now-hero=${e.key} data-playing=${String(a)}>
      <div class="bg" style=${u?`background-image:url("${u}")`:d}></div>
      <div class="veil"></div>
      <div class="in">
        <div class="art">${u?r`<img src=${u} alt="" />`:fe(t.glyph)}</div>
        <div class="meta">
          <div class="chips">
            <span class="chip">${c(e.kind==="player"?"media":"speaker")}${y(e.area_name||e.name)}</span>
            ${h?r`<span class="chip">${c("group")}${p("{n} חדרים",{n:h})}</span>`:d}
          </div>
          <div class="ttl" data-now-title>${y(i.title||t.line||e.name)}</div>
          ${i.artist||i.album?r`<div class="sub">${y([i.artist,i.album].filter(Boolean).join(" · "))}</div>`:d}
          ${this.note?r`<div class="bad" role="status">${this.note}</div>`:d}
        </div>
        <div class="bar">
          ${t.kind==="station"?r`<span class="live"><i></i>${p("שידור חי")}</span><span class="tr"></span><span></span>`:r`<span>${o!==null?j(o):"–:––"}</span><span class="tr" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(n)} style=${`--p:${n}%`}><i></i></span><span>${l?j(l):"–:––"}</span>`}
        </div>
        <div class="keys">
          ${w?r`<span class="tp" role="group" aria-label=${p("ניגון")}>
                <button type="button" class="k" aria-label=${p("הקודם")} ?disabled=${!x(e,{command:"transport",action:"previous"})} @click=${f("previous")}>${c("prev")}</button>
                <button type="button" class=${E({k:!0,main:!0})} aria-label=${a?p("השהה"):p("נגן")} ?disabled=${!x(e,{command:"transport",action:"play_pause"})||this.pending.has("play_pause")} @click=${f("play_pause")}>${c(a?"pause":"play")}</button>
                <button type="button" class="k" aria-label=${p("הבא")} ?disabled=${!x(e,{command:"transport",action:"next"})} @click=${f("next")}>${c("next")}</button>
              </span>`:d}
          ${w&&e.caps.volume_set?r`<sw-pill class="vol" variant="slider" icon="volume" label=${p("עוצמה")} .state=${`${m}%${e.live.volume.muted?` · ${p("מושתק")}`:""}`} .value=${m/100} on keep-text fill-color="var(--sw-accent-soft)" ?unavailable=${this.pending.has("volume")}
                @toggle=${()=>void this.send("mute",{command:"mute",muted:!e.live.volume.muted})} @change=${k=>void this.send("volume",{command:"volume_set",level:Math.max(0,Math.min(O??100,Math.round(k.detail.value*100)))})}></sw-pill>`:d}
        </div>
      </div>
    </section>`}};b.styles=[q,N`
    ${K}
    .hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      border-radius: var(--sw-r-xl);
      background: linear-gradient(135deg, var(--a1), var(--a2));
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
      background: linear-gradient(135deg, var(--a1), var(--a2));
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
  `];_([H({attribute:!1})],b.prototype,"device",2);_([D()],b.prototype,"pending",2);_([D()],b.prototype,"note",2);b=_([G("media-now-hero")],b);var Be=Object.defineProperty,Ie=Object.getOwnPropertyDescriptor,S=(e,t,i,a)=>{for(var o=a>1?void 0:a?Ie(t,i):t,l=e.length-1,n;l>=0;l--)(n=e[l])&&(o=(a?n(t,i,o):n(o))||o);return a&&o&&Be(t,i,o),o};const Me="/multimedia/players",qe=(e,t)=>JSON.stringify(e)===JSON.stringify(t);let g=class extends ye{constructor(){super(...arguments),this.playerKey="",this.filters=v,this.path=Me,this.tab="players",this.editEntry={id:"multimedia-players-layout",label:s("עריכת מסך הנגנים")},this.noFilter=v,this.panelParam="player",this.skin=new Q(this),this.fit=new $e(this,()=>this.renderRoot.querySelector(".scr"),()=>!this.editing),this.onRegionScroll=e=>{const t=e.currentTarget;t.classList.toggle("scrolled",t.scrollTop>2)}}nowPlaying(){const e=this.devices.filter(t=>t.live.group.role!=="member");return e.find(t=>Z(t))??e.find(t=>t.live.power==="on"&&t.live.play==="paused")??null}atConnect(){this.filters=I(R().params),this.wantsEdit=R().params.get("edit")==="1"}syncPair(){const e=this.filters,t=this.devices.filter(o=>z([o],{...v,floor:e.floor}).length),i=C(t);!this.editing&&this.phase==="ready"&&this.devices.length>0&&this.roomsAsDropdown(i.length+1)?ee(this,{group:"multimedia",label:s("חדרים"),value:e.area,items:[{id:"",label:s("הכל"),count:t.length,icon:"home"},{id:"--sep",label:"",divider:!0},...i.map(o=>({id:o.id,label:o.name,count:o.count,icon:"door"}))],onPick:o=>this.setFilters({area:o})}):te(this)}updated(){this.syncPair(),Pe(this.renderRoot,this.phone),super.updated()}get canEdit(){return this.phase==="ready"&&this.res.can_edit&&!se("layout_editor")}readStatus(){return A().status()}async listDevices(){return(await A().list({kind:ae})).devices}filtersFromParams(e){return I(e)}filtersToParams(e,t){return Se(e,t)}roomsInFloor(){return C(this.devices.filter(e=>!this.filters.floor||z([e],{...v,floor:this.filters.floor}).length))}startDraft(){return this.view()}get doc(){return this.res.installation}floorOrder(){return this.doc.floor_order.length?this.doc.floor_order:this.homeFloors}get hasFloors(){return Oe(this.status,this.devices)}view(){return Ce(this.doc,"players",this.floorOrder())}scrollHome(){super.scrollHome(),this.renderRoot.querySelector(".scr")?.scrollTo({top:0})}payload(e){const t=this.doc;if(!e){const a={...t.tabs};return delete a.players,{...t,tabs:a}}return{...Fe(t,"players",e),floor_order:!t.floor_order.length&&qe(e.floor_order,this.homeFloors)?[]:e.floor_order}}async save(e=!1){if(!(!this.draft||this.busy)){this.busy=!0,this.saveError="";try{this.res=await ie().saveLayout(this.payload(e?null:this.draft),this.res.revision),this.leaveEdit(),this.say(e?s("חזר לברירת המחדל"):s("נשמר"))}catch(t){t instanceof re&&t.code==="revision_conflict"?this.conflict=!0:this.saveError=oe(t),this.busy=!1}}}sections(){const e={floors:this.hasFloors,floorOrder:this.floorOrder()};return this.editing&&this.draft?Ee(this.devices,this.draft,e):De(z(this.devices,this.filters),this.view(),e)}chips(e,t,i){const a=this.draft,o=a.pinned.includes(e.key),l=a.cards[e.key]?.on??!0;return r`<span class="ecard" slot="edit">
      <button type="button" aria-label=${s("הקדם · {name}",{name:e.name})} title=${s("הקדם")} ?disabled=${t===0} @click=${()=>this.patchDraft(B(a,P(this.devices),e.key,-1))}>${c("arrowUp")}</button>
      <button type="button" aria-label=${s("אחר · {name}",{name:e.name})} title=${s("אחר")} ?disabled=${t===i-1} @click=${()=>this.patchDraft(B(a,P(this.devices),e.key,1))}>${c("arrowDown")}</button>
      <button type="button" aria-pressed=${String(o)} aria-label=${s("מועדף · {name}",{name:e.name})} title=${s("מועדף")} @click=${()=>this.patchDraft(we(a,e.key))}>${c("star")}</button>
      <button type="button" aria-label=${`${l?s("הסתר"):s("הצג")} · ${e.name}`} title=${l?s("הסתר"):s("הצג")} @click=${()=>this.patchDraft(ke(a,e.key,{on:!l}))}>${c(l?"eye":"eyeOff")}</button>
    </span>`}card(e,t,i,a=!1){const o=this.editing&&!!this.draft,l=o&&!(this.draft.cards[e.key]?.on??!0),n=e.live.group.role==="member"?ne(e,this.devices):null;return r`<media-player-card data-fit-item ?data-off=${a} data-player-card=${e.key} .device=${e} .leader=${n&&n.key!==e.key?n:null} ?compact=${this.phone} ?editing=${o} ?data-dimmed=${l}
      @open-player=${m=>this.openPanel(m.detail.key)} @media-changed=${()=>this.scheduleRefresh(le()?700:30)}>${o?this.chips(e,t,i):d}</media-player-card>`}section(e,t=0){const i=F(e.devices),a=h=>!this.fit.shows(t+h),o=e.devices.every((h,u)=>a(u)),l=(this.editing&&this.draft?this.draft:this.view()).group_by,n=!this.editing&&Re(e,l,this.hasFloors),m=n&&!!this.status?.can.bulk&&i.playing>0,O=e.id==="pinned"||e.id==="all"||this.editing||!n&&e.id!==$?r`<h2>${y(T(e.label))}</h2>`:r`<h2><button type="button" class="shlink" data-group-open=${e.id} @click=${()=>this.setFilters(e.id===$?{floor:$,area:""}:{floor:e.id,area:""})}>${T(e.label)}${c("chevronBack")}</button></h2>`,w=e.id===$?r`<span class="n">${i.total}</span> ${s("ללא חדר")}`:r`<span class="n">${i.total}</span> ${s("התקנים")}${i.playing?r` · <em><span class="n">${i.playing}</span></em> ${s("מנגנים")}`:d}`,f=m?r`<button type="button" class="btn sm quiet" data-floor-pause=${e.id} @click=${()=>void this.dialog?.pause({scope:"floor",id:e.id,name:e.label})}>${c("pause")}${s("עצור מוזיקה")}</button>`:d;return r`<section class="fsec" ?data-off=${o} aria-label=${e.label} data-group=${e.id}>
      <header class="sh"><div>${O}<small>${w}</small></div><span class="grow"></span>${f}</header>
      <div class="pgrid">${de(e.devices,h=>h.key,(h,u)=>this.card(h,u,e.devices.length,a(u)))}</div>
    </section>`}summary(){if(this.phone||this.editing||this.phase!=="ready"||!this.devices.length)return"";const e=F(this.devices);return`${e.playing?s("{playing} מנגנים מתוך {total}",{playing:e.playing,total:e.total}):s("אין ניגון כרגע · {total} התקנים",{total:e.total})}${e.unavailable?s(" · {unavailable} לא זמין",{unavailable:e.unavailable}):""}`}floorAction(){const{floors:e,unplaced:t}=Ae(this.devices,this.floorOrder()),i=this.hasFloors&&(e.length>1||t>0||!!this.filters.floor);return!this.editing&&this.phase==="ready"&&this.devices.length>0&&i?this.floorChip(e,t):d}header(){const e=this.filters,t=this.devices.filter(n=>z([n],{...v,floor:e.floor}).length),i=C(t),a=F(this.devices),o=!this.editing&&this.phase==="ready"&&this.devices.length>0,l=this.status?.library.state;return o?r`<div class=${E({dh:!0,compact:this.compactHeader})} data-mm-header>
      <div class="dh-row">
        ${this.roomsAsDropdown(i.length+1)?r`<span class="grow" data-rooms-in-shell></span>`:r`<div class="rooms" role="group" aria-label=${s("חדרים")} @pointerdown=${this.roomsDrag}>
          <button type="button" class="rc" aria-pressed=${String(!e.area)} data-room="" @click=${()=>this.setFilters({area:""})}>${s("הכל")}</button>
          ${i.map(n=>r`<button type="button" class="rc" aria-pressed=${String(e.area===n.id)} data-room=${n.id} @click=${()=>this.setFilters({area:n.id})}>${y(n.name)}</button>`)}
        </div>`}
      </div>
      <div class="dh-det">
        ${l&&l!=="ready"?r`<span class="chipx libchip" data-lib-state=${l}>${c("music")}${s("ספרייה לא זמינה")}</span>`:d}
        ${this.fit.pages>1?r`<sw-pager data-mm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${n=>this.fit.go(n.detail.page)}></sw-pager>`:d}
        <sw-segmented radio size="sm" label=${s("סינון לפי מצב")} value=${e.state} @change=${n=>this.setFilters({state:M.find(m=>m.id===n.detail.value)?.id??""})}
          .options=${M.map(n=>({value:n.id,label:n.label,count:n.id==="playing"?String(a.playing):n.id==="unavailable"&&a.unavailable?String(a.unavailable):void 0,attrs:{"data-state-filter":n.id||"all"}}))}></sw-segmented>
        <label class="search">${c("search")}<span class="vh">${s("חיפוש נגן")}</span><input type="search" data-search placeholder=${s("חיפוש נגן או חדר")} .value=${e.q} @input=${n=>this.onSearch(n.target.value)} /></label>
      </div>
    </div>`:d}floorChip(e,t){const i=[{id:"",label:s("כל הקומות"),count:this.devices.length,icon:"home"},{id:"--sep",label:"",divider:!0},...e.map(a=>({id:a.id,label:a.name,count:a.count,icon:"layers"}))];return t&&i.push({id:"--sep2",label:"",divider:!0},{id:$,label:L,count:t,icon:"layers"}),r`<div class="flwrap"><sw-dropdown data-floor-menu label=${s("קומות")} icon="layers" dd-style=${ce("multimedia")} dd-size=${pe("multimedia")} dd-ring=${he("multimedia")} dd-panel=${ue("multimedia")} .items=${i} .value=${this.filters.floor} @change=${a=>this.setFilters({floor:a.detail.id,area:""})}></sw-dropdown></div>`}skeleton(){const e=r`<div class="glass skc" aria-hidden="true"><span class="skl cv"></span><div class="tx"><span class="skl l1"></span><span class="skl l2"></span></div><span class="skl kn"></span><span class="skl bar"></span></div>`;return r`<div data-mm-state="loading" aria-busy="true"><div class="pgrid">${Array.from({length:this.phone?3:6},()=>e)}</div></div>`}editBar(){return r`<div class="editbar" data-mm-editbar>
      <span class="t">${c("edit")}${s("עריכת מסך הנגנים")}</span>
      <span class="grow"></span>
      ${this.conflict?r`<span class="note-bad" role="alert">${s("המסך נערך במקום אחר")}</span><button type="button" class="btn sm" @click=${()=>void this.reloadAfterConflict()}>${s("טען מחדש")}</button>`:d}
      ${this.saveError?r`<span class="note-bad" role="alert">${this.saveError}</span>`:d}
      <button type="button" class="btn sm quiet" data-mm-cancel ?disabled=${this.busy} @click=${()=>this.askCancel()}>${s("ביטול")}</button>
      <button type="button" class="btn sm quiet dz" data-mm-reset ?disabled=${this.busy} @click=${()=>this.confirm="reset"}>${s("ברירת מחדל")}</button>
      <button type="button" class="btn sm primary" data-mm-save ?disabled=${this.busy||!this.dirty||this.conflict} @click=${()=>void this.save()}>${c("check")}${s("שמור")}</button>
    </div>`}confirmDialog(){const e=this.confirm;if(!e)return r`<sw-dialog data-mm-confirm="closed"></sw-dialog>`;const t=e==="reset";return r`<sw-dialog open heading=${t?s("להחזיר את מסך הנגנים לברירת המחדל לכולם?"):s("לבטל את השינויים?")} data-mm-confirm=${e} @close=${()=>this.confirm=null}>
      <div class="dlg-acts">
        <sw-button data-mm-confirm-no autofocus @click=${()=>this.confirm=null}>${t?s("ביטול"):s("המשך עריכה")}</sw-button>
        <sw-button variant="danger" data-mm-confirm-yes @click=${()=>{t?(this.confirm=null,this.save(!0)):this.leaveEdit()}}>${t?s("החזר"):s("בטל שינויים")}</sw-button>
      </div></sw-dialog>`}body(){if(this.phase==="loading")return this.skeleton();if(this.phase==="error")return r`<div data-mm-state="error">${this.stateBox("warning",s("לא ניתן לטעון את הנגנים"),r`<button type="button" class="btn sm" data-mm-retry @click=${()=>{this.phase="loading",this.load()}}>${c("refresh")}${s("נסה שוב")}</button>`)}</div>`;if(this.phase==="forbidden")return r`<div data-mm-state="forbidden">${this.stateBox("speaker",s("אין הרשאת צפייה בנגנים"))}</div>`;if(this.phase==="disabled")return r`<div data-mm-state="disabled">${this.stateBox("power",s("המולטימדיה כבויה"))}</div>`;if(!this.devices.length){const l=this.status?.can.configure;return r`<div data-mm-state="empty">${this.stateBox("speaker",s("אין נגנים"),l?r`<a class="btn sm" href="#/system/multimedia">${s("להגדרות")}</a>`:void 0)}</div>`}const e=this.sections(),t=this.staleError?r`<div class="errbar" role="alert" data-mm-stale>${c("warning")}${s("הרענון האחרון נכשל. המצב עשוי להיות לא עדכני.")}<button type="button" class="btn sm" @click=${()=>void this.load()}>${s("נסה שוב")}</button></div>`:d;if(!e.length)return r`${t}<div data-mm-state="filtered">${this.stateBox("search",s("לא נמצאו נגנים"),Te(this.filters)?r`<button type="button" class="btn sm" data-clear-filters @click=${()=>this.setFilters(v)}>${s("נקה סינון")}</button>`:void 0)}</div>`;let i=0;const a=e.map(l=>(i+=l.devices.length,i-l.devices.length));this.fit.sync(i,`${e.map(l=>`${l.id}:${l.devices.map(n=>n.key).join(",")}`).join("|")}|${this.phone}`);const o=this.skin.bubble&&!this.editing?this.nowPlaying():null;return r`${t}${o?r`<media-now-hero .device=${o} @media-changed=${()=>this.scheduleRefresh(300)}></media-now-hero>`:d}<div class="groups" data-mm-state="ready">${e.map((l,n)=>this.section(l,a[n]))}</div>`}render(){const e=this.editing&&!!this.draft,t=this.body(),i=this.floorAction();return r`<sw-page class="page" wide heading=${s("נגנים ורמקולים")} subheading=${this.summary()} data-screen="multimedia-players">
      ${i===d?d:r`<div slot="actions" class="pacts">${i}</div>`}
      ${this.header()}
      ${e?r`<div class="editing-stack">${this.editBar()}</div>`:d}
      <div class=${E({scr:!0,editing:e})} data-mm-region @scroll=${this.onRegionScroll}>
        ${e?r`<div class="edit-layout"><multimedia-edit-panel class="edit-side" simple heading=${s("נגנים ורמקולים")} .draft=${this.draft} .devices=${P(this.devices)} scope="all" .floors=${xe(P(this.devices),this.draft).map(a=>a.id===ze?{...a,name:L}:a)} @layout-draft=${a=>this.patchDraft(a.detail)}></multimedia-edit-panel><div class="edit-cards">${t}</div></div>`:t}
      </div>
    </sw-page>
    <media-group-dialog @group-done=${()=>void this.load()}></media-group-dialog>
    ${this.confirmDialog()}
    ${this.playerKey?r`<media-player-panel .deviceKey=${this.playerKey} .open=${!0} @close=${()=>this.closePanel()}></media-player-panel>`:d}
    ${this.toast?r`<div class="toast" role="status" ${me()}>${c("check")}${this.toast}</div>`:d}`}};g.styles=[q,_e,N`
    /* CR-CMP2-SEGMENTED-C-2450: on a phone the state filter stays one line and scrolls sideways (the .dh-det .seg rule of media-page) */
    @media (max-width: 767px) {
      .dh-det sw-segmented {
        --sw-seg-wrap: nowrap;
      }
      .dh-det sw-segmented::part(track) {
        overflow-x: auto;
        scrollbar-width: none;
      }
    }
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
        --_mask: linear-gradient(180deg, transparent 0, #000 var(--sw-s-5));
        -webkit-mask-image: var(--_mask);
        mask-image: var(--_mask);
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
  `];S([H()],g.prototype,"playerKey",2);S([D()],g.prototype,"filters",2);S([ve("media-group-dialog")],g.prototype,"dialog",2);g=S([G("multimedia-players")],g);export{g as MultimediaPlayers};
