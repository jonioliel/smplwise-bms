import{a as L,g as I,ax as b,j as o,i as A,mG as q,mH as y,mI as x,mJ as H,A as l,b as a,mK as j,mL as W,mM as F,k as O,mN as M,mO as K,mP as _,mQ as S,mR as G,b5 as B,cw as h,aA as E,mn as Y,p as V,mS as T,n as $,mT as J,mU as X,mV as Z,mW as Q,kq as tt,dL as et,a2 as U,ey as m,aI as at,dE as r,mX as st,mY as R,mZ as rt}from"./index-CPuzFb4-.js";import{a as it}from"./settings-BBKucUsS.js";import"./sw-logo-art-PLtEZJxU.js";const nt=new Set(["internal_error","database_busy"]);function ot(t){return t instanceof L?t.status===401||t.status===502||t.status===503||t.status===504||t.status===0||t.code.startsWith("http_5")||t.status===500&&nt.has(t.code):!0}var dt=Object.defineProperty,lt=Object.getOwnPropertyDescriptor,v=(t,e,s,n)=>{for(var i=n>1?void 0:n?lt(e,s):e,p=t.length-1,d;p>=0;p--)(d=t[p])&&(i=(n?d(e,s,i):d(i))||i);return n&&i&&dt(e,s,i),i};const C=2e3,ct=15e3,pt=90*6e4,ut=1200,ht=10*6e4;function wt(t){const e=Math.max(0,Math.floor(t/1e3));return`${String(Math.floor(e/60)).padStart(2,"0")}:${String(e%60).padStart(2,"0")}`}let w=class extends A{constructor(){super(...arguments),this.runId="",this.initial=null,this.waitLimitMs=0,this.run=null,this.waiting=!1,this.gaveUp=!1,this.guidance=!1,this.now=Date.now(),this.notFound=!1,this.restartNeeded=!1,this.timer=0,this.tick=0,this.delay=C,this.downSince=0,this.stopped=!1}connectedCallback(){super.connectedCallback(),this.stopped=!1,this.tick=window.setInterval(()=>this.now=Date.now(),1e3),this.poll()}disconnectedCallback(){super.disconnectedCallback(),this.stopped=!0,window.clearTimeout(this.timer),window.clearInterval(this.tick)}limit(){if(this.waitLimitMs>0)return this.waitLimitMs;const t=this.run?.timeout_s??this.initial?.timeout_s;return t&&t>0?t*1e3:(this.run?.kind??this.initial?.kind??"update")==="update"?pt:ht}async poll(){if(!(this.stopped||!this.runId)){try{const t=await q(this.runId);if(this.run=t,this.waiting=!1,this.downSince=0,this.delay=C,y(t.state)){this.afterSettled(t);return}}catch(t){if(!ot(t)){t instanceof L&&t.status===404&&(this.notFound=!0),this.waiting=!1,this.run||(this.gaveUp=!0);return}if(this.waiting=!0,this.downSince||(this.downSince=Date.now()),this.delay=Math.min(ct,Math.round(this.delay*1.5)),Date.now()-this.downSince>this.limit()){this.gaveUp=!0,this.waiting=!1;return}}this.timer=window.setTimeout(()=>void this.poll(),this.delay)}}afterSettled(t){if(t.kind==="update"&&t.state==="succeeded"&&x().then(s=>this.restartNeeded=s.requires_platform_restart===!0).catch(()=>{}),t.kind!=="update"||t.state!=="succeeded"||!t.to_version)return;let e="";try{e="2.47.0"}catch{return}if(!(!e||e===t.to_version)){try{const s="sw.update.reloaded";if(sessionStorage.getItem(s)===t.run_id)return;sessionStorage.setItem(s,t.run_id)}catch{return}window.location.reload()}}dismiss(){this.dispatchEvent(new CustomEvent("run-dismiss",{bubbles:!0,composed:!0,detail:{run:this.run}}))}elapsed(){const t=Date.parse(this.run?.started_at??this.initial?.started_at??"");return wt(Number.isNaN(t)?0:this.now-t)}view(){const t=this.run??this.initial;return{kind:t?.kind??"update",state:t?.state??"requested",backup:!!t?.backup,backup_requested:!!(t?.backup_requested??t?.backup),error_code:t?.error_code??null}}stillWorking(){const t=this.run??this.initial,e=t?.expected_s??(t?.kind==="platform_restart"?600:ut),s=Date.parse(t?.started_at??"");return Number.isNaN(s)?!1:(this.now-s)/1e3>e}renderGuidance(){const t=H(this.run?.backup_state??this.initial?.backup_state);return a`<sw-card heading="הוראות שחזור" data-run-guidance data-run-backup-state=${this.run?.backup_state??this.initial?.backup_state??"unknown"}>
      ${t.note?a`<p class="reason" data-run-backup-note>${t.note}</p>`:l}
      <ol class="how">${t.steps.map(e=>a`<li>${e}</li>`)}</ol>
    </sw-card>`}renderOutcome(t){const e=this.run,s=t.kind==="update";if(e?.state==="succeeded")return a`<sw-card data-run-state="succeeded">
        <div class="stack">
          <div class="outcome ok"><sw-icon name="check" size=${22}></sw-icon><span data-run-outcome>${s?a`המערכת עודכנה לגרסה <span class="ver">${e.to_version??""}</span>`:"תשתית המערכת הופעלה מחדש"}</span></div>
          ${s&&this.restartNeeded?a`<p class="reason" data-run-restart-needed>נדרשת הפעלה מחדש של תשתית המערכת</p>`:l}
          <div class="foot"><sw-button variant="primary" data-run-continue @click=${()=>this.dismiss()}>המשך</sw-button></div>
        </div>
      </sw-card>`;const n=this.gaveUp&&!e?{kind:t.kind,state:"abandoned",error_code:"timeout"}:this.gaveUp&&e&&!y(e.state)?{kind:e.kind,state:"abandoned",error_code:"timeout"}:e??t,i=e&&y(e.state)?e.state:"abandoned",p=this.notFound?"הפעולה לא נמצאה.":j(n),d=s&&W(n),P=i==="abandoned"?s?"העדכון לא הסתיים":"ההפעלה מחדש לא הסתיימה":s?"העדכון נכשל":"ההפעלה מחדש נכשלה",N=n.error_code??i;return a`<div class="stack" data-run-state=${i==="abandoned"?"abandoned":"failed"} data-run-error=${N}>
      <sw-card>
        <div class="stack">
          <div class="outcome bad"><sw-icon name="warning" size=${22}></sw-icon><span data-run-outcome>${P}</span></div>
          <p class="reason" data-run-reason>${p}</p>
          <div class="foot">
            ${d?a`<sw-button data-run-guidance-open aria-expanded=${this.guidance?"true":"false"} @click=${()=>this.guidance=!this.guidance}>הוראות שחזור</sw-button>`:l}
            <sw-button variant="primary" data-run-close @click=${()=>this.dismiss()}>סגור</sw-button>
          </div>
        </div>
      </sw-card>
      ${d&&this.guidance?this.renderGuidance():l}
    </div>`}render(){const t=this.view(),e=this.run;if(e&&y(e.state)||this.gaveUp||this.notFound)return this.renderOutcome(t);const{steps:s,current:n}=F(t),i=e?.timeout_s??this.initial?.timeout_s;return a`<sw-card data-run-state=${e?.state??"requested"} data-run-kind=${t.kind}>
      <div class="stack">
        <ol class="steps" data-run-steps>
          ${s.map((p,d)=>a`<li class="step ${d<n?"done":d===n?"current":""}" data-run-step=${p.id} data-run-step-state=${d<n?"done":d===n?"current":"pending"}>
              <span class="mk">${d<n?a`<sw-icon name="check" size=${14}></sw-icon>`:d===n?a`<sw-icon name="refresh" size=${14}></sw-icon>`:l}</span><span>${p.label}</span>
            </li>`)}
        </ol>
        ${this.stillWorking()?a`<div class="wait" role="status" data-run-still-working><sw-icon name="clock" size=${18}></sw-icon>עדיין עובד…</div>`:l}
        ${this.waiting?a`<div class="wait" role="status" data-run-waiting><sw-icon name="clock" size=${18}></sw-icon>ממתין לחזרת המערכת…</div>`:l}
        <div class="meta">
          <span>זמן שעבר</span><span class="t" data-run-elapsed>${this.elapsed()}</span>
        </div>
        ${t.kind==="platform_restart"&&(e?.expected_s||i)?a`<span class="reason" data-run-expect>עשוי להימשך עד ${Math.max(1,Math.round((e?.expected_s??i??600)/60))} דקות</span>`:l}
      </div>
    </sw-card>`}};w.styles=I`
    :host {
      display: block;
    }
    .stack {
      display: grid;
      gap: 12px;
    }
    .steps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 44px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-md);
    }
    .step .mk {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-3);
    }
    .step.done {
      color: var(--sw-text-2);
    }
    .step.done .mk {
      background: var(--sw-live);
      border-color: var(--sw-live);
      color: var(--sw-text-inverse);
    }
    .step.current {
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .step.current .mk {
      border-color: var(--sw-accent);
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .step.current .mk sw-icon {
      animation: spin 1.2s linear infinite;
    }
    .step.failed .mk {
      background: var(--sw-danger);
      border-color: var(--sw-danger);
      color: var(--sw-text-inverse);
    }
    .step.failed {
      color: var(--sw-danger-text, var(--sw-danger));
      font-weight: var(--sw-fw-semibold);
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .step.current .mk sw-icon {
        animation: none;
      }
    }
    .meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding-block-start: 8px;
      border-block-start: 1px solid var(--sw-border);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
    }
    .meta .t {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-semibold);
    }
    .wait {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--sw-warning-text, var(--sw-text-2));
      font-weight: var(--sw-fw-semibold);
    }
    .outcome {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
    }
    .outcome.ok {
      color: var(--sw-live);
    }
    .outcome.bad {
      color: var(--sw-danger);
    }
    .reason {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      overflow-wrap: anywhere;
    }
    .ver {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .foot {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    /* touch layouts: every button is a 44 px target (the inner button stretches to the host) */
    @media (max-width: 1100px) {
      sw-button {
        min-block-size: 44px;
      }
    }
    ol.how {
      margin: 0;
      padding-inline-start: 22px;
      display: grid;
      gap: 8px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
    }
  `;v([b()],w.prototype,"runId",2);v([b({attribute:!1})],w.prototype,"initial",2);v([b({type:Number})],w.prototype,"waitLimitMs",2);v([o()],w.prototype,"run",2);v([o()],w.prototype,"waiting",2);v([o()],w.prototype,"gaveUp",2);v([o()],w.prototype,"guidance",2);v([o()],w.prototype,"now",2);v([o()],w.prototype,"notFound",2);v([o()],w.prototype,"restartNeeded",2);w=v([O("sw-update-run")],w);var vt=Object.defineProperty,ft=Object.getOwnPropertyDescriptor,g=(t,e,s,n)=>{for(var i=n>1?void 0:n?ft(e,s):e,p=t.length-1,d;p>=0;p--)(d=t[p])&&(i=(n?d(e,s,i):d(i))||i);return n&&i&&vt(e,s,i),i};const mt=12e4,gt=3e3,bt=15e3;let f=class extends A{constructor(){super(...arguments),this.required=!1,this.reasons=[],this.busy=!1,this.which="platform",this.phase="idle",this.error="",this.key="",this.timer=0,this.startedAt=0,this.sawDown=!1}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}ask(t){this.which=t,this.error="",this.key=M(),this.phase="confirm"}cancel(){this.phase==="confirm"&&(this.phase="idle")}async confirm(){if(this.phase==="confirm"){if(this.phase="sending",this.error="",this.which==="platform"){try{const t=await K(this.key);this.phase="idle",this.dispatchEvent(new CustomEvent("run-started",{detail:t,bubbles:!0,composed:!0}))}catch(t){this.phase="idle",this.error=_(S(t),"restart")}return}try{await G()}catch(t){const e=S(t);this.phase="idle",this.error=_(e,"restart");return}this.phase="waiting",this.startedAt=Date.now(),this.sawDown=!1,this.schedule()}}schedule(){window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.poll(),gt)}async poll(){const t=Date.now()-this.startedAt;try{if(await B("me"),this.sawDown||t>bt){window.location.reload();return}}catch{this.sawDown=!0}if(t>mt){this.phase="manual";return}this.schedule()}again(){this.phase="waiting",this.startedAt=Date.now(),this.sawDown=!1,this.schedule()}render(){const t=this.which==="arx",e=this.busy||this.phase==="sending";return a`<sw-card heading=${h("הפעלות מחדש")} data-restarts-card>
      ${this.required?a`<div class="row" data-restart-required><span class="need"><span class="dot" aria-hidden="true"></span>${h("נדרשת הפעלה מחדש של תשתית המערכת")}</span>${this.reasons.filter(s=>s.code==="bridge").map(s=>a`<span class="lbl" data-restart-reason>${h("רכיב החיבור: ממתינה גרסה {pending}, פועלת {running}",{pending:s.version??"—",running:s.running??h("לא דווחה")})}</span>`)}</div>`:l}
      ${this.phase==="waiting"?a`<div class="wait" role="status" data-restart-phase="waiting"><sw-icon name="refresh" size=${18}></sw-icon>${h("המערכת מופעלת מחדש…")}</div>`:this.phase==="manual"?a`<div class="row" role="alert" data-restart-phase="manual"><span class="lbl" data-restart-manual>${h("המערכת לא חזרה. הפעילו ידנית.")}</span><sw-button data-restart-again @click=${()=>this.again()}>${h("בדקו שוב")}</sw-button></div>`:a`<div class="rows">
              ${E("system.configure")&&!Y()?a`<div class="row"><span class="lbl">Arx</span><sw-button icon="power" ?disabled=${e} data-restart-arx @click=${()=>this.ask("arx")}>${h("הפעל מחדש את Arx")}</sw-button></div>`:l}
              <div class="row"><span class="lbl">${h("תשתית המערכת")}</span><sw-button icon="power" variant=${this.required?"primary":"secondary"} ?disabled=${e} data-restart-platform @click=${()=>this.ask("platform")}>${h("הפעל מחדש את תשתית המערכת")}</sw-button></div>
            </div>`}
      ${this.error?a`<p class="msg err" role="alert" data-restart-error>${this.error}</p>`:l}
    </sw-card>
    <sw-dialog ?open=${this.phase==="confirm"} heading=${t?h("להפעיל מחדש את Arx?"):h("להפעיל מחדש את תשתית המערכת?")}
        subheading=${t?h("המערכת לא תהיה זמינה לרגעים אחדים"):h("Arx יישאר פעיל, אך התשתית לא תהיה זמינה לכמה דקות")} data-restart-dialog data-restart-which=${this.which} @close=${()=>this.cancel()}>
        <div slot="footer">
          <sw-button variant="primary" data-restart-confirm @click=${()=>void this.confirm()}>${h("הפעל מחדש")}</sw-button>
          <sw-button variant="ghost" data-restart-cancel @click=${()=>this.cancel()}>${h("ביטול")}</sw-button>
        </div>
      </sw-dialog>`}};f.styles=I`
    :host {
      display: block;
    }
    .rows {
      display: grid;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 0;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .need {
      display: flex;
      align-items: center;
      gap: 8px;
      min-inline-size: 0;
      color: var(--sw-warning-text, var(--sw-text-2));
      font-weight: var(--sw-fw-semibold);
    }
    .need .dot {
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-accent);
    }
    .lbl {
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      overflow-wrap: anywhere;
    }
    .msg {
      margin: 0;
      padding-block-start: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .msg.err {
      color: var(--sw-danger);
    }
    .wait {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 0;
      font-weight: var(--sw-fw-semibold);
    }
    .wait sw-icon {
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .wait sw-icon {
        animation: none;
      }
    }
    /* touch layouts: every button is a 44 px target (the inner button stretches to the host) */
    @media (max-width: 1100px) {
      sw-button {
        min-block-size: 44px;
      }
    }
  `;g([b({type:Boolean})],f.prototype,"required",2);g([b({attribute:!1})],f.prototype,"reasons",2);g([b({type:Boolean})],f.prototype,"busy",2);g([o()],f.prototype,"which",2);g([o()],f.prototype,"phase",2);g([o()],f.prototype,"error",2);f=g([O("sw-restarts-card")],f);var yt=Object.defineProperty,$t=Object.getOwnPropertyDescriptor,u=(t,e,s,n)=>{for(var i=n>1?void 0:n?$t(e,s):e,p=t.length-1,d;p>=0;p--)(d=t[p])&&(i=(n?d(e,s,i):d(i))||i);return n&&i&&yt(e,s,i),i};const z="sw.update.run";function D(){try{return sessionStorage.getItem(z)??""}catch{return""}}function k(t){try{t?sessionStorage.setItem(z,t):sessionStorage.removeItem(z)}catch{}}const kt=[r("בתשתית המערכת: הגדרות ‹ תוספים ‹ SmplWise Arx ‹ בדיקת עדכונים."),r('סמנו "גיבוי לפני העדכון" ולחצו על עדכון. ההתקנה נמשכת כמה דקות.'),r('חזרו לכאן ולחצו "בדוק אם יש עדכון". מכאן והלאה העדכונים יתבצעו מתוך Arx.')];let c=class extends A{constructor(){super(...arguments),this.data=null,this.loadError="",this.checking=!1,this.failure=null,this.degraded=!1,this.savingInterval=!1,this.intervalError="",this.tz="Asia/Jerusalem",this.runId="",this.runHint=null,this.confirmOpen=!1,this.backup=!0,this.applying=!1,this.applyError="",this.manualOpen=!1,this.switchSaving=!1,this.switchError="",this.applyKey=""}connectedCallback(){super.connectedCallback(),!this.notHolder()&&(this.load(),V().then(t=>this.tz=t["time.zone"]??this.tz).catch(()=>{}))}async load(){this.loadError="";try{const t=await x();this.data=t,T(t.update_available,t.requires_platform_restart===!0);const e=t.run?.run_id??t.run?.id??"";e&&!this.runId?(this.runId=e,k(e)):!this.runId&&D()&&(this.runId=D())}catch(t){this.loadError=$(t)}}openConfirm(){this.backup=!0,this.applyError="",this.applyKey=M(),this.confirmOpen=!0}async confirmApply(){const t=this.data?.latest;if(!(this.applying||!t)){this.applying=!0,this.applyError="";try{const e=await J({target_version:t,backup:this.backup,idempotency_key:this.applyKey});this.confirmOpen=!1,this.startRun(e)}catch(e){const s=S(e);this.applyError=_(s,"update"),(s.kind==="not_available"||s.kind==="version_mismatch"||s.kind==="in_progress")&&this.load()}finally{this.applying=!1}}}startRun(t){this.runHint=t,this.runId=t.run_id,k(t.run_id)}endRun(){this.runId="",this.runHint=null,k(""),this.load()}async check(){if(!this.checking){this.checking=!0,this.failure=null,this.degraded=!1;try{const t=await X();this.degraded=!t.refreshed||t.check_result==="refresh_failed_read_ok",this.data={...this.data??{update_available:!1},installed:t.installed,latest:t.latest,update_available:t.update_available,checked_at:t.checked_at,check_result:t.check_result,permitted:"yes"},T(t.update_available)}catch(t){this.failure=Z(t),x().then(e=>this.data=e).catch(()=>{})}finally{this.checking=!1}}}async pickInterval(t){if(!(this.savingInterval||!this.data||this.data.interval_hours===t)){this.savingInterval=!0,this.intervalError="";try{const e=await Q(t);this.data={...this.data,interval_hours:e.interval_hours}}catch(e){this.intervalError=$(e)}finally{this.savingInterval=!1}}}async setApplyEnabled(t){if(!(this.switchSaving||!this.data)){this.switchSaving=!0,this.switchError="";try{const e=await tt({"update.apply_enabled":t?"true":"false"});et(),this.data={...this.data,apply_enabled:e.settings["update.apply_enabled"]!=="false"}}catch(e){this.switchError=$(e)}finally{this.switchSaving=!1}}}renderSwitch(t){const e=t.apply_enabled!==!1,s=!U()||E("system.configure");return a`<sw-card heading=${m("selfUpdate.heading")} data-update-switch-card>
      <div class="row">
        <span class="lbl" id="sw-update-switch-lbl">${m("selfUpdate.switchLabel")}</span>
        <sw-segmented label=${m("selfUpdate.switchLabel")} data-update-switch data-on=${e?"true":"false"} value=${e?"on":"off"} ?disabled=${!s||this.switchSaving}
          @change=${n=>{const i=n.detail.value==="on";e!==i&&this.setApplyEnabled(i)}}
          .options=${[!0,!1].map(n=>({value:n?"on":"off",label:n?m("selfUpdate.on"):m("selfUpdate.off"),attrs:{"data-update-switch-option":n?"on":"off"}}))}></sw-segmented>
      </div>
      <p class="msg" data-update-switch-hint>${m("selfUpdate.switchHint")}</p>
      ${s?l:a`<p class="msg" data-update-switch-ro>${m("selfUpdate.needsConfigure")}</p>`}
      ${this.switchError?a`<p class="msg err" role="alert" data-update-switch-error>${this.switchError}</p>`:l}
    </sw-card>`}when(t){if(!t)return"";const e=new Date(t);return Number.isNaN(e.getTime())?"":at(e,{timeZone:this.tz})}failureText(t){switch(t.kind){case"rate_limited":return t.wait?r("הבדיקה בוצעה זה עתה. נסו שוב בעוד {n} שניות.",{n:t.wait}):r("הבדיקה בוצעה זה עתה. נסו שוב בעוד רגע.");case"not_permitted":return r("חסרה הרשאה בתשתית המערכת, ולכן אי אפשר לבדוק עדכונים.");case"unreachable":return r("תשתית המערכת אינה זמינה כרגע.");default:return t.message||r("הבדיקה נכשלה. נסו שוב.")}}renderStatus(t){return t.checked_at?t.update_available?a`<span class="status avail" data-update-status="available"><sw-icon name="info" size=${16}></sw-icon>${r("יש גרסה חדשה")}</span>`:t.check_result==="not_permitted"?a`<span class="status" data-update-status="not-permitted">${r("אין הרשאה לבדוק")}</span>`:t.check_result==="unreachable"||t.check_result==="error"?a`<span class="status" data-update-status="failed">${r("לא ניתן לבדוק")}</span>`:a`<span class="status up" data-update-status="current"><sw-icon name="check" size=${16}></sw-icon>${r("הגרסה מעודכנת")}</span>`:a`<span class="status" data-update-status="never">${r("טרם בוצעה בדיקה")}</span>`}renderNotes(t){if(!t.update_available)return l;const e=t.notes??[];return a`<sw-card heading=${r("מה חדש")} data-update-notes>
      ${e.length?e.map(s=>a`<div class="note" data-update-note><h4 class="ver">${s.version}</h4>
              ${s.he?a`<div class="txt" lang="he">${s.he}</div>`:l}${s.en?a`<div class="txt" lang="en">${s.en}</div>`:l}
              ${s.platform_restart?a`<div class="txt" data-update-note-restart>${r("דורש הפעלה מחדש של תשתית המערכת")}</div>`:l}</div>`):a`<p class="msg" data-update-notes-empty>${r("אין פירוט זמין")}</p>`}
      ${this.renderApply(t)}
    </sw-card>`}renderApply(t){return t.permitted==="no"||this.failure?.kind==="not_permitted"||!this.failure&&t.check_result==="not_permitted"?a`<div class="apply" data-update-blocked>
        <p class="msg err">${r("ל-Arx אין הרשאה לעדכן את עצמו. נדרש שינוי חד-פעמי בהגדרות ההתקנה.")}</p>
        <div class="foot"><sw-button size="sm" data-update-manual-open aria-expanded=${this.manualOpen?"true":"false"} @click=${()=>this.manualOpen=!this.manualOpen}>${r("הוראות")}</sw-button></div>
        ${this.manualOpen?a`<ol class="how" data-update-manual>${kt.map(s=>a`<li>${s}</li>`)}</ol>`:l}
      </div>`:t.apply_enabled===!1?a`<div class="apply" data-update-disabled><p class="msg" role="status">${m("selfUpdate.disabledNotice")}</p></div>`:a`<div class="foot"><sw-button variant="primary" icon="download" data-update-apply @click=${()=>this.openConfirm()}>${r("עדכן")}</sw-button></div>`}renderConfirm(t){return a`<sw-dialog ?open=${this.confirmOpen} ?locked=${this.applying} heading=${r("לעדכן את SmplWise Arx?")} data-update-dialog @close=${()=>this.confirmOpen=!1}>
      <div class="col">
        <div class="msg ver-line" data-update-dialog-versions>${r("מגרסה")} <span class="ver">${t.installed??"—"}</span> ${r("לגרסה")} <span class="ver">${t.latest??"—"}</span></div>
        <div class="msg">${r("המערכת לא תהיה זמינה כמה דקות")}</div>
        <label class="chk"><input type="checkbox" data-update-backup .checked=${this.backup} ?disabled=${this.applying} @change=${e=>this.backup=e.target.checked} /><span class="box" aria-hidden="true"></span><span>${r("צור גיבוי לפני העדכון")}</span></label>
        ${this.applyError?a`<p class="msg err" role="alert" data-update-apply-error>${this.applyError}</p>`:l}
      </div>
      <div slot="footer">
        <sw-button variant="primary" data-update-confirm ?disabled=${this.applying} @click=${()=>void this.confirmApply()}>${r("עדכן עכשיו")}</sw-button>
        <sw-button variant="ghost" data-update-cancel ?disabled=${this.applying} @click=${()=>this.confirmOpen=!1}>${r("ביטול")}</sw-button>
      </div>
    </sw-dialog>`}notHolder(){return U()&&!E("system.update")}render(){if(this.notHolder())return a`<sw-page crumbs=${r("הגדרות")} heading=${r("עדכונים")}><sw-state-panel state="forbidden" data-update-forbidden></sw-state-panel></sw-page>`;const t=this.data;if(!t)return a`<sw-page crumbs=${r("הגדרות")} heading=${r("עדכונים")}>
        ${this.loadError?a`<sw-state-panel state="error" heading=${r("לא ניתן לטעון את מצב העדכונים")} hint=${this.loadError} actionLabel=${r("נסו שוב")} data-update-load-error @action=${()=>void this.load()}></sw-state-panel>`:a`<sw-state-panel state="loading" data-update-loading></sw-state-panel>`}
      </sw-page>`;if(this.runId)return a`<sw-page crumbs=${r("הגדרות")} heading=${r("עדכונים")}>
        <div class="col" data-system-update data-update-run-page>
          <sw-update-run .runId=${this.runId} .initial=${this.runHint} @run-dismiss=${()=>this.endRun()}></sw-update-run>
        </div>
      </sw-page>`;const e=t.interval_hours??6,s=this.failure?.kind==="not_permitted"||!this.failure&&t.check_result==="not_permitted",n=t.checked_at?`${this.when(t.checked_at)} · ${st(t.check_result,t.update_available)}`:r("טרם בוצעה בדיקה");return a`<sw-page crumbs=${r("הגדרות")} heading=${r("עדכונים")}>
      <div class="col" data-system-update>
        <sw-card heading=${r("גרסה")}>
          <div class="rows">
            <div class="row"><span class="lbl">${r("גרסה מותקנת")}</span><span class="val ver" data-update-installed>${t.installed??"—"}</span></div>
            <div class="row"><span class="lbl">${r("הגרסה האחרונה")}</span><span class="val ver" data-update-latest>${t.latest??"—"}</span></div>
            <div class="row"><span class="lbl">${r("בדיקה אחרונה")}</span><span class="val" data-update-last>${n}</span></div>
            <div class="row">${this.renderStatus(t)}</div>
          </div>
          <div class="foot">
            <sw-button variant="primary" size="sm" icon="refresh" data-update-check ?disabled=${this.checking} @click=${()=>void this.check()}>${this.checking?r("בודק…"):r("בדוק אם יש עדכון")}</sw-button>
          </div>
          ${this.failure?a`<p class="msg err" role="alert" data-update-failure=${this.failure.kind}>${this.failureText(this.failure)}</p>`:s?a`<p class="msg err" data-update-failure="not_permitted">${this.failureText({kind:"not_permitted"})}</p>`:this.degraded?a`<p class="msg" role="status" data-update-degraded>${r("הרשימה לא רועננה, והבדיקה נעשתה לפי המצב הנוכחי. ייתכן שגרסה חדשה עוד לא מופיעה.")}</p>`:l}
        </sw-card>
        <sw-card heading=${r("בדיקה אוטומטית")} data-update-interval-card>
          <sw-segmented label=${r("תדירות בדיקה אוטומטית")} data-update-interval value=${String(e)} ?disabled=${this.savingInterval}
            @change=${i=>{const p=R.find(d=>String(d)===i.detail.value);p!==void 0&&this.pickInterval(p)}}
            .options=${R.map(i=>({value:String(i),label:rt(i),attrs:{"data-update-interval-option":String(i)}}))}></sw-segmented>
          ${this.intervalError?a`<p class="msg err" role="alert" data-update-interval-error>${this.intervalError}</p>`:l}
        </sw-card>
        ${this.renderSwitch(t)}
        ${this.renderNotes(t)}
        <sw-restarts-card ?required=${t.requires_platform_restart===!0} .reasons=${t.platform_restart_reasons??[]} @run-started=${i=>this.startRun(i.detail)}></sw-restarts-card>
      </div>
      ${this.renderConfirm(t)}
    </sw-page>`}};c.styles=[it,I`
    :host {
      display: block;
    }
    .rows {
      display: grid;
    }
    /* R5-SYSTEM-297: a fact row is a well (surface-2) with a 17/700 value in the heading ink */
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      min-inline-size: 0;
    }
    .row + .row {
      margin-block-start: 6px;
    }
    .lbl {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .val {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.01em;
      color: var(--sw-heading, var(--sw-text));
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .ver {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .col {
      display: grid;
      gap: 12px;
    }
    /* status as a filled field, not a coloured word */
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 30px;
      padding: 2px 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
    }
    .status.up {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .status.avail {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .msg {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .msg.err {
      color: var(--sw-danger);
    }
    .foot {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-block-start: 12px;
    }
    /* CR-CMP2-SEGMENTED-B-2450: the update page's keys keep their 44 px height (sw-segmented) */
    sw-segmented {
      --sw-seg-h: 44px;
    }
    .note {
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .note:last-child {
      border-block-end: 0;
    }
    .note h4 {
      margin: 0 0 4px;
      font-size: var(--sw-fs-md);
    }
    .note .txt {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .apply {
      display: grid;
      gap: 8px;
      margin-block-start: 12px;
    }
    ol.how {
      margin: 0;
      padding-inline-start: 22px;
      display: grid;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    /* the checkbox row is one 44 px target: the native input covers the whole row (invisible), the box is drawn beside the text */
    .chk {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      cursor: pointer;
      font-size: var(--sw-fs-md);
    }
    .chk input {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
    .chk .box {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border: 2px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
    }
    .chk input:checked + .box {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .chk input:checked + .box::after {
      content: '';
      inline-size: 6px;
      block-size: 11px;
      border: solid var(--sw-text-inverse);
      border-width: 0 2px 2px 0;
      transform: translateY(-1px) rotate(45deg);
    }
    .chk input:focus-visible + .box {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .chk input:disabled + .box {
      opacity: var(--sw-disabled-opacity);
    }
    /* touch layouts: every button of this screen is a 44 px target (the inner button stretches to the host) */
    @media (max-width: 1100px) {
      sw-button {
        min-block-size: 44px;
      }
    }
    .note .txt[lang='en'] {
      direction: ltr;
      text-align: start;
    }
  `];u([o()],c.prototype,"data",2);u([o()],c.prototype,"loadError",2);u([o()],c.prototype,"checking",2);u([o()],c.prototype,"failure",2);u([o()],c.prototype,"degraded",2);u([o()],c.prototype,"savingInterval",2);u([o()],c.prototype,"intervalError",2);u([o()],c.prototype,"tz",2);u([o()],c.prototype,"runId",2);u([o()],c.prototype,"runHint",2);u([o()],c.prototype,"confirmOpen",2);u([o()],c.prototype,"backup",2);u([o()],c.prototype,"applying",2);u([o()],c.prototype,"applyError",2);u([o()],c.prototype,"manualOpen",2);u([o()],c.prototype,"switchSaving",2);u([o()],c.prototype,"switchError",2);c=u([O("system-update")],c);export{c as SystemUpdate};
