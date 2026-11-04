import{cF as C,j as z,eD as w,g as N,b8 as j,E,F as m,G as n,a as I,zV as k,A as d,e as a,H as A,aw as _,iI as H,K as W,zW as T,T as g,zX as G,zY as K,zZ as Y,vb as B,g8 as J,i as O,b6 as X,z_ as V,z$ as Z,A0 as Q,rv as tt}from"./index-CNy_qMuw.js";import"./sw-logo-art-Va6y_cIM.js";const et=["succeeded","failed","abandoned"],b=t=>!!t&&et.includes(t);function L(){try{if(typeof crypto<"u"&&typeof crypto.randomUUID=="function")return crypto.randomUUID()}catch{}return Array.from({length:4},()=>Math.random().toString(16).slice(2,10).padEnd(8,"0")).join("-")}const at=t=>C("system/update/apply",{method:"POST",body:JSON.stringify({...t,confirm:!0})}),st=t=>C("system/update/restart-platform",{method:"POST",body:JSON.stringify({confirm:!0,idempotency_key:t})}),rt=t=>N(`system/update/runs/${encodeURIComponent(t)}`),it=()=>j("system/restart",{confirm:!0});function x(t){if(t instanceof z)switch(t.code){case"update_in_progress":return{kind:"in_progress"};case"update_running":return{kind:"update_running"};case"update_not_available":return{kind:"not_available"};case"target_version_mismatch":return{kind:"version_mismatch"};case"platform_busy":return{kind:"busy"};case"nvr_write_in_progress":return{kind:"nvr_write"};case"idempotency_key_reused":return{kind:"key_reused"};case"platform_not_permitted":return{kind:"not_permitted"};case"infrastructure_unreachable":return{kind:"unreachable"};case"restart_manual":return{kind:"manual"};case"self_update_disabled":return{kind:"disabled"};case"rate_limited":{const e=Number((t.body.details??{}).retry_after_s);return{kind:"too_soon",wait:Number.isFinite(e)&&e>0?e:null}}case"forbidden":case"cross_site_refused":return{kind:"forbidden"};default:return t.status===429?{kind:"too_soon",wait:null}:t.status===403?{kind:"forbidden"}:t.status===404?{kind:"manual"}:{kind:"error",message:t.body.user_message||""}}return{kind:"error",message:""}}function $(t,e="update"){switch(t.kind){case"in_progress":return"עדכון או הפעלה מחדש אחרת עדיין מתבצעים.";case"update_running":return"מתבצע עדכון, נסו שוב בסיום.";case"not_available":return"אין עדכון זמין. בדקו שוב אם יש עדכון.";case"version_mismatch":return"הגרסה האחרונה השתנתה. בדקו שוב אם יש עדכון.";case"busy":return"תשתית המערכת עסוקה כרגע. נסו שוב בעוד כמה דקות.";case"nvr_write":return"מתבצעת כעת פעולה במכשירי ההקלטה. נסו שוב כשתסתיים.";case"key_reused":return"הבקשה כבר נשלחה. רעננו את העמוד.";case"too_soon":return t.wait?`עדכון הופעל לאחרונה. נסו שוב בעוד ${Math.max(1,Math.ceil(t.wait/60))} דקות.`:"עדכון הופעל לאחרונה. נסו שוב בעוד כמה דקות.";case"not_permitted":return e==="update"?"ל-Arx אין הרשאה לעדכן את עצמו. נדרש שינוי חד-פעמי בהגדרות ההתקנה.":"חסרה הרשאה בתשתית המערכת, ולכן אי אפשר להפעיל אותה מחדש.";case"unreachable":return"תשתית המערכת אינה זמינה כרגע.";case"forbidden":return"אין הרשאה לבצע את הפעולה.";case"manual":return"אי אפשר להפעיל מחדש מכאן. יש להפעיל את השירות ידנית.";case"disabled":return w("selfUpdate.disabledRefused");default:return t.message||"הפעולה נכשלה. נסו שוב."}}const U=[{id:"backup",label:"גיבוי"},{id:"install",label:"הורדה והתקנה"},{id:"restart",label:"הפעלה מחדש"},{id:"verify",label:"בדיקת תקינות"}],nt=[{id:"config",label:"בדיקת תצורה"},{id:"platform",label:"הפעלה מחדש של תשתית המערכת"},{id:"verify",label:"בדיקת תקינות"}];function ot(t){if(t.kind==="platform_restart"){const r=t.state==="succeeded"?3:t.state==="verifying"?2:t.state==="restarting"?1:0;return{steps:nt,current:r}}const e=t.backup||t.backup_requested?U:U.filter(r=>r.id!=="backup"),s=t.state==="backing_up"?"backup":t.state==="verifying"?"verify":t.state==="restarting"?"restart":"install",i=t.state==="succeeded"?e.length:Math.max(0,e.findIndex(r=>r.id===s));return{steps:e,current:i}}function dt(t){if(t.state==="abandoned")return t.kind==="update"?"העדכון לא הסתיים בזמן. ייתכן שהוא עדיין מתבצע או שנעצר באמצע.":"ההפעלה מחדש לא הסתיימה בזמן.";switch(t.error_code){case"platform_not_permitted":return"ל-Arx אין הרשאה לעדכן את עצמו. נדרש שינוי חד-פעמי בהגדרות ההתקנה.";case"infrastructure_unreachable":return"תשתית המערכת אינה זמינה, ולכן הפעולה לא בוצעה.";case"infrastructure_busy":return"תשתית המערכת עסוקה. הפעולה לא בוצעה. נסו שוב בעוד כמה דקות.";case"infrastructure_error":return"תשתית המערכת החזירה שגיאה, והפעולה לא הושלמה.";case"update_job_failed":return"ההורדה או ההתקנה נכשלו. הגרסה הקודמת נשארה במקומה.";case"version_unchanged":return"העדכון לא הוחל: המערכת חזרה באותה גרסה.";case"version_unexpected":return"המערכת חזרה בגרסה לא צפויה.";case"interrupted":return"הפעולה נקטעה לפני שהסתיימה.";case"restart_loop":return"הגרסה החדשה לא עולה כראוי והמערכת מופעלת מחדש שוב ושוב.";case"health_check_failed":return"המערכת התעדכנה אך בדיקת התקינות נכשלה.";case"timeout":return"הפעולה לא הסתיימה בזמן.";case"platform_config_invalid":return"בדיקת התצורה של תשתית המערכת נכשלה, ולכן לא בוצעה הפעלה מחדש. תקנו את התצורה ונסו שוב.";case"restart_not_observed":return"לא נצפתה הפעלה מחדש של תשתית המערכת, ולכן לא ידוע אם בוצעה. בדקו את מצב המערכת ונסו שוב אם צריך.";case"platform_not_back":return"תשתית המערכת לא חזרה לפעולה בזמן.";case"bridge_not_loaded":return"תשתית המערכת חזרה, אך הגשר שלה לא נטען.";case"self_update_disabled":return w("selfUpdate.disabledRun");default:return"הפעולה נכשלה."}}const lt=t=>t.kind==="update"&&(t.state==="abandoned"||["version_unchanged","version_unexpected","interrupted","restart_loop","health_check_failed","timeout","update_job_failed"].includes(t.error_code??"")),ct='בדפי הגיבויים של תשתית המערכת, בחרו את הגיבוי "לפני העדכון" ושחזרו ממנו את התוסף SmplWise Arx. השחזור מחזיר יחד את הגרסה והנתונים.',D='התקינו מחדש את הגרסה הקודמת ושחזרו ב-Arx, בהגדרות ‹ גיבוי, את הקובץ האחרון שנקרא "auto-pre-upgrade".',P="אם Arx אינו עולה: בדפי התוספים של תשתית המערכת הפעילו אותו.";function pt(t){return t==="confirmed"?{note:null,steps:[ct,`לחלופין: ${D}`,`${P} או שחזרו את הגיבוי.`]}:{note:t==="requested"?"ביקשתם גיבוי, אך תשתית המערכת לא אישרה שהוא נוצר. אל תסתמכו עליו.":null,steps:[D,P]}}var ut=Object.defineProperty,ht=Object.getOwnPropertyDescriptor,h=(t,e,s,i)=>{for(var r=i>1?void 0:i?ht(e,s):e,p=t.length-1,o;p>=0;p--)(o=t[p])&&(r=(i?o(e,s,r):o(r))||r);return i&&r&&ut(e,s,r),r};const M=2e3,wt=15e3,ft=90*6e4,vt=1200,mt=10*6e4;function bt(t){return t instanceof z?t.status===401||t.status===502||t.status===503||t.status===504||t.status===0||t.code.startsWith("http_5"):!0}function gt(t){const e=Math.max(0,Math.floor(t/1e3));return`${String(Math.floor(e/60)).padStart(2,"0")}:${String(e%60).padStart(2,"0")}`}let u=class extends I{constructor(){super(...arguments),this.runId="",this.initial=null,this.waitLimitMs=0,this.run=null,this.waiting=!1,this.gaveUp=!1,this.guidance=!1,this.now=Date.now(),this.notFound=!1,this.restartNeeded=!1,this.timer=0,this.tick=0,this.delay=M,this.downSince=0,this.stopped=!1}connectedCallback(){super.connectedCallback(),this.stopped=!1,this.tick=window.setInterval(()=>this.now=Date.now(),1e3),this.poll()}disconnectedCallback(){super.disconnectedCallback(),this.stopped=!0,window.clearTimeout(this.timer),window.clearInterval(this.tick)}limit(){if(this.waitLimitMs>0)return this.waitLimitMs;const t=this.run?.timeout_s??this.initial?.timeout_s;return t&&t>0?t*1e3:(this.run?.kind??this.initial?.kind??"update")==="update"?ft:mt}async poll(){if(!(this.stopped||!this.runId)){try{const t=await rt(this.runId);if(this.run=t,this.waiting=!1,this.downSince=0,this.delay=M,b(t.state)){this.afterSettled(t);return}}catch(t){if(!bt(t)){t instanceof z&&t.status===404&&(this.notFound=!0),this.waiting=!1,this.run||(this.gaveUp=!0);return}if(this.waiting=!0,this.downSince||(this.downSince=Date.now()),this.delay=Math.min(wt,Math.round(this.delay*1.5)),Date.now()-this.downSince>this.limit()){this.gaveUp=!0,this.waiting=!1;return}}this.timer=window.setTimeout(()=>void this.poll(),this.delay)}}afterSettled(t){if(t.kind==="update"&&t.state==="succeeded"&&k().then(s=>this.restartNeeded=s.requires_platform_restart===!0).catch(()=>{}),t.kind!=="update"||t.state!=="succeeded"||!t.to_version)return;let e="";try{e="2.40.0"}catch{return}if(!(!e||e===t.to_version)){try{const s="sw.update.reloaded";if(sessionStorage.getItem(s)===t.run_id)return;sessionStorage.setItem(s,t.run_id)}catch{return}window.location.reload()}}dismiss(){this.dispatchEvent(new CustomEvent("run-dismiss",{bubbles:!0,composed:!0,detail:{run:this.run}}))}elapsed(){const t=Date.parse(this.run?.started_at??this.initial?.started_at??"");return gt(Number.isNaN(t)?0:this.now-t)}view(){const t=this.run??this.initial;return{kind:t?.kind??"update",state:t?.state??"requested",backup:!!t?.backup,backup_requested:!!(t?.backup_requested??t?.backup),error_code:t?.error_code??null}}stillWorking(){const t=this.run??this.initial,e=t?.expected_s??(t?.kind==="platform_restart"?600:vt),s=Date.parse(t?.started_at??"");return Number.isNaN(s)?!1:(this.now-s)/1e3>e}renderGuidance(){const t=pt(this.run?.backup_state??this.initial?.backup_state);return a`<sw-card heading="הוראות שחזור" data-run-guidance data-run-backup-state=${this.run?.backup_state??this.initial?.backup_state??"unknown"}>
      ${t.note?a`<p class="reason" data-run-backup-note>${t.note}</p>`:d}
      <ol class="how">${t.steps.map(e=>a`<li>${e}</li>`)}</ol>
    </sw-card>`}renderOutcome(t){const e=this.run,s=t.kind==="update";if(e?.state==="succeeded")return a`<sw-card data-run-state="succeeded">
        <div class="stack">
          <div class="outcome ok"><sw-icon name="check" size=${22}></sw-icon><span data-run-outcome>${s?a`המערכת עודכנה לגרסה <span class="ver">${e.to_version??""}</span>`:"תשתית המערכת הופעלה מחדש"}</span></div>
          ${s&&this.restartNeeded?a`<p class="reason" data-run-restart-needed>נדרשת הפעלה מחדש של תשתית המערכת</p>`:d}
          <div class="foot"><sw-button variant="primary" data-run-continue @click=${()=>this.dismiss()}>המשך</sw-button></div>
        </div>
      </sw-card>`;const i=this.gaveUp&&!e?{kind:t.kind,state:"abandoned",error_code:"timeout"}:this.gaveUp&&e&&!b(e.state)?{kind:e.kind,state:"abandoned",error_code:"timeout"}:e??t,r=e&&b(e.state)?e.state:"abandoned",p=this.notFound?"הפעולה לא נמצאה.":dt(i),o=s&&lt(i),q=r==="abandoned"?s?"העדכון לא הסתיים":"ההפעלה מחדש לא הסתיימה":s?"העדכון נכשל":"ההפעלה מחדש נכשלה",F=i.error_code??r;return a`<div class="stack" data-run-state=${r==="abandoned"?"abandoned":"failed"} data-run-error=${F}>
      <sw-card>
        <div class="stack">
          <div class="outcome bad"><sw-icon name="warning" size=${22}></sw-icon><span data-run-outcome>${q}</span></div>
          <p class="reason" data-run-reason>${p}</p>
          <div class="foot">
            ${o?a`<sw-button data-run-guidance-open aria-expanded=${this.guidance?"true":"false"} @click=${()=>this.guidance=!this.guidance}>הוראות שחזור</sw-button>`:d}
            <sw-button variant="primary" data-run-close @click=${()=>this.dismiss()}>סגור</sw-button>
          </div>
        </div>
      </sw-card>
      ${o&&this.guidance?this.renderGuidance():d}
    </div>`}render(){const t=this.view(),e=this.run;if(e&&b(e.state)||this.gaveUp||this.notFound)return this.renderOutcome(t);const{steps:s,current:i}=ot(t),r=e?.timeout_s??this.initial?.timeout_s;return a`<sw-card data-run-state=${e?.state??"requested"} data-run-kind=${t.kind}>
      <div class="stack">
        <ol class="steps" data-run-steps>
          ${s.map((p,o)=>a`<li class="step ${o<i?"done":o===i?"current":""}" data-run-step=${p.id} data-run-step-state=${o<i?"done":o===i?"current":"pending"}>
              <span class="mk">${o<i?a`<sw-icon name="check" size=${14}></sw-icon>`:o===i?a`<sw-icon name="refresh" size=${14}></sw-icon>`:d}</span><span>${p.label}</span>
            </li>`)}
        </ol>
        ${this.stillWorking()?a`<div class="wait" role="status" data-run-still-working><sw-icon name="clock" size=${18}></sw-icon>עדיין עובד…</div>`:d}
        ${this.waiting?a`<div class="wait" role="status" data-run-waiting><sw-icon name="clock" size=${18}></sw-icon>ממתין לחזרת המערכת…</div>`:d}
        <div class="meta">
          <span>זמן שעבר</span><span class="t" data-run-elapsed>${this.elapsed()}</span>
        </div>
        ${t.kind==="platform_restart"&&(e?.expected_s||r)?a`<span class="reason" data-run-expect>עשוי להימשך עד ${Math.max(1,Math.round((e?.expected_s??r??600)/60))} דקות</span>`:d}
      </div>
    </sw-card>`}};u.styles=E`
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
  `;h([m()],u.prototype,"runId",2);h([m({attribute:!1})],u.prototype,"initial",2);h([m({type:Number})],u.prototype,"waitLimitMs",2);h([n()],u.prototype,"run",2);h([n()],u.prototype,"waiting",2);h([n()],u.prototype,"gaveUp",2);h([n()],u.prototype,"guidance",2);h([n()],u.prototype,"now",2);h([n()],u.prototype,"notFound",2);h([n()],u.prototype,"restartNeeded",2);u=h([A("sw-update-run")],u);var yt=Object.defineProperty,kt=Object.getOwnPropertyDescriptor,v=(t,e,s,i)=>{for(var r=i>1?void 0:i?kt(e,s):e,p=t.length-1,o;p>=0;p--)(o=t[p])&&(r=(i?o(e,s,r):o(r))||r);return i&&r&&yt(e,s,r),r};const _t=12e4,xt=3e3,$t=15e3;let f=class extends I{constructor(){super(...arguments),this.required=!1,this.reasons=[],this.busy=!1,this.which="platform",this.phase="idle",this.error="",this.key="",this.timer=0,this.startedAt=0,this.sawDown=!1}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}ask(t){this.which=t,this.error="",this.key=L(),this.phase="confirm"}cancel(){this.phase==="confirm"&&(this.phase="idle")}async confirm(){if(this.phase==="confirm"){if(this.phase="sending",this.error="",this.which==="platform"){try{const t=await st(this.key);this.phase="idle",this.dispatchEvent(new CustomEvent("run-started",{detail:t,bubbles:!0,composed:!0}))}catch(t){this.phase="idle",this.error=$(x(t),"restart")}return}try{await it()}catch(t){const e=x(t);this.phase="idle",this.error=$(e,"restart");return}this.phase="waiting",this.startedAt=Date.now(),this.sawDown=!1,this.schedule()}}schedule(){window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.poll(),xt)}async poll(){const t=Date.now()-this.startedAt;try{if(await N("me"),this.sawDown||t>$t){window.location.reload();return}}catch{this.sawDown=!0}if(t>_t){this.phase="manual";return}this.schedule()}again(){this.phase="waiting",this.startedAt=Date.now(),this.sawDown=!1,this.schedule()}render(){const t=this.which==="arx",e=this.busy||this.phase==="sending";return a`<sw-card heading="הפעלות מחדש" data-restarts-card>
      ${this.required?a`<div class="row" data-restart-required><span class="need"><span class="dot" aria-hidden="true"></span>נדרשת הפעלה מחדש של תשתית המערכת</span>${this.reasons.filter(s=>s.code==="bridge").map(s=>a`<span class="lbl" data-restart-reason>רכיב החיבור: ממתינה גרסה ${s.version??"—"}, פועלת ${s.running??"לא דווחה"}</span>`)}</div>`:d}
      ${this.phase==="waiting"?a`<div class="wait" role="status" data-restart-phase="waiting"><sw-icon name="refresh" size=${18}></sw-icon>המערכת מופעלת מחדש…</div>`:this.phase==="manual"?a`<div class="row" role="alert" data-restart-phase="manual"><span class="lbl" data-restart-manual>המערכת לא חזרה. הפעילו ידנית.</span><sw-button data-restart-again @click=${()=>this.again()}>בדקו שוב</sw-button></div>`:a`<div class="rows">
              ${_("system.configure")&&!H()?a`<div class="row"><span class="lbl">Arx</span><sw-button icon="power" ?disabled=${e} data-restart-arx @click=${()=>this.ask("arx")}>הפעל מחדש את Arx</sw-button></div>`:d}
              <div class="row"><span class="lbl">תשתית המערכת</span><sw-button icon="power" variant=${this.required?"primary":"secondary"} ?disabled=${e} data-restart-platform @click=${()=>this.ask("platform")}>הפעל מחדש את תשתית המערכת</sw-button></div>
            </div>`}
      ${this.error?a`<p class="msg err" role="alert" data-restart-error>${this.error}</p>`:d}
    </sw-card>
    <sw-dialog ?open=${this.phase==="confirm"} heading=${t?"להפעיל מחדש את Arx?":"להפעיל מחדש את תשתית המערכת?"}
        subheading=${t?"המערכת לא תהיה זמינה לרגעים אחדים":"Arx יישאר פעיל, אך התשתית לא תהיה זמינה לכמה דקות"} data-restart-dialog data-restart-which=${this.which} @close=${()=>this.cancel()}>
        <div slot="footer">
          <sw-button variant="primary" data-restart-confirm @click=${()=>void this.confirm()}>הפעל מחדש</sw-button>
          <sw-button variant="ghost" data-restart-cancel @click=${()=>this.cancel()}>ביטול</sw-button>
        </div>
      </sw-dialog>`}};f.styles=E`
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
  `;v([m({type:Boolean})],f.prototype,"required",2);v([m({attribute:!1})],f.prototype,"reasons",2);v([m({type:Boolean})],f.prototype,"busy",2);v([n()],f.prototype,"which",2);v([n()],f.prototype,"phase",2);v([n()],f.prototype,"error",2);f=v([A("sw-restarts-card")],f);var St=Object.defineProperty,zt=Object.getOwnPropertyDescriptor,c=(t,e,s,i)=>{for(var r=i>1?void 0:i?zt(e,s):e,p=t.length-1,o;p>=0;p--)(o=t[p])&&(r=(i?o(e,s,r):o(r))||r);return i&&r&&St(e,s,r),r};const S="sw.update.run";function R(){try{return sessionStorage.getItem(S)??""}catch{return""}}function y(t){try{t?sessionStorage.setItem(S,t):sessionStorage.removeItem(S)}catch{}}const Et=["בתשתית המערכת: הגדרות ‹ תוספים ‹ SmplWise Arx ‹ בדיקת עדכונים.",'סמנו "גיבוי לפני העדכון" ולחצו על עדכון. ההתקנה נמשכת כמה דקות.','חזרו לכאן ולחצו "בדוק אם יש עדכון". מכאן והלאה העדכונים יתבצעו מתוך Arx.'];let l=class extends I{constructor(){super(...arguments),this.data=null,this.loadError="",this.checking=!1,this.failure=null,this.degraded=!1,this.savingInterval=!1,this.intervalError="",this.tz="Asia/Jerusalem",this.runId="",this.runHint=null,this.confirmOpen=!1,this.backup=!0,this.applying=!1,this.applyError="",this.manualOpen=!1,this.switchSaving=!1,this.switchError="",this.applyKey=""}connectedCallback(){super.connectedCallback(),!this.notHolder()&&(this.load(),W().then(t=>this.tz=t["time.zone"]??this.tz).catch(()=>{}))}async load(){this.loadError="";try{const t=await k();this.data=t,T(t.update_available,t.requires_platform_restart===!0);const e=t.run?.run_id??t.run?.id??"";e&&!this.runId?(this.runId=e,y(e)):!this.runId&&R()&&(this.runId=R())}catch(t){this.loadError=g(t)}}openConfirm(){this.backup=!0,this.applyError="",this.applyKey=L(),this.confirmOpen=!0}async confirmApply(){const t=this.data?.latest;if(!(this.applying||!t)){this.applying=!0,this.applyError="";try{const e=await at({target_version:t,backup:this.backup,idempotency_key:this.applyKey});this.confirmOpen=!1,this.startRun(e)}catch(e){const s=x(e);this.applyError=$(s,"update"),(s.kind==="not_available"||s.kind==="version_mismatch"||s.kind==="in_progress")&&this.load()}finally{this.applying=!1}}}startRun(t){this.runHint=t,this.runId=t.run_id,y(t.run_id)}endRun(){this.runId="",this.runHint=null,y(""),this.load()}async check(){if(!this.checking){this.checking=!0,this.failure=null,this.degraded=!1;try{const t=await G();this.degraded=!t.refreshed||t.check_result==="refresh_failed_read_ok",this.data={...this.data??{update_available:!1},installed:t.installed,latest:t.latest,update_available:t.update_available,checked_at:t.checked_at,check_result:t.check_result,permitted:"yes"},T(t.update_available)}catch(t){this.failure=K(t),k().then(e=>this.data=e).catch(()=>{})}finally{this.checking=!1}}}async pickInterval(t){if(!(this.savingInterval||!this.data||this.data.interval_hours===t)){this.savingInterval=!0,this.intervalError="";try{const e=await Y(t);this.data={...this.data,interval_hours:e.interval_hours}}catch(e){this.intervalError=g(e)}finally{this.savingInterval=!1}}}async setApplyEnabled(t){if(!(this.switchSaving||!this.data)){this.switchSaving=!0,this.switchError="";try{const e=await B({"update.apply_enabled":t?"true":"false"});J(),this.data={...this.data,apply_enabled:e.settings["update.apply_enabled"]!=="false"}}catch(e){this.switchError=g(e)}finally{this.switchSaving=!1}}}renderSwitch(t){const e=t.apply_enabled!==!1,s=!O()||_("system.configure");return a`<sw-card heading=${w("selfUpdate.heading")} data-update-switch-card>
      <div class="row">
        <span class="lbl" id="sw-update-switch-lbl">${w("selfUpdate.switchLabel")}</span>
        <span class="seg" role="group" aria-labelledby="sw-update-switch-lbl" data-update-switch data-on=${e?"true":"false"}>
          ${[!0,!1].map(i=>a`<button type="button" data-update-switch-option=${i?"on":"off"} aria-pressed=${e===i?"true":"false"} ?disabled=${!s||this.switchSaving}
              @click=${()=>{e!==i&&this.setApplyEnabled(i)}}>${i?w("selfUpdate.on"):w("selfUpdate.off")}</button>`)}
        </span>
      </div>
      <p class="msg" data-update-switch-hint>${w("selfUpdate.switchHint")}</p>
      ${s?d:a`<p class="msg" data-update-switch-ro>${w("selfUpdate.needsConfigure")}</p>`}
      ${this.switchError?a`<p class="msg err" role="alert" data-update-switch-error>${this.switchError}</p>`:d}
    </sw-card>`}when(t){if(!t)return"";const e=new Date(t);return Number.isNaN(e.getTime())?"":X(e,{timeZone:this.tz})}failureText(t){switch(t.kind){case"rate_limited":return t.wait?`הבדיקה בוצעה זה עתה. נסו שוב בעוד ${t.wait} שניות.`:"הבדיקה בוצעה זה עתה. נסו שוב בעוד רגע.";case"not_permitted":return"חסרה הרשאה בתשתית המערכת, ולכן אי אפשר לבדוק עדכונים.";case"unreachable":return"תשתית המערכת אינה זמינה כרגע.";default:return t.message||"הבדיקה נכשלה. נסו שוב."}}renderStatus(t){return t.checked_at?t.update_available?a`<span class="status avail" data-update-status="available"><sw-icon name="info" size=${16}></sw-icon>יש גרסה חדשה</span>`:t.check_result==="not_permitted"?a`<span class="status" data-update-status="not-permitted">אין הרשאה לבדוק</span>`:t.check_result==="unreachable"||t.check_result==="error"?a`<span class="status" data-update-status="failed">לא ניתן לבדוק</span>`:a`<span class="status up" data-update-status="current"><sw-icon name="check" size=${16}></sw-icon>הגרסה מעודכנת</span>`:a`<span class="status" data-update-status="never">טרם בוצעה בדיקה</span>`}renderNotes(t){if(!t.update_available)return d;const e=t.notes??[];return a`<sw-card heading="מה חדש" data-update-notes>
      ${e.length?e.map(s=>a`<div class="note" data-update-note><h4 class="ver">${s.version}</h4>
              ${s.he?a`<div class="txt" lang="he">${s.he}</div>`:d}${s.en?a`<div class="txt" lang="en">${s.en}</div>`:d}
              ${s.platform_restart?a`<div class="txt" data-update-note-restart>דורש הפעלה מחדש של תשתית המערכת</div>`:d}</div>`):a`<p class="msg" data-update-notes-empty>אין פירוט זמין</p>`}
      ${this.renderApply(t)}
    </sw-card>`}renderApply(t){return t.permitted==="no"||this.failure?.kind==="not_permitted"||!this.failure&&t.check_result==="not_permitted"?a`<div class="apply" data-update-blocked>
        <p class="msg err">ל-Arx אין הרשאה לעדכן את עצמו. נדרש שינוי חד-פעמי בהגדרות ההתקנה.</p>
        <div class="foot"><sw-button size="sm" data-update-manual-open aria-expanded=${this.manualOpen?"true":"false"} @click=${()=>this.manualOpen=!this.manualOpen}>הוראות</sw-button></div>
        ${this.manualOpen?a`<ol class="how" data-update-manual>${Et.map(s=>a`<li>${s}</li>`)}</ol>`:d}
      </div>`:t.apply_enabled===!1?a`<div class="apply" data-update-disabled><p class="msg" role="status">${w("selfUpdate.disabledNotice")}</p></div>`:a`<div class="foot"><sw-button variant="primary" icon="download" data-update-apply @click=${()=>this.openConfirm()}>עדכן</sw-button></div>`}renderConfirm(t){return a`<sw-dialog ?open=${this.confirmOpen} ?locked=${this.applying} heading="לעדכן את SmplWise Arx?" data-update-dialog @close=${()=>this.confirmOpen=!1}>
      <div class="col">
        <div class="msg ver-line" data-update-dialog-versions>מגרסה <span class="ver">${t.installed??"—"}</span> לגרסה <span class="ver">${t.latest??"—"}</span></div>
        <div class="msg">המערכת לא תהיה זמינה כמה דקות</div>
        <label class="chk"><input type="checkbox" data-update-backup .checked=${this.backup} ?disabled=${this.applying} @change=${e=>this.backup=e.target.checked} /><span class="box" aria-hidden="true"></span><span>צור גיבוי לפני העדכון</span></label>
        ${this.applyError?a`<p class="msg err" role="alert" data-update-apply-error>${this.applyError}</p>`:d}
      </div>
      <div slot="footer">
        <sw-button variant="primary" data-update-confirm ?disabled=${this.applying} @click=${()=>void this.confirmApply()}>עדכן עכשיו</sw-button>
        <sw-button variant="ghost" data-update-cancel ?disabled=${this.applying} @click=${()=>this.confirmOpen=!1}>ביטול</sw-button>
      </div>
    </sw-dialog>`}notHolder(){return O()&&!_("system.update")}render(){if(this.notHolder())return a`<sw-page crumbs="הגדרות" heading="עדכונים"><sw-state-panel state="forbidden" data-update-forbidden></sw-state-panel></sw-page>`;const t=this.data;if(!t)return a`<sw-page crumbs="הגדרות" heading="עדכונים">
        ${this.loadError?a`<sw-state-panel state="error" heading="לא ניתן לטעון את מצב העדכונים" hint=${this.loadError} actionLabel="נסו שוב" data-update-load-error @action=${()=>void this.load()}></sw-state-panel>`:a`<sw-state-panel state="loading" data-update-loading></sw-state-panel>`}
      </sw-page>`;if(this.runId)return a`<sw-page crumbs="הגדרות" heading="עדכונים">
        <div class="col" data-system-update data-update-run-page>
          <sw-update-run .runId=${this.runId} .initial=${this.runHint} @run-dismiss=${()=>this.endRun()}></sw-update-run>
        </div>
      </sw-page>`;const e=t.interval_hours??6,s=this.failure?.kind==="not_permitted"||!this.failure&&t.check_result==="not_permitted",i=t.checked_at?`${this.when(t.checked_at)} · ${V(t.check_result,t.update_available)}`:"טרם בוצעה בדיקה";return a`<sw-page crumbs="הגדרות" heading="עדכונים">
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
          ${this.failure?a`<p class="msg err" role="alert" data-update-failure=${this.failure.kind}>${this.failureText(this.failure)}</p>`:s?a`<p class="msg err" data-update-failure="not_permitted">${this.failureText({kind:"not_permitted"})}</p>`:this.degraded?a`<p class="msg" role="status" data-update-degraded>הרשימה לא רועננה, והבדיקה נעשתה לפי המצב הנוכחי. ייתכן שגרסה חדשה עוד לא מופיעה.</p>`:d}
        </sw-card>
        <sw-card heading="בדיקה אוטומטית" data-update-interval-card>
          <div class="seg" role="group" aria-label="תדירות בדיקה אוטומטית" data-update-interval>
            ${Z.map(r=>a`<button type="button" data-update-interval-option=${r} aria-pressed=${e===r?"true":"false"} ?disabled=${this.savingInterval} @click=${()=>void this.pickInterval(r)}>${Q(r)}</button>`)}
          </div>
          ${this.intervalError?a`<p class="msg err" role="alert" data-update-interval-error>${this.intervalError}</p>`:d}
        </sw-card>
        ${this.renderSwitch(t)}
        ${this.renderNotes(t)}
        <sw-restarts-card ?required=${t.requires_platform_restart===!0} .reasons=${t.platform_restart_reasons??[]} @run-started=${r=>this.startRun(r.detail)}></sw-restarts-card>
      </div>
      ${this.renderConfirm(t)}
    </sw-page>`}};l.styles=[tt,E`
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
  `];c([n()],l.prototype,"data",2);c([n()],l.prototype,"loadError",2);c([n()],l.prototype,"checking",2);c([n()],l.prototype,"failure",2);c([n()],l.prototype,"degraded",2);c([n()],l.prototype,"savingInterval",2);c([n()],l.prototype,"intervalError",2);c([n()],l.prototype,"tz",2);c([n()],l.prototype,"runId",2);c([n()],l.prototype,"runHint",2);c([n()],l.prototype,"confirmOpen",2);c([n()],l.prototype,"backup",2);c([n()],l.prototype,"applying",2);c([n()],l.prototype,"applyError",2);c([n()],l.prototype,"manualOpen",2);c([n()],l.prototype,"switchSaving",2);c([n()],l.prototype,"switchError",2);l=c([A("system-update")],l);export{l as SystemUpdate};
//# sourceMappingURL=system-update-CfxcuVcS.js.map
