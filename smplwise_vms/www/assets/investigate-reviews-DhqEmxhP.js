import{E,F as u,G as c,a as R,A as o,e as r,th as D,ti as S,tj as _,H as O,i as Z,iZ as $,T as I,tk as J,tl as C,tm as X,n as Y,S as Q,tn as k,l as T,K as ee,qp as te,to as A,j as L,tp as se,tq as ae,ak as ie,tr as re,kd as ne,ts as P,tt as F,tu as oe,tv as B,C as le}from"./index-BGBybS0o.js";import{f as w,a as de}from"./frigate-text-BtdyLhFT.js";import{h as ce,r as pe,i as we,j as ve,k as ue,l as he,m as be}from"./frigate-control-K354cN8l.js";import"./investigate-events-C55JSwzY.js";import{I as fe}from"./investigate-r5-css-BUzOeMQH.js";import"./sw-logo-art-Va6y_cIM.js";import"./sw-table-DnL9KqmX.js";import"./sw-chip-BJFm4hqW.js";import"./recordings-C6fKqIfm.js";import"./event-codes-BzXiatYR.js";var me=Object.defineProperty,ge=Object.getOwnPropertyDescriptor,g=(e,t,s,a)=>{for(var i=a>1?void 0:a?ge(t,s):t,n=e.length-1,l;n>=0;n--)(l=e[n])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&me(t,s,i),i};const G=E`44px 96px minmax(140px, 1.4fr) 112px 72px minmax(120px, 1.2fr) minmax(120px, 1fr) minmax(100px, 1fr) 84px 150px`;let b=class extends R{constructor(){super(...arguments),this.selected=!1,this.focused=!1,this.canReview=!0,this.variant="card",this.tz="Asia/Jerusalem",this.broken=!1,this.loaded=!1}emit(e){this.dispatchEvent(new CustomEvent(e,{detail:{id:this.item.id},bubbles:!0,composed:!0}))}updated(e){this.toggleAttribute("data-reviewed",this.item?.reviewed===!0),e.has("item")&&e.get("item")&&e.get("item").thumb_url!==this.item?.thumb_url&&(this.loaded=!1,this.broken=!1)}focusCard(){this.renderRoot.querySelector("article")?.focus({preventScroll:!0}),this.renderRoot.querySelector("article")?.scrollIntoView({block:"nearest"})}still(e,t,s){const a=w().review,i=e.thumb_url??"",n=this.layerText(e.layer),l=e.thumbnail!=="ready"||!i||this.broken||this.loaded;return r`<button type="button" class="thumb" data-review-open ?data-settled=${l} aria-label=${`${a.open}: ${e.camera_name}`} @click=${()=>this.emit("review-open")}>
      ${e.thumbnail==="ready"&&i&&!this.broken?r`<img src=${i} alt="" loading="lazy" ?data-loaded=${this.loaded} @load=${()=>this.loaded=!0} @error=${()=>this.broken=!0} />`:r`<span class="none"><sw-icon name="image" size="22"></sw-icon>${a.noThumb}</span>`}
      ${s?r`<span class="shade"></span>`:o}
      ${s?r`<span class="layer" data-layer=${e.layer}><i></i>${n}</span>`:o}
      ${s&&e.layer!=="motion"?r`<span class="state" data-review-state=${e.reviewed?"reviewed":"new"}>${e.reviewed?r`<sw-icon name="check" size="12"></sw-icon><span>${a.reviewed}</span>`:r`<i></i><span>${a.unreviewed}</span>`}</span>`:o}
      ${t&&!s?r`<span class="dur">${t}</span>`:o}
      ${s?r`<span class="over"><span class="cam" title=${e.camera_name}>${e.camera_name}</span><time datetime=${e.start}>${D(e.start,this.tz)}${t?` · ${t}`:""}${e.end?o:r` · <span class="live" data-review-ongoing><i></i>${a.ongoing}</span>`}</time></span>`:o}
    </button>`}layerText(e){const t=w().review;return e==="alert"?t.layerAlertOne:e==="detection"?t.layerDetectionOne:t.layerMotionOne}card(e){const t=w().review,s=S(e.start,e.end),a=[e.area_name,e.floor_name].filter(Boolean).join(" · ");return r`<article tabindex="-1" data-review-card=${e.id} data-layer=${e.layer} data-reviewed=${String(e.reviewed)}>
      ${this.still(e,s,!0)}
      <div class="body">
        <div class="meta">
          ${e.objects.length?r`<ul class="objs" aria-label=${t.objects}>${e.objects.map(i=>r`<li class="obj" data-obj=${i}>${_(i)}</li>`)}</ul>`:o}
          <span class="zones" data-review-zones>${e.zones.length?e.zones.join(" · "):t.noZones}</span>
        </div>
        ${a?r`<div class="where" data-review-where><sw-icon name="pin" size="11"></sw-icon><span>${a}</span></div>`:o}
      </div>
      ${this.canReview?r`<footer>
            <label class="tick"><input type="checkbox" data-review-select .checked=${this.selected} aria-label=${`${t.selected}: ${e.camera_name}`} @change=${()=>this.emit("review-select")} /></label>
            <button type="button" class="mark" data-review-toggle @click=${()=>this.emit("review-toggle")}><sw-icon name="check" size="14"></sw-icon>${e.reviewed?t.markUnreviewed:t.markReviewed}</button>
          </footer>`:o}
    </article>`}row(e){const t=w().review,s=S(e.start,e.end),a=[e.area_name,e.floor_name].filter(Boolean).join(" · "),i=this.layerText(e.layer);return r`<article role="row" tabindex="-1" data-review-card=${e.id} data-layer=${e.layer} data-reviewed=${String(e.reviewed)}>
      ${this.canReview?r`<label class="tick" role="cell"><input type="checkbox" data-review-select .checked=${this.selected} aria-label=${`${t.selected}: ${e.camera_name}`} @change=${()=>this.emit("review-select")} /></label>`:r`<span role="cell"></span>`}
      ${this.still(e,s,!1)}
      <div class="fold">
        <div class="cell cam in-fold" role="cell"><b class="cam" title=${e.camera_name}>${e.camera_name}</b>${a?r`<small data-review-where>${a}</small>`:o}</div>
        <div class="cell in-fold" role="cell"><time datetime=${e.start}>${D(e.start,this.tz)}</time>${s?r`<span class="muted fold-only"> · ${s}</span>`:o}</div>
        <div class="cell muted" role="cell">${s??(e.end?"—":r`<span class="live" data-review-ongoing><i></i>${t.ongoing}</span>`)}</div>
        <div class="cell in-fold" role="cell">${e.objects.length?r`<ul class="objs" aria-label=${t.objects}>${e.objects.map(n=>r`<li class="obj" data-obj=${n}>${_(n)}</li>`)}</ul>`:r`<span class="muted">—</span>`}</div>
        <div class="cell muted zones" role="cell">${e.zones.length?e.zones.join(" · "):t.noZones}</div>
        <div class="cell muted" role="cell">${a||"—"}</div>
        <div class="cell" role="cell">${e.layer==="motion"?r`<span class="pill layer" data-layer=${e.layer}><i></i>${i}</span>`:r`<span class="pill" data-review-state=${e.reviewed?"reviewed":"new"}>${e.reviewed?r`<sw-icon name="check" size="12"></sw-icon>`:r`<i></i>`}${e.reviewed?t.reviewed:t.unreviewed}</span>`}</div>
      </div>
      <div class="rowacts" role="cell">
        ${this.canReview?r`<button type="button" class="mark" data-review-toggle title=${e.reviewed?t.markUnreviewed:t.markReviewed} @click=${()=>this.emit("review-toggle")}><sw-icon name="check" size="14"></sw-icon><span class="txt">${e.reviewed?t.markUnreviewed:t.markReviewed}</span></button>`:o}
        <button type="button" data-review-open-row title=${t.open} aria-label=${`${t.open}: ${e.camera_name}`} @click=${()=>this.emit("review-open")}><sw-icon name="chevron" size="16"></sw-icon></button>
      </div>
    </article>`}render(){const e=this.item;return e?this.variant==="row"?this.row(e):this.card(e):o}};b.styles=E`
    :host {
      display: block;
      min-inline-size: 0;
    }
    article {
      position: relative;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      overflow: hidden;
      min-inline-size: 0;
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    article:hover {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    :host([selected]) article {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 1px var(--sw-accent);
    }
    :host([focused]) article,
    article:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    article:focus {
      outline: none;
    }
    :host([focused]) article:focus {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    :host([data-reviewed]) .body,
    :host([data-reviewed]) .thumb img,
    :host([data-reviewed]) .cells {
      opacity: 0.6;
    }
    /* ---- the still ---- */
    .thumb {
      position: relative;
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      padding: 0;
      border: 0;
      background: var(--sw-video-bg);
      cursor: pointer;
      color: var(--sw-text-3);
      overflow: hidden;
    }
    .thumb img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      /* a still is a picture of the camera: never mirrored by RTL */
      direction: ltr;
      opacity: 0;
      transition: transform var(--sw-t-med) var(--sw-ease), opacity var(--sw-t-med) var(--sw-ease);
    }
    .thumb img[data-loaded] {
      opacity: 1;
    }
    /* while the still is on its way: a quiet shimmer over the video surface */
    .thumb::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.06) 50%, transparent 100%);
      background-size: 200% 100%;
      animation: frc-sh 1.6s linear infinite;
    }
    .thumb[data-settled]::before {
      display: none;
    }
    @keyframes frc-sh {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .thumb::before,
      .thumb img,
      article {
        animation: none;
        transition: none;
      }
    }
    article:hover .thumb img {
      transform: scale(1.03);
    }
    .thumb .shade {
      position: absolute;
      inset: auto 0 0 0;
      block-size: 46%;
      background: linear-gradient(to top, rgba(8, 12, 22, 0.78), rgba(8, 12, 22, 0));
      pointer-events: none;
    }
    .none {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-on-video-2);
      background: linear-gradient(135deg, var(--sw-surface-3), var(--sw-video-bg));
    }
    .layer {
      position: absolute;
      inset-inline-start: var(--sw-s-2);
      inset-block-start: var(--sw-s-2);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px var(--sw-s-2) 2px 6px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-on-video);
      background: var(--sw-video-scrim);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .layer i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-recorded);
    }
    .layer[data-layer='alert'] i {
      background: var(--sw-danger);
    }
    .layer[data-layer='detection'] i {
      background: var(--sw-stale);
    }
    .dur {
      position: absolute;
      inset-inline-end: var(--sw-s-2);
      inset-block-end: var(--sw-s-2);
      padding: 1px 6px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
      direction: ltr;
    }
    .live {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: inherit;
    }
    .live i {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: var(--sw-live);
      animation: frc-pulse 1.6s ease-in-out infinite;
    }
    @keyframes frc-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
    .state {
      position: absolute;
      inset-inline-end: var(--sw-s-2);
      inset-block-start: var(--sw-s-2);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-inline-size: 22px;
      block-size: 22px;
      padding-inline: 7px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .state[data-review-state='new'] {
      background: var(--sw-accent);
    }
    .state i {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: #fff;
    }
    .over {
      position: absolute;
      inset-inline: var(--sw-s-3);
      inset-block-end: var(--sw-s-2);
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sw-s-2);
      color: var(--sw-on-video);
      text-align: start;
      pointer-events: none;
      min-inline-size: 0;
    }
    .over .cam {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-inline-size: 0;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    }
    time {
      flex: none;
      font-size: var(--sw-fs-xs);
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .over time {
      color: rgba(255, 255, 255, 0.9);
    }
    /* ---- the body ---- */
    .body {
      display: grid;
      gap: 6px;
      padding: var(--sw-s-2) var(--sw-s-3) var(--sw-s-2);
      min-inline-size: 0;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px var(--sw-s-2);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    .where,
    .zones {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-inline-size: 0;
    }
    .where {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .objs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .obj {
      display: inline-flex;
      align-items: center;
      padding: 1px var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    footer {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: 0 var(--sw-s-2) 0 var(--sw-s-1);
      border-block-start: 1px solid var(--sw-border);
      min-block-size: 38px;
    }
    label.tick {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-inline-size: 40px;
      min-block-size: 36px;
      cursor: pointer;
    }
    label.tick input {
      inline-size: 16px;
      block-size: 16px;
      margin: 0;
      accent-color: var(--sw-accent);
    }
    button.mark {
      margin-inline-start: auto;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-block-size: 32px;
      padding-inline: var(--sw-s-2);
      border-radius: var(--sw-r-sm);
      border: 0;
      background: transparent;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    button.mark:hover {
      background: var(--sw-accent-soft);
    }
    :host([data-reviewed]) button.mark {
      color: var(--sw-text-2);
    }
    :host([data-reviewed]) button.mark:hover {
      background: var(--sw-surface-2);
    }
    button:focus-visible,
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* ---- the table row ---- */
    :host([variant='row']) article {
      display: grid;
      grid-template-columns: var(--rv-cols, ${G});
      align-items: center;
      gap: var(--sw-s-2);
      border-radius: 0;
      border-inline: 0;
      border-block-start: 0;
      background: transparent;
      min-block-size: 56px;
      padding-inline: var(--sw-s-1);
    }
    :host([variant='row']) article:hover {
      background: var(--sw-surface-2);
      box-shadow: none;
    }
    :host([variant='row'][selected]) article {
      background: var(--sw-accent-soft);
      box-shadow: none;
    }
    /* the selection bar sits at the reading start (right in Hebrew, left in English) */
    :host([variant='row'][selected]) article::before {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: 3px;
      background: var(--sw-accent);
    }
    :host([variant='row']) .thumb {
      inline-size: 96px;
      block-size: 54px;
      aspect-ratio: auto;
      border-radius: var(--sw-r-sm);
    }
    :host([variant='row']) .thumb .dur {
      inset: auto 3px 3px auto;
      font-size: var(--sw-fs-2xs);
      padding: 0 4px;
    }
    :host([variant='row']) .none {
      font-size: 0;
      gap: 0;
    }
    .cell {
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--sw-text);
    }
    .cell.muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .cell.cam {
      display: grid;
      gap: 1px;
    }
    .cell.cam b {
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cell.cam small {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cell time {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .cell .objs {
      flex-wrap: nowrap;
      overflow: hidden;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 1px var(--sw-s-2) 1px 6px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .pill i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-recorded);
    }
    .pill[data-layer='alert'] i {
      background: var(--sw-danger);
    }
    .pill[data-layer='detection'] i {
      background: var(--sw-stale);
    }
    .pill[data-review-state='new'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .pill[data-review-state='new'] i {
      background: var(--sw-accent);
    }
    .pill[data-review-state='reviewed'] {
      color: var(--sw-text-2);
    }
    .rowacts {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 2px;
    }
    .rowacts button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-inline-size: 36px;
      min-block-size: 36px;
      padding-inline: var(--sw-s-2);
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .rowacts button:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .rowacts button.mark {
      margin: 0;
      color: var(--sw-accent-text);
    }
    .rowacts button.mark:hover {
      background: var(--sw-accent-soft);
    }
    /* a narrow table (tablet portrait, phone): the row folds to the still and two text lines; the header is hidden by the screen */
    @media (max-width: 899px) {
      :host([variant='row']) article {
        grid-template-columns: 40px 96px minmax(0, 1fr) auto;
        grid-template-areas: 'tick thumb main acts';
        padding-block: var(--sw-s-2);
      }
      :host([variant='row']) label.tick {
        grid-area: tick;
      }
      :host([variant='row']) .thumb {
        grid-area: thumb;
      }
      :host([variant='row']) .fold {
        grid-area: main;
        display: grid;
        gap: 2px;
        min-inline-size: 0;
      }
      :host([variant='row']) .cell:not(.in-fold) {
        display: none;
      }
      :host([variant='row']) .rowacts {
        grid-area: acts;
      }
      :host([variant='row']) .rowacts .txt {
        display: none;
      }
    }
    @media (min-width: 900px) {
      :host([variant='row']) .fold {
        display: contents;
      }
      /* the duration has its own column on a wide table */
      :host([variant='row']) .fold-only {
        display: none;
      }
    }
  `;g([u({attribute:!1})],b.prototype,"item",2);g([u({type:Boolean,reflect:!0})],b.prototype,"selected",2);g([u({type:Boolean,reflect:!0})],b.prototype,"focused",2);g([u({type:Boolean})],b.prototype,"canReview",2);g([u({reflect:!0})],b.prototype,"variant",2);g([u()],b.prototype,"tz",2);g([c()],b.prototype,"broken",2);g([c()],b.prototype,"loaded",2);b=g([O("frigate-review-card")],b);var xe=Object.defineProperty,ye=Object.getOwnPropertyDescriptor,x=(e,t,s,a)=>{for(var i=a>1?void 0:a?ye(t,s):t,n=e.length-1,l;n>=0;n--)(l=e[n])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&xe(t,s,i),i};let f=class extends R{constructor(){super(...arguments),this.recorderId="",this.eventId="",this.label="",this.ready=!1,this.data=null,this.draft="",this.busy=!1,this.msg=null,this.seq=0}connectedCallback(){super.connectedCallback(),this.load()}updated(e){(e.has("eventId")||e.has("recorderId"))&&e.get("eventId")!==void 0&&this.load()}async load(){const e=++this.seq;if(this.data=null,this.ready=!1,!(!Z()||!this.recorderId||!this.eventId))try{const t=await ce(this.recorderId,this.eventId);if(e!==this.seq)return;this.data=t.writable?t:null,this.draft=t.sub_label??"",this.ready=t.writable}catch{e===this.seq&&(this.data=null)}}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},3500)}async toggleRetain(e){const t=e.currentTarget,s=t.checked;this.busy=!0;try{const a=await pe(this.recorderId,this.eventId,s);this.data&&(this.data={...this.data,retain:s}),this.flash("ok",a.verified?$.frigate.control.saved:$.frigate.control.unverified)}catch(a){t.checked=!s,this.flash("err",`${$.frigate.control.failed}: ${I(a)}`),this.load()}finally{this.busy=!1}}async saveLabel(){const e=this.draft.trim();this.busy=!0;try{const t=await we(this.recorderId,this.eventId,e||null);this.data&&(this.data={...this.data,sub_label:t.sub_label}),this.draft=t.sub_label??"",this.flash("ok",t.verified?$.frigate.control.saved:$.frigate.control.unverified)}catch(t){this.flash("err",`${$.frigate.control.failed}: ${I(t)}`),this.load()}finally{this.busy=!1}}render(){const e=this.data;if(!e)return o;const t=$.frigate.control,s=this.draft.trim()!==(e.sub_label??"");return r`<div class="row" data-event-control=${this.eventId}>
      <span class="lead">${this.label}</span>
      <span class="keep"><span>${t.retain}</span><sw-toggle .checked=${e.retain===!0} ?disabled=${this.busy} labelHidden label=${t.retain} data-event-retain @change=${a=>void this.toggleRetain(a)}></sw-toggle></span>
      <input type="text" maxlength="60" aria-label=${t.subLabel} placeholder=${t.subLabel} data-event-sub-label .value=${this.draft} ?disabled=${this.busy}
        @input=${a=>this.draft=a.target.value} @keydown=${a=>{a.key==="Enter"&&s&&!this.busy&&this.saveLabel()}} />
      <sw-button size="sm" data-event-sub-label-save ?disabled=${!s||this.busy} @click=${()=>void this.saveLabel()}>${t.subLabelSave}</sw-button>
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-event-msg>${this.msg.text}</div>`:o}
    </div>`}};f.styles=E`
    :host {
      display: none;
    }
    :host([ready]) {
      display: block;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2) var(--sw-s-3);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .lead {
      font-weight: var(--sw-fw-medium);
      min-inline-size: 5em;
    }
    .keep {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    input {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1) var(--sw-s-2);
      inline-size: 11em;
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    .msg {
      font-size: var(--sw-fs-xs);
      flex-basis: 100%;
    }
    .msg.ok {
      color: var(--sw-success-text);
    }
    .msg.err {
      color: var(--sw-danger-text);
    }
  `;x([u({attribute:"recorder-id"})],f.prototype,"recorderId",2);x([u({attribute:"event-id"})],f.prototype,"eventId",2);x([u()],f.prototype,"label",2);x([u({type:Boolean,reflect:!0})],f.prototype,"ready",2);x([c()],f.prototype,"data",2);x([c()],f.prototype,"draft",2);x([c()],f.prototype,"busy",2);x([c()],f.prototype,"msg",2);f=x([O("frigate-event-control")],f);var $e=Object.defineProperty,ke=Object.getOwnPropertyDescriptor,j=(e,t,s,a)=>{for(var i=a>1?void 0:a?ke(t,s):t,n=e.length-1,l;n>=0;n--)(l=e[n])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&$e(t,s,i),i};const ze=6,K=(e,t)=>Y(new Date(e),{timeZone:t,seconds:!0});let y=class extends R{constructor(){super(...arguments),this.detail=null,this.canReview=!0,this.canEvents=!1,this.canExport=!1,this.tz="Asia/Jerusalem"}fire(e){this.dispatchEvent(new CustomEvent(e,{detail:{id:this.detail?.id},bubbles:!0,composed:!0}))}eventControls(e){const t=(e.detection_ids??[]).slice(0,ze);if(!this.canEvents||!e.recorder_id||!t.length||e.layer==="motion")return o;const s=e.objects.length===(e.detection_ids??[]).length;return r`<section class="events" data-review-events>
      ${t.map((a,i)=>r`<frigate-event-control recorder-id=${e.recorder_id} event-id=${a} label=${s?_(e.objects[i]):`${w().control.eventObject} ${i+1}`}></frigate-event-control>`)}
    </section>`}layerText(e){const t=w().review;return e==="alert"?t.layerAlertOne:e==="detection"?t.layerDetectionOne:t.layerMotionOne}render(){const e=this.detail;if(!e)return o;const t=w().review,s=J(e),a=S(e.start,e.end),i=[e.area_name,e.floor_name].filter(Boolean).join(" · ");return r`<div class="wrap" data-review-detail=${e.id}>
      <div class="hero">
        ${e.thumbnail==="ready"?r`<img class="pic" alt="" src=${e.thumb_url??""} />`:r`<div class="nopic"><sw-icon name="image" size="20"></sw-icon>${t.noThumb}</div>`}
        <span class="tag layer" data-layer=${e.layer}><i></i>${this.layerText(e.layer)}</span>
        ${e.layer==="motion"?o:r`<span class="tag state" data-review-state=${e.reviewed?"reviewed":"new"}>${e.reviewed?r`<sw-icon name="check" size="12"></sw-icon>${t.reviewed}`:r`<i></i>${t.unreviewed}`}</span>`}
        ${a?r`<span class="dur">${a}</span>`:o}
      </div>
      <dl class="facts">
        <div class="fact"><dt>${t.camera}</dt><dd>${e.camera_name}</dd></div>
        <div class="fact"><dt>${t.time}</dt><dd><time datetime=${e.start}>${D(e.start,this.tz)}</time>${a?` · ${a}`:""}</dd></div>
        ${i?r`<div class="fact"><dt>${t.where}</dt><dd>${i}</dd></div>`:o}
        <div class="fact"><dt>${t.zones}</dt><dd>${e.zones.length?e.zones.join(" · "):t.noZones}</dd></div>
        <div class="fact ${i?"wide":""}"><dt>${t.objects}${e.detections?r` · <span data-review-detections>${e.detections}</span>`:o}</dt>
          <dd>${e.objects.length?r`<span class="objs">${e.objects.map(n=>r`<span class="obj" data-obj=${n}>${_(n)}</span>`)}</span>`:"—"}</dd></div>
      </dl>
      <section data-review-timeline>
        <h3>${e.tracked.length?t.timeline:t.activity}</h3>
        ${e.tracked.length?e.tracked.map(n=>r`<div class="obj-block" data-tracked=${n.id}>
              <div class="obj-h"><span>${_(n.label)}${n.sub_label?` · ${n.sub_label}`:""}</span><small>${n.top_score!=null?`${t.topScore} ${Math.round(n.top_score*100)}%`:""}</small></div>
              <ol>${n.timeline.map(l=>r`<li data-timeline-row=${l.kind}><time datetime=${l.at}>${K(l.at,this.tz)}</time><span>${C(l.kind,l.zone,l.note)}</span></li>`)}</ol>
            </div>`):r`<ol data-review-activity>${X(e).map(n=>r`<li data-timeline-row=${n.kind}><time datetime=${n.at}>${K(n.at,this.tz)}</time><span>${C(n.kind)}</span></li>`)}</ol>`}
      </section>
      ${this.eventControls(e)}
      <div class="actions">
        <sw-button variant="primary" icon="history" data-review-play ?disabled=${!s.available} @click=${()=>s.available&&this.fire("review-play")}>${t.openRecording}</sw-button>
        ${this.canExport&&e.layer!=="motion"?r`<sw-button icon="download" data-review-export @click=${()=>this.fire("review-export")}>${t.exportClip}</sw-button>`:o}
        ${this.canReview?r`<sw-button variant="ghost" icon="check" data-review-detail-toggle @click=${()=>this.fire("review-toggle")}>${e.reviewed?t.markUnreviewed:t.markReviewed}</sw-button>`:o}
      </div>
      ${s.available?o:r`<div class="why" data-review-play-why><sw-icon name="info" size="14"></sw-icon>${s.reason}</div>`}
    </div>`}};y.styles=E`
    :host {
      display: block;
    }
    .wrap {
      display: grid;
      gap: var(--sw-s-4);
    }
    .hero {
      position: relative;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      background: var(--sw-video-bg);
      overflow: hidden;
    }
    .hero img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
      direction: ltr;
    }
    .nopic {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: var(--sw-on-video-2);
      font-size: var(--sw-fs-sm);
      background: linear-gradient(135deg, var(--sw-surface-3), var(--sw-video-bg));
    }
    .tag {
      position: absolute;
      inset-block-start: var(--sw-s-2);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px var(--sw-s-2) 2px 6px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-on-video);
      background: var(--sw-video-scrim);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .tag.layer {
      inset-inline-start: var(--sw-s-2);
    }
    .tag.state {
      inset-inline-end: var(--sw-s-2);
    }
    .tag.state[data-review-state='new'] {
      background: var(--sw-accent);
    }
    .tag i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-recorded);
    }
    .tag[data-layer='alert'] i {
      background: var(--sw-danger);
    }
    .tag[data-layer='detection'] i {
      background: var(--sw-stale);
    }
    .tag.state i {
      background: #fff;
      inline-size: 6px;
      block-size: 6px;
    }
    .dur {
      position: absolute;
      inset-inline-end: var(--sw-s-2);
      inset-block-end: var(--sw-s-2);
      padding: 1px 6px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      font-variant-numeric: tabular-nums;
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sw-s-2);
      margin: 0;
    }
    .fact {
      display: grid;
      gap: 2px;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      min-inline-size: 0;
    }
    .fact.wide {
      grid-column: 1 / -1;
    }
    .fact dt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .fact dd {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
      overflow-wrap: anywhere;
    }
    .fact dd time {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .objs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .obj {
      display: inline-flex;
      padding: 1px var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    h3 {
      margin: 0 0 var(--sw-s-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .obj-block {
      border-block-start: 1px solid var(--sw-border);
      padding-block: var(--sw-s-2);
    }
    .obj-h {
      display: flex;
      justify-content: space-between;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .obj-h small {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-regular);
      font-variant-numeric: tabular-nums;
    }
    ol {
      list-style: none;
      margin: var(--sw-s-2) 0 0;
      padding: 0 var(--sw-s-3) 0 0;
      display: grid;
      gap: 6px;
      position: relative;
    }
    ol::before {
      content: '';
      position: absolute;
      inset-block: 4px;
      inset-inline-start: 3px;
      inline-size: 2px;
      border-radius: 1px;
      background: var(--sw-border-strong);
    }
    li {
      position: relative;
      display: flex;
      gap: var(--sw-s-3);
      font-size: var(--sw-fs-xs);
      min-inline-size: 0;
      padding-inline-start: var(--sw-s-3);
    }
    li::before {
      content: '';
      position: absolute;
      inset-inline-start: 0;
      inset-block-start: 5px;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-surface);
      border: 2px solid var(--sw-accent);
      box-sizing: border-box;
    }
    li[data-timeline-row='end']::before,
    li[data-timeline-row='exit']::before {
      border-color: var(--sw-text-3);
    }
    li[data-timeline-row='ongoing']::before {
      background: var(--sw-live);
      border-color: var(--sw-live);
    }
    li time {
      flex: none;
      color: var(--sw-text-2);
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
      min-inline-size: 4.6em;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
      padding-block-start: var(--sw-s-2);
      border-block-start: 1px solid var(--sw-border);
    }
    .events {
      display: grid;
      gap: var(--sw-s-2);
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: var(--sw-s-3);
    }
    .events:not(:has([ready])) {
      display: none;
    }
    .why {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `;j([u({attribute:!1})],y.prototype,"detail",2);j([u({type:Boolean})],y.prototype,"canReview",2);j([u({type:Boolean})],y.prototype,"canEvents",2);j([u({type:Boolean})],y.prototype,"canExport",2);j([u()],y.prototype,"tz",2);y=j([O("frigate-review-detail")],y);const _e=(e,t,s)=>`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${e}"/><stop offset="1" stop-color="${t}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><circle cx="170" cy="96" r="22" fill="rgba(255,255,255,.35)"/><rect x="146" y="116" width="48" height="50" rx="14" fill="rgba(255,255,255,.28)"/><text x="12" y="20" font-size="12" fill="rgba(255,255,255,.7)" font-family="sans-serif">${s}</text></svg>`)}`,z=[{id:"fg-front",name:"כניסה ראשית",area:"כניסה",floor:"קומת קרקע"},{id:"fg-yard",name:"חצר אחורית",area:"חצר",floor:"קומת קרקע"},{id:"fg-garage",name:"חניה",area:"חניה",floor:"קומת קרקע"},{id:"fg-gate",name:"שער צדדי עם שם ארוך מאוד של מצלמה",area:null,floor:null}],je=Date.parse("2026-10-06T08:00:00Z"),M=e=>new Date(je-e*6e4).toISOString(),m=(e,t,s,a,i,n,l={})=>({id:`rv-${e}`,recorder_id:"nvr-2",camera_id:z[t].id,camera_name:z[t].name,start:M(a),end:M(a-1),layer:s,objects:i,zones:n,area_name:z[t].area,floor_name:z[t].floor,thumbnail:"ready",thumb_url:_e(s==="alert"?"#7a2e2e":s==="detection"?"#7a5a2e":"#2e4a7a","#1d2330",`rv-${e}`),reviewed:!1,playback:{available:!1,reason:"not_ready"},...l}),H=[m(1,0,"alert",12,["person"],["מדרגות כניסה"],{playback:{available:!0}}),m(2,0,"alert",47,["person","dog"],["מדרגות כניסה","שביל"]),m(3,1,"alert",130,["person"],["דשא"],{reviewed:!0,playback:{available:!0}}),m(4,2,"alert",260,["car"],["חניה"],{playback:{available:!1,reason:"no_coverage"}}),m(5,3,"alert",410,["person","package"],[],{end:null,thumbnail:"none",thumb_url:void 0}),m(6,1,"detection",20,["cat"],[]),m(7,2,"detection",95,["car"],["רחוב"]),m(8,0,"motion",30,[],[]),m(9,1,"motion",33,[],[])],V=(e,t)=>({alert:e.filter(s=>s.layer==="alert"&&t(s)).length,detection:e.filter(s=>s.layer==="detection"&&t(s)).length,motion:e.filter(s=>s.layer==="motion"&&t(s)).length});function Ie(e,t){const s=e.filter(i=>(!t.camera||i.camera_id===t.camera)&&(!t.object||i.objects.includes(t.object)));return{available:!0,items:s.filter(i=>i.layer===t.layer&&(t.reviewed==null||String(i.reviewed)===t.reviewed)),counts:V(s,()=>!0),unreviewed:V(s,i=>!i.reviewed),facets:{objects:[...new Set(e.flatMap(i=>i.objects))].sort()},next_cursor:null,partial_coverage:!0}}function Ee(e,t=H){const s=t.find(n=>n.id===e);if(!s)return null;const a=Date.parse(s.start),i=n=>new Date(a+n*1e3).toISOString();return{...s,tracked:s.objects.length?s.objects.map((n,l)=>({id:`${s.id}-o${l}`,label:n,sub_label:null,start:i(l*4),end:s.end?i(40+l*4):null,top_score:.87-l*.1,zones:s.zones,timeline:[{at:i(l*4),kind:"enter"},...s.zones.map((h,d)=>({at:i(6+l*4+d*8),kind:"zone",zone:h})),{at:i(30+l*4),kind:"stationary"},...s.end?[{at:i(40+l*4),kind:"exit"}]:[]]})):[]}}z.map(e=>({id:e.id,key:`cam_${e.id.replace("fg-","")}`,name:e.name,enabled:!0,frigate_enabled:e.id!=="fg-gate"}));function Se(e){const t=e.target?.tagName?.toLowerCase()??"";if(t==="input"||t==="textarea"||t==="select"||e.target?.isContentEditable)return null;const s=e.path??[];if(s.some(i=>i==="sw-dropdown"||i==="input"||i==="textarea"||i==="select")||(e.key===" "||e.key==="Enter")&&(t==="button"||t==="a"||s[0]==="button"||s[0]==="a"||t==="sw-button")||e.altKey)return null;const a=e.key.length===1?e.key.toLowerCase():e.key;if((e.ctrlKey||e.metaKey)&&a==="a")return"select-all";if(e.ctrlKey||e.metaKey)return null;switch(a){case"ArrowRight":case"ArrowDown":case"j":return"next";case"ArrowLeft":case"ArrowUp":case"k":return"prev";case"Home":return"first";case"End":return"last";case" ":case"x":return"toggle-select";case"r":return"toggle-reviewed";case"Enter":return"open";case"Escape":return"escape";default:return null}}function Re(e,t,s){return s<=0?-1:e<0?t===1?0:s-1:Math.min(s-1,Math.max(0,e+t))}function U(e,t,s){return s<=0?-1:t==="first"?0:t==="last"?s-1:Re(e,t==="next"?1:-1,s)}function Oe(e,t){return e.camera!==t.camera||e.period!==t.period||e.status!==t.status||e.object!==t.object}function q(e,t){const s=new Set(e);return s.has(t)?s.delete(t):s.add(t),s}function Te(e,t){return e.size?[...e]:t?[t]:[]}function N(e,t){const s=e.filter(a=>t.includes(a.id));return!(s.length>0&&s.every(a=>a.reviewed))}function De(e,t,s){const a=new Set(t),i={},n=e.items.map(h=>!a.has(h.id)||h.reviewed===s?h:(i[h.layer]=(i[h.layer]??0)+(s?-1:1),{...h,reviewed:s})),l={...e.unreviewed};for(const[h,d]of Object.entries(i))l[h]=Math.max(0,l[h]+d);return{...e,items:n,unreviewed:l}}function Ce(e){return e.forbidden?"forbidden":e.list?e.list.items.length?"ready":e.list.stale?"offline-empty":e.statusUnreviewed&&Object.values(e.list.counts).some(t=>t>0)?"all-reviewed":"empty":e.error?"error":"loading"}function Ae(e,t){const s=new Set(e.items.map(a=>a.id));return{...t,items:[...e.items,...t.items.filter(a=>!s.has(a.id))]}}var Le=Object.defineProperty,Pe=Object.getOwnPropertyDescriptor,v=(e,t,s,a)=>{for(var i=a>1?void 0:a?Pe(t,s):t,n=e.length-1,l;n>=0;n--)(l=e[n])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&Le(t,s,i),i};const Fe=e=>e.layer==="motion"&&(e.period==="7d"||e.period==="30d"),Be=3e4,Ke={available:!1,items:[],counts:{alert:0,detection:0,motion:-1},unreviewed:{alert:0,detection:0,motion:0},facets:{objects:[]},next_cursor:null},W="sw.reviews.view",Me=()=>{try{return localStorage.getItem(W)==="table"?"table":"cards"}catch{return"cards"}};let p=class extends R{constructor(){super(...arguments),this.bubbleSkin=new Q(this),this.cameraId="",this.date="",this.filters={...k},this.list=null,this.error="",this.forbidden=!1,this.busy=!1,this.moreBusy=!1,this.cams=[],this.tz="Asia/Jerusalem",this.selected=new Set,this.focusIdx=-1,this.drawer=null,this.notice="",this.toast=null,this.view=Me(),this.keysOpen=!1,this.exportOn=new Set,this.exp=null,this.demoItems=H.map(e=>({...e})),this.timer=0,this.seq=0,this.policyRead=new Set,this.io=null,this.focusByKey=!1,this.onVisible=()=>{!document.hidden&&this.list?.available&&!this.drawer&&this.load(!0)},this.onKey=e=>{if(!this.list?.available||this.exp||this.keysOpen)return;const t=Se({key:e.key,ctrlKey:e.ctrlKey,metaKey:e.metaKey,altKey:e.altKey,target:e.target,path:e.composedPath().map(a=>a.tagName?.toLowerCase()??"")});if(!t)return;const s=this.list.items;if(this.drawer){t==="escape"?this.closeDrawer():t==="toggle-reviewed"?(e.preventDefault(),this.mark([this.drawer.item.id],!this.drawer.item.reviewed)):(t==="next"||t==="prev"||t==="first"||t==="last")&&(e.preventDefault(),this.step(t));return}switch(t){case"next":case"prev":case"first":case"last":e.preventDefault(),this.focusByKey=!0,this.focusIdx=U(this.focusIdx,t,s.length);break;case"toggle-select":s[this.focusIdx]&&this.canReview&&(e.preventDefault(),this.selected=q(this.selected,s[this.focusIdx].id));break;case"toggle-reviewed":{const a=Te(this.selected,s[this.focusIdx]?.id??null);a.length&&(e.preventDefault(),this.mark(a,N(s,a)));break}case"open":s[this.focusIdx]&&(e.preventDefault(),this.open(s[this.focusIdx]));break;case"select-all":this.canReview&&(e.preventDefault(),this.selected=new Set(s.map(a=>a.id)));break;case"escape":this.selected=new Set;break}}}get demo(){return!Z()}get canReview(){return this.filters.layer!=="motion"}get mayExport(){return!this.demo&&T("analytics.exports")&&T("video.export")}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onKey),document.addEventListener("visibilitychange",this.onVisible),this.timer=window.setInterval(()=>this.poll(),Be),this.init()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),document.removeEventListener("visibilitychange",this.onVisible),window.clearInterval(this.timer),this.io?.disconnect(),this.io=null}updated(e){e.has("focusIdx")&&this.focusIdx>=0&&this.focusByKey&&(this.focusByKey=!1,this.renderRoot.querySelectorAll("frigate-review-card")[this.focusIdx]?.focusCard?.()),(e.has("list")||e.has("view"))&&this.watchFoot()}watchFoot(){this.io?.disconnect(),this.io=null;const e=this.renderRoot.querySelector("[data-review-foot]");!e||typeof IntersectionObserver>"u"||(this.io=new IntersectionObserver(t=>{t.some(s=>s.isIntersecting)&&this.more()},{rootMargin:"240px 0px"}),this.io.observe(e))}async init(){if(this.demo){this.cams=z.map(e=>({id:e.id,name:e.name})),await this.load();return}try{const[e,t]=await Promise.all([ee(),te()]);this.tz=e["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras.map(s=>({id:s.id,name:s.alias||s.name,recorder_id:s.recorder_id}))}catch{}await this.load()}poll(){document.hidden||this.busy||this.drawer||this.selected.size||this.exp||!this.list?.available||this.load(!0)}async load(e=!1){const t=++this.seq;e||(this.busy=!0);try{const s=this.demo?Ie(this.demoItems,{layer:this.filters.layer,camera:this.filters.camera,object:this.filters.object,reviewed:this.filters.status==="all"||this.filters.layer==="motion"?void 0:String(this.filters.status==="reviewed")}):await A(this.filters);if(t!==this.seq)return;this.list=s,this.error="",this.forbidden=!1,e||(this.selected=new Set,this.focusIdx=-1),this.readExportPolicy(s.recorder_ids??[])}catch(s){if(t!==this.seq)return;s instanceof L&&s.status===403?this.forbidden=!0:s instanceof L&&s.status===404&&!this.list?this.list=Ke:this.error=I(s)}finally{t===this.seq&&(this.busy=!1)}}async readExportPolicy(e){if(!this.mayExport)return;const t=e.filter(s=>!this.policyRead.has(s));if(t.length){for(const s of t)this.policyRead.add(s);await Promise.all(t.map(async s=>{try{(await ve(s)).classes.some(i=>i.class==="exports"&&i.enabled)&&(this.exportOn=new Set([...this.exportOn,s]))}catch{}}))}}async more(){if(!(!this.list?.next_cursor||this.moreBusy)){this.moreBusy=!0;try{this.list=Ae(this.list,await A(this.filters,this.list.next_cursor))}catch(e){this.error=I(e)}finally{this.moreBusy=!1}}}setFilter(e){this.filters={...this.filters,...e},this.load()}clearFilters(){this.setFilter({camera:k.camera,period:k.period,status:k.status,object:k.object})}setView(e){this.view=e;try{localStorage.setItem(W,e)}catch{}}flash(e,t){this.toast={tone:e,text:t},window.setTimeout(()=>{this.toast?.text===t&&(this.toast=null)},4e3)}async mark(e,t){if(!this.list||!e.length||!this.canReview)return;const s=this.list;if(this.notice="",this.list=De(this.list,e,t),this.drawer&&e.includes(this.drawer.item.id)){const a={...this.drawer.item,reviewed:t};this.drawer={...this.drawer,item:a,detail:this.drawer.detail?{...this.drawer.detail,reviewed:t}:null}}try{this.demo?this.demoItems=this.demoItems.map(a=>e.includes(a.id)?{...a,reviewed:t}:a):await se(s.items.filter(a=>e.includes(a.id)),t),this.selected=new Set}catch{this.list=s,this.notice=w().review.markFailed}}markShown(){const e=(this.list?.items??[]).filter(t=>!t.reviewed).map(t=>t.id);this.mark(e,!0)}async open(e){this.drawer={item:e,detail:null,loading:!0};try{const t=this.demo?Ee(e.id,this.demoItems):await ae(e);this.drawer?.item.id===e.id&&(this.drawer={item:this.drawer.item,detail:t?{...t,reviewed:this.drawer.item.reviewed}:{...e,tracked:[]},loading:!1})}catch{this.drawer?.item.id===e.id&&(this.drawer={item:this.drawer.item,detail:{...this.drawer.item,tracked:[]},loading:!1})}}closeDrawer(){this.drawer=null}drawerIdx(){const e=this.drawer?.item.id;return e?(this.list?.items??[]).findIndex(t=>t.id===e):-1}step(e){const t=this.list?.items??[],s=U(this.drawerIdx(),e,t.length);s<0||!t[s]||t[s].id===this.drawer?.item.id||(this.focusIdx=s,this.open(t[s]))}play(){this.drawer&&ie("/investigate/playback",re(this.drawer.item))}async openExport(){const e=this.drawer?.item;if(!e||!this.exportOn.has(e.recorder_id))return;const t=Math.floor(Date.parse(e.start)/1e3),s=e.end?Math.ceil(Date.parse(e.end)/1e3):Math.min(t+60,Math.floor(Date.now()/1e3)),a=ne(new Date(e.start),{timeZone:this.tz});this.exp={item:e,name:`${e.camera_name} ${a}`.slice(0,80),start:t,end:Math.max(s,t+1),first:null,supervised:!1,busy:!1,error:""};try{const i=await ue(e.recorder_id);this.exp?.item.id===e.id&&(this.exp={...this.exp,first:i})}catch{}}async submitExport(){const e=this.exp;if(!(!e||e.busy||!e.name.trim())){this.exp={...e,busy:!0,error:""};try{const t={camera_id:e.item.camera_id,start:e.start,end:e.end,name:e.name.trim(),...e.supervised?{supervised:!0}:{}},s=await he(e.item.recorder_id,t);this.exp=null,this.flash("ok",s.verified?w().review.exported:w().control.unverified)}catch(t){const s=be(t)?w().control.settings.supervised.need:`${w().review.exportFailed}: ${I(t)}`;this.exp={...e,busy:!1,error:s}}}}dd(e,t,s,a,i){return r`<sw-dropdown data-review-filter=${e} .label=${t} .placeholder=${t} .value=${s} .items=${a} @change=${n=>i(n.detail.id)}></sw-dropdown>`}toolbar(e){const t=w().review,s=this.filters,a=e.recorder_ids?this.cams.filter(d=>!d.recorder_id||e.recorder_ids.includes(d.recorder_id)):this.cams,i=[{id:"",label:t.allCameras},...a.map(d=>({id:d.id,label:d.name}))],n=[{id:"",label:t.allObjects},...e.facets.objects.map(d=>({id:d,label:_(d)}))],l=Object.keys(P).map(d=>({id:d,label:P[d]})),h=Object.keys(F).map(d=>({id:d,label:F[d]}));return r`
      <div class="toolbar" data-review-toolbar>
        <div class="layers" role="tablist" aria-label=${t.title}>
          ${oe.map(d=>r`<button type="button" role="tab" data-review-layer=${d} data-layer=${d} aria-selected=${String(s.layer===d)} @click=${()=>this.setFilter({layer:d})}>
            ${B[d].many}${e.counts[d]>=0?r`<span class="n">${e.counts[d]}</span>`:o}${e.unreviewed[d]>0?r`<span class="new" title=${`${e.unreviewed[d]} ${t.unreviewed}`} data-review-new=${d}></span>`:o}
          </button>`)}
        </div>
        <span class="grow"></span>
        <div class="seg" role="group" aria-label=${t.view} data-review-view>
          <button type="button" aria-pressed=${String(this.view==="cards")} title=${t.viewCards} aria-label=${t.viewCards} data-review-view-cards @click=${()=>this.setView("cards")}><sw-icon name="grid" size="15"></sw-icon></button>
          <button type="button" aria-pressed=${String(this.view==="table")} title=${t.viewTable} aria-label=${t.viewTable} data-review-view-table @click=${()=>this.setView("table")}><sw-icon name="list" size="15"></sw-icon></button>
        </div>
        <button type="button" class="ib" title=${t.keysTitle} aria-label=${t.keysTitle} data-review-keys @click=${()=>this.keysOpen=!0}><sw-icon name="help" size="16"></sw-icon></button>
        ${this.canReview?r`<sw-button size="sm" icon="check" data-review-mark-shown ?disabled=${!e.items.some(d=>!d.reviewed)} @click=${()=>this.markShown()}>${t.markShown}</sw-button>`:o}
      </div>
      <div class="filters">
        ${this.dd("camera",t.camera,s.camera,i,d=>this.setFilter({camera:d}))}
        ${this.dd("period",t.period,s.period,l,d=>this.setFilter({period:d}))}
        ${this.dd("status",t.status,s.status,h,d=>this.setFilter({status:d}))}
        ${e.facets.objects.length?this.dd("object",t.object,s.object,n,d=>this.setFilter({object:d})):o}
      </div>`}notes(e){const t=w().review,s=[e.stale?r`<span class="note" role="status" data-review-offline><sw-icon name="offline" size="13"></sw-icon>${t.offline}</span>`:o,this.error?r`<span class="note err" role="alert" data-review-error>${this.error} <button type="button" class="linkbtn" @click=${()=>this.load()}>${t.retry}</button></span>`:o,this.notice?r`<span class="note err" role="alert" data-review-notice>${this.notice}</span>`:o,this.toast?r`<span class=${`note ${this.toast.tone}`} role="status" data-review-toast>${this.toast.text}</span>`:o,Fe(this.filters)?r`<span class="note info" data-review-motion-cap><sw-icon name="clock" size="13"></sw-icon>${t.motionCap}</span>`:o,e.partial_coverage?r`<span class="note info" data-review-partial><sw-icon name="info" size="13"></sw-icon>${t.partialCoverage}</span>`:o].filter(a=>a!==o);return s.length?r`<div class="notes">${s}</div>`:o}items(e){const t=w().review,s=(a,i,n)=>r`<frigate-review-card role=${n==="row"?"row":"listitem"} variant=${n} .item=${a} .tz=${this.tz} .canReview=${this.canReview} ?selected=${this.selected.has(a.id)} ?focused=${i===this.focusIdx}
      @focusin=${()=>{this.focusIdx!==i&&(this.focusIdx=i)}}
      @review-open=${()=>void this.open(a)} @review-select=${()=>this.selected=q(this.selected,a.id)} @review-toggle=${()=>void this.mark([a.id],!a.reviewed)}></frigate-review-card>`;return this.view==="table"?r`<div class="tbl" role="table" aria-label=${t.title} data-review-table>
        <div class="h" role="row"><span></span><span></span><span>${t.camera}</span><span>${t.time}</span><span>${t.duration}</span><span>${t.objects}</span><span>${t.zones}</span><span>${t.where}</span><span>${t.state}</span><span class="end">${t.actions}</span></div>
        ${e.items.map((a,i)=>s(a,i,"row"))}
      </div>`:r`<div class="grid" data-review-grid role="list">${e.items.map((a,i)=>s(a,i,"card"))}</div>`}skeleton(){const e=[0,1,2,3,4,5];return this.view==="table"?r`<div class="tbl" aria-hidden="true">${e.map(()=>r`<span class="skl row"></span>`)}</div>`:r`<div class="grid" aria-hidden="true">${e.map(()=>r`<span class="skl card"></span>`)}</div>`}body(e){const t=w().review,s=Ce({loading:this.busy,forbidden:this.forbidden,error:this.error,list:e,statusUnreviewed:this.filters.status==="unreviewed"}),a=this.selected.size?r`<div class="bulk" data-review-bulk role="status">
          <span>${this.selected.size} ${t.selected}</span>
          <sw-button size="sm" variant="primary" icon="check" data-review-bulk-mark @click=${()=>void this.mark([...this.selected],N(e.items,[...this.selected]))}>${t.markReviewed}</sw-button>
          <sw-button size="sm" variant="ghost" data-review-clear @click=${()=>this.selected=new Set}>${t.clearSelection}</sw-button>
        </div>`:o,i=Oe(this.filters,k);return s==="all-reviewed"?r`${a}<sw-state-panel icon="eye" state="empty" heading=${t.emptyAllReviewed} actionLabel=${t.showReviewed} data-review-state="all-reviewed" @action=${()=>this.setFilter({status:"all"})}></sw-state-panel>`:s==="empty"||s==="offline-empty"?r`<sw-state-panel icon="eye" state=${s==="offline-empty"?"stale":"empty"} heading=${s==="offline-empty"?t.offline:t.empty} actionLabel=${i?t.clearFilters:""} data-review-state=${s} @action=${()=>this.clearFilters()}></sw-state-panel>`:r`${a}
      <div class="list" aria-busy=${String(this.busy)}>${this.items(e)}</div>
      ${e.next_cursor?r`<div class="foot" data-review-foot><sw-button data-review-more ?disabled=${this.moreBusy} @click=${()=>this.more()}>${t.loadMore}</sw-button></div>`:o}`}drawerView(){const e=this.drawer;if(!e)return o;const t=this.mayExport&&this.exportOn.has(e.item.recorder_id),s=w().review,a=this.list?.items.length??0,i=this.drawerIdx();return r`<sw-drawer modal open heading=${e.item.camera_name} subheading=${B[e.item.layer].one} data-review-drawer @close=${()=>this.closeDrawer()}>
      ${a>1&&i>=0?r`<span slot="action" class="dnav" data-review-drawer-nav>
            <button type="button" title=${s.prevItem} aria-label=${s.prevItem} data-review-drawer-prev ?disabled=${i<=0} @click=${()=>this.step("prev")}><sw-icon name="chevronBack" size="16"></sw-icon></button>
            <span class="n" data-review-drawer-pos>${i+1} ${s.of} ${a}</span>
            <button type="button" title=${s.nextItem} aria-label=${s.nextItem} data-review-drawer-next ?disabled=${i>=a-1} @click=${()=>this.step("next")}><sw-icon name="chevron" size="16"></sw-icon></button>
          </span>`:o}
      ${e.loading||!e.detail?r`<sw-state-panel state="loading" compact></sw-state-panel>`:r`<frigate-review-detail .detail=${e.detail} .tz=${this.tz} .canReview=${this.canReview} .canEvents=${!this.demo&&T("analytics.events")} .canExport=${t}
            @review-play=${()=>this.play()} @review-toggle=${()=>void this.mark([e.item.id],!e.item.reviewed)} @review-export=${()=>void this.openExport()}></frigate-review-detail>`}
      ${this.exportDialog()}
    </sw-drawer>`}exportDialog(){const e=this.exp;if(!e)return o;const t=w().review,s=w().control,a=new Intl.DateTimeFormat(de(),{timeZone:this.tz,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}),i=!!e.first&&e.first.can_supervise&&!e.first.done.export_create;return r`<sw-dialog open heading=${t.exportTitle} subheading=${e.item.camera_name} data-review-export-dialog @close=${()=>this.exp=null}>
      <div class="form">
        <label>${t.exportName}<input type="text" maxlength="80" data-review-export-name .value=${e.name} ?disabled=${e.busy} @input=${n=>this.exp={...e,name:n.target.value}} /></label>
        <label>${t.exportRange}<span class="range" data-review-export-range>${a.format(new Date(e.start*1e3))} → ${a.format(new Date(e.end*1e3))} · ${S(new Date(e.start*1e3).toISOString(),new Date(e.end*1e3).toISOString())}</span></label>
        ${i?r`<label class="sup"><input type="checkbox" data-review-export-supervised .checked=${e.supervised} @change=${n=>this.exp={...e,supervised:n.target.checked}} /><span><b>${s.settings.supervised.label}</b> · ${s.settings.supervised.hint}</span></label>`:o}
        ${e.error?r`<div class="err" role="alert" data-review-export-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.exp=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="download" data-review-export-ok ?disabled=${e.busy||!e.name.trim()||i&&!e.supervised} @click=${()=>void this.submitExport()}>${t.exportClip}</sw-button>
    </sw-dialog>`}keysDialog(){if(!this.keysOpen)return o;const e=w().review,t=e.keyRows;return r`<sw-dialog open heading=${e.keysTitle} data-review-keys-dialog @close=${()=>this.keysOpen=!1}>
      <dl class="keys">
        <dt><kbd>↑</kbd><kbd>↓</kbd><kbd>J</kbd><kbd>K</kbd></dt><dd>${t.move}</dd>
        <dt><kbd>Home</kbd><kbd>End</kbd></dt><dd>${t.ends}</dd>
        <dt><kbd>Space</kbd><kbd>X</kbd></dt><dd>${t.select}</dd>
        <dt><kbd>R</kbd></dt><dd>${t.reviewed}</dd>
        <dt><kbd>Enter</kbd></dt><dd>${t.open}</dd>
        <dt><kbd>J</kbd><kbd>K</kbd></dt><dd>${t.drawer}</dd>
        <dt><kbd>Ctrl</kbd>+<kbd>A</kbd></dt><dd>${t.all}</dd>
        <dt><kbd>Esc</kbd></dt><dd>${t.esc}</dd>
      </dl>
    </sw-dialog>`}render(){const e=w().review;if(this.forbidden)return r`<sw-page heading=${e.title}><sw-state-panel state="forbidden" heading=${e.forbidden} hint=${e.forbiddenHint} data-review-state="forbidden"></sw-state-panel></sw-page>`;if(this.list&&!this.list.available)return r`<investigate-events .initialMode=${"windows"} .cameraId=${this.cameraId} .date=${this.date}></investigate-events>`;if(!this.list)return r`<sw-page heading=${e.title}>${this.error?r`<sw-state-panel state="error" heading=${e.error} hint=${this.error} actionLabel=${e.retry} data-review-state="error" @action=${()=>this.load()}></sw-state-panel>`:r`<div role="status" aria-label=${e.loading} data-review-state="loading">${this.skeleton()}</div>`}</sw-page>`;const t=this.list;return r`<sw-page heading=${e.title} subheading=${this.demo?e.demo:""} data-review-screen>
      ${this.toolbar(t)}
      ${this.notes(t)}
      ${this.body(t)}
      ${this.drawerView()}
      ${this.keysDialog()}
    </sw-page>`}};p.styles=[E`
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .toolbar .grow {
      flex: 1 1 auto;
    }
    .layers {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      max-inline-size: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .layers button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 34px;
      padding-inline: var(--sw-s-3);
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      white-space: nowrap;
    }
    /* R5-INVESTIGATE-297: the chosen layer is a raised key (shadow 1 + light line, heading ink, 700), its count a display numeral;
       the keys sink on pointer-down */
    .layers button {
      font-size: var(--sw-fs-base);
      min-block-size: 36px;
      transition: transform var(--sw-t-press) var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease);
    }
    .layers button:active {
      transform: scale(var(--sw-press-scale));
    }
    .layers button[aria-selected='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-heading));
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight));
    }
    .layers button:focus-visible,
    .seg button:focus-visible,
    .ib:focus-visible,
    .linkbtn:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .layers .n {
      font-variant-numeric: tabular-nums;
      font-size: var(--sw-fs-md);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sw-text-2);
      padding: 0 7px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
    }
    .layers button[aria-selected='true'] .n {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .layers .new {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-danger);
    }
    .layers [data-layer='detection'] .new {
      background: var(--sw-stale);
    }
    .layers [data-layer='motion'] .new {
      background: var(--sw-recorded);
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
      min-inline-size: 0;
    }
    /* the list dims while a new filter is on its way; the old items stay put so nothing jumps */
    .list {
      display: grid;
      gap: var(--sw-s-3);
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .list[aria-busy='true'] {
      opacity: 0.55;
      pointer-events: none;
    }
    /* the first load: the shape of the cards, not a spinner */
    .skl {
      display: block;
      border-radius: var(--sw-r-md);
      background: linear-gradient(90deg, var(--sw-surface-3) 0%, var(--sw-surface-2) 50%, var(--sw-surface-3) 100%);
      background-size: 200% 100%;
      animation: rv-sh 1.6s linear infinite;
    }
    .skl.card {
      aspect-ratio: 16 / 11;
    }
    .skl.row {
      block-size: 56px;
      border-radius: 0;
    }
    .skl.row + .skl.row {
      border-block-start: 1px solid var(--sw-border);
    }
    @keyframes rv-sh {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skl {
        animation: none;
      }
    }
    /* POLISH4-WP2: the drawer's small controls answer on pointer-down (a pressed wash - a colour change, so it also holds under reduced
       motion); the touch tap flash is off */
    .dnav button,
    .seg button,
    .ib,
    .linkbtn {
      -webkit-tap-highlight-color: transparent;
    }
    .dnav button:active:not(:disabled),
    .seg button:active:not(:disabled),
    .ib:active:not(:disabled) {
      background: var(--sw-pressed-wash);
    }
    .linkbtn:active {
      opacity: 0.7;
    }
    /* the drawer's item navigation: previous / next and "2 מתוך 4", beside the heading */
    .dnav {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
    }
    .dnav button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 36px;
      block-size: 36px;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .dnav button:hover:not(:disabled) {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
    }
    .dnav button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .dnav button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
    .dnav .n {
      padding-inline: 4px;
      white-space: nowrap;
    }
    /* the view switch and the help: a quiet segmented pair and one icon button */
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-inline-size: 36px;
      min-block-size: 34px;
      padding-inline: var(--sw-s-2);
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    .ib {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 36px;
      block-size: 36px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    /* R5-INVESTIGATE-297 loop 2: hover only under a fine pointer (a tap must not leave a stuck hover) */
    @media (hover: hover) and (pointer: fine) {
      .ib:hover {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
    }
    /* state chips: short, inline, never a paragraph */
    .notes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    .note {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px var(--sw-s-3) 3px var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
    }
    .note.info {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .note.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .bulk {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 268px), 1fr));
      gap: var(--sw-s-3);
    }
    /* the table view: one card, a header row, the items as rows */
    .tbl {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      overflow: hidden;
      --rv-cols: ${G};
    }
    .tbl .h {
      display: grid;
      grid-template-columns: var(--rv-cols);
      gap: var(--sw-s-2);
      align-items: center;
      padding: var(--sw-s-2) var(--sw-s-1);
      background: var(--sw-surface-2);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .tbl .h span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-inline-size: 0;
    }
    .tbl .h .end {
      text-align: end;
    }
    @media (max-width: 899px) {
      .tbl .h {
        display: none;
      }
    }
    .foot {
      display: flex;
      justify-content: center;
    }
    .linkbtn {
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
      padding: 0;
    }
    /* the keys dialog: a two-column list */
    .keys {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: var(--sw-s-2) var(--sw-s-4);
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .keys dt {
      display: flex;
      gap: 4px;
    }
    .keys dd {
      margin: 0;
      color: var(--sw-text-2);
    }
    kbd {
      display: inline-block;
      min-inline-size: 1.6em;
      padding: 0 6px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface-2);
      font: inherit;
      font-size: var(--sw-fs-xs);
      text-align: center;
      direction: ltr;
    }
    /* the export form */
    .form {
      display: grid;
      gap: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    .form label {
      display: grid;
      gap: 4px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .form input[type='text'] {
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-2) var(--sw-s-3);
      min-block-size: 36px;
      box-sizing: border-box;
      inline-size: 100%;
    }
    .form .range {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      color: var(--sw-text);
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .form .sup {
      display: flex;
      align-items: flex-start;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
      font-size: var(--sw-fs-xs);
    }
    .form .sup input {
      margin: 2px 0 0;
      accent-color: var(--sw-accent);
    }
    .form .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    @media (max-width: 767px) {
      .layers button {
        padding-inline: var(--sw-s-2);
      }
      .toolbar .txt {
        display: none;
      }
      /* the phone: one strip of filters that scrolls sideways instead of stacking three rows */
      .filters {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
        padding-block: 2px;
        margin-inline: calc(-1 * var(--sw-s-2));
        padding-inline: var(--sw-s-2);
        scroll-snap-type: inline proximity;
      }
      .filters::-webkit-scrollbar {
        display: none;
      }
      .filters > * {
        flex: none;
        scroll-snap-align: start;
      }
    }
  `,le,fe];v([u()],p.prototype,"cameraId",2);v([u()],p.prototype,"date",2);v([c()],p.prototype,"filters",2);v([c()],p.prototype,"list",2);v([c()],p.prototype,"error",2);v([c()],p.prototype,"forbidden",2);v([c()],p.prototype,"busy",2);v([c()],p.prototype,"moreBusy",2);v([c()],p.prototype,"cams",2);v([c()],p.prototype,"tz",2);v([c()],p.prototype,"selected",2);v([c()],p.prototype,"focusIdx",2);v([c()],p.prototype,"drawer",2);v([c()],p.prototype,"notice",2);v([c()],p.prototype,"toast",2);v([c()],p.prototype,"view",2);v([c()],p.prototype,"keysOpen",2);v([c()],p.prototype,"exportOn",2);v([c()],p.prototype,"exp",2);p=v([O("investigate-reviews")],p);export{p as InvestigateReviews};
//# sourceMappingURL=investigate-reviews-DhqEmxhP.js.map
