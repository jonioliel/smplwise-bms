import{i as A,aL as D,a2 as f,p as j,eL as H,n as v,aI as L,a as _,A as r,b as a,Y as w,fp as z,aU as O,aV as R,g as q,j as l,c$ as V,aK as K,ax as Z,k as B}from"./index-rXjlW4bK.js";import"./sw-table-BkAxAukF.js";import"./sw-chip-DbEqThVX.js";import{E as G,t as Q}from"./events-BnIxuogU.js";import{f as W}from"./recordings-DyG9v8HE.js";import{f as b,e as J}from"./exports-D27x-MRo.js";import{g as Y,b as X,u as tt,v as N,d as st,e as et,f as at,p as T,h as C,P as it,i as rt,r as nt,C as $,a as k,j as ot,l as lt,c as dt,k as ct,m as pt,F as mt}from"./cases-DrdzZ9a3.js";import{I as P}from"./investigate-r5-css-DJpKmxOH.js";import{a as I}from"./investigate-time-B-23mUux.js";import{t as s}from"./investigate-C0qo_h4B.js";import"./sw-logo-art-PLtEZJxU.js";import"./bytes-QYSxC3WX.js";var ht=Object.defineProperty,ut=Object.getOwnPropertyDescriptor,n=(t,e,i,p)=>{for(var d=p>1?void 0:p?ut(e,i):e,u=t.length-1,c;u>=0;u--)(c=t[u])&&(d=(p?c(e,i,d):c(d))||d);return p&&d&&ht(e,i,d),d};const F={open:"stale",in_review:"recorded",closed:"neutral"},wt={preserved:"recorded",preserving:"partial",nvr_only:"stale",missing:"error",unknown:"unknown",not_in_bundle:"neutral",none:"neutral"},vt={ok:"recorded",mismatch:"error",missing:"error",corrupt:"error"},U=t=>t?`${t.slice(0,12)}…`:"—";function S(t){return!t||!t.present?s("ללא חתימה (חבילה מגרסה ישנה, או שהחתימה הוסרה) — נבדקו רק הגיבובים."):t.valid?`${s("חתימה תקינה · Ed25519 · מפתח {kid}",{kid:String(t.kid)})} · ${t.trust==="installation"?t.retired?s("מפתח שהוחלף, מוכר למתקן זה"):s("המפתח הפעיל של מתקן זה"):s("מפתח שאינו מוכר למתקן זה — שלמות בלבד, לא אמון")}`:`${s("חתימה לא תקינה")}${t.reason?` (${t.reason})`:""} — ${s("ה־manifest שונה אחרי הייצוא או שהחתימה זויפה.")}`}const y=(t,e)=>L(new Date(t),{timeZone:e}),$t="font-size:var(--sw-fs-md);font-weight:var(--sw-fw-semibold);color:var(--sw-heading);text-decoration:none;border-radius:var(--sw-r-2xs);outline-offset:2px",x="font-size:var(--sw-fs-xs);color:var(--sw-text-3);line-height:1.4",g="font-variant-numeric:tabular-nums",M=t=>a`<a href=${`#/investigate/cases/${String(t.id)}`} style=${$t} data-case-link @click=${e=>e.stopPropagation()}>${String(t.title)}</a>${t.imported?a` <sw-badge kind="historic" label=${s("מיובא")} data-case-imported></sw-badge>`:r}`,gt=t=>{const e=String(t.updated),i=I(e);return a`<div style=${`${g};color:var(--sw-heading)`}>${i??y(e)}</div>${i?a`<div style=${`${x};${g}`}><span style="direction:ltr;unicode-bidi:isolate">${y(e)}</span></div>`:r}`},ft=t=>{const e=Number(t.preserved),i=Number(t.clips);return a`<span style=${`${g};font-weight:var(--sw-fw-semibold);color:var(--sw-heading)`}>${e}</span><span style=${`${g};color:var(--sw-text-3)`}> / ${i}</span>`},bt=[{key:"title",label:s("תיק"),render:t=>a`${M(t)}${t.tags?a`<div style=${x}>${String(t.tags)}</div>`:r}`},{key:"status",label:s("סטטוס"),width:"120px",render:t=>a`<sw-badge filled kind=${F[t.status]} label=${$[t.status]}></sw-badge>`},{key:"owner",label:s("בעלים"),width:"120px"},{key:"items",label:s("פריטים"),width:"90px",render:t=>a`<span style=${g}>${String(t.items)}</span>`},{key:"preserved",label:s("עותקים שמורים"),width:"130px",render:ft},{key:"updated",label:s("עודכן"),width:"170px",render:gt}],yt=[{key:"title",label:s("תיק"),render:t=>a`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${M(t)}<sw-badge filled kind=${F[t.status]} label=${$[t.status]}></sw-badge></div>
      <div style=${`${x};${g};margin-block-start:2px`}>${String(t.owner)} · ${s("{n} פריטים",{n:String(t.items)})} · ${s("{n}/{total} שמורים",{n:String(t.preserved),total:String(t.clips)})} · ${I(String(t.updated))??y(String(t.updated))}</div>
      ${t.tags?a`<div style=${x}>${String(t.tags)}</div>`:r}`}],E="(max-width: 767px)",xt=[{key:"title",label:s("תיק"),render:t=>a`<strong style="font-size:var(--sw-fs-md);color:var(--sw-heading)">${String(t.title)}</strong>`},{key:"status",label:s("סטטוס"),render:t=>a`<sw-badge filled kind=${t.status==="פתוח"?"stale":t.status==="סגור"?"offline":"recorded"} label=${String(t.status)}></sw-badge>`},{key:"owner",label:s("בעלים")},{key:"clips",label:s("קטעים")},{key:"notes",label:s("הערות")},{key:"preserved",label:s("ראיות שמורות"),render:t=>a`${s("{n} שמורות",{n:String(t.preserved)})}${Number(t.missing)?a` <sw-badge filled kind="error" label=${s("{n} חסרות",{n:String(t.missing)})} style="margin-inline-start:6px"></sw-badge>`:""}`},{key:"more",label:"",width:"40px",render:()=>a`<sw-button variant="ghost" size="sm" iconOnly icon="more" label=${s("עוד")}></sw-button>`}];let m=class extends A{constructor(){super(...arguments),this.bubbleSkin=new D(this),this.cases=[],this.canManage=!1,this.loading=!1,this.error="",this.status="all",this.q="",this.creating=!1,this.newTitle="",this.newDesc="",this.newTags="",this.busy=!1,this.canImport=!1,this.importOpen=!1,this.importFile=null,this.importReport=null,this.importBusy=!1,this.importError="",this.forbidden=!1,this.narrow=typeof window<"u"&&window.matchMedia(E).matches,this.onMq=()=>this.narrow=!!this.mq?.matches,this.qTimer=0}connectedCallback(){super.connectedCallback(),this.mq=window.matchMedia(E),this.mq.addEventListener("change",this.onMq),this.narrow=this.mq.matches,f()&&this.load()}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),window.clearTimeout(this.qTimer)}async load(){this.loading=!0,this.error="";try{const t=await lt({status:this.status==="all"?void 0:this.status,q:this.q||void 0});this.cases=t.cases,this.canManage=t.can_manage,this.canImport=!!t.can_import,this.forbidden=!1}catch(t){this.forbidden=t instanceof _&&t.status===403,this.error=v(t)}finally{this.loading=!1}}setStatus(t){this.status=t,this.load()}onQuery(t){this.q=t,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>void this.load(),250)}async create(){if(this.newTitle.trim()){this.busy=!0,this.error="";try{const t=await dt({title:this.newTitle.trim(),description:this.newDesc,tags:this.newTags.split(",").map(e=>e.trim()).filter(Boolean)});this.creating=!1,this.newTitle=this.newDesc=this.newTags="",w(`/investigate/cases/${t.id}`)}catch(t){this.error=v(t)}finally{this.busy=!1}}}pickImport(){const t=this.renderRoot.querySelector("[data-bundle-import-file]");t&&(t.value="",t.click())}async onImportFile(t){if(t){this.importFile=t,this.importReport=null,this.importError="",this.importOpen=!0,this.importBusy=!0;try{this.importReport=await N(t)}catch(e){this.importError=v(e)}finally{this.importBusy=!1}}}async importNow(){if(this.importFile){this.importBusy=!0,this.importError="";try{const t=await ct(this.importFile);this.importOpen=!1,this.importFile=null,w(`/investigate/cases/${t.case.id}`)}catch(t){this.importError=v(t),t instanceof _&&t.code==="already_imported"&&this.importReport&&(this.importReport={...this.importReport,importable:!1,already_imported:{case_id:String(t.body.details.case_id??""),title:String(t.body.details.title??"")}})}finally{this.importBusy=!1}}}renderImportDialog(){const t=this.importReport,e=this.importFile,i=t?.origin,p=c=>c?y(c):"—",d=i?pt[T(i)]:"—",u=t?.already_imported;return a`<sw-dialog open heading=${s("ייבוא חבילת ראיות")} subheading=${e?`${e.name} · ${b(e.size)}`:""} data-bundle-import-dialog @close=${()=>this.importOpen=!1}>
      ${this.importBusy&&!t?a`<sw-state-panel state="loading" heading=${s("מאמת את החבילה…")} hint=${s("כל קובץ מגובב מחדש ומושווה ל־manifest; שום דבר עוד לא יובא")}></sw-state-panel>`:r}
      ${this.importError?a`<div class="err" data-import-error role="alert">${this.importError}</div>`:r}
      ${t?a`<div class="verdict" data-import-summary data-ok=${String(t.ok)}>${t.summary??(t.ok?s("החבילה אומתה."):s("האימות נכשל."))}</div>
            <div class="kv" data-import-origin>
              <span>${s("תיק במקור")}</span><strong>${t.case??"—"}</strong>
              <span>${s("יוצא")}</span><strong>${p(i?.exported_at)}${i?.exported_by_display||i?.exported_by?` · ${s("על ידי {name}",{name:i?.exported_by_display||i?.exported_by||""})}`:""}</strong>
              <span>${s("הופקה ב־")}</span><strong data-import-producer data-this-installation=${String(i?.this_installation??"unknown")} data-producer=${T(i)}>${d}${i?.installation_id?a` · <span class="ltr">${i.installation_id}</span>`:r}</strong>
              <span>${s("גרסה")}</span><strong><span class="ltr">Arx ${i?.app_version??"?"} · manifest v${t.schema_version??"?"}</span>${t.supported===!1?` · ${s("לא נתמכת")}`:""}</strong>
              <span>${s("חתימה")}</span><strong data-import-signature>${S(t.signature)}</strong>
              <span>${s("SHA-256 של החבילה")}</span><strong class="ltr" title=${t.bundle?.sha256??""}>${U(t.bundle?.sha256)}</strong>
            </div>
            ${t.files.length||t.extra.length?a`<div class="files" data-import-files>
                  ${t.files.map(c=>a`<div class="r" data-import-file data-status=${c.status}><span class="path" title=${c.path}>${c.path}</span><sw-badge kind=${vt[c.status]} label=${mt[c.status]}></sw-badge><span class="hint ltr">${c.bytes==null?"—":b(c.bytes)}</span></div>`)}
                  ${t.extra.map(c=>a`<div class="r" data-import-file data-status="extra"><span class="path" title=${c}>${c}</span><sw-badge kind="error" label=${s("לא ב־manifest")}></sw-badge><span></span></div>`)}
                </div>`:r}
            ${u?a`<div class="hint" data-import-duplicate>${s('החבילה הזו כבר יובאה לתיק "{title}".',{title:u.title})} <sw-button size="sm" variant="ghost" @click=${()=>{this.importOpen=!1,w(`/investigate/cases/${u.case_id}`)}}>${s("פתח את התיק הקיים")}</sw-button></div>`:r}
            ${this.canImport?r:a`<div class="hint">${s("ייבוא כתיק דורש הרשאת ניהול תיקים לכל ההתקנה; אימות מותר לכל מי שקורא תיקים.")}</div>`}
            <div class="hint">${t.authenticity??""} ${s("ייבוא יוצר תיק חדש לקריאה בלבד: שום דבר מהחבילה לא הופך למצלמה, לתוכנית, למשתמש או להגדרה.")}</div>`:r}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.importOpen=!1}>${s("סגור")}</sw-button>
      ${this.canImport?a`<sw-button slot="footer" variant="primary" icon="upload" data-bundle-import-confirm ?disabled=${this.importBusy||!t?.importable} @click=${()=>this.importNow()}>${s("ייבא כתיק")}</sw-button>`:r}
    </sw-dialog>`}renderList(t){return this.loading&&!this.cases.length?a`<sw-state-panel state="loading"></sw-state-panel>`:this.forbidden&&!this.cases.length?a`<sw-state-panel state="forbidden" hint=${s("רשימת התיקים דורשת הרשאת קריאת תיקים.")}></sw-state-panel>`:this.error&&!this.cases.length?a`<sw-state-panel state="error" hint=${this.error} actionLabel=${s("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`:!this.cases.length&&(this.q||this.status!=="all")?a`<sw-state-panel icon="case" state="empty" heading=${s("לא נמצאו תיקים")} hint=${this.q?`${s("אין תיק שמתאים ל„{q}”",{q:this.q})}${this.status!=="all"?` ${s("בסטטוס {status}",{status:$[this.status]})}`:""}.`:s("אין תיקים בסטטוס {status}.",{status:$[this.status]})} actionLabel=${s("הצג את כל התיקים")} data-cases-no-match @action=${()=>{this.q="",this.setStatus("all")}}></sw-state-panel>`:this.cases.length?a`<sw-table data-cases-table .columns=${this.narrow?yt:bt} .rows=${t} @row-select=${e=>w(`/investigate/cases/${e.detail.id}`)}></sw-table>`:a`<sw-state-panel icon="case" state="empty" heading=${s("אין תיקים עדיין")} hint=${s("פתח תיק מדף אירוע, מהנגן או מהמפה ההיסטורית (הוסף לתיק), או כאן.")}></sw-state-panel>`}renderApi(){const t=this.cases.map(e=>({id:e.id,title:e.title,status:e.status,owner:e.owner_username,items:e.counts.items,clips:e.counts.events+e.counts.clips,preserved:e.counts.preserved,updated:e.updated_at,tags:e.tags.join(" · "),imported:e.origin==="imported"}));return a`
      <sw-page heading=${s("תיקים")} subheading=${s("קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת מהמקליט")}>
        <sw-button slot="actions" icon="upload" data-bundle-import @click=${()=>this.pickImport()}>${s("ייבוא חבילת ראיות")}</sw-button>
        ${this.canManage?a`<sw-button slot="actions" variant="primary" icon="plus" data-case-new @click=${()=>this.creating=!0}>${s("תיק חדש")}</sw-button>`:r}
        <input type="file" accept=".zip,application/zip" hidden data-bundle-import-file @change=${e=>void this.onImportFile(e.target.files?.[0])} />
        <div class="bar" role="toolbar" aria-label=${s("סינון תיקים")}>
          ${["all","open","in_review","closed"].map(e=>a`<sw-chip ?selected=${this.status===e} aria-pressed=${String(this.status===e)} data-case-status-filter=${e} @click=${()=>this.setStatus(e)}>${e==="all"?s("הכל"):$[e]}</sw-chip>`)}
          ${this.cases.length&&!this.loading?a`<span class="count" data-case-count aria-live="polite">${s("{n} תיקים",{n:this.cases.length})}</span>`:r}
          <span class="grow"></span>
          <sw-field><input type="search" placeholder=${s("חיפוש בכותרת, תיאור ותגיות")} aria-label=${s("חיפוש תיקים")} .value=${this.q} @input=${e=>this.onQuery(e.target.value)} @keydown=${e=>{e.key==="Escape"&&this.q&&(e.stopPropagation(),this.onQuery(""))}} /></sw-field>
        </div>
        ${this.error&&this.cases.length?a`<div class="err" role="alert">${this.error}</div>`:r}
        ${this.renderList(t)}
        ${this.creating?a`<sw-dialog open heading=${s("תיק חדש")} subheading=${s("כותרת קצרה; פריטים נוספים מדפי האירוע, הנגן והמפה")} data-case-create @close=${()=>this.creating=!1}>
              <sw-field label=${s("כותרת")}><input data-case-title .value=${this.newTitle} @input=${e=>this.newTitle=e.target.value} /></sw-field>
              <sw-field label=${s("תיאור")}><textarea rows="3" .value=${this.newDesc} @input=${e=>this.newDesc=e.target.value}></textarea></sw-field>
              <sw-field label=${s("תגיות (מופרדות בפסיק)")}><input .value=${this.newTags} @input=${e=>this.newTags=e.target.value} /></sw-field>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.creating=!1}>${s("ביטול")}</sw-button>
              <sw-button slot="footer" variant="primary" icon="plus" data-case-create-confirm ?disabled=${this.busy||!this.newTitle.trim()} @click=${()=>this.create()}>${s("צור תיק")}</sw-button>
            </sw-dialog>`:r}
        ${this.importOpen?this.renderImportDialog():r}
      </sw-page>
    `}render(){return f()?this.renderApi():a`
      <sw-page heading=${s("תיקים")} subheading=${s("קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת ו־hash · נתוני הדגמה")}>
        <sw-button slot="actions" variant="primary" icon="plus">${s("תיק חדש")}</sw-button>
        <sw-table .columns=${xt} .rows=${z} @row-select=${t=>w(`/investigate/cases/${t.detail.id}`)}></sw-table>
      </sw-page>
    `}};m.styles=[q`
    /* INVREST-POLISH-2331: from a tablet up the screen takes the height the shell leaves it and never scrolls; the list scrolls in its
       own box under a sticky header. A phone keeps the page scroll (the rows are cards there). */
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
      min-inline-size: 0;
    }
    sw-page {
      flex: 1;
      min-block-size: 0;
    }
    sw-table {
      flex: 0 1 auto;
      min-block-size: 0;
      --sw-table-cell-pad: 10px 14px;
    }
    @media (min-width: 768px) {
      sw-page {
        block-size: 100%;
      }
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      flex: none;
    }
    .bar sw-field {
      inline-size: 280px;
    }
    .count {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
      margin-inline-start: 6px;
    }
    .grow {
      flex: 1;
    }
    @media (max-width: 767px) {
      .bar sw-field {
        inline-size: 100%;
        order: 3;
      }
      .bar .grow {
        display: none;
      }
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      margin-block-end: 8px;
    }
    .verdict {
      border-radius: var(--sw-r-sm);
      padding: 8px 10px;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface-2);
    }
    .verdict[data-ok='true'] {
      border-color: var(--sw-success);
    }
    .verdict[data-ok='false'] {
      border-color: var(--sw-danger);
    }
    .kv {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 3px 10px;
      font-size: var(--sw-fs-xs);
    }
    .kv > span {
      color: var(--sw-text-3);
    }
    .kv strong {
      font-weight: var(--sw-fw-medium);
      overflow-wrap: anywhere;
    }
    .files {
      max-block-size: 220px;
      overflow: auto;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
    }
    .files .r {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px;
      align-items: center;
      padding: 4px 8px;
      font-size: var(--sw-fs-xs);
      border-block-end: 1px solid var(--sw-border);
    }
    .files .r:last-child {
      border-block-end: 0;
    }
    .files .path {
      direction: ltr;
      unicode-bidi: isolate;
      text-align: start;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--sw-font-mono);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    ${R}
  `,O,P];n([l()],m.prototype,"cases",2);n([l()],m.prototype,"canManage",2);n([l()],m.prototype,"loading",2);n([l()],m.prototype,"error",2);n([l()],m.prototype,"status",2);n([l()],m.prototype,"q",2);n([l()],m.prototype,"creating",2);n([l()],m.prototype,"newTitle",2);n([l()],m.prototype,"newDesc",2);n([l()],m.prototype,"newTags",2);n([l()],m.prototype,"busy",2);n([l()],m.prototype,"canImport",2);n([l()],m.prototype,"importOpen",2);n([l()],m.prototype,"importFile",2);n([l()],m.prototype,"importReport",2);n([l()],m.prototype,"importBusy",2);n([l()],m.prototype,"importError",2);n([l()],m.prototype,"forbidden",2);n([l()],m.prototype,"narrow",2);m=n([B("investigate-cases")],m);let h=class extends A{constructor(){super(...arguments),this.bubbleSkin=new D(this),this.caseId="case-1",this.tab="details",this.data=null,this.error="",this.info="",this.busy=!1,this.tz="Asia/Jerusalem",this.noteText="",this.editing=!1,this.editTitle="",this.editDesc="",this.editTags="",this.confirmDelete=!1,this.bundles=[],this.verifyResult=null,this.cams=[],this.snapCam="",this.integrity=null,this.loadedFor="",this.pollTimer=0}updated(t){t.has("caseId")&&f()&&this.loadedFor!==this.caseId&&this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.pollTimer)}async load(){const t=this.caseId;this.loadedFor=t,this.error="";try{const[e,i]=await Promise.all([j(),Y(t)]);if(this.caseId!==t)return;this.tz=e["time.zone"]??this.tz,this.data=i;const p=(await X(t).catch(()=>({bundles:[]}))).bundles;if(this.caseId!==t||(this.bundles=p,!this.cams.length&&(this.cams=(await H().catch(()=>({cameras:[]}))).cameras.filter(d=>d.enabled&&d.recorder_enabled!==!1),!this.snapCam&&this.cams[0]&&(this.snapCam=this.cams[0].id),this.caseId!==t)))return;window.clearTimeout(this.pollTimer),i.items.some(d=>d.preservation==="preserving")&&(this.pollTimer=window.setTimeout(()=>void this.load(),5e3))}catch(e){if(this.caseId!==t)return;this.error=v(e)}}fmt(t){return L(new Date(t),{timeZone:this.tz,seconds:!0})}async run(t,e=""){this.busy=!0,this.error="";try{await t(),this.info=e,await this.load(),e&&setTimeout(()=>this.info="",4e3)}catch(i){this.error=v(i),i instanceof _&&i.status===409&&await this.load()}finally{this.busy=!1}}patchCase(t){const e=this.data;e&&this.run(async()=>{await tt(e.id,{revision:e.revision,...t})})}async verify(t){if(t){this.verifyResult=null,this.busy=!0,this.error="";try{this.verifyResult=await N(t)}catch(e){this.error=v(e)}finally{this.busy=!1}}}renderBundleCard(t){const e=this.verifyResult;return a`<sw-card heading=${s("חבילת ראיות")} subheading=${s("ZIP עם הקטעים השמורים, התמונות, ההערות, manifest עם SHA-256 לכל קובץ ודוח קריא")} data-bundle>
      ${t.can_manage?a`<sw-button size="sm" variant="primary" icon="download" data-bundle-create ?disabled=${this.busy} @click=${()=>void this.run(async()=>{await st(t.id)},s('החבילה נוצרה; פריטים שאינם עותק שמור מופיעים בה כ"לא נכללו"'))}>${s("צור חבילת ראיות")}</sw-button>`:r}
      ${this.bundles.length?a`<div class="items" style="margin-block-start:8px">${this.bundles.map(i=>a`<div class="item" data-bundle-row style="grid-template-columns:minmax(0,1fr) auto"><div class="body"><strong class="ltr">${i.name}</strong><span class="meta">${b(i.bytes)} · ${this.fmt(i.created_at)}${i.signed?` · ${s("חתום · מפתח {kid}",{kid:i.signed})}`:` · ${s("ללא חתימה")}`}</span></div><div class="acts"><a href=${et(t.id,i.name)} download><sw-button size="sm" icon="download">${s("הורדה")}</sw-button></a></div></div>`)}</div>`:a`<div class="hint" style="margin-block-start:6px">${s("עדיין לא נוצרה חבילה לתיק הזה.")}</div>`}
      <div class="composer"><sw-field label=${s("אימות חבילה (בחר קובץ ZIP שהורד)")}><input type="file" accept=".zip,application/zip" data-bundle-verify-file @change=${i=>void this.verify(i.target.files?.[0])} /></sw-field></div>
      ${e?a`<div class="note" data-bundle-verify-result>${e.ok?`${s("החבילה אומתה: {n} קבצים תואמים ל־manifest",{n:e.files.length})}${e.case?` · ${s('תיק "{title}"',{title:e.case})}`:""}`:`${s("האימות נכשל")}${e.errors.length?`: ${e.errors.join(", ")}`:""}`}
            ${e.files.some(i=>i.status!=="ok")||e.extra.length?a`<ul class="hint" style="margin:4px 0 0;padding-inline-start:18px">${e.files.filter(i=>i.status!=="ok").map(i=>a`<li class="ltr">${i.path}: ${i.status}</li>`)}${e.extra.map(i=>a`<li class="ltr">${i}: extra</li>`)}</ul>`:r}
            ${e.signature?a`<div data-bundle-signature data-signature-trust=${e.signature.trust}>${S(e.signature)}</div>`:r}
            ${e.summary?a`<div class="hint" style="margin-block-start:4px" data-bundle-verify-summary>${e.summary}</div>`:r}
            ${e.authenticity?a`<div class="hint" style="margin-block-start:4px">${e.authenticity}</div>`:r}
          </div>`:r}
      <details class="more" data-bundle-proof><summary>${s("מה החבילה מוכיחה")}</summary><div class="hint" style="margin-block-start:6px">${s("SHA-256 מוכיח שכל קובץ לא השתנה מאז יצירת החבילה; חתימת Ed25519 על ה־manifest מוכיחה שהחבילה לא שונתה מאז הייצוא על ידי מחזיק המפתח של המתקן (integrity-at-export). אף אחד מהם אינו מוכיח את אמיתות הצילום במקור (capture authenticity), ואין כאן הצהרה על קבילות משפטית. אימות מחוץ למערכת: scripts/verify_bundle.py.")}</div></details>
    </sw-card>`}async recheck(t){this.busy=!0,this.error="";try{this.integrity=await at(t.id)}catch(e){this.error=v(e)}finally{this.busy=!1}}renderProvenance(t){const e=t.provenance;if(t.origin!=="imported"||!e)return r;const i=T(e),p={this_confirmed:s("מהתקנה זו (מאושר בחתימה)"),this_claimed:s("לכאורה מהתקנה זו — לפי המזהה בלבד, לא מאושר בחתימה"),other:s("מהתקנה אחרת"),unknown:s("מהתקנה לא ידועה")}[i],d=this.integrity;return a`<sw-card data-case-provenance data-this-installation=${String(e.this_installation??"unknown")} data-producer=${i}>
      <div class="prov">
        <sw-icon name="shield" size=${18}></sw-icon>
        <div class="body">
          <strong data-provenance-headline>${s("יובא {where} ב־{time}; hash {match} ({n} קבצים נבדקו בייבוא)",{where:p,time:this.fmt(e.imported_at),match:e.verification.ok?s("תואם"):s("לא תואם"),n:e.verification.files})}</strong>
          <span class="meta">${s('במקור: "{title}"',{title:e.source_case.title??"—"})} · ${s("יוצא {time}",{time:e.exported_at?this.fmt(e.exported_at):"—"})}${e.exported_by_display||e.exported_by?` ${s("על ידי {name}",{name:e.exported_by_display||e.exported_by||""})}`:""} · Arx ${e.source_app_version??"?"}</span>
          <span class="meta">${s("התקנת מקור")} <span class="ltr">${e.source_installation_id??"—"}</span> · ${S({present:e.signature.present,valid:e.signature.valid,kid:e.signature.kid,known:e.signature.known,retired:e.signature.retired,trust:e.signature.trust})}</span>
          <span class="meta">${s("חבילה")} <span class="ltr" title=${e.bundle_sha256}>SHA-256 ${U(e.bundle_sha256)}</span> · ${b(e.bundle_bytes)} · ${s("יובא על ידי {name}",{name:e.imported_by??"—"})}${e.skipped_at_source?` · ${s("{n} פריטים לא נכללו כבר במקור",{n:e.skipped_at_source})}`:""}</span>
          ${d?a`<span class=${d.ok?"ok":"err"} data-case-integrity-result data-ok=${String(d.ok)}>${d.ok?d.files.length?s("בדיקה חוזרת {time}: hash תואם — {n} קבצים לא השתנו מאז הייבוא",{time:this.fmt(d.checked_at),n:d.files.length}):s("בדיקה חוזרת {time}: אין בתיק קבצים שמורים לבדוק",{time:this.fmt(d.checked_at)}):s("בדיקה חוזרת {time}: hash לא תואם — {n} מתוך {total} קבצים שונו או חסרים",{time:this.fmt(d.checked_at),n:d.files.filter(u=>u.status!=="ok").length,total:d.files.length})}</span>`:r}
          <span class="hint">${s("התאמת hash מוכיחה שהקבצים לא שונו מאז הייצוא; היא אינה מוכיחה שהצילום אמיתי. פריטים מיובאים הם לקריאה בלבד; מחיקת התיק מסירה גם את הקבצים המיובאים.")}</span>
        </div>
        <sw-button size="sm" icon="refresh" data-case-integrity ?disabled=${this.busy} @click=${()=>void this.recheck(t)}>${s("בדיקת hash חוזרת")}</sw-button>
      </div>
    </sw-card>`}renderItem(t,e){const i=t.kind==="event"?`${s("אירוע")} · ${G[t.event?.type??"other"]??t.event?.type??""}`:t.kind==="clip"?s("קטע הקלטה"):t.kind==="snapshot"?s("תמונה"):s("הערה"),p=t.preservation,d=t.kind==="event"&&t.event?t.event.occurred_at:t.from_at,u=t.kind==="note"?a`<div class="thumb"><sw-icon name="edit" size=${18}></sw-icon></div>`:t.kind==="snapshot"&&t.file_path?a`<img class="thumb" src=${C(e.id,t.id)} alt=${s("תמונה מהמצלמה")} />`:t.imported?a`<div class="thumb"><sw-icon name=${t.file_path?"case":"bookmark"} size=${18}></sw-icon></div>`:t.kind==="event"&&t.event?.thumbnail==="ready"&&t.event_id?a`<img class="thumb" src=${Q(t.event_id)} alt="" />`:t.camera_id&&d?a`<img class="thumb" src=${W(t.camera_id,d)} alt="" @error=${o=>o.target.style.visibility="hidden"} />`:a`<div class="thumb"></div>`,c=t.origin;return a`<div class="item" data-case-item data-kind=${t.kind} data-preservation=${p} ?data-imported=${!!t.imported}>
      ${u}
      <div class="body">
        <div class="head"><strong>${i}</strong>${t.camera_name?a`<span>· ${t.camera_name}${t.imported?` ${s("(מצלמת המקור)")}`:""}</span>`:r}${p!=="none"?a`<sw-badge kind=${wt[p]} label=${it[p]}></sw-badge>`:r}${t.imported?a`<sw-badge kind="historic" label=${s("מיובא · לקריאה בלבד")}></sw-badge>`:r}</div>
        ${t.from_at&&t.to_at?a`<div class="range ltr">${this.fmt(t.from_at)} → ${this.fmt(t.to_at)}</div>`:r}
        ${t.note?a`<div>${t.note}</div>`:r}
        <div class="meta">${c?`${s("במקור: {name}",{name:c.added_by??"—"})}${c.created_at?` · ${this.fmt(c.created_at)}`:""} · ${s("יובא על ידי {name}",{name:t.added_by_username})}${p==="missing"?` · ${s("הקובץ המיובא חסר בדיסק")}`:""}`:a`${t.added_by_username} · ${this.fmt(t.created_at)}${t.export?.error?` · ${s("ייצוא: {error}",{error:t.export.error})}`:""}${p==="missing"?` · ${s("לא ניתן לשמר: ההקלטה כבר לא במקליט")}`:""}`}</div>
      </div>
      <div class="acts">
        ${t.camera_id&&d&&t.kind!=="snapshot"?a`<sw-button size="sm" icon="play" @click=${()=>w("/investigate/playback",{camera:t.camera_id??"",t:d})}>${s("נגן")}</sw-button>`:r}
        ${(t.kind==="snapshot"||t.imported)&&t.file_sha256?a`<span class="meta ltr" title="SHA-256">${t.file_sha256.slice(0,12)}…</span>`:r}
        ${t.imported&&t.file_path&&t.kind!=="snapshot"?a`<a href=${C(e.id,t.id)} download data-item-file><sw-button size="sm" variant="ghost" icon="download">${s("הורדה")}</sw-button></a>`:r}
        ${t.event_id?a`<sw-button size="sm" variant="ghost" icon="bell" @click=${()=>w(`/investigate/events/${t.event_id}`)}>${s("אירוע")}</sw-button>`:r}
        ${e.can_manage&&t.kind!=="note"&&(p==="nvr_only"||p==="unknown")?a`<sw-button size="sm" icon="download" data-item-preserve ?disabled=${this.busy} @click=${()=>void this.run(()=>rt(e.id,t.id).then(()=>{}),s("עבודת שימור נוצרה; הפריט יסומן כשמור כשההעתקה תסתיים"))}>${s("שמור עותק")}</sw-button>`:r}
        ${t.export?.download_ready?a`<a href=${J(t.export.id)} download><sw-button size="sm" variant="ghost" icon="download">${s("הורדה")}</sw-button></a>`:r}
        ${e.can_manage&&!t.imported?a`<sw-button size="sm" variant="ghost" iconOnly icon="close" label=${s("הסר מהתיק")} data-item-remove ?disabled=${this.busy} @click=${()=>void this.run(()=>nt(e.id,t.id).then(()=>{}))}></sw-button>`:r}
      </div>
    </div>`}renderApi(){if(this.error&&!this.data)return a`<sw-page heading=${s("תיק")}><sw-state-panel state="error" hint=${this.error} actionLabel=${s("נסה שוב")} @action=${()=>this.load()}></sw-state-panel></sw-page>`;const t=this.data;if(!t)return a`<sw-page heading=${s("תיק")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=t.counts,i=t.items.filter(o=>o.preservation==="missing").length,p=t.items.filter(o=>o.preservation==="preserving").length,d=t.items.filter(o=>o.preservation==="nvr_only"||o.preservation==="unknown").length,u=I(t.updated_at)??this.fmt(t.updated_at),c=t.can_manage&&t.status!=="closed";return a`
      <sw-page class="api" heading=${t.title} subheading=${`${$[t.status]} · ${s("בעלים: {name}",{name:t.owner_username})} · ${s("עודכן {time}",{time:u})}`} crumbs=${`${s("חקירה")} | ${s("תיקים")}`} wide>
        ${t.can_manage?a`<sw-field slot="actions"><select aria-label=${s("סטטוס")} data-case-status ?disabled=${this.busy} @change=${o=>this.patchCase({status:o.target.value})}>${Object.keys($).map(o=>a`<option value=${o} ?selected=${o===t.status}>${$[o]}</option>`)}</select></sw-field>
              <sw-button slot="actions" icon="edit" data-case-edit @click=${()=>{this.editTitle=t.title,this.editDesc=t.description,this.editTags=t.tags.join(", "),this.editing=!0}}>${s("עריכה")}</sw-button>
              <sw-button slot="actions" variant="ghost" icon="trash" data-case-delete @click=${()=>this.confirmDelete=!0}>${s("מחיקה")}</sw-button>`:r}
        <sw-button slot="actions" variant="ghost" icon="list" @click=${()=>w("/investigate/cases")}>${s("לרשימת התיקים")}</sw-button>
        ${this.error?a`<div class="err" role="alert" data-case-error>${this.error}</div>`:r}
        ${this.info?a`<div class="ok" role="status" data-case-info>${this.info}</div>`:r}
        <div class="cols">
          <div class="col main">
            ${this.renderProvenance(t)}
            <sw-card heading=${s("ראיות והערות")} subheading=${t.checked?s("מצב השימור נבדק מול המקליט עכשיו"):s("מצב השימור לא נבדק מול המקליט")}>
              <div class="stats" data-case-stats>
                <span class="r5-well"><span class="r5-num">${e.items}</span><span class="r5-sub">${s("פריטים")}</span></span>
                <span class="r5-well" data-tone=${e.preserved?"ok":r}><span class="r5-num">${e.preserved}</span><span class="r5-sub">${s("עותקים שמורים")}</span></span>
                ${p?a`<span class="r5-well"><span class="r5-num">${p}</span><span class="r5-sub">${s("בהעתקה")}</span></span>`:r}
                ${d?a`<span class="r5-well" data-tone="warn"><span class="r5-num">${d}</span><span class="r5-sub">${s("סימנייה בלבד")}</span></span>`:r}
                ${i?a`<span class="r5-well" data-tone="bad"><span class="r5-num">${i}</span><span class="r5-sub">${s("חסרים")}</span></span>`:r}
              </div>
              ${t.items.length?a`<div class="items" data-case-items>${t.items.map(o=>this.renderItem(o,t))}</div>`:a`<div class="hint">${s("עדיין אין פריטים בתיק. הוסף מאירוע, מהנגן או מהמפה ההיסטורית (הוסף לתיק).")}</div>`}
              ${t.hidden_items?a`<div class="hint">${s("{n} פריטים ממצלמות שאינן בהרשאתך אינם מוצגים.",{n:t.hidden_items})}</div>`:r}
              <div class="hint" style="margin-block-start:10px">${s("סימנייה מצביעה על ההקלטה במקליט ואינה שימור: קטע נחשב שמור רק אחרי שעבודת ייצוא העתיקה אותו (sha256 ב־manifest). קטע שהמקליט כבר מחק מוצג כחסר ולעולם לא כשמור.")}</div>
            </sw-card>
          </div>
          <div class="col side">
            ${t.description||t.tags.length?a`<sw-card heading=${s("תיאור")}>${t.description?a`<div class="desc" data-case-description>${t.description}</div>`:r}${t.tags.length?a`<div class="tags">${t.tags.map(o=>a`<sw-chip>${o}</sw-chip>`)}</div>`:r}</sw-card>`:r}
            ${c?a`<sw-card heading=${s("הוספה לתיק")} data-case-composer>
                  <div class="composer" style="margin-block-start:0"><sw-field label=${s("הערה חדשה")}><textarea rows="2" data-note-text .value=${this.noteText} @input=${o=>this.noteText=o.target.value} @keydown=${o=>{o.key==="Enter"&&(o.ctrlKey||o.metaKey)&&this.noteText.trim()&&!this.busy&&this.run(async()=>{await k(t.id,{kind:"note",note:this.noteText.trim()}),this.noteText=""})}}></textarea></sw-field><sw-button size="sm" icon="plus" data-note-add ?disabled=${this.busy||!this.noteText.trim()} @click=${()=>void this.run(async()=>{await k(t.id,{kind:"note",note:this.noteText.trim()}),this.noteText=""})}>${s("הוסף הערה")}</sw-button></div>
                  <div class="composer"><sw-field label=${s("תמונה ממצלמה לתיק (עותק שמור מיידי)")}><select aria-label=${s("מצלמה לצילום")} data-snapshot-camera @change=${o=>this.snapCam=o.target.value}>${this.cams.map(o=>a`<option value=${o.id} ?selected=${o.id===this.snapCam}>${o.name}</option>`)}</select></sw-field><sw-button size="sm" icon="camera" data-snapshot-add ?disabled=${this.busy||!this.snapCam} @click=${()=>void this.run(async()=>{await k(t.id,{kind:"snapshot",camera_id:this.snapCam})},s("התמונה נשמרה בתיק עם ה־hash שלה"))}>${s("צלם תמונה לתיק")}</sw-button></div>
                </sw-card>`:r}
            ${this.renderBundleCard(t)}
          </div>
        </div>
        ${this.editing?a`<sw-dialog open heading=${s("עריכת תיק")} data-case-edit-dialog @close=${()=>this.editing=!1}>
              <sw-field label=${s("כותרת")}><input data-edit-title .value=${this.editTitle} @input=${o=>this.editTitle=o.target.value} /></sw-field>
              <sw-field label=${s("תיאור")}><textarea rows="4" data-edit-description .value=${this.editDesc} @input=${o=>this.editDesc=o.target.value}></textarea></sw-field>
              <sw-field label=${s("תגיות (מופרדות בפסיק)")}><input .value=${this.editTags} @input=${o=>this.editTags=o.target.value} /></sw-field>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.editing=!1}>${s("ביטול")}</sw-button>
              <sw-button slot="footer" variant="primary" icon="check" data-case-edit-save ?disabled=${this.busy||!this.editTitle.trim()} @click=${()=>{this.editing=!1,this.patchCase({title:this.editTitle.trim(),description:this.editDesc,tags:this.editTags.split(",").map(o=>o.trim()).filter(Boolean)})}}>${s("שמירה")}</sw-button>
            </sw-dialog>`:r}
        ${this.confirmDelete?a`<sw-dialog open heading=${s("מחיקת תיק")} subheading=${s("הפריטים בתיק יימחקו; ההקלטות במקליט והעותקים שיוצאו נשארים")} @close=${()=>this.confirmDelete=!1}>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.confirmDelete=!1}>${s("ביטול")}</sw-button>
              <sw-button slot="footer" variant="danger" icon="trash" data-case-delete-confirm ?disabled=${this.busy} @click=${()=>{this.confirmDelete=!1,this.run(async()=>{await ot(t.id),w("/investigate/cases")})}}>${s("מחק תיק")}</sw-button>
            </sw-dialog>`:r}
      </sw-page>
    `}render(){if(f())return this.renderApi();const t=z.find(e=>e.id===this.caseId)??z[0];return a`
      <sw-page heading=${s("סקירת אירוע")} subheading=${`${t.title} · ${s("בעלים: {name}",{name:t.owner})} · ${s("נתוני הדגמה")}`} crumbs=${`${s("אירועים")} | ${s("תיקים")} | 13.09.2026 10:12 | כניסה ראשית`}>
        <sw-field slot="actions"><select aria-label=${s("סטטוס")}><option>${t.status}</option><option>${s("בבדיקה")}</option><option>${s("סגור")}</option></select></sw-field>
        <div class="wrap">
          <div class="video">
            <sw-scene kind="entrance"></sw-scene>
            <span class="stamp">2026-09-13 10:12:04</span>
            <span class="demo">${s("דמו · הקטע ינוגן מהתיק (T050)")}</span>
            <div class="bar">
              <sw-button variant="ghost" size="sm" iconOnly icon="play" label=${s("נגן")}></sw-button>
              <span class="ltr">0:00 / 0:13</span>
              <span class="track"><i></i></span>
              <sw-button variant="ghost" size="sm" iconOnly icon="back10" label=${s("אחורה")}></sw-button>
              <sw-button variant="ghost" size="sm" iconOnly icon="expand" label=${s("מסך מלא")}></sw-button>
            </div>
          </div>
          <div class="clips">
            <div class="clip on"><sw-scene kind="entrance"></sw-scene><span class="t">00:00</span></div>
            <div class="clip"><sw-scene kind="lobby"></sw-scene><span class="t">00:06</span></div>
            <div class="clip missing"><span>${s("מסדרון 10:15")}</span><sw-badge filled kind="error" label=${s("לא שמור: המקליט מחק")}></sw-badge></div>
            <div class="add"><span><sw-icon name="plus" size=${14}></sw-icon> ${s("הוסף קטע")}</span></div>
          </div>
          <sw-tabs .items=${[{id:"details",label:s("פרטים")},{id:"notes",label:s("הערות"),count:2},{id:"related",label:s("מצלמות קשורות"),count:3}]} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
          ${this.tab==="details"?a`<div class="form">
                <div class="stack">
                  <sw-field label=${s("כותרת")}><input value=${t.title} /></sw-field>
                  <sw-field label=${s("תיאור")}><textarea rows="3">אדם נכנס אחרי פתיחת הדלת ב־10:12. לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).</textarea></sw-field>
                </div>
                <div class="pills">
                  <div class="pill"><sw-icon name="calendar" size=${14}></sw-icon>13.09.2026 · 10:12</div>
                  <div class="pill"><sw-icon name="camera" size=${14}></sw-icon>${s("כניסה ראשית · לובי")}</div>
                  <div class="pill"><sw-icon name="shield" size=${14}></sw-icon>${s("2/3 ראיות שמורות · sha256")}</div>
                </div>
              </div>`:this.tab==="notes"?a`<sw-card>
                  <div class="note">נראה אדם נכנס אחרי פתיחת הדלת ב־10:12.<small>יוני · 10:40</small></div>
                  <div class="note">לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).<small>יוסי · 10:52</small></div>
                  <sw-field style="margin-block-start:8px"><textarea rows="2" placeholder=${s("הערה חדשה…")}></textarea></sw-field>
                </sw-card>`:a`<div class="clips">
                  <sw-camera-tile compact name="כניסה ראשית" state="recorded" scene="entrance"></sw-camera-tile>
                  <sw-camera-tile compact name="לובי" state="recorded" scene="lobby"></sw-camera-tile>
                  <sw-camera-tile compact name="מסדרון מזרחי" state="unknown"></sw-camera-tile>
                </div>`}
          <div class="foot">
            <sw-button icon="link">${s("שיתוף")}</sw-button>
            <sw-button variant="primary" icon="download">${s("ייצוא ראיות")}</sw-button>
          </div>
          <div class="hint">${s('Manifest: clips 2/3 · notes 2 · requested/actual ranges · timezone Asia/Jerusalem · pipeline v0.1 · sha256 לכל קובץ. Hash מוכיח התאמה לקובץ שנשמר, לא אותנטיות מאז המצלמה. "מצלמות מוצעות לחקירה" בלבד: אין קביעה שמדובר באותו אדם.')}</div>
        </div>
      </sw-page>
    `}};h.styles=[q`
    /* INVREST-POLISH-2331: the case page (server mode) is two columns from 1000 px up - the evidence list at the start, the case's
       own panel (description, adding a note or a picture, the evidence bundle) at the end - and takes exactly the height the shell
       leaves it: each column scrolls in its own box, the header actions never leave the screen. Narrower: one column, the page
       scrolls (a phone). */
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
      min-inline-size: 0;
    }
    sw-page {
      flex: 1;
      min-block-size: 0;
    }
    .cols {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .cols > .col {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    @media (min-width: 1000px) {
      sw-page.api {
        block-size: 100%;
      }
      .cols {
        flex: 1;
        min-block-size: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) clamp(320px, 30vw, 420px);
        align-items: stretch;
      }
      .cols > .col {
        min-block-size: 0;
        overflow: auto;
        overscroll-behavior: contain;
        /* room for the cards' shadows inside the scroll box */
        padding: 2px 4px 8px;
        margin: -2px -4px 0;
      }
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-end: 10px;
    }
    .stats .r5-well {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      min-block-size: 0;
      padding: 6px 10px;
    }
    .stats .r5-num {
      font-size: var(--sw-fs-lg);
    }
    details.more > summary {
      cursor: pointer;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-start: 8px;
      list-style-position: inside;
    }
    details.more > summary:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
      border-radius: var(--sw-r-2xs);
    }
    /* R5-INVESTIGATE-297 loop 2: the stage is bounded by the viewport height, so the clip row, the tabs and the form stay on
       screen at 1440x900 (the form used to scroll under the fold); the column centres when the height is the limit */
    .wrap {
      max-inline-size: 860px;
      inline-size: min(100%, calc((100dvh - 470px) * 16 / 9));
      min-inline-size: min(100%, 560px);
      margin-inline: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-3);
      color: var(--sw-on-video);
    }
    .video sw-scene {
      position: absolute;
      inset: 0;
    }
    .video .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 10px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .video .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: var(--sw-fs-2xs);
      background: var(--sw-video-scrim);
      border-radius: var(--sw-r-2xs);
      padding: 2px 7px;
    }
    .bar {
      position: absolute;
      inset-inline: 12px;
      inset-block-end: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--sw-video-scrim-strong);
      backdrop-filter: var(--sw-perf-blur, blur(8px));
      border-radius: var(--sw-r-pill);
      padding: 4px 10px;
      font-size: var(--sw-fs-xs);
    }
    .bar sw-button {
      --sw-text-2: #fff;
      --sw-text: #fff;
      --sw-surface-3: rgba(255, 255, 255, 0.14);
    }
    .bar .track {
      flex: 1;
      block-size: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.3);
      overflow: hidden;
    }
    .bar .track i {
      display: block;
      inline-size: 35%;
      block-size: 100%;
      background: #fff;
    }
    .clips {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    /* R5-INVESTIGATE-297: a clip is an object (shadow 2) that sinks on pointer-down; the playing one wears the accent ring */
    .clip {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      cursor: pointer;
      box-shadow: var(--sw-shadow-2);
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    .clip:active {
      transform: scale(var(--sw-press-scale));
    }
    .clip sw-scene {
      position: absolute;
      inset: 0;
    }
    .clip.on {
      box-shadow: 0 0 0 3px var(--sw-accent), var(--sw-shadow-2);
    }
    .clip .t {
      position: absolute;
      inset-inline-start: 6px;
      inset-block-end: 5px;
      color: var(--sw-on-video);
      font-size: var(--sw-fs-2xs);
      font-family: var(--sw-font-mono);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    /* a missing clip is a danger field, not a grey hole: the name reads as a title, the reason as a filled badge */
    .clip.missing {
      background: var(--sw-danger-soft);
      box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--sw-danger) 35%, transparent);
      display: grid;
      place-items: center;
      align-content: center;
      gap: 6px;
      color: var(--sw-heading);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      text-align: center;
      cursor: default;
    }
    .clip.missing:active {
      transform: none;
    }
    .add {
      aspect-ratio: 16 / 9;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      display: grid;
      place-items: center;
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .form {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(200px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pills {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pill {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      min-block-size: 44px;
      border: 0;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
      background: var(--sw-surface-2);
    }
    .pill sw-icon {
      color: var(--sw-accent);
    }
    .foot {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .item {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .item[data-preservation='missing'] {
      border-color: var(--sw-danger);
    }
    .item .thumb {
      inline-size: 112px;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .item .body {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
    }
    .item .head {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .item .range {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .item .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .item .acts {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .composer {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-block-start: 10px;
    }
    .composer sw-field {
      flex: 1;
      min-inline-size: 0;
    }
    /* the side panel is narrow: a composer's field above its button */
    .side .composer {
      flex-direction: column;
      align-items: stretch;
    }
    .side .composer sw-button {
      align-self: flex-end;
    }
    .desc {
      white-space: pre-wrap;
      font-size: var(--sw-fs-sm);
    }
    .tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 6px;
    }
    ${V}
    ${K}
    ${R}
    @media (max-width: 767px) {
      .item {
        grid-template-columns: 1fr;
      }
      .item .thumb {
        inline-size: 100%;
      }
    }
    .note {
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .note small {
      color: var(--sw-text-3);
      display: block;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .prov {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 10px;
      align-items: start;
    }
    .prov > sw-icon {
      color: var(--sw-accent);
    }
    .prov .body {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .prov .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      overflow-wrap: anywhere;
    }
    @media (max-width: 767px) {
      .prov {
        grid-template-columns: auto minmax(0, 1fr);
      }
      .prov > sw-button {
        grid-column: 1 / -1;
      }
      .clips {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .form {
        grid-template-columns: 1fr;
      }
    }
  `,O,P];n([Z()],h.prototype,"caseId",2);n([l()],h.prototype,"tab",2);n([l()],h.prototype,"data",2);n([l()],h.prototype,"error",2);n([l()],h.prototype,"info",2);n([l()],h.prototype,"busy",2);n([l()],h.prototype,"tz",2);n([l()],h.prototype,"noteText",2);n([l()],h.prototype,"editing",2);n([l()],h.prototype,"editTitle",2);n([l()],h.prototype,"editDesc",2);n([l()],h.prototype,"editTags",2);n([l()],h.prototype,"confirmDelete",2);n([l()],h.prototype,"bundles",2);n([l()],h.prototype,"verifyResult",2);n([l()],h.prototype,"cams",2);n([l()],h.prototype,"snapCam",2);n([l()],h.prototype,"integrity",2);h=n([B("investigate-case-detail")],h);export{h as InvestigateCaseDetail,m as InvestigateCases};
