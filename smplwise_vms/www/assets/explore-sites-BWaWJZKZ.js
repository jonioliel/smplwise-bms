import{a as b,ac as f,ad as v,ae as k,R as p,af as x,ag as y,A as n,e as t,ah as $,ai as z,aj as m,ak as S,al as _,am as O,an as E,ao as u,E as A,G as c,H as I}from"./index-D2ApsviK.js";import"./sw-logo-art-Va6y_cIM.js";var N=Object.defineProperty,P=Object.getOwnPropertyDescriptor,l=(i,e,a,s)=>{for(var r=s>1?void 0:s?P(e,a):e,d=i.length-1,h;d>=0;d--)(h=i[d])&&(r=(s?h(e,a,r):h(r))||r);return s&&r&&N(e,a,r),r};const M=["house","building","warehouse"];let o=class extends b{constructor(){super(...arguments),this.phone=new f(this),this.tab="all",this.tree=null,this.dialog=null,this.notice="",this.formName="",this.formShared=!1,this.multiOn=!1,this.formAddress="",this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.reload(),v().then(i=>this.multiOn=i)}async reload(){try{this.tree=await k()}catch(i){this.error=p(i)}}open(i){this.phone.restricted("structure")||(this.formName=i&&i.kind==="edit-site"?i.site.name:i&&i.kind==="edit-building"?i.building.name:"",this.formAddress=i&&i.kind==="edit-site"?i.site.address:"",this.formShared=i&&i.kind==="edit-building"?!!i.building.is_shared:!1,this.error="",this.dialog=i)}pickImage(i,e){const a=document.createElement("input");a.type="file",a.accept="image/png,image/jpeg",a.addEventListener("change",async()=>{const s=a.files?.[0];if(s){this.busy=!0;try{await x(i,e,s),this.notice="התמונה נשמרה.",await this.reload()}catch(r){this.notice=p(r)}finally{this.busy=!1}}}),a.click()}async removeImage(i,e){this.busy=!0;try{await y(i,e),await this.reload()}catch(a){this.notice=p(a)}finally{this.busy=!1}}renderMenu(i,e,a){const s=a?!!a.image_url:!!e.image_url,r=a?a.id:e.id;return t`<span class="menu" @click=${h=>h.stopPropagation()}>
      ${a?n:t`<sw-button variant="ghost" size="sm" icon="plus" data-add-building=${e.id} @click=${()=>this.open({kind:"building",site:e})}>מבנה</sw-button>`}
      <sw-button variant="ghost" size="sm" iconOnly icon="edit" label="עריכה" data-edit=${r} @click=${()=>this.open(a?{kind:"edit-building",building:a,site:e}:{kind:"edit-site",site:e})}></sw-button>
      <sw-button variant="ghost" size="sm" iconOnly icon="camera" label=${s?"החלף תמונה":"תמונה"} ?disabled=${this.busy} data-image=${r} @click=${()=>this.pickImage(i,r)}></sw-button>
      ${s?t`<sw-button variant="ghost" size="sm" iconOnly icon="close" label="הסר תמונה" ?disabled=${this.busy} @click=${()=>this.removeImage(i,r)}></sw-button>`:n}
      <sw-button variant="ghost" size="sm" iconOnly icon="trash" label="מחיקה" data-delete=${r} @click=${()=>this.open(a?{kind:"delete-building",building:a,site:e}:{kind:"delete-site",site:e})}></sw-button>
    </span>`}async submit(){const i=this.dialog;if(i){this.busy=!0,this.error="";try{if(i.kind==="site"){const e=await $({name:this.formName.trim(),address:this.formAddress.trim()});this.dialog=null,await this.reload(),this.open({kind:"building",site:e})}else if(i.kind==="building"){const e=await z(i.site.id,{name:this.formName.trim()});this.dialog=null,m(`/explore/buildings/${e.id}/floors`)}else i.kind==="edit-site"?(await S(i.site.id,{name:this.formName.trim(),address:this.formAddress.trim()}),this.dialog=null,await this.reload()):i.kind==="edit-building"?(await _(i.building.id,{name:this.formName.trim(),...this.formShared!==!!i.building.is_shared?{is_shared:this.formShared}:{}}),this.dialog=null,await this.reload()):i.kind==="delete-site"?(await O(i.site.id),this.dialog=null,await this.reload()):i.kind==="delete-building"&&(await E(i.building.id),this.dialog=null,await this.reload())}catch(e){this.error=p(e)}finally{this.busy=!1}}}openSite(i){const e=i.buildings?.[0];e?m(`/explore/buildings/${e.id}/floors`):this.open({kind:"building",site:i})}renderSites(i){return t`<div class="grid">
      ${i.sites.map((e,a)=>{const s=e.buildings??[],r=s.reduce((d,h)=>d+(h.floors??[]).reduce((w,g)=>w+g.camera_count,0),0);return t`<sw-card flush interactive data-site-card=${e.id} @click=${()=>this.openSite(e)}>
          <div class="pic">${e.image_url?t`<img class="photo" src=${u(e.image_url)} alt="" />`:t`<sw-scene kind=${M[a%3]}></sw-scene>${i.source==="demo"?t`<span class="demo">דמו</span>`:t`<span class="demo">איור</span>`}`}</div>
          <div class="info">
            <div class="txt"><b class="clamp2" dir="auto" title=${e.name} data-site-name>${e.name}</b><small>${s.length} ${s.length===1?"מבנה":"מבנים"} · ${r} מצלמות</small>${e.address?t`<small class="clamp2" dir="auto" title=${e.address} data-site-address>${e.address}</small>`:t`<small class="clamp2"></small>`}</div>
            <div class="acts">
              ${i.source==="api"&&!this.phone.restricted("structure")?this.renderMenu("site",e):n}
              ${this.phone.restricted("structure")?n:t`<sw-button variant="ghost" size="sm" iconOnly icon="plus" label="מבנה חדש" @click=${d=>{d.stopPropagation(),this.open({kind:"building",site:e})}}></sw-button>`}
            </div>
          </div>
        </sw-card>`})}
      ${i.canCreateSite&&!this.phone.restricted("structure")?t`<button class="add" @click=${()=>this.open({kind:"site"})}><div><div class="ic"><sw-icon name="plus" size=${18}></sw-icon></div><strong>הוספת אתר חדש</strong><small>יצירת מיקום חדש כדי להתחיל</small></div></button>`:n}
    </div>`}renderBuildings(i){const e=i.sites.flatMap(a=>(a.buildings??[]).map(s=>({s:a,b:s})));return t`<div class="blist">
      ${e.map(({s:a,b:s},r)=>t`<sw-card class="brow" data-building-card=${s.id} @click=${()=>m(`/explore/buildings/${s.id}/floors`)}>
          ${s.image_url?t`<img class="photo small" src=${u(s.image_url)} alt="" />`:t`<sw-scene kind=${r%2?"house":"building"}></sw-scene>`}
          <div><b dir="auto" title=${s.name}>${s.name}</b><small>${a.name} · ${(s.floors??[]).length} קומות · ${(s.floors??[]).reduce((d,h)=>d+h.camera_count,0)} מצלמות</small></div>
          ${i.source==="api"&&!this.phone.restricted("structure")?this.renderMenu("building",a,s):n}
          <sw-icon name="chevron" size=${14}></sw-icon>
        </sw-card>`)}
      ${e.length?n:t`<div class="map" style="min-block-size:120px">אין מבנים עדיין.</div>`}
    </div>`}render(){const i=this.tree;if(!i)return t`<sw-page heading="אתרים ומבנים"><sw-state-panel icon="building" state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const e=this.phone.restricted("structure")?null:this.dialog,a=i.canCreateSite&&!this.phone.restricted("structure");return t`
      <sw-page heading="אתרים ומבנים" subheading=${`ניהול המיקומים והמבנים שלך${i.source==="demo"?" · נתוני הדגמה":""}`}>
        ${a?t`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>this.open({kind:"site"})}>אתר חדש</sw-button>`:n}
        <sw-tabs .items=${[{id:"all",label:"כל האתרים",count:i.sites.length},{id:"buildings",label:"מבנים",count:i.sites.reduce((s,r)=>s+(r.buildings?.length??0),0)},{id:"map",label:"מפה"}]} .active=${this.tab} @change=${s=>this.tab=s.detail.id}></sw-tabs>
        ${i.sites.length===0&&this.tab==="all"?t`<sw-state-panel icon="building" state="empty" heading="עוד אין אתרים" hint=${this.phone.restricted("structure")?"יצירת אתרים ומבנים זמינה במחשב.":"התחל ביצירת האתר הראשון; אחר כך מבנה, קומות ותוכניות."}>${a?t`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>this.open({kind:"site"})}>אתר חדש</sw-button></div>`:n}</sw-state-panel>`:this.tab==="all"?this.renderSites(i):this.tab==="buildings"?this.renderBuildings(i):t`<div class="map">מפת אתרים (לוח 3 · מסך 17) תצטרף עם שכבת מיקום גאוגרפי · Beta</div>`}
        ${this.notice?t`<div class="err" data-sites-notice style="margin-block:8px">${this.notice}</div>`:n}
        ${e&&(e.kind==="delete-site"||e.kind==="delete-building")?(()=>{const s=e.kind==="delete-site"?(e.site.buildings??[]).length:(e.building.floors??[]).length,r=e.kind==="delete-site"?e.site.name:e.building.name;return t`<sw-dialog open heading=${e.kind==="delete-site"?"מחיקת אתר":"מחיקת מבנה"} subheading=${r} data-delete-dialog @close=${()=>this.dialog=null}>
                ${s?t`<div class="err">${e.kind==="delete-site"?`לאתר יש ${s} מבנים`:`למבנה יש ${s} קומות`}. מחק אותם קודם; מחיקה לא מוחקת מצלמות, רק את המיקום בקטלוג.</div>`:t`<div>המיקום יוסר מהקטלוג (מחיקה רכה, נרשמת באודיט). מצלמות והקלטות אינן מושפעות.</div>`}
                ${this.error?t`<div class="err">${this.error}</div>`:n}
                <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
                <sw-button slot="footer" variant="danger" ?disabled=${!!s||this.busy} data-delete-confirm @click=${()=>this.submit()}>מחק</sw-button>
              </sw-dialog>`})():e?t`<sw-dialog open heading=${e.kind==="site"?"אתר חדש":e.kind==="building"?"מבנה חדש":e.kind==="edit-site"?"עריכת אתר":"עריכת מבנה"} subheading=${e.kind==="building"?e.site.name:e.kind==="site"?"שם, כתובת ואזור זמן ברירת מחדל Asia/Jerusalem":e.kind==="edit-building"?e.site.name:e.site.address||""} data-edit-dialog @close=${()=>this.dialog=null}>
                <sw-field label="שם"><input data-form-name .value=${this.formName} @input=${s=>this.formName=s.target.value} placeholder=${e.kind==="site"||e.kind==="edit-site"?"למשל: משרדי החברה":"למשל: מבנה ראשי"} /></sw-field>
                ${e.kind==="site"||e.kind==="edit-site"?t`<sw-field label="כתובת (אופציונלי)"><input data-form-address .value=${this.formAddress} @input=${s=>this.formAddress=s.target.value} /></sw-field>`:n}
                ${e.kind==="edit-building"&&this.multiOn?t`<label class="shared-flag" data-form-shared><input type="checkbox" .checked=${this.formShared} @change=${s=>this.formShared=s.target.checked} /><span><b>בניין משותף</b><small>חניון, חדר חשמל, גינה - מוצג אחרון במסך הראשי ולא מסומן ב"כבה הכל באתר"</small></span></label>`:n}
                ${this.error?t`<div class="err">${this.error}</div>`:n}
                ${i.source==="demo"?t`<div class="err">נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.</div>`:n}
                <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
                <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||i.source==="demo"} data-form-submit @click=${()=>this.submit()}>${e.kind==="site"?"צור אתר":e.kind==="building"?"צור מבנה":"שמור"}</sw-button>
              </sw-dialog>`:n}
      </sw-page>
    `}};o.styles=A`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
      gap: 14px;
    }
    .pic {
      position: relative;
      aspect-ratio: 16 / 10;
      overflow: hidden;
    }
    /* SITENAME-2272: on a phone the picture is wider than tall, so a card with up to three name lines stays compact */
    @media (max-width: 520px) {
      .pic {
        aspect-ratio: 2 / 1;
      }
    }
    .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .pic .demo {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: var(--sw-fs-2xs);
      letter-spacing: 0.04em;
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-2xs);
      padding: 1px 6px;
    }
    /* UXFIX-RTL: the text column may shrink (min-inline-size 0), so a long name or address wraps by words instead of one word per line,
       the name and the address are clamped to two lines (the full text is the title attribute) and the action buttons sit at the top end
       of every card, at the same height. */
    .info {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 8px;
      padding: 10px 12px 12px;
    }
    .info .txt {
      min-inline-size: 0;
    }
    .info .acts {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .info .clamp2 {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
      text-align: start;
    }
    .info b {
      display: block;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      min-block-size: 2.6em;
    }
    .info small.clamp2 {
      min-block-size: 2.6em;
    }
    .info small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .add {
      display: grid;
      place-items: center;
      min-block-size: 200px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      color: var(--sw-text-2);
      text-align: center;
      cursor: pointer;
      transition: border-color var(--sw-t-fast) var(--sw-ease), background var(--sw-t-fast) var(--sw-ease);
      font-size: var(--sw-fs-sm);
      background: transparent;
      font-family: inherit;
    }
    .add .ic {
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin: 0 auto 8px;
    }
    .add small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .blist {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .brow {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }
    .brow sw-scene {
      inline-size: 64px;
      block-size: 44px;
      border-radius: var(--sw-r-xs);
      flex-shrink: 0;
    }
    .brow > div {
      min-inline-size: 0;
      flex: 1;
    }
    .brow b {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
      font-weight: var(--sw-fw-semibold);
    }
    .brow small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .brow sw-icon {
      margin-inline-start: auto;
      color: var(--sw-text-3);
    }
    .menu {
      display: inline-flex;
      gap: 2px;
      align-items: center;
    }
    .brow .menu {
      margin-inline-start: auto;
    }
    .brow .menu + sw-icon {
      margin-inline-start: 0;
    }
    img.photo {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    img.photo.small {
      inline-size: 64px;
      block-size: 44px;
      border-radius: var(--sw-r-xs);
      flex-shrink: 0;
    }
    .map {
      min-block-size: 360px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .shared-flag {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-block-start: 8px;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .shared-flag input {
      margin-block-start: 3px;
      accent-color: var(--sw-shared, var(--sw-accent));
    }
    .shared-flag span {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .shared-flag small {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    /* R5-MAPS-297 (impeccable bolder, the HOMEFABLE hero / card / well pattern): the site cards are the hero step - the large radius,
       shadow 2, the name as a 20/700 heading and the "buildings · cameras" count as the display line (it is the answer of this screen);
       the add card and the empty map are wells; the building rows keep the card step with a 15/700 name. Press feedback on pointer-down,
       hover only with a fine pointer (emil-design-eng, mobile-native). */
    .grid > sw-card {
      --sw-card-radius: var(--sw-r-lg);
      --sw-card-shadow: var(--sw-shadow-2);
    }
    .info {
      padding: 12px 14px 14px;
    }
    .info b {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.02em;
      line-height: 1.2;
      min-block-size: 2.4em;
    }
    .info small:not(.clamp2) {
      display: block;
      margin-block: 3px 4px;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      font-variant-numeric: tabular-nums;
    }
    .add {
      background: var(--sw-surface-2);
      border-color: var(--sw-border-strong);
      border-radius: var(--sw-r-lg);
      transition: border-color var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
    }
    .add strong {
      display: block;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .add .ic {
      background: transparent;
      border: 1.5px dashed var(--sw-border-strong);
      color: var(--sw-text-2);
    }
    .add:active {
      transform: scale(var(--sw-press-scale));
    }
    /* POLISH4 WP6 (D12): hover only under a fine pointer (a tap on a touch tablet leaves no sticky accent wash) */
    @media (hover: hover) and (pointer: fine) {
      .add:hover {
        border-color: var(--sw-accent);
        background: var(--sw-accent-soft);
        color: var(--sw-accent-text);
      }
    }
    .brow b {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .brow small {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .brow sw-scene,
    img.photo.small {
      inline-size: 84px;
      block-size: 56px;
      border-radius: var(--sw-r-sm);
    }
    .map {
      background: var(--sw-surface-2);
      border: 0;
      font-weight: var(--sw-fw-medium);
    }
    /* R5-MAPS-297 loop 2 (the loop-1 shots still read as "the same white cards"): the count is a FILLED field (surface 3 pill in the heading
       ink); the building rows carry the same filled count field. */
    .info small:not(.clamp2) {
      display: inline-block;
      inline-size: fit-content;
      max-inline-size: 100%;
      padding: 4px 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      margin-block: 6px 6px;
      line-height: 1.3;
    }
    .info small.clamp2 {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    /* SITENAME-2272: a site name always fits its card. The card is the size container; the action buttons take their own row at the
       top end (so the name gets the full card width and the buttons align across a row), the name shrinks with the card width and may
       use three lines (the full text stays in the title attribute), and the count line never wraps. */
    .info {
      container-type: inline-size;
      grid-template-columns: minmax(0, 1fr);
      row-gap: 4px;
    }
    .info .acts {
      grid-row: 1;
      justify-content: flex-end;
      min-block-size: 36px;
    }
    .info .txt {
      grid-row: 2;
    }
    .info b.clamp2 {
      -webkit-line-clamp: 3;
      line-clamp: 3;
      font-size: clamp(var(--sw-fs-lg), 7.2cqi, var(--sw-fs-2xl));
      line-height: 1.25;
      overflow-wrap: break-word;
      word-break: normal;
      hyphens: auto;
    }
    .info small:not(.clamp2) {
      white-space: nowrap;
      font-size: clamp(var(--sw-fs-sm), 5.2cqi, var(--sw-fs-lg));
      padding-inline: 10px;
    }
    .brow small {
      display: inline-block;
      padding: 2px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-heading);
      margin-block-start: 4px;
    }
  `;l([c()],o.prototype,"tab",2);l([c()],o.prototype,"tree",2);l([c()],o.prototype,"dialog",2);l([c()],o.prototype,"notice",2);l([c()],o.prototype,"formName",2);l([c()],o.prototype,"formShared",2);l([c()],o.prototype,"multiOn",2);l([c()],o.prototype,"formAddress",2);l([c()],o.prototype,"busy",2);l([c()],o.prototype,"error",2);o=l([I("explore-sites")],o);export{o as ExploreSites};
//# sourceMappingURL=explore-sites-BWaWJZKZ.js.map
