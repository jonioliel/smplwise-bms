import{a as g,aX as u,af as m,eG as f,q as w,s as b,A as l,b as t,eH as v,eI as $,eJ as x,j as k,k as n,m as y}from"./index-DlIoBDHe.js";import"./sw-chip-Dpxi4O65.js";import{l as z,u as E,c as _,d as D,w as S,k as M}from"./views-D_gszvLM.js";import{b as P}from"./bubble-chrome-BBeQfjBL.js";import{t as s}from"./live-Cd-Y24DD.js";import"./sw-logo-art-PLtEZJxU.js";var A=Object.defineProperty,V=Object.getOwnPropertyDescriptor,o=(e,a,i,c)=>{for(var d=c>1?void 0:c?V(a,i):a,h=e.length-1,p;h>=0;h--)(p=e[h])&&(d=(c?p(a,i,d):p(d))||d);return c&&d&&A(a,i,d),d};const C={name:"",cameras:[],cols:2,rows:2,shared:!1,kiosk:!1},L=[{name:s("כל המצלמות"),layout:9,scope:s("משותפת"),mobile:s("4 · משני"),owner:s("יוני"),kiosk:!0},{name:s("חוץ"),layout:4,scope:s("משותפת"),mobile:s("2 · משני"),owner:s("יוני"),kiosk:!1},{name:s("פנים"),layout:6,scope:s("משותפת"),mobile:s("ללא"),owner:s("יוסי"),kiosk:!1},{name:s("לילה"),layout:4,scope:s("אישית"),mobile:s("4 · משני"),owner:s("דנה"),kiosk:!1}];let r=class extends g{constructor(){super(...arguments),this.bubbleSkin=new u(this),this.views=null,this.cams=[],this.canShare=!1,this.canManageAll=!1,this.editing=null,this.confirmDelete=null,this.busy=!1,this.error="",this.formError=""}connectedCallback(){super.connectedCallback(),m()&&this.load()}async load(){try{const[e,a]=await Promise.all([z(),f()]);this.views=e.views,this.canShare=e.can_share,this.canManageAll=e.can_manage_all,this.cams=a.cameras.filter(i=>i.enabled&&i.can_view_live!==!1),this.error=""}catch(e){this.error=w(e),this.views=this.views??[]}}canEdit(e){return this.canManageAll||e.owner_user_id===b.me?.user.id}open(e){this.formError="",this.editing=e?{id:e.id,name:e.name,cameras:[...e.cameras],cols:e.cols,rows:e.rows,shared:e.shared,kiosk:e.kiosk}:{...C,cameras:[]}}toggleCamera(e){if(!this.editing)return;const a=this.editing.cameras.includes(e);!a&&this.editing.cameras.length>=16||(this.editing={...this.editing,cameras:a?this.editing.cameras.filter(i=>i!==e):[...this.editing.cameras,e]})}async save(){const e=this.editing;if(e){if(!e.name.trim()){this.formError=s("לתצוגה צריך שם.");return}if(!e.cameras.length){this.formError=s("בחר לפחות מצלמה אחת.");return}this.busy=!0;try{const a={name:e.name.trim(),cameras:e.cameras,cols:e.cols,rows:e.rows,shared:e.shared,kiosk:e.kiosk};e.id?await E(e.id,a):await _(a),this.editing=null,await this.load()}catch(a){this.formError=w(a)}finally{this.busy=!1}}}async removeView(){const e=this.confirmDelete;if(e){this.busy=!0;try{await D(e.id),this.confirmDelete=null,await this.load()}catch(a){this.error=w(a)}finally{this.busy=!1}}}renderEditor(){const e=this.editing;return t`<sw-dialog open heading=${e.id?s("עריכת תצוגה"):s("תצוגה חדשה")} subheading=${s("שם, מצלמות ופריסה · תצוגה משותפת נראית לכל המשתמשים")} data-view-dialog @close=${()=>this.editing=null}>
      <div class="form">
        <sw-field label=${s("שם")}><input data-view-name .value=${e.name} maxlength="60" @input=${a=>this.editing={...e,name:a.target.value}} /></sw-field>
        <div class="lbl">${s("מצלמות ({n} מתוך {total})",{n:e.cameras.length,total:this.cams.length})}</div>
        <div class="chips" data-view-cameras>
          ${this.cams.map(a=>t`<sw-chip ?selected=${e.cameras.includes(a.id)} data-view-camera=${a.id} dot=${a.status==="online"?"var(--sw-live)":"var(--sw-danger)"} @click=${()=>this.toggleCamera(a.id)}>${a.name}</sw-chip>`)}
        </div>
        <div class="two">
          <sw-field label=${s("עמודות")}><select data-view-cols .value=${String(e.cols)} @change=${a=>this.editing={...e,cols:Number(a.target.value)}}>${[1,2,3,4].map(a=>t`<option value=${a} ?selected=${a===e.cols}>${a}</option>`)}</select></sw-field>
          <sw-field label=${s("שורות")}><select data-view-rows .value=${String(e.rows)} @change=${a=>this.editing={...e,rows:Number(a.target.value)}}>${[1,2,3,4].map(a=>t`<option value=${a} ?selected=${a===e.rows}>${a}</option>`)}</select></sw-field>
        </div>
        <div class="toggles">
          <sw-toggle ?checked=${e.shared} ?disabled=${!this.canShare} label=${this.canShare?s("משותפת לכל המשתמשים"):s("משותפת (דורש הרשאת ניהול משתמשים)")} data-view-shared @change=${a=>this.editing={...e,shared:a.detail.checked}}></sw-toggle>
          <sw-toggle ?checked=${e.kiosk} label=${s("מיועדת לקיוסק (מסך קיר)")} data-view-kiosk @change=${a=>this.editing={...e,kiosk:a.detail.checked}}></sw-toggle>
        </div>
        <div class="note">${s("הקיר פותח את המצלמות בפריסה אוטומטית; הקיוסק מציג {cols}×{rows} מצלמות בעמוד ומדפדף בין העמודים.",{cols:e.cols,rows:e.rows})}</div>
        ${this.formError?t`<div class="err" data-view-error>${this.formError}</div>`:l}
      </div>
      <div slot="footer">
        <sw-button variant="ghost" @click=${()=>this.editing=null}>${s("ביטול")}</sw-button>
        <sw-button variant="primary" icon="check" data-view-save ?disabled=${this.busy} @click=${()=>this.save()}>${e.id?s("שמור"):s("צור תצוגה")}</sw-button>
      </div>
    </sw-dialog>`}renderApi(){const e=this.views;return t`
      <sw-page heading=${s("תצוגות שמורות")} subheading=${s("קבוצות מצלמות עם פריסה — אישיות או משותפות — לפתיחה בקיר החי או בקיוסק")}>
        <sw-button slot="actions" variant="primary" icon="plus" data-view-new @click=${()=>this.open()}>${s("תצוגה חדשה")}</sw-button>
        ${this.error?t`<sw-state-panel state="error" heading=${s("התצוגות לא נטענו")} hint=${this.error}></sw-state-panel>`:l}
        ${e===null?t`<sw-state-panel state="loading" heading=${s("טוען תצוגות…")}></sw-state-panel>`:e.length?t`<div class="grid" data-views>
                ${e.map(a=>t`<sw-card data-view=${a.id}>
                    <div class="thumb" style=${`grid-template-columns:repeat(${Math.min(2,Math.max(1,a.cameras.length))}, 1fr)`}>
                      ${a.cameras.slice(0,4).map(i=>t`<img src=${v(i)} alt="" loading="lazy" @error=${c=>c.target.style.visibility="hidden"} />`)}
                      ${a.cameras.length?l:t`<div class="empty">${s("אין מצלמות שמותר לך לראות בתצוגה זו")}</div>`}
                    </div>
                    <div class="head"><b>${a.name}</b><sw-badge kind=${a.shared?"recorded":"neutral"} label=${a.shared?s("משותפת"):s("אישית")}></sw-badge>${a.kiosk?t`<sw-badge kind="neutral" label=${s("קיוסק")}></sw-badge>`:l}</div>
                    <dl>
                      <dt>${s("מצלמות")}</dt><dd>${a.camera_names.join(" · ")||"—"}${a.hidden_cameras?t` <span class="muted">${s("(+{n} ללא הרשאה)",{n:a.hidden_cameras})}</span>`:l}</dd>
                      <dt>${s("פריסה")}</dt><dd class="ltr">${a.cols}×${a.rows}</dd>
                      <dt>${s("בעלים")}</dt><dd>${a.owner_username??"—"}</dd>
                    </dl>
                    <div class="foot">
                      <a href=${S(a)}><sw-button size="sm" variant="primary" icon="play" data-view-open ?disabled=${!a.cameras.length}>${s("פתח")}</sw-button></a>
                      <a href=${M(a)} target="_blank" rel="noopener"><sw-button size="sm" icon="layers" data-view-kiosk-open ?disabled=${!a.cameras.length}>${s("קיוסק")}</sw-button></a>
                      <span class="grow"></span>
                      ${this.canEdit(a)?t`<sw-button size="sm" variant="ghost" icon="edit" data-view-edit @click=${()=>this.open(a)}>${s("עריכה")}</sw-button><sw-button size="sm" variant="ghost" icon="trash" data-view-delete @click=${()=>this.confirmDelete=a}>${s("מחיקה")}</sw-button>`:l}
                    </div>
                  </sw-card>`)}
              </div>`:t`<sw-state-panel icon="grid" state="empty" heading=${s("אין עדיין תצוגות שמורות")} hint=${s("צור תצוגה: שם, מצלמות ופריסה. תצוגה משותפת נראית לכל המשתמשים; קיוסק פותח אותה במסך קיר בלי פקדים.")}></sw-state-panel>`}
        ${this.editing?this.renderEditor():l}
        ${this.confirmDelete?t`<sw-dialog open heading=${s("מחיקת תצוגה")} subheading=${this.confirmDelete.name} @close=${()=>this.confirmDelete=null}>
              <p>${s("התצוגה תוסר מהרשימה. המצלמות וההקלטות אינן מושפעות.")}</p>
              <div slot="footer"><sw-button variant="ghost" @click=${()=>this.confirmDelete=null}>${s("ביטול")}</sw-button><sw-button variant="danger" icon="trash" data-view-delete-confirm ?disabled=${this.busy} @click=${()=>this.removeView()}>${s("מחק")}</sw-button></div>
            </sw-dialog>`:l}
      </sw-page>
    `}render(){return m()?this.renderApi():t`
      <sw-page heading=${s("תצוגות שמורות")} subheading=${s("תבניות 1 / 2 / 4 / 6 / 9 / 12 / 16 / מותאם, אישיות או משותפות, עם התאמה למובייל · נתוני הדגמה")}>
        <sw-button slot="actions" variant="primary" icon="plus">${s("תצוגה חדשה")}</sw-button>
        <div class="grid">
          ${L.map(e=>{const a=Math.ceil(Math.sqrt(e.layout));return t`<sw-card heading=${e.name}>
              <sw-badge slot="actions" kind="neutral" label=${e.scope}></sw-badge>
              <div class="thumb" style="grid-template-columns:repeat(${a},1fr)">${$.filter(i=>i.state==="live").slice(0,e.layout).map(i=>t`<sw-scene kind=${x[i.id]??"lobby"}></sw-scene>`)}</div>
              <dl>
                <dt>${s("פריסה")}</dt><dd>${s("{n} אריחים",{n:e.layout})}</dd>
                <dt>${s("מובייל")}</dt><dd>${e.mobile}</dd>
                <dt>${s("בעלים")}</dt><dd>${e.owner}</dd>
              </dl>
              <div class="foot">
                <a href="#/live/wall"><sw-button size="sm" icon="play">${s("פתח")}</sw-button></a>
                <sw-button size="sm" variant="ghost">${s("עריכה")}</sw-button>
                <sw-toggle ?checked=${e.kiosk} label=${s("קיוסק")}></sw-toggle>
              </div>
            </sw-card>`})}
        </div>
      </sw-page>
    `}};r.styles=[k`
    .thumb img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-video-bg);
      display: block;
    }
    .thumb .empty {
      grid-column: 1 / -1;
      color: var(--sw-on-video-2);
      font-size: var(--sw-fs-xs);
      display: grid;
      place-items: center;
      text-align: center;
      padding: 8px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-block-end: 6px;
    }
    .head b {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .grow {
      flex: 1;
    }
    .muted {
      color: var(--sw-text-3);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: min(560px, 80vw);
    }
    .form .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .toggles {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
    }
    .thumb {
      display: grid;
      gap: 3px;
      background: var(--sw-video-bg);
      border-radius: var(--sw-r-sm);
      padding: 4px;
      aspect-ratio: 16 / 9;
      margin-block-end: 10px;
      overflow: hidden;
    }
    .thumb sw-scene {
      border-radius: var(--sw-r-2xs);
      inline-size: 100%;
      block-size: 100%;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 10px;
      margin: 0;
      font-size: var(--sw-fs-xs);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    .foot {
      display: flex;
      gap: 6px;
      margin-block-start: 10px;
      align-items: center;
    }
    /* R5-LIVE-297 (the HOMEFABLE tiers on the saved views): the card is the second tier, the 2x2 preview its framed picture (the
       video ink, the media radius, the first shadow), the facts a WELL under it - a two-column grid of label over a bold value
       (a 20 px / 800 tile count), not a list of grey 11 px pairs; the view's name 17 px / 800 */
    .grid {
      gap: 16px;
    }
    .thumb {
      gap: 4px;
      padding: 5px;
      border-radius: var(--sw-r-media);
      margin-block-end: 12px;
      box-shadow: var(--sw-shadow-1);
    }
    .thumb sw-scene,
    .thumb img {
      border-radius: var(--sw-r-2xs);
    }
    .head {
      gap: 8px;
      margin-block-end: 10px;
    }
    .head b {
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sw-heading);
    }
    dl {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-auto-flow: column;
      grid-template-rows: auto auto;
      gap: 2px 10px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    dt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    dd {
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .foot {
      margin-block-start: 12px;
      gap: 8px;
    }
    /* POLISH4-WP2 (D9): the open / kiosk links and the camera chips answer the press on pointer-down (the card itself is not a
       target); the scale reads the skin's press token and stays still under reduced motion */
    .foot a {
      display: inline-flex;
      border-radius: var(--sw-r-sm);
      -webkit-tap-highlight-color: transparent;
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    .foot a:active,
    .chips sw-chip:active {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    .chips sw-chip {
      -webkit-tap-highlight-color: transparent;
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    @media (prefers-reduced-motion: reduce) {
      .foot a,
      .chips sw-chip {
        transition: none;
      }
      .foot a:active,
      .chips sw-chip:active {
        transform: none;
      }
    }
    /* POLISH4-WP2 (D9): the phone. The columns / rows form stacks (two selects of 1fr at 390 cut the labels), the dialog form takes the
       sheet's width, and the card's action row wraps instead of pushing "מחיקה" past the card edge */
    @media (max-width: 767px) {
      .two {
        grid-template-columns: 1fr;
      }
      .form {
        min-inline-size: 0;
      }
      .grid {
        grid-template-columns: minmax(0, 1fr);
        gap: 12px;
      }
      .foot {
        flex-wrap: wrap;
        row-gap: 6px;
      }
      dl {
        padding: 8px 10px;
      }
    }
  `,P];o([n()],r.prototype,"views",2);o([n()],r.prototype,"cams",2);o([n()],r.prototype,"canShare",2);o([n()],r.prototype,"canManageAll",2);o([n()],r.prototype,"editing",2);o([n()],r.prototype,"confirmDelete",2);o([n()],r.prototype,"busy",2);o([n()],r.prototype,"error",2);o([n()],r.prototype,"formError",2);r=o([y("live-views")],r);export{r as LiveViews};
