import{i as f,aK as $,ed as y,a1 as u,ey as x,p as k,m as z,eI as S,eJ as I,A as h,eK as P,b as r,ez as O,W as D,ea as g,aH as T,eL as C,eA as m,eB as _,eM as j,g as M,j as d,k as E}from"./index-eHtAZ44A.js";import{s as b,c as L}from"./recorders-jTjv_CDa.js";import"./sw-chip-DJDZYRIP.js";import{m as A}from"./sw-timeline-mobZejBk.js";import{b as N}from"./bubble-chrome-DOL7l61i.js";import{I as R}from"./investigate-r5-css-xDEriYTr.js";import{t as s}from"./investigate-Bftwnkmw.js";import"./sw-logo-art-PLtEZJxU.js";var H=Object.defineProperty,W=Object.getOwnPropertyDescriptor,l=(i,e,t,n)=>{for(var a=n>1?void 0:n?W(e,t):e,c=i.length-1,p;c>=0;c--)(p=i[c])&&(a=(n?p(e,t,a):p(a))||a);return n&&a&&H(e,t,a),a};const v="sw.sync.recent";function w(i){const e=t=>String(t).padStart(2,"0");return`${i.getFullYear()}-${e(i.getMonth()+1)}-${e(i.getDate())}T${e(i.getHours())}:${e(i.getMinutes())}:${e(i.getSeconds())}`}let o=class extends f{constructor(){super(...arguments),this.bubbleSkin=new $(this),this.tabsMode=new y(this,"security"),this.cursor=615,this.playing=!1,this.cams=null,this.crossSync=!1,this.picked=[],this.when=w(new Date(Date.now()-10*6e4)),this.recent=[],this.error=""}connectedCallback(){if(super.connectedCallback(),!!u()){try{this.recent=JSON.parse(localStorage.getItem(v)??"[]")}catch{this.recent=[]}this.load()}}async load(){try{const[i,e]=await Promise.all([x(),k().catch(()=>null)]);this.cams=i.cameras.filter(t=>t.enabled&&t.can_view_live!==!1),this.crossSync=String(e?.["playback.cross_recorder_sync"]??"false")==="true",this.error=""}catch(i){this.error=z(i),this.cams=[]}}applyPicked(i){const e=this.cams??[],t=[];for(const n of S(i.join(","),"",e.map(a=>a.id),4))!this.picked.includes(n)&&!b(t,e,n,this.crossSync)||t.push(n);this.picked=t}syncItems(){const i=this.cams??[];return i.map(e=>{const t=!this.picked.includes(e.id)&&!b(this.picked,i,e.id,this.crossSync);return{id:e.id,label:L(e),icon:"camera",alert:e.status!=="online",disabled:t,note:t?s("מקליט אחר"):void 0}})}renderChips(){const i=this.picked.length>=4,e=this.cams??[];return r`<span class="lbl">${s("מצלמות (עד 4):")}</span>${this.syncItems().map(t=>{const n=this.picked.includes(t.id),a=t.note??(!n&&i?I(4):""),c=e.find(p=>p.id===t.id);return r`<sw-chip data-sync-camera=${t.id} ?selected=${n} ?disabled=${!n&&(t.disabled||i)} dot=${c?.status==="online"?"var(--sw-success)":"var(--sw-danger)"} title=${a||h} @click=${()=>this.applyPicked(P(this.picked,t.id,4).ids)}>${t.label}</sw-chip>`})}`}renderSlots(){const i=this.cams??[];return r`<div class="slots" data-sync-slots>${[0,1,2,3].map(e=>{const t=this.picked[e];if(!t)return r`<div class="slot empty" data-sync-slot=${e+1} aria-hidden="true"><span class="num">${e+1}</span>${e===0?r`<span class="role">${s("מובילה")}</span>`:h}</div>`;const n=i.find(a=>a.id===t);return r`<div class="slot" data-sync-pick=${t}>
        <div class="media">
          <img src=${O(t)} alt="" loading="lazy" @error=${a=>a.target.style.visibility="hidden"} />
          ${e===0?r`<sw-badge class="lead" kind="live" label=${s("מובילה")}></sw-badge>`:r`<span class="num">${e+1}</span>`}
          <button type="button" class="rm" aria-label=${s("הסר {name}",{name:this.name(t)})} title=${s("הסר")} @click=${()=>this.applyPicked(this.picked.filter(a=>a!==t))}><span class="x" aria-hidden="true">×</span></button>
        </div>
        <div class="cap"><span class="name">${this.name(t)}</span>${n&&n.status!=="online"?r`<sw-badge kind="offline" label=${s("לא מקוון")}></sw-badge>`:h}</div>
      </div>`})}</div>`}launch(i=this.picked,e){if(i.length<2)return;const t=e??new Date(this.when).toISOString(),n={cameras:i,at:t,opened:new Date().toISOString()},a=this.recent.filter(c=>c.cameras.join(",")!==i.join(","));this.recent=[n,...a].slice(0,6);try{localStorage.setItem(v,JSON.stringify(this.recent))}catch{}D("/investigate/playback",{camera:i[0],extra:i.slice(1).join(","),t})}name(i){return this.cams?.find(e=>e.id===i)?.name??i}renderApi(){const i=this.cams;return r`
      <sw-page heading=${s("ניגון מסונכרן")} subheading=${s("2–4 מצלמות, זמן אחד")} wide>
        ${this.error?r`<sw-state-panel state="error" heading=${s("המצלמות לא נטענו")} hint=${this.error}></sw-state-panel>`:h}
        ${i===null?r`<sw-state-panel state="loading" heading=${s("טוען מצלמות…")}></sw-state-panel>`:r`
            <sw-card heading=${s("מצלמות להשוואה")}>
              <div class="filters" data-sync-cameras data-picker=${this.tabsMode.ddPicker}>
                ${this.tabsMode.ddPicker==="chips"?this.renderChips():r`<sw-dropdown multiple camera-picker data-sync-pick-cameras label=${s("מצלמות")} icon="camera" placeholder=${s("בחר מצלמות (עד 4)")} max="4" dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel}
                      .items=${this.syncItems()} .values=${this.picked} @change=${e=>this.applyPicked(e.detail.ids??[])}></sw-dropdown>`}
              </div>
              ${this.renderSlots()}
            </sw-card>
            <sw-card heading=${s("זמן התחלה")}>
              <div class="transport">
                <sw-field><input type="datetime-local" lang=${g()} step="1" data-ltr data-sync-when .value=${this.when} aria-label=${s("זמן")} title=${s("זמן מקומי של הדפדפן; ההקלטה נפתחת מהפריים הקרוב ביותר")} @change=${e=>this.when=e.target.value} /></sw-field>
                <sw-button size="sm" @click=${()=>this.when=w(new Date(Date.now()-10*6e4))}>${s("לפני 10 דק׳")}</sw-button>
                <sw-button size="sm" @click=${()=>this.when=w(new Date(Date.now()-60*6e4))}>${s("לפני שעה")}</sw-button>
                <span class="grow"></span>
                <sw-button variant="primary" icon="play" data-sync-launch ?disabled=${this.picked.length<2} title=${this.picked.length<2?s("נדרשות לפחות 2 מצלמות"):s('מהירויות שונות מ־1× כבויות; מקור בלי הקלטה בזמן הזה מוצג כ"אין הקלטה"')} @click=${()=>this.launch()}>${s("פתח השוואה ({n})",{n:this.picked.length})}</sw-button>
              </div>
            </sw-card>
            ${this.recent.length?r`<sw-card heading=${s("השוואות אחרונות")} subheading=${s("נשמר בדפדפן הזה בלבד")}>
                  ${this.recent.map(e=>r`<div class="recent" data-sync-recent>
                    <span>${e.cameras.map(t=>this.name(t)).join(" · ")}</span>
                    <span class="ltr note">${T(new Date(e.at),{seconds:!0})}</span>
                    <sw-button size="sm" icon="play" @click=${()=>this.launch(e.cameras,e.at)}>${s("פתח")}</sw-button>
                  </div>`)}
                </sw-card>`:h}
          `}
      </sw-page>
    `}render(){if(u())return this.renderApi();const i=[{cam:m[0],drift:"+0.2s",state:"recorded"},{cam:m[9],drift:"-0.4s",state:"recorded"},{cam:m[3],drift:"gap",state:"unknown"},{cam:m[1],drift:"buffering",state:"stale"}];return r`
      <sw-page heading=${s("מרכז שליטה")} subheading=${s("ניטור חי עם ניגון מסונכרן · 4 מקורות · שעון ייחוס אחד · נתוני הדגמה")} wide>
        <sw-field slot="actions"><select aria-label=${s("תצוגה")}><option>${s("כל המסכים")}</option><option>${s("כניסה + חצר")}</option></select></sw-field>
        <sw-button slot="actions" variant="primary" icon="case">${s("שמור כתיק")}</sw-button>
        <div class="grid">
          ${i.map(e=>r`<div class="tile">
              <span class="drift"><bdi>${e.drift}</bdi></span>
              <sw-camera-tile name=${e.cam.name} state=${e.state} scene=${_[e.cam.id]??"lobby"}></sw-camera-tile>
            </div>`)}
        </div>
        <div class="transport">
          <sw-field><input type="datetime-local" lang=${g()} value=${`2026-09-14T${A(this.cursor)}`} data-ltr aria-label=${s("זמן")} @change=${e=>{const t=e.target.value.split("T")[1]??"10:15",[n,a]=t.split(":").map(Number);this.cursor=n*60+a}} /></sw-field>
          <sw-button iconOnly icon="mic" label=${s("דיבור")}></sw-button>
          <sw-button iconOnly icon="back10" label=${s("אחורה")}></sw-button>
          <sw-button variant="primary" iconOnly icon=${this.playing?"pause":"play"} label=${this.playing?s("השהה הכל"):s("נגן הכל")} @click=${()=>this.playing=!this.playing}></sw-button>
          <sw-button iconOnly icon="forward10" label=${s("קדימה")}></sw-button>
          <sw-chip selected>1×</sw-chip><sw-chip>2×</sw-chip>
          <span class="grow"></span>
          <sw-badge kind="stale" label=${s("Best effort: אין מיפוי PTS→UTC מאומת")}></sw-badge>
          <a href="#/live/wall"><sw-button variant="primary" size="sm" icon="live">Live</sw-button></a>
        </div>
        <sw-timeline .segments=${C} .events=${j.slice(0,4).map(e=>({minute:e.minuteOfDay,kind:e.type,label:e.title}))} .cursor=${this.cursor} precision="estimated" @seek=${e=>this.cursor=e.detail.minute}></sw-timeline>
        <div class="filters">
          <sw-chip selected icon="check">${s("כל המצלמות")}</sw-chip>
          <sw-chip dot="var(--sw-tl-motion)">${s("תנועה")}</sw-chip><sw-chip dot="var(--sw-tl-person)">${s("אדם")}</sw-chip><sw-chip dot="var(--sw-tl-vehicle)">${s("רכב")}</sw-chip><sw-chip dot="var(--sw-tl-door)">${s("אחר")}</sw-chip>
        </div>
        <div class="note">${s("מקור שאינו מוכן מוצג במפורש (buffering / gap) ואינו מוצג כמסונכרן. יעד הנדסי: סטייה עד שנייה ב־95% מהדגימות, לאחר בדיקה עם אירוע חזותי משותף.")}</div>
      </sw-page>
    `}};o.styles=[M`
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
  `,N,R];l([d()],o.prototype,"cursor",2);l([d()],o.prototype,"playing",2);l([d()],o.prototype,"cams",2);l([d()],o.prototype,"crossSync",2);l([d()],o.prototype,"picked",2);l([d()],o.prototype,"when",2);l([d()],o.prototype,"recent",2);l([d()],o.prototype,"error",2);o=l([E("investigate-sync")],o);export{o as InvestigateSync};
