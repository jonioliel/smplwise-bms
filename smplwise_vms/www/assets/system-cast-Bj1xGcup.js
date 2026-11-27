import{j as u,aW as S,a as x,iV as k,af as v,ag as M,iW as T,iX as f,q as w,o as m,b as n,aM as _,A as h,aX as j,iY as E,iZ as $,i_ as O,i$ as A,j0 as B,j1 as L,j2 as P,eG as N,j3 as R,j4 as H,j5 as b,j6 as I,j7 as D,j8 as F,j9 as X,ja as q,jb as W,jc as y,k as c,z as Y,m as z}from"./index-CoJbESCx.js";import{b as C}from"./bubble-chrome-Da7T662v.js";import{c as G}from"./media-cast-label-Br3PWa8p.js";import{t as s}from"./system-a-Bw6aZFz7.js";const K=u`
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 0;
    border-block-end: 1px solid var(--sw-border);
    flex-wrap: wrap;
  }
  .row:last-child {
    border-block-end: 0;
  }
  .lbl {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-medium);
  }
  .muted {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-regular);
  }
`,te=u`
  .dev {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 0 0;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 10px 16px;
    flex-wrap: wrap;
  }
  .line .grow {
    flex: 1;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    /* 0.1.162: the form opens inside the list's padded detail row; a field never grows past it (the profile select's
       longest option, "זיהוי אוטומטי · ...", is wider than a 320 px phone's row) */
    max-inline-size: 100%;
    min-inline-size: 0;
  }
  .f.inline {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  select {
    max-inline-size: 100%;
    min-inline-size: 0;
  }
  input[type='number'] {
    inline-size: 88px;
  }
  .ep {
    display: grid;
    grid-template-columns: minmax(140px, 1.4fr) minmax(90px, 0.8fr) minmax(0, 2fr) auto;
    gap: 6px 12px;
    align-items: center;
    padding: 6px 0;
    font-size: var(--sw-fs-sm);
    border-block-end: 1px dashed var(--sw-border);
  }
  .ep:last-child {
    border-block-end: 0;
  }
  .link {
    color: var(--sw-accent-text);
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    background: none;
    border: 0;
    padding: 0;
    font-family: inherit;
    min-block-size: 32px;
  }
  .ib:disabled {
    opacity: 0.35;
    cursor: default;
  }
  ${S}
`;var U=Object.defineProperty,V=Object.getOwnPropertyDescriptor,l=(e,t,o,i)=>{for(var a=i>1?void 0:i?V(t,o):t,r=e.length-1,p;r>=0;r--)(p=e[r])&&(a=(i?p(t,o,a):p(a))||a);return i&&a&&U(t,o,a),a};const Z=(e=3e3)=>new Promise(t=>setTimeout(t,e));let d=class extends x{constructor(){super(...arguments),this.bubbleSkin=new j(this),this.phase="loading",this.err="",this.cfg=null,this.screens=[],this.origin="",this.originBusy=!1,this.originMsg=null,this.saved="",this.cams=[],this.testFor="",this.testCam="",this.testBusy=!1,this.testMsg="",this.watch=new k(this)}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(!v()){this.phase="ready";return}if(E()){this.phase="local";return}if(!_("system.configure")){this.phase="forbidden";return}this.phase="loading",this.err="";try{const[e,t]=await Promise.all([$(),O()]);this.cfg=e,this.screens=t.screens,this.origin=e.config.origin??"",this.phase="ready",f.refresh()}catch(e){this.err=w(e),this.phase="error"}}note(e){this.saved=e,Z().then(()=>{this.saved===e&&(this.saved="")})}async saveCfg(e){this.err="";try{const t=await A(e);this.cfg=t,this.origin=t.config.origin??"",this.note(s("נשמר"))}catch(t){const o=w(t);await this.load(),this.err=o}}async checkOrigin(){this.originBusy=!0,this.originMsg=null;try{const e=await B();this.originMsg=e.ok?{ok:!0,text:s("הכתובת נבדקה: ה־relay עונה")}:{ok:!1,text:L[e.reason??""]??s("הבדיקה נכשלה")};const t=await $();this.cfg=t}catch(e){this.originMsg={ok:!1,text:w(e)}}finally{this.originBusy=!1}}async saveScreen(e,t){this.err="";try{const o=await P(e.key,t);this.screens=this.screens.map(i=>i.key===e.key?{...i,settings:o.settings}:i),this.note(s("נשמר"))}catch(o){const i=w(o);await this.load(),this.err=i}}async openTest(e){if(this.testFor=this.testFor===e?"":e,this.testMsg="",this.testFor&&!this.cams.length)try{this.cams=(await N()).cameras.filter(t=>t.enabled&&t.can_view_live!==!1),this.testCam=this.cams[0]?.id??""}catch(t){this.testMsg=w(t)}}async runTest(e){if(this.testCam){this.testBusy=!0,this.testMsg="";try{const t=await R({target_key:e,camera_id:this.testCam});f.put(t.session),this.testMsg=t.status==="refused"?s("המסך סירב לשידור הבדיקה"):s("שידור בדיקה התחיל (60 שניות)")}catch(t){this.testMsg=w(t)}finally{this.testBusy=!1}}}general(e){const t=e.config,o=e.ready?null:H[e.reason??""]??e.reason;return n`<sw-card heading=${s("שידור למסכים")} data-cast-general>
      <div class="row"><span class="lbl">${s("שידור מצלמות למסכים")}<span class="muted">${s('כבוי = אף משתמש לא רואה את הכפתור "שדר למסך"')}</span></span>
        <sw-toggle controlled label=${s("שידור למסכים")} labelHidden .checked=${t.enabled} data-cast-enabled @change=${i=>void this.saveCfg({enabled:i.detail.checked})}></sw-toggle></div>
      <div class="row"><span class="lbl">${s("מצב")}<span class="muted" data-cast-ready>${e.ready?s("מוכן לשידור"):o}</span></span>
        <sw-badge kind=${e.ready?"live":"stale"} label=${e.ready?s("מוכן"):s("לא מוכן")}></sw-badge></div>
      <div class="row"><span class="lbl">${s("כתובת המקור (ה־relay ברשת הביתית)")}<span class="muted">${s("http://כתובת-IP:פורט של שרת Home Assistant; המסך מושך משם את התמונה. שם מארח לא מתקבל.")}</span></span>
        <span class="inl"><input type="text" data-cast-origin dir="ltr" aria-label=${s("כתובת המקור")} placeholder="http://192.168.x.x:18092" .value=${this.origin} @input=${i=>this.origin=i.target.value} />
          <sw-button size="sm" data-cast-origin-save ?disabled=${this.origin.trim()===(t.origin??"")} @click=${()=>void this.saveCfg({origin:this.origin.trim()})}>${s("שמור")}</sw-button>
          <sw-button size="sm" variant="primary" data-cast-origin-check ?disabled=${this.originBusy||!t.origin} @click=${()=>void this.checkOrigin()}>${this.originBusy?s("בודק…"):s("בדוק")}</sw-button>
          ${t.origin_verified_at&&!this.originMsg?n`<span class="ok" data-cast-origin-verified>${s("נבדקה")}</span>`:h}
          ${this.originMsg?n`<span class=${this.originMsg.ok?"ok":"bad"} data-cast-origin-result role="status">${this.originMsg.text}</span>`:h}</span></div>
      <div class="row"><span class="lbl">${s("מקסימום שידורים בו־זמנית")}<span class="muted">1-8</span></span>
        <input type="number" min="1" max="8" data-cast-max aria-label=${s("מקסימום שידורים בו־זמנית")} .value=${String(t.max_sessions)} @change=${i=>void this.saveCfg({max_sessions:Number(i.target.value)})} /></div>
      <div class="row"><span class="lbl">${s("משך שידור ברירת מחדל")}<span class="muted">${s("דקות; אפשר להאריך עד {n} פעמים",{n:t.max_extensions})}</span></span>
        <sw-field><select data-cast-minutes aria-label=${s("משך שידור ברירת מחדל")} .value=${String(t.minutes)} @change=${i=>void this.saveCfg({minutes:Number(i.target.value)})}>
          ${[...new Set([...b,t.minutes])].sort((i,a)=>i-a).map(i=>n`<option value=${i} ?selected=${i===t.minutes}>${s("{n} דקות",{n:i})}</option>`)}</select></sw-field></div>
      <div class="row"><span class="lbl">${s("זרם ראשי (איכות גבוהה)")}<span class="muted">${s("רק למצלמה ב־H.264 ולמסך שאישר. כבוי = תמיד הזרם המשני.")}</span></span>
        <sw-toggle controlled label=${s("זרם ראשי")} labelHidden .checked=${t.allow_main} data-cast-allow-main @change=${i=>void this.saveCfg({allow_main:i.detail.checked})}></sw-toggle></div>
      <div class="row"><span class="lbl">${s("כיבוי המסך אחרי העצירה")}<span class="muted">${s("רק כשהמסך היה כבוי לפני השידור; המשתמש יכול לבטל בעצירה")}</span></span>
        <sw-toggle controlled label=${s("כיבוי אחרי עצירה")} labelHidden .checked=${t.power_off_after} data-cast-power-off @change=${i=>void this.saveCfg({power_off_after:i.detail.checked})}></sw-toggle></div>
      <div class="row"><span class="lbl">${s("מסכים חסומים בבורר")}<span class="muted">${s("מסך שהמשתמש לא יכול לשדר אליו")}</span></span>
        <sw-field><select data-cast-blocked-display aria-label=${s("מסכים חסומים בבורר")} @change=${i=>void this.saveCfg({blocked_display:i.target.value})}>
          ${Object.entries(I).map(([i,a])=>n`<option value=${i} ?selected=${i===t.blocked_display}>${a}</option>`)}</select></sw-field></div>
      <div class="row"><span class="lbl">${s("רכיבים")}<span class="muted" data-cast-parts>relay: ${e.relay.option?e.relay.listening?s("מאזין (פורט {port})",{port:e.relay.container_port}):`${s("מופעל, לא מאזין")}${e.relay.error?` · ${e.relay.error}`:""}`:s("כבוי (cast_relay)")} · ${s("גשר Arx:")} ${e.bridge.paired?`${s("גרסה {version}",{version:e.bridge.version??"?"})}${e.bridge.ready?"":` · ${s("נדרש {version}+",{version:e.bridge.required})}`}`:s("לא מצומד")}</span></span></div>
    </sw-card>`}screenRow(e){const t=e.settings,o=G({method:e.effective.method,confidence:e.effective.confidence==="manual"?"confirmed":e.effective.confidence,reason:e.effective.reason,via:e.target_entity_id}),i=e.approved&&e.effective.method==="cast_hls",a=f.open().find(r=>r.device_key===e.key&&r.kind==="test");return n`<div class="scr" data-cast-screen=${e.key}>
      <div class="nm"><b>${e.name}</b><span class="muted">${[e.floor_name,e.area_name].filter(Boolean).join(" · ")||"—"}${e.approved?"":" · "+s("לא מאושר")}${e.public?" · "+s("ציבורי"):""}</span></div>
      <div class="cl">${o?n`<sw-badge kind=${o.kind} label=${o.label} title=${o.title}></sw-badge>`:"—"}</div>
      <div class="cl"><span class="lb">${s("מותר לשדר")}</span><sw-toggle controlled label=${`${s("מותר לשדר")}: ${e.name}`} labelHidden .checked=${t.allow} data-cast-allow=${e.key} @change=${r=>void this.saveScreen(e,{allow:r.detail.checked})}></sw-toggle></div>
      <div class="cl"><span class="lb">${s("שיטה")}</span><sw-field><select aria-label=${`${s("שיטה")}: ${e.name}`} data-cast-method=${e.key} @change=${r=>void this.saveScreen(e,{method:r.target.value})}>
        ${Object.entries(D).map(([r,p])=>n`<option value=${r} ?selected=${r===t.method}>${p}</option>`)}</select></sw-field></div>
      <div class="cl"><span class="lb">${s("משך")}</span><sw-field><select aria-label=${`${s("משך")}: ${e.name}`} data-cast-screen-minutes=${e.key} @change=${r=>{const p=r.target.value;this.saveScreen(e,{minutes:p?Number(p):null})}}>
        <option value="" ?selected=${t.minutes==null}>${s("ברירת מחדל")}</option>${b.map(r=>n`<option value=${r} ?selected=${r===t.minutes}>${s("{n} דקות",{n:r})}</option>`)}</select></sw-field></div>
      <div class="cl"><span class="lb">${s("שידור קבוע")}</span><sw-toggle controlled label=${`${s("שידור קבוע")}: ${e.name}`} labelHidden .checked=${t.permanent} data-cast-permanent=${e.key} @change=${r=>void this.saveScreen(e,{permanent:r.detail.checked})}></sw-toggle></div>
      <div class="cl"><span class="lb">${s("זרם ראשי")}</span><sw-field><select aria-label=${`${s("זרם ראשי")}: ${e.name}`} data-cast-screen-main=${e.key} @change=${r=>{const p=r.target.value;this.saveScreen(e,{allow_main:p===""?null:p==="yes"})}}>
        <option value="" ?selected=${t.allow_main==null}>${s("לפי ההתקנה")}</option><option value="yes" ?selected=${t.allow_main===!0}>${s("מותר")}</option><option value="no" ?selected=${t.allow_main===!1}>${s("אסור")}</option></select></sw-field></div>
      ${i?n`<div class="cl wide"><sw-button size="sm" data-cast-test-open=${e.key} @click=${()=>void this.openTest(e.key)}>${s("בדיקת שידור (60 שניות)")}</sw-button></div>`:h}
      ${this.testFor===e.key?n`<div class="test" data-cast-test-panel=${e.key}>
            <label class="inl">${s("מצלמה")} <sw-field><select data-cast-test-camera .value=${this.testCam} @change=${r=>this.testCam=r.target.value}>${this.cams.map(r=>n`<option value=${r.id} ?selected=${r.id===this.testCam}>${r.alias||r.name}</option>`)}</select></sw-field></label>
            <sw-button size="sm" variant="primary" data-cast-test-run ?disabled=${this.testBusy||!this.testCam||!!a} @click=${()=>void this.runTest(e.key)}>${s("התחל בדיקה")}</sw-button>
            ${a?n`<span data-cast-test-state>${a.state==="playing"?s("משדר"):a.state==="not_confirmed"?s("המסך לא הגיע לזרם"):s("מתחבר…")} · ${F(a,f.now)}</span><sw-cast-stop .session=${a}></sw-cast-stop>`:h}
            ${this.testMsg?n`<span class="muted" role="status" data-cast-test-msg>${this.testMsg}</span>`:h}
          </div>`:h}
    </div>`}render(){this.watch;const e=t=>n`<div data-system-cast>${t}</div>`;return v()?this.phase==="local"?e(n`<sw-state-panel data-cast-admin-state="local" state="forbidden" heading=${s("שידור למסכים")} hint=${X}></sw-state-panel>`):this.phase==="forbidden"?e(n`<sw-state-panel data-cast-admin-state="forbidden" state="forbidden" heading=${s("אין לך הרשאה להגדרות השידור")} hint=${s("נדרשת ההרשאה להגדרת המערכת.")}></sw-state-panel>`):this.phase==="loading"?e(n`<sw-state-panel state="loading"></sw-state-panel>`):this.phase==="error"||!this.cfg?e(n`<sw-state-panel data-cast-admin-state="error" state="error" heading=${s("לא ניתן לטעון את הגדרות השידור")} hint=${this.err} actionLabel=${s("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel>`):e(n`<div class="stack">
      ${this.err?n`<div class="err" role="alert" data-cast-err>${this.err}</div>`:h}
      ${this.general(this.cfg)}
      <sw-card heading=${s("מסכים לשידור")} data-cast-screens>
        <div class="muted">${s("ברירת המחדל: כל מסך כבוי עד שמנהל מפעיל אותו. בדיקת שידור עובדת גם לפני ההפעלה, 60 שניות, על המסך שנבחר בלבד.")}</div>
        ${this.screens.length?n`<div class="sgrid"><div class="scr head" aria-hidden="true"><span>${s("מסך")}</span><span>${s("זיהוי")}</span><span>${s("מותר")}</span><span>${s("שיטה")}</span><span>${s("משך")}</span><span>${s("קבוע")}</span><span>${s("זרם ראשי")}</span></div>
            ${this.screens.map(t=>this.screenRow(t))}</div>`:n`<sw-state-panel icon="cast" state="empty" heading=${s("לא זוהו מסכים לשידור")}></sw-state-panel>`}
      </sw-card>
      ${this.saved?n`<div class="toast" role="status" data-cast-saved>${this.saved}</div>`:h}
    </div>`):e(n`<sw-state-panel icon="cast" state="empty" heading=${s("שידור למסכים")} hint=${s("ההגדרות זמינות בהתקנה עם שרת.")}></sw-state-panel>`)}};d.styles=[C,K,u`
    :host {
      display: block;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .mono {
      font-family: var(--sw-font-mono);
      direction: ltr;
      unicode-bidi: isolate;
    }
    /* CR-CMP2-SELECTS-2450 (owner N10): the selects sit in sw-field (the shared field look); the inputs keep this rule */
    input[type='text'],
    input[type='number'] {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      max-inline-size: 100%;
    }
    sw-field > select {
      min-block-size: 36px; /* the row's inputs are 36 px: the field keeps the row even */
    }
    input[type='text'] {
      inline-size: 240px;
      direction: ltr;
      text-align: start;
    }
    input[type='number'] {
      inline-size: 80px;
    }
    .inl {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .ok {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .bad {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    /* MEDIA-POLISH-2331: the error stays in view at the top while the person scrolls (a save that failed far down the screens list
       used to report above the first card, out of sight); the "נשמר" note floats at the bottom of the window, where it is seen
       whichever row was changed */
    .err {
      position: sticky;
      inset-block-start: var(--sw-s-2);
      z-index: 5;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface));
      border: 1px solid color-mix(in srgb, var(--sw-danger) 30%, transparent);
      box-shadow: var(--sw-shadow-1);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .toast {
      position: fixed;
      z-index: 60;
      inset-inline: 0;
      inset-block-end: var(--sw-s-6);
      margin-inline: auto;
      inline-size: max-content;
      max-inline-size: calc(100% - var(--sw-s-6));
      padding: var(--sw-s-2) var(--sw-s-4);
      border-radius: var(--sw-r-pill);
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      box-shadow: var(--sw-shadow-3);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    input:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    /* the screens table: ONE grid; the header and every row share its columns (subgrid). Each row used to be a grid of its own with
       auto columns, so the header labels and the controls under them never lined up. */
    .sgrid {
      display: grid;
      grid-template-columns: minmax(150px, 1.4fr) repeat(6, auto);
      column-gap: 14px;
      margin-block-start: var(--sw-s-2);
    }
    .scr {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: subgrid;
      row-gap: 8px;
      align-items: center;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .scr:last-child {
      border-block-end: 0;
    }
    .scr .wide {
      grid-column: 1 / -1;
      justify-self: start;
    }
    .scr.head {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      padding-block: 4px;
    }
    .scr .nm {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .scr .nm b {
      font-weight: var(--sw-fw-medium);
    }
    .scr .cl {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .scr .cl .lb {
      display: none;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .test {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 8px 10px;
      border: 1px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
    }
    @media (pointer: coarse) {
      input[type='text'],
      input[type='number'],
      sw-field > select {
        min-block-size: 44px;
      }
    }
    @media (max-width: 767px) {
      .toast {
        inset-block-end: calc(var(--sw-bottomnav-h, 0px) + var(--sw-s-3));
      }
    }
    @media (max-width: 860px) {
      .scr.head {
        display: none;
      }
      .sgrid {
        grid-template-columns: 1fr 1fr;
      }
      .scr .nm {
        grid-column: 1 / -1;
      }
      .scr .cl .lb {
        display: block;
      }
    }
    sw-state-panel {
      min-block-size: 160px;
    }
  `];l([c()],d.prototype,"phase",2);l([c()],d.prototype,"err",2);l([c()],d.prototype,"cfg",2);l([c()],d.prototype,"screens",2);l([c()],d.prototype,"origin",2);l([c()],d.prototype,"originBusy",2);l([c()],d.prototype,"originMsg",2);l([c()],d.prototype,"saved",2);l([c()],d.prototype,"cams",2);l([c()],d.prototype,"testFor",2);l([c()],d.prototype,"testCam",2);l([c()],d.prototype,"testBusy",2);l([c()],d.prototype,"testMsg",2);d=l([z("system-cast")],d);let g=class extends x{constructor(){super(...arguments),this.embedded=!1,this.phase="loading",this.err="",this.data=null,this.watch=new k(this)}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(!v()){this.phase="ready";return}if(!M("media.cast")){this.phase="forbidden";return}this.phase="loading";try{this.data=await T(),this.phase="ready",f.refresh()}catch(e){this.err=w(e),this.phase="error"}}body(){if(!v())return n`<sw-state-panel icon="cast" state="empty" heading=${m("cast.mine")} hint=${s("זמין בהתקנה עם שרת.")}></sw-state-panel>`;if(this.phase==="loading")return n`<sw-state-panel state="loading"></sw-state-panel>`;if(this.phase==="forbidden")return n`<sw-state-panel state="forbidden" data-cast-mine-state="forbidden" heading=${s("אין לך הרשאת שידור")} hint=${s("ההרשאה לשדר למסכים ניתנת על ידי מנהל המערכת.")}></sw-state-panel>`;if(this.phase==="error"||!this.data)return n`<sw-state-panel state="error" data-cast-mine-state="error" heading=${s("לא ניתן לטעון את המסכים")} hint=${this.err} actionLabel=${m("states.retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=this.data;if(!e.ready)return n`<sw-state-panel icon="cast" state="empty" data-cast-mine-state="notready" heading=${m("cast.notReady")} hint=${_("system.configure")?m("cast.notReadyAdmin"):""}></sw-state-panel>`;const t=e.targets.filter(a=>!a.blocked),o=e.targets.filter(a=>a.blocked),i=a=>{const r=q(f.sessions,a.casting_session_id?a.key:""),p=a.blocked?W[a.blocked]:a.state==="casting"&&r?.camera_name?`${y.casting}: ${r.camera_name}`:y[a.state];return n`<div class=${`it ${a.blocked?"no":""}`} data-cast-mine-item=${a.key}><span class="ic"><sw-icon name=${a.blocked?"lock":"media"} size=${18}></sw-icon></span>
        <span class="tx"><span class="nm">${a.name}</span><span class="ln">${[a.floor_name,a.area_name].filter(Boolean).join(" · ")}${a.floor_name||a.area_name?" · ":""}${p}</span></span>
        ${a.blocked?h:n`<span class="muted">${a.permanent_allowed?s("משך קבוע אפשרי")+" · ":""}${a.minutes} ${m("cast.minutes")}</span>`}</div>`};return n`<div data-cast-mine-list>
      <div class="muted">${e.active}/${e.max_sessions} · ${m("cast.mine")}</div>
      ${t.length?n`<div class="list" data-cast-mine-ok>${t.map(i)}</div>`:n`<sw-state-panel icon="cast" state="empty" heading=${m("cast.empty")}></sw-state-panel>`}
      ${o.length?n`<h4>${s("לא זמינים לי")}</h4><div class="list" data-cast-mine-blocked>${o.map(i)}</div>`:h}
    </div>`}render(){return this.watch,this.embedded?n`<sw-card heading=${m("cast.mine")} data-cast-mine>${this.body()}</sw-card>`:n`<sw-page heading=${m("cast.mine")} subheading=${s("המסכים שאפשר לשדר אליהם מצלמה")}><div data-cast-mine>${this.body()}</div></sw-page>`}};g.styles=[C,u`
    :host {
      display: block;
    }
    .list {
      display: flex;
      flex-direction: column;
    }
    .it {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .it:last-child {
      border-block-end: 0;
    }
    .ic {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .tx {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
    }
    .nm {
      font-weight: var(--sw-fw-medium);
    }
    .ln {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    /* POLISH4-WP5: a screen that cannot be cast to is shown quieter by its ink, not by a see-through row (opacity took the name below AA) */
    .it.no .nm {
      color: var(--sw-text-2);
    }
    .nm,
    .ln {
      overflow-wrap: anywhere;
    }
    h4 {
      margin-block: 16px 4px;
      margin-inline: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* a phone: the allowed duration drops under the name instead of squeezing it */
    @media (max-width: 767px) {
      .it {
        flex-wrap: wrap;
      }
      .it > .muted {
        flex: 1 0 100%;
        padding-inline-start: 48px;
      }
    }
  `];l([Y({type:Boolean})],g.prototype,"embedded",2);l([c()],g.prototype,"phase",2);l([c()],g.prototype,"err",2);l([c()],g.prototype,"data",2);g=l([z("cast-my-screens")],g);const ae=Object.freeze(Object.defineProperty({__proto__:null,get CastMyScreens(){return g},get SystemCast(){return d}},Symbol.toStringTag,{value:"Module"}));export{te as a,K as m,ae as s};
