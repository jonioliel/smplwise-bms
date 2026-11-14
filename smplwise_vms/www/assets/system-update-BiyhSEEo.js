import{E as z,F as m,G as n,a as A,AK as P,AL as g,j as D,AM as k,AN as R,A as d,e as s,AO as N,AP as q,AQ as j,H as E,AR as C,AS as H,AT as x,AU as $,AV as F,g as W,be as _,jn as K,K as Y,AW as I,Y as b,AX as B,AY as G,AZ as Z,A_ as Q,vZ as V,gO as X,i as O,fe as f,bQ as J,A$ as tt,B0 as et,B1 as st,s5 as at}from"./index-k1cto_iv.js";import"./sw-logo-art-Va6y_cIM.js";var rt=Object.defineProperty,it=Object.getOwnPropertyDescriptor,h=(t,e,a,i)=>{for(var r=i>1?void 0:i?it(e,a):e,p=t.length-1,o;p>=0;p--)(o=t[p])&&(r=(i?o(e,a,r):o(r))||r);return i&&r&&rt(e,a,r),r};const T=2e3,nt=15e3,ot=90*6e4,dt=1200,lt=10*6e4;function ct(t){return t instanceof D?t.status===401||t.status===502||t.status===503||t.status===504||t.status===0||t.code.startsWith("http_5"):!0}function pt(t){const e=Math.max(0,Math.floor(t/1e3));return`${String(Math.floor(e/60)).padStart(2,"0")}:${String(e%60).padStart(2,"0")}`}let u=class extends A{constructor(){super(...arguments),this.runId="",this.initial=null,this.waitLimitMs=0,this.run=null,this.waiting=!1,this.gaveUp=!1,this.guidance=!1,this.now=Date.now(),this.notFound=!1,this.restartNeeded=!1,this.timer=0,this.tick=0,this.delay=T,this.downSince=0,this.stopped=!1}connectedCallback(){super.connectedCallback(),this.stopped=!1,this.tick=window.setInterval(()=>this.now=Date.now(),1e3),this.poll()}disconnectedCallback(){super.disconnectedCallback(),this.stopped=!0,window.clearTimeout(this.timer),window.clearInterval(this.tick)}limit(){if(this.waitLimitMs>0)return this.waitLimitMs;const t=this.run?.timeout_s??this.initial?.timeout_s;return t&&t>0?t*1e3:(this.run?.kind??this.initial?.kind??"update")==="update"?ot:lt}async poll(){if(!(this.stopped||!this.runId)){try{const t=await P(this.runId);if(this.run=t,this.waiting=!1,this.downSince=0,this.delay=T,g(t.state)){this.afterSettled(t);return}}catch(t){if(!ct(t)){t instanceof D&&t.status===404&&(this.notFound=!0),this.waiting=!1,this.run||(this.gaveUp=!0);return}if(this.waiting=!0,this.downSince||(this.downSince=Date.now()),this.delay=Math.min(nt,Math.round(this.delay*1.5)),Date.now()-this.downSince>this.limit()){this.gaveUp=!0,this.waiting=!1;return}}this.timer=window.setTimeout(()=>void this.poll(),this.delay)}}afterSettled(t){if(t.kind==="update"&&t.state==="succeeded"&&k().then(a=>this.restartNeeded=a.requires_platform_restart===!0).catch(()=>{}),t.kind!=="update"||t.state!=="succeeded"||!t.to_version)return;let e="";try{e="2.43.5"}catch{return}if(!(!e||e===t.to_version)){try{const a="sw.update.reloaded";if(sessionStorage.getItem(a)===t.run_id)return;sessionStorage.setItem(a,t.run_id)}catch{return}window.location.reload()}}dismiss(){this.dispatchEvent(new CustomEvent("run-dismiss",{bubbles:!0,composed:!0,detail:{run:this.run}}))}elapsed(){const t=Date.parse(this.run?.started_at??this.initial?.started_at??"");return pt(Number.isNaN(t)?0:this.now-t)}view(){const t=this.run??this.initial;return{kind:t?.kind??"update",state:t?.state??"requested",backup:!!t?.backup,backup_requested:!!(t?.backup_requested??t?.backup),error_code:t?.error_code??null}}stillWorking(){const t=this.run??this.initial,e=t?.expected_s??(t?.kind==="platform_restart"?600:dt),a=Date.parse(t?.started_at??"");return Number.isNaN(a)?!1:(this.now-a)/1e3>e}renderGuidance(){const t=R(this.run?.backup_state??this.initial?.backup_state);return s`<sw-card heading="הוראות שחזור" data-run-guidance data-run-backup-state=${this.run?.backup_state??this.initial?.backup_state??"unknown"}>
      ${t.note?s`<p class="reason" data-run-backup-note>${t.note}</p>`:d}
      <ol class="how">${t.steps.map(e=>s`<li>${e}</li>`)}</ol>
    </sw-card>`}renderOutcome(t){const e=this.run,a=t.kind==="update";if(e?.state==="succeeded")return s`<sw-card data-run-state="succeeded">
        <div class="stack">
          <div class="outcome ok"><sw-icon name="check" size=${22}></sw-icon><span data-run-outcome>${a?s`המערכת עודכנה לגרסה <span class="ver">${e.to_version??""}</span>`:"תשתית המערכת הופעלה מחדש"}</span></div>
          ${a&&this.restartNeeded?s`<p class="reason" data-run-restart-needed>נדרשת הפעלה מחדש של תשתית המערכת</p>`:d}
          <div class="foot"><sw-button variant="primary" data-run-continue @click=${()=>this.dismiss()}>המשך</sw-button></div>
        </div>
      </sw-card>`;const i=this.gaveUp&&!e?{kind:t.kind,state:"abandoned",error_code:"timeout"}:this.gaveUp&&e&&!g(e.state)?{kind:e.kind,state:"abandoned",error_code:"timeout"}:e??t,r=e&&g(e.state)?e.state:"abandoned",p=this.notFound?"הפעולה לא נמצאה.":N(i),o=a&&q(i),M=r==="abandoned"?a?"העדכון לא הסתיים":"ההפעלה מחדש לא הסתיימה":a?"העדכון נכשל":"ההפעלה מחדש נכשלה",L=i.error_code??r;return s`<div class="stack" data-run-state=${r==="abandoned"?"abandoned":"failed"} data-run-error=${L}>
      <sw-card>
        <div class="stack">
          <div class="outcome bad"><sw-icon name="warning" size=${22}></sw-icon><span data-run-outcome>${M}</span></div>
          <p class="reason" data-run-reason>${p}</p>
          <div class="foot">
            ${o?s`<sw-button data-run-guidance-open aria-expanded=${this.guidance?"true":"false"} @click=${()=>this.guidance=!this.guidance}>הוראות שחזור</sw-button>`:d}
            <sw-button variant="primary" data-run-close @click=${()=>this.dismiss()}>סגור</sw-button>
          </div>
        </div>
      </sw-card>
      ${o&&this.guidance?this.renderGuidance():d}
    </div>`}render(){const t=this.view(),e=this.run;if(e&&g(e.state)||this.gaveUp||this.notFound)return this.renderOutcome(t);const{steps:a,current:i}=j(t),r=e?.timeout_s??this.initial?.timeout_s;return s`<sw-card data-run-state=${e?.state??"requested"} data-run-kind=${t.kind}>
      <div class="stack">
        <ol class="steps" data-run-steps>
          ${a.map((p,o)=>s`<li class="step ${o<i?"done":o===i?"current":""}" data-run-step=${p.id} data-run-step-state=${o<i?"done":o===i?"current":"pending"}>
              <span class="mk">${o<i?s`<sw-icon name="check" size=${14}></sw-icon>`:o===i?s`<sw-icon name="refresh" size=${14}></sw-icon>`:d}</span><span>${p.label}</span>
            </li>`)}
        </ol>
        ${this.stillWorking()?s`<div class="wait" role="status" data-run-still-working><sw-icon name="clock" size=${18}></sw-icon>עדיין עובד…</div>`:d}
        ${this.waiting?s`<div class="wait" role="status" data-run-waiting><sw-icon name="clock" size=${18}></sw-icon>ממתין לחזרת המערכת…</div>`:d}
        <div class="meta">
          <span>זמן שעבר</span><span class="t" data-run-elapsed>${this.elapsed()}</span>
        </div>
        ${t.kind==="platform_restart"&&(e?.expected_s||r)?s`<span class="reason" data-run-expect>עשוי להימשך עד ${Math.max(1,Math.round((e?.expected_s??r??600)/60))} דקות</span>`:d}
      </div>
    </sw-card>`}};u.styles=z`
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
  `;h([m()],u.prototype,"runId",2);h([m({attribute:!1})],u.prototype,"initial",2);h([m({type:Number})],u.prototype,"waitLimitMs",2);h([n()],u.prototype,"run",2);h([n()],u.prototype,"waiting",2);h([n()],u.prototype,"gaveUp",2);h([n()],u.prototype,"guidance",2);h([n()],u.prototype,"now",2);h([n()],u.prototype,"notFound",2);h([n()],u.prototype,"restartNeeded",2);u=h([E("sw-update-run")],u);var ut=Object.defineProperty,ht=Object.getOwnPropertyDescriptor,v=(t,e,a,i)=>{for(var r=i>1?void 0:i?ht(e,a):e,p=t.length-1,o;p>=0;p--)(o=t[p])&&(r=(i?o(e,a,r):o(r))||r);return i&&r&&ut(e,a,r),r};const wt=12e4,ft=3e3,vt=15e3;let w=class extends A{constructor(){super(...arguments),this.required=!1,this.reasons=[],this.busy=!1,this.which="platform",this.phase="idle",this.error="",this.key="",this.timer=0,this.startedAt=0,this.sawDown=!1}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}ask(t){this.which=t,this.error="",this.key=C(),this.phase="confirm"}cancel(){this.phase==="confirm"&&(this.phase="idle")}async confirm(){if(this.phase==="confirm"){if(this.phase="sending",this.error="",this.which==="platform"){try{const t=await H(this.key);this.phase="idle",this.dispatchEvent(new CustomEvent("run-started",{detail:t,bubbles:!0,composed:!0}))}catch(t){this.phase="idle",this.error=x($(t),"restart")}return}try{await F()}catch(t){const e=$(t);this.phase="idle",this.error=x(e,"restart");return}this.phase="waiting",this.startedAt=Date.now(),this.sawDown=!1,this.schedule()}}schedule(){window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.poll(),ft)}async poll(){const t=Date.now()-this.startedAt;try{if(await W("me"),this.sawDown||t>vt){window.location.reload();return}}catch{this.sawDown=!0}if(t>wt){this.phase="manual";return}this.schedule()}again(){this.phase="waiting",this.startedAt=Date.now(),this.sawDown=!1,this.schedule()}render(){const t=this.which==="arx",e=this.busy||this.phase==="sending";return s`<sw-card heading="הפעלות מחדש" data-restarts-card>
      ${this.required?s`<div class="row" data-restart-required><span class="need"><span class="dot" aria-hidden="true"></span>נדרשת הפעלה מחדש של תשתית המערכת</span>${this.reasons.filter(a=>a.code==="bridge").map(a=>s`<span class="lbl" data-restart-reason>רכיב החיבור: ממתינה גרסה ${a.version??"—"}, פועלת ${a.running??"לא דווחה"}</span>`)}</div>`:d}
      ${this.phase==="waiting"?s`<div class="wait" role="status" data-restart-phase="waiting"><sw-icon name="refresh" size=${18}></sw-icon>המערכת מופעלת מחדש…</div>`:this.phase==="manual"?s`<div class="row" role="alert" data-restart-phase="manual"><span class="lbl" data-restart-manual>המערכת לא חזרה. הפעילו ידנית.</span><sw-button data-restart-again @click=${()=>this.again()}>בדקו שוב</sw-button></div>`:s`<div class="rows">
              ${_("system.configure")&&!K()?s`<div class="row"><span class="lbl">Arx</span><sw-button icon="power" ?disabled=${e} data-restart-arx @click=${()=>this.ask("arx")}>הפעל מחדש את Arx</sw-button></div>`:d}
              <div class="row"><span class="lbl">תשתית המערכת</span><sw-button icon="power" variant=${this.required?"primary":"secondary"} ?disabled=${e} data-restart-platform @click=${()=>this.ask("platform")}>הפעל מחדש את תשתית המערכת</sw-button></div>
            </div>`}
      ${this.error?s`<p class="msg err" role="alert" data-restart-error>${this.error}</p>`:d}
    </sw-card>
    <sw-dialog ?open=${this.phase==="confirm"} heading=${t?"להפעיל מחדש את Arx?":"להפעיל מחדש את תשתית המערכת?"}
        subheading=${t?"המערכת לא תהיה זמינה לרגעים אחדים":"Arx יישאר פעיל, אך התשתית לא תהיה זמינה לכמה דקות"} data-restart-dialog data-restart-which=${this.which} @close=${()=>this.cancel()}>
        <div slot="footer">
          <sw-button variant="primary" data-restart-confirm @click=${()=>void this.confirm()}>הפעל מחדש</sw-button>
          <sw-button variant="ghost" data-restart-cancel @click=${()=>this.cancel()}>ביטול</sw-button>
        </div>
      </sw-dialog>`}};w.styles=z`
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
  `;v([m({type:Boolean})],w.prototype,"required",2);v([m({attribute:!1})],w.prototype,"reasons",2);v([m({type:Boolean})],w.prototype,"busy",2);v([n()],w.prototype,"which",2);v([n()],w.prototype,"phase",2);v([n()],w.prototype,"error",2);w=v([E("sw-restarts-card")],w);var mt=Object.defineProperty,gt=Object.getOwnPropertyDescriptor,c=(t,e,a,i)=>{for(var r=i>1?void 0:i?gt(e,a):e,p=t.length-1,o;p>=0;p--)(o=t[p])&&(r=(i?o(e,a,r):o(r))||r);return i&&r&&mt(e,a,r),r};const S="sw.update.run";function U(){try{return sessionStorage.getItem(S)??""}catch{return""}}function y(t){try{t?sessionStorage.setItem(S,t):sessionStorage.removeItem(S)}catch{}}const bt=["בתשתית המערכת: הגדרות ‹ תוספים ‹ SmplWise Arx ‹ בדיקת עדכונים.",'סמנו "גיבוי לפני העדכון" ולחצו על עדכון. ההתקנה נמשכת כמה דקות.','חזרו לכאן ולחצו "בדוק אם יש עדכון". מכאן והלאה העדכונים יתבצעו מתוך Arx.'];let l=class extends A{constructor(){super(...arguments),this.data=null,this.loadError="",this.checking=!1,this.failure=null,this.degraded=!1,this.savingInterval=!1,this.intervalError="",this.tz="Asia/Jerusalem",this.runId="",this.runHint=null,this.confirmOpen=!1,this.backup=!0,this.applying=!1,this.applyError="",this.manualOpen=!1,this.switchSaving=!1,this.switchError="",this.applyKey=""}connectedCallback(){super.connectedCallback(),!this.notHolder()&&(this.load(),Y().then(t=>this.tz=t["time.zone"]??this.tz).catch(()=>{}))}async load(){this.loadError="";try{const t=await k();this.data=t,I(t.update_available,t.requires_platform_restart===!0);const e=t.run?.run_id??t.run?.id??"";e&&!this.runId?(this.runId=e,y(e)):!this.runId&&U()&&(this.runId=U())}catch(t){this.loadError=b(t)}}openConfirm(){this.backup=!0,this.applyError="",this.applyKey=C(),this.confirmOpen=!0}async confirmApply(){const t=this.data?.latest;if(!(this.applying||!t)){this.applying=!0,this.applyError="";try{const e=await B({target_version:t,backup:this.backup,idempotency_key:this.applyKey});this.confirmOpen=!1,this.startRun(e)}catch(e){const a=$(e);this.applyError=x(a,"update"),(a.kind==="not_available"||a.kind==="version_mismatch"||a.kind==="in_progress")&&this.load()}finally{this.applying=!1}}}startRun(t){this.runHint=t,this.runId=t.run_id,y(t.run_id)}endRun(){this.runId="",this.runHint=null,y(""),this.load()}async check(){if(!this.checking){this.checking=!0,this.failure=null,this.degraded=!1;try{const t=await G();this.degraded=!t.refreshed||t.check_result==="refresh_failed_read_ok",this.data={...this.data??{update_available:!1},installed:t.installed,latest:t.latest,update_available:t.update_available,checked_at:t.checked_at,check_result:t.check_result,permitted:"yes"},I(t.update_available)}catch(t){this.failure=Z(t),k().then(e=>this.data=e).catch(()=>{})}finally{this.checking=!1}}}async pickInterval(t){if(!(this.savingInterval||!this.data||this.data.interval_hours===t)){this.savingInterval=!0,this.intervalError="";try{const e=await Q(t);this.data={...this.data,interval_hours:e.interval_hours}}catch(e){this.intervalError=b(e)}finally{this.savingInterval=!1}}}async setApplyEnabled(t){if(!(this.switchSaving||!this.data)){this.switchSaving=!0,this.switchError="";try{const e=await V({"update.apply_enabled":t?"true":"false"});X(),this.data={...this.data,apply_enabled:e.settings["update.apply_enabled"]!=="false"}}catch(e){this.switchError=b(e)}finally{this.switchSaving=!1}}}renderSwitch(t){const e=t.apply_enabled!==!1,a=!O()||_("system.configure");return s`<sw-card heading=${f("selfUpdate.heading")} data-update-switch-card>
      <div class="row">
        <span class="lbl" id="sw-update-switch-lbl">${f("selfUpdate.switchLabel")}</span>
        <span class="seg" role="group" aria-labelledby="sw-update-switch-lbl" data-update-switch data-on=${e?"true":"false"}>
          ${[!0,!1].map(i=>s`<button type="button" data-update-switch-option=${i?"on":"off"} aria-pressed=${e===i?"true":"false"} ?disabled=${!a||this.switchSaving}
              @click=${()=>{e!==i&&this.setApplyEnabled(i)}}>${i?f("selfUpdate.on"):f("selfUpdate.off")}</button>`)}
        </span>
      </div>
      <p class="msg" data-update-switch-hint>${f("selfUpdate.switchHint")}</p>
      ${a?d:s`<p class="msg" data-update-switch-ro>${f("selfUpdate.needsConfigure")}</p>`}
      ${this.switchError?s`<p class="msg err" role="alert" data-update-switch-error>${this.switchError}</p>`:d}
    </sw-card>`}when(t){if(!t)return"";const e=new Date(t);return Number.isNaN(e.getTime())?"":J(e,{timeZone:this.tz})}failureText(t){switch(t.kind){case"rate_limited":return t.wait?`הבדיקה בוצעה זה עתה. נסו שוב בעוד ${t.wait} שניות.`:"הבדיקה בוצעה זה עתה. נסו שוב בעוד רגע.";case"not_permitted":return"חסרה הרשאה בתשתית המערכת, ולכן אי אפשר לבדוק עדכונים.";case"unreachable":return"תשתית המערכת אינה זמינה כרגע.";default:return t.message||"הבדיקה נכשלה. נסו שוב."}}renderStatus(t){return t.checked_at?t.update_available?s`<span class="status avail" data-update-status="available"><sw-icon name="info" size=${16}></sw-icon>יש גרסה חדשה</span>`:t.check_result==="not_permitted"?s`<span class="status" data-update-status="not-permitted">אין הרשאה לבדוק</span>`:t.check_result==="unreachable"||t.check_result==="error"?s`<span class="status" data-update-status="failed">לא ניתן לבדוק</span>`:s`<span class="status up" data-update-status="current"><sw-icon name="check" size=${16}></sw-icon>הגרסה מעודכנת</span>`:s`<span class="status" data-update-status="never">טרם בוצעה בדיקה</span>`}renderNotes(t){if(!t.update_available)return d;const e=t.notes??[];return s`<sw-card heading="מה חדש" data-update-notes>
      ${e.length?e.map(a=>s`<div class="note" data-update-note><h4 class="ver">${a.version}</h4>
              ${a.he?s`<div class="txt" lang="he">${a.he}</div>`:d}${a.en?s`<div class="txt" lang="en">${a.en}</div>`:d}
              ${a.platform_restart?s`<div class="txt" data-update-note-restart>דורש הפעלה מחדש של תשתית המערכת</div>`:d}</div>`):s`<p class="msg" data-update-notes-empty>אין פירוט זמין</p>`}
      ${this.renderApply(t)}
    </sw-card>`}renderApply(t){return t.permitted==="no"||this.failure?.kind==="not_permitted"||!this.failure&&t.check_result==="not_permitted"?s`<div class="apply" data-update-blocked>
        <p class="msg err">ל-Arx אין הרשאה לעדכן את עצמו. נדרש שינוי חד-פעמי בהגדרות ההתקנה.</p>
        <div class="foot"><sw-button size="sm" data-update-manual-open aria-expanded=${this.manualOpen?"true":"false"} @click=${()=>this.manualOpen=!this.manualOpen}>הוראות</sw-button></div>
        ${this.manualOpen?s`<ol class="how" data-update-manual>${bt.map(a=>s`<li>${a}</li>`)}</ol>`:d}
      </div>`:t.apply_enabled===!1?s`<div class="apply" data-update-disabled><p class="msg" role="status">${f("selfUpdate.disabledNotice")}</p></div>`:s`<div class="foot"><sw-button variant="primary" icon="download" data-update-apply @click=${()=>this.openConfirm()}>עדכן</sw-button></div>`}renderConfirm(t){return s`<sw-dialog ?open=${this.confirmOpen} ?locked=${this.applying} heading="לעדכן את SmplWise Arx?" data-update-dialog @close=${()=>this.confirmOpen=!1}>
      <div class="col">
        <div class="msg ver-line" data-update-dialog-versions>מגרסה <span class="ver">${t.installed??"—"}</span> לגרסה <span class="ver">${t.latest??"—"}</span></div>
        <div class="msg">המערכת לא תהיה זמינה כמה דקות</div>
        <label class="chk"><input type="checkbox" data-update-backup .checked=${this.backup} ?disabled=${this.applying} @change=${e=>this.backup=e.target.checked} /><span class="box" aria-hidden="true"></span><span>צור גיבוי לפני העדכון</span></label>
        ${this.applyError?s`<p class="msg err" role="alert" data-update-apply-error>${this.applyError}</p>`:d}
      </div>
      <div slot="footer">
        <sw-button variant="primary" data-update-confirm ?disabled=${this.applying} @click=${()=>void this.confirmApply()}>עדכן עכשיו</sw-button>
        <sw-button variant="ghost" data-update-cancel ?disabled=${this.applying} @click=${()=>this.confirmOpen=!1}>ביטול</sw-button>
      </div>
    </sw-dialog>`}notHolder(){return O()&&!_("system.update")}render(){if(this.notHolder())return s`<sw-page crumbs="הגדרות" heading="עדכונים"><sw-state-panel state="forbidden" data-update-forbidden></sw-state-panel></sw-page>`;const t=this.data;if(!t)return s`<sw-page crumbs="הגדרות" heading="עדכונים">
        ${this.loadError?s`<sw-state-panel state="error" heading="לא ניתן לטעון את מצב העדכונים" hint=${this.loadError} actionLabel="נסו שוב" data-update-load-error @action=${()=>void this.load()}></sw-state-panel>`:s`<sw-state-panel state="loading" data-update-loading></sw-state-panel>`}
      </sw-page>`;if(this.runId)return s`<sw-page crumbs="הגדרות" heading="עדכונים">
        <div class="col" data-system-update data-update-run-page>
          <sw-update-run .runId=${this.runId} .initial=${this.runHint} @run-dismiss=${()=>this.endRun()}></sw-update-run>
        </div>
      </sw-page>`;const e=t.interval_hours??6,a=this.failure?.kind==="not_permitted"||!this.failure&&t.check_result==="not_permitted",i=t.checked_at?`${this.when(t.checked_at)} · ${tt(t.check_result,t.update_available)}`:"טרם בוצעה בדיקה";return s`<sw-page crumbs="הגדרות" heading="עדכונים">
      <div class="col" data-system-update>
        <sw-card heading="גרסה">
          <div class="rows">
            <div class="row"><span class="lbl">גרסה מותקנת</span><span class="val ver" data-update-installed>${t.installed??"—"}</span></div>
            <div class="row"><span class="lbl">הגרסה האחרונה</span><span class="val ver" data-update-latest>${t.latest??"—"}</span></div>
            <div class="row"><span class="lbl">בדיקה אחרונה</span><span class="val" data-update-last>${i}</span></div>
            <div class="row">${this.renderStatus(t)}</div>
          </div>
          <div class="foot">
            <sw-button variant="primary" size="sm" icon="refresh" data-update-check ?disabled=${this.checking} @click=${()=>void this.check()}>${this.checking?"בודק…":"בדוק אם יש עדכון"}</sw-button>
          </div>
          ${this.failure?s`<p class="msg err" role="alert" data-update-failure=${this.failure.kind}>${this.failureText(this.failure)}</p>`:a?s`<p class="msg err" data-update-failure="not_permitted">${this.failureText({kind:"not_permitted"})}</p>`:this.degraded?s`<p class="msg" role="status" data-update-degraded>הרשימה לא רועננה, והבדיקה נעשתה לפי המצב הנוכחי. ייתכן שגרסה חדשה עוד לא מופיעה.</p>`:d}
        </sw-card>
        <sw-card heading="בדיקה אוטומטית" data-update-interval-card>
          <div class="seg" role="group" aria-label="תדירות בדיקה אוטומטית" data-update-interval>
            ${et.map(r=>s`<button type="button" data-update-interval-option=${r} aria-pressed=${e===r?"true":"false"} ?disabled=${this.savingInterval} @click=${()=>void this.pickInterval(r)}>${st(r)}</button>`)}
          </div>
          ${this.intervalError?s`<p class="msg err" role="alert" data-update-interval-error>${this.intervalError}</p>`:d}
        </sw-card>
        ${this.renderSwitch(t)}
        ${this.renderNotes(t)}
        <sw-restarts-card ?required=${t.requires_platform_restart===!0} .reasons=${t.platform_restart_reasons??[]} @run-started=${r=>this.startRun(r.detail)}></sw-restarts-card>
      </div>
      ${this.renderConfirm(t)}
    </sw-page>`}};l.styles=[at,z`
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
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-md);
      flex-wrap: wrap;
      max-inline-size: 100%;
    }
    .seg button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
      padding: 0 14px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-2));
    }
    .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .seg button[disabled] {
      opacity: 0.6;
      cursor: default;
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
  `];c([n()],l.prototype,"data",2);c([n()],l.prototype,"loadError",2);c([n()],l.prototype,"checking",2);c([n()],l.prototype,"failure",2);c([n()],l.prototype,"degraded",2);c([n()],l.prototype,"savingInterval",2);c([n()],l.prototype,"intervalError",2);c([n()],l.prototype,"tz",2);c([n()],l.prototype,"runId",2);c([n()],l.prototype,"runHint",2);c([n()],l.prototype,"confirmOpen",2);c([n()],l.prototype,"backup",2);c([n()],l.prototype,"applying",2);c([n()],l.prototype,"applyError",2);c([n()],l.prototype,"manualOpen",2);c([n()],l.prototype,"switchSaving",2);c([n()],l.prototype,"switchError",2);l=c([E("system-update")],l);export{l as SystemUpdate};
//# sourceMappingURL=system-update-BiyhSEEo.js.map
