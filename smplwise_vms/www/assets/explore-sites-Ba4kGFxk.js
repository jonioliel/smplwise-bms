import{i as v,P as k,O as $,Q as x,m,R as y,T as z,A as o,b as a,U as S,V as _,W as u,X as O,Y as A,Z as E,_ as I,$ as w,a0 as N,g as P,j as h,k as M}from"./index-eHtAZ44A.js";import{t as s}from"./media-DlSWE2rY.js";import{a as g}from"./activate-keys-CrBsenYs.js";import"./sw-logo-art-PLtEZJxU.js";var B=Object.defineProperty,C=Object.getOwnPropertyDescriptor,d=(i,e,r,t)=>{for(var n=t>1?void 0:t?C(e,r):e,c=i.length-1,p;c>=0;c--)(p=i[c])&&(n=(t?p(e,r,n):p(n))||n);return t&&n&&B(e,r,n),n};const T=["house","building","warehouse"];let l=class extends v{constructor(){super(...arguments),this.phone=new k(this),this.tab="all",this.tree=null,this.dialog=null,this.notice="",this.formName="",this.formShared=!1,this.multiOn=!1,this.formAddress="",this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.reload(),$().then(i=>this.multiOn=i)}async reload(){try{this.tree=await x()}catch(i){this.error=m(i)}}open(i){this.phone.restricted("structure")||(this.formName=i&&i.kind==="edit-site"?i.site.name:i&&i.kind==="edit-building"?i.building.name:"",this.formAddress=i&&i.kind==="edit-site"?i.site.address:"",this.formShared=i&&i.kind==="edit-building"?!!i.building.is_shared:!1,this.error="",this.dialog=i)}pickImage(i,e){const r=document.createElement("input");r.type="file",r.accept="image/png,image/jpeg",r.addEventListener("change",()=>{const t=r.files?.[0];t&&(this.busy=!0,(async()=>{await y(i,e,t),this.notice=s("התמונה נשמרה."),await this.reload()})().catch(n=>{this.notice=m(n)}).finally(()=>{this.busy=!1}))}),r.click()}async removeImage(i,e){this.busy=!0;try{await z(i,e),await this.reload()}catch(r){this.notice=m(r)}finally{this.busy=!1}}renderMenu(i,e,r){const t=r?!!r.image_url:!!e.image_url,n=r?r.id:e.id;return a`<span class="menu" @click=${p=>p.stopPropagation()}>
      ${r?o:a`<sw-button variant="ghost" size="sm" icon="plus" data-add-building=${e.id} @click=${()=>this.open({kind:"building",site:e})}>${s("מבנה")}</sw-button>`}
      <sw-button variant="ghost" size="sm" iconOnly icon="edit" label=${s("עריכה")} data-edit=${n} @click=${()=>this.open(r?{kind:"edit-building",building:r,site:e}:{kind:"edit-site",site:e})}></sw-button>
      <sw-button variant="ghost" size="sm" iconOnly icon="camera" label=${t?s("החלף תמונה"):s("תמונה")} ?disabled=${this.busy} data-image=${n} @click=${()=>this.pickImage(i,n)}></sw-button>
      ${t?a`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסר תמונה")} ?disabled=${this.busy} @click=${()=>this.removeImage(i,n)}></sw-button>`:o}
      <sw-button variant="ghost" size="sm" iconOnly icon="trash" label=${s("מחיקה")} data-delete=${n} @click=${()=>this.open(r?{kind:"delete-building",building:r,site:e}:{kind:"delete-site",site:e})}></sw-button>
    </span>`}async submit(){const i=this.dialog;if(i){this.busy=!0,this.error="";try{if(i.kind==="site"){const e=await S({name:this.formName.trim(),address:this.formAddress.trim()});this.dialog=null,await this.reload(),this.open({kind:"building",site:e})}else if(i.kind==="building"){const e=await _(i.site.id,{name:this.formName.trim()});this.dialog=null,u(`/explore/buildings/${e.id}/floors`)}else i.kind==="edit-site"?(await O(i.site.id,{name:this.formName.trim(),address:this.formAddress.trim()}),this.dialog=null,await this.reload()):i.kind==="edit-building"?(await A(i.building.id,{name:this.formName.trim(),...this.formShared!==!!i.building.is_shared?{is_shared:this.formShared}:{}}),this.dialog=null,await this.reload()):i.kind==="delete-site"?(await E(i.site.id),this.dialog=null,await this.reload()):i.kind==="delete-building"&&(await I(i.building.id),this.dialog=null,await this.reload())}catch(e){this.error=m(e)}finally{this.busy=!1}}}openSite(i){const e=i.buildings?.[0];e?u(`/explore/buildings/${e.id}/floors`):this.open({kind:"building",site:i})}renderSites(i){return a`<div class="grid">
      ${i.sites.map((e,r)=>{const t=e.buildings??[],n=t.reduce((c,p)=>c+(p.floors??[]).reduce((b,f)=>b+f.camera_count,0),0);return a`<sw-card flush interactive tabindex="0" role=${t.length?"link":"button"} aria-label=${e.name} data-site-card=${e.id} @click=${()=>this.openSite(e)} @keydown=${g(()=>this.openSite(e))}>
          <div class="pic">${e.image_url?a`<img class="photo" src=${w(e.image_url)} alt="" />`:a`<sw-scene kind=${T[r%3]}></sw-scene>${i.source==="demo"?a`<span class="demo">${s("דמו")}</span>`:a`<span class="demo">${s("איור")}</span>`}`}</div>
          <div class="info">
            <div class="txt"><b class="clamp2" dir="auto" title=${e.name} data-site-name>${e.name}</b><small>${t.length===1?s("{n} מבנה",{n:1}):s("{n} מבנים",{n:t.length})} · ${s("{n} מצלמות",{n})}</small>${e.address?a`<small class="clamp2" dir="auto" title=${e.address} data-site-address>${e.address}</small>`:a`<small class="clamp2"></small>`}</div>
            <div class="acts">
              ${i.source==="api"&&!this.phone.restricted("structure")?this.renderMenu("site",e):o}
              ${this.phone.restricted("structure")?o:a`<sw-button variant="ghost" size="sm" iconOnly icon="plus" label=${s("מבנה חדש")} @click=${c=>{c.stopPropagation(),this.open({kind:"building",site:e})}}></sw-button>`}
            </div>
          </div>
        </sw-card>`})}
      ${i.canCreateSite&&!this.phone.restricted("structure")?a`<button class="add" @click=${()=>this.open({kind:"site"})}><div><div class="ic"><sw-icon name="plus" size=${18}></sw-icon></div><strong>${s("הוספת אתר חדש")}</strong><small>${s("יצירת מיקום חדש כדי להתחיל")}</small></div></button>`:o}
    </div>`}renderBuildings(i){const e=i.sites.flatMap(r=>(r.buildings??[]).map(t=>({s:r,b:t})));return a`<div class="blist">
      ${e.map(({s:r,b:t},n)=>a`<sw-card class="brow" tabindex="0" role="link" aria-label=${t.name} data-building-card=${t.id} @click=${()=>u(`/explore/buildings/${t.id}/floors`)} @keydown=${g(()=>u(`/explore/buildings/${t.id}/floors`))}>
          ${t.image_url?a`<img class="photo small" src=${w(t.image_url)} alt="" />`:a`<sw-scene kind=${n%2?"house":"building"}></sw-scene>`}
          <div><b dir="auto" title=${t.name}>${t.name}</b><small>${r.name} · ${s("{n} קומות",{n:(t.floors??[]).length})} · ${s("{n} מצלמות",{n:(t.floors??[]).reduce((c,p)=>c+p.camera_count,0)})}</small></div>
          ${i.source==="api"&&!this.phone.restricted("structure")?this.renderMenu("building",r,t):o}
          <sw-icon name="chevron" size=${14}></sw-icon>
        </sw-card>`)}
      ${e.length?o:a`<div class="map" style="min-block-size:120px">${s("אין מבנים עדיין.")}</div>`}
    </div>`}render(){const i=this.tree;if(!i)return a`<sw-page heading=${s("אתרים ומבנים")}><sw-state-panel icon="building" state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const e=this.phone.restricted("structure")?null:this.dialog,r=i.canCreateSite&&!this.phone.restricted("structure");return a`
      <sw-page heading=${s("אתרים ומבנים")} subheading=${`${s("ניהול המיקומים והמבנים שלך")}${i.source==="demo"?s(" · נתוני הדגמה"):""}`}>
        ${r?a`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>this.open({kind:"site"})}>${s("אתר חדש")}</sw-button>`:o}
        <sw-tabs .items=${[{id:"all",label:s("כל האתרים"),count:i.sites.length},{id:"buildings",label:s("מבנים"),count:i.sites.reduce((t,n)=>t+(n.buildings?.length??0),0)},{id:"map",label:s("מפה")}]} .active=${this.tab} @change=${t=>this.tab=t.detail.id}></sw-tabs>
        ${i.sites.length===0&&this.tab==="all"?a`<sw-state-panel icon="building" state="empty" heading=${s("עוד אין אתרים")} hint=${this.phone.restricted("structure")?s("יצירת אתרים ומבנים זמינה במחשב."):s("התחל ביצירת האתר הראשון; אחר כך מבנה, קומות ותוכניות.")}>${r?a`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>this.open({kind:"site"})}>${s("אתר חדש")}</sw-button></div>`:o}</sw-state-panel>`:this.tab==="all"?this.renderSites(i):this.tab==="buildings"?this.renderBuildings(i):a`<div class="map">${s("מפת אתרים (לוח 3 · מסך 17) תצטרף עם שכבת מיקום גאוגרפי · Beta")}</div>`}
        ${this.notice?a`<div class="err" data-sites-notice style="margin-block:8px">${this.notice}</div>`:o}
        ${e&&(e.kind==="delete-site"||e.kind==="delete-building")?(()=>{const t=e.kind==="delete-site"?(e.site.buildings??[]).length:(e.building.floors??[]).length,n=e.kind==="delete-site"?e.site.name:e.building.name;return a`<sw-dialog open heading=${e.kind==="delete-site"?s("מחיקת אתר"):s("מחיקת מבנה")} subheading=${n} data-delete-dialog @close=${()=>this.dialog=null}>
                ${t?a`<div class="err">${e.kind==="delete-site"?s("לאתר יש {children} מבנים",{children:t}):s("למבנה יש {children} קומות",{children:t})}${s(". מחק אותם קודם; מחיקה לא מוחקת מצלמות, רק את המיקום בקטלוג.")}</div>`:a`<div>${s("המיקום יוסר מהקטלוג (מחיקה רכה, נרשמת באודיט). מצלמות והקלטות אינן מושפעות.")}</div>`}
                ${this.error?a`<div class="err">${this.error}</div>`:o}
                <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${s("ביטול")}</sw-button>
                <sw-button slot="footer" variant="danger" ?disabled=${!!t||this.busy} data-delete-confirm @click=${()=>this.submit()}>${s("מחק")}</sw-button>
              </sw-dialog>`})():e?a`<sw-dialog open heading=${e.kind==="site"?s("אתר חדש"):e.kind==="building"?s("מבנה חדש"):e.kind==="edit-site"?s("עריכת אתר"):s("עריכת מבנה")} subheading=${e.kind==="building"?e.site.name:e.kind==="site"?s("שם, כתובת ואזור זמן ברירת מחדל Asia/Jerusalem"):e.kind==="edit-building"?e.site.name:e.site.address||""} data-edit-dialog @close=${()=>this.dialog=null}>
                <sw-field label=${s("שם")}><input data-form-name .value=${this.formName} @input=${t=>this.formName=t.target.value} placeholder=${e.kind==="site"||e.kind==="edit-site"?s("למשל: משרדי החברה"):s("למשל: מבנה ראשי")} /></sw-field>
                ${e.kind==="site"||e.kind==="edit-site"?a`<sw-field label=${s("כתובת (אופציונלי)")}><input data-form-address .value=${this.formAddress} @input=${t=>this.formAddress=t.target.value} /></sw-field>`:o}
                ${e.kind==="edit-building"&&this.multiOn?a`<label class="shared-flag" data-form-shared><sw-toggle size="sm" labelHidden in-label label=${s("בניין משותף")} .checked=${this.formShared} @change=${t=>this.formShared=N(t)}></sw-toggle><span><b>${s("בניין משותף")}</b><small>${s('חניון, חדר חשמל, גינה - מוצג אחרון במסך הראשי ולא מסומן ב"כבה הכל באתר"')}</small></span></label>`:o}
                ${this.error?a`<div class="err">${this.error}</div>`:o}
                ${i.source==="demo"?a`<div class="err">${s("נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.")}</div>`:o}
                <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${s("ביטול")}</sw-button>
                <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||i.source==="demo"} data-form-submit @click=${()=>this.submit()}>${e.kind==="site"?s("צור אתר"):e.kind==="building"?s("צור מבנה"):s("שמור")}</sw-button>
              </sw-dialog>`:o}
      </sw-page>
    `}};l.styles=P`
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
  `;d([h()],l.prototype,"tab",2);d([h()],l.prototype,"tree",2);d([h()],l.prototype,"dialog",2);d([h()],l.prototype,"notice",2);d([h()],l.prototype,"formName",2);d([h()],l.prototype,"formShared",2);d([h()],l.prototype,"multiOn",2);d([h()],l.prototype,"formAddress",2);d([h()],l.prototype,"busy",2);d([h()],l.prototype,"error",2);l=d([M("explore-sites")],l);export{l as ExploreSites};
