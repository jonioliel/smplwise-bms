import{a as E,S as R,i as f,J as V,px as j,R as w,b4 as A,j as k,A as i,e,pB as M,pD as U,aj as u,sz as _,C as D,E as N,G as o,F as H,H as O}from"./index-D0R90ECk.js";import"./sw-table-BFyhti5o.js";import"./sw-chip-B3vbD_Km.js";import{f as K}from"./recordings-BKR8Oy2-.js";import{f as b,a as G}from"./exports-BP8sqrg2.js";import{g as Z,e as J,u as Q,v as B,f as W,h as X,i as Y,p as z,j as C,P as ss,k as ts,r as es,C as v,d as x,m as as,a as is,b as rs,n as ns,o as os,F as ls}from"./cases-4cXrF3oj.js";import{I as q}from"./investigate-r5-css-eYJgcmvO.js";import{a as S}from"./investigate-time-CzLs0TRB.js";import"./sw-logo-art-Va6y_cIM.js";var ds=Object.defineProperty,cs=Object.getOwnPropertyDescriptor,r=(s,t,a,d)=>{for(var l=d>1?void 0:d?cs(t,a):t,m=s.length-1,c;m>=0;m--)(c=s[m])&&(l=(d?c(t,a,l):c(l))||l);return d&&l&&ds(t,a,l),l};const L={open:"stale",in_review:"recorded",closed:"neutral"},ps={preserved:"recorded",preserving:"partial",nvr_only:"stale",missing:"error",unknown:"unknown",not_in_bundle:"neutral",none:"neutral"},hs={ok:"recorded",mismatch:"error",missing:"error",corrupt:"error"},P=s=>s?`${s.slice(0,12)}…`:"—";function T(s){return!s||!s.present?"ללא חתימה (חבילה מגרסה ישנה, או שהחתימה הוסרה) — נבדקו רק הגיבובים.":s.valid?`חתימה תקינה · Ed25519 · מפתח ${s.kid}${s.trust==="installation"?s.retired?" · מפתח שהוחלף, מוכר למתקן זה":" · המפתח הפעיל של מתקן זה":" · מפתח שאינו מוכר למתקן זה — שלמות בלבד, לא אמון"}`:`חתימה לא תקינה${s.reason?` (${s.reason})`:""} — ה־manifest שונה אחרי הייצוא או שהחתימה זויפה.`}const $=(s,t)=>A(new Date(s),{timeZone:t}),ms="font-size:var(--sw-fs-md);font-weight:var(--sw-fw-semibold);color:var(--sw-heading);text-decoration:none;border-radius:var(--sw-r-2xs);outline-offset:2px",y="font-size:var(--sw-fs-xs);color:var(--sw-text-3);line-height:1.4",g="font-variant-numeric:tabular-nums",F=s=>e`<a href=${`#/investigate/cases/${String(s.id)}`} style=${ms} data-case-link @click=${t=>t.stopPropagation()}>${String(s.title)}</a>${s.imported?e` <sw-badge kind="historic" label="מיובא" data-case-imported></sw-badge>`:i}`,us=s=>{const t=String(s.updated),a=S(t);return e`<div style=${`${g};color:var(--sw-heading)`}>${a??$(t)}</div>${a?e`<div style=${`${y};${g}`}><span style="direction:ltr;unicode-bidi:isolate">${$(t)}</span></div>`:i}`},ws=s=>{const t=Number(s.preserved),a=Number(s.clips);return e`<span style=${`${g};font-weight:var(--sw-fw-semibold);color:var(--sw-heading)`}>${t}</span><span style=${`${g};color:var(--sw-text-3)`}> / ${a}</span>`},vs=[{key:"title",label:"תיק",render:s=>e`${F(s)}${s.tags?e`<div style=${y}>${String(s.tags)}</div>`:i}`},{key:"status",label:"סטטוס",width:"120px",render:s=>e`<sw-badge filled kind=${L[s.status]} label=${v[s.status]}></sw-badge>`},{key:"owner",label:"בעלים",width:"120px"},{key:"items",label:"פריטים",width:"90px",render:s=>e`<span style=${g}>${String(s.items)}</span>`},{key:"preserved",label:"עותקים שמורים",width:"130px",render:ws},{key:"updated",label:"עודכן",width:"170px",render:us}],gs=[{key:"title",label:"תיק",render:s=>e`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${F(s)}<sw-badge filled kind=${L[s.status]} label=${v[s.status]}></sw-badge></div>
      <div style=${`${y};${g};margin-block-start:2px`}>${String(s.owner)} · ${String(s.items)} פריטים · ${String(s.preserved)}/${String(s.clips)} שמורים · ${S(String(s.updated))??$(String(s.updated))}</div>
      ${s.tags?e`<div style=${y}>${String(s.tags)}</div>`:i}`}],I="(max-width: 767px)",fs=[{key:"title",label:"תיק",render:s=>e`<strong style="font-size:var(--sw-fs-md);color:var(--sw-heading)">${String(s.title)}</strong>`},{key:"status",label:"סטטוס",render:s=>e`<sw-badge filled kind=${s.status==="פתוח"?"stale":s.status==="סגור"?"offline":"recorded"} label=${String(s.status)}></sw-badge>`},{key:"owner",label:"בעלים"},{key:"clips",label:"קטעים"},{key:"notes",label:"הערות"},{key:"preserved",label:"ראיות שמורות",render:s=>e`${s.preserved} שמורות${Number(s.missing)?e` <sw-badge filled kind="error" label=${`${s.missing} חסרות`} style="margin-inline-start:6px"></sw-badge>`:""}`},{key:"more",label:"",width:"40px",render:()=>e`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}];let p=class extends E{constructor(){super(...arguments),this.bubbleSkin=new R(this),this.cases=[],this.canManage=!1,this.loading=!1,this.error="",this.status="all",this.q="",this.creating=!1,this.newTitle="",this.newDesc="",this.newTags="",this.busy=!1,this.canImport=!1,this.importOpen=!1,this.importFile=null,this.importReport=null,this.importBusy=!1,this.importError="",this.forbidden=!1,this.narrow=typeof window<"u"&&window.matchMedia(I).matches,this.onMq=()=>this.narrow=!!this.mq?.matches,this.qTimer=0}connectedCallback(){super.connectedCallback(),this.mq=window.matchMedia(I),this.mq.addEventListener("change",this.onMq),this.narrow=this.mq.matches,f()&&this.load()}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),window.clearTimeout(this.qTimer)}async load(){this.loading=!0,this.error="";try{const s=await is({status:this.status==="all"?void 0:this.status,q:this.q||void 0});this.cases=s.cases,this.canManage=s.can_manage,this.canImport=!!s.can_import,this.forbidden=!1}catch(s){this.forbidden=s instanceof k&&s.status===403,this.error=w(s)}finally{this.loading=!1}}setStatus(s){this.status=s,this.load()}onQuery(s){this.q=s,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>void this.load(),250)}async create(){if(this.newTitle.trim()){this.busy=!0,this.error="";try{const s=await rs({title:this.newTitle.trim(),description:this.newDesc,tags:this.newTags.split(",").map(t=>t.trim()).filter(Boolean)});this.creating=!1,this.newTitle=this.newDesc=this.newTags="",u(`/investigate/cases/${s.id}`)}catch(s){this.error=w(s)}finally{this.busy=!1}}}pickImport(){const s=this.renderRoot.querySelector("[data-bundle-import-file]");s&&(s.value="",s.click())}async onImportFile(s){if(s){this.importFile=s,this.importReport=null,this.importError="",this.importOpen=!0,this.importBusy=!0;try{this.importReport=await B(s)}catch(t){this.importError=w(t)}finally{this.importBusy=!1}}}async importNow(){if(this.importFile){this.importBusy=!0,this.importError="";try{const s=await ns(this.importFile);this.importOpen=!1,this.importFile=null,u(`/investigate/cases/${s.case.id}`)}catch(s){this.importError=w(s),s instanceof k&&s.code==="already_imported"&&this.importReport&&(this.importReport={...this.importReport,importable:!1,already_imported:{case_id:String(s.body.details.case_id??""),title:String(s.body.details.title??"")}})}finally{this.importBusy=!1}}}renderImportDialog(){const s=this.importReport,t=this.importFile,a=s?.origin,d=c=>c?$(c):"—",l=a?os[z(a)]:"—",m=s?.already_imported;return e`<sw-dialog open heading="ייבוא חבילת ראיות" subheading=${t?`${t.name} · ${b(t.size)}`:""} data-bundle-import-dialog @close=${()=>this.importOpen=!1}>
      ${this.importBusy&&!s?e`<sw-state-panel state="loading" heading="מאמת את החבילה…" hint="כל קובץ מגובב מחדש ומושווה ל־manifest; שום דבר עוד לא יובא"></sw-state-panel>`:i}
      ${this.importError?e`<div class="err" data-import-error role="alert">${this.importError}</div>`:i}
      ${s?e`<div class="verdict" data-import-summary data-ok=${String(s.ok)}>${s.summary??(s.ok?"החבילה אומתה.":"האימות נכשל.")}</div>
            <div class="kv" data-import-origin>
              <span>תיק במקור</span><strong>${s.case??"—"}</strong>
              <span>יוצא</span><strong>${d(a?.exported_at)}${a?.exported_by_display||a?.exported_by?` · על ידי ${a?.exported_by_display||a?.exported_by}`:""}</strong>
              <span>הופקה ב־</span><strong data-import-producer data-this-installation=${String(a?.this_installation??"unknown")} data-producer=${z(a)}>${l}${a?.installation_id?e` · <span class="ltr">${a.installation_id}</span>`:i}</strong>
              <span>גרסה</span><strong><span class="ltr">Arx ${a?.app_version??"?"} · manifest v${s.schema_version??"?"}</span>${s.supported===!1?" · לא נתמכת":""}</strong>
              <span>חתימה</span><strong data-import-signature>${T(s.signature)}</strong>
              <span>SHA-256 של החבילה</span><strong class="ltr" title=${s.bundle?.sha256??""}>${P(s.bundle?.sha256)}</strong>
            </div>
            ${s.files.length||s.extra.length?e`<div class="files" data-import-files>
                  ${s.files.map(c=>e`<div class="r" data-import-file data-status=${c.status}><span class="path" title=${c.path}>${c.path}</span><sw-badge kind=${hs[c.status]} label=${ls[c.status]}></sw-badge><span class="hint ltr">${c.bytes==null?"—":b(c.bytes)}</span></div>`)}
                  ${s.extra.map(c=>e`<div class="r" data-import-file data-status="extra"><span class="path" title=${c}>${c}</span><sw-badge kind="error" label="לא ב־manifest"></sw-badge><span></span></div>`)}
                </div>`:i}
            ${m?e`<div class="hint" data-import-duplicate>החבילה הזו כבר יובאה לתיק "${m.title}". <sw-button size="sm" variant="ghost" @click=${()=>{this.importOpen=!1,u(`/investigate/cases/${m.case_id}`)}}>פתח את התיק הקיים</sw-button></div>`:i}
            ${this.canImport?i:e`<div class="hint">ייבוא כתיק דורש הרשאת ניהול תיקים לכל ההתקנה; אימות מותר לכל מי שקורא תיקים.</div>`}
            <div class="hint">${s.authenticity??""} ייבוא יוצר תיק חדש לקריאה בלבד: שום דבר מהחבילה לא הופך למצלמה, לתוכנית, למשתמש או להגדרה.</div>`:i}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.importOpen=!1}>סגור</sw-button>
      ${this.canImport?e`<sw-button slot="footer" variant="primary" icon="upload" data-bundle-import-confirm ?disabled=${this.importBusy||!s?.importable} @click=${()=>this.importNow()}>ייבא כתיק</sw-button>`:i}
    </sw-dialog>`}renderList(s){return this.loading&&!this.cases.length?e`<sw-state-panel state="loading"></sw-state-panel>`:this.forbidden&&!this.cases.length?e`<sw-state-panel state="forbidden" hint="רשימת התיקים דורשת הרשאת קריאת תיקים."></sw-state-panel>`:this.error&&!this.cases.length?e`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`:!this.cases.length&&(this.q||this.status!=="all")?e`<sw-state-panel icon="case" state="empty" heading="לא נמצאו תיקים" hint=${this.q?`אין תיק שמתאים ל„${this.q}”${this.status!=="all"?` בסטטוס ${v[this.status]}`:""}.`:`אין תיקים בסטטוס ${v[this.status]}.`} actionLabel="הצג את כל התיקים" data-cases-no-match @action=${()=>{this.q="",this.setStatus("all")}}></sw-state-panel>`:this.cases.length?e`<sw-table data-cases-table .columns=${this.narrow?gs:vs} .rows=${s} @row-select=${t=>u(`/investigate/cases/${t.detail.id}`)}></sw-table>`:e`<sw-state-panel icon="case" state="empty" heading="אין תיקים עדיין" hint="פתח תיק מדף אירוע, מהנגן או מהמפה ההיסטורית (הוסף לתיק), או כאן."></sw-state-panel>`}renderApi(){const s=this.cases.map(t=>({id:t.id,title:t.title,status:t.status,owner:t.owner_username,items:t.counts.items,clips:t.counts.events+t.counts.clips,preserved:t.counts.preserved,updated:t.updated_at,tags:t.tags.join(" · "),imported:t.origin==="imported"}));return e`
      <sw-page heading="תיקים" subheading="קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת מה־NVR">
        <sw-button slot="actions" icon="upload" data-bundle-import @click=${()=>this.pickImport()}>ייבוא חבילת ראיות</sw-button>
        ${this.canManage?e`<sw-button slot="actions" variant="primary" icon="plus" data-case-new @click=${()=>this.creating=!0}>תיק חדש</sw-button>`:i}
        <input type="file" accept=".zip,application/zip" hidden data-bundle-import-file @change=${t=>void this.onImportFile(t.target.files?.[0])} />
        <div class="bar" role="toolbar" aria-label="סינון תיקים">
          ${["all","open","in_review","closed"].map(t=>e`<sw-chip ?selected=${this.status===t} aria-pressed=${String(this.status===t)} data-case-status-filter=${t} @click=${()=>this.setStatus(t)}>${t==="all"?"הכל":v[t]}</sw-chip>`)}
          ${this.cases.length&&!this.loading?e`<span class="count" data-case-count aria-live="polite">${this.cases.length} תיקים</span>`:i}
          <span class="grow"></span>
          <sw-field><input type="search" placeholder="חיפוש בכותרת, תיאור ותגיות" aria-label="חיפוש תיקים" .value=${this.q} @input=${t=>this.onQuery(t.target.value)} @keydown=${t=>{t.key==="Escape"&&this.q&&(t.stopPropagation(),this.onQuery(""))}} /></sw-field>
        </div>
        ${this.error&&this.cases.length?e`<div class="err" role="alert">${this.error}</div>`:i}
        ${this.renderList(s)}
        ${this.creating?e`<sw-dialog open heading="תיק חדש" subheading="כותרת קצרה; פריטים נוספים מדפי האירוע, הנגן והמפה" data-case-create @close=${()=>this.creating=!1}>
              <sw-field label="כותרת"><input data-case-title .value=${this.newTitle} @input=${t=>this.newTitle=t.target.value} /></sw-field>
              <sw-field label="תיאור"><textarea rows="3" .value=${this.newDesc} @input=${t=>this.newDesc=t.target.value}></textarea></sw-field>
              <sw-field label="תגיות (מופרדות בפסיק)"><input .value=${this.newTags} @input=${t=>this.newTags=t.target.value} /></sw-field>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.creating=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" icon="plus" data-case-create-confirm ?disabled=${this.busy||!this.newTitle.trim()} @click=${()=>this.create()}>צור תיק</sw-button>
            </sw-dialog>`:i}
        ${this.importOpen?this.renderImportDialog():i}
      </sw-page>
    `}render(){return f()?this.renderApi():e`
      <sw-page heading="תיקים" subheading="קישור להקלטה אינו שימור: ראיה נחשבת שמורה רק אחרי העתקה מאומתת ו־hash · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תיק חדש</sw-button>
        <sw-table .columns=${fs} .rows=${_} @row-select=${s=>u(`/investigate/cases/${s.detail.id}`)}></sw-table>
      </sw-page>
    `}};p.styles=[N`
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
      font-weight: 500;
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
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
  `,D,q];r([o()],p.prototype,"cases",2);r([o()],p.prototype,"canManage",2);r([o()],p.prototype,"loading",2);r([o()],p.prototype,"error",2);r([o()],p.prototype,"status",2);r([o()],p.prototype,"q",2);r([o()],p.prototype,"creating",2);r([o()],p.prototype,"newTitle",2);r([o()],p.prototype,"newDesc",2);r([o()],p.prototype,"newTags",2);r([o()],p.prototype,"busy",2);r([o()],p.prototype,"canImport",2);r([o()],p.prototype,"importOpen",2);r([o()],p.prototype,"importFile",2);r([o()],p.prototype,"importReport",2);r([o()],p.prototype,"importBusy",2);r([o()],p.prototype,"importError",2);r([o()],p.prototype,"forbidden",2);r([o()],p.prototype,"narrow",2);p=r([O("investigate-cases")],p);let h=class extends E{constructor(){super(...arguments),this.bubbleSkin=new R(this),this.caseId="case-1",this.tab="details",this.data=null,this.error="",this.info="",this.busy=!1,this.tz="Asia/Jerusalem",this.noteText="",this.editing=!1,this.editTitle="",this.editDesc="",this.editTags="",this.confirmDelete=!1,this.bundles=[],this.verifyResult=null,this.cams=[],this.snapCam="",this.integrity=null,this.loadedFor="",this.pollTimer=0}updated(s){s.has("caseId")&&f()&&this.loadedFor!==this.caseId&&this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.pollTimer)}async load(){const s=this.caseId;this.loadedFor=s,this.error="";try{const[t,a]=await Promise.all([V(),Z(s)]);this.tz=t["time.zone"]??this.tz,this.data=a,this.bundles=(await J(s).catch(()=>({bundles:[]}))).bundles,this.cams.length||(this.cams=(await j().catch(()=>({cameras:[]}))).cameras.filter(d=>d.enabled&&d.recorder_enabled!==!1),!this.snapCam&&this.cams[0]&&(this.snapCam=this.cams[0].id)),window.clearTimeout(this.pollTimer),a.items.some(d=>d.preservation==="preserving")&&(this.pollTimer=window.setTimeout(()=>void this.load(),5e3))}catch(t){this.error=w(t)}}fmt(s){return A(new Date(s),{timeZone:this.tz,seconds:!0})}async run(s,t=""){this.busy=!0,this.error="";try{await s(),this.info=t,await this.load(),t&&setTimeout(()=>this.info="",4e3)}catch(a){this.error=w(a),a instanceof k&&a.status===409&&await this.load()}finally{this.busy=!1}}patchCase(s){const t=this.data;t&&this.run(async()=>{await Q(t.id,{revision:t.revision,...s})})}async verify(s){if(s){this.verifyResult=null,this.busy=!0,this.error="";try{this.verifyResult=await B(s)}catch(t){this.error=w(t)}finally{this.busy=!1}}}renderBundleCard(s){const t=this.verifyResult;return e`<sw-card heading="חבילת ראיות" subheading="ZIP עם הקטעים השמורים, התמונות, ההערות, manifest עם SHA-256 לכל קובץ ודוח קריא" data-bundle>
      ${s.can_manage?e`<sw-button size="sm" variant="primary" icon="download" data-bundle-create ?disabled=${this.busy} @click=${()=>void this.run(async()=>{await W(s.id)},'החבילה נוצרה; פריטים שאינם עותק שמור מופיעים בה כ"לא נכללו"')}>צור חבילת ראיות</sw-button>`:i}
      ${this.bundles.length?e`<div class="items" style="margin-block-start:8px">${this.bundles.map(a=>e`<div class="item" data-bundle-row style="grid-template-columns:minmax(0,1fr) auto"><div class="body"><strong class="ltr">${a.name}</strong><span class="meta">${b(a.bytes)} · ${this.fmt(a.created_at)}${a.signed?` · חתום · מפתח ${a.signed}`:" · ללא חתימה"}</span></div><div class="acts"><a href=${X(s.id,a.name)} download><sw-button size="sm" icon="download">הורדה</sw-button></a></div></div>`)}</div>`:e`<div class="hint" style="margin-block-start:6px">עדיין לא נוצרה חבילה לתיק הזה.</div>`}
      <div class="composer"><sw-field label="אימות חבילה (בחר קובץ ZIP שהורד)"><input type="file" accept=".zip,application/zip" data-bundle-verify-file @change=${a=>void this.verify(a.target.files?.[0])} /></sw-field></div>
      ${t?e`<div class="note" data-bundle-verify-result>${t.ok?`החבילה אומתה: ${t.files.length} קבצים תואמים ל־manifest${t.case?` · תיק "${t.case}"`:""}`:`האימות נכשל${t.errors.length?`: ${t.errors.join(", ")}`:""}`}
            ${t.files.some(a=>a.status!=="ok")||t.extra.length?e`<ul class="hint" style="margin:4px 0 0;padding-inline-start:18px">${t.files.filter(a=>a.status!=="ok").map(a=>e`<li class="ltr">${a.path}: ${a.status}</li>`)}${t.extra.map(a=>e`<li class="ltr">${a}: extra</li>`)}</ul>`:i}
            ${t.signature?e`<div data-bundle-signature data-signature-trust=${t.signature.trust}>${T(t.signature)}</div>`:i}
            ${t.summary?e`<div class="hint" style="margin-block-start:4px" data-bundle-verify-summary>${t.summary}</div>`:i}
            ${t.authenticity?e`<div class="hint" style="margin-block-start:4px">${t.authenticity}</div>`:i}
          </div>`:i}
      <details class="more" data-bundle-proof><summary>מה החבילה מוכיחה</summary><div class="hint" style="margin-block-start:6px">SHA-256 מוכיח שכל קובץ לא השתנה מאז יצירת החבילה; חתימת Ed25519 על ה־manifest מוכיחה שהחבילה לא שונתה מאז הייצוא על ידי מחזיק המפתח של המתקן (integrity-at-export). אף אחד מהם אינו מוכיח את אמיתות הצילום במקור (capture authenticity), ואין כאן הצהרה על קבילות משפטית. אימות מחוץ למערכת: scripts/verify_bundle.py.</div></details>
    </sw-card>`}async recheck(s){this.busy=!0,this.error="";try{this.integrity=await Y(s.id)}catch(t){this.error=w(t)}finally{this.busy=!1}}renderProvenance(s){const t=s.provenance;if(s.origin!=="imported"||!t)return i;const a=z(t),d={this_confirmed:"מהתקנה זו (מאושר בחתימה)",this_claimed:"לכאורה מהתקנה זו — לפי המזהה בלבד, לא מאושר בחתימה",other:"מהתקנה אחרת",unknown:"מהתקנה לא ידועה"}[a],l=this.integrity;return e`<sw-card data-case-provenance data-this-installation=${String(t.this_installation??"unknown")} data-producer=${a}>
      <div class="prov">
        <sw-icon name="shield" size=${18}></sw-icon>
        <div class="body">
          <strong data-provenance-headline>יובא ${d} ב־${this.fmt(t.imported_at)}; hash ${t.verification.ok?"תואם":"לא תואם"} (${t.verification.files} קבצים נבדקו בייבוא)</strong>
          <span class="meta">במקור: "${t.source_case.title??"—"}" · יוצא ${t.exported_at?this.fmt(t.exported_at):"—"}${t.exported_by_display||t.exported_by?` על ידי ${t.exported_by_display||t.exported_by}`:""} · Arx ${t.source_app_version??"?"}</span>
          <span class="meta">התקנת מקור <span class="ltr">${t.source_installation_id??"—"}</span> · ${T({present:t.signature.present,valid:t.signature.valid,kid:t.signature.kid,known:t.signature.known,retired:t.signature.retired,trust:t.signature.trust})}</span>
          <span class="meta">חבילה <span class="ltr" title=${t.bundle_sha256}>SHA-256 ${P(t.bundle_sha256)}</span> · ${b(t.bundle_bytes)} · יובא על ידי ${t.imported_by??"—"}${t.skipped_at_source?` · ${t.skipped_at_source} פריטים לא נכללו כבר במקור`:""}</span>
          ${l?e`<span class=${l.ok?"ok":"err"} data-case-integrity-result data-ok=${String(l.ok)}>${l.ok?l.files.length?`בדיקה חוזרת ${this.fmt(l.checked_at)}: hash תואם — ${l.files.length} קבצים לא השתנו מאז הייבוא`:`בדיקה חוזרת ${this.fmt(l.checked_at)}: אין בתיק קבצים שמורים לבדוק`:`בדיקה חוזרת ${this.fmt(l.checked_at)}: hash לא תואם — ${l.files.filter(m=>m.status!=="ok").length} מתוך ${l.files.length} קבצים שונו או חסרים`}</span>`:i}
          <span class="hint">התאמת hash מוכיחה שהקבצים לא שונו מאז הייצוא; היא אינה מוכיחה שהצילום אמיתי. פריטים מיובאים הם לקריאה בלבד; מחיקת התיק מסירה גם את הקבצים המיובאים.</span>
        </div>
        <sw-button size="sm" icon="refresh" data-case-integrity ?disabled=${this.busy} @click=${()=>void this.recheck(s)}>בדיקת hash חוזרת</sw-button>
      </div>
    </sw-card>`}renderItem(s,t){const a=s.kind==="event"?`אירוע · ${M[s.event?.type??"other"]??s.event?.type??""}`:s.kind==="clip"?"קטע הקלטה":s.kind==="snapshot"?"תמונה":"הערה",d=s.preservation,l=s.kind==="event"&&s.event?s.event.occurred_at:s.from_at,m=s.kind==="note"?e`<div class="thumb"><sw-icon name="edit" size=${18}></sw-icon></div>`:s.kind==="snapshot"&&s.file_path?e`<img class="thumb" src=${C(t.id,s.id)} alt="תמונה מהמצלמה" />`:s.imported?e`<div class="thumb"><sw-icon name=${s.file_path?"case":"bookmark"} size=${18}></sw-icon></div>`:s.kind==="event"&&s.event?.thumbnail==="ready"&&s.event_id?e`<img class="thumb" src=${U(s.event_id)} alt="" />`:s.camera_id&&l?e`<img class="thumb" src=${K(s.camera_id,l)} alt="" @error=${n=>n.target.style.visibility="hidden"} />`:e`<div class="thumb"></div>`,c=s.origin;return e`<div class="item" data-case-item data-kind=${s.kind} data-preservation=${d} ?data-imported=${!!s.imported}>
      ${m}
      <div class="body">
        <div class="head"><strong>${a}</strong>${s.camera_name?e`<span>· ${s.camera_name}${s.imported?" (מצלמת המקור)":""}</span>`:i}${d!=="none"?e`<sw-badge kind=${ps[d]} label=${ss[d]}></sw-badge>`:i}${s.imported?e`<sw-badge kind="historic" label="מיובא · לקריאה בלבד"></sw-badge>`:i}</div>
        ${s.from_at&&s.to_at?e`<div class="range ltr">${this.fmt(s.from_at)} → ${this.fmt(s.to_at)}</div>`:i}
        ${s.note?e`<div>${s.note}</div>`:i}
        <div class="meta">${c?`במקור: ${c.added_by??"—"}${c.created_at?` · ${this.fmt(c.created_at)}`:""} · יובא על ידי ${s.added_by_username}${d==="missing"?" · הקובץ המיובא חסר בדיסק":""}`:e`${s.added_by_username} · ${this.fmt(s.created_at)}${s.export?.error?` · ייצוא: ${s.export.error}`:""}${d==="missing"?" · לא ניתן לשמר: ההקלטה כבר לא ב־NVR":""}`}</div>
      </div>
      <div class="acts">
        ${s.camera_id&&l&&s.kind!=="snapshot"?e`<sw-button size="sm" icon="play" @click=${()=>u("/investigate/playback",{camera:s.camera_id??"",t:l})}>נגן</sw-button>`:i}
        ${(s.kind==="snapshot"||s.imported)&&s.file_sha256?e`<span class="meta ltr" title="SHA-256">${s.file_sha256.slice(0,12)}…</span>`:i}
        ${s.imported&&s.file_path&&s.kind!=="snapshot"?e`<a href=${C(t.id,s.id)} download data-item-file><sw-button size="sm" variant="ghost" icon="download">הורדה</sw-button></a>`:i}
        ${s.event_id?e`<sw-button size="sm" variant="ghost" icon="bell" @click=${()=>u(`/investigate/events/${s.event_id}`)}>אירוע</sw-button>`:i}
        ${t.can_manage&&s.kind!=="note"&&(d==="nvr_only"||d==="unknown")?e`<sw-button size="sm" icon="download" data-item-preserve ?disabled=${this.busy} @click=${()=>void this.run(()=>ts(t.id,s.id).then(()=>{}),"עבודת שימור נוצרה; הפריט יסומן כשמור כשההעתקה תסתיים")}>שמור עותק</sw-button>`:i}
        ${s.export?.download_ready?e`<a href=${G(s.export.id)} download><sw-button size="sm" variant="ghost" icon="download">הורדה</sw-button></a>`:i}
        ${t.can_manage&&!s.imported?e`<sw-button size="sm" variant="ghost" iconOnly icon="close" label="הסר מהתיק" data-item-remove ?disabled=${this.busy} @click=${()=>void this.run(()=>es(t.id,s.id).then(()=>{}))}></sw-button>`:i}
      </div>
    </div>`}renderApi(){if(this.error&&!this.data)return e`<sw-page heading="תיק"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;const s=this.data;if(!s)return e`<sw-page heading="תיק"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t=s.counts,a=s.items.filter(n=>n.preservation==="missing").length,d=s.items.filter(n=>n.preservation==="preserving").length,l=s.items.filter(n=>n.preservation==="nvr_only"||n.preservation==="unknown").length,m=S(s.updated_at)??this.fmt(s.updated_at),c=s.can_manage&&s.status!=="closed";return e`
      <sw-page class="api" heading=${s.title} subheading=${`${v[s.status]} · בעלים: ${s.owner_username} · עודכן ${m}`} crumbs="חקירה | תיקים" wide>
        ${s.can_manage?e`<sw-field slot="actions"><select aria-label="סטטוס" data-case-status ?disabled=${this.busy} @change=${n=>this.patchCase({status:n.target.value})}>${Object.keys(v).map(n=>e`<option value=${n} ?selected=${n===s.status}>${v[n]}</option>`)}</select></sw-field>
              <sw-button slot="actions" icon="edit" data-case-edit @click=${()=>{this.editTitle=s.title,this.editDesc=s.description,this.editTags=s.tags.join(", "),this.editing=!0}}>עריכה</sw-button>
              <sw-button slot="actions" variant="ghost" icon="trash" data-case-delete @click=${()=>this.confirmDelete=!0}>מחיקה</sw-button>`:i}
        <sw-button slot="actions" variant="ghost" icon="list" @click=${()=>u("/investigate/cases")}>לרשימת התיקים</sw-button>
        ${this.error?e`<div class="err" role="alert" data-case-error>${this.error}</div>`:i}
        ${this.info?e`<div class="ok" role="status" data-case-info>${this.info}</div>`:i}
        <div class="cols">
          <div class="col main">
            ${this.renderProvenance(s)}
            <sw-card heading="ראיות והערות" subheading=${s.checked?"מצב השימור נבדק מול ה־NVR עכשיו":"מצב השימור לא נבדק מול ה־NVR"}>
              <div class="stats" data-case-stats>
                <span class="r5-well"><span class="r5-num">${t.items}</span><span class="r5-sub">פריטים</span></span>
                <span class="r5-well" data-tone=${t.preserved?"ok":i}><span class="r5-num">${t.preserved}</span><span class="r5-sub">עותקים שמורים</span></span>
                ${d?e`<span class="r5-well"><span class="r5-num">${d}</span><span class="r5-sub">בהעתקה</span></span>`:i}
                ${l?e`<span class="r5-well" data-tone="warn"><span class="r5-num">${l}</span><span class="r5-sub">סימנייה בלבד</span></span>`:i}
                ${a?e`<span class="r5-well" data-tone="bad"><span class="r5-num">${a}</span><span class="r5-sub">חסרים</span></span>`:i}
              </div>
              ${s.items.length?e`<div class="items" data-case-items>${s.items.map(n=>this.renderItem(n,s))}</div>`:e`<div class="hint">עדיין אין פריטים בתיק. הוסף מאירוע, מהנגן או מהמפה ההיסטורית (הוסף לתיק).</div>`}
              ${s.hidden_items?e`<div class="hint">${s.hidden_items} פריטים ממצלמות שאינן בהרשאתך אינם מוצגים.</div>`:i}
              <div class="hint" style="margin-block-start:10px">סימנייה מצביעה על ההקלטה ב־NVR ואינה שימור: קטע נחשב שמור רק אחרי שעבודת ייצוא העתיקה אותו (sha256 ב־manifest). קטע שה־NVR כבר מחק מוצג כחסר ולעולם לא כשמור.</div>
            </sw-card>
          </div>
          <div class="col side">
            ${s.description||s.tags.length?e`<sw-card heading="תיאור">${s.description?e`<div class="desc" data-case-description>${s.description}</div>`:i}${s.tags.length?e`<div class="tags">${s.tags.map(n=>e`<sw-chip>${n}</sw-chip>`)}</div>`:i}</sw-card>`:i}
            ${c?e`<sw-card heading="הוספה לתיק" data-case-composer>
                  <div class="composer" style="margin-block-start:0"><sw-field label="הערה חדשה"><textarea rows="2" data-note-text .value=${this.noteText} @input=${n=>this.noteText=n.target.value} @keydown=${n=>{n.key==="Enter"&&(n.ctrlKey||n.metaKey)&&this.noteText.trim()&&!this.busy&&this.run(async()=>{await x(s.id,{kind:"note",note:this.noteText.trim()}),this.noteText=""})}}></textarea></sw-field><sw-button size="sm" icon="plus" data-note-add ?disabled=${this.busy||!this.noteText.trim()} @click=${()=>void this.run(async()=>{await x(s.id,{kind:"note",note:this.noteText.trim()}),this.noteText=""})}>הוסף הערה</sw-button></div>
                  <div class="composer"><sw-field label="תמונה ממצלמה לתיק (עותק שמור מיידי)"><select aria-label="מצלמה לצילום" data-snapshot-camera @change=${n=>this.snapCam=n.target.value}>${this.cams.map(n=>e`<option value=${n.id} ?selected=${n.id===this.snapCam}>${n.name}</option>`)}</select></sw-field><sw-button size="sm" icon="camera" data-snapshot-add ?disabled=${this.busy||!this.snapCam} @click=${()=>void this.run(async()=>{await x(s.id,{kind:"snapshot",camera_id:this.snapCam})},"התמונה נשמרה בתיק עם ה־hash שלה")}>צלם תמונה לתיק</sw-button></div>
                </sw-card>`:i}
            ${this.renderBundleCard(s)}
          </div>
        </div>
        ${this.editing?e`<sw-dialog open heading="עריכת תיק" data-case-edit-dialog @close=${()=>this.editing=!1}>
              <sw-field label="כותרת"><input data-edit-title .value=${this.editTitle} @input=${n=>this.editTitle=n.target.value} /></sw-field>
              <sw-field label="תיאור"><textarea rows="4" data-edit-description .value=${this.editDesc} @input=${n=>this.editDesc=n.target.value}></textarea></sw-field>
              <sw-field label="תגיות (מופרדות בפסיק)"><input .value=${this.editTags} @input=${n=>this.editTags=n.target.value} /></sw-field>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.editing=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" icon="check" data-case-edit-save ?disabled=${this.busy||!this.editTitle.trim()} @click=${()=>{this.editing=!1,this.patchCase({title:this.editTitle.trim(),description:this.editDesc,tags:this.editTags.split(",").map(n=>n.trim()).filter(Boolean)})}}>שמירה</sw-button>
            </sw-dialog>`:i}
        ${this.confirmDelete?e`<sw-dialog open heading="מחיקת תיק" subheading="הפריטים בתיק יימחקו; ההקלטות ב־NVR והעותקים שיוצאו נשארים" @close=${()=>this.confirmDelete=!1}>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.confirmDelete=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="danger" icon="trash" data-case-delete-confirm ?disabled=${this.busy} @click=${()=>{this.confirmDelete=!1,this.run(async()=>{await as(s.id),u("/investigate/cases")})}}>מחק תיק</sw-button>
            </sw-dialog>`:i}
      </sw-page>
    `}render(){if(f())return this.renderApi();const s=_.find(t=>t.id===this.caseId)??_[0];return e`
      <sw-page heading="סקירת אירוע" subheading=${`${s.title} · בעלים: ${s.owner} · נתוני הדגמה`} crumbs="אירועים | תיקים | 13.09.2026 10:12 | כניסה ראשית">
        <sw-field slot="actions"><select aria-label="סטטוס"><option>${s.status}</option><option>בבדיקה</option><option>סגור</option></select></sw-field>
        <div class="wrap">
          <div class="video">
            <sw-scene kind="entrance"></sw-scene>
            <span class="stamp">2026-09-13 10:12:04</span>
            <span class="demo">דמו · הקטע ינוגן מהתיק (T050)</span>
            <div class="bar">
              <sw-button variant="ghost" size="sm" iconOnly icon="play" label="נגן"></sw-button>
              <span class="ltr">0:00 / 0:13</span>
              <span class="track"><i></i></span>
              <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="אחורה"></sw-button>
              <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא"></sw-button>
            </div>
          </div>
          <div class="clips">
            <div class="clip on"><sw-scene kind="entrance"></sw-scene><span class="t">00:00</span></div>
            <div class="clip"><sw-scene kind="lobby"></sw-scene><span class="t">00:06</span></div>
            <div class="clip missing"><span>מסדרון 10:15</span><sw-badge filled kind="error" label="לא שמור: המקליט מחק"></sw-badge></div>
            <div class="add"><span><sw-icon name="plus" size=${14}></sw-icon> הוסף קטע</span></div>
          </div>
          <sw-tabs .items=${[{id:"details",label:"פרטים"},{id:"notes",label:"הערות",count:2},{id:"related",label:"מצלמות קשורות",count:3}]} .active=${this.tab} @change=${t=>this.tab=t.detail.id}></sw-tabs>
          ${this.tab==="details"?e`<div class="form">
                <div class="stack">
                  <sw-field label="כותרת"><input value=${s.title} /></sw-field>
                  <sw-field label="תיאור"><textarea rows="3">אדם נכנס אחרי פתיחת הדלת ב־10:12. לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).</textarea></sw-field>
                </div>
                <div class="pills">
                  <div class="pill"><sw-icon name="calendar" size=${14}></sw-icon>13.09.2026 · 10:12</div>
                  <div class="pill"><sw-icon name="camera" size=${14}></sw-icon>כניסה ראשית · לובי</div>
                  <div class="pill"><sw-icon name="shield" size=${14}></sw-icon>2/3 ראיות שמורות · sha256</div>
                </div>
              </div>`:this.tab==="notes"?e`<sw-card>
                  <div class="note">נראה אדם נכנס אחרי פתיחת הדלת ב־10:12.<small>יוני · 10:40</small></div>
                  <div class="note">לבדוק אם מסדרון מזרחי הקליט (המצלמה מנותקת מ־07:55).<small>יוסי · 10:52</small></div>
                  <sw-field style="margin-block-start:8px"><textarea rows="2" placeholder="הערה חדשה…"></textarea></sw-field>
                </sw-card>`:e`<div class="clips">
                  <sw-camera-tile compact name="כניסה ראשית" state="recorded" scene="entrance"></sw-camera-tile>
                  <sw-camera-tile compact name="לובי" state="recorded" scene="lobby"></sw-camera-tile>
                  <sw-camera-tile compact name="מסדרון מזרחי" state="unknown"></sw-camera-tile>
                </div>`}
          <div class="foot">
            <sw-button icon="link">שיתוף</sw-button>
            <sw-button variant="primary" icon="download">ייצוא ראיות</sw-button>
          </div>
          <div class="hint">Manifest: clips 2/3 · notes 2 · requested/actual ranges · timezone Asia/Jerusalem · pipeline v0.1 · sha256 לכל קובץ. Hash מוכיח התאמה לקובץ שנשמר, לא אותנטיות מאז המצלמה. "מצלמות מוצעות לחקירה" בלבד: אין קביעה שמדובר באותו אדם.</div>
        </div>
      </sw-page>
    `}};h.styles=[N`
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
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-sm);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
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
  `,D,q];r([H()],h.prototype,"caseId",2);r([o()],h.prototype,"tab",2);r([o()],h.prototype,"data",2);r([o()],h.prototype,"error",2);r([o()],h.prototype,"info",2);r([o()],h.prototype,"busy",2);r([o()],h.prototype,"tz",2);r([o()],h.prototype,"noteText",2);r([o()],h.prototype,"editing",2);r([o()],h.prototype,"editTitle",2);r([o()],h.prototype,"editDesc",2);r([o()],h.prototype,"editTags",2);r([o()],h.prototype,"confirmDelete",2);r([o()],h.prototype,"bundles",2);r([o()],h.prototype,"verifyResult",2);r([o()],h.prototype,"cams",2);r([o()],h.prototype,"snapCam",2);r([o()],h.prototype,"integrity",2);h=r([O("investigate-case-detail")],h);export{h as InvestigateCaseDetail,p as InvestigateCases};
//# sourceMappingURL=investigate-cases-C5AhiZGr.js.map
