import{a as v,S as f,du as y,i as w,qp as x,K as k,T as $,sG as z,sJ as S,A as p,sK as P,e as n,eM as I,ak as O,bP as u,b6 as T,sM as D,qw as h,eL as C,qx as M,C as _,E as j,G as l,H as E}from"./index-BtUVZilq.js";import{s as g,c as L}from"./recorders-CF3aoOhA.js";import"./sw-chip-BSFr0_AW.js";import{m as N}from"./sw-timeline-Dudt9W6t.js";import{I as A}from"./investigate-r5-css-DhUwoNL-.js";import"./sw-logo-art-Va6y_cIM.js";var R=Object.defineProperty,G=Object.getOwnPropertyDescriptor,o=(t,e,s,a)=>{for(var i=a>1?void 0:a?G(e,s):e,d=t.length-1,c;d>=0;d--)(c=t[d])&&(i=(a?c(e,s,i):c(i))||i);return a&&i&&R(e,s,i),i};const b="sw.sync.recent";function m(t){const e=s=>String(s).padStart(2,"0");return`${t.getFullYear()}-${e(t.getMonth()+1)}-${e(t.getDate())}T${e(t.getHours())}:${e(t.getMinutes())}:${e(t.getSeconds())}`}let r=class extends v{constructor(){super(...arguments),this.bubbleSkin=new f(this),this.tabsMode=new y(this,"security"),this.cursor=615,this.playing=!1,this.cams=null,this.crossSync=!1,this.picked=[],this.when=m(new Date(Date.now()-10*6e4)),this.recent=[],this.error=""}connectedCallback(){if(super.connectedCallback(),!!w()){try{this.recent=JSON.parse(localStorage.getItem(b)??"[]")}catch{this.recent=[]}this.load()}}async load(){try{const[t,e]=await Promise.all([x(),k().catch(()=>null)]);this.cams=t.cameras.filter(s=>s.enabled&&s.can_view_live!==!1),this.crossSync=String(e?.["playback.cross_recorder_sync"]??"false")==="true",this.error=""}catch(t){this.error=$(t),this.cams=[]}}applyPicked(t){const e=this.cams??[],s=[];for(const a of z(t.join(","),"",e.map(i=>i.id),4))!this.picked.includes(a)&&!g(s,e,a,this.crossSync)||s.push(a);this.picked=s}syncItems(){const t=this.cams??[];return t.map(e=>{const s=!this.picked.includes(e.id)&&!g(this.picked,t,e.id,this.crossSync);return{id:e.id,label:L(e),icon:"camera",alert:e.status!=="online",disabled:s,note:s?"מקליט אחר":void 0}})}renderChips(){const t=this.picked.length>=4,e=this.cams??[];return n`<span class="lbl">מצלמות (עד 4):</span>${this.syncItems().map(s=>{const a=this.picked.includes(s.id),i=s.note??(!a&&t?S(4):""),d=e.find(c=>c.id===s.id);return n`<sw-chip data-sync-camera=${s.id} ?selected=${a} ?disabled=${!a&&(s.disabled||t)} dot=${d?.status==="online"?"var(--sw-success)":"var(--sw-danger)"} title=${i||p} @click=${()=>this.applyPicked(P(this.picked,s.id,4).ids)}>${s.label}</sw-chip>`})}`}renderSlots(){const t=this.cams??[];return n`<div class="slots" data-sync-slots>${[0,1,2,3].map(e=>{const s=this.picked[e];if(!s)return n`<div class="slot empty" data-sync-slot=${e+1} aria-hidden="true"><span class="num">${e+1}</span>${e===0?n`<span class="role">מובילה</span>`:p}</div>`;const a=t.find(i=>i.id===s);return n`<div class="slot" data-sync-pick=${s}>
        <div class="media">
          <img src=${I(s)} alt="" loading="lazy" @error=${i=>i.target.style.visibility="hidden"} />
          ${e===0?n`<sw-badge class="lead" kind="live" label="מובילה"></sw-badge>`:n`<span class="num">${e+1}</span>`}
          <button type="button" class="rm" aria-label=${`הסר ${this.name(s)}`} title="הסר" @click=${()=>this.applyPicked(this.picked.filter(i=>i!==s))}><span class="x" aria-hidden="true">×</span></button>
        </div>
        <div class="cap"><span class="name">${this.name(s)}</span>${a&&a.status!=="online"?n`<sw-badge kind="offline" label="לא מקוון"></sw-badge>`:p}</div>
      </div>`})}</div>`}launch(t=this.picked,e){if(t.length<2)return;const s=e??new Date(this.when).toISOString(),a={cameras:t,at:s,opened:new Date().toISOString()},i=this.recent.filter(d=>d.cameras.join(",")!==t.join(","));this.recent=[a,...i].slice(0,6);try{localStorage.setItem(b,JSON.stringify(this.recent))}catch{}O("/investigate/playback",{camera:t[0],extra:t.slice(1).join(","),t:s})}name(t){return this.cams?.find(e=>e.id===t)?.name??t}renderApi(){const t=this.cams;return n`
      <sw-page heading="ניגון מסונכרן" subheading="2–4 מצלמות, זמן אחד" wide>
        ${this.error?n`<sw-state-panel state="error" heading="המצלמות לא נטענו" hint=${this.error}></sw-state-panel>`:p}
        ${t===null?n`<sw-state-panel state="loading" heading="טוען מצלמות…"></sw-state-panel>`:n`
            <sw-card heading="מצלמות להשוואה">
              <div class="filters" data-sync-cameras data-picker=${this.tabsMode.ddPicker}>
                ${this.tabsMode.ddPicker==="chips"?this.renderChips():n`<sw-dropdown multiple camera-picker data-sync-pick-cameras label="מצלמות" icon="camera" placeholder="בחר מצלמות (עד 4)" max="4" dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel}
                      .items=${this.syncItems()} .values=${this.picked} @change=${e=>this.applyPicked(e.detail.ids??[])}></sw-dropdown>`}
              </div>
              ${this.renderSlots()}
            </sw-card>
            <sw-card heading="זמן התחלה">
              <div class="transport">
                <sw-field><input type="datetime-local" lang=${u()} step="1" data-ltr data-sync-when .value=${this.when} aria-label="זמן" title="זמן מקומי של הדפדפן; ההקלטה נפתחת מהפריים הקרוב ביותר" @change=${e=>this.when=e.target.value} /></sw-field>
                <sw-button size="sm" @click=${()=>this.when=m(new Date(Date.now()-10*6e4))}>לפני 10 דק׳</sw-button>
                <sw-button size="sm" @click=${()=>this.when=m(new Date(Date.now()-60*6e4))}>לפני שעה</sw-button>
                <span class="grow"></span>
                <sw-button variant="primary" icon="play" data-sync-launch ?disabled=${this.picked.length<2} title=${this.picked.length<2?"נדרשות לפחות 2 מצלמות":'מהירויות שונות מ־1× כבויות; מקור בלי הקלטה בזמן הזה מוצג כ"אין הקלטה"'} @click=${()=>this.launch()}>פתח השוואה (${this.picked.length})</sw-button>
              </div>
            </sw-card>
            ${this.recent.length?n`<sw-card heading="השוואות אחרונות" subheading="נשמר בדפדפן הזה בלבד">
                  ${this.recent.map(e=>n`<div class="recent" data-sync-recent>
                    <span>${e.cameras.map(s=>this.name(s)).join(" · ")}</span>
                    <span class="ltr note">${T(new Date(e.at),{seconds:!0})}</span>
                    <sw-button size="sm" icon="play" @click=${()=>this.launch(e.cameras,e.at)}>פתח</sw-button>
                  </div>`)}
                </sw-card>`:p}
          `}
      </sw-page>
    `}render(){if(w())return this.renderApi();const t=[{cam:h[0],drift:"+0.2s",state:"recorded"},{cam:h[9],drift:"-0.4s",state:"recorded"},{cam:h[3],drift:"gap",state:"unknown"},{cam:h[1],drift:"buffering",state:"stale"}];return n`
      <sw-page heading="מרכז שליטה" subheading="ניטור חי עם ניגון מסונכרן · 4 מקורות · שעון ייחוס אחד · נתוני הדגמה" wide>
        <sw-field slot="actions"><select aria-label="תצוגה"><option>כל המסכים</option><option>כניסה + חצר</option></select></sw-field>
        <sw-button slot="actions" variant="primary" icon="case">שמור כתיק</sw-button>
        <div class="grid">
          ${t.map(e=>n`<div class="tile">
              <span class="drift"><bdi>${e.drift}</bdi></span>
              <sw-camera-tile name=${e.cam.name} state=${e.state} scene=${C[e.cam.id]??"lobby"}></sw-camera-tile>
            </div>`)}
        </div>
        <div class="transport">
          <sw-field><input type="datetime-local" lang=${u()} value=${`2026-09-14T${N(this.cursor)}`} data-ltr aria-label="זמן" @change=${e=>{const s=e.target.value.split("T")[1]??"10:15",[a,i]=s.split(":").map(Number);this.cursor=a*60+i}} /></sw-field>
          <sw-button iconOnly icon="mic" label="דיבור"></sw-button>
          <sw-button iconOnly icon="back10" label="אחורה"></sw-button>
          <sw-button variant="primary" iconOnly icon=${this.playing?"pause":"play"} label=${this.playing?"השהה הכל":"נגן הכל"} @click=${()=>this.playing=!this.playing}></sw-button>
          <sw-button iconOnly icon="forward10" label="קדימה"></sw-button>
          <sw-chip selected>1×</sw-chip><sw-chip>2×</sw-chip>
          <span class="grow"></span>
          <sw-badge kind="stale" label="Best effort: אין מיפוי PTS→UTC מאומת"></sw-badge>
          <a href="#/live/wall"><sw-button variant="primary" size="sm" icon="live">Live</sw-button></a>
        </div>
        <sw-timeline .segments=${D} .events=${M.slice(0,4).map(e=>({minute:e.minuteOfDay,kind:e.type,label:e.title}))} .cursor=${this.cursor} precision="estimated" @seek=${e=>this.cursor=e.detail.minute}></sw-timeline>
        <div class="filters">
          <sw-chip selected icon="check">כל המצלמות</sw-chip>
          <sw-chip dot="var(--sw-tl-motion)">תנועה</sw-chip><sw-chip dot="var(--sw-tl-person)">אדם</sw-chip><sw-chip dot="var(--sw-tl-vehicle)">רכב</sw-chip><sw-chip dot="var(--sw-tl-door)">אחר</sw-chip>
        </div>
        <div class="note">מקור שאינו מוכן מוצג במפורש (buffering / gap) ואינו מוצג כמסונכרן. יעד הנדסי: סטייה עד שנייה ב־95% מהדגימות, לאחר בדיקה עם אירוע חזותי משותף.</div>
      </sw-page>
    `}};r.styles=[j`
    /* R5-INVESTIGATE-297: two rows of 16:9 tiles are bounded by the viewport height so the transport, the timeline and the filters
       stay on screen (owner: no scrolling in a control screen); the grid centres when the height, not the width, is the limit */
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      /* an explicit inline-size: with auto margins in the page's flex column, a max-inline-size alone shrink-wraps the grid to its gap */
      inline-size: min(100%, calc((100dvh - 455px) * 16 / 9 + 10px));
      margin-inline: auto;
    }
    .tile {
      position: relative;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-2);
    }
    .transport {
      padding: 8px 12px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
    }
    @media (max-width: 767px) {
      .grid {
        inline-size: 100%;
      }
    }
    /* POLISH4-WP2: the pill keeps the page's direction, so inset-inline-end is the RTL end (it was direction:ltr, which turned its own
       inline-end to the right and laid it over the camera name); the value is isolated with <bdi> and reads left to right */
    .drift {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-end: 8px;
      z-index: 2;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-2xs);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      padding: 1px 7px;
      border-radius: var(--sw-r-pill);
    }
    .transport {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .transport .grow {
      flex: 1;
    }
    .transport sw-field {
      inline-size: 170px;
    }
    .filters {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    /* 2.0.1: the picker is one dropdown (the chips of 2.0.0 took a row per camera on the phone); it never grows past the card */
    .filters sw-dropdown {
      max-inline-size: 100%;
    }
    .filters .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* 2.0.2: the four places of a set are always drawn - a picked camera fills its place, an empty one is a numbered, dashed frame
       (the limit is visible without a sentence); two per row on the phone, four on a wide screen */
    .slots {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-block-start: 12px;
    }
    .slot .media,
    .slot.empty {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
    }
    .slot.empty {
      background: var(--sw-surface-2);
      border: 1.5px dashed var(--sw-border-strong);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: var(--sw-text-3);
    }
    .slot.empty .num {
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-sm);
    }
    .slot.empty .role {
      font-size: var(--sw-fs-xs);
    }
    .slot .media img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .slot .media .num,
    .slot .media .lead {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
    }
    /* the lead tag sits on the picture like the number pill: a dark translucent pill with white text in every skin, light and dark
       (the badge's own on-image look keys on the text token, which is light in dark skins) */
    .slot .media .lead {
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
      box-shadow: none;
      border: 0;
    }
    .slot .media .num {
      min-inline-size: 22px;
      block-size: 22px;
      padding-inline: 6px;
      border-radius: var(--sw-r-pill);
      display: grid;
      place-items: center;
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
    }
    /* the remove button: a 28 px circle drawn inside a hit area of the touch dial (44 px on touch layouts, the desktop dial above) */
    .slot .media .rm {
      position: absolute;
      inset-inline-end: 0;
      inset-block-start: 0;
      inline-size: var(--sw-touch-desktop);
      block-size: var(--sw-touch-desktop);
      min-inline-size: 32px;
      min-block-size: 32px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--sw-on-video);
      font: inherit;
      font-size: var(--sw-fs-lg);
      line-height: 1;
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .slot .media .rm .x {
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      background: var(--sw-video-scrim);
      display: grid;
      place-items: center;
      transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .slot .media .rm {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    /* POLISH4-WP2 (D10): the hover wash only under a fine pointer (it stuck on a tablet after a tap); the press on pointer-down */
    @media (hover: hover) and (pointer: fine) {
      .slot .media .rm:hover .x {
        background: var(--sw-video-scrim-strong);
      }
    }
    .slot .media .rm:active .x {
      background: var(--sw-video-scrim-strong);
      transform: scale(var(--sw-press-scale, 0.94));
    }
    @media (prefers-reduced-motion: reduce) {
      .slot .media .rm .x {
        transition: none;
      }
      .slot .media .rm:active .x {
        transform: none;
      }
    }
    .slot .cap {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      min-block-size: 24px;
      padding: 6px 2px 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .slot .cap .name {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .recent {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .recent + .recent {
      margin-block-start: 6px;
    }
    .recent > span:first-child {
      flex: 1;
      min-inline-size: 0;
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
      .slots {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
    }
    @media (max-width: 1100px) {
      /* a touch layout: the remove button is a 44 px target whatever the desktop dial says */
      .slot .media .rm {
        inline-size: 44px;
        block-size: 44px;
      }
    }
  `,_,A];o([l()],r.prototype,"cursor",2);o([l()],r.prototype,"playing",2);o([l()],r.prototype,"cams",2);o([l()],r.prototype,"crossSync",2);o([l()],r.prototype,"picked",2);o([l()],r.prototype,"when",2);o([l()],r.prototype,"recent",2);o([l()],r.prototype,"error",2);r=o([E("investigate-sync")],r);export{r as InvestigateSync};
//# sourceMappingURL=investigate-sync-R6iTz32S.js.map
