import{a as m,S as g,i as w,f8 as u,Y as p,R as f,A as n,e as a,aB as b,r3 as v,fm as $,C as x,E as k,G as o,H as y}from"./index-k1cto_iv.js";import"./sw-chip-BLX6ZcOY.js";import{l as z,u as E,c as _,d as S,w as D,k as M}from"./views-DmAaXWuu.js";import"./sw-logo-art-Va6y_cIM.js";var P=Object.defineProperty,A=Object.getOwnPropertyDescriptor,r=(e,s,t,d)=>{for(var l=d>1?void 0:d?A(s,t):s,c=e.length-1,h;c>=0;c--)(h=e[c])&&(l=(d?h(s,t,l):h(l))||l);return d&&l&&P(s,t,l),l};const C={name:"",cameras:[],cols:2,rows:2,shared:!1,kiosk:!1},V=[{name:"כל המצלמות",layout:9,scope:"משותפת",mobile:"4 · משני",owner:"יוני",kiosk:!0},{name:"חוץ",layout:4,scope:"משותפת",mobile:"2 · משני",owner:"יוני",kiosk:!1},{name:"פנים",layout:6,scope:"משותפת",mobile:"ללא",owner:"יוסי",kiosk:!1},{name:"לילה",layout:4,scope:"אישית",mobile:"4 · משני",owner:"דנה",kiosk:!1}];let i=class extends m{constructor(){super(...arguments),this.bubbleSkin=new g(this),this.views=null,this.cams=[],this.canShare=!1,this.canManageAll=!1,this.editing=null,this.confirmDelete=null,this.busy=!1,this.error="",this.formError=""}connectedCallback(){super.connectedCallback(),w()&&this.load()}async load(){try{const[e,s]=await Promise.all([z(),u()]);this.views=e.views,this.canShare=e.can_share,this.canManageAll=e.can_manage_all,this.cams=s.cameras.filter(t=>t.enabled&&t.can_view_live!==!1),this.error=""}catch(e){this.error=p(e),this.views=this.views??[]}}canEdit(e){return this.canManageAll||e.owner_user_id===f.me?.user.id}open(e){this.formError="",this.editing=e?{id:e.id,name:e.name,cameras:[...e.cameras],cols:e.cols,rows:e.rows,shared:e.shared,kiosk:e.kiosk}:{...C,cameras:[]}}toggleCamera(e){if(!this.editing)return;const s=this.editing.cameras.includes(e);!s&&this.editing.cameras.length>=16||(this.editing={...this.editing,cameras:s?this.editing.cameras.filter(t=>t!==e):[...this.editing.cameras,e]})}async save(){const e=this.editing;if(e){if(!e.name.trim()){this.formError="לתצוגה צריך שם.";return}if(!e.cameras.length){this.formError="בחר לפחות מצלמה אחת.";return}this.busy=!0;try{const s={name:e.name.trim(),cameras:e.cameras,cols:e.cols,rows:e.rows,shared:e.shared,kiosk:e.kiosk};e.id?await E(e.id,s):await _(s),this.editing=null,await this.load()}catch(s){this.formError=p(s)}finally{this.busy=!1}}}async removeView(){const e=this.confirmDelete;if(e){this.busy=!0;try{await S(e.id),this.confirmDelete=null,await this.load()}catch(s){this.error=p(s)}finally{this.busy=!1}}}renderEditor(){const e=this.editing;return a`<sw-dialog open heading=${e.id?"עריכת תצוגה":"תצוגה חדשה"} subheading="שם, מצלמות ופריסה · תצוגה משותפת נראית לכל המשתמשים" data-view-dialog @close=${()=>this.editing=null}>
      <div class="form">
        <sw-field label="שם"><input data-view-name .value=${e.name} maxlength="60" @input=${s=>this.editing={...e,name:s.target.value}} /></sw-field>
        <div class="lbl">מצלמות (${e.cameras.length} מתוך ${this.cams.length})</div>
        <div class="chips" data-view-cameras>
          ${this.cams.map(s=>a`<sw-chip ?selected=${e.cameras.includes(s.id)} data-view-camera=${s.id} dot=${s.status==="online"?"var(--sw-live)":"var(--sw-danger)"} @click=${()=>this.toggleCamera(s.id)}>${s.name}</sw-chip>`)}
        </div>
        <div class="two">
          <sw-field label="עמודות"><select data-view-cols .value=${String(e.cols)} @change=${s=>this.editing={...e,cols:Number(s.target.value)}}>${[1,2,3,4].map(s=>a`<option value=${s} ?selected=${s===e.cols}>${s}</option>`)}</select></sw-field>
          <sw-field label="שורות"><select data-view-rows .value=${String(e.rows)} @change=${s=>this.editing={...e,rows:Number(s.target.value)}}>${[1,2,3,4].map(s=>a`<option value=${s} ?selected=${s===e.rows}>${s}</option>`)}</select></sw-field>
        </div>
        <div class="toggles">
          <sw-toggle ?checked=${e.shared} ?disabled=${!this.canShare} label=${this.canShare?"משותפת לכל המשתמשים":"משותפת (דורש הרשאת ניהול משתמשים)"} data-view-shared @change=${s=>this.editing={...e,shared:s.detail.checked}}></sw-toggle>
          <sw-toggle ?checked=${e.kiosk} label="מיועדת לקיוסק (מסך קיר)" data-view-kiosk @change=${s=>this.editing={...e,kiosk:s.detail.checked}}></sw-toggle>
        </div>
        <div class="note">הקיר פותח את המצלמות בפריסה אוטומטית; הקיוסק מציג ${e.cols}×${e.rows} מצלמות בעמוד ומדפדף בין העמודים.</div>
        ${this.formError?a`<div class="err" data-view-error>${this.formError}</div>`:n}
      </div>
      <div slot="footer">
        <sw-button variant="ghost" @click=${()=>this.editing=null}>ביטול</sw-button>
        <sw-button variant="primary" icon="check" data-view-save ?disabled=${this.busy} @click=${()=>this.save()}>${e.id?"שמור":"צור תצוגה"}</sw-button>
      </div>
    </sw-dialog>`}renderApi(){const e=this.views;return a`
      <sw-page heading="תצוגות שמורות" subheading="קבוצות מצלמות עם פריסה — אישיות או משותפות — לפתיחה בקיר החי או בקיוסק">
        <sw-button slot="actions" variant="primary" icon="plus" data-view-new @click=${()=>this.open()}>תצוגה חדשה</sw-button>
        ${this.error?a`<sw-state-panel state="error" heading="התצוגות לא נטענו" hint=${this.error}></sw-state-panel>`:n}
        ${e===null?a`<sw-state-panel state="loading" heading="טוען תצוגות…"></sw-state-panel>`:e.length?a`<div class="grid" data-views>
                ${e.map(s=>a`<sw-card data-view=${s.id}>
                    <div class="thumb" style=${`grid-template-columns:repeat(${Math.min(2,Math.max(1,s.cameras.length))}, 1fr)`}>
                      ${s.cameras.slice(0,4).map(t=>a`<img src=${b(t)} alt="" loading="lazy" @error=${d=>d.target.style.visibility="hidden"} />`)}
                      ${s.cameras.length?n:a`<div class="empty">אין מצלמות שמותר לך לראות בתצוגה זו</div>`}
                    </div>
                    <div class="head"><b>${s.name}</b><sw-badge kind=${s.shared?"recorded":"neutral"} label=${s.shared?"משותפת":"אישית"}></sw-badge>${s.kiosk?a`<sw-badge kind="neutral" label="קיוסק"></sw-badge>`:n}</div>
                    <dl>
                      <dt>מצלמות</dt><dd>${s.camera_names.join(" · ")||"—"}${s.hidden_cameras?a` <span class="muted">(+${s.hidden_cameras} ללא הרשאה)</span>`:n}</dd>
                      <dt>פריסה</dt><dd class="ltr">${s.cols}×${s.rows}</dd>
                      <dt>בעלים</dt><dd>${s.owner_username??"—"}</dd>
                    </dl>
                    <div class="foot">
                      <a href=${D(s)}><sw-button size="sm" variant="primary" icon="play" data-view-open ?disabled=${!s.cameras.length}>פתח</sw-button></a>
                      <a href=${M(s)} target="_blank" rel="noopener"><sw-button size="sm" icon="layers" data-view-kiosk-open ?disabled=${!s.cameras.length}>קיוסק</sw-button></a>
                      <span class="grow"></span>
                      ${this.canEdit(s)?a`<sw-button size="sm" variant="ghost" icon="edit" data-view-edit @click=${()=>this.open(s)}>עריכה</sw-button><sw-button size="sm" variant="ghost" icon="trash" data-view-delete @click=${()=>this.confirmDelete=s}>מחיקה</sw-button>`:n}
                    </div>
                  </sw-card>`)}
              </div>`:a`<sw-state-panel icon="grid" state="empty" heading="אין עדיין תצוגות שמורות" hint="צור תצוגה: שם, מצלמות ופריסה. תצוגה משותפת נראית לכל המשתמשים; קיוסק פותח אותה במסך קיר בלי פקדים."></sw-state-panel>`}
        ${this.editing?this.renderEditor():n}
        ${this.confirmDelete?a`<sw-dialog open heading="מחיקת תצוגה" subheading=${this.confirmDelete.name} @close=${()=>this.confirmDelete=null}>
              <p>התצוגה תוסר מהרשימה. המצלמות וההקלטות אינן מושפעות.</p>
              <div slot="footer"><sw-button variant="ghost" @click=${()=>this.confirmDelete=null}>ביטול</sw-button><sw-button variant="danger" icon="trash" data-view-delete-confirm ?disabled=${this.busy} @click=${()=>this.removeView()}>מחק</sw-button></div>
            </sw-dialog>`:n}
      </sw-page>
    `}render(){return w()?this.renderApi():a`
      <sw-page heading="תצוגות שמורות" subheading="תבניות 1 / 2 / 4 / 6 / 9 / 12 / 16 / מותאם, אישיות או משותפות, עם התאמה למובייל · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תצוגה חדשה</sw-button>
        <div class="grid">
          ${V.map(e=>{const s=Math.ceil(Math.sqrt(e.layout));return a`<sw-card heading=${e.name}>
              <sw-badge slot="actions" kind="neutral" label=${e.scope}></sw-badge>
              <div class="thumb" style="grid-template-columns:repeat(${s},1fr)">${v.filter(t=>t.state==="live").slice(0,e.layout).map(t=>a`<sw-scene kind=${$[t.id]??"lobby"}></sw-scene>`)}</div>
              <dl>
                <dt>פריסה</dt><dd>${e.layout} אריחים</dd>
                <dt>מובייל</dt><dd>${e.mobile}</dd>
                <dt>בעלים</dt><dd>${e.owner}</dd>
              </dl>
              <div class="foot">
                <a href="#/live/wall"><sw-button size="sm" icon="play">פתח</sw-button></a>
                <sw-button size="sm" variant="ghost">עריכה</sw-button>
                <sw-toggle ?checked=${e.kiosk} label="קיוסק"></sw-toggle>
              </div>
            </sw-card>`})}
        </div>
      </sw-page>
    `}};i.styles=[k`
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
  `,x];r([o()],i.prototype,"views",2);r([o()],i.prototype,"cams",2);r([o()],i.prototype,"canShare",2);r([o()],i.prototype,"canManageAll",2);r([o()],i.prototype,"editing",2);r([o()],i.prototype,"confirmDelete",2);r([o()],i.prototype,"busy",2);r([o()],i.prototype,"error",2);r([o()],i.prototype,"formError",2);i=r([y("live-views")],i);export{i as LiveViews};
//# sourceMappingURL=live-views-WZxC_IX-.js.map
